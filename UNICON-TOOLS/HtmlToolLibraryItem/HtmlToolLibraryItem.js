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
  var DEFAULT_PAGE_TARGET_TYPE = 'htl-demo-pages-uniconbaseapps';
  var DEFAULT_SOCIAL_TARGET_TYPE = 'htl-demo-social-uniconbaseapps';
  var DEFAULT_VERSIONS_TARGET_TYPE = 'htl-demo-versions-uniconbaseapps';
  var VERSION_LIMIT = 20;
  var SHOTS_LIMIT = 50;
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
  var _fieldIdOverrides = {};
  var _previewMockValue = {};
  var _previewMockParams = {};
  var _lastPullSnapshot = null;
  var _fieldsBannerDismissed = false;
  var _fieldsBannerTimer = null;
  var _pullArmTimer = null;
  var _pullArmed = false;
  var _gutterTimers = {};
  var _warnedAutosave = false;
  var _diagnosticsLines = [];
  var DIAGNOSTICS_LINE_LIMIT = 60;
  var _readyFields = null;
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
     Field mapping + defaults
  -------------------------------------------------------- */
  function fieldIdOf(fieldKey) {
    return (_fieldIdOverrides && _fieldIdOverrides[fieldKey]) || fieldKey;
  }
  function allFieldIdsText() {
    return FIELD_DEFINITIONS.map(function (definition) { return fieldIdOf(definition.key); }).join(', ');
  }
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
    draft.shots = [];
    return draft;
  }
  function normalize(value) {
    var normalized = {
      version: 1,
      draft: defaultDraft(),
      seeded: false,
      fieldsSnapshot: null,
      lastSavedToFieldsAt: null
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
      normalized.seeded = !!value.seeded;
      normalized.fieldsSnapshot = value.fieldsSnapshot || null;
      normalized.lastSavedToFieldsAt = value.lastSavedToFieldsAt || null;
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
        FRAGMENT_DOCS.forEach(function (docKey) {
          var savedDoc = savedDocs[docKey];
          if (savedDoc && typeof savedDoc === 'object') {
            normalized.draft.docs[docKey].html = String(savedDoc.html || '');
            normalized.draft.docs[docKey].css = String(savedDoc.css || '');
            normalized.draft.docs[docKey].js = String(savedDoc.js || '');
            if (savedDoc.seo && typeof savedDoc.seo === 'object') {
              SEO_FIELDS.forEach(function (seoField) {
                normalized.draft.docs[docKey].seo[seoField] = String(savedDoc.seo[seoField] || '');
              });
            }
            normalized.draft.docs[docKey].target = normalizeDocTarget(savedDoc.target);
          }
        });
        var savedSocial = savedDocs.social;
        if (savedSocial && typeof savedSocial === 'object') {
          normalized.draft.docs.social.contentHtml = String(savedSocial.contentHtml || '');
          normalized.draft.docs.social.target = normalizeDocTarget(savedSocial.target);
        }
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
      docs[docKey] = { html: '', css: '', js: '', seo: defaultSeo(), target: null };
    });
    docs.social = { contentHtml: '', target: null };
    return docs;
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
      pushedAt: typeof target.pushedAt === 'string' ? target.pushedAt : '',
      pushedSignature: typeof target.pushedSignature === 'string' ? target.pushedSignature : ''
    };
  }
  function extractFieldValues(source) {
    var values = {};
    if (!source || typeof source !== 'object') return values;
    var nestedSources = [];
    if (source.objectData && source.objectData.data_categoriesBased) nestedSources.push(source.objectData.data_categoriesBased);
    if (source.productData && source.productData.data_categoriesBased) nestedSources.push(source.productData.data_categoriesBased);
    FIELD_DEFINITIONS.forEach(function (definition) {
      var fieldId = fieldIdOf(definition.key);
      if (typeof source[fieldId] !== 'undefined') { values[fieldId] = source[fieldId]; return; }
      for (var sourceIndex = 0; sourceIndex < nestedSources.length; sourceIndex++) {
        if (typeof nestedSources[sourceIndex][fieldId] !== 'undefined') {
          values[fieldId] = nestedSources[sourceIndex][fieldId];
          return;
        }
      }
    });
    return values;
  }
  function describeFieldSource(source) {
    if (!source || typeof source !== 'object') return 'type=' + typeof source;
    var parts = ['type=object', 'keys=[' + Object.keys(source).join(', ') + ']'];
    var nested = source.objectData && source.objectData.data_categoriesBased;
    if (nested) parts.push('objectData.data_categoriesBased keys=[' + Object.keys(nested).join(', ') + ']');
    var productNested = source.productData && source.productData.data_categoriesBased;
    if (productNested) parts.push('productData.data_categoriesBased keys=[' + Object.keys(productNested).join(', ') + ']');
    return parts.join(' ');
  }
  function mergedFieldValues() {
    var mergedValues = extractFieldValues(_readyFields || null);
    var getFieldsSource = null;
    try { getFieldsSource = tool.getFields ? tool.getFields() : null; } catch (error) {}
    var currentValues = extractFieldValues(getFieldsSource);
    Object.keys(currentValues).forEach(function (fieldId) { mergedValues[fieldId] = currentValues[fieldId]; });
    return mergedValues;
  }
  function buildFieldPayload() {
    var payload = {};
    FIELD_DEFINITIONS.forEach(function (definition) {
      payload[fieldIdOf(definition.key)] = DB.draft[definition.key];
    });
    return payload;
  }
  function buildPayloadFromFields(sourceFields) {
    var extractedValues = extractFieldValues(sourceFields);
    var payload = {};
    FIELD_DEFINITIONS.forEach(function (definition) {
      var fieldId = fieldIdOf(definition.key);
      var fieldValue = extractedValues[fieldId];
      payload[fieldId] = typeof fieldValue === 'undefined' ? '' : String(fieldValue);
    });
    return payload;
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
        commitToFields();
      } catch (error) {}
      setTimeout(function () { _saving = false; }, 400);
    }, 350);
  }
  function setSaveState(kind) {
    var element = $('htl-save-state');
    if (!element) return;
    if (kind === 'saved') { element.textContent = '✓ Saved'; element.classList.add('ok'); }
    else { element.textContent = 'Draft staged'; element.classList.remove('ok'); }
  }
  function updateSyncNote(text) {
    var noteElement = $('htl-sync-note');
    if (noteElement) noteElement.textContent = text;
  }
  function updateSyncNoteFromDb() {
    if (DB.lastSavedToFieldsAt) updateSyncNote('Last auto-saved to CMS fields - ' + formatDateTime(DB.lastSavedToFieldsAt));
    else updateSyncNote('Auto-saves to CMS fields as you edit.');
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
  function renderFieldIdList() {
    var element = $('htl-field-id-list');
    if (element) element.textContent = allFieldIdsText();
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
      if (textarea && document.activeElement !== textarea) textarea.value = DB.draft[codeKey];
      updateCodeMeta(codeKey);
      updateGutter(codeKey);
    });
  }
  function updateCodeMeta(codeKey) {
    var textarea = $('htl-code-' + codeKey);
    var metaElement = $('htl-meta-' + CODE_TAB_OF_KEY[codeKey]);
    if (!textarea || !metaElement) return;
    var text = textarea.value || '';
    var lineCount = text ? text.split('\n').length : 1;
    metaElement.textContent = lineCount + ' lines · ' + text.length + ' chars';
  }
  function updateGutter(codeKey) {
    var textarea = $('htl-code-' + codeKey);
    var gutter = $('htl-gutter-' + CODE_TAB_OF_KEY[codeKey]);
    if (!textarea || !gutter) return;
    var lineCount = textarea.value ? textarea.value.split('\n').length : 1;
    var lineNumbers = [];
    for (var lineNumber = 1; lineNumber <= lineCount; lineNumber++) lineNumbers.push(lineNumber);
    gutter.textContent = lineNumbers.join('\n');
  }
  function renderAll() {
    renderDetails();
    renderFieldIdList();
    renderCodeEditors();
    renderCategories();
    renderCategorySelected();
    renderTags();
    FIELD_DEFINITIONS.forEach(function (definition) {
      if (definition.type === 'json') refreshJsonFieldValidity(definition.key);
    });
    renderUser();
    updateSyncNoteFromDb();
    ensureDocsStructure();
    renderShots();
    renderSchemaEditors();
    updateSizeMeter();
  }

  /* --------------------------------------------------------
     Tabs
  -------------------------------------------------------- */
  function switchTab(tabName) {
    _activeTab = tabName;
    var tabButtons = document.querySelectorAll('.htl-tab');
    for (var tabIndex = 0; tabIndex < tabButtons.length; tabIndex++) {
      tabButtons[tabIndex].classList.toggle('active', tabButtons[tabIndex].getAttribute('data-tab') === tabName);
    }
    ['details', 'html', 'css', 'js', 'preview', 'docs', 'screenshots', 'versions', 'synclogs'].forEach(function (paneName) {
      var pane = $('pane-' + paneName);
      if (pane) pane.style.display = paneName === tabName ? '' : 'none';
    });
    if (tabName === 'preview' && !_previewBuilt) renderPreview();
    if (tabName === 'docs') ensureDocsStructure();
    if (tabName === 'versions') renderVersionsList();
    if (tabName === 'screenshots') renderShots();
    try { tool.resize(); } catch (error) {}
  }

  /* --------------------------------------------------------
     Field sync (pull / save)
  -------------------------------------------------------- */
  function pullFromFields() {
    if (typeof tool.getFields !== 'function') {
      notify('Field reading is unavailable in this environment.', 'warning');
      return;
    }
    if (!_pullArmed) {
      _pullArmed = true;
      logDiagnostics('import-arm', 'first click - click Import again within 10 seconds to confirm');
      clearTimeout(_pullArmTimer);
      _pullArmTimer = setTimeout(function () {
        _pullArmed = false;
        var pullButton = $('htl-btn-pull');
        if (pullButton) pullButton.textContent = '⇩ Import from form fields';
        logDiagnostics('import-arm-expired', 'confirm window closed - next click arms again');
      }, 10000);
      var armButton = $('htl-btn-pull');
      if (armButton) armButton.textContent = '⚠ Click again to import from the form fields';
      notify('Import replaces the editor with the form field values - click Import again within 10 seconds to confirm.', 'warning');
      return;
    }
    _pullArmed = false;
    var pullButtonReset = $('htl-btn-pull');
    if (pullButtonReset) pullButtonReset.textContent = '⇩ Import from form fields';

    var getFieldsSource = null;
    try { getFieldsSource = tool.getFields(); } catch (error) {}
    logDiagnostics('import-getFields', describeFieldSource(getFieldsSource));
    var fieldValues = mergedFieldValues();
    var pulledCount = 0;
    var missingFieldIds = [];
    FIELD_DEFINITIONS.forEach(function (definition) {
      var fieldId = fieldIdOf(definition.key);
      var fieldValue = fieldValues[fieldId];
      if (typeof fieldValue !== 'undefined' && fieldValue !== null && String(fieldValue) !== '') {
        DB.draft[definition.key] = String(fieldValue);
        pulledCount++;
        logDiagnostics('import-field-' + definition.key, 'found "' + String(fieldValue).slice(0, 100).replace(/\n/g, ' ') + '"');
      } else if (typeof fieldValue === 'undefined' || fieldValue === null) {
        missingFieldIds.push(fieldId);
        logDiagnostics('import-field-' + definition.key, 'MISSING under id "' + fieldId + '"');
      } else {
        logDiagnostics('import-field-' + definition.key, 'present but EMPTY under id "' + fieldId + '"');
      }
    });
    if (!pulledCount) {
      logDiagnostics('import-result', 'imported 0 fields - compare the getFields keys above with: ' + allFieldIdsText());
      notify('No matching CMS fields found. Expected field IDs: ' + allFieldIdsText(), 'error');
      return;
    }
    DB.fieldsSnapshot = JSON.stringify(buildFieldPayload());
    _lastPullSnapshot = DB.fieldsSnapshot;
    _fieldsBannerDismissed = false;
    hideFieldsBanner();
    persist();
    renderAll();
    reportValidation();
    updateSyncNote('Imported from CMS fields - ' + formatTime(new Date()));
    logDiagnostics('import-result', 'imported ' + pulledCount + ' field(s)' + (missingFieldIds.length ? ', missing: ' + missingFieldIds.join(', ') : ''));
    notify(
      'Imported ' + pulledCount + ' field value(s) from the form.' +
      (missingFieldIds.length ? ' Not found: ' + missingFieldIds.join(', ') : ''),
      missingFieldIds.length ? 'warning' : 'success'
    );
  }

  function seedFromFieldsOnFirstLoad() {
    if (DB.seeded) { logDiagnostics('seed-skip', 'already seeded in a previous session'); return; }
    if (typeof tool.getFields !== 'function') {
      logDiagnostics('seed-skip', 'tool.getFields is not available');
      DB.seeded = true; persist(); return;
    }
    var getFieldsSource = null;
    try { getFieldsSource = tool.getFields(); } catch (error) {}
    logDiagnostics('seed-getFields', describeFieldSource(getFieldsSource));
    var fieldValues = mergedFieldValues();
    var pulledCount = 0;
    FIELD_DEFINITIONS.forEach(function (definition) {
      var fieldId = fieldIdOf(definition.key);
      var fieldValue = fieldValues[fieldId];
      if (typeof fieldValue !== 'undefined' && fieldValue !== null && String(fieldValue) !== '') {
        DB.draft[definition.key] = String(fieldValue);
        pulledCount++;
      }
    });
    DB.seeded = true;
    logDiagnostics('seed-result', 'imported ' + pulledCount + ' field(s) on first load');
    if (pulledCount) {
      DB.fieldsSnapshot = JSON.stringify(buildFieldPayload());
      _lastPullSnapshot = DB.fieldsSnapshot;
      updateSyncNote('Imported ' + pulledCount + ' field value(s) from the form fields');
    }
    persist();
    renderAll();
  }

  function commitToFields() {
    if (typeof tool.setFields !== 'function') return;
    var payload = buildFieldPayload();
    var payloadJson = JSON.stringify(payload);
    if (payloadJson === DB.fieldsSnapshot) return;
    _lastPullSnapshot = payloadJson;
    tool.setFields(payload);
    DB.fieldsSnapshot = payloadJson;
    DB.lastSavedToFieldsAt = new Date().toISOString();
    updateSyncNote('Auto-saved to CMS fields - ' + formatTime(new Date()));
    logDiagnostics('autosave', 'wrote ' + Object.keys(payload).length + ' field(s) via setFields');
    if (typeof tool.requestSave === 'function') {
      tool.requestSave(function (error, saveAccepted) {
        logDiagnostics('autosave-request', error ? ('error: ' + error) : (saveAccepted ? 'save request accepted' : 'save request denied'));
        if (error || !saveAccepted) {
          setSaveState('staged');
          if (!_warnedAutosave) {
            _warnedAutosave = true;
            notify('Fields updated, but auto-commit was ' + (error || 'denied') + ' - the form Save button still commits. Enable allowRequestSave for full auto-save.', 'warning');
          }
        } else {
          setSaveState('saved');
        }
      });
    }
  }

  /* --------------------------------------------------------
     External field-change banner
  -------------------------------------------------------- */
  function scheduleFieldsBannerCheck() {
    clearTimeout(_fieldsBannerTimer);
    _fieldsBannerTimer = setTimeout(checkForExternalFieldChanges, 600);
  }
  function checkForExternalFieldChanges() {
    if (_fieldsBannerDismissed || typeof tool.getFields !== 'function') return;
    if (!_lastPullSnapshot) return;
    var allFields = tool.getFields() || {};
    var currentSnapshot = JSON.stringify(buildPayloadFromFields(mergedFieldValues()));
    if (currentSnapshot !== _lastPullSnapshot) {
      var banner = $('htl-fields-banner');
      var bannerText = $('htl-fields-banner-text');
      if (bannerText) {
        bannerText.textContent = 'The CMS fields of this record changed outside the editor. Press Import from form fields to load them - or ignore if the change came from your own edit.';
      }
      if (banner) banner.style.display = '';
    }
  }
  function hideFieldsBanner() {
    var banner = $('htl-fields-banner');
    if (banner) banner.style.display = 'none';
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
  function notifyJsSyntaxCheck() {
    var syntaxError = checkJsSyntax(DB.draft.toolJsCode);
    if (syntaxError) notify('JS syntax error: ' + syntaxError, 'error');
    else notify('JS syntax OK ✓', 'success');
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
    var htmlCode = DB.draft.toolHtmlCode || '';
    var cssCode = DB.draft.toolCssCode || '';
    var jsCode = DB.draft.toolJsCode || '';
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
    if (!rawName) return 'unnamed-tool';
    var normalized = rawName.normalize ? rawName.normalize('NFKD') : rawName;
    normalized = normalized.replace(/[\u0300-\u036f]/g, '');
    var charMap = { 'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u' };
    normalized = normalized.replace(/[çÇğĞıİöÖşŞüÜ]/g, function (character) { return charMap[character]; });
    var slug = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'unnamed-tool';
  }
  function docTargetType(docKey) {
    var configured = docKey === 'social'
      ? readParam('socialTargetType', DEFAULT_SOCIAL_TARGET_TYPE)
      : readParam('pageTargetType', DEFAULT_PAGE_TARGET_TYPE);
    return configured || (docKey === 'social' ? DEFAULT_SOCIAL_TARGET_TYPE : DEFAULT_PAGE_TARGET_TYPE);
  }
  function versionsTargetType() {
    return readParam('versionsTargetType', DEFAULT_VERSIONS_TARGET_TYPE) || DEFAULT_VERSIONS_TARGET_TYPE;
  }
  function leafTypeIdOf() {
    var configured = readParam('docsFolderTypeId', '');
    if (configured && String(configured).trim()) return String(configured).trim();
    return _ownTypeId || '';
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
    var doc = DB.draft.docs[docKey];
    if (!doc) return '';
    if (docKey === 'social') return JSON.stringify({ contentHtml: String(doc.contentHtml || '') });
    var seo = {};
    SEO_FIELDS.forEach(function (seoField) { if (doc.seo[seoField]) seo[seoField] = doc.seo[seoField]; });
    return JSON.stringify({ html: String(doc.html || ''), css: String(doc.css || ''), js: String(doc.js || ''), seo: seo });
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
    return String(DB.draft.toolName || 'Tool').trim() + ' - ' + DOC_LABELS[docKey];
  }
  function docSlugOf(docKey) {
    return toolSlugOf() + '-' + docKey;
  }
  function pageBuilderValue(docKey) {
    var doc = DB.draft.docs[docKey];
    var seo = {};
    SEO_FIELDS.forEach(function (seoField) { if (doc.seo[seoField]) seo[seoField] = doc.seo[seoField]; });
    return {
      code: { html: String(doc.html || ''), css: String(doc.css || ''), js: String(doc.js || '') },
      seo: seo,
      pageMeta: {
        name: docDisplayName(docKey),
        slug: docSlugOf(docKey),
        meta: { language: readParam('docLanguage', 'en') || 'en' },
        data: { status: readParam('pageStatus', 'published') || 'published' }
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
    var doc = DB.draft.docs.social;
    var fieldMap = socialFieldMap();
    var payload = {};
    if (fieldMap.name) payload[fieldMap.name] = docDisplayName(docKey);
    if (fieldMap.slug) payload[fieldMap.slug] = docSlugOf(docKey);
    if (fieldMap.contentHtml) payload[fieldMap.contentHtml] = String(doc.contentHtml || '');
    if (fieldMap.updatedAt) payload[fieldMap.updatedAt] = new Date().toISOString();
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
  function applyPageObjectToDoc(docKey, cmsObject) {
    var dcb = objectDcb(cmsObject);
    var fieldMap = pageFieldMap();
    var doc = DB.draft.docs[docKey];
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
  function applySocialObjectToDoc(docKey, cmsObject) {
    var dcb = objectDcb(cmsObject);
    var fieldMap = socialFieldMap();
    if (fieldMap.contentHtml && typeof dcb[fieldMap.contentHtml] === 'string') {
      DB.draft.docs.social.contentHtml = dcb[fieldMap.contentHtml];
    }
  }
  function userNameOf() {
    var user = _user || getUserSafe();
    return (user && (user.name || user.id)) || 'user';
  }

  function pushDoc(docKey) {
    if (!canWrite()) { notify('Read-only - pushing is disabled.', 'warning'); return; }
    if (!objectsApiAvailable()) {
      logDiagnostics('doc-push-' + docKey, 'requestObjects missing - allowObjectCRUD off');
      notify('Object API is unavailable here (allowObjectCRUD off).', 'warning');
      return;
    }
    var objectType = docTargetType(docKey);
    var slug = docSlugOf(docKey);
    var leafTypeId = leafTypeIdOf();
    var built = docKey === 'social' ? buildSocialDcb(docKey) : buildPageDcb(docKey);
    var signature = contentSignature(docKey);
    var doc = DB.draft.docs[docKey];
    var target = doc.target || null;
    logDiagnostics('doc-push-' + docKey, 'pushing to ' + objectType + ' folder=' + (leafTypeId || 'default') + ' slug=' + slug);

    function finishPush(cmsObject) {
      doc.target = {
        objectType: objectType,
        objectId: cmsObject.id || cmsObject._id,
        name: built.name,
        slug: slug,
        pushedAt: new Date().toISOString(),
        pushedSignature: signature
      };
      _docPushArmed[docKey] = false;
      persist();
      renderDocStatus(docKey);
      updateSyncNote(DOC_LABELS[docKey] + ' pushed to ' + objectType + ' - ' + formatTime(new Date()));
      notify(DOC_LABELS[docKey] + ' pushed (' + (docKey === 'social' ? 'social object' : 'page object with SEO') + ').', 'success');
    }

    function performWrite(existingObject) {
      if (existingObject) {
        var remoteSignatureValue = remoteSignature(docKey, existingObject);
        if (target && target.pushedSignature && target.pushedSignature !== remoteSignatureValue && !_docPushArmed[docKey]) {
          _docPushArmed[docKey] = true;
          clearTimeout(_docPushArmTimers[docKey]);
          _docPushArmTimers[docKey] = setTimeout(function () { _docPushArmed[docKey] = false; }, 8000);
          logDiagnostics('doc-push-' + docKey, 'target changed outside - click Push again to overwrite');
          notify('The ' + DOC_LABELS[docKey] + ' object changed outside the editor. Click Push again within 8 seconds to overwrite.', 'warning');
          return;
        }
        tool.requestObjects('update', { mainObjectType: objectType, objectId: existingObject.id, productData: { data_categoriesBased: built.payload } }, function (updateError) {
          if (updateError) {
            logDiagnostics('doc-push-' + docKey, 'update error: ' + updateError);
            notify('Push failed: ' + updateError, 'error');
            return;
          }
          finishPush(existingObject);
        });
      } else {
        var createParams = { mainObjectType: objectType, name: built.name, productData: { data_categoriesBased: built.payload } };
        if (leafTypeId) createParams.typeId = leafTypeId;
        tool.requestObjects('create', createParams, function (createError, createResult) {
          if (createError || !createResult || !createResult.object) {
            logDiagnostics('doc-push-' + docKey, 'create error: ' + (createError || 'no object returned'));
            notify('Push failed: ' + (createError || 'no object returned'), 'error');
            return;
          }
          finishPush(createResult.object);
        });
      }
    }

    if (target && target.objectId) {
      tool.requestObjects('get', { mainObjectType: objectType, objectId: target.objectId }, function (getError, getResult) {
        if (getError) { notify('Push lookup failed: ' + getError, 'error'); return; }
        performWrite(getResult && getResult.object ? getResult.object : null);
      });
    } else {
      var queryParams = { mainObjectType: objectType };
      if (leafTypeIdOf()) queryParams.typeId = leafTypeIdOf();
      tool.requestObjects('query', queryParams, function (queryError, queryResult) {
        if (queryError) { notify('Push lookup failed: ' + queryError, 'error'); return; }
        var objects = (queryResult && queryResult.objects) || [];
        performWrite(findObjectBySlug(objects, slug));
      });
    }
  }

  function pullDoc(docKey) {
    if (!canWrite()) { notify('Read-only - pulling is disabled.', 'warning'); return; }
    if (!objectsApiAvailable()) {
      logDiagnostics('doc-pull-' + docKey, 'requestObjects missing - allowObjectCRUD off');
      notify('Object API is unavailable here (allowObjectCRUD off).', 'warning');
      return;
    }
    var objectType = docTargetType(docKey);
    var slug = docSlugOf(docKey);
    var target = DB.draft.docs[docKey].target || null;
    logDiagnostics('doc-pull-' + docKey, 'pulling from ' + objectType + ' folder=' + (leafTypeIdOf() || 'default') + ' slug=' + slug);

    function applyObject(cmsObject) {
      if (!cmsObject) {
        notify('No ' + DOC_LABELS[docKey] + ' object found with slug "' + slug + '". Push it first to create it.', 'warning');
        return;
      }
      if (docKey === 'social') applySocialObjectToDoc(docKey, cmsObject);
      else applyPageObjectToDoc(docKey, cmsObject);
      DB.draft.docs[docKey].target = {
        objectType: objectType,
        objectId: cmsObject.id || cmsObject._id,
        name: cmsObject.name || '',
        slug: slug,
        pushedAt: cmsObject.updated || new Date().toISOString(),
        pushedSignature: remoteSignature(docKey, cmsObject)
      };
      _docPushArmed[docKey] = false;
      persist();
      refreshDocPaneValues();
      updateSyncNote(DOC_LABELS[docKey] + ' pulled from ' + objectType + ' - ' + formatTime(new Date()));
      logDiagnostics('doc-pull-' + docKey, 'loaded ' + objectType + ' ' + (cmsObject.id || '?'));
      notify(DOC_LABELS[docKey] + ' loaded from the target object.', 'success');
    }

    if (target && target.objectId) {
      tool.requestObjects('get', { mainObjectType: objectType, objectId: target.objectId }, function (getError, getResult) {
        if (getError) { notify('Pull failed: ' + getError, 'error'); return; }
        applyObject(getResult && getResult.object ? getResult.object : null);
      });
    } else {
      var queryParams = { mainObjectType: objectType };
      if (leafTypeIdOf()) queryParams.typeId = leafTypeIdOf();
      tool.requestObjects('query', queryParams, function (queryError, queryResult) {
        if (queryError) { notify('Pull failed: ' + queryError, 'error'); return; }
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
      + '<span class="htl-doc-subline">Push writes this document to a CMS object of type <code>' + escHtml(docTargetType(docKey)) + '</code> (slug <code>' + escHtml(docSlugOf(docKey)) + '</code>). Pull loads the saved object content back into the editor.</span>'
      + '</div>'
      + '<span class="htl-doc-status" id="htl-doc-status-' + docKey + '">Not pushed yet</span>'
      + '<span class="htl-doc-actions">'
      + '<button class="htl-btn htl-btn-primary htl-btn-sm" data-act="doc-push" data-doc="' + docKey + '" title="Create or update the ' + escHtml(docTargetType(docKey)) + ' object with this document">⇪ Push</button>'
      + '<button class="htl-btn htl-btn-ghost htl-btn-sm" data-act="doc-pull" data-doc="' + docKey + '" title="Load the saved content from the ' + escHtml(docTargetType(docKey)) + ' object into the editor">⇩ Pull</button>'
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
  }
  function renderTargetSummary() {
    var pageElement = $('htl-target-page-type');
    var socialElement = $('htl-target-social-type');
    var versionsElement = $('htl-target-versions-type');
    var leafElement = $('htl-target-leaf-folder');
    if (pageElement) pageElement.textContent = docTargetType('webpage');
    if (socialElement) socialElement.textContent = docTargetType('social');
    if (versionsElement) versionsElement.textContent = versionsTargetType();
    if (leafElement) leafElement.textContent = leafTypeIdOf() || '(not detected - docsFolderTypeId param not set and this record has no folder)';
    var noteElement = $('htl-doc-object-note');
    if (noteElement) {
      noteElement.textContent = objectsApiAvailable()
        ? 'Object API available - Push creates the document in the tool leaf folder above (the CMS hierarchy folder where this record lives).'
        : 'Object API NOT available here (allowObjectCRUD off) - Push/Pull stay disabled until the field settings allow it.';
    }
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
      var doc = DB.draft.docs[docKey];
      if (!doc) return;
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
  }
  function renderDocStatus(docKey) {
    var statusElement = $('htl-doc-status-' + docKey);
    if (!statusElement) return;
    var target = DB.draft.docs[docKey].target;
    if (target && target.objectId) {
      var dirty = contentSignature(docKey) !== (target.pushedSignature || '');
      statusElement.textContent = target.objectType + ' · ' + target.objectId
        + ' · pushed ' + (target.pushedAt ? formatDateTime(target.pushedAt) : '?')
        + (dirty ? ' · modified' : '');
      statusElement.className = 'htl-doc-status' + (dirty ? ' dirty' : ' ok');
    } else {
      statusElement.textContent = 'Not pushed yet';
      statusElement.className = 'htl-doc-status';
    }
  }
  function handleDocInput(event) {
    var element = event.target;
    if (!element || !element.getAttribute) return;
    var fieldPath = element.getAttribute('data-doc-field');
    if (!fieldPath) return;
    var pieces = fieldPath.split('.');
    var docKey = pieces[0];
    var doc = DB.draft.docs[docKey];
    if (!doc) return;
    if (pieces[1] === 'seo' && pieces[2]) {
      doc.seo[pieces[2]] = element.value;
    } else {
      doc[pieces[1]] = element.value;
      updateDocEditorMeta(docKey, pieces[1]);
      clearTimeout(_docGutterTimers[docKey + '-' + pieces[1]]);
      _docGutterTimers[docKey + '-' + pieces[1]] = setTimeout(function () { updateDocGutter(docKey, pieces[1]); }, 160);
    }
    renderDocStatus(docKey);
    persist();
  }
  function handleDocActionClick(event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-act]') : null;
    if (!button) return;
    var action = button.getAttribute('data-act');
    var docKey = button.getAttribute('data-doc');
    if (action === 'doc-push' && docKey) pushDoc(docKey);
    else if (action === 'doc-pull' && docKey) pullDoc(docKey);
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
    var doc = DB.draft.docs[docKey];
    if (!doc) return { doc: '', jsSyntaxError: null };
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
    if (!String(DB.draft.toolHtmlCode || '').trim() && !String(DB.draft.toolCssCode || '').trim() && !String(DB.draft.toolJsCode || '').trim()) {
      notify('The code is empty - nothing to snapshot.', 'warning');
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
          htmlCode: DB.draft.toolHtmlCode || '',
          cssCode: DB.draft.toolCssCode || '',
          jsCode: DB.draft.toolJsCode || '',
          note: '',
          pushedAt: new Date().toISOString(),
          pushedBy: userNameOf()
        } }
      };
      if (leafTypeIdOf()) createParams.typeId = leafTypeIdOf();
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
    DB.draft.toolHtmlCode = String(dcb.htmlCode || '');
    DB.draft.toolCssCode = String(dcb.cssCode || '');
    DB.draft.toolJsCode = String(dcb.jsCode || '');
    persist();
    renderCodeEditors();
    updateSyncNote('Loaded version v' + dcb.versionNumber + ' into the editors - changes are staged, not pushed');
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
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { notify('URL copied.', 'success'); }, function () { fallbackCopy(text); });
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
      notify('URL copied.', 'success');
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
    if (docKey === 'social') DB.draft.docs.social.contentHtml = textarea.value;
    else DB.draft.docs[docKey].html = textarea.value;
    updateDocEditorMeta(docKey, docKey === 'social' ? 'content' : 'html');
    updateDocGutter(docKey, docKey === 'social' ? 'content' : 'html');
    renderDocStatus(docKey);
    persist();
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
    meterElement.title = bytes + ' bytes in the stored value - the Firestore object limit is 1 MB';
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

    on('htl-btn-pull', 'click', pullFromFields);
    on('htl-btn-check-js', 'click', notifyJsSyntaxCheck);
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
    on('htl-btn-banner-pull', 'click', function () {
      hideFieldsBanner();
      _fieldsBannerDismissed = true;
      pullFromFields();
    });
    on('htl-btn-banner-dismiss', 'click', function () {
      hideFieldsBanner();
      _fieldsBannerDismissed = true;
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
  }

  function bindCodeEditor(codeKey) {
    var textarea = $('htl-code-' + codeKey);
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
      var gutter = $('htl-gutter-' + CODE_TAB_OF_KEY[codeKey]);
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
     Entry point
  -------------------------------------------------------- */
  function readParam(paramName, defaultValue) {
    try { return tool.param(paramName, defaultValue); } catch (error) { return defaultValue; }
  }

  tool.onReady(function (value, readyFields) {
    _readyFields = readyFields || null;
    logDiagnostics('ready', 'tool API keys: ' + Object.keys(tool || {}).join(', '));
    logDiagnostics('ready-value', JSON.stringify(value).slice(0, 300));
    logDiagnostics('ready-fields-arg', describeFieldSource(readyFields));
    try {
      var readyGetFields = tool.getFields ? tool.getFields() : null;
      logDiagnostics('ready-getFields', describeFieldSource(readyGetFields));
      if (readyGetFields) logDiagnostics('ready-getFields-json', JSON.stringify(readyGetFields).slice(0, 800));
    } catch (error) { logDiagnostics('ready-getFields', 'error: ' + error.message); }
    var ownTypeIdSource = (readyFields && readyFields.typeId) ? readyFields.typeId : '';
    if (!ownTypeIdSource) {
      try {
        var folderFields = tool.getFields ? tool.getFields() : null;
        if (folderFields && folderFields.typeId) ownTypeIdSource = folderFields.typeId;
      } catch (error) {}
    }
    _ownTypeId = String(ownTypeIdSource || '');
    logDiagnostics('ready-folder', 'leaf folder (typeId): ' + (_ownTypeId || '(none)'));
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
          docs: { type: 'object', description: 'Draft documents: webpage/help/updates/presentation as fragments with SEO, social as contentHtml, plus their push targets.' },
          shots: { type: 'array', description: 'Screenshot metadata - storage URLs only, never file bytes.' }
        }
      });
      tool.declareParams([
        {
          name: 'fieldIdOverrides', label: 'CMS Field ID Overrides', type: 'text', default: '', severity: 'optional',
          hint: 'JSON map to rename the target sibling field IDs, e.g. {"toolName":"name","toolHtmlCode":"htmlCode"}. Leave empty to use the default IDs.'
        },
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
          hint: 'CMS object type of the website app pages (WebpageBuilder shape). Used by webpage, help, updates and presentation. Placeholder until the real type exists.'
        },
        {
          name: 'socialTargetType', label: 'Social Target Object Type', type: 'text', default: DEFAULT_SOCIAL_TARGET_TYPE, severity: 'goodToHave',
          hint: 'CMS object type of the social application objects. Placeholder until the real type exists.'
        },
        {
          name: 'versionsTargetType', label: 'Versions Target Object Type', type: 'text', default: DEFAULT_VERSIONS_TARGET_TYPE, severity: 'goodToHave',
          hint: 'CMS object type holding code snapshots - one object per push, newest 20 kept per tool.'
        },
        {
          name: 'docsFolderTypeId', label: 'Docs Folder ID Override', type: 'text', default: '', severity: 'goodToHave',
          hint: 'Optional leaf folder (typeId) where the documents and versions are created. Empty = use the folder of this record from the CMS hierarchy.'
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
          name: 'pageStatus', label: 'Page Status', type: 'text', default: 'published', severity: 'goodToHave',
          hint: 'Status written to page objects: published or draft.'
        },
        {
          name: 'docLanguage', label: 'Document Language', type: 'text', default: 'en', severity: 'goodToHave',
          hint: 'meta.language written to page objects.'
        }
      ]);
    } catch (error) {}

    _fieldIdOverrides = safeJsonObject(readParam('fieldIdOverrides', ''));
    _previewMockValue = parseJsonLenient(readParam('previewMockValue', '{}')) || {};
    _previewMockParams = parseJsonLenient(readParam('previewMockParams', '{}')) || {};

    DB = normalize(value);
    _readOnly = !!tool.isReadOnly();
    wireEvents();
    renderAll();
    lockUI();
    refreshUser();
    seedFromFieldsOnFirstLoad();
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
    tool.onFieldsChange(function () { scheduleFieldsBannerCheck(); });
  });
})();
