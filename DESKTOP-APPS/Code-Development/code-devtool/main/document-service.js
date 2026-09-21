// Unicon Studio - project document service (CODE-36)
// Finds the documents that belong to the OPENED folder: SSOT files,
// plans, reports, marketing pages, help pages, social media pages.
// The SSOT/Docs overlay lists these instead of the app's own SSOT, and
// /project-docs/ serves them inside the project root only.
// The type table below is the extension point: when the user's full
// document ruleset arrives, add patterns and labels here - nothing else
// needs to change.

const fs = require('fs')
const path = require('path')

const ignoredFolderNames = new Set(['node_modules', '.git', '.next'])
const maximumWalkDepth = 6
const maximumDocumentCount = 200
const acceptedExtensions = new Set(['.html', '.htm', '.md'])
const skippedBaseNames = new Set(['test-harness', 'index', 'tool-analysis'])

// Extensible document type definitions: the first matching type wins.
// Order matters for sorting - SSOT documents always come first, then the
// satellites in the ruleset's order, then the auxiliary types.
const documentTypeDefinitions = [
  { type: 'ssot', label: 'SSOT', patterns: [/ssot/i] },
  { type: 'help', label: 'Help', patterns: [/help/i] },
  { type: 'marketing', label: 'Marketing', patterns: [/marketing/i] },
  { type: 'updates', label: 'Updates', patterns: [/updates/i] },
  { type: 'social', label: 'Social media', patterns: [/social/i] },
  { type: 'onepager', label: 'One-pager', patterns: [/onepager/i] },
  { type: 'presentation', label: 'Presentation', patterns: [/presentation/i] },
  { type: 'monthly', label: 'Monthly digest', patterns: [/^\d{4}-\d{2}$/] },
  { type: 'plan', label: 'Plan', patterns: [/plan/i] },
  { type: 'report', label: 'Report', patterns: [/report/i] },
  { type: 'readme', label: 'Readme', patterns: [/^readme$/i] }
]

function classifyDocument(fileName) {
  const lowerName = String(fileName).toLowerCase()
  const extension = path.extname(lowerName)
  if (!acceptedExtensions.has(extension)) return null
  const baseName = path.basename(lowerName, extension)
  // Old files, harnesses, the app's own docs, and the TEMPLATES themselves
  // are never project documents.
  if (baseName.startsWith('old') || baseName.endsWith('-template') || skippedBaseNames.has(baseName)) return null
  for (const definition of documentTypeDefinitions) {
    if (definition.patterns.some((pattern) => pattern.test(baseName))) {
      return { type: definition.type, label: definition.label }
    }
  }
  return null
}

function listProjectDocuments(projectRoot) {
  const found = []
  if (!projectRoot) return found
  const walk = (relativeDirectory, depth) => {
    if (depth > maximumWalkDepth || found.length >= maximumDocumentCount) return
    let directoryEntries
    try {
      directoryEntries = fs.readdirSync(path.join(projectRoot, relativeDirectory), { withFileTypes: true })
    } catch (_readError) {
      return
    }
    for (const entry of directoryEntries) {
      if (entry.name.startsWith('.')) continue
      const entryRelativePath = relativeDirectory ? path.join(relativeDirectory, entry.name) : entry.name
      if (entry.isDirectory()) {
        if (ignoredFolderNames.has(entry.name)) continue
        walk(entryRelativePath, depth + 1)
      } else if (entry.isFile()) {
        const classification = classifyDocument(entry.name)
        if (classification) {
          found.push({
            name: entry.name,
            relativePath: entryRelativePath.replace(/\\/g, '/'),
            type: classification.type,
            label: classification.label
          })
        }
      }
    }
  }
  walk('', 0)
  const typeOrder = documentTypeDefinitions.map((definition) => definition.type)
  found.sort((leftDocument, rightDocument) => {
    const typeCompare = typeOrder.indexOf(leftDocument.type) - typeOrder.indexOf(rightDocument.type)
    if (typeCompare !== 0) return typeCompare
    return leftDocument.relativePath.localeCompare(rightDocument.relativePath)
  })
  return found
}

module.exports = { listProjectDocuments, classifyDocument, documentTypeDefinitions }
