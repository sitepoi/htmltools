// Dump sample SVGs produced by the tool for manual inspection
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const js = fs.readFileSync(path.join(__dirname, 'BrandSetGenerator.js'), 'utf8');

const sample = {
  v: 1,
  company: {
    name: 'Nova Labs', legalName: 'Nova Labs Inc.', tagline: 'Software that ships itself', industry: 'Technology / Software',
    personality: ['Modern', 'Bold'], brandColor: '#4f46e5', paletteStyle: 'modern',
    contact: { person: 'Jane Doe', title: 'Founder & CEO', email: 'jane@novalabs.io', phone: '+1 555 000 1234', website: 'novalabs.io', address: '123 Innovation Ave, San Francisco' }
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
var fakeEl = function(){ return {
  innerHTML:'', textContent:'', value:'', checked:false, disabled:false, title:'', src:'',
  style:{}, options:[], _children: [],
  classList:{ add:function(){}, remove:function(){}, toggle:function(){} },
  setAttribute:function(){}, getAttribute:function(){ return null; },
  addEventListener:function(){},
  appendChild:function(c){ this._children.push(c); },
  removeChild:function(){},
  querySelectorAll:function(){ return []; }, querySelector:function(){ return null; },
  focus:function(){}, select:function(){},
  getContext:function(){ return { font:'', measureText:function(){ return { width: 100 }; } }; }
}; };
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
  getValue: function(){ return null; }, setValue: function(){}, onValueChange: function(){},
  onReady: function(cb){ capturedCb = cb; }, param: function(n,f){ return f||''; },
  isReadOnly: function(){ return false; }, onReadonlyChange: function(){},
  getUser: function(){ return { id:'u-a', name:'Admin', roles:['admin'] }; }, onUserChange: function(){},
  reportValid: function(){}, notify: function(){}, resize: function(){},
  declareOutput: function(){}, declareParams: function(){}, reportMissingParams: function(){},
  requestSave: function(){}, openUrl: function(){}
};
`;

const dump = `
capturedCb(${JSON.stringify(sample)}, {});
var out = [];
var svgFiles = [
  ['primary', els['logo-preview'].innerHTML],
  ['email-sig', '']
];
// asset cards: walk kit-content sections for svg previews
var sections = els['kit-content']._children || [];
var labels = ['primary', 'stacked', 'mark', 'mono-black', 'mono-white', 'reversed', 'favicon', 'app-icon', 'avatar', 'favicon-adaptive', 'favicon-snippet', 'banner-light', 'banner-dark', 'newsletter-header', 'email-template', 'animated-intro', 'facebook-cover', 'linkedin-cover', 'x-cover', 'youtube-cover', 'social-profile', 'instagram-post', 'instagram-story', 'whatsapp-profile', 'whatsapp-catalog', 'card-front', 'card-back', 'card-print', 'letterhead', 'invoice-header', 'proposal-cover', 'ppt-title-slide', 'gdoc-header', 'envelope-dl', 'mailing-label', 'fax-cover', 'id-badge-front', 'id-badge-back', 'lanyard', 'review-sheet', 'swag-stickers', 'sign-storefront', 'sign-door', 'sign-vehicle', 'email-sig', 'vcard', 'brand-json', 'summary', 'contrast-checker', 'cvd-simulation'];
var li = 0;
sections.forEach(function (sec, i) {
  var innerGrid = sec._children && sec._children[1];
  var groupCards = innerGrid && innerGrid._children || [];
  groupCards.forEach(function (card, j) {
    var prev = card._children && card._children[0];
    var img = prev && prev._children && prev._children[0];
    var label = labels[li++] || ('extra-' + i + '-' + j);
    if (img && img.src && img.src.indexOf('data:image/svg+xml') === 0) {
      svgFiles.push([label, decodeURIComponent(img.src.replace('data:image/svg+xml;charset=utf-8,', ''))]);
    } else if (prev && prev.innerHTML && String(prev.innerHTML).indexOf('<svg') === 0) {
      svgFiles.push([label, prev.innerHTML]);
    } else {
      svgFiles.push([label, 'non-svg']);
    }
  });
});
globalThis.__dump = svgFiles;
`;

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(stub + '\n' + js + '\n' + dump, sandbox, { filename: 'dump.cjs' });
const files = sandbox.__dump;
const dir = path.join(__dirname, 'sample-output');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);
files.forEach(f => {
  fs.writeFileSync(path.join(dir, f[0] + '.svg'), f[1], 'utf8');
  console.log(f[0] + ': ' + f[1].length + ' chars');
});
// quick well-formedness: tag balance
function balance(s) {
  const stack = [];
  const re = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)((?:\"[^\"]*\"|'[^']*'|[^>\"'])*)>/g;
  const voidTags = { path: 1, circle: 1, rect: 1, image: 1, stop: 1, feDropShadow: 1, feColorMatrix: 1, feTurbulence: 1, feComposite: 1, feGaussianBlur: 1, animate: 1, animateTransform: 1 };
  let m;
  while ((m = re.exec(s))) {
    const full = m[0], tag = m[1];
    if (full[1] === '/') {
      if (voidTags[tag]) continue; // explicit close of a void tag — ignore
      const open = stack.pop();
      if (open !== tag) { console.error('MISMATCH: expected </' + open + '> got </' + tag + '>'); return false; }
    } else if (!voidTags[tag] && full[full.length - 2] !== '/') {
      stack.push(tag);
    }
  }
  if (stack.length) { console.error('UNCLOSED: ' + stack.join(',')); return false; }
  return true;
}
files.forEach(f => {
  if (f[1].startsWith('<svg')) {
    const ok = balance(f[1]);
    console.log(f[0] + ': well-formed ' + (ok ? '✓' : '✗'));
  }
});
