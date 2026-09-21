/* ── Presentation Builder ──
   Chat-driven slide deck studio for UniconHub CMS html-tool system.
   Talk to the AI on the left; it composes a single presentation on the right
   from a rich built-in component library (or raw HTML/CSS/JS).
   Export produces ONE standalone .html file that works anywhere.
────────────────────────────────────────── */

/* ── Helpers ── */
function genId() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function el(id) { return document.getElementById(id); }
function debounce(fn, ms) {
  var t = null;
  return function() {
    var args = arguments, self = this;
    if (t) clearTimeout(t);
    t = setTimeout(function() { fn.apply(self, args); }, ms);
  };
}

/* Script tag fragments — built by concatenation so this file can run inline
   inside the CMS page without terminating its own <script> element. */
var S_OPEN = '<scr' + 'ipt>';
var S_CLOSE = '</scr' + 'ipt>';

/* ── State ── */
var DB = {
  pres: { title: '', subtitle: '', author: '', slides: [], deckCss: '', deckJs: '', theme: 'clean', datasets: {}, animLevel: 'subtle', lang: '', transition: '', brand: { primary: '', font: '' } },
  activeSlideId: '',
  version: '1.0.0',
  activeSessionId: '',
  chatMessages: [],       // in-memory — canonical copy in ai-chat-sessions-uniconbaseapps
  chatCache: { sessionId: '', messages: [] },
  history: [],            // bounded undo snapshots (persisted)
  snippets: [],           // reusable slide snippets (persisted, cap 20)
  _instanceId: '',
  _parentRecordId: ''
};

var _theme = 'light';
var _currentTab = 'present';
var _activeSlideIndex = 0;
var _snapshotInitialized = false;
var _lastPersistedSnapshot = '';
var _aiJustUpdated = false;
var _aiCallActive = false;
var _reqToken = null;
var _aiTimeoutId = null;
var _thinkingTimer = null;
var _thinkingMsgEl = null;
var _thinkingStartTime = 0;
var _lastTokenAt = 0;
var _streamCallback = null;
var _previewSeq = 0;
var _lastStagedValue = '';

/* Phase 1 — undo/redo + targeting state */
var _redoStack = [];
var _targetSlideId = '';
var _targetMode = false;
var _dragSlideId = null;
var HISTORY_MAX = 15;
var HISTORY_BYTES_MAX = 300000;

var _sessions = [];
var _activeSessionId = '';
var _sessionsLoaded = false;
var SESSION_TYPE = 'ai-chat-sessions-uniconbaseapps';
var _sessionWarnShown = false;

/* ═══════════════════════════════════════════
   PHASE 1 — THEMES
   ═══════════════════════════════════════════ */
var THEMES = {
  clean: {
    name: 'Clean Light',
    css: ''
  },
  dark: {
    name: 'Dark',
    css: '.pres-slide{background:#0f172a}.pres-cover,.pres-body,.pres-slide{color:#e2e8f0}.pres-h2,.pres-h3{color:#f1f5f9}.pres-kicker{color:var(--pres-accent,#a78bfa)}.pres-bullets li{color:#cbd5e1}.pres-bullet-icon{color:var(--pres-accent,#a78bfa)}.pres-table{color:#cbd5e1}.pres-table th{background:#1e293b;color:#e2e8f0;border-color:#334155}.pres-table td{border-color:#334155;color:#cbd5e1}.pres-table tr:nth-child(even) td{background:#111827}.pres-quote-wrap{background:linear-gradient(135deg,#1e293b,#0f172a);border-color:#334155}.pres-quote{color:#e2e8f0}.pres-quote-cite{color:#94a3b8}.pres-agenda-item{background:#1e293b;border-color:#334155;color:#e2e8f0}.pres-agenda-num{background:var(--pres-accent,#a78bfa);color:#fff}.pres-figure figcaption{background:#1e293b;color:#94a3b8}.pres-unknown{background:#451a03;color:#fde68a;border-color:#78350f}.pres-tab-pane{color:#cbd5e1}.pres-tab-btns{border-color:#334155}.pres-tab-btn{color:#94a3b8}.pres-tab-btn.active{color:#a78bfa;border-color:#a78bfa}.pres-q-opt{color:#cbd5e1;border-color:#334155}.pres-q-radio:checked+.pres-q-opt{border-color:var(--pres-accent,#a78bfa);background:#1e293b}.pres-q-prompt{color:#e2e8f0}.pres-timeline-item{background:#1e293b;border-color:#334155;color:#cbd5e1}.pres-metric-value{color:#f1f5f9}'
  },
  corporate: {
    name: 'Corporate',
    css: '.pres-slide{--pres-accent:#2563eb}.pres-kicker{color:#2563eb}.pres-agenda-num{background:#2563eb}.pres-q-radio:checked+.pres-q-opt{border-color:#2563eb;background:#eff6ff}.pres-tab-btn.active{color:#2563eb;border-color:#2563eb}.pres-h2{color:#0f172a}.pres-bullet-icon{color:#2563eb}.pres-spotlight{border-color:#2563eb!important}.pres-timeline-num{background:#2563eb;color:#fff}'
  },
  playful: {
    name: 'Playful',
    css: '.pres-slide{--pres-accent:#ec4899}.pres-kicker{color:#ec4899}.pres-agenda-num{background:#ec4899}.pres-h2{color:#be185d}.pres-h3{color:#db2777}.pres-bullet-icon{color:#ec4899}.pres-q-radio:checked+.pres-q-opt{border-color:#ec4899;background:#fdf2f8}.pres-tab-btn.active{color:#ec4899;border-color:#ec4899}.pres-timeline-num{background:#ec4899;color:#fff}.pres-quote{border-left-color:#ec4899}.pres-spotlight{border-color:#ec4899!important}'
  },
  minimal: {
    name: 'Minimal',
    css: '.pres-slide{--pres-accent:#111827}.pres-kicker{color:#111827;letter-spacing:0.3em;text-transform:uppercase;font-size:0.68em}.pres-agenda-num{background:#111827}.pres-h2{color:#111827;font-weight:600;letter-spacing:-0.02em}.pres-bullet-icon{color:#111827}.pres-q-radio:checked+.pres-q-opt{border-color:#111827;background:#f3f4f6}.pres-tab-btn.active{color:#111827;border-color:#111827}.pres-timeline-num{background:#111827;color:#fff}.pres-quote{font-style:normal;font-weight:300;letter-spacing:-0.01em}'
  },
  editorial: {
    name: 'Editorial',
    css: '.pres-slide{--pres-accent:#b91c1c}.pres-kicker{color:#b91c1c;text-transform:uppercase;letter-spacing:0.25em;font-size:0.7em}.pres-agenda-num{background:#b91c1c}.pres-h2{color:#1c1917;font-family:Georgia,"Times New Roman",serif;font-weight:700}.pres-h3{font-family:Georgia,"Times New Roman",serif}.pres-bullet-icon{color:#b91c1c}.pres-q-radio:checked+.pres-q-opt{border-color:#b91c1c;background:#fef2f2}.pres-tab-btn.active{color:#b91c1c;border-color:#b91c1c}.pres-timeline-num{background:#b91c1c;color:#fff}.pres-quote{font-family:Georgia,"Times New Roman",serif;font-style:italic}'
  },
  warm: {
    name: 'Warm',
    css: '.pres-slide{--pres-accent:#ea580c}.pres-kicker{color:#ea580c}.pres-agenda-num{background:#ea580c}.pres-h2{color:#7c2d12}.pres-h3{color:#9a3412}.pres-bullet-icon{color:#ea580c}.pres-q-radio:checked+.pres-q-opt{border-color:#ea580c;background:#fff7ed}.pres-tab-btn.active{color:#ea580c;border-color:#ea580c}.pres-timeline-num{background:#ea580c;color:#fff}.pres-spotlight{border-color:#ea580c!important}'
  }
};
var THEME_ORDER = ['clean', 'dark', 'corporate', 'playful', 'minimal', 'editorial', 'warm'];

function syncThemeSelect() {
  var sel = el('theme-select');
  if (!sel || !sel.dataset) return;
  if (!sel.dataset.filled) {
    sel.innerHTML = '';
    for (var i = 0; i < THEME_ORDER.length; i++) {
      var key = THEME_ORDER[i];
      var opt = document.createElement('option');
      opt.value = key;
      opt.textContent = THEMES[key].name;
      sel.appendChild(opt);
    }
    sel.dataset.filled = '1';
  }
  sel.value = (THEMES[DB.pres.theme]) ? DB.pres.theme : 'clean';
  sel.disabled = !canWrite();
}

/* ═══════════════════════════════════════════
   PHASE 1 — TEMPLATES
   ═══════════════════════════════════════════ */
var TEMPLATES = [
  { id: 'pitch', icon: '🚀', title: 'Startup pitch', desc: 'Problem, solution, traction, ask', prompt: 'Create a 10-slide startup pitch deck for a fictional SaaS product. Cover: 1) Cover 2) Problem 3) Solution 4) Market 5) Product demo 6) Business model 7) Competition 8) Traction 9) Team 10) Ask & closing. Use a mix of bullets, metrics, quote and spotlight. Keep text tight.' },
  { id: 'quarterly', icon: '📊', title: 'Quarterly review', desc: 'KPIs, wins, blockers, next quarter', prompt: 'Create an 8-slide quarterly business review: cover, highlights, KPI metrics, wins & losses, blockers, learnings, next-quarter goals, closing. Use metrics, bars, bullets and a section slide. Professional tone.' },
  { id: 'training', icon: '🎓', title: 'Training session', desc: 'Objectives, concepts, quiz, wrap-up', prompt: 'Create a 9-slide training deck for new employees on "company onboarding basics": cover, agenda, 4 concept slides with bullets and figures, a timeline, a 2-question quiz, and a closing slide. Simple language.' },
  { id: 'workshop', icon: '🛠', title: 'Workshop', desc: 'Agenda, exercises, discussion prompts', prompt: 'Create a 9-slide workshop deck for a "creative problem solving" session: cover, agenda, intro, 2 exercise slides with steps, a discussion prompt slide, key takeaways, and a closing. Engaging, practical.' },
  { id: 'launch', icon: '🎉', title: 'Product launch', desc: 'Teaser, features, pricing, CTA', prompt: 'Create a 9-slide product launch deck for a new mobile app: cover teaser, agenda, the problem, our solution, 3 key features, pricing table, launch timeline, closing call-to-action. Energetic tone.' },
  { id: 'wedding', icon: '💍', title: 'Wedding / event', desc: 'Story, schedule, photos, thanks', prompt: 'Create a 8-slide presentation for a wedding reception: cover, our story, how we met (timeline), people to thank, photo placeholders, evening program agenda, a quote, and a thank-you closing. Warm, elegant tone.' }
];

function renderTemplateGallery() {
  var g = el('template-gallery');
  if (!g) return;
  var h = '';
  for (var i = 0; i < TEMPLATES.length; i++) {
    var t = TEMPLATES[i];
    h += '<button type="button" class="template-chip" data-tpl="' + t.id + '"><span class="tpl-ico">' + t.icon + '</span><b>' + esc(t.title) + '</b><small>' + esc(t.desc) + '</small></button>';
  }
  g.innerHTML = h;
  var chips = g.querySelectorAll('.template-chip');
  for (var j = 0; j < chips.length; j++) {
    chips[j].addEventListener('click', function() {
      var id = this.getAttribute('data-tpl');
      for (var k = 0; k < TEMPLATES.length; k++) {
        if (TEMPLATES[k].id === id) {
          var input = el('chat-input');
          if (input) input.value = TEMPLATES[k].prompt;
          sendChatMessage();
          return;
        }
      }
    });
  }
}

/* ═══════════════════════════════════════════
   PHASE 1 — UNDO / REDO / HISTORY
   ═══════════════════════════════════════════ */
function updateHistoryButtons() {
  var u = el('btn-undo');
  var r = el('btn-redo');
  if (u) u.disabled = !(DB.history && DB.history.length);
  if (r) r.disabled = !_redoStack.length;
}

function pushHistoryRaw(pres, activeSlideId, label) {
  if (!Array.isArray(DB.history)) DB.history = [];
  DB.history.push({
    time: new Date().toISOString(),
    label: String(label || 'Change').substring(0, 80),
    version: DB.version || '1.0.0',
    pres: JSON.parse(JSON.stringify(pres || DB.pres)),
    activeSlideId: activeSlideId || ''
  });
  _redoStack = [];
  while (DB.history.length > HISTORY_MAX) DB.history.shift();
  while (JSON.stringify(DB.history).length > HISTORY_BYTES_MAX && DB.history.length > 2) DB.history.shift();
  updateHistoryButtons();
}

function pushHistory(label) {
  pushHistoryRaw(JSON.parse(JSON.stringify(DB.pres)), DB.activeSlideId, label);
}

function restoreState(snap) {
  if (!snap || !snap.pres) return;
  DB.pres = normalizeDeck(snap.pres);
  DB.activeSlideId = snap.activeSlideId || '';
  _aiJustUpdated = true; /* restoring is not a manual edit — no version bump */
  persist();
  fixActiveSlide();
  renderAll();
  updatePreview();
  syncThemeSelect();
  updateHistoryButtons();
}

function undo() {
  if (!DB.history || !DB.history.length) {
    try { tool.notify('Nothing to undo', 'info'); } catch (e) {}
    return;
  }
  var cur = { time: new Date().toISOString(), label: 'redo point', version: DB.version, pres: JSON.parse(JSON.stringify(DB.pres)), activeSlideId: DB.activeSlideId };
  _redoStack.push(cur);
  var snap = DB.history.pop();
  restoreState(snap);
  try { tool.notify('↩ Undid: ' + snap.label, 'info'); } catch (e) {}
}

function redo() {
  if (!_redoStack.length) {
    try { tool.notify('Nothing to redo', 'info'); } catch (e) {}
    return;
  }
  var snap = _redoStack.pop();
  DB.history.push({ time: new Date().toISOString(), label: 'undo point', version: DB.version, pres: JSON.parse(JSON.stringify(DB.pres)), activeSlideId: DB.activeSlideId });
  restoreState(snap);
  try { tool.notify('↪ Redid: ' + snap.label, 'info'); } catch (e) {}
}

function shortTime(iso) {
  if (!iso) return '';
  try {
    var d = new Date(iso);
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
  } catch (e) { return ''; }
}

function renderHistoryList() {
  var list = el('history-list');
  if (!list) return;
  if (!DB.history || !DB.history.length) {
    list.innerHTML = '<div class="modal-empty">No snapshots yet. Changes you make (AI edits, add/delete/reorder slides, themes…) are recorded here so you can jump back in time.</div>';
    return;
  }
  var h = '';
  for (var i = DB.history.length - 1; i >= 0; i--) {
    var s = DB.history[i];
    var slideCount = (s.pres && s.pres.slides && s.pres.slides.length) || 0;
    h += '<div class="history-row"><span class="history-time">' + shortTime(s.time) + '</span><b>' + esc(s.label || 'Change') + '</b><span class="history-meta">v' + esc(s.version || '1.0.0') + ' · ' + slideCount + ' slides</span><button class="btn btn-sm btn-outline" data-restore="' + i + '">Restore</button></div>';
  }
  list.innerHTML = h;
  var btns = list.querySelectorAll('[data-restore]');
  for (var j = 0; j < btns.length; j++) {
    btns[j].addEventListener('click', function() {
      var idx = parseInt(this.getAttribute('data-restore'), 10);
      var snap = DB.history[idx];
      if (!snap) return;
      pushHistoryRaw(JSON.parse(JSON.stringify(DB.pres)), DB.activeSlideId, 'restore point');
      DB.history.splice(idx, 1);
      restoreState(snap);
      renderHistoryList();
      try { tool.notify('Restored snapshot: ' + snap.label, 'info'); } catch (e) {}
    });
  }
}

function openHistory() {
  renderHistoryList();
  var ov = el('history-overlay');
  if (ov) ov.style.display = 'flex';
}
function closeHistory() {
  var ov = el('history-overlay');
  if (ov) ov.style.display = 'none';
}

/* ═══════════════════════════════════════════
   PHASE 1 — TARGETED EDIT
   ═══════════════════════════════════════════ */
function setTargetSlide(id) {
  if (slideIndexById(id) === -1) return;
  _targetSlideId = id;
  updateTargetChip();
  try { tool.notify('🎯 Targeting "Slide ' + (slideIndexById(id) + 1) + '" — the next AI message will edit only this slide', 'info'); } catch (e) {}
}
function clearTargetSlide() {
  _targetSlideId = '';
  updateTargetChip();
}
function updateTargetChip() {
  var chip = el('chat-target-chip');
  var label = el('chat-target-label');
  if (!chip) return;
  var idx = slideIndexById(_targetSlideId);
  if (_targetSlideId && idx !== -1) {
    chip.style.display = '';
    if (label) label.textContent = 'Slide ' + (idx + 1) + ' · ' + (DB.pres.slides[idx].title || 'Untitled');
  } else {
    chip.style.display = 'none';
    _targetSlideId = '';
  }
}
function toggleTargetMode() {
  _targetMode = !_targetMode;
  var b = el('btn-target-mode');
  if (b) b.classList.toggle('active', _targetMode);
  try { tool.notify(_targetMode ? '🎯 Target mode ON — click a slide in the strip to target it' : 'Target mode off', 'info'); } catch (e) {}
}

/* ═══════════════════════════════════════════
   PHASE 1 — DECK DOCTOR
   ═══════════════════════════════════════════ */
function runDeckChecks() {
  var slides = DB.pres.slides || [];
  var results = [];
  function add(sev, label, detail, slideId) {
    results.push({ id: 'dc' + results.length, sev: sev, label: label, detail: detail || '', slideId: slideId || '' });
  }
  if (!slides.length) {
    add('info', 'No slides yet', 'Describe your presentation in the chat to get started.');
    results.passed = 1; results.failed = 0; results.warned = 0; results.total = 1;
    return results;
  }
  var hasAgenda = false;
  var hasCover = false;
  var hasClosing = false;
  var titlesSeen = {};
  var bulletRun = 0;
  var lockedCount = 0;
  var noNotesCount = 0;

  for (var i = 0; i < slides.length; i++) {
    var s = slides[i];
    var types = [];
    for (var t = 0; t < s.components.length; t++) types.push(s.components[t].type);
    var lowTitle = String(s.title || '').trim().toLowerCase();
    if (lowTitle && titlesSeen[lowTitle] !== undefined) add('warn', 'Duplicate title', 'Slides ' + (titlesSeen[lowTitle] + 1) + ' and ' + (i + 1) + ' both read "' + s.title + '".', s.id);
    if (lowTitle) titlesSeen[lowTitle] = i;

    if (i === 0) hasCover = (types.indexOf('title-slide') !== -1 || types.indexOf('section-slide') !== -1);
    if (i === slides.length - 1) hasClosing = (types.indexOf('closing-slide') !== -1 || types.indexOf('title-slide') !== -1);
    if (types.indexOf('agenda') !== -1) hasAgenda = true;

    if (s.locked) lockedCount++;

    if (!s.components.length) {
      add('fail', 'Slide ' + (i + 1) + ' is empty', 'Add content in the Slides tab or ask the AI to fill it.', s.id);
      continue;
    }
    var hasHeading = (types.indexOf('heading') !== -1 || types.indexOf('title-slide') !== -1 || types.indexOf('section-slide') !== -1 || types.indexOf('closing-slide') !== -1 || types.indexOf('agenda') !== -1 || types.indexOf('quiz') !== -1);
    if (!hasHeading) add('info', 'Slide ' + (i + 1) + ' has no heading', 'A heading makes navigation clearer.', s.id);

    var bulletCount = 0;
    var textLen = 0;
    var nonVisual = true;
    for (var c = 0; c < s.components.length; c++) {
      var comp = s.components[c];
      if (comp.type === 'bullets') bulletCount += ((comp.data && comp.data.items) ? comp.data.items.length : 0);
      if (comp.type === 'paragraph') textLen += String((comp.data && (comp.data.text || comp.data.body)) || '').length;
      if (['figure', 'bars', 'rings', 'quiz', 'timeline', 'table', 'spotlight', 'quote', 'area-chart', 'radar', 'scatter', 'org-tree'].indexOf(comp.type) !== -1) nonVisual = false;
    }
    if (bulletCount > 8) add('warn', 'Slide ' + (i + 1) + ' has ' + bulletCount + ' bullets', 'Too dense — split into two slides or trim.', s.id);
    if (textLen > 600) add('warn', 'Slide ' + (i + 1) + ' has a lot of text', 'Shorten the paragraph(s) for better readability.', s.id);

    var bulletish = (nonVisual && bulletCount > 0);
    bulletRun = bulletish ? bulletRun + 1 : 0;
    if (bulletRun >= 3) add('warn', '3+ text-only slides in a row', 'Add a figure, bars, rings, quiz or timeline to break the monotony.', s.id);

    if (!s.notes) noNotesCount++;
  }

  if (!hasCover) add('warn', 'Deck does not start with a cover', 'Make the first slide a Title (cover) or Section slide.', slides.length ? slides[0].id : '');
  if (!hasClosing) add('warn', 'No closing slide', 'End with a closing slide (thanks, CTA or summary).');
  if (slides.length > 4 && !hasAgenda) add('info', 'No agenda slide', 'Decks over 4 slides read better with an agenda.');
  if (slides.length > 15) add('info', 'Long deck (' + slides.length + ' slides)', 'Consider splitting into two presentations.');
  if (noNotesCount > 0) add('info', noNotesCount + ' slide(s) without speaker notes', 'Use 🗒 Generate Notes in the Slides tab.');
  if (lockedCount > 0) add('info', lockedCount + ' slide(s) are locked', 'AI edits are blocked on locked slides.');

  var failed = 0, warned = 0, passed = 0;
  for (var r = 0; r < results.length; r++) {
    if (results[r].sev === 'fail') failed++;
    else if (results[r].sev === 'warn') warned++;
    else passed++;
  }
  results.total = results.length;
  results.failed = failed;
  results.warned = warned;
  results.passed = passed;
  return results;
}

function renderDoctorModal(results) {
  var list = el('doctor-list');
  if (!list) return;
  var h = '<div class="doctor-summary">' + results.passed + ' passing · ' + results.warned + ' warnings · ' + results.failed + ' problems</div>';
  for (var i = 0; i < results.length; i++) {
    var it = results[i];
    var ico = it.sev === 'fail' ? '⛔' : (it.sev === 'warn' ? '⚠️' : 'ℹ️');
    var fixBtn = (it.sev === 'info' && /locked/.test(it.label)) ? '' : '<button class="btn btn-sm btn-outline" data-fix="' + i + '" title="Ask the AI to fix this">🤖 Fix</button>';
    h += '<div class="doctor-item sev-' + it.sev + '"><span class="doctor-ico">' + ico + '</span><div class="doctor-body"><b>' + esc(it.label) + '</b><span>' + esc(it.detail) + '</span></div>' + fixBtn + '</div>';
  }
  list.innerHTML = h;
  var btns = list.querySelectorAll('[data-fix]');
  for (var j = 0; j < btns.length; j++) {
    btns[j].addEventListener('click', function() {
      var it = results[parseInt(this.getAttribute('data-fix'), 10)];
      if (!it) return;
      closeDoctor();
      var input = el('chat-input');
      var prompt = 'Deck Doctor found: ' + it.label + '. ' + it.detail + (it.slideId ? ' Fix slide id "' + it.slideId + '".' : ' Fix the deck.');
      if (input) input.value = prompt;
      sendChatMessage();
    });
  }
}

function openDoctor() {
  renderDoctorModal(runDeckChecks());
  var ov = el('doctor-overlay');
  if (ov) ov.style.display = 'flex';
}
function closeDoctor() {
  var ov = el('doctor-overlay');
  if (ov) ov.style.display = 'none';
}

/* ═══════════════════════════════════════════
   PHASE 1 — AUTO SPEAKER NOTES
   ═══════════════════════════════════════════ */
function generateAllNotes() {
  if (!canWrite()) return;
  if (_aiCallActive) { try { tool.notify('An AI request is already running', 'warning'); } catch (e) {} return; }
  if (!DB.pres.slides.length) {
    try { tool.notify('No slides to write notes for', 'warning'); } catch (e) {}
    return;
  }
  var slides = DB.pres.slides;
  var beforePres = JSON.parse(JSON.stringify(DB.pres));
  var beforeActive = DB.activeSlideId;
  var promptParts = [
    'You are a presentation coach. Write short speaker notes for EVERY slide in the deck below.',
    '=== DECK ===',
    deckStateBlock(),
    '=== TASK ===',
    'For each slide write 2-4 spoken sentences the presenter can read aloud: hook the audience, explain the slide content, and include a transition to the next slide. Write notes even for locked slides (notes are not content edits).',
    'Return ONLY valid JSON: {"patches":[{"op":"notes","id":"<slide id>","notes":"..."}],"summary":"one short sentence"}. Include exactly one notes patch per slide.'
  ];
  var prompt = promptParts.join('\n');

  _aiCallActive = true;
  _setAiUIActive(true);
  updateConnStatus('busy');
  showThinkingBubble('🗒 Writing speaker notes for ' + slides.length + ' slides…', true);
  setAiTimeout(prompt.length);

  var full = '';
  var started = Date.now();
  var token = { cancelled: false };
  _reqToken = token;

  function finishNotes(raw) {
    if (token.cancelled) return;
    if (_aiTimeoutId) { clearTimeout(_aiTimeoutId); _aiTimeoutId = null; }
    var parsed = parseAIResponse(raw);
    var notesPatches = [];
    if (parsed && parsed.json && parsed.json.patches) {
      for (var p = 0; p < parsed.json.patches.length; p++) {
        var patch = parsed.json.patches[p];
        if (patch && patch.op === 'notes' && patch.id && String(patch.notes || '').length) notesPatches.push(patch);
      }
    }
    if (!notesPatches.length) {
      hideThinkingBubble();
      _aiCallActive = false;
      _setAiUIActive(false);
      updateConnStatus('ok');
      addChatMessage('ai', '⚠️ The AI could not produce speaker notes. Try again or ask in the chat: "write speaker notes".', { isError: true });
      persist();
      renderChatMessages();
      return;
    }
    var applied = 0;
    for (var q = 0; q < notesPatches.length; q++) {
      var np = notesPatches[q];
      var idx = slideIndexById(np.id);
      if (idx === -1) continue;
      DB.pres.slides[idx].notes = String(np.notes || '').substring(0, 4000);
      applied++;
    }
    hideThinkingBubble();
    _aiCallActive = false;
    _setAiUIActive(false);
    updateConnStatus('ok');
    if (applied) {
      pushHistoryRaw(beforePres, beforeActive, 'AI: speaker notes (' + applied + ' slides)');
      _aiJustUpdated = true;
      persist();
      renderAll();
      updatePreview();
      renderSlidesList();
      var summary = (parsed.json && parsed.json.summary) ? String(parsed.json.summary) : 'Speaker notes written for ' + applied + ' slides.';
      addChatMessage('ai', '🗒 ' + summary, { doctor: runDeckChecks() });
      renderChatMessages();
      try { tool.notify('🗒 Speaker notes written for ' + applied + ' slides', 'success'); } catch (e) {}
    }
  }

  function failNotes(err) {
    if (token.cancelled) return;
    if (_aiTimeoutId) { clearTimeout(_aiTimeoutId); _aiTimeoutId = null; }
    hideThinkingBubble();
    _aiCallActive = false;
    _setAiUIActive(false);
    updateConnStatus('error');
    addChatMessage('ai', '⚠️ Notes generation failed: ' + (err && err.message ? err.message : String(err || 'unknown error')), { isError: true });
    persist();
    renderChatMessages();
  }

  if (typeof tool.requestAIStream === 'function') {
    try {
      tool.requestAIStream(prompt, '', {
        onToken: function(t) {
          if (token.cancelled) return;
          full += t;
          if (_thinkingMsgEl) {
            var elapsed = Math.round((Date.now() - _thinkingStartTime) / 1000);
            _thinkingMsgEl.textContent = '🗒 Writing speaker notes… ' + full.length + ' chars · ' + elapsed + 's';
          }
        },
        onComplete: function() { finishNotes(full); },
        onError: function(err) { failNotes(err); }
      });
    } catch (e) {
      failNotes(e);
    }
  } else {
    try {
      tool.requestAI(prompt).then(function(res) {
        finishNotes(res && res.text ? res.text : String(res || ''));
      }).catch(function(err) {
        failNotes(err);
      });
    } catch (e) {
      failNotes(e);
    }
  }
}

/* ═══════════════════════════════════════════
   PHASE 1 — DRAG & DROP REORDER
   ═══════════════════════════════════════════ */
function reorderSlide(dragId, targetId) {
  if (!canWrite()) return;
  var fi = slideIndexById(dragId);
  var ti = slideIndexById(targetId);
  if (fi === -1 || ti === -1 || fi === ti) return;
  pushHistory('Reorder slides');
  var moved = DB.pres.slides.splice(fi, 1)[0];
  ti = slideIndexById(targetId);
  if (ti === -1) ti = DB.pres.slides.length;
  DB.pres.slides.splice(ti, 0, moved);
  fixActiveSlide();
  persist();
  renderAll();
  updatePreview();
}

function bindSlideDrag(card, sid) {
  if (!card) return;
  card.setAttribute('draggable', 'true');
  card.addEventListener('dragstart', function(e) {
    _dragSlideId = sid;
    card.classList.add('dragging');
    try {
      e.dataTransfer.setData('text/plain', sid);
      e.dataTransfer.effectAllowed = 'move';
    } catch (err) {}
  });
  card.addEventListener('dragend', function() {
    _dragSlideId = null;
    card.classList.remove('dragging');
    var overs = document.querySelectorAll('.slide-card.drag-over');
    for (var o = 0; o < overs.length; o++) overs[o].classList.remove('drag-over');
  });
  card.addEventListener('dragover', function(e) {
    if (!_dragSlideId || _dragSlideId === sid) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
    card.classList.add('drag-over');
  });
  card.addEventListener('dragleave', function() {
    card.classList.remove('drag-over');
  });
  card.addEventListener('drop', function(e) {
    e.preventDefault();
    card.classList.remove('drag-over');
    if (!_dragSlideId || _dragSlideId === sid) return;
    var dragId = _dragSlideId;
    _dragSlideId = null;
    reorderSlide(dragId, sid);
  });
}

/* ═══════════════════════════════════════════
   PHASE 1 — LOCK SLIDES
   ═══════════════════════════════════════════ */
function toggleLockSlide(id) {
  if (!canWrite()) return;
  var idx = slideIndexById(id);
  if (idx === -1) return;
  pushHistory('Lock/unlock slide ' + (idx + 1));
  DB.pres.slides[idx].locked = !DB.pres.slides[idx].locked;
  persist();
  renderStrip();
  renderSlidesList();
  updatePreview();
}

/* ═══════════════════════════════════════════
   PHASE 2 — SHARED AI TASK RUNNER
   Sends one prompt, applies returned patches, handles history/UI.
   ═══════════════════════════════════════════ */
function applyTheme(key) {
  if (!THEMES[key]) return;
  pushHistory('Theme: ' + key);
  DB.pres.theme = key;
  persist();
  renderStrip();
  updatePreview();
  syncThemeSelect();
  addChatMessage('ai', '🎨 Theme switched to **' + THEMES[key].name + '**.', {});
  try { tool.notify('Theme: ' + THEMES[key].name, 'success'); } catch (e) {}
}

function runAiPatchesTask(label, prompt) {
  if (_aiCallActive) { try { tool.notify('An AI request is already running', 'warning'); } catch (e) {} return; }
  var beforePres = JSON.parse(JSON.stringify(DB.pres));
  var beforeActive = DB.activeSlideId;
  _aiCallActive = true;
  _setAiUIActive(true);
  updateConnStatus('busy');
  showThinkingBubble(label, true);
  setAiTimeout(prompt.length);
  var tok = { cancelled: false };
  _reqToken = tok;
  var full = '';

  function finish(raw) {
    if (tok.cancelled) return;
    if (_aiTimeoutId) { clearTimeout(_aiTimeoutId); _aiTimeoutId = null; }
    hideThinkingBubble();
    _aiCallActive = false;
    _setAiUIActive(false);
    updateConnStatus('ok');
    var parsed = parseAIResponse(raw);
    var applied = 0;
    if (parsed.json && Array.isArray(parsed.json.patches)) {
      for (var p = 0; p < parsed.json.patches.length; p++) {
        if (applyPatchOp(parsed.json.patches[p])) applied++;
      }
    }
    var summary = (parsed.json && parsed.json.summary) ? String(parsed.json.summary) : '';
    if (applied) {
      pushHistoryRaw(beforePres, beforeActive, 'AI: ' + String(label || 'task').substring(0, 50));
      _aiJustUpdated = true;
      persist();
      renderAll();
      updatePreview();
      syncThemeSelect();
      updateHistoryButtons();
      addChatMessage('ai', '✅ ' + (summary || (String(label) + ' done.')), { version: DB.version, doctor: runDeckChecks() });
      renderChatMessages();
      try { tool.notify(String(label) + ' — done (' + applied + ' patch(es)).', 'success'); } catch (e) {}
    } else {
      addChatMessage('ai', '⚠️ The AI could not complete "' + String(label) + '": ' + (summary || 'no patches returned. Try again or rephrase.'), { isError: true });
      persist();
      renderChatMessages();
    }
    tool.resize();
  }

  function fail(err) {
    if (tok.cancelled) return;
    if (_aiTimeoutId) { clearTimeout(_aiTimeoutId); _aiTimeoutId = null; }
    hideThinkingBubble();
    _aiCallActive = false;
    _setAiUIActive(false);
    updateConnStatus('error');
    addChatMessage('ai', '⚠️ "' + String(label) + '" failed: ' + (err && err.message ? err.message : String(err || 'unknown error')), { isError: true });
    persist();
    renderChatMessages();
    tool.resize();
  }

  if (typeof tool.requestAIStream === 'function') {
    try {
      tool.requestAIStream(prompt, '', {
        onToken: function(t) { if (tok.cancelled) return; full += t; },
        onComplete: function() { finish(full); },
        onError: function(err) { fail(err); }
      });
    } catch (e) { fail(e); }
  } else {
    try {
      tool.requestAI(prompt, '', function(err, res) {
        if (err) { fail(err); return; }
        finish(typeof res === 'string' ? res : String((res && res.text) || ''));
      });
    } catch (e) { fail(e); }
  }
}

/* ═══════════════════════════════════════════
   PHASE 2 — A1 AGENTIC MULTI-STEP BUILDS
   ═══════════════════════════════════════════ */
function _shouldPlan(msg) {
  var m = String(msg || '');
  var n = parseInt((/\b(\d{1,2})\s*-?\s*slides?\b/i.exec(m) || [])[1], 10);
  if (n >= 8 && /\b(slide|deck|presentation|training|course|pitch|workshop|lecture)\b/i.test(m)) return true;
  var verbs = (m.match(/\b(build|create|make|generate|prepare|design|write)\b/gi) || []).length;
  return /\b(slides?|deck|presentation|training|course|workshop)\b/i.test(m) && m.length >= 80 && verbs >= 2;
}

function sendChatMessageAgentic(msg, tok) {
  var beforePres = JSON.parse(JSON.stringify(DB.pres));
  var beforeActive = DB.activeSlideId;
  var planPrompt = [
    'You are planning a slide deck. Do NOT write slide content yet.',
    'Return ONLY JSON: {"title":"deck title","summary":"one sentence","slides":[{"title":"slide title","hint":"what components to include"}]}.',
    'Rules: 6-12 slides; one clear idea per slide; slide 1 is a cover (title-slide), include an agenda slide, and end with a closing slide.',
    'USER REQUEST: ' + msg
  ].join('\n');
  _aiCallActive = true;
  _setAiUIActive(true);
  updateConnStatus('busy');
  showThinkingBubble('🧭 Planning the deck…', false);
  setAiTimeout(planPrompt.length);
  var planStart = Date.now();

  function doPlan(raw, err) {
    if (tok.cancelled) return;
    clearAiTimeout();
    _markThinkingComplete(Date.now() - planStart);
    var parsed = raw ? parseAIResponse(raw) : null;
    var json = parsed && parsed.json;
    if (!json || !Array.isArray(json.slides) || !json.slides.length) {
      /* plan failed — fall back to a single full-deck call */
      hideThinkingBubble();
      _aiCallActive = false;
      _setAiUIActive(false);
      updateConnStatus('ok');
      _generateSingle(msg, tok);
      return;
    }
    var tasks = json.slides.slice(0, 12).map(function(s, i) {
      return { title: String((s && s.title) || ('Slide ' + (i + 1))).substring(0, 100), hint: String((s && s.hint) || '').substring(0, 200) };
    });
    if (json.title) { DB.pres.title = String(json.title).substring(0, 140); }
    hideThinkingBubble();
    _addPlanMessage(tasks);
    _execSteps(tasks, beforePres, beforeActive, tok, json);
  }

  try {
    if (typeof tool.requestAIStream === 'function') {
      var full = '';
      tool.requestAIStream(planPrompt, '', {
        onToken: function(t) { if (tok.cancelled) return; full += t; },
        onComplete: function() { doPlan(full, null); },
        onError: function(e) { doPlan('', e); }
      });
    } else {
      tool.requestAI(planPrompt, '', function(err, res) { doPlan(typeof res === 'string' ? res : String((res && res.text) || ''), err); });
    }
  } catch (e) {
    doPlan('', e);
  }
}

function _addPlanMessage(tasks) {
  addChatMessage('plan', '', { tasks: tasks.map(function(t) { return { title: t.title, status: 'todo' }; }) });
}

function _updatePlanTask(i, status) {
  var last = DB.chatMessages[DB.chatMessages.length - 1];
  if (last && last.role === 'plan' && last.tasks && last.tasks[i]) last.tasks[i].status = status;
  var box = el('chat-messages');
  if (!box) return;
  var items = box.querySelectorAll('.plan-task');
  var it = items[i];
  if (it) {
    it.className = 'plan-task st-' + status;
    var chk = it.querySelector('.plan-check');
    if (chk) chk.textContent = status === 'done' ? '✅' : (status === 'error' ? '⚠️' : (status === 'doing' ? '⏳' : '○'));
  }
}

function _execSteps(tasks, beforePres, beforeActive, tok, planJson) {
  var i = 0;
  function next() {
    if (tok.cancelled) return;
    if (i >= tasks.length) { _finishPlan(tasks, beforePres, beforeActive, tok, planJson); return; }
    var t = tasks[i];
    _updatePlanTask(i, 'doing');
    showThinkingBubble('🎞️ Building slide ' + (i + 1) + ' / ' + tasks.length + ' — ' + t.title, false);
    updateConnStatus('busy');
    var sp = [
      'Build EXACTLY ONE slide. Return ONLY JSON: {"slide":{"id":"...","title":"...","notes":"...","components":[...]}}.',
      '=== TARGET SLIDE ===',
      'Position: ' + (i + 1) + ' of ' + tasks.length + '. Title: ' + t.title + (t.hint ? ' — include: ' + t.hint : '') + '.',
      i === 0 ? 'This is the COVER — use a title-slide component.' : (i === tasks.length - 1 ? 'This is the CLOSING — use a closing-slide component.' : ''),
      '=== DECK SO FAR ===',
      deckStateBlock(),
      '=== COMPONENT LIBRARY ===',
      libraryCatalog(),
      '=== DESIGN RULES ===',
      'Real content, no lorem ipsum. Language: ' + _p('lang', 'en') + '. Keep text short (max ~5 bullets, ~10 words each).'
    ].join('\n');
    setAiTimeout(sp.length);
    var stepStart = Date.now();
    function done(raw, err) {
      if (tok.cancelled) return;
      clearAiTimeout();
      _markThinkingComplete(Date.now() - stepStart);
      if (raw && !err) {
        var parsed = parseAIResponse(raw);
        var slide = parsed.json && (parsed.json.slide || (Array.isArray(parsed.json.slides) ? parsed.json.slides[0] : null));
        if (slide && slide.components) {
          applyPatchOp({ op: 'upsertSlide', slide: slide });
          _updatePlanTask(i, 'done');
        } else {
          _updatePlanTask(i, 'error');
        }
      } else {
        _updatePlanTask(i, 'error');
      }
      hideThinkingBubble();
      i++;
      next();
    }
    try {
      if (typeof tool.requestAIStream === 'function') {
        var full = '';
        tool.requestAIStream(sp, '', {
          onToken: function(tk) { if (tok.cancelled) return; full += tk; },
          onComplete: function() { done(full, null); },
          onError: function(e) { done('', e); }
        });
      } else {
        tool.requestAI(sp, '', function(err, res) { done(typeof res === 'string' ? res : String((res && res.text) || ''), err); });
      }
    } catch (e) { done('', e); }
  }
  next();
}

function _finishPlan(tasks, beforePres, beforeActive, tok, planJson) {
  hideThinkingBubble();
  _aiCallActive = false;
  _reqToken = null;
  clearAiTimeout();
  _setAiUIActive(false);
  updateConnStatus('ok');
  var beforeJson = JSON.stringify(beforePres);
  var changed = beforeJson !== JSON.stringify(DB.pres) || beforeActive !== DB.activeSlideId;
  if (changed) pushHistoryRaw(beforePres, beforeActive, 'AI: agentic build (' + tasks.length + ' slides)');
  if (changed) {
    _bumpVersion('minor');
    _aiJustUpdated = true;
  }
  fixActiveSlide();
  persist();
  renderAll();
  updatePreview();
  syncThemeSelect();
  updateHistoryButtons();
  var docRes = runDeckChecks();
  var doneCount = tasks.filter(function(t) { return t.status === 'done'; }).length;
  var summary = '✅ Built ' + doneCount + ' of ' + tasks.length + ' slides step by step — ' + DB.pres.slides.length + ' slide(s) in the deck.' +
    (planJson && planJson.summary ? ' ' + String(planJson.summary) : '');
  addChatMessage('ai', summary, { options: fallbackDeckSuggestions(), slideOptions: fallbackSlideSuggestions(), version: DB.version, doctor: docRes });
  try {
    tool.notify(changed ? '💾 Deck saved — v' + DB.version : 'No deck changes applied', changed ? 'success' : 'info');
    if (docRes.failed > 0 || docRes.warned > 0) tool.notify('🧪 Deck Doctor: ' + docRes.failed + ' problem(s), ' + docRes.warned + ' warning(s)', 'info');
  } catch (e) {}
  tool.resize();
}

/* ═══════════════════════════════════════════
   PHASE 2 — A5 SLASH COMMANDS
   ═══════════════════════════════════════════ */
function handleSlashCommand(msg) {
  var m = /^\/([a-z]+)\s*(.*)$/i.exec(msg.trim());
  if (!m) return null;
  var cmd = m[1].toLowerCase();
  var arg = m[2].trim();
  if (cmd === 'notes') { generateAllNotes(); return 'done'; }
  if (cmd === 'restyle') {
    var key = String(arg || '').toLowerCase();
    if (THEMES[key]) { applyTheme(key); return 'done'; }
    return 'Restyle the whole deck with the ' + (key || 'a fresh look') + ' theme. Pick a theme: dark, corporate, playful, minimal, editorial, warm.';
  }
  if (cmd === 'split') { openSplitter(); return 'done'; }
  if (cmd === 'translate') { openTranslate(arg); return 'done'; }
  if (cmd === 'review') {
    return 'Review my deck like a professional presentation coach. Return {"review":{"findings":[{"slideId":"<id>","issue":"...","suggestion":"..."}],"score":<0-10>,"summary":"..."}} with one finding per weak slide.';
  }
  if (cmd === 'outline') {
    return 'Create an agenda slide that reflects the current deck, and re-check that the whole deck follows a logical story arc.';
  }
  if (cmd === 'quiz') {
    return 'Add an interactive quiz slide with 3 questions covering the most important points of this deck.';
  }
  if (cmd === 'summarize') {
    return 'Add a key-takeaways summary slide capturing the most important points of this deck, placed before the closing slide.';
  }
  if (cmd === 'variants') {
    var idx = arg ? findSlideIndexByIdOrTitle(arg) : Math.max(0, activeSlideIndex());
    if (idx === -1) return 'Give me 3 design variants of the current slide.';
    var s = DB.pres.slides[idx];
    return 'Give me 3 design variants for slide "' + s.title + '" (id: ' + s.id + '). Return ONLY {"variants":[{"label":"A","slide":{...}},{"label":"B","slide":{...}},{"label":"C","slide":{...}}],"slideId":"' + s.id + '"} — do NOT modify the deck yet.';
  }
  return null;
}

/* ═══════════════════════════════════════════
   PHASE 2 — A3 DESIGN VARIANTS
   ═══════════════════════════════════════════ */
function applyVariant(btn) {
  if (!canWrite()) return;
  var mi = parseInt(btn.getAttribute('data-vmsg'), 10);
  var vi = parseInt(btn.getAttribute('data-vidx'), 10);
  var msg = DB.chatMessages[mi];
  if (!msg || !msg.variants || !msg.variants[vi]) return;
  var variant = msg.variants[vi];
  var slide = variant.slide;
  if (!slide) return;
  var idx = slide.id ? slideIndexById(slide.id) : (slide.title ? findSlideIndexByIdOrTitle(slide.title) : -1);
  if (idx === -1) idx = Math.max(0, activeSlideIndex());
  var existing = DB.pres.slides[idx];
  var fixed = normalizeSlide(slide, idx);
  fixed.id = existing.id;
  fixed.locked = existing.locked;
  if (!slide.title) fixed.title = existing.title;
  pushHistory('Variant: ' + String(variant.label || '') + ' → slide ' + (idx + 1));
  DB.pres.slides[idx] = fixed;
  _aiJustUpdated = true;
  persist();
  renderAll();
  updatePreview();
  try { tool.notify('Variant ' + (variant.label || '') + ' applied to slide ' + (idx + 1), 'success'); } catch (e) {}
}

/* ═══════════════════════════════════════════
   PHASE 2 — A7 REVIEW FIX
   ═══════════════════════════════════════════ */
function handleReviewFix(btn) {
  var sid = btn.getAttribute('data-fix-sid');
  var issue = btn.getAttribute('data-fix-issue');
  var sug = btn.getAttribute('data-fix-sug');
  var inp = el('chat-input');
  if (!inp) return;
  if (sid) {
    setTargetSlide(sid);
    var idx = slideIndexById(sid);
    inp.value = 'Fix slide "' + (idx !== -1 ? DB.pres.slides[idx].title : sid) + '" (id: ' + sid + '): ' + issue + ' — ' + sug;
  } else {
    inp.value = 'Fix the deck: ' + issue + ' — ' + sug;
  }
  inp.style.height = 'auto';
  switchChatTab('chat');
  inp.focus();
}

/* ═══════════════════════════════════════════
   PHASE 2 — C2 SLIDE INSPECTOR DRAWER
   ═══════════════════════════════════════════ */
var _inspectorSlideId = '';
function openInspector(id) {
  var idx = slideIndexById(id);
  if (idx === -1) return;
  _inspectorSlideId = id;
  var s = DB.pres.slides[idx];
  var t = el('insp-title'); if (t) t.value = s.title || '';
  var n = el('insp-notes'); if (n) n.value = s.notes || '';
  var du = el('insp-duration'); if (du) du.value = s.duration ? String(s.duration) : '';
  var tr = el('insp-transition'); if (tr) tr.value = s.transition || '';
  var bg = el('insp-bg'); if (bg) bg.value = s.background || '';
  var lk = el('insp-locked'); if (lk) lk.checked = !!s.locked;
  var drawer = el('inspector-drawer');
  if (drawer) drawer.classList.add('open');
}
function closeInspector() {
  var drawer = el('inspector-drawer');
  if (drawer) drawer.classList.remove('open');
  _inspectorSlideId = '';
}
function commitInspector() {
  var idx = slideIndexById(_inspectorSlideId);
  if (idx === -1 || !canWrite()) return;
  var s = DB.pres.slides[idx];
  var changed = false;
  var t = el('insp-title');
  if (t && String(t.value).trim() && String(t.value).trim() !== s.title) { s.title = String(t.value).trim().substring(0, 120); changed = true; }
  var n = el('insp-notes');
  if (n && String(n.value) !== String(s.notes || '')) { s.notes = String(n.value || '').substring(0, 4000); changed = true; }
  var du = el('insp-duration');
  if (du) {
    var dnum = parseInt(du.value, 10) || 0;
    if (dnum !== (s.duration || 0)) { s.duration = Math.max(0, dnum); changed = true; }
  }
  var tr = el('insp-transition');
  if (tr && String(tr.value) !== String(s.transition || '')) { s.transition = ['slide', 'zoom', 'flip'].indexOf(String(tr.value)) !== -1 ? String(tr.value) : ''; changed = true; }
  var bg = el('insp-bg');
  if (bg && String(bg.value) !== String(s.background || '')) { s.background = String(bg.value || '').substring(0, 500); changed = true; }
  var lk = el('insp-locked');
  if (lk && !!lk.checked !== !!s.locked) { s.locked = !!lk.checked; changed = true; }
  if (changed) {
    pushHistory('Inspector edit — slide ' + (idx + 1));
    persist();
    renderStrip();
    renderSlidesList();
    updatePreview();
  }
}

/* ═══════════════════════════════════════════
   PHASE 2 — C5 SNIPPET LIBRARY
   ═══════════════════════════════════════════ */
function saveSlideAsSnippet(id) {
  var idx = slideIndexById(id);
  if (idx === -1) return;
  var s = DB.pres.slides[idx];
  var snip = { id: genId(), name: (s.title || ('Slide ' + (idx + 1))).substring(0, 80), components: JSON.parse(JSON.stringify(s.components || [])), created: new Date().toISOString() };
  DB.snippets.unshift(snip);
  if (DB.snippets.length > 20) DB.snippets = DB.snippets.slice(0, 20);
  persist();
  renderSnippetsModal();
  try { tool.notify('💾 Snippet saved: ' + snip.name, 'success'); } catch (e) {}
}
function insertSnippet(snipId) {
  if (!canWrite()) return;
  var snip = null;
  for (var i = 0; i < DB.snippets.length; i++) {
    if (DB.snippets[i].id === snipId) { snip = DB.snippets[i]; break; }
  }
  if (!snip) return;
  pushHistory('Insert snippet');
  var slide = { id: genId(), title: snip.name, notes: '', locked: false, components: JSON.parse(JSON.stringify(snip.components || [])) };
  DB.pres.slides.push(slide);
  DB.activeSlideId = slide.id;
  _activeSlideIndex = DB.pres.slides.length - 1;
  persist();
  renderAll();
  updatePreview();
  closeSnippets();
  switchTab('present');
  try { tool.notify('Snippet inserted as slide ' + DB.pres.slides.length, 'success'); } catch (e) {}
}
function deleteSnippet(snipId) {
  for (var i = 0; i < DB.snippets.length; i++) {
    if (DB.snippets[i].id === snipId) { DB.snippets.splice(i, 1); break; }
  }
  persist();
  renderSnippetsModal();
}
function renderSnippetsModal() {
  var list = el('snippets-list');
  if (!list) return;
  if (!DB.snippets.length) {
    list.innerHTML = '<div class="modal-empty">No snippets yet. Open a slide\'s ✏️ inspector and press "💾 Save as snippet" — or use the button below.</div>';
    return;
  }
  var h = '';
  for (var i = 0; i < DB.snippets.length; i++) {
    var sn = DB.snippets[i];
    h += '<div class="snippet-row"><div class="snippet-info"><b>' + esc(sn.name) + '</b><span>' + sn.components.length + ' component(s) · ' + sn.components.slice(0, 3).map(function(c) { return c.type; }).join(' · ') + '</span></div>' +
      '<button class="btn btn-sm btn-primary" data-insert="' + esc(sn.id) + '">Insert as slide</button>' +
      '<button class="btn-icon danger" data-snipdel="' + esc(sn.id) + '" title="Delete snippet">✕</button></div>';
  }
  list.innerHTML = h;
  var ins = list.querySelectorAll('[data-insert]');
  for (var j = 0; j < ins.length; j++) {
    ins[j].onclick = function() { insertSnippet(this.getAttribute('data-insert')); };
  }
  var dels = list.querySelectorAll('[data-snipdel]');
  for (var k = 0; k < dels.length; k++) {
    dels[k].onclick = function() { deleteSnippet(this.getAttribute('data-snipdel')); };
  }
}
function openSnippets() {
  renderSnippetsModal();
  var ov = el('snippets-overlay');
  if (ov) ov.style.display = 'flex';
}
function closeSnippets() {
  var ov = el('snippets-overlay');
  if (ov) ov.style.display = 'none';
}

/* ═══════════════════════════════════════════
   PHASE 2 — D1 DATASETS (live charts)
   ═══════════════════════════════════════════ */
function renderDatasetsModal() {
  var ta = el('datasets-json');
  if (ta) ta.value = JSON.stringify(DB.pres.datasets || {}, null, 2);
}
function applyDatasets() {
  var ta = el('datasets-json');
  if (!ta || !canWrite()) return;
  var obj = null;
  try { obj = JSON.parse(ta.value); } catch (e) { try { tool.notify('Invalid JSON: ' + e.message, 'error'); } catch (e2) {} return; }
  if (!obj || typeof obj !== 'object') { try { tool.notify('Datasets must be a JSON object.', 'error'); } catch (e) {} return; }
  pushHistory('Update datasets');
  DB.pres.datasets = normalizeDatasets(obj);
  persist();
  updatePreview();
  closeDatasets();
  try { tool.notify('Datasets updated — charts referencing them refreshed.', 'success'); } catch (e) {}
}
function openDatasets() {
  renderDatasetsModal();
  var ov = el('datasets-overlay');
  if (ov) ov.style.display = 'flex';
}
function closeDatasets() {
  var ov = el('datasets-overlay');
  if (ov) ov.style.display = 'none';
}

/* ═══════════════════════════════════════════
   PHASE 2 — C6 OUTLINE FROM TEXT / PDF
   ═══════════════════════════════════════════ */
function openOutlineModal() {
  var ov = el('outline-overlay');
  if (ov) ov.style.display = 'flex';
}
function closeOutlineModal() {
  var ov = el('outline-overlay');
  if (ov) ov.style.display = 'none';
}
function outlineUpload() {
  try {
    tool.requestUpload(function(err, file) {
      if (err) { try { tool.notify('Upload failed: ' + err, 'error'); } catch (e) {} return; }
      if (!file || !file.url) return;
      tool.requestFileContent(file.url, function(err2, text) {
        if (err2) { try { tool.notify('Could not read the file: ' + err2, 'error'); } catch (e) {} return; }
        var ta = el('outline-text');
        if (ta) { ta.value = String(text || '').substring(0, 20000); }
        try { tool.notify('File content loaded — review it, then press Generate.', 'info'); } catch (e) {}
      });
    });
  } catch (e) { try { tool.notify('Upload unavailable: ' + e.message, 'warning'); } catch (e2) {} }
}
function runOutlineGeneration() {
  var ta = el('outline-text');
  if (!ta) return;
  var text = String(ta.value || '').trim();
  if (!text) { try { tool.notify('Paste some text or upload a PDF first.', 'warning'); } catch (e) {} return; }
  if (_aiCallActive) { try { tool.notify('An AI request is already running', 'warning'); } catch (e) {} return; }
  var beforePres = JSON.parse(JSON.stringify(DB.pres));
  var beforeActive = DB.activeSlideId;
  var prompt = [
    'Convert this raw material into a slide deck OUTLINE. Return ONLY JSON:',
    '{"title":"deck title","outline":[{"title":"slide title","components":["bullets","figure"]}]}',
    'Use ONLY component types from the library: ' + libraryCatalog().split('\n').map(function(l) { return '"' + l.split('"')[1] + '"'; }).join(', ') + '.',
    '6-12 slides. First slide is a cover (title-slide), include an agenda, end with a closing slide.',
    'MATERIAL:',
    text.substring(0, 8000)
  ].join('\n');
  _aiCallActive = true;
  _setAiUIActive(true);
  updateConnStatus('busy');
  showThinkingBubble('📄 Converting to an outline…', true);
  setAiTimeout(prompt.length);
  var tok = { cancelled: false };
  _reqToken = tok;
  var full = '';
  function finish(raw) {
    if (tok.cancelled) return;
    clearAiTimeout();
    hideThinkingBubble();
    _aiCallActive = false;
    _setAiUIActive(false);
    updateConnStatus('ok');
    var parsed = parseAIResponse(raw);
    var json = parsed.json;
    var outline = json && Array.isArray(json.outline) ? json.outline : null;
    if (outline && outline.length) {
      if (json.title) DB.pres.title = String(json.title).substring(0, 140);
      for (var i = 0; i < outline.length; i++) {
        var o = outline[i];
        var title = String((o && o.title) || ('Slide ' + (i + 1))).substring(0, 120);
        var comps = [];
        var hint = (o && Array.isArray(o.components) && o.components.length) ? o.components : ['bullets'];
        comps.push({ type: 'heading', data: { text: title } });
        for (var c = 0; c < hint.length && comps.length < 3; c++) {
          var type = String(hint[c]);
          if (type === 'bullets') comps.push({ type: 'bullets', data: { items: [{ text: 'Key point — add details here' }] } });
          else if (PRES_COMPONENTS[type] && !PRES_ALIAS_KEYS[type] && ['bullets', 'heading', 'paragraph'].indexOf(type) === -1) comps.push({ type: type, data: {} });
        }
        DB.pres.slides.push({ id: genId(), title: title, notes: '', locked: false, components: comps });
      }
      pushHistoryRaw(beforePres, beforeActive, 'AI: outline scaffold (' + outline.length + ' slides)');
      _aiJustUpdated = true;
      persist();
      renderAll();
      updatePreview();
      closeOutlineModal();
      addChatMessage('ai', '✅ Scaffolded ' + outline.length + ' slide(s) from your material. Now chat to refine each slide.', { doctor: runDeckChecks() });
      renderChatMessages();
      try { tool.notify('Outline scaffolded — ' + outline.length + ' slide(s).', 'success'); } catch (e) {}
    } else {
      addChatMessage('ai', '⚠️ The AI could not build an outline. Try a shorter text.', { isError: true });
      persist();
      renderChatMessages();
    }
    tool.resize();
  }
  function fail(err) {
    if (tok.cancelled) return;
    clearAiTimeout();
    hideThinkingBubble();
    _aiCallActive = false;
    _setAiUIActive(false);
    updateConnStatus('error');
    addChatMessage('ai', '⚠️ Outline generation failed: ' + (err && err.message ? err.message : String(err || 'unknown')), { isError: true });
    persist();
    renderChatMessages();
    tool.resize();
  }
  try {
    if (typeof tool.requestAIStream === 'function') {
      tool.requestAIStream(prompt, '', {
        onToken: function(t) { if (tok.cancelled) return; full += t; },
        onComplete: function() { finish(full); },
        onError: function(err) { fail(err); }
      });
    } else {
      tool.requestAI(prompt, '', function(err, res) { if (err) { fail(err); return; } finish(typeof res === 'string' ? res : String((res && res.text) || '')); });
    }
  } catch (e) { fail(e); }
}

/* ═══════════════════════════════════════════
   PHASE 2 — D4 STORY ARC ADVISOR
   ═══════════════════════════════════════════ */
function runStoryArc() {
  var slides = DB.pres.slides || [];
  var findings = [];
  function add(sev, label, detail, fix) { findings.push({ sev: sev, label: label, detail: detail || '', fix: fix || '' }); }
  if (!slides.length) {
    add('info', 'No slides yet', 'Build the deck first.');
    findings.score = 0;
    return findings;
  }
  var allText = slides.map(function(s) {
    return (s.title || '') + ' ' + (s.notes || '') + ' ' + s.components.map(function(c) { return JSON.stringify(c.data || {}); }).join(' ');
  }).join(' ').toLowerCase();
  var firstType = slides[0].components.length ? slides[0].components[0].type : '';
  if (firstType !== 'title-slide' && firstType !== 'section-slide') add('warn', 'No strong hook', 'Open with a cover (title-slide) that hooks the audience.', 'Make the first slide a cover with a strong hook.');
  var hasAgenda = slides.some(function(s) { return s.components.some(function(c) { return c.type === 'agenda'; }); });
  if (slides.length > 4 && !hasAgenda) add('warn', 'No agenda slide', 'An agenda sets expectations.', 'Add an agenda slide after the cover.');
  if (!/problem|challenge|pain|issue|gap/.test(allText)) add('warn', 'Missing problem statement', 'The arc needs a clear problem/challenge the audience recognizes.', 'Add a slide that states the problem or challenge clearly.');
  if (!/solution|approach|how it works|our way|fix|resolve/.test(allText)) add('warn', 'Missing solution step', 'State how you solve the problem.', 'Add a solution slide explaining the approach.');
  var hasProof = slides.some(function(s) { return s.components.some(function(c) { return /chart|stat|metric|number|gauge|table|figure/.test(c.type); }); });
  if (!hasProof) add('warn', 'No proof / evidence', 'Numbers or a visual prove your point.', 'Add a chart, metrics or a case study slide as proof.');
  var lastType = slides[slides.length - 1].components.length ? slides[slides.length - 1].components[0].type : '';
  if (lastType !== 'closing-slide' && !/next steps|contact|call to action|thank|questions/.test(slides[slides.length - 1].title.toLowerCase())) {
    add('warn', 'Weak closing', 'End with a closing slide (thanks, CTA or next steps).', 'Make the last slide a closing with a clear call to action.');
  }
  var score = Math.max(0, 10 - findings.filter(function(f) { return f.sev === 'warn'; }).length);
  findings.score = score;
  return findings;
}
function renderArcModal(findings) {
  var list = el('arc-list');
  if (!list) return;
  var h = '<div class="doctor-summary">Story arc score: <b>' + findings.score + '/10</b> · ' + (findings.score >= 9 ? 'excellent' : findings.score >= 7 ? 'solid' : findings.score >= 5 ? 'needs work' : 'weak') + '</div>';
  for (var i = 0; i < findings.length; i++) {
    var it = findings[i];
    var ico = it.sev === 'warn' ? '⚠️' : 'ℹ️';
    h += '<div class="doctor-item sev-' + it.sev + '"><span class="doctor-ico">' + ico + '</span><div class="doctor-body"><b>' + esc(it.label) + '</b><span>' + esc(it.detail) + '</span></div>' +
      (it.fix ? '<button class="btn btn-sm btn-outline" data-arcfix="' + i + '" title="Ask the AI to fix this">🤖 Fix</button>' : '') + '</div>';
  }
  list.innerHTML = h;
  var btns = list.querySelectorAll('[data-arcfix]');
  for (var j = 0; j < btns.length; j++) {
    btns[j].onclick = function() {
      var it = findings[parseInt(this.getAttribute('data-arcfix'), 10)];
      if (!it) return;
      closeArc();
      var inp = el('chat-input');
      if (inp) inp.value = 'Story arc advisor: ' + it.label + '. ' + it.detail + ' ' + it.fix;
      switchChatTab('chat');
      sendChatMessage();
    };
  }
}
function openArc() {
  renderArcModal(runStoryArc());
  var ov = el('arc-overlay');
  if (ov) ov.style.display = 'flex';
}
function closeArc() {
  var ov = el('arc-overlay');
  if (ov) ov.style.display = 'none';
}

/* ═══════════════════════════════════════════
   PHASE 2 — D5 ONE-CLICK TRANSLATION
   ═══════════════════════════════════════════ */
var LANG_NAMES = { en: 'English', tr: 'Türkçe', fr: 'Français', de: 'Deutsch', es: 'Español', ar: 'العربية' };
function openTranslate(preset) {
  var sel = el('translate-lang');
  if (sel) {
    if (!sel.dataset.filled) {
      sel.innerHTML = '';
      for (var k in LANG_NAMES) {
        if (!Object.prototype.hasOwnProperty.call(LANG_NAMES, k)) continue;
        var opt = document.createElement('option');
        opt.value = k;
        opt.textContent = LANG_NAMES[k];
        sel.appendChild(opt);
      }
      sel.dataset.filled = '1';
    }
    sel.value = (preset && LANG_NAMES[preset]) ? preset : (DB.pres.lang || _p('lang', 'en'));
  }
  var ov = el('translate-overlay');
  if (ov) ov.style.display = 'flex';
}
function closeTranslate() {
  var ov = el('translate-overlay');
  if (ov) ov.style.display = 'none';
}
function doTranslate() {
  var sel = el('translate-lang');
  if (!sel) return;
  var lang = String(sel.value || 'en');
  if (!DB.pres.slides.length) { try { tool.notify('No slides to translate.', 'warning'); } catch (e) {} return; }
  var prompt = [
    'Translate the ENTIRE deck into ' + (LANG_NAMES[lang] || lang) + ' (' + lang + ').',
    'Return ONLY JSON: {"patches":[{"op":"meta","title":"...","subtitle":"...","author":"..."},{"op":"upsertSlide","slide":{"id":"<existing id>","title":"...","notes":"...","components":[...translated...]}}, ...],"summary":"..."}.',
    'Keep the SAME slide ids and the same component types/structure — only translate the text inside.',
    'SKIP slides marked 🔒 LOCKED in the deck state.',
    '=== DECK ===',
    deckStateBlock()
  ].join('\n');
  closeTranslate();
  runAiPatchesTask('🌐 Translate to ' + (LANG_NAMES[lang] || lang), prompt);
  var doneHook = function() { DB.pres.lang = lang; };
  /* language stamp is applied right away so the next prompts use the new language */
  DB.pres.lang = lang;
  persist();
}

/* ═══════════════════════════════════════════
   PHASE 2 — D6 SMART SLIDE SPLITTER
   ═══════════════════════════════════════════ */
function runSplitCheck() {
  var slides = DB.pres.slides || [];
  var results = [];
  for (var i = 0; i < slides.length; i++) {
    var s = slides[i];
    if (s.locked) continue;
    var bulletCount = 0;
    var textLen = 0;
    for (var c = 0; c < s.components.length; c++) {
      var comp = s.components[c];
      if (comp.type === 'bullets') bulletCount += ((comp.data && comp.data.items) ? comp.data.items.length : 0);
      if (comp.type === 'paragraph') textLen += String((comp.data && (comp.data.text || comp.data.body)) || '').length;
    }
    if (bulletCount > 8) results.push({ slideId: s.id, label: 'Slide ' + (i + 1) + ' has ' + bulletCount + ' bullets', detail: 'Too dense — split it into two slides.' });
    if (textLen > 600) results.push({ slideId: s.id, label: 'Slide ' + (i + 1) + ' has a very long text', detail: 'Split the paragraphs across two slides.' });
  }
  return results;
}
function renderSplitModal(results) {
  var list = el('split-list');
  if (!list) return;
  if (!results.length) {
    list.innerHTML = '<div class="modal-empty">🎉 No overcrowded slides — every slide is comfortably packed.</div>';
    return;
  }
  var h = '';
  for (var i = 0; i < results.length; i++) {
    var it = results[i];
    h += '<div class="doctor-item sev-warn"><span class="doctor-ico">✂️</span><div class="doctor-body"><b>' + esc(it.label) + '</b><span>' + esc(it.detail) + '</span></div>' +
      '<button class="btn btn-sm btn-outline" data-splitfix="' + esc(it.slideId) + '">🤖 Split</button></div>';
  }
  list.innerHTML = h;
  var btns = list.querySelectorAll('[data-splitfix]');
  for (var j = 0; j < btns.length; j++) {
    btns[j].onclick = function() {
      var sid = this.getAttribute('data-splitfix');
      doSplitSlide(sid);
    };
  }
}
function openSplitter() {
  renderSplitModal(runSplitCheck());
  var ov = el('split-overlay');
  if (ov) ov.style.display = 'flex';
}
function closeSplitter() {
  var ov = el('split-overlay');
  if (ov) ov.style.display = 'none';
}
function doSplitSlide(id) {
  var idx = slideIndexById(id);
  if (idx === -1) return;
  var s = DB.pres.slides[idx];
  var prompt = [
    'Split this overcrowded slide into TWO slides.',
    'Return ONLY JSON: {"patches":[{"op":"upsertSlide","slide":{"id":"' + id + '","title":"' + s.title + '","components":[...first half...]}},{"op":"upsertSlide","slide":{"id":"<new-id>","title":"...","components":[...second half...]}}],"summary":"..."}.',
    'Keep the existing id for the first half, give the second half a NEW short kebab-case id. Distribute the content evenly.',
    '=== SLIDE ===',
    JSON.stringify(s.components).substring(0, 3000)
  ].join('\n');
  closeSplitter();
  runAiPatchesTask('✂️ Split slide ' + (idx + 1), prompt);
}

/* ═══════════════════════════════════════════
   PHASE 2 — F4 SHARE + F5 EMBED
   ═══════════════════════════════════════════ */
function shareLink() {
  if (!DB.pres.slides.length) { try { tool.notify('Nothing to share yet.', 'warning'); } catch (e) {} return; }
  var doc = buildStandalone();
  if (typeof tool.requestExportPdf === 'function') {
    try {
      tool.notify('Publishing the shareable file…', 'info');
      tool.requestExportPdf({ html: doc, filename: slugify(DB.pres.title), landscape: true }, function(err, file) {
        if (err) { try { tool.notify('Share failed: ' + err, 'error'); } catch (e) {} return; }
        var url = (file && file.url) || '';
        if (url) {
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(url).then(function() {
                try { tool.notify('🔗 Share link ready — copied to clipboard', 'success'); } catch (e) {}
              });
            }
          } catch (e) {}
          openEmbedModal(url);
        } else {
          try { tool.notify('Share file ready: ' + ((file && file.name) || 'download'), 'success'); } catch (e) {}
        }
      });
    } catch (e) {
      try { tool.notify('Share unavailable: ' + e.message, 'warning'); } catch (e2) {}
    }
  } else {
    try { tool.notify('Sharing is not enabled (allowExportPdf: yes).', 'warning'); } catch (e) {}
  }
}
function openEmbedModal(url) {
  var ta = el('embed-code');
  if (!ta) return;
  var fallback = 'https://your-cms.example.com/decks/' + slugify(DB.pres.title) + '.html';
  ta.value = '<iframe src="' + (url || fallback) + '" title="' + esc(DB.pres.title || 'Presentation').replace(/&quot;/g, '&amp;quot;') + '" style="width:100%;aspect-ratio:16/9;border:0;border-radius:12px" loading="lazy" allowfullscreen></iframe>';
  var ov = el('embed-overlay');
  if (ov) ov.style.display = 'flex';
}
function closeEmbedModal() {
  var ov = el('embed-overlay');
  if (ov) ov.style.display = 'none';
}
function copyEmbedCode() {
  var ta = el('embed-code');
  if (!ta) return;
  function fallback() {
    try {
      ta.select();
      document.execCommand('copy');
      try { tool.notify('Embed code copied.', 'success'); } catch (e) {}
    } catch (e2) { try { tool.notify('Copy failed — select the text manually.', 'error'); } catch (e3) {} }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ta.value).then(function() {
      try { tool.notify('Embed code copied.', 'success'); } catch (e) {}
    }).catch(fallback);
  } else fallback();
}

/* ═══════════════════════════════════════════
   PHASE 2 — H2 ACCESSIBILITY AUDIT
   ═══════════════════════════════════════════ */
function runA11yChecks() {
  var slides = DB.pres.slides || [];
  var results = [];
  function add(sev, label, detail, slideId) { results.push({ id: 'a11' + results.length, sev: sev, label: label, detail: detail || '', slideId: slideId || '' }); }
  if (!slides.length) {
    add('info', 'No slides yet', 'Build the deck first.');
    results.total = 1; results.failed = 0; results.warned = 0; results.passed = 1;
    return results;
  }
  for (var i = 0; i < slides.length; i++) {
    var s = slides[i];
    var hasHeading = s.components.some(function(c) { return ['heading', 'title-slide', 'section-slide', 'closing-slide', 'agenda'].indexOf(c.type) !== -1; });
    if (!hasHeading) add('warn', 'Slide ' + (i + 1) + ' has no heading', 'Screen readers navigate by headings.', s.id);
    for (var c = 0; c < s.components.length; c++) {
      var comp = s.components[c];
      var d = comp.data || {};
      if (comp.type === 'image') {
        if (!d.alt) add('fail', 'Image without alt text on slide ' + (i + 1), 'Describe the image for screen readers.', s.id);
        else if (String(d.alt).length < 5) add('warn', 'Very short alt text on slide ' + (i + 1), 'Alt text should describe the image meaningfully.', s.id);
      }
      if (comp.type === 'gallery') {
        var imgs = d.images || [];
        var missing = 0;
        for (var g = 0; g < imgs.length; g++) if (!(imgs[g] && imgs[g].alt)) missing++;
        if (missing) add('warn', missing + ' gallery image(s) without alt on slide ' + (i + 1), 'Add alt text to each gallery image.', s.id);
      }
      if (comp.type === 'video' && !d.title) add('warn', 'Video without a title on slide ' + (i + 1), 'Add a title describing the video.', s.id);
      if (typeof d.fontSize === 'number' && d.fontSize < 11) add('warn', 'Very small text on slide ' + (i + 1), 'Fonts below 11px are hard to read.', s.id);
      if (comp.type === 'html') add('info', 'Custom HTML block on slide ' + (i + 1), 'Check contrast, focus order and keyboard reachability manually.', s.id);
    }
  }
  var failed = 0, warned = 0, passed = 0;
  for (var r = 0; r < results.length; r++) {
    if (results[r].sev === 'fail') failed++;
    else if (results[r].sev === 'warn') warned++;
    else passed++;
  }
  results.total = results.length;
  results.failed = failed;
  results.warned = warned;
  results.passed = passed;
  return results;
}
function renderA11yModal(results) {
  var list = el('a11y-list');
  if (!list) return;
  var h = '<div class="doctor-summary">♿ ' + results.passed + ' passing · ' + results.warned + ' warnings · ' + results.failed + ' problems</div>';
  for (var i = 0; i < results.length; i++) {
    var it = results[i];
    var ico = it.sev === 'fail' ? '⛔' : (it.sev === 'warn' ? '⚠️' : 'ℹ️');
    h += '<div class="doctor-item sev-' + it.sev + '"><span class="doctor-ico">' + ico + '</span><div class="doctor-body"><b>' + esc(it.label) + '</b><span>' + esc(it.detail) + '</span></div>' +
      (it.sev === 'info' ? '' : '<button class="btn btn-sm btn-outline" data-a11fix="' + i + '" title="Ask the AI to fix this">🤖 Fix</button>') + '</div>';
  }
  list.innerHTML = h;
  var btns = list.querySelectorAll('[data-a11fix]');
  for (var j = 0; j < btns.length; j++) {
    btns[j].onclick = function() {
      var it = results[parseInt(this.getAttribute('data-a11fix'), 10)];
      if (!it) return;
      closeA11y();
      var inp = el('chat-input');
      var prompt = 'Accessibility audit found: ' + it.label + '. ' + it.detail + (it.slideId ? ' Fix slide id "' + it.slideId + '".' : ' Fix the deck.');
      if (it.slideId) setTargetSlide(it.slideId);
      if (inp) inp.value = prompt;
      switchChatTab('chat');
      sendChatMessage();
    };
  }
}
function openA11y() {
  renderA11yModal(runA11yChecks());
  var ov = el('a11y-overlay');
  if (ov) ov.style.display = 'flex';
}
function closeA11y() {
  var ov = el('a11y-overlay');
  if (ov) ov.style.display = 'none';
}

/* ═══════════════════════════════════════════
   PHASE 3 — A6 VOICE INPUT
   ═══════════════════════════════════════════ */
var _voiceOn = false;
var _voiceRec = null;
function toggleVoiceInput() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var btn = el('btn-voice');
  if (!SR) {
    try { tool.notify('Voice input is not supported in this browser — type instead.', 'warning'); } catch (e) {}
    return;
  }
  if (_voiceOn) {
    _voiceOn = false;
    if (_voiceRec) { try { _voiceRec.stop(); } catch (e) {} _voiceRec = null; }
    if (btn) { btn.classList.remove('rec'); btn.textContent = '🎙'; }
    return;
  }
  try {
    _voiceRec = new SR();
    _voiceRec.lang = DB.pres.lang || _p('lang', 'en');
    _voiceRec.interimResults = true;
    _voiceOn = true;
    if (btn) { btn.classList.add('rec'); btn.textContent = '⏺'; }
    _voiceRec.onresult = function(ev) {
      var txt = '';
      for (var i = 0; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
      var inp = el('chat-input');
      if (inp) { inp.value = txt; inp.style.height = 'auto'; }
    };
    _voiceRec.onend = function() {
      _voiceOn = false;
      if (btn) { btn.classList.remove('rec'); btn.textContent = '🎙'; }
      _voiceRec = null;
    };
    _voiceRec.onerror = function() {
      _voiceOn = false;
      if (btn) { btn.classList.remove('rec'); btn.textContent = '🎙'; }
      _voiceRec = null;
      try { tool.notify('Voice input stopped — type instead.', 'info'); } catch (e) {}
    };
    _voiceRec.start();
    try { tool.notify('🎙 Listening… speak your brief, then press Send.', 'info'); } catch (e) {}
  } catch (e) {
    _voiceOn = false;
    try { tool.notify('Voice input failed: ' + (e.message || e), 'warning'); } catch (e2) {}
  }
}

/* ═══════════════════════════════════════════
   PHASE 3 — D3 PER-SLIDE TIMING ESTIMATES
   ═══════════════════════════════════════════ */
function estimateTiming() {
  if (!DB.pres.slides.length) { try { tool.notify('No slides to estimate.', 'warning'); } catch (e) {} return; }
  var prompt = [
    'Estimate how many SECONDS a presenter needs for each slide. Return ONLY JSON:',
    '{"patches":[{"op":"timing","id":"<slide id>","duration":<seconds>}, ...],"summary":"..."}.',
    'One timing patch per slide. Typical: cover 15-20s, agenda 10s, text slides 30-60s, charts 25-40s, quiz 30s, closing 15s.',
    '=== DECK ===',
    deckStateBlock()
  ].join('\n');
  runAiPatchesTask('⏱ Estimate timing', prompt);
  var done = function() { renderStrip(); };
  setTimeout(function() { renderStrip(); }, 200);
}
function timingTotal() {
  var total = 0;
  for (var i = 0; i < DB.pres.slides.length; i++) total += DB.pres.slides[i].duration || 0;
  return total;
}
function renderTimingTotal() {
  var el2 = el('timing-total');
  if (!el2) return;
  var total = timingTotal();
  if (!total) { el2.textContent = ''; el2.style.display = 'none'; return; }
  var m = Math.floor(total / 60);
  var s = total % 60;
  el2.textContent = '⏱ ~' + m + ':' + (s < 10 ? '0' : '') + s + ' total';
  el2.style.display = '';
}

/* ═══════════════════════════════════════════
   PHASE 3 — C4 BULK SELECT & ACTIONS
   ═══════════════════════════════════════════ */
var _selectedSlides = {};
function toggleSlideSelect(id, checked) {
  if (checked) _selectedSlides[id] = true;
  else delete _selectedSlides[id];
  renderBulkBar();
}
function selectedSlideIds() {
  var out = [];
  for (var k in _selectedSlides) {
    if (Object.prototype.hasOwnProperty.call(_selectedSlides, k) && _selectedSlides[k] && slideIndexById(k) !== -1) out.push(k);
  }
  return out;
}
function renderBulkBar() {
  var bar = el('bulk-bar');
  if (!bar) return;
  var n = selectedSlideIds().length;
  bar.style.display = n ? 'flex' : 'none';
  var label = el('bulk-label');
  if (label) label.textContent = n + ' slide(s) selected';
}
function clearSelection() {
  _selectedSlides = {};
  renderBulkBar();
  renderSlidesList();
}
function bulkDelete() {
  var ids = selectedSlideIds();
  if (!ids.length || !canWrite()) return;
  sandboxConfirm('Delete ' + ids.length + ' selected slide(s)? This cannot be undone.', function() {
    pushHistory('Bulk delete ' + ids.length + ' slides');
    for (var i = 0; i < ids.length; i++) {
      var idx = slideIndexById(ids[i]);
      if (idx !== -1) DB.pres.slides.splice(idx, 1);
    }
    _selectedSlides = {};
    fixActiveSlide();
    persist();
    renderAll();
    updatePreview();
    try { tool.notify(ids.length + ' slide(s) deleted.', 'info'); } catch (e) {}
  });
}
function bulkSetLock(lock) {
  var ids = selectedSlideIds();
  if (!ids.length || !canWrite()) return;
  pushHistory('Bulk ' + (lock ? 'lock' : 'unlock') + ' ' + ids.length + ' slides');
  for (var i = 0; i < ids.length; i++) {
    var idx = slideIndexById(ids[i]);
    if (idx !== -1) DB.pres.slides[idx].locked = !!lock;
  }
  persist();
  renderStrip();
  renderSlidesList();
  updatePreview();
  try { tool.notify(ids.length + ' slide(s) ' + (lock ? 'locked 🔒' : 'unlocked 🔓') + '.', 'success'); } catch (e) {}
}
function bulkAiPrompt() {
  var ids = selectedSlideIds();
  if (!ids.length) return;
  var inp = el('chat-input');
  if (!inp) return;
  inp.value = 'Apply the requested change ONLY to these slides (ids): ' + ids.join(', ') + '. Change: ';
  inp.style.height = 'auto';
  switchChatTab('chat');
  inp.focus();
}
function bulkRestyle() {
  var ids = selectedSlideIds();
  if (!ids.length) return;
  var inp = el('chat-input');
  if (!inp) return;
  inp.value = 'Restyle these slides with the same consistent design (ids): ' + ids.join(', ') + '. Keep each slide\'s id and content — improve the visuals.';
  inp.style.height = 'auto';
  switchChatTab('chat');
  sendChatMessage();
}

/* ═══════════════════════════════════════════
   PHASE 3 — F3 OUTLINE TEXT EXPORT
   ═══════════════════════════════════════════ */
function buildOutlineText() {
  var pres = DB.pres || {};
  var lines = [];
  lines.push('# ' + (pres.title || 'Presentation'));
  if (pres.subtitle) lines.push('*' + pres.subtitle + '*');
  if (pres.author) lines.push('By ' + pres.author);
  lines.push('');
  lines.push('Language: ' + (pres.lang || _p('lang', 'en')) + ' · ' + pres.slides.length + ' slides · theme: ' + (pres.theme || 'clean'));
  lines.push('');
  for (var i = 0; i < pres.slides.length; i++) {
    var s = pres.slides[i];
    lines.push('## ' + (i + 1) + '. ' + (s.title || ('Slide ' + (i + 1))));
    for (var c = 0; c < s.components.length; c++) {
      var comp = s.components[c];
      var d = comp.data || {};
      if (comp.type === 'heading') lines.push('**' + (d.text || d.title || '') + '**');
      else if (comp.type === 'bullets') {
        for (var b = 0; b < (d.items || []).length; b++) {
          var it = d.items[b];
          lines.push('- ' + (typeof it === 'string' ? it : (it.text || '')));
        }
      } else if (comp.type === 'paragraph') {
        lines.push(String(d.text || d.body || '').replace(/\n/g, ' '));
      } else if (comp.type === 'title-slide' || comp.type === 'section-slide' || comp.type === 'closing-slide') {
        lines.push('_' + (d.title || '') + '_');
      } else {
        lines.push('[' + comp.type + ']');
      }
    }
    if (s.notes) lines.push('> 🗒 ' + String(s.notes).replace(/\n/g, ' '));
    lines.push('');
  }
  return lines.join('\n');
}
function openMdModal() {
  if (!DB.pres.slides.length) { try { tool.notify('Nothing to export yet.', 'warning'); } catch (e) {} return; }
  var ta = el('md-outline');
  if (ta) ta.value = buildOutlineText();
  var ov = el('md-overlay');
  if (ov) ov.style.display = 'flex';
}
function closeMdModal() {
  var ov = el('md-overlay');
  if (ov) ov.style.display = 'none';
}
function downloadOutline() {
  var text = buildOutlineText();
  try {
    _downloadBlob(new Blob([text], { type: 'text/markdown' }), slugify(DB.pres.title) + '-outline.md');
    try { tool.notify('Outline downloaded as Markdown.', 'success'); } catch (e) {}
  } catch (e) {
    try { tool.notify('Download blocked — use Copy instead.', 'warning'); } catch (e2) {}
  }
}
function copyOutline() {
  var ta = el('md-outline');
  var text = ta ? ta.value : buildOutlineText();
  function fallback() {
    try {
      if (ta) { ta.select(); document.execCommand('copy'); } else return;
      try { tool.notify('Outline copied.', 'success'); } catch (e) {}
    } catch (e2) {}
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      try { tool.notify('Outline copied.', 'success'); } catch (e) {}
    }).catch(fallback);
  } else fallback();
}

/* ═══════════════════════════════════════════
   PHASE 3 — F1 EXPORT SLIDES AS PNG
   ═══════════════════════════════════════════ */
function exportSlidesPng() {
  if (!DB.pres.slides.length) { try { tool.notify('Nothing to export yet.', 'warning'); } catch (e) {} return; }
  if (DB.pres.slides.length > 50) { try { tool.notify('Too many slides for image export (max 50).', 'warning'); } catch (e) {} return; }
  try { tool.notify('Rendering ' + DB.pres.slides.length + ' slide image(s)…', 'info'); } catch (e) {}
  var W = 1280, H = 720;
  var files = [];
  var failed = 0;
  var idx = 0;
  function next() {
    if (idx >= DB.pres.slides.length) {
      if (!files.length) { try { tool.notify('Image export failed — the browser blocked canvas rendering.', 'error'); } catch (e) {} return; }
      try {
        var zip = _zipFiles(files);
        _downloadBlob(new Blob([zip], { type: 'application/zip' }), slugify(DB.pres.title) + '-slides.zip');
        try { tool.notify('Downloaded ' + files.length + ' slide PNG(s)' + (failed ? ' (' + failed + ' skipped)' : '') + '.', 'success'); } catch (e) {}
      } catch (e) {
        try { tool.notify('ZIP failed: ' + (e.message || e), 'error'); } catch (e2) {}
      }
      return;
    }
    var i = idx;
    idx++;
    var s = DB.pres.slides[i];
    var slideHtml = '<section class="pres-slide is-active">' +
      '<div class="pres-slide-inner">' + renderComponents(s.components || []) + '</div></section>';
    var full = '<html><head><meta charset="utf-8"><style>' + PRES_DECK_BASE_CSS + '\n' + _sanitizeCss((THEMES[DB.pres.theme] && THEMES[DB.pres.theme].css) || '') + '\n' + _sanitizeCss(brandCss()) +
      '\nbody{background:#0f172a;display:flex;align-items:center;justify-content:center}.pres-deck{width:1280px;height:720px}.pres-slide{position:relative;width:1280px;height:720px;opacity:1;visibility:visible;pointer-events:auto;border-radius:0;box-shadow:none}' +
      '</sty' + 'le></head><body><div class="pres-deck">' + slideHtml + '</div></body></html>';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><foreignObject width="100%" height="100%">' + full.replace(/&/g, '&amp;') + '</foreignObject></svg>';
    var url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);
      try {
        ctx.drawImage(img, 0, 0, W, H);
        var dataUrl = canvas.toDataURL('image/png');
        var bin = atob(dataUrl.split(',')[1]);
        var bytes = new Uint8Array(bin.length);
        for (var b = 0; b < bin.length; b++) bytes[b] = bin.charCodeAt(b);
        files.push({ name: 'slide-' + (i + 1) + '.png', data: bytes });
      } catch (e) {
        failed++;
      }
      next();
    };
    img.onerror = function() { failed++; next(); };
    img.src = url;
  }
  next();
}

/* ═══════════════════════════════════════════
   PHASE 3 — G2 BRAND PRESET MEMORY
   ═══════════════════════════════════════════ */
function brandStorageKey() {
  var u = getUserSafe() || {};
  return 'aichatpres_brand_' + (u.id || 'anon');
}
function saveBrandPreset() {
  var b = effectiveBrand();
  if (!b.primary && !b.font) return;
  try { localStorage.setItem(brandStorageKey(), JSON.stringify(b)); } catch (e) {}
}
function loadBrandPreset() {
  try {
    var raw = localStorage.getItem(brandStorageKey());
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function applyBrandPreset() {
  var preset = loadBrandPreset();
  if (!preset) return;
  pushHistory('Brand preset');
  DB.pres.brand = {
    primary: _validHex(preset.primary || ''),
    font: String(preset.font || '').replace(/[^a-zA-Z0-9 \-',]/g, '').trim().substring(0, 60)
  };
  persist();
  updatePreview();
  renderChatMessages();
  try { tool.notify('🎨 Saved brand applied to this deck.', 'success'); } catch (e) {}
}
function renderBrandChip() {
  var slot = el('brand-preset-slot');
  if (!slot) return;
  var preset = loadBrandPreset();
  var hasPreset = preset && (preset.primary || preset.font);
  var inUse = DB.pres.brand && (DB.pres.brand.primary || DB.pres.brand.font);
  if (hasPreset && !inUse) {
    slot.innerHTML = '<button class="brand-chip" id="btn-brand-preset" title="Apply your saved brand (from admin params)">🎨 Use my saved brand</button>';
    var b = el('btn-brand-preset');
    if (b) b.onclick = applyBrandPreset;
  } else {
    slot.innerHTML = '';
  }
}

/* ═══════════════════════════════════════════
   PHASE 3 — G3 COLLABORATION AWARENESS
   ═══════════════════════════════════════════ */
var _permittedUsers = null;
function refreshPermittedUsers() {
  try {
    if (typeof tool.getPermittedUsers === 'function') {
      var u = tool.getPermittedUsers();
      if (u) _permittedUsers = u;
    }
  } catch (e) {}
  renderCollabChip();
}
function renderCollabChip() {
  var chip = el('collab-chip');
  if (!chip) return;
  var names = [];
  if (_permittedUsers && _permittedUsers.length) {
    for (var i = 0; i < _permittedUsers.length; i++) names.push(_permittedUsers[i].name || _permittedUsers[i].id || '');
    names = names.filter(Boolean);
  }
  if (names.length) {
    chip.textContent = '👥 ' + names.length + ' editor' + (names.length > 1 ? 's' : '');
    chip.title = 'Can edit: ' + names.join(', ');
    chip.style.display = '';
  } else {
    chip.style.display = 'none';
  }
}
function stampAiActor(msg) {
  var u = getUserSafe();
  if (u && u.name && msg.role === 'ai') msg.actorName = u.name;
}

/* ═══════════════════════════════════════════
   PHASE 3 — H3 GRAMMAR & SPELLING PASS
   ═══════════════════════════════════════════ */
function proofreadDeck() {
  if (!DB.pres.slides.length) { try { tool.notify('No slides to proofread.', 'warning'); } catch (e) {} return; }
  var prompt = [
    'Proofread ALL slide text and speaker notes of this deck. Fix grammar, spelling, punctuation and awkward phrasing.',
    'Return ONLY JSON: {"patches":[{"op":"upsertSlide","slide":{"id":"<existing id>","title":"...","notes":"...","components":[...corrected, same structure...]}}, ...],"summary":"..."}.',
    'Keep the SAME ids, component types and structure — only correct the text.',
    'SKIP slides marked 🔒 LOCKED.',
    '=== DECK ===',
    deckStateBlock()
  ].join('\n');
  runAiPatchesTask('🔤 Proofread deck', prompt);
}

/* ═══════════════════════════════════════════
   PHASE 3 — H4 EXPORT SIZE & PERFORMANCE REPORT
   ═══════════════════════════════════════════ */
function runExportChecks() {
  var results = [];
  function add(sev, label, detail) { results.push({ sev: sev, label: label, detail: detail || '' }); }
  var slides = DB.pres.slides || [];
  var compCount = 0;
  for (var i = 0; i < slides.length; i++) compCount += slides[i].components.length;
  var htmlSize = slides.length ? buildStandalone().length : 0;
  var pptxSize = slides.length ? buildPptx().length : 0;
  add('info', slides.length + ' slide(s) · ' + compCount + ' component(s)', 'Total content size.');
  add('info', 'HTML: ' + formatSize(htmlSize) + ' · PPTX: ' + formatSize(pptxSize), 'Standalone export weights.');
  if (htmlSize > 1500000) add('warn', 'HTML export is large (' + formatSize(htmlSize) + ')', 'Trim custom CSS/JS or split the deck.');
  if (pptxSize > 2000000) add('warn', 'PPTX export is large (' + formatSize(pptxSize) + ')', 'Reduce components or slide count.');
  if (slides.length > 40) add('warn', slides.length + ' slides is heavy', 'Consider splitting into two presentations.');
  if (compCount > 250) add('warn', compCount + ' components total', 'Trim dense slides (✂️ Split dense helps).');
  if (DB.history && DB.history.length) add('info', 'History: ' + DB.history.length + ' snapshot(s) · ' + formatSize(JSON.stringify(DB.history).length), 'Undo snapshots stored in the record.');
  if (DB.snippets && DB.snippets.length) add('info', 'Snippets: ' + DB.snippets.length + ' saved', 'Reusable slides stored in the record.');
  if (!results.some(function(r) { return r.sev === 'warn'; })) add('info', '✅ No performance warnings', 'The deck exports comfortably.');
  var failed = 0, warned = 0, passed = 0;
  for (var r = 0; r < results.length; r++) {
    if (results[r].sev === 'fail') failed++;
    else if (results[r].sev === 'warn') warned++;
    else passed++;
  }
  results.total = results.length; results.failed = failed; results.warned = warned; results.passed = passed;
  return results;
}
function renderPerfModal(results) {
  var list = el('perf-list');
  if (!list) return;
  var h = '<div class="doctor-summary">' + results.passed + ' passing · ' + results.warned + ' warnings · ' + results.failed + ' problems</div>';
  for (var i = 0; i < results.length; i++) {
    var it = results[i];
    var ico = it.sev === 'warn' ? '⚠️' : 'ℹ️';
    h += '<div class="doctor-item sev-' + it.sev + '"><span class="doctor-ico">' + ico + '</span><div class="doctor-body"><b>' + esc(it.label) + '</b><span>' + esc(it.detail) + '</span></div></div>';
  }
  list.innerHTML = h;
}
function openPerf() {
  renderPerfModal(runExportChecks());
  var ov = el('perf-overlay');
  if (ov) ov.style.display = 'flex';
}
function closePerf() {
  var ov = el('perf-overlay');
  if (ov) ov.style.display = 'none';
}

/* ── Instance id & params ── */
function _p(name, def) {
  try {
    var v = tool.param(name, def);
    return (v === null || v === undefined || v === '') ? def : String(v);
  } catch (e) { return def; }
}

function _validHex(v) {
  var s = String(v || '').trim();
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/.test(s)) return s;
  return '';
}

/* Admin-configured brand kit → CSS tokens injected into the standalone export */
function effectiveBrand() {
  var p = (DB.pres && DB.pres.brand) ? DB.pres.brand.primary : '';
  var f = (DB.pres && DB.pres.brand) ? DB.pres.brand.font : '';
  return {
    primary: p || _validHex(_p('brandPrimary', '')),
    font: f || _p('brandFont', '').replace(/[^a-zA-Z0-9 \-',]/g, '').trim()
  };
}
function brandCss() {
  var b = effectiveBrand();
  var rules = [];
  if (b.primary) {
    rules.push(':root{--pres-accent:' + b.primary + '}');
    rules.push('.pres-kicker{color:' + b.primary + '}.pres-agenda-num{background:' + b.primary + '}.pres-q-radio:checked+.pres-q-opt{border-color:' + b.primary + '}.pres-tab-btn.active{color:' + b.primary + ';border-color:' + b.primary + '}.pres-timeline-num{background:' + b.primary + ';color:#fff}.pres-bullet-icon{color:' + b.primary + '}');
  }
  if (b.font) {
    rules.push('.pres-slide,.pres-body,.pres-cover{font-family:' + b.font + ',system-ui,sans-serif}');
  }
  return rules.join('\n');
}

/* B6 — cover background designer: mesh / shine / dots / lines */
function coverBackground(d) {
  d = d || {};
  if (d.background) return d.background;
  var primary = effectiveBrand().primary || '#7c3aed';
  var deep = '#312e81';
  switch (d.backgroundStyle) {
    case 'mesh':
      return 'radial-gradient(at 18% 22%, ' + primary + 'aa 0%, transparent 45%),radial-gradient(at 82% 18%, #4f46e5cc 0%, transparent 42%),radial-gradient(at 30% 85%, #9333eacc 0%, transparent 45%),radial-gradient(at 78% 82%, ' + primary + '88 0%, transparent 40%),linear-gradient(135deg,' + deep + ',#0f172a)';
    case 'shine':
      return 'linear-gradient(120deg,' + deep + ' 0%,#4f46e5 40%,#a78bfa 50%,#4f46e5 60%,' + deep + ' 100%)';
    case 'dots':
      return 'radial-gradient(' + primary + '33 2px, transparent 2.5px) 0 0/26px 26px,linear-gradient(135deg,' + deep + ',#312e81 60%,#1e1b4b)';
    case 'lines':
      return 'repeating-linear-gradient(-45deg,' + primary + '22 0 2px,transparent 2px 26px),linear-gradient(135deg,' + deep + ',#1e1b4b)';
    default:
      return 'linear-gradient(135deg,' + deep + ' 0%,#4f46e5 45%,' + primary + ' 100%)';
  }
}

/* B7 — offline gradient placeholder for missing images */
function imgPlaceholderHtml(d, height) {
  var label = (d && (d.alt || d.caption)) || 'Image';
  return '<div class="pres-img-ph" style="height:' + (height ? esc(height) : '100%') + ';flex:1;min-height:80px"><span class="pres-img-ph-ico">🖼</span><span>' + esc(label) + '</span></div>';
}

function _resolveInstanceId() {
  if (DB._instanceId) return DB._instanceId;
  var parentId = DB._parentRecordId || '';
  if (!parentId) {
    try {
      var m = (window.location.search || '').match(/[?&](?:objectId|recordId|id)=([^&?#]+)/);
      if (m) parentId = decodeURIComponent(m[1]);
    } catch (e) {}
  }
  if (!parentId) {
    try {
      var f = tool.getFields();
      if (f && (f._id || f.id)) parentId = String(f._id || f.id);
    } catch (e) {}
  }
  if (!parentId) { try { var p1 = tool.param('objectId', ''); if (p1) parentId = String(p1); } catch (e) {} }
  if (!parentId) { try { var p2 = tool.param('recordId', ''); if (p2) parentId = String(p2); } catch (e) {} }
  DB._instanceId = parentId ? ('rec_' + parentId) : 'inst_unknown';
  try { persist(); } catch (e) {}
  return DB._instanceId;
}

/* ═══════════════════════════════════════════
   COMPONENT LIBRARY — rich slide component catalog.
   The AI composes slides as {"components":[{type,data},...]}.
   Nested containers call ctx.rd() on their item descriptors.
   ═══════════════════════════════════════════ */
var PRES_COLORS = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#ca8a04'];
var _uidCounter = 0;

function makeRenderCtx() {
  return {
    esc: esc,
    uid: function() { _uidCounter++; return 'p' + Date.now().toString(36) + _uidCounter.toString(36); },
    rd: renderDescriptor
  };
}

function renderDescriptor(desc) {
  if (!desc || !desc.type) return '';
  var comp = PRES_COMPONENTS[desc.type];
  if (!comp) return '<div class="pres-unknown">⚠ Unknown component "' + esc(desc.type) + '"</div>';
  try {
    return comp.render(desc.data || {}, makeRenderCtx());
  } catch (e) {
    return '<div class="pres-unknown">⚠ Component "' + esc(desc.type) + '" failed: ' + esc(String(e && e.message ? e.message : e)) + '</div>';
  }
}

function renderComponents(components) {
  if (!components || !components.length) return '';
  var h = '';
  for (var i = 0; i < components.length; i++) h += renderDescriptor(components[i]);
  return h;
}

var PRES_COMPONENTS = {
  /* ── 1. title-slide — deck cover */
  'title-slide': {
    desc: 'Deck cover. {title, subtitle?, presenter?, date?, icon?, background? (CSS), backgroundStyle?: mesh|shine|dots|lines}',
    render: function(d) {
      var bg = coverBackground(d);
      var h = '<div class="pres-cover" style="background:' + bg + '">';
      if (d.icon) h += '<div style="font-size:52px;margin-bottom:14px">' + esc(d.icon) + '</div>';
      h += '<h1 class="pres-h1" style="color:#fff">' + esc(d.title || '') + '</h1>';
      if (d.subtitle) h += '<p style="font-size:clamp(14px,1.8vw,22px);color:rgba(255,255,255,0.85);margin-top:12px;max-width:80%">' + esc(d.subtitle) + '</p>';
      if (d.presenter || d.date) h += '<div style="margin-top:26px;font-size:13px;color:rgba(255,255,255,0.65)">' + esc(d.presenter || '') + (d.presenter && d.date ? ' · ' : '') + esc(d.date || '') + '</div>';
      return h + '</div>';
    }
  },
  /* ── 2. section-slide — divider */
  'section-slide': {
    desc: 'Section divider slide. {title, subtitle?, icon?, number? (e.g. "02"), background?, backgroundStyle?: mesh|shine|dots|lines}',
    render: function(d) {
      var bg = coverBackground(d);
      var h = '<div class="pres-cover" style="background:' + bg + '">';
      if (d.number) h += '<div style="font-size:13px;font-weight:700;letter-spacing:4px;color:rgba(255,255,255,0.5);margin-bottom:10px">' + esc(d.number) + '</div>';
      if (d.icon) h += '<div style="font-size:44px;margin-bottom:12px">' + esc(d.icon) + '</div>';
      h += '<h1 class="pres-h1" style="color:#fff">' + esc(d.title || '') + '</h1>';
      if (d.subtitle) h += '<p style="font-size:clamp(13px,1.6vw,19px);color:rgba(255,255,255,0.7);margin-top:10px">' + esc(d.subtitle) + '</p>';
      return h + '</div>';
    }
  },
  /* ── 3. closing-slide — thank you / contact */
  'closing-slide': {
    desc: 'Closing slide. {title? (default "Thank You"), message?, contact?:[{label,value}], icon?, background?, backgroundStyle?: mesh|shine|dots|lines}',
    render: function(d) {
      var bg = coverBackground(d);
      var h = '<div class="pres-cover" style="background:' + bg + '">';
      h += '<div style="font-size:44px;margin-bottom:10px">' + esc(d.icon || '🙏') + '</div>';
      h += '<h1 class="pres-h1" style="color:#fff">' + esc(d.title || 'Thank You') + '</h1>';
      if (d.message) h += '<p style="font-size:clamp(13px,1.7vw,20px);color:rgba(255,255,255,0.85);margin-top:10px;max-width:75%">' + esc(d.message) + '</p>';
      if (d.contact && d.contact.length) {
        h += '<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:24px">';
        for (var i = 0; i < d.contact.length; i++) {
          h += '<div style="background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.3);border-radius:10px;padding:10px 18px;font-size:13px;color:#fff"><strong>' + esc(d.contact[i].label || '') + ':</strong> ' + esc(d.contact[i].value || '') + '</div>';
        }
        h += '</div>';
      }
      return h + '</div>';
    }
  },
  /* ── 4. agenda — numbered outline */
  'agenda': {
    desc: 'Agenda slide. {title?, items:[{title, subtitle?}], jumpTo? (1-based slide index per item)}',
    render: function(d, ctx) {
      var h = '<div class="pres-body"><h2 class="pres-h2">' + esc(d.title || 'Agenda') + '</h2><div class="pres-agenda">';
      for (var i = 0; i < (d.items || []).length; i++) {
        var it = d.items[i];
        var jump = it.jumpTo ? ' data-pres-goto="' + (parseInt(it.jumpTo, 10) - 1) + '"' : '';
        h += '<div class="pres-agenda-item"' + jump + '><span class="pres-agenda-num">' + (i + 1) + '</span><div><strong>' + esc(it.title || '') + '</strong>' + (it.subtitle ? '<div class="pres-muted">' + esc(it.subtitle) + '</div>' : '') + '</div></div>';
      }
      return h + '</div></div>';
    }
  },
  /* ── 5. heading — slide heading with kicker */
  'heading': {
    desc: 'Slide heading. {text, kicker? (small line above), icon?, align?:left|center}',
    render: function(d) {
      var align = d.align === 'center' ? 'center' : 'left';
      var h = '<div style="text-align:' + align + ';margin-bottom:6px">';
      if (d.kicker) h += '<div class="pres-kicker">' + esc(d.kicker) + '</div>';
      h += '<h2 class="pres-h2">' + (d.icon ? esc(d.icon) + ' ' : '') + esc(d.text || d.title || '') + '</h2></div>';
      return h;
    }
  },
  /* ── 6. paragraph */
  'paragraph': {
    desc: 'Reading paragraph. {text, size?:normal|large|small, align?, muted?}',
    render: function(d) {
      var size = { normal: '15px', large: '18px', small: '13px' }[d.size] || '15px';
      var color = d.muted ? '#64748b' : '#1e293b';
      return '<p style="font-size:' + size + ';color:' + color + ';line-height:1.75;text-align:' + (d.align === 'center' ? 'center' : 'left') + ';margin-bottom:12px">' + esc(d.text || d.body || '') + '</p>';
    }
  },
  /* ── 7. bullets */
  'bullets': {
    desc: 'Bullet list. {items:[{text, icon?, bold?}] or strings, columns?:1|2, color?}',
    render: function(d) {
      var cols = parseInt(d.columns, 10) === 2 ? 'pres-cols-2' : '';
      var color = d.color || '#4f46e5';
      var h = '<ul class="pres-bullets ' + cols + '" style="--pres-accent:' + color + '">';
      for (var i = 0; i < (d.items || []).length; i++) {
        var it = d.items[i];
        var txt = typeof it === 'string' ? it : (it.text || '');
        var icon = (it && it.icon) ? it.icon : '▸';
        var bold = it && it.bold;
        h += '<li><span class="pres-bullet-icon">' + esc(icon) + '</span><span' + (bold ? ' style="font-weight:700"' : '') + '>' + esc(txt) + '</span></li>';
      }
      return h + '</ul>';
    }
  },
  /* ── 8. quote */
  'quote': {
    desc: 'Big quote. {text, attribution?, role?, icon? (default 💬)}',
    render: function(d) {
      return '<div class="pres-quote-wrap"><div class="pres-quote-mark">' + esc(d.icon || '💬') + '</div><blockquote class="pres-quote">' + esc(d.text || d.quote || '') + '</blockquote>' +
        (d.attribution ? '<div class="pres-quote-by">— ' + esc(d.attribution) + (d.role ? ', ' + esc(d.role) : '') + '</div>' : '') + '</div>';
    }
  },
  /* ── 9. image */
  'image': {
    desc: 'Image. {url, alt?, caption?, height? (px, default fills available), fit?:cover|contain} — missing URLs get a branded gradient placeholder (no broken images, works offline).',
    render: function(d) {
      if (!d.url) return '<figure class="pres-figure" style="display:flex;flex-direction:column">' + imgPlaceholderHtml(d, d.height) + (d.caption ? '<figcaption class="pres-muted">' + esc(d.caption) + '</figcaption>' : '') + '</figure>';
      var h = '<figure class="pres-figure" style="height:' + (d.height ? esc(d.height) + 'px' : '100%') + '">';
      h += '<img src="' + esc(d.url) + '" alt="' + esc(d.alt || '') + '" style="width:100%;height:100%;object-fit:' + (d.fit === 'contain' ? 'contain' : 'cover') + '">';
      if (d.caption) h += '<figcaption class="pres-muted">' + esc(d.caption) + '</figcaption>';
      return h + '</figure>';
    }
  },
  /* ── 10. gallery */
  'gallery': {
    desc: 'Image gallery grid. {images:[{url, caption?, alt?}], cols?:2|3|4, height?:180}',
    render: function(d) {
      var cols = { '2': 'pres-cols-2', '3': 'pres-cols-3', '4': 'pres-cols-4' }[String(d.cols || '3')] || 'pres-cols-3';
      var h = '<div class="' + cols + '">';
      for (var i = 0; i < (d.images || []).length; i++) {
        var img = d.images[i];
        if (!img.url && !img.src) {
          h += '<figure class="pres-figure" style="display:flex;flex-direction:column">' + imgPlaceholderHtml(img, d.height || 170) + (img.caption ? '<figcaption class="pres-muted">' + esc(img.caption) + '</figcaption>' : '') + '</figure>';
          continue;
        }
        h += '<figure class="pres-figure" style="height:' + (d.height || 170) + 'px"><img src="' + esc(img.url || img.src || '') + '" alt="' + esc(img.alt || '') + '" style="width:100%;height:100%;object-fit:cover">' +
          (img.caption ? '<figcaption class="pres-muted">' + esc(img.caption) + '</figcaption>' : '') + '</figure>';
      }
      return h + '</div>';
    }
  },
  /* ── 11. video */
  'video': {
    desc: 'Embedded video. {url (YouTube embed URL), title?, ratio?:16by9|4by3}',
    render: function(d) {
      var ratio = d.ratio === '4by3' ? '75%' : '56.25%';
      var h = '<div style="width:100%">';
      if (d.title) h += '<div style="font-weight:700;color:#1e293b;margin-bottom:8px">🎬 ' + esc(d.title) + '</div>';
      h += '<div style="position:relative;padding-bottom:' + ratio + ';height:0;overflow:hidden;border-radius:10px">' +
        '<iframe src="' + esc(d.url) + '" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allowfullscreen></iframe></div></div>';
      return h;
    }
  },
  /* ── 12. code-block */
  'code-block': {
    desc: 'Code block. {code, language?, filename?, fontSize?:12}',
    render: function(d) {
      var h = '<div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">';
      h += '<div style="display:flex;justify-content:space-between;padding:7px 14px;background:#1e293b;color:#e2e8f0;font-size:12px"><span>' + esc(d.language || 'Code') + '</span>' + (d.filename ? '<span style="color:#94a3b8">' + esc(d.filename) + '</span>' : '') + '</div>';
      h += '<pre style="margin:0;padding:14px 16px;background:#0f172a;color:#e2e8f0;font-family:Consolas,monospace;font-size:' + (d.fontSize || 13) + 'px;line-height:1.55;overflow:auto;max-height:100%"><code>' + esc(d.code || d.text || '') + '</code></pre></div>';
      return h;
    }
  },
  /* ── 13. callout */
  'callout': {
    desc: 'Alert box. {variant:info|tip|key|warn, title?, text}',
    render: function(d) {
      var c = { info: ['#3b82f6', '#eff6ff', 'ℹ️'], tip: ['#059669', '#ecfdf5', '💡'], key: ['#d97706', '#fef3c7', '🔑'], warn: ['#dc2626', '#fee2e2', '⚠️'] }[d.variant] || ['#3b82f6', '#eff6ff', 'ℹ️'];
      return '<div style="border-left:5px solid ' + c[0] + ';background:' + c[1] + ';padding:13px 18px;border-radius:0 10px 10px 0;margin:10px 0">' +
        '<div style="font-weight:700;color:' + c[0] + ';margin-bottom:3px">' + c[2] + ' ' + esc(d.title || '') + '</div>' +
        '<p style="color:#334155;margin:0;font-size:14px;line-height:1.6">' + esc(d.text || d.body || '') + '</p></div>';
    }
  },
  /* ── 14. stat-cards */
  'stat-cards': {
    desc: 'KPI cards row. {items:[{value, label, icon?, color?, prefix?, suffix?}], cols?:2|3|4}',
    render: function(d) {
      var cols = { '2': 'pres-cols-2', '3': 'pres-cols-3', '4': 'pres-cols-4' }[String(d.cols || (d.items || []).length)] || 'pres-cols-3';
      var h = '<div class="' + cols + '">';
      for (var i = 0; i < (d.items || []).length; i++) {
        var it = d.items[i];
        var color = it.color || PRES_COLORS[i % PRES_COLORS.length];
        h += '<div style="background:#fff;border:1px solid #e2e8f0;border-top:4px solid ' + color + ';border-radius:12px;padding:16px 18px;text-align:center">';
        if (it.icon) h += '<div style="font-size:26px;margin-bottom:4px">' + esc(it.icon) + '</div>';
        h += '<div style="font-size:30px;font-weight:800;color:' + color + ';line-height:1.15">' + (it.prefix || '') + esc(it.value) + (it.suffix || '') + '</div>';
        h += '<div style="font-size:12px;color:#64748b;margin-top:4px">' + esc(it.label || '') + '</div></div>';
      }
      return h + '</div>';
    }
  },
  /* ── 15. big-number — animated count-up */
  'big-number': {
    desc: 'Animated count-up stat. {value, label?, prefix?, suffix?, icon?, color?}',
    render: function(d) {
      var color = d.color || '#4f46e5';
      return '<div style="text-align:center;padding:10px 0">' +
        (d.icon ? '<div style="font-size:34px;margin-bottom:6px">' + esc(d.icon) + '</div>' : '') +
        '<div class="pres-count" data-count="' + esc(d.value) + '" data-prefix="' + esc(d.prefix || '') + '" data-suffix="' + esc(d.suffix || '') + '" style="font-size:clamp(34px,5vw,64px);font-weight:900;color:' + color + ';line-height:1.1">0</div>' +
        (d.label ? '<div style="font-size:14px;color:#64748b;margin-top:6px">' + esc(d.label) + '</div>' : '') + '</div>';
    }
  },
  /* ── 16. bar-chart */
  'bar-chart': {
    desc: 'Horizontal bars. {title?, items:[{label, value, color?}], maxValue?, showValues?:true, unit?, dataset?}',
    render: function(d) {
      if (d.dataset && DB.pres.datasets && DB.pres.datasets[d.dataset]) {
        var ds = DB.pres.datasets[d.dataset];
        d = { title: d.title || d.dataset, items: (ds.labels || []).map(function(l, i) { return { label: l, value: (ds.values || [])[i] || 0 }; }), maxValue: d.maxValue, showValues: d.showValues, unit: d.unit };
      }
      var maxV = parseFloat(d.maxValue) || 0;
      if (!maxV) { for (var i = 0; i < (d.items || []).length; i++) { var v = parseFloat(d.items[i].value) || 0; if (v > maxV) maxV = v; } }
      if (maxV <= 0) maxV = 100;
      var h = '<div class="pres-body">';
      if (d.title) h += '<h3 class="pres-h3">📊 ' + esc(d.title) + '</h3>';
      for (var j = 0; j < (d.items || []).length; j++) {
        var it = d.items[j];
        var val = parseFloat(it.value) || 0;
        var pct = Math.round((val / maxV) * 100);
        var clr = it.color || PRES_COLORS[j % PRES_COLORS.length];
        h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">';
        h += '<span style="min-width:110px;font-size:13px;color:#475569;text-align:right">' + esc(it.label || '') + '</span>';
        h += '<div style="flex:1;background:#f1f5f9;border-radius:6px;height:22px;overflow:hidden"><div class="pres-bar-fill" data-fill="w" data-width="' + pct + '" style="width:0;height:100%;background:' + clr + ';border-radius:6px;display:flex;align-items:center;justify-content:flex-end;padding-right:7px;transition:width 1s ease"><span style="font-size:11px;color:#fff;font-weight:700">' + (d.showValues === false ? '' : esc(it.value) + (d.unit || '')) + '</span></div></div></div>';
      }
      return h + '</div>';
    }
  },
  /* ── 17. column-chart */
  'column-chart': {
    desc: 'Vertical columns. {title?, items:[{label, value, color?}], maxValue?, showValues?:true, dataset?}',
    render: function(d) {
      if (d.dataset && DB.pres.datasets && DB.pres.datasets[d.dataset]) {
        var ds = DB.pres.datasets[d.dataset];
        d = { title: d.title || d.dataset, items: (ds.labels || []).map(function(l, i) { return { label: l, value: (ds.values || [])[i] || 0 }; }), maxValue: d.maxValue, showValues: d.showValues };
      }
      var maxV = parseFloat(d.maxValue) || 0;
      if (!maxV) { for (var i = 0; i < (d.items || []).length; i++) { var v = parseFloat(d.items[i].value) || 0; if (v > maxV) maxV = v; } }
      if (maxV <= 0) maxV = 100;
      var h = '<div class="pres-body">';
      if (d.title) h += '<h3 class="pres-h3">📊 ' + esc(d.title) + '</h3>';
      h += '<div style="display:flex;align-items:flex-end;gap:16px;height:240px;padding-top:10px">';
      for (var j = 0; j < (d.items || []).length; j++) {
        var it = d.items[j];
        var pct = Math.max(4, Math.round((parseFloat(it.value) || 0) / maxV * 100));
        var clr = it.color || PRES_COLORS[j % PRES_COLORS.length];
        h += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%">';
        if (d.showValues !== false) h += '<div style="font-size:13px;font-weight:700;color:' + clr + ';margin-bottom:4px">' + esc(it.value) + '</div>';
        h += '<div style="flex:1;width:100%;display:flex;align-items:flex-end"><div class="pres-bar-fill" data-fill="h" data-width="' + pct + '" style="width:100%;height:0;background:' + clr + ';border-radius:8px 8px 0 0;transition:height 1s ease"></div></div>';
        h += '<div style="font-size:11.5px;color:#64748b;margin-top:6px;text-align:center">' + esc(it.label || '') + '</div></div>';
      }
      return h + '</div></div>';
    }
  },
  /* ── 18. line-chart (SVG) */
  'line-chart': {
    desc: 'SVG line chart. {title?, labels:[], series:[{name, values:[], color?}], min?/max? auto, dataset?}',
    render: function(d) {
      var W = 640, H = 240, P = 34;
      var labels = d.labels || [];
      var series = d.series || [];
      if (d.dataset && DB.pres.datasets && DB.pres.datasets[d.dataset]) {
        var ds = DB.pres.datasets[d.dataset];
        labels = ds.labels || labels;
        series = ds.series.length ? ds.series : series;
      }
      if (!labels.length || !series.length) return '';
      var minV = Infinity, maxV = -Infinity;
      for (var i = 0; i < series.length; i++) {
        for (var j = 0; j < series[i].values.length; j++) {
          var v = parseFloat(series[i].values[j]);
          if (isNaN(v)) continue;
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
      }
      if (minV === Infinity) return '';
      if (typeof d.min === 'number') minV = d.min;
      if (typeof d.max === 'number') maxV = d.max;
      if (maxV - minV < 1e-9) maxV = minV + 1;
      function px(j) { return P + (labels.length <= 1 ? 0 : (j * (W - 2 * P)) / (labels.length - 1)); }
      function py(v) { return H - P - ((v - minV) / (maxV - minV)) * (H - 2 * P); }
      var h = '<div class="pres-body">';
      if (d.title) h += '<h3 class="pres-h3">📈 ' + esc(d.title) + '</h3>';
      h += '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto">';
      for (var g = 0; g <= 4; g++) {
        var gy = P + (g * (H - 2 * P)) / 4;
        var gv = maxV - ((maxV - minV) * g) / 4;
        h += '<line x1="' + P + '" y1="' + gy + '" x2="' + (W - P) + '" y2="' + gy + '" stroke="#e2e8f0" stroke-width="1"/>';
        h += '<text x="' + (P - 6) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="10" fill="#94a3b8">' + esc(Math.round(gv * 100) / 100) + '</text>';
      }
      for (var l = 0; l < labels.length; l++) {
        h += '<text x="' + px(l) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="10.5" fill="#64748b">' + esc(labels[l]) + '</text>';
      }
      for (var s = 0; s < series.length; s++) {
        var ser = series[s];
        var color = ser.color || PRES_COLORS[s % PRES_COLORS.length];
        var pts = '';
        for (var p = 0; p < ser.values.length; p++) {
          pts += (p ? ' ' : '') + px(p).toFixed(1) + ',' + py(parseFloat(ser.values[p]) || minV).toFixed(1);
        }
        h += '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
        for (var q = 0; q < ser.values.length; q++) {
          h += '<circle cx="' + px(q).toFixed(1) + '" cy="' + py(parseFloat(ser.values[q]) || minV).toFixed(1) + '" r="4.5" fill="#fff" stroke="' + color + '" stroke-width="3"/>';
        }
      }
      h += '</svg>';
      if (series.length > 1) {
        h += '<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">';
        for (var k = 0; k < series.length; k++) {
          h += '<span style="font-size:12px;color:#475569"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + (series[k].color || PRES_COLORS[k % PRES_COLORS.length]) + ';margin-right:5px"></span>' + esc(series[k].name || ('Series ' + (k + 1))) + '</span>';
        }
        h += '</div>';
      }
      return h + '</div>';
    }
  },
  /* ── 19. pie-chart */
  'pie-chart': {
    desc: 'Pie / donut. {title?, segments:[{label, value, color?}], donut?:true, size?:200, showLegend?:true, dataset?}',
    render: function(d) {
      if (d.dataset && DB.pres.datasets && DB.pres.datasets[d.dataset]) {
        var ds = DB.pres.datasets[d.dataset];
        d = { title: d.title || d.dataset, segments: (ds.labels || []).map(function(l, i) { return { label: l, value: (ds.values || [])[i] || 0 }; }), donut: d.donut, size: d.size, showLegend: d.showLegend };
      }
      var segs = d.segments || [];
      if (!segs.length) return '';
      var total = 0;
      for (var i = 0; i < segs.length; i++) total += parseFloat(segs[i].value) || 0;
      if (total <= 0) return '';
      var parts = [], cum = 0;
      for (var j = 0; j < segs.length; j++) {
        var pct = ((parseFloat(segs[j].value) || 0) / total) * 100;
        var clr = segs[j].color || PRES_COLORS[j % PRES_COLORS.length];
        parts.push(clr + ' ' + cum.toFixed(2) + '% ' + (cum + pct).toFixed(2) + '%');
        cum += pct;
      }
      var size = d.size || 210;
      var isDonut = d.donut !== false;
      var h = '<div class="pres-body" style="text-align:center">';
      if (d.title) h += '<h3 class="pres-h3">🥧 ' + esc(d.title) + '</h3>';
      h += '<div style="display:inline-block;position:relative;width:' + size + 'px;height:' + size + 'px">';
      h += '<div style="width:100%;height:100%;border-radius:50%;background:conic-gradient(' + parts.join(',') + ')"></div>';
      if (isDonut) {
        var hole = Math.round(size * 0.46);
        h += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:' + hole + 'px;height:' + hole + 'px;background:#fff;border-radius:50%"></div>';
        h += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-weight:800;color:#1e293b;font-size:20px">' + esc(d.centerLabel || total) + '</div>';
      }
      h += '</div>';
      if (d.showLegend !== false) {
        h += '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:12px">';
        for (var k = 0; k < segs.length; k++) {
          h += '<span style="font-size:12px;color:#475569"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + (segs[k].color || PRES_COLORS[k % PRES_COLORS.length]) + ';margin-right:5px"></span>' + esc(segs[k].label || '') + ' (' + Math.round((parseFloat(segs[k].value) || 0) / total * 100) + '%)</span>';
        }
        h += '</div>';
      }
      return h + '</div>';
    }
  },
  /* ── 19b. area-chart (SVG filled area) */
  'area-chart': {
    desc: 'Filled area chart. {title?, labels:[], series:[{name, values:[], color?}], dataset? (deck dataset name)}',
    render: function(d) {
      var labels = d.labels || [];
      var series = d.series || [];
      if (d.dataset && DB.pres.datasets && DB.pres.datasets[d.dataset]) {
        var ds = DB.pres.datasets[d.dataset];
        labels = ds.labels || labels;
        series = ds.series.length ? ds.series : series;
      }
      if (!labels.length || !series.length) return '';
      var W = 640, H = 240, P = 34;
      var minV = Infinity, maxV = -Infinity;
      for (var i = 0; i < series.length; i++) {
        for (var j = 0; j < series[i].values.length; j++) {
          var v = parseFloat(series[i].values[j]);
          if (isNaN(v)) continue;
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
      }
      if (minV === Infinity) return '';
      if (maxV - minV < 1e-9) maxV = minV + 1;
      function px(j) { return P + (labels.length <= 1 ? 0 : (j * (W - 2 * P)) / (labels.length - 1)); }
      function py(v) { return H - P - ((v - minV) / (maxV - minV)) * (H - 2 * P); }
      var h = '<div class="pres-body">';
      if (d.title) h += '<h3 class="pres-h3">📈 ' + esc(d.title) + '</h3>';
      h += '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto">';
      for (var g = 0; g <= 4; g++) {
        var gy = P + (g * (H - 2 * P)) / 4;
        h += '<line x1="' + P + '" y1="' + gy + '" x2="' + (W - P) + '" y2="' + gy + '" stroke="#e2e8f0" stroke-width="1"/>';
      }
      for (var l = 0; l < labels.length; l++) {
        h += '<text x="' + px(l) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="10.5" fill="#64748b">' + esc(labels[l]) + '</text>';
      }
      for (var s = 0; s < series.length; s++) {
        var ser = series[s];
        var color = ser.color || PRES_COLORS[s % PRES_COLORS.length];
        var pts = '';
        for (var p = 0; p < ser.values.length; p++) {
          pts += (p ? ' ' : '') + px(p).toFixed(1) + ',' + py(parseFloat(ser.values[p]) || minV).toFixed(1);
        }
        var area = pts + ' ' + px(ser.values.length - 1).toFixed(1) + ',' + (H - P).toFixed(1) + ' ' + px(0).toFixed(1) + ',' + (H - P).toFixed(1);
        h += '<polygon points="' + area + '" fill="' + color + '" opacity="0.14"/>';
        h += '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
      }
      h += '</svg>';
      if (series.length > 1) {
        h += '<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">';
        for (var k = 0; k < series.length; k++) {
          h += '<span style="font-size:12px;color:#475569"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + (series[k].color || PRES_COLORS[k % PRES_COLORS.length]) + ';margin-right:5px"></span>' + esc(series[k].name || ('Series ' + (k + 1))) + '</span>';
        }
        h += '</div>';
      }
      return h + '</div>';
    }
  },
  /* ── 19c. radar — spider chart */
  'radar': {
    desc: 'Radar/spider chart. {title?, axes:[], series:[{name, values:[], color?}], dataset?, size?:250}',
    render: function(d) {
      var axes = d.axes || [];
      var series = d.series || [];
      if (d.dataset && DB.pres.datasets && DB.pres.datasets[d.dataset]) {
        var ds = DB.pres.datasets[d.dataset];
        axes = ds.labels || axes;
        series = ds.series.length ? ds.series : series;
      }
      if (axes.length < 3 || !series.length) return '';
      var size = d.size || 260;
      var cx = size / 2, cy = size / 2, R = size / 2 - 44;
      function pt(i, ratio) {
        var ang = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
        return [cx + Math.cos(ang) * R * ratio, cy + Math.sin(ang) * R * ratio];
      }
      var h = '<div class="pres-body" style="text-align:center">';
      if (d.title) h += '<h3 class="pres-h3">🕸 ' + esc(d.title) + '</h3>';
      h += '<svg width="' + size + '" height="' + size + '" style="display:inline-block">';
      for (var g = 1; g <= 4; g++) {
        var pts = '';
        for (var a = 0; a < axes.length; a++) {
          var p = pt(a, g / 4);
          pts += (a ? ' ' : '') + p[0].toFixed(1) + ',' + p[1].toFixed(1);
        }
        h += '<polygon points="' + pts + '" fill="none" stroke="#e2e8f0" stroke-width="1"/>';
      }
      for (var ax = 0; ax < axes.length; ax++) {
        var tip = pt(ax, 1);
        h += '<line x1="' + cx + '" y1="' + cy + '" x2="' + tip[0].toFixed(1) + '" y2="' + tip[1].toFixed(1) + '" stroke="#e2e8f0" stroke-width="1"/>';
        var lab = pt(ax, 1.18);
        h += '<text x="' + lab[0].toFixed(1) + '" y="' + (lab[1] + 4).toFixed(1) + '" text-anchor="middle" font-size="10.5" fill="#64748b">' + esc(axes[ax]) + '</text>';
      }
      for (var s = 0; s < series.length; s++) {
        var ser = series[s];
        var color = ser.color || PRES_COLORS[s % PRES_COLORS.length];
        var max = 0;
        for (var m = 0; m < ser.values.length; m++) max = Math.max(max, parseFloat(ser.values[m]) || 0);
        if (max <= 0) max = 1;
        var p2 = '';
        for (var r = 0; r < axes.length; r++) {
          var ratio = Math.max(0.04, Math.min(1, (parseFloat(ser.values[r]) || 0) / max));
          var pp = pt(r, ratio);
          p2 += (r ? ' ' : '') + pp[0].toFixed(1) + ',' + pp[1].toFixed(1);
        }
        h += '<polygon points="' + p2 + '" fill="' + color + '" opacity="0.2" stroke="' + color + '" stroke-width="2"/>';
        for (var q = 0; q < axes.length; q++) {
          var ratio2 = Math.max(0.04, Math.min(1, (parseFloat(ser.values[q]) || 0) / max));
          var dp = pt(q, ratio2);
          h += '<circle cx="' + dp[0].toFixed(1) + '" cy="' + dp[1].toFixed(1) + '" r="3" fill="' + color + '"/>';
        }
      }
      h += '</svg>';
      return h + '</div>';
    }
  },
  /* ── 19d. scatter — bubble plot */
  'scatter': {
    desc: 'Scatter/bubble plot. {title?, points:[{x, y, label?, size?, color?}], xLabel?, yLabel?}',
    render: function(d) {
      var points = d.points || [];
      if (!points.length) return '';
      var W = 640, H = 250, P = 36;
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (var i = 0; i < points.length; i++) {
        var x = parseFloat(points[i].x), y = parseFloat(points[i].y);
        if (isNaN(x) || isNaN(y)) continue;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      if (minX === Infinity) return '';
      if (maxX - minX < 1e-9) maxX = minX + 1;
      if (maxY - minY < 1e-9) maxY = minY + 1;
      var h = '<div class="pres-body">';
      if (d.title) h += '<h3 class="pres-h3">🎯 ' + esc(d.title) + '</h3>';
      h += '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto">';
      h += '<line x1="' + P + '" y1="' + (H - P) + '" x2="' + (W - P) + '" y2="' + (H - P) + '" stroke="#cbd5e1" stroke-width="1.5"/>';
      h += '<line x1="' + P + '" y1="' + (H - P) + '" x2="' + P + '" y2="' + P + '" stroke="#cbd5e1" stroke-width="1.5"/>';
      if (d.xLabel) h += '<text x="' + (W / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10.5" fill="#64748b">' + esc(d.xLabel) + '</text>';
      if (d.yLabel) h += '<text x="14" y="' + (H / 2) + '" text-anchor="middle" font-size="10.5" fill="#64748b" transform="rotate(-90 14 ' + (H / 2) + ')">' + esc(d.yLabel) + '</text>';
      for (var p = 0; p < points.length; p++) {
        var pt = points[p];
        var pxv = P + ((parseFloat(pt.x) - minX) / (maxX - minX)) * (W - 2 * P);
        var pyv = (H - P) - ((parseFloat(pt.y) - minY) / (maxY - minY)) * (H - 2 * P);
        var color = pt.color || PRES_COLORS[p % PRES_COLORS.length];
        var r = Math.max(5, Math.min(22, parseInt(pt.size, 10) || 8));
        h += '<circle cx="' + pxv.toFixed(1) + '" cy="' + pyv.toFixed(1) + '" r="' + r + '" fill="' + color + '" opacity="0.75"/>';
        if (pt.label) h += '<text x="' + (pxv + r + 3).toFixed(1) + '" y="' + (pyv + 3).toFixed(1) + '" font-size="10" fill="#475569">' + esc(pt.label) + '</text>';
      }
      return h + '</svg></div>';
    }
  },
  /* ── 19e. org-tree — hierarchy */
  'org-tree': {
    desc: 'Org / hierarchy tree. {title?, root:{name, role?, children:[{name, role?, children:[…]}]}}',
    render: function(d) {
      var root = d.root;
      if (!root || !root.name) return '';
      function nodeHtml(n, depth) {
        var children = n.children || [];
        var color = PRES_COLORS[depth % PRES_COLORS.length];
        var h = '<li><div class="pres-org-node" style="border-color:' + color + '"><strong>' + esc(n.name || '') + '</strong>' +
          (n.role ? '<span>' + esc(n.role) + '</span>' : '') + '</div>';
        if (children.length) {
          h += '<ul>';
          for (var i = 0; i < children.length; i++) h += nodeHtml(children[i], depth + 1);
          h += '</ul>';
        }
        return h + '</li>';
      }
      var h = '<div class="pres-body">';
      if (d.title) h += '<h3 class="pres-h3">🏛 ' + esc(d.title) + '</h3>';
      h += '<div class="pres-org-tree"><ul>' + nodeHtml(root, 0) + '</ul></div>';
      return h + '</div>';
    }
  },
  /* ── 20. gauge */
  'gauge': {
    desc: 'Semi-circle gauge. {value, max?:100, min?:0, label?, color?}',
    render: function(d) {
      var val = parseFloat(d.value) || 0;
      var minV = parseFloat(d.min) || 0;
      var maxV = parseFloat(d.max) || 100;
      var pct = Math.max(0, Math.min(100, ((val - minV) / (maxV - minV || 1)) * 100));
      var color = d.color || (pct > 80 ? '#059669' : pct > 50 ? '#d97706' : '#dc2626');
      var size = d.size || 230;
      return '<div style="text-align:center;padding:6px 0">' +
        '<div style="display:inline-block;position:relative;width:' + size + 'px;height:' + Math.round(size / 2) + 'px;overflow:hidden">' +
        '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:conic-gradient(' + color + ' 0% ' + pct + '%, #e2e8f0 ' + pct + '% 100%)"></div></div>' +
        '<div style="font-size:34px;font-weight:900;color:' + color + ';margin-top:-10px">' + esc(d.value) + '<span style="font-size:14px;color:#94a3b8"> / ' + esc(d.max || 100) + '</span></div>' +
        (d.label ? '<div style="font-size:13px;color:#64748b;margin-top:2px">' + esc(d.label) + '</div>' : '') + '</div>';
    }
  },
  /* ── 21. progress-bars */
  'progress-bars': {
    desc: 'Multiple progress bars. {title?, items:[{label, percent (0-100), color?}]}',
    render: function(d) {
      var h = '<div class="pres-body">';
      if (d.title) h += '<h3 class="pres-h3">📈 ' + esc(d.title) + '</h3>';
      for (var i = 0; i < (d.items || []).length; i++) {
        var it = d.items[i];
        var pct = Math.max(0, Math.min(100, parseFloat(it.percent) || 0));
        var clr = it.color || PRES_COLORS[i % PRES_COLORS.length];
        h += '<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:13px;color:#334155;margin-bottom:4px"><span style="font-weight:600">' + esc(it.label || '') + '</span><span style="color:' + clr + ';font-weight:700">' + pct + '%</span></div>';
        h += '<div style="height:10px;background:#f1f5f9;border-radius:6px;overflow:hidden"><div class="pres-bar-fill" data-fill="w" data-width="' + pct + '" style="width:0;height:100%;background:' + clr + ';border-radius:6px;transition:width 1.1s ease"></div></div></div>';
      }
      return h + '</div>';
    }
  },
  /* ── 22. progress-ring */
  'progress-ring': {
    desc: 'Animated ring. {percent (0-100), label?, color?, size?:140}',
    render: function(d) {
      var pct = Math.max(0, Math.min(100, parseFloat(d.percent) || 0));
      var sz = d.size || 140;
      var color = d.color || '#4f46e5';
      var r = sz / 2 - 12;
      var circ = 2 * Math.PI * r;
      var off = circ * (1 - pct / 100);
      return '<div style="text-align:center;padding:6px 0">' +
        '<svg width="' + sz + '" height="' + sz + '" style="display:inline-block"><circle cx="' + (sz / 2) + '" cy="' + (sz / 2) + '" r="' + r + '" fill="none" stroke="#e2e8f0" stroke-width="10"/>' +
        '<circle class="pres-ring-fill" data-off="' + off.toFixed(1) + '" cx="' + (sz / 2) + '" cy="' + (sz / 2) + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + circ.toFixed(1) + '" style="transform:rotate(-90deg);transform-origin:' + (sz / 2) + 'px ' + (sz / 2) + 'px;transition:stroke-dashoffset 1.3s ease"/>' +
        '<text x="' + (sz / 2) + '" y="' + (sz / 2) + '" text-anchor="middle" dominant-baseline="central" style="font-size:' + Math.round(sz * 0.2) + 'px;font-weight:800;fill:' + color + '">' + pct + '%</text></svg>' +
        (d.label ? '<div style="margin-top:8px;font-weight:600;color:#1e293b;font-size:14px">' + esc(d.label) + '</div>' : '') + '</div>';
    }
  },
  /* ── 23. table */
  'table': {
    desc: 'Data table. {columns:[{key,header}], rows:[{key:value}], title?}',
    render: function(d) {
      var cols = d.columns || [];
      var rows = d.rows || [];
      if (!cols.length) return '';
      var h = '<div class="pres-body">';
      if (d.title) h += '<h3 class="pres-h3">📋 ' + esc(d.title) + '</h3>';
      h += '<table class="pres-table"><thead><tr>';
      for (var c = 0; c < cols.length; c++) h += '<th>' + esc(typeof cols[c] === 'string' ? cols[c] : (cols[c].header || cols[c].key)) + '</th>';
      h += '</tr></thead><tbody>';
      for (var r = 0; r < rows.length; r++) {
        h += '<tr>';
        for (var c2 = 0; c2 < cols.length; c2++) {
          var key = typeof cols[c2] === 'string' ? cols[c2] : cols[c2].key;
          h += '<td>' + esc(rows[r][key] === undefined ? '' : rows[r][key]) + '</td>';
        }
        h += '</tr>';
      }
      return h + '</tbody></table></div>';
    }
  },
  /* ── 24. stat-chart — display-only survey results */
  'stat-chart': {
    desc: 'Survey/statistics bars (display only). {title?, options:[{label, value}], showValues?:true}',
    render: function(d) {
      var total = 0;
      for (var i = 0; i < (d.options || []).length; i++) total += parseFloat(d.options[i].value) || 0;
      var h = '<div class="pres-body">';
      if (d.title) h += '<h3 class="pres-h3">📊 ' + esc(d.title) + '</h3>';
      for (var j = 0; j < (d.options || []).length; j++) {
        var opt = d.options[j];
        var val = parseFloat(opt.value) || 0;
        var pct = total > 0 ? Math.round((val / total) * 100) : 0;
        var clr = opt.color || PRES_COLORS[j % PRES_COLORS.length];
        h += '<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span style="color:#334155">' + esc(opt.label || '') + '</span><span style="color:' + clr + ';font-weight:700">' + (d.showValues === false ? esc(opt.value) : pct + '%') + '</span></div>';
        h += '<div style="height:10px;background:#f1f5f9;border-radius:6px;overflow:hidden"><div class="pres-bar-fill" data-fill="w" data-width="' + pct + '" style="width:0;height:100%;background:' + clr + ';border-radius:6px;transition:width 1.1s ease"></div></div></div>';
      }
      return h + '</div>';
    }
  },
  /* ── 25. timeline */
  'timeline': {
    desc: 'Timeline. {events:[{date, title, description?, icon?}], color?}',
    render: function(d) {
      var color = d.color || '#4f46e5';
      var h = '<div class="pres-body"><div style="position:relative;padding-left:30px">';
      h += '<div style="position:absolute;left:9px;top:6px;bottom:6px;width:2px;background:#e2e8f0"></div>';
      for (var i = 0; i < (d.events || []).length; i++) {
        var ev = d.events[i];
        h += '<div style="position:relative;margin-bottom:16px">';
        h += '<div style="position:absolute;left:-27px;top:4px;width:18px;height:18px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff">' + esc(ev.icon || '●') + '</div>';
        if (ev.date) h += '<div style="font-size:11px;color:#94a3b8;font-weight:600">' + esc(ev.date) + '</div>';
        h += '<strong style="color:#1e293b;font-size:14px">' + esc(ev.title || '') + '</strong>';
        if (ev.description) h += '<div style="font-size:12.5px;color:#64748b">' + esc(ev.description) + '</div>';
        h += '</div>';
      }
      return h + '</div></div>';
    }
  },
  /* ── 26. process-flow */
  'process-flow': {
    desc: 'Horizontal process with arrows. {title?, steps:[{label, description?, icon?}], color?}',
    render: function(d) {
      var color = d.color || '#4f46e5';
      var steps = d.steps || [];
      var h = '<div class="pres-body">';
      if (d.title) h += '<h3 class="pres-h3">🔄 ' + esc(d.title) + '</h3>';
      h += '<div style="display:flex;align-items:stretch;gap:0;overflow-x:auto;padding:8px 0">';
      for (var i = 0; i < steps.length; i++) {
        var st = steps[i];
        h += '<div style="flex:1;min-width:110px;background:#fff;border:2px solid ' + color + ';border-radius:12px;padding:14px 10px;text-align:center;position:relative">';
        if (st.icon) h += '<div style="font-size:24px;margin-bottom:4px">' + esc(st.icon) + '</div>';
        h += '<div style="font-weight:700;color:' + color + ';font-size:11px;margin-bottom:2px">STEP ' + (i + 1) + '</div>';
        h += '<div style="font-weight:700;color:#1e293b;font-size:13px">' + esc(st.label || '') + '</div>';
        if (st.description) h += '<div style="font-size:11px;color:#64748b;margin-top:4px;line-height:1.35">' + esc(st.description) + '</div>';
        h += '</div>';
        if (i < steps.length - 1) {
          h += '<div style="flex-shrink:0;display:flex;align-items:center;padding:0 3px"><div style="width:18px;height:2px;background:' + color + ';position:relative"><div style="position:absolute;right:-5px;top:-6px;width:0;height:0;border-left:9px solid ' + color + ';border-top:7px solid transparent;border-bottom:7px solid transparent"></div></div></div>';
        }
      }
      return h + '</div></div>';
    }
  },
  /* ── 27. steps — numbered vertical */
  'steps': {
    desc: 'Numbered procedure. {title?, steps:[{title?, description, icon?}]}',
    render: function(d) {
      var h = '<div class="pres-body">';
      if (d.title) h += '<h3 class="pres-h3">📋 ' + esc(d.title) + '</h3>';
      for (var i = 0; i < (d.steps || []).length; i++) {
        var s = d.steps[i];
        h += '<div style="display:flex;gap:13px;margin-bottom:13px;align-items:flex-start">';
        h += '<div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:#4f46e5;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700">' + (i + 1) + '</div>';
        h += '<div><strong style="color:#1e293b">' + (s.icon ? esc(s.icon) + ' ' : '') + esc(s.title || ('Step ' + (i + 1))) + '</strong>';
        if (s.description) h += '<div style="font-size:13px;color:#64748b;margin-top:2px">' + esc(s.description) + '</div></div></div>';
      }
      return h + '</div>';
    }
  },
  /* ── 28. funnel */
  'funnel': {
    desc: 'Funnel chart. {title?, stages:[{label, value, color?}] (top to bottom)}',
    render: function(d) {
      var stages = d.stages || [];
      if (!stages.length) return '';
      var maxV = 0;
      for (var i = 0; i < stages.length; i++) { var sv = parseFloat(stages[i].value) || 0; if (sv > maxV) maxV = sv; }
      var h = '<div class="pres-body" style="text-align:center">';
      if (d.title) h += '<h3 class="pres-h3">🔽 ' + esc(d.title) + '</h3>';
      for (var j = 0; j < stages.length; j++) {
        var st = stages[j];
        var pct = maxV > 0 ? Math.max(18, Math.round(((parseFloat(st.value) || 0) / maxV) * 100)) : 100;
        var clr = st.color || PRES_COLORS[j % PRES_COLORS.length];
        h += '<div style="margin:0 auto 5px;width:' + pct + '%;background:' + clr + ';color:#fff;padding:8px 16px;font-weight:600;font-size:12.5px;border-radius:6px;min-width:70px">' + esc(st.label || '') + ' — ' + esc(st.value) + '</div>';
      }
      return h + '</div>';
    }
  },
  /* ── 29. pyramid */
  'pyramid': {
    desc: 'Hierarchy pyramid. {title?, levels:[{label, description?, color?}] (bottom → top)}',
    render: function(d) {
      var levels = d.levels || [];
      if (!levels.length) return '';
      var colors = ['#3b82f6', '#4f46e5', '#7c3aed', '#a855f7', '#d946ef'];
      var h = '<div class="pres-body">';
      if (d.title) h += '<h3 class="pres-h3">🔺 ' + esc(d.title) + '</h3>';
      h += '<div style="margin:6px auto;max-width:520px">';
      for (var i = levels.length - 1; i >= 0; i--) {
        var lvl = levels[i];
        var width = 52 + ((i + 1) / levels.length) * 48;
        var bg = lvl.color || colors[i % colors.length];
        h += '<div style="margin:0 auto 5px;width:' + width.toFixed(1) + '%;background:' + bg + ';color:#fff;text-align:center;padding:9px 10px;border-radius:6px;font-weight:600;font-size:13px">' + esc(lvl.label || '');
        if (lvl.description) h += '<div style="font-size:10.5px;opacity:0.85;font-weight:400">' + esc(lvl.description) + '</div>';
        h += '</div>';
      }
      return h + '</div></div>';
    }
  },
  /* ── 30. comparison */
  'comparison': {
    desc: 'A vs B table. {aLabel, bLabel, rows:[{dimension, a, b}], title?}',
    render: function(d) {
      var h = '<div class="pres-body">';
      if (d.title) h += '<h3 class="pres-h3">⚖️ ' + esc(d.title) + '</h3>';
      h += '<table class="pres-table"><thead><tr><th style="width:28%">Dimension</th><th style="color:#4f46e5">' + esc(d.aLabel || 'A') + '</th><th style="color:#d97706">' + esc(d.bLabel || 'B') + '</th></tr></thead><tbody>';
      for (var i = 0; i < (d.rows || []).length; i++) {
        var r = d.rows[i];
        h += '<tr><td style="font-weight:600;color:#1e293b">' + esc(r.dimension || r.label || '') + '</td><td>' + esc(r.a) + '</td><td>' + esc(r.b) + '</td></tr>';
      }
      return h + '</tbody></table></div>';
    }
  },
  /* ── 31. pros-cons */
  'pros-cons': {
    desc: 'Pros / cons panels. {prosTitle?, pros:[], consTitle?, cons:[]}',
    render: function(d) {
      var h = '<div class="pres-body pres-cols-2">';
      h += '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px"><h4 style="color:#065f46;margin-bottom:8px">✅ ' + esc(d.prosTitle || 'Pros') + '</h4><ul class="pres-bullets" style="--pres-accent:#059669">';
      for (var i = 0; i < (d.pros || []).length; i++) h += '<li><span class="pres-bullet-icon">➕</span><span>' + esc(d.pros[i]) + '</span></li>';
      h += '</ul></div>';
      h += '<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:12px;padding:16px"><h4 style="color:#991b1b;margin-bottom:8px">❌ ' + esc(d.consTitle || 'Cons') + '</h4><ul class="pres-bullets" style="--pres-accent:#dc2626">';
      for (var j = 0; j < (d.cons || []).length; j++) h += '<li><span class="pres-bullet-icon">➖</span><span>' + esc(d.cons[j]) + '</span></li>';
      return h + '</ul></div></div>';
    }
  },
  /* ── 32. swot */
  'swot': {
    desc: 'SWOT 2×2. {strengths:[], weaknesses:[], opportunities:[], threats:[]}',
    render: function(d) {
      var cells = [
        ['💪 Strengths', d.strengths, '#ecfdf5', '#065f46'],
        ['⚠️ Weaknesses', d.weaknesses, '#fef2f2', '#991b1b'],
        ['🚀 Opportunities', d.opportunities, '#eef2ff', '#3730a3'],
        ['🔥 Threats', d.threats, '#fef3c7', '#92400e']
      ];
      var h = '<div class="pres-body" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;height:100%">';
      for (var c = 0; c < 4; c++) {
        h += '<div style="background:' + cells[c][2] + ';border-radius:12px;padding:14px 16px;overflow:hidden"><strong style="color:' + cells[c][3] + ';font-size:13.5px">' + cells[c][0] + '</strong><ul class="pres-bullets" style="--pres-accent:' + cells[c][3] + ';margin-top:6px">';
        for (var i = 0; i < ((cells[c][1] || [])).length; i++) h += '<li><span class="pres-bullet-icon">▸</span><span style="font-size:12.5px">' + esc(cells[c][1][i]) + '</span></li>';
        h += '</ul></div>';
      }
      return h + '</div>';
    }
  },
  /* ── 33. matrix — quadrant cards */
  'matrix': {
    desc: 'Quadrant matrix. {title?, rows?:2, cols?:2, cells:[{title, body?, icon?, color?}], axis?:{x,y}}',
    render: function(d) {
      var rows = parseInt(d.rows, 10) || 2;
      var cols = parseInt(d.cols, 10) || 2;
      var h = '<div class="pres-body">';
      if (d.title) h += '<h3 class="pres-h3">🧮 ' + esc(d.title) + '</h3>';
      h += '<div style="display:grid;grid-template-columns:repeat(' + cols + ',1fr);grid-template-rows:repeat(' + rows + ',1fr);gap:10px;height:100%;min-height:220px">';
      for (var i = 0; i < (d.cells || []).length; i++) {
        var cell = d.cells[i];
        var clr = cell.color || PRES_COLORS[i % PRES_COLORS.length];
        h += '<div style="background:#fff;border:1px solid #e2e8f0;border-top:4px solid ' + clr + ';border-radius:12px;padding:13px 16px;overflow:hidden">';
        h += '<div style="font-weight:700;color:' + clr + ';font-size:14px">' + (cell.icon ? esc(cell.icon) + ' ' : '') + esc(cell.title || '') + '</div>';
        if (cell.body) h += '<div style="font-size:12.5px;color:#64748b;margin-top:4px;line-height:1.5">' + esc(cell.body) + '</div>';
        h += '</div>';
      }
      return h + '</div></div>';
    }
  },
  /* ── 34. venn-diagram */
  'venn-diagram': {
    desc: 'Venn diagram. {title?, sets:[{label, size?, color?}], intersections?:[{text}]}',
    render: function(d) {
      var sets = d.sets || [];
      if (sets.length < 2) return '';
      var size = d.size || 270;
      var colors = ['rgba(79,70,229,0.45)', 'rgba(5,150,105,0.45)', 'rgba(217,119,6,0.45)'];
      var borders = ['#4f46e5', '#059669', '#d97706'];
      var positions = [[{ left: '6%', top: '18%' }, { left: '42%', top: '18%' }, { left: '24%', top: '44%' }]];
      var h = '<div class="pres-body" style="text-align:center">';
      if (d.title) h += '<h3 class="pres-h3">🔵 ' + esc(d.title) + '</h3>';
      h += '<div style="position:relative;display:inline-block;width:' + size + 'px;height:' + size + 'px">';
      for (var i = 0; i < sets.length; i++) {
        var s = sets[i];
        var sz = (s.size || Math.round(size * 0.62)) + 'px';
        var pos = positions[0][i] || positions[0][0];
        h += '<div style="position:absolute;left:' + pos.left + ';top:' + pos.top + ';width:' + sz + ';height:' + sz + ';border-radius:50%;background:' + (s.color || colors[i]) + ';border:2px solid ' + borders[i] + ';display:flex;align-items:center;justify-content:center;font-weight:700;color:#1e293b;font-size:12.5px;padding:10px">' + esc(s.label || '') + '</div>';
      }
      for (var j = 0; j < (d.intersections || []).length; j++) {
        h += '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:11px;color:#1e293b;font-weight:600;background:rgba(255,255,255,0.85);padding:2px 9px;border-radius:10px;z-index:2">' + esc(d.intersections[j].text || '') + '</div>';
      }
      return h + '</div></div>';
    }
  },
  /* ── 35. before-after */
  'before-after': {
    desc: 'Before vs after panes. {beforeTitle?, before, afterTitle?, after}',
    render: function(d) {
      return '<div class="pres-body pres-cols-2">' +
        '<div style="background:#fef2f2;border:2px solid #fca5a5;border-radius:12px;padding:16px"><div style="font-weight:700;color:#991b1b;margin-bottom:8px">❌ ' + esc(d.beforeTitle || 'Before') + '</div><div style="color:#475569;font-size:14px;line-height:1.6">' + esc(d.before || '') + '</div></div>' +
        '<div style="background:#ecfdf5;border:2px solid #6ee7b7;border-radius:12px;padding:16px"><div style="font-weight:700;color:#065f46;margin-bottom:8px">✅ ' + esc(d.afterTitle || 'After') + '</div><div style="color:#475569;font-size:14px;line-height:1.6">' + esc(d.after || '') + '</div></div></div>';
    }
  },
  /* ── 36. icon-grid */
  'icon-grid': {
    desc: 'Emoji feature grid. {items:[{emoji, name, subtitle?}], cols?:3|4}',
    render: function(d) {
      var cols = { '3': 'pres-cols-3', '4': 'pres-cols-4' }[String(d.cols || '3')] || 'pres-cols-3';
      var h = '<div class="' + cols + '">';
      for (var i = 0; i < (d.items || []).length; i++) {
        var it = d.items[i];
        h += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px 12px;text-align:center">' +
          '<div style="font-size:30px;margin-bottom:6px">' + esc(it.emoji || '📌') + '</div>' +
          '<div style="font-weight:600;color:#1e293b;font-size:13.5px">' + esc(it.name || '') + '</div>' +
          (it.subtitle ? '<div style="font-size:11.5px;color:#94a3b8;margin-top:3px">' + esc(it.subtitle) + '</div>' : '') + '</div>';
      }
      return h + '</div>';
    }
  },
  /* ── 37. card-grid */
  'card-grid': {
    desc: 'Info cards. {items:[{emoji?, title, body?, tag?, color?}], cols?:2|3}',
    render: function(d) {
      var cols = { '2': 'pres-cols-2', '3': 'pres-cols-3' }[String(d.cols || '2')] || 'pres-cols-2';
      var h = '<div class="' + cols + '">';
      for (var i = 0; i < (d.items || []).length; i++) {
        var it = d.items[i];
        var clr = it.color || PRES_COLORS[i % PRES_COLORS.length];
        h += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;position:relative">';
        if (it.tag) h += '<span style="position:absolute;top:12px;right:14px;font-size:10px;padding:2px 9px;border-radius:10px;background:' + clr + ';color:#fff;font-weight:600">' + esc(it.tag) + '</span>';
        if (it.emoji) h += '<div style="font-size:26px;margin-bottom:6px">' + esc(it.emoji) + '</div>';
        h += '<div style="font-weight:700;color:#1e293b;font-size:14px;margin-bottom:4px">' + esc(it.title || '') + '</div>';
        if (it.body) h += '<div style="font-size:12.5px;color:#64748b;line-height:1.55">' + esc(it.body) + '</div>';
        h += '</div>';
      }
      return h + '</div>';
    }
  },
  /* ── 38. flip-card */
  'flip-card': {
    desc: 'Click-to-flip concept card. {front, back}',
    render: function(d, ctx) {
      var id = ctx.uid();
      return '<label class="pres-flip-wrap" style="display:block;cursor:pointer;perspective:900px;height:100%">' +
        '<input type="checkbox" class="pres-flip-check" id="' + id + '" style="position:absolute;opacity:0;pointer-events:none">' +
        '<div class="pres-flip-card">' +
        '<div class="pres-flip-front" style="position:absolute;inset:0;backface-visibility:hidden;background:#eef2ff;border:2px solid #c7d2fe;border-radius:14px;padding:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">' +
        '<div style="font-size:12px;color:#6366f1;margin-bottom:8px;font-weight:700">🧠 CONCEPT</div>' +
        '<div style="font-size:clamp(15px,2vw,22px);font-weight:700;color:#1e293b">' + esc(d.front || '') + '</div>' +
        '<div style="font-size:11px;color:#94a3b8;margin-top:10px">👆 Click to reveal</div></div>' +
        '<div class="pres-flip-back" style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg);background:#ecfdf5;border:2px solid #a7f3d0;border-radius:14px;padding:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">' +
        '<div style="font-size:12px;color:#059669;margin-bottom:8px;font-weight:700">💡 ANSWER</div>' +
        '<div style="font-size:clamp(13px,1.8vw,19px);color:#1e293b;line-height:1.6">' + esc(d.back || '') + '</div>' +
        '<div style="font-size:11px;color:#94a3b8;margin-top:10px">👆 Click to flip back</div></div>' +
        '</div></label>';
    }
  },
  /* ── 39. spotlight */
  'spotlight': {
    desc: 'Pulsing attention highlight. {text, icon? (💡), color?}',
    render: function(d) {
      var color = d.color || '#4f46e5';
      return '<div class="pres-spotlight" style="border:2px solid ' + color + ';background:#fff;border-radius:14px;padding:20px 26px;margin:14px 0;text-align:center;animation:presSpot 2.6s ease-in-out infinite">' +
        '<div style="font-size:30px;margin-bottom:6px">' + esc(d.icon || '💡') + '</div>' +
        '<p style="color:#1e293b;font-weight:700;font-size:clamp(14px,1.8vw,20px);margin:0">' + esc(d.text || d.body || '') + '</p></div>';
    }
  },
  /* ── 40. quiz */
  'quiz': {
    desc: 'Interactive quiz (radio reveal). {title?, items:[{question, options:[], correct (0-based), explanation?}]}',
    render: function(d, ctx) {
      var h = '<div class="pres-body">';
      if (d.title) h += '<h3 class="pres-h3">❓ ' + esc(d.title) + '</h3>';
      for (var i = 0; i < (d.items || []).length; i++) {
        var q = d.items[i];
        var qid = ctx.uid();
        h += '<div class="pres-quiz-item">';
        h += '<div style="font-weight:700;color:#1e293b;margin-bottom:8px;font-size:14px">' + (i + 1) + '. ' + esc(q.question || '') + '</div>';
        h += '<div class="pres-quiz-opts">';
        for (var o = 0; o < (q.options || []).length; o++) {
          var isC = o === (q.correct || 0);
          h += '<input type="radio" class="pres-q-radio' + (isC ? ' pres-q-correct' : '') + '" name="' + qid + '" id="' + qid + '-' + o + '">' +
            '<label class="pres-q-opt" for="' + qid + '-' + o + '">' + esc(q.options[o]) + '</label>';
        }
        h += '<div class="pres-q-feedback"><div style="font-weight:700;color:#065f46">✅ ' + esc((q.options || [])[q.correct || 0] || 'Correct answer') + '</div>' +
          (q.explanation ? '<div style="color:#64748b;margin-top:4px;font-size:12.5px">' + esc(q.explanation) + '</div>' : '') + '</div>';
        h += '</div></div>';
      }
      return h + '</div>';
    }
  },
  /* ── 41. reveal */
  'reveal': {
    desc: 'Click-to-reveal. {teaser, content, icon? (👁️)}',
    render: function(d) {
      return '<details class="pres-reveal" style="border:2px dashed #818cf8;background:#eef2ff;border-radius:12px;padding:14px 18px;margin:12px 0">' +
        '<summary style="cursor:pointer;color:#4f46e5;font-weight:700;font-size:14px;list-style:none">' + esc(d.icon || '👁️') + ' ' + esc(d.teaser || 'Click to reveal') + '</summary>' +
        '<div style="margin-top:10px;padding-top:10px;border-top:1px solid #c7d2fe;line-height:1.65;color:#475569;font-size:14px">' + (d.content || '') + '</div></details>';
    }
  },
  /* ── 42. tabs — container with nested components */
  'tabs': {
    desc: 'Tabbed panes. {tabs:[{label, items:[component descriptors]}], title?}',
    render: function(d, ctx) {
      if (!d.tabs || !d.tabs.length) return '';
      var h = '<div class="pres-body">';
      if (d.title) h += '<h3 class="pres-h3">📑 ' + esc(d.title) + '</h3>';
      h += '<div class="pres-tabs">';
      h += '<div class="pres-tab-btns">';
      for (var i = 0; i < d.tabs.length; i++) {
        h += '<button class="pres-tab-btn' + (i === 0 ? ' active' : '') + '" data-tab="' + i + '">' + esc(d.tabs[i].label || ('Tab ' + (i + 1))) + '</button>';
      }
      h += '</div><div class="pres-tab-panes">';
      for (var j = 0; j < d.tabs.length; j++) {
        h += '<div class="pres-tab-pane' + (j === 0 ? ' active' : '') + '" data-pane="' + j + '">' + renderComponents(d.tabs[j].items || []) + '</div>';
      }
      return h + '</div></div></div>';
    }
  },
  /* ── 43. checklist */
  'checklist': {
    desc: 'Checkable list. {title?, items:[{text, checked?}]}',
    render: function(d) {
      var h = '<div class="pres-body">';
      if (d.title) h += '<h3 class="pres-h3">✅ ' + esc(d.title) + '</h3>';
      for (var i = 0; i < (d.items || []).length; i++) {
        var it = d.items[i];
        var txt = typeof it === 'string' ? it : (it.text || '');
        var chk = it && it.checked;
        h += '<div style="display:flex;align-items:flex-start;gap:10px;padding:7px 0"><input type="checkbox"' + (chk ? ' checked' : '') + ' style="margin-top:4px;accent-color:#4f46e5;width:16px;height:16px"><span style="color:#334155;font-size:14px">' + esc(txt) + '</span></div>';
      }
      return h + '</div>';
    }
  },
  /* ── 44. logos */
  'logos': {
    desc: 'Client/partner logo strip. {items:[{name, emoji?}], note?}',
    render: function(d) {
      var h = '<div class="pres-body">';
      h += '<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;align-items:center">';
      for (var i = 0; i < (d.items || []).length; i++) {
        var it = d.items[i];
        h += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 18px;font-weight:700;color:#64748b;font-size:14px">' + (it.emoji ? esc(it.emoji) + ' ' : '') + esc(it.name || '') + '</div>';
      }
      h += '</div>';
      if (d.note) h += '<div class="pres-muted" style="text-align:center;margin-top:10px">' + esc(d.note) + '</div>';
      return h + '</div>';
    }
  },
  /* ── 45. columns — container with nested component descriptors */
  'columns': {
    desc: 'Column container. {items:[component descriptors], cols?:2|3, widths? (e.g. "1.2fr 0.8fr")}',
    render: function(d, ctx) {
      var style = d.widths ? d.widths : (String(d.cols || 2) === '3' ? '1fr 1fr 1fr' : '1fr 1fr');
      var h = '<div style="display:grid;grid-template-columns:' + esc(style) + ';gap:18px;flex:1;min-height:0">';
      for (var i = 0; i < (d.items || []).length; i++) {
        h += '<div style="min-width:0;display:flex;flex-direction:column;justify-content:center">' + ctx.rd(d.items[i]) + '</div>';
      }
      return h + '</div>';
    }
  },
  /* ── 46. divider */
  'divider': {
    desc: 'Divider with optional label. {label?}',
    render: function(d) {
      if (d.label) return '<div style="display:flex;align-items:center;gap:14px;margin:18px 0"><div style="flex:1;height:1px;background:#e2e8f0"></div><span style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8">' + esc(d.label) + '</span><div style="flex:1;height:1px;background:#e2e8f0"></div></div>';
      return '<div style="height:1px;background:#e2e8f0;margin:18px 0"></div>';
    }
  },
  /* ── 47. html — raw HTML/CSS/JS escape hatch */
  'html': {
    desc: 'Raw custom block. {html (markup), css? (injected styles), js? (deferred script — runs after deck runtime)}. Use for anything the library cannot express.',
    render: function(d) {
      var css = d.css ? '<style>' + _sanitizeCss(String(d.css)) + '</sty' + 'le>' : '';
      return css + '<div class="pres-raw">' + String(d.html || '') + '</div>';
    }
  }
};

/* Backward-compat aliases — kept for lenient AI output, but EXCLUDED from
   the catalog sent to the AI (the catalog lists only the 47 real types). */
var PRES_ALIAS_KEYS = { title: 1, section: 1, closing: 1, bars: 1, line: 1, pie: 1, stats: 1, kpis: 1 };
PRES_COMPONENTS['title'] = PRES_COMPONENTS['title-slide'];
PRES_COMPONENTS['section'] = PRES_COMPONENTS['section-slide'];
PRES_COMPONENTS['closing'] = PRES_COMPONENTS['closing-slide'];
PRES_COMPONENTS['bars'] = PRES_COMPONENTS['bar-chart'];
PRES_COMPONENTS['line'] = PRES_COMPONENTS['line-chart'];
PRES_COMPONENTS['pie'] = PRES_COMPONENTS['pie-chart'];
PRES_COMPONENTS['stats'] = PRES_COMPONENTS['stat-cards'];
PRES_COMPONENTS['kpis'] = PRES_COMPONENTS['stat-cards'];

function libraryCatalog() {
  var lines = [];
  for (var k in PRES_COMPONENTS) {
    if (Object.prototype.hasOwnProperty.call(PRES_COMPONENTS, k) && !PRES_ALIAS_KEYS[k]) lines.push('"' + k + '" — ' + PRES_COMPONENTS[k].desc);
  }
  return lines.join('\n');
}

/* ═══════════════════════════════════════════
   DECK RENDER (slides → static markup)
   ═══════════════════════════════════════════ */
function renderDeckMarkup(pres) {
  var slides = (pres && pres.slides) || [];
  var h = '<div class="pres-deck">';
  for (var i = 0; i < slides.length; i++) {
    var s = slides[i];
    h += '<section class="pres-slide' + (i === 0 ? ' is-active' : '') + '" data-slide="' + i + '" data-title="' + esc(s.title || ('Slide ' + (i + 1))) + '"' +
      (s.transition ? ' data-transition="' + esc(s.transition) + '"' : '') +
      (s.background ? ' style="background:' + esc(s.background) + '"' : '') + '>';
    h += '<div class="pres-slide-inner">' + renderComponents(s.components || []) + '</div>';
    h += '<div class="pres-slide-num">' + (i + 1) + ' / ' + slides.length + '</div>';
    h += '</section>';
  }
  return h + '</div>';
}

/* ═══════════════════════════════════════════
   DECK BASE CSS — embedded into preview + export
   ═══════════════════════════════════════════ */
var PRES_DECK_BASE_CSS = [
  'html,body{margin:0;padding:0;height:100%;overflow:hidden}',
  'body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#0f172a;color:#1e293b}',
  '#pres-root{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0f172a;padding:26px 26px 74px}',
  '.pres-deck{position:relative;aspect-ratio:16/9;width:100%;max-height:100%;}',
  '.pres-slide{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,0.45);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .3s ease,visibility 0s linear .3s}',
  '.pres-slide.is-active{opacity:1;visibility:visible;pointer-events:auto;z-index:2;transition:opacity .3s ease}',
  '.pres-slide-inner{flex:1;display:flex;flex-direction:column;overflow:auto;min-height:0;scrollbar-width:thin;position:relative;padding:clamp(22px,3vw,42px)}',
  '.pres-slide-num{position:absolute;bottom:10px;right:16px;font-size:11px;color:#94a3b8;font-weight:600;z-index:5;pointer-events:none}',
  '.pres-cover{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:48px 72px;box-sizing:border-box;overflow:auto}',
  '.pres-body{flex:1;padding:0;min-height:0}',
  '.pres-h1{font-size:clamp(24px,3.6vw,46px);font-weight:800;margin:0;line-height:1.2;letter-spacing:-0.01em}',
  '.pres-h2{font-size:clamp(20px,2.9vw,34px);font-weight:800;color:#1e293b;margin:0 0 4px;line-height:1.25}',
  '.pres-h3{font-size:clamp(15px,2vw,22px);font-weight:700;color:#334155;margin:0 0 12px}',
  '.pres-kicker{font-size:11px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;color:#4f46e5;margin-bottom:6px}',
  '.pres-muted{color:#94a3b8;font-size:12px}',
  '.pres-bullets{list-style:none;padding:0;margin:0}',
  '.pres-bullets li{display:flex;align-items:flex-start;gap:10px;padding:7px 0;color:#334155;font-size:clamp(13px,1.6vw,17px);line-height:1.5}',
  '.pres-bullet-icon{color:var(--pres-accent,#4f46e5);font-weight:700;flex-shrink:0}',
  '.pres-cols-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-content:start}',
  '.pres-cols-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;align-content:start}',
  '.pres-cols-4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;align-content:start}',
  '.pres-figure{margin:0;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;flex:1;min-height:0}',
  '.pres-img-ph{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,#eef2ff,#f5f3ff);border:1px dashed #c7d2fe;border-radius:12px;color:#6366f1;width:100%}',
  '.pres-img-ph .pres-img-ph-ico{font-size:26px}',
  '.pres-img-ph span:not(.pres-img-ph-ico){font-size:12px;color:#818cf8;font-weight:600}',
  '.pres-figure img{flex:1;min-height:0;display:block}',
  '.pres-figure figcaption{text-align:center;padding:6px 8px;background:#fff}',
  '.pres-table{width:100%;border-collapse:collapse;font-size:13.5px}',
  '.pres-table th{text-align:left;padding:9px 12px;background:#f1f5f9;font-weight:700;border-bottom:2px solid #e2e8f0}',
  '.pres-table td{padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#475569}',
  '.pres-table tr:nth-child(even) td{background:#fafbfc}',
  '.pres-quote-wrap{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:34px 56px;background:linear-gradient(135deg,#eef2ff,#f8fafc);border-radius:14px}',
  '.pres-quote-mark{font-size:40px;margin-bottom:10px}',
  '.pres-quote{margin:0;font-size:clamp(17px,2.4vw,28px);font-style:italic;color:#334155;line-height:1.5;max-width:85%;font-family:Georgia,serif}',
  '.pres-quote-by{margin-top:14px;font-weight:700;color:#4f46e5;font-size:14px}',
  '.pres-agenda{display:flex;flex-direction:column;gap:10px}',
  '.pres-agenda-item{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 18px;font-size:clamp(13px,1.6vw,18px);color:#1e293b}',
  '.pres-agenda-item[data-pres-goto]{cursor:pointer}',
  '.pres-agenda-item[data-pres-goto]:hover{border-color:#4f46e5;background:#eef2ff}',
  '.pres-agenda-num{flex-shrink:0;width:30px;height:30px;border-radius:50%;background:#4f46e5;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:14px}',
  '.pres-raw{height:100%;display:flex;flex-direction:column}',
  '.pres-unknown{background:#fef3c7;border:1px dashed #f59e0b;border-radius:10px;padding:12px 16px;color:#92400e;font-size:13px;margin:8px 0}',
  '.pres-q-radio{position:absolute;opacity:0;pointer-events:none;width:0;height:0}',
  '.pres-q-opt{display:block;padding:9px 14px;border:1px solid #e2e8f0;border-radius:9px;cursor:pointer;margin-bottom:6px;background:#fafbfc;font-size:13.5px;transition:all .15s}',
  '.pres-q-opt:hover{border-color:#818cf8;background:#eef2ff}',
  '.pres-q-radio:checked+.pres-q-opt{border-color:#4f46e5;background:#eef2ff;font-weight:700}',
  '.pres-q-feedback{display:none;margin-top:10px;padding:12px 15px;background:#d1fae5;border:1px solid #6ee7b7;border-radius:10px}',
  '.pres-q-radio:checked~.pres-q-feedback{display:block}',
  '.pres-flip-card{position:relative;width:100%;height:100%;min-height:150px;transition:transform .6s cubic-bezier(.4,0,.2,1);transform-style:preserve-3d}',
  '.pres-flip-check:checked+.pres-flip-card{transform:rotateY(180deg)}',
  '.pres-ring-fill{transition:stroke-dashoffset 1.3s ease}',
  '.pres-tab-btns{display:flex;gap:6px;border-bottom:2px solid #e2e8f0;margin-bottom:12px}',
  '.pres-tab-btn{padding:8px 16px;border:none;background:transparent;font-family:inherit;font-size:13.5px;font-weight:700;color:#94a3b8;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px}',
  '.pres-tab-btn.active{color:#4f46e5;border-bottom-color:#4f46e5}',
  '.pres-tab-pane{display:none}',
  '.pres-tab-pane.active{display:block}',
  '.pres-spotlight{animation:presSpot 2.6s ease-in-out infinite}',
  '@keyframes presSpot{0%,100%{box-shadow:0 0 10px rgba(79,70,229,.18);transform:scale(1)}50%{box-shadow:0 0 28px rgba(79,70,229,.4);transform:scale(1.012)}}',
  '.pres-ui{position:fixed;left:50%;transform:translateX(-50%);bottom:12px;display:flex;align-items:center;gap:4px;background:rgba(15,23,42,.88);backdrop-filter:blur(8px);border:1px solid #334155;border-radius:999px;padding:5px 9px;z-index:50;font-family:system-ui,sans-serif}',
  '.pres-ui-btn{border:none;background:transparent;color:#cbd5e1;font-size:15px;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center}',
  '.pres-ui-btn:hover{background:#334155;color:#fff}',
  '.pres-ui-btn.on{background:#4f46e5;color:#fff}',
  '.pres-ui-counter{color:#cbd5e1;font-size:12px;font-weight:700;margin:0 6px;min-width:56px;text-align:center}',
  '.pres-progress{position:fixed;top:0;left:0;height:3px;background:#7c3aed;width:0%;transition:width .3s ease;z-index:60}',
  '.pres-notes{position:fixed;left:50%;transform:translateX(-50%);bottom:60px;width:min(720px,90vw);max-height:40%;overflow:auto;background:#fef9c3;border:1px solid #facc15;border-radius:12px;padding:14px 18px;display:none;z-index:40;color:#713f12;font-size:14px;line-height:1.6;white-space:pre-wrap;box-shadow:0 12px 32px rgba(0,0,0,.3)}',
  /* org tree */
  '.pres-org-tree ul{display:flex;justify-content:center;list-style:none;padding:0;margin:0}',
  '.pres-org-tree li{display:flex;flex-direction:column;align-items:center;padding:0 10px;position:relative}',
  '.pres-org-tree .pres-org-node{background:#fff;border:2px solid #c7d2fe;border-radius:10px;padding:8px 14px;text-align:center;font-size:12px;color:#1e293b;max-width:170px}',
  '.pres-org-tree .pres-org-node span{display:block;color:#64748b;font-size:10.5px}',
  '.pres-org-tree>ul>li{margin-top:14px}',
  '.pres-org-tree>ul>li:before{content:"";position:absolute;top:-14px;left:50%;height:14px;border-left:1.5px solid #cbd5e1}',
  '.pres-org-tree li>ul{margin-top:14px}',
  '.pres-org-tree li>ul:before{content:"";position:absolute;top:-14px;left:50%;height:14px;border-left:1.5px solid #cbd5e1}',
  '.pres-org-tree li>ul>li:before{content:"";position:absolute;top:-14px;left:50%;width:50%;height:14px;border-top:1.5px solid #cbd5e1;border-left:1.5px solid #cbd5e1}',
  '.pres-org-tree li>ul>li:after{content:"";position:absolute;top:-14px;right:50%;width:50%;height:14px;border-top:1.5px solid #cbd5e1;border-right:1.5px solid #cbd5e1}',
  /* per-slide transitions (B5-style pack, applied via data-transition) */
  '.pres-slide.pres-t-slide.is-active{animation:presInSlide .45s ease}',
  '.pres-slide.pres-t-zoom.is-active{animation:presInZoom .45s ease}',
  '.pres-slide.pres-t-flip.is-active{animation:presInFlip .55s ease}',
  '@keyframes presInSlide{from{transform:translateX(7%);opacity:0}to{transform:none;opacity:1}}',
  '@keyframes presInZoom{from{transform:scale(.94);opacity:0}to{transform:none;opacity:1}}',
  '@keyframes presInFlip{from{transform:rotateY(-90deg);opacity:0}to{transform:none;opacity:1}}',
  /* presenter mode (E1) */
  '.pres-timer{position:fixed;top:10px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,.92);color:#e2e8f0;font-size:12px;font-weight:700;padding:4px 14px;border-radius:999px;z-index:60;display:none;font-family:system-ui,sans-serif}',
  '.pres-presenter .pres-timer{display:block}',
  '.pres-next{position:fixed;right:14px;bottom:70px;width:200px;background:rgba(15,23,42,.92);border:1px solid #334155;border-radius:12px;padding:10px 12px;color:#e2e8f0;font-size:11px;display:none;z-index:40;font-family:system-ui,sans-serif}',
  '.pres-next b{display:block;color:#a78bfa;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px}',
  '.pres-presenter .pres-next{display:block}',
  '.pres-presenter .pres-notes{display:block}',
  '.pres-presenter #pres-root{padding-bottom:190px}',
  /* E3 — ink + laser */
  '.pres-ink-canvas{position:fixed;inset:0;z-index:45;pointer-events:none;display:none}',
  '.pres-ink-canvas.on{pointer-events:auto;cursor:crosshair}',
  '.pres-laser{position:fixed;width:16px;height:16px;border-radius:50%;background:#ef4444;box-shadow:0 0 16px 5px rgba(239,68,68,0.75);pointer-events:none;z-index:46;display:none}',
  /* E4/E5 — overlays */
  '.pres-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.95);z-index:70;display:none;overflow:auto;padding:22px;font-family:system-ui,sans-serif}',
  '.pres-grid-head{display:flex;justify-content:space-between;align-items:center;color:#e2e8f0;font-size:14px;font-weight:700;margin-bottom:14px}',
  '.pres-grid-close{background:#334155;border:none;color:#e2e8f0;border-radius:8px;padding:4px 12px;cursor:pointer;font-weight:700}',
  '.pres-grid-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}',
  '.pres-grid-card{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:10px 12px;cursor:pointer;color:#cbd5e1}',
  '.pres-grid-card.on{border-color:#a78bfa;background:#312e81}',
  '.pres-grid-card:hover{border-color:#a78bfa}',
  '.pres-grid-num{display:inline-block;background:#7c3aed;color:#fff;font-size:10px;font-weight:800;border-radius:6px;padding:1px 7px;margin-bottom:6px}',
  '.pres-grid-card b{display:block;font-size:12px;color:#f1f5f9;margin-bottom:3px}',
  '.pres-grid-card span{display:block;font-size:10.5px;color:#94a3b8}',
  '.pres-reh-row{display:flex;align-items:center;gap:10px;color:#cbd5e1;font-size:12px;padding:6px 0;border-bottom:1px solid #1e293b}',
  '.pres-reh-row span{flex:0 0 80px}',
  '.pres-reh-row b{flex:0 0 50px;color:#a78bfa;text-align:right}',
  '.pres-reh-row.total b{color:#fbbf24}',
  '.pres-reh-bar{flex:1;height:6px;background:#1e293b;border-radius:4px;overflow:hidden}',
  '.pres-reh-bar div{height:100%;background:#7c3aed;border-radius:4px}',
  '@media print{body{background:#fff}#pres-root{position:static;padding:0;height:auto}.pres-deck{aspect-ratio:auto;max-height:none}.pres-slide{position:relative!important;inset:auto!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;page-break-after:always;border-radius:0;box-shadow:none;width:100%;height:100vh}.pres-slide-inner{overflow:visible}.pres-ui,.pres-progress,.pres-notes,.pres-slide-num,.pres-timer,.pres-next,.pres-ink-canvas,.pres-laser,.pres-overlay{display:none!important}}'
].join('\n');

/* ═══════════════════════════════════════════
   DECK RUNTIME — embedded (via toString) into
   the preview iframe AND the exported file.
   ═══════════════════════════════════════════ */
function PRES_RUNTIME(root, data, opts) {
  opts = opts || {};
  data = data || {};
  var deck = root ? root.querySelector('.pres-deck') : null;
  var slides = deck ? deck.querySelectorAll('.pres-slide') : [];
  var notes = data.notes || [];
  var durations = data.durations || [];
  var cur = Math.max(0, Math.min(parseInt(data.startSlide, 10) || 0, Math.max(0, slides.length - 1)));

  /* UI chrome */
  var bar = document.createElement('div');
  bar.className = 'pres-ui';
  bar.innerHTML =
    '<button class="pres-ui-btn" data-act="prev" title="Previous (←)">⏮</button>' +
    '<button class="pres-ui-btn" data-act="next" title="Next (→)">⏭</button>' +
    '<span class="pres-ui-counter">1 / ' + slides.length + '</span>' +
    '<button class="pres-ui-btn" data-act="play" title="Kiosk autoplay — uses per-slide durations, loops at the end">▶</button>' +
    '<button class="pres-ui-btn" data-act="notes" title="Speaker notes (N)">🗒</button>' +
    '<button class="pres-ui-btn" data-act="ink" title="Draw highlights (I)">🖊</button>' +
    '<button class="pres-ui-btn" data-act="laser" title="Laser pointer (L)">🔦</button>' +
    '<button class="pres-ui-btn" data-act="grid" title="Overview grid (G)">⊞</button>' +
    '<button class="pres-ui-btn" data-act="rehearsal" title="Rehearsal timer (R)">⏱</button>' +
    '<button class="pres-ui-btn" data-act="presenter" title="Presenter mode (P)">🎤</button>' +
    '<button class="pres-ui-btn" data-act="full" title="Fullscreen (F)">⛶</button>';
  document.body.appendChild(bar);
  var progress = document.createElement('div');
  progress.className = 'pres-progress';
  document.body.appendChild(progress);
  var notesBox = document.createElement('div');
  notesBox.className = 'pres-notes';
  document.body.appendChild(notesBox);
  var timerEl = document.createElement('div');
  timerEl.className = 'pres-timer';
  document.body.appendChild(timerEl);
  var nextBox = document.createElement('div');
  nextBox.className = 'pres-next';
  document.body.appendChild(nextBox);

  /* E3 — laser + ink */
  var laserEl = document.createElement('div');
  laserEl.className = 'pres-laser';
  document.body.appendChild(laserEl);
  var inkCanvas = document.createElement('canvas');
  inkCanvas.className = 'pres-ink-canvas';
  document.body.appendChild(inkCanvas);
  var inkCtx = inkCanvas.getContext ? inkCanvas.getContext('2d') : null;
  function sizeInk() {
    try {
      inkCanvas.width = window.innerWidth || 1280;
      inkCanvas.height = window.innerHeight || 720;
    } catch (e) {}
  }
  sizeInk();
  var inkOn = false;
  var laserOn = false;
  var drawing = false;
  var lastPt = null;
  function setInk(on) {
    inkOn = on;
    inkCanvas.classList.toggle('on', on);
    inkCanvas.style.display = on ? 'block' : 'none';
    var ib = bar.querySelector('[data-act="ink"]');
    if (ib) ib.classList.toggle('on', on);
  }
  function setLaser(on) {
    laserOn = on;
    laserEl.style.display = on ? 'block' : 'none';
    var lb = bar.querySelector('[data-act="laser"]');
    if (lb) lb.classList.toggle('on', on);
  }
  document.addEventListener('mousemove', function(e) {
    if (!laserOn) return;
    laserEl.style.left = (e.clientX - 8) + 'px';
    laserEl.style.top = (e.clientY - 8) + 'px';
  });
  inkCanvas.addEventListener('pointerdown', function(e) {
    if (!inkOn || !inkCtx) return;
    drawing = true;
    lastPt = [e.clientX, e.clientY];
  });
  inkCanvas.addEventListener('pointermove', function(e) {
    if (!inkOn || !drawing || !inkCtx) return;
    inkCtx.lineWidth = 3;
    inkCtx.strokeStyle = 'rgba(239,68,68,0.92)';
    inkCtx.lineCap = 'round';
    inkCtx.beginPath();
    inkCtx.moveTo(lastPt[0], lastPt[1]);
    inkCtx.lineTo(e.clientX, e.clientY);
    inkCtx.stroke();
    lastPt = [e.clientX, e.clientY];
  });
  inkCanvas.addEventListener('pointerup', function() { drawing = false; });

  /* E2 — kiosk autoplay (loops) */
  var playing = false;
  var playTimer = null;
  function scheduleNext() {
    if (!playing) return;
    playTimer = setTimeout(function() {
      if (!playing) return;
      if (cur >= slides.length - 1) show(0); else show(cur + 1);
      scheduleNext();
    }, durations[cur] || 6000);
  }
  function setPlay(on) {
    playing = on;
    if (playTimer) { clearTimeout(playTimer); playTimer = null; }
    var pb = bar.querySelector('[data-act="play"]');
    if (pb) { pb.textContent = on ? '⏸' : '▶'; pb.classList.toggle('on', on); }
    if (on) scheduleNext();
  }

  /* E4 — overview grid overlay */
  var gridOverlay = document.createElement('div');
  gridOverlay.className = 'pres-overlay';
  document.body.appendChild(gridOverlay);
  function openGrid() {
    var h = '<div class="pres-grid-head"><span>⊞ All slides — click to jump</span><button class="pres-grid-close">✕ Close</button></div><div class="pres-grid-cards">';
    for (var i = 0; i < slides.length; i++) {
      var heading = slides[i].querySelector('.pres-h2, .pres-h1, .pres-h3');
      h += '<div class="pres-grid-card' + (i === cur ? ' on' : '') + '" data-g="' + i + '">' +
        '<span class="pres-grid-num">' + (i + 1) + '</span>' +
        '<b>' + escT(slides[i].getAttribute('data-title') || ('Slide ' + (i + 1))) + '</b>' +
        (heading ? '<span>' + escT(String(heading.textContent).substring(0, 60)) + '</span>' : '') + '</div>';
    }
    h += '</div>';
    gridOverlay.innerHTML = h;
    gridOverlay.style.display = 'block';
  }
  gridOverlay.addEventListener('click', function(e) {
    var close = e.target.closest('.pres-grid-close');
    if (close) { gridOverlay.style.display = 'none'; return; }
    var card = e.target.closest('.pres-grid-card');
    if (card) {
      show(parseInt(card.getAttribute('data-g'), 10));
      gridOverlay.style.display = 'none';
    }
  });

  /* E5 — rehearsal timer (per-slide seconds) */
  var rehearsal = {};
  var rehearsalStart = Date.now();
  var rehearsalEl = document.createElement('div');
  rehearsalEl.className = 'pres-overlay';
  document.body.appendChild(rehearsalEl);
  function openRehearsal() {
    var total = 0;
    var h = '<div class="pres-grid-head"><span>⏱ Rehearsal — seconds per slide</span><button class="pres-grid-close">✕ Close</button></div>';
    for (var i = 0; i < slides.length; i++) {
      var ms = rehearsal[i] || 0;
      if (i === cur) ms += Date.now() - rehearsalStart;
      total += ms;
      var s = Math.round(ms / 1000);
      h += '<div class="pres-reh-row"><span>Slide ' + (i + 1) + '</span><div class="pres-reh-bar"><div style="width:' + Math.min(100, s / 3) + '%"></div></div><b>' + s + 's</b></div>';
    }
    h += '<div class="pres-reh-row total"><span>Total</span><div class="pres-reh-bar"></div><b>' + Math.round(total / 1000) + 's</b></div>';
    rehearsalEl.innerHTML = h;
    rehearsalEl.style.display = 'block';
  }
  rehearsalEl.addEventListener('click', function(e) {
    if (e.target.closest('.pres-grid-close')) rehearsalEl.style.display = 'none';
  });

  var presenter = false;
  var talkStart = null;
  var timerInt = null;
  function escT(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function setPresenter(on) {
    presenter = on;
    document.body.classList.toggle('pres-presenter', on);
    var pb = bar.querySelector('[data-act="presenter"]');
    if (pb) pb.classList.toggle('on', on);
    if (on) {
      talkStart = Date.now();
      if (timerInt) clearInterval(timerInt);
      timerInt = setInterval(function() {
        var el = Math.floor((Date.now() - talkStart) / 1000);
        timerEl.textContent = '⏱ ' + Math.floor(el / 60) + ':' + ('0' + (el % 60)).slice(-2);
      }, 1000);
    } else {
      if (timerInt) { clearInterval(timerInt); timerInt = null; }
      timerEl.textContent = '';
    }
    show(cur);
  }

  function fmtNum(el) {
    var v = parseFloat(el.getAttribute('data-count')) || 0;
    var target = v;
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var start = null;
    var dur = 1100;
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = prefix + Math.round(target * eased) + suffix;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function animateSlide(n) {
    var slide = slides[n];
    if (!slide) return;
    /* count-ups */
    var counts = slide.querySelectorAll('.pres-count');
    for (var c = 0; c < counts.length; c++) fmtNum(counts[c]);
    /* progress rings */
    var rings = slide.querySelectorAll('.pres-ring-fill');
    for (var r = 0; r < rings.length; r++) {
      var off = rings[r].getAttribute('data-off');
      if (off !== null) rings[r].style.strokeDashoffset = off;
    }
    /* bars (width or height mode is explicit in the markup) */
    var bars = slide.querySelectorAll('.pres-bar-fill');
    for (var b = 0; b < bars.length; b++) {
      var w = bars[b].getAttribute('data-width');
      if (w === null) continue;
      if (bars[b].getAttribute('data-fill') === 'h') bars[b].style.height = w + '%';
      else bars[b].style.width = w + '%';
    }
    /* staggered entrance (B4) — skipped at animLevel 'none' */
    if (data.animLevel !== 'none') {
      var inner = slide.querySelector('.pres-slide-inner');
      if (inner) {
        var kids = inner.children;
        for (var k = 0; k < kids.length; k++) {
          (function(el, delay) {
            el.style.transition = 'opacity .45s ease, transform .45s ease';
            el.style.transitionDelay = delay + 'ms';
            el.style.opacity = '0';
            el.style.transform = 'translateY(16px)';
            setTimeout(function() { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; }, 40);
          })(kids[k], k * 70);
        }
      }
    }
  }

  function show(n) {
    if (!slides.length) return;
    if (isNaN(n)) n = cur;
    if (n < 0) n = 0;
    if (n > slides.length - 1) n = slides.length - 1;
    if (n !== cur) {
      /* E5 — accumulate rehearsal time on the slide we are leaving */
      rehearsal[cur] = (rehearsal[cur] || 0) + (Date.now() - rehearsalStart);
      rehearsalStart = Date.now();
      /* E3 — ink is cleared per slide */
      if (inkCtx) inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
    }
    cur = n;
    for (var i = 0; i < slides.length; i++) {
      var on = i === cur;
      slides[i].classList.toggle('is-active', on);
      slides[i].classList.remove('pres-t-slide', 'pres-t-zoom', 'pres-t-flip');
      var tr = slides[i].getAttribute('data-transition') || data.transition || '';
      if (on && tr) slides[i].classList.add('pres-t-' + tr);
    }
    bar.querySelector('.pres-ui-counter').textContent = (cur + 1) + ' / ' + slides.length;
    progress.style.width = slides.length ? (((cur + 1) / slides.length) * 100) + '%' : '0%';
    notesBox.textContent = notes[cur] ? ('🗒 Speaker notes — slide ' + (cur + 1) + ':\n\n' + notes[cur]) : '';
    notesBox.style.display = presenter && notes[cur] ? 'block' : 'none';
    var notesBtn = bar.querySelector('[data-act="notes"]');
    if (notesBtn) notesBtn.classList.toggle('on', presenter && !!notes[cur]);
    /* next-slide preview */
    if (slides[cur + 1]) {
      var nextSlide = slides[cur + 1];
      var nextTitle = nextSlide.getAttribute('data-title') || ('Slide ' + (cur + 2));
      var nextHeading = nextSlide.querySelector('.pres-h2, .pres-h1, .pres-h3');
      nextBox.innerHTML = '<b>⏭ Next — ' + (cur + 2) + ' / ' + slides.length + '</b>' + escT(nextTitle) +
        (nextHeading ? '<div style="margin-top:4px;color:#94a3b8">' + escT(nextHeading.textContent.substring(0, 70)) + '</div>' : '');
    } else {
      nextBox.innerHTML = '<b>🏁 End of deck</b>';
    }
    animateSlide(cur);
    if (opts.sync && window.parent && window.parent.postMessage) {
      try { window.parent.postMessage({ pres: { type: 'current', n: cur, count: slides.length } }, '*'); } catch (e) {}
    }
  }

  function next() { show(Math.min(cur + 1, slides.length - 1)); }
  function prev() { show(Math.max(cur - 1, 0)); }

  bar.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    if (act === 'next') next();
    else if (act === 'prev') prev();
    else if (act === 'play') setPlay(!playing);
    else if (act === 'ink') setInk(!inkOn);
    else if (act === 'laser') setLaser(!laserOn);
    else if (act === 'grid') openGrid();
    else if (act === 'rehearsal') openRehearsal();
    else if (act === 'presenter') setPresenter(!presenter);
    else if (act === 'full') {
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      } catch (err) {}
    } else if (act === 'notes') {
      var vis = notesBox.style.display !== 'none';
      notesBox.style.display = vis ? 'none' : 'block';
      btn.classList.toggle('on', !vis);
    }
  });

  /* tabs + agenda jumps (event delegation) */
  document.addEventListener('click', function(e) {
    var tabBtn = e.target.closest('.pres-tab-btn');
    if (tabBtn) {
      var wrap = tabBtn.closest('.pres-tabs');
      if (!wrap) return;
      var idx = tabBtn.getAttribute('data-tab');
      var btns = wrap.querySelectorAll('.pres-tab-btn');
      for (var b = 0; b < btns.length; b++) btns[b].classList.toggle('active', btns[b] === tabBtn);
      var panes = wrap.querySelectorAll('.pres-tab-pane');
      for (var p = 0; p < panes.length; p++) panes[p].classList.toggle('active', panes[p].getAttribute('data-pane') === idx);
      return;
    }
    var goto = e.target.closest('[data-pres-goto]');
    if (goto) {
      var n = parseInt(goto.getAttribute('data-pres-goto'), 10);
      if (!isNaN(n)) show(n);
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); show(0); }
    else if (e.key === 'End') { e.preventDefault(); show(slides.length - 1); }
    else if (e.key === 'f' || e.key === 'F') {
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      } catch (err) {}
    }
    else if (e.key === 'n' || e.key === 'N') {
      var btn = bar.querySelector('[data-act="notes"]');
      if (btn) btn.click();
    }
    else if (e.key === 'p' || e.key === 'P') {
      setPresenter(!presenter);
    }
    else if (e.key === 'l' || e.key === 'L') {
      setLaser(!laserOn);
    }
    else if (e.key === 'i' || e.key === 'I') {
      setInk(!inkOn);
    }
    else if (e.key === 'g' || e.key === 'G') {
      openGrid();
    }
    else if (e.key === 'r' || e.key === 'R') {
      openRehearsal();
    }
    else if (e.key === 'Escape') {
      gridOverlay.style.display = 'none';
      rehearsalEl.style.display = 'none';
    }
  });

  if (opts.sync && window.addEventListener) {
    window.addEventListener('message', function(ev) {
      var d = ev && ev.data;
      if (!d || !d.pres || d.pres.type !== 'goto') return;
      var n = parseInt(d.pres.n, 10);
      if (!isNaN(n)) show(n);
    });
  }

  /* expose a small API for custom scripts */
  window.pres = { goto: show, next: next, prev: prev, current: function() { return cur; }, count: slides.length };

  show(data.startSlide ? parseInt(data.startSlide, 10) : 0);
}

/* ═══════════════════════════════════════════
   STANDALONE DOCUMENT (preview + export)
   ═══════════════════════════════════════════ */
function _sanitizeCss(css) {
  return String(css || '').replace(/<\/style/gi, '<\\/style');
}
function _sanitizeEmbeddedJs(js) {
  return String(js || '').replace(/<\/script/gi, '<\\/script');
}
function _jsonForEmbed(obj) {
  var json = JSON.stringify(obj || {});
  return json.replace(/<\//g, '<\\/');
}

function collectRawJs(pres) {
  var blocks = [];
  var slides = (pres && pres.slides) || [];
  for (var i = 0; i < slides.length; i++) {
    var comps = slides[i].components || [];
    for (var j = 0; j < comps.length; j++) {
      if (comps[j].type === 'html' && comps[j].data && comps[j].data.js) blocks.push(comps[j].data.js);
    }
  }
  if (pres && pres.deckJs) blocks.push(pres.deckJs);
  return blocks;
}

function buildStandalone() {
  var pres = DB.pres || {};
  var slides = pres.slides || [];
  var lang = _p('lang', 'en');
  var title = pres.title || 'Presentation';
  var runtimeData = {
    title: title,
    subtitle: pres.subtitle || '',
    author: pres.author || '',
    notes: slides.map(function(s) { return s.notes || ''; }),
    durations: slides.map(function(s) { return s.duration || 0; }),
    transition: pres.transition || '',
    startSlide: Math.max(0, Math.min(activeSlideIndex(), slides.length - 1)),
    animLevel: pres.animLevel === 'none' ? 'none' : 'subtle'
  };
  var rawJs = collectRawJs(pres);
  var parts = [];
  parts.push('<!DOCTYPE html>');
  parts.push('<html lang="' + esc(lang) + '">');
  parts.push('<head>');
  parts.push('<meta charset="utf-8">');
  parts.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  parts.push('<title>' + esc(title) + '</title>');
  parts.push('<style>' + PRES_DECK_BASE_CSS + '\n' + _sanitizeCss(pres.deckCss) + '\n' + _sanitizeCss((THEMES[pres.theme] && THEMES[pres.theme].css) || '') + '\n' + _sanitizeCss(brandCss()) + '</sty' + 'le>');
  parts.push('</head>');
  parts.push('<body>');
  parts.push('<div id="pres-root">');
  if (!slides.length) {
    parts.push('<div style="color:#cbd5e1;font-family:system-ui;font-size:16px;text-align:center;padding:40px">This presentation has no slides yet.</div>');
  } else {
    parts.push(renderDeckMarkup(pres));
  }
  parts.push('</div>');
  parts.push(S_OPEN);
  parts.push('var PRES_DATA = ' + _jsonForEmbed(runtimeData) + ';');
  parts.push('var PRES_RUNTIME = ' + PRES_RUNTIME.toString() + ';');
  parts.push('PRES_RUNTIME(document.getElementById("pres-root"), PRES_DATA, {sync:true});');
  parts.push(S_CLOSE);
  for (var i = 0; i < rawJs.length; i++) {
    parts.push(S_OPEN + '\n' + _sanitizeEmbeddedJs(rawJs[i]) + '\n' + S_CLOSE);
  }
  parts.push('</body>');
  parts.push('</html>');
  return parts.join('\n');
}

/* ═══════════════════════════════════════════
   HANDOUT / NOTES PAGES (F2) — slide on top,
   speaker notes below, one per printed page.
   ═══════════════════════════════════════════ */
var PRES_HANDOUT_CSS = [
  'html,body{margin:0;padding:0;background:#f1f5f9}',
  '.pres-handout-root{display:block;padding:24px;background:#f1f5f9}',
  '.pres-handout-page{break-after:page;page-break-after:always;background:#fff;border-radius:12px;overflow:hidden;margin-bottom:28px;box-shadow:0 4px 14px rgba(0,0,0,0.08)}',
  '.pres-handout-slide{position:relative;aspect-ratio:16/9;background:#fff;display:flex;overflow:hidden}',
  '.pres-handout-slide .pres-slide-inner{flex:1;display:flex;flex-direction:column;overflow:hidden;padding:clamp(20px,2.6vw,36px)}',
  '.pres-handout-notes{margin:0;padding:14px 18px;background:#fef9c3;border-top:1px solid #facc15;font-size:13px;line-height:1.6;color:#713f12;white-space:pre-wrap}',
  '.pres-handout-notes b{display:block;color:#92400e;margin-bottom:4px;font-size:12.5px}',
  '@media print{body{background:#fff}.pres-handout-root{padding:0}.pres-handout-page{box-shadow:none;border-radius:0;margin:0}}'
].join('\n');

function buildHandoutHtml() {
  var pres = DB.pres || {};
  var slides = pres.slides || [];
  var parts = [];
  parts.push('<!DOCTYPE html>');
  parts.push('<html lang="' + esc(_p('lang', pres.lang || 'en')) + '">');
  parts.push('<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">');
  parts.push('<title>' + esc((pres.title || 'Presentation') + ' — Notes') + '</title>');
  parts.push('<style>' + PRES_DECK_BASE_CSS + '\n' + _sanitizeCss((THEMES[pres.theme] && THEMES[pres.theme].css) || '') + '\n' + _sanitizeCss(brandCss()) + '\n' + PRES_HANDOUT_CSS + '</sty' + 'le>');
  parts.push('</head><body><div class="pres-handout-root">');
  for (var i = 0; i < slides.length; i++) {
    var s = slides[i];
    parts.push('<div class="pres-handout-page">');
    parts.push('<div class="pres-handout-slide"' + (s.background ? ' style="background:' + esc(s.background) + '"' : '') + '>');
    parts.push('<div class="pres-slide-inner">' + renderComponents(s.components || []) + '</div>');
    parts.push('</div>');
    parts.push('<div class="pres-handout-notes"><b>Slide ' + (i + 1) + ' — ' + esc(s.title || '') + '</b>' + esc(s.notes || 'No speaker notes for this slide.') + '</div>');
    parts.push('</div>');
  }
  parts.push('</div></body></html>');
  return parts.join('\n');
}

function downloadNotesPdf() {
  if (!DB.pres.slides.length) {
    try { tool.notify('Nothing to export yet — create some slides first.', 'warning'); } catch (e) {}
    return;
  }
  var doc = buildHandoutHtml();
  if (typeof tool.requestExportPdf === 'function') {
    try {
      tool.notify('Building notes pages…', 'info');
      tool.requestExportPdf({ html: doc, filename: slugify(DB.pres.title) + '-notes', landscape: false }, function(err, file) {
        if (err) { try { tool.notify('Notes PDF export failed: ' + err, 'error'); } catch (e) {} return; }
        try { tool.notify('Notes pages ready: ' + (file && file.name ? file.name : 'download'), 'success'); } catch (e) {}
        try { tool.openUrl(file.url); } catch (e2) {}
      });
    } catch (e) {
      try { tool.notify('Notes PDF unavailable: ' + e.message, 'warning'); } catch (e2) {}
    }
  } else {
    try { tool.notify('PDF export is not enabled (allowExportPdf: yes).', 'warning'); } catch (e) {}
  }
}

/* ═══════════════════════════════════════════
   DATA NORMALIZATION & PERSISTENCE
   ═══════════════════════════════════════════ */
function normalizeComponent(c) {
  if (!c || !c.type) return null;
  return { type: String(c.type), data: (c.data && typeof c.data === 'object') ? c.data : {} };
}

function normalizeSlide(s, idx) {
  var title = String((s && s.title) || ('Slide ' + (idx + 1)));
  var id = (s && s.id && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(String(s.id))) ? String(s.id) : genId();
  var components = [];
  var raw = (s && s.components) || [];
  if (Array.isArray(raw)) {
    for (var i = 0; i < raw.length; i++) {
      var c = normalizeComponent(raw[i]);
      if (c) components.push(c);
    }
  }
  return { id: id, title: title.substring(0, 120), notes: (s && s.notes) ? String(s.notes) : '', locked: !!(s && s.locked), duration: (s && typeof s.duration === 'number' && s.duration > 0) ? Math.round(s.duration) : 0, transition: (s && ['slide', 'zoom', 'flip'].indexOf(String(s.transition || '')) !== -1) ? String(s.transition) : '', background: String((s && s.background) || '').substring(0, 500), components: components };
}

function normalizeDatasets(ds) {
  var out = {};
  if (!ds || typeof ds !== 'object') return out;
  for (var k in ds) {
    if (!Object.prototype.hasOwnProperty.call(ds, k)) continue;
    var d = ds[k];
    if (!d || typeof d !== 'object') continue;
    out[k] = {
      labels: Array.isArray(d.labels) ? d.labels.map(function(x) { return String(x); }).slice(0, 24) : [],
      values: Array.isArray(d.values) ? d.values.slice(0, 24) : [],
      series: Array.isArray(d.series) ? d.series.slice(0, 4).map(function(s) {
        return { name: String((s && s.name) || ''), values: Array.isArray(s && s.values) ? s.values.slice(0, 24) : [] };
      }) : []
    };
  }
  return out;
}

function normalizeDeck(pres) {
  pres = pres || {};
  var slides = Array.isArray(pres.slides) ? pres.slides.slice() : [];
  return {
    title: String(pres.title || ''),
    subtitle: String(pres.subtitle || ''),
    author: String(pres.author || ''),
    slides: slides.map(function(s, i) { return normalizeSlide(s, i); }),
    deckCss: String(pres.deckCss || ''),
    deckJs: String(pres.deckJs || ''),
    theme: THEMES[String(pres.theme || '')] ? String(pres.theme) : 'clean',
    datasets: normalizeDatasets(pres.datasets),
    animLevel: pres.animLevel === 'none' ? 'none' : 'subtle',
    lang: String(pres.lang || ''),
    transition: ['slide', 'zoom', 'flip'].indexOf(String(pres.transition || '')) !== -1 ? String(pres.transition) : '',
    brand: {
      primary: _validHex((pres.brand && pres.brand.primary) || ''),
      font: String((pres.brand && pres.brand.font) || '').replace(/[^a-zA-Z0-9 \-',]/g, '').trim().substring(0, 60)
    }
  };
}

function _deckSnapshot() {
  return JSON.stringify(DB.pres) + '\u0001' + (DB.activeSlideId || '');
}

function _slimValue() {
  return {
    pres: DB.pres,
    activeSlideId: DB.activeSlideId || '',
    version: DB.version || '1.0.0',
    activeSessionId: DB.activeSessionId || '',
    chatCache: { sessionId: _activeSessionId || '', messages: _trimChatCache(DB.chatMessages) },
    history: DB.history || [],
    snippets: (DB.snippets || []).slice(0, 20),
    _instanceId: DB._instanceId || '',
    _parentRecordId: DB._parentRecordId || ''
  };
}

/* Stage the slim value and remember its JSON so an echo from the CMS
   (onValueChange) can be recognized and skipped — rebuilding the preview
   iframe on our own writes causes slide flicker. */
function _stageValue() {
  var slim = _slimValue();
  try { tool.setValue(slim); } catch (e) {}
  try { _lastStagedValue = JSON.stringify(slim); } catch (e) {}
}

function persist() {
  if (!_snapshotInitialized) {
    _lastPersistedSnapshot = _deckSnapshot();
    _snapshotInitialized = true;
  } else {
    var snap = _deckSnapshot();
    if (_lastPersistedSnapshot !== null && snap !== _lastPersistedSnapshot && !_aiJustUpdated) _bumpVersion('patch');
    _lastPersistedSnapshot = _deckSnapshot();
  }
  _aiJustUpdated = false;
  DB.chatCache = { sessionId: _activeSessionId, messages: _trimChatCache(DB.chatMessages) };
  _stageValue();
  if (_activeSessionId) saveCurrentSession();
  tool.resize();
}

/* Silently store navigation state (no version bump, no session write) */
function saveNavigationState() {
  _stageValue();
}

function _bumpVersion(level) {
  if (!DB.version) DB.version = '1.0.0';
  var parts = DB.version.split('.');
  var maj = parseInt(parts[0], 10) || 0;
  var min = parseInt(parts[1], 10) || 0;
  var pat = parseInt(parts[2], 10) || 0;
  if (level === 'major') { maj += 1; min = 0; pat = 0; }
  else if (level === 'minor') { min += 1; pat = 0; }
  else { pat += 1; }
  DB.version = maj + '.' + min + '.' + pat;
  renderVersion();
}

function renderVersion() {
  var badge = el('tool-version');
  if (badge) badge.textContent = 'v' + (DB.version || '1.0.0');
}

function canWrite() {
  try { return !tool.isReadOnly(); } catch (e) { return true; }
}

/* ── Bounded chat cache ── */
var CHAT_CACHE_MAX = 20;
var CHAT_CACHE_TEXT_MAX = 2000;
function _trimChatCache(list) {
  var out = [];
  var msgs = (list && list.messages) ? list.messages : (list || []);
  var src = (msgs && msgs.slice) ? msgs.slice(-CHAT_CACHE_MAX) : [];
  for (var i = 0; i < src.length; i++) {
    var m = src[i];
    if (!m || typeof m !== 'object') continue;
    var copy = { role: m.role, text: String(m.text || '').substring(0, CHAT_CACHE_TEXT_MAX), time: m.time };
    if (m.version) copy.version = m.version;
    if (m.isError) copy.isError = true;
    if (m.options && m.options.length) copy.options = m.options;
    if (m.slideOptions && m.slideOptions.length) copy.slideOptions = m.slideOptions;
    if (m.doctor) copy.doctor = m.doctor;
    if (m.tasks && m.tasks.length) copy.tasks = m.tasks;
    if (m.variants && m.variants.length) copy.variants = m.variants.slice(0, 4);
    if (m.review) copy.review = m.review;
    out.push(copy);
  }
  return out;
}

/* ═══════════════════════════════════════════
   SESSION CRUD (ai-chat-sessions-uniconbaseapps)
   ═══════════════════════════════════════════ */
function _warnSessionStorage(msg) {
  if (_sessionWarnShown) return;
  _sessionWarnShown = true;
  console.warn('[PRESBUILDER:SESSION] ' + msg);
  try {
    tool.notify('⚠ Chat history storage unavailable — messages are cached inside the record until it is fixed. Check allowObjectCRUD: yes and the ai-chat-sessions-uniconbaseapps type in field settings.', 'warning');
  } catch (e) {}
}

function loadSessions(callback) {
  try {
    tool.requestObjects('query', { mainObjectType: SESSION_TYPE }, function(err, result) {
      if (err) { _warnSessionStorage('Query error: ' + err); _sessions = []; }
      else {
        var all = (result && result.objects) ? result.objects : [];
        var myId = _resolveInstanceId();
        _sessions = [];
        for (var i = 0; i < all.length; i++) {
          var obj = all[i];
          var pd = obj.productData || {};
          var dcb = pd.data_categoriesBased || {};
          if (dcb._toolInstanceId === myId ||
              (myId !== 'inst_unknown' && dcb._toolInstanceId && String(dcb._toolInstanceId).indexOf(myId) === 0)) {
            _sessions.push(obj);
          } else if (!dcb._toolInstanceId && obj._parentObjectId && DB._parentRecordId && obj._parentObjectId === DB._parentRecordId) {
            _sessions.push(obj);
            tool.requestObjects('update', {
              mainObjectType: SESSION_TYPE,
              objectId: obj.id,
              productData: { data_categoriesBased: { _toolInstanceId: myId } }
            }, function() {});
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
  var user = getUserSafe() || {};
  try {
    tool.requestObjects('create', {
      mainObjectType: SESSION_TYPE,
      name: 'New Chat',
      productData: {
        data_categoriesBased: {
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: { userId: user.id || 'anon', userName: user.name || 'Anonymous' },
          _toolInstanceId: _resolveInstanceId()
        }
      }
    }, function(err, result) {
      if (err) { _warnSessionStorage('create error: ' + err); if (callback) callback(null); return; }
      var session = result.object;
      if (session._parentObjectId && !DB._parentRecordId) DB._parentRecordId = session._parentObjectId;
      _sessions.unshift(session);
      if (callback) callback(session);
    });
  } catch (e) {
    _warnSessionStorage('create threw: ' + e.message);
    if (callback) callback(null);
  }
}

function saveCurrentSession(callback) {
  if (!_activeSessionId) { if (callback) callback(null); return; }
  try {
    var session = null;
    for (var si = 0; si < _sessions.length; si++) {
      if (_sessions[si].id === _activeSessionId) { session = _sessions[si]; break; }
    }
    var oldDcb = (session && session.productData && session.productData.data_categoriesBased) ? session.productData.data_categoriesBased : {};
    var dcb = {};
    for (var k in oldDcb) {
      if (Object.prototype.hasOwnProperty.call(oldDcb, k)) dcb[k] = oldDcb[k];
    }
    dcb.messages = DB.chatMessages || [];
    dcb.updatedAt = new Date().toISOString();
    tool.requestObjects('update', {
      mainObjectType: SESSION_TYPE,
      objectId: _activeSessionId,
      productData: { data_categoriesBased: dcb }
    }, function(err) {
      if (err) _warnSessionStorage('save error: ' + err);
      if (callback) callback(err ? null : true);
    });
  } catch (e) {
    _warnSessionStorage('save threw: ' + e.message);
    if (callback) callback(null);
  }
}

function deleteSession(sessionId, callback) {
  try {
    tool.requestObjects('delete', { mainObjectType: SESSION_TYPE, objectId: sessionId }, function(err) {
      if (err) { if (callback) callback(false); return; }
      for (var i = 0; i < _sessions.length; i++) {
        if (_sessions[i].id === sessionId) { _sessions.splice(i, 1); break; }
      }
      if (callback) callback(true);
    });
  } catch (e) {
    if (callback) callback(false);
  }
}

function switchSession(sessionId) {
  if (sessionId === _activeSessionId) return;
  if (_activeSessionId) saveCurrentSession();
  _activeSessionId = sessionId;
  DB.activeSessionId = sessionId;
  var session = null;
  for (var i = 0; i < _sessions.length; i++) {
    if (_sessions[i].id === sessionId) { session = _sessions[i]; break; }
  }
  if (session) {
    var pd = session.productData || {};
    var dcb = pd.data_categoriesBased || {};
    var msgs = (dcb.messages && dcb.messages.length) ? dcb.messages : null;
    if (msgs) {
      DB.chatMessages = msgs;
    } else if (DB.chatCache && DB.chatCache.sessionId === sessionId && DB.chatCache.messages && DB.chatCache.messages.length) {
      DB.chatMessages = DB.chatCache.messages.slice();
      saveCurrentSession();
    } else {
      DB.chatMessages = [];
    }
  } else {
    DB.chatMessages = [];
    if (DB.chatCache && DB.chatCache.sessionId === sessionId && DB.chatCache.messages && DB.chatCache.messages.length) {
      DB.chatMessages = DB.chatCache.messages.slice();
    }
  }
  /* Persist AFTER loading the session's messages so saveCurrentSession()
     cannot clobber the transcript with a stale in-memory copy. */
  persist();
  renderChatMessages();
  renderSessionList();
  switchChatTab('chat');
}

function autoTitleSession() {
  if (!_activeSessionId) return;
  var session = null;
  for (var i = 0; i < _sessions.length; i++) {
    if (_sessions[i].id === _activeSessionId) { session = _sessions[i]; break; }
  }
  if (!session) return;
  var curName = session.name || '';
  if (curName && curName !== 'New Chat') return;
  var bestTitle = '';
  if (DB.pres.title && DB.pres.title.length > 1) bestTitle = DB.pres.title.substring(0, 60);
  if (!bestTitle) {
    var messages = DB.chatMessages || [];
    for (var j = 0; j < messages.length; j++) {
      if (messages[j].role === 'user' && messages[j].text) {
        var txt = messages[j].text.replace(/\n/g, ' ').trim();
        if (txt.length > 15) { bestTitle = txt.substring(0, 60); break; }
      }
    }
  }
  if (!bestTitle) return;
  if (bestTitle.length >= 60) bestTitle += '…';
  try {
    tool.requestObjects('update', { mainObjectType: SESSION_TYPE, objectId: _activeSessionId, name: bestTitle }, function() {});
  } catch (e) {}
  session.name = bestTitle;
  renderSessionList();
}

function formatTimeAgo(isoTime) {
  if (!isoTime) return '';
  var then;
  try { then = new Date(isoTime).getTime(); } catch (e) { return ''; }
  var diff = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  try { return new Date(isoTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch (e) { return ''; }
}

function renderSessionList() {
  var list = el('session-list');
  if (!list) return;
  if (!_sessions || !_sessions.length) {
    list.innerHTML = '<div class="session-empty">No chats yet.<br>Send a message to start.</div>';
    return;
  }
  var sorted = _sessions.slice().sort(function(a, b) {
    var ta = ((a.productData && a.productData.data_categoriesBased) || {}).updatedAt || a.updated || '';
    var tb = ((b.productData && b.productData.data_categoriesBased) || {}).updatedAt || b.updated || '';
    return tb > ta ? 1 : (tb < ta ? -1 : 0);
  });
  var h = '';
  for (var i = 0; i < sorted.length; i++) {
    var s = sorted[i];
    var name = s.name || 'New Chat';
    var timeAgo = formatTimeAgo(((s.productData && s.productData.data_categoriesBased) || {}).updatedAt || s.updated || '');
    var isActive = s.id === _activeSessionId;
    h += '<div class="session-item' + (isActive ? ' session-active' : '') + '" data-sid="' + esc(s.id) + '">' +
      '<span class="session-dot">' + (isActive ? '●' : '○') + '</span>' +
      '<div class="session-info"><div class="session-name" data-sid="' + esc(s.id) + '" title="Double-click to rename">' + esc(name) + '</div>' +
      '<div class="session-time">' + timeAgo + '</div></div>' +
      '<button class="session-rename" data-sid="' + esc(s.id) + '" title="Rename chat">✎</button>' +
      '<button class="session-delete" data-sid="' + esc(s.id) + '" title="Delete chat">✕</button></div>';
  }
  list.innerHTML = h;
  var items = list.querySelectorAll('.session-item');
  for (var j = 0; j < items.length; j++) {
    items[j].onclick = function() { switchSession(this.getAttribute('data-sid')); };
    var delBtn = items[j].querySelector('.session-delete');
    if (delBtn) {
      delBtn.onclick = function(e) {
        e.stopPropagation();
        var sid = this.getAttribute('data-sid');
        if (sid) {
          deleteSession(sid, function(ok) {
            if (ok) {
              if (_activeSessionId === sid) {
                _activeSessionId = '';
                DB.activeSessionId = '';
                DB.chatMessages = [];
                persist();
                renderChatMessages();
              }
              renderSessionList();
            }
          });
        }
      };
    }
    var renameBtn = items[j].querySelector('.session-rename');
    if (renameBtn) {
      renameBtn.onclick = function(e) {
        e.stopPropagation();
        startRenameSession(this.getAttribute('data-sid'));
      };
    }
    var nameEl = items[j].querySelector('.session-name');
    if (nameEl) {
      nameEl.ondblclick = function(e) {
        e.stopPropagation();
        startRenameSession(this.getAttribute('data-sid'));
      };
    }
  }
}

function startRenameSession(sessionId) {
  var list = el('session-list');
  if (!list) return;
  var nameEl = list.querySelector('.session-name[data-sid="' + sessionId + '"]');
  if (!nameEl) return;
  var session = null;
  for (var i = 0; i < _sessions.length; i++) {
    if (_sessions[i].id === sessionId) { session = _sessions[i]; break; }
  }
  if (!session) return;
  var currentName = session.name || 'New Chat';
  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'session-name-input';
  input.value = currentName;
  nameEl.parentNode.replaceChild(input, nameEl);
  input.focus();
  input.select();
  var saveRename = function() {
    var newName = input.value.trim();
    if (!newName) newName = 'New Chat';
    if (newName.length > 80) newName = newName.substring(0, 80);
    try {
      tool.requestObjects('update', { mainObjectType: SESSION_TYPE, objectId: sessionId, name: newName }, function() {
        for (var i = 0; i < _sessions.length; i++) {
          if (_sessions[i].id === sessionId) { _sessions[i].name = newName; break; }
        }
        renderSessionList();
      });
    } catch (e) {}
  };
  input.onblur = saveRename;
  input.onkeydown = function(e) {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = currentName; input.blur(); }
  };
}

/* ═══════════════════════════════════════════
   USER (safe getters — identity may arrive late)
   ═══════════════════════════════════════════ */
var _user = null;
function getUserSafe() {
  try {
    var u = tool.getUser();
    if (u) { _user = u; return u; }
    return _user;
  } catch (e) { return _user; }
}
function refreshUser() {
  var delays = [400, 1200, 2600, 5000];
  var i = 0;
  (function poll() {
    var u = getUserSafe();
    if (u && u.roles && u.roles.length) return;
    if (i < delays.length) {
      setTimeout(function() { i++; poll(); }, delays[i] || 5000);
    }
  })();
}

/* ═══════════════════════════════════════════
   CHAT MESSAGES UI
   ═══════════════════════════════════════════ */
function shortTime(iso) {
  try {
    var d = new Date(iso);
    var h = d.getHours(), m = d.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  } catch (e) { return ''; }
}

function markdownLite(text) {
  var t = esc(text || '');
  t = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/^\s*[-*] (.+)$/gm, '• $1');
  t = t.replace(/\n/g, '<br>');
  return t;
}

function addChatMessage(role, text, extra) {
  var user = getUserSafe() || {};
  var msg = {
    role: role,
    text: text || '',
    time: new Date().toISOString(),
    userId: role === 'user' ? (user.id || 'anon') : 'ai',
    userName: role === 'user' ? (user.name || 'Anonymous') : 'AI Assistant'
  };
  if (extra && extra.options && extra.options.length) msg.options = extra.options;
  if (extra && extra.slideOptions && extra.slideOptions.length) msg.slideOptions = extra.slideOptions;
  if (extra && extra.version) msg.version = extra.version;
  if (extra && extra.isError) msg.isError = true;
  if (extra && extra.doctor) {
    msg.doctor = { total: extra.doctor.total, failed: extra.doctor.failed, warned: extra.doctor.warned, passed: extra.doctor.passed };
  }
  if (extra && extra.tasks && extra.tasks.length) msg.tasks = extra.tasks;
  if (extra && extra.variants && extra.variants.length) msg.variants = extra.variants.slice(0, 4);
  if (extra && extra.review) msg.review = extra.review;
  stampAiActor(msg);
  DB.chatMessages.push(msg);
  if (DB.chatMessages.length > 500) DB.chatMessages = DB.chatMessages.slice(-500);
  DB.chatCache = { sessionId: _activeSessionId, messages: _trimChatCache(DB.chatMessages) };
  renderChatMessages();
  updateChatBadge();
  if (_activeSessionId) {
    saveCurrentSession();
    renderSessionList();
    if (role === 'user') {
      var userMsgCount = 0;
      for (var mi = 0; mi < DB.chatMessages.length; mi++) {
        if (DB.chatMessages[mi].role === 'user') userMsgCount++;
      }
      if (userMsgCount === 1 || userMsgCount % 3 === 0) autoTitleSession();
    } else if (!(extra && extra.isError)) {
      autoTitleSession();
    }
    _stageValue();
  } else {
    try { persist(); } catch (e) {}
  }
}

var WELCOME_HTML =
  '<div class="chat-welcome">' +
    '<div class="chat-welcome-icon">🎞️</div>' +
    '<h3>Describe your presentation</h3>' +
    '<p>Tell me what you want to present — <b>a quarterly report, a product pitch, a training deck, a lecture…</b> — and I\'ll build the slides for you, one idea per slide.</p>' +
    '<div class="welcome-hints">' +
      '<button class="hint-chip" data-hint="Create a 10-slide pitch deck for a mobile app called BloomNotes — problem, solution, features, market, business model, team and next steps.">📱 Product pitch</button>' +
      '<button class="hint-chip" data-hint="Build a quarterly business review presentation: KPI overview, revenue chart, key wins, challenges, roadmap and Q&amp;A.">📊 Business review</button>' +
      '<button class="hint-chip" data-hint="Make a training presentation about workplace safety: 5 key rules, common hazards, emergency procedures and a short quiz.">🦺 Training deck</button>' +
    '</div>' +
    '<div class="template-gallery" id="template-gallery"></div>' +
    '<div id="brand-preset-slot"></div>' +
    '<p style="font-size:10px;color:var(--text3);margin-top:12px">💡 <b>Tip:</b> You can also say <b>"add a slide about X"</b> or <b>"replace slide 3 with a chart"</b> — I\'ll only change what you asked. Click 🎯 on a slide to edit just that one. Try <b>/notes</b>, <b>/restyle dark</b>, <b>/translate tr</b>, <b>/review</b>.</p>' +
  '</div>';

function renderChatMessages() {
  var box = el('chat-messages');
  if (!box) return;
  if (!DB.chatMessages || !DB.chatMessages.length) {
    box.innerHTML = WELCOME_HTML;
    var hints = box.querySelectorAll('.hint-chip');
    for (var h = 0; h < hints.length; h++) {
      hints[h].addEventListener('click', function() {
        var inp = el('chat-input');
        if (!inp) return;
        inp.value = this.getAttribute('data-hint');
        inp.style.height = 'auto';
        sendChatMessage();
      });
    }
    renderTemplateGallery();
    renderBrandChip();
    return;
  }
  var out = '';
  for (var i = 0; i < DB.chatMessages.length; i++) {
    var m = DB.chatMessages[i];
    var time = shortTime(m.time);
    if (m.role === 'user') {
      out += '<div class="chat-msg user"><div class="chat-avatar">👤</div><div><div class="chat-bubble">' + markdownLite(m.text) + '</div>' +
        '<div class="chat-msg-time">' + time + '</div></div></div>';
    } else if (m.role === 'plan') {
      out += '<div class="chat-msg ai"><div class="chat-avatar">🧭</div><div><div class="plan-bubble"><div class="plan-head">📋 Building the deck step by step</div>';
      var tasks = m.tasks || [];
      for (var pi = 0; pi < tasks.length; pi++) {
        var st = tasks[pi].status || 'todo';
        out += '<div class="plan-task st-' + st + '" data-pi="' + pi + '"><span class="plan-check">' + (st === 'done' ? '✅' : (st === 'error' ? '⚠️' : (st === 'doing' ? '⏳' : '○'))) + '</span><span>' + esc(tasks[pi].title || ('Slide ' + (pi + 1))) + '</span></div>';
      }
      out += '</div><div class="chat-msg-time">' + time + '</div></div></div>';
    } else {
      out += '<div class="chat-msg ai' + (m.isError ? ' err' : '') + '"><div class="chat-avatar">🎞️</div><div>' +
        '<div class="chat-bubble">' + markdownLite(m.text) + '</div>';
      if (m.version) out += '<div><span class="chat-version-chip">✓ deck v' + esc(m.version) + '</span></div>';
      if (m.doctor) {
        var dcls = m.doctor.failed > 0 ? 'fail' : (m.doctor.warned > 0 ? 'warn' : '');
        out += '<div><span class="chat-doctor-chip ' + dcls + '" onclick="openDoctor()">🧪 ' + m.doctor.passed + '/' + m.doctor.total + ' checks pass</span></div>';
      }
      if (m.review) out += reviewHtml(m.review);
      if (m.variants && m.variants.length) out += variantsHtml(m.variants, i);
      if (m.options && m.options.length) out += optionsHtml(m.options);
      if (m.slideOptions && m.slideOptions.length) out += slideOptionsHtml(m.slideOptions);
      out += '<div class="chat-msg-time">' + time + '</div></div></div>';
    }
  }
  box.innerHTML = out;
  scrollChatToBottom();
}

function optionsHtml(options) {
  var h = '<div class="chat-options"><div class="chat-options-header">💡 Deck next steps — click to send:</div>';
  for (var j = 0; j < options.length; j++) {
    h += '<button class="chat-option-btn" data-opt-text="' + esc(options[j].text) + '" onclick="handleOptionClick(this)">' +
      '<span class="opt-num">' + (j + 1) + '</span>' + esc(options[j].text) + '</button>';
  }
  return h + '</div>';
}

function slideOptionsHtml(options) {
  var h = '<div class="chat-options"><div class="chat-options-header">💠 Slide next steps — click to send:</div>';
  for (var j = 0; j < options.length; j++) {
    var opt = options[j];
    var idx = opt.slideId ? slideIndexById(opt.slideId) : -1;
    var label = (idx !== -1 ? 'Slide ' + (idx + 1) : 'Slide') + ' · ' + (opt.text || '');
    h += '<button class="chat-option-btn chat-slide-btn" data-opt-text="' + esc(opt.text || '') + '" data-slide-id="' + esc(opt.slideId || '') + '" onclick="handleOptionClick(this)">' +
      '<span class="opt-num">💠</span>' + esc(label) + '</button>';
  }
  return h + '</div>';
}

/* ── A7 review card ── */
function reviewHtml(review) {
  var h = '<div class="chat-review"><div class="chat-review-head">🧐 Deck review' + (review && review.score !== undefined ? ' — score ' + esc(review.score) + '/10' : '') + '</div>';
  var findings = (review && review.findings) || [];
  if (!findings.length) {
    h += '<div class="chat-review-item" style="color:#065f46">✅ The deck looks great — no major findings.</div>';
  }
  for (var i = 0; i < findings.length; i++) {
    var f = findings[i];
    var idx = f.slideId ? slideIndexById(f.slideId) : -1;
    h += '<div class="chat-review-item"><b>' + (idx !== -1 ? 'Slide ' + (idx + 1) : 'Deck') + ':</b> ' + esc(f.issue || '') +
      '<div class="chat-review-sug">💡 ' + esc(f.suggestion || '') + '</div>' +
      '<button class="chat-review-fix" data-fix-sid="' + esc(f.slideId || '') + '" data-fix-issue="' + esc(f.issue || '') + '" data-fix-sug="' + esc(f.suggestion || '') + '" onclick="handleReviewFix(this)">🛠 Fix</button></div>';
  }
  return h + '</div>';
}

/* ── A3 variant cards ── */
function variantsHtml(variants, msgIdx) {
  var h = '<div class="chat-variants"><div class="chat-variants-head">🎨 Design variants — pick one:</div><div class="chat-variants-grid">';
  for (var i = 0; i < variants.length; i++) {
    var v = variants[i];
    var types = (v.slide && v.slide.components) ? v.slide.components.map(function(c) { return c.type; }) : [];
    h += '<div class="variant-card"><div class="variant-label">' + esc(v.label || ('Variant ' + (i + 1))) + '</div>' +
      '<div class="variant-types">' + esc(types.slice(0, 4).join(' · ') || 'custom') + '</div>' +
      '<button class="btn btn-sm btn-primary" data-vmsg="' + msgIdx + '" data-vidx="' + i + '" onclick="applyVariant(this)">Use this</button></div>';
  }
  return h + '</div></div>';
}

function handleOptionClick(btn) {
  var text = btn.getAttribute('data-opt-text');
  var slideId = btn.getAttribute('data-slide-id');
  if (!text) return;
  if (slideId) {
    var idx = slideIndexById(slideId);
    var slide = idx !== -1 ? DB.pres.slides[idx] : null;
    text = 'Update slide ' + (idx !== -1 ? (idx + 1) : '?') + (slide ? ' "' + slide.title + '"' : '') + ' (id: ' + slideId + '): ' + text;
  }
  var parent = btn.parentNode;
  if (parent) {
    var allBtns = parent.querySelectorAll('.chat-option-btn');
    for (var i = 0; i < allBtns.length; i++) { allBtns[i].disabled = true; }
  }
  var inp = el('chat-input');
  if (inp) {
    inp.value = text;
    inp.style.height = 'auto';
  }
  sendChatMessage();
}

function scrollChatToBottom() {
  var box = el('chat-messages');
  if (box) box.scrollTop = box.scrollHeight;
}

function updateChatBadge() {
  var badge = el('chat-msg-count');
  if (badge) badge.textContent = (DB.chatMessages || []).length;
}

function switchChatTab(tabName) {
  var tabs = document.querySelectorAll('.chat-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].getAttribute('data-chat-tab') === tabName);
  }
  var panels = document.querySelectorAll('.chat-tab-panel');
  for (var j = 0; j < panels.length; j++) {
    panels[j].classList.toggle('active', panels[j].getAttribute('data-chat-panel') === tabName);
  }
}

/* ── Thinking bubble ── */
function showThinkingBubble(label, hasStreaming) {
  hideThinkingBubble();
  var container = el('chat-messages');
  if (!container) return;
  _thinkingStartTime = Date.now();
  _lastTokenAt = 0;
  var bubble = document.createElement('div');
  bubble.className = 'chat-msg ai';
  bubble.id = 'thinking-bubble';
  bubble.innerHTML =
    '<div class="chat-avatar">🎞️</div>' +
    '<div class="think-bubble">' +
      '<div class="think-header" id="think-hdr" style="cursor:pointer">' +
        '<span class="think-icon">⏳</span>' +
        '<span class="chat-thinking-dots"><span></span><span></span><span></span></span>' +
        '<span class="think-label" id="think-label">' + esc(label || 'AI is designing…') + '</span>' +
        '<span class="think-time" id="think-time">0:00</span>' +
        '<span class="think-toggle" id="think-toggle">▶</span>' +
        '<button class="think-cancel" id="think-cancel" title="Stop generation" style="display:none">⏹ Stop</button>' +
      '</div>' +
      '<div class="think-body" id="think-body" style="display:none">' +
        (hasStreaming ? '<div class="think-stream-label">Streaming…</div><div class="think-stream" id="think-stream"></div>' : '<div class="think-stream-label">Waiting for AI response…</div><div class="think-stream" id="think-stream" style="display:none"></div>') +
      '</div>' +
    '</div>';
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  _thinkingMsgEl = bubble;

  var hdr = bubble.querySelector('#think-hdr');
  var bodyEl = bubble.querySelector('#think-body');
  var toggleEl = bubble.querySelector('#think-toggle');
  hdr.onclick = function() {
    var isOpen = bodyEl.style.display !== 'none';
    bodyEl.style.display = isOpen ? 'none' : 'block';
    toggleEl.textContent = isOpen ? '▶' : '▼';
    container.scrollTop = container.scrollHeight;
  };

  if (hasStreaming) {
    var firstToken = true;
    _streamCallback = function(token) {
      if (firstToken) {
        bodyEl.style.display = 'block';
        toggleEl.textContent = '▼';
        var sl = bubble.querySelector('.think-stream-label');
        if (sl) sl.style.display = 'none';
        firstToken = false;
      }
      appendStreamToken(token);
    };
  } else {
    _streamCallback = null;
  }

  var cancelBtn = bubble.querySelector('#think-cancel');
  if (cancelBtn) {
    setTimeout(function() {
      if (_thinkingMsgEl === bubble && cancelBtn) cancelBtn.style.display = '';
    }, 5000);
    cancelBtn.onclick = function(e) {
      e.stopPropagation();
      cancelAiRequest();
    };
  }

  var dots = 0;
  _thinkingTimer = setInterval(function() {
    dots = (dots + 1) % 4;
    var lbl = bubble.querySelector('#think-label');
    var elapsed = Math.floor((Date.now() - _thinkingStartTime) / 1000);
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    var timeStr = mins + ':' + (secs < 10 ? '0' : '') + secs;
    if (lbl) {
      if (_lastTokenAt > _thinkingStartTime) {
        var idleSec = Math.floor((Date.now() - _lastTokenAt) / 1000);
        lbl.textContent = idleSec < 2 ? 'AI is generating…' + Array(dots + 1).join('.') : 'AI is generating… (last token ' + idleSec + 's ago)';
      } else if (elapsed > 60) {
        lbl.textContent = 'Waiting for the first token… ' + timeStr + ' (large prompts take longer)';
      } else if (elapsed > 20) {
        lbl.textContent = 'Waiting for the first token… ' + timeStr;
      } else {
        lbl.textContent = (label || 'AI is designing…') + Array(dots + 1).join('.');
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
    var label = _thinkingMsgEl.querySelector('.think-stream-label');
    if (label && stream.textContent === '') label.style.display = 'none';
    var t = stream.textContent + token;
    if (t.length > 6000) t = t.slice(-6000);
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
    el2.style.opacity = '0';
    el2.style.transition = 'opacity 0.2s';
    setTimeout(function() { if (el2.parentNode) el2.parentNode.removeChild(el2); }, 200);
    _thinkingMsgEl = null;
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
  if (label) label.textContent = '✓ Complete in ' + (elapsedMs / 1000).toFixed(1) + 's';
  if (dots) dots.style.display = 'none';
  if (icon) icon.textContent = '✅';
  if (cancel) cancel.style.display = 'none';
  var secs = Math.floor(elapsedMs / 1000);
  var mins = Math.floor(secs / 60);
  var timeEl = bubble.querySelector('#think-time');
  if (timeEl) timeEl.textContent = mins + ':' + (secs % 60 < 10 ? '0' : '') + (secs % 60);
  setTimeout(function() {
    if (bubble && bubble.parentNode) {
      bubble.style.opacity = '0';
      bubble.style.transition = 'opacity 0.5s';
      setTimeout(function() { if (bubble.parentNode) bubble.parentNode.removeChild(bubble); }, 500);
    }
  }, 4000);
}

/* ── AI connection UI + watchdog ── */
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
  _aiTimeoutId = setTimeout(function() {
    console.warn('[PRESBUILDER:TIMEOUT] AI request timed out after 600 seconds (prompt ' + promptLen + ' chars)');
    _aiCallActive = false;
    _markThinkingComplete(600000);
    _setAiUIActive(false);
    addChatMessage('ai', '⏰ **AI request timed out after 600 seconds.**\n\nThe AI gateway may be overloaded or the prompt too large. Try sending a shorter request, or ask for changes slide by slide.', { isError: true });
    updateConnStatus('error');
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
  addChatMessage('ai', '⏹ **Generation stopped.** You can send another message to continue.');
  tool.resize();
}

/* ═══════════════════════════════════════════
   AI PROMPT + RESPONSE PARSING
   ═══════════════════════════════════════════ */
function deckStateBlock() {
  var slides = DB.pres.slides || [];
  var lines = [];
  lines.push('Title: ' + (DB.pres.title || '(untitled)'));
  if (DB.pres.subtitle) lines.push('Subtitle: ' + DB.pres.subtitle);
  if (DB.pres.author) lines.push('Author/presenter: ' + DB.pres.author);
  lines.push('Custom deckCss present: ' + (DB.pres.deckCss ? 'yes' : 'no'));
  lines.push('Custom deckJs present: ' + (DB.pres.deckJs ? 'yes' : 'no'));
  lines.push('Theme: ' + (DB.pres.theme || 'clean'));
  lines.push('Language: ' + (DB.pres.lang || _p('lang', 'en')));
  var dsKeys = Object.keys(DB.pres.datasets || {});
  lines.push('Datasets: ' + (dsKeys.length ? dsKeys.join(', ') : 'none'));
  lines.push('');
  if (!slides.length) {
    lines.push('NO SLIDES YET — build the whole deck from scratch.');
  } else {
    lines.push(slides.length + ' slide(s):');
    for (var i = 0; i < slides.length; i++) {
      var types = [];
      for (var j = 0; j < slides[i].components.length; j++) types.push(slides[i].components[j].type);
      var flags = [];
      if (slides[i].locked) flags.push('LOCKED');
      if (slides[i].id === _targetSlideId) flags.push('TARGETED');
      lines.push((i + 1) + '. [' + slides[i].id + '] "' + slides[i].title + '" (components: ' + (types.join(', ') || 'none') + ')' + (flags.length ? ' 🔒 ' + flags.join(' ') : ''));
    }
  }
  return lines.join('\n');
}

function buildChatPrompt(userMsg) {
  var hasSlides = DB.pres.slides.length > 0;
  var parts = [];
  parts.push('You are an expert presentation designer inside the UniconHub Presentation Builder — a chat-driven slide deck studio. You compose ONE presentation deck by chatting with the user.');
  parts.push('');
  parts.push('=== CURRENT DECK ===');
  parts.push(deckStateBlock());
  parts.push('');
  parts.push('=== USER REQUEST ===');
  parts.push(userMsg);
  parts.push('');
  if (_targetSlideId && slideIndexById(_targetSlideId) !== -1) {
    parts.push('=== TARGETED EDIT ===');
    parts.push('The user TARGETED slide id "' + _targetSlideId + '". Apply the request ONLY to that slide — return a single upsertSlide patch that keeps its existing id. Do NOT touch any other slide.');
    parts.push('');
  }
  var bp = _validHex(_p('brandPrimary', ''));
  var bs = _validHex(_p('brandSecondary', ''));
  var bf = _p('brandFont', '').replace(/[^a-zA-Z0-9 \-',]/g, '').trim();
  if (bp || bs || bf) {
    parts.push('=== BRAND KIT (admin-configured — honor it) ===');
    if (bp) parts.push('Primary/accent color: ' + bp + ' — use it for accents, color: fields, chart colors, borders and the cover.');
    if (bs) parts.push('Secondary color: ' + bs);
    if (bf) parts.push('Font: ' + bf);
    parts.push('');
  }
  parts.push('HOW TO RESPOND:');
  parts.push('• JSON ONLY for deck changes: the tool merges your JSON with the component library and renders all HTML/CSS itself — never output raw HTML/CSS/JS for slides unless the user explicitly asked for a custom "html" component. JSON-only responses are much faster and cheaper.');
  parts.push('• If the request changes the deck (create it, add/change/delete slides, restyle, add a chart…), reply with ONE JSON object per the OUTPUT CONTRACT below. No markdown fences.');
  parts.push('• For a from-scratch build, return the FULL deck JSON. For edits to an existing deck, prefer the compact PATCHES format so untouched slides are preserved exactly.');
  parts.push('• If the request is just a question, idea or clarification, reply in prose and end with 3-5 clickable next-step lines using the [[suggest_xxx]] format.');
  parts.push('• Never invent component types — use ONLY the library below, or the "html" component for anything custom.');
  parts.push('');
  parts.push('=== COMPONENT LIBRARY (data shapes) ===');
  parts.push(libraryCatalog());
  parts.push('');
  parts.push('=== OUTPUT CONTRACT ===');
  parts.push('FULL DECK (from-scratch or full redesign):');
  parts.push('{"title":"Deck title","subtitle":"optional subtitle","author":"optional presenter","deckCss":"optional extra CSS (overrides base theme)","deckJs":"optional custom JS (runs after the deck runtime, window.pres available)","slides":[{"id":"intro","title":"Slide label","notes":"optional speaker notes","components":[{"type":"title-slide","data":{"title":"…","subtitle":"…"}},{"type":"stat-cards","data":{"items":[{"value":120,"label":"Users"}]}}]}],"summary":"short plain-language summary","suggestions":["[[suggest_x]] add a chart slide"],"slideSuggestions":[{"slideId":"intro","text":"add a big-number stat"}]}');
  parts.push('');
  parts.push('PATCHES (preferred for edits to an existing deck — list ONLY the slides that change):');
  parts.push('{"patches":[{"op":"upsertSlide","slide":{"id":"intro","title":"…","components":[…]}},{"op":"deleteSlide","id":"old-slide"},{"op":"moveSlide","id":"x","to":0},{"op":"notes","id":"intro","notes":"…"},{"op":"meta","title":"New title","theme":"dark"},{"op":"deckCss","css":"…"},{"op":"deckJs","js":"…"}],"summary":"what changed","suggestions":["[[suggest_x]] …"],"slideSuggestions":[{"slideId":"intro","text":"…"}]}');
  parts.push('upsertSlide matches by "id" first, then by exact "title" — otherwise it appends. Keep the SAME id when editing an existing slide. Give NEW slides short unique kebab-case ids. The "notes" op writes speaker notes onto an existing slide without touching its content.');
  parts.push('');
  parts.push('DESIGN VARIANTS (A/B/C): if the user asks for design options for a slide, return {"variants":[{"label":"A","slide":{...}},{"label":"B","slide":{...}},{"label":"C","slide":{...}}],"slideId":"<id>"} — do NOT modify the deck, the user picks one.');
  parts.push('DECK REVIEW: if the user asks to review/critique the deck, return {"review":{"findings":[{"slideId":"<id or empty>","issue":"...","suggestion":"..."}],"score":<0-10>,"summary":"..."}} — do NOT modify the deck.');
  parts.push('');
  parts.push('=== DATASETS (live charts) ===');
  parts.push('The deck stores reusable numbers under "datasets" (full deck JSON) as {"<name>":{"labels":[...],"values":[...]}} or {"<name>":{"labels":[...],"series":[{"name":"...","values":[...]}]}}. When numbers may change later, put them in a dataset and have the chart component reference it with "dataset":"<name>" (bar-chart, column-chart, line-chart, area-chart, radar, pie-chart support it).');
  parts.push('');
  parts.push('ALWAYS include BOTH "suggestions" (deck-level next steps) and "slideSuggestions" (per-slide next steps — each one is {"slideId":"existing slide id","text":"short action"}) so the user can keep developing the presentation by clicking the suggestions.');
  parts.push('');
  parts.push('=== THEMES ===');
  parts.push('Available deck themes: clean (default), dark, corporate, playful, minimal, editorial, warm.');
  parts.push('To restyle the WHOLE deck (e.g. user says "make it dark" or "corporate look"), just set {"op":"meta","theme":"<name>"} (or "theme" in a full deck) — do NOT rewrite the slides for a theme change.');
  parts.push('Whole-deck TRANSITION: {"op":"meta","transition":"slide|zoom|flip"} (empty = crossfade). Per-slide timing: {"op":"timing","id":"<id>","duration":<seconds>}.');
  parts.push('');
  parts.push('=== LOCKED SLIDES ===');
  parts.push('Slides marked 🔒 LOCKED in the deck state must NEVER be modified: skip them in upsertSlide/deleteSlide patches, do not rewrite their components, and do not include them in a full-deck rebuild (the tool restores them automatically). "notes" patches on locked slides ARE allowed.');
  parts.push('');
  parts.push('=== DESIGN RULES ===');
  parts.push('• 16:9 slides. One clear idea per slide. ~6-12 slides unless the user asks otherwise.');
  parts.push('• Deck arc: title-slide → agenda → content slides → summary → closing-slide.');
  parts.push('• VISUAL VARIETY: mix components — never 5 bullet slides in a row. Use charts for numbers (bar-chart, line-chart, pie-chart), cards/grids for comparisons, process-flow/steps for procedures, timeline for history.');
  parts.push('• Content must FIT inside the slide — keep text short (max ~5 bullets, ~10 words each).');
  parts.push('• MARGINS: the engine automatically pads every slide\'s content with safe margins — keep all text and elements inside the content area and NEVER let anything touch the slide edge. Cover components (title-slide, section-slide, closing-slide) fill the full slide by design.');
  parts.push('• Real content, no lorem ipsum. Language: ' + _p('lang', 'en') + '.');
  parts.push('• Every slide component is {"type": "...", "data": {...}} — data keys per the library. Container components (columns, tabs) take "items" as nested component descriptors.');
  parts.push('• Use the "html" component (html/css/js) for anything the library cannot express.');
  parts.push('• Cover slides (title-slide, section-slide, closing-slide) accept backgroundStyle: mesh | shine | dots | lines — generated from the brand colors. Images with no URL get branded offline placeholders automatically.');
  parts.push('• Each slide gets a short "notes" for the presenter. ALWAYS end every code response with a "summary", 3-5 deck-level "suggestions" ([[suggest_xxx]] format) AND 2-4 "slideSuggestions" ([{"slideId":"...","text":"..."}]) that target specific existing slides.');
  return parts.join('\n');
}

function tryParseJson(s) {
  try { return JSON.parse(s); } catch (e1) {}
  var cleaned = String(s)
    .replace(/^\s*\/\/[^\n]*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1');
  try { return JSON.parse(cleaned); } catch (e2) { return null; }
}

function parseAIResponse(raw) {
  var text = String(raw || '');
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  var suggestions = parseSuggestions(text);
  var s = text.indexOf('{');
  var e = text.lastIndexOf('}');
  var json = null;
  if (s !== -1 && e > s) json = tryParseJson(text.substring(s, e + 1));
  var slideSuggestions = [];
  if (json && Array.isArray(json.slideSuggestions)) {
    for (var i = 0; i < json.slideSuggestions.length; i++) {
      var it = json.slideSuggestions[i];
      if (!it) continue;
      var txt = typeof it === 'string' ? it : String((it.text || it.label || ''));
      var sid = (it && typeof it === 'object' && (it.slideId || it.id)) ? String(it.slideId || it.id) : '';
      if (!txt) continue;
      slideSuggestions.push({ id: 'ss' + i, text: txt, slideId: sid });
      if (slideSuggestions.length >= 6) break;
    }
  }
  return { json: json, text: text, suggestions: suggestions, slideSuggestions: slideSuggestions };
}

function parseSuggestions(text) {
  var out = [];
  var seen = {};
  var lines = String(text || '').split(/\r?\n/);
  var re = /\[\[([a-zA-Z0-9_\-]+)\]\](.*)$/;
  for (var i = 0; i < lines.length; i++) {
    var m = re.exec(lines[i]);
    if (!m) continue;
    var id = m[1];
    var label = m[2].trim() || id;
    if (seen[id]) continue;
    seen[id] = true;
    out.push({ id: id, text: label });
    if (out.length >= 6) break;
  }
  return out;
}

function findSlideIndexByIdOrTitle(idOrTitle) {
  if (!idOrTitle) return -1;
  var slides = DB.pres.slides;
  for (var i = 0; i < slides.length; i++) {
    if (slides[i].id === String(idOrTitle)) return i;
  }
  for (var j = 0; j < slides.length; j++) {
    if (slides[j].title.trim().toLowerCase() === String(idOrTitle).trim().toLowerCase()) return j;
  }
  return -1;
}

function applyPatchOp(p) {
  if (!p || !p.op) return false;
  var op = String(p.op);
  var slides = DB.pres.slides;
  if (op === 'upsertSlide') {
    if (!p.slide) return false;
    var idx = -1;
    if (p.slide.id) idx = findSlideIndexByIdOrTitle(p.slide.id);
    if (idx === -1 && p.slide.title) idx = findSlideIndexByIdOrTitle(p.slide.title);
    if (idx !== -1 && slides[idx].locked) return false; // LOCKED slides are off-limits to AI
    if (idx === -1) {
      if (p.position === 'start') {
        slides.unshift(normalizeSlide(p.slide, 0));
        reindexSlideTitles();
      } else if (p.position === 'after' && p.afterId) {
        var ai = findSlideIndexByIdOrTitle(p.afterId);
        if (ai !== -1) slides.splice(ai + 1, 0, normalizeSlide(p.slide, ai + 1));
        else slides.push(normalizeSlide(p.slide, slides.length));
      } else {
        slides.push(normalizeSlide(p.slide, slides.length));
      }
    } else {
      var existing = slides[idx];
      var fixed = normalizeSlide(p.slide, idx);
      fixed.id = existing.id;  // keep the existing identity
      if (p.slide.title) fixed.title = p.slide.title.substring(0, 120);
      if (p.slide.notes !== undefined) fixed.notes = String(p.slide.notes || '');
      fixed.locked = existing.locked; // never drop the lock flag
      slides[idx] = fixed;
    }
    return true;
  }
  if (op === 'deleteSlide') {
    var di = p.id ? findSlideIndexByIdOrTitle(p.id) : (typeof p.index === 'number' ? p.index : -1);
    if (di >= 0 && di < slides.length) {
      if (slides[di].locked) return false; // LOCKED slides are off-limits to AI
      slides.splice(di, 1);
      return true;
    }
    return false;
  }
  if (op === 'notes') {
    var ni = p.id ? findSlideIndexByIdOrTitle(p.id) : -1;
    if (ni === -1) return false;
    slides[ni].notes = String(p.notes || '').substring(0, 4000);
    return true;
  }
  if (op === 'timing') {
    var ti = p.id ? findSlideIndexByIdOrTitle(p.id) : -1;
    if (ti === -1) return false;
    var secs = parseInt(p.duration, 10);
    slides[ti].duration = (isNaN(secs) || secs < 0) ? 0 : Math.min(secs, 3600);
    return true;
  }
  if (op === 'moveSlide') {
    var mi = p.id ? findSlideIndexByIdOrTitle(p.id) : -1;
    if (mi === -1 || slides.length < 2) return false;
    var to = parseInt(p.to, 10);
    if (isNaN(to) || to < 0) to = 0;
    if (to > slides.length - 1) to = slides.length - 1;
    if (mi === to) return false;
    var moved = slides.splice(mi, 1)[0];
    slides.splice(to, 0, moved);
    return true;
  }
  if (op === 'meta') {
    var changed = false;
    if (p.title !== undefined) { DB.pres.title = String(p.title).substring(0, 140); changed = true; }
    if (p.subtitle !== undefined) { DB.pres.subtitle = String(p.subtitle).substring(0, 240); changed = true; }
    if (p.author !== undefined) { DB.pres.author = String(p.author).substring(0, 120); changed = true; }
    if (p.theme !== undefined) {
      var t = String(p.theme || '').toLowerCase();
      DB.pres.theme = THEMES[t] ? t : 'clean';
      changed = true;
    }
    if (p.transition !== undefined) {
      DB.pres.transition = ['slide', 'zoom', 'flip'].indexOf(String(p.transition || '')) !== -1 ? String(p.transition) : '';
      changed = true;
    }
    if (p.animLevel !== undefined) {
      DB.pres.animLevel = String(p.animLevel) === 'none' ? 'none' : 'subtle';
      changed = true;
    }
    return changed;
  }
  if (op === 'deckCss') {
    DB.pres.deckCss = String(p.css || '');
    return true;
  }
  if (op === 'deckJs') {
    DB.pres.deckJs = String(p.js || '');
    return true;
  }
  return false;
}

function reindexSlideTitles() {
  /* No-op helper — slide titles are explicit, not positional. */
}

function fixActiveSlide() {
  var slides = DB.pres.slides;
  if (!slides.length) {
    DB.activeSlideId = '';
    _activeSlideIndex = 0;
    return;
  }
  var found = -1;
  for (var i = 0; i < slides.length; i++) {
    if (slides[i].id === DB.activeSlideId) { found = i; break; }
  }
  if (found === -1) {
    found = Math.min(_activeSlideIndex, slides.length - 1);
    DB.activeSlideId = slides[found].id;
  }
  _activeSlideIndex = found;
}

/* ═══════════════════════════════════════════
   APPLY AI RESPONSE
   ═══════════════════════════════════════════ */
function applyAIResponse(raw) {
  _aiCallActive = false;
  _reqToken = null;
  clearAiTimeout();
  _setAiUIActive(false);
  updateConnStatus('ok');
  var parsed = parseAIResponse(raw);
  var json = parsed.json;
  var changed = false;
  var summary = '';
  var extra = {};
  var beforePres = JSON.parse(JSON.stringify(DB.pres));
  var beforeActive = DB.activeSlideId;

  if (json) {
    if (Array.isArray(json.variants) && json.variants.length) {
      /* A3 — design variants are presented as cards, not applied */
      extra.variants = json.variants.slice(0, 4);
      summary = json.summary ? String(json.summary) : ('🎨 ' + extra.variants.length + ' design variant(s) ready — pick one.');
      json.patches = null; json.slides = null; json.title = json.subtitle = json.author = json.deckCss = json.deckJs = json.theme = undefined;
    } else if (json.review) {
      /* A7 — deck review rendered with per-finding fix buttons */
      extra.review = json.review;
      summary = json.summary ? String(json.summary) : (String(json.review.summary || '') || '🧐 Here is the deck review.');
      json.patches = null; json.slides = null; json.title = json.subtitle = json.author = json.deckCss = json.deckJs = json.theme = undefined;
    } else if (Array.isArray(json.patches) && json.patches.length) {
      for (var i = 0; i < json.patches.length; i++) {
        if (applyPatchOp(json.patches[i])) changed = true;
      }
      summary = json.summary ? String(json.summary) : '';
    } else if (Array.isArray(json.slides)) {
      var prevTitle = DB.pres.title;
      var prevSub = DB.pres.subtitle;
      var prevAuthor = DB.pres.author;
      var lockedSaved = [];
      for (var lk = 0; lk < DB.pres.slides.length; lk++) {
        if (DB.pres.slides[lk].locked) lockedSaved.push({ idx: lk, slide: JSON.parse(JSON.stringify(DB.pres.slides[lk])) });
      }
      DB.pres = normalizeDeck({
        title: json.title !== undefined ? json.title : prevTitle,
        subtitle: json.subtitle !== undefined ? json.subtitle : prevSub,
        author: json.author !== undefined ? json.author : prevAuthor,
        slides: json.slides,
        deckCss: json.deckCss !== undefined ? json.deckCss : DB.pres.deckCss,
        deckJs: json.deckJs !== undefined ? json.deckJs : DB.pres.deckJs,
        theme: json.theme !== undefined ? json.theme : DB.pres.theme
      });
      /* LOCKED slides survive a full rebuild: restore them by id (or re-insert at their original position). */
      for (var lr = 0; lr < lockedSaved.length; lr++) {
        var ls = lockedSaved[lr];
        var at = findSlideIndexByIdOrTitle(ls.slide.id);
        if (at !== -1) {
          DB.pres.slides[at] = normalizeSlide(ls.slide, at);
          DB.pres.slides[at].locked = true;
        } else {
          var pos = Math.min(ls.idx, DB.pres.slides.length);
          DB.pres.slides.splice(pos, 0, normalizeSlide(ls.slide, pos));
          DB.pres.slides[pos].locked = true;
        }
      }
      changed = true;
      summary = json.summary ? String(json.summary) : '';
    } else {
      var metaChanged = false;
      if (json.title !== undefined) { DB.pres.title = String(json.title).substring(0, 140); metaChanged = true; }
      if (json.subtitle !== undefined) { DB.pres.subtitle = String(json.subtitle).substring(0, 240); metaChanged = true; }
      if (json.author !== undefined) { DB.pres.author = String(json.author).substring(0, 120); metaChanged = true; }
      if (json.theme !== undefined) {
        var th = String(json.theme || '').toLowerCase();
        DB.pres.theme = THEMES[th] ? th : 'clean';
        metaChanged = true;
      }
      if (json.deckCss !== undefined) { DB.pres.deckCss = String(json.deckCss); metaChanged = true; }
      if (json.deckJs !== undefined) { DB.pres.deckJs = String(json.deckJs); metaChanged = true; }
      changed = metaChanged;
      summary = json.summary ? String(json.summary) : '';
    }
    if (json.suggestions && Array.isArray(json.suggestions)) {
      var extraSug = [];
      for (var s = 0; s < json.suggestions.length; s++) {
        var line = String(json.suggestions[s]);
        var m = /\[\[([a-zA-Z0-9_\-]+)\]\](.*)$/.exec(line);
        extraSug.push({ id: m ? m[1] : 'suggest_' + s, text: (m ? m[2] : line).trim() || 'More' });
      }
      parsed.suggestions = dedupeSuggestions(extraSug.concat(parsed.suggestions));
    }
  }

  fixActiveSlide();

  var deckOpts = dedupeSuggestions(parsed.suggestions).slice(0, 5);
  var slideOpts = parsed.slideSuggestions.slice(0, 5);
  if (!deckOpts.length) deckOpts = fallbackDeckSuggestions();
  if (!slideOpts.length && DB.pres.slides.length) slideOpts = fallbackSlideSuggestions();
  extra.options = deckOpts;
  extra.slideOptions = slideOpts;
  if (changed) {
    if (JSON.stringify(beforePres) !== JSON.stringify(DB.pres) || beforeActive !== DB.activeSlideId) {
      pushHistoryRaw(beforePres, beforeActive, 'AI: ' + String(summary || 'update').substring(0, 60));
    }
    _bumpVersion('minor');
    _aiJustUpdated = true;
    extra.version = DB.version;
    if (!summary) summary = '✅ Presentation updated — ' + DB.pres.slides.length + ' slide(s).';
    if (_targetSlideId) clearTargetSlide(); // a successful targeted edit consumes the target
  }
  persist();
  renderAll();
  updatePreview();
  syncThemeSelect();
  updateHistoryButtons();

  var docRes = runDeckChecks();
  extra.doctor = docRes;

  var prose = parsed.text;
  if (json) {
    var ps = prose.indexOf('{');
    var pe = prose.lastIndexOf('}');
    if (ps !== -1 && pe > ps) prose = (prose.substring(0, ps) + ' ' + prose.substring(pe + 1)).trim();
  }
  var finalText = summary || prose || (changed ? '✅ Presentation updated.' : '⚠️ I couldn\'t produce a deck change for that. Please try rephrasing your request.');
  addChatMessage('ai', finalText, extra);
  try {
    tool.notify(changed ? '💾 Deck saved — v' + DB.version : 'No deck changes applied', changed ? 'success' : 'info');
    if (docRes.failed > 0 || docRes.warned > 0) {
      tool.notify('🧪 Deck Doctor: ' + docRes.failed + ' problem(s), ' + docRes.warned + ' warning(s) — open it from the Slides tab', 'info');
    }
  } catch (e) {}
  tool.resize();
}

function dedupeSuggestions(list) {
  var seen = {};
  var out = [];
  for (var i = 0; i < (list || []).length; i++) {
    if (!list[i] || seen[list[i].id]) continue;
    seen[list[i].id] = true;
    out.push(list[i]);
  }
  return out;
}

function fallbackDeckSuggestions() {
  return [
    { id: 'sug_chart', text: 'Add a chart slide visualizing the key numbers' },
    { id: 'sug_visual', text: 'Make the deck more visual — replace a bullet slide with cards or a diagram' },
    { id: 'sug_notes', text: 'Add speaker notes to every slide' },
    { id: 'sug_close', text: 'Add a closing slide with a call to action' }
  ];
}

function fallbackSlideSuggestions() {
  var out = [];
  var slides = DB.pres.slides || [];
  if (!slides.length) return out;
  var idx = Math.max(0, Math.min(activeSlideIndex(), slides.length - 1));
  var s = slides[idx];
  if (s) {
    out.push({ id: 'fs_visual', text: 'Add a visual component (chart or cards)', slideId: s.id });
    out.push({ id: 'fs_trim', text: 'Shorten the text so it fits better', slideId: s.id });
  }
  return out;
}

/* ═══════════════════════════════════════════
   SEND CHAT MESSAGE
   ═══════════════════════════════════════════ */
function sendChatMessage() {
  var input = el('chat-input');
  if (!input) return;
  if (_aiCallActive) {
    try { tool.notify('AI is already designing. Wait or press Stop.', 'warning'); } catch (e) {}
    return;
  }
  if (!canWrite()) {
    try { tool.notify('This tool is in read-only mode — AI edits are disabled.', 'warning'); } catch (e) {}
    return;
  }
  var msg = input.value.trim();
  if (!msg) return;

  var slash = handleSlashCommand(msg);
  if (slash === 'done') return;
  if (slash) msg = slash;

  var tok = { cancelled: false };
  _reqToken = tok;

  addChatMessage('user', msg);
  input.value = '';
  input.style.height = 'auto';

  if (!_activeSessionId && _sessionsLoaded) {
    createSession(function(newSession) {
      if (newSession) {
        _activeSessionId = newSession.id;
        DB.activeSessionId = newSession.id;
        persist();
        renderSessionList();
      }
    });
  }

  if (_shouldPlan(msg)) {
    sendChatMessageAgentic(msg, tok);
    return;
  }
  _generateSingle(msg, tok);
}

/* Single-shot generation (the pre-agentic flow) */
function _generateSingle(msg, tok) {
  var prompt = buildChatPrompt(msg);
  updateConnStatus('busy');
  _aiCallActive = true;
  _setAiUIActive(true);
  setAiTimeout(prompt.length);

  var useStream = typeof tool.requestAIStream === 'function';
  if (useStream) {
    showThinkingBubble('🎞️ Designing your deck…', true);
    var fullResponse = '';
    var streamStart = Date.now();
    try {
      tool.requestAIStream(prompt, '', {
        onToken: function(token) {
          if (tok.cancelled) return;
          _lastTokenAt = Date.now();
          fullResponse += token;
          setAiTimeout(prompt.length);
          if (_streamCallback) _streamCallback(token);
        },
        onComplete: function() {
          if (tok.cancelled) { _reqToken = null; return; }
          _reqToken = null;
          clearAiTimeout();
          _markThinkingComplete(Date.now() - streamStart);
          if (fullResponse && fullResponse.trim() && fullResponse.length > 5) {
            applyAIResponse(fullResponse);
          } else {
            _aiCallActive = false;
            _setAiUIActive(false);
            updateConnStatus('error');
            addChatMessage('ai', '⚠️ **The AI stream returned empty.** Try again, or ask your CMS admin to check the AI gateway (allowAi: yes).', { isError: true });
            tool.resize();
          }
        },
        onError: function(err) {
          if (tok.cancelled) { _reqToken = null; return; }
          _reqToken = null;
          _aiCallActive = false;
          clearAiTimeout();
          _markThinkingComplete(Date.now() - streamStart);
          updateConnStatus('error');
          _setAiUIActive(false);
          addChatMessage('ai', '⚠️ **AI Stream Error:** ' + (err || 'Unknown failure') + '\n\nCheck that allowAi is set to "yes" in the field settings.', { isError: true });
          tool.resize();
        }
      });
    } catch (e) {
      _aiCallActive = false;
      _reqToken = null;
      clearAiTimeout();
      _markThinkingComplete(0);
      updateConnStatus('error');
      _setAiUIActive(false);
      addChatMessage('ai', '⚠️ **AI call failed:** ' + (e.message || 'Unknown error'), { isError: true });
      tool.resize();
    }
  } else {
    showThinkingBubble('🎞️ Designing your deck…', false);
    var batchStart = Date.now();
    try {
      tool.requestAI(prompt, '', function(err, response) {
        if (tok.cancelled) { _reqToken = null; return; }
        _reqToken = null;
        clearAiTimeout();
        _markThinkingComplete(Date.now() - batchStart);
        if (response && response.trim() && response.length > 5) {
          applyAIResponse(response);
        } else if (err) {
          _aiCallActive = false;
          updateConnStatus('error');
          _setAiUIActive(false);
          addChatMessage('ai', '⚠️ **AI Error:** ' + err, { isError: true });
        } else {
          _aiCallActive = false;
          updateConnStatus('error');
          _setAiUIActive(false);
          addChatMessage('ai', '⚠️ **No AI response received.**\n\nCheck that the CMS AI service is configured (allowAi: yes).', { isError: true });
        }
        tool.resize();
      });
    } catch (e) {
      _aiCallActive = false;
      _reqToken = null;
      clearAiTimeout();
      _markThinkingComplete(0);
      updateConnStatus('error');
      _setAiUIActive(false);
      addChatMessage('ai', '⚠️ **AI call failed:** ' + (e.message || 'Unknown error'), { isError: true });
      tool.resize();
    }
  }
}

/* ═══════════════════════════════════════════
   STUDIO UI: preview, strip, slides list
   ═══════════════════════════════════════════ */
function activeSlideIndex() {
  var slides = DB.pres.slides || [];
  if (!slides.length) return 0;
  var idx = 0;
  for (var i = 0; i < slides.length; i++) {
    if (slides[i].id === DB.activeSlideId) { idx = i; break; }
  }
  return Math.min(idx, slides.length - 1);
}

function updateSlideCounter() {
  var c = el('slide-counter');
  if (c) {
    var n = DB.pres.slides.length;
    c.textContent = n ? ((_activeSlideIndex + 1) + ' / ' + n) : '0 / 0';
  }
  var badge = el('pres-badge');
  if (badge) badge.textContent = DB.pres.slides.length + ' slide' + (DB.pres.slides.length === 1 ? '' : 's');
}

function renderStrip() {
  var strip = el('slide-strip');
  if (!strip) return;
  var slides = DB.pres.slides || [];
  if (!slides.length) {
    strip.innerHTML = '<span class="strip-empty">No slides yet — describe your presentation in the chat.</span>';
    return;
  }
  var h = '';
  for (var i = 0; i < slides.length; i++) {
    var isActive = i === _activeSlideIndex;
    var lockBadge = slides[i].locked ? ' 🔒' : '';
    h += '<div class="strip-item' + (isActive ? ' active' : '') + '" data-strip="' + i + '" title="' + esc(slides[i].title) + '">' +
      '<span class="strip-num">' + (i + 1) + '</span>' +
      '<span class="strip-title">' + esc(slides[i].title || 'Slide ' + (i + 1)) + lockBadge + '</span></div>';
  }
  strip.innerHTML = h;
  var items = strip.querySelectorAll('.strip-item');
  for (var j = 0; j < items.length; j++) {
    items[j].addEventListener('click', function() {
      var n = parseInt(this.getAttribute('data-strip'), 10);
      if (_targetMode && DB.pres.slides[n]) {
        setTargetSlide(DB.pres.slides[n].id);
      } else {
        gotoSlide(n);
      }
    });
  }
}

function gotoSlide(n) {
  var slides = DB.pres.slides || [];
  if (n < 0 || n >= slides.length) return;
  _activeSlideIndex = n;
  DB.activeSlideId = slides[n].id;
  saveNavigationState();
  updateSlideCounter();
  var frame = el('pres-frame');
  if (frame && frame.contentWindow) {
    try { frame.contentWindow.postMessage({ pres: { type: 'goto', n: n } }, '*'); } catch (e) {}
  }
  renderStrip();
}

function renderSlidesList() {
  var list = el('slides-list');
  if (!list) return;
  var slides = DB.pres.slides || [];
  if (!slides.length) {
    list.innerHTML = '<div class="slides-empty"><div class="empty-icon">🧩</div>No slides yet.<br>Click "+ Add Blank Slide" or describe your deck in the chat.</div>';
    return;
  }
  var h = '';
  for (var i = 0; i < slides.length; i++) {
    var s = slides[i];
    var types = [];
    for (var j = 0; j < s.components.length; j++) types.push(s.components[j].type);
    var lockBtnTitle = s.locked ? 'Unlock (allow AI edits)' : 'Lock (protect from AI edits)';
    h += '<div class="slide-card' + (s.locked ? ' locked-card' : '') + (s.id === DB.activeSlideId ? ' is-active-card' : '') + '" data-sid="' + esc(s.id) + '">' +
      '<div class="slide-card-header">' +
        '<label class="slide-sel-wrap" title="Select for bulk actions"><input type="checkbox" class="slide-sel"' + (_selectedSlides[s.id] ? ' checked' : '') + ' data-sel="' + esc(s.id) + '"></label>' +
        '<span class="slide-card-num">' + (i + 1) + '</span>' +
        '<input class="slide-card-title" data-title-sid="' + esc(s.id) + '" value="' + esc(s.title) + '" title="Click to rename">' +
        '<span class="slide-card-comps">' + esc(types.slice(0, 4).join(' · ') || 'empty') + (types.length > 4 ? ' · +' + (types.length - 4) : '') + '</span>' +
        '<div class="slide-card-actions">' +
          '<button class="btn-icon" data-up="' + esc(s.id) + '" title="Move up">↑</button>' +
          '<button class="btn-icon" data-down="' + esc(s.id) + '" title="Move down">↓</button>' +
          '<button class="btn-icon" data-dup="' + esc(s.id) + '" title="Duplicate">⧉</button>' +
          '<button class="btn-icon" data-insp="' + esc(s.id) + '" title="Inspector: title, notes, duration, transition, background, lock">✏️</button>' +
          '<button class="btn-icon" data-target="' + esc(s.id) + '" title="Target: next AI message edits only this slide">🎯</button>' +
          '<button class="btn-icon' + (s.locked ? ' lock-on' : '') + '" data-lock="' + esc(s.id) + '" title="' + esc(lockBtnTitle) + '">' + (s.locked ? '🔒' : '🔓') + '</button>' +
          '<button class="btn-icon" data-ai="' + esc(s.id) + '" title="Ask the AI about this slide">🤖</button>' +
          '<button class="btn-icon danger" data-del="' + esc(s.id) + '" title="Delete">✕</button>' +
        '</div>' +
      '</div>' +
      '<div class="slide-card-body">' +
        '<div class="slide-card-meta">' +
          '<span>ID: <code>' + esc(s.id) + '</code></span>' +
          '<span>' + s.components.length + ' component(s)</span>' +
          (s.notes ? '<span>🗒 notes</span>' : '') +
          (s.locked ? '<span class="slide-lock-badge">🔒 Locked</span>' : '') +
        '</div>' +
        '<details class="slide-json-editor"><summary style="cursor:pointer;font-size:11px;color:#7c3aed;font-weight:600">🧩 Edit components JSON</summary>' +
          '<textarea data-json-sid="' + esc(s.id) + '" spellcheck="false">' + esc(JSON.stringify(s.components, null, 2)) + '</textarea>' +
          '<div class="slide-json-actions"><button class="btn btn-sm btn-primary" data-apply-sid="' + esc(s.id) + '">Apply</button></div>' +
        '</details>' +
      '</div>' +
    '</div>';
  }
  list.innerHTML = h;

  var cards = list.querySelectorAll('.slide-card');
  for (var c = 0; c < cards.length; c++) {
    var sid = cards[c].getAttribute('data-sid');
    var selBox = cards[c].querySelector('[data-sel]');
    var upBtn = cards[c].querySelector('[data-up]');
    var downBtn = cards[c].querySelector('[data-down]');
    var dupBtn = cards[c].querySelector('[data-dup]');
    var inspBtn = cards[c].querySelector('[data-insp]');
    var targetBtn = cards[c].querySelector('[data-target]');
    var lockBtn = cards[c].querySelector('[data-lock]');
    var aiBtn = cards[c].querySelector('[data-ai]');
    var delBtn = cards[c].querySelector('[data-del]');
    var titleInput = cards[c].querySelector('[data-title-sid]');
    var applyBtn = cards[c].querySelector('[data-apply-sid]');
    var jsonArea = cards[c].querySelector('[data-json-sid]');

    if (upBtn) upBtn.onclick = function() { moveSlide(sid, -1); };
    if (downBtn) downBtn.onclick = function() { moveSlide(sid, 1); };
    if (dupBtn) dupBtn.onclick = function() { duplicateSlide(sid); };
    if (inspBtn) inspBtn.onclick = function() { openInspector(sid); };
    if (selBox) selBox.onchange = function() { toggleSlideSelect(sid, selBox.checked); };
    if (targetBtn) targetBtn.onclick = function() { setTargetSlide(sid); switchChatTab('chat'); };
    if (lockBtn) lockBtn.onclick = function() { toggleLockSlide(sid); };
    if (aiBtn) aiBtn.onclick = function() { askAiAboutSlide(sid); };
    if (delBtn) delBtn.onclick = function() { deleteSlideById(sid); };
    if (titleInput) {
      titleInput.onchange = function() {
        renameSlide(sid, titleInput.value);
      };
    }
    if (applyBtn && jsonArea) {
      applyBtn.onclick = function() {
        applySlideJson(sid, jsonArea.value);
      };
    }
    bindSlideDrag(cards[c], sid);
  }
}

function renderAll() {
  renderVersion();
  renderStrip();
  renderSlidesList();
  updateSlideCounter();
  syncThemeSelect();
  syncDeckTransition();
  updateHistoryButtons();
  updateTargetChip();
  renderTimingTotal();
  renderBulkBar();
  renderCollabChip();
  var titleInput = el('deck-title-input');
  if (titleInput && titleInput.value !== DB.pres.title) titleInput.value = DB.pres.title || '';
}

function syncDeckTransition() {
  var sel = el('deck-transition');
  if (!sel) return;
  sel.value = DB.pres.transition || '';
  sel.disabled = !canWrite();
}

function updatePreview() {
  var frame = el('pres-frame');
  var empty = el('pres-empty');
  if (!frame) return;
  if (!DB.pres.slides.length) {
    if (empty) empty.style.display = 'flex';
    frame.style.display = 'none';
    renderStrip();
    updateSlideCounter();
    return;
  }
  if (empty) empty.style.display = 'none';
  frame.style.display = '';
  _previewSeq++;
  frame.srcdoc = buildStandalone();
  renderStrip();
  updateSlideCounter();
}

/* ── Slide operations ── */
function slideIndexById(id) {
  var slides = DB.pres.slides || [];
  for (var i = 0; i < slides.length; i++) {
    if (slides[i].id === id) return i;
  }
  return -1;
}

function addBlankSlide() {
  if (!canWrite()) {
    try { tool.notify('Read-only mode — cannot add slides.', 'warning'); } catch (e) {}
    return;
  }
  var slide = {
    id: genId(),
    title: 'New Slide',
    notes: '',
    components: [
      { type: 'heading', data: { text: 'New Slide' } },
      { type: 'bullets', data: { items: [{ text: 'Add your content here' }] } }
    ]
  };
  pushHistory('Add blank slide');
  DB.pres.slides.push(slide);
  DB.activeSlideId = slide.id;
  _activeSlideIndex = DB.pres.slides.length - 1;
  persist();
  renderAll();
  updatePreview();
  try { tool.notify('Blank slide added — edit its JSON or ask the AI to fill it.', 'success'); } catch (e) {}
  switchTab('present');
}

function duplicateSlide(id) {
  if (!canWrite()) return;
  var idx = slideIndexById(id);
  if (idx === -1) return;
  var src = DB.pres.slides[idx];
  var copy = {
    id: genId(),
    title: src.title + ' (copy)',
    notes: src.notes || '',
    locked: false,
    components: JSON.parse(JSON.stringify(src.components || []))
  };
  pushHistory('Duplicate slide');
  DB.pres.slides.splice(idx + 1, 0, copy);
  persist();
  renderAll();
  updatePreview();
}

function deleteSlideById(id) {
  if (!canWrite()) return;
  var idx = slideIndexById(id);
  if (idx === -1) return;
  var name = DB.pres.slides[idx].title || 'this slide';
  sandboxConfirm('Delete "' + name + '"? This cannot be undone.', function() {
    pushHistory('Delete slide');
    DB.pres.slides.splice(idx, 1);
    fixActiveSlide();
    persist();
    renderAll();
    updatePreview();
    try { tool.notify('Slide deleted.', 'info'); } catch (e) {}
  });
}

function moveSlide(id, delta) {
  if (!canWrite()) return;
  var idx = slideIndexById(id);
  if (idx === -1) return;
  var to = idx + delta;
  if (to < 0 || to >= DB.pres.slides.length) return;
  pushHistory('Reorder slides');
  var moved = DB.pres.slides.splice(idx, 1)[0];
  DB.pres.slides.splice(to, 0, moved);
  _activeSlideIndex = to;
  DB.activeSlideId = moved.id;
  persist();
  renderAll();
  updatePreview();
}

function renameSlide(id, newTitle) {
  if (!canWrite()) return;
  var idx = slideIndexById(id);
  if (idx === -1) return;
  var t = String(newTitle || '').trim();
  if (!t) {
    renderSlidesList();
    return;
  }
  pushHistory('Rename slide');
  DB.pres.slides[idx].title = t.substring(0, 120);
  persist();
  renderStrip();
  renderSlidesList();
}

function applySlideJson(id, jsonText) {
  if (!canWrite()) return;
  var idx = slideIndexById(id);
  if (idx === -1) return;
  var components = null;
  try {
    components = JSON.parse(jsonText);
  } catch (e) {
    try { tool.notify('Invalid JSON: ' + e.message, 'error'); } catch (e2) {}
    return;
  }
  if (!Array.isArray(components)) {
    try { tool.notify('Components must be a JSON array of {type, data}.', 'error'); } catch (e) {}
    return;
  }
  var cleaned = [];
  for (var i = 0; i < components.length; i++) {
    var c = normalizeComponent(components[i]);
    if (c) cleaned.push(c);
  }
  pushHistory('Edit slide components');
  DB.pres.slides[idx].components = cleaned;
  persist();
  renderSlidesList();
  updatePreview();
  try { tool.notify('Slide updated — ' + cleaned.length + ' component(s).', 'success'); } catch (e) {}
}

function askAiAboutSlide(id) {
  var idx = slideIndexById(id);
  if (idx === -1) return;
  var s = DB.pres.slides[idx];
  var types = [];
  for (var i = 0; i < s.components.length; i++) types.push(s.components[i].type);
  setTargetSlide(id);
  var prompt = 'Update the slide "' + s.title + '" (id: ' + s.id + '). Its current components: ' + (types.join(', ') || 'none') + '. Make it: ';
  var inp = el('chat-input');
  if (!inp) return;
  inp.value = prompt;
  inp.style.height = 'auto';
  switchChatTab('chat');
  inp.focus();
  var len = inp.value.length;
  inp.setSelectionRange(len, len);
}

/* ── Confirm dialog ── */
var _confirmCallback = null;
function sandboxConfirm(message, onYes) {
  _confirmCallback = onYes;
  var overlay = el('confirm-overlay');
  var msgEl = el('confirm-message');
  if (msgEl) msgEl.textContent = message;
  if (overlay) overlay.style.display = '';
}
function hideConfirm() {
  var overlay = el('confirm-overlay');
  if (overlay) overlay.style.display = 'none';
  _confirmCallback = null;
}

/* ═══════════════════════════════════════════
   EXPORT
   ═══════════════════════════════════════════ */
function slugify(s) {
  var t = String(s || '').trim().toLowerCase();
  t = t.replace(/[^a-z0-9\u00e7\u011f\u0131\u00f6\u015f\u00fc]+/g, '-').replace(/^-+|-+$/g, '');
  return t || 'presentation';
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function updateExportInfo() {
  var doc = DB.pres.slides.length ? buildStandalone() : '';
  var pptx = null;
  if (DB.pres.slides.length) {
    try { pptx = buildPptx(); } catch (e) { pptx = null; }
  }
  var info = el('export-info');
  if (info) {
    var heavy = (doc.length > 1500000 || (pptx && pptx.length > 2000000)) ? ' ⚠ large export — see Performance.' : '';
    info.textContent = 'Slides: ' + DB.pres.slides.length +
      ' · HTML: ' + formatSize(doc.length) +
      (pptx ? ' · PPTX: ' + formatSize(pptx.length) : ' · PPTX: —') +
      ' · Version: v' + DB.version +
      ' · .html = interactive design · .pptx = editable slides in PowerPoint · PDF = printing.' + heavy;
  }
}

function _downloadBlob(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 3000);
}

function downloadExport() {
  if (!DB.pres.slides.length) {
    try { tool.notify('Nothing to export yet — create some slides first.', 'warning'); } catch (e) {}
    return;
  }
  var doc = buildStandalone();
  var filename = slugify(DB.pres.title) + '.html';
  try {
    _downloadBlob(new Blob([doc], { type: 'text/html' }), filename);
    try { tool.notify('Downloaded ' + filename, 'success'); } catch (e) {}
  } catch (e) {
    try { tool.notify('Download blocked by the sandbox — use "Copy Full HTML" or "Export PDF" instead.', 'warning'); } catch (e2) {}
  }
}

function copyExport() {
  if (!DB.pres.slides.length) {
    try { tool.notify('Nothing to export yet.', 'warning'); } catch (e) {}
    return;
  }
  var doc = buildStandalone();
  function fallback() {
    try {
      var ta = document.createElement('textarea');
      ta.value = doc;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      try { tool.notify('Copied ' + formatSize(doc.length) + ' of HTML.', 'success'); } catch (e) {}
    } catch (e2) {
      try { tool.notify('Copy failed — use Download instead.', 'error'); } catch (e3) {}
    }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(doc).then(function() {
      try { tool.notify('Copied full standalone HTML (' + formatSize(doc.length) + ').', 'success'); } catch (e) {}
    }).catch(fallback);
  } else {
    fallback();
  }
}

function exportPdf() {
  if (!DB.pres.slides.length) {
    try { tool.notify('Nothing to export yet.', 'warning'); } catch (e) {}
    return;
  }
  var doc = buildStandalone();
  if (typeof tool.requestExportPdf === 'function') {
    try {
      tool.notify('Building the printable file…', 'info');
      tool.requestExportPdf({ html: doc, filename: slugify(DB.pres.title), landscape: true }, function(err, file) {
        if (err) {
          try { tool.notify('PDF export failed: ' + err, 'error'); } catch (e) {}
          return;
        }
        try { tool.notify('Export ready: ' + file.name, 'success'); } catch (e) {}
        try { tool.openUrl(file.url); } catch (e2) {}
      });
    } catch (e) {
      try { tool.notify('PDF export unavailable: ' + e.message, 'warning'); } catch (e2) {}
    }
  } else {
    try { tool.notify('PDF export is not enabled (allowExportPdf: yes). Use Download and print instead.', 'warning'); } catch (e) {}
  }
}

/* ═══════════════════════════════════════════
   PPTX EXPORT — dependency-free OOXML + ZIP (STORE).
   Each slide becomes a text-based, fully editable PowerPoint slide.
   ═══════════════════════════════════════════ */
var _crcTable = null;
function _crc32(bytes) {
  if (!_crcTable) {
    _crcTable = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      _crcTable[n] = c >>> 0;
    }
  }
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < bytes.length; i++) crc = _crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function _zipFiles(files) {
  var enc = new TextEncoder();
  var chunks = [];
  var central = [];
  var offset = 0;
  var now = new Date();
  var dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  var dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
  for (var i = 0; i < files.length; i++) {
    var nameBytes = enc.encode(files[i].name);
    var data = files[i].data;
    var crc = _crc32(data);
    var local = new Uint8Array(30 + nameBytes.length + data.length);
    var dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, dosTime, true);
    dv.setUint16(12, dosDate, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, data.length, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    chunks.push(local);

    var cd = new Uint8Array(46 + nameBytes.length);
    var cdv = new DataView(cd.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0, true);
    cdv.setUint16(10, 0, true);
    cdv.setUint16(12, dosTime, true);
    cdv.setUint16(14, dosDate, true);
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, data.length, true);
    cdv.setUint32(24, data.length, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint16(30, 0, true);
    cdv.setUint16(32, 0, true);
    cdv.setUint16(34, 0, true);
    cdv.setUint16(36, 0, true);
    cdv.setUint32(38, 0, true);
    cdv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);
    offset += local.length;
  }
  var totalCd = 0;
  for (var j = 0; j < central.length; j++) totalCd += central[j].length;
  var eocd = new Uint8Array(22);
  var ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, totalCd, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);
  var out = new Uint8Array(offset + totalCd + 22);
  var pos = 0;
  for (var c1 = 0; c1 < chunks.length; c1++) { out.set(chunks[c1], pos); pos += chunks[c1].length; }
  for (var d1 = 0; d1 < central.length; d1++) { out.set(central[d1], pos); pos += central[d1].length; }
  out.set(eocd, pos);
  return out;
}

function _xmlEscape(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* component → pptx text lines */
function pptxComponentLines(comp) {
  var t = comp.type;
  var d = comp.data || {};
  var out = [];
  function line(text, size, bold, align) {
    if (text !== undefined && text !== null && String(text).trim() !== '') {
      out.push({ text: String(text), size: size || 1800, bold: !!bold, align: align || 'l' });
    }
  }
  var items;
  switch (t) {
    case 'title-slide': line(d.title, 4400, true, 'ctr'); line(d.subtitle, 2200, false, 'ctr'); line([d.presenter, d.date].filter(Boolean).join(' · '), 1500, false, 'ctr'); break;
    case 'section-slide': line(d.number, 1400, false, 'ctr'); line(d.title, 4000, true, 'ctr'); line(d.subtitle, 2000, false, 'ctr'); break;
    case 'closing-slide': line(d.title || 'Thank You', 4000, true, 'ctr'); line(d.message, 2000, false, 'ctr'); line((d.contact || []).map(function(c) { return (c.label || '') + ': ' + (c.value || ''); }).join('   '), 1400, false, 'ctr'); break;
    case 'agenda': line(d.title, 2800, true); items = d.items || []; for (var ai = 0; ai < items.length; ai++) { var it = items[ai]; line((ai + 1) + '. ' + (typeof it === 'string' ? it : (it.title || '')) + (it && it.subtitle ? ' — ' + it.subtitle : ''), 1800); } break;
    case 'heading': line(d.kicker, 1300); line(d.text || d.title, 2800, true); break;
    case 'paragraph': line(d.text || d.body, 1800); break;
    case 'bullets': items = d.items || []; for (var b = 0; b < items.length; b++) { var bi = items[b]; line('• ' + (typeof bi === 'string' ? bi : (bi.text || '')), 1800); } break;
    case 'quote': line('“' + (d.text || d.quote || '') + '”', 2400); line(d.attribution ? '— ' + d.attribution + (d.role ? ', ' + d.role : '') : '', 1500); break;
    case 'steps': line(d.title, 2600, true); items = d.steps || []; for (var st = 0; st < items.length; st++) { var sp = items[st]; line((st + 1) + '. ' + (typeof sp === 'string' ? sp : ((sp.title || ('Step ' + (st + 1))) + (sp.description ? ': ' + sp.description : ''))), 1800); } break;
    case 'stat-cards': items = d.items || []; for (var sc = 0; sc < items.length; sc++) { var ci = items[sc]; line((ci.label || '') + ': ' + (ci.prefix || '') + ci.value + (ci.suffix || ''), 2000, true); } break;
    case 'big-number': line((d.prefix || '') + d.value + (d.suffix || '') + (d.label ? ' — ' + d.label : ''), 4000, true, 'ctr'); break;
    case 'callout': line(d.title ? (d.title + ': ' + (d.text || d.body || '')) : (d.text || d.body || ''), 1800); break;
    case 'comparison': line(d.title, 2600, true); items = d.rows || []; for (var cm = 0; cm < items.length; cm++) { var rr = items[cm]; line((rr.dimension || rr.label || '') + ' · ' + (d.aLabel || 'A') + ': ' + (rr.a || '') + ' | ' + (d.bLabel || 'B') + ': ' + (rr.b || ''), 1700); } break;
    case 'quiz': line(d.title, 2400, true); items = d.items || []; for (var qz = 0; qz < items.length; qz++) { var q = items[qz]; line('Q' + (qz + 1) + '. ' + (q.question || ''), 1800, true); for (var oi = 0; oi < (q.options || []).length; oi++) line((oi === q.correct ? '✓ ' : '     ') + q.options[oi], 1600); } break;
    case 'table': line(d.title, 2600, true); items = d.rows || []; for (var tr = 0; tr < items.length; tr++) { var row = items[tr]; var cells = []; for (var tc = 0; tc < (d.columns || []).length; tc++) { var key = typeof d.columns[tc] === 'string' ? d.columns[tc] : d.columns[tc].key; cells.push(row[key] === undefined ? '' : row[key]); } line(cells.join('  |  '), 1600); } break;
    case 'bar-chart': case 'column-chart': case 'pie-chart': case 'stat-chart': case 'funnel': case 'area-chart': case 'radar': case 'scatter': line(d.title, 2400, true); items = t === 'funnel' ? (d.stages || []) : (t === 'pie-chart' ? (d.segments || []) : (t === 'area-chart' || t === 'radar' ? ((d.series || [])[0] ? ((d.labels || []).map(function(lb, li) { return { label: lb, value: ((d.series || [])[0].values || [])[li] }; })) : []) : (d.items || d.options || d.points || []))); for (var ch = 0; ch < items.length; ch++) line((items[ch].label || '') + ': ' + (items[ch].value !== undefined ? items[ch].value : (items[ch].x + ', ' + items[ch].y)), 1700); break;
    case 'org-tree': line(d.title, 2400, true); (function walkOrg(n, depth) { if (!n) return; line(new Array(depth + 1).join('  ') + '• ' + (n.name || '') + (n.role ? ' (' + n.role + ')' : ''), 1600, depth === 0); var chs = n.children || []; for (var oi2 = 0; oi2 < chs.length; oi2++) walkOrg(chs[oi2], depth + 1); })(d.root, 0); break;
    case 'line-chart': line(d.title, 2400, true); items = d.series || []; for (var ls = 0; ls < items.length; ls++) line((items[ls].name || 'Series') + ': ' + (items[ls].values || []).join(', '), 1700); break;
    case 'timeline': items = d.events || []; for (var tl = 0; tl < items.length; tl++) { var ev = items[tl]; line((ev.date ? ev.date + ' · ' : '') + (ev.title || '') + (ev.description ? ' — ' + ev.description : ''), 1700); } break;
    case 'process-flow': line(d.title, 2400, true); items = d.steps || []; for (var pf = 0; pf < items.length; pf++) line((pf + 1) + '. ' + (items[pf].label || '') + (items[pf].description ? ' — ' + items[pf].description : ''), 1700); break;
    case 'icon-grid': case 'card-grid': case 'logos': items = d.items || []; for (var gg = 0; gg < items.length; gg++) { var gi = items[gg]; line((gi.emoji ? gi.emoji + ' ' : '') + (gi.name || gi.title || gi.label || '') + ((gi.subtitle || gi.body) ? ' — ' + (gi.subtitle || gi.body || '') : ''), 1700); } break;
    case 'matrix': line(d.title, 2400, true); items = d.cells || []; for (var mx = 0; mx < items.length; mx++) line((items[mx].title || '') + (items[mx].body ? ': ' + items[mx].body : ''), 1600); break;
    case 'swot': line('Strengths: ' + (d.strengths || []).join(' · '), 1600); line('Weaknesses: ' + (d.weaknesses || []).join(' · '), 1600); line('Opportunities: ' + (d.opportunities || []).join(' · '), 1600); line('Threats: ' + (d.threats || []).join(' · '), 1600); break;
    case 'pros-cons': line((d.prosTitle || 'Pros') + ': ' + (d.pros || []).join(' · '), 1600); line((d.consTitle || 'Cons') + ': ' + (d.cons || []).join(' · '), 1600); break;
    case 'checklist': items = d.items || []; for (var cl = 0; cl < items.length; cl++) line('☐ ' + (typeof items[cl] === 'string' ? items[cl] : (items[cl].text || '')), 1700); break;
    case 'progress-bars': line(d.title, 2400, true); items = d.items || []; for (var pb = 0; pb < items.length; pb++) line((items[pb].label || '') + ': ' + (items[pb].percent || '') + '%', 1700); break;
    default: if (d.title) line(d.title, 2000, true); if (d.text) line(d.text, 1700); break;
  }
  return out;
}

function _pptxShapeXml(id, x, y, cx, cy, fillHex, paras) {
  var h = '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="Box ' + id + '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>';
  h += '<a:xfrm><a:off x="' + Math.round(x) + '" y="' + Math.round(y) + '"/><a:ext cx="' + Math.round(cx) + '" cy="' + Math.round(cy) + '"/></a:xfrm>';
  h += '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
  h += fillHex ? '<a:solidFill><a:srgbClr val="' + fillHex + '"/></a:solidFill>' : '<a:noFill/>';
  h += '<a:ln><a:noFill/></a:ln>';
  h += '</p:spPr><p:txBody><a:bodyPr wrap="square"><a:spAutoFit/></a:bodyPr><a:lstStyle/>';
  for (var i = 0; i < paras.length; i++) {
    var p = paras[i];
    h += '<a:p><a:pPr algn="' + (p.align || 'l') + '"/>' +
      '<a:r><a:rPr lang="en-US" sz="' + Math.round(p.size * 100) + '"' + (p.bold ? ' b="1"' : '') + ' dirty="0"><a:solidFill><a:srgbClr val="' + (p.color || '1E293B') + '"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr>' +
      '<a:t>' + _xmlEscape(p.text) + '</a:t></a:r></a:p>';
  }
  h += '</p:txBody></p:sp>';
  return h;
}

function _txStylesXml() {
  var b = [];
  b.push('<p:titleStyle><a:lvl1pPr algn="ctr" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:spcBef><a:spcPct val="0"/></a:spcBef><a:buNone/><a:defRPr sz="4400" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mj-lt"/><a:ea typeface="+mj-ea"/><a:cs typeface="+mj-cs"/></a:defRPr></a:lvl1pPr></p:titleStyle>');
  b.push('<p:bodyStyle>');
  for (var lv = 1; lv <= 9; lv++) {
    var marL = lv * 342900;
    b.push('<a:lvl' + lv + 'pPr marL="' + marL + '" indent="-342900" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:spcBef><a:spcPct val="20000"/></a:spcBef><a:buFont typeface="Arial" pitchFamily="34" charset="0"/><a:buChar char="•"/><a:defRPr sz="2800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl' + lv + 'pPr>');
  }
  b.push('</p:bodyStyle>');
  b.push('<p:otherStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr><a:lvl1pPr marL="0" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr></p:otherStyle>');
  return '<p:txStyles>' + b.join('') + '</p:txStyles>';
}

function _themeXml() {
  var fills = '<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="50000"/><a:satMod val="300000"/></a:schemeClr></a:gs><a:gs pos="35000"><a:schemeClr val="phClr"><a:tint val="37000"/><a:satMod val="300000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="15000"/><a:satMod val="350000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="1"/></a:gradFill>' +
    '<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:shade val="51000"/><a:satMod val="130000"/></a:schemeClr></a:gs><a:gs pos="80000"><a:schemeClr val="phClr"><a:shade val="93000"/><a:satMod val="130000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="94000"/><a:satMod val="135000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="0"/></a:gradFill></a:fillStyleLst>';
  var bgs = '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="40000"/><a:satMod val="350000"/></a:schemeClr></a:gs><a:gs pos="40000"><a:schemeClr val="phClr"><a:tint val="45000"/><a:shade val="99000"/><a:satMod val="350000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="20000"/><a:satMod val="255000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="1"/></a:gradFill>' +
    '<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="80000"/><a:satMod val="300000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="30000"/><a:satMod val="200000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="0"/></a:gradFill></a:bgFillStyleLst>';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office"><a:themeElements>' +
    '<a:clrScheme name="Office">' +
    '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
    '<a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2>' +
    '<a:accent1><a:srgbClr val="4F81BD"/></a:accent1><a:accent2><a:srgbClr val="C0504D"/></a:accent2>' +
    '<a:accent3><a:srgbClr val="9BBB59"/></a:accent3><a:accent4><a:srgbClr val="8064A2"/></a:accent4>' +
    '<a:accent5><a:srgbClr val="4BACC6"/></a:accent5><a:accent6><a:srgbClr val="F79646"/></a:accent6>' +
    '<a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink>' +
    '</a:clrScheme>' +
    '<a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
    '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
    '<a:fmtScheme name="Office">' + fills +
    '<a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>' +
    '<a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>' +
    '<a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln></a:lnStyleLst>' +
    '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
    bgs + '</a:fmtScheme>' +
    '</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>';
}

function buildPptx() {
  var slides = DB.pres.slides || [];
  var enc = new TextEncoder();
  var W = 12192000, H = 6858000;
  var marginX = 600000, marginY = 500000;
  var contentTypes = [
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>',
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
  ];
  var sldIds = [];
  var presRels = ['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>'];
  var files = [];
  for (var i = 0; i < slides.length; i++) {
    var slide = slides[i];
    var firstType = slide.components.length ? slide.components[0].type : '';
    var isCover = firstType === 'title-slide' || firstType === 'section-slide' || firstType === 'closing-slide';
    var brandBg = _validHex(_p('brandPrimary', ''));
    var bg = isCover ? (brandBg ? brandBg.slice(1) : '312E81') : 'FFFFFF';
    var textColor = isCover ? 'FFFFFF' : '1E293B';
    var lines = [];
    for (var c = 0; c < slide.components.length; c++) lines = lines.concat(pptxComponentLines(slide.components[c]));
    if (!lines.length) lines.push({ text: slide.title || ('Slide ' + (i + 1)), size: 2800, bold: true, align: 'ctr' });
    var paras = [];
    var totalH = 0;
    for (var l = 0; l < lines.length; l++) {
      var boxH = (lines[l].size / 100) * 12700 * 1.6;
      paras.push({ text: lines[l].text, size: lines[l].size, bold: lines[l].bold, align: lines[l].align || 'l', color: textColor });
      totalH += boxH;
    }
    var startY = isCover ? Math.max(marginY, (H - totalH) / 2) : marginY;
    var shapes = '';
    var id = 2;
    var y = startY;
    for (var p1 = 0; p1 < paras.length; p1++) {
      var boxH2 = (paras[p1].size / 100) * 12700 * 1.6;
      shapes += _pptxShapeXml(id, marginX, y, W - 2 * marginX, boxH2, null, [paras[p1]]);
      id++;
      y += boxH2;
    }
    var sld = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
      '<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="' + bg + '"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>' +
      '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
      '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
      shapes + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
    files.push({ name: 'ppt/slides/slide' + (i + 1) + '.xml', data: enc.encode(sld) });
    files.push({ name: 'ppt/slides/_rels/slide' + (i + 1) + '.xml.rels', data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>') });
    contentTypes.push('<Override PartName="/ppt/slides/slide' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>');
    presRels.push('<Relationship Id="rId' + (i + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide' + (i + 1) + '.xml"/>');
    sldIds.push('<p:sldId id="' + (256 + i) + '" r:id="rId' + (i + 2) + '"/>');
  }

  var presentationXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    '<p:sldIdLst>' + sldIds.join('') + '</p:sldIdLst>' +
    '<p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>';

  var masterXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' +
    '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>' +
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
    _txStylesXml() + '</p:sldMaster>';

  var layoutXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">' +
    '<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>' +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';

  files.push({ name: '[Content_Types].xml', data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' + contentTypes.join('') + '</Types>') });
  files.push({ name: '_rels/.rels', data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>') });
  files.push({ name: 'ppt/presentation.xml', data: enc.encode(presentationXml) });
  files.push({ name: 'ppt/_rels/presentation.xml.rels', data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + presRels.join('') + '</Relationships>') });
  files.push({ name: 'ppt/slideMasters/slideMaster1.xml', data: enc.encode(masterXml) });
  files.push({ name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>') });
  files.push({ name: 'ppt/slideLayouts/slideLayout1.xml', data: enc.encode(layoutXml) });
  files.push({ name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>') });
  files.push({ name: 'ppt/theme/theme1.xml', data: enc.encode(_themeXml()) });
  return _zipFiles(files);
}

function downloadPptx() {
  if (!DB.pres.slides.length) {
    try { tool.notify('Nothing to export yet — create some slides first.', 'warning'); } catch (e) {}
    return;
  }
  try {
    var bytes = buildPptx();
    _downloadBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), slugify(DB.pres.title) + '.pptx');
    try { tool.notify('Downloaded .pptx — opens in PowerPoint as editable slides.', 'success'); } catch (e) {}
  } catch (e) {
    try { tool.notify('PPTX build failed: ' + (e.message || e), 'error'); } catch (e2) {}
  }
}

/* ═══════════════════════════════════════════
   TABS
   ═══════════════════════════════════════════ */
function switchTab(tabName) {
  _currentTab = tabName;
  var tabs = document.querySelectorAll('.ctab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tabName);
  }
  var editors = document.querySelectorAll('.content-editor');
  for (var j = 0; j < editors.length; j++) {
    editors[j].classList.toggle('active', editors[j].id === 'editor-' + tabName);
  }
  if (tabName === 'export') updateExportInfo();
  tool.resize();
}

/* ═══════════════════════════════════════════
   RENDER (value → UI)
   ═══════════════════════════════════════════ */
function render(val) {
  val = val || {};
  var presWas = JSON.stringify(DB.pres);
  DB.pres = normalizeDeck(val.pres);
  DB.activeSlideId = val.activeSlideId || '';
  DB.version = val.version || '1.0.0';
  DB.activeSessionId = val.activeSessionId || '';
  DB.history = Array.isArray(val.history) ? val.history : [];
  DB.snippets = Array.isArray(val.snippets) ? val.snippets.slice(0, 20) : [];
  DB.chatCache = (val.chatCache && typeof val.chatCache === 'object') ? val.chatCache : { sessionId: '', messages: [] };
  DB._instanceId = val._instanceId || '';
  DB._parentRecordId = val._parentRecordId || '';
  _snapshotInitialized = false;
  fixActiveSlide();
  renderVersion();
  renderAll();
  var presSame = JSON.stringify(DB.pres) === presWas;
  if (presSame && DB.pres.slides.length) {
    /* Only navigation/chat state changed — update the strip/counter without
       rebuilding the iframe (a full srcdoc reload flickers between slides). */
    renderStrip();
    updateSlideCounter();
  } else {
    updatePreview();
  }
  updateChatBadge();
  var titleInput = el('deck-title-input');
  if (titleInput) titleInput.value = DB.pres.title || '';
}

/* ═══════════════════════════════════════════
   EVENT BINDINGS
   ═══════════════════════════════════════════ */
function bindEvents() {
  var tabs = document.querySelectorAll('.ctab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function() { switchTab(this.getAttribute('data-tab')); });
  }
  var chatTabs = document.querySelectorAll('.chat-tab');
  for (var j = 0; j < chatTabs.length; j++) {
    chatTabs[j].addEventListener('click', function() { switchChatTab(this.getAttribute('data-chat-tab')); });
  }

  el('btn-chat-send').addEventListener('click', sendChatMessage);
  el('btn-chat-stop').addEventListener('click', cancelAiRequest);
  el('btn-new-session').addEventListener('click', function() {
    createSession(function(session) {
      if (session) {
        if (_activeSessionId) saveCurrentSession();
        _activeSessionId = session.id;
        DB.activeSessionId = session.id;
        DB.chatMessages = [];
        persist();
        renderChatMessages();
        renderSessionList();
        switchChatTab('chat');
        try { tool.notify('New chat created', 'info'); } catch (e) {}
      }
    });
  });

  var chatInput = el('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
    });
    chatInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 160) + 'px';
    });
  }

  el('btn-add-slide').addEventListener('click', addBlankSlide);
  el('btn-prev').addEventListener('click', function() { gotoSlide(Math.max(0, _activeSlideIndex - 1)); });
  el('btn-next').addEventListener('click', function() { gotoSlide(Math.min(DB.pres.slides.length - 1, _activeSlideIndex + 1)); });
  el('btn-refresh-preview').addEventListener('click', updatePreview);

  var undoBtn = el('btn-undo');
  if (undoBtn) undoBtn.addEventListener('click', undo);
  var redoBtn = el('btn-redo');
  if (redoBtn) redoBtn.addEventListener('click', redo);
  var histBtn = el('btn-history');
  if (histBtn) histBtn.addEventListener('click', openHistory);
  var histClose = el('btn-history-close');
  if (histClose) histClose.addEventListener('click', closeHistory);
  var histOv = el('history-overlay');
  if (histOv) {
    histOv.addEventListener('click', function(e) { if (e.target === histOv) closeHistory(); });
  }

  var targetModeBtn = el('btn-target-mode');
  if (targetModeBtn) targetModeBtn.addEventListener('click', toggleTargetMode);
  var targetClearBtn = el('btn-target-clear');
  if (targetClearBtn) targetClearBtn.addEventListener('click', clearTargetSlide);

  var genNotesBtn = el('btn-gen-notes');
  if (genNotesBtn) genNotesBtn.addEventListener('click', generateAllNotes);
  var doctorBtn = el('btn-doctor');
  if (doctorBtn) doctorBtn.addEventListener('click', openDoctor);
  var doctorCloseBtn = el('btn-doctor-close');
  if (doctorCloseBtn) doctorCloseBtn.addEventListener('click', closeDoctor);
  var doctorOv = el('doctor-overlay');
  if (doctorOv) {
    doctorOv.addEventListener('click', function(e) { if (e.target === doctorOv) closeDoctor(); });
  }

  /* ── Phase 2 bindings ── */
  var snippetsBtn = el('btn-snippets');
  if (snippetsBtn) snippetsBtn.addEventListener('click', openSnippets);
  var snipClose = el('btn-snippets-close');
  if (snipClose) snipClose.addEventListener('click', closeSnippets);
  var snipOv = el('snippets-overlay');
  if (snipOv) snipOv.addEventListener('click', function(e) { if (e.target === snipOv) closeSnippets(); });
  var snipSaveActive = el('btn-snip-save-active');
  if (snipSaveActive) snipSaveActive.addEventListener('click', function() { saveSlideAsSnippet(DB.activeSlideId); });

  var datasetsBtn = el('btn-datasets');
  if (datasetsBtn) datasetsBtn.addEventListener('click', openDatasets);
  var dsApply = el('btn-datasets-apply');
  if (dsApply) dsApply.addEventListener('click', applyDatasets);
  var dsClose = el('btn-datasets-close');
  if (dsClose) dsClose.addEventListener('click', closeDatasets);

  var arcBtn = el('btn-arc');
  if (arcBtn) arcBtn.addEventListener('click', openArc);
  var arcClose = el('btn-arc-close');
  if (arcClose) arcClose.addEventListener('click', closeArc);
  var arcOv = el('arc-overlay');
  if (arcOv) arcOv.addEventListener('click', function(e) { if (e.target === arcOv) closeArc(); });

  var a11yBtn = el('btn-a11y');
  if (a11yBtn) a11yBtn.addEventListener('click', openA11y);
  var a11yClose = el('btn-a11y-close');
  if (a11yClose) a11yClose.addEventListener('click', closeA11y);
  var a11yOv = el('a11y-overlay');
  if (a11yOv) a11yOv.addEventListener('click', function(e) { if (e.target === a11yOv) closeA11y(); });

  var translateBtn = el('btn-translate');
  if (translateBtn) translateBtn.addEventListener('click', function() { openTranslate(''); });
  var translateGo = el('btn-translate-go');
  if (translateGo) translateGo.addEventListener('click', doTranslate);
  var translateClose = el('btn-translate-close');
  if (translateClose) translateClose.addEventListener('click', closeTranslate);

  var splitBtn = el('btn-split');
  if (splitBtn) splitBtn.addEventListener('click', openSplitter);
  var splitClose = el('btn-split-close');
  if (splitClose) splitClose.addEventListener('click', closeSplitter);
  var splitOv = el('split-overlay');
  if (splitOv) splitOv.addEventListener('click', function(e) { if (e.target === splitOv) closeSplitter(); });

  var outlineBtn = el('btn-outline-gen');
  if (outlineBtn) outlineBtn.addEventListener('click', openOutlineModal);
  var outlineClose = el('btn-outline-close');
  if (outlineClose) outlineClose.addEventListener('click', closeOutlineModal);
  var outlineUploadBtn = el('btn-outline-upload');
  if (outlineUploadBtn) outlineUploadBtn.addEventListener('click', outlineUpload);
  var outlineGo = el('btn-outline-generate');
  if (outlineGo) outlineGo.addEventListener('click', runOutlineGeneration);

  var inspClose = el('btn-insp-close');
  if (inspClose) inspClose.addEventListener('click', closeInspector);
  var inspInputs = ['insp-title', 'insp-notes', 'insp-duration', 'insp-transition', 'insp-bg'];
  for (var ii = 0; ii < inspInputs.length; ii++) {
    var inpEl = el(inspInputs[ii]);
    if (inpEl) inpEl.addEventListener('input', debounce(commitInspector, 500));
  }
  var inspLock = el('insp-locked');
  if (inspLock) inspLock.addEventListener('change', commitInspector);
  var inspSnippet = el('btn-insp-snippet');
  if (inspSnippet) inspSnippet.addEventListener('click', function() { saveSlideAsSnippet(_inspectorSlideId); });
  var inspTarget = el('btn-insp-target');
  if (inspTarget) inspTarget.addEventListener('click', function() { if (_inspectorSlideId) { setTargetSlide(_inspectorSlideId); switchChatTab('chat'); } });

  var shareBtn = el('btn-export-share');
  if (shareBtn) shareBtn.addEventListener('click', shareLink);
  var embedBtn = el('btn-export-embed');
  if (embedBtn) embedBtn.addEventListener('click', function() { openEmbedModal(''); });
  var embedClose = el('btn-embed-close');
  if (embedClose) embedClose.addEventListener('click', closeEmbedModal);
  var embedCopy = el('btn-embed-copy');
  if (embedCopy) embedCopy.addEventListener('click', copyEmbedCode);
  var embedOv = el('embed-overlay');
  if (embedOv) embedOv.addEventListener('click', function(e) { if (e.target === embedOv) closeEmbedModal(); });

  var notesPdfBtn = el('btn-export-notes');
  if (notesPdfBtn) notesPdfBtn.addEventListener('click', downloadNotesPdf);

  var themeSel = el('theme-select');
  if (themeSel) {
    themeSel.addEventListener('change', function() {
      if (!canWrite()) { syncThemeSelect(); return; }
      var t = String(this.value || '').toLowerCase();
      if (!THEMES[t] || t === DB.pres.theme) return;
      pushHistory('Theme: ' + t);
      DB.pres.theme = t;
      persist();
      renderStrip();
      updatePreview();
      try { tool.notify('Theme: ' + THEMES[t].name, 'success'); } catch (e) {}
    });
  }

  var deckTransSel = el('deck-transition');
  if (deckTransSel) {
    deckTransSel.addEventListener('change', function() {
      if (!canWrite()) { syncDeckTransition(); return; }
      var t = String(this.value || '');
      if (t === DB.pres.transition) return;
      pushHistory('Deck transition: ' + (t || 'crossfade'));
      DB.pres.transition = ['slide', 'zoom', 'flip'].indexOf(t) !== -1 ? t : '';
      persist();
      updatePreview();
      try { tool.notify('Deck transition: ' + (t || 'crossfade'), 'success'); } catch (e) {}
    });
  }

  /* ── Phase 3 bindings ── */
  var voiceBtn = el('btn-voice');
  if (voiceBtn) voiceBtn.addEventListener('click', toggleVoiceInput);

  var timingBtn = el('btn-timing');
  if (timingBtn) timingBtn.addEventListener('click', estimateTiming);
  var proofBtn = el('btn-proof');
  if (proofBtn) proofBtn.addEventListener('click', proofreadDeck);

  var bulkDel = el('btn-bulk-delete');
  if (bulkDel) bulkDel.addEventListener('click', bulkDelete);
  var bulkLock = el('btn-bulk-lock');
  if (bulkLock) bulkLock.addEventListener('click', function() { bulkSetLock(true); });
  var bulkUnlock = el('btn-bulk-unlock');
  if (bulkUnlock) bulkUnlock.addEventListener('click', function() { bulkSetLock(false); });
  var bulkRestyle = el('btn-bulk-restyle');
  if (bulkRestyle) bulkRestyle.addEventListener('click', bulkRestyle);
  var bulkAi = el('btn-bulk-ai');
  if (bulkAi) bulkAi.addEventListener('click', bulkAiPrompt);
  var bulkClear = el('btn-bulk-clear');
  if (bulkClear) bulkClear.addEventListener('click', clearSelection);

  var pngBtn = el('btn-export-png');
  if (pngBtn) pngBtn.addEventListener('click', exportSlidesPng);
  var outlineBtn = el('btn-export-outline');
  if (outlineBtn) outlineBtn.addEventListener('click', openMdModal);
  var mdClose = el('btn-md-close');
  if (mdClose) mdClose.addEventListener('click', closeMdModal);
  var mdCopy = el('btn-md-copy');
  if (mdCopy) mdCopy.addEventListener('click', copyOutline);
  var mdDl = el('btn-md-download');
  if (mdDl) mdDl.addEventListener('click', downloadOutline);
  var mdOv = el('md-overlay');
  if (mdOv) mdOv.addEventListener('click', function(e) { if (e.target === mdOv) closeMdModal(); });

  var perfBtn = el('btn-perf');
  if (perfBtn) perfBtn.addEventListener('click', openPerf);
  var perfClose = el('btn-perf-close');
  if (perfClose) perfClose.addEventListener('click', closePerf);
  var perfOv = el('perf-overlay');
  if (perfOv) perfOv.addEventListener('click', function(e) { if (e.target === perfOv) closePerf(); });

  el('btn-export-download').addEventListener('click', downloadExport);
  el('btn-export-pptx').addEventListener('click', downloadPptx);
  el('btn-export-copy').addEventListener('click', copyExport);
  el('btn-export-pdf').addEventListener('click', exportPdf);
  el('btn-goto-export').addEventListener('click', function() { switchTab('export'); });

  var titleInput = el('deck-title-input');
  if (titleInput) {
    titleInput.addEventListener('input', debounce(function() {
      if (!canWrite()) return;
      var t = titleInput.value.trim();
      if (t === DB.pres.title) return;
      pushHistory('Rename deck');
      DB.pres.title = t;
      persist();
      renderStrip();
      renderSlidesList();
    }, 700));
  }

  el('btn-confirm-yes').addEventListener('click', function() {
    hideConfirm();
    if (_confirmCallback) { var cb = _confirmCallback; _confirmCallback = null; cb(); }
  });
  el('btn-confirm-no').addEventListener('click', hideConfirm);

  var confirmOverlay = el('confirm-overlay');
  if (confirmOverlay) {
    confirmOverlay.addEventListener('click', function(e) {
      if (e.target === confirmOverlay) hideConfirm();
    });
  }

  /* Iframe sync — runtime posts {pres:{type:'current',n}} and we reply with goto */
  window.addEventListener('message', function(e) {
    var d = e.data;
    if (!d || !d.pres) return;
    if (d.pres.type === 'current') {
      _activeSlideIndex = Math.max(0, parseInt(d.pres.n, 10) || 0);
      var s = DB.pres.slides[_activeSlideIndex];
      if (s) {
        DB.activeSlideId = s.id;
        saveNavigationState();
      }
      updateSlideCounter();
      renderStrip();
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      hideConfirm(); closeHistory(); closeDoctor(); closeSnippets(); closeDatasets(); closeArc(); closeA11y(); closeTranslate(); closeSplitter(); closeOutlineModal(); closeEmbedModal(); closeInspector(); closeMdModal(); closePerf();
    }
  });
}

/* ═══════════════════════════════════════════
   ENTRY POINT
   ═══════════════════════════════════════════ */
var _initialized = false;
tool.onReady(function(val, fields) {
  if (_initialized) { console.warn('[PRESBUILDER:INIT] Already initialized — skipping'); return; }
  _initialized = true;

  tool.declareOutput({
    type: 'object',
    title: 'Presentation Builder Value',
    description: 'The saved presentation deck: slides composed of library components plus custom deck CSS/JS, along with session plumbing and a bounded chat cache. Chat transcripts live in ai-chat-sessions-uniconbaseapps.',
    properties: {
      pres: { type: 'object', title: 'Presentation', description: '{title, subtitle, author, slides:[{id,title,notes,components}], deckCss, deckJs}' },
      activeSlideId: { type: 'string', title: 'Active Slide ID', description: 'The slide shown when the deck opens.' },
      version: { type: 'string', title: 'Deck Version', description: 'Semantic version. AI update → minor bump; manual edit → patch bump.' },
      activeSessionId: { type: 'string', title: 'Active Chat Session ID', description: 'Document id in ai-chat-sessions-uniconbaseapps.' },
      chatCache: { type: 'object', title: 'Chat Cache', description: 'Bounded fallback copy of the last chat messages.' },
      _instanceId: { type: 'string', title: 'Instance ID', description: 'Deterministic per-instance identifier for chat-session isolation.' },
      _parentRecordId: { type: 'string', title: 'Parent Record ID', description: 'Parent CMS record id.' }
    }
  });
  tool.declareParams([
    { name: 'allowAi', label: 'Enable AI Prompt Relay', type: 'toggle', default: 'yes', severity: 'mandatory', hint: 'Required for chat-driven presentation generation.' },
    { name: 'allowObjectCRUD', label: 'Enable Object CRUD (chat history)', type: 'toggle', default: 'yes', severity: 'goodToHave', hint: 'Chat history is stored in CMS type ai-chat-sessions-uniconbaseapps. Add it to allowedObjectTypes with role: editor, scope: instance.' },
    { name: 'allowExportPdf', label: 'Enable PDF Export', type: 'toggle', default: 'yes', severity: 'goodToHave', hint: 'Enables the Export PDF button in the Export tab.' },
    { name: 'lang', label: 'Presentation Language', type: 'text', default: 'en', severity: 'optional', hint: 'Language used in generated slide copy (en, tr, fr, de, es, ar).' },
    { name: 'brandPrimary', label: 'Brand Primary Color', type: 'text', default: '', severity: 'optional', hint: 'Hex color (e.g. #7c3aed) used as the accent across decks — cover background, bullets, charts and tabs. The AI honors it too.' },
    { name: 'brandSecondary', label: 'Brand Secondary Color', type: 'text', default: '', severity: 'optional', hint: 'Optional second brand color (hex). Mentioned to the AI when designing.' },
    { name: 'brandFont', label: 'Brand Font', type: 'text', default: '', severity: 'optional', hint: 'Font stack used for slide text (e.g. Montserrat, Georgia). Applied to exported decks.' },
    { name: 'brandLogo', label: 'Brand Logo', type: 'text', default: '', severity: 'optional', hint: 'Optional logo reference shared with the AI prompt.' }
  ]);

  var aiParam = tool.param('allowAi');
  if (!aiParam || aiParam !== 'yes') {
    try {
      tool.reportMissingParams([{
        name: 'allowAi', label: 'Enable AI Prompt Relay',
        type: 'toggle', default: 'yes', severity: 'mandatory',
        hint: 'Set to "yes" to enable AI deck generation via tool.requestAI().',
        reason: 'This tool requires AI access to build presentations from chat.'
      }], 'AI Prompt Relay must be enabled for this tool to function. Set allowAi: yes in the field settings.');
    } catch (e) {}
  }
  try { tool.reportValid(true); } catch (e) {}

  refreshUser();
  refreshPermittedUsers();
  saveBrandPreset();
  render(val);
  bindEvents();
  updateConnStatus('ok');

  loadSessions(function() {
    var hasActiveSession = DB.activeSessionId && DB.activeSessionId.length > 0;
    if (hasActiveSession) {
      switchSession(DB.activeSessionId);
    }
    renderSessionList();
    renderChatMessages();
  });

  if (tool.isReadOnly()) {
    try { tool.notify('Read-only mode — you can view and export the deck, but not edit it.', 'info'); } catch (e) {}
  }
  switchTab('present');
  tool.resize();
});

tool.onValueChange(function(v) {
  try {
    var json = JSON.stringify(v || null);
    if (json === _lastStagedValue) return; // echo of our own staged write — skipping avoids an iframe rebuild/flicker
  } catch (e) {}
  /* G3 — collaboration: an update that is NOT our own echo is someone else's edit */
  if (_initialized && v && v.pres) {
    try {
      if (JSON.stringify(v.pres) !== JSON.stringify(DB.pres)) {
        tool.notify('🔄 Another user updated this deck — changes reloaded.', 'info');
      }
    } catch (e) {}
  }
  render(v);
});
tool.onReadonlyChange(function(ro) {
  var input = el('chat-input');
  if (input) { input.disabled = ro; input.style.opacity = ro ? '0.5' : ''; }
  var send = el('btn-chat-send');
  if (send) send.disabled = ro;
});
tool.onUserChange(function() { refreshUser(); });
