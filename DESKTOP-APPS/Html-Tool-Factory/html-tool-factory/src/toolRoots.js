'use strict'

// Tool roots: the folders that may contain html tools.
//
// The factory used to assume one repository. A release platform has to see every
// place a tool is developed, so the roots are configuration (SSOT section 8.5,
// D-HTF-43) and this module is the only thing that walks them.
//
// Discovery is strictly read only: it stats, lists and reads. Nothing here
// writes a byte, and a root that is not marked writable is reported as such so a
// later write phase can refuse it.

const fs = require('fs')
const path = require('path')
const { REPO_ROOT } = require('./tool/taxonomy')
const { slugify } = require('./util')

// A tool is this: an app folder with one html, one css and one js file that
// share a base name. The base name is the tool name; the folder name is the
// stable store slug. Listing and reporting tools use the same three files, so
// they need no special case.
const CODE_KINDS = ['html', 'css', 'js']
const DOCUMENT_FILES = {
  webpage: ['webpage.html', 'webpage-export.html'],
  help: ['help.html'],
  presentation: ['presentation.html'],
  updates: ['updates.html'],
  social: ['social.html']
}
const OTHER_DOCUMENTS = { ssot: 'ssot.html', index: 'index.html' }
const SKIP_DIRECTORIES = new Set([
  'node_modules', '.git', '.backup', '.checkpoints', 'runs', 'ship-out',
  'selftest-output', '_docs', 'dist', 'build', 'coverage'
])

function normalizeRootEntry(entry, index) {
  const source = entry && typeof entry === 'object' ? entry : {}
  const rawRoot = String(source.root || '')
  const root = rawRoot ? (path.isAbsolute(rawRoot) ? rawRoot : path.resolve(REPO_ROOT, rawRoot)) : REPO_ROOT
  return {
    label: String(source.label || ('root' + (index + 1))),
    root,
    taxonomyFile: String(source.taxonomyFile || ''),
    // An external root is read only unless it says otherwise (Q-22 default).
    writable: source.writable === true,
    external: Boolean(rawRoot) && path.resolve(root) !== path.resolve(REPO_ROOT)
  }
}

function resolveRoots(config) {
  const settings = (config && config.toolRoots) || []
  const entries = Array.isArray(settings) && settings.length
    ? settings
    : [{ label: 'repo', root: '', taxonomyFile: 'UNICON-TOOLS/tools-catalog/folder-hierarchy-import.json', writable: true }]
  return entries.map(normalizeRootEntry).map((entry) => Object.assign({}, entry, {
    exists: fs.existsSync(entry.root)
  }))
}

// Every directory that has an app folder is a candidate. The walk is bounded:
// depth first, a fixed maximum depth and a skip list, so a root with thousands
// of files still answers in a moment.
function findAppDirectories(root, options) {
  const settings = options || {}
  const maxDepth = Number(settings.maxDepth) || 8
  const results = []
  if (!fs.existsSync(root)) return results

  function walk(directoryPath, depth) {
    if (depth > maxDepth) return
    let entries = []
    try {
      entries = fs.readdirSync(directoryPath, { withFileTypes: true })
    } catch (_error) {
      return
    }
    const hasApp = entries.some((entry) => entry.isDirectory() && entry.name === 'app')
    if (hasApp) {
      results.push(path.join(directoryPath, 'app'))
      // A tool folder does not contain another tool folder.
      return
    }
    entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !SKIP_DIRECTORIES.has(entry.name))
      .forEach((entry) => walk(path.join(directoryPath, entry.name), depth + 1))
  }

  walk(path.resolve(root), 0)
  return results
}

