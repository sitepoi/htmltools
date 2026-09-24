// ── SHARED RELEASE CONTEXT (used by release.js, generate-docs.js, init-docs.js) ──
// Collects dynamic project context from:
//   a) git (diff, commit logs, changed files since any commit ref)
//   b) every tool's SSOT (docs/ssot.html under every tool folder)
//   c) the tool ideas catalog (UNICON-TOOLS/tools-catalog/tool-ideas-catalog.json) and the
//      tool index (UNICON-TOOLS/all-tools.html)
//   d) this project's VS Code Copilot transcript (other projects' chats are
//      filtered out by project-path mentions; RELEASE_CONTEXT_FILE overrides)
//
// AI backend selection (the first available wins):
//   1) THE APP GATEWAY (recommended - same env vars the apps use):
//        UNICON_AI_GATEWAY_BASE_URL           (also loaded from .env.local / .env)
//        UNICON_AI_GATEWAY_API_KEY            (optional)
//        UNICON_AI_GATEWAY_CHAT_COMPLETE_PATH (optional, default /v1/chat/complete)
//        Default model: provider "deepseek", model "deepseek-v4-pro"
//        (override with RELEASE_AI_PROVIDER / RELEASE_AI_MODEL)
//   2) Explicit OpenAI-compatible endpoint:
//        RELEASE_AI_BASE_URL=https://api.deepseek.com
//        DEEPSEEK_API_KEY=sk-...              (RELEASE_AI_API_KEY also works)
//        RELEASE_AI_MODEL=deepseek-chat       (optional)
//   3) Local Ollama (last resort):
//        OLLAMA_HOST=http://localhost:11434   (optional)
//        RELEASE_OLLAMA_MODEL=deepseek-r1:14b (optional)

const { execSync } = require('child_process')
const { readFileSync, readdirSync, statSync } = require('fs')
const { homedir } = require('os')
const { join, relative, sep } = require('path')

const MAX_TRANSCRIPT_FILES_TO_SCAN = 30
const MAX_TRANSCRIPT_READ_CHARS = 500000
const MAX_CONVERSATION_CHARS = 12000
const MAX_RELEVANT_DECISION_ROWS = 15
const ROOT = join(__dirname, '..')
const ASSETS_DIR = join(ROOT, '_docs', 'assets')
const TEMPLATES_DIR = join(ROOT, '_docs', 'templates')
const CATALOG_PATH = join(ROOT, 'UNICON-TOOLS', 'tools-catalog', 'tool-ideas-catalog.json')
const TAXONOMY_PATH = join(ROOT, 'UNICON-TOOLS', 'tools-catalog', 'folder-hierarchy-import.json')
const ALL_TOOLS_PATH = join(ROOT, 'UNICON-TOOLS', 'all-tools.html')
const TOOL_PARTS = ['app', 'listing', 'reporting']
const SATELLITE_TYPES = ['webpage', 'help', 'presentation', 'social', 'updates']
const SATELLITE_FILES = {
  ssot: 'ssot.html',
  webpage: 'webpage.html',
  help: 'help.html',
  presentation: 'presentation.html',
  updates: 'updates.html',
  social: 'social.html',
}

const DEEPSEEK_DEFAULT_BASE_URL = 'https://api.deepseek.com'
const DEEPSEEK_DEFAULT_MODEL = 'deepseek-chat'
const APP_GATEWAY_DEFAULT_PROVIDER = 'deepseek'
const APP_GATEWAY_DEFAULT_MODEL = 'deepseek-v4-pro'

// Load the same env files the apps use (.env.local first, then .env), so
// UNICON_AI_GATEWAY_* is available without exporting it in the shell.
// Built-in loader - no npm dependencies. Shell variables always take
// precedence (process.env[key] === undefined guard). Values are never printed.
function loadEnvFileSilently(filePath) {
  let lines
  try { lines = readFileSync(filePath, 'utf8').split(/\r?\n/) } catch (_e) { return }
  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex <= 0) return
    const key = trimmed.slice(0, equalsIndex).trim()
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^(['"])([\s\S]*)\1$/, '$2')
    if (key && process.env[key] === undefined) process.env[key] = value
  })
}
loadEnvFileSilently(join(ROOT, '.env.local'))
loadEnvFileSilently(join(ROOT, '.env'))

