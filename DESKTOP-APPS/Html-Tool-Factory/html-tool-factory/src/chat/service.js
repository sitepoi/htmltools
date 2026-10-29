'use strict'

// Per tool chat. The operator writes an idea, a bug report or a refinement for
// ONE tool, and the chat only edits that tool's SSOT: no code, no tasks run, no
// files touched. Turning SSOT changes into work stays the job of the normal
// planning and apply stages.

const fs = require('fs')
const path = require('path')
const { nowIso } = require('../util')
const ssotModel = require('../ssot/model')
const scoring = require('../ssot/scoring')
const { applyDefinition, addFeature, addRisk, addQuestion, addDecision } = require('../stages/ssotWriters')

const MAX_HISTORY = 12
const MAX_READ = 80

function chatFile(runDirectory) {
  return path.join(runDirectory, 'chat.jsonl')
}

function readChat(runDirectory, limit) {
  const maxItems = Number(limit) || MAX_READ
  let raw = ''
  try {
    raw = fs.readFileSync(chatFile(runDirectory), 'utf8')
  } catch (_error) {
    return []
  }
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line) } catch (_error) { return null }
    })
    .filter(Boolean)
    .slice(-maxItems)
}

function appendChat(runDirectory, entry) {
  try {
    fs.mkdirSync(runDirectory, { recursive: true })
    fs.appendFileSync(chatFile(runDirectory), JSON.stringify(entry) + '\n', 'utf8')
  } catch (_error) {
    // the chat is a convenience; a failed append must not break the run
  }
}

function buildWindow(history) {
  return history
    .slice(-MAX_HISTORY)
    .map((entry) => (entry.role === 'operator' ? 'OPERATOR: ' : 'PARTNER: ') + String(entry.text || '').slice(0, 600))
    .join('\n')
}

function chatPrompt(options) {
  const ssot = options.ssot
  const definition = ssot.definition || {}
  const system = [
    'You are the product partner for ONE html tool in this repository.',
    'You only change the tool specification. You never write code and you never run work.',
    'The tool is plain HTML, CSS and JavaScript in three files: no React, no build step, no server,',
    'no database. Every suggestion must be buildable inside that boundary.',
    '',
    'Your answer has two parts: a short reply for the operator, and SSOT operations.',
    'Use an operation only when the message really changes the specification.',
    'If the operator reports a bug, add a task (op add-task) with a checkable acceptance line.',
    'If the operator describes what the tool should become, update the definition and add features.',
    'Never invent requirements the operator did not ask for.'
  ].join('\n')

  const user = [
    'TOOL: ' + (ssot.product.name || options.toolName || 'The tool'),
    'TOOL NAME (code): ' + (options.toolName || 'TheTool'),
    '',
    'CURRENT DEFINITION:',
    definition.summary ? definition.summary : '(not written yet)',
    (definition.jobs || []).length ? 'JOBS: ' + definition.jobs.join(' | ') : '',
    (definition.outOfScope || []).length ? 'OUT OF SCOPE: ' + definition.outOfScope.join(' | ') : '',
    '',
    'CURRENT SSOT:',
    ssotModel.buildDigest(ssot, { includeTasks: true, maxTasks: 10, maxFeatures: 12 }),
    '',
    'CONVERSATION SO FAR:',
    buildWindow(options.history || []) || '(first message)',
    '',
    'OPERATOR MESSAGE:',
    String(options.message || '').slice(0, 2000),
    '',
    'Return JSON only:',
    '{',
    '  "reply": "1 to 3 sentences, in the operator language, saying what you changed",',
    '  "ops": [ { "op": "set-definition|add-feature|add-idea|add-risk|add-question|add-decision|add-task",',
    '             ...fields... } ]',
    '}',
    '',
    'Operation shapes:',
    '- {"op":"set-definition","summary":"...","jobs":["..."],"screens":["..."],"data":["..."],"rules":["..."],"outOfScope":["..."],"success":["..."]}  (send only the fields you change)',
    '- {"op":"add-feature","title":"...","description":"...","priority":"must|should|could"}',
    '- {"op":"add-idea","title":"...","why":"..."}',
    '- {"op":"add-risk","text":"...","severity":"high|medium|low","mitigation":"..."}',
    '- {"op":"add-question","text":"...","assumption":"..."}',
    '- {"op":"add-decision","text":"...","rationale":"..."}',
    '- {"op":"add-task","title":"...","kind":"code|test|doc|chore","files":["app/<Tool>.js"],"acceptance":["checkable line"]}',
    '',
    'Rules:',
    '- At most 6 operations. Empty ops array is fine when the message needs no change.',
    '- No file paths outside app/<Tool>.html, app/<Tool>.css, app/<Tool>.js, app/test-harness.html.',
    '- No code in the reply. No promises about scheduling; say the plan will pick it up.',
    '',
    '@@STAGE:chat@@'
  ].filter(Boolean).join('\n')

  return { system, user }
}

