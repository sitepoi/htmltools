// Extract the inline <script> blocks of the catalog pages and syntax-check
// them, plus the generated data files.
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const uniconToolsDir = path.join(__dirname, '..', 'UNICON-TOOLS')
const targets = [
  {
    label: 'tools-catalog',
    dir: path.join(uniconToolsDir, 'tools-catalog'),
    page: 'tool-ideas-catalog.html',
    data: 'catalog-data.js'
  },
  {
    label: 'application-catalog',
    dir: path.join(uniconToolsDir, 'application-catalog'),
    page: 'application-ideas-catalog.html',
    data: 'application-catalog-data.js'
  }
]
targets.forEach(function (target) {
  console.log('=== ' + target.label + ' ===')
  const pagePath = path.join(target.dir, target.page)
  const html = fs.readFileSync(pagePath, 'utf8')
  const scripts = []
  const regex = /<script>([\s\S]*?)<\/script>/g
  let match
  while ((match = regex.exec(html)) !== null) scripts.push(match[1])
  console.log('script blocks:', scripts.length)
  scripts.forEach((code, index) => {
    try {
      new vm.Script(code, { filename: target.label + '-inline-' + index + '.js' })
      console.log('block ' + index + ': syntax OK (' + code.length + ' chars)')
    } catch (err) {
      console.log('block ' + index + ': SYNTAX ERROR: ' + err.message)
      process.exitCode = 1
    }
  })
  const dataPath = path.join(target.dir, target.data)
  if (fs.existsSync(dataPath)) {
    try {
      new vm.Script(fs.readFileSync(dataPath, 'utf8'), { filename: target.data })
      console.log(target.data + ': syntax OK')
    } catch (err) {
      console.log(target.data + ': SYNTAX ERROR: ' + err.message)
      process.exitCode = 1
    }
  }
})
