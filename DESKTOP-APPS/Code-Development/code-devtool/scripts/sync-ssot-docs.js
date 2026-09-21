// CodeDevTool - syncs the SSOT documents into docs/ before packaging.
// The canonical documents live next to the app folder (Code-Development);
// packaged builds serve this bundled snapshot through the /docs routes
// (CODE-18, T-21). Run by the dist script, also safe to run manually.
'use strict'
const fs = require('fs')
const path = require('path')

const appFolder = path.join(__dirname, '..')
const canonicalFolder = path.join(appFolder, '..')
const targetFolder = path.join(appFolder, 'docs')

const documentNames = [
  'code-devtool-ssot.html',
  'ssot.css',
  'ssot.js',
  'tool-analysis.html',
  'document-system-rules.html'
]

fs.mkdirSync(targetFolder, { recursive: true })
let copiedCount = 0
for (const documentName of documentNames) {
  const sourcePath = path.join(canonicalFolder, documentName)
  if (!fs.existsSync(sourcePath)) {
    console.log('SKIP (missing in canonical folder): ' + documentName)
    continue
  }
  fs.copyFileSync(sourcePath, path.join(targetFolder, documentName))
  copiedCount++
}
console.log('SSOT docs synced into docs/ (' + copiedCount + '/' + documentNames.length + ' files)')
