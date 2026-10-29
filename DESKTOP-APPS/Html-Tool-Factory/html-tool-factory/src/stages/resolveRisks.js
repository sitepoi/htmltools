'use strict'

// Stage 3c - answer every open question with the safest sensible default and
// close out the open risks. The loop must never stall on a question.

const { resolveRisksPrompt } = require('../ai/prompts')
const ssotModel = require('../ssot/model')
const { askJson, normalizeIncomingTasks, renderAndSave } = require('./shared')
const { addDecision } = require('./ssotWriters')

const CONTRACT = '{ "answers": [{"questionId": "", "answer": ""}], "decisions": [{"text": "", "rationale": ""}], "riskActions": [{"riskId": "", "status": "", "mitigation": ""}], "tasks": [] }'

function answerQuestion(ssot, questionId, answerText) {
  const question = ssotModel.findById(ssot.questions, questionId)
  if (!question) return false
  const answer = String(answerText || '').trim()
  if (!answer) return false
  question.answer = answer.slice(0, 800)
  question.status = 'answered'
  question.answeredAt = new Date().toISOString()
  return true
}

async function run(context) {
  const { run: currentRun, ssot, ai, store, log, config } = context

  const openQuestions = ssotModel.openQuestions(ssot)
  const openRisks = ssotModel.openRisks(ssot)

  if (!openQuestions.length && !openRisks.length) {
    const summary = 'Nothing to resolve: no open risks or questions.'
    ssotModel.appendLog(ssot, 'resolve-risks', summary)
    renderAndSave(store, currentRun, ssot)
    return { summary, ssot }
  }

  const prompt = resolveRisksPrompt({ ssot })
  const answer = await askJson(ai, {
    stage: 'resolve-risks',
    prompt,
    contract: CONTRACT,
    log,
    model: config.models.planner
  })

  let answeredCount = 0
  ;(Array.isArray(answer.answers) ? answer.answers : []).forEach((entry) => {
    if (answerQuestion(ssot, String(entry && entry.questionId || ''), entry && entry.answer)) answeredCount += 1
  })

  // Anything still open gets its own assumption applied. Automation must never
  // stall; a wrong assumption is visible in the SSOT and can be revisited.
  let assumedCount = 0
  ssot.questions.forEach((question) => {
    if (question.status === 'answered') return
    const fallbackAnswer = question.assumption ||
      'Decided with the safer default: keep the behaviour minimal, deny by default, and revisit when a real requirement appears.'
    question.answer = String(fallbackAnswer).slice(0, 800)
    question.status = 'answered'
    question.answeredBy = 'assumption'
    question.answeredAt = new Date().toISOString()
    assumedCount += 1
  })

  const decisionCount = (Array.isArray(answer.decisions) ? answer.decisions : [])
    .map((decision) => addDecision(ssot, decision))
    .filter(Boolean).length

  let riskActionCount = 0
  ;(Array.isArray(answer.riskActions) ? answer.riskActions : []).forEach((action) => {
    const risk = ssotModel.findById(ssot.risks, String(action && action.riskId || ''))
    if (!risk) return
    const status = ['mitigated', 'accepted'].includes(String(action.status || '')) ? String(action.status) : 'mitigated'
    risk.status = status
    if (action.mitigation) risk.mitigation = String(action.mitigation).slice(0, 400)
    riskActionCount += 1
  })

  const taskResult = normalizeIncomingTasks(ssot, answer.tasks, 'resolve-risks', { toolName: currentRun.toolName })

  const summary = 'Resolved: ' + answeredCount + ' answered, ' + assumedCount + ' closed with a default assumption, ' +
    decisionCount + ' decisions, ' + riskActionCount + ' risk actions, ' + taskResult.created.length + ' tasks added.'
  ssotModel.appendLog(ssot, 'resolve-risks', summary)
  store.saveRun(currentRun)
  renderAndSave(store, currentRun, ssot)
  return { summary, ssot }
}

module.exports = { id: 'resolve-risks', title: 'Solve risks and questions', run }
