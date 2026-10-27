/* build 2026-10-25-1 */
/* ── Site Setup Guide ──
   Read-only reference tool: where every website setting lives (domain on the
   site folder, chrome in default-header/default-footer, site config in
   websiteConfig) + an FAQ and a persisted setup checklist.

   Contract notes (html-tool-rules):
   - tool.onReady is the ONLY entry point (no DOMContentLoaded / window.onload).
   - No localStorage, no fetch, no alert/confirm/prompt.
   - Nothing here writes CMS data; the only persisted state is this tool's own
     value (last tab, theme, checklist ticks). */

var TOOL_BUILD = '2026-10-25-1';

(function () {
  'use strict';

  /* ── tool SDK access (works standalone with a no-op shim) ── */
  var tool = (typeof window !== 'undefined' && window.tool) ? window.tool : null;
  function has(name) { try { return !!(tool && typeof tool[name] === 'function'); } catch (e) { return false; } }
  function callSdk(name, args) { try { if (has(name)) return tool[name].apply(tool, args || []); } catch (e) {} return undefined; }

  var DEFAULT_STATE = { v: 1, tab: 'overview', theme: '', checks: {} };
  var state = { v: 1, tab: 'overview', theme: '', checks: {} };
  var isReadOnly = false;
  var booted = false;

  /* ── dom helpers ── */
  function el(id) { return document.getElementById(id); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ── state ── */
  function coerceState(v) {
    var s = { v: 1, tab: 'overview', theme: '', checks: {} };
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (typeof v.tab === 'string' && v.tab) s.tab = v.tab;
      if (v.theme === 'dark' || v.theme === 'light') s.theme = v.theme;
      if (v.checks && typeof v.checks === 'object') {
        for (var k in v.checks) {
          if (Object.prototype.hasOwnProperty.call(v.checks, k) && v.checks[k]) s.checks[k] = true;
        }
      }
    }
    return s;
  }
  function persist() {
    if (isReadOnly) return;
    try { if (has('setValue')) tool.setValue(state); } catch (e) {}
  }

  /* ── toast (no alert()) ── */
  var toastTimer = null;
  function toast(msg, kind) {
    var box = el('sg-toast');
    if (!box) return;
    box.textContent = msg;
    box.className = 'sg-toast' + (kind === 'warn' ? ' is-warn' : '');
    box.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.hidden = true; }, 2200);
  }

  /* ── clipboard (Clipboard API when allowed, execCommand fallback) ── */
  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }
  function copyText(text, label) {
    var done = function () { toast((label || 'Snippet') + ' copied'); };
    var fail = function () { toast('Copy blocked — select the text and copy manually', 'warn'); };
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text) ? done() : fail(); });
        return;
      }
    } catch (e) {}
    legacyCopy(text) ? done() : fail();
  }

  /* ── theme ── */
  function applyTheme(t) {
    var use = t || state.theme || '';
    state.theme = use;
    try {
      if (use) document.documentElement.setAttribute('data-sg-theme', use);
      else document.documentElement.removeAttribute('data-sg-theme');
    } catch (e) {}
  }
  function toggleTheme() {
    var current = state.theme;
    if (!current) {
      current = 'light';
      try {
        var bg = getComputedStyle(document.body).backgroundColor || '';
        var m = bg.match(/\d+/g);
        if (m && m.length >= 3) {
          var lum = (0.299 * +m[0]) + (0.587 * +m[1]) + (0.114 * +m[2]);
          current = lum < 128 ? 'dark' : 'light';
        }
      } catch (e) {}
    }
    applyTheme(current === 'dark' ? 'light' : 'dark');
    persist();
  }

  /* ── tabs ── */
  function showTab(name, silent) {
    var tabs = qsa('[data-sg-tab]');
    var panels = qsa('[data-sg-panel]');
    var found = false;
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-sg-tab') === name;
      tabs[i].classList.toggle('is-active', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) found = true;
    }
    for (var j = 0; j < panels.length; j++) {
      panels[j].classList.toggle('is-active', panels[j].getAttribute('data-sg-panel') === name);
    }
    if (!found) { showTab('overview', silent); return; }
    state.tab = name;
    if (!silent) persist();
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  /* ── checklist ── */
  function paintChecks() {
    var boxes = qsa('[data-sg-check]');
    var done = 0;
    for (var i = 0; i < boxes.length; i++) {
      var key = boxes[i].getAttribute('data-sg-check');
      var on = !!state.checks[key];
      boxes[i].checked = on;
      if (on) done++;
    }
    var p = el('sg-check-progress');
    if (p) p.textContent = done + ' / ' + boxes.length + ' done';
  }

  /* ── search ── */
  var ITEM_SEL = '.sg-card, .sg-flow-box, .sg-steps > li, .sg-table-wrap, .sg-snippet, .sg-note, .sg-faq, .sg-check';
  function clearFilter() {
    qsa('.sg-hide').forEach(function (n) { n.classList.remove('sg-hide'); });
    qsa('.sg-panel-empty').forEach(function (n) { n.classList.remove('sg-panel-empty'); });
    var app = el('sg-app');
    if (app) app.classList.remove('sg-search-mode');
    var empty = el('sg-empty');
    if (empty) empty.hidden = true;
    var count = el('sg-search-count');
    if (count) count.textContent = '';
  }
  function applyFilter(query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) { clearFilter(); return; }

    var app = el('sg-app');
    if (app) app.classList.add('sg-search-mode');

    var total = 0;
    qsa('[data-sg-panel]').forEach(function (panel) {
      var items = qsa(ITEM_SEL, panel);
      var panelHits = 0;
      items.forEach(function (item) {
        var text = (item.textContent || '').toLowerCase();
        var hit = text.indexOf(q) !== -1;
        item.classList.toggle('sg-hide', !hit);
        if (hit) panelHits++;
      });
      panel.classList.toggle('sg-panel-empty', panelHits === 0);
      total += panelHits;
    });

    var empty = el('sg-empty');
    if (empty) empty.hidden = total > 0;
    var count = el('sg-search-count');
    if (count) count.textContent = total ? (total + ' match' + (total === 1 ? '' : 'es')) : 'no match';
  }

  /* ── boot ── */
  function render(value) {
    state = coerceState(value);
    applyTheme(state.theme);
    paintChecks();
    showTab(state.tab, true);
  }

  function bind() {
    qsa('[data-sg-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.getAttribute('data-sg-tab');
        clearFilter();
        var s = el('sg-search');
        if (s) s.value = '';
        showTab(name);
      });
    });

    var search = el('sg-search');
    if (search) {
      search.addEventListener('input', function () { applyFilter(search.value); });
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { search.value = ''; clearFilter(); }
      });
    }
    var clearBtn = el('sg-clear-search');
    if (clearBtn) clearBtn.addEventListener('click', function () {
      if (search) search.value = '';
      clearFilter();
      if (search) search.focus();
    });

    qsa('[data-sg-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-sg-copy');
        var src = id ? el(id) : null;
        if (!src) { toast('Nothing to copy', 'warn'); return; }
        copyText(src.textContent || '', 'Snippet');
      });
    });

    qsa('[data-sg-check]').forEach(function (box) {
      box.addEventListener('change', function () {
        var key = box.getAttribute('data-sg-check');
        if (box.checked) state.checks[key] = true;
        else delete state.checks[key];
        paintChecks();
        persist();
      });
    });

    var reset = el('sg-check-reset');
    if (reset) reset.addEventListener('click', function () {
      state.checks = {};
      paintChecks();
      persist();
      toast('Checklist reset');
    });

    var themeBtn = el('sg-theme');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    var build = el('sg-build');
    if (build) build.textContent = 'build ' + TOOL_BUILD;
    var fbuild = el('sg-footer-build');
    if (fbuild) fbuild.textContent = 'Guide build ' + TOOL_BUILD;
  }

  function setReadOnly(ro) {
    isReadOnly = !!ro;
    var note = el('sg-readonly-note');
    if (note) note.hidden = !isReadOnly;
    var reset = el('sg-check-reset');
    if (reset) reset.disabled = isReadOnly;
  }

  function boot(value) {
    if (booted) return;
    booted = true;
    try { console.log('[TOOL:BOOT] build ' + TOOL_BUILD + ' — Site Setup Guide ready'); } catch (e) {}
    render(value);
    bind();
    try { setReadOnly(has('isReadOnly') ? !!tool.isReadOnly() : false); } catch (e) {}
    try { document.body.setAttribute('data-sg-ready', '1'); } catch (e) {}
  }

  /* ── SDK wiring: onReady is the single entry point ── */
  if (tool && typeof tool.onReady === 'function') {
    tool.onReady(function (value) {
      boot(value);
      try { if (typeof tool.onValueChange === 'function') tool.onValueChange(function (v) { render(v); }); } catch (e) {}
      try { if (typeof tool.onReadonlyChange === 'function') tool.onReadonlyChange(function (ro) { setReadOnly(ro); }); } catch (e) {}
    });
  } else {
    /* Standalone (no CMS): the JS field is inlined at the END of the body by
       the platform, so the DOM is already parsed — boot immediately. */
    try { boot(null); } catch (e) { try { console.error('[TOOL:BOOT] failed: ' + (e && e.message ? e.message : e)); } catch (e2) {} }
  }
})();

/* SITESETUPGUIDE-JS-END build 2026-10-25-1 — if this line is MISSING in the CMS Tool Builder JS field, the JS was truncated or not saved */
