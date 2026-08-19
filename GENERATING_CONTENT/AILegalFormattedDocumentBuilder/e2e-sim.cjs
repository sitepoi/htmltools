/* End-to-end simulation for AILegalFormattedDocumentBuilder.js.
   Runs tool.onReady + a full chat round-trip + selection + formatting
   against a stubbed DOM. Catches runtime wiring errors that pure-logic
   smoke tests miss. */
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'AILegalFormattedDocumentBuilder.js'), 'utf8');

const stubs = `
var _els = {};
var _readyCb = null;
var _savedValues = [];
var _streamReq = null;
var _sessionsStore = [];
function fakeEl(id) {
  var e = {
    id: id || '',
    style: {}, disabled: false, value: '', textContent: '', innerHTML: '',
    srcdoc: '', className: '', classList: {
      _open: false,
      add: function(c) { if (c === 'open') this._open = true; },
      remove: function(c) { if (c === 'open') this._open = false; },
      toggle: function(c) { if (c === 'open') this._open = !this._open; },
      contains: function(c) { return c === 'open' ? this._open : false; }
    },
    options: [], children: [], childNodes: [],
    addEventListener: function(evt, cb) { (e._listeners = e._listeners || {})[evt] = cb; },
    removeEventListener: function() {},
    querySelector: function() { return fakeEl(); },
    querySelectorAll: function() { return []; },
    appendChild: function(c) { e.children.push(c); },
    removeChild: function() {},
    setAttribute: function() {}, getAttribute: function() { return null; },
    focus: function() {}, select: function() {}, click: function() {},
    closest: function() { return null; },
    parentNode: null,
    scrollTop: 0, scrollHeight: 0, clientHeight: 0,
    _listeners: {}
  };
  return e;
}
function getEl(id) { if (!_els[id]) _els[id] = fakeEl(id); return _els[id]; }
var document = {
  getElementById: function(id) { return getEl(id); },
  createElement: function() { return fakeEl(); },
  querySelectorAll: function() { return []; },
  querySelector: function() { return null; },
  addEventListener: function() {},
  body: fakeEl('body'),
  head: fakeEl('head')
};
var navigator = { clipboard: { writeText: function() { return Promise.resolve(); } } };
var window = { addEventListener: function() {}, open: function() { return null; }, location: { origin: 'https://test.local' }, docx: null };
var URL = { createObjectURL: function() { return 'blob:x'; }, revokeObjectURL: function() {} };
function Blob(parts, opts) { this.parts = parts; this.opts = opts; }
var DOMParser = function() { this.parseFromString = function() { return { body: { childNodes: [], querySelectorAll: function() { return []; } } }; }; };
var tool = {
  onReady: function(cb) { _readyCb = cb; },
  getValue: function() { return _savedValues.length ? _savedValues[_savedValues.length - 1] : null; },
  setValue: function(data) { _savedValues.push(JSON.parse(JSON.stringify(data))); },
  onValueChange: function() {},
  param: function(name, def) { return def; },
  isReadOnly: function() { return false; },
  onReadonlyChange: function() {},
  getUser: function() { return { id: 'u1', name: 'Tester', roles: ['editor'] }; },
  notify: function() {}, resize: function() {},
  declareParams: function() {}, openUrl: function() {},
  requestAI: function() {}, requestAIStream: function(p, c, cb) { _streamReq = { prompt: p, cb: cb }; },
  requestObjects: function(action, params, cb) {
    if (action === 'query') { cb(null, { objects: _sessionsStore.slice() }); }
    else if (action === 'create') {
      var obj = { id: 's' + _sessionsStore.length, name: params.name, _parentObjectId: 'parent-1', productData: params.productData };
      _sessionsStore.push(obj);
      cb(null, { object: obj });
    } else if (action === 'update') {
      for (var i = 0; i < _sessionsStore.length; i++) {
        if (_sessionsStore[i].id === params.objectId) {
          var old = (_sessionsStore[i].productData || {}).data_categoriesBased || {};
          _sessionsStore[i].productData = { data_categoriesBased: Object.assign({}, old, (params.productData || {}).data_categoriesBased || {}) };
        }
      }
      cb(null, { ok: true });
    } else if (action === 'delete') {
      _sessionsStore = _sessionsStore.filter(function(s) { return s.id !== params.objectId; });
      cb(null, { ok: true });
    } else cb(null, { ok: true });
  }
};
`;

