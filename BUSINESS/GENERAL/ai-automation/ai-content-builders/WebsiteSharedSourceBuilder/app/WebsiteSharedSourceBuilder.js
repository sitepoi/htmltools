/* ── Website Shared Source Builder ──
   UniconHub html-tool: author reusable site content for the PublicWebsite
   platform. Two object kinds:
     shared-sources  → data.htmlPage.code.{html,css,js} + data.sharedMode
                       (mandatory = injected into every page; optional =
                       pages opt in via data.sections)
     gw-widgets      → data.gwApp.{name,configSchema} + data.ssrHtml +
                       data.htmlPage.code (widget library island)
   No AI — a focused editor + preview + compliance + export.
   Build 2026-10-02a ─────────────────────────────────────────── */

/* ── Helpers ── */
function el(id) { return document.getElementById(id); }
function qsa(sel) { return document.querySelectorAll(sel); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function debounce(fn, ms) {
  var t = null;
  return function() {
    var args = arguments, self = this;
    if (t) clearTimeout(t);
    t = setTimeout(function() { fn.apply(self, args); }, ms);
  };
}

/* Turkish-safe slugifier (NFKD before transliteration — avoids İ → i- artifacts) */
function slugify(s) {
  var str = String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  str = str
    .replace(/ş/g, 's').replace(/Ş/g, 's')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/Ü/g, 'u')
    .replace(/ö/g, 'o').replace(/Ö/g, 'o')
    .replace(/ç/g, 'c').replace(/Ç/g, 'c')
    .replace(/ı/g, 'i').replace(/İ/g, 'i');
  str = str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return str || 'shared';
}

/* ── State ── */
var DB = {
  code: { html: '', css: '', js: '' },
  meta: { kind: 'shared', name: '', slug: '', sharedMode: 'optional', gwAppName: '', configSchema: '', ssrHtml: '' },
  version: '1.0.0'
};
var _stampedVersion = '';
var _snapshot = '';
var _snapInitialized = false;
var _justEdited = false;

function _dbSnapshot() {
  return [
    DB.code.html, DB.code.css, DB.code.js,
    JSON.stringify(DB.meta || null)
  ].join('\u0001');
}

function _stampBlock(code, stamp) {
  if (!code) return code;
  var re = new RegExp('^(?:[ \t]*(?:<' + '!--\\s*v[\\d.]+\\s*-->|\\/\\*\\s*v[\\d.]+\\s*\\*\\/)[ \t]*[\\r\\n]+)+');
  return stamp + '\n' + String(code).replace(re, '');
}
function _stampVersionInCode() {
  var v = DB.version || '1.0.0';
  if (_stampedVersion === v) return false;
  _stampedVersion = v;
  var h = _stampBlock(DB.code.html, '<' + '!-- v' + v + ' -->');
  var c = _stampBlock(DB.code.css, '/* v' + v + ' */');
  var j = _stampBlock(DB.code.js, '/* v' + v + ' */');
  var changed = h !== DB.code.html || c !== DB.code.css || j !== DB.code.js;
  DB.code.html = h; DB.code.css = c; DB.code.js = j;
  return changed;
}

function _slimValue() {
  return {
    code: { html: DB.code.html, css: DB.code.css, js: DB.code.js },
    meta: DB.meta,
    version: DB.version
  };
}

function persist() {
  if (!_snapInitialized) { _snapshot = _dbSnapshot(); _snapInitialized = true; }
  else {
    var snap = _dbSnapshot();
    if (_snapshot && snap !== _snapshot && !_justEdited) _bumpVersion('patch');
    _snapshot = _dbSnapshot();
  }
  _justEdited = false;
  try { tool.setValue(_slimValue()); } catch (e) {}
  tool.resize();
}

