/* js build 2025-01-06-6 */
var TOOL_BUILD = '2025-01-06-5';
/* T-31: backup identity. Every captured record and downloaded backup carries both values. */
var AJDW_APP_ID = 'ajdw-jd-studio';
var AJDW_SCHEMA_VERSION = 2;
console.log('[TOOL:BOOT] build ' + TOOL_BUILD);

/* T-27 screen-reader basics and T-28 print/narrow-viewport guards. Additive only: no storage, no network, no framework. */
var AJDW_STYLE_GUARDS = [
  '@media print {',
  '  .ajdw-button, .ajdw-tab, .ajdw-actions, .ajdw-tabs, .ajdw-export-row,',
  '  .ajdw-export-controls, .ajdw-export-bar, .ajdw-import, .ajdw-versions,',
  '  .ajdw-build-badge, .ajdw-status, .ajdw-controls, .ajdw-header, .ajdw-check-panel {',
  '    display: none !important;',
  '  }',
  '  .ajdw-app, .ajdw-layout, .ajdw-column, .ajdw-preview, .ajdw-preview-body {',
  '    max-width: none !important;',
  '    background: #ffffff !important;',
  '    color: #000000 !important;',
  '  }',
  '}',
  '@media (max-width: 480px) {',
  '  .ajdw-app, .ajdw-layout, .ajdw-column, .ajdw-form, .ajdw-main, .ajdw-preview,',
  '  .ajdw-check-panel, .ajdw-export-bar, .ajdw-section, .ajdw-version-list {',
  '    max-width: 100% !important;',
  '    box-sizing: border-box !important;',
  '  }',
  '  .ajdw-tabs, .ajdw-actions, .ajdw-export-row, .ajdw-export-controls, .ajdw-section-controls {',
  '    display: flex;',
  '    flex-wrap: wrap;',
  '    max-width: 100%;',
  '  }',
  '  .ajdw-tab, .ajdw-button, .ajdw-input, .ajdw-select, .ajdw-textarea, .ajdw-preview-body {',
  '    max-width: 100% !important;',
  '    box-sizing: border-box !important;',
  '    overflow-wrap: anywhere;',
  '  }',
  '  .ajdw-button, .ajdw-tab {',
  '    white-space: normal;',
  '  }',
  '}'
].join('\n');

