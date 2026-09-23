// ── DOCS INDEX CODE REFRESH (npm run docs:index-code) ──────────────────────
// Rewrites ONLY the embedded code payload of docs/index.html (between the
// CODE-PAYLOAD markers) so the HTML / CSS / JS panes always match the
// tool's current app code. Run this after any code change - or let the
// publish flow do it automatically for changed tools.
// With --shots it refreshes the SCREENSHOTS-PAYLOAD instead (the index
// viewer data) - run it after npm run screenshots.
//
// Usage:
//   npm run docs:index-code -- <ToolName>      refresh one tool's code panes
//   npm run docs:index-code -- --all           refresh every tool's code panes
//   npm run docs:index-shots -- <ToolName>     refresh one tool's shots viewer
//   npm run docs:index-shots -- --all          refresh every tool's shots viewer
const { readFileSync, writeFileSync, existsSync } = require('fs')
const { join } = require('path')
const context = require('./releaseContext')
const { buildToolDocuments, buildCodePayload, buildScreenshotsPayload } = require('./init-docs')

const PAYLOAD_START = '<!-- CODE-PAYLOAD-START'
const PAYLOAD_END = '<!-- CODE-PAYLOAD-END -->'
const SHOTS_PAYLOAD_START = '<!-- SCREENSHOTS-PAYLOAD-START'
const SHOTS_PAYLOAD_END = '<!-- SCREENSHOTS-PAYLOAD-END -->'

function refreshToolIndexCode(tool) {
  buildToolDocuments(tool, true, false)   // ensure docs/index.html exists
  const indexPath = join(tool.docsDirectory, 'index.html')
  let content
  try { content = readFileSync(indexPath, 'utf8') } catch (_e) { return false }

  const startIndex = content.indexOf(PAYLOAD_START)
  const endIndex = content.indexOf(PAYLOAD_END)
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    console.log('→ ' + tool.toolName + ': index.html has no code-payload markers - run npm run docs:init')
    return false
  }

  const payloadText = JSON.stringify(buildCodePayload(tool)).replace(/<\//g, '<\\/')
  const newBlock = [
    PAYLOAD_START + ' - refresh-docs-index.js replaces the payload between these markers -->',
    '<script type="application/json" id="code-payload">' + payloadText + '</script>',
    PAYLOAD_END,
  ].join('\n')

  const refreshed = content.slice(0, startIndex) + newBlock + content.slice(endIndex + PAYLOAD_END.length)
  writeFileSync(indexPath, refreshed, 'utf8')
  return true
}

function refreshToolIndexScreenshots(tool) {
  buildToolDocuments(tool, true, false)   // ensure docs/index.html exists
  const indexPath = join(tool.docsDirectory, 'index.html')
  let content
  try { content = readFileSync(indexPath, 'utf8') } catch (_e) { return false }

  const startIndex = content.indexOf(SHOTS_PAYLOAD_START)
  const endIndex = content.indexOf(SHOTS_PAYLOAD_END)
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    console.log('→ ' + tool.toolName + ': index.html has no screenshots markers - run npm run docs:init -- --refresh-shells')
    return false
  }

  const payloadText = JSON.stringify(buildScreenshotsPayload(tool)).replace(/<\//g, '<\\/')
  const newBlock = [
    SHOTS_PAYLOAD_START + ' - refresh-docs-index.js replaces the payload between these markers -->',
    '<script type="application/json" id="shots-payload">' + payloadText + '</script>',
    SHOTS_PAYLOAD_END,
  ].join('\n')

  const refreshed = content.slice(0, startIndex) + newBlock + content.slice(endIndex + SHOTS_PAYLOAD_END.length)
  writeFileSync(indexPath, refreshed, 'utf8')
  return true
}

function main() {
  const args = process.argv.slice(2)
  const shotsMode = args.includes('--shots')
  const requestedToolName = args.find((arg) => !arg.startsWith('--'))
  const tools = args.includes('--all')
    ? context.listToolParts()
    : [context.findToolByName(requestedToolName)].filter(Boolean)

  if (tools.length === 0) {
    console.error('Usage: npm run docs:index-code -- <ToolName>   or   npm run docs:index-code -- --all')
    console.error('       npm run docs:index-shots -- <ToolName>   or   npm run docs:index-shots -- --all')
    process.exit(1)
  }

  let refreshedCount = 0
  tools.forEach((tool) => {
    const refreshed = shotsMode ? refreshToolIndexScreenshots(tool) : refreshToolIndexCode(tool)
    if (refreshed) {
      console.log('→ ' + tool.toolName + ': ' + (shotsMode ? 'screenshots payload' : 'code payload') + ' refreshed in docs/index.html')
      refreshedCount++
    }
  })
  console.log('\nIndex refresh complete: ' + refreshedCount + ' tool(s).')
}

if (require.main === module) {
  main()
}

module.exports = { refreshToolIndexCode, refreshToolIndexScreenshots }
