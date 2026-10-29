'use strict'

// Read only tools the model can ask for while it works on a task, the same way
// an editor agent inspects a repository before writing a patch. Everything is
// bounded and strictly inside the run tool folder: there is no write tool, no
// shell, and no path outside the root.

const { runProbe, PROBES } = require('../agent/probes')

const MAX_LISTED_FILES = 200
const MAX_READ_LINES = 200
const MAX_OUTPUT_CHARS = 8000
const MAX_SEARCH_MATCHES = 40

const TOOL_NAMES = ['list_files', 'read_file', 'search_text', 'run_probe']

function toolCatalogText() {
  return [
    'READ ONLY TOOLS you may request before writing the patch:',
    '- {"tool":"list_files","dir":"optional/sub"} returns file paths and sizes.',
    '- {"tool":"read_file","path":"app/Name.js","fromLine":1,"toLine":80} returns numbered lines (max ' + MAX_READ_LINES + ').',
    '- {"tool":"search_text","query":"some text","maxResults":20} searches every source file.',
    '- {"tool":"run_probe","probe":"syntax|dom_smoke|web_get","target":"app/Name.js"} runs one bounded probe:',
    '  syntax checks one file, dom_smoke boots the tool script in a fake DOM and prints its [TOOL:...] log,',
    '  web_get reads ONE https page from an allowlisted host.',
    'To use a tool answer EXACTLY: { "toolCalls": [ { "tool": "read_file", "path": "app/Name.js" } ] }',
    'You get at most a few rounds. When you have enough information, answer with the normal patch object.',
    'You can never run shell commands, open a database, delete files, or reach a host that is not allowlisted.'
  ].join('\n')
}

function clampOutput(text) {
  const value = String(text || '')
  if (value.length <= MAX_OUTPUT_CHARS) return value
  return value.slice(0, MAX_OUTPUT_CHARS) + '\n... [tool output trimmed]'
}

function listFiles(workspace, call) {
  const directory = String(call.dir || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
  const files = workspace.listFiles({ maxFiles: MAX_LISTED_FILES, maxDepth: 5 })
    .filter((file) => !directory || file.relativePath === directory || file.relativePath.startsWith(directory + '/'))
  if (!files.length) return 'No files matched.'
  return clampOutput(files.map((file) => file.relativePath + '  ' + (file.size / 1024).toFixed(1) + 'KB').join('\n'))
}

function readFile(workspace, call) {
  const requestedPath = String(call.path || '')
  if (!requestedPath) return 'A path is required.'
  if (!workspace.exists(requestedPath)) return 'The file does not exist: ' + requestedPath
  const content = workspace.readText(requestedPath)
  const allLines = content.split('\n')
  const fromLine = Math.max(1, Number(call.fromLine) || 1)
  const toLine = Math.min(allLines.length, Number(call.toLine) || (fromLine + MAX_READ_LINES - 1))
  const slice = allLines.slice(fromLine - 1, toLine)
  const numbered = slice.map((line, index) => String(fromLine + index).padStart(5, ' ') + '| ' + line)
  const note = allLines.length > slice.length
    ? '\n[showing lines ' + fromLine + '-' + toLine + ' of ' + allLines.length + ']'
    : ''
  return clampOutput(numbered.join('\n') + note)
}

function searchText(workspace, call) {
  const query = String(call.query || '')
  if (!query) return 'A query is required.'
  const maxResults = Math.min(MAX_SEARCH_MATCHES, Number(call.maxResults) || 20)
  const needle = query.toLowerCase()
  const matches = []
  const files = workspace.sourceFiles({ maxFiles: 120 })
  for (const file of files) {
    if (matches.length >= maxResults) break
    let content = ''
    try {
      content = workspace.readText(file.relativePath)
    } catch (_error) {
      continue
    }
    const lines = content.split('\n')
    for (let index = 0; index < lines.length; index += 1) {
      if (matches.length >= maxResults) break
      if (lines[index].toLowerCase().includes(needle)) {
        matches.push(file.relativePath + ':' + (index + 1) + ': ' + lines[index].trim().slice(0, 160))
      }
    }
  }
  if (!matches.length) return 'No match for "' + query + '".'
  return clampOutput(matches.join('\n'))
}

async function executeTool(workspace, call, options) {
  const settings = options || {}
  const toolName = String(call && call.tool || '')
  if (!TOOL_NAMES.includes(toolName)) {
    return { ok: false, text: 'Unknown tool "' + toolName + '". Available tools: ' + TOOL_NAMES.join(', ') }
  }
  try {
    if (toolName === 'list_files') return { ok: true, text: listFiles(workspace, call) }
    if (toolName === 'read_file') return { ok: true, text: readFile(workspace, call) }
    if (toolName === 'search_text') return { ok: true, text: searchText(workspace, call) }
    const probe = String(call.probe || '').toLowerCase()
    const enabledProbes = Array.isArray(settings.probes) ? settings.probes : PROBES
    if (!enabledProbes.includes(probe)) {
      return { ok: false, text: 'This probe is disabled: ' + (probe || '(missing)') + '. Enabled: ' + enabledProbes.join(', ') }
    }
    const outcome = await runProbe({
      probe,
      target: call.target || call.path || call.url || '',
      workspace,
      web: settings.web
    })
    return { ok: Boolean(outcome.ok), text: clampOutput(outcome.text) }
  } catch (error) {
    return { ok: false, text: 'The tool failed: ' + error.message }
  }
}

function extractToolCalls(answer) {
  if (!answer || typeof answer !== 'object') return null
  const calls = answer.toolCalls || answer.tool_calls || answer.tools
  if (!Array.isArray(calls) || !calls.length) return null
  return calls
    .filter((call) => call && typeof call === 'object')
    .slice(0, 4)
    .map((call) => ({
      tool: String(call.tool || call.name || ''),
      path: call.path || call.file || '',
      dir: call.dir || call.directory || '',
      query: call.query || call.text || '',
      probe: call.probe || '',
      target: call.target || call.url || '',
      fromLine: call.fromLine,
      toLine: call.toLine,
      maxResults: call.maxResults
    }))
}

module.exports = { toolCatalogText, executeTool, extractToolCalls, TOOL_NAMES }