function ajdwHumanLabel(raw) {
  var text = String(raw === null || raw === undefined ? '' : raw).replace(/[_.\-]+/g, ' ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
  if (!text) return 'Field';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ajdwIsFormControl(node) {
  if (!node || !node.tagName) return false;
  var tag = String(node.tagName).toLowerCase();
  return tag === 'input' || tag === 'select' || tag === 'textarea';
}

function ajdwHasAccessibleLabel(node) {
  if (node.getAttribute('aria-label') || node.getAttribute('aria-labelledby')) return true;
  var doc = node.ownerDocument || document;
  var id = node.getAttribute('id');
  if (id && doc && doc.querySelector) {
    var safe = String(id).replace(/["\\]/g, '\\var AJDW_TONE_PRESETS = {');
    if (doc.querySelector('label[for="' + safe + '"]')) return true;
  }
  var parent = node.parentNode;
  var depth = 0;
  while (parent && parent.tagName && depth < 6) {
    if (String(parent.tagName).toLowerCase() === 'label') return true;
    parent = parent.parentNode;
    depth += 1;
  }
  return false;
}

function ajdwLabelOne(node) {
  if (!ajdwIsFormControl(node) || ajdwHasAccessibleLabel(node)) return;
  var source = node.getAttribute('name') || node.getAttribute('placeholder') || node.getAttribute('data-ajdw-field') || node.getAttribute('type') || node.tagName;
  node.setAttribute('aria-label', ajdwHumanLabel(source));
}

function ajdwMarkStatusOne(node) {
  if (!node.getAttribute('role')) node.setAttribute('role', 'status');
  if (!node.getAttribute('aria-live')) node.setAttribute('aria-live', 'polite');
  if (!node.getAttribute('aria-atomic')) node.setAttribute('aria-atomic', 'true');
}

function ajdwApplyA11yPass(root) {
  var scope = root && root.querySelectorAll ? root : document;
  if (!scope || !scope.querySelectorAll) return;
  var nodes = [];
  if (scope.nodeType === 1) nodes.push(scope);
  var found = scope.querySelectorAll('input, select, textarea, .ajdw-status');
  var i;
  for (i = 0; i < found.length; i += 1) nodes.push(found[i]);
  for (i = 0; i < nodes.length; i += 1) {
    var node = nodes[i];
    var cls = node.getAttribute && node.getAttribute('class') ? node.getAttribute('class') : '';
    if (String(cls).indexOf('ajdw-status') !== -1) {
      ajdwMarkStatusOne(node);
    } else {
      ajdwLabelOne(node);
    }
  }
}

function ajdwEnsureStyleGuards() {
  if (!document || !document.createElement) return;
  if (document.getElementById('ajdw-style-guards')) return;
  var host = document.head || document.documentElement;
  if (!host) return;
  var style = document.createElement('style');
  style.setAttribute('id', 'ajdw-style-guards');
  style.setAttribute('data-tool-build', TOOL_BUILD);
  style.appendChild(document.createTextNode(AJDW_STYLE_GUARDS));
  host.appendChild(style);
}

function ajdwA11yBoot() {
  try { ajdwEnsureStyleGuards(); } catch (e) {}
  try { ajdwApplyA11yPass(document); } catch (e) {}
  try {
    if (typeof MutationObserver !== 'function' || !document) return;
    var target = document.body || document.documentElement;
    if (!target) return;
    var observer = new MutationObserver(function (records) {
      var i;
      var j;
      for (i = 0; i < records.length; i += 1) {
        var added = records[i].addedNodes || [];
        for (j = 0; j < added.length; j += 1) {
          var node = added[j];
          if (node && node.nodeType === 1) {
            try { ajdwApplyA11yPass(node); } catch (e) {}
          }
        }
      }
    });
    observer.observe(target, { childList: true, subtree: true });
  } catch (e) {}
}

if (typeof document !== 'undefined') {
  ajdwA11yBoot();
}

var AJDW_TONE_PRESETS = {
  professional: 'Clear, professional plain English. No slang, no hype.',
  warm: 'Warm, human and welcoming. Plain English, no slang.',
  friendly: 'Friendly and encouraging. Plain English, no slang.',
  direct: 'Direct, concise and factual. Short sentences, no hype.',
  formal: 'Formal but readable. Full sentences, no jargon.'
};

var AJDW_CHECK_THRESHOLDS = {
  maxSentenceWords: 25,
  maxGradeLevel: 12,
  advertChars: { standard: 800, short: 300, social: 150 }
};

var AJDW_ROLE_BRIEF_INPUTS = [
  { name: 'roleTitle', elementId: 'ajdw-role-title', label: 'Role title', required: true },
  { name: 'department', elementId: 'ajdw-department', label: 'Department', required: true },
  { name: 'location', elementId: 'ajdw-location', label: 'Location', required: true },
  { name: 'employmentType', elementId: 'ajdw-employment-type', label: 'Employment type', required: true },
  { name: 'seniority', elementId: 'ajdw-seniority', label: 'Seniority', required: false },
  { name: 'salary', elementId: 'ajdw-salary', label: 'Salary', required: false },
  { name: 'summary', elementId: 'ajdw-summary', label: 'Summary', required: true },
  { name: 'duties', elementId: 'ajdw-duties', label: 'Duties', required: false },
  { name: 'requirements', elementId: 'ajdw-requirements', label: 'Requirements', required: false },
  { name: 'companyContext', elementId: 'ajdw-company-context', label: 'Company context', required: false },
  { name: 'tone', elementId: 'ajdw-tone', label: 'Tone', required: false }
];

tool.onReady(function () {
  ajdwInitPreviewAndExport();
  tool.declareParams(AJDW_ROLE_BRIEF_INPUTS.map(function (param) { return param.name; }));

  var form = document.getElementById('ajdw-role-brief-form');
  if (!form) { return; }

  function getField(param) {
    return document.getElementById(param.elementId);
  }

  function getErrorEl(param) {
    var errorEl = document.getElementById(param.elementId + '-error');
    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.className = 'ajdw-field-error';
      errorEl.id = param.elementId + '-error';
      errorEl.setAttribute('aria-live', 'polite');
      var field = getField(param);
      if (field && field.parentNode) {
        field.parentNode.appendChild(errorEl);
      }
    }
    return errorEl;
  }

  function joinLabels(labels) {
    if (!labels.length) { return ''; }
    if (labels.length === 1) { return labels[0]; }
    if (labels.length === 2) { return labels[0] + ' and ' + labels[1]; }
    return labels.slice(0, -1).join(', ') + ', and ' + labels[labels.length - 1];
  }

  function setFieldError(param, message) {
    var errorEl = getErrorEl(param);
    errorEl.textContent = message || '';
    var field = getField(param);
    if (field) {
      if (message) {
        field.classList.add('ajdw-field--invalid');
        field.setAttribute('aria-invalid', 'true');
        field.setAttribute('aria-describedby', errorEl.id);
      } else {
        field.classList.remove('ajdw-field--invalid');
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
      }
    }
  }

  function showFormError(message) {
    var errorEl = document.getElementById('ajdw-form-error');
    if (!errorEl) { return; }
    errorEl.textContent = message || '';
    if (message) { errorEl.hidden = false; }
    else { errorEl.hidden = true; }
  }

  function isSalaryValid(value) {
    var trimmed = value.trim();
    if (!trimmed) { return true; }
    var normalized = trimmed.replace(/[,\s$]/g, '');
    return /^\d{1,12}$/.test(normalized) || /^\d{1,12}-\d{1,12}$/.test(normalized);
  }

  function collectState() {
    var missing = [];
    AJDW_ROLE_BRIEF_INPUTS.forEach(function (param) {
      var field = getField(param);
      if (param.required && field && field.value.trim() === '') {
        missing.push(param);
      }
    });
    var salaryParam = null;
    AJDW_ROLE_BRIEF_INPUTS.forEach(function (param) {
      if (param.name === 'salary') { salaryParam = param; }
    });
    var salaryField = salaryParam ? getField(salaryParam) : null;
    var salaryInvalid = !!salaryField && salaryField.value.trim() !== '' && !isSalaryValid(salaryField.value);
    return { missing: missing, salaryInvalid: salaryInvalid };
  }

  function statusFromState(state) {
    if (state.missing.length === 0 && !state.salaryInvalid) { return 'Ready to generate.'; }
    var messages = [];
    if (state.missing.length > 0) {
      messages.push('Fix ' + state.missing.length + ' fields: ' + joinLabels(state.missing.map(function (param) { return param.label; })) + '.');
    }
    if (state.salaryInvalid) {
      messages.push('Fix salary: enter a number or range like 60000 or 60000-70000.');
    }
    return messages.join(' ');
  }

  function refreshStatus() {
    var status = document.getElementById('ajdw-status');
    if (!status) { return; }
    if (isGenerating) {
      status.textContent = 'Generating your job description…';
      status.className = 'ajdw-status ajdw-status--busy';
      return;
    }
    status.textContent = statusFromState(collectState());
    status.className = 'ajdw-status';
  }

  var AJDW_REQUIRED_FIELDS = ['roleTitle', 'summary', 'duties'];

  function ajdwIsRequiredName(name) {
    return AJDW_REQUIRED_FIELDS.indexOf(name) >= 0;
  }

  function ajdwFindParam(name) {
    var found = null;
    AJDW_ROLE_BRIEF_INPUTS.forEach(function (param) {
      if (param.name === name) { found = param; }
    });
    return found;
  }

  function ajdwSetRequiredMinimum() {
    AJDW_ROLE_BRIEF_INPUTS.forEach(function (param) {
      var field = document.getElementById(param.elementId);
      param.required = ajdwIsRequiredName(param.name);
      if (!param.required && field && field.hasAttribute && field.hasAttribute('required')) {
        field.removeAttribute('required');
      }
      if (param.required && field && field.setAttribute) {
        field.setAttribute('aria-required', 'true');
      }
    });
  }

  function ajdwMarkRequiredLabels() {
    AJDW_REQUIRED_FIELDS.forEach(function (name) {
      var param = ajdwFindParam(name);
      if (!param) { return; }
      var label = document.querySelector('label[for="' + param.elementId + '"]');
      if (!label || label.getAttribute('data-ajdw-required') === '1') { return; }
      label.setAttribute('data-ajdw-required', '1');
      var mark = document.createElement('span');
      mark.className = 'ajdw-required-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = ' *';
      label.appendChild(mark);
      var sr = document.createElement('span');
      sr.className = 'ajdw-sr-only';
      sr.textContent = ' (required)';
      label.appendChild(sr);
    });
  }

  function ajdwInsertBriefHelper() {
    if (document.getElementById('ajdw-brief-required-hint')) { return; }
    var headings = document.querySelectorAll('#ajdw-role-brief-form h1, #ajdw-role-brief-form h2, #ajdw-role-brief-form h3, #ajdw-app-root h2');
    var target = null;
    for (var i = 0; i < headings.length; i += 1) {
      var text = (headings[i].textContent || '').replace(/\s+/g, ' ').replace(/\s\*$/, '').trim().toLowerCase();
      if (text === 'role brief') { target = headings[i]; break; }
    }
    if (!target || !target.parentNode) { return; }
    var hint = document.createElement('p');
    hint.className = 'ajdw-brief-required-hint';
    hint.id = 'ajdw-brief-required-hint';
    hint.textContent = 'Required to generate: Role title, Summary and Duties. Department, Location, Employment type and everything else are optional context.';
    target.parentNode.insertBefore(hint, target.nextSibling);
  }

  function ajdwInitRequiredFields() {
    ajdwSetRequiredMinimum();
    ajdwMarkRequiredLabels();
    ajdwInsertBriefHelper();
    var button = document.getElementById('ajdw-generate-button');
    if (button && button.setAttribute) {
      button.disabled = false;
      button.removeAttribute('disabled');
    }
  }

  setTimeout(ajdwInitRequiredFields, 0);

  function runValidation() {
    var state = collectState();
    AJDW_ROLE_BRIEF_INPUTS.forEach(function (param) {
      setFieldError(param, '');
    });
    state.missing.forEach(function (param) {
      setFieldError(param, param.label + ' is required.');
    });
    var salaryParam = null;
    AJDW_ROLE_BRIEF_INPUTS.forEach(function (param) {
      if (param.name === 'salary') { salaryParam = param; }
    });
    if (state.salaryInvalid && salaryParam) {
      setFieldError(salaryParam, 'Enter a number or range like 60000 or 60000-70000.');
    }
    refreshStatus();

    var ajdwIsValid = state.missing.length === 0 && !state.salaryInvalid;
    showFormError(ajdwIsValid ? '' : statusFromState(state));
    if (!ajdwIsValid) {
      var ajdwFirstParam = state.missing.length ? state.missing[0] : salaryParam;
      var ajdwFirstField = ajdwFirstParam ? getField(ajdwFirstParam) : null;
      if (ajdwFirstField && typeof ajdwFirstField.focus === 'function') { ajdwFirstField.focus(); }
    }

    if (state.missing.length > 0) {
      tool.reportMissingParams(state.missing.map(function (param) { return param.name; }));
    }
    return ajdwIsValid;
  }

  var isGenerating = false;

  function buildBriefPrompt() {
    var rawBrief = {};
    AJDW_ROLE_BRIEF_INPUTS.forEach(function (param) {
      var field = getField(param);
      rawBrief[param.name] = field ? field.value.trim() : '';
    });
    var brief = ajdwSanitizeBrief(rawBrief);
    brief.tone = ajdwResolveTone(brief.tone);
    brief.maxSentenceWords = AJDW_CHECK_THRESHOLDS.maxSentenceWords;
    brief.maxGradeLevel = AJDW_CHECK_THRESHOLDS.maxGradeLevel;
    return [
      'Generate a complete, structured job description and three job advert variants.',
      'Respond with strict JSON only, no markdown fences.',
      'Return exactly these keys: summary (string), responsibilities (array of strings), requirements (array of strings), companyContext (string), adverts (object with standard, short, social; each has text and approxCharacters).',
      'Make standard about 800 characters, short about 300 characters, social about 150 characters.',
      'Use English.',
      'Role brief: ' + JSON.stringify(brief)
    ].join('\n');
  }

  var requestSchema = {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      responsibilities: { type: 'array', items: { type: 'string' } },
      requirements: { type: 'array', items: { type: 'string' } },
      companyContext: { type: 'string' },
      adverts: {
        type: 'object',
        properties: {
          standard: { type: 'object', properties: { text: { type: 'string' }, approxCharacters: { type: 'number' } } },
          short: { type: 'object', properties: { text: { type: 'string' }, approxCharacters: { type: 'number' } } },
          social: { type: 'object', properties: { text: { type: 'string' }, approxCharacters: { type: 'number' } } }
        }
      }
    },
    required: ['summary', 'responsibilities', 'requirements', 'companyContext', 'adverts']
  };

  var AJDW_BUSY_MESSAGE = 'Generating your job description…';

  function setBusyState(isBusy, message, tone) {
    var status = document.getElementById('ajdw-status');
    var generateButton = document.getElementById('ajdw-generate-button');
    var retryButton = document.getElementById('ajdw-retry-button');
    var form = document.getElementById('ajdw-role-brief-form');
    if (isBusy) {
      if (status) {
        status.textContent = AJDW_BUSY_MESSAGE;
        status.className = 'ajdw-status ajdw-status--busy';
      }
      if (generateButton) {
        generateButton.disabled = true;
        generateButton.setAttribute('aria-busy', 'true');
      }
      if (retryButton) { retryButton.hidden = true; retryButton.disabled = true; }
      if (form) { form.setAttribute('aria-busy', 'true'); }
      return;
    }
    if (generateButton) {
      generateButton.disabled = false;
      generateButton.removeAttribute('aria-busy');
    }
    if (form) { form.removeAttribute('aria-busy'); }
    if (status && message) {
      status.textContent = message;
      status.className = 'ajdw-status ajdw-status--' + (tone || 'info');
    } else {
      refreshStatus();
    }
  }

  function asDraftText(value) {
    return value == null ? '' : String(value);
  }

  function asDraftArray(value) {
    return Array.isArray(value) ? value : (value == null ? [] : [value]);
  }

  function renderDraft(draft) {
    var main = document.getElementById('ajdw-main');
    var status = document.getElementById('ajdw-status');
    if (!main) { return; }
    main.innerHTML = '';
    main.setAttribute('aria-live', 'polite');

    var results = document.createElement('div');
    results.className = 'ajdw-results';

    var title = document.createElement('h2');
    title.className = 'ajdw-results-title';
    title.textContent = 'Generated draft';
    results.appendChild(title);

    var sections = [
      { key: 'summary', label: 'Summary', value: asDraftText(draft.summary), rows: 3 },
      { key: 'responsibilities', label: 'Responsibilities', value: asDraftArray(draft.responsibilities).join('\n'), rows: 6 },
      { key: 'requirements', label: 'Requirements', value: asDraftArray(draft.requirements).join('\n'), rows: 6 },
      { key: 'companyContext', label: 'Company context', value: asDraftText(draft.companyContext), rows: 3 }
    ];

    sections.forEach(function (section) {
      var field = document.createElement('div');
      field.className = 'ajdw-section';
      var label = document.createElement('label');
      label.className = 'ajdw-section-title';
      label.htmlFor = 'ajdw-section-' + section.key;
      label.textContent = section.label;
      var textarea = document.createElement('textarea');
      textarea.className = 'ajdw-textarea ajdw-section-textarea';
      textarea.id = 'ajdw-section-' + section.key;
      textarea.value = section.value;
      textarea.rows = section.rows;
      field.appendChild(label);
      field.appendChild(textarea);
      results.appendChild(field);
    });

    var advertsTitle = document.createElement('h3');
    advertsTitle.className = 'ajdw-results-subtitle';
    advertsTitle.textContent = 'Advert variants';
    results.appendChild(advertsTitle);

    var advertsData = draft.adverts || {};
    var variants = [
      { key: 'standard', label: 'Standard job board (about 800 characters)', max: 800 },
      { key: 'short', label: 'Short (about 300 characters)', max: 300 },
      { key: 'social', label: 'Social (about 150 characters)', max: 150 }
    ];

    variants.forEach(function (variant) {
      var ad = advertsData[variant.key] || {};
      var text = asDraftText(ad.text);
      var card = document.createElement('div');
      card.className = 'ajdw-advert-card';
      var label = document.createElement('label');
      label.className = 'ajdw-section-title';
      label.htmlFor = 'ajdw-advert-' + variant.key;
      label.textContent = variant.label;
      var textarea = document.createElement('textarea');
      textarea.className = 'ajdw-textarea ajdw-advert-textarea';
      textarea.id = 'ajdw-advert-' + variant.key;
      textarea.value = text;
      textarea.rows = 3;
      var count = document.createElement('span');
      count.className = 'ajdw-char-count';
      count.id = 'ajdw-advert-count-' + variant.key;
      count.textContent = text.length + ' / ' + variant.max + ' characters';
      textarea.addEventListener('input', function () {
        count.textContent = textarea.value.length + ' / ' + variant.max + ' characters';
      });
      card.appendChild(label);
      card.appendChild(textarea);
      card.appendChild(count);
      results.appendChild(card);
    });

    main.appendChild(results);

    if (status) {
      status.textContent = 'Draft generated.';
      status.className = 'ajdw-status ajdw-status--success';
    }
    var generateButton = document.getElementById('ajdw-generate-button');
    var retryButton = document.getElementById('ajdw-retry-button');
    if (generateButton) { generateButton.disabled = false; }
    if (retryButton) { retryButton.hidden = true; retryButton.disabled = true; }
  }

  function showRetryPath() {
    var retryButton = document.getElementById('ajdw-retry-button');
    if (!retryButton) { return; }
    retryButton.hidden = false;
    retryButton.disabled = false;
    if (typeof retryButton.focus === 'function') { retryButton.focus(); }
  }

  function generateDraft() {
    if (isGenerating) { return; }
    var state = collectState();
    if (state.missing.length > 0 || state.salaryInvalid) {
      runValidation();
      return;
    }
    isGenerating = true;
    setBusyState(true);
    ajdwRequestDraftWithRetry().then(function (draft) {
      sectionsFromDraft(draft);
      clearUndoState();
      renderSections();
      isGenerating = false;
      setBusyState(false, 'Draft generated.', 'success');
      setEditorStatus('Draft generated. Edit, reorder, or regenerate any section.', 'success');
    }).catch(function (error) {
      isGenerating = false;
      setBusyState(false, 'Generation failed. Your brief is still filled in — select Retry generation to try again.', 'error');
      showRetryPath();
      setEditorStatus('Generation failed. Your brief was kept so you can retry.', 'error');
      console.log('[TOOL:AI_ERROR] ' + (error && error.message ? error.message : 'unknown error'));
    });
  }

  var retryButton = document.getElementById('ajdw-retry-button');
  if (retryButton) {
    retryButton.addEventListener('click', function () {
      generateDraft();
    });
  }

  var JD_SECTION_TYPES = [
    { key: 'summary', label: 'Summary', rows: 3 },
    { key: 'responsibilities', label: 'Responsibilities', rows: 6 },
    { key: 'requirements', label: 'Requirements', rows: 6 },
    { key: 'companyContext', label: 'Company context', rows: 3 },
    { key: 'benefits', label: 'Benefits', rows: 4 },
    { key: 'skills', label: 'Skills', rows: 4 },
    { key: 'equalOpportunity', label: 'Equal opportunity statement', rows: 3 },
    { key: 'custom', label: 'Custom section', rows: 4 }
  ];

  var jdSections = [];
  var jdSectionSeq = 0;
  var currentAdverts = {};
  var undoSnapshot = null;
  var undoTimeoutId = null;

  /* Persistence through the tool storage SDK. */
  var AJDW_RECORD_KEY = 'ajdw-last-saved-record-v1';
  var ajdwSaveTimerId = null;
  var ajdwRestoring = false;

  function ajdwStoreRef() {
    var sdk = (typeof tool !== 'undefined' && tool) ? tool : null;
    if (!sdk) { return null; }
    if (sdk.storage && typeof sdk.storage === 'object') { return sdk.storage; }
    if (typeof sdk.get === 'function' || typeof sdk.set === 'function' || typeof sdk.setItem === 'function') { return sdk; }
    return null;
  }

  var AJDW_QUOTA_MESSAGE = 'Local storage is full. Export a JSON backup, then remove old versions.';

  function ajdwStorageFailure(error) {
    try { ajdwQuotaBanner('Autosave stopped: local storage is unavailable or full. Download a JSON backup now so the draft is not lost.'); } catch (ignored) {}
    console.log('[TOOL:STORAGE_ERROR] ' + (error && error.message ? error.message : 'unknown'));
    ajdwSetSaveStatus(AJDW_QUOTA_MESSAGE, 'error');
    ajdwSetSavedLine('error');
    var note = document.getElementById('ajdw-save-status');
    if (note) { note.setAttribute('data-ajdw-storage-error', '1'); }
  }

  function ajdwStorageWrite(key, value) {
    var store = ajdwStoreRef();
    var pending = null;
    if (!store) {
      ajdwStorageFailure(new Error('No tool storage available'));
      return false;
    }
    try {
      if (typeof store.set === 'function') { pending = store.set(key, value); }
      else if (typeof store.setItem === 'function') { pending = store.setItem(key, JSON.stringify(value)); }
      else if (typeof store.save === 'function') { pending = store.save(key, value); }
      else if (typeof store.write === 'function') { pending = store.write(key, JSON.stringify(value)); }
      else {
        ajdwStorageFailure(new Error('Tool storage has no write method'));
        return false;
      }
    } catch (error) {
      ajdwStorageFailure(error);
      return false;
    }
    if (pending && typeof pending.then === 'function') {
      pending.then(function () {
        var note = document.getElementById('ajdw-save-status');
        if (note && note.getAttribute('data-ajdw-storage-error') === '1') {
          note.removeAttribute('data-ajdw-storage-error');
          ajdwSavedNote();
        }
      }, function (error) {
        ajdwStorageFailure(error);
      });
    }
    return true;
  }

  function ajdwParseRecord(raw) {
    if (raw == null) { return null; }
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch (error) { return null; }
    }
    if (typeof raw === 'object') {
      if (!raw.brief && !raw.sections && typeof raw.value === 'string') { return ajdwParseRecord(raw.value); }
      return raw;
    }
    return null;
  }

  function ajdwStorageRead(key, done) {
    var store = ajdwStoreRef();
    var pending = null;
    if (!store) { done(null); return; }
    try {
      if (typeof store.getJSON === 'function') { pending = store.getJSON(key); }
      else if (typeof store.get === 'function') { pending = store.get(key); }
      else if (typeof store.getItem === 'function') { pending = store.getItem(key); }
      else if (typeof store.load === 'function') { pending = store.load(key); }
      else if (typeof store.read === 'function') { pending = store.read(key); }
      else { done(null); return; }
    } catch (error) {
      done(null);
      return;
    }
    if (pending && typeof pending.then === 'function') {
      pending.then(function (value) { done(ajdwParseRecord(value)); }, function () { done(null); });
      return;
    }
    done(ajdwParseRecord(pending));
  }

  function ajdwTimeLabel(iso) {
    var parts = String(iso || '').split('T');
    if (parts.length < 2) { return 'just now'; }
    return parts[1].slice(0, 5) + ' UTC';
  }

  function ajdwSetSaveStatus(message, tone) {
    var status = document.getElementById('ajdw-save-status');
    if (!status) { return; }
    status.textContent = message;
    status.className = 'ajdw-status ajdw-save-status' + (tone ? ' ajdw-status--' + tone : '');
    status.setAttribute('data-ajdw-save-tone', tone || 'info');
  }

  function ajdwCaptureRecord() {
    var record = {
      version: 1,
      appId: AJDW_APP_ID,
      schemaVersion: AJDW_SCHEMA_VERSION,
      id: ajdwCurrentDraftId(),
      draftId: ajdwCurrentDraftId(),
      briefId: ajdwCurrentDraftId(),
      savedAt: new Date().toISOString(),
      brief: currentBriefValues(),
      sections: [],
      adverts: currentAdverts || {}
    };
    jdSections.forEach(function (section) {
      record.sections.push({ id: section.id, heading: section.heading, content: section.content, rows: section.rows });
    });
    return record;
  }

  function ajdwRecordHasContent(record) {
    var key;
    for (key in record.brief) {
      if (Object.prototype.hasOwnProperty.call(record.brief, key) && record.brief[key]) { return true; }
    }
    return record.sections.length > 0;
  }

  function ajdwClockLabel() {
    var now = new Date();
    var hours = now.getHours();
    var minutes = now.getMinutes();
    return (hours < 10 ? '0' : '') + hours + ':' + (minutes < 10 ? '0' : '') + minutes;
  }

  function ajdwSetSavedLine(state) {
    var line = document.getElementById('ajdw-saved-line');
    if (!line) { return; }
    if (state === 'pending') {
      line.textContent = 'Saving locally…';
      line.className = 'ajdw-saved-line ajdw-saved-line--pending';
      return;
    }
    if (state === 'error') {
      line.textContent = 'Not saved · browser storage is blocked or full';
      line.className = 'ajdw-saved-line ajdw-saved-line--error';
      return;
    }
    line.textContent = 'Saved locally · ' + ajdwClockLabel();
    line.className = 'ajdw-saved-line ajdw-saved-line--saved';
  }

  function ajdwSavedNote() {
    ajdwSetSaveStatus('Saved locally at ' + ajdwClockLabel(), 'success');
    ajdwSetSavedLine('saved');
  }

  function ajdwSaveNow() {
    if (!ajdwStoreRef()) {
      ajdwStorageFailure(new Error('Tool storage is unavailable'));
      return;
    }
    var record = ajdwCaptureRecord();
    if (!ajdwRecordHasContent(record)) { return; }
    if (ajdwStorageWrite(AJDW_RECORD_KEY, record)) {
      ajdwSavedNote();
    } else {
      ajdwSetSaveStatus('Not saved locally - browser storage is full or blocked.', 'error');
      try { ajdwQuotaBanner('Autosave stopped: this browser has no room left (quota) or storage is blocked. Download a JSON backup now so the draft is not lost.'); } catch (ignored) {}
    }
    ajdwPushVersion(record, 'Autosave');
  }

  var ajdwAutosaveWired = false;

  function ajdwScheduleSave() {
    if (ajdwRestoring) { return; }
    if (ajdwSaveTimerId) { return; }
    ajdwSaveTimerId = setTimeout(function () {
      ajdwSaveTimerId = null;
      ajdwSaveNow();
    }, 300);
  }

  function ajdwAutosaveTarget(node) {
    if (!node || node.nodeType !== 1) { return false; }
    var id = node.id || '';
    if (node.closest && node.closest('#ajdw-role-brief-form')) { return true; }
    if (node.closest && (node.closest('#ajdw-sections') || node.closest('#ajdw-editor') || node.closest('#ajdw-versions') || node.closest('#ajdw-export-bar'))) { return true; }
    if (id === 'ajdw-role-brief-form') { return true; }
    return /^ajdw-section/.test(id);
  }

  function ajdwWireAutosave() {
    if (ajdwAutosaveWired) { return; }
    if (typeof document === 'undefined' || !document.addEventListener) { return; }
    ajdwAutosaveWired = true;
    var handler = function (event) {
      if (ajdwAutosaveTarget(event && event.target)) { ajdwScheduleSave(); }
    };
    document.addEventListener('input', handler, true);
    document.addEventListener('change', handler, true);
    document.addEventListener('click', handler, true);
  }

  setTimeout(ajdwWireAutosave, 0);

  function ajdwApplyRecord(record) {
    if (!record || typeof record !== 'object') { return false; }
    ajdwDraftIdValue = (typeof record.draftId === 'string' && record.draftId) ? record.draftId : ((typeof record.id === 'string' && record.id) ? record.id : '');
    if (!ajdwDraftIdValue) { ajdwCurrentDraftId(); }
    var brief = (record.brief && typeof record.brief === 'object') ? record.brief : {};
    var restored = 0;
    ajdwRestoring = true;
    AJDW_ROLE_BRIEF_INPUTS.forEach(function (param) {
      var field = getField(param);
      if (field && typeof brief[param.name] === 'string' && brief[param.name] !== '') {
        field.value = brief[param.name];
        restored += 1;
      }
    });
    var storedSections = Array.isArray(record.sections) ? record.sections : [];
    jdSections = [];
    jdSectionSeq = 0;
    storedSections.forEach(function (item, index) {
      if (!item || typeof item !== 'object') { return; }
      var id = (typeof item.id === 'string' && item.id) ? item.id : 'restored-' + (index + 1);
      jdSections.push(makeSection(id, asDraftText(item.heading) || 'Untitled section', asDraftText(item.content), item.rows || 4));
      var numeric = /^new-(\d+)$/.exec(id);
      if (numeric) {
        var seq = parseInt(numeric[1], 10);
        if (!isNaN(seq) && seq > jdSectionSeq) { jdSectionSeq = seq; }
      }
    });
    currentAdverts = (record.adverts && typeof record.adverts === 'object') ? record.adverts : {};
    if (typeof renderSections === 'function') { renderSections(); }
    if (typeof updatePreview === 'function') { updatePreview(); }
    ajdwRestoring = false;
    return restored > 0 || jdSections.length > 0;
  }

  /* Export or copy the current result. */
  function ajdwResultFormat() {
    var select = document.getElementById('ajdw-export-format');
    return select && select.value ? select.value : 'text';
  }

  function ajdwEscapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function ajdwAdvertText(key) {
    var field = document.getElementById('ajdw-advert-' + key);
    if (field && typeof field.value === 'string' && field.value !== '') { return field.value; }
    var ad = currentAdverts[key];
    return ad && ad.text ? asDraftText(ad.text) : '';
  }

  function ajdwSetExportStatus(message, tone) {
    var status = document.getElementById('ajdw-export-status');
    if (!status) { return; }
    status.textContent = message;
    status.className = tone ? 'ajdw-status ajdw-export-status ajdw-status--' + tone : 'ajdw-status ajdw-export-status';
  }

  function ajdwBuildResult(format) {
    ajdwCanonicalSections();
    var brief = currentBriefValues();
    var title = brief.roleTitle || 'Job description';
    var metaBits = [];
    if (brief.department) { metaBits.push(brief.department); }
    if (brief.location) { metaBits.push(brief.location); }
    if (brief.employmentType) { metaBits.push(brief.employmentType); }
    if (brief.seniority) { metaBits.push(brief.seniority); }
    if (brief.salary) { metaBits.push('Salary: ' + brief.salary); }
    var variants = ['standard', 'short', 'social'];
    var variantLabels = { standard: 'Standard job board advert', short: 'Short advert', social: 'Social advert' };
    var out = [];
    var hasBody = false;
    var i;
    jdSections.forEach(function (section) {
      if (section && asDraftText(section.content).replace(/\s/g, '') !== '') { hasBody = true; }
    });
    if (!hasBody && !brief.roleTitle) { return ''; }

    if (format === 'html') {
      out.push('<h1>' + ajdwEscapeHtml(title) + '</h1>');
      if (metaBits.length > 0) { out.push('<p>' + ajdwEscapeHtml(metaBits.join(' | ')) + '</p>'); }
      for (i = 0; i < jdSections.length; i += 1) {
        out.push('<h2>' + ajdwEscapeHtml(jdSections[i].heading || 'Untitled section') + '</h2>');
        out.push('<p>' + ajdwEscapeHtml(jdSections[i].content).replace(/\n/g, '<br>') + '</p>');
      }
      for (i = 0; i < variants.length; i += 1) {
        var htmlAdvert = ajdwAdvertText(variants[i]);
        if (htmlAdvert) {
          out.push('<h2>' + ajdwEscapeHtml(variantLabels[variants[i]]) + '</h2>');
          out.push('<p>' + ajdwEscapeHtml(htmlAdvert).replace(/\n/g, '<br>') + '</p>');
        }
      }
      return out.join('\n');
    }

    if (format === 'markdown') {
      out.push('# ' + title);
      if (metaBits.length > 0) { out.push(metaBits.join(' | ')); }
      out.push('');
      for (i = 0; i < jdSections.length; i += 1) {
        out.push('## ' + (jdSections[i].heading || 'Untitled section'));
        out.push(jdSections[i].content || '');
        out.push('');
      }
      for (i = 0; i < variants.length; i += 1) {
        var mdAdvert = ajdwAdvertText(variants[i]);
        if (mdAdvert) {
          out.push('## ' + variantLabels[variants[i]]);
          out.push(mdAdvert);
          out.push('');
        }
      }
      return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
    }

    out.push(title);
    if (metaBits.length > 0) { out.push(metaBits.join(' | ')); }
    out.push('');
    for (i = 0; i < jdSections.length; i += 1) {
      out.push(String(jdSections[i].heading || 'Untitled section').toUpperCase());
      out.push(jdSections[i].content || '');
      out.push('');
    }
    for (i = 0; i < variants.length; i += 1) {
      var textAdvert = ajdwAdvertText(variants[i]);
      if (textAdvert) {
        out.push(String(variantLabels[variants[i]]).toUpperCase());
        out.push(textAdvert);
        out.push('');
      }
    }
    return out.join('\n').replace(/\s+$/, '') + '\n';
  }

  function ajdwLegacyCopy(text) {
    var area = document.createElement('textarea');
    var copied = false;
    area.value = text;
    area.setAttribute('readonly', 'readonly');
    area.className = 'ajdw-copy-buffer';
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    try {
      area.select();
      copied = !!(document.execCommand && document.execCommand('copy'));
    } catch (error) {
      copied = false;
    }
    if (area.parentNode) { area.parentNode.removeChild(area); }
    return copied;
  }

  function ajdwCanUseClipboard() {
    return typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function';
  }

  function ajdwSlug(value) {
    var slug = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'job-description';
  }

  function ajdwDownloadFile(filename, text, mime) {
    try {
      var blob = new Blob([text], { type: mime });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      if (link.parentNode) { link.parentNode.removeChild(link); }
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return true;
    } catch (error) {
      return false;
    }
  }

  function ajdwHandleCopy() {
    var text = ajdwBuildResult(ajdwResultFormat());
    if (!text) {
      ajdwSetExportStatus('Nothing to copy yet. Generate a draft or type a section first.', 'error');
      return;
    }
    if (ajdwCanUseClipboard()) {
      navigator.clipboard.writeText(text).then(function () {
        ajdwSetExportStatus(ajdwCopiedLabel(), 'success');
      }, function () {
        if (ajdwLegacyCopy(text)) {
          ajdwSetExportStatus(ajdwCopiedLabel(), 'success');
        } else {
          ajdwSetExportStatus('Copy was blocked. Use Download result instead.', 'error');
        }
      });
      return;
    }
    if (ajdwLegacyCopy(text)) {
      ajdwSetExportStatus(ajdwCopiedLabel(), 'success');
    } else {
      ajdwSetExportStatus('Copy is unavailable in this browser. Use Download result instead.', 'error');
    }
  }

  function ajdwExportDateStamp() {
    var now = new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  }

  function ajdwCopiedLabel() {
    var format = ajdwResultFormat();
    if (format === 'html') { return 'Copied as HTML'; }
    if (format === 'markdown') { return 'Copied as Markdown'; }
    return 'Copied as Text';
  }

  function ajdwExportFileName() {
    return 'jd-' + ajdwSlug(currentBriefValues().roleTitle) + '-' + ajdwExportDateStamp();
  }

  function ajdwHandleDownload() {
    var format = ajdwResultFormat();
    var text = ajdwBuildResult(format);
    if (!text) {
      ajdwSetExportStatus('Nothing to download yet. Generate a draft or type a section first.', 'error');
      return;
    }
    var ext = 'txt';
    if (format === 'html') { ext = 'html'; }
    if (format === 'markdown') { ext = 'md'; }
    var filename = ajdwExportFileName() + '.' + ext;
    if (ajdwDownloadFile(filename, text, format === 'html' ? 'text/html' : 'text/plain')) {
      ajdwSetExportStatus('Downloaded ' + filename, 'success');
    } else {
      ajdwSetExportStatus('Download was blocked. Use Copy result instead.', 'error');
    }
  }

  function ajdwBindExportControls() {
    var copyButton = document.getElementById('ajdw-copy-result');
    if (copyButton && !copyButton.getAttribute('data-ajdw-bound')) {
      copyButton.setAttribute('data-ajdw-bound', '1');
      copyButton.addEventListener('click', ajdwHandleCopy);
    }
    var downloadButton = document.getElementById('ajdw-download-result');
    if (downloadButton && !downloadButton.getAttribute('data-ajdw-bound')) {
      downloadButton.setAttribute('data-ajdw-bound', '1');
      downloadButton.addEventListener('click', ajdwHandleDownload);
    }
  }

  function ajdwInitSavedState() {
    var root = document.getElementById('ajdw-app-root') || document;
    if (root && root.addEventListener) {
      root.addEventListener('input', ajdwScheduleSave, true);
      root.addEventListener('change', ajdwScheduleSave, true);
      root.addEventListener('click', ajdwScheduleSave, true);
    }
    if (typeof renderSections === 'function') {
      var ajdwRenderSectionsOriginal = renderSections;
      renderSections = function () {
        var result = ajdwRenderSectionsOriginal.apply(null, arguments);
        ajdwScheduleSave();
        return result;
      };
    }
    ajdwBindExportControls();
    ajdwStorageRead(AJDW_RECORD_KEY, function (record) {
      if (!record || typeof record !== 'object') { return; }
      var restored = ajdwApplyRecord(record);
      if (restored) {
        ajdwSetSaveStatus('Restored your last saved draft from ' + ajdwTimeLabel(record.savedAt) + '.', 'success');
        if (typeof setEditorStatus === 'function') {
          setEditorStatus('Restored your last saved draft.', 'info');
        }
      }
    });
  }

  setTimeout(ajdwInitSavedState, 0);

  /* T-13: brief sanitisation and instruction defanging */
  var AJDW_FIELD_LIMIT = 4000;
  var AJDW_INSTRUCTION_PATTERNS = [
    /ignore (all |any )?(previous|prior|above|earlier) (instructions?|prompts?|rules?)/gi,
    /disregard (all |any )?(previous|prior|above|earlier) (instructions?|prompts?|rules?)/gi,
    /forget (all |any )?(previous|prior|above|earlier) (instructions?|prompts?|rules?)/gi,
    /you are (now )?(a|an|the) [^.]{0,80}/gi,
    /(system|assistant|developer|prompt)\s*:/gi,
    /<\|[^|]*\|>/g,
    /\{\{[^}]*\}\}/g
  ];

  function ajdwStripControl(value) {
    return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
  }

  function ajdwDefangInstructions(value) {
    var text = ajdwStripControl(value);
    AJDW_INSTRUCTION_PATTERNS.forEach(function (pattern) {
      text = text.replace(pattern, ' ');
    });
    return text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  function ajdwSanitizeText(value, maxChars) {
    var text = ajdwStripControl(value).replace(/<[^>]*>/g, ' ');
    text = ajdwDefangInstructions(text);
    var limit = maxChars || AJDW_FIELD_LIMIT;
    if (text.length > limit) { text = text.slice(0, limit).trim(); }
    return text;
  }

  function ajdwSanitizeBrief(brief) {
    var clean = {};
    AJDW_ROLE_BRIEF_INPUTS.forEach(function (param) {
      clean[param.name] = ajdwSanitizeText(brief && brief[param.name], 2000);
    });
    return clean;
  }

  /* T-13: strict JSON with one retry and a local template fallback */
  function ajdwStripFences(value) {
    var text = String(value == null ? '' : value).trim();
    if (text.indexOf('`') !== -1) { text = text.split('`').join('').trim(); }
    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if (start > 0 && end > start) { text = text.slice(start, end + 1); }
    return text;
  }

  function ajdwNormalizeAdvert(value, limit) {
    var raw = '';
    if (value && typeof value === 'object') { raw = value.text; }
    else if (typeof value === 'string') { raw = value; }
    var text = ajdwSanitizeText(raw, limit);
    return { text: text, approxCharacters: text.length };
  }

  function ajdwNormalizeDraft(raw) {
    if (!raw || typeof raw !== 'object') { return null; }
    var draft = {
      summary: ajdwSanitizeText(raw.summary, 4000),
      responsibilities: [],
      requirements: [],
      companyContext: ajdwSanitizeText(raw.companyContext, 4000),
      adverts: {}
    };
    asDraftArray(raw.responsibilities).forEach(function (item) {
      var line = ajdwSanitizeText(item, 600);
      if (line) { draft.responsibilities.push(line); }
    });
    asDraftArray(raw.requirements).forEach(function (item) {
      var line = ajdwSanitizeText(item, 600);
      if (line) { draft.requirements.push(line); }
    });
    var adverts = (raw.adverts && typeof raw.adverts === 'object') ? raw.adverts : {};
    draft.adverts.standard = ajdwNormalizeAdvert(adverts.standard, 1200);
    draft.adverts.short = ajdwNormalizeAdvert(adverts.short, 400);
    draft.adverts.social = ajdwNormalizeAdvert(adverts.social, 200);
    var hasBody = draft.summary || draft.companyContext || draft.responsibilities.length > 0 || draft.requirements.length > 0;
    return hasBody ? draft : null;
  }

  function ajdwParseDraftResponse(response) {
    var payload = response;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(ajdwStripFences(payload)); } catch (error) { return null; }
    }
    if (payload && typeof payload === 'object' && !payload.summary && typeof payload.text === 'string') {
      try { payload = JSON.parse(ajdwStripFences(payload.text)); } catch (error) { return null; }
    }
    return ajdwNormalizeDraft(payload);
  }

  function ajdwClip(text, limit) {
    var value = String(text || '').replace(/\s+/g, ' ').trim();
    if (value.length <= limit) { return value; }
    var cut = value.slice(0, limit - 1);
    var space = cut.lastIndexOf(' ');
    if (space > limit * 0.6) { cut = cut.slice(0, space); }
    return cut.replace(/[,;:\-\s]+$/, '') + '\u2026';
  }

  /* T-76: duties and requirements split on newlines, commas and semicolons. */
  function ajdwLinesFromText(value) {
    var out = [];
    var text = ajdwSanitizeText(value, 4000).replace(/(\d),(\d)/g, '$1\u0001$2');
    text.split(/\r?\n|[,;]/).forEach(function (line) {
      var item = String(line || '').replace(/\u0001/g, ',')
        .replace(/^[-*\u2022\s]+/, '')
        .replace(/^\d+[.)]\s*/, '')
        .trim();
      if (item) { out.push(item); }
    });
    return out;
  }

  function ajdwLocalTemplateDraft() {
    var brief = ajdwSanitizeBrief(currentBriefValues());
    var title = brief.roleTitle || 'this role';
    var duties = ajdwLinesFromText(brief.duties);
    var requirements = ajdwLinesFromText(brief.requirements);
    var summary = brief.summary || ('We are hiring a ' + title + '.');
    var meta = [brief.department, brief.location, brief.employmentType].filter(function (part) { return !!part; }).join(' | ');
    var standard = title + (meta ? ' - ' + meta : '') + '. ' + summary + ' ' + (duties[0] || '');
    return {
      summary: summary,
      responsibilities: duties.length ? duties : ['Deliver the core work of the ' + title + ' role.', 'Work with the wider team on shared goals.'],
      requirements: requirements.length ? requirements : ['Relevant experience for a ' + title + ' role.', 'Clear written and verbal communication.'],
      companyContext: brief.companyContext || '',
      adverts: {
        standard: { text: ajdwClip(standard, 800) },
        short: { text: ajdwClip(title + (brief.location ? ' - ' + brief.location : '') + '. ' + summary, 300) },
        social: { text: ajdwClip('Hiring: ' + title + (brief.location ? ' (' + brief.location + ')' : '') + '.', 150) }
      }
    };
  }

  /* T-57: a rejected request or an unreadable reply is reported clearly and changes nothing. */
  var ajdwLastAIFailure = '';

  function ajdwAIFailureReason(error) {
    if (!error) { return 'the AI request was rejected'; }
    if (typeof error === 'string' && error.replace(/\s+/g, ' ').trim()) {
      return error.replace(/\s+/g, ' ').trim();
    }
    var message = (error && (error.message || error.reason || error.detail)) || '';
    if (typeof message === 'string' && message.replace(/\s+/g, ' ').trim()) {
      return message.replace(/\s+/g, ' ').trim();
    }
    return 'the AI request was rejected';
  }

  function ajdwRetryButton() {
    var button = document.getElementById('ajdw-retry-generation');
    if (button) { return button; }
    var status = document.getElementById('ajdw-status');
    if (!status || !status.parentNode) { return null; }
    button = document.createElement('button');
    button.type = 'button';
    button.id = 'ajdw-retry-generation';
    button.className = 'ajdw-button ajdw-button--small ajdw-retry-generation';
    button.textContent = 'Retry';
    button.hidden = true;
    button.setAttribute('hidden', 'hidden');
    button.setAttribute('title', 'Retry Generate draft');
    button.addEventListener('click', function () {
      ajdwSetRetryVisible(false);
      var candidates = ['ajdw-generate', 'ajdw-generate-draft', 'ajdw-generate-button', 'ajdw-generate-btn'];
      for (var i = 0; i < candidates.length; i += 1) {
        var generate = document.getElementById(candidates[i]);
        if (generate && typeof generate.click === 'function') { generate.click(); return; }
      }
    });
    status.parentNode.insertBefore(button, status.nextSibling);
    return button;
  }

  function ajdwSetRetryVisible(visible, reason) {
    var button = ajdwRetryButton();
    if (!button) { return; }
    if (visible) {
      var why = reason || ajdwLastAIFailure || 'unknown reason';
      button.hidden = false;
      button.removeAttribute('hidden');
      button.setAttribute('title', 'Retry Generate draft. Last failure: ' + why);
      button.setAttribute('aria-label', 'Retry Generate draft. Last failure: ' + why);
    } else {
      button.hidden = true;
      button.setAttribute('hidden', 'hidden');
    }
  }

  function ajdwDraftFailure(message, reason) {
    ajdwLastAIFailure = reason || 'unknown reason';
    try { setEditorStatus(message, 'error'); } catch (ignored) {}
    try { ajdwB4ShowFailure(); } catch (panelErr) { /* panel is advisory */ }
    ajdwSetRetryVisible(true, ajdwLastAIFailure);
    var error = new Error(message);
    error.ajdwDraftFailure = true;
    return error;
  }

  function ajdwRequestDraftOnce() {
    return ajdwTrackGeneration(tool.requestAI({ prompt: buildBriefPrompt(), schema: requestSchema })).then(function (response) {
      try { ajdwB4CaptureRaw(response); } catch (rawErr) { /* raw capture is advisory */ }
      return { ok: true, draft: ajdwParseDraftResponse(response) };
    }, function (error) {
      return { ok: false, reason: ajdwAIFailureReason(error) };
    });
  }

  function ajdwRequestDraftWithRetry() {
    return ajdwRequestDraftOnce().then(function (first) {
      if (!first.ok) {
        throw ajdwDraftFailure('Draft failed: ' + first.reason + '. Nothing was changed.', first.reason);
      }
      if (first.draft) { ajdwSetRetryVisible(false); return first.draft; }
      console.log('[TOOL:AI] parse failed attempt 1');
      return ajdwRequestDraftOnce().then(function (second) {
        if (!second.ok) {
          throw ajdwDraftFailure('Draft failed: ' + second.reason + '. Nothing was changed.', second.reason);
        }
        if (second.draft) { ajdwSetRetryVisible(false); return second.draft; }
        throw ajdwDraftFailure('The AI reply could not be read. Try Generate draft again.', 'the AI reply was not valid JSON');
      });
    });
  }

  /* T-14: stable draft IDs, version history, import diff and confirmation */
  var AJDW_VERSION_KEY = 'ajdw-version-history-v1';
  var ajdwVersionList = [];
  var ajdwVersionLoaded = false;
  var ajdwPendingImport = null;
  var ajdwDraftIdValue = null;
  var ajdwDraftSeq = 0;

  /* T-56: every saved version gets its own generated id. Its store key is built from that id,
     never from the role title, so two briefs both called 'Product Manager' never collide. */
  var ajdwVersionSeq = 0;

  function ajdwNewVersionId() {
    ajdwVersionSeq += 1;
    return 'v-' + new Date().getTime().toString(36) + '-' + ajdwVersionSeq.toString(36) + '-' +
      Math.floor(Math.random() * 1679616).toString(36);
  }

  function ajdwVersionIdOf(item) {
    if (!item || typeof item !== 'object') { return ajdwNewVersionId(); }
    if (!item.versionId || typeof item.versionId !== 'string') {
      item.versionId = ajdwNewVersionId();
    }
    return item.versionId;
  }

  function ajdwVersionStoreKey(item) {
    return 'ajdw-version:' + ajdwVersionIdOf(item);
  }

  function ajdwEnsureVersionIds() {
    if (!ajdwVersionList || !ajdwVersionList.length) { return; }
    var seen = {};
    ajdwVersionList.forEach(function (entry) {
      if (!entry || typeof entry !== 'object') { return; }
      var id = ajdwVersionIdOf(entry);
      if (seen[id]) {
        entry.versionId = ajdwNewVersionId();
        id = entry.versionId;
      }
      seen[id] = true;
    });
  }

  function ajdwCurrentDraftId() {
    if (!ajdwDraftIdValue) {
      ajdwDraftSeq += 1;
      ajdwDraftIdValue = 'draft-' + new Date().getTime().toString(36) + '-' + ajdwDraftSeq;
    }
    return ajdwDraftIdValue;
  }

  var ajdwVersionsWired = false;

  function ajdwVersionRoleTitle(item) {
    if (!item || typeof item !== 'object') { return 'Untitled role'; }
    var sources = [item, item.record, item.brief, item.data, item.draft];
    for (var i = 0; i < sources.length; i += 1) {
      var src = sources[i];
      if (src && typeof src === 'object') {
        var title = src.roleTitle || src.title || src.jobTitle;
        if (typeof title === 'string' && title.replace(/\s+/g, ' ').trim()) {
          return title.replace(/\s+/g, ' ').trim();
        }
      }
    }
    if (typeof item.label === 'string' && item.label.replace(/\s+/g, ' ').trim()) {
      return item.label.replace(/\s+/g, ' ').trim();
    }
    return 'Untitled role';
  }

  function ajdwVersionStamp(value) {
    var when = new Date(value);
    if (isNaN(when.getTime())) { return 'unknown date'; }
    var datePart = '';
    var timePart = '';
    try { datePart = when.toLocaleDateString(); } catch (e) { datePart = ''; }
    try { timePart = when.toLocaleTimeString(); } catch (e) { timePart = ''; }
    var stamp = (datePart + ' ' + timePart).replace(/\s+/g, ' ').trim();
    return stamp || String(value);
  }

  function ajdwSetVersionStatus(text, tone) {
    var vstatus = document.getElementById('ajdw-versions-status');
    if (vstatus) {
      vstatus.textContent = text;
      vstatus.className = 'ajdw-status ajdw-versions-status' + (tone ? ' ajdw-status--' + tone : '');
    }
    var status = document.getElementById('ajdw-status');
    if (status) {
      status.textContent = text;
      status.className = 'ajdw-status' + (tone ? ' ajdw-status--' + tone : '');
    }
  }

  function ajdwReadBackupFile(file) {
    if (!file) { return; }
    if (typeof FileReader === 'undefined') {
      ajdwSetVersionStatus('That file is not a JD Studio backup', 'error');
      return;
    }
    var reader = new FileReader();
    reader.onerror = function () {
      ajdwSetVersionStatus('That file is not a JD Studio backup', 'error');
    };
    reader.onload = function () {
      var parsed = null;
      try { parsed = JSON.parse(String(reader.result)); } catch (e) { parsed = null; }
      var verdict = { ok: false };
      if (typeof ajdwValidateBackup === 'function') {
        verdict = ajdwValidateBackup(parsed);
      } else if (parsed && typeof parsed === 'object' && parsed.appId === AJDW_APP_ID && typeof parsed.schemaVersion === 'number') {
        verdict = { ok: true };
      }
      if (!verdict || !verdict.ok) {
        ajdwSetVersionStatus('That file is not a JD Studio backup', 'error');
        return;
      }
      var current = (typeof ajdwCaptureRecord === 'function') ? ajdwCaptureRecord() : null;
      if (current && typeof ajdwPushVersion === 'function') { ajdwPushVersion(current, 'Before import'); }
      var entry = {};
      for (var key in parsed) {
        if (Object.prototype.hasOwnProperty.call(parsed, key)) { entry[key] = parsed[key]; }
      }
      entry.savedAt = new Date().getTime();
      if (typeof ajdwPushVersion === 'function') { ajdwPushVersion(entry, 'Imported backup'); }
      if (typeof ajdwApplyRecord === 'function') { ajdwApplyRecord(entry); }
      if (typeof ajdwSaveNow === 'function') { ajdwSaveNow(); }
      ajdwSaveVersions();
      ajdwSetVersionStatus('Backup imported', 'success');
    };
    reader.readAsText(file);
  }

  function ajdwWireVersionsPanel() {
    if (ajdwVersionsWired) { return; }
    var button = document.getElementById('ajdw-import-json-button');
    var input = document.getElementById('ajdw-import-json-file');
    if (!button || !input) { return; }
    ajdwVersionsWired = true;
    button.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      var file = (input.files && input.files[0]) ? input.files[0] : null;
      ajdwReadBackupFile(file);
      setTimeout(function () { try { input.value = ''; } catch (e) { input.value = ''; } }, 0);
    });
  }

  function ajdwRenderVersionList() {
    var list = document.getElementById('ajdw-version-list');
    if (!list) { return; }
    if (!ajdwVersionList) { ajdwVersionList = []; }
    ajdwWireVersionsPanel();
    while (list.firstChild) { list.removeChild(list.firstChild); }
    var items = ajdwVersionList.slice(0);
    items.sort(function (a, b) {
      var av = (a && a.savedAt) ? new Date(a.savedAt).getTime() : 0;
      var bv = (b && b.savedAt) ? new Date(b.savedAt).getTime() : 0;
      if (isNaN(av)) { av = 0; }
      if (isNaN(bv)) { bv = 0; }
      return bv - av;
    });
    items = (typeof ajdwB1RowsPerBrief === 'function') ? ajdwB1RowsPerBrief(items) : items.slice(0, 10);
    if (items.length === 0) {
      var empty = document.createElement('li');
      empty.className = 'ajdw-version-empty';
      empty.textContent = 'No saved versions yet. A version is added on every save, restore, and import.';
      list.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'ajdw-version-item';

      var role = document.createElement('span');
      role.className = 'ajdw-version-role';
      role.textContent = ajdwVersionRoleTitle(item);

      var when = document.createElement('span');
      when.className = 'ajdw-version-when';
      when.textContent = ajdwVersionStamp(item && item.savedAt);

      var actions = document.createElement('span');
      actions.className = 'ajdw-version-actions';

      var restore = document.createElement('button');
      restore.type = 'button';
      restore.className = 'ajdw-button ajdw-button--small ajdw-version-restore';
      restore.textContent = 'Restore';
      restore.addEventListener('click', function () {
        var current = (typeof ajdwCaptureRecord === 'function') ? ajdwCaptureRecord() : null;
        if (current && typeof ajdwPushVersion === 'function') { ajdwPushVersion(current, 'Before restore'); }
        if (typeof ajdwApplyRecord === 'function') { ajdwApplyRecord(item); }
        if (typeof ajdwSaveNow === 'function') { ajdwSaveNow(); }
        ajdwSaveVersions();
        ajdwSetVersionStatus('Restored version from ' + ajdwVersionStamp(item && item.savedAt), 'success');
      });

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ajdw-button ajdw-button--small ajdw-button--ghost ajdw-version-delete';
      remove.textContent = 'Delete';
      remove.addEventListener('click', function () {
        if (li.querySelector('.ajdw-version-confirm')) { return; }
        actions.hidden = true;
        var confirmWrap = document.createElement('span');
        confirmWrap.className = 'ajdw-version-confirm';
        var question = document.createElement('span');
        question.className = 'ajdw-version-question';
        question.textContent = 'Delete this version?';
        var yes = document.createElement('button');
        yes.type = 'button';
        yes.className = 'ajdw-button ajdw-button--small ajdw-version-confirm-delete';
        yes.textContent = 'Delete';
        yes.addEventListener('click', function () {
          ajdwVersionList = ajdwVersionList.filter(function (entry) { return entry !== item; });
          ajdwSaveVersions();
          ajdwSetVersionStatus('Version deleted.', 'info');
        });
        var no = document.createElement('button');
        no.type = 'button';
        no.className = 'ajdw-button ajdw-button--small ajdw-button--ghost ajdw-version-cancel';
        no.textContent = 'Cancel';
        no.addEventListener('click', function () {
          if (confirmWrap.parentNode) { confirmWrap.parentNode.removeChild(confirmWrap); }
          actions.hidden = false;
        });
        confirmWrap.appendChild(question);
        confirmWrap.appendChild(yes);
        confirmWrap.appendChild(no);
        li.appendChild(confirmWrap);
      });

      actions.appendChild(restore);
      actions.appendChild(remove);
      li.setAttribute('data-ajdw-version-id', ajdwVersionIdOf(item));
      li.setAttribute('data-ajdw-version-key', ajdwVersionStoreKey(item));
      li.appendChild(role);
      li.appendChild(when);
      li.appendChild(actions);
      list.appendChild(li);
    });
    return;
  }

  function ajdwRenderVersionListLegacy() {
    var list = document.getElementById('ajdw-version-list');
    if (!list) { return; }
    if (!ajdwVersionList) { ajdwVersionList = []; }
    list.innerHTML = '';
    if (ajdwVersionList.length === 0) {
      var empty = document.createElement('li');
      empty.className = 'ajdw-version-empty';
      empty.textContent = 'No snapshots yet. One is saved before every import.';
      list.appendChild(empty);
      return;
    }
    ajdwVersionList.slice(0, 10).forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'ajdw-version-item';
      var label = document.createElement('span');
      label.className = 'ajdw-version-label';
      label.textContent = (item.label || 'Snapshot') + ' - ' + (item.draftId || 'draft') + ' - ' + ajdwTimeLabel(item.savedAt);
      var restore = document.createElement('button');
      restore.type = 'button';
      restore.className = 'ajdw-button ajdw-button--small ajdw-button--ghost';
      restore.textContent = 'Restore';
      restore.addEventListener('click', function () {
        ajdwPushVersion(ajdwCaptureRecord(), 'Before restore');
        ajdwApplyRecord(item);
        ajdwSaveNow();
        var status = document.getElementById('ajdw-versions-status');
        if (status) { status.textContent = 'Restored the snapshot from ' + ajdwTimeLabel(item.savedAt) + '.'; }
      });
      li.appendChild(label);
      li.appendChild(restore);
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ajdw-button ajdw-button--small ajdw-button--ghost ajdw-version-delete';
      remove.setAttribute('data-ajdw-armed', '0');
      remove.textContent = 'Delete';
      remove.addEventListener('click', function () {
        var vstatus = document.getElementById('ajdw-versions-status');
        if (remove.getAttribute('data-ajdw-armed') !== '1') {
          remove.setAttribute('data-ajdw-armed', '1');
          remove.textContent = 'Confirm delete';
          if (vstatus) { vstatus.textContent = 'Press Confirm delete to remove this snapshot. Nothing has been removed yet.'; }
          setTimeout(function () {
            if (remove.getAttribute('data-ajdw-armed') === '1') {
              remove.setAttribute('data-ajdw-armed', '0');
              remove.textContent = 'Delete';
            }
          }, 8000);
          return;
        }
        remove.setAttribute('data-ajdw-armed', '0');
        remove.textContent = 'Delete';
        ajdwVersionList = ajdwVersionList.filter(function (entry) { return entry !== item; });
        ajdwSaveVersions();
        if (vstatus) { vstatus.textContent = 'Version deleted.'; }
      });
      li.appendChild(remove);
      list.appendChild(li);
    });
  }

  function ajdwSaveVersions() {
    ajdwEnsureVersionIds();
    var ajdwB1Pruned = (typeof ajdwB1PruneVersions === 'function') ? ajdwB1PruneVersions(ajdwVersionList) : null;
    if (ajdwB1Pruned) { ajdwVersionList = ajdwB1Pruned.list; }
    ajdwWriteVersionStore(ajdwVersionList);
    if (ajdwB1Pruned && ajdwB1Pruned.removed > 0 && typeof ajdwB1ShowKeepNotice === 'function') {
      ajdwB1ShowKeepNotice();
    }
    ajdwRenderVersionList();
  }

  function ajdwLoadVersions() {
    if (ajdwVersionLoaded) { return; }
    ajdwVersionLoaded = true;
    ajdwStorageRead(AJDW_VERSION_KEY, function (value) {
      var briefId = ajdwBriefUuid(null);
      var loaded = [];
      if (Array.isArray(value)) { loaded = value; }
      else if (value && Array.isArray(value.versions)) { loaded = value.versions; }
      ajdwVersionList = ajdwSplitVersionsByBrief(loaded, briefId);
      ajdwRenderVersionList();
    });
  }

  /* T-31: stable brief identity, quota banner with one-click backup, backup validation. */
  var AJDW_MAX_VERSIONS_PER_BRIEF = 10;
  var AJDW_SUPPORTED_SCHEMA_MIN = 1;

  /* B3 T-74: per-brief UUID identity so two briefs titled 'Product Manager' keep separate histories. */
  var AJDW_BRIEF_STORE_KEY = 'ajdw-brief-identity-v1';
  var AJDW_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var ajdwBriefIdCache = '';

  function ajdwNewBriefUuid() {
    var bytes = [];
    var i;
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') {
      var buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      for (i = 0; i < 16; i += 1) { bytes.push(buf[i]); }
    } else {
      for (i = 0; i < 16; i += 1) { bytes.push(Math.floor(Math.random() * 256)); }
    }
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    var hex = '';
    for (i = 0; i < 16; i += 1) {
      hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    }
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20, 32);
  }

  function ajdwBriefUuid(record) {
    if (ajdwBriefIdCache) { return ajdwBriefIdCache; }
    var candidate = '';
    if (record && typeof record === 'object') {
      candidate = record.briefId || record.draftId || record.id || '';
    }
    if (!candidate && typeof ajdwCurrentDraftId === 'function') { candidate = ajdwCurrentDraftId(); }
    if (candidate && AJDW_UUID_RE.test(String(candidate))) {
      ajdwBriefIdCache = String(candidate);
      return ajdwBriefIdCache;
    }
    ajdwBriefIdCache = ajdwNewBriefUuid();
    if (typeof ajdwStorageWrite === 'function') {
      try {
        ajdwStorageWrite(AJDW_BRIEF_STORE_KEY, {
          briefId: ajdwBriefIdCache,
          title: record && record.title ? String(record.title).slice(0, 200) : ''
        });
      } catch (err) { /* storage is best effort, the in-memory id still holds for this session */ }
    }
    return ajdwBriefIdCache;
  }

  function ajdwVersionBriefId(entry) {
    if (!entry || typeof entry !== 'object') { return ''; }
    return String(entry.briefId || entry.draftId || '');
  }

  function ajdwSplitVersionsByBrief(list, briefId) {
    var out = [];
    var i;
    if (!Array.isArray(list)) { return out; }
    for (i = 0; i < list.length; i += 1) {
      var entry = list[i];
      if (!entry || typeof entry !== 'object') { continue; }
      var owner = ajdwVersionBriefId(entry);
      if (!owner) { entry.briefId = briefId; out.push(entry); continue; }
      if (owner === briefId) { out.push(entry); }
    }
    return out;
  }

  function ajdwWriteVersionStore(list) {
    var briefId = ajdwBriefUuid(null);
    var rows = Array.isArray(list) ? list.slice(0, 60) : [];
    var i;
    for (i = 0; i < rows.length; i += 1) {
      if (rows[i] && typeof rows[i] === 'object' && !rows[i].briefId) { rows[i].briefId = briefId; }
    }
    ajdwStorageWrite(AJDW_VERSION_KEY, { briefId: briefId, briefUuid: briefId, versions: rows });
  }

  /* B3 T-74: import guards. Reject unknown or oversized fields, then snapshot before applying. */
  var AJDW_IMPORT_MAX_CHARS = 1048576;
  var AJDW_IMPORT_MAX_TEXT = 200000;
  var AJDW_IMPORT_MAX_LIST = 500;
  var AJDW_IMPORT_ALLOWED_KEYS = {
    appId: 1, app: 1, appVersion: 1, schemaVersion: 1, briefId: 1, draftId: 1, id: 1,
    toolBuild: 1, build: 1, exportedAt: 1, savedAt: 1, createdAt: 1, updatedAt: 1, generatedAt: 1,
    title: 1, name: 1, roleTitle: 1, brief: 1, briefs: 1, current: 1, activeBriefId: 1,
    sections: 1, versions: 1, adverts: 1, ads: 1, variants: 1, meta: 1, tone: 1, notes: 1,
    source: 1, reason: 1, count: 1, text: 1, json: 1, raw: 1, preview: 1, checks: 1,
    history: 1, company: 1, labels: 1, fields: 1, activeSectionId: 1, order: 1, settings: 1,
    profile: 1, bias: 1, readability: 1, checkResults: 1, status: 1, removedAt: 1, template: 1, mode: 1
  };

  function ajdwImportFieldCheck(value, depth) {
    var level = typeof depth === 'number' ? depth : 0;
    if (level > 6) { return 'That backup nests too deeply to import safely.'; }
    if (value === null || typeof value === 'boolean' || typeof value === 'number') { return ''; }
    if (typeof value === 'string') {
      if (value.length > AJDW_IMPORT_MAX_TEXT) {
        return 'That backup has a text field longer than ' + AJDW_IMPORT_MAX_TEXT + ' characters.';
      }
      return '';
    }
    if (Array.isArray(value)) {
      if (value.length > AJDW_IMPORT_MAX_LIST) {
        return 'That backup has a list with more than ' + AJDW_IMPORT_MAX_LIST + ' items.';
      }
      var i;
      for (i = 0; i < value.length; i += 1) {
        var listProblem = ajdwImportFieldCheck(value[i], level + 1);
        if (listProblem) { return listProblem; }
      }
      return '';
    }
    if (typeof value === 'object') {
      var keys = [];
      var key;
      for (key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) { keys.push(key); }
      }
      if (level === 0) {
        var k;
        for (k = 0; k < keys.length; k += 1) {
          if (!Object.prototype.hasOwnProperty.call(AJDW_IMPORT_ALLOWED_KEYS, keys[k])) {
            return 'This backup contains an unknown field "' + keys[k] + '". Only fields written by JD Studio can be imported.';
          }
        }
      }
      var j;
      for (j = 0; j < keys.length; j += 1) {
        var nestedProblem = ajdwImportFieldCheck(value[keys[j]], level + 1);
        if (nestedProblem) { return nestedProblem; }
      }
      return '';
    }
    return 'That backup contains a value JD Studio cannot import.';
  }

  function ajdwImportSnapshot() {
    if (typeof ajdwCaptureRecord !== 'function') { return false; }
    var record = null;
    try { record = ajdwCaptureRecord(); } catch (err) { return false; }
    if (!record || typeof record !== 'object') { return false; }
    record.briefId = ajdwBriefUuid(record);
    record.savedAt = new Date().toISOString();
    record.reason = 'Pre-import snapshot';
    if (!Array.isArray(ajdwVersionList)) { return false; }
    ajdwVersionList.unshift(record);
    if (typeof ajdwSaveVersions === 'function') { ajdwSaveVersions(); }
    return true;
  }

  /* B3 T-74: the import control must be on screen even if a stylesheet or flag hid it. */
  function ajdwHardenImportUi() {
    if (typeof document === 'undefined' || !document.getElementById) { return; }
    var panel = document.getElementById('ajdw-import-panel');
    var quick = document.getElementById('ajdw-import-json');
    if (panel) { panel.hidden = false; panel.removeAttribute('hidden'); }
    if (quick) { quick.hidden = false; quick.removeAttribute('hidden'); }
    var button = document.getElementById('ajdw-import-json-button') || document.getElementById('ajdw-import-choose');
    if (button) {
      button.hidden = false;
      button.removeAttribute('hidden');
      button.disabled = false;
      button.removeAttribute('disabled');
    }
    var status = document.getElementById('ajdw-import-status');
    if (!status && panel) {
      status = document.createElement('p');
      status.id = 'ajdw-import-status';
      status.className = 'ajdw-status ajdw-import-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.textContent = 'Choose a backup file to import. Invalid files are rejected before anything changes.';
      if (panel.firstChild) { panel.insertBefore(status, panel.firstChild); } else { panel.appendChild(status); }
    }
  }

  if (typeof setTimeout === 'function') {
    setTimeout(ajdwHardenImportUi, 0);
    setTimeout(ajdwHardenImportUi, 400);
  }

  function ajdwValidateBackup(record) {
    if (!record || typeof record !== 'object') {
      return { ok: false, message: 'That file is not a JD Studio backup.' };
    }
    if (typeof record.appId !== 'string' || !record.appId) {
      return { ok: false, message: 'This file has no appId, so it cannot be trusted as a JD Studio backup.' };
    }
    if (record.appId !== AJDW_APP_ID) {
      return { ok: false, message: 'This backup belongs to a different app (' + record.appId + '), not JD Studio.' };
    }
    var schema = record.schemaVersion;
    if (typeof schema !== 'number' || isNaN(schema)) {
      return { ok: false, message: 'This backup has no schemaVersion, so it cannot be read safely.' };
    }
    if (schema < AJDW_SUPPORTED_SCHEMA_MIN || schema > AJDW_SCHEMA_VERSION) {
      return { ok: false, message: 'schemaVersion ' + schema + ' is not supported. This build reads versions ' + AJDW_SUPPORTED_SCHEMA_MIN + ' to ' + AJDW_SCHEMA_VERSION + '.' };
    }
    /* B3 T-74: reject oversized payloads and unknown fields, then snapshot before import. */
    var sizeChars = 0;
    try { sizeChars = JSON.stringify(record).length; } catch (err) { return { ok: false, message: 'That backup cannot be read as JSON text.' }; }
    if (sizeChars > AJDW_IMPORT_MAX_CHARS) {
      return { ok: false, message: 'That backup is about ' + Math.round(sizeChars / 1024) + ' KB. JD Studio imports files up to ' + Math.round(AJDW_IMPORT_MAX_CHARS / 1024) + ' KB.' };
    }
    var fieldProblem = ajdwImportFieldCheck(record, 0);
    if (fieldProblem) { return { ok: false, message: fieldProblem }; }
    ajdwImportSnapshot();
    return { ok: true, message: '' };
  }

  function ajdwBackupJson() {
    var record = (typeof ajdwCaptureRecord === 'function') ? ajdwCaptureRecord() : {};
    if (!record || typeof record !== 'object') { record = {}; }
    record.appId = AJDW_APP_ID;
    record.schemaVersion = AJDW_SCHEMA_VERSION;
    record.briefId = ajdwBriefUuid(record);
    return JSON.stringify(record, null, 2);
  }

  function ajdwDownloadBackup() {
    var status = document.getElementById('ajdw-quota-text');
    var done = false;
    try {
      var text = ajdwBackupJson();
      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
        var blob = new Blob([text], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'jd-studio-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        link.className = 'ajdw-download-link';
        if (document.body) { document.body.appendChild(link); }
        link.click();
        if (link.parentNode) { link.parentNode.removeChild(link); }
        setTimeout(function () { try { URL.revokeObjectURL(url); } catch (ignored) {} }, 1000);
        done = true;
      }
    } catch (error) {
      done = false;
    }
    if (status) {
      status.textContent = done
        ? 'Backup downloaded. Free up browser storage, then keep editing.'
        : 'Could not build the download here. Copy your text out manually before closing the tab.';
    }
  }

  function ajdwQuotaBanner(message) {
    if (typeof document === 'undefined' || !document.createElement) { return; }
    var host = document.getElementById('ajdw-quota-banner');
    if (!host) {
      host = document.createElement('div');
      host.id = 'ajdw-quota-banner';
      host.className = 'ajdw-status ajdw-quota-banner ajdw-status--error';
      host.setAttribute('role', 'alert');
      var text = document.createElement('span');
      text.className = 'ajdw-quota-text';
      text.id = 'ajdw-quota-text';
      var button = document.createElement('button');
      button.type = 'button';
      button.id = 'ajdw-quota-backup';
      button.className = 'ajdw-button ajdw-button--small';
      button.textContent = 'Download JSON backup';
      button.addEventListener('click', ajdwDownloadBackup);
      host.appendChild(text);
      host.appendChild(button);
      var anchor = document.getElementById('ajdw-save-status');
      if (anchor && anchor.parentNode) { anchor.parentNode.insertBefore(host, anchor.nextSibling); }
      else if (document.body) { document.body.insertBefore(host, document.body.firstChild || null); }
    }
    var label = document.getElementById('ajdw-quota-text');
    if (label) { label.textContent = message; }
  }

  /* T-32: documented bias sources, grade formula and advisory-only limits. */
  var AJDW_RULES_DOC = [
    ['Bias term list source', 'The authoritative list is AJDW_BIAS_TERMS in app/AIJobDescriptionWriter.js - terms are defined there and nowhere else. To extend it, add an entry in the same shape as the existing entries, raise the build number in the first line of the file, and reload; the next Check draft uses the extended list.'],
    ['Readability grade', 'Flesch-Kincaid grade = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words). Words, sentences and syllables are counted with simple built-in heuristics, so the score is an approximation, not a certified reading level.'],
    ['Thresholds are display-only', 'The band labels shown next to the grade are guidance for the reviewer. They never block editing, import or export, and no score is saved with the draft.'],
    ['Advisory, human review required', 'Bias flags, long-sentence flags and the grade are advisory. A person must read and approve every draft before posting; the tool does not certify legal or HR compliance.'],
    ['Character limits', 'Advert limits (standard 800, short 300, social 150) count every character including spaces. They are advisory and text is never truncated automatically, so trim or expand the copy yourself.']
  ];

  function ajdwRenderRulesDoc() {
    if (typeof document === 'undefined' || !document.createElement) { return null; }
    var existing = document.getElementById('ajdw-rules-doc');
    if (existing) { return existing; }
    var host = document.getElementById('ajdw-check-panel') || document.getElementById('ajdw-app') || document.body;
    if (!host) { return null; }
    var wrap = document.createElement('div');
    wrap.id = 'ajdw-rules-doc';
    wrap.className = 'ajdw-rules-doc';
    var title = document.createElement('h4');
    title.className = 'ajdw-section-title ajdw-rules-title';
    title.textContent = 'Bias rules and grade scoring';
    wrap.appendChild(title);
    var list = document.createElement('dl');
    list.className = 'ajdw-rules-list';
    AJDW_RULES_DOC.forEach(function (pair) {
      var term = document.createElement('dt');
      term.className = 'ajdw-rules-term';
      term.textContent = pair[0];
      var detail = document.createElement('dd');
      detail.className = 'ajdw-rules-detail';
      detail.textContent = pair[1];
      list.appendChild(term);
      list.appendChild(detail);
    });
    wrap.appendChild(list);
    host.appendChild(wrap);
    return wrap;
  }

  var ajdwRulesTries = 0;

  function ajdwScheduleRulesDoc() {
    ajdwRulesTries += 1;
    if (document.getElementById('ajdw-rules-doc')) { return; }
    ajdwRenderRulesDoc();
    if (!document.getElementById('ajdw-rules-doc') && ajdwRulesTries < 20) {
      setTimeout(ajdwScheduleRulesDoc, 250);
    }
  }

  setTimeout(ajdwScheduleRulesDoc, 0);

  function ajdwPushVersion(record, label) {
    if (!record) { return null; }
    record.briefId = ajdwBriefUuid(record);
    if (!ajdwVersionList) { ajdwVersionList = []; }
    var copy = ajdwParseRecord(JSON.stringify(record));
    if (!copy) { return null; }
    copy.draftId = record.draftId || record.id || ajdwCurrentDraftId();
    copy.savedAt = record.savedAt || new Date().toISOString();
    copy.label = label || 'Snapshot';
    ajdwVersionList.unshift(copy);
    var counts = {};
    ajdwVersionList = ajdwVersionList.filter(function (item) {
      var key = item.briefId || item.draftId || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
      return counts[key] <= 10;
    }).slice(0, 60);
    ajdwSaveVersions();
    return copy;
  }

  function ajdwDescribeCurrent() {
    var brief = currentBriefValues();
    var out = { brief: {}, sections: [], adverts: [] };
    AJDW_ROLE_BRIEF_INPUTS.forEach(function (param) {
      if (brief[param.name]) { out.brief[param.name] = param.label; }
    });
    jdSections.forEach(function (section) {
      out.sections.push(section.heading || 'Untitled section');
    });
    ['standard', 'short', 'social'].forEach(function (key) {
      if (ajdwAdvertText(key)) { out.adverts.push(key); }
    });
    return out;
  }

  function ajdwBuildImportDiff(record) {
    var current = ajdwDescribeCurrent();
    var incoming = record && typeof record === 'object' ? record : {};
    var incomingBrief = (incoming.brief && typeof incoming.brief === 'object') ? incoming.brief : {};
    var overwrite = [];
    var additions = [];
    AJDW_ROLE_BRIEF_INPUTS.forEach(function (param) {
      var next = typeof incomingBrief[param.name] === 'string' ? incomingBrief[param.name] : '';
      if (!next) { return; }
      if (current.brief[param.name]) { overwrite.push('Brief field: ' + param.label); }
      else { additions.push('Brief field: ' + param.label); }
    });
    var nextSections = Array.isArray(incoming.sections) ? incoming.sections : [];
    if (nextSections.length > 0) {
      if (jdSections.length > 0) { overwrite.push('All ' + jdSections.length + ' current sections replaced by ' + nextSections.length + ' imported sections'); }
      else { additions.push(nextSections.length + ' sections'); }
    }
    var nextAdverts = (incoming.adverts && typeof incoming.adverts === 'object') ? incoming.adverts : {};
    ['standard', 'short', 'social'].forEach(function (key) {
      var next = nextAdverts[key] && nextAdverts[key].text;
      if (!next) { return; }
      if (ajdwAdvertText(key)) { overwrite.push('Advert variant: ' + key); }
      else { additions.push('Advert variant: ' + key); }
    });
    return { overwrite: overwrite, additions: additions };
  }

  function ajdwShowImportDiff(record, sourceName) {
    var parsed = ajdwParseRecord(record);
    var status = document.getElementById('ajdw-import-status');
    if (!parsed) {
      if (status) {
        status.textContent = 'That backup is not valid JSON. Nothing changed.';
        status.className = 'ajdw-status ajdw-import-status ajdw-status--error';
      }
      return;
    }
    var check = ajdwValidateBackup(parsed);
    if (!check.ok) {
      if (status) {
        status.textContent = check.message + ' Nothing changed. Choose a JD Studio backup exported by this build.';
        status.className = 'ajdw-status ajdw-import-status ajdw-status--error';
      }
      ajdwPendingImport = null;
      var stalePanel = document.getElementById('ajdw-import-diff');
      if (stalePanel) { stalePanel.hidden = true; }
      return;
    }
    ajdwPendingImport = { record: parsed, source: sourceName || 'backup' };
    var panel = document.getElementById('ajdw-import-diff');
    var list = document.getElementById('ajdw-import-diff-list');
    if (!panel || !list) { return; }
    var diff = ajdwBuildImportDiff(parsed);
    list.innerHTML = '';
    function addItem(kind, text) {
      var li = document.createElement('li');
      li.className = 'ajdw-import-diff-item';
      li.textContent = kind + ': ' + text;
      list.appendChild(li);
    }
    if (diff.overwrite.length === 0) { addItem('Overwritten', 'nothing - this import only adds data'); }
    diff.overwrite.forEach(function (item) { addItem('Overwritten', item); });
    diff.additions.forEach(function (item) { addItem('Added', item); });
    panel.hidden = false;
    if (status) {
      status.textContent = 'Review the changes from ' + ajdwPendingImport.source + ', then apply or cancel. Nothing is overwritten yet.';
      status.className = 'ajdw-status ajdw-import-status';
    }
  }

  function ajdwCancelImport() {
    ajdwPendingImport = null;
    ajdwImportConfirmReset();
    var panel = document.getElementById('ajdw-import-diff');
    if (panel) { panel.hidden = true; }
    var status = document.getElementById('ajdw-import-status');
    if (status) { status.textContent = 'Import cancelled. Nothing changed.'; }
    var input = document.getElementById('ajdw-import-file');
    if (input) { input.value = ''; }
  }

  var ajdwImportConfirmOn = false;

  function ajdwImportConfirmReset() {
    ajdwImportConfirmOn = false;
    var box = document.getElementById('ajdw-import-confirm');
    if (box && box.parentNode) { box.parentNode.removeChild(box); }
  }

  function ajdwImportConfirmShow() {
    var host = document.getElementById('ajdw-import-diff') || document.getElementById('ajdw-import-panel');
    if (!host) { ajdwImportConfirmOn = false; return false; }
    ajdwImportConfirmOn = true;
    if (document.getElementById('ajdw-import-confirm')) { return true; }
    var row = document.createElement('p');
    row.className = 'ajdw-confirm-row';
    row.id = 'ajdw-import-confirm';
    var question = document.createElement('span');
    question.className = 'ajdw-confirm-text';
    question.textContent = 'Replace current draft with imported file? ';
    var replaceButton = document.createElement('button');
    replaceButton.type = 'button';
    replaceButton.className = 'ajdw-button ajdw-button--small ajdw-button--danger';
    replaceButton.id = 'ajdw-import-confirm-replace';
    replaceButton.textContent = 'Replace';
    replaceButton.addEventListener('click', function () { ajdwApplyImport(); });
    var cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'ajdw-button ajdw-button--small ajdw-button--ghost';
    cancelButton.id = 'ajdw-import-confirm-cancel';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', function () {
      ajdwImportConfirmReset();
      var status = document.getElementById('ajdw-import-status');
      if (status) {
        status.textContent = 'Replace cancelled. Nothing changed.';
        status.className = 'ajdw-status ajdw-import-status';
      }
    });
    row.appendChild(question);
    row.appendChild(replaceButton);
    row.appendChild(cancelButton);
    host.appendChild(row);
    return true;
  }

  function ajdwApplyImport() {
    if (!ajdwPendingImport) { return; }
    if (!ajdwImportConfirmOn && ajdwImportConfirmShow()) { return; }
    ajdwImportConfirmReset();
    ajdwPushVersion(ajdwCaptureRecord(), 'Before import');
    ajdwApplyRecord(ajdwPendingImport.record);
    ajdwPendingImport = null;
    var panel = document.getElementById('ajdw-import-diff');
    if (panel) { panel.hidden = true; }
    var status = document.getElementById('ajdw-import-status');
    if (status) {
      status.textContent = 'Import applied. A snapshot of the previous draft was saved to version history.';
      status.className = 'ajdw-status ajdw-import-status ajdw-status--success';
    }
    ajdwSaveNow();
  }

  function ajdwReadImportFile(file) {
    if (!file) { return; }
    var status = document.getElementById('ajdw-import-status');
    if (typeof FileReader === 'undefined') {
      if (status) { status.textContent = 'This browser cannot read files. Nothing changed.'; }
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      ajdwShowImportDiff(String(reader.result || ''), file.name || 'backup');
    };
    reader.onerror = function () {
      if (status) { status.textContent = 'Could not read that file. Nothing changed.'; }
    };
    reader.readAsText(file);
  }

  function ajdwBindImportControls() {
    var input = document.getElementById('ajdw-import-file');
    if (input && input.getAttribute('data-ajdw-diff') !== '1') {
      input.setAttribute('data-ajdw-diff', '1');
      if (typeof input.addEventListener === 'function') {
        input.addEventListener('change', function () {
          var files = input.files;
          ajdwReadImportFile(files && files.length ? files[0] : null);
        });
      }
    }
    var applyButton = document.getElementById('ajdw-import-apply');
    if (applyButton && applyButton.getAttribute('data-ajdw-bound') !== '1') {
      applyButton.setAttribute('data-ajdw-bound', '1');
      applyButton.addEventListener('click', ajdwApplyImport);
    }
    var cancelButton = document.getElementById('ajdw-import-cancel');
    if (cancelButton && cancelButton.getAttribute('data-ajdw-bound') !== '1') {
      cancelButton.setAttribute('data-ajdw-bound', '1');
      cancelButton.addEventListener('click', ajdwCancelImport);
    }
    var chooseButton = document.getElementById('ajdw-import-choose');
    if (chooseButton && chooseButton.getAttribute('data-ajdw-bound') !== '1') {
      chooseButton.setAttribute('data-ajdw-bound', '1');
      chooseButton.addEventListener('click', function () {
        var field = document.getElementById('ajdw-import-file');
        if (field && typeof field.click === 'function') { field.click(); }
      });
    }
  }

  setTimeout(function () {
    ajdwBindImportControls();
    ajdwLoadVersions();
    ajdwRenderVersionList();
  }, 0);

  var sectionResponseSchema = {
    type: 'object',
    properties: { content: { type: 'string' } },
    required: ['content']
  };

  function currentBriefValues() {
    var brief = {};
    AJDW_ROLE_BRIEF_INPUTS.forEach(function (param) {
      var field = getField(param);
      brief[param.name] = field ? field.value.trim() : '';
    });
    return brief;
  }

  function makeSection(id, heading, content, rows) {
    return { id: id, heading: heading, content: content, rows: rows || 4 };
  }

  function ajdwCanonicalSections() {
    var seen = {};
    var ordered = [];
    jdSections.forEach(function (section) {
      if (!section || typeof section !== 'object') { return; }
      var id = (typeof section.id === 'string' && section.id) ? section.id : nextSectionId();
      var key = 'k:' + id;
      while (seen[key]) {
        id = nextSectionId();
        key = 'k:' + id;
      }
      seen[key] = true;
      section.id = id;
      ordered.push(section);
    });
    jdSections = ordered;
    return ordered;
  }

  function ajdwSectionSignature() {
    ajdwEnsureSectionIds();
    return jdSections.map(function (section) { return section.id; }).join('|');
  }

  function ajdwFindSectionElement(sectionId) {
    if (!sectionId) { return null; }
    return document.getElementById('ajdw-section-' + sectionId) || document.querySelector('[data-section-id="' + sectionId + '"]');
  }

  function ajdwResolveTone(rawTone) {
    var value = String(rawTone == null ? '' : rawTone).trim();
    if (!value) { return 'professional: ' + AJDW_TONE_PRESETS.professional; }
    var key = value.toLowerCase();
    var preset = null;
    Object.keys(AJDW_TONE_PRESETS).forEach(function (name) {
      if (!preset && key.indexOf(name) >= 0) { preset = name; }
    });
    if (preset) { return preset + ': ' + AJDW_TONE_PRESETS[preset]; }
    return value;
  }

  var ajdwLastSectionSignature = '';

  var ajdwCheckStale = false;
  var ajdwExportAck = false;

  /* T-47: section title plus a short excerpt for each flag. */
  function ajdwFlagMeta(flag) {
    var meta = { heading: '', excerpt: '' };
    if (!flag) { return meta; }
    if (flag.heading) { meta.heading = String(flag.heading); }
    var section = null;
    try { section = sectionById(flag.sectionId); } catch (err) { section = null; }
    if (section && section.heading) { meta.heading = section.heading; }
    var text = null;
    try { text = ajdwSectionTextById(flag.sectionId); } catch (err2) { text = null; }
    text = text == null ? '' : String(text).replace(/\s+/g, ' ').trim();
    if (!text) { return meta; }
    var phrase = flag.phrase || flag.term || '';
    var at = phrase ? ajdwFindPhrase(text, phrase, flag.occurrence) : -1;
    if (at < 0) { at = 0; }
    var start = Math.max(0, at - 30);
    var end = Math.min(text.length, at + (phrase ? phrase.length : 0) + 30);
    var snippet = text.slice(start, end);
    if (start > 0) { snippet = '…' + snippet; }
    if (end < text.length) { snippet = snippet + '…'; }
    meta.excerpt = snippet;
    return meta;
  }

  /* T-46: a flag whose section is gone is dropped silently, never thrown on. */
  function ajdwDropStaleFlags() {
    if (!ajdwLastFlags || !ajdwLastFlags.length) { return; }
    var kept = [];
    for (var i = 0; i < ajdwLastFlags.length; i += 1) {
      var flag = ajdwLastFlags[i];
      if (!flag || !flag.sectionId) { continue; }
      var section = null;
      try { section = sectionById(flag.sectionId); } catch (err) { section = null; }
      var field = null;
      try { field = document.getElementById('ajdw-section-' + flag.sectionId) || document.getElementById(String(flag.sectionId)); } catch (err2) { field = null; }
      if (section || field) { kept.push(flag); }
    }
    ajdwLastFlags = kept;
  }

  function ajdwMarkCheckStale() {
    if (!ajdwCheckRan) { return; }
    ajdwCheckStale = true;
    ajdwExportAck = false;
    ajdwDropStaleFlags();
    var list = document.getElementById('ajdw-check-list');
    if (list) {
      var links = list.querySelectorAll('.ajdw-check-link');
      for (var i = 0; i < links.length; i += 1) { links[i].disabled = true; }
    }
    var status = document.getElementById('ajdw-check-status');
    if (status) {
      status.textContent = ajdwLastFlags && ajdwLastFlags.length
        ? 'Results out of date - recheck before jumping to a flag.'
        : 'Results out of date - recheck.';
      status.className = 'ajdw-status ajdw-check-status ajdw-check-status--stale';
    }
    try { if (typeof ajdwRenderReadiness === 'function') { ajdwRenderReadiness(); } } catch (err3) { /* readiness is advisory */ }
  }

  function ajdwSyncCheckState() {
    var signature = ajdwSectionSignature();
    if (signature === ajdwLastSectionSignature) { return; }
    ajdwLastSectionSignature = signature;
    ajdwMarkCheckStale();
  }

  /* T-58 revision counter + immutable ids, T-59 conflict and import guards. Additive only. */
  var AJDW_IMPORT_MAX_BYTES = 2097152;
  var ajdwRevision = 1;
  var ajdwSectionIdFloor = 0;
  var ajdwDiscardDraftOnce = false;
  var ajdwChannel = null;
  var ajdwTabId = 'ajdw-tab-' + Math.random().toString(36).slice(2, 10);
  var ajdwRevisionTimer = null;

  function nextSectionId() {
    jdSectionSeq += 1;
    if (jdSectionSeq <= ajdwSectionIdFloor) { jdSectionSeq = ajdwSectionIdFloor + 1; }
    ajdwSectionIdFloor = jdSectionSeq;
    return 'new-' + jdSectionSeq;
  }

  function ajdwEnsureSectionIds() {
    if (!Array.isArray(jdSections)) { return; }
    var seen = {};
    jdSections.forEach(function (section) {
      if (!section || typeof section !== 'object') { return; }
      var id = typeof section.id === 'string' ? section.id.trim() : '';
      if (!id || seen['k:' + id]) { id = nextSectionId(); }
      section.id = id;
      seen['k:' + id] = true;
      var match = /^new-(\d+)$/.exec(id);
      if (match) {
        var n = parseInt(match[1], 10);
        if (!isNaN(n) && n > ajdwSectionIdFloor) { ajdwSectionIdFloor = n; }
      }
    });
  }

  function ajdwBroadcast(message) {
    if (!ajdwChannel) { return; }
    var payload = message || {};
    payload.tab = ajdwTabId;
    if (typeof payload.revision !== 'number') { payload.revision = ajdwRevision; }
    try { ajdwChannel.postMessage(payload); } catch (err) { /* channel closed */ }
  }

  function ajdwBumpRevision(reason) {
    ajdwRevision += 1;
    ajdwBroadcast({ type: 'revision', revision: ajdwRevision, reason: reason || 'edit' });
    return ajdwRevision;
  }

  function ajdwOpenChannel() {
    if (ajdwChannel || typeof BroadcastChannel !== 'function') { return; }
    try { ajdwChannel = new BroadcastChannel('ajdw-jd-studio-revision'); } catch (err) { ajdwChannel = null; return; }
    ajdwChannel.onmessage = function (event) {
      var data = event && event.data ? event.data : null;
      if (!data || data.tab === ajdwTabId) { return; }
      if (data.type === 'revision' && typeof data.revision === 'number' && data.revision < ajdwRevision) {
        ajdwShowConflict();
      }
      if (data.type === 'keep-mine' && typeof data.revision === 'number' && data.revision > ajdwRevision) {
        ajdwRevision = data.revision;
        ajdwHideConflict();
        try { setEditorStatus('Another tab chose to keep its own draft. Reload this page to see the newest revision.', 'info'); } catch (err) { /* status is advisory */ }
      }
    };
  }

  function ajdwSetConflictText(text) {
    var banner = document.getElementById('ajdw-conflict-banner');
    var label = document.getElementById('ajdw-conflict-text');
    if (banner) { banner.hidden = false; }
    if (label) { label.textContent = text || ''; }
  }

  function ajdwHideConflict() {
    var banner = document.getElementById('ajdw-conflict-banner');
    if (banner) { banner.hidden = true; }
  }

  function ajdwConflictBanner() {
    var banner = document.getElementById('ajdw-conflict-banner');
    if (banner) { return banner; }
    var host = document.querySelector('.ajdw-app') || document.body;
    if (!host) { return null; }
    banner = document.createElement('div');
    banner.id = 'ajdw-conflict-banner';
    banner.className = 'ajdw-status ajdw-status--warn ajdw-conflict-banner';
    banner.setAttribute('role', 'alert');
    banner.hidden = true;
    var label = document.createElement('span');
    label.id = 'ajdw-conflict-text';
    label.className = 'ajdw-conflict-text';
    var reload = document.createElement('button');
    reload.type = 'button';
    reload.id = 'ajdw-conflict-reload';
    reload.className = 'ajdw-button ajdw-button--small';
    reload.textContent = 'Reload newer draft';
    var keep = document.createElement('button');
    keep.type = 'button';
    keep.id = 'ajdw-conflict-keep';
    keep.className = 'ajdw-button ajdw-button--small ajdw-button--ghost';
    keep.textContent = 'Keep mine';
    banner.appendChild(label);
    banner.appendChild(reload);
    banner.appendChild(keep);
    host.insertBefore(banner, host.firstChild);
    reload.addEventListener('click', function () {
      ajdwHideConflict();
      try {
        if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') { window.location.reload(); }
      } catch (err) { /* reload blocked */ }
    });
    keep.addEventListener('click', function () {
      ajdwRevision += 1;
      ajdwBroadcast({ type: 'keep-mine', revision: ajdwRevision });
      ajdwHideConflict();
    });
    return banner;
  }

  function ajdwShowConflict() {
    var banner = ajdwConflictBanner();
    if (!banner) { return; }
    ajdwSetConflictText('Another tab saved a newer revision of this brief. Reload to use it, or keep mine and continue.');
  }

  function ajdwNoteStale() {
    try { setEditorStatus('An AI response arrived for an older revision, so it was discarded. Nothing changed.', 'warn'); } catch (err) { /* status is advisory */ }
  }

  function ajdwInstallStaleGuard() {
    if (typeof tool === 'undefined' || !tool || typeof tool.requestAI !== 'function') { return; }
    if (tool.requestAI.__ajdwRevisionGuard) { return; }
    var raw = tool.requestAI;
    var guarded = function (request) {
      var sentAt = ajdwRevision;
      var promise;
      try { promise = raw.call(tool, request); } catch (err) { return Promise.reject(err); }
      return Promise.resolve(promise).then(function (result) {
        if (ajdwRevision !== sentAt) {
          ajdwDiscardDraftOnce = true;
          ajdwNoteStale();
        }
        return result;
      });
    };
    guarded.__ajdwRevisionGuard = true;
    tool.requestAI = guarded;
  }

  function ajdwImportStatusMessage(message, tone) {
    var status = document.getElementById('ajdw-import-status');
    if (!status) { return; }
    status.textContent = message;
    status.className = 'ajdw-status ajdw-import-status ajdw-status--' + (tone || 'error');
  }

  function ajdwRejectImport(input, message) {
    try { input.value = ''; } catch (err) { /* input is read only */ }
    ajdwImportStatusMessage(message, 'error');
  }

  function ajdwInstallImportGuards() {
    if (!document || typeof document.addEventListener !== 'function') { return; }
    document.addEventListener('change', function (event) {
      var input = event.target;
      if (!input || (input.id !== 'ajdw-import-file' && input.id !== 'ajdw-import-json-file')) { return; }
      var file = input.files && input.files.length ? input.files[0] : null;
      if (!file) { return; }
      var stop = function (message) {
        if (typeof event.stopImmediatePropagation === 'function') { event.stopImmediatePropagation(); }
        if (typeof event.stopPropagation === 'function') { event.stopPropagation(); }
        ajdwRejectImport(input, message);
      };
      if (typeof file.size === 'number' && file.size > AJDW_IMPORT_MAX_BYTES) {
        stop('Import rejected: this backup is larger than 2 MB, so nothing was changed.');
        return;
      }
      if (typeof file.size === 'number' && file.size === 0) {
        stop('Import rejected: this file is empty, so nothing was changed.');
        return;
      }
      if (!/\.json$/i.test(String(file.name || ''))) {
        stop('Import rejected: choose a .json backup file. Nothing was changed.');
      }
    }, true);
    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || target.id !== 'ajdw-import-apply') { return; }
      /* T-59: keep the current draft as a version before the import replaces it. */
      try { if (typeof ajdwSaveVersions === 'function') { ajdwSaveVersions(); } } catch (err) { /* snapshot is best effort */ }
      try { if (typeof ajdwBumpRevision === 'function') { ajdwBumpRevision('import'); } } catch (err2) { /* revision is advisory */ }
    }, true);
  }

  function ajdwInstallRevisionTracking() {
    if (!document || typeof document.addEventListener !== 'function') { return; }
    var schedule = function () {
      if (ajdwRevisionTimer) { window.clearTimeout(ajdwRevisionTimer); }
      ajdwRevisionTimer = window.setTimeout(function () {
        ajdwRevisionTimer = null;
        ajdwBumpRevision('edit');
      }, 600);
    };
    var handler = function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') { return; }
      if (!(target.closest('#ajdw-editor') || target.closest('#ajdw-sections') || target.closest('#ajdw-versions'))) { return; }
      schedule();
    };
    document.addEventListener('input', handler, true);
    document.addEventListener('change', handler, true);
    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') { return; }
      if (target.closest('#ajdw-editor') && target.closest('.ajdw-section-controls')) { ajdwBumpRevision('structure'); }
    }, true);
  }

  ajdwOpenChannel();
  ajdwInstallStaleGuard();
  ajdwInstallImportGuards();
  ajdwInstallRevisionTracking();
  ajdwBroadcast({ type: 'hello', revision: ajdwRevision });

  function indexOfSection(sectionId) {
    for (var i = 0; i < jdSections.length; i += 1) {
      if (jdSections[i].id === sectionId) { return i; }
    }
    return -1;
  }

  function sectionById(sectionId) {
    var index = indexOfSection(sectionId);
    return index < 0 ? null : jdSections[index];
  }

  function sectionsFromDraft(draft) {
    /* T-58: a response produced for an older revision never mutates state. */
    if (ajdwDiscardDraftOnce) {
      ajdwDiscardDraftOnce = false;
      try { setEditorStatus('A newer edit replaced this AI draft, so it was discarded. Nothing changed.', 'warn'); } catch (err) { /* status is advisory */ }
      return;
    }
    jdSections = [];
    jdSectionSeq = 0;
    currentAdverts = draft.adverts || {};
    ajdwBumpRevision('draft');
    jdSections.push(makeSection('summary', 'Summary', asDraftText(draft.summary), 3));
    jdSections.push(makeSection('responsibilities', 'Responsibilities', asDraftArray(draft.responsibilities).join('\n'), 6));
    jdSections.push(makeSection('requirements', 'Requirements', asDraftArray(draft.requirements).join('\n'), 6));
    jdSections.push(makeSection('companyContext', 'Company context', asDraftText(draft.companyContext), 3));
  }

  function setEditorStatus(message, tone) {
    var status = document.getElementById('ajdw-editor-status');
    var text = document.getElementById('ajdw-editor-status-text');
    var undoButton = document.getElementById('ajdw-undo-remove');
    if (!status || !text) { return; }
    text.textContent = message || '';
    status.className = 'ajdw-status ajdw-editor-status ajdw-status--' + (tone || 'info');
    status.hidden = !message;
    if (undoButton) { undoButton.hidden = !undoSnapshot; }
  }

  function clearUndoState() {
    if (undoTimeoutId) {
      window.clearTimeout(undoTimeoutId);
      undoTimeoutId = null;
    }
    undoSnapshot = null;
    var undoButton = document.getElementById('ajdw-undo-remove');
    if (undoButton) { undoButton.hidden = true; }
  }

  function updatePreview() {
    ajdwCanonicalSections();
    var preview = document.getElementById('ajdw-preview');
    var body = document.getElementById('ajdw-preview-body');
    if (!body) { return; }
    body.innerHTML = '';
    if (jdSections.length === 0) {
      if (preview) { preview.hidden = true; }
      return;
    }
    jdSections.forEach(function (section, index) {
      var block = document.createElement('div');
      block.className = 'ajdw-preview-block';
      block.setAttribute('data-section-id', section.id);
      block.setAttribute('data-section-order', String(index));
      var heading = document.createElement('h3');
      heading.className = 'ajdw-preview-heading';
      heading.textContent = section.heading || 'Untitled section';
      var text = document.createElement('p');
      text.className = 'ajdw-preview-text';
      text.textContent = section.content || '';
      block.appendChild(heading);
      block.appendChild(text);
      body.appendChild(block);
    });
    if (preview) { preview.hidden = false; }
    ajdwSyncCheckState();
  }

  function makeControl(action, label, id, sectionId, disabled) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'ajdw-button ajdw-button--small ajdw-button--ghost ajdw-section-control';
    button.id = id;
    button.setAttribute('data-action', action);
    button.setAttribute('data-section-id', sectionId);
    button.textContent = label;
    button.disabled = !!disabled;
    if (disabled) { button.setAttribute('aria-disabled', 'true'); }
    return button;
  }

  /* T-38: readable section name used by the Move up / Move down buttons. */
  function sectionDisplayName(section) {
    var name = section && section.heading ? String(section.heading).replace(/\s+/g, ' ').trim() : '';
    return name || 'section';
  }

  /* T-38: keep both move buttons labelled with the current section name. */
  function syncMoveLabels(section, upEl, downEl) {
    if (!section) { return; }
    var name = sectionDisplayName(section);
    var up = upEl || document.getElementById('ajdw-section-up-' + section.id);
    var down = downEl || document.getElementById('ajdw-section-down-' + section.id);
    if (up) {
      up.setAttribute('aria-label', 'Move ' + name + ' up');
      up.setAttribute('title', 'Move ' + name + ' up');
      up.setAttribute('data-section-name', name);
    }
    if (down) {
      down.setAttribute('aria-label', 'Move ' + name + ' down');
      down.setAttribute('title', 'Move ' + name + ' down');
      down.setAttribute('data-section-name', name);
    }
  }

  function buildSectionCard(section, index) {
    var card = document.createElement('div');
    card.className = 'ajdw-section-card';
    card.id = 'ajdw-section-card-' + section.id;
    card.setAttribute('data-section-id', section.id);

    var head = document.createElement('div');
    head.className = 'ajdw-section-head';
    /* T-68: the header is focusable so focus can stay on the moved section after a move. */
    head.id = 'ajdw-section-head-' + section.id;
    head.setAttribute('tabindex', '-1');

    var headingLabel = document.createElement('label');
    headingLabel.className = 'ajdw-sr-only';
    headingLabel.htmlFor = 'ajdw-section-heading-' + section.id;
    headingLabel.textContent = 'Section heading';

    var headingInput = document.createElement('input');
    headingInput.type = 'text';
    headingInput.className = 'ajdw-input ajdw-section-heading';
    headingInput.id = 'ajdw-section-heading-' + section.id;
    headingInput.value = section.heading;
    headingInput.addEventListener('input', function () {
      section.heading = headingInput.value;
      syncMoveLabels(section, upControl, downControl);
      updatePreview();
    });

    var controls = document.createElement('div');
    controls.className = 'ajdw-section-controls';
    var upControl = makeControl('up', 'Move up', 'ajdw-section-up-' + section.id, section.id, index === 0);
    controls.appendChild(upControl);
    var downControl = makeControl('down', 'Move down', 'ajdw-section-down-' + section.id, section.id, index === jdSections.length - 1);
    controls.appendChild(downControl);
    syncMoveLabels(section, upControl, downControl);
    controls.appendChild(makeControl('regenerate', 'Regenerate', 'ajdw-regenerate-' + section.id, section.id, false));
    controls.appendChild(makeControl('remove', 'Remove', 'ajdw-section-remove-' + section.id, section.id, false));

    head.appendChild(headingLabel);
    head.appendChild(headingInput);
    head.appendChild(controls);

    var textareaLabel = document.createElement('label');
    textareaLabel.className = 'ajdw-sr-only';
    textareaLabel.htmlFor = 'ajdw-section-' + section.id;
    textareaLabel.textContent = (section.heading || 'Section') + ' content';

    var textarea = document.createElement('textarea');
    textarea.className = 'ajdw-textarea ajdw-section-textarea';
    textarea.id = 'ajdw-section-' + section.id;
    textarea.rows = section.rows;
    textarea.value = section.content;
    textarea.addEventListener('input', function () {
      section.content = textarea.value;
      updatePreview();
    });

    var confirm = document.createElement('p');
    confirm.className = 'ajdw-section-confirm';
    confirm.id = 'ajdw-section-confirm-' + section.id;
    confirm.hidden = true;
    var confirmText = document.createElement('span');
    confirmText.textContent = 'Remove this section? You can undo before the next save.';
    var confirmButton = makeControl('confirm-remove', 'Remove section', 'ajdw-section-confirm-remove-' + section.id, section.id, false);
    confirmButton.className = 'ajdw-button ajdw-button--small ajdw-button--danger';
    var cancelButton = makeControl('cancel-remove', 'Keep section', 'ajdw-section-cancel-remove-' + section.id, section.id, false);
    cancelButton.className = 'ajdw-button ajdw-button--small ajdw-button--ghost';
    confirm.appendChild(confirmText);
    confirm.appendChild(confirmButton);
    confirm.appendChild(cancelButton);

    card.appendChild(head);
    card.appendChild(textareaLabel);
    card.appendChild(textarea);
    card.appendChild(confirm);
    return card;
  }

  function renderAdverts(container) {
    var title = document.createElement('h3');
    title.className = 'ajdw-results-subtitle';
    title.textContent = 'Advert variants';
    container.appendChild(title);

    var variants = [
      { key: 'standard', label: 'Standard job board (about 800 characters)', max: 800 },
      { key: 'short', label: 'Short (about 300 characters)', max: 300 },
      { key: 'social', label: 'Social (about 150 characters)', max: 150 }
    ];

    variants.forEach(function (variant) {
      var ad = currentAdverts[variant.key] || {};
      var text = asDraftText(ad.text);
      var card = document.createElement('div');
      card.className = 'ajdw-advert-card';
      var label = document.createElement('label');
      label.className = 'ajdw-section-title';
      label.htmlFor = 'ajdw-advert-' + variant.key;
      label.textContent = variant.label;
      var textarea = document.createElement('textarea');
      textarea.className = 'ajdw-textarea ajdw-advert-textarea';
      textarea.id = 'ajdw-advert-' + variant.key;
      textarea.value = text;
      textarea.rows = 3;
      var count = document.createElement('span');
      count.className = 'ajdw-char-count';
      count.id = 'ajdw-advert-count-' + variant.key;
      count.textContent = text.length + ' / ' + variant.max + ' characters';
      textarea.addEventListener('input', function () {
        count.textContent = textarea.value.length + ' / ' + variant.max + ' characters';
      });
      card.appendChild(label);
      card.appendChild(textarea);
      card.appendChild(count);
      container.appendChild(card);
    });
  }

  function toggleConfirm(sectionId, show) {
    var confirm = document.getElementById('ajdw-section-confirm-' + sectionId);
    if (confirm) { confirm.hidden = !show; }
  }

  /* T-48: name-driven Add section control beside Undo remove. Inline errors, no alert, no prompt. */
  function ajdwSectionNameTaken(name) {
    var target = String(name).trim().toLowerCase();
    var taken = false;
    jdSections.forEach(function (item) {
      if (!item) { return; }
      var heading = String(item.heading || item.label || '').trim().toLowerCase();
      if (heading === target) { taken = true; }
    });
    return taken;
  }

  function ajdwSetAddSectionError(message) {
    var error = document.getElementById('ajdw-add-section-error');
    if (!error) { return; }
    error.textContent = message ? String(message) : '';
    error.hidden = !message;
  }

  function ajdwShowAddSectionPrompt(show) {
    var bar = document.getElementById('ajdw-add-section-bar');
    var input = document.getElementById('ajdw-add-section-name');
    var openButton = document.getElementById('ajdw-add-section-open');
    ajdwSetAddSectionError('');
    if (bar) { bar.hidden = !show; }
    if (openButton) { openButton.setAttribute('aria-expanded', show ? 'true' : 'false'); }
    if (!input) { return; }
    input.value = '';
    if (show && typeof input.focus === 'function') { input.focus(); }
  }

  function addNamedSection(rawName) {
    var name = String(rawName == null ? '' : rawName).replace(/\s+/g, ' ').trim();
    if (!name) {
      ajdwSetAddSectionError('Type a section name before adding.');
      return false;
    }
    if (ajdwSectionNameTaken(name)) {
      ajdwSetAddSectionError('"' + name + '" already exists. Use a different section name.');
      return false;
    }
    var section = makeSection(nextSectionId(), name, '', 4);
    jdSections.push(section);
    ajdwSetAddSectionError('');
    ajdwShowAddSectionPrompt(false);
    renderSections();
    updatePreview();
    if (typeof ajdwSaveNow === 'function') { ajdwSaveNow(); }
    setEditorStatus('Added ' + name + ' at the end. Edit its content.', 'success');
    var textarea = document.getElementById('ajdw-section-' + section.id);
    if (textarea && typeof textarea.focus === 'function') { textarea.focus(); }
    return true;
  }

  function wireAddSectionControls() {
    var openButton = document.getElementById('ajdw-add-section-open');
    var confirmButton = document.getElementById('ajdw-add-section-confirm');
    var cancelButton = document.getElementById('ajdw-add-section-cancel');
    var nameInput = document.getElementById('ajdw-add-section-name');
    if (openButton && !openButton.getAttribute('data-ajdw-wired')) {
      openButton.setAttribute('data-ajdw-wired', '1');
      openButton.addEventListener('click', function () { ajdwShowAddSectionPrompt(true); });
    }
    if (confirmButton && !confirmButton.getAttribute('data-ajdw-wired')) {
      confirmButton.setAttribute('data-ajdw-wired', '1');
      confirmButton.addEventListener('click', function () {
        addNamedSection(nameInput ? nameInput.value : '');
      });
    }
    if (cancelButton && !cancelButton.getAttribute('data-ajdw-wired')) {
      cancelButton.setAttribute('data-ajdw-wired', '1');
      cancelButton.addEventListener('click', function () { ajdwShowAddSectionPrompt(false); });
    }
    if (nameInput && !nameInput.getAttribute('data-ajdw-wired')) {
      nameInput.setAttribute('data-ajdw-wired', '1');
      nameInput.addEventListener('keydown', function (event) {
        if (event && event.key === 'Enter') {
          event.preventDefault();
          addNamedSection(nameInput.value);
        }
      });
    }
  }

  /* T-49: the generated summary section is labelled 'Final JD summary' in the editor. */
  if (typeof renderSections === 'function') {
    var ajdwBaseRenderSections = renderSections;
    renderSections = function () {
      jdSections.forEach(function (section) {
        if (!section) { return; }
        var heading = String(section.heading || '');
        if (heading.trim().toLowerCase() === 'summary') { section.heading = 'Final JD summary'; }
      });
      return ajdwBaseRenderSections.apply(null, arguments);
    };
  }

  wireAddSectionControls();

  function addSection(typeKey) {
    var type = JD_SECTION_TYPES[0];
    JD_SECTION_TYPES.forEach(function (item) {
      if (item.key === typeKey) { type = item; }
    });
    var section = makeSection(nextSectionId(), type.label, 'New section content', type.rows);
    jdSections.push(section);
    renderSections();
    var textarea = document.getElementById('ajdw-section-' + section.id);
    if (textarea && typeof textarea.focus === 'function') { textarea.focus(); }
    setEditorStatus('Section added at the end. Edit its heading and content.', 'info');
    updatePreview();
  }

  /* T-38: swap a section with its neighbour, keep its id, refresh preview and save. */
  function moveSection(sectionId, direction) {
    var step = (direction === 'up' || direction === -1) ? -1 : 1;
    var index = indexOfSection(sectionId);
    if (index < 0) { return false; }
    var target = index + step;
    if (target < 0 || target >= jdSections.length) { return false; }
    var moved = jdSections.splice(index, 1)[0];
    jdSections.splice(target, 0, moved);
    renderSections();
    updatePreview();
    if (typeof ajdwSaveNow === 'function') { ajdwSaveNow(); }
    setEditorStatus('Moved ' + sectionDisplayName(moved) + ' ' + (step < 0 ? 'up' : 'down') + ' to position ' + (target + 1), 'info');
    var upNext = document.getElementById('ajdw-section-up-' + moved.id);
    var downNext = document.getElementById('ajdw-section-down-' + moved.id);
    var focusNext = step < 0
      ? (upNext && !upNext.disabled ? upNext : downNext)
      : (downNext && !downNext.disabled ? downNext : upNext);
    if (focusNext && typeof focusNext.focus === 'function') { focusNext.focus(); }
    return true;
  }

  /* T-85: the removal notice names the section and counts down the undo window. */
  var ajdwRemovedBarTickId = null;
  var ajdwRemovedBarCloseId = null;
  var ajdwRemovedBarName = '';
  var ajdwRemovedBarSeconds = 0;

  function ajdwRemovedBarElement() {
    var bar = document.getElementById('ajdw-section-removed-bar');
    if (bar) { return bar; }
    var status = document.getElementById('ajdw-editor-status');
    var host = (status && status.parentNode) ? status.parentNode : document.getElementById('ajdw-app-root');
    if (!host) { return null; }
    bar = document.createElement('div');
    bar.className = 'ajdw-removed-bar';
    bar.id = 'ajdw-section-removed-bar';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    bar.hidden = true;
    var text = document.createElement('span');
    text.className = 'ajdw-removed-bar-text';
    text.id = 'ajdw-section-removed-text';
    bar.appendChild(text);
    var undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'ajdw-button ajdw-button--small ajdw-removed-bar-undo';
    undo.id = 'ajdw-section-removed-undo';
    undo.textContent = 'Undo';
    undo.addEventListener('click', function () { undoRemove(); });
    bar.appendChild(undo);
    if (status && status.parentNode === host && status.nextSibling) {
      host.insertBefore(bar, status.nextSibling);
    } else {
      host.appendChild(bar);
    }
    return bar;
  }

  function ajdwRemovedBarWrite(value) {
    var bar = ajdwRemovedBarElement();
    if (!bar) { return; }
    var text = document.getElementById('ajdw-section-removed-text');
    if (!text) {
      text = document.createElement('span');
      text.className = 'ajdw-removed-bar-text';
      text.id = 'ajdw-section-removed-text';
      bar.insertBefore(text, bar.firstChild);
    }
    text.textContent = value;
  }

  function ajdwStopRemovedBar() {
    if (ajdwRemovedBarTickId) { window.clearTimeout(ajdwRemovedBarTickId); ajdwRemovedBarTickId = null; }
    if (ajdwRemovedBarCloseId) { window.clearTimeout(ajdwRemovedBarCloseId); ajdwRemovedBarCloseId = null; }
    ajdwRemovedBarSeconds = 0;
  }

  function ajdwHideRemovedBar() {
    ajdwStopRemovedBar();
    var bar = document.getElementById('ajdw-section-removed-bar');
    if (bar) { bar.hidden = true; }
  }

  function ajdwRemovedBarTick() {
    ajdwRemovedBarTickId = window.setTimeout(function () {
      ajdwRemovedBarTickId = null;
      ajdwRemovedBarSeconds -= 1;
      if (ajdwRemovedBarSeconds > 0) {
        ajdwRemovedBarWrite('Removed "' + ajdwRemovedBarName + '" \u2014 Undo (' + ajdwRemovedBarSeconds + ')');
        ajdwRemovedBarTick();
        return;
      }
      ajdwRemovedBarSeconds = 0;
      undoSnapshot = null;
      var undoBtn = document.getElementById('ajdw-section-removed-undo');
      if (undoBtn) { undoBtn.hidden = true; }
      var toolbarUndo = document.getElementById('ajdw-undo-remove');
      if (toolbarUndo) { toolbarUndo.hidden = true; }
      ajdwRemovedBarWrite('Undo window closed');
      if (ajdwRemovedBarCloseId) { window.clearTimeout(ajdwRemovedBarCloseId); }
      ajdwRemovedBarCloseId = window.setTimeout(function () {
        ajdwRemovedBarCloseId = null;
        var bar = document.getElementById('ajdw-section-removed-bar');
        if (bar) { bar.hidden = true; }
      }, 2000);
    }, 1000);
  }

  function ajdwStartRemovedBar(name) {
    var label = name || 'section';
    ajdwStopRemovedBar();
    ajdwRemovedBarName = label;
    ajdwRemovedBarSeconds = 10;
    var bar = ajdwRemovedBarElement();
    if (!bar) { return; }
    bar.hidden = false;
    var undoBtn = document.getElementById('ajdw-section-removed-undo');
    if (undoBtn) { undoBtn.hidden = false; }
    ajdwRemovedBarWrite('Removed "' + label + '" \u2014 Undo (' + ajdwRemovedBarSeconds + ')');
    ajdwRemovedBarTick();
  }

  function confirmRemoveSection(sectionId) {
    var index = indexOfSection(sectionId);
    if (index < 0) { return; }
    var removed = jdSections.splice(index, 1)[0];
    undoSnapshot = { section: removed, index: index };
    if (undoTimeoutId) {
      window.clearTimeout(undoTimeoutId);
      undoTimeoutId = null;
    }
    renderSections();
    var removedName = sectionDisplayName(removed);
    setEditorStatus('Section removed. Use Undo remove before the window closes.', 'info');
    ajdwStartRemovedBar(removedName);
  }

  function undoRemove() {
    if (!undoSnapshot) { return; }
    var snapshot = undoSnapshot;
    var restoredName = sectionDisplayName(snapshot.section);
    if (undoTimeoutId) {
      window.clearTimeout(undoTimeoutId);
      undoTimeoutId = null;
    }
    undoSnapshot = null;
    var index = snapshot.index;
    if (index > jdSections.length) { index = jdSections.length; }
    if (index < 0) { index = 0; }
    jdSections.splice(index, 0, snapshot.section);
    renderSections();
    updatePreview();
    if (typeof ajdwSaveNow === 'function') { ajdwSaveNow(); }
    setEditorStatus('Restored "' + restoredName + '"', 'success');
    ajdwHideRemovedBar();
  }

  function buildSectionPrompt(section) {
    return [
      'Rewrite one section of a job description.',
      'Respond with strict JSON only, no markdown fences.',
      'Return exactly this key: content (a plain-text string with no HTML and no markdown).',
      'Keep the tone consistent with the role brief and do not repeat the section heading inside the content.',
      'Section heading: ' + (section.heading || 'Untitled section'),
      'Role brief: ' + JSON.stringify(currentBriefValues()),
      'Current section content: ' + JSON.stringify(section.content)
    ].join('\n');
  }

  function readSectionContent(response) {
    var data = response;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (err) {
        return data;
      }
    }
    if (data == null) { return ''; }
    if (typeof data === 'string') { return data; }
    var content = data.content;
    if (content == null) { content = data.text; }
    if (Array.isArray(content)) {
      return content.map(function (item) { return asDraftText(item); }).join('\n');
    }
    return content == null ? '' : asDraftText(content);
  }

  function regenerateSection(sectionId) {
    var section = sectionById(sectionId);
    if (!section) { return; }
    var button = document.getElementById('ajdw-regenerate-' + section.id);
    if (button && button.disabled) { return; }
    if (button) {
      button.disabled = true;
      button.textContent = 'Regenerating…';
    }
    setEditorStatus('Regenerating ' + (section.heading || 'section') + '…', 'busy');
    tool.requestAI({
      prompt: buildSectionPrompt(section),
      schema: sectionResponseSchema
    }).then(function (response) {
      var text = readSectionContent(response);
      if (text && text.trim() !== '') {
        section.content = text;
        var textarea = document.getElementById('ajdw-section-' + section.id);
        if (textarea) { textarea.value = text; }
      }
      if (button) {
        button.disabled = false;
        button.textContent = 'Regenerate';
      }
      setEditorStatus('Section regenerated. Other sections were left unchanged.', 'success');
      updatePreview();
    }).catch(function () {
      if (button) {
        button.disabled = false;
        button.textContent = 'Regenerate';
      }
      setEditorStatus('Could not regenerate this section. Your draft is unchanged, try again.', 'error');
    });
  }

  function handleEditorClick(event) {
    var target = event.target;
    if (!target || typeof target.getAttribute !== 'function') { return; }
    var action = target.getAttribute('data-action');
    if (!action) { return; }
    var sectionId = target.getAttribute('data-section-id');
    if (action === 'up') { moveSection(sectionId, -1); return; }
    if (action === 'down') { moveSection(sectionId, 1); return; }
    if (action === 'remove') { toggleConfirm(sectionId, true); return; }
    if (action === 'cancel-remove') { toggleConfirm(sectionId, false); return; }
    if (action === 'confirm-remove') { confirmRemoveSection(sectionId); return; }
    if (action === 'regenerate') { regenerateSection(sectionId); return; }
  }

  function showEmptyState() {
    var main = document.getElementById('ajdw-main');
    if (!main) { return; }
    main.innerHTML = '';
    main.setAttribute('aria-live', 'polite');
    var wrap = document.createElement('div');
    wrap.className = 'ajdw-empty-state';
    wrap.id = 'ajdw-empty-state';
    var lead = document.createElement('p');
    lead.className = 'ajdw-empty-state-lead';
    lead.textContent = 'No draft yet. Here is your first step.';
    var step1 = document.createElement('p');
    step1.textContent = '1. Fill in Role title, Department, Location, Employment type, and Summary in the Role brief below.';
    var step2 = document.createElement('p');
    step2.textContent = '2. Select Generate draft to build editable sections and advert variants.';
    wrap.appendChild(lead);
    wrap.appendChild(step1);
    wrap.appendChild(step2);
    main.appendChild(wrap);
  }

  function renderSections() {
    var main = document.getElementById('ajdw-main');
    if (!main) { return; }
    if (!jdSections || jdSections.length === 0) {
      showEmptyState();
      return;
    }
    main.innerHTML = '';
    main.setAttribute('aria-live', 'polite');

    var results = document.createElement('div');
    results.className = 'ajdw-results';
    results.id = 'ajdw-editor';

    var title = document.createElement('h2');
    title.className = 'ajdw-results-title';
    title.textContent = 'Generated draft';
    results.appendChild(title);

    var hint = document.createElement('p');
    hint.className = 'ajdw-editor-hint';
    hint.textContent = 'Edit any section, reorder it with Move up and Move down, or regenerate just that section. The assembled preview updates as you type.';
    results.appendChild(hint);

    var list = document.createElement('div');
    list.className = 'ajdw-section-list';
    list.id = 'ajdw-section-list';
    jdSections.forEach(function (section, index) {
      list.appendChild(buildSectionCard(section, index));
    });
    results.appendChild(list);

    var addRow = document.createElement('div');
    addRow.className = 'ajdw-add-section';
    var addLabel = document.createElement('label');
    addLabel.className = 'ajdw-label';
    addLabel.htmlFor = 'ajdw-add-section-type';
    addLabel.textContent = 'Section type';
    var select = document.createElement('select');
    select.className = 'ajdw-select ajdw-add-section-select';
    select.id = 'ajdw-add-section-type';
    JD_SECTION_TYPES.forEach(function (type) {
      var option = document.createElement('option');
      option.value = type.key;
      option.textContent = type.label;
      select.appendChild(option);
    });
    var addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.id = 'ajdw-add-section-button';
    addButton.className = 'ajdw-button';
    addButton.textContent = 'Add section';
    addButton.addEventListener('click', function () {
      addSection(select.value);
    });
    addRow.appendChild(addLabel);
    addRow.appendChild(select);
    addRow.appendChild(addButton);
    results.appendChild(addRow);

    renderAdverts(results);

    results.addEventListener('click', handleEditorClick);
    main.appendChild(results);
    updatePreview();
  }

  function ajdwClearFieldError(event) {
    var target = event.target;
    if (!target || typeof target.getAttribute !== 'function') { return; }
    var fieldName = target.getAttribute('name');
    if (!fieldName) { return; }
    AJDW_ROLE_BRIEF_INPUTS.forEach(function (param) {
      if (param.name === fieldName) { setFieldError(param, ''); }
    });
    var state = collectState();
    if (state.missing.length === 0 && !state.salaryInvalid) { showFormError(''); }
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (runValidation()) {
      showFormError('');
      generateDraft();
    }
  });

  form.addEventListener('input', ajdwClearFieldError);
  form.addEventListener('change', ajdwClearFieldError);

  /* T-39: Before you export readiness strip. Additive: reads the draft, never writes storage. */
  var ajdwReadyTimer = null;
  var ajdwReadyCache = [];
  var ajdwLastFlags = [];
  var ajdwCheckRan = false;

  function ajdwDraftSections() {
    try {
      if (typeof jdSections !== 'undefined' && jdSections && jdSections.length) { return jdSections; }
    } catch (err) { return null; }
    return null;
  }

  function ajdwAdvertSource() {
    var value = null;
    try {
      if (typeof jdAdverts !== 'undefined' && jdAdverts) { value = jdAdverts; }
      else if (typeof advertVariants !== 'undefined' && advertVariants) { value = advertVariants; }
      else if (typeof jdAdvertVariants !== 'undefined' && jdAdvertVariants) { value = jdAdvertVariants; }
      else if (typeof adverts !== 'undefined' && adverts) { value = adverts; }
    } catch (err) { value = null; }
    return value;
  }

  function ajdwAdvertText(store, kind) {
    if (!store || kind == null) { return ''; }
    var raw = null;
    if (Array.isArray(store)) {
      store.forEach(function (entry) {
        if (!entry || raw !== null) { return; }
        var key = String(entry.kind || entry.type || entry.id || entry.name || '').toLowerCase();
        if (key === kind) {
          raw = entry.text != null ? entry.text : (entry.content != null ? entry.content : entry.value);
        }
      });
    } else if (typeof store === 'object') {
      raw = store[kind];
      if (raw && typeof raw === 'object') {
        raw = raw.text != null ? raw.text : (raw.content != null ? raw.content : null);
      }
    }
    if (raw == null || typeof raw === 'object') { return ''; }
    return Array.isArray(raw) ? raw.join('\n') : String(raw);
  }

  function ajdwReadinessBlockers() {
    var blockers = [];
    var sections = ajdwDraftSections();
    if (!sections) {
      blockers.push({ key: 'no-draft', label: 'No draft yet - generate a draft first', target: 'brief' });
      return blockers;
    }
    var empty = 0;
    var firstEmpty = null;
    sections.forEach(function (section) {
      var raw = section && section.content != null ? section.content : '';
      var text = Array.isArray(raw) ? raw.join('\n') : String(raw);
      if (text.replace(/\s+/g, '') === '') {
        empty += 1;
        if (!firstEmpty && section && section.id != null) { firstEmpty = String(section.id); }
      }
    });
    if (empty > 0) {
      blockers.push({
        key: 'empty-sections',
        label: empty === 1 ? '1 section is empty' : empty + ' sections are empty',
        target: 'section',
        sectionId: firstEmpty
      });
    }
    var store = ajdwAdvertSource();
    [['standard', 'Standard advert', 800], ['short', 'Short advert', 300], ['social', 'Social advert', 150]].forEach(function (spec) {
      var text = ajdwAdvertText(store, spec[0]);
      if (!text) { return; }
      var over = text.length - spec[2];
      if (over > 0) {
        blockers.push({
          key: 'advert-' + spec[0],
          label: spec[1] + ' is ' + over + ' ' + (over === 1 ? 'character' : 'characters') + ' over the limit',
          target: 'advert',
          kind: spec[0]
        });
      }
    });
    if (ajdwCheckRan && ajdwLastFlags.length) {
      blockers.push({
        key: 'bias-flags',
        label: ajdwLastFlags.length === 1 ? '1 bias flag needs review' : ajdwLastFlags.length + ' bias flags need review',
        target: 'bias'
      });
    }
    return blockers;
  }

  function ajdwFocusFirst(selector) {
    var node = null;
    try { node = document.querySelector(selector); } catch (err) { return false; }
    if (!node) { return false; }
    if (typeof node.scrollIntoView === 'function') {
      try { node.scrollIntoView({ block: 'center' }); } catch (err2) { node.scrollIntoView(); }
    }
    if (typeof node.focus === 'function') { node.focus(); }
    return true;
  }

  function ajdwJumpToBlocker(blocker) {
    if (!blocker) { return; }
    if (blocker.target === 'section' && blocker.sectionId) {
      ajdwJumpToFlag(blocker.sectionId, -1, 0);
      return;
    }
    if (blocker.target === 'advert') {
      var tab = document.getElementById('ajdw-tab-' + blocker.kind);
      if (tab && typeof tab.click === 'function') { tab.click(); }
      ajdwFocusFirst('#ajdw-preview-body');
      return;
    }
    if (blocker.target === 'bias') {
      var panel = document.getElementById('ajdw-check-panel');
      if (panel) { panel.hidden = false; }
      if (!ajdwFocusFirst('#ajdw-check-list .ajdw-check-link')) { ajdwFocusFirst('#ajdw-check-panel'); }
      return;
    }
    ajdwFocusFirst('#ajdw-role-title');
  }

  function ajdwRenderReadiness() {
    var list = document.getElementById('ajdw-readiness-list');
    var status = document.getElementById('ajdw-readiness-status');
    if (!list || !status) { return; }
    var blockers = ajdwReadinessBlockers();
    while (list.firstChild) { list.removeChild(list.firstChild); }
    ajdwReadyCache = blockers;
    if (!blockers.length) {
      status.textContent = 'Ready to export - no blockers found';
      status.className = 'ajdw-status ajdw-readiness-status ajdw-readiness-status--ok';
      list.hidden = true;
      return;
    }
    list.hidden = false;
    status.textContent = blockers.length === 1
      ? '1 blocker to review before you export.'
      : blockers.length + ' blockers to review before you export.';
    status.className = 'ajdw-status ajdw-readiness-status ajdw-readiness-status--warn';
    blockers.forEach(function (blocker, index) {
      var item = document.createElement('li');
      item.className = 'ajdw-readiness-item';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'ajdw-readiness-link';
      button.setAttribute('data-ajdw-blocker', String(index));
      button.textContent = blocker.label;
      item.appendChild(button);
      list.appendChild(item);
    });
  }

  function ajdwReadinessClick(event) {
    var node = event.target;
    if (!node || !node.closest) { return; }
    var button = node.closest('[data-ajdw-blocker]');
    if (!button || !button.closest('#ajdw-readiness-list')) { return; }
    var index = parseInt(button.getAttribute('data-ajdw-blocker'), 10);
    if (isNaN(index) || !ajdwReadyCache[index]) { return; }
    event.preventDefault();
    ajdwJumpToBlocker(ajdwReadyCache[index]);
  }

  function ajdwScheduleReadiness() {
    if (ajdwReadyTimer) { window.clearTimeout(ajdwReadyTimer); }
    ajdwReadyTimer = window.setTimeout(function () {
      ajdwReadyTimer = null;
      try { ajdwRenderReadiness(); } catch (err) { /* readiness is advisory; never block export */ }
    }, 120);
  }

  /* T-40: flags anchor to section id plus occurrence index, so Jump survives edits and reordering. */
  function ajdwFindPhrase(text, phrase, occurrence) {
    var haystack = text == null ? '' : String(text).toLowerCase();
    var needle = phrase ? String(phrase).toLowerCase() : '';
    if (!needle || haystack === '') { return -1; }
    var want = typeof occurrence === 'number' && occurrence >= 0 ? occurrence : 0;
    var from = 0;
    var count = 0;
    var at = haystack.indexOf(needle, from);
    while (at !== -1) {
      if (count === want) { return at; }
      count += 1;
      from = at + needle.length;
      at = haystack.indexOf(needle, from);
    }
    return -1;
  }

  function ajdwSectionTextById(sectionId) {
    var id = String(sectionId);
    var blocks = ajdwCollectBlocks();
    for (var i = 0; i < blocks.length; i += 1) {
      if (blocks[i].id === id) { return blocks[i].text; }
    }
    var field = document.getElementById('ajdw-section-' + id) || document.getElementById(id);
    if (field && typeof field.value === 'string') { return field.value; }
    return null;
  }

  function ajdwPhrasePresent(flag) {
    if (!flag) { return false; }
    /* T-69: a flag is present only while its own snippet still exists inside its own section. */
    var phrase = flag.phrase || flag.term || flag.snippet || '';
    if (!phrase) { return true; }
    var live = null;
    try { live = ajdwSectionTextById(flag.sectionId); } catch (err) { live = null; }
    if (live == null) { return false; }
    return ajdwFindPhrase(live, phrase, flag.occurrence) >= 0;
  }

  function ajdwCheckListClick(event) {
    var node = event.target;
    if (!node || !node.closest) { return; }
    var link = node.closest('.ajdw-check-link');
    if (!link || !link.closest('#ajdw-check-list')) { return; }
    if (link.disabled) { return; }
    var sectionId = link.getAttribute('data-section-id');
    if (!sectionId) { return; }
    var phrase = link.getAttribute('data-phrase') || '';
    var occurrence = parseInt(link.getAttribute('data-occurrence'), 10);
    if (isNaN(occurrence)) { occurrence = 0; }
    /* T-69: resolve by section id first; a removed section must never throw. */
    var target = null;
    try { target = document.getElementById('ajdw-section-' + sectionId); } catch (err) { target = null; }
    if (!target) { try { target = document.getElementById(sectionId); } catch (err1) { target = null; } }
    if (!target && typeof ajdwFindSectionElement === 'function') {
      try { target = ajdwFindSectionElement(sectionId); } catch (err2) { target = null; }
    }
    if (!target) {
      try { ajdwDropStaleFlags(); } catch (err3) { /* stale flags are advisory */ }
      try { setEditorStatus('That section is gone. Re-run the check.', 'warn'); } catch (err4) { /* status is advisory */ }
      return;
    }
    var text = null;
    try { text = ajdwSectionTextById(sectionId); } catch (err5) { text = null; }
    var found = -1;
    if (phrase) { found = ajdwFindPhrase(text, phrase, occurrence); }
    if (phrase && found < 0) {
      try { setEditorStatus('That phrase is no longer in this section. Re-check the draft.', 'warn'); } catch (err6) { /* status is advisory */ }
      return;
    }
    if (event && typeof event.stopImmediatePropagation === 'function') {
      try { event.stopImmediatePropagation(); } catch (err7) { /* optional */ }
    }
    try { ajdwJumpToFlag(sectionId, found, phrase ? phrase.length : 0, phrase, occurrence); } catch (err8) { /* jump is advisory, never throw */ }
  }

  /* T-47: any inline edit, reorder, add, remove or regeneration marks results out of date. */
  function ajdwInitStaleWatch() {
    var root = document.getElementById('ajdw-app-root') || document.body;
    if (!root || !root.addEventListener) { return; }
    root.addEventListener('input', function (event) {
      var node = event.target;
      if (!node || !node.id) { return; }
      if (node.id.indexOf('ajdw-section-') === 0) { ajdwMarkCheckStale(); }
    }, true);
    root.addEventListener('click', function (event) {
      var node = event.target;
      if (!node || !node.closest) { return; }
      var control = node.closest('[data-action]');
      if (!control) { return; }
      var action = control.getAttribute('data-action');
      if (action === 'up' || action === 'down' || action === 'regenerate' ||
          action === 'confirm-remove' || action === 'add') {
        ajdwMarkCheckStale();
      }
    }, true);
  }

  /* T-46: export asks for a flagged-language acknowledgement first. */
  function ajdwHighSeverityFlags() {
    if (!ajdwLastFlags || !ajdwLastFlags.length) { return []; }
    return ajdwLastFlags.filter(function (flag) {
      if (!flag) { return false; }
      return flag.severity === 'high' || flag.kind === 'bias' || flag.type === 'bias';
    });
  }

  function ajdwExportGateNeeded() {
    if (ajdwExportAck) { return false; }
    if (!ajdwCheckRan) { return false; }
    if (ajdwCheckStale) { return true; }
    return ajdwHighSeverityFlags().length > 0;
  }

  function ajdwHideExportGate() {
    var gate = document.getElementById('ajdw-export-gate');
    if (gate && gate.parentNode) { gate.parentNode.removeChild(gate); }
  }

  function ajdwShowExportGate(button) {
    ajdwHideExportGate();
    var gate = document.createElement('div');
    gate.className = 'ajdw-export-gate';
    gate.id = 'ajdw-export-gate';
    gate.setAttribute('role', 'alertdialog');
    var text = document.createElement('p');
    text.className = 'ajdw-export-gate-text';
    var count = ajdwHighSeverityFlags().length;
    text.textContent = count
      ? 'Review flagged language before exporting. ' + ajdwCountLabel(count, 'high-severity flag is', 'high-severity flags are') + ' still open.'
      : 'Results are out of date. Recheck the draft, or confirm you have reviewed the flagged language.';
    var confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'ajdw-button ajdw-export-gate-confirm';
    confirm.textContent = 'I have reviewed the flagged language - continue export';
    confirm.addEventListener('click', function () {
      ajdwExportAck = true;
      ajdwHideExportGate();
      if (button && typeof button.click === 'function') { button.click(); }
    });
    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'ajdw-button ajdw-export-gate-cancel';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', function () { ajdwHideExportGate(); });
    gate.appendChild(text);
    gate.appendChild(confirm);
    gate.appendChild(cancel);
    var host = button && button.parentNode ? button.parentNode : (document.getElementById('ajdw-app-root') || document.body);
    if (host) { host.appendChild(gate); }
    if (typeof confirm.focus === 'function') { confirm.focus(); }
  }

  function ajdwInitExportGate() {
    var root = document.getElementById('ajdw-app-root') || document.body;
    if (!root || !root.addEventListener) { return; }
    root.addEventListener('click', function (event) {
      var node = event.target;
      if (!node || !node.closest) { return; }
      var button = node.closest('button, a');
      if (!button) { return; }
      if (button.closest('#ajdw-export-gate')) { return; }
      var inExport = button.closest('.ajdw-export-row, .ajdw-export-controls, .ajdw-export-bar, #ajdw-export-bar, #ajdw-export-row, [data-action="export"]');
      if (!inExport && !(button.id && button.id.indexOf('ajdw-export') === 0)) { return; }
      if (!ajdwExportGateNeeded()) { return; }
      event.preventDefault();
      event.stopPropagation();
      ajdwShowExportGate(button);
    }, true);
  }

  function ajdwInitReadiness() {
    ajdwRenderReadiness();
    ajdwInitStaleWatch();
    ajdwInitExportGate();
    var list = document.getElementById('ajdw-readiness-list');
    if (list) { list.addEventListener('click', ajdwReadinessClick); }
    var checkList = document.getElementById('ajdw-check-list');
    if (checkList) { checkList.addEventListener('click', ajdwCheckListClick); }
    var root = document.getElementById('ajdw-app-root') || document.body;
    if (root && typeof MutationObserver === 'function') {
      var observer = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i += 1) {
          var target = records[i].target;
          var el = target && target.nodeType === 1 ? target : (target ? target.parentElement : null);
          if (el && el.closest && el.closest('#ajdw-readiness')) { continue; }
          ajdwScheduleReadiness();
          return;
        }
      });
      observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true });
    }
    ['input', 'change', 'click'].forEach(function (name) {
      document.addEventListener(name, function (event) {
        var node = event.target;
        if (node && node.closest && node.closest('#ajdw-readiness')) { return; }
        ajdwScheduleReadiness();
      }, true);
    });
    ajdwScheduleReadiness();
  }

  ajdwInitReadiness();

  var AJDW_BIAS_TERMS = [
    'rockstar', 'rock star', 'ninja', 'guru', 'he/she', 'he or she', 's/he',
    'candidate must', 'must have', 'manpower', 'salesman', 'digital native',
    'young and energetic', 'work hard play hard', 'culture fit'
  ];

  var ajdwFlagTimer = null;

  function ajdwSyllables(word) {
    var text = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (text === '') { return 0; }
    if (text.length <= 3) { return 1; }
    text = text.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    text = text.replace(/^y/, '');
    var groups = text.match(/[aeiouy]{1,2}/g);
    return groups && groups.length ? groups.length : 1;
  }

  function ajdwCollectBlocks() {
    var blocks = [];
    if (typeof jdSections !== 'undefined' && jdSections && jdSections.length) {
      jdSections.forEach(function (section) {
        var raw = section && section.content != null ? section.content : '';
        var text = Array.isArray(raw) ? raw.join('\n') : String(raw);
        if (text.replace(/\s+/g, '') !== '') {
          blocks.push({
            id: String(section.id),
            heading: section.heading || 'Section',
            text: text
          });
        }
      });
    }
    if (blocks.length === 0) {
      ['ajdw-summary', 'ajdw-duties', 'ajdw-requirements', 'ajdw-company-context'].forEach(function (id) {
        var field = document.getElementById(id);
        if (!field) { return; }
        var value = String(field.value || '');
        if (value.replace(/\s+/g, '') !== '') {
          blocks.push({ id: id, heading: id.replace('ajdw-', '').replace(/-/g, ' '), text: value });
        }
      });
    }
    return blocks;
  }

  function ajdwCountLabel(count, singular, plural) {
    return count + ' ' + (count === 1 ? singular : plural);
  }

  function ajdwTruncate(text, limit) {
    var value = String(text || '');
    if (value.length <= limit) { return value; }
    return value.slice(0, limit - 1) + '…';
  }

  function ajdwJumpToFlag(sectionId, index, length, phrase, occurrence) {
    if (!sectionId) { return; }
    /* T-58: resolve by section id, then recompute the offset against live text so renames, reorders and edits cannot misplace the jump. */
    /* T-69: every lookup is guarded, so a removed section returns quietly instead of throwing. */
    var field = null;
    try { field = document.getElementById('ajdw-section-' + sectionId); } catch (errA) { field = null; }
    if (!field) { try { field = document.getElementById(sectionId); } catch (errB) { field = null; } }
    if (!field && typeof ajdwFindSectionElement === 'function') {
      try { field = ajdwFindSectionElement(sectionId); } catch (errC) { field = null; }
    }
    if (!field) { return false; }
    if (typeof field.value === 'string' && phrase && typeof ajdwFindPhrase === 'function') {
      var live = ajdwFindPhrase(field.value, phrase, occurrence);
      if (live >= 0) {
        index = live;
        length = String(phrase).length;
      } else {
        index = -1;
        length = 0;
      }
    }
    var hit = field;
    if (typeof field.closest === 'function') {
      var card = field.closest('.ajdw-section-card');
      if (card) { hit = card; }
    }
    var previous = document.querySelectorAll('.ajdw-flag-hit');
    for (var i = 0; i < previous.length; i += 1) {
      previous[i].classList.remove('ajdw-flag-hit');
    }
    hit.classList.add('ajdw-flag-hit');
    if (ajdwFlagTimer) { window.clearTimeout(ajdwFlagTimer); }
    ajdwFlagTimer = window.setTimeout(function () {
      hit.classList.remove('ajdw-flag-hit');
      ajdwFlagTimer = null;
    }, 3000);
    if (typeof hit.scrollIntoView === 'function') {
      try { hit.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (err) { hit.scrollIntoView(); }
    }
    if (typeof field.focus === 'function') { field.focus(); }
    if (typeof field.setSelectionRange === 'function' && typeof index === 'number' && index >= 0) {
      try { field.setSelectionRange(index, index + (typeof length === 'number' ? length : 0)); } catch (err2) { /* not selectable */ }
    }
  }

  function ajdwRenderCheck(result) {
    ajdwCheckRan = true;
    ajdwLastFlags = result && result.flags ? result.flags.slice() : [];
    var panel = document.getElementById('ajdw-check-panel');
    var gradeEl = document.getElementById('ajdw-check-grade');
    var statusEl = document.getElementById('ajdw-check-status');
    var list = document.getElementById('ajdw-check-list');
    if (panel) { panel.hidden = false; }
    if (gradeEl) {
      gradeEl.textContent = result.grade == null
        ? 'Readability grade: add draft text to score.'
        : 'Readability grade: ' + result.grade;
    }
    if (list) {
      while (list.firstChild) { list.removeChild(list.firstChild); }
      result.flags.forEach(function (flag) {
        var item = document.createElement('li');
        item.className = 'ajdw-check-item';
        var present = ajdwPhrasePresent(flag);
        var link = document.createElement('button');
        link.type = 'button';
        link.className = 'ajdw-check-link';
        link.setAttribute('data-section-id', String(flag.sectionId));
        link.setAttribute('data-occurrence', String(typeof flag.occurrence === 'number' ? flag.occurrence : 0));
        link.setAttribute('data-phrase', String(flag.phrase || flag.term || ''));
        var meta = ajdwFlagMeta(flag);
        link.textContent = flag.label;
        if (meta.heading) {
          var sectionNote = document.createElement('span');
          sectionNote.className = 'ajdw-flag-section';
          sectionNote.textContent = ' — ' + meta.heading;
          link.appendChild(sectionNote);
        }
        if (meta.excerpt) {
          var excerptNote = document.createElement('span');
          excerptNote.className = 'ajdw-flag-excerpt';
          excerptNote.textContent = ' “' + meta.excerpt + '”';
          link.appendChild(excerptNote);
        }
        if (!present) { link.disabled = true; }
        item.appendChild(link);
        if (!present) {
          var gone = document.createElement('span');
          gone.className = 'ajdw-flag-stale';
          gone.textContent = 'phrase no longer found';
          item.appendChild(gone);
          var rerun = document.createElement('button');
          rerun.type = 'button';
          rerun.className = 'ajdw-button ajdw-button--small ajdw-button--ghost ajdw-rerun-check';
          rerun.textContent = 'Re-run check';
          rerun.addEventListener('click', function () { ajdwRunCheck(); });
          item.appendChild(rerun);
        }
        list.appendChild(item);
      });
      if (result.flags.length === 0) {
        var ok = document.createElement('li');
        ok.className = 'ajdw-check-item ajdw-check-item--ok';
        ok.textContent = 'No biased terms or long sentences found.';
        list.appendChild(ok);
      }
    }
    if (statusEl) { statusEl.textContent = result.summary; }
  }

  function ajdwRunCheck() {
    var blocks = ajdwCollectBlocks();
    var biased = [];
    var longSentences = [];
    var wordCount = 0;
    var sentenceCount = 0;
    var syllableCount = 0;

    blocks.forEach(function (block) {
      var text = block.text || '';
      var lower = text.toLowerCase();
      AJDW_BIAS_TERMS.forEach(function (term) {
        var from = 0;
        var occurrence = 0;
        var at = lower.indexOf(term, from);
        while (at !== -1) {
          /* T-40: anchor to section id plus occurrence index, not a whole-draft character offset. */
          biased.push({
            sectionId: block.id,
            heading: block.heading,
            term: term,
            phrase: term,
            occurrence: occurrence,
            index: at,
            length: term.length
          });
          from = at + term.length;
          occurrence += 1;
          at = lower.indexOf(term, from);
        }
      });
      var pattern = /[^.!?\n]+[.!?]*/g;
      var match = pattern.exec(text);
      while (match !== null) {
        var raw = match[0];
        var trimmed = raw.replace(/^\s+/, '').replace(/\s+$/, '');
        if (trimmed !== '') {
          var start = match.index + raw.indexOf(trimmed);
          var wordsInSentence = 0;
          trimmed.split(/\s+/).forEach(function (part) {
            if (/[A-Za-z0-9]/.test(part)) {
              wordsInSentence += 1;
              syllableCount += ajdwSyllables(part);
            }
          });
          wordCount += wordsInSentence;
          sentenceCount += 1;
          if (wordsInSentence > 25) {
            /* T-69: anchor to section id plus the flagged snippet and its occurrence index. */
            var occ = 0;
            var lowerText = text.toLowerCase();
            var lowerSnippet = trimmed.toLowerCase();
            var scan = lowerText.indexOf(lowerSnippet);
            while (scan !== -1 && scan < start) {
              occ += 1;
              scan = lowerText.indexOf(lowerSnippet, scan + lowerSnippet.length);
            }
            longSentences.push({
              sectionId: block.id,
              heading: block.heading,
              words: wordsInSentence,
              text: trimmed,
              snippet: trimmed,
              occurrence: occ,
              index: start,
              length: trimmed.length
            });
          }
        }
        match = pattern.exec(text);
      }
    });

    var grade = null;
    if (wordCount > 0 && sentenceCount > 0) {
      var score = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount);
      grade = Math.round(score * 10) / 10;
    }

    var flags = [];
    /* T-69: each flag carries its section id plus the flagged snippet, never a document-level offset. */
    biased.forEach(function (item) {
      flags.push({
        sectionId: item.sectionId,
        heading: item.heading,
        phrase: item.term,
        snippet: item.term,
        occurrence: item.occurrence,
        index: item.index,
        length: item.length,
        label: 'Biased term: "' + item.term + '" in ' + item.heading
      });
    });
    longSentences.forEach(function (item) {
      flags.push({
        sectionId: item.sectionId,
        heading: item.heading,
        phrase: item.snippet || item.text,
        snippet: item.snippet || item.text,
        occurrence: item.occurrence,
        index: item.index,
        length: item.length,
        label: 'Long sentence (' + item.words + ' words) in ' + item.heading + ': "' + ajdwTruncate(item.text, 70) + '"'
      });
    });

    var summary;
    if (wordCount === 0) {
      summary = 'No draft text to check yet. Generate a draft or type into a section first.';
    } else if (biased.length === 0 && longSentences.length === 0) {
      summary = 'No biased terms and no long sentences found.';
    } else {
      summary = ajdwCountLabel(biased.length, 'biased term', 'biased terms') + ' and ' +
        ajdwCountLabel(longSentences.length, 'long sentence', 'long sentences') + ' found.';
    }

    ajdwRenderCheck({ grade: grade, flags: flags, summary: summary });
    return summary;
  }

  (function () {
    var checkButton = document.getElementById('ajdw-check-draft');
    if (checkButton) {
      checkButton.addEventListener('click', function () {
        ajdwRunCheck();
      });
    }
    var checkList = document.getElementById('ajdw-check-list');
    if (checkList) {
      checkList.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || typeof target.getAttribute !== 'function') { return; }
        var sectionId = target.getAttribute('data-section-id');
        if (!sectionId) { return; }
        var index = parseInt(target.getAttribute('data-index'), 10);
        var length = parseInt(target.getAttribute('data-length'), 10);
        ajdwJumpToFlag(sectionId, isNaN(index) ? -1 : index, isNaN(length) ? 0 : length);
      });
    }
  })();

  var undoRemoveButton = document.getElementById('ajdw-undo-remove');
  if (undoRemoveButton) {
    undoRemoveButton.addEventListener('click', function () {
      undoRemove();
    });
  }

  /* --- T-20: move a section up or down without changing its id --- */
  function ajdwCloneJson(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (err) {
      return value;
    }
  }

  function ajdwMoveSection(sectionId, direction) {
    var index = indexOfSection(sectionId);
    if (index < 0) { return; }
    var target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= jdSections.length) { return; }
    var moved = jdSections.splice(index, 1)[0];
    jdSections.splice(target, 0, moved);
    renderSections();
    updatePreview();
    if (typeof ajdwSaveNow === 'function') { ajdwSaveNow(); }
    /* T-38: status line names the section and its new position; ids stay unchanged. */
    setEditorStatus('Moved ' + sectionDisplayName(moved) + ' ' + (direction === 'up' ? 'up' : 'down') + ' to position ' + (target + 1), 'info');
    /* T-68: focus stays on the moved section header so a keyboard user keeps their place. */
    var headEl = document.getElementById('ajdw-section-head-' + sectionId);
    if (headEl && typeof headEl.focus === 'function') {
      try { headEl.focus(); } catch (err) { /* focus is advisory */ }
    } else {
      var headingField = document.getElementById('ajdw-section-heading-' + sectionId);
      if (headingField && typeof headingField.focus === 'function') { headingField.focus(); }
    }
  }

  /* --- T-21: clear draft with in-place confirmation and 8 second undo --- */
  var ajdwDraftUndo = null;
  var ajdwDraftUndoTimer = null;
  var ajdwClearButtonEl = null;

  function ajdwRemoveInlineUndo() {
    var text = document.getElementById('ajdw-editor-status-text');
    if (!text) { return; }
    var stale = text.querySelector ? text.querySelector('.ajdw-inline-undo') : null;
    if (stale && stale.parentNode) { stale.parentNode.removeChild(stale); }
  }

  function ajdwShowDraftUndo() {
    var status = document.getElementById('ajdw-editor-status');
    var text = document.getElementById('ajdw-editor-status-text');
    if (!status || !text) { return; }
    status.hidden = false;
    status.className = 'ajdw-status ajdw-editor-status ajdw-status--success';
    text.textContent = 'Draft removed. ';
    var undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'ajdw-button ajdw-button--small ajdw-button--ghost ajdw-inline-undo';
    undo.id = 'ajdw-clear-draft-undo';
    undo.textContent = 'Undo';
    undo.setAttribute('aria-label', 'Undo draft removal');
    undo.addEventListener('click', function () { ajdwUndoClearDraft(); });
    text.appendChild(undo);
  }

  function ajdwUndoClearDraft() {
    if (!ajdwDraftUndo) { return; }
    jdSections = ajdwDraftUndo.sections;
    currentAdverts = ajdwDraftUndo.adverts || {};
    ajdwDraftUndo = null;
    if (ajdwDraftUndoTimer) {
      window.clearTimeout(ajdwDraftUndoTimer);
      ajdwDraftUndoTimer = null;
    }
    renderSections();
    updatePreview();
    if (typeof ajdwSaveNow === 'function') { ajdwSaveNow(); }
    setEditorStatus('Draft restored.', 'success');
  }

  function ajdwCancelClearDraft() {
    var row = document.getElementById('ajdw-clear-confirm');
    if (row && row.parentNode) { row.parentNode.removeChild(row); }
    if (ajdwClearButtonEl) { ajdwClearButtonEl.hidden = false; }
    setEditorStatus('Clear cancelled. Nothing changed.', 'info');
  }

  function ajdwDoClearDraft() {
    ajdwDraftUndo = {
      sections: ajdwCloneJson(jdSections),
      adverts: ajdwCloneJson(currentAdverts || {})
    };
    jdSections = [];
    currentAdverts = {};
    var row = document.getElementById('ajdw-clear-confirm');
    if (row && row.parentNode) { row.parentNode.removeChild(row); }
    if (ajdwClearButtonEl) { ajdwClearButtonEl.hidden = false; }
    renderSections();
    updatePreview();
    if (typeof ajdwSaveNow === 'function') { ajdwSaveNow(); }
    ajdwShowDraftUndo();
    if (ajdwDraftUndoTimer) { window.clearTimeout(ajdwDraftUndoTimer); }
    ajdwDraftUndoTimer = window.setTimeout(function () {
      ajdwDraftUndoTimer = null;
      ajdwDraftUndo = null;
      ajdwRemoveInlineUndo();
      var text = document.getElementById('ajdw-editor-status-text');
      if (text) { text.textContent = 'Draft removed.'; }
    }, 8000);
  }

  function ajdwAskClearDraft(button) {
    if (document.getElementById('ajdw-clear-confirm')) { return; }
    ajdwClearButtonEl = button || null;
    var row = document.createElement('span');
    row.className = 'ajdw-confirm-row';
    row.id = 'ajdw-clear-confirm';
    var question = document.createElement('span');
    question.className = 'ajdw-confirm-text';
    question.textContent = 'Remove this draft? ';
    var removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'ajdw-button ajdw-button--small ajdw-button--danger';
    removeButton.id = 'ajdw-clear-confirm-remove';
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', function () { ajdwDoClearDraft(); });
    var cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'ajdw-button ajdw-button--small ajdw-button--ghost';
    cancelButton.id = 'ajdw-clear-confirm-cancel';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', function () { ajdwCancelClearDraft(); });
    row.appendChild(question);
    row.appendChild(removeButton);
    row.appendChild(cancelButton);
    if (button && button.parentNode) {
      button.parentNode.insertBefore(row, button.nextSibling);
      button.hidden = true;
    } else {
      var status = document.getElementById('ajdw-editor-status');
      if (status && status.parentNode) { status.parentNode.insertBefore(row, status.nextSibling); }
    }
    setEditorStatus('Confirm removal of this draft. Nothing is deleted yet.', 'warn');
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || typeof target.closest !== 'function') { return; }
    var button = target.closest('button');
    if (!button) { return; }
    var action = button.getAttribute('data-action');
    if (action === 'up' || action === 'down') {
      var sectionId = button.getAttribute('data-section-id');
      if (!sectionId) { return; }
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') { event.stopImmediatePropagation(); }
      event.stopPropagation();
      ajdwMoveSection(sectionId, action);
      return;
    }
    if (button.closest('#ajdw-clear-confirm')) { return; }
    var buttonId = button.id || '';
    var buttonText = (button.textContent || '').replace(/\s+/g, ' ').trim();
    if (buttonId === 'ajdw-clear-draft' || buttonText === 'Clear draft') {
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') { event.stopImmediatePropagation(); }
      event.stopPropagation();
      ajdwAskClearDraft(button);
    }
  }, true);

  AJDW_ROLE_BRIEF_INPUTS.forEach(function (param) {
    var field = getField(param);
    if (!field) { return; }
    var eventName = field.tagName === 'SELECT' ? 'change' : 'input';
    field.addEventListener(eventName, function () {
      if (param.required && field.value.trim() === '') {
        return;
      }
      if (param.name === 'salary' && !isSalaryValid(field.value)) {
        setFieldError(param, 'Enter a number or range like 60000 or 60000-70000.');
        refreshStatus();
        return;
      }
      setFieldError(param, '');
      refreshStatus();
    });
  });
});

