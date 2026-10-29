'use strict'

// Stage 1 - choose the idea from the idea catalog JSON and create the tool
// folder (app + docs) plus the first specification shell.

const path = require('path')
const { loadIdeaCatalog, searchIdeas } = require('../idea/catalog')
const ssotModel = require('../ssot/model')
const { toPascalName, toClassPrefix } = require('../tool/naming')
const { scaffoldTool } = require('../tool/scaffold')
const { Workspace } = require('../code/workspace')
const { renderAndSave } = require('./shared')

function toIdea(runIdea, catalogPath) {
  return {
    id: String(runIdea.id || ''),
    name: String(runIdea.name || ''),
    purpose: String(runIdea.purpose || ''),
    category: String(runIdea.category || ''),
    folder: String(runIdea.folder || ''),
    source: String(runIdea.source || catalogPath || 'tool-ideas-catalog.json')
  }
}

function pickFromCatalog(config, requestedIdea) {
  const catalog = loadIdeaCatalog(config.ideasCatalogPath)
  if (requestedIdea && (requestedIdea.id || requestedIdea.name)) {
    const wantedId = String(requestedIdea.id || '').trim()
    const wantedName = String(requestedIdea.name || '').trim().toLowerCase()
    const found = catalog.ideas.find((idea) => (wantedId && (idea.id === wantedId || idea.code === wantedId)) ||
      (wantedName && idea.name.toLowerCase() === wantedName))
    if (found) return { idea: found, catalog }
  }
  const candidates = searchIdeas(catalog, { includeBuilt: false, limit: 1 })
  if (!candidates.length) {
    throw new Error('The idea catalog returned no unbuilt idea. Check ' + catalog.catalogPath)
  }
  return { idea: candidates[0], catalog }
}

async function run(context) {
  const { run: currentRun, config, store, log, ssot } = context
  const requested = currentRun.idea || {}
  let idea = requested
  let catalogPath = ''
  const hasRequest = Boolean(requested.name || requested.id)

  try {
    const picked = pickFromCatalog(config, hasRequest ? requested : null)
    idea = Object.assign({}, requested, {
      id: requested.id || picked.idea.id,
      name: requested.name || picked.idea.name,
      purpose: requested.purpose || picked.idea.purpose,
      category: requested.category || [picked.idea.group, picked.idea.category, picked.idea.sub].filter(Boolean).join(' / '),
      folder: requested.folder || picked.idea.folder
    })
    catalogPath = picked.catalog.catalogPath
    log('info', 'Idea from the catalog: ' + idea.name + ' (' + (picked.idea.folder || picked.idea.code) + ')')
  } catch (catalogError) {
    log('warn', 'The idea catalog could not be read (' + catalogError.message + '). Using the idea as entered.')
    if (!idea.name) throw new Error('No idea was selected and the catalog is not readable: ' + catalogError.message)
  }

  const toolName = toPascalName(idea.name)
  currentRun.idea = Object.assign(toIdea(idea, catalogPath), { toolName })
  currentRun.toolName = toolName
  currentRun.toolPrefix = toClassPrefix(idea.name)
  currentRun.catalogPath = catalogPath || config.ideasCatalogPath
  currentRun.toolFolderCode = currentRun.idea.folder || ''

  // The deliverable is written to the real repository folder that the ideas
  // catalog points at, not into the run folder. A dry run (mock provider) is
  // forced into the run folder so a test can never create a real tool folder.
  const effectiveProvider = String((currentRun.options && currentRun.options.provider) || config.provider)
  const mockInRepo = Boolean(config.target && config.target.mockInRepo)
  const sandboxed = effectiveProvider === 'mock' && !mockInRepo
  const targetMode = sandboxed ? 'run' : ((config.target && config.target.mode) || 'repo')
  if (sandboxed) {
    log('info', 'Dry run (mock provider): the tool is written inside the run folder, not into the repository tree.')
  }
  const target = store.assignToolDirectory(currentRun, {
    mode: targetMode,
    code: currentRun.idea.folder,
    toolName,
    category: currentRun.idea.category,
    repoRoot: (config.target && config.target.root) || undefined,
    taxonomyFile: config.taxonomyFile || undefined,
    overwrite: Boolean(config.target && config.target.overwrite)
  })
  if (!target.ok) {
    throw new Error(target.reason || 'The tool folder could not be resolved from the folder taxonomy.')
  }
  log('info', 'Tool folder: ' + (target.relativePath || target.absolutePath) +
    (target.label ? ' (' + target.label + ')' : ''))
  currentRun.toolDirectory = target.absolutePath
  currentRun.appDirectory = path.join(target.absolutePath, 'app')

  // The pipeline already loaded the specification object for this stage; reuse
  // it so the step timeline written by the pipeline is kept.
  ssot.idea = Object.assign({}, ssot.idea, currentRun.idea)

  const workspace = new Workspace(currentRun.toolDirectory)
  const scaffold = scaffoldTool({
    workspace,
    ssot,
    idea: currentRun.idea,
    toolName,
    prefix: currentRun.toolPrefix
  })

  ssotModel.appendLog(ssot, 'select-idea', 'Idea selected: ' + currentRun.idea.name +
    (currentRun.idea.folder ? ' (' + currentRun.idea.folder + ')' : ''))
  ssotModel.appendLog(ssot, 'select-idea', 'Tool folder: ' + (target.relativePath || target.absolutePath))
  ssotModel.appendLog(ssot, 'select-idea', 'Html tool scaffolded as ' + toolName +
    ' (build ' + scaffold.stamp + ', ' + scaffold.created.length + ' file(s) created, ' +
    scaffold.skipped.length + ' kept)')

  store.saveRun(currentRun)
  renderAndSave(store, currentRun, ssot, { config, log })
  return {
    summary: 'Idea selected: ' + currentRun.idea.name + ' - ' + toolName + ' created in ' +
      (target.relativePath || 'the run folder'),
    ssot
  }
}

module.exports = { id: 'select-idea', title: 'Select idea', run }