// ── General helpers ────────────────────────────────────────────────────────
function runCommand(command, options = {}) {
  return execSync(command, { stdio: options.silent ? 'pipe' : 'inherit', encoding: 'utf8', ...options })
}

function truncateMiddle(text, maxChars) {
  if (!text || text.length <= maxChars) return text || ''
  const half = Math.floor(maxChars / 2)
  return text.slice(0, half) + '\n\n... (truncated) ...\n\n' + text.slice(-half)
}

function truncateTail(text, maxChars) {
  if (!text || text.length <= maxChars) return text || ''
  return '... (older part truncated) ...\n\n' + text.slice(-maxChars)
}

function stripHtml(htmlText) {
  return String(htmlText || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanMessage(rawMessage) {
  return String(rawMessage || '')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .trim()
}

// ── a) Git context ─────────────────────────────────────────────────────────
function getPushedCommit() {
  try {
    return runCommand('git rev-parse @{push}', { silent: true }).trim()
  } catch (_e) { return '' }
}

function getLastPushTime() {
  const pushedCommit = getPushedCommit()
  if (!pushedCommit) return ''
  try {
    return runCommand(`git show -s --format=%cI ${pushedCommit}`, { silent: true }).trim()
  } catch (_e) { return '' }
}

function getCommitTime(commitRef) {
  try {
    return runCommand(`git show -s --format=%cI ${commitRef}`, { silent: true }).trim()
  } catch (_e) { return '' }
}

function getUnpushedCommitLog() {
  const pushedCommit = getPushedCommit()
  try {
    return pushedCommit
      ? runCommand(`git log --oneline ${pushedCommit}..HEAD`, { silent: true }).trim()
      : ''
  } catch (_e) { return '' }
}

function getCommitLogSince(commitRef, maxCount = 100) {
  const range = commitRef ? `${commitRef}..HEAD` : 'HEAD'
  try {
    return runCommand(`git log -${maxCount} --pretty=format:%h %ad %s --date=short ${range}`, { silent: true }).trim()
  } catch (_e) { return '' }
}

function getChangedFileList(commitRef) {
  try {
    return commitRef
      ? runCommand(`git diff --name-status ${commitRef} -- .`, { silent: true }).trim()
      : runCommand('git diff --name-status HEAD -- .', { silent: true }).trim()
  } catch (_e) { return '' }
}

function getDiffSinceCommit(commitRef, maxChars) {
  let codeDiff = ''
  try {
    codeDiff = commitRef
      ? runCommand(`git diff ${commitRef} -- .`, { silent: true })
      : runCommand('git diff HEAD -- .', { silent: true })
  } catch (_e) { return '' }
  return truncateMiddle(codeDiff, maxChars)
}

// ── Tool discovery (taxonomy tree under BUSINESS*/PERSONAL* roots) ─────────
function findToolRootDirectories() {
  try {
    return readdirSync(ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^(BUSINESS|PERSONAL)_/.test(entry.name))
      .map((entry) => entry.name)
  } catch (_e) { return [] }
}

// Walks the taxonomy tree and returns one entry per tool that has at least
// one part folder (app / listing / reporting). Only app exists today.
function listToolParts() {
  const tools = new Map()
  findToolRootDirectories().forEach((rootDirectoryName) => {
    const rootDirectory = join(ROOT, rootDirectoryName)
    const walk = (directoryPath) => {
      let directoryEntries
      try { directoryEntries = readdirSync(directoryPath, { withFileTypes: true }) } catch (_e) { return }
      directoryEntries.forEach((entry) => {
        if (!entry.isDirectory()) return
        const entryPath = join(directoryPath, entry.name)
        if (TOOL_PARTS.includes(entry.name)) {
          // the directory CONTAINING the part folder is the tool folder
          const toolDirectory = directoryPath
          const toolName = toolDirectory.split(sep).pop()
          let tool = tools.get(toolName)
          if (!tool) {
            tool = { toolName, toolDirectory, parts: [], docsDirectory: join(toolDirectory, 'docs'), rootDirectoryName }
            tools.set(toolName, tool)
          }
          tool.parts.push(entry.name)
          return
        }
        walk(entryPath)
      })
    }
    walk(rootDirectory)
  })
  return Array.from(tools.values())
}

function findToolByName(toolName) {
  return listToolParts().find((tool) => tool.toolName === toolName) || null
}

// Relative path (forward slashes) from a tool's docs folder to _docs/assets.
function assetsRelativeFrom(docsDirectory) {
  let relativePath = relative(docsDirectory, ASSETS_DIR).replace(/\\/g, '/')
  if (!relativePath) return './'
  if (!relativePath.endsWith('/')) relativePath += '/'
  return relativePath
}

// ── b) Which tools changed in a git range ──────────────────────────────────
function toolNameFromChangedPath(changedPath) {
  const segments = changedPath.split('/')
  const partIndex = segments.findIndex((segment) => TOOL_PARTS.includes(segment))
  if (partIndex === -1) return ''
  return segments[partIndex - 1] || ''
}

function getChangedToolsSince(commitRef) {
  const toolNames = new Set()
  const lines = []
  // tracked changes since the commit ref
  getChangedFileList(commitRef).split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\S+\s+(.+)$/)
    if (match) lines.push(match[1])
  })
  // new files not tracked by git yet (first push of a new tool)
  try {
    runCommand('git ls-files --others --exclude-standard', { silent: true })
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((line) => lines.push(line))
  } catch (_e) { /* git unavailable */ }
  lines.forEach((changedPath) => {
    const toolName = toolNameFromChangedPath(changedPath)
    if (toolName) toolNames.add(toolName)
  })
  return Array.from(toolNames).map((toolName) => findToolByName(toolName)).filter(Boolean)
}

