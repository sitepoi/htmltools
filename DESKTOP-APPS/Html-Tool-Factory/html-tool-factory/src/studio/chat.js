'use strict'

// Studio chat: one html tool in context, a conversation, an answer.
//
// What the model gets is decided HERE, not by the browser: the tool's SSOT, its
// code files and the file the operator has open, each trimmed to a budget so a
// 300 KB tool cannot turn one question into a 200k token request. Nothing is
// written by this module: the chat reads and answers.

const fs = require('fs')
const path = require('path')

const { createAiClient } = require('../ai/client')
const toolRoots = require('../toolRoots')
const workspace = require('../workspace')

const MAX_MESSAGE_CHARS = 4000
const MAX_MESSAGES = 20
const DEFAULT_CONTEXT_CHARS = 120000
const SSOT_BUDGET = 45000
const CODE_BUDGET = 20000
const OPEN_FILE_BUDGET = 20000
const TASK_LINES = 60

const SYSTEM_PROMPT = [
  'You are the development assistant inside UniconHub Studio, working on ONE html tool at a time.',
  'The tool is a self contained html application: app/<Tool>.html, app/<Tool>.css, app/<Tool>.js plus its own docs and a 7 section SSOT.',
  'You are given the tool SSOT (the specification and the task list), its code and the file the operator has open.',
  'Rules:',
  '1. Ground every statement in the files you were given. If something is not in the context, say what you would need instead of guessing.',
  '2. Answer questions about the tool, explain the code, diagnose bugs, and plan work.',
  '3. You cannot write files in this version. When a change is needed, describe it precisely and show the exact code to replace, with the file path and the surrounding lines.',
  '4. When the operator names a task id from the SSOT task list, treat that task as the goal and answer against its acceptance.',
  '5. Be brief. No preamble, no restating the question, no marketing tone.',
  '6. Answer in the language the operator writes in.',
  '7. Never invent ids, CMS object types, field names or file paths that are not in the context.'
].join('\n')

function clampText(text, limit) {
  const value = String(text == null ? '' : text)
  if (value.length <= limit) return { text: value, truncated: false, original: value.length }
  return {
    text: value.slice(0, limit) + '\n\n[... trimmed: ' + value.length + ' chars, showing the first ' + limit + ' ...]',
    truncated: true,
    original: value.length
  }
}

function findTool(config, toolPath) {
  const wanted = String(toolPath == null ? '' : toolPath).trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (!wanted) return null
  const listing = toolRoots.listTools(config)
  return listing.tools.filter((tool) => tool.relativePath === wanted)[0] || null
}

function readIfExists(absolutePath, limit) {
  try {
    const stats = fs.statSync(absolutePath)
    if (!stats.isFile()) return null
    const text = fs.readFileSync(absolutePath, 'utf8')
    const clamped = clampText(text, limit)
    return { text: clamped.text, chars: text.length, truncated: clamped.truncated, bytes: stats.size }
  } catch (error) {
    return null
  }
}

// The SSOT is long and mostly reference material. Keep the head (purpose and
// scope) and the task list, which is what a task driven conversation needs.
function ssotDigest(ssotText, limit) {
  const text = String(ssotText || '')
  if (text.length <= limit) return { text, truncated: false }
  const taskIndex = text.indexOf('Development task list')
  const fromTasks = taskIndex > 0 ? text.slice(taskIndex) : ''
  const head = text.slice(0, Math.max(0, limit - Math.min(fromTasks.length, Math.round(limit * 0.5))))
  const tail = fromTasks ? '\n\n[... task list continues below ...]\n\n' + fromTasks.slice(0, Math.round(limit * 0.5)) : ''
  return { text: head + tail, truncated: true }
}

function toRepoRelative(value) {
  const raw = String(value == null ? '' : value).trim().replace(/\\/g, '/')
  if (!raw) return ''
  const root = workspace.repoRoot().replace(/\\/g, '/')
  if (raw.toLowerCase() === root.toLowerCase()) return ''
  if (raw.toLowerCase().indexOf(root.toLowerCase() + '/') === 0) return raw.slice(root.length + 1)
  const normalized = workspace.normalizeRelative(raw)
  return normalized.ok ? normalized.relativePath : ''
}