// One app folder may hold several triples (a tool and a variant shipped
// together); the one named after the folder wins, then the first complete one.
function codeTriple(appDirectory, folderName) {
  let names = []
  try {
    names = fs.readdirSync(appDirectory)
  } catch (_error) {
    return null
  }
  const bases = []
  names.forEach((name) => {
    const extension = path.extname(name).toLowerCase().replace('.', '')
    if (!CODE_KINDS.includes(extension)) return
    const base = path.basename(name, path.extname(name))
    if (!bases.includes(base)) bases.push(base)
  })
  const complete = bases.filter((base) => CODE_KINDS.every((kind) =>
    names.includes(base + '.' + kind)))
  if (!complete.length) return null
  const preferred = complete.includes(folderName) ? folderName : complete[0]
  return {
    toolName: preferred,
    parts: CODE_KINDS.reduce((accumulator, kind) => {
      accumulator[kind] = preferred + '.' + kind
      return accumulator
    }, {})
  }
}

function readFirstLine(absolutePath) {
  try {
    const handle = fs.readFileSync(absolutePath, 'utf8')
    return String(handle.split('\n')[0] || '').replace(/\r$/, '')
  } catch (_error) {
    return ''
  }
}

// The stamp of one code file: "html build 2026-10-10-7" for markup, the same
// shape for css and js. The contract module owns the rule; this reads it.
function stampInFile(absolutePath) {
  const first = readFirstLine(absolutePath)
  const match = first.match(/^(?:<!--|\/\*)\s*([a-z]+)\s+build\s+([^\s*>]+)\s*(?:-->|\*\/)$/)
  return match ? match[2] : ''
}

function toolBuildInJs(absolutePath) {
  try {
    const text = fs.readFileSync(absolutePath, 'utf8')
    const match = text.match(/\bTOOL_BUILD\s*=\s*['"]([^'"]+)['"]/)
    return match ? match[1] : ''
  } catch (_error) {
    return ''
  }
}

function documentFiles(toolDirectory) {
  const docsDirectory = path.join(toolDirectory, 'docs')
  const found = { documents: {}, absent: [] }
  Object.keys(DOCUMENT_FILES).forEach((kind) => {
    const candidates = DOCUMENT_FILES[kind]
    const existing = candidates
      .map((name) => path.join(docsDirectory, name))
      .find((absolutePath) => fs.existsSync(absolutePath))
    if (existing) found.documents[kind] = existing
    else found.absent.push(kind)
  })
  Object.keys(OTHER_DOCUMENTS).forEach((kind) => {
    const absolutePath = path.join(docsDirectory, OTHER_DOCUMENTS[kind])
    if (fs.existsSync(absolutePath)) found.documents[kind] = absolutePath
  })
  return found
}

function countScreenshots(toolDirectory) {
  const candidates = [
    path.join(toolDirectory, 'docs', 'screenshots'),
    path.join(toolDirectory, 'screenshots')
  ]
  for (const directory of candidates) {
    if (!fs.existsSync(directory)) continue
    try {
      return fs.readdirSync(directory).filter((name) => /\.(png|jpe?g|webp|gif|svg)$/i.test(name)).length
    } catch (_error) {
      return 0
    }
  }
  return 0
}

function latestModifiedAt(paths) {
  let newest = 0
  paths.forEach((absolutePath) => {
    try {
      const stat = fs.statSync(absolutePath)
      if (stat.mtimeMs > newest) newest = stat.mtimeMs
    } catch (_error) {
      // an unreadable file simply does not contribute
    }
  })
  return newest ? new Date(newest).toISOString() : ''
}

