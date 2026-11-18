'use strict'

// Repository workspace - the read side of Studio (SSOT 8.12).
//
// The dashboard is a local process running as the user, so it can read the
// repository. A page inside the CMS cannot: it is a sandboxed iframe and may
// only use the object API and the fetch relay. That is the whole reason this
// module exists - it is the ONLY place that touches the file system for the
// studio, and it is read only.
//
// Every path is resolved inside the repository root. Bounds are hard:
// a directory listing stops at MAX_TREE_ENTRIES, a file read stops at
// MAX_FILE_BYTES, a search stops at MAX_SEARCH_HITS and never reads more than
// MAX_SEARCH_FILES files. Nothing here writes, deletes or follows a link out.

const fs = require('fs')
const path = require('path')

const { REPOSITORY_ROOT, loadConfig } = require('./config')
const toolRoots = require('./toolRoots')

const SKIP_DIRECTORIES = new Set([
  '.git',
  '.vscode',
  '.idea',
  'node_modules',
  'selftest-output',
  'ship-out'
])

const TEXT_EXTENSIONS = new Set([
  '.html', '.htm', '.css', '.js', '.cjs', '.mjs', '.json', '.md', '.txt',
  '.xml', '.svg', '.yml', '.yaml', '.csv', '.ts', '.py', '.ps1', '.sh',
  '.bat', '.cmd', '.ini', '.cfg', '.log', '.map'
])

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.pdf', '.zip',
  '.gz', '.7z', '.pptx', '.docx', '.xlsx', '.woff', '.woff2', '.ttf', '.otf',
  '.mp4', '.mp3', '.wav', '.exe', '.dll', '.onnx', '.bin', '.sqlite'
])

const MAX_TREE_ENTRIES = 500
const MAX_FILE_BYTES = 1024 * 1024
const MAX_SEARCH_FILES = 3000
const MAX_SEARCH_HITS = 200
const MAX_SEARCH_BYTES_PER_FILE = 300 * 1024
const MAX_SEARCH_QUERY_LENGTH = 120
const MAX_SNIPPET = 200
const MAX_ASSET_BYTES = 8 * 1024 * 1024
const MAX_SSOT_BYTES = 4 * 1024 * 1024

// What /repo/ may hand to an iframe, so a preview renders with its own CSS,
// JS and images instead of a broken relative path.
const ASSET_MIME = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/plain'
}
// Never served, even to a local preview: the token file, and the folders that
// hold run transcripts, backups and third party code.
const ASSET_DENY_NAMES = new Set(['config.local.json', '.unicon-secrets.json'])
const ASSET_DENY_SEGMENTS = new Set(['.git', 'node_modules', 'runs', 'selftest-output', '.vscode'])

function repoRoot() {
  return REPOSITORY_ROOT
}

// Rejects absolute paths and any attempt to climb out of the repository before
// the file system is touched at all.
function normalizeRelative(relativePath) {
  const raw = String(relativePath == null ? '' : relativePath).trim().replace(/\\/g, '/')
  if (!raw || raw === '.' || raw === '/') return { ok: true, relativePath: '' }
  if (/^[a-zA-Z]:/.test(raw) || raw.startsWith('/')) {
    return { ok: false, reason: 'Use a repository relative path, not an absolute path.' }
  }
  const pieces = raw.split('/')
  if (pieces.some((piece) => piece === '..')) {
    return { ok: false, reason: 'A path may not go up out of the repository.' }
  }
  const cleaned = pieces.filter((piece) => piece && piece !== '.').join('/')
  return { ok: true, relativePath: cleaned }
}

function resolveInsideRepository(relativePath) {
  const normalized = normalizeRelative(relativePath)
  if (!normalized.ok) return normalized
  const root = repoRoot()
  const absolutePath = normalized.relativePath ? path.resolve(root, normalized.relativePath) : root
  const rootWithSeparator = root.endsWith(path.sep) ? root : root + path.sep
  const compare = (value) => (process.platform === 'win32' ? value.toLowerCase() : value)
  const comparableTarget = compare(absolutePath)
  const comparableRoot = compare(rootWithSeparator)
  const isRoot = comparableTarget === comparableRoot.slice(0, -1)
  if (!isRoot && !comparableTarget.startsWith(comparableRoot)) {
    return { ok: false, reason: 'That path is outside the repository.' }
  }
  return { ok: true, absolutePath, relativePath: normalized.relativePath }
}

function extensionOf(fileName) {
  return path.extname(String(fileName || '')).toLowerCase()
}

