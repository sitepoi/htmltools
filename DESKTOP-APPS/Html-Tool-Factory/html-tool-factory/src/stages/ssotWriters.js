'use strict'

// Writers that turn model answers into SSOT entries with stable ids and
// duplicate protection. Shared by the research and review stages.

const ssotModel = require('../ssot/model')
const { nowIso } = require('../util')

function applyProduct(ssot, rawProduct) {
  const product = rawProduct && typeof rawProduct === 'object' ? rawProduct : {}
  const target = ssot.product
  target.name = String(product.name || ssot.idea.name || target.name).slice(0, 120)
  target.tagline = String(product.tagline || '').slice(0, 200)
  target.problem = String(product.problem || '').slice(0, 1200)
  target.solution = String(product.solution || '').slice(0, 1200)
  target.audience = String(product.audience || '').slice(0, 400)
  target.marketNotes = String(product.marketNotes || '').slice(0, 1600)
  target.competitors = (Array.isArray(product.competitors) ? product.competitors : [])
    .slice(0, 6)
    .map((competitor) => ({
      name: String(competitor && competitor.name || '').slice(0, 120),
      strength: String(competitor && competitor.strength || '').slice(0, 300),
      weakness: String(competitor && competitor.weakness || '').slice(0, 300)
    }))
    .filter((competitor) => competitor.name)
  target.differentiators = (Array.isArray(product.differentiators) ? product.differentiators : [])
    .map((line) => String(line || '').slice(0, 240))
    .filter(Boolean)
    .slice(0, 6)
  target.technology = (Array.isArray(product.technology) ? product.technology : [])
    .map((line) => String(line || '').slice(0, 200))
    .filter(Boolean)
    .slice(0, 8)
}

// The written definition of the tool. Written before any task exists so a thin
// idea still becomes a real specification, and every later stage reads it.
function applyDefinition(ssot, rawDefinition) {
  const source = rawDefinition && typeof rawDefinition === 'object' ? rawDefinition : {}
  const list = (value, maxItems) => (Array.isArray(value) ? value : [])
    .map((line) => String(line || '').trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, maxItems)
  const definition = {
    summary: String(source.summary || '').trim().slice(0, 2000),
    jobs: list(source.jobs, 10),
    screens: list(source.screens, 8),
    data: list(source.data, 12),
    rules: list(source.rules, 12),
    outOfScope: list(source.outOfScope, 10),
    success: list(source.success, 8)
  }
  ssot.definition = Object.assign({}, ssot.definition || {}, definition)
  return ssot.definition
}

function addFeature(ssot, rawFeature) {
  const title = String(rawFeature && rawFeature.title || '').trim().slice(0, 160)
  if (!title) return null
  if (ssotModel.conflictOf({ title }, ssot.features, ['title'])) return null
  const priority = ssotModel.PRIORITIES.includes(String(rawFeature.priority || ''))
    ? String(rawFeature.priority)
    : 'should'
  const feature = {
    id: ssotModel.nextId(ssot.features, 'F'),
    title,
    description: String(rawFeature.description || '').slice(0, 400),
    priority,
    status: 'planned'
  }
  ssot.features.push(feature)
  return feature
}

function addDecision(ssot, rawDecision) {
  const text = String(rawDecision && rawDecision.text || '').trim().slice(0, 400)
  if (!text) return null
  if (ssotModel.conflictOf({ text }, ssot.decisions, ['text'])) return null
  const decision = {
    id: ssotModel.nextId(ssot.decisions, 'D'),
    text,
    rationale: String(rawDecision.rationale || '').slice(0, 400),
    at: nowIso()
  }
  ssot.decisions.push(decision)
  return decision
}

function addQuestion(ssot, rawQuestion) {
  const text = String(rawQuestion && rawQuestion.text || '').trim().slice(0, 400)
  if (!text) return null
  if (ssotModel.conflictOf({ text }, ssot.questions, ['text'])) return null
  const question = {
    id: ssotModel.nextId(ssot.questions, 'Q'),
    text,
    assumption: String(rawQuestion.assumption || '').slice(0, 400),
    answer: '',
    status: 'open',
    at: nowIso()
  }
  ssot.questions.push(question)
  return question
}

function addRisk(ssot, rawRisk) {
  const text = String(rawRisk && rawRisk.text || '').trim().slice(0, 400)
  if (!text) return null
  if (ssotModel.conflictOf({ text }, ssot.risks, ['text'])) return null
  const severity = ['high', 'medium', 'low'].includes(String(rawRisk.severity || '').toLowerCase())
    ? String(rawRisk.severity).toLowerCase()
    : 'medium'
  const risk = {
    id: ssotModel.nextId(ssot.risks, 'R'),
    severity,
    text,
    mitigation: String(rawRisk.mitigation || '').slice(0, 400),
    status: 'open',
    at: nowIso()
  }
  ssot.risks.push(risk)
  return risk
}

module.exports = { applyProduct, applyDefinition, addFeature, addDecision, addQuestion, addRisk }
