/* js build 2026-11-17-2 */
/* ============================================================
   Application Store Item - UniconHub CMS html-tool
   Manages ONE application record of the application store:
   identity, releases (multi-file), documents, screenshots,
   store-listing preview and legacy field migration.
   Entry point: tool.onReady
   ============================================================ */
(function () {
  'use strict';

  var TOOL_BUILD = '2026-11-17-2';
  try { console.log('[TOOL:BOOT] build ' + TOOL_BUILD + ' ApplicationStoreItem'); } catch (error) {}

  /* --------------------------------------------------------
     Constants
  -------------------------------------------------------- */
  var APP_CATEGORIES = [
    { id: 'general-business', label: 'General Business' },
    { id: 'general-personal', label: 'General Personal' },
    { id: 'system', label: 'System' },
    { id: 'vertical-business', label: 'Vertical Business' },
    { id: 'other', label: 'Other' }
  ];

  var LANGUAGE_OPTIONS = [
    { id: 'en', label: 'English' },
    { id: 'es', label: 'Spanish' },
    { id: 'fr', label: 'French' },
    { id: 'pt', label: 'Portuguese' },
    { id: 'tr', label: 'Turkish' },
    { id: 'de', label: 'German' },
    { id: 'it', label: 'Italian' },
    { id: 'nl', label: 'Dutch' },
    { id: 'ar', label: 'Arabic' },
    { id: 'ur', label: 'Urdu' },
    { id: 'hi', label: 'Hindi' },
    { id: 'zh', label: 'Chinese' },
    { id: 'ru', label: 'Russian' }
  ];

  var LICENSE_TYPES = ['free', 'freemium', 'paid', 'internal'];
  var APP_STATUSES = ['draft', 'active', 'archived'];
  var TAG_SUGGESTIONS = [
    'automation', 'reporting', 'analytics', 'scheduling', 'calendar', 'crm',
    'inventory', 'invoicing', 'documents', 'forms', 'education', 'healthcare',
    'restaurant', 'nonprofit', 'compliance', 'ai', 'chat', 'storage',
    'productivity', 'finance'
  ];

  var DEFAULT_RELEASE_FILE_ACCEPT = '.zip,.json,.html,.htm,.js,.css,.map,.md,.txt,.png,.jpg,.jpeg,.svg,.webp,.pdf';
  var TAG_LIMIT = 20;
  var SHOTS_LIMIT = 50;
  var DOC_KEYS = ['webpage', 'help', 'updates', 'presentation', 'social'];
  var DOC_LABELS = { webpage: 'Webpage', help: 'Help', updates: 'Updates', presentation: 'Presentation', social: 'Social' };
  var FRAGMENT_DOCS = ['webpage', 'help', 'updates', 'presentation'];
  var SEO_FIELDS = ['metaTitle', 'metaDesc', 'metaKeywords', 'metaRobots', 'ogTitle', 'ogDesc', 'ogImage'];
  var SEO_LABELS = {
    metaTitle: 'Meta title', metaDesc: 'Meta description', metaKeywords: 'Meta keywords',
    metaRobots: 'Meta robots', ogTitle: 'OG title', ogDesc: 'OG description', ogImage: 'OG image URL'
  };
  var DEFAULT_PAGE_TARGET_TYPE = 'website-builder-uniconbaseapps';
  var DEFAULT_SOCIAL_TARGET_TYPE = 'tool-social-content-uniconbaseapps';
  var DEFAULT_DOCS_FOLDER_TYPE_MAP = {
    webpage: 'www.uniconhub.com',
    updates: 'www.uniconhub.com',
    presentation: 'www.uniconhub.com',
    help: 'help.uniconhub.com'
  };
  var DEFAULT_DEVELOPER_TYPE = 'developers-applicationstore';
  var LEGACY_FIELD_IDS = ['appName', 'appShortDescription', 'developer', 'appCategory', 'languages', 'website', 'applicationVersions'];
  var DIAGNOSTICS_LINE_LIMIT = 80;
  var ACTIVITY_LINE_LIMIT = 40;

  /* --------------------------------------------------------
     State
  -------------------------------------------------------- */
  var DB = null;
  var _readyFields = null;
  var _ownTypeId = '';
  var _ownRecordName = '';
  var _user = null;
  var _noIdentity = false;
  var _readOnly = false;
  var _saving = false;
  var _savingResetTimer = null;
  var _polled = false;
  var _activeTab = 'details';
  var _previewBuilt = false;
  var _activePreviewView = 'listing';
  var _previewTimer = null;
  var _gutterTimers = {};
  var _diagnosticsLines = [];
  var _activityLines = [];
  var _activeDocKey = 'webpage';
  var _docsMemory = {};
  var _docLoadBusy = {};
  var _docPushArmed = {};
  var _docPushArmTimers = {};
  var _docReloadArmed = {};
  var _docReloadArmTimers = {};
  var _docGutterTimers = {};
  var _activeDocPart = {};
  var _developerOptions = [];
  var _developerLoadToken = 0;
  var _releaseDraft = null;
  var _releaseDeleteArmed = {};
  var _releaseDeleteArmTimers = {};
  var _shotsBusy = false;
  var _shotSequence = 0;
  var _shotCaptionTimer = null;
  var _sizeMeterTimer = null;
  var _legacyImportArmed = false;
  var _legacyImportArmTimer = null;

  /* --------------------------------------------------------
     Small helpers
  -------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }
  function on(id, eventName, handler) {
    var element = $(id);
    if (element) element.addEventListener(eventName, handler);
    return element;
  }
  function escHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function padTwo(value) { return value < 10 ? '0' + value : String(value); }
  function todayIso() {
    var now = new Date();
    return now.getFullYear() + '-' + padTwo(now.getMonth() + 1) + '-' + padTwo(now.getDate());
  }
  function timestampNow() { return new Date().toISOString(); }
  function formatDateTime(isoValue) {
    var parsedDate = new Date(isoValue);
    if (isNaN(parsedDate.getTime())) return String(isoValue || '');
    return parsedDate.toLocaleString();
  }
  function formatTime(dateValue) { return dateValue.toLocaleTimeString(); }
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
  function readParam(paramName, defaultValue) {
    try { return tool.param(paramName, defaultValue); } catch (error) { return defaultValue; }
  }
  function uniqueId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function fileNameFromUrl(url) {
    var text = String(url || '').split('?')[0].split('#')[0];
    var pieces = text.split('/');
    var name = pieces[pieces.length - 1] || 'file';
    try { return decodeURIComponent(name); } catch (error) { return name; }
  }
  function isAcceptableUrl(url) {
    var text = String(url || '').trim();
    if (!text) return false;
    if (/^https?:\/\//i.test(text)) return true;
    if (text.charAt(0) === '/') return true;
    if (/^mock:\/\//i.test(text)) return true;
    return false;
  }
  function normalizeDateOnly(value) {
    if (!value) return '';
    if (typeof value === 'number') {
      var numericDate = new Date(value);
      return isNaN(numericDate.getTime()) ? '' : numericDate.toISOString().slice(0, 10);
    }
    var text = String(value).trim();
    if (!text) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    var parsed = new Date(text);
    return isNaN(parsed.getTime()) ? text.slice(0, 10) : parsed.toISOString().slice(0, 10);
  }
  function formatKb(kilobytes) {
    var value = Number(kilobytes || 0);
    if (!value) return '0 KB';
    if (value >= 1024) return (value / 1024).toFixed(2) + ' MB';
    return Math.round(value) + ' KB';
  }
  function fileSizeLabel(file) {
    var bytes = Number(file && file.size || 0);
    if (!bytes) return 'size not recorded';
    return formatKb(bytes / 1024);
  }
  function versionParts(text) {
    return String(text || '').split(/[^0-9]+/).filter(Boolean).map(function (part) { return parseInt(part, 10) || 0; });
  }
  function compareVersionText(firstText, secondText) {
    var firstParts = versionParts(firstText);
    var secondParts = versionParts(secondText);
    var length = Math.max(firstParts.length, secondParts.length);
    for (var index = 0; index < length; index++) {
      var firstValue = firstParts[index] || 0;
      var secondValue = secondParts[index] || 0;
      if (firstValue !== secondValue) return firstValue - secondValue;
    }
    return 0;
  }

  function notify(message, severity) {
    try { if (tool.notify) tool.notify(message, severity || 'info'); } catch (error) {}
  }
  function logDiagnostics(label, detail) {
    var line = formatTime(new Date()) + ' [' + label + '] ' + String(detail);
    _diagnosticsLines.push(line);
    if (_diagnosticsLines.length > DIAGNOSTICS_LINE_LIMIT) _diagnosticsLines.shift();
    try { if (typeof console !== 'undefined' && console.log) console.log('[ApplicationStoreItem] ' + line); } catch (error) {}
    var logElement = $('asi-debug-log');
    if (logElement) logElement.textContent = _diagnosticsLines.join('\n');
  }
  function logActivity(label, detail) {
    var line = formatTime(new Date()) + '  ' + label + (detail ? ' - ' + detail : '');
    _activityLines.push(line);
    if (_activityLines.length > ACTIVITY_LINE_LIMIT) _activityLines.shift();
    renderActivityLog();
  }
  function renderActivityLog() {
    var listElement = $('asi-activity-list');
    if (!listElement) return;
    if (!_activityLines.length) {
      listElement.innerHTML = '<div class="asi-shot-empty">No activity yet.</div>';
      return;
    }
    listElement.innerHTML = _activityLines.slice().reverse().map(function (line) {
      return '<div class="asi-activity-row">' + escHtml(line) + '</div>';
    }).join('');
  }

  /* --------------------------------------------------------
     Defaults and normalization
  -------------------------------------------------------- */
  function defaultApp() {
    return {
      appName: '',
      appIconUrl: '',
      appShortDescription: '',
      appDescription: '',
      developerId: '',
      developerName: '',
      appCategory: 'general-business',
      languages: ['en'],
      tags: [],
      website: '',
      supportUrl: '',
      privacyUrl: '',
      licenseType: 'free',
      featured: 'no',
      appStatus: 'draft',
      legacyImportedAt: ''
    };
  }
  function defaultSeo() {
    var seo = {};
    SEO_FIELDS.forEach(function (seoField) { seo[seoField] = ''; });
    return seo;
  }
  function defaultDocs() {
    var docs = {};
    DOC_KEYS.forEach(function (docKey) { docs[docKey] = { target: null }; });
    return docs;
  }
  function defaultDB() {
    return {
      version: 2,
      app: defaultApp(),
      versions: [],
      docs: defaultDocs(),
      shots: [],
      tools: [],
      toolsMeta: defaultToolsMeta(),
      meta: { createdAt: timestampNow(), updatedAt: timestampNow() }
    };
  }
  function normalizeText(value, maxLength) {
    var text = String(value == null ? '' : value).trim();
    return maxLength ? text.slice(0, maxLength) : text;
  }
  function languageCodeOf(value) {
    var text = String(value == null ? '' : value).trim();
    if (!text) return '';
    var lower = text.toLowerCase();
    for (var index = 0; index < LANGUAGE_OPTIONS.length; index++) {
      if (LANGUAGE_OPTIONS[index].id === lower || LANGUAGE_OPTIONS[index].label.toLowerCase() === lower) {
        return LANGUAGE_OPTIONS[index].id;
      }
    }
    return lower.replace(/[^a-z0-9-]/g, '').slice(0, 12);
  }
  function normalizeLanguageList(rawValue) {
    var codes = [];
    if (Array.isArray(rawValue)) {
      rawValue.forEach(function (entry) {
        if (entry == null) return;
        if (typeof entry === 'string') {
          var directCode = languageCodeOf(entry);
          if (directCode) codes.push(directCode);
          return;
        }
        if (typeof entry === 'object') {
          var objectCode = entry._id || entry.id || entry.value || entry.code || entry.name || '';
          var mappedCode = languageCodeOf(objectCode);
          if (mappedCode) codes.push(mappedCode);
        }
      });
    } else if (typeof rawValue === 'string' && rawValue.trim()) {
      rawValue.split(',').forEach(function (piece) {
        var pieceCode = languageCodeOf(piece);
        if (pieceCode) codes.push(pieceCode);
      });
    }
    return codes.filter(function (code, index) { return codes.indexOf(code) === index; });
  }
  function normalizeTagList(rawValue) {
    var tags = [];
    var pieces = Array.isArray(rawValue) ? rawValue : String(rawValue || '').split(',');
    pieces.forEach(function (piece) {
      var tag = String(piece == null ? '' : piece).trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 24);
      if (!tag) return;
      if (tags.indexOf(tag) !== -1) return;
      if (tags.length >= TAG_LIMIT) return;
      tags.push(tag);
    });
    return tags;
  }
  function normalizeDeveloper(rawValue) {
    if (!rawValue) return { id: '', name: '' };
    if (Array.isArray(rawValue)) return normalizeDeveloper(rawValue[0]);
    if (typeof rawValue === 'string') return { id: rawValue.trim(), name: '' };
    if (typeof rawValue === 'object') {
      var id = rawValue.objectId || rawValue._id || rawValue.id || rawValue.value || rawValue.code || '';
      var name = rawValue.name || rawValue.label || rawValue.title || '';
      return { id: String(id || name || '').trim(), name: String(name || '').trim() };
    }
    return { id: '', name: '' };
  }
  function validCategoryId(rawValue) {
    var text = String(rawValue == null ? '' : rawValue).trim();
    for (var index = 0; index < APP_CATEGORIES.length; index++) {
      if (APP_CATEGORIES[index].id === text || APP_CATEGORIES[index].label.toLowerCase() === text.toLowerCase()) {
        return APP_CATEGORIES[index].id;
      }
    }
    return APP_CATEGORIES[0].id;
  }
  function normalizeApp(rawValue) {
    var app = defaultApp();
    if (!rawValue || typeof rawValue !== 'object') return app;
    app.appName = normalizeText(rawValue.appName, 120);
    app.appIconUrl = normalizeText(rawValue.appIconUrl, 1000);
    app.appShortDescription = normalizeText(rawValue.appShortDescription, 200);
    app.appDescription = String(rawValue.appDescription == null ? '' : rawValue.appDescription).trim();
    app.appCategory = validCategoryId(rawValue.appCategory);
    app.languages = normalizeLanguageList(rawValue.languages);
    if (!app.languages.length) app.languages = ['en'];
    app.tags = normalizeTagList(rawValue.tags);
    app.website = normalizeText(rawValue.website, 1000);
    app.supportUrl = normalizeText(rawValue.supportUrl, 1000);
    app.privacyUrl = normalizeText(rawValue.privacyUrl, 1000);
    app.licenseType = LICENSE_TYPES.indexOf(rawValue.licenseType) !== -1 ? rawValue.licenseType : 'free';
    app.featured = rawValue.featured === 'yes' ? 'yes' : 'no';
    app.appStatus = APP_STATUSES.indexOf(rawValue.appStatus) !== -1 ? rawValue.appStatus : 'draft';
    app.legacyImportedAt = normalizeText(rawValue.legacyImportedAt, 40);
    var developer = normalizeDeveloper(rawValue.developer);
    app.developerId = normalizeText(rawValue.developerId || developer.id, 200);
    app.developerName = normalizeText(rawValue.developerName || developer.name, 120);
    return app;
  }
  function normalizeFiles(rawVersion) {
    var rawFiles = rawVersion && rawVersion.files;
    if (!Array.isArray(rawFiles) && rawVersion && rawVersion.fileUrl !== undefined) rawFiles = rawVersion.fileUrl;
    if (!Array.isArray(rawFiles) && rawVersion && rawVersion.fileUrls !== undefined) rawFiles = rawVersion.fileUrls;
    if (!Array.isArray(rawFiles)) rawFiles = rawFiles ? [rawFiles] : [];
    var files = [];
    rawFiles.forEach(function (entry) {
      if (!entry) return;
      if (typeof entry === 'string') {
        if (!entry.trim()) return;
        files.push({ name: fileNameFromUrl(entry), url: entry.trim(), size: 0, type: '' });
        return;
      }
      if (typeof entry !== 'object') return;
      var url = entry.url || entry.downloadUrl || entry.href || '';
      if (!url) return;
      files.push({
        name: normalizeText(entry.name || entry.fileName || fileNameFromUrl(url), 200),
        url: String(url).trim(),
        size: Number(entry.size || entry.sizeBytes || 0) || 0,
        type: normalizeText(entry.type || entry.mimeType, 120)
      });
    });
    return files;
  }
  function normalizeVersion(rawValue, fallbackIndex) {
    var raw = (rawValue && typeof rawValue === 'object') ? rawValue : { fileUrl: rawValue };
    var release = {
      id: normalizeText(raw.id, 80) || ('rel-' + fallbackIndex),
      versionNumber: normalizeText(raw.versionNumber || raw.version, 40),
      releaseDate: normalizeDateOnly(raw.releaseDate || raw.date),
      languages: normalizeLanguageList(raw.languages),
      iconUrl: normalizeText(raw.iconUrl, 1000),
      releaseNotes: String(raw.releaseNotes == null ? '' : raw.releaseNotes).trim(),
      isEnabled: (raw.isEnabled === 'no' || raw.isEnabled === false || raw.isEnabled === 'false') ? 'no' : 'yes',
      files: normalizeFiles(raw),
      sizeInKb: Number(raw.sizeInKb || 0) || 0,
      createdAt: normalizeText(raw.createdAt, 40),
      updatedAt: normalizeText(raw.updatedAt, 40)
    };
    return release;
  }
  function normalizeDocTarget(target) {
    if (!target || typeof target !== 'object') return null;
    if (typeof target.objectType !== 'string' || !target.objectType) return null;
    if (typeof target.objectId !== 'string' || !target.objectId) return null;
    return {
      objectType: target.objectType,
      objectId: target.objectId,
      name: typeof target.name === 'string' ? target.name : '',
      slug: typeof target.slug === 'string' ? target.slug : '',
      folderTypeId: typeof target.folderTypeId === 'string' ? target.folderTypeId : '',
      pushedAt: typeof target.pushedAt === 'string' ? target.pushedAt : '',
      pushedSignature: typeof target.pushedSignature === 'string' ? target.pushedSignature : ''
    };
  }
  function normalizeShots(rawValue) {
    if (!Array.isArray(rawValue)) return [];
    return rawValue.filter(function (shot) {
      return shot && typeof shot === 'object' && typeof shot.url === 'string' && shot.url;
    }).map(function (shot, index) {
      return {
        id: normalizeText(shot.id, 80) || ('shot-' + index),
        name: normalizeText(shot.name || fileNameFromUrl(shot.url), 200),
        url: String(shot.url).trim(),
        size: Number(shot.size || 0) || 0,
        type: normalizeText(shot.type, 120),
        caption: normalizeText(shot.caption, 160),
        uploadedAt: normalizeText(shot.uploadedAt, 40)
      };
    }).slice(0, SHOTS_LIMIT);
  }
  function normalize(value) {
    var normalized = defaultDB();
    if (!value || typeof value !== 'object') return normalized;
    normalized.version = typeof value.version === 'number' ? Math.max(2, value.version) : 2;
    normalized.app = normalizeApp(value.app);
    if (Array.isArray(value.versions)) {
      normalized.versions = value.versions
        .filter(function (release) { return release && typeof release === 'object'; })
        .map(function (release, index) { return normalizeVersion(release, index + 1); });
    }
    if (value.docs && typeof value.docs === 'object') {
      DOC_KEYS.forEach(function (docKey) {
        var savedDoc = value.docs[docKey];
        if (savedDoc && typeof savedDoc === 'object') {
          normalized.docs[docKey].target = normalizeDocTarget(savedDoc.target);
        }
      });
    }
    normalized.shots = normalizeShots(value.shots);
    normalized.tools = normalizeTools(value.tools);
    if (value.toolsMeta && typeof value.toolsMeta === 'object') {
      normalized.toolsMeta.catalogVersion = normalizeText(value.toolsMeta.catalogVersion, 40);
      normalized.toolsMeta.catalogCount = Number(value.toolsMeta.catalogCount || 0) || 0;
      normalized.toolsMeta.source = normalizeText(value.toolsMeta.source, 80);
      normalized.toolsMeta.loadedAt = normalizeText(value.toolsMeta.loadedAt, 40);
      normalized.toolsMeta.updatedAt = normalizeText(value.toolsMeta.updatedAt, 40);
    }
    if (value.meta && typeof value.meta === 'object') {
      normalized.meta.createdAt = normalizeText(value.meta.createdAt, 40) || normalized.meta.createdAt;
      normalized.meta.updatedAt = normalizeText(value.meta.updatedAt, 40) || normalized.meta.updatedAt;
    }
    return normalized;
  }

  /* --------------------------------------------------------
     Legacy field migration
  -------------------------------------------------------- */
  function extractFieldValues(source) {
    var values = {};
    if (!source || typeof source !== 'object') return values;
    Object.keys(source).forEach(function (key) {
      if (key === 'objectData' || key === 'productData') return;
      values[key] = source[key];
    });
    if (source.objectData && source.objectData.data_categoriesBased && typeof source.objectData.data_categoriesBased === 'object') {
      Object.keys(source.objectData.data_categoriesBased).forEach(function (key) {
        values[key] = source.objectData.data_categoriesBased[key];
      });
    }
    if (source.productData && source.productData.data_categoriesBased && typeof source.productData.data_categoriesBased === 'object') {
      Object.keys(source.productData.data_categoriesBased).forEach(function (key) {
        values[key] = source.productData.data_categoriesBased[key];
      });
    }
    return values;
  }
  function legacyValuesSnapshot() {
    var merged = {};
    var fromReady = extractFieldValues(_readyFields);
    var fromLive = {};
    try { fromLive = extractFieldValues(tool.getFields ? tool.getFields() : null); } catch (error) {}
    Object.keys(fromReady).forEach(function (key) { merged[key] = fromReady[key]; });
    Object.keys(fromLive).forEach(function (key) { merged[key] = fromLive[key]; });
    return merged;
  }
  function hasValue(value) {
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim() !== '';
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  }
  function hasLegacyData(values) {
    for (var index = 0; index < LEGACY_FIELD_IDS.length; index++) {
      if (hasValue(values[LEGACY_FIELD_IDS[index]])) return true;
    }
    return false;
  }
  function parseLegacyVersionRows(rawValue) {
    var source = rawValue;
    if (typeof source === 'string') {
      var parsed = parseJsonLenient(source);
      source = Array.isArray(parsed) ? parsed : [];
    }
    if (!Array.isArray(source)) return [];
    return source.filter(function (entry) {
      return entry && (typeof entry === 'object' || typeof entry === 'string');
    });
  }
  function applyLegacyImport(options) {
    var settings = options || {};
    var values = legacyValuesSnapshot();
    var found = [];
    var applied = [];
    var skipped = [];

    function fillTextField(legacyKey, targetKey, maxLength) {
      if (!hasValue(values[legacyKey])) return;
      found.push(legacyKey);
      var text = normalizeText(values[legacyKey], maxLength);
      if (!DB.app[targetKey]) {
        DB.app[targetKey] = text;
        applied.push(legacyKey);
      } else {
        skipped.push(legacyKey);
      }
    }

    fillTextField('appName', 'appName', 120);
    fillTextField('appShortDescription', 'appShortDescription', 200);
    fillTextField('website', 'website', 1000);

    if (hasValue(values.appCategory)) {
      found.push('appCategory');
      var incomingCategory = validCategoryId(values.appCategory);
      var categoryIsPlaceholder = !DB.app.appCategory || (settings.seedDefaults && DB.app.appCategory === APP_CATEGORIES[0].id);
      if (categoryIsPlaceholder) {
        DB.app.appCategory = incomingCategory;
        applied.push('appCategory');
      } else if (DB.app.appCategory !== incomingCategory) {
        skipped.push('appCategory');
      }
    }

    if (hasValue(values.languages)) {
      found.push('languages');
      var incomingLanguages = normalizeLanguageList(values.languages);
      if (incomingLanguages.length) {
        var languagesArePlaceholder = !DB.app.languages.length
          || (settings.seedDefaults && DB.app.languages.length === 1 && DB.app.languages[0] === 'en');
        if (languagesArePlaceholder) {
          DB.app.languages = incomingLanguages;
          applied.push('languages');
        } else if (JSON.stringify(DB.app.languages) !== JSON.stringify(incomingLanguages)) {
          skipped.push('languages');
        }
      }
    }

    if (hasValue(values.developer)) {
      found.push('developer');
      var developer = normalizeDeveloper(values.developer);
      if (developer.id && !DB.app.developerId) {
        DB.app.developerId = developer.id;
        applied.push('developer');
      } else if (developer.id) {
        skipped.push('developer');
      }
      if (developer.name && !DB.app.developerName) DB.app.developerName = developer.name;
    }

    var legacyRows = parseLegacyVersionRows(values.applicationVersions);
    if (legacyRows.length) {
      found.push('applicationVersions (' + legacyRows.length + ' row(s))');
      var existingNumbers = DB.versions.map(function (release) { return String(release.versionNumber || '').toLowerCase(); });
      legacyRows.forEach(function (row, rowIndex) {
        var mappedRelease = normalizeVersion(row, DB.versions.length + rowIndex + 1);
        if (!mappedRelease.versionNumber) {
          skipped.push('version row without a number');
          return;
        }
        var numberKey = mappedRelease.versionNumber.toLowerCase();
        if (existingNumbers.indexOf(numberKey) !== -1) {
          skipped.push('version ' + mappedRelease.versionNumber);
          return;
        }
        if (!mappedRelease.id || mappedRelease.id.indexOf('rel-') === 0) {
          mappedRelease.id = uniqueId('legacy-rel');
        }
        mappedRelease.createdAt = mappedRelease.createdAt || timestampNow();
        mappedRelease.updatedAt = mappedRelease.updatedAt || timestampNow();
        DB.versions.push(mappedRelease);
        existingNumbers.push(numberKey);
        applied.push('version ' + mappedRelease.versionNumber);
      });
    }

    if (applied.length) {
      DB.app.legacyImportedAt = timestampNow();
      DB.meta.updatedAt = timestampNow();
      persist();
    }
    var result = { found: found, applied: applied, skipped: skipped };
    logDiagnostics('legacy-import', 'found=[' + found.join(', ') + '] applied=[' + applied.join(', ') + '] skipped=[' + skipped.join(', ') + ']');
    logActivity('Legacy import', applied.length + ' value(s) imported, ' + skipped.length + ' kept');
    renderImportNote(result);
    if (!settings.silent) {
      if (applied.length) notify('Imported ' + applied.length + ' legacy value(s) into the application record.', 'success');
      else notify('No legacy values needed importing - existing values were kept.', 'info');
    }
    if (settings.render !== false) renderAll();
    return result;
  }
  function renderImportNote(result) {
    var noteElement = $('asi-import-note');
    if (!noteElement) return;
    if (!result) {
      noteElement.textContent = 'No import has run in this session yet.';
      return;
    }
    var parts = [];
    if (result.found.length) parts.push('Legacy fields found: ' + result.found.join(', '));
    else parts.push('No legacy fields found on this record');
    parts.push('Imported: ' + (result.applied.length ? result.applied.join(', ') : 'nothing new'));
    if (result.skipped.length) parts.push('Kept as-is: ' + result.skipped.join(', '));
    if (DB && DB.app && DB.app.legacyImportedAt) parts.push('Last import: ' + formatDateTime(DB.app.legacyImportedAt));
    noteElement.textContent = parts.join('. ');
  }
  function runLegacyImportFromButton() {
    if (!canWrite()) { notify('Read-only - importing is disabled.', 'warning'); return; }
    if (!_legacyImportArmed) {
      _legacyImportArmed = true;
      clearTimeout(_legacyImportArmTimer);
      _legacyImportArmTimer = setTimeout(function () { _legacyImportArmed = false; }, 8000);
      notify('Click Import again within 8 seconds to fill empty fields from the legacy record.', 'warning');
      return;
    }
    _legacyImportArmed = false;
    applyLegacyImport({ silent: false, render: true });
  }

  /* --------------------------------------------------------
     Persistence
  -------------------------------------------------------- */
  function persist() {
    if (!DB) return;
    DB.meta.updatedAt = timestampNow();
    _saving = true;
    try {
      tool.setValue(JSON.parse(JSON.stringify(DB)));
      setSaveState('staged');
    } catch (error) {
      logDiagnostics('persist', 'setValue failed: ' + (error && error.message ? error.message : error));
    }
    clearTimeout(_savingResetTimer);
    _savingResetTimer = setTimeout(function () { _saving = false; }, 450);
    scheduleSizeMeter();
  }
  function flushStagedValue() {
    if (!DB) return;
    try { tool.setValue(JSON.parse(JSON.stringify(DB))); } catch (error) {}
  }
  function setSaveState(kind) {
    var element = $('asi-save-state');
    if (!element) return;
    if (kind === 'saved') {
      element.textContent = '✓ Saved';
      element.classList.add('ok');
    } else {
      element.textContent = 'Draft staged';
      element.classList.remove('ok');
    }
  }
  function scheduleSizeMeter() {
    clearTimeout(_sizeMeterTimer);
    _sizeMeterTimer = setTimeout(updateSizeMeter, 300);
  }
  function updateSizeMeter() {
    var meterElement = $('asi-size-meter');
    if (!meterElement || !DB) return;
    var bytes = 0;
    try { bytes = JSON.stringify(DB).length; } catch (error) { return; }
    var kilobytes = bytes / 1024;
    meterElement.textContent = kilobytes >= 1024 ? (kilobytes / 1024).toFixed(2) + ' MB' : Math.round(kilobytes) + ' KB';
    meterElement.className = 'asi-size-meter' + (bytes >= 950 * 1024 ? ' danger' : (bytes >= 800 * 1024 ? ' warn' : ''));
    meterElement.title = bytes + ' bytes in the stored value (metadata, releases and screenshot URLs - documents live in their own objects)';
  }

  /* --------------------------------------------------------
     Identity and permissions
  -------------------------------------------------------- */
  function getUserSafe() {
    try { return tool.getUser ? tool.getUser() : null; } catch (error) { return null; }
  }
  function getRoles() {
    var user = _user || getUserSafe();
    if (user && Array.isArray(user.roles) && user.roles.length) return user.roles;
    if (user && user.effectiveAccess) {
      var roles = [];
      if (user.effectiveAccess.isManager) roles.push('admin');
      if (user.effectiveAccess.isEditor) roles.push('editor');
      if (user.effectiveAccess.isViewer) roles.push('viewer');
      return roles;
    }
    return [];
  }
  function canWrite() {
    if (_noIdentity) return !_readOnly;
    if (_readOnly) return false;
    var roles = getRoles();
    return ['admin', 'editor', 'developer', 'owner', 'user-manager'].some(function (roleName) {
      return roles.indexOf(roleName) > -1;
    });
  }
  function refreshUser() {
    _user = getUserSafe();
    if (!_user || !getRoles().length) {
      if (typeof tool.getUser !== 'function') {
        _noIdentity = true;
      } else if (!_polled) {
        _polled = true;
        [400, 1200, 2600, 5000].forEach(function (delayMs) {
          setTimeout(function () {
            _user = getUserSafe();
            if (_user && getRoles().length) _polled = true;
            renderUser();
            lockUI();
          }, delayMs);
        });
      }
    }
    renderUser();
    lockUI();
  }
  function renderUser() {
    var badge = $('asi-role-badge');
    if (!badge) return;
    var user = _user || getUserSafe();
    if (!user && _noIdentity) { badge.textContent = '👤 CMS session'; return; }
    if (!user) { badge.textContent = '👤 Guest'; return; }
    var roles = getRoles();
    badge.textContent = '👤 ' + (user.name || 'User') + ' - ' + (roles.length ? roles.join(' / ') : 'member');
  }
  function lockUI() {
    var locked = !canWrite();
    var root = $('asi-root');
    if (root) root.classList.toggle('asi-locked', locked);
    var lockNote = $('asi-lock-note');
    if (lockNote) lockNote.style.display = locked ? '' : 'none';
  }

  /* --------------------------------------------------------
     Selection helpers
  -------------------------------------------------------- */
  function activeCategories() {
    var rawParam = readParam('categoryList', '');
    if (rawParam) {
      var parsedList = parseJsonLenient(rawParam);
      if (Array.isArray(parsedList)) {
        var categories = parsedList.map(function (entry) {
          if (typeof entry === 'string') return { id: entry.trim().toLowerCase().replace(/\s+/g, '-'), label: entry.trim() };
          if (!entry || typeof entry !== 'object') return null;
          var id = String(entry.id || entry._id || entry.value || entry.label || '').trim();
          if (!id) return null;
          return { id: id, label: String(entry.label || entry.name || id) };
        }).filter(Boolean);
        if (categories.length) return categories;
      }
    }
    return APP_CATEGORIES;
  }
  function categoryLabel(categoryId) {
    var categories = activeCategories();
    for (var index = 0; index < categories.length; index++) {
      if (categories[index].id === categoryId) return categories[index].label;
    }
    return categoryId || 'Uncategorized';
  }
  function activeLanguages() {
    var rawParam = readParam('languageOptions', '');
    if (rawParam) {
      var parsedList = parseJsonLenient(rawParam);
      if (Array.isArray(parsedList)) {
        var languages = parsedList.map(function (entry) {
          if (typeof entry === 'string') return { id: languageCodeOf(entry), label: entry.trim() };
          if (!entry || typeof entry !== 'object') return null;
          var id = String(entry.id || entry._id || entry.value || entry.code || '').trim();
          if (!id) return null;
          return { id: languageCodeOf(id), label: String(entry.label || entry.name || id) };
        }).filter(function (entry) { return entry && entry.id; });
        if (languages.length) return languages;
      }
    }
    return LANGUAGE_OPTIONS;
  }
  function languageLabel(code) {
    var languages = activeLanguages();
    for (var index = 0; index < languages.length; index++) {
      if (languages[index].id === code) return languages[index].label;
    }
    return String(code || '').toUpperCase();
  }
  function licenseLabel(value) {
    return { free: 'Free', freemium: 'Freemium', paid: 'Paid', internal: 'Internal only' }[value] || value || 'Free';
  }
  function appStatusLabel(value) {
    return { draft: 'Draft', active: 'Active', archived: 'Archived' }[value] || value || 'Draft';
  }
  function developerType() {
    return String(readParam('developerType', DEFAULT_DEVELOPER_TYPE) || DEFAULT_DEVELOPER_TYPE);
  }
  function releaseFileAccept() {
    return String(readParam('releaseFileAccept', DEFAULT_RELEASE_FILE_ACCEPT) || DEFAULT_RELEASE_FILE_ACCEPT);
  }
  function previewAccentColor() {
    var color = String(readParam('previewAccentColor', '#2563eb') || '#2563eb').trim();
    return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#2563eb';
  }
  function appSlugOf() {
    var rawName = String(DB.app.appName || '').trim();
    if (!rawName) rawName = String(_ownRecordName || '').trim();
    if (!rawName) return 'unnamed-application';
    var normalized = rawName.normalize ? rawName.normalize('NFKD') : rawName;
    normalized = normalized.replace(/[\u0300-\u036f]/g, '');
    var charMap = { 'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u' };
    normalized = normalized.replace(/[çÇğĞıİöÖşŞüÜ]/g, function (character) { return charMap[character]; });
    var slug = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'unnamed-application';
  }
  function displayNameOfApp() {
    return String(DB.app.appName || _ownRecordName || 'Application').trim();
  }
  function findDeveloperOption(developerId) {
    for (var index = 0; index < _developerOptions.length; index++) {
      if (_developerOptions[index].id === developerId) return _developerOptions[index];
    }
    return null;
  }

  /* --------------------------------------------------------
     Releases
  -------------------------------------------------------- */
  function releaseSizeKb(release) {
    var bytes = 0;
    (release && release.files ? release.files : []).forEach(function (file) {
      bytes += Number(file.size || 0);
    });
    if (bytes > 0) return Math.round(bytes / 1024);
    return Number(release && release.sizeInKb || 0) || 0;
  }
  function sortedReleases() {
    return DB.versions.slice().sort(function (first, second) {
      var firstDate = first.releaseDate || '';
      var secondDate = second.releaseDate || '';
      if (firstDate !== secondDate) return firstDate < secondDate ? 1 : -1;
      return compareVersionText(second.versionNumber, first.versionNumber);
    });
  }
  function liveRelease() {
    var sorted = sortedReleases();
    for (var index = 0; index < sorted.length; index++) {
      if (sorted[index].isEnabled === 'yes' && sorted[index].files.length) return sorted[index];
    }
    return null;
  }
  function nextSuggestedVersion() {
    var sorted = sortedReleases();
    var base = sorted.length ? String(sorted[0].versionNumber || '') : '';
    if (!base) return '1.0.0';
    var pieces = base.split('.');
    if (pieces.length === 1) return base + '.1';
    var lastIndex = pieces.length - 1;
    var lastNumber = parseInt(pieces[lastIndex], 10);
    pieces[lastIndex] = String(isNaN(lastNumber) ? 1 : lastNumber + 1);
    return pieces.join('.');
  }
  function newReleaseDraft() {
    return {
      id: '',
      versionNumber: nextSuggestedVersion(),
      releaseDate: todayIso(),
      languages: DB.app.languages.slice(),
      iconUrl: '',
      releaseNotes: '',
      isEnabled: 'yes',
      files: [],
      createdAt: '',
      updatedAt: ''
    };
  }
  function ensureReleaseDraft() {
    if (!_releaseDraft) _releaseDraft = newReleaseDraft();
    return _releaseDraft;
  }
  function renderReleaseEditor() {
    var draft = ensureReleaseDraft();
    var titleElement = $('asi-release-editor-title');
    var noteElement = $('asi-release-editor-note');
    if (titleElement) titleElement.textContent = draft.id ? ('Edit release v' + (draft.versionNumber || '?')) : 'New release';
    if (noteElement) {
      noteElement.textContent = draft.id
        ? 'Changes are stored in this record when you save the release.'
        : 'Add the files, number and notes, then save the release.';
    }
    setInputValue('asi-rel-version', draft.versionNumber);
    setInputValue('asi-rel-date', draft.releaseDate);
    setInputValue('asi-rel-enabled', draft.isEnabled);
    setInputValue('asi-f-rel-icon', draft.iconUrl);
    setInputValue('asi-rel-notes', draft.releaseNotes);
    renderReleaseLanguages();
    renderReleaseFiles();
    updateReleaseSize();
  }
  function setInputValue(id, value) {
    var element = $(id);
    if (!element) return;
    if (document.activeElement === element) return;
    element.value = value == null ? '' : value;
  }
  function readReleaseEditorIntoDraft() {
    var draft = ensureReleaseDraft();
    var versionInput = $('asi-rel-version');
    var dateInput = $('asi-rel-date');
    var enabledInput = $('asi-rel-enabled');
    var iconInput = $('asi-f-rel-icon');
    var notesInput = $('asi-rel-notes');
    if (versionInput) draft.versionNumber = String(versionInput.value || '').trim();
    if (dateInput) draft.releaseDate = normalizeDateOnly(dateInput.value);
    if (enabledInput) draft.isEnabled = enabledInput.value === 'no' ? 'no' : 'yes';
    if (iconInput) draft.iconUrl = String(iconInput.value || '').trim();
    if (notesInput) draft.releaseNotes = String(notesInput.value || '');
    return draft;
  }
  function renderReleaseLanguages() {
    var container = $('asi-rel-languages');
    var draft = ensureReleaseDraft();
    if (!container) return;
    container.innerHTML = activeLanguages().map(function (language) {
      var checked = draft.languages.indexOf(language.id) !== -1;
      return '<label class="asi-lang-chip' + (checked ? ' is-on' : '') + '">'
        + '<input type="checkbox" data-release-language="' + escHtml(language.id) + '"' + (checked ? ' checked' : '') + '> '
        + escHtml(language.label) + '</label>';
    }).join('');
  }
  function renderReleaseFiles() {
    var container = $('asi-rel-files');
    var draft = ensureReleaseDraft();
    if (!container) return;
    if (!draft.files.length) {
      container.innerHTML = '<div class="asi-empty-note">No files yet. Upload the application bundle or paste a file URL.</div>';
      return;
    }
    container.innerHTML = draft.files.map(function (file, index) {
      return '<div class="asi-file-row">'
        + '<span class="asi-file-name">' + escHtml(file.name || fileNameFromUrl(file.url)) + '</span>'
        + '<span class="asi-file-meta">' + escHtml(fileSizeLabel(file)) + (file.type ? ' · ' + escHtml(file.type) : '') + '</span>'
        + '<span class="asi-file-actions">'
        + '<button class="asi-btn asi-btn-ghost asi-btn-sm" type="button" data-act="file-copy" data-file-index="' + index + '">⧉</button>'
        + '<button class="asi-btn asi-btn-danger asi-btn-sm" type="button" data-act="file-remove" data-file-index="' + index + '">✕</button>'
        + '</span></div>';
    }).join('');
  }
  function updateReleaseSize() {
    var draft = ensureReleaseDraft();
    var countElement = $('asi-rel-file-count');
    var sizeElement = $('asi-rel-size');
    if (countElement) countElement.textContent = draft.files.length + ' file' + (draft.files.length === 1 ? '' : 's');
    if (sizeElement) {
      var missingSizeCount = draft.files.filter(function (file) { return !Number(file.size || 0); }).length;
      sizeElement.textContent = 'Total size: ' + formatKb(releaseSizeKb(draft))
        + (missingSizeCount ? ' · ' + missingSizeCount + ' file(s) without a recorded size' : '');
    }
  }
  function openReleaseEditor(releaseId) {
    var release = null;
    for (var index = 0; index < DB.versions.length; index++) {
      if (DB.versions[index].id === releaseId) { release = DB.versions[index]; break; }
    }
    if (!release) { notify('Release not found in this record.', 'warning'); return; }
    _releaseDraft = JSON.parse(JSON.stringify(release));
    renderReleaseEditor();
    var titleElement = $('asi-release-editor-title');
    if (titleElement && titleElement.scrollIntoView) {
      try { titleElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (error) {}
    }
  }
  function resetReleaseEditor(focusInput) {
    _releaseDraft = newReleaseDraft();
    renderReleaseEditor();
    if (focusInput) {
      var versionInput = $('asi-rel-version');
      if (versionInput) versionInput.focus();
    }
  }
  function saveRelease() {
    if (!canWrite()) { notify('Read-only - saving releases is disabled.', 'warning'); return; }
    var draft = readReleaseEditorIntoDraft();
    var versionNumber = String(draft.versionNumber || '').trim();
    if (!versionNumber) {
      notify('Version number is required before saving a release.', 'warning');
      var versionInput = $('asi-rel-version');
      if (versionInput) versionInput.focus();
      return;
    }
    var duplicate = DB.versions.some(function (release) {
      return release.id !== draft.id && String(release.versionNumber || '').toLowerCase() === versionNumber.toLowerCase();
    });
    if (duplicate) {
      notify('Version ' + versionNumber + ' already exists. Edit that release or use another number.', 'warning');
      return;
    }
    if (draft.isEnabled === 'yes' && !draft.files.length) {
      notify('This release is enabled but has no files - the store cannot install it. Add a file or disable it.', 'warning');
    }
    var now = timestampNow();
    var savedRelease = {
      id: draft.id || uniqueId('rel'),
      versionNumber: versionNumber,
      releaseDate: draft.releaseDate,
      languages: draft.languages.slice(),
      iconUrl: draft.iconUrl,
      releaseNotes: draft.releaseNotes,
      isEnabled: draft.isEnabled,
      files: draft.files.map(function (file) {
        return { name: file.name, url: file.url, size: Number(file.size || 0) || 0, type: file.type || '' };
      }),
      sizeInKb: releaseSizeKb(draft),
      createdAt: draft.createdAt || now,
      updatedAt: now
    };
    var existingIndex = -1;
    for (var index = 0; index < DB.versions.length; index++) {
      if (DB.versions[index].id === savedRelease.id) { existingIndex = index; break; }
    }
    if (existingIndex === -1) DB.versions.push(savedRelease);
    else DB.versions[existingIndex] = savedRelease;
    persist();
    logActivity('Release saved', 'v' + versionNumber + ' · ' + savedRelease.files.length + ' file(s)');
    logDiagnostics('release-save', 'v' + versionNumber + ' id=' + savedRelease.id + ' files=' + savedRelease.files.length);
    notify('Release v' + versionNumber + ' saved.', 'success');
    _releaseDraft = null;
    renderReleases();
    renderReadiness();
    schedulePreviewRefresh();
    reportValidation();
  }
  function deleteRelease(releaseId) {
    if (!canWrite()) { notify('Read-only - deleting releases is disabled.', 'warning'); return; }
    if (!_releaseDeleteArmed[releaseId]) {
      _releaseDeleteArmed[releaseId] = true;
      clearTimeout(_releaseDeleteArmTimers[releaseId]);
      _releaseDeleteArmTimers[releaseId] = setTimeout(function () {
        _releaseDeleteArmed[releaseId] = false;
        renderReleaseList();
      }, 8000);
      renderReleaseList();
      notify('Click Delete again within 8 seconds to remove this release.', 'warning');
      return;
    }
    _releaseDeleteArmed[releaseId] = false;
    var removed = null;
    DB.versions = DB.versions.filter(function (release) {
      if (release.id === releaseId) { removed = release; return false; }
      return true;
    });
    if (_releaseDraft && _releaseDraft.id === releaseId) _releaseDraft = null;
    persist();
    if (removed) {
      logActivity('Release deleted', 'v' + removed.versionNumber);
      notify('Release v' + removed.versionNumber + ' deleted.', 'info');
    }
    renderReleases();
    renderReadiness();
    schedulePreviewRefresh();
    reportValidation();
  }
  function toggleReleaseEnabled(releaseId, enabled) {
    if (!canWrite()) { notify('Read-only - releases cannot be changed.', 'warning'); return; }
    for (var index = 0; index < DB.versions.length; index++) {
      if (DB.versions[index].id === releaseId) {
        DB.versions[index].isEnabled = enabled ? 'yes' : 'no';
        DB.versions[index].updatedAt = timestampNow();
        logActivity('Release ' + (enabled ? 'enabled' : 'disabled'), 'v' + DB.versions[index].versionNumber);
        break;
      }
    }
    persist();
    renderReleases();
    renderReadiness();
    schedulePreviewRefresh();
    reportValidation();
  }
  function renderReleases() {
    ensureReleaseDraft();
    renderReleaseSummary();
    renderReleaseEditor();
    renderReleaseList();
    renderCounts();
  }
  function renderReleaseSummary() {
    var summaryElement = $('asi-rel-summary');
    if (!summaryElement) return;
    var sorted = sortedReleases();
    var live = liveRelease();
    var enabledCount = DB.versions.filter(function (release) { return release.isEnabled === 'yes'; }).length;
    var totalFiles = 0;
    var totalKb = 0;
    DB.versions.forEach(function (release) {
      totalFiles += release.files.length;
      totalKb += releaseSizeKb(release);
    });
    var latest = sorted.length ? sorted[0] : null;
    summaryElement.innerHTML = ''
      + '<div class="asi-stat"><span class="asi-stat-label">Releases</span><span class="asi-stat-value">' + DB.versions.length + '</span><span class="asi-stat-sub">' + enabledCount + ' enabled</span></div>'
      + '<div class="asi-stat"><span class="asi-stat-label">Live version</span><span class="asi-stat-value">' + (live ? 'v' + escHtml(live.versionNumber) : '-') + '</span><span class="asi-stat-sub">' + (live ? escHtml(live.releaseDate || 'no date') : 'no installable release') + '</span></div>'
      + '<div class="asi-stat"><span class="asi-stat-label">Files</span><span class="asi-stat-value">' + totalFiles + '</span><span class="asi-stat-sub">' + escHtml(formatKb(totalKb)) + ' total</span></div>'
      + '<div class="asi-stat"><span class="asi-stat-label">Latest release</span><span class="asi-stat-value">' + (latest ? 'v' + escHtml(latest.versionNumber) : '-') + '</span><span class="asi-stat-sub">' + (latest ? escHtml(latest.releaseDate || 'no date') : 'nothing yet') + '</span></div>';
  }
  function renderReleaseList() {
    var listElement = $('asi-release-list');
    if (!listElement) return;
    if (!DB.versions.length) {
      listElement.innerHTML = '<div class="asi-empty-note">No releases yet. Use the form above to add the first installable version.</div>';
      return;
    }
    var live = liveRelease();
    var liveId = live ? live.id : '';
    listElement.innerHTML = sortedReleases().map(function (release) {
      var isLive = release.id === liveId;
      var languageText = release.languages.length ? release.languages.map(languageLabel).join(', ') : 'no release languages';
      return '<div class="asi-release-row' + (isLive ? ' is-live' : '') + '">'
        + '<span class="asi-release-version">v' + escHtml(release.versionNumber || '?') + '</span>'
        + '<span class="asi-release-meta">' + escHtml(release.releaseDate || 'no date')
        + ' · ' + escHtml(languageText)
        + ' · ' + escHtml(formatKb(releaseSizeKb(release)))
        + ' · ' + release.files.length + ' file' + (release.files.length === 1 ? '' : 's')
        + (release.files.length ? '' : ' · <strong>not installable</strong>')
        + '</span>'
        + '<span class="asi-release-badges">'
        + (isLive ? '<span class="asi-badge asi-badge-live">Live</span>' : '')
        + '<span class="asi-badge ' + (release.isEnabled === 'yes' ? 'asi-badge-on' : 'asi-badge-off') + '">' + (release.isEnabled === 'yes' ? 'Enabled' : 'Disabled') + '</span>'
        + '</span>'
        + '<span class="asi-release-buttons">'
        + '<label class="asi-switch"><input type="checkbox" data-release-toggle="' + escHtml(release.id) + '"' + (release.isEnabled === 'yes' ? ' checked' : '') + '> Enabled</label>'
        + '<button class="asi-btn asi-btn-ghost asi-btn-sm" type="button" data-act="release-edit" data-release-id="' + escHtml(release.id) + '">Edit</button>'
        + '<button class="asi-btn asi-btn-danger asi-btn-sm" type="button" data-act="release-delete" data-release-id="' + escHtml(release.id) + '">' + (_releaseDeleteArmed[release.id] ? 'Confirm delete' : 'Delete') + '</button>'
        + '</span></div>';
    }).join('');
  }
  function addReleaseFile(file) {
    if (!file || !file.url) return;
    var draft = ensureReleaseDraft();
    draft.files.push({
      name: file.name || fileNameFromUrl(file.url),
      url: String(file.url).trim(),
      size: Number(file.size || 0) || 0,
      type: file.type || ''
    });
    renderReleaseFiles();
    updateReleaseSize();
  }
  function uploadReleaseFile() {
    if (!canWrite()) { notify('Read-only - uploading is disabled.', 'warning'); return; }
    if (typeof tool.requestUpload !== 'function') { notify('Upload API unavailable (allowUpload off).', 'warning'); return; }
    tool.requestUpload(releaseFileAccept(), function (error, file) {
      if (error) { notify('Upload failed: ' + error, 'error'); return; }
      addReleaseFile(file);
      logActivity('Release file uploaded', file && file.name ? file.name : 'file');
    });
  }
  function uploadReleaseIcon() {
    if (!canWrite()) { notify('Read-only - uploading is disabled.', 'warning'); return; }
    if (typeof tool.requestUpload !== 'function') { notify('Upload API unavailable (allowUpload off).', 'warning'); return; }
    tool.requestUpload('image/*', function (error, file) {
      if (error) { notify('Upload failed: ' + error, 'error'); return; }
      var draft = ensureReleaseDraft();
      draft.iconUrl = file.url;
      setInputValue('asi-f-rel-icon', file.url);
      logActivity('Release icon uploaded', file.name || '');
    });
  }
  function addReleaseUrl() {
    var inputElement = $('asi-rel-url');
    if (!inputElement) return;
    var url = String(inputElement.value || '').trim();
    if (!url) return;
    if (!isAcceptableUrl(url)) {
      notify('Enter a full http(s) URL, a path starting with /, or a mock:// URL.', 'warning');
      return;
    }
    addReleaseFile({ name: fileNameFromUrl(url), url: url, size: 0, type: '' });
    inputElement.value = '';
  }

  /* --------------------------------------------------------
     Screenshots
  -------------------------------------------------------- */
  function uploadScreenshot() {
    if (!canWrite()) { notify('Read-only - uploading is disabled.', 'warning'); return; }
    if (typeof tool.requestUpload !== 'function') { notify('Upload API unavailable (allowUpload off).', 'warning'); return; }
    if (_shotsBusy) return;
    _shotsBusy = true;
    tool.requestUpload('image/*', function (error, file) {
      _shotsBusy = false;
      if (error) { notify('Upload failed: ' + error, 'error'); return; }
      if (!file || !file.url) { notify('Upload returned no file URL.', 'error'); return; }
      _shotSequence++;
      DB.shots.push({
        id: uniqueId('shot'),
        name: file.name || ('screenshot-' + _shotSequence),
        url: file.url,
        size: Number(file.size || 0) || 0,
        type: file.type || 'image/png',
        caption: '',
        uploadedAt: timestampNow()
      });
      persist();
      renderShots();
      logActivity('Screenshot uploaded', file.name || '');
      logDiagnostics('shot-upload', (file.name || 'file') + ' -> ' + file.url);
      notify('Screenshot uploaded - only the URL is stored.', 'success');
    });
  }
  function uploadApplicationIcon() {
    if (!canWrite()) { notify('Read-only - uploading is disabled.', 'warning'); return; }
    if (typeof tool.requestUpload !== 'function') { notify('Upload API unavailable (allowUpload off).', 'warning'); return; }
    tool.requestUpload('image/*', function (error, file) {
      if (error) { notify('Upload failed: ' + error, 'error'); return; }
      DB.app.appIconUrl = file.url;
      persist();
      renderDetails();
      renderIconPreview();
      schedulePreviewRefresh();
      renderReadiness();
      logActivity('Application icon uploaded', file.name || '');
      notify('Application icon updated.', 'success');
    });
  }
  function renderShots() {
    var listElement = $('asi-shots-list');
    var countElement = $('asi-shots-count');
    if (countElement) countElement.textContent = DB.shots.length + ' shot' + (DB.shots.length === 1 ? '' : 's');
    if (!listElement) return;
    if (!DB.shots.length) {
      listElement.innerHTML = '<div class="asi-shot-empty" style="grid-column:1/-1">No screenshots yet. Upload one - only its storage URL is kept.</div>';
      return;
    }
    listElement.innerHTML = DB.shots.map(function (shot, index) {
      return '<div class="asi-shot-card">'
        + '<div class="asi-shot-thumb"><img src="' + escHtml(shot.url) + '" alt="" loading="lazy"></div>'
        + '<div class="asi-shot-body">'
        + '<span class="asi-shot-title">' + escHtml(shot.name || fileNameFromUrl(shot.url)) + '</span>'
        + '<span class="asi-shot-meta">' + escHtml(fileSizeLabel(shot)) + ' · ' + escHtml(shot.uploadedAt ? formatDateTime(shot.uploadedAt) : '') + '</span>'
        + '<input class="asi-input" data-shot-caption="' + escHtml(shot.id) + '" placeholder="Caption shown under the screenshot" maxlength="160" value="' + escHtml(shot.caption || '') + '">'
        + '<span class="asi-shot-actions">'
        + '<button class="asi-btn asi-btn-ghost asi-btn-sm" type="button" data-act="shot-up" data-shot-id="' + escHtml(shot.id) + '" title="Move up">↑</button>'
        + '<button class="asi-btn asi-btn-ghost asi-btn-sm" type="button" data-act="shot-down" data-shot-id="' + escHtml(shot.id) + '" title="Move down">↓</button>'
        + '<button class="asi-btn asi-btn-ghost asi-btn-sm" type="button" data-act="shot-copy" data-shot-id="' + escHtml(shot.id) + '">⧉ URL</button>'
        + '<button class="asi-btn asi-btn-ghost asi-btn-sm" type="button" data-act="shot-icon" data-shot-id="' + escHtml(shot.id) + '">Use as icon</button>'
        + '<button class="asi-btn asi-btn-danger asi-btn-sm" type="button" data-act="shot-remove" data-shot-id="' + escHtml(shot.id) + '">✕</button>'
        + '</span></div></div>';
    }).join('');
  }
  function shotById(shotId) {
    for (var index = 0; index < DB.shots.length; index++) {
      if (DB.shots[index].id === shotId) return DB.shots[index];
    }
    return null;
  }
  function moveShot(shotId, direction) {
    var index = -1;
    for (var shotIndex = 0; shotIndex < DB.shots.length; shotIndex++) {
      if (DB.shots[shotIndex].id === shotId) { index = shotIndex; break; }
    }
    if (index === -1) return;
    var targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= DB.shots.length) return;
    var moved = DB.shots.splice(index, 1)[0];
    DB.shots.splice(targetIndex, 0, moved);
    persist();
    renderShots();
    schedulePreviewRefresh();
  }
  function removeShot(shotId) {
    DB.shots = DB.shots.filter(function (shot) { return shot.id !== shotId; });
    persist();
    renderShots();
    renderReadiness();
    schedulePreviewRefresh();
    notify('Removed from this record - the storage file itself stays in the bucket.', 'info');
  }
  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { notify('Copied.', 'success'); }, function () { fallbackCopy(text); });
        return;
      }
    } catch (error) {}
    fallbackCopy(text);
  }
  function fallbackCopy(text) {
    try {
      var tempTextarea = document.createElement('textarea');
      tempTextarea.value = text;
      tempTextarea.style.position = 'fixed';
      tempTextarea.style.opacity = '0';
      document.body.appendChild(tempTextarea);
      tempTextarea.select();
      document.execCommand('copy');
      document.body.removeChild(tempTextarea);
      notify('Copied.', 'success');
    } catch (error) {
      notify('Copy failed - select and copy manually.', 'warning');
    }
  }

  /* --------------------------------------------------------
     Details rendering
  -------------------------------------------------------- */
  function renderCategorySelect() {
    var select = $('asi-f-appCategory');
    if (!select) return;
    select.innerHTML = activeCategories().map(function (category) {
      return '<option value="' + escHtml(category.id) + '">' + escHtml(category.label) + '</option>';
    }).join('');
  }
  function renderDeveloperSelect() {
    var select = $('asi-f-developer');
    if (!select) return;
    var optionsHtml = ['<option value="">- none -</option>'];
    var foundSelected = !DB.app.developerId;
    _developerOptions.forEach(function (option) {
      if (option.id === DB.app.developerId) foundSelected = true;
      optionsHtml.push('<option value="' + escHtml(option.id) + '">' + escHtml(option.name || option.id) + '</option>');
    });
    if (!foundSelected) {
      optionsHtml.push('<option value="' + escHtml(DB.app.developerId) + '">' + escHtml(DB.app.developerName || DB.app.developerId) + ' (not in list)</option>');
    }
    select.innerHTML = optionsHtml.join('');
    select.value = DB.app.developerId || '';
  }
  function setDeveloperNote(message) {
    var noteElement = $('asi-developer-note');
    if (noteElement) noteElement.textContent = message;
  }
  function loadDevelopers() {
    var token = ++_developerLoadToken;
    if (!objectsApiAvailable()) {
      _developerOptions = [];
      renderDeveloperSelect();
      setDeveloperNote('Object API unavailable here - type the developer name below.');
      return;
    }
    setDeveloperNote('Loading developers from ' + developerType() + '...');
    tool.requestObjects('query', { mainObjectType: developerType() }, function (error, result) {
      if (token !== _developerLoadToken) return;
      if (error) {
        _developerOptions = [];
        renderDeveloperSelect();
        setDeveloperNote('Could not load developers: ' + error);
        logDiagnostics('developer-load', 'error: ' + error);
        return;
      }
      var objects = (result && result.objects) || [];
      _developerOptions = objects.map(function (cmsObject) {
        return {
          id: String(cmsObject.id || cmsObject._id || ''),
          name: String(cmsObject.name || '')
        };
      }).filter(function (option) { return option.id; });
      renderDeveloperSelect();
      setDeveloperNote(_developerOptions.length + ' developer(s) loaded from ' + developerType() + '.');
      logDiagnostics('developer-load', _developerOptions.length + ' option(s) from ' + developerType());
    });
  }
  function renderDetails() {
    var elements = document.querySelectorAll('[data-app-field]');
    for (var index = 0; index < elements.length; index++) {
      var element = elements[index];
      var key = element.getAttribute('data-app-field');
      if (document.activeElement === element) continue;
      var value = DB.app[key];
      element.value = value == null ? '' : value;
    }
    updateShortCount();
    renderIconPreview();
    renderStatusNote();
  }
  function updateShortCount() {
    var counter = $('asi-short-count');
    if (counter) counter.textContent = String(DB.app.appShortDescription || '').length + ' / 200';
  }
  function renderIconPreview() {
    var container = $('asi-icon-preview');
    if (!container) return;
    var url = String(DB.app.appIconUrl || '').trim();
    if (url) {
      container.innerHTML = '<img src="' + escHtml(url) + '" alt="">';
    } else {
      container.textContent = String(DB.app.appName || 'A').trim().charAt(0).toUpperCase() || 'A';
    }
  }
  function renderStatusNote() {
    var noteElement = $('asi-status-note');
    if (!noteElement) return;
    if (DB.app.appStatus === 'active') {
      noteElement.textContent = 'Active - the store lists this application and installs the live release (the newest enabled release with files).';
    } else if (DB.app.appStatus === 'archived') {
      noteElement.textContent = 'Archived - the application stays in the store database but is hidden from browsing. Releases are kept for history.';
    } else {
      noteElement.textContent = 'Draft - the record can be edited and previewed, but the store does not list or install it yet.';
    }
  }
  function renderLanguages() {
    var container = $('asi-languages-list');
    if (!container) return;
    container.innerHTML = activeLanguages().map(function (language) {
      var checked = DB.app.languages.indexOf(language.id) !== -1;
      return '<label class="asi-lang-chip' + (checked ? ' is-on' : '') + '">'
        + '<input type="checkbox" data-language="' + escHtml(language.id) + '"' + (checked ? ' checked' : '') + '> '
        + escHtml(language.label) + '</label>';
    }).join('');
    var countElement = $('asi-language-count');
    if (countElement) countElement.textContent = DB.app.languages.length + ' selected';
  }
  function toggleLanguage(code, checked) {
    var index = DB.app.languages.indexOf(code);
    if (checked && index === -1) DB.app.languages.push(code);
    if (!checked && index !== -1) DB.app.languages.splice(index, 1);
    persist();
    renderLanguages();
    renderReadiness();
    schedulePreviewRefresh();
  }
  function addTag(rawText) {
    var addedTags = [];
    String(rawText || '').split(',').forEach(function (piece) {
      var tag = piece.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!tag) return;
      if (tag.length > 24) tag = tag.slice(0, 24);
      if (DB.app.tags.indexOf(tag) !== -1) return;
      if (DB.app.tags.length >= TAG_LIMIT) return;
      DB.app.tags.push(tag);
      addedTags.push(tag);
    });
    if (addedTags.length) {
      persist();
      renderTags();
      schedulePreviewRefresh();
      logDiagnostics('tag-add', 'added ' + addedTags.join(', '));
    }
  }
  function removeTag(tag) {
    var index = DB.app.tags.indexOf(tag);
    if (index !== -1) DB.app.tags.splice(index, 1);
    persist();
    renderTags();
    schedulePreviewRefresh();
  }
  function renderTags() {
    var listElement = $('asi-tags-list');
    if (!listElement) return;
    listElement.innerHTML = DB.app.tags.length
      ? DB.app.tags.map(function (tag) {
          return '<span class="asi-chip">' + escHtml(tag)
            + ' <button class="asi-chip-remove" type="button" data-remove-tag="' + escHtml(tag) + '" title="Remove">×</button></span>';
        }).join('')
      : '<span class="asi-hint">No tags yet - type below and press Enter.</span>';
    var removeButtons = listElement.querySelectorAll('[data-remove-tag]');
    for (var buttonIndex = 0; buttonIndex < removeButtons.length; buttonIndex++) {
      (function (button) {
        button.addEventListener('click', function () { removeTag(button.getAttribute('data-remove-tag')); });
      })(removeButtons[buttonIndex]);
    }
    renderTagSuggestions();
  }
  function renderTagSuggestions() {
    var suggestElement = $('asi-tag-suggest');
    if (!suggestElement) return;
    var unused = TAG_SUGGESTIONS.filter(function (tag) { return DB.app.tags.indexOf(tag) === -1; }).slice(0, 8);
    if (!unused.length) { suggestElement.innerHTML = ''; return; }
    suggestElement.innerHTML = '<span class="asi-hint">Suggestions: </span>' + unused.map(function (tag) {
      return '<button class="asi-tag-suggest-chip" type="button" data-suggest-tag="' + escHtml(tag) + '">' + escHtml(tag) + '</button>';
    }).join('');
    var suggestButtons = suggestElement.querySelectorAll('[data-suggest-tag]');
    for (var buttonIndex = 0; buttonIndex < suggestButtons.length; buttonIndex++) {
      (function (button) {
        button.addEventListener('click', function () { addTag(button.getAttribute('data-suggest-tag')); });
      })(suggestButtons[buttonIndex]);
    }
  }
  function renderCounts() {
    var releaseCount = $('asi-tab-release-count');
    var shotCount = $('asi-tab-shot-count');
    if (releaseCount) releaseCount.textContent = String(DB.versions.length);
    if (shotCount) shotCount.textContent = String(DB.shots.length);
  }

  /* --------------------------------------------------------
     Validation and readiness
  -------------------------------------------------------- */
  function reportValidation() {
    var name = String(DB.app.appName || '').trim();
    var live = liveRelease();
    try {
      if (!name) {
        tool.reportValid(false, 'Application name is required - fill it in Details.');
      } else if (DB.app.appStatus === 'active' && !live) {
        tool.reportValid(false, 'An active listing needs an enabled release with at least one file. Add a release or switch the listing to draft.');
      } else {
        tool.reportValid(true);
      }
    } catch (error) {}
  }
  function computeReadiness() {
    var app = DB.app;
    var checks = [
      { label: 'Application name', hint: 'Required for every record.', weight: 15, ok: !!String(app.appName || '').trim() },
      { label: 'Application icon', hint: 'A square icon makes the store card recognizable.', weight: 10, ok: !!String(app.appIconUrl || '').trim() },
      { label: 'Short description', hint: 'Shown in the store grid; max 200 characters.', weight: 15, ok: !!String(app.appShortDescription || '').trim() },
      { label: 'Full description', hint: 'Explains what the application does and who it is for.', weight: 10, ok: !!String(app.appDescription || '').trim() },
      { label: 'Developer linked', hint: 'Links the app to a ' + developerType() + ' record.', weight: 10, ok: !!(app.developerId || app.developerName) },
      { label: 'Category selected', hint: 'Decides where the store lists the application.', weight: 5, ok: !!app.appCategory },
      { label: 'At least one language', hint: 'The languages the application itself supports.', weight: 5, ok: app.languages.length > 0 },
      { label: 'Website URL', hint: 'A public page for the application.', weight: 5, ok: !!String(app.website || '').trim() },
      { label: 'At least one screenshot', hint: 'Screenshots are the strongest part of a store listing.', weight: 10, ok: DB.shots.length > 0 },
      { label: 'Live release with files', hint: 'An enabled release with at least one file so the store can install it.', weight: 15, ok: !!liveRelease() }
    ];
    var totalWeight = 0;
    var gainedWeight = 0;
    checks.forEach(function (check) {
      totalWeight += check.weight;
      if (check.ok) gainedWeight += check.weight;
    });
    return { checks: checks, percent: totalWeight ? Math.round((gainedWeight / totalWeight) * 100) : 0 };
  }
  function renderReadiness() {
    var container = $('asi-readiness');
    if (!container) return;
    var readiness = computeReadiness();
    var fillElement = $('asi-readiness-fill');
    var labelElement = $('asi-readiness-label');
    if (fillElement) {
      fillElement.style.width = readiness.percent + '%';
      fillElement.className = 'asi-readiness-fill' + (readiness.percent >= 80 ? ' is-good' : (readiness.percent < 40 ? ' is-low' : ''));
    }
    if (labelElement) labelElement.textContent = readiness.percent + '% ready';
    container.innerHTML = readiness.checks.map(function (check) {
      return '<div class="asi-check-row">'
        + '<span class="asi-check-icon ' + (check.ok ? 'ok' : 'miss') + '">' + (check.ok ? '✓' : '!') + '</span>'
        + '<span class="asi-check-text">' + escHtml(check.label) + '<small>' + escHtml(check.hint) + '</small></span>'
        + '</div>';
    }).join('');
  }

  /* --------------------------------------------------------
     Store preview and payload
  -------------------------------------------------------- */
  function descriptionToHtml(text) {
    var blocks = String(text || '').trim().split(/\n{2,}/);
    if (!blocks.length || !blocks[0].trim()) return '<p class="muted">No description written yet.</p>';
    return blocks.map(function (block) {
      return '<p>' + escHtml(block).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }
  function iconMarkup(url, name) {
    var safeUrl = String(url || '').trim();
    if (safeUrl) return '<img src="' + escHtml(safeUrl) + '" alt="">';
    return '<span>' + escHtml(String(name || 'A').trim().charAt(0).toUpperCase() || 'A') + '</span>';
  }
  function buildListingPreviewDoc() {
    var app = DB.app;
    var live = liveRelease();
    var developerText = app.developerName || app.developerId || 'Developer not linked';
    var accent = previewAccentColor();
    var categoryText = categoryLabel(app.appCategory);
    var languageText = app.languages.length ? app.languages.map(languageLabel).join(', ') : 'No languages selected';
    var statusClass = app.appStatus === 'active' ? 'ok' : (app.appStatus === 'archived' ? 'off' : 'draft');
    var galleryHtml = DB.shots.length
      ? DB.shots.map(function (shot) {
          return '<figure><img src="' + escHtml(shot.url) + '" alt="' + escHtml(shot.caption || shot.name || 'Screenshot') + '">'
            + (shot.caption ? '<figcaption>' + escHtml(shot.caption) + '</figcaption>' : '') + '</figure>';
        }).join('')
      : '<div class="empty-gallery">No screenshots uploaded yet.</div>';
    var chipsHtml = ''
      + '<span class="chip">' + escHtml(categoryText) + '</span>'
      + '<span class="chip">' + escHtml(licenseLabel(app.licenseType)) + '</span>'
      + '<span class="chip">' + escHtml(languageText) + '</span>'
      + (app.featured === 'yes' ? '<span class="chip chip-feature">Featured</span>' : '');
    var liveText = live
      ? 'v' + live.versionNumber + (live.releaseDate ? ' · ' + live.releaseDate : '') + ' · ' + formatKb(releaseSizeKb(live))
      : 'No installable release';
    var notesHtml = live && live.releaseNotes
      ? '<p>' + escHtml(live.releaseNotes).replace(/\n/g, '<br>') + '</p>'
      : '<p class="muted">No release notes written yet.</p>';
    var tagHtml = app.tags.length
      ? '<div class="tags">' + app.tags.map(function (tag) { return '<span class="tag">' + escHtml(tag) + '</span>'; }).join('') + '</div>'
      : '';
    var websiteRow = app.website ? '<tr><th>Website</th><td><a href="' + escHtml(app.website) + '" target="_blank" rel="noopener">' + escHtml(app.website) + '</a></td></tr>' : '';
    var supportRow = app.supportUrl ? '<tr><th>Support</th><td><a href="' + escHtml(app.supportUrl) + '" target="_blank" rel="noopener">' + escHtml(app.supportUrl) + '</a></td></tr>' : '';
    var privacyRow = app.privacyUrl ? '<tr><th>Privacy</th><td><a href="' + escHtml(app.privacyUrl) + '" target="_blank" rel="noopener">' + escHtml(app.privacyUrl) + '</a></td></tr>' : '';

    var parts = [];
    parts.push('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">');
    parts.push('<meta name="viewport" content="width=device-width,initial-scale=1">');
    parts.push('<title>' + escHtml(app.appName || 'Application') + ' - store listing preview</title>');
    parts.push('<style>');
    parts.push(':root{--accent:' + accent + '}');
    parts.push('*{box-sizing:border-box}');
    parts.push('body{margin:0;background:#eef2f7;color:#0f172a;font-family:"Segoe UI",system-ui,-apple-system,Arial,sans-serif;line-height:1.55}');
    parts.push('.wrap{max-width:1100px;margin:0 auto;padding:24px;display:grid;grid-template-columns:310px 1fr;gap:20px;align-items:start}');
    parts.push('.card,.detail{background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 10px 30px -20px rgba(15,23,42,.4)}');
    parts.push('.card{padding:18px;display:flex;flex-direction:column;gap:12px;position:sticky;top:24px}');
    parts.push('.icon{width:74px;height:74px;border-radius:20px;overflow:hidden;background:linear-gradient(135deg,#e0e7ff,#ede9fe);display:grid;place-items:center;font-size:30px;font-weight:800;color:var(--accent);flex:none}');
    parts.push('.icon img{width:100%;height:100%;object-fit:cover;display:block}');
    parts.push('.card h3{margin:0;font-size:17px;letter-spacing:-.2px}');
    parts.push('.dev{margin:0;color:#64748b;font-size:12.5px}');
    parts.push('.short{margin:0;font-size:13px;color:#334155}');
    parts.push('.chips{display:flex;flex-wrap:wrap;gap:6px}');
    parts.push('.chip{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;border-radius:999px;padding:3px 9px}');
    parts.push('.chip-feature{background:#fef3c7;border-color:#fde68a;color:#b45309}');
    parts.push('.install{border:none;border-radius:12px;background:var(--accent);color:#fff;font-family:inherit;font-size:14px;font-weight:800;padding:12px 18px;cursor:pointer;box-shadow:0 12px 24px -14px var(--accent)}');
    parts.push('.install.small{padding:10px 14px;font-size:13px}');
    parts.push('.meta-line{font-size:11.5px;color:#64748b;font-family:Consolas,monospace;border-top:1px solid #eef2f7;padding-top:10px}');
    parts.push('.detail{overflow:hidden}');
    parts.push('.hero{display:flex;gap:16px;align-items:center;padding:22px 24px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff}');
    parts.push('.hero .icon{box-shadow:0 10px 30px -12px rgba(0,0,0,.7)}');
    parts.push('.hero h1{margin:0;font-size:24px;letter-spacing:-.5px}');
    parts.push('.hero p{margin:2px 0 0;color:#cbd5e1;font-size:13px}');
    parts.push('.hero .chips{margin-top:10px}');
    parts.push('.hero .chip{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.18);color:#e2e8f0}');
    parts.push('.hero-spacer{flex:1}');
    parts.push('.status{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;border-radius:999px;padding:4px 10px}');
    parts.push('.status.ok{background:#dcfce7;color:#15803d}.status.draft{background:#fef3c7;color:#b45309}.status.off{background:#334155;color:#cbd5e1}');
    parts.push('.gallery{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:20px 24px 4px}');
    parts.push('.gallery figure{margin:0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#f8fafc}');
    parts.push('.gallery img{width:100%;aspect-ratio:16/10;object-fit:cover;display:block}');
    parts.push('.gallery figcaption{font-size:11.5px;color:#64748b;padding:7px 10px}');
    parts.push('.empty-gallery{border:1px dashed #cbd5e1;border-radius:12px;color:#94a3b8;font-size:12.5px;padding:26px;text-align:center}');
    parts.push('.body{padding:6px 24px 24px}');
    parts.push('.body h2{font-size:14px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;margin:22px 0 8px;border-bottom:1px solid #eef2f7;padding-bottom:6px}');
    parts.push('.body p{margin:0 0 10px;font-size:13.5px;color:#334155}');
    parts.push('.muted{color:#94a3b8!important}');
    parts.push('.tags{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 4px}');
    parts.push('.tag{font-size:11px;font-weight:600;color:#475569;background:#f1f5f9;border-radius:999px;padding:3px 9px}');
    parts.push('table.details{width:100%;border-collapse:collapse;font-size:12.5px}');
    parts.push('table.details th{text-align:left;width:150px;color:#94a3b8;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;padding:6px 8px 6px 0;vertical-align:top}');
    parts.push('table.details td{padding:6px 0;border-bottom:1px solid #f1f5f9;color:#334155;word-break:break-word}');
    parts.push('table.details a{color:var(--accent);text-decoration:none}');
    parts.push('@media(max-width:860px){.wrap{grid-template-columns:1fr;padding:14px}.card{position:static}.gallery{grid-template-columns:1fr}}');
    parts.push('</style></head><body><div class="wrap">');

    parts.push('<aside class="card">');
    parts.push('<div class="icon">' + iconMarkup(app.appIconUrl, app.appName) + '</div>');
    parts.push('<h3>' + escHtml(app.appName || 'Untitled application') + '</h3>');
    parts.push('<p class="dev">by ' + escHtml(developerText) + '</p>');
    parts.push('<p class="short">' + escHtml(app.appShortDescription || 'No short description yet.') + '</p>');
    parts.push('<div class="chips">' + chipsHtml + '</div>');
    parts.push('<button class="install small" type="button">Install</button>');
    parts.push('<div class="meta-line">' + escHtml(liveText) + '</div>');
    parts.push('</aside>');

    parts.push('<main class="detail">');
    parts.push('<div class="hero">');
    parts.push('<div class="icon">' + iconMarkup(app.appIconUrl, app.appName) + '</div>');
    parts.push('<div><h1>' + escHtml(app.appName || 'Untitled application') + '</h1>');
    parts.push('<p>by ' + escHtml(developerText) + '</p>');
    parts.push('<div class="chips">' + chipsHtml + '</div></div>');
    parts.push('<div class="hero-spacer"></div>');
    parts.push('<div style="display:flex;flex-direction:column;gap:10px;align-items:flex-end">');
    parts.push('<span class="status ' + statusClass + '">' + escHtml(appStatusLabel(app.appStatus)) + '</span>');
    parts.push('<button class="install" type="button">Install</button>');
    parts.push('</div></div>');
    parts.push('<div class="gallery">' + galleryHtml + '</div>');
    parts.push('<div class="body">');
    parts.push('<h2>About this application</h2>' + descriptionToHtml(app.appDescription));
    parts.push(tagHtml);
    parts.push('<h2>What is new in ' + (live ? 'v' + escHtml(live.versionNumber) : 'the next release') + '</h2>' + notesHtml);
    parts.push('<h2>Application details</h2><table class="details">');
    parts.push('<tr><th>Developer</th><td>' + escHtml(developerText) + '</td></tr>');
    parts.push('<tr><th>Category</th><td>' + escHtml(categoryText) + '</td></tr>');
    parts.push('<tr><th>Languages</th><td>' + escHtml(languageText) + '</td></tr>');
    parts.push('<tr><th>License</th><td>' + escHtml(licenseLabel(app.licenseType)) + '</td></tr>');
    parts.push('<tr><th>Live version</th><td>' + escHtml(liveText) + '</td></tr>');
    parts.push(websiteRow + supportRow + privacyRow);
    parts.push('</table></div></main></div></body></html>');
    return parts.join('\n');
  }
  function buildLegacyPayload() {
    var app = DB.app;
    return {
      name: app.appName,
      appName: app.appName,
      appShortDescription: app.appShortDescription,
      developer: app.developerId || app.developerName,
      appCategory: app.appCategory,
      languages: app.languages.slice(),
      website: app.website,
      applicationVersions: sortedReleases().map(function (release) {
        return {
          fileUrl: release.files.map(function (file) {
            return { name: file.name, url: file.url, size: Number(file.size || 0) || 0, type: file.type || '' };
          }),
          fileUrls: release.files.map(function (file) { return file.url; }),
          versionNumber: release.versionNumber,
          sizeInKb: releaseSizeKb(release),
          releaseDate: release.releaseDate,
          languages: release.languages.slice(),
          iconUrl: release.iconUrl || app.appIconUrl,
          releaseNotes: release.releaseNotes,
          isEnabled: release.isEnabled
        };
      })
    };
  }
  function buildFullPayload() {
    return {
      schema: 'uniconhub-application-record',
      version: DB.version,
      app: JSON.parse(JSON.stringify(DB.app)),
      versions: JSON.parse(JSON.stringify(DB.versions)),
      docs: JSON.parse(JSON.stringify(DB.docs)),
      shots: JSON.parse(JSON.stringify(DB.shots)),
      tools: JSON.parse(JSON.stringify(DB.tools || [])),
      toolsMeta: JSON.parse(JSON.stringify(DB.toolsMeta || defaultToolsMeta())),
      meta: JSON.parse(JSON.stringify(DB.meta))
    };
  }
  function renderPayload() {
    var legacyElement = $('asi-payload-legacy');
    var fullElement = $('asi-payload-full');
    if (legacyElement) legacyElement.textContent = JSON.stringify(buildLegacyPayload(), null, 2);
    if (fullElement) fullElement.textContent = JSON.stringify(buildFullPayload(), null, 2);
  }
  function renderPreview() {
    _previewBuilt = true;
    var statusElement = $('asi-preview-status');
    if (_activePreviewView === 'payload') {
      renderPayload();
      if (statusElement) {
        statusElement.textContent = 'Payload refreshed ' + formatTime(new Date());
        statusElement.className = 'asi-preview-status ok';
      }
    } else {
      var frame = $('asi-preview-frame');
      if (frame) frame.srcdoc = buildListingPreviewDoc();
      if (statusElement) {
        statusElement.textContent = 'Store listing rebuilt ' + formatTime(new Date());
        statusElement.className = 'asi-preview-status ok';
      }
    }
    renderReadiness();
    try { tool.resize(); } catch (error) {}
  }
  function setPreviewView(view) {
    _activePreviewView = view === 'payload' ? 'payload' : 'listing';
    var listingElement = $('asi-preview-listing');
    var payloadElement = $('asi-preview-payload');
    var listingButton = $('asi-preview-tab-listing');
    var payloadButton = $('asi-preview-tab-payload');
    if (listingElement) listingElement.style.display = _activePreviewView === 'listing' ? '' : 'none';
    if (payloadElement) payloadElement.style.display = _activePreviewView === 'payload' ? '' : 'none';
    if (listingButton) listingButton.classList.toggle('active', _activePreviewView === 'listing');
    if (payloadButton) payloadButton.classList.toggle('active', _activePreviewView === 'payload');
    if (_previewBuilt) renderPreview();
  }
  function schedulePreviewRefresh() {
    if (_activeTab !== 'preview') return;
    clearTimeout(_previewTimer);
    _previewTimer = setTimeout(function () {
      if (_activeTab === 'preview') renderPreview();
    }, 350);
  }

  /* --------------------------------------------------------
     Documents (webpage / help / updates / presentation / social)
  -------------------------------------------------------- */
  function defaultDocMemory(docKey) {
    if (docKey === 'social') return { contentHtml: '', loaded: false, dirty: false };
    return { html: '', css: '', js: '', seo: defaultSeo(), loaded: false, dirty: false };
  }
  function docMemory(docKey) {
    if (!_docsMemory[docKey]) _docsMemory[docKey] = defaultDocMemory(docKey);
    return _docsMemory[docKey];
  }
  function docTargetType(docKey) {
    var configured = docKey === 'social'
      ? readParam('socialTargetType', DEFAULT_SOCIAL_TARGET_TYPE)
      : readParam('pageTargetType', DEFAULT_PAGE_TARGET_TYPE);
    return legacyToCurrentType(configured) || (docKey === 'social' ? DEFAULT_SOCIAL_TARGET_TYPE : DEFAULT_PAGE_TARGET_TYPE);
  }
  function legacyToCurrentType(typeName) {
    if (!typeName) return '';
    return {
      'htl-demo-pages-uniconbaseapps': DEFAULT_PAGE_TARGET_TYPE,
      'htl-demo-social-uniconbaseapps': DEFAULT_SOCIAL_TARGET_TYPE
    }[typeName] || typeName;
  }
  function leafTypeIdOf(docKey) {
    var folderMap = safeJsonObject(readParam('docsFolderTypeMap', JSON.stringify(DEFAULT_DOCS_FOLDER_TYPE_MAP)));
    if (docKey) {
      var mappedFolder = String(folderMap[docKey] || '').trim();
      if (mappedFolder) return mappedFolder;
    }
    return String(readParam('docsFolderTypeId', '') || '').trim();
  }
  function objectsApiAvailable() {
    return typeof tool.requestObjects === 'function';
  }
  function objectDcb(cmsObject) {
    if (!cmsObject || typeof cmsObject !== 'object') return {};
    if (cmsObject.productData && cmsObject.productData.data_categoriesBased) return cmsObject.productData.data_categoriesBased;
    if (cmsObject.objectData && cmsObject.objectData.data_categoriesBased) return cmsObject.objectData.data_categoriesBased;
    return {};
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
    return displayNameOfApp() + ' - ' + DOC_LABELS[docKey];
  }
  function docSlugOf(docKey) {
    return appSlugOf() + '-' + docKey;
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
  function contentSignature(docKey) {
    var doc = docMemory(docKey);
    if (docKey === 'social') return JSON.stringify({ contentHtml: String(doc.contentHtml || '') });
    var seo = {};
    SEO_FIELDS.forEach(function (seoField) { if (doc.seo[seoField]) seo[seoField] = doc.seo[seoField]; });
    return JSON.stringify({ html: String(doc.html || ''), css: String(doc.css || ''), js: String(doc.js || ''), seo: seo });
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
    if (fieldMap.updatedAt) payload[fieldMap.updatedAt] = timestampNow();
    return { name: docDisplayName(docKey), payload: payload };
  }
  function remoteSignature(docKey, cmsObject) {
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
  function userNameOf() {
    var user = _user || getUserSafe();
    return (user && (user.name || user.id)) || 'user';
  }

  function docPartNamesOf(docKey) {
    return docKey === 'social' ? ['preview', 'content'] : ['preview', 'html', 'css', 'js', 'seo'];
  }
  function buildDocPaneHtml(docKey) {
    var isSocial = docKey === 'social';
    var parts = [];
    parts.push('<div class="asi-doc-head">'
      + '<div class="asi-doc-head-main">'
      + '<span class="asi-doc-title">' + DOC_LABELS[docKey] + ' document</span>'
      + '<span class="asi-doc-subline" id="asi-doc-subline-' + docKey + '">Save writes this document to a CMS object of type <code>' + escHtml(docTargetType(docKey)) + '</code> (slug <code>' + escHtml(docSlugOf(docKey)) + '</code>). Reload reads the saved object content back into the editor.</span>'
      + '</div>'
      + '<span class="asi-doc-status" id="asi-doc-status-' + docKey + '">New document - not saved yet</span>'
      + '<span class="asi-doc-actions">'
      + '<button class="asi-btn asi-btn-primary asi-btn-sm" type="button" data-act="doc-save" data-doc="' + docKey + '" title="Create or update the ' + escHtml(docTargetType(docKey)) + ' object with this document">⇪ Save document</button>'
      + '<button class="asi-btn asi-btn-ghost asi-btn-sm" type="button" data-act="doc-reload" data-doc="' + docKey + '" title="Load the saved content from the ' + escHtml(docTargetType(docKey)) + ' object into the editor">↻ Reload from object</button>'
      + '</span></div>');
    var partDefinitions = isSocial
      ? [['preview', 'Preview'], ['content', 'HTML']]
      : [['preview', 'Preview'], ['html', 'HTML'], ['css', 'CSS'], ['js', 'JS'], ['seo', 'SEO']];
    parts.push('<div class="asi-doc-workspace"><div class="asi-doc-sub-tabs">');
    partDefinitions.forEach(function (partInfo) {
      parts.push('<button class="asi-doc-sub-tab" type="button" data-doc-part="' + partInfo[0] + '" data-doc="' + docKey + '">' + partInfo[1] + '</button>');
    });
    parts.push('</div>');
    if (isSocial) {
      parts.push('<div class="asi-doc-part" id="asi-doc-part-social-content">'
        + '<div class="asi-editor">'
        + '<div class="asi-editor-head">'
        + '<span class="asi-editor-title">Share kit HTML</span>'
        + '<span class="asi-editor-hint">Full standalone document - this is NOT a website page. Prepared for social media integrations.</span>'
        + '<span class="asi-editor-meta" id="asi-doc-meta-social-content">0 lines · 0 chars</span>'
        + '</div>'
        + '<div class="asi-editor-body">'
        + '<pre class="asi-gutter" id="asi-doc-gutter-social-content" aria-hidden="true">1</pre>'
        + '<textarea class="asi-code asi-code-sm" id="asi-doc-social-content" data-doc-field="social.contentHtml" spellcheck="false" wrap="off" placeholder="Paste the full social share document here"></textarea>'
        + '</div></div></div>');
    } else {
      var docParts = [
        ['html', 'HTML fragment', 'One root div - no html/head/body tags. The whole content lives under a single wrapper div.'],
        ['css', 'CSS', 'Scoped stylesheet rules only - no style tag.'],
        ['js', 'JS', 'Idempotent JavaScript only - no script tag.']
      ];
      docParts.forEach(function (partInfo) {
        parts.push('<div class="asi-doc-part" id="asi-doc-part-' + docKey + '-' + partInfo[0] + '">'
          + '<div class="asi-editor">'
          + '<div class="asi-editor-head">'
          + '<span class="asi-editor-title">' + partInfo[1] + '</span>'
          + '<span class="asi-editor-hint">' + partInfo[2] + '</span>'
          + '<span class="asi-editor-meta" id="asi-doc-meta-' + docKey + '-' + partInfo[0] + '">0 lines · 0 chars</span>'
          + '</div>'
          + '<div class="asi-editor-body">'
          + '<pre class="asi-gutter" id="asi-doc-gutter-' + docKey + '-' + partInfo[0] + '" aria-hidden="true">1</pre>'
          + '<textarea class="asi-code asi-code-sm" id="asi-doc-' + docKey + '-' + partInfo[0] + '" data-doc-field="' + docKey + '.' + partInfo[0] + '" spellcheck="false" wrap="off" placeholder="..."></textarea>'
          + '</div></div></div>');
      });
      parts.push('<div class="asi-doc-part" id="asi-doc-part-' + docKey + '-seo"><div class="asi-seo-grid">');
      SEO_FIELDS.forEach(function (seoField) {
        parts.push('<div class="asi-field">'
          + '<label for="asi-doc-' + docKey + '-' + seoField + '">' + SEO_LABELS[seoField] + '</label>'
          + '<input class="asi-input" id="asi-doc-' + docKey + '-' + seoField + '" data-doc-field="' + docKey + '.seo.' + seoField + '" placeholder="...">'
          + '</div>');
      });
      parts.push('</div></div>');
    }
    parts.push('<div class="asi-doc-part" id="asi-doc-part-' + docKey + '-preview">'
      + '<div class="asi-preview-bar asi-doc-preview-bar">'
      + '<button class="asi-btn asi-btn-primary asi-btn-sm" type="button" data-act="doc-preview" data-doc="' + docKey + '">▶ Rebuild preview</button>'
      + '<span class="asi-hint">Sandboxed preview of this document. Page documents preview as a full page around the fragment; social previews as-is.</span>'
      + '<span class="asi-preview-status" id="asi-doc-preview-status-' + docKey + '">Not built yet</span>'
      + '</div>'
      + '<div class="asi-preview-frame-wrap">'
      + '<iframe class="asi-preview-frame asi-doc-preview-frame" id="asi-doc-preview-frame-' + docKey + '" sandbox="allow-scripts allow-forms allow-downloads allow-popups" title="Document preview"></iframe>'
      + '</div></div>');
    parts.push('</div>');
    return parts.join('');
  }
  function setActiveDocPart(docKey, partName) {
    if (partName) _activeDocPart[docKey] = partName;
    if (!_activeDocPart[docKey]) _activeDocPart[docKey] = 'preview';
    var activePart = _activeDocPart[docKey];
    var pane = $('asi-doc-pane-' + docKey);
    if (pane) {
      var partButtons = pane.querySelectorAll('.asi-doc-sub-tab');
      for (var buttonIndex = 0; buttonIndex < partButtons.length; buttonIndex++) {
        partButtons[buttonIndex].classList.toggle('active', partButtons[buttonIndex].getAttribute('data-doc-part') === activePart);
      }
    }
    docPartNamesOf(docKey).forEach(function (partNameItem) {
      var partElement = $('asi-doc-part-' + docKey + '-' + partNameItem);
      if (partElement) partElement.style.display = partNameItem === activePart ? '' : 'none';
    });
    if (activePart === 'preview' && docKey === _activeDocKey) renderDocPreview();
  }
  function bindDocPaneScrolls(docKey) {
    var parts = docKey === 'social' ? ['content'] : ['html', 'css', 'js'];
    parts.forEach(function (part) {
      var textarea = $('asi-doc-' + docKey + '-' + part);
      var gutter = $('asi-doc-gutter-' + docKey + '-' + part);
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
    var tabsElement = $('asi-doc-tabs');
    var contentElement = $('asi-doc-content');
    if (!tabsElement || !contentElement) return;
    if (!tabsElement.getAttribute('data-built')) {
      tabsElement.setAttribute('data-built', '1');
      tabsElement.innerHTML = DOC_KEYS.map(function (docKey) {
        return '<button class="asi-doc-tab" type="button" data-doc-tab="' + docKey + '">' + DOC_LABELS[docKey] + '</button>';
      }).join('');
      DOC_KEYS.forEach(function (docKey) {
        var pane = document.createElement('div');
        pane.className = 'asi-doc-pane';
        pane.id = 'asi-doc-pane-' + docKey;
        pane.innerHTML = buildDocPaneHtml(docKey);
        contentElement.appendChild(pane);
        bindDocPaneScrolls(docKey);
        setActiveDocPart(docKey);
      });
    }
    DOC_KEYS.forEach(function (docKey) {
      var pane = $('asi-doc-pane-' + docKey);
      if (pane) pane.style.display = docKey === _activeDocKey ? '' : 'none';
    });
    var tabButtons = tabsElement.querySelectorAll('.asi-doc-tab');
    for (var tabIndex = 0; tabIndex < tabButtons.length; tabIndex++) {
      tabButtons[tabIndex].classList.toggle('active', tabButtons[tabIndex].getAttribute('data-doc-tab') === _activeDocKey);
    }
    setActiveDocPart(_activeDocKey);
    renderTargetSummary();
    refreshDocPaneValues();
    openDoc(_activeDocKey);
  }
  function renderTargetSummary() {
    var pageElement = $('asi-target-page-type');
    var socialElement = $('asi-target-social-type');
    var leafElement = $('asi-target-leaf-folder');
    var noteElement = $('asi-doc-object-note');
    if (pageElement) pageElement.textContent = docTargetType('webpage');
    if (socialElement) socialElement.textContent = docTargetType('social');
    if (leafElement) {
      leafElement.textContent = DOC_KEYS.map(function (folderKey) {
        return folderKey + ' → ' + (leafTypeIdOf(folderKey) || '(app default)');
      }).join(' · ');
    }
    if (noteElement) {
      noteElement.textContent = objectsApiAvailable()
        ? 'Object API available - Save writes each document into its own CMS object in the mapped folder.'
        : 'Object API NOT available here (allowObjectCRUD off) - Save and Reload stay disabled until the field settings allow it.';
    }
  }
  function updateDocEditorMeta(docKey, part) {
    var textarea = $('asi-doc-' + docKey + '-' + part);
    var metaElement = $('asi-doc-meta-' + docKey + '-' + part);
    if (!textarea || !metaElement) return;
    var text = textarea.value || '';
    var lineCount = text ? text.split('\n').length : 1;
    metaElement.textContent = lineCount + ' lines · ' + text.length + ' chars';
  }
  function updateDocGutter(docKey, part) {
    var textarea = $('asi-doc-' + docKey + '-' + part);
    var gutter = $('asi-doc-gutter-' + docKey + '-' + part);
    if (!textarea || !gutter) return;
    var lineCount = textarea.value ? textarea.value.split('\n').length : 1;
    var numbers = [];
    for (var lineNumber = 1; lineNumber <= lineCount; lineNumber++) numbers.push(lineNumber);
    gutter.textContent = numbers.join('\n');
    gutter.scrollTop = textarea.scrollTop;
  }
  function refreshDocPaneValues() {
    DOC_KEYS.forEach(function (docKey) {
      var doc = docMemory(docKey);
      var subline = $('asi-doc-subline-' + docKey);
      if (subline) {
        subline.innerHTML = 'Save writes this document to a CMS object of type <code>' + escHtml(docTargetType(docKey)) + '</code> (slug <code>' + escHtml(docSlugOf(docKey)) + '</code>). Reload reads the saved object content back into the editor.';
      }
      if (docKey === 'social') {
        var socialTextarea = $('asi-doc-social-content');
        if (socialTextarea && document.activeElement !== socialTextarea) socialTextarea.value = doc.contentHtml;
        updateDocEditorMeta(docKey, 'content');
        updateDocGutter(docKey, 'content');
      } else {
        ['html', 'css', 'js'].forEach(function (part) {
          var textarea = $('asi-doc-' + docKey + '-' + part);
          if (textarea && document.activeElement !== textarea) textarea.value = doc[part];
          updateDocEditorMeta(docKey, part);
          updateDocGutter(docKey, part);
        });
        SEO_FIELDS.forEach(function (seoField) {
          var inputElement = $('asi-doc-' + docKey + '-' + seoField);
          if (inputElement && document.activeElement !== inputElement) inputElement.value = doc.seo[seoField];
        });
      }
      renderDocStatus(docKey);
    });
  }
  function renderDocStatus(docKey) {
    var statusElement = $('asi-doc-status-' + docKey);
    if (!statusElement) return;
    var target = DB.docs[docKey].target;
    var memory = docMemory(docKey);
    if (target && target.objectId) {
      var dirty = memory.dirty || contentSignature(docKey) !== (target.pushedSignature || '');
      statusElement.textContent = target.objectType + ' · ' + target.objectId
        + ' · saved ' + (target.pushedAt ? formatDateTime(target.pushedAt) : '?')
        + (dirty ? ' · not saved' : '');
      statusElement.className = 'asi-doc-status' + (dirty ? ' dirty' : ' ok');
    } else {
      statusElement.textContent = memory.dirty ? 'New - modified, not saved yet' : 'New document - not saved yet';
      statusElement.className = 'asi-doc-status' + (memory.dirty ? ' dirty' : '');
    }
  }
  function handleDocInput(event) {
    var element = event.target;
    if (!element || !element.getAttribute) return;
    var fieldPath = element.getAttribute('data-doc-field');
    if (!fieldPath) return;
    var pieces = fieldPath.split('.');
    var docKey = pieces[0];
    if (DOC_KEYS.indexOf(docKey) === -1) return;
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
  function checkJsSyntax(codeText) {
    var source = String(codeText || '');
    if (!source.trim()) return null;
    try { new Function(source); return null; } catch (error) {
      return String(error && error.message ? error.message : error);
    }
  }
  function renderDocPreview() {
    var frame = $('asi-doc-preview-frame-' + _activeDocKey);
    var statusElement = $('asi-doc-preview-status-' + _activeDocKey);
    if (!frame) return;
    var built = buildDocPreviewDoc(_activeDocKey);
    frame.srcdoc = built.doc;
    if (statusElement) {
      if (built.jsSyntaxError) {
        statusElement.textContent = 'JS syntax error: ' + built.jsSyntaxError;
        statusElement.className = 'asi-preview-status err';
      } else {
        statusElement.textContent = DOC_LABELS[_activeDocKey] + ' preview rebuilt ' + formatTime(new Date());
        statusElement.className = 'asi-preview-status ok';
      }
    }
    try { tool.resize(); } catch (error) {}
  }
  function openDoc(docKey) {
    var memory = docMemory(docKey);
    if (memory.loaded) return;
    var target = DB.docs[docKey].target || null;
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
      var currentTarget = DB.docs[docKey].target || {};
      DB.docs[docKey].target = {
        objectType: objectType,
        objectId: cmsObject.id || cmsObject._id,
        name: cmsObject.name || '',
        slug: currentTarget.slug || docSlugOf(docKey),
        folderTypeId: currentTarget.folderTypeId || '',
        pushedAt: cmsObject.updated || timestampNow(),
        pushedSignature: remoteSignature(docKey, cmsObject)
      };
      persist();
      refreshDocPaneValues();
      logDiagnostics('doc-open-' + docKey, 'loaded ' + objectType + ' ' + (cmsObject.id || '?'));
    });
  }
  function saveDoc(docKey) {
    if (!canWrite()) { notify('Read-only - saving documents is disabled.', 'warning'); return; }
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
    var target = DB.docs[docKey].target || null;
    logDiagnostics('doc-save-' + docKey, 'saving to ' + objectType + ' folder=' + (leafTypeId || 'default') + ' slug=' + slug + ' target=' + (target && target.objectId ? target.objectId : 'none'));

    function finishSave(cmsObject) {
      DB.docs[docKey].target = {
        objectType: objectType,
        objectId: cmsObject.id || cmsObject._id,
        name: built.name,
        slug: slug,
        folderTypeId: leafTypeId,
        pushedAt: timestampNow(),
        pushedSignature: signature
      };
      memory.dirty = false;
      _docPushArmed[docKey] = false;
      persist();
      renderDocStatus(docKey);
      logActivity('Document saved', DOC_LABELS[docKey] + ' -> ' + objectType);
      notify(DOC_LABELS[docKey] + ' saved to its own ' + (docKey === 'social' ? 'social object' : 'page object (with SEO)') + '.', 'success');
    }

    function performWrite(existingObject) {
      if (existingObject) {
        var remoteSignatureValue = remoteSignature(docKey, existingObject);
        if (target && target.pushedSignature && target.pushedSignature !== remoteSignatureValue && !_docPushArmed[docKey]) {
          _docPushArmed[docKey] = true;
          clearTimeout(_docPushArmTimers[docKey]);
          _docPushArmTimers[docKey] = setTimeout(function () { _docPushArmed[docKey] = false; }, 8000);
          logDiagnostics('doc-save-' + docKey, 'target changed outside - click Save again to overwrite');
          notify('The ' + DOC_LABELS[docKey] + ' object changed outside the editor. Click Save again within 8 seconds to overwrite.', 'warning');
          return;
        }
        tool.requestObjects('update', { mainObjectType: objectType, objectId: existingObject.id || existingObject._id, productData: { data_categoriesBased: built.payload } }, function (updateError) {
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
        DB.docs[docKey].target = {
          objectType: objectType,
          objectId: newObject.id || newObject._id,
          name: built.name,
          slug: slug,
          folderTypeId: newFolderTypeId,
          pushedAt: timestampNow(),
          pushedSignature: signature
        };
        memory.dirty = false;
        _docPushArmed[docKey] = false;
        persist();
        renderDocStatus(docKey);
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
    var target = DB.docs[docKey].target || null;
    logDiagnostics('doc-reload-' + docKey, 'reloading from ' + objectType + ' slug=' + slug);

    function applyObject(cmsObject) {
      if (!cmsObject) {
        notify('No ' + DOC_LABELS[docKey] + ' object found with slug "' + slug + '". Save it first to create it.', 'warning');
        return;
      }
      if (docKey === 'social') applySocialObjectToMemory(docKey, cmsObject);
      else applyPageObjectToMemory(docKey, cmsObject);
      memory.loaded = true;
      memory.dirty = false;
      DB.docs[docKey].target = {
        objectType: objectType,
        objectId: cmsObject.id || cmsObject._id,
        name: cmsObject.name || '',
        slug: slug,
        folderTypeId: (target && target.folderTypeId) ? target.folderTypeId : leafTypeIdOf(docKey),
        pushedAt: cmsObject.updated || timestampNow(),
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

  /* --------------------------------------------------------
     Tool catalog: source -> selection -> documentation/publish
     The catalog is READ from source (never embedded): the parent
     CMS relay, a CMS object, the local cache, or an imported file.
     Only the SELECTION is stored in this record.
  -------------------------------------------------------- */
  var CATALOG_PAGE_SIZE = 60;
  var CATALOG_CACHE_KEY = 'uniconhub_app_tool_catalog_v1';
  var CATALOG_CACHE_MAX_BYTES = 2 * 1024 * 1024;
  var DEFAULT_CATALOG_URL = '../tools-catalog/tool-catalog-bundle.json';
  var TOOL_LIMIT = 400;

  var TOOL_STATUSES = [
    { id: 'queued', label: 'Queued for build' },
    { id: 'planned', label: 'Planned' },
    { id: 'developing', label: 'Developing' },
    { id: 'documenting', label: 'Documenting' },
    { id: 'ready', label: 'Ready to publish' },
    { id: 'published', label: 'Published' },
    { id: 'skipped', label: 'Skipped' }
  ];
  var TOOL_PRIORITIES = [
    { id: 'none', label: 'Priority: -' },
    { id: 'low', label: 'Priority: Low' },
    { id: 'medium', label: 'Priority: Medium' },
    { id: 'high', label: 'Priority: High' }
  ];
  var PUBLISH_SUBJECTS = [
    { id: 'code', label: 'Code' },
    { id: 'harness', label: 'Test harness' },
    { id: 'screenshots', label: 'Screenshots' },
    { id: 'webpage', label: 'Webpage' },
    { id: 'help', label: 'Help' },
    { id: 'presentation', label: 'Presentation' },
    { id: 'updates', label: 'Updates' },
    { id: 'social', label: 'Social' }
  ];
  var LICENSING_LABELS = {
    'freemium': 'Freemium',
    'subscription-monthly': 'Monthly subscription',
    'subscription-annual': 'Annual subscription',
    'one-time': 'One-time purchase',
    'per-seat-monthly': 'Per-seat monthly',
    'usage-based': 'Usage based',
    'white-label': 'White label',
    'app-bundle': 'App bundle'
  };

  var _catalog = {
    state: 'idle', source: 'none', sourceLabel: 'not loaded', url: '', error: '',
    loadedAt: '', generatedAt: '', catalogVersion: '', hasBuildState: false,
    ideas: [], byId: {}, built: {}, publish: {}
  };
  var _catalogFilters = { search: '', group: 'all', licensing: 'all', state: 'all' };
  var _catalogLimit = CATALOG_PAGE_SIZE;
  var _catalogBusy = false;

  function statusMetaOf(statusId) {
    for (var index = 0; index < TOOL_STATUSES.length; index++) {
      if (TOOL_STATUSES[index].id === statusId) return TOOL_STATUSES[index];
    }
    return TOOL_STATUSES[0];
  }
  function statusIdOf(value) {
    var text = String(value == null ? '' : value).trim();
    for (var index = 0; index < TOOL_STATUSES.length; index++) {
      if (TOOL_STATUSES[index].id === text) return text;
    }
    return 'queued';
  }
  function priorityIdOf(value) {
    var text = String(value == null ? '' : value).trim();
    for (var index = 0; index < TOOL_PRIORITIES.length; index++) {
      if (TOOL_PRIORITIES[index].id === text) return text;
    }
    return 'none';
  }
  function licensingLabelOf(value) {
    var text = String(value == null ? '' : value).trim();
    return LICENSING_LABELS[text] || text || '-';
  }

  /* ---- selection stored in the record ---- */
  function normalizeToolEntry(rawValue) {
    if (!rawValue || typeof rawValue !== 'object') return null;
    var key = normalizeText(rawValue.key || rawValue.id || rawValue.code, 120);
    if (!key) return null;
    return {
      key: key,
      code: normalizeText(rawValue.code, 40),
      name: normalizeText(rawValue.name, 200),
      purpose: normalizeText(rawValue.purpose, 400),
      licensing: normalizeText(rawValue.licensing, 60),
      group: normalizeText(rawValue.group, 80),
      category: normalizeText(rawValue.category, 120),
      folder: normalizeText(rawValue.folder, 120),
      status: statusIdOf(rawValue.status),
      priority: priorityIdOf(rawValue.priority),
      notes: normalizeText(rawValue.notes, 600),
      addedAt: normalizeText(rawValue.addedAt, 40),
      updatedAt: normalizeText(rawValue.updatedAt, 40)
    };
  }
  function normalizeTools(rawValue) {
    if (!Array.isArray(rawValue)) return [];
    var seen = {};
    var list = [];
    rawValue.forEach(function (entry) {
      var normalizedEntry = normalizeToolEntry(entry);
      if (!normalizedEntry || seen[normalizedEntry.key]) return;
      seen[normalizedEntry.key] = true;
      list.push(normalizedEntry);
    });
    return list.slice(0, TOOL_LIMIT);
  }
  function defaultToolsMeta() {
    return { catalogVersion: '', catalogCount: 0, source: '', loadedAt: '', updatedAt: '' };
  }
  function toolsOf() {
    if (!DB) return [];
    if (!Array.isArray(DB.tools)) DB.tools = [];
    return DB.tools;
  }
  function toolEntryByKey(key) {
    var list = toolsOf();
    for (var index = 0; index < list.length; index++) {
      if (list[index].key === key) return list[index];
    }
    return null;
  }

  /* ---- catalog indexes ---- */
  function indexCatalog() {
    _catalog.byId = {};
    _catalog.ideas.forEach(function (idea) { _catalog.byId[idea.id] = idea; });
  }
  function catalogIdeaById(ideaKey) {
    return _catalog.byId[ideaKey] || null;
  }
  function catalogBuildOf(ideaKey) {
    var build = _catalog.built[ideaKey];
    return (build && typeof build === 'object') ? build : null;
  }
  function catalogFolderOf(ideaKey, fallbackFolder) {
    var build = catalogBuildOf(ideaKey);
    if (build && build.folder) return build.folder;
    return fallbackFolder || '';
  }
  function publishStateOfFolder(folder) {
    var state = { version: '', publishedAt: '', subjects: {} };
    if (!folder) return state;
    var tools = (_catalog.publish && _catalog.publish.tools) || {};
    var saved = tools[folder];
    if (saved && typeof saved === 'object') {
      state.version = normalizeText(saved.version, 40);
      state.publishedAt = normalizeText(saved.publishedAt, 40);
      var subjects = saved.subjects || {};
      Object.keys(subjects).forEach(function (subjectKey) { state.subjects[subjectKey] = !!subjects[subjectKey]; });
    }
    return state;
  }
  function publishedCountOf(state) {
    var count = 0;
    PUBLISH_SUBJECTS.forEach(function (subject) { if (state.subjects[subject.id]) count++; });
    return count;
  }
  function publishedStateOfTool(entry) {
    var folder = catalogFolderOf(entry.key, entry.folder);
    return publishStateOfFolder(folder);
  }
  function docsLabelOf(ideaKey) {
    var build = catalogBuildOf(ideaKey);
    if (!build) return '';
    var total = build.docsTotal || 7;
    return (build.docsCount || 0) + '/' + total;
  }
  function docsCompleteOf(ideaKey) {
    var build = catalogBuildOf(ideaKey);
    if (!build) return false;
    return (build.docsCount || 0) >= (build.docsTotal || 7);
  }

  /* ---- catalog ingestion ---- */
  function flattenIdeaGroups(groups) {
    var ideas = [];
    if (!Array.isArray(groups)) return ideas;
    groups.forEach(function (group) {
      var categories = group && Array.isArray(group.categories) ? group.categories : [];
      categories.forEach(function (category) {
        var categoryIdeas = category && Array.isArray(category.ideas) ? category.ideas : [];
        categoryIdeas.forEach(function (idea, ideaIndex) {
          if (!idea || typeof idea !== 'object') return;
          var code = normalizeText(idea.code || idea.id, 40);
          if (!code) return;
          var ideaId = normalizeText(idea.id, 120) || (code + (ideaIndex ? ('-' + ideaIndex) : ''));
          ideas.push({
            id: ideaId,
            code: code,
            name: normalizeText(idea.name, 200),
            purpose: normalizeText(idea.purpose, 400),
            users: normalizeText(idea.users, 120),
            tam: normalizeText(idea.tam, 40),
            sam: normalizeText(idea.sam, 40),
            som: normalizeText(idea.som, 40),
            licensing: normalizeText(idea.licensing, 60),
            sub: normalizeText(idea.sub, 160),
            groupKey: normalizeText(group.key, 40),
            groupLabel: normalizeText(group.label, 80),
            categoryKey: normalizeText(category.key, 40),
            categoryLabel: normalizeText(category.label, 120)
          });
        });
      });
    });
    return ideas;
  }
  function flattenIdeaRows(rows) {
    var ideas = [];
    if (!Array.isArray(rows)) return ideas;
    rows.forEach(function (idea, ideaIndex) {
      if (!idea || typeof idea !== 'object') return;
      var code = normalizeText(idea.code || idea.id, 40);
      if (!code) return;
      var ideaId = normalizeText(idea.id, 120) || (code + (ideaIndex ? ('-' + ideaIndex) : ''));
      ideas.push({
        id: ideaId,
        code: code,
        name: normalizeText(idea.name, 200),
        purpose: normalizeText(idea.purpose, 400),
        users: normalizeText(idea.users, 120),
        tam: normalizeText(idea.tam, 40),
        sam: normalizeText(idea.sam, 40),
        som: normalizeText(idea.som, 40),
        licensing: normalizeText(idea.licensing, 60),
        sub: normalizeText(idea.sub, 160),
        groupKey: '',
        groupLabel: '',
        categoryKey: '',
        categoryLabel: ''
      });
    });
    return ideas;
  }
  function ingestCatalogPayload(payload, meta) {
    var bundle = payload;
    if (bundle && bundle.catalog && typeof bundle.catalog === 'object') bundle = bundle.catalog;
    if (typeof bundle === 'string') {
      var parsed = parseJsonLenient(bundle);
      if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'The catalog is not valid JSON.' };
      bundle = parsed;
    }
    if (!bundle || typeof bundle !== 'object') return { ok: false, error: 'The catalog payload is empty.' };

    var ideas = [];
    var hasBuildState = false;
    if (Array.isArray(bundle.groups)) {
      ideas = flattenIdeaGroups(bundle.groups);
      hasBuildState = true;
    } else if (Array.isArray(bundle.ideas)) {
      ideas = flattenIdeaRows(bundle.ideas);
    } else {
      return { ok: false, error: 'The catalog has neither a groups nor an ideas list.' };
    }
    if (!ideas.length) return { ok: false, error: 'The catalog lists no ideas.' };

    _catalog.ideas = ideas;
    _catalog.built = (bundle.built && typeof bundle.built === 'object') ? bundle.built : {};
    _catalog.publish = (bundle.publish && typeof bundle.publish === 'object') ? bundle.publish : { tools: {} };
    _catalog.hasBuildState = hasBuildState && Object.keys(_catalog.built).length > 0;
    _catalog.generatedAt = normalizeText(bundle.generatedAt, 40);
    _catalog.catalogVersion = normalizeText(bundle.catalogVersion || bundle.version, 40);
    _catalog.loadedAt = timestampNow();
    _catalog.source = meta && meta.source ? meta.source : 'relay';
    _catalog.sourceLabel = (meta && meta.label) || _catalog.source;
    _catalog.url = (meta && meta.url) || '';
    _catalog.error = '';
    _catalog.state = 'ready';
    indexCatalog();
    _catalogLimit = CATALOG_PAGE_SIZE;
    if (DB) {
      DB.toolsMeta = {
        catalogVersion: _catalog.catalogVersion,
        catalogCount: _catalog.ideas.length,
        source: _catalog.sourceLabel,
        loadedAt: _catalog.loadedAt,
        updatedAt: timestampNow()
      };
      persist();
    }
    logActivity('Catalog loaded', _catalog.ideas.length + ' ideas from ' + _catalog.sourceLabel);
    return { ok: true };
  }
  function cacheCatalogText(text) {
    if (!text || text.length > CATALOG_CACHE_MAX_BYTES) return;
    try { localStorage.setItem(CATALOG_CACHE_KEY, text); } catch (error) {}
  }
  function readCachedCatalogText() {
    try { return localStorage.getItem(CATALOG_CACHE_KEY) || ''; } catch (error) { return ''; }
  }
  function catalogObjectPayload(objectRecord) {
    var values = extractFieldValues(objectRecord);
    var names = ['catalogJson', 'catalog', 'payload', 'json', 'contentHtml', 'description'];
    for (var index = 0; index < names.length; index++) {
      var rawValue = values[names[index]];
      if (typeof rawValue === 'string' && rawValue.length > 40) {
        var parsed = parseJsonLenient(rawValue);
        if (parsed && typeof parsed === 'object' && (Array.isArray(parsed.groups) || Array.isArray(parsed.ideas))) return rawValue;
      }
      if (rawValue && typeof rawValue === 'object' && (Array.isArray(rawValue.groups) || Array.isArray(rawValue.ideas))) {
        return rawValue;
      }
    }
    return null;
  }
  function finishCatalogLoad(errorText) {
    _catalogBusy = false;
    if (errorText) {
      _catalog.state = 'error';
      _catalog.error = errorText;
      logDiagnostics('catalog', errorText);
    }
    renderToolsTab();
    try { tool.resize(); } catch (error) {}
  }
  function loadCatalog() {
    if (_catalogBusy || !DB) return;
    _catalogBusy = true;
    _catalog.state = 'loading';
    _catalog.error = '';
    renderToolsTab();
    var objectType = String(readParam('catalogObjectType', '') || '').trim();
    var wantedSlug = String(readParam('catalogSlug', '') || '').trim();
    var url = String(readParam('catalogUrl', DEFAULT_CATALOG_URL) || '').trim() || DEFAULT_CATALOG_URL;
    var routeNames = [];
    if (objectType) routeNames.push('object');
    if (url && typeof tool.requestFetch === 'function') routeNames.push('relay');
    var objectRouteTried = false;

    function tryCached(reason) {
      var cachedText = readCachedCatalogText();
      if (cachedText) {
        var cachedResult = ingestCatalogPayload(cachedText, { source: 'cache', label: 'cached copy', url: '' });
        if (cachedResult.ok) {
          _catalog.sourceLabel = 'cached copy';
          finishCatalogLoad('');
          return;
        }
      }
      finishCatalogLoad(reason || 'The catalog could not be loaded. Import the JSON file to continue.');
    }
    function tryRelay() {
      if (routeNames.indexOf('relay') === -1) { tryCached(''); return; }
      tool.requestFetch(url, { method: 'GET', timeoutMs: 20000, maxBytes: CATALOG_CACHE_MAX_BYTES }, function (relayError, relayResponse) {
        var text = relayResponse && typeof relayResponse.text === 'string' ? relayResponse.text : '';
        if (relayError || !text) {
          logDiagnostics('catalog', 'relay failed for ' + url + ': ' + (relayError || 'empty response'));
          if (objectRouteTried) { tryCached('The catalog could not be loaded. Import the JSON file to continue.'); return; }
          tryObjectRoute('The catalog could not be loaded from ' + url + '. Import the JSON file to continue.');
          return;
        }
        var relayResult = ingestCatalogPayload(text, { source: 'relay', label: 'catalog URL', url: url });
        if (!relayResult.ok) {
          if (objectRouteTried) { tryCached(relayResult.error); return; }
          tryObjectRoute(relayResult.error);
          return;
        }
        cacheCatalogText(text);
        finishCatalogLoad('');
      });
    }
    function tryObjectRoute(reason, nextStep) {
      var fallback = typeof nextStep === 'function' ? nextStep : tryCached;
      objectRouteTried = true;
      if (!objectType || typeof tool.requestObjects !== 'function') { fallback(reason); return; }
      tool.requestObjects('query', { mainObjectType: objectType }, function (objectError, objectResponse) {
        if (objectError) { fallback(reason); return; }
        var objects = (objectResponse && (objectResponse.objects || objectResponse.items || objectResponse.data)) || [];
        if (!Array.isArray(objects) || !objects.length) { fallback(reason); return; }
        var chosen = null;
        for (var index = 0; index < objects.length; index++) {
          var values = extractFieldValues(objects[index]);
          var slug = String(values.slug || values.name || '').trim();
          if (!wantedSlug || slug === wantedSlug) { chosen = objects[index]; break; }
        }
        if (!chosen) { fallback(reason); return; }
        var payload = catalogObjectPayload(chosen);
        if (!payload) {
          finishCatalogLoad('The catalog object ' + objectType + ' has no JSON catalog field (catalogJson, catalog, payload, json).');
          return;
        }
        var payloadText = typeof payload === 'string' ? payload : JSON.stringify(payload);
        var objectResult = ingestCatalogPayload(payloadText, { source: 'objects', label: 'catalog object', url: '' });
        if (!objectResult.ok) { fallback(objectResult.error); return; }
        cacheCatalogText(payloadText);
        finishCatalogLoad('');
      });
    }

    if (!routeNames.length) { tryCached('No catalog source is configured. Import the JSON file to continue.'); return; }
    // A configured catalog OBJECT is the most authoritative source, so it wins
    // over the URL; the URL is the default when no object type is set.
    if (objectType) tryObjectRoute('', tryRelay);
    else tryRelay();
  }
  function importCatalogText(text, fileName) {
    var result = ingestCatalogPayload(text, { source: 'import', label: 'imported file', url: fileName || '' });
    if (!result.ok) {
      notify(result.error, 'warning');
      finishCatalogLoad(result.error);
      return;
    }
    cacheCatalogText(text);
    finishCatalogLoad('');
  }

  /* ---- selection actions ---- */
  function addCatalogIdea(ideaKey) {
    var idea = catalogIdeaById(ideaKey);
    if (!idea || !DB) return false;
    if (toolEntryByKey(idea.id) || toolsOf().length >= TOOL_LIMIT) return false;
    toolsOf().push({
      key: idea.id,
      code: idea.code,
      name: idea.name,
      purpose: idea.purpose,
      licensing: idea.licensing,
      group: idea.groupLabel,
      category: idea.categoryLabel,
      folder: catalogFolderOf(idea.id, ''),
      status: 'queued',
      priority: 'none',
      notes: '',
      addedAt: timestampNow(),
      updatedAt: timestampNow()
    });
    persist();
    return true;
  }
  function removeTool(key) {
    if (!DB || !Array.isArray(DB.tools)) return false;
    var before = DB.tools.length;
    DB.tools = DB.tools.filter(function (entry) { return entry.key !== key; });
    if (DB.tools.length === before) return false;
    persist();
    return true;
  }
  function moveTool(key, direction) {
    var list = toolsOf();
    var index = -1;
    for (var position = 0; position < list.length; position++) {
      if (list[position].key === key) { index = position; break; }
    }
    if (index === -1) return false;
    var target = index + direction;
    if (target < 0 || target >= list.length) return false;
    var moved = list.splice(index, 1)[0];
    list.splice(target, 0, moved);
    persist();
    return true;
  }
  function setToolField(key, fieldName, value) {
    var entry = toolEntryByKey(key);
    if (!entry) return false;
    if (fieldName === 'status') entry.status = statusIdOf(value);
    else if (fieldName === 'priority') entry.priority = priorityIdOf(value);
    else if (fieldName === 'notes') entry.notes = normalizeText(value, 600);
    else return false;
    entry.updatedAt = timestampNow();
    persist();
    return true;
  }
  function syncToolStatuses() {
    var list = toolsOf();
    if (!list.length) return 0;
    if (_catalog.state !== 'ready') return -1;
    var changed = 0;
    list.forEach(function (entry) {
      var build = catalogBuildOf(entry.key);
      var published = publishedCountOf(publishedStateOfTool(entry));
      var next = entry.status;
      if (published >= PUBLISH_SUBJECTS.length) next = 'published';
      else if (!build) next = (entry.status === 'queued' || entry.status === 'planned') ? entry.status : 'planned';
      else if (!docsCompleteOf(entry.key)) next = 'documenting';
      else next = 'ready';
      if (next !== entry.status) { entry.status = next; entry.updatedAt = timestampNow(); changed++; }
      var folder = catalogFolderOf(entry.key, entry.folder);
      if (folder && folder !== entry.folder) { entry.folder = folder; changed++; }
    });
    if (changed) persist();
    return changed;
  }
  function toolQueuePayload() {
    return {
      schema: 'uniconhub-application-tool-queue',
      application: displayNameOfApp(),
      applicationSlug: appSlugOf(),
      catalogVersion: _catalog.catalogVersion,
      catalogSource: _catalog.sourceLabel,
      generatedAt: timestampNow(),
      subjects: PUBLISH_SUBJECTS.map(function (subject) { return subject.id; }),
      tools: toolsOf().map(function (entry, index) {
        var build = catalogBuildOf(entry.key);
        var publish = publishedStateOfTool(entry);
        return {
          order: index + 1,
          key: entry.key,
          code: entry.code,
          name: entry.name,
          folder: catalogFolderOf(entry.key, entry.folder),
          group: entry.group,
          category: entry.category,
          licensing: entry.licensing,
          status: entry.status,
          priority: entry.priority,
          notes: entry.notes,
          built: !!build,
          docs: build ? { done: build.docsCount || 0, total: build.docsTotal || 7 } : null,
          publish: {
            version: publish.version,
            publishedAt: publish.publishedAt,
            subjects: publish.subjects,
            complete: publishedCountOf(publish),
            total: PUBLISH_SUBJECTS.length
          }
        };
      })
    };
  }

  /* ---- catalog rendering ---- */
  function catalogIdeaCounts() {
    var built = 0;
    var documented = 0;
    _catalog.ideas.forEach(function (idea) {
      if (catalogBuildOf(idea.id)) built++;
      if (docsCompleteOf(idea.id)) documented++;
    });
    var selectedList = toolsOf();
    var selectedBuilt = 0;
    var selectedReady = 0;
    var selectedPublished = 0;
    selectedList.forEach(function (entry) {
      var build = catalogBuildOf(entry.key);
      if (build) selectedBuilt++;
      var published = publishedCountOf(publishedStateOfTool(entry));
      if (published >= PUBLISH_SUBJECTS.length) selectedPublished++;
      else if (build && docsCompleteOf(entry.key)) selectedReady++;
    });
    return {
      ideas: _catalog.ideas.length,
      built: built,
      documented: documented,
      selected: selectedList.length,
      selectedBuilt: selectedBuilt,
      selectedReady: selectedReady,
      selectedPublished: selectedPublished
    };
  }
  function catalogSourceLabel() {
    if (_catalog.state === 'loading') return 'loading...';
    if (_catalog.state === 'error') return 'load failed';
    if (_catalog.state === 'ready') {
      var stamp = _catalog.loadedAt ? formatDateTime(_catalog.loadedAt) : '';
      return _catalog.sourceLabel + (stamp ? ' · ' + stamp : '');
    }
    return 'not loaded';
  }
  function renderCatalogStats() {
    var statsElement = $('asi-catalog-stats');
    var sourceElement = $('asi-catalog-source');
    if (sourceElement) {
      sourceElement.textContent = catalogSourceLabel();
      sourceElement.className = 'asi-catalog-source is-' + _catalog.state;
    }
    if (!statsElement) return;
    if (_catalog.state === 'idle') {
      statsElement.innerHTML = '<span class="asi-hint">The catalog is read from source - nothing is embedded in this tool. Press Reload catalog to load it.</span>';
      return;
    }
    if (_catalog.state === 'loading') {
      statsElement.innerHTML = '<span class="asi-hint">Loading the tool catalog from source...</span>';
      return;
    }
    if (_catalog.state === 'error') {
      statsElement.innerHTML = '<span class="asi-catalog-error">' + escHtml(_catalog.error) + '</span>';
      return;
    }
    var counts = catalogIdeaCounts();
    var chips = [
      ['ideas', counts.ideas],
      ['built in the repo', counts.built],
      ['fully documented', counts.documented],
      ['selected', counts.selected],
      ['selected + built', counts.selectedBuilt],
      ['selected + ready to publish', counts.selectedReady],
      ['selected + published 8/8', counts.selectedPublished]
    ].map(function (pair) {
      return '<span class="asi-catalog-stat"><b>' + escHtml(String(pair[1])) + '</b> ' + escHtml(pair[0]) + '</span>';
    }).join('');
    var note = _catalog.hasBuildState
      ? ''
      : '<p class="asi-hint">This source has ideas only - build and publish state are unknown, so those columns stay empty.</p>';
    statsElement.innerHTML = '<div class="asi-catalog-chips">' + chips + '</div>' + note;
  }
  function renderCatalogFilters() {
    var groupSelect = $('asi-catalog-group');
    if (groupSelect) {
      var groupSeen = {};
      var groupOptions = ['<option value="all">All groups</option>'];
      _catalog.ideas.forEach(function (idea) {
        var key = idea.groupKey || 'ungrouped';
        if (groupSeen[key]) return;
        groupSeen[key] = true;
        groupOptions.push('<option value="' + escHtml(key) + '">' + escHtml(idea.groupLabel || 'Ungrouped') + '</option>');
      });
      groupSelect.innerHTML = groupOptions.join('');
      groupSelect.value = _catalogFilters.group;
    }
    var licensingSelect = $('asi-catalog-licensing');
    if (licensingSelect) {
      var licenseSeen = {};
      var licenseOptions = ['<option value="all">Any licensing</option>'];
      _catalog.ideas.forEach(function (idea) {
        if (!idea.licensing || licenseSeen[idea.licensing]) return;
        licenseSeen[idea.licensing] = true;
        licenseOptions.push('<option value="' + escHtml(idea.licensing) + '">' + escHtml(licensingLabelOf(idea.licensing)) + '</option>');
      });
      licensingSelect.innerHTML = licenseOptions.join('');
      licensingSelect.value = _catalogFilters.licensing;
    }
    var searchInput = $('asi-catalog-search');
    if (searchInput && document.activeElement !== searchInput) searchInput.value = _catalogFilters.search;
  }
  function catalogIdeaMatches(idea) {
    var query = _catalogFilters.search;
    if (query) {
      var haystack = (idea.code + ' ' + idea.name + ' ' + idea.purpose + ' ' + idea.sub + ' ' + idea.categoryLabel + ' ' + idea.groupLabel).toLowerCase();
      if (haystack.indexOf(query) === -1) return false;
    }
    if (_catalogFilters.group !== 'all' && (idea.groupKey || 'ungrouped') !== _catalogFilters.group) return false;
    if (_catalogFilters.licensing !== 'all' && idea.licensing !== _catalogFilters.licensing) return false;
    var wanted = _catalogFilters.state;
    if (wanted !== 'all') {
      var build = catalogBuildOf(idea.id);
      var isSelected = !!toolEntryByKey(idea.id);
      var published = isSelected ? publishedCountOf(publishedStateOfTool(toolEntryByKey(idea.id))) : 0;
      if (wanted === 'new' && build) return false;
      if (wanted === 'built' && !build) return false;
      if (wanted === 'documented' && !docsCompleteOf(idea.id)) return false;
      if (wanted === 'published' && published < PUBLISH_SUBJECTS.length) return false;
      if (wanted === 'selected' && !isSelected) return false;
    }
    return true;
  }
  function catalogRowHtml(idea) {
    var build = catalogBuildOf(idea.id);
    var selectedEntry = toolEntryByKey(idea.id);
    var published = selectedEntry ? publishedCountOf(publishedStateOfTool(selectedEntry)) : 0;
    var stateChips = [];
    if (!build) stateChips.push('<span class="asi-cat-chip is-new">not built</span>');
    else {
      stateChips.push('<span class="asi-cat-chip is-built">' + escHtml(build.folder || 'built') + '</span>');
      stateChips.push('<span class="asi-cat-chip' + (docsCompleteOf(idea.id) ? ' is-ok' : '') + '">docs ' + escHtml(docsLabelOf(idea.id)) + '</span>');
    }
    if (published > 0) stateChips.push('<span class="asi-cat-chip' + (published >= PUBLISH_SUBJECTS.length ? ' is-ok' : '') + '">publish ' + published + '/' + PUBLISH_SUBJECTS.length + '</span>');
    return '<label class="asi-cat-row' + (selectedEntry ? ' is-selected' : '') + '" data-catalog-row="' + escHtml(idea.id) + '">' +
      '<input type="checkbox" data-catalog-id="' + escHtml(idea.id) + '"' + (selectedEntry ? ' checked="checked"' : '') + ' />' +
      '<span class="asi-cat-code">' + escHtml(idea.code) + '</span>' +
      '<span class="asi-cat-main"><span class="asi-cat-name">' + escHtml(idea.name) + '</span>' +
      '<span class="asi-cat-purpose">' + escHtml(idea.purpose) + '</span></span>' +
      '<span class="asi-cat-side"><span class="asi-cat-license">' + escHtml(licensingLabelOf(idea.licensing)) + '</span>' +
      '<span class="asi-cat-chips">' + stateChips.join('') + '</span></span>' +
      '</label>';
  }
  function renderCatalogList() {
    var listElement = $('asi-catalog-list');
    var rangeElement = $('asi-catalog-range');
    var moreButton = $('asi-catalog-more');
    if (!listElement) return;
    if (_catalog.state !== 'ready') {
      listElement.innerHTML = '';
      if (rangeElement) rangeElement.textContent = '';
      if (moreButton) moreButton.style.display = 'none';
      return;
    }
    var matches = _catalog.ideas.filter(catalogIdeaMatches);
    var visible = matches.slice(0, _catalogLimit);
    listElement.innerHTML = visible.length
      ? visible.map(catalogRowHtml).join('')
      : '<p class="asi-cat-empty">No idea matches these filters.</p>';
    if (rangeElement) {
      rangeElement.textContent = matches.length
        ? 'Showing ' + visible.length + ' of ' + matches.length + ' matching ideas (' + _catalog.ideas.length + ' in the catalog)'
        : 'No match';
    }
    if (moreButton) moreButton.style.display = matches.length > visible.length ? '' : 'none';
  }
  function subjectChipsHtml(entry) {
    var publish = publishedStateOfTool(entry);
    return PUBLISH_SUBJECTS.map(function (subject) {
      var on = !!publish.subjects[subject.id];
      return '<span class="asi-subject' + (on ? ' is-on' : '') + '" title="' + escHtml(subject.label) + '">' + escHtml(subject.label) + '</span>';
    }).join('');
  }
  function toolRowHtml(entry, index, total) {
    var build = catalogBuildOf(entry.key);
    var folder = catalogFolderOf(entry.key, entry.folder);
    var publish = publishedStateOfTool(entry);
    var published = publishedCountOf(publish);
    var statusOptions = TOOL_STATUSES.map(function (status) {
      return '<option value="' + escHtml(status.id) + '"' + (status.id === entry.status ? ' selected="selected"' : '') + '>' + escHtml(status.label) + '</option>';
    }).join('');
    var priorityOptions = TOOL_PRIORITIES.map(function (priority) {
      return '<option value="' + escHtml(priority.id) + '"' + (priority.id === entry.priority ? ' selected="selected"' : '') + '>' + escHtml(priority.label) + '</option>';
    }).join('');
    var facts = [];
    facts.push('<span class="asi-sel-fact">' + (build ? 'folder <code>' + escHtml(folder) + '</code>' : 'no folder yet') + '</span>');
    facts.push('<span class="asi-sel-fact">docs ' + (build ? escHtml(docsLabelOf(entry.key)) : '-') + '</span>');
    facts.push('<span class="asi-sel-fact">publish ' + published + '/' + PUBLISH_SUBJECTS.length + '</span>');
    if (publish.version) facts.push('<span class="asi-sel-fact">v' + escHtml(publish.version) + '</span>');
    return '<div class="asi-sel-row" data-tool-key="' + escHtml(entry.key) + '">' +
      '<div class="asi-sel-head">' +
      '<span class="asi-sel-order">' + (index + 1) + '</span>' +
      '<span class="asi-sel-title"><b>' + escHtml(entry.name) + '</b><span class="asi-sel-code">' + escHtml(entry.code) + '</span></span>' +
      '<span class="asi-sel-controls">' +
      '<select class="asi-select asi-select-sm" data-tool-field="status" aria-label="Status">' + statusOptions + '</select>' +
      '<select class="asi-select asi-select-sm" data-tool-field="priority" aria-label="Priority">' + priorityOptions + '</select>' +
      '<button class="asi-icon-btn" type="button" data-tool-act="up"' + (index === 0 ? ' disabled="disabled"' : '') + ' title="Move up">&#8593;</button>' +
      '<button class="asi-icon-btn" type="button" data-tool-act="down"' + (index === total - 1 ? ' disabled="disabled"' : '') + ' title="Move down">&#8595;</button>' +
      '<button class="asi-icon-btn asi-icon-btn-danger" type="button" data-tool-act="remove" title="Remove from the selection">&#10005;</button>' +
      '</span></div>' +
      '<div class="asi-sel-facts">' + facts.join('') + '</div>' +
      '<div class="asi-sel-subjects">' + subjectChipsHtml(entry) + '</div>' +
      '<input class="asi-input asi-input-sm" type="text" data-tool-field="notes" value="' + escHtml(entry.notes) + '" placeholder="Notes for the build queue (scope, priority reason, blocker)" />' +
      '</div>';
  }
  function renderSelectedTools() {
    var listElement = $('asi-selected-list');
    var countElement = $('asi-selected-count');
    var list = toolsOf();
    if (countElement) countElement.textContent = String(list.length);
    if (!listElement) return;
    listElement.innerHTML = list.length
      ? list.map(function (entry, index) { return toolRowHtml(entry, index, list.length); }).join('')
      : '<p class="asi-cat-empty">Nothing selected yet. Tick ideas in the catalog to build the queue for this application.</p>';
  }
  function updateToolTabCount() {
    var countElement = $('asi-tab-tool-count');
    if (countElement) countElement.textContent = String(toolsOf().length);
  }
  function renderToolsTab() {
    updateToolTabCount();
    renderCatalogStats();
    renderCatalogFilters();
    renderCatalogList();
    renderSelectedTools();
  }

  function handleCatalogListChange(event) {
    var element = event.target;
    if (!element || !element.getAttribute) return;
    var ideaId = element.getAttribute('data-catalog-id');
    if (!ideaId) return;
    var changed = element.checked ? addCatalogIdea(ideaId) : removeTool(ideaId);
    if (!changed) {
      element.checked = !element.checked;
      notify(element.checked ? 'That tool is already in the queue.' : 'That tool is not in the queue.', 'warning');
      return;
    }
    renderToolsTab();
  }
  function handleSelectedToolsClick(event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-tool-act]') : null;
    if (!button) return;
    var row = button.closest('[data-tool-key]');
    if (!row) return;
    var key = row.getAttribute('data-tool-key');
    var action = button.getAttribute('data-tool-act');
    if (action === 'up') moveTool(key, -1);
    if (action === 'down') moveTool(key, 1);
    if (action === 'remove') removeTool(key);
    renderToolsTab();
  }
  function handleSelectedToolsChange(event) {
    var element = event.target;
    if (!element || !element.getAttribute) return;
    var fieldName = element.getAttribute('data-tool-field');
    if (!fieldName || fieldName === 'notes') return;
    var row = element.closest('[data-tool-key]');
    if (!row) return;
    setToolField(row.getAttribute('data-tool-key'), fieldName, element.value);
    renderToolsTab();
  }
  function handleSelectedToolsInput(event) {
    var element = event.target;
    if (!element || !element.getAttribute) return;
    if (element.getAttribute('data-tool-field') !== 'notes') return;
    var row = element.closest('[data-tool-key]');
    if (!row) return;
    setToolField(row.getAttribute('data-tool-key'), 'notes', element.value);
  }
  function handleCatalogImportFile() {
    var inputElement = $('asi-catalog-file');
    if (!inputElement) return;
    var file = inputElement.files && inputElement.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      importCatalogText(String(reader.result || ''), file.name);
      inputElement.value = '';
    };
    reader.onerror = function () {
      notify('That file could not be read.', 'warning');
      inputElement.value = '';
    };
    reader.readAsText(file);
  }
  function clearToolSelection() {
    if (!DB || !toolsOf().length) return;
    DB.tools = [];
    persist();
    renderToolsTab();
  }

  /* --------------------------------------------------------
     Tabs and rendering
  -------------------------------------------------------- */
  function switchTab(tabName) {
    _activeTab = tabName;
    var tabButtons = document.querySelectorAll('.asi-tab');
    for (var tabIndex = 0; tabIndex < tabButtons.length; tabIndex++) {
      tabButtons[tabIndex].classList.toggle('active', tabButtons[tabIndex].getAttribute('data-tab') === tabName);
    }
    ['details', 'releases', 'tools', 'docs', 'screenshots', 'preview', 'logs'].forEach(function (paneName) {
      var pane = $('asi-pane-' + paneName);
      if (pane) pane.style.display = paneName === tabName ? '' : 'none';
    });
    if (tabName === 'docs') ensureDocsStructure();
    if (tabName === 'releases') renderReleases();
    if (tabName === 'tools') {
      renderToolsTab();
      if (_catalog.state === 'idle') loadCatalog();
    }
    if (tabName === 'screenshots') renderShots();
    if (tabName === 'preview' && !_previewBuilt) renderPreview();
    if (tabName === 'logs') renderActivityLog();
    try { tool.resize(); } catch (error) {}
  }
  function renderAll() {
    renderCategorySelect();
    renderDetails();
    renderDeveloperSelect();
    renderLanguages();
    renderTags();
    renderStatusNote();
    renderIconPreview();
    updateShortCount();
    renderReleases();
    renderShots();
    ensureDocsStructure();
    renderTargetSummary();
    renderActivityLog();
    renderUser();
    updateSizeMeter();
    reportValidation();
    renderReadiness();
    updateToolTabCount();
    if (_activeTab === 'tools') renderToolsTab();
  }

  /* --------------------------------------------------------
     Event wiring
  -------------------------------------------------------- */
  function wireEvents() {
    var tabButtons = document.querySelectorAll('.asi-tab');
    for (var tabIndex = 0; tabIndex < tabButtons.length; tabIndex++) {
      (function (tabButton) {
        tabButton.addEventListener('click', function () { switchTab(tabButton.getAttribute('data-tab')); });
      })(tabButtons[tabIndex]);
    }

    on('asi-catalog-reload', 'click', function () { loadCatalog(); });
    on('asi-catalog-import', 'click', function () {
      var fileInput = $('asi-catalog-file');
      if (fileInput) fileInput.click();
    });
    on('asi-catalog-file', 'change', handleCatalogImportFile);
    on('asi-catalog-search', 'input', function (event) {
      _catalogFilters.search = String(event.target.value || '').toLowerCase().trim();
      _catalogLimit = CATALOG_PAGE_SIZE;
      renderCatalogList();
    });
    on('asi-catalog-group', 'change', function (event) {
      _catalogFilters.group = String(event.target.value || 'all');
      _catalogLimit = CATALOG_PAGE_SIZE;
      renderCatalogList();
    });
    on('asi-catalog-licensing', 'change', function (event) {
      _catalogFilters.licensing = String(event.target.value || 'all');
      _catalogLimit = CATALOG_PAGE_SIZE;
      renderCatalogList();
    });
    on('asi-catalog-state', 'change', function (event) {
      _catalogFilters.state = String(event.target.value || 'all');
      _catalogLimit = CATALOG_PAGE_SIZE;
      renderCatalogList();
    });
    on('asi-catalog-more', 'click', function () {
      _catalogLimit += CATALOG_PAGE_SIZE;
      renderCatalogList();
    });
    on('asi-catalog-list', 'change', handleCatalogListChange);
    on('asi-selected-list', 'change', handleSelectedToolsChange);
    on('asi-selected-list', 'click', handleSelectedToolsClick);
    on('asi-selected-list', 'input', handleSelectedToolsInput);
    on('asi-selected-sync', 'click', function () {
      var changed = syncToolStatuses();
      if (changed === -1) { notify('Load the catalog first - status comes from what the catalog knows about each tool.', 'warning'); return; }
      notify(changed ? changed + ' tool(s) updated from the catalog.' : 'Every status already matches the catalog.', 'info');
      renderToolsTab();
    });
    on('asi-selected-copy', 'click', function () {
      copyText(JSON.stringify(toolQueuePayload(), null, 2));
    });
    on('asi-selected-clear', 'click', function () { clearToolSelection(); });

    var appFields = document.querySelectorAll('[data-app-field]');
    for (var fieldIndex = 0; fieldIndex < appFields.length; fieldIndex++) {
      (function (fieldElement) {
        var key = fieldElement.getAttribute('data-app-field');
        var eventName = fieldElement.tagName === 'SELECT' ? 'change' : 'input';
        fieldElement.addEventListener(eventName, function () {
          DB.app[key] = fieldElement.value;
          if (key === 'developerId') {
            var option = findDeveloperOption(fieldElement.value);
            if (option && option.name) {
              DB.app.developerName = option.name;
              var nameInput = $('asi-f-developerName');
              if (nameInput) nameInput.value = option.name;
            }
          }
          if (key === 'appName') {
            reportValidation();
            refreshDocPaneValues();
          }
          if (key === 'appShortDescription') updateShortCount();
          if (key === 'appIconUrl') renderIconPreview();
          if (key === 'appStatus') renderStatusNote();
          persist();
          schedulePreviewRefresh();
          renderReadiness();
        });
      })(appFields[fieldIndex]);
    }

    on('asi-btn-icon-upload', 'click', uploadApplicationIcon);
    on('asi-btn-developer-refresh', 'click', loadDevelopers);
    on('asi-languages-list', 'change', function (event) {
      var checkbox = event.target;
      if (!checkbox || !checkbox.getAttribute) return;
      var code = checkbox.getAttribute('data-language');
      if (!code) return;
      toggleLanguage(code, !!checkbox.checked);
    });
    on('asi-f-tags-input', 'keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ',') return;
      event.preventDefault();
      var tagsInput = $('asi-f-tags-input');
      addTag(tagsInput ? tagsInput.value : '');
      if (tagsInput) tagsInput.value = '';
    });
    on('asi-f-tags-input', 'blur', function () {
      var tagsInput = $('asi-f-tags-input');
      if (tagsInput && tagsInput.value.trim()) {
        addTag(tagsInput.value);
        tagsInput.value = '';
      }
    });

    on('asi-btn-new-release', 'click', function () { resetReleaseEditor(true); });
    on('asi-btn-save-release', 'click', saveRelease);
    on('asi-btn-cancel-release', 'click', function () { resetReleaseEditor(false); });
    on('asi-btn-add-file', 'click', uploadReleaseFile);
    on('asi-btn-add-url', 'click', addReleaseUrl);
    on('asi-btn-rel-icon-upload', 'click', uploadReleaseIcon);
    on('asi-rel-url', 'keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        addReleaseUrl();
      }
    });
    on('asi-rel-languages', 'change', function (event) {
      var checkbox = event.target;
      if (!checkbox || !checkbox.getAttribute) return;
      var code = checkbox.getAttribute('data-release-language');
      if (!code) return;
      var draft = ensureReleaseDraft();
      var index = draft.languages.indexOf(code);
      if (checkbox.checked && index === -1) draft.languages.push(code);
      if (!checkbox.checked && index !== -1) draft.languages.splice(index, 1);
      renderReleaseLanguages();
    });
    on('asi-rel-files', 'click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-act]') : null;
      if (!button) return;
      var action = button.getAttribute('data-act');
      var fileIndex = Number(button.getAttribute('data-file-index'));
      var draft = ensureReleaseDraft();
      if (!draft.files[fileIndex]) return;
      if (action === 'file-remove') {
        draft.files.splice(fileIndex, 1);
        renderReleaseFiles();
        updateReleaseSize();
      } else if (action === 'file-copy') {
        copyText(draft.files[fileIndex].url);
      }
    });
    on('asi-release-list', 'click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-act]') : null;
      if (!button) return;
      var action = button.getAttribute('data-act');
      var releaseId = button.getAttribute('data-release-id');
      if (action === 'release-edit') openReleaseEditor(releaseId);
      else if (action === 'release-delete') deleteRelease(releaseId);
    });
    on('asi-release-list', 'change', function (event) {
      var checkbox = event.target;
      if (!checkbox || !checkbox.getAttribute) return;
      var releaseId = checkbox.getAttribute('data-release-toggle');
      if (!releaseId) return;
      toggleReleaseEnabled(releaseId, !!checkbox.checked);
    });
    ['asi-rel-version', 'asi-rel-date', 'asi-rel-enabled', 'asi-f-rel-icon', 'asi-rel-notes'].forEach(function (inputId) {
      on(inputId, 'input', function () {
        readReleaseEditorIntoDraft();
        updateReleaseSize();
      });
      on(inputId, 'change', function () {
        readReleaseEditorIntoDraft();
        updateReleaseSize();
      });
    });

    on('asi-shots-upload', 'click', uploadScreenshot);
    on('asi-shots-list', 'click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-act]') : null;
      if (!button) return;
      var action = button.getAttribute('data-act');
      var shotId = button.getAttribute('data-shot-id');
      if (action === 'shot-up') moveShot(shotId, -1);
      else if (action === 'shot-down') moveShot(shotId, 1);
      else if (action === 'shot-copy') { var shotForCopy = shotById(shotId); if (shotForCopy) copyText(shotForCopy.url); }
      else if (action === 'shot-icon') {
        var shotForIcon = shotById(shotId);
        if (shotForIcon) {
          DB.app.appIconUrl = shotForIcon.url;
          persist();
          renderDetails();
          renderIconPreview();
          schedulePreviewRefresh();
          renderReadiness();
          notify('Screenshot set as the application icon.', 'success');
        }
      } else if (action === 'shot-remove') removeShot(shotId);
    });
    on('asi-shots-list', 'input', function (event) {
      var inputElement = event.target;
      if (!inputElement || !inputElement.getAttribute) return;
      var shotId = inputElement.getAttribute('data-shot-caption');
      if (!shotId) return;
      var shot = shotById(shotId);
      if (!shot) return;
      shot.caption = String(inputElement.value || '').slice(0, 160);
      clearTimeout(_shotCaptionTimer);
      _shotCaptionTimer = setTimeout(function () {
        persist();
        schedulePreviewRefresh();
      }, 400);
    });

    on('asi-preview-tab-listing', 'click', function () { setPreviewView('listing'); });
    on('asi-preview-tab-payload', 'click', function () { setPreviewView('payload'); });
    on('asi-btn-rebuild-preview', 'click', renderPreview);
    on('asi-btn-copy-legacy', 'click', function () { copyText(JSON.stringify(buildLegacyPayload(), null, 2)); });
    on('asi-btn-copy-full', 'click', function () { copyText(JSON.stringify(buildFullPayload(), null, 2)); });

    on('asi-doc-tabs', 'click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-doc-tab]') : null;
      if (!button) return;
      _activeDocKey = button.getAttribute('data-doc-tab');
      ensureDocsStructure();
    });
    on('asi-doc-content', 'input', handleDocInput);
    on('asi-doc-content', 'click', handleDocActionClick);
    on('asi-doc-content', 'click', handleDocPartClick);

    on('asi-btn-import-legacy', 'click', runLegacyImportFromButton);
  }

  /* --------------------------------------------------------
     Entry point
  -------------------------------------------------------- */
  function declareToolSurface() {
    try {
      tool.declareOutput({
        type: 'object',
        description: 'One application store record: identity, releases with files, selected tool queue, document targets, screenshots and migration metadata.',
        properties: {
          version: { type: 'number' },
          app: { type: 'object', description: 'appName, appIconUrl, short/full description, developer reference, category, languages, tags, links, license, featured, status.' },
          versions: { type: 'array', description: 'Releases: versionNumber, releaseDate, languages, iconUrl, releaseNotes, isEnabled, files[{name,url,size,type}].' },
          docs: { type: 'object', description: 'Per-document CMS object references only - content lives in separate objects.' },
          shots: { type: 'array', description: 'Screenshot metadata - storage URLs only, never file bytes.' },
          tools: { type: 'array', description: 'Selected html tools in queue order: key, code, name, folder, status, priority, notes. Read by the build queue.' },
          toolsMeta: { type: 'object', description: 'Catalog provenance: catalogVersion, catalogCount, source label, loadedAt.' },
          meta: { type: 'object' }
        }
      });
      tool.declareParams([
        {
          name: 'catalogUrl', label: 'Tool Catalog URL', type: 'text', default: DEFAULT_CATALOG_URL, severity: 'goodToHave',
          hint: 'Where the full html tool ideas catalog is read from (tool-catalog-bundle.json). Loaded through the parent CMS relay - never fetched directly by the tool. Idea selection only is stored in this record.'
        },
        {
          name: 'catalogObjectType', label: 'Tool Catalog Object Type', type: 'text', default: '', severity: 'goodToHave',
          hint: 'Optional CMS object type holding the catalog JSON (field catalogJson/catalog/payload/json). Tried before the URL when set.'
        },
        {
          name: 'catalogSlug', label: 'Tool Catalog Slug', type: 'text', default: '', severity: 'goodToHave',
          hint: 'Optional slug of the catalog object to pick when the object type has several records.'
        },
        {
          name: 'developerType', label: 'Developer Object Type', type: 'text', default: DEFAULT_DEVELOPER_TYPE, severity: 'goodToHave',
          hint: 'CMS object type that holds developer records. Read only. Default: developers-applicationstore.'
        },
        {
          name: 'categoryList', label: 'Category List', type: 'text', default: '', severity: 'goodToHave',
          hint: 'Optional JSON array replacing the built-in category list. Entries: {"id":"general-business","label":"General Business"} or "Label".'
        },
        {
          name: 'languageOptions', label: 'Language Options', type: 'text', default: '', severity: 'goodToHave',
          hint: 'Optional JSON array replacing the built-in language list. Entries: {"id":"en","label":"English"} or "English".'
        },
        {
          name: 'releaseFileAccept', label: 'Release File Accept', type: 'text', default: DEFAULT_RELEASE_FILE_ACCEPT, severity: 'goodToHave',
          hint: 'File picker filter for release uploads, e.g. .zip,.json,.html,.js,.css.'
        },
        {
          name: 'pageTargetType', label: 'Page Target Object Type', type: 'text', default: DEFAULT_PAGE_TARGET_TYPE, severity: 'goodToHave',
          hint: 'Object type of website pages - website-builder-uniconbaseapps. Used by webpage, help, updates and presentation documents. Write access is needed on this type.'
        },
        {
          name: 'socialTargetType', label: 'Social Target Object Type', type: 'text', default: DEFAULT_SOCIAL_TARGET_TYPE, severity: 'goodToHave',
          hint: 'Object type of the social content objects. Write access is needed on this type.'
        },
        {
          name: 'docsFolderTypeMap', label: 'Docs Folder Type Map', type: 'text', default: JSON.stringify(DEFAULT_DOCS_FOLDER_TYPE_MAP), severity: 'goodToHave',
          hint: 'JSON map: document key -> leaf folder (typeId) inside the target application. Keys: webpage, help, updates, presentation. Empty value = app default folder.'
        },
        {
          name: 'docsFolderTypeId', label: 'Docs Folder ID Override', type: 'text', default: '', severity: 'goodToHave',
          hint: 'Optional single leaf folder (typeId) used for every document key that has no entry in docsFolderTypeMap.'
        },
        {
          name: 'pageTargetFieldMap', label: 'Page Target Field Map', type: 'text', default: '', severity: 'goodToHave',
          hint: 'JSON override for the page object field id, e.g. {"webpageContentWithBuilder":"webpageContentWithBuilder"}.'
        },
        {
          name: 'socialTargetFieldMap', label: 'Social Target Field Map', type: 'text', default: '', severity: 'goodToHave',
          hint: 'JSON override for the social object field ids, e.g. {"name":"name","slug":"slug","contentHtml":"contentHtml","updatedAt":"updatedAt"}.'
        },
        {
          name: 'pageStatus', label: 'Page Status', type: 'text', default: '', severity: 'goodToHave',
          hint: 'Optional. Leave empty so the CMS Publish action owns page status - set to draft or published only to override it.'
        },
        {
          name: 'docLanguage', label: 'Document Language', type: 'text', default: 'en', severity: 'goodToHave',
          hint: 'meta.language written to page objects.'
        },
        {
          name: 'previewAccentColor', label: 'Preview Accent Color', type: 'text', default: '#2563eb', severity: 'goodToHave',
          hint: 'Hex color used by the store listing preview.'
        }
      ]);
    } catch (error) {}
  }

  tool.onReady(function (value, readyFields) {
    _readyFields = readyFields || null;
    _ownRecordName = String((readyFields && readyFields.name) || '');
    var ownTypeIdSource = (readyFields && readyFields.typeId) ? readyFields.typeId : '';
    if (!ownTypeIdSource) {
      try {
        var folderFields = tool.getFields ? tool.getFields() : null;
        if (folderFields && folderFields.typeId) ownTypeIdSource = folderFields.typeId;
      } catch (error) {}
    }
    _ownTypeId = String(ownTypeIdSource || '');
    logDiagnostics('ready', 'tool API keys: ' + Object.keys(tool || {}).join(', '));
    logDiagnostics('ready', 'record=' + (_ownRecordName || '(no name)') + ' folder=' + (_ownTypeId || '(none)'));

    declareToolSurface();

    DB = normalize(value);
    _readOnly = !!tool.isReadOnly();

    var hasStoredApp = !!(value && typeof value === 'object' && value.app && (String(value.app.appName || '').trim() || (Array.isArray(value.versions) && value.versions.length)));
    var legacyResult = null;
    if (!hasStoredApp && hasLegacyData(legacyValuesSnapshot())) {
      legacyResult = applyLegacyImport({ silent: true, render: false, seedDefaults: true });
    }

    wireEvents();
    renderAll();
    renderImportNote(legacyResult);
    lockUI();
    refreshUser();
    loadDevelopers();

    tool.onValueChange(function (newValue) {
      if (_saving) return;
      var incoming = normalize(newValue);
      if (JSON.stringify(incoming) === JSON.stringify(DB)) return;
      DB = incoming;
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
    });

    try {
      window.addEventListener('pagehide', flushStagedValue);
      window.addEventListener('beforeunload', flushStagedValue);
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') flushStagedValue();
      });
    } catch (error) {}
  });
})();
