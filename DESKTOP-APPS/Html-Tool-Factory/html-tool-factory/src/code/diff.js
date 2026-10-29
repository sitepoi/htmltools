'use strict'

// Line based diff used to record what a build task actually changed, so the
// dashboard can show a reviewable patch instead of "the file was written".

const MAX_LINES_FOR_LCS = 2000

function toLines(text) {
  const normalized = String(text == null ? '' : text).replace(/\r\n/g, '\n')
  if (!normalized) return []
  const lines = normalized.split('\n')
  if (lines.length && lines[lines.length - 1] === '') lines.pop()
  return lines
}

function lcsTable(oldLines, newLines) {
  const rows = oldLines.length + 1
  const columns = newLines.length + 1
  const table = new Array(rows)
  for (let row = 0; row < rows; row += 1) {
    table[row] = new Uint32Array(columns)
  }
  for (let row = oldLines.length - 1; row >= 0; row -= 1) {
    for (let column = newLines.length - 1; column >= 0; column -= 1) {
      table[row][column] = oldLines[row] === newLines[column]
        ? table[row + 1][column + 1] + 1
        : Math.max(table[row + 1][column], table[row][column + 1])
    }
  }
  return table
}

function diffLines(oldLines, newLines) {
  const operations = []
  if (oldLines.length > MAX_LINES_FOR_LCS || newLines.length > MAX_LINES_FOR_LCS) {
    // Too big for a line diff: report it as a full replacement block.
    oldLines.forEach((line) => operations.push({ type: 'del', text: line }))
    newLines.forEach((line) => operations.push({ type: 'add', text: line }))
    return operations
  }
  const table = lcsTable(oldLines, newLines)
  let row = 0
  let column = 0
  while (row < oldLines.length && column < newLines.length) {
    if (oldLines[row] === newLines[column]) {
      operations.push({ type: 'equal', text: oldLines[row] })
      row += 1
      column += 1
    } else if (table[row + 1][column] >= table[row][column + 1]) {
      operations.push({ type: 'del', text: oldLines[row] })
      row += 1
    } else {
      operations.push({ type: 'add', text: newLines[column] })
      column += 1
    }
  }
  while (row < oldLines.length) {
    operations.push({ type: 'del', text: oldLines[row] })
    row += 1
  }
  while (column < newLines.length) {
    operations.push({ type: 'add', text: newLines[column] })
    column += 1
  }
  return operations
}

// Builds a unified diff body with @@ hunks and a few context lines.
function unifiedDiff(oldText, newText, options) {
  const settings = options || {}
  const filePath = String(settings.file || 'file')
  const context = Number(settings.context) || 3
  const maxChars = Number(settings.maxChars) || 20000

  const oldLines = toLines(oldText)
  const newLines = toLines(newText)
  const operations = diffLines(oldLines, newLines)
  const changed = operations.filter((operation) => operation.type !== 'equal')
  if (!changed.length) return ''

  // Mark which operation indexes to keep (changed blocks plus context).
  const keep = new Array(operations.length).fill(false)
  operations.forEach((operation, index) => {
    if (operation.type === 'equal') return
    for (let offset = Math.max(0, index - context); offset <= Math.min(operations.length - 1, index + context); offset += 1) {
      keep[offset] = true
    }
  })

  const header = '--- a/' + filePath + '\n+++ b/' + filePath + '\n'
  const output = []
  let oldLineNumber = 1
  let newLineNumber = 1
  let index = 0
  let inHunk = false

  while (index < operations.length) {
    if (!keep[index]) {
      if (operations[index].type !== 'add') oldLineNumber += 1
      if (operations[index].type !== 'del') newLineNumber += 1
      inHunk = false
      index += 1
      continue
    }
    if (!inHunk) {
      // Count the hunk header by looking ahead over the kept block.
      let lookahead = index
      let oldCount = 0
      let newCount = 0
      while (lookahead < operations.length && keep[lookahead]) {
        if (operations[lookahead].type !== 'add') oldCount += 1
        if (operations[lookahead].type !== 'del') newCount += 1
        lookahead += 1
      }
      output.push('@@ -' + oldLineNumber + ',' + oldCount + ' +' + newLineNumber + ',' + newCount + ' @@')
      inHunk = true
    }
    const operation = operations[index]
    const prefix = operation.type === 'add' ? '+' : operation.type === 'del' ? '-' : ' '
    output.push(prefix + operation.text)
    if (operation.type !== 'add') oldLineNumber += 1
    if (operation.type !== 'del') newLineNumber += 1
    index += 1
  }

  const full = header + output.join('\n') + '\n'
  if (full.length <= maxChars) return full
  return full.slice(0, maxChars) + '\n... [diff trimmed]\n'
}

function summarizeDiff(diffText) {
  const text = String(diffText || '')
  if (!text) return { added: 0, removed: 0, files: 0 }
  const lines = text.split('\n')
  return {
    added: lines.filter((line) => line.startsWith('+') && !line.startsWith('+++')).length,
    removed: lines.filter((line) => line.startsWith('-') && !line.startsWith('---')).length,
    files: lines.filter((line) => line.startsWith('+++ ')).length
  }
}

module.exports = { unifiedDiff, diffLines, summarizeDiff, toLines }
