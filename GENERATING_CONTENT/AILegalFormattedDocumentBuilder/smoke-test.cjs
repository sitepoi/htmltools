/* Smoke test for AILegalFormattedDocumentBuilder.js — pure logic in Node.
   Evaluates the tool JS with minimal stubs; assertions are appended to the
   SAME eval string (function-scoped vars are not reachable from outside). */
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'AILegalFormattedDocumentBuilder.js'), 'utf8');

// Minimal stubs — tool.onReady captures the callback without running it.
const stubs = `
var _capturedReady = null;
var _notifyLog = [];
var fakeEl = function() {
  var e = {
    style: {}, classList: { add: function(){}, remove: function(){}, toggle: function(){} },
    addEventListener: function(){}, querySelectorAll: function(){ return []; },
    querySelector: function(){ return null; }, appendChild: function(){},
    setAttribute: function(){}, getAttribute: function(){ return null; },
    value: '', textContent: '', innerHTML: '', options: [], children: [], childNodes: []
  };
  return e;
};
var document = {
  getElementById: function(id) {
    if (id === 'toast-stack') return null;
    return null;
  },
  createElement: function() { return fakeEl(); },
  querySelectorAll: function() { return []; },
  querySelector: function() { return null; },
  addEventListener: function() {},
  body: fakeEl(),
  head: fakeEl()
};
var navigator = { clipboard: { writeText: function(){ return Promise.resolve(); } } };
var window = { addEventListener: function(){}, open: function(){}, location: { origin: 'https://test.local' } };
var URL = { createObjectURL: function(){ return 'blob:x'; }, revokeObjectURL: function(){} };
var Blob = function(parts, opts) { this.parts = parts; this.opts = opts; };
var DOMParser = function() { this.parseFromString = function(){ return { body: { childNodes: [], querySelectorAll: function(){ return []; } } }; }; };
var tool = {
  onReady: function(cb) { _capturedReady = cb; },
  getValue: function() { return null; },
  setValue: function() {},
  onValueChange: function() {},
  param: function(name, def) { return def; },
  isReadOnly: function() { return false; },
  onReadonlyChange: function() {},
  getUser: function() { return null; },
  notify: function(msg) { _notifyLog.push(msg); },
  resize: function() {},
  declareParams: function() {},
  openUrl: function() {},
  requestObjects: function() {},
  requestAI: function() {},
  requestAIStream: function() {}
};
`;