// ── c) Data sources per tool ───────────────────────────────────────────────
function readTextSnippet(filePath, maxChars) {
  let content = ''
  try { content = readFileSync(filePath, 'utf8') } catch (_e) { return '' }
  return truncateMiddle(content, maxChars)
}

// Reads the tool's code (all part folders) as one bounded text for the AI.
function getToolCodeContext(tool, maxCharsPerFile, maxCharsTotal) {
  const chunks = []
  let totalChars = 0
  tool.parts.forEach((partName) => {
    const partDirectory = join(tool.toolDirectory, partName)
    let fileEntries
    try { fileEntries = readdirSync(partDirectory, { withFileTypes: true }) } catch (_e) { return }
    fileEntries.forEach((entry) => {
      if (!entry.isFile()) return
      const extension = entry.name.split('.').pop().toLowerCase()
      if (!['html', 'css', 'js', 'json', 'txt', 'md', 'cjs'].includes(extension)) return
      const remaining = maxCharsTotal - totalChars
      if (remaining <= 0) return
      const snippet = readTextSnippet(join(partDirectory, entry.name), Math.min(maxCharsPerFile, remaining))
      if (!snippet) return
      chunks.push(`=== FILE: ${tool.toolName}/${partName}/${entry.name} ===\n${snippet}`)
      totalChars += snippet.length
    })
  })
  return chunks.join('\n\n')
}

// Reads the taxonomy nodes so a tool folder path maps to its category +
// subcategory slugs, which map to idea codes in the catalog.
function loadTaxonomyNodes() {
  let taxonomy
  try { taxonomy = JSON.parse(readFileSync(TAXONOMY_PATH, 'utf8')) } catch (_e) { return { bySlug: {} } }
  const bySlug = {}
  const register = (node) => {
    if (node.slug) bySlug[node.slug] = node
    ;(node.children || []).forEach(register)
  }
  ;(taxonomy.folders || []).forEach((rootNode) => {
    register(rootNode)
    ;(rootNode.children || []).forEach(register)
  })
  return { bySlug, taxonomy }
}

function folderBaseName(folderName) {
  // dynamic folder names look like <slug>_<apps>_of_<ideas>
  return String(folderName || '').replace(/_\d+_of_\d+$/, '')
}

function getTaxonomyContext(tool) {
  const segments = tool.toolDirectory.replace(/\\/g, '/').split('/')
  const rootIndex = segments.findIndex((segment) => /^(BUSINESS|PERSONAL)_/.test(segment))
  if (rootIndex === -1) return ''
  const parts = segments.slice(rootIndex)
  // parts: [BUSINESS_.., TYPE_.., CATEGORY_.., SUBCATEGORY_.., ToolName]
  if (parts.length < 4) return ''
  const branch = folderBaseName(parts[0]).toLowerCase() // business | personal
  const typeSlug = folderBaseName(parts[1]).toLowerCase() // general | vertical
  const categorySlug = folderBaseName(parts[2])
  const subcategorySlug = folderBaseName(parts[3])
  return [
    `Branch: ${branch.toUpperCase()}, Type: ${typeSlug.toUpperCase()}`,
    `Category folder: ${categorySlug}`,
    `Subcategory folder: ${subcategorySlug}`,
  ].join('\n')
}

