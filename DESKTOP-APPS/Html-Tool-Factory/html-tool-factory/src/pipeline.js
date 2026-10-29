'use strict'

// The stage machine. One stage is one unit of work; the loop repeats the
// second half of the sequence until the iteration budget is spent, the run is
// paused/stopped, or a hard error happens.

const { createAiClient, BudgetExceededError } = require('./ai/client')
const path = require('path')
const { Workspace } = require('./code/workspace')
const ssotModel = require('./ssot/model')
const { recordDevelopment } = require('./idea/writeBack')
const { renderAndSave } = require('./stages/shared')
const { nowIso } = require('./util')

const STAGES = [
  require('./stages/selectIdea'),
  require('./stages/researchSsot'),
  require('./stages/planTasks'),
  require('./stages/riskReview'),
  require('./stages/resolveRisks'),
  require('./stages/applyTasks'),
  require('./stages/runTests'),
  require('./stages/usabilityReview'),
  require('./stages/improveProduct')
]

const STAGE_BY_ID = new Map(STAGES.map((stage) => [stage.id, stage]))
const STAGE_SEQUENCE = STAGES.map((stage) => stage.id)

// Tokens the provider itself reported for this stage, 0 when it reported none.
function tokenDelta(counters, before) {
  const prompt = (Number(counters.apiPromptTokens) || 0) - (Number(before.apiPromptTokens) || 0)
  const completion = (Number(counters.apiCompletionTokens) || 0) - (Number(before.apiCompletionTokens) || 0)
  return Math.max(0, prompt + completion)
}

function nextStageId(currentStageId, run, config) {
  const currentIndex = STAGE_SEQUENCE.indexOf(currentStageId)
  if (currentIndex === -1) return 'select-idea'
  if (currentStageId === 'improve-product') {
    // The run budget is the default from the config, but a run may be extended
    // by the Continue action, so the larger of the two wins.
    const fromRun = Number(run.options && run.options.maxIterations) || 0
    const fromConfig = Number(config.limits.maxIterations) || 3
    const allowed = Math.max(1, Math.min(50, Math.max(fromRun, fromConfig)))
    if (run.iteration >= allowed) return null
    return 'plan-tasks'
  }
  return STAGE_SEQUENCE[currentIndex + 1] || null
}