const asserts = `
var failures = [];
function T(cond, label) {
  if (cond) { console.log('  PASS ' + label); }
  else { failures.push(label); console.log('  FAIL ' + label); }
}

/* 1. Turkish-safe slugify (memory note: NFKD BEFORE transliteration) */
T(slugify('İstanbul Sözleşmesi') === 'istanbul-sozlesmesi', 'slugify İstanbul Sözleşmesi');
T(slugify('Service Agreement!') === 'service-agreement', 'slugify plain');

/* 2. Component library */
var keys = Object.keys(LEGAL_COMPONENTS);
T(keys.length >= 40, 'component count >= 40 (got ' + keys.length + ')');
T(catalogText().indexOf('signature-block') !== -1, 'catalog includes signature-block');
T(LEGAL_COMPONENTS['confidentiality'] && LEGAL_COMPONENTS['html'], 'has boilerplate + html blocks');

/* 3. blocksToHtml with sample data */
DB.blocks = [
  { type: 'title', data: { text: 'Test Agreement <b>unsafe</b>' } },
  { type: 'clause', data: { number: '1.1', text: 'A <clause> & "quote"' } },
  { type: 'page-break', data: {} },
  { type: 'bogus-type', data: {} },
  { type: 'html', data: { html: '<div style="x">raw</div>' } }
];
DB.settings = { fontFamily: 'Times New Roman', fontSize: '12pt', color: '#111111', lineHeight: '1.6' };
var bh = blocksToHtml();
T(bh.indexOf('data-lb-id="0"') !== -1, 'blocks wrapped with data-lb-id');
T(bh.indexOf('<b>unsafe</b>') === -1, 'title text escaped');
T(bh.indexOf('&lt;clause&gt;') !== -1, 'clause text escaped');
T(bh.indexOf('lb-page-break') !== -1, 'page-break class rendered');
T(bh.indexOf('[unknown block type: bogus-type]') !== -1, 'unknown block placeholder');
T(bh.indexOf('<div style="x">raw</div>') !== -1, 'html block raw passthrough');

/* 4. Preview & standalone docs — source-level escaping, runtime content */
T(src.indexOf('</script>') === -1, 'JS source has no raw closing script tag (escaped as <\\/script>)');
T(src.indexOf('<!--') === -1, 'JS source has no raw HTML comment opener');
var pv = buildPreviewDoc();
T(pv.indexOf('</script>') !== -1, 'preview srcdoc contains the real closing script tag at runtime');
T(pv.indexOf('lbSel') !== -1, 'preview doc includes selection relay');
T(pv.indexOf('lbCmd') !== -1, 'preview doc includes edit-mode command handler');
T(pv.indexOf('function paginate()') !== -1, 'preview doc includes the paginator');
T(pv.indexOf('pages-wrap') !== -1, 'preview doc has the paginated pages container');
T(pv.indexOf('doc-sheet') !== -1, 'preview doc has the hidden block source sheet');
var st = buildStandaloneHtml();
T(st.indexOf('<!DOCTYPE html>') === 0, 'standalone starts with doctype');
T(st.indexOf('<style>') !== -1, 'standalone embeds styles');
T(st.indexOf('doc-page') !== -1, 'standalone has a doc-page fallback');
T(st.indexOf('@page{size:A4') !== -1, 'standalone has A4 print page rule');
T(docCss().indexOf('.doc-page{width:210mm') !== -1, 'docCss defines A4 pages');
T(docCss().indexOf('page-break-after:always') !== -1, 'docCss breaks pages for print');
var st2 = buildStandaloneHtml('<div class="doc-page" data-lb-id="0">paginated</div>');
T(st2.indexOf('data-lb-id="0"') !== -1, 'standalone accepts pre-paginated pages html');

/* 4b. manual-edit overrides */
DB.blocks = [{ type: 'clause', data: { number: '1', text: 'original' } }];
var r0 = blocksToHtml();
T(r0.indexOf('original') !== -1 && r0.indexOf('manualHtml') === -1, 'render uses data when no manualHtml');
DB.blocks[0].data.manualHtml = '<p>hand-edited</p>';
T(blocksToHtml().indexOf('hand-edited') !== -1, 'manualHtml overrides generated markup');

/* 5. AI response parsing */
var r1 = parseAiResponse('Here is the change\\n\\n{"insertAfter":2,"block":{"type":"confidentiality","data":{}}}\\n\\nDone.\\n[[suggest_more]] More work');
T(r1.op && r1.op.insertAfter === 2, 'parse insertAfter op');
T(r1.suggests.length === 1 && r1.suggests[0].text === 'More work', 'parse suggestions');
T(r1.summary.indexOf('Done') !== -1, 'summary extracted');
var r2 = parseAiResponse('{"replaceBlock":0,"block":{"type":"clause","data":{"text":"x"}}}');
T(r2.op && r2.op.replaceBlock === 0, 'parse replaceBlock op');
var r3 = parseAiResponse('Just chatting, no JSON here.');
T(r3.op === null && r3.summary.length > 0, 'chat-only response has no op');
var r4 = parseAiResponse('{"blocks":[{"type":"clause","data":{}},{"type":"nope","data":{}}]}');
T(r4.op && r4.op.blocks.length === 2, 'parse full blocks op');

/* 6. applyAiOp */
DB.blocks = [
  { type: 'clause', data: { text: 'one' } },
  { type: 'clause', data: { text: 'two' } },
  { type: 'clause', data: { text: 'three' } }
];
T(applyAiOp({ replaceBlock: 1, block: { type: 'paragraph', data: { text: 'X' } } }) === true, 'replaceBlock applied');
T(DB.blocks[1].type === 'paragraph', 'replaced block type');
T(DB.blocks.length === 3, 'replaceBlock keeps length');
T(applyAiOp({ replaceBlock: 5, block: { type: 'paragraph', data: {} } }) === false, 'replaceBlock out of range rejected');
T(applyAiOp({ insertAfter: 0, block: { type: 'severability', data: {} } }) === true, 'insertAfter applied');
T(DB.blocks[1].type === 'severability' && DB.blocks.length === 4, 'insertAfter position');
T(applyAiOp({ insertAfter: -1, block: { type: 'waiver', data: {} } }) === true, 'insertAfter -1 (top)');
T(DB.blocks[0].type === 'waiver', 'insertAfter -1 position');
T(applyAiOp({ deleteBlock: 2 }) === true, 'deleteBlock applied');
T(applyAiOp({ deleteBlock: 99 }) === false, 'deleteBlock out of range rejected');
T(applyAiOp({ blocks: [{ type: 'nope', data: {} }, { type: 'title', data: { text: 'T' } }] }) === true, 'blocks op applies (filtering)');
T(DB.blocks.length === 1 && DB.blocks[0].type === 'title', 'blocks op sanitized');

/* 7. sanitizeBlock */
T(sanitizeBlock({ type: 'clause', data: { text: 1 } }) !== null, 'sanitize accepts known type');
T(sanitizeBlock({ type: 'CLAUSE', data: {} }).type === 'clause', 'sanitize lowercases type');
T(sanitizeBlock({ type: 'evil', data: {} }) === null, 'sanitize rejects unknown type');
T(sanitizeBlock({ type: 'clause', data: 'not-an-object' }).data !== null && typeof sanitizeBlock({ type: 'clause', data: 'x' }).data === 'object', 'sanitize coerces bad data');

/* 8. extraction */
T(_extractJson('no json') === null, '_extractJson null for no json');
T(_extractJson('x {"a":{"b":1}} y') === '{"a":{"b":1}}', '_extractJson balanced nested');
T(_looksLikeDocOp({ deleteBlock: 1 }) === true, '_looksLikeDocOp delete');
T(_looksLikeDocOp({ hello: 1 }) === false, '_looksLikeDocOp rejects junk');

/* 9. onReady callback captured, params declared */
T(typeof _capturedReady === 'function', 'tool.onReady captured');

console.log('');
if (failures.length) {
  console.log('SMOKE TEST FAILURES: ' + failures.length);
  failures.forEach(function(f) { console.log('  - ' + f); });
  process.exit(1);
} else {
  console.log('SMOKE TEST: ALL PASS');
}
`;

const wrapped = '(function(){\n' + stubs + '\n' + src + '\n' + asserts + '\n})();';
try {
  eval(wrapped);
} catch (e) {
  console.error('EVAL ERROR:', e.message);
  process.exit(1);
}
