'use strict'

// Stage 3a - turn the specification into the next batch of tasks.
// Two things keep the output deep instead of shallow:
//   1. the model sees the repository rules, the publish checklist and the
//      lessons of earlier runs, so it plans like someone who knows this repo;
//   2. every open item of the depth checklist becomes a planned task, so the
//      loop cannot drift into cosmetic work while core capabilities are missing.

const { planTasksPrompt } = require('../ai/prompts')
const { buildCodemap } = require('../code/codemap')
const { buildKnowledgeBlock } = require('../knowledge/contextPack')
const ssotModel = require('../ssot/model')
const scoring = require('../ssot/scoring')
const { nowIso } = require('../util')
const { askJson, normalizeIncomingTasks, renderAndSave, sanitizeOpenTaskFiles, summarizeTaskList } = require('./shared')

const CONTRACT = '{ "tasks": [ { "title": "", "kind": "", "files": [], "acceptance": [], "featureId": null } ], "notes": "" }'

// Deterministic: a checklist item that has no task yet becomes one, so the
// capability is always owned by something that can be executed and verified.
function tasksForOpenChecklist(ssot, toolName, limit) {
  const open = ssotModel.openChecklist(ssot)
  const planned = new Set(ssot.tasks.map((task) => task.checklistId).filter(Boolean))
  const plannedTitles = new Set(ssot.tasks.map((task) => String(task.title || '').toLowerCase()))
  return open
    .filter((item) => !planned.has(item.id))
    .filter((item) => !plannedTitles.has(String(item.title || '').toLowerCase()))
    .slice(0, Math.max(0, limit))
    .map((item) => ({
      title: item.title,
      kind: 'code',
      files: toolName ? ['app/' + toolName + '.js', 'app/' + toolName + '.html'] : [],
      acceptance: [item.accept, 'Every existing check still passes'],
      checklistId: item.id
    }))
}