// Reads one app folder and returns the registry entry, or null when the folder
// is not a complete html tool.
function readTool(toolDirectory, rootEntry) {
  const folderName = path.basename(toolDirectory)
  const appDirectory = path.join(toolDirectory, 'app')
  const triple = codeTriple(appDirectory, folderName)
  if (!triple) return null
  const codePaths = CODE_KINDS.map((kind) => path.join(appDirectory, triple.parts[kind]))
  const stamps = CODE_KINDS.reduce((accumulator, kind) => {
    accumulator[kind] = stampInFile(path.join(appDirectory, triple.parts[kind]))
    return accumulator
  }, {})
  const documents = documentFiles(toolDirectory)
  const harness = path.join(appDirectory, 'test-harness.html')
  const toolBuild = toolBuildInJs(path.join(appDirectory, triple.parts.js)) || stamps.js || stamps.html || ''
  return {
    slug: slugify(folderName),
    folderName,
    toolName: triple.toolName,
    root: rootEntry.label,
    rootPath: rootEntry.root,
    writable: rootEntry.writable === true,
    external: Boolean(rootEntry.external),
    path: toolDirectory,
    relativePath: path.relative(rootEntry.root, toolDirectory).replace(/\\/g, '/'),
    parts: triple.parts,
    codeFiles: {
      html: codePaths[0],
      css: codePaths[1],
      js: codePaths[2]
    },
    harness: fs.existsSync(harness) ? harness : '',
    documents: documents.documents,
    documentsMissing: documents.absent,
    screenshotCount: countScreenshots(toolDirectory),
    toolBuild,
    stamps,
    modifiedAt: latestModifiedAt(codePaths.concat(Object.values(documents.documents)))
  }
}

function listTools(config, options) {
  const settings = options || {}
  const roots = resolveRoots(config)
  const tools = []
  const problems = []
  roots.forEach((rootEntry) => {
    if (!rootEntry.exists) {
      problems.push({ root: rootEntry.label, reason: 'The root folder does not exist: ' + rootEntry.root })
      return
    }
    findAppDirectories(rootEntry.root, { maxDepth: settings.maxDepth }).forEach((appDirectory) => {
      const toolDirectory = path.dirname(appDirectory)
      const entry = readTool(toolDirectory, rootEntry)
      if (entry) tools.push(entry)
      else problems.push({
        root: rootEntry.label,
        reason: 'app folder without a matching html, css and js file: ' +
          path.relative(rootEntry.root, toolDirectory).replace(/\\/g, '/')
      })
    })
  })
  // A slug is the store key, so two tools may never share one.
  const bySlug = new Map()
  tools.forEach((tool) => {
    const existing = bySlug.get(tool.slug)
    if (existing) {
      problems.push({
        root: tool.root,
        reason: 'Two tools share the slug "' + tool.slug + '": ' +
          existing.relativePath + ' and ' + tool.relativePath
      })
      tool.slugConflict = true
      return
    }
    bySlug.set(tool.slug, tool)
  })
  return {
    roots,
    tools: tools.sort((left, right) => left.slug.localeCompare(right.slug)),
    problems,
    writableRoots: roots.filter((entry) => entry.writable).map((entry) => entry.label)
  }
}

function findTool(config, slugOrName) {
  const wanted = String(slugOrName || '').trim().toLowerCase()
  if (!wanted) return null
  const listing = listTools(config)
  return listing.tools.find((tool) =>
    tool.slug === slugOrName ||
    tool.slug.toLowerCase() === wanted ||
    tool.folderName.toLowerCase() === wanted ||
    tool.toolName.toLowerCase() === wanted) || null
}

// Eight release subjects from the SSOT glossary: code, harness, screenshots and
// the five documents. It is a repository fact, never proof of publication.
function packageCompleteness(tool) {
  const present = []
  if (tool.codeFiles && tool.codeFiles.html && tool.codeFiles.css && tool.codeFiles.js) present.push('code')
  if (tool.harness) present.push('harness')
  if (tool.screenshotCount > 0) present.push('screenshots')
  ;['webpage', 'help', 'presentation', 'updates', 'social'].forEach((kind) => {
    if (tool.documents && tool.documents[kind]) present.push(kind)
  })
  return { present, total: 8, complete: present.length === 8 }
}

module.exports = {
  CODE_KINDS,
  DOCUMENT_FILES,
  resolveRoots,
  findAppDirectories,
  readTool,
  listTools,
  findTool,
  stampInFile,
  toolBuildInJs,
  packageCompleteness
}
