'use strict'

// Helpers shared by every stage: contract-safe AI calls, task normalisation and
// SSOT rendering.

const fs = require('fs')
const path = require('path')
const { parseJsonLoose } = require('../ai/parse')
const { repairPrompt } = require('../ai/prompts')
const { executeTool, extractToolCalls } = require('../ai/tools')
const model = require('../ssot/model')
const { renderSsotHtml } = require('../ssot/render')
const { ensureStandardDocs, writeStandardSsot } = require('../ssot/standardDocs')
const { REPO_ROOT } = require('../tool/taxonomy')
const { coerceContractPath } = require('../tool/contract')
const scoring = require('../ssot/scoring')
const { nowIso, ensureDir, writeTextAtomic } = require('../util')

const TASK_KINDS = ['code', 'doc', 'test', 'chore']

async function askJson(ai, options) {
  const log = options.log || function noop() {}
  const modelName = options.model || ''
  const first = await ai.chat({
    stage: options.stage,
    system: options.prompt.system,
    user: options.prompt.user,
    model: modelName
  })
  try {
    return parseJsonLoose(first.text, { hint: options.stage })
  } catch (parseError) {
    log('warn', 'The answer for ' + options.stage + ' was not valid JSON; asking for one repair.')
    const repair = repairPrompt({
      problem: parseError.message,
      contract: options.contract,
      rawText: first.text
    })
    const second = await ai.chat({
      stage: options.stage + '-repair',
      system: repair.system,
      user: repair.user,
      model: modelName
    })
    return parseJsonLoose(second.text, { hint: options.stage + ' (repair)' })
  }
}

