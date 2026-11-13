const fs = require('fs');
const path = require('path');
const appDir = path.join(__dirname, '..', 'BUSINESS', 'GENERAL', 'people-hr', 'time-attendance', 'StaffTimesheet', 'app');
const html = fs.readFileSync(path.join(appDir, 'StaffTimesheet.html'), 'utf8');
const css = fs.readFileSync(path.join(appDir, 'StaffTimesheet.css'), 'utf8');
const js = fs.readFileSync(path.join(appDir, 'StaffTimesheet.js'), 'utf8');
const harness = fs.readFileSync(path.join(appDir, 'test-harness.html'), 'utf8');
const problems = [];

const htmlIds = new Set();
const idRe = /\bid="([^"]+)"/g;
let m;
while ((m = idRe.exec(html))) htmlIds.add(m[1]);

const dynamicIds = new Set([
  'tms-entry-date', 'tms-entry-project', 'tms-entry-start', 'tms-entry-end', 'tms-entry-break',
  'tms-entry-break-paid', 'tms-entry-activity', 'tms-entry-category', 'tms-entry-billable',
  'tms-entry-notes', 'tms-entry-tags', 'tms-entry-preview', 'tms-entry-error',
  'tms-entry-delete', 'tms-entry-duplicate', 'tms-entry-cancel', 'tms-entry-save',
  'tms-entry-view-close', 'tms-reject-reason', 'tms-reject-error', 'tms-reject-cancel',
  'tms-reject-confirm', 'tms-import-text', 'tms-import-error', 'tms-import-cancel',
  'tms-import-confirm', 'tms-confirm-cancel', 'tms-confirm-ok', 'tms-copy-text',
  'tms-copy-close', 'tms-size-text', 'tms-size-fill', 'tms-size-note', 'tms-period-anchor'
]);

const jsIds = new Set();
const jsIdRe = /(?:\$\(\"#|\$\(\'#|getElementById\(\"|getElementById\(\')/g;
let idx = 0;
while (idx < js.length) {
  const pos = js.indexOf('tms-', idx);
  if (pos === -1) break;
  let start = pos;
  while (start > 0 && /[A-Za-z0-9_-]/.test(js[start - 1])) start -= 1;
  let end = pos;
  while (end < js.length && /[A-Za-z0-9_-]/.test(js[end])) end += 1;
  const token = js.slice(start, end);
  const before = js.slice(Math.max(0, start - 3), start);
  if (before === '"#\'' || before === '"\')' || before === "'#\"" || before === '"#') jsIds.add(token);
  idx = end;
}
// Simpler: capture quoted ids passed to $()/getElementById.
const quotedIdRe = /(?:\$\(|getElementById\()\s*["']#?([A-Za-z0-9_-]+)["']/g;
const quotedIds = new Set();
while ((m = quotedIdRe.exec(js))) quotedIds.add(m[1]);

quotedIds.forEach((id) => {
  if (!htmlIds.has(id) && !dynamicIds.has(id)) problems.push('JS references unknown id: ' + id);
});

if (js.indexOf('</' + 'script') !== -1) problems.push('JS contains a raw closing script sequence');
if (js.indexOf('<!--') !== -1) problems.push('JS contains a raw HTML comment opener');

const cssOpen = (css.match(/\{/g) || []).length;
const cssClose = (css.match(/\}/g) || []).length;
if (cssOpen !== cssClose) problems.push('CSS braces differ: ' + cssOpen + ' open / ' + cssClose + ' close');

const external = /(?:src|href)\s*=\s*["'](https?:|\/\/)/gi;
if (external.test(html)) problems.push('HTML references an external resource');
if (external.test(css)) problems.push('CSS references an external resource');

if (!harness.includes('<!-- TOOL-HTML-START -->') || !harness.includes('<!-- TOOL-HTML-END -->')) problems.push('Harness template markers missing');
if (!harness.includes('id="tms-app"')) problems.push('Harness template does not contain the tool markup');
if (!harness.includes('StaffTimesheet.js')) problems.push('Harness does not load StaffTimesheet.js');

console.log('HTML ids: ' + htmlIds.size + ', JS quoted ids: ' + quotedIds.size);
console.log(problems.length ? 'PROBLEMS:\n- ' + problems.join('\n- ') : 'All static checks passed.');
process.exitCode = problems.length ? 1 : 0;