async function run(context) {
  const { run: currentRun, ssot, ai, store, log, config, workspace } = context
  const iteration = currentRun.iteration + 1
  const toolName = currentRun.toolName || 'TheTool'
  const maxTasks = Math.min(
    Number(currentRun.options.maxTasksPerIteration) || Number(config.limits.maxTasksPerIteration) || 5,
    Number(config.limits.maxTasksPerIteration) || 5
  )

  const codemap = buildCodemap(workspace, { maxChars: config.limits.maxCodemapChars })
  const failingChecks = ssotModel.failedTests(ssot, 3)
  // Older runs were planned before the depth checklist and the contract existed:
  // seed the checklist and remap their files so they can be continued.
  ssotModel.ensureChecklist(ssot)
  const remappedOld = sanitizeOpenTaskFiles(ssot, toolName)
  if (remappedOld) {
    ssotModel.appendLog(ssot, 'plan-tasks',
      'Remapped ' + remappedOld + ' file path(s) of already planned tasks onto the html tool files.')
  }
  const openChecklist = ssotModel.openChecklist(ssot)

  const prompt = planTasksPrompt({
    ssot,
    iteration,
    codemap,
    failingChecks,
    maxTasks,
    toolName,
    toolPrefix: currentRun.toolPrefix || 'tl-',
    knowledge: buildKnowledgeBlock({ config, toolName }),
    openChecklist
  })

  const answer = await askJson(ai, {
    stage: 'plan-tasks',
    prompt,
    contract: CONTRACT,
    log,
    model: config.models.planner
  })

  const checklistSlots = Math.min(openChecklist.length, Math.max(1, Math.floor(maxTasks / 2)))
  const checklistTasks = tasksForOpenChecklist(ssot, toolName, checklistSlots)
  const aiSlots = Math.max(1, maxTasks - checklistTasks.length)
  const aiTasks = (Array.isArray(answer.tasks) ? answer.tasks : []).slice(0, aiSlots)

  const result = normalizeIncomingTasks(ssot, aiTasks, 'plan-tasks', { toolName })
  if (result.remapped.length) {
    ssotModel.appendLog(ssot, 'plan-tasks',
      'Mapped ' + result.remapped.length + ' planned path(s) onto the html tool files: ' +
      result.remapped.slice(0, 4).join('; '))
  }

  // Half of every batch is reserved for the missing capabilities, so the loop
  // cannot spend all its slots on polish while the checklist stays empty.
  if (checklistTasks.length) {
    const created = normalizeIncomingTasks(ssot, checklistTasks, 'depth-checklist', { toolName })
    created.created.forEach((task, index) => {
      const source = checklistTasks[index]
      if (source && source.checklistId) {
        task.checklistId = source.checklistId
        const item = ssotModel.findChecklistItem(ssot, source.checklistId)
        if (item) {
          item.taskId = task.id
          item.status = 'doing'
        }
      }
    })
    result.created.push(...created.created)
  }

  ssot.tasks.forEach((task) => {
    if (task.status === 'todo' && !task.iteration) task.iteration = iteration
  })

  if (!result.created.length) {
    // Never leave the loop without work: create a deterministic fallback task
    // that makes the next step observable.
    const fallback = normalizeIncomingTasks(ssot, [{
      title: 'Review the current tool and fix the weakest part (iteration ' + iteration + ')',
      kind: 'code',
      files: toolName ? ['app/' + toolName + '.js'] : [],
      acceptance: ['A concrete improvement is written and every check still passes']
    }], 'plan-tasks-fallback', { toolName })
    result.created.push(...fallback.created)
    log('warn', 'The planner returned no new tasks; a review task was added instead.')
  }

  const progress = ssotModel.checklistProgress(ssot)
  // T-06: the same batching the apply stage will use, computed now and written
  // into the SSOT, so the operator sees the shape of the iteration up front.
  const applySettings = config.apply || {}
  scoring.applyPoints(ssot)
  const previewQueue = ssotModel.todoTasks(ssot).slice(0, maxTasks)
  const previewBatches = scoring.buildBatches(previewQueue, {
    targetPoints: applySettings.pointsPerPrompt,
    maxBatchPoints: applySettings.maxBatchPoints,
    maxTasksPerBatch: applySettings.maxTasksPerBatch
  })
  ssot.plan = {
    iteration,
    createdAt: nowIso(),
    targets: {
      pointsPerPrompt: Number(applySettings.pointsPerPrompt) || scoring.TARGET_POINTS,
      maxBatchPoints: Number(applySettings.maxBatchPoints) || scoring.MAX_BATCH_POINTS,
      maxTasksPerBatch: Number(applySettings.maxTasksPerBatch) || scoring.MAX_BATCH_TASKS
    },
    openTasks: previewQueue.length,
    openPoints: previewQueue.reduce((total, task) => total + (Number(task.points) || 0), 0),
    batches: previewBatches.map((batch) => ({
      id: batch.id,
      points: batch.points,
      tasks: batch.tasks.map((task) => ({ id: task.id, title: task.title, points: task.points }))
    }))
  }
  ssotModel.appendLog(ssot, 'plan-tasks',
    'Planned into ' + previewBatches.length + ' batch(es): ' +
    previewBatches.map((batch) => batch.id + ' ' + batch.points + 'pt [' + batch.label + ']').join('; '))

  const summary = 'Iteration ' + iteration + ': ' + result.created.length + ' task(s) planned, depth ' +
    progress.done + '/' + progress.total + ' - ' + summarizeTaskList(result.created, 4)
  ssotModel.appendLog(ssot, 'plan-tasks', summary)
  if (result.skipped.length) {
    ssotModel.appendLog(ssot, 'plan-tasks', 'Skipped duplicates: ' + result.skipped.join('; '))
  }
  store.saveRun(currentRun)
  renderAndSave(store, currentRun, ssot)
  return { summary, ssot }
}

module.exports = { id: 'plan-tasks', title: 'Plan the task list', run, tasksForOpenChecklist }
