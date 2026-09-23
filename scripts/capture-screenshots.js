// ── TOOL SCREENSHOTS (npm run screenshots) ─────────────────────────────────
// Captures screenshots of a tool's test harness (with sample data) into
// docs/screenshots/ using headless Edge. Nine shots per tool (desktop pages
// + one mobile view) so the PUBLIC marketing page can show a screenshot
// GALLERY instead of a live demo - the tool's code never leaves the store.
//   01-dashboard-desktop.png    04-transactions-desktop.png  07-assistant
//   02-dashboard-mobile.png     05-expense-finder-desktop    08-reports
//   03-documents-desktop.png    06-gst-desktop               09-settings
// The page shots need the harness ?page= query param. When a harness does
// not support a page, the capture duplicates the dashboard - duplicates are
// detected byte-for-byte and deleted, so a tool without page support keeps
// only its unique shots.
// Also writes docs/screenshots/screenshots.json - the manifest with each
// shot's label, page, viewport, REAL pixel dimensions (read from the PNG
// header) and capture time. docs/index.html (screenshots viewer), the
// webpage gallery, the help "What it looks like" figures and the social
// media kit all read these files.
//
// Usage:
//   npm run screenshots -- <ToolName>
//   npm run screenshots -- --all
const { execSync } = require('child_process')
const { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } = require('fs')
const { join } = require('path')
const { createHash } = require('crypto')
const context = require('./releaseContext')

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const SHOT_SPECS = [
  { name: '01-dashboard-desktop.png', label: 'Dashboard (desktop)', page: 'dashboard', size: '1440,900', query: '?sample=1' },
  { name: '02-dashboard-mobile.png', label: 'Dashboard (mobile)', page: 'dashboard', size: '390,844', query: '?sample=1' },
  { name: '03-documents-desktop.png', label: 'Documents (desktop)', page: 'documents', size: '1440,900', query: '?sample=1&page=documents' },
  { name: '04-transactions-desktop.png', label: 'Transactions (desktop)', page: 'transactions', size: '1440,900', query: '?sample=1&page=transactions' },
  { name: '05-expense-finder-desktop.png', label: 'Expense Finder (desktop)', page: 'finder', size: '1440,900', query: '?sample=1&page=finder' },
  { name: '06-gst-desktop.png', label: 'GST / PST (desktop)', page: 'gst', size: '1440,900', query: '?sample=1&page=gst' },
  { name: '07-assistant-desktop.png', label: 'AI Assistant (desktop)', page: 'assistant', size: '1440,900', query: '?sample=1&page=assistant' },
  { name: '08-reports-desktop.png', label: 'Reports (desktop)', page: 'reports', size: '1440,900', query: '?sample=1&page=reports' },
  { name: '09-settings-desktop.png', label: 'Settings (desktop)', page: 'settings', size: '1440,900', query: '?sample=1&page=settings' },
]

// Reads width/height straight from the PNG IHDR (bytes 16-23).
function readPngSize(filePath) {
  try {
    const header = readFileSync(filePath)
    if (header.length < 24 || header.readUInt32BE(0) !== 0x89504e47) return null
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) }
  } catch (_e) { return null }
}

function fileHash(filePath) {
  try { return createHash('sha256').update(readFileSync(filePath)).digest('hex') } catch (_e) { return '' }
}

function screenshotTool(tool) {
  const harnessPath = join(tool.toolDirectory, 'app', 'test-harness.html')
  if (!existsSync(harnessPath)) {
    console.log('→ ' + tool.toolName + ': no app/test-harness.html - skipped')
    return false
  }
  const screenshotsDirectory = join(tool.docsDirectory, 'screenshots')
  mkdirSync(screenshotsDirectory, { recursive: true })
  const harnessUrl = 'file:///' + harnessPath.replace(/\\/g, '/')

  const manifest = { generatedAt: new Date().toISOString(), shots: [] }
  const seenHashes = new Map()   // hash -> file that produced it first

  SHOT_SPECS.forEach((shot) => {
    const outputPath = join(screenshotsDirectory, shot.name)
    try {
      execSync(
        `"${EDGE}" --headless=new --disable-gpu --screenshot="${outputPath}" --window-size=${shot.size} --virtual-time-budget=10000 --hide-scrollbars "${harnessUrl}${shot.query}"`,
        { stdio: 'pipe', timeout: 90000 }
      )
      const size = readPngSize(outputPath)
      if (!size) {
        console.log('→ ' + tool.toolName + ': ' + shot.name + ' not produced')
        return
      }
      const hash = fileHash(outputPath)
      if (seenHashes.has(hash)) {
        // the page did not change (harness has no ?page support) - keep the
        // gallery honest: one unique view per shot
        try { unlinkSync(outputPath) } catch (_e) { /* keep going */ }
        console.log('→ ' + tool.toolName + ': ' + shot.name + ' skipped (same view as ' + seenHashes.get(hash) + ')')
        return
      }
      seenHashes.set(hash, shot.name)
      manifest.shots.push({
        file: shot.name,
        label: shot.label,
        page: shot.page,
        viewport: shot.size.replace(',', 'x'),
        width: size.width,
        height: size.height,
        capturedAt: new Date().toISOString(),
      })
      console.log('→ ' + tool.toolName + ': ' + shot.name + ' (' + size.width + 'x' + size.height + ')')
    } catch (error) {
      console.log('→ ' + tool.toolName + ': ' + shot.name + ' FAILED (' + String(error.message).slice(0, 80) + ')')
    }
  })

  writeFileSync(join(screenshotsDirectory, 'screenshots.json'), JSON.stringify(manifest, null, 2), 'utf8')
  console.log('→ ' + tool.toolName + ': screenshots.json written (' + manifest.shots.length + ' unique shot(s))')
  return manifest.shots.length > 0
}

function main() {
  const args = process.argv.slice(2)
  const requestedToolName = args.find((arg) => !arg.startsWith('--'))
  const tools = args.includes('--all')
    ? context.listToolParts()
    : [context.findToolByName(requestedToolName)].filter(Boolean)

  if (tools.length === 0) {
    console.error('Usage: npm run screenshots -- <ToolName>   or   npm run screenshots -- --all')
    process.exit(1)
  }

  let capturedCount = 0
  tools.forEach((tool) => {
    if (screenshotTool(tool)) capturedCount++
  })
  console.log('\nScreenshots complete: ' + capturedCount + ' tool(s) captured.')
  console.log('The page shots need the harness ?page= query param - tools without it keep their unique shots only.')
}

if (require.main === module) {
  main()
}

module.exports = { screenshotTool }
