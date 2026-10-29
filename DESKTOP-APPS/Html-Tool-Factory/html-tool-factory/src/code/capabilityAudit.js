'use strict'

// Capability audit: an item may only stay "done" when the thing it promises is
// actually visible in the tool files. A model can claim a capability in one
// sentence; this module looks for the observable marker instead, and reopens
// the item when it is missing. Nothing here calls the network or writes a file.

const fs = require('fs')
const path = require('path')

const FILE_SLOTS = { html: 0, css: 1, js: 2, harness: 3 }

function filePathsFor(toolName) {
  const name = String(toolName || '')
  return {
    html: 'app/' + name + '.html',
    css: 'app/' + name + '.css',
    js: 'app/' + name + '.js',
    harness: 'app/test-harness.html'
  }
}

function readSources(workspace, toolName) {
  const paths = filePathsFor(toolName)
  const sources = {}
  Object.keys(paths).forEach((slot) => {
    try {
      sources[slot] = workspace.exists(paths[slot]) ? workspace.readText(paths[slot]) : ''
    } catch (_error) {
      sources[slot] = ''
    }
  })
  return { paths, sources }
}

// Every marker is a plain regular expression over one of the four files, so the
// answer is deterministic and reviewable instead of an opinion.
function checkMarkers(markers, sources) {
  const list = Array.isArray(markers) ? markers : []
  if (!list.length) return { ok: true, detail: 'no marker defined' }
  for (const marker of list) {
    const slot = String(marker && marker.file || '').toLowerCase()
    if (!(slot in FILE_SLOTS)) return { ok: false, detail: 'unknown file slot ' + slot }
    const source = sources[slot] || ''
    let pattern
    try {
      pattern = new RegExp(marker.pattern, 'i')
    } catch (error) {
      return { ok: false, detail: 'invalid marker pattern: ' + marker.pattern }
    }
    if (!pattern.test(source)) {
      return { ok: false, detail: 'missing in ' + slot + ': /' + marker.pattern + '/' }
    }
  }
  return { ok: true, detail: 'marker found' }
}

// Audits the items that claim to be done. A missing marker reopens the item, so
// a run cannot report finished on a capability that was never written.
function auditChecklist(workspace, ssot, options) {
  const settings = options || {}
  const toolName = String(settings.toolName || (workspace && workspace.toolName) || '')
  const items = Array.isArray(ssot && ssot.checklist) ? ssot.checklist : []
  if (!toolName || !items.length) {
    return { checked: 0, results: [], reopened: [], ok: true }
  }
  const { sources } = readSources(workspace, toolName)
  const results = []
  const reopened = []
  items.forEach((item) => {
    if (item.status !== 'done') return
    const outcome = checkMarkers(item.marker, sources)
    results.push({ id: item.id, title: item.title, ok: outcome.ok, detail: outcome.detail })
    if (outcome.ok) return
    item.status = 'todo'
    item.doneAt = null
    item.reopenedAt = new Date().toISOString()
    item.reopenReason = outcome.detail
    reopened.push(item)
  })
  return {
    checked: results.length,
    results,
    reopened: reopened.map((item) => item.id + ': ' + item.title + ' (' + item.reopenReason + ')'),
    ok: reopened.length === 0
  }
}

// Counts how many inputs carry a label, used by the accessibility marker.
function countLabeledInputs(htmlText) {
  const inputs = (String(htmlText).match(/<(input|textarea|select)\b/gi) || []).length
  const labels = (String(htmlText).match(/<label\b/gi) || []).length
  const ariaLabels = (String(htmlText).match(/aria-label\s*=/gi) || []).length
  return { inputs, labels: labels + ariaLabels, ok: inputs === 0 || labels + ariaLabels >= inputs }
}

module.exports = {
  filePathsFor,
  readSources,
  checkMarkers,
  auditChecklist,
  countLabeledInputs
}
