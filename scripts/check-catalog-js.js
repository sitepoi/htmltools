// Extract the inline <script> blocks of tools-catalog/tool-ideas-catalog.html
// and syntax-check them, plus the generated catalog-data.js.
const fs = require('fs')
const path = require('path')
const toolsCatalogDir = path.join(__dirname, '..', 'UNICON-TOOLS', 'tools-catalog')
const pagePath = path.join(toolsCatalogDir, 'tool-ideas-catalog.html')
const html = fs.readFileSync(pagePath, 'utf8')
const scripts = []
const regex = /<script>([\s\S]*?)<\/script>/g
let match
while ((match = regex.exec(html)) !== null) scripts.push(match[1])
console.log('script blocks:', scripts.length)
const vm = require('vm')
scripts.forEach((code, index) => {
  try {
    new vm.Script(code, { filename: 'inline-' + index + '.js' })
    console.log('block ' + index + ': syntax OK (' + code.length + ' chars)')
  } catch (err) {
    console.log('block ' + index + ': SYNTAX ERROR: ' + err.message)
    process.exitCode = 1
  }
})
const dataPath = path.join(toolsCatalogDir, 'catalog-data.js')
if (fs.existsSync(dataPath)) {
  try {
    new vm.Script(fs.readFileSync(dataPath, 'utf8'), { filename: 'catalog-data.js' })
    console.log('catalog-data.js: syntax OK')
  } catch (err) {
    console.log('catalog-data.js: SYNTAX ERROR: ' + err.message)
    process.exitCode = 1
  }
}
