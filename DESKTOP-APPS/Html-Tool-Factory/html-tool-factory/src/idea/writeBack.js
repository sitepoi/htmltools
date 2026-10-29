'use strict'

// Marks the chosen idea as being developed in the idea catalog JSON, so the
// catalog stays the living record of the idea list. Only the matched entry is
// touched; every other byte of the file is preserved (same 2 space layout).

const fs = require('fs')
const path = require('path')
const { ensureDir, nowIso } = require('../util')

function findEntryIndex(ideas, ideaId, ideaName) {
  const wantedId = String(ideaId || '')
  const wantedName = String(ideaName || '').trim().toLowerCase()
  // 1. exact id (entries with a "-N" suffix carry an id field)
  if (wantedId) {
    const byId = ideas.findIndex((idea) => String(idea.id || '') === wantedId)
    if (byId !== -1) return byId
    // 2. the first entry of a code has no id field, its id equals the code
    const byCode = ideas.findIndex((idea) => String(idea.code || idea.folder || '') === wantedId && !idea.id)
    if (byCode !== -1) return byCode
  }
  // 3. fall back to the name
  if (wantedName) {
    return ideas.findIndex((idea) => String(idea.name || '').trim().toLowerCase() === wantedName)
  }
  return -1
}

function recordDevelopment(options) {
  const settings = options || {}
  const catalogPath = settings.catalogPath
  if (!catalogPath || !fs.existsSync(catalogPath)) {
    return { ok: false, reason: 'The idea catalog file was not found.' }
  }
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
  } catch (error) {
    return { ok: false, reason: 'The idea catalog is not valid JSON: ' + error.message }
  }
  const ideas = Array.isArray(parsed.ideas) ? parsed.ideas : []
  const index = findEntryIndex(ideas, settings.ideaId, settings.ideaName)
  if (index === -1) {
    return { ok: false, reason: 'The idea was not found in the catalog.' }
  }

  // Safety copy before the first write of this run.
  if (settings.backupDirectory) {
    try {
      ensureDir(settings.backupDirectory)
      const backupName = 'tool-ideas-catalog-' + Date.now() + '.json'
      fs.writeFileSync(path.join(settings.backupDirectory, backupName), JSON.stringify(parsed, null, 2), 'utf8')
    } catch (_backupError) {
      // a backup is nice to have, not required
    }
  }

  const entry = ideas[index]
  const previous = entry.development && typeof entry.development === 'object' ? entry.development : {}
  entry.development = Object.assign({}, previous, {
    status: String(settings.status || 'in-progress'),
    toolFolder: String(settings.toolFolder || previous.toolFolder || ''),
    runId: String(settings.runId || previous.runId || ''),
    iterations: Number(settings.iterations) || previous.iterations || 0,
    tasksDone: Number(settings.tasksDone) || previous.tasksDone || 0,
    checksPassed: Number(settings.checksPassed) || previous.checksPassed || 0,
    updatedAt: nowIso()
  })

  parsed.developmentNote = 'The "development" field on each idea is written by the HTML Tool Factory ' +
    '(DESKTOP-APPS/Html-Tool-Factory). It records which run and tool folder currently implement the idea.'

  try {
    const temporaryPath = catalogPath + '.tmp-' + process.pid
    fs.writeFileSync(temporaryPath, JSON.stringify(parsed, null, 2) + '\n', 'utf8')
    fs.renameSync(temporaryPath, catalogPath)
  } catch (error) {
    return { ok: false, reason: 'The idea catalog could not be written: ' + error.message }
  }

  return {
    ok: true,
    entry: {
      id: entry.id || entry.code,
      name: entry.name,
      development: entry.development
    }
  }
}

module.exports = { recordDevelopment, findEntryIndex }
