'use strict'

// The store map: every id the release engine needs, as data (SSOT 8.6, D-HTF-44).
//
// The engine never hardcodes a cmsObjectType, a field id, a folder id or a slug
// rule. It reads this file and validates it first, so a wrong or missing value
// becomes a named block before any write instead of a request that quietly does
// nothing (RM-06, D-HTF-46).

const fs = require('fs')
const path = require('path')
const { readJsonFile } = require('../util')

const SCHEMA = 'uniconhub-store-map'
const TARGET_KINDS = ['tool', 'document', 'application', 'media']
const DOCUMENT_KINDS = ['webpage', 'help', 'presentation', 'updates', 'social']
// A slug rule is data, but only these shapes are understood.
const SLUG_RULE_PATTERNS = [
  { name: 'repoToolSlug', test: (rule) => rule === 'repoToolSlug' },
  { name: 'toolSlug-suffix', test: (rule) => /^[a-z0-9-]*<toolSlug>[a-z0-9-]*$/i.test(rule || '') },
  { name: 'fixed', test: (rule) => /^[A-Za-z0-9._-]+$/.test(rule || '') }
]

function isFilled(value) {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

// A target is complete when every value the plan needs is present AND confirmed.
// An unconfirmed row may be used to build a dry run, never to write: the value
// is known but the store team has not confirmed it yet.
function inspectTarget(target) {
  const entry = target || {}
  const missing = []
  const hasFieldMap = entry.fields && typeof entry.fields === 'object' && Object.keys(entry.fields).length > 0
  if (!isFilled(entry.cmsObjectType)) missing.push('cmsObjectType')
  // A record written field by field (the tool record) has a field map instead of
  // one nested field path; a document is written into a single dcb key.
  if (entry.kind === 'document') {
    if (!isFilled(entry.fieldPath)) missing.push('fieldPath')
  } else if (!isFilled(entry.fieldPath) && !hasFieldMap) {
    missing.push('fieldPath')
  }
  const folderAnswered = isFilled(entry.folderId) || isFilled(entry.folderCode) || entry.folderDefault === true
  if (!folderAnswered) missing.push('folderId')
  if (!isFilled(entry.slugRule)) missing.push('slugRule')
  return {
    id: String(entry.id || ''),
    kind: String(entry.kind || ''),
    missing,
    complete: missing.length === 0,
    confirmed: entry.confirmed === true,
    writable: missing.length === 0 && entry.confirmed === true,
    questionRef: String(entry.questionRef || ''),
    blockedBecause: String(entry.blockedBecause || '')
  }
}

function validateStoreMap(map) {
  const problems = []
  if (!map || typeof map !== 'object') {
    return { ok: false, problems: [{ entryId: '', field: '', message: 'The store map is missing or not an object.' }] }
  }
  const meta = map.meta || {}
  if (meta.schema !== SCHEMA) {
    problems.push({ entryId: 'meta', field: 'schema', message: 'meta.schema must be "' + SCHEMA + '".' })
  }
  if (!isFilled(meta.version)) {
    problems.push({ entryId: 'meta', field: 'version', message: 'meta.version must be filled, so a change is visible.' })
  }
  const targets = Array.isArray(map.targets) ? map.targets : []
  if (!targets.length) {
    problems.push({ entryId: 'targets', field: '', message: 'The store map has no targets.' })
  }
  const seen = new Map()
  targets.forEach((target, index) => {
    const entry = target || {}
    const id = String(entry.id || '')
    const label = id || ('targets[' + index + ']')
    if (!id) problems.push({ entryId: label, field: 'id', message: 'A target needs an id.' })
    if (id && seen.has(id)) {
      problems.push({ entryId: label, field: 'id', message: 'Two targets share the id "' + id + '".' })
    }
    seen.set(id, entry)
    if (!TARGET_KINDS.includes(String(entry.kind || ''))) {
      problems.push({
        entryId: label,
        field: 'kind',
        message: 'kind must be one of ' + TARGET_KINDS.join(', ') + '.'
      })
    }
    if (isFilled(entry.slugRule) && !SLUG_RULE_PATTERNS.some((pattern) => pattern.test(entry.slugRule))) {
      problems.push({
        entryId: label,
        field: 'slugRule',
        message: 'slugRule "' + entry.slugRule + '" is not understood. Use repoToolSlug, <toolSlug>-suffix or a fixed slug.'
      })
    }
    if (entry.kind === 'document' && !DOCUMENT_KINDS.includes(String(entry.documentKind || ''))) {
      problems.push({
        entryId: label,
        field: 'documentKind',
        message: 'A document target needs documentKind: ' + DOCUMENT_KINDS.join(', ') + '.'
      })
    }
    if (isFilled(entry.folderCode) && isFilled(entry.folderId)) {
      problems.push({
        entryId: label,
        field: 'folderId',
        message: 'A target carries either folderId or folderCode, not both: the plan must not have two answers.'
      })
    }
    if (!isFilled(entry.questionRef)) {
      problems.push({
        entryId: label,
        field: 'questionRef',
        message: 'A target must name the section 14 question that answers it, even when it is already filled.'
      })
    }
  })
  return { ok: problems.length === 0, problems }
}

function loadStoreMap(filePath) {
  const absolutePath = path.resolve(filePath)
  if (!fs.existsSync(absolutePath)) {
    return {
      ok: false,
      map: null,
      problems: [{ entryId: '', field: '', message: 'The store map does not exist: ' + absolutePath }]
    }
  }
  const map = readJsonFile(absolutePath, null)
  if (!map) {
    return {
      ok: false,
      map: null,
      problems: [{ entryId: '', field: '', message: 'The store map is not valid JSON: ' + absolutePath }]
    }
  }
  const validation = validateStoreMap(map)
  return Object.assign({ map, path: absolutePath }, validation)
}

function targetById(map, id) {
  const targets = (map && Array.isArray(map.targets)) ? map.targets : []
  return targets.find((target) => target && target.id === id) || null
}

function targetForDocument(map, documentKind) {
  const targets = (map && Array.isArray(map.targets)) ? map.targets : []
  return targets.find((target) => target && target.kind === 'document' &&
    String(target.documentKind || '') === String(documentKind || '')) || null
}

// The block a caller reports when a target cannot be used, naming the entry and
// the question (RM-06, D-HTF-46). Never a default value.
function blockedTarget(map, id) {
  const target = targetById(map, id)
  if (!target) {
    return {
      ok: false,
      blocked: {
        entryId: id,
        missing: ['the whole target'],
        questionRef: '',
        reason: 'The store map has no target with the id "' + id + '".'
      }
    }
  }
  const inspected = inspectTarget(target)
  if (inspected.writable) return { ok: true, target }
  const reasonParts = []
  if (inspected.missing.length) reasonParts.push('missing ' + inspected.missing.join(', '))
  if (!inspected.confirmed) reasonParts.push('not confirmed for writing')
  return {
    ok: false,
    blocked: {
      entryId: id,
      missing: inspected.missing,
      confirmed: inspected.confirmed,
      questionRef: inspected.questionRef,
      reason: 'The store map target "' + id + '" is ' + reasonParts.join(' and ') +
        (inspected.questionRef ? ' - answer ' + inspected.questionRef + '.' : '.')
    }
  }
}

// The slug a target asks for: the stable repository slug, or that slug plus a
// suffix. Never a name, never a title.
function slugFor(slugRule, repoToolSlug) {
  const rule = String(slugRule || '')
  if (rule === 'repoToolSlug') return String(repoToolSlug || '')
  const templated = rule.match(/^[a-z0-9-]*<toolSlug>[a-z0-9-]*$/i)
  if (templated) return rule.replace(/<toolSlug>/i, String(repoToolSlug || ''))
  return rule
}

function summary(map) {
  const targets = (map && Array.isArray(map.targets)) ? map.targets : []
  return targets.map((target) => {
    const inspected = inspectTarget(target)
    return {
      id: inspected.id,
      kind: inspected.kind,
      complete: inspected.complete,
      confirmed: inspected.confirmed,
      writable: inspected.writable,
      missing: inspected.missing,
      questionRef: inspected.questionRef
    }
  })
}

module.exports = {
  SCHEMA,
  TARGET_KINDS,
  DOCUMENT_KINDS,
  SLUG_RULE_PATTERNS,
  inspectTarget,
  validateStoreMap,
  loadStoreMap,
  targetById,
  targetForDocument,
  blockedTarget,
  slugFor,
  summary
}