function isSkippedDirectory(directoryName, options) {
  if (!SKIP_DIRECTORIES.has(directoryName)) return false
  return !(options && options.includeSkipped === true)
}

function isToolDirectory(absolutePath) {
  try {
    const appDirectory = path.join(absolutePath, 'app')
    return fs.statSync(appDirectory).isDirectory()
  } catch (error) {
    return false
  }
}

// One level at a time, directories first. The studio expands as the user
// walks, so a huge folder never turns into one giant response.
function listDirectory(relativePath, options) {
  const settings = options || {}
  const resolved = resolveInsideRepository(relativePath)
  if (!resolved.ok) return { ok: false, reason: resolved.reason }
  let entries
  try {
    entries = fs.readdirSync(resolved.absolutePath, { withFileTypes: true })
  } catch (error) {
    return { ok: false, reason: error.code === 'ENOENT' ? 'That folder does not exist.' : error.message }
  }
  const directories = []
  const files = []
  entries.forEach((entry) => {
    if (entry.isDirectory()) {
      if (isSkippedDirectory(entry.name, settings)) return
      const childRelative = resolved.relativePath ? resolved.relativePath + '/' + entry.name : entry.name
      const childAbsolute = path.join(resolved.absolutePath, entry.name)
      directories.push({
        name: entry.name,
        path: childRelative,
        type: 'dir',
        tool: isToolDirectory(childAbsolute)
      })
      return
    }
    if (!entry.isFile()) return
    let size = 0
    try { size = fs.statSync(path.join(resolved.absolutePath, entry.name)).size } catch (error) { size = 0 }
    files.push({
      name: entry.name,
      path: resolved.relativePath ? resolved.relativePath + '/' + entry.name : entry.name,
      type: 'file',
      size,
      extension: extensionOf(entry.name),
      text: TEXT_EXTENSIONS.has(extensionOf(entry.name))
    })
  })
  directories.sort((left, right) => left.name.localeCompare(right.name))
  files.sort((left, right) => left.name.localeCompare(right.name))
  const all = directories.concat(files)
  const truncated = all.length > MAX_TREE_ENTRIES
  return {
    ok: true,
    path: resolved.relativePath,
    parent: resolved.relativePath ? path.posix.dirname(resolved.relativePath).replace(/^\.$/, '') : '',
    entries: all.slice(0, MAX_TREE_ENTRIES),
    total: all.length,
    truncated
  }
}

function looksBinary(buffer) {
  const window = buffer.subarray(0, Math.min(buffer.length, 4096))
  for (let index = 0; index < window.length; index++) {
    if (window[index] === 0) return true
  }
  return false
}

// Text files only, capped. A binary file is refused with a reason instead of
// turning into megabytes of replacement characters in the browser.
function readTextFile(relativePath, options) {
  const settings = options || {}
  const maxBytes = Number(settings.maxBytes) > 0 ? Number(settings.maxBytes) : MAX_FILE_BYTES
  const resolved = resolveInsideRepository(relativePath)
  if (!resolved.ok) return { ok: false, reason: resolved.reason }
  if (!resolved.relativePath) return { ok: false, reason: 'Name a file, not the repository root.' }
  let stats
  try {
    stats = fs.statSync(resolved.absolutePath)
  } catch (error) {
    return { ok: false, reason: error.code === 'ENOENT' ? 'That file does not exist.' : error.message }
  }
  if (stats.isDirectory()) return { ok: false, reason: 'That path is a folder.' }
  const extension = extensionOf(resolved.relativePath)
  if (BINARY_EXTENSIONS.has(extension)) {
    return { ok: false, reason: 'That is a binary file (' + extension + '). Studio reads text only.', binary: true, bytes: stats.size }
  }
  // The read gate is the same as the preview gate: the token file is never
  // readable through Studio, not even by a script in a preview iframe.
  const segments = resolved.relativePath.split('/')
  const fileName = segments[segments.length - 1]
  if (ASSET_DENY_NAMES.has(fileName) || fileName.indexOf('.env') === 0 || segments.some((segment) => ASSET_DENY_SEGMENTS.has(segment))) {
    return { ok: false, reason: 'That file is not readable from Studio.' }
  }
  if (stats.size > maxBytes) {
    return {
      ok: false,
      reason: 'That file is ' + Math.round(stats.size / 1024) + ' KB, over the ' + Math.round(maxBytes / 1024) + ' KB limit.',
      bytes: stats.size,
      tooLarge: true
    }
  }
  let buffer
  try {
    buffer = fs.readFileSync(resolved.absolutePath)
  } catch (error) {
    return { ok: false, reason: error.message }
  }
  if (looksBinary(buffer)) {
    return { ok: false, reason: 'That file contains binary data.', binary: true, bytes: stats.size }
  }
  const text = buffer.toString('utf8')
  return {
    ok: true,
    path: resolved.relativePath,
    text,
    bytes: stats.size,
    lines: text ? text.split('\n').length : 0,
    modifiedAt: stats.mtime.toISOString(),
    extension
  }
}

