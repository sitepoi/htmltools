'use strict'

// Small deterministic helpers shared by every module. No dependencies.

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

function nowIso() {
  return new Date().toISOString()
}

function shortId(prefix) {
  const stamp = Date.now().toString(36)
  const random = crypto.randomBytes(3).toString('hex')
  return String(prefix || 'id') + '_' + stamp + random
}

function dateStamp() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
    '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds())
}

function hashText(text) {
  return crypto.createHash('sha256').update(String(text == null ? '' : text), 'utf8').digest('hex')
}

function ensureDir(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true })
  return directoryPath
}

function readJsonFile(filePath, fallbackValue) {
  try {
    const rawText = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(rawText)
  } catch (_error) {
    return fallbackValue
  }
}

function writeTextAtomic(filePath, text) {
  ensureDir(path.dirname(filePath))
  const temporaryPath = filePath + '.tmp-' + process.pid + '-' + Date.now()
  fs.writeFileSync(temporaryPath, String(text), 'utf8')
  fs.renameSync(temporaryPath, filePath)
  return filePath
}

function writeJsonAtomic(filePath, value) {
  return writeTextAtomic(filePath, JSON.stringify(value, null, 2))
}

function truncateTail(text, maxChars) {
  const value = String(text == null ? '' : text)
  if (value.length <= maxChars) return value
  return value.slice(value.length - maxChars)
}

function truncateMiddle(text, maxChars) {
  const value = String(text == null ? '' : text)
  if (value.length <= maxChars) return value
  const keepEachSide = Math.max(0, Math.floor((maxChars - 40) / 2))
  return value.slice(0, keepEachSide) + '\n...[trimmed ' + (value.length - keepEachSide * 2) + ' chars]...\n' +
    value.slice(value.length - keepEachSide)
}

function truncateHead(text, maxChars) {
  const value = String(text == null ? '' : text)
  if (value.length <= maxChars) return value
  return value.slice(0, maxChars)
}

// Turkish-aware, but simple: normalize, drop combining marks, then map.
function slugify(text) {
  const normalized = String(text == null ? '' : text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 'S')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'G')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'U')
    .toLowerCase()
  const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'untitled'
}

function toTitleCase(text) {
  return String(text == null ? '' : text)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function clampNumber(value, minimum, maximum) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return minimum
  return Math.min(maximum, Math.max(minimum, numeric))
}

function fingerprintForList(items, fields) {
  const list = Array.isArray(items) ? items : []
  return list
    .map((item) => (fields || ['title']).map((field) => String(item && item[field] || '')).join('|').toLowerCase())
    .filter(Boolean)
}

function listContainsTitle(items, title, fields) {
  const wanted = String(title || '').trim().toLowerCase()
  if (!wanted) return true
  return fingerprintForList(items, fields).some((existing) => existing === wanted)
}

function safeJsonParse(text, fallbackValue) {
  try {
    return JSON.parse(text)
  } catch (_error) {
    return fallbackValue
  }
}

function humanBytes(byteCount) {
  const bytes = Number(byteCount) || 0
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

function estimateTokens(charCount) {
  return Math.ceil((Number(charCount) || 0) / 4)
}

module.exports = {
  nowIso,
  shortId,
  dateStamp,
  hashText,
  ensureDir,
  readJsonFile,
  writeTextAtomic,
  writeJsonAtomic,
  truncateTail,
  truncateMiddle,
  truncateHead,
  slugify,
  toTitleCase,
  sleep,
  clampNumber,
  fingerprintForList,
  listContainsTitle,
  safeJsonParse,
  humanBytes,
  estimateTokens
}
