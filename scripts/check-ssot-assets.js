// ── SHARED ASSETS CHECK (npm run ssot:check) ───────────────────────────────
// Verifies that every tool's SSOT and satellite documents link the SHARED
// design layer in _docs/assets/ (ssot.css, ssot.js, presentation.css,
// presentation.js, webpage.css, webpage.js). The design lives ONCE in
// _docs/assets - editing those files restyles every document instantly, so no
// document may drift into its own copy. social.html and index.html (the
// one-page docs shell) are intentionally self-contained - index.html is
// checked for EXISTENCE only.
// webpage.html links are reported as WARNINGS: a page still on the old
// self-contained format works, and it moves to the shared webpage design
// system when it is next rebuilt (npm run docs:init / docs:generate).
// Exit code 1 when a hard link is missing or wrong.
const { readFileSync, existsSync } = require('fs')
const { join } = require('path')
const releaseContext = require('./releaseContext')

const REQUIRED_LINKS = {
  'ssot.html': ['assets/ssot.css', 'assets/ssot.js'],
  'help.html': ['assets/ssot.css'],
  'updates.html': ['assets/ssot.css'],
  'presentation.html': ['assets/presentation.css', 'assets/presentation.js'],
}
const WEBPAGE_LINKS = ['assets/webpage.css', 'assets/webpage.js']

function main() {
  const tools = releaseContext.listToolParts()
  let checkedFiles = 0
  let failures = 0
  let warnings = 0

  tools.forEach((tool) => {
    const docsIndexPath = join(tool.docsDirectory, 'index.html')
    if (!existsSync(docsIndexPath)) {
      console.log('✗ ' + tool.toolName + ': docs/index.html is missing (run npm run docs:init)')
      failures++
    }
    Object.keys(REQUIRED_LINKS).forEach((fileName) => {
      const filePath = join(tool.docsDirectory, fileName)
      if (!existsSync(filePath)) {
        console.log('✗ ' + tool.toolName + ': ' + fileName + ' is missing')
        failures++
        return
      }
      checkedFiles++
      const content = readFileSync(filePath, 'utf8')
      REQUIRED_LINKS[fileName].forEach((assetPath) => {
        if (content.indexOf(assetPath) === -1) {
          console.log('✗ ' + tool.toolName + ': ' + fileName + ' does not link ' + assetPath)
          failures++
        }
      })
    })
    const webpagePath = join(tool.docsDirectory, 'webpage.html')
    if (existsSync(webpagePath)) {
      checkedFiles++
      const webpageContent = readFileSync(webpagePath, 'utf8')
      WEBPAGE_LINKS.forEach((assetPath) => {
        if (webpageContent.indexOf(assetPath) === -1) {
          console.log('! ' + tool.toolName + ': webpage.html still self-contained (no ' + assetPath + ') - rebuild it with npm run docs:init to adopt the shared webpage design system')
          warnings++
        }
      })
    }
  })

  if (failures > 0) {
    console.log('\nShared assets check FAILED: ' + failures + ' problem(s) across ' + tools.length + ' tools (' + checkedFiles + ' files checked).')
    console.log('Fix: every document must link the shared files in _docs/assets/, e.g. href="' + releaseContext.assetsRelativeFrom(join(releaseContext.ROOT, '_docs', 'assets')) + 'ssot.css"')
    process.exit(1)
  }
  console.log('→ Shared assets check OK: ' + tools.length + ' tools, ' + checkedFiles + ' documents all link the shared _docs/assets design layer.')
  if (warnings > 0) {
    console.log('→ ' + warnings + ' webpage.html page(s) still on the old self-contained format (warning only - they work; rebuild to adopt the shared design system).')
  }
  console.log('→ Edit _docs/assets/ssot.css and _docs/assets/ssot.js to restyle every SSOT, help and updates document at once.')
}

main()