function sanitizeRelativePath(rawPath) {
  const candidate = String(rawPath || '').replace(/\\/g, '/').trim().replace(/^\.?\//, '')
  if (!candidate) return ''
  if (path.isAbsolute(candidate) || /^[a-zA-Z]:/.test(candidate)) return ''
  if (candidate.split('/').includes('..')) return ''
  if (!/^[A-Za-z0-9._\-/ ]+$/.test(candidate)) return ''
  if (!/\.[A-Za-z0-9]{1,6}$/.test(candidate)) return ''
  return candidate
}

function normalizeIncomingTasks(ssot, rawTasks, stageName, options) {
  const settings = options || {}
  const toolName = String(settings.toolName || '')
  const created = []
  const skipped = []
  const remapped = []
  ;(Array.isArray(rawTasks) ? rawTasks : []).forEach((rawTask) => {
    const title = String(rawTask && rawTask.title || '').trim().slice(0, 180)
    if (!title) return
    if (model.conflictOf({ title }, ssot.tasks, ['title'])) {
      skipped.push(title)
      return
    }
    const rawFiles = (Array.isArray(rawTask.files) ? rawTask.files : []).map(sanitizeRelativePath).filter(Boolean)
    const files = []
    rawFiles.forEach((file) => {
      // A task planned against src/*.tsx can never be executed in a html tool,
      // so the path is mapped onto the real contract file instead of failing.
      const target = toolName ? coerceContractPath(file, toolName) : file
      if (target && !files.includes(target)) files.push(target)
      if (target && target !== file) remapped.push(file + ' -> ' + target)
    })
    const acceptance = (Array.isArray(rawTask.acceptance) ? rawTask.acceptance : [])
      .map((line) => String(line || '').trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, 5)
    const kind = TASK_KINDS.includes(String(rawTask.kind || '').toLowerCase())
      ? String(rawTask.kind).toLowerCase()
      : (files.some((file) => /\.(js|cjs|html|css)$/.test(file)) ? 'code' : 'chore')
    const featureId = String(rawTask.featureId || '')
    const task = {
      id: model.nextId(ssot.tasks, 'T'),
      title,
      kind,
      files: files.slice(0, 4),
      acceptance,
      status: 'todo',
      attempts: 0,
      retries: 0,
      source: stageName,
      createdAt: nowIso(),
      notes: ''
    }
    if (featureId && model.findById(ssot.features, featureId)) task.featureId = featureId
    if (rawTask.checklistId) task.checklistId = String(rawTask.checklistId)
    if (rawTask.iteration) task.iteration = Number(rawTask.iteration)
    // Every task is scored out of 100 so the apply stage can pack small tasks
    // into one prompt worth of work.
    task.points = scoring.normalizePoints(rawTask.points, scoring.estimatePoints(task))
    ssot.tasks.push(task)
    created.push(task)
  })
  return { created, skipped, remapped }
}

// The generated tool keeps its documentation in the repository standard format:
// the seven documents from _docs/templates with the shared _docs/assets files.
// The factory only fills the sections it owns inside docs/ssot.html, so a human
// can keep editing the same file in the usual way.
function renderAndSave(store, run, ssot, extra) {
  const settings = extra || {}
  ssot.updatedAt = nowIso()
  store.writeSsot(run.id, ssot)
  const toolDirectory = run.toolDirectory || path.join(run.directory, 'tool')
  const repoRoot = (run.target && run.target.repoRoot) || REPO_ROOT
  const docsDirectory = path.join(toolDirectory, 'docs')
  const ssotPath = path.join(docsDirectory, 'ssot.html')
  ensureDir(docsDirectory)

  if (!fs.existsSync(ssotPath)) {
    const prepared = ensureStandardDocs({
      repoRoot,
      toolDirectory,
      toolName: run.toolName || (run.idea && run.idea.toolName) || 'Tool',
      displayName: (run.idea && run.idea.name) || run.toolName || 'Tool',
      code: String(run.toolPrefix || 'af').replace(/-/g, '').toUpperCase() || 'AF',
      generator: (settings.config && settings.config.docs && settings.config.docs.generator) || ''
    })
    if (settings.log && prepared.reason) {
      settings.log(prepared.ok ? 'info' : 'warn',
        'Standard docs: ' + (prepared.ok ? 'created from ' + (prepared.generator || 'the templates') : prepared.reason))
    }
  }

  const written = writeStandardSsot({ toolDirectory, ssot, run })
  if (!written.ok) {
    // Last resort: never leave the tool without a readable specification page.
    writeTextAtomic(ssotPath, renderSsotHtml(ssot, {
      generatedAt: nowIso(),
      runStatus: settings.runStatus || run.status
    }))
    return 'fallback'
  }
  return 'standard'
}

// Same contract as askJson, but the model may first ask for read only tool
// results. Every round is bounded and every tool is read only.
async function askJsonWithTools(ai, options) {
  const log = options.log || function noop() {}
  const maxRounds = Math.max(0, Number(options.maxRounds) || 0)
  let userPrompt = options.prompt.user
  let lastAnswer = null
  for (let round = 0; round <= maxRounds; round += 1) {
    const answer = await askJson(ai, {
      stage: round === 0 ? options.stage : options.stage + '-tools',
      prompt: { system: options.prompt.system, user: userPrompt },
      contract: options.contract,
      log,
      model: options.model
    })
    lastAnswer = answer
    const calls = extractToolCalls(answer)
    if (!calls) return answer
    const results = []
    for (const call of calls) {
      const outcome = await executeTool(options.workspace, call, options.toolOptions)
      const target = call.path || call.query || call.dir || call.target || ''
      log('info', 'Tool ' + call.tool + (target ? ' ' + target : '') + (outcome.ok ? '' : ' (failed)'))
      if (Array.isArray(options.toolLog)) {
        options.toolLog.push({ at: nowIso(), tool: call.tool, target: String(target).slice(0, 200), ok: outcome.ok })
        if (options.toolLog.length > 200) options.toolLog.splice(0, options.toolLog.length - 200)
      }
      results.push('### ' + call.tool + ' ' + target + '\n' + outcome.text)
    }
    // Tool output is bounded so a slow round cannot turn the final answer into a
    // prompt that never finishes.
    const joined = results.join('\n\n')
    const capped = joined.length > 24000 ? joined.slice(0, 24000) + '\n... [tool results trimmed]' : joined
    userPrompt = userPrompt + '\n\nTOOL RESULTS (round ' + (round + 1) + '):\n' + capped
    if (round === maxRounds) {
      // The tool budget is spent. Asking again is what produces a valid patch:
      // returning the tool call answer would look like "no operations".
      log('warn', 'The tool budget for this step is spent; asking for the patch directly.')
      return askJson(ai, {
        stage: options.stage + '-final',
        prompt: {
          system: options.prompt.system,
          user: userPrompt + '\n\nTOOL BUDGET IS SPENT. Do not request more tools. ' +
            'Answer now with the final JSON object only (the patch with its ops array).'
        },
        contract: options.contract,
        log,
        model: options.model
      })
    }
    userPrompt = userPrompt + '\n\nNow answer with the patch object. Do not request more tools unless something is still unclear.'
  }
  return lastAnswer
}

function summarizeTaskList(tasks, limit) {
  const maxItems = Number(limit) || 5
  return (Array.isArray(tasks) ? tasks : [])
    .slice(0, maxItems)
    .map((task) => task.id + ' ' + task.title)
    .join('; ')
}

// Tasks planned before the contract existed can still name .ts or .tsx files.
// They are remapped here so an old run can be continued instead of restarted.
function sanitizeOpenTaskFiles(ssot, toolName) {
  let changed = 0
  ;(Array.isArray(ssot.tasks) ? ssot.tasks : []).forEach((task) => {
    if (task.status === 'done' || task.status === 'skipped') return
    const next = []
    ;(Array.isArray(task.files) ? task.files : []).forEach((file) => {
      const target = coerceContractPath(file, toolName)
      if (target && !next.includes(target)) next.push(target)
      if (target && target !== file) changed += 1
    })
    task.files = next
  })
  return changed
}

module.exports = {
  askJson,
  askJsonWithTools,
  sanitizeRelativePath,
  sanitizeOpenTaskFiles,
  normalizeIncomingTasks,
  renderAndSave,
  summarizeTaskList,
  TASK_KINDS
}
