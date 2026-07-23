/* ── VibeCoding HTML App Builder ──
   Chat-left + Code-right. Config as a right-side tab.
   Chat handles both initial generation & iterative refinement.
   Preview updates live on every code change.
   Built for UniconHub CMS HTML-tool system.
────────────────────────────────────────── */

/* ── Helpers ── */
function el(id) { return document.getElementById(id); }
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/* ── State ── */
var DB = {
  toolName: '', toolDesc: '', requirements: '', audience: 'admin',
  storage: 'value', cmsTypes: '', cmsFields: '', siblingFields: 'no',
  features: ['ai'], featureNotes: '',
  layout: 'single-page', colorScheme: 'blue', themeSupport: 'light-only', styleNotes: '',
  generated: { html: '', css: '', js: '' },
  history: [],
  chatMessages: [],
  _theme: 'light'
};

var isReadOnly = false;
var currentTab = 'html';
var attachedFile = null; // { name, url, size, type, extractedText }

/* ── Full HTML Tool Rules (loaded from embedded DOM element) ── */
var htmlRulesText = ''; // populated in onReady from #html-rules-source

/* ── Persistence ── */
function persist() { tool.setValue(DB); tool.resize(); }
function applyTheme(t) { DB._theme = t; document.documentElement.setAttribute('data-theme', t); var b = el('btn-theme'); if (b) b.textContent = t === 'dark' ? '☀️' : '🌓'; }
function toggleTheme() { applyTheme(DB._theme === 'dark' ? 'light' : 'dark'); persist(); }
function showToast(msg, sev) { tool.notify(msg, sev || 'info'); }
function lockUI(ro) { isReadOnly = ro === true; document.body.classList.toggle('readonly', isReadOnly); }

/* ── Role-based UI ── */
function isDeveloper() {
  var user = tool.getUser();
  if (!user || !user.roles) return false;
  // Check for developer role (case-insensitive, handles arrays and comma-separated strings)
  var roles = Array.isArray(user.roles) ? user.roles : String(user.roles).split(',');
  for (var i = 0; i < roles.length; i++) {
    if (String(roles[i]).trim().toLowerCase() === 'developer') return true;
  }
  return false;
}

function updateDeveloperUI() {
  var dev = isDeveloper();
  // Show/hide HTML, CSS, JS code tabs
  qsa('.ctab[data-tab="html"], .ctab[data-tab="css"], .ctab[data-tab="js"]').forEach(function(t) {
    t.style.display = dev ? '' : 'none';
  });
  // Hide individual copy buttons for non-developers
  qsa('#btn-copy-html, #btn-copy-css, #btn-copy-js').forEach(function(b) {
    b.style.display = 'none';
  });
  // If currently on a code tab but not a developer, switch to preview
  if (!dev && (currentTab === 'html' || currentTab === 'css' || currentTab === 'js')) {
    switchTab('preview');
  }
}

/* ── Collect / Restore Form Data ── */
function collectFormData() {
  DB.toolName = (el('f-tool-name') && el('f-tool-name').value || '').trim();
  DB.toolDesc = (el('f-tool-desc') && el('f-tool-desc').value || '').trim();
  DB.requirements = (el('f-tool-requirements') && el('f-tool-requirements').value || '').trim();
  DB.audience = el('f-audience') && el('f-audience').value || 'admin';
  var sr = qs('input[name="storage"]:checked'); DB.storage = sr ? sr.value : 'value';
  DB.cmsTypes = (el('f-cms-types') && el('f-cms-types').value || '').trim();
  DB.cmsFields = (el('f-cms-fields') && el('f-cms-fields').value || '').trim();
  DB.siblingFields = el('f-sibling-fields') && el('f-sibling-fields').value || 'no';
  DB.features = []; qsa('.feat-check:checked').forEach(function(cb) { DB.features.push(cb.dataset.feat); });
  DB.featureNotes = (el('f-feature-notes') && el('f-feature-notes').value || '').trim();
  var lr = qs('input[name="layout"]:checked'); DB.layout = lr ? lr.value : (DB.layout || 'single-page');
  DB.colorScheme = (el('f-color-scheme') && el('f-color-scheme').value) || DB.colorScheme || 'blue';
  DB.themeSupport = (el('f-theme-support') && el('f-theme-support').value) || DB.themeSupport || 'light-only';
  DB.styleNotes = (el('f-style-notes') && el('f-style-notes').value || '').trim();
}

function restoreFormData() {
  var setV = function(id, v) { var e = el(id); if (e) e.value = v || ''; };
  setV('f-tool-name', DB.toolName); setV('f-tool-desc', DB.toolDesc);
  setV('f-tool-requirements', DB.requirements); setV('f-audience', DB.audience || 'admin');
  var sr = qs('input[name="storage"][value="' + (DB.storage || 'value') + '"]'); if (sr) sr.checked = true;
  setV('f-cms-types', DB.cmsTypes); setV('f-cms-fields', DB.cmsFields);
  setV('f-sibling-fields', DB.siblingFields || 'no');
  qsa('.feat-check').forEach(function(cb) { cb.checked = DB.features.indexOf(cb.dataset.feat) !== -1; });
  setV('f-feature-notes', DB.featureNotes);
  var lr = qs('input[name="layout"][value="' + (DB.layout || 'single-page') + '"]'); if (lr) lr.checked = true;
  setV('f-color-scheme', DB.colorScheme || 'blue');
  setV('f-theme-support', DB.themeSupport || 'light-only');
  setV('f-style-notes', DB.styleNotes);
  var cs = el('crud-section'); if (cs) cs.style.display = (DB.storage === 'crud' || DB.storage === 'both') ? '' : 'none';
}

/* ── Code Display ── */
function displayCode(part, code) {
  var ta = el('code-' + part); var linesEl = el(part + '-lines');
  if (ta) { ta.value = code || ''; var lc = (code || '').split('\n').length; if (linesEl) { var n = ''; for (var i = 1; i <= lc; i++) n += '<div>' + i + '</div>'; linesEl.innerHTML = n; } }
  if (ta && linesEl) ta.onscroll = function() { linesEl.scrollTop = ta.scrollTop; };
}
function displayAllCode(g) {
  displayCode('html', g.html || ''); displayCode('css', g.css || ''); displayCode('js', g.js || '');
  updatePreview();
  updateChatBadge();
}

