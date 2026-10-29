'use strict'

// Builds a compact map of the generated application (paths, sizes, top level
// symbols) so a planning prompt never has to carry whole files. This is one
// of the main token savers: a 300KB application becomes a few hundred tokens.

const { truncateTail } = require('../util')

const SYMBOL_PATTERNS = [
  /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,
  /^class\s+([A-Za-z_$][\w$]*)/,
  /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/,
  /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\(/
]

function extractSymbols(text, limit) {
  const maxSymbols = Number(limit) || 12
  const symbols = []
  const lines = String(text || '').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue
    for (const pattern of SYMBOL_PATTERNS) {
      const match = trimmed.match(pattern)
      if (match) {
        if (!symbols.includes(match[1])) symbols.push(match[1])
        break
      }
    }
    if (symbols.length >= maxSymbols) break
  }
  return symbols
}

function countLines(text) {
  return String(text || '').split('\n').length
}

function buildCodemap(workspace, options) {
  const settings = options || {}
  const maxChars = Number(settings.maxChars) || 9000
  const files = workspace.sourceFiles({ maxFiles: settings.maxFiles || 200 })
  if (!files.length) return 'The application folder is empty (no files yet).'

  const lines = files.map((file) => {
    const sizeLabel = (file.size / 1024).toFixed(1) + 'KB'
    if (['.js', '.cjs', '.mjs'].includes(file.extension) && file.size < 200000) {
      let content = ''
      try {
        content = workspace.readText(file.relativePath)
      } catch (_readError) {
        content = ''
      }
      const symbols = extractSymbols(content, 10)
      return file.relativePath + ' (' + sizeLabel + ', ' + countLines(content) + ' lines)' +
        (symbols.length ? ' :: ' + symbols.join(', ') : '')
    }
    if (['.html', '.htm'].includes(file.extension)) {
      let content = ''
      try {
        content = workspace.readText(file.relativePath)
      } catch (_readError) {
        content = ''
      }
      const titleMatch = content.match(/<title[^>]*>([\s\S]{0,80}?)<\/title>/i)
      const headingMatch = content.match(/<h1[^>]*>([\s\S]{0,80}?)<\/h1>/i)
      const label = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim()
        : headingMatch ? headingMatch[1].replace(/<[^>]+>/g, '').trim() : ''
      return file.relativePath + ' (' + sizeLabel + ', ' + countLines(content) + ' lines)' +
        (label ? ' :: "' + label + '"' : '')
    }
    return file.relativePath + ' (' + sizeLabel + ')'
  })

  const mapText = lines.join('\n')
  if (mapText.length <= maxChars) return mapText
  return truncateTail(mapText, maxChars)
}

function collectMatches(text, pattern, groupIndex) {
  const results = []
  let match = pattern.exec(text)
  while (match && results.length < 40) {
    const value = String(match[groupIndex || 1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (value && !results.includes(value)) results.push(value)
    match = pattern.exec(text)
  }
  return results
}

// A compact description of what the user actually sees: headings, buttons,
// inputs, labels and element ids. The usability reviewer walks this instead of
// a whole HTML dump.
function buildUiMap(workspace, options) {
  const settings = options || {}
  const maxChars = Number(settings.maxChars) || 5000
  const pages = workspace.listFiles({ maxFiles: 30, maxDepth: 3, extensions: ['.html', '.htm'] })
  if (!pages.length) return 'No HTML page exists yet.'

  const blocks = pages.slice(0, 6).map((page) => {
    let content = ''
    try {
      content = workspace.readText(page.relativePath)
    } catch (_error) {
      return page.relativePath + ': unreadable'
    }
    const bodyText = content
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    const headings = collectMatches(bodyText, /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi, 2).slice(0, 12)
    const buttons = collectMatches(bodyText, /<button[^>]*>([\s\S]*?)<\/button>/gi, 1).slice(0, 12)
    const labels = collectMatches(bodyText, /<label[^>]*>([\s\S]*?)<\/label>/gi, 1).slice(0, 12)
    const placeholders = collectMatches(bodyText, /placeholder="([^"]*)"/gi, 1).slice(0, 10)
    const ids = collectMatches(bodyText, /id="([^"]+)"/gi, 1).slice(0, 20)
    const lines = []
    lines.push('PAGE ' + page.relativePath)
    if (headings.length) lines.push('  headings: ' + headings.join(' | '))
    if (buttons.length) lines.push('  buttons: ' + buttons.join(' | '))
    if (labels.length) lines.push('  labels: ' + labels.join(' | '))
    if (placeholders.length) lines.push('  placeholders: ' + placeholders.join(' | '))
    if (ids.length) lines.push('  ids: ' + ids.join(', '))
    if (!headings.length && !buttons.length && !labels.length) lines.push('  (no visible controls found)')
    return lines.join('\n')
  })

  const mapText = blocks.join('\n')
  if (mapText.length <= maxChars) return mapText
  return truncateTail(mapText, maxChars)
}

module.exports = { buildCodemap, buildUiMap, extractSymbols }