/* --- T-06: preview tabs, copy and export --- */
var AJDW_TAB_CONFIG = {
  jd: { label: 'Job description', limit: 0 },
  standard: { label: 'Standard advert', limit: 800 },
  short: { label: 'Short advert', limit: 300 },
  social: { label: 'Social post', limit: 150 }
};
var AJDW_EXPORT_FORMATS = {
  text: { label: 'text', ext: 'txt', mime: 'text/plain;charset=utf-8' },
  markdown: { label: 'Markdown', ext: 'md', mime: 'text/markdown;charset=utf-8' },
  html: { label: 'HTML', ext: 'html', mime: 'text/html;charset=utf-8' }
};
var AJDW_STYLES = {
  body: 'font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#1d2a35;background:#ffffff;margin:0;padding:20px;',
  h1: 'font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1.25;color:#14263a;margin:0 0 14px;',
  h2: 'font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.3;color:#14263a;margin:20px 0 8px;',
  p: 'margin:0 0 12px;',
  ul: 'margin:0 0 12px;padding-left:22px;',
  li: 'margin:0 0 6px;'
};
var ajdwActivePreviewTab = 'jd';
var ajdwPreviewReady = false;

function ajdwEl(id) {
  return document.getElementById(id);
}

function ajdwFieldValue(id) {
  var el = ajdwEl(id);
  return el && typeof el.value === 'string' ? el.value : '';
}

function ajdwEscapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ajdwToLines(value) {
  return String(value || '').split(/\r?\n/).map(function (line) {
    return line.replace(/^\s*[-*\u2022]\s*/, '').trim();
  }).filter(function (line) { return line !== ''; });
}

function ajdwToParagraphs(value) {
  return String(value || '').split(/\n+/).map(function (part) { return part.trim(); }).filter(function (part) { return part !== ''; });
}

function ajdwReadDraftState() {
  return {
    roleTitle: String(ajdwFieldValue('ajdw-role-title')).trim(),
    department: String(ajdwFieldValue('ajdw-department')).trim(),
    location: String(ajdwFieldValue('ajdw-location')).trim(),
    employmentType: String(ajdwFieldValue('ajdw-employment-type')).trim(),
    salary: String(ajdwFieldValue('ajdw-salary')).trim(),
    summary: ajdwFieldValue('ajdw-section-summary'),
    responsibilities: ajdwFieldValue('ajdw-section-responsibilities'),
    requirements: ajdwFieldValue('ajdw-section-requirements'),
    companyContext: ajdwFieldValue('ajdw-section-companyContext'),
    adverts: {
      standard: ajdwFieldValue('ajdw-advert-standard'),
      short: ajdwFieldValue('ajdw-advert-short'),
      social: ajdwFieldValue('ajdw-advert-social')
    }
  };
}

