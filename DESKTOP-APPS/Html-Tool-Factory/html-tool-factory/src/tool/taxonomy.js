'use strict'

// Resolves an idea's folder code (for example B-G-01-a) to the real repository
// folder where the tool must be created:
//   BUSINESS / GENERAL / ai-automation / ai-chat-assistants / <ToolName>
// The taxonomy JSON is the single source of truth for that mapping, so a tool
// never lands in a folder that does not exist in the catalog.

const fs = require('fs')
const path = require('path')

const APP_ROOT = path.resolve(__dirname, '..', '..')
const REPO_ROOT = path.resolve(APP_ROOT, '..', '..', '..')
const DEFAULT_FILE = path.join(REPO_ROOT, 'UNICON-TOOLS', 'tools-catalog', 'folder-hierarchy-import.json')

let cache = { file: '', taxonomy: null }

function toSlug(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function readTaxonomy(file) {
  const filePath = file ? path.resolve(file) : DEFAULT_FILE
  if (cache.file === filePath && cache.taxonomy) {
    return { ok: true, taxonomy: cache.taxonomy, file: filePath }
  }
  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: 'The folder taxonomy file was not found: ' + filePath, file: filePath }
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (!data || !Array.isArray(data.folders) || !data.folders.length) {
      return { ok: false, reason: 'The folder taxonomy file has no folders array: ' + filePath, file: filePath }
    }
    cache = { file: filePath, taxonomy: data }
    return { ok: true, taxonomy: data, file: filePath }
  } catch (error) {
    return { ok: false, reason: 'The folder taxonomy file is not valid JSON: ' + error.message, file: filePath }
  }
}

function findTrail(nodes, wanted) {
  const list = Array.isArray(nodes) ? nodes : []
  for (const node of list) {
    if (!node) continue
    const code = String(node.code || '').trim().toLowerCase()
    const name = String(node.name || '').trim().toLowerCase()
    const slug = String(node.slug || '').trim().toLowerCase()
    if ((code && code === wanted) || (name && name === wanted) || (slug && slug === wanted)) {
      return [node]
    }
    const childTrail = findTrail(node.children, wanted)
    if (childTrail) return [node].concat(childTrail)
  }
  return null
}

// Trailing segments of a folder code, used as a looser second attempt:
// "B-G-01-a" -> "a", so an idea can still be placed when only the leaf is known.
function leafOf(code) {
  const parts = String(code || '').split(/[-/>]+/).filter(Boolean)
  return parts.length ? parts[parts.length - 1].toLowerCase() : ''
}

function resolveLocation(code, options) {
  const settings = options || {}
  const raw = String(code || '').trim()
  if (!raw) {
    return {
      ok: false,
      reason: 'The idea has no folder code, so the tool folder cannot be resolved from the catalog taxonomy. ' +
        'Set the folder field of the idea in tool-ideas-catalog.json (for example B-G-01-a).'
    }
  }
  const lookup = readTaxonomy(settings.taxonomyFile)
  if (!lookup.ok) return { ok: false, reason: lookup.reason }

  // A full path code such as BUSINESS/GENERAL/ai-automation/ai-chat-assistants.
  if (/[\\/]/.test(raw)) {
    const segments = raw.split(/[\\/]+/).filter(Boolean)
    const relativePath = segments.join('/')
    return {
      ok: true,
      code: raw,
      relativePath,
      label: segments.join(' / '),
      taxonomyFile: lookup.file
    }
  }

  const wanted = raw.toLowerCase()
  let trail = findTrail(lookup.taxonomy.folders, wanted)
  let matchedBy = 'code'
  if (!trail) {
    const candidates = [
      String(settings.category || '').trim().toLowerCase(),
      leafOf(raw)
    ].filter(Boolean)
    for (const candidate of candidates) {
      trail = findTrail(lookup.taxonomy.folders, candidate)
      if (trail) {
        matchedBy = candidate === leafOf(raw) ? 'leaf' : 'category'
        break
      }
    }
  }
  if (!trail) {
    return {
      ok: false,
      reason: 'The folder code ' + raw + ' is not in ' + lookup.file +
        '. Fix the folder field of the idea or add the folder to the taxonomy.'
    }
  }

  const sameType = trail[1]
  const segments = trail.map((node, index) => {
    if (index === 0) return String(node.name || node.slug || '').toUpperCase()
    if (index === 1 && sameType) return String(node.name || node.slug || '').toUpperCase()
    return String(node.slug || toSlug(node.name))
  })

  return {
    ok: true,
    code: raw,
    matchedBy,
    trail: trail.map((node) => ({ name: node.name, code: node.code, slug: node.slug })),
    relativePath: segments.join('/'),
    label: trail.map((node) => node.name).join(' / '),
    taxonomyFile: lookup.file
  }
}

// Absolute folder of the tool: <repo>/<taxonomy path>/<ToolName>
function resolveTargetDirectory(request) {
  const settings = request || {}
  const toolName = String(settings.toolName || '').trim()
  if (!toolName) return { ok: false, reason: 'The tool name is empty, so no target folder can be computed.' }
  const location = resolveLocation(settings.code, {
    taxonomyFile: settings.taxonomyFile,
    category: settings.category
  })
  if (!location.ok) return location
  const repoRoot = path.resolve(settings.repoRoot || REPO_ROOT)
  const relativePath = location.relativePath + '/' + toolName
  return {
    ok: true,
    toolName,
    code: location.code,
    matchedBy: location.matchedBy,
    taxonomyFile: location.taxonomyFile,
    label: location.label,
    repoRoot,
    relativePath,
    absolutePath: path.join(repoRoot, ...relativePath.split('/'))
  }
}

module.exports = {
  REPO_ROOT,
  DEFAULT_FILE,
  readTaxonomy,
  resolveLocation,
  resolveTargetDirectory,
  toSlug
}