function getCatalogContext(tool) {
  const contextLines = []
  let catalog
  try { catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) } catch (_e) { return '' }
  const taxonomyInfo = getTaxonomyContext(tool)
  const subcategorySlugMatch = taxonomyInfo.match(/Subcategory folder: (\S+)/)
  const subcategorySlug = subcategorySlugMatch ? subcategorySlugMatch[1] : ''
  const { bySlug } = loadTaxonomyNodes()
  const subcategoryNode = bySlug[subcategorySlug]
  const ideas = catalog.ideas || []
  const relatedIdeas = subcategoryNode
    ? ideas.filter((idea) => idea.code === subcategoryNode.code)
    : []
  if (relatedIdeas.length) {
    contextLines.push(`Tool ideas catalog (subcategory ${subcategoryNode.code}):`)
    relatedIdeas.forEach((idea) => {
      contextLines.push(
        `- ${idea.name}: ${idea.purpose}. Potential users: ${idea.users}. TAM ${idea.tam}, SAM ${idea.sam}, SOM ${idea.som}. Licensing: ${idea.licensing}.`
      )
    })
  } else if (ideas.length) {
    contextLines.push('Tool ideas catalog: no idea entry matches this tool folder directly yet.')
  }
  if (contextLines.length) contextLines.push('(Catalog numbers are directional planning estimates, not market research.)')
  return contextLines.join('\n')
}

function getAllToolsEntry(tool) {
  let indexContent
  try { indexContent = readFileSync(ALL_TOOLS_PATH, 'utf8') } catch (_e) { return null }
  const toolPattern = /name:\s*'([^']*)',\s*folder:\s*'([^']*)',\s*asTool:\s*'([^']*)',\s*inApp:\s*'([^']*)',\s*note:\s*'([^']*)'/g
  let match
  while ((match = toolPattern.exec(indexContent)) !== null) {
    if (match[2].replace(/\/+$/, '').endsWith('/' + tool.toolName)) {
      return {
        displayName: match[1],
        folder: match[2],
        asTool: match[3],
        inApp: match[4],
        note: match[5],
      }
    }
  }
  return null
}

function getToolSsotText(tool, maxChars) {
  const ssotPath = join(tool.docsDirectory, SATELLITE_FILES.ssot)
  return stripHtml(readTextSnippet(ssotPath, maxChars))
}

function getToolUpdatesText(tool, maxChars) {
  const updatesPath = join(tool.docsDirectory, SATELLITE_FILES.updates)
  return stripHtml(readTextSnippet(updatesPath, maxChars))
}

// ── d) SSOT decision registers and risks ───────────────────────────────────
function stripHtmlComments(content) {
  return String(content || '').replace(/<!--[\s\S]*?-->/g, ' ')
}

function listToolSsotDocuments() {
  return listToolParts()
    .map((tool) => ({ name: tool.toolName, path: join(tool.docsDirectory, SATELLITE_FILES.ssot) }))
    .filter((document) => {
      try { statSync(document.path); return true } catch (_e) { return false }
    })
}

function parseDecisionRows(documentContent, documentName) {
  const visibleContent = stripHtmlComments(documentContent)
  const decisionRows = []
  const rowPattern = /<tr>\s*<td>(D-[A-Z]+-\d+)<\/td><td>([^<]*)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<\/tr>/g
  let rowMatch
  while ((rowMatch = rowPattern.exec(visibleContent)) !== null) {
    decisionRows.push({
      id: rowMatch[1],
      date: rowMatch[2].trim(),
      decision: stripHtml(rowMatch[3]),
      rationale: stripHtml(rowMatch[4]),
      status: rowMatch[5].trim(),
      documentName,
    })
  }
  return decisionRows
}

function getDecisionIdsAddedToDocumentSinceCommit(documentPath, commitRef) {
  const addedDecisionIds = new Set()
  if (!commitRef) return addedDecisionIds
  let documentDiff
  try {
    documentDiff = runCommand(`git diff ${commitRef} -- "${documentPath}"`, { silent: true })
  } catch (_e) { return addedDecisionIds }
  for (const line of documentDiff.split(/\r?\n/)) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue
    for (const match of line.matchAll(/D-[A-Z]+-\d+/g)) addedDecisionIds.add(match[0])
  }
  return addedDecisionIds
}