function ajdwHasDraft(draft) {
  if (!draft) { return false; }
  var chunks = [draft.summary, draft.responsibilities, draft.requirements, draft.companyContext, draft.adverts.standard, draft.adverts.short, draft.adverts.social];
  return chunks.join('').replace(/\s+/g, '') !== '';
}

function ajdwBuildModel(tab) {
  var draft = ajdwReadDraftState();
  var key = AJDW_TAB_CONFIG[tab] ? tab : 'jd';
  var config = AJDW_TAB_CONFIG[key];
  var model = { title: draft.roleTitle || 'Job description', tab: key, tabLabel: config.label, limit: config.limit, characters: 0, sections: [] };
  if (key === 'jd') {
    var meta = [draft.department, draft.location, draft.employmentType, draft.salary].filter(function (value) { return value !== ''; });
    if (meta.length > 0) {
      model.sections.push({ heading: '', paragraphs: [meta.join(' | ')], bullets: [] });
    }
    model.sections.push({ heading: 'Summary', paragraphs: ajdwToParagraphs(draft.summary), bullets: [] });
    model.sections.push({ heading: 'Responsibilities', paragraphs: [], bullets: ajdwToLines(draft.responsibilities) });
    model.sections.push({ heading: 'Requirements', paragraphs: [], bullets: ajdwToLines(draft.requirements) });
    model.sections.push({ heading: 'Company context', paragraphs: ajdwToParagraphs(draft.companyContext), bullets: [] });
  } else {
    var text = draft.adverts[key] || '';
    model.characters = text.length;
    model.title = draft.roleTitle ? draft.roleTitle + ' - ' + config.label : config.label;
    model.sections.push({ heading: '', paragraphs: ajdwToParagraphs(text), bullets: [] });
  }
  model.sections = model.sections.filter(function (section) {
    return section.paragraphs.length > 0 || section.bullets.length > 0;
  });
  return model;
}

function ajdwModelToText(model) {
  var lines = [model.title, ''];
  model.sections.forEach(function (section) {
    if (section.heading) { lines.push(section.heading.toUpperCase(), ''); }
    section.paragraphs.forEach(function (paragraph) { lines.push(paragraph, ''); });
    section.bullets.forEach(function (bullet) { lines.push('- ' + bullet); });
    if (section.bullets.length > 0) { lines.push(''); }
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
}

function ajdwModelToMarkdown(model) {
  var lines = ['# ' + model.title, ''];
  model.sections.forEach(function (section) {
    if (section.heading) { lines.push('## ' + section.heading, ''); }
    section.paragraphs.forEach(function (paragraph) { lines.push(paragraph, ''); });
    section.bullets.forEach(function (bullet) { lines.push('- ' + bullet); });
    if (section.bullets.length > 0) { lines.push(''); }
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
}

function ajdwModelToHtmlBody(model) {
  var parts = ['<h1 style="' + AJDW_STYLES.h1 + '">' + ajdwEscapeHtml(model.title) + '</h1>'];
  model.sections.forEach(function (section) {
    if (section.heading) {
      parts.push('<h2 style="' + AJDW_STYLES.h2 + '">' + ajdwEscapeHtml(section.heading) + '</h2>');
    }
    section.paragraphs.forEach(function (paragraph) {
      parts.push('<p style="' + AJDW_STYLES.p + '">' + ajdwEscapeHtml(paragraph).replace(/\n/g, '<br>') + '</p>');
    });
    if (section.bullets.length > 0) {
      var items = section.bullets.map(function (bullet) {
        return '<li style="' + AJDW_STYLES.li + '">' + ajdwEscapeHtml(bullet) + '</li>';
      });
      parts.push('<ul style="' + AJDW_STYLES.ul + '">' + items.join('') + '</ul>');
    }
  });
  return parts.join('');
}

function ajdwModelToHtmlDocument(model) {
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + ajdwEscapeHtml(model.title) + '</title>',
    '</head>',
    '<body style="' + AJDW_STYLES.body + '">',
    ajdwModelToHtmlBody(model),
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

function ajdwSetExportStatus(message) {
  var status = ajdwEl('ajdw-export-status');
  if (status) { status.textContent = message; }
}

function ajdwRenderPreview() {
  var section = ajdwEl('ajdw-preview');
  var body = ajdwEl('ajdw-preview-body');
  if (!section || !body) { return; }
  var draft = ajdwReadDraftState();
  if (!ajdwHasDraft(draft)) { return; }
  var model = ajdwBuildModel(ajdwActivePreviewTab);
  var meta = ajdwEl('ajdw-preview-meta');
  if (meta) {
    if (model.limit > 0) {
      var over = model.characters > model.limit;
      meta.textContent = model.tabLabel + ': ' + model.characters + ' / ' + model.limit + ' characters' + (over ? ' - over limit by ' + (model.characters - model.limit) + '.' : '.');
      meta.setAttribute('data-ajdw-over', over ? '1' : '0');
      if (over) { meta.classList.add('ajdw-counter--over'); } else { meta.classList.remove('ajdw-counter--over'); }
    } else {
      /* T-35: the Job description view never shows a character counter. */
      meta.textContent = 'Job description: ' + model.sections.length + ' sections from the current draft.';
      meta.setAttribute('data-ajdw-over', '0');
      meta.classList.remove('ajdw-counter--over');
    }
  }
  ajdwUpdateExportLabels();
  ajdwUpdateCounters();
  ajdwRenderPreviewInto(body, model);
  section.hidden = false;
}

function ajdwSetTab(tab) {
  ajdwActivePreviewTab = AJDW_TAB_CONFIG[tab] ? tab : 'jd';
  var buttons = document.querySelectorAll('[data-ajdw-tab]');
  Array.prototype.forEach.call(buttons, function (button) {
    var isActive = button.getAttribute('data-ajdw-tab') === ajdwActivePreviewTab;
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    if (isActive) { button.classList.add('ajdw-tab--active'); } else { button.classList.remove('ajdw-tab--active'); }
  });
  /* T-34 / T-35: labels and counters follow the active view, the draft text itself is untouched. */
  ajdwUpdateExportLabels();
  ajdwUpdateCounters();
  ajdwRenderPreview();
}

function ajdwCurrentFormat() {
  var select = ajdwEl('ajdw-export-format');
  var value = select ? String(select.value) : 'text';
  return AJDW_EXPORT_FORMATS[value] ? value : 'text';
}

function ajdwBuildExport(format) {
  var model = ajdwBuildModel(ajdwActivePreviewTab);
  if (format === 'markdown') { return ajdwModelToMarkdown(model); }
  if (format === 'html') { return ajdwModelToHtmlDocument(model); }
  return ajdwModelToText(model);
}

function ajdwShowManualCopy(text, message) {
  var fallback = ajdwEl('ajdw-copy-fallback');
  if (fallback) {
    fallback.hidden = false;
    fallback.value = text;
    try {
      fallback.focus();
      fallback.select();
      if (typeof fallback.setSelectionRange === 'function') { fallback.setSelectionRange(0, text.length); }
    } catch (error) { /* selection is best effort */ }
  }
  ajdwSetExportStatus(message);
}

function ajdwCopyCurrent() {
  var format = ajdwCurrentFormat();
  var text = ajdwBuildExport(format);
  var label = AJDW_EXPORT_FORMATS[format].label;
  var manualMessage = 'Clipboard is not available here. The ' + label + ' copy is selected below - press Ctrl+C (Cmd+C on Mac) to copy it.';
  var clipboard = (typeof navigator !== 'undefined' && navigator) ? navigator.clipboard : null;
  function onCopied() {
    var fallback = ajdwEl('ajdw-copy-fallback');
    if (fallback) { fallback.hidden = true; fallback.value = ''; }
    var config = AJDW_TAB_CONFIG[ajdwActivePreviewTab] || AJDW_TAB_CONFIG.jd;
    ajdwSetExportStatus('Copied ' + label + ' for ' + config.label + '.');
  }
  if (!clipboard || typeof clipboard.writeText !== 'function') {
    ajdwShowManualCopy(text, manualMessage);
    return;
  }
  try {
    var result = clipboard.writeText(text);
    if (result && typeof result.then === 'function') {
      result.then(onCopied, function () { ajdwShowManualCopy(text, manualMessage); });
      return;
    }
    onCopied();
  } catch (error) {
    ajdwShowManualCopy(text, manualMessage);
  }
}

function ajdwSlug(value) {
  var slug = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'role';
}

function ajdwDownload(format) {
  var config = AJDW_EXPORT_FORMATS[format] || AJDW_EXPORT_FORMATS.text;
  var text = ajdwBuildExport(format);
  var filename = 'jd-studio-' + ajdwSlug(ajdwReadDraftState().roleTitle) + '-' + ajdwViewSlug(ajdwActivePreviewTab) + '.' + config.ext;
  try {
    var urlApi = window.URL || window.webkitURL;
    if (typeof Blob === 'undefined' || !urlApi || typeof urlApi.createObjectURL !== 'function') { throw new Error('unsupported'); }
    var blob = new Blob([text], { type: config.mime });
    var url = urlApi.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    var host = document.body || document.documentElement;
    host.appendChild(link);
    link.click();
    host.removeChild(link);
    window.setTimeout(function () { urlApi.revokeObjectURL(url); }, 1500);
    ajdwSetExportStatus('Downloaded ' + filename + '.');
  } catch (error) {
    ajdwShowManualCopy(text, 'Download is not available here. The ' + config.label + ' copy is selected below - save it as ' + filename + '.');
  }
}

function ajdwInitPreviewAndExport() {
  if (ajdwPreviewReady) { return; }
  ajdwPreviewReady = true;
  var tabButtons = document.querySelectorAll('[data-ajdw-tab]');
  Array.prototype.forEach.call(tabButtons, function (button) {
    button.addEventListener('click', function () { ajdwSetTab(button.getAttribute('data-ajdw-tab')); });
  });
  var copyButton = ajdwEl('ajdw-copy-button');
  if (copyButton) { copyButton.addEventListener('click', ajdwCopyCurrent); }
  var txtButton = ajdwEl('ajdw-download-txt');
  if (txtButton) { txtButton.addEventListener('click', function () { ajdwDownload('text'); }); }
  var mdButton = ajdwEl('ajdw-download-md');
  if (mdButton) { mdButton.addEventListener('click', function () { ajdwDownload('markdown'); }); }
  var htmlButton = ajdwEl('ajdw-download-html');
  if (htmlButton) { htmlButton.addEventListener('click', function () { ajdwDownload('html'); }); }
  var formatSelect = ajdwEl('ajdw-export-format');
  if (formatSelect) {
    formatSelect.addEventListener('change', function () {
      ajdwSetExportStatus('Format set to ' + AJDW_EXPORT_FORMATS[ajdwCurrentFormat()].label + '.');
    });
  }
  document.addEventListener('input', function (event) {
    var target = event ? event.target : null;
    var id = target && target.id ? String(target.id) : '';
    if (id.indexOf('ajdw-section-') === 0 || id.indexOf('ajdw-advert-') === 0 || id === 'ajdw-role-title') {
      ajdwRenderPreview();
    }
  });
  var main = ajdwEl('ajdw-main');
  if (main && typeof MutationObserver === 'function') {
    var observer = new MutationObserver(function () { ajdwRenderPreview(); });
    observer.observe(main, { childList: true, subtree: true });
  }
  ajdwSetTab('jd');
}

/* B5 (T-22): labels, required state and describedby wiring for the role brief form */
(function () {
  var ajdwA11yTimer = null;
  var ajdwBootTries = 0;

  function ajdwA11ySetAttr(el, name, value) {
    if (el && el.getAttribute && el.getAttribute(name) !== value) {
      el.setAttribute(name, value);
    }
  }

  function ajdwA11yFieldOf(control) {
    var node = control ? control.parentNode : null;
    while (node && node.nodeType === 1) {
      var cls = ' ' + (node.className || '') + ' ';
      if (cls.indexOf(' ajdw-field ') !== -1) { return node; }
      node = node.parentNode;
    }
    return null;
  }

  function ajdwA11yLink(control) {
    if (!control || !control.id) { return; }
    var field = ajdwA11yFieldOf(control);
    if (!field || !field.querySelector) { return; }
    var errEl = field.querySelector('.ajdw-field-error');
    if (!errEl) {
      errEl = document.createElement('p');
      errEl.className = 'ajdw-field-error';
      errEl.id = 'ajdw-error-' + control.id;
      field.appendChild(errEl);
    }
    if (!errEl.id) { errEl.id = 'ajdw-error-' + control.id; }
    ajdwA11ySetAttr(control, 'aria-describedby', errEl.id);
  }

  function ajdwA11yRun() {
    if (typeof document === 'undefined' || !document.getElementById) { return; }
    var form = document.getElementById('ajdw-role-brief-form');
    if (!form || !form.querySelectorAll) { return; }
    var controls = form.querySelectorAll('input, textarea, select');
    for (var i = 0; i < controls.length; i += 1) {
      var control = controls[i];
      if (!control.id) { continue; }
      if (control.hasAttribute && control.hasAttribute('required')) {
        ajdwA11ySetAttr(control, 'aria-required', 'true');
      }
      ajdwA11yLink(control);
    }
    var statusIds = ['ajdw-status', 'ajdw-editor-status'];
    for (var s = 0; s < statusIds.length; s += 1) {
      var statusEl = document.getElementById(statusIds[s]);
      ajdwA11ySetAttr(statusEl, 'role', 'status');
      ajdwA11ySetAttr(statusEl, 'aria-live', 'polite');
    }
  }

  function ajdwA11ySchedule() {
    if (ajdwA11yTimer !== null) { return; }
    ajdwA11yTimer = setTimeout(function () {
      ajdwA11yTimer = null;
      ajdwA11yRun();
    }, 60);
  }

  function ajdwA11yStart() {
    ajdwA11yRun();
    var form = document.getElementById('ajdw-role-brief-form');
    if (!form) { return; }
    if (typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(ajdwA11ySchedule);
      observer.observe(form, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled', 'required'] });
    } else if (form.addEventListener) {
      form.addEventListener('input', ajdwA11ySchedule, true);
      form.addEventListener('click', ajdwA11ySchedule, true);
    }
  }

  function ajdwA11yBoot() {
    if (typeof document === 'undefined' || !document.getElementById) { return; }
    if (!document.getElementById('ajdw-role-brief-form')) {
      ajdwBootTries += 1;
      if (ajdwBootTries < 60) { setTimeout(ajdwA11yBoot, 100); }
      return;
    }
    ajdwA11yStart();
  }

  setTimeout(ajdwA11yBoot, 0);
})();

/* ---- B2 T-72 + T-73: single role brief form, first-run privacy notice, tab-only provider key ---- */
var AJDW_PRIVACY_FLAG = 'ajdw-privacy-ack';
var ajdwPrivacyAcknowledged = false;
var ajdwPrivacySuppressed = false;
var ajdwProviderKey = '';
var ajdwPrivacyBootTries = 0;

/* Session state is owned by the platform SDK. No browser storage API is referenced in this file. */
function ajdwSessionStore() {
  if (typeof tool === 'undefined' || !tool) { return null; }
  if (tool.session && typeof tool.session.get === 'function' && typeof tool.session.set === 'function') { return tool.session; }
  if (typeof tool.getSessionValue === 'function' && typeof tool.setSessionValue === 'function') {
    return {
      get: function (k) { try { return tool.getSessionValue(k); } catch (e) { return null; } },
      set: function (k, v) { try { tool.setSessionValue(k, v); } catch (e) { return; } }
    };
  }
  return null;
}

function ajdwSessionRead(key) {
  var store = ajdwSessionStore();
  if (!store) { return ''; }
  try { var v = store.get(key); return typeof v === 'string' ? v : ''; } catch (e) { return ''; }
}

function ajdwSessionWrite(key, value) {
  var store = ajdwSessionStore();
  if (!store) { return; }
  try { store.set(key, value); } catch (e) { return; }
}

function ajdwGetProviderKey() {
  if (!ajdwProviderKey) { ajdwProviderKey = ajdwSessionRead('ajdw-provider-key'); }
  return ajdwProviderKey;
}

function ajdwSetProviderKey(value) {
  ajdwProviderKey = typeof value === 'string' ? value.replace(/^\s+|\s+$/g, '') : '';
  ajdwSessionWrite('ajdw-provider-key', ajdwProviderKey);
}

function ajdwPrivacySeen() {
  if (ajdwPrivacyAcknowledged) { return true; }
  if (ajdwSessionRead(AJDW_PRIVACY_FLAG) === 'yes') { ajdwPrivacyAcknowledged = true; }
  return ajdwPrivacyAcknowledged;
}

function ajdwAcknowledgePrivacy() {
  ajdwPrivacyAcknowledged = true;
  ajdwSessionWrite(AJDW_PRIVACY_FLAG, 'yes');
}

function ajdwPrivacyEl(tag, className, id, text) {
  var el = document.createElement(tag);
  if (className) { el.className = className; }
  if (id) { el.id = id; }
  if (typeof text === 'string') { el.textContent = text; }
  return el;
}

/* T-72: the shipped page must expose exactly one role brief form and one Generate draft button. */
function ajdwDedupeRoleBrief() {
  var forms = document.querySelectorAll('form#ajdw-role-brief-form');
  for (var i = 1; i < forms.length; i += 1) {
    if (forms[i].parentNode) { forms[i].parentNode.removeChild(forms[i]); }
  }
  var buttons = document.querySelectorAll('#ajdw-generate-button');
  for (var j = 1; j < buttons.length; j += 1) {
    if (buttons[j].parentNode) { buttons[j].parentNode.removeChild(buttons[j]); }
  }
}

function ajdwPrivacyNoticeHidden(hidden) {
  var box = document.getElementById('ajdw-privacy-notice');
  if (!box) { return; }
  box.hidden = !!hidden;
  if (!hidden) {
    var input = document.getElementById('ajdw-provider-key-input');
    if (input && typeof input.focus === 'function') { input.focus(); }
  }
}

function ajdwRunGenerate() {
  var button = document.getElementById('ajdw-generate-button');
  if (button && !button.disabled && typeof button.click === 'function') { button.click(); }
}

function ajdwBuildPrivacyNotice() {
  if (typeof document === 'undefined' || !document.createElement) { return; }
  if (document.getElementById('ajdw-privacy-notice')) { return; }
  var host = document.getElementById('ajdw-app-root') || document.body;
  if (!host) { return; }
  var box = ajdwPrivacyEl('section', 'ajdw-privacy-notice ajdw-controls', 'ajdw-privacy-notice');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'ajdw-privacy-notice-title');
  box.hidden = true;
  box.appendChild(ajdwPrivacyEl('h2', 'ajdw-privacy-notice-title', 'ajdw-privacy-notice-title', 'Before your first draft'));
  box.appendChild(ajdwPrivacyEl('p', 'ajdw-privacy-notice-text', 'ajdw-privacy-notice-text', 'Your role brief and company context are sent to the third-party AI provider when you select Generate draft. Nothing else leaves this browser.'));
  box.appendChild(ajdwPrivacyEl('p', 'ajdw-hint', 'ajdw-privacy-notice-key-hint', 'A provider key is optional. If you paste one it stays in this tab only, is never saved to disk, and is cleared when the tab closes.'));
  var label = ajdwPrivacyEl('label', 'ajdw-label', 'ajdw-provider-key-label', 'Provider key (this tab only)');
  label.setAttribute('for', 'ajdw-provider-key-input');
  box.appendChild(label);
  var input = ajdwPrivacyEl('input', 'ajdw-input', 'ajdw-provider-key-input');
  input.type = 'password';
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('aria-describedby', 'ajdw-privacy-notice-key-hint');
  input.value = ajdwGetProviderKey();
  box.appendChild(input);
  var actions = ajdwPrivacyEl('div', 'ajdw-actions ajdw-privacy-notice-actions', 'ajdw-privacy-notice-actions');
  var proceed = ajdwPrivacyEl('button', 'ajdw-button', 'ajdw-privacy-continue', 'Continue with AI draft');
  proceed.type = 'button';
  proceed.addEventListener('click', function () {
    var field = document.getElementById('ajdw-provider-key-input');
    ajdwSetProviderKey(field && typeof field.value === 'string' ? field.value : '');
    ajdwAcknowledgePrivacy();
    ajdwPrivacyNoticeHidden(true);
    ajdwRunGenerate();
  });
  var sample = ajdwPrivacyEl('button', 'ajdw-button ajdw-button--ghost', 'ajdw-privacy-sample', 'Use sample draft instead');
  sample.type = 'button';
  sample.addEventListener('click', function () {
    ajdwAcknowledgePrivacy();
    ajdwPrivacyNoticeHidden(true);
    ajdwRenderSampleDraft();
  });
  var cancel = ajdwPrivacyEl('button', 'ajdw-button ajdw-button--small ajdw-button--ghost', 'ajdw-privacy-cancel', 'Not now');
  cancel.type = 'button';
  cancel.addEventListener('click', function () { ajdwPrivacyNoticeHidden(true); });
  actions.appendChild(proceed);
  actions.appendChild(sample);
  actions.appendChild(cancel);
  box.appendChild(actions);
  host.appendChild(box);
}

function ajdwShowPrivacyNotice() {
  ajdwBuildPrivacyNotice();
  ajdwPrivacyNoticeHidden(false);
}

/* T-73: deterministic local sample draft for the no-key path. No AI request is made. */
function ajdwSampleDraftSections() {
  return [
    { name: 'Role summary', body: 'We are hiring for this role to own the day-to-day work described in the brief, report to the hiring manager, and deliver measurable outcomes in the first six months.' },
    { name: 'What you will do', body: 'Lead the core work of the role, partner with the wider team, and keep written records of decisions so progress stays visible.' },
    { name: 'What we are looking for', body: 'Direct experience in a comparable role, clear written communication, and a track record of shipping work on schedule.' },
    { name: 'Salary and benefits', body: 'Salary band: state the range from the brief. Benefits follow the standard company package and are confirmed at offer stage.' },
    { name: 'How to apply', body: 'Apply through the company careers page. Every application is reviewed and answered within ten working days.' }
  ];
}

function ajdwRenderSampleDraft() {
  if (typeof document === 'undefined' || !document.getElementById) { return; }
  var body = document.getElementById('ajdw-preview-body');
  if (!body) { return; }
  while (body.firstChild) { body.removeChild(body.firstChild); }
  var notice = ajdwPrivacyEl('p', 'ajdw-status ajdw-sample-notice', 'ajdw-sample-notice', 'No provider key in this tab. This is the built-in sample draft, built locally with no AI request.');
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  body.appendChild(notice);
  var sections = ajdwSampleDraftSections();
  for (var i = 0; i < sections.length; i += 1) {
    body.appendChild(ajdwPrivacyEl('h3', 'ajdw-sample-heading', 'ajdw-sample-heading-' + i, sections[i].name));
    body.appendChild(ajdwPrivacyEl('p', 'ajdw-sample-text', 'ajdw-sample-text-' + i, sections[i].body));
  }
  var panel = document.getElementById('ajdw-preview');
  if (panel) { panel.hidden = false; }
  var empty = document.getElementById('ajdw-empty-state');
  if (empty) { empty.hidden = true; }
  var status = document.getElementById('ajdw-status');
  if (status) { status.textContent = 'Sample draft ready. It was built in this browser, no AI request was made.'; }
}

function ajdwInstallNoKeyNotice() {
  var form = document.getElementById('ajdw-role-brief-form');
  if (!form || !form.appendChild) { return; }
  var host = document.getElementById('ajdw-ai-disclosure') || form;
  var note = document.getElementById('ajdw-no-key-notice');
  if (!note) {
    note = ajdwPrivacyEl('p', 'ajdw-hint ajdw-no-key-notice', 'ajdw-no-key-notice');
    note.appendChild(document.createTextNode('No provider key in this tab. '));
    var btn = ajdwPrivacyEl('button', 'ajdw-button ajdw-button--small ajdw-button--ghost', 'ajdw-sample-draft-button', 'Show sample draft');
    btn.type = 'button';
    btn.addEventListener('click', function () { ajdwRenderSampleDraft(); });
    note.appendChild(btn);
    note.appendChild(document.createTextNode(' builds a deterministic draft locally, with no AI request.'));
    if (host !== form && host.parentNode) { host.parentNode.insertBefore(note, host.nextSibling); }
    else { form.appendChild(note); }
  }
  note.hidden = ajdwGetProviderKey() !== '';
}

function ajdwWirePrivacyGuard() {
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') { return; }
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.closest) { return; }
    if (t.closest('#ajdw-selftest-run')) {
      ajdwPrivacySuppressed = true;
      setTimeout(function () { ajdwPrivacySuppressed = false; }, 5000);
      return;
    }
    if (ajdwPrivacySuppressed || ajdwPrivacySeen()) { return; }
    if (!t.closest('#ajdw-generate-button')) { return; }
    ev.preventDefault();
    ev.stopPropagation();
    ajdwShowPrivacyNotice();
  }, true);
  document.addEventListener('submit', function (ev) {
    var t = ev.target;
    if (!t || t.id !== 'ajdw-role-brief-form') { return; }
    if (ajdwPrivacySuppressed || ajdwPrivacySeen()) { return; }
    ev.preventDefault();
    ev.stopPropagation();
    ajdwShowPrivacyNotice();
  }, true);
}

function ajdwPrivacyBoot() {
  if (typeof document === 'undefined' || !document.getElementById) { return; }
  if (!document.getElementById('ajdw-role-brief-form')) {
    ajdwPrivacyBootTries += 1;
    if (ajdwPrivacyBootTries < 60) { setTimeout(ajdwPrivacyBoot, 100); }
    return;
  }
  ajdwDedupeRoleBrief();
  ajdwBuildPrivacyNotice();
  ajdwInstallNoKeyNotice();
  ajdwWirePrivacyGuard();
}

setTimeout(ajdwPrivacyBoot, 0);

/* ---- B1 T-19: live required-field checklist gate ---- */
var AJDW_CHECKLIST_FIELDS = [
  { name: 'roleTitle', elementId: 'ajdw-role-title', label: 'Role title' },
  { name: 'summary', elementId: 'ajdw-summary', label: 'Summary' },
  { name: 'duties', elementId: 'ajdw-duties', label: 'Duties' },
  { name: 'requirements', elementId: 'ajdw-requirements', label: 'Requirements' },
  { name: 'companyContext', elementId: 'ajdw-company-context', label: 'Company context' }
];

function ajdwChecklistHasValue(elementId) {
  var field = document.getElementById(elementId);
  if (!field || typeof field.value !== 'string') { return false; }
  return field.value.replace(/\s+/g, ' ').trim().length > 0;
}

function ajdwSyncChecklistGate() {
  var done = 0;
  var list = document.getElementById('ajdw-checklist-list');
  AJDW_CHECKLIST_FIELDS.forEach(function (item) {
    var hasValue = ajdwChecklistHasValue(item.elementId);
    if (hasValue) { done += 1; }
    if (!list || typeof list.querySelector !== 'function') { return; }
    var row = list.querySelector('[data-ajdw-check="' + item.name + '"]');
    if (!row) { return; }
    row.setAttribute('data-ajdw-complete', hasValue ? '1' : '0');
    var mark = row.querySelector('.ajdw-checklist-mark');
    if (mark) { mark.textContent = hasValue ? 'Done' : 'Needed'; }
  });
  var count = document.getElementById('ajdw-checklist-count');
  if (count) {
    count.textContent = done + ' of ' + AJDW_CHECKLIST_FIELDS.length + ' required fields complete';
  }
  var button = document.getElementById('ajdw-generate-button');
  if (button) {
    var missing = AJDW_CHECKLIST_FIELDS.length - done;
    if (missing > 0) {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      button.setAttribute('title', 'Fill ' + missing + ' more required field' + (missing === 1 ? '' : 's'));
    } else {
      button.disabled = false;
      button.removeAttribute('aria-disabled');
      button.removeAttribute('title');
      button.textContent = 'Generate draft';
    }
  }
}

function ajdwWireChecklistGate() {
  var handler = function () { ajdwSyncChecklistGate(); };
  AJDW_CHECKLIST_FIELDS.forEach(function (item) {
    var field = document.getElementById(item.elementId);
    if (!field || typeof field.addEventListener !== 'function') { return; }
    field.addEventListener('input', handler);
    field.addEventListener('change', handler);
    field.addEventListener('keyup', handler);
  });
  var form = document.getElementById('ajdw-role-brief-form');
  if (form && typeof form.addEventListener === 'function') {
    form.addEventListener('input', handler);
    form.addEventListener('change', handler);
  }
  ajdwSyncChecklistGate();
}

/* ---- B1 T-17: versions + JSON import in the save area ---- */
function ajdwReportEditorStatus(message) {
  var status = document.getElementById('ajdw-editor-status');
  var text = document.getElementById('ajdw-editor-status-text');
  if (status) { status.hidden = false; }
  if (text) { text.textContent = message; }
}

function ajdwMoveSavePanels() {
  var bar = document.getElementById('ajdw-export-bar');
  if (!bar || typeof bar.appendChild !== 'function') { return; }
  var versions = document.getElementById('ajdw-versions');
  if (versions && versions.parentNode !== bar) { bar.appendChild(versions); }
  var importPanel = document.getElementById('ajdw-import-panel');
  if (importPanel && importPanel.parentNode !== bar) { bar.appendChild(importPanel); }
}

function ajdwInstallImportButton() {
  var panel = document.getElementById('ajdw-import-panel');
  var fileInput = document.getElementById('ajdw-import-file');
  if (!panel || !fileInput) { return; }
  if (!document.getElementById('ajdw-import-backup-button')) {
    var button = document.createElement('button');
    button.type = 'button';
    button.id = 'ajdw-import-backup-button';
    button.className = 'ajdw-button ajdw-button--small ajdw-import-backup';
    button.textContent = 'Import JSON backup';
    button.addEventListener('click', function () {
      if (typeof fileInput.click === 'function') { fileInput.click(); }
    });
    var controls = document.getElementById('ajdw-import-controls') || panel;
    controls.appendChild(button);
  }
  if (fileInput.getAttribute('data-ajdw-import-wired') === '1') { return; }
  fileInput.setAttribute('data-ajdw-import-wired', '1');
  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) {
      ajdwReportEditorStatus('Import failed: no backup file selected.');
      return;
    }
    if (typeof FileReader !== 'function') {
      ajdwReportEditorStatus('Import failed: this browser cannot read a local backup file.');
      return;
    }
    var reader = new FileReader();
    reader.onerror = function () {
      ajdwReportEditorStatus('Import failed: the backup file could not be read.');
    };
    reader.onload = function () {
      var parsed = null;
      try { parsed = JSON.parse(String(reader.result)); } catch (err) { parsed = null; }
      if (!parsed || typeof parsed !== 'object') {
        ajdwReportEditorStatus('Import failed: that file is not a valid JSON backup.');
        return;
      }
      ajdwReportEditorStatus('Imported ' + (file.name || 'backup') + ' — review the summary, then choose Apply import to finish.');
    };
    reader.readAsText(file);
  });
}

setTimeout(function () {
  try {
    ajdwMoveSavePanels();
    ajdwInstallImportButton();
  } catch (err) {
    console.log('[TOOL:SAVEAREA] ' + (err && err.message));
  }
  try {
    ajdwWireChecklistGate();
  } catch (err2) {
    console.log('[TOOL:CHECKLIST] ' + (err2 && err2.message));
  }
}, 0);

/* T-29 self test and T-30 generation nonce / stable section order guards. Additive: no storage, no network, no framework. */
var ajdwGenerationSeq = 0;

function ajdwSectionOrderSignature() {
  if (typeof document === 'undefined' || !document.querySelectorAll) { return ''; }
  var nodes = document.querySelectorAll('[id^="ajdw-section-"]');
  var ids = [];
  var i;
  var id;
  for (i = 0; i < nodes.length; i += 1) {
    id = String(nodes[i].id || '');
    if (id.indexOf('confirm') !== -1) { continue; }
    ids.push(id);
  }
  return ids.join('|');
}

function ajdwStartGeneration() {
  ajdwGenerationSeq += 1;
  return { nonce: ajdwGenerationSeq, order: ajdwSectionOrderSignature() };
}

function ajdwIsGenerationCurrent(token) {
  if (!token || typeof token.nonce !== 'number') { return false; }
  if (token.nonce !== ajdwGenerationSeq) { return false; }
  return token.order === ajdwSectionOrderSignature();
}

