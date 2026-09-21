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
      if (typeof value.version === 'number') normalized.version = value.version;
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
    }
    return normalized;
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
    ['details', 'html', 'css', 'js', 'preview'].forEach(function (paneName) {
      var pane = $('pane-' + paneName);
      if (pane) pane.style.display = paneName === tabName ? '' : 'none';
    });
    if (tabName === 'preview' && !_previewBuilt) renderPreview();
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
          toolCategories: { type: 'array' }, toolTags: { type: 'array' }
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
