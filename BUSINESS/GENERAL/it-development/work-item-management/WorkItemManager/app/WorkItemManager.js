/* js build 2026-11-04-4 */
/* Work Item Manager - TYPE 1 object-level html tool for one record of
   product-work-items-uniconbaseapps.

   Four tabs: the editable item, its progress, working notes and the build
   prompt. Product and application are grouped trees loaded from the platform
   stores (tools-applicationstore, applications-applicationstore). Screenshots
   are uploaded through the host and only their URLs are kept. The prompt is
   generated from the item data only: the Prompt tab has no inputs. */

(function () {
  'use strict';

  var TOOL_BUILD = '2026-11-04-4';
  console.log('[TOOL:BOOT] build ' + TOOL_BUILD + ' - Work Item Manager');

  var VALUE_VERSION = 4;
  var ITEM_TYPE = 'product-work-items-uniconbaseapps';
  var PRODUCT_STORE_TYPE = 'tools-applicationstore';
  var APPLICATION_STORE_TYPE = 'applications-applicationstore';
  var TEMPLATE_SOURCE_ADMIN = 'admin';
  var TEMPLATE_SOURCE_BUILT_IN = 'built-in';
  var SAVE_DEBOUNCE_MS = 400;
  var MAX_NOTE_COUNT = 200;
  var MAX_IMAGE_COUNT = 20;
  var MAX_STORED_IMAGE_COUNT = 60;
  var MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  var PLACEHOLDER_PATTERN = /\{\{[A-Z0-9_]+\}\}/g;

  var LIFECYCLE_STEPS = ['new', 'accepted', 'working', 'done'];

  var TAB_DEFINITIONS = [
    { name: 'item', tabId: 'wim-tab-item', panelId: 'wim-panel-item' },
    { name: 'progress', tabId: 'wim-tab-progress', panelId: 'wim-panel-progress' },
    { name: 'notes', tabId: 'wim-tab-notes', panelId: 'wim-panel-notes' },
    { name: 'prompt', tabId: 'wim-tab-prompt', panelId: 'wim-panel-prompt' }
  ];

  var EDITABLE_FIELDS = [
    'key',
    'kind',
    'title',
    'status',
    'severity',
    'owner',
    'product',
    'application',
    'reportedBuild',
    'toolLibraryBuild',
    'checkedBy',
    'detail'
  ];

  var FIELD_INPUT_IDS = {
    key: 'wim-field-key',
    kind: 'wim-field-kind',
    title: 'wim-field-title',
    status: 'wim-field-status',
    severity: 'wim-field-severity',
    owner: 'wim-field-owner',
    reportedBuild: 'wim-field-reported-build',
    toolLibraryBuild: 'wim-field-library-build',
    checkedBy: 'wim-field-checked-by',
    detail: 'wim-field-detail'
  };

  /* Product and application are tree selects, with a text input as the
     fallback when the store list cannot be read. */
  var TREE_FIELD_IDS = {
    product: {
      selectId: 'wim-field-product',
      textId: 'wim-field-product-text',
      hintId: 'wim-product-hint',
      storeType: PRODUCT_STORE_TYPE,
      defaultGroup: 'Products',
      noun: 'product'
    },
    application: {
      selectId: 'wim-field-application',
      textId: 'wim-field-application-text',
      hintId: 'wim-application-hint',
      storeType: APPLICATION_STORE_TYPE,
      defaultGroup: 'Applications',
      noun: 'application'
    }
  };

  /* Built-in prompt: the change-existing half of section 19 in the Product
     Delivery Hub SSOT, cut down to the lines that carry a value for THIS item.
     A section is only written when it has content, so the prompt never opens
     with background the reader already has and never shows a label with
     nothing under it. Everything comes from the item, because this tool only
     manages work on tools that already exist. */
  var PROMPT_RULE_LINES = [
    '- html-tool-rules.txt is the contract. tool.onReady is the only entry point. Bump TOOL_BUILD, and move only the per-file stamps of the files you touch.',
    '- No localStorage, sessionStorage, fetch, alert, confirm, prompt or raw postMessage. All state goes through tool.getValue and tool.setValue.',
    '- declareParams for every param you read, and handle isReadOnly() inside onReady.',
    '- Never write a raw closing script tag or an unclosed html comment opener inside the JS.',
    '- Store upload URLs, never file bytes. Keep the saved value well under the 1 MB record budget.',
    '- Record the change in the tool docs/ssot.html. No separate plan files, no emoji, no em dashes.',
    '- Do not commit, do not push, do not run npm run rel.'
  ];

  var PROMPT_UI_LINES = [
    '- Keep the existing class prefix on every class and id.',
    '- Light surfaces, one accent colour, body text 14 to 16 px, one primary action per view.',
    '- Works at 390 px and at 1280 px with no horizontal scroll. Keyboard reachable, labels tied to inputs.'
  ];

  var PROMPT_VERIFY_LINES = [
    '- node --check on every JS file you touched.',
    "- Every el('id') in the JS resolves to an id in the HTML.",
    '- The harness renders with sample data and with ?bare=1.',
    '- Screenshots at 390 px and at 1280 px, read them, no overflow.'
  ];

  var PROMPT_REPORT_LINES = [
    '1. Folder you worked in.',
    '2. Files created or changed.',
    '3. The new TOOL_BUILD.',
    '4. Checks you ran and their result.',
    '5. Anything you could not do, and why.'
  ];

  /* ── Element helper ── */
  function el(elementId) {
    return document.getElementById(elementId);
  }

  /* ── State ── */
  var record = {
    id: '',
    key: '',
    kind: '',
    title: '',
    detail: '',
    product: '',
    application: '',
    severity: '',
    reportedBuild: '',
    owner: '',
    status: '',
    reporter: '',
    toolLibraryBuild: '',
    checkedBy: ''
  };

  var draft = {};
  var params = {
    templateText: '',
    allowAi: false
  };

  var storeTrees = {
    product: { status: 'loading', entries: [] },
    application: { status: 'loading', entries: [] }
  };

  var notes = [];
  /* Screenshots kept in the tool value: { id, name, url, storagePath,
     sizeBytes, type, addedAt, removedAt }. Only the URL and its storage path
     are stored, never the image bytes. */
  var images = [];
  var templateSource = TEMPLATE_SOURCE_BUILT_IN;
  var lastPromptText = '';
  var lastGeneratedAt = '';
  var textIsReadOnly = false;
  var lastSavedValueJson = '';
  var saveTimer = null;
  var eventsAreBound = false;
  var activeTabName = 'item';
  var savingIsInProgress = false;

  /* ── Value helpers ── */
  function isRecordObject(candidate) {
    return !!candidate && typeof candidate === 'object' && !Array.isArray(candidate);
  }

  function isPlaceholderWord(candidateText) {
    var loweredText = String(candidateText || '').toLowerCase();
    return loweredText === 'undefined' || loweredText === 'null' || loweredText === 'nan';
  }

  function toDisplayText(rawValue) {
    if (rawValue === null || rawValue === undefined) return '';

    if (typeof rawValue === 'string') {
      var trimmedText = rawValue.trim();
      if (!trimmedText || isPlaceholderWord(trimmedText)) return '';
      return trimmedText;
    }

    if (typeof rawValue === 'number') {
      return isFinite(rawValue) ? String(rawValue) : '';
    }

    if (typeof rawValue === 'boolean') {
      return rawValue ? 'yes' : 'no';
    }

    if (Array.isArray(rawValue)) {
      var itemTexts = [];
      for (var itemIndex = 0; itemIndex < rawValue.length; itemIndex += 1) {
        var itemText = toDisplayText(rawValue[itemIndex]);
        if (itemText) itemTexts.push(itemText);
      }
      return itemTexts.join(', ');
    }

    if (typeof rawValue === 'object') {
      var preferredKeys = ['name', 'label', 'title', 'displayName', 'text', 'value', 'email'];
      for (var keyIndex = 0; keyIndex < preferredKeys.length; keyIndex += 1) {
        var candidateValue = rawValue[preferredKeys[keyIndex]];
        if (candidateValue === null || candidateValue === undefined) continue;
        if (typeof candidateValue === 'object') continue;
        var candidateText = toDisplayText(candidateValue);
        if (candidateText) return candidateText;
      }
      return '';
    }

    return '';
  }

  function firstFilledValue(sourceList, fieldName) {
    for (var sourceIndex = 0; sourceIndex < sourceList.length; sourceIndex += 1) {
      var source = sourceList[sourceIndex];
      if (!isRecordObject(source)) continue;
      if (!Object.prototype.hasOwnProperty.call(source, fieldName)) continue;
      var fieldText = toDisplayText(source[fieldName]);
      if (fieldText) return fieldText;
    }
    return '';
  }

  function collectRecordSources(fieldsSnapshot, readyFields) {
    var sourceList = [];

    if (isRecordObject(fieldsSnapshot)) sourceList.push(fieldsSnapshot);
    if (isRecordObject(readyFields)) sourceList.push(readyFields);

    var shellRecords = [];
    if (isRecordObject(fieldsSnapshot)) shellRecords.push(fieldsSnapshot);
    if (isRecordObject(readyFields)) shellRecords.push(readyFields);

    shellRecords.forEach(function (shellRecord) {
      if (isRecordObject(shellRecord.productData) && isRecordObject(shellRecord.productData.data_categoriesBased)) {
        sourceList.push(shellRecord.productData.data_categoriesBased);
      }
    });

    shellRecords.forEach(function (shellRecord) {
      if (isRecordObject(shellRecord.objectData) && isRecordObject(shellRecord.objectData.data_categoriesBased)) {
        sourceList.push(shellRecord.objectData.data_categoriesBased);
      }
    });

    return sourceList;
  }

  function applyRecord(fieldsSnapshot, readyFields) {
    var sourceList = collectRecordSources(fieldsSnapshot, readyFields);

    record.id = firstFilledValue(sourceList, 'id') || firstFilledValue(sourceList, '_id');
    record.key = firstFilledValue(sourceList, 'key');
    record.kind = firstFilledValue(sourceList, 'kind');
    record.title = firstFilledValue(sourceList, 'title');
    record.detail = firstFilledValue(sourceList, 'detail');
    record.product = firstFilledValue(sourceList, 'product');
    record.application = firstFilledValue(sourceList, 'application');
    record.severity = firstFilledValue(sourceList, 'severity');
    record.reportedBuild = firstFilledValue(sourceList, 'reportedBuild');
    record.owner = firstFilledValue(sourceList, 'owner');
    record.status = firstFilledValue(sourceList, 'status').toLowerCase();
    record.reporter = firstFilledValue(sourceList, 'reporter');
    record.toolLibraryBuild = firstFilledValue(sourceList, 'toolLibraryBuild');
    record.checkedBy = firstFilledValue(sourceList, 'checkedBy');

    resetDraftFromRecord();
  }

  function resetDraftFromRecord() {
    draft = {};
    EDITABLE_FIELDS.forEach(function (fieldName) {
      draft[fieldName] = record[fieldName];
    });
  }

  /* ── Host access, always guarded ── */
  function readToolParam(paramName, fallbackValue) {
    try {
      if (typeof tool.param === 'function') return tool.param(paramName, fallbackValue);
    } catch (error) {
      console.warn('[WIM] param "' + paramName + '" could not be read', error);
    }
    return fallbackValue;
  }

  function readIsReadOnly() {
    try {
      if (typeof tool.isReadOnly === 'function') return !!tool.isReadOnly();
    } catch (error) {
      console.warn('[WIM] isReadOnly failed', error);
    }
    return false;
  }

  function readSavedValue() {
    try {
      if (typeof tool.getValue === 'function') return tool.getValue();
    } catch (error) {
      console.warn('[WIM] getValue failed', error);
    }
    return null;
  }

  function readCurrentUser() {
    try {
      if (typeof tool.getUser === 'function') return tool.getUser();
    } catch (error) {
      console.warn('[WIM] getUser failed', error);
    }
    return null;
  }

  function notifyHost(messageText, severityName) {
    try {
      if (typeof tool.notify === 'function') tool.notify(messageText, severityName);
    } catch (error) {
      /* a host without toasts is not an error for this tool */
    }
  }

  function requestResize() {
    try {
      if (typeof tool.resize === 'function') window.setTimeout(function () { tool.resize(); }, 0);
    } catch (error) {
      /* resize is a nicety, never a failure */
    }
  }

  function canRequestObjects() {
    return typeof tool.requestObjects === 'function';
  }

  function announceItemStatus(messageText) {
    var statusNode = el('wim-item-status-line');
    if (statusNode) statusNode.textContent = messageText;
  }

  function announceNoteStatus(messageText) {
    var statusNode = el('wim-note-status');
    if (statusNode) statusNode.textContent = messageText;
  }

  function announcePromptStatus(messageText) {
    var statusNode = el('wim-prompt-status');
    if (statusNode) statusNode.textContent = messageText;
  }

  /* ── Store trees for product and application ── */
  function normalizeStoreRows(storeRecords, defaultGroup) {
    var seenNames = {};
    var entries = [];

    storeRecords.forEach(function (storeRecord) {
      if (!isRecordObject(storeRecord)) return;

      var recordData = {};
      if (isRecordObject(storeRecord.productData) && isRecordObject(storeRecord.productData.data_categoriesBased)) {
        recordData = storeRecord.productData.data_categoriesBased;
      } else if (isRecordObject(storeRecord.data)) {
        recordData = storeRecord.data;
      }

      var entryName = toDisplayText(recordData.gwAppName)
        || toDisplayText(recordData.gwApp)
        || toDisplayText(recordData.toolName)
        || toDisplayText(recordData.applicationName)
        || toDisplayText(recordData.name)
        || toDisplayText(recordData.title)
        || toDisplayText(storeRecord.name)
        || toDisplayText(storeRecord.slug);
      if (!entryName || seenNames[entryName]) return;
      seenNames[entryName] = true;

      var entryGroup = toDisplayText(recordData.category)
        || toDisplayText(recordData.categoryName)
        || toDisplayText(recordData.folder)
        || toDisplayText(recordData.family)
        || defaultGroup;

      entries.push({ name: entryName, group: entryGroup });
    });

    entries.sort(function (firstEntry, secondEntry) {
      if (firstEntry.group !== secondEntry.group) return firstEntry.group.localeCompare(secondEntry.group);
      return firstEntry.name.localeCompare(secondEntry.name);
    });

    return entries;
  }

  function renderTreeField(fieldName) {
    var fieldIds = TREE_FIELD_IDS[fieldName];
    var treeState = storeTrees[fieldName];
    var selectNode = el(fieldIds.selectId);
    var textNode = el(fieldIds.textId);
    var hintNode = el(fieldIds.hintId);
    if (!selectNode || !textNode || !hintNode) return;

    if (treeState.status === 'failed') {
      selectNode.hidden = true;
      textNode.hidden = false;
      hintNode.hidden = false;
      hintNode.textContent = 'The ' + fieldIds.noun + ' list could not be read. Type the name.';
      textNode.value = draft[fieldName] || '';
      return;
    }

    selectNode.hidden = false;
    textNode.hidden = true;
    hintNode.hidden = true;

    selectNode.textContent = '';

    var emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = treeState.status === 'loading' ? 'loading...' : 'not set';
    selectNode.appendChild(emptyOption);

    var groupsInOrder = [];
    treeState.entries.forEach(function (entry) {
      if (groupsInOrder.indexOf(entry.group) === -1) groupsInOrder.push(entry.group);
    });

    var currentValueIsListed = false;

    groupsInOrder.forEach(function (groupName) {
      var groupNode = document.createElement('optgroup');
      groupNode.label = groupName;
      treeState.entries.forEach(function (entry) {
        if (entry.group !== groupName) return;
        var optionNode = document.createElement('option');
        optionNode.value = entry.name;
        optionNode.textContent = entry.name;
        groupNode.appendChild(optionNode);
        if (entry.name === draft[fieldName]) currentValueIsListed = true;
      });
      selectNode.appendChild(groupNode);
    });

    /* A value that came from the item but is not in the store list stays
       selectable, so the form never loses it. */
    if (draft[fieldName] && !currentValueIsListed) {
      var currentGroup = document.createElement('optgroup');
      currentGroup.label = 'current value';
      var currentOption = document.createElement('option');
      currentOption.value = draft[fieldName];
      currentOption.textContent = draft[fieldName];
      currentGroup.appendChild(currentOption);
      selectNode.appendChild(currentGroup);
    }

    selectNode.value = draft[fieldName] || '';
  }

  function loadStoreTree(fieldName) {
    var fieldIds = TREE_FIELD_IDS[fieldName];
    var treeState = storeTrees[fieldName];

    if (!canRequestObjects()) {
      treeState.status = 'failed';
      treeState.entries = [];
      renderTreeField(fieldName);
      return;
    }

    try {
      tool.requestObjects('query', { mainObjectType: fieldIds.storeType }, function (queryError, queryResult) {
        if (queryError) {
          console.warn('[WIM] ' + fieldIds.storeType + ' could not be read', queryError);
          treeState.status = 'failed';
          treeState.entries = [];
          renderTreeField(fieldName);
          return;
        }

        var storeRecords = queryResult && Array.isArray(queryResult.objects) ? queryResult.objects : [];
        treeState.entries = normalizeStoreRows(storeRecords, fieldIds.defaultGroup);
        treeState.status = 'ready';
        renderTreeField(fieldName);
        requestResize();
      });
    } catch (error) {
      console.warn('[WIM] ' + fieldIds.storeType + ' query failed', error);
      treeState.status = 'failed';
      treeState.entries = [];
      renderTreeField(fieldName);
    }
  }

  function readTreeFieldValue(fieldName) {
    var fieldIds = TREE_FIELD_IDS[fieldName];
    var selectNode = el(fieldIds.selectId);
    var textNode = el(fieldIds.textId);

    if (selectNode && selectNode.hidden === false) return String(selectNode.value || '');
    if (textNode) return String(textNode.value || '');
    return '';
  }

  /* ── Tabs ── */
  function activateTab(tabName) {
    activeTabName = tabName;

    TAB_DEFINITIONS.forEach(function (tabDefinition) {
      var isActive = tabDefinition.name === tabName;
      var tabNode = el(tabDefinition.tabId);
      var panelNode = el(tabDefinition.panelId);
      if (tabNode) {
        tabNode.classList.toggle('is-active', isActive);
        tabNode.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tabNode.setAttribute('tabindex', isActive ? '0' : '-1');
      }
      if (panelNode) panelNode.hidden = !isActive;
    });

    requestResize();
  }

  function bindTabKeyboard() {
    TAB_DEFINITIONS.forEach(function (tabDefinition, tabIndex) {
      var tabNode = el(tabDefinition.tabId);
      if (!tabNode) return;
      tabNode.addEventListener('click', function () { activateTab(tabDefinition.name); });
      tabNode.addEventListener('keydown', function (keyEvent) {
        var offset = 0;
        if (keyEvent.key === 'ArrowRight') offset = 1;
        else if (keyEvent.key === 'ArrowLeft') offset = -1;
        else return;
        keyEvent.preventDefault();
        var nextIndex = (tabIndex + offset + TAB_DEFINITIONS.length) % TAB_DEFINITIONS.length;
        var nextDefinition = TAB_DEFINITIONS[nextIndex];
        activateTab(nextDefinition.name);
        var nextTabNode = el(nextDefinition.tabId);
        if (nextTabNode) nextTabNode.focus();
      });
    });
  }

  /* ── Item form ── */
  function ensureSelectOption(selectId, optionValue) {
    var selectNode = el(selectId);
    if (!selectNode || !optionValue) return;
    for (var optionIndex = 0; optionIndex < selectNode.options.length; optionIndex += 1) {
      if (selectNode.options[optionIndex].value === optionValue) return;
    }
    var extraOption = document.createElement('option');
    extraOption.value = optionValue;
    extraOption.textContent = optionValue;
    selectNode.appendChild(extraOption);
  }

  function renderFormValues() {
    Object.keys(FIELD_INPUT_IDS).forEach(function (fieldName) {
      var inputNode = el(FIELD_INPUT_IDS[fieldName]);
      if (!inputNode) return;
      if (inputNode.tagName === 'SELECT') {
        if (draft[fieldName]) {
          ensureSelectOption(FIELD_INPUT_IDS[fieldName], draft[fieldName]);
          inputNode.value = draft[fieldName];
        }
        return;
      }
      inputNode.value = draft[fieldName];
    });

    renderTreeField('product');
    renderTreeField('application');

    var keyInput = el('wim-field-key');
    if (keyInput) keyInput.readOnly = !!record.id;
  }

  function readDraftFromForm() {
    Object.keys(FIELD_INPUT_IDS).forEach(function (fieldName) {
      var inputNode = el(FIELD_INPUT_IDS[fieldName]);
      if (!inputNode) return;
      draft[fieldName] = String(inputNode.value || '');
    });

    draft.product = readTreeFieldValue('product');
    draft.application = readTreeFieldValue('application');
  }

  function collectChangedFields() {
    var changedFields = {};
    EDITABLE_FIELDS.forEach(function (fieldName) {
      if (draft[fieldName] !== record[fieldName]) changedFields[fieldName] = draft[fieldName];
    });
    return changedFields;
  }

  function updateDirtyState() {
    var changedFields = collectChangedFields();
    var hasChanges = Object.keys(changedFields).length > 0;

    var dirtyNode = el('wim-dirty-indicator');
    if (dirtyNode) dirtyNode.hidden = !hasChanges;

    var discardButton = el('wim-discard-item');
    if (discardButton) discardButton.disabled = textIsReadOnly || !hasChanges;

    return hasChanges;
  }

  function renderHeaderChips() {
    el('wim-item-key').textContent = draft.key || 'no key';
    el('wim-item-kind').textContent = draft.kind || 'no kind';
    el('wim-item-status').textContent = draft.status || 'no status';
    el('wim-item-severity').textContent = draft.severity || 'no severity';

    var looksLikeNewItem = !record.id || (!draft.key && !draft.title && !draft.detail);
    var warningNode = el('wim-item-warning');
    warningNode.hidden = !looksLikeNewItem;
    warningNode.textContent = looksLikeNewItem
      ? 'New item: fill the fields below and press Save item.'
      : '';
  }

  function renderPromptSource() {
    el('wim-source-key').textContent = draft.key || 'not recorded';
    el('wim-source-kind').textContent = draft.kind || 'not recorded';
    el('wim-source-title').textContent = draft.title || 'not recorded';
    el('wim-source-product').textContent = draft.product || 'not set';
    el('wim-source-application').textContent = draft.application || 'not set';
    el('wim-source-severity').textContent = draft.severity || 'not recorded';
    el('wim-source-reported-build').textContent = draft.reportedBuild || 'not recorded';

    var activeImages = activeImageList();
    el('wim-source-images').textContent = activeImages.length
      ? activeImages.length + (activeImages.length === 1 ? ' image' : ' images')
      : 'none';
  }

  function renderItemState() {
    renderHeaderChips();
    renderPromptSource();
    renderProgress();
    updateDirtyState();
  }

  /* ── Saving the item ── */
  function friendlySaveErrorText(saveError) {
    var loweredError = String(saveError || '').toLowerCase();
    var isPermissionProblem = loweredError.indexOf('not enabled') !== -1
      || loweredError.indexOf('allowobjectcrud') !== -1
      || loweredError.indexOf('not allowed') !== -1
      || loweredError.indexOf('permission') !== -1
      || loweredError.indexOf('denied') !== -1
      || loweredError.indexOf('unauthorized') !== -1;

    if (isPermissionProblem) {
      return 'item editing is not enabled for this tool. Ask your administrator to enable object CRUD and allow ' + ITEM_TYPE + '.';
    }
    return String(saveError || 'unknown error');
  }

  function updateSaveButtons() {
    var saveButton = el('wim-save-item');
    var discardButton = el('wim-discard-item');
    if (saveButton) saveButton.disabled = textIsReadOnly || savingIsInProgress;
    if (discardButton) discardButton.disabled = textIsReadOnly || savingIsInProgress || !updateDirtyState();
    if (saveButton) saveButton.textContent = savingIsInProgress ? 'Saving...' : 'Save item';
  }

  function applySavedFields(savedFields) {
    Object.keys(savedFields).forEach(function (fieldName) {
      if (fieldName === 'id') {
        record.id = savedFields[fieldName];
        return;
      }
      record[fieldName] = savedFields[fieldName];
    });
  }

  function afterSaveSuccess(savedFields, successMessage) {
    applySavedFields(savedFields);
    resetDraftFromRecord();
    renderFormValues();
    renderItemState();
    updateSaveButtons();
    generatePrompt(false);
    announceItemStatus(successMessage);
    notifyHost('Item saved', 'success');
    requestResize();
  }

  function handleSaveError(saveError) {
    console.warn('[WIM] item save failed', saveError);
    announceItemStatus('Could not save: ' + friendlySaveErrorText(saveError));
    notifyHost('Item was not saved', 'error');
  }

  function saveItem() {
    if (textIsReadOnly) return;
    if (!canRequestObjects()) {
      announceItemStatus('Could not save: this host does not allow object editing.');
      return;
    }

    readDraftFromForm();
    var changedFields = collectChangedFields();

    if (!Object.keys(changedFields).length) {
      announceItemStatus('Nothing to save.');
      return;
    }

    if (!draft.title.trim()) {
      announceItemStatus('A title is needed before the item can be saved.');
      return;
    }

    savingIsInProgress = true;
    updateSaveButtons();

    if (record.id) {
      tool.requestObjects('update', {
        mainObjectType: ITEM_TYPE,
        objectId: record.id,
        productData: { data_categoriesBased: changedFields }
      }, function (saveError) {
        savingIsInProgress = false;
        if (saveError) {
          updateSaveButtons();
          handleSaveError(saveError);
          return;
        }
        afterSaveSuccess(changedFields, 'Saved to the item. Reload the page before using the form Save.');
      });
      return;
    }

    if (!draft.key.trim()) {
      savingIsInProgress = false;
      updateSaveButtons();
      announceItemStatus('A key is needed to create a new item, for example WORK-0008.');
      return;
    }

    tool.requestObjects('create', {
      mainObjectType: ITEM_TYPE,
      name: buildItemName(),
      productData: { data_categoriesBased: changedFields }
    }, function (createError, createResult) {
      savingIsInProgress = false;
      if (createError) {
        updateSaveButtons();
        handleSaveError(createError);
        return;
      }
      var createdObject = createResult && createResult.object ? createResult.object : null;
      if (createdObject) {
        changedFields.id = createdObject.id || createdObject._id || '';
      }
      afterSaveSuccess(changedFields, 'Item created.');
    });
  }

  function buildItemName() {
    var nameParts = [];
    if (draft.key) nameParts.push(draft.key);
    if (draft.title) nameParts.push(draft.title);
    return nameParts.join(' - ') || 'Work item';
  }

  function discardItemChanges() {
    resetDraftFromRecord();
    renderFormValues();
    renderItemState();
    updateSaveButtons();
    generatePrompt(false);
    announceItemStatus('Changes discarded.');
  }

  /* ── Lifecycle and close checks (driven by the form draft) ── */
  function nextStepText() {
    if (draft.status === 'new') return 'Triage it: set the severity and an owner, then move it to accepted.';
    if (draft.status === 'accepted') return 'The owner moves it to working, then builds the prompt and applies the change.';
    if (draft.status === 'working') return 'Apply the change, record the Tool Library build, then close it.';
    if (draft.status === 'done') return 'Closed. Update the tool SSOT if behaviour changed.';
    if (draft.status === 'rejected') return 'Rejected. Keep the reason in the detail.';
    return 'Set the status on the Item tab.';
  }

  function renderProgress() {
    var currentStepIndex = LIFECYCLE_STEPS.indexOf(draft.status);
    var isRejected = draft.status === 'rejected';
    var railNode = el('wim-lifecycle-rail');

    for (var stepIndex = 0; stepIndex < railNode.children.length; stepIndex += 1) {
      var stepNode = railNode.children[stepIndex];
      var stepName = stepNode.getAttribute('data-step');
      var stepPosition = LIFECYCLE_STEPS.indexOf(stepName);

      stepNode.classList.toggle('is-done', !isRejected && currentStepIndex > -1 && stepPosition < currentStepIndex);
      stepNode.classList.toggle('is-current', !isRejected && stepPosition === currentStepIndex);
    }

    el('wim-next-step').textContent = nextStepText();
    renderCloseChecks();
  }

  function parseBuildStamp(buildText) {
    var buildMatch = /^(\d{4})-(\d{2})-(\d{2})-(\d+)$/.exec(String(buildText || '').trim());
    if (!buildMatch) return null;
    return {
      dateKey: buildMatch[1] + buildMatch[2] + buildMatch[3],
      revision: parseInt(buildMatch[4], 10)
    };
  }

  function isBuildNewer(candidateText, baseText) {
    var candidateStamp = parseBuildStamp(candidateText);
    var baseStamp = parseBuildStamp(baseText);
    if (!candidateStamp || !baseStamp) return null;
    if (candidateStamp.dateKey !== baseStamp.dateKey) return candidateStamp.dateKey > baseStamp.dateKey;
    return candidateStamp.revision > baseStamp.revision;
  }

  function buildCloseChecks() {
    var checkList = [];
    var isFinding = draft.kind === 'finding';

    checkList.push({
      label: 'Owner is set',
      state: draft.owner ? 'pass' : 'fail',
      note: draft.owner || 'One owner is required.'
    });

    if (isFinding) {
      checkList.push({
        label: 'Reported build is recorded',
        state: draft.reportedBuild ? 'pass' : 'fail',
        note: draft.reportedBuild || 'A finding must name the build it was seen on.'
      });
    }

    checkList.push({
      label: 'Screenshots are attached',
      state: activeImageList().length ? 'pass' : 'optional',
      note: activeImageList().length
        ? activeImageList().length + (activeImageList().length === 1 ? ' image attached.' : ' images attached.')
        : 'Optional, but one image makes a finding reproducible.'
    });

    checkList.push({
      label: 'Tool library build is recorded',
      state: draft.toolLibraryBuild ? 'pass' : 'fail',
      note: draft.toolLibraryBuild || 'Read the badge of the Tool Library copy after the fix.'
    });

    var buildComparison = isBuildNewer(draft.toolLibraryBuild, draft.reportedBuild);
    var comparisonState = 'fail';
    var comparisonNote = 'Record both builds to compare them.';
    if (draft.toolLibraryBuild && draft.reportedBuild) {
      if (buildComparison === true) {
        comparisonState = 'pass';
        comparisonNote = draft.toolLibraryBuild + ' is newer than ' + draft.reportedBuild + '.';
      } else if (buildComparison === false) {
        comparisonState = 'fail';
        comparisonNote = draft.toolLibraryBuild + ' is not newer than ' + draft.reportedBuild + '.';
      } else {
        comparisonState = 'fail';
        comparisonNote = 'One build is not in YYYY-MM-DD-N form.';
      }
    }
    checkList.push({
      label: 'Tool library build is newer than the reported build',
      state: comparisonState,
      note: comparisonNote
    });

    var isSelfCheck = draft.checkedBy && draft.owner
      && draft.checkedBy.toLowerCase() === draft.owner.toLowerCase();

    checkList.push({
      label: 'Checked by is recorded',
      state: draft.checkedBy ? 'pass' : 'fail',
      note: draft.checkedBy
        ? (isSelfCheck ? 'Self-check by the owner.' : draft.checkedBy + ' checked this item.')
        : 'A second person, or the owner as a self-check.'
    });

    return checkList;
  }

  function renderCloseChecks() {
    var checksNode = el('wim-close-checks');
    checksNode.textContent = '';

    buildCloseChecks().forEach(function (checkItem) {
      var listItem = document.createElement('li');
      listItem.className = 'wim-check is-' + checkItem.state;

      var markNode = document.createElement('span');
      markNode.className = 'wim-check-mark';
      markNode.setAttribute('aria-hidden', 'true');
      markNode.textContent = checkItem.state === 'pass' ? '\u2713' : (checkItem.state === 'fail' ? '!' : '-');

      var textNode = document.createElement('span');
      textNode.className = 'wim-check-text';
      textNode.textContent = checkItem.label + '. ' + checkItem.note;

      listItem.appendChild(markNode);
      listItem.appendChild(textNode);
      checksNode.appendChild(listItem);
    });
  }

  /* ── Notes ── */
  function formatNoteTime(isoText) {
    var noteDate = new Date(isoText);
    if (isNaN(noteDate.getTime())) return toDisplayText(isoText) || 'no date';

    function pad(numberValue) { return String(numberValue).padStart(2, '0'); }
    return noteDate.getFullYear() + '-' + pad(noteDate.getMonth() + 1) + '-' + pad(noteDate.getDate())
      + ' ' + pad(noteDate.getHours()) + ':' + pad(noteDate.getMinutes());
  }

  function renderNotes() {
    var listNode = el('wim-note-list');
    listNode.textContent = '';

    notes.slice().reverse().forEach(function (noteItem) {
      var listItem = document.createElement('li');
      listItem.className = 'wim-note';

      var headNode = document.createElement('div');
      headNode.className = 'wim-note-head';

      var authorNode = document.createElement('span');
      authorNode.textContent = noteItem.by || 'unknown author';

      var timeNode = document.createElement('span');
      timeNode.textContent = formatNoteTime(noteItem.at);

      headNode.appendChild(authorNode);
      headNode.appendChild(timeNode);

      var textNode = document.createElement('p');
      textNode.className = 'wim-note-text';
      textNode.textContent = noteItem.text;

      listItem.appendChild(headNode);
      listItem.appendChild(textNode);
      listNode.appendChild(listItem);
    });

    el('wim-note-empty').hidden = notes.length > 0;
    el('wim-note-count').textContent = notes.length + (notes.length === 1 ? ' note' : ' notes');
    el('wim-notes-tab-count').textContent = String(notes.length);
  }

  function addNote() {
    if (textIsReadOnly) return;

    var noteText = String(el('wim-note-input').value || '').trim();
    if (!noteText) {
      announceNoteStatus('Write the note first.');
      return;
    }

    var currentUser = readCurrentUser();
    var authorText = currentUser ? (toDisplayText(currentUser.name) || toDisplayText(currentUser.email)) : '';

    notes.push({
      id: 'note-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
      at: new Date().toISOString(),
      by: authorText,
      text: noteText
    });

    if (notes.length > MAX_NOTE_COUNT) notes = notes.slice(notes.length - MAX_NOTE_COUNT);

    el('wim-note-input').value = '';
    renderNotes();
    saveToolValue();
    announceNoteStatus('Note added.');
    requestResize();
  }

  /* ── Screenshots ──
     tool.requestUpload sends the file to the host, which stores it in the CMS
     storage bucket and returns a download URL. This tool keeps the URL and the
     decoded storage path, so the file can be found and deleted later. */
  function activeImageList() {
    return images.filter(function (imageEntry) { return !imageEntry.removedAt; });
  }

  function storagePathFromUrl(fileUrl) {
    var pathMatch = /\/o\/([^?]+)/.exec(String(fileUrl || ''));
    if (!pathMatch) return '';
    try {
      return decodeURIComponent(pathMatch[1]);
    } catch (error) {
      return pathMatch[1];
    }
  }

  function formatFileSize(sizeBytes) {
    var byteCount = Number(sizeBytes) || 0;
    if (!byteCount) return '';
    if (byteCount < 1024) return byteCount + ' B';
    if (byteCount < 1024 * 1024) return Math.round(byteCount / 1024) + ' KB';
    return (Math.round(byteCount / 104857.6) / 10) + ' MB';
  }

  function announceImageStatus(messageText, isError) {
    var statusNode = el('wim-image-status');
    if (!statusNode) return;
    statusNode.textContent = messageText || '';
    statusNode.classList.toggle('is-error', !!isError);
  }

  function renderImageCleanupPaths() {
    var cleanupNode = el('wim-image-cleanup');
    var pathListNode = el('wim-image-paths');
    if (!cleanupNode || !pathListNode) return;

    pathListNode.textContent = '';
    cleanupNode.hidden = images.length === 0;

    images.forEach(function (imageEntry) {
      var pathText = imageEntry.storagePath || storagePathFromUrl(imageEntry.url);
      if (!pathText) return;
      var listItem = document.createElement('li');
      listItem.textContent = pathText + (imageEntry.removedAt ? ' (removed from the item)' : '');
      pathListNode.appendChild(listItem);
    });
  }

  function renderImageGallery() {
    var listNode = el('wim-image-list');
    if (!listNode) return;

    var activeImages = activeImageList();
    listNode.textContent = '';

    activeImages.forEach(function (imageEntry) {
      var itemNode = document.createElement('figure');
      itemNode.className = 'wim-image';
      itemNode.setAttribute('data-image-id', imageEntry.id);

      var previewNode = document.createElement('img');
      previewNode.className = 'wim-image-preview';
      previewNode.src = imageEntry.url;
      previewNode.alt = imageEntry.name || 'Screenshot';
      previewNode.loading = 'lazy';
      itemNode.appendChild(previewNode);

      var captionNode = document.createElement('figcaption');
      captionNode.className = 'wim-image-caption';

      var nameNode = document.createElement('span');
      nameNode.className = 'wim-image-name';
      nameNode.textContent = imageEntry.name || 'image';
      nameNode.title = imageEntry.name || 'image';
      captionNode.appendChild(nameNode);

      var sizeText = formatFileSize(imageEntry.sizeBytes);
      if (sizeText) {
        var sizeNode = document.createElement('span');
        sizeNode.className = 'wim-image-meta';
        sizeNode.textContent = sizeText;
        captionNode.appendChild(sizeNode);
      }

      var openNode = document.createElement('a');
      openNode.className = 'wim-image-open';
      openNode.href = imageEntry.url;
      openNode.target = '_blank';
      openNode.rel = 'noopener';
      openNode.textContent = 'open';
      captionNode.appendChild(openNode);

      itemNode.appendChild(captionNode);

      if (!textIsReadOnly) {
        var removeNode = document.createElement('button');
        removeNode.type = 'button';
        removeNode.className = 'wim-image-remove';
        removeNode.setAttribute('data-image-remove', imageEntry.id);
        removeNode.setAttribute('aria-label', 'Remove ' + (imageEntry.name || 'image'));
        removeNode.textContent = 'Remove';
        itemNode.appendChild(removeNode);
      }

      listNode.appendChild(itemNode);
    });

    var emptyNode = el('wim-image-empty');
    if (emptyNode) emptyNode.hidden = activeImages.length > 0;

    var countNode = el('wim-image-count');
    if (countNode) countNode.textContent = activeImages.length + (activeImages.length === 1 ? ' image' : ' images');

    var addNode = el('wim-image-add');
    if (addNode) addNode.disabled = textIsReadOnly;

    renderImageCleanupPaths();
  }

  function saveUploadedImage(uploadedFile) {
    var uploadedUrl = uploadedFile && (uploadedFile.url || uploadedFile.urlPath || uploadedFile.fileUrl);
    if (!uploadedUrl) {
      announceImageStatus('The upload returned no URL.', true);
      return false;
    }

    images.push({
      id: 'img-' + Date.now() + '-' + Math.round(Math.random() * 1000),
      name: toDisplayText(uploadedFile.name) || 'image',
      url: String(uploadedUrl),
      storagePath: storagePathFromUrl(uploadedUrl),
      sizeBytes: Number(uploadedFile.size) || 0,
      type: toDisplayText(uploadedFile.type),
      addedAt: new Date().toISOString(),
      removedAt: ''
    });

    saveToolValue();
    renderImageGallery();
    renderItemState();
    generatePrompt(false);
    return true;
  }

  /* One host picker per image, using the documented upload contract:
     tool.requestUpload(accept, callback). */
  function addImageFromHost() {
    if (textIsReadOnly) return;

    if (typeof tool.requestUpload !== 'function') {
      announceImageStatus('Image upload is not enabled here. Set allowUpload: yes on the field.', true);
      return;
    }

    if (activeImageList().length >= MAX_IMAGE_COUNT) {
      announceImageStatus('At most ' + MAX_IMAGE_COUNT + ' images per item.', true);
      return;
    }

    announceImageStatus('Choose an image...');

    try {
      tool.requestUpload('image/*', function (uploadError, uploadedFile) {
        if (uploadError) {
          console.warn('[WIM] image upload failed', uploadError);
          announceImageStatus('Upload failed: ' + uploadError, true);
          return;
        }

        if (uploadedFile && uploadedFile.size && uploadedFile.size > MAX_IMAGE_BYTES) {
          announceImageStatus((uploadedFile.name || 'That image') + ' is larger than 8 MB.', true);
          return;
        }

        var uploadWasSaved = saveUploadedImage(uploadedFile);
        announceImageStatus(uploadWasSaved
          ? (uploadedFile.name || 'Image') + ' uploaded.'
          : 'The upload returned no URL.', !uploadWasSaved);
      });
    } catch (error) {
      console.warn('[WIM] requestUpload failed', error);
      announceImageStatus('Upload failed: ' + error.message, true);
    }
  }

  function removeImage(imageId) {
    var removedAt = new Date().toISOString();
    images.forEach(function (imageEntry) {
      if (imageEntry.id === imageId) imageEntry.removedAt = removedAt;
    });

    saveToolValue();
    renderImageGallery();
    renderItemState();
    generatePrompt(false);
    announceImageStatus('Image removed from the item. The file stays in storage until it is deleted there.');
  }

  /* ── Admin parameters ── */
  function readAdminParams() {
    params.templateText = toDisplayText(readToolParam('buildPromptTemplate', ''));

    var allowAiParam = readToolParam('allowAi', 'no');
    params.allowAi = allowAiParam === true || String(allowAiParam).toLowerCase() === 'yes';
  }

  /* ── Saved value ── */
  function buildValueObject() {
    return {
      version: VALUE_VERSION,
      notes: notes,
      images: images,
      promptText: lastPromptText,
      generatedAt: lastGeneratedAt,
      templateSource: templateSource
    };
  }

  function normalizedValueJson(valueObject) {
    var safeValue = isRecordObject(valueObject) ? valueObject : {};
    return JSON.stringify({
      version: VALUE_VERSION,
      notes: Array.isArray(safeValue.notes) ? safeValue.notes : [],
      images: Array.isArray(safeValue.images) ? safeValue.images : [],
      promptText: typeof safeValue.promptText === 'string' ? safeValue.promptText : '',
      generatedAt: toDisplayText(safeValue.generatedAt),
      templateSource: toDisplayText(safeValue.templateSource)
    });
  }

  function applySavedNotes(savedNotes) {
    notes = [];
    if (!Array.isArray(savedNotes)) return;

    savedNotes.forEach(function (savedNote) {
      if (!isRecordObject(savedNote)) return;
      var noteText = toDisplayText(savedNote.text);
      if (!noteText) return;
      notes.push({
        id: toDisplayText(savedNote.id) || 'note-' + notes.length,
        at: toDisplayText(savedNote.at),
        by: toDisplayText(savedNote.by),
        text: noteText
      });
    });

    if (notes.length > MAX_NOTE_COUNT) notes = notes.slice(notes.length - MAX_NOTE_COUNT);
  }

  function applySavedImages(savedImageList) {
    images = [];
    if (!Array.isArray(savedImageList)) return;

    savedImageList.forEach(function (savedImage) {
      if (!isRecordObject(savedImage)) return;
      var imageUrl = toDisplayText(savedImage.url);
      if (!imageUrl) return;
      images.push({
        id: toDisplayText(savedImage.id) || 'img-' + images.length,
        name: toDisplayText(savedImage.name),
        url: imageUrl,
        storagePath: toDisplayText(savedImage.storagePath) || storagePathFromUrl(imageUrl),
        sizeBytes: Number(savedImage.sizeBytes) || 0,
        type: toDisplayText(savedImage.type),
        addedAt: toDisplayText(savedImage.addedAt),
        removedAt: toDisplayText(savedImage.removedAt)
      });
    });

    if (images.length > MAX_STORED_IMAGE_COUNT) images = images.slice(images.length - MAX_STORED_IMAGE_COUNT);
  }

  function applySavedValue(savedValue) {
    if (!isRecordObject(savedValue)) return;

    applySavedNotes(savedValue.notes);
    applySavedImages(savedValue.images);

    if (typeof savedValue.promptText === 'string') lastPromptText = savedValue.promptText;
    if (typeof savedValue.generatedAt === 'string') lastGeneratedAt = savedValue.generatedAt;

    var savedTemplateSource = toDisplayText(savedValue.templateSource);
    if (savedTemplateSource === TEMPLATE_SOURCE_ADMIN) templateSource = TEMPLATE_SOURCE_ADMIN;
    if (savedTemplateSource === TEMPLATE_SOURCE_BUILT_IN) templateSource = TEMPLATE_SOURCE_BUILT_IN;

    lastSavedValueJson = normalizedValueJson(savedValue);
  }

  function saveToolValue() {
    if (textIsReadOnly) return;
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    var valueObject = buildValueObject();
    lastSavedValueJson = normalizedValueJson(valueObject);
    try {
      if (typeof tool.setValue === 'function') tool.setValue(valueObject);
    } catch (error) {
      console.warn('[WIM] setValue failed', error);
    }
  }

  function scheduleSave() {
    if (textIsReadOnly) return;
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveToolValue, SAVE_DEBOUNCE_MS);
  }

  /* ── Read-only ── */
  function setFormDisabled() {
    var controlIds = Object.keys(FIELD_INPUT_IDS).map(function (fieldName) {
      return FIELD_INPUT_IDS[fieldName];
    });

    controlIds.push('wim-field-product', 'wim-field-product-text', 'wim-field-application', 'wim-field-application-text');
    controlIds.push('wim-note-input', 'wim-note-add');
    controlIds.push('wim-image-add');

    controlIds.forEach(function (controlId) {
      var controlNode = el(controlId);
      if (controlNode) controlNode.disabled = textIsReadOnly;
    });

    renderImageGallery();
    updateSaveButtons();

    var bannerNode = el('wim-readonly-banner');
    bannerNode.hidden = !textIsReadOnly;
    bannerNode.textContent = textIsReadOnly
      ? 'Read-only. The prompt can still be generated, copied and downloaded.'
      : '';
  }

  /* ── Prompt text ── */
  function activeTemplateText() {
    if (templateSource === TEMPLATE_SOURCE_ADMIN && params.templateText) return params.templateText;
    return '';
  }

  function promptHeadlineText() {
    var keyText = draft.key || 'Work item';
    if (draft.title) return keyText + ' - ' + draft.title;
    return keyText;
  }

  function promptContextText() {
    var contextParts = [];
    if (draft.product) contextParts.push('Product: ' + draft.product);
    if (draft.application) contextParts.push('Application: ' + draft.application);
    if (draft.kind) contextParts.push('Kind: ' + draft.kind);
    if (draft.severity) contextParts.push('Severity: ' + draft.severity);
    if (draft.reportedBuild) contextParts.push('Reported build: ' + draft.reportedBuild);
    return contextParts.join('  |  ');
  }

  function promptTargetText() {
    if (draft.product && draft.application) return draft.product + ' in the ' + draft.application + ' application';
    if (draft.product) return draft.product;
    if (draft.application) return 'the tool this item names in the ' + draft.application + ' application';
    return 'the tool this item names';
  }

  function cleanedBlockText(blockText) {
    return String(blockText || '')
      .split(/\r?\n/)
      .map(function (blockLine) { return blockLine.replace(/[ \t]+$/, ''); })
      .join('\n')
      .trim();
  }

  /* Only the sections with content are written: a label with nothing under it
     is noise for the reader of the prompt. */
  function buildBuiltInPromptText(imageUrlList) {
    var lineList = [];

    lineList.push(promptHeadlineText());
    var contextText = promptContextText();
    if (contextText) lineList.push(contextText);
    lineList.push('');

    var detailText = cleanedBlockText(draft.detail);
    if (detailText) {
      lineList.push('WHAT IS WRONG');
      lineList.push(detailText);
      lineList.push('');
    }

    if (imageUrlList.length) {
      lineList.push('SCREENSHOTS');
      imageUrlList.forEach(function (imageUrl) { lineList.push(imageUrl); });
      lineList.push('');
    }

    lineList.push('DO THIS');
    lineList.push('1. Open ' + promptTargetText() + ' and read its docs/ssot.html first.');
    lineList.push('2. Reproduce the problem described above, then fix the cause, not the symptom.');
    lineList.push('3. Change only what this item needs. Everything the item does not mention keeps working exactly as it does now.');
    lineList.push('');

    lineList.push('FOLLOW');
    PROMPT_RULE_LINES.forEach(function (ruleLine) { lineList.push(ruleLine); });
    lineList.push('');

    lineList.push('UI');
    PROMPT_UI_LINES.forEach(function (uiLine) { lineList.push(uiLine); });
    lineList.push('');

    lineList.push('VERIFY');
    PROMPT_VERIFY_LINES.forEach(function (verifyLine) { lineList.push(verifyLine); });
    lineList.push('');

    lineList.push('REPORT');
    PROMPT_REPORT_LINES.forEach(function (reportLine) { lineList.push(reportLine); });

    return lineList.join('\n');
  }

  function tidyPromptText(promptText) {
    return String(promptText || '')
      .split(/\r?\n/)
      .map(function (lineText) { return lineText.replace(/[ \t]+$/, ''); })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function buildPromptText() {
    var imageUrlList = activeImageList().map(function (imageEntry) { return imageEntry.url; });
    var promptText = '';

    if (activeTemplateText()) {
      var replacementValues = {
        WORK_ITEM_KEY: draft.key || '',
        WORK_ITEM_KIND: draft.kind || '',
        WORK_ITEM_TITLE: draft.title || '',
        PRODUCT: draft.product || '',
        APPLICATION: draft.application || '',
        SEVERITY: draft.severity || '',
        REPORTED_BUILD: draft.reportedBuild || '',
        DETAIL: cleanedBlockText(draft.detail),
        SCREENSHOTS: imageUrlList.join('\n'),
        PROOF: imageUrlList.join('\n')
      };

      promptText = activeTemplateText().replace(PLACEHOLDER_PATTERN, function (placeholderToken) {
        var placeholderName = placeholderToken.slice(2, placeholderToken.length - 2);
        if (Object.prototype.hasOwnProperty.call(replacementValues, placeholderName)) {
          return replacementValues[placeholderName];
        }
        return '';
      });
    } else {
      promptText = buildBuiltInPromptText(imageUrlList);
    }

    promptText = tidyPromptText(promptText);
    if (/\bundefined\b|\bnull\b/.test(promptText)) {
      console.warn('[WIM] the template or a field produced undefined or null; removed');
      promptText = promptText.replace(/\bundefined\b/g, '').replace(/\bnull\b/g, '');
      promptText = tidyPromptText(promptText);
    }

    return promptText;
  }

  function updatePromptMeta() {
    var characterCount = lastPromptText.length;
    el('wim-prompt-char-count').textContent = characterCount + (characterCount === 1 ? ' character' : ' characters');
    el('wim-prompt-build').textContent = 'build ' + TOOL_BUILD;
  }

  function generatePrompt(shouldPersist) {
    lastPromptText = buildPromptText();
    lastGeneratedAt = new Date().toISOString();
    el('wim-prompt-output').textContent = lastPromptText;
    updatePromptMeta();
    if (shouldPersist !== false) saveToolValue();
    requestResize();
  }

  function renderTemplateState() {
    var templateChip = el('wim-template-chip');
    var templateRow = el('wim-template-row');
    var templateButton = el('wim-use-builtin');
    var templateHint = el('wim-template-hint');

    if (!params.templateText) {
      templateChip.hidden = true;
      templateRow.hidden = true;
      return;
    }

    var adminTemplateIsActive = templateSource === TEMPLATE_SOURCE_ADMIN;
    templateChip.hidden = false;
    templateRow.hidden = false;
    templateChip.textContent = adminTemplateIsActive ? 'custom template' : 'built-in template';
    templateButton.textContent = adminTemplateIsActive ? 'Use built-in template' : 'Use custom template';
    templateHint.textContent = adminTemplateIsActive
      ? 'The admin template is in use.'
      : 'The admin template is ignored here.';
  }

  function toggleTemplateSource() {
    if (!params.templateText) return;
    templateSource = templateSource === TEMPLATE_SOURCE_ADMIN ? TEMPLATE_SOURCE_BUILT_IN : TEMPLATE_SOURCE_ADMIN;
    renderTemplateState();
    generatePrompt(true);
    announcePromptStatus(templateSource === TEMPLATE_SOURCE_ADMIN
      ? 'The admin template is in use.'
      : 'The built-in template is in use.');
  }

  /* ── Copy and download ── */
  function selectPromptInPreview() {
    var promptNode = el('wim-prompt-output');
    var currentSelection = window.getSelection ? window.getSelection() : null;
    if (!promptNode || !currentSelection) return false;

    var selectionRange = document.createRange();
    selectionRange.selectNodeContents(promptNode);
    currentSelection.removeAllRanges();
    currentSelection.addRange(selectionRange);
    if (typeof promptNode.focus === 'function') promptNode.focus();
    return true;
  }

  function copyWithSelectionFallback(promptText) {
    var helperTextarea = document.createElement('textarea');
    helperTextarea.value = promptText;
    helperTextarea.setAttribute('readonly', 'readonly');
    helperTextarea.style.position = 'fixed';
    helperTextarea.style.top = '-1000px';
    helperTextarea.style.left = '-1000px';
    document.body.appendChild(helperTextarea);
    helperTextarea.select();

    var copySucceeded = false;
    try {
      copySucceeded = document.execCommand('copy');
    } catch (error) {
      copySucceeded = false;
    }

    document.body.removeChild(helperTextarea);

    if (copySucceeded) {
      announcePromptStatus('Prompt copied to the clipboard.');
      notifyHost('Prompt copied', 'success');
      return;
    }

    selectPromptInPreview();
    announcePromptStatus('The clipboard is blocked here. The prompt is selected - press Ctrl+C.');
    notifyHost('Clipboard blocked - the prompt is selected for manual copy', 'warning');
  }

  function copyPromptToClipboard() {
    if (!lastPromptText) generatePrompt(false);
    if (!lastPromptText) return;

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      var copyIsSettled = false;
      var fallbackTimer = window.setTimeout(function () {
        if (copyIsSettled) return;
        copyIsSettled = true;
        copyWithSelectionFallback(lastPromptText);
      }, 1200);

      navigator.clipboard.writeText(lastPromptText).then(function () {
        if (copyIsSettled) return;
        copyIsSettled = true;
        window.clearTimeout(fallbackTimer);
        announcePromptStatus('Prompt copied to the clipboard.');
        notifyHost('Prompt copied', 'success');
      }, function () {
        if (copyIsSettled) return;
        copyIsSettled = true;
        window.clearTimeout(fallbackTimer);
        copyWithSelectionFallback(lastPromptText);
      });
      return;
    }

    copyWithSelectionFallback(lastPromptText);
  }

  function buildPromptFileName() {
    var baseName = draft.key || 'work-item';
    var safeName = String(baseName).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return (safeName || 'work-item') + '-build-prompt.md';
  }

  function downloadPromptFile() {
    if (!lastPromptText) generatePrompt(false);

    var fileName = buildPromptFileName();
    var promptBlob = new Blob([lastPromptText], { type: 'text/markdown;charset=utf-8' });
    var objectUrl = URL.createObjectURL(promptBlob);

    var downloadLink = document.createElement('a');
    downloadLink.href = objectUrl;
    downloadLink.download = fileName;
    downloadLink.rel = 'noopener';
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    window.setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 2000);

    announcePromptStatus('Saved ' + fileName + '.');
    notifyHost('Prompt downloaded as ' + fileName, 'success');
  }

  /* ── Events ── */
  function bindEvents() {
    if (eventsAreBound) return;
    eventsAreBound = true;

    bindTabKeyboard();

    Object.keys(FIELD_INPUT_IDS).forEach(function (fieldName) {
      var inputNode = el(FIELD_INPUT_IDS[fieldName]);
      if (!inputNode) return;
      inputNode.addEventListener('input', function () { handleFieldChange(); });
      inputNode.addEventListener('change', function () { handleFieldChange(); });
    });

    ['product', 'application'].forEach(function (fieldName) {
      var fieldIds = TREE_FIELD_IDS[fieldName];
      var selectNode = el(fieldIds.selectId);
      var textNode = el(fieldIds.textId);
      if (selectNode) selectNode.addEventListener('change', function () { handleFieldChange(); });
      if (textNode) textNode.addEventListener('input', function () { handleFieldChange(); });
    });

    el('wim-save-item').addEventListener('click', saveItem);
    el('wim-discard-item').addEventListener('click', discardItemChanges);
    el('wim-generate').addEventListener('click', function () {
      generatePrompt(true);
      announcePromptStatus('Prompt generated for ' + (draft.key || 'this item') + '.');
    });
    el('wim-copy').addEventListener('click', copyPromptToClipboard);
    el('wim-download').addEventListener('click', downloadPromptFile);
    el('wim-use-builtin').addEventListener('click', toggleTemplateSource);
    el('wim-note-add').addEventListener('click', addNote);

    el('wim-image-add').addEventListener('click', addImageFromHost);

    el('wim-image-list').addEventListener('click', function (clickEvent) {
      var removeNode = clickEvent.target && clickEvent.target.closest
        ? clickEvent.target.closest('[data-image-remove]')
        : null;
      if (!removeNode) return;
      removeImage(removeNode.getAttribute('data-image-remove'));
    });

    el('wim-note-input').addEventListener('keydown', function (keyEvent) {
      if (keyEvent.key === 'Enter' && (keyEvent.ctrlKey || keyEvent.metaKey)) {
        keyEvent.preventDefault();
        addNote();
      }
    });
  }

  function handleFieldChange() {
    readDraftFromForm();
    renderItemState();
    updateSaveButtons();
    generatePrompt(false);
  }

  /* ── Declarations for the CMS designer ── */
  try {
    if (typeof tool.declareParams === 'function') {
      tool.declareParams([
        {
          name: 'buildPromptTemplate',
          label: 'Build prompt template',
          type: 'text',
          default: '',
          severity: 'optional',
          hint: 'Replaces the built-in build prompt without a rebuild. Keep the double-brace placeholders, for example WORK_ITEM_KEY, PRODUCT, DETAIL.'
        },
        {
          name: 'allowAi',
          label: 'Allow AI polish (reserved)',
          type: 'toggle',
          default: 'no',
          severity: 'optional',
          hint: 'Reserved. Off by default. This build never calls the AI relay.'
        }
      ]);
    }
  } catch (error) {
    console.warn('[WIM] declareParams failed', error);
  }

  try {
    if (typeof tool.declareOutput === 'function') {
      tool.declareOutput({
        type: 'object',
        properties: {
          version: { type: 'number' },
          notes: {
            type: 'array',
            description: 'Append-only working notes: id, at, by, text',
            items: { type: 'object' }
          },
          images: {
            type: 'array',
            description: 'Screenshots: id, name, url, storagePath, sizeBytes, type, addedAt, removedAt',
            items: { type: 'object' }
          },
          promptText: { type: 'string', description: 'The generated build prompt' },
          generatedAt: { type: 'string', description: 'ISO timestamp of the last generation' },
          templateSource: { type: 'string', description: 'admin or built-in' }
        }
      });
    }
  } catch (error) {
    console.warn('[WIM] declareOutput failed', error);
  }

  /* ── Entry point ── */
  tool.onReady(function (readyFields) {
    var fieldsSnapshot = null;
    try {
      if (typeof tool.getFields === 'function') fieldsSnapshot = tool.getFields();
    } catch (error) {
      console.warn('[WIM] getFields failed', error);
    }

    applyRecord(fieldsSnapshot, readyFields);
    readAdminParams();

    templateSource = params.templateText ? TEMPLATE_SOURCE_ADMIN : TEMPLATE_SOURCE_BUILT_IN;

    applySavedValue(readSavedValue());

    renderFormValues();
    readDraftFromForm();
    renderItemState();
    renderNotes();
    renderImageGallery();
    renderTemplateState();
    bindEvents();

    textIsReadOnly = readIsReadOnly();
    setFormDisabled();
    activateTab('item');

    el('wim-build-badge').textContent = 'tool build ' + TOOL_BUILD;
    generatePrompt(false);
    announcePromptStatus('Ready.');

    loadStoreTree('product');
    loadStoreTree('application');

    /* No reportMissingParams call: every parameter is optional and has a
       working default, so nothing is ever genuinely required. */

    try {
      if (typeof tool.onReadonlyChange === 'function') {
        tool.onReadonlyChange(function (isReadOnlyNow) {
          textIsReadOnly = !!isReadOnlyNow;
          setFormDisabled();
        });
      }
    } catch (error) {
      console.warn('[WIM] onReadonlyChange failed', error);
    }

    try {
      if (typeof tool.onValueChange === 'function') {
        tool.onValueChange(function (newValue) {
          if (!isRecordObject(newValue)) return;
          if (normalizedValueJson(newValue) === lastSavedValueJson) return;
          applySavedValue(newValue);
          renderTemplateState();
          renderNotes();
          renderImageGallery();
          generatePrompt(false);
        });
      }
    } catch (error) {
      console.warn('[WIM] onValueChange failed', error);
    }

    try {
      if (typeof tool.onFieldsChange === 'function') {
        tool.onFieldsChange(function (allFields) {
          var hasUnsavedChanges = Object.keys(collectChangedFields()).length > 0;
          applyRecord(allFields, fieldsSnapshot);
          if (!hasUnsavedChanges) {
            renderFormValues();
            renderItemState();
            updateSaveButtons();
            generatePrompt(false);
          } else {
            renderHeaderChips();
            renderPromptSource();
            renderProgress();
          }
        });
      }
    } catch (error) {
      console.warn('[WIM] onFieldsChange failed', error);
    }
  });
})();
