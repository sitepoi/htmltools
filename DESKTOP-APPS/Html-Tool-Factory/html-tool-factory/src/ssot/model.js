'use strict'

// The specification is data, not prose. Everything the pipeline needs (and
// everything a human reads in docs/ssot.html) lives in this one JSON shape,
// so a stage can be given exactly the slice it needs instead of a whole
// document. The renderer turns it into the readable SSOT page.

const { nowIso } = require('../util')

const SCHEMA = 'app-factory-ssot/1'
const TASK_STATUSES = ['todo', 'doing', 'done', 'blocked', 'skipped']
const RISK_STATUSES = ['open', 'mitigated', 'accepted']
const PRIORITIES = ['must', 'should', 'could']
const IMPACTS = ['high', 'medium', 'low']
const CHECKLIST_STATUSES = ['todo', 'doing', 'done', 'na']

// The depth bar. A generated tool is only considered finished when every item
// is done or explicitly marked not applicable, so a run cannot stop after six
// small tasks and call a half built screen finished.
const CHECKLIST_ITEMS = [
  {
    title: 'Input validation with inline errors',
    detail: 'Every input is validated on submit; the message sits next to the field and the status line names the field. No alert().',
    accept: 'An empty or invalid submit shows an inline message and keeps the entered text'
  },
  {
    title: 'Empty state that tells the user the first step',
    detail: 'The main area explains what to do before any data exists, instead of showing a blank list.',
    accept: 'With no data the main area shows a short instruction and no empty table rows'
  },
  {
    title: 'Busy state while work runs',
    detail: 'While an AI call is pending the primary button is disabled and the status line says what is happening.',
    accept: 'During a pending request the primary button is disabled and the status line is not Ready'
  },
  {
    title: 'Failure state with a retry path',
    detail: 'A rejected requestAI promise is caught, explained in plain language and the user can try again.',
    accept: 'A rejected request shows an error message, re-enables the button and keeps the input'
  },
  {
    title: 'Persistence through the tool storage SDK',
    detail: 'The working data is saved and restored through the platform SDK, never through localStorage.',
    accept: 'Reloading the host page restores the last saved records'
  },
  {
    title: 'Export or copy of the result',
    detail: 'The user can take the result out of the tool, as text, markdown or the clipboard.',
    accept: 'A visible control copies or downloads the current result'
  },
  {
    title: 'Destructive actions are reversible or guarded',
    detail: 'Clear, delete and replace ask for confirmation in place, or offer undo.',
    accept: 'Clearing a record needs two deliberate actions and never wipes silently'
  },
  {
    title: 'Keyboard and screen reader basics',
    detail: 'Every input has a label, the status line has role=status and the tab order follows the visual order.',
    accept: 'Every input has a label and the status line is announced by role=status'
  },
  {
    title: 'Responsive layout and print stylesheet',
    detail: 'The layout works down to 360px wide and a print stylesheet removes the controls.',
    accept: 'At 360px there is no horizontal scroll and printing hides the buttons'
  },
  {
    title: 'In tool self test in the harness',
    detail: 'app/test-harness.html runs named checks that print PASS or FAIL, driving the real tool through the mock SDK.',
    accept: 'The harness prints at least three named checks with a pass and fail count'
  }
]

function createSsot(idea) {
  const createdAt = nowIso()
  return {
    schema: SCHEMA,
    version: '0.1.0',
    createdAt,
    updatedAt: createdAt,
    idea: {
      id: String(idea && idea.id || ''),
      name: String(idea && idea.name || 'Untitled Application'),
      purpose: String(idea && idea.purpose || ''),
      category: String(idea && idea.category || ''),
      source: String(idea && idea.source || '')
    },
    product: {
      name: String(idea && idea.name || ''),
      tagline: '',
      problem: '',
      solution: '',
      audience: '',
      marketNotes: '',
      competitors: [],
      differentiators: [],
      technology: []
    },
    // The written definition of the tool: what it is and what it is not. It is
    // produced before any task exists, because a thin idea needs a real spec.
    definition: {
      summary: '',
      jobs: [],
      screens: [],
      data: [],
      rules: [],
      outOfScope: [],
      success: []
    },
    decisions: [],
    questions: [],
    features: [],
    risks: [],
    tasks: [],
    personas: [],
    scenarios: [],
    usability: [],
    checklist: [],
    steps: [],
    tests: [],
    iterations: [],
    ideas: [],
    log: []
  }
}

function normalizeList(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []
}

