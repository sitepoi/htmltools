'use strict'

// Stage 3d - implement the planned tasks in BATCHES.
//
// Every task carries a score out of 100 that estimates its cost. Tasks are
// packed into batches that add up to roughly 100 points, so one AI call gets
// neither a single rename nor twenty tasks: one prompt worth of work.
// The batch patch is applied atomically, validated, and rolled back as a unit
// when anything fails, so the tool folder never stays half written.

const fs = require('fs')
const os = require('os')
const path = require('path')
const { applyBatchPrompt } = require('../ai/prompts')
const { applyOps } = require('../code/patch')
const { validateFiles, validateText } = require('../code/validate')
const { checkTargetPath } = require('../tool/contract')
const { recordLesson } = require('../knowledge/contextPack')
const { domSmokeProbe } = require('../agent/probes')
const { unifiedDiff, summarizeDiff } = require('../code/diff')
const ssotModel = require('../ssot/model')
const scoring = require('../ssot/scoring')
const { nowIso, sleep } = require('../util')
const { askJson, askJsonWithTools, renderAndSave } = require('./shared')

const CONTRACT = '{ "summary": "", "completed": ["T-01"], ' +
  '"ops": [ { "op": "create|replace|append|delete", "file": "", "find": "", "content": "" } ], "notes": "" }'
const MAX_DIFF_CHARS = 24000

function rollbackBatch(workspace, undoMap) {
  let restored = 0
  for (const [filePath, originalText] of undoMap.entries()) {
    try {
      const absolutePath = workspace.resolveInside(filePath)
      if (originalText === null) {
        if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath)
      } else {
        fs.writeFileSync(absolutePath, originalText, 'utf8')
      }
      restored += 1
    } catch (_error) {
      // best effort
    }
  }
  return restored
}

function buildDiff(changed) {
  const parts = []
  changed.forEach((change) => {
    const before = change.before === null || change.before === undefined ? '' : change.before
    const after = change.after === null || change.after === undefined ? '' : change.after
    const part = unifiedDiff(before, after, { file: change.file, maxChars: MAX_DIFF_CHARS })
    if (part) parts.push(part)
  })
  const combined = parts.join('')
  if (combined.length > MAX_DIFF_CHARS) {
    return combined.slice(0, MAX_DIFF_CHARS) + '\n... [diff trimmed]\n'
  }
  return combined
}

// Tokens the provider reported for this batch, 0 when it reported none.
function batchTokenDelta(counters, before) {
  const prompt = (Number(counters.apiPromptTokens) || 0) - (Number(before.apiPromptTokens) || 0)
  const completion = (Number(counters.apiCompletionTokens) || 0) - (Number(before.apiCompletionTokens) || 0)
  return Math.max(0, prompt + completion)
}

// Validates the files a batch is about to produce, before they exist on disk.// The JavaScript check runs "node --check" on a real path, so the prospective
// content is written to a temporary file with the same extension first.
function validateChangedFiles(changed) {
  const errors = []
  const warnings = []
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'html-tool-factory-validate-'))
  try {
    let index = 0
    ;(Array.isArray(changed) ? changed : []).forEach((change) => {
      if (change.after === null || change.after === undefined) return
      index += 1
      const extension = path.extname(change.file) || '.txt'
      const temporaryPath = path.join(temporaryDirectory, 'file' + index + extension)
      fs.writeFileSync(temporaryPath, change.after, 'utf8')
      const outcome = validateText(change.file, change.after, { absolutePath: temporaryPath })
      outcome.problems.forEach((problem) => {
        const line = change.file + ': ' + problem.message
        if (problem.level === 'error') errors.push(line)
        else warnings.push(line)
      })
    })
  } finally {
    try {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true })
    } catch (_cleanupError) {
      // a leftover temporary folder must never fail a batch
    }
  }
  return { ok: errors.length === 0, errors, warnings }
}

