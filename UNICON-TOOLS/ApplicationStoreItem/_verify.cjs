'use strict';
// Temporary verification helper for ApplicationStoreItem (deleted after use).
const fs = require('fs');
const path = require('path');

const folder = __dirname;
const html = fs.readFileSync(path.join(folder, 'ApplicationStoreItem.html'), 'utf8');
const css = fs.readFileSync(path.join(folder, 'ApplicationStoreItem.css'), 'utf8');
const js = fs.readFileSync(path.join(folder, 'ApplicationStoreItem.js'), 'utf8');
const harness = fs.readFileSync(path.join(folder, 'test-harness.html'), 'utf8');

const problems = [];

// 1. Harness inline HTML must equal the tool HTML.
const startMarker = '<!-- TOOL HTML START -->';
const endMarker = '<!-- TOOL HTML END -->';
const startIndex = harness.indexOf(startMarker);
const endIndex = harness.indexOf(endMarker);
if (startIndex === -1 || endIndex === -1) {
  problems.push('Harness is missing the TOOL HTML markers.');
} else {
  const inlineHtml = harness.slice(startIndex + startMarker.length, endIndex).trim();
  if (inlineHtml !== html.trim()) {
    problems.push('Harness inline HTML differs from ApplicationStoreItem.html.');
    const htmlLines = html.trim().split(/\r?\n/);
    const inlineLines = inlineHtml.split(/\r?\n/);
    const max = Math.max(htmlLines.length, inlineLines.length);
    for (let index = 0; index < max; index++) {
      if (htmlLines[index] !== inlineLines[index]) {
        problems.push('First difference at line ' + (index + 1) + ':\n  tool:    ' + JSON.stringify(htmlLines[index]) + '\n  harness: ' + JSON.stringify(inlineLines[index]));
        break;
      }
    }
  }
}

// 2. Static ID references in JS exist in the tool HTML.
const htmlIds = new Set();
const idPattern = /\bid="([^"]+)"/g;
let idMatch;
while ((idMatch = idPattern.exec(html)) !== null) htmlIds.add(idMatch[1]);

const dynamicPrefixes = [
  'asi-doc-subline-', 'asi-doc-status-', 'asi-doc-pane-', 'asi-doc-part-',
  'asi-doc-gutter-', 'asi-doc-meta-', 'asi-doc-preview-frame-',
  'asi-doc-preview-status-', 'asi-doc-', 'asi-pane-'
];
function isDynamicId(id) {
  return dynamicPrefixes.some((prefix) => id.startsWith(prefix));
}

const referencedIds = new Set();
const refPatterns = [/\$\('([^']+)'\)/g, /getElementById\('([^']+)'\)/g, /on\('([^']+)'/g];
refPatterns.forEach((pattern) => {
  let match;
  while ((match = pattern.exec(js)) !== null) {
    const id = match[1];
    if (id.indexOf('asi-') !== 0) continue;
    if (id.indexOf("'") !== -1) continue;
    referencedIds.add(id);
  }
});
referencedIds.forEach((id) => {
  if (!htmlIds.has(id) && !isDynamicId(id)) problems.push('JS references missing static id: ' + id);
});

// 3. Tool HTML must be a fragment (no document tags, style or script tags).
const forbiddenTags = [/<html[\s>]/i, /<head(?:\s|>)/i, /<body[\s>]/i, /<style[\s>]/i, /<script[\s>]/i, /<\/script/i];
forbiddenTags.forEach((pattern) => {
  if (pattern.test(html)) problems.push('Tool HTML contains a forbidden document/script tag: ' + pattern);
});

// 4. JS inline-tokenizer safety.
if (js.includes('<!--')) problems.push('JS contains a raw <!-- sequence.');
const rawScriptClose = /<\/script/i;
if (rawScriptClose.test(js)) problems.push('JS contains a raw </script sequence.');
const rawScriptOpen = /<script/i;
if (rawScriptOpen.test(js)) problems.push('JS contains a raw <script sequence.');

// 5. CSS brace balance and no external imports.
const openBraces = (css.match(/{/g) || []).length;
const closeBraces = (css.match(/}/g) || []).length;
if (openBraces !== closeBraces) problems.push('CSS braces are unbalanced: ' + openBraces + ' open / ' + closeBraces + ' close.');
if (/@import/i.test(css)) problems.push('CSS uses @import (external resource).');
if (/url\(\s*['"]?https?:/i.test(css)) problems.push('CSS references an external URL.');

// 6. Build stamps.
if (!html.startsWith('<!-- html build ')) problems.push('HTML is missing its build stamp.');
if (!css.startsWith('/* css build ')) problems.push('CSS is missing its build stamp.');
if (!js.startsWith('/* js build ')) problems.push('JS is missing its build stamp.');
if (!/var TOOL_BUILD = '\d{4}-\d{2}-\d{2}-\d+'/.test(js)) problems.push('JS is missing TOOL_BUILD.');

// 7. Every data-act used in the rendered release/shot rows is handled somewhere.
const acts = new Set();
const actPattern = /data-act="([a-z-]+)"/g;
let actMatch;
const htmlAndJs = html + '\n' + js;
while ((actMatch = actPattern.exec(htmlAndJs)) !== null) acts.add(actMatch[1]);
const knownActs = ['doc-save', 'doc-reload', 'doc-preview', 'release-edit', 'release-delete', 'file-copy', 'file-remove', 'shot-up', 'shot-down', 'shot-copy', 'shot-icon', 'shot-remove'];
acts.forEach((act) => {
  if (!knownActs.includes(act)) problems.push('Unhandled data-act: ' + act);
});

// 8. The tool catalog is READ from source, never embedded in the three files.
// (Ordering keys and licence LABELS are vocabulary, not catalog rows.)
const catalogLiterals = ['B-G-01', 'uniconhub-tool-ideas', 'Document Q&A Assistant'];
catalogLiterals.forEach((literal) => {
  if (htmlAndJs.includes(literal) || css.includes(literal)) problems.push('The tool embeds catalog data (' + literal + ') - the catalog must be loaded from source.');
});
if (!/var DEFAULT_CATALOG_URL = '/.test(js)) problems.push('JS has no DEFAULT_CATALOG_URL.');

// 9. The Tools tab is wired end to end.
if (!/data-tab="tools"/.test(html)) problems.push('HTML has no tools tab button.');
if (!/id="asi-pane-tools"/.test(html)) problems.push('HTML has no tools pane.');
if (!/\['details', 'releases', 'tools', 'docs', 'screenshots', 'preview', 'logs'\]/.test(js)) problems.push('switchTab does not include the tools pane.');
['asi-catalog-list', 'asi-catalog-reload', 'asi-catalog-import', 'asi-selected-list', 'asi-selected-clear'].forEach((requiredId) => {
  if (!htmlIds.has(requiredId)) problems.push('Tools tab is missing the element: ' + requiredId);
});

if (problems.length) {
  console.log('FAIL');
  problems.forEach((problem) => console.log(' - ' + problem));
  process.exit(1);
}
console.log('PASS');
console.log('HTML ids: ' + htmlIds.size + ' | JS id references checked: ' + referencedIds.size + ' | data-acts: ' + acts.size);