function getOpenRisksFromSsotDocuments() {
  const openRisks = []
  for (const document of listToolSsotDocuments()) {
    let documentContent
    try { documentContent = stripHtmlComments(readFileSync(document.path, 'utf8')) } catch (_e) { continue }
    const riskItemPattern = /<div class="risk-item"[^>]*>/g
    let riskMatch
    while ((riskMatch = riskItemPattern.exec(documentContent)) !== null) {
      const blockStart = riskMatch.index
      const blockEnd = documentContent.indexOf('</details>', blockStart)
      const block = documentContent.slice(blockStart, blockEnd === -1 ? blockStart + 2000 : blockEnd)
      const idMatch = block.match(/data-risk-id="([^"]+)"/)
      const statusMatch = block.match(/data-risk-status="([^"]+)"/)
      const levelMatch = block.match(/data-risk-level="([^"]+)"/)
      const solvedCheckboxMatch = block.match(/class="risk-solved-checkbox"[^>]*checked/)
      const titleMatch = block.match(/class="risk-title">([^<]+)/)
      const status = statusMatch ? statusMatch[1] : 'open'
      const isSolved = Boolean(solvedCheckboxMatch)
      if (!isSolved && status !== 'accepted' && status !== 'solved') {
        openRisks.push({
          documentName: document.name,
          riskId: idMatch ? idMatch[1] : 'unknown',
          riskTitle: titleMatch ? titleMatch[1].trim() : '(unnamed risk)',
          level: levelMatch ? levelMatch[1] : 'medium',
        })
      }
    }
  }
  return openRisks
}

// ── e) Latest AI discussion (this project's chats only) ────────────────────
function getProjectSearchTokens() {
  const projectPath = process.cwd().replace(/\\/g, '/').toLowerCase()
  const tokens = [projectPath]
  const projectBaseName = projectPath.split('/').pop() || ''
  if (projectBaseName) tokens.push(projectBaseName)
  const encodedDrivePath = projectPath.replace(/^([a-z]):/, '$1%3A')
  tokens.push('file:///' + encodedDrivePath, encodedDrivePath)
  return tokens
}

function listAllTranscriptFiles() {
  const workspaceStorageDir = join(homedir(), 'AppData', 'Roaming', 'Code', 'User', 'workspaceStorage')
  const transcriptFiles = []
  try {
    for (const workspaceEntry of readdirSync(workspaceStorageDir, { withFileTypes: true })) {
      if (!workspaceEntry.isDirectory()) continue
      const transcriptsDir = join(workspaceStorageDir, workspaceEntry.name, 'GitHub.copilot-chat', 'transcripts')
      let directoryEntries
      try { directoryEntries = readdirSync(transcriptsDir) } catch (_e) { continue }
      for (const fileName of directoryEntries) {
        if (!fileName.endsWith('.jsonl')) continue
        const filePath = join(transcriptsDir, fileName)
        let modifiedTimeMs = 0
        try { modifiedTimeMs = statSync(filePath).mtimeMs } catch (_e) { /* ignore */ }
        transcriptFiles.push({ filePath, modifiedTimeMs })
      }
    }
  } catch (_e) { /* no transcripts at all */ }
  transcriptFiles.sort((a, b) => b.modifiedTimeMs - a.modifiedTimeMs)
  return transcriptFiles.slice(0, MAX_TRANSCRIPT_FILES_TO_SCAN)
}

function countProjectMentionsInTranscript({ filePath, searchTokens }) {
  let projectMentionCount = 0
  try {
    const transcriptContent = readFileSync(filePath, 'utf8').slice(0, MAX_TRANSCRIPT_READ_CHARS).toLowerCase()
    for (const token of searchTokens) {
      let foundAtIndex = 0
      while ((foundAtIndex = transcriptContent.indexOf(token, foundAtIndex)) !== -1) {
        projectMentionCount++
        foundAtIndex += token.length
      }
    }
  } catch (_e) { /* ignore unreadable transcript */ }
  return projectMentionCount
}

