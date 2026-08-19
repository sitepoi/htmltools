// Smoke test: eval BrandSetGenerator.js with a minimal fake DOM + tool stub,
// run the onReady callback with a sample value, and assert the full render
// pipeline produces SVG markup without throwing.
// NOTE: tests MUST be appended to the same eval string (eval'd 'use strict' scope).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const js = fs.readFileSync(path.join(__dirname, 'BrandSetGenerator.js'), 'utf8');

function fakeEl() {
  return {
    innerHTML: '', textContent: '', value: '', checked: false, disabled: false, title: '',
    style: {},
    options: [],
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, appendChild() {}, removeChild() {},
    querySelectorAll() { return []; }, querySelector() { return null; },
    focus() {}, select() {}
  };
}

const sample = {
  v: 1,
  company: {
    name: 'Nova Labs', legalName: 'Nova Labs Inc.', tagline: 'Software that ships itself', industry: 'Technology / Software',
    personality: ['Modern', 'Bold'], brandColor: '#4f46e5', paletteStyle: 'modern',
    contact: { person: 'Jane Doe', title: 'CEO', email: 'jane@novalabs.io', phone: '+1 555 000', website: 'novalabs.io', address: '123 Ave' }
  },
  logo: {
    source: 'builder', uploadUrl: '', uploadName: '', uploadFit: 'plain', uploadPad: 72,
    symbol: 'icon', iconId: 'rocket', monogram: '',
    layout: 'horizontal', shape: 'rounded',
    fontId: 'poppins', tagFontId: 'inter',
    uppercase: false, tracking: 2, iconScale: 1, showTagline: true, shadow: true,
    override: { primary: '', text: '', tag: '', bg: '' }
  }
};

const stub = `
var els = {};
var capturedCb = null;
var setTimeout = function(){ return 0; };
var clearTimeout = function(){};
var fakeEl = function(){ 
  var el = {
    textContent:'', value:'', checked:false, disabled:false, title:'', src:'',
    style:{}, options:[],
    _children: [], _handlers: {},
    classList:{ add:function(){}, remove:function(){}, toggle:function(){} },
    setAttribute:function(){}, getAttribute:function(){ return null; },
    addEventListener:function(ev, fn){ (el._handlers[ev] = el._handlers[ev] || []).push(fn); },
    appendChild:function(c){ el._children.push(c); },
    removeChild:function(){},
    querySelectorAll:function(){ return []; }, querySelector:function(){ return null; },
    focus:function(){}, select:function(){},
    getContext:function(){ return { font:'', measureText:function(){ return { width: 100 }; } }; }
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function(){ return this._innerHTML || ''; },
    set: function(v){ this._innerHTML = v; this._children = []; },
    enumerable: true
  });
  return el;
};
var document = {
  getElementById: function(id){ return els[id] || (els[id] = fakeEl()); },
  createElement: function(){ return fakeEl(); },
  querySelectorAll: function(){ return []; },
  addEventListener: function(){},
  fonts: { ready: Promise.resolve() }
};
var navigator = {};
var window = { document: document };
var tool = {
  getValue: function(){ return null; },
  setValue: function(d){ this._lastValue = d; },
  onValueChange: function(cb){ this._onVal = cb; },
  onReady: function(cb){ capturedCb = cb; },
  param: function(n, f){ return f || ''; },
  isReadOnly: function(){ return false; },
  onReadonlyChange: function(){},
  getUser: function(){ return { id:'u-admin', name:'Admin', roles:['admin'] }; },
  onUserChange: function(){},
  reportValid: function(){},
  notify: function(){},
  resize: function(){},
  declareOutput: function(){},
  declareParams: function(){},
  reportMissingParams: function(){},
  requestSave: function(cb){ if(cb) cb(null, true); },
  openUrl: function(){}
};
`;