/* ── Live Preview ── */
function updatePreview() {
  var html = el('code-html') ? el('code-html').value : '';
  var css = el('code-css') ? el('code-css').value : '';
  var js = el('code-js') ? el('code-js').value : '';
  var fw = qs('.preview-frame-wrap'); var pe = el('preview-empty'); var frame = el('preview-frame');
  if (!html.trim() && !css.trim() && !js.trim()) { if (fw) fw.classList.remove('has-content'); if (pe) pe.style.display = ''; return; }
  if (fw) fw.classList.add('has-content'); if (pe) pe.style.display = 'none';
  if (frame) {
    // Build a complete document with mock tool SDK injected before the generated JS
    // This lets buttons, forms, and interactions work in the preview
    var previewDoc = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Preview</title>\n<style>\n@keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }\n/* ── Generated CSS ── */\n' + css + '\n</style>\n</head>\n<body>\n' +
    '<!-- ── Generated HTML ── -->\n' + html + '\n' +
    '<!-- ── Mock tool SDK for preview ── -->\n<script>\n' +
    '(function() {\n' +
    '  var _val = null, _ro = false, _fields = {}, _objects = {};\n' +
    '  var _listeners = { valueChange: [], readonlyChange: [], fieldsChange: [], userChange: [] };\n' +
    '  function fire(evt, arg) { (_listeners[evt]||[]).forEach(function(cb){ try{cb(arg)}catch(e){console.error(e)} }); }\n' +
    '  function genId() { return "prev_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }\n' +
    '  window.tool = {\n' +
    '    onReady: function(cb) { setTimeout(function() { cb(_val, _fields); }, 5); },\n' +
    '    getValue: function() { return _val; },\n' +
    '    setValue: function(d) { _val = d; fire("valueChange", d); },\n' +
    '    onValueChange: function(cb) { _listeners.valueChange.push(cb); },\n' +
    '    getFields: function() { return _fields; },\n' +
    '    setField: function(id, v) { _fields[id] = v; fire("fieldsChange", _fields); },\n' +
    '    setFields: function(obj) { for (var k in obj) _fields[k] = obj[k]; fire("fieldsChange", _fields); },\n' +
    '    watchField: function(id, cb) {},\n' +
    '    onFieldsChange: function(cb) { _listeners.fieldsChange.push(cb); },\n' +
    '    param: function(n, d) { return d; },\n' +
    '    isReadOnly: function() { return _ro; },\n' +
    '    onReadonlyChange: function(cb) { _listeners.readonlyChange.push(cb); },\n' +
    '    getUser: function() { return { id:"preview", name:"Preview User", email:"preview@test", roles:["developer"] }; },\n' +
    '    onUserChange: function(cb) { _listeners.userChange.push(cb); },\n' +
    '    getPermittedUsers: function() { return [{id:"u1",name:"Alice"},{id:"u2",name:"Bob"}]; },\n' +
    '    onPermittedUsersChange: function() {},\n' +
    '    reportValid: function(v, m) { console.log("reportValid:", v, m); },\n' +
    '    notify: function(m, s) {\n' +
    '      var t = document.createElement("div");\n' +
    '      t.style.cssText = "position:fixed;bottom:16px;right:16px;padding:10px 16px;border-radius:8px;font-size:12px;font-weight:600;z-index:9999;animation:slideUp 0.3s;max-width:320px;color:#fff;";\n' +
    '      t.style.background = s==="error"?"#dc2626":s==="success"?"#16a34a":s==="warning"?"#d97706":"#2563eb";\n' +
    '      t.textContent = m; document.body.appendChild(t);\n' +
    '      setTimeout(function(){ t.remove(); }, 3500);\n' +
    '      console.log("NOTIFY ["+(s||"info")+"]:", m);\n' +
    '    },\n' +
    '    resize: function() {},\n' +
    '    openUrl: function(u) { window.open(u, "_blank"); },\n' +
    '    declareOutput: function() {},\n' +
    '    declareParams: function() {},\n' +
    '    reportMissingParams: function() {},\n' +
    '    requestUpload: function(accept, cb) {\n' +
    '      setTimeout(function(){ cb(null, {name:"preview-file.pdf",url:"#",size:1024,type:"application/pdf"}); }, 300);\n' +
    '    },\n' +
    '    requestFileContent: function(url, cb) {\n' +
    '      setTimeout(function(){ cb(null, "Mock file content for preview."); }, 200);\n' +
    '    },\n' +
    '    requestAI: function(prompt, ctx, cb) {\n' +
    '      setTimeout(function(){ cb(null, "This is a mock AI response. In the real CMS, tool.requestAI() will call the configured AI service."); }, 500);\n' +
    '    },\n' +
    '    requestObjects: function(action, params, cb) {\n' +
    '      var type = params.mainObjectType || "default";\n' +
    '      if (!_objects[type]) _objects[type] = [];\n' +
    '      var list = _objects[type];\n' +
    '      setTimeout(function() {\n' +
    '        try {\n' +
    '          if (action === "query") { cb(null, { objects: list.slice() }); }\n' +
    '          else if (action === "get") {\n' +
    '            var obj = null;\n' +
    '            for (var i = 0; i < list.length; i++) { if (list[i].id === params.objectId) { obj = list[i]; break; } }\n' +
    '            cb(null, { object: obj });\n' +
    '          }\n' +
    '          else if (action === "create") {\n' +
    '            var newObj = { id: genId(), name: params.name || "Untitled", cmsObjectType: type, productData: params.productData || { data_categoriesBased: {} }, created: new Date().toISOString(), updated: new Date().toISOString() };\n' +
    '            list.push(newObj); cb(null, { object: newObj });\n' +
    '          }\n' +
    '          else if (action === "update") {\n' +
    '            for (var j = 0; j < list.length; j++) {\n' +
    '              if (list[j].id === params.objectId) {\n' +
    '                if (params.name) list[j].name = params.name;\n' +
    '                if (params.productData) list[j].productData = params.productData;\n' +
    '                list[j].updated = new Date().toISOString();\n' +
    '                cb(null, { ok: true }); return;\n' +
    '              }\n' +
    '            }\n' +
    '            cb("Object not found", null);\n' +
    '          }\n' +
    '          else if (action === "delete") {\n' +
    '            for (var k = 0; k < list.length; k++) {\n' +
    '              if (list[k].id === params.objectId) { list.splice(k, 1); cb(null, { ok: true }); return; }\n' +
    '            }\n' +
    '            cb("Object not found", null);\n' +
    '          }\n' +
    '          else { cb("Unknown action: " + action, null); }\n' +
    '        } catch(e) { cb("CRUD error: " + e.message, null); }\n' +
    '      }, 100);\n' +
    '    }\n' +
    '  };\n' +
    '})();\n' +
    'var _consoleBuf = [];\n' +
    'function _postLog(level, args) {\n' +
    '  var msg = Array.prototype.slice.call(args).map(function(a){ try{return typeof a==="object"?JSON.stringify(a):String(a)}catch(e){return String(a)} }).join(" ");\n' +
    '  try { parent.postMessage({vibeConsole:{level:level, msg:msg, time:new Date().toISOString()}}, "*"); } catch(e) {}\n' +
    '}\n' +
    'var _origConsole = { log:console.log, warn:console.warn, error:console.error };\n' +
    'console.log = function(){ _postLog("log", arguments); _origConsole.log.apply(console, arguments); };\n' +
    'console.warn = function(){ _postLog("warn", arguments); _origConsole.warn.apply(console, arguments); };\n' +
    'console.error = function(){ _postLog("error", arguments); _origConsole.error.apply(console, arguments); };\n' +
    'window.onerror = function(m) { _postLog("error", ["Preview:", m]); return true; };\n' +
    '<\/script>\n' +
    '<!-- ── Generated JS ── -->\n<script>\n' + js + '\n<\/script>\n</body>\n</html>';
    frame.srcdoc = previewDoc;
  }
}

