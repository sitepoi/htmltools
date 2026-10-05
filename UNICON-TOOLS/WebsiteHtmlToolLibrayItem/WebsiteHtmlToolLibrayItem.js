/* ============================================================
   Website HTML Tool Item Editor - UniconHub CMS html-tool
   Edits the details, code and documents of ONE website
   html-tool widget (embedded in web pages, no iframe).
   Everything persists in this tool's own saved value via
   tool.setValue(). Entry point: tool.onReady
   ============================================================ */
(function () {
  'use strict';

  /* --------------------------------------------------------
     Constants
  -------------------------------------------------------- */
  var WIDGET_CATEGORIES = [
    { code: 'forms', label: 'Forms & Lead Capture', group: 'Interaction' },
    { code: 'commerce', label: 'Commerce & Cart', group: 'Commerce' },
    { code: 'booking', label: 'Booking & Scheduling', group: 'Commerce' },
    { code: 'search', label: 'Search & Discovery', group: 'Interaction' },
    { code: 'media', label: 'Media & Galleries', group: 'Content' },
    { code: 'data-display', label: 'Data Display & Lists', group: 'Content' },
    { code: 'social', label: 'Social & Sharing', group: 'Interaction' },
    { code: 'communication', label: 'Communication & Chat', group: 'Interaction' },
    { code: 'navigation', label: 'Navigation & Menus', group: 'Interaction' },
    { code: 'notifications', label: 'Notifications & Alerts', group: 'Interaction' },
    { code: 'ai', label: 'AI Features', group: 'Content' },
    { code: 'localization', label: 'Localization', group: 'Infrastructure' },
    { code: 'analytics', label: 'Analytics & Tracking', group: 'Infrastructure' },
    { code: 'seo', label: 'SEO', group: 'Infrastructure' },
    { code: 'utilities', label: 'Utilities', group: 'Infrastructure' }
  ];

  var TAG_SUGGESTIONS = ['widget', 'responsive', 'lazy-load', 'ssr', 'vanilla-js', 'lightweight', 'accessible', 'themed', 'dark-mode', 'multi-language', 'api', 'static', 'animated', 'reusable', 'section', 'slider', 'gallery', 'form', 'live', 'social-proof'];

  var STRING_FIELDS = ['toolName', 'toolIcon', 'toolStatus', 'toolDescription', 'toolHtmlCode', 'toolCssCode', 'toolJsCode'];
  var CODE_FIELDS = ['toolHtmlCode', 'toolCssCode', 'toolJsCode'];
  var CODE_TAB_OF_FIELD = { toolHtmlCode: 'html', toolCssCode: 'css', toolJsCode: 'js' };
  var DOC_KEYS = ['webpage', 'help', 'updates'];
  var DOC_LABELS = { webpage: 'Webpage', help: 'Help', updates: 'Updates' };
  var DOC_PARTS = ['preview', 'html', 'css', 'js'];
  var VALID_STATUSES = ['draft', 'active'];
  var VALID_AUTH_TYPES = ['none', 'apiKey', 'bearerToken'];
  var AUTH_TYPE_LABELS = { none: 'No auth', apiKey: 'API key header', bearerToken: 'Bearer token' };
  var API_DEFAULT_HEADER_NAMES = { apiKey: 'x-api-key', bearerToken: 'Authorization' };
  var SHOTS_LIMIT = 50;
  var TAGS_LIMIT = 20;
  var TAG_MAX_LENGTH = 24;
  var DIAGNOSTICS_LINE_LIMIT = 60;
  var SIZE_WARN_BYTES = 800000;
  var SIZE_DANGER_BYTES = 950000;

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
  var _activeSchemaPart = 'json';
  var _previewBuilt = false;
  var _activeDocKey = 'webpage';
  var _activeDocPart = {};
  var _editingApiId = '';
  var _apiRemoveArmed = '';
  var _apiRemoveArmTimer = null;
  var _gutterTimers = {};
  var _docGutterTimers = {};
  var _diagnosticsLines = [];
  var _shotSequence = 0;
  var _shotsBusy = false;

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
  function formatBytes(byteCount) {
    var bytes = Number(byteCount) || 0;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
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
    try { if (typeof console !== 'undefined' && console.log) console.log('[WebsiteHtmlToolLibrayItem] ' + line); } catch (error) {}
    var logElement = $('wht-debug-log');
    if (logElement) logElement.textContent = _diagnosticsLines.join('\n');
  }

  /* --------------------------------------------------------
     Defaults and normalization
  -------------------------------------------------------- */
  function defaultDoc() { return { html: '', css: '', js: '' }; }
  function defaultDocs() {
    var docs = {};
    DOC_KEYS.forEach(function (docKey) { docs[docKey] = defaultDoc(); });
    return docs;
  }
  function defaultDraft() {
    var draft = {};
    STRING_FIELDS.forEach(function (fieldKey) { draft[fieldKey] = ''; });
    draft.toolStatus = 'draft';
    draft.toolCategories = [];
    draft.toolTags = [];
    draft.toolParams = {};
    draft.externalApis = [];
    draft.docs = defaultDocs();
    draft.shots = [];
    return draft;
  }
  function normalizeApiEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    if (typeof entry.apiName !== 'string' || !entry.apiName.trim()) return null;
    var authType = VALID_AUTH_TYPES.indexOf(entry.authType) !== -1 ? entry.authType : 'none';
    return {
      id: typeof entry.id === 'string' && entry.id ? entry.id : 'api-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      apiName: String(entry.apiName).slice(0, 80),
      baseUrl: String(entry.baseUrl || '').slice(0, 300),
      authType: authType,
      authHeaderName: String(entry.authHeaderName || '').slice(0, 80),
      authValue: String(entry.authValue || '').slice(0, 500),
      usageNote: String(entry.usageNote || '').slice(0, 300)
    };
  }
  function normalizeShot(shot) {
    if (!shot || typeof shot !== 'object') return null;
    if (typeof shot.url !== 'string' || !shot.url) return null;
    return {
      id: typeof shot.id === 'string' && shot.id ? shot.id : 'shot-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      name: typeof shot.name === 'string' ? shot.name : 'screenshot.png',
      url: shot.url,
      size: Number(shot.size) || 0,
      type: typeof shot.type === 'string' ? shot.type : 'image/png',
      uploadedAt: typeof shot.uploadedAt === 'string' ? shot.uploadedAt : ''
    };
  }
  function normalize(value) {
    var normalized = { version: 1, draft: defaultDraft() };
    if (value && typeof value === 'object') {
      normalized.version = typeof value.version === 'number' ? Math.max(1, value.version) : 1;
      var savedDraft = value.draft;
      if (savedDraft && typeof savedDraft === 'object') {
        STRING_FIELDS.forEach(function (fieldKey) {
          if (typeof savedDraft[fieldKey] !== 'undefined' && savedDraft[fieldKey] !== null) {
            normalized.draft[fieldKey] = String(savedDraft[fieldKey]);
          }
        });
        if (VALID_STATUSES.indexOf(normalized.draft.toolStatus) === -1) normalized.draft.toolStatus = 'draft';
        var savedCategories = savedDraft.toolCategories;
        if (Array.isArray(savedCategories)) {
          var categoryList = savedCategories.filter(function (code) { return typeof code === 'string' && code; });
          normalized.draft.toolCategories = categoryList.filter(function (code, index) { return categoryList.indexOf(code) === index; });
        }
        var savedTags = savedDraft.toolTags;
        if (Array.isArray(savedTags)) {
          normalized.draft.toolTags = savedTags.filter(function (tag) { return typeof tag === 'string' && tag.trim(); });
        } else if (typeof savedTags === 'string' && savedTags.trim()) {
          var migratedTags = savedTags.split(',').map(function (tag) { return tag.trim(); }).filter(Boolean);
          normalized.draft.toolTags = migratedTags.filter(function (tag, index) { return migratedTags.indexOf(tag) === index; });
        }
        if (savedDraft.toolParams && typeof savedDraft.toolParams === 'object' && !Array.isArray(savedDraft.toolParams)) {
          normalized.draft.toolParams = JSON.parse(JSON.stringify(savedDraft.toolParams));
        }
        if (Array.isArray(savedDraft.externalApis)) {
          normalized.draft.externalApis = savedDraft.externalApis
            .map(normalizeApiEntry)
            .filter(function (apiEntry) { return apiEntry !== null; });
        }
        if (savedDraft.docs && typeof savedDraft.docs === 'object') {
          DOC_KEYS.forEach(function (docKey) {
            var savedDoc = savedDraft.docs[docKey];
            if (savedDoc && typeof savedDoc === 'object') {
              normalized.draft.docs[docKey].html = String(savedDoc.html || '');
              normalized.draft.docs[docKey].css = String(savedDoc.css || '');
              normalized.draft.docs[docKey].js = String(savedDoc.js || '');
            }
          });
        }
        if (Array.isArray(savedDraft.shots)) {
          normalized.draft.shots = savedDraft.shots
            .map(normalizeShot)
            .filter(function (shot) { return shot !== null; })
            .slice(0, SHOTS_LIMIT);
        }
      }
    }
    return normalized;
  }

  /* --------------------------------------------------------
     Persist (staged draft in this tool's own value)
  -------------------------------------------------------- */
  function persist() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(function () {
      _saving = true;
      try {
        tool.setValue(JSON.parse(JSON.stringify(DB)));
        setSaveState('staged');
        updateSizeMeter();
      } catch (error) {}
      setTimeout(function () { _saving = false; }, 400);
    }, 350);
  }
  function setSaveState(kind) {
    var element = $('wht-save-state');
    if (!element) return;
    if (kind === 'saved') { element.textContent = '✓ Saved'; element.classList.add('ok'); }
    else { element.textContent = 'Draft staged'; element.classList.remove('ok'); }
  }
  function updateSizeMeter() {
    var meter = $('wht-size-meter');
    if (!meter) return;
    var sizeBytes = 0;
    try { sizeBytes = JSON.stringify(DB).length; } catch (error) {}
    meter.textContent = formatBytes(sizeBytes) + ' / 1 MB';
    meter.classList.remove('warn', 'danger');
    if (sizeBytes > SIZE_DANGER_BYTES) meter.classList.add('danger');
    else if (sizeBytes > SIZE_WARN_BYTES) meter.classList.add('warn');
  }

  /* --------------------------------------------------------
     Identity / permissions
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
      if (typeof tool.getUser !== 'function') { _noIdentity = true; }
      else if (!_polled) {
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
    var badge = $('wht-role-badge');
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
    var root = $('wht-root');
    if (root) root.classList.toggle('wht-locked', locked);
    var lockNote = $('wht-lock-note');
    if (lockNote) lockNote.style.display = locked ? '' : 'none';
  }

  /* --------------------------------------------------------
     Validation
  -------------------------------------------------------- */
  function reportValidation() {
    var toolName = String(DB.draft.toolName || '').trim();
    try {
      if (toolName) tool.reportValid(true);
      else tool.reportValid(false, 'Tool name is required - enter it under Details.');
    } catch (error) {}
  }

  /* --------------------------------------------------------
     Rendering - details fields
  -------------------------------------------------------- */
  function renderDetails() {
    STRING_FIELDS.forEach(function (fieldKey) {
      var inputElement = $('wht-f-' + fieldKey);
      if (inputElement) inputElement.value = DB.draft[fieldKey];
    });
  }

  /* --------------------------------------------------------
     Rendering - categories and tags
  -------------------------------------------------------- */
  function activeCategories() {
    var rawParam = readParam('categoryList', '');
    if (rawParam) {
      var parsedList = parseJsonLenient(rawParam);
      if (Array.isArray(parsedList)) {
        return parsedList.map(function (entry) {
          if (typeof entry === 'string') return { code: slugCodeOf(entry), label: entry, group: 'Custom' };
          if (entry && typeof entry === 'object') {
            return {
              code: typeof entry.code === 'string' ? entry.code : slugCodeOf(String(entry.label || '')),
              label: typeof entry.label === 'string' ? entry.label : String(entry.code || ''),
              group: typeof entry.group === 'string' ? entry.group : 'Custom'
            };
          }
          return null;
        }).filter(function (category) { return category && category.label; });
      }
    }
    return WIDGET_CATEGORIES.slice();
  }
  function slugCodeOf(labelText) {
    return String(labelText || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'custom';
  }
  function categoryByCode(code) {
    var found = null;
    activeCategories().forEach(function (category) { if (category.code === code) found = category; });
    return found;
  }
  function renderCategories() {
    var listElement = $('wht-category-list');
    if (!listElement) return;
    var searchInput = $('wht-category-search');
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
      htmlParts.push('<div class="wht-cat-group">' + escHtml(groupName) + '</div>');
      grouped[groupName].forEach(function (category) {
        var isSelected = DB.draft.toolCategories.indexOf(category.code) !== -1;
        htmlParts.push('<label class="wht-cat-row' + (isSelected ? ' selected' : '') + '">'
          + '<input type="checkbox" class="wht-cat-check" data-code="' + escHtml(category.code) + '"' + (isSelected ? ' checked' : '') + '>'
          + '<span class="wht-cat-code">' + escHtml(category.code) + '</span>'
          + '<span class="wht-cat-label">' + escHtml(category.label) + '</span>'
          + '</label>');
      });
    });
    listElement.innerHTML = htmlParts.length ? htmlParts.join('') : '<div class="wht-cat-empty">No categories match the filter.</div>';
    var checkboxes = listElement.querySelectorAll('.wht-cat-check');
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
    var selectedElement = $('wht-category-selected');
    if (!selectedElement) return;
    var countElement = $('wht-category-count');
    if (countElement) countElement.textContent = DB.draft.toolCategories.length + ' selected';
    var chipsHtml = DB.draft.toolCategories.map(function (code) {
      var category = categoryByCode(code);
      var label = category ? category.label : code;
      return '<span class="wht-chip">' + escHtml(label)
        + ' <button class="wht-chip-remove" data-remove-category="' + escHtml(code) + '" title="Remove">×</button></span>';
    });
    selectedElement.innerHTML = chipsHtml.length ? chipsHtml.join('') : '<span class="wht-hint">No categories selected yet.</span>';
    var removeButtons = selectedElement.querySelectorAll('.wht-chip-remove');
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
      if (tag.length > TAG_MAX_LENGTH) tag = tag.slice(0, TAG_MAX_LENGTH);
      if (DB.draft.toolTags.indexOf(tag) !== -1) return;
      if (DB.draft.toolTags.length >= TAGS_LIMIT) return;
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
    var listElement = $('wht-tags-list');
    if (!listElement) return;
    var chipsHtml = DB.draft.toolTags.map(function (tag) {
      return '<span class="wht-chip">' + escHtml(tag)
        + ' <button class="wht-chip-remove" data-remove-tag="' + escHtml(tag) + '" title="Remove">×</button></span>';
    });
    listElement.innerHTML = chipsHtml.length ? chipsHtml.join('') : '<span class="wht-hint">No tags yet - type below and press Enter.</span>';
    var removeButtons = listElement.querySelectorAll('.wht-chip-remove');
    for (var buttonIndex = 0; buttonIndex < removeButtons.length; buttonIndex++) {
      (function (button) {
        button.addEventListener('click', function () { removeTag(button.getAttribute('data-remove-tag')); });
      })(removeButtons[buttonIndex]);
    }
    renderTagSuggestions();
  }
  function renderTagSuggestions() {
    var suggestElement = $('wht-tag-suggest');
    if (!suggestElement) return;
    var unusedSuggestions = TAG_SUGGESTIONS.filter(function (tag) {
      return DB.draft.toolTags.indexOf(tag) === -1;
    }).slice(0, 8);
    if (!unusedSuggestions.length) { suggestElement.innerHTML = ''; return; }
    suggestElement.innerHTML = '<span class="wht-hint">Suggestions: </span>' + unusedSuggestions.map(function (tag) {
      return '<button class="wht-tag-suggest-chip" data-suggest-tag="' + escHtml(tag) + '">' + escHtml(tag) + '</button>';
    }).join('');
    var suggestButtons = suggestElement.querySelectorAll('.wht-tag-suggest-chip');
    for (var buttonIndex = 0; buttonIndex < suggestButtons.length; buttonIndex++) {
      (function (button) {
        button.addEventListener('click', function () { addTag(button.getAttribute('data-suggest-tag')); });
      })(suggestButtons[buttonIndex]);
    }
  }

  /* --------------------------------------------------------
     Rendering - parameters schema (JSON object in the draft)
  -------------------------------------------------------- */
  function setSchemaPart(partName) {
    _activeSchemaPart = partName;
    var tabButtons = document.querySelectorAll('#wht-schema-params .wht-schema-tab');
    for (var tabIndex = 0; tabIndex < tabButtons.length; tabIndex++) {
      tabButtons[tabIndex].classList.toggle('active', tabButtons[tabIndex].getAttribute('data-schema-part') === partName);
    }
    ['json', 'sample', 'editor'].forEach(function (paneName) {
      var pane = $('wht-schema-pane-params-' + paneName);
      if (pane) pane.style.display = paneName === partName ? '' : 'none';
    });
  }
  function syncParamsField() {
    var textarea = $('wht-f-toolParams');
    if (textarea && document.activeElement !== textarea) {
      textarea.value = JSON.stringify(DB.draft.toolParams || {}, null, 2);
    }
    textarea.classList.remove('wht-invalid');
    renderParamsRows();
  }
  function refreshParamsValidity(textarea) {
    if (!textarea) return;
    var text = String(textarea.value || '').trim();
    if (!text) { textarea.classList.remove('wht-invalid'); return; }
    textarea.classList.toggle('wht-invalid', parseJsonLenient(text) === null);
  }
  function handleParamsJsonInput(event) {
    var textarea = event.target;
    var text = String(textarea.value || '').trim();
    if (!text) {
      DB.draft.toolParams = {};
      textarea.classList.remove('wht-invalid');
      renderParamsRows();
      persist();
      return;
    }
    var parsed = parseJsonLenient(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      DB.draft.toolParams = parsed;
      textarea.classList.remove('wht-invalid');
      renderParamsRows();
      persist();
    } else {
      textarea.classList.add('wht-invalid');
    }
  }
  function renderParamsRows() {
    var rowsElement = $('wht-schema-rows-params');
    if (!rowsElement) return;
    var keys = Object.keys(DB.draft.toolParams || {});
    if (!keys.length) {
      rowsElement.innerHTML = '<div class="wht-schema-empty">No parameters yet - add one or paste JSON in the JSON code tab.</div>';
      return;
    }
    rowsElement.innerHTML = keys.map(function (key) {
      return '<div class="wht-schema-row" data-row-key="' + escHtml(key) + '">'
        + '<input class="wht-input wht-schema-key" value="' + escHtml(key) + '" spellcheck="false">'
        + '<input class="wht-input wht-schema-value" value="' + escHtml(JSON.stringify(DB.draft.toolParams[key])) + '" spellcheck="false">'
        + '<button class="wht-btn wht-btn-ghost wht-btn-sm wht-schema-remove" title="Remove parameter">×</button>'
        + '</div>';
    }).join('');
  }
  function paramsValueFromText(rawText) {
    var text = String(rawText || '').trim();
    if (!text) return '';
    try { return JSON.parse(text); } catch (error) {}
    var parsedLenient = parseJsonLenient(text);
    if (parsedLenient !== null) return parsedLenient;
    return text;
  }
  function paramsObjectFromRows() {
    var params = {};
    var rows = document.querySelectorAll('#wht-schema-rows-params .wht-schema-row');
    for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      var keyInput = rows[rowIndex].querySelector('.wht-schema-key');
      var valueInput = rows[rowIndex].querySelector('.wht-schema-value');
      if (!keyInput || !valueInput) continue;
      var key = String(keyInput.value || '').trim();
      if (key && !Object.prototype.hasOwnProperty.call(params, key)) {
        params[key] = paramsValueFromText(valueInput.value);
      }
    }
    return params;
  }
  function addParamsRow() {
    var params = DB.draft.toolParams || {};
    params['newParameter'] = '';
    DB.draft.toolParams = params;
    syncParamsField();
    persist();
  }
  function handleParamsRowsClick(event) {
    var removeButton = event.target && event.target.closest ? event.target.closest('.wht-schema-remove') : null;
    if (!removeButton) return;
    var row = removeButton.closest('.wht-schema-row');
    if (!row) return;
    var key = row.getAttribute('data-row-key');
    var params = {};
    Object.keys(DB.draft.toolParams).forEach(function (existingKey) {
      if (existingKey !== key) params[existingKey] = DB.draft.toolParams[existingKey];
    });
    DB.draft.toolParams = params;
    syncParamsField();
    persist();
    logDiagnostics('params-row', 'removed ' + key);
  }
  function handleParamsRowsInput(event) {
    var target = event.target;
    if (!target || target.tagName !== 'INPUT') return;
    var targetClass = String(target.className || '');
    if (targetClass.indexOf('wht-schema-key') === -1 && targetClass.indexOf('wht-schema-value') === -1) return;
    DB.draft.toolParams = paramsObjectFromRows();
    var textarea = $('wht-f-toolParams');
    if (textarea && document.activeElement !== textarea) {
      textarea.value = JSON.stringify(DB.draft.toolParams, null, 2);
      textarea.classList.remove('wht-invalid');
    }
    persist();
  }

  /* --------------------------------------------------------
     Rendering - external API connections
  -------------------------------------------------------- */
  function authLabelOf(apiEntry) {
    if (apiEntry.authType === 'none') return AUTH_TYPE_LABELS.none;
    var headerName = apiEntry.authHeaderName || API_DEFAULT_HEADER_NAMES[apiEntry.authType] || '';
    return AUTH_TYPE_LABELS[apiEntry.authType] + (headerName ? ' (' + headerName + ')' : '');
  }
  function apiById(apiId) {
    var found = null;
    DB.draft.externalApis.forEach(function (apiEntry) { if (apiEntry.id === apiId) found = apiEntry; });
    return found;
  }
  function renderApiList() {
    var listElement = $('wht-api-list');
    if (!listElement) return;
    var apiList = DB.draft.externalApis;
    if (!apiList.length) {
      listElement.innerHTML = '<span class="wht-hint">No API connections yet - add one if this widget reads outside services.</span>';
      return;
    }
    listElement.innerHTML = apiList.map(function (apiEntry) {
      var noteHtml = apiEntry.usageNote ? '<span class="wht-api-note">' + escHtml(apiEntry.usageNote) + '</span>' : '';
      return '<div class="wht-api-row">'
        + '<div class="wht-api-info">'
        + '<span class="wht-api-name">' + escHtml(apiEntry.apiName) + '</span>'
        + '<span class="wht-api-url">' + escHtml(apiEntry.baseUrl) + '</span>'
        + noteHtml
        + '</div>'
        + '<span class="wht-api-badge">' + escHtml(authLabelOf(apiEntry)) + '</span>'
        + '<div class="wht-api-actions">'
        + '<button class="wht-btn wht-btn-ghost wht-btn-sm" data-act="api-edit" data-api-id="' + escHtml(apiEntry.id) + '">Edit</button>'
        + '<button class="wht-btn wht-btn-ghost wht-btn-sm wht-btn-danger" data-act="api-remove" data-api-id="' + escHtml(apiEntry.id) + '">Remove</button>'
        + '</div></div>';
    }).join('');
  }
  function openApiForm(apiId) {
    _editingApiId = apiId || '';
    var apiEntry = apiId ? apiById(apiId) : null;
    var formTitle = $('wht-api-form-title');
    if (formTitle) formTitle.textContent = apiEntry ? 'Edit API connection' : 'New API connection';
    var nameInput = $('wht-api-name');
    var baseUrlInput = $('wht-api-baseUrl');
    var authTypeSelect = $('wht-api-authType');
    var authHeaderInput = $('wht-api-authHeaderName');
    var authValueInput = $('wht-api-authValue');
    var usageNoteInput = $('wht-api-usageNote');
    if (nameInput) nameInput.value = apiEntry ? apiEntry.apiName : '';
    if (baseUrlInput) baseUrlInput.value = apiEntry ? apiEntry.baseUrl : '';
    if (authTypeSelect) authTypeSelect.value = apiEntry ? apiEntry.authType : 'none';
    if (authHeaderInput) authHeaderInput.value = apiEntry ? apiEntry.authHeaderName : '';
    if (authValueInput) authValueInput.value = apiEntry ? apiEntry.authValue : '';
    if (usageNoteInput) usageNoteInput.value = apiEntry ? apiEntry.usageNote : '';
    var form = $('wht-api-form');
    if (form) form.style.display = '';
    try { tool.resize(); } catch (error) {}
  }
  function closeApiForm() {
    _editingApiId = '';
    var form = $('wht-api-form');
    if (form) form.style.display = 'none';
    try { tool.resize(); } catch (error) {}
  }
  function saveApiForm() {
    var nameInput = $('wht-api-name');
    var baseUrlInput = $('wht-api-baseUrl');
    var authTypeSelect = $('wht-api-authType');
    var authHeaderInput = $('wht-api-authHeaderName');
    var authValueInput = $('wht-api-authValue');
    var usageNoteInput = $('wht-api-usageNote');
    var apiName = String(nameInput && nameInput.value || '').trim();
    if (!apiName) { notify('API name is required.', 'error'); return; }
    var authType = authTypeSelect && VALID_AUTH_TYPES.indexOf(authTypeSelect.value) !== -1 ? authTypeSelect.value : 'none';
    var authHeaderName = String(authHeaderInput && authHeaderInput.value || '').trim();
    if (authType !== 'none' && !authHeaderName) authHeaderName = API_DEFAULT_HEADER_NAMES[authType];
    var apiEntry = {
      id: _editingApiId || 'api-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      apiName: apiName,
      baseUrl: String(baseUrlInput && baseUrlInput.value || '').trim(),
      authType: authType,
      authHeaderName: authHeaderName,
      authValue: String(authValueInput && authValueInput.value || '').trim(),
      usageNote: String(usageNoteInput && usageNoteInput.value || '').trim()
    };
    var wasEditing = !!_editingApiId;
    if (_editingApiId) {
      var replaced = false;
      DB.draft.externalApis = DB.draft.externalApis.map(function (existingEntry) {
        if (existingEntry.id === _editingApiId) { replaced = true; return apiEntry; }
        return existingEntry;
      });
      if (!replaced) DB.draft.externalApis.push(apiEntry);
    } else {
      DB.draft.externalApis.push(apiEntry);
    }
    closeApiForm();
    persist();
    renderApiList();
    logDiagnostics('api-save', (wasEditing ? 'updated ' : 'added ') + apiName + ' (' + authLabelOf(apiEntry) + ')');
    notify('API connection saved: ' + apiName, 'success');
  }
  function removeApi(apiId) {
    var apiEntry = apiById(apiId);
    if (!apiEntry) return;
    if (_apiRemoveArmed !== apiId) {
      _apiRemoveArmed = apiId;
      clearTimeout(_apiRemoveArmTimer);
      _apiRemoveArmTimer = setTimeout(function () {
        _apiRemoveArmed = '';
        renderApiList();
        renderApiRemoveArmed();
      }, 5000);
      notify('Click Remove again within 5 seconds to delete "' + apiEntry.apiName + '".', 'warning');
      renderApiList();
      renderApiRemoveArmed();
      return;
    }
    _apiRemoveArmed = '';
    clearTimeout(_apiRemoveArmTimer);
    DB.draft.externalApis = DB.draft.externalApis.filter(function (existingEntry) { return existingEntry.id !== apiId; });
    persist();
    renderApiList();
    renderApiRemoveArmed();
    logDiagnostics('api-remove', apiEntry.apiName + ' removed');
    notify('API connection removed: ' + apiEntry.apiName, 'info');
  }
  function handleApiActionClick(event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-act]') : null;
    if (!button) return;
    var action = button.getAttribute('data-act');
    var apiId = button.getAttribute('data-api-id');
    if (action === 'api-edit') openApiForm(apiId);
    else if (action === 'api-remove') removeApi(apiId);
  }
  function renderApiRemoveArmed() {
    var removeButtons = document.querySelectorAll('#wht-api-list [data-act="api-remove"]');
    for (var index = 0; index < removeButtons.length; index++) {
      var button = removeButtons[index];
      var armed = button.getAttribute('data-api-id') === _apiRemoveArmed;
      button.textContent = armed ? 'Confirm?' : 'Remove';
      button.classList.toggle('wht-btn-danger', !armed);
      button.classList.toggle('wht-btn-primary', armed);
    }
  }

  /* --------------------------------------------------------
     Rendering - code editors
  -------------------------------------------------------- */
  function renderCodeEditors() {
    CODE_FIELDS.forEach(function (codeKey) {
      var textarea = $('wht-code-' + codeKey);
      if (textarea && document.activeElement !== textarea) textarea.value = DB.draft[codeKey];
      updateCodeMeta(codeKey);
      updateGutter(codeKey);
    });
  }
  function updateCodeMeta(codeKey) {
    var textarea = $('wht-code-' + codeKey);
    var metaElement = $('wht-meta-' + CODE_TAB_OF_FIELD[codeKey]);
    if (!textarea || !metaElement) return;
    var text = textarea.value || '';
    var lineCount = text ? text.split('\n').length : 1;
    metaElement.textContent = lineCount + ' lines · ' + text.length + ' chars';
  }
  function updateGutter(codeKey) {
    var textarea = $('wht-code-' + codeKey);
    var gutter = $('wht-gutter-' + CODE_TAB_OF_FIELD[codeKey]);
    if (!textarea || !gutter) return;
    var lineCount = textarea.value ? textarea.value.split('\n').length : 1;
    var lineNumbers = [];
    for (var lineNumber = 1; lineNumber <= lineCount; lineNumber++) lineNumbers.push(lineNumber);
    gutter.textContent = lineNumbers.join('\n');
  }
  function bindCodeEditor(codeKey) {
    var textarea = $('wht-code-' + codeKey);
    if (!textarea) return;
    function onCodeChanged() {
      DB.draft[codeKey] = textarea.value;
      updateCodeMeta(codeKey);
      persist();
      clearTimeout(_gutterTimers[codeKey]);
      _gutterTimers[codeKey] = setTimeout(function () { updateGutter(codeKey); }, 160);
    }
    textarea.addEventListener('input', onCodeChanged);
    textarea.addEventListener('scroll', function () {
      var gutter = $('wht-gutter-' + CODE_TAB_OF_FIELD[codeKey]);
      if (gutter) gutter.scrollTop = textarea.scrollTop;
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
     Tabs
  -------------------------------------------------------- */
  function renderAll() {
    renderDetails();
    renderCodeEditors();
    renderCategories();
    renderCategorySelected();
    renderTags();
    syncParamsField();
    renderApiList();
    renderApiRemoveArmed();
    ensureDocsStructure();
    renderShots();
    renderUser();
    updateSizeMeter();
    updateUploadHint();
  }
  function switchTab(tabName) {
    _activeTab = tabName;
    var tabButtons = document.querySelectorAll('.wht-tab');
    for (var tabIndex = 0; tabIndex < tabButtons.length; tabIndex++) {
      tabButtons[tabIndex].classList.toggle('active', tabButtons[tabIndex].getAttribute('data-tab') === tabName);
    }
    ['details', 'html', 'css', 'js', 'preview', 'docs', 'screenshots', 'logs'].forEach(function (paneName) {
      var pane = $('pane-' + paneName);
      if (pane) pane.style.display = paneName === tabName ? '' : 'none';
    });
    if (tabName === 'preview' && !_previewBuilt) renderPreview();
    if (tabName === 'docs') ensureDocsStructure();
    if (tabName === 'screenshots') renderShots();
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
     Preview - mock window.gw SDK inside a sandboxed frame
  -------------------------------------------------------- */
  function previewGwSource(paramsObject, mockDataObject) {
    var source = (function () {
      var pageParams = JSON.parse('__WHT_MOCK_PARAMS__');
      var mockData = JSON.parse('__WHT_MOCK_DATA__');
      var listeners = {};
      function register(eventName, callback) {
        (listeners[eventName] = listeners[eventName] || []).push(callback);
      }
      function log(message, kind) {
        var panel = document.getElementById('wht-mock-panel');
        if (!panel) {
          panel = document.createElement('div');
          panel.id = 'wht-mock-panel';
          panel.style.cssText = 'position:fixed;right:10px;bottom:10px;width:320px;z-index:2147483000;font:11px/1.5 Consolas,monospace;color:#cbd5e1;border-radius:8px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.45)';
          panel.innerHTML = '<div style="font:600 11px/1.4 Arial;color:#fff;background:#0f172a;padding:6px 10px">PREVIEW MOCK gw SDK</div><div id="wht-mock-log" style="max-height:120px;overflow:auto;background:#1e293b;padding:6px 10px"></div>';
          (document.body || document.documentElement).appendChild(panel);
        }
        var logList = document.getElementById('wht-mock-log');
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
      var localStore = {};
      var sessionStore = {};
      function makeStorage(backingStore) {
        return {
          get: function (key) {
            return typeof backingStore[key] !== 'undefined' ? backingStore[key] : null;
          },
          set: function (key, value) { backingStore[key] = value; },
          remove: function (key) { delete backingStore[key]; }
        };
      }
      var gw = {
        pageId: 'mock-page',
        siteId: 'mock-site',
        folderId: 'mock-folder',
        language: 'en',
        host: 'demo.uniconhub.com',
        currency: 'USD',
        ns: {},
        getPageParams: function () { return pageParams; },
        navigate: function (path) { log('gw.navigate: ' + path, 'gw'); },
        openUrl: function (url) { log('gw.openUrl: ' + url, 'gw'); },
        onRouteChange: function (callback) {
          register('routeChange', callback);
          return function unsubscribe() {};
        },
        getUser: function () { return null; },
        isAuthenticated: function () { return false; },
        authReady: Promise.resolve(null),
        refreshAuth: function () { return Promise.resolve(null); },
        login: function () { log('gw.login()', 'gw'); },
        logout: function () { log('gw.logout()', 'gw'); },
        storage: makeStorage(localStore),
        formatCurrency: function (amount, currency) {
          var currencyCode = currency || gw.currency || 'USD';
          try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(Number(amount) || 0);
          } catch (error) { return String(amount); }
        },
        formatDate: function (value, locale) {
          var parsedDate = new Date(value);
          if (isNaN(parsedDate.getTime())) return String(value);
          try { return parsedDate.toLocaleDateString(locale); } catch (error) { return parsedDate.toDateString(); }
        },
        notify: function (message, options) {
          log(message, (options && options.severity) || 'notify');
        },
        showModal: function (html, options) {
          log('gw.showModal: ' + String(html).slice(0, 80), 'gw');
          return function closeModal() {};
        },
        setLoading: function (isLoading) { log('gw.setLoading(' + isLoading + ')', 'gw'); },
        sanitize: function (html) { return html; },
        track: function (eventName, eventData) { log('gw.track: ' + eventName, 'gw'); },
        trackPageView: function () { log('gw.trackPageView()', 'gw'); },
        forms: {
          bind: function (rootElement) {
            var scope = rootElement || document;
            var formList = scope.querySelectorAll ? scope.querySelectorAll('form[data-gw-form], form.gw-form') : [];
            for (var formIndex = 0; formIndex < formList.length; formIndex++) {
              (function (form) {
                if (form.getAttribute('data-wht-mock-bound')) return;
                form.setAttribute('data-wht-mock-bound', '1');
                form.addEventListener('submit', function (event) {
                  event.preventDefault();
                  log('form submitted: ' + (form.getAttribute('data-gw-form') || 'gw-form'), 'gw');
                  var statusElement = form.querySelector('[data-gw-form-status]');
                  if (statusElement) statusElement.textContent = 'Submitting... (mock)';
                  setTimeout(function () {
                    if (statusElement) statusElement.textContent = 'Submitted (mock gw).';
                    form.dispatchEvent(new CustomEvent('gw:form-success', { detail: { form: form, data: {} }, bubbles: true }));
                  }, 250);
                });
              })(formList[formIndex]);
            }
            log('gw.forms.bind: ' + formList.length + ' form(s)', 'gw');
          },
          submit: function (form, options) { log('gw.forms.submit (mock)', 'gw'); }
        },
        db: {
          query: function (params) {
            var objectType = params && params.cmsObjectType;
            var itemList = (mockData && mockData[objectType]) ? mockData[objectType].slice() : [];
            var pageSize = (params && params.pageSize) || 50;
            log('gw.db.query ' + objectType + ' -> ' + itemList.length + ' mock item(s)', 'gw');
            return Promise.resolve({
              items: itemList.slice(0, pageSize),
              total: itemList.length,
              page: 1,
              pageSize: pageSize,
              facets: {},
              relations: {}
            });
          },
          get: function (params) {
            var objectType = params && params.cmsObjectType;
            var objectId = params && params.objectId;
            var itemList = (mockData && mockData[objectType]) || [];
            for (var itemIndex = 0; itemIndex < itemList.length; itemIndex++) {
              if (String(itemList[itemIndex].id) === String(objectId)) {
                log('gw.db.get ' + objectType + '/' + objectId + ' -> found', 'gw');
                return Promise.resolve(itemList[itemIndex]);
              }
            }
            log('gw.db.get ' + objectType + '/' + objectId + ' -> null', 'gw');
            return Promise.resolve(null);
          },
          operation: function (operationId, payload, options) {
            log('gw.db.operation ' + operationId + ' (mock)', 'gw');
            return Promise.resolve({ ok: true, result: {} });
          },
          subscribe: function (params, onChange) {
            log('gw.db.subscribe ' + (params && params.cmsObjectType), 'gw');
            return function unsubscribe() {};
          }
        },
        apps: {
          register: function (name, factory) { log('gw.apps.register: ' + name, 'gw'); },
          mount: function () { log('gw.apps.mount()', 'gw'); },
          unmount: function () { log('gw.apps.unmount()', 'gw'); }
        }
      };
      gw.storage.session = makeStorage(sessionStore);
      window.gw = gw;
      log('gw SDK ready. pageParams = ' + JSON.stringify(pageParams).slice(0, 200), 'mock');
      try {
        window.dispatchEvent(new CustomEvent('gw:ready', {
          detail: { pageId: gw.pageId, siteId: gw.siteId, folderId: gw.folderId, language: gw.language }
        }));
      } catch (error) {}
    }).toString();
    return source
      .replace('__WHT_MOCK_PARAMS__', JSON.stringify(paramsObject || {}).replace(/</g, '\\u003c'))
      .replace('__WHT_MOCK_DATA__', JSON.stringify(mockDataObject || {}).replace(/</g, '\\u003c'));
  }

  function buildPreviewDoc(htmlCode, cssCode, jsCode, paramsObject, mockDataObject) {
    var jsSyntaxError = checkJsSyntax(jsCode);
    var scriptOpen = '<' + 'script' + '>';
    var scriptClose = '<' + '/' + 'script' + '>';
    var parts = [];
    parts.push('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">');
    parts.push('<meta name="viewport" content="width=device-width,initial-scale=1">');
    parts.push('<title>Website tool preview</title>');
    parts.push('<style>');
    parts.push(':root{--gw-color-primary:#1e4e79;--gw-color-accent:#2563eb;--gw-color-bg:#ffffff;--gw-color-surface:#f1f5f9;--gw-color-card:#ffffff;--gw-color-ink:#0f172a;--gw-color-muted:#64748b;--gw-color-line:#e2e8f0;}');
    parts.push('html,body{margin:0;padding:0;}body{background:var(--gw-color-bg);color:var(--gw-color-ink);}');
    parts.push(cssCode || '');
    parts.push('</style>');
    parts.push('</head><body>');
    parts.push(htmlCode || '');
    parts.push(scriptOpen + '(' + previewGwSource(paramsObject, mockDataObject) + ')();' + scriptClose);
    if (!jsSyntaxError && String(jsCode || '').trim()) {
      parts.push(scriptOpen + String(jsCode).replace(/<\/script/gi, '<\\/script') + scriptClose);
    }
    parts.push(scriptOpen
      + 'try { window.dispatchEvent(new CustomEvent(\'gw:content-ready\', { detail: { contentId: \'preview\' } })); } catch (error) {}'
      + scriptClose);
    parts.push('</body></html>');
    return { doc: parts.join('\n'), jsSyntaxError: jsSyntaxError };
  }

  function mergedPreviewParams(overrideText) {
    var merged = {};
    Object.keys(DB.draft.toolParams || {}).forEach(function (key) { merged[key] = DB.draft.toolParams[key]; });
    var overrideParams = safeJsonObject(overrideText);
    Object.keys(overrideParams).forEach(function (key) { merged[key] = overrideParams[key]; });
    return merged;
  }
  function previewMockData() {
    return safeJsonObject(readParam('previewMockData', '{}'));
  }
  function renderPreview() {
    _previewBuilt = true;
    var frame = $('wht-preview-frame');
    var statusElement = $('wht-preview-status');
    if (!frame) return;
    var paramsInput = $('wht-preview-params');
    var params = mergedPreviewParams(paramsInput ? paramsInput.value : '{}');
    var built = buildPreviewDoc(DB.draft.toolHtmlCode, DB.draft.toolCssCode, DB.draft.toolJsCode, params, previewMockData());
    frame.srcdoc = built.doc;
    if (statusElement) {
      if (built.jsSyntaxError) {
        statusElement.textContent = 'JS syntax error: ' + built.jsSyntaxError;
        statusElement.className = 'wht-preview-status err';
      } else {
        statusElement.textContent = 'Preview rebuilt ' + formatTime(new Date());
        statusElement.className = 'wht-preview-status ok';
      }
    }
    logDiagnostics('preview', 'rebuilt widget preview' + (built.jsSyntaxError ? ' - JS error: ' + built.jsSyntaxError : ''));
    try { tool.resize(); } catch (error) {}
  }

  /* --------------------------------------------------------
     Documents (webpage / help / updates)
  -------------------------------------------------------- */
  function ensureDocsStructure() {
    var tabsElement = $('wht-doc-tabs');
    var contentElement = $('wht-doc-content');
    if (!tabsElement || !contentElement) return;
    var validDocKey = DOC_KEYS.indexOf(_activeDocKey) !== -1 ? _activeDocKey : 'webpage';
    _activeDocKey = validDocKey;
    tabsElement.innerHTML = DOC_KEYS.map(function (docKey) {
      return '<button class="wht-doc-tab' + (docKey === _activeDocKey ? ' active' : '') + '" data-doc-tab="' + docKey + '">'
        + DOC_LABELS[docKey] + '</button>';
    }).join('');
    if (contentElement.getAttribute('data-wht-doc') !== _activeDocKey) {
      contentElement.setAttribute('data-wht-doc', _activeDocKey);
      contentElement.innerHTML = buildDocPaneHtml(_activeDocKey);
    }
    setActiveDocPart(_activeDocKey, _activeDocPart[_activeDocKey] || 'preview');
    refreshDocPaneValues(_activeDocKey);
  }
  function buildDocPaneHtml(docKey) {
    var parts = [];
    parts.push('<div class="wht-doc-head">'
      + '<div class="wht-doc-head-main">'
      + '<span class="wht-doc-title">' + DOC_LABELS[docKey] + ' document</span>'
      + '<span class="wht-doc-subline">Public ' + DOC_LABELS[docKey].toLowerCase() + ' content for this website tool. Stored in this tool\'s own saved value.</span>'
      + '</div></div>');
    parts.push('<div class="wht-doc-workspace">');
    parts.push('<div class="wht-doc-sub-tabs">');
    DOC_PARTS.forEach(function (partName) {
      parts.push('<button class="wht-doc-sub-tab' + (partName === 'preview' ? ' active' : '') + '" data-doc-part="' + partName + '">'
        + partLabel(partName) + '</button>');
    });
    parts.push('</div>');
    parts.push('<div class="wht-doc-part" id="wht-doc-part-' + docKey + '-preview">'
      + '<div class="wht-preview-bar">'
      + '<button class="wht-btn wht-btn-primary wht-btn-sm" data-act="doc-preview" data-doc="' + docKey + '">▶ Rebuild preview</button>'
      + '<span class="wht-hint">Renders the document fragment with the mock gw SDK.</span>'
      + '<span class="wht-preview-status" id="wht-doc-preview-status-' + docKey + '">Not built yet</span>'
      + '</div>'
      + '<iframe class="wht-preview-frame" id="wht-doc-preview-frame-' + docKey + '" sandbox="allow-scripts allow-forms allow-downloads allow-popups" title="' + DOC_LABELS[docKey] + ' preview"></iframe>'
      + '</div>');
    ['html', 'css', 'js'].forEach(function (partName) {
      var hintByPart = {
        html: 'Body fragment only - no &lt;html&gt; / &lt;head&gt; / &lt;body&gt; tags.',
        css: 'Scoped under a root wrapper class.',
        js: 'Vanilla JS - idempotent, no &lt;script&gt; tag.'
      };
      parts.push('<div class="wht-doc-part" id="wht-doc-part-' + docKey + '-' + partName + '" style="display:none">'
        + '<div class="wht-editor">'
        + '<div class="wht-editor-head">'
        + '<span class="wht-editor-title">' + DOC_LABELS[docKey] + ' ' + partName.toUpperCase() + '</span>'
        + '<span class="wht-editor-hint">' + hintByPart[partName] + '</span>'
        + '<span class="wht-editor-meta" id="wht-doc-meta-' + docKey + '-' + partName + '">0 lines · 0 chars</span>'
        + '</div>'
        + '<div class="wht-editor-body">'
        + '<pre class="wht-gutter" id="wht-doc-gutter-' + docKey + '-' + partName + '" aria-hidden="true">1</pre>'
        + '<textarea class="wht-code wht-code-sm" id="wht-doc-code-' + docKey + '-' + partName + '" spellcheck="false" wrap="off" data-doc-field="' + docKey + '.' + partName + '" placeholder="' + DOC_LABELS[docKey] + ' ' + partName.toUpperCase() + ' content"></textarea>'
        + '</div></div></div>');
    });
    parts.push('</div>');
    return parts.join('');
  }
  function partLabel(partName) {
    return partName === 'preview' ? 'Preview' : partName.toUpperCase();
  }
  function setActiveDocPart(docKey, partName) {
    if (DOC_PARTS.indexOf(partName) === -1) partName = 'preview';
    _activeDocPart[docKey] = partName;
    DOC_PARTS.forEach(function (candidatePart) {
      var pane = $('wht-doc-part-' + docKey + '-' + candidatePart);
      if (pane) pane.style.display = candidatePart === partName ? '' : 'none';
    });
    var subTabButtons = document.querySelectorAll('#wht-doc-content .wht-doc-sub-tab');
    for (var index = 0; index < subTabButtons.length; index++) {
      subTabButtons[index].classList.toggle('active', subTabButtons[index].getAttribute('data-doc-part') === partName);
    }
    if (partName === 'preview' && docKey === _activeDocKey) renderDocPreview(docKey);
  }
  function refreshDocPaneValues(docKey) {
    ['html', 'css', 'js'].forEach(function (partName) {
      var textarea = $('wht-doc-code-' + docKey + '-' + partName);
      if (!textarea) return;
      if (document.activeElement !== textarea) textarea.value = DB.draft.docs[docKey][partName];
      updateDocMeta(docKey, partName, textarea);
      updateDocGutter(docKey, partName);
    });
  }
  function updateDocMeta(docKey, partName, textarea) {
    var metaElement = $('wht-doc-meta-' + docKey + '-' + partName);
    if (!metaElement) return;
    var text = textarea.value || '';
    var lineCount = text ? text.split('\n').length : 1;
    metaElement.textContent = lineCount + ' lines · ' + text.length + ' chars';
  }
  function updateDocGutter(docKey, partName) {
    var textarea = $('wht-doc-code-' + docKey + '-' + partName);
    var gutter = $('wht-doc-gutter-' + docKey + '-' + partName);
    if (!textarea || !gutter) return;
    var lineCount = textarea.value ? textarea.value.split('\n').length : 1;
    var lineNumbers = [];
    for (var lineNumber = 1; lineNumber <= lineCount; lineNumber++) lineNumbers.push(lineNumber);
    gutter.textContent = lineNumbers.join('\n');
  }
  function handleDocInput(event) {
    var target = event.target;
    var docField = target.getAttribute ? target.getAttribute('data-doc-field') : null;
    if (!docField) return;
    var fieldParts = docField.split('.');
    var docKey = fieldParts[0];
    var partName = fieldParts[1];
    if (DOC_KEYS.indexOf(docKey) === -1 || DOC_PARTS.indexOf(partName) === -1) return;
    DB.draft.docs[docKey][partName] = target.value;
    updateDocMeta(docKey, partName, target);
    persist();
    clearTimeout(_docGutterTimers[docField]);
    _docGutterTimers[docField] = setTimeout(function () { updateDocGutter(docKey, partName); }, 160);
  }
  function handleDocKeydown(event) {
    var target = event.target;
    if (!target || target.tagName !== 'TEXTAREA') return;
    if (event.key !== 'Tab') return;
    if (!target.getAttribute('data-doc-field')) return;
    event.preventDefault();
    var selectionStart = target.selectionStart;
    var selectionEnd = target.selectionEnd;
    target.value = target.value.substring(0, selectionStart) + '  ' + target.value.substring(selectionEnd);
    target.selectionStart = target.selectionEnd = selectionStart + 2;
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function handleDocPartClick(event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-doc-part]') : null;
    if (!button) return;
    setActiveDocPart(_activeDocKey, button.getAttribute('data-doc-part'));
  }
  function handleDocActionClick(event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-act="doc-preview"]') : null;
    if (!button) return;
    var docKey = button.getAttribute('data-doc');
    if (DOC_KEYS.indexOf(docKey) === -1) return;
    renderDocPreview(docKey);
  }
  function renderDocPreview(docKey) {
    var frame = $('wht-doc-preview-frame-' + docKey);
    var statusElement = $('wht-doc-preview-status-' + docKey);
    if (!frame) return;
    var doc = DB.draft.docs[docKey];
    var built = buildPreviewDoc(doc.html, doc.css, doc.js, mergedPreviewParams(''), previewMockData());
    frame.srcdoc = built.doc;
    if (statusElement) {
      if (built.jsSyntaxError) {
        statusElement.textContent = 'JS syntax error: ' + built.jsSyntaxError;
        statusElement.className = 'wht-preview-status err';
      } else {
        statusElement.textContent = 'Preview rebuilt ' + formatTime(new Date());
        statusElement.className = 'wht-preview-status ok';
      }
    }
    logDiagnostics('doc-preview', docKey + ' preview rebuilt' + (built.jsSyntaxError ? ' - JS error: ' + built.jsSyntaxError : ''));
  }

  /* --------------------------------------------------------
     Screenshots (storage URLs only)
  -------------------------------------------------------- */
  function updateUploadHint() {
    var hintElement = $('wht-shots-upload-hint');
    if (!hintElement) return;
    if (String(readParam('allowUpload', '') || '').trim() === 'yes') {
      hintElement.textContent = '';
    } else {
      hintElement.textContent = 'Set allowUpload: yes in the field settings to enable uploads.';
    }
  }
  function uploadScreenshot() {
    if (!canWrite()) { notify('Read-only - uploads are disabled.', 'warning'); return; }
    if (_shotsBusy) return;
    if (typeof tool.requestUpload !== 'function') {
      notify('Upload API is unavailable (allowUpload off).', 'warning');
      return;
    }
    _shotsBusy = true;
    logDiagnostics('shot-upload', 'requesting upload...');
    tool.requestUpload('image/*', function (uploadError, uploadedFile) {
      _shotsBusy = false;
      if (uploadError || !uploadedFile) {
        logDiagnostics('shot-upload', 'failed: ' + (uploadError || 'no file returned'));
        notify('Screenshot upload failed: ' + (uploadError || 'no file returned'), 'error');
        renderShots();
        return;
      }
      _shotSequence += 1;
      DB.draft.shots.push({
        id: 'shot-' + Date.now() + '-' + _shotSequence,
        name: String(uploadedFile.name || 'screenshot-' + _shotSequence + '.png'),
        url: String(uploadedFile.url || ''),
        size: Number(uploadedFile.size) || 0,
        type: String(uploadedFile.type || 'image/png'),
        uploadedAt: new Date().toISOString()
      });
      if (DB.draft.shots.length > SHOTS_LIMIT) DB.draft.shots = DB.draft.shots.slice(-SHOTS_LIMIT);
      persist();
      renderShots();
      logDiagnostics('shot-upload', 'stored ' + uploadedFile.name + ' (' + formatBytes(uploadedFile.size) + ')');
      notify('Screenshot stored: ' + uploadedFile.name, 'success');
    });
  }
  function renderShots() {
    var listElement = $('wht-shots-list');
    var countElement = $('wht-shots-count');
    if (countElement) countElement.textContent = DB.draft.shots.length + ' screenshot' + (DB.draft.shots.length === 1 ? '' : 's');
    if (!listElement) return;
    if (!DB.draft.shots.length) {
      listElement.innerHTML = '<div class="wht-shot-empty">No screenshots yet - upload one to show how the widget looks on a page.</div>';
      return;
    }
    listElement.innerHTML = DB.draft.shots.map(function (shot) {
      return '<div class="wht-shot-row">'
        + '<span class="wht-shot-thumb"><img src="' + escHtml(shot.url) + '" alt="' + escHtml(shot.name) + '" loading="lazy"></span>'
        + '<span class="wht-shot-info">'
        + '<span class="wht-shot-name">' + escHtml(shot.name) + '</span>'
        + '<span class="wht-shot-meta">' + formatBytes(shot.size) + ' · ' + formatDateTime(shot.uploadedAt) + '</span>'
        + '<span class="wht-shot-meta">' + escHtml(shot.url) + '</span>'
        + '</span>'
        + '<span class="wht-shot-actions">'
        + '<button class="wht-btn wht-btn-ghost wht-btn-sm" data-act="shot-copy" data-shot-id="' + escHtml(shot.id) + '">Copy URL</button>'
        + '<button class="wht-btn wht-btn-ghost wht-btn-sm" data-act="shot-insert" data-shot-id="' + escHtml(shot.id) + '">Insert into HTML</button>'
        + '<button class="wht-btn wht-btn-ghost wht-btn-sm wht-btn-danger" data-act="shot-remove" data-shot-id="' + escHtml(shot.id) + '">Remove</button>'
        + '</span></div>';
    }).join('');
  }
  function shotById(shotId) {
    var found = null;
    DB.draft.shots.forEach(function (shot) { if (shot.id === shotId) found = shot; });
    return found;
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        notify('Copied to clipboard.', 'success');
      }).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    var helper = document.createElement('textarea');
    helper.value = text;
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    try { document.execCommand('copy'); notify('Copied to clipboard.', 'success'); } catch (error) {
      notify('Copy failed - select the URL manually.', 'error');
    }
    document.body.removeChild(helper);
  }
  function currentHtmlEditorTarget() {
    var activeElement = document.activeElement;
    var htmlEditorIds = ['wht-code-toolHtmlCode'];
    DOC_KEYS.forEach(function (docKey) { htmlEditorIds.push('wht-doc-code-' + docKey + '-html'); });
    if (activeElement && htmlEditorIds.indexOf(activeElement.id) !== -1) return activeElement;
    var activeDocEditor = $('wht-doc-code-' + _activeDocKey + '-html');
    if (activeDocEditor && DOC_KEYS.indexOf(_activeDocKey) !== -1) return activeDocEditor;
    return $('wht-code-toolHtmlCode');
  }
  function insertShotAtCursor(shotId) {
    var shot = shotById(shotId);
    if (!shot) return;
    var targetEditor = currentHtmlEditorTarget();
    if (!targetEditor) { notify('Open an HTML editor first.', 'warning'); return; }
    var markup = '<img src="' + shot.url + '" alt="' + shot.name.replace(/"/g, '&quot;') + '" loading="lazy">';
    var selectionStart = targetEditor.selectionStart;
    var selectionEnd = targetEditor.selectionEnd;
    targetEditor.value = targetEditor.value.substring(0, selectionStart) + markup + targetEditor.value.substring(selectionEnd);
    var cursorPosition = selectionStart + markup.length;
    targetEditor.selectionStart = targetEditor.selectionEnd = cursorPosition;
    targetEditor.dispatchEvent(new Event('input', { bubbles: true }));
    targetEditor.focus();
    logDiagnostics('shot-insert', shot.name + ' inserted into ' + (targetEditor.id || 'editor'));
    notify('Image inserted into the HTML editor.', 'success');
  }
  function removeShot(shotId) {
    var shot = shotById(shotId);
    if (!shot) return;
    DB.draft.shots = DB.draft.shots.filter(function (entry) { return entry.id !== shotId; });
    persist();
    renderShots();
    logDiagnostics('shot-remove', shot.name + ' removed (file stays in storage)');
    notify('Screenshot entry removed.', 'info');
  }
  function handleShotsActionClick(event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-act]') : null;
    if (!button) return;
    var action = button.getAttribute('data-act');
    var shotId = button.getAttribute('data-shot-id');
    if (action === 'shot-copy') copyText(shotById(shotId) ? shotById(shotId).url : '');
    else if (action === 'shot-insert') insertShotAtCursor(shotId);
    else if (action === 'shot-remove') removeShot(shotId);
  }

  /* --------------------------------------------------------
     Event wiring
  -------------------------------------------------------- */
  function wireEvents() {
    var tabButtons = document.querySelectorAll('.wht-tab');
    for (var tabIndex = 0; tabIndex < tabButtons.length; tabIndex++) {
      (function (tabButton) {
        tabButton.addEventListener('click', function () { switchTab(tabButton.getAttribute('data-tab')); });
      })(tabButtons[tabIndex]);
    }

    STRING_FIELDS.forEach(function (fieldKey) {
      var inputElement = $('wht-f-' + fieldKey);
      if (!inputElement) return;
      inputElement.addEventListener('input', function () {
        DB.draft[fieldKey] = inputElement.value;
        persist();
        if (fieldKey === 'toolName') reportValidation();
      });
    });

    CODE_FIELDS.forEach(bindCodeEditor);

    on('wht-btn-rebuild', 'click', renderPreview);
    on('wht-preview-params', 'input', debounce(function () {
      if (_previewBuilt) renderPreview();
    }, 400));
    on('wht-preview-params', 'keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); renderPreview(); }
    });

    on('wht-category-search', 'input', debounce(renderCategories, 150));
    on('wht-tags-input', 'keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ',') return;
      event.preventDefault();
      var tagsInput = $('wht-tags-input');
      addTag(tagsInput ? tagsInput.value : '');
      if (tagsInput) tagsInput.value = '';
    });
    on('wht-tags-input', 'blur', function () {
      var tagsInput = $('wht-tags-input');
      if (tagsInput && tagsInput.value.trim()) {
        addTag(tagsInput.value);
        tagsInput.value = '';
      }
    });

    on('wht-schema-params', 'click', function (event) {
      var tabButton = event.target && event.target.closest ? event.target.closest('[data-schema-part]') : null;
      if (tabButton) setSchemaPart(tabButton.getAttribute('data-schema-part'));
    });
    on('wht-f-toolParams', 'input', handleParamsJsonInput);
    on('wht-schema-rows-params', 'input', handleParamsRowsInput);
    on('wht-schema-rows-params', 'click', handleParamsRowsClick);
    on('wht-schema-add-params', 'click', addParamsRow);

    on('wht-api-add', 'click', function () { openApiForm(''); });
    on('wht-api-save', 'click', saveApiForm);
    on('wht-api-cancel', 'click', closeApiForm);
    on('wht-api-list', 'click', handleApiActionClick);

    on('wht-doc-tabs', 'click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-doc-tab]') : null;
      if (!button) return;
      _activeDocKey = button.getAttribute('data-doc-tab');
      ensureDocsStructure();
    });
    on('wht-doc-content', 'input', handleDocInput);
    on('wht-doc-content', 'keydown', handleDocKeydown);
    on('wht-doc-content', 'click', handleDocPartClick);
    on('wht-doc-content', 'click', handleDocActionClick);
    var docContentElement = $('wht-doc-content');
    if (docContentElement) {
      docContentElement.addEventListener('scroll', function (event) {
        var target = event.target;
        var docField = target.getAttribute ? target.getAttribute('data-doc-field') : null;
        if (!docField) return;
        var fieldParts = docField.split('.');
        var gutter = $('wht-doc-gutter-' + fieldParts[0] + '-' + fieldParts[1]);
        if (gutter) gutter.scrollTop = target.scrollTop;
      }, true);
    }

    on('wht-shots-upload', 'click', uploadScreenshot);
    on('wht-shots-list', 'click', handleShotsActionClick);
  }

  /* --------------------------------------------------------
     Entry point
  -------------------------------------------------------- */
  function readParam(paramName, defaultValue) {
    try { return tool.param(paramName, defaultValue); } catch (error) { return defaultValue; }
  }

  tool.onReady(function (value) {
    logDiagnostics('ready', 'WebsiteHtmlToolLibrayItem starting - tool API keys: ' + Object.keys(tool || {}).join(', '));
    logDiagnostics('ready-value', JSON.stringify(value).slice(0, 300));
    try {
      tool.declareOutput({
        type: 'object',
        description: 'Definition of one website html-tool widget: identity, html/css/js fragment code, embedding parameters, external API connections, docs and screenshot URLs.',
        properties: {
          version: { type: 'number' },
          draft: {
            type: 'object',
            properties: {
              toolName: { type: 'string' }, toolIcon: { type: 'string' }, toolStatus: { type: 'string' },
              toolDescription: { type: 'string' }, toolCategories: { type: 'array' }, toolTags: { type: 'array' },
              toolHtmlCode: { type: 'string' }, toolCssCode: { type: 'string' }, toolJsCode: { type: 'string' },
              toolParams: { type: 'object' }, externalApis: { type: 'array' },
              docs: { type: 'object', description: 'Draft documents: webpage / help / updates, each with html, css and js.' },
              shots: { type: 'array', description: 'Screenshot metadata - storage URLs only, never file bytes.' }
            }
          }
        }
      });
      tool.declareParams([
        {
          name: 'allowUpload', label: 'Allow Upload', type: 'toggle', default: '', severity: 'goodToHave',
          hint: 'Set to yes in the field settings so screenshots can be uploaded to CMS storage.'
        },
        {
          name: 'previewMockParams', label: 'Preview Mock Params', type: 'text', default: '{}', severity: 'goodToHave',
          hint: 'JSON params merged over the parameter defaults for the mock gw.getPageParams() in the Preview tab, e.g. {"maxItems": 6}.'
        },
        {
          name: 'previewMockData', label: 'Preview Mock Data', type: 'text', default: '{}', severity: 'goodToHave',
          hint: 'JSON map of mock gw.db.query/get items keyed by CMS object type, e.g. {"testimonials": [{"id": "t1", "quote": "Great!"}]}.'
        },
        {
          name: 'categoryList', label: 'Category List', type: 'text', default: '', severity: 'optional',
          hint: 'Optional JSON array replacing the built-in website widget categories. Entries: "Label" or {"code": "media", "label": "Media & Galleries", "group": "Content"}.'
        }
      ]);
    } catch (error) {}

    DB = normalize(value);
    _readOnly = !!tool.isReadOnly();
    wireEvents();
    renderAll();
    lockUI();
    refreshUser();
    reportValidation();

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
    });
  });
})();