function collectSearchFiles(directoryPath, collected, options) {
  if (collected.length >= MAX_SEARCH_FILES) return
  let entries
  try {
    entries = fs.readdirSync(directoryPath, { withFileTypes: true })
  } catch (error) {
    return
  }
  for (const entry of entries) {
    if (collected.length >= MAX_SEARCH_FILES) return
    if (entry.isDirectory()) {
      if (isSkippedDirectory(entry.name, options)) continue
      collectSearchFiles(path.join(directoryPath, entry.name), collected, options)
      continue
    }
    if (!entry.isFile()) continue
    const extension = extensionOf(entry.name)
    if (!TEXT_EXTENSIONS.has(extension)) continue
    collected.push(path.join(directoryPath, entry.name))
  }
}

// Literal, case insensitive search across text files. No regex, so a stray
// character in the box can never turn into a runaway pattern.
function searchText(query, options) {
  const settings = options || {}
  const wanted = String(query == null ? '' : query).trim()
  if (!wanted) return { ok: false, reason: 'Type something to search for.' }
  if (wanted.length > MAX_SEARCH_QUERY_LENGTH) {
    return { ok: false, reason: 'Keep the search under ' + MAX_SEARCH_QUERY_LENGTH + ' characters.' }
  }
  const scope = resolveInsideRepository(settings.path || '')
  if (!scope.ok) return { ok: false, reason: scope.reason }
  const needle = wanted.toLowerCase()
  const files = []
  collectSearchFiles(scope.absolutePath, files, settings)
  const hits = []
  let scanned = 0
  for (const filePath of files) {
    if (hits.length >= MAX_SEARCH_HITS) break
    let stats
    try { stats = fs.statSync(filePath) } catch (error) { continue }
    if (stats.size > MAX_SEARCH_BYTES_PER_FILE) continue
    let text
    try { text = fs.readFileSync(filePath, 'utf8') } catch (error) { continue }
    if (looksBinary(Buffer.from(text.slice(0, 512), 'utf8'))) continue
    scanned += 1
    const lines = text.split('\n')
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      if (hits.length >= MAX_SEARCH_HITS) break
      const lineText = lines[lineIndex]
      if (lineText.toLowerCase().indexOf(needle) === -1) continue
      hits.push({
        path: path.relative(repoRoot(), filePath).replace(/\\/g, '/'),
        line: lineIndex + 1,
        text: lineText.trim().slice(0, MAX_SNIPPET)
      })
    }
  }
  return {
    ok: true,
    query: wanted,
    hits,
    scanned,
    filesConsidered: files.length,
    truncated: hits.length >= MAX_SEARCH_HITS
  }
}

// The store's publish ledger, read from the generated catalog bundle. Missing
// is fine: the registry then reports "publish unknown" instead of guessing.
function loadPublishLedger() {
  const bundlePath = path.join(repoRoot(), 'UNICON-TOOLS', 'tools-catalog', 'tool-catalog-bundle.json')
  try {
    const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'))
    const tools = (bundle.publish && bundle.publish.tools) || {}
    return { ok: true, path: 'UNICON-TOOLS/tools-catalog/tool-catalog-bundle.json', subjects: bundle.subjects || [], tools, generatedAt: bundle.generatedAt || '' }
  } catch (error) {
    return { ok: false, path: 'UNICON-TOOLS/tools-catalog/tool-catalog-bundle.json', subjects: [], tools: {}, reason: error.message }
  }
}

function publishedSubjectsOf(ledger, folder) {
  const row = (ledger.tools && ledger.tools[folder]) || null
  if (!row || !row.subjects) return { present: [], total: 8, complete: 0 }
  const present = Object.keys(row.subjects).filter((key) => row.subjects[key] === true)
  return { present, total: 8, complete: present.length, version: row.version || '', publishedAt: row.publishedAt || '' }
}

const DOCUMENT_SUBJECTS = ['webpage', 'help', 'presentation', 'updates', 'social'];

