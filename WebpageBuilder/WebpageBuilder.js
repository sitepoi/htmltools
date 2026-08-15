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

/* ── State ── */
var DB = {
  pageName: '', pageType: 'landing', brandName: '', tagline: '',
  audience: 'general', lang: 'en', favicon: '🌐',
  seoTitle: '', seoDesc: '', seoKeywords: '',
  colorScheme: 'indigo', typography: 'modern-sans', styleMode: 'modern', darkMode: 'light-only',
  sections: ['hero', 'footer'],
  styleNotes: '',
  code: { html: '', css: '', js: '' },
  history: [],
  device: 'desktop',
  chatMessages: [],
  rules: '',           // custom rules text (empty → use embedded default)
  rulesUpdatedAt: '',
  _theme: 'light',
  activeSessionId: '',
  version: '1.0.0'
};

var isReadOnly = false;
var currentTab = 'preview';
var attachedFile = null;        // { name, url, size, type, extractedText }
var interviewMode = false;      // Guided interview mode
var _lastPersistedSnapshot = '';
var _snapshotInitialized = false;
var _aiJustUpdated = false;
var _currentTemplate = null;
var _aiCallActive = false;
var _reqToken = null;
var _streamingMsgEl = null;
var _streamingText = '';
var _thinkEl = null;
var _thinkTimer = null;
var _pendingScrollId = '';
var _consoleEntries = [];

/* ── Session state ── */
var _sessions = [];
var _activeSessionId = '';
var _sessionsLoaded = false;
var SESSION_TYPE = 'ai-chat-sessions-uniconbaseapps';

/* ── Rules text — loaded from embedded DOM element ──
   Priority: admin tool.param('pageRules') → custom rules saved in the tool
   (DB.rules) → built-in embedded copy of generalwebsite-page-rules.txt. ── */
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
  if (DB.rules && DB.rules.trim().length > 200) return DB.rules.trim();
  return pageGuideText || '';
}

function getRulesSourceName() {
  try {
    var p = tool.param('pageRules', '');
    if (p && String(p).trim().length > 200) return 'Admin parameter (pageRules)';
  } catch (e) {}
  if (DB.rules && DB.rules.trim().length > 200) return 'Custom (saved in this tool)';
  return 'Built-in (generalwebsite-page-rules.txt v1.2)';
}

function canEditRules() {
  var user = tool.getUser();
  if (!user || !user.roles) return false;
  var roles = Array.isArray(user.roles) ? user.roles : String(user.roles).split(',');
  for (var i = 0; i < roles.length; i++) {
    var r = String(roles[i]).trim().toLowerCase();
    if (r === 'admin' || r === 'developer' || r === 'owner' || r === 'user-manager') return true;
  }
  return false;
}