// Holds one batch until the operator approves or rejects it in the dashboard.
// The wait is bounded, and a Stop or a Pause ends it immediately, so a forgotten
// review can never hold a run open forever.
async function requestBatchReview(options) {
  const context = options.context
  const run = context.run
  const batch = options.batch
  const reviewSettings = (context.config && context.config.review) || {}
  const timeoutMs = Math.max(10000, Number(reviewSettings.timeoutMs) || 900000)
  const pollMs = Math.max(100, Number(reviewSettings.pollMs) || 500)
  const request = {
    id: 'RV-' + batch.id + '-' + Date.now(),
    batchId: batch.id,
    batchOf: options.batchCount || 1,
    points: options.points || batch.points,
    tasks: batch.tasks.map((task) => ({ id: task.id, title: task.title, points: task.points })),
    files: options.files || [],
    diff: options.diff || '',
    diffStats: options.diffStats || null,
    requestedAt: nowIso()
  }

  context.store.writeReview(run.id, { request, decision: null, note: '' })
  run.pendingReview = request
  context.store.saveRun(run)
  if (typeof context.setNow === 'function') {
    context.setNow({
      batchId: batch.id,
      taskIds: batch.tasks.map((task) => task.id),
      detail: 'batch ' + batch.id + ' is waiting for your review (' + request.files.length + ' file(s), ' +
        '+' + ((request.diffStats && request.diffStats.added) || 0) + ' -' +
        ((request.diffStats && request.diffStats.removed) || 0) + ')'
    })
  }
  context.log('info', 'Batch ' + batch.id + ' is waiting for review: ' + request.files.join(', '))

  const deadline = Date.now() + timeoutMs
  let decision = { approved: false, note: 'no decision reached before the run was stopped' }
  while (Date.now() < deadline) {
    await sleep(pollMs)
    const latest = context.store.loadRun(run.id)
    if (!latest || latest.status !== 'running') {
      decision = { approved: false, note: 'the run was ' + ((latest && latest.status) || 'removed') + ' while the batch waited' }
      break
    }
    const current = context.store.readReview(run.id)
    if (current && current.decision) {
      decision = { approved: current.decision === 'approve', note: String(current.note || '') }
      break
    }
  }
  if (!decision.approved && !decision.note) {
    decision = { approved: false, note: 'no decision within ' + Math.round(timeoutMs / 1000) + 's' }
  }

  context.store.clearReview(run.id)
  run.pendingReview = null
  context.store.saveRun(run)
  if (typeof context.setNow === 'function') {
    context.setNow({
      batchId: batch.id,
      taskIds: batch.tasks.map((task) => task.id),
      detail: 'batch ' + batch.id + (decision.approved ? ' approved' : ' rejected')
    })
  }
  return decision
}

function closeLinkedWork(ssot, task) {
  if (task.featureId) {
    const feature = ssotModel.findById(ssot.features, task.featureId)
    if (feature) feature.status = 'done'
  }
  if (task.checklistId) {
    const item = ssotModel.findChecklistItem(ssot, task.checklistId)
    if (item) {
      item.status = 'done'
      item.doneAt = nowIso()
      item.taskId = task.id
    }
  }
  if (task.usabilityFindingId) {
    const finding = ssotModel.findById(ssot.usability, task.usabilityFindingId)
    if (finding) {
      finding.status = 'addressed'
      finding.addressedAt = nowIso()
    }
  }
}

