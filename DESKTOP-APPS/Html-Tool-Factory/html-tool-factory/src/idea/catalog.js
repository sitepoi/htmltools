'use strict'

// The idea SSOT is UNICON-TOOLS/tools-catalog/tool-ideas-catalog.json.
// Every idea carries a taxonomy code in "folder" (for example B-G-01-a). The
// optional catalog-data.js next to it is used ONLY to add readable group and
// category labels, never as the idea source.

const fs = require('fs')
const path = require('path')
const vm = require('vm')

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function findJsonCatalog(catalogPath) {
  if (catalogPath && fs.existsSync(catalogPath) && catalogPath.toLowerCase().endsWith('.json')) return catalogPath
  const directory = catalogPath ? path.dirname(catalogPath) : ''
  const candidates = [
    path.join(directory, 'tool-ideas-catalog.json'),
    path.join(directory, 'application-ideas-catalog.json')
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) || ''
}

// Readable labels only. A missing or unreadable file is not an error.
function readLabelData(catalogPath) {
  const directory = catalogPath ? path.dirname(catalogPath) : ''
  const labels = { groups: {}, categories: {}, codes: {}, tools: {} }
  const candidate = path.join(directory, 'catalog-data.js')
  if (!fs.existsSync(candidate)) return labels
  try {
    const source = fs.readFileSync(candidate, 'utf8')
    const sandbox = { console: { log: () => {} } }
    vm.createContext(sandbox)
    vm.runInContext(
      source + '\nthis.__out = { groups: typeof IDEA_GROUPS !== "undefined" ? IDEA_GROUPS : [], tools: typeof IDEA_TOOLS !== "undefined" ? IDEA_TOOLS : {} };\n',
      sandbox,
      { timeout: 8000 }
    )
    const evaluated = sandbox.__out || { groups: [] }
    ;(evaluated.groups || []).forEach((group) => {
      labels.groups[group.key] = group.label
      ;(group.categories || []).forEach((category) => {
        labels.categories[category.key] = category.label
        ;(category.ideas || []).forEach((idea) => {
          const code = idea.code || idea.id
          if (!code) return
          if (!labels.codes[code]) labels.codes[code] = { sub: '' }
          if (idea.sub) labels.codes[code].sub = idea.sub
        })
      })
    })
    labels.tools = evaluated.tools || {}
  } catch (_error) {
    // labels are cosmetic only
  }
  return labels
}

function codePartsOf(code) {
  // B-G-01-a -> branch Business, type General, category key B-G-01
  const parts = String(code || '').split('-')
  const branch = parts[0] || ''
  const type = parts[1] || ''
  return {
    branch: branch === 'B' ? 'Business' : branch === 'P' ? 'Personal' : branch,
    branchKey: branch === 'B' ? 'B-bg' : branch === 'P' ? 'P-pg' : '',
    type: type === 'G' ? 'General' : type === 'V' ? 'Vertical' : type,
    categoryKey: parts.length >= 3 ? parts.slice(0, 3).join('-') : ''
  }
}

function buildIdea(rawIdea, labels, index) {
  const code = String(rawIdea.code || rawIdea.folder || '')
  const id = String(rawIdea.id || code || ('idea-' + index))
  const parts = codePartsOf(code)
  const labelRecord = labels.codes[code] || {}
  const builtFolders = (labels.tools && (labels.tools[id] || labels.tools[code])) || []
  return {
    id,
    code,
    folder: String(rawIdea.folder || code),
    name: String(rawIdea.name || ''),
    purpose: String(rawIdea.purpose || ''),
    users: String(rawIdea.users || ''),
    tam: String(rawIdea.tam || ''),
    sam: String(rawIdea.sam || ''),
    som: String(rawIdea.som || ''),
    licensing: String(rawIdea.licensing || ''),
    sub: String(rawIdea.sub || labelRecord.sub || ''),
    category: String(labels.categories[parts.categoryKey] || ''),
    categoryKey: parts.categoryKey,
    group: String(labels.groups[parts.branchKey] || parts.branch),
    branch: parts.branch,
    type: parts.type,
    development: rawIdea.development || null,
    isBuilt: Array.isArray(builtFolders) ? builtFolders.length > 0 : Boolean(builtFolders),
    source: 'tool-ideas-catalog.json'
  }
}

function loadIdeaCatalog(catalogPath) {
  const jsonPath = findJsonCatalog(catalogPath)
  if (!jsonPath) {
    throw new Error('The idea catalog JSON was not found. Expected tool-ideas-catalog.json near "' +
      String(catalogPath || '') + '".')
  }
  const parsed = readJsonFile(jsonPath)
  if (!Array.isArray(parsed.ideas) || !parsed.ideas.length) {
    throw new Error('The idea catalog ' + jsonPath + ' contains no ideas array.')
  }
  const labels = readLabelData(jsonPath)
  const ideas = parsed.ideas
    .filter((idea) => idea && idea.name)
    .map((idea, index) => buildIdea(idea, labels, index))
  return {
    catalogPath: jsonPath,
    total: ideas.length,
    version: String(parsed.version || '1.0.0'),
    generatedAt: String(parsed.generatedAt || ''),
    ideas
  }
}

function searchIdeas(catalog, options) {
  const settings = options || {}
  const searchText = String(settings.search || '').trim().toLowerCase()
  const includeBuilt = settings.includeBuilt !== false
  const limit = Number(settings.limit) || 60

  const filtered = catalog.ideas.filter((idea) => {
    if (!includeBuilt && idea.isBuilt) return false
    if (!searchText) return true
    const haystack = [idea.name, idea.purpose, idea.code, idea.folder, idea.sub, idea.category, idea.licensing]
      .join(' ').toLowerCase()
    return haystack.includes(searchText)
  })

  const ordered = filtered.slice().sort((left, right) => {
    if (left.isBuilt !== right.isBuilt) return left.isBuilt ? 1 : -1
    return left.name.localeCompare(right.name)
  })
  return ordered.slice(0, limit)
}

module.exports = { loadIdeaCatalog, searchIdeas, codePartsOf }