function applyChatOps(ssot, rawOps, toolName) {
  const changes = []
  const ops = (Array.isArray(rawOps) ? rawOps : []).slice(0, 6)
  ops.forEach((rawOperation) => {
    if (!rawOperation || typeof rawOperation !== 'object') return
    const op = String(rawOperation.op || '').toLowerCase()
    if (op === 'set-definition') {
      const next = applyDefinition(ssot, rawOperation)
      const parts = ['jobs', 'screens', 'data', 'rules', 'outOfScope', 'success']
        .filter((key) => (next[key] || []).length)
        .map((key) => (next[key] || []).length + ' ' + key)
      changes.push('Definition updated (' + (next.summary ? 'summary' : 'no summary') +
        (parts.length ? ', ' + parts.join(', ') : '') + ')')
      return
    }
    if (op === 'add-feature') {
      const feature = addFeature(ssot, rawOperation)
      if (feature) changes.push('Feature ' + feature.id + ': ' + feature.title)
      return
    }
    if (op === 'add-idea') {
      const title = String(rawOperation.title || '').trim().slice(0, 160)
      if (!title) return
      if (ssotModel.conflictOf({ title }, ssot.ideas, ['title'])) return
      const idea = {
        id: ssotModel.nextId(ssot.ideas, 'I'),
        title,
        why: String(rawOperation.why || '').slice(0, 400),
        impact: 'medium',
        status: 'new',
        createdAt: nowIso(),
        source: 'chat'
      }
      ssot.ideas.push(idea)
      changes.push('Idea ' + idea.id + ': ' + idea.title)
      return
    }
    if (op === 'add-risk') {
      const risk = addRisk(ssot, rawOperation)
      if (risk) changes.push('Risk ' + risk.id + ': ' + String(rawOperation.text || '').slice(0, 90))
      return
    }
    if (op === 'add-question') {
      const question = addQuestion(ssot, rawOperation)
      if (question) changes.push('Question ' + question.id + ': ' + String(rawOperation.text || '').slice(0, 90))
      return
    }
    if (op === 'add-decision') {
      const decision = addDecision(ssot, rawOperation)
      if (decision) changes.push('Decision ' + decision.id + ': ' + String(rawOperation.text || '').slice(0, 90))
      return
    }
    if (op === 'add-task') {
      const title = String(rawOperation.title || '').trim().slice(0, 180)
      if (!title) return
      if (ssotModel.conflictOf({ title }, ssot.tasks, ['title'])) return
      const acceptance = (Array.isArray(rawOperation.acceptance) ? rawOperation.acceptance : [])
        .map((line) => String(line || '').trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, 5)
      const task = {
        id: ssotModel.nextId(ssot.tasks, 'T'),
        title,
        kind: ['code', 'test', 'doc', 'chore'].includes(String(rawOperation.kind || ''))
          ? String(rawOperation.kind)
          : 'code',
        files: (Array.isArray(rawOperation.files) ? rawOperation.files : [])
          .map((file) => String(file || '').trim())
          .filter(Boolean)
          .slice(0, 4),
        acceptance: acceptance.length ? acceptance : ['The reported problem is gone and every check still passes'],
        status: 'todo',
        attempts: 0,
        retries: 0,
        source: 'chat',
        createdAt: nowIso(),
        notes: ''
      }
      task.points = scoring.estimatePoints(task)
      ssot.tasks.push(task)
      changes.push('Task ' + task.id + ' (' + task.points + ' points): ' + task.title)
      return
    }
    changes.push('Ignored unknown operation "' + op + '"')
  })
  return changes
}

// One AI call, SSOT only. Returns the reply plus a human readable change list.
async function sendMessage(options) {
  const runDirectory = options.run.directory
  const message = String(options.message || '').trim().slice(0, 2000)
  const history = readChat(runDirectory, MAX_HISTORY)
  appendChat(runDirectory, { at: nowIso(), role: 'operator', text: message })

  const prompt = chatPrompt({
    ssot: options.ssot,
    toolName: options.run.toolName || '',
    history,
    message
  })
  const answer = await options.ai.chat({
    stage: 'chat',
    system: prompt.system,
    user: prompt.user,
    model: options.config.models.planner
  })

  let parsed = {}
  try {
    parsed = JSON.parse(answer.text)
  } catch (_error) {
    const start = answer.text.indexOf('{')
    const end = answer.text.lastIndexOf('}')
    parsed = start !== -1 && end > start ? JSON.parse(answer.text.slice(start, end + 1)) : {}
  }

  const reply = String(parsed.reply || 'Noted.').slice(0, 1200)
  const changes = applyChatOps(options.ssot, parsed.ops, options.run.toolName || '')
  ssotModel.appendLog(options.ssot, 'chat', 'Operator: ' + message.slice(0, 160))
  if (changes.length) {
    ssotModel.appendLog(options.ssot, 'chat', 'SSOT updated: ' + changes.join('; '))
  }
  appendChat(runDirectory, { at: nowIso(), role: 'partner', text: reply, changes })

  return { reply, changes }
}

module.exports = { sendMessage, readChat, appendChat, chatPrompt, applyChatOps }