const tests = `
// ---- run the pipeline ----
capturedCb(${JSON.stringify(sample)}, {});

var assert = function (cond, msg) {
  if (!cond) { throw new Error('FAIL: ' + msg); }
  console.log('ok: ' + msg);
};

var preview = els['logo-preview'].innerHTML;
assert(preview.indexOf('<svg') === 0, 'logo preview renders an <svg> root');
assert(preview.indexOf('Nova Labs') > -1, 'logo svg contains company name');
assert(preview.indexOf('Software that ships itself') > -1, 'logo svg contains tagline');

assert(els['palette-preview'].innerHTML.indexOf('#') > -1, 'palette preview renders swatches');
assert(els['personality-chips'].innerHTML.indexOf('Modern') > -1, 'personality chips render');
assert(els['icon-grid'].innerHTML.indexOf('bsg-icon-opt') > -1, 'icon grid renders options');
assert(els['variant-previews'].innerHTML.indexOf('bsg-variant') > -1, 'variant thumbs render');

var nav = els['kit-nav'];
assert(nav._children.length === 6, 'kit nav has 5 categories + show-all, got ' + nav._children.length);
var content = els['kit-content'];
assert(content._children.length === 5, 'all view shows 5 group sections, got ' + content._children.length);
var totalCards = 0;
content._children.forEach(function (sec) { totalCards += (sec._children[1] ? sec._children[1]._children.length : 0); });
assert(totalCards === 17, '17 asset cards rendered across groups, got ' + totalCards);
var firstSec = content._children[0];
assert(firstSec._children[0].innerHTML.indexOf('Logo Lockups') > -1, 'first section head shows Logo Lockups');
var firstGrid = firstSec._children[1];
assert(firstGrid._children.length === 6, 'logo group grid holds 6 cards, got ' + firstGrid._children.length);
var firstCard = firstGrid._children[0];
assert(firstCard._children.length >= 2, 'asset card has preview + body children');
assert(els['guidelines-body'].innerHTML.indexOf('Color palette') > -1, 'guidelines body renders palette section');
assert(els['guidelines-body'].innerHTML.indexOf('Legal name') > -1, 'guidelines body includes legal name');
assert(els['role-badge'].textContent.indexOf('Admin') > -1, 'role badge shows user');
assert(els['pane-1'].style.display !== 'none', 'pane 1 visible initially');
assert(els['pane-2'].style.display === 'none', 'pane 2 hidden initially');
assert(els['f-legal-name'].value === 'Nova Labs Inc.', 'legal name field filled');

// ---- brand manifest asset card exists ----
var jsonCard = null;
content._children.forEach(function (sec) {
  if (!sec._children || !sec._children[1]) return;
  (sec._children[1]._children || []).forEach(function (c) {
    if (c._children && c._children[1] && String(c._children[1].innerHTML).indexOf('Brand JSON') > -1) jsonCard = c;
  });
});
assert(jsonCard !== null, 'brand JSON asset card exists');

// ---- group navigation switching ----
var iconsBtn = nav._children[1];
assert(String(iconsBtn.innerHTML).indexOf('Icons &amp; Favicon') > -1, 'nav has Icons & Favicon button');
iconsBtn._handlers.click[0]();
assert(content._children.length === 1, 'icons view shows exactly 1 section');
assert(content._children[0]._children[0].innerHTML.indexOf('Icons &amp; Favicon') > -1, 'icons section head shown');
var nav2 = els['kit-nav'];
assert(nav2._children.length === 6, 'nav re-rendered with 6 buttons');
var allBtn = nav2._children[5];
assert(String(allBtn.innerHTML).indexOf('Show all items') > -1, 'show-all button is at the bottom');
allBtn._handlers.click[0]();
assert(content._children.length === 5, 'show-all returns to 5 sections');

// ---- read-only / no-user path exercises lockUI without throwing ----
tool.isReadOnly = function(){ return true; };
tool.getUser = function(){ return null; };
capturedCb(null, {});
console.log('smoke-test: all assertions passed ✓');
`;

const sandbox = {};
vm.createContext(sandbox);
try {
  vm.runInContext(stub + '\n' + js + '\n' + tests, sandbox, { filename: 'smoke-test.cjs' });
} catch (e) {
  console.error('SMOKE TEST THREW:', e && e.stack || e);
  process.exit(1);
}
