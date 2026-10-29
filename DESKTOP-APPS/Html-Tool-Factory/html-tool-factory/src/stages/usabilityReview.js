'use strict'

// Stage 3e2 - usability and persona review. Runs after the checks so it judges
// a build that already works. It answers four questions every iteration:
// is it understandable, what is redundant, what can be removed, and where does
// a real persona get stuck.

const { usabilityPrompt } = require('../ai/prompts')
const { buildCodemap, buildUiMap } = require('../code/codemap')
const ssotModel = require('../ssot/model')
const { nowIso } = require('../util')
const { askJson, normalizeIncomingTasks, renderAndSave } = require('./shared')

const CONTRACT = '{ "personas": [], "scenarios": [], "findings": [], "tasks": [], "notes": "" }'
const FINDING_TYPES = ['understandability', 'redundant', 'removable', 'unclear-step']
const SEVERITIES = ['high', 'medium', 'low']

function addPersona(ssot, rawPersona) {
  const name = String(rawPersona && rawPersona.name || '').trim().slice(0, 80)
  if (!name) return null
  if (ssotModel.conflictOf({ name }, ssot.personas, ['name'])) return null
  const persona = {
    id: ssotModel.nextId(ssot.personas, 'P'),
    name,
    role: String(rawPersona.role || '').slice(0, 120),
    goal: String(rawPersona.goal || '').slice(0, 300),
    context: String(rawPersona.context || '').slice(0, 300),
    at: nowIso()
  }
  ssot.personas.push(persona)
  return persona
}

function addScenario(ssot, rawScenario) {
  const goal = String(rawScenario && rawScenario.goal || '').trim().slice(0, 200)
  if (!goal) return null
  const steps = (Array.isArray(rawScenario.steps) ? rawScenario.steps : [])
    .slice(0, 6)
    .map((step) => ({
      step: String(step && step.step || '').slice(0, 200),
      expected: String(step && step.expected || '').slice(0, 200),
      observation: String(step && step.observation || '').slice(0, 300),
      ok: step && step.ok !== false
    }))
    .filter((step) => step.step)
  const scenario = {
    id: ssotModel.nextId(ssot.scenarios, 'S'),
    persona: String(rawScenario.persona || '').slice(0, 80),
    goal,
    steps,
    outcome: String(rawScenario.outcome || '').slice(0, 300),
    blockedSteps: steps.filter((step) => !step.ok).length,
    at: nowIso()
  }
  ssot.scenarios.push(scenario)
  if (ssot.scenarios.length > 30) ssot.scenarios = ssot.scenarios.slice(-30)
  return scenario
}

function addFinding(ssot, rawFinding) {
  const observation = String(rawFinding && rawFinding.observation || '').trim().slice(0, 400)
  if (!observation) return null
  if (ssotModel.conflictOf({ observation }, ssot.usability, ['observation'])) return null
  const finding = {
    id: ssotModel.nextId(ssot.usability, 'U'),
    type: FINDING_TYPES.includes(String(rawFinding.type || '')) ? String(rawFinding.type) : 'understandability',
    severity: SEVERITIES.includes(String(rawFinding.severity || '')) ? String(rawFinding.severity) : 'medium',
    where: String(rawFinding.where || '').slice(0, 200),
    observation,
    suggestion: String(rawFinding.suggestion || '').slice(0, 400),
    status: 'open',
    iteration: Number(rawFinding.iteration) || 0,
    at: nowIso()
  }
  ssot.usability.push(finding)
  if (ssot.usability.length > 120) ssot.usability = ssot.usability.slice(-120)
  return finding
}

async function run(context) {
  const { run: currentRun, ssot, ai, store, log, config, workspace } = context
  const iteration = currentRun.iteration + 1

  const uiMap = buildUiMap(workspace, { maxChars: 4000 })
  const codemap = buildCodemap(workspace, { maxChars: Math.floor((config.limits.maxCodemapChars || 9000) * 0.5) })
  const prompt = usabilityPrompt({
    ssot,
    uiMap,
    codemap,
    iteration,
    toolName: currentRun.toolName || 'TheTool'
  })

  const answer = await askJson(ai, {
    stage: 'usability-review',
    prompt,
    contract: CONTRACT,
    log,
    model: config.models.planner
  })

  const personas = (Array.isArray(answer.personas) ? answer.personas : [])
    .slice(0, 2)
    .map((persona) => addPersona(ssot, persona))
    .filter(Boolean)

  const scenarios = (Array.isArray(answer.scenarios) ? answer.scenarios : [])
    .slice(0, 3)
    .map((scenario) => addScenario(ssot, scenario))
    .filter(Boolean)

  const findings = (Array.isArray(answer.findings) ? answer.findings : [])
    .slice(0, 6)
    .map((finding) => addFinding(ssot, Object.assign({ iteration }, finding)))
    .filter(Boolean)

  const taskResult = normalizeIncomingTasks(ssot, answer.tasks, 'usability-review', { toolName: currentRun.toolName })

  // Deterministic safety net: a high severity finding must become work even if
  // the model forgot to write the task for it.
  if (!taskResult.created.length) {
    const severe = findings.filter((finding) => finding.severity === 'high').slice(0, 2)
    if (severe.length) {
      const fallback = severe.map((finding) => ({
        title: 'Fix the usability finding: ' + finding.observation.slice(0, 90),
        kind: 'code',
        files: [],
        acceptance: [finding.suggestion
          ? 'Applied: ' + finding.suggestion.slice(0, 120)
          : 'The reported friction is gone and every check still passes']
      }))
      const created = normalizeIncomingTasks(ssot, fallback, 'usability-review-fallback', { toolName: currentRun.toolName })
      created.created.forEach((task) => {
        task.usabilityFindingId = severe[created.created.indexOf(task)] && severe[created.created.indexOf(task)].id
      })
      taskResult.created.push(...created.created)
    }
  }

  const blocked = scenarios.reduce((total, scenario) => total + scenario.blockedSteps, 0)
  const summary = 'Usability review: ' + personas.length + ' persona(s), ' + scenarios.length +
    ' scenario(s) with ' + blocked + ' unclear step(s), ' + findings.length + ' finding(s), ' +
    taskResult.created.length + ' task(s).'

  ssotModel.appendLog(ssot, 'usability-review', summary)
  findings.forEach((finding) => {
    ssotModel.appendLog(ssot, 'usability-review', '[' + finding.severity + '/' + finding.type + '] ' +
      finding.observation.slice(0, 160))
  })

  store.saveRun(currentRun)
  renderAndSave(store, currentRun, ssot)
  return { summary, ssot }
}

module.exports = { id: 'usability-review', title: 'Usability and persona review', run, addFinding, addPersona, addScenario }
