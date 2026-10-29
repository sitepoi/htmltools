'use strict'

// Stage 3b - review the specification as a sceptic: what breaks, what is
// unsafe, what is still unknown.

const { riskReviewPrompt } = require('../ai/prompts')
const { buildCodemap } = require('../code/codemap')
const ssotModel = require('../ssot/model')
const { askJson, renderAndSave } = require('./shared')
const { addQuestion, addRisk } = require('./ssotWriters')

const CONTRACT = '{ "risks": [{"severity": "", "text": "", "mitigation": ""}], "questions": [{"text": "", "assumption": "", "recommendedAnswer": ""}], "notes": "" }'

async function run(context) {
  const { run: currentRun, ssot, ai, store, log, config, workspace } = context

  const codemap = buildCodemap(workspace, { maxChars: Math.floor((config.limits.maxCodemapChars || 9000) * 0.7) })
  const prompt = riskReviewPrompt({ ssot, codemap })

  const answer = await askJson(ai, {
    stage: 'risk-review',
    prompt,
    contract: CONTRACT,
    log,
    model: config.models.planner
  })

  const addedRisks = (Array.isArray(answer.risks) ? answer.risks : [])
    .slice(0, 6)
    .map((risk) => addRisk(ssot, risk))
    .filter(Boolean)

  const addedQuestions = (Array.isArray(answer.questions) ? answer.questions : [])
    .slice(0, 5)
    .map((question) => {
      const created = addQuestion(ssot, {
        text: question.text,
        assumption: question.assumption || question.recommendedAnswer || ''
      })
      if (created && question.recommendedAnswer && !created.assumption) {
        created.assumption = String(question.recommendedAnswer).slice(0, 400)
      }
      return created
    })
    .filter(Boolean)

  const summary = 'Review complete: ' + addedRisks.length + ' new risk(s), ' + addedQuestions.length + ' new question(s).'
  ssotModel.appendLog(ssot, 'risk-review', summary)
  store.saveRun(currentRun)
  renderAndSave(store, currentRun, ssot)
  return { summary, ssot }
}

module.exports = { id: 'risk-review', title: 'Review and define risks', run }
