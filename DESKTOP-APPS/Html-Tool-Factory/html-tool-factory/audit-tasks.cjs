const fs = require('fs')
const path = require('path')
const ws = require('./src/workspace.js')
const roots = ['../../../BUSINESS', '../../../PERSONAL', '../../../UNICON-TOOLS']
let scanned = 0
const found = []
function walk(dir, depth) {
  if (depth > 8) return
  let names
  try { names = fs.readdirSync(dir, { withFileTypes: true }) } catch (e) { return }
  for (const entry of names) {
    if (!entry.isDirectory()) continue
    if (/^(node_modules|\.git|runs|selftest-output|ship-out|Chats)$/.test(entry.name)) continue
    const abs = path.join(dir, entry.name)
    const ssot = path.join(abs, 'docs', 'ssot.html')
    if (fs.existsSync(ssot)) {
      scanned += 1
      const raw = fs.readFileSync(ssot, 'utf8')
      const rawCount = (raw.match(/<div class="task-item"/g) || []).length
      const parsed = ws.parseSsotTasks(raw)
      if (rawCount !== parsed.length) found.push([abs, rawCount, parsed.length])
    }
    walk(abs, depth + 1)
  }
}
for (const root of roots) walk(root, 0)
console.log('ssot files scanned:', scanned)
console.log('tools whose drawer disagreed with the page:', found.length)
for (const [dir, raw, kept] of found) {
  console.log('  ' + dir.split(path.sep).slice(-3).join('/') + ' -> blocks ' + raw + ', rendered ' + kept)
}