// A single derived label per tool, so the studio can sort and filter without
// re-deriving in the browser. packageCompleteness returns a boolean, so the
// count of present subjects is what the label is built from.
//   draft        nothing built yet
//   in-progress  some of the eight subjects exist
//   documented   code, harness and all five documents (7 of 8: screenshots missing)
//   ready        all eight subjects exist locally
//   published    the store ledger says all eight are published
function toolStatusOf(presentSubjects, publishState, tool) {
  if (publishState.complete >= publishState.total) return 'published'
  const documented = DOCUMENT_SUBJECTS.every((kind) => presentSubjects.indexOf(kind) !== -1)
  const packaged = presentSubjects.indexOf('code') !== -1 && presentSubjects.indexOf('harness') !== -1
  if (documented && packaged && presentSubjects.length >= 8) return 'ready'
  if (documented && packaged) return 'documented'
  if (tool.toolBuild || presentSubjects.length > 2) return 'in-progress';
  return 'draft'
}

function toolRegistry(options) {
  const settings = options || {}
  const config = settings.config || loadConfig()
  const listing = toolRoots.listTools(config)
  const ledger = loadPublishLedger()
  const tools = listing.tools.map((tool) => {
    const packageState = toolRoots.packageCompleteness(tool)
    const publishState = publishedSubjectsOf(ledger, tool.folderName)
    const segments = String(tool.relativePath || '').split('/')
    return {
      slug: tool.slug,
      folderName: tool.folderName,
      toolName: tool.toolName,
      group: segments.length > 1 ? segments[0] : '(root)',
      trail: segments.slice(0, -1).join(' / '),
      relativePath: tool.relativePath,
      path: tool.path,
      root: tool.root,
      writable: tool.writable,
      toolBuild: tool.toolBuild,
      stamps: tool.stamps,
      harness: Boolean(tool.harness),
      documents: tool.documents,
      documentsMissing: tool.documentsMissing,
      screenshotCount: tool.screenshotCount,
      modifiedAt: tool.modifiedAt,
      package: packageState,
      publish: publishState,
      status: toolStatusOf(packageState.present || [], publishState, tool)
    }
  })
  const byGroup = {}
  tools.forEach((tool) => {
    if (!byGroup[tool.group]) byGroup[tool.group] = { group: tool.group, tools: 0, documented: 0, ready: 0, published: 0 }
    byGroup[tool.group].tools += 1
    if (tool.status === 'documented') byGroup[tool.group].documented += 1
    if (tool.status === 'ready') byGroup[tool.group].ready += 1
    if (tool.status === 'published') byGroup[tool.group].published += 1
  })
  return {
    ok: true,
    repoRoot: repoRoot(),
    tools,
    total: tools.length,
    groups: Object.keys(byGroup).sort().map((key) => byGroup[key]),
    problems: listing.problems,
    ledger: { ok: ledger.ok, path: ledger.path, generatedAt: ledger.generatedAt, reason: ledger.reason || '' },
    roots: listing.roots
  }
}

// A file handed to the preview iframe. Same jail as everywhere else, plus a
// denylist for the token file and the folders that are nobody's business.
function resolveRepoAsset(relativePath) {
  const resolved = resolveInsideRepository(relativePath)
  if (!resolved.ok) return resolved
  if (!resolved.relativePath) return { ok: false, reason: 'Name a file to preview.' }
  const segments = resolved.relativePath.split('/')
  if (segments.some((segment) => ASSET_DENY_SEGMENTS.has(segment))) {
    return { ok: false, reason: 'That folder is not served.' }
  }
  const name = segments[segments.length - 1]
  if (ASSET_DENY_NAMES.has(name) || name.indexOf('.env') === 0) {
    return { ok: false, reason: 'That file is not served.' }
  }
  let stats
  try {
    stats = fs.statSync(resolved.absolutePath)
  } catch (error) {
    return { ok: false, reason: 'That file does not exist.' }
  }
  if (!stats.isFile()) return { ok: false, reason: 'That path is not a file.' }
  if (stats.size > MAX_ASSET_BYTES) return { ok: false, reason: 'That file is too large to preview.' }
  const extension = extensionOf(name)
  const contentType = ASSET_MIME[extension]
  if (!contentType) return { ok: false, reason: 'That file type is not served (' + extension + ').' }
  return {
    ok: true,
    absolutePath: resolved.absolutePath,
    relativePath: resolved.relativePath,
    contentType,
    bytes: stats.size
  }
}