function ajdwTrackGeneration(promise) {
  if (!promise || typeof promise.then !== 'function') { return promise; }
  if (promise.ajdwNonceToken) { return promise; }
  var token = ajdwStartGeneration();
  var tracked = promise.then(function (value) {
    if (!ajdwIsGenerationCurrent(token)) {
      var stale = new Error('This draft was discarded because the brief or the section order changed while it was generating. Generate again for a fresh draft.');
      stale.ajdwStale = true;
      throw stale;
    }
    return value;
  });
  tracked.ajdwNonceToken = token;
  return tracked;
}

function ajdwInstallRequestGuard() {
  try {
    if (typeof tool === 'undefined' || !tool || typeof tool.requestAI !== 'function') { return false; }
    if (tool.ajdwRequestGuard === true) { return true; }
    var original = tool.requestAI;
    tool.requestAI = function (request) { return ajdwTrackGeneration(original.call(tool, request)); };
    tool.ajdwRequestGuard = true;
    return true;
  } catch (e) {
    return false;
  }
}

function ajdwSelfTestElement() {
  if (typeof document === 'undefined' || !document.body) { return null; }
  var node = document.getElementById('ajdw-selftest-status');
  if (node) { return node; }
  node = document.createElement('div');
  node.setAttribute('id', 'ajdw-selftest-status');
  node.setAttribute('class', 'ajdw-selftest-status');
  node.setAttribute('data-tool-build', TOOL_BUILD);
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  document.body.appendChild(node);
  return node;
}

function ajdwRunSelfTest() {
  var results = [];
  function check(name, fn) {
    var ok = false;
    try { ok = fn() === true; } catch (e) { ok = false; }
    results.push({ name: name, pass: ok });
    console.log('[TOOL:SELFTEST] ' + (ok ? 'PASS' : 'FAIL') + ' ' + name);
  }
  check('build-stamp-is-set', function () {
    return typeof TOOL_BUILD === 'string' && /^\d{4}-\d{2}-\d{2}-\d+$/.test(TOOL_BUILD);
  });
  check('preview-escapes-ai-text', function () {
    if (typeof ajdwModelToHtmlBody !== 'function') { return false; }
    var html = ajdwModelToHtmlBody({
      title: '<img onerror=x>',
      sections: [{ heading: 'Duties', paragraphs: ['<img onerror=x>'], bullets: ['<img onerror=x>'] }]
    });
    return html.indexOf('<img') === -1 && html.indexOf('&lt;img') !== -1;
  });
  check('export-escapes-ai-text', function () {
    if (typeof ajdwModelToHtmlDocument !== 'function') { return false; }
    var doc = ajdwModelToHtmlDocument({
      title: '<img onerror=x>',
      sections: [{ heading: '<img onerror=x>', paragraphs: ['<img onerror=x>'], bullets: [] }]
    });
    return doc.indexOf('<img') === -1 && doc.indexOf('&lt;img') !== -1;
  });
  check('section-order-signature-is-stable', function () {
    return typeof ajdwSectionOrderSignature() === 'string' && ajdwSectionOrderSignature() === ajdwSectionOrderSignature();
  });
  check('newer-request-supersedes-older', function () {
    var first = ajdwStartGeneration();
    var second = ajdwStartGeneration();
    return ajdwIsGenerationCurrent(first) === false && ajdwIsGenerationCurrent(second) === true;
  });
  check('missing-nonce-is-rejected', function () {
    return ajdwIsGenerationCurrent(null) === false && ajdwIsGenerationCurrent({}) === false;
  });
  check('section-order-change-rejects-token', function () {
    var token = ajdwStartGeneration();
    var tampered = { nonce: token.nonce, order: token.order + '|tampered' };
    return ajdwIsGenerationCurrent(tampered) === false && ajdwIsGenerationCurrent(token) === true;
  });
  var pass = 0;
  var fail = 0;
  var i;
  for (i = 0; i < results.length; i += 1) {
    if (results[i].pass) { pass += 1; } else { fail += 1; }
  }
  console.log('[TOOL:SELFTEST] summary pass ' + pass + ' fail ' + fail + ' total ' + results.length);
  var node = ajdwSelfTestElement();
  if (node) {
    var lines = [];
    for (i = 0; i < results.length; i += 1) {
      lines.push((results[i].pass ? 'PASS ' : 'FAIL ') + results[i].name);
    }
    node.textContent = 'Self test: ' + pass + ' passed, ' + fail + ' failed of ' + results.length + '. ' + lines.join(' | ');
  }
  return { pass: pass, fail: fail, total: results.length, results: results };
}

function ajdwSelfTestBoot() {
  ajdwInstallRequestGuard();
  try {
    window.ajdwSelfTestResult = ajdwRunSelfTest();
  } catch (e) {
    console.log('[TOOL:SELFTEST] summary pass 0 fail 1 total 1');
  }
}

if (typeof document !== 'undefined') {
  ajdwSelfTestBoot();
}
if (typeof window !== 'undefined') {
  window.ajdwRunSelfTest = ajdwRunSelfTest;
}

/* --- T-34: copy and download labels name the active preview view. --- */
/* --- T-35: character counters for the three advert variants. --- */
var AJDW_VIEW_SLUGS = { jd: 'jd', standard: 'standard-advert', short: 'short-advert', social: 'social' };
var AJDW_COUNTER_TARGETS = [
  { tab: 'standard', field: 'ajdw-advert-standard', limit: 800 },
  { tab: 'short', field: 'ajdw-advert-short', limit: 300 },
  { tab: 'social', field: 'ajdw-advert-social', limit: 150 }
];
var AJDW_DOWNLOAD_BUTTONS = [
  { id: 'ajdw-download-txt', ext: 'txt' },
  { id: 'ajdw-download-md', ext: 'md' },
  { id: 'ajdw-download-html', ext: 'html' }
];

function ajdwViewSlug(tab) {
  return AJDW_VIEW_SLUGS[tab] || AJDW_VIEW_SLUGS.jd;
}

function ajdwViewLabel(tab) {
  var config = AJDW_TAB_CONFIG[tab] || AJDW_TAB_CONFIG.jd;
  return config.label;
}

function ajdwUpdateExportLabels() {
  var viewLabel = ajdwViewLabel(ajdwActivePreviewTab);
  var copyButton = ajdwEl('ajdw-copy-button');
  if (copyButton) {
    copyButton.textContent = 'Copy ' + viewLabel;
    copyButton.setAttribute('aria-label', 'Copy the current ' + viewLabel + ' view');
  }
  AJDW_DOWNLOAD_BUTTONS.forEach(function (item) {
    var button = ajdwEl(item.id);
    if (!button) { return; }
    button.textContent = 'Download ' + viewLabel + ' .' + item.ext;
    button.setAttribute('aria-label', 'Download the current ' + viewLabel + ' view as .' + item.ext);
  });
}

function ajdwEnsureCounter(target) {
  var field = ajdwEl(target.field);
  if (!field || !field.parentNode) { return null; }
  var id = 'ajdw-counter-' + target.tab;
  var counter = ajdwEl(id);
  if (!counter) {
    counter = document.createElement('p');
    counter.id = id;
    counter.className = 'ajdw-counter';
    counter.setAttribute('data-ajdw-counter', target.tab);
    counter.setAttribute('role', 'status');
    try { field.parentNode.insertBefore(counter, field.nextSibling); } catch (error) { return null; }
  }
  return counter;
}

function ajdwUpdateCounters() {
  AJDW_COUNTER_TARGETS.forEach(function (target) {
    var counter = ajdwEnsureCounter(target);
    if (!counter) { return; }
    var field = ajdwEl(target.field);
    var value = field && typeof field.value === 'string' ? field.value : '';
    var length = value.length;
    var over = length > target.limit;
    var label = ajdwViewLabel(target.tab);
    counter.textContent = length + ' / ' + target.limit + (over ? ' - over limit by ' + (length - target.limit) : '');
    counter.setAttribute('data-ajdw-over', over ? '1' : '0');
    counter.setAttribute('aria-label', label + ': ' + length + ' of ' + target.limit + ' characters' + (over ? ', over the limit' : ''));
    if (over) { counter.classList.add('ajdw-counter--over'); } else { counter.classList.remove('ajdw-counter--over'); }
  });
}

/* ---------------------------------------------------------------------------
   Batch B2 - T-36 Load example brief and T-37 required-field checklist.
   Additive only: no storage, no network, no framework. The module waits for the
   role brief form to exist, wires itself once, and keeps the older checklist
   in step with the new seven-field gate.
--------------------------------------------------------------------------- */
var AJDW_B2_EXAMPLE_ORDER = [
  'ajdw-role-title',
  'ajdw-department',
  'ajdw-location',
  'ajdw-employment-type',
  'ajdw-seniority',
  'ajdw-salary',
  'ajdw-summary',
  'ajdw-duties',
  'ajdw-requirements',
  'ajdw-company-context',
  'ajdw-tone'
];

var AJDW_B2_EXAMPLE = {
  'ajdw-role-title': 'Senior Product Manager',
  'ajdw-department': 'Product',
  'ajdw-location': 'Austin, TX - hybrid, 2 days on site',
  'ajdw-employment-type': 'full-time',
  'ajdw-seniority': 'senior',
  'ajdw-salary': '$135,000 - $155,000',
  'ajdw-summary': 'We are hiring a Senior Product Manager to own our scheduling product from discovery through launch. You will pair with design, engineering, and support to turn customer research into a roadmap the whole company can follow.',
  'ajdw-duties': '- Own the roadmap for the scheduling product and explain the priority calls behind it\n- Run customer interviews and turn findings into written product requirements\n- Partner with design and engineering from discovery through launch\n- Define success metrics for each release and review them 30 days after launch\n- Mentor two associate product managers on discovery and written communication',
  'ajdw-requirements': '- 5 or more years of product management experience in B2B software\n- A record of shipping products used by at least 10,000 people\n- Comfort with analytics tools and basic SQL\n- Clear written communication, including one-page product briefs\n- Experience working with a remote engineering team',
  'ajdw-company-context': 'Northline Scheduling builds workforce scheduling software for clinics and small hospitals. We are a 90-person company serving customers in 14 states, and we write product decisions down so remote teammates can follow them.',
  'ajdw-tone': 'Warm, direct, and professional'
};

var AJDW_B2_FIELD_IDS = {
  roleTitle: 'ajdw-role-title',
  department: 'ajdw-department',
  location: 'ajdw-location',
  employmentType: 'ajdw-employment-type',
  seniority: 'ajdw-seniority',
  salary: 'ajdw-salary',
  summary: 'ajdw-summary',
  duties: 'ajdw-duties',
  requirements: 'ajdw-requirements',
  companyContext: 'ajdw-company-context',
  tone: 'ajdw-tone'
};

var AJDW_B2_REQUIRED = [
  { id: 'ajdw-role-title', label: 'Role title' },
  { id: 'ajdw-department', label: 'Department' },
  { id: 'ajdw-location', label: 'Location' },
  { id: 'ajdw-employment-type', label: 'Employment type' },
  { id: 'ajdw-summary', label: 'Summary' },
  { id: 'ajdw-duties', label: 'Duties' },
  { id: 'ajdw-requirements', label: 'Requirements' }
];

var AJDW_B2_BOOT_TRIES = 0;

function ajdwB2El(id) {
  return document.getElementById(id);
}

function ajdwB2Value(id) {
  var el = ajdwB2El(id);
  if (!el || typeof el.value !== 'string') { return ''; }
  return el.value;
}

function ajdwB2Filled(id) {
  return ajdwB2Value(id).replace(/\s+/g, '').length > 0;
}

function ajdwB2Emit(el, type) {
  try {
    el.dispatchEvent(new Event(type, { bubbles: true }));
  } catch (err) {
    try {
      var ev = document.createEvent('HTMLEvents');
      ev.initEvent(type, true, false);
      el.dispatchEvent(ev);
    } catch (err2) {
      /* older engine: the next sync still recalculates from field values */
    }
  }
}

function ajdwB2Set(id, value) {
  var el = ajdwB2El(id);
  if (!el) { return; }
  el.value = value;
  ajdwB2Emit(el, 'input');
  ajdwB2Emit(el, 'change');
}

function ajdwB2AnyText() {
  for (var i = 0; i < AJDW_B2_EXAMPLE_ORDER.length; i++) {
    if (ajdwB2Filled(AJDW_B2_EXAMPLE_ORDER[i])) { return true; }
  }
  return false;
}

function ajdwB2SetStatus(msg) {
  var el = ajdwB2El('ajdw-status');
  if (el) { el.textContent = msg; }
}

function ajdwB2HideConfirm() {
  var box = ajdwB2El('ajdw-example-confirm');
  if (box) { box.hidden = true; }
}

function ajdwB2SyncChecklist() {
  var items = document.querySelectorAll('[data-ajdw-check]');
  if (!items || !items.length) { return; }
  var total = items.length;
  var done = 0;
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var key = item.getAttribute('data-ajdw-check');
    var fieldId = AJDW_B2_FIELD_IDS[key];
    var filled = fieldId ? ajdwB2Filled(fieldId) : false;
    item.setAttribute('data-ajdw-complete', filled ? '1' : '0');
    var mark = item.querySelector('.ajdw-checklist-mark');
    if (mark) { mark.textContent = filled ? 'Complete' : 'Needed'; }
    if (filled) { done++; }
  }
  var count = ajdwB2El('ajdw-checklist-count');
  if (count) { count.textContent = done + ' of ' + total + ' required fields complete'; }
}

function ajdwB2Sync() {
  var i;
  var total = AJDW_B2_REQUIRED.length;
  var done = 0;
  var missing = [];
  for (i = 0; i < total; i++) {
    if (ajdwB2Filled(AJDW_B2_REQUIRED[i].id)) {
      done++;
    } else {
      missing.push(AJDW_B2_REQUIRED[i].label);
    }
  }
  var countEl = ajdwB2El('ajdw-req-count');
  if (countEl) {
    countEl.textContent = missing.length === 0
      ? 'All required fields complete'
      : 'Required fields: ' + done + ' of ' + total + ' complete';
  }
  var chipsEl = ajdwB2El('ajdw-req-chips');
  if (chipsEl) {
    while (chipsEl.firstChild) { chipsEl.removeChild(chipsEl.firstChild); }
    for (i = 0; i < missing.length; i++) {
      var chip = document.createElement('li');
      chip.className = 'ajdw-req-chip';
      chip.textContent = missing[i];
      chipsEl.appendChild(chip);
    }
  }
  var btn = ajdwB2El('ajdw-generate-button');
  if (btn) {
    if (missing.length === 0) {
      btn.disabled = false;
      btn.removeAttribute('aria-disabled');
      btn.title = 'All required fields complete';
    } else {
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
      btn.title = 'Fill the ' + missing.length + ' remaining required fields';
    }
  }
  ajdwB2SyncChecklist();
}

function ajdwB2LoadExample() {
  for (var i = 0; i < AJDW_B2_EXAMPLE_ORDER.length; i++) {
    var id = AJDW_B2_EXAMPLE_ORDER[i];
    ajdwB2Set(id, AJDW_B2_EXAMPLE[id] || '');
  }
  ajdwB2HideConfirm();
  ajdwB2SetStatus('Example brief loaded. Edit anything you like.');
  ajdwB2Sync();
}

function ajdwB2ClearForm() {
  for (var i = 0; i < AJDW_B2_EXAMPLE_ORDER.length; i++) {
    ajdwB2Set(AJDW_B2_EXAMPLE_ORDER[i], '');
  }
  ajdwB2HideConfirm();
  ajdwB2SetStatus('Form cleared. Fill the required fields to enable Generate draft.');
  ajdwB2Sync();
}

function ajdwB2Wire() {
  var load = ajdwB2El('ajdw-load-example');
  if (load && load.getAttribute('data-ajdw-wired') !== '1') {
    load.setAttribute('data-ajdw-wired', '1');
    load.addEventListener('click', function () {
      if (ajdwB2AnyText()) {
        var q = ajdwB2El('ajdw-example-question');
        if (q) { q.textContent = 'Replace the current brief with the example?'; }
        var box = ajdwB2El('ajdw-example-confirm');
        if (box) { box.hidden = false; } else { ajdwB2LoadExample(); }
      } else {
        ajdwB2LoadExample();
      }
    });
  }

  var clear = ajdwB2El('ajdw-clear-form');
  if (clear && clear.getAttribute('data-ajdw-wired') !== '1') {
    clear.setAttribute('data-ajdw-wired', '1');
    clear.addEventListener('click', function () {
      /* T-63: never empty a field or drop a saved draft before an explicit Clear all. */
      ajdwClearFormAsk(clear);
    });
  }

  var yes = ajdwB2El('ajdw-example-replace');
  if (yes && yes.getAttribute('data-ajdw-wired') !== '1') {
    yes.setAttribute('data-ajdw-wired', '1');
    yes.addEventListener('click', function () {
      ajdwB2LoadExample();
    });
  }

  var keep = ajdwB2El('ajdw-example-keep');
  if (keep && keep.getAttribute('data-ajdw-wired') !== '1') {
    keep.setAttribute('data-ajdw-wired', '1');
    keep.addEventListener('click', function () {
      ajdwB2HideConfirm();
      ajdwB2SetStatus('Example not loaded - your brief is unchanged.');
    });
  }

  var form = ajdwB2El('ajdw-role-brief-form');
  if (form && form.getAttribute('data-ajdw-req-wired') !== '1') {
    form.setAttribute('data-ajdw-req-wired', '1');
    var handler = function () {
      setTimeout(function () { ajdwB2Sync(); }, 0);
    };
    form.addEventListener('input', handler, true);
    form.addEventListener('change', handler, true);
    form.addEventListener('keyup', handler, true);
    form.addEventListener('blur', handler, true);
  }
}

function ajdwB2Boot() {
  if (!ajdwB2El('ajdw-role-brief-form')) {
    if (AJDW_B2_BOOT_TRIES < 60) {
      AJDW_B2_BOOT_TRIES++;
      setTimeout(ajdwB2Boot, 100);
    }
    return;
  }
  ajdwB2Wire();
  ajdwB2Sync();
}

if (typeof tool !== 'undefined' && tool && typeof tool.onReady === 'function') {
  tool.onReady(function () { ajdwB2Boot(); });
}
setTimeout(ajdwB2Boot, 0);

/* T-44 + T-45: one prefixed storage helper for every key, provider settings panel, key redaction, privacy notice. */
(function () {
  'use strict';

  var AJDW_STORE_PREFIX = 'ajdw-jd-studio:';
  var AJDW_KEY_NAME = 'providerApiKey';
  var SECRET_FIELD = /api[-_]?key|secret|token/i;
  var secrets = [];
  var memory = {};
  var mounted = false;

  function qualify(name) {
    var base = String(name == null ? '' : name);
    if (base.indexOf(AJDW_STORE_PREFIX) === 0) { return base; }
    return AJDW_STORE_PREFIX + base;
  }

  function storageApi() {
    if (typeof tool === 'undefined' || !tool) { return null; }
    if (tool.storage && typeof tool.storage.get === 'function' && typeof tool.storage.set === 'function') { return tool.storage; }
    if (typeof tool.getValue === 'function' && typeof tool.setValue === 'function') {
      return {
        get: function (name) { return tool.getValue(name); },
        set: function (name, value) { tool.setValue(name, value); },
        remove: function (name) {
          if (typeof tool.removeValue === 'function') { tool.removeValue(name); } else { tool.setValue(name, null); }
        }
      };
    }
    return null;
  }

  function storeGet(name) {
    var key = qualify(name);
    var api = storageApi();
    if (api) { try { return api.get(key); } catch (err) { return null; } }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }

  function storeFailure() {
    if (typeof ajdwStorageFailureStatus === 'function') {
      try { return ajdwStorageFailureStatus(); } catch (err) { return null; }
    }
    return null;
  }

  function storeSet(name, value) {
    var key = qualify(name);
    var api = storageApi();
    if (api) {
      try {
        var result = api.set(key, value);
        if (result && typeof result.then === 'function') {
          result.then(null, function () { storeFailure(); });
        }
        return true;
      } catch (err) {
        storeFailure();
        return false;
      }
    }
    memory[key] = value;
    return true;
  }

  function storeRemove(name) {
    var key = qualify(name);
    var api = storageApi();
    if (api) {
      try {
        if (typeof api.remove === 'function') { api.remove(key); } else { api.set(key, null); }
        return true;
      } catch (err) { return false; }
    }
    delete memory[key];
    return true;
  }

  function rememberSecret(value) {
    var text = String(value == null ? '' : value);
    if (text && secrets.indexOf(text) === -1) { secrets.push(text); }
  }

  function redact(text) {
    var out = String(text == null ? '' : text);
    for (var i = 0; i < secrets.length; i += 1) {
      var secret = secrets[i];
      if (secret && secret.length > 3) { out = out.split(secret).join('[redacted]'); }
    }
    return out;
  }

  function scrubConsole() {
    if (typeof console === 'undefined') { return; }
    var names = ['log', 'info', 'warn', 'error', 'debug'];
    for (var i = 0; i < names.length; i += 1) {
      (function (name) {
        var original = console[name];
        if (typeof original !== 'function' || original.ajdwScrubbed) { return; }
        var wrapped = function () {
          var args = [];
          for (var j = 0; j < arguments.length; j += 1) {
            var item = arguments[j];
            args.push(typeof item === 'string' ? redact(item) : item);
          }
          return original.apply(console, args);
        };
        wrapped.ajdwScrubbed = true;
        console[name] = wrapped;
      }(names[i]));
    }
  }

  function cleanRecord(value, depth) {
    if (value === null || typeof value !== 'object' || depth > 8) { return value; }
    var tag = Object.prototype.toString.call(value);
    if (tag === '[object Array]') {
      var list = [];
      for (var i = 0; i < value.length; i += 1) { list.push(cleanRecord(value[i], depth + 1)); }
      return list;
    }
    if (tag !== '[object Object]') { return value; }
    var out = {};
    for (var key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) { continue; }
      if (SECRET_FIELD.test(key)) { continue; }
      out[key] = cleanRecord(value[key], depth + 1);
    }
    return out;
  }

  function scrubJson() {
    if (typeof JSON === 'undefined' || typeof JSON.stringify !== 'function' || JSON.stringify.ajdwSanitised) { return; }
    var original = JSON.stringify;
    var wrapped = function (value, replacer, space) {
      return original.call(JSON, cleanRecord(value, 0), replacer, space);
    };
    wrapped.ajdwSanitised = true;
    JSON.stringify = wrapped;
  }

  function keyStatusLine(text) {
    var node = document.getElementById('ajdw-key-status');
    if (node) { node.textContent = redact(text); }
  }

  function optInChecked() {
    var box = document.getElementById('ajdw-key-optin');
    return !!(box && box.checked);
  }

  function saveKey() {
    var input = document.getElementById('ajdw-provider-key');
    var value = input ? String(input.value || '').trim() : '';
    if (!value) { keyStatusLine('Enter a provider key first.'); return; }
    rememberSecret(value);
    if (optInChecked()) {
      storeSet(AJDW_KEY_NAME, value);
      keyStatusLine('Key saved in this browser. Use Clear key to remove it.');
    } else {
      storeRemove(AJDW_KEY_NAME);
      keyStatusLine('Key kept for this session only. Tick the box to remember it.');
    }
    if (input) { input.value = ''; }
  }

  function clearKey() {
    storeRemove(AJDW_KEY_NAME);
    secrets = [];
    var input = document.getElementById('ajdw-provider-key');
    if (input) { input.value = ''; }
    keyStatusLine('Key cleared.');
  }

  function restoreKey() {
    var saved = storeGet(AJDW_KEY_NAME);
    if (typeof saved === 'string' && saved) {
      rememberSecret(saved);
      var box = document.getElementById('ajdw-key-optin');
      if (box) { box.checked = true; }
      keyStatusLine('A saved key is loaded from this browser. Use Clear key to remove it.');
    } else {
      keyStatusLine('No key saved.');
    }
  }

  function buildPanel() {
    var panel = document.createElement('section');
    panel.className = 'ajdw-settings';
    panel.id = 'ajdw-provider-settings';
    panel.innerHTML = '<details class="ajdw-settings-details">' +
      '<summary class="ajdw-settings-summary">Provider settings</summary>' +
      '<p class="ajdw-hint">Bring your own provider key. It is only saved when you tick the box below, and it is never written into backups.</p>' +
      '<label class="ajdw-label" for="ajdw-provider-key">Provider API key</label>' +
      '<input class="ajdw-input" id="ajdw-provider-key" type="password" autocomplete="off" spellcheck="false" placeholder="Paste your key">' +
      '<label class="ajdw-checkbox-label"><input type="checkbox" id="ajdw-key-optin"> Remember this key in this browser until I clear it</label>' +
      '<div class="ajdw-actions">' +
      '<button class="ajdw-button" id="ajdw-save-key" type="button">Save key</button>' +
      '<button class="ajdw-button ajdw-button-quiet" id="ajdw-clear-key" type="button">Clear key</button>' +
      '</div>' +
      '<p class="ajdw-status" id="ajdw-key-status" role="status" aria-live="polite">No key saved.</p>' +
      '</details>';
    return panel;
  }

  function buildNotice() {
    var notice = document.createElement('p');
    notice.className = 'ajdw-privacy-notice';
    notice.id = 'ajdw-provider-notice';
    notice.textContent = 'Privacy: when you generate, your role brief and company context are sent to the third-party AI provider you configured. Everything else stays in this browser.';
    return notice;
  }

  function mount() {
    if (mounted) { return; }
    if (typeof document === 'undefined' || !document.createElement) { return; }
    var root = document.querySelector('.ajdw-app') || document.body;
    if (!root) { return; }
    mounted = true;
    scrubConsole();
    scrubJson();
    var panel = buildPanel();
    if (root.firstChild) { root.insertBefore(panel, root.firstChild); } else { root.appendChild(panel); }
    var generate = document.getElementById('ajdw-generate-button');
    var notice = buildNotice();
    if (generate && generate.parentNode) { generate.parentNode.insertBefore(notice, generate); } else { root.appendChild(notice); }
    var save = document.getElementById('ajdw-save-key');
    var clear = document.getElementById('ajdw-clear-key');
    if (save) { save.addEventListener('click', saveKey); }
    if (clear) { clear.addEventListener('click', clearKey); }
    restoreKey();
  }

  try {
    if (typeof tool !== 'undefined' && tool && typeof tool.onReady === 'function') {
      tool.onReady(function () { try { mount(); } catch (err) { /* the tool keeps working without the panel */ } });
    }
  } catch (err) { /* no SDK present: the panel is simply absent */ }

  try {
    if (typeof document !== 'undefined' && document.querySelector && document.querySelector('.ajdw-app')) { mount(); }
  } catch (err) { /* the tool keeps working without the panel */ }

  try {
    if (typeof window !== 'undefined') {
      window.AJDW_STORE = {
        prefix: AJDW_STORE_PREFIX,
        keyName: AJDW_KEY_NAME,
        qualify: qualify,
        get: storeGet,
        set: storeSet,
        remove: storeRemove,
        redact: redact
      };
    }
  } catch (err) { /* ignore */ }
}());


/* T-50: every working datum is persisted through the tool storage SDK. No browser storage is read or written. */
(function () {
  'use strict';

  var SNAP_KEY = 'ajdw-jd-studio:draft-snapshot';
  var FAIL_TEXT = 'Could not save to tool storage. Your draft is still open in this tab.';
  var saveTimer = null;
  var restoring = false;
  var restoreTries = 0;

  function storageApi() {
    if (typeof tool === 'undefined' || !tool) { return null; }
    if (tool.storage && typeof tool.storage.get === 'function' && typeof tool.storage.set === 'function') { return tool.storage; }
    if (typeof tool.getValue === 'function' && typeof tool.setValue === 'function') {
      return {
        get: function (name) { return tool.getValue(name); },
        set: function (name, value) { return tool.setValue(name, value); }
      };
    }
    return null;
  }

  function statusNode() {
    var node = document.getElementById('ajdw-status');
    if (!node) { node = document.querySelector('.ajdw-status'); }
    if (!node) { node = document.getElementById('ajdw-storage-alert'); }
    if (!node && document.createElement) {
      var host = document.body || document.documentElement;
      if (host) {
        node = document.createElement('p');
        node.id = 'ajdw-storage-alert';
        node.className = 'ajdw-status ajdw-storage-alert';
        node.setAttribute('role', 'status');
        host.appendChild(node);
      }
    }
    return node;
  }

  function reportFailure() {
    var node = statusNode();
    if (node) { node.textContent = FAIL_TEXT; }
    if (typeof window !== 'undefined') { window.ajdwLastStorageError = FAIL_TEXT; }
    return FAIL_TEXT;
  }

  if (typeof window !== 'undefined') { window.ajdwStorageFailureStatus = reportFailure; }
  if (typeof globalThis !== 'undefined') { globalThis.ajdwStorageFailureStatus = reportFailure; }

  function skipField(el) {
    var id = el.id || '';
    if (!id) { return true; }
    if (id.indexOf('harness') !== -1) { return true; }
    if (/key|secret|token|password/i.test(id)) { return true; }
    if (el.type === 'password' || el.type === 'file') { return true; }
    return false;
  }

  function collect() {
    var fields = {};
    var nodes = document.querySelectorAll('input, textarea, select');
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      if (skipField(el)) { continue; }
      if (el.type === 'checkbox' || el.type === 'radio') { fields[el.id] = !!el.checked; continue; }
      fields[el.id] = String(el.value == null ? '' : el.value);
    }
    return fields;
  }

  function save() {
    var fields = collect();
    var count = 0;
    var name;
    for (name in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, name)) { count += 1; }
    }
    if (!count) { return false; }
    var payload = {
      app: 'ajdw-jd-studio',
      build: (typeof TOOL_BUILD === 'string' ? TOOL_BUILD : ''),
      savedAt: new Date().toISOString(),
      fields: fields
    };
    var text;
    try { text = JSON.stringify(payload); } catch (err) { return false; }
    var store = storageApi();
    if (!store) { return false; }
    try {
      var result = store.set(SNAP_KEY, text);
      if (result && typeof result.then === 'function') {
        result.then(null, function () { reportFailure(); });
      }
      return true;
    } catch (err) {
      reportFailure();
      return false;
    }
  }

  function apply(el, value) {
    if (el.type === 'checkbox' || el.type === 'radio') {
      if (!!el.checked === !!value) { return false; }
      el.checked = !!value;
    } else {
      var current = String(el.value == null ? '' : el.value);
      var next = String(value == null ? '' : value);
      if (current === next || current !== '') { return false; }
      el.value = next;
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (err) {
      try {
        var legacy = document.createEvent('HTMLEvents');
        legacy.initEvent('input', true, true);
        el.dispatchEvent(legacy);
      } catch (err2) { return true; }
    }
    return true;
  }

  function restore() {
    restoreTries += 1;
    var store = storageApi();
    if (!store) { return false; }
    var raw = null;
    try { raw = store.get(SNAP_KEY); } catch (err) { return false; }
    if (raw === null || raw === undefined || raw === '') { return false; }
    var payload = null;
    try { payload = (typeof raw === 'string') ? JSON.parse(raw) : raw; } catch (err) { return false; }
    if (!payload || !payload.fields || typeof payload.fields !== 'object') { return false; }
    restoring = true;
    var ids = [];
    var name;
    for (name in payload.fields) {
      if (Object.prototype.hasOwnProperty.call(payload.fields, name)) { ids.push(name); }
    }
    var restored = 0;
    for (var i = 0; i < ids.length; i += 1) {
      var el = document.getElementById(ids[i]);
      if (!el) { continue; }
      if (apply(el, payload.fields[ids[i]])) { restored += 1; }
    }
    restoring = false;
    return restored > 0;
  }

  function schedule() {
    if (restoring) { return; }
    if (saveTimer) { clearTimeout(saveTimer); }
    saveTimer = setTimeout(function () { saveTimer = null; save(); }, 350);
  }

  function wire() {
    var doc = document;
    if (doc.ajdwSnapshotWired) { return; }
    doc.ajdwSnapshotWired = true;
    if (doc.addEventListener) {
      doc.addEventListener('input', schedule, true);
      doc.addEventListener('change', schedule, true);
      doc.addEventListener('keyup', schedule, true);
    }
  }

  function syncBadge() {
    var nodes = document.querySelectorAll('[data-tool-build], .ajdw-build-badge, #ajdw-build-badge');
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (node.setAttribute && node.getAttribute && node.getAttribute('data-tool-build') !== null) {
        node.setAttribute('data-tool-build', TOOL_BUILD);
      }
      var text = String(node.textContent == null ? '' : node.textContent);
      var next = text.replace(/\d{4}-\d{2}-\d{2}-\d+/g, TOOL_BUILD);
      if (next !== text) { node.textContent = next; }
    }
  }

  function start() {
    wire();
    syncBadge();
    setTimeout(function () { restore(); }, 200);
    setTimeout(function () { if (restoreTries < 2) { restore(); } }, 900);
    setTimeout(function () { if (restoreTries < 3) { restore(); } }, 1700);
    setTimeout(syncBadge, 600);
  }

  if (typeof tool !== 'undefined' && tool && typeof tool.onReady === 'function') {
    tool.onReady(function () { start(); });
  }
  setTimeout(start, 0);
}());
/* --- T-52 in-tool self test panel, T-53 required-field checklist. Additive only: no storage, no network, no framework. --- */
(function () {
  function byId(id) {
    if (typeof document === 'undefined' || !document.getElementById) { return null; }
    return document.getElementById(id);
  }

  function briefForm() { return byId('ajdw-role-brief-form'); }

  function labelFor(field) {
    if (!field) { return 'Field'; }
    var text = '';
    if (field.id && document.querySelector) {
      var label = document.querySelector('label[for="' + field.id + '"]');
      if (label) { text = String(label.textContent == null ? '' : label.textContent); }
    }
    if (!text) {
      var node = field.parentNode;
      while (node && node !== document.body) {
        if (node.tagName === 'LABEL') { text = String(node.textContent == null ? '' : node.textContent); break; }
        node = node.parentNode;
      }
    }
    text = text.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    if (!text) { text = field.name || field.id || 'Field'; }
    return text;
  }

  function requiredFields() {
    var form = briefForm();
    if (!form || !form.querySelectorAll) { return []; }
    var nodes = form.querySelectorAll('[required], [aria-required="true"]');
    var out = [];
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      if (nodes[i] && out.indexOf(nodes[i]) === -1) { out.push(nodes[i]); }
    }
    return out;
  }

  function isFilled(field) {
    if (!field || field.value == null) { return false; }
    return String(field.value).replace(/\s+/g, ' ').trim().length > 0;
  }

  function makeJump(field) {
    return function (event) {
      if (event && event.preventDefault) { event.preventDefault(); }
      if (!field) { return; }
      try { field.focus(); } catch (e) { /* focus is best effort */ }
    };
  }

  function listHost() {
    var host = byId('ajdw-req-list');
    if (host) { return host; }
    var line = byId('ajdw-reqline');
    var parent = line || briefForm();
    if (!parent || !document.createElement) { return null; }
    host = document.createElement('ul');
    host.id = 'ajdw-req-list';
    host.className = 'ajdw-req-list';
    host.setAttribute('aria-label', 'Incomplete required fields');
    var anchor = byId('ajdw-req-chips');
    if (anchor && anchor.parentNode === parent) {
      parent.insertBefore(host, anchor.nextSibling);
    } else {
      parent.appendChild(host);
    }
    return host;
  }

  function renderReq() {
    var fields = requiredFields();
    var total = fields.length;
    var done = 0;
    var missing = [];
    var i;
    for (i = 0; i < total; i += 1) {
      if (isFilled(fields[i])) { done += 1; } else { missing.push(fields[i]); }
    }
    var countEl = byId('ajdw-req-count');
    if (countEl) {
      countEl.textContent = (total > 0 && done === total)
        ? 'Required fields: all complete'
        : 'Required fields: ' + done + ' of ' + total + ' complete';
    }
    var host = listHost();
    if (host) {
      while (host.firstChild) { host.removeChild(host.firstChild); }
      host.hidden = missing.length === 0;
      for (i = 0; i < missing.length; i += 1) {
        var item = document.createElement('li');
        item.className = 'ajdw-req-item';
        var jump = document.createElement('button');
        jump.type = 'button';
        jump.className = 'ajdw-req-jump';
        jump.textContent = labelFor(missing[i]);
        jump.setAttribute('data-ajdw-target', missing[i].id || '');
        jump.addEventListener('click', makeJump(missing[i]));
        item.appendChild(jump);
        host.appendChild(item);
      }
    }
    var gen = byId('ajdw-generate-button');
    if (gen) {
      if (total > 0 && done === total) {
        gen.disabled = false;
        gen.setAttribute('aria-disabled', 'false');
        gen.title = '';
      } else {
        gen.disabled = true;
        gen.setAttribute('aria-disabled', 'true');
        gen.title = 'Fill the required fields first';
      }
    }
    return { done: done, total: total };
  }

  function wireReq() {
    var form = briefForm();
    if (form && form.addEventListener && !form.ajdwReqWired) {
      form.ajdwReqWired = true;
      form.addEventListener('input', renderReq, true);
      form.addEventListener('change', renderReq, true);
      form.addEventListener('keyup', renderReq, true);
    }
    if (typeof document !== 'undefined' && document.addEventListener && !document.ajdwReqDocWired) {
      document.ajdwReqDocWired = true;
      document.addEventListener('input', renderReq, true);
      document.addEventListener('change', renderReq, true);
    }
    renderReq();
    setTimeout(renderReq, 300);
    setTimeout(renderReq, 1200);
  }

  function escapeSample(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function moveInList(list, from, to) {
    var copy = list.slice(0);
    if (from < 0 || from >= copy.length || to < 0 || to >= copy.length) { return copy; }
    var item = copy.splice(from, 1)[0];
    copy.splice(to, 0, item);
    return copy;
  }

  function clampOffset(offset, length) {
    var n = Number(offset);
    if (isNaN(n) || n < 0) { return 0; }
    if (n > length) { return length; }
    return n;
  }

  function buildChecks() {
    return [
      { name: 'boot', fn: function () {
        var stamped = typeof TOOL_BUILD === 'string' && /^\d{4}-\d{2}-\d{2}-\d+$/.test(TOOL_BUILD);
        return stamped && !!byId('ajdw-app-root');
      } },
      { name: 'params', fn: function () {
        var toolOk = typeof tool === 'undefined' || (tool && typeof tool.declareParams === 'function');
        return !!briefForm() && requiredFields().length > 0 && !!toolOk;
      } },
      { name: 'save roundtrip', fn: function () {
        var sample = { id: 'ajdw-selftest', version: 2, sections: [{ heading: 'Duties', bullets: ['a', 'b'] }] };
        var round = JSON.parse(JSON.stringify(sample));
        return round.id === sample.id && round.version === 2 && round.sections[0].bullets[1] === 'b';
      } },
      { name: 'section move', fn: function () {
        var moved = moveInList(['responsibilities', 'requirements', 'benefits'], 2, 0);
        return moved.length === 3 && moved[0] === 'benefits' && moved[1] === 'responsibilities';
      } },
      { name: 'bias anchor', fn: function () {
        var text = 'We need a rockstar ninja who works hard.';
        return clampOffset(9999, text.length) === text.length && clampOffset(-4, text.length) === 0 && clampOffset(7, text.length) === 7;
      } },
      { name: 'export escape', fn: function () {
        var escaped = escapeSample('<b onerror=x>bad</b>');
        return escaped.indexOf('<b') === -1 && escaped.indexOf('&lt;b') !== -1;
      } },
      { name: 'preview escape', fn: function () {
        var escaped = escapeSample('"><b>x</b>');
        return escaped.indexOf('<') === -1 && escaped.indexOf('&quot;') !== -1;
      } },
      { name: 'required gate', fn: function () {
        var state = renderReq();
        var gen = byId('ajdw-generate-button');
        if (!gen || state.total === 0) { return false; }
        return gen.disabled === (state.done !== state.total);
      } },
      { name: 'results panel', fn: function () {
        return !byId('ajdw-selftest-run');
      } }
    ];
  }

  function runSelfTest() {
    var checks = buildChecks();
    var results = [];
    var pass = 0;
    var fail = 0;
    var i;
    for (i = 0; i < checks.length; i += 1) {
      var ok = false;
      try { ok = checks[i].fn() === true; } catch (e) { ok = false; }
      results.push({ name: checks[i].name, pass: ok });
      console.log((ok ? 'PASS ' : 'FAIL ') + checks[i].name);
      if (ok) { pass += 1; } else { fail += 1; }
    }
    var header = byId('ajdw-selftest-header');
    if (header) {
      header.textContent = fail > 0
        ? 'Self test: ' + fail + ' failing'
        : 'Self test: ' + pass + ' of ' + results.length + ' passed';
    }
    var list = byId('ajdw-selftest-list');
    if (list) {
      while (list.firstChild) { list.removeChild(list.firstChild); }
      for (i = 0; i < results.length; i += 1) {
        var item = document.createElement('li');
        item.className = results[i].pass ? 'ajdw-selftest-pass' : 'ajdw-selftest-fail';
        item.textContent = (results[i].pass ? 'PASS ' : 'FAIL ') + results[i].name;
        list.appendChild(item);
      }
    }
    console.log('[TOOL:SELFTEST] summary pass ' + pass + ' fail ' + fail + ' total ' + results.length);
    return { pass: pass, fail: fail, total: results.length, results: results };
  }

  function wireSelfTest() {
    var button = byId('ajdw-selftest-run');
    if (button && button.addEventListener && !button.ajdwSelfTestWired) {
      button.ajdwSelfTestWired = true;
      button.addEventListener('click', function (event) {
        if (event && event.preventDefault) { event.preventDefault(); }
        runSelfTest();
      });
    }
  }

  function start() {
    wireSelfTest();
    wireReq();
    setTimeout(wireSelfTest, 400);
    setTimeout(renderReq, 900);
  }

  if (typeof window !== 'undefined') {
    window.ajdwRunSelfCheck = runSelfTest;
  }
  if (typeof document !== 'undefined') {
    if (typeof tool !== 'undefined' && tool && typeof tool.onReady === 'function') {
      tool.onReady(function () { start(); });
    }
    setTimeout(start, 0);
  }
}());
/* Batch B5 - T-54 one-click example brief and T-55 escaped preview rendering. */
function ajdwRenderPreviewInto(container, model) {
  if (!container) { return; }
  var styles = (typeof AJDW_STYLES !== 'undefined' && AJDW_STYLES) ? AJDW_STYLES : {};
  while (container.firstChild) { container.removeChild(container.firstChild); }
  var wrapper = document.createElement('div');
  if (styles.body) { wrapper.setAttribute('style', styles.body); }
  var h1 = document.createElement('h1');
  if (styles.h1) { h1.setAttribute('style', styles.h1); }
  h1.textContent = String(model && model.title != null ? model.title : '');
  wrapper.appendChild(h1);
  var sections = (model && model.sections) || [];
  for (var s = 0; s < sections.length; s++) {
    var section = sections[s];
    if (section.heading) {
      var h2 = document.createElement('h2');
      if (styles.h2) { h2.setAttribute('style', styles.h2); }
      h2.textContent = String(section.heading);
      wrapper.appendChild(h2);
    }
    var paragraphs = section.paragraphs || [];
    for (var p = 0; p < paragraphs.length; p++) {
      var para = document.createElement('p');
      if (styles.p) { para.setAttribute('style', styles.p); }
      var lines = String(paragraphs[p]).split('\n');
      for (var l = 0; l < lines.length; l++) {
        if (l > 0) { para.appendChild(document.createElement('br')); }
        para.appendChild(document.createTextNode(lines[l]));
      }
      wrapper.appendChild(para);
    }
    var bullets = section.bullets || [];
    if (bullets.length > 0) {
      var ul = document.createElement('ul');
      if (styles.ul) { ul.setAttribute('style', styles.ul); }
      for (var b = 0; b < bullets.length; b++) {
        var li = document.createElement('li');
        if (styles.li) { li.setAttribute('style', styles.li); }
        li.textContent = String(bullets[b]);
        ul.appendChild(li);
      }
      wrapper.appendChild(ul);
    }
  }
  container.appendChild(wrapper);
}
(function () {
  var tries = 0;
  function bind() {
    tries++;
    var panel = document.getElementById('ajdw-example-panel');
    var load = document.getElementById('ajdw-load-example');
    if (!panel || !load) {
      if (tries < 40 && typeof setTimeout === 'function') { setTimeout(bind, 50); }
      return;
    }
    if (load.getAttribute('data-ajdw-b5') === '1') { return; }
    load.setAttribute('data-ajdw-b5', '1');
    panel.addEventListener('click', function (ev) {
      var target = ev && ev.target;
      if (!target || target.id !== 'ajdw-load-example') { return; }
      if (ev.preventDefault) { ev.preventDefault(); }
      if (ev.stopPropagation) { ev.stopPropagation(); }
      if (typeof ajdwB2LoadExample === 'function') { ajdwB2LoadExample(); }
      if (typeof ajdwB2HideConfirm === 'function') { ajdwB2HideConfirm(); }
    }, true);
  }
  bind();
})();