function selectProjectTranscript() {
  const transcriptFiles = listAllTranscriptFiles()
  if (transcriptFiles.length === 0) return { filePath: null, reason: 'no transcripts found' }
  const searchTokens = getProjectSearchTokens()
  let bestFile = transcriptFiles[0]
  let bestScore = 0
  for (const transcriptFile of transcriptFiles) {
    const projectMentionCount = countProjectMentionsInTranscript({ filePath: transcriptFile.filePath, searchTokens })
    if (projectMentionCount > bestScore) {
      bestScore = projectMentionCount
      bestFile = transcriptFile
    }
  }
  if (bestScore === 0) {
    return { filePath: transcriptFiles[0].filePath, reason: 'fallback: no transcript mentions this project, using the newest one' }
  }
  return { filePath: bestFile.filePath, reason: `matched this project (${bestScore} project-path mentions)` }
}

function extractTranscriptMessages(transcriptFilePath, sinceTime) {
  let transcriptLines
  try {
    transcriptLines = readFileSync(transcriptFilePath, 'utf8').split(/\r?\n/)
  } catch (_e) { return '' }

  const messages = []
  for (const line of transcriptLines) {
    if (!line.trim()) continue
    let entry
    try { entry = JSON.parse(line) } catch (_e) { continue }
    const timestamp = entry?.timestamp || ''
    if (sinceTime && timestamp && timestamp < sinceTime) continue
    const content = entry?.data?.content
    if (entry?.type === 'user.message' && typeof content === 'string') {
      messages.push('User: ' + content.replace(/\s+/g, ' ').trim())
    } else if (entry?.type === 'assistant.message' && typeof content === 'string' && content.trim()) {
      messages.push('Assistant: ' + content.replace(/\s+/g, ' ').trim())
    }
  }
  return messages.join('\n\n')
}

function getConversationContext({ sinceTime = '', maxChars = MAX_CONVERSATION_CHARS } = {}) {
  const effectiveSinceTime = sinceTime || getLastPushTime()
  let transcriptFilePath = process.env.RELEASE_CONTEXT_FILE
  let selectionReason = 'RELEASE_CONTEXT_FILE override'
  if (!transcriptFilePath) {
    const selection = selectProjectTranscript()
    transcriptFilePath = selection.filePath
    selectionReason = selection.reason
  }
  if (!transcriptFilePath) {
    console.log('→ No Copilot transcript found; skipping AI discussion context.')
    return ''
  }
  console.log(`→ Conversation source: ${truncateMiddle(transcriptFilePath, 100)} (${selectionReason})`)
  const extracted = extractTranscriptMessages(transcriptFilePath, effectiveSinceTime)
  return truncateTail(extracted, maxChars)
}

// ── AI backends ────────────────────────────────────────────────────────────
function extractTextFromGatewayResponse(data) {
  if (typeof data === 'string') return data
  const value = data || {}
  return value.outputText || value.output_text || value.text || value.answer || value.message
    || value.choices?.[0]?.message?.content
    || value.result?.assistant?.markdown
    || value.result?.message
    || value.result?.choices?.[0]?.message?.content
    || ''
}

async function askAppGateway({ prompt, baseUrl, apiKey, provider, model }) {
  const completePath = process.env.UNICON_AI_GATEWAY_CHAT_COMPLETE_PATH || '/v1/chat/complete'
  const normalizedBase = String(baseUrl || '').replace(/\/$/, '')
  const gatewayUrl = normalizedBase + (completePath.startsWith('/') ? completePath : '/' + completePath)
  const headers = {
    'Content-Type': 'application/json',
    'X-Unicon-Source': 'htmlbasedtools-automation',
  }
  if (apiKey) {
    headers['X-Api-Key'] = apiKey
    headers['Authorization'] = `Bearer ${apiKey}`
  }
  const abortController = new AbortController()
  const abortTimer = setTimeout(() => abortController.abort(), 180000)
  let response
  try {
    response = await fetch(gatewayUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ provider, model, messages: [{ role: 'user', content: prompt }] }),
      signal: abortController.signal,
    })
  } finally {
    clearTimeout(abortTimer)
  }
  if (!response.ok) {
    let errorData = {}
    try { errorData = await response.json() } catch (_e) { /* ignore */ }
    const errorDetail = errorData?.error?.message || errorData?.error || errorData?.details || errorData?.message || `HTTP ${response.status}`
    throw new Error(`AI gateway returned ${response.status}: ${String(errorDetail).slice(0, 200)}`)
  }
  const data = await response.json()
  return extractTextFromGatewayResponse(data)
}

