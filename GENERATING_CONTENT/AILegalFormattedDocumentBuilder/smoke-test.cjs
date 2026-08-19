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
T(docCss().indexOf('width:210mm') !== -1, 'docCss defines A4 pages');
DB.settings.pageSize = 'Letter';
T(docCss().indexOf('width:216mm') !== -1, 'docCss defines Letter pages');
DB.settings.pageSize = 'A4';
T(docCss().indexOf('page-break-after:always') !== -1, 'docCss breaks pages for print');
var st2 = buildStandaloneHtml('<div class="doc-page" data-lb-id="0">paginated</div>');
T(st2.indexOf('data-lb-id="0"') !== -1, 'standalone accepts pre-paginated pages html');

/* 4c. injected preview scripts must compile */
function extractScripts(html) {
  var out = [];
  var i = 0;
  while (true) {
    var a = html.indexOf('<script>', i);
    if (a === -1) break;
    var b = html.indexOf('</script>', a);
    if (b === -1) break;
    out.push(html.substring(a + 8, b));
    i = b + 9;
  }
  return out;
}
var scripts = extractScripts(pv);
T(scripts.length === 1, 'preview has one combined script block (' + scripts.length + ')');
for (var si = 0; si < scripts.length; si++) {
  try { new Function(scripts[si]); T(true, 'injected script #' + (si + 1) + ' compiles'); }
  catch (e2) { T(false, 'injected script #' + (si + 1) + ' compiles (' + e2.message + ')'); }
}
try { new Function(PAGINATOR_JS); T(true, 'PAGINATOR_JS compiles'); } catch (e3) { T(false, 'PAGINATOR_JS compiles (' + e3.message + ')'); }
try { new Function(EDIT_JS); T(true, 'EDIT_JS compiles'); } catch (e4) { T(false, 'EDIT_JS compiles (' + e4.message + ')'); }

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

/* 10. Phase-1: dynamic variables */
DB.variables = { partyA: { label: 'Party A', value: 'Acme Inc' }, partyB: { label: 'Party B', value: '' } };
DB.blocks = [
  { type: 'title', data: { text: 'Agreement {{partyA}}' } },
  { type: 'clause', data: { number: '1', text: '{{partyA}} and {{partyB}} agree. {{unknownVar}} placeholder.' } },
  { type: 'clause', data: { number: '2', text: 'Second clause.' } }
];
var vh = blocksToHtml();
T(vh.indexOf('Acme Inc') !== -1, 'renderVars substitutes values');
T(vh.indexOf('partyB') !== -1, 'renderVars shows empty var name');
T(vh.indexOf('unknownVar') !== -1, 'unknown vars stay visible as name');
T(varUsageCount('partyA') === 2, 'varUsageCount counts occurrences');
scanBlocksForVars();
T(DB.variables.unknownVar !== undefined && DB.variables.partyB !== undefined, 'scanBlocksForVars registers new vars');
setVariableValue('partyB', 'Beta Corp');
T(DB.variables.partyB.value === 'Beta Corp', 'setVariableValue updates registry');
T(applyAiOp({ replaceBlock: 1, block: { type: 'clause', data: { number: '1', text: '{{partyB}} wins.' } } }) === true, 'applyAiOp replace with vars');

/* 11. undo/redo + block operations */
_snapshotPush();
deleteBlockAt(0);
T(DB.blocks.length === 2, 'deleteBlockAt removes');
undo();
T(DB.blocks.length === 3, 'undo restores length');
redo();
T(DB.blocks.length === 2, 'redo reapplies deletion');
undo();
moveBlock(2, 0);
T(DB.blocks[0].type === 'clause' && DB.blocks[0].data.text === 'Second clause.', 'moveBlock reorders');
moveBlock(0, 2);
duplicateBlock(1);
T(DB.blocks.length === 4, 'duplicateBlock appends copy');
deleteBlockAt(1);
T(DB.blocks.length === 3, 'deleteBlockAt removes again');

renumberBlocks();
var rn = DB.blocks.filter(function (b) { return b.type === 'clause'; });
T(rn.length === 2 && String(rn[0].data.number) === '1' && String(rn[1].data.number) === '2', 'renumberBlocks renumbers clauses');

/* 12. markdown import + lint + readability + toc */
var md = markdownToBlocks('# Heading One\\nA paragraph of text.\\n- bullet one\\n- bullet two');
T(md.length === 3 && md[0].type === 'section' && md[2].type === 'bullets', 'markdownToBlocks parses md');
var lintRes = runLint();
T(Array.isArray(lintRes), 'runLint returns array');
var rdd = runReadability();
T(typeof rdd === 'object' && (rdd.avg === null || typeof rdd.avg === 'number'), 'runReadability returns object');
DB.blocks = [{ type: 'h', data: { text: 'Intro' } }, { type: 'section', data: { title: 'Terms' } }, { type: 'clause', data: { number: '1', text: 'x' } }, { type: 'toc', data: {} }];
var tocHtml = blocksToHtml();
T(tocHtml.indexOf('TABLE OF CONTENTS') !== -1, 'toc component renders TOC');

