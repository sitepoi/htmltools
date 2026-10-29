'use strict'

// Stage 3f - close the iteration: propose the next improvements and record the
// iteration summary. The two strongest ideas are promoted to "planned" so the
// next planning round has something concrete to work from.

const { improvePrompt } = require('../ai/prompts')
const { buildCodemap } = require('../code/codemap')
const ssotModel = require('../ssot/model')
const { nowIso } = require('../util')
const { askJson, renderAndSave } = require('./shared')

const CONTRACT = '{ "ideas": [{"title": "", "why": "", "impact": "high|medium|low"}], "nextFocus": "" }'

const IMPACT_ORDER = { high: 0, medium: 1, low: 2 }

async function run(context) {
  const { run: currentRun, ssot, ai, store, log, config, workspace } = context
  const iterationNumber = currentRun.iteration + 1

  const codemap = buildCodemap(workspace, { maxChars: Math.floor((config.limits.maxCodemapChars || 9000) * 0.6) })
  const prompt = improvePrompt({ ssot, iteration: iterationNumber, codemap })
  const answer = await askJson(ai, {
    stage: 'improve-product',
    prompt,
    contract: CONTRACT,
    log,
    model: config.models.planner
  })

  let addedIdeas = 0
  ;(Array.isArray(answer.ideas) ? answer.ideas : []).slice(0, 4).forEach((rawIdea) => {
    const title = String(rawIdea && rawIdea.title || '').trim().slice(0, 180)
    if (!title) return
    if (ssotModel.conflictOf({ title }, ssot.ideas, ['title'])) return
    ssot.ideas.push({
      id: ssotModel.nextId(ssot.ideas, 'I'),
      title,
      why: String(rawIdea.why || '').slice(0, 300),
      impact: ssotModel.IMPACTS.includes(String(rawIdea.impact || '')) ? String(rawIdea.impact) : 'medium',
      status: 'new',
      at: nowIso()
    })
    addedIdeas += 1
  })

  const promotable = ssot.ideas
    .filter((idea) => idea.status === 'new')
    .sort((left, right) => (IMPACT_ORDER[left.impact] || 2) - (IMPACT_ORDER[right.impact] || 2))
    .slice(0, 2)
  promotable.forEach((idea) => { idea.status = 'planned' })

  const iterationTasks = ssot.tasks.filter((task) => task.iteration === iterationNumber)
  const iterationTests = ssot.tests.filter((test) => test.iteration === iterationNumber)
  const tasksDone = iterationTasks.filter((task) => task.status === 'done').length
  const tasksFailed = iterationTasks.filter((task) => task.status === 'blocked').length
  const testsPassed = iterationTests.filter((test) => test.ok).length

  // Token usage for the whole iteration, summed from the step timeline.
  const iterationSteps = ssot.steps.filter((step) => step.iteration === iterationNumber)
  const tokensUsed = iterationSteps.reduce((total, step) => total + (Number(step.tokens) || 0), 0)
  const aiCallsUsed = iterationSteps.reduce((total, step) => total + (step.usage && Number(step.usage.aiCalls) || 0), 0)
  const usabilityFindings = ssot.usability.filter((finding) => finding.iteration === iterationNumber).length
  const usabilityOpen = ssot.usability.filter((finding) => finding.status === 'open').length

  const summary = String(answer.nextFocus || '').slice(0, 300) ||
    ('Iteration ' + iterationNumber + ' closed with ' + tasksDone + ' task(s) done.')

  ssot.iterations.push({
    n: iterationNumber,
    startedAt: currentRun.iterationStartedAt || currentRun.createdAt,
    finishedAt: nowIso(),
    summary,
    tasksDone,
    tasksFailed,
    testsPassed,
    testsFailed: iterationTests.length - testsPassed,
    tokens: tokensUsed,
    aiCalls: aiCallsUsed,
    usabilityFindings,
    usabilityOpen
  })

  currentRun.iteration = iterationNumber
  currentRun.iterationStartedAt = nowIso()

  const iterSummary = 'Iteration ' + iterationNumber + ' closed: ' + tasksDone + ' task(s) done, ' +
    testsPassed + '/' + iterationTests.length + ' checks passing, ' + addedIdeas + ' new idea(s), ' +
    promotable.length + ' promoted, ~' + tokensUsed + ' tokens.'
  ssotModel.appendLog(ssot, 'improve-product', iterSummary)
  store.saveRun(currentRun)
  renderAndSave(store, currentRun, ssot)
  log('info', iterSummary)
  return { summary: iterSummary, ssot }
}

module.exports = { id: 'improve-product', title: 'Improve the application', run }
