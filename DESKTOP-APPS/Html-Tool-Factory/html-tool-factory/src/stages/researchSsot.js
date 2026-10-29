'use strict'

// Stage 2 - the first specification, written by reviewing how the best
// products in the industry solve this problem.

const ssotModel = require('../ssot/model')
const { researchPrompt } = require('../ai/prompts')
const { askJson, renderAndSave } = require('./shared')
const { buildKnowledgeBlock } = require('../knowledge/contextPack')
const { applyProduct, applyDefinition, addFeature, addDecision, addQuestion, addRisk } = require('./ssotWriters')

const CONTRACT = '{ "product": {...}, "features": [...], "decisions": [...], "questions": [...], "risks": [...] }'

async function run(context) {
  const { run: currentRun, ssot, ai, store, log, config } = context
  const knowledge = buildKnowledgeBlock({ config, toolName: currentRun.toolName })
  const prompt = researchPrompt({
    idea: currentRun.idea,
    industryFocus: currentRun.options.industryFocus,
    knowledge
  })

  const answer = await askJson(ai, {
    stage: 'research-ssot',
    prompt,
    contract: CONTRACT,
    log,
    model: config.models.planner
  })

  applyProduct(ssot, answer.product)
  // The definition is written before any task exists: a thin idea becomes a
  // real specification, and every later stage reads it from the digest.
  const definition = applyDefinition(ssot, answer.definition)
  if (definition.summary || definition.jobs.length) {
    ssotModel.appendLog(ssot, 'research-ssot', 'Definition written: ' + definition.jobs.length +
      ' job(s), ' + definition.data.length + ' data item(s), ' + definition.rules.length +
      ' rule(s), ' + definition.outOfScope.length + ' explicit exclusion(s).')
  } else {
    log('warn', 'The model returned no tool definition; the plan will be built from product and features only.')
  }

  const featureCount = (Array.isArray(answer.features) ? answer.features : [])
    .map((feature) => addFeature(ssot, feature))
    .filter(Boolean).length
  const decisionCount = (Array.isArray(answer.decisions) ? answer.decisions : [])
    .map((decision) => addDecision(ssot, decision))
    .filter(Boolean).length
  const questionCount = (Array.isArray(answer.questions) ? answer.questions : [])
    .map((question) => addQuestion(ssot, question))
    .filter(Boolean).length
  const riskCount = (Array.isArray(answer.risks) ? answer.risks : [])
    .map((risk) => addRisk(ssot, risk))
    .filter(Boolean).length

  if (!featureCount) {
    addFeature(ssot, {
      title: 'Core screen',
      description: 'The single screen the product is built around.',
      priority: 'must'
    })
    log('warn', 'The model returned no features, so a single core feature was added to keep the loop moving.')
  }

  // A thin feature list is the classic reason a generated tool is shallow. The
  // jobs from the definition are a reliable source of the real work.
  let derivedFeatures = 0
  if (featureCount < 3) {
    definition.jobs.slice(0, 5).forEach((job) => {
      if (addFeature(ssot, { title: job, description: 'Job the user hires this tool for.', priority: 'must' })) {
        derivedFeatures += 1
      }
    })
    if (derivedFeatures) {
      ssotModel.appendLog(ssot, 'research-ssot', derivedFeatures +
        ' feature(s) derived from the definition jobs because the feature list was thin.')
    }
  }

  const summary = 'Specification drafted: ' + featureCount + ' features, ' + riskCount + ' risks, ' +
    questionCount + ' questions, ' + decisionCount + ' decisions.'
  // The depth bar is seeded here, once, and is never re-opened later: every
  // item becomes a task and the run is not finished until the list is clear.
  const checklist = ssotModel.ensureChecklist(ssot)
  ssotModel.appendLog(ssot, 'research-ssot', summary)
  ssotModel.appendLog(ssot, 'research-ssot', 'Depth checklist seeded: ' + checklist.length +
    ' capability item(s) must be done before the tool counts as finished.')
  store.saveRun(currentRun)
  renderAndSave(store, currentRun, ssot)
  return { summary, ssot }
}

module.exports = { id: 'research-ssot', title: 'Research and write the SSOT', run }