const asserts = `
var failures = [];
function T(cond, label) {
  if (cond) { console.log('  PASS ' + label); }
  else { failures.push(label); console.log('  FAIL ' + label); }
}

/* Run onReady */
_readyCb(null, {});
T(DB.version === '1.0.0', 'onReady ran with defaults');
T(DB.settings.fontFamily === 'Times New Roman', 'default settings applied');
T(_els['fmt-font'] && _els['fmt-font'].innerHTML.indexOf('Georgia') !== -1, 'font select populated');
T(_els['doc-preview'] && _els['doc-preview'].srcdoc.indexOf('doc-sheet') !== -1, 'preview mounted on ready');

/* Full chat round-trip */
_els['chat-input'].value = 'Draft a Non-Disclosure Agreement';
sendChatMessage();
T(_aiCallActive === true, 'AI active flag set on send');
T(_els['btn-chat-send'].disabled === true, 'send button disabled while streaming');
T(_chatMessages.length === 1 && _chatMessages[0].role === 'user', 'user message recorded');
T(_streamReq !== null && _streamReq.prompt.indexOf('COMPONENT LIBRARY') !== -1, 'stream prompt built with catalog');
T(_streamReq.prompt.indexOf('The document is EMPTY') !== -1, 'prompt says document is empty');

var mockBlocks = JSON.stringify({ blocks: [
  { type: 'title', data: { text: 'Non-Disclosure Agreement' } },
  { type: 'parties-block', data: { parties: [{ name: 'Company A' }, { name: 'Company B' }] } },
  { type: 'confidentiality', data: {} },
  { type: 'signature-block', data: { parties: [{ name: 'Company A' }, { name: 'Company B' }] } }
] }) + '\\n\\nDrafted your NDA.\\n[[suggest_more]] Add a term clause';
_streamReq.cb.onToken(mockBlocks.substring(0, 40));
_streamReq.cb.onToken(mockBlocks.substring(40));
_streamReq.cb.onComplete(mockBlocks);

T(_aiCallActive === false, 'AI active cleared after complete');
T(DB.blocks.length === 4, 'blocks applied from AI response (' + DB.blocks.length + ')');
T(DB.version === '1.1.0', 'version bumped minor after AI edit');
T(_chatMessages.length === 2 && _chatMessages[1].role === 'ai', 'AI message recorded');
T(_chatMessages[1].opts && _chatMessages[1].opts.length === 1, 'suggestion chip parsed');
T(_savedValues.length > 0, 'value persisted via tool.setValue');
T(_savedValues[_savedValues.length - 1].blocks.length === 4, 'persisted slim value contains blocks');
T(_els['doc-preview'].srcdoc.indexOf('data-lb-id="0"') !== -1, 'preview re-mounted with blocks');
T(_els['preview-empty'].classList !== undefined, 'preview empty toggled');

/* Session created on first message + messages saved */
T(DB.activeSessionId !== '', 'session id assigned');
T(_sessionsStore.length === 1, 'session object created in mock store');
T(_sessionsStore[0].productData.data_categoriesBased.messages.length === 2, 'messages mirrored to session store');

/* Selection targeting */
setSelectionTarget({ idx: 0, type: 'title', text: 'Non-Disclosure Agreement' });
T(_selTarget && _selTarget.idx === 0, 'selection target stored');
T(_els['chat-target-chip'].style.display === '', 'target chip visible');
var tp = buildChatPrompt('make the title uppercase');
T(tp.indexOf('TARGETED EDIT') !== -1, 'prompt includes targeted edit section');
T(tp.indexOf('replaceBlock') !== -1, 'prompt demands replaceBlock op');
clearSelectionTarget();
T(_selTarget === null && _els['chat-target-chip'].style.display === 'none', 'target cleared');

/* Formatting controls */
_els['fmt-font'].value = 'Georgia';
_els['fmt-size'].value = '13pt';
_els['fmt-lh'].value = '1.5';
_els['fmt-color'].value = '#222222';
applyFmtControls();
T(DB.settings.fontFamily === 'Georgia' && DB.settings.fontSize === '13pt', 'font/size settings applied');
T(DB.settings.color === '#222222' && DB.settings.lineHeight === '1.5', 'color/line-height applied');
T(DB.version === '1.1.1', 'version bumped patch after formatting');

/* Component catalog render */
el('components-list').innerHTML = '';
renderCatalog('');
T(_els['components-list'].innerHTML.indexOf('comp-card') !== -1, 'catalog rendered');
renderCatalog('signature');
T(_els['components-list'].innerHTML.indexOf('signature-block') !== -1, 'catalog filter works');

/* Exports */
_els['btn-export-html'] && exportHtml();
exportDocx();
T(typeof ensureDocxLib === 'function', 'docx loader defined');
var standalone = buildStandaloneHtml();
T(standalone.indexOf('data-lb-id') !== -1, 'standalone export contains blocks');

/* Reset document (double-click confirm) */
var resetBtn = _els['btn-reset-doc'];
DB.blocks = DB.blocks.slice();
confirmClick(resetBtn, function() { DB.blocks = []; }, 'Really?');
confirmClick(resetBtn, function() { DB.blocks = []; }, 'Really?');
T(DB.blocks.length === 0, 'reset action ran on second confirm click');

/* Side drawers */
openDrawer('components');
T(_els['drawer-components'].classList.contains('open') === true, 'components drawer opens');
T(_els['components-list'].innerHTML.indexOf('comp-card') !== -1, 'catalog rendered on drawer open');
openDrawer('settings');
T(_els['drawer-settings'].classList.contains('open') === true, 'settings drawer opens');
T(_els['drawer-components'].classList.contains('open') === false, 'opening settings closes components');
toggleDrawer('settings');
T(_els['drawer-settings'].classList.contains('open') === false, 'toggle closes settings');
toggleDrawer('settings');
T(_els['drawer-settings'].classList.contains('open') === true, 'toggle reopens settings');
closeDrawer('settings');
T(_els['drawer-settings'].classList.contains('open') === false, 'closeDrawer closes settings');

/* Manual edit mode */
DB.blocks = [{ type: 'clause', data: { text: 'original text' } }];
setEditMode(true);
T(_editMode === true, 'edit mode on');
T(_els['btn-toggle-edit'].textContent.indexOf('Save Edits') !== -1, 'toggle shows save label');
T(_els['edit-format-bar'].style.display === '', 'format bar visible');
sendFormatCmd('bold');
setEditMode(false);
T(_editMode === false, 'edit mode off');
T(_els['edit-format-bar'].style.display === 'none', 'format bar hidden after off');
var e0 = applyManualEdits([{ idx: 0, html: '<p>edited text</p>' }, { idx: 99, html: 'x' }]);
T(e0 === true, 'manual edits applied');
T(DB.blocks[0].data.manualHtml === '<p>edited text</p>', 'manualHtml stored on typed block');
T(blocksToHtml().indexOf('edited text') !== -1, 'manualHtml rendered');
T(applyManualEdits([]) === false, 'empty edits report false');
DB.blocks[0].type = 'html';
DB.blocks[0].data = { html: 'raw' };
applyManualEdits([{ idx: 0, html: '<div>raw edited</div>' }]);
T(DB.blocks[0].data.html === '<div>raw edited</div>', 'html blocks store edits in data.html');

/* resolveTitle falls back when parent fields unavailable */
T(resolveTitle() === 'Legal Document', 'resolveTitle fallback');

console.log('');
if (failures.length) {
  console.log('E2E FAILURES: ' + failures.length);
  failures.forEach(function(f) { console.log('  - ' + f); });
  process.exit(1);
} else {
  console.log('E2E SIM: ALL PASS');
}
`;

const wrapped = '(function(){\n' + stubs + '\n' + src + '\n' + asserts + '\n})();';
try {
  eval(wrapped);
} catch (e) {
  console.error('E2E EVAL ERROR:', e.message);
  process.exit(1);
}
