/* ── Webpage Builder ──
   AI-first single-page website design studio.
   Chat-left + Studio-right. Chat handles initial design & iterative refinement.
   Preview updates live on every code change. Built for UniconHub CMS HTML-tool system.
────────────────────────────────────────── */

/* ── Helpers ── */
function el(id) { return document.getElementById(id); }
function qs(sel) { return document.querySelector(sel); }
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

/* ── Turkish-safe slugifier (NFKD before transliteration — avoids İ → i- artifacts) ── */
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
  return str || 'page';
}

/* ── State ──
   The SAVED value is slim: only page code + version + session plumbing.
   Version snapshots live as SEPARATE objects (never in this object) so it
   stays far below the 1 MB Firestore document limit. Identity/SEO live on the parent CMS content record;
   design direction comes from ADMIN PARAMETERS (shared across pages);
   chatMessages stay in memory (canonical copy in ai-chat-sessions-uniconbaseapps); history snapshots in webpagebuilder-history-uniconbaseapps. ── */
var DB = {
  code: { html: '', css: '', js: '' },
  history: [],
  chatMessages: [],   // in-memory — canonical copy in ai-chat-sessions-uniconbaseapps
  chatCache: { sessionId: '', messages: [] }, // bounded fallback kept IN the record value so chat survives even if session storage fails
  seo: null,          // === SEO === JSON from the AI (publicwebsite rules)
  pageMeta: null,     // === PAGE META === JSON from the AI
  configNeeded: '',   // === CMS CONFIG NEEDED === notes for the CMS author
  emailTemplate: '',  // === EMAIL TEMPLATE === artifact (for email hooks)
  activeSessionId: '',
  version: '1.0.0'
};

var _theme = 'light';          // builder UI theme (in-memory only)
var currentDevice = 'desktop'; // preview device (in-memory only)

var isReadOnly = false;
var currentTab = 'preview';
var _advSubCurrent = '';   // last active Advanced sub-tab (html/css/js/console/settings/compliance)
var attachedFile = null;        // { name, url, size, type, extractedText }
var interviewMode = false;      // Guided interview mode
var _lastPersistedSnapshot = '';
var _snapshotInitialized = false;
var _aiJustUpdated = false;
var _currentTemplate = null;
var _aiCallActive = false;
var _reqToken = null;
var _streamingMsgEl = null;   // live tabbed streaming bubble (DOM)
var _streamingMsgIdx = -1;    // index of the streaming placeholder in DB.chatMessages
var _streamCurrentTab = 'text'; // which tab receives tokens: text|html|css|js
var _streamTabEls = {};        // { text: <pre>, html: <pre>, css: <pre>, js: <pre> }
var _streamBuf = '';           // buffer for detecting code-block boundaries
var _aiTimeoutId = null;       // AI watchdog timer
var _thinkingTimer = null;
var _thinkingMsgEl = null;
var _thinkingStartTime = 0;
var _lastTokenAt = 0;   // last streamed token time — distinguishes "working" from "waiting"
var _streamCallback = null;
var _pendingScrollId = '';
var _consoleEntries = [];
var _previewBuildSeq = 0;   // stamp counter — forces the preview iframe to re-navigate every render

/* ── Session state ── */
var _sessions = [];
var _activeSessionId = '';
var _sessionsLoaded = false;
var SESSION_TYPE = 'ai-chat-sessions-uniconbaseapps';
var HISTORY_TYPE = 'webpagebuilder-history-uniconbaseapps'; // version snapshots live as separate objects — the main CMS object stays tiny
var HISTORY_MAX = 50;
var _historyMigrated = false; // one-shot migration of legacy `history` arrays found inside the saved value
var _imagesUpgraded = false; // one-shot: random picsum placeholders → concept-relevant keyword images

/* ── Rules text — loaded from embedded DOM element ──
   Priority: admin tool.param('pageRules') → built-in embedded copy of
   generalwebsite-page-rules.txt. ── */
var pageGuideText = '';