function createPipeline(dependencies) {
  const store = dependencies.store
  const config = dependencies.config
  const hub = dependencies.hub
  const activeRuns = new Map()

  function logFor(run, stageId) {
    return function logEvent(type, message, extra) {
      return hub.publish(run.directory, Object.assign({
        runId: run.id,
        stage: stageId || run.stage,
        type,
        message
      }, extra || {}))
    }
  }

  function buildContext(run, logEvent) {    const ssot = ssotModel.normalizeSsot(store.readSsot(run.id), run.idea)
    return {
      run,
      ssot,
      store,
      config,
      log: logEvent,
      workspace: new Workspace(run.toolDirectory),
      ai: createAiClient({ config, run, logEvent })
    }
  }

  // Writes the finished idea back into the idea catalog JSON so the catalog
  // stays the living record of what is being developed.
  function recordRunInCatalog(run, ssot, logEvent) {
    if (!config.catalog || config.catalog.writeBack === false) return
    const catalogPath = run.catalogPath || config.ideasCatalogPath
    if (!catalogPath) return
    const result = recordDevelopment({
      catalogPath,
      ideaId: run.idea && run.idea.id,
      ideaName: run.idea && run.idea.name,
      status: 'built',
      toolFolder: run.toolDirectory,
      runId: run.id,
      iterations: run.iteration,
      tasksDone: (ssot.tasks || []).filter((task) => task.status === 'done').length,
      checksPassed: (run.counters && run.counters.testsPassed) || 0,
      backupDirectory: path.join(run.directory, '.backup')
    })
    if (result.ok) {
      logEvent('info', 'Idea catalog updated: ' + result.entry.name + ' marked as built')
    } else {
      logEvent('warn', 'The idea catalog was not updated: ' + result.reason)
    }
  }

  // While a stage runs, the operator may stop, restart or continue the run.
  // In that case the record on disk is newer and must win: the finished stage
  // may keep its counters, but it must not resurrect the old stage pointer and
  // it must not write into a folder that was just deleted.
  function isSuperseded(run, stageId) {
    const latest = store.loadRun(run.id)
    if (!latest) return true
    if (latest.status !== 'running') return true
    return latest.stage !== stageId
  }

  function mergeCountersOnly(run) {
    const latest = store.loadRun(run.id)
    if (!latest) return
    latest.counters = run.counters
    latest.lastSummary = run.lastSummary || latest.lastSummary
    store.saveRun(latest)
  }

  async function advanceOnce(runId, options) {
    const settings = options || {}
    const run = store.loadRun(runId)
    if (!run) throw new Error('Run not found: ' + runId)

    if (run.status === 'done' || run.status === 'stopped') {
      return { run, skipped: true, reason: 'The run is already ' + run.status + '.' }
    }
    // The stage sequence is finished but the run was paused with open work: it
    // cannot advance until the operator raises the iteration budget.
    if (run.stage === 'done') {
      return { run, skipped: true, reason: 'The stage sequence is finished: ' + (run.stoppedReason || '') }
    }
    if (!STAGE_BY_ID.has(run.stage)) {
      run.stage = 'select-idea'
      store.saveRun(run)
    }

    const lock = store.acquireLock(run.id)
    if (!lock.ok) {
      const message = 'This run is already being processed by another process (pid ' +
        (lock.holder && lock.holder.pid) + ').'
      run.status = 'error'
      run.lastError = { at: nowIso(), stage: run.stage, message, code: 'LOCKED' }
      run.stoppedReason = 'Locked by another process'
      store.saveRun(run)
      return { run, error: new Error(message) }
    }

    const stageId = run.stage
    const logEvent = logFor(run, stageId)
    const stageStartedAt = Date.now()
    const usageBefore = {
      aiCalls: run.counters.aiCalls,
      inputChars: run.counters.inputChars,
      outputChars: run.counters.outputChars,
      apiPromptTokens: Number(run.counters.apiPromptTokens) || 0,
      apiCompletionTokens: Number(run.counters.apiCompletionTokens) || 0
    }
    let context = null
    let stepEntry = null
    let stageResult = null
    let stageError = null

    try {
      hub.publish(run.directory, {
        runId: run.id,
        stage: stageId,
        type: 'stage-start',
        message: (STAGE_BY_ID.get(stageId) || {}).title || stageId
      })

      context = buildContext(run, logEvent)
      if (stageId === 'plan-tasks' && !run.iterationStartedAt) {
        run.iterationStartedAt = nowIso()
      }
      if (stageId === 'plan-tasks') {
        // Baseline for the no progress guard: an iteration that closes with no
        // task done and no depth item closed is a stall, not work.
        const baselineProgress = ssotModel.checklistProgress(context.ssot)
        run.iterationBaseline = {
          tasksDone: (context.ssot.tasks || []).filter((task) => task.status === 'done').length,
          depthDone: baselineProgress.done
        }
      }

      // A step is written before the work starts so the timeline shows what is
      // running, then completed with the real numbers.
      stepEntry = ssotModel.appendStep(context.ssot, {
        iteration: run.iteration + 1,
        stage: stageId,
        title: (STAGE_BY_ID.get(stageId) || {}).title || stageId,
        status: 'running',
        startedAt: nowIso()
      })
      store.writeSsot(run.id, context.ssot)

      // Stages may report progress on the running step (for example which task
      // batch is being coded right now), so the timeline stays live.
      context.setStep = function (patch) {
        if (!stepEntry || !patch) return
        Object.assign(stepEntry, patch)
      }

      // What the operator sees in the "now" strip: the stage, and once a stage
      // narrows down to one batch or one task, exactly which one.
      run.now = {
        stage: stageId,
        title: (STAGE_BY_ID.get(stageId) || {}).title || stageId,
        detail: '',
        taskIds: [],
        batchId: '',
        startedAt: nowIso()
      }
      context.setNow = function (patch) {
        if (!patch) return
        run.now = Object.assign({}, run.now || {}, patch, { updatedAt: nowIso() })
        try {
          store.saveRun(run)
        } catch (_saveError) {
          // A progress write must never fail a stage.
        }
        hub.publish(run.directory, {
          runId: run.id,
          stage: run.now.stage || stageId,
          type: 'now',
          message: run.now.detail || run.now.title || '',
          now: run.now
        })
      }

      stageResult = await STAGE_BY_ID.get(stageId).run(context)
      run.now = null

      // A stage may attach structured detail to its own step entry.
      if (stageResult && stageResult.step && stepEntry) {
        Object.assign(stepEntry, stageResult.step)
      }

      const following = nextStageId(stageId, run, config)
      run.lastSummary = stageResult.summary || ''
      run.updatedAt = nowIso()

      const usage = {
        aiCalls: run.counters.aiCalls - usageBefore.aiCalls,
        inputChars: run.counters.inputChars - usageBefore.inputChars,
        outputChars: run.counters.outputChars - usageBefore.outputChars,
        apiTokens: tokenDelta(run.counters, usageBefore)
      }
      Object.assign(stepEntry, {
        status: 'done',
        ok: true,
        finishedAt: nowIso(),
        ms: Date.now() - stageStartedAt,
        summary: String(stageResult.summary || '').slice(0, 400),
        usage,
        tokensMeasured: usage.apiTokens > 0,
        // A reported token count beats the characters divided by four.
        tokens: usage.apiTokens > 0 ? usage.apiTokens : Math.ceil((usage.inputChars + usage.outputChars) / 4)
      })

      // The iteration totals are written by improve-product before its own step
      // is finished, so recompute them from the completed steps.
      if (stageId === 'improve-product') {
        const iterationNumber = run.iteration
        const iterationSteps = context.ssot.steps.filter((step) => step.iteration === iterationNumber)
        const totals = iterationSteps.reduce((accumulator, step) => {
          accumulator.tokens += Number(step.tokens) || 0
          accumulator.aiCalls += (step.usage && Number(step.usage.aiCalls)) || 0
          return accumulator
        }, { tokens: 0, aiCalls: 0 })
        const lastIteration = context.ssot.iterations[context.ssot.iterations.length - 1]
        if (lastIteration && lastIteration.n === iterationNumber) {
          lastIteration.tokens = totals.tokens
          lastIteration.aiCalls = totals.aiCalls
        }
      }

      if (following) {
        run.stage = following
        run.status = settings.singleStep ? 'idle' : 'running'
      } else {
        const finishedSsot = stageResult.ssot || context.ssot
        const openTasks = ssotModel.todoTasks(finishedSsot).length
        const depth = ssotModel.checklistProgress(finishedSsot)
        const baseline = run.iterationBaseline || null
        const tasksDoneNow = (finishedSsot.tasks || []).filter((task) => task.status === 'done').length
        const stalled = Boolean(baseline) && tasksDoneNow <= Number(baseline.tasksDone || 0) &&
          depth.done <= Number(baseline.depthDone || 0) && (openTasks > 0 || depth.open > 0)
        run.stage = 'done'
        // A run is only DONE when nothing is left. Otherwise it stops as paused
        // and says exactly what is still missing, so a half built tool never
        // looks finished in the dashboard or in the idea catalog.
        if (stalled) {
          // The model is looping without landing anything: stop instead of
          // repeating the same failing calls until the budget is gone.
          run.status = 'error'
          run.stoppedReason = 'No progress in iteration ' + run.iteration +
            ': 0 task(s) done and 0 depth item(s) closed. The last failures are recorded in the log and as lessons.'
          run.lastError = { at: nowIso(), stage: 'improve-product', message: run.stoppedReason, code: 'NO_PROGRESS' }
          logEvent('error', run.stoppedReason)
        } else if (openTasks > 0 || depth.open > 0) {
          run.status = 'paused'
          run.stoppedReason = 'Stopped after ' + run.iteration + ' iteration(s) with ' + openTasks +
            ' task(s) and ' + depth.open + ' depth item(s) still open. Raise limits.maxIterations ' +
            '(or limits.maxTasksPerIteration) in config.local.json and press Start to continue.'
          logEvent('warn', run.stoppedReason)
        } else {
          run.status = 'done'
          run.stoppedReason = 'Finished: every task and every depth item is done after ' +
            run.iteration + ' iteration(s).'
          recordRunInCatalog(run, finishedSsot, logEvent)
        }
        run.summary = {
          tasksDone: (finishedSsot.tasks || []).filter((task) => task.status === 'done').length,
          tasksTotal: (finishedSsot.tasks || []).length,
          tasksOpen: openTasks,
          depthDone: depth.done,
          depthTotal: depth.total
        }
      }
      if (isSuperseded(run, stageId)) {
        mergeCountersOnly(run)
        hub.publish(run.directory, {
          runId: run.id,
          stage: stageId,
          type: 'log',
          message: 'Stage result ignored: the run was stopped, restarted or continued by the operator.'
        })
        return { run, stageResult, error: null, superseded: true }
      }

      store.saveRun(run)
      renderAndSave(store, run, stageResult.ssot || context.ssot, { runStatus: run.status })

      hub.publish(run.directory, {
        runId: run.id,
        stage: stageId,
        type: 'stage-complete',
        message: stageResult.summary || ''
      })
    } catch (error) {      stageError = error
      run.now = null
      const usageError = {
        aiCalls: run.counters.aiCalls - usageBefore.aiCalls,
        inputChars: run.counters.inputChars - usageBefore.inputChars,
        outputChars: run.counters.outputChars - usageBefore.outputChars,
        apiTokens: tokenDelta(run.counters, usageBefore)
      }
      if (stepEntry) {
        Object.assign(stepEntry, {
          status: 'failed',
          ok: false,
          finishedAt: nowIso(),
          ms: Date.now() - stageStartedAt,
          summary: String(error && error.message || error).slice(0, 400),
          usage: usageError,
          tokensMeasured: usageError.apiTokens > 0,
          tokens: usageError.apiTokens > 0 ? usageError.apiTokens
            : Math.ceil((usageError.inputChars + usageError.outputChars) / 4)
        })
        try { store.writeSsot(run.id, context.ssot) } catch (_writeError) { /* ignore */ }
      }
      const isBudget = error instanceof BudgetExceededError || (error && error.code === 'BUDGET_EXCEEDED')
      run.status = isBudget ? 'paused' : 'error'
      run.lastError = {
        at: nowIso(),
        stage: run.stage,
        message: String(error && error.message || error).slice(0, 1200),
        code: error && error.code || 'STAGE_FAILED'
      }
      run.stoppedReason = isBudget ? 'Budget exhausted' : 'Stage failed'
      if (isSuperseded(run, stageId)) {
        mergeCountersOnly(run)
        return { run, stageResult, error: stageError, superseded: true }
      }
      store.saveRun(run)
      hub.publish(run.directory, {
        runId: run.id,
        stage: run.stage,
        type: 'stage-error',
        message: run.lastError.message
      })
      if (error && error.stack) {
        hub.publish(run.directory, {
          runId: run.id,
          stage: run.stage,
          type: 'debug',
          message: String(error.stack).split('\n').slice(0, 4).join(' | ')
        })
      }
    } finally {
      store.releaseLock(run.id)
    }

    return { run, stageResult, error: stageError }
  }

  async function startLoop(runId) {
    // Pressing Start right after Stop, Restart or Continue can arrive while a
    // previous loop is still finishing its current stage. Waiting for it and
    // then starting is what the operator expects; returning the old promise
    // silently did nothing at all.
    const inFlight = activeRuns.get(runId)
    if (inFlight) {
      try { await inFlight } catch (_error) { /* the previous loop reported its own error */ }
    }

    const run = store.loadRun(runId)
    if (!run) throw new Error('Run not found: ' + runId)
    // Nothing left to advance: keep the record as it is (done or paused with a
    // reason) instead of flipping it to running and leaving it there.
    if (run.stage === 'done') return run
    run.status = 'running'
    run.lastError = null
    run.stoppedReason = ''
    store.saveRun(run)

    const promise = (async () => {
      let guard = 0
      try {
        while (guard < 400) {
          guard += 1
          const latest = store.loadRun(runId)
          if (!latest) break
          if (latest.status !== 'running') break
          const result = await advanceOnce(runId)
          if (result.error) break
          if (result.skipped) break
        }
      } catch (error) {
        // Never let a loop failure disappear: the dashboard reads this field.
        const current = store.loadRun(runId)
        if (current && current.status === 'running') {
          current.status = 'error'
          current.lastError = {
            at: nowIso(),
            stage: current.stage,
            message: String((error && error.message) || error).slice(0, 1200),
            code: (error && error.code) || 'LOOP_FAILED'
          }
          current.stoppedReason = 'Loop failed'
          store.saveRun(current)
        }
      } finally {
        activeRuns.delete(runId)
      }
      return store.loadRun(runId)
    })()

    activeRuns.set(runId, promise)
    return promise
  }

  // Resolves once no loop is working on this run, so a destructive action can
  // never race with a stage that is still writing files.
  async function waitForIdle(runId) {
    const inFlight = activeRuns.get(runId)
    if (!inFlight) return true
    try { await inFlight } catch (_error) { /* reported on the run */ }
    return !activeRuns.has(runId)
  }

  function isRunning(runId) {
    return activeRuns.has(runId)
  }

  function pauseRun(runId) {
    const run = store.loadRun(runId)
    if (!run) throw new Error('Run not found: ' + runId)
    if (run.status === 'running') {
      run.status = 'paused'
      run.stoppedReason = 'Paused by the operator. The current stage will finish.'
      store.saveRun(run)
    }
    return run
  }

  function stopRun(runId) {
    const run = store.loadRun(runId)
    if (!run) throw new Error('Run not found: ' + runId)
    run.status = 'stopped'
    run.stoppedReason = 'Stopped by the operator.'
    store.saveRun(run)
    return run
  }

  function resumeRun(runId) {
    return startLoop(runId)
  }

  return {
    STAGES,
    STAGE_SEQUENCE,
    advanceOnce,
    startLoop,
    waitForIdle,
    isRunning,
    pauseRun,
    stopRun,
    resumeRun,
    nextStageId
  }
}

module.exports = { createPipeline, STAGE_SEQUENCE, nextStageId }
