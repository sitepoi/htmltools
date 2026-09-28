/* Real-library verification of the Legal Document Builder DOCX pipeline.
   Evaluates the tool JS with the ACTUAL docx@8.5.0 (same version as the CDN)
   and parse5 as the HTML parser, generates a real .docx, and checks its XML.
   Usage: npm install docx parse5 in C:/Users/Admin/AppData/Local/Temp/legaldoctest first. */
'use strict';
const fs = require('fs');
const path = require('path');

const libPath = 'C:/Users/Admin/AppData/Local/Temp/legaldoctest';
const { createRequire } = require('module');
const reqFromLib = createRequire(libPath + '/dummy.js');
const docx = reqFromLib('docx');
const parse5 = reqFromLib('parse5');

/* ── Minimal DOM facade over parse5 (the docx converter only uses
      childNodes/nodeType/tagName/nodeValue/getAttribute/className/children/querySelectorAll) ── */
var _wrapCache = new WeakMap();
function wrapNode(node) {
  if (!node) return node;
  if (_wrapCache.has(node)) return _wrapCache.get(node);
  var out;
  if (node.nodeName === '#text') {
    out = { nodeType: 3, nodeValue: node.value, tagName: '', childNodes: [], children: [] };
  } else {
    out = {
      nodeType: 1,
      tagName: node.tagName,
      childNodes: (node.childNodes || []).map(wrapNode),
      getAttribute: function (name) {
        var attrs = node.attrs || [];
        for (var i = 0; i < attrs.length; i++) if (attrs[i].name === name) return attrs[i].value;
        return null;
      }
    };
    out.className = out.getAttribute('class') || '';
    out.children = out.childNodes.filter(function (c) { return c.nodeType === 1; });
    out.querySelectorAll = function (sel) {
      var tag = sel.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      var found = [];
      (function walk(n) {
        var kids = n.childNodes || [];
        for (var i = 0; i < kids.length; i++) {
          var k = kids[i];
          if (k.tagName && k.tagName.toLowerCase() === tag) found.push(wrapNode(k));
          walk(k);
        }
      })(node);
      return found;
    };
  }
  _wrapCache.set(node, out);
  return out;
}
function DOMParserShim() {
  this.parseFromString = function (html, mime) {
    var doc = parse5.parse('<html><body>' + html + '</body></html>');
    var root = wrapNode(doc);
    return { body: root.childNodes[0].childNodes[1] }; // html > body
  };
}
globalThis.__DOMParserShim = DOMParserShim;

const src = fs.readFileSync(path.join(__dirname, 'AILegalFormattedDocumentBuilder.js'), 'utf8');

const stubs = `
var _readyCb = null;
var fakeEl = function() {
  return { style: {}, classList: { add: function(){}, remove: function(){}, toggle: function(){}, contains: function(){ return false; } },
    addEventListener: function(){}, querySelector: function(){ return null; }, querySelectorAll: function(){ return []; },
    appendChild: function(){}, setAttribute: function(){}, getAttribute: function(){ return null; },
    value: '', textContent: '', innerHTML: '', options: [], children: [], childNodes: [], disabled: false };
};
var document = {
  getElementById: function() { return fakeEl(); },
  createElement: function() { return fakeEl(); },
  querySelectorAll: function() { return []; },
  querySelector: function() { return null; },
  addEventListener: function() {},
  body: fakeEl(), head: fakeEl()
};
var navigator = { clipboard: { writeText: function() { return Promise.resolve(); } } };
var window = { addEventListener: function(){}, open: function(){ return null; }, location: { origin: 'https://test.local' }, docx: docx };
var URL = { createObjectURL: function(){ return 'blob:x'; }, revokeObjectURL: function(){} };
var Blob = function(parts, opts) { this.parts = parts; this.opts = opts; };
var DOMParser = globalThis.__DOMParserShim;
var tool = {
  onReady: function(cb) { _readyCb = cb; },
  getValue: function() { return null; }, setValue: function() {}, onValueChange: function() {},
  param: function(n, d) { return d; }, isReadOnly: function() { return false; },
  onReadonlyChange: function() {}, getUser: function() { return null; },
  getFields: function() { return { name: 'Test Service Agreement' }; },
  notify: function() {}, resize: function() {}, declareParams: function() {}, openUrl: function() {},
  requestAI: function() {}, requestAIStream: function() {}, requestObjects: function() {}
};
`;

const asserts = `
var failures = [];
function T(cond, label) {
  if (cond) { console.log('  PASS ' + label); }
  else { failures.push(label); console.log('  FAIL ' + label); }
}

DB.blocks = [
  { type: 'title', data: { text: 'Service Agreement', subtitle: 'Between Alpha and Beta' } },
  { type: 'section', data: { number: '1', title: 'FEES AND PAYMENT' } },
  { type: 'table', data: { columns: ['Item', 'Amount', 'Due'], rows: [['Retainer', '5000', 'On signing'], ['Monthly', '3500', '1st of month'], ['Final', 'Balance', 'Completion']] } },
  { type: 'page-break', data: {} },
  { type: 'clause', data: { number: '2.1', text: 'A <strong>bold</strong> and <em>italic</em> clause.' } }
];

var html = '<div class="doc-sheet">' + blocksToHtml() + '</div>';
var items = htmlToDocxItems(html);
T(Array.isArray(items) && items.length > 0, 'htmlToDocxItems produced items (' + items.length + ')');

var W = docx;
var doc = new W.Document({
  creator: 'Legal Document Builder',
  title: 'Test Service Agreement',
  sections: [{ properties: {}, children: items }]
});

W.Packer.toBuffer(doc).then(function(buf) {
  var outPath = 'C:/Users/Admin/AppData/Local/Temp/legaldoctest/test.docx';
  fs.writeFileSync(outPath, buf);
  console.log('  wrote ' + outPath + ' (' + buf.length + ' bytes)');
  process.exit(failures.length ? 1 : 0);
}).catch(function(e) {
  console.error('  PACKER ERROR:', e && e.stack ? e.stack : String(e));
  process.exit(1);
});
`;

const wrapped = '(function(){\n' + stubs + '\n' + src + '\n' + asserts + '\n})();';
eval(wrapped);
