/* Cross-check el('...') references in AILegalFormattedDocumentBuilder.js
   against ids present in AILegalFormattedDocumentBuilder.html
   (plus ids that the JS creates dynamically). */
'use strict';
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const js = fs.readFileSync(path.join(dir, 'AILegalFormattedDocumentBuilder.js'), 'utf8');
const html = fs.readFileSync(path.join(dir, 'AILegalFormattedDocumentBuilder.html'), 'utf8');
const harness = fs.readFileSync(path.join(dir, 'test-harness.html'), 'utf8');

// ids created dynamically by JS
const dynamic = new Set(['toast-stack']);

// ids referenced via el('...')
const refs = new Set();
const re = /el\(\s*['"]([^'"]+)['"]\s*\)/g;
let m;
while ((m = re.exec(js)) !== null) refs.add(m[1]);

// ids defined in the tool HTML
const defined = new Set();
const idRe = /\bid\s*=\s*["']([^"']+)["']/g;
while ((m = idRe.exec(html)) !== null) defined.add(m[1]);

const missing = [];
refs.forEach(function (id) {
  if (!defined.has(id) && !dynamic.has(id)) missing.push(id);
});

console.log('el() references: ' + refs.size);
console.log('ids in tool HTML: ' + defined.size);
if (missing.length) {
  console.log('MISSING IN HTML:');
  missing.forEach(function (id) { console.log('  - ' + id); });
  process.exit(1);
}

// Harness must contain every id the tool HTML defines (inlined copy stays in sync)
const harnessMissing = [];
defined.forEach(function (id) {
  if (!new RegExp('id=["\']' + id + '["\']').test(harness)) harnessMissing.push(id);
});
if (harnessMissing.length) {
  console.log('MISSING IN HARNESS (out of sync with tool HTML):');
  harnessMissing.forEach(function (id) { console.log('  - ' + id); });
  process.exit(1);
}

// Danger scan: no raw closing script tags or HTML comments inside JS string literals
if (/['"]<\/script>['"]/.test(js)) {
  console.log('DANGER: raw </script> found inside a JS string literal');
  process.exit(1);
}
if (/['"]<!--['"]/.test(js)) {
  console.log('DANGER: raw <!-- found inside a JS string literal');
  process.exit(1);
}

console.log('ID CHECK: ALL PASS (' + refs.size + ' refs, ' + defined.size + ' ids, harness in sync)');