/* 13. Phase 2 — components, gap analysis, macros, variants */
T(!!LEGAL_COMPONENTS['non-compete'] && !!LEGAL_COMPONENTS['gdpr-dpa'] && !!LEGAL_COMPONENTS['settlement-deed'] && !!LEGAL_COMPONENTS['deed'], 'phase-2 components added');
T(LEGAL_COMPONENTS['non-compete'].render({}, S()).indexOf('NON-COMPETITION') !== -1, 'non-compete renders');
DB.blocks = [
  { type: 'title', data: { text: 'Non-Disclosure Agreement' } },
  { type: 'clause', data: { number: '1', text: 'Sample NDA text' } }
];
_detectDocType();
T(_docType === 'nda', 'doc type detected as nda');
var gap = runGapAnalysis();
T(gap.type === 'nda' && gap.missing.length >= 2, 'gap analysis finds missing clauses');
T(typeRulesBlock().indexOf('DOCUMENT TYPE RULES') !== -1, 'type rules block built');
T(Array.isArray(runTypeChecks()) && runTypeChecks().length > 0, 'type checks run');
T(handleMacro('/plain').indexOf('plain') !== -1, 'macro /plain expands');
T(handleMacro('/nonsense') === null, 'unknown macro rejected');
var vp = parseAiResponse('{"variants":[{"label":"Strict","replaceBlock":1,"block":{"type":"clause","data":{"text":"x"}}}]} Pick one.');
T(vp.op === null && vp.variants && vp.variants.length === 1 && vp.variants[0].label === 'Strict', 'variants parsed');
DB.blocks = [
  { type: 'clause', data: { number: '1', text: 'Alpha Corporation signs.' } },
  { type: 'paragraph', data: { text: 'Alpha Corporation pays.' } }
];
T(runFind('Alpha').length === 2, 'find matches blocks');
_walkBlockText(DB.blocks[0], function (o, k) { o[k] = String(o[k]).split('Alpha').join('Beta'); });
T(DB.blocks[0].data.text.indexOf('Beta Corporation') !== -1, 'walk replace changes text');
_snapshotPush();
DB.blocks = [{ type: 'clause', data: { number: '1', text: 'old' } }];
applyVariant({ label: 'Strict', op: { replaceBlock: 0, block: { type: 'clause', data: { number: '1', text: 'strict version' } } } });
T(DB.blocks[0].data.text === 'strict version', 'variant applied');

/* 14. Phase 2 — defined terms, markdown, a11y, history, snippets, comments, status */
DB.blocks = [
  { type: 'definitions', data: { terms: [{ term: 'Confidential Information', definition: 'secret data' }, { term: 'Parties', definition: 'the signatories' }] } },
  { type: 'clause', data: { number: '1', text: 'The Confidential Information is protected.' } }
];
var dt = collectDefinedTerms();
T(dt.length === 2 && dt[0].count >= 1, 'defined terms collected');
var mdOut = blocksToMarkdown();
T(mdOut.indexOf('**1.**') !== -1, 'markdown export includes clause');
var a11 = runA11yChecks();
T(Array.isArray(a11) && a11.length >= 4, 'a11y checks run');
DB.history = [];
DB.version = '2.0.0';
_pushHistory();
T(DB.history.length === 1, 'history snapshot pushed');
DB.snippets = [];
DB.blocks = [{ type: 'clause', data: { text: 'snippet me' } }];
saveBlockAsSnippet(0);
T(DB.snippets.length === 1, 'snippet saved');
insertSnippet(0);
T(DB.blocks.length === 2, 'snippet inserted');
deleteSnippet(0);
T(DB.snippets.length === 0, 'snippet deleted');
DB.comments = {};
addComment(0, 'Check this');
T((DB.comments[0] || []).length === 1, 'comment added');
toggleCommentResolve(0, DB.comments[0][0].id);
T(DB.comments[0][0].resolved === true, 'comment resolved');
deleteCommentAt(0, DB.comments[0][0].id);
T(!DB.comments[0], 'comment deleted');
DB.status = 'draft';
DB.statusLog = [];
setDocStatus('in-review');
T(DB.status === 'in-review' && DB.statusLog.length === 1, 'status transition logged');
setDocStatus('approved');
T(DB.status === 'in-review', 'approve blocked without admin role');

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