async function run(context) {
  const { run: currentRun, ssot, ai, store, log, config, workspace } = context
  const limits = config.limits
  const applySettings = config.apply || {}
  const agentic = config.agentic || {}
  const useTools = agentic.enabled !== false
  const maxToolRounds = Math.max(0, Math.min(4, Number(agentic.maxToolRounds) || 2))
  const inlineFileChars = useTools ? (Number(agentic.inlineFileChars) || 6000) : 0
  const allowDelete = Boolean(config.tool && config.tool.allowDelete === true)
  const maxAttempts = Math.max(1, Number(limits.taskAttempts) || 3)
  const maxRetries = Number(limits.taskRetries) || 2
  // T-03: a whole file rewrite is allowed once the batch is big enough that an
  // anchor based patch is the fragile option.
  const overwriteMinPoints = Number(applySettings.overwriteMinPoints) || 80
  // T-04: the operator may hold every batch before it is written.
  const reviewEachBatch = Boolean(
    (currentRun.options && currentRun.options.review && currentRun.options.review.eachBatch) ||
    (config.review && config.review.eachBatch === true)
  )

  const maxTasks = Math.min(
    Number(currentRun.options.maxTasksPerIteration) || limits.maxTasksPerIteration || 5,
    limits.maxTasksPerIteration || 5
  )
  const queue = ssotModel.todoTasks(ssot).slice(0, maxTasks)

  if (!queue.length) {
    const summary = 'No open tasks to implement.'
    ssotModel.appendLog(ssot, 'apply-tasks', summary)
    renderAndSave(store, currentRun, ssot)
    return { summary, ssot }
  }

  // Scores are filled here too, so tasks written by any stage (or by hand) are
  // always batched on the same scale.
  scoring.applyPoints(ssot)
  const batches = scoring.buildBatches(queue, {
    targetPoints: applySettings.pointsPerPrompt,
    maxBatchPoints: applySettings.maxBatchPoints,
    maxTasksPerBatch: applySettings.maxTasksPerBatch
  })

  log('info', 'Implementation plan: ' + queue.length + ' task(s) in ' + batches.length + ' batch(es) - ' +
    batches.map((batch) => batch.id + ' ' + batch.points + 'pt [' + batch.label + ']').join('; '))

  let doneCount = 0
  let failedCount = 0
  const failureNotes = []
  const batchLog = []

  for (const batch of batches) {
    batch.tasks.forEach((task) => {
      task.status = 'doing'
      task.batchId = batch.id
    })
    const stepEntry = {
      id: batch.id,
      points: batch.points,
      status: 'doing',
      startedAt: nowIso(),
      tasks: batch.tasks.map((task) => ({ id: task.id, title: task.title, points: task.points }))
    }
    batchLog.push(stepEntry)
    store.writeSsot(currentRun.id, ssot)
    renderAndSave(store, currentRun, ssot)
    if (typeof context.setStep === 'function') context.setStep({ tasks: batchLog })
    // The dashboard shows this line live: which batch, which tasks, which
    // attempt. It answers "what is it doing right now" without a rebuild.
    if (typeof context.setNow === 'function') {
      context.setNow({
        batchId: batch.id,
        taskIds: batch.tasks.map((task) => task.id),
        detail: 'batch ' + batch.id + ' of ' + batches.length + ': ' +
          batch.tasks.map((task) => task.id + ' ' + task.title).join(' + ')
      })
    }
    log('info', 'Batch ' + batch.id + ' (' + batch.tasks.length + ' task(s), ' + batch.points +
      ' points): ' + batch.label)

    const undoMap = new Map()
    let succeeded = false
    let rejectedByOperator = false
    let lastProblems = []
    const allowOverwrite = Number(batch.points) >= overwriteMinPoints
    const usageBefore = {
      aiCalls: currentRun.counters.aiCalls,
      inputChars: currentRun.counters.inputChars,
      outputChars: currentRun.counters.outputChars,
      apiPromptTokens: Number(currentRun.counters.apiPromptTokens) || 0,
      apiCompletionTokens: Number(currentRun.counters.apiCompletionTokens) || 0
    }
    // Did the tool boot before this batch? Only a regression counts, so an
    // existing probe failure cannot block every batch forever.
    const toolScriptPath = 'app/' + (currentRun.toolName || '') + '.js'
    let probeBefore = null
    try {
      if (currentRun.toolName && workspace.exists(toolScriptPath)) {
        probeBefore = domSmokeProbe(workspace, toolScriptPath)
      }
    } catch (_probeError) {
      probeBefore = null
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      batch.tasks.forEach((task) => { task.attempts = (task.attempts || 0) + 1 })
      if (typeof context.setNow === 'function') {
        context.setNow({
          attempt,
          maxAttempts,
          detail: 'batch ' + batch.id + ' of ' + batches.length + ', attempt ' + attempt + ' of ' +
            maxAttempts + ': ' + batch.tasks.map((task) => task.id + ' ' + task.title).join(' + ')
        })
      }
      let answer
      try {
        const prompt = applyBatchPrompt({
          ssot,
          tasks: batch.tasks,
          batchId: batch.id,
          workspace,
          attempt,
          previousProblems: lastProblems,
          maxSourceFileChars: limits.maxSourceFileChars,
          inlineFileChars,
          toolName: currentRun.toolName || 'TheTool',
          toolPrefix: currentRun.toolPrefix || 'tl-',
          allowOverwrite,
          overwriteMinPoints
        })
        answer = useTools
          ? await askJsonWithTools(ai, {
            stage: 'apply-tasks',
            prompt,
            contract: CONTRACT,
            log,
            model: config.models.coder,
            workspace,
            maxRounds: maxToolRounds,
            toolOptions: {
              probes: (config.agent && config.agent.probes) || undefined,
              web: (config.agent && config.agent.web) || undefined
            },
            toolLog: currentRun.toolLog || (currentRun.toolLog = [])
          })
          : await askJson(ai, {
            stage: 'apply-tasks',
            prompt,
            contract: CONTRACT,
            log,
            model: config.models.coder
          })
      } catch (aiError) {
        lastProblems = [{ file: '', message: aiError.message }]
        log('warn', 'The model call failed for ' + batch.id + ': ' + aiError.message)
        break
      }

      const operations = Array.isArray(answer.ops) ? answer.ops : []
      if (!operations.length) {
        lastProblems = [{ file: '', message: 'The answer contained no operations.' }]
        log('warn', 'Batch ' + batch.id + ' returned no operations; asking again.')
        continue
      }

      // Only the html tool files are writable.
      const blockedPaths = operations
        .map((operation) => String((operation && (operation.file || operation.path)) || '').replace(/\\/g, '/'))
        .filter(Boolean)
        .map((file) => ({ file, verdict: checkTargetPath(file, currentRun.toolName) }))
        .filter((entry) => !entry.verdict.ok)
      if (blockedPaths.length) {
        lastProblems = blockedPaths.map((entry) => ({ file: entry.file, message: entry.verdict.reason }))
        log('warn', 'Patch rejected for ' + batch.id + ': ' +
          lastProblems.map((problem) => problem.message).join(' | '))
        continue
      }

      // The patch is computed without writing anything first: the prospective
      // files are validated, the diff is built, and the operator may hold the
      // batch before a single byte lands. T-03 and T-04 share this path.
      const plan = applyOps(workspace, operations, {
        allowDelete,
        allowOverwrite,
        overwriteMinPoints,
        dryRun: true
      })

      if (!plan.ok) {
        lastProblems = plan.problems
        log('warn', 'Patch rejected for ' + batch.id + ': ' +
          plan.problems.map((problem) => problem.message).join(' | '))
        continue
      }

      const plannedValidation = validateChangedFiles(plan.changed)
      if (!plannedValidation.ok) {
        lastProblems = plannedValidation.errors.map((message) => ({ file: '', message }))
        log('warn', 'Validation failed for ' + batch.id + ': ' + plannedValidation.errors.join(' | '))
        continue
      }
      if (plannedValidation.warnings.length) {
        log('warn', batch.id + ' warnings: ' + plannedValidation.warnings.join(' | '))
      }

      const diff = buildDiff(plan.changed)
      const diffStats = summarizeDiff(diff)

      // T-04: hold the batch and let the operator decide. Nothing is written
      // yet, so a rejection costs one attempt and no rollback.
      if (reviewEachBatch) {
        const decision = await requestBatchReview({
          context,
          batch,
          batchCount: batches.length,
          diff,
          diffStats,
          files: plan.changed.map((change) => change.file),
          points: batch.points
        })
        if (!decision.approved) {
          rejectedByOperator = true
          lastProblems = [{
            file: '',
            message: 'The operator rejected this batch: ' + (decision.note || 'no reason given')
          }]
          log('warn', 'Batch ' + batch.id + ' was rejected before it was written.' +
            (decision.note ? ' Reason: ' + decision.note : ''))
          break
        }
        log('info', 'Batch ' + batch.id + ' approved by the operator.')
      }

      const applyResult = applyOps(workspace, operations, {
        backupDirectory: path.join(currentRun.directory, '.backup'),
        allowDelete,
        allowOverwrite,
        overwriteMinPoints
      })

      if (!applyResult.ok) {
        lastProblems = applyResult.problems
        log('warn', 'Patch rejected for ' + batch.id + ': ' +
          applyResult.problems.map((problem) => problem.message).join(' | '))
        continue
      }

      applyResult.changed.forEach((change) => {
        if (!undoMap.has(change.file)) undoMap.set(change.file, change.before)
      })

      const validation = validateFiles(workspace, applyResult.changed.map((change) => change.file))
      if (!validation.ok) {
        lastProblems = validation.errors.map((message) => ({ file: '', message }))
        log('warn', 'Validation failed for ' + batch.id + ': ' + validation.errors.join(' | '))
        continue
      }
      if (validation.warnings.length) {
        log('warn', batch.id + ' warnings: ' + validation.warnings.join(' | '))
      }

      // The tool must still boot after the batch, or nothing is committed.
      let probeAfter = null
      try {
        if (currentRun.toolName) probeAfter = domSmokeProbe(workspace, toolScriptPath)
      } catch (_probeError) {
        probeAfter = null
      }
      if (probeBefore && probeBefore.ok && probeAfter && !probeAfter.ok) {
        lastProblems = [{
          file: toolScriptPath,
          message: 'The batch broke the tool: ' + String(probeAfter.text || '').slice(0, 300)
        }]
        log('warn', 'Batch ' + batch.id + ' was reverted: the tool no longer boots.')
        continue
      }

      const claimed = (Array.isArray(answer.completed) ? answer.completed : []).map(String)
      batch.tasks.forEach((task) => {
        task.status = 'done'
        task.doneAt = nowIso()
        task.summary = String(answer.summary || '').slice(0, 300)
        task.changedFiles = applyResult.changed.map((change) => change.file)
        task.diff = diff
        task.diffStats = diffStats
        if (claimed.length && !claimed.includes(task.id)) {
          task.notes = 'Landed in batch ' + batch.id + ' (model listed: ' + claimed.join(', ') + ')'
        }
        closeLinkedWork(ssot, task)
      })
      doneCount += batch.tasks.length
      currentRun.counters.tasksDone += batch.tasks.length
      // Real numbers, not estimates: the delta of this batch. It calibrates the
      // point score and it is what the cost guard actually spends.
      const usage = {
        aiCalls: currentRun.counters.aiCalls - usageBefore.aiCalls,
        inputChars: currentRun.counters.inputChars - usageBefore.inputChars,
        outputChars: currentRun.counters.outputChars - usageBefore.outputChars,
        apiTokens: batchTokenDelta(currentRun.counters, usageBefore)
      }
      let checkpointId = ''
      try {
        const checkpointFiles = applyResult.changed
          .filter((change) => change.after !== null && change.after !== undefined)
          .map((change) => ({ path: change.file, content: change.after }))
        if (checkpointFiles.length && typeof store.saveCheckpoint === 'function') {
          checkpointId = store.saveCheckpoint(currentRun, batch.id, checkpointFiles, ssot).id
        }
      } catch (_checkpointError) {
        // a missing checkpoint must never fail the batch
      }
      Object.assign(stepEntry, {
        status: 'done',
        finishedAt: nowIso(),
        files: applyResult.changed.map((change) => change.file),
        diffStats,
        usage,
        // The tokens the provider reported for this batch, or the character
        // estimate when it reported none.
        tokens: usage.apiTokens > 0 ? usage.apiTokens : Math.ceil((usage.inputChars + usage.outputChars) / 4),
        tokensMeasured: usage.apiTokens > 0,
        checkpoint: checkpointId,
        summary: String(answer.summary || '').slice(0, 200)
      })
      log('info', 'Batch ' + batch.id + ' done (' + batch.tasks.length + ' task(s), ' +
        applyResult.changed.length + ' file(s)' +
        (diffStats ? ', +' + diffStats.added + ' -' + diffStats.removed : '') +
        ', ' + String(stepEntry.tokens) + (stepEntry.tokensMeasured ? ' real' : ' est.') + ' tokens)')
      succeeded = true
      break
    }

    if (!succeeded) {
      lastProblems = lastProblems.length ? lastProblems : [{ file: '', message: 'No attempt produced a valid patch.' }]
      const restored = rollbackBatch(workspace, undoMap)
      failedCount += batch.tasks.length
      currentRun.counters.tasksFailed += batch.tasks.length
      batch.tasks.forEach((task) => {
        task.lastProblems = lastProblems
          .map((problem) => (problem.file ? problem.file + ': ' : '') + problem.message)
          .slice(0, 5)
        failureNotes.push(task.id + ': ' + (task.lastProblems[0] || 'unknown problem'))
        if (rejectedByOperator) {
          // A rejection is a decision, not a failure: the task goes back to the
          // queue untouched, so nothing counts against its retry budget.
          task.status = 'todo'
          task.attempts = 0
          return
        }
        recordLesson({
          reason: task.lastProblems[0] || 'unknown problem',
          tool: currentRun.toolName || '',
          stage: 'apply-tasks'
        })
        // A failed task is retried in a later iteration with a fresh attempt
        // budget; only after the retry budget is spent is it skipped.
        if ((task.retries || 0) < maxRetries) {
          task.retries = (task.retries || 0) + 1
          task.attempts = 0
          task.status = 'todo'
        } else {
          task.status = 'skipped'
          if (task.checklistId) {
            const item = ssotModel.findChecklistItem(ssot, task.checklistId)
            if (item && item.status === 'doing') item.status = 'todo'
          }
        }
      })
      Object.assign(stepEntry, {
        status: rejectedByOperator ? 'rejected' : 'failed',
        finishedAt: nowIso(),
        summary: lastProblems[0].message
      })
      if (rejectedByOperator) {
        log('warn', 'Batch ' + batch.id + ' was rejected; nothing was written and the tasks stay open.')
      } else {
        log('error', 'Batch ' + batch.id + ' failed (' + batch.tasks.length + ' task(s)); rolled back ' +
          restored + ' file(s).')
      }
    }

    store.writeSsot(currentRun.id, ssot)
    renderAndSave(store, currentRun, ssot)
    if (typeof context.setStep === 'function') context.setStep({ tasks: batchLog })
    // The operator rejected the plan for this batch: asking for the next one
    // would ignore that decision.
    if (rejectedByOperator) break
  }

  const rejectedCount = batchLog.filter((entry) => entry.status === 'rejected').length
  const summary = 'Implementation pass: ' + doneCount + ' done, ' + failedCount + ' not done, ' +
    batches.length + ' batch(es) of about ' + (Number(applySettings.pointsPerPrompt) || scoring.TARGET_POINTS) +
    ' points.' + (rejectedCount ? ' ' + rejectedCount + ' batch(es) rejected by the operator.' : '') +
    (failureNotes.length ? ' Problems: ' + failureNotes.join(' | ') : '')
  ssotModel.appendLog(ssot, 'apply-tasks', summary)
  store.saveRun(currentRun)
  renderAndSave(store, currentRun, ssot)
  return { summary, ssot, step: { tasks: batchLog } }
}

module.exports = { id: 'apply-tasks', title: 'Apply the tasks', run }