function _bumpVersion(level) {
  var parts = (DB.version || '1.0.0').split('.');
  var maj = parseInt(parts[0], 10) || 0, min = parseInt(parts[1], 10) || 0, pat = parseInt(parts[2], 10) || 0;
  if (level === 'major') { maj += 1; min = 0; pat = 0; }
  else if (level === 'minor') { min += 1; pat = 0; }
  else { pat += 1; }
  DB.version = maj + '.' + min + '.' + pat;
  _stampVersionInCode();
  _renderVersion();
}
function _renderVersion() {
  var badge = el('tool-version');
  if (badge) badge.textContent = 'v' + (DB.version || '1.0.0');
}
function _onVersionClick() {
  var display = el('tool-version');
  if (!display) return;
  var currentVer = DB.version || '1.0.0';
  var input = document.createElement('input');
  input.type = 'text';
  input.value = currentVer;
  input.style.cssText = 'width:90px;font-size:11px;border:1px solid #c7d2fe;border-radius:6px;padding:2px 6px';
  display.parentNode.replaceChild(input, display);
  input.focus(); input.select();
  var save = function() {
    var newVer = input.value.trim();
    if (!/^\d+\.\d+\.\d+$/.test(newVer)) { newVer = currentVer; }
    DB.version = newVer;
    persist();
    _renderVersion();
    var newDisplay = document.createElement('span');
    newDisplay.id = 'tool-version';
    newDisplay.className = 'version-badge';
    newDisplay.textContent = 'v' + newVer;
    newDisplay.title = 'Click to change version (increment only)';
    newDisplay.onclick = _onVersionClick;
    if (input.parentNode) input.parentNode.replaceChild(newDisplay, input);
  };
  input.onblur = save;
  input.onkeydown = function(e) {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = currentVer; input.blur(); }
  };
}

/* ── Editors / tabs ── */
function displayCode() {
  el('code-html').value = DB.code.html || '';
  el('code-css').value = DB.code.css || '';
  el('code-js').value = DB.code.js || '';
  refreshEditorHighlight('html');
  refreshEditorHighlight('css');
  refreshEditorHighlight('js');
}
function _commitEditors() {
  DB.code.html = el('code-html').value;
  DB.code.css = el('code-css').value;
  DB.code.js = el('code-js').value;
}

/* ── Lightweight syntax highlighting (zero dependencies) ──
   Monaco would be ~5 MB + a web worker for a use case where users mostly
   READ code and make small edits. This overlay technique (highlighted <pre>
   behind a transparent-text <textarea>) gives real syntax colors for
   HTML/CSS/JS at ~3 KB and works fully offline. ── */
