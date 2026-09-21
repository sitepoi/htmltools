// ── DOCS SCAFFOLD (npm run docs:init) ──────────────────────────────────────
// Creates the docs/ folder for every tool that does not have it yet, with
// the six documents born from _docs/templates/:
//   ssot.html, webpage.html, help.html, presentation.html, updates.html,
//   social.html
// Only creates MISSING files - existing documents are never overwritten, so
// re-running is always safe. No AI is used here; the AI regeneration happens
// with scripts/generate-docs.js (npm run docs:generate / npm run rel).
//
// Usage:  npm run docs:init
//         npm run docs:init -- --tool AIChatPresentationBuilder
const { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } = require('fs')
const { join } = require('path')
const context = require('./releaseContext')

const TOOL_PARTS = context.TOOL_PARTS
const SATELLITE_FILES = context.SATELLITE_FILES

function templatePath(templateName) {
  return join(context.TEMPLATES_DIR, '_' + templateName + '-template.html')
}

function fillCommonPlaceholders(templateContent, replacements) {
  let content = templateContent
  Object.keys(replacements).forEach((placeholder) => {
    content = content.split(placeholder).join(replacements[placeholder])
  })
  return content
}

function fillSsotDocument(templateContent, tool, replacements) {
  let content = fillCommonPlaceholders(templateContent, replacements)

  // Applies to: list the built parts with their folder paths.
  const partsText = tool.parts.map((partName) => partName + '/').join(', ')
  content = content.replace(
    /(<tr><th>Applies to<\/th><td>)([\s\S]*?)(<\/td><\/tr>)/,
    (match, before, _placeholderText, after) =>
      before + 'The ' + partsText + ' part(s) of this tool folder (' + tool.toolName + ').' + after
  )

  // Primary code areas: the actual files of every part.
  const codeAreas = []
  tool.parts.forEach((partName) => {
    const partDirectory = join(tool.toolDirectory, partName)
    let fileEntries
    try { fileEntries = readdirSync(partDirectory, { withFileTypes: true }) } catch (_e) { return }
    fileEntries.forEach((entry) => {
      if (!entry.isFile()) return
      codeAreas.push(partName + '/' + entry.name)
    })
  })
  if (codeAreas.length) {
    content = content.replace(
      /(<tr><th>Primary code areas<\/th><td>)([\s\S]*?)(<\/td><\/tr>)/,
      (match, before, _placeholderText, after) =>
        before + '<code>' + codeAreas.join('</code>, <code>') + '</code>' + after
    )
  }

  // Footer version line keeps the template default - nothing to do.
  return content
}

function buildUpdatesDocument(templateContent, replacements) {
  return fillCommonPlaceholders(templateContent, replacements)
}

function buildToolDocuments(tool, onlyMissing, log) {
  const docsDirectory = tool.docsDirectory
  mkdirSync(docsDirectory, { recursive: true })

  const allToolsEntry = context.getAllToolsEntry(tool)
  const displayName = (allToolsEntry && allToolsEntry.displayName) || context.toDisplayName(tool.toolName)
  const decisionPrefix = context.toDecisionPrefix(tool.toolName)
  const today = new Date().toISOString().slice(0, 10)
  const assetsRelative = context.assetsRelativeFrom(docsDirectory)
  const cssClass = context.toKebabClass(tool.toolName)

  const replacements = {
    '[FEATURE NAME]': displayName,
    '[DATE]': today,
    '[CODE]': decisionPrefix,
    '[ASSETS_RELATIVE]': assetsRelative,
    '[SSOT FILE]': SATELLITE_FILES.ssot,
    '[CSS_CLASS]': cssClass,
  }

  const filesToBuild = {
    ssot: (templateContent) => fillSsotDocument(templateContent, tool, replacements),
    webpage: (templateContent) => fillCommonPlaceholders(templateContent, replacements),
    help: (templateContent) => fillCommonPlaceholders(templateContent, replacements),
    presentation: (templateContent) => fillCommonPlaceholders(templateContent, replacements),
    updates: (templateContent) => buildUpdatesDocument(templateContent, replacements),
    social: (templateContent) => fillCommonPlaceholders(templateContent, replacements),
  }

  let createdCount = 0
  Object.keys(filesToBuild).forEach((documentType) => {
    const outputPath = join(docsDirectory, SATELLITE_FILES[documentType])
    if (existsSync(outputPath)) return
    if (onlyMissing && existsSync(outputPath)) return
    const templateContent = readFileSync(templatePath(documentType), 'utf8')
    writeFileSync(outputPath, filesToBuild[documentType](templateContent), 'utf8')
    createdCount++
  })

  if (log) {
    console.log(
      createdCount > 0
        ? `→ ${tool.toolName}: created ${createdCount} document(s) in docs/ (${tool.parts.join(', ')})`
        : `→ ${tool.toolName}: docs complete, nothing missing`
    )
  }
  return createdCount
}

function main() {
  const args = process.argv.slice(2)
  const requestedToolName = args.includes('--tool') ? args[args.indexOf('--tool') + 1] : ''
  const verbose = args.includes('--verbose')

  const tools = requestedToolName
    ? [context.findToolByName(requestedToolName)].filter(Boolean)
    : context.listToolParts()

  if (requestedToolName && tools.length === 0) {
    console.error('Tool not found: ' + requestedToolName)
    process.exit(1)
  }

  let totalCreated = 0
  tools.forEach((tool) => {
    totalCreated += buildToolDocuments(tool, true, verbose)
  })

  console.log(`\nDocs scaffold complete: ${tools.length} tool(s) checked, ${totalCreated} document(s) created.`)
  console.log('Next: fill the SSOT (features, decisions, tasks, risks), then regenerate the')
  console.log('satellites with:  npm run docs:generate -- <ToolName>')
}

if (require.main === module) {
  main()
}

module.exports = { buildToolDocuments, fillCommonPlaceholders }