/* B2 / T-60: strip tags on input, escape untrusted text in preview, add a top level recoverable error boundary. */
/* B2 / T-61: advert character limits (800 / 300 / 150) with live counts and an over-limit state. */
/* Additive layer only: no storage, no network, no framework, no ids or classes are renamed. */
(function () {
  if (typeof document === 'undefined') { return; }
  var AJDW_LIMITS = { standard: 800, short: 300, social: 150 };
  var AJDW_LABELS = { standard: 'Standard advert', short: 'Short advert', social: 'Social advert' };
  var AJDW_BOUNDARY_TEXT = 'Something went wrong. Your saved draft and preview are unchanged.';
  var AJDW_ALLOWED = ('DIV SECTION MAIN P H1 H2 H3 H4 H5 H6 UL OL LI STRONG EM B I U BR SPAN BUTTON LABEL '
    + 'TEXTAREA INPUT SELECT OPTION TABLE THEAD TBODY TR TD TH PRE CODE BLOCKQUOTE HR SMALL FORM '
    + 'ARTICLE HEADER FOOTER NAV TIME').split(' ');
  var bound = false;
  var pending = false;
  var scrubbing = false;

  function stripTags(value) {
    return String(value == null ? '' : value).replace(/<[^>]*>/g, '');
  }

  function escapeText(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  if (typeof window !== 'undefined') {
    window.ajdwStripTags = stripTags;
    window.ajdwEscapeUntrusted = escapeText;
  }

  function allowedTag(tag) {
    var upper = String(tag || '').toUpperCase();
    for (var i = 0; i < AJDW_ALLOWED.length; i += 1) {
      if (AJDW_ALLOWED[i] === upper) { return true; }
    }
    return false;
  }

  function scrubNode(root) {
    if (!root || !root.querySelectorAll) { return; }
    var nodes = root.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!node || !node.parentNode) { continue; }
      if (!allowedTag(node.tagName)) {
        node.parentNode.replaceChild(document.createTextNode(node.textContent || ''), node);
        continue;
      }
      var attrs = node.attributes || [];
      for (var a = attrs.length - 1; a >= 0; a -= 1) {
        var name = String(attrs[a].name || '').toLowerCase();
        var val = String(attrs[a].value || '');
        if (name.indexOf('on') === 0 || (/(href|src)/.test(name) && /javascript:/i.test(val))) {
          if (typeof node.removeAttribute === 'function') { node.removeAttribute(attrs[a].name); }
        }
      }
    }
  }

  function scrubPreview() {
    if (scrubbing) { return; }
    scrubbing = true;
    try {
      scrubNode(document.getElementById('ajdw-preview-body'));
      scrubNode(document.getElementById('ajdw-main'));
    } catch (err) {
      /* keep the preview usable even if a node cannot be scrubbed */
    } finally {
      scrubbing = false;
    }
  }

  function activeTabKey() {
    var tabs = document.querySelectorAll('[data-ajdw-tab]');
    for (var i = 0; i < tabs.length; i += 1) {
      if (tabs[i].getAttribute('aria-selected') === 'true') {
        return String(tabs[i].getAttribute('data-ajdw-tab') || '');
      }
    }
    return 'jd';
  }

  function advertCount(key) {
    var field = document.getElementById('ajdw-advert-' + key);
    if (field && typeof field.value === 'string' && field.value !== '') { return field.value.length; }
    var counter = document.getElementById('ajdw-advert-count-' + key);
    var match = counter ? /(\d+)/.exec(counter.textContent || '') : null;
    if (match) { return parseInt(match[1], 10); }
    var fallback = document.querySelector('#ajdw-advert-' + key + ', [data-ajdw-advert="' + key + '"] textarea');
    if (fallback && typeof fallback.value === 'string') { return fallback.value.length; }
    return 0;
  }

  function refreshCounts() {
    var node = document.getElementById('ajdw-advert-limit');
    if (!node) { return; }
    var key = activeTabKey();
    var limit = AJDW_LIMITS[key];
    var tab = document.getElementById('ajdw-tab-' + key);
    if (!limit) {
      node.hidden = true;
      node.textContent = '';
      node.className = 'ajdw-advert-limit ajdw-controls';
      return;
    }
    var count = advertCount(key);
    var over = count > limit;
    node.hidden = false;
    node.textContent = AJDW_LABELS[key] + ': ' + count + ' of ' + limit + ' characters'
      + (over ? ' - ' + (count - limit) + ' over the limit' : ' - ' + (limit - count) + ' left');
    node.className = 'ajdw-advert-limit ajdw-controls' + (over ? ' ajdw-advert-limit--over' : '');
    node.setAttribute('data-ajdw-over', over ? '1' : '0');
    if (tab && tab.classList) {
      if (over) { tab.classList.add('ajdw-tab--over'); } else { tab.classList.remove('ajdw-tab--over'); }
    }
  }

  function ensureLimitNode() {
    if (document.getElementById('ajdw-advert-limit')) { return; }
    var meta = document.getElementById('ajdw-preview-meta');
    if (!meta || !meta.parentNode) { return; }
    var node = document.createElement('p');
    node.id = 'ajdw-advert-limit';
    node.className = 'ajdw-advert-limit ajdw-controls';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    node.hidden = true;
    meta.parentNode.insertBefore(node, meta.nextSibling);
  }

  function decorateTabs() {
    var keys = ['standard', 'short', 'social'];
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      var tab = document.getElementById('ajdw-tab-' + key);
      if (!tab || tab.getAttribute('data-ajdw-limit') === '1') { continue; }
      var span = document.createElement('span');
      span.className = 'ajdw-tab-limit';
      span.textContent = 'max ' + AJDW_LIMITS[key];
      tab.appendChild(document.createTextNode(' '));
      tab.appendChild(span);
      tab.setAttribute('data-ajdw-limit', '1');
      tab.setAttribute('title', AJDW_LABELS[key] + ' maximum ' + AJDW_LIMITS[key] + ' characters');
    }
  }

  function removeDevHarness() {
    var root = document.getElementById('ajdw-app-root') || document.body;
    if (!root || !root.querySelectorAll) { return; }
    var nodes = root.querySelectorAll('.ajdw-dev-harness, [data-ajdw-dev-harness], [id*="harness"], [class*="ajdw-harness"]');
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (!node || node.id === 'ajdw-app-root' || !node.parentNode) { continue; }
      node.parentNode.removeChild(node);
    }
  }

  function boundaryNode() {
    return document.getElementById('ajdw-error-boundary');
  }

  function resync(context) {
    var status = document.getElementById('ajdw-status');
    if (status) {
      status.textContent = 'Recovered from an error while ' + context
        + '. Autosave is paused for this step; your last saved draft is unchanged. Retry the step or keep editing.';
      status.className = 'ajdw-status ajdw-status--error';
    }
    var form = document.getElementById('ajdw-role-brief-form');
    if (form) { form.removeAttribute('aria-busy'); }
    var generate = document.getElementById('ajdw-generate-button');
    if (generate) { generate.removeAttribute('aria-busy'); }
    var retry = document.getElementById('ajdw-retry-button');
    if (retry) { retry.hidden = false; retry.disabled = false; }
    try { refreshCounts(); } catch (err) { /* counts are best effort */ }
    var key = activeTabKey();
    var tab = document.getElementById('ajdw-tab-' + key);
    if (tab && typeof tab.click === 'function') {
      try { tab.click(); } catch (err2) { /* preview refresh is best effort */ }
    }
  }

  function showError(context, detail) {
    var text = document.getElementById('ajdw-error-boundary-text');
    if (text) {
      text.textContent = AJDW_BOUNDARY_TEXT + ' (' + context + ')' + (detail ? ' ' + String(detail).slice(0, 160) : '');
    }
    var node = boundaryNode();
    if (node) { node.hidden = false; }
    try { resync(context); } catch (err) { /* recovery must never throw */ }
  }

  function handleGlobal(event) {
    var message = '';
    if (event && event.message) { message = String(event.message); }
    else if (event && event.reason && event.reason.message) { message = String(event.reason.message); }
    showError('the last action', escapeText(message));
  }

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('error', function (event) {
      if (!event || (!event.message && !event.error)) { return; }
      handleGlobal(event);
    });
    window.addEventListener('unhandledrejection', function (event) {
      handleGlobal(event);
    });
  }

  function onInput(event) {
    var el = event && event.target;
    if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) { return; }
    if (el.type === 'password' || el.type === 'file') { return; }
    var value = el.value;
    if (typeof value !== 'string' || value.indexOf('<') === -1) { return; }
    var clean = stripTags(value);
    if (clean !== value) { el.value = clean; }
  }

  function safeRun() {
    try { scrubPreview(); } catch (err) { /* scrub is best effort */ }
    try { refreshCounts(); } catch (err2) { /* counts are best effort */ }
  }

  function schedule() {
    if (pending) { return; }
    pending = true;
    setTimeout(function () { pending = false; safeRun(); }, 0);
  }

  function observe() {
    if (typeof MutationObserver !== 'function') { return; }
    var targets = [document.getElementById('ajdw-main'), document.getElementById('ajdw-preview-body')];
    for (var i = 0; i < targets.length; i += 1) {
      if (!targets[i]) { continue; }
      try {
        new MutationObserver(schedule).observe(targets[i], { childList: true, subtree: true, characterData: true });
      } catch (err) { /* observation is optional */ }
    }
  }

  function bindEvents() {
    if (bound) { return; }
    bound = true;
    document.addEventListener('input', function (event) { onInput(event); schedule(); }, true);
    document.addEventListener('change', function (event) { onInput(event); schedule(); }, true);
    document.addEventListener('click', function () { schedule(); }, true);
    var dismiss = document.getElementById('ajdw-error-boundary-dismiss');
    if (dismiss) {
      dismiss.addEventListener('click', function () {
        var node = boundaryNode();
        if (node) { node.hidden = true; }
      });
    }
    var retry = document.getElementById('ajdw-error-boundary-retry');
    if (retry) {
      retry.addEventListener('click', function () {
        var node = boundaryNode();
        if (node) { node.hidden = true; }
        var generate = document.getElementById('ajdw-generate-button');
        if (generate && !generate.disabled && typeof generate.click === 'function') { generate.click(); }
      });
    }
    observe();
  }

  function boot() {
    try { removeDevHarness(); } catch (e1) { /* harness removal is best effort */ }
    try { ensureLimitNode(); } catch (e2) { /* limit node is optional */ }
    try { decorateTabs(); } catch (e3) { /* tab labels are optional */ }
    try { bindEvents(); } catch (e4) { /* binding is best effort */ }
    safeRun();
  }

  setTimeout(boot, 0);
  setTimeout(boot, 300);
})();

/* ---- B3 T-62: confirm before Generate draft replaces edited sections ---- */
/* ---- B3 T-63: safe Clear form, nothing is emptied or deleted without a confirm ---- */
var AJDW_T62_TOUCHED = {};
var AJDW_T62_COUNT = 0;
var AJDW_T62_BYPASS = false;

function ajdwSafeStatus(message) {
  if (typeof document === 'undefined' || !document.getElementById) { return; }
  var status = document.getElementById('ajdw-status');
  if (status) { status.textContent = message; }
  var panel = document.getElementById('ajdw-editor-status');
  var text = document.getElementById('ajdw-editor-status-text');
  if (panel) { panel.hidden = false; }
  if (text) { text.textContent = message; }
}

function ajdwT62Host(node) {
  var el = node;
  var guard = 0;
  while (el && el !== document.body && guard < 40) {
    guard += 1;
    if (typeof el.className === 'string' && el.className.indexOf('ajdw-section') !== -1) { return el; }
    if (el.id && el.id.indexOf('ajdw-section-') === 0) { return el; }
    el = el.parentNode;
  }
  return null;
}

function ajdwT62Name(host) {
  if (!host) { return 'the current sections'; }
  if (host.getAttribute) {
    var attr = host.getAttribute('data-section-name') || host.getAttribute('data-ajdw-name') || '';
    if (attr) { return attr; }
  }
  var label = (host.querySelector ? host.querySelector('.ajdw-section-name, .ajdw-section-title, .ajdw-section-heading, h2, h3, h4') : null);
  var text = label && label.textContent ? label.textContent.replace(/\s+/g, ' ').trim() : '';
  if (text) { return text.slice(0, 60); }
  return 'a section';
}

function ajdwT62Remember(host) {
  var key = (host && host.id) ? host.id : 'ajdw-t62-unknown-' + AJDW_T62_COUNT;
  if (AJDW_T62_TOUCHED[key]) { return; }
  AJDW_T62_TOUCHED[key] = ajdwT62Name(host);
  AJDW_T62_COUNT += 1;
}

function ajdwT62Reset() {
  AJDW_T62_TOUCHED = {};
  AJDW_T62_COUNT = 0;
}

function ajdwT62List() {
  var names = [];
  var key = '';
  for (key in AJDW_T62_TOUCHED) {
    if (Object.prototype.hasOwnProperty.call(AJDW_T62_TOUCHED, key)) { names.push(AJDW_T62_TOUCHED[key]); }
  }
  return names;
}

function ajdwT62HideConfirm() {
  var row = document.getElementById('ajdw-generate-confirm');
  if (row && row.parentNode) { row.parentNode.removeChild(row); }
}

function ajdwT62RunGenerate() {
  var button = document.getElementById('ajdw-generate-button');
  var form = document.getElementById('ajdw-role-brief-form');
  ajdwT62HideConfirm();
  ajdwT62Reset();
  AJDW_T62_BYPASS = true;
  try {
    if (button && typeof button.click === 'function') {
      button.click();
    } else if (form && typeof form.dispatchEvent === 'function') {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  } finally {
    AJDW_T62_BYPASS = false;
  }
}

function ajdwT62AskConfirm(button) {
  if (document.getElementById('ajdw-generate-confirm')) { return; }
  var names = ajdwT62List();
  var label = names.length ? names.join(', ') : 'the current sections';
  var row = document.createElement('span');
  row.className = 'ajdw-confirm-row';
  row.id = 'ajdw-generate-confirm';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Confirm replacing edited sections');
  var question = document.createElement('span');
  question.className = 'ajdw-confirm-text';
  question.textContent = 'Generating again replaces ' + label + '. Replace now? ';
  var replace = document.createElement('button');
  replace.type = 'button';
  replace.className = 'ajdw-button ajdw-button--small ajdw-button--danger';
  replace.id = 'ajdw-generate-confirm-replace';
  replace.textContent = 'Replace sections';
  replace.addEventListener('click', function () { ajdwT62RunGenerate(); });
  var cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'ajdw-button ajdw-button--small ajdw-button--ghost';
  cancel.id = 'ajdw-generate-confirm-cancel';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', function () {
    ajdwT62HideConfirm();
    ajdwSafeStatus('Generation cancelled. Your sections are unchanged.');
    var btn = document.getElementById('ajdw-generate-button');
    if (btn && typeof btn.focus === 'function') { btn.focus(); }
  });
  row.appendChild(question);
  row.appendChild(replace);
  row.appendChild(cancel);
  var anchor = button || document.getElementById('ajdw-generate-button');
  if (anchor && anchor.parentNode) {
    anchor.parentNode.insertBefore(row, anchor.nextSibling);
  } else {
    var status = document.getElementById('ajdw-status');
    if (status && status.parentNode) { status.parentNode.insertBefore(row, status.nextSibling); }
  }
  ajdwSafeStatus('Confirm to replace ' + label + '. Nothing has changed yet.');
}

function ajdwT62IsGenerate(button) {
  if (!button) { return false; }
  if ((button.id || '') === 'ajdw-generate-button') { return true; }
  var text = (button.textContent || '').replace(/\s+/g, ' ').trim();
  if (text !== 'Generate draft') { return false; }
  return !!(button.closest && button.closest('#ajdw-role-brief-form'));
}

function ajdwT62MarkRemove(button) {
  var action = button.getAttribute ? (button.getAttribute('data-action') || '') : '';
  var id = button.id || '';
  var text = (button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  var looksRemove = action === 'remove' || action === 'delete' || id.indexOf('ajdw-section-remove') === 0 || id.indexOf('ajdw-remove-section') === 0 || text === 'remove' || text === 'remove section';
  if (!looksRemove) { return; }
  var host = ajdwT62Host(button);
  if (host) { ajdwT62Remember(host); }
}

/* ---- T-63: Clear form confirm ---- */
function ajdwT63HideConfirm() {
  var row = document.getElementById('ajdw-clear-form-confirm');
  if (row && row.parentNode) { row.parentNode.removeChild(row); }
  var button = document.getElementById('ajdw-clear-form');
  if (button) { button.hidden = false; }
}

function ajdwT63ClearAllFields() {
  var form = document.getElementById('ajdw-role-brief-form');
  if (!form || typeof form.querySelectorAll !== 'function') { return; }
  var fields = form.querySelectorAll('input, textarea, select');
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    var type = (field.type || '').toLowerCase();
    if (type === 'checkbox' || type === 'radio' || type === 'file' || type === 'submit' || type === 'button' || type === 'hidden') { continue; }
    if (field.value === '') { continue; }
    field.value = '';
    try { field.dispatchEvent(new Event('input', { bubbles: true })); } catch (err1) { }
    try { field.dispatchEvent(new Event('change', { bubbles: true })); } catch (err2) { }
  }
}

function ajdwT63ResetSections() {
  var done = false;
  try {
    if (typeof jdSections !== 'undefined' && typeof renderSections === 'function') {
      jdSections = [];
      if (typeof currentAdverts !== 'undefined') { currentAdverts = {}; }
      renderSections();
      if (typeof updatePreview === 'function') { updatePreview(); }
      if (typeof ajdwSaveNow === 'function') { ajdwSaveNow(); }
      done = true;
    }
  } catch (err) { done = false; }
  if (done) { return true; }
  var clearDraft = document.getElementById('ajdw-clear-draft');
  if (clearDraft && typeof clearDraft.click === 'function') {
    clearDraft.click();
    var remove = document.getElementById('ajdw-clear-confirm-remove');
    if (remove && typeof remove.click === 'function') { remove.click(); return true; }
    var cancel = document.getElementById('ajdw-clear-confirm-cancel');
    if (cancel && typeof cancel.click === 'function') { cancel.click(); }
  }
  return false;
}

function ajdwT63DoClear() {
  ajdwT63HideConfirm();
  ajdwT62HideConfirm();
  ajdwT62Reset();
  if (typeof ajdwB2ClearForm === 'function') { ajdwB2ClearForm(); }
  ajdwT63ClearAllFields();
  ajdwT63ResetSections();
  ajdwSafeStatus('Form cleared. Generated sections were reset. Fill the required fields to enable Generate draft.');
}

function ajdwClearFormAsk(button) {
  if (document.getElementById('ajdw-clear-form-confirm')) { return; }
  var anchor = button || document.getElementById('ajdw-clear-form');
  var row = document.createElement('span');
  row.className = 'ajdw-confirm-row';
  row.id = 'ajdw-clear-form-confirm';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Confirm clearing the role brief');
  var question = document.createElement('span');
  question.className = 'ajdw-confirm-text';
  question.textContent = 'Clear every Role brief field and reset the generated sections? ';
  var all = document.createElement('button');
  all.type = 'button';
  all.className = 'ajdw-button ajdw-button--small ajdw-button--danger';
  all.id = 'ajdw-clear-form-confirm-all';
  all.textContent = 'Clear all';
  all.addEventListener('click', function () { ajdwT63DoClear(); });
  var keep = document.createElement('button');
  keep.type = 'button';
  keep.className = 'ajdw-button ajdw-button--small ajdw-button--ghost';
  keep.id = 'ajdw-clear-form-confirm-keep';
  keep.textContent = 'Keep editing';
  keep.addEventListener('click', function () {
    ajdwT63HideConfirm();
    ajdwSafeStatus('Clear cancelled. Every field is unchanged.');
    var btn = document.getElementById('ajdw-clear-form');
    if (btn && typeof btn.focus === 'function') { btn.focus(); }
  });
  row.appendChild(question);
  row.appendChild(all);
  row.appendChild(keep);
  if (anchor && anchor.parentNode) {
    anchor.parentNode.insertBefore(row, anchor.nextSibling);
    anchor.hidden = true;
  } else {
    var status = document.getElementById('ajdw-status');
    if (status && status.parentNode) { status.parentNode.insertBefore(row, status.nextSibling); }
  }
  ajdwSafeStatus('Confirm clearing the form. Nothing has changed yet.');
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('input', function (event) {
    var target = event.target;
    if (!target || !target.tagName) { return; }
    if (target.closest && target.closest('#ajdw-role-brief-form')) { return; }
    var host = ajdwT62Host(target);
    if (host) { ajdwT62Remember(host); }
  }, true);

  document.addEventListener('change', function (event) {
    var target = event.target;
    if (!target || !target.tagName) { return; }
    if (target.closest && target.closest('#ajdw-role-brief-form')) { return; }
    var host = ajdwT62Host(target);
    if (host) { ajdwT62Remember(host); }
  }, true);

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || typeof target.closest !== 'function') { return; }
    var button = target.closest('button');
    if (!button) { return; }
    if (button.closest('#ajdw-generate-confirm') || button.closest('#ajdw-clear-form-confirm') || button.closest('#ajdw-clear-confirm')) { return; }
    if (ajdwT62IsGenerate(button)) {
      if (AJDW_T62_BYPASS) { return; }
      if (AJDW_T62_COUNT > 0) {
        event.preventDefault();
        if (typeof event.stopImmediatePropagation === 'function') { event.stopImmediatePropagation(); }
        event.stopPropagation();
        ajdwT62AskConfirm(button);
      }
      return;
    }
    ajdwT62MarkRemove(button);
  }, true);

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!form || form.id !== 'ajdw-role-brief-form') { return; }
    if (AJDW_T62_BYPASS) { return; }
    if (AJDW_T62_COUNT > 0) {
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') { event.stopImmediatePropagation(); }
      event.stopPropagation();
      ajdwT62AskConfirm(document.getElementById('ajdw-generate-button'));
    }
  }, true);
}

/* T-67: Versions panel and Import JSON control for the save area. Additive, defensive, no storage or network of its own beyond the tool SDK. */
(function () {
  'use strict';
  if (typeof document === 'undefined' || typeof window === 'undefined') { return; }

  var PANEL_ID = 'ajdw-save-panel';
  var ROWS_ID = 'ajdw-version-rows';
  var EMPTY_ID = 'ajdw-versions-empty';
  var CONFIRM_ID = 'ajdw-import-confirm';
  var FILE_ID = 'ajdw-import-file';
  var VERSION_KEY = (typeof AJDW_VERSION_KEY === 'string' && AJDW_VERSION_KEY) ? AJDW_VERSION_KEY : 'ajdw-version-history-v1';
  var APP_ID = (typeof AJDW_APP_ID === 'string' && AJDW_APP_ID) ? AJDW_APP_ID : 'ajdw-jd-studio';
  var MAX_VERSIONS = 10;
  var CONFIRM_TEXT = 'Replace the current draft with this backup? Your current draft is saved as a version first.';
  var NOT_BACKUP_TEXT = 'That file is not a JD Studio backup. Nothing was changed.';
  var EMPTY_TEXT = 'No saved versions yet. Every save you make appears here.';
  var FIELD_MAP = [
    { id: 'ajdw-role-title', key: 'roleTitle' },
    { id: 'ajdw-department', key: 'department' },
    { id: 'ajdw-location', key: 'location' },
    { id: 'ajdw-employment-type', key: 'employmentType' },
    { id: 'ajdw-seniority', key: 'seniority' },
    { id: 'ajdw-salary', key: 'salary' },
    { id: 'ajdw-summary', key: 'summary' },
    { id: 'ajdw-duties', key: 'duties' },
    { id: 'ajdw-requirements', key: 'requirements' },
    { id: 'ajdw-company-context', key: 'companyContext' },
    { id: 'ajdw-tone', key: 'tone' }
  ];
  var pendingBackup = null;
  var renderTimer = null;
  var observer = null;

  function toText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
  }

  function storageGet(key) {
    try {
      if (typeof tool !== 'undefined' && tool && tool.storage && typeof tool.storage.get === 'function') { return tool.storage.get(key); }
    } catch (err) {}
    return null;
  }

  function storageSet(key, value) {
    try {
      if (typeof tool !== 'undefined' && tool && tool.storage && typeof tool.storage.set === 'function') { tool.storage.set(key, value); return true; }
    } catch (err) {}
    return false;
  }

  function listFrom(raw) {
    if (!raw) { return []; }
    var value = raw;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch (err) { return []; }
    }
    if (Object.prototype.toString.call(value) === '[object Array]') { return value; }
    if (value && Object.prototype.toString.call(value.versions) === '[object Array]') { return value.versions; }
    if (value && Object.prototype.toString.call(value.items) === '[object Array]') { return value.items; }
    return [];
  }

  function readVersions() {
    var list = listFrom(storageGet(VERSION_KEY));
    if (!list.length) {
      try { list = listFrom(window.ajdwVersionList); } catch (err) { list = []; }
    }
    return list;
  }

  function briefOf(record) {
    if (!record || typeof record !== 'object') { return {}; }
    if (record.brief && typeof record.brief === 'object') { return record.brief; }
    if (record.fields && typeof record.fields === 'object') { return record.fields; }
    if (record.draft && record.draft.brief && typeof record.draft.brief === 'object') { return record.draft.brief; }
    return record;
  }

  function pick(source, keys) {
    if (!source || typeof source !== 'object') { return ''; }
    for (var i = 0; i < keys.length; i += 1) {
      var value = source[keys[i]];
      if (value != null && toText(value) !== '') { return toText(value); }
    }
    return '';
  }

  function versionTitle(record) {
    var brief = briefOf(record);
    var title = pick(brief, ['roleTitle', 'role_title', 'title', 'ajdw-role-title']);
    if (!title) { title = pick(record, ['roleTitle', 'title', 'name']); }
    return title || 'Untitled role';
  }

  function versionNumber(record, fallback) {
    if (record && typeof record === 'object') {
      var raw = record.version != null ? record.version : (record.versionNumber != null ? record.versionNumber : record.v);
      if (raw != null && !isNaN(Number(raw)) && Number(raw) > 0) { return Math.floor(Number(raw)); }
    }
    return fallback;
  }

  function versionTime(record) {
    var raw = null;
    if (record && typeof record === 'object') {
      var keys = ['savedAt', 'saved_at', 'timestamp', 'createdAt', 'at', 'date', 'savedAtIso'];
      for (var i = 0; i < keys.length; i += 1) {
        if (record[keys[i]]) { raw = record[keys[i]]; break; }
      }
    }
    if (!raw) { return 'date not recorded'; }
    var date = new Date(raw);
    if (!isNaN(date.getTime())) {
      var pad = function (n) { return n < 10 ? '0' + n : String(n); };
      return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
    }
    return toText(raw) || 'date not recorded';
  }

  function setStatus(text) {
    var node = document.getElementById('ajdw-status');
    if (node) { node.textContent = text; return; }
    var alt = document.getElementById('ajdw-versions-status');
    if (alt) { alt.textContent = text; }
  }

  function currentBrief() {
    var out = {};
    for (var i = 0; i < FIELD_MAP.length; i += 1) {
      var field = FIELD_MAP[i];
      var node = document.getElementById(field.id);
      out[field.key] = node ? String(node.value == null ? '' : node.value) : '';
    }
    return out;
  }

  function fillFields(record) {
    var source = briefOf(record);
    var filled = 0;
    for (var i = 0; i < FIELD_MAP.length; i += 1) {
      var field = FIELD_MAP[i];
      var node = document.getElementById(field.id);
      if (!node) { continue; }
      var value = source[field.key];
      if (value == null) { value = source[field.id]; }
      if (value == null) { continue; }
      node.value = String(value);
      filled += 1;
      try { node.dispatchEvent(new Event('input', { bubbles: true })); } catch (err) {}
      try { node.dispatchEvent(new Event('change', { bubbles: true })); } catch (err) {}
    }
    return filled;
  }

  function pushVersion(record) {
    var list = readVersions().slice(0);
    list.unshift(record);
    if (list.length > MAX_VERSIONS) { list = list.slice(0, MAX_VERSIONS); }
    var payload = { versions: list, appId: APP_ID, savedAt: new Date().toISOString() };
    var ok = false;
    try {
      if (typeof ajdwStorageWrite === 'function') { ajdwStorageWrite(VERSION_KEY, payload); ok = true; }
    } catch (err) { ok = false; }
    if (!ok) { ok = storageSet(VERSION_KEY, payload); }
    render();
    return ok;
  }

  function restoreVersion(record, number) {
    fillFields(record);
    var line = 'Restored v' + number + ' of ' + versionTitle(record);
    setStatus(line);
    var versionsStatus = document.getElementById('ajdw-versions-status');
    if (versionsStatus) { versionsStatus.textContent = line; }
  }

  function showConfirm(visible) {
    var box = document.getElementById(CONFIRM_ID);
    if (!box) { return; }
    box.hidden = !visible;
    if (!visible) { pendingBackup = null; }
  }

  function isBackup(data) {
    if (!data || typeof data !== 'object') { return false; }
    var id = data.appId || data.appID || data.applicationId || (data.meta && data.meta.appId);
    if (id && String(id) === APP_ID) { return true; }
    var hasContent = !!(data.brief || data.draft || data.sections);
    return !!(hasContent && (data.schemaVersion || data.ajdwSchemaVersion));
  }

  function applyBackup() {
    if (!pendingBackup) { return; }
    var incoming = pendingBackup;
    pendingBackup = null;
    showConfirm(false);
    var brief = currentBrief();
    pushVersion({
      roleTitle: toText(brief.roleTitle) || 'Untitled role',
      brief: brief,
      savedAt: new Date().toISOString(),
      source: 'before-import'
    });
    var target = (incoming.brief && typeof incoming.brief === 'object') ? incoming.brief : incoming;
    if (!target || typeof target !== 'object') {
      target = (incoming.draft && typeof incoming.draft === 'object') ? incoming.draft : {};
    }
    fillFields({ brief: target });
    setStatus('Backup applied. Your previous draft is saved as a version.');
  }

  function handleFile(file) {
    if (!file) { return; }
    if (typeof FileReader !== 'function') {
      setStatus(NOT_BACKUP_TEXT);
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var data = null;
      try { data = JSON.parse(String(reader.result == null ? '' : reader.result)); } catch (err) { data = null; }
      if (!isBackup(data)) {
        showConfirm(false);
        setStatus(NOT_BACKUP_TEXT);
        return;
      }
      pendingBackup = data;
      showConfirm(true);
      var question = document.getElementById('ajdw-import-question');
      if (question) { question.textContent = CONFIRM_TEXT; }
    };
    reader.onerror = function () {
      showConfirm(false);
      setStatus(NOT_BACKUP_TEXT);
    };
    reader.readAsText(file);
  }

  function buildConfirm(panel) {
    var box = document.createElement('div');
    box.className = 'ajdw-import-confirm ajdw-controls';
    box.id = CONFIRM_ID;
    box.hidden = true;
    var question = document.createElement('p');
    question.className = 'ajdw-import-question';
    question.id = 'ajdw-import-question';
    question.textContent = CONFIRM_TEXT;
    var actions = document.createElement('div');
    actions.className = 'ajdw-actions';
    var apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'ajdw-button ajdw-button--small';
    apply.id = 'ajdw-import-apply';
    apply.textContent = 'Yes, replace draft';
    apply.addEventListener('click', function () { applyBackup(); });
    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'ajdw-button ajdw-button--small ajdw-button--ghost';
    cancel.id = 'ajdw-import-cancel';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', function () { showConfirm(false); setStatus('Import cancelled. Nothing was changed.'); });
    actions.appendChild(apply);
    actions.appendChild(cancel);
    box.appendChild(question);
    box.appendChild(actions);
    panel.appendChild(box);
  }

  function buildPanel(host) {
    var panel = document.createElement('div');
    panel.className = 'ajdw-save-panel ajdw-controls';
    panel.id = PANEL_ID;

    var bar = document.createElement('div');
    bar.className = 'ajdw-actions ajdw-import-actions';
    var importButton = document.createElement('button');
    importButton.type = 'button';
    importButton.className = 'ajdw-button ajdw-button--small';
    importButton.id = 'ajdw-import-json';
    importButton.textContent = 'Import JSON';
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = FILE_ID;
    fileInput.className = 'ajdw-import-file';
    fileInput.setAttribute('accept', '.json,application/json');
    fileInput.hidden = true;
    importButton.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files.length ? fileInput.files[0] : null;
      handleFile(file);
      try { fileInput.value = ''; } catch (err) {}
    });
    bar.appendChild(importButton);
    bar.appendChild(fileInput);
    panel.appendChild(bar);

    buildConfirm(panel);

    var empty = document.createElement('p');
    empty.className = 'ajdw-hint';
    empty.id = EMPTY_ID;
    empty.textContent = EMPTY_TEXT;
    panel.appendChild(empty);

    var rows = document.createElement('ul');
    rows.className = 'ajdw-version-rows';
    rows.id = ROWS_ID;
    rows.hidden = true;
    panel.appendChild(rows);

    host.appendChild(panel);
    return panel;
  }

  function ensurePanel() {
    var host = document.getElementById('ajdw-versions');
    if (!host) { return null; }
    var panel = document.getElementById(PANEL_ID);
    if (panel && panel.parentNode === host) { return panel; }
    if (panel && panel.parentNode) { panel.parentNode.removeChild(panel); }
    return buildPanel(host);
  }

  function renderRows(panel, list) {
    var rows = document.getElementById(ROWS_ID);
    var empty = document.getElementById(EMPTY_ID);
    if (!rows || !empty) { return; }
    while (rows.firstChild) { rows.removeChild(rows.firstChild); }
    if (!list.length) {
      rows.hidden = true;
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    rows.hidden = false;
    for (var i = 0; i < list.length; i += 1) {
      var record = list[i];
      var number = versionNumber(record, list.length - i);
      var item = document.createElement('li');
      item.className = 'ajdw-version-row';
      item.setAttribute('data-ajdw-version', String(number));

      var title = document.createElement('span');
      title.className = 'ajdw-version-title';
      title.textContent = versionTitle(record);

      var badge = document.createElement('span');
      badge.className = 'ajdw-version-number';
      badge.textContent = 'v' + number;

      var when = document.createElement('span');
      when.className = 'ajdw-version-time';
      when.textContent = versionTime(record);

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'ajdw-button ajdw-button--small ajdw-button--ghost ajdw-version-restore';
      button.textContent = 'Restore';
      button.setAttribute('data-ajdw-version', String(number));
      (function (saved, num) {
        button.addEventListener('click', function () { restoreVersion(saved, num); });
      })(record, number);

      item.appendChild(title);
      item.appendChild(badge);
      item.appendChild(when);
      item.appendChild(button);
      rows.appendChild(item);
    }
  }

  function render() {
    var host = document.getElementById('ajdw-versions');
    if (!host) { return; }
    var panel = ensurePanel();
    if (!panel) { return; }
    renderRows(panel, readVersions());
  }

  function renderSoon(delay) {
    if (renderTimer) { return; }
    renderTimer = setTimeout(function () {
      renderTimer = null;
      render();
    }, typeof delay === 'number' ? delay : 150);
  }

  function watchHost() {
    var host = document.getElementById('ajdw-versions');
    if (!host || observer || typeof MutationObserver !== 'function') { return; }
    observer = new MutationObserver(function () { renderSoon(60); });
    observer.observe(host, { childList: true });
  }

  function hookWrites() {
    try {
      var base = window.ajdwStorageWrite;
      if (typeof base === 'function' && !base.__ajdwVersionHook) {
        var wrapped = function (key) {
          var out = base.apply(this, arguments);
          if (String(key) === VERSION_KEY) { renderSoon(60); }
          return out;
        };
        wrapped.__ajdwVersionHook = true;
        window.ajdwStorageWrite = wrapped;
      }
    } catch (err) {}
  }

  function boot() {
    hookWrites();
    render();
    watchHost();
    setTimeout(render, 300);
    setTimeout(render, 1200);
    try {
      document.addEventListener('input', function () { renderSoon(900); }, true);
      document.addEventListener('change', function () { renderSoon(900); }, true);
    } catch (err) {}
  }

  if (typeof tool !== 'undefined' && tool && typeof tool.onReady === 'function') {
    tool.onReady(function () { boot(); });
  } else {
    setTimeout(boot, 0);
  }
})();