function _hlEscape(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function _hlRun(src, re, groups) {
  var out = '';
  var last = 0;
  var m;
  re.lastIndex = 0;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out += _hlEscape(src.substring(last, m.index));
    var cls = null;
    for (var i = 0; i < groups.length; i++) {
      if (m[i + 1] !== undefined) { cls = groups[i]; break; }
    }
    if (cls === 'tag') out += _hlFmtTag(m[0]);
    else if (cls) out += '<span class="tk-' + cls + '">' + _hlEscape(m[0]) + '</span>';
    else out += _hlEscape(m[0]);
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  out += _hlEscape(src.substring(last));
  return out;
}
function _hlFmtTag(t) {
  var m = t.match(/^(<\/?)([a-zA-Z][\w-]*)([\s\S]*?)(\/?>)$/);
  if (!m) return _hlEscape(t);
  var attrs = m[3].replace(/([\w-]+)(=)("[^"]*"|'[^']*')/g, function(all, n, eq, v) {
    return '<span class="tk-attr">' + _hlEscape(n) + '</span><span class="tk-punc">=</span><span class="tk-string">' + _hlEscape(v) + '</span>';
  });
  return '<span class="tk-punc">&lt;' + (m[1] === '</' ? '/' : '') + '</span><span class="tk-tag">' + _hlEscape(m[2]) + '</span>' + attrs + '<span class="tk-punc">&gt;</span>';
}
var HL_HTML_RE = /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z][^>]*>)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/g;
function _hlHtml(src) { return _hlRun(src, HL_HTML_RE, ['comment', 'tag', 'string']); }
var HL_CSS_RE = /(\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(@[a-zA-Z-]+)|(#[0-9a-fA-F]{3,8}\b)|(-?\d*\.?\d+(?:px|em|rem|%|vh|vw|s|ms)?\b)|([.#]?[a-zA-Z_-][\w-]*(?=\s*\{))|([a-zA-Z-]+(?=\s*:))|(\{|\}|:|;|,)/g;
function _hlCss(src) { return _hlRun(src, HL_CSS_RE, ['comment', 'string', 'at', 'num', 'num', 'sel', 'prop', 'punc']); }
var HL_JS_RE = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\b(var|function|return|if|else|for|while|do|new|const|let|typeof|instanceof|this|in|of|true|false|null|undefined|try|catch|finally|throw|switch|case|break|continue|class|extends|import|export|default|async|await)\b|(\b\d[\d_.]*\b)|(\b(?:window|document|gw|tool|console|localStorage|JSON|Math|Date|Promise|setTimeout|setInterval)\b)/g;
function _hlJs(src) { return _hlRun(src, HL_JS_RE, ['comment', 'string', 'keyword', 'num', 'builtin']); }
function refreshEditorHighlight(part) {
  var code = el('hl-' + part);
  var ta = el('code-' + part);
  if (!code || !ta) return;
  var fn = part === 'html' ? _hlHtml : part === 'css' ? _hlCss : _hlJs;
  code.innerHTML = fn(ta.value);
  _syncHighlightScroll(part);
}
function _syncHighlightScroll(part) {
  var code = el('hl-' + part);
  var ta = el('code-' + part);
  if (code && ta) { code.scrollTop = ta.scrollTop; code.scrollLeft = ta.scrollLeft; }
}
function switchTab(name) {
  _commitEditors();
  qsa('.ctab').forEach(function(t) { t.classList.toggle('active', t.getAttribute('data-tab') === name); });
  ['preview', 'html', 'css', 'js'].forEach(function(p) {
    var pane = el('pane-' + p);
    if (pane) pane.classList.toggle('active', p === name);
  });
  if (name === 'preview') updatePreview();
  tool.resize();
}

/* ── Kind switching ── */
function _readKind() {
  var checked = qs2('input[name="kind"]:checked');
  return checked ? checked.value : 'shared';
}
function qs2(sel) { return document.querySelector(sel); }
function applyKindUI() {
  var kind = _readKind();
  DB.meta.kind = kind;
  el('kind-shared-fields').style.display = kind === 'shared' ? '' : 'none';
  el('kind-widget-fields').style.display = kind === 'widget' ? '' : 'none';
  updatePreviewHint();
}
function updatePreviewHint() {
  var hint = el('preview-hint');
  if (!hint) return;
  if (DB.meta.kind === 'widget') {
    hint.textContent = 'Widget mode — include an island div like <div data-gw-app="' + (DB.meta.gwAppName || 'name') + '" data-gw-config=\'{}\'></div> in your HTML to test the mount.';
  } else if (DB.meta.sharedMode === 'mandatory') {
    hint.textContent = 'Mandatory shared source — preview shows it rendered like a page (html before content, css + js applied).';
  } else {
    hint.textContent = 'Optional shared source — pages pick it via data.sections; preview renders it standalone.';
  }
}

/* ── Preview with a functional gw mock (widget mounting works) ── */
function _gwMock(lang) {
  var mock = '<script>\n(function(){\n' +
    'var gw={\n' +
    'pageId:"preview",siteId:"preview",folderId:"preview",language:' + JSON.stringify(lang || 'en') + ',host:"preview",currency:"USD",\n' +
    'ns:{},\n' +
    'getPageParams:function(){return {slug:"preview"};},\n' +
    'navigate:function(){return false;},openUrl:function(u){window.open(u,"_blank");},\n' +
    'onRouteChange:function(){return function(){};},\n' +
    'getUser:function(){return null;},isAuthenticated:function(){return false;},\n' +
    'authReady:Promise.resolve(null),refreshAuth:function(){return Promise.resolve(null);},\n' +
    'login:function(){return false;},logout:function(){return false;},\n' +
    'storage:{get:function(k){try{return localStorage.getItem("gw_"+k);}catch(e){return null;}},set:function(k,v){try{localStorage.setItem("gw_"+k,String(v));}catch(e){}},remove:function(k){try{localStorage.removeItem("gw_"+k);}catch(e){}}},\n' +
    'formatCurrency:function(n){return "$"+Number(n||0).toFixed(2);},formatDate:function(d){return String(d||"");},\n' +
    'notify:function(){},setLoading:function(){},\n' +
    'showModal:function(html){var m=document.createElement("div");m.style.cssText="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);z-index:99999";m.innerHTML=String(html||"");m.onclick=function(e){if(e.target===m)m.remove();};document.body.appendChild(m);return function(){m.remove();};},\n' +
    'sanitize:function(s){var d=document.createElement("div");d.textContent=String(s||"");return d.innerHTML;},\n' +
    'track:function(){},trackPageView:function(){},\n' +
    'forms:{bind:function(){},submit:function(){return Promise.resolve({ok:true});}},\n' +
    'db:{query:function(){return Promise.resolve({items:[],total:0,page:1,pageSize:0,facets:{},relations:{}});},get:function(){return Promise.resolve(null);},operation:function(){return Promise.resolve({ok:true,result:{}});},subscribe:function(){return function(){};}},\n' +
    'apps:{_reg:{},register:function(name,factory){this._reg[name]=factory;},mount:function(root){var r=root||document;var els=r.querySelectorAll("[data-gw-app]");for(var i=0;i<els.length;i++){var e=els[i];if(e.__gwMounted)continue;e.__gwMounted=true;var n=e.getAttribute("data-gw-app");var cfg={};try{cfg=JSON.parse(e.getAttribute("data-gw-config")||"{}");}catch(err){}var f=this._reg[n];if(f){try{var clean=f({el:e,config:cfg,gw:this});if(clean)e.__gwCleanup=clean;}catch(err){e.textContent="["+n+" error: "+err.message+"]";}}else{e.textContent="["+n+" not registered]";}}},unmount:function(root){var r=root||document;var els=r.querySelectorAll("[data-gw-app]");for(var j=0;j<els.length;j++){var e=els[j];if(e.__gwCleanup){try{e.__gwCleanup();}catch(err){}}e.__gwMounted=false;}}},\n' +
    'service:function(){return Promise.reject(new Error("gw.service not available"));}\n' +
    '};\n' +
    'if(!window.gw){window.gw=gw;}\n' +
    'setTimeout(function(){try{window.dispatchEvent(new CustomEvent("gw:ready",{detail:{pageId:"preview"}}));window.dispatchEvent(new CustomEvent("gw:content-ready",{detail:{contentId:"preview"}}));}catch(e){}},0);\n' +
    '})();\n<\/script>';
  return mock;
}

function buildPreviewDoc() {
  var c = DB.code;
  var lang = 'en';
  return '<!DOCTYPE html>\n<html lang="' + esc(lang) + '">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + esc(DB.meta.name || 'Shared Source Preview') + '</title>\n' +
    '<style>\n' + (c.css || '') + '\n</style>\n</head>\n<body>\n' +
    (c.html || '<div style="padding:24px;color:#6b7280">(empty html)</div>') + '\n' +
    _gwMock(lang) + '\n' +
    '<script>\n' + (c.js || '') + '\n<\/script>\n' +
    '<script>\n(function(){setTimeout(function(){if(window.gw&&window.gw.apps){window.gw.apps.mount(document);}},10);})();\n<\/script>\n' +
    '</body>\n</html>';
}

var _previewSeq = 0;
function updatePreview() {
  var frame = el('preview-frame');
  if (!frame) return;
  _previewSeq++;
  var doc = buildPreviewDoc();
  frame.srcdoc = doc.replace(/__PREVIEWSEQ__/g, String(_previewSeq));
}

/* ── Compliance (subset tuned for shared sources & widgets) ── */
function _getImgs(h) { return h.match(/<img\b[^>]*>/gi) || []; }
function runChecks() {
  var h = DB.code.html || '', c = DB.code.css || '', j = DB.code.js || '';
  var checks = [
    {
      id: 'no-document-tags', label: 'Body fragment only',
      run: function() {
        var bad = h.match(/<\/?(html|head|body)\b[^>]*>/gi) || [];
        if (/<!doctype/i.test(h)) bad.push('<!DOCTYPE>');
        if (bad.length) return { status: 'fail', detail: 'Document tags found: ' + bad.slice(0, 4).join(', ') + ' — shared sources use the same fragment contract as pages.' };
        var embedded = [];
        if (/<style\b/i.test(h)) embedded.push('<style>');
        if (/<script\b/i.test(h)) embedded.push('<script>');
        if (embedded.length) return { status: 'warn', detail: embedded.join(', ') + ' embedded — tolerated but prefer the CSS/JS sections.' };
        return { status: 'pass', detail: 'Clean fragment.' };
      }
    },
    {
      id: 'css-scope', label: 'CSS scoped under own wrapper class',
      run: function() {
        if (!c.trim()) return { status: 'pass', detail: 'No CSS.' };
        var bare = c.match(/(^|})\s*(html|body|\*|a|button|h1|h2|h3|p|ul|li|img|form|input|table|div)\s*\{/gm);
        if (bare && bare.length) return { status: 'fail', detail: 'Bare/global selectors found — shared CSS is injected site-wide. Scope EVERY rule under your wrapper class.' };
        return { status: 'pass', detail: 'Class-scoped selectors.' };
      }
    },
    {
      id: 'gw-reserved', label: 'gw- prefix reserved',
      run: function() {
        var defined = c.match(/\.gw-[a-zA-Z][\w-]*\s*[\[{:]/g) || [];
        if (defined.length) return { status: 'fail', detail: defined.length + ' gw-* selector(s) DEFINED — the prefix is reserved for the platform shell/widgets/sharedCss.' };
        return { status: 'pass', detail: 'No gw-* rules defined.' };
      }
    },
    {
      id: 'no-external-scripts', label: 'No external scripts / CDN',
      run: function() {
        var all = (h + '\n' + j).toLowerCase();
        var hits = [];
        ['jquery', 'bootstrap', 'tailwind', 'cdn.jsdelivr', 'unpkg', 'cdnjs.cloudflare'].forEach(function(lib) {
          if (all.indexOf(lib) !== -1) hits.push(lib);
        });
        if (/<script\b[^>]*\bsrc=/.test(h)) hits.push('external <script src>');
        if (hits.length) return { status: 'fail', detail: 'Forbidden scripts: ' + hits.join(', ') + ' — vanilla JS only.' };
        return { status: 'pass', detail: 'No external scripts.' };
      }
    },
    {
      id: 'embeds-iframe', label: 'Embeds (iframes allowed)',
      run: function() {
        var iframes = (h.match(/<iframe\b/gi) || []).length;
        if (!iframes) return { status: 'pass', detail: 'No embeds.' };
        var bad = h.match(/<iframe\b[^>]*src=["'](?!https?:\/\/)/gi) || [];
        if (bad.length) return { status: 'warn', detail: bad.length + ' iframe(s) without an absolute https URL — use absolute URLs only.' };
        return { status: 'pass', detail: iframes + ' iframe embed(s) with absolute URLs — allowed.' };
      }
    },
    {
      id: 'js-idempotent', label: 'JS idempotent',
      run: function() {
        if (!j.trim()) return { status: 'pass', detail: 'No JavaScript.' };
        var j2 = j.trim().replace(/^(?:\/\*\s*v[\d.]+\s*\*\/|<!--\s*v[\d.]+\s*-->)[ \t]*[\r\n]+/, '');
        var iife = /^\(function|^\(\s*function|^;?\(function/.test(j2);
        var guard = /__[A-Za-z_$][\w$]*(Init|Ready|Mounted|Loaded)/.test(j);
        var winListeners = /(window|document)\.addEventListener/.test(j);
        var topAwait = /(^|\n)\s*await\s/.test(j);
        var problems = [];
        if (!iife && !/\(function/.test(j)) problems.push('not wrapped in an IIFE');
        if (winListeners && !guard) problems.push('window/document listeners without a guard');
        if (topAwait) problems.push('top-level await');
        if (problems.length) return { status: 'warn', detail: problems.join('; ') + ' — this JS re-runs on EVERY page and SPA navigation.' };
        return { status: 'pass', detail: 'Idempotent (IIFE + guards).' };
      }
    },
    {
      id: 'identity', label: 'Name + slug present',
      run: function() {
        var name = (DB.meta.name || '').trim();
        var slug = (DB.meta.slug || '').trim();
        if (!name || !slug) return { status: 'warn', detail: 'Name and slug are required — the object needs both to be referenced by pages.' };
        if (/^(default-settings|default-header|default-footer)$/.test(slug)) return { status: 'fail', detail: 'Slug is a reserved platform slug — choose another.' };
        return { status: 'pass', detail: 'Name + slug set (' + slug + ').' };
      }
    },
    {
      id: 'widget-contract', label: 'Widget contract',
      run: function() {
        if (DB.meta.kind !== 'widget') return { status: 'pass', detail: 'Not a widget.' };
        var name = (DB.meta.gwAppName || '').trim();
        var problems = [];
        if (!name) problems.push('island name missing');
        else if (!new RegExp('gw\\.apps\\.register\\s*\\(\\s*[\\"\']' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(j)) problems.push('gw.apps.register("' + name + '") not called in JS');
        if (!/data-gw-app/.test(h)) problems.push('no test island div (data-gw-app) in HTML');
        if (DB.meta.configSchema.trim()) {
          try { JSON.parse(DB.meta.configSchema); } catch (e) { problems.push('configSchema is not valid JSON'); }
        }
        if (problems.length) return { status: 'warn', detail: problems.join('; ') + '.' };
        return { status: 'pass', detail: 'Widget contract complete (register + island + config schema).' };
      }
    },
    {
      id: 'mandatory-light', label: 'Mandatory sources stay light',
      run: function() {
        if (DB.meta.kind !== 'shared' || DB.meta.sharedMode !== 'mandatory') return { status: 'pass', detail: 'Not mandatory.' };
        var total = (DB.code.html || '').length + (DB.code.css || '').length + (DB.code.js || '').length;
        if (total > 80000) return { status: 'warn', detail: 'Mandatory source is ' + Math.round(total / 1024) + ' KB — it runs on EVERY page, keep it light.' };
        return { status: 'pass', detail: 'Mandatory source is reasonably light.' };
      }
    },
    {
      id: 'budgets', label: 'Size budgets',
      run: function() {
        var lh = h.length, lc = c.length, lj = j.length;
        var over = [];
        if (lh > 100000) over.push('HTML ' + Math.round(lh / 1024) + ' KB > 100 KB');
        if (lc > 50000) over.push('CSS ' + Math.round(lc / 1024) + ' KB > 50 KB');
        if (lj > 200000) over.push('JS ' + Math.round(lj / 1024) + ' KB > 200 KB');
        if (over.length) return { status: 'fail', detail: over.join('; ') + '.' };
        return { status: 'pass', detail: 'HTML ' + Math.round(lh / 1024) + ' KB · CSS ' + Math.round(lc / 1024) + ' KB · JS ' + Math.round(lj / 1024) + ' KB.' };
      }
    }
  ];
  var results = [], passed = 0, warned = 0, failed = 0;
  for (var i = 0; i < checks.length; i++) {
    var r;
    try { r = checks[i].run(); } catch (e) { r = { status: 'warn', detail: 'Check error: ' + e.message }; }
    r.id = checks[i].id; r.label = checks[i].label;
    results.push(r);
    if (r.status === 'pass') passed++;
    else if (r.status === 'warn') warned++;
    else failed++;
  }
  return { results: results, passed: passed, warned: warned, failed: failed, total: results.length };
}
var _lastChecks = null;
function renderChecks() {
  var res = runChecks(); // always recompute — the code may have changed since the last render
  _lastChecks = res;
  var score = el('compliance-score');
  var list = el('compliance-list');
  if (!score || !list) return;
  score.textContent = '✅ ' + res.passed + ' · ⚠️ ' + res.warned + ' · ❌ ' + res.failed;
  score.className = res.failed ? 'fail' : res.warned ? 'warn' : 'ok';
  var h = '';
  for (var i = 0; i < res.results.length; i++) {
    var r = res.results[i];
    var icon = r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌';
    h += '<div class="compliance-item ' + r.status + '">' +
      '<div class="compliance-item-label">' + icon + ' ' + esc(r.label) + '</div>' +
      '<div class="compliance-item-detail">' + esc(r.detail) + '</div>' +
      '</div>';
  }
  list.innerHTML = h;
}

/* ── Exports ── */
function buildSharedObjectJson() {
  var m = DB.meta;
  var data = {
    version: DB.version || '1.0.0',
    htmlPage: { code: { html: DB.code.html || '', css: DB.code.css || '', js: DB.code.js || '' } }
  };
  if (m.kind === 'widget') {
    data.gwApp = { name: (m.gwAppName || '').trim() };
    if (m.configSchema.trim()) {
      try { data.gwApp.configSchema = JSON.parse(m.configSchema); } catch (e) { data.gwApp.configSchema = m.configSchema.trim(); }
    }
    if (m.ssrHtml.trim()) data.ssrHtml = m.ssrHtml.trim();
  } else {
    data.sharedMode = m.sharedMode || 'optional';
  }
  var obj = {
    name: m.name.trim() || 'Shared Source',
    slug: (m.slug || '').trim() || slugify(m.name || 'shared'),
    meta: { language: 'en' },
    data: data
  };
  return JSON.stringify(obj, null, 2);
}
function buildGeneratorOutputText() {
  var m = DB.meta;
  var meta = {
    name: m.name.trim() || 'Shared Source',
    slug: (m.slug || '').trim() || slugify(m.name || 'shared'),
    kind: m.kind,
    version: DB.version || '1.0.0'
  };
  if (m.kind === 'widget') {
    meta.gwApp = { name: (m.gwAppName || '').trim() };
    if (m.configSchema.trim()) { try { meta.gwApp.configSchema = JSON.parse(m.configSchema); } catch (e) { meta.gwApp.configSchema = m.configSchema.trim(); } }
    if (m.ssrHtml.trim()) meta.ssrHtml = m.ssrHtml.trim();
  } else {
    meta.sharedMode = m.sharedMode || 'optional';
  }
  var out = '=== HTML ===\n' + (DB.code.html || '') +
    '\n\n=== CSS ===\n' + (DB.code.css || '') +
    '\n\n=== JS ===\n' + (DB.code.js || '') +
    '\n\n=== SHARED SOURCE META ===\n' + JSON.stringify(meta, null, 2);
  if (m.kind === 'shared' && meta.sharedMode === 'mandatory') {
    out += '\n\n=== CMS CONFIG NEEDED ===\n' +
      'Register the "shared-sources" object type in the site app cms-settings.objectTypes[]. ' +
      'This object has sharedMode "mandatory": the platform injects its html/css/js into EVERY page of the site. Keep it light.';
  } else if (m.kind === 'widget') {
    out += '\n\n=== CMS CONFIG NEEDED ===\n' +
      'Register the "gw-widgets" object type in the site app cms-settings.objectTypes[] and include this object in the site\'s MANDATORY widget-registry shared source so gw.apps.register runs on every page. ' +
      'Pages embed it as <div data-gw-app="' + esc((m.gwAppName || '').trim()) + '" data-gw-config=\'{...}\'></div>.';
  } else {
    out += '\n\n=== CMS CONFIG NEEDED ===\n' +
      'Register the "shared-sources" object type in the site app cms-settings.objectTypes[] (publicAccess). ' +
      'Pages opt in via data.sections: { "cmsObjectType": "shared-sources", "objectId": "<this object id>" }.';
  }
  return out;
}
function copyToClipboard(text, label) {
  function done(ok) { tool.notify(ok ? (label || 'Copied!') : 'Copy failed', ok ? 'success' : 'error'); }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() { done(true); }).catch(function() { fallbackCopy(text, done); });
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, cb) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  var ok = false;
  try { ok = document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
  cb(ok);
}
function copyObjectJson() {
  _commitEditors();
  if (!DB.code.html && !DB.code.css && !DB.code.js) { tool.notify('Nothing to export yet — write some code first.', 'warning'); return; }
  copyToClipboard(buildSharedObjectJson(), 'Object JSON copied — create the object in the CMS with this shape.');
}
function copyGeneratorOutput() {
  _commitEditors();
  if (!DB.code.html && !DB.code.css && !DB.code.js) { tool.notify('Nothing to export yet — write some code first.', 'warning'); return; }
  copyToClipboard(buildGeneratorOutputText(), 'Generator output copied (=== sections).');
}
function downloadPreview() {
  _commitEditors();
  var blob = new Blob([buildPreviewDoc()], { type: 'text/html' });
  var u = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = u;
  a.download = (DB.meta.slug || 'shared') + '.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(u); }, 1000);
  tool.notify('Downloaded: ' + a.download, 'success');
}

/* ── Meta sync (side panel → DB) ── */
function _readMeta() {
  DB.meta.name = el('meta-name').value;
  DB.meta.slug = el('meta-slug').value;
  var mode = qs2('input[name="sharedMode"]:checked');
  DB.meta.sharedMode = mode ? mode.value : 'optional';
  DB.meta.gwAppName = el('meta-gwapp').value;
  DB.meta.configSchema = el('meta-configschema').value;
  DB.meta.ssrHtml = el('meta-ssrhtml').value;
  DB.meta.kind = _readKind();
}

/* ── Render (restore from saved value) ── */
function render(v) {
  if (v && typeof v === 'object') {
    if (v.code && typeof v.code === 'object') {
      DB.code = { html: v.code.html || '', css: v.code.css || '', js: v.code.js || '' };
    }
    if (v.meta && typeof v.meta === 'object') {
      for (var k in v.meta) if (Object.prototype.hasOwnProperty.call(v.meta, k)) DB.meta[k] = v.meta[k];
    }
    if (typeof v.version === 'string' && v.version) DB.version = v.version;
    if (_stampVersionInCode()) { _justEdited = true; try { persist(); } catch (e) {} }
  }
  displayCode();
  el('meta-name').value = DB.meta.name || '';
  el('meta-slug').value = DB.meta.slug || '';
  var kindRadios = qsa('input[name="kind"]');
  for (var i = 0; i < kindRadios.length; i++) kindRadios[i].checked = (kindRadios[i].value === (DB.meta.kind || 'shared'));
  var modeRadios = qsa('input[name="sharedMode"]');
  for (var j = 0; j < modeRadios.length; j++) modeRadios[j].checked = (modeRadios[j].value === (DB.meta.sharedMode || 'optional'));
  el('meta-gwapp').value = DB.meta.gwAppName || '';
  el('meta-configschema').value = DB.meta.configSchema || '';
  el('meta-ssrhtml').value = DB.meta.ssrHtml || '';
  applyKindUI();
  _renderVersion();
  renderChecks();
  updatePreview();
  tool.resize();
}

/* ── Events ── */
function bindEvents() {
  el('tool-version').onclick = _onVersionClick;
  el('btn-export-json').onclick = copyObjectJson;
  el('btn-export-sections').onclick = copyGeneratorOutput;
  el('btn-download').onclick = downloadPreview;
  el('btn-refresh-preview').onclick = updatePreview;
  el('btn-run-checks').onclick = function() { _commitEditors(); renderChecks(); tool.notify('Checks refreshed.', 'info'); };

  qsa('.ctab').forEach(function(t) {
    t.onclick = function() { switchTab(this.getAttribute('data-tab')); };
  });

  qsa('input[name="kind"]').forEach(function(r) {
    r.onchange = function() { _readMeta(); applyKindUI(); renderChecks(); };
  });
  qsa('input[name="sharedMode"]').forEach(function(r) {
    r.onchange = function() { _readMeta(); updatePreviewHint(); renderChecks(); };
  });

  el('meta-name').addEventListener('input', debounce(function() {
    DB.meta.name = this.value;
    if (!el('meta-slug').value.trim()) el('meta-slug').value = slugify(this.value);
    DB.meta.slug = el('meta-slug').value;
    persist(); renderChecks();
  }, 400));
  el('meta-slug').addEventListener('input', debounce(function() {
    DB.meta.slug = this.value;
    persist(); renderChecks();
  }, 400));
  el('meta-gwapp').addEventListener('input', debounce(function() {
    DB.meta.gwAppName = this.value;
    updatePreviewHint(); persist(); renderChecks();
  }, 400));
  el('meta-configschema').addEventListener('input', debounce(function() {
    DB.meta.configSchema = this.value;
    persist(); renderChecks();
  }, 400));
  el('meta-ssrhtml').addEventListener('input', debounce(function() {
    DB.meta.ssrHtml = this.value;
    persist();
  }, 400));

  var onCodeEdit = debounce(function() {
    _commitEditors();
    refreshEditorHighlight('html');
    refreshEditorHighlight('css');
    refreshEditorHighlight('js');
    persist();
    renderChecks();
    updatePreview();
  }, 600);
  qsa('.code-textarea').forEach(function(ta) {
    ta.addEventListener('input', onCodeEdit);
  });

  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      _commitEditors();
      persist();
      tool.notify('Saved.', 'info');
    }
  });
}

/* ── Entry point ── */
var _initialized = false;
tool.onReady(function(val, fields) {
  if (_initialized) return;
  _initialized = true;
  console.log('[WEBSITESHAREDSOURCEBUILDER] build 2026-10-02b — shared sources + widget library authoring, simplified UI + syntax-highlighted editors');

  tool.declareOutput({
    type: 'object',
    title: 'WebsiteSharedSourceBuilder Value',
    description: 'Saved value: three code blocks + object meta (kind: shared source | widget) + version.',
    properties: {
      code: {
        type: 'object', title: 'Code',
        description: 'The three code sections (html/css/js) — the same contract as a page.',
        properties: {
          html: { type: 'string', title: 'HTML', description: 'Body fragment only — no document tags.' },
          css: { type: 'string', title: 'CSS', description: 'Scoped stylesheet under the source\'s own wrapper class.' },
          js: { type: 'string', title: 'JavaScript', description: 'Idempotent guarded vanilla JS.' }
        }
      },
      meta: { type: 'object', title: 'Meta', description: 'kind (shared | widget), name, slug, sharedMode, gwAppName, configSchema, ssrHtml.' },
      version: { type: 'string', title: 'Version', description: 'Semantic version — bumped on every meaningful edit (feeds the SSR cache key).' }
    }
  });

  try { tool.reportValid(true); } catch (e) {}
  render(val);
  bindEvents();
  updatePreview();
  tool.resize();
});

tool.onValueChange(function(v) { render(v); });
tool.onReadonlyChange(function(ro) { document.body.classList.toggle('readonly', ro === true); });