async function askOpenAiCompatible({ prompt, baseUrl, apiKey, model }) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    }),
  })
  if (!response.ok) {
    throw new Error(`AI endpoint returned ${response.status}: ${(await response.text()).slice(0, 200)}`)
  }
  const data = await response.json()
  return data?.choices?.[0]?.message?.content || ''
}

async function askOllama({ prompt, host, model }) {
  const abortController = new AbortController()
  const abortTimer = setTimeout(() => abortController.abort(), 15000)
  let response
  try {
    response = await fetch(`${host.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
      signal: abortController.signal,
    })
  } finally {
    clearTimeout(abortTimer)
  }
  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}: ${(await response.text()).slice(0, 200)}`)
  }
  const data = await response.json()
  return data?.message?.content || ''
}

// Generic AI call; tries each backend in order.
async function getAiResponse(prompt) {
  const appGatewayBaseUrl = process.env.UNICON_AI_GATEWAY_BASE_URL || ''
  if (appGatewayBaseUrl) {
    const gatewayProvider = process.env.RELEASE_AI_PROVIDER || APP_GATEWAY_DEFAULT_PROVIDER
    const gatewayModel = process.env.RELEASE_AI_MODEL || APP_GATEWAY_DEFAULT_MODEL
    console.log(`→ Using the app's AI gateway (provider ${gatewayProvider}, model ${gatewayModel})...`)
    try {
      return await askAppGateway({
        prompt,
        baseUrl: appGatewayBaseUrl,
        apiKey: process.env.UNICON_AI_GATEWAY_API_KEY || '',
        provider: gatewayProvider,
        model: gatewayModel,
      })
    } catch (gatewayError) {
      console.log(`→ App gateway failed (${gatewayError?.message || gatewayError}); trying the next backend...`)
    }
  }
  const explicitBaseUrl = process.env.RELEASE_AI_BASE_URL
  const explicitApiKey = process.env.RELEASE_AI_API_KEY || process.env.DEEPSEEK_API_KEY || ''
  if (explicitBaseUrl || explicitApiKey) {
    return askOpenAiCompatible({
      prompt,
      baseUrl: explicitBaseUrl || DEEPSEEK_DEFAULT_BASE_URL,
      apiKey: explicitApiKey,
      model: process.env.RELEASE_AI_MODEL || DEEPSEEK_DEFAULT_MODEL,
    })
  }
  console.log('→ No AI gateway or API key configured - falling back to local Ollama.')
  return askOllama({
    prompt,
    host: process.env.OLLAMA_HOST || 'http://localhost:11434',
    model: process.env.RELEASE_OLLAMA_MODEL || 'deepseek-r1:14b',
  })
}

// ── Naming helpers shared by the doc scripts ───────────────────────────────
function toDisplayName(toolName) {
  return String(toolName || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim()
}

function toDecisionPrefix(toolName) {
  const upperLetters = String(toolName || '').replace(/[^A-Z]/g, '')
  const initials = upperLetters.length >= 4
    ? upperLetters.slice(0, 4)
    : upperLetters || String(toolName).replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()
  return 'D-' + (initials || 'TOOL').slice(0, 4)
}

function toKebabClass(toolName) {
  return String(toolName || 'tool')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .replace(/^-+|-+$/g, '')
}

module.exports = {
  ROOT,
  ASSETS_DIR,
  TEMPLATES_DIR,
  TOOL_PARTS,
  SATELLITE_TYPES,
  SATELLITE_FILES,
  runCommand,
  truncateMiddle,
  truncateTail,
  stripHtml,
  cleanMessage,
  getPushedCommit,
  getLastPushTime,
  getCommitTime,
  getUnpushedCommitLog,
  getCommitLogSince,
  getChangedFileList,
  getDiffSinceCommit,
  listToolParts,
  findToolByName,
  assetsRelativeFrom,
  getChangedToolsSince,
  getToolCodeContext,
  getTaxonomyContext,
  getCatalogContext,
  getAllToolsEntry,
  getToolSsotText,
  getToolUpdatesText,
  listToolSsotDocuments,
  parseDecisionRows,
  stripHtmlComments,
  getDecisionIdsAddedToDocumentSinceCommit,
  getOpenRisksFromSsotDocuments,
  getConversationContext,
  getAiResponse,
  toDisplayName,
  toDecisionPrefix,
  toKebabClass,
}
