// Unicon Studio - document system extraction (CODE-38)
// Reads the complete document-system definition (the explainer html with
// every template and shared file embedded) and writes the embedded files
// into main/document-system/ so the create_document tool can scaffold
// documents in any opened folder. Re-run this script when the ruleset
// changes upstream.
//
// Routing:
//   *_template.html            -> main/document-system/templates/
//   ssot/onepager/presentation .css/.js -> main/document-system/assets/
//   everything else (node scripts, index generator, release tooling) is
//   reported and skipped - the desktop app has its own equivalents.
//
// A verbatim copy of the explainer is also placed next to the app folder
// as document-system-rules.html - it is served by the app server's /docs
// routes so the Docs overlay can always show the full ruleset.

const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs')
const { join } = require('path')

const sourceFilePath = process.argv[2] || join('D:', 'PROJECTS', 'UNICONHUB', 'CODE', 'sitepoicms', '_docs', 'rules', 'feature-document-tools.html')
const outputRoot = join(__dirname, '..', 'main', 'document-system')
const templatesDirectory = join(outputRoot, 'templates')
const assetsDirectory = join(outputRoot, 'assets')
const rulesCopyPath = join(__dirname, '..', '..', 'document-system-rules.html')

const templateFileNames = new Set([
  '_feature-template.html',
  '_help-template.html',
  '_marketing-template.html',
  '_updates-template.html',
  '_social-template.html',
  '_onepager-template.html',
  '_presentation-template.html',
  '_monthly-template.html'
])
const assetFileNames = new Set([
  'ssot.css', 'ssot.js',
  'onepager.css', 'onepager.js',
  'presentation.css', 'presentation.js'
])

function decodeHtmlEntities(escapedText) {
  return String(escapedText)
    .replace(/&#(\d+);/g, (_whole, digits) => String.fromCharCode(parseInt(digits, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_whole, hexDigits) => String.fromCharCode(parseInt(hexDigits, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function extractEmbeddedFiles(sourceContent) {
  const extracted = []
  // Each embedded file is one <details class="file"> whose <summary> holds
  // the file name and whose <pre><code> holds the escaped content.
  const detailsPattern = /<details class="file"[^>]*>([\s\S]*?)<\/details>/g
  let detailsMatch
  while ((detailsMatch = detailsPattern.exec(sourceContent)) !== null) {
    const detailsBlock = detailsMatch[1]
    const summaryMatch = /<summary>([\s\S]*?)<\/summary>/.exec(detailsBlock)
    const codeMatch = /<pre><code>([\s\S]*?)<\/code><\/pre>/.exec(detailsBlock)
    if (!summaryMatch || !codeMatch) continue
    // The summary is "<file name> <span class="tag">html</span>" - the file
    // name is everything before the tag badge.
    const summaryText = summaryMatch[1].split('<span')[0]
    const fileName = summaryText.replace(/<[^>]+>/g, '').trim()
    extracted.push({ fileName, content: decodeHtmlEntities(codeMatch[1]) })
  }
  return extracted
}

function main() {
  console.log('Source: ' + sourceFilePath)
  const sourceContent = readFileSync(sourceFilePath, 'utf8')
  const extracted = extractEmbeddedFiles(sourceContent)
  console.log('Embedded files found: ' + extracted.length)

  mkdirSync(templatesDirectory, { recursive: true })
  mkdirSync(assetsDirectory, { recursive: true })

  let templateCount = 0
  let assetCount = 0
  for (const file of extracted) {
    if (templateFileNames.has(file.fileName)) {
      writeFileSync(join(templatesDirectory, file.fileName), file.content, 'utf8')
      templateCount++
      console.log('  template: ' + file.fileName + ' (' + file.content.length + ' chars)')
    } else if (assetFileNames.has(file.fileName)) {
      writeFileSync(join(assetsDirectory, file.fileName), file.content, 'utf8')
      assetCount++
      console.log('  asset:    ' + file.fileName + ' (' + file.content.length + ' chars)')
    } else {
      console.log('  skipped:  ' + file.fileName + ' (app-specific tooling - not ported)')
    }
  }

  if (templateCount !== templateFileNames.size) {
    console.error('MISSING TEMPLATES: expected ' + templateFileNames.size + ', extracted ' + templateCount)
    process.exit(1)
  }
  if (assetCount !== assetFileNames.size) {
    console.error('MISSING ASSETS: expected ' + assetFileNames.size + ', extracted ' + assetCount)
    process.exit(1)
  }

  // Verbatim copy of the explainer for the built-in docs list.
  writeFileSync(rulesCopyPath, sourceContent, 'utf8')
  console.log('  ruleset copy: ' + rulesCopyPath)

  console.log('DONE: ' + templateCount + ' templates, ' + assetCount + ' shared assets.')
}

main()