/* ── Tab Switching (right panel) ── */
function switchTab(tab) {
  // Block non-developers from accessing code tabs
  if (!isDeveloper() && (tab === 'html' || tab === 'css' || tab === 'js')) {
    tab = 'preview';
  }
  currentTab = tab;
  qsa('.ctab').forEach(function(t) { t.classList.remove('active'); });
  qsa('.content-editor').forEach(function(e) { e.classList.remove('active'); });
  var tb = qs('.ctab[data-tab="' + tab + '"]'); if (tb) tb.classList.add('active');
  var ed = el('editor-' + tab); if (ed) ed.classList.add('active');
  qsa('#btn-copy-html, #btn-copy-css, #btn-copy-js').forEach(function(b) { b.style.display = 'none'; });
  if (tab === 'html') { var b = el('btn-copy-html'); if (b) b.style.display = ''; }
  else if (tab === 'css') { var b = el('btn-copy-css'); if (b) b.style.display = ''; }
  else if (tab === 'js') { var b = el('btn-copy-js'); if (b) b.style.display = ''; }
  if (tab === 'preview') updatePreview();
  if (tab === 'console') renderConsole();
  if (tab === 'config') { collectFormData(); restoreFormData(); }
  tool.resize();
}

/* ── Copy / Download ── */
function copyToClipboard(text, label) {
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function() { showToast((label||'Code')+' copied!', 'success'); }).catch(function() { fallbackCopy(text, label); }); }
  else { fallbackCopy(text, label); }
}
function fallbackCopy(text, label) { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); showToast((label||'Code')+' copied!', 'success'); } catch(e) { showToast('Copy failed', 'error'); } document.body.removeChild(ta); }
function copyCurrentTab() { var ta = el('code-' + currentTab); if (ta && ta.value.trim()) copyToClipboard(ta.value, currentTab.toUpperCase()); else showToast('No code to copy.', 'warning'); }
function copyAllBlocks() {
  var h = el('code-html') ? el('code-html').value.trim() : '', c = el('code-css') ? el('code-css').value.trim() : '', j = el('code-js') ? el('code-js').value.trim() : '';
  if (!h && !c && !j) { showToast('No code yet.', 'warning'); return; }
  copyToClipboard('[HTML]\n' + h + '\n\n[CSS]\n' + c + '\n\n[JS]\n' + j, 'All three blocks');
}
function downloadFiles() {
  var h = el('code-html') ? el('code-html').value.trim() : '', c = el('code-css') ? el('code-css').value.trim() : '', j = el('code-js') ? el('code-js').value.trim() : '';
  if (!h && !c && !j) { showToast('No code yet.', 'warning'); return; }
  var slug = (DB.toolName || 'tool').replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'html-tool';
  function dl(content, ext) { if (!content) return; var b = new Blob([content], { type: ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : 'text/javascript' }); var u = URL.createObjectURL(b); var a = document.createElement('a'); a.href = u; a.download = slug + ext; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); }
  dl(h, '.html'); dl(c, '.css'); dl(j, '.js');
  showToast('Files downloaded!', 'success');
}

