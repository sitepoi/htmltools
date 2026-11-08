// ── PROFILES DOCUMENT BUILDER ───────────────────────────────────────────────
// Builds docs/profiles.html from a tool's profiles/index.json + preset JSON
// files, and adds the Profiles menu item to docs/index.html.
//
// Usage:
//   npm run docs:profiles -- CustomerProfile
//   npm run docs:profiles -- --all
//
// This is intentionally separate from docs:init: docs:init creates the core
// seven documents; this command owns the optional eighth Profiles document.
const { readFileSync, writeFileSync, existsSync } = require('fs')
const { join } = require('path')
const context = require('./releaseContext')

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function buildProfilesPayload(tool) {
  const profilesDirectory = join(tool.toolDirectory, 'profiles')
  const indexPath = join(profilesDirectory, 'index.json')
  if (!existsSync(indexPath)) return []
  const manifest = readJson(indexPath)
  const entries = Array.isArray(manifest.presets) ? manifest.presets : []
  return entries.map((entry) => {
    const file = String(entry.file || '')
    const filePath = join(profilesDirectory, file)
    if (!file || !existsSync(filePath)) {
      console.warn('→ ' + tool.toolName + ': skipping missing profile file ' + (file || '(none)'))
      return null
    }
    const config = readJson(filePath)
    return {
      key: file.replace(/\.json$/i, ''),
      name: entry.name || config.appTitle || file,
      file: file,
      mode: entry.mode || (config.segments && config.segments.some((segment) => segment.allowProfileSelection) ? 'selectable' : 'fixed'),
      bestFor: entry.bestFor || '',
      segments: Array.isArray(entry.segments) ? entry.segments : (config.segments || []).map((segment) => segment.key),
      notes: entry.notes || '',
      config: config,
    }
  }).filter(Boolean)
}

function buildProfilesDocument(tool, payload) {
  const templatePath = join(context.TEMPLATES_DIR, '_profiles-template.html')
  const template = readFileSync(templatePath, 'utf8')
  const allToolsEntry = context.getAllToolsEntry(tool)
  const displayName = (allToolsEntry && allToolsEntry.displayName) || context.toDisplayName(tool.toolName)
  const assetsRelative = context.assetsRelativeFrom(tool.docsDirectory)
  const payloadText = JSON.stringify(payload).replace(/<\//g, '<\\/')
  return template
    .split('[FEATURE NAME]').join(displayName)
    .split('[ASSETS_RELATIVE]').join(assetsRelative)
    .split('[PROFILES_KEY]').join(context.toKebabClass(tool.toolName))
    .split('[PROFILES_PAYLOAD]').join(payloadText)
}

function ensureProfilesMenuItem(tool) {
  const indexPath = join(tool.docsDirectory, 'index.html')
  if (!existsSync(indexPath)) return false
  let content = readFileSync(indexPath, 'utf8')
  if (content.includes('data-doc="profiles"')) return false
  const item = '<button class="docs-nav-item" data-doc="profiles" data-src="profiles.html">Profiles<span class="docs-nav-sub">copy presets and check usage</span></button>'
  const socialButton = /(<button class="docs-nav-item" data-doc="social"[\s\S]*?<\/button>)/
  if (socialButton.test(content)) {
    content = content.replace(socialButton, '$1\n      ' + item)
  } else {
    const documentsLabel = '<div class="docs-nav-group-label">Documents</div>'
    if (!content.includes(documentsLabel)) return false
    content = content.replace(documentsLabel, documentsLabel + '\n      ' + item)
  }
  writeFileSync(indexPath, content, 'utf8')
  return true
}

function buildTool(tool) {
  const payload = buildProfilesPayload(tool)
  if (!payload.length) return false
  const outputPath = join(tool.docsDirectory, 'profiles.html')
  writeFileSync(outputPath, buildProfilesDocument(tool, payload), 'utf8')
  const menuAdded = ensureProfilesMenuItem(tool)
  console.log('→ ' + tool.toolName + ': wrote docs/profiles.html (' + payload.length + ' preset(s))' + (menuAdded ? ' + menu item' : ''))
  return true
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--all')) {
    const tools = context.listToolParts().filter((tool) => existsSync(join(tool.toolDirectory, 'profiles', 'index.json')))
    let count = 0
    tools.forEach((tool) => { if (buildTool(tool)) count++ })
    console.log('Profiles documents built: ' + count + ' tool(s).')
    return
  }
  const toolName = args.find((arg) => !arg.startsWith('--'))
  if (!toolName) {
    console.error('Usage: npm run docs:profiles -- <ToolName>')
    console.error('       npm run docs:profiles -- --all')
    process.exitCode = 1
    return
  }
  const tool = context.findToolByName(toolName)
  if (!tool) {
    console.error('Tool not found: ' + toolName)
    process.exitCode = 1
    return
  }
  if (!buildTool(tool)) {
    console.error('No profile presets found for ' + toolName + ' (expected ' + join(tool.toolDirectory, 'profiles', 'index.json') + ').')
    process.exitCode = 1
  }
}

module.exports = {
  buildProfilesPayload,
  buildProfilesDocument,
  ensureProfilesMenuItem,
  buildTool,
}

if (require.main === module) main()
