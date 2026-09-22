// ── SHARED ASSETS CHECK (npm run ssot:check) ───────────────────────────────
// Verifies that every tool's SSOT and satellite documents link the SHARED
// design layer in _docs/assets/ (ssot.css, ssot.js, presentation.css,
// presentation.js). The design lives ONCE in _docs/assets - editing those
// files restyles every document instantly, so no document may drift into its
// own copy. webpage.html and social.html are intentionally self-contained
// (they are pasted into the CMS / shared directly) and are not checked.
// Exit code 1 when any link is missing or wrong.
const { readFileSync, existsSync } = require('fs')
const { join } = require('path')
const releaseContext = require('./releaseContext')

const REQUIRED_LINKS = {
  'ssot.html': ['assets/ssot.css', 'assets/ssot.js'],
  'help.html': ['assets/ssot.css'],
  'updates.html': ['assets/ssot.css'],
  'presentation.html': ['assets/presentation.css', 'assets/presentation.js'],
}

function main() {
  const tools = releaseContext.listToolParts()
  let checkedFiles = 0
  let failures = 0

  tools.forEach((tool) => {
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
  })

  if (failures > 0) {
    console.log('\nShared assets check FAILED: ' + failures + ' problem(s) across ' + tools.length + ' tools (' + checkedFiles + ' files checked).')
    console.log('Fix: every document must link the shared files in _docs/assets/, e.g. href="' + releaseContext.assetsRelativeFrom(join(releaseContext.ROOT, '_docs', 'assets')) + 'ssot.css"')
    process.exit(1)
  }
  console.log('→ Shared assets check OK: ' + tools.length + ' tools, ' + checkedFiles + ' documents all link the shared _docs/assets design layer.')
  console.log('→ Edit _docs/assets/ssot.css and _docs/assets/ssot.js to restyle every SSOT, help and updates document at once.')
}

main()
