/* ── Legal Document Builder ──
   Chat-driven drafting of legally formatted documents (Word-style, A4).
   Stores ONE document as a blocks array in the CMS field value.
   AI outputs either a full blocks array or block-level edit operations.
   Built for UniconHub CMS html-tool system.
────────────────────────────────────────── */

/* ── Helpers ── */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function el(id) { return document.getElementById(id); }
function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function shortTime(t) {
  if (!t) return '';
  try {
    var d = new Date(t);
    return d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  } catch (e) { return ''; }
}
/** Turkish-safe slug for file names */
function slugify(str) {
  var s = String(str || 'document');
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''); // strip combining marks FIRST
  s = s.replace(/İ/g, 'I').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
       .replace(/ü/g, 'u').replace(/Ü/g, 'U').replace(/ş/g, 's').replace(/Ş/g, 'S')
       .replace(/ö/g, 'o').replace(/Ö/g, 'O').replace(/ç/g, 'c').replace(/Ç/g, 'C');
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'document';
}
/** Document name comes from the parent CMS record — look for name/title fields. */
function resolveTitle() {
  try {
    var f = tool.getFields();
    if (f && typeof f === 'object') {
      for (var k in f) {
        if (!Object.prototype.hasOwnProperty.call(f, k)) continue;
        var kl = String(k).toLowerCase();
        if ((kl === 'name' || kl === 'title' || kl === 'documentname' || kl === 'documentname_s') && f[k] && String(f[k]).trim()) {
          return String(f[k]).trim();
        }
      }
    }
  } catch (e) { /* getFields unavailable — use fallback */ }
  return 'Legal Document';
}
function markdownLite(t) {
  var h = esc(String(t === undefined || t === null ? '' : t));
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  h = h.replace(/`([^`]+)`/g, '<code style="background:#e2e8f0;border-radius:4px;padding:0 4px;font-size:12px">$1</code>');
  return h;
}
function stripTags(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/* ── Constants ── */
var SESSION_TYPE = 'ai-chat-sessions-uniconbaseapps';
var FONTS = ['Times New Roman', 'Georgia', 'Garamond', 'Cambria', 'Arial', 'Calibri', 'Courier New'];
var SIZES = ['10pt', '11pt', '12pt', '13pt', '14pt', '16pt', '18pt'];
var LINEHEIGHTS = ['1.15', '1.5', '1.6', '1.8', '2.0'];

var DEFAULT_SETTINGS = {
  fontFamily: 'Times New Roman',
  fontSize: '12pt',
  color: '#111111',
  lineHeight: '1.6',
  pageSize: 'A4',          // A4 | Letter
  showPageNumbers: true,
  watermark: ''            // '' | DRAFT | CONFIDENTIAL | FOR REVIEW
};

/* ── State ── */
var DB = {
  version: '1.0.0',
  blocks: [],
  variables: {},           // {name: {label, value}} — dynamic document variables
  settings: null,          // initialized from params on ready
  activeSessionId: '',
  chatCache: null,         // {sessionId, messages} bounded fallback
  _instanceId: '',         // deterministic id for chat-session isolation
  comments: {},            // blockIdx -> [{id, text, user, time, resolved}]
  snippets: [],            // [{id, name, type, data, time}] — My Clauses library
  status: 'draft',         // draft | in-review | approved
  statusLog: [],           // [{from, to, time, user}]
  history: []              // [{version, blocks, time}] recent snapshots for compare/restore
};
var _chatMessages = [];
var _sessions = [];
var _sessionsLoaded = false;
var _aiCallActive = false;
var _reqToken = null;
var _aiTimeoutId = null;
var _thinkingStartTime = 0;
var _lastTokenAt = 0;
var _thinkingTimer = null;
var _thinkingMsgEl = null;
var _streamCallback = null;
var _selTarget = null;     // {idx, type, text}
var _previewBuildSeq = 0;
var _sessionWarnShown = false;
var _dirty = false;        // staged changes since last parent CMS save
var _undoStack = [];       // [{blocks, variables, version}]
var _redoStack = [];
var _docType = '';         // detected document type

/* ═══════════════════════════════════════════
   DYNAMIC DOCUMENT VARIABLES ({{name}} placeholders)
   ═══════════════════════════════════════════ */
function prettifyVarName(name) {
  var s = String(name || 'var').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  var words = s.split(/\s+/).filter(Boolean);
  for (var i = 0; i < words.length; i++) {
    words[i] = words[i].charAt(0).toUpperCase() + words[i].slice(1);
  }
  return words.join(' ') || 'Variable';
}

/** Replace {{name}} placeholders in rendered block HTML with value spans. */
function renderVars(html) {
  return String(html || '').replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, function (m, name) {
    var v = DB.variables[name];
    var val2 = v ? String(v.value || '') : '';
    var label = v ? (v.label || prettifyVarName(name)) : prettifyVarName(name);
    return '<span class="lb-var" data-var="' + esc(name) + '" title="Variable: ' + esc(label) + ' — click to edit">' +
      (val2 ? esc(val2) : '<span class="lb-var-empty">«' + esc(label) + '»</span>') + '</span>';
  });
}

/** Collect all {{name}} references from blocks and sync the variable registry. */
function scanBlocksForVars() {
  var found = {};
  try {
    var json = JSON.stringify(DB.blocks);
    var re = /\{\{([a-zA-Z0-9_]+)\}\}/g;
    var m;
    while ((m = re.exec(json)) !== null) found[m[1]] = true;
  } catch (e) {}
  var added = false;
  for (var name in found) {
    if (Object.prototype.hasOwnProperty.call(found, name) && !DB.variables[name]) {
      DB.variables[name] = { label: prettifyVarName(name), value: '' };
      added = true;
    }
  }
  // drop registry entries no longer referenced anywhere
  for (var k in DB.variables) {
    if (Object.prototype.hasOwnProperty.call(DB.variables, k) && !found[k]) {
      delete DB.variables[k];
    }
  }
  return added;
}

function varUsageCount(name) {
  var count = 0;
  try {
    var json = JSON.stringify(DB.blocks);
    var re = new RegExp('\\{\\{' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\}\\}', 'g');
    var m;
    while ((m = re.exec(json)) !== null) count++;
  } catch (e) {}
  return count;
}

function setVariableValue(name, value) {
  if (!DB.variables[name]) DB.variables[name] = { label: prettifyVarName(name), value: '' };
  if (String(DB.variables[name].value) === String(value)) return;
  DB.variables[name].value = String(value === undefined || value === null ? '' : value);
  _snapshotPush();
  _bumpVersion('patch');
  persist();
  mountPreview();
  renderVariables();
  updateVarBadge();
  showToast('🔤 "' + (DB.variables[name].label || name) + '" updated everywhere in the document.', 'success');
}

function setVariableLabel(name, label) {
  if (!DB.variables[name]) return;
  DB.variables[name].label = String(label || prettifyVarName(name));
  persist();
  mountPreview();
}

function addVariable() {
  var i = 1;
  var name = 'variable' + i;
  while (DB.variables[name]) { i++; name = 'variable' + i; }
  DB.variables[name] = { label: 'New Variable', value: '' };
  _snapshotPush();
  persist();
  renderVariables();
  updateVarBadge();
  return name;
}

function removeVariable(name) {
  var btn = el('btn-var-remove-' + name);
  var doRemove = function () {
    delete DB.variables[name];
    _snapshotPush();
    _bumpVersion('patch');
    persist();
    mountPreview();
    renderVariables();
    updateVarBadge();
    showToast('Variable removed.', 'info');
  };
  if (btn) { confirmClick(btn, doRemove, 'Remove?'); return; }
  doRemove();
}

function updateVarBadge() {
  var btn = el('btn-open-variables');
  if (!btn) return;
  var total = 0, empty = 0;
  for (var k in DB.variables) {
    if (!Object.prototype.hasOwnProperty.call(DB.variables, k)) continue;
    total++;
    if (!String(DB.variables[k].value || '').trim()) empty++;
  }
  btn.textContent = '🔤 Variables' + (total ? ' (' + total + (empty ? ', ' + empty + ' empty' : '') + ')' : '');
  btn.style.background = empty > 0 ? '#fffbeb' : '';
  btn.style.borderColor = empty > 0 ? '#fcd34d' : '';
  btn.style.color = empty > 0 ? '#92400e' : '';
}

/* ═══════════════════════════════════════════
   UNDO / REDO + BLOCK OPERATIONS
   ═══════════════════════════════════════════ */
function _snapshotPush() {
  try {
    _undoStack.push({ blocks: JSON.parse(JSON.stringify(DB.blocks)), variables: JSON.parse(JSON.stringify(DB.variables)), version: DB.version });
    if (_undoStack.length > 40) _undoStack.shift();
  } catch (e) {}
  _redoStack = [];
  updateUndoButtons();
}

function _restoreSnapshot(snap) {
  if (!snap) return;
  DB.blocks = JSON.parse(JSON.stringify(snap.blocks));
  DB.variables = JSON.parse(JSON.stringify(snap.variables || {}));
  DB.version = snap.version || DB.version;
  _renderVersion();
  persist();
  mountPreview();
  updateDocStats();
  updateVarBadge();
  updateStagedChip();
}

function undo() {
  var snap = _undoStack.pop();
  if (!snap) { showToast('Nothing to undo.', 'info'); return; }
  _redoStack.push({ blocks: JSON.parse(JSON.stringify(DB.blocks)), variables: JSON.parse(JSON.stringify(DB.variables)), version: DB.version });
  _restoreSnapshot(snap);
  updateUndoButtons();
  showToast('↶ Undone.', 'info');
}

function redo() {
  var snap = _redoStack.pop();
  if (!snap) { showToast('Nothing to redo.', 'info'); return; }
  _undoStack.push({ blocks: JSON.parse(JSON.stringify(DB.blocks)), variables: JSON.parse(JSON.stringify(DB.variables)), version: DB.version });
  _restoreSnapshot(snap);
  updateUndoButtons();
  showToast('↷ Redone.', 'info');
}

function updateUndoButtons() {
  var u = el('btn-undo');
  var r = el('btn-redo');
  if (u) u.style.opacity = _undoStack.length ? '1' : '0.4';
  if (r) r.style.opacity = _redoStack.length ? '1' : '0.4';
}

function moveBlock(from, to) {
  if (from === to) return;
  if (from < 0 || from >= DB.blocks.length || to < 0 || to >= DB.blocks.length) return;
  _snapshotPush();
  var b = DB.blocks.splice(from, 1)[0];
  DB.blocks.splice(to, 0, b);
  _bumpVersion('patch');
  persist();
  mountPreview();
  updateDocStats();
  renderOutline();
}

function duplicateBlock(idx) {
  if (idx < 0 || idx >= DB.blocks.length) return;
  _snapshotPush();
  var copy = JSON.parse(JSON.stringify(DB.blocks[idx]));
  DB.blocks.splice(idx + 1, 0, copy);
  _bumpVersion('patch');
  persist();
  mountPreview();
  updateDocStats();
  renderOutline();
  showToast('Block duplicated.', 'info');
}

function deleteBlockAt(idx) {
  if (idx < 0 || idx >= DB.blocks.length) return;
  _snapshotPush();
  DB.blocks.splice(idx, 1);
  _bumpVersion('patch');
  persist();
  mountPreview();
  updateDocStats();
  renderOutline();
  showToast('Block deleted.', 'info');
}

/** Renumber sections (1..n), subsections (x.y) and clauses within sections. */
function renumberBlocks() {
  _snapshotPush();
  var sec = 0, sub = 0;
  var parentSec = '';
  for (var i = 0; i < DB.blocks.length; i++) {
    var b = DB.blocks[i];
    b.data = b.data || {};
    if (b.type === 'section') {
      sec++;
      sub = 0;
      parentSec = String(sec);
      b.data.number = String(sec);
    } else if (b.type === 'subsection') {
      sub++;
      b.data.number = parentSec + '.' + sub;
    } else if (b.type === 'clause' && parentSec) {
      // only renumber clauses that already have a number
      if (b.data.number !== undefined && b.data.number !== null && String(b.data.number).trim() !== '') {
        b.data.number = parentSec + '.' + (String(b.data.number).split('.').pop() || '1');
      }
    }
  }
  _bumpVersion('patch');
  persist();
  mountPreview();
  updateDocStats();
  renderOutline();
  showToast('🔢 Sections, subsections and clauses renumbered.', 'success');
}

/* ═══════════════════════════════════════════
   DOCUMENT-TYPE DETECTION
   ═══════════════════════════════════════════ */
var DOC_TYPES = [
  { id: 'nda', icon: '🔒', label: 'Non-Disclosure Agreement', keys: ['non-disclosure', 'confidentiality', 'nda', 'gizlilik'] },
  { id: 'employment', icon: '💼', label: 'Employment Contract', keys: ['employment', 'employe', 'iş akdi', 'istihdam', 'çalışan'] },
  { id: 'lease', icon: '🏠', label: 'Lease Agreement', keys: ['lease', 'tenant', 'landlord', 'kira'] },
  { id: 'service', icon: '🤝', label: 'Service Agreement', keys: ['service agreement', 'services', 'hizmet', 'msa', 'consulting'] },
  { id: 'poa', icon: '🖋', label: 'Power of Attorney', keys: ['power of attorney', 'vekalet'] },
  { id: 'terms', icon: '🌐', label: 'Terms & Conditions', keys: ['terms and conditions', 'terms of use', 'kullanım koşulları'] },
  { id: 'settlement', icon: '⚖️', label: 'Settlement Agreement', keys: ['settlement', 'sulh', 'uzlaşma'] },
  { id: 'purchase', icon: '🛒', label: 'Purchase / Sale Agreement', keys: ['purchase', 'sale agreement', 'satış', 'buyer', 'seller'] }
];

function _detectDocType() {
  var text = (resolveTitle() + ' ' + JSON.stringify(DB.blocks)).toLowerCase();
  var best = null, bestScore = 0;
  for (var i = 0; i < DOC_TYPES.length; i++) {
    var score = 0;
    for (var j = 0; j < DOC_TYPES[i].keys.length; j++) {
      if (text.indexOf(DOC_TYPES[i].keys[j]) !== -1) score++;
    }
    if (score > bestScore) { bestScore = score; best = DOC_TYPES[i]; }
  }
  _docType = (best && bestScore > 0) ? best.id : '';
  var chip = el('doc-type-chip');
  if (chip) {
    if (best && bestScore > 0) {
      chip.style.display = '';
      chip.textContent = best.icon + ' ' + best.label;
      chip.title = 'Detected document type — the AI tailors suggestions to it.';
    } else {
      chip.style.display = 'none';
    }
  }
  return _docType;
}

/* ═══════════════════════════════════════════
   SCANS: placeholders, lint, readability, size
   ═══════════════════════════════════════════ */
function runPlaceholderScan() {
  var issues = [];
  for (var i = 0; i < DB.blocks.length; i++) {
    var b = DB.blocks[i];
    try {
      var text = (b.type === 'html') ? ((b.data && b.data.html) || '') : JSON.stringify(b.data || {});
      var m = text.match(/\[[A-Za-z][^\[\]\n]{0,60}\]/g);
      if (m) {
        for (var j = 0; j < m.length; j++) {
          issues.push({ idx: i, type: b.type, text: m[j], preview: blockPreview(b, 90) });
        }
      }
    } catch (e) {}
  }
  return issues;
}

function runLint() {
  var out = [];
  for (var i = 0; i < DB.blocks.length; i++) {
    var b = DB.blocks[i];
    if (!b) continue;
    if (b.type === 'clause' || b.type === 'paragraph' || b.type === 'bold-lead') {
      var txt = b.type === 'bold-lead' ? ((b.data && b.data.text) || '') : ((b.data && b.data.text) || '');
      if (b.type === 'paragraph') txt = (b.data && b.data.text) || '';
      if (!String(txt || '').trim()) out.push({ idx: i, issue: 'Empty ' + b.type + ' block.' });
    }
    if (b.type === 'signature-block' && (!b.data || !(b.data.parties || []).length)) {
      out.push({ idx: i, issue: 'Signature block has no parties.' });
    }
    if (b.type === 'section' && b.data) {
      var n = String(b.data.number || '').trim();
      if (n) {
        var dups = 0;
        for (var j = 0; j < DB.blocks.length; j++) {
          if (j !== i && DB.blocks[j].type === 'section' && String((DB.blocks[j].data || {}).number || '').trim() === n) dups++;
        }
        if (dups > 0) out.push({ idx: i, issue: 'Duplicate section number "' + n + '".' });
      } else {
        out.push({ idx: i, issue: 'Section without a number.' });
      }
    }
  }
  // unfilled placeholders + empty variables
  var ph = runPlaceholderScan();
  for (var p = 0; p < ph.length; p++) out.push({ idx: ph[p].idx, issue: 'Unfilled placeholder ' + ph[p].text + '.' });
  for (var k in DB.variables) {
    if (Object.prototype.hasOwnProperty.call(DB.variables, k) && !String(DB.variables[k].value || '').trim() && varUsageCount(k) > 0) {
      out.push({ idx: -1, issue: 'Variable "' + (DB.variables[k].label || k) + '" is empty but used ' + varUsageCount(k) + '×.' });
    }
  }
  return out;
}

function fleschScore(text) {
  var t = String(text || '');
  var words = t.split(/\s+/).filter(function (w) { return /[a-zA-Z0-9]/.test(w); });
  if (!words.length) return null;
  var sentences = t.split(/[.!?]+/).filter(function (s) { return s.trim(); }).length || 1;
  var syllables = 0;
  for (var i = 0; i < words.length; i++) {
    var w = words[i].toLowerCase().replace(/[^a-z]/g, '');
    if (!w) continue;
    var count = w.match(/[aeiouy]+/g);
    syllables += Math.max(1, count ? count.length : 1);
  }
  var score = 206.835 - 1.015 * (words.length / sentences) - 84.6 * (syllables / words.length);
  return Math.round(score);
}

function runReadability() {
  var blocks = [];
  for (var i = 0; i < DB.blocks.length; i++) {
    var b = DB.blocks[i];
    var text = null;
    if (b.type === 'paragraph') text = (b.data && b.data.text) || '';
    else if (b.type === 'clause') text = ((b.data && b.data.text) || '');
    else if (b.type === 'bold-lead') text = ((b.data && b.data.lead) || '') + ' ' + ((b.data && b.data.text) || '');
    if (text) {
      var sc = fleschScore(stripTags(text));
      if (sc !== null) blocks.push({ idx: i, score: sc, preview: blockPreview(b, 70) });
    }
  }
  var total = 0;
  for (var j = 0; j < blocks.length; j++) total += blocks[j].score;
  var avg = blocks.length ? Math.round(total / blocks.length) : null;
  blocks.sort(function (a, b) { return a.score - b.score; });
  return { avg: avg, hardest: blocks.slice(0, 3) };
}

function updateSizeMeter() {
  var fill = el('size-meter-fill');
  if (!fill) return;
  var kb = 0;
  try { kb = (JSON.stringify(slimValue()).length + (JSON.stringify(_chatMessages || []).length || 0)) / 1024; } catch (e) {}
  var pct = Math.min(100, Math.round((kb / 1024) * 100));
  var label = el('size-meter-label');
  if (label) label.textContent = kb.toFixed(0) + ' KB of 1 MB CMS budget (' + pct + '%)';
  fill.style.width = pct + '%';
  fill.style.background = pct > 80 ? '#dc2626' : pct > 60 ? '#d97706' : '#059669';
}

function updateStagedChip() {
  var chip = el('staged-chip');
  if (!chip) return;
  if (_dirty) {
    chip.style.display = '';
    chip.textContent = '💾 Staged v' + DB.version + ' — remember to Save in the CMS';
    chip.title = 'Changes are staged in this field. Click Save in the parent CMS record to commit them.';
  } else {
    chip.style.display = 'none';
  }
}

/* ═══════════════════════════════════════════
   IMPORT (JSON blocks or Markdown / plain text)
   ═══════════════════════════════════════════ */
function markdownToBlocks(text) {
  var lines = String(text || '').replace(/\r/g, '').split('\n');
  var blocks = [];
  var listItems = [];
  function flushList() {
    if (listItems.length) { blocks.push({ type: 'bullets', data: { items: listItems } }); listItems = []; }
  }
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) { flushList(); continue; }
    if (/^[-•*]\s+/.test(line)) { listItems.push(line.replace(/^[-•*]\s+/, '')); continue; }
    flushList();
    var hm = line.match(/^(#{1,3})\s+(.*)$/);
    if (hm) {
      var level = hm[1].length;
      if (level === 1) blocks.push({ type: 'section', data: { number: '', title: hm[2].trim() } });
      else if (level === 2) blocks.push({ type: 'subsection', data: { number: '', title: hm[2].trim() } });
      else blocks.push({ type: 'heading', data: { text: hm[2].trim(), level: 3 } });
      continue;
    }
    var cm = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (cm) { blocks.push({ type: 'clause', data: { number: cm[1], text: cm[2].trim() } }); continue; }
    blocks.push({ type: 'paragraph', data: { text: line } });
  }
  flushList();
  return blocks;
}

function applyImportText() {
  var area = el('import-area');
  if (!area) return;
  var text = String(area.value || '').trim();
  if (!text) { showToast('Paste JSON blocks or Markdown text first.', 'warning'); return; }
  var imported = [];
  var trimmed = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  if (trimmed.charAt(0) === '[' || trimmed.charAt(0) === '{') {
    try {
      var obj = JSON.parse(trimmed);
      if (Array.isArray(obj)) imported = sanitizeBlocks(obj);
      else if (obj && Array.isArray(obj.blocks)) imported = sanitizeBlocks(obj.blocks);
    } catch (e) { imported = []; }
  }
  if (!imported.length) imported = markdownToBlocks(text);
  if (!imported.length) { showToast('Could not parse the import.', 'error'); return; }
  _snapshotPush();
  DB.blocks = DB.blocks.concat(imported);
  scanBlocksForVars();
  _bumpVersion('minor');
  _pushHistory();
  persist();
  mountPreview();
  updateDocStats();
  renderOutline();
  renderVariables();
  updateVarBadge();
  area.value = '';
  showToast('📥 Imported ' + imported.length + ' block(s).', 'success');
}

/* ═══════════════════════════════════════════
   COVER PAGE & CMS SYNC
   ═══════════════════════════════════════════ */
function addCoverPage() {
  _snapshotPush();
  var t = resolveTitle();
  var newBlocks = [
    { type: 'title', data: { text: t, subtitle: '', date: new Date().toLocaleDateString() } },
    { type: 'center-line', data: { text: 'CONFIDENTIAL', bold: true } },
    { type: 'page-break', data: {} }
  ];
  // prepend, after any existing title
  var insertAt = 0;
  for (var i = 0; i < DB.blocks.length; i++) {
    if (DB.blocks[i].type === 'title') { insertAt = i + 1; break; }
  }
  DB.blocks.splice.apply(DB.blocks, [insertAt, 0].concat(newBlocks));
  _pushHistory();
  _bumpVersion('patch');
  persist();
  mountPreview();
  updateDocStats();
  renderOutline();
  showToast('📕 Cover page added.', 'success');
}

function syncToCms() {
  try {
    var fields = tool.getFields();
    if (!fields || typeof fields !== 'object') { showToast('No sibling fields are readable in this CMS context.', 'warning'); return; }
    var written = {};
    var title = resolveTitle();
    for (var k in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, k)) continue;
      var kl = k.toLowerCase();
      if (kl === 'documentname' || kl === 'documenttitle') {
        tool.setField(k, title);
        written[k] = title;
      }
      if (kl === 'effectivedate' || kl === 'documentdate') {
        var v = DB.variables['effectiveDate'] || DB.variables['date'];
        if (v && String(v.value || '').trim()) {
          tool.setField(k, String(v.value).trim());
          written[k] = v.value;
        }
      }
    }
    if (Object.keys(written).length) {
      showToast('⬆ Synced to parent CMS: ' + Object.keys(written).join(', '), 'success');
    } else {
      showToast('Nothing to sync — no matching parent fields (documentName/title or date fields).', 'info');
    }
  } catch (e) {
    showToast('Sync unavailable: ' + e.message, 'warning');
  }
}

/* ═══════════════════════════════════════════
   LEGAL COMPONENT LIBRARY
   Every renderer outputs INLINE-STYLED semantic HTML only, so the
   exported document is fully self-contained (like CurriculumBuilder).
   ═══════════════════════════════════════════ */
function qFont(f) { return "'" + String(f || 'Times New Roman').replace(/'/g, '') + "'"; }
function S() {
  var s = DB.settings || DEFAULT_SETTINGS;
  return {
    f: qFont(s.fontFamily),
    sz: s.fontSize || '12pt',
    c: s.color || '#111111',
    lh: s.lineHeight || '1.6'
  };
}
function ps(S2, extra) {
  return 'font-family:' + S2.f + ';font-size:' + S2.sz + ';color:' + S2.c + ';line-height:' + S2.lh + ';' + (extra || '');
}
function val(v, d) { return v === undefined || v === null || v === '' ? d : v; }

var LEGAL_COMPONENTS = {
  /* ── Content & generic ── */
  'title': {
    name: 'Document Title', icon: '📜', cat: 'content',
    desc: 'Centered main title with optional subtitle, reference number and date.',
    schema: '{text, subtitle?, refNo?, date?}',
    render: function (d, S2) {
      var h = '<div style="text-align:center;margin:0 0 22px">';
      h += '<h1 style="' + ps(S2, 'font-size:17pt;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;text-align:center;margin:0 0 10px') + '">' + esc(d.text || '') + '</h1>';
      if (d.subtitle) h += '<p style="' + ps(S2, 'text-align:center;font-weight:600;margin:0 0 10px') + '">' + esc(d.subtitle) + '</p>';
      if (d.refNo) h += '<p style="' + ps(S2, 'text-align:center;font-size:11pt;color:#475569;margin:0 0 4px') + '">Ref: ' + esc(d.refNo) + '</p>';
      if (d.date) h += '<p style="' + ps(S2, 'text-align:center;font-size:11pt;color:#475569;margin:0') + '">' + esc(d.date) + '</p>';
      return h + '</div>';
    }
  },
  'paragraph': {
    name: 'Paragraph', icon: '¶', cat: 'content',
    desc: 'Regular justified reading paragraph — the main body text of the document.',
    schema: '{text, align?: "justify"|"left"|"center"}',
    render: function (d, S2) {
      var al = d.align === 'left' ? 'left' : d.align === 'center' ? 'center' : 'justify';
      return '<p style="' + ps(S2, 'text-align:' + al + ';margin:0 0 10px') + '">' + esc(d.text || '') + '</p>';
    }
  },
  'bold-lead': {
    name: 'Bold Lead-in', icon: '🔠', cat: 'content',
    desc: 'Paragraph that starts with a bold lead-in phrase (e.g. "Term:" then the text).',
    schema: '{lead, text}',
    render: function (d, S2) {
      return '<p style="' + ps(S2, 'text-align:justify;margin:0 0 10px') + '"><strong>' + esc(d.lead || '') + '</strong> ' + esc(d.text || '') + '</p>';
    }
  },
  'heading': {
    name: 'Heading', icon: '📑', cat: 'content',
    desc: 'Generic section heading (level 1-3) with a thin bottom rule.',
    schema: '{text, level?: 1|2|3, center?: true}',
    render: function (d, S2) {
      var lvl = parseInt(d.level) || 1;
      var sizes = { 1: '14pt', 2: '13pt', 3: '12pt' };
      var center = d.center ? 'text-align:center;' : '';
      return '<h' + lvl + ' style="' + ps(S2, 'font-size:' + (sizes[lvl] || '12pt') + ';font-weight:700;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid #cbd5e1;' + center) + '">' + esc(d.text || '') + '</h' + lvl + '>';
    }
  },
  'toc': {
    name: 'Table of Contents', icon: '📑', cat: 'content',
    desc: 'Auto-generated numbered index of all "section" blocks in the document.',
    schema: '{title?, includeSubsections?: true}',
    render: function (d, S2) {
      var entries = [];
      var sec = 0, sub = 0, parent = '';
      for (var i = 0; i < DB.blocks.length; i++) {
        var b = DB.blocks[i];
        if (!b) continue;
        if (b.type === 'section') {
          sec++; sub = 0;
          parent = String(sec);
          var sn = (b.data && b.data.number) ? String(b.data.number) : parent;
          entries.push({ num: sn, title: (b.data && b.data.title) || '' });
        } else if (b.type === 'subsection' && d.includeSubsections !== false) {
          sub++;
          var sbn = (b.data && b.data.number) ? String(b.data.number) : parent + '.' + sub;
          entries.push({ num: sbn, title: (b.data && b.data.title) || '', sub: true });
        }
      }
      if (!entries.length) return '<p style="' + ps(S2, 'color:#94a3b8;font-style:italic;margin:0 0 10px') + '">[No sections yet]</p>';
      var h = '<p style="' + ps(S2, 'text-align:center;font-weight:700;margin:14px 0 10px') + '">' + esc(d.title || 'TABLE OF CONTENTS') + '</p>';
      for (var j = 0; j < entries.length; j++) {
        var e = entries[j];
        h += '<p style="' + ps(S2, 'margin:0 0 4px' + (e.sub ? ';padding-left:22px' : '')) + '">' + esc(e.num) + '. &nbsp;' + esc(e.title) + '</p>';
      }
      return h;
    }
  },
  'center-line': {
    name: 'Centered Line', icon: '➖', cat: 'content',
    desc: 'A centered line of text (used above schedules, exhibits, captions).',
    schema: '{text, bold?: true}',
    render: function (d, S2) {
      return '<p style="' + ps(S2, 'text-align:center;' + (d.bold ? 'font-weight:700;' : '') + 'margin:0 0 10px') + '">' + esc(d.text || '') + '</p>';
    }
  },
  'bullets': {
    name: 'Bullet List', icon: '•', cat: 'content',
    desc: 'Bulleted list of items.',
    schema: '{items: [string]}',
    render: function (d, S2) {
      var items = d.items || [];
      if (!items.length) return '';
      var h = '<ul style="' + ps(S2, 'margin:0 0 10px;padding-left:30px') + '">';
      for (var i = 0; i < items.length; i++) {
        h += '<li style="' + ps(S2, 'margin-bottom:4px') + '">' + esc(typeof items[i] === 'string' ? items[i] : (items[i].text || '')) + '</li>';
      }
      return h + '</ul>';
    }
  },
  'numbering': {
    name: 'Numbered List', icon: '1️⃣', cat: 'content',
    desc: 'Numbered list; each item may have nested lettered sub-items.',
    schema: '{items: [string | {text, subitems:[]}]}',
    render: function (d, S2) {
      var items = d.items || [];
      if (!items.length) return '';
      var h = '<ol style="' + ps(S2, 'margin:0 0 10px;padding-left:30px') + '">';
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var txt = typeof it === 'string' ? it : (it.text || '');
        h += '<li style="' + ps(S2, 'margin-bottom:4px') + '">' + esc(txt);
        var subs = (it && it.subitems) || [];
        if (subs.length) {
          h += '<ol style="list-style-type:lower-alpha;margin-top:3px;padding-left:24px">';
          for (var j = 0; j < subs.length; j++) {
            h += '<li style="' + ps(S2, 'margin-bottom:2px') + '">' + esc(typeof subs[j] === 'string' ? subs[j] : (subs[j].text || '')) + '</li>';
          }
          h += '</ol>';
        }
        h += '</li>';
      }
      return h + '</ol>';
    }
  },
  'quote': {
    name: 'Quotation', icon: '❝', cat: 'content',
    desc: 'Indented quotation with an optional case/statute citation.',
    schema: '{text, citation?}',
    render: function (d, S2) {
      var h = '<blockquote style="' + ps(S2, 'border-left:3px solid #94a3b8;padding:2px 0 2px 16px;margin:0 0 12px 8px;font-style:italic') + '">' + esc(d.text || '') + '</blockquote>';
      if (d.citation) h += '<p style="' + ps(S2, 'font-size:11pt;color:#475569;text-align:right;margin:0 0 12px') + '">— ' + esc(d.citation) + '</p>';
      return h;
    }
  },
  'legal-callout': {
    name: 'Callout Box', icon: '⚠️', cat: 'content',
    desc: 'Bordered attention box. variant: important (red), warning (amber), note (blue).',
    schema: '{variant?: "important"|"warning"|"note", title?, body}',
    render: function (d, S2) {
      var themes = {
        important: ['#b91c1c', '#fee2e2', '#fca5a5', 'IMPORTANT'],
        warning: ['#92400e', '#fef3c7', '#fcd34d', 'WARNING'],
        note: ['#1d4ed8', '#dbeafe', '#93c5fd', 'NOTE']
      };
      var t = themes[d.variant] || themes.note;
      return '<div style="' + ps(S2, 'border:1px solid ' + t[2] + ';background:' + t[1] + ';border-radius:6px;padding:10px 14px;margin:0 0 12px') + '">' +
        '<p style="' + ps(S2, 'font-weight:700;color:' + t[0] + ';margin:0 0 4px') + '">' + esc(d.title || t[3]) + '</p>' +
        '<p style="' + ps(S2, 'margin:0;color:' + t[0]) + '">' + esc(d.body || '') + '</p></div>';
    }
  },
  'definitions': {
    name: 'Definitions', icon: '📖', cat: 'content',
    desc: 'Defined-terms list: term in bold followed by its definition.',
    schema: '{title?, terms: [{term, definition}]}',
    render: function (d, S2) {
      var terms = d.terms || [];
      if (!terms.length) return '';
      var h = '';
      if (d.title) h += '<p style="' + ps(S2, 'font-weight:700;margin:12px 0 6px') + '">' + esc(d.title) + '</p>';
      h += '<div style="' + ps(S2, 'margin:0 0 12px') + '">';
      for (var i = 0; i < terms.length; i++) {
        var t = terms[i];
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 6px') + '"><strong>“' + esc(t.term) + '”</strong> means ' + esc(t.definition) + '</p>';
      }
      return h + '</div>';
    }
  },
  'table': {
    name: 'Table', icon: '🗂', cat: 'content',
    desc: 'Generic bordered table with a shaded header row.',
    schema: '{columns: [string], rows: [[string]]}',
    render: function (d, S2) {
      var cols = d.columns || [];
      var rows = d.rows || [];
      if (!cols.length) return '';
      var h = '<table style="border-collapse:collapse;width:100%;margin:0 0 12px;' + ps(S2) + '">';
      h += '<thead><tr>';
      for (var c = 0; c < cols.length; c++) {
        h += '<th style="border:1px solid #94a3b8;background:#e2e8f0;padding:6px 10px;text-align:left;font-weight:700">' + esc(cols[c]) + '</th>';
      }
      h += '</tr></thead><tbody>';
      for (var r = 0; r < rows.length; r++) {
        h += '<tr>';
        var row = rows[r] || [];
        for (var c2 = 0; c2 < cols.length; c2++) {
          h += '<td style="border:1px solid #94a3b8;padding:6px 10px;vertical-align:top">' + esc(row[c2] === undefined ? '' : row[c2]) + '</td>';
        }
        h += '</tr>';
      }
      return h + '</tbody></table>';
    }
  },
  'separator': {
    name: 'Horizontal Rule', icon: '➖', cat: 'content',
    desc: 'A thin horizontal rule.',
    schema: '{}',
    render: function (d, S2) {
      return '<hr style="border:none;border-top:1px solid #cbd5e1;margin:14px 0">';
    }
  },
  'page-break': {
    name: 'Page Break', icon: '⏭', cat: 'content',
    desc: 'Forces a new page when printing / exporting to PDF or Word.',
    schema: '{}',
    render: function () {
      return '<div class="lb-page-break"></div>';
    }
  },
  'html': {
    name: 'Raw HTML', icon: '🌐', cat: 'content',
    desc: 'Free-form block: any self-contained HTML, CSS and JS (inline or embedded tags allowed).',
    schema: '{html: "<any html>"}',
    render: function (d) {
      return d.html || '';
    }
  },

  /* ── Document structure ── */
  'parties-block': {
    name: 'Parties', icon: '👥', cat: 'structural',
    desc: '"BETWEEN:" intro with the parties, their details and short names.',
    schema: '{heading?, parties: [{name, details?, alias?}], collectively?}',
    render: function (d, S2) {
      var parties = d.parties || [];
      var h = '<p style="' + ps(S2, 'text-align:center;font-weight:700;text-transform:uppercase;margin:16px 0 10px') + '">' + esc(d.heading || 'BETWEEN') + '</p>';
      for (var i = 0; i < parties.length; i++) {
        var p = parties[i];
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 10px') + '">';
        h += '<strong>' + esc(p.name || '') + '</strong>';
        if (p.details) h += ', ' + esc(p.details);
        if (p.alias) h += ' (hereinafter referred to as <strong>“' + esc(p.alias) + '”</strong>)';
        h += (i < parties.length - 1 ? ';' : '.') + '</p>';
      }
      h += '<p style="' + ps(S2, 'text-align:center;font-weight:700;margin:12px 0') + '">' + esc(val(d.collectively, 'COLLECTIVELY REFERRED TO AS THE “PARTIES”')) + '</p>';
      return h;
    }
  },
  'recitals': {
    name: 'Recitals', icon: '📜', cat: 'structural',
    desc: 'WHEREAS recitals with lettered or numbered entries.',
    schema: '{title?, recitals: [string]}',
    render: function (d, S2) {
      var recs = d.recitals || [];
      if (!recs.length) return '';
      var h = '<p style="' + ps(S2, 'text-align:center;font-weight:700;margin:14px 0 8px') + '">' + esc(val(d.title, 'RECITALS')) + '</p>';
      for (var i = 0; i < recs.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 6px') + '"><strong>WHEREAS</strong>, ' + esc(recs[i]) + ';</p>';
      }
      h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 6px') + '"><strong>NOW, THEREFORE</strong>, the Parties agree as follows:</p>';
      return h;
    }
  },
  'agreement-word': {
    name: 'Agreement Word', icon: '🤝', cat: 'structural',
    desc: 'Lead-in paragraph: "NOW THEREFORE, in consideration… the Parties agree as follows:".',
    schema: '{text?}',
    render: function (d, S2) {
      var t = d.text || 'NOW, THEREFORE, in consideration of the mutual covenants and agreements contained herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Parties agree as follows:';
      return '<p style="' + ps(S2, 'text-align:justify;margin:0 0 12px') + '"><strong>NOW, THEREFORE</strong>, ' + esc(t.replace(/^NOW,?\s*THEREFORE,?\s*/i, '')) + '</p>';
    }
  },
  'section': {
    name: 'Numbered Section', icon: '🔢', cat: 'structural',
    desc: 'Main numbered section heading, e.g. "1. TERM AND TERMINATION".',
    schema: '{number, title}',
    render: function (d, S2) {
      return '<h2 style="' + ps(S2, 'font-size:13pt;font-weight:700;margin:18px 0 8px') + '">' + esc(d.number || '') + (d.number ? '. ' : '') + esc(d.title || '') + '</h2>';
    }
  },
  'subsection': {
    name: 'Numbered Subsection', icon: '🔤', cat: 'structural',
    desc: 'Sub-section heading, e.g. "1.1 Term of Agreement".',
    schema: '{number, title}',
    render: function (d, S2) {
      return '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;font-style:italic;margin:12px 0 6px') + '">' + esc(d.number || '') + (d.number ? '. ' : '') + esc(d.title || '') + '</h3>';
    }
  },
  'clause': {
    name: 'Clause', icon: '📝', cat: 'structural',
    desc: 'A numbered clause paragraph, with optional bold lead-in.',
    schema: '{number?, lead?, text}',
    render: function (d, S2) {
      var h = '<p style="' + ps(S2, 'text-align:justify;margin:0 0 10px') + '">';
      if (d.number) h += '<strong>' + esc(d.number) + '.</strong> ';
      if (d.lead) h += '<strong>' + esc(d.lead) + '</strong> ';
      h += esc(d.text || '') + '</p>';
      return h;
    }
  },
  'sub-clauses': {
    name: 'Lettered Sub-clauses', icon: '🔡', cat: 'structural',
    desc: 'Indented lettered list (a), (b), (c)…',
    schema: '{items: [string | {lead?, text}]}',
    render: function (d, S2) {
      var items = d.items || [];
      if (!items.length) return '';
      var h = '<div style="' + ps(S2, 'margin:0 0 10px 22px') + '">';
      var letters = 'abcdefghijklmnopqrstuvwxyz';
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var lead = typeof it === 'object' ? (it.lead || '') : '';
        var txt = typeof it === 'string' ? it : (it.text || '');
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 6px') + '"><strong>(' + letters[i % 26] + ')</strong> ' + (lead ? '<strong>' + esc(lead) + '</strong> ' : '') + esc(txt) + '</p>';
      }
      return h + '</div>';
    }
  },
  'schedule': {
    name: 'Schedule', icon: '🗓', cat: 'structural',
    desc: 'Schedule heading: "SCHEDULE A — Description".',
    schema: '{letter, title, description?}',
    render: function (d, S2) {
      var h = '<p style="' + ps(S2, 'text-align:center;font-weight:700;text-transform:uppercase;margin:18px 0 8px') + '">SCHEDULE ' + esc(d.letter || 'A') + '</p>';
      h += '<p style="' + ps(S2, 'text-align:center;font-weight:700;margin:0 0 8px') + '">' + esc(d.title || '') + '</p>';
      if (d.description) h += '<p style="' + ps(S2, 'text-align:center;color:#475569;margin:0 0 12px') + '">' + esc(d.description) + '</p>';
      return h;
    }
  },
  'exhibit': {
    name: 'Exhibit', icon: '🏷', cat: 'structural',
    desc: 'Exhibit header: "EXHIBIT A — Title".',
    schema: '{letter, title, description?}',
    render: function (d, S2) {
      var h = '<p style="' + ps(S2, 'text-align:center;font-weight:700;text-transform:uppercase;margin:18px 0 8px') + '">EXHIBIT ' + esc(d.letter || 'A') + '</p>';
      h += '<p style="' + ps(S2, 'text-align:center;font-weight:700;margin:0 0 8px') + '">' + esc(d.title || '') + '</p>';
      if (d.description) h += '<p style="' + ps(S2, 'text-align:center;color:#475569;margin:0 0 12px') + '">' + esc(d.description) + '</p>';
      return h;
    }
  },
  'date-line': {
    name: 'Effective Date Line', icon: '📅', cat: 'structural',
    desc: '"This Agreement is made and entered into as of ___."',
    schema: '{text?}',
    render: function (d, S2) {
      var t = d.text || 'This Agreement is made and entered into as of the ___ day of ____________, 20__ ("Effective Date").';
      return '<p style="' + ps(S2, 'text-align:justify;margin:0 0 12px') + '">' + esc(t) + '</p>';
    }
  },
  'execution-paragraph': {
    name: 'Execution Paragraph', icon: '✒️', cat: 'structural',
    desc: 'Centered "IN WITNESS WHEREOF…" closing paragraph.',
    schema: '{text?}',
    render: function (d, S2) {
      var t = d.text || 'IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.';
      return '<p style="' + ps(S2, 'text-align:center;font-weight:700;margin:20px 0 8px') + '">' + esc(t) + '</p>';
    }
  },
  'signature-block': {
    name: 'Signature Block', icon: '✍️', cat: 'structural',
    desc: 'Side-by-side signature lines with name, title and date.',
    schema: '{parties: [{name, title?, date?, extra?}], heading?}',
    render: function (d, S2) {
      var parties = d.parties || [];
      if (!parties.length) return '';
      var h = '';
      if (d.heading) h += '<p style="' + ps(S2, 'font-weight:700;margin:14px 0 8px') + '">' + esc(d.heading) + '</p>';
      h += '<div style="display:grid;grid-template-columns:repeat(' + Math.min(parties.length, 3) + ',1fr);gap:24px;margin:0 0 6px">';
      for (var i = 0; i < parties.length; i++) {
        var p = parties[i];
        h += '<div style="text-align:center">';
        h += '<p style="' + ps(S2, 'margin:34px 0 2px') + '">________________________________</p>';
        h += '<p style="' + ps(S2, 'font-weight:700;margin:0') + '">' + esc(p.name || '') + '</p>';
        if (p.title) h += '<p style="' + ps(S2, 'margin:0') + '">' + esc(p.title) + '</p>';
        if (p.extra) h += '<p style="' + ps(S2, 'font-size:11pt;color:#475569;margin:0') + '">' + esc(p.extra) + '</p>';
        h += '<p style="' + ps(S2, 'font-size:11pt;color:#475569;margin:0') + '">Date: ____________</p>';
        h += '</div>';
      }
      return h + '</div>';
    }
  },
  'witness-block': {
    name: 'Witness Block', icon: '👁', cat: 'structural',
    desc: 'Witness signature lines next to the signing party.',
    schema: '{party, witness?}',
    render: function (d, S2) {
      var h = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:0 0 10px">';
      h += '<div style="text-align:center"><p style="' + ps(S2, 'font-weight:700;margin:0 0 2px') + '">SIGNED by ' + esc(d.party || 'the Party') + '</p><p style="' + ps(S2, 'margin:34px 0 2px') + '">________________________________</p><p style="' + ps(S2, 'margin:0') + '">Signature</p></div>';
      h += '<div style="text-align:center"><p style="' + ps(S2, 'font-weight:700;margin:0 0 2px') + '">In the presence of:</p><p style="' + ps(S2, 'margin:34px 0 2px') + '">________________________________</p><p style="' + ps(S2, 'margin:0') + '">' + esc(val(d.witness, 'Witness Signature')) + '</p><p style="' + ps(S2, 'font-size:11pt;color:#475569;margin:0') + '">Name: ____________</p></div>';
      return h + '</div>';
    }
  },
  'notary-block': {
    name: 'Notary Block', icon: '🖋', cat: 'structural',
    desc: 'Notary acknowledgment / jurat with venue and seal area.',
    schema: '{state?, county?, jurat?: true, name?}',
    render: function (d, S2) {
      var h = '<div style="' + ps(S2, 'border:1px solid #cbd5e1;border-radius:6px;padding:12px 16px;margin:0 0 12px') + '">';
      h += '<p style="' + ps(S2, 'text-align:center;font-weight:700;margin:0 0 8px') + '">NOTARIAL ' + (d.jurat ? 'CERTIFICATE (JURAT)' : 'ACKNOWLEDGMENT') + '</p>';
      h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">State of ' + esc(d.state || '[State]') + ', County of ' + esc(d.county || '[County]') + '.</p>';
      if (d.jurat) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">Subscribed and sworn to (or affirmed) before me on this ___ day of ____________, 20__, by ' + esc(d.name || '[Name of signatory]') + ', proved to me on the basis of satisfactory evidence to be the person who appeared before me.</p>';
      } else {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">On this ___ day of ____________, 20__, before me personally appeared ' + esc(d.name || '[Name of signatory]') + ', known to me (or proved to me on the basis of satisfactory evidence) to be the person whose name is subscribed to the within instrument, and acknowledged that he/she executed the same.</p>';
      }
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px">';
      h += '<div style="text-align:center"><p style="' + ps(S2, 'margin:26px 0 2px') + '">________________________________</p><p style="' + ps(S2, 'font-size:11pt;margin:0') + '">Notary Public Signature</p></div>';
      h += '<div style="text-align:center"><p style="' + ps(S2, 'margin:26px 0 2px') + '">(SEAL)</p><p style="' + ps(S2, 'font-size:11pt;margin:0') + '">My commission expires: ____________</p></div>';
      h += '</div></div>';
      return h;
    }
  },
  'amendment-history': {
    name: 'Amendment History', icon: '🧾', cat: 'structural',
    desc: 'Log table of amendments: date, section, description.',
    schema: '{title?, rows: [[date, section, description]]}',
    render: function (d, S2) {
      var rows = d.rows || [];
      if (!rows.length) return '';
      var h = '<p style="' + ps(S2, 'font-weight:700;margin:12px 0 6px') + '">' + esc(val(d.title, 'AMENDMENT HISTORY')) + '</p>';
      h += '<table style="border-collapse:collapse;width:100%;margin:0 0 12px;' + ps(S2) + '"><thead><tr>';
      h += '<th style="border:1px solid #94a3b8;background:#e2e8f0;padding:5px 10px;text-align:left;width:18%">Date</th>';
      h += '<th style="border:1px solid #94a3b8;background:#e2e8f0;padding:5px 10px;text-align:left;width:22%">Section</th>';
      h += '<th style="border:1px solid #94a3b8;background:#e2e8f0;padding:5px 10px;text-align:left">Description</th>';
      h += '</tr></thead><tbody>';
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i] || [];
        h += '<tr>';
        h += '<td style="border:1px solid #94a3b8;padding:5px 10px">' + esc(r[0] === undefined ? '' : r[0]) + '</td>';
        h += '<td style="border:1px solid #94a3b8;padding:5px 10px">' + esc(r[1] === undefined ? '' : r[1]) + '</td>';
        h += '<td style="border:1px solid #94a3b8;padding:5px 10px">' + esc(r[2] === undefined ? '' : r[2]) + '</td>';
        h += '</tr>';
      }
      return h + '</tbody></table>';
    }
  },

  /* ── Pre-built boilerplate clauses ── */
  'confidentiality': {
    name: 'Confidentiality Clause', icon: '🔒', cat: 'boilerplate',
    desc: 'Standard confidentiality clause (definition, obligations, exceptions, survival).',
    schema: '{party?: "the Receiving Party", years?: 5, custom?: [paragraphs]}',
    render: function (d, S2) {
      var party = val(d.party, 'the Receiving Party');
      var years = val(d.years, 5);
      var paras = d.custom || [
        '"Confidential Information" means all non-public information, in any form, disclosed by or on behalf of one Party (the "Disclosing Party") to the other Party (' + party + '), whether marked as confidential or which a reasonable person would understand to be confidential.',
        party + ' shall hold all Confidential Information in strict confidence, use it solely for the purpose of performing this Agreement, and not disclose it to any third party without the Disclosing Party\u2019s prior written consent.',
        'Confidential Information shall not include information that: (a) is or becomes publicly available through no breach by ' + party + '; (b) was lawfully in ' + party + '\u2019s possession prior to disclosure; (c) is lawfully received from a third party without restriction; or (d) is independently developed without use of the Confidential Information.',
        'The obligations in this clause shall survive the termination of this Agreement for a period of ' + years + ' years.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">CONFIDENTIALITY</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'termination': {
    name: 'Termination Clause', icon: '⛔', cat: 'boilerplate',
    desc: 'Term and termination clause: term, termination for cause, effect of termination.',
    schema: '{term?, noticeDays?: 30, party?: "either Party", custom?: [paragraphs]}',
    render: function (d, S2) {
      var noticeDays = val(d.noticeDays, 30);
      var party = val(d.party, 'either Party');
      var paras = d.custom || [
        'This Agreement shall commence on the Effective Date and shall continue until terminated in accordance with this clause.',
        party + ' may terminate this Agreement for any reason upon ' + noticeDays + ' days\u2019 prior written notice to the other Party.',
        'Either Party may terminate this Agreement with immediate effect by written notice if the other Party commits a material breach of this Agreement and fails to remedy that breach within 14 days after receiving written notice of the breach, or if the other Party becomes insolvent, enters into liquidation or ceases to carry on business.',
        'Termination shall not affect any accrued rights or obligations of either Party, nor any provision of this Agreement which is expressly or by implication intended to survive termination.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">TERM AND TERMINATION</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'indemnity': {
    name: 'Indemnity Clause', icon: '🛡', cat: 'boilerplate',
    desc: 'Mutual or one-sided indemnification clause.',
    schema: '{party?: "the Indemnifying Party", scope?, custom?: [paragraphs]}',
    render: function (d, S2) {
      var party = val(d.party, 'the Indemnifying Party');
      var paras = d.custom || [
        party + ' shall indemnify, defend and hold harmless the other Party, its officers, directors, employees and agents from and against any and all claims, losses, damages, liabilities, costs and expenses (including reasonable legal fees) arising out of or in connection with: (a) any breach of this Agreement by ' + party + '; (b) any negligent or wrongful act or omission of ' + party + ' or its personnel; and (c) any infringement of third-party rights by materials or services provided by ' + party + '.',
        'The indemnified Party shall promptly notify ' + party + ' of any claim subject to indemnification, allow ' + party + ' to control the defence and settlement of the claim, and provide reasonable assistance at ' + party + '\u2019s expense.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">INDEMNIFICATION</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'force-majeure': {
    name: 'Force Majeure Clause', icon: '🌪', cat: 'boilerplate',
    desc: 'Standard force majeure clause.',
    schema: '{custom?: [paragraphs]}',
    render: function (d, S2) {
      var paras = d.custom || [
        'Neither Party shall be liable for any failure or delay in performing its obligations under this Agreement if such failure or delay is caused by events beyond its reasonable control, including acts of God, natural disasters, fire, flood, epidemic or pandemic, war, terrorism, civil unrest, strikes, governmental acts, or failure of utilities or telecommunications ("Force Majeure Event").',
        'The Party affected by a Force Majeure Event shall notify the other Party within 7 days of its occurrence, use reasonable efforts to mitigate its effects, and resume performance as soon as practicable.',
        'If a Force Majeure Event continues for more than 60 consecutive days, either Party may terminate this Agreement upon written notice without liability.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">FORCE MAJEURE</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'dispute-resolution': {
    name: 'Dispute Resolution', icon: '⚖️', cat: 'boilerplate',
    desc: 'Escalation: negotiation → mediation → arbitration/litigation.',
    schema: '{seat?, mechanism?: "arbitration"|"litigation", days?: 30, custom?: [paragraphs]}',
    render: function (d, S2) {
      var seat = val(d.seat, '[Seat of arbitration]');
      var mech = val(d.mechanism, 'arbitration');
      var days = val(d.days, 30);
      var paras = d.custom || [
        'The Parties shall attempt in good faith to resolve any dispute arising out of or in connection with this Agreement through negotiation between their authorized representatives.',
        'If the dispute is not resolved within ' + days + ' days of written notice of the dispute, the Parties shall attempt to settle it by mediation in accordance with a mutually agreed mediation procedure before commencing other proceedings.',
        (mech === 'litigation'
          ? 'If the dispute remains unresolved after mediation, the courts of ' + seat + ' shall have exclusive jurisdiction to settle it.'
          : 'If the dispute remains unresolved after mediation, it shall be finally settled by arbitration in ' + seat + ' in accordance with the applicable arbitration rules. The arbitration shall be conducted in [Language] by a single arbitrator. The award shall be final and binding on the Parties.')
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">DISPUTE RESOLUTION</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'governing-law': {
    name: 'Governing Law', icon: '🏛', cat: 'boilerplate',
    desc: 'Choice of law and jurisdiction clause.',
    schema: '{jurisdiction, custom?: [paragraphs]}',
    render: function (d, S2) {
      var jur = val(d.jurisdiction, '[Governing law and jurisdiction]');
      var paras = d.custom || [
        'This Agreement and any dispute or claim arising out of or in connection with it shall be governed by and construed in accordance with the laws of ' + jur + '.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">GOVERNING LAW AND JURISDICTION</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'entire-agreement': {
    name: 'Entire Agreement', icon: '📃', cat: 'boilerplate',
    desc: 'Entire agreement / merger clause.',
    schema: '{custom?: [paragraphs]}',
    render: function (d, S2) {
      var paras = d.custom || [
        'This Agreement, together with its schedules and exhibits, constitutes the entire agreement between the Parties with respect to its subject matter and supersedes all prior agreements, understandings, negotiations and representations, whether written or oral, relating to that subject matter.',
        'Each Party acknowledges that it has not relied on any representation or warranty not expressly set out in this Agreement.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">ENTIRE AGREEMENT</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'severability': {
    name: 'Severability', icon: '✂️', cat: 'boilerplate',
    desc: 'Severability / saving clause.',
    schema: '{custom?: [paragraphs]}',
    render: function (d, S2) {
      var paras = d.custom || [
        'If any provision of this Agreement is held to be invalid, illegal or unenforceable, the remaining provisions shall continue in full force and effect. The invalid provision shall be modified to the minimum extent necessary to make it valid and enforceable while preserving the Parties\u2019 original intent.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">SEVERABILITY</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'waiver': {
    name: 'Waiver Clause', icon: '🙅', cat: 'boilerplate',
    desc: 'No-waiver clause.',
    schema: '{custom?: [paragraphs]}',
    render: function (d, S2) {
      var paras = d.custom || [
        'No failure or delay by either Party in exercising any right or remedy under this Agreement shall operate as a waiver of that right or remedy, nor shall any single or partial exercise preclude any further exercise. A waiver is effective only if given in writing and signed by the waiving Party.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">WAIVER</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'assignment': {
    name: 'Assignment Clause', icon: '🔄', cat: 'boilerplate',
    desc: 'Restrictions on assignment and delegation.',
    schema: '{restricted?: true, custom?: [paragraphs]}',
    render: function (d, S2) {
      var paras = d.custom || [
        'Neither Party may assign or transfer this Agreement or any of its rights or obligations under it, in whole or in part, without the prior written consent of the other Party, such consent not to be unreasonably withheld. Any attempted assignment in violation of this clause shall be void.',
        'This Agreement shall be binding upon and inure to the benefit of the Parties and their permitted successors and assigns.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">ASSIGNMENT</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'counterparts': {
    name: 'Counterparts Clause', icon: '🖊', cat: 'boilerplate',
    desc: 'Execution in counterparts / electronic signatures clause.',
    schema: '{electronic?: true, custom?: [paragraphs]}',
    render: function (d, S2) {
      var paras = d.custom || [
        'This Agreement may be executed in any number of counterparts, each of which shall be deemed an original, and all of which together shall constitute one and the same instrument.' + (d.electronic ? ' The Parties agree that execution by electronic signature shall be as valid as a handwritten signature.' : '')
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">COUNTERPARTS</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'notices': {
    name: 'Notices Clause', icon: '📮', cat: 'boilerplate',
    desc: 'Notice addresses and deemed-delivery rules for the parties.',
    schema: '{parties: [{name, address?, email?}], custom?: [paragraphs]}',
    render: function (d, S2) {
      var parties = d.parties || [];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">NOTICES</h3>';
      h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">All notices under this Agreement shall be in writing and delivered personally, by email, or by registered mail to the addresses below, and shall be deemed received on delivery, or on the third business day after mailing:</p>';
      for (var i = 0; i < parties.length; i++) {
        var p = parties[i];
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '"><strong>' + esc(p.name || '') + '</strong>' + (p.address ? '<br>' + esc(p.address) : '') + (p.email ? '<br>' + esc(p.email) : '') + '</p>';
      }
      return h;
    }
  },
  'representations': {
    name: 'Representations & Warranties', icon: '✅', cat: 'boilerplate',
    desc: 'Checklist-style list of representations and warranties.',
    schema: '{title?, items: [string], custom?: [paragraphs]}',
    render: function (d, S2) {
      var items = d.items || [];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">' + esc(val(d.title, 'REPRESENTATIONS AND WARRANTIES')) + '</h3>';
      h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">Each Party represents and warrants to the other that:</p>';
      h += '<div style="' + ps(S2, 'margin:0 0 8px 22px') + '">';
      var letters = 'abcdefghijklmnopqrstuvwxyz';
      for (var i = 0; i < items.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 4px') + '"><strong>(' + letters[i % 26] + ')</strong> ' + esc(items[i]) + ';</p>';
      }
      return h + '</div>';
    }
  },
  'covenants': {
    name: 'Covenants', icon: '🤲', cat: 'boilerplate',
    desc: 'List of affirmative/negative covenants.',
    schema: '{title?, items: [string]}',
    render: function (d, S2) {
      var items = d.items || [];
      if (!items.length) return '';
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">' + esc(val(d.title, 'COVENANTS')) + '</h3>';
      h += '<ol style="' + ps(S2, 'margin:0 0 10px;padding-left:30px') + '">';
      for (var i = 0; i < items.length; i++) {
        h += '<li style="' + ps(S2, 'margin-bottom:4px') + '">' + esc(items[i]) + '</li>';
      }
      return h + '</ol>';
    }
  },
  'conditions-precedent': {
    name: 'Conditions Precedent', icon: '🚦', cat: 'boilerplate',
    desc: 'Checklist of conditions that must be satisfied before closing.',
    schema: '{title?, items: [string]}',
    render: function (d, S2) {
      var items = d.items || [];
      if (!items.length) return '';
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">' + esc(val(d.title, 'CONDITIONS PRECEDENT')) + '</h3>';
      h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">The obligations of the Parties under this Agreement are conditional upon satisfaction of each of the following:</p>';
      h += '<div style="' + ps(S2, 'margin:0 0 8px') + '">';
      for (var i = 0; i < items.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 4px') + '">☐ &nbsp;' + esc(items[i]) + '</p>';
      }
      return h + '</div>';
    }
  },
  'payment-terms': {
    name: 'Payment Terms', icon: '💰', cat: 'boilerplate',
    desc: 'Payment schedule table with item, amount and due date.',
    schema: '{title?, schedule: [{item, amount, due?}], currency?}',
    render: function (d, S2) {
      var sched = d.schedule || [];
      if (!sched.length) return '';
      var cur = d.currency || '';
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">' + esc(val(d.title, 'FEES AND PAYMENT')) + '</h3>';
      h += '<table style="border-collapse:collapse;width:100%;margin:0 0 12px;' + ps(S2) + '"><thead><tr>';
      h += '<th style="border:1px solid #94a3b8;background:#e2e8f0;padding:5px 10px;text-align:left">Item</th>';
      h += '<th style="border:1px solid #94a3b8;background:#e2e8f0;padding:5px 10px;text-align:left;width:26%">Amount</th>';
      h += '<th style="border:1px solid #94a3b8;background:#e2e8f0;padding:5px 10px;text-align:left;width:26%">Due</th>';
      h += '</tr></thead><tbody>';
      for (var i = 0; i < sched.length; i++) {
        var r = sched[i] || {};
        h += '<tr>';
        h += '<td style="border:1px solid #94a3b8;padding:5px 10px">' + esc(r.item || '') + '</td>';
        h += '<td style="border:1px solid #94a3b8;padding:5px 10px">' + (cur ? esc(cur) + ' ' : '') + esc(r.amount === undefined ? '' : r.amount) + '</td>';
        h += '<td style="border:1px solid #94a3b8;padding:5px 10px">' + esc(r.due || '') + '</td>';
        h += '</tr>';
      }
      return h + '</tbody></table>';
    }
  },
  'amendment': {
    name: 'Amendment Clause', icon: '✏️', cat: 'boilerplate',
    desc: 'How the agreement may be amended.',
    schema: '{custom?: [paragraphs]}',
    render: function (d, S2) {
      var paras = d.custom || [
        'This Agreement may not be amended or modified except by a written instrument signed by both Parties.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">AMENDMENT</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },

  /* ── Phase 2 expanded library ── */
  'non-compete': {
    name: 'Non-Compete Clause', icon: '🚫', cat: 'boilerplate',
    desc: 'Post-termination non-competition covenant with duration and territory.',
    schema: '{party?, years?: 1, territory?, custom?: [paragraphs]}',
    render: function (d, S2) {
      var party = val(d.party, 'the Service Provider');
      var years = val(d.years, 1);
      var terr = val(d.territory, '[Territory]');
      var paras = d.custom || [
        'For a period of ' + years + ' year(s) after termination of this Agreement, ' + party + ' shall not, directly or indirectly, within ' + terr + ', engage in, own, manage, operate, control, be employed by, consult for, or otherwise provide services to any business that competes with the business of the other Party as conducted during the term of this Agreement.',
        'The Parties acknowledge that the restrictions in this clause are reasonable and necessary to protect the legitimate business interests of the Parties and that monetary damages would be an inadequate remedy for any breach.',
        'If any restriction in this clause is held to be unenforceable, it shall be modified to the minimum extent necessary to make it enforceable while preserving the Parties\u2019 intent.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">NON-COMPETITION</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'non-solicitation': {
    name: 'Non-Solicitation Clause', icon: '🙅', cat: 'boilerplate',
    desc: 'Restrictions on soliciting employees, contractors and customers.',
    schema: '{party?, years?: 1, custom?: [paragraphs]}',
    render: function (d, S2) {
      var party = val(d.party, 'the Service Provider');
      var years = val(d.years, 1);
      var paras = d.custom || [
        'For a period of ' + years + ' year(s) after termination of this Agreement, ' + party + ' shall not, directly or indirectly, solicit, induce or attempt to induce any employee, contractor or consultant of the other Party to leave their engagement, nor solicit or accept business from any customer or client of the other Party with whom ' + party + ' had material contact during the term.',
        'Nothing in this clause restricts the right of any person to respond to general advertising or to seek employment voluntarily.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">NON-SOLICITATION</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'ip-assignment': {
    name: 'IP Assignment Clause', icon: '🧠', cat: 'boilerplate',
    desc: 'Assignment of intellectual property created under the agreement.',
    schema: '{party?, custom?: [paragraphs]}',
    render: function (d, S2) {
      var party = val(d.party, 'the Service Provider');
      var paras = d.custom || [
        'All intellectual property rights in any work, invention, design, software, documentation or other material created by ' + party + ' in the course of performing this Agreement ("Deliverables") shall, upon creation, vest in and be assigned to the other Party absolutely and free of all encumbrances.',
        party + ' hereby irrevocably assigns to the other Party all present and future intellectual property rights in the Deliverables and agrees to execute all documents and do all acts necessary to perfect such assignment, including after termination of this Agreement.',
        party + ' waives all moral rights in the Deliverables to the maximum extent permitted by law.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">INTELLECTUAL PROPERTY</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'gdpr-dpa': {
    name: 'GDPR Data Processing Addendum', icon: '🛡️', cat: 'boilerplate',
    desc: 'Data protection addendum: controller/processor roles, instructions, security, sub-processors.',
    schema: '{controller?, processor?, custom?: [paragraphs]}',
    render: function (d, S2) {
      var ctrl = val(d.controller, '[Controller]');
      var proc = val(d.processor, '[Processor]');
      var paras = d.custom || [
        ctrl + ' acts as data controller and ' + proc + ' acts as data processor in respect of personal data processed under the Agreement.',
        proc + ' shall process personal data only on documented instructions from ' + ctrl + ', including with regard to transfers of personal data to third countries, and shall ensure that persons authorised to process the personal data are committed to confidentiality.',
        proc + ' shall implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk, assist ' + ctrl + ' in responding to data subject requests, and notify ' + ctrl + ' without undue delay after becoming aware of a personal data breach.',
        proc + ' shall not engage any sub-processor without prior written authorisation of ' + ctrl + ', shall enter into written contracts with authorised sub-processors imposing equivalent obligations, and shall delete or return all personal data to ' + ctrl + ' after the end of the services.',
        'The Parties shall cooperate with supervisory authorities and maintain records of processing activities as required by the applicable data protection laws, including the EU General Data Protection Regulation (GDPR).'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">DATA PROTECTION</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'loi': {
    name: 'Letter of Intent', icon: '💌', cat: 'boilerplate',
    desc: 'Non-binding letter of intent: purpose, key terms, exclusivity, non-binding effect.',
    schema: '{partyA?, partyB?, subject?, custom?: [paragraphs]}',
    render: function (d, S2) {
      var a = val(d.partyA, '[Party A]');
      var b = val(d.partyB, '[Party B]');
      var subject = val(d.subject, '[Subject matter of the proposed transaction]');
      var paras = d.custom || [
        'This letter of intent sets out the principal terms on which ' + a + ' and ' + b + ' propose to enter into a definitive agreement regarding ' + subject + ' (the "Proposed Transaction").',
        'The Parties shall negotiate in good faith the definitive agreement, which shall include customary representations, warranties, covenants, conditions and indemnities.',
        'Each Party shall bear its own costs and expenses in connection with the Proposed Transaction, and neither Party shall be obliged to proceed unless and until a definitive agreement is executed by both Parties.',
        'This letter is an expression of intent only and, except for the provisions on confidentiality, exclusivity (if any) and governing law, is not legally binding.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">LETTER OF INTENT</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'settlement-deed': {
    name: 'Settlement Agreement', icon: '🤝', cat: 'boilerplate',
    desc: 'Settlement and release: payment, releases, no admission, confidentiality.',
    schema: '{parties?, amount?, custom?: [paragraphs]}',
    render: function (d, S2) {
      var amt = val(d.amount, '[Settlement amount]');
      var paras = d.custom || [
        'In full and final settlement of all claims arising out of or in connection with [Describe the dispute], the Respondent shall pay to the Claimant the sum of ' + amt + ' within [30] days of the date of this Agreement.',
        'Upon receipt of the settlement sum in full, the Claimant releases and forever discharges the Respondent, its officers, employees and affiliates from all claims, demands, actions and causes of action, whether known or unknown, arising out of the dispute.',
        'This Agreement is entered into for the purpose of settlement only and neither the payment nor anything contained in this Agreement shall constitute or be construed as an admission of liability by any Party.',
        'The terms of this Agreement and the fact of the settlement shall remain confidential, except as required by law or to enforce this Agreement.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">SETTLEMENT AND RELEASE</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'software-license': {
    name: 'Software License', icon: '💿', cat: 'boilerplate',
    desc: 'Grant, restrictions, ownership, support and termination for a software license.',
    schema: '{licensor?, licensee?, custom?: [paragraphs]}',
    render: function (d, S2) {
      var lic = val(d.licensor, 'the Licensor');
      var lie = val(d.licensee, 'the Licensee');
      var paras = d.custom || [
        lic + ' grants ' + lie + ' a non-exclusive, non-transferable, revocable license to install and use the Software for its internal business purposes during the term of this Agreement.',
        lie + ' shall not copy, modify, reverse engineer, decompile or disassemble the Software, sublicense, rent or lease it to third parties, or remove any proprietary notices, except to the extent permitted by applicable law.',
        'All intellectual property rights in and to the Software remain vested in ' + lic + ', and ' + lie + ' acquires no rights in the Software other than the license expressly granted.',
        'The Software is provided "as is" without warranty of any kind, except as expressly set out in this Agreement. In no event shall ' + lic + ' be liable for indirect, incidental or consequential damages arising from the use of the Software.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">SOFTWARE LICENSE</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'privacy-policy': {
    name: 'Privacy Policy', icon: '🔐', cat: 'boilerplate',
    desc: 'Privacy policy sections: data collected, purposes, sharing, rights, contact.',
    schema: '{company?, custom?: [paragraphs]}',
    render: function (d, S2) {
      var co = val(d.company, '[Company]');
      var paras = d.custom || [
        co + ' collects personal data that you provide directly (such as name, contact details and account information) and data collected automatically when you use our services (such as device information and usage data).',
        'Personal data is processed for the following purposes: providing and improving the services, communicating with you, complying with legal obligations, and, where you have consented, direct marketing.',
        'Personal data may be shared with service providers acting on our behalf and with public authorities where required by law. We do not sell personal data to third parties.',
        'You have the right to access, correct, delete and port your personal data, to restrict or object to processing, and to withdraw consent at any time. To exercise these rights, contact us at [Contact details].',
        'Personal data is retained only for as long as necessary for the purposes described, and we implement appropriate technical and organisational measures to protect it.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">PRIVACY POLICY</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'cookie-policy': {
    name: 'Cookie Policy', icon: '🍪', cat: 'boilerplate',
    desc: 'Cookie policy: what cookies are, types used, consent and managing preferences.',
    schema: '{company?, custom?: [paragraphs]}',
    render: function (d, S2) {
      var co = val(d.company, '[Company]');
      var paras = d.custom || [
        'Cookies are small text files stored on your device when you visit a website. ' + co + ' uses cookies to make the website work, to remember your preferences, and to understand how the website is used.',
        'Strictly necessary cookies are required for the website to function and cannot be switched off. Preference cookies remember choices you make, statistics cookies help us understand usage, and marketing cookies may be set by our advertising partners.',
        'We will ask for your consent before placing non-essential cookies on your device. You can withdraw or change your consent at any time through the cookie settings, and you can also block or delete cookies through your browser settings.',
        'For more information about how we process personal data, see our Privacy Policy.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">COOKIE POLICY</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'affidavit': {
    name: 'Affidavit', icon: '📜', cat: 'boilerplate',
    desc: 'Sworn statement with affiant details and jurat.',
    schema: '{affiant?, statement?, custom?: [paragraphs]}',
    render: function (d, S2) {
      var af = val(d.affiant, '[Affiant name]');
      var st = val(d.statement, '[Statement of facts]');
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">AFFIDAVIT</h3>';
      h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">I, ' + esc(af) + ', of [Address], being duly sworn, depose and say:</p>';
      h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(st) + '</p>';
      h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">I make this affidavit in support of [Purpose] and for no other purpose.</p>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px">';
      h += '<div style="text-align:center"><p style="' + ps(S2, 'margin:26px 0 2px') + '">________________________________</p><p style="' + ps(S2, 'font-size:11pt;margin:0') + '">Affiant Signature</p></div>';
      h += '<div style="text-align:center"><p style="' + ps(S2, 'margin:26px 0 2px') + '">________________________________</p><p style="' + ps(S2, 'font-size:11pt;margin:0') + '">Notary / Commissioner</p></div>';
      return h + '</div>';
    }
  },
  'deed': {
    name: 'Deed', icon: '🏛️', cat: 'boilerplate',
    desc: 'Executed-as-a-deed block with recital and witness signature.',
    schema: '{party?, custom?: [paragraphs]}',
    render: function (d, S2) {
      var pty = val(d.party, '[Party]');
      var paras = d.custom || [
        'This Deed is executed by ' + pty + ' as a deed and is intended to be and is hereby delivered on the date stated at the beginning of this document.',
        'The obligations contained in this Deed are binding on the successors and assigns of ' + pty + '.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">EXECUTION AS A DEED</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:10px">';
      h += '<div style="text-align:center"><p style="' + ps(S2, 'font-weight:700;margin:0 0 2px') + '">EXECUTED as a DEED by</p><p style="' + ps(S2, 'font-weight:700;margin:0 0 2px') + '">' + esc(pty) + '</p><p style="' + ps(S2, 'margin:34px 0 2px') + '">________________________________</p><p style="' + ps(S2, 'font-size:11pt;margin:0') + '">Signature</p></div>';
      h += '<div style="text-align:center"><p style="' + ps(S2, 'font-weight:700;margin:0 0 2px') + '">In the presence of:</p><p style="' + ps(S2, 'margin:34px 0 2px') + '">________________________________</p><p style="' + ps(S2, 'font-size:11pt;margin:0') + '">Witness Signature</p><p style="' + ps(S2, 'font-size:11pt;margin:0') + '">Name: ____________</p></div>';
      return h + '</div>';
    }
  }
};

/* ═══════════════════════════════════════════
   DOCUMENT RENDERING
   ═══════════════════════════════════════════ */
function blocksToHtml() {
  var h = '';
  var S2 = S();
  for (var i = 0; i < DB.blocks.length; i++) {
    var b = DB.blocks[i];
    var r = LEGAL_COMPONENTS[b.type];
    var data = b.data || {};
    var inner;
    try {
      // manualHtml = content hand-edited in the document (overrides the generated markup)
      inner = (b.type === 'html') ? (data.html || '') : (data.manualHtml || (r ? r.render(data, S2) : ''));
    } catch (e) {
      inner = '<p style="color:#b91c1c;font-style:italic">[render error in ' + esc(b.type) + ']</p>';
    }
    if (!inner && b.type !== 'html') {
      inner = '<p style="color:#94a3b8;font-style:italic">[unknown block type: ' + esc(b.type) + ']</p>';
    }
    if (b.type !== 'html') inner = renderVars(inner);
    h += '<div class="lb-block" data-lb-id="' + i + '" data-lb-type="' + esc(b.type) + '">' + inner + '</div>';
  }
  return h;
}

/** Base CSS for the document — Word-style paginated pages (preview + exports). */
function docCss() {
  var s = DB.settings || DEFAULT_SETTINGS;
  var fam = qFont(s.fontFamily);
  var letter = s.pageSize === 'Letter';
  var pw = letter ? '216mm' : '210mm';
  var ph = letter ? '279mm' : '297mm';
  var pageSizeCss = letter ? 'Letter' : 'A4';
  var css = '';
  css += 'html,body{margin:0;padding:0;font-family:' + fam + ';}';
  css += 'h1,h2,h3,h4,h5,p,ul,ol,li,table,blockquote,hr{margin:0;padding:0;border:0;font-size:inherit;font-weight:inherit;}';
  css += 'ul,ol{padding-left:28px;margin:0 0 10px;}li{margin-bottom:4px;}';
  css += 'table{border-collapse:collapse;width:100%;margin:10px 0;}';
  css += '.doc-sheet{display:none;}';
  css += '.doc-pages{display:block;}';
  css += '.doc-page{position:relative;width:' + pw + ';height:' + ph + ';background:#fff;padding:22mm 18mm;box-sizing:border-box;overflow:hidden;page-break-after:always;break-after:page;font-family:' + fam + ';font-size:' + s.fontSize + ';color:' + s.color + ';line-height:' + s.lineHeight + ';}';
  css += '.doc-page:last-child{page-break-after:auto;break-after:auto;}';
  css += '.lb-block{margin:0;}';
  css += '.lb-page-break{height:0;margin:24px 0;border-top:2px dashed #cbd5e1;page-break-after:always;break-after:page;}';
  css += '::selection{background:#c7d2fe;}';
  css += '.lb-page-header{position:absolute;top:8mm;left:18mm;right:18mm;font-size:9pt;color:#94a3b8;text-align:center;pointer-events:none;}';
  css += '.lb-page-footer{position:absolute;bottom:8mm;left:18mm;right:18mm;font-size:9pt;color:#94a3b8;text-align:center;pointer-events:none;}';
  css += '.lb-watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:5;}';
  css += '.lb-watermark span{font-size:44pt;font-weight:800;letter-spacing:0.18em;color:rgba(100,116,139,0.14);transform:rotate(-30deg);white-space:nowrap;}';
  css += '.lb-var{background:#eef2ff;color:#4338ca;border-bottom:1px dashed #818cf8;border-radius:3px;padding:0 3px;cursor:pointer;}';
  css += '.lb-var-empty{color:#b45309;font-style:italic;background:#fef3c7;border-radius:3px;padding:0 3px;}';
  css += '.lb-editing .lb-var{cursor:text;}';
  css += '@page{size:' + pageSizeCss + ';margin:0;}';
  css += '@media screen{body{background:#d8dae1;padding:26px 20px;}.doc-pages{display:flex;flex-direction:column;gap:18px;}.doc-page{margin:0 auto;box-shadow:0 2px 16px rgba(15,23,42,0.18);border:1px solid #d5d8e0;}}';
  css += '@media print{body{background:#fff;padding:0;}.doc-pages{display:block;}.doc-page{margin:0;box-shadow:none;border:none;}.lb-page-break{border:none;margin:0;}}';
  css += '.lb-editing .doc-page{overflow:visible;min-height:' + ph + ';height:auto;outline:2px dashed #818cf8;outline-offset:-2px;cursor:text;}';
  css += '.lb-mini-bar{position:fixed;top:14px;left:50%;transform:translateX(-50%);display:none;z-index:99;background:#fff;border:1px solid #c7d2fe;border-radius:10px;box-shadow:0 6px 24px rgba(15,23,42,0.18);padding:5px 8px;align-items:center;gap:3px;font-family:system-ui,sans-serif;}';
  css += '.lb-mini-bar.show{display:flex;}';
  css += '.lb-mini-bar button{border:1px solid #e2e8f0;background:#fff;border-radius:6px;cursor:pointer;font-family:inherit;font-size:12px;min-width:26px;padding:3px 7px;color:#1e293b;}';
  css += '.lb-mini-bar button:hover{background:#eef2ff;border-color:#818cf8;color:#3730a3;}';
  css += '.lb-mini-bar input[type=color]{width:22px;height:22px;border:none;border-radius:5px;padding:0;cursor:pointer;background:transparent;}';
  css += '.lb-mini-bar .mb-sep{width:1px;height:18px;background:#e2e8f0;margin:0 3px;}';
  return css;
}

/** Scripts injected into the sandboxed preview (srcdoc) — plain JS bodies (no script tags). */
var SEL_JS =
  '(function(){' +
  'function rep(){var s=window.getSelection();var t=(s&&s.toString)?s.toString().trim():"";' +
  'var n=s.anchorNode;var e=(n&&n.nodeType===1)?n:((n&&n.parentElement)?n.parentElement:null);' +
  'var b=(e&&e.closest)?e.closest("[data-lb-id]"):null;' +
  'var idx=b?parseInt(b.getAttribute("data-lb-id"),10):-1;' +
  'var ty=b?b.getAttribute("data-lb-type"):"";' +
  'if(t&&t.length<=4000){try{parent.postMessage({lbSel:{idx:idx,type:ty,text:t}},"*");}catch(err){}}' +
  'var mb=document.getElementById("lb-mini-bar");' +
  'if(mb){if(t&&idx>=0){mb.classList.add("show");}else{mb.classList.remove("show");}}' +
  '}' +
  'document.addEventListener("mouseup",function(){setTimeout(rep,0);});' +
  'document.addEventListener("keyup",function(e){if(e.key==="Shift"||e.key.length===1){setTimeout(rep,0);}});' +
  'document.addEventListener("click",function(ev){' +
  '  var v=ev.target&&ev.target.closest?ev.target.closest(".lb-var"):null;' +
  '  if(v&&document.body.className.indexOf("lb-editing")===-1){' +
  '    var name=v.getAttribute("data-var");' +
  '    try{parent.postMessage({lbVar:{name:name}},"*");}catch(err){}' +
  '  }' +
  '});' +
  '})();';

var EDIT_JS =
  '(function(){' +
  'window.__lbStartEdit=function(){' +
  '  var bs=document.querySelectorAll(".lb-block");window.__lbSnap={};' +
  '  for(var i=0;i<bs.length;i++){window.__lbSnap[bs[i].getAttribute("data-lb-id")]=bs[i].innerHTML;}' +
  '  var ps=document.querySelectorAll(".doc-page");' +
  '  for(var j=0;j<ps.length;j++){ps[j].setAttribute("contenteditable","true");ps[j].setAttribute("spellcheck","true");}' +
  '  document.body.className="lb-editing";' +
  '};' +
  'window.__lbFinishEdit=function(){' +
  '  var ps2=document.querySelectorAll(".doc-page");' +
  '  for(var j2=0;j2<ps2.length;j2++){ps2[j2].removeAttribute("contenteditable");}' +
  '  document.body.className="";' +
  '  var changed=[];' +
  '  var bs2=document.querySelectorAll(".lb-block");' +
  '  for(var k=0;k<bs2.length;k++){' +
  '    var b=bs2[k];var idx=b.getAttribute("data-lb-id");' +
  '    if(window.__lbSnap&&window.__lbSnap[idx]!==b.innerHTML){changed.push({idx:parseInt(idx,10),html:b.innerHTML});}' +
  '  }' +
  '  window.__lbSnap=null;' +
  '  try{parent.postMessage({lbEdited:{blocks:changed}},"*");}catch(err){}' +
  '};' +
  'window.addEventListener("message",function(e){' +
  'var d=e.data||{};' +
  'if(d.lbCmd&&d.lbCmd.cmd==="edit"){' +
  '  if(d.lbCmd.on){window.__lbStartEdit();}' +
  '  else{window.__lbFinishEdit();}' +
  '} else if(d.lbCmd&&d.lbCmd.cmd==="format"){' +
  '  try{document.execCommand(d.lbCmd.op,false,d.lbCmd.val||null);}catch(err){}' +
  '} else if(d.lbCmd&&d.lbCmd.cmd==="zoom"){' +
  '  var wrap=document.getElementById("pages-wrap");' +
  '  if(wrap){var z=parseFloat(d.lbCmd.scale)||1;' +
  '    wrap.style.zoom=String(z);' +
  '    wrap.style.width=(100/z)+"%";' +
  '    wrap.style.transformOrigin="top center";' +
  '    try{parent.postMessage({lbZoomed:{scale:z}},"*");}catch(err){}}' +
  '} else if(d.lbCmd&&d.lbCmd.cmd==="goto"){' +
  '  var t=document.querySelector("[data-lb-id=\\""+d.lbCmd.idx+"\\"]");' +
  '  if(t){try{t.scrollIntoView({behavior:"smooth",block:"start"});}catch(err){t.scrollIntoView();}' +
  '    t.style.outline="2px solid #6366f1";t.style.outlineOffset="2px";' +
  '    setTimeout(function(){t.style.outline="";},1800);}' +
  '}' +
  '});' +
  'function __lbCleanPaste(html){' +
  '  try{' +
  '    var doc=new DOMParser().parseFromString(html,"text/html");' +
  '    var all=doc.querySelectorAll("*");' +
  '    for(var i=0;i<all.length;i++){' +
  '      var n=all[i];' +
  '      if(/^(script|style|link|meta|title|head|form|input|button|iframe|object|embed)$/i.test(n.tagName)){if(n.parentNode)n.parentNode.removeChild(n);continue;}' +
  '      var st=n.getAttribute("style")||"";' +
  '      st=st.replace(/mso-[^;:]+:[^;]+;?/gi,"");' +
  '      st=st.replace(/font-family\\s*:[^;]+;?/gi,"");' +
  '      st=st.replace(/font-size\\s*:[^;]+;?/gi,"");' +
  '      if(st.trim()){n.setAttribute("style",st.trim());}else{n.removeAttribute("style");}' +
  '      n.removeAttribute("class");n.removeAttribute("id");' +
  '      if(/^o:/i.test(n.tagName)){var frag=doc.createDocumentFragment();while(n.firstChild){frag.appendChild(n.firstChild);}if(n.parentNode){n.parentNode.replaceChild(frag,n);}}' +
  '    }' +
  '    return doc.body.innerHTML;' +
  '  }catch(err){return html;}' +
  '}' +
  'document.addEventListener("paste",function(e){' +
  '  var body=document.body;' +
  '  if(body&&body.className.indexOf("lb-editing")===-1)return;' +
  '  var t=e.target;' +
  '  if(!t||!t.getAttribute||t.getAttribute("contenteditable")!=="true")return;' +
  '  var html="";' +
  '  try{html=e.clipboardData?e.clipboardData.getData("text/html"):"";}catch(err){}' +
  '  if(!html)return;' +
  '  e.preventDefault();' +
  '  var clean=__lbCleanPaste(html);' +
  '  try{document.execCommand("insertHTML",false,clean);}catch(err){}' +
  '});' +
  'document.addEventListener("keydown",function(e){' +
  '  if(e.ctrlKey||e.metaKey){' +
  '    var map={b:"bold",i:"italic",u:"underline"};' +
  '    var k=String(e.key||"").toLowerCase();' +
  '    if(map[k]){e.preventDefault();try{document.execCommand(map[k],false,null);}catch(err){}}' +
  '  } else if(e.key==="Escape"&&document.body.className.indexOf("lb-editing")!==-1){' +
  '    try{parent.postMessage({lbCancel:true},"*");}catch(err){}' +
  '  }' +
  '});' +
  '})();';

var MINI_TOOLBAR_JS =
  '(function(){' +
  'var bar=document.createElement("div");bar.className="lb-mini-bar";bar.id="lb-mini-bar";' +
  'bar.innerHTML=' +
  '  "<button data-mb=\\"bold\\" title=\\"Bold (Ctrl+B)\\"><b>B</b></button>"+' +
  '  "<button data-mb=\\"italic\\" title=\\"Italic (Ctrl+I)\\"><i>I</i></button>"+' +
  '  "<button data-mb=\\"underline\\" title=\\"Underline (Ctrl+U)\\"><u>U</u></button>"+' +
  '  "<button data-mb=\\"strikeThrough\\" title=\\"Strikethrough\\"><s>S</s></button>"+' +
  '  "<span class=\\"mb-sep\\"></span>"+' +
  '  "<input type=\\"color\\" id=\\"mb-color\\" value=\\"#111111\\" title=\\"Text color\\">"+' +
  '  "<input type=\\"color\\" id=\\"mb-hl\\" value=\\"#fef08a\\" title=\\"Highlight\\">"+' +
  '  "<span class=\\"mb-sep\\"></span>"+' +
  '  "<button data-mb=\\"target\\" title=\\"Use selection as AI edit target\\">🎯</button>"+' +
  '  "<button id=\\"mb-save\\" title=\\"Save edits\\">✅ Save</button>"+' +
  '  "<button id=\\"mb-cancel\\" title=\\"Exit editing and discard\\">✕</button>";' +
  'document.body.appendChild(bar);' +
  'bar.addEventListener("click",function(e){' +
  '  var b=e.target.closest?e.target.closest("[data-mb],#mb-save,#mb-cancel"):null;' +
  '  if(!b)return;' +
  '  var mb=b.getAttribute("data-mb");' +
  '  if(mb==="target"){ try{parent.postMessage({lbTarget:true},"*");}catch(err){} return; }' +
  '  if(b.id==="mb-save"){ if(window.__lbFinishEdit){window.__lbFinishEdit();} return; }' +
  '  if(b.id==="mb-cancel"){ try{parent.postMessage({lbCancel:true},"*");}catch(err){} return; }' +
  '  if(mb){ try{document.execCommand(mb,false,null);}catch(err){} }' +
  '});' +
  'var mc=document.getElementById("mb-color");' +
  'if(mc)mc.addEventListener("change",function(){try{document.execCommand("foreColor",false,mc.value);}catch(err){}});' +
  'var mh=document.getElementById("mb-hl");' +
  'if(mh)mh.addEventListener("change",function(){try{document.execCommand("hiliteColor",false,mh.value);}catch(err){}});' +
  '})();';

var PAGINATOR_JS =
  '(function(){' +
  'function newPage(){var p=document.createElement("div");p.className="doc-page";' +
  'var wrap=document.getElementById("pages-wrap");if(wrap)wrap.appendChild(p);return p;}' +
  'function decorate(){' +
  '  var wrap=document.getElementById("pages-wrap");' +
  '  var ps=wrap?wrap.querySelectorAll(".doc-page"):[];' +
  '  var wm=(document.body.getAttribute("data-watermark")||"");' +
  '  var showNums=document.body.getAttribute("data-pagenumbers")!=="0";' +
  '  var title=(document.title||"").replace(/<[^>]*>/g,"");' +
  '  for(var i=0;i<ps.length;i++){' +
  '    var p=ps[i];' +
  '    var h=p.querySelector(".lb-page-header");var f=p.querySelector(".lb-page-footer");var w=p.querySelector(".lb-watermark");' +
  '    if(!h){h=document.createElement("div");h.className="lb-page-header";p.insertBefore(h,p.firstChild);}' +
  '    h.textContent=title||"";' +
  '    if(!f){f=document.createElement("div");f.className="lb-page-footer";p.appendChild(f);}' +
  '    f.textContent=showNums?("Page "+(i+1)+" of "+ps.length):"";' +
  '    if(!w){w=document.createElement("div");w.className="lb-watermark";p.appendChild(w);}' +
  '    w.innerHTML=wm?("<span>"+wm.replace(/</g,"&lt;")+"</span>"):"";' +
  '  }' +
  '}' +
  'function paginate(){' +
  'var sheet=document.getElementById("doc-sheet");var wrap=document.getElementById("pages-wrap");' +
  'if(!sheet||!wrap)return;' +
  'var pages=wrap.querySelectorAll(".doc-page");' +
  'for(var i=0;i<pages.length;i++){' +
  '  var kids=Array.prototype.slice.call(pages[i].children);' +
  '  for(var j=0;j<kids.length;j++){if(kids[j].className.indexOf("lb-block")!==-1||kids[j].getAttribute("data-lb-id"))sheet.appendChild(kids[j]);}' +
  '  wrap.removeChild(pages[i]);' +
  '}' +
  'var blocks=Array.prototype.slice.call(sheet.querySelectorAll(".lb-block"));' +
  'if(!blocks.length){return;}' +
  'var page=newPage();' +
  'for(var k=0;k<blocks.length;k++){' +
  '  var b=blocks[k];' +
  '  if(b.getAttribute("data-lb-type")==="page-break"){page=newPage();continue;}' +
  '  page.appendChild(b);' +
  '  if(page.scrollHeight>page.clientHeight+2&&page.children.length>1){' +
  '    page.removeChild(b);page=newPage();page.appendChild(b);' +
  '  }' +
  '}' +
  'var ps=wrap.querySelectorAll(".doc-page");' +
  'for(var m=0;m<ps.length;m++){' +
  '  if(ps[m].children.length===1&&ps[m].scrollHeight>ps[m].clientHeight+2){' +
  '    ps[m].style.height="auto";ps[m].style.minHeight=document.body.getAttribute("data-pageh")||"297mm";' +
  '  }' +
  '}' +
  'decorate();' +
  '}' +
  'var rt=null;' +
  'window.addEventListener("resize",function(){clearTimeout(rt);rt=setTimeout(paginate,120);});' +
  'paginate();' +
  '})();';

/** Assemble a full HTML document shell: hidden block source + paginated page container. */
function docBodyHtml(blocksHtml, extraJs) {
  var s = DB.settings || DEFAULT_SETTINGS;
  var wm = s.watermark ? ' data-watermark="' + esc(s.watermark) + '"' : '';
  var pn = s.showPageNumbers !== false ? '' : ' data-pagenumbers="0"';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(resolveTitle()) + '</title><style>' + docCss() + '</style></head><body' + wm + pn + '>' +
    '<div class="doc-pages" id="pages-wrap"></div>' +
    '<div class="doc-sheet" id="doc-sheet">' + blocksHtml + '</div>' +
    (extraJs ? '<script>' + extraJs + '<\/script>' : '') +
    '<\/body><\/html>';
}

/** Preview document (srcdoc for the sandboxed iframe): selection relay + edit mode + paginator. */
function buildPreviewDoc() {
  return docBodyHtml(blocksToHtml(), SEL_JS + '\n' + EDIT_JS + '\n' + MINI_TOOLBAR_JS + '\n' + PAGINATOR_JS);
}

/** Pagination-only document, used by the offscreen capture iframe for exports. */
function buildPaginationDoc() {
  return docBodyHtml(blocksToHtml(), PAGINATOR_JS);
}

/** Standalone HTML with pre-paginated pages (everything embedded, printable A4). */
function buildStandaloneHtml(pagesHtml) {
  pagesHtml = pagesHtml || ('<div class="doc-page" style="height:auto;min-height:297mm">' + blocksToHtml() + '</div>');
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + esc(resolveTitle()) + '</title>\n<style>\n' + docCss() + '\n</style>\n</head>\n<body>\n<div class="doc-pages">\n' + pagesHtml + '\n</div>\n</body>\n</html>';
}

/** Render the document into a hidden sandboxed iframe, let the paginator split it
 *  into A4 pages, then hand back the pages HTML. Falls back to null if sandboxing
 *  blocks access to the iframe DOM. */
function buildPaginatedHtml(callback) {
  var iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-99999px;top:0;width:900px;height:1400px;border:0;';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  document.body.appendChild(iframe);
  var done = false;
  var pagesHtml = null;
  function finish() {
    if (done) return;
    done = true;
    try {
      var wrap = iframe.contentDocument && iframe.contentDocument.getElementById('pages-wrap');
      if (wrap && wrap.children.length) pagesHtml = wrap.outerHTML;
    } catch (e) { pagesHtml = null; }
    try { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); } catch (e) {}
    callback(pagesHtml);
  }
  setTimeout(finish, 4000);
  try {
    iframe.onload = function () { setTimeout(finish, 400); };
    iframe.srcdoc = buildPaginationDoc();
  } catch (e) { finish(); }
}

function mountPreview() {
  var iframe = el('doc-preview');
  var empty = el('preview-empty');
  if (!iframe) return;
  _previewBuildSeq++;
  iframe.srcdoc = buildPreviewDoc();
  if (empty) empty.classList.toggle('hidden', DB.blocks.length > 0);
  // A remount always starts non-editable
  _editMode = false;
  updateEditToolbar();
}

/* ═══════════════════════════════════════════
   STATE & PERSISTENCE
   ═══════════════════════════════════════════ */
function slimValue() {
  return {
    version: DB.version,
    blocks: DB.blocks,
    variables: DB.variables,
    settings: DB.settings,
    activeSessionId: DB.activeSessionId,
    chatCache: DB.chatCache,
    _instanceId: DB._instanceId,
    comments: DB.comments,
    snippets: DB.snippets,
    status: DB.status,
    statusLog: DB.statusLog,
    history: DB.history
  };
}

function persist() {
  try {
    tool.setValue(slimValue());
    _dirty = true;
    updateStagedChip();
  } catch (e) { console.warn('persist failed', e); }
}

function _bumpVersion(kind) {
  var parts = String(DB.version || '1.0.0').split('.');
  var ma = parseInt(parts[0] || '0', 10);
  var mi = parseInt(parts[1] || '0', 10);
  var pa = parseInt(parts[2] || '0', 10);
  if (kind === 'major') { ma++; mi = 0; pa = 0; }
  else if (kind === 'minor') { mi++; pa = 0; }
  else { pa++; }
  DB.version = ma + '.' + mi + '.' + pa;
  _renderVersion();
}

function _renderVersion() {
  var v = el('tool-version');
  if (v) v.textContent = 'v' + (DB.version || '1.0.0');
}

function updateDocStats() {
  var box = el('doc-stats');
  if (!box) return;
  var words = stripTags(blocksToHtml()).split(/\s+/).filter(Boolean).length;
  var chars = JSON.stringify(DB.blocks).length;
  box.innerHTML = '<b>Title:</b> ' + esc(resolveTitle()) +
    ' &nbsp;·&nbsp; <b>' + DB.blocks.length + '</b> block(s)' +
    ' &nbsp;·&nbsp; <b>~' + words.toLocaleString() + '</b> words' +
    ' &nbsp;·&nbsp; <b>' + (chars / 1024).toFixed(1) + ' KB</b> of block data' +
    ' &nbsp;·&nbsp; version <b>v' + esc(DB.version) + '</b>';
  renderSettingsExtras();
}

/* ═══════════════════════════════════════════
   VARIABLES DRAWER UI
   ═══════════════════════════════════════════ */
function renderVariables() {
  var list = el('var-list');
  if (!list) return;
  var names = Object.keys(DB.variables);
  if (!names.length) {
    list.innerHTML = '<p class="drawer-hint">No variables yet. The AI uses <b>{{variableName}}</b> placeholders for names, dates and amounts — e.g. "This Agreement is between {{partyA}} and {{partyB}}". Click 🔍 Scan to find them, or ➕ Add one manually.</p>';
    return;
  }
  var h = '';
  for (var i = 0; i < names.length; i++) {
    (function (name) {
      var v = DB.variables[name];
      var count = varUsageCount(name);
      h += '<div class="var-row" id="var-row-' + esc(name) + '">' +
        '<input class="var-label" id="var-label-' + esc(name) + '" value="' + esc(v.label || prettifyVarName(name)) + '" title="Display label">' +
        '<input class="var-value" id="var-value-' + esc(name) + '" value="' + esc(v.value || '') + '" placeholder="Value…" title="Value shown everywhere {{' + esc(name) + '}} is used">' +
        '<span class="var-count" title="Occurrences in the document">×' + count + '</span>' +
        '<button class="btn btn-xs btn-danger" id="btn-var-remove-' + esc(name) + '" title="Remove variable">✕</button>' +
        '</div>';
    })(names[i]);
  }
  list.innerHTML = h + '<p class="drawer-hint" style="margin-top:8px">Click a highlighted variable inside the document to edit it here. Setting a value updates the whole document instantly.</p>';
  for (var j = 0; j < names.length; j++) {
    (function (name) {
      var li = el('var-label-' + name);
      if (li) {
        li.addEventListener('change', function () { setVariableLabel(name, li.value); });
      }
      var vi = el('var-value-' + name);
      if (vi) {
        var t = null;
        vi.addEventListener('input', function () {
          clearTimeout(t);
          var val3 = vi.value;
          t = setTimeout(function () { setVariableValue(name, val3); }, 400);
        });
      }
      var rm = el('btn-var-remove-' + name);
      if (rm) {
        rm.addEventListener('click', function () {
          var self = rm;
          confirmClick(self, function () { removeVariable(name); }, 'Remove variable?');
        });
      }
    })(names[j]);
  }
  updateVarBadge();
}

/* ═══════════════════════════════════════════
   OUTLINE DRAWER UI (reorder / duplicate / delete / target)
   ═══════════════════════════════════════════ */
function renderOutline() {
  var list = el('outline-list');
  if (!list) return;
  if (!DB.blocks.length) {
    list.innerHTML = '<p class="drawer-hint">No blocks yet — draft a document first.</p>';
    return;
  }
  var h = '<p class="drawer-hint">Drag rows to reorder blocks. ✏️ targets a block for AI edits, ⧉ duplicates, 🗑 deletes.</p>';
  for (var i = 0; i < DB.blocks.length; i++) {
    var b = DB.blocks[i];
    var icon = (LEGAL_COMPONENTS[b.type] && LEGAL_COMPONENTS[b.type].icon) || '📄';
    var preview = blockPreview(b, 46);
    var cc = commentCount(i);
    h += '<div class="outline-row" draggable="true" data-out-idx="' + i + '">' +
      '<span class="outline-grip" title="Drag to reorder">⠿</span>' +
      '<span class="outline-icon">' + icon + '</span>' +
      '<span class="outline-meta">' + (i + 1) + ' · ' + esc(b.type) + '</span>' +
      '<span class="outline-text">' + esc(preview) + '</span>' +
      '<button class="btn btn-xs btn-ghost" data-out-target="' + i + '" title="Use as AI edit target">✏️</button>' +
      '<button class="btn btn-xs btn-ghost" data-out-dup="' + i + '" title="Duplicate block">⧉</button>' +
      '<button class="btn btn-xs btn-ghost" data-out-snip="' + i + '" title="Save to My Clauses">💾</button>' +
      '<button class="btn btn-xs btn-ghost" data-out-comment="' + i + '" title="Comments">💬' + (cc ? '<b>' + cc + '</b>' : '') + '</button>' +
      '<button class="btn btn-xs btn-ghost" data-out-del="' + i + '" title="Delete block">🗑</button>' +
      '</div>';
  }
  list.innerHTML = h;

  var rows = list.querySelectorAll('.outline-row');
  var dragIdx = null;
  for (var r = 0; r < rows.length; r++) {
    rows[r].addEventListener('dragstart', function (e) {
      dragIdx = parseInt(this.getAttribute('data-out-idx'), 10);
      this.style.opacity = '0.4';
      try { e.dataTransfer.setData('text/plain', String(dragIdx)); } catch (err) {}
    });
    rows[r].addEventListener('dragend', function () { this.style.opacity = ''; });
    rows[r].addEventListener('dragover', function (e) {
      e.preventDefault();
      var to = parseInt(this.getAttribute('data-out-idx'), 10);
      if (dragIdx !== null && to !== dragIdx) {
        moveBlock(dragIdx, to);
        dragIdx = to;
      }
    });
    rows[r].addEventListener('drop', function (e) { e.preventDefault(); });
  }

  var tBtns = list.querySelectorAll('[data-out-target]');
  for (var t = 0; t < tBtns.length; t++) {
    tBtns[t].addEventListener('click', function () {
      var idx = parseInt(this.getAttribute('data-out-target'), 10);
      var b2 = DB.blocks[idx];
      if (!b2) return;
      setSelectionTarget({ idx: idx, type: b2.type, text: blockPreview(b2, 120) });
      showToast('🎯 Block #' + (idx + 1) + ' targeted — the next AI request edits only this block.', 'info');
    });
  }
  var dBtns = list.querySelectorAll('[data-out-dup]');
  for (var d = 0; d < dBtns.length; d++) {
    dBtns[d].addEventListener('click', function () {
      duplicateBlock(parseInt(this.getAttribute('data-out-dup'), 10));
    });
  }
  var sBtns = list.querySelectorAll('[data-out-snip]');
  for (var s = 0; s < sBtns.length; s++) {
    sBtns[s].addEventListener('click', function () {
      saveBlockAsSnippet(parseInt(this.getAttribute('data-out-snip'), 10));
    });
  }
  var cBtns = list.querySelectorAll('[data-out-comment]');
  for (var cb = 0; cb < cBtns.length; cb++) {
    cBtns[cb].addEventListener('click', function () {
      var idx = parseInt(this.getAttribute('data-out-comment'), 10);
      renderCommentPanel(idx);
      var inp = el('comment-input');
      if (inp) inp.focus();
    });
  }
  var delBtns = list.querySelectorAll('[data-out-del]');
  for (var x = 0; x < delBtns.length; x++) {
    delBtns[x].addEventListener('click', function () {
      var idx = parseInt(this.getAttribute('data-out-del'), 10);
      var self = this;
      confirmClick(self, function () { deleteBlockAt(idx); }, 'Delete block?');
    });
  }
}

/* ═══════════════════════════════════════════
   SETTINGS DRAWER EXTRAS (import, lint, readability, size, options)
   ═══════════════════════════════════════════ */
function renderSettingsExtras() {
  updateSizeMeter();
  var lint = runLint();
  var lintBox = el('lint-list');
  if (lintBox) {
    if (!lint.length) {
      lintBox.innerHTML = '<p class="gen-hint">✅ No issues found.</p>';
    } else {
      var lh = '';
      for (var i = 0; i < Math.min(lint.length, 8); i++) {
        lh += '<div class="lint-item"><span class="lint-idx">#' + (lint[i].idx + 1) + '</span> ' + esc(lint[i].issue) + '</div>';
      }
      if (lint.length > 8) lh += '<div class="lint-item">… and ' + (lint.length - 8) + ' more</div>';
      lintBox.innerHTML = lh;
    }
  }
  var lintBtn = el('btn-lint-fix');
  if (lintBtn) lintBtn.style.display = lint.length ? '' : 'none';
  var read = runReadability();
  var readBox = el('readability-list');
  if (readBox) {
    if (read.avg === null) {
      readBox.innerHTML = '<p class="gen-hint">No scored paragraphs yet.</p>';
    } else {
      var rh = '<p class="gen-hint"><b>' + read.avg + '</b> avg Flesch score (higher = easier to read).</p>';
      for (var j = 0; j < read.hardest.length; j++) {
        rh += '<div class="lint-item"><span class="lint-idx">#' + (read.hardest[j].idx + 1) + '</span> score ' + read.hardest[j].score + ' — ' + esc(read.hardest[j].preview) +
          ' <button class="btn btn-xs btn-ghost" data-read-fix="' + read.hardest[j].idx + '">Simplify</button></div>';
      }
      readBox.innerHTML = rh;
    }
  }
  var readBtns = document.querySelectorAll('[data-read-fix]');
  for (var rb = 0; rb < readBtns.length; rb++) {
    readBtns[rb].addEventListener('click', function () {
      var idx = parseInt(this.getAttribute('data-read-fix'), 10);
      setSelectionTarget({ idx: idx, type: (DB.blocks[idx] || {}).type || '', text: blockPreview(DB.blocks[idx], 120) });
      sendPreset('Rewrite block #' + (idx + 1) + ' in simpler, clearer plain language while keeping its legal meaning.');
    });
  }
  var ph = runPlaceholderScan();
  var phBox = el('placeholder-chip');
  if (phBox) {
    phBox.style.display = ph.length ? '' : 'none';
    phBox.textContent = '⚠ ' + ph.length + ' placeholder' + (ph.length === 1 ? '' : 's');
  }
}

function lintFixWithAi() {
  var lint = runLint();
  if (!lint.length) { showToast('No issues to fix.', 'info'); return; }
  var parts = [];
  for (var i = 0; i < Math.min(lint.length, 10); i++) parts.push('#' + (lint[i].idx + 1) + ': ' + lint[i].issue);
  sendPreset('Fix these quality issues in the document:\n' + parts.join('\n'));
}

function renderPageOptions() {
  var ps = el('page-size-select');
  if (ps) ps.value = (DB.settings.pageSize || 'A4');
  var pn = el('page-numbers-check');
  if (pn) pn.checked = DB.settings.showPageNumbers !== false;
  var wm = el('watermark-select');
  if (wm) wm.value = DB.settings.watermark || '';
  var mg = el('docx-margins');
  if (mg) mg.value = String(DB.settings.docxMargins || 'normal');
  var cv = el('docx-cover');
  if (cv) cv.checked = !!DB.settings.docxCover;
}

function applyPageOption(key, value) {
  if (!DB.settings[key] && value !== false && value !== '') { /* nothing */ }
  if (String(DB.settings[key]) === String(value)) return;
  DB.settings[key] = value;
  persist();
  mountPreview();
  showToast('⚙️ Page option updated.', 'info');
}

/* ═══════════════════════════════════════════
   TOASTS
   ═══════════════════════════════════════════ */
function showToast(msg, type) {
  try { tool.notify(msg, type || 'info'); } catch (e) {}
  var stack = el('toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    stack.id = 'toast-stack';
    document.body.appendChild(stack);
  }
  var t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  stack.appendChild(t);
  setTimeout(function () {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
  }, 4200);
}

/* ═══════════════════════════════════════════
   CHAT SESSIONS (ai-chat-sessions-uniconbaseapps)
   ═══════════════════════════════════════════ */
function _warnSessionStorage(msg) {
  if (_sessionWarnShown) return;
  _sessionWarnShown = true;
  console.warn('[LEGALDOC:SESSION] ' + msg);
  showToast('⚠ Chat history storage unavailable — messages are cached inside the record until fixed. Check allowObjectCRUD: yes and the ai-chat-sessions-uniconbaseapps object type in field settings.', 'warning');
}

function _instanceId() {
  if (DB._instanceId) return DB._instanceId;
  return 'legaldoc_unknown';
}

function canUseSessions() {
  return typeof tool.requestObjects === 'function';
}

function loadSessions(callback) {
  if (!canUseSessions()) {
    _warnSessionStorage('requestObjects unavailable');
    _sessions = [];
    _sessionsLoaded = true;
    if (callback) callback([]);
    return;
  }
  try {
    tool.requestObjects('query', { mainObjectType: SESSION_TYPE }, function (err, result) {
      if (err) { _warnSessionStorage('query error: ' + err); _sessions = []; }
      else {
        var all = (result && result.objects) ? result.objects : [];
        var myId = _instanceId();
        _sessions = [];
        for (var i = 0; i < all.length; i++) {
          var obj = all[i];
          var pd = obj.productData || {};
          var dcb = pd.data_categoriesBased || {};
          if (dcb._toolInstanceId === myId ||
              (myId !== 'legaldoc_unknown' && dcb._toolInstanceId && String(dcb._toolInstanceId).indexOf(myId) === 0)) {
            _sessions.push(obj);
          }
        }
      }
      _sessionsLoaded = true;
      if (callback) callback(_sessions);
    });
  } catch (e) {
    _warnSessionStorage('query threw: ' + e.message);
    _sessions = [];
    _sessionsLoaded = true;
    if (callback) callback([]);
  }
}

function createSession(callback) {
  if (!canUseSessions()) { if (callback) callback(null); return; }
  var user = getUserSafe() || {};
  try {
    tool.requestObjects('create', {
      mainObjectType: SESSION_TYPE,
      name: resolveTitle(),
      productData: {
        data_categoriesBased: {
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: { userId: user.id || 'anon', userName: user.name || 'Anonymous' },
          _toolInstanceId: _instanceId()
        }
      }
    }, function (err, result) {
      if (err) { _warnSessionStorage('create error: ' + err); if (callback) callback(null); return; }
      var session = result.object;
      if (session._parentObjectId && !DB._instanceId) {
        DB._instanceId = 'legaldoc_' + session._parentObjectId;
        persist();
      }
      _sessions.unshift(session);
      if (callback) callback(session);
    });
  } catch (e) {
    _warnSessionStorage('create threw: ' + e.message);
    if (callback) callback(null);
  }
}

function saveCurrentSession(callback) {
  if (!DB.activeSessionId || !canUseSessions()) { if (callback) callback(null); return; }
  try {
    var session = null;
    for (var i = 0; i < _sessions.length; i++) {
      if (_sessions[i].id === DB.activeSessionId) { session = _sessions[i]; break; }
    }
    // Session object not available yet (still being created) — skip to avoid
    // overwriting _toolInstanceId with an incomplete merge.
    if (!session) { if (callback) callback(null); return; }
    var oldDcb = (session && session.productData && session.productData.data_categoriesBased) ? session.productData.data_categoriesBased : {};
    var dcb = {};
    for (var k in oldDcb) { if (Object.prototype.hasOwnProperty.call(oldDcb, k)) dcb[k] = oldDcb[k]; }
    dcb.messages = _chatMessages.slice();
    dcb.updatedAt = new Date().toISOString();
    tool.requestObjects('update', {
      mainObjectType: SESSION_TYPE,
      objectId: DB.activeSessionId,
      productData: { data_categoriesBased: dcb }
    }, function (err) {
      if (err) _warnSessionStorage('save error: ' + err);
      if (callback) callback(err ? null : true);
    });
  } catch (e) {
    _warnSessionStorage('save threw: ' + e.message);
    if (callback) callback(null);
  }
}

function restoreActiveSessionMessages() {
  if (!DB.activeSessionId) return false;
  var session = null;
  for (var i = 0; i < _sessions.length; i++) {
    if (_sessions[i].id === DB.activeSessionId) { session = _sessions[i]; break; }
  }
  if (session) {
    var pd = session.productData || {};
    var dcb = pd.data_categoriesBased || {};
    var msgs = (dcb.messages && dcb.messages.length) ? dcb.messages : null;
    if (msgs) { _chatMessages = msgs; return true; }
  }
  // Session missing or empty — fall back to the bounded cache
  if (DB.chatCache && DB.chatCache.sessionId === DB.activeSessionId && DB.chatCache.messages && DB.chatCache.messages.length) {
    _chatMessages = DB.chatCache.messages.slice();
    return true;
  }
  _chatMessages = [];
  return false;
}

function updateChatCache() {
  var msgs = [];
  for (var i = Math.max(0, _chatMessages.length - 30); i < _chatMessages.length; i++) {
    var m = _chatMessages[i];
    var text = String(m.text || '');
    if (text.length > 2000) text = text.substring(0, 2000);
    msgs.push({ role: m.role, text: text, time: m.time });
  }
  DB.chatCache = { sessionId: DB.activeSessionId || '', messages: msgs };
}

function ensureSession(callback) {
  if (DB.activeSessionId) { if (callback) callback(); return; }
  if (!_sessionsLoaded) { if (callback) callback(); return; }
  createSession(function (newSession) {
    if (newSession) {
      DB.activeSessionId = newSession.id;
      persist();
    }
    if (callback) callback();
  });
}

function getUserSafe() {
  try { return tool.getUser(); } catch (e) { return null; }
}

/* ═══════════════════════════════════════════
   CHAT UI
   ═══════════════════════════════════════════ */
var QUICK_PROMPTS = [
  ['🔒 NDA', 'Draft a Non-Disclosure Agreement between {{disclosingParty}} and {{receivingParty}} with a 5-year confidentiality term'],
  ['🤝 Service Agreement', 'Draft a Service Agreement between {{serviceProvider}} and {{client}}, with payment terms, termination and liability clauses'],
  ['💼 Employment Contract', 'Draft an Employment Contract for a full-time employee {{employeeName}} at {{companyName}}, with a probation period and notice terms'],
  ['🏠 Lease Agreement', 'Draft a Residential Lease Agreement for {{tenantName}} and {{landlordName}}, 12 months, starting {{leaseStartDate}}'],
  ['🖋 Power of Attorney', 'Draft a General Power of Attorney for {{principalName}} appointing {{attorneyName}}'],
  ['🌐 Terms & Conditions', 'Draft Terms & Conditions for a website selling digital products, operated by {{companyName}}']
];

function welcomeHtml() {
  var h = '<div class="chat-welcome"><div class="chat-welcome-icon">⚖️</div>' +
    '<h3>Draft a legal document</h3>' +
    '<p>Describe what you need — <b>an NDA, a service agreement, an employment contract, a lease…</b> — and I\u2019ll draft it in Word-document format, section by section.</p>' +
    '<div class="welcome-prompts">';
  for (var i = 0; i < QUICK_PROMPTS.length; i++) {
    h += '<button class="btn btn-outline btn-sm" data-quick="' + i + '" title="' + esc(QUICK_PROMPTS[i][1]) + '">' + esc(QUICK_PROMPTS[i][0]) + '</button>';
  }
  h += '</div>' +
    '<div class="welcome-actions"><button class="btn btn-primary btn-sm" data-guided="1">🪄 Guided interview</button></div>' +
    '<p class="welcome-tip">💡 <b>Tips:</b> parties and dates become <b>fillable variables</b> you edit in the 🔤 Variables panel. Select text in the document to target AI edits. Press ✏️ Edit to type directly.</p></div>';
  return h;
}

function bindWelcomeActions() {
  var box = el('chat-messages');
  if (!box) return;
  var g = box.querySelector('[data-guided]');
  if (g) {
    g.addEventListener('click', function () {
      sendPreset('🪄 Guided interview: please interview me step by step about this document — its type, the parties, key dates, amounts and special terms. Ask ONE question at a time with short option answers, and when you have 4+ answers, draft the complete document.');
    });
  }
}

function renderChatMessages() {
  var box = el('chat-messages');
  if (!box) return;
  if (!_chatMessages || !_chatMessages.length) {
    box.innerHTML = welcomeHtml();
    bindWelcomeActions();
    var qb = box.querySelectorAll('[data-quick]');
    for (var q = 0; q < qb.length; q++) {
      qb[q].addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-quick'), 10);
        var p = QUICK_PROMPTS[idx];
        if (!p) return;
        sendPreset(p[1]);
      });
    }
    return;
  }
  var h = '';
  for (var i = 0; i < _chatMessages.length; i++) {
    var m = _chatMessages[i];
    var time = shortTime(m.time);
    if (m.role === 'user') {
      h += '<div class="chat-msg user"><div class="chat-avatar">👤</div>' +
        '<div><div class="chat-bubble">' + markdownLite(m.text) + '</div>' +
        '<div class="chat-msg-time">' + time + '</div></div></div>';
    } else {
      h += '<div class="chat-msg ai' + (m.isError ? ' err' : '') + '">' +
        '<div class="chat-avatar">⚖️</div>' +
        '<div><div class="chat-bubble">' + markdownLite(m.text) + '</div>';
      if (m.version) h += '<span class="chat-version-chip">✓ document v' + esc(m.version) + '</span>';
      if (m.variants && m.variants.length) {
        h += '<div class="chat-options"><span class="chat-options-label">🎛 Pick a variant:</span>';
        for (var vi = 0; vi < m.variants.length; vi++) {
          h += '<button class="chat-option-btn chat-variant-btn" data-variant-i="' + vi + '" data-msg-i="' + i + '">' + esc(m.variants[vi].label || ('Option ' + (vi + 1))) + '</button>';
        }
        h += '</div>';
      }
      if (m.opts && m.opts.length) h += optionsHtml(m.opts);
      h += '<div class="chat-msg-time">' + time + '</div></div></div>';
    }
  }
  box.innerHTML = h;
  scrollChatToBottom();
}

function optionsHtml(opts) {
  var h = '<div class="chat-options">';
  for (var i = 0; i < opts.length; i++) {
    h += '<button class="chat-option-btn" data-opt-text="' + esc(opts[i].text) + '">➜ ' + esc(opts[i].text) + '</button>';
  }
  h += '</div>';
  return h;
}

function bindOptionButtons() {
  var box = el('chat-messages');
  if (!box) return;
  // Variant chips (A6): apply the chosen wording to the document
  var vbtns = box.querySelectorAll('.chat-variant-btn');
  for (var v = 0; v < vbtns.length; v++) {
    vbtns[v].addEventListener('click', function () {
      var mi = parseInt(this.getAttribute('data-msg-i'), 10);
      var vi = parseInt(this.getAttribute('data-variant-i'), 10);
      var msg = _chatMessages[mi];
      if (!msg || !msg.variants || !msg.variants[vi]) return;
      var parent = this.parentNode;
      if (parent) {
        var allV = parent.querySelectorAll('.chat-variant-btn');
        for (var av = 0; av < allV.length; av++) { allV[av].classList.add('chat-option-used'); allV[av].disabled = true; }
      }
      applyVariant(msg.variants[vi]);
    });
  }
  var btns = box.querySelectorAll('.chat-option-btn:not(.chat-variant-btn)');
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', function () {
      var text = this.getAttribute('data-opt-text');
      if (this.classList.contains('chat-option-used')) return;
      var parent = this.parentNode;
      if (parent) {
        var allBtns = parent.querySelectorAll('.chat-option-btn');
        for (var j = 0; j < allBtns.length; j++) {
          allBtns[j].classList.add('chat-option-used');
          allBtns[j].disabled = true;
        }
      }
      sendPreset(text);
    });
  }
}

function scrollChatToBottom() {
  var box = el('chat-messages');
  if (box) box.scrollTop = box.scrollHeight;
}

function addChatMessage(role, text, extra) {
  extra = extra || {};
  _chatMessages.push({
    role: role,
    text: text,
    time: new Date().toISOString(),
    opts: extra.opts || null,
    version: extra.version || null,
    variants: extra.variants || null,
    isError: extra.isError || false
  });
  updateChatCache();
  renderChatMessages();
  bindOptionButtons();
  scrollChatToBottom();
  saveCurrentSession();
  if (!DB.activeSessionId) persist();
}

function sendPreset(text) {
  var input = el('chat-input');
  if (!input) return;
  input.value = text;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  sendChatMessage();
}

/* ── Thinking bubble ── */
function showThinkingBubble(label) {
  hideThinkingBubble();
  var container = el('chat-messages');
  if (!container) return;
  _thinkingStartTime = Date.now();
  _lastTokenAt = 0;

  var bubble = document.createElement('div');
  bubble.className = 'chat-msg ai';
  bubble.id = 'thinking-bubble';
  bubble.innerHTML =
    '<div class="chat-avatar">⚖️</div>' +
    '<div class="think-bubble">' +
      '<div class="think-header" id="think-hdr" style="cursor:pointer">' +
        '<span class="think-icon">⏳</span>' +
        '<span class="chat-thinking-dots"><span></span><span></span><span></span></span>' +
        '<span class="think-label" id="think-label">' + esc(label || 'AI is drafting…') + '</span>' +
        '<span class="think-time" id="think-time">0:00</span>' +
        '<span class="think-toggle" id="think-toggle">▶</span>' +
        '<button class="think-cancel" id="think-cancel" title="Stop" style="display:none">⏹ Stop</button>' +
      '</div>' +
      '<div class="think-body" id="think-body" style="display:none">' +
        '<div class="think-stream-label">Generating…</div><div class="think-stream" id="think-stream"></div>' +
      '</div>' +
    '</div>';
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  _thinkingMsgEl = bubble;

  var hdr = bubble.querySelector('#think-hdr');
  var bodyEl = bubble.querySelector('#think-body');
  var toggleEl = bubble.querySelector('#think-toggle');
  hdr.onclick = function () {
    if (!bodyEl || !toggleEl) return;
    var isOpen = bodyEl.style.display !== 'none';
    bodyEl.style.display = isOpen ? 'none' : 'block';
    toggleEl.textContent = isOpen ? '▶' : '▼';
    container.scrollTop = container.scrollHeight;
  };

  var firstToken = true;
  _streamCallback = function (token) {
    if (firstToken) {
      if (bodyEl) bodyEl.style.display = 'block';
      if (toggleEl) toggleEl.textContent = '▼';
      var sl = bubble.querySelector('.think-stream-label');
      if (sl) sl.style.display = 'none';
      firstToken = false;
    }
    appendStreamToken(token);
  };

  var cancelBtn = bubble.querySelector('#think-cancel');
  if (cancelBtn) {
    setTimeout(function () { if (_thinkingMsgEl === bubble && cancelBtn) cancelBtn.style.display = ''; }, 5000);
    cancelBtn.onclick = function (e) { e.stopPropagation(); cancelAiRequest(); };
  }

  var dots = 0;
  _thinkingTimer = setInterval(function () {
    dots = (dots + 1) % 4;
    var lbl = bubble.querySelector('#think-label');
    var elapsed = Math.floor((Date.now() - _thinkingStartTime) / 1000);
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    var timeStr = mins + ':' + (secs < 10 ? '0' : '') + secs;
    if (lbl) {
      if (_lastTokenAt > _thinkingStartTime) {
        var idleSec = Math.floor((Date.now() - _lastTokenAt) / 1000);
        lbl.textContent = idleSec < 2 ? 'AI is drafting…' + Array(dots + 1).join('.') : 'AI is drafting… (last token ' + idleSec + 's ago)';
      } else if (elapsed > 60) {
        lbl.textContent = 'Waiting for the first token… ' + timeStr + ' (large prompts take longer)';
      } else if (elapsed > 20) {
        lbl.textContent = 'Waiting for the first token… ' + timeStr;
      } else {
        lbl.textContent = (label || 'AI is drafting…') + Array(dots + 1).join('.');
      }
    }
    var timeEl = bubble.querySelector('#think-time');
    if (timeEl) timeEl.textContent = timeStr;
  }, 500);
}

function appendStreamToken(token) {
  if (!_thinkingMsgEl) return;
  var stream = _thinkingMsgEl.querySelector('#think-stream');
  if (stream) {
    var t = stream.textContent + token;
    if (t.length > 8000) t = t.slice(-8000);
    stream.textContent = t;
    stream.scrollTop = stream.scrollHeight;
    var container = el('chat-messages');
    if (container) {
      var dist = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (dist < 80) container.scrollTop = container.scrollHeight;
    }
  }
}

function hideThinkingBubble() {
  if (_thinkingTimer) { clearInterval(_thinkingTimer); _thinkingTimer = null; }
  if (_thinkingMsgEl) {
    var el2 = _thinkingMsgEl;
    _thinkingMsgEl = null;
    setTimeout(function () { if (el2.parentNode) el2.parentNode.removeChild(el2); }, 200);
  }
  _streamCallback = null;
}

function _markThinkingComplete(elapsedMs) {
  if (_thinkingTimer) { clearInterval(_thinkingTimer); _thinkingTimer = null; }
  if (!_thinkingMsgEl) return;
  var bubble = _thinkingMsgEl;
  var label = bubble.querySelector('#think-label');
  var dots = bubble.querySelector('.chat-thinking-dots');
  var icon = bubble.querySelector('.think-icon');
  var cancel = bubble.querySelector('#think-cancel');
  var timeEl = bubble.querySelector('#think-time');
  if (label) label.textContent = '✓ Complete in ' + (elapsedMs / 1000).toFixed(1) + 's';
  if (dots) dots.style.display = 'none';
  if (icon) icon.textContent = '✅';
  if (cancel) cancel.style.display = 'none';
  var secs = Math.floor(elapsedMs / 1000);
  var mins = Math.floor(secs / 60);
  if (timeEl) timeEl.textContent = mins + ':' + (secs % 60 < 10 ? '0' : '') + (secs % 60);
  _thinkingMsgEl = null;
}

/* ── AI lifecycle ── */
function updateConnStatus(state) {
  var dot = el('chat-conn-status');
  if (!dot) return;
  dot.className = 'chat-status-dot' + (state === 'ok' ? ' ok' : state === 'busy' ? ' busy' : state === 'error' ? ' error' : '');
}

function _setAiUIActive(active) {
  var send = el('btn-chat-send');
  if (send) { send.disabled = active; send.style.opacity = active ? '0.4' : ''; }
  var stop = el('btn-chat-stop');
  if (stop) stop.style.display = active ? '' : 'none';
  var input = el('chat-input');
  if (input) { input.disabled = active; input.style.opacity = active ? '0.5' : ''; }
}

function setAiTimeout(promptLen) {
  clearAiTimeout();
  _aiTimeoutId = setTimeout(function () {
    console.warn('[LEGALDOC:TIMEOUT] AI request timed out after 600 seconds');
    _aiCallActive = false;
    _markThinkingComplete(600000);
    _setAiUIActive(false);
    updateConnStatus('error');
    addChatMessage('ai', '⏰ **AI request timed out after 600 seconds.**\n\nPossible causes: the AI gateway or model is overloaded, the prompt is too large (' + promptLen.toLocaleString() + ' chars), or a network issue.\n\n🔧 Try sending again or simplifying your request.', { isError: true });
    tool.resize();
  }, 605000);
}

function clearAiTimeout() {
  if (_aiTimeoutId) { clearTimeout(_aiTimeoutId); _aiTimeoutId = null; }
}

function cancelAiRequest() {
  if (_reqToken) _reqToken.cancelled = true;
  _aiCallActive = false;
  clearAiTimeout();
  hideThinkingBubble();
  _setAiUIActive(false);
  updateConnStatus('ok');
  addChatMessage('ai', '⏹ **Drafting stopped.** You can send another message to continue.');
  tool.resize();
}

/* ═══════════════════════════════════════════
   AI PROMPT & RESPONSE HANDLING
   ═══════════════════════════════════════════ */
function catalogText() {
  var lines = [];
  for (var k in LEGAL_COMPONENTS) {
    if (!Object.prototype.hasOwnProperty.call(LEGAL_COMPONENTS, k)) continue;
    var c = LEGAL_COMPONENTS[k];
    lines.push('- "' + k + '": ' + c.name + ' — ' + c.desc + ' | data fields: ' + c.schema);
  }
  return lines.join('\n');
}

function blockPreview(b, maxLen) {
  try {
    var s = stripTags(b.type === 'html' ? (b.data && b.data.html) || '' : '');
    if (!s) s = JSON.stringify(b.data || {});
    s = s.substring(0, maxLen || 140);
    return s;
  } catch (e) { return ''; }
}

function buildChatPrompt(userMsg) {
  var parts = [];
  parts.push('You are an expert legal document drafting assistant inside the "Legal Document Builder" tool. You draft professionally formatted legal documents (agreements, contracts, policies, deeds, letters) and refine them through chat.');
  parts.push('The document is a list of BLOCKS. Each block is rendered by the tool from its "type" and "data".');
  parts.push('');
  parts.push('=== COMPONENT LIBRARY (use these block types) ===');
  parts.push(catalogText());
  parts.push('');
  parts.push('=== RULES FOR BLOCK DATA ===');
  parts.push('- "html" is a free-form block: put any HTML/CSS/JS inside data.html. It must be fully self-contained (inline styles or embedded style/script tags allowed).');
  parts.push('- Every other component: text fields contain PLAIN TEXT only (never HTML markup) — the tool escapes and renders them.');
  parts.push('- Use the pre-built boilerplate components (confidentiality, termination, indemnity, force-majeure, dispute-resolution, governing-law, entire-agreement, severability, waiver, assignment, counterparts, amendment…) for standard clauses; adjust them via their data fields.');
  parts.push('- Typical document flow: title → parties → recitals → agreement-word → definitions → numbered sections (section + clause/sub-clauses) → boilerplate clauses → execution-paragraph → signature-block. Keep section numbers consistent (1., 2., …).');
  parts.push('- Draft in the same language the user writes in.');
  parts.push('- Legal drafting quality: plain language, defined terms, complete sentences, no placeholders unless bracketed [like this].');
  parts.push('');
  parts.push('=== DYNAMIC VARIABLES (IMPORTANT) ===');
  parts.push('For fields that are likely to change (party names, addresses, dates, amounts), write {{variableName}} inside the block text INSTEAD of a hardcoded value. Examples: "between {{partyA}} and {{partyB}}", "as of {{effectiveDate}}".');
  parts.push('The tool renders these as fillable fields with a form — the user edits them once and the whole document updates.');
  parts.push('- Use lowercase camelCase names: partyA, partyB, effectiveDate, contractAmount, landlord, tenant…');
  parts.push('- You may include "variables": {"partyA": "Alpha LLC", "effectiveDate": "1 January 2026"} in the JSON op to pre-fill values.');
  parts.push('- Never put variables in section/subsection numbers.');
  var trb = typeRulesBlock();
  if (trb) { parts.push(''); parts.push(trb); }

  if (DB.blocks.length === 0) {
    parts.push('');
    parts.push('=== DOCUMENT STATE ===');
    parts.push('The document is EMPTY. The user wants to create a new document.');
  } else {
    parts.push('');
    parts.push('=== DOCUMENT STATE ===');
    parts.push('Title: ' + resolveTitle());
    var list = [];
    for (var i = 0; i < DB.blocks.length; i++) {
      var b = DB.blocks[i];
      list.push('#' + i + ' (' + b.type + '): ' + blockPreview(b, 120));
    }
    parts.push(list.join('\n'));
    var json = JSON.stringify(DB.blocks);
    if (json.length > 40000) json = json.substring(0, 40000) + ' … (truncated)';
    parts.push('');
    parts.push('=== CURRENT BLOCKS JSON ===');
    parts.push(json);
  }

  var targeted = _selTarget && _selTarget.idx >= 0 && _selTarget.idx < DB.blocks.length;
  if (targeted) {
    var tb = DB.blocks[_selTarget.idx];
    parts.push('');
    parts.push('=== TARGETED EDIT — the user SELECTED text inside block #' + _selTarget.idx + ' (' + tb.type + ') ===');
    parts.push('Selected text: "' + _selTarget.text.substring(0, 1200) + '"');
    parts.push('Full block data: ' + JSON.stringify(tb));
    parts.push('CRITICAL: The user wants changes ONLY in this part of the document. You MUST respond with a single replaceBlock operation for block #' + _selTarget.idx + ' and you MUST NOT touch any other block.');
  }

  parts.push('');
  parts.push('=== USER REQUEST ===');
  var isQuestion = /[?؟]\s*$/.test(String(userMsg).trim()) && !/[?!]\s*(add|insert|change|rewrite|draft|delete|remove|replace|update|fix|make|create|add|put|include)/i.test(userMsg);
  if (isQuestion) {
    parts.push('=== QUESTION MODE ===');
    parts.push('This is a QUESTION about the document. Answer ONLY from the document content shown above, citing the relevant block numbers (e.g. "block #3 (clause)") and section names. Do NOT output JSON and do NOT change the document.');
  }
  parts.push(userMsg);
  parts.push('');
  parts.push('=== OUTPUT CONTRACT ===');
  parts.push('1) If the user asks a QUESTION only (no document change needed): answer in plain chat text, no JSON.');
  parts.push('2) To change the document, output exactly ONE JSON object in one of these shapes:');
  if (targeted) {
    parts.push('   {"replaceBlock":' + _selTarget.idx + ',"block":{"type":"...","data":{...}}} — the ONLY allowed operation for this message (targeted edit).');
  } else if (DB.blocks.length === 0) {
    parts.push('   {"blocks":[{"type":"...","data":{...}}, ...]} — the COMPLETE new document, ordered top to bottom.');
  } else {
    parts.push('   {"replaceBlock":<index>,"block":{...}} — replace one existing block.');
    parts.push('   {"insertAfter":<index>,"block":{...}} — insert a new block after index (use -1 to insert at the top, or the last index for the end).');
    parts.push('   {"deleteBlock":<index>} — remove one block.');
    parts.push('   {"blocks":[...]} — ONLY when the user asks for a full rewrite or reformat of the entire document.');
  }
  parts.push('3) After the JSON (outside it), write a 1-2 sentence plain-language summary of what changed, then 2-4 next-step suggestions, each on its own line starting with [[suggest_xxx]] e.g. [[suggest_signatures]] Add signature blocks for both parties.');
  parts.push('4) The JSON must be valid JSON (double quotes, no trailing commas, no comments) and must NOT be wrapped in markdown fences.');
  parts.push('5) Block types MUST be from the catalog above (or "html"). Unknown types are discarded.');
  parts.push('6) VARIANTS: when the user asks for options / alternatives (e.g. "give me 3 versions of this clause"), output ONE JSON object of the shape {"variants":[{"label":"Strict","replaceBlock":<index>,"block":{...}},{"label":"Balanced","replaceBlock":<index>,"block":{...}}]} — each variant is itself a full operation. Do NOT apply any of them; the user picks one in the chat.');
  return parts.join('\n');
}

/** Extract the first balanced JSON object from text. */
function _extractJson(text) {
  var s = text.indexOf('{');
  if (s === -1) return null;
  var depth = 0;
  var inStr = false;
  var esc2 = false;
  for (var i = s; i < text.length; i++) {
    var ch = text.charAt(i);
    if (inStr) {
      if (esc2) esc2 = false;
      else if (ch === '\\') esc2 = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.substring(s, i + 1);
    }
  }
  return null;
}

function _looksLikeDocOp(op) {
  if (!op || typeof op !== 'object') return false;
  if (Array.isArray(op.blocks)) return true;
  if (op.replaceBlock !== undefined && op.block) return true;
  if (op.insertAfter !== undefined && op.block) return true;
  if (op.deleteBlock !== undefined) return true;
  return false;
}

function sanitizeBlock(b) {
  if (!b || typeof b !== 'object') return null;
  var type = String(b.type || '').toLowerCase();
  if (type !== 'html' && !LEGAL_COMPONENTS[type]) return null;
  var data = (b.data && typeof b.data === 'object' && !Array.isArray(b.data)) ? b.data : {};
  return { type: type, data: data };
}

function sanitizeBlocks(arr) {
  var out = [];
  if (!Array.isArray(arr)) return out;
  for (var i = 0; i < arr.length; i++) {
    var sb = sanitizeBlock(arr[i]);
    if (sb) out.push(sb);
  }
  return out;
}

function parseAiResponse(raw) {
  var text = String(raw || '').replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  var suggests = [];
  text = text.replace(/\[\[suggest_(\w+)\]\][ \t]*(.*)/gi, function (m, id, desc) {
    var d = desc.trim();
    if (d) suggests.push({ id: id, text: d });
    return '';
  });
  var jsonStr = _extractJson(text);
  var op = null;
  if (jsonStr) {
    try { op = JSON.parse(jsonStr); } catch (e) { op = null; }
  }
  var variants = null;
  if (op && Array.isArray(op.variants) && !_looksLikeDocOp(op)) {
    // Variant response: {"variants":[{"label":"Strict", "op":{...}} | {"label":"...","replaceBlock":...}]}
    variants = [];
    for (var vi = 0; vi < op.variants.length; vi++) {
      var v = op.variants[vi];
      if (!v || typeof v !== 'object') continue;
      var vop = v.op || v;
      if (_looksLikeDocOp(vop)) variants.push({ label: String(v.label || ('Option ' + (vi + 1))), op: vop });
    }
    op = variants.length ? null : op;
  }
  if (op && !_looksLikeDocOp(op)) op = null;
  var summary = text;
  if (jsonStr) {
    var ji = text.indexOf(jsonStr);
    summary = text.substring(0, ji) + ' ' + text.substring(ji + jsonStr.length);
  }
  summary = summary.replace(/\n{3,}/g, '\n\n').trim();
  if (summary.length > 800) summary = summary.substring(0, 800) + '…';
  return { op: op, variants: variants, summary: summary, suggests: suggests };
}

/** Apply an AI document operation. Returns true if the document changed. */
function applyAiOp(op) {
  if (!op) return false;
  var changed = false;
  if (Array.isArray(op.blocks)) {
    DB.blocks = sanitizeBlocks(op.blocks);
    changed = true;
  } else if (op.replaceBlock !== undefined && op.block) {
    var ri = parseInt(op.replaceBlock, 10);
    var rb = sanitizeBlock(op.block);
    if (!isNaN(ri) && ri >= 0 && ri < DB.blocks.length && rb) {
      DB.blocks[ri] = rb;
      changed = true;
    }
  } else if (op.insertAfter !== undefined && op.block) {
    var ii = parseInt(op.insertAfter, 10);
    var ib = sanitizeBlock(op.block);
    if (ib && !isNaN(ii)) {
      var at = Math.max(-1, Math.min(ii, DB.blocks.length - 1)) + 1;
      DB.blocks.splice(at, 0, ib);
      changed = true;
    }
  } else if (op.deleteBlock !== undefined) {
    var di = parseInt(op.deleteBlock, 10);
    if (!isNaN(di) && di >= 0 && di < DB.blocks.length) {
      DB.blocks.splice(di, 1);
      changed = true;
    }
  }
  // Merge any variables the AI declared
  if (op.variables && typeof op.variables === 'object' && !Array.isArray(op.variables)) {
    for (var vk in op.variables) {
      if (!Object.prototype.hasOwnProperty.call(op.variables, vk)) continue;
      var vv = op.variables[vk];
      var entry = (typeof vv === 'string') ? { value: vv } : vv;
      if (!entry || typeof entry !== 'object') continue;
      if (!DB.variables[vk]) DB.variables[vk] = { label: prettifyVarName(vk), value: '' };
      if (entry.label) DB.variables[vk].label = String(entry.label);
      if (entry.value !== undefined) DB.variables[vk].value = String(entry.value);
    }
  }
  if (changed) {
    scanBlocksForVars();
    updateVarBadge();
  }
  return changed;
}

/* ── Send / stream ── */
function sendChatMessage() {
  var input = el('chat-input');
  if (!input) return;
  if (_aiCallActive) { showToast('AI is already drafting. Wait or press Stop.', 'warning'); return; }
  var msg = input.value.trim();
  if (!msg) return;
  // H4: slash macros (/plain, /translate …) expand to full prompts
  var macro = handleMacro(msg);
  if (macro) msg = macro;

  var tok = { cancelled: false };
  _reqToken = tok;

  addChatMessage('user', msg);
  input.value = '';
  input.style.height = 'auto';
  ensureSession();

  var prompt = buildChatPrompt(msg);
  _aiCallActive = true;
  updateConnStatus('busy');
  _setAiUIActive(true);
  showThinkingBubble('AI is drafting…');
  setAiTimeout(prompt.length);

  var fullResponse = '';
  try {
    tool.requestAIStream(prompt, null, {
      onToken: function (token) {
        if (tok.cancelled) return;
        _lastTokenAt = Date.now();
        fullResponse += token;
        if (_streamCallback) _streamCallback(token);
      },
      onComplete: function () {
        if (tok.cancelled) return;
        finishAi(fullResponse);
      },
      onError: function (err) {
        clearAiTimeout();
        hideThinkingBubble();
        _aiCallActive = false;
        _setAiUIActive(false);
        updateConnStatus('error');
        addChatMessage('ai', '⚠️ **AI request failed:** ' + String(err || 'unknown error') + '\n\nTry again, or simplify your request.', { isError: true });
        tool.resize();
      }
    });
  } catch (e) {
    clearAiTimeout();
    hideThinkingBubble();
    _aiCallActive = false;
    _setAiUIActive(false);
    updateConnStatus('error');
    addChatMessage('ai', '⚠️ **AI request failed:** ' + esc(e.message || 'unknown error'), { isError: true });
    tool.resize();
  }
}

function finishAi(fullResponse) {
  clearAiTimeout();
  var elapsed = Date.now() - _thinkingStartTime;
  _markThinkingComplete(elapsed);
  _setAiUIActive(false);
  _aiCallActive = false;
  updateConnStatus('ok');

  var parsed = parseAiResponse(fullResponse);
  var changed = false;
  var version = null;
  if (parsed.op) {
    _snapshotPush();
    changed = applyAiOp(parsed.op);
    if (changed) {
      _bumpVersion('minor');
      _pushHistory();
      persist();
      mountPreview();
      updateDocStats();
      renderOutline();
      renderVariables();
      _detectDocType();
      version = DB.version;
    }
  }
  var text = parsed.summary;
  if (parsed.op && !changed) {
    text = (text ? text + '\n\n' : '') + '⚠️ The response did not contain valid block changes — please ask again.';
  }
  if (!parsed.op && !parsed.variants && !text) {
    text = '✅ Done. Tell me what to adjust next.';
  }
  addChatMessage('ai', text, { opts: parsed.suggests, version: version, variants: parsed.variants });
  if (changed) {
    showToast('✅ Document updated to v' + DB.version + ' — remember to Save in the CMS to commit.', 'success');
  } else if (parsed.variants && parsed.variants.length) {
    showToast('🎛 Pick a clause variant below to apply it to the document.', 'info');
  }
  tool.resize();
}

/* ═══════════════════════════════════════════
   SELECTION TARGETING
   ═══════════════════════════════════════════ */
function setSelectionTarget(sel) {
  if (!sel || sel.idx < 0 || sel.idx >= DB.blocks.length) {
    _selTarget = null;
  } else {
    var excerpt = sel.text.replace(/\s+/g, ' ').substring(0, 80);
    _selTarget = { idx: sel.idx, type: sel.type, text: sel.text };
    var chip = el('chat-target-chip');
    if (chip) {
      el('chat-target-label').textContent = 'Block #' + (sel.idx + 1) + ' (' + sel.type + '): “' + excerpt + '…” — AI edits ONLY this part';
      chip.style.display = '';
    }
    var info = el('sel-target-info');
    if (info) info.textContent = '🎯 Targeted: block #' + (sel.idx + 1) + ' (' + sel.type + ') — the next AI request edits only this part';
  }
  var clearBtn = el('btn-target-clear');
  if (clearBtn) clearBtn.style.display = _selTarget ? '' : 'none';
}

function clearSelectionTarget() {
  _selTarget = null;
  var chip = el('chat-target-chip');
  if (chip) chip.style.display = 'none';
  var info = el('sel-target-info');
  if (info) info.textContent = '🎯 Select text inside the document to target it for the next AI edit';
  var clearBtn = el('btn-target-clear');
  if (clearBtn) clearBtn.style.display = 'none';
}

/* ═══════════════════════════════════════════
   MANUAL EDIT MODE (contentEditable inside the preview)
   ═══════════════════════════════════════════ */
var _editMode = false;
var _ignoreEdits = false;

function sendDocMessage(data) {
  var iframe = el('doc-preview');
  if (!iframe || !iframe.contentWindow) return;
  try { iframe.contentWindow.postMessage(data, '*'); } catch (e) {}
}

function updateEditToolbar() {
  var bar = el('edit-format-bar');
  if (bar) bar.style.display = _editMode ? '' : 'none';
  var btn = el('btn-toggle-edit');
  if (btn) {
    btn.textContent = _editMode ? '✅ Save Edits' : '✏️ Edit';
    if (_editMode) { btn.classList.remove('btn-ghost'); btn.classList.add('btn-primary'); }
    else { btn.classList.remove('btn-primary'); btn.classList.add('btn-ghost'); }
  }
  var selInfo = el('sel-target-info');
  if (_editMode && selInfo) selInfo.textContent = '✏️ Editing mode — click into the document and type. Use the formatting buttons, then Save Edits.';
}

function setEditMode(on) {
  if (on && tool.isReadOnly()) { showToast('Read-only mode — editing is disabled.', 'warning'); return; }
  _editMode = !!on;
  sendDocMessage({ lbCmd: { cmd: 'edit', on: _editMode } });
  if (_editMode) {
    var iframe = el('doc-preview');
    try { if (iframe && iframe.contentWindow) iframe.contentWindow.focus(); } catch (e) {}
  }
  updateEditToolbar();
}

function toggleEditMode() { setEditMode(!_editMode); }

function sendFormatCmd(op, val) {
  if (!_editMode) return;
  sendDocMessage({ lbCmd: { cmd: 'format', op: op, val: val || null } });
}

/** Apply blocks edited by hand in the preview back into the block model. */
function applyManualEdits(changes) {
  if (!changes || !changes.length) return false;
  _snapshotPush();
  var changedAny = false;
  for (var i = 0; i < changes.length; i++) {
    var c = changes[i];
    var idx = parseInt(c.idx, 10);
    if (isNaN(idx) || idx < 0 || idx >= DB.blocks.length) continue;
    if (c.html === undefined || c.html === null) continue;
    var b = DB.blocks[idx];
    b.data = b.data || {};
    if (b.type === 'html') {
      if (b.data.html !== c.html) { b.data.html = c.html; changedAny = true; }
    } else {
      if (b.data.manualHtml !== c.html) { b.data.manualHtml = c.html; changedAny = true; }
    }
  }
  return changedAny;
}

/* ═══════════════════════════════════════════
   COMPONENT CATALOG UI
   ═══════════════════════════════════════════ */
var CAT_LABELS = { content: 'content', structural: 'structural', boilerplate: 'boilerplate' };
var CAT_ICONS = { content: '📘', structural: '📐', boilerplate: '♻️' };

function renderCatalog(filter) {
  var list = el('components-list');
  if (!list) return;
  var f = String(filter || '').toLowerCase();
  var h = '';
  for (var k in LEGAL_COMPONENTS) {
    if (!Object.prototype.hasOwnProperty.call(LEGAL_COMPONENTS, k)) continue;
    var c = LEGAL_COMPONENTS[k];
    if (f && (k + ' ' + c.name + ' ' + c.desc).toLowerCase().indexOf(f) === -1) continue;
    h += '<div class="comp-card">' +
      '<div class="comp-card-top"><div class="comp-card-icon">' + (c.icon || '📄') + '</div>' +
      '<div class="comp-card-name">' + esc(c.name) + '</div>' +
      '<span class="comp-card-type ' + esc(c.cat || 'content') + '">' + esc(CAT_LABELS[c.cat] || c.cat || 'content') + '</span></div>' +
      '<div class="comp-card-desc">' + esc(c.desc) + '</div>' +
      '<div class="comp-card-schema">type: "' + esc(k) + '" · ' + esc(c.schema) + '</div>' +
      '<div class="comp-card-actions"><button class="btn btn-sm btn-primary" data-comp-add="' + esc(k) + '">➕ Add</button></div>' +
      '</div>';
  }
  if (!h) h = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:30px">No components match the filter.</div>';
  list.innerHTML = h;

  var btns = list.querySelectorAll('[data-comp-add]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', function () {
      var type = this.getAttribute('data-comp-add');
      var c2 = LEGAL_COMPONENTS[type];
      var prompt = 'Please add a "' + type + '" block (' + (c2 ? c2.name : '') + ') to the document' +
        (c2 ? ' — ' + c2.desc : '') + '. Fit it to the current document context.';
      sendPreset(prompt);
    });
  }
}

/* ═══════════════════════════════════════════
   FORMATTING CONTROLS & SETTINGS
   ═══════════════════════════════════════════ */
function populateFmtControls() {
  var sel = el('fmt-font');
  if (sel) {
    sel.innerHTML = FONTS.map(function (f) {
      return '<option value="' + esc(f) + '"' + (f === (DB.settings.fontFamily || '') ? ' selected' : '') + '>' + esc(f) + '</option>';
    }).join('');
  }
  var sz = el('fmt-size');
  if (sz) {
    sz.innerHTML = SIZES.map(function (s) {
      return '<option value="' + esc(s) + '"' + (s === (DB.settings.fontSize || '') ? ' selected' : '') + '>' + esc(s) + '</option>';
    }).join('');
  }
  var lh = el('fmt-lh');
  if (lh) {
    lh.innerHTML = LINEHEIGHTS.map(function (s) {
      return '<option value="' + esc(s) + '"' + (s === String(DB.settings.lineHeight || '') ? ' selected' : '') + '>' + esc(s) + ' line</option>';
    }).join('');
  }
  var col = el('fmt-color');
  if (col) col.value = DB.settings.color || '#111111';
}

function applyFmtControls() {
  var changed = false;
  var f = el('fmt-font');
  if (f && DB.settings.fontFamily !== f.value) { DB.settings.fontFamily = f.value; changed = true; }
  var s = el('fmt-size');
  if (s && DB.settings.fontSize !== s.value) { DB.settings.fontSize = s.value; changed = true; }
  var l = el('fmt-lh');
  if (l && String(DB.settings.lineHeight) !== l.value) { DB.settings.lineHeight = l.value; changed = true; }
  var c = el('fmt-color');
  if (c && DB.settings.color !== c.value) { DB.settings.color = c.value; changed = true; }
  if (changed) {
    _bumpVersion('patch');
    persist();
    mountPreview();
    showToast('Formatting updated (v' + DB.version + ')', 'success');
  }
}

function renderParamsSummary() {
  var box = el('params-summary');
  if (!box) return;
  var items = [
    ['defaultFontFamily', DB.settings.fontFamily],
    ['defaultFontSize', DB.settings.fontSize],
    ['defaultColor', DB.settings.color],
    ['defaultLineHeight', DB.settings.lineHeight],
    ['jurisdiction', tool.param('jurisdiction', '(not set)')],
    ['docxLibUrl', tool.param('docxLibUrl', '(default CDN)')]
  ];
  var h = '';
  for (var i = 0; i < items.length; i++) {
    h += '<b>' + esc(items[i][0]) + '</b>: ' + esc(items[i][1] || '') + '<br>';
  }
  box.innerHTML = h;
}

/* ═══════════════════════════════════════════
   EXPORTS — HTML / PDF / DOCX
   ═══════════════════════════════════════════ */
function downloadBlob(blob, filename) {
  try {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (e) {
    showToast('Download failed: ' + e.message, 'error');
  }
}

function exportHtml() {
  showToast('📥 Preparing HTML…', 'info');
  buildPaginatedHtml(function (pagesHtml) {
    var html = buildStandaloneHtml(pagesHtml);
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, slugify(resolveTitle()) + '.html');
    showToast('📥 HTML downloaded — Word-style pages, fully standalone (all styles embedded).', 'success');
  });
}

function exportPdf() {
  var filename = slugify(resolveTitle()) + '.pdf';
  function doPdf(pagesHtml) {
    if (typeof tool.requestExportPdf === 'function') {
      try {
        tool.requestExportPdf({ html: buildStandaloneHtml(pagesHtml), filename: filename }, function (err, file) {
          if (err || !file) {
            printFallback();
            return;
          }
          if (file.url && typeof tool.openUrl === 'function') {
            tool.openUrl(file.url);
            showToast('🖨️ PDF exported: ' + (file.name || filename), 'success');
          } else {
            // Some hosts deliver the PDF without a preview URL.
            showToast('🖨️ PDF export completed: ' + (file.name || filename), 'success');
          }
        });
        return;
      } catch (e) { /* fall through */ }
    }
    printFallback();
  }
  showToast('🖨️ Preparing PDF (paginating A4 pages)…', 'info');
  buildPaginatedHtml(function (pagesHtml) { doPdf(pagesHtml); });
}

function printFallback() {
  buildPaginatedHtml(function (pagesHtml) {
    try {
      var w = window.open('', '_blank');
      if (!w) {
        showToast('Pop-up blocked — allow pop-ups, or use HTML export and print from the browser.', 'warning');
        return;
      }
      w.document.open();
      w.document.write(buildStandaloneHtml(pagesHtml));
      w.document.close();
      setTimeout(function () {
        try { w.focus(); w.print(); } catch (e) { showToast('Use your browser\u2019s print dialog in the opened window.', 'info'); }
      }, 600);
    } catch (e) {
      showToast('PDF export unavailable: ' + e.message, 'error');
    }
  });
}

/* ── DOCX export (docx library loaded lazily from CDN) ── */
var _docxState = { loading: false, loaded: false, available: false, callbacks: [] };

function ensureDocxLib(callback) {
  if (_docxState.loaded) { callback(_docxState.available); return; }
  _docxState.callbacks.push(callback);
  if (_docxState.loading) return;
  _docxState.loading = true;
  if (window.docx) {
    _docxState.loaded = true;
    _docxState.available = true;
    flushDocxCallbacks(true);
    return;
  }
  var url = tool.param('docxLibUrl', '');
  if (!url) url = 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js';
  var script = document.createElement('script');
  script.src = url;
  var timer = setTimeout(function () {
    _docxState.loaded = true;
    _docxState.available = false;
    flushDocxCallbacks(false);
  }, 12000);
  script.onload = function () {
    clearTimeout(timer);
    _docxState.loaded = true;
    _docxState.available = !!window.docx;
    flushDocxCallbacks(_docxState.available);
  };
  script.onerror = function () {
    clearTimeout(timer);
    _docxState.loaded = true;
    _docxState.available = false;
    flushDocxCallbacks(false);
  };
  document.head.appendChild(script);
}

function flushDocxCallbacks(ok) {
  var cbs = _docxState.callbacks;
  _docxState.callbacks = [];
  for (var i = 0; i < cbs.length; i++) cbs[i](ok);
}

function exportDocx() {
  showToast('📄 Preparing DOCX…', 'info');
  ensureDocxLib(function (ok) {
    if (ok) {
      try {
        var marginTwips = { narrow: 720, moderate: 1080, normal: 1440, wide: 1800 };
        var mTw = marginTwips[DB.settings.docxMargins] || 1440;
        var items = htmlToDocxItems('<div class="doc-sheet">' + blocksToHtml() + '</div>');
        var W = window.docx;
        if (DB.settings.docxCover) {
          var coverItems = [
            new W.Paragraph({ alignment: W.AlignmentType.CENTER, spacing: { before: 2400, after: 200 }, children: [new W.TextRun({ text: resolveTitle(), bold: true, size: 32, font: (DB.settings.fontFamily || 'Times New Roman') })] }),
            new W.Paragraph({ alignment: W.AlignmentType.CENTER, spacing: { after: 200 }, children: [new W.TextRun({ text: 'CONFIDENTIAL', bold: true, size: 22, color: '64748B', font: (DB.settings.fontFamily || 'Times New Roman') })] }),
            new W.Paragraph({ alignment: W.AlignmentType.CENTER, spacing: { after: 1200 }, children: [new W.TextRun({ text: new Date().toLocaleDateString(), size: 22, font: (DB.settings.fontFamily || 'Times New Roman') })] }),
            new W.Paragraph({ children: [new W.PageBreak()] })
          ];
          items = coverItems.concat(items);
        }
        var doc = new W.Document({
          creator: 'Legal Document Builder',
          title: resolveTitle(),
          sections: [{
            properties: {
              page: { margin: { top: mTw, bottom: mTw, left: mTw, right: mTw } }
            },
            children: items
          }]
        });
        W.Packer.toBlob(doc).then(function (blob) {
          downloadBlob(blob, slugify(resolveTitle()) + '.docx');
          showToast('📄 DOCX downloaded — open it in Microsoft Word.', 'success');
        }).catch(function (e) {
          console.warn('docx pack failed', e);
          exportWordFallback();
        });
      } catch (e) {
        console.warn('docx build failed', e);
        exportWordFallback();
      }
    } else {
      exportWordFallback();
    }
  });
}

function exportWordFallback() {
  var head = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>' + esc(resolveTitle()) + '</title>' +
    '<xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>' +
    '<style>@page{margin:20mm 18mm;size:A4}</style></head><body><div class="doc-sheet">' + blocksToHtml() + '</div></body></html>';
  var blob = new Blob(['\ufeff' + head], { type: 'application/msword' });
  downloadBlob(blob, slugify(resolveTitle()) + '.doc');
  showToast('📄 Word file downloaded (.doc — Word-compatible HTML). The real .docx library could not be loaded from the CDN.', 'warning');
}

/* ── HTML → DOCX conversion (walks the rendered document DOM) ── */
function htmlToDocxItems(html) {
  var W = window.docx;
  if (!W) return [];
  var parser = new DOMParser();
  var doc = parser.parseFromString('<html><body>' + html + '</body></html>', 'text/html');
  var items = [];

  function parseSize(v) {
    if (!v) return null;
    var m = String(v).match(/([\d.]+)\s*(pt|px)/i);
    if (m) {
      var n = parseFloat(m[1]);
      return m[2].toLowerCase() === 'pt' ? Math.round(n * 2) : Math.round(n * 1.5);
    }
    m = String(v).match(/([\d.]+)/);
    return m ? Math.round(parseFloat(m[1]) * 2) : null;
  }

  function mergeStyle(el2, st) {
    var s = el2.getAttribute && el2.getAttribute('style') ? el2.getAttribute('style') : '';
    var out = { bold: st.bold, italic: st.italic, underline: st.underline, size: st.size, color: st.color, font: st.font };
    if (/font-weight\s*:\s*([6-9]00|bold)/.test(s)) out.bold = true;
    if (/font-style\s*:\s*italic/.test(s)) out.italic = true;
    if (/text-decoration\s*:[^;]*underline/.test(s)) out.underline = true;
    var fm = s.match(/font-family\s*:\s*([^;]+)/);
    if (fm) {
      var ff = fm[1].split(',')[0].trim().replace(/['"]/g, '');
      if (ff) out.font = ff;
    }
    var cm = s.match(/color\s*:\s*(#[0-9a-fA-F]{3,6}|rgb\([^)]*\))/);
    if (cm) out.color = cm[1];
    var sm = s.match(/font-size\s*:\s*([^;]+)/);
    if (sm) out.size = parseSize(sm[1]) || out.size;
    return out;
  }

  function makeRun(text, st) {
    var opts = { text: text };
    if (st.bold) opts.bold = true;
    if (st.italic) opts.italics = true;
    if (st.underline) opts.underline = {};
    if (st.size) opts.size = st.size;
    if (st.color) opts.color = st.color;
    if (st.font) opts.font = st.font;
    return new W.TextRun(opts);
  }

  function textRuns(node, st) {
    var runs = [];
    (function walk(n, cur) {
      for (var i = 0; i < n.childNodes.length; i++) {
        var c = n.childNodes[i];
        if (c.nodeType === 3) {
          var t = c.nodeValue.replace(/\s+/g, ' ');
          if (t.trim()) runs.push(makeRun(t, cur));
        } else if (c.nodeType === 1) {
          var tag = c.tagName.toLowerCase();
          if (tag === 'br') continue;
          var cur2 = mergeStyle(c, cur);
          if (tag === 'strong' || tag === 'b') cur2.bold = true;
          if (tag === 'em' || tag === 'i') cur2.italic = true;
          if (tag === 'u') cur2.underline = true;
          walk(c, cur2);
        }
      }
    })(node, st);
    return runs;
  }

  function makeParagraph(runs, opts) {
    opts = opts || {};
    var p = {
      children: runs,
      spacing: { after: 160 }
    };
    if (opts.heading) p.heading = opts.heading;
    if (opts.align) p.alignment = opts.align;
    else p.alignment = W.AlignmentType.JUSTIFIED;
    if (opts.bullet) p.bullet = { level: 0 };
    return new W.Paragraph(p);
  }

  function paraFromEl(el2, st, opts) {
    var runs = textRuns(el2, st);
    if (!runs.length) return null;
    if (opts && opts.prefix) runs.unshift(makeRun(opts.prefix, st));
    return makeParagraph(runs, opts);
  }

  var olCounters = [];
  function walkList(el2, st, ordered, depth) {
    var li = el2.children;
    var idx = 0;
    for (var i = 0; i < li.length; i++) {
      if (li[i].tagName.toLowerCase() !== 'li') continue;
      idx++;
      var prefix = null;
      if (ordered) {
        var level = depth || 0;
        if (level === 0) prefix = idx + '. ';
        else prefix = String.fromCharCode(96 + Math.min(idx, 26)) + ') ';
      }
      // paragraph(s) inside the li
      var hasBlock = false;
      var kids = li[i].children;
      for (var k = 0; k < kids.length; k++) {
        var tag = kids[k].tagName.toLowerCase();
        if (tag === 'p' || tag === 'div' || tag === 'ul' || tag === 'ol' || tag === 'table') { hasBlock = true; break; }
      }
      if (hasBlock) {
        for (var k2 = 0; k2 < kids.length; k2++) {
          walk(kids[k2], st, { ordered: ordered, depth: depth, liPrefix: k2 === 0 ? prefix : null });
        }
      } else {
        var runs = textRuns(li[i], st);
        if (runs.length) {
          if (prefix) runs.unshift(makeRun(prefix, st));
          var opts = ordered ? null : { bullet: true };
          items.push(makeParagraph(runs, opts));
        }
      }
    }
  }

  function walkTable(el2, st) {
    var rows = [];
    var trs = el2.querySelectorAll('tr');
    var gridBorder = { style: W.BorderStyle.SINGLE, size: 4, color: '94A3B8' };
    for (var i = 0; i < trs.length; i++) {
      var cells = [];
      var tds = trs[i].children;
      // Header row = first row where every cell is a <th>
      var isHeader = i === 0 && tds.length > 0;
      for (var xh = 0; xh < tds.length && isHeader; xh++) {
        if (tds[xh].tagName.toLowerCase() !== 'th') isHeader = false;
      }
      var nCols = tds.length;
      for (var j = 0; j < tds.length; j++) {
        var cellChildren = [];
        var cellSt = isHeader ? { bold: true, italic: st.italic, underline: st.underline, size: st.size, color: '#111827', font: st.font } : st;
        var kids = tds[j].children;
        if (kids.length) {
          for (var k = 0; k < kids.length; k++) {
            var p = paraFromEl(kids[k], cellSt, { align: W.AlignmentType.LEFT });
            if (p) cellChildren.push(p);
            else { var rr = textRuns(kids[k], cellSt); if (rr.length) cellChildren.push(makeParagraph(rr, { align: W.AlignmentType.LEFT })); }
          }
        } else {
          var rr2 = textRuns(tds[j], cellSt);
          if (rr2.length) cellChildren.push(makeParagraph(rr2, { align: W.AlignmentType.LEFT }));
        }
        if (!cellChildren.length) cellChildren.push(makeParagraph([makeRun('', cellSt)], { align: W.AlignmentType.LEFT }));
        var cellOpts = {
          children: cellChildren,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          borders: {
            top: gridBorder, bottom: gridBorder, left: gridBorder, right: gridBorder
          }
        };
        if (nCols > 0) cellOpts.width = { size: Math.floor(100 / nCols), type: W.WidthType.PERCENTAGE };
        if (isHeader) cellOpts.shading = { fill: 'E2E8F0' };
        cells.push(new W.TableCell(cellOpts));
      }
      rows.push(new W.TableRow({ children: cells }));
    }
    items.push(new W.Table({
      width: { size: 100, type: W.WidthType.PERCENTAGE },
      layout: W.TableLayoutType ? W.TableLayoutType.FIXED : undefined,
      borders: {
        top: gridBorder, bottom: gridBorder, left: gridBorder, right: gridBorder,
        insideHorizontal: gridBorder, insideVertical: gridBorder
      },
      rows: rows
    }));
  }

  function walk(el2, st, ctx) {
    ctx = ctx || {};
    var kids = el2.childNodes;
    for (var i = 0; i < kids.length; i++) {
      var node = kids[i];
      if (node.nodeType === 3) {
        var t = node.nodeValue.replace(/\s+/g, ' ');
        if (t.trim()) items.push(makeParagraph([makeRun(t, st)], null));
        continue;
      }
      if (node.nodeType !== 1) continue;
      var tag = node.tagName.toLowerCase();
      var st2 = mergeStyle(node, st);
      var cls = node.className ? String(node.className) : '';
      if (/lb-page-break/.test(cls)) {
        items.push(new W.Paragraph({ children: [new W.PageBreak()] }));
        continue;
      }
      if (tag === 'table') { walkTable(node, st2); continue; }
      if (tag === 'ul' || tag === 'ol') {
        walkList(node, st2, tag === 'ol', (ctx.depth || 0) + 1);
        continue;
      }
      if (tag === 'li') {
        var prefix2 = ctx.liPrefix;
        var runs = textRuns(node, st2);
        if (runs.length) {
          if (prefix2) runs.unshift(makeRun(prefix2, st2));
          items.push(makeParagraph(runs, ctx.ordered ? null : { bullet: true }));
        }
        continue;
      }
      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
        var levels = { h1: W.HeadingLevel.HEADING_1, h2: W.HeadingLevel.HEADING_2, h3: W.HeadingLevel.HEADING_3, h4: W.HeadingLevel.HEADING_4, h5: W.HeadingLevel.HEADING_5, h6: W.HeadingLevel.HEADING_6 };
        var p2 = paraFromEl(node, st2, { heading: levels[tag], align: W.AlignmentType.LEFT });
        if (p2) items.push(p2);
        continue;
      }
      if (tag === 'p') {
        var al = W.AlignmentType.JUSTIFIED;
        var sAttr = node.getAttribute('style') || '';
        if (/text-align\s*:\s*center/.test(sAttr)) al = W.AlignmentType.CENTER;
        else if (/text-align\s*:\s*left/.test(sAttr)) al = W.AlignmentType.LEFT;
        else if (/text-align\s*:\s*right/.test(sAttr)) al = W.AlignmentType.RIGHT;
        var p3 = paraFromEl(node, st2, { align: al });
        if (p3) items.push(p3);
        continue;
      }
      if (tag === 'blockquote') {
        var p4 = paraFromEl(node, st2, { align: W.AlignmentType.LEFT });
        if (p4) items.push(p4);
        continue;
      }
      if (tag === 'hr') {
        items.push(makeParagraph([makeRun('________________________________', st2)], { align: W.AlignmentType.CENTER }));
        continue;
      }
      if (tag === 'style' || tag === 'script') continue;
      // Generic container: recurse (div, span, etc.)
      walk(node, st2, ctx);
    }
  }

  walk(doc.body, { bold: false, italic: false, underline: false, size: null, color: null, font: null }, {});
  return items;
}

/* ═══════════════════════════════════════════
   READ-ONLY / ROLES
   ═══════════════════════════════════════════ */
function applyReadOnly(ro) {
  var banner = el('ro-banner');
  if (banner) banner.style.display = ro ? '' : 'none';
  var send = el('btn-chat-send');
  var input = el('chat-input');
  if (send) { send.disabled = ro || _aiCallActive; }
  if (input) { input.disabled = ro || _aiCallActive; input.placeholder = ro ? 'Read-only mode — document changes are disabled' : 'Describe your legal document or ask for changes… (Enter to send, Shift+Enter for new line)'; }
  var fmt = document.querySelectorAll('.fmt-select, .fmt-color');
  for (var i = 0; i < fmt.length; i++) {
    fmt[i].disabled = ro;
    fmt[i].style.opacity = ro ? '0.5' : '';
  }
  var reset = el('btn-reset-doc');
  if (reset) reset.disabled = ro;
  var toggleEdit = el('btn-toggle-edit');
  if (toggleEdit) toggleEdit.disabled = ro;
  if (ro) {
    if (_editMode) setEditMode(false);
    var bar = el('edit-format-bar');
    if (bar) bar.style.display = 'none';
  }
}

/* ═══════════════════════════════════════════
   EVENT BINDINGS
   ═══════════════════════════════════════════ */
function closeDrawer(name) {
  var d = el('drawer-' + name);
  if (d) d.classList.remove('open');
}

function openDrawer(name) {
  // Only one drawer at a time
  closeDrawer(name === 'components' ? 'settings' : 'components');
  var d = el('drawer-' + name);
  if (name === 'variables') renderVariables();
  if (name === 'outline') renderOutline();
  if (!d) return;
  d.classList.add('open');
  if (name === 'components') renderCatalog(el('comp-search') ? el('comp-search').value : '');
  if (name === 'settings') { updateDocStats(); renderSettingsPhase2(); }
  tool.resize();
}

function toggleDrawer(name) {
  var d = el('drawer-' + name);
  if (!d) return;
  if (d.classList.contains('open')) closeDrawer(name);
  else openDrawer(name);
}

function confirmClick(btn, action, confirmLabel) {
  var original = btn.textContent;
  function restore() {
    btn.textContent = original;
    btn.classList.remove('btn-danger');
    btn._confirmArmed = false;
    btn._confirmTimer = null;
  }
  if (btn._confirmArmed) {
    clearTimeout(btn._confirmTimer);
    restore();
    action();
    return;
  }
  btn._confirmArmed = true;
  btn.textContent = confirmLabel || 'Click again to confirm';
  btn.classList.add('btn-danger');
  btn._confirmTimer = setTimeout(restore, 4000);
}

function bindEvents() {
  var send = el('btn-chat-send');
  if (send) send.addEventListener('click', sendChatMessage);
  var stop = el('btn-chat-stop');
  if (stop) stop.addEventListener('click', cancelAiRequest);

  var input = el('chat-input');
  if (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    });
  }

  var clearChat = el('btn-clear-chat');
  if (clearChat) {
    clearChat.addEventListener('click', function () {
      var self = this;
      confirmClick(self, function () {
        _chatMessages = [];
        updateChatCache();
        renderChatMessages();
        bindOptionButtons();
        if (DB.activeSessionId) saveCurrentSession();
        showToast('Chat cleared.', 'info');
      }, 'Clear chat?');
    });
  }

  // Manual edit mode
  var undoBtn = el('btn-undo');
  if (undoBtn) undoBtn.addEventListener('click', undo);
  var redoBtn = el('btn-redo');
  if (redoBtn) redoBtn.addEventListener('click', redo);

  var openVars = el('btn-open-variables');
  if (openVars) openVars.addEventListener('click', function () { toggleDrawer('variables'); });
  var closeVars = el('btn-close-variables');
  if (closeVars) closeVars.addEventListener('click', function () { closeDrawer('variables'); });
  var varAdd = el('btn-var-add');
  if (varAdd) varAdd.addEventListener('click', function () { addVariable(); });
  var varScan = el('btn-var-scan');
  if (varScan) {
    varScan.addEventListener('click', function () {
      var added = scanBlocksForVars();
      persist();
      renderVariables();
      updateVarBadge();
      showToast(added ? '🔍 Found new variables in the document.' : '🔍 Variable registry is up to date.', 'info');
    });
  }

  var openOutline = el('btn-open-outline');
  if (openOutline) openOutline.addEventListener('click', function () { toggleDrawer('outline'); });
  var closeOutline = el('btn-close-outline');
  if (closeOutline) closeOutline.addEventListener('click', function () { closeDrawer('outline'); });

  // Guided interview (button lives in the chat welcome panel)
  var guidedBtn = el('btn-guided');
  if (guidedBtn) {
    guidedBtn.addEventListener('click', function () {
      sendPreset('🪄 Guided interview: please interview me step by step about this document — its type, the parties, key dates, amounts and special terms. Ask ONE question at a time with short option answers, and when you have 4+ answers, draft the complete document.');
    });
  }
  var renumBtn = el('btn-renumber');
  if (renumBtn) renumBtn.addEventListener('click', renumberBlocks);
  var coverBtn = el('btn-add-cover');
  if (coverBtn) coverBtn.addEventListener('click', addCoverPage);
  var syncBtn = el('btn-sync-cms');
  if (syncBtn) syncBtn.addEventListener('click', syncToCms);
  var importBtn = el('btn-import');
  if (importBtn) importBtn.addEventListener('click', applyImportText);
  var lintFix = el('btn-lint-fix');
  if (lintFix) lintFix.addEventListener('click', lintFixWithAi);

  // Phase 2 bindings
  var openNav = el('btn-open-nav');
  if (openNav) openNav.addEventListener('click', function () { toggleNav(); });
  var closeNav = el('btn-close-nav');
  if (closeNav) closeNav.addEventListener('click', function () { toggleNav(false); });
  var zoomMinus = el('btn-zoom-minus');
  if (zoomMinus) zoomMinus.addEventListener('click', function () { applyZoom(_zoom - 0.1); });
  var zoomPlus = el('btn-zoom-plus');
  if (zoomPlus) zoomPlus.addEventListener('click', function () { applyZoom(_zoom + 0.1); });
  var focusBtn = el('btn-focus-mode');
  if (focusBtn) focusBtn.addEventListener('click', toggleFocusMode);
  var plainBtn = el('btn-plain');
  if (plainBtn) {
    plainBtn.addEventListener('click', function () {
      var targeted = _selTarget && _selTarget.idx >= 0 && _selTarget.idx < DB.blocks.length;
      sendPreset(targeted
        ? 'Rewrite ONLY block #' + _selTarget.idx + ' in plain, modern language while keeping its legal meaning. Reply with a single replaceBlock.'
        : 'Rewrite the entire document in plain, modern language while preserving legal meaning and section numbering. Reply with {"blocks":[...]} containing the full rewritten document.');
    });
  }
  var gapFix = el('btn-gap-fix');
  if (gapFix) gapFix.addEventListener('click', gapFixWithAi);
  var riskBtn = el('btn-risk-review');
  if (riskBtn) {
    riskBtn.addEventListener('click', function () {
      sendPreset('/risk');
    });
  }
  var translateBtn = el('btn-translate');
  if (translateBtn) {
    translateBtn.addEventListener('click', function () {
      var sel = el('translate-lang');
      var lang = sel && sel.value ? sel.value : 'English';
      sendPreset('Translate the entire document into ' + lang + '. Keep block structure, numbering and formatting. Reply with {"blocks":[...]} containing the full translated document.');
    });
  }
  var findBtn = el('btn-find');
  if (findBtn) findBtn.addEventListener('click', renderFindResults);
  var findInput = el('find-input');
  if (findInput) findInput.addEventListener('input', renderFindResults);
  var replaceBtn = el('btn-replace-all');
  if (replaceBtn) replaceBtn.addEventListener('click', replaceAllInDoc);
  var exportMd = el('btn-export-md');
  if (exportMd) exportMd.addEventListener('click', exportMarkdown);
  var exportChatBtn = el('btn-export-chat');
  if (exportChatBtn) exportChatBtn.addEventListener('click', exportChat);
  var importFile = el('btn-import-file');
  if (importFile) importFile.addEventListener('click', importFileToBlocks);
  var sendEmail = el('btn-send-email');
  if (sendEmail) sendEmail.addEventListener('click', sendForSignature);
  var contactsSave = el('btn-contacts-save');
  if (contactsSave) contactsSave.addEventListener('click', savePartiesToBook);
  var commentAdd = el('btn-comment-add');
  if (commentAdd) {
    commentAdd.addEventListener('click', function () {
      var inp = el('comment-input');
      if (!inp) return;
      var t = inp.value;
      addComment(_commentIdx, t);
      inp.value = '';
    });
  }
  var statusSel = el('doc-status');
  if (statusSel) statusSel.addEventListener('change', function () { setDocStatus(statusSel.value); });

  var pageSizeSel = el('page-size-select');
  if (pageSizeSel) pageSizeSel.addEventListener('change', function () { applyPageOption('pageSize', pageSizeSel.value); });
  var pageNums = el('page-numbers-check');
  if (pageNums) pageNums.addEventListener('change', function () { applyPageOption('showPageNumbers', pageNums.checked); });
  var wmSel = el('watermark-select');
  if (wmSel) wmSel.addEventListener('change', function () { applyPageOption('watermark', wmSel.value); });
  var mgSel = el('docx-margins');
  if (mgSel) mgSel.addEventListener('change', function () { DB.settings.docxMargins = mgSel.value; persist(); });
  var cvCheck = el('docx-cover');
  if (cvCheck) cvCheck.addEventListener('change', function () { DB.settings.docxCover = cvCheck.checked; persist(); });

  // Parent keyboard shortcuts
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    }
    if (e.key === 'Escape') {
      closeDrawer('components');
      closeDrawer('settings');
      closeDrawer('variables');
      closeDrawer('outline');
    }
  });

  var stagedChip = el('staged-chip');
  if (stagedChip) stagedChip.addEventListener('click', function () { showToast('💾 Changes are staged in this field — click Save in the parent CMS record to commit.', 'info'); });
  var toggleEdit = el('btn-toggle-edit');
  if (toggleEdit) toggleEdit.addEventListener('click', toggleEditMode);
  var editCancel = el('btn-edit-cancel');
  if (editCancel) {
    editCancel.addEventListener('click', function () {
      // Discard: ignore the lbEdited reply, leave edit mode, rebuild the preview
      _ignoreEdits = true;
      setEditMode(false);
      mountPreview();
      setTimeout(function () { _ignoreEdits = false; }, 300);
    });
  }
  var fmtBtns = document.querySelectorAll('[data-fmt-op]');
  for (var fb = 0; fb < fmtBtns.length; fb++) {
    fmtBtns[fb].addEventListener('click', function () {
      sendFormatCmd(this.getAttribute('data-fmt-op'));
    });
  }
  var editColor = el('edit-color');
  if (editColor) editColor.addEventListener('change', function () { sendFormatCmd('foreColor', editColor.value); });
  var editHl = el('edit-highlight');
  if (editHl) editHl.addEventListener('change', function () { sendFormatCmd('hiliteColor', editHl.value); });

  var targetClear = el('btn-target-clear');
  if (targetClear) targetClear.addEventListener('click', clearSelectionTarget);

  // Side drawers: Components / Settings & Export
  var openComp = el('btn-open-components');
  if (openComp) openComp.addEventListener('click', function () { toggleDrawer('components'); });
  var closeComp = el('btn-close-components');
  if (closeComp) closeComp.addEventListener('click', function () { closeDrawer('components'); });
  var openSet = el('btn-open-settings');
  if (openSet) openSet.addEventListener('click', function () { toggleDrawer('settings'); });
  var closeSet = el('btn-close-settings');
  if (closeSet) closeSet.addEventListener('click', function () { closeDrawer('settings'); });

  // Component search
  var search = el('comp-search');
  if (search) search.addEventListener('input', function () { renderCatalog(search.value); });

  // Formatting controls
  var fmtEls = [el('fmt-font'), el('fmt-size'), el('fmt-lh')];
  for (var f = 0; f < fmtEls.length; f++) {
    if (fmtEls[f]) fmtEls[f].addEventListener('change', applyFmtControls);
  }
  var col = el('fmt-color');
  if (col) col.addEventListener('change', applyFmtControls);

  // Exports
  var eh1 = el('btn-export-html');
  if (eh1) eh1.addEventListener('click', exportHtml);
  var eh2 = el('btn-export-html2');
  if (eh2) eh2.addEventListener('click', exportHtml);
  var ed1 = el('btn-export-docx');
  if (ed1) ed1.addEventListener('click', exportDocx);
  var ed2 = el('btn-export-docx2');
  if (ed2) ed2.addEventListener('click', exportDocx);
  var ep1 = el('btn-export-pdf');
  if (ep1) ep1.addEventListener('click', exportPdf);
  var ep2 = el('btn-export-pdf2');
  if (ep2) ep2.addEventListener('click', exportPdf);

  // Refresh preview
  var refresh = el('btn-refresh-preview');
  if (refresh) refresh.addEventListener('click', function () { mountPreview(); showToast('Preview refreshed.', 'info'); });

  // Reset document
  var reset = el('btn-reset-doc');
  if (reset) {
    reset.addEventListener('click', function () {
      var self = this;
      confirmClick(self, function () {
        DB.blocks = [];
        _bumpVersion('minor');
        persist();
        mountPreview();
        updateDocStats();
        clearSelectionTarget();
        showToast('Document reset — describe a new document in the chat.', 'info');
      }, 'Really reset the whole document?');
    });
  }

  // Selection relay + manual edits + variable clicks from the preview iframe
  window.addEventListener('message', function (e) {
    if (!e.data) return;
    if (e.data.lbSel) { setSelectionTarget(e.data.lbSel); return; }
    if (e.data.lbVar) {
      openDrawer('variables');
      renderVariables();
      var vinput = el('var-value-' + e.data.lbVar.name);
      if (vinput) {
        vinput.focus();
        vinput.select();
        var row = el('var-row-' + e.data.lbVar.name);
        if (row) {
          row.classList.add('var-row-flash');
          setTimeout(function () { row.classList.remove('var-row-flash'); }, 1600);
        }
      }
      showToast('🔤 Edit the "' + (e.data.lbVar.name) + '" variable — the document updates live.', 'info');
      return;
    }
    if (e.data.lbCancel) {
      _ignoreEdits = true;
      setEditMode(false);
      mountPreview();
      setTimeout(function () { _ignoreEdits = false; }, 300);
      showToast('Editing cancelled — changes discarded.', 'info');
      return;
    }
    if (e.data.lbEdited) {
      if (_ignoreEdits) return;
      var changed = applyManualEdits(e.data.lbEdited.blocks);
      if (changed) {
        _bumpVersion('patch');
        _pushHistory();
        persist();
        mountPreview();
        updateDocStats();
        showToast('✏️ Manual edits saved (v' + DB.version + ') — remember to Save in the CMS.', 'success');
      } else {
        showToast('No changes to save.', 'info');
      }
    }
  });

  // Copy blocks JSON
  var copyBlocks = el('btn-copy-blocks');
  if (copyBlocks) {
    copyBlocks.addEventListener('click', function () {
      var json = JSON.stringify(DB.blocks, null, 2);
      try {
        navigator.clipboard.writeText(json).then(function () {
          showToast('Blocks JSON copied to clipboard.', 'success');
        }).catch(function () { showToast('Clipboard unavailable — see console.', 'warning'); console.log(json); });
      } catch (e) {
        showToast('Clipboard unavailable — see console.', 'warning');
        console.log(json);
      }
    });
  }

  // Selection relay from the preview iframe
  window.addEventListener('message', function (e) {
    if (!e.data || !e.data.lbSel) return;
    setSelectionTarget(e.data.lbSel);
  });
}

/* ═══════════════════════════════════════════
   PHASE 2 — A3 gap analysis / G3 type rules
   ═══════════════════════════════════════════ */
var DOC_REQUIREMENTS = {
  nda: ['parties-block', 'confidentiality', 'termination', 'signature-block'],
  employment: ['parties-block', 'payment-terms', 'termination', 'confidentiality', 'signature-block'],
  lease: ['parties-block', 'payment-terms', 'termination', 'indemnity', 'signature-block'],
  service: ['parties-block', 'payment-terms', 'termination', 'indemnity', 'confidentiality', 'signature-block'],
  poa: ['parties-block', 'signature-block'],
  terms: ['governing-law', 'termination', 'entire-agreement'],
  settlement: ['parties-block', 'settlement-deed', 'signature-block'],
  purchase: ['parties-block', 'payment-terms', 'termination', 'indemnity', 'signature-block']
};

function docTypeName(typeId) {
  for (var i = 0; i < DOC_TYPES.length; i++) {
    if (DOC_TYPES[i].id === typeId) return DOC_TYPES[i].label;
  }
  return null;
}

function typeRulesBlock() {
  var type = _docType || _detectDocType();
  if (!type || !DOC_REQUIREMENTS[type]) return '';
  var req = DOC_REQUIREMENTS[type];
  var lines = [];
  lines.push('=== DOCUMENT TYPE RULES (' + docTypeName(type) + ') ===');
  lines.push('This is a ' + docTypeName(type) + '. It MUST include these component types: ' + req.join(', ') + '.');
  lines.push('Do not omit them unless the user explicitly asks. Additional components are welcome.');
  return lines.join('\n');
}

function runGapAnalysis() {
  var type = _docType || _detectDocType();
  if (!type || !DOC_REQUIREMENTS[type]) return { type: '', name: null, missing: [] };
  var have = {};
  for (var i = 0; i < DB.blocks.length; i++) have[DB.blocks[i].type] = true;
  var missing = [];
  for (var j = 0; j < DOC_REQUIREMENTS[type].length; j++) {
    var t = DOC_REQUIREMENTS[type][j];
    if (!have[t]) {
      var c = LEGAL_COMPONENTS[t];
      missing.push({ type: t, name: c ? c.name : t });
    }
  }
  return { type: type, name: docTypeName(type), missing: missing };
}

function renderGapList() {
  var box = el('gap-list');
  if (!box) return;
  var gap = runGapAnalysis();
  if (!gap.name) {
    box.innerHTML = '<p class="gen-hint">No document type detected yet — draft a document (NDA, service agreement, employment contract…) and the required-clause checklist appears here.</p>';
  } else if (!gap.missing.length) {
    box.innerHTML = '<p class="gen-hint">✅ All essential clauses for a ' + esc(gap.name) + ' are present.</p>';
  } else {
    var h = '<p class="gen-hint">A <b>' + esc(gap.name) + '</b> should contain:</p>';
    for (var i = 0; i < gap.missing.length; i++) {
      h += '<div class="lint-item"><span class="lint-idx">⚠</span><span class="lint-text">Missing: <b>' + esc(gap.missing[i].name) + '</b> <span class="outline-meta">(' + esc(gap.missing[i].type) + ')</span></span></div>';
    }
    box.innerHTML = h;
  }
  var btn = el('btn-gap-fix');
  if (btn) btn.style.display = (gap.missing && gap.missing.length) ? '' : 'none';
}

function gapFixWithAi() {
  var gap = runGapAnalysis();
  if (!gap.missing.length) { showToast('Nothing missing.', 'info'); return; }
  var names = [];
  for (var i = 0; i < gap.missing.length; i++) names.push(gap.missing[i].type);
  sendPreset('Add the missing essential components to this ' + gap.name + ': ' + names.join(', ') + '. Insert each one where it belongs using insertAfter operations (or a full {"blocks":[...]} if restructuring is needed).');
}

function runTypeChecks() {
  var gap = runGapAnalysis();
  var out = [];
  if (!gap.name) { out.push({ ok: null, text: 'No document type detected — type-specific rules apply once a document type is recognized.' }); return out; }
  for (var i = 0; i < DOC_REQUIREMENTS[gap.type].length; i++) {
    var t = DOC_REQUIREMENTS[gap.type][i];
    var c = LEGAL_COMPONENTS[t];
    var missing = false;
    for (var j = 0; j < gap.missing.length; j++) if (gap.missing[j].type === t) missing = true;
    out.push({ ok: !missing, text: (c ? c.name : t) + (missing ? ' — MISSING' : '') });
  }
  return out;
}

function renderRulesList() {
  var box = el('rules-list');
  if (!box) return;
  var checks = runTypeChecks();
  var h = '';
  for (var i = 0; i < checks.length; i++) {
    var ico = checks[i].ok === null ? 'ℹ️' : (checks[i].ok ? '✅' : '❌');
    h += '<div class="lint-item"><span class="lint-idx">' + ico + '</span><span class="lint-text">' + esc(checks[i].text) + '</span></div>';
  }
  box.innerHTML = h;
}

/* ═══════════════════════════════════════════
   PHASE 2 — F6 version history + compare
   ═══════════════════════════════════════════ */
function _pushHistory() {
  try {
    DB.history = DB.history || [];
    // Skip if this version already snapshotted
    if (DB.history.length && DB.history[DB.history.length - 1].version === DB.version) return;
    DB.history.push({ version: DB.version, blocks: JSON.parse(JSON.stringify(DB.blocks)), time: new Date().toISOString() });
    while (DB.history.length > 8) DB.history.shift();
    if (DB.history.length > 8) DB.history = DB.history.slice(-8);
    persist();
  } catch (e) {}
}

function renderHistory() {
  var box = el('history-list');
  if (!box) return;
  var hist = DB.history || [];
  if (!hist.length) {
    box.innerHTML = '<p class="gen-hint">No snapshots yet — versions are recorded after AI edits and manual saves.</p>';
    return;
  }
  var h = '';
  for (var i = hist.length - 1; i >= 0; i--) {
    var e = hist[i];
    var prev = i > 0 ? hist[i - 1] : null;
    h += '<div class="lint-item"><span class="lint-idx">' + esc(e.version) + '</span>' +
      '<span class="lint-text"><b>v' + esc(e.version) + '</b> · ' + e.blocks.length + ' blocks · ' + shortTime(e.time) + '</span>' +
      '<button class="btn btn-xs btn-ghost" data-hist-cmp="' + i + '"' + (prev ? '' : ' disabled') + ' title="Compare with previous">↔</button>' +
      '<button class="btn btn-xs btn-ghost" data-hist-restore="' + i + '" title="Restore this version">↩</button></div>';
  }
  box.innerHTML = h;
  var cmp = box.querySelectorAll('[data-hist-cmp]');
  for (var c = 0; c < cmp.length; c++) {
    cmp[c].addEventListener('click', function () {
      var i2 = parseInt(this.getAttribute('data-hist-cmp'), 10);
      var prev2 = DB.history[i2 - 1];
      if (!prev2) return;
      compareVersions(prev2, DB.history[i2]);
    });
  }
  var rst = box.querySelectorAll('[data-hist-restore]');
  for (var r = 0; r < rst.length; r++) {
    rst[r].addEventListener('click', function () {
      var i3 = parseInt(this.getAttribute('data-hist-restore'), 10);
      var snap = DB.history[i3];
      if (!snap) return;
      var self = this;
      confirmClick(self, function () {
        _snapshotPush();
        DB.blocks = JSON.parse(JSON.stringify(snap.blocks));
        DB.version = snap.version;
        scanBlocksForVars();
        _bumpVersion('patch');
        persist();
        mountPreview();
        updateDocStats();
        renderOutline();
        renderVariables();
        _detectDocType();
        showToast('↩ Restored v' + snap.version + ' (now v' + DB.version + ').', 'success');
      }, 'Restore v' + snap.version + '?');
    });
  }
}

function compareVersions(vA, vB) {
  var box = el('diff-list');
  if (!box) return;
  var a = vA.blocks || [];
  var b = vB.blocks || [];
  var max = Math.max(a.length, b.length);
  var h = '<p class="gen-hint">v' + esc(vA.version) + ' → v' + esc(vB.version) + ' — changed blocks:</p>';
  var shown = 0;
  for (var i = 0; i < max; i++) {
    var ba = a[i], bb = b[i];
    if (!ba && !bb) continue;
    var changed = !ba || !bb || ba.type !== bb.type || JSON.stringify(ba.data) !== JSON.stringify(bb.data);
    if (!changed) continue;
    shown++;
    h += '<div class="lint-item"><span class="lint-idx">#' + (i + 1) + '</span><span class="lint-text">' +
      (ba ? '<b>' + esc(ba.type) + '</b> → ' : '<i>(new)</i> → ') +
      (bb ? '<b>' + esc(bb.type) + '</b>' : '<i>(deleted)</i>') + '<br>' +
      (ba ? '<span class="outline-meta">old: ' + esc(blockPreview(ba, 70)) + '</span><br>' : '') +
      (bb ? '<span class="outline-meta">new: ' + esc(blockPreview(bb, 70)) + '</span>' : '') +
      '</span></div>';
  }
  if (!shown) h += '<p class="gen-hint">No block-level changes between these versions.</p>';
  box.innerHTML = h;
}

/* ═══════════════════════════════════════════
   PHASE 2 — D3 approval workflow
   ═══════════════════════════════════════════ */
function canApprove() {
  try {
    var u = getUserSafe() || {};
    var roles = u.roles || u.role || [];
    var list = Array.isArray(roles) ? roles : [roles];
    for (var i = 0; i < list.length; i++) {
      var r = String(list[i]).toLowerCase();
      if (r === 'admin' || r === 'manager' || r === 'editor') return true;
    }
  } catch (e) {}
  return false;
}

function renderStatus() {
  var sel = el('doc-status');
  if (sel) sel.value = DB.status || 'draft';
  var chip = el('status-chip');
  if (chip) {
    var map = { draft: ['📝 Draft', '#e0e7ff', '#3730a3'], 'in-review': ['🔍 In Review', '#fef3c7', '#92400e'], approved: ['✅ Approved', '#dcfce7', '#166534'] };
    var m = map[DB.status] || map.draft;
    chip.style.display = '';
    chip.textContent = m[0];
    chip.style.background = m[1];
    chip.style.color = m[2];
    chip.title = 'Document status — change it in Settings';
  }
  var log = el('status-log');
  if (log) {
    var hist = DB.statusLog || [];
    if (!hist.length) log.innerHTML = '<p class="gen-hint">No status changes yet.</p>';
    else {
      var h = '';
      for (var i = 0; i < hist.length; i++) {
        h += '<div class="lint-item"><span class="lint-idx">↻</span><span class="lint-text">' + esc(hist[i].from || '—') + ' → <b>' + esc(hist[i].to) + '</b> · ' + esc(hist[i].user || 'Someone') + ' · ' + shortTime(hist[i].time) + '</span></div>';
      }
      log.innerHTML = h;
    }
  }
}

function setDocStatus(status) {
  if (!status || String(status) === String(DB.status)) return;
  if (status === 'approved' && !canApprove()) {
    showToast('Only admins and editors can approve documents.', 'warning');
    renderStatus();
    return;
  }
  var u = getUserSafe() || {};
  DB.statusLog = DB.statusLog || [];
  DB.statusLog.push({ from: DB.status, to: status, time: new Date().toISOString(), user: u.name || u.id || 'Someone' });
  if (DB.statusLog.length > 20) DB.statusLog = DB.statusLog.slice(-20);
  DB.status = status;
  persist();
  renderStatus();
  showToast('Status changed to ' + status + '.', 'success');
}

/* ═══════════════════════════════════════════
   PHASE 2 — B5 find & replace
   ═══════════════════════════════════════════ */
function _walkBlockText(b, fn) {
  // fn(value, path) — apply to every string field of a block's data
  var d = b.data || {};
  (function walk(o, path) {
    if (o === null || typeof o !== 'object') return;
    for (var k in o) {
      if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
      var v = o[k];
      if (typeof v === 'string') fn(o, k, path + '.' + k, v);
      else if (v && typeof v === 'object') walk(v, path + '.' + k);
    }
  })(d, 'data');
}

function runFind(text) {
  var needle = String(text || '').toLowerCase();
  var out = [];
  if (!needle) return out;
  for (var i = 0; i < DB.blocks.length; i++) {
    var b = DB.blocks[i];
    _walkBlockText(b, function (o, k, path, v) {
      var lower = v.toLowerCase();
      var count = 0, idx = 0;
      while ((idx = lower.indexOf(needle, idx)) !== -1) { count++; idx += needle.length; }
      if (count > 0) out.push({ idx: i, type: b.type, field: k, count: count, snippet: blockPreview(b, 80) });
    });
  }
  return out;
}

function renderFindResults() {
  var box = el('find-list');
  var input = el('find-input');
  if (!box) return;
  if (!input || !input.value.trim()) { box.innerHTML = ''; return; }
  var matches = runFind(input.value);
  if (!matches.length) { box.innerHTML = '<p class="gen-hint">No matches.</p>'; return; }
  var total = 0, h = '';
  for (var i = 0; i < Math.min(matches.length, 12); i++) {
    total += matches[i].count;
    h += '<div class="lint-item"><span class="lint-idx">#' + (matches[i].idx + 1) + '</span><span class="lint-text"><b>' + matches[i].count + '×</b> in ' + esc(matches[i].type) + '.' + esc(matches[i].field) + ' — ' + esc(matches[i].snippet) + '</span></div>';
  }
  if (matches.length > 12) h += '<div class="lint-item">… and ' + (matches.length - 12) + ' more blocks</div>';
  box.innerHTML = '<p class="gen-hint">' + total + ' occurrence(s) in ' + matches.length + ' block(s):</p>' + h;
}

function replaceAllInDoc() {
  var fin = el('find-input');
  var rin = el('replace-input');
  if (!fin || !fin.value.trim()) { showToast('Type the text to find first.', 'warning'); return; }
  var find = fin.value;
  var replace = rin ? rin.value : '';
  var count = 0;
  for (var i = 0; i < DB.blocks.length; i++) {
    var b = DB.blocks[i];
    _walkBlockText(b, function (o, k) {
      if (String(o[k]).indexOf(find) !== -1) {
        var parts = String(o[k]).split(find);
        count += parts.length - 1;
        o[k] = parts.join(replace);
      }
    });
  }
  if (!count) { showToast('No occurrences replaced.', 'info'); return; }
  _snapshotPush();
  _bumpVersion('patch');
  persist();
  mountPreview();
  updateDocStats();
  renderOutline();
  renderFindResults();
  showToast('🔁 Replaced ' + count + ' occurrence(s).', 'success');
}

/* ═══════════════════════════════════════════
   PHASE 2 — B6 zoom + focus, B7 navigation
   ═══════════════════════════════════════════ */
var _zoom = 1;
function applyZoom(scale) {
  _zoom = Math.min(2, Math.max(0.6, scale));
  sendDocMessage({ lbCmd: { cmd: 'zoom', scale: _zoom } });
  var plus = el('btn-zoom-plus');
  var minus = el('btn-zoom-minus');
  if (plus) plus.textContent = '🔍＋' + Math.round(_zoom * 100) + '%';
  if (minus) minus.style.opacity = _zoom <= 0.6 ? '0.4' : '';
  if (plus) plus.style.opacity = _zoom >= 2 ? '0.4' : '';
}

function toggleFocusMode() {
  var app = el('app');
  if (!app) return;
  var on = !app.classList.contains('focus-mode');
  if (on) app.classList.add('focus-mode');
  else app.classList.remove('focus-mode');
  var btn = el('btn-focus-mode');
  if (btn) btn.textContent = on ? '⛶ Exit Focus' : '⛶ Focus';
  tool.resize();
}

function gotoBlock(idx) {
  sendDocMessage({ lbCmd: { cmd: 'goto', idx: idx } });
}

function renderNav() {
  var list = el('nav-list');
  if (!list) return;
  var h = '';
  for (var i = 0; i < DB.blocks.length; i++) {
    var b = DB.blocks[i];
    if (b.type !== 'section' && b.type !== 'subsection' && b.type !== 'title' && b.type !== 'schedule' && b.type !== 'exhibit') continue;
    var label = '';
    if (b.type === 'title') label = '📜 ' + ((b.data && b.data.text) || 'Title');
    else if (b.type === 'section') label = (b.data && b.data.number ? b.data.number + '. ' : '') + ((b.data && b.data.title) || 'Section');
    else if (b.type === 'subsection') label = '↳ ' + ((b.data && b.data.number ? b.data.number + ' ' : '') + ((b.data && b.data.title) || 'Subsection'));
    else if (b.type === 'schedule') label = '🗓 Schedule ' + ((b.data && b.data.letter) || '');
    else label = '🏷 Exhibit ' + ((b.data && b.data.letter) || '');
    h += '<button class="nav-item" data-nav-idx="' + i + '" title="Jump to page">' + esc(label) + '</button>';
  }
  if (!h) h = '<p class="drawer-hint">No sections yet.</p>';
  list.innerHTML = h;
  var items = list.querySelectorAll('[data-nav-idx]');
  for (var j = 0; j < items.length; j++) {
    items[j].addEventListener('click', function () {
      gotoBlock(parseInt(this.getAttribute('data-nav-idx'), 10));
    });
  }
}

function toggleNav(force) {
  var panel = el('nav-panel');
  if (!panel) return;
  var on = force === undefined ? !panel.classList.contains('open') : !!force;
  if (on) { renderNav(); panel.classList.add('open'); }
  else panel.classList.remove('open');
  tool.resize();
}

/* ═══════════════════════════════════════════
   PHASE 2 — C4 defined terms registry
   ═══════════════════════════════════════════ */
function collectDefinedTerms() {
  var terms = {};
  function add(term, idx) {
    var t = String(term || '').trim();
    if (!t || t.length < 2 || t.length > 80) return;
    if (!terms[t]) terms[t] = { count: 0, firstIdx: idx };
  }
  for (var i = 0; i < DB.blocks.length; i++) {
    var b = DB.blocks[i];
    if (!b) continue;
    if (b.type === 'definitions' && b.data && b.data.terms) {
      for (var t = 0; t < b.data.terms.length; t++) add(b.data.terms[t].term, i);
    }
    // find "Term" means patterns in text blocks
    var text = '';
    if (b.type === 'clause' || b.type === 'paragraph' || b.type === 'bold-lead') {
      text = JSON.stringify(b.data || {});
      var re = /"([A-Z][A-Za-z0-9 \-,&]{1,60})"[ ]{0,10}(means|shall mean)/g;
      var m;
      while ((m = re.exec(text)) !== null) add(m[1], i);
    }
  }
  // usage counts across all blocks
  for (var u = 0; u < DB.blocks.length; u++) {
    var json = '';
    try { json = JSON.stringify(DB.blocks[u] && DB.blocks[u].data || {}); } catch (e) {}
    for (var term in terms) {
      if (!Object.prototype.hasOwnProperty.call(terms, term)) continue;
      var idx = json.indexOf(term);
      var cnt = 0;
      var at = 0;
      while (idx !== -1 && at < 50) { cnt++; at++; idx = json.indexOf(term, idx + term.length); }
      terms[term].count += cnt;
    }
  }
  var arr = [];
  for (var k2 in terms) {
    if (Object.prototype.hasOwnProperty.call(terms, k2)) arr.push({ term: k2, count: terms[k2].count, firstIdx: terms[k2].firstIdx });
  }
  arr.sort(function (a, b) { return a.term.localeCompare(b.term); });
  return arr;
}

function renderDefinedTerms() {
  var box = el('terms-list');
  if (!box) return;
  var terms = collectDefinedTerms();
  if (!terms.length) { box.innerHTML = '<p class="gen-hint">No defined terms detected. Add a Definitions component or write “Term” means … in clauses.</p>'; return; }
  var h = '';
  for (var i = 0; i < terms.length; i++) {
    h += '<div class="lint-item"><span class="lint-idx">“</span><span class="lint-text"><b>' + esc(terms[i].term) + '</b> · ' + terms[i].count + '× used</span>' +
      '<button class="btn btn-xs btn-ghost" data-term-goto="' + terms[i].firstIdx + '" title="Jump to first use">📍</button></div>';
  }
  box.innerHTML = h;
  var btns = box.querySelectorAll('[data-term-goto]');
  for (var j = 0; j < btns.length; j++) {
    btns[j].addEventListener('click', function () {
      gotoBlock(parseInt(this.getAttribute('data-term-goto'), 10));
    });
  }
}

/* ═══════════════════════════════════════════
   PHASE 2 — C5 My Clauses (snippet library)
   ═══════════════════════════════════════════ */
function saveBlockAsSnippet(idx) {
  var b = DB.blocks[idx];
  if (!b) return;
  DB.snippets = DB.snippets || [];
  var name = (LEGAL_COMPONENTS[b.type] && LEGAL_COMPONENTS[b.type].name) || b.type;
  DB.snippets.push({ id: genId(), name: name, type: b.type, data: JSON.parse(JSON.stringify(b.data || {})), time: new Date().toISOString() });
  if (DB.snippets.length > 20) DB.snippets = DB.snippets.slice(-20);
  persist();
  renderSnippets();
  showToast('📌 Saved "' + name + '" to My Clauses.', 'success');
}

function renderSnippets() {
  var box = el('snippet-list');
  if (!box) return;
  var sn = DB.snippets || [];
  if (!sn.length) {
    box.innerHTML = '<p class="gen-hint">No saved clauses yet. In the 🧭 Outline drawer, press 💾 on any block to save it here.</p>';
    return;
  }
  var h = '';
  for (var i = 0; i < sn.length; i++) {
    h += '<div class="lint-item"><span class="lint-idx">📌</span><span class="lint-text"><b>' + esc(sn[i].name) + '</b> <span class="outline-meta">(' + esc(sn[i].type) + ')</span></span>' +
      '<button class="btn btn-xs btn-ghost" data-snip-ins="' + i + '" title="Insert at the end of the document">➕</button>' +
      '<button class="btn btn-xs btn-ghost" data-snip-del="' + i + '" title="Delete snippet">🗑</button></div>';
  }
  box.innerHTML = h;
  var ins = box.querySelectorAll('[data-snip-ins]');
  for (var a = 0; a < ins.length; a++) {
    ins[a].addEventListener('click', function () { insertSnippet(parseInt(this.getAttribute('data-snip-ins'), 10)); });
  }
  var del = box.querySelectorAll('[data-snip-del]');
  for (var d2 = 0; d2 < del.length; d2++) {
    del[d2].addEventListener('click', function () {
      var si = parseInt(this.getAttribute('data-snip-del'), 10);
      var self = this;
      confirmClick(self, function () { deleteSnippet(si); }, 'Delete?');
    });
  }
}

function insertSnippet(si) {
  var s = (DB.snippets || [])[si];
  if (!s) return;
  _snapshotPush();
  DB.blocks.push({ type: s.type, data: JSON.parse(JSON.stringify(s.data || {})) });
  scanBlocksForVars();
  _bumpVersion('patch');
  persist();
  mountPreview();
  updateDocStats();
  renderOutline();
  renderVariables();
  showToast('📌 Inserted "' + s.name + '".', 'success');
}

function deleteSnippet(si) {
  DB.snippets = DB.snippets || [];
  DB.snippets.splice(si, 1);
  persist();
  renderSnippets();
}

/* ═══════════════════════════════════════════
   PHASE 2 — C6 party contact book (localStorage)
   ═══════════════════════════════════════════ */
function _contactsKey() {
  var u = getUserSafe() || {};
  return 'legaldoc_contacts_' + (u.id || 'shared');
}

function loadContacts() {
  try {
    var raw = localStorage.getItem(_contactsKey());
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveContacts(arr) {
  try { localStorage.setItem(_contactsKey(), JSON.stringify(arr.slice(0, 50))); } catch (e) {}
}

function savePartiesToBook() {
  var found = [];
  for (var i = 0; i < DB.blocks.length; i++) {
    var b = DB.blocks[i];
    if (!b || !b.data || !Array.isArray(b.data.parties)) continue;
    for (var j = 0; j < b.data.parties.length; j++) {
      var p = b.data.parties[j];
      if (p && p.name) found.push({ name: String(p.name), details: String(p.details || ''), alias: String(p.alias || ''), time: new Date().toISOString() });
    }
  }
  if (!found.length) { showToast('No parties found — the document has no parties/signature block yet.', 'warning'); return; }
  var contacts = loadContacts();
  var names = {};
  for (var c = 0; c < contacts.length; c++) names[contacts[c].name] = true;
  var added = 0;
  for (var f = 0; f < found.length; f++) {
    if (!names[found[f].name]) { contacts.push(found[f]); names[found[f].name] = true; added++; }
  }
  saveContacts(contacts);
  renderContacts();
  showToast('📇 Saved ' + added + ' party contact(s) to the contact book.', 'success');
}

function renderContacts() {
  var box = el('contacts-list');
  if (!box) return;
  var contacts = loadContacts();
  if (!contacts.length) {
    box.innerHTML = '<p class="gen-hint">No contacts saved yet. Press “💾 Save parties from document” — contacts are shared across your documents on this device.</p>';
    return;
  }
  var h = '';
  for (var i = 0; i < contacts.length; i++) {
    h += '<div class="lint-item"><span class="lint-idx">👤</span><span class="lint-text"><b>' + esc(contacts[i].name) + '</b>' +
      (contacts[i].alias ? ' <span class="outline-meta">(“' + esc(contacts[i].alias) + '”)</span>' : '') +
      (contacts[i].details ? '<br><span class="outline-meta">' + esc(contacts[i].details) + '</span>' : '') + '</span>' +
      '<button class="btn btn-xs btn-ghost" data-contact-use="' + i + '" title="Ask the AI to add this party to the document">➕</button>' +
      '<button class="btn btn-xs btn-ghost" data-contact-del="' + i + '" title="Remove from contact book">🗑</button></div>';
  }
  box.innerHTML = h;
  var use = box.querySelectorAll('[data-contact-use]');
  for (var a = 0; a < use.length; a++) {
    use[a].addEventListener('click', function () {
      var c2 = loadContacts()[parseInt(this.getAttribute('data-contact-use'), 10)];
      if (!c2) return;
      var prompt = 'Add/update the parties in this document so that "' + c2.name + '" appears' + (c2.alias ? ' with the short name "' + c2.alias + '"' : '') + (c2.details ? ' and details: ' + c2.details : '') + '. Create a parties-block if none exists, otherwise update it.';
      sendPreset(prompt);
    });
  }
  var del = box.querySelectorAll('[data-contact-del]');
  for (var d2 = 0; d2 < del.length; d2++) {
    del[d2].addEventListener('click', function () {
      var ci = parseInt(this.getAttribute('data-contact-del'), 10);
      var self = this;
      confirmClick(self, function () {
        var arr = loadContacts();
        arr.splice(ci, 1);
        saveContacts(arr);
        renderContacts();
      }, 'Remove?');
    });
  }
}

/* ═══════════════════════════════════════════
   PHASE 2 — D1 block comments
   ═══════════════════════════════════════════ */
var _commentIdx = -1;

function commentCount(idx) {
  var list = (DB.comments && DB.comments[idx]) || [];
  return list.length;
}

function addComment(idx, text) {
  var t = String(text || '').trim();
  if (!t) return;
  DB.comments = DB.comments || {};
  if (!DB.comments[idx]) DB.comments[idx] = [];
  var u = getUserSafe() || {};
  DB.comments[idx].push({ id: genId(), text: t, user: u.name || 'Someone', time: new Date().toISOString(), resolved: false });
  persist();
  renderCommentPanel(idx);
  renderOutline();
  showToast('💬 Comment added to block #' + (idx + 1) + '.', 'success');
}

function toggleCommentResolve(idx, cid) {
  var list = (DB.comments && DB.comments[idx]) || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === cid) list[i].resolved = !list[i].resolved;
  }
  persist();
  renderCommentPanel(idx);
}

function deleteCommentAt(idx, cid) {
  var list = (DB.comments && DB.comments[idx]) || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === cid) { list.splice(i, 1); break; }
  }
  if (DB.comments && DB.comments[idx] && !DB.comments[idx].length) delete DB.comments[idx];
  persist();
  renderCommentPanel(idx);
  renderOutline();
}

function renderCommentPanel(idx) {
  _commentIdx = idx;
  var head = el('comment-target-label');
  var list = el('comment-list');
  if (!list) return;
  var b = DB.blocks[idx];
  if (head) head.textContent = b ? ('Block #' + (idx + 1) + ' · ' + b.type) : '';
  var comments = (DB.comments && DB.comments[idx]) || [];
  if (!comments.length) {
    list.innerHTML = '<p class="drawer-hint">No comments on this block yet.</p>';
  } else {
    var h = '';
    for (var i = 0; i < comments.length; i++) {
      var c = comments[i];
      h += '<div class="lint-item" style="' + (c.resolved ? 'opacity:.55' : '') + '">' +
        '<span class="lint-idx">' + (c.resolved ? '✅' : '💬') + '</span>' +
        '<span class="lint-text"><b>' + esc(c.user) + '</b> · ' + shortTime(c.time) + '<br>' + esc(c.text) + '</span>' +
        '<button class="btn btn-xs btn-ghost" data-cmt-tgl="' + c.id + '" title="' + (c.resolved ? 'Reopen' : 'Resolve') + '">' + (c.resolved ? '↩' : '✓') + '</button>' +
        '<button class="btn btn-xs btn-ghost" data-cmt-del="' + c.id + '" title="Delete">🗑</button></div>';
    }
    list.innerHTML = h;
    var tgl = list.querySelectorAll('[data-cmt-tgl]');
    for (var t = 0; t < tgl.length; t++) {
      tgl[t].addEventListener('click', function () { toggleCommentResolve(idx, this.getAttribute('data-cmt-tgl')); });
    }
    var del = list.querySelectorAll('[data-cmt-del]');
    for (var d = 0; d < del.length; d++) {
      del[d].addEventListener('click', function () {
        var cid = this.getAttribute('data-cmt-del');
        var self = this;
        confirmClick(self, function () { deleteCommentAt(idx, cid); }, 'Delete?');
      });
    }
  }
}

/* ═══════════════════════════════════════════
   PHASE 2 — D4 send for signature (email)
   ═══════════════════════════════════════════ */
function sendForSignature() {
  var to = el('email-to');
  var subj = el('email-subject');
  if (!to || !String(to.value || '').trim()) { showToast('Enter a recipient email address.', 'warning'); return; }
  if (typeof tool.requestSendEmail !== 'function') {
    showToast('Email is not available in this CMS context (requires requestSendEmail + allowSendEmail: yes).', 'warning');
    return;
  }
  showToast('📧 Preparing email with the document attached…', 'info');
  buildPaginatedHtml(function (pagesHtml) {
    try {
      var html = buildStandaloneHtml(pagesHtml);
      var dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
      tool.requestSendEmail({
        to: String(to.value || '').trim(),
        subject: String(subj && subj.value ? subj.value : resolveTitle() + ' — for signature'),
        body: 'Please find attached "' + resolveTitle() + '" for your review and signature.',
        attachments: [{ name: slugify(resolveTitle()) + '.html', dataUrl: dataUrl, contentType: 'text/html' }]
      }, function (err) {
        if (err) showToast('Email failed: ' + err, 'error');
        else showToast('📧 Sent to ' + to.value + '.', 'success');
      });
    } catch (e) {
      showToast('Email failed: ' + e.message, 'error');
    }
  });
}

/* ═══════════════════════════════════════════
   PHASE 2 — E1 import DOCX/PDF/TXT via AI
   ═══════════════════════════════════════════ */
function importFileToBlocks() {
  if (typeof tool.requestUpload !== 'function' || typeof tool.requestFileContent !== 'function') {
    showToast('File import is not available in this CMS context (requires requestUpload + requestFileContent).', 'warning');
    return;
  }
  showToast('📤 Choose a .docx / .pdf / .txt / .md file…', 'info');
  try {
    tool.requestUpload(['.pdf', '.docx', '.txt', '.md'], function (err, file) {
      if (err || !file) { showToast('Upload cancelled: ' + (err || 'no file'), 'warning'); return; }
      showToast('📥 Reading "' + file.name + '"…', 'info');
      tool.requestFileContent(file.id || file, function (err2, content) {
        if (err2 || content === undefined || content === null) { showToast('Could not read the file content.', 'error'); return; }
        var text = typeof content === 'string' ? content : (content.text || String(content));
        if (text.length > 80000) text = text.substring(0, 80000) + ' … (truncated)';
        showToast('🧠 Converting the file into legal blocks…', 'info');
        var prompt = 'Convert the following uploaded document content into the Legal Document Builder blocks format.\n' +
          'Respond with ONLY one JSON object {"blocks":[{"type":"...","data":{...}}, ...]} using the component library.\n' +
          'Preserve headings, numbered sections, clauses, lists, tables and signature pages. Use {{variableName}} for names, dates and amounts.\n\n=== UPLOADED DOCUMENT ===\n' + text;
        try {
          tool.requestAI(prompt, function (err3, response) {
            if (err3 || !response) { showToast('AI conversion failed: ' + (err3 || 'no response'), 'error'); return; }
            var parsed = parseAiResponse(response);
            if (!parsed.op) { showToast('Could not parse blocks from the AI response.', 'error'); return; }
            _snapshotPush();
            var changed = applyAiOp(parsed.op);
            if (!changed) { showToast('The AI response contained no valid blocks.', 'error'); return; }
            scanBlocksForVars();
            _bumpVersion('minor');
            _pushHistory();
            persist();
            mountPreview();
            updateDocStats();
            renderOutline();
            renderVariables();
            _detectDocType();
            showToast('📥 Imported ' + DB.blocks.length + ' block(s) from "' + file.name + '".', 'success');
          });
        } catch (e) {
          showToast('AI conversion unavailable: ' + e.message, 'error');
        }
      });
    });
  } catch (e) {
    showToast('Upload failed: ' + e.message, 'error');
  }
}

/* ═══════════════════════════════════════════
   PHASE 2 — F5 export Markdown / chat backup (H3)
   ═══════════════════════════════════════════ */
function blocksToMarkdown() {
  var lines = ['# ' + resolveTitle(), ''];
  for (var i = 0; i < DB.blocks.length; i++) {
    var b = DB.blocks[i];
    var d = b.data || {};
    switch (b.type) {
      case 'title': lines.push('# ' + (d.text || '')); break;
      case 'section': lines.push('## ' + (d.number ? d.number + '. ' : '') + (d.title || '')); break;
      case 'subsection': lines.push('### ' + (d.number ? d.number + ' ' : '') + (d.title || '')); break;
      case 'heading': lines.push('#### ' + (d.text || '')); break;
      case 'clause': lines.push('**' + (d.number ? d.number + '.** ' : '') + (d.lead ? d.lead + ' ' : '') + (d.text || '')); break;
      case 'paragraph': case 'bold-lead': lines.push((b.type === 'bold-lead' ? '**' + (d.lead || '') + '** ' : '') + (d.text || '')); break;
      case 'bullets': for (var j = 0; j < (d.items || []).length; j++) lines.push('- ' + d.items[j]); break;
      case 'numbering': for (var k = 0; k < (d.items || []).length; k++) lines.push((k + 1) + '. ' + (typeof d.items[k] === 'string' ? d.items[k] : d.items[k].text)); break;
      case 'table':
        if (d.columns && d.columns.length) {
          lines.push('| ' + d.columns.join(' | ') + ' |');
          lines.push('|' + d.columns.map(function () { return ' --- '; }).join('|') + '|');
          for (var r = 0; r < (d.rows || []).length; r++) lines.push('| ' + (d.rows[r] || []).join(' | ') + ' |');
        }
        break;
      case 'page-break': lines.push('---'); break;
      case 'signature-block': lines.push(''); lines.push('---'); lines.push('**Signatures:** ' + (d.parties || []).map(function (p) { return p.name; }).join(', ')); break;
      case 'parties-block': lines.push('**Parties:** ' + (d.parties || []).map(function (p) { return p.name; }).join('; ')); break;
      default:
        var pb = blockPreview(b, 500);
        if (pb) lines.push(pb);
    }
    lines.push('');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

function exportMarkdown() {
  try {
    var md = blocksToMarkdown();
    var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, slugify(resolveTitle()) + '.md');
    showToast('📝 Markdown downloaded.', 'success');
  } catch (e) { showToast('Export failed: ' + e.message, 'error'); }
}

function exportChat() {
  var lines = ['# Chat — ' + resolveTitle(), ''];
  for (var i = 0; i < _chatMessages.length; i++) {
    var m = _chatMessages[i];
    lines.push('**' + (m.role === 'user' ? 'User' : 'AI') + '** (' + shortTime(m.time) + ')\n');
    lines.push(m.text);
    lines.push('');
  }
  try {
    var blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, slugify(resolveTitle()) + '-chat.md');
    showToast('💬 Chat transcript downloaded.', 'success');
  } catch (e) { showToast('Export failed: ' + e.message, 'error'); }
}

/* ═══════════════════════════════════════════
   PHASE 2 — G6 accessibility checks
   ═══════════════════════════════════════════ */
function _luminance(hex) {
  try {
    var h = String(hex || '#111111').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var r = parseInt(h.substring(0, 2), 16) / 255;
    var g = parseInt(h.substring(2, 4), 16) / 255;
    var b = parseInt(h.substring(4, 6), 16) / 255;
    function lin(v) { return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  } catch (e) { return 0.12; }
}

function runA11yChecks() {
  var out = [];
  // Contrast vs white page
  var lum = _luminance(DB.settings.color);
  var ratio = (1.05) / (lum + 0.05);
  out.push({ ok: ratio >= 4.5, text: 'Text contrast on white ≈ ' + ratio.toFixed(1) + ':1 (WCAG AA needs ≥ 4.5:1).' });
  // Title present
  var hasTitle = false, firstHeadingLevel = null;
  for (var i = 0; i < DB.blocks.length; i++) {
    var b = DB.blocks[i];
    if (b.type === 'title') hasTitle = true;
    if (b.type === 'section' && firstHeadingLevel === null) firstHeadingLevel = 2;
    if (b.type === 'subsection' && firstHeadingLevel === null) firstHeadingLevel = 3;
  }
  out.push({ ok: hasTitle, text: hasTitle ? 'Document has a title block.' : 'No title block — exports should start with a document title.' });
  out.push({ ok: firstHeadingLevel !== 3, text: firstHeadingLevel === 3 ? 'Document starts with a subsection (###) before any main section — check the heading order.' : 'Heading order starts correctly.' });
  // images in raw html blocks need alt
  var imgsNoAlt = 0;
  for (var j = 0; j < DB.blocks.length; j++) {
    if (DB.blocks[j].type === 'html') {
      var html2 = String((DB.blocks[j].data && DB.blocks[j].data.html) || '');
      var ims = html2.match(/<img[^>]*>/gi) || [];
      for (var m = 0; m < ims.length; m++) {
        if (!/alt\s*=/.test(ims[m])) imgsNoAlt++;
      }
    }
  }
  out.push({ ok: imgsNoAlt === 0, text: imgsNoAlt ? imgsNoAlt + ' image(s) in raw HTML blocks have no alt attribute.' : 'All images in raw HTML have alt text.' });
  // font size
  var fs = parseInt(String(DB.settings.fontSize || '12pt'), 10) || 12;
  out.push({ ok: fs >= 10, text: 'Base font size ' + DB.settings.fontSize + (fs >= 10 ? ' is readable.' : ' is too small.') });
  return out;
}

function renderA11yList() {
  var box = el('a11y-list');
  if (!box) return;
  var checks = runA11yChecks();
  var h = '';
  for (var i = 0; i < checks.length; i++) {
    h += '<div class="lint-item"><span class="lint-idx">' + (checks[i].ok ? '✅' : '⚠') + '</span><span class="lint-text">' + esc(checks[i].text) + '</span></div>';
  }
  box.innerHTML = h;
}

/* ═══════════════════════════════════════════
   PHASE 2 — H4 prompt shortcuts / macros
   ═══════════════════════════════════════════ */
var MACROS = [
  ['/addsign', 'Add signature blocks for all parties.'],
  ['/plain', 'Rewrite the document in plain, modern language while preserving legal meaning and section numbering. Output {"blocks":[...]} with the full rewritten document.'],
  ['/formal', 'Rewrite the document in a more formal, traditional legal register while preserving meaning and numbering. Output {"blocks":[...]} with the full rewritten document.'],
  ['/fixvars', 'Replace hardcoded party names, dates and amounts with {{variables}} throughout the document and list them in the variables field.'],
  ['/number', 'Renumber all sections, subsections and clauses consistently.'],
  ['/risk', 'Review the document from each party\u2019s perspective and flag one-sided or risky clauses with quotes and suggested rewrites. Answer in chat only — no JSON.'],
  ['/summary', 'Summarize the document in 5 bullet points. Answer in chat only — no JSON.'],
  ['/translate', 'Translate the entire document into [LANGUAGE]. Keep block structure, numbering and formatting. Output {"blocks":[...]} with the full translated document.']
];

function handleMacro(text) {
  var t = String(text || '').trim();
  if (t.charAt(0) !== '/') return null;
  var parts = t.split(/\s+/);
  var cmd = parts[0].toLowerCase();
  for (var i = 0; i < MACROS.length; i++) {
    if (MACROS[i][0] === cmd) {
      var prompt = MACROS[i][1];
      var rest = t.substring(cmd.length).trim();
      if (cmd === '/translate' && rest) prompt = prompt.replace('[LANGUAGE]', rest);
      else if (rest) prompt = prompt + ' Context: ' + rest;
      return prompt;
    }
  }
  return null;
}

function renderMacroChips() {
  var box = el('macro-chips');
  if (!box) return;
  var h = '';
  for (var i = 0; i < MACROS.length; i++) {
    h += '<button class="chip macro-chip" data-macro="' + i + '" title="' + esc(MACROS[i][1]) + '">' + esc(MACROS[i][0]) + '</button>';
  }
  box.innerHTML = h;
  var btns = box.querySelectorAll('[data-macro]');
  for (var b = 0; b < btns.length; b++) {
    btns[b].addEventListener('click', function () {
      var m = MACROS[parseInt(this.getAttribute('data-macro'), 10)];
      if (!m) return;
      var input = el('chat-input');
      if (!input) return;
      input.value = m[0];
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 140) + 'px';
      input.focus();
      showToast('Send ' + m[0] + ' — or add extra context after it.', 'info');
    });
  }
}

function renderMacroList() {
  var box = el('macro-list');
  if (!box) return;
  var h = '';
  for (var i = 0; i < MACROS.length; i++) {
    h += '<div class="lint-item"><span class="lint-idx">⌨</span><span class="lint-text"><b>' + esc(MACROS[i][0]) + '</b> — ' + esc(MACROS[i][1]) + '</span></div>';
  }
  box.innerHTML = h;
}

/* ═══════════════════════════════════════════
   PHASE 2 — A6 clause variants
   ═══════════════════════════════════════════ */
function applyVariant(variant) {
  var op = variant.op || variant;
  if (!op || !_looksLikeDocOp(op)) { showToast('This variant could not be applied.', 'error'); return; }
  _snapshotPush();
  var changed = applyAiOp(op);
  if (!changed) { showToast('This variant could not be applied.', 'error'); return; }
  scanBlocksForVars();
  _bumpVersion('minor');
  _pushHistory();
  persist();
  mountPreview();
  updateDocStats();
  renderOutline();
  renderVariables();
  _detectDocType();
  showToast('✅ Variant applied (v' + DB.version + ').', 'success');
}

/* ═══════════════════════════════════════════
   PHASE 2 — aggregated settings renderer
   ═══════════════════════════════════════════ */
function renderSettingsPhase2() {
  renderGapList();
  renderRulesList();
  renderDefinedTerms();
  renderA11yList();
  renderHistory();
  renderSnippets();
  renderContacts();
  renderStatus();
  renderMacroList();
  renderFindResults();
}

/* ═══════════════════════════════════════════
   ENTRY POINT
   ═══════════════════════════════════════════ */
tool.onReady(function (val, fields) {
  // Load saved state
  var v = val && typeof val === 'object' ? val : {};
  DB.version = v.version || '1.0.0';
  DB.blocks = Array.isArray(v.blocks) ? v.blocks : [];
  DB.comments = (v.comments && typeof v.comments === 'object') ? v.comments : {};
  DB.snippets = Array.isArray(v.snippets) ? v.snippets : [];
  DB.status = v.status || 'draft';
  DB.statusLog = Array.isArray(v.statusLog) ? v.statusLog : [];
  DB.history = Array.isArray(v.history) ? v.history : [];
  DB.variables = (v.variables && typeof v.variables === 'object') ? v.variables : {};
  DB.activeSessionId = v.activeSessionId || '';
  DB.chatCache = (v.chatCache && typeof v.chatCache === 'object') ? v.chatCache : null;
  DB._instanceId = v._instanceId || '';
  DB.settings = (v.settings && typeof v.settings === 'object') ? v.settings : {};

  // Fill missing settings from admin params
  if (!DB.settings.fontFamily) DB.settings.fontFamily = tool.param('defaultFontFamily', 'Times New Roman');
  if (!DB.settings.fontSize) DB.settings.fontSize = tool.param('defaultFontSize', '12pt');
  if (!DB.settings.color) DB.settings.color = tool.param('defaultColor', '#111111');
  if (!DB.settings.lineHeight) DB.settings.lineHeight = String(tool.param('defaultLineHeight', '1.6'));
  if (!DB.settings.pageSize) DB.settings.pageSize = 'A4';
  if (DB.settings.showPageNumbers === undefined) DB.settings.showPageNumbers = true;
  if (DB.settings.watermark === undefined) DB.settings.watermark = '';

  tool.declareParams([
    { name: 'defaultFontFamily', label: 'Default Font Family', type: 'text', default: 'Times New Roman', severity: 'goodToHave', hint: 'Default font for new documents (Times New Roman, Georgia, Arial, Calibri…).' },
    { name: 'defaultFontSize', label: 'Default Font Size', type: 'text', default: '12pt', severity: 'goodToHave', hint: 'Default base font size (e.g. 12pt).' },
    { name: 'defaultColor', label: 'Default Text Color', type: 'text', default: '#111111', severity: 'optional', hint: 'Default text color (hex).' },
    { name: 'defaultLineHeight', label: 'Default Line Height', type: 'text', default: '1.6', severity: 'optional', hint: 'Default line spacing (1.15, 1.5, 1.6, 2.0…).' },
    { name: 'jurisdiction', label: 'Default Jurisdiction', type: 'text', default: '', severity: 'optional', hint: 'Optional default governing-law jurisdiction mentioned in drafts.' },
    { name: 'docxLibUrl', label: 'DOCX Library URL', type: 'text', default: '', severity: 'optional', hint: 'Override URL for the docx.js UMD library used for .docx export. Leave empty for the default CDN.' }
  ]);

  bindEvents();
  _renderVersion();
  populateFmtControls();
  renderParamsSummary();
  scanBlocksForVars();
  mountPreview();
  updateDocStats();
  updateVarBadge();
  updateStagedChip();
  renderPageOptions();
  renderStatus();
  renderSettingsPhase2();
  renderMacroChips();
  _detectDocType();
  applyReadOnly(tool.isReadOnly());

  tool.onReadonlyChange(function (ro) {
    applyReadOnly(ro);
    if (ro) showToast('Read-only mode active — changes are disabled.', 'warning');
  });

  // Load chat sessions, then restore the active chat
  loadSessions(function () {
    restoreActiveSessionMessages();
    renderChatMessages();
    bindOptionButtons();
  });

  // External value changes (another user edited)
  tool.onValueChange(function (newVal) {
    if (!newVal || typeof newVal !== 'object') return;
    DB.version = newVal.version || DB.version;
    DB.blocks = Array.isArray(newVal.blocks) ? newVal.blocks : [];
    if (newVal.variables && typeof newVal.variables === 'object') DB.variables = newVal.variables;
    if (newVal.settings && typeof newVal.settings === 'object') DB.settings = newVal.settings;
    if (newVal.comments && typeof newVal.comments === 'object') DB.comments = newVal.comments;
    if (Array.isArray(newVal.snippets)) DB.snippets = newVal.snippets;
    if (newVal.status) DB.status = newVal.status;
    if (Array.isArray(newVal.statusLog)) DB.statusLog = newVal.statusLog;
    if (Array.isArray(newVal.history)) DB.history = newVal.history;
    _renderVersion();
    populateFmtControls();
    renderPageOptions();
    mountPreview();
    updateDocStats();
    updateVarBadge();
    renderOutline();
    renderVariables();
    renderStatus();
    renderSettingsPhase2();
    _detectDocType();
  });

  tool.resize();
});