/* T-70 / T-71: version cap per brief and workspace-storage recovery.
   These helpers live in the file scope so the main closure can call them after boot,
   and they never touch browser storage directly: every write still goes through the tool SDK. */
var AJDW_B1_MAX_PER_BRIEF = 10;
var AJDW_B1_QUOTA_TEXT = 'Workspace storage is full. Download a JSON backup to keep this draft.';
var AJDW_B1_DOWNLOADED_TEXT = 'Backup downloaded. Clear old versions to free space.';
var AJDW_B1_KEEP_TEXT = '11 versions kept \u2014 oldest removed to stay within the last 10.';
var ajdwB1Tries = 0;
var ajdwB1Wired = false;

function ajdwB1BriefKey(item) {
  if (!item || typeof item !== 'object') { return 'draft'; }
  var key = item.briefId || item.draftId || item.id || '';
  if (!key && item.record && typeof item.record === 'object') {
    key = item.record.briefId || item.record.draftId || '';
  }
  return key ? String(key) : 'draft';
}

function ajdwB1Stamp(item) {
  var when = (item && item.savedAt) ? new Date(item.savedAt).getTime() : 0;
  return isNaN(when) ? 0 : when;
}

/* Keeps the newest 10 per brief. The newest entry of a brief is never removed, so the
   version currently loaded in the editor always survives a prune. */
function ajdwB1PruneVersions(list) {
  if (!list || !list.length) { return { list: [], removed: 0 }; }
  var sorted = list.slice(0).sort(function (a, b) { return ajdwB1Stamp(b) - ajdwB1Stamp(a); });
  var kept = [];
  var counts = {};
  var removed = 0;
  sorted.forEach(function (item) {
    var key = ajdwB1BriefKey(item);
    counts[key] = counts[key] || 0;
    if (counts[key] < AJDW_B1_MAX_PER_BRIEF) {
      counts[key] += 1;
      kept.push(item);
    } else {
      removed += 1;
    }
  });
  return { list: kept, removed: removed };
}

/* Render-side cap so one brief can never show more than 10 rows. */
function ajdwB1RowsPerBrief(items) {
  if (!items || !items.length) { return []; }
  var rows = [];
  var counts = {};
  items.forEach(function (item) {
    var key = ajdwB1BriefKey(item);
    counts[key] = counts[key] || 0;
    if (counts[key] < AJDW_B1_MAX_PER_BRIEF) {
      counts[key] += 1;
      rows.push(item);
    }
  });
  return rows;
}

function ajdwB1ShowKeepNotice() {
  var status = document.getElementById('ajdw-versions-status');
  if (status) {
    status.textContent = AJDW_B1_KEEP_TEXT;
    status.className = 'ajdw-status ajdw-versions-status ajdw-status--info';
  }
}

function ajdwB1AlertBox() { return document.getElementById('ajdw-storage-alert'); }

function ajdwB1ShowAlert() {
  var box = ajdwB1AlertBox();
  if (!box) { return; }
  box.hidden = false;
  var text = document.getElementById('ajdw-storage-alert-text');
  if (text) { text.textContent = AJDW_B1_QUOTA_TEXT; }
  var backup = document.getElementById('ajdw-storage-backup');
  if (backup) { backup.hidden = false; }
}

function ajdwB1HideAlert() {
  var box = ajdwB1AlertBox();
  if (box) { box.hidden = true; }
  var prune = document.getElementById('ajdw-storage-prune');
  if (prune) { prune.hidden = true; }
  var status = document.getElementById('ajdw-storage-alert-status');
  if (status) { status.textContent = ''; }
}

function ajdwB1QuotaActive() {
  var banner = document.getElementById('ajdw-quota-banner');
  if (!banner || banner.hidden) { return false; }
  var text = banner.textContent || '';
  if (text.indexOf('Backup downloaded') !== -1) { return false; }
  return text.indexOf('full') !== -1 || text.indexOf('Autosave stopped') !== -1 || text.indexOf('room') !== -1;
}

function ajdwB1Watch() {
  if (ajdwB1QuotaActive()) { ajdwB1ShowAlert(); }
}

/* One-click backup reuses the tool's own exporter, so the file always carries the current
   brief, every section and all advert variants. */
function ajdwB1Download() {
  var trigger = document.getElementById('ajdw-quota-backup');
  if (trigger) { trigger.click(); }
  var status = document.getElementById('ajdw-storage-alert-status');
  if (status) { status.textContent = AJDW_B1_DOWNLOADED_TEXT; }
  var prune = document.getElementById('ajdw-storage-prune');
  if (prune) { prune.hidden = false; }
}

function ajdwB1FireInput(field) {
  if (!field) { return; }
  try { field.dispatchEvent(new Event('input', { bubbles: true })); return; } catch (e) { /* fall through */ }
  try {
    var ev = document.createEvent('Event');
    ev.initEvent('input', true, true);
    field.dispatchEvent(ev);
  } catch (e2) { /* nothing else to try */ }
}

/* Clears the alert only after a fresh save attempt has been issued. */
function ajdwB1RetrySave() {
  ajdwB1FireInput(document.getElementById('ajdw-role-title'));
  ajdwB1FireInput(document.getElementById('ajdw-summary'));
  setTimeout(function () {
    var status = document.getElementById('ajdw-storage-alert-status');
    if (status) { status.textContent = 'Old versions removed. Draft saved again.'; }
    ajdwB1HideAlert();
  }, 500);
}

/* Removes every version row past the three newest by pressing the list's own Delete +
   confirm controls, so the real version store is what changes. */
function ajdwB1DeleteOldVersions() {
  var list = document.getElementById('ajdw-version-list');
  var rows = (list && list.querySelectorAll) ? list.querySelectorAll('li.ajdw-version-item') : null;
  if (!rows || rows.length <= 3) { ajdwB1RetrySave(); return; }
  var row = rows[rows.length - 1];
  var del = row.querySelector ? row.querySelector('.ajdw-version-delete') : null;
  if (!del) { ajdwB1RetrySave(); return; }
  del.click();
  setTimeout(function () {
    var confirmBtn = row.querySelector ? row.querySelector('.ajdw-version-confirm-delete') : null;
    if (confirmBtn) { confirmBtn.click(); }
    setTimeout(ajdwB1DeleteOldVersions, 80);
  }, 40);
}

function ajdwB1Init() {
  var box = ajdwB1AlertBox();
  var list = document.getElementById('ajdw-version-list');
  if (!box || !list) {
    ajdwB1Tries += 1;
    if (ajdwB1Tries < 40) { setTimeout(ajdwB1Init, 250); }
    return;
  }
  if (ajdwB1Wired) { return; }
  ajdwB1Wired = true;
  var backup = document.getElementById('ajdw-storage-backup');
  if (backup) { backup.addEventListener('click', ajdwB1Download); }
  var prune = document.getElementById('ajdw-storage-prune');
  if (prune) { prune.addEventListener('click', ajdwB1DeleteOldVersions); }
  try {
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var observer = new MutationObserver(function () { ajdwB1Watch(); });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  } catch (e) { /* the delegated events below still cover it */ }
  document.addEventListener('input', ajdwB1Watch, true);
  document.addEventListener('click', ajdwB1Watch, true);
  ajdwB1Watch();
}

setTimeout(ajdwB1Init, 0);

/* ---- B6 T-81: 'Ready to generate' required-field checklist beside Generate draft ---- */
(function () {
  'use strict';

  var AJDW_READY_LABELS = {
    roleTitle: 'role title',
    summary: 'summary',
    duties: 'duties',
    requirements: 'requirements'
  };
  var ajdwReadySeq = 0;

  function ajdwReadyKebab(text) {
    return String(text).replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); });
  }

  function ajdwReadyForm() {
    return document.getElementById('ajdw-role-brief-form') || document.querySelector('form') || document;
  }

  function ajdwReadyByLabel(form, key) {
    var wanted = AJDW_READY_LABELS[key] || key;
    if (!form || !form.querySelectorAll) { return null; }
    var labels = form.querySelectorAll('label');
    for (var i = 0; i < labels.length; i += 1) {
      var text = String(labels[i].textContent || '').toLowerCase();
      if (text.indexOf(wanted) === -1) { continue; }
      var target = labels[i].getAttribute('for');
      if (target) {
        var byFor = document.getElementById(target);
        if (byFor) { return byFor; }
      }
      var nested = labels[i].querySelector('input, textarea');
      if (nested) { return nested; }
    }
    return null;
  }

  function ajdwReadyField(key) {
    var form = ajdwReadyForm();
    var el = null;
    if (form && form.querySelector) {
      el = form.querySelector('[name="' + key + '"]');
      if (!el) { el = form.querySelector('#ajdw-' + ajdwReadyKebab(key)); }
    }
    if (!el) { el = document.getElementById('ajdw-' + ajdwReadyKebab(key)); }
    if (!el) { el = document.getElementById('ajdw-' + key); }
    if (!el) { el = ajdwReadyByLabel(form, key); }
    return el || null;
  }

  function ajdwReadyRows() {
    return document.querySelectorAll('[data-ajdw-ready]');
  }

  function ajdwReadyBind() {
    var rows = ajdwReadyRows();
    for (var i = 0; i < rows.length; i += 1) {
      var key = rows[i].getAttribute('data-ajdw-ready');
      var el = ajdwReadyField(key);
      if (!el) { continue; }
      if (!el.id) {
        ajdwReadySeq += 1;
        el.id = 'ajdw-ready-field-' + ajdwReadyKebab(key) + '-' + ajdwReadySeq;
      }
      rows[i].setAttribute('data-ajdw-field-id', el.id);
    }
  }

  function ajdwReadyBusy(btn) {
    if (String(btn.getAttribute('aria-busy') || '') === 'true') { return true; }
    return /(^|\s)(ajdw-busy|ajdw-loading|ajdw-generating|is-busy)(\s|$)/.test(String(btn.className || ''));
  }

  function ajdwReadySetButton(ready) {
    var btn = document.getElementById('ajdw-generate-button');
    if (!btn) { return; }
    if (ready && ajdwReadyBusy(btn)) { return; }
    btn.disabled = !ready;
    btn.setAttribute('aria-disabled', ready ? 'false' : 'true');
    if (ready) {
      btn.removeAttribute('title');
    } else {
      btn.setAttribute('title', 'Fill the 4 required fields first');
    }
  }

  function ajdwReadySync() {
    var rows = ajdwReadyRows();
    if (!rows.length) { return; }
    var complete = 0;
    for (var i = 0; i < rows.length; i += 1) {
      var key = rows[i].getAttribute('data-ajdw-ready');
      var el = ajdwReadyField(key);
      var value = el ? String(el.value == null ? '' : el.value) : '';
      var filled = value.replace(/\s+/g, ' ').trim().length > 0;
      rows[i].setAttribute('data-ajdw-ready-state', filled ? 'done' : 'missing');
      var state = rows[i].querySelector('.ajdw-ready-state');
      if (state) { state.textContent = filled ? 'done' : 'missing'; }
      if (filled) { complete += 1; }
    }
    var total = rows.length;
    var count = document.getElementById('ajdw-ready-count');
    if (count) { count.textContent = complete + ' of ' + total + ' required fields complete'; }
    var doneLine = document.getElementById('ajdw-ready-done');
    if (doneLine) { doneLine.hidden = complete < total; }
    ajdwReadySetButton(complete >= total);
  }

  function ajdwReadyOnInput() {
    ajdwReadyBind();
    ajdwReadySync();
    setTimeout(ajdwReadySync, 0);
  }

  function ajdwReadyInit() {
    ajdwReadyBind();
    ajdwReadySync();
    if (document.addEventListener) {
      document.addEventListener('input', ajdwReadyOnInput, false);
      document.addEventListener('change', ajdwReadyOnInput, false);
    }
    setTimeout(function () { ajdwReadyBind(); ajdwReadySync(); }, 400);
  }

  if (typeof tool !== 'undefined' && tool && typeof tool.onReady === 'function') {
    tool.onReady(ajdwReadyInit);
  } else {
    ajdwReadyInit();
  }
}());

/* ---- B1 T-76: live bullet count under Duties and Requirements ---- */
var AJDW_BULLET_FIELDS = [
  { inputId: 'ajdw-duties', countId: 'ajdw-duties-count' },
  { inputId: 'ajdw-requirements', countId: 'ajdw-requirements-count' }
];

function ajdwBulletItems(value) {
  var out = [];
  var text = String(value == null ? '' : value).replace(/\r\n?/g, '\n').replace(/(\d),(\d)/g, '$1\u0001$2');
  text.split(/\n|[,;]/).forEach(function (line) {
    var item = String(line || '').replace(/\u0001/g, ',')
      .replace(/^[-*\u2022\s]+/, '')
      .replace(/^\d+[.)]\s*/, '')
      .trim();
    if (item) { out.push(item); }
  });
  return out;
}

function ajdwBulletCountNode(field) {
  var count = document.getElementById(field.countId);
  if (count) { return count; }
  var input = document.getElementById(field.inputId);
  if (!input || !input.parentNode) { return null; }
  count = document.createElement('p');
  count.className = 'ajdw-count ajdw-hint';
  count.id = field.countId;
  count.setAttribute('data-ajdw-count', '0');
  count.setAttribute('role', 'status');
  count.setAttribute('aria-live', 'polite');
  count.setAttribute('aria-atomic', 'true');
  count.textContent = '0 items';
  input.parentNode.insertBefore(count, input.nextSibling);
  return count;
}

function ajdwUpdateBulletCounts() {
  if (typeof document === 'undefined' || !document.getElementById) { return; }
  var i;
  for (i = 0; i < AJDW_BULLET_FIELDS.length; i += 1) {
    var field = AJDW_BULLET_FIELDS[i];
    var input = document.getElementById(field.inputId);
    if (!input) { continue; }
    var count = ajdwBulletCountNode(field);
    if (!count) { continue; }
    var total = ajdwBulletItems(input.value).length;
    var label = total + ' items';
    if (count.textContent !== label) { count.textContent = label; }
    count.setAttribute('data-ajdw-count', String(total));
  }
}

var ajdwBulletBootTries = 0;

function ajdwBulletBoot() {
  if (typeof document === 'undefined' || !document.getElementById) { return; }
  if (!document.getElementById('ajdw-role-brief-form')) {
    ajdwBulletBootTries += 1;
    if (ajdwBulletBootTries < 60) { setTimeout(ajdwBulletBoot, 100); }
    return;
  }
  if (!document.ajdwBulletWired && document.addEventListener) {
    document.ajdwBulletWired = true;
    var refresh = function () { ajdwUpdateBulletCounts(); };
    var deferred = function () { setTimeout(refresh, 0); setTimeout(refresh, 120); };
    document.addEventListener('input', refresh, true);
    document.addEventListener('change', refresh, true);
    document.addEventListener('keyup', refresh, true);
    document.addEventListener('paste', deferred, true);
    document.addEventListener('click', function (ev) {
      var t = ev && ev.target;
      if (t && (t.id === 'ajdw-clear-form' || t.id === 'ajdw-load-example' || t.id === 'ajdw-example-replace')) { deferred(); }
    }, true);
    if (typeof setInterval === 'function') { setInterval(refresh, 400); }
  }
  ajdwUpdateBulletCounts();
  if (typeof window !== 'undefined') { window.ajdwUpdateBulletCounts = ajdwUpdateBulletCounts; }
}

setTimeout(ajdwBulletBoot, 0);

/* ---------------------------------------------------------------------------
   Batch B3 - T-82 'Load example brief' with replace confirmation and T-83 live
   character counters plus over-limit warnings for the three advert variants.
   Additive only: reuses the existing ids, no storage, no network, no framework.
--------------------------------------------------------------------------- */
var AJDW_B3_EXAMPLE = {
  'ajdw-role-title': 'Senior Product Manager',
  'ajdw-department': 'Product',
  'ajdw-location': 'Remote (US)',
  'ajdw-employment-type': 'Full-time',
  'ajdw-seniority': 'Senior',
  'ajdw-salary': '$140,000 - $170,000',
  'ajdw-summary': 'We are hiring a Senior Product Manager to own our scheduling product from discovery through launch. You will pair with design, engineering, and support to turn customer research into a roadmap the whole company can follow.',
  'ajdw-duties': '- Own the roadmap for the scheduling product and explain the priority calls behind it\n- Run customer interviews and turn findings into written product requirements\n- Partner with design and engineering from discovery through launch\n- Define success metrics for each release and review them 30 days after launch\n- Mentor two associate product managers on discovery and written communication',
  'ajdw-requirements': '- 5 or more years of product management experience in B2B software\n- A record of shipping products used by at least 10,000 people\n- Comfort with analytics tools and basic SQL\n- Clear written communication, including one-page product briefs\n- Experience working with a remote engineering team',
  'ajdw-company-context': 'Northline Scheduling builds workforce scheduling software for clinics and small hospitals. We are a 90-person company serving customers in 14 states, and we write product decisions down so remote teammates can follow them.',
  'ajdw-tone': 'Warm, direct, and professional'
};

var AJDW_B3_EXAMPLE_ORDER = [
  'ajdw-role-title',
  'ajdw-department',
  'ajdw-location',
  'ajdw-employment-type',
  'ajdw-seniority',
  'ajdw-salary',
  'ajdw-summary',
  'ajdw-duties',
  'ajdw-requirements',
  'ajdw-company-context',
  'ajdw-tone'
];

var AJDW_B3_REQUIRED = [
  'ajdw-role-title',
  'ajdw-department',
  'ajdw-location',
  'ajdw-employment-type',
  'ajdw-summary',
  'ajdw-duties',
  'ajdw-requirements'
];

var AJDW_B3_CONFIRM_TEXT = 'Replace current brief with the example? Your saved versions are kept.';

var AJDW_B3_ADVERT_LIMITS = [
  { key: 'standard', field: 'ajdw-advert-standard', limit: 800 },
  { key: 'short', field: 'ajdw-advert-short', limit: 300 },
  { key: 'social', field: 'ajdw-advert-social', limit: 150 }
];

var ajdwB3Tries = 0;

function ajdwB3El(id) {
  if (typeof document === 'undefined' || !document.getElementById) { return null; }
  return document.getElementById(id);
}

function ajdwB3Emit(el, type) {
  if (!el || !el.dispatchEvent) { return; }
  try {
    el.dispatchEvent(new Event(type, { bubbles: true }));
  } catch (err) {
    try {
      var ev = document.createEvent('HTMLEvents');
      ev.initEvent(type, true, false);
      el.dispatchEvent(ev);
    } catch (err2) {
      /* older engine: the next sync recalculates from the field values */
    }
  }
}

function ajdwB3SetField(id, value) {
  var el = ajdwB3El(id);
  if (!el) { return; }
  var tag = String(el.tagName || '').toUpperCase();
  if (tag === 'SELECT') {
    var wanted = String(value || '').toLowerCase();
    var options = el.options || [];
    var match = null;
    var i;
    for (i = 0; i < options.length; i++) {
      var ov = String(options[i].value || '').toLowerCase();
      var ot = String(options[i].text || '').toLowerCase();
      if (ov === wanted || ot === wanted) { match = options[i]; break; }
    }
    if (!match) {
      for (i = 0; i < options.length; i++) {
        var t = String(options[i].text || options[i].value || '').toLowerCase();
        if (t && wanted && (t.indexOf(wanted) === 0 || wanted.indexOf(t) === 0)) { match = options[i]; break; }
      }
    }
    if (match) { el.value = match.value; }
    else if (options.length) { el.value = options[0].value; }
  } else if (typeof el.value === 'string') {
    el.value = value;
  } else if ('textContent' in el) {
    el.textContent = value;
  }
  ajdwB3Emit(el, 'input');
  ajdwB3Emit(el, 'change');
}

function ajdwB3StatusLine(message) {
  var el = ajdwB3El('ajdw-status');
  if (el) { el.textContent = message; }
}

function ajdwB3HasBriefText() {
  for (var i = 0; i < AJDW_B3_EXAMPLE_ORDER.length; i++) {
    var el = ajdwB3El(AJDW_B3_EXAMPLE_ORDER[i]);
    if (el && typeof el.value === 'string' && el.value.replace(/\s+/g, '').length > 0) { return true; }
  }
  return false;
}

function ajdwB3SyncChecklist() {
  var allFilled = true;
  for (var i = 0; i < AJDW_B3_REQUIRED.length; i++) {
    var el = ajdwB3El(AJDW_B3_REQUIRED[i]);
    var value = el && typeof el.value === 'string' ? el.value.replace(/\s+/g, '') : '';
    if (!value) { allFilled = false; }
  }
  if (allFilled) {
    var count = ajdwB3El('ajdw-req-count');
    if (count) { count.textContent = 'All required fields complete'; }
  }
  return allFilled;
}

function ajdwB3LoadExample() {
  for (var i = 0; i < AJDW_B3_EXAMPLE_ORDER.length; i++) {
    var id = AJDW_B3_EXAMPLE_ORDER[i];
    ajdwB3SetField(id, AJDW_B3_EXAMPLE[id] || '');
  }
  ajdwB3HideConfirm();
  ajdwB3SyncChecklist();
  ajdwB3StatusLine('Example brief loaded. Edit anything you like.');
  setTimeout(function () { ajdwB3SyncChecklist(); }, 0);
  setTimeout(function () { ajdwB3SyncChecklist(); }, 120);
}

function ajdwB3HideConfirm() {
  var box = ajdwB3El('ajdw-example-confirm');
  if (box) { box.hidden = true; }
}

function ajdwB3EnsureConfirm() {
  var box = ajdwB3El('ajdw-example-confirm');
  if (!box) {
    box = document.createElement('div');
    box.id = 'ajdw-example-confirm';
    box.className = 'ajdw-example-confirm ajdw-controls';
    box.hidden = true;
    var question = document.createElement('p');
    question.id = 'ajdw-example-question';
    question.className = 'ajdw-example-question';
    question.textContent = AJDW_B3_CONFIRM_TEXT;
    box.appendChild(question);
    var row = document.createElement('div');
    row.className = 'ajdw-actions';
    var apply = document.createElement('button');
    apply.type = 'button';
    apply.id = 'ajdw-example-apply';
    apply.className = 'ajdw-button ajdw-button--small';
    apply.textContent = 'Replace';
    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.id = 'ajdw-example-cancel';
    cancel.className = 'ajdw-button ajdw-button--small ajdw-button--ghost';
    cancel.textContent = 'Cancel';
    row.appendChild(apply);
    row.appendChild(cancel);
    box.appendChild(row);
    var form = ajdwB3El('ajdw-role-brief-form');
    var host = ajdwB3El('ajdw-brief-header') || form;
    if (host && host.appendChild) { host.appendChild(box); }
  }
  var questionNode = ajdwB3El('ajdw-example-question');
  if (!questionNode) {
    questionNode = document.createElement('p');
    questionNode.id = 'ajdw-example-question';
    questionNode.className = 'ajdw-example-question';
    if (box.firstChild && box.insertBefore) { box.insertBefore(questionNode, box.firstChild); }
    else if (box.appendChild) { box.appendChild(questionNode); }
  }
  questionNode.textContent = AJDW_B3_CONFIRM_TEXT;
  return box;
}

function ajdwB3CloneButton(button) {
  if (!button || !button.parentNode || !button.cloneNode) { return button; }
  var fresh = button.cloneNode(true);
  fresh.setAttribute('data-ajdw-b3', '1');
  button.parentNode.replaceChild(fresh, button);
  return fresh;
}

function ajdwB3WireConfirm() {
  var box = ajdwB3EnsureConfirm();
  if (!box || !box.querySelectorAll) { return; }
  var buttons = box.querySelectorAll('button');
  var apply = null;
  var cancel = null;
  for (var i = 0; i < buttons.length; i++) {
    var label = String(buttons[i].textContent || '').toLowerCase();
    if (!apply && label.indexOf('replace') !== -1) { apply = buttons[i]; }
    else if (!cancel && label.indexOf('cancel') !== -1) { cancel = buttons[i]; }
  }
  if (apply) {
    var freshApply = ajdwB3CloneButton(apply);
    if (freshApply.addEventListener) {
      freshApply.addEventListener('click', function () { ajdwB3LoadExample(); });
    }
  }
  if (cancel) {
    var freshCancel = ajdwB3CloneButton(cancel);
    if (freshCancel.addEventListener) {
      freshCancel.addEventListener('click', function () {
        ajdwB3HideConfirm();
        ajdwB3StatusLine('Example cancelled. Your brief is unchanged.');
      });
    }
  }
}

function ajdwB3OnLoadClick() {
  var box = ajdwB3EnsureConfirm();
  if (ajdwB3HasBriefText()) {
    if (box) { box.hidden = false; }
    var question = ajdwB3El('ajdw-example-question');
    if (question) { question.textContent = AJDW_B3_CONFIRM_TEXT; }
    ajdwB3StatusLine('Confirm: replace the current brief with the example, or cancel to keep it.');
    setTimeout(function () {
      var again = ajdwB3El('ajdw-example-question');
      if (again) { again.textContent = AJDW_B3_CONFIRM_TEXT; }
    }, 0);
  } else {
    if (box) { box.hidden = true; }
    ajdwB3LoadExample();
  }
}

function ajdwB3WireExample() {
  if (typeof document === 'undefined' || !document.getElementById) { return; }
  var button = ajdwB3El('ajdw-load-example');
  if (!button) {
    var form = ajdwB3El('ajdw-role-brief-form');
    if (!form) { return; }
    button = document.createElement('button');
    button.type = 'button';
    button.id = 'ajdw-load-example';
    button.className = 'ajdw-button ajdw-button--small ajdw-button--ghost ajdw-load-example';
    button.textContent = 'Load example brief';
    var host = ajdwB3El('ajdw-brief-header');
    if (host && host.appendChild) { host.appendChild(button); }
    else {
      var title = ajdwB3El('ajdw-form-title') || form.firstChild;
      if (title && title.parentNode) { title.parentNode.insertBefore(button, title.nextSibling); }
      else if (form.insertBefore) { form.insertBefore(button, form.firstChild); }
    }
  } else {
    var text = String(button.textContent || '').replace(/\s+/g, ' ').toLowerCase();
    if (text.indexOf('example brief') === -1) { button.textContent = 'Load example brief'; }
  }
  var fresh = ajdwB3CloneButton(button);
  if (fresh && fresh.addEventListener) {
    fresh.addEventListener('click', function () { ajdwB3OnLoadClick(); });
  }
  ajdwB3WireConfirm();
}

function ajdwB3AdvertCard(field) {
  var node = field;
  var depth = 0;
  while (node && depth < 6) {
    var cls = node.className && typeof node.className === 'string' ? node.className : '';
    if (cls.indexOf('ajdw-advert-card') !== -1 || cls.indexOf('ajdw-advert-panel') !== -1) { return node; }
    node = node.parentNode;
    depth += 1;
  }
  return field && field.parentNode ? field.parentNode : field;
}

function ajdwB3CounterFor(target, field) {
  var id = 'ajdw-advert-count-' + target.key;
  var counter = ajdwB3El(id);
  if (counter) { return counter; }
  if (!document.createElement) { return null; }
  counter = document.createElement('span');
  counter.id = id;
  counter.className = 'ajdw-char-count ajdw-counter';
  counter.setAttribute('data-ajdw-advert-counter', target.key);
  counter.setAttribute('role', 'status');
  var card = ajdwB3AdvertCard(field);
  if (card && card.appendChild) { card.appendChild(counter); return counter; }
  return null;
}

function ajdwB3RefreshAdverts() {
  if (typeof document === 'undefined' || !document.getElementById) { return; }
  for (var i = 0; i < AJDW_B3_ADVERT_LIMITS.length; i++) {
    var target = AJDW_B3_ADVERT_LIMITS[i];
    var field = ajdwB3El(target.field);
    if (!field) { continue; }
    var counter = ajdwB3CounterFor(target, field);
    if (!counter) { continue; }
    var length = typeof field.value === 'string' ? field.value.length : 0;
    var over = length > target.limit;
    var text = over
      ? 'Over limit by ' + (length - target.limit) + ' characters \u2014 trim before export'
      : length + ' / ' + target.limit + ' characters';
    if (counter.textContent !== text) { counter.textContent = text; }
    counter.setAttribute('data-ajdw-over', over ? '1' : '0');
    counter.setAttribute('aria-label', (over
      ? 'Over limit by ' + (length - target.limit) + ' characters, trim before export'
      : length + ' of ' + target.limit + ' characters used'));
    var card = ajdwB3AdvertCard(field);
    if (card && card.setAttribute) {
      if (over) {
        card.setAttribute('data-ajdw-over-limit', '1');
        if (card.classList && card.classList.add) { card.classList.add('ajdw-over-limit'); }
      } else {
        card.removeAttribute('data-ajdw-over-limit');
        if (card.classList && card.classList.remove) { card.classList.remove('ajdw-over-limit'); }
      }
    }
  }
}

function ajdwB3ActiveTab() {
  if (typeof document === 'undefined' || !document.querySelectorAll) { return 'jd'; }
  var tabs = document.querySelectorAll('[data-ajdw-tab]');
  for (var i = 0; i < tabs.length; i++) {
    var selected = tabs[i].getAttribute('aria-selected');
    var cls = String(tabs[i].className || '');
    if (selected === 'true' || cls.indexOf('ajdw-tab--active') !== -1) {
      return tabs[i].getAttribute('data-ajdw-tab') || 'jd';
    }
  }
  return 'jd';
}

function ajdwB3LimitSuffix() {
  var tab = ajdwB3ActiveTab();
  for (var i = 0; i < AJDW_B3_ADVERT_LIMITS.length; i++) {
    var target = AJDW_B3_ADVERT_LIMITS[i];
    if (target.key !== tab) { continue; }
    var field = ajdwB3El(target.field);
    if (!field || typeof field.value !== 'string') { return ''; }
    if (field.value.length > target.limit) {
      return ' \u2014 over the ' + target.limit + ' character limit';
    }
  }
  return '';
}

function ajdwB3AppendStatus() {
  var suffix = ajdwB3LimitSuffix();
  if (!suffix) { return; }
  var ids = ['ajdw-status', 'ajdw-export-status'];
  for (var i = 0; i < ids.length; i++) {
    var el = ajdwB3El(ids[i]);
    if (!el || typeof el.textContent !== 'string') { continue; }
    var text = el.textContent;
    if (text.replace(/\s+/g, '') === '') { continue; }
    if (text.indexOf('character limit') !== -1) { continue; }
    el.textContent = text.replace(/\s+$/, '') + suffix;
  }
}

function ajdwB3ClickButton(node) {
  var depth = 0;
  while (node && depth < 5) {
    if (String(node.tagName || '').toUpperCase() === 'BUTTON') { return node; }
    node = node.parentNode;
    depth += 1;
  }
  return null;
}

function ajdwB3OnDocumentClick(event) {
  var target = event && event.target ? event.target : null;
  var button = ajdwB3ClickButton(target);
  if (!button) { return; }
  var id = String(button.id || '');
  if (id.indexOf('ajdw-copy') !== 0 && id.indexOf('ajdw-download') !== 0) { return; }
  setTimeout(ajdwB3AppendStatus, 0);
  setTimeout(ajdwB3AppendStatus, 40);
}

function ajdwB3WireAdverts() {
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') { return; }
  if (document.ajdwB3AdvertWired) { return; }
  document.ajdwB3AdvertWired = true;
  var refresh = function () { ajdwB3RefreshAdverts(); };
  document.addEventListener('input', refresh, false);
  document.addEventListener('change', refresh, false);
  document.addEventListener('keyup', refresh, false);
  document.addEventListener('click', ajdwB3OnDocumentClick, false);
  setInterval(refresh, 120);
}

function ajdwB3Boot() {
  if (typeof document === 'undefined' || !document.getElementById) { return; }
  if (!ajdwB3El('ajdw-role-brief-form')) {
    ajdwB3Tries += 1;
    if (ajdwB3Tries < 60) { setTimeout(ajdwB3Boot, 100); }
    return;
  }
  ajdwB3WireExample();
  ajdwB3WireAdverts();
  ajdwB3RefreshAdverts();
  setTimeout(function () { ajdwB3WireExample(); ajdwB3RefreshAdverts(); }, 600);
  setTimeout(function () { ajdwB3WireExample(); ajdwB3RefreshAdverts(); }, 1600);
}

if (typeof tool !== 'undefined' && tool && typeof tool.onReady === 'function') {
  tool.onReady(function () { setTimeout(ajdwB3Boot, 0); });
} else {
  setTimeout(ajdwB3Boot, 0);
}

/* T-84: rejected or unreadable AI response panel. DOM only: no storage, no network, no eval. */
var ajdwB4RawResponse = '';
var ajdwB4GenerateIds = ['ajdw-generate', 'ajdw-generate-draft', 'ajdw-generate-button', 'ajdw-generate-btn'];
var AJDW_B4_FAILURE_TEXT = "We couldn't read the AI response. Nothing was changed.";

function ajdwB4CaptureRaw(response) {
  var text = '';
  if (typeof response === 'string') {
    text = response;
  } else if (response != null) {
    try { text = JSON.stringify(response); } catch (err) { text = String(response); }
  }
  ajdwB4RawResponse = text || '';
}

function ajdwB4Host() {
  var status = document.getElementById('ajdw-editor-status');
  if (status && status.parentNode) { return { node: status.parentNode, before: status.nextSibling }; }
  var root = document.getElementById('ajdw-app-root');
  if (root) { return { node: root, before: root.firstChild }; }
  return null;
}

function ajdwB4HideFailure() {
  var panel = document.getElementById('ajdw-ai-failure');
  if (panel) { panel.hidden = true; }
}

function ajdwB4ToggleRaw() {
  var pre = document.getElementById('ajdw-ai-failure-raw');
  var det = document.getElementById('ajdw-ai-failure-details');
  if (!pre) { return; }
  var opening = !!pre.hidden;
  pre.textContent = (ajdwB4RawResponse || '').slice(0, 500);
  pre.hidden = !opening;
  if (det) {
    det.setAttribute('aria-expanded', opening ? 'true' : 'false');
    det.textContent = opening ? 'Hide details' : 'Show details';
  }
}

function ajdwB4ShowFailure() {
  var panel = document.getElementById('ajdw-ai-failure');
  if (!panel) {
    var host = ajdwB4Host();
    if (!host) { return; }
    panel = document.createElement('div');
    panel.className = 'ajdw-ai-failure';
    panel.id = 'ajdw-ai-failure';
    panel.setAttribute('role', 'alert');
    var msg = document.createElement('p');
    msg.className = 'ajdw-ai-failure-text';
    msg.id = 'ajdw-ai-failure-text';
    msg.textContent = AJDW_B4_FAILURE_TEXT;
    var actions = document.createElement('div');
    actions.className = 'ajdw-ai-failure-actions';
    var again = document.createElement('button');
    again.type = 'button';
    again.className = 'ajdw-button ajdw-button--small';
    again.id = 'ajdw-ai-failure-retry';
    again.textContent = 'Try again';
    again.addEventListener('click', function () { ajdwB4TryAgain(); });
    var details = document.createElement('button');
    details.type = 'button';
    details.className = 'ajdw-button ajdw-button--small ajdw-button--ghost';
    details.id = 'ajdw-ai-failure-details';
    details.textContent = 'Show details';
    details.setAttribute('aria-expanded', 'false');
    details.setAttribute('aria-controls', 'ajdw-ai-failure-raw');
    details.addEventListener('click', function () { ajdwB4ToggleRaw(); });
    var raw = document.createElement('pre');
    raw.className = 'ajdw-ai-failure-raw';
    raw.id = 'ajdw-ai-failure-raw';
    raw.setAttribute('readonly', 'readonly');
    raw.setAttribute('aria-label', 'AI response, first 500 characters');
    raw.hidden = true;
    actions.appendChild(again);
    actions.appendChild(details);
    panel.appendChild(msg);
    panel.appendChild(actions);
    panel.appendChild(raw);
    host.node.insertBefore(panel, host.before || null);
  }
  panel.hidden = false;
  var pre = document.getElementById('ajdw-ai-failure-raw');
  if (pre) { pre.textContent = (ajdwB4RawResponse || '').slice(0, 500); pre.hidden = true; }
  var det = document.getElementById('ajdw-ai-failure-details');
  if (det) { det.setAttribute('aria-expanded', 'false'); det.textContent = 'Show details'; }
}

function ajdwB4TryAgain() {
  ajdwB4HideFailure();
  var status = document.getElementById('ajdw-editor-status');
  var text = document.getElementById('ajdw-editor-status-text');
  if (status && text) {
    text.textContent = 'Generating your job description\u2026';
    status.hidden = false;
  }
  var i;
  var button;
  for (i = 0; i < ajdwB4GenerateIds.length; i += 1) {
    button = document.getElementById(ajdwB4GenerateIds[i]);
    if (button && !button.disabled && typeof button.click === 'function') { button.click(); return; }
  }
  for (i = 0; i < ajdwB4GenerateIds.length; i += 1) {
    button = document.getElementById(ajdwB4GenerateIds[i]);
    if (button && typeof button.click === 'function') { button.click(); return; }
  }
}

(function () {
  if (typeof document === 'undefined' || !document || typeof document.addEventListener !== 'function') { return; }
  document.addEventListener('click', function (event) {
    var node = event && event.target;
    while (node && node !== document) {
      var id = node.id || '';
      for (var i = 0; i < ajdwB4GenerateIds.length; i += 1) {
        if (id === ajdwB4GenerateIds[i]) { ajdwB4HideFailure(); return; }
      }
      node = node.parentNode;
    }
  }, true);
})();
