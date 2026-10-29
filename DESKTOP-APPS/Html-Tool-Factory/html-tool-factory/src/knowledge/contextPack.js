'use strict'

// Repository knowledge for the model. This is the factory's equivalent of the
// context a human or a coding assistant has when it works inside this repo:
// the tool rules, the publish checklist and the lessons of previous runs.
// It is bounded in characters, cached by file modification time and never
// contains secrets.

const fs = require('fs')
const path = require('path')
const { REPO_ROOT } = require('../tool/taxonomy')

const APP_ROOT = path.resolve(__dirname, '..', '..')
const LESSONS_PATH = path.join(APP_ROOT, 'knowledge', 'lessons.json')
const MAX_LESSONS = 30

const DEFAULT_SOURCES = [
  { file: 'html-tool-rules.txt', title: 'HTML TOOL RULES (repository standard)', maxChars: 2200, filter: 'rules' },
  { file: 'PUBLISH-CHECKLIST.md', title: 'PUBLISH CHECKLIST (what a finished tool needs)', maxChars: 1000, filter: 'rules' }
]

let cache = { key: '', block: '' }

function readIfExists(filePath) {
  try {
    const stat = fs.statSync(filePath)
    return { text: fs.readFileSync(filePath, 'utf8'), mtime: stat.mtimeMs }
  } catch (_error) {
    return null
  }
}

// Keeps the lines that carry a rule so the block stays small and useful.
function condense(text, maxChars) {
  const seen = new Set()
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^[-=]{3,}$/.test(line))
    .filter((line) => !/^<\/?[a-z]/i.test(line))
    .filter((line) => line.length > 12)
    .filter((line) => !/^[-\s]+$/.test(line))
  const kept = []
  let used = 0
  for (const line of lines) {
    const isRule = /^#|^[-*]|^\d+[.)]|must|never|do not|always|required|forbidden|exactly|scroll|iframe/i.test(line)
    if (!isRule) continue
    const trimmed = line.replace(/^[-*]\s*/, '- ').replace(/^-\s*-\s*/, '- ').replace(/\s+/g, ' ')
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    if (used + trimmed.length + 1 > maxChars) break
    seen.add(key)
    kept.push(trimmed.slice(0, 220))
    used += trimmed.length + 1
  }
  return kept.join('\n')
}

function readLessons() {
  const raw = readIfExists(LESSONS_PATH)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw.text)
    return Array.isArray(parsed) ? parsed : []
  } catch (_error) {
    return []
  }
}

function listLessons(limit) {
  const maxItems = Number(limit) || 8
  return readLessons()
    .slice(-maxItems)
    .map((lesson) => lesson && lesson.reason)
    .filter(Boolean)
}

// Appends one lesson per distinct failure so a later run does not repeat it.
function recordLesson(lesson) {
  const reason = String((lesson && lesson.reason) || '').trim().slice(0, 220)
  if (!reason) return { ok: false, reason: 'empty lesson' }
  const lessons = readLessons()
  const key = reason.toLowerCase()
  if (lessons.some((entry) => String(entry && entry.reason || '').toLowerCase() === key)) {
    return { ok: true, duplicate: true }
  }
  lessons.push({
    reason,
    tool: String((lesson && lesson.tool) || '').slice(0, 60),
    stage: String((lesson && lesson.stage) || '').slice(0, 40),
    at: new Date().toISOString()
  })
  const trimmed = lessons.slice(-MAX_LESSONS)
  try {
    fs.mkdirSync(path.dirname(LESSONS_PATH), { recursive: true })
    fs.writeFileSync(LESSONS_PATH, JSON.stringify(trimmed, null, 2), 'utf8')
    cache = { key: '', block: '' }
    return { ok: true, count: trimmed.length }
  } catch (error) {
    return { ok: false, reason: error.message }
  }
}

// Builds the block injected into the two prompts that decide what to build.
function buildKnowledgeBlock(options) {
  const settings = options || {}
  const config = settings.config || {}
  const knowledge = config.knowledge || {}
  const maxChars = Number(knowledge.maxChars) || 4200
  const sources = DEFAULT_SOURCES.concat(
    (Array.isArray(knowledge.extraFiles) ? knowledge.extraFiles : []).map((file) => ({
      file: String(file), title: 'REFERENCE: ' + file, maxChars: 900, filter: 'rules'
    }))
  )

  const parts = []
  let cacheKey = String(maxChars)
  let used = 0

  sources.forEach((source) => {
    const filePath = path.resolve(REPO_ROOT, source.file)
    const raw = readIfExists(filePath)
    if (!raw) return
    cacheKey += '|' + source.file + ':' + raw.mtime
    const remaining = maxChars - used
    if (remaining < 200) return
    const condensed = condense(raw.text, Math.min(source.maxChars, remaining))
    if (!condensed) return
    parts.push(source.title + ':\n' + condensed)
    used += condensed.length
  })

  const lessons = listLessons(8)
  if (lessons.length) {
    const lessonBlock = 'LESSONS FROM EARLIER RUNS (do not repeat these):\n' +
      lessons.map((reason) => '- ' + reason).join('\n')
    parts.push(lessonBlock.slice(0, 1200))
    cacheKey += '|lessons:' + lessons.length + ':' + lessons[0]
  }

  const block = parts.join('\n\n')
  if (cache.key === cacheKey) return cache.block
  cache = { key: cacheKey, block }
  return block
}

module.exports = {
  LESSONS_PATH,
  buildKnowledgeBlock,
  recordLesson,
  listLessons,
  condense
}