function normalizeSsot(rawValue, fallbackIdea) {
  const base = createSsot(fallbackIdea || {})
  if (!rawValue || typeof rawValue !== 'object') return base
  const ssot = Object.assign({}, base, rawValue)
  ssot.schema = SCHEMA
  ssot.idea = Object.assign({}, base.idea, rawValue.idea || {})
  ssot.product = Object.assign({}, base.product, rawValue.product || {})
  ssot.product.competitors = normalizeList(ssot.product.competitors)
  ssot.product.differentiators = Array.isArray(ssot.product.differentiators)
    ? ssot.product.differentiators.map(String)
    : []
  ssot.product.technology = Array.isArray(ssot.product.technology) ? ssot.product.technology.map(String) : []
  ssot.definition = Object.assign({ summary: '', jobs: [], screens: [], data: [], rules: [], outOfScope: [], success: [] },
    rawValue.definition || {})
  ;['jobs', 'screens', 'data', 'rules', 'outOfScope', 'success'].forEach((key) => {
    ssot.definition[key] = Array.isArray(ssot.definition[key]) ? ssot.definition[key].map(String).filter(Boolean) : []
  })
  ssot.definition.summary = String(ssot.definition.summary || '')
  ssot.decisions = normalizeList(rawValue.decisions)
  ssot.questions = normalizeList(rawValue.questions)
  ssot.features = normalizeList(rawValue.features)
  ssot.risks = normalizeList(rawValue.risks)
  ssot.tasks = normalizeList(rawValue.tasks).map((task) => {
    const normalized = Object.assign({}, task)
    if (!TASK_STATUSES.includes(normalized.status)) normalized.status = 'todo'
    if (!Array.isArray(normalized.files)) normalized.files = []
    if (!Array.isArray(normalized.acceptance)) normalized.acceptance = []
    normalized.attempts = Number(normalized.attempts) || 0
    return normalized
  })
  ssot.tests = normalizeList(rawValue.tests)
  ssot.iterations = normalizeList(rawValue.iterations)
  ssot.personas = normalizeList(rawValue.personas)
  ssot.scenarios = normalizeList(rawValue.scenarios)
  ssot.usability = normalizeList(rawValue.usability)
  ssot.checklist = normalizeList(rawValue.checklist).map((item) => {
    const normalized = Object.assign({}, item)
    if (!CHECKLIST_STATUSES.includes(normalized.status)) normalized.status = 'todo'
    return normalized
  })
  ssot.steps = normalizeList(rawValue.steps)
  ssot.ideas = normalizeList(rawValue.ideas).map((idea) => {
    if (!IMPACTS.includes(idea.impact)) idea.impact = 'medium'
    if (!['new', 'planned', 'done', 'rejected'].includes(idea.status)) idea.status = 'new'
    return idea
  })
  ssot.log = normalizeList(rawValue.log)
  ssot.updatedAt = rawValue.updatedAt || nowIso()
  return ssot
}

function nextId(list, prefix) {
  const pattern = new RegExp('^' + prefix + '-(\\d+)$')
  let highest = 0
  ;(Array.isArray(list) ? list : []).forEach((item) => {
    const match = String(item && item.id || '').match(pattern)
    if (match) highest = Math.max(highest, Number(match[1]))
  })
  return prefix + '-' + String(highest + 1).padStart(2, '0')
}

