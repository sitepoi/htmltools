// ── WEBPAGE EXPORT (npm run webpage:export) ────────────────────────────────
// Produces a fully self-contained copy of a tool's marketing page for the
// website: the shared design system (_docs/assets/webpage.css + webpage.js)
// is INLINED into docs/webpage-export.html, so the file can be pasted into
// the webpage content tool with zero external dependencies. The demo iframe
// keeps its relative source - replace it with the hosted demo URL when
// publishing.
//
// Usage:
//   npm run webpage:export -- <ToolName>
//   npm run webpage:export -- --all
const { readFileSync, writeFileSync, existsSync } = require('fs')
const { join } = require('path')
const context = require('./releaseContext')

function exportWebpage(tool) {
  const webpagePath = join(tool.docsDirectory, 'webpage.html')
  if (!existsSync(webpagePath)) {
    console.log('→ ' + tool.toolName + ': no docs/webpage.html - skipped')
    return false
  }
  let content = readFileSync(webpagePath, 'utf8')
  const css = readFileSync(join(context.ASSETS_DIR, 'webpage.css'), 'utf8')
  const js = readFileSync(join(context.ASSETS_DIR, 'webpage.js'), 'utf8')

  content = content.replace(
    /<link rel="stylesheet" href="[^"]*webpage\.css" \/>/,
    '<style>' + css + '</style>'
  )
  content = content.replace(
    /<script src="[^"]*webpage\.js" defer="defer"><\/script>/,
    '<script>' + js + '</script>'
  )
  // the header comment documents the export
  content = content.replace(
    /Updated: \[DATE\]\./,
    'Updated: [DATE]. EXPORTED COPY with the shared design system inlined - ready to paste into the website.'
  )

  const outputPath = join(tool.docsDirectory, 'webpage-export.html')
  writeFileSync(outputPath, content, 'utf8')
  console.log('→ ' + tool.toolName + ': exported to ' + outputPath)
  return true
}

function main() {
  const args = process.argv.slice(2)
  const requestedToolName = args.find((arg) => !arg.startsWith('--'))
  const tools = args.includes('--all')
    ? context.listToolParts()
    : [context.findToolByName(requestedToolName)].filter(Boolean)

  if (tools.length === 0) {
    console.error('Usage: npm run webpage:export -- <ToolName>   or   npm run webpage:export -- --all')
    process.exit(1)
  }

  let exportedCount = 0
  tools.forEach((tool) => {
    if (exportWebpage(tool)) exportedCount++
  })
  console.log('\nWebpage export complete: ' + exportedCount + ' tool(s).')
}

if (require.main === module) {
  main()
}

module.exports = { exportWebpage }
