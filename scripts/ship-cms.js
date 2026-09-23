// ── SHIP → CMS HANDOFF BUNDLE (npm run ship:cms) ───────────────────────────
// Phase 8 of the SHIP process. Builds ship-out/<ToolName>/ with everything
// the application store CMS will import when its API is ready:
//   webpage-export.html  → the website application's related page object
//   help.html            → the app's user help object
//   presentation.html    → the app's presentation object
//   updates.html         → the app's update history object
//   social.html          → the app's social share kit object
//   code/                → the html tool library folder (tool code)
//   manifest.json        → the exact CMS target per file
// This script NEVER calls the CMS - it only prepares the bundle. The
// mapping lives in ship-cms.config.json; the plan and the open questions
// for the CMS team live in SHIP-CMS-PLAN.md.
//
// Usage:
//   npm run ship:cms -- <ToolName>
//   npm run ship:cms -- --all
const { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } = require('fs')
const { join } = require('path')
const context = require('./releaseContext')

const ROOT = context.ROOT
const OUT_ROOT = join(ROOT, 'ship-out')
const CONFIG_PATH = join(ROOT, 'ship-cms.config.json')

function loadConfig() {
  try { return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) } catch (_e) { return { objectTypes: {}, tools: {} } }
}

function bundleTool(tool, config) {
  const docsDirectory = tool.docsDirectory
  const appDirectory = join(tool.toolDirectory, 'app')
  const outputDirectory = join(OUT_ROOT, tool.toolName)
  mkdirSync(join(outputDirectory, 'code'), { recursive: true })

  const targets = []
  const objectTypes = (config && config.objectTypes) || {}
  const toolOverrides = (config && config.tools && config.tools[tool.toolName]) || {}

  function stageDocument(fileName, targetName, field, sourcePath) {
    if (!existsSync(sourcePath)) {
      console.log('→ ' + tool.toolName + ': ' + fileName + ' missing - skipped')
      return
    }
    const target = join(outputDirectory, fileName)
    copyFileSync(sourcePath, target)
    targets.push({
      file: fileName,
      cmsTarget: targetName,
      objectType: toolOverrides[field + 'ObjectType'] || objectTypes[field] || '',
      objectId: toolOverrides[field + 'ObjectId'] || '',
      field: field,
      action: 'upsert',
    })
  }

  // documents
  stageDocument('webpage-export.html', 'website application - related page object', 'webpage', join(docsDirectory, 'webpage-export.html'))
  stageDocument('help.html', 'application help object', 'help', join(docsDirectory, 'help.html'))
  stageDocument('presentation.html', 'application presentation object', 'presentation', join(docsDirectory, 'presentation.html'))
  stageDocument('updates.html', 'application update history object', 'updates', join(docsDirectory, 'updates.html'))
  stageDocument('social.html', 'application social share kit object', 'social', join(docsDirectory, 'social.html'))

  // tool code -> html tool library folder
  const codeKinds = ['html', 'css', 'js']
  codeKinds.forEach((kind) => {
    const fileName = tool.toolName + '.' + kind
    const sourcePath = join(appDirectory, fileName)
    if (!existsSync(sourcePath)) return
    copyFileSync(sourcePath, join(outputDirectory, 'code', fileName))
    targets.push({
      file: 'code/' + fileName,
      cmsTarget: 'html tool library - tool code ' + kind,
      objectType: toolOverrides.toolLibraryObjectType || objectTypes.toolLibrary || '',
      objectId: toolOverrides.toolLibraryObjectId || '',
      field: kind,
      action: 'upsert',
    })
  })
  if (existsSync(join(appDirectory, 'test-harness.html'))) {
    copyFileSync(join(appDirectory, 'test-harness.html'), join(outputDirectory, 'code', 'test-harness.html'))
  }

  let version = '0.0.0'
  try { version = require('../package.json').version } catch (_e) { /* package.json missing */ }
  const manifest = {
    tool: tool.toolName,
    toolFolder: tool.toolDirectory,
    shippedAt: new Date().toISOString(),
    repoVersion: version,
    websiteApp: (config && config.websiteAppName) || '',
    note: 'Prepared by npm run ship:cms - no CMS communication was made. Fill objectType/objectId via ship-cms.config.json when the CMS import API exists.',
    targets,
  }
  writeFileSync(join(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  return targets.length
}

function main() {
  const args = process.argv.slice(2)
  const requestedToolName = args.find((arg) => !arg.startsWith('--'))
  const tools = args.includes('--all')
    ? context.listToolParts()
    : [context.findToolByName(requestedToolName)].filter(Boolean)

  if (tools.length === 0) {
    console.error('Usage: npm run ship:cms -- <ToolName>   or   npm run ship:cms -- --all')
    process.exit(1)
  }

  const config = loadConfig()
  let totalFiles = 0
  tools.forEach((tool) => {
    const stagedCount = bundleTool(tool, config)
    console.log('→ ' + tool.toolName + ': bundle ready in ship-out/' + tool.toolName + ' (' + stagedCount + ' file(s))')
    totalFiles += stagedCount
  })
  console.log('\nSHIP CMS bundle complete: ' + tools.length + ' tool(s), ' + totalFiles + ' file(s) staged in ' + OUT_ROOT + '.')
  console.log('No CMS communication was made. See SHIP-CMS-PLAN.md for the import targets and the open questions for the CMS team.')
}

if (require.main === module) {
  main()
}

module.exports = { bundleTool }