function normalizeKey(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function conflictOf(candidate, existingList, titleFields) {
  const keyValue = normalizeKey(titleFields.map((field) => (candidate && candidate[field]) || '').join('|'))
  if (!keyValue || keyValue === '|') return null
  return (Array.isArray(existingList) ? existingList : []).find((existing) => {
    const existingKey = normalizeKey(titleFields.map((field) => (existing && existing[field]) || '').join('|'))
    return existingKey === keyValue
  }) || null
}

function appendLog(ssot, stage, text) {
  ssot.log.push({ at: nowIso(), stage: String(stage || 'system'), text: String(text || '') })
  if (ssot.log.length > 400) ssot.log = ssot.log.slice(-400)
  ssot.updatedAt = nowIso()
  return ssot
}

function findById(list, id) {
  return (Array.isArray(list) ? list : []).find((item) => item && item.id === id) || null
}

function openQuestions(ssot) {
  return ssot.questions.filter((question) => question.status !== 'answered')
}

function openRisks(ssot) {
  return ssot.risks.filter((risk) => risk.status !== 'mitigated' && risk.status !== 'accepted')
}

function todoTasks(ssot) {
  return ssot.tasks.filter((task) => task.status === 'todo')
}

// Seeds the depth checklist once per tool. Items keep their state afterwards,
// so a later stage can never re-open work a task already closed.
function ensureChecklist(ssot) {
  if (!Array.isArray(ssot.checklist)) ssot.checklist = []
  if (ssot.checklist.length) return ssot.checklist
  ssot.checklist = CHECKLIST_ITEMS.map((item, index) => ({
    id: 'CL-' + String(index + 1).padStart(2, '0'),
    title: item.title,
    detail: item.detail,
    accept: item.accept,
    status: 'todo',
    taskId: null,
    createdAt: nowIso()
  }))
  return ssot.checklist
}

function openChecklist(ssot) {
  return (Array.isArray(ssot.checklist) ? ssot.checklist : [])
    .filter((item) => item.status === 'todo' || item.status === 'doing')
}

function findChecklistItem(ssot, checklistId) {
  return (Array.isArray(ssot.checklist) ? ssot.checklist : [])
    .find((item) => item.id === checklistId) || null
}

function checklistProgress(ssot) {
  const items = Array.isArray(ssot.checklist) ? ssot.checklist : []
  return {
    total: items.length,
    done: items.filter((item) => item.status === 'done' || item.status === 'na').length,
    open: items.filter((item) => item.status === 'todo' || item.status === 'doing').length
  }
}

function failedTests(ssot, limit) {
  const maxItems = Number(limit) || 6
  return ssot.tests.filter((test) => test.ok === false).slice(-maxItems)
}

function plannedIdeas(ssot) {
  return ssot.ideas.filter((idea) => idea.status === 'planned')
}

// Appends one build step to the timeline. Kept bounded so the file stays small.
function appendStep(ssot, step) {
  const entry = Object.assign({ at: nowIso() }, step || {})
  ssot.steps.push(entry)
  if (ssot.steps.length > 400) ssot.steps = ssot.steps.slice(-400)
  return entry
}

function openUsabilityFindings(ssot) {
  return (ssot.usability || []).filter((finding) => finding.status !== 'addressed' && finding.status !== 'rejected')
}

function pendingFeatures(ssot) {
  return ssot.features.filter((feature) => feature.status !== 'done')
}

// Compact, human readable digest used inside prompts. Kept short on purpose:
// this is the main lever for keeping input tokens low.
function buildDigest(ssot, options) {
  const settings = options || {}
  const lines = []
  lines.push('APPLICATION: ' + ssot.product.name + (ssot.product.tagline ? ' - ' + ssot.product.tagline : ''))
  const definition = ssot.definition || {}
  if (definition.summary) lines.push('WHAT IT IS: ' + definition.summary)
  if ((definition.jobs || []).length) lines.push('JOBS: ' + definition.jobs.slice(0, 8).join(' | '))
  if ((definition.outOfScope || []).length) {
    lines.push('OUT OF SCOPE (never build these): ' + definition.outOfScope.slice(0, 6).join(' | '))
  }
  if (ssot.product.problem) lines.push('PROBLEM: ' + ssot.product.problem)
  if (ssot.product.solution) lines.push('SOLUTION: ' + ssot.product.solution)
  if (ssot.product.audience) lines.push('AUDIENCE: ' + ssot.product.audience)

  if (ssot.product.differentiators.length) {
    lines.push('DIFFERENTIATORS: ' + ssot.product.differentiators.join('; '))
  }

  if (ssot.features.length) {
    lines.push('FEATURES: ' + ssot.features.slice(0, settings.maxFeatures || 12).map((feature) => {
      return feature.id + ' [' + (feature.priority || 'should') + '/' + (feature.status || 'planned') + '] ' +
        feature.title + (feature.description ? ' - ' + feature.description : '')
    }).join(' | '))
  }

  const openRiskList = openRisks(ssot)
  if (openRiskList.length) {
    lines.push('OPEN RISKS: ' + openRiskList.slice(0, 8).map((risk) => {
      return risk.id + ' [' + (risk.severity || 'medium') + '] ' + risk.text
    }).join(' | '))
  }

  const openQuestionList = openQuestions(ssot)
  if (openQuestionList.length) {
    lines.push('OPEN QUESTIONS: ' + openQuestionList.slice(0, 8).map((question) => {
      return question.id + ' ' + question.text + (question.assumption ? ' (assumed: ' + question.assumption + ')' : '')
    }).join(' | '))
  }

  if (settings.includeTasks !== false && ssot.tasks.length) {
    const recentTasks = ssot.tasks.slice(-(settings.maxTasks || 8))
    lines.push('RECENT TASKS: ' + recentTasks.map((task) => {
      return task.id + ' [' + task.status + '] ' + task.title
    }).join(' | '))
  }

  const failed = failedTests(ssot)
  if (failed.length) {
    lines.push('FAILING CHECKS: ' + failed.map((test) => test.name + ' -> ' +
      String(test.detail || '').slice(0, 160)).join(' | '))
  }

  const openFindings = openUsabilityFindings(ssot)
  if (openFindings.length) {
    lines.push('OPEN UX FINDINGS: ' + openFindings.slice(0, 6).map((finding) => {
      return '[' + (finding.severity || 'medium') + '/' + (finding.type || 'clarity') + '] ' +
        String(finding.observation || '').slice(0, 120)
    }).join(' | '))
  }

  return lines.join('\n')
}

module.exports = {
  SCHEMA,
  TASK_STATUSES,
  RISK_STATUSES,
  PRIORITIES,
  IMPACTS,
  CHECKLIST_STATUSES,
  CHECKLIST_ITEMS,
  createSsot,
  normalizeSsot,
  nextId,
  conflictOf,
  appendLog,
  findById,
  openQuestions,
  openRisks,
  todoTasks,
  ensureChecklist,
  openChecklist,
  findChecklistItem,
  checklistProgress,
  failedTests,
  plannedIdeas,
  pendingFeatures,
  buildDigest,
  appendStep,
  openUsabilityFindings
}