/* ── Stable instance ID for chat-session isolation ── */
function _resolveInstanceId() {
  if (DB._instanceId) return DB._instanceId;
  var parentId = '';
  try {
    var m = (window.location.search || '').match(/[?&](?:objectId|recordId)=([^&?#]+)/);
    if (m) parentId = decodeURIComponent(m[1]);
  } catch (e) {}
  if (!parentId) {
    try {
      var f = tool.getFields();
      if (f && (f._id || f.id)) parentId = String(f._id || f.id);
    } catch (e) {}
  }
  if (!parentId) {
    try { var p = tool.param('objectId', ''); if (p) parentId = String(p); } catch (e) {}
  }
  var rand = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  DB._instanceId = parentId ? ('rec_' + parentId + '_' + rand) : ('inst_' + rand);
  persist();
  return DB._instanceId;
}

/* ── Persistence (with automatic patch-version bumping) ── */
function _dbSnapshot() {
  return [
    DB.pageName, DB.pageType, DB.brandName, DB.tagline, DB.audience, DB.lang, DB.favicon,
    DB.seoTitle, DB.seoDesc, DB.seoKeywords, DB.colorScheme, DB.typography, DB.styleMode,
    DB.darkMode, DB.sections.join(','), DB.styleNotes,
    DB.code.html, DB.code.css, DB.code.js
  ].join('\u0001');
}

function persist() {
  if (!_snapshotInitialized) {
    _lastPersistedSnapshot = _dbSnapshot();
    _snapshotInitialized = true;
  } else if (!_aiJustUpdated) {
    var snap = _dbSnapshot();
    if (_lastPersistedSnapshot && snap !== _lastPersistedSnapshot) _bumpVersion('patch');
    _lastPersistedSnapshot = snap;
  }
  _aiJustUpdated = false;
  try { tool.setValue(DB); } catch (e) {}
  if (_activeSessionId) saveCurrentSession();
  tool.resize();
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
function loadSessions(callback) {
  try {
    tool.requestObjects('query', { mainObjectType: SESSION_TYPE }, function(err, result) {
      if (err) { console.warn('[WEBPAGEBUILDER:SESSION] Query error:', err); _sessions = []; }
      else {
        var all = (result && result.objects) ? result.objects : [];
        var myId = _resolveInstanceId();
        _sessions = [];
        var needsStamp = [];
        for (var i = 0; i < all.length; i++) {
          var obj = all[i];
          var pd = obj.productData || {};
          var dcb = pd.data_categoriesBased || {};
          if (dcb._toolInstanceId === myId) _sessions.push(obj);
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
      if (err) { console.warn('[WEBPAGEBUILDER:SESSION] Create error:', err); if (callback) callback(null); return; }
      var session = result.object;
      if (session._parentObjectId && !DB._parentRecordId) DB._parentRecordId = session._parentObjectId;
      _sessions.unshift(session);
      if (callback) callback(session);
    });
  } catch (e) {
    if (callback) callback(null);
  }
}

function saveCurrentSession(callback) {
  if (!_activeSessionId) { if (callback) callback(null); return; }
  try {
    tool.requestObjects('update', {
      mainObjectType: SESSION_TYPE,
      objectId: _activeSessionId,
      productData: { data_categoriesBased: { messages: DB.chatMessages || [], updatedAt: new Date().toISOString() } }
    }, function(err, result) {
      if (err) console.warn('[WEBPAGEBUILDER:SESSION] Save error:', err);
      if (callback) callback(err ? null : result);
    });
  } catch (e) {
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
    DB.chatMessages = dcb.messages || [];
  } else {
    DB.chatMessages = [];
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
  if (DB.pageName && DB.pageName.length > 1) bestTitle = DB.pageName.substring(0, 60);
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
    prompt: 'Design a warm restaurant webpage.\n\n**Page:** Hero with appetizing headline + "Reserve a table" CTA, about/chef story section, menu section with 3 categories (starters, mains, desserts) with prices, photo gallery grid, opening hours + location info cards, testimonials, reservation form (name, date, time, guests) with confirmation message, footer with social links.\n\n**Style:** warm amber/terracotta palette, elegant serif headings, food photography placeholders (picsum), cozy rounded cards.\n**Interactions:** sticky navbar, mobile menu, reservation form submit feedback, gallery hover zoom.'
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
function _getSuggestDetail(id, text) { return SUGGEST_DETAILS[id] || text; }

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
  if (extra && extra.isError) msg.isError = true;
  DB.chatMessages.push(msg);
  if (DB.chatMessages.length > 500) DB.chatMessages = DB.chatMessages.slice(-500);
  renderChatMessages();
  updateChatBadge();
  if (_activeSessionId) saveCurrentSession();
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
    } else {
      h += '<div class="chat-msg ai">' +
        '<div class="chat-avatar">🎨</div>' +
        '<div><div class="chat-bubble">' + markdownLite(m.text) + '</div>';
      if (m.version) h += '<span class="chat-version-chip">✓ page v' + esc(m.version) + '</span>';
      if (m.compliance && m.compliance.total) {
        var cs = m.compliance;
        var cicon = cs.failed ? '❌' : cs.warned ? '⚠️' : '✅';
        h += '<span class="chat-compliance-chip" title="Open the Compliance tab" onclick="openComplianceTab()">🧪 ' + cicon + ' ' + cs.passed + '/' + cs.total + ' checks</span>';
      }
      if (m.options && m.options.length) h += optionsHtml(m.options);
      h += '<div class="chat-msg-time">' + time + '</div></div>' +
      '</div>';
    }
  }
  box.innerHTML = h;
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

/* ── Thinking bubble ── */
function showThinking(label, streaming) {
  removeThinking();
  _thinkEl = document.createElement('div');
  _thinkEl.className = 'chat-msg ai';
  _thinkEl.innerHTML =
    '<div class="chat-avatar">🎨</div>' +
    '<div class="think-bubble">' +
      '<div class="think-row"><span class="think-label">' + esc(label) + '</span><span class="think-dots"><i></i><i></i><i></i></span></div>' +
      '<div class="think-row"><span class="think-elapsed" id="think-elapsed">0.0s</span>' +
      '<button class="think-cancel" onclick="cancelAiRequest()">⏹ Stop</button></div>' +
    '</div>';
  var box = el('chat-messages');
  if (box) {
    box.appendChild(_thinkEl);
    scrollChatToBottom();
  }
  var start = Date.now();
  _thinkTimer = setInterval(function() {
    var e = el('think-elapsed');
    if (e) e.textContent = ((Date.now() - start) / 1000).toFixed(1) + 's';
  }, 300);
}
function removeThinking() {
  if (_thinkTimer) { clearInterval(_thinkTimer); _thinkTimer = null; }
  if (_thinkEl && _thinkEl.parentNode) _thinkEl.parentNode.removeChild(_thinkEl);
  _thinkEl = null;
}

/* ── Streaming message ── */
function _beginStreamingMessage() {
  var box = el('chat-messages');
  if (!box) return;
  var div = document.createElement('div');
  div.className = 'chat-msg ai';
  div.innerHTML = '<div class="chat-avatar">🎨</div>' +
    '<div><div class="chat-bubble stream-cursor" id="stream-bubble"></div><div class="chat-msg-time">generating…</div></div>';
  box.appendChild(div);
  _streamingMsgEl = div;
  _streamingText = '';
  scrollChatToBottom();
}
function _appendStreamingToken(token) {
  _streamingText += token;
  var b = el('stream-bubble');
  if (b) {
    b.textContent = _streamingText;
    scrollChatToBottom();
  }
}

/* ── Parse AI response → three code blocks ── */
function parseGeneratedCode(text) {
  var r = { html: '', css: '', js: '' };
  var hm = text.match(/\[HTML\]\s*([\s\S]*?)(?=\[CSS\]|\[JS\]|$)/i);
  var cm = text.match(/\[CSS\]\s*([\s\S]*?)(?=\[JS\]|$)/i);
  var jm = text.match(/\[JS\]\s*([\s\S]*?)$/i);
  if (hm) r.html = hm[1].trim();
  if (cm) r.css = cm[1].trim();
  if (jm) r.js = jm[1].trim();
  if (!r.html || !r.css || !r.js) {
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

/* ── Apply generated code ── */
function applyGeneratedCode(code) {
  _aiJustUpdated = true;
  var changed = DB.code.html !== (code.html || '') || DB.code.css !== (code.css || '') || DB.code.js !== (code.js || '');
  DB.code.html = code.html || '';
  DB.code.css = code.css || '';
  DB.code.js = code.js || '';
  if (changed) {
    _bumpVersion('minor');
    DB.history.unshift({
      version: DB.version,
      time: new Date().toISOString(),
      label: summarizeForHistory(_lastRawResponse || 'AI update'),
      html: DB.code.html, css: DB.code.css, js: DB.code.js
    });
    if (DB.history.length > 50) DB.history.pop();
  }
  displayAllCode(DB.code);
  persist();
  renderSections();
  updatePreview();
  updatePreviewUrl();
  runComplianceChecks();
  if (el('editor-compliance').classList.contains('active')) renderCompliance();
  switchTab('preview');
  tool.notify('Page updated — v' + DB.version, 'success');
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
  }
  var finalText = parsed.text;
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

/* ── Prompt builders ── */
function buildSettingsSummary() {
  return [
    '=== PROJECT SETTINGS ===',
    'Page Name: ' + (DB.pageName || 'Not set — infer from request'),
    'Page Type: ' + DB.pageType,
    'Brand: ' + (DB.brandName || 'Not set — infer from request'),
    'Tagline: ' + (DB.tagline || '(none)'),
    'Audience: ' + DB.audience,
    'Language: ' + DB.lang,
    'Favicon emoji: ' + (DB.favicon || '🌐'),
    'Color scheme: ' + DB.colorScheme,
    'Typography: ' + DB.typography,
    'Visual style: ' + DB.styleMode,
    'Dark mode: ' + DB.darkMode,
    'Requested sections: ' + DB.sections.join(', '),
    'Style notes: ' + (DB.styleNotes || '(none)'),
    'SEO title: ' + (DB.seoTitle || '(none)'),
    'SEO description: ' + (DB.seoDesc || '(none)')
  ].join('\n');
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
    iparts.push('=== GENERALWEBSITE PAGE RULES (for when you generate code) ===');
    iparts.push(getActiveRules());
    iparts.push('');
    iparts.push('If the user confirms they want the page built, output [HTML]/[CSS]/[JS] blocks following ALL rules above.');
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
    parts.push('[HTML]\n' + (DB.code.html || '(empty)'));
    parts.push('[CSS]\n' + (DB.code.css || '(empty)'));
    parts.push('[JS]\n' + (DB.code.js || '(empty)'));
    parts.push('');
    parts.push('=== USER REQUEST ===');
    parts.push(userMsg);
    parts.push('');
    parts.push('Apply the requested change to the page code above. Output the COMPLETE updated [HTML]/[CSS]/[JS] blocks.');
    parts.push('Even for small changes, output ALL three complete blocks — never just fragments.');
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
    parts.push('Generate the COMPLETE page from scratch. Output ALL THREE blocks [HTML]/[CSS]/[JS].');
    parts.push('Follow all GENERALWEBSITE PAGE RULES below.');
  }

  parts.push('');
  parts.push('=== GENERALWEBSITE PAGE RULES (active rules file — FOLLOW STRICTLY) ===');
  parts.push(getActiveRules());
  parts.push('');
  parts.push('=== OUTPUT CONTRACT ===');
  parts.push('Output ALL THREE blocks for every code response: [HTML] (body markup only), [CSS] (stylesheet rules only, no <style> tag), [JS] (JavaScript only, no <script> tag).');
  parts.push('The platform wraps your three blocks into ONE html-code block value: <style>CSS</style> + HTML + <script>JS<\/script>. The [HTML] block must therefore contain NO <style>/<script> tags itself.');
  parts.push('CRITICAL COMPLIANCE SELF-CHECK before outputting:');
  parts.push('  - Exactly ONE <h1>, first heading, with the primary keyword. No skipped heading levels.');
  parts.push('  - Semantic tags (<section>/<article>/<nav>/<header>/<footer>); all <img> have alt, width, height and loading.');
  parts.push('  - ALL class names prefixed gw- (or page-specific prefix); CSS is global to the page.');
  parts.push('  - No <html>/<head>/<body>/<!DOCTYPE> tags. No jQuery/Bootstrap/Tailwind. No hardcoded domain URLs. No secrets.');
  parts.push('  - Mobile-first: @media queries, 48px tap targets, prefers-reduced-motion, overflow-x:auto on tables.');
  parts.push('  - JS in one script, wrapped in an IIFE, namespaced under window.MyPage. No DOMContentLoaded needed (scripts run after DOM ready).');
  parts.push('  - Literal {{ }} or {% %} in code must be wrapped in {% raw %} ... {% endraw %}.');
  parts.push('  - Size budgets: HTML < 100 KB, CSS < 50 KB, JS < 200 KB. Escape any user-generated data yourself.');
  parts.push('');
  parts.push('REQUIRED — PLAIN-LANGUAGE SUMMARY AFTER EVERY CODE RESPONSE:');
  parts.push('After the [JS] block, write a short 2-5 sentence summary for a NON-TECHNICAL user explaining what the page now shows or does — no code jargon.');
  parts.push('');
  parts.push('REQUIRED — NEXT-STEP SUGGESTIONS AFTER EVERY CODE RESPONSE:');
  parts.push('Include 3-5 actionable next steps, each on its own line starting with [[suggest_xxx]] followed by an action description.');
  parts.push('Example: [[suggest_darkmode]] Add dark mode toggle');
  parts.push('         [[suggest_gallery]] Add a photo gallery section');
  return parts.join('\n');
}

function buildMinimalPrompt(userMsg) {
  return [
    'Design a single-page website for the UniconHub GeneralWebsite platform. Output THREE blocks:',
    '[HTML] body markup only (semantic sections), [CSS] stylesheet rules only, [JS] JavaScript only.',
    'KEY RULES: exactly one <h1>; no skipped heading levels; all <img> have alt/width/height/loading;',
    'gw- prefixed class names; no <html>/<head>/<body>/<style>/<script> tags in the blocks;',
    'no jQuery/Bootstrap/Tailwind; mobile-first with @media queries; no hardcoded domains; no secrets;',
    'JS wrapped in an IIFE, namespaced under one window object; literal {{ }} or {% %} wrapped in {% raw %}.',
    'Real copy, no lorem ipsum. No placeholders, no TODOs.',
    '',
    '=== USER REQUEST ===',
    userMsg,
    '',
    'Generate COMPLETE [HTML]/[CSS]/[JS] blocks.',
    'If request is vague, ask clarifying questions with [[option_id]] format.'
  ].join('\n');
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
function cancelAiRequest() {
  if (_reqToken) _reqToken.cancelled = true;
  _aiCallActive = false;
  removeThinking();
  if (_streamingMsgEl && _streamingMsgEl.parentNode) {
    var b = _streamingMsgEl.querySelector('.chat-bubble');
    if (b) b.classList.remove('stream-cursor');
    _streamingMsgEl.querySelector('.chat-msg-time').textContent = '⏹ stopped';
    _streamingMsgEl = null;
  }
  updateConnStatus('ok');
  _setAiUIActive(false);
  showToast('Generation stopped.', 'info');
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
  var prompt = buildChatPrompt(msg);

  var promptContent = el('dev-prompt-content');
  if (promptContent) promptContent.textContent = prompt;
  var promptStatus = el('dev-prompt-status');
  if (promptStatus) promptStatus.textContent = prompt.length.toLocaleString() + ' chars';

  updateConnStatus('busy');
  _aiCallActive = true;
  _setAiUIActive(true);
  _showDevPanel();

  var useStream = typeof tool.requestAIStream === 'function';

  if (useStream) {
    showThinking('AI is designing…', true);
    var fullResponse = '';
    var streamStart = Date.now();
    try {
      tool.requestAIStream(prompt, '', {
        onToken: function(token) {
          if (tok.cancelled) return;
          if (!_streamingMsgEl) _beginStreamingMessage();
          fullResponse += token;
          _appendStreamingToken(token);
          _devRawContent += token;
          _updateDevPanel();
        },
        onComplete: function() {
          if (tok.cancelled) { _reqToken = null; return; }
          var elapsed = Date.now() - streamStart;
          _aiCallActive = false;
          _reqToken = null;
          removeThinking();
          var devStatus = el('dev-raw-status');
          if (devStatus) devStatus.textContent = '✓ Complete (' + (elapsed / 1000).toFixed(1) + 's)';
          if (fullResponse && fullResponse.trim() && fullResponse.length > 10) {
            _finalizeStreamingMessage(fullResponse, hasCode);
          } else {
            _streamingMsgEl = null;
            // Stream empty — retry with batch requestAI
            updateConnStatus('busy');
            _aiCallActive = true;
            _setAiUIActive(true);
            try {
              tool.requestAI(prompt, '', function(err2, response2) {
                if (tok.cancelled) { _reqToken = null; return; }
                _aiCallActive = false;
                _reqToken = null;
                removeThinking();
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
              removeThinking();
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
          _aiCallActive = false;
          _reqToken = null;
          removeThinking();
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
      removeThinking();
      updateConnStatus('error');
      _setAiUIActive(false);
      addChatMessage('ai', '⚠️ **AI call failed:** ' + (e.message || 'Unknown error'), { isError: true });
      clearAttachment();
      tool.resize();
    }
  } else {
    showThinking('AI is designing…', false);
    try {
      tool.requestAI(prompt, '', function(err, response) {
        if (tok.cancelled) { _reqToken = null; return; }
        _aiCallActive = false;
        _reqToken = null;
        removeThinking();
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
      removeThinking();
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
  try {
    tool.requestAI(minimalPrompt, '', function(err3, response3) {
      if (tok.cancelled) { _reqToken = null; return; }
      _aiCallActive = false;
      _reqToken = null;
      removeThinking();
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
    removeThinking();
    updateConnStatus('error');
    _setAiUIActive(false);
    clearAttachment();
    tool.resize();
  }
}

function _finalizeStreamingMessage(full, hasCode) {
  if (_streamingMsgEl && _streamingMsgEl.parentNode) {
    _streamingMsgEl.parentNode.removeChild(_streamingMsgEl);
  }
  _streamingMsgEl = null;
  _streamingText = '';
  updateConnStatus('ok');
  _setAiUIActive(false);
  processAIResponse(full, hasCode);
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

/* ── Preview ── */
function _applyDeviceClass() {
  var fw = el('preview-frame-wrap');
  if (fw) {
    fw.classList.remove('device-tablet', 'device-mobile');
    if (DB.device === 'tablet') fw.classList.add('device-tablet');
    else if (DB.device === 'mobile') fw.classList.add('device-mobile');
  }
  qsa('.dev-btn').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-device') === DB.device);
  });
}
function setDevice(d) {
  DB.device = d;
  qsa('.dev-btn').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-device') === d);
  });
  _applyDeviceClass();
  persist();
}

function buildPreviewDoc() {
  var lang = DB.lang || 'en';
  var html = el('code-html') ? el('code-html').value : '';
  var css = el('code-css') ? el('code-css').value : '';
  var js = el('code-js') ? el('code-js').value : '';
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
    '<script>\n(function(){var oc={log:console.log,warn:console.warn,error:console.error};function post(l,args){var msg=Array.prototype.slice.call(args).map(function(a){try{return typeof a==="object"?JSON.stringify(a):String(a)}catch(e){return String(a)}}).join(" ");try{parent.postMessage({wbConsole:{level:l,msg:msg,time:new Date().toISOString()}},"*")}catch(e){}}console.log=function(){post("log",arguments);oc.log.apply(console,arguments)};console.warn=function(){post("warn",arguments);oc.warn.apply(console,arguments)};console.error=function(){post("error",arguments);oc.error.apply(console,arguments)};window.onerror=function(m){post("error",["Error:",m]);return true};})();\n<\/script>\n' +
    '<script>\n' + js + '\n<\/script>\n</body></html>';
  return doc;
}

function updatePreview() {
  var html = el('code-html') ? el('code-html').value : '';
  var css = el('code-css') ? el('code-css').value : '';
  var js = el('code-js') ? el('code-js').value : '';
  var fw = el('preview-frame-wrap');
  var pe = el('preview-empty');
  var frame = el('preview-frame');
  var hasContent = !!(html.trim() || css.trim() || js.trim());
  if (!hasContent) {
    if (fw) fw.classList.remove('has-content');
    if (pe) pe.style.display = '';
    return;
  }
  if (fw) fw.classList.add('has-content');
  if (pe) pe.style.display = 'none';
  _applyDeviceClass();
  if (frame) frame.srcdoc = buildPreviewDoc();
}

function updatePreviewUrl() {
  var u = el('preview-url');
  if (!u) return;
  var slug = slugify(DB.pageName || DB.brandName || 'my-page');
  u.textContent = 'https://' + slug + '.example.com';
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
  var list = el('sections-list');
  if (!list) return;
  var items = detectSections(DB.code.html || '');
  var qa = el('quick-add-row');
  if (qa) qa.style.display = items.length ? '' : 'none';
  if (!items.length) {
    list.innerHTML = '<div class="sections-empty">No sections yet. Generate a page first — or use the quick-add buttons above once you have one.</div>';
    return;
  }
  var h = '';
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var icon = SECTION_ICONS[it.tag] || '📑';
    h += '<div class="section-item" data-sec-id="' + esc(it.id) + '" title="Scroll to this section in Preview">' +
      '<span class="section-item-icon">' + icon + '</span>' +
      '<div class="section-item-meta">' +
        '<div class="section-item-name">' + esc(it.label) + '</div>' +
        '<div class="section-item-id">#' + esc(it.id || it.tag) + '</div>' +
      '</div>' +
      '<span class="section-item-arrow">→</span>' +
    '</div>';
  }
  list.innerHTML = h;
  var rows = list.querySelectorAll('.section-item');
  for (var j = 0; j < rows.length; j++) {
    rows[j].onclick = function() {
      var sid = this.getAttribute('data-sec-id');
      if (sid) scrollToSection(sid);
    };
  }
}

var QA_PROMPTS = {
  testimonials: 'Add a testimonials section with 3 customer reviews, star ratings and photos.',
  pricing: 'Add a pricing section with 3 tiers, a monthly/yearly toggle and a highlighted popular plan.',
  faq: 'Add an FAQ section with 6 common questions in accordion style.',
  team: 'Add a team section with 4 member cards, photos, names and roles.',
  gallery: 'Add a photo gallery section with a responsive grid and lightbox effect.',
  contact: 'Add a contact section with a form, phone, email, address and a map placeholder.',
  cta: 'Add a bold call-to-action band near the end with a big button.'
};
function quickAddSection(kind) {
  var inp = el('chat-input');
  if (!inp) return;
  var prompt = QA_PROMPTS[kind];
  if (!prompt) return;
  if (inp.value.trim()) inp.value += '\n' + prompt;
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
        var tags = (h.match(/<(article|section|aside|nav|header|footer|main)\b/gi) || []);
        if (tags.length >= 2) return { status: 'pass', detail: tags.length + ' semantic landmark tags used.' };
        return { status: 'warn', detail: 'Few or no semantic landmarks (<article>/<section>/<aside>/<nav>). Add them for SEO and accessibility.' };
      }
    },
    {
      id: 'block-tags', section: '3.5', label: 'No forbidden tags in blocks',
      run: function(h, c, j) {
        var bad = [];
        var hb = h.match(/<(\/?)(html|head|body|style|script)\b[^>]*>/gi);
        if (hb) bad = bad.concat(hb);
        if (/<!doctype/i.test(h)) bad.push('<!DOCTYPE>');
        if (/<style/i.test(c)) bad.push('<style> in CSS block');
        if (/<script/i.test(j)) bad.push('<script> in JS block');
        if (bad.length) return { status: 'fail', detail: 'Forbidden tags found: ' + bad.slice(0, 4).join(', ') + ' — <style>/<script> belong inside an html-code block value only, and <html>/<head>/<body>/<!DOCTYPE> never.' };
        return { status: 'pass', detail: 'Blocks are clean — no <html>/<head>/<body>/<style>/<script> tags.' };
      }
    },
    {
      id: 'class-prefix', section: '3.5', label: 'Prefixed class names (gw-*)',
      run: function(h, c) {
        var classes = _collectClasses(h, c);
        var prefix = slugify(DB.pageName || DB.brandName || 'page');
        var bad = [];
        var unprefixed = 0;
        for (var i = 0; i < classes.length; i++) {
          var cls = classes[i];
          if (cls.indexOf('gw-') === 0 || cls.indexOf(prefix + '-') === 0) continue;
          if (GENERIC_CLASS_NAMES.indexOf(cls) !== -1) bad.push(cls);
          else unprefixed++;
        }
        if (bad.length) return { status: 'fail', detail: 'Generic unprefixed class names found: .' + bad.slice(0, 5).join(', .') + ' — prefix ALL class names (e.g. gw- or "' + prefix + '-"). CSS is global to the page.' };
        if (unprefixed) return { status: 'warn', detail: unprefixed + ' class name(s) without the gw- / ' + prefix + '- prefix — CSS is global to the page; prefix them to avoid collisions.' };
        return { status: 'pass', detail: classes.length + ' class name(s), all prefixed.' };
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
      id: 'img-source', section: '13', label: 'No hotlinked third-party images',
      run: function(h) {
        var imgs = _getImgs(h);
        var external = 0;
        for (var i = 0; i < imgs.length; i++) {
          var sm = imgs[i].match(/src=["'](https?:\/\/[^"']+)/i);
          if (sm) external++;
        }
        if (external) return { status: 'warn', detail: external + ' image(s) with absolute external URLs — host images in the website media library before publishing (picsum placeholders are fine during design).' };
        if (imgs.length) return { status: 'pass', detail: 'No external image hotlinks.' };
        return { status: 'pass', detail: 'No images used.' };
      }
    },
    {
      id: 'links-relative', section: '10', label: 'Relative internal links',
      run: function(h) {
        var abs = (h.match(/href=["']https?:\/\/[^"']+["']/gi) || []);
        if (abs.length > 4) return { status: 'warn', detail: abs.length + ' absolute hrefs — do NOT hardcode the domain; use relative paths (e.g. href="/about") for internal links.' };
        if (abs.length) return { status: 'pass', detail: 'Only a few absolute links (external links are OK).' };
        return { status: 'pass', detail: 'All internal links use relative paths.' };
      }
    },
    {
      id: 'nunjucks-raw', section: '3.5', label: 'Nunjucks-safe literals',
      run: function(h, c, j) {
        var all = h + '\n' + c + '\n' + j;
        var hasLiteral = /\{\{|\{%/.test(all);
        if (!hasLiteral) return { status: 'pass', detail: 'No literal {{ }} or {% %} sequences.' };
        if (/{%\s*raw\s*%}/.test(all)) return { status: 'pass', detail: 'Literal Nunjucks sequences found but wrapped in {% raw %}.' };
        return { status: 'fail', detail: 'Literal {{ }} or {% %} found (e.g. client-side templating) — wrap them in {% raw %} ... {% endraw %} or Nunjucks will evaluate them server-side.' };
      }
    },
    {
      id: 'no-frameworks', section: '14', label: 'No jQuery / UI framework CDNs',
      run: function(h, c, j) {
        var all = (h + '\n' + j).toLowerCase();
        var hits = [];
        ['jquery', 'bootstrap', 'tailwind', 'cdn.jsdelivr', 'unpkg', 'cdnjs.cloudflare'].forEach(function(lib) {
          if (all.indexOf(lib) !== -1) hits.push(lib);
        });
        if (hits.length) return { status: 'fail', detail: 'Forbidden libraries detected: ' + hits.join(', ') + ' — no jQuery, Bootstrap or Tailwind. Use vanilla JS/CSS.' };
        return { status: 'pass', detail: 'No forbidden framework CDNs.' };
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
      id: 'script-namespace', section: '4', label: 'IIFE + namespaced globals',
      run: function(h, c, j) {
        if (!j.trim()) return { status: 'pass', detail: 'No JavaScript needed.' };
        var ok = /^\(function/.test(j.trim()) || /window\.[A-Za-z_$][\w$]*\s*=\s*\{/.test(j);
        if (ok) return { status: 'pass', detail: 'Script is wrapped in an IIFE and/or uses a single window.* namespace.' };
        return { status: 'warn', detail: 'Wrap the script in an IIFE and namespace globals under one window object (e.g. window.MyPage = {...}) to avoid global collisions on the live site.' };
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
        return { status: 'warn', detail: 'innerHTML writes detected — there is NO sanitization in GeneralWebsite: escape user-generated data yourself before injecting.' };
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
      id: 'seo-meta', section: '8', label: 'SEO title & description',
      run: function() {
        var problems = [];
        if (!DB.seoTitle) problems.push('seo.metaTitle is empty');
        else if (DB.seoTitle.length > 60) problems.push('seo.metaTitle is ' + DB.seoTitle.length + ' chars (> 60 — it will be truncated)');
        if (!DB.seoDesc) problems.push('seo.metaDesc is empty');
        else if (DB.seoDesc.length > 160) problems.push('seo.metaDesc is ' + DB.seoDesc.length + ' chars (> 160 — it will be truncated)');
        if (problems.length === 2 && !DB.seoTitle && !DB.seoDesc) {
          return { status: 'fail', detail: 'Set the SEO Title and SEO Description in ⚙️ Settings → Identity — the platform builds <title>/<meta> from them.' };
        }
        if (problems.length) return { status: 'warn', detail: problems.join('; ') + '. Fix in ⚙️ Settings.' };
        return { status: 'pass', detail: 'SEO title (' + DB.seoTitle.length + ' ch) and description (' + DB.seoDesc.length + ' ch) are set.' };
      }
    },
    {
      id: 'pageid-comment', section: '2', label: 'GW-PAGE-ID declaration comment',
      run: function(h) {
        if (/GW-PAGE-ID|GW-PARTIAL-ID/.test(h)) return { status: 'pass', detail: 'Declaration comment present (traceability convention).' };
        return { status: 'warn', detail: 'Add a ' + '<' + '!-- GW-PAGE-ID: your-page-slug --> comment at the top of the html-code value (convention for traceability).' };
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
  var note = el('rules-source-note');
  if (!list || !score) return;

  var hasCode = !!(DB.code.html || DB.code.css || DB.code.js);
  if (!hasCode) {
    list.innerHTML = '<div class="sections-empty">No page code yet. Generate a page first, then run the checks.</div>';
    score.innerHTML = '';
    if (note) note.textContent = 'Active rules: ' + getRulesSourceName();
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

  if (note) note.textContent = 'Active rules: ' + getRulesSourceName() + ' · checks run against the generated HTML/CSS/JS.';

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
  switchTab('compliance');
}

function buildReviewPrompt() {
  return [
    'You are a strict compliance reviewer for the UniconHub GeneralWebsite platform.',
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
  var lines = ['Please fix the following GeneralWebsite rules-compliance issues in the page:'];
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
function buildFullPage() {
  var c = DB.code;
  var title = DB.seoTitle || DB.pageName || DB.brandName || 'Untitled Page';
  var lang = DB.lang || 'en';
  var fav = DB.favicon || '🌐';
  var favSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">' + fav + '</text></svg>';
  var favUri = 'data:image/svg+xml,' + encodeURIComponent(favSvg);
  var meta = '<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + esc(title) + '</title>\n';
  if (DB.seoDesc) meta += '<meta name="description" content="' + esc(DB.seoDesc) + '">\n';
  if (DB.seoKeywords) meta += '<meta name="keywords" content="' + esc(DB.seoKeywords) + '">\n';
  meta += '<link rel="icon" href="' + favUri + '">\n';
  return '<!DOCTYPE html>\n<html lang="' + esc(lang) + '">\n<head>\n' + meta +
    '<style>\n' + (c.css || '') + '\n</style>\n</head>\n<body>\n' + (c.html || '') + '\n' +
    '<script>\n' + (c.js || '') + '\n<\/script>\n</body>\n</html>';
}

function pageSlug() {
  return slugify(DB.pageName || DB.brandName || 'webpage');
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
  copyToClipboard('[HTML]\n' + h + '\n\n[CSS]\n' + c + '\n\n[JS]\n' + j, 'All three blocks copied!');
}
function copyFullPage() {
  var html = el('code-html') ? el('code-html').value.trim() : '';
  if (!html) { showToast('No page to copy yet.', 'warning'); return; }
  copyToClipboard(buildFullPage(), 'Full page HTML copied!');
}

/* ── GeneralWebsite html-code block export (rules file Section 3) ── */
function buildGwHtmlCodeValue() {
  var h = DB.code.html || '';
  var c = DB.code.css || '';
  var j = DB.code.js || '';
  return ('<' + '!-- GW-PAGE-ID: ' + pageSlug() + ' -->\n') +
    '<style>\n' + c + '\n</style>\n' +
    h + '\n' +
    '<script>\n' + j + '\n<\/script>';
}
function buildGwBlockJson() {
  var block = {
    type: 'html-code',
    meta: { slug: 'gw-' + pageSlug(), name: DB.pageName || 'Page' },
    css: '{}',
    settingsJSON: '{}',
    fullWidthBlockCss: '{}',
    value: buildGwHtmlCodeValue()
  };
  return JSON.stringify(block, null, 2);
}
function copyGwBlock() {
  if (!DB.code.html) { showToast('No page to export yet.', 'warning'); return; }
  copyToClipboard(buildGwBlockJson(), 'GW html-code block copied! Paste into sp_contents.blocks.');
}
function copyGwValue() {
  if (!DB.code.html) { showToast('No page to export yet.', 'warning'); return; }
  copyToClipboard(buildGwHtmlCodeValue(), 'GW html-code block value copied!');
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
      DB.history.splice(idx, 1);
      persist();
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
  persist();
  renderSections();
  updatePreviewUrl();
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

/* ── Settings form ── */
function collectFormData() {
  var get = function(id) { var e = el(id); return e ? e.value.trim() : ''; };
  DB.pageName = get('f-page-name');
  DB.pageType = get('f-page-type') || 'landing';
  DB.brandName = get('f-brand-name');
  DB.tagline = get('f-tagline');
  DB.audience = get('f-audience') || 'general';
  DB.lang = get('f-lang') || 'en';
  DB.favicon = get('f-favicon') || '🌐';
  DB.seoTitle = get('f-seo-title');
  DB.seoDesc = get('f-seo-desc');
  DB.seoKeywords = get('f-seo-keywords');
  DB.colorScheme = get('f-color-scheme') || 'indigo';
  DB.typography = get('f-typography') || 'modern-sans';
  DB.styleMode = get('f-style-mode') || 'modern';
  DB.darkMode = get('f-dark-mode') || 'light-only';
  DB.sections = [];
  qsa('.sec-check').forEach(function(cb) {
    if (cb.checked) DB.sections.push(cb.getAttribute('data-sec'));
  });
  DB.styleNotes = get('f-style-notes');
}
function restoreFormData() {
  var setV = function(id, v) { var e = el(id); if (e) e.value = v || ''; };
  setV('f-page-name', DB.pageName);
  setV('f-page-type', DB.pageType);
  setV('f-brand-name', DB.brandName);
  setV('f-tagline', DB.tagline);
  setV('f-audience', DB.audience);
  setV('f-lang', DB.lang);
  setV('f-favicon', DB.favicon);
  setV('f-seo-title', DB.seoTitle);
  setV('f-seo-desc', DB.seoDesc);
  setV('f-seo-keywords', DB.seoKeywords);
  setV('f-color-scheme', DB.colorScheme);
  setV('f-typography', DB.typography);
  setV('f-style-mode', DB.styleMode);
  setV('f-dark-mode', DB.darkMode);
  qsa('.sec-check').forEach(function(cb) {
    cb.checked = (DB.sections || []).indexOf(cb.getAttribute('data-sec')) !== -1;
  });
  setV('f-style-notes', DB.styleNotes);
}

function runFullGeneration() {
  if (_aiCallActive) { showToast('AI is already designing. Wait or press Stop.', 'warning'); return; }
  collectFormData();
  persist();
  var inp = el('chat-input');
  if (inp) {
    var hasCode = !!(DB.code.html || DB.code.css || DB.code.js);
    inp.value = hasCode
      ? 'Rebuild the page from scratch following my saved settings (keep the current content and copy where possible).'
      : 'Create my page following my saved settings.';
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
  qsa('.ctab[data-tab="html"], .ctab[data-tab="css"], .ctab[data-tab="js"]').forEach(function(t) {
    t.style.display = dev ? '' : 'none';
  });
  qsa('#btn-copy-html, #btn-copy-css, #btn-copy-js').forEach(function(b) {
    b.style.display = 'none';
  });
  // Rules file is visible to everyone; editing is gated to admin roles
  var editBtn = el('btn-edit-rules');
  if (editBtn) editBtn.style.display = canEditRules() ? '' : 'none';
  qsa('.chat-tab-dev').forEach(function(t) {
    t.style.display = dev ? '' : 'none';
  });
  if (!dev && (currentTab === 'html' || currentTab === 'css' || currentTab === 'js')) {
    switchTab('preview');
  }
}

function switchTab(tab) {
  if (!isDeveloper() && (tab === 'html' || tab === 'css' || tab === 'js')) tab = 'preview';
  currentTab = tab;
  qsa('.ctab').forEach(function(t) { t.classList.remove('active'); });
  qsa('.content-editor').forEach(function(e) { e.classList.remove('active'); });
  var tb = qs('.ctab[data-tab="' + tab + '"]');
  if (tb) tb.classList.add('active');
  var ed = el('editor-' + tab);
  if (ed) ed.classList.add('active');
  var isCodeTab = (tab === 'html' || tab === 'css' || tab === 'js');
  var actions = el('content-actions');
  if (actions) actions.style.display = isCodeTab ? '' : 'none';
  qsa('#btn-copy-html, #btn-copy-css, #btn-copy-js').forEach(function(b) { b.style.display = 'none'; });
  if (tab === 'html') { var bh = el('btn-copy-html'); if (bh) bh.style.display = ''; }
  else if (tab === 'css') { var bc = el('btn-copy-css'); if (bc) bc.style.display = ''; }
  else if (tab === 'js') { var bj = el('btn-copy-js'); if (bj) bj.style.display = ''; }
  var cfgBtn = el('btn-config');
  if (cfgBtn) {
    if (tab === 'settings') cfgBtn.classList.add('header-btn-active');
    else cfgBtn.classList.remove('header-btn-active');
  }
  if (tab === 'preview') updatePreview();
  if (tab === 'console') renderConsole();
  if (tab === 'compliance') renderCompliance();
  if (tab === 'settings') { collectFormData(); restoreFormData(); }
  if (tab === 'sections') renderSections();
  tool.resize();
}

function switchChatTab(tabName) {
  qsa('.chat-tab').forEach(function(t) {
    t.classList.toggle('active', t.getAttribute('data-chat-tab') === tabName);
  });
  qsa('.chat-tab-panel').forEach(function(p) {
    p.classList.toggle('active', p.getAttribute('data-chat-panel') === tabName);
  });
  if (tabName === 'history') renderSessionList();
}

/* ── Modals ── */
function openModal(id) {
  el('modal-backdrop').hidden = false;
  el(id).style.display = 'flex';
}
function closeAllModals() {
  el('modal-backdrop').hidden = true;
  qsa('.modal').forEach(function(m) { m.style.display = 'none'; });
}

function renderGuide() {
  var body = el('guide-body');
  var loading = el('rules-loading');
  var source = el('rules-source-label');
  if (loading) loading.style.display = 'none';
  if (source) source.textContent = getRulesSourceName();
  var editBtn = el('btn-edit-rules');
  if (editBtn) editBtn.style.display = canEditRules() ? '' : 'none';
  if (body) {
    body.innerHTML = '<pre>' + esc(getActiveRules()) + '</pre>';
    body.style.display = '';
  }
  var editWrap = el('rules-edit-wrap');
  if (editWrap) editWrap.style.display = 'none';
}

function openRulesEditor() {
  if (!canEditRules()) { showToast('Only admins can edit the rules.', 'warning'); return; }
  var body = el('guide-body');
  var wrap = el('rules-edit-wrap');
  var editor = el('rules-editor');
  if (body) body.style.display = 'none';
  if (wrap) wrap.style.display = '';
  if (editor) editor.value = getActiveRules();
}

function saveRules() {
  var editor = el('rules-editor');
  if (!editor) return;
  var txt = editor.value.trim();
  if (txt.length < 200) { showToast('Rules text looks too short — not saved.', 'warning'); return; }
  DB.rules = txt;
  DB.rulesUpdatedAt = new Date().toISOString();
  persist();
  renderGuide();
  closeAllModals();
  runComplianceChecks();
  showToast('Rules updated — AI prompts and compliance checks now use the new rules.', 'success');
}

function resetRules() {
  DB.rules = '';
  DB.rulesUpdatedAt = '';
  persist();
  renderGuide();
  var editor = el('rules-editor');
  if (editor) editor.value = pageGuideText || '';
  showToast('Rules reset to the built-in copy.', 'info');
}

/* ── Theme / readonly ── */
function applyTheme(t) {
  DB._theme = t;
  document.documentElement.setAttribute('data-theme', t);
  var b = el('btn-theme');
  if (b) b.textContent = t === 'dark' ? '☀️' : '🌓';
}
function toggleTheme() {
  applyTheme(DB._theme === 'dark' ? 'light' : 'dark');
  persist();
}
function showToast(msg, sev) { tool.notify(msg, sev || 'info'); }
function lockUI(ro) {
  isReadOnly = ro === true;
  document.body.classList.toggle('readonly', isReadOnly);
}

/* ── Render (restore from saved value) ── */
var KNOWN_KEYS = [
  'pageName', 'pageType', 'brandName', 'tagline', 'audience', 'lang', 'favicon',
  'seoTitle', 'seoDesc', 'seoKeywords', 'colorScheme', 'typography', 'styleMode',
  'darkMode', 'sections', 'styleNotes', 'history', 'device', 'chatMessages',
  'rules', 'rulesUpdatedAt',
  '_theme', 'activeSessionId', 'version', '_instanceId', '_parentRecordId'
];
function render(v) {
  if (v && typeof v === 'object') {
    try {
      if (JSON.stringify(v) === JSON.stringify(DB)) return;
    } catch (e) {}
    if (v.code && typeof v.code === 'object') {
      DB.code = { html: v.code.html || '', css: v.code.css || '', js: v.code.js || '' };
    }
    for (var i = 0; i < KNOWN_KEYS.length; i++) {
      var k = KNOWN_KEYS[i];
      if (k === 'code') continue;
      if (typeof v[k] !== 'undefined') DB[k] = v[k];
    }
  }
  displayAllCode(DB.code);
  restoreFormData();
  _renderVersion();
  updateChatBadge();
  renderSections();
  updatePreviewUrl();
  _applyDeviceClass();
  var active = qs('.content-editor.active');
  if (active && active.id === 'editor-preview') updatePreview();
  tool.resize();
}

/* ── Event bindings ── */
function bindEvents() {
  el('btn-config').onclick = function() { switchTab('settings'); };
  el('btn-history').onclick = function() { renderHistoryList(); openModal('modal-history'); };
  el('btn-guide').onclick = function() { renderGuide(); openModal('modal-guide'); };
  el('btn-export').onclick = downloadFullPage;
  el('btn-theme').onclick = toggleTheme;
  el('btn-close-history').onclick = closeAllModals;
  el('btn-close-guide').onclick = closeAllModals;
  el('modal-backdrop').onclick = closeAllModals;
  var verBadge = el('tool-version');
  if (verBadge) verBadge.onclick = _onVersionClick;

  qsa('.ctab').forEach(function(t) {
    t.onclick = function() { switchTab(this.getAttribute('data-tab')); };
  });
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
  qsa('.qa-chip').forEach(function(c) {
    c.onclick = function() { quickAddSection(this.getAttribute('data-qa')); };
  });

  el('btn-export-html').onclick = downloadFullPage;
  el('btn-export-pdf').onclick = exportPdf;
  el('btn-export-gw-block').onclick = copyGwBlock;
  el('btn-export-gw-value').onclick = copyGwValue;
  el('btn-export-copy-full').onclick = copyFullPage;
  el('btn-export-copy-blocks').onclick = copyThreeBlocks;
  el('btn-generate-all').onclick = runFullGeneration;

  el('btn-run-checks').onclick = function() { runComplianceChecks(); renderCompliance(); showToast('Compliance checks refreshed.', 'info'); };
  el('btn-ai-review').onclick = runAiReview;
  el('btn-compliance-fix').onclick = fixWithAi;

  el('btn-edit-rules').onclick = openRulesEditor;
  el('btn-rules-save').onclick = saveRules;
  el('btn-rules-reset').onclick = resetRules;

  el('btn-console-clear').onclick = clearConsole;

  el('btn-upload').onclick = handleFileUpload;
  el('attach-remove').onclick = clearAttachment;

  el('btn-chat-send').onclick = sendChatMessage;
  el('btn-chat-stop').onclick = cancelAiRequest;
  el('btn-guided-mode').onclick = toggleInterviewMode;

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
    updatePreviewUrl();
    updatePreview();
  }, 600);
  qsa('.code-textarea').forEach(function(ta) {
    ta.addEventListener('input', onCodeEdit);
  });

  // Settings auto-save
  qsa('#editor-settings .form-input, #editor-settings .sec-check').forEach(function(inp) {
    inp.addEventListener('change', function() { collectFormData(); persist(); updatePreviewUrl(); });
  });
  qsa('#editor-settings input[type="text"]').forEach(function(inp) {
    inp.addEventListener('blur', function() { collectFormData(); persist(); updatePreviewUrl(); });
  });

  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      collectFormData();
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

  var guideSrc = el('page-guide-source');
  if (guideSrc) pageGuideText = _decodeEmbedded(guideSrc.textContent || '');

  tool.declareOutput({
    type: 'object',
    description: 'Webpage Builder project — page settings + generated single-page code + active rules',
    properties: {
      pageName: { type: 'string' },
      pageType: { type: 'string' },
      brandName: { type: 'string' },
      code: { type: 'object', properties: { html: { type: 'string' }, css: { type: 'string' }, js: { type: 'string' } } },
      rules: { type: 'string', description: 'Custom rules text; empty = use built-in generalwebsite-page-rules.txt' },
      version: { type: 'string' },
      history: { type: 'array' }
    }
  });
  tool.declareParams([
    { name: 'allowAi', label: 'Enable AI Prompt Relay', type: 'toggle', default: 'yes', severity: 'mandatory', hint: 'Required for AI page generation via chat.' },
    { name: 'allowUpload', label: 'Enable File Upload', type: 'toggle', default: 'yes', severity: 'goodToHave', hint: 'Lets users attach reference images or spec docs for the AI to use as design references.' },
    { name: 'allowFileContent', label: 'Enable File Content Extraction', type: 'toggle', default: 'yes', severity: 'goodToHave', hint: 'Extracts text from uploaded PDFs/DOCX to include in AI prompts.' },
    { name: 'allowExportPdf', label: 'Enable PDF Export', type: 'toggle', default: 'yes', severity: 'goodToHave', hint: 'Enables the Export PDF button in Settings → Export.' },
    { name: 'allowObjectCRUD', label: 'Enable Object CRUD (chat history)', type: 'toggle', default: 'yes', severity: 'goodToHave', hint: 'Chat history is stored in CMS type ai-chat-sessions-uniconbaseapps. Add it to allowedObjectTypes with role: editor, scope: instance.' },
    { name: 'pageRules', label: 'Page Rules Override', type: 'text', default: '', severity: 'optional', hint: 'Optional: paste the full generalwebsite-page-rules.txt text here to override the built-in rules for every instance of this tool. Takes precedence over rules edited inside the tool.' }
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
  applyTheme(DB._theme === 'dark' ? 'dark' : 'light');

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
      _activeSessionId = DB.activeSessionId;
      switchSession(_activeSessionId);
    }
    renderSessionList();
    renderChatMessages();
  });

  updateConnStatus('ok');
  if (tool.isReadOnly()) lockUI(true);
  updateDeveloperUI();

  var hasCode = !!(DB.code.html || DB.code.css || DB.code.js);
  switchTab(hasCode ? 'preview' : 'settings');
  renderSections();
  updatePreviewUrl();
  if (hasCode) runComplianceChecks();
  tool.resize();
});

tool.onValueChange(function(v) { render(v); });
tool.onFieldsChange(function(f) {});
tool.onReadonlyChange(function(ro) { lockUI(ro); });
tool.onUserChange(function() { updateDeveloperUI(); });