function stripTags(htmlText) {
  return String(htmlText == null ? '' : htmlText)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

// The SSOT task list is the real backlog (section 15). It is HTML, so it is
// read with a small, tolerant parse: data-task-id marks a task, the title,
// status, points and priority are optional decorations around it.
function parseSsotTasks(htmlText) {
  const text = String(htmlText == null ? '' : htmlText)
  const chunks = text.split('<div class="task-item"')
  const tasks = []
  const seen = {}
  for (let index = 1; index < chunks.length; index++) {
    const chunk = chunks[index]
    const idMatch = chunk.match(/data-task-id="([^"]+)"/)
    if (!idMatch) continue
    const id = idMatch[1].trim()
    const groupMatch = chunk.match(/data-group="([^"]+)"/)
    const statusMatch = chunk.match(/data-task-status="([^"]+)"/)
    const titleMatch = chunk.match(/class="task-title"[^>]*>([\s\S]*?)<\/span>/)
    const priorityMatch = chunk.match(/class="task-priority[^"]*"[^>]*>([\s\S]*?)<\/span>/)
    const pointsMatch = chunk.match(/<strong>Points:<\/strong>\s*([^<]*)/)
    const checked = /class="task-done-checkbox"[^>]*checked/.test(chunk)
    let status = statusMatch ? statusMatch[1].trim().toLowerCase() : (checked ? 'done' : 'not-started')
    if (checked && status !== 'done') status = 'done'
    let points = null
    let pointsOf = null
    if (pointsMatch) {
      const numbers = pointsMatch[1].match(/(\d+)\s*(?:of|\/)\s*(\d+)/)
      if (numbers) {
        points = Number(numbers[1])
        pointsOf = Number(numbers[2])
      } else {
        const single = pointsMatch[1].match(/(\d+)/)
        if (single) points = Number(single[1])
      }
    }
    const key = seen[id] ? id + '#' + (seen[id] + 1) : id
    seen[id] = (seen[id] || 0) + 1
    tasks.push({
      key,
      id,
      group: groupMatch ? groupMatch[1].trim() : '',
      title: titleMatch ? stripTags(titleMatch[1]) : '',
      status,
      done: status === 'done',
      ignored: status === 'ignored',
      points,
      pointsOf,
      priority: priorityMatch ? stripTags(priorityMatch[1]) : ''
    })
  }
  return tasks
}

function summarizeTasks(tasks) {
  const counts = { total: tasks.length, done: 0, open: 0, ignored: 0, inProgress: 0, pointsDone: 0, pointsTotal: 0 }
  tasks.forEach((task) => {
    if (task.done) counts.done += 1
    else if (task.ignored) counts.ignored += 1
    else counts.open += 1
    if (task.status === 'in-progress') counts.inProgress += 1
    if (task.done && task.points) counts.pointsDone += task.points
    if (task.points) counts.pointsTotal += task.points
  })
  return counts
}

// The backlog of one tool, read from <tool>/docs/ssot.html.
function readToolTasks(toolRelativePath) {
  const resolved = resolveInsideRepository(toolRelativePath)
  if (!resolved.ok) return { ok: false, reason: resolved.reason }
  if (!resolved.relativePath) return { ok: false, reason: 'Name a tool folder.' }
  const fileRelative = resolved.relativePath.replace(/\/+$/, '') + '/docs/ssot.html'
  const fileResolved = resolveInsideRepository(fileRelative)
  if (!fileResolved.ok) return { ok: false, reason: fileResolved.reason }
  let stats
  try {
    stats = fs.statSync(fileResolved.absolutePath)
  } catch (error) {
    return { ok: false, reason: 'This tool has no docs/ssot.html.', file: fileRelative }
  }
  if (stats.size > MAX_SSOT_BYTES) {
    return { ok: false, reason: 'The SSOT is larger than ' + Math.round(MAX_SSOT_BYTES / 1024 / 1024) + ' MB.', file: fileRelative }
  }
  let text
  try {
    text = fs.readFileSync(fileResolved.absolutePath, 'utf8')
  } catch (error) {
    return { ok: false, reason: error.message, file: fileRelative }
  }
  const tasks = parseSsotTasks(text)
  return {
    ok: true,
    toolPath: resolved.relativePath,
    tool: resolved.relativePath.split('/').pop(),
    file: fileRelative,
    bytes: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    tasks,
    counts: summarizeTasks(tasks)
  }
}

module.exports = {
  MAX_TREE_ENTRIES,
  MAX_FILE_BYTES,
  MAX_SEARCH_FILES,
  MAX_SEARCH_HITS,
  repoRoot,
  normalizeRelative,
  resolveInsideRepository,
  resolveRepoAsset,
  listDirectory,
  readTextFile,
  searchText,
  loadPublishLedger,
  parseSsotTasks,
  readToolTasks,
  toolRegistry
}