function _decodeEmbedded(t) {
  // The embedded rules text is HTML-entity escaped so it can never terminate
  // the <script type="text/plain"> element. Decode all entities back.
  return String(t || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function getActiveRules() {
  try {
    var p = tool.param('pageRules', '');
    if (p && String(p).trim().length > 200) return String(p).trim();
  } catch (e) {}
  return pageGuideText || '';
}

function getRulesSourceName() {
  try {
    var p = tool.param('pageRules', '');
    if (p && String(p).trim().length > 200) return 'Admin parameter (pageRules)';
  } catch (e) {}
  return 'Built-in (public-website-page-rules.txt v2.0)';
}

/* ── Stable instance ID for chat-session isolation ──
   DETERMINISTIC: derived from the parent record id (no random suffix), so it
   recomputes the SAME id on every load — sessions can never be orphaned even
   if the saved value was lost. */
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
  if (!parentId) {
    try { var p = tool.param('objectId', ''); if (p) parentId = String(p); } catch (e) {}
  }
  if (!parentId) {
    try { var s = tool.param('recordId', ''); if (s) parentId = String(s); } catch (e) {}
  }
  DB._instanceId = parentId ? ('rec_' + parentId) : 'inst_unknown';
  try { persist(); } catch (e) {}
  return DB._instanceId;
}

/* ── Admin parameter helper — design direction & context shared across pages ── */
function _p(name, def) {
  try {
    var v = tool.param(name, def);
    return (v === null || v === undefined || v === '') ? def : String(v);
  } catch (e) { return def; }
}

/* ── Parent CMS object fields (cached) — page identity, slug and SEO live on the
   object itself, so we read them instead of asking for duplicate parameters ── */
var _parentFields = null;
function _fields() {
  if (_parentFields === null) {
    _parentFields = {};
    try {
      var f = tool.getFields();
      if (f && typeof f === 'object') _parentFields = f;
    } catch (e) {}
  }
  return _parentFields;
}
function _parentSlug() {
  var f = _fields();
  return String(f.slug || f.pageSlug || '');
}
function _parentBrand() {
  var f = _fields();
  return String(f.brandName || f.brand || f.companyName || f.organizationName || f.title || f.name || '');
}
function _parentSeo() {
  var f = _fields();
  var seo = (f.seo && typeof f.seo === 'object') ? f.seo : {};
  return {
    title: String(seo.metaTitle || f.seoTitle || f.title || f.name || ''),
    desc: String(seo.metaDesc || f.seoDesc || ''),
    keywords: String(seo.metaKeywords || f.seoKeywords || '')
  };
}

/* ── Persistence (with automatic patch-version bumping) ── */
function _dbSnapshot() {
  return [
    DB.code.html, DB.code.css, DB.code.js,
    JSON.stringify(DB.seo || null),
    JSON.stringify(DB.pageMeta || null),
    DB.configNeeded || '',
    DB.emailTemplate || ''
  ].join('\u0001');
}

/* ── Version stamping: the current `vX.Y.Z` is kept as the first line of
   every code block so the page itself always shows which version it is. ── */
var _stampedVersion = '';
function _stampBlock(code, stamp) {
  if (!code) return code;
  // Remove any previous version stamp lines, then prepend the current one.
  // (comment opener built by concatenation — this file runs inline in the CMS page)
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
  DB.code.html = h;
  DB.code.css = c;
  DB.code.js = j;
  return changed;
}

/* The slim payload actually saved to the parent CMS object ── */
function _slimValue() {
  return {
    code: { html: DB.code.html, css: DB.code.css, js: DB.code.js },
    seo: DB.seo || null,
    pageMeta: DB.pageMeta || null,
    configNeeded: DB.configNeeded || '',
    emailTemplate: DB.emailTemplate || '',
    version: DB.version,
    activeSessionId: DB.activeSessionId || '',
    chatCache: { sessionId: _activeSessionId || '', messages: _trimChatCache(DB.chatMessages) },
    _instanceId: DB._instanceId || '',
    _parentRecordId: DB._parentRecordId || ''
  };
}

function persist() {
  if (!_snapshotInitialized) {
    _lastPersistedSnapshot = _dbSnapshot();
    _snapshotInitialized = true;
  } else {
    var snap = _dbSnapshot();
    if (_lastPersistedSnapshot && snap !== _lastPersistedSnapshot && !_aiJustUpdated) _bumpVersion('patch');
    // Refresh AFTER the bump — version stamping changes the code itself.
    _lastPersistedSnapshot = _dbSnapshot();
  }
  _aiJustUpdated = false;
  DB.chatCache = { sessionId: _activeSessionId, messages: _trimChatCache(DB.chatMessages) };
  try { tool.setValue(_slimValue()); } catch (e) {}
  if (_activeSessionId) saveCurrentSession();
  tool.resize();
}

/* ── Bounded chat cache: last N messages with capped text, kept in the record
   value so chat survives a refresh even when session storage is misconfigured. ── */
var CHAT_CACHE_MAX = 20;
var CHAT_CACHE_TEXT_MAX = 2000;
function _trimChatCache(list) {
  var out = [];
  var msgs = (list && list.messages) ? list.messages : (list || []);
  var src = msgs.slice ? msgs.slice(-CHAT_CACHE_MAX) : [];
  for (var i = 0; i < src.length; i++) {
    var m = src[i];
    if (!m || typeof m !== 'object') continue;
    var copy = {
      role: m.role,
      text: String(m.text || '').substring(0, CHAT_CACHE_TEXT_MAX),
      time: m.time
    };
    if (m.version) copy.version = m.version;
    if (m.isError) copy.isError = true;
    if (m.tasks) copy.tasks = m.tasks;
    out.push(copy);
  }
  return out;
}

/* ── Semantic version bump (AI updates → minor, manual edits → patch) ── */
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
  input.className = 'version-input';
  input.value = currentVer;
  display.parentNode.replaceChild(input, display);
  input.focus();
  input.select();
  var save = function() {
    var newVer = input.value.trim();
    if (!/^\d+\.\d+\.\d+$/.test(newVer)) {
      showToast('Version must be like 1.0.0', 'warning');
      newVer = currentVer;
    } else {
      var np = newVer.split('.');
      var cp = currentVer.split('.');
      var higher =
        (parseInt(np[0], 10) > parseInt(cp[0], 10)) ||
        (np[0] === cp[0] && parseInt(np[1], 10) > parseInt(cp[1], 10)) ||
        (np[0] === cp[0] && np[1] === cp[1] && parseInt(np[2], 10) >= parseInt(cp[2], 10));
      if (!higher) {
        showToast('Version must be ≥ ' + currentVer + ' (no downgrade)', 'warning');
        newVer = currentVer;
      }
    }
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

/* ── Session CRUD (ai-chat-sessions-uniconbaseapps) ── */
var _sessionWarnShown = false;
function _warnSessionStorage(msg) {
  if (_sessionWarnShown) return;
  _sessionWarnShown = true;
  console.warn('[WEBPAGEBUILDER:SESSION] ' + msg);
  try {
    showToast('⚠ Chat history storage unavailable — messages are cached inside the record until it is fixed. Check allowObjectCRUD: yes and the ai-chat-sessions-uniconbaseapps object type in field settings.', 'warning');
  } catch (e) {}
}
function loadSessions(callback) {
  try {
    tool.requestObjects('query', { mainObjectType: SESSION_TYPE }, function(err, result) {
      if (err) {
        _warnSessionStorage('Query error: ' + err);
        _sessions = [];
      }
      else {
        var all = (result && result.objects) ? result.objects : [];
        var myId = _resolveInstanceId();
        _sessions = [];
        var needsStamp = [];
        for (var i = 0; i < all.length; i++) {
          var obj = all[i];
          var pd = obj.productData || {};
          var dcb = pd.data_categoriesBased || {};
          // Deterministic id 'rec_<parent>' also matches legacy 'rec_<parent>_<rand>' ids.
          if (dcb._toolInstanceId === myId ||
              (myId !== 'inst_unknown' && dcb._toolInstanceId && String(dcb._toolInstanceId).indexOf(myId) === 0)) {
            _sessions.push(obj);
          }
          else if (!dcb._toolInstanceId && obj._parentObjectId && DB._parentRecordId && obj._parentObjectId === DB._parentRecordId) {
            needsStamp.push(obj);
            _sessions.push(obj);
          }
        }
        for (var s = 0; s < needsStamp.length; s++) {
          (function(session) {
            tool.requestObjects('update', {
              mainObjectType: SESSION_TYPE,
              objectId: session.id,
              productData: { data_categoriesBased: { _toolInstanceId: myId } }
            }, function() {});
          })(needsStamp[s]);
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
  var user = tool.getUser() || {};
  var instId = _resolveInstanceId();
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
          _toolInstanceId: instId
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
    // Merge with the EXISTING session data (protects _toolInstanceId,
    // createdAt, createdBy and any other stored keys from being wiped).
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
    }, function(err, result) {
      if (err) _warnSessionStorage('save error: ' + err);
      if (callback) callback(err ? null : result);
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
  persist();
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
      // Session exists but its message list is empty — restore from the
      // bounded cache and push it into the session object.
      DB.chatMessages = DB.chatCache.messages.slice();
      saveCurrentSession();
    } else {
      DB.chatMessages = [];
    }
  } else {
    DB.chatMessages = [];
    // Session object missing (deleted / storage unavailable) — fall back to
    // the bounded cache if it belongs to this session.
    if (DB.chatCache && DB.chatCache.sessionId === sessionId && DB.chatCache.messages && DB.chatCache.messages.length) {
      DB.chatMessages = DB.chatCache.messages.slice();
    }
  }
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
  var brand = _parentBrand();
  if (brand && brand.length > 1) bestTitle = brand.substring(0, 60);
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
  input.setAttribute('data-sid', sessionId);
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
        if (session) session.name = newName;
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
    var pdA = (a.productData && a.productData.data_categoriesBased) ? a.productData.data_categoriesBased : {};
    var pdB = (b.productData && b.productData.data_categoriesBased) ? b.productData.data_categoriesBased : {};
    var ta = pdA.updatedAt || a.updated || '';
    var tb = pdB.updatedAt || b.updated || '';
    if (ta > tb) return -1;
    if (ta < tb) return 1;
    return 0;
  });
  var html = '';
  for (var i = 0; i < sorted.length; i++) {
    var s = sorted[i];
    var pd = (s.productData && s.productData.data_categoriesBased) ? s.productData.data_categoriesBased : {};
    var name = s.name || 'New Chat';
    var timeAgo = formatTimeAgo(pd.updatedAt || s.updated || '');
    var isActive = s.id === _activeSessionId;
    html += '<div class="session-item' + (isActive ? ' session-active' : '') + '" data-sid="' + esc(s.id) + '">' +
      '<span class="session-dot">' + (isActive ? '●' : '○') + '</span>' +
      '<div class="session-info">' +
        '<div class="session-name" data-sid="' + esc(s.id) + '" title="Double-click to rename">' + esc(name) + '</div>' +
        '<div class="session-time">' + timeAgo + '</div>' +
      '</div>' +
      '<button class="session-rename" data-sid="' + esc(s.id) + '" title="Rename chat">✎</button>' +
      '<button class="session-delete" data-sid="' + esc(s.id) + '" title="Delete chat">✕</button>' +
    '</div>';
  }
  list.innerHTML = html;
  var items = list.querySelectorAll('.session-item');
  for (var j = 0; j < items.length; j++) {
    items[j].onclick = function() {
      var sid = this.getAttribute('data-sid');
      if (sid) switchSession(sid);
    };
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
        var sid = this.getAttribute('data-sid');
        if (sid) startRenameSession(sid);
      };
    }
    var nameEl = items[j].querySelector('.session-name');
    if (nameEl) {
      nameEl.ondblclick = function(e) {
        e.stopPropagation();
        var sid = this.getAttribute('data-sid');
        if (sid) startRenameSession(sid);
      };
    }
  }
}

/* ── Page templates ── */
var TEMPLATES = [
  {
    id: 'saas-landing', icon: '🚀', category: 'Startup',
    title: 'SaaS Landing Page',
    desc: 'Hero, product features, pricing, testimonials and sign-up CTAs for a software product.',
    prompt: 'Design a modern SaaS landing page.\n\n**Page:** Hero with bold headline, subheadline, two CTA buttons ("Start free trial", "Watch demo"), trust logos row, 6-feature grid with icons, product screenshot section, 4 animated stats, 3-tier pricing with monthly/yearly toggle, 3 testimonials, FAQ accordion, final CTA banner, footer.\n\n**Brand:** [use my brand name or invent a credible one]\n**Audience:** tech-savvy professionals\n**Style:** modern SaaS aesthetic, indigo/violet gradient accents, glassy cards, soft shadows, smooth scroll-reveal animations.\n**Interactions:** sticky navbar, mobile hamburger, pricing toggle, FAQ accordion, counters.'
  },
  {
    id: 'restaurant', icon: '🍽️', category: 'Food',
    title: 'Restaurant Page',
    desc: 'Menu, gallery, chef story, opening hours and a reservation form.',
    prompt: 'Design a warm restaurant webpage.\n\n**Page:** Hero with appetizing headline + "Reserve a table" CTA, about/chef story section, menu section with 3 categories (starters, mains, desserts) with prices, photo gallery grid, opening hours + location info cards, testimonials, reservation form (name, date, time, guests) with confirmation message, footer with social links.\n\n**Style:** warm amber/terracotta palette, elegant serif headings, appetizing food photography placeholders (keyword image library), cozy rounded cards.\n**Interactions:** sticky navbar, mobile menu, reservation form submit feedback, gallery hover zoom.'
  },
  {
    id: 'company-profile', icon: '🏢', category: 'Business',
    title: 'Company Profile',
    desc: 'Corporate identity: mission, services, team, stats, clients and contact.',
    prompt: 'Design a professional company profile webpage.\n\n**Page:** Hero with company name + tagline, mission/vision section, values grid (4 cards), services (4-6 cards), stats band (years, clients, projects, employees), team section (4 members), client logos, contact section with form + address/phone/email, footer.\n\n**Style:** corporate blue/teal, clean sans typography, trustworthy, generous whitespace, subtle gradients.\n**Interactions:** sticky navbar, counters, contact form fake submit with success message, scroll animations.'
  },
  {
    id: 'portfolio', icon: '💼', category: 'Creative',
    title: 'Personal Portfolio',
    desc: 'Showcase projects, skills, experience timeline and contact for a creative professional.',
    prompt: 'Design a creative personal portfolio webpage.\n\n**Page:** Hero with big name + role + short intro + CTA, about section, skills with progress bars or tag chips, featured projects grid (6 project cards with image, title, category), experience timeline, services, testimonials, contact form, footer with social links.\n\n**Style:** bold creative violet/fuchsia accents, modern typography, dark hero section, smooth animations.\n**Interactions:** project cards hover effects, mobile nav, contact form feedback, scroll-reveal.'
  },
  {
    id: 'event', icon: '🎪', category: 'Event',
    title: 'Event Page',
    desc: 'Countdown, schedule, speakers, venue and registration for a conference or festival.',
    prompt: 'Design an energetic event webpage.\n\n**Page:** Hero with event name, date, location and a countdown timer, about-the-event section, schedule/agenda (3-column day tabs or timeline), speakers grid (6 cards with photos, names, topics), venue section with map placeholder + address, registration form (name, email, ticket type), FAQ, sponsors strip, footer.\n\n**Style:** energetic gradient (sunset), bold typography, rounded cards, confetti-ish accents.\n**Interactions:** live countdown, day tabs for schedule, registration fake submit, smooth scroll.'
  },
  {
    id: 'product-launch', icon: '📦', category: 'Marketing',
    title: 'Product Launch',
    desc: 'Email capture, feature highlights, specs, gallery and reviews for a new product.',
    prompt: 'Design a polished product launch webpage.\n\n**Page:** Hero with product name + tagline + email capture form ("Get notified"), feature highlights (3 alternating rows with images), tech specs table/grid, image gallery, pricing or pre-order section, customer reviews (3), FAQ, footer.\n\n**Style:** clean emerald accents, product-first layout, crisp cards, strong product imagery placeholders.\n**Interactions:** email form fake submit, gallery lightbox, sticky navbar, reveal animations.'
  },
  {
    id: 'real-estate', icon: '🏠', category: 'Business',
    title: 'Real Estate Page',
    desc: 'Hero search, featured listings with prices, amenities, agents and contact.',
    prompt: 'Design a trustworthy real estate webpage.\n\n**Page:** Hero with headline + property search form (location, type, price), featured listings grid (6 cards with photo, price badge, beds/baths/area), why-choose-us section (4 cards), neighborhood amenities, agent team (3 cards), testimonials, contact section, footer.\n\n**Style:** trustworthy navy/blue, clean cards, property photos, price highlights.\n**Interactions:** search form filters the listing grid client-side, mobile nav, contact form feedback.'
  },
  {
    id: 'coming-soon', icon: '⏳', category: 'Minimal',
    title: 'Coming Soon',
    desc: 'Countdown, email notify form and social links with an animated background.',
    prompt: 'Design a minimal "coming soon" webpage.\n\n**Page:** Centered hero with logo/name, big teaser headline, countdown timer to launch date, short description, email notify form, social media icons, subtle footer.\n\n**Style:** minimal monochrome or deep gradient with animated floating shapes background, big typography.\n**Interactions:** countdown, email form feedback, subtle background animation.'
  }
];

function renderTemplateGallery(container) {
  if (!container) return;
  var html = '';
  for (var i = 0; i < TEMPLATES.length; i++) {
    var t = TEMPLATES[i];
    html += '<div class="template-card" data-tpl-id="' + esc(t.id) + '" onclick="openTemplateModal(\'' + esc(t.id) + '\')">' +
      '<div class="template-card-icon">' + t.icon + '</div>' +
      '<div class="template-card-info">' +
        '<div class="template-card-cat">' + esc(t.category) + '</div>' +
        '<div class="template-card-title">' + esc(t.title) + '</div>' +
        '<div class="template-card-desc">' + esc(t.desc) + '</div>' +
      '</div>' +
    '</div>';
  }
  container.innerHTML = html;
}

function openTemplateModal(tplId) {
  var t = null;
  for (var i = 0; i < TEMPLATES.length; i++) {
    if (TEMPLATES[i].id === tplId) { t = TEMPLATES[i]; break; }
  }
  if (!t) return;
  _currentTemplate = t;
  el('tpl-modal-title').textContent = t.icon + ' ' + t.title;
  el('tpl-icon').textContent = t.icon;
  el('tpl-title').textContent = t.title;
  el('tpl-desc').textContent = t.desc;
  var info = qs('#modal-template .template-modal-info');
  if (info) info.style.display = '';
  var area = qs('#modal-template .template-prompt-area');
  if (area) {
    area.style.display = '';
    area.innerHTML = '<div class="template-prompt-label">✏️ Customize this brief — edit any part, then send to AI:</div>' +
      '<textarea id="tpl-prompt-text" class="template-prompt-text" spellcheck="false">' + esc(t.prompt) + '</textarea>';
  }
  var actions = qs('#modal-template .template-modal-actions');
  if (actions) actions.style.display = '';
  var btnReset = el('btn-tpl-reset'); if (btnReset) btnReset.onclick = resetTemplatePrompt;
  var btnUse = el('btn-tpl-use'); if (btnUse) btnUse.onclick = useTemplatePrompt;
  openModal('modal-template');
}

function openAllTemplates() {
  _currentTemplate = null;
  el('tpl-modal-title').textContent = '📋 All Page Templates';
  var info = qs('#modal-template .template-modal-info');
  if (info) info.style.display = 'none';
  var area = qs('#modal-template .template-prompt-area');
  if (area) {
    area.style.display = '';
    var html = '<div class="template-prompt-label">Choose a template — its brief is loaded into the chat and sent to the AI:</div><div class="template-gallery">';
    for (var i = 0; i < TEMPLATES.length; i++) {
      var t = TEMPLATES[i];
      html += '<div class="template-card" data-tpl-id="' + esc(t.id) + '" onclick="openTemplateModal(\'' + esc(t.id) + '\')">' +
        '<div class="template-card-icon">' + t.icon + '</div>' +
        '<div class="template-card-info">' +
          '<div class="template-card-cat">' + esc(t.category) + '</div>' +
          '<div class="template-card-title">' + esc(t.title) + '</div>' +
          '<div class="template-card-desc">' + esc(t.desc) + '</div>' +
        '</div>' +
      '</div>';
    }
    html += '</div>';
    area.innerHTML = html;
  }
  var actions = qs('#modal-template .template-modal-actions');
  if (actions) actions.style.display = 'none';
  openModal('modal-template');
}

function closeTemplateModal() {
  _currentTemplate = null;
  closeAllModals();
}
function resetTemplatePrompt() {
  if (_currentTemplate && el('tpl-prompt-text')) {
    el('tpl-prompt-text').value = _currentTemplate.prompt;
    showToast('Brief reset to original.', 'info');
  }
}
function useTemplatePrompt() {
  var promptText = el('tpl-prompt-text') ? el('tpl-prompt-text').value.trim() : '';
  if (!promptText) { showToast('Brief is empty.', 'warning'); return; }
  closeAllModals();
  var inp = el('chat-input');
  if (inp) {
    inp.value = promptText;
    inp.style.height = 'auto';
    inp.style.height = Math.min(inp.scrollHeight, 160) + 'px';
  }
  switchChatTab('chat');
  sendChatMessage();
}

/* ── Guided / interview mode ── */
function toggleInterviewMode() {
  interviewMode = !interviewMode;
  var btn = el('btn-guided-mode');
  if (btn) {
    if (interviewMode) { btn.classList.add('active'); btn.textContent = '🪄 Guided: ON'; }
    else { btn.classList.remove('active'); btn.textContent = '🪄 Guided'; }
  }
  var inp = el('chat-input');
  if (inp) {
    inp.placeholder = interviewMode
      ? 'Answer the AI\'s question or describe your page… (Enter to send)'
      : 'Describe your webpage or ask for changes… (Enter to send, Shift+Enter for new line)';
  }
  var msg = interviewMode
    ? '🪄 **Guided Mode active.** I\'ll interview you step by step about your page. Just answer each question — or type freely.'
    : '📝 **Guided Mode off.** Back to free-form chat.';
  addChatMessage('ai', msg);
  tool.resize();
}

function buildInterviewSystemPrompt() {
  return [
    'YOU ARE A WEB DESIGN CONSULTANT interviewing the user about the single-page website they want to build.',
    'Your job is to ask CLEAR, SIMPLE questions — one at a time — to gather all design details.',
    '',
    'RULES:',
    '1. Ask exactly ONE question per response. Keep it short and friendly.',
    '2. After each question, provide 2-5 clickable options, each on its own line formatted [[option_id]] Brief text',
    '3. Do NOT generate code until you have gathered enough information (at least 4-5 answers).',
    '4. When you have enough, summarize what you understood, then ask "Shall I build the page now?"',
    '5. If the user says yes/go/build, output the [HTML]/[CSS]/[JS] blocks following the guide below.',
    '6. If the user provides a detailed description instead of picking options, skip remaining questions and build.',
    '',
    'INTERVIEW FLOW:',
    'Q1: What kind of page do you want? (landing / restaurant / company / portfolio / event / product / other)',
    'Q2: What sections should it have? (hero, about, features, pricing, testimonials, FAQ, contact…)',
    'Q3: Who is the audience and what is the brand name?',
    'Q4: What visual style — colors, mood, dark mode?',
    'Q5: Any specific content, copy or images to include?',
    'Then summarize and offer to build.'
  ].join('\n');
}

/* ── Suggestion detail prompts ([[suggest_xxx]] map) ── */
var SUGGEST_DETAILS = {
  suggest_darkmode: 'Add a dark mode toggle button in the navbar that switches the whole page to a dark theme.',
  suggest_mobile: 'Improve the mobile experience: hamburger menu, better touch targets, and check spacing at 390px width.',
  suggest_animations: 'Add scroll-reveal animations so sections fade/slide in as the visitor scrolls.',
  suggest_testimonials: 'Add a testimonials section with 3 customer reviews, star ratings and avatar photos.',
  suggest_pricing: 'Add a pricing section with 3 tiers, a monthly/yearly toggle and a highlighted popular plan.',
  suggest_faq: 'Add an FAQ section with 6 common questions in an accordion style.',
  suggest_team: 'Add a team section with 4 member cards showing photos, names and roles.',
  suggest_gallery: 'Add a photo gallery with a responsive grid and lightbox effect.',
  suggest_contact: 'Add a contact section with a form, phone, email, address and a map placeholder.',
  suggest_cta: 'Add a bold call-to-action band near the end with a big button.',
  suggest_seo: 'Improve SEO: better heading hierarchy, meta-friendly structure and descriptive alt texts.',
  suggest_fonts: 'Improve the typography: better font pairing, hierarchy and line spacing.',
  suggest_colors: 'Refine the color palette for better contrast and brand feel.',
  suggest_hero: 'Redesign the hero section to be more impactful with a stronger headline and CTA.',
  suggest_navbar: 'Improve the navbar: sticky behavior, active section highlighting and smoother mobile menu.',
  suggest_backtotop: 'Add a back-to-top floating button that appears after scrolling.',
  suggest_newsletter: 'Add a newsletter signup section with an email input.',
  suggest_stats: 'Add a stats band with animated counters (years, clients, projects, awards).'
};
function _getSuggestDetail(id, text) {
  if (SUGGEST_DETAILS[id]) return SUGGEST_DETAILS[id];
  // Section suggestions reuse the context-aware section prompt.
  var sectionKey = String(id).replace(/^suggest_/, '');
  if (SECTION_CANDIDATES[sectionKey]) return buildSectionPrompt(sectionKey);
  return text;
}

/* ── Chat messages ── */
function addChatMessage(role, text, extra) {
  var user = tool.getUser() || {};
  var msg = {
    role: role,
    text: text || '',
    time: new Date().toISOString(),
    userId: role === 'user' ? (user.id || 'anon') : 'ai',
    userName: role === 'user' ? (user.name || 'Anonymous') : 'AI Assistant'
  };
  if (extra && extra.options && extra.options.length) msg.options = extra.options;
  if (extra && extra.version) msg.version = extra.version;
  if (extra && extra.compliance) msg.compliance = extra.compliance;
  if (extra && extra.diffHtml) msg.diffHtml = extra.diffHtml;
  if (extra && extra.isError) msg.isError = true;
  DB.chatMessages.push(msg);
  if (DB.chatMessages.length > 500) DB.chatMessages = DB.chatMessages.slice(-500);
  DB.chatCache = { sessionId: _activeSessionId, messages: _trimChatCache(DB.chatMessages) };
  renderChatMessages();
  updateChatBadge();
  if (_activeSessionId) {
    saveCurrentSession();
    renderSessionList(); // keep chat list timestamps fresh
    // Auto-title: on the 1st user message and every 3rd (earlier ones may be generic)
    if (role === 'user') {
      var userMsgCount = 0;
      for (var mi = 0; mi < DB.chatMessages.length; mi++) {
        if (DB.chatMessages[mi].role === 'user') userMsgCount++;
      }
      if (userMsgCount === 1 || userMsgCount % 3 === 0) autoTitleSession();
    } else if (!(extra && extra.isError)) {
      autoTitleSession();
    }
    // Keep the bounded cache in the record value up to date on EVERY message
    // (the value change is a no-op for the code — the guard re-renders cheaply).
    try { tool.setValue(_slimValue()); } catch (e) {}
  } else {
    // No session object yet — still persist the bounded cache into the
    // record value so chat survives a refresh no matter what.
    try { persist(); } catch (e) {}
  }
}

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
  t = t.replace(/^#{1,3} (.+)$/gm, '<h4>$1</h4>');
  t = t.replace(/^\s*[-*] (.+)$/gm, '• $1');
  t = t.replace(/\n/g, '<br>');
  return t;
}

function optionsHtml(options) {
  var isSuggestion = options[0] && options[0].id.indexOf('suggest_') === 0;
  var h = '<div class="chat-options">';
  if (isSuggestion) {
    h += '<div class="chat-options-header">' +
      '<span class="chat-options-label">💡 Next steps — click to select:</span>' +
      '<button class="chat-options-select-all" data-select-all="1" onclick="toggleSelectAllSuggestions(this)">Select All</button>' +
      '</div>';
  }
  for (var j = 0; j < options.length; j++) {
    var opt = options[j];
    var detail = isSuggestion ? _getSuggestDetail(opt.id, opt.text) : opt.text;
    h += '<button class="chat-option-btn' + (isSuggestion ? ' chat-suggest-btn' : '') + '" data-opt-id="' + esc(opt.id) + '" data-opt-text="' + esc(opt.text) + '" data-opt-detail="' + esc(detail) + '" onclick="handleOptionClick(this)">' +
      (isSuggestion ? '<span class="opt-check">☐</span>' : '<span class="opt-num">' + (j + 1) + '</span>') + esc(opt.text) +
    '</button>';
  }
  if (isSuggestion) {
    h += '<div class="chat-options-footer"><span class="chat-options-hint">Selected items appear in the chat input — edit then press Enter to send.</span></div>';
  }
  h += '</div>';
  return h;
}

var WELCOME_HTML =
  '<div class="chat-welcome">' +
    '<div class="chat-welcome-icon">🪄</div>' +
    '<h3>Describe your webpage</h3>' +
    '<p>Tell me what page you need — <b>a restaurant menu page, a company profile, a product launch page…</b> — and I\'ll design &amp; build it for you, section by section.</p>' +
    '<div class="template-gallery" id="template-gallery"></div>' +
    '<div class="template-view-all"><button id="btn-view-all-templates">View all 8 page templates →</button></div>' +
    '<p style="font-size:10px;color:var(--text3);margin-top:12px">💡 <b>Tip:</b> Try <b>🪄 Guided</b> mode — I\'ll interview you about your page step by step.</p>' +
  '</div>';

function renderChatMessages() {
  var box = el('chat-messages');
  if (!box) return;
  if (!DB.chatMessages || !DB.chatMessages.length) {
    box.innerHTML = WELCOME_HTML;
    renderTemplateGallery(el('template-gallery'));
    var viewAll = el('btn-view-all-templates');
    if (viewAll) viewAll.onclick = openAllTemplates;
    return;
  }
  var h = '';
  for (var i = 0; i < DB.chatMessages.length; i++) {
    var m = DB.chatMessages[i];
    var time = shortTime(m.time);
    if (m.role === 'user') {
      h += '<div class="chat-msg user">' +
        '<div class="chat-avatar">👤</div>' +
        '<div><div class="chat-bubble">' + markdownLite(m.text) + '</div>' +
        '<div class="chat-msg-time">' + time + '</div></div>' +
      '</div>';
    } else if (m.role === 'plan') {
      h += '<div class="chat-msg ai"><div class="chat-avatar">🧠</div><div>' +
        '<div class="plan-bubble" data-plan-idx="' + i + '">' +
        '<div class="plan-header">📋 Task plan' + (m.done ? ' · <span class="plan-status">complete</span>' : '') + '</div>';
      for (var pi = 0; pi < m.tasks.length; pi++) {
        var ptask = m.tasks[pi];
        var picon = ptask.status === 'done' ? '✅' : ptask.status === 'doing' ? '⏳' : ptask.status === 'failed' ? '❌' : '⬜';
        h += '<div class="plan-task ' + ptask.status + '" data-task-i="' + pi + '"><span class="plan-ic">' + picon + '</span><span>' + esc(ptask.d) + '</span></div>';
      }
      h += '</div><div class="chat-msg-time">' + time + '</div></div></div>';
    } else {
      h += '<div class="chat-msg ai' + (m.isError ? ' err' : '') + '">' +
        '<div class="chat-avatar">🎨</div>' +
        '<div><div class="chat-bubble">' + markdownLite(m.text) + '</div>';
      if (m.version) h += '<span class="chat-version-chip" onclick="openHistoryFromChat()" title="Open version history">✓ page v' + esc(m.version) + '</span>';
      if (m.compliance && m.compliance.total) {
        var cs = m.compliance;
        var cicon = cs.failed ? '❌' : cs.warned ? '⚠️' : '✅';
        h += '<span class="chat-compliance-chip" title="Open the Compliance tab" onclick="openComplianceTab()">🧪 ' + cicon + ' ' + cs.passed + '/' + cs.total + ' checks</span>';
      }
      if (m.diffHtml) h += m.diffHtml;
      if (m.options && m.options.length) h += optionsHtml(m.options);
      h += '<div class="chat-msg-time">' + time + '</div></div>' +
      '</div>';
    }
  }
  box.innerHTML = h;
  var diffBtns = box.querySelectorAll('.diff-tab-btn');
  for (var db = 0; db < diffBtns.length; db++) {
    diffBtns[db].onclick = function() { handleDiffTabClick(this); };
  }
  scrollChatToBottom();
}

function scrollChatToBottom() {
  var box = el('chat-messages');
  if (box) box.scrollTop = box.scrollHeight;
}

function updateChatBadge() {
  var badge = el('chat-msg-count');
  if (badge) badge.textContent = (DB.chatMessages || []).length;
}

function handleOptionClick(btn) {
  var optId = btn.getAttribute('data-opt-id');
  var optText = btn.getAttribute('data-opt-text');
  if (optId && optId.indexOf('suggest_') === 0) {
    var inp = el('chat-input');
    if (!inp) return;
    var isSelected = btn.classList.contains('chat-suggest-selected');
    if (isSelected) btn.classList.remove('chat-suggest-selected');
    else btn.classList.add('chat-suggest-selected');
    var checkEl = btn.querySelector('.opt-check');
    if (checkEl) checkEl.textContent = isSelected ? '☐' : '☑';
    _rebuildSuggestInput();
    _updateSelectAllButton(btn.parentNode);
    return;
  }
  var parent = btn.parentNode;
  if (parent) {
    var allBtns = parent.querySelectorAll('.chat-option-btn');
    for (var i = 0; i < allBtns.length; i++) {
      allBtns[i].classList.add('chat-option-used');
      allBtns[i].disabled = true;
    }
  }
  var inp2 = el('chat-input');
  if (inp2) {
    inp2.value = optText;
    inp2.style.height = 'auto';
  }
  sendChatMessage();
}

function _rebuildSuggestInput() {
  var inp = el('chat-input');
  if (!inp) return;
  var allSuggestBtns = document.querySelectorAll('.chat-option-btn.chat-suggest-selected');
  var lines = [];
  var num = 1;
  for (var i = 0; i < allSuggestBtns.length; i++) {
    var detail = allSuggestBtns[i].getAttribute('data-opt-detail');
    var title = allSuggestBtns[i].getAttribute('data-opt-text');
    var txt = detail || title || '';
    if (txt) { lines.push(num + '- ' + txt); num++; }
  }
  var currentVal = inp.value || '';
  var freeText = currentVal.replace(/^\d+-\s+.+$/gm, '').replace(/\n{2,}/g, '\n').trim();
  if (freeText && lines.length > 0) inp.value = freeText + '\n\n' + lines.join('\n');
  else if (lines.length > 0) inp.value = lines.join('\n');
  else inp.value = freeText;
}

function _updateSelectAllButton(container) {
  var selectAll = container.querySelector('.chat-options-select-all');
  if (!selectAll) return;
  var btns = container.querySelectorAll('.chat-option-btn.chat-suggest-btn');
  var allSelected = btns.length > 0;
  for (var i = 0; i < btns.length; i++) {
    if (!btns[i].classList.contains('chat-suggest-selected')) { allSelected = false; break; }
  }
  selectAll.textContent = allSelected ? 'Clear All' : 'Select All';
}

function toggleSelectAllSuggestions(btn) {
  var container = btn.parentNode ? btn.parentNode.parentNode : null;
  if (!container) return;
  var btns = container.querySelectorAll('.chat-option-btn.chat-suggest-btn');
  var allSelected = true;
  for (var i = 0; i < btns.length; i++) {
    if (!btns[i].classList.contains('chat-suggest-selected')) { allSelected = false; break; }
  }
  for (var j = 0; j < btns.length; j++) {
    if (allSelected) {
      btns[j].classList.remove('chat-suggest-selected');
      var c1 = btns[j].querySelector('.opt-check');
      if (c1) c1.textContent = '☐';
    } else {
      btns[j].classList.add('chat-suggest-selected');
      var c2 = btns[j].querySelector('.opt-check');
      if (c2) c2.textContent = '☑';
    }
  }
  _rebuildSuggestInput();
  _updateSelectAllButton(container);
}

/* ── Thinking bubble — progress indicator with expandable stream body ── */
function showThinkingBubble(label, hasStreaming) {
  hideThinkingBubble();
  var container = el('chat-messages');
  if (!container) return;
  _thinkingStartTime = Date.now();

  var bubble = document.createElement('div');
  bubble.className = 'chat-msg ai';
  bubble.id = 'thinking-bubble';

  var bodyContent = hasStreaming
    ? '<div class="think-stream-label">Thinking…</div><div class="think-stream" id="think-stream"></div>'
    : '<div class="think-stream-label">Waiting for AI response…</div><div class="think-stream" id="think-stream" style="display:none"></div>';

  bubble.innerHTML =
    '<div class="chat-avatar">🎨</div>' +
    '<div class="think-bubble">' +
      '<div class="think-header" id="think-hdr" style="cursor:pointer">' +
        '<span class="think-icon">⏳</span>' +
        '<span class="chat-thinking-dots"><span></span><span></span><span></span></span>' +
        '<span class="think-label" id="think-label">' + esc(label || 'AI is designing…') + '</span>' +
        '<span class="think-time" id="think-time">0:00</span>' +
        '<span class="think-toggle" id="think-toggle">▶</span>' +
        '<button class="think-cancel" id="think-cancel" title="Stop generation" style="display:none">⏹ Stop</button>' +
      '</div>' +
      '<div class="think-body" id="think-body" style="display:none">' + bodyContent + '</div>' +
    '</div>';

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  _thinkingMsgEl = bubble;

  var hdr = bubble.querySelector('#think-hdr');
  var bodyEl = bubble.querySelector('#think-body');
  var toggleEl = bubble.querySelector('#think-toggle');
  hdr.onclick = function() {
    if (!bodyEl || !toggleEl) return;
    var isOpen = bodyEl.style.display !== 'none';
    bodyEl.style.display = isOpen ? 'none' : 'block';
    toggleEl.textContent = isOpen ? '▶' : '▼';
    container.scrollTop = container.scrollHeight;
  };

  if (hasStreaming) {
    var firstToken = true;
    _streamCallback = function(token) {
      if (firstToken) {
        if (bodyEl) bodyEl.style.display = 'block';
        if (toggleEl) toggleEl.textContent = '▼';
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
        // Tokens are flowing — the AI is genuinely working.
        var idleSec = Math.floor((Date.now() - _lastTokenAt) / 1000);
        lbl.textContent = idleSec < 2
          ? 'AI is generating…' + Array(dots + 1).join('.')
          : 'AI is generating… (last token ' + idleSec + 's ago)';
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
  var timeEl = bubble.querySelector('#think-time');
  if (label) label.textContent = '✓ Complete in ' + (elapsedMs / 1000).toFixed(1) + 's';
  if (dots) dots.style.display = 'none';
  if (icon) icon.textContent = '✅';
  if (cancel) cancel.style.display = 'none';
  var secs = Math.floor(elapsedMs / 1000);
  var mins = Math.floor(secs / 60);
  if (timeEl) timeEl.textContent = mins + ':' + (secs % 60 < 10 ? '0' : '') + (secs % 60);
  var el2 = bubble;
  setTimeout(function() {
    if (el2 && el2.parentNode) {
      el2.style.opacity = '0';
      el2.style.transition = 'opacity 0.5s';
      setTimeout(function() { if (el2.parentNode) el2.parentNode.removeChild(el2); }, 500);
    }
  }, 4000);
}

/* ── Live streaming message — tabbed viewer (💬 / 📄 HTML / 🎨 CSS / ⚙️ JS) ── */
function _buildStreamingTabs(bubble) {
  bubble.innerHTML =
    '<div class="chat-avatar">🎨</div>' +
    '<div>' +
      '<div class="chat-stream-tabs">' +
        '<div class="stream-tab-header">' +
          '<button class="stream-tab-btn active" data-stab="text">💬</button>' +
          '<button class="stream-tab-btn" data-stab="html">📄 HTML</button>' +
          '<button class="stream-tab-btn" data-stab="css">🎨 CSS</button>' +
          '<button class="stream-tab-btn" data-stab="js">⚙️ JS</button>' +
        '</div>' +
        '<div class="stream-tab-panel active" data-stab-panel="text"><pre class="stream-pre"></pre></div>' +
        '<div class="stream-tab-panel" data-stab-panel="html"><pre class="stream-pre"></pre></div>' +
        '<div class="stream-tab-panel" data-stab-panel="css"><pre class="stream-pre"></pre></div>' +
        '<div class="stream-tab-panel" data-stab-panel="js"><pre class="stream-pre"></pre></div>' +
      '</div>' +
      '<div class="chat-msg-time">generating…</div>' +
    '</div>';

  var panels = bubble.querySelectorAll('.stream-tab-panel');
  for (var p = 0; p < panels.length; p++) {
    var panelId = panels[p].getAttribute('data-stab-panel');
    var pre = panels[p].querySelector('.stream-pre');
    if (panelId && pre) _streamTabEls[panelId] = pre;
  }

  var btns = bubble.querySelectorAll('.stream-tab-btn');
  for (var b = 0; b < btns.length; b++) {
    btns[b].onclick = function() {
      var tabId = this.getAttribute('data-stab');
      var allBtns = bubble.querySelectorAll('.stream-tab-btn');
      var allPanels = bubble.querySelectorAll('.stream-tab-panel');
      for (var ab = 0; ab < allBtns.length; ab++) allBtns[ab].classList.remove('active');
      for (var ap = 0; ap < allPanels.length; ap++) allPanels[ap].classList.remove('active');
      this.classList.add('active');
      var panel = bubble.querySelector('.stream-tab-panel[data-stab-panel="' + tabId + '"]');
      if (panel) {
        panel.classList.add('active');
        var p2 = panel.querySelector('.stream-pre');
        if (p2) p2.scrollTop = p2.scrollHeight;
      }
    };
  }

  _streamingMsgEl = bubble;
  _streamCurrentTab = 'text';
  _streamBuf = '';
}

function _beginStreamingMessage() {
  _streamingMsgIdx = DB.chatMessages.length;
  DB.chatMessages.push({
    role: 'ai', text: '', time: new Date().toISOString(),
    userId: 'ai', userName: 'AI Assistant'
  });
  renderChatMessages();
  updateChatBadge();
  var container = el('chat-messages');
  if (container) {
    var bubbles = container.querySelectorAll('.chat-msg.ai');
    var bubble = bubbles[bubbles.length - 1];
    if (bubble) _buildStreamingTabs(bubble);
  }
}

function _appendStreamingToken(token) {
  if (_streamingMsgIdx < 0) return;
  if (_streamingMsgIdx < DB.chatMessages.length) {
    DB.chatMessages[_streamingMsgIdx].text += token;
  }
  // Re-acquire DOM reference if stale (e.g. renderChatMessages rebuilt the chat)
  if (_streamingMsgEl && !_streamingMsgEl.parentNode) {
    _streamingMsgEl = null;
    _streamTabEls = {};
  }
  if (!_streamingMsgEl) {
    var container = el('chat-messages');
    if (container) {
      var bubbles = container.querySelectorAll('.chat-msg.ai');
      if (bubbles.length > 0) {
        var bubble = bubbles[bubbles.length - 1];
        var existingTabs = bubble.querySelector('.chat-stream-tabs');
        if (existingTabs) {
          _streamingMsgEl = bubble;
          var panels = bubble.querySelectorAll('.stream-tab-panel');
          for (var p = 0; p < panels.length; p++) {
            var panelId = panels[p].getAttribute('data-stab-panel');
            var pre = panels[p].querySelector('.stream-pre');
            if (panelId && pre) _streamTabEls[panelId] = pre;
          }
        } else {
          _buildStreamingTabs(bubble);
        }
      }
    }
  }

  // Detect code-block boundaries in the token stream.
  // Handles BOTH marker styles:
  //   A) [HTML] / [CSS] / [JS]   (preferred format)
  //   B) ```html / ```css / ```js / ```javascript  (markdown fences)
  _streamBuf += token;
  var newTab = _streamCurrentTab;
  var fenceDetected = '';
  var splitIdx = -1;

  var hIdx = _streamBuf.indexOf('[HTML]');
  var cIdx = _streamBuf.indexOf('[CSS]');
  var jIdx = _streamBuf.indexOf('[JS]');
  var earliestMarker = '';
  var earliestIdx = Infinity;
  if (hIdx !== -1 && hIdx < earliestIdx) { earliestIdx = hIdx; earliestMarker = 'html'; }
  if (cIdx !== -1 && cIdx < earliestIdx) { earliestIdx = cIdx; earliestMarker = 'css'; }
  if (jIdx !== -1 && jIdx < earliestIdx) { earliestIdx = jIdx; earliestMarker = 'js'; }

  if (earliestMarker && earliestMarker !== _streamCurrentTab) {
    newTab = earliestMarker;
    fenceDetected = 'open-' + earliestMarker;
    var tokenStartInBuf = _streamBuf.length - token.length;
    splitIdx = earliestIdx - tokenStartInBuf;
    if (splitIdx < 0) splitIdx = 0;
  }

  if (!fenceDetected) {
    var mdMatch = _streamBuf.match(/```(html|css|js|javascript)\s*\n/i);
    if (mdMatch) {
      var mdLang = mdMatch[1].toLowerCase();
      var targetTab = mdLang === 'html' ? 'html' : (mdLang === 'css' ? 'css' : 'js');
      if (targetTab !== _streamCurrentTab) {
        newTab = targetTab;
        fenceDetected = 'open-' + targetTab;
        var mdStartInBuf = mdMatch.index;
        var tokenStartInBuf2 = _streamBuf.length - token.length;
        splitIdx = mdStartInBuf - tokenStartInBuf2;
        if (splitIdx < 0) splitIdx = 0;
      }
    }
  }

  // New publicwebsite marker style: === HTML === / === CSS === / === JS === /
  // === SEO === / === PAGE META === (SEO/PAGE META route to the text tab).
  if (!fenceDetected) {
    var eqMatch = _streamBuf.match(/===\s*(HTML|CSS|JS|SEO|PAGE META|CMS CONFIG NEEDED)\s*===/i);
    if (eqMatch) {
      var eqKind = eqMatch[1].toLowerCase();
      var eqTab = (eqKind === 'html' || eqKind === 'css' || eqKind === 'js') ? eqKind : 'text';
      if (eqTab !== _streamCurrentTab) {
        newTab = eqTab;
        fenceDetected = 'open-' + eqTab;
        var eqStartInBuf = eqMatch.index;
        var tokenStartInBufEq = _streamBuf.length - token.length;
        splitIdx = eqStartInBuf - tokenStartInBufEq;
        if (splitIdx < 0) splitIdx = 0;
      }
    }
  }

  if (!fenceDetected && _streamCurrentTab !== 'text') {
    var closeMatch = _streamBuf.match(/\n```\s*$/);
    if (closeMatch) {
      newTab = 'text';
      fenceDetected = 'close';
      var closeStartInBuf = closeMatch.index + 1;
      var tokenStartInBuf3 = _streamBuf.length - token.length;
      splitIdx = closeStartInBuf - tokenStartInBuf3;
      if (splitIdx < 0) splitIdx = 0;
    }
  }

  if (newTab !== _streamCurrentTab && splitIdx >= 0) {
    var beforeMarker = token.substring(0, splitIdx);
    var fromMarker = token.substring(splitIdx);
    if (beforeMarker) {
      var oldPre = _streamTabEls[_streamCurrentTab];
      if (oldPre) {
        oldPre.textContent += beforeMarker;
        var oldDist = oldPre.scrollHeight - oldPre.scrollTop - oldPre.clientHeight;
        if (oldDist < 60) oldPre.scrollTop = oldPre.scrollHeight;
      }
    }
    _streamCurrentTab = newTab;
    _streamBuf = '';
    if (_streamingMsgEl) {
      var allBtns = _streamingMsgEl.querySelectorAll('.stream-tab-btn');
      var allPanels = _streamingMsgEl.querySelectorAll('.stream-tab-panel');
      for (var ab = 0; ab < allBtns.length; ab++) allBtns[ab].classList.remove('active');
      for (var ap = 0; ap < allPanels.length; ap++) allPanels[ap].classList.remove('active');
      var activeBtn = _streamingMsgEl.querySelector('.stream-tab-btn[data-stab="' + _streamCurrentTab + '"]');
      var activePanel = _streamingMsgEl.querySelector('.stream-tab-panel[data-stab-panel="' + _streamCurrentTab + '"]');
      if (activeBtn) activeBtn.classList.add('active');
      if (activePanel) activePanel.classList.add('active');
    }
    var displayText = fromMarker
      .replace(/^\[HTML\]\s*/i, '')
      .replace(/^\[CSS\]\s*/i, '')
      .replace(/^\[JS\]\s*/i, '')
      .replace(/^```(?:html|css|js|javascript)?\s*\n?/i, '')
      .replace(/```\s*$/g, '');
    if (displayText) {
      var newPre = _streamTabEls[_streamCurrentTab];
      if (newPre) {
        newPre.textContent += displayText;
        var newDist = newPre.scrollHeight - newPre.scrollTop - newPre.clientHeight;
        if (newDist < 60) newPre.scrollTop = newPre.scrollHeight;
      }
    }
  } else if (newTab !== _streamCurrentTab) {
    _streamCurrentTab = newTab;
    _streamBuf = '';
    if (_streamingMsgEl) {
      var allBtns2 = _streamingMsgEl.querySelectorAll('.stream-tab-btn');
      var allPanels2 = _streamingMsgEl.querySelectorAll('.stream-tab-panel');
      for (var ab2 = 0; ab2 < allBtns2.length; ab2++) allBtns2[ab2].classList.remove('active');
      for (var ap2 = 0; ap2 < allPanels2.length; ap2++) allPanels2[ap2].classList.remove('active');
      var activeBtn2 = _streamingMsgEl.querySelector('.stream-tab-btn[data-stab="' + _streamCurrentTab + '"]');
      var activePanel2 = _streamingMsgEl.querySelector('.stream-tab-panel[data-stab-panel="' + _streamCurrentTab + '"]');
      if (activeBtn2) activeBtn2.classList.add('active');
      if (activePanel2) activePanel2.classList.add('active');
    }
    var displayText2 = token
      .replace(/^\[HTML\]\s*/i, '')
      .replace(/^\[CSS\]\s*/i, '')
      .replace(/^\[JS\]\s*/i, '')
      .replace(/^===\s*(?:HTML|CSS|JS|SEO|PAGE META|CMS CONFIG NEEDED)\s*===\s*/i, '')
      .replace(/^```(?:html|css|js|javascript)?\s*\n?/i, '');
    if (displayText2) {
      var newPre2 = _streamTabEls[_streamCurrentTab];
      if (newPre2) {
        newPre2.textContent += displayText2;
        var newDist2 = newPre2.scrollHeight - newPre2.scrollTop - newPre2.clientHeight;
        if (newDist2 < 60) newPre2.scrollTop = newPre2.scrollHeight;
      }
    }
  } else {
    var targetPre = _streamTabEls[_streamCurrentTab];
    if (targetPre) {
      targetPre.textContent += token;
      var preDist = targetPre.scrollHeight - targetPre.scrollTop - targetPre.clientHeight;
      if (preDist < 60) targetPre.scrollTop = targetPre.scrollHeight;
    }
  }

  var chatContainer = el('chat-messages');
  if (chatContainer) {
    var distFromBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight;
    if (distFromBottom < 80) chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

/* ── Parse AI response → code sections + SEO + page meta ──
   New publicwebsite contract: === HTML === / === CSS === / === JS === /
   === SEO === (JSON) / === PAGE META === (JSON) / === CMS CONFIG NEEDED ===.
   Legacy [HTML]/[CSS]/[JS] markers and ``` fences are still accepted. ── */
function _parseSection(text, tag) {
  var re = new RegExp('===\\s*' + tag + '\\s*===\\s*([\\s\\S]*?)(?=\\n?===\\s*(?:HTML|CSS|JS|SEO|PAGE META|CMS CONFIG NEEDED|EMAIL TEMPLATE|CHROME|TEMPLATE)\\s*===|$)', 'i');
  var m = re.exec(text || '');
  return m ? m[1].replace(/^\n+|\n+$/g, '').trim() : '';
}
function _parseJsonLenient(s) {
  if (!s) return null;
  var t = String(s).trim();
  try { return JSON.parse(t); } catch (e1) {}
  try {
    t = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'])\/\/.*$/gm, '$1');
    t = t.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(t);
  } catch (e2) { return null; }
}
function parseGeneratedCode(text) {
  var r = { html: '', css: '', js: '', seo: null, pageMeta: null, configNeeded: '', emailTemplate: '' };
  r.html = _parseSection(text, 'HTML');
  r.css = _parseSection(text, 'CSS');
  r.js = _parseSection(text, 'JS');
  r.configNeeded = _parseSection(text, 'CMS CONFIG NEEDED');
  r.emailTemplate = _parseSection(text, 'EMAIL TEMPLATE');
  var seoText = _parseSection(text, 'SEO');
  var metaText = _parseSection(text, 'PAGE META');
  if (seoText) r.seo = _parseJsonLenient(seoText);
  if (metaText) r.pageMeta = _parseJsonLenient(metaText);
  if (!r.html && !r.css && !r.js) {
    // Legacy platform markers
    var hm = text.match(/\[HTML\]\s*([\s\S]*?)(?=\[CSS\]|\[JS\]|$)/i);
    var cm = text.match(/\[CSS\]\s*([\s\S]*?)(?=\[JS\]|$)/i);
    var jm = text.match(/\[JS\]\s*([\s\S]*?)$/i);
    if (hm) r.html = hm[1].trim();
    if (cm) r.css = cm[1].trim();
    if (jm) r.js = jm[1].trim();
    if (!r.html && !r.css && !r.js) {
      var fencePattern = /```(\w*)\s*\n([\s\S]*?)```/g;
      var fm;
      while ((fm = fencePattern.exec(text)) !== null) {
        var lang = (fm[1] || '').toLowerCase();
        var content = fm[2].trim();
        if (lang === 'html' && !r.html) r.html = content;
        else if (lang === 'css' && !r.css) r.css = content;
        else if ((lang === 'js' || lang === 'javascript') && !r.js) r.js = content;
        else if (!lang) {
          if (!r.html) r.html = content;
          else if (!r.css) r.css = content;
          else if (!r.js) r.js = content;
        }
      }
    }
  }
  r.html = _cleanBlockMarkers(r.html);
  r.css = _cleanBlockMarkers(r.css);
  r.js = _cleanBlockMarkers(r.js);
  r.html = _cleanFenceArtifacts(r.html, 'html');
  r.css = _cleanFenceArtifacts(r.css, 'css');
  r.js = _cleanFenceArtifacts(r.js, 'js');
  r.html = _stripTrailingMarkdown(r.html);
  r.css = _stripTrailingMarkdown(r.css);
  r.js = _stripTrailingMarkdown(r.js);
  return r;
}

function _cleanFenceArtifacts(code, lang) {
  if (!code) return '';
  code = code.replace(new RegExp('^```' + lang + '\\s*\\n?', 'i'), '');
  code = code.replace(/^```\s*\n?/, '');
  code = code.replace(/\n?```\s*$/, '');
  return code.trim();
}

/* Strip leftover marker lines — old [HTML]/[/HTML] style and new === HTML ===
   style — some models close blocks with markers and those lines would
   otherwise end up rendered as text in the page. */
function _cleanBlockMarkers(code) {
  if (!code) return '';
  return code
    .replace(/^\s*\[\/?(?:HTML|CSS|JS)\]\s*$/gim, '')
    .replace(/^\s*===\s*(?:HTML|CSS|JS|SEO|PAGE META|CMS CONFIG NEEDED)\s*===\s*$/gim, '')
    .replace(/^\n+|\n+$/g, '').trim();
}

function isCodeLine(line) {
  return /^[\s{}()[\];=<>!+\-*\/&|^~?:.%]/.test(line) ||
    /^(var |function |if |for |while |return |else |try |catch |switch |case |break |continue|new |this\.|document\.|window\.|console\.)/.test(line) ||
    /^(class=|id=|style=|href=|src=|type=|name=|value=|placeholder=|onclick=|onchange=|onsubmit=|aria-|role=|data-)/.test(line) ||
    /^(<\/?[a-zA-Z])/.test(line) ||
    /^[.#@]/.test(line) ||
    /^\s*\/\//.test(line) ||
    /^\s*\/\*/.test(line) ||
    /^[a-zA-Z_$][\w.-]*\s*[=(]/.test(line) ||
    /^(['"`])/.test(line) ||
    /^(--[a-z]|:root|@media|@keyframes)/.test(line);
}

function _stripTrailingMarkdown(code) {
  if (!code) return '';
  var lines = code.split('\n');
  var cutIdx = lines.length;
  for (var i = lines.length - 1; i >= 0; i--) {
    var line = lines[i].trim();
    if (!line) continue;
    if (/^\[\[suggest_/.test(line)) continue;
    if (isCodeLine(line)) { cutIdx = i + 1; break; }
  }
  if (cutIdx >= lines.length) return code.trim();
  return lines.slice(0, cutIdx).join('\n').trim();
}

/* Parse ONE agentic step's response. More forgiving than parseGeneratedCode:
   if no === HTML === / === CSS === / === JS === sections (or legacy blocks)
   were found but the answer contains real markup (bare or fenced), treat it
   as the HTML patch instead of failing. */
function _parseStepOutput(text) {
  var blocks = parseGeneratedCode(text);
  if (blocks.html || blocks.css || blocks.js) return blocks;
  var bare = (text || '')
    .replace(/^\s*```(?:html)?\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .replace(/^\s*\[\/?(?:HTML|CSS|JS)\]\s*$/gim, '')
    .replace(/^\s*===\s*(?:HTML|CSS|JS|SEO|PAGE META|CMS CONFIG NEEDED)\s*===\s*$/gim, '');
  if (/<(section|article|header|footer|aside|nav|div|form|table|ul|ol|figure)\b/i.test(bare)) {
    blocks.html = _stripTrailingMarkdown(bare);
  }
  return blocks;
}

/* ── Split a section into leading code + trailing prose tail ──
   (the AI writes its summary AFTER the [JS] code, so we cut at the
   last code-looking line and keep everything after it as prose) ── */
function _splitCodeAndTail(section) {
  if (!section) return { code: '', tail: '' };
  var lines = section.split('\n');
  var cutIdx = lines.length;
  for (var i = lines.length - 1; i >= 0; i--) {
    var line = lines[i].trim();
    if (!line) continue;
    if (/^\[\[suggest_/.test(line)) continue;
    if (isCodeLine(line)) { cutIdx = i + 1; break; }
  }
  return {
    code: lines.slice(0, cutIdx).join('\n').trim(),
    tail: lines.slice(cutIdx).join('\n').trim()
  };
}

/* ── Extract non-code text from an AI response ──
   Line-by-line state machine (robust against marker/fence mix-ups) PLUS
   a tail-split on the [JS] section so the AI's after-code summary survives. ── */
function extractTextWithoutCode(raw) {
  var text = raw || '';

  // Snag suggestion lines globally — they always live at the very end
  var suggestLines = [];
  var suggestRe = /^\[\[[a-zA-Z0-9_-]+\]\].*$/gm;
  var sm;
  while ((sm = suggestRe.exec(text)) !== null) suggestLines.push(sm[0]);

  // State machine: keep prose outside code blocks
  var lines = text.split('\n');
  var out = [];
  var inCode = false;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var t = line.trim();
    if (/^\[HTML\]/i.test(t) || /^\[CSS\]/i.test(t) || /^\[JS\]/i.test(t)) { inCode = true; continue; }
    if (/^```(html|css|js|javascript)/i.test(t)) { inCode = true; continue; }
    if (t === '```' && inCode) { inCode = false; continue; }
    if (/^\[\[[a-zA-Z0-9_-]+\]\]/.test(t)) continue;
    if (!inCode) out.push(line);
  }

  // Tail-split the [JS] section: prose summary written after the code.
  // Suggestion lines in the tail are dropped here — they are re-appended once below.
  var jm = text.match(/\[JS\]\s*([\s\S]*)$/i);
  if (jm) {
    var split = _splitCodeAndTail(jm[1]);
    if (split.tail) {
      var tailLines = split.tail.split('\n');
      var tailClean = [];
      for (var k = 0; k < tailLines.length; k++) {
        if (!/^\[\[[a-zA-Z0-9_-]+\]\]/.test(tailLines[k].trim())) tailClean.push(tailLines[k]);
      }
      var tailText = tailClean.join('\n').trim();
      if (tailText) out.push(tailText);
    }
  }

  var cleaned = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (suggestLines.length > 0) {
    if (cleaned) cleaned += '\n\n';
    cleaned += suggestLines.join('\n');
  }
  return cleaned;
}

function parseOptionsFromText(text) {
  var options = [];
  var kept = [];
  var lines = (text || '').split('\n');
  for (var i = 0; i < lines.length; i++) {
    var match = lines[i].match(/^\[\[([a-zA-Z0-9_-]+)\]\]\s*(.*)$/);
    if (match) options.push({ id: match[1], text: match[2].trim() || match[1] });
    else kept.push(lines[i]);
  }
  return { text: kept.join('\n').trim(), options: options };
}

function summarizeForHistory(raw) {
  var t = extractTextWithoutCode(raw);
  var parsed = parseOptionsFromText(t);
  var label = (parsed.text || t || 'AI generation').replace(/\n+/g, ' ').trim();
  if (label.length > 90) label = label.substring(0, 90) + '…';
  return label;
}

/* ── Concept-relevant placeholder images ──
   loremflickr.com is a free, keyless keyword image service: the URL keywords
   describe what the photo should show, so every hero/gallery/team image looks
   relevant to its section and to the page concept (real Flickr CC photos).
   We derive keywords from the <img> alt text, then the nearest section id,
   then the detected page type. Old random picsum URLs the model may still
   emit get upgraded to keyword URLs too. `?lock=<n>` keeps each slot's
   image stable and unique. */
var PAGE_TYPE_IMAGES = {
  restaurant: 'food,dish',
  saas: 'technology,computer',
  product: 'product,store',
  portfolio: 'design,creative',
  event: 'concert,audience',
  realestate: 'architecture,house',
  company: 'office,business',
  general: 'business'
};

var SECTION_IMAGES = {
  testimonials: 'portrait,people',
  team: 'portrait,people',
  staff: 'portrait,people',
  menu: 'food,dish',
  chef: 'chef,food',
  contact: 'map,city',
  locations: 'map,city',
  hours: 'map,city',
  events: 'concert,audience',
  sponsors: 'logo,design',
  products: 'product,store'
};

/* Alt-text words → search keywords for the image library. */
var _ALT_KEYWORDS = {
  food: 'food', dish: 'food', plate: 'food', meal: 'food', dinner: 'food', lunch: 'food', breakfast: 'food', cuisine: 'food', restaurant: 'restaurant', pizza: 'food', burger: 'food', dessert: 'food',
  coffee: 'coffee', cafe: 'coffee', espresso: 'coffee', tea: 'coffee',
  chef: 'chef', kitchen: 'chef', cook: 'chef', cooking: 'chef', bakery: 'food',
  team: 'people', staff: 'people', people: 'people', person: 'people', member: 'people', members: 'people', founder: 'people', founders: 'people', employee: 'people', employees: 'people', crew: 'people',
  customer: 'people', customers: 'people', client: 'people', clients: 'people', guest: 'people', guests: 'people', visitor: 'people', visitors: 'people', community: 'community', volunteer: 'community', volunteers: 'community', donation: 'community', charity: 'community',
  portrait: 'portrait', face: 'portrait', headshot: 'portrait', woman: 'portrait', man: 'portrait', women: 'portrait', men: 'portrait', speaker: 'portrait', speakers: 'portrait', author: 'portrait', doctor: 'portrait', teacher: 'portrait',
  office: 'office', workspace: 'office', desk: 'office', meeting: 'office', coworking: 'office', corporate: 'business',
  technology: 'technology', computer: 'technology', laptop: 'technology', software: 'technology', app: 'technology', dashboard: 'technology', code: 'technology', data: 'technology', digital: 'technology', robot: 'technology',
  city: 'city', skyline: 'city', downtown: 'city', street: 'city', urban: 'city', map: 'map', location: 'map', address: 'map',
  house: 'architecture', home: 'architecture', building: 'architecture', property: 'architecture', properties: 'architecture', apartment: 'architecture', estate: 'architecture', villa: 'architecture', room: 'interior', interior: 'interior',
  nature: 'nature', landscape: 'nature', mountain: 'nature', mountains: 'nature', forest: 'nature', beach: 'nature', garden: 'nature', flower: 'nature', flowers: 'nature', park: 'nature', sunset: 'nature', lake: 'nature',
  event: 'concert', concert: 'concert', audience: 'concert', stage: 'concert', music: 'concert', festival: 'concert', party: 'concert', crowd: 'concert', show: 'concert', conference: 'conference',
  product: 'product', products: 'product', shop: 'store', store: 'store', shopping: 'store', sale: 'store', boutique: 'store', merchandise: 'store',
  fashion: 'fashion', clothes: 'fashion', clothing: 'fashion', shoes: 'fashion', jewelry: 'fashion', watch: 'fashion', style: 'fashion',
  design: 'design', creative: 'design', art: 'art', artist: 'art', gallery: 'art', portfolio: 'design', logo: 'design', brand: 'design',
  car: 'car', cars: 'car', vehicle: 'car', bus: 'bus', truck: 'truck', transportation: 'car',
  travel: 'travel', vacation: 'travel', hotel: 'hotel', resort: 'resort', destination: 'travel', trip: 'travel',
  fitness: 'fitness', gym: 'gym', sport: 'sport', sports: 'sport', workout: 'fitness', yoga: 'fitness',
  book: 'book', books: 'book', library: 'library', school: 'school', education: 'school', student: 'school', students: 'school', university: 'school', classroom: 'school',
  kids: 'kids', kid: 'kids', child: 'kids', children: 'kids', family: 'family', baby: 'baby',
  health: 'health', medical: 'medical', hospital: 'hospital', clinic: 'medical',
  business: 'business', finance: 'business', money: 'finance', startup: 'business', economy: 'business',
  farm: 'farm', agriculture: 'farm', harvest: 'farm'
};

function _deriveImageKeywords(htmlCode, offset, altText, typeKws) {
  // 1) alt-text words → mapped keywords (most reliable signal)
  if (altText) {
    var words = String(altText).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
    var kws = [];
    for (var i = 0; i < words.length && kws.length < 2; i++) {
      var w = words[i];
      var mapped = _ALT_KEYWORDS[w];
      if (mapped && kws.indexOf(mapped) === -1) kws.push(mapped);
    }
    if (kws.length) return kws.join(',');
  }
  // 2) nearest preceding section id (e.g. <section id="gw-team">)
  var before = (htmlCode || '').substring(Math.max(0, offset - 2000), offset);
  var idRe = /\bid\s*=\s*["']([^"']+)["']/gi;
  var mm, lastId = '';
  while ((mm = idRe.exec(before)) !== null) lastId = String(mm[1]).toLowerCase();
  if (lastId) {
    for (var key in SECTION_IMAGES) {
      if (Object.prototype.hasOwnProperty.call(SECTION_IMAGES, key) && lastId.indexOf(key) !== -1) return SECTION_IMAGES[key];
    }
    var idWords = lastId.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
    var idKws = [];
    for (var j = 0; j < idWords.length && idKws.length < 2; j++) {
      var mappedId = _ALT_KEYWORDS[idWords[j]];
      if (mappedId && idKws.indexOf(mappedId) === -1) idKws.push(mappedId);
    }
    if (idKws.length) return idKws.join(',');
  }
  // 3) detected page type (concept-level fallback)
  return typeKws;
}

function _kwImageUrl(keywords, w, h, n) {
  var maxW = Math.min(parseInt(w, 10) || 800, 1200);
  var maxH = Math.min(parseInt(h, 10) || 600, 900);
  var lock = ((n - 1) % 10) + 1; // first image → lock=1
  return 'https://loremflickr.com/' + maxW + '/' + maxH + '/' + keywords + '?lock=' + lock;
}

/* Fill missing <img> src attributes (and upgrade old random picsum URLs) with
   concept-relevant loremflickr keyword images so the design never shows
   broken/irrelevant images. */
function _ensureImageSrcs(htmlCode) {
  if (!htmlCode) return htmlCode;
  var typeKws = PAGE_TYPE_IMAGES[_detectPageType(htmlCode)] || PAGE_TYPE_IMAGES.general;
  var n = 0;
  return htmlCode.replace(/<img\b([^>]*)>/gi, function(full, attrs, offset) {
    var sm = /\bsrc\s*=\s*["']([^"']*)["']/i.exec(attrs);
    var src = sm ? sm[1] : '';
    n += 1;
    // Keep real URLs (media library, user-provided, data:) untouched. Only
    // missing/blank srcs and old random picsum placeholders get replaced.
    var isPlaceholder = !src || /^about:blank$/i.test(src) || src.indexOf('picsum.photos') !== -1;
    if (!isPlaceholder) return full;
    var wm = attrs.match(/\bwidth\s*=\s*["']?(\d+)/i);
    var hm = attrs.match(/\bheight\s*=\s*["']?(\d+)/i);
    var am = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i);
    var w = wm ? wm[1] : '800';
    var h = hm ? hm[1] : '600';
    var kws = _deriveImageKeywords(htmlCode, offset, am ? am[1] : '', typeKws);
    var url = _kwImageUrl(kws, w, h, n);
    var cleanAttrs = attrs.replace(/\s+src\s*=\s*["'][^"']*["']/i, '');
    return '<img' + cleanAttrs + ' src="' + url + '">';
  });
}

/* ── Apply generated code ── */
/* ── JS auto-repair for common LLM quirks ──
   Python-flavored models (e.g. DeepSeek) sometimes emit markdown-bold lines
   and Python-style `**` operators inside the [JS] block. A line that STARTS
   with `**` is a SyntaxError in every engine ("Unexpected token '**'") and
   kills that whole script block; `a ** b` is also invalid in pre-ES2016
   engines/webviews. We repair both so the preview console stays clean. */
var _lastJsFixCount = 0;
function _sanitizeJs(js) {
  if (!js) return { code: js || '', fixed: 0 };
  var lines = String(js).split('\n');
  var out = [];
  var fixed = 0;
  var inBlockComment = false;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (inBlockComment) {
      if (line.indexOf('*/') !== -1) inBlockComment = false;
      out.push(line);
      continue;
    }
    if (line.indexOf('/*') !== -1 && line.indexOf('*/') === -1) inBlockComment = true;
    var indent = line.match(/^[ \t]*/)[0];
    var t = line.substring(indent.length);
    if (t.indexOf('**') === 0) {
      // Markdown-bold separator line ("** Section 2 **") → turn it into a comment.
      out.push(indent + '// ' + t.replace(/^\*\*/, '').replace(/\*\*$/, '').replace(/^\s+|\s+$/g, ''));
      fixed++;
      continue;
    }
    // Python-style exponentiation a ** b → Math.pow(a, b) for simple operands.
    // Guarded so it never rewrites text inside strings or member access (obj.prop).
    var changed = line.replace(/(^|[^A-Za-z0-9_$\."'])([A-Za-z_$][A-Za-z0-9_$]*|\d+(?:\.\d+)?)\s*\*\*\s*(-?\d+(?:\.\d+)?|[A-Za-z_$][A-Za-z0-9_$]*)/g, '$1Math.pow($2, $3)');
    if (changed !== line) fixed++;
    out.push(changed);
  }
  return { code: out.join('\n'), fixed: fixed };
}

function applyGeneratedCode(code) {
  _aiJustUpdated = true;
  code.html = _ensureImageSrcs(code.html || '');
  code.js = _sanitizeJs(code.js || '').code;
  var changed = DB.code.html !== (code.html || '') || DB.code.css !== (code.css || '') || DB.code.js !== (code.js || '');
  if (code.seo && typeof code.seo === 'object') {
    var seoJson = JSON.stringify(code.seo);
    if (JSON.stringify(DB.seo || null) !== seoJson) { DB.seo = code.seo; changed = true; }
  }
  if (code.pageMeta && typeof code.pageMeta === 'object') {
    var metaJson = JSON.stringify(code.pageMeta);
    if (JSON.stringify(DB.pageMeta || null) !== metaJson) { DB.pageMeta = code.pageMeta; changed = true; }
  }
  if (code.configNeeded && String(code.configNeeded).trim() !== String(DB.configNeeded || '').trim()) {
    DB.configNeeded = String(code.configNeeded).trim();
    changed = true;
  }
  if (code.emailTemplate && String(code.emailTemplate).trim() !== String(DB.emailTemplate || '').trim()) {
    DB.emailTemplate = String(code.emailTemplate).trim();
    changed = true;
  }
  DB.code.html = code.html || '';
  DB.code.css = code.css || '';
  DB.code.js = code.js || '';
  if (changed) {
    _bumpVersion('minor');
    _addHistoryEntry({
      version: DB.version,
      time: new Date().toISOString(),
      label: summarizeForHistory(_lastRawResponse || 'AI update'),
      html: DB.code.html, css: DB.code.css, js: DB.code.js
    });
  }
  displayAllCode(DB.code);
  persist();
  renderSections();
  updatePreview();
  runComplianceChecks();
  if (el('editor-compliance').classList.contains('active')) renderCompliance();
  switchTab('preview');
  try { tool.notify('💾 Saved — page v' + DB.version + ' is stored in this record', 'success'); } catch (e) {}
}

/* ── Visual line diff (jsdiff CDN with fallback) — developers only ── */
function computeUnifiedDiff(oldCode, newCode) {
  if (typeof diff === 'undefined' || !diff.diffLines) {
    var oldLines = (oldCode || '').split('\n');
    var newLines = (newCode || '').split('\n');
    var result = [];
    var max = Math.max(oldLines.length, newLines.length);
    for (var i = 0; i < max; i++) {
      var ol = i < oldLines.length ? oldLines[i] : null;
      var nl = i < newLines.length ? newLines[i] : null;
      if (ol === nl) result.push({ type: 'same', text: ol || '' });
      else if (ol === null && nl !== null) result.push({ type: 'add', text: nl });
      else if (nl === null && ol !== null) result.push({ type: 'remove', text: ol });
      else { result.push({ type: 'remove', text: ol }); result.push({ type: 'add', text: nl }); }
    }
    return result;
  }
  var changes = diff.diffLines(oldCode || '', newCode || '');
  var result = [];
  for (var i = 0; i < changes.length; i++) {
    var change = changes[i];
    var lines = change.value.replace(/\n$/, '').split('\n');
    var type;
    if (change.added) type = 'add';
    else if (change.removed) type = 'remove';
    else type = 'same';
    for (var j = 0; j < lines.length; j++) {
      if (lines[j] !== '' || j < lines.length - 1 || change.value === '\n') {
        result.push({ type: type, text: lines[j] });
      }
    }
  }
  return result;
}

function buildDiffTabs(diffs) {
  var tabs = [
    { id: 'html', icon: '📄', label: 'HTML', diff: diffs.html, added: diffs.stats.html.added, removed: diffs.stats.html.removed },
    { id: 'css', icon: '🎨', label: 'CSS', diff: diffs.css, added: diffs.stats.css.added, removed: diffs.stats.css.removed },
    { id: 'js', icon: '⚙️', label: 'JS', diff: diffs.js, added: diffs.stats.js.added, removed: diffs.stats.js.removed }
  ];
  var html = '<div class="chat-diff-tabs" data-diff-id="' + diffs._id + '">';
  html += '<div class="chat-diff-tab-header">';
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i];
    var stat = '';
    if (t.added > 0) stat += ' +' + t.added;
    if (t.removed > 0) stat += ' −' + t.removed;
    if (!stat) stat = ' unchanged';
    html += '<button class="diff-tab-btn' + (i === 0 ? ' active' : '') + '" data-diff-tab="' + t.id + '" data-diff-id="' + diffs._id + '">' +
      t.icon + ' ' + t.label + '<br><small style="font-weight:400;font-size:9px">' + stat + '</small></button>';
  }
  html += '</div>';
  for (var j = 0; j < tabs.length; j++) {
    var tb = tabs[j];
    html += '<div class="chat-diff-tab-body' + (j === 0 ? ' active' : '') + '" data-diff-panel="' + tb.id + '" data-diff-id="' + diffs._id + '">';
    if (!tb.diff || !tb.diff.length) {
      html += '<div class="chat-diff-line diff-same">(no changes)</div>';
    } else {
      for (var k = 0; k < tb.diff.length; k++) {
        var line = tb.diff[k];
        var cls = 'chat-diff-line diff-' + line.type;
        var prefix = line.type === 'add' ? '+ ' : (line.type === 'remove' ? '− ' : '  ');
        html += '<div class="' + cls + '">' + prefix + esc(line.text) + '</div>';
      }
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function handleDiffTabClick(btn) {
  var tabId = btn.getAttribute('data-diff-tab');
  var diffId = btn.getAttribute('data-diff-id');
  var header = btn.parentNode;
  if (header) {
    var allBtns = header.querySelectorAll('.diff-tab-btn');
    for (var i = 0; i < allBtns.length; i++) allBtns[i].classList.remove('active');
  }
  btn.classList.add('active');
  var container = btn.closest ? btn.closest('.chat-diff-tabs') : null;
  if (container) {
    var panels = container.querySelectorAll('.chat-diff-tab-body');
    for (var j = 0; j < panels.length; j++) {
      var p = panels[j];
      if (p.getAttribute('data-diff-panel') === tabId && p.getAttribute('data-diff-id') === diffId) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    }
  }
}

var _lastRawResponse = '';

function processAIResponse(raw, hasCode) {
  _lastRawResponse = raw || '';
  var code = parseGeneratedCode(raw);
  var hasNewCode = !!(code.html || code.css || code.js);
  var textOnly = extractTextWithoutCode(raw);
  var parsed = parseOptionsFromText(textOnly);
  var extra = { options: parsed.options };
  if (hasNewCode) {
    // Snapshot old code BEFORE applying (for the visual diff)
    var oldHtmlBefore = hasCode ? DB.code.html : '';
    var oldCssBefore = hasCode ? DB.code.css : '';
    var oldJsBefore = hasCode ? DB.code.js : '';
    // Code arrived — turn off guided interview mode if it was on
    if (interviewMode) {
      interviewMode = false;
      var btn = el('btn-guided-mode');
      if (btn) { btn.classList.remove('active'); btn.textContent = '🪄 Guided'; }
    }
    // Fallback suggestions when the AI didn't include any
    if (!parsed.options.length) {
      var fb = _generateFallbackSuggestions();
      if (fb) {
        parsed.text = (parsed.text ? parsed.text + '\n\n' : '') + fb;
        parsed = parseOptionsFromText(parsed.text);
        extra.options = parsed.options;
      }
    }
    applyGeneratedCode(code);
    if (DB.version) extra.version = DB.version;
    extra.compliance = _complianceSummary(_complianceResults || runComplianceChecks());

    // Developer visual diff of what changed (old → new, per block)
    if (hasCode && isDeveloper()) {
      var dHtml = computeUnifiedDiff(oldHtmlBefore, DB.code.html);
      var dCss = computeUnifiedDiff(oldCssBefore, DB.code.css);
      var dJs = computeUnifiedDiff(oldJsBefore, DB.code.js);
      var countStats = function(diff) {
        var a = 0, r = 0;
        for (var di = 0; di < diff.length; di++) {
          if (diff[di].type === 'add') a++;
          else if (diff[di].type === 'remove') r++;
        }
        return { added: a, removed: r };
      };
      var diffData = {
        _id: 'd' + Date.now().toString(36),
        html: dHtml, css: dCss, js: dJs,
        stats: { html: countStats(dHtml), css: countStats(dCss), js: countStats(dJs) }
      };
      var totalChanges = diffData.stats.html.added + diffData.stats.html.removed +
                         diffData.stats.css.added + diffData.stats.css.removed +
                         diffData.stats.js.added + diffData.stats.js.removed;
      if (totalChanges > 0) {
        extra.diffHtml = buildDiffTabs(diffData);
      } else {
        extra.diffHtml = '<p style="font-size:11px;color:var(--text3);margin-top:6px">📊 <b>Changes:</b> (no significant line changes detected)</p>';
      }
    } else if (hasCode && !isDeveloper()) {
      var oldTotal2 = oldHtmlBefore.length + oldCssBefore.length + oldJsBefore.length;
      var newTotal2 = DB.code.html.length + DB.code.css.length + DB.code.js.length;
      if (oldTotal2 !== newTotal2) {
        extra.diffHtml = '<p style="font-size:11px;color:var(--text3);margin-top:6px">📊 <b>Code updated</b> — see the Preview tab for changes.</p>';
      }
    }
  }
  var finalText = parsed.text;
  if (code.configNeeded && String(code.configNeeded).trim()) {
    finalText = (finalText ? finalText + '\n\n' : '') +
      '🛠️ **CMS CONFIG NEEDED** (for the CMS author — create these in the site app):\n' +
      '```\n' + String(code.configNeeded).trim() + '\n```';
  }
  if (code.emailTemplate && String(code.emailTemplate).trim()) {
    finalText = (finalText ? finalText + '\n\n' : '') +
      '📧 **EMAIL TEMPLATE captured** (used by email hooks — full document allowed here):\n' +
      '```\n' + String(code.emailTemplate).trim() + '\n```';
  }
  if (!finalText) finalText = hasNewCode ? '✓ Page updated.' : '⚠️ I couldn\'t produce code for that. Please try rephrasing your request.';
  addChatMessage('ai', finalText, extra);
  autoTitleSession();
}

/* ── Fallback next-step suggestions when the AI omits them ── */
function _generateFallbackSuggestions() {
  var all = [
    { id: 'suggest_darkmode', text: 'Add dark mode toggle' },
    { id: 'suggest_animations', text: 'Add scroll-reveal animations' },
    { id: 'suggest_testimonials', text: 'Add a testimonials section' },
    { id: 'suggest_gallery', text: 'Add a photo gallery section' },
    { id: 'suggest_faq', text: 'Add an FAQ section' },
    { id: 'suggest_cta', text: 'Add a call-to-action band' },
    { id: 'suggest_mobile', text: 'Improve the mobile experience' },
    { id: 'suggest_hero', text: 'Make the hero section more impactful' },
    { id: 'suggest_colors', text: 'Refine the color palette' }
  ];
  for (var i = all.length - 1; i > 0; i--) {
    var ri = Math.floor(Math.random() * (i + 1));
    var tmp = all[i]; all[i] = all[ri]; all[ri] = tmp;
  }
  var picked = all.slice(0, 4);
  var lines = [];
  for (var j = 0; j < picked.length; j++) {
    lines.push('[[' + picked[j].id + ']] ' + picked[j].text);
  }
  return lines.join('\n');
}

/* ── Thinking depth directive (prompt-level steering for reasoning models) ── */
function _thinkingDirective() {
  var level = (_p('thinkingLevel', 'balanced') || 'balanced').toLowerCase();
  if (level === 'deep') return 'DEEP thinking: reason step by step about the page structure, the copy and the rules compliance BEFORE writing any code. Produce your most carefully considered design.';
  if (level === 'quick') return 'QUICK thinking: be concise and efficient — minimal preamble, go straight to clean, complete code.';
  return 'BALANCED thinking: give the design a reasonable amount of reasoning, then produce clean, complete code.';
}

/* ── Skills: curated expert prompt packs (like Claude Code skills) ──
   Each skill injects compact expert instructions into every AI prompt when
   it is active. Users toggle them in the Suggestions tab; admin params can
   set defaults (skills: creative,a11y,…). */
var SKILLS = [
  { id: 'creative', name: 'Creative Design', icon: '🎨', hint: 'Expressive typography, gradients, glassmorphism, micro-animations.', body: 'SKILL — Creative Web Design:\n- Design with visual flair: layered gradients, glassmorphism cards, expressive display typography, generous whitespace.\n- Fluid type scale with clamp() and a consistent 8px spacing rhythm.\n- Subtle entrance animations with IntersectionObserver (fade-up, stagger) and hover micro-interactions.\n- CSS-only effects where possible; JS reserved for real logic.' },
  { id: 'a11y', name: 'Accessibility', icon: '♿', hint: 'WCAG contrast, keyboard focus, ARIA, reduced-motion support.', body: 'SKILL — Accessibility (WCAG 2.1 AA):\n- Text contrast at least 4.5:1; UI component contrast at least 3:1; visible focus rings.\n- Semantic landmarks, one logical heading order, aria-label on icon-only controls.\n- Every interactive element keyboard-reachable; respect prefers-reduced-motion; form fields have <label>.' },
  { id: 'seo', name: 'SEO Ready', icon: '🔍', hint: 'Semantic structure, heading hierarchy, descriptive alt text.', body: 'SKILL — SEO-Friendly Structure:\n- One keyword-rich <h1>; logical h2/h3 hierarchy; semantic <section>/<article>.\n- Descriptive alt text with natural keywords; no keyword stuffing.\n- Content-first layout: key copy near the top; lazy-load below-the-fold images (loading="lazy").' },
  { id: 'nonprofit', name: 'Nonprofit', icon: '🤝', hint: 'Donation CTAs with impact levels, stories, volunteer signup.', body: 'SKILL — Nonprofit / Fundraising:\n- Donation call-to-action with suggested amounts tied to impact ($25 feeds 5 families).\n- Impact stats, success stories and a volunteer signup.\n- Emotional but authentic storytelling; a short transparency note.' },
  { id: 'luxury', name: 'Luxury Aesthetic', icon: '✨', hint: 'Elegant serif, dark + gold palette, refined motion.', body: 'SKILL — Luxury Aesthetic:\n- Elegant serif display type, deep palette with gold/brass accents and fine lines.\n- Large imagery, restrained motion, generous spacing; no bright candy colors.\n- Premium copy: short, confident, evocative.' },
  { id: 'playful', name: 'Playful Aesthetic', icon: '🎈', hint: 'Bright palette, chunky type, bouncy animations, fun copy.', body: 'SKILL — Playful / Bold Aesthetic:\n- Bright palette, chunky rounded type, rotated stickers and organic shapes.\n- Bouncy animations and friendly micro-copy.\n- Keep strong contrast and clear hierarchy so it stays legible.' },
  { id: 'minimal', name: 'Minimal Aesthetic', icon: '⬜', hint: 'Monochrome, whitespace, editorial typography, one accent.', body: 'SKILL — Minimal / Editorial Aesthetic:\n- Monochrome palette, big whitespace, one accent color only.\n- Editorial typography (light weights, tight tracking) and thin dividers.\n- Content-first: no decorative clutter; crisp grid alignment.' },
  { id: 'copy', name: 'Great Copy', icon: '✍️', hint: 'Real, specific copy — no lorem ipsum, benefits before features.', body: 'SKILL — Copywriting:\n- Write real, specific copy: no lorem ipsum, no generic filler.\n- Benefits before features; short scannable lines; active voice.\n- Match the page language; keep headings under 8 words.' }
];

/* ── Page-type playbooks: expert patterns per detected page type.
   These are NOT skills — they are auto-injected into the prompts whenever
   the page content matches the type (no chips, no toggles). ── */
var PAGE_TYPE_PLAYBOOKS = {
  restaurant: 'PAGE TYPE — Restaurant / Café:\n- Sensory dish copy; menu grouped by category (starters / mains / desserts) with prices and dietary badges (V, GF).\n- Warm hospitality tone; a clear reservation call-to-action repeated naturally.\n- Widgets: menu island (data-gw-app="menu") + cart + checkout-flow {flowId} for ordering — emit === CMS CONFIG NEEDED === for the flow/operation.\n- Imagery: food, dish, coffee, interior (use matching loremflickr keywords).',
  saas: 'PAGE TYPE — SaaS Landing:\n- Hero with a value proposition and one primary CTA; social proof strip.\n- Feature/benefit framing (outcomes, not specs); 3-tier pricing with a highlighted plan.\n- One CTA per section, repeated; objection-handling FAQ near the bottom.\n- Forms: signup/contact via data-gw-form + honeypot (formTypeId noted in === CMS CONFIG NEEDED ===).\n- Imagery: technology, computer, office (use matching loremflickr keywords).',
  product: 'PAGE TYPE — Online Store:\n- Product cards with photo, price badge, sale tag and star rating in a consistent grid.\n- Category/browse structure; wishlist and quick-view (client-side only).\n- Trust and urgency near every buy action: stock hints, guarantee badges, reviews.\n- Commerce: menu island (addToCart) + cart + checkout-flow {flowId} with a create-order done-step operation — emit === CMS CONFIG NEEDED ===.\n- Imagery: product, store, fashion (use matching loremflickr keywords).',
  event: 'PAGE TYPE — Event / Conference:\n- Hero with event name, date, venue and a live countdown.\n- Agenda as 3-column day tabs or a timeline; speakers grid with photos and topics.\n- Registration form with ticket types; urgency copy (Early bird ends…).\n- Booking: slot-picker or seat-map islands + checkout-flow (amountFormula over chosen values) + done-step operation hook — emit === CMS CONFIG NEEDED ===.\n- Imagery: concert, audience, stage (use matching loremflickr keywords).',
  realestate: 'PAGE TYPE — Real Estate Listings:\n- Property cards with photo, price badge and beds/baths/area meta.\n- Search/filter row (location, type, price) filtering listings client-side.\n- Neighborhood highlights, agent cards and a contact call-to-action.\n- Data: gw.db.query listings from a public object type (register it in the site app); slot-picker island for viewings.\n- Imagery: architecture, house, interior (use matching loremflickr keywords).',
  portfolio: 'PAGE TYPE — Portfolio Showcase:\n- Case-study layout: large project cards with image, title, category and year.\n- Skills chips, experience timeline and client logos.\n- Strong personal voice; a prominent contact call-to-action.\n- Contact form via data-gw-form + honeypot (formTypeId noted in === CMS CONFIG NEEDED ===).\n- Imagery: design, creative, art (use matching loremflickr keywords).',
  company: 'PAGE TYPE — Corporate Profile:\n- Mission/vision, values grid, leadership team and a milestones timeline.\n- Stats band (years, clients, projects), client logos, CSR mention.\n- Trustworthy, structured tone; generous whitespace.\n- Contact/career forms via data-gw-form + honeypot (formTypeId noted in === CMS CONFIG NEEDED ===).\n- Imagery: office, business, people (use matching loremflickr keywords).'
};
function _pageTypeBlock() {
  var t = _detectPageType(DB.code.html || '');
  if (!PAGE_TYPE_PLAYBOOKS[t]) return '';
  return '=== PAGE TYPE PLAYBOOK (auto-detected from your content — apply these expert patterns) ===\n' + PAGE_TYPE_PLAYBOOKS[t];
}
var _activeSkills = {};    // manually enabled skills (persisted)
function _loadSkills() {
  _activeSkills = {};
  try {
    var saved = localStorage.getItem('wb_skills');
    if (saved) { var parsed = JSON.parse(saved); if (parsed && typeof parsed === 'object') _activeSkills = parsed; }
  } catch (e) {}
  var def = (_p('skills', '') || '').split(',');
  for (var i = 0; i < def.length; i++) {
    var id = def[i].replace(/^\s+|\s+$/g, '');
    if (id) _activeSkills[id] = true;
  }
  _saveSkills();
}
function _saveSkills() {
  try { localStorage.setItem('wb_skills', JSON.stringify(_activeSkills)); } catch (e) {}
}
function _toggleSkill(id) {
  _activeSkills[id] = !_activeSkills[id];
  _saveSkills();
  renderSkillChips();
  renderParamsSummary();
  showToast('Skill ' + id + (_activeSkills[id] ? ' enabled' : ' disabled'), 'info');
}
function _skillById(id) {
  for (var i = 0; i < SKILLS.length; i++) if (SKILLS[i].id === id) return SKILLS[i];
  return null;
}
function _activeSkillIds() {
  var a = [];
  for (var i = 0; i < SKILLS.length; i++) if (_activeSkills[SKILLS[i].id]) a.push(SKILLS[i].id);
  return a;
}
function _skillsBlock() {
  var ids = _activeSkillIds();
  if (!ids.length) return '';
  var lines = ['=== ACTIVE SKILLS (expert instructions — apply them to this page) ==='];
  for (var i = 0; i < ids.length; i++) {
    var s = _skillById(ids[i]);
    if (s) lines.push(s.body);
  }
  return lines.join('\n');
}
function renderSkillChips() {
  var row = el('skills-row');
  if (!row) return;
  var h = '';
  for (var i = 0; i < SKILLS.length; i++) {
    var s = SKILLS[i];
    var on = !!_activeSkills[s.id];
    h += '<button class="skill-chip' + (on ? ' on' : '') + '" data-skill="' + s.id + '" onclick="_toggleSkill(\'' + s.id + '\')" title="' + esc(s.hint) + '">' + s.icon + ' ' + esc(s.name) + '</button>';
  }
  row.innerHTML = h;
}

/* ── Prompt builders ── */
function buildSettingsSummary() {
  var parts = [
    '=== DESIGN DIRECTION (admin parameters — shared across pages) ===',
    'Color scheme: ' + _p('colorScheme', 'indigo'),
    'Typography: ' + _p('typography', 'modern-sans'),
    'Language: ' + _p('lang', 'en'),
    'Thinking depth: ' + _p('thinkingLevel', 'balanced'),
    'Active skills: ' + (_activeSkillIds().join(', ') || 'none'),
    '',
    '=== PAGE STRUCTURE GUIDANCE ===',
    '- The platform injects your output into a page container between the site header/footer — output a BODY FRAGMENT only. Never emit <html>/<head>/<body>/<!DOCTYPE> tags.',
    '- Site chrome (header/footer) is platform-rendered — never generate your own global nav/header/footer.',
    '- Page sections are decided per request in chat — never apply a fixed default section list.',
    '- REUSABLE SECTIONS: a page may declare data.sections (flat, ordered, max 20) of {cmsObjectType, objectId} refs — the platform composes them BEFORE the page\'s own html. Use for shared strips (promo bars, CTAs, social proof, disclaimers). Sections contribute html/css/js only — no SEO, no chrome.',
    '- TEMPLATE PAGES: for one-template-many-objects flows, set data.templateContentType in === PAGE META ===. LAYOUT lives in the template page, DATA in content objects (read via gw.getPageParams() + gw.db.get). Content objects may override with their own htmlPage.',
    '- WIDGETS: prefer islands over hand-coding — menu, cart, checkout-flow, slot-picker, seat-map, account-dashboard, rewards, order-status, search-box and the no-code `list` widget (config-only reads rendered as inert text).',
    '- CSS is injected GLOBALLY: scope EVERY rule under one unique page class (e.g. .shop-home). The gw- prefix is RESERVED for the platform/sharedCss — you may USE --gw-color-* variables and gw-shared-* classes but NEVER define gw-* rules. Never style bare html/body/*/a/button/h1.',
    '- JS re-runs on every visit and every SPA navigation: idempotent (IIFE + guards for window/document listeners), vanilla only, no top-level await, no external <script src>. Attach page helpers to gw.ns (fresh per visit) — never rely on hoisted window functions.',
    '- Theme: use --gw-color-* CSS variables; default-settings.sharedCss provides site-level classes. Format money with gw.formatCurrency.',
    '- FORMS: data-gw-form + gw.forms.bind() + honeypot (gw_hp/website/company reserved) + [data-gw-form-status]. Never auto-submit on load.',
    '- WRITES: never raw — operations (gw.db.operation), flows, forms or cart only. If an operation/flow/email hook is missing, STILL generate the page and append === CMS CONFIG NEEDED === (add === EMAIL TEMPLATE === with {{key}} placeholders when the note asks for an email hook).',
    '- Imagery: external absolute URLs are fine. Use https://loremflickr.com/<width>/<height>/<keyword1,keyword2> placeholders whose keywords describe the photo (restaurant → food,dish; team → portrait,people). Keep alt/width/height/loading on every <img>.',
    '- SEO comes from your === SEO === section (metaTitle/metaDesc/schemaItems…) — never emit <title>/<meta> tags inside the code. The platform injects its own trace comment — never emit GW-PAGE-ID-style comments.'
  ];
  var skills = _skillsBlock();
  if (skills) { parts.push(''); parts.push(skills); }
  return parts.join('\n');
}

function buildChatPrompt(userMsg) {
  var hasCode = !!(DB.code.html || DB.code.css || DB.code.js);

  if (interviewMode && !hasCode) {
    var iparts = [buildInterviewSystemPrompt()];
    iparts.push('');
    iparts.push('=== CONVERSATION HISTORY ===');
    for (var i = 0; i < DB.chatMessages.length; i++) {
      var m = DB.chatMessages[i];
      iparts.push((m.role === 'user' ? 'USER' : 'AI') + ': ' + m.text);
    }
    iparts.push('');
    iparts.push('Continue the interview. Ask the next question. If enough info gathered (4+ answers), summarize and offer to build.');
    iparts.push('');
    iparts.push('=== PUBLICWEBSITE PAGE RULES (for when you generate code) ===');
    iparts.push(getActiveRules());
    iparts.push('');
    iparts.push('If the user confirms they want the page built, output === HTML === / === CSS === / === JS === / === SEO === / === PAGE META === sections following ALL rules above.');
    return iparts.join('\n');
  }

  var parts = ['You are designing a complete SINGLE-PAGE website for a user. You work through chat, iterating on the design.'];

  if (attachedFile) {
    parts.push('');
    parts.push('=== ATTACHED FILE ===');
    parts.push('Filename: ' + attachedFile.name);
    parts.push('URL: ' + attachedFile.url);
    if (attachedFile.extractedText) {
      var excerpt = attachedFile.extractedText;
      if (excerpt.length > 50000) excerpt = excerpt.substring(0, 50000) + '\n… (truncated)';
      parts.push('');
      parts.push('--- Extracted Text Content ---');
      parts.push(excerpt);
      parts.push('--- End Extracted Content ---');
    } else {
      parts.push('Note: This is an image or non-text reference. The URL above points to the uploaded file for reference.');
    }
    parts.push('');
  }

  if (hasCode) {
    parts.push('=== CURRENT PAGE CODE ===');
    parts.push('=== HTML ===\n' + (DB.code.html || '(empty)'));
    parts.push('=== CSS ===\n' + (DB.code.css || '(empty)'));
    parts.push('=== JS ===\n' + (DB.code.js || '(empty)'));
    parts.push('');
    parts.push('=== USER REQUEST ===');
    parts.push(userMsg);
    parts.push('');
    parts.push('Apply the requested change to the page code above. Output the COMPLETE updated === HTML === / === CSS === / === JS === sections (plus === SEO === and === PAGE META === if they should change).');
    parts.push('Even for small changes, output ALL sections completely — never just fragments.');
    parts.push('Preserve all parts of the page the user did not ask to change.');
    parts.push('If the request would be better served by a new page, rebuild from scratch but keep the brand/content where sensible.');
  } else {
    parts.push(buildSettingsSummary());
    parts.push('');
    parts.push('=== USER REQUEST (treat as the design brief) ===');
    parts.push(userMsg);
    parts.push('');
    parts.push('IMPORTANT — If the request is vague or missing key details, ask 1-2 clarifying questions BEFORE generating code.');
    parts.push('Format questions with clickable options like: [[opt1]] First option');
    parts.push('Only generate the page when you have a clear picture of what to design.');
    parts.push('');
    parts.push('Generate the COMPLETE page from scratch. Output === HTML === / === CSS === / === JS === / === SEO === / === PAGE META === sections.');
    parts.push('Follow all PUBLICWEBSITE PAGE RULES below.');
  }

  parts.push('');
  parts.push('=== PUBLICWEBSITE PAGE RULES (active rules file — FOLLOW STRICTLY) ===');
  parts.push(getActiveRules());
  var _typePlaybook = _pageTypeBlock();
  if (_typePlaybook) { parts.push(''); parts.push(_typePlaybook); }
  parts.push('');
  parts.push('=== THINKING LEVEL (requested depth for this query) ===');
  parts.push(_thinkingDirective());
  var _skillsInj = _skillsBlock();
  if (_skillsInj) { parts.push(''); parts.push(_skillsInj); }
  parts.push('');
  parts.push('=== OUTPUT CONTRACT ===');
  parts.push('Output ALL of these sections for every code response: === HTML === (body fragment), === CSS === (scoped rules only), === JS === (idempotent vanilla JS), === SEO === (JSON), === PAGE META === (JSON).');
  parts.push('The platform injects the HTML fragment into a page container between the site header/footer and appends the CSS to <head> — the HTML block must contain NO <html>/<head>/<body>/<style>/<script> tags.');
  parts.push('If the page needs an operation, flow or email template that may not exist, STILL generate the page and append === CMS CONFIG NEEDED === (add === EMAIL TEMPLATE === {templateId, subject, html} with {{key}} placeholders when the note asks for an email hook).');
  parts.push('CRITICAL COMPLIANCE SELF-CHECK before outputting:');
  parts.push('  - Exactly ONE <h1>, first heading, with the primary keyword. No skipped heading levels.');
  parts.push('  - Semantic landmarks (<section>/<article>/<nav>); all <img> have alt, width, height and loading; labels/aria on inputs; visible focus; contrast.');
  parts.push('  - ALL CSS scoped under one unique page class prefix (e.g. .shop-home). Never style bare html/body/*/a/button/h1. The gw- prefix is RESERVED for the platform/sharedCss — never DEFINE gw-* rules yourself.');
  parts.push('  - JS idempotent (re-runs on SPA nav): IIFE; guard window/document listeners with window.__xInit; attach page helpers to gw.ns; no top-level await; vanilla JS only.');
  parts.push('  - No external <script src> libraries. No hardcoded host domains in canonical URLs. No secrets.');
  parts.push('  - Forms: data-gw-form + gw.forms.bind() + honeypot (names gw_hp/website/company reserved) + [data-gw-form-status]. Never auto-submit on load.');
  parts.push('  - data-gw-config attributes must be VALID JSON (no comments, no trailing commas). Prefer built-in islands (menu, cart, checkout-flow, slot-picker, search-box, list…).');
  parts.push('  - data.sections (when used): flat, ordered, max 20, each {cmsObjectType, objectId}.');
  parts.push('  - User/data content rendered with textContent or gw.sanitize — never innerHTML with interpolated values.');
  parts.push('  - Mobile-first: @media queries, 48px tap targets, prefers-reduced-motion, overflow-x:auto on tables.');
  parts.push('  - Size budgets: HTML < 100 KB, CSS < 50 KB, JS < 200 KB.');
  parts.push('  - Imagery: external absolute URLs are fine. Use https://loremflickr.com/<width>/<height>/<keywords> placeholders whose keywords describe the photo (food, people, city, technology, concert…), different keyword pairs per image. Always keep alt, width, height and loading.');
  parts.push('  - No site-wide header, navigation or footer — the platform shell renders them around your content. The platform injects its own trace comment — never emit GW-PAGE-ID-style comments.');
  parts.push('');
  parts.push('REQUIRED — PLAIN-LANGUAGE SUMMARY AFTER EVERY CODE RESPONSE:');
  parts.push('After the code sections, write a short 2-5 sentence summary for a NON-TECHNICAL user explaining what the page now shows or does — no code jargon.');
  parts.push('');
  parts.push('REQUIRED — NEXT-STEP SUGGESTIONS AFTER EVERY CODE RESPONSE:');
  parts.push('Include 3-5 actionable next steps, each on its own line starting with [[suggest_xxx]] followed by an action description.');
  parts.push('Example: [[suggest_darkmode]] Add dark mode toggle');
  parts.push('         [[suggest_gallery]] Add a photo gallery section');
  return parts.join('\n');
}

function buildMinimalPrompt(userMsg) {
  var parts = [
    'Design a single-page website for the UniconHub PublicWebsite platform. Output the required sections:',
    '=== HTML === body fragment only (semantic sections, no document tags), === CSS === scoped rules only, === JS === idempotent vanilla JS, === SEO === JSON, === PAGE META === JSON.',
    'KEY RULES: exactly one <h1>; no skipped heading levels; all <img> have alt/width/height/loading;',
    'every CSS rule scoped under one unique page class; the gw- prefix is RESERVED for the platform — never define gw-* rules; no <html>/<head>/<body>/<style>/<script> tags in the HTML fragment;',
    'no jQuery/Bootstrap/Tailwind or external script libraries; mobile-first with @media queries; no hardcoded host domains; no secrets;',
    'no site-wide header/nav/footer (platform shell provides it);',
    'images via https://loremflickr.com/<width>/<height>/<keywords> where the keywords describe the photo (food, people, city, technology…); keep alt/width/height/loading;',
    _thinkingDirective(),
    'JS idempotent (IIFE + guard), helpers on gw.ns, no top-level await; use window.gw SDK for reads/forms/operations/widgets (incl. the no-code list island); forms need data-gw-form + honeypot.',
    'Reusable shared strips via data.sections (flat, max 20); template pages via data.templateContentType when asked.',
    'If a needed operation/flow/email hook is missing, append === CMS CONFIG NEEDED === (+ === EMAIL TEMPLATE === with {{key}} placeholders for email hooks).',
    'Real copy, no lorem ipsum. No placeholders, no TODOs.',
    ''
  ];
  var skills = _skillsBlock();
  if (skills) { parts.push(skills); parts.push(''); }
  var typePlaybook = _pageTypeBlock();
  if (typePlaybook) { parts.push(typePlaybook); parts.push(''); }
  parts.push('=== USER REQUEST ===');
  parts.push(userMsg);
  parts.push('');
  parts.push('Generate COMPLETE === HTML === / === CSS === / === JS === / === SEO === / === PAGE META === sections.');
  parts.push('If request is vague, ask clarifying questions with [[option_id]] format.');
  return parts.join('\n');
}

/* ── AI request lifecycle ── */
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
  var gen = el('gen-status');
  if (gen) gen.style.display = active ? '' : 'none';
  if (active) {
    var gt = el('gen-status-text');
    if (gt) gt.textContent = '🎨 AI is designing your page…';
  }
}

/* ── AI watchdog — fires if the gateway never calls back (600s + buffer) ── */
function setAiTimeout(promptLen) {
  clearAiTimeout();
  _aiTimeoutId = setTimeout(function() {
    console.warn('[WEBPAGEBUILDER:TIMEOUT] 🔴 AI request timed out after 600 seconds');
    console.warn('  promptChars:', promptLen, 'estTokens:', Math.round(promptLen / 4));
    console.warn('  _aiCallActive was:', _aiCallActive);
    _aiCallActive = false;
    _markThinkingComplete(600000);
    var devStatusTO = el('dev-raw-status');
    if (devStatusTO) devStatusTO.textContent = '⏰ Timed out after 600s';
    _setAiUIActive(false);
    var errMsg = '⏰ **AI request timed out after 600 seconds.**\n\n' +
      'Possible causes:\n' +
      '• The AI Gateway or model is overloaded\n' +
      '• Prompt too large? (' + promptLen.toLocaleString() + ' chars — dynamic limit based on model)\n' +
      '• Network issue between browser and AI Gateway\n' +
      '• allowAi parameter not set to "yes"\n\n' +
      '🔧 Try sending again or simplifying your request.';
    addChatMessage('ai', errMsg, { isError: true });
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
  if (_streamingMsgIdx >= 0 && _streamingMsgIdx < DB.chatMessages.length) {
    DB.chatMessages.splice(_streamingMsgIdx, 1);
  }
  _streamingMsgEl = null;
  _streamingMsgIdx = -1;
  _streamTabEls = {};
  _streamCurrentTab = 'text';
  _streamBuf = '';
  renderChatMessages();
  updateConnStatus('ok');
  var devStatus = el('dev-raw-status');
  if (devStatus) devStatus.textContent = '⏹ Cancelled';
  addChatMessage('ai', '⏹ **Generation stopped.** You can send another message to continue.');
  tool.resize();
}

function sendChatMessage() {
  var input = el('chat-input');
  if (!input) return;
  if (_aiCallActive) { showToast('AI is already designing. Wait or press Stop.', 'warning'); return; }
  var msg = input.value.trim();
  if (!msg && !attachedFile) return;
  if (!msg) msg = 'Please analyze the attached reference and design a page based on it.';

  var tok = { cancelled: false };
  _reqToken = tok;

  var displayMsg = msg;
  if (attachedFile) displayMsg = '📎 **' + attachedFile.name + '** (' + formatFileSize(attachedFile.size) + ')\n' + msg;
  addChatMessage('user', displayMsg);
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

  var hasCode = !!(DB.code.html || DB.code.css || DB.code.js);
  if (_shouldPlan(msg, hasCode)) {
    _runAgentPlan(msg, tok, hasCode);
  } else {
    _runSingleGeneration(msg, tok);
  }
}

/* ── Agentic mode: plan → execute step by step (like Claude Code tasks) ──
   The CMS AI gateway exposes single request/response calls only, so the agent
   loop is orchestrated HERE: one small AI call per step, each applying a
   PARTIAL edit (one section / one concern) instead of rewriting the page.
   Small steps → no timeouts → incremental, reviewable progress. ── */
var agenticMode = true;
var _planMsgIdx = -1;

function _loadAgenticPref() {
  try {
    var v = localStorage.getItem('wb_agentic');
    if (v !== null && v !== undefined) agenticMode = v === '1';
  } catch (e) {}
  _syncAgenticToggle();
}
function _toggleAgentic() {
  agenticMode = !agenticMode;
  try { localStorage.setItem('wb_agentic', agenticMode ? '1' : '0'); } catch (e) {}
  _syncAgenticToggle();
  showToast(agenticMode ? '🧠 Agentic mode on — large requests become a task plan.' : 'Agentic mode off — single-shot generation.', 'info');
}
function _syncAgenticToggle() {
  var b = el('btn-agentic-mode');
  if (b) b.classList.toggle('active', !!agenticMode);
}
function _shouldPlan(msg, hasCode) {
  if (!agenticMode) return false;
  var verbs = msg.match(/\b(add|create|build|make|change|update|fix|improve|remove|redesign|rewrite|replace|move|turn|convert)\b/gi);
  var verbCount = verbs ? verbs.length : 0;
  return (msg.length >= 80 && verbCount >= 2) || verbCount >= 3;
}

function _buildPlanPrompt(msg, hasCode) {
  var parts = [];
  parts.push('You are the PLANNING brain of a single-page website builder (UniconHub PublicWebsite). The user gave a large request. Break it into a small ORDERED task list so each task can be completed in ONE short answer — no timeouts, incremental build.');
  parts.push(buildSettingsSummary());
  var skills = _skillsBlock();
  if (skills) { parts.push(''); parts.push(skills); }
  var tpBlock = _pageTypeBlock();
  if (tpBlock) { parts.push(''); parts.push(tpBlock); }
  parts.push('');
  parts.push('=== CURRENT PAGE STATE ===');
  if (hasCode) {
    parts.push('Detected page type: ' + _detectPageType(DB.code.html || ''));
    var secs = detectSections(DB.code.html || '');
    var names = [];
    for (var i = 0; i < secs.length; i++) names.push((secs[i].id ? '#' + secs[i].id + ' ' : '') + secs[i].label);
    parts.push('Existing sections: ' + (names.join(' | ') || '(none)'));
  } else {
    parts.push('No page exists yet — this is a from-scratch build.');
  }
  parts.push('');
  parts.push('=== USER REQUEST ===');
  parts.push(msg);
  parts.push('');
  parts.push('OUTPUT ONLY A RAW JSON ARRAY of 2-6 steps (no markdown, no prose, no code fences):');
  parts.push('{"t":"edit","id":"hero","d":"what to change"}   — replace one existing section (use an id from the list above)');
  parts.push('{"t":"add","d":"what new section to create"}   — append a brand-new section');
  parts.push('{"t":"style","d":"what styling to change"}     — CSS-only changes');
  parts.push('{"t":"script","d":"what behavior to add or fix"}  — JS-only changes');
  parts.push('Order matters: steps that later steps depend on must come first. Each step must be small (one section or one concern) — never a whole-page rewrite.');
  return parts.join('\n');
}

function _parsePlanJson(text) {
  var t = (text || '').replace(/```(?:json)?/gi, '');
  var s = t.indexOf('[');
  var e = t.lastIndexOf(']');
  if (s === -1 || e <= s) return null;
  var slice = t.substring(s, e + 1);
  var steps = null;
  try {
    steps = JSON.parse(slice);
  } catch (err) {
    steps = [];
    var re = /\{[^{}]*\}/g;
    var m;
    while ((m = re.exec(slice)) !== null) {
      try {
        var obj = JSON.parse(m[0]);
        if (obj && (obj.d || obj.desc || obj.description)) steps.push(obj);
      } catch (e2) {}
    }
    if (!steps.length) return null;
  }
  if (!steps || !steps.length) return null;
  var out = [];
  for (var i = 0; i < steps.length; i++) {
    var st = steps[i];
    var type = st.t === 'style' || st.t === 'script' || st.t === 'add' ? st.t : 'edit';
    var desc = (st.d || st.desc || st.description || '').toString().replace(/^\s+|\s+$/g, '');
    if (!desc) continue;
    out.push({ t: type, id: (st.id ? st.id.toString() : ''), d: desc });
  }
  return out.length ? out.slice(0, 6) : null;
}

function _escRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function _extractSectionHtml(html, id) {
  if (!html || !id) return '';
  var re = new RegExp("<(section|article|header|footer|aside|nav)\\b[^>]*\\bid\\s*=\\s*[\"']" + _escRegExp(id) + "[\"'][^>]*>", 'i');
  var m = re.exec(html);
  if (!m) return '';
  var tag = m[1].toLowerCase();
  var start = m.index;
  var pos = m.index + m[0].length;
  var depth = 1;
  var openRe = new RegExp('<' + tag + '\\b', 'gi');
  var closeRe = new RegExp('<\\/' + tag + '>', 'gi');
  while (depth > 0) {
    openRe.lastIndex = pos;
    closeRe.lastIndex = pos;
    var om = openRe.exec(html);
    var cm = closeRe.exec(html);
    if (!cm) return html.substring(start); // unclosed — return the rest
    if (om && om.index < cm.index) { depth++; pos = om.index + om[0].length; }
    else { depth--; pos = cm.index + cm[0].length; }
  }
  return html.substring(start, pos);
}
function _replaceSectionById(html, id, replacement) {
  if (!html || !id) return null;
  var re = new RegExp("<(section|article|header|footer|aside|nav)\\b[^>]*\\bid\\s*=\\s*[\"']" + _escRegExp(id) + "[\"'][^>]*>", 'i');
  var m = re.exec(html);
  if (!m) return null;
  var old = _extractSectionHtml(html, id);
  if (!old) return null;
  return html.substring(0, m.index) + replacement + html.substring(m.index + old.length);
}

function _applyStepPatch(step, blocks) {
  var html = DB.code.html || '';
  var newHtml = (blocks.html || '').replace(/^\s+|\s+$/g, '');
  var applied = false;
  if (newHtml) {
    var inserted = false;
    if (step.t === 'edit' && step.id) {
      var replaced = _replaceSectionById(html, step.id, newHtml);
      if (replaced) { html = replaced; inserted = true; }
    }
    if (!inserted) {
      var fm = html.match(/<footer\b[^>]*>/i);
      if (fm) html = html.substring(0, fm.index) + newHtml + '\n' + html.substring(fm.index);
      else html = (html ? html.replace(/\s*$/, '\n') : '') + newHtml;
    }
    DB.code.html = html;
    applied = true;
  }
  var css = (blocks.css || '').replace(/^\s+|\s+$/g, '');
  if (css) {
    DB.code.css = (DB.code.css ? DB.code.css.replace(/\s*$/, '\n') : '') + '\n/* step: ' + step.d.substring(0, 60) + ' */\n' + css;
    applied = true;
  }
  var js = _sanitizeJs(blocks.js || '').code;
  if (js) {
    DB.code.js = (DB.code.js ? DB.code.js.replace(/\s*$/, '\n') : '') + '\n/* step: ' + step.d.substring(0, 60) + ' */\n' + js;
    applied = true;
  }
  return applied;
}

function _buildStepPrompt(step, idx, total) {
  var parts = [];
  parts.push('You are executing step ' + (idx + 1) + ' of ' + total + ' of a planned website build. Work ONLY on this one step — do not regenerate the whole page.');
  parts.push(buildSettingsSummary());
  var skills = _skillsBlock();
  if (skills) { parts.push(''); parts.push(skills); }
  var tpBlock2 = _pageTypeBlock();
  if (tpBlock2) { parts.push(''); parts.push(tpBlock2); }
  parts.push('');
  parts.push('=== TASK ===');
  parts.push(step.d);
  parts.push('');
  parts.push('=== CURRENT PAGE (only what you need) ===');
  var html = DB.code.html || '';
  if (step.t === 'edit' && step.id) {
    var sec = _extractSectionHtml(html, step.id);
    parts.push('[TARGET SECTION HTML]');
    parts.push(sec || '(section #' + step.id + ' was not found — create it as a new section)');
  } else {
    var secs = detectSections(html);
    var names = [];
    for (var i = 0; i < secs.length; i++) names.push((secs[i].id ? '#' + secs[i].id : '') + ' ' + secs[i].label);
    parts.push('[EXISTING SECTIONS] ' + (names.join(' | ') || '(none)'));
    parts.push('[HTML CONTEXT]');
    var h2 = html;
    if (h2.length > 4000) h2 = h2.substring(0, 4000) + '\n… (truncated)';
    parts.push(h2 || '(empty)');
  }
  var css = DB.code.css || '';
  if (css) {
    if (css.length > 4000) css = css.substring(0, 4000) + '\n… (truncated)';
    parts.push('[CURRENT CSS]');
    parts.push(css);
  }
  var js = DB.code.js || '';
  if (js) {
    if (js.length > 2500) js = js.substring(0, 2500) + '\n… (truncated)';
    parts.push('[CURRENT JS]');
    parts.push(js);
  }
  parts.push('');
  parts.push('=== OUTPUT CONTRACT (partial edit — NOT the whole page) ===');
  if (step.t === 'edit' || step.t === 'add') {
    parts.push('Output the new or replacement markup ONLY, wrapped in === HTML === … === as a single root <section id="…"> (keep the SAME id when replacing; choose a unique id when adding). Class names must use the page\'s existing unique prefix.');
    parts.push('If new rules are needed, add a === CSS === block with ONLY the new/changed rules (scoped under the page class). If behavior is needed, add a === JS === block with a small self-contained idempotent script.');
  } else if (step.t === 'style') {
    parts.push('Output ONLY a === CSS === block with the new/changed rules (scoped under the existing page class) — not the whole stylesheet.');
  } else {
    parts.push('Output ONLY a === JS === block: a small self-contained IDEMPOTENT script implementing the behavior.');
  }
  parts.push('Never output <style>/<script>/<html>/<head>/<body> tags, site headers/footers, or unrelated page parts. Keep it under ~120 lines. Real copy, no lorem ipsum. Attach helpers to gw.ns; the gw- CSS prefix is reserved for the platform. Images via https://loremflickr.com/<width>/<height>/<content-keywords> with alt/width/height/loading.');
  return parts.join('\n');
}

function _callAIOnce(prompt, tok, cb) {
  setAiTimeout(prompt.length);
  var acc = '';
  var done = false;
  function finish(ok, text) {
    if (done) return;
    done = true;
    clearAiTimeout();
    if (!_aiCallActive) return; // watchdog timed out — ignore late answers
    cb(ok, text);
  }
  var useStream = typeof tool.requestAIStream === 'function';
  if (useStream) {
    try {
      tool.requestAIStream(prompt, '', {
        onToken: function(token) {
          if (tok && tok.cancelled) return;
          _lastTokenAt = Date.now();
          acc += token;
          setAiTimeout(prompt.length);
          if (_streamCallback) _streamCallback(token);
        },
        onComplete: function() { finish(true, acc); },
        onError: function(err) { finish(false, ''); }
      });
    } catch (e) { finish(false, ''); }
  } else {
    try {
      tool.requestAI(prompt, '', function(err, resp) {
        if (tok && tok.cancelled) { finish(false, ''); return; }
        if (resp && resp.trim()) finish(true, resp); else finish(false, '');
      });
    } catch (e) { finish(false, ''); }
  }
}

function _addPlanMessage(steps) {
  var msg = { role: 'plan', time: new Date().toISOString(), tasks: [], done: false };
  for (var i = 0; i < steps.length; i++) msg.tasks.push({ d: steps[i].d, status: 'pending' });
  DB.chatMessages.push(msg);
  _planMsgIdx = DB.chatMessages.length - 1;
  renderChatMessages();
  if (_activeSessionId) saveCurrentSession();
  updateChatBadge();
}
function _updatePlanTask(i, status) {
  if (_planMsgIdx < 0 || _planMsgIdx >= DB.chatMessages.length) return;
  var m = DB.chatMessages[_planMsgIdx];
  if (!m.tasks || !m.tasks[i]) return;
  m.tasks[i].status = status;
  // Targeted DOM update — a full re-render would wipe the live thinking bubble.
  var bubble = document.querySelector('.plan-bubble[data-plan-idx="' + _planMsgIdx + '"]');
  if (!bubble) return;
  var taskEl = bubble.querySelector('.plan-task[data-task-i="' + i + '"]');
  if (taskEl) {
    var icons = { pending: '⬜', doing: '⏳', done: '✅', failed: '❌' };
    taskEl.className = 'plan-task ' + status;
    var ic = taskEl.querySelector('.plan-ic');
    if (ic) ic.textContent = icons[status] || '⬜';
  }
  var cnt = 0;
  for (var t = 0; t < m.tasks.length; t++) if (m.tasks[t].status === 'done' || m.tasks[t].status === 'failed') cnt++;
  if (cnt === m.tasks.length) {
    var st = bubble.querySelector('.plan-status');
    if (st) st.textContent = 'complete';
  }
}

function _runAgentPlan(msg, tok, hasCode) {
  var runStart = Date.now();
  var planPrompt = _buildPlanPrompt(msg, hasCode);
  var pc = el('dev-prompt-content');
  if (pc) pc.textContent = planPrompt;
  var ps = el('dev-prompt-status');
  if (ps) ps.textContent = planPrompt.length.toLocaleString() + ' chars';
  updateConnStatus('busy');
  _aiCallActive = true;
  _setAiUIActive(true);
  showThinkingBubble('🧠 Planning the task list…', true);
  _callAIOnce(planPrompt, tok, function(ok, text) {
    if (tok && tok.cancelled) { _reqToken = null; return; }
    var steps = ok ? _parsePlanJson(text) : null;
    if (!steps || !steps.length) {
      hideThinkingBubble();
      _runSingleGeneration(msg, tok);
      return;
    }
    hideThinkingBubble();
    _addPlanMessage(steps);
    _execSteps(steps, 0, tok, runStart);
  });
}

function _execSteps(steps, i, tok, runStart) {
  if (tok && tok.cancelled) { _abortPlan(); return; }
  if (i >= steps.length) { _finishPlan(steps, runStart); return; }
  var step = steps[i];
  _updatePlanTask(i, 'doing');
  showThinkingBubble('Step ' + (i + 1) + '/' + steps.length + ': ' + step.d.substring(0, 60), true);
  var stepPrompt = _buildStepPrompt(step, i, steps.length);
  var pc = el('dev-prompt-content');
  if (pc) pc.textContent = stepPrompt;
  var ps = el('dev-prompt-status');
  if (ps) ps.textContent = stepPrompt.length.toLocaleString() + ' chars';
  _callAIOnce(stepPrompt, tok, function(ok, text) {
    if (tok && tok.cancelled) { _abortPlan(); return; }
    var failed = !ok || !text || !text.replace(/^\s+|\s+$/g, '');
    if (!failed) {
      var blocks = _parseStepOutput(text);
      blocks.html = _ensureImageSrcs(blocks.html || '');
      blocks.js = _sanitizeJs(blocks.js || '').code;
      if ((blocks.html || '').replace(/^\s+|\s+$/g, '') || (blocks.css || '').replace(/^\s+|\s+$/g, '') || (blocks.js || '').replace(/^\s+|\s+$/g, '')) {
        var applied = _applyStepPatch(step, blocks);
        if (applied) {
          _aiJustUpdated = true; // AI change — one version bump at plan end, not per step
          persist();
          displayAllCode(DB.code); // keep editors in sync — stale editors would clobber DB on tab switch
          renderSections();
          runComplianceChecks();
          _updatePlanTask(i, 'done');
        } else failed = true;
      } else failed = true;
    }
    if (failed) _updatePlanTask(i, 'failed');
    _execSteps(steps, i + 1, tok, runStart);
  });
}

function _finishPlan(steps, runStart) {
  var doneCount = 0, failedCount = 0;
  var lines = [];
  if (_planMsgIdx >= 0 && _planMsgIdx < DB.chatMessages.length) {
    var m = DB.chatMessages[_planMsgIdx];
    if (m && m.tasks) {
      for (var i = 0; i < m.tasks.length; i++) {
        var st = m.tasks[i];
        if (st.status === 'done') { doneCount++; lines.push('- ✅ ' + st.d); }
        else { failedCount++; lines.push('- ❌ ' + st.d); }
      }
      m.done = true;
    }
  }
  _markThinkingComplete(Date.now() - runStart);
  if (doneCount > 0) {
    _bumpVersion('minor');
    _addHistoryEntry({ version: DB.version, time: new Date().toISOString(), label: 'Agentic update — ' + doneCount + '/' + steps.length + ' steps', html: DB.code.html, css: DB.code.css, js: DB.code.js });
  }
  _aiJustUpdated = true; // AI change — minor bump already applied, no extra patch bump
  persist();
  displayAllCode(DB.code); // sync editors before the tab switch commits them
  renderSections();
  runComplianceChecks();
  updatePreview();
  _aiCallActive = false;
  _reqToken = null;
  clearAiTimeout();
  updateConnStatus('ok');
  _setAiUIActive(false);
  var summary;
  if (doneCount > 0) {
    summary = (failedCount ? '⚠️ Finished ' + doneCount + ' of ' + steps.length + ' planned tasks:\n' : '✅ Finished all ' + doneCount + ' planned tasks — applied:\n') + lines.join('\n');
    if (failedCount) summary += '\nFailed tasks were skipped — ask me to retry any of them.';
  } else {
    summary = '⚠️ No code changes were applied — the plan steps did not return usable code. Ask me to retry with a clearer description.';
  }
  var extra = { version: doneCount > 0 ? DB.version : null };
  extra.options = _planNextSteps();
  extra.compliance = _complianceSummary(_complianceResults || runComplianceChecks());
  addChatMessage('ai', summary, extra);
  _planMsgIdx = -1;
  clearAttachment();
  try { tool.notify('💾 Auto-saved — page v' + DB.version + ' is stored in this record', 'success'); } catch (e) {}
  switchTab('preview'); // show the result immediately
  tool.resize();
}

function _abortPlan() {
  if (_planMsgIdx >= 0 && _planMsgIdx < DB.chatMessages.length) {
    var m = DB.chatMessages[_planMsgIdx];
    if (m && m.tasks) {
      for (var i = 0; i < m.tasks.length; i++) {
        if (m.tasks[i].status !== 'done') m.tasks[i].status = 'failed';
      }
      m.done = true;
    }
  }
  _planMsgIdx = -1;
  renderChatMessages();
}

function _runSingleGeneration(msg, tok) {
  var hasCode = !!(DB.code.html || DB.code.css || DB.code.js);
  var prompt = buildChatPrompt(msg);

  var promptContent = el('dev-prompt-content');
  if (promptContent) promptContent.textContent = prompt;
  var promptStatus = el('dev-prompt-status');
  if (promptStatus) promptStatus.textContent = prompt.length.toLocaleString() + ' chars';

  updateConnStatus('busy');
  _aiCallActive = true;
  _setAiUIActive(true);
  _showDevPanel();
  setAiTimeout(prompt.length);

  var useStream = typeof tool.requestAIStream === 'function';

  if (useStream) {
    showThinkingBubble('AI is designing…', true);
    var fullResponse = '';
    var streamStart = Date.now();
    try {
      tool.requestAIStream(prompt, '', {
        onToken: function(token) {
          if (tok.cancelled) return;
          _lastTokenAt = Date.now(); // AI is alive — suppress misleading "unavailable" messages
          if (!_streamingMsgEl) {
            // First token — expand the thinking bubble and show the cancel button
            var thinkLabel = document.getElementById('think-label');
            if (thinkLabel) thinkLabel.textContent = 'AI is generating…';
            var thinkBody = document.getElementById('think-body');
            var thinkToggle = document.getElementById('think-toggle');
            if (thinkBody) thinkBody.style.display = 'block';
            if (thinkToggle) thinkToggle.textContent = '▼';
            var thinkCancel = document.getElementById('think-cancel');
            if (thinkCancel) thinkCancel.style.display = '';
            _beginStreamingMessage();
          }
          fullResponse += token;
          setAiTimeout(prompt.length); // keepalive — reset watchdog on every token
          appendStreamToken(token);    // live raw stream inside the thinking bubble
          _appendStreamingToken(token);
          _devRawContent += token;
          _updateDevPanel();
        },
        onComplete: function() {
          if (tok.cancelled) { _reqToken = null; return; }
          var elapsed = Date.now() - streamStart;
          _aiCallActive = false;
          _reqToken = null;
          clearAiTimeout();
          _markThinkingComplete(elapsed);
          var devStatus = el('dev-raw-status');
          if (devStatus) devStatus.textContent = '✓ Complete (' + (elapsed / 1000).toFixed(1) + 's)';
          if (fullResponse && fullResponse.trim() && fullResponse.length > 10) {
            _finalizeStreamingMessage(fullResponse, hasCode);
          } else {
            _streamingMsgEl = null;
            _streamingMsgIdx = -1;
            _streamTabEls = {};
            // Stream empty — retry with batch requestAI (may handle large prompts better)
            updateConnStatus('busy');
            _aiCallActive = true;
            _setAiUIActive(true);
            setAiTimeout(prompt.length);
            try {
              tool.requestAI(prompt, '', function(err2, response2) {
                if (tok.cancelled) { _reqToken = null; return; }
                var elapsed2 = Date.now() - streamStart;
                _aiCallActive = false;
                _reqToken = null;
                clearAiTimeout();
                _markThinkingComplete(elapsed2);
                if (response2 && response2.trim() && response2.length > 10) {
                  _finalizeStreamingMessage(response2, hasCode);
                } else if (err2) {
                  updateConnStatus('error');
                  _setAiUIActive(false);
                  addChatMessage('ai', '⚠️ **AI Error:** ' + err2 + '\n\n🔧 Check that the CMS AI service is configured (allowAi: yes).', { isError: true });
                } else {
                  _tryLastResort(msg, tok);
                }
                clearAttachment();
                tool.resize();
              });
            } catch (e2) {
              _aiCallActive = false;
              _reqToken = null;
              clearAiTimeout();
              _markThinkingComplete(0);
              updateConnStatus('error');
              _setAiUIActive(false);
              addChatMessage('ai', '⚠️ **AI retry failed:** ' + (e2.message || 'Unknown'), { isError: true });
              clearAttachment();
              tool.resize();
            }
          }
        },
        onError: function(err) {
          if (tok.cancelled) { _reqToken = null; return; }
          var elapsed = Date.now() - streamStart;
          _aiCallActive = false;
          _reqToken = null;
          clearAiTimeout();
          _markThinkingComplete(elapsed);
          updateConnStatus('error');
          _setAiUIActive(false);
          addChatMessage('ai', '⚠️ **AI Stream Error:** ' + (err || 'Unknown failure') + '\n\n🔧 Check that allowAi is set to "yes" in field settings.', { isError: true });
          clearAttachment();
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
      clearAttachment();
      tool.resize();
    }
  } else {
    showThinkingBubble('AI is designing…', false);
    var batchStart = Date.now();
    try {
      tool.requestAI(prompt, '', function(err, response) {
        if (tok.cancelled) { _reqToken = null; return; }
        var elapsed = Date.now() - batchStart;
        _aiCallActive = false;
        _reqToken = null;
        clearAiTimeout();
        _markThinkingComplete(elapsed);
        if (response && response.trim() && response.length > 10) {
          updateConnStatus('ok');
          _setAiUIActive(false);
          processAIResponse(response, hasCode);
        } else if (err) {
          updateConnStatus('error');
          _setAiUIActive(false);
          addChatMessage('ai', '⚠️ **AI Error:** ' + err, { isError: true });
        } else {
          updateConnStatus('error');
          _setAiUIActive(false);
          addChatMessage('ai', '⚠️ **No AI response received.**\n\nPossible causes:\n• allowAi not set to "yes" in field settings\n• AI service not configured for this tenant\n\n🔧 Ask your CMS admin to verify the AI configuration.', { isError: true });
        }
        clearAttachment();
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
      clearAttachment();
      tool.resize();
    }
  }
}

function _tryLastResort(msg, tok) {
  var minimalPrompt = buildMinimalPrompt(msg);
  updateConnStatus('busy');
  _aiCallActive = true;
  _setAiUIActive(true);
  setAiTimeout(minimalPrompt.length);
  try {
    tool.requestAI(minimalPrompt, '', function(err3, response3) {
      if (tok.cancelled) { _reqToken = null; return; }
      _aiCallActive = false;
      _reqToken = null;
      clearAiTimeout();
      _markThinkingComplete(0);
      if (response3 && response3.trim() && response3.length > 10) {
        _setAiUIActive(false);
        processAIResponse(response3, false);
      } else {
        updateConnStatus('error');
        _setAiUIActive(false);
        addChatMessage('ai', '⚠️ **AI service appears to be unavailable.**\n\nAll attempts failed. Contact your CMS administrator to verify the AI gateway configuration.', { isError: true });
      }
      clearAttachment();
      tool.resize();
    });
  } catch (e) {
    _aiCallActive = false;
    _reqToken = null;
    clearAiTimeout();
    _markThinkingComplete(0);
    updateConnStatus('error');
    _setAiUIActive(false);
    clearAttachment();
    tool.resize();
  }
}

function _finalizeStreamingMessage(fullText, hasCode) {
  // Remove the streaming placeholder — processAIResponse adds the final message
  if (_streamingMsgIdx >= 0 && _streamingMsgIdx < DB.chatMessages.length) {
    DB.chatMessages.splice(_streamingMsgIdx, 1);
  }
  _streamingMsgEl = null;
  _streamingMsgIdx = -1;
  _streamTabEls = {};
  _streamCurrentTab = 'text';
  _streamBuf = '';
  _setAiUIActive(false);
  updateConnStatus('ok');
  processAIResponse(fullText, hasCode);
  clearAttachment();
  tool.resize();
}

/* ── Dev panel ── */
var _devRawContent = '';
function _updateDevPanel() {
  var c = el('dev-raw-content');
  if (c) {
    if (_devRawContent.length > 60000) _devRawContent = _devRawContent.slice(-60000);
    c.textContent = _devRawContent;
    c.scrollTop = c.scrollHeight;
  }
}
function _showDevPanel() {
  _devRawContent = '';
  _updateDevPanel();
  var s = el('dev-raw-status');
  if (s) s.textContent = '';
}

/* ── File upload ── */
function handleFileUpload() {
  try {
    tool.requestUpload('.png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.doc,.docx,.txt,.md', function(err, file) {
      if (err) { showToast('Upload failed: ' + err, 'error'); return; }
      attachedFile = { name: file.name, url: file.url, size: file.size, type: file.type, extractedText: '' };
      showAttachment();
      var extractable = /\.(pdf|docx?|txt|md)$/i.test(file.name);
      if (extractable) {
        el('attach-status').textContent = 'Extracting text…';
        try {
          tool.requestFileContent(file.url, function(e2, content) {
            if (content) {
              attachedFile.extractedText = content;
              el('attach-status').textContent = '✓ Text extracted (' + content.length.toLocaleString() + ' chars)';
            } else {
              el('attach-status').textContent = e2 ? '⚠ ' + e2 : '✓ Ready';
            }
          });
        } catch (e) { el('attach-status').textContent = '✓ Ready'; }
      } else {
        el('attach-status').textContent = '✓ Attached (reference URL shared with AI)';
      }
      showToast('File attached: ' + file.name, 'success');
    });
  } catch (e) {
    showToast('Upload is not available: ' + e.message, 'warning');
  }
}
function showAttachment() {
  if (!attachedFile) { el('chat-attachment').style.display = 'none'; return; }
  el('chat-attachment').style.display = 'flex';
  el('attach-name').textContent = attachedFile.name;
  el('attach-size').textContent = formatFileSize(attachedFile.size);
}
function clearAttachment() {
  attachedFile = null;
  var a = el('chat-attachment');
  if (a) a.style.display = 'none';
  var s = el('attach-status');
  if (s) s.textContent = '';
}
function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

/* ── Code display ── */
function displayCode(part, code) {
  var ta = el('code-' + part);
  var linesEl = el(part + '-lines');
  if (ta) {
    if (document.activeElement !== ta) ta.value = code || '';
    var lc = (code || '').split('\n').length;
    if (linesEl) {
      var n = '';
      for (var i = 1; i <= lc; i++) n += '<div>' + i + '</div>';
      linesEl.innerHTML = n;
    }
  }
  if (ta && linesEl) ta.onscroll = function() { linesEl.scrollTop = ta.scrollTop; };
}
function displayAllCode(c) {
  displayCode('html', c.html || '');
  displayCode('css', c.css || '');
  displayCode('js', c.js || '');
  updatePreview();
}
function updateLineNumbers() {
  var parts = ['html', 'css', 'js'];
  for (var i = 0; i < parts.length; i++) {
    var ta = el('code-' + parts[i]);
    var linesEl = el(parts[i] + '-lines');
    if (!ta || !linesEl) continue;
    var lc = ta.value.split('\n').length;
    var n = '';
    for (var j = 1; j <= lc; j++) n += '<div>' + j + '</div>';
    linesEl.innerHTML = n;
  }
}

/* Flush any edits typed in the HTML/CSS/JS editors into DB.code immediately —
   called on every tab switch so the Preview always shows the LATEST version
   without waiting for the debounced auto-save. */
function _commitEditorsToDb() {
  var h = el('code-html'), c = el('code-css'), j = el('code-js');
  var changed = false;
  if (h && h.value !== DB.code.html) { DB.code.html = h.value; changed = true; }
  if (c && c.value !== DB.code.css) { DB.code.css = c.value; changed = true; }
  if (j && j.value !== DB.code.js) { DB.code.js = j.value; changed = true; }
  if (changed) {
    updateLineNumbers();
    persist();
    renderSections();
    runComplianceChecks();
  }
}

/* ── Preview ── */
function _applyDeviceClass() {
  var fw = el('preview-frame-wrap');
  if (fw) {
    fw.classList.remove('device-tablet', 'device-mobile');
    if (currentDevice === 'tablet') fw.classList.add('device-tablet');
    else if (currentDevice === 'mobile') fw.classList.add('device-mobile');
  }
  qsa('.dev-btn').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-device') === currentDevice);
  });
}
function setDevice(d) {
  currentDevice = d;
  qsa('.dev-btn').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-device') === d);
  });
  _applyDeviceClass();
}

function buildPreviewDoc() {
  var lang = _p('lang', 'en');
  var html = DB.code.html || '';
  var css = DB.code.css || '';
  var jsSan = _sanitizeJs(DB.code.js || '');
  _lastJsFixCount = jsSan.fixed;
  var js = jsSan.code;
  var scrollScript = '';
  if (_pendingScrollId) {
    var sid = _pendingScrollId;
    scrollScript = '<script>setTimeout(function(){try{var t=document.getElementById(' + JSON.stringify(sid) + ');if(t){t.scrollIntoView({behavior:"smooth",block:"start"});t.style.outline="3px solid #7c3aed";t.style.outlineOffset="-3px";setTimeout(function(){t.style.outline="";},2600);}}catch(e){}},200);<\/script>';
    _pendingScrollId = '';
  }
  var doc =
    '<!DOCTYPE html><html lang="' + esc(lang) + '">' +
    '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Preview</title>' +
    '<style>\nhtml{scroll-behavior:smooth}\nsection,[id]{scroll-margin-top:80px}\n' + css + '\n</style></head>' +
    '<body>\n' + html + '\n' +
    scrollScript +
    _gwPreviewMockScript(lang) + '\n' +
    '<script>\n(function(){var oc={log:console.log,warn:console.warn,error:console.error};function post(l,args){var msg=Array.prototype.slice.call(args).map(function(a){try{return typeof a==="object"?JSON.stringify(a):String(a)}catch(e){return String(a)}}).join(" ");try{parent.postMessage({wbConsole:{level:l,msg:msg,time:new Date().toISOString()}},"*")}catch(e){}}console.log=function(){post("log",arguments);oc.log.apply(console,arguments)};console.warn=function(){post("warn",arguments);oc.warn.apply(console,arguments)};console.error=function(){post("error",arguments);oc.error.apply(console,arguments)};window.onerror=function(m){post("error",["Error:",m]);return true};window.addEventListener("keydown",function(e){if(e.ctrlKey&&e.shiftKey&&(e.key==="Y"||e.key==="y")){try{parent.postMessage({wbDump:true},"*")}catch(err){}}});})();\n<\/script>\n' +
    '<script>\n' + js + '\n<\/script>\n</body></html>';
  return doc;
}

function _mountPreviewDoc(doc) {
  var wrap = el('preview-frame-wrap');
  if (!wrap) return false;
  var old = el('preview-frame');
  if (old && old.parentNode) old.parentNode.removeChild(old);
  var f = document.createElement('iframe');
  f.id = 'preview-frame';
  f.className = 'preview-frame';
  f.setAttribute('sandbox', 'allow-scripts allow-forms allow-downloads allow-popups');
  f.srcdoc = doc;
  wrap.appendChild(f);
  return true;
}

function updatePreview() {
  // DB.code is the single source of truth for the preview (editor edits are
  // flushed into it by _commitEditorsToDb on every tab switch).
  var html = DB.code.html || '';
  var css = DB.code.css || '';
  var js = DB.code.js || '';
  var fw = el('preview-frame-wrap');
  var pe = el('preview-empty');
  var hasContent = !!(html.trim() || css.trim() || js.trim());
  if (!hasContent) {
    if (fw) fw.classList.remove('has-content');
    if (pe) {
      pe.innerHTML = '<div class="empty-icon">👁️</div>' +
        '<p>Your webpage will appear here</p>' +
        '<p class="empty-sub">Describe your page in the chat to generate it</p>';
      pe.style.display = '';
    }
    return;
  }
  if (fw) fw.classList.add('has-content');
  if (pe) pe.style.display = 'none';
  _applyDeviceClass();
  try {
    // Unique build stamp + a FRESH iframe node every render: Chromium can fail
    // to repaint a sandboxed srcdoc iframe after its ancestor was display:none,
    // so we recreate the element instead of re-assigning srcdoc.
    _previewBuildSeq += 1;
    var doc = buildPreviewDoc();
    var mounted = _mountPreviewDoc(('<' + '!-- preview-build:' + _previewBuildSeq + ' -->') + doc);
    if (!mounted) throw new Error('preview-frame-wrap element not found');
    if (_lastJsFixCount > 0) {
      addConsoleEntry('warn', '♻ Auto-repaired ' + _lastJsFixCount + ' Python-style/markdown "**" token(s) in the page JavaScript — check the JS tab.');
      _lastJsFixCount = 0;
    }
  } catch (err) {
    // Surface the error inside the preview area instead of a silent blank.
    if (pe) {
      pe.innerHTML = '<div class="empty-icon">⚠️</div>' +
        '<p>Preview failed to build</p>' +
        '<p class="empty-sub">' + esc(err && err.message ? err.message : String(err)) + '</p>';
      pe.style.display = '';
    }
    if (fw) fw.classList.remove('has-content');
  }
}

function scrollToSection(sectionId) {
  if (!sectionId) return;
  _pendingScrollId = sectionId;
  switchTab('preview');
  updatePreview();
}

/* ── Sections detection ── */
var SECTION_ICONS = { header: '🏁', nav: '🗺️', main: '📄', section: '📑', article: '📰', aside: '💬', footer: '🦶' };
function detectSections(htmlCode) {
  var re = /<(section|article|header|footer|aside|nav)\b([^>]*)>/g;
  var matches = [];
  var m;
  while ((m = re.exec(htmlCode)) !== null) {
    matches.push({ tag: m[1], attrs: m[2] || '', index: m.index });
  }
  var items = [];
  for (var i = 0; i < matches.length; i++) {
    var mm = matches[i];
    var idMatch = mm.attrs.match(/id=["']([^"']+)["']/);
    var id = idMatch ? idMatch[1] : '';
    var end = i + 1 < matches.length ? matches[i + 1].index : htmlCode.length;
    var seg = htmlCode.slice(mm.index, end);
    var hm = seg.match(/<(h1|h2|h3|h4)[^>]*>([\s\S]*?)<\/\1>/);
    var label = hm ? hm[2].replace(/<[^>]+>/g, '').trim() : '';
    if (!label) label = id ? id.replace(/[-_]+/g, ' ') : mm.tag;
    if (label.length > 42) label = label.substring(0, 42) + '…';
    items.push({ tag: mm.tag, id: id, label: label });
  }
  return items;
}

function renderSections() {
  // The Suggestions tab: dynamic, content-aware gap suggestions (not a static list).
  var typeEl = el('suggest-page-type');
  if (typeEl) {
    var hasCode = !!(DB.code.html || '').trim() || !!(DB.code.css || '').trim() || !!(DB.code.js || '').trim();
    typeEl.textContent = hasCode
      ? '🔍 Detected page type: ' + _detectPageType(DB.code.html || '') + ' — these are the sections your page is missing ↓'
      : '🌱 No page yet — describe it in the chat and tailored suggestions will appear here.';
  }
  renderSkillChips();
  renderSectionSuggestions();
}

/* ── Dynamic section suggestions — computed from the current page content ── */
var PAGE_TYPE_FINGERPRINTS = [
  { id: 'restaurant', re: /\b(menu|dish|chef|reservation|reserve|coffee|caf[ée]|cuisine|drink)\b/gi },
  { id: 'saas', re: /\b(pricing|trial|dashboard|integration|feature|faq|sign ?up)\b/gi },
  { id: 'product', re: /\b(product|cart|shop|store|order|checkout|price)\b/gi },
  { id: 'portfolio', re: /\b(portfolio|project|skills?|case study)\b/gi },
  { id: 'event', re: /\b(event|schedule|agenda|speaker|venue|ticket|countdown)\b/gi },
  { id: 'realestate', re: /\b(property|properties|listing|beds?|baths?|agent|estate)\b/gi },
  { id: 'company', re: /\b(mission|vision|about us|clients|values|corporate)\b/gi }
];
function _detectPageType(html) {
  var h = html || '';
  var best = 'general';
  var bestScore = 0;
  for (var i = 0; i < PAGE_TYPE_FINGERPRINTS.length; i++) {
    var fp = PAGE_TYPE_FINGERPRINTS[i];
    var hits = h.match(fp.re);
    var score = hits ? hits.length : 0;
    if (score > bestScore) { bestScore = score; best = fp.id; }
  }
  return best;
}

var TYPE_SECTION_ORDER = {
  restaurant: ['gallery', 'testimonials', 'locations', 'events', 'newsletter', 'cta', 'faq'],
  saas: ['pricing', 'testimonials', 'faq', 'stats', 'services', 'newsletter', 'cta'],
  product: ['pricing', 'gallery', 'testimonials', 'faq', 'newsletter', 'cta', 'stats'],
  portfolio: ['services', 'testimonials', 'gallery', 'process', 'newsletter', 'contact', 'cta'],
  event: ['faq', 'gallery', 'sponsors', 'newsletter', 'testimonials', 'cta'],
  realestate: ['testimonials', 'faq', 'services', 'newsletter', 'cta', 'gallery'],
  company: ['services', 'testimonials', 'team', 'faq', 'newsletter', 'contact', 'cta'],
  general: ['services', 'testimonials', 'pricing', 'gallery', 'faq', 'stats', 'team', 'contact', 'cta', 'newsletter', 'process', 'locations', 'events', 'sponsors']
};

function _suggestCtx() {
  var labels = [];
  var items = detectSections(DB.code.html || '');
  for (var i = 0; i < items.length; i++) labels.push(items[i].label);
  return {
    brand: _parentBrand() || 'this site',
    color: _p('colorScheme', 'indigo'),
    typography: _p('typography', 'modern-sans'),
    lang: _p('lang', 'en'),
    existing: labels,
    pageType: _detectPageType(DB.code.html || '')
  };
}

var SECTION_CANDIDATES = {
  testimonials: {
    label: 'Testimonials', icon: '💬',
    detect: /testimonial|review|what (our )?(clients|customers) (say|love)/i,
    prompt: function(c) {
      return [
        'Add a testimonials section for ' + c.brand + ' with 3 customer reviews, star ratings and avatar photos.',
        'Write the quotes so they reinforce what the existing sections promise' + (c.existing.length ? ' (' + c.existing.slice(0, 3).join(', ') + '…)' : '.')
      ];
    }
  },
  pricing: {
    label: 'Pricing', icon: '💰',
    detect: /pricing|price|plan|tier|per month|\$\d/i,
    prompt: function(c) {
      return [
        'Add a pricing section with 3 tiers, a monthly/yearly toggle and a highlighted popular plan.',
        'Base the tier features on what the page already offers' + (c.existing.length ? ' (' + c.existing.slice(0, 3).join(', ') + '…)' : '.')
      ];
    }
  },
  faq: {
    label: 'FAQ', icon: '❓',
    detect: /faq|frequently asked/i,
    prompt: function(c) {
      return ['Add an FAQ section with 6 questions in accordion style, covering the questions a visitor of this ' + c.pageType + ' page would actually ask.'];
    }
  },
  team: {
    label: 'Team', icon: '👥',
    detect: /\bteam\b|staff|founder|member/i,
    prompt: function(c) {
      return ['Add a team section with 4 member cards (photos, names, roles) for ' + c.brand + '.'];
    }
  },
  gallery: {
    label: 'Gallery', icon: '🖼️',
    detect: /gallery|photos|images/i,
    prompt: function(c) {
      return ['Add a photo gallery grid with a lightbox effect, using imagery that matches the existing page content' + (c.existing.length ? ' (' + c.existing.slice(0, 3).join(', ') + '…)' : '.')];
    }
  },
  contact: {
    label: 'Contact', icon: '✉️',
    detect: /contact|get in touch|visit us|reach us/i,
    prompt: function(c) {
      return ['Add a contact section with a form, phone, email, address and a map placeholder for ' + c.brand + '.'];
    }
  },
  cta: {
    label: 'Call-to-action', icon: '📣',
    detect: /call to action|cta|get started|book now|start free/i,
    prompt: function(c) {
      return ['Add a bold call-to-action band near the end with one big primary button, following the ' + c.color + ' palette and ' + c.typography + ' typography.'];
    }
  },
  stats: {
    label: 'Stats', icon: '📊',
    detect: /stat|counter|years of|milestone/i,
    prompt: function(c) {
      return ['Add a stats band with 4 animated counters (years, clients, projects, awards) relevant to ' + c.brand + '.'];
    }
  },
  services: {
    label: 'Services', icon: '🛠️',
    detect: /service|offering|what we do/i,
    prompt: function(c) {
      return ['Add a services section with 4-6 cards describing the main offerings of ' + c.brand + '.'];
    }
  },
  process: {
    label: 'How it works', icon: '🧭',
    detect: /process|how it works|step|workflow/i,
    prompt: function(c) {
      return ['Add a "How it works" process section with 3-4 numbered steps a visitor follows.'];
    }
  },
  locations: {
    label: 'Locations / Hours', icon: '📍',
    detect: /location|opening hours|find us|opening/i,
    prompt: function(c) {
      return ['Add a locations / opening-hours section with address cards and a map placeholder.'];
    }
  },
  events: {
    label: 'Events', icon: '📅',
    detect: /event|upcoming|calendar|schedule/i,
    prompt: function(c) {
      return ['Add an upcoming events section with 3 event cards (date, title, location, register button).'];
    }
  },
  sponsors: {
    label: 'Sponsors / Partners', icon: '🤝',
    detect: /sponsor|partner|supported by/i,
    prompt: function(c) {
      return ['Add a sponsors / partners strip with 6 placeholder logos.'];
    }
  },
  newsletter: {
    label: 'Newsletter', icon: '📬',
    detect: /newsletter|subscribe|email sign ?up/i,
    prompt: function(c) {
      return ['Add a newsletter signup section with an email input and a subscribe button.'];
    }
  }
};

/* Sections the current page is still missing, ordered by page type — shared by
   the Suggestions tab and the plan-completion next-step chips. */
function _missingSectionPicks() {
  var htmlCode = DB.code.html || '';
  // 1) candidates already covered by content keywords
  var present = {};
  for (var k in SECTION_CANDIDATES) {
    if (Object.prototype.hasOwnProperty.call(SECTION_CANDIDATES, k) && SECTION_CANDIDATES[k].detect.test(htmlCode)) present[k] = true;
  }
  // 2) candidates whose id shows up as an element id
  var idRe = /id=["']([^"']+)["']/g;
  var im;
  while ((im = idRe.exec(htmlCode)) !== null) {
    var cid = String(im[1]).toLowerCase();
    for (var k2 in SECTION_CANDIDATES) {
      if (Object.prototype.hasOwnProperty.call(SECTION_CANDIDATES, k2) && (cid === k2 || cid.indexOf(k2) !== -1)) present[k2] = true;
    }
  }
  // 3) order by detected page type, then the rest — skip what exists
  var order = TYPE_SECTION_ORDER[_detectPageType(htmlCode)] || TYPE_SECTION_ORDER.general;
  var seen = {};
  var picks = [];
  var pushPick = function(k) {
    if (seen[k] || present[k] || !SECTION_CANDIDATES[k]) return;
    seen[k] = true;
    picks.push(k);
  };
  for (var oi = 0; oi < order.length && picks.length < 8; oi++) pushPick(order[oi]);
  for (var k3 in SECTION_CANDIDATES) {
    if (picks.length >= 8) break;
    if (Object.prototype.hasOwnProperty.call(SECTION_CANDIDATES, k3)) pushPick(k3);
  }
  return picks;
}

/* Next-step chips for agentic plan completion (parity with single-shot chat). */
function _planNextSteps() {
  var options = [];
  var picks = _missingSectionPicks();
  for (var i = 0; i < picks.length && options.length < 3; i++) {
    var c = SECTION_CANDIDATES[picks[i]];
    if (c) options.push({ id: 'suggest_' + picks[i], text: c.icon + ' ' + c.label });
  }
  if (options.length < 3) options.push({ id: 'suggest_darkmode', text: '🌙 Add dark mode toggle' });
  if (options.length < 3) options.push({ id: 'suggest_animations', text: '✨ Add scroll-reveal animations' });
  if (options.length < 3) options.push({ id: 'suggest_mobile', text: '📱 Improve the mobile experience' });
  return options.slice(0, 4);
}

function renderSectionSuggestions() {
  var box = el('qa-chips');
  var row = el('quick-add-row');
  if (!box) return;
  var htmlCode = DB.code.html || '';
  var hasAnyContent = !!(htmlCode.trim() || (DB.code.css || '').trim() || (DB.code.js || '').trim());
  if (!hasAnyContent) {
    if (row) row.style.display = '';
    box.innerHTML = '<span class="qa-hint">🌱 No page yet — describe your page in the chat and tailored suggestions will appear here.</span>';
    return;
  }

  var picks = _missingSectionPicks();

  if (row) row.style.display = '';
  if (!picks.length) {
    box.innerHTML = '<span class="qa-hint">✅ No obvious gaps — your page already covers the common sections. Describe anything else in the chat.</span>';
    return;
  }
  var h = '';
  for (var pi = 0; pi < picks.length; pi++) {
    var c = SECTION_CANDIDATES[picks[pi]];
    h += '<button class="qa-chip" data-qa="' + esc(picks[pi]) + '" title="Add this section with a context-aware prompt">' + c.icon + ' ' + esc(c.label) + '</button>';
  }
  box.innerHTML = h;
  var chips = box.querySelectorAll('.qa-chip');
  for (var ci = 0; ci < chips.length; ci++) {
    chips[ci].onclick = function() { quickAddSection(this.getAttribute('data-qa')); };
  }
}

function buildSectionPrompt(kind) {
  var c = SECTION_CANDIDATES[kind];
  if (!c) return null;
  var ctx = _suggestCtx();
  var lines = c.prompt(ctx);
  lines.push('');
  lines.push('CONTEXT — keep it consistent:');
  lines.push('- Existing sections: ' + (ctx.existing.length ? ctx.existing.join(', ') : 'none yet — this will be the first section.'));
  lines.push('- Design tokens: ' + ctx.color + ' palette · ' + ctx.typography + ' typography · copy language: ' + ctx.lang + '.');
  lines.push('- Keep the existing page class prefix and scope all new CSS under it; the gw- prefix is RESERVED for the platform (never define gw-* rules); use unique, prefixed ids; helpers on gw.ns; follow all PublicWebsite page rules (body fragment, one <h1>, scoped CSS, idempotent JS, no site header/footer).');
  return lines.join('\n');
}

function quickAddSection(kind) {
  var inp = el('chat-input');
  if (!inp) return;
  var prompt = buildSectionPrompt(kind);
  if (!prompt) return;
  if (inp.value.trim()) inp.value += '\n\n' + prompt;
  else inp.value = prompt;
  inp.style.height = 'auto';
  inp.style.height = Math.min(inp.scrollHeight, 160) + 'px';
  switchChatTab('chat');
  inp.focus();
}

/* ── Compliance engine — automated checks against the active rules file ── */
var _complianceResults = null;
var _reviewActive = false;
var _reviewToken = null;

var GENERIC_CLASS_NAMES = [
  'container', 'wrapper', 'section', 'header', 'footer', 'navbar', 'nav', 'hero',
  'title', 'subtitle', 'text', 'btn', 'button', 'card', 'grid', 'row', 'col',
  'item', 'items', 'list', 'link', 'links', 'menu', 'form', 'input', 'label',
  'icon', 'badge', 'box', 'main', 'content', 'body', 'active', 'open', 'hidden',
  'show', 'left', 'right', 'center', 'small', 'large', 'big', 'primary',
  'secondary', 'modal', 'dropdown', 'close', 'logo', 'image', 'img', 'price',
  'tag', 'name', 'date', 'desc', 'intro', 'feature', 'features', 'testimonial',
  'pricing', 'faq', 'contact', 'team', 'gallery', 'footer-links', 'cta'
];

function _collectClasses(html, css) {
  var map = {};
  var re = /class="([^"]+)"/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    var tokens = m[1].split(/\s+/);
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i]) map[tokens[i]] = true;
    }
  }
  var re2 = /\.([a-zA-Z][\w-]*)/g;
  while ((m = re2.exec(css)) !== null) map[m[1]] = true;
  return Object.keys(map);
}

function _getHeadings(html) {
  var out = [];
  var re = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    out.push({ level: parseInt(m[1], 10), text: m[2].replace(/<[^>]+>/g, '').trim() });
  }
  return out;
}

function _getImgs(html) {
  var out = [];
  var re = /<img\b([^>]*?)>/gi;
  var m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

function gwChecks() {
  return [
    {
      id: 'one-h1', section: '8', label: 'Exactly one <h1>',
      run: function(h) {
        var hs = _getHeadings(h).filter(function(x) { return x.level === 1; });
        if (hs.length === 1) return { status: 'pass', detail: 'One <h1> found: "' + hs[0].text.substring(0, 60) + '"' };
        if (hs.length === 0) return { status: 'fail', detail: 'No <h1> found — every page needs exactly one, as the first heading, containing the primary keyword.' };
        return { status: 'fail', detail: hs.length + ' <h1> tags found — only ONE is allowed.' };
      }
    },
    {
      id: 'heading-order', section: '8', label: 'Heading hierarchy (no skips)',
      run: function(h) {
        var hs = _getHeadings(h);
        if (!hs.length) return { status: 'warn', detail: 'No headings found at all.' };
        for (var i = 1; i < hs.length; i++) {
          if (hs[i].level > hs[i - 1].level + 1) {
            return { status: 'fail', detail: 'Heading level jumps h' + hs[i - 1].level + ' → h' + hs[i].level + ' ("' + hs[i].text.substring(0, 40) + '"). Never skip levels.' };
          }
        }
        return { status: 'pass', detail: 'Headings follow a logical hierarchy.' };
      }
    },
    {
      id: 'semantic-tags', section: '8', label: 'Semantic HTML5 structure',
      run: function(h) {
        var tags = (h.match(/<(article|section|aside|nav|main)\b/gi) || []);
        if (tags.length >= 2) return { status: 'pass', detail: tags.length + ' semantic landmark tags used.' };
        return { status: 'warn', detail: 'Few or no semantic landmarks (<article>/<section>/<aside>/<nav>/<main>) — the site header/footer come from the platform shell. Add page-level semantic structure for SEO and accessibility.' };
      }
    },
    {
      id: 'no-document-tags', section: '3.1', label: 'Body fragment only (no document tags)',
      run: function(h, c, j) {
        var bad = [];
        var hb = h.match(/<\/?(html|head|body)\b[^>]*>/gi);
        if (hb) bad = bad.concat(hb);
        if (/<!doctype/i.test(h)) bad.push('<!DOCTYPE>');
        if (bad.length) return { status: 'fail', detail: 'Document tags found: ' + bad.slice(0, 4).join(', ') + ' — your HTML is a PURE BODY FRAGMENT injected into the platform container.' };
        var embedded = [];
        if (/<style\b/i.test(h)) embedded.push('<style>');
        if (/<script\b/i.test(h)) embedded.push('<script>');
        if (embedded.length) return { status: 'warn', detail: embedded.join(', ') + ' embedded in the HTML fragment — tolerated (hoisted) but prefer keeping ALL styling in the CSS section and ALL behavior in the JS section.' };
        return { status: 'pass', detail: 'Clean body fragment — no <html>/<head>/<body>/<!DOCTYPE> tags.' };
      }
    },
    {
      id: 'css-scope', section: '3.4', label: 'CSS scoped under a page class',
      run: function(h, c) {
        if (!c.trim()) return { status: 'pass', detail: 'No CSS.' };
        var rootClass = (h.match(/class="([^"\s]+)/) || [])[1];
        var bare = c.match(/(^|})\s*(html|body|\*|a|button|h1|h2|h3|p|ul|li|img|form|input|table|div)\s*\{/gm);
        if (bare && bare.length) {
          var labels = [];
          for (var bi = 0; bi < bare.length && bi < 4; bi++) {
            var m2 = bare[bi].match(/(html|body|\*|a|button|h1|h2|h3|p|ul|li|img|form|input|table|div)\s*\{$/);
            if (m2) labels.push(m2[1]);
          }
          return { status: 'fail', detail: 'Bare/global selectors found: ' + labels.join(', ') + ' — CSS is injected GLOBALLY into the page. Scope EVERY rule under your unique page class (e.g. .' + (rootClass || 'shop-home') + ' a { … }).' };
        }
        var scoped = (c.match(/\.\s*[a-zA-Z][\w-]*/g) || []).length;
        if (!scoped) return { status: 'warn', detail: 'No class selectors found — scope all rules under a unique page class to avoid leaking into the site shell.' };
        return { status: 'pass', detail: 'CSS uses class-scoped selectors — no bare element/global styling.' };
      }
    },
    {
      id: 'img-alt', section: '8', label: 'Images have alt text',
      run: function(h) {
        var imgs = _getImgs(h);
        var missing = 0;
        for (var i = 0; i < imgs.length; i++) {
          if (!/\balt=/.test(imgs[i])) missing++;
        }
        if (missing) return { status: 'fail', detail: missing + ' of ' + imgs.length + ' <img> tags missing alt text.' };
        if (imgs.length) return { status: 'pass', detail: 'All ' + imgs.length + ' images have alt text.' };
        return { status: 'pass', detail: 'No images used.' };
      }
    },
    {
      id: 'img-size', section: '8', label: 'Images have width & height',
      run: function(h) {
        var imgs = _getImgs(h);
        var missing = 0;
        for (var i = 0; i < imgs.length; i++) {
          var hasW = /\bwidth=/.test(imgs[i]);
          var hasH = /\bheight=/.test(imgs[i]);
          if (!hasW || !hasH) missing++;
        }
        if (missing) return { status: 'warn', detail: missing + ' <img> tag(s) without explicit width & height — set them to avoid CLS (or rely on next/image `image` blocks).' };
        if (imgs.length) return { status: 'pass', detail: 'All images declare width & height.' };
        return { status: 'pass', detail: 'No images used.' };
      }
    },
    {
      id: 'img-loading', section: '8', label: 'Lazy loading on images',
      run: function(h) {
        var imgs = _getImgs(h);
        var missing = 0;
        for (var i = 0; i < imgs.length; i++) {
          if (!/\bloading=/.test(imgs[i])) missing++;
        }
        if (missing) return { status: 'warn', detail: missing + ' <img> tag(s) without loading attribute — use loading="lazy" below the fold and loading="eager" fetchpriority="high" on the hero image.' };
        if (imgs.length) return { status: 'pass', detail: 'All images declare a loading strategy.' };
        return { status: 'pass', detail: 'No images used.' };
      }
    },
    {
      id: 'img-source', section: '3.4', label: 'External images allowed',
      run: function(h) {
        var imgs = _getImgs(h);
        var external = 0;
        for (var i = 0; i < imgs.length; i++) {
          var sm = imgs[i].match(/src=["'](https?:\/\/[^"']+)/i);
          if (sm) external++;
        }
        if (external) return { status: 'pass', detail: external + ' external image URL(s) — absolute image URLs are supported by the platform.' };
        if (imgs.length) return { status: 'pass', detail: 'No external image hotlinks.' };
        return { status: 'pass', detail: 'No images used.' };
      }
    },
    {
      id: 'links-spa', section: '3.5', label: 'SPA-aware internal links',
      run: function(h) {
        var internal = (h.match(/href=["']\/[^"']*["']/gi) || []).length;
        var spaNav = (h.match(/data-ic-nav-href/g) || []).length;
        if (internal > spaNav) return { status: 'warn', detail: internal + ' internal link(s) but only ' + spaNav + ' use data-ic-nav-href — add data-ic-nav-href to internal links (keep href for SEO fallback) or call gw.navigate() so navigation stays SPA-fast.' };
        var abs = (h.match(/href=["']https?:\/\/[^"']+["']/gi) || []).length;
        if (abs > 4) return { status: 'warn', detail: abs + ' absolute hrefs — don\'t hard-code the host domain for internal links.' };
        return { status: 'pass', detail: 'Internal links are SPA-aware and no hard-coded host domains.' };
      }
    },
    {
      id: 'form-protocol', section: '6', label: 'Forms follow data-gw-form protocol',
      run: function(h, j) {
        var forms = (h.match(/<form\b/gi) || []).length;
        if (!forms) return { status: 'pass', detail: 'No forms on this page.' };
        var ok = /data-gw-form/.test(h);
        var hp = /(?:name=["'](?:gw_hp|website|company)["']|data-gw-honeypot)/.test(h);
        var status = /data-gw-form-status/.test(h);
        var bind = /gw\.forms\.bind\s*\(/.test(j);
        var problems = [];
        if (!ok) problems.push('form lacks data-gw-form');
        if (!hp) problems.push('no honeypot field (gw_hp/website/company)');
        if (!status) problems.push('no [data-gw-form-status] element');
        if (!bind) problems.push('gw.forms.bind() not called in JS');
        if (problems.length) return { status: 'warn', detail: problems.join('; ') + ' — follow the data-gw-form protocol so submissions reach the CMS form type.' };
        return { status: 'pass', detail: 'Form follows the data-gw-form protocol (bind + honeypot + status).' };
      }
    },
    {
      id: 'widget-config', section: '11', label: 'data-gw-config is valid JSON',
      run: function(h) {
        var re = /data-gw-config=(["'])([\s\S]*?)\1/g;
        var m;
        var bad = 0;
        while ((m = re.exec(h)) !== null) {
          var raw = m[2].replace(/&quot;/g, '"');
          try { JSON.parse(raw); } catch (e) { bad++; }
        }
        if (bad) return { status: 'fail', detail: bad + ' data-gw-config attribute(s) are NOT valid JSON — no comments, no trailing commas, double-quoted strings.' };
        return { status: 'pass', detail: 'All data-gw-config attributes are valid JSON.' };
      }
    },
    {
      id: 'reserved-names', section: '4', label: 'Honeypot names not used for real fields',
      run: function(h) {
        var bad = (h.match(/<(input|textarea|select)\b[^>]*name=["'](?:gw_hp|website|company)["'][^>]*(?!data-gw-honeypot)>/gi) || []);
        if (bad.length) return { status: 'fail', detail: bad.length + ' real field(s) use reserved honeypot names (gw_hp/website/company) — submissions would be silently dropped.' };
        return { status: 'pass', detail: 'Reserved honeypot names are not used for real fields.' };
      }
    },
    {
      id: 'no-document-write', section: '4', label: 'No document.write',
      run: function(h, c, j) {
        if (/document\.write\s*\(/.test(j)) return { status: 'fail', detail: 'document.write found — it is forbidden on the platform (SPA lifecycles break).' };
        return { status: 'pass', detail: 'No document.write.' };
      }
    },
    {
      id: 'no-frameworks', section: '3.4', label: 'No external JS libraries / CDN scripts',
      run: function(h, c, j) {
        var all = (h + '\n' + j).toLowerCase();
        var hits = [];
        ['jquery', 'bootstrap', 'tailwind', 'cdn.jsdelivr', 'unpkg', 'cdnjs.cloudflare'].forEach(function(lib) {
          if (all.indexOf(lib) !== -1) hits.push(lib);
        });
        if (/<script\b[^>]*\bsrc=/.test(h)) hits.push('external <script src>');
        if (hits.length) return { status: 'fail', detail: 'Forbidden libraries/scripts detected: ' + hits.join(', ') + ' — plain vanilla JavaScript only; external <script src> is not supported.' };
        return { status: 'pass', detail: 'No external libraries or CDN scripts.' };
      }
    },
    {
      id: 'secrets', section: '15', label: 'No secrets in code',
      run: function(h, c, j) {
        var all = h + '\n' + j;
        var hits = all.match(/(sk_live_[A-Za-z0-9]+|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=]\s*['"][^'"]{8,}['"]|secret\s*[:=]\s*['"][^'"]{6,}['"])/gi);
        if (hits) return { status: 'fail', detail: 'Possible secret(s) in code: ' + hits.slice(0, 3).join(', ') + ' — API keys must live server-side in env vars, NEVER in content.' };
        return { status: 'pass', detail: 'No secrets detected.' };
      }
    },
    {
      id: 'gw-reserved-prefix', section: '3.4', label: 'gw- prefix reserved for the platform',
      run: function(h, c) {
        var defined = c.match(/\.gw-[a-zA-Z][\w-]*\s*[\[{:]/g) || [];
        if (defined.length) return { status: 'fail', detail: defined.length + ' gw-* selector(s) DEFINED in page CSS — the gw- prefix is reserved for the platform shell, widgets and sharedCss. Use --gw-color-* variables and gw-shared-* classes, but define your own rules under your page class.' };
        return { status: 'pass', detail: 'No gw-* rules defined in page CSS (using reserved classes is allowed, defining them is not).' };
      }
    },
    {
      id: 'sections-valid', section: '12.3', label: 'data.sections flat & ordered (max 20)',
      run: function() {
        var pm = DB.pageMeta;
        var secs = pm && pm.data && pm.data.sections;
        if (!secs) return { status: 'pass', detail: 'No reusable sections declared.' };
        if (!Array.isArray(secs)) return { status: 'warn', detail: 'data.sections must be an array of {cmsObjectType, objectId}.' };
        if (secs.length > 20) return { status: 'fail', detail: 'data.sections has ' + secs.length + ' entries — the platform limit is 20 (flat, ordered).' };
        var bad = 0;
        for (var i = 0; i < secs.length; i++) {
          if (!secs[i] || typeof secs[i] !== 'object' || !secs[i].cmsObjectType || !secs[i].objectId) bad++;
        }
        if (bad) return { status: 'fail', detail: bad + ' section reference(s) missing cmsObjectType/objectId.' };
        return { status: 'pass', detail: secs.length + ' reusable section reference(s) — flat and valid.' };
      }
    },
    {
      id: 'js-idempotent', section: '3.3', label: 'JS idempotent (SPA re-runs)',
      run: function(h, c, j) {
        if (!j.trim()) return { status: 'pass', detail: 'No JavaScript needed.' };
        var iife = /^\(function|^\(\s*function|^;?\(function/.test(j.trim());
        var guard = /__[A-Za-z_$][\w$]*(Init|Ready|Mounted|Loaded)/.test(j);
        var usesNs = /gw\.ns/.test(j);
        var winListeners = /(window|document)\.addEventListener/.test(j);
        var topAwait = /(^|\n)\s*await\s/.test(j);
        var problems = [];
        if (!iife && !/\(function/.test(j)) problems.push('not wrapped in an IIFE');
        if (winListeners && !guard) problems.push('window/document listeners without a __xInit guard (listeners leak across SPA navigations)');
        if (topAwait) problems.push('top-level await (scripts run in a non-async wrapper)');
        if (problems.length) return { status: 'warn', detail: problems.join('; ') + ' — your JS re-runs on every SPA navigation. Attach page helpers to gw.ns, never to hoisted window functions.' };
        return { status: 'pass', detail: usesNs ? 'Script is idempotent and uses gw.ns for helpers.' : 'Script is idempotent (IIFE + guarded listeners, no top-level await).' };
      }
    },
    {
      id: 'xss-escape', section: '15', label: 'Escape user data before innerHTML',
      run: function(h, c, j) {
        if (!j.trim()) return { status: 'pass', detail: 'No JavaScript needed.' };
        var inner = (j.match(/\.innerHTML\s*=/g) || []).length;
        if (!inner) return { status: 'pass', detail: 'No innerHTML writes of user data.' };
        var hasEsc = /function\s+(esc|escapeHtml|sanitize)\s*\(|\.textContent\s*=/.test(j);
        if (hasEsc) return { status: 'pass', detail: 'innerHTML used but an escape/sanitize helper or textContent is present.' };
        return { status: 'warn', detail: 'innerHTML writes detected — render user/data content with textContent or gw.sanitize(html); never interpolate values into innerHTML.' };
      }
    },
    {
      id: 'media-queries', section: '11', label: 'Mobile-first media queries',
      run: function(h, c) {
        if (!/@media/i.test(c)) return { status: 'warn', detail: 'No @media queries — mobile responsiveness is MANDATORY. Add breakpoints at 640/768/1024/1280.' };
        return { status: 'pass', detail: 'Media queries present — verify at 320/375/768/1024 in the device preview.' };
      }
    },
    {
      id: 'reduced-motion', section: '11', label: 'prefers-reduced-motion support',
      run: function(h, c) {
        var animated = /@keyframes|animation:|transition:/.test(c);
        if (!animated) return { status: 'pass', detail: 'No heavy animations to reduce.' };
        if (/prefers-reduced-motion/.test(c)) return { status: 'pass', detail: 'Animations respect prefers-reduced-motion.' };
        return { status: 'warn', detail: 'Animations/transitions found without a @media (prefers-reduced-motion: reduce) override — add one for accessibility.' };
      }
    },
    {
      id: 'tap-targets', section: '11', label: 'Touch targets ≥ 48px',
      run: function(h, c) {
        var ok = /(min-(width|height):\s*48px|padding:\s*(1[2-9]|[2-9]\d)px)/.test(c);
        if (ok) return { status: 'pass', detail: 'Sizing hints for 48px+ tap targets detected.' };
        return { status: 'warn', detail: 'No clear 48×48px tap-target sizing detected on buttons/links — check interactives on mobile.' };
      }
    },
    {
      id: 'seo-section', section: '13', label: 'SEO section present (=== SEO ===)',
      run: function() {
        var seo = DB.seo;
        if (!seo || typeof seo !== 'object') return { status: 'warn', detail: 'No === SEO === JSON captured yet — ask the AI to add one (metaTitle + metaDesc + schemaItems at minimum).' };
        var problems = [];
        if (!seo.metaTitle) problems.push('metaTitle missing');
        else if (String(seo.metaTitle).length > 60) problems.push('metaTitle is ' + String(seo.metaTitle).length + ' chars (> 60)');
        if (!seo.metaDesc) problems.push('metaDesc missing');
        else if (String(seo.metaDesc).length > 160) problems.push('metaDesc is ' + String(seo.metaDesc).length + ' chars (> 160)');
        if (problems.length) return { status: 'warn', detail: problems.join('; ') + '.' };
        return { status: 'pass', detail: 'SEO section complete (title/description within best-practice limits).' };
      }
    },
    {
      id: 'page-meta-section', section: '2', label: 'Page meta present (=== PAGE META ===)',
      run: function() {
        var pm = DB.pageMeta;
        if (!pm || typeof pm !== 'object') return { status: 'warn', detail: 'No === PAGE META === JSON captured yet — the platform defaults to published/English; ask the AI to add one (name, slug, meta.language, data.status).' };
        var problems = [];
        if (!pm.name && !pm.slug) problems.push('name/slug missing');
        if (pm.slug && /^(default-settings|default-header|default-footer)$/.test(String(pm.slug))) problems.push('slug is a reserved platform slug');
        if (problems.length) return { status: 'warn', detail: problems.join('; ') + '.' };
        return { status: 'pass', detail: 'Page meta captured (slug: ' + (pm.slug || pm.name || '?') + ').' };
      }
    },
    {
      id: 'budgets', section: '14', label: 'Size budgets (100 KB / 50 KB / 200 KB)',
      run: function(h, c, j) {
        var lh = h.length, lc = c.length, lj = j.length;
        var over = [];
        if (lh > 100000) over.push('HTML ' + Math.round(lh / 1024) + ' KB > 100 KB');
        if (lc > 50000) over.push('CSS ' + Math.round(lc / 1024) + ' KB > 50 KB');
        if (lj > 200000) over.push('JS ' + Math.round(lj / 1024) + ' KB > 200 KB');
        if (over.length) return { status: 'fail', detail: over.join('; ') + ' — trim to stay within performance budgets.' };
        return { status: 'pass', detail: 'HTML ' + Math.round(lh / 1024) + ' KB · CSS ' + Math.round(lc / 1024) + ' KB · JS ' + Math.round(lj / 1024) + ' KB — within budgets.' };
      }
    }
  ];
}

function runComplianceChecks() {
  var h = DB.code.html || '';
  var c = DB.code.css || '';
  var j = DB.code.js || '';
  var defs = gwChecks();
  var results = [];
  var passed = 0, warned = 0, failed = 0;
  for (var i = 0; i < defs.length; i++) {
    var d = defs[i];
    var r;
    try {
      r = d.run(h, c, j);
    } catch (e) {
      r = { status: 'warn', detail: 'Check error: ' + e.message };
    }
    r.id = d.id;
    r.section = d.section;
    r.label = d.label;
    results.push(r);
    if (r.status === 'pass') passed++;
    else if (r.status === 'warn') warned++;
    else failed++;
  }
  _complianceResults = {
    results: results,
    passed: passed,
    warned: warned,
    failed: failed,
    total: results.length,
    time: new Date().toISOString(),
    source: getRulesSourceName()
  };
  return _complianceResults;
}

function _complianceSummary(res) {
  if (!res) res = runComplianceChecks();
  return { passed: res.passed, warned: res.warned, failed: res.failed, total: res.total };
}

function renderCompliance() {
  var list = el('compliance-list');
  var score = el('compliance-score');
  if (!list || !score) return;

  var hasCode = !!(DB.code.html || DB.code.css || DB.code.js);
  if (!hasCode) {
    list.innerHTML = '<div class="sections-empty">No page code yet. Generate a page first, then run the checks.</div>';
    score.innerHTML = '';
    return;
  }

  var res = _complianceResults || runComplianceChecks();
  var pct = Math.round((res.passed / res.total) * 100);
  var verdict = res.failed ? 'FAIL' : res.warned ? 'REVIEW' : 'PASS';
  var cls = res.failed ? 'fail' : res.warned ? 'warn' : 'pass';

  score.innerHTML =
    '<div class="score-ring"><div class="score-pct">' + pct + '%</div><div class="score-total">' + res.passed + '/' + res.total + ' checks</div></div>' +
    '<div class="score-verdict ' + cls + '">' + (res.failed ? '❌' : res.warned ? '⚠️' : '✅') + ' ' + verdict + '</div>' +
    '<div class="score-counts"><span>✅ <b>' + res.passed + '</b> pass</span><span>⚠️ <b>' + res.warned + '</b> warnings</span><span>❌ <b>' + res.failed + '</b> failures</span></div>' +
    '<div class="score-time">Checked at ' + shortTime(res.time) + '</div>';

  var h = '';
  for (var i = 0; i < res.results.length; i++) {
    var r = res.results[i];
    var icon = r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌';
    h += '<div class="compliance-item ' + r.status + '">' +
      '<span class="compliance-item-icon">' + icon + '</span>' +
      '<div class="compliance-item-body">' +
        '<div class="compliance-item-label">' + esc(r.label) +
          '<span class="compliance-item-section">rule §' + esc(r.section) + '</span>' +
        '</div>' +
        '<div class="compliance-item-detail">' + esc(r.detail) + '</div>' +
      '</div>' +
    '</div>';
  }
  list.innerHTML = h;
}

function openComplianceTab() {
  switchTab('advanced');
  switchAdvTab('compliance');
}

function buildReviewPrompt() {
  return [
    'You are a strict compliance reviewer for the UniconHub PublicWebsite platform.',
    'Review the generated page code below against EVERY rule in the ACTIVE RULES file.',
    '',
    '=== ACTIVE RULES ===',
    getActiveRules(),
    '',
    '=== GENERATED PAGE CODE ===',
    '[HTML]\n' + (DB.code.html || '(empty)'),
    '[CSS]\n' + (DB.code.css || '(empty)'),
    '[JS]\n' + (DB.code.js || '(empty)'),
    '',
    'OUTPUT:',
    '1) A checklist — for each rule SECTION (1-18) state PASS or FAIL with a one-line reason.',
    '2) A short overall verdict with the 3 most important fixes.',
    'Do NOT output code blocks in this review — the user will ask for fixes separately.'
  ].join('\n');
}

function runAiReview() {
  if (_aiCallActive || _reviewActive) { showToast('AI is busy — wait a moment.', 'warning'); return; }
  if (!DB.code.html && !DB.code.css && !DB.code.js) { showToast('No page code to review yet.', 'warning'); return; }
  var wrap = el('ai-review-wrap');
  var out = el('ai-review-output');
  var status = el('ai-review-status');
  if (wrap) wrap.style.display = '';
  if (out) out.textContent = '';
  if (status) status.textContent = '🤖 Reviewing the page against the active rules…';

  var prompt = buildReviewPrompt();
  var tok = { cancelled: false };
  _reviewToken = tok;
  _reviewActive = true;
  var full = '';
  var done = function(err) {
    _reviewActive = false;
    _reviewToken = null;
    if (status) status.textContent = err ? ('❌ Review failed: ' + err) : '✓ Review complete. Use 🔧 Fix with AI to resolve the findings.';
    tool.resize();
  };
  if (typeof tool.requestAIStream === 'function') {
    try {
      tool.requestAIStream(prompt, '', {
        onToken: function(t) {
          if (tok.cancelled) return;
          full += t;
          if (out) { out.textContent = full; out.scrollTop = out.scrollHeight; }
        },
        onComplete: function() { done(null); },
        onError: function(e) { done(e); }
      });
    } catch (e) { done(e.message); }
  } else {
    try {
      tool.requestAI(prompt, '', function(err, response) {
        if (response) {
          full = response;
          if (out) out.textContent = full;
          done(null);
        } else { done(err || 'no response'); }
      });
    } catch (e) { done(e.message); }
  }
}

function fixWithAi() {
  if (_aiCallActive) { showToast('AI is busy — wait a moment.', 'warning'); return; }
  var res = _complianceResults || runComplianceChecks();
  var fails = [];
  for (var i = 0; i < res.results.length; i++) {
    if (res.results[i].status !== 'pass') fails.push(res.results[i]);
  }
  if (!fails.length) { showToast('All compliance checks already pass! 🎉', 'success'); return; }
  var lines = ['Please fix the following PublicWebsite rules-compliance issues in the page:'];
  for (var j = 0; j < fails.length; j++) {
    lines.push('- ' + fails[j].label + ' — ' + fails[j].detail);
  }
  var inp = el('chat-input');
  if (inp) {
    inp.value = lines.join('\n');
    inp.style.height = 'auto';
    inp.style.height = Math.min(inp.scrollHeight, 160) + 'px';
  }
  switchChatTab('chat');
  sendChatMessage();
}

/* ── Full page assembly + export ── */
/* Minimal window.gw stub injected into the preview iframe AND the standalone
   download so generated pages (gw.db / gw.forms / widgets) still run outside
   the real platform. */
function _gwPreviewMockScript(lang) {
  return '<script>\n(function(){var L=' + JSON.stringify(lang || 'en') + ';var gw={\n' +
    'pageId:"preview",siteId:"preview",folderId:"preview",language:L,host:"preview",currency:"USD",\n' +
    'ns:{},\n' +
    'getPageParams:function(){return {slug:"preview"};},\n' +
    'navigate:function(){return false;},\n' +
    'openUrl:function(u){window.open(u,"_blank");},\n' +
    'onRouteChange:function(){return function(){};},\n' +
    'getUser:function(){return null;},\n' +
    'isAuthenticated:function(){return false;},\n' +
    'authReady:Promise.resolve(null),\n' +
    'refreshAuth:function(){return Promise.resolve(null);},\n' +
    'login:function(){return false;},\n' +
    'logout:function(){return false;},\n' +
    'storage:{get:function(k){try{return localStorage.getItem("gw_"+k);}catch(e){return null;}},set:function(k,v){try{localStorage.setItem("gw_"+k,String(v));}catch(e){}},remove:function(k){try{localStorage.removeItem("gw_"+k);}catch(e){}}},\n' +
    'formatCurrency:function(n){return "$"+Number(n||0).toFixed(2);},\n' +
    'formatDate:function(d){return String(d||"");},\n' +
    'notify:function(){},\n' +
    'setLoading:function(){},\n' +
    'showModal:function(html){var m=document.createElement("div");m.style.cssText="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);z-index:99999";m.innerHTML=String(html||"");m.onclick=function(e){if(e.target===m)m.remove();};document.body.appendChild(m);return function(){m.remove();};},\n' +
    'sanitize:function(s){var d=document.createElement("div");d.textContent=String(s||"");return d.innerHTML;},\n' +
    'track:function(){},trackPageView:function(){},\n' +
    'forms:{bind:function(){},submit:function(){return Promise.resolve({ok:true});}},\n' +
    'db:{query:function(){return Promise.resolve({items:[],total:0,page:1,pageSize:0,facets:{},relations:{}});},get:function(){return Promise.resolve(null);},operation:function(){return Promise.resolve({ok:true,result:{}});},subscribe:function(){return function(){};}},\n' +
    'apps:{register:function(){},mount:function(){},unmount:function(){}},\n' +
    'service:function(){return Promise.reject(new Error("gw.service not available"));}\n' +
    '};\n' +
    'if(!window.gw){window.gw=gw;}\n' +
    'window.__gwPreviewMock=true;\n' +
    'setTimeout(function(){try{window.dispatchEvent(new CustomEvent("gw:ready",{detail:{pageId:"preview"}}));window.dispatchEvent(new CustomEvent("gw:content-ready",{detail:{contentId:"preview"}}));}catch(e){}},0);\n' +
    '})();\n<\/script>';
}
function buildFullPage() {
  var c = DB.code;
  var seo = (DB.seo && typeof DB.seo === 'object') ? DB.seo : {};
  var parentSeo = _parentSeo();
  var title = seo.metaTitle || parentSeo.title || 'Webpage';
  var lang = (DB.pageMeta && DB.pageMeta.meta && DB.pageMeta.meta.language) || _p('lang', 'en');
  var fav = '🌐';
  var favSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">' + fav + '</text></svg>';
  var favUri = 'data:image/svg+xml,' + encodeURIComponent(favSvg);
  var meta = '<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + esc(title) + '</title>\n';
  var seoDesc = seo.metaDesc || parentSeo.desc;
  var seoKw = seo.metaKeywords || parentSeo.keywords;
  if (seoDesc) meta += '<meta name="description" content="' + esc(seoDesc) + '">\n';
  if (seoKw) meta += '<meta name="keywords" content="' + esc(seoKw) + '">\n';
  meta += '<link rel="icon" href="' + favUri + '">\n';
  return '<!DOCTYPE html>\n<html lang="' + esc(lang) + '">\n<head>\n' + meta +
    '<style>\n' + (c.css || '') + '\n</style>\n</head>\n<body>\n' + (c.html || '') + '\n' +
    _gwPreviewMockScript(lang) + '\n' +
    '<script>\n' + (c.js || '') + '\n<\/script>\n</body>\n</html>';
}

function pageSlug() {
  return slugify(_parentSlug() || _parentBrand() || 'gw-page');
}

function downloadFullPage() {
  var html = el('code-html') ? el('code-html').value.trim() : '';
  if (!html) { showToast('No page to export yet — generate one first.', 'warning'); return; }
  var content = buildFullPage();
  var blob = new Blob([content], { type: 'text/html' });
  var u = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = u;
  a.download = pageSlug() + '.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(u); }, 1000);
  showToast('Webpage downloaded: ' + a.download, 'success');
}

function exportPdf() {
  var html = el('code-html') ? el('code-html').value.trim() : '';
  if (!html) { showToast('No page to export yet — generate one first.', 'warning'); return; }
  showToast('Preparing PDF export…', 'info');
  try {
    tool.requestExportPdf({ html: buildFullPage(), filename: pageSlug() }, function(err, file) {
      if (err) { showToast('PDF export failed: ' + err, 'error'); return; }
      showToast('Export ready — opening…', 'success');
      tool.openUrl(file.url);
    });
  } catch (e) {
    showToast('PDF export unavailable: ' + e.message, 'warning');
  }
}

function copyToClipboard(text, label) {
  function done(ok) {
    showToast(ok ? (label || 'Copied!') : 'Copy failed', ok ? 'success' : 'error');
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() { done(true); }).catch(function() {
      fallbackCopy(text, done);
    });
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
function copyCurrentTab() {
  var ta = el('code-' + currentTab);
  if (!ta || !ta.value.trim()) { showToast('No code to copy.', 'warning'); return; }
  copyToClipboard(ta.value, currentTab.toUpperCase() + ' copied!');
}
function copyThreeBlocks() {
  var h = el('code-html') ? el('code-html').value.trim() : '';
  var c = el('code-css') ? el('code-css').value.trim() : '';
  var j = el('code-js') ? el('code-js').value.trim() : '';
  if (!h && !c && !j) { showToast('No code yet.', 'warning'); return; }
  copyToClipboard('=== HTML ===\n' + h + '\n\n=== CSS ===\n' + c + '\n\n=== JS ===\n' + j, 'All three sections copied!');
}
function copyFullPage() {
  var html = el('code-html') ? el('code-html').value.trim() : '';
  if (!html) { showToast('No page to copy yet.', 'warning'); return; }
  copyToClipboard(buildFullPage(), 'Full page HTML copied!');
}

/* ── PublicWebsite exports: generator output (=== sections) + page object JSON
   (data.htmlPage.code + seo + page meta, ready for the new platform) ── */
function buildGeneratorOutputText() {
  var seo = DB.seo ? JSON.stringify(DB.seo, null, 2) : '{\n  "metaTitle": "",\n  "metaDesc": ""\n}';
  var pm = DB.pageMeta ? JSON.stringify(DB.pageMeta, null, 2) : '{\n  "name": "Page",\n  "slug": "' + pageSlug() + '",\n  "meta": { "language": "en" }\n}';
  var out = '=== HTML ===\n' + (DB.code.html || '') + '\n\n=== CSS ===\n' + (DB.code.css || '') + '\n\n=== JS ===\n' + (DB.code.js || '') + '\n\n=== SEO ===\n' + seo + '\n\n=== PAGE META ===\n' + pm;
  if (DB.configNeeded) out += '\n\n=== CMS CONFIG NEEDED ===\n' + DB.configNeeded;
  if (DB.emailTemplate) out += '\n\n=== EMAIL TEMPLATE ===\n' + DB.emailTemplate;
  return out;
}
function buildPageObjectJson() {
  var pm = (DB.pageMeta && typeof DB.pageMeta === 'object') ? DB.pageMeta : {};
  var obj = {
    name: pm.name || _parentBrand() || 'Page',
    slug: pm.slug || pageSlug(),
    meta: { language: (pm.meta && pm.meta.language) || _p('lang', 'en') },
    data: {
      status: (pm.data && pm.data.status) || 'published',
      htmlPage: { code: { html: DB.code.html || '', css: DB.code.css || '', js: DB.code.js || '' } }
    },
    seo: DB.seo || {}
  };
  if (pm.data && pm.data.requireAuth) obj.data.requireAuth = pm.data.requireAuth;
  if (pm.data && pm.data.templateContentType) obj.data.templateContentType = pm.data.templateContentType;
  if (pm.data && Array.isArray(pm.data.sections) && pm.data.sections.length) {
    obj.data.sections = pm.data.sections.slice(0, 20); // flat, ordered, max 20
  }
  return JSON.stringify(obj, null, 2);
}
function copyGeneratorOutput() {
  if (!DB.code.html && !DB.code.css && !DB.code.js) { showToast('No page to export yet.', 'warning'); return; }
  copyToClipboard(buildGeneratorOutputText(), 'Generator output copied (=== sections)!');
}
function copyPageObject() {
  if (!DB.code.html && !DB.code.css && !DB.code.js) { showToast('No page to export yet.', 'warning'); return; }
  copyToClipboard(buildPageObjectJson(), 'Page object JSON copied (data.htmlPage.code + seo)!');
}

/* ── History persistence: each snapshot is a SEPARATE object in
   webpagebuilder-history-uniconbaseapps. The main CMS object only ever holds
   the current code + version, so it stays far below the 1 MB Firestore limit. ── */
function _addHistoryEntry(entry) {
  DB.history.unshift(entry);
  while (DB.history.length > HISTORY_MAX) {
    var popped = DB.history.pop();
    if (popped && popped._objId) {
      (function(objId) {
        try { tool.requestObjects('delete', { mainObjectType: HISTORY_TYPE, objectId: objId }, function() {}); } catch (e) {}
      })(popped._objId);
    }
  }
  _saveHistoryObject(entry);
}
function _saveHistoryObject(entry, cb) {
  if (!entry || entry._objId) { if (cb) cb(null); return; }
  var instId = _resolveInstanceId();
  function doCreate() {
    try {
      tool.requestObjects('create', {
        mainObjectType: HISTORY_TYPE,
        name: entry.label ? entry.label.substring(0, 80) : ('Version ' + entry.version),
        productData: {
          data_categoriesBased: {
            version: entry.version || '?',
            time: entry.time || '',
            label: entry.label || 'Generation',
            html: entry.html || '',
            css: entry.css || '',
            js: entry.js || '',
            _toolInstanceId: instId
          }
        }
      }, function(err, result) {
        if (!err && result && result.object) entry._objId = result.object.id;
        if (cb) cb(err ? null : result);
      });
    } catch (e) { if (cb) cb(null); }
  }
  // Prune to HISTORY_MAX - 1 newest objects (per instance) and de-dupe the
  // migration path before creating the new object.
  try {
    tool.requestObjects('query', { mainObjectType: HISTORY_TYPE }, function(qerr, qres) {
      if (!qerr && qres && qres.objects) {
        var mine = [];
        for (var i = 0; i < qres.objects.length; i++) {
          var obj = qres.objects[i];
          var dcb = (obj.productData && obj.productData.data_categoriesBased) || {};
          if (dcb._toolInstanceId !== instId) continue;
          if (dcb.time === entry.time && dcb.version === entry.version && !entry._objId) entry._objId = obj.id; // already stored (migration re-run)
          mine.push({ obj: obj, time: dcb.time || '' });
        }
        mine.sort(function(a, b) { return (a.time || '').localeCompare(b.time || ''); });
        var overflow = mine.length - (HISTORY_MAX - 1);
        for (var j = 0; j < overflow; j++) {
          if (mine[j].obj.id === entry._objId) continue;
          (function(obj) {
            try { tool.requestObjects('delete', { mainObjectType: HISTORY_TYPE, objectId: obj.id }, function() {}); } catch (e) {}
          })(mine[j].obj);
        }
      }
      doCreate();
    });
  } catch (e) { doCreate(); }
}
function deleteHistoryObject(entry, cb) {
  if (!entry) { if (cb) cb(false); return; }
  if (!entry._objId) { if (cb) cb(true); return; }
  try {
    tool.requestObjects('delete', { mainObjectType: HISTORY_TYPE, objectId: entry._objId }, function(err) {
      if (cb) cb(!err);
    });
  } catch (e) { if (cb) cb(false); }
}
function loadHistory(callback) {
  try {
    tool.requestObjects('query', { mainObjectType: HISTORY_TYPE }, function(err, result) {
      var entries = [];
      if (!err && result && result.objects) {
        var myId = _resolveInstanceId();
        for (var i = 0; i < result.objects.length; i++) {
          var obj = result.objects[i];
          var pd = obj.productData || {};
          var dcb = pd.data_categoriesBased || {};
          var isMine = dcb._toolInstanceId === myId ||
            (!dcb._toolInstanceId && obj._parentObjectId && DB._parentRecordId && obj._parentObjectId === DB._parentRecordId);
          if (!isMine) continue;
          entries.push({
            _objId: obj.id,
            version: dcb.version || '?',
            time: dcb.time || '',
            label: dcb.label || 'Generation',
            html: dcb.html || '', css: dcb.css || '', js: dcb.js || ''
          });
        }
      }
      entries.sort(function(a, b) { return (b.time || '').localeCompare(a.time || ''); });
      // Merge with unsaved in-memory entries (dedupe by time+version).
      var local = [];
      for (var j = 0; j < DB.history.length; j++) if (!DB.history[j]._objId) local.push(DB.history[j]);
      var merged = local.concat(entries);
      var seen = {};
      var out = [];
      for (var k = 0; k < merged.length; k++) {
        var key = (merged[k].time || '') + '|' + (merged[k].version || '');
        if (seen[key]) continue;
        seen[key] = true;
        out.push(merged[k]);
      }
      DB.history = out;
      if (callback) callback(out);
    });
  } catch (e) {
    if (callback) callback(DB.history || []);
  }
}

/* ── History ── */
function renderHistoryList() {
  var list = el('history-list');
  if (!list) return;
  if (!DB.history || !DB.history.length) {
    list.innerHTML = '<div class="empty-state">No generations yet. Design your first page!</div>';
    return;
  }
  var h = '';
  for (var i = 0; i < DB.history.length; i++) {
    var e = DB.history[i];
    h += '<div class="history-item">' +
      '<span class="history-ver">v' + esc(e.version || '?') + '</span>' +
      '<div class="history-meta">' +
        '<div class="history-label">' + esc(e.label || 'Generation') + '</div>' +
        '<div class="history-time">' + formatTimeAgo(e.time) + '</div>' +
      '</div>' +
      '<div class="history-actions">' +
        '<button class="btn btn-sm btn-ghost" data-restore="' + i + '" title="Restore this version">↩️ Restore</button>' +
        '<button class="btn btn-sm btn-ghost" data-del="' + i + '" title="Delete entry">🗑️</button>' +
      '</div>' +
    '</div>';
  }
  list.innerHTML = h;
  var restores = list.querySelectorAll('[data-restore]');
  for (var j = 0; j < restores.length; j++) {
    restores[j].onclick = function() {
      var idx = parseInt(this.getAttribute('data-restore'), 10);
      restoreHistory(idx);
    };
  }
  var dels = list.querySelectorAll('[data-del]');
  for (var k = 0; k < dels.length; k++) {
    dels[k].onclick = function() {
      var idx = parseInt(this.getAttribute('data-del'), 10);
      var entry = DB.history[idx];
      if (entry) {
        DB.history.splice(idx, 1);
        deleteHistoryObject(entry);
      }
      renderHistoryList();
    };
  }
}
function restoreHistory(idx) {
  var e = DB.history[idx];
  if (!e) return;
  DB.code.html = e.html || '';
  DB.code.css = e.css || '';
  DB.code.js = e.js || '';
  _bumpVersion('patch');
  displayAllCode(DB.code);
  _aiJustUpdated = true; // restore is deliberate — don't double-bump in persist
  persist();
  renderSections();
  closeAllModals();
  switchTab('preview');
  showToast('Restored version ' + (e.version || '') + ' as v' + DB.version, 'success');
}

/* ── Console ── */
function initConsoleCapture() {
  window.addEventListener('message', function(e) {
    var d = e.data;
    if (d && d.wbConsole) addConsoleEntry(d.wbConsole.level, d.wbConsole.msg);
  });
}
function addConsoleEntry(level, msg) {
  if (msg && msg.indexOf("Unexpected token '**'") !== -1) {
    msg += ' — ℹ This is a Python-style/markdown "**" inside the page JavaScript (a bold line or a ** b power operator). The JS block is auto-repaired at preview time; if it still appears, check inline on* handlers in the HTML tab.';
  }
  _consoleEntries.push({ level: level, msg: msg, time: new Date().toLocaleTimeString() });
  if (_consoleEntries.length > 300) _consoleEntries.shift();
  renderConsole();
}
function renderConsole() {
  var out = el('console-output');
  var count = el('console-count');
  if (!out) return;
  if (!_consoleEntries.length) {
    out.innerHTML = '<div class="console-empty">🪲 Console output from the preview appears here.<br>Click buttons in the Preview tab and watch for logs and errors.</div>';
  } else {
    var h = '';
    for (var i = 0; i < _consoleEntries.length; i++) {
      var e = _consoleEntries[i];
      var lvl = e.level === 'warn' ? 'warn' : e.level === 'error' ? 'error' : 'log';
      h += '<div class="console-line ' + lvl + '"><span class="c-time">' + esc(e.time) + '</span>' + esc(e.msg) + '</div>';
    }
    out.innerHTML = h;
    out.scrollTop = out.scrollHeight;
  }
  if (count) count.textContent = _consoleEntries.length + ' entries';
}
function clearConsole() {
  _consoleEntries = [];
  renderConsole();
}

/* ── Design-direction parameter summary (Settings tab) ── */
function renderParamsSummary() {
  var box = el('params-summary');
  if (!box) return;
  var items = [
    ['Color Scheme', _p('colorScheme', 'indigo')],
    ['Typography', _p('typography', 'modern-sans')],
    ['Thinking Depth', _p('thinkingLevel', 'balanced')],
    ['Skills', _activeSkillIds().join(', ') || 'none'],
    ['Language', _p('lang', 'en')]
  ];
  var h = '';
  for (var i = 0; i < items.length; i++) {
    h += '<div class="param-chip"><span class="param-key">' + esc(items[i][0]) + '</span><span class="param-val">' + esc(items[i][1]) + '</span></div>';
  }
  box.innerHTML = h;
}

function runFullGeneration() {
  if (_aiCallActive) { showToast('AI is already designing. Wait or press Stop.', 'warning'); return; }
  var inp = el('chat-input');
  if (inp) {
    var hasCode = !!(DB.code.html || DB.code.css || DB.code.js);
    inp.value = hasCode
      ? 'Rebuild the page from scratch following the configured design direction (keep the current content and copy where possible).'
      : 'Create my page following the configured design direction.';
    inp.style.height = 'auto';
    inp.style.height = Math.min(inp.scrollHeight, 160) + 'px';
  }
  switchChatTab('chat');
  sendChatMessage();
}

/* ── Tabs ── */
function isDeveloper() {
  var user = tool.getUser();
  if (!user || !user.roles) return false;
  var roles = Array.isArray(user.roles) ? user.roles : String(user.roles).split(',');
  for (var i = 0; i < roles.length; i++) {
    if (String(roles[i]).trim().toLowerCase() === 'developer') return true;
  }
  return false;
}
function updateDeveloperUI() {
  var dev = isDeveloper();
  qsa('.advtab[data-advtab="html"], .advtab[data-advtab="css"], .advtab[data-advtab="js"], .advtab[data-advtab="console"]').forEach(function(t) {
    t.style.display = dev ? '' : 'none';
  });
  qsa('#btn-copy-html, #btn-copy-css, #btn-copy-js').forEach(function(b) {
    b.style.display = 'none';
  });
  // Rules file is visible to everyone (read-only viewer)
  qsa('.chat-tab-dev').forEach(function(t) {
    t.style.display = dev ? '' : 'none';
  });
  if (!dev && (_advSubCurrent === 'html' || _advSubCurrent === 'css' || _advSubCurrent === 'js' || _advSubCurrent === 'console')) {
    switchAdvTab('settings');
  }
}

var ADV_PANELS = {
  html: 'editor-html',
  css: 'editor-css',
  js: 'editor-js',
  console: 'editor-console',
  settings: 'editor-settings',
  compliance: 'editor-compliance'
};

function switchAdvTab(name) {
  if (!ADV_PANELS[name]) name = 'settings';
  if (!isDeveloper() && (name === 'html' || name === 'css' || name === 'js' || name === 'console')) name = 'settings';
  _advSubCurrent = name;
  qsa('.advtab').forEach(function(t) { t.classList.remove('active'); });
  var tb = qs('.advtab[data-advtab="' + name + '"]');
  if (tb) tb.classList.add('active');
  var compBtn = el('btn-compliance-open');
  if (compBtn) {
    if (name === 'compliance') compBtn.classList.add('header-btn-active');
    else compBtn.classList.remove('header-btn-active');
  }
  qsa('.advpanel').forEach(function(p) { p.classList.remove('active'); });
  var p = el(ADV_PANELS[name]);
  if (p) p.classList.add('active');
  var isCodeTab = (name === 'html' || name === 'css' || name === 'js');
  var actions = el('content-actions');
  if (actions) actions.style.display = isCodeTab ? '' : 'none';
  qsa('#btn-copy-html, #btn-copy-css, #btn-copy-js').forEach(function(b) { b.style.display = 'none'; });
  if (name === 'html') { var bh = el('btn-copy-html'); if (bh) bh.style.display = ''; }
  else if (name === 'css') { var bc = el('btn-copy-css'); if (bc) bc.style.display = ''; }
  else if (name === 'js') { var bj = el('btn-copy-js'); if (bj) bj.style.display = ''; }
  if (name === 'console') renderConsole();
  if (name === 'settings') renderParamsSummary();
  if (name === 'compliance') renderCompliance();
  tool.resize();
}

function switchTab(tab) {
  if (tab !== 'advanced' && tab !== 'preview' && tab !== 'suggestions') tab = 'preview';
  _commitEditorsToDb();
  currentTab = tab;
  qsa('.ctab').forEach(function(t) { t.classList.remove('active'); });
  qsa('.content-editor').forEach(function(e) { e.classList.remove('active'); });
  var tb = qs('.ctab[data-tab="' + tab + '"]');
  if (tb) tb.classList.add('active');
  var ed = el('editor-' + tab);
  if (ed) ed.classList.add('active');
  var cfgBtn = el('btn-config');
  if (cfgBtn) {
    if (tab === 'advanced') cfgBtn.classList.add('header-btn-active');
    else cfgBtn.classList.remove('header-btn-active');
  }
  if (tab === 'preview') updatePreview();
  if (tab === 'suggestions') renderSections();
  if (tab === 'advanced') switchAdvTab(_advSubCurrent || 'settings');
  tool.resize();
}

function switchChatTab(tabName) {
  qsa('.chat-tab').forEach(function(t) {
    t.classList.toggle('active', t.getAttribute('data-chat-tab') === tabName);
  });
  qsa('.chat-tab-panel').forEach(function(p) {
    p.classList.toggle('active', p.getAttribute('data-chat-panel') === tabName);
  });
  // Chat input & attachment only on the Chat tab
  var inputArea = qs('.chat-input-area');
  var attachBar = el('chat-attachment');
  if (inputArea) inputArea.style.display = tabName === 'chat' ? '' : 'none';
  if (attachBar) attachBar.style.display = (tabName === 'chat' && attachedFile) ? 'flex' : 'none';
  if (tabName === 'history') renderSessionList();
  if (tabName === 'chat') scrollChatToBottom();
}

/* ── Modals ── */
function openModal(id) {
  el('modal-backdrop').hidden = false;
  el(id).style.display = 'flex';
}
function openHistoryFromChat() {
  openModal('modal-history');
  var list = el('history-list');
  if (list) list.innerHTML = '<div class="empty-state">Loading history…</div>';
  loadHistory(function() { renderHistoryList(); });
}
function closeAllModals() {
  el('modal-backdrop').hidden = true;
  qsa('.modal').forEach(function(m) { m.style.display = 'none'; });
}

/* ── Theme / readonly ── */
function applyTheme(t) {
  _theme = t;
  document.documentElement.setAttribute('data-theme', t);
  var b = el('btn-theme');
  if (b) b.textContent = t === 'dark' ? '☀️' : '🌓';
}
function toggleTheme() {
  applyTheme(_theme === 'dark' ? 'light' : 'dark');
}
function showToast(msg, sev) { tool.notify(msg, sev || 'info'); }
function lockUI(ro) {
  isReadOnly = ro === true;
  document.body.classList.toggle('readonly', isReadOnly);
}

/* ── Render (restore from saved value) ── */
var KNOWN_KEYS = ['version', 'activeSessionId', 'chatCache', 'seo', 'pageMeta', 'configNeeded', 'emailTemplate', '_instanceId', '_parentRecordId'];
function render(v) {
  if (v && typeof v === 'object') {
    try {
      if (JSON.stringify(v) === JSON.stringify(_slimValue())) return;
    } catch (e) {}
    if (v.code && typeof v.code === 'object') {
      DB.code = { html: v.code.html || '', css: v.code.css || '', js: v.code.js || '' };
    }
    // Legacy migration: older saved values kept history INSIDE the main
    // object. Move those snapshots out into separate history objects.
    if (!_historyMigrated && v.history && v.history.length) {
      DB.history = v.history;
      _historyMigrated = true;
      for (var hi = 0; hi < v.history.length; hi++) _saveHistoryObject(v.history[hi]);
    }
    // One-shot upgrade: pages saved with random picsum placeholders get
    // concept-relevant keyword images (derived from alt text / section id /
    // detected page type) and are persisted once.
    if (!_imagesUpgraded && DB.code.html && DB.code.html.indexOf('picsum.photos') !== -1) {
      _imagesUpgraded = true;
      DB.code.html = _ensureImageSrcs(DB.code.html);
      _aiJustUpdated = true; // migration, not a user edit — no version bump
      try { persist(); } catch (e) {}
    }
    for (var i = 0; i < KNOWN_KEYS.length; i++) {
      var k = KNOWN_KEYS[i];
      if (typeof v[k] !== 'undefined') DB[k] = v[k];
    }
    if (v.chatCache && typeof v.chatCache === 'object') {
      if (Array.isArray(v.chatCache)) {
        // older shape: bare message array
        DB.chatCache = { sessionId: '', messages: v.chatCache };
      } else {
        DB.chatCache = { sessionId: v.chatCache.sessionId || '', messages: v.chatCache.messages || [] };
      }
    }
    // Prefill chat from the bounded cache BEFORE sessions load — the session
    // restore below can still override with fresher data.
    if (!DB.chatMessages.length && DB.chatCache.messages && DB.chatCache.messages.length) {
      if (!DB.activeSessionId || DB.chatCache.sessionId === DB.activeSessionId || !DB.chatCache.sessionId) {
        DB.chatMessages = DB.chatCache.messages.slice();
        updateChatBadge();
      }
    }
    // One-shot: if the code blocks are missing the version comment, add it
    // and persist once so code and version stay consistent.
    if (_stampVersionInCode()) {
      _aiJustUpdated = true; // cosmetic sync, not a user edit
      try { persist(); } catch (e) {}
    }
  }
  displayAllCode(DB.code);
  _renderVersion();
  updateChatBadge();
  renderSections();
  _applyDeviceClass();
  var active = qs('.content-editor.active');
  if (active && active.id === 'editor-preview') updatePreview();
  tool.resize();
}

/* ── Event bindings ── */
function bindEvents() {
  el('btn-config').onclick = function() { switchTab('advanced'); switchAdvTab('settings'); };
  el('btn-history').onclick = openHistoryFromChat;
  el('btn-export').onclick = downloadFullPage;
  el('btn-theme').onclick = toggleTheme;
  el('btn-close-history').onclick = closeAllModals;
  el('modal-backdrop').onclick = closeAllModals;
  var verBadge = el('tool-version');
  if (verBadge) verBadge.onclick = _onVersionClick;

  qsa('.ctab').forEach(function(t) {
    t.onclick = function() { switchTab(this.getAttribute('data-tab')); };
  });
  qsa('.advtab').forEach(function(t) {
    t.onclick = function() { switchTab('advanced'); switchAdvTab(this.getAttribute('data-advtab')); };
  });
  var compOpenBtn = el('btn-compliance-open');
  if (compOpenBtn) compOpenBtn.onclick = openComplianceTab;
  qsa('.chat-tab').forEach(function(t) {
    t.onclick = function() { switchChatTab(this.getAttribute('data-chat-tab')); };
  });
  qsa('.dev-btn').forEach(function(b) {
    b.onclick = function() { setDevice(this.getAttribute('data-device')); };
  });

  el('btn-copy-html').onclick = copyCurrentTab;
  el('btn-copy-css').onclick = copyCurrentTab;
  el('btn-copy-js').onclick = copyCurrentTab;
  el('btn-refresh-preview').onclick = updatePreview;
  el('btn-sections-refresh').onclick = renderSections;

  el('btn-export-html').onclick = downloadFullPage;
  el('btn-export-pdf').onclick = exportPdf;
  el('btn-export-gw-block').onclick = copyPageObject;
  el('btn-export-gw-value').onclick = copyGeneratorOutput;
  el('btn-export-copy-full').onclick = copyFullPage;
  el('btn-export-copy-blocks').onclick = copyThreeBlocks;
  el('btn-generate-all').onclick = runFullGeneration;

  el('btn-run-checks').onclick = function() { runComplianceChecks(); renderCompliance(); showToast('Compliance checks refreshed.', 'info'); };
  el('btn-ai-review').onclick = runAiReview;
  el('btn-compliance-fix').onclick = fixWithAi;

  el('btn-console-clear').onclick = clearConsole;

  el('btn-upload').onclick = handleFileUpload;
  el('attach-remove').onclick = clearAttachment;

  el('btn-chat-send').onclick = sendChatMessage;
  el('btn-chat-stop').onclick = cancelAiRequest;
  el('btn-guided-mode').onclick = toggleInterviewMode;
  el('btn-agentic-mode').onclick = _toggleAgentic;

  el('btn-new-session').onclick = function() {
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
        showToast('New chat created', 'info');
      }
    });
  };

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

  var tplClose = el('btn-close-template');
  if (tplClose) tplClose.onclick = closeTemplateModal;

  // Code editor live sync (debounced persist + preview)
  var onCodeEdit = debounce(function() {
    var h = el('code-html'), c = el('code-css'), j = el('code-js');
    DB.code.html = h ? h.value : '';
    DB.code.css = c ? c.value : '';
    DB.code.js = j ? j.value : '';
    updateLineNumbers();
    persist();
    renderSections();
    updatePreview();
  }, 600);
  qsa('.code-textarea').forEach(function(ta) {
    ta.addEventListener('input', onCodeEdit);
  });

  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      var h = el('code-html'), c = el('code-css'), j = el('code-js');
      DB.code.html = h ? h.value : '';
      DB.code.css = c ? c.value : '';
      DB.code.js = j ? j.value : '';
      persist();
      showToast('Saved.', 'info');
    }
  });
}

/* ── Entry point ── */
var _initialized = false;
tool.onReady(function(val, fields) {
  if (_initialized) { console.warn('[WEBPAGEBUILDER:INIT] Already initialized — skipping'); return; }
  _initialized = true;
  console.log('[WEBPAGEBUILDER] build 2026-08-18b — full capability coverage: sections, gw.ns, list widget, email templates');

  _loadSkills();
  _loadAgenticPref();
  renderSkillChips();

  var guideSrc = el('page-guide-source');
  if (guideSrc) pageGuideText = _decodeEmbedded(guideSrc.textContent || '');

  tool.declareOutput({
    type: 'object',
    title: 'WebpageBuilder Value',
    description: 'Slim saved value: page code + SEO + page meta + version + session plumbing + a bounded chat cache. Version snapshots live as separate objects in webpagebuilder-history-uniconbaseapps so this object stays far below the 1 MB Firestore limit.',
    properties: {
      code: {
        type: 'object', title: 'Generated Page Code',
        description: 'The three code sections produced by the AI (publicwebsite contract: === HTML === / === CSS === / === JS ===), mapped to data.htmlPage.code on the page object.',
        properties: {
          html: { type: 'string', title: 'HTML', description: 'Body fragment only (no html/head/body/doctype tags) — injected into the platform page container.' },
          css: { type: 'string', title: 'CSS', description: 'Scoped stylesheet rules (appended to <head>, removed on unmount).' },
          js: { type: 'string', title: 'JavaScript', description: 'Idempotent vanilla JS (re-runs on every SPA navigation).' }
        }
      },
      seo: { type: 'object', title: 'SEO', description: '=== SEO === JSON from the AI (metaTitle, metaDesc, schemaItems, …) — mapped to the page object seo field.' },
      pageMeta: { type: 'object', title: 'Page Meta', description: '=== PAGE META === JSON from the AI (name, slug, meta.language, data.status, data.requireAuth).' },
      configNeeded: { type: 'string', title: 'CMS Config Needed', description: '=== CMS CONFIG NEEDED === notes listing the operations/flows/email templates the CMS author must create for this page.' },
      emailTemplate: { type: 'string', title: 'Email Template', description: '=== EMAIL TEMPLATE === artifact (templateId, subject, html with {{key}} placeholders) captured when the AI asks for an email hook.' },
      chatCache: { type: 'object', title: 'Chat Cache', description: 'Bounded fallback copy of the last chat messages ({sessionId, messages}) so chat survives even if session storage is unavailable.' },
      version: { type: 'string', title: 'Page Version', description: 'Semantic version of the generated page. AI update → minor bump; manual edit → patch bump.' },
      activeSessionId: { type: 'string', title: 'Active Chat Session ID', description: 'Document id in ai-chat-sessions-uniconbaseapps (canonical chat transcript).' },
      _instanceId: { type: 'string', title: 'Instance ID', description: 'Deterministic per-instance identifier (derived from the parent record id) used to isolate chat sessions.' },
      _parentRecordId: { type: 'string', title: 'Parent Record ID', description: 'Parent CMS record id, captured from the first created chat session.' }
    }
  });
  tool.declareParams([
    { name: 'allowAi', label: 'Enable AI Prompt Relay', type: 'toggle', default: 'yes', severity: 'mandatory', hint: 'Required for AI page generation via chat.' },
    { name: 'allowUpload', label: 'Enable File Upload', type: 'toggle', default: 'yes', severity: 'goodToHave', hint: 'Lets users attach reference images or spec docs for the AI to use as design references.' },
    { name: 'allowFileContent', label: 'Enable File Content Extraction', type: 'toggle', default: 'yes', severity: 'goodToHave', hint: 'Extracts text from uploaded PDFs/DOCX to include in AI prompts.' },
    { name: 'allowExportPdf', label: 'Enable PDF Export', type: 'toggle', default: 'yes', severity: 'goodToHave', hint: 'Enables the Export PDF button in Settings → Export.' },
    { name: 'allowObjectCRUD', label: 'Enable Object CRUD (chat history)', type: 'toggle', default: 'yes', severity: 'goodToHave', hint: 'Chat history is stored in CMS type ai-chat-sessions-uniconbaseapps. Add it to allowedObjectTypes with role: editor, scope: instance.' },
    { name: 'pageRules', label: 'Page Rules Override', type: 'text', default: '', severity: 'optional', hint: 'Optional: paste the full public-website-page-rules.txt (v2.0) text here to override the built-in rules for every instance of this tool.' },
    { name: 'colorScheme', label: 'Color Scheme', type: 'text', default: 'indigo', severity: 'optional', hint: 'Site-wide palette shared across pages. Options: emerald | blue | indigo | violet | rose | amber | teal | ocean | forest | sunset | mono.' },
    { name: 'typography', label: 'Typography', type: 'text', default: 'modern-sans', severity: 'optional', hint: 'Site-wide font pairing: modern-sans | elegant-serif | friendly-rounded | tech-mono | editorial.' },
    { name: 'thinkingLevel', label: 'AI Thinking Depth', type: 'text', default: 'balanced', severity: 'optional', hint: 'How much reasoning effort the AI spends per request: quick | balanced | deep. Deeper = more thoughtful structure and copy, but slower. Works best when the AI gateway runs a reasoning-capable model (e.g. DeepSeek V4 Pro).' },
    { name: 'skills', label: 'Default Skills', type: 'text', default: '', severity: 'optional', hint: 'Comma-separated default skills the AI applies to every page: creative | a11y | seo | nonprofit | luxury | playful | minimal | copy. Page-type guidance is added automatically from the page content.' },
    { name: 'lang', label: 'Page Language', type: 'text', default: 'en', severity: 'optional', hint: 'Language used in generated copy (en, tr, fr, de, es, ar).' }
  ]);

  var aiParam = tool.param('allowAi');
  if (!aiParam || aiParam !== 'yes') {
    tool.reportMissingParams([{
      name: 'allowAi', label: 'Enable AI Prompt Relay',
      type: 'toggle', default: 'yes', severity: 'mandatory',
      hint: 'Set to "yes" to enable AI page generation via tool.requestAI().',
      reason: 'This tool requires AI access to design webpages. Without it, chat generation will not work.'
    }], 'AI Prompt Relay must be enabled for this tool to function. Set allowAi: yes in the field settings.');
  }
  try { tool.reportValid(true); } catch (e) {}

  render(val);
  _resolveInstanceId();
  bindEvents();
  initConsoleCapture();
  applyTheme('light');

  loadSessions(function() {
    var hasLegacyChat = DB.chatMessages && DB.chatMessages.length > 0;
    var hasActiveSession = DB.activeSessionId && DB.activeSessionId.length > 0;
    if (hasLegacyChat && !hasActiveSession) {
      var legacy = DB.chatMessages.slice();
      DB.chatMessages = [];
      persist();
      createSession(function(newSession) {
        if (newSession) {
          tool.requestObjects('update', {
            mainObjectType: SESSION_TYPE,
            objectId: newSession.id,
            productData: { data_categoriesBased: { messages: legacy, updatedAt: new Date().toISOString(), _toolInstanceId: _resolveInstanceId() } }
          }, function() {
            _activeSessionId = newSession.id;
            DB.activeSessionId = newSession.id;
            persist();
            renderSessionList();
          });
        }
      });
    } else if (hasActiveSession) {
      // switchSession sets _activeSessionId itself (setting it here first
      // would trigger its same-session early return and skip loading).
      switchSession(DB.activeSessionId);
    }
    renderSessionList();
    renderChatMessages();
  });

  updateConnStatus('ok');
  if (tool.isReadOnly()) lockUI(true);
  updateDeveloperUI();

  var hasCode = !!(DB.code.html || DB.code.css || DB.code.js);
  switchTab('preview');
  renderSections();
  if (hasCode) runComplianceChecks();
  tool.resize();
});

tool.onValueChange(function(v) { render(v); });
tool.onFieldsChange(function(f) {});
tool.onReadonlyChange(function(ro) { lockUI(ro); });
tool.onUserChange(function() { updateDeveloperUI(); });
