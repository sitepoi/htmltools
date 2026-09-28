// Cross-check every $('id') / on('id', ...) reference in BrandSetGenerator.js
// against id="..." attributes in BrandSetGenerator.html
const fs = require('fs');
const path = require('path');
const dir = __dirname;

const html = fs.readFileSync(path.join(dir, 'BrandSetGenerator.html'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'BrandSetGenerator.js'), 'utf8');

const htmlIds = new Set();
const re = /id="([^"]+)"/g;
let m;
while ((m = re.exec(html))) htmlIds.add(m[1]);

const refs = new Set();
let r;
const reDollar = /\$\(\s*'([^']+)'\s*\)/g;
while ((r = reDollar.exec(js))) refs.add(r[1]);
const reOn = /\bon\(\s*'([^']+)'/g;
while ((r = reOn.exec(js))) refs.add(r[1]);

// ids referenced via template strings like 'pane-' + i are excluded from checks
const missing = [...refs].filter(id => !htmlIds.has(id) && id.indexOf('+') === -1);

console.log('html ids:', htmlIds.size, '| js static id refs:', refs.size);
if (missing.length) {
  missing.forEach(id => console.log('MISSING ID:', id));
  process.exit(1);
}
console.log('check-ids: all JS id references exist in HTML ✓');