function buildToolContext(options) {
  const config = options.config
  const tool = options.tool
  const budget = Math.max(20000, Number(options.budget) || Number(config.studio && config.studio.chatContextChars) || DEFAULT_CONTEXT_CHARS)
  const included = []
  const skipped = []

  const packageState = toolRoots.packageCompleteness(tool)
  const summary = [
    'TOOL: ' + tool.toolName,
    'PATH: ' + tool.relativePath,
    'BUILD: ' + (tool.toolBuild || '(no build stamp)'),
    'DOCUMENTS: ' + Object.keys(tool.documents || {}).join(', ') + (tool.documentsMissing && tool.documentsMissing.length
      ? ' | missing: ' + tool.documentsMissing.join(', ')
      : ' | complete'),
    'PACKAGE: ' + (packageState.present || []).join(', ') + ' (' + (packageState.present || []).length + ' of 8)'
  ].join('\n')
  included.push({ label: 'summary', chars: summary.length })

  const parts = ['=== TOOL ===\n' + summary]
  let used = summary.length

  const ssotPath = path.join(tool.path, 'docs', 'ssot.html')
  const ssot = readIfExists(ssotPath, SSOT_BUDGET)
  if (ssot) {
    const digest = ssotDigest(ssot.text, Math.min(SSOT_BUDGET, Math.max(0, budget - used)))
    parts.push('=== SSOT (' + (digest.truncated ? 'trimmed' : 'full') + ') ===\n' + digest.text)
    used += digest.text.length
    included.push({ label: 'ssot', chars: digest.text.length, truncated: digest.truncated })
  } else {
    skipped.push({ label: 'ssot', reason: 'no docs/ssot.html' })
  }

  const openFileRelative = toRepoRelative(options.openFile)
  const openFileAbsolute = openFileRelative ? path.join(workspace.repoRoot(), openFileRelative) : ''
  const openFileAlreadyInCode = Object.keys(tool.codeFiles || {}).some((kind) => toRepoRelative(tool.codeFiles[kind]) === openFileRelative)
  if (openFileAbsolute && !openFileAlreadyInCode) {
    const openFile = readIfExists(openFileAbsolute, Math.min(OPEN_FILE_BUDGET, Math.max(0, budget - used)))
    if (openFile) {
      parts.push('=== OPEN FILE: ' + openFileRelative + ' ===\n' + openFile.text)
      used += openFile.text.length
      included.push({ label: 'open file (' + openFileRelative + ')', chars: openFile.text.length, truncated: openFile.truncated })
    }
  }

  const codeOrder = ['js', 'html', 'css']
  const remaining = () => Math.max(0, budget - used)
  for (const kind of codeOrder) {
    const absolutePath = (tool.codeFiles || {})[kind]
    if (!absolutePath) { skipped.push({ label: kind, reason: 'no file' }); continue }
    const allowance = Math.min(CODE_BUDGET, remaining())
    if (allowance < 2000) { skipped.push({ label: kind, reason: 'context budget reached' }); continue }
    const file = readIfExists(absolutePath, allowance)
    if (!file) { skipped.push({ label: kind, reason: 'unreadable' }); continue }
    const relative = path.relative(workspace.repoRoot(), absolutePath).replace(/\\/g, '/')
    parts.push('=== CODE: ' + relative + ' ===\n' + file.text)
    used += file.text.length
    included.push({ label: 'code ' + kind, chars: file.text.length, truncated: file.truncated })
  }

  if (options.task) {
    const task = options.task
    const taskText = '=== FOCUS TASK ===\n' + [task.id, task.title, task.group ? 'group ' + task.group : '', task.status]
      .filter(Boolean).join(' | ')
    parts.push(taskText)
    used += taskText.length
    included.push({ label: 'focus task', chars: taskText.length })
  }

  // Attachments: text is inlined (every model can read it), an image is named
  // with its path and a note, because reading pixels needs a vision model.
  const attachments = Array.isArray(options.attachments) ? options.attachments : []
  let attachmentBudget = 40000
  attachments.forEach((attachment) => {
    if (!attachment || typeof attachment.path !== 'string') return
    const relative = toRepoRelative(attachment.path)
    if (!relative) { skipped.push({ label: 'attachment', reason: 'path outside the repository' }); return }
    if (attachment.kind === 'image') {
      const note = '=== ATTACHMENT (image): ' + relative + ' ===\nThe operator attached a screenshot. This model receives text only, so the image is stored at the path above; ask for a description or switch to a vision model.'
      parts.push(note)
      used += note.length
      included.push({ label: 'image ' + (attachment.name || relative), chars: note.length })
      return
    }
    const allowance = Math.min(attachmentBudget, remaining())
    if (allowance < 500) { skipped.push({ label: 'attachment ' + relative, reason: 'context budget reached' }); return }
    const file = readIfExists(path.join(workspace.repoRoot(), relative), allowance)
    if (!file) { skipped.push({ label: 'attachment ' + relative, reason: 'unreadable' }); return }
    const block = '=== ATTACHMENT: ' + relative + ' ===\n' + file.text
    parts.push(block)
    used += block.length
    attachmentBudget -= block.length
    included.push({ label: 'file ' + (attachment.name || relative), chars: block.length, truncated: file.truncated })
  })

  const tasks = workspace.readToolTasks(tool.relativePath)
  if (tasks.ok && tasks.tasks.length) {
    const open = tasks.tasks.filter((task) => !task.done && !task.ignored).slice(0, TASK_LINES)
    if (open.length) {
      const listText = '=== OPEN TASKS (' + tasks.counts.open + ' of ' + tasks.counts.total + ') ===\n' +
        open.map((task) => task.id + ' [' + task.status + '] ' + task.title).join('\n')
      parts.push(listText)
      used += listText.length
      included.push({ label: 'open tasks', chars: listText.length })
    }
  }

  return { text: parts.join('\n\n'), chars: used, budget, included, skipped }
}

function sanitizeMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) return []
  return rawMessages
    .filter((entry) => entry && (entry.role === 'user' || entry.role === 'assistant') && typeof entry.text === 'string')
    .slice(-MAX_MESSAGES)
    .map((entry) => ({ role: entry.role, text: clampText(entry.text, MAX_MESSAGE_CHARS).text }))
}

async function ask(options) {
  const config = options.config
  const tool = findTool(config, options.toolPath)
  if (!tool) {
    return { ok: false, error: 'That tool folder is not in the registry. Refresh the tool list and try again.' }
  }
  const messages = sanitizeMessages(options.messages)
  if (!messages.length) {
    return { ok: false, error: 'Type a question first.' }
  }
  const lastUser = messages.slice().reverse().filter((entry) => entry.role === 'user')[0]
  if (!lastUser || !lastUser.text.trim()) {
    return { ok: false, error: 'The last message is empty.' }
  }

  const context = buildToolContext({
    config,
    tool,
    openFile: options.openFile,
    task: options.task,
    attachments: options.attachments,
    budget: options.budget
  })

  const transcript = messages.map((entry) => (entry.role === 'user' ? 'Operator: ' : 'Assistant: ') + entry.text).join('\n\n')
  const userPrompt = [
    context.text,
    '=== CONVERSATION ===',
    transcript,
    '=== ANSWER ===',
    'Answer the operator\'s last message. Use the files above.'
  ].join('\n\n')

  const pseudoRun = {
    id: 'studio-chat',
    options: { provider: config.provider },
    counters: { aiCalls: 0, inputChars: 0, outputChars: 0 }
  }
  const client = createAiClient({ config, run: pseudoRun, logEvent: function noop() {} })
  let answer
  try {
    answer = await client.chat({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      stage: 'studio-chat',
      model: String((config.studio && config.studio.chatModel) || '')
    })
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : String(error),
      context: { chars: context.chars, budget: context.budget, included: context.included, skipped: context.skipped }
    }
  }

  return {
    ok: true,
    tool: { name: tool.toolName, path: tool.relativePath, build: tool.toolBuild },
    reply: { role: 'assistant', text: answer.text, provider: answer.provider, model: answer.model, tokens: answer.tokens || null },
    context: {
      chars: context.chars,
      budget: context.budget,
      included: context.included,
      skipped: context.skipped
    }
  }
}

module.exports = {
  SYSTEM_PROMPT,
  DEFAULT_CONTEXT_CHARS,
  clampText,
  ssotDigest,
  toRepoRelative,
  buildToolContext,
  sanitizeMessages,
  findTool,
  ask
}