/* ── Parse AI Response ── */
function parseGeneratedCode(text) {
  var r = { html: '', css: '', js: '' };
  var hm = text.match(/\[HTML\]\s*([\s\S]*?)(?=\[CSS\]|$)/i);
  var cm = text.match(/\[CSS\]\s*([\s\S]*?)(?=\[JS\]|$)/i);
  var jm = text.match(/\[JS\]\s*([\s\S]*?)$/i);
  if (hm) r.html = hm[1].trim(); if (cm) r.css = cm[1].trim(); if (jm) r.js = jm[1].trim();
  if (!r.html && !r.css && !r.js) {
    var blocks = text.match(/```(?:html)?\s*([\s\S]*?)```/g);
    if (blocks) blocks.forEach(function(b) {
      var content = b.replace(/```(?:\w+)?\s*/, '').replace(/```\s*$/, '').trim();
      var lang = b.match(/```(\w+)/); var l = lang ? lang[1].toLowerCase() : '';
      if (l === 'html' || (!l && !r.html)) r.html = content;
      else if (l === 'css') r.css = content;
      else if (l === 'js' || l === 'javascript') r.js = content;
    });
  }
  r.html = r.html.replace(/^```html\s*/, '').replace(/```\s*$/, '').trim();
  r.css = r.css.replace(/^```css\s*/, '').replace(/```\s*$/, '').trim();
  r.js = r.js.replace(/^```(?:js|javascript)\s*/, '').replace(/```\s*$/, '').trim();
  return r;
}

/* ── Build Prompts ── */
function buildFullPrompt() {
  collectFormData();
  return [
    'You are building an HTML tool for the UniconHub CMS html-tool system (sandboxed iframe, window.tool SDK).',
    'Tool Name: ' + (DB.toolName || 'Untitled'), 'Description: ' + (DB.toolDesc || ''),
    'Audience: ' + DB.audience, 'Storage: ' + DB.storage,
    'Requirements: ' + (DB.requirements || '(none)'),
    'CMS Types: ' + (DB.cmsTypes || '(none)'), 'Fields: ' + (DB.cmsFields || '(none)'),
    'Features: ' + DB.features.join(', '), 'Layout: ' + DB.layout,
    'Color: ' + DB.colorScheme, 'Theme: ' + DB.themeSupport,
    'Style notes: ' + (DB.styleNotes || '(none)'),
    '', htmlRulesText, '',
    'Generate COMPLETE tool as THREE blocks: [HTML], [CSS], [JS].',
    '[HTML]: body markup only — no html/head/style/script/body/DOCTYPE tags. CDN scripts allowed.',
    '[CSS]: stylesheet rules only — no <style> tag. CSS variables, theming, responsive.',
    '[JS]: JavaScript only — no <script> tag. tool.onReady(cb) entry point.',
    'CRITICAL JS RULES — ES5 ONLY (the sandbox does NOT support ES6+):',
    '  - Use var ONLY. Never use let or const.',
    '  - NEVER use spread operator (...). Use Object.assign() or manual copying instead.',
    '  - NEVER use template literals (`backticks`). Use string concatenation with + only.',
    '  - NEVER use arrow functions (=>). Always use function() {} syntax.',
    '  - NEVER use destructuring ({a,b}=obj or [a,b]=arr). Access properties directly.',
    '  - NEVER use default parameters (function(x=1)). Check with || inside the function.',
    '  - NEVER use for...of loops. Use for(var i=0;...) instead.',
    '  - NEVER use Map, Set, Symbol, Promise, async/await, or class syntax.',
    'CRITICAL: Define EVERY function you call. If you use onclick="loadData()" in HTML,',
    '  you MUST have a function loadData(){} defined in JS. No dangling references.',
    '  All event handlers (onclick, onchange, onsubmit, etc.) must reference defined functions.',
    '  All functions called in tool.onReady() must exist in the JS block.',
    'Complete, functional code. No placeholders, no TODO comments. Output ONLY the three blocks.'
  ].join('\n');
}

function buildChatPrompt(userMsg) {
  var hasCode = (DB.generated.html || DB.generated.css || DB.generated.js);
  var parts = ['You are helping build/refine an HTML tool for UniconHub CMS (sandboxed iframe, window.tool SDK).'];

  // Include attached file content if present
  if (attachedFile) {
    parts.push('');
    parts.push('=== ATTACHED FILE ===');
    parts.push('Filename: ' + attachedFile.name);
    parts.push('Type: ' + attachedFile.type);
    parts.push('URL: ' + attachedFile.url);
    if (attachedFile.extractedText) {
      var excerpt = attachedFile.extractedText;
      if (excerpt.length > 50000) excerpt = excerpt.substring(0, 50000) + '\n... (truncated from ' + attachedFile.extractedText.length.toLocaleString() + ' chars)';
      parts.push('');
      parts.push('--- Extracted Text Content ---');
      parts.push(excerpt);
      parts.push('--- End Extracted Content ---');
    } else {
      parts.push('Note: This is an image or non-text file. The URL above points to the uploaded file for reference.');
    }
    parts.push('');
  }

  if (hasCode) {
    parts.push('=== CURRENT CODE ===');
    parts.push('[HTML]\n' + (DB.generated.html || '(empty)'));
    parts.push('[CSS]\n' + (DB.generated.css || '(empty)'));
    parts.push('[JS]\n' + (DB.generated.js || '(empty)'));
    parts.push('');
    parts.push('=== USER REQUEST ===');
    parts.push(userMsg);
    parts.push('');
    parts.push('Apply the requested change to the code above. Output the COMPLETE updated [HTML]/[CSS]/[JS] blocks.');
    parts.push('Even for small changes, output ALL three complete blocks — never output just fragments.');
    parts.push('Preserve all code not asked to change. Follow ALL html-tool rules and ES5 restrictions.');
  } else {
    // No code yet — this is an initial generation request
    parts.push('=== PROJECT CONFIG ===');
    parts.push('Name: ' + (DB.toolName || 'Not set — infer from request'));
    parts.push('Storage: ' + DB.storage + ' | Layout: ' + DB.layout + ' | Color: ' + DB.colorScheme);
    parts.push('Features: ' + DB.features.join(', '));
    parts.push('');
    parts.push('=== USER REQUEST (treat as requirements) ===');
    parts.push(userMsg);
    parts.push('');
    parts.push('Generate a COMPLETE tool from scratch. Output ALL THREE blocks [HTML]/[CSS]/[JS].');
    parts.push('Follow all html-tool rules below.');
  }

  parts.push(''); parts.push(htmlRulesText);
  parts.push('');
  parts.push('CRITICAL JS RULES — ES5 ONLY (the sandbox does NOT support ES6+):');
  parts.push('  NEVER use: let, const, spread (...), template literals (`), arrow functions (=>), destructuring, for...of, default params, Map, Set, Promise, async/await, class.');
  parts.push('  ALWAYS use: var, function() {}, string concatenation (+), for(var i=0;...), Object.assign().');
  parts.push('  EVERY onclick/event handler in HTML MUST reference a function DEFINED in JS. No dangling function calls.');
  parts.push('');
  parts.push('IMPORTANT: Always output ALL THREE blocks when providing code. If the user is just chatting, answer naturally.');
  parts.push('Format: [HTML] ... [CSS] ... [JS] ...');

  return parts.join('\n');
}

/* ── File Upload ── */
function handleFileUpload() {
  // Accept images, PDFs, docs, text files
  tool.requestUpload('.png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.doc,.docx,.txt,.md,.csv', function(err, file) {
    if (err) { showToast('Upload failed: ' + err, 'error'); return; }
    attachedFile = { name: file.name, url: file.url, size: file.size, type: file.type, extractedText: '' };
    showAttachment();

    // Try to extract text for supported types
    var extractable = /\.(pdf|docx?|txt|md|csv)$/i.test(file.name);
    if (extractable) {
      el('attach-status').textContent = 'Extracting text...';
      tool.requestFileContent(file.url, function(e2, content) {
        if (content) {
          attachedFile.extractedText = content;
          el('attach-status').textContent = '✓ Text extracted (' + content.length.toLocaleString() + ' chars)';
        } else {
          el('attach-status').textContent = e2 ? '⚠ ' + e2 : '✓ Ready (no text extraction)';
        }
      });
    } else {
      // Image or other — note URL will be shared with AI as reference
      el('attach-status').textContent = '✓ Attached (URL will be shared with AI)';
    }
    showToast('File attached: ' + file.name, 'success');
  });
}

function showAttachment() {
  if (!attachedFile) { el('chat-attachment').style.display = 'none'; return; }
  el('chat-attachment').style.display = 'flex';
  el('attach-name').textContent = attachedFile.name;
  el('attach-size').textContent = formatFileSize(attachedFile.size);
}

function clearAttachment() {
  attachedFile = null;
  el('chat-attachment').style.display = 'none';
  el('attach-status').textContent = '';
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

/* ── Chat ── */
function sendChatMessage() {
  var input = el('chat-input'); if (!input) return;
  var msg = input.value.trim();
  if (!msg && !attachedFile) return;
  if (!msg) msg = 'Please analyze the attached file and suggest a tool design based on it.';

  // Build user message text including attachment info for chat display
  var displayMsg = msg;
  if (attachedFile) {
    displayMsg = '📎 **' + attachedFile.name + '** (' + formatFileSize(attachedFile.size) + ')\n' + msg;
  }
  addChatMessage('user', displayMsg);
  input.value = ''; input.style.height = 'auto';

  var hasCode = !!(DB.generated.html || DB.generated.css || DB.generated.js);
  var prompt = buildChatPrompt(msg);

  // Use streaming if available, fall back to batch
  if (typeof tool.requestAIStream === 'function') {
    showThinkingBubble('AI is generating', true);
    var fullResponse = '';

    tool.requestAIStream(prompt, '', {
      onToken: function(token) {
        fullResponse += token;
        if (_streamCallback) _streamCallback(token);
      },
      onComplete: function() {
        hideThinkingBubble();
        processAIResponse(fullResponse, hasCode);
        clearAttachment();
        tool.resize();
      },
      onError: function(err) {
        hideThinkingBubble();
        addChatMessage('ai', '⚠️ Stream error: ' + err);
        clearAttachment();
        tool.resize();
      }
    });
  } else {
    // Fallback: batch requestAI — no streaming available
    showThinkingBubble('AI is generating', false);
    tool.requestAI(prompt, '', function(err, response) {
      hideThinkingBubble();
      if (response) {
        processAIResponse(response, hasCode);
      } else if (err) {
        addChatMessage('ai', '⚠️ Error: ' + err);
      } else {
        addChatMessage('ai', '⚠️ No response. Make sure allowAi is enabled.');
      }
      clearAttachment();
      tool.resize();
    });
  }
}

/* ── Process AI Response (shared by stream & batch) ── */
function processAIResponse(response, hasCode) {
  var generated = parseGeneratedCode(response);
  if (generated.html || generated.css || generated.js) {
    if (generated.html) DB.generated.html = generated.html;
    if (generated.css) DB.generated.css = generated.css;
    if (generated.js) DB.generated.js = generated.js;
    displayAllCode(DB.generated);

    if (!hasCode) addToHistory(DB.generated);

    var summary = extractSummary(response);
    addChatMessage('ai', summary + '\n\n✅ *Code updated — running auto-review...*');
    persist();

    if (!hasCode) switchTab('preview');
    runAutoReview();
  } else {
    addChatMessage('ai', response);
  }
}

/* ── Agentic Auto-Review ── */
function runAutoReview() {
  var reviewPrompt = [
    'You just generated an HTML tool for UniconHub CMS. Review YOUR OWN output for compliance with these rules:',
    '',
    '1. HTML block: Contains NO <html>, <head>, <style>, <script>, <body>, or <!DOCTYPE> tags. Body markup only.',
    '2. CSS block: Contains NO <style> tag. Pure CSS rules only.',
    '3. JS block: Contains NO <script> tag. Pure JavaScript only.',
    '4. JS uses tool.onReady(cb) as entry point. No DOMContentLoaded or window.onload.',
    '5. JS uses ONLY ES5: var (not let/const), no spread (...), no template literals (`), no arrow functions (=>), no destructuring, no for...of, no class/Promise/async.',
    '6. JS handles tool.isReadOnly(), tool.resize(), tool.setValue()/getValue().',
    '7. No localStorage, sessionStorage, fetch, alert, confirm, prompt, or raw postMessage in JS.',
    '8. All three blocks are present and complete. No placeholders or TODO comments.',
    '9. HTML event handlers (onclick, onchange) reference functions DEFINED in JS. No dangling calls.',
    '10. HTML is semantic and complete. CSS uses variables and is responsive. JS has error handling.',
    '',
    '=== CURRENT CODE (review this) ===',
    '[HTML]',
    DB.generated.html || '(empty)',
    '',
    '[CSS]',
    DB.generated.css || '(empty)',
    '',
    '[JS]',
    DB.generated.js || '(empty)',
    '',
    'If you find ANY issues, output the CORRECTED three blocks. If everything is already perfect,',
    'respond with "✅ REVIEW PASSED — no issues found." and do NOT output code blocks.',
    'Be strict about the rules. Fix even minor issues. Output format if fixing: [HTML]...[CSS]...[JS]'
  ].join('\n');

  showThinkingBubble('AI is reviewing code', false);

  tool.requestAI(reviewPrompt, '', function(err, response) {
    hideThinkingBubble();
    if (response) {
      var fixed = parseGeneratedCode(response);
      if (fixed.html || fixed.css || fixed.js) {
        // Review found issues — apply fixes
        if (fixed.html) DB.generated.html = fixed.html;
        if (fixed.css) DB.generated.css = fixed.css;
        if (fixed.js) DB.generated.js = fixed.js;
        displayAllCode(DB.generated);
        addChatMessage('ai', '🔍 **Auto-review:** Found and fixed issues for rule compliance. Code updated.');
        persist();
      } else if (response.indexOf('REVIEW PASSED') !== -1 || response.indexOf('no issues') !== -1) {
        addChatMessage('ai', '🔍 **Auto-review:** ✅ All rule checks passed. Code is ready.');
      } else {
        addChatMessage('ai', '🔍 **Auto-review:** ' + response.substring(0, 300));
      }
    } else {
      // Review failed silently — code from first pass is still in place
      addChatMessage('ai', '🔍 **Auto-review:** Skipped (AI unavailable). Code from first pass is in place.');
    }
    tool.resize();
  });
}

function extractSummary(text) {
  var cleaned = text.replace(/\[HTML\][\s\S]*?(\[CSS\]|\[JS\]|$)/gi, '').replace(/\[CSS\][\s\S]*?(\[JS\]|$)/gi, '').replace(/\[JS\][\s\S]*$/gi, '').replace(/```[\s\S]*?```/g, '').trim();
  if (cleaned.length > 400) cleaned = cleaned.substring(0, 400) + '...';
  return cleaned || 'Here are the updated files:';
}

function addChatMessage(role, text) {
  if (!Array.isArray(DB.chatMessages)) DB.chatMessages = [];
  DB.chatMessages.push({ role: role, text: text, time: new Date().toISOString() });
  if (DB.chatMessages.length > 100) DB.chatMessages = DB.chatMessages.slice(-100);
  renderChatMessages();
  updateChatBadge();
}

var _thinkingTimer = null;
var _thinkingMsgEl = null;
var _thinkingStartTime = 0;

function showThinkingBubble(label, hasStreaming) {
  hideThinkingBubble();
  var container = el('chat-messages'); if (!container) return;
  _thinkingStartTime = Date.now();

  var bubble = document.createElement('div');
  bubble.className = 'chat-thinking';
  bubble.id = 'thinking-bubble';

  var bodyContent = hasStreaming
    ? '<div class="think-stream-label">Thinking…</div><div class="think-stream" id="think-stream"></div>'
    : '<div class="think-stream-label">Waiting for AI response…</div><div class="think-stream" id="think-stream" style="display:none"></div>';

  bubble.innerHTML =
    '<div class="think-header" id="think-hdr" style="cursor:pointer">' +
      '<div class="chat-thinking-dots"><span></span><span></span><span></span></div>' +
      '<span class="chat-thinking-text" id="think-label">' + esc(label || 'AI is thinking') + '</span>' +
      '<span class="think-time" id="think-time">0:00</span>' +
      '<span class="think-toggle" id="think-toggle">▶</span>' +
    '</div>' +
    '<div class="think-body" id="think-body" style="display:none">' +
      bodyContent +
    '</div>';

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  _thinkingMsgEl = bubble;

  // Click header to toggle expand/collapse
  var hdr = bubble.querySelector('#think-hdr');
  var bodyEl = bubble.querySelector('#think-body');
  var toggleEl = bubble.querySelector('#think-toggle');
  var streamEl = bubble.querySelector('#think-stream');
  var labelEl = bubble.querySelector('#think-stream-label');

  hdr.onclick = function() {
    if (!bodyEl || !toggleEl) return;
    var isOpen = bodyEl.style.display !== 'none';
    bodyEl.style.display = isOpen ? 'none' : 'block';
    toggleEl.textContent = isOpen ? '▶' : '▼';
    container.scrollTop = container.scrollHeight;
  };

  // Auto-expand on first token (only when hasStreaming)
  if (hasStreaming) {
    var firstToken = true;
    _streamCallback = function(token) {
      if (firstToken) {
        if (bodyEl) bodyEl.style.display = 'block';
        if (toggleEl) toggleEl.textContent = '▼';
        if (labelEl) labelEl.style.display = 'none';
        firstToken = false;
      }
      appendStreamToken(token);
    };
  } else {
    _streamCallback = null;
  }

  // Animate dots + elapsed timer
  var dots = 0;
  _thinkingTimer = setInterval(function() {
    dots = (dots + 1) % 4;
    var lbl = bubble.querySelector('#think-label');
    if (lbl) lbl.textContent = (label || 'AI is thinking') + Array(dots + 1).join('.');
    var elapsed = Math.floor((Date.now() - _thinkingStartTime) / 1000);
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    var timeEl = bubble.querySelector('#think-time');
    if (timeEl) timeEl.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
  }, 500);
}

var _streamCallback = null;
var _consoleEntries = [];

/* ── Console capture from preview iframe ── */
function initConsoleCapture() {
  window.addEventListener('message', function(e) {
    if (e.data && e.data.vibeConsole) {
      var entry = e.data.vibeConsole;
      _consoleEntries.push(entry);
      if (_consoleEntries.length > 500) _consoleEntries.shift();
      if (currentTab === 'console') renderConsole();
      updateConsoleBadge();
    }
  });
}

function renderConsole() {
  var out = el('console-output');
  if (!out) return;
  if (!_consoleEntries.length) {
    out.innerHTML = '<div class="console-empty">🪲 Console output from preview will appear here.<br>Click buttons in the Preview tab and watch for logs.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < _consoleEntries.length; i++) {
    var e = _consoleEntries[i];
    var cls = e.level === 'error' ? 'console-err' : e.level === 'warn' ? 'console-warn' : 'console-log';
    var time = '';
    try { time = new Date(e.time).toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit',second:'2-digit'}); } catch(ex) {}
    html += '<div class="console-line ' + cls + '"><span class="console-time">' + time + '</span> ' + esc(e.msg) + '</div>';
  }
  out.innerHTML = html;
  out.scrollTop = out.scrollHeight;
  el('console-count').textContent = _consoleEntries.length + ' entries';
}

function updateConsoleBadge() {
  // Update tab badge if needed
}

function clearConsole() {
  _consoleEntries = [];
  renderConsole();
}

function appendStreamToken(token) {
  if (!_thinkingMsgEl) return;
  var stream = _thinkingMsgEl.querySelector('#think-stream');
  if (stream) {
    // Hide "Thinking…" label on first content
    var label = _thinkingMsgEl.querySelector('#think-stream-label');
    if (label && stream.textContent === '') label.style.display = 'none';
    stream.textContent += token;
    _thinkingMsgEl.scrollTop = _thinkingMsgEl.scrollHeight;
    var container = el('chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
  }
}

function hideThinkingBubble() {
  if (_thinkingTimer) { clearInterval(_thinkingTimer); _thinkingTimer = null; }
  if (_thinkingMsgEl) {
    _thinkingMsgEl.style.opacity = '0';
    _thinkingMsgEl.style.transform = 'translateY(-8px)';
    _thinkingMsgEl.style.transition = 'opacity 0.2s, transform 0.2s';
    var el = _thinkingMsgEl;
    setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
    _thinkingMsgEl = null;
  }
}

function renderChatMessages() {
  var container = el('chat-messages'); if (!container) return;
  if (!DB.chatMessages || !DB.chatMessages.length) {
    container.innerHTML = '<div class="chat-welcome"><div class="chat-welcome-icon">👋</div><h3>Welcome to VibeCoding</h3><p>Configure your tool using the <b>⚙️ Config</b> button above, then ask me to generate it.</p><p class="chat-examples"><span>Quick start:</span><code>"Build an invoice manager with dashboard"</code><code>"Create a task tracker with kanban board"</code><code>"Make an employee onboarding form"</code></p></div>';
    return;
  }
  var html = '';
  for (var i = 0; i < DB.chatMessages.length; i++) {
    var m = DB.chatMessages[i];
    var timeStr = ''; try { timeStr = new Date(m.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); } catch(e) {}
    var cls = m.role === 'user' ? 'chat-msg-user' : 'chat-msg-ai';
    var label = m.role === 'user' ? 'YOU' : 'AI';
    var text = esc(m.text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[HTML\]/gi, '<b>[HTML]</b>').replace(/\[CSS\]/gi, '<b>[CSS]</b>').replace(/\[JS\]/gi, '<b>[JS]</b>').replace(/\n/g, '<br>');
    html += '<div class="chat-msg ' + cls + '"><div class="chat-msg-label">' + label + '</div><div>' + text + '</div><div class="chat-msg-time">' + timeStr + '</div></div>';
  }
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

function updateChatBadge() {
  var badge = el('chat-msg-count'); if (badge) badge.textContent = (DB.chatMessages || []).length;
}

/* ── Full Generation (from Config tab button) ── */
function runFullGeneration() {
  collectFormData(); persist();
  var prompt = buildFullPrompt();
  var hasChat = DB.chatMessages && DB.chatMessages.length > 0;

  if (typeof tool.requestAIStream === 'function') {
    var fullResponse = '';
    showThinkingBubble('AI is generating full tool', true);

    tool.requestAIStream(prompt, '', {
      onToken: function(token) {
        fullResponse += token;
        if (_streamCallback) _streamCallback(token);
      },
      onComplete: function() {
        hideThinkingBubble();
        finishFullGeneration(fullResponse, hasChat);
      },
      onError: function(err) {
        hideThinkingBubble();
        showToast('Generation failed: ' + err, 'error');
      }
    });
  } else {
    showThinkingBubble('AI is generating full tool', false);
    tool.requestAI(prompt, '', function(err, response) {
      hideThinkingBubble();
      if (response) {
        finishFullGeneration(response, hasChat);
      } else if (err) { showToast('Generation failed: ' + err, 'error'); }
      else { showToast('No AI response. Check allowAi.', 'error'); }
    });
  }
}

function finishFullGeneration(response, hasChat) {
  var generated = parseGeneratedCode(response);
  DB.generated = generated; displayAllCode(generated); addToHistory(generated);
  if (!hasChat) {
    addChatMessage('ai', '✅ **' + (DB.toolName || 'Your tool') + '** generated! I\'ve created HTML, CSS, and JS following html-tool-rules. Type below to refine it — "add dark mode", "make the table sortable", etc.');
  }
  persist();
  showToast('Tool generated! Preview it on the right.', 'success');
  switchTab('preview');
  runAutoReview();
}

/* ── History ── */
function addToHistory(generated) {
  var entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), toolName: DB.toolName || 'Untitled', toolDesc: DB.toolDesc || '', date: new Date().toISOString(), generated: { html: generated.html || '', css: generated.css || '', js: generated.js || '' }, config: { storage: DB.storage, features: DB.features.slice(), layout: DB.layout, colorScheme: DB.colorScheme } };
  DB.history.unshift(entry); if (DB.history.length > 20) DB.history = DB.history.slice(0, 20);
}

function renderHistory() {
  var list = el('history-list'); if (!list) return;
  if (!DB.history || !DB.history.length) { list.innerHTML = '<div class="empty-state">No generations yet.</div>'; return; }
  list.innerHTML = DB.history.map(function(h, i) {
    var d = new Date(h.date); var ds = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return '<div class="history-item"><div class="history-item-header"><span class="history-item-name">' + esc(h.toolName) + '</span><span class="history-item-date">' + ds + '</span></div><div class="history-item-desc">' + esc(h.toolDesc || '') + '</div><div class="history-item-actions"><button class="btn btn-sm btn-outline hist-load" data-idx="' + i + '">📂 Load</button><button class="btn btn-sm btn-ghost hist-delete" data-idx="' + i + '">🗑️</button></div></div>';
  }).join('');
  qsa('.hist-load').forEach(function(b) { b.onclick = function() { var e = DB.history[parseInt(this.dataset.idx)]; if (e) { DB.generated = e.generated; displayAllCode(e.generated); closeAllModals(); switchTab('html'); showToast('Loaded: ' + e.toolName, 'info'); persist(); } }; });
  qsa('.hist-delete').forEach(function(b) { b.onclick = function(ev) { ev.stopPropagation(); DB.history.splice(parseInt(this.dataset.idx), 1); renderHistory(); persist(); }; });
}

/* ── Modals ── */
function openModal(id) { el('modal-backdrop').hidden = false; qsa('.modal').forEach(function(m) { m.style.display = 'none'; }); var m = el(id); if (m) m.style.display = 'flex'; if (id === 'modal-history') renderHistory(); if (id === 'modal-rules') { var rb = el('rules-body'); if (rb) rb.innerHTML = '<pre style="white-space:pre-wrap;font-size:10px;line-height:1.6;color:var(--text2)">' + esc(htmlRulesText) + '</pre>'; } }
function closeAllModals() { el('modal-backdrop').hidden = true; qsa('.modal').forEach(function(m) { m.style.display = 'none'; }); }

/* ── Render ── */
function render(val) {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    DB = Object.assign({ toolName: '', toolDesc: '', requirements: '', audience: 'admin', storage: 'value', cmsTypes: '', cmsFields: '', siblingFields: 'no', features: ['ai'], featureNotes: '', layout: 'single-page', colorScheme: 'blue', themeSupport: 'light-only', styleNotes: '', generated: { html: '', css: '', js: '' }, history: [], chatMessages: [], _theme: 'light' }, val);
    if (!DB.generated || typeof DB.generated !== 'object') DB.generated = { html: '', css: '', js: '' };
    if (!Array.isArray(DB.history)) DB.history = [];
    if (!Array.isArray(DB.features)) DB.features = ['ai'];
    if (!Array.isArray(DB.chatMessages)) DB.chatMessages = [];
  }
  if (DB._theme) applyTheme(DB._theme);
  restoreFormData();
  displayAllCode(DB.generated);
  renderChatMessages();
}

function syncFields() {}

/* ── Events ── */
function bindEvents() {
  el('btn-config').onclick = function() { switchTab('config'); };
  el('btn-generate-all').onclick = runFullGeneration;
  el('btn-theme').onclick = toggleTheme;
  el('btn-history').onclick = function() { openModal('modal-history'); };
  el('btn-rules').onclick = function() { openModal('modal-rules'); };
  el('btn-close-history').onclick = closeAllModals;
  el('btn-close-rules').onclick = closeAllModals;
  el('modal-backdrop').onclick = closeAllModals;

  qsa('.ctab').forEach(function(t) { t.onclick = function() { switchTab(this.dataset.tab); }; });
  el('btn-copy-html').onclick = function() { copyCurrentTab(); };
  el('btn-copy-css').onclick = function() { copyCurrentTab(); };
  el('btn-copy-js').onclick = function() { copyCurrentTab(); };
  el('btn-copy-all').onclick = copyAllBlocks;
  el('btn-download').onclick = downloadFiles;

  // Console
  var btnConsoleClear = el('btn-console-clear'); if (btnConsoleClear) btnConsoleClear.onclick = clearConsole;

  // Upload button
  var btnUpload = el('btn-upload'); if (btnUpload) btnUpload.onclick = handleFileUpload;
  el('attach-remove').onclick = clearAttachment;

  // Chat
  var btnSend = el('btn-chat-send'); if (btnSend) btnSend.onclick = sendChatMessage;
  var chatInput = el('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } });
    chatInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 120) + 'px'; });
  }
  qsa('.chat-examples code').forEach(function(c) { c.onclick = function() { var inp = el('chat-input'); if (inp) { inp.value = this.textContent.replace(/^"|"$/g, ''); inp.focus(); inp.dispatchEvent(new Event('input')); } }; });

  // Storage radio change
  qsa('input[name="storage"]').forEach(function(r) { r.onchange = function() { var cs = el('crud-section'); if (cs) cs.style.display = (this.value === 'crud' || this.value === 'both') ? '' : 'none'; collectFormData(); persist(); }; });

  // Auto-save form changes
  qsa('.form-input, input[type="radio"], input[type="checkbox"]').forEach(function(inp) { inp.addEventListener('change', function() { collectFormData(); persist(); }); if (inp.tagName === 'INPUT' && inp.type === 'text') inp.addEventListener('blur', function() { collectFormData(); persist(); }); });
  qsa('textarea.form-input').forEach(function(ta) { ta.addEventListener('blur', function() { collectFormData(); persist(); }); });

  // Keyboard
  document.addEventListener('keydown', function(e) { if (e.ctrlKey && e.key === 's') { e.preventDefault(); collectFormData(); persist(); showToast('Saved.', 'info'); } });

  // Code textarea change → live preview update
  qsa('.code-textarea').forEach(function(ta) { ta.addEventListener('input', function() { if (currentTab === 'preview') updatePreview(); }); });
}

/* ── Entry Point ── */
tool.onReady(function(val, fields) {
  // Load full html-tool-rules from embedded DOM element (verbatim, 773 lines)
  var rulesSource = el('html-rules-source');
  if (rulesSource) htmlRulesText = rulesSource.textContent || '';

  tool.declareOutput({ type: 'object', description: 'VibeCoding HTML App Builder — project config and generated code', properties: { toolName: { type: 'string' }, generated: { type: 'object', properties: { html: { type: 'string' }, css: { type: 'string' }, js: { type: 'string' } } }, chatMessages: { type: 'array' }, history: { type: 'array' } } });
  tool.declareParams([
    { name: 'allowAi', label: 'Enable AI Prompt Relay', type: 'toggle', default: 'yes', severity: 'mandatory', hint: 'Required for AI code generation.' },
    { name: 'allowUpload', label: 'Enable File Upload', type: 'toggle', default: 'yes', severity: 'goodToHave', hint: 'Lets users upload design files, mockups, or spec docs to share with the AI.' },
    { name: 'allowFileContent', label: 'Enable File Content Extraction', type: 'toggle', default: 'yes', severity: 'goodToHave', hint: 'Extracts text from uploaded PDFs, DOCX, etc. to include in AI prompts.' }
  ]);

  // Check if allowAi is configured — warn admin if not
  var aiParam = tool.param('allowAi');
  if (!aiParam || aiParam !== 'yes') {
    tool.reportMissingParams([{
      name: 'allowAi', label: 'Enable AI Prompt Relay',
      type: 'toggle', default: 'yes', severity: 'mandatory',
      hint: 'Set to "yes" to enable AI code generation via tool.requestAI().',
      reason: 'This tool requires AI access to generate HTML/CSS/JS code. Without it, the chat and generate buttons will not work.'
    }], 'AI Prompt Relay must be enabled for this tool to function. Set allowAi: yes in the field settings.');
  }

  render(val);
  bindEvents();
  initConsoleCapture();
  if (tool.isReadOnly()) lockUI(true);
  updateDeveloperUI();

  // Initial UI: show config if no code generated yet
  var hasCode = !!(DB.generated.html || DB.generated.css || DB.generated.js);
  if (!hasCode) switchTab('config');
  else if (isDeveloper()) switchTab('html');
  else switchTab('preview');

  qsa('#btn-copy-html, #btn-copy-css, #btn-copy-js').forEach(function(b) { b.style.display = 'none'; });
  if (isDeveloper()) { var bHtml = el('btn-copy-html'); if (bHtml) bHtml.style.display = ''; }

  tool.resize();
});

tool.onValueChange(function(v) { render(v); });
tool.onFieldsChange(function(f) { syncFields(); });
tool.onReadonlyChange(function(ro) { lockUI(ro); });
tool.onUserChange(function(user) { updateDeveloperUI(); });
