/* ============================================================
   HTML Tool Item Editor - UniconHub CMS html-tool
   Edits the details and code of ONE html-tool and writes them
   back to the matching sibling fields of this CMS record.
   Entry point: tool.onReady
   ============================================================ */
(function () {
  'use strict';

  /* --------------------------------------------------------
     Constants
  -------------------------------------------------------- */
  var BUILT_IN_CATEGORIES = [
    { code: 'B-G-01', label: 'AI & Automation', group: 'Business · General' },
    { code: 'B-G-02', label: 'Finance & Accounting', group: 'Business · General' },
    { code: 'B-G-03', label: 'Sales & CRM', group: 'Business · General' },
    { code: 'B-G-04', label: 'Marketing & Brand', group: 'Business · General' },
    { code: 'B-G-05', label: 'Content & Media', group: 'Business · General' },
    { code: 'B-G-06', label: 'Communications', group: 'Business · General' },
    { code: 'B-G-07', label: 'People & HR', group: 'Business · General' },
    { code: 'B-G-08', label: 'Operations & Management', group: 'Business · General' },
    { code: 'B-G-09', label: 'Forms & Data Collection', group: 'Business · General' },
    { code: 'B-G-10', label: 'Reporting & Analytics', group: 'Business · General' },
    { code: 'B-G-11', label: 'IT & Development', group: 'Business · General' },
    { code: 'B-G-12', label: 'File & Media', group: 'Business · General' },
    { code: 'B-G-13', label: 'Translation & Localization', group: 'Business · General' },
    { code: 'B-G-14', label: 'Utilities', group: 'Business · General' },
    { code: 'B-V-01', label: 'Education & Training', group: 'Business · Vertical' },
    { code: 'B-V-02', label: 'Food & Beverage', group: 'Business · Vertical' },
    { code: 'B-V-03', label: 'Health & Wellness', group: 'Business · Vertical' },
    { code: 'B-V-04', label: 'Nonprofit & Community', group: 'Business · Vertical' }
  ];

  var TAG_SUGGESTIONS = ['calculator', 'converter', 'form', 'chart', 'report', 'editor', 'tracker', 'planner', 'invoice', 'scheduler', 'upload', 'pdf', 'image', 'video', 'timer', 'quiz', 'builder', 'translator', 'generator', 'checklist'];

  var FIELD_DEFINITIONS = [
    { key: 'toolName', label: 'Tool Name', type: 'text', required: true, placeholder: 'e.g. Star Rating', maxLength: 120 },
    { key: 'toolIcon', label: 'Icon', type: 'text', required: false, placeholder: 'e.g. ⭐', maxLength: 8 },
    { key: 'toolStatus', label: 'Status', type: 'select', options: ['active', 'draft'], defaultOption: 'draft' },
    { key: 'toolDescription', label: 'Description', type: 'textarea' },
    { key: 'toolHtmlCode', label: 'HTML Code', type: 'code' },
    { key: 'toolCssCode', label: 'CSS Code', type: 'code' },
    { key: 'toolJsCode', label: 'JS Code', type: 'code' },
    { key: 'toolDisplayMode', label: 'Display Mode', type: 'select', options: ['inline', 'trigger-popup', 'trigger-drawer', 'toolbar-strip'], defaultOption: 'inline' },
    { key: 'toolHeight', label: 'Height', type: 'text', required: false, placeholder: 'e.g. 200px', maxLength: 20, defaultValue: '200px' },
    { key: 'toolAutoHeight', label: 'Auto Height', type: 'select', options: ['yes', 'no'], defaultOption: 'yes' },
    { key: 'toolParams', label: 'Parameters Schema', type: 'json' },
    { key: 'toolOutputSchema', label: 'Output Schema', type: 'json' },
    { key: 'toolValidationEnabled', label: 'Validation Enabled', type: 'select', options: ['no', 'yes'], defaultOption: 'no' }
  ];

  var CODE_KEYS = ['toolHtmlCode', 'toolCssCode', 'toolJsCode'];
  var CODE_TAB_OF_KEY = { toolHtmlCode: 'html', toolCssCode: 'css', toolJsCode: 'js' };

  var DOC_KEYS = ['webpage', 'help', 'updates', 'presentation', 'social'];
  var DOC_LABELS = { webpage: 'Webpage', help: 'Help', updates: 'Updates', presentation: 'Presentation', social: 'Social' };
  var FRAGMENT_DOCS = ['webpage', 'help', 'updates', 'presentation'];
  var SEO_FIELDS = ['metaTitle', 'metaDesc', 'metaKeywords', 'metaRobots', 'ogTitle', 'ogDesc', 'ogImage'];
  var SEO_LABELS = {
    metaTitle: 'Meta title', metaDesc: 'Meta description', metaKeywords: 'Meta keywords',
    metaRobots: 'Meta robots', ogTitle: 'OG title', ogDesc: 'OG description', ogImage: 'OG image URL'
  };
  var DEFAULT_PAGE_TARGET_TYPE = 'website-builder-uniconbaseapps';
  var DEFAULT_SOCIAL_TARGET_TYPE = 'tool-social-content-applicationstore';
  var DEFAULT_VERSIONS_TARGET_TYPE = 'tool-code-versions-applicationstore';
  var DEFAULT_CODE_PARTS_TARGET_TYPE = 'tool-code-parts-applicationstore';
  var CODE_PART_KEYS = ['html', 'css', 'js'];
  var CODE_PART_LABELS = { html: 'HTML code', css: 'CSS code', js: 'JS code' };
  var CODE_PART_SHORT_LABELS = { html: 'HTML', css: 'CSS', js: 'JS' };
  var DEFAULT_DOCS_FOLDER_TYPE_MAP = {
    webpage: 'www.uniconhub.com',
    updates: 'www.uniconhub.com',
    presentation: 'www.uniconhub.com',
    help: 'help.uniconhub.com'
  };
  var VERSION_LIMIT = 20;
  var SHOTS_LIMIT = 50;
  var CODE_PUSH_COOLDOWN_MS = 30000;
  var DEFAULT_CODE_CHUNK_KB = 800;
  var DEFAULT_VERSION_SNAPSHOT_MAX_KB = 900;
  var DEFAULT_CMS_ADMIN_BASE_URL = 'https://applicationstore.uniconhub.com';
  var FIRESTORE_CONSOLE_BASE_URL = 'https://console.firebase.google.com';
  var DEFAULT_FIRESTORE_COLLECTION = 'om_objects';
  var DEFAULT_FIRESTORE_COLLECTION_MAP = {
    'tool-code-parts-applicationstore': 'om_private_objects',
    'tool-code-versions-applicationstore': 'om_private_objects'
  };
  var SCHEMA_FIELDS = ['toolParams', 'toolOutputSchema'];
  var SCHEMA_CONTAINER_IDS = { toolParams: 'htl-schema-params', toolOutputSchema: 'htl-schema-output' };

  /* --------------------------------------------------------
     State
  -------------------------------------------------------- */
  var DB = null;
  var _user = null;
  var _noIdentity = false;
  var _readOnly = false;
  var _saveTimer = null;
  var _saving = false;
  var _polled = false;
  var _activeTab = 'details';
  var _previewBuilt = false;
  var _previewMockValue = {};
  var _previewMockParams = {};
  var _gutterTimers = {};
  var _diagnosticsLines = [];
  var DIAGNOSTICS_LINE_LIMIT = 60;
  var _activeDocKey = 'webpage';
  var _versionsCache = [];
  var _docPushArmed = {};
  var _docPushArmTimers = {};
  var _docGutterTimers = {};
  var _shotSequence = 0;
  var _shotsBusy = false;
  var _activeSchemaTab = {};
  var _activeDocPart = {};
  var _ownTypeId = '';
  var _ownRecordName = '';
  var _ownRecordId = '';
  var _ownObjectType = '';
  var _ownSource = '';
  var _firestoreProjectId = '';
  var _firestoreProjectDetectStarted = false;
  var _docsMemory = {};
  var _docLoadBusy = {};
  var _docReloadArmed = {};
  var _docReloadArmTimers = {};
  var _codeMemory = {};
  var _codePushArmed = {};
  var _codePushArmTimers = {};
  var _codePushBusy = {};
  var _codePushTimers = {};
  var _codePushCooldownUntil = {};
  var _codePushFailedSignature = {};
  var _codeModeTimer = null;
  var _codeModeCurrent = '';

  /* --------------------------------------------------------
     Small helpers
  -------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }
  function on(id, eventName, handler) {
    var element = $(id);
    if (element) element.addEventListener(eventName, handler);
    return element;
  }
  function debounce(fn, delayMs) {
    var timer = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, delayMs);
    };
  }
  function escHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function formatDateTime(isoValue) {
    var parsedDate = new Date(isoValue);
    if (isNaN(parsedDate.getTime())) return String(isoValue);
    return parsedDate.toLocaleString();
  }
  function formatTime(dateValue) { return dateValue.toLocaleTimeString(); }
  var _utf8Encoder = null;
  try { if (typeof TextEncoder !== 'undefined') _utf8Encoder = new TextEncoder(); } catch (error) {}
  function utf8SizeOf(text) {
    var textValue = String(text == null ? '' : text);
    try {
      if (_utf8Encoder) return _utf8Encoder.encode(textValue).length;
      if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(textValue).length;
    } catch (error) {}
    return textValue.length;
  }
  function formatSizeLabel(bytes) {
    var byteCount = Math.max(0, Number(bytes) || 0);
    if (byteCount >= 1024 * 1024) return (byteCount / (1024 * 1024)).toFixed(2) + ' MB';
    if (byteCount >= 1024) return (byteCount / 1024).toFixed(byteCount >= 10 * 1024 ? 0 : 1) + ' KB';
    return byteCount + ' B';
  }
  function firestoreProjectId() {
    var configuredId = String(readParam('firestoreProjectId', '') || '').trim();
    return configuredId || _firestoreProjectId;
  }
  function firestoreDatabaseId() {
    return String(readParam('firestoreDatabaseId', '-default-') || '-default-').trim() || '-default-';
  }
  function firestoreCollectionFor(objectType) {
    var collectionMap = safeJsonObject(readParam('firestoreCollectionMap', JSON.stringify(DEFAULT_FIRESTORE_COLLECTION_MAP)));
    var mappedCollection = collectionMap[objectType];
    if (typeof mappedCollection === 'string' && mappedCollection.trim()) return mappedCollection.trim();
    if (_ownSource && _ownObjectType && objectType === _ownObjectType) return _ownSource;
    return String(readParam('firestoreDefaultCollection', DEFAULT_FIRESTORE_COLLECTION) || DEFAULT_FIRESTORE_COLLECTION).trim() || DEFAULT_FIRESTORE_COLLECTION;
  }
  function firestoreDocumentUrl(objectType, objectId) {
    var projectId = firestoreProjectId();
    if (!projectId || !objectType || !objectId) return '';
    var pathSegments = firestoreCollectionFor(objectType).split('/').filter(Boolean);
    pathSegments.push(String(objectId));
    var encodedPath = pathSegments.map(function (segment) { return encodeURIComponent(segment); }).join('~2F');
    return FIRESTORE_CONSOLE_BASE_URL + '/project/' + encodeURIComponent(projectId)
      + '/firestore/databases/' + encodeURIComponent(firestoreDatabaseId())
      + '/data/~2F' + encodedPath;
  }
  function firebaseProjectIdFromText(text) {
    var textValue = String(text || '');
    var patterns = [
      /firebasestorage\.googleapis\.com\/v0\/b\/([a-z0-9-]+)\.appspot\.com/i,
      /https?:\/\/([a-z0-9-]+)\.firebaseapp\.com/i,
      /https?:\/\/([a-z0-9-]+)\.web\.app/i,
      /["']projectId["']\s*:\s*["']([a-z0-9-]+)["']/i
    ];
    for (var index = 0; index < patterns.length; index++) {
      var match = patterns[index].exec(textValue);
      if (match && match[1]) return match[1].toLowerCase();
    }
    return '';
  }
  function scanForFirebaseProject(node, depth) {
    if (!node || depth > 4) return '';
    if (typeof node === 'string') return firebaseProjectIdFromText(node);
    if (typeof node !== 'object') return '';
    var keys = Object.keys(node);
    for (var index = 0; index < keys.length && index < 80; index++) {
      var key = keys[index];
      if (/token|secret|password|apikey|api_key/i.test(key)) continue;
      var foundProjectId = scanForFirebaseProject(node[key], depth + 1);
      if (foundProjectId) return foundProjectId;
    }
    return '';
  }
  function applyDetectedFirestoreProject(projectId, source) {
    var configuredId = String(readParam('firestoreProjectId', '') || '').trim();
    if (!projectId || configuredId || _firestoreProjectId === projectId) return;
    _firestoreProjectId = projectId;
    logDiagnostics('firestore-project', 'direct Firestore links use project ' + projectId + ' (from ' + source + ')');
    renderAccessLinks();
    if (_activeTab === 'documents') renderDevDocuments();
  }
  function detectFirestoreProjectId(shellFields) {
    if (_firestoreProjectDetectStarted) return;
    _firestoreProjectDetectStarted = true;
    var shotsProjectId = scanForFirebaseProject(DB && DB.draft ? DB.draft.shots : null, 0);
    if (shotsProjectId) { applyDetectedFirestoreProject(shotsProjectId, 'screenshot storage URL'); return; }
    var shellProjectId = scanForFirebaseProject(shellFields, 0);
    if (shellProjectId) { applyDetectedFirestoreProject(shellProjectId, 'record shell'); return; }
    var relayAvailable = typeof tool.requestFetch === 'function';
    var browserOrigin = '';
    try {
      if (typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol)) {
        browserOrigin = String(window.location.origin || '');
      }
    } catch (error) {}
    if (!relayAvailable && !browserOrigin) return;
    var adminBase = String(readParam('cmsAdminBaseUrl', DEFAULT_CMS_ADMIN_BASE_URL) || '').trim().replace(/\/+$/, '');
    var initUrls = [];
    if (relayAvailable && adminBase) initUrls.push(adminBase + '/__/firebase/init.json');
    if (browserOrigin) initUrls.push(browserOrigin + '/__/firebase/init.json');
    initUrls.push('/__/firebase/init.json');
    initUrls = initUrls.filter(function (url, index) { return url && initUrls.indexOf(url) === index; });
    initUrls.forEach(function (initUrl) {
      if (relayAvailable) {
        try {
          tool.requestFetch(initUrl, { method: 'GET', timeoutMs: 5000 }, function (fetchError, fetchResult) {
            if (fetchError || !fetchResult) return;
            var body = fetchResult.json !== undefined ? fetchResult.json : (fetchResult.body || fetchResult.text);
            var config = typeof body === 'string' ? parseJsonLenient(body) : body;
            if (config && config.projectId) applyDetectedFirestoreProject(String(config.projectId), initUrl);
          });
        } catch (error) {}
      }
      if (browserOrigin) {
        try {
          fetch(initUrl, { credentials: initUrl.charAt(0) === '/' ? 'same-origin' : 'omit' })
            .then(function (response) { return response && response.ok ? response.json() : null; })
            .then(function (config) {
              if (config && config.projectId) applyDetectedFirestoreProject(String(config.projectId), initUrl);
            })
            .catch(function () {});
        } catch (error) {}
      }
    });
  }
  function fireLinkHtml(objectType, objectId, titleText) {
    var directUrl = firestoreDocumentUrl(objectType, objectId);
    if (!directUrl) {
      var disabledTitle = titleText + ' - Firestore project id not detected; set the Firestore Project ID parameter to open this document in the Firebase console';
      return '<span class="htl-fire-link htl-fire-link-off" title="' + escHtml(disabledTitle) + '" aria-label="' + escHtml(disabledTitle) + '">🔥</span>';
    }
    return '<a class="htl-fire-link" href="' + escHtml(directUrl) + '" target="_blank" rel="noopener" title="' + escHtml(titleText) + '" aria-label="' + escHtml(titleText) + '">🔥</a>';
  }

  function parseJsonLenient(rawText) {
    var text = String(rawText || '').trim();
    if (!text) return null;
    var fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch) text = fencedMatch[1].trim();
    var firstBrace = text.indexOf('{');
    var lastBrace = text.lastIndexOf('}');
    var firstBracket = text.indexOf('[');
    var lastBracket = text.lastIndexOf(']');
    var openIndex, closeIndex;
    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      openIndex = firstBracket; closeIndex = lastBracket;
    } else {
      openIndex = firstBrace; closeIndex = lastBrace;
    }
    if (openIndex === -1 || closeIndex === -1 || closeIndex <= openIndex) return null;
    text = text.slice(openIndex, closeIndex + 1);
    text = text.replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(text); } catch (error) { return null; }
  }
  function safeJsonObject(rawText) {
    var parsedObject = parseJsonLenient(rawText);
    return (parsedObject && typeof parsedObject === 'object' && !Array.isArray(parsedObject)) ? parsedObject : {};
  }

  function notify(message, severity) {
    try { if (tool.notify) tool.notify(message, severity || 'info'); } catch (error) {}
  }
  function logDiagnostics(label, detail) {
    var line = formatTime(new Date()) + ' [' + label + '] ' + String(detail);
    _diagnosticsLines.push(line);
    if (_diagnosticsLines.length > DIAGNOSTICS_LINE_LIMIT) _diagnosticsLines.shift();
    try { if (typeof console !== 'undefined' && console.log) console.log('[HtmlToolLibraryItem] ' + line); } catch (error) {}
    var logElement = $('htl-debug-log');
    if (logElement) logElement.textContent = _diagnosticsLines.join('\n');
  }

  /* --------------------------------------------------------
     Defaults
  -------------------------------------------------------- */
  function defaultDraft() {
    var draft = {};
    FIELD_DEFINITIONS.forEach(function (definition) {
      if (typeof definition.defaultValue !== 'undefined') {
        draft[definition.key] = definition.defaultValue;
      } else if (definition.type === 'select') {
        draft[definition.key] = definition.defaultOption || definition.options[0];
      } else {
        draft[definition.key] = '';
      }
    });
    draft.toolCategories = [];
    draft.toolTags = [];
    draft.docs = defaultDocs();
    draft.codeParts = {};
    draft.shots = [];
    return draft;
  }
  function normalize(value) {
    var normalized = {
      version: 1,
      draft: defaultDraft()
    };
    if (value && typeof value === 'object') {
      var savedDraft = value.draft;
      if (savedDraft && typeof savedDraft === 'object') {
        FIELD_DEFINITIONS.forEach(function (definition) {
          if (typeof savedDraft[definition.key] !== 'undefined' && savedDraft[definition.key] !== null) {
            normalized.draft[definition.key] = String(savedDraft[definition.key]);
          }
        });
      }
      normalized.version = typeof value.version === 'number' ? Math.max(2, value.version) : 2;
      var savedCategories = savedDraft ? savedDraft.toolCategories : undefined;
      if (Array.isArray(savedCategories)) {
        var categoryList = savedCategories.filter(function (code) { return typeof code === 'string' && code; });
        normalized.draft.toolCategories = categoryList.filter(function (code, index) { return categoryList.indexOf(code) === index; });
      } else {
        normalized.draft.toolCategories = [];
      }
      var savedTags = savedDraft ? savedDraft.toolTags : undefined;
      if (Array.isArray(savedTags)) {
        normalized.draft.toolTags = savedTags.filter(function (tag) { return typeof tag === 'string' && tag.trim(); });
      } else if (typeof savedTags === 'string' && savedTags.trim()) {
        var migratedTags = savedTags.split(',').map(function (tag) { return tag.trim(); }).filter(Boolean);
        normalized.draft.toolTags = migratedTags.filter(function (tag, index) { return migratedTags.indexOf(tag) === index; });
      } else {
        normalized.draft.toolTags = [];
      }
      var savedDocs = savedDraft ? savedDraft.docs : null;
      if (savedDocs && typeof savedDocs === 'object') {
        DOC_KEYS.forEach(function (docKey) {
          var savedDoc = savedDocs[docKey];
          if (savedDoc && typeof savedDoc === 'object') {
            normalized.draft.docs[docKey].target = normalizeDocTarget(savedDoc.target);
          }
        });
      }
      var savedCodeParts = savedDraft ? savedDraft.codeParts : null;
      if (savedCodeParts && typeof savedCodeParts === 'object') {
        CODE_PART_KEYS.forEach(function (codePartKey) {
          var savedPart = savedCodeParts[codePartKey];
          if (!savedPart || typeof savedPart !== 'object') return;
          var savedObjectIds = Array.isArray(savedPart.objectIds)
            ? savedPart.objectIds.filter(function (objectId) { return typeof objectId === 'string' && objectId; })
            : [];
          if (!savedObjectIds.length && typeof savedPart.objectId === 'string' && savedPart.objectId) {
            savedObjectIds = [savedPart.objectId];
          }
          if (!savedObjectIds.length) return;
          normalized.draft.codeParts[codePartKey] = {
            objectIds: savedObjectIds,
            chunkCount: Number(savedPart.chunkCount) || savedObjectIds.length,
            chunkBytes: Array.isArray(savedPart.chunkBytes) ? savedPart.chunkBytes.map(function (byteCount) { return Number(byteCount) || 0; }) : [],
            pushedAt: typeof savedPart.pushedAt === 'string' ? savedPart.pushedAt : '',
            pushedSignature: typeof savedPart.pushedSignature === 'string' ? savedPart.pushedSignature : ''
          };
        });
      }
      var savedShots = savedDraft ? savedDraft.shots : null;
      if (Array.isArray(savedShots)) {
        normalized.draft.shots = savedShots.filter(function (shot) {
          return shot && typeof shot === 'object' && typeof shot.url === 'string' && shot.url;
        }).slice(0, SHOTS_LIMIT);
      }
    }
    return normalized;
  }
  function defaultSeo() {
    var seo = {};
    SEO_FIELDS.forEach(function (seoField) { seo[seoField] = ''; });
    return seo;
  }
  function defaultDocs() {
    var docs = {};
    FRAGMENT_DOCS.forEach(function (docKey) {
      docs[docKey] = { target: null };
    });
    docs.social = { target: null };
    return docs;
  }
  function normalizeDocTarget(target) {
    if (!target || typeof target !== 'object') return null;
    if (typeof target.objectType !== 'string' || !target.objectType) return null;
    if (typeof target.objectId !== 'string' || !target.objectId) return null;
    var savedSignature = typeof target.pushedSignature === 'string' ? target.pushedSignature : '';
    // Older builds stored the whole document JSON as the signature - shrink it to a hash.
    if (savedSignature && savedSignature.charAt(0) === '{') savedSignature = payloadSignatureOf(savedSignature);
    return {
      objectType: target.objectType,
      objectId: target.objectId,
      name: typeof target.name === 'string' ? target.name : '',
      slug: typeof target.slug === 'string' ? target.slug : '',
      folderTypeId: typeof target.folderTypeId === 'string' ? target.folderTypeId : '',
      pushedAt: typeof target.pushedAt === 'string' ? target.pushedAt : '',
      pushedSignature: savedSignature
    };
  }
  function docMemory(docKey) {
    if (!_docsMemory[docKey]) {
      if (docKey === 'social') {
        _docsMemory[docKey] = { contentHtml: '', loaded: false, dirty: false };
      } else {
        _docsMemory[docKey] = { html: '', css: '', js: '', seo: defaultSeo(), loaded: false, dirty: false };
      }
    }
    return _docsMemory[docKey];
  }
  /* --------------------------------------------------------
     Persist (staged draft in this tool's own value)
  -------------------------------------------------------- */
  function persist() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(persistImmediate, 350);
  }
  function persistImmediate() {
    _saving = true;
    try {
      tool.setValue(JSON.parse(JSON.stringify(DB)));
      setSaveState('staged');
      updateSizeMeter();
    } catch (error) {}
    setTimeout(function () { _saving = false; }, 400);
  }
  function setSaveState(kind) {
    var element = $('htl-save-state');
    if (!element) return;
    if (kind === 'saved') { element.textContent = '✓ Saved'; element.classList.add('ok'); }
    else { element.textContent = 'Draft staged'; element.classList.remove('ok'); }
  }

  /* --------------------------------------------------------
     Identity / permissions
  -------------------------------------------------------- */
  function getUserSafe() {
    try { return tool.getUser ? tool.getUser() : null; } catch (error) { return null; }
  }
  function getRoles() {
    var user = _user || getUserSafe();
    var roles = [];
    if (user && user.roles) {
      var rawRoles = Array.isArray(user.roles) ? user.roles : String(user.roles).split(/[\s,]+/);
      rawRoles.forEach(function (role) {
        if (!role) return;
        var roleName = String(role && role.name ? role.name : role).trim().toLowerCase();
        if (roleName && roles.indexOf(roleName) === -1) roles.push(roleName);
      });
    }
    if (!roles.length && user && user.effectiveAccess) {
      if (user.effectiveAccess.isManager) roles.push('admin');
      if (user.effectiveAccess.isEditor) roles.push('editor');
      if (user.effectiveAccess.isViewer) roles.push('viewer');
      if (user.effectiveAccess.isDeveloper) roles.push('developer');
    }
    return roles;
  }
  function canWrite() {
    if (_noIdentity) return !_readOnly;
    if (_readOnly) return false;
    var roles = getRoles();
    return ['admin', 'editor', 'developer', 'owner', 'user-manager'].some(function (roleName) {
      return roles.indexOf(roleName) > -1;
    });
  }
  function isDeveloper() {
    return getRoles().indexOf('developer') > -1;
  }
  function renderAccessLinks() {
    renderObjectLinks();
    CODE_KEYS.forEach(function (codeKey) { renderCodePartLink(codeKey); });
  }
  var _loggedRolesSnapshot = '';
  function logRolesChange() {
    var rolesSnapshot = JSON.stringify(getRoles());
    if (rolesSnapshot !== _loggedRolesSnapshot) {
      _loggedRolesSnapshot = rolesSnapshot;
      logDiagnostics('user-roles', 'roles: ' + rolesSnapshot);
    }
  }
  function refreshUser() {
    _user = getUserSafe();
    if (!_user || !getRoles().length) {
      if (typeof tool.getUser !== 'function') { _noIdentity = true; }
      else if (!_polled) {
        _polled = true;
        [400, 1200, 2600, 5000].forEach(function (delayMs) {
          setTimeout(function () {
            _user = getUserSafe();
            if (_user && getRoles().length) _polled = true;
            renderUser();
            lockUI();
            renderAccessLinks();
            logRolesChange();
          }, delayMs);
        });
      }
    }
    renderUser();
    lockUI();
    renderAccessLinks();
    logRolesChange();
  }
  function renderUser() {
    var badge = $('htl-role-badge');
    if (!badge) return;
    var user = _user || getUserSafe();
    if (!user && _noIdentity) { badge.textContent = '👤 CMS session'; return; }
    if (!user) { badge.textContent = '👤 Guest'; return; }
    var roles = getRoles();
    var label = roles.length ? roles.join(' / ') : 'member';
    badge.textContent = '👤 ' + (user.name || 'User') + ' - ' + label;
  }
  function lockUI() {
    var locked = !canWrite();
    var root = $('htl-root');
    if (root) root.classList.toggle('htl-locked', locked);
    var lockNote = $('htl-lock-note');
    if (lockNote) lockNote.style.display = locked ? '' : 'none';
  }

  /* --------------------------------------------------------
     Validation
  -------------------------------------------------------- */
  function reportValidation() {
    var toolName = (DB.draft.toolName || '').trim();
    try {
      if (toolName) tool.reportValid(true);
      else tool.reportValid(false, 'Tool name is required - enter it under Details.');
    } catch (error) {}
  }

  /* --------------------------------------------------------
     Rendering
  -------------------------------------------------------- */
  function renderDetails() {
    FIELD_DEFINITIONS.forEach(function (definition) {
      if (definition.type === 'code') return;
      var inputElement = $('htl-f-' + definition.key);
      if (inputElement) inputElement.value = DB.draft[definition.key];
    });
  }
  function refreshJsonFieldValidity(fieldKey) {
    var element = $('htl-f-' + fieldKey);
    if (!element) return;
    var text = String(DB.draft[fieldKey] || '').trim();
    if (!text) {
      element.classList.remove('htl-invalid');
      element.title = '';
      return;
    }
    if (parseJsonLenient(text) === null) {
      element.classList.add('htl-invalid');
      element.title = 'Invalid JSON';
    } else {
      element.classList.remove('htl-invalid');
      element.title = '';
    }
  }
  function activeCategories() {
    var rawParam = readParam('categoryList', '');
    if (rawParam) {
      var parsedList = parseJsonLenient(rawParam);
      if (Array.isArray(parsedList)) {
        return parsedList.map(function (entry) {
          if (typeof entry === 'string') return { code: entry, label: entry, group: 'Categories' };
          if (!entry || typeof entry !== 'object') return null;
          return {
            code: String(entry.code || entry.label || ''),
            label: String(entry.label || entry.code || ''),
            group: String(entry.group || 'Categories')
          };
        }).filter(function (entry) { return entry && entry.code; });
      }
    }
    return BUILT_IN_CATEGORIES;
  }
  function categoryByCode(code) {
    var categories = activeCategories();
    for (var index = 0; index < categories.length; index++) {
      if (categories[index].code === code) return categories[index];
    }
    return null;
  }
  function renderCategories() {
    var listElement = $('htl-category-list');
    if (!listElement) return;
    var searchInput = $('htl-category-search');
    var searchText = searchInput ? String(searchInput.value || '').toLowerCase() : '';
    var filteredCategories = activeCategories().filter(function (category) {
      if (!searchText) return true;
      return category.code.toLowerCase().indexOf(searchText) !== -1
        || category.label.toLowerCase().indexOf(searchText) !== -1
        || category.group.toLowerCase().indexOf(searchText) !== -1;
    });
    var grouped = {};
    filteredCategories.forEach(function (category) {
      (grouped[category.group] = grouped[category.group] || []).push(category);
    });
    var htmlParts = [];
    Object.keys(grouped).forEach(function (groupName) {
      htmlParts.push('<div class="htl-cat-group">' + escHtml(groupName) + '</div>');
      grouped[groupName].forEach(function (category) {
        var isSelected = DB.draft.toolCategories.indexOf(category.code) !== -1;
        htmlParts.push('<label class="htl-cat-row' + (isSelected ? ' selected' : '') + '">'
          + '<input type="checkbox" class="htl-cat-check" data-code="' + escHtml(category.code) + '"' + (isSelected ? ' checked' : '') + '>'
          + '<span class="htl-cat-code">' + escHtml(category.code) + '</span>'
          + '<span class="htl-cat-label">' + escHtml(category.label) + '</span>'
          + '</label>');
      });
    });
    listElement.innerHTML = htmlParts.length ? htmlParts.join('') : '<div class="htl-cat-empty">No categories match the filter.</div>';
    var checkboxes = listElement.querySelectorAll('.htl-cat-check');
    for (var checkIndex = 0; checkIndex < checkboxes.length; checkIndex++) {
      (function (checkbox) {
        checkbox.addEventListener('change', function () {
          toggleCategory(checkbox.getAttribute('data-code'));
        });
      })(checkboxes[checkIndex]);
    }
  }
  function toggleCategory(code) {
    var index = DB.draft.toolCategories.indexOf(code);
    var wasSelected = index !== -1;
    if (wasSelected) DB.draft.toolCategories.splice(index, 1);
    else DB.draft.toolCategories.push(code);
    persist();
    renderCategorySelected();
    renderCategories();
    logDiagnostics('category-toggle', code + (wasSelected ? ' removed' : ' added') + ' - selected: ' + DB.draft.toolCategories.join(', '));
  }
  function renderCategorySelected() {
    var selectedElement = $('htl-category-selected');
    if (!selectedElement) return;
    var countElement = $('htl-category-count');
    if (countElement) countElement.textContent = DB.draft.toolCategories.length + ' selected';
    var chipsHtml = DB.draft.toolCategories.map(function (code) {
      var category = categoryByCode(code);
      var label = category ? category.label : code;
      return '<span class="htl-chip">' + escHtml(label)
        + ' <button class="htl-chip-remove" data-remove-category="' + escHtml(code) + '" title="Remove">×</button></span>';
    });
    selectedElement.innerHTML = chipsHtml.length ? chipsHtml.join('') : '<span class="htl-hint">No categories selected yet.</span>';
    var removeButtons = selectedElement.querySelectorAll('.htl-chip-remove');
    for (var buttonIndex = 0; buttonIndex < removeButtons.length; buttonIndex++) {
      (function (button) {
        button.addEventListener('click', function () {
          var code = button.getAttribute('data-remove-category');
          var removeIndex = DB.draft.toolCategories.indexOf(code);
          if (removeIndex !== -1) {
            DB.draft.toolCategories.splice(removeIndex, 1);
            persist();
            renderCategorySelected();
            renderCategories();
            logDiagnostics('category-remove', code + ' removed');
          }
        });
      })(removeButtons[buttonIndex]);
    }
  }
  function addTag(rawText) {
    var addedTags = [];
    String(rawText || '').split(',').forEach(function (piece) {
      var tag = piece.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!tag) return;
      if (tag.length > 24) tag = tag.slice(0, 24);
      if (DB.draft.toolTags.indexOf(tag) !== -1) return;
      if (DB.draft.toolTags.length >= 20) return;
      DB.draft.toolTags.push(tag);
      addedTags.push(tag);
    });
    if (addedTags.length) {
      persist();
      renderTags();
      logDiagnostics('tag-add', 'added ' + addedTags.join(', ') + ' - total ' + DB.draft.toolTags.length);
    }
  }
  function removeTag(tag) {
    var index = DB.draft.toolTags.indexOf(tag);
    if (index !== -1) DB.draft.toolTags.splice(index, 1);
    persist();
    renderTags();
    logDiagnostics('tag-remove', tag + ' removed');
  }
  function renderTags() {
    var listElement = $('htl-tags-list');
    if (!listElement) return;
    var chipsHtml = DB.draft.toolTags.map(function (tag) {
      return '<span class="htl-chip">' + escHtml(tag)
        + ' <button class="htl-chip-remove" data-remove-tag="' + escHtml(tag) + '" title="Remove">×</button></span>';
    });
    listElement.innerHTML = chipsHtml.length ? chipsHtml.join('') : '<span class="htl-hint">No tags yet - type below and press Enter.</span>';
    var removeButtons = listElement.querySelectorAll('.htl-chip-remove');
    for (var buttonIndex = 0; buttonIndex < removeButtons.length; buttonIndex++) {
      (function (button) {
        button.addEventListener('click', function () { removeTag(button.getAttribute('data-remove-tag')); });
      })(removeButtons[buttonIndex]);
    }
    renderTagSuggestions();
  }
  function renderTagSuggestions() {
    var suggestElement = $('htl-tag-suggest');
    if (!suggestElement) return;
    var unusedSuggestions = TAG_SUGGESTIONS.filter(function (tag) {
      return DB.draft.toolTags.indexOf(tag) === -1;
    }).slice(0, 8);
    if (!unusedSuggestions.length) { suggestElement.innerHTML = ''; return; }
    suggestElement.innerHTML = '<span class="htl-hint">Suggestions: </span>' + unusedSuggestions.map(function (tag) {
      return '<button class="htl-tag-suggest-chip" data-suggest-tag="' + escHtml(tag) + '">' + escHtml(tag) + '</button>';
    }).join('');
    var suggestButtons = suggestElement.querySelectorAll('.htl-tag-suggest-chip');
    for (var buttonIndex = 0; buttonIndex < suggestButtons.length; buttonIndex++) {
      (function (button) {
        button.addEventListener('click', function () { addTag(button.getAttribute('data-suggest-tag')); });
      })(suggestButtons[buttonIndex]);
    }
  }
  function renderCodeEditors() {
    CODE_KEYS.forEach(function (codeKey) {
      var textarea = $('htl-code-' + codeKey);
      var part = codePartKeyOf(codeKey);
      if (textarea && document.activeElement !== textarea) textarea.value = codePartMemory(part).code;
      updateCodeMeta(codeKey);
      updateGutter(codeKey);
      renderCodePartLink(codeKey);
    });
  }
  function renderCodePartLink(codeKey) {
    var linkSpan = $('htl-code-link-' + CODE_TAB_OF_KEY[codeKey]);
    if (!linkSpan) return;
    if (!isDeveloper()) { linkSpan.innerHTML = ''; return; }
    if (codePartsMode() === 'split') {
      var objectIds = codePartObjectIds(DB.draft.codeParts[codePartKeyOf(codeKey)]);
      if (objectIds.length) {
        linkSpan.innerHTML = fireLinkHtml(codePartsType(), objectIds[0], objectIds.length > 1
          ? 'Open ' + CODE_PART_LABELS[codePartKeyOf(codeKey)] + ' chunk 1 of ' + objectIds.length + ' in Firestore'
          : 'Open ' + CODE_PART_LABELS[codePartKeyOf(codeKey)] + ' in Firestore');
      } else {
        linkSpan.innerHTML = '<span class="htl-code-link-note">not pushed yet</span>';
      }
      return;
    }
    if (_ownRecordId && _ownObjectType) {
      linkSpan.innerHTML = fireLinkHtml(_ownObjectType, _ownRecordId, 'Open this tool record in Firestore - combined code is stored in this document');
    } else {
      linkSpan.innerHTML = '<span class="htl-code-link-note" title="Combined code is stored inside this record document.">in this record</span>';
    }
  }
  function updateCodeMeta(codeKey) {
    var textarea = $('htl-code-' + codeKey);
    var metaElement = $('htl-meta-' + CODE_TAB_OF_KEY[codeKey]);
    if (!textarea || !metaElement) return;
    var text = textarea.value || '';
    var lineCount = text ? text.split('\n').length : 1;
    var metaText = lineCount + ' lines · ' + text.length + ' chars';
    if (codePartsMode() === 'split') {
      metaText += ' · ' + formatSizeLabel(utf8SizeOf(text));
      if (codePartMemory(codePartKeyOf(codeKey)).dirty) metaText += ' · not pushed to object';
    }
    metaElement.textContent = metaText;
  }
  function updateGutter(codeKey) {
    var textarea = $('htl-code-' + codeKey);
    var gutter = $('htl-gutter-' + CODE_TAB_OF_KEY[codeKey]);
    if (!textarea || !gutter) return;
    var lineCount = textarea.value ? textarea.value.split('\n').length : 1;
    var lineNumbers = [];
    for (var lineNumber = 1; lineNumber <= lineCount; lineNumber++) lineNumbers.push(lineNumber);
    gutter.textContent = lineNumbers.join('\n');
    syncGutterToEditor(codeKey);
  }
  function syncGutterToEditor(codeKey) {
    var textarea = $('htl-code-' + codeKey);
    var gutter = $('htl-gutter-' + CODE_TAB_OF_KEY[codeKey]);
    if (!textarea || !gutter) return;
    if (textarea.clientHeight > 0) gutter.style.height = textarea.clientHeight + 'px';
    gutter.scrollTop = textarea.scrollTop;
  }
  function renderAll() {
    renderDetails();
    renderCodeEditors();
    renderCategories();
    renderCategorySelected();
    renderTags();
    FIELD_DEFINITIONS.forEach(function (definition) {
      if (definition.type === 'json') refreshJsonFieldValidity(definition.key);
    });
    renderUser();
    ensureDocsStructure();
    renderShots();
    renderSchemaEditors();
    updateSizeMeter();
  }

  /* --------------------------------------------------------
     Tabs
  -------------------------------------------------------- */
  function switchTab(tabName) {
    if (tabName === 'documents' && !isDeveloper()) tabName = 'details';
    _activeTab = tabName;
    var tabButtons = document.querySelectorAll('.htl-tab');
    for (var tabIndex = 0; tabIndex < tabButtons.length; tabIndex++) {
      tabButtons[tabIndex].classList.toggle('active', tabButtons[tabIndex].getAttribute('data-tab') === tabName);
    }
    ['details', 'html', 'css', 'js', 'preview', 'docs', 'screenshots', 'versions', 'documents', 'synclogs'].forEach(function (paneName) {
      var pane = $('pane-' + paneName);
      if (pane) pane.style.display = paneName === tabName ? '' : 'none';
    });
    if (tabName === 'preview' && !_previewBuilt) renderPreview();
    if (tabName === 'docs') ensureDocsStructure();
    if (tabName === 'versions') renderVersionsList();
    if (tabName === 'documents') renderDevDocuments();
    if (tabName === 'screenshots') renderShots();
    if (tabName === 'html' || tabName === 'css' || tabName === 'js') {
      loadCodePart(tabName);
      syncGutterToEditor(toolCodeKeyOf(tabName));
    }
    try { tool.resize(); } catch (error) {}
  }

  /* --------------------------------------------------------
     JS syntax check
  -------------------------------------------------------- */
  function checkJsSyntax(codeText) {
    var source = String(codeText || '');
    if (!source.trim()) return null;
    try { new Function(source); return null; } catch (error) {
      return String(error && error.message ? error.message : error);
    }
  }

  /* --------------------------------------------------------
     Preview (mock tool SDK inside a sandboxed frame)
  -------------------------------------------------------- */
  function previewSdkSource() {
    var source = (function () {
      var listeners = {};
      function register(eventName, callback) {
        (listeners[eventName] = listeners[eventName] || []).push(callback);
      }
      function fire(eventName, payload) {
        (listeners[eventName] || []).slice().forEach(function (callback) {
          try { callback(payload); } catch (error) { log('listener error: ' + error.message, 'error'); }
        });
      }
      var storedValue = JSON.parse('__HTL_MOCK_VALUE__');
      var siblingFields = {};
      var configuredParams = JSON.parse('__HTL_MOCK_PARAMS__');
      function log(message, kind) {
        var panel = document.getElementById('htl-mock-panel');
        if (!panel) {
          panel = document.createElement('div');
          panel.id = 'htl-mock-panel';
          panel.style.cssText = 'position:fixed;right:10px;bottom:10px;width:300px;z-index:2147483000;font:11px/1.5 Consolas,monospace;color:#cbd5e1;border-radius:8px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.45)';
          panel.innerHTML = '<div style="font:600 11px/1.4 Arial;color:#fff;background:#0f172a;padding:6px 10px">PREVIEW MOCK SDK</div><div id="htl-mock-log" style="max-height:120px;overflow:auto;background:#1e293b;padding:6px 10px"></div>';
          (document.body || document.documentElement).appendChild(panel);
        }
        var logList = document.getElementById('htl-mock-log');
        if (logList) {
          var line = document.createElement('div');
          line.textContent = (kind ? '[' + kind + '] ' : '') + message;
          logList.appendChild(line);
          logList.scrollTop = logList.scrollHeight;
        }
      }
      try {
        ['log', 'warn', 'error'].forEach(function (methodName) {
          var originalMethod = console[methodName];
          console[methodName] = function () {
            try { originalMethod.apply(console, arguments); } catch (error) {}
            var text = Array.prototype.map.call(arguments, function (argument) {
              try { return typeof argument === 'string' ? argument : JSON.stringify(argument); } catch (error) { return String(argument); }
            }).join(' ');
            log(text, methodName === 'log' ? 'console' : methodName);
          };
        });
      } catch (error) {}
      function fakeAsyncChannel(channelName) {
        return function () {
          var callback = arguments[arguments.length - 1];
          log('request' + channelName + ' called (mock)', 'mock');
          if (typeof callback === 'function') callback(channelName + ' is not available in the preview mock (allow' + channelName + ' is off).', null);
        };
      }
      var api = {
        onReady: function (callback) {
          if (typeof callback === 'function') {
            try { callback(storedValue, siblingFields); } catch (error) { log('tool.onReady threw: ' + error.message, 'error'); }
          }
        },
        getValue: function () { return storedValue; },
        setValue: function (newValue) { storedValue = newValue; fire('valueChange', newValue); },
        onValueChange: function (callback) { register('valueChange', callback); },
        getFields: function () { return siblingFields; },
        watchField: function (fieldId, callback) { register('field:' + fieldId, callback); },
        setField: function (fieldId, fieldValue) { siblingFields[fieldId] = fieldValue; fire('fieldsChange', siblingFields); },
        setFields: function (fieldValues) {
          Object.keys(fieldValues || {}).forEach(function (fieldId) { siblingFields[fieldId] = fieldValues[fieldId]; });
          fire('fieldsChange', siblingFields);
        },
        onFieldsChange: function (callback) { register('fieldsChange', callback); },
        param: function (paramName, defaultValue) {
          return (configuredParams && typeof configuredParams[paramName] !== 'undefined') ? configuredParams[paramName] : defaultValue;
        },
        isReadOnly: function () { return false; },
        onReadonlyChange: function (callback) { register('readonlyChange', callback); },
        reportValid: function (isValid, message) { log('reportValid(' + isValid + ')' + (message ? ' - ' + message : ''), 'mock'); },
        requestSave: function (callback) { log('requestSave (mock - accepted)', 'mock'); if (typeof callback === 'function') callback(null, true); },
        notify: function (message, severity) { log(message, severity || 'notify'); },
        resize: function () {},
        declareOutput: function (schema) {},
        declareParams: function (params) {},
        reportMissingParams: function (missing, message) {
          log('reportMissingParams: ' + (message || ((missing || []).length + ' missing')), 'warn');
        },
        getUser: function () {
          return {
            id: 'preview-user', name: 'Preview User', email: 'preview@example.test',
            roles: ['admin', 'editor'],
            effectiveAccess: { isViewer: true, isEditor: true, isManager: true },
            locale: 'en'
          };
        },
        onUserChange: function (callback) { register('userChange', callback); },
        getPermittedUsers: function () { return []; },
        onPermittedUsersChange: function (callback) { register('permittedUsersChange', callback); },
        openUrl: function (url) { log('openUrl: ' + url, 'mock'); },
        openObjectDetail: function (objectType, objectId) { log('openObjectDetail: ' + objectType + '/' + objectId, 'mock'); },
        requestAI: fakeAsyncChannel('AI'),
        requestAIStream: function (prompt, context, callbacks) {
          log('requestAIStream called (mock)', 'mock');
          if (callbacks && callbacks.onError) callbacks.onError('AI is not available in the preview mock (allowAi is off).');
        },
        requestUpload: fakeAsyncChannel('Upload'),
        requestFileContent: fakeAsyncChannel('FileContent'),
        requestExportPdf: fakeAsyncChannel('ExportPdf'),
        requestSendEmail: fakeAsyncChannel('SendEmail'),
        requestObjects: fakeAsyncChannel('Objects')
      };
      window.tool = api;
      log('tool SDK ready. getValue = ' + JSON.stringify(storedValue).slice(0, 200), 'mock');
    }).toString();
    source = source
      .replace('__HTL_MOCK_VALUE__', JSON.stringify(_previewMockValue || {}).replace(/</g, '\\u003c'))
      .replace('__HTL_MOCK_PARAMS__', JSON.stringify(_previewMockParams || {}).replace(/</g, '\\u003c'));
    return source;
  }

  function buildPreviewDoc() {
    var htmlCode = codePartText('html');
    var cssCode = codePartText('css');
    var jsCode = codePartText('js');
    var jsSyntaxError = checkJsSyntax(jsCode);
    var scriptOpen = '<' + 'script' + '>';
    var scriptClose = '<' + '/' + 'script' + '>';
    var parts = [];
    parts.push('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">');
    parts.push('<meta name="viewport" content="width=device-width,initial-scale=1">');
    parts.push('<title>Tool preview</title>');
    parts.push('<style>' + cssCode + '</style>');
    parts.push('</head><body>');
    parts.push(htmlCode);
    parts.push(scriptOpen + previewSdkSource() + scriptClose);
    if (!jsSyntaxError) {
      parts.push(scriptOpen + jsCode.replace(/<\/script/gi, '<\\/script') + scriptClose);
    }
    parts.push('</body></html>');
    return { doc: parts.join('\n'), jsSyntaxError: jsSyntaxError };
  }

  function renderPreview() {
    _previewBuilt = true;
    var frame = $('htl-preview-frame');
    var statusElement = $('htl-preview-status');
    if (!frame) return;
    var built = buildPreviewDoc();
    frame.srcdoc = built.doc;
    if (statusElement) {
      if (built.jsSyntaxError) {
        statusElement.textContent = 'JS syntax error: ' + built.jsSyntaxError;
        statusElement.className = 'htl-preview-status err';
      } else {
        statusElement.textContent = 'Preview rebuilt ' + formatTime(new Date());
        statusElement.className = 'htl-preview-status ok';
      }
    }
    try { tool.resize(); } catch (error) {}
  }

  /* --------------------------------------------------------
     Document management (webpage / help / updates / presentation / social)
  -------------------------------------------------------- */
  function toolSlugOf() {
    var rawName = String(DB.draft.toolName || '').trim();
    if (!rawName) rawName = String(_ownRecordName || '').trim();
    if (!rawName) return 'unnamed-tool';
    var normalized = rawName.normalize ? rawName.normalize('NFKD') : rawName;
    normalized = normalized.replace(/[\u0300-\u036f]/g, '');
    var charMap = { 'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u' };
    normalized = normalized.replace(/[çÇğĞıİöÖşŞüÜ]/g, function (character) { return charMap[character]; });
    var slug = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'unnamed-tool';
  }
  var _legacyTypeNoticeShown = false;
  function legacyToCurrentType(typeName) {
    if (!typeName) return '';
    var mapped = {
      'htl-demo-pages-uniconbaseapps': DEFAULT_PAGE_TARGET_TYPE,
      'htl-demo-social-uniconbaseapps': DEFAULT_SOCIAL_TARGET_TYPE,
      'htl-demo-versions-uniconbaseapps': DEFAULT_VERSIONS_TARGET_TYPE,
      'tool-social-content-uniconbaseapps': DEFAULT_SOCIAL_TARGET_TYPE,
      'tool-code-versions-uniconbaseapps': DEFAULT_VERSIONS_TARGET_TYPE,
      'tool-code-parts-uniconbaseapps': DEFAULT_CODE_PARTS_TARGET_TYPE,
      'toolCodeParts': DEFAULT_CODE_PARTS_TARGET_TYPE
    }[typeName];
    if (mapped) {
      if (!_legacyTypeNoticeShown) {
        _legacyTypeNoticeShown = true;
        logDiagnostics('doc-target-type', 'mapped legacy demo type ' + typeName + ' -> ' + mapped);
      }
      return mapped;
    }
    return typeName;
  }
  function docTargetType(docKey) {
    var configured = docKey === 'social'
      ? readParam('socialTargetType', DEFAULT_SOCIAL_TARGET_TYPE)
      : readParam('pageTargetType', DEFAULT_PAGE_TARGET_TYPE);
    return legacyToCurrentType(configured) || (docKey === 'social' ? DEFAULT_SOCIAL_TARGET_TYPE : DEFAULT_PAGE_TARGET_TYPE);
  }
  function versionsTargetType() {
    return legacyToCurrentType(readParam('versionsTargetType', DEFAULT_VERSIONS_TARGET_TYPE)) || DEFAULT_VERSIONS_TARGET_TYPE;
  }
  function leafTypeIdOf(docKey) {
    var folderMap = safeJsonObject(readParam('docsFolderTypeMap', JSON.stringify(DEFAULT_DOCS_FOLDER_TYPE_MAP)));
    if (docKey) {
      var mappedFolder = String(folderMap[docKey] || '').trim();
      if (mappedFolder) return mappedFolder;
    }
    var singleOverride = String(readParam('docsFolderTypeId', '') || '').trim();
    if (singleOverride) return singleOverride;
    if (docKey === 'versions') return _ownTypeId || '';
    if (docKey === 'codeParts') return '';
    return '';
  }
  function objectsApiAvailable() {
    return typeof tool.requestObjects === 'function';
  }
  function isReadOnlyStoreError(errorText) {
    return /read-only/i.test(String(errorText || ''));
  }
  function readOnlyStoreHint(objectType) {
    return ' The CMS store does not allow writes for "' + objectType + '": define that object type in the Application Store app (create + update allowed), or set the "Code Parts Target Object Type" parameter to a writable type such as tool-code-parts-uniconbaseapps and add that type to the field allowedObjectTypes. The code stays in this record until a push succeeds.';
  }
  function objectDcb(cmsObject) {
    if (!cmsObject || typeof cmsObject !== 'object') return {};
    if (cmsObject.productData && cmsObject.productData.data_categoriesBased) return cmsObject.productData.data_categoriesBased;
    if (cmsObject.objectData && cmsObject.objectData.data_categoriesBased) return cmsObject.objectData.data_categoriesBased;
    return {};
  }
  function findObjectBySlug(objects, wantedSlug) {
    var pageField = pageFieldMap().webpageContentWithBuilder;
    for (var index = 0; index < objects.length; index++) {
      var cmsObject = objects[index];
      if (!cmsObject) continue;
      var dcb = objectDcb(cmsObject);
      if ((dcb.slug && String(dcb.slug) === wantedSlug) || (cmsObject.slug && String(cmsObject.slug) === wantedSlug)) return cmsObject;
      if (pageField && dcb[pageField] && dcb[pageField].pageMeta && String(dcb[pageField].pageMeta.slug) === wantedSlug) return cmsObject;
    }
    return null;
  }
  function contentPayloadJson(docKey) {
    var doc = docMemory(docKey);
    if (docKey === 'social') return JSON.stringify({ contentHtml: String(doc.contentHtml || '') });
    var seo = {};
    SEO_FIELDS.forEach(function (seoField) { if (doc.seo[seoField]) seo[seoField] = doc.seo[seoField]; });
    return JSON.stringify({ html: String(doc.html || ''), css: String(doc.css || ''), js: String(doc.js || ''), seo: seo });
  }
  function payloadSignatureOf(payloadJson) {
    return hashCode(payloadJson) + '-' + payloadJson.length;
  }
  function contentSignature(docKey) {
    return payloadSignatureOf(contentPayloadJson(docKey));
  }
  function signatureMatchesPayload(storedSignature, payloadJson) {
    var storedText = String(storedSignature || '');
    if (!storedText) return false;
    // Signatures saved before the hash change are the full payload JSON - keep them comparable.
    if (storedText.charAt(0) === '{') return storedText === payloadJson;
    return storedText === payloadSignatureOf(payloadJson);
  }
  function contentSignatureMatches(docKey, storedSignature) {
    return signatureMatchesPayload(storedSignature, contentPayloadJson(docKey));
  }
  function docContentSizeBytes(docKey) {
    var doc = docMemory(docKey);
    if (!doc.loaded) return -1;
    if (docKey === 'social') return utf8SizeOf(doc.contentHtml);
    var seoText = '';
    SEO_FIELDS.forEach(function (seoField) { if (doc.seo[seoField]) seoText += String(doc.seo[seoField]); });
    return utf8SizeOf(doc.html) + utf8SizeOf(doc.css) + utf8SizeOf(doc.js) + utf8SizeOf(seoText);
  }
  function pageFieldMap() {
    var overrideMap = safeJsonObject(readParam('pageTargetFieldMap', ''));
    var map = { webpageContentWithBuilder: 'webpageContentWithBuilder' };
    Object.keys(map).forEach(function (mapKey) { if (overrideMap[mapKey]) map[mapKey] = overrideMap[mapKey]; });
    return map;
  }
  function socialFieldMap() {
    var overrideMap = safeJsonObject(readParam('socialTargetFieldMap', ''));
    var map = { name: 'name', slug: 'slug', contentHtml: 'contentHtml', updatedAt: 'updatedAt' };
    Object.keys(map).forEach(function (mapKey) { if (overrideMap[mapKey]) map[mapKey] = overrideMap[mapKey]; });
    return map;
  }
  function docDisplayName(docKey) {
    return String(DB.draft.toolName || _ownRecordName || 'Tool').trim() + ' - ' + DOC_LABELS[docKey];
  }
  function docSlugOf(docKey) {
    return toolSlugOf() + '-' + docKey;
  }
  function pageBuilderValue(docKey) {
    var doc = docMemory(docKey);
    var seo = {};
    SEO_FIELDS.forEach(function (seoField) { if (doc.seo[seoField]) seo[seoField] = doc.seo[seoField]; });
    var pageStatusValue = String(readParam('pageStatus', '') || '').trim();
    var pageMetaData = {};
    if (pageStatusValue) pageMetaData.status = pageStatusValue;
    return {
      code: { html: String(doc.html || ''), css: String(doc.css || ''), js: String(doc.js || '') },
      seo: seo,
      pageMeta: {
        name: docDisplayName(docKey),
        slug: docSlugOf(docKey),
        meta: { language: readParam('docLanguage', 'en') || 'en' },
        data: pageMetaData
      },
      version: '1.0.0',
      activeSessionId: '',
      chatCache: { sessionId: '', messages: [] }
    };
  }
  function buildPageDcb(docKey) {
    var fieldMap = pageFieldMap();
    var payload = {};
    if (fieldMap.webpageContentWithBuilder) payload[fieldMap.webpageContentWithBuilder] = pageBuilderValue(docKey);
    return { name: docDisplayName(docKey), payload: payload };
  }
  function buildSocialDcb(docKey) {
    var doc = docMemory('social');
    var fieldMap = socialFieldMap();
    var payload = {};
    if (fieldMap.name) payload[fieldMap.name] = docDisplayName(docKey);
    if (fieldMap.slug) payload[fieldMap.slug] = docSlugOf(docKey);
    if (fieldMap.contentHtml) payload[fieldMap.contentHtml] = String(doc.contentHtml || '');
    if (fieldMap.updatedAt) payload[fieldMap.updatedAt] = new Date().toISOString();
    return { name: docDisplayName(docKey), payload: payload };
  }
  function remotePayloadJson(docKey, cmsObject) {
    var dcb = objectDcb(cmsObject);
    if (docKey === 'social') {
      var socialMap = socialFieldMap();
      return JSON.stringify({ contentHtml: String((socialMap.contentHtml && dcb[socialMap.contentHtml]) || '') });
    }
    var fieldMap = pageFieldMap();
    var builderValue = fieldMap.webpageContentWithBuilder ? dcb[fieldMap.webpageContentWithBuilder] : null;
    var code = (builderValue && builderValue.code && typeof builderValue.code === 'object') ? builderValue.code : {};
    var seo = {};
    if (builderValue && builderValue.seo && typeof builderValue.seo === 'object') {
      SEO_FIELDS.forEach(function (seoField) {
        if (typeof builderValue.seo[seoField] === 'string') seo[seoField] = builderValue.seo[seoField];
      });
    }
    return JSON.stringify({ html: String(code.html || ''), css: String(code.css || ''), js: String(code.js || ''), seo: seo });
  }
  function remoteSignature(docKey, cmsObject) {
    return payloadSignatureOf(remotePayloadJson(docKey, cmsObject));
  }
  function applyPageObjectToMemory(docKey, cmsObject) {
    var dcb = objectDcb(cmsObject);
    var fieldMap = pageFieldMap();
    var doc = docMemory(docKey);
    var builderValue = fieldMap.webpageContentWithBuilder ? dcb[fieldMap.webpageContentWithBuilder] : null;
    if (builderValue && typeof builderValue === 'object') {
      if (builderValue.code && typeof builderValue.code === 'object') {
        if (typeof builderValue.code.html === 'string') doc.html = builderValue.code.html;
        if (typeof builderValue.code.css === 'string') doc.css = builderValue.code.css;
        if (typeof builderValue.code.js === 'string') doc.js = builderValue.code.js;
      }
      if (builderValue.seo && typeof builderValue.seo === 'object') {
        SEO_FIELDS.forEach(function (seoField) {
          if (typeof builderValue.seo[seoField] === 'string') doc.seo[seoField] = builderValue.seo[seoField];
        });
      }
    }
  }
  function applySocialObjectToMemory(docKey, cmsObject) {
    var dcb = objectDcb(cmsObject);
    var fieldMap = socialFieldMap();
    if (fieldMap.contentHtml && typeof dcb[fieldMap.contentHtml] === 'string') {
      docMemory(docKey).contentHtml = dcb[fieldMap.contentHtml];
    }
  }
  function legacySignatureOf(docKey, savedDoc) {
    if (docKey === 'social') return JSON.stringify({ contentHtml: String(savedDoc.contentHtml || '') });
    var seo = {};
    if (savedDoc.seo && typeof savedDoc.seo === 'object') {
      SEO_FIELDS.forEach(function (seoField) { if (savedDoc.seo[seoField]) seo[seoField] = savedDoc.seo[seoField]; });
    }
    return JSON.stringify({ html: String(savedDoc.html || ''), css: String(savedDoc.css || ''), js: String(savedDoc.js || ''), seo: seo });
  }
  function migrateLegacyDocContent(rawValue) {
    var legacyDocs = rawValue && rawValue.draft && rawValue.draft.docs;
    if (!legacyDocs || typeof legacyDocs !== 'object') return;
    DOC_KEYS.forEach(function (docKey) {
      var savedDoc = legacyDocs[docKey];
      if (!savedDoc || typeof savedDoc !== 'object') return;
      var hasContent = docKey === 'social'
        ? (typeof savedDoc.contentHtml === 'string' && savedDoc.contentHtml !== '')
        : (typeof savedDoc.html === 'string' && savedDoc.html !== '');
      if (!hasContent) return;
      var target = normalizeDocTarget(savedDoc.target);
      if (target && target.pushedSignature && signatureMatchesPayload(target.pushedSignature, legacySignatureOf(docKey, savedDoc))) {
        logDiagnostics('doc-migrate-' + docKey, 'content already saved in ' + target.objectType + ' ' + target.objectId + ' - removed from this record');
        return;
      }
      var memory = docMemory(docKey);
      if (docKey === 'social') {
        memory.contentHtml = String(savedDoc.contentHtml || '');
      } else {
        memory.html = String(savedDoc.html || '');
        memory.css = String(savedDoc.css || '');
        memory.js = String(savedDoc.js || '');
        if (savedDoc.seo && typeof savedDoc.seo === 'object') {
          SEO_FIELDS.forEach(function (seoField) {
            memory.seo[seoField] = String(savedDoc.seo[seoField] || '');
          });
        }
      }
      memory.loaded = true;
      memory.dirty = true;
      logDiagnostics('doc-migrate-' + docKey, 'content kept in memory (not saved to its object yet) - click Save document to move it out of this record');
    });
  }
  function userNameOf() {
    var user = _user || getUserSafe();
    return (user && (user.name || user.id)) || 'user';
  }

  /* --------------------------------------------------------
     Code parts (each part lives in its own object - 1 MB each)
  -------------------------------------------------------- */
  function codePartKeyOf(codeKey) {
    return CODE_TAB_OF_KEY[codeKey] || 'html';
  }
  function toolCodeKeyOf(part) {
    return 'tool' + part.charAt(0).toUpperCase() + part.slice(1) + 'Code';
  }
  function codePartsType() {
    return legacyToCurrentType(readParam('codePartsTargetType', DEFAULT_CODE_PARTS_TARGET_TYPE)) || DEFAULT_CODE_PARTS_TARGET_TYPE;
  }
  function codePartObjectIds(ref) {
    if (!ref || typeof ref !== 'object') return [];
    if (Array.isArray(ref.objectIds)) {
      return ref.objectIds.filter(function (objectId) { return typeof objectId === 'string' && objectId; });
    }
    if (typeof ref.objectId === 'string' && ref.objectId) return [ref.objectId];
    return [];
  }
  function hasCodePartRef(part) {
    return codePartObjectIds(DB.draft.codeParts[part]).length > 0;
  }
  function codeChunkBytes() {
    var kilobytes = Number(readParam('codeChunkKb', String(DEFAULT_CODE_CHUNK_KB)));
    if (!isFinite(kilobytes) || kilobytes <= 0) kilobytes = DEFAULT_CODE_CHUNK_KB;
    return Math.round(kilobytes * 1024);
  }
  function versionSnapshotMaxBytes() {
    var kilobytes = Number(readParam('versionSnapshotMaxKb', String(DEFAULT_VERSION_SNAPSHOT_MAX_KB)));
    if (!isFinite(kilobytes) || kilobytes <= 0) kilobytes = DEFAULT_VERSION_SNAPSHOT_MAX_KB;
    return Math.round(kilobytes * 1024);
  }
  function splitCodeIntoChunks(rawCode) {
    var source = String(rawCode == null ? '' : rawCode);
    var limitBytes = codeChunkBytes();
    if (!source) return [''];
    if (utf8SizeOf(source) <= limitBytes) return [source];
    var chunks = [];
    var chunkStart = 0;
    var chunkByteCount = 0;
    var cursor = 0;
    while (cursor < source.length) {
      var newlineIndex = source.indexOf('\n', cursor);
      var lineEnd = newlineIndex === -1 ? source.length : newlineIndex + 1;
      var lineByteCount = utf8SizeOf(source.slice(cursor, lineEnd));
      if (lineByteCount > limitBytes) {
        // Hard-split the accumulated prefix plus this oversized line as one range,
        // so a tiny prefix is not wasted as its own chunk.
        var segmentStart = chunkStart;
        while (segmentStart < lineEnd) {
          var lowLength = 1;
          var highLength = Math.min(lineEnd - segmentStart, limitBytes);
          var bestLength = 1;
          while (lowLength <= highLength) {
            var middleLength = Math.floor((lowLength + highLength) / 2);
            if (utf8SizeOf(source.slice(segmentStart, segmentStart + middleLength)) <= limitBytes) {
              bestLength = middleLength;
              lowLength = middleLength + 1;
            } else {
              highLength = middleLength - 1;
            }
          }
          var lastCharCode = source.charCodeAt(segmentStart + bestLength - 1);
          if (lastCharCode >= 0xD800 && lastCharCode <= 0xDBFF && bestLength > 1) bestLength -= 1;
          chunks.push(source.slice(segmentStart, segmentStart + bestLength));
          segmentStart += bestLength;
        }
        chunkStart = lineEnd;
        chunkByteCount = 0;
        cursor = lineEnd;
        continue;
      }
      if (chunkByteCount + lineByteCount > limitBytes && cursor > chunkStart) {
        chunks.push(source.slice(chunkStart, cursor));
        chunkStart = cursor;
        chunkByteCount = 0;
      }
      chunkByteCount += lineByteCount;
      cursor = lineEnd;
    }
    if (chunkStart < source.length) chunks.push(source.slice(chunkStart));
    return chunks.length ? chunks : [source];
  }
  function codePartMemory(part) {
    if (!_codeMemory[part]) _codeMemory[part] = { code: '', loaded: false, dirty: false };
    return _codeMemory[part];
  }
  function codePartText(part) {
    return codePartMemory(part).code;
  }
  function codePartObjectName(part, chunkIndex, chunkCount) {
    var objectName = String(DB.draft.toolName || _ownRecordName || 'Tool').trim() + ' - ' + CODE_PART_LABELS[part];
    if (chunkCount > 1) objectName += ' (' + (chunkIndex + 1) + '/' + chunkCount + ')';
    return objectName;
  }
  function hashCode(text) {
    var hash = 5381;
    for (var charIndex = 0; charIndex < text.length; charIndex++) {
      hash = ((hash << 5) + hash + text.charCodeAt(charIndex)) | 0;
    }
    return String(hash);
  }
  function codePartSignature(part) {
    return hashCode(codePartMemory(part).code);
  }
  function buildCodePartPayload(part, chunkCode, chunkIndex, chunkCount) {
    return {
      toolSlug: toolSlugOf(),
      toolName: DB.draft.toolName || '',
      part: part,
      chunkIndex: chunkIndex,
      chunkCount: chunkCount,
      code: String(chunkCode || ''),
      pushedAt: new Date().toISOString(),
      pushedBy: userNameOf()
    };
  }
  function findCodePartObjects(objects, wantedPart) {
    var toolSlug = toolSlugOf();
    var matches = [];
    for (var index = 0; index < objects.length; index++) {
      var cmsObject = objects[index];
      if (!cmsObject) continue;
      var dcb = objectDcb(cmsObject);
      if (String(dcb.part) === wantedPart && String(dcb.toolSlug) === toolSlug) {
        matches.push({ cmsObject: cmsObject, chunkIndex: Number(dcb.chunkIndex) || 0 });
      }
    }
    matches.sort(function (first, second) { return first.chunkIndex - second.chunkIndex; });
    return matches;
  }
  function loadCodePart(part) {
    var memory = codePartMemory(part);
    if (memory.loaded) return;
    var ref = DB.draft.codeParts[part] || null;
    var objectIds = codePartObjectIds(ref);
    var legacyCode = String(DB.draft[toolCodeKeyOf(part)] || '');
    if (!objectsApiAvailable() || !objectIds.length) {
      memory.loaded = true;
      if (legacyCode) { memory.code = legacyCode; memory.dirty = false; }
      return;
    }
    var objectType = codePartsType();
    var loadedChunks = new Array(objectIds.length);
    var pendingCount = objectIds.length;
    var loadFailed = false;
    function finishChunkLoad() {
      memory.loaded = true;
      if (loadFailed) {
        memory.code = legacyCode;
        memory.dirty = !!legacyCode;
        logDiagnostics('code-load-' + part, 'chunk load failed - code stays in this record');
        return;
      }
      var loadedCode = loadedChunks.join('');
      var recordCode = String(DB.draft[toolCodeKeyOf(part)] || '');
      var recordCopyDiffers = !!recordCode && recordCode !== loadedCode;
      // The part objects are authoritative: the record must not keep a second copy of the code.
      memory.code = recordCopyDiffers ? recordCode : loadedCode;
      memory.dirty = recordCopyDiffers;
      DB.draft.codeParts[part] = {
        objectIds: objectIds,
        chunkCount: objectIds.length,
        chunkBytes: loadedChunks.map(function (chunkText) { return utf8SizeOf(chunkText); }),
        pushedAt: ref && ref.pushedAt ? ref.pushedAt : '',
        pushedSignature: codePartSignature(part)
      };
      DB.draft[toolCodeKeyOf(part)] = '';
      persistImmediate();
      renderCodeEditors();
      logDiagnostics('code-load-' + part, 'loaded ' + objectIds.length + ' chunk(s) - ' + loadedCode.length + ' chars'
        + (recordCopyDiffers ? ' · record copy differs - it is pushed to the part objects' : ' · record copy cleared'));
      syncCodePartsMode();
    }
    objectIds.forEach(function (objectId, chunkIndex) {
      tool.requestObjects('get', { mainObjectType: objectType, objectId: objectId }, function (getError, getResult) {
        if (getError) {
          loadFailed = true;
          logDiagnostics('code-load-' + part, 'chunk ' + (chunkIndex + 1) + ' get error: ' + getError);
        } else {
          var cmsObject = getResult && getResult.object ? getResult.object : null;
          loadedChunks[chunkIndex] = cmsObject ? String(objectDcb(cmsObject).code || '') : '';
        }
        pendingCount--;
        if (pendingCount === 0) finishChunkLoad();
      });
    });
  }
  function pushCodePart(part) {
    if (!canWrite()) return;
    if (!objectsApiAvailable()) {
      logDiagnostics('code-push-' + part, 'object API unavailable - code stays in this record');
      return;
    }
    if (_codePushBusy[part]) return;
    var memory = codePartMemory(part);
    _codePushBusy[part] = true;
    var objectType = codePartsType();
    var signature = codePartSignature(part);
    var ref = DB.draft.codeParts[part] || null;
    var refObjectIds = codePartObjectIds(ref);
    var chunkTexts = splitCodeIntoChunks(memory.code);
    var chunkCount = chunkTexts.length;

    function resetCodePushState() {
      _codePushBusy[part] = false;
      _codePushArmed[part] = false;
      _codePushCooldownUntil[part] = 0;
      _codePushFailedSignature[part] = '';
    }
    function failCodePush(failureText, label) {
      _codePushBusy[part] = false;
      _codePushCooldownUntil[part] = Date.now() + CODE_PUSH_COOLDOWN_MS;
      _codePushFailedSignature[part] = signature;
      logDiagnostics('code-push-' + part, label + ': ' + failureText);
      notify('Code push failed: ' + failureText + (isReadOnlyStoreError(failureText) ? readOnlyStoreHint(objectType) : ''), 'error');
    }
    function finishCodePush(resultObjectIds) {
      DB.draft.codeParts[part] = {
        objectIds: resultObjectIds,
        chunkCount: chunkCount,
        chunkBytes: chunkTexts.map(function (chunkText) { return utf8SizeOf(chunkText); }),
        pushedAt: new Date().toISOString(),
        pushedSignature: signature
      };
      memory.dirty = false;
      DB.draft[toolCodeKeyOf(part)] = '';
      resetCodePushState();
      persistImmediate();
      updateCodeMeta(toolCodeKeyOf(part));
      renderObjectLinks();
      logDiagnostics('code-push-' + part, 'pushed ' + resultObjectIds.length + ' chunk(s): ' + resultObjectIds.join(', ') + ' - code removed from this record');
    }
    function deleteCodeObjects(objectIds) {
      var uniqueIds = objectIds.filter(function (objectId, index) { return objectId && objectIds.indexOf(objectId) === index; });
      uniqueIds.forEach(function (objectId) {
        tool.requestObjects('delete', { mainObjectType: objectType, objectId: objectId }, function (deleteError) {
          if (deleteError) logDiagnostics('code-push-' + part, 'extra object delete failed (' + objectId + '): ' + deleteError);
          else logDiagnostics('code-push-' + part, 'deleted duplicate/extra object ' + objectId);
        });
      });
    }
    function createChunkObject(chunkIndex, next) {
      var createParams = {
        mainObjectType: objectType,
        name: codePartObjectName(part, chunkIndex, chunkCount),
        productData: { data_categoriesBased: buildCodePartPayload(part, chunkTexts[chunkIndex], chunkIndex, chunkCount) }
      };
      var partFolderTypeId = leafTypeIdOf('codeParts');
      if (partFolderTypeId) createParams.typeId = partFolderTypeId;
      tool.requestObjects('create', createParams, function (createError, createResult) {
        if (createError || !createResult || !createResult.object) {
          next(String(createError || 'no object returned'));
          return;
        }
        var createdObject = createResult.object;
        next(null, createdObject.id || createdObject._id);
      });
    }
    function writeChunkObject(chunkIndex, existingObjectId, next) {
      if (!existingObjectId) { createChunkObject(chunkIndex, next); return; }
      var payload = buildCodePartPayload(part, chunkTexts[chunkIndex], chunkIndex, chunkCount);
      tool.requestObjects('update', { mainObjectType: objectType, objectId: existingObjectId, productData: { data_categoriesBased: payload } }, function (updateError) {
        if (!updateError) { next(null, existingObjectId); return; }
        var failureText = String(updateError || '');
        if (isReadOnlyStoreError(failureText)) { next(failureText); return; }
        logDiagnostics('code-push-' + part, 'chunk ' + (chunkIndex + 1) + ' update failed (' + failureText + ') - creating a replacement object');
        createChunkObject(chunkIndex, next);
      });
    }
    function writeChunks(idsByIndex, next) {
      var resultObjectIds = [];
      var chunkIndex = 0;
      function writeNextChunk() {
        if (chunkIndex >= chunkCount) { next(null, resultObjectIds); return; }
        var currentIndex = chunkIndex;
        writeChunkObject(currentIndex, idsByIndex[currentIndex] || '', function (writeError, objectId) {
          if (writeError) { next(writeError); return; }
          resultObjectIds[currentIndex] = objectId;
          chunkIndex++;
          writeNextChunk();
        });
      }
      writeNextChunk();
    }

    tool.requestObjects('query', { mainObjectType: objectType }, function (queryError, queryResult) {
      if (queryError) {
        failCodePush(String(queryError), 'query error - code stays in this record');
        return;
      }
      var matches = findCodePartObjects((queryResult && queryResult.objects) || [], part);
      var matchIdsByIndex = {};
      var extraObjectIds = [];
      matches.forEach(function (match) {
        var matchObjectId = match.cmsObject.id || match.cmsObject._id;
        if (!matchObjectId) return;
        if (!matchIdsByIndex[match.chunkIndex]) matchIdsByIndex[match.chunkIndex] = matchObjectId;
        else extraObjectIds.push(matchObjectId);
      });
      var idsByIndex = {};
      for (var chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
        if (matchIdsByIndex[chunkIndex]) {
          // A visible object for this chunk wins; a stale stored id becomes cleanup.
          idsByIndex[chunkIndex] = matchIdsByIndex[chunkIndex];
          if (refObjectIds[chunkIndex] && refObjectIds[chunkIndex] !== matchIdsByIndex[chunkIndex]) {
            extraObjectIds.push(refObjectIds[chunkIndex]);
          }
        } else if (refObjectIds[chunkIndex]) {
          idsByIndex[chunkIndex] = refObjectIds[chunkIndex];
        }
      }
      Object.keys(matchIdsByIndex).forEach(function (indexKey) {
        var indexNumber = Number(indexKey);
        if (indexNumber >= chunkCount) extraObjectIds.push(matchIdsByIndex[indexKey]);
      });
      writeChunks(idsByIndex, function (writeError, resultObjectIds) {
        if (writeError) {
          failCodePush(writeError, 'chunk write error');
          return;
        }
        finishCodePush(resultObjectIds.filter(function (objectId) { return !!objectId; }));
        if (extraObjectIds.length) deleteCodeObjects(extraObjectIds);
      });
    });
  }
  function scheduleCodeModeSync() {
    clearTimeout(_codeModeTimer);
    _codeModeTimer = setTimeout(function () { syncCodePartsMode(); }, 1200);
  }
  function codeSplitBytes() {
    var kilobytes = Number(readParam('codeSplitThresholdKb', '500'));
    if (!isFinite(kilobytes) || kilobytes <= 0) kilobytes = 500;
    return Math.round(kilobytes * 1024);
  }
  function codeMergeBackBytes() {
    return Math.round(codeSplitBytes() * 0.8);
  }
  function totalCodeBytes() {
    var total = 0;
    CODE_PART_KEYS.forEach(function (part) { total += codePartMemory(part).code.length; });
    return total;
  }
  function allCodePartsLoaded() {
    return CODE_PART_KEYS.every(function (part) { return codePartMemory(part).loaded; });
  }
  function codePartsMode() {
    var hasRefs = CODE_PART_KEYS.some(function (part) { return hasCodePartRef(part); });
    if (hasRefs && !allCodePartsLoaded()) return 'split';
    if (hasRefs) {
      if (totalCodeBytes() < codeMergeBackBytes()) return 'combined';
      return 'split';
    }
    if (!allCodePartsLoaded()) return 'combined';
    if (totalCodeBytes() > codeSplitBytes()) return 'split';
    return 'combined';
  }
  function setCodeMode(mode) {
    if (mode !== _codeModeCurrent) {
      _codeModeCurrent = mode;
      logDiagnostics('code-mode', mode === 'split'
        ? 'split mode - ' + Math.round(totalCodeBytes() / 1024) + ' KB of code lives in part objects (split above ' + Math.round(codeSplitBytes() / 1024) + ' KB)'
        : 'combined mode - ' + Math.round(totalCodeBytes() / 1024) + ' KB of code lives in this record');
    }
    renderCodeModeBadge();
    renderObjectLinks();
    renderCodeEditors();
    renderCodeSizes();
  }
  function mergeCodeBackIntoRecord() {
    var objectIdsToDelete = [];
    var wroteRecord = false;
    CODE_PART_KEYS.forEach(function (part) {
      var codeKey = toolCodeKeyOf(part);
      var memory = codePartMemory(part);
      if (DB.draft[codeKey] !== memory.code) { DB.draft[codeKey] = memory.code; wroteRecord = true; }
      memory.dirty = false;
      codePartObjectIds(DB.draft.codeParts[part]).forEach(function (objectId) { objectIdsToDelete.push(objectId); });
    });
    if (objectIdsToDelete.length) DB.draft.codeParts = {};
    if (wroteRecord || objectIdsToDelete.length) persist();
    setCodeMode('combined');
    if (objectIdsToDelete.length) {
      logDiagnostics('code-mode', 'merged code back into the record - removing ' + objectIdsToDelete.length + ' part object(s)');
      objectIdsToDelete.forEach(function (objectId) {
        tool.requestObjects('delete', { mainObjectType: codePartsType(), objectId: objectId }, function (deleteError) {
          if (deleteError) logDiagnostics('code-mode', 'part object delete failed (manual cleanup needed): ' + deleteError);
        });
      });
    }
  }
  function syncCodePartsMode() {
    if (!objectsApiAvailable()) {
      var copiedToRecord = false;
      CODE_PART_KEYS.forEach(function (part) {
        var codeKey = toolCodeKeyOf(part);
        var memory = codePartMemory(part);
        if (!DB.draft[codeKey] && memory.code) { DB.draft[codeKey] = memory.code; copiedToRecord = true; }
      });
      if (copiedToRecord) persist();
      setCodeMode('combined');
      return;
    }
    if (!allCodePartsLoaded()) return;
    var mode = codePartsMode();
    if (mode === 'split') {
      setCodeMode('split');
      CODE_PART_KEYS.forEach(function (part) {
        var memory = codePartMemory(part);
        var ref = DB.draft.codeParts[part] || null;
        var needsPush = memory.dirty || !hasCodePartRef(part);
        var failedRecently = Date.now() < (_codePushCooldownUntil[part] || 0)
          && _codePushFailedSignature[part] === codePartSignature(part);
        if (needsPush && !failedRecently) pushCodePart(part);
      });
    } else {
      mergeCodeBackIntoRecord();
    }
  }
  function initCodePartsMemory() {
    CODE_PART_KEYS.forEach(function (part) {
      var codeKey = toolCodeKeyOf(part);
      var legacyCode = String(DB.draft[codeKey] || '');
      var memory = codePartMemory(part);
      if (hasCodePartRef(part)) {
        if (objectsApiAvailable()) {
          // The part objects are authoritative. The record copy is only a fallback while
          // the objects are read; finishChunkLoad clears it from the record.
          memory.code = legacyCode;
          memory.loaded = false;
          memory.dirty = false;
          loadCodePart(part);
        } else {
          memory.code = legacyCode;
          memory.loaded = true;
          memory.dirty = false;
        }
        return;
      }
      memory.code = legacyCode;
      memory.loaded = true;
      memory.dirty = !!legacyCode;
    });
    syncCodePartsMode();
  }

  function openDoc(docKey) {
    var memory = docMemory(docKey);
    if (memory.loaded) return;
    var target = DB.draft.docs[docKey].target || null;
    if (!target || !target.objectId) { memory.loaded = true; refreshDocPaneValues(); return; }
    if (!objectsApiAvailable() || _docLoadBusy[docKey]) { refreshDocPaneValues(); return; }
    _docLoadBusy[docKey] = true;
    var objectType = legacyToCurrentType(target.objectType) || docTargetType(docKey);
    logDiagnostics('doc-open-' + docKey, 'loading ' + objectType + ' ' + target.objectId);
    tool.requestObjects('get', { mainObjectType: objectType, objectId: target.objectId }, function (getError, getResult) {
      _docLoadBusy[docKey] = false;
      if (getError) {
        memory.loaded = true;
        logDiagnostics('doc-open-' + docKey, 'get error: ' + getError);
        refreshDocPaneValues();
        return;
      }
      var cmsObject = getResult && getResult.object ? getResult.object : null;
      if (!cmsObject) { memory.loaded = true; refreshDocPaneValues(); return; }
      if (docKey === 'social') applySocialObjectToMemory(docKey, cmsObject);
      else applyPageObjectToMemory(docKey, cmsObject);
      memory.loaded = true;
      memory.dirty = false;
      var currentTarget = DB.draft.docs[docKey].target || {};
      DB.draft.docs[docKey].target = {
        objectType: objectType,
        objectId: cmsObject.id || cmsObject._id,
        name: cmsObject.name || '',
        slug: currentTarget.slug || docSlugOf(docKey),
        folderTypeId: currentTarget.folderTypeId || '',
        pushedAt: cmsObject.updated || new Date().toISOString(),
        pushedSignature: remoteSignature(docKey, cmsObject)
      };
      persist();
      refreshDocPaneValues();
      logDiagnostics('doc-open-' + docKey, 'loaded ' + objectType + ' ' + (cmsObject.id || '?'));
    });
  }

  function saveDoc(docKey) {
    if (!canWrite()) { notify('Read-only - saving is disabled.', 'warning'); return; }
    if (!objectsApiAvailable()) {
      logDiagnostics('doc-save-' + docKey, 'requestObjects missing - allowObjectCRUD off');
      notify('Object API is unavailable here (allowObjectCRUD off).', 'warning');
      return;
    }
    var objectType = docTargetType(docKey);
    var slug = docSlugOf(docKey);
    var leafTypeId = leafTypeIdOf(docKey);
    var built = docKey === 'social' ? buildSocialDcb(docKey) : buildPageDcb(docKey);
    var signature = contentSignature(docKey);
    var memory = docMemory(docKey);
    var target = DB.draft.docs[docKey].target || null;
    logDiagnostics('doc-save-' + docKey, 'saving to ' + objectType + ' folder=' + (leafTypeId || 'default') + ' slug=' + slug + ' target=' + (target && target.objectId ? target.objectId + (target.folderTypeId ? ' @' + target.folderTypeId : ' @?') : 'none'));

    function finishSave(cmsObject) {
      DB.draft.docs[docKey].target = {
        objectType: objectType,
        objectId: cmsObject.id || cmsObject._id,
        name: built.name,
        slug: slug,
        folderTypeId: leafTypeId,
        pushedAt: new Date().toISOString(),
        pushedSignature: signature
      };
      memory.dirty = false;
      _docPushArmed[docKey] = false;
      persist();
      renderDocStatus(docKey);
      renderObjectLinks();
      notify(DOC_LABELS[docKey] + ' saved to its own ' + (docKey === 'social' ? 'social object' : 'page object (with SEO)') + '.', 'success');
    }

    function performWrite(existingObject) {
      if (existingObject) {
        var targetStillMatchesRemote = signatureMatchesPayload(target && target.pushedSignature, remotePayloadJson(docKey, existingObject));
        if (target && target.pushedSignature && !targetStillMatchesRemote && !_docPushArmed[docKey]) {
          _docPushArmed[docKey] = true;
          clearTimeout(_docPushArmTimers[docKey]);
          _docPushArmTimers[docKey] = setTimeout(function () { _docPushArmed[docKey] = false; }, 8000);
          logDiagnostics('doc-save-' + docKey, 'target changed outside - click Save again to overwrite');
          notify('The ' + DOC_LABELS[docKey] + ' object changed outside the editor. Click Save again within 8 seconds to overwrite.', 'warning');
          return;
        }
        tool.requestObjects('update', { mainObjectType: objectType, objectId: existingObject.id, productData: { data_categoriesBased: built.payload } }, function (updateError) {
          if (updateError) {
            logDiagnostics('doc-save-' + docKey, 'update error: ' + updateError);
            notify('Save failed: ' + updateError, 'error');
            return;
          }
          finishSave(existingObject);
        });
      } else {
        var createParams = { mainObjectType: objectType, name: built.name, productData: { data_categoriesBased: built.payload } };
        if (leafTypeId) createParams.typeId = leafTypeId;
        tool.requestObjects('create', createParams, function (createError, createResult) {
          if (createError || !createResult || !createResult.object) {
            logDiagnostics('doc-save-' + docKey, 'create error: ' + (createError || 'no object returned'));
            notify('Save failed: ' + (createError || 'no object returned'), 'error');
            return;
          }
          finishSave(createResult.object);
        });
      }
    }

    function lookupBySlugThenWrite() {
      var queryParams = { mainObjectType: objectType };
      var lookupFolderTypeId = leafTypeIdOf(docKey);
      if (lookupFolderTypeId) queryParams.typeId = lookupFolderTypeId;
      tool.requestObjects('query', queryParams, function (queryError, queryResult) {
        if (queryError) {
          logDiagnostics('doc-save-' + docKey, 'slug lookup failed - creating a new object: ' + queryError);
          performWrite(null);
          return;
        }
        var objects = (queryResult && queryResult.objects) || [];
        performWrite(findObjectBySlug(objects, slug));
      });
    }

    if (target && target.objectId) {
      var storedFolderTypeId = target.folderTypeId || '';
      if (leafTypeId && storedFolderTypeId !== leafTypeId) {
        rehomeDocObject(docKey, target, leafTypeId, built, slug, signature, memory);
        return;
      }
      tool.requestObjects('get', { mainObjectType: objectType, objectId: target.objectId }, function (getError, getResult) {
        if (getError) {
          logDiagnostics('doc-save-' + docKey, 'get on target failed (' + getError + ') - falling back to slug lookup');
          lookupBySlugThenWrite();
          return;
        }
        performWrite(getResult && getResult.object ? getResult.object : null);
      });
    } else {
      lookupBySlugThenWrite();
    }
  }

  function rehomeDocObject(docKey, oldTarget, newFolderTypeId, built, slug, signature, memory) {
    var objectType = docTargetType(docKey);
    logDiagnostics('doc-save-' + docKey, 'folder changed (' + (oldTarget.folderTypeId || 'default') + ' -> ' + newFolderTypeId + ') - creating the document in the new folder');
    var createParams = { mainObjectType: objectType, name: built.name, productData: { data_categoriesBased: built.payload }, typeId: newFolderTypeId };
    tool.requestObjects('create', createParams, function (createError, createResult) {
      if (createError || !createResult || !createResult.object) {
        logDiagnostics('doc-save-' + docKey, 're-home create error: ' + (createError || 'no object returned'));
        notify('Save failed: ' + (createError || 'no object returned'), 'error');
        return;
      }
      var newObject = createResult.object;
      tool.requestObjects('delete', { mainObjectType: objectType, objectId: oldTarget.objectId }, function (deleteError) {
        if (deleteError) logDiagnostics('doc-save-' + docKey, 'old object delete failed (manual cleanup needed): ' + deleteError);
        DB.draft.docs[docKey].target = {
          objectType: objectType,
          objectId: newObject.id || newObject._id,
          name: built.name,
          slug: slug,
          folderTypeId: newFolderTypeId,
          pushedAt: new Date().toISOString(),
          pushedSignature: signature
        };
        memory.dirty = false;
        _docPushArmed[docKey] = false;
        persist();
        renderDocStatus(docKey);
        renderObjectLinks();
        notify(DOC_LABELS[docKey] + ' saved into folder ' + newFolderTypeId + '.' + (deleteError ? ' The old object in the previous folder stays - delete it manually.' : ' The old object in the previous folder was removed.'), 'success');
      });
    });
  }

  function reloadDoc(docKey) {
    if (!canWrite()) { notify('Read-only - reloading is disabled.', 'warning'); return; }
    if (!objectsApiAvailable()) {
      logDiagnostics('doc-reload-' + docKey, 'requestObjects missing - allowObjectCRUD off');
      notify('Object API is unavailable here (allowObjectCRUD off).', 'warning');
      return;
    }
    var memory = docMemory(docKey);
    if (memory.dirty && !_docReloadArmed[docKey]) {
      _docReloadArmed[docKey] = true;
      clearTimeout(_docReloadArmTimers[docKey]);
      _docReloadArmTimers[docKey] = setTimeout(function () { _docReloadArmed[docKey] = false; }, 8000);
      notify('Reload discards unsaved changes in ' + DOC_LABELS[docKey] + ' - click Reload again within 8 seconds to confirm.', 'warning');
      return;
    }
    _docReloadArmed[docKey] = false;
    var objectType = docTargetType(docKey);
    var slug = docSlugOf(docKey);
    var target = DB.draft.docs[docKey].target || null;
    logDiagnostics('doc-reload-' + docKey, 'reloading from ' + objectType + ' folder=' + (leafTypeIdOf(docKey) || 'default') + ' slug=' + slug);

    function applyObject(cmsObject) {
      if (!cmsObject) {
        notify('No ' + DOC_LABELS[docKey] + ' object found with slug "' + slug + '". Save it first to create it.', 'warning');
        return;
      }
      if (docKey === 'social') applySocialObjectToMemory(docKey, cmsObject);
      else applyPageObjectToMemory(docKey, cmsObject);
      memory.loaded = true;
      memory.dirty = false;
      DB.draft.docs[docKey].target = {
        objectType: objectType,
        objectId: cmsObject.id || cmsObject._id,
        name: cmsObject.name || '',
        slug: slug,
        folderTypeId: (target && target.folderTypeId) ? target.folderTypeId : leafTypeIdOf(docKey),
        pushedAt: cmsObject.updated || new Date().toISOString(),
        pushedSignature: remoteSignature(docKey, cmsObject)
      };
      _docPushArmed[docKey] = false;
      persist();
      refreshDocPaneValues();
      logDiagnostics('doc-reload-' + docKey, 'loaded ' + objectType + ' ' + (cmsObject.id || '?'));
      notify(DOC_LABELS[docKey] + ' loaded from its object.', 'success');
    }

    if (target && target.objectId) {
      tool.requestObjects('get', { mainObjectType: objectType, objectId: target.objectId }, function (getError, getResult) {
        if (getError) { notify('Reload failed: ' + getError, 'error'); return; }
        applyObject(getResult && getResult.object ? getResult.object : null);
      });
    } else {
      var queryParams = { mainObjectType: objectType };
      var lookupFolderTypeId = leafTypeIdOf(docKey);
      if (lookupFolderTypeId) queryParams.typeId = lookupFolderTypeId;
      tool.requestObjects('query', queryParams, function (queryError, queryResult) {
        if (queryError) { notify('Reload failed: ' + queryError, 'error'); return; }
        var objects = (queryResult && queryResult.objects) || [];
        applyObject(findObjectBySlug(objects, slug));
      });
    }
  }

  function buildDocPaneHtml(docKey) {
    var isSocial = docKey === 'social';
    var parts = [];
    parts.push('<div class="htl-doc-head">'
      + '<div class="htl-doc-head-main">'
      + '<span class="htl-doc-title">' + DOC_LABELS[docKey] + ' document</span>'
      + '<span class="htl-doc-subline" id="htl-doc-subline-' + docKey + '">Save writes this document to a CMS object of type <code>' + escHtml(docTargetType(docKey)) + '</code> (slug <code>' + escHtml(docSlugOf(docKey)) + '</code>). Reload reads the saved object content back into the editor.</span>'
      + '</div>'
      + '<span class="htl-doc-status" id="htl-doc-status-' + docKey + '">New document - not saved yet</span>'
      + '<span class="htl-doc-actions">'
      + '<button class="htl-btn htl-btn-primary htl-btn-sm" data-act="doc-save" data-doc="' + docKey + '" title="Create or update the ' + escHtml(docTargetType(docKey)) + ' object with this document">⇪ Save document</button>'
      + '<button class="htl-btn htl-btn-ghost htl-btn-sm" data-act="doc-reload" data-doc="' + docKey + '" title="Load the saved content from the ' + escHtml(docTargetType(docKey)) + ' object into the editor">↻ Reload from object</button>'
      + '</span></div>');
    var partDefinitions = isSocial
      ? [['preview', 'Preview'], ['content', 'HTML']]
      : [['preview', 'Preview'], ['html', 'HTML'], ['css', 'CSS'], ['js', 'JS'], ['seo', 'SEO']];
    parts.push('<div class="htl-doc-workspace"><div class="htl-doc-sub-tabs">');
    partDefinitions.forEach(function (partInfo) {
      parts.push('<button class="htl-doc-sub-tab" data-doc-part="' + partInfo[0] + '" data-doc="' + docKey + '">' + partInfo[1] + '</button>');
    });
    parts.push('</div>');
    if (isSocial) {
      parts.push('<div class="htl-doc-part" id="htl-doc-part-social-content">'
        + '<div class="htl-editor">'
        + '<div class="htl-editor-head">'
        + '<span class="htl-editor-title">Share kit HTML</span>'
        + '<span class="htl-editor-hint">Full standalone document - this is NOT a website page. Prepared for social media integrations.</span>'
        + '<span class="htl-editor-meta" id="htl-doc-meta-social-content">0 lines · 0 chars</span>'
        + '</div>'
        + '<div class="htl-editor-body">'
        + '<pre class="htl-gutter" id="htl-doc-gutter-social-content" aria-hidden="true">1</pre>'
        + '<textarea class="htl-code htl-code-sm" id="htl-doc-social-content" data-doc-field="social.contentHtml" spellcheck="false" wrap="off" placeholder="Paste the full social share document here"></textarea>'
        + '</div></div></div>');
    } else {
      var docParts = [
        ['html', 'HTML fragment', 'One root div - no html/head/body tags. The whole content lives under a single wrapper div.'],
        ['css', 'CSS', 'Scoped stylesheet rules only - no style tag.'],
        ['js', 'JS', 'Idempotent JavaScript only - no script tag.']
      ];
      docParts.forEach(function (partInfo) {
        parts.push('<div class="htl-doc-part" id="htl-doc-part-' + docKey + '-' + partInfo[0] + '">'
          + '<div class="htl-editor">'
          + '<div class="htl-editor-head">'
          + '<span class="htl-editor-title">' + partInfo[1] + '</span>'
          + '<span class="htl-editor-hint">' + partInfo[2] + '</span>'
          + '<span class="htl-editor-meta" id="htl-doc-meta-' + docKey + '-' + partInfo[0] + '">0 lines · 0 chars</span>'
          + '</div>'
          + '<div class="htl-editor-body">'
          + '<pre class="htl-gutter" id="htl-doc-gutter-' + docKey + '-' + partInfo[0] + '" aria-hidden="true">1</pre>'
          + '<textarea class="htl-code htl-code-sm" id="htl-doc-' + docKey + '-' + partInfo[0] + '" data-doc-field="' + docKey + '.' + partInfo[0] + '" spellcheck="false" wrap="off" placeholder="..."></textarea>'
          + '</div></div></div>');
      });
      parts.push('<div class="htl-doc-part" id="htl-doc-part-' + docKey + '-seo"><div class="htl-seo-grid">');
      SEO_FIELDS.forEach(function (seoField) {
        parts.push('<div class="htl-field">'
          + '<label for="htl-doc-' + docKey + '-' + seoField + '">' + SEO_LABELS[seoField] + '</label>'
          + '<input class="htl-input" id="htl-doc-' + docKey + '-' + seoField + '" data-doc-field="' + docKey + '.seo.' + seoField + '" placeholder="...">'
          + '</div>');
      });
      parts.push('</div></div>');
    }
    parts.push('<div class="htl-doc-part" id="htl-doc-part-' + docKey + '-preview">'
      + '<div class="htl-preview-bar htl-doc-preview-bar">'
      + '<button class="htl-btn htl-btn-primary htl-btn-sm" data-act="doc-preview" data-doc="' + docKey + '">▶ Rebuild preview</button>'
      + '<span class="htl-hint">Sandboxed preview of this document. Page documents preview as a full page around the fragment; social previews as-is.</span>'
      + '<span class="htl-preview-status" id="htl-doc-preview-status-' + docKey + '">Not built yet</span>'
      + '</div>'
      + '<div class="htl-preview-frame-wrap">'
      + '<iframe class="htl-preview-frame htl-doc-preview-frame" id="htl-doc-preview-frame-' + docKey + '" sandbox="allow-scripts allow-forms allow-downloads allow-popups" title="Document preview"></iframe>'
      + '</div></div>');
    parts.push('</div>');
    return parts.join('');
  }
  function docPartNamesOf(docKey) {
    return docKey === 'social' ? ['preview', 'content'] : ['preview', 'html', 'css', 'js', 'seo'];
  }
  function setActiveDocPart(docKey, partName) {
    if (partName) _activeDocPart[docKey] = partName;
    if (!_activeDocPart[docKey]) _activeDocPart[docKey] = 'preview';
    var activePart = _activeDocPart[docKey];
    var pane = $('htl-doc-pane-' + docKey);
    if (pane) {
      var partButtons = pane.querySelectorAll('.htl-doc-sub-tab');
      for (var buttonIndex = 0; buttonIndex < partButtons.length; buttonIndex++) {
        partButtons[buttonIndex].classList.toggle('active', partButtons[buttonIndex].getAttribute('data-doc-part') === activePart);
      }
    }
    docPartNamesOf(docKey).forEach(function (partNameItem) {
      var partElement = $('htl-doc-part-' + docKey + '-' + partNameItem);
      if (partElement) partElement.style.display = partNameItem === activePart ? '' : 'none';
    });
    if (activePart === 'preview' && docKey === _activeDocKey) renderDocPreview();
  }
  function bindDocPaneScrolls(docKey) {
    var parts = docKey === 'social' ? ['content'] : ['html', 'css', 'js'];
    parts.forEach(function (part) {
      var textarea = $('htl-doc-' + docKey + '-' + part);
      var gutter = $('htl-doc-gutter-' + docKey + '-' + part);
      if (!textarea) return;
      textarea.addEventListener('scroll', function () {
        if (gutter) gutter.scrollTop = textarea.scrollTop;
      });
      textarea.addEventListener('keydown', function (event) {
        if (event.key !== 'Tab') return;
        event.preventDefault();
        var start = textarea.selectionStart;
        var end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        try { textarea.dispatchEvent(new Event('input', { bubbles: true })); } catch (error) {}
      });
    });
  }
  function ensureDocsStructure() {
    var tabsElement = $('htl-doc-tabs');
    var contentElement = $('htl-doc-content');
    if (!tabsElement || !contentElement) return;
    if (!tabsElement.getAttribute('data-built')) {
      tabsElement.setAttribute('data-built', '1');
      tabsElement.innerHTML = DOC_KEYS.map(function (docKey) {
        return '<button class="htl-doc-tab" data-doc-tab="' + docKey + '">' + DOC_LABELS[docKey] + '</button>';
      }).join('');
      DOC_KEYS.forEach(function (docKey) {
        var pane = document.createElement('div');
        pane.className = 'htl-doc-pane';
        pane.id = 'htl-doc-pane-' + docKey;
        pane.innerHTML = buildDocPaneHtml(docKey);
        contentElement.appendChild(pane);
        bindDocPaneScrolls(docKey);
        setActiveDocPart(docKey);
      });
    }
    DOC_KEYS.forEach(function (docKey) {
      var pane = $('htl-doc-pane-' + docKey);
      if (pane) pane.style.display = docKey === _activeDocKey ? '' : 'none';
    });
    var tabButtons = tabsElement.querySelectorAll('.htl-doc-tab');
    for (var tabIndex = 0; tabIndex < tabButtons.length; tabIndex++) {
      tabButtons[tabIndex].classList.toggle('active', tabButtons[tabIndex].getAttribute('data-doc-tab') === _activeDocKey);
    }
    setActiveDocPart(_activeDocKey);
    renderTargetSummary();
    refreshDocPaneValues();
    openDoc(_activeDocKey);
  }
  function renderTargetSummary() {
    var pageElement = $('htl-target-page-type');
    var socialElement = $('htl-target-social-type');
    var versionsElement = $('htl-target-versions-type');
    var leafElement = $('htl-target-leaf-folder');
    if (pageElement) pageElement.textContent = docTargetType('webpage');
    if (socialElement) socialElement.textContent = docTargetType('social');
    if (versionsElement) versionsElement.textContent = versionsTargetType();
    if (leafElement) {
      var folderParts = DOC_KEYS.concat(['versions', 'codeParts']).map(function (folderKey) {
        var resolvedFolder = leafTypeIdOf(folderKey);
        return folderKey + ' → ' + (resolvedFolder || '(app default)');
      });
      leafElement.textContent = folderParts.join(' · ');
    }
    var noteElement = $('htl-doc-object-note');
    if (noteElement) {
      noteElement.textContent = objectsApiAvailable()
        ? 'Object API available - Save writes each document into its own CMS object in the tool leaf folder above (the CMS hierarchy folder where this record lives).'
        : 'Object API NOT available here (allowObjectCRUD off) - Save/Reload stay disabled until the field settings allow it.';
    }
  }
  function renderCodeModeBadge() {
    var badge = $('htl-code-mode');
    if (!badge) return;
    var split = codePartsMode() === 'split';
    badge.textContent = split ? '◫ Split code documents' : '◧ Single-document code';
    badge.className = 'htl-code-mode ' + (split ? 'split' : 'combined');
    var partSizeSummary = CODE_PART_KEYS.map(function (part) {
      return CODE_PART_SHORT_LABELS[part] + ' ' + formatSizeLabel(utf8SizeOf(codePartMemory(part).code));
    }).join(' · ');
    badge.title = split
      ? 'Code is over the threshold and lives in per-part objects. Each part is split into numbered chunks above ' + Math.round(codeChunkBytes() / 1024) + ' KB. Sizes: ' + partSizeSummary + '.'
      : 'Code lives in this record as one document. Above ' + Math.round(codeSplitBytes() / 1024) + ' KB it splits into per-part objects. Sizes: ' + partSizeSummary + '.';
  }
  function renderCodeSizes() {
    var sizesElement = $('htl-code-sizes');
    if (!sizesElement) return;
    if (codePartsMode() !== 'split') {
      sizesElement.textContent = '';
      sizesElement.style.display = 'none';
      return;
    }
    sizesElement.style.display = '';
    var sizeTexts = [];
    var sizeTitles = [];
    CODE_PART_KEYS.forEach(function (part) {
      var partBytes = utf8SizeOf(codePartMemory(part).code);
      sizeTexts.push(CODE_PART_SHORT_LABELS[part] + ' ' + formatSizeLabel(partBytes));
      sizeTitles.push(CODE_PART_LABELS[part] + ': ' + partBytes + ' bytes');
    });
    sizesElement.textContent = sizeTexts.join(' · ');
    sizesElement.title = 'Code part sizes in their own documents (UTF-8 bytes):\n' + sizeTitles.join('\n')
      + '\nMerges back into this record below ' + Math.round(codeMergeBackBytes() / 1024) + ' KB.';
  }
  function docLinkSizeState(docKey) {
    var target = DB.draft.docs[docKey].target || null;
    var memory = docMemory(docKey);
    var contentBytes = docContentSizeBytes(docKey);
    if (contentBytes < 0) {
      return { label: 'not loaded', dirty: false, title: 'Open the ' + DOC_LABELS[docKey] + ' tab to load this document and see its content size.' };
    }
    var dirty = memory.dirty || !contentSignatureMatches(docKey, target && target.pushedSignature);
    return {
      label: formatSizeLabel(contentBytes) + (dirty ? ' · unsaved' : ''),
      dirty: dirty,
      title: contentBytes + ' bytes of editor content (UTF-8) - this is what gets written to the object.'
    };
  }
  function updateDocLinkSize(docKey) {
    var container = $('htl-object-links');
    if (!container || !container.querySelector) return;
    var row = container.querySelector('[data-doc-link="' + docKey + '"]');
    if (!row || !row.querySelector) return;
    var sizeElement = row.querySelector('.htl-object-link-size');
    if (!sizeElement) return;
    var state = docLinkSizeState(docKey);
    sizeElement.textContent = state.label;
    sizeElement.title = state.title;
    sizeElement.className = 'htl-object-link-size' + (state.dirty ? ' dirty' : '');
  }
  function objectLinkRowHtml(icon, label, objectType, objectId, sizeLabel, sizeIsDirty, sizeTitle, docLinkKey) {
    return '<div class="htl-object-link"' + (docLinkKey ? ' data-doc-link="' + escHtml(docLinkKey) + '"' : '') + '>'
      + '<span class="htl-object-link-label"><span class="htl-object-link-icon">' + escHtml(icon) + '</span>' + escHtml(label) + '</span>'
      + (sizeLabel ? '<span class="htl-object-link-size' + (sizeIsDirty ? ' dirty' : '') + '" title="' + escHtml(sizeTitle || sizeLabel) + '">' + escHtml(sizeLabel) + '</span>' : '')
      + '<code class="htl-object-link-id" title="' + escHtml(objectId) + '">' + escHtml(objectId) + '</code>'
      + fireLinkHtml(objectType, objectId, 'Open ' + label + ' in Firestore')
      + '</div>';
  }
  function renderObjectLinks() {
    renderDevDocuments();
    var container = $('htl-object-links');
    if (!container) return;
    if (!isDeveloper()) { container.innerHTML = ''; container.style.display = 'none'; return; }
    container.style.display = '';
    var rows = [];
    DOC_KEYS.forEach(function (docKey) {
      var target = DB.draft.docs[docKey].target;
      if (!target || !target.objectId) return;
      var sizeState = docLinkSizeState(docKey);
      rows.push(objectLinkRowHtml('📄', DOC_LABELS[docKey], target.objectType || docTargetType(docKey), target.objectId, sizeState.label, sizeState.dirty, sizeState.title, docKey));
    });
    if (codePartsMode() === 'split') {
      CODE_PART_KEYS.forEach(function (part) {
        var ref = DB.draft.codeParts[part];
        var objectIds = codePartObjectIds(ref);
        if (!objectIds.length) return;
        var partMemory = codePartMemory(part);
        var partIsDirty = partMemory.dirty || (!!ref.pushedSignature && ref.pushedSignature !== codePartSignature(part));
        var storedChunkBytes = Array.isArray(ref.chunkBytes) ? ref.chunkBytes : [];
        objectIds.forEach(function (objectId, chunkIndex) {
          var chunkLabel = CODE_PART_LABELS[part] + (objectIds.length > 1 ? ' ' + (chunkIndex + 1) + '/' + objectIds.length : '');
          var sizeBytes = typeof storedChunkBytes[chunkIndex] === 'number' ? storedChunkBytes[chunkIndex] : null;
          rows.push(objectLinkRowHtml('🧩', chunkLabel, codePartsType(), objectId,
            sizeBytes === null ? '' : formatSizeLabel(sizeBytes),
            partIsDirty,
            sizeBytes === null ? 'Chunk ' + (chunkIndex + 1) + ' of the ' + CODE_PART_LABELS[part] + ' code.' : sizeBytes + ' bytes in this chunk (UTF-8).'));
        });
      });
    } else {
      if (_ownRecordId && _ownObjectType) {
        rows.push(objectLinkRowHtml('📦', 'Tool record (code inside)', _ownObjectType, _ownRecordId,
          formatSizeLabel(totalCodeBytes()), false,
          'Combined HTML/CSS/JS lives inside this record document.'));
      } else {
        rows.push('<div class="htl-object-link htl-object-link-empty">Code lives in this record document - no separate code objects (single-document mode).</div>');
      }
    }
    if (!rows.length) {
      rows.push('<div class="htl-object-link htl-object-link-empty">No saved objects yet - save a document or grow the code to create them.</div>');
    }
    container.innerHTML = rows.join('');
  }
  function handleObjectLinkClick(event) {
    var fireLink = event.target && event.target.closest ? event.target.closest('a.htl-fire-link') : null;
    if (fireLink) {
      var href = fireLink.getAttribute('href');
      if (href) {
        if (event.preventDefault) event.preventDefault();
        try {
          if (typeof tool.openUrl === 'function') tool.openUrl(href);
          else if (typeof window !== 'undefined' && window.open) window.open(href, '_blank', 'noopener');
        } catch (error) {}
        logDiagnostics('object-link', 'opened ' + href);
      }
      return;
    }
    var button = event.target && event.target.closest ? event.target.closest('[data-act="open-object"]') : null;
    if (!button) return;
    var objectType = button.getAttribute('data-object-type');
    var objectId = button.getAttribute('data-object-id');
    if (!objectType || !objectId) return;
    try {
      if (typeof tool.openObjectDetail === 'function') tool.openObjectDetail(objectType, objectId);
      else if (typeof tool.openUrl === 'function') tool.openUrl('object/' + objectType + '/' + objectId);
    } catch (error) {}
    logDiagnostics('object-link', 'opened ' + objectType + ' ' + objectId);
  }
  function devDocRowHtml(label, objectType, objectId, sizeLabel, copyKind) {
    var hasRealTarget = !!objectType && !!objectId && objectType.charAt(0) !== '(' && objectId.charAt(0) !== '(';
    return '<div class="htl-object-link' + (copyKind === 'record' ? ' htl-object-link-main' : '') + '" title="' + escHtml(objectType) + ' · ' + escHtml(objectId) + '">'
      + '<span class="htl-object-link-label"><span class="htl-object-link-icon">' + (copyKind === 'record' ? '📦' : '📄') + '</span>' + escHtml(label) + '</span>'
      + (sizeLabel ? '<span class="htl-object-link-size">' + escHtml(sizeLabel) + '</span>' : '')
      + '<code class="htl-object-link-id" title="' + escHtml(objectId) + '">' + escHtml(objectId) + '</code>'
      + (hasRealTarget ? fireLinkHtml(objectType, objectId, 'Open ' + label + ' in Firestore') : '')
      + '<button class="htl-btn htl-btn-ghost htl-btn-sm" data-act="copy-doc" data-copy-kind="' + escHtml(copyKind) + '" data-object-type="' + escHtml(objectType) + '" data-object-id="' + escHtml(objectId) + '" data-doc-label="' + escHtml(label) + '">⧉ Copy</button>'
      + '</div>';
  }
  function devDocGroupHtml(title, rows) {
    return '<div class="htl-dev-docs-group">'
      + '<div class="htl-dev-docs-group-head">' + escHtml(title) + '</div>'
      + rows.join('')
      + '</div>';
  }
  function renderDevDocuments() {
    var tabButton = $('htl-tab-documents');
    var listElement = $('htl-dev-docs-list');
    var noteElement = $('htl-documents-note');
    var developer = isDeveloper();
    if (tabButton) tabButton.style.display = developer ? '' : 'none';
    if (!developer) {
      if (listElement) listElement.innerHTML = '';
      if (noteElement) noteElement.textContent = '';
      if (_activeTab === 'documents') switchTab('details');
      return;
    }
    if (!listElement) return;
    var recordRows = [];
    var documentRows = [];
    var recordText = '';
    var recordBytes = 0;
    try { recordText = JSON.stringify(DB) || ''; } catch (error) {}
    recordBytes = utf8SizeOf(recordText);
    var recordType = _ownObjectType || '(type not exposed by host)';
    var recordId = _ownRecordId || '(id not exposed by host)';
    recordRows.push(devDocRowHtml('Tool record (main document)', recordType, recordId, formatSizeLabel(recordBytes), 'record'));
    if (codePartsMode() === 'split') {
      CODE_PART_KEYS.forEach(function (part) {
        var ref = DB.draft.codeParts[part];
        var objectIds = codePartObjectIds(ref);
        if (!objectIds.length) return;
        var chunkBytes = Array.isArray(ref.chunkBytes) ? ref.chunkBytes : [];
        objectIds.forEach(function (objectId, chunkIndex) {
          var chunkLabel = CODE_PART_LABELS[part] + (objectIds.length > 1 ? ' ' + (chunkIndex + 1) + '/' + objectIds.length : '');
          recordRows.push(devDocRowHtml(chunkLabel, codePartsType(), objectId,
            typeof chunkBytes[chunkIndex] === 'number' ? formatSizeLabel(chunkBytes[chunkIndex]) : '', 'object'));
        });
      });
    }
    DOC_KEYS.forEach(function (docKey) {
      var target = DB.draft.docs[docKey].target;
      if (!target || !target.objectId) return;
      var contentBytes = docContentSizeBytes(docKey);
      documentRows.push(devDocRowHtml(DOC_LABELS[docKey] + ' document', target.objectType || docTargetType(docKey), target.objectId,
        contentBytes < 0 ? 'not loaded' : formatSizeLabel(contentBytes), 'object'));
    });
    if (!documentRows.length) {
      documentRows.push('<div class="htl-object-link htl-object-link-empty">No document objects saved yet - save a webpage, help, updates, presentation or social document in the Docs tab to create its object.</div>');
    }
    listElement.innerHTML = devDocGroupHtml('Tool record and code documents', recordRows)
      + devDocGroupHtml('Document objects (webpage, help, updates, presentation, social)', documentRows);
    var modeNote = codePartsMode() === 'split'
      ? 'Split mode: the tool record above is the main document - it holds the metadata and the object references. The code documents below are additional objects.'
      : 'Combined mode: the tool record above is the main document and holds the HTML, CSS and JS code inside this record.';
    if (!_ownRecordId) modeNote += ' This host does not expose the record id, so the main row cannot link to Firestore - copying still works.';
    var firestoreProject = firestoreProjectId();
    var firestoreNote = firestoreProject
      ? 'Firestore console: project ' + firestoreProject + ' · database ' + firestoreDatabaseId() + '.'
      : 'Firestore project id not detected - set the Firestore Project ID parameter to open documents in the Firebase console.';
    if (noteElement) noteElement.textContent = modeNote + ' ' + firestoreNote + ' The fire icon opens that document; DB Docs is developer-only.';
  }
  function handleDevDocumentCopy(event) {
    if (!isDeveloper()) return;
    var button = event.target && event.target.closest ? event.target.closest('[data-act="copy-doc"]') : null;
    if (!button) return;
    var copyKind = button.getAttribute('data-copy-kind');
    var objectType = button.getAttribute('data-object-type') || '';
    var objectId = button.getAttribute('data-object-id') || '';
    var label = button.getAttribute('data-doc-label') || 'document';
    if (copyKind === 'record') {
      var recordSample = {
        purpose: 'html-tool-library-item record sample',
        objectType: objectType,
        objectId: objectId,
        name: _ownRecordName,
        copiedAt: new Date().toISOString(),
        value: DB
      };
      copyTextWithMessage(JSON.stringify(recordSample, null, 2), 'Tool record sample copied.');
      logDiagnostics('dev-copy', 'record sample copied');
      return;
    }
    if (!objectsApiAvailable()) { notify('Object API is unavailable - cannot read this document.', 'warning'); return; }
    if (!objectType || !objectId) return;
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = '…';
    tool.requestObjects('get', { mainObjectType: objectType, objectId: objectId }, function (getError, getResult) {
      button.disabled = false;
      button.textContent = '⧉ Copy';
      if (getError || !getResult || !getResult.object) {
        notify('Copy failed - could not read ' + label + ': ' + (getError || 'object not found'), 'error');
        return;
      }
      copyTextWithMessage(JSON.stringify(getResult.object, null, 2), label + ' copied.');
      logDiagnostics('dev-copy', label + ' object copied (' + objectType + ' ' + objectId + ')');
    });
  }
  function updateDocEditorMeta(docKey, part) {
    var textarea = $('htl-doc-' + docKey + '-' + part);
    var metaElement = $('htl-doc-meta-' + docKey + '-' + part);
    if (!textarea || !metaElement) return;
    var text = textarea.value || '';
    var lineCount = text ? text.split('\n').length : 1;
    metaElement.textContent = lineCount + ' lines · ' + text.length + ' chars';
  }
  function updateDocGutter(docKey, part) {
    var textarea = $('htl-doc-' + docKey + '-' + part);
    var gutter = $('htl-doc-gutter-' + docKey + '-' + part);
    if (!textarea || !gutter) return;
    var lineCount = textarea.value ? textarea.value.split('\n').length : 1;
    var numbers = [];
    for (var lineNumber = 1; lineNumber <= lineCount; lineNumber++) numbers.push(lineNumber);
    gutter.textContent = numbers.join('\n');
  }
  function refreshDocPaneValues() {
    DOC_KEYS.forEach(function (docKey) {
      var doc = docMemory(docKey);
      var subline = $('htl-doc-subline-' + docKey);
      if (subline) {
        subline.innerHTML = 'Save writes this document to a CMS object of type <code>' + escHtml(docTargetType(docKey)) + '</code> (slug <code>' + escHtml(docSlugOf(docKey)) + '</code>). Reload reads the saved object content back into the editor.';
      }
      if (docKey === 'social') {
        var socialTextarea = $('htl-doc-social-content');
        if (socialTextarea && document.activeElement !== socialTextarea) socialTextarea.value = doc.contentHtml;
        updateDocEditorMeta(docKey, 'content');
      } else {
        ['html', 'css', 'js'].forEach(function (part) {
          var textarea = $('htl-doc-' + docKey + '-' + part);
          if (textarea && document.activeElement !== textarea) textarea.value = doc[part];
          updateDocEditorMeta(docKey, part);
          updateDocGutter(docKey, part);
        });
        SEO_FIELDS.forEach(function (seoField) {
          var inputElement = $('htl-doc-' + docKey + '-' + seoField);
          if (inputElement && document.activeElement !== inputElement) inputElement.value = doc.seo[seoField];
        });
      }
      renderDocStatus(docKey);
    });
    renderObjectLinks();
  }
  function renderDocStatus(docKey) {
    var statusElement = $('htl-doc-status-' + docKey);
    if (!statusElement) return;
    var target = DB.draft.docs[docKey].target;
    var memory = docMemory(docKey);
    if (target && target.objectId) {
      var dirty = memory.dirty || !contentSignatureMatches(docKey, target.pushedSignature);
      statusElement.textContent = target.objectType + ' · ' + target.objectId
        + ' · saved ' + (target.pushedAt ? formatDateTime(target.pushedAt) : '?')
        + (dirty ? ' · not saved' : '');
      statusElement.className = 'htl-doc-status' + (dirty ? ' dirty' : ' ok');
    } else {
      statusElement.textContent = memory.dirty ? 'New - modified, not saved yet' : 'New document - not saved yet';
      statusElement.className = 'htl-doc-status' + (memory.dirty ? ' dirty' : '');
    }
  }
  function handleDocInput(event) {
    var element = event.target;
    if (!element || !element.getAttribute) return;
    var fieldPath = element.getAttribute('data-doc-field');
    if (!fieldPath) return;
    var pieces = fieldPath.split('.');
    var docKey = pieces[0];
    var doc = docMemory(docKey);
    if (pieces[1] === 'seo' && pieces[2]) {
      doc.seo[pieces[2]] = element.value;
    } else {
      doc[pieces[1]] = element.value;
      updateDocEditorMeta(docKey, pieces[1]);
      clearTimeout(_docGutterTimers[docKey + '-' + pieces[1]]);
      _docGutterTimers[docKey + '-' + pieces[1]] = setTimeout(function () { updateDocGutter(docKey, pieces[1]); }, 160);
    }
    doc.dirty = true;
    renderDocStatus(docKey);
    updateDocLinkSize(docKey);
  }
  function handleDocActionClick(event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-act]') : null;
    if (!button) return;
    var action = button.getAttribute('data-act');
    var docKey = button.getAttribute('data-doc');
    if (action === 'doc-save' && docKey) saveDoc(docKey);
    else if (action === 'doc-reload' && docKey) reloadDoc(docKey);
    else if (action === 'doc-preview' && docKey) { _activeDocKey = docKey; renderDocPreview(); }
  }
  function handleDocPartClick(event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-doc-part]') : null;
    if (!button) return;
    var docKey = button.getAttribute('data-doc');
    if (!docKey) return;
    _activeDocKey = docKey;
    setActiveDocPart(docKey, button.getAttribute('data-doc-part'));
  }
  function buildDocPreviewDoc(docKey) {
    var doc = docMemory(docKey);
    if (docKey === 'social') {
      var socialHtml = String(doc.contentHtml || '');
      if (!socialHtml.trim()) {
        return { doc: '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;color:#64748b"><p>No content yet - write the share document first.</p></body></html>', jsSyntaxError: null };
      }
      return { doc: socialHtml, jsSyntaxError: null };
    }
    var jsError = checkJsSyntax(doc.js);
    var scriptOpen = '<' + 'script' + '>';
    var scriptClose = '<' + '/' + 'script' + '>';
    var parts = [];
    parts.push('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">');
    parts.push('<meta name="viewport" content="width=device-width,initial-scale=1">');
    parts.push('<title>' + escHtml(DOC_LABELS[docKey] + ' preview') + '</title>');
    parts.push('<style>body{margin:0;font-family:system-ui,sans-serif}' + String(doc.css || '') + '</style>');
    parts.push('</head><body>');
    parts.push(String(doc.html || ''));
    if (!jsError) parts.push(scriptOpen + String(doc.js || '').replace(/<\/script/gi, '<\\/script') + scriptClose);
    parts.push('</body></html>');
    return { doc: parts.join('\n'), jsSyntaxError: jsError };
  }
  function renderDocPreview() {
    var frame = $('htl-doc-preview-frame-' + _activeDocKey);
    var statusElement = $('htl-doc-preview-status-' + _activeDocKey);
    if (!frame) return;
    var built = buildDocPreviewDoc(_activeDocKey);
    frame.srcdoc = built.doc;
    if (statusElement) {
      if (built.jsSyntaxError) {
        statusElement.textContent = 'JS syntax error: ' + built.jsSyntaxError;
        statusElement.className = 'htl-preview-status err';
      } else {
        statusElement.textContent = DOC_LABELS[_activeDocKey] + ' preview rebuilt ' + formatTime(new Date());
        statusElement.className = 'htl-preview-status ok';
      }
    }
    try { tool.resize(); } catch (error) {}
  }

  /* --------------------------------------------------------
     Schema editors (JSON code / sample / visual editor)
  -------------------------------------------------------- */
  function schemaObjectOf(fieldKey) {
    var parsedValue = parseJsonLenient(DB.draft[fieldKey]);
    return (parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)) ? parsedValue : {};
  }
  function syncSchemaField(fieldKey, objectValue) {
    DB.draft[fieldKey] = JSON.stringify(objectValue || {}, null, 2);
    var textarea = $('htl-f-' + fieldKey);
    if (textarea) textarea.value = DB.draft[fieldKey];
    refreshJsonFieldValidity(fieldKey);
    persist();
    renderSchemaRows(fieldKey);
  }
  function setSchemaTab(fieldKey, partName) {
    if (partName) _activeSchemaTab[fieldKey] = partName;
    if (!_activeSchemaTab[fieldKey]) _activeSchemaTab[fieldKey] = 'json';
    var activePart = _activeSchemaTab[fieldKey];
    var container = $(SCHEMA_CONTAINER_IDS[fieldKey]);
    if (!container) return;
    var tabButtons = container.querySelectorAll('.htl-schema-tab');
    for (var buttonIndex = 0; buttonIndex < tabButtons.length; buttonIndex++) {
      tabButtons[buttonIndex].classList.toggle('active', tabButtons[buttonIndex].getAttribute('data-schema-part') === activePart);
    }
    ['json', 'sample', 'editor'].forEach(function (partNameItem) {
      var pane = $('htl-schema-pane-' + fieldKey + '-' + partNameItem);
      if (pane) pane.style.display = partNameItem === activePart ? '' : 'none';
    });
    if (activePart === 'editor') renderSchemaRows(fieldKey);
  }
  function renderSchemaEditors() {
    SCHEMA_FIELDS.forEach(function (fieldKey) { setSchemaTab(fieldKey); });
  }
  function renderSchemaRows(fieldKey) {
    var rowsElement = $('htl-schema-rows-' + fieldKey);
    if (!rowsElement) return;
    var objectValue = schemaObjectOf(fieldKey);
    var keys = Object.keys(objectValue);
    if (!keys.length) {
      rowsElement.innerHTML = '<div class="htl-schema-empty">No entries yet - add the first one below, or type the JSON code directly.</div>';
      return;
    }
    rowsElement.innerHTML = keys.map(function (rowKey, rowIndex) {
      var valueText = JSON.stringify(objectValue[rowKey]);
      return '<div class="htl-schema-row">'
        + '<input class="htl-input htl-schema-key" data-schema-row="' + rowIndex + '" data-schema-field="' + fieldKey + '" data-schema-key-input="1" placeholder="key" value="' + escHtml(rowKey) + '">'
        + '<input class="htl-input htl-schema-value" data-schema-row="' + rowIndex + '" data-schema-field="' + fieldKey + '" data-schema-value-input="1" placeholder="value (JSON)" value="' + escHtml(valueText) + '">'
        + '<button class="htl-btn htl-btn-ghost htl-btn-sm htl-schema-remove" data-schema-row="' + rowIndex + '" data-schema-field="' + fieldKey + '" title="Remove row">✕</button>'
        + '</div>';
    }).join('');
  }
  function handleSchemaRowsInput(fieldKey, event) {
    var element = event.target;
    if (!element || !element.getAttribute) return;
    var isKeyInput = element.getAttribute('data-schema-key-input');
    var isValueInput = element.getAttribute('data-schema-value-input');
    if (!isKeyInput && !isValueInput) return;
    var objectValue = schemaObjectOf(fieldKey);
    var keys = Object.keys(objectValue);
    var rowIndex = Number(element.getAttribute('data-schema-row'));
    if (!keys[rowIndex]) return;
    if (isKeyInput) {
      var oldKey = keys[rowIndex];
      var newKey = String(element.value || '').trim();
      if (!newKey) { notify('Key cannot be empty.', 'warning'); return; }
      if (newKey !== oldKey && Object.prototype.hasOwnProperty.call(objectValue, newKey)) {
        notify('That key already exists.', 'warning');
        return;
      }
      var rebuiltObject = {};
      keys.forEach(function (rowKey) { rebuiltObject[rowKey] = objectValue[rowKey]; });
      delete rebuiltObject[oldKey];
      rebuiltObject[newKey] = objectValue[oldKey];
      syncSchemaField(fieldKey, rebuiltObject);
    } else {
      var rawText = String(element.value || '').trim();
      var parsedValue = parseJsonLenient(rawText);
      objectValue[keys[rowIndex]] = parsedValue !== null ? parsedValue : rawText;
      syncSchemaField(fieldKey, objectValue);
    }
  }
  function removeSchemaRow(fieldKey, rowIndex) {
    var objectValue = schemaObjectOf(fieldKey);
    var keys = Object.keys(objectValue);
    if (!keys[rowIndex]) return;
    delete objectValue[keys[rowIndex]];
    syncSchemaField(fieldKey, objectValue);
  }
  function addSchemaRow(fieldKey) {
    var objectValue = schemaObjectOf(fieldKey);
    var baseKey = 'newKey';
    var rowKey = baseKey;
    var suffix = 2;
    while (Object.prototype.hasOwnProperty.call(objectValue, rowKey)) {
      rowKey = baseKey + suffix;
      suffix++;
    }
    objectValue[rowKey] = '';
    syncSchemaField(fieldKey, objectValue);
  }
  function handleSchemaRowsClick(fieldKey, event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-schema-field]') : null;
    if (!button) return;
    if (button.getAttribute('data-schema-key-input') || button.getAttribute('data-schema-value-input')) return;
    removeSchemaRow(fieldKey, Number(button.getAttribute('data-schema-row')));
  }

  /* --------------------------------------------------------
     Code versions (separate object type, newest 20 kept)
  -------------------------------------------------------- */
  function snapshotCodeVersion() {
    if (!canWrite()) { notify('Read-only - snapshots are disabled.', 'warning'); return; }
    if (!objectsApiAvailable()) {
      notify('Object API is unavailable here (allowObjectCRUD off).', 'warning');
      return;
    }
    var objectType = versionsTargetType();
    if (!String(codePartText('html') || '').trim() && !String(codePartText('css') || '').trim() && !String(codePartText('js') || '').trim()) {
      notify('The code is empty - nothing to snapshot.', 'warning');
      return;
    }
    var snapshotBytes = utf8SizeOf(codePartText('html')) + utf8SizeOf(codePartText('css')) + utf8SizeOf(codePartText('js'));
    var snapshotMaxBytes = versionSnapshotMaxBytes();
    if (snapshotBytes > snapshotMaxBytes) {
      logDiagnostics('version-snapshot', 'skipped - code is ' + formatSizeLabel(snapshotBytes) + ' (limit ' + formatSizeLabel(snapshotMaxBytes) + ')');
      notify('Code snapshot skipped: the current code is ' + formatSizeLabel(snapshotBytes) + '. A version object stores HTML + CSS + JS in one document and must stay under 1 MB. Reduce the code, or use the code part objects as the working copy.', 'warning');
      return;
    }
    var toolSlug = toolSlugOf();
    logDiagnostics('version-snapshot', 'reading ' + objectType + ' for slug ' + toolSlug);
    tool.requestObjects('query', { mainObjectType: objectType }, function (queryError, queryResult) {
      if (queryError) { notify('Version lookup failed: ' + queryError, 'error'); return; }
      var objects = (queryResult && queryResult.objects) || [];
      var mine = objects.filter(function (cmsObject) { return objectDcb(cmsObject).toolSlug === toolSlug; });
      var maxNumber = 0;
      mine.forEach(function (cmsObject) {
        var versionNumber = Number(objectDcb(cmsObject).versionNumber || 0);
        if (versionNumber > maxNumber) maxNumber = versionNumber;
      });
      var nextNumber = maxNumber + 1;
      var versionName = String(DB.draft.toolName || 'Tool').trim() + ' - v' + nextNumber;
      var createParams = {
        mainObjectType: objectType,
        name: versionName,
        productData: { data_categoriesBased: {
          toolSlug: toolSlug,
          toolName: DB.draft.toolName || '',
          versionNumber: nextNumber,
          htmlCode: codePartText('html'),
          cssCode: codePartText('css'),
          jsCode: codePartText('js'),
          note: '',
          pushedAt: new Date().toISOString(),
          pushedBy: userNameOf()
        } }
      };
      var versionsFolderTypeId = leafTypeIdOf('versions');
      if (versionsFolderTypeId) createParams.typeId = versionsFolderTypeId;
      tool.requestObjects('create', createParams, function (createError, createResult) {
        if (createError || !createResult || !createResult.object) {
          logDiagnostics('version-snapshot', 'create error: ' + (createError || 'no object returned'));
          notify('Snapshot failed: ' + (createError || 'no object returned'), 'error');
          return;
        }
        logDiagnostics('version-snapshot', 'created v' + nextNumber + ' id=' + createResult.object.id);
        pruneOldVersions(objectType, toolSlug, function (deletedCount) {
          notify('Code snapshot v' + nextNumber + ' created.' + (deletedCount ? ' Pruned ' + deletedCount + ' old version(s).' : ''), 'success');
          renderVersionsList();
        });
      });
    });
  }
  function pruneOldVersions(objectType, toolSlug, callback) {
    tool.requestObjects('query', { mainObjectType: objectType }, function (queryError, queryResult) {
      if (queryError) { if (callback) callback(0); return; }
      var objects = (queryResult && queryResult.objects) || [];
      var mine = objects.filter(function (cmsObject) { return objectDcb(cmsObject).toolSlug === toolSlug; })
        .sort(function (first, second) {
          return Number(objectDcb(second).versionNumber || 0) - Number(objectDcb(first).versionNumber || 0);
        });
      var toDelete = mine.slice(VERSION_LIMIT);
      if (!toDelete.length) { if (callback) callback(0); return; }
      var deletedCount = 0;
      var remaining = toDelete.length;
      toDelete.forEach(function (cmsObject) {
        tool.requestObjects('delete', { mainObjectType: objectType, objectId: cmsObject.id }, function (deleteError) {
          if (!deleteError) deletedCount++;
          remaining--;
          if (remaining === 0 && callback) callback(deletedCount);
        });
      });
    });
  }
  function renderVersionsList() {
    var listElement = $('htl-versions-list');
    var noteElement = $('htl-versions-note');
    if (!listElement) return;
    if (!objectsApiAvailable()) {
      listElement.innerHTML = '<div class="htl-versions-empty">Object API unavailable - versions cannot be listed here (allowObjectCRUD off).</div>';
      return;
    }
    var objectType = versionsTargetType();
    if (noteElement) noteElement.textContent = 'type: ' + objectType + ' · keep newest ' + VERSION_LIMIT;
    listElement.innerHTML = '<div class="htl-versions-empty">Loading versions…</div>';
    var toolSlug = toolSlugOf();
    tool.requestObjects('query', { mainObjectType: objectType }, function (queryError, queryResult) {
      if (queryError) {
        listElement.innerHTML = '<div class="htl-versions-empty">Query failed: ' + escHtml(queryError) + '</div>';
        return;
      }
      var objects = (queryResult && queryResult.objects) || [];
      var mine = objects.filter(function (cmsObject) { return objectDcb(cmsObject).toolSlug === toolSlug; })
        .sort(function (first, second) {
          return Number(objectDcb(second).versionNumber || 0) - Number(objectDcb(first).versionNumber || 0);
        });
      _versionsCache = mine;
      if (!mine.length) {
        listElement.innerHTML = '<div class="htl-versions-empty">No snapshots yet for "' + escHtml(toolSlug) + '". Push a snapshot to create v1.</div>';
        return;
      }
      listElement.innerHTML = mine.map(function (cmsObject) {
        var dcb = objectDcb(cmsObject);
        return '<div class="htl-version-row">'
          + '<span class="htl-version-num">v' + escHtml(String(dcb.versionNumber)) + '</span>'
          + '<span class="htl-version-meta">' + escHtml(dcb.pushedAt ? formatDateTime(dcb.pushedAt) : (cmsObject.updated || '?'))
          + (dcb.pushedBy ? ' · ' + escHtml(dcb.pushedBy) : '') + '</span>'
          + '<span class="htl-version-actions"><button class="htl-btn htl-btn-ghost htl-btn-sm" data-act="version-load" data-version-id="' + escHtml(cmsObject.id) + '">⤾ Load into editors</button></span>'
          + '</div>';
      }).join('');
    });
  }
  function loadVersionIntoEditors(objectId) {
    var versionObject = null;
    for (var index = 0; index < _versionsCache.length; index++) {
      if (_versionsCache[index].id === objectId) { versionObject = _versionsCache[index]; break; }
    }
    if (!versionObject) { notify('Version not found in the list.', 'warning'); return; }
    var dcb = objectDcb(versionObject);
    var versionLoadSplit = codePartsMode() === 'split';
    CODE_PART_KEYS.forEach(function (part) {
      var loadedCode = String(dcb[part + 'Code'] || '');
      codePartMemory(part).code = loadedCode;
      codePartMemory(part).loaded = true;
      codePartMemory(part).dirty = true;
      if (!versionLoadSplit) DB.draft[toolCodeKeyOf(part)] = loadedCode;
    });
    persist();
    renderCodeEditors();
    syncCodePartsMode();
    logDiagnostics('version-load', 'loaded v' + dcb.versionNumber + ' from ' + objectId);
    notify('Version v' + dcb.versionNumber + ' loaded into the editors.', 'success');
  }

  /* --------------------------------------------------------
     Screenshots (storage upload - URLs only, never bytes)
  -------------------------------------------------------- */
  function uploadScreenshot() {
    if (!canWrite()) { notify('Read-only - uploading is disabled.', 'warning'); return; }
    if (typeof tool.requestUpload !== 'function') {
      notify('Upload API unavailable (allowUpload off).', 'warning');
      return;
    }
    if (_shotsBusy) return;
    _shotsBusy = true;
    tool.requestUpload('image/*', function (uploadError, file) {
      _shotsBusy = false;
      if (uploadError) { notify('Upload failed: ' + uploadError, 'error'); return; }
      if (!file || !file.url) { notify('Upload returned no file URL.', 'error'); return; }
      _shotSequence++;
      DB.draft.shots.push({
        id: 'shot-' + Date.now() + '-' + _shotSequence,
        name: file.name || ('screenshot-' + _shotSequence + '.png'),
        url: file.url,
        size: file.size || 0,
        type: file.type || 'image/png',
        uploadedAt: new Date().toISOString()
      });
      persist();
      renderShots();
      logDiagnostics('shot-upload', file.name + ' -> ' + file.url);
      notify('Screenshot uploaded - URL stored (no bytes in the object).', 'success');
    });
  }
  function shotById(shotId) {
    for (var index = 0; index < DB.draft.shots.length; index++) {
      if (DB.draft.shots[index].id === shotId) return DB.draft.shots[index];
    }
    return null;
  }
  function renderShots() {
    var listElement = $('htl-shots-list');
    var countElement = $('htl-shots-count');
    if (!listElement) return;
    if (countElement) countElement.textContent = DB.draft.shots.length + ' shot(s)';
    if (!DB.draft.shots.length) {
      listElement.innerHTML = '<div class="htl-shot-empty">No screenshots yet. Upload one - only its storage URL is kept.</div>';
      return;
    }
    listElement.innerHTML = DB.draft.shots.map(function (shot) {
      var sizeText = shot.size
        ? (shot.size >= 1048576 ? (shot.size / 1048576).toFixed(2) + ' MB' : Math.max(1, Math.round(shot.size / 1024)) + ' KB')
        : '?';
      return '<div class="htl-shot-row">'
        + '<span class="htl-shot-thumb"><img src="' + escHtml(shot.url) + '" alt="" loading="lazy"></span>'
        + '<span class="htl-shot-info">'
        + '<span class="htl-shot-name">' + escHtml(shot.name) + '</span>'
        + '<span class="htl-shot-meta">' + sizeText + ' · ' + escHtml(shot.uploadedAt ? formatDateTime(shot.uploadedAt) : '') + '</span>'
        + '</span>'
        + '<span class="htl-shot-actions">'
        + '<button class="htl-btn htl-btn-ghost htl-btn-sm" data-act="shot-copy" data-shot-id="' + escHtml(shot.id) + '">⧉ Copy URL</button>'
        + '<button class="htl-btn htl-btn-ghost htl-btn-sm" data-act="shot-insert" data-shot-id="' + escHtml(shot.id) + '">⌖ Insert into doc</button>'
        + '<button class="htl-btn htl-btn-ghost htl-btn-sm" data-act="shot-remove" data-shot-id="' + escHtml(shot.id) + '">✕</button>'
        + '</span></div>';
    }).join('');
  }
  function copyText(text) {
    copyTextWithMessage(text, 'URL copied.');
  }
  function copyTextWithMessage(text, successMessage) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { notify(successMessage, 'success'); }, function () { fallbackCopyWithMessage(text, successMessage); });
        return;
      }
    } catch (error) {}
    fallbackCopyWithMessage(text, successMessage);
  }
  function fallbackCopy(text) {
    fallbackCopyWithMessage(text, 'URL copied.');
  }
  function fallbackCopyWithMessage(text, successMessage) {
    try {
      var tempTextarea = document.createElement('textarea');
      tempTextarea.value = text;
      tempTextarea.style.position = 'fixed';
      tempTextarea.style.opacity = '0';
      document.body.appendChild(tempTextarea);
      tempTextarea.select();
      document.execCommand('copy');
      document.body.removeChild(tempTextarea);
      notify(successMessage, 'success');
    } catch (error) {
      notify('Copy failed - select and copy manually: ' + text, 'warning');
    }
  }
  function insertShotIntoActiveDoc(shotId) {
    var shot = shotById(shotId);
    if (!shot) return;
    var docKey = _activeDocKey;
    var textareaId = docKey === 'social' ? 'htl-doc-social-content' : 'htl-doc-' + docKey + '-html';
    var textarea = $(textareaId);
    if (!textarea) { notify('Open a document first.', 'warning'); return; }
    var snippet = '<img src="' + shot.url + '" alt="' + escHtml(String(shot.name).replace(/\.[^.]+$/, '')) + '" loading="lazy">';
    var start = textarea.selectionStart || 0;
    var end = textarea.selectionEnd || start;
    textarea.value = textarea.value.slice(0, start) + snippet + textarea.value.slice(end);
    var caret = start + snippet.length;
    textarea.selectionStart = textarea.selectionEnd = caret;
    var doc = docMemory(docKey);
    if (docKey === 'social') doc.contentHtml = textarea.value;
    else doc.html = textarea.value;
    doc.dirty = true;
    updateDocEditorMeta(docKey, docKey === 'social' ? 'content' : 'html');
    updateDocGutter(docKey, docKey === 'social' ? 'content' : 'html');
    renderDocStatus(docKey);
    notify('Image inserted into ' + DOC_LABELS[docKey] + '.', 'success');
  }
  function removeShot(shotId) {
    DB.draft.shots = DB.draft.shots.filter(function (shot) { return shot.id !== shotId; });
    persist();
    renderShots();
    notify('Removed from this list - the storage file itself stays in the bucket.', 'info');
  }
  function handleShotsActionClick(event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-act]') : null;
    if (!button) return;
    var action = button.getAttribute('data-act');
    var shotId = button.getAttribute('data-shot-id');
    if (action === 'shot-copy') {
      var shot = shotById(shotId);
      if (shot) copyText(shot.url);
    } else if (action === 'shot-insert') {
      insertShotIntoActiveDoc(shotId);
    } else if (action === 'shot-remove') {
      removeShot(shotId);
    }
  }
  function handleVersionsActionClick(event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-act]') : null;
    if (!button) return;
    if (button.getAttribute('data-act') === 'version-load') {
      loadVersionIntoEditors(button.getAttribute('data-version-id'));
    }
  }

  /* --------------------------------------------------------
     Stored value size meter (1 MB Firestore budget)
  -------------------------------------------------------- */
  function updateSizeMeter() {
    var meterElement = $('htl-size-meter');
    if (!meterElement) return;
    var bytes = 0;
    try { bytes = JSON.stringify(DB).length; } catch (error) { return; }
    var kilobytes = bytes / 1024;
    var label = kilobytes >= 1024 ? (kilobytes / 1024).toFixed(2) + ' MB' : Math.round(kilobytes) + ' KB';
    meterElement.textContent = label;
    meterElement.className = 'htl-size-meter' + (bytes >= 950 * 1024 ? ' danger' : (bytes >= 800 * 1024 ? ' warn' : ''));
    var partsBytes = 0;
    CODE_PART_KEYS.forEach(function (part) { partsBytes += codePartMemory(part).code.length; });
    var modeLabel = codePartsMode() === 'split' ? 'split - code lives in part objects' : 'combined - code lives in this record';
    meterElement.title = bytes + ' bytes in the stored value (code + metadata) - ' + modeLabel + ' - code parts: ' + Math.round(partsBytes / 1024) + ' KB';
    renderCodeModeBadge();
    renderCodeSizes();
  }

  /* --------------------------------------------------------
     Event wiring (bound once; reads DB directly)
  -------------------------------------------------------- */
  function wireEvents() {
    var tabButtons = document.querySelectorAll('.htl-tab');
    for (var tabIndex = 0; tabIndex < tabButtons.length; tabIndex++) {
      (function (tabButton) {
        tabButton.addEventListener('click', function () { switchTab(tabButton.getAttribute('data-tab')); });
      })(tabButtons[tabIndex]);
    }

    FIELD_DEFINITIONS.forEach(function (definition) {
      if (definition.type === 'code') return;
      var inputElement = $('htl-f-' + definition.key);
      if (!inputElement) return;
      inputElement.addEventListener('input', function () {
        DB.draft[definition.key] = inputElement.value;
        persist();
        if (definition.required) reportValidation();
        if (definition.type === 'json') refreshJsonFieldValidity(definition.key);
      });
    });

    CODE_KEYS.forEach(bindCodeEditor);

    on('htl-btn-rebuild', 'click', renderPreview);
    on('htl-category-search', 'input', debounce(renderCategories, 150));
    on('htl-tags-input', 'keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ',') return;
      event.preventDefault();
      var tagsInput = $('htl-tags-input');
      addTag(tagsInput ? tagsInput.value : '');
      if (tagsInput) tagsInput.value = '';
    });
    on('htl-tags-input', 'blur', function () {
      var tagsInput = $('htl-tags-input');
      if (tagsInput && tagsInput.value.trim()) {
        addTag(tagsInput.value);
        tagsInput.value = '';
      }
    });
    on('htl-doc-tabs', 'click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-doc-tab]') : null;
      if (!button) return;
      _activeDocKey = button.getAttribute('data-doc-tab');
      ensureDocsStructure();
    });
    on('htl-doc-content', 'input', handleDocInput);
    on('htl-doc-content', 'click', handleDocActionClick);
    on('htl-doc-content', 'click', handleDocPartClick);
    SCHEMA_FIELDS.forEach(function (fieldKey) {
      on(SCHEMA_CONTAINER_IDS[fieldKey], 'click', function (event) {
        var tabButton = event.target && event.target.closest ? event.target.closest('[data-schema-tab]') : null;
        if (tabButton) setSchemaTab(fieldKey, tabButton.getAttribute('data-schema-part'));
      });
      on('htl-schema-rows-' + fieldKey, 'input', function (event) { handleSchemaRowsInput(fieldKey, event); });
      on('htl-schema-rows-' + fieldKey, 'click', function (event) { handleSchemaRowsClick(fieldKey, event); });
      on('htl-schema-add-' + fieldKey, 'click', function () { addSchemaRow(fieldKey); });
    });
    on('htl-shots-upload', 'click', uploadScreenshot);
    on('htl-shots-list', 'click', handleShotsActionClick);
    on('htl-versions-snapshot', 'click', snapshotCodeVersion);
    on('htl-versions-refresh', 'click', renderVersionsList);
    on('htl-versions-list', 'click', handleVersionsActionClick);
    on('htl-documents-refresh', 'click', renderDevDocuments);
    on('htl-dev-docs-list', 'click', handleDevDocumentCopy);
    on('htl-dev-docs-list', 'click', handleObjectLinkClick);
    on('htl-object-links', 'click', handleObjectLinkClick);
    on('htl-code-link-html', 'click', handleObjectLinkClick);
    on('htl-code-link-css', 'click', handleObjectLinkClick);
    on('htl-code-link-js', 'click', handleObjectLinkClick);
  }

  function bindCodeEditor(codeKey) {
    var textarea = $('htl-code-' + codeKey);
    if (!textarea) return;
    function onCodeChanged() {
      var part = codePartKeyOf(codeKey);
      var memory = codePartMemory(part);
      memory.code = textarea.value;
      memory.dirty = true;
      // While the code is split, only the part objects hold it - never write it back into this record.
      if (codePartsMode() !== 'split') DB.draft[codeKey] = textarea.value;
      updateCodeMeta(codeKey);
      persist();
      updateGutter(codeKey);
      scheduleCodeModeSync();
    }
    textarea.addEventListener('input', onCodeChanged);
    textarea.addEventListener('paste', function () {
      setTimeout(function () { syncGutterToEditor(codeKey); }, 0);
    });
    textarea.addEventListener('blur', function () {
      clearTimeout(_codeModeTimer);
      syncCodePartsMode();
    });
    textarea.addEventListener('scroll', function () {
      syncGutterToEditor(codeKey);
    });
    textarea.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      var selectionStart = textarea.selectionStart;
      var selectionEnd = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, selectionStart) + '  ' + textarea.value.substring(selectionEnd);
      textarea.selectionStart = textarea.selectionEnd = selectionStart + 2;
      onCodeChanged();
    });
  }

  /* --------------------------------------------------------
     Entry point
  -------------------------------------------------------- */
  function readParam(paramName, defaultValue) {
    try { return tool.param(paramName, defaultValue); } catch (error) { return defaultValue; }
  }

  tool.onReady(function (value, readyFields) {
    logDiagnostics('ready', 'tool API keys: ' + Object.keys(tool || {}).join(', '));
    logDiagnostics('ready-value', JSON.stringify(value).slice(0, 300));
    _ownRecordName = String((readyFields && readyFields.name) || '');
    var ownFields = null;
    try { ownFields = tool.getFields ? tool.getFields() : null; } catch (error) {}
    var readyRecordId = readyFields && (readyFields.id || readyFields._id || readyFields.objectId || readyFields.recordId);
    var fieldRecordId = ownFields && (ownFields.id || ownFields._id || ownFields.objectId || ownFields.recordId);
    _ownRecordId = String(readyRecordId || fieldRecordId || '');
    var readyObjectType = readyFields && (readyFields.cmsObjectType || readyFields.objectType);
    var fieldObjectType = ownFields && (ownFields.cmsObjectType || ownFields.objectType);
    _ownObjectType = String(readyObjectType || fieldObjectType || '');
    var readySource = readyFields && (readyFields.source || readyFields.collection || readyFields._source);
    var fieldSource = ownFields && (ownFields.source || ownFields.collection || ownFields._source);
    var sourceValue = String(readySource || fieldSource || '');
    _ownSource = /^om_(private_)?objects$/.test(sourceValue) ? sourceValue : '';
    var ownTypeIdSource = (readyFields && readyFields.typeId) ? readyFields.typeId : '';
    if (!ownTypeIdSource && ownFields && ownFields.typeId) ownTypeIdSource = ownFields.typeId;
    _ownTypeId = String(ownTypeIdSource || '');
    logDiagnostics('ready-folder', 'leaf folder (typeId): ' + (_ownTypeId || '(none)'));
    logDiagnostics('ready-record', 'record id: ' + (_ownRecordId || '(none)') + ' · type: ' + (_ownObjectType || '(none)'));
    try {
      tool.declareOutput({
        type: 'object',
        description: 'Definition of one CMS html-tool: details plus the HTML/CSS/JS code blocks, saved back to the matching fields of this record.',
        properties: {
          toolName: { type: 'string' }, toolIcon: { type: 'string' }, toolStatus: { type: 'string' },
          toolDescription: { type: 'string' },
          toolHtmlCode: { type: 'string' }, toolCssCode: { type: 'string' }, toolJsCode: { type: 'string' },
          toolDisplayMode: { type: 'string' }, toolHeight: { type: 'string' }, toolAutoHeight: { type: 'string' },
          toolParams: { type: 'string' }, toolOutputSchema: { type: 'string' }, toolValidationEnabled: { type: 'string' },
          toolCategories: { type: 'array' }, toolTags: { type: 'array' },
          docs: { type: 'object', description: 'Per-document target references only - document content lives in separate CMS objects.' },
          codeParts: { type: 'object', description: 'Per-part object references (html/css/js) - the code itself lives in tool-code-parts-applicationstore objects.' },
          shots: { type: 'array', description: 'Screenshot metadata - storage URLs only, never file bytes.' }
        }
      });
      tool.declareParams([
        {
          name: 'previewMockValue', label: 'Preview Mock Value', type: 'text', default: '{}', severity: 'goodToHave',
          hint: 'JSON value returned by the mock tool.getValue() in the Preview tab, e.g. {"config":{}}.'
        },
        {
          name: 'previewMockParams', label: 'Preview Mock Params', type: 'text', default: '{}', severity: 'goodToHave',
          hint: 'JSON map returned by the mock tool.param() in the Preview tab, e.g. {"currency":"USD"}.'
        },
        {
          name: 'categoryList', label: 'Category List', type: 'text', default: '', severity: 'goodToHave',
          hint: 'Optional JSON array replacing the built-in category taxonomy. Entries: "Label" or {"code":"B-G-01","label":"AI & Automation","group":"Business · General"}.'
        },
        {
          name: 'pageTargetType', label: 'Page Target Object Type', type: 'text', default: DEFAULT_PAGE_TARGET_TYPE, severity: 'goodToHave',
          hint: 'Object type of the website pages - website-builder-uniconbaseapps, one WebpageBuilder page per object. Used by webpage, help, updates and presentation.'
        },
        {
          name: 'socialTargetType', label: 'Social Target Object Type', type: 'text', default: DEFAULT_SOCIAL_TARGET_TYPE, severity: 'goodToHave',
          hint: 'Object type of the social content objects.'
        },
        {
          name: 'versionsTargetType', label: 'Versions Target Object Type', type: 'text', default: DEFAULT_VERSIONS_TARGET_TYPE, severity: 'goodToHave',
          hint: 'CMS object type holding code snapshots - one object per push, newest 20 kept per tool.'
        },
        {
          name: 'codePartsTargetType', label: 'Code Parts Target Object Type', type: 'text', default: DEFAULT_CODE_PARTS_TARGET_TYPE, severity: 'goodToHave',
          hint: 'Object type holding the code parts (html/css/js) - one object per part, split into numbered chunk objects above codeChunkKb. Default: tool-code-parts-applicationstore (Application Store namespace). It must be listed in the field allowedObjectTypes.'
        },
        {
          name: 'codeChunkKb', label: 'Code Chunk Size (KB)', type: 'text', default: String(DEFAULT_CODE_CHUNK_KB), severity: 'goodToHave',
          hint: 'Maximum code per part object (UTF-8 bytes). A part above this size is split into numbered chunks (chunkIndex/chunkCount) in the same object type. Default 800 KB, safely under the 1 MB document limit.'
        },
        {
          name: 'cmsAdminBaseUrl', label: 'CMS Admin Base URL', type: 'text', default: DEFAULT_CMS_ADMIN_BASE_URL, severity: 'goodToHave',
          hint: 'CMS host tried for /__/firebase/init.json when auto-detecting the Firestore project id. Default: https://applicationstore.uniconhub.com.'
        },
        {
          name: 'firestoreProjectId', label: 'Firestore Project ID', type: 'text', default: '', severity: 'goodToHave',
          hint: 'Firebase project id used to build DIRECT Firestore document links in DB Docs and on the fire icons: console.firebase.google.com/project/<id>/firestore/databases/<db>/data/~2F<collection>~2F<docId>. When empty, the tool auto-detects it from a screenshot storage URL, the record shell, or /__/firebase/init.json.'
        },
        {
          name: 'firestoreDatabaseId', label: 'Firestore Database ID', type: 'text', default: '-default-', severity: 'goodToHave',
          hint: 'Database id used in direct Firestore links. The Firebase default database id is -default-.'
        },
        {
          name: 'firestoreDefaultCollection', label: 'Firestore Default Collection', type: 'text', default: DEFAULT_FIRESTORE_COLLECTION, severity: 'goodToHave',
          hint: 'Collection used when an object type has no entry in Firestore Collection Map. Default: om_objects.'
        },
        {
          name: 'firestoreCollectionMap', label: 'Firestore Collection Map', type: 'text', default: JSON.stringify(DEFAULT_FIRESTORE_COLLECTION_MAP), severity: 'goodToHave',
          hint: 'JSON map of CMS object type -> Firestore collection, e.g. {"tool-code-parts-applicationstore":"om_private_objects"}. Types not listed use the default collection or the record source.'
        },
        {
          name: 'versionSnapshotMaxKb', label: 'Version Snapshot Max (KB)', type: 'text', default: String(DEFAULT_VERSION_SNAPSHOT_MAX_KB), severity: 'goodToHave',
          hint: 'A version object stores HTML + CSS + JS in one document. Snapshots above this size are skipped with a warning until chunked snapshots exist.'
        },
        {
          name: 'codeSplitThresholdKb', label: 'Code Split Threshold (KB)', type: 'text', default: '500', severity: 'goodToHave',
          hint: 'Above this total code size (html+css+js combined) the code splits into per-part objects, each with its own 1 MB budget. Below 80% of this value it merges back into the record. The record itself keeps only refs while split.'
        },
        {
          name: 'docsFolderTypeMap', label: 'Docs Folder Type Map', type: 'text', default: JSON.stringify(DEFAULT_DOCS_FOLDER_TYPE_MAP), severity: 'goodToHave',
          hint: 'JSON map: document key -> leaf folder (typeId) inside the TARGET application where that document is created. Keys: webpage, help, updates, presentation, social, versions. Empty per key = app default folder. Default: webpage/updates/presentation -> www.uniconhub.com, help -> help.uniconhub.com.'
        },
        {
          name: 'docsFolderTypeId', label: 'Docs Folder ID Override', type: 'text', default: '', severity: 'goodToHave',
          hint: 'Optional single leaf folder (typeId) used for every document key that has no entry in docsFolderTypeMap.'
        },
        {
          name: 'pageTargetFieldMap', label: 'Page Target Field Map', type: 'text', default: '', severity: 'goodToHave',
          hint: 'JSON override for the page object field ids, e.g. {"htmlPage":"htmlPage","seo":"seo","slug":"slug","name":"name","meta":"meta","status":"status"}.'
        },
        {
          name: 'socialTargetFieldMap', label: 'Social Target Field Map', type: 'text', default: '', severity: 'goodToHave',
          hint: 'JSON override for the social object field ids, e.g. {"name":"name","slug":"slug","contentHtml":"contentHtml","updatedAt":"updatedAt"}.'
        },
        {
          name: 'pageStatus', label: 'Page Status', type: 'text', default: '', severity: 'goodToHave',
          hint: 'Optional. Leave empty so the CMS Publish action owns the page status - set to draft or published only to override it.'
        },
        {
          name: 'docLanguage', label: 'Document Language', type: 'text', default: 'en', severity: 'goodToHave',
          hint: 'meta.language written to page objects.'
        }
      ]);
    } catch (error) {}

    _previewMockValue = parseJsonLenient(readParam('previewMockValue', '{}')) || {};
    _previewMockParams = parseJsonLenient(readParam('previewMockParams', '{}')) || {};

    migrateLegacyDocContent(value);
    DB = normalize(value);
    initCodePartsMemory();
    _readOnly = !!tool.isReadOnly();
    wireEvents();
    renderAll();
    lockUI();
    refreshUser();
    reportValidation();
    detectFirestoreProjectId([readyFields, ownFields]);

    tool.onValueChange(function (newValue) {
      if (_saving) return;
      var incomingDraft = normalize(newValue).draft;
      if (JSON.stringify(incomingDraft) === JSON.stringify(DB.draft)) return;
      DB = normalize(newValue);
      renderAll();
    });
    tool.onReadonlyChange(function (readOnlyFlag) {
      _readOnly = !!readOnlyFlag;
      lockUI();
    });
    tool.onUserChange(function (user) {
      _user = user || getUserSafe();
      renderUser();
      lockUI();
      renderAccessLinks();
      logRolesChange();
    });
  });
})();
