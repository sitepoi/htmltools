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
assert(nav._children.length === 9, 'kit nav has 7 categories + guidelines + show-all, got ' + nav._children.length);
var content = els['kit-content'];
assert(content._children.length === 7, 'all view shows 7 group sections, got ' + content._children.length);
var totalCards = 0;
content._children.forEach(function (sec) { totalCards += (sec._children[1] ? sec._children[1]._children.length : 0); });
assert(totalCards === 50, '50 asset cards rendered across groups, got ' + totalCards);
var firstSec = content._children[0];
assert(firstSec._children[0].innerHTML.indexOf('Logo Lockups') > -1, 'first section head shows Logo Lockups');
var socialSec = content._children[3];
assert(String(socialSec._children[0].innerHTML).indexOf('Social Media') > -1, 'social media section exists');
assert(socialSec._children[1]._children.length === 9, 'social group holds 9 cards, got ' + socialSec._children[1]._children.length);
var printSec = content._children[4];
assert(String(printSec._children[0].innerHTML).indexOf('Print') > -1, 'print section exists');
assert(printSec._children[1]._children.length === 19, 'print group holds 19 cards (swag photos removed), got ' + printSec._children[1]._children.length);
var qualitySec = content._children[6];
assert(String(qualitySec._children[0].innerHTML).indexOf('Quality &amp; A11y') > -1, 'quality section exists');
assert(qualitySec._children[1]._children.length === 2, 'quality group holds 2 cards, got ' + qualitySec._children[1]._children.length);
var firstGrid = firstSec._children[1];
assert(firstGrid._children.length === 6, 'logo group grid holds 6 cards, got ' + firstGrid._children.length);
var firstCard = firstGrid._children[0];
assert(firstCard._children.length >= 2, 'asset card has preview + body children');
assert(els['role-badge'].textContent.indexOf('Admin') > -1, 'role badge shows user');
assert(els['pane-1'].style.display !== 'none', 'pane 1 visible initially');
assert(els['pane-2'].style.display === 'none', 'pane 2 hidden initially');
assert(els['pane-3'].style.display === 'none', 'pane 3 (Creative Lab) hidden initially');
assert(els['pane-4'].style.display === 'none', 'pane 4 (Brand Kit) hidden initially');
assert(els['f-legal-name'].value === 'Nova Labs Inc.', 'legal name field filled');
assert(els['lab-nav']._children.length === 7, 'lab nav has 7 creative tools, got ' + els['lab-nav']._children.length);
assert(els['lab-content']._children.length === 1, 'lab content renders one section');

// ---- creative lab tab switching ----
var labNav = els['lab-nav'];
labNav._children[4]._handlers.click[0](); // Tagline A/B
assert(els['lab-content']._children.length === 1, 'ab tab renders without throwing');
labNav._children[6]._handlers.click[0](); // Competitor moodboard
assert(els['lab-content']._children.length === 1, 'mood tab renders without throwing');
labNav._children[2]._handlers.click[0](); // Brand voice pack
assert(els['lab-content']._children.length === 1, 'voice tab renders without throwing');
labNav._children[0]._handlers.click[0](); // back to logo ideas
assert(els['lab-content']._children.length === 1, 'ideas tab renders without throwing');

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
assert(nav2._children.length === 9, 'nav re-rendered with 9 buttons');

// ---- guidelines menu item ----
var glBtn = nav2._children[7];
assert(String(glBtn.innerHTML).indexOf('Brand Guidelines') > -1, 'nav has Brand Guidelines button');
glBtn._handlers.click[0]();
assert(content._children.length === 1, 'guidelines view shows one card');
assert(content._children[0].innerHTML.indexOf('Color palette') > -1, 'guidelines card includes palette section');
assert(content._children[0].innerHTML.indexOf('Usage examples') > -1, 'guidelines card includes usage examples');
assert(content._children[0].innerHTML.indexOf('Legal name') > -1, 'guidelines card includes legal name');

var nav3 = els['kit-nav'];
var allBtn = nav3._children[8];
assert(String(allBtn.innerHTML).indexOf('Show all items') > -1, 'show-all button is at the bottom');
allBtn._handlers.click[0]();
assert(content._children.length === 7, 'show-all returns to 7 sections');

// ---- dark-interface variant toggle (P4-04) ----
var darkBtn = els['btn-kit-dark'];
assert(darkBtn._handlers.click && darkBtn._handlers.click.length >= 1, 'dark variant button is bound');
darkBtn._handlers.click[0]();
assert(content._children.length === 7, 'dark variant re-renders 7 sections');
darkBtn._handlers.click[0]();
assert(content._children.length === 7, 'toggling back re-renders 7 sections');

// ---- P5-04 file naming scheme editor ----
var slugEl = els['f-slug'];
assert(slugEl._handlers.input && slugEl._handlers.input.length >= 1, 'slug input is bound');
assert(els['f-name-sample'].textContent.indexOf('-primary-logo.svg') > -1, 'name sample shows a generated filename');
slugEl.value = 'Custom Brand';
slugEl._handlers.input[0]();
assert(els['f-name-sample'].textContent === 'custom-brand-primary-logo.svg', 'name sample updates with custom slug, got ' + els['f-name-sample'].textContent);
var preEl = els['f-prefix'];
preEl.value = 'my';
preEl._handlers.input[0]();
assert(els['f-name-sample'].textContent === 'my-custom-brand-primary-logo.svg', 'prefix joins the filename, got ' + els['f-name-sample'].textContent);
var sufEl = els['f-suffix'];
sufEl.value = '2026';
sufEl._handlers.input[0]();
assert(els['f-name-sample'].textContent === 'my-custom-brand-2026-primary-logo.svg', 'suffix joins the filename, got ' + els['f-name-sample'].textContent);

// ---- P5-06 export preferences UI ----
assert(els['export-prefs'].innerHTML.indexOf('bsg-fmt') > -1, 'export preferences render format chips');
assert(els['export-prefs'].innerHTML.indexOf('active') > -1, 'default formats are pre-selected');
assert(els['export-prefs'].innerHTML.indexOf('Logo Lockups') > -1, 'export prefs list asset groups');

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
