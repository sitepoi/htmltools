// P5 test: exercise downloadZip in the fake DOM and verify the gallery index.html
// generated inside the ZIP (P5-04/06/07).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const js = fs.readFileSync(path.join(__dirname, 'BrandSetGenerator.js'), 'utf8');

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
var setTimeout = function(fn){ try { fn(); } catch (e) {} return 0; };
var clearTimeout = function(){};
var zipFiles = {};
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
var URL = { createObjectURL: function(){ return 'blob:x'; }, revokeObjectURL: function(){} };
var Blob = function(){};
var JSZip = function(){
  this.folder = function(name){ this.folderName = name; return this; };
  this.file = function(name, content){ zipFiles[name] = String(content); };
  this.generateAsync = function(){ return Promise.resolve({}); };
};
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
capturedCb(${JSON.stringify(sample)}, {});
var assert = function (cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); };

// --- file naming scheme (P5-04): set custom slug/prefix/suffix ---
els['f-slug'].value = 'Acme AŞ';
els['f-slug']._handlers.input[0]();
assert(els['f-name-sample'].textContent === 'acme-as-primary-logo.svg', 'slug handles Turkish input, got ' + els['f-name-sample'].textContent);
els['f-prefix'].value = 'brand';
els['f-prefix']._handlers.input[0]();
els['f-suffix'].value = 'v2';
els['f-suffix']._handlers.input[0]();
assert(els['f-name-sample'].textContent === 'brand-acme-as-v2-primary-logo.svg', 'prefix/suffix joined, got ' + els['f-name-sample'].textContent);

// --- export preferences (P5-06): turn everything off except SVG ---
var toggleFmt = function (gid, fmt, wantOn) {
  // simulate chip toggling by walking DB via tool value round-trip
  var db = tool._lastValue;
  var arr = (db.export.formats[gid] || []).slice();
  var idx = arr.indexOf(fmt);
  if (wantOn && idx === -1) arr.push(fmt);
  if (!wantOn && idx > -1) arr.splice(idx, 1);
  db.export.formats[gid] = arr;
  capturedCb(db, {}); // re-run pipeline with modified value
};
['logo','icons','web','social','print','quality'].forEach(function (gid) {
  toggleFmt(gid, 'png', false);
  toggleFmt(gid, 'webp', false);
  toggleFmt(gid, 'ico', false);
});

// --- ZIP gallery (P5-07): downloadZip must add index.html ---
els['btn-zip']._handlers.click[0]();
var keys = Object.keys(zipFiles);
assert(keys.length > 0, 'zip contains files, got ' + keys.length);
assert(zipFiles['index.html'] !== undefined, 'zip contains index.html gallery');
var html = zipFiles['index.html'];
assert(html.indexOf('<!DOCTYPE html>') === 0, 'gallery is a full html document');
assert(html.indexOf('Brand Kit Gallery') > -1, 'gallery has the gallery title');
assert(html.indexOf('Nova Labs') > -1, 'gallery shows the brand name');
assert(html.indexOf('Primary Logo') > -1, 'gallery lists asset titles');
assert(html.indexOf('.svg') > -1, 'gallery links to svg files');
assert(html.indexOf('.png') === -1, 'png disabled via prefs is absent from gallery links, got png at ' + html.indexOf('.png'));
assert(keys.some(function (k) { return k.indexOf('Logo Lockups/') === 0; }), 'files are grouped into folders, got ' + keys.slice(0, 3).join(','));
assert(keys.some(function (k) { return k.indexOf('brand-acme-as-v2') > -1; }), 'files use the custom naming scheme, got ' + keys.slice(0, 3).join(','));

console.log('p5-test: all assertions passed ✓');
`;

const sandbox = {};
vm.createContext(sandbox);
try {
  vm.runInContext(stub + '\n' + js + '\n' + tests, sandbox, { filename: 'p5-test.cjs' });
  console.log('p5-test: passed ✓');
} catch (e) {
  console.error('P5 TEST THREW:', e && e.stack || e);
  process.exit(1);
}
if (sandbox.zipFiles && sandbox.zipFiles['index.html']) {
  fs.writeFileSync(path.join(process.env.TEMP, 'bsg-gallery.html'), sandbox.zipFiles['index.html'], 'utf8');
  console.log('gallery written to %TEMP%\\bsg-gallery.html');
}
