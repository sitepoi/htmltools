/* Essay Writing Educator - UniconHub CMS html-tool.
   One essay per student. A focused writing surface with rich text formatting.
   The evaluation service scores each rubric out of 100 and gives detailed
   suggestions - it never edits the essay. */

var BASE_RUBRICS = [
  {
    id: 'contentIdeas', name: 'Content & Ideas', weight: 30, builtIn: true,
    description: 'Depth and relevance of the ideas, originality of thought, engagement with the subject, and development of the main argument.'
  },
  {
    id: 'organizationStructure', name: 'Organization & Structure', weight: 20, builtIn: true,
    description: 'Clear introduction, body and conclusion; logical paragraphing; smooth transitions; coherent overall flow.'
  },
  {
    id: 'evidenceArgumentation', name: 'Evidence & Argumentation', weight: 20, builtIn: true,
    description: 'Claims supported with examples, facts or reasoning; quality of the arguments; critical thinking; counter-arguments considered.'
  },
  {
    id: 'languageStyle', name: 'Language & Style', weight: 15, builtIn: true,
    description: 'Word choice and vocabulary, sentence variety, tone and register, clarity and precision of expression.'
  },
  {
    id: 'grammarMechanics', name: 'Grammar & Mechanics', weight: 15, builtIn: true,
    description: 'Grammar, punctuation, spelling, capitalization and formatting consistency.'
  }
];

var MAX_RUBRIC_COUNT = 8;
var SUBJECT_DEFINITIONS_OBJECT_TYPE = 'essay-subject-definitions-uniconbaseapps';
var IDENTITY_POLL_DELAYS = [400, 1200, 2600, 5000];
var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var GRADE_BANDS = [
  { minScore: 90, label: 'A', title: 'Outstanding' },
  { minScore: 80, label: 'B', title: 'Very Good' },
  { minScore: 70, label: 'C', title: 'Good' },
  { minScore: 60, label: 'D', title: 'Needs Work' },
  { minScore: 0, label: 'F', title: 'Needs Significant Work' }
];

var CHART_COLORS = ['#4f46e5', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#7c3aed', '#db2777', '#65a30d'];

var essayState = null;
var currentUser = null;
var identityUnavailable = false;
var identityPollStep = 0;
var saveTimer = null;
var saveInFlight = false;
var lastStagedJson = null;
var autoSaveWarningShown = false;
var evaluationInProgress = false;
var activeEvaluationId = null;
var rubricBeingEditedId = null;
var resetRubricsArmed = false;
var activePanelName = null;
var activeEvaluationView = 'feedback';
var versionMenuOpen = false;
var activeSubjectDefinition = null;
var subjectDefinitionStatus = 'none';
var subjectDefinitionErrorText = '';
var subjectDefinitionWarningShown = false;
var applyDefinitionRubricsArmed = false;

/* ── Small helpers ── */
function elementById(id) { return document.getElementById(id); }
function inputValueById(id) { var node = elementById(id); return node ? node.value : ''; }
function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function toNumber(value, fallback) {
  var number = parseFloat(value);
  return isNaN(number) ? fallback : number;
}
function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(toNumber(score, 0) * 10) / 10));
}
function formatScore(score) { return String(clampScore(score)); }
function countWords(text) {
  var trimmed = String(text || '').trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
function makeId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function padTwo(number) { return number < 10 ? '0' + number : String(number); }
function formatShortDateTime(isoString) {
  var date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Unknown';
  return MONTH_NAMES[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear() +
    ' ' + padTwo(date.getHours()) + ':' + padTwo(date.getMinutes());
}
function closestNodeWithAction(startNode) {
  var node = startNode;
  while (node && node !== document) {
    if (node.getAttribute && node.getAttribute('data-act')) return node;
    node = node.parentNode;
  }
  return null;
}
function isNodeInsideContainer(node, container) {
  if (!container) return false;
  var current = node;
  while (current && current !== document) {
    if (current === container) return true;
    current = current.parentNode;
  }
  return false;
}
function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  var output = [];
  value.forEach(function (item) {
    if (typeof item === 'string' && item.trim()) output.push(item.trim().slice(0, 2000));
  });
  return output.slice(0, 12);
}
function safeResize() { try { tool.resize(); } catch (error) {} }

/* ── Rich text conversion helpers ── */
function extractTextFromNode(node) {
  var blockLevelTags = { P: true, DIV: true, H1: true, H2: true, H3: true, H4: true, H5: true, LI: true, BLOCKQUOTE: true, PRE: true };
  var output = '';
  var children = node.childNodes;
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (child.nodeType === 3) {
      output += child.nodeValue;
    } else if (child.nodeType === 1) {
      var tagName = child.tagName.toUpperCase();
      if (tagName === 'BR') { output += '\n'; continue; }
      output += extractTextFromNode(child);
      if (blockLevelTags[tagName]) output += '\n';
    }
  }
  return output;
}
function htmlToPlainText(html) {
  var container = document.createElement('div');
  container.innerHTML = String(html || '');
  var output = extractTextFromNode(container);
  return output.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
}
function plainTextToEditorHtml(text) {
  var paragraphs = String(text || '').split(/\n+/)
    .map(function (paragraph) { return paragraph.trim(); })
    .filter(function (paragraph) { return paragraph; });
  if (!paragraphs.length) return '';
  return paragraphs.map(function (paragraph) { return '<p>' + escapeHtml(paragraph) + '</p>'; }).join('');
}
function sanitizeStoredHtml(html) {
  return String(html || '')
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*(iframe|object|embed|style)[^>]*>[\s\S]*?<\s*\/\s*(iframe|object|embed|style)\s*>/gi, '')
    .replace(/<\s*(iframe|object|embed|style)[^>]*\/?\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

/* ── Params ── */
function getSubjectDefinitionId() { return String(tool.param('subjectDefinitionId', '') || '').trim(); }
function getSubjectDefinitionJson() { return String(tool.param('subjectDefinitionJson', '') || '').trim(); }
function hasSubjectDefinitionSource() { return !!(getSubjectDefinitionId() || getSubjectDefinitionJson()); }
function getEssaySubject() {
  if (activeSubjectDefinition && activeSubjectDefinition.subject) return activeSubjectDefinition.subject;
  return String(tool.param('essaySubject', '') || '').trim();
}
function getEssayInstructions() {
  if (activeSubjectDefinition && activeSubjectDefinition.instructions) return activeSubjectDefinition.instructions;
  return String(tool.param('essayInstructions', '') || '').trim();
}
function getEssayLanguage() {
  if (activeSubjectDefinition && activeSubjectDefinition.language) return activeSubjectDefinition.language;
  return String(tool.param('essayLanguage', 'English') || 'English').trim() || 'English';
}
function getMinimumWordCount() {
  if (activeSubjectDefinition && typeof activeSubjectDefinition.minimumWordCount === 'number' && activeSubjectDefinition.minimumWordCount > 0) {
    return activeSubjectDefinition.minimumWordCount;
  }
  return Math.floor(toNumber(tool.param('minimumWordCount', ''), 0));
}
function isEvaluationServiceAllowed() { return String(tool.param('allowAi', '')).toLowerCase() === 'yes'; }

/* ── Subject definition loading (from Essay Subject Builder) ── */
function getSubjectDefinitionsType() {
  return String(tool.param('subjectDefinitionsType', SUBJECT_DEFINITIONS_OBJECT_TYPE) || '').trim() || SUBJECT_DEFINITIONS_OBJECT_TYPE;
}
function parseSubjectDefinitionData(rawValue) {
  if (!rawValue || typeof rawValue !== 'object') return null;
  var definitionData = rawValue;
  if (rawValue.productData && rawValue.productData.data_categoriesBased && typeof rawValue.productData.data_categoriesBased === 'object') {
    definitionData = rawValue.productData.data_categoriesBased;
  }
  var subject = String(definitionData.subject || '').trim();
  var parsedRubrics = Array.isArray(definitionData.rubrics) ? definitionData.rubrics : [];
  if (!subject && !parsedRubrics.length) return null;
  return {
    subject: subject,
    instructions: String(definitionData.instructions || '').trim(),
    language: String(definitionData.language || '').trim() || 'English',
    minimumWordCount: Math.max(0, Math.floor(toNumber(definitionData.minimumWordCount, 0))),
    rubrics: parsedRubrics.map(function (rubric) {
      return {
        id: String(rubric.id || makeId('rubric')),
        name: String(rubric.name).slice(0, 80),
        weight: clampWeight(rubric.weight),
        description: String(rubric.description || '').slice(0, 500),
        builtIn: !!rubric.builtIn
      };
    }),
    definitionId: '',
    definitionName: ''
  };
}
function failSubjectDefinitionLoad(errorText) {
  subjectDefinitionStatus = 'error';
  subjectDefinitionErrorText = String(errorText || 'The subject definition could not be loaded.');
  if (!subjectDefinitionWarningShown) {
    subjectDefinitionWarningShown = true;
    tool.notify('Subject definition: ' + subjectDefinitionErrorText + ' The tool falls back to its own field parameters.', 'warning');
  }
  renderWholeTool();
}
function applySubjectDefinition(definition) {
  activeSubjectDefinition = definition;
  subjectDefinitionStatus = 'loaded';
  if (definition.rubrics.length && rubricsArePristineBase(essayState.rubrics)) {
    essayState.rubrics = definition.rubrics.map(function (rubric) {
      return { id: rubric.id, name: rubric.name, weight: rubric.weight, description: rubric.description, builtIn: rubric.builtIn };
    });
    persistNow();
  }
  renderWholeTool();
}
function rubricsArePristineBase(rubricList) {
  return JSON.stringify(rubricList) === JSON.stringify(copyBaseRubrics());
}
function definitionRubricsDifferFromCurrent() {
  if (!activeSubjectDefinition || !activeSubjectDefinition.rubrics.length) return false;
  return JSON.stringify(activeSubjectDefinition.rubrics) !== JSON.stringify(essayState.rubrics);
}
function loadSubjectDefinition() {
  var definitionId = getSubjectDefinitionId();
  var definitionJson = getSubjectDefinitionJson();
  if (!definitionId && !definitionJson) {
    subjectDefinitionStatus = 'none';
    return;
  }
  if (definitionId) {
    subjectDefinitionStatus = 'loading';
    if (typeof tool.requestObjects !== 'function') {
      failSubjectDefinitionLoad('object access is not available in this CMS. Configure the evaluator parameters essaySubject, essayInstructions and essayLanguage directly instead.');
      return;
    }
    tool.requestObjects('get', { mainObjectType: getSubjectDefinitionsType(), objectId: definitionId }, function (error, result) {
      if (error || !result || !result.object) {
        failSubjectDefinitionLoad(error || 'the definition object was not found.');
        return;
      }
      var definition = parseSubjectDefinitionData(result.object);
      if (!definition) { failSubjectDefinitionLoad('the definition object has no valid subject data.'); return; }
      definition.definitionId = definitionId;
      definition.definitionName = result.object.name || '';
      applySubjectDefinition(definition);
    });
  } else {
    var parsedRawJson = null;
    try { parsedRawJson = JSON.parse(definitionJson); } catch (error) { parsedRawJson = null; }
    var definition = parseSubjectDefinitionData(parsedRawJson);
    if (!definition) {
      failSubjectDefinitionLoad('the subjectDefinitionJson parameter is not valid JSON with subject data.');
      return;
    }
    definition.definitionName = definition.subject || 'Pasted definition';
    applySubjectDefinition(definition);
  }
}
function applySubjectDefinitionRubrics() {
  if (!canManageRubrics()) { tool.notify('You do not have permission to change the rubrics.', 'warning'); return; }
  if (!activeSubjectDefinition || !activeSubjectDefinition.rubrics.length) {
    tool.notify('The subject definition has no rubrics.', 'warning');
    return;
  }
  if (!applyDefinitionRubricsArmed) {
    applyDefinitionRubricsArmed = true;
    updateApplyDefinitionButtonText();
    tool.notify('This replaces the current rubrics with the rubrics from the subject definition. Click the button again to confirm.', 'warning');
    setTimeout(function () { applyDefinitionRubricsArmed = false; updateApplyDefinitionButtonText(); }, 4000);
    return;
  }
  applyDefinitionRubricsArmed = false;
  essayState.rubrics = activeSubjectDefinition.rubrics.map(function (rubric) {
    return { id: rubric.id, name: rubric.name, weight: rubric.weight, description: rubric.description, builtIn: rubric.builtIn };
  });
  persistNow();
  renderWholeTool();
  updateApplyDefinitionButtonText();
  tool.notify('Rubrics updated from the subject definition.', 'success');
}
function updateApplyDefinitionButtonText() {
  var button = elementById('btn-apply-definition-rubrics');
  if (button) button.textContent = applyDefinitionRubricsArmed ? '⚠ Confirm Apply?' : '↧ Apply Rubrics from Definition';
}

/* ── Identity and permissions ── */
function getUserSafely() {
  try { return tool.getUser(); } catch (error) { return null; }
}
function isReadOnlyNow() {
  try { return !!tool.isReadOnly(); } catch (error) { return false; }
}
function getEffectiveRoles() {
  var user = currentUser || getUserSafely();
  var roles = [];
  if (user && Array.isArray(user.roles)) roles = roles.concat(user.roles);
  if (!roles.length && user && user.effectiveAccess) {
    if (user.effectiveAccess.isManager) roles.push('admin');
    else if (user.effectiveAccess.isEditor) roles.push('editor');
    else if (user.effectiveAccess.isViewer) roles.push('viewer');
  }
  return roles;
}
function hasAnyRole(roleNames) {
  var roles = getEffectiveRoles();
  for (var i = 0; i < roleNames.length; i++) {
    if (roles.indexOf(roleNames[i]) !== -1) return true;
  }
  return false;
}
function hasObjectManagerAccess() {
  var user = currentUser || getUserSafely();
  return !!(user && user.effectiveAccess && user.effectiveAccess.isManager);
}
function canEditEssay() {
  if (identityUnavailable) return !isReadOnlyNow();
  if (isReadOnlyNow()) return false;
  return hasAnyRole(['admin', 'owner', 'developer', 'user-manager', 'editor']) || hasObjectManagerAccess();
}
function canManageRubrics() {
  if (identityUnavailable) return !isReadOnlyNow();
  if (isReadOnlyNow()) return false;
  return hasAnyRole(['admin', 'owner', 'developer', 'user-manager']) || hasObjectManagerAccess();
}
function refreshCurrentUser() {
  currentUser = getUserSafely();
  var roles = getEffectiveRoles();
  if (!currentUser || !roles.length) {
    if (typeof tool.getUser !== 'function') {
      identityUnavailable = true;
    } else if (identityPollStep < IDENTITY_POLL_DELAYS.length) {
      var delay = IDENTITY_POLL_DELAYS[identityPollStep];
      identityPollStep++;
      setTimeout(refreshCurrentUser, delay);
      return;
    }
  }
  lockUserInterface();
}

/* ── State normalize / persist ── */
function copyBaseRubrics() {
  return BASE_RUBRICS.map(function (rubric) {
    return { id: rubric.id, name: rubric.name, weight: rubric.weight, description: rubric.description, builtIn: true };
  });
}
function createDefaultEssayState() {
  return { version: 2, essay: { html: '', lastEditedAt: null }, rubrics: copyBaseRubrics(), evaluations: [] };
}
function clampWeight(value) {
  var number = Math.floor(toNumber(value, 10));
  if (number < 1) return 10;
  if (number > 100) return 100;
  return number;
}
function normalizeEssayState(rawValue) {
  if (!rawValue || typeof rawValue !== 'object') return createDefaultEssayState();
  var output = { version: typeof rawValue.version === 'number' ? rawValue.version : 2, essay: { html: '', lastEditedAt: null }, rubrics: [], evaluations: [] };
  if (rawValue.essay && typeof rawValue.essay === 'object') {
    if (typeof rawValue.essay.html === 'string') output.essay.html = rawValue.essay.html;
    else if (typeof rawValue.essay.text === 'string' && rawValue.essay.text) output.essay.html = plainTextToEditorHtml(rawValue.essay.text);
    output.essay.lastEditedAt = typeof rawValue.essay.lastEditedAt === 'string' ? rawValue.essay.lastEditedAt : null;
  }
  if (Array.isArray(rawValue.rubrics)) {
    rawValue.rubrics.forEach(function (rubric) {
      if (rubric && typeof rubric === 'object' && rubric.name) {
        output.rubrics.push({
          id: String(rubric.id || makeId('rubric')),
          name: String(rubric.name).slice(0, 80),
          weight: clampWeight(rubric.weight),
          description: String(rubric.description || '').slice(0, 500),
          builtIn: !!rubric.builtIn
        });
      }
    });
  }
  if (!output.rubrics.length) output.rubrics = copyBaseRubrics();
  if (Array.isArray(rawValue.evaluations)) {
    output.evaluations = rawValue.evaluations.filter(function (evaluation) {
      return evaluation && typeof evaluation === 'object';
    });
  }
  return output;
}
function persistNow() {
  var snapshotJson = JSON.stringify(essayState);
  lastStagedJson = snapshotJson;
  saveInFlight = true;
  try { tool.setValue(JSON.parse(snapshotJson)); } catch (error) {}
  setTimeout(function () { saveInFlight = false; }, 400);
}
function schedulePersist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 350);
}
function requestParentSave(announceSuccess) {
  if (!canEditEssay()) return;
  try {
    tool.requestSave(function (error, accepted) {
      if (error || !accepted) {
        if (!autoSaveWarningShown) {
          autoSaveWarningShown = true;
          tool.notify('Automatic save was not accepted by the CMS form. Use the CMS Save button to persist your essay.', 'warning');
        }
        return;
      }
      if (announceSuccess) tool.notify('Saved to the CMS record.', 'success');
    });
  } catch (error) {}
}

/* ── Rubric helpers ── */
function totalRubricWeight() {
  return essayState.rubrics.reduce(function (sum, rubric) { return sum + rubric.weight; }, 0);
}
function findRubricById(rubricId) {
  for (var i = 0; i < essayState.rubrics.length; i++) {
    if (essayState.rubrics[i].id === rubricId) return essayState.rubrics[i];
  }
  return null;
}

/* ── Rendering ── */
function renderWholeTool() {
  renderAssignment();
  renderEssayEditor();
  renderRubricPanel();
  renderEvaluationPanel();
  lockUserInterface();
  safeResize();
}
function renderAssignment() {
  var subject = getEssaySubject();
  var subjectLine = elementById('ewe-subject-line');
  if (subjectDefinitionStatus === 'error') {
    subjectLine.innerHTML = '<span class="ewe-alert ewe-alert-warn">The subject definition could not be loaded: ' + escapeHtml(subjectDefinitionErrorText) + '</span>';
  } else if (!subject) {
    subjectLine.innerHTML = '<span class="ewe-alert ewe-alert-warn">No subject is configured yet. The CMS admin must set the <code>essaySubject</code> parameter or a <code>subjectDefinitionId</code> / <code>subjectDefinitionJson</code> parameter in the field settings.</span>';
  } else {
    subjectLine.textContent = subject;
  }
  var instructions = getEssayInstructions();
  var instructionsLine = elementById('ewe-instructions-line');
  if (instructions) {
    instructionsLine.textContent = instructions;
    instructionsLine.style.display = '';
  } else {
    instructionsLine.style.display = 'none';
  }
  var metaParts = ['Essay language: ' + escapeHtml(getEssayLanguage())];
  var minimum = getMinimumWordCount();
  if (minimum > 0) metaParts.push('Minimum length: ' + minimum + ' words');
  if (subjectDefinitionStatus === 'loaded' && activeSubjectDefinition) {
    metaParts.push('Subject definition: ' + escapeHtml(activeSubjectDefinition.definitionName || activeSubjectDefinition.subject || 'loaded'));
  }
  elementById('ewe-assignment-meta').textContent = metaParts.join(' · ');
}
function renderEssayEditor() {
  var editor = elementById('ewe-editor');
  if (editor && document.activeElement !== editor) editor.innerHTML = sanitizeStoredHtml(essayState.essay.html);
  updateEssayCounts();
}
function updateEssayCounts() {
  var plainText = htmlToPlainText(essayState.essay.html);
  var wordCount = countWords(plainText);
  var parts = [wordCount + (wordCount === 1 ? ' word' : ' words'), plainText.length + ' characters'];
  var minimum = getMinimumWordCount();
  var belowMinimum = minimum > 0 && wordCount > 0 && wordCount < minimum;
  if (belowMinimum) parts.push((minimum - wordCount) + ' below the ' + minimum + '-word minimum');
  var countElement = elementById('ewe-word-count');
  countElement.textContent = parts.join(' · ');
  countElement.className = belowMinimum ? 'ewe-word-warn' : '';
  var editor = elementById('ewe-editor');
  if (editor) editor.classList.toggle('ewe-editor-empty', wordCount === 0);
}
function updateEvaluateButtonState() {
  var button = elementById('ewe-evaluate-button');
  if (!button) return;
  button.disabled = evaluationInProgress || !canEditEssay();
  button.textContent = evaluationInProgress ? '⏳ Evaluating…' : '✨ Evaluate My Essay';
}

/* ── Format toolbar ── */
function applyFormatCommand(command) {
  var editor = elementById('ewe-editor');
  if (!editor) return;
  editor.focus();
  try { document.execCommand(command, false, null); } catch (error) {}
  handleEssayInput();
  syncFormatBar();
}
function applyParagraphFormat(value) {
  var editor = elementById('ewe-editor');
  if (!editor) return;
  try { document.execCommand('formatBlock', false, value); } catch (error) {}
  handleEssayInput();
  syncFormatBar();
}
function applyFontSize(value) {
  var editor = elementById('ewe-editor');
  if (!editor) return;
  try { document.execCommand('fontSize', false, value); } catch (error) {}
  handleEssayInput();
  syncFormatBar();
}
function syncFormatBar() {
  var paragraphSelect = elementById('ewe-format-paragraph');
  var sizeSelect = elementById('ewe-format-size');
  var boldButton = elementById('ewe-format-bold');
  var italicButton = elementById('ewe-format-italic');
  var editor = elementById('ewe-editor');
  var selectionInsideEditor = false;
  if (editor) {
    var activeElement = document.activeElement;
    selectionInsideEditor = activeElement === editor || (editor.contains && editor.contains(activeElement));
  }
  try {
    if (boldButton) boldButton.classList.toggle('ewe-on', selectionInsideEditor && document.queryCommandState('bold'));
    if (italicButton) italicButton.classList.toggle('ewe-on', selectionInsideEditor && document.queryCommandState('italic'));
    if (paragraphSelect) {
      var blockValue = selectionInsideEditor ? String(document.queryCommandValue('formatBlock') || '').toLowerCase() : '';
      paragraphSelect.value = blockValue || 'p';
    }
    if (sizeSelect) {
      var sizeValue = selectionInsideEditor ? String(document.queryCommandValue('fontSize') || '') : '';
      if (sizeValue === '2' || sizeValue === '3' || sizeValue === '4') sizeSelect.value = sizeValue;
      else sizeSelect.value = '3';
    }
  } catch (error) {}
}
function updateFormatControlsState(enabled) {
  ['ewe-format-paragraph', 'ewe-format-size', 'ewe-format-bold', 'ewe-format-italic'].forEach(function (id) {
    var control = elementById(id);
    if (control) control.disabled = !enabled;
  });
}

/* ── Side panels ── */
function setPanelState(panelId, isOpen) {
  var panel = elementById(panelId);
  if (!panel) return;
  panel.classList.toggle('ewe-open', isOpen);
  panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
}
function openPanel(panelName) {
  closeModal();
  versionMenuOpen = false;
  var root = elementById('ewe-app');
  if (!root) return;
  activePanelName = panelName;
  root.classList.add('ewe-panel-open');
  setPanelState('ewe-rubrics-panel', panelName === 'rubrics');
  setPanelState('ewe-eval-panel', panelName === 'evaluation');
  renderRubricPanel();
  renderEvaluationPanel();
  safeResize();
}
function closePanel() {
  activePanelName = null;
  versionMenuOpen = false;
  var root = elementById('ewe-app');
  if (root) root.classList.remove('ewe-panel-open');
  setPanelState('ewe-rubrics-panel', false);
  setPanelState('ewe-eval-panel', false);
}
function togglePanel(panelName) {
  if (activePanelName === panelName) closePanel();
  else openPanel(panelName);
}

/* ── Rubric panel ── */
function renderRubricPanel() {
  var listElement = elementById('ewe-rubric-list');
  var rows = essayState.rubrics.map(function (rubric, index) {
    var badge = rubric.builtIn
      ? '<span class="ewe-rubric-badge">base</span>'
      : '<span class="ewe-rubric-badge ewe-rubric-badge-custom">custom</span>';
    return '<div class="ewe-rubric-row">' +
      '<div class="ewe-rubric-row-main">' +
        '<div class="ewe-rubric-name">' + (index + 1) + '. ' + escapeHtml(rubric.name) + ' ' + badge + '</div>' +
        '<div class="ewe-rubric-desc">' + escapeHtml(rubric.description) + '</div>' +
      '</div>' +
      '<div class="ewe-rubric-weight">' + rubric.weight + '%</div>' +
      '<div class="ewe-rubric-buttons">' +
        '<button class="ewe-icon-btn ewe-admin-only" data-act="edit-rubric" data-id="' + escapeHtml(rubric.id) + '" title="Edit rubric">✎</button>' +
        '<button class="ewe-icon-btn ewe-admin-only" data-act="delete-rubric" data-id="' + escapeHtml(rubric.id) + '" title="Delete rubric">✕</button>' +
      '</div>' +
    '</div>';
  }).join('');
  listElement.innerHTML = rows || '<div class="ewe-empty-small">No rubrics defined.</div>';
  var definitionBlock = elementById('ewe-definition-rubric-block');
  if (definitionBlock) {
    var definitionHtml = '';
    if (subjectDefinitionStatus === 'loaded' && activeSubjectDefinition) {
      var definitionName = activeSubjectDefinition.definitionName || activeSubjectDefinition.subject || 'the subject definition';
      if (definitionRubricsDifferFromCurrent()) {
        definitionHtml += '<div class="ewe-definition-note">📌 Rubrics are provided by ' + escapeHtml(definitionName) + '. The current rubrics differ from the definition.</div>' +
          '<div class="ewe-card-actions"><button class="ewe-btn ewe-btn-ghost ewe-admin-only" id="btn-apply-definition-rubrics" data-act="apply-definition-rubrics">↧ Apply Rubrics from Definition</button></div>';
      } else {
        definitionHtml += '<div class="ewe-definition-note ewe-definition-note-ok">📌 Rubrics match ' + escapeHtml(definitionName) + ' ✓</div>';
      }
    } else if (subjectDefinitionStatus === 'error') {
      definitionHtml += '<div class="ewe-alert ewe-alert-warn">Subject definition could not be loaded: ' + escapeHtml(subjectDefinitionErrorText) + '</div>';
    }
    definitionBlock.innerHTML = definitionHtml;
  }
  updateWeightSummary();
}
function updateWeightSummary() {
  var total = totalRubricWeight();
  var summary = elementById('ewe-weight-summary');
  if (total === 100) {
    summary.innerHTML = '<span class="ewe-weight-ok">Total weight: 100% ✓</span>';
  } else {
    summary.innerHTML = '<span class="ewe-weight-warn">Total weight: ' + total + '% (' + (100 - total) + '% unassigned)</span>';
  }
}

/* ── Rubric editor modal ── */
function openModal(title, bodyHtml) {
  elementById('ewe-modal-title').textContent = title;
  elementById('ewe-modal-body').innerHTML = bodyHtml;
  elementById('ewe-modal-overlay').classList.add('ewe-open');
}
function closeModal() {
  elementById('ewe-modal-overlay').classList.remove('ewe-open');
  rubricBeingEditedId = null;
}
function openRubricEditor(rubricId) {
  var rubric = rubricId ? findRubricById(rubricId) : null;
  rubricBeingEditedId = rubricId || null;
  var name = rubric ? rubric.name : '';
  var description = rubric ? rubric.description : '';
  var weight = rubric ? rubric.weight : '';
  openModal(
    rubric ? 'Edit Rubric' : 'Add Rubric',
    '<div class="ewe-form-row"><label for="ewe-rubric-name">Rubric name</label>' +
    '<input id="ewe-rubric-name" type="text" maxlength="80" value="' + escapeHtml(name) + '" placeholder="e.g. Creativity &amp; Originality"></div>' +
    '<div class="ewe-form-row"><label for="ewe-rubric-desc">Description - what should the evaluator look for in this area?</label>' +
    '<textarea id="ewe-rubric-desc" rows="4" maxlength="500" placeholder="e.g. How original and imaginative the ideas are, and how well the writer avoids clichés.">' + escapeHtml(description) + '</textarea></div>' +
    '<div class="ewe-form-row"><label for="ewe-rubric-weight">Weight (% of the final score)</label>' +
    '<input id="ewe-rubric-weight" type="number" min="1" max="100" step="1" value="' + weight + '"></div>' +
    '<div class="ewe-form-hint" id="ewe-rubric-hint"></div>' +
    '<div class="ewe-modal-actions">' +
    '<button class="ewe-btn ewe-btn-ghost" data-act="modal-cancel">Cancel</button>' +
    '<button class="ewe-btn ewe-btn-primary" data-act="modal-save">Save Rubric</button>' +
    '</div>'
  );
  updateRubricWeightHint();
}
function updateRubricWeightHint() {
  var weightInput = elementById('ewe-rubric-weight');
  var hint = elementById('ewe-rubric-hint');
  if (!weightInput || !hint) return;
  var newWeight = Math.floor(toNumber(weightInput.value, 0));
  var existing = rubricBeingEditedId ? findRubricById(rubricBeingEditedId) : null;
  var available = 100 - totalRubricWeight() + (existing ? existing.weight : 0);
  hint.classList.remove('ewe-form-hint-error');
  if (!newWeight || newWeight < 1) { hint.textContent = 'Enter a weight between 1 and 100.'; return; }
  var remainingAfterSave = available - newWeight;
  if (remainingAfterSave < 0) {
    hint.textContent = 'Weight is too high. You have ' + available + '% available.';
    hint.classList.add('ewe-form-hint-error');
  } else {
    hint.textContent = 'Remaining weight after save: ' + remainingAfterSave + '%.';
  }
}
function saveRubricFromEditor() {
  var name = inputValueById('ewe-rubric-name').trim();
  var description = inputValueById('ewe-rubric-desc').trim();
  var weight = Math.floor(toNumber(inputValueById('ewe-rubric-weight'), 0));
  if (name.length < 2) { tool.notify('Give the rubric a name of at least 2 characters.', 'warning'); return; }
  if (!weight || weight < 1 || weight > 100) { tool.notify('Weight must be a number between 1 and 100.', 'warning'); return; }
  var existing = rubricBeingEditedId ? findRubricById(rubricBeingEditedId) : null;
  var available = 100 - totalRubricWeight() + (existing ? existing.weight : 0);
  if (weight > available) {
    tool.notify('This weight exceeds the ' + available + '% still available.', 'warning');
    updateRubricWeightHint();
    return;
  }
  if (existing) {
    existing.name = name;
    existing.description = description;
    existing.weight = weight;
    tool.notify('Rubric "' + name + '" updated.', 'success');
  } else {
    if (essayState.rubrics.length >= MAX_RUBRIC_COUNT) {
      tool.notify('Maximum of ' + MAX_RUBRIC_COUNT + ' rubrics reached. Delete one first.', 'warning');
      return;
    }
    essayState.rubrics.push({ id: makeId('rubric'), name: name, description: description, weight: weight, builtIn: false });
    tool.notify('Rubric "' + name + '" added.', 'success');
  }
  persistNow();
  closeModal();
  renderWholeTool();
}
function removeRubric(rubricId) {
  if (essayState.rubrics.length <= 1) { tool.notify('At least one rubric is required.', 'warning'); return; }
  var removed = null;
  essayState.rubrics = essayState.rubrics.filter(function (rubric) {
    if (rubric.id === rubricId) { removed = rubric; return false; }
    return true;
  });
  if (!removed) return;
  persistNow();
  renderWholeTool();
  tool.notify('Rubric "' + removed.name + '" removed. Its weight is now unassigned - the score is rebalanced automatically.', 'warning');
}
function handleResetRubrics() {
  if (!resetRubricsArmed) {
    resetRubricsArmed = true;
    updateResetButtonText();
    tool.notify('This removes all custom rubrics and restores the 5 base criteria. Click "Reset to Base" again to confirm.', 'warning');
    setTimeout(function () { resetRubricsArmed = false; updateResetButtonText(); }, 4000);
    return;
  }
  resetRubricsArmed = false;
  essayState.rubrics = copyBaseRubrics();
  persistNow();
  renderWholeTool();
  updateResetButtonText();
  tool.notify('Rubrics reset to the base criteria.', 'success');
}
function updateResetButtonText() {
  var button = elementById('btn-reset-rubrics');
  if (button) button.textContent = resetRubricsArmed ? '⚠ Confirm Reset?' : '↺ Reset to Base';
}

/* ── Evaluation rendering ── */
function findEvaluationById(evaluationId) {
  for (var i = 0; i < essayState.evaluations.length; i++) {
    if (essayState.evaluations[i].id === evaluationId) return essayState.evaluations[i];
  }
  return null;
}
function scoreToneClass(score) {
  if (score >= 85) return 'ewe-tone-excellent';
  if (score >= 70) return 'ewe-tone-good';
  if (score >= 55) return 'ewe-tone-fair';
  return 'ewe-tone-poor';
}
function gradeBandForScore(score) {
  var value = clampScore(score);
  for (var i = 0; i < GRADE_BANDS.length; i++) {
    if (value >= GRADE_BANDS[i].minScore) return GRADE_BANDS[i];
  }
  return GRADE_BANDS[GRADE_BANDS.length - 1];
}
function updateScoreChip(evaluation) {
  var chip = elementById('ewe-score-chip');
  if (!chip) return;
  if (!evaluation) { chip.classList.add('ewe-score-chip-hidden'); return; }
  chip.classList.remove('ewe-score-chip-hidden');
  var tone = scoreToneClass(evaluation.totalScore);
  elementById('ewe-score-chip-dot').className = 'ewe-score-chip-dot ' + tone;
  var valueElement = elementById('ewe-score-chip-value');
  valueElement.textContent = formatScore(evaluation.totalScore);
  valueElement.className = 'ewe-score-chip-value ' + tone;
}
function renderEvaluationPanel() {
  var evaluationCount = essayState.evaluations.length;
  var countChip = elementById('ewe-eval-count-chip');
  countChip.textContent = evaluationCount
    ? evaluationCount + ' evaluation' + (evaluationCount > 1 ? 's' : '')
    : '';
  updateScoreChip(evaluationCount ? essayState.evaluations[evaluationCount - 1] : null);
  var body = elementById('ewe-eval-body');
  if (!evaluationCount) {
    body.innerHTML = '<div class="ewe-empty-state"><div class="ewe-empty-icon">🏆</div>' +
      '<h3>No evaluation yet</h3>' +
      '<p>Write your essay and click "Evaluate My Essay". You get a score out of 100 with a detailed rubric-by-rubric breakdown. Your text is never changed.</p></div>';
    return;
  }
  var selected = findEvaluationById(activeEvaluationId) || essayState.evaluations[evaluationCount - 1];
  activeEvaluationId = selected.id;
  var content = activeEvaluationView === 'progress'
    ? renderProgressView()
    : renderVersionDropdown() + renderEvaluationDetail(selected);
  body.innerHTML = renderEvaluationTabs() + content;
}
function renderEvaluationTabs() {
  return '<div class="ewe-eval-tabs">' +
    '<button class="ewe-eval-tab' + (activeEvaluationView === 'feedback' ? ' ewe-eval-tab-active' : '') + '" data-act="switch-eval-view" data-view="feedback">📝 Feedback</button>' +
    '<button class="ewe-eval-tab' + (activeEvaluationView === 'progress' ? ' ewe-eval-tab-active' : '') + '" data-act="switch-eval-view" data-view="progress">📈 Progress</button>' +
    '</div>';
}
function collectRubricNamesForCharts() {
  var names = [];
  essayState.evaluations.forEach(function (evaluation) {
    (evaluation.rubricResults || []).forEach(function (result) {
      if (result.rubricName && names.indexOf(result.rubricName) === -1) names.push(result.rubricName);
    });
  });
  return names.slice(0, 8);
}
function renderProgressSummary() {
  var first = essayState.evaluations[0];
  var last = essayState.evaluations[essayState.evaluations.length - 1];
  var delta = Math.round((last.totalScore - first.totalScore) * 10) / 10;
  var improved = delta >= 0;
  return '<div class="ewe-progress-summary">' +
    'Overall: ' + formatScore(first.totalScore) + ' → ' + formatScore(last.totalScore) +
    ' <span class="' + (improved ? 'ewe-delta-up' : 'ewe-delta-down') + '">(' + (improved ? '+' : '') + delta + ')</span>' +
    ' across ' + essayState.evaluations.length + ' evaluations</div>';
}
function renderProgressView() {
  var evaluationCount = essayState.evaluations.length;
  if (evaluationCount < 2) {
    return '<div class="ewe-empty-state"><div class="ewe-empty-icon">📈</div>' +
      '<h3>Progress needs two evaluations</h3>' +
      '<p>Revise your essay and evaluate again. The charts will show your improvement overall and for every rubric.</p></div>';
  }
  var html = renderProgressSummary();
  html += '<div class="ewe-chart-card"><div class="ewe-chart-title">Overall Score</div>' +
    buildLineChartSvg([{
      name: 'Overall score',
      color: CHART_COLORS[0],
      values: essayState.evaluations.map(function (evaluation) { return evaluation.totalScore; })
    }]) +
    '</div>';
  var rubricNames = collectRubricNamesForCharts();
  var rubricSeries = rubricNames.map(function (name, index) {
    return {
      name: name,
      color: CHART_COLORS[index % CHART_COLORS.length],
      values: essayState.evaluations.map(function (evaluation) {
        for (var i = 0; i < (evaluation.rubricResults || []).length; i++) {
          if (evaluation.rubricResults[i].rubricName === name) return evaluation.rubricResults[i].score;
        }
        return null;
      })
    };
  });
  html += '<div class="ewe-chart-card"><div class="ewe-chart-title">Progress by Rubric</div>' +
    buildLineChartSvg(rubricSeries) + renderChartLegend(rubricSeries) +
    '</div>';
  return html;
}
function renderChartLegend(seriesList) {
  return '<div class="ewe-chart-legend">' + seriesList.map(function (series) {
    return '<span class="ewe-legend-item"><span class="ewe-legend-dot" style="background:' + escapeHtml(series.color) + '"></span>' + escapeHtml(series.name) + '</span>';
  }).join('') + '</div>';
}
function buildLineChartSvg(seriesList) {
  var width = 320;
  var height = 170;
  var marginLeft = 30;
  var marginRight = 14;
  var marginTop = 18;
  var marginBottom = 26;
  var plotWidth = width - marginLeft - marginRight;
  var plotHeight = height - marginTop - marginBottom;
  var pointCount = seriesList.length ? seriesList[0].values.length : 0;
  if (pointCount < 1) return '';
  function xForPoint(index) {
    return marginLeft + (pointCount === 1 ? plotWidth / 2 : plotWidth * index / (pointCount - 1));
  }
  function yForScore(score) {
    return marginTop + plotHeight * (1 - clampScore(score) / 100);
  }
  var html = '<svg class="ewe-chart-svg" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMidYMid meet" role="img">';
  [0, 25, 50, 75, 100].forEach(function (tick) {
    var tickY = yForScore(tick);
    html += '<line class="ewe-chart-grid" x1="' + marginLeft + '" y1="' + tickY + '" x2="' + (width - marginRight) + '" y2="' + tickY + '"></line>';
    html += '<text class="ewe-chart-tick" x="' + (marginLeft - 5) + '" y="' + (tickY + 3) + '" text-anchor="end">' + tick + '</text>';
  });
  for (var labelIndex = 0; labelIndex < pointCount; labelIndex++) {
    html += '<text class="ewe-chart-tick" x="' + xForPoint(labelIndex) + '" y="' + (height - 8) + '" text-anchor="middle">#' + (labelIndex + 1) + '</text>';
  }
  seriesList.forEach(function (series) {
    var color = series.color;
    var segments = [];
    var currentSegment = [];
    series.values.forEach(function (value, index) {
      if (value == null) {
        if (currentSegment.length) { segments.push(currentSegment); currentSegment = []; }
        return;
      }
      currentSegment.push({ x: xForPoint(index), y: yForScore(value), value: value, index: index });
    });
    if (currentSegment.length) segments.push(currentSegment);
    segments.forEach(function (segment) {
      if (segment.length === 1) {
        html += '<circle class="ewe-chart-dot" cx="' + segment[0].x.toFixed(1) + '" cy="' + segment[0].y.toFixed(1) + '" r="3.5" style="fill:' + color + '"><title>' + escapeHtml(series.name) + ' #' + (segment[0].index + 1) + ': ' + formatScore(segment[0].value) + '/100</title></circle>';
        return;
      }
      var pointsAttribute = segment.map(function (point) { return point.x.toFixed(1) + ',' + point.y.toFixed(1); }).join(' ');
      html += '<polyline class="ewe-chart-line" points="' + pointsAttribute + '" style="stroke:' + color + '"></polyline>';
      segment.forEach(function (point) {
        html += '<circle class="ewe-chart-dot" cx="' + point.x.toFixed(1) + '" cy="' + point.y.toFixed(1) + '" r="3.5" style="fill:' + color + '"><title>' + escapeHtml(series.name) + ' #' + (point.index + 1) + ': ' + formatScore(point.value) + '/100</title></circle>';
      });
    });
  });
  return html + '</svg>';
}
function versionNumberOf(evaluation) {
  for (var i = 0; i < essayState.evaluations.length; i++) {
    if (essayState.evaluations[i].id === evaluation.id) return i + 1;
  }
  return 1;
}
function versionBadgeHtml(score) {
  return '<span class="ewe-version-badge ' + scoreToneClass(score) + '">' + formatScore(score) + '</span>';
}
function renderVersionDropdown() {
  var selected = findEvaluationById(activeEvaluationId) || essayState.evaluations[essayState.evaluations.length - 1];
  var html = '<div class="ewe-version-select" id="ewe-version-select">' +
    '<button class="ewe-version-select-btn' + (versionMenuOpen ? ' ewe-open' : '') + '" data-act="toggle-version-menu">' +
      versionBadgeHtml(selected.totalScore) +
      '<span class="ewe-version-label">Version #' + versionNumberOf(selected) + '</span>' +
      '<span class="ewe-version-date">' + formatShortDateTime(selected.evaluatedAt) + '</span>' +
      '<span class="ewe-version-caret">▾</span>' +
    '</button>';
  if (versionMenuOpen) {
    html += '<div class="ewe-version-menu">';
    essayState.evaluations.slice().reverse().forEach(function (evaluation) {
      var activeClass = evaluation.id === selected.id ? ' ewe-version-option-active' : '';
      html += '<button class="ewe-version-option' + activeClass + '" data-act="select-version" data-eval-id="' + escapeHtml(evaluation.id) + '">' +
        versionBadgeHtml(evaluation.totalScore) +
        '<span class="ewe-version-option-label">Version #' + versionNumberOf(evaluation) + '</span>' +
        '<span class="ewe-version-option-date">' + formatShortDateTime(evaluation.evaluatedAt) + '</span>' +
        (evaluation.id === selected.id ? '<span class="ewe-version-option-check">✓</span>' : '') +
      '</button>';
    });
    html += '</div>';
  }
  return html + '</div>';
}
function scoreRingHtml(score) {
  var value = clampScore(score);
  var circumference = 2 * Math.PI * 52;
  var filledLength = circumference * value / 100;
  var tone = scoreToneClass(value);
  return '<svg class="ewe-ring" viewBox="0 0 120 120" aria-label="Score ' + formatScore(value) + ' out of 100">' +
    '<circle class="ewe-ring-track" cx="60" cy="60" r="52"></circle>' +
    '<circle class="ewe-ring-fill ' + tone + '" cx="60" cy="60" r="52" stroke-dasharray="' + filledLength.toFixed(1) + ' ' + circumference.toFixed(1) + '"></circle>' +
    '<text class="ewe-ring-value" x="60" y="58" text-anchor="middle">' + formatScore(value) + '</text>' +
    '<text class="ewe-ring-caption" x="60" y="78" text-anchor="middle">of 100</text>' +
    '</svg>';
}
function renderScoreDelta(evaluation) {
  var index = -1;
  for (var i = 0; i < essayState.evaluations.length; i++) {
    if (essayState.evaluations[i].id === evaluation.id) { index = i; break; }
  }
  if (index <= 0) return '';
  var previous = essayState.evaluations[index - 1];
  var delta = Math.round((evaluation.totalScore - previous.totalScore) * 10) / 10;
  if (delta === 0) return '<div class="ewe-score-delta ewe-delta-same">Same score as Version #' + index + '</div>';
  var improved = delta > 0;
  return '<div class="ewe-score-delta ' + (improved ? 'ewe-delta-up' : 'ewe-delta-down') + '">' +
    (improved ? '▲ +' : '▼ ') + delta + ' vs Version #' + index + '</div>';
}
function bulletListHtml(items, listClass) {
  if (!items.length) return '';
  return '<ul class="' + listClass + '">' +
    items.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') +
    '</ul>';
}
function rubricResultCardHtml(result) {
  var hasScore = result.score != null;
  var scoreText = hasScore ? formatScore(result.score) + ' / 100' : 'Not scored';
  var tone = hasScore ? scoreToneClass(result.score) : '';
  var html = '<div class="ewe-rubric-result">' +
    '<div class="ewe-rubric-result-head">' +
      '<span class="ewe-rubric-result-name">' + escapeHtml(result.rubricName) + '</span>' +
      '<span class="ewe-rubric-result-meta">' + result.weight + '% of final score</span>' +
      '<span class="ewe-rubric-result-score ' + tone + '">' + escapeHtml(scoreText) + '</span>' +
    '</div>' +
    '<div class="ewe-score-bar"><div class="ewe-score-bar-fill ' + tone + '" style="width:' + (hasScore ? clampScore(result.score) : 0) + '%"></div></div>';
  if (result.comment) html += '<p class="ewe-rubric-result-comment">' + escapeHtml(result.comment) + '</p>';
  if (result.strengths.length) html += bulletListHtml(result.strengths, 'ewe-strengths');
  if (result.suggestions.length) {
    html += '<div class="ewe-mini-label">Suggestions to improve this area</div><ol class="ewe-suggestions">' +
      result.suggestions.map(function (suggestion) { return '<li>' + escapeHtml(suggestion) + '</li>'; }).join('') +
      '</ol>';
  }
  return html + '</div>';
}
function renderEvaluationDetail(evaluation) {
  var band = gradeBandForScore(evaluation.totalScore);
  var tone = scoreToneClass(evaluation.totalScore);
  var html = '<div class="ewe-score-summary">' + scoreRingHtml(evaluation.totalScore) +
    '<div class="ewe-score-info">' +
      '<div class="ewe-score-badge ' + tone + '">Grade ' + band.label + ' - ' + band.title + '</div>' +
      '<div class="ewe-score-meta">' + evaluation.essayWordCount + ' words evaluated</div>' +
      '<div class="ewe-score-meta">' + formatShortDateTime(evaluation.evaluatedAt) + ' · by ' + escapeHtml(evaluation.requestedBy || 'Evaluator') + '</div>' +
      (evaluation.subjectSnapshot ? '<div class="ewe-score-subject">' + escapeHtml(evaluation.subjectSnapshot) + '</div>' : '') +
      renderScoreDelta(evaluation) +
    '</div></div>';
  if (evaluation.rawResponse) {
    html += '<div class="ewe-alert ewe-alert-warn">The evaluation response could not be parsed as structured data. The raw response is shown below.</div>' +
      '<pre class="ewe-raw-response">' + escapeHtml(String(evaluation.rawResponse).slice(0, 20000)) + '</pre>';
    return html;
  }
  html += '<div class="ewe-section-title">Overall Summary</div>';
  html += '<p class="ewe-summary-text">' + escapeHtml(evaluation.overallSummary || 'No summary.') + '</p>';
  if (evaluation.overallStrengths.length || evaluation.overallWeaknesses.length) {
    html += '<div class="ewe-feedback-grid">';
    if (evaluation.overallStrengths.length) {
      html += '<div><div class="ewe-section-title ewe-good">Strengths</div>' + bulletListHtml(evaluation.overallStrengths, 'ewe-strengths') + '</div>';
    }
    if (evaluation.overallWeaknesses.length) {
      html += '<div><div class="ewe-section-title ewe-bad">Areas to Improve</div>' + bulletListHtml(evaluation.overallWeaknesses, 'ewe-weaknesses') + '</div>';
    }
    html += '</div>';
  }
  html += '<div class="ewe-section-title">Rubric Breakdown</div>';
  evaluation.rubricResults.forEach(function (result) { html += rubricResultCardHtml(result); });
  if (evaluation.nextSteps.length) {
    html += '<div class="ewe-section-title">Next Steps</div><ol class="ewe-suggestions">' +
      evaluation.nextSteps.map(function (step) { return '<li>' + escapeHtml(step) + '</li>'; }).join('') +
      '</ol>';
  }
  html += '<div class="ewe-card-actions"><button class="ewe-btn ewe-btn-ghost" data-act="copy-suggestions">📋 Copy All Suggestions</button></div>';
  return html;
}
function copySuggestionsToClipboard() {
  var evaluation = findEvaluationById(activeEvaluationId) || (essayState.evaluations.length ? essayState.evaluations[essayState.evaluations.length - 1] : null);
  if (!evaluation) return;
  var lines = ['ESSAY FEEDBACK - ' + formatScore(evaluation.totalScore) + '/100', ''];
  evaluation.rubricResults.forEach(function (result) {
    lines.push('■ ' + result.rubricName + ' (' + result.weight + '%): ' + (result.score == null ? 'not scored' : formatScore(result.score) + '/100'));
    if (result.comment) lines.push(result.comment);
    if (result.suggestions.length) {
      lines.push('Suggestions:');
      result.suggestions.forEach(function (suggestion, index) { lines.push('  ' + (index + 1) + '. ' + suggestion); });
    }
    lines.push('');
  });
  if (evaluation.nextSteps.length) {
    lines.push('■ Next steps:');
    evaluation.nextSteps.forEach(function (step, index) { lines.push('  ' + (index + 1) + '. ' + step); });
  }
  copyTextToClipboard(lines.join('\n'));
}
function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      function () { tool.notify('Suggestions copied to clipboard.', 'success'); },
      function () { showCopyFallbackModal(text); }
    );
  } else {
    showCopyFallbackModal(text);
  }
}
function showCopyFallbackModal(text) {
  openModal(
    'Copy Suggestions',
    '<p class="ewe-modal-hint">Select the text below and press Ctrl+C to copy it.</p>' +
    '<textarea class="ewe-copy-area" id="ewe-copy-area" readonly>' + escapeHtml(text) + '</textarea>'
  );
  var area = elementById('ewe-copy-area');
  if (area) { area.focus(); area.select(); }
}

/* ── Evaluation service ── */
function buildEvaluationPrompt(essayText) {
  var rubricLines = essayState.rubrics.map(function (rubric, index) {
    return (index + 1) + '. ' + rubric.name + ' (weight ' + rubric.weight + '%): ' + rubric.description;
  }).join('\n');
  var previousScoreLine = '';
  if (essayState.evaluations.length) {
    var latest = essayState.evaluations[essayState.evaluations.length - 1];
    previousScoreLine = 'PREVIOUS EVALUATION SCORE: ' + formatScore(latest.totalScore) +
      '/100. The student may have revised the essay since then. If you notice improvement or regression, mention it.\n';
  }
  return [
    'You are an expert essay evaluator and writing coach. Evaluate the student essay below against the provided rubrics with extreme detail. You must NEVER rewrite, edit or correct the essay text itself - only analyze it and suggest how the student can improve it. Respond ONLY with valid JSON.',
    '',
    'ESSAY SUBJECT: ' + getEssaySubject(),
    'ESSAY INSTRUCTIONS: ' + (getEssayInstructions() || 'None provided.'),
    'ESSAY LANGUAGE: ' + getEssayLanguage(),
    '',
    'EVALUATION RUBRICS (each weight is its share of the final 100-point score):',
    rubricLines,
    '',
    previousScoreLine,
    'STUDENT ESSAY (' + countWords(essayText) + ' words):',
    '"""',
    essayText,
    '"""',
    '',
    'OUTPUT CONTRACT - return STRICT JSON with exactly this shape:',
    '{',
    '  "overallSummary": "one detailed paragraph (120-200 words) summarizing the overall quality",',
    '  "overallStrengths": ["3-6 specific strengths, quoting actual sentences from the essay"],',
    '  "overallWeaknesses": ["3-6 specific weaknesses, quoting actual sentences from the essay"],',
    '  "nextSteps": ["4-6 prioritized, concrete improvement actions the student should take"],',
    '  "rubricResults": [',
    '    {',
    '      "rubricName": "Content & Ideas",',
    '      "score": 87,',
    '      "comment": "detailed analysis paragraph (80-150 words) that quotes specific sentences from the essay",',
    '      "strengths": ["2-4 strengths specific to this rubric"],',
    '      "suggestions": ["3-6 concrete, specific suggestions to improve this rubric area"]',
    '    }',
    '  ]',
    '}',
    '',
    'HARD RULES:',
    '- Include ONE entry in rubricResults for EVERY rubric listed above, in the same order, with the EXACT rubric name.',
    '- Each score must be a number between 0 and 100 (0 = very poor, 100 = outstanding).',
    '- Quote actual sentences from the essay inside comments, strengths and weaknesses.',
    '- Be extremely detailed and specific. Avoid generic praise and generic advice.',
    '- Every suggestion must be actionable and concrete.',
    '- Never output the corrected or rewritten essay. Never modify the student text.',
    '- Output ONLY the JSON. No prose before or after it.'
  ].join('\n');
}
function parseAiJsonResponse(text) {
  if (!text) return null;
  var cleaned = String(text).trim();
  cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  var openIndex = cleaned.indexOf('{');
  var closeIndex = cleaned.lastIndexOf('}');
  if (openIndex === -1 || closeIndex <= openIndex) return null;
  cleaned = cleaned.slice(openIndex, closeIndex + 1);
  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    try {
      return JSON.parse(cleaned.replace(/,\s*([\]}])/g, '$1'));
    } catch (secondError) {
      return null;
    }
  }
}
function normalizeRubricNameForMatch(name) {
  return String(name || '').toLowerCase().replace(/\band\b/g, '&').replace(/[^a-z0-9]+/g, '');
}
function findAiRubricResult(parsedResults, rubric, rubricIndex) {
  if (!Array.isArray(parsedResults)) return null;
  var wantedName = normalizeRubricNameForMatch(rubric.name);
  for (var i = 0; i < parsedResults.length; i++) {
    var item = parsedResults[i];
    if (item && typeof item === 'object' && normalizeRubricNameForMatch(item.rubricName) === wantedName) return item;
  }
  var itemAtIndex = parsedResults[rubricIndex];
  if (itemAtIndex && typeof itemAtIndex === 'object' && !String(itemAtIndex.rubricName || '').trim()) {
    return itemAtIndex;
  }
  return null;
}
function computeWeightedTotalScore(rubricResults) {
  var weightedSum = 0;
  var weightSum = 0;
  rubricResults.forEach(function (result) {
    if (typeof result.score === 'number') {
      weightedSum += clampScore(result.score) * result.weight;
      weightSum += result.weight;
    }
  });
  if (!weightSum) return 0;
  return Math.round(weightedSum / weightSum * 10) / 10;
}
function createEvaluationRecord(parsed, rawResponse, essayWordCount) {
  var requestedByName = (currentUser && currentUser.name) ? currentUser.name : 'Evaluator';
  var record = {
    id: makeId('evaluation'),
    evaluatedAt: new Date().toISOString(),
    essayWordCount: essayWordCount,
    subjectSnapshot: getEssaySubject(),
    instructionsSnapshot: getEssayInstructions(),
    requestedBy: requestedByName,
    totalScore: 0,
    overallSummary: '',
    overallStrengths: [],
    overallWeaknesses: [],
    nextSteps: [],
    rubricResults: [],
    rawResponse: null
  };
  if (!parsed) {
    record.rawResponse = rawResponse;
    return record;
  }
  record.overallSummary = String(parsed.overallSummary || '').slice(0, 4000);
  record.overallStrengths = toStringArray(parsed.overallStrengths);
  record.overallWeaknesses = toStringArray(parsed.overallWeaknesses);
  record.nextSteps = toStringArray(parsed.nextSteps);
  record.rubricResults = essayState.rubrics.map(function (rubric, index) {
    var aiResult = findAiRubricResult(parsed.rubricResults, rubric, index);
    var score = (aiResult && typeof aiResult.score === 'number') ? clampScore(aiResult.score) : null;
    return {
      rubricId: rubric.id,
      rubricName: rubric.name,
      weight: rubric.weight,
      score: score,
      comment: aiResult ? String(aiResult.comment || '').slice(0, 4000) : 'The evaluator did not return a result for this rubric.',
      strengths: aiResult ? toStringArray(aiResult.strengths) : [],
      suggestions: aiResult ? toStringArray(aiResult.suggestions) : []
    };
  });
  record.totalScore = computeWeightedTotalScore(record.rubricResults);
  return record;
}
function evaluateEssayWithAi() {
  if (evaluationInProgress) return;
  if (!canEditEssay()) { tool.notify('You do not have permission to request an evaluation.', 'warning'); return; }
  if (!isEvaluationServiceAllowed()) {
    tool.notify('The evaluation service is not enabled for this field. Set the allowAi field setting to yes.', 'error');
    return;
  }
  if (!essayState.rubrics.length) { tool.notify('No rubrics are defined. Add evaluation criteria first.', 'error'); return; }
  var plainEssayText = htmlToPlainText(essayState.essay.html);
  var wordCount = countWords(plainEssayText);
  if (!wordCount) { tool.notify('Write your essay first, then request an evaluation.', 'warning'); return; }
  var minimum = getMinimumWordCount();
  if (minimum > 0 && wordCount < minimum) {
    tool.notify('Your essay is ' + wordCount + ' words. The minimum for this assignment is ' + minimum + ' words.', 'warning');
    return;
  }
  evaluationInProgress = true;
  updateEvaluateButtonState();
  var prompt = buildEvaluationPrompt(plainEssayText);
  tool.requestAI(prompt, '', function (error, responseText) {
    evaluationInProgress = false;
    updateEvaluateButtonState();
    if (!responseText) {
      tool.notify('Evaluation failed: ' + (error || 'no response'), 'error');
      return;
    }
    if (error) tool.notify('Notice: ' + error, 'warning');
    var parsed = parseAiJsonResponse(responseText);
    var evaluation = createEvaluationRecord(parsed, responseText, wordCount);
    essayState.evaluations.push(evaluation);
    activeEvaluationId = evaluation.id;
    persistNow();
    requestParentSave(false);
    renderWholeTool();
    openPanel('evaluation');
    if (!parsed) {
      tool.notify('Evaluation stored, but the response was not structured data. The raw text is shown in the panel.', 'warning');
    } else {
      tool.notify('Evaluation complete - ' + formatScore(evaluation.totalScore) + '/100.', 'success');
    }
  });
}

/* ── Lock UI per role ── */
function lockUserInterface() {
  var root = elementById('ewe-app');
  if (!root) return;
  var canWrite = canEditEssay();
  root.classList.toggle('ewe-can-write', canWrite);
  root.classList.toggle('ewe-role-admin', canManageRubrics());
  var editor = elementById('ewe-editor');
  if (editor) editor.setAttribute('contenteditable', canWrite ? 'true' : 'false');
  updateEvaluateButtonState();
  updateFormatControlsState(canWrite);
}

/* ── Events ── */
function handleEssayInput() {
  var editor = elementById('ewe-editor');
  if (!editor) return;
  essayState.essay.html = editor.innerHTML;
  essayState.essay.lastEditedAt = new Date().toISOString();
  updateEssayCounts();
  schedulePersist();
}
function handleEditorPaste(event) {
  event.preventDefault();
  var clipboardData = event.clipboardData || window.clipboardData;
  var pastedText = clipboardData && typeof clipboardData.getData === 'function' ? clipboardData.getData('text/plain') : '';
  if (pastedText) {
    try {
      document.execCommand('insertText', false, pastedText);
    } catch (error) {
      var editor = elementById('ewe-editor');
      var selection = window.getSelection();
      if (editor && selection && selection.rangeCount) {
        var range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(pastedText));
        range.collapse(false);
        handleEssayInput();
      }
    }
  }
}
function handleGlobalClick(event) {
  var actionNode = closestNodeWithAction(event.target);
  if (actionNode) {
    var action = actionNode.getAttribute('data-act');
    if (action === 'evaluate') evaluateEssayWithAi();
    else if (action === 'toggle-rubrics') togglePanel('rubrics');
    else if (action === 'toggle-evaluation') togglePanel('evaluation');
    else if (action === 'close-panel') closePanel();
    else if (action === 'format-bold') applyFormatCommand('bold');
    else if (action === 'format-italic') applyFormatCommand('italic');
    else if (action === 'switch-eval-view') {
      activeEvaluationView = actionNode.getAttribute('data-view');
      versionMenuOpen = false;
      renderEvaluationPanel();
    }
    else if (action === 'add-rubric') { if (canManageRubrics()) openRubricEditor(null); }
    else if (action === 'edit-rubric') { if (canManageRubrics()) openRubricEditor(actionNode.getAttribute('data-id')); }
    else if (action === 'delete-rubric') { if (canManageRubrics()) removeRubric(actionNode.getAttribute('data-id')); }
    else if (action === 'reset-rubrics') { if (canManageRubrics()) handleResetRubrics(); }
    else if (action === 'apply-definition-rubrics') applySubjectDefinitionRubrics();
    else if (action === 'close-modal') closeModal();
    else if (action === 'modal-cancel') closeModal();
    else if (action === 'modal-save') saveRubricFromEditor();
    else if (action === 'toggle-version-menu') {
      versionMenuOpen = !versionMenuOpen;
      renderEvaluationPanel();
    }
    else if (action === 'select-version') {
      activeEvaluationId = actionNode.getAttribute('data-eval-id');
      versionMenuOpen = false;
      renderEvaluationPanel();
    }
    else if (action === 'copy-suggestions') copySuggestionsToClipboard();
    return;
  }
  if (event.target === elementById('ewe-modal-overlay')) closeModal();
  if (versionMenuOpen && !isNodeInsideContainer(event.target, elementById('ewe-version-select'))) {
    versionMenuOpen = false;
    renderEvaluationPanel();
  }
}
function handleGlobalKeydown(event) {
  if (event.key === 'Escape') {
    if (versionMenuOpen) {
      versionMenuOpen = false;
      renderEvaluationPanel();
    } else if (activePanelName) closePanel();
    else closeModal();
  }
  if (event.key === 'Enter' && elementById('ewe-modal-overlay').classList.contains('ewe-open')) {
    var focused = document.activeElement;
    if (focused && focused.tagName && focused.tagName.toLowerCase() === 'input' && focused.id === 'ewe-rubric-weight') {
      saveRubricFromEditor();
    }
  }
}
function handleModalInput(event) {
  if (event.target && event.target.id === 'ewe-rubric-weight') updateRubricWeightHint();
}
function bindGlobalEvents() {
  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('keydown', handleGlobalKeydown);
  document.addEventListener('selectionchange', function () { syncFormatBar(); });
  var editor = elementById('ewe-editor');
  if (editor) {
    editor.addEventListener('input', handleEssayInput);
    editor.addEventListener('paste', handleEditorPaste);
    editor.addEventListener('drop', function (event) { event.preventDefault(); });
    editor.addEventListener('keyup', function () { updateEssayCounts(); syncFormatBar(); });
    editor.addEventListener('mouseup', function () { syncFormatBar(); });
  }
  ['ewe-format-bold', 'ewe-format-italic'].forEach(function (id) {
    var button = elementById(id);
    if (button) button.addEventListener('mousedown', function (event) { event.preventDefault(); });
  });
  var paragraphSelect = elementById('ewe-format-paragraph');
  if (paragraphSelect) paragraphSelect.addEventListener('change', function () { applyParagraphFormat(paragraphSelect.value); });
  var sizeSelect = elementById('ewe-format-size');
  if (sizeSelect) sizeSelect.addEventListener('change', function () { applyFontSize(sizeSelect.value); });
  var modalOverlay = elementById('ewe-modal-overlay');
  if (modalOverlay) modalOverlay.addEventListener('input', handleModalInput);
}

/* ── Configuration reporting ── */
function declareConfiguration() {
  try {
    tool.declareParams([
      { name: 'essaySubject', label: 'Essay Subject', type: 'text', default: '', severity: 'goodToHave', hint: 'The subject or topic the student must write about. Shown at the top of the editor. Required unless subjectDefinitionId or subjectDefinitionJson is set.' },
      { name: 'essayInstructions', label: 'Essay Instructions', type: 'text', default: '', severity: 'optional', hint: 'Extra instructions for the student: required length, sections to include, style, citation rules, etc.' },
      { name: 'essayLanguage', label: 'Essay Language', type: 'text', default: 'English', severity: 'optional', hint: 'Language the essay is written in. The evaluator works in this language.' },
      { name: 'minimumWordCount', label: 'Minimum Word Count', type: 'number', default: '', severity: 'goodToHave', hint: 'Optional minimum length. The tool warns the student when the essay is shorter than this many words.' },
      { name: 'allowAi', label: 'Allow Evaluation Service', type: 'toggle', default: 'yes', severity: 'mandatory', hint: "The field setting allowAi must be 'yes' for the evaluation service to work." },
      { name: 'subjectDefinitionId', label: 'Subject Definition ID', type: 'text', default: '', severity: 'goodToHave', hint: 'Optional. ID of a saved definition created by Essay Subject Builder. The definition supplies the subject, instructions, language, minimum word count and rubrics.' },
      { name: 'subjectDefinitionJson', label: 'Subject Definition JSON', type: 'text', default: '', severity: 'optional', hint: 'Optional fallback. Paste the definition JSON copied from Essay Subject Builder. Ignored when subjectDefinitionId is set.' },
      { name: 'subjectDefinitionsType', label: 'Subject Definitions Type', type: 'text', default: 'essay-subject-definitions-uniconbaseapps', severity: 'optional', hint: 'CMS object type where subject definitions are stored. Keep the default unless you use a custom type.' }
    ]);
    tool.declareOutput({
      type: 'object',
      description: 'One student essay, its evaluation rubrics and the evaluation history.',
      properties: {
        essay: { type: 'object', description: 'The essay content (formatted HTML from the rich text editor) and its last edit time.' },
        rubrics: { type: 'array', description: 'Evaluation criteria. Each item: id, name, weight (percent), description, builtIn.' },
        evaluations: { type: 'array', description: 'Evaluation records: totalScore (0-100), overallSummary, overallStrengths, overallWeaknesses, nextSteps, rubricResults (per-rubric score, comment, strengths, suggestions).' }
      }
    });
  } catch (error) {}
}
function reportMissingConfiguration() {
  var missing = [];
  if (!hasSubjectDefinitionSource() && !getEssaySubject()) {
    missing.push({
      name: 'essaySubject', label: 'Essay Subject', type: 'text', default: '',
      hint: 'The subject or topic the student must write about. Shown at the top of the editor.',
      reason: 'The student has nothing to write about until a subject is configured.',
      severity: 'mandatory'
    });
  }
  if (!hasSubjectDefinitionSource()) {
    missing.push({
      name: 'subjectDefinitionId', label: 'Subject Definition ID', type: 'text', default: '',
      hint: 'Optional. ID of a saved definition created by Essay Subject Builder. Supplies subject, instructions, language, minimum word count and rubrics.',
      reason: 'Either essaySubject or a subject definition must be configured.',
      severity: 'goodToHave'
    });
  }
  if (!isEvaluationServiceAllowed()) {
    missing.push({
      name: 'allowAi', label: 'Allow Evaluation Service', type: 'toggle', default: 'yes',
      hint: "The field setting allowAi must be 'yes' for the evaluation service to work.",
      reason: 'Evaluation is unavailable while the service channel is disabled.',
      severity: 'mandatory'
    });
  }
  if (missing.length) {
    try {
      tool.reportMissingParams(missing, 'Essay Writing Educator needs configuration before it can evaluate essays.');
    } catch (error) {}
  }
}

/* ── Entry point ── */
tool.onReady(function (initialValue) {
  essayState = normalizeEssayState(initialValue);
  declareConfiguration();
  reportMissingConfiguration();
  try { tool.reportValid(true, ''); } catch (error) {}
  bindGlobalEvents();
  refreshCurrentUser();
  renderWholeTool();
  loadSubjectDefinition();

  tool.onValueChange(function (newValue) {
    if (saveInFlight) return;
    var incomingJson = JSON.stringify(newValue || null);
    if (incomingJson === lastStagedJson) return;
    essayState = normalizeEssayState(newValue);
    renderWholeTool();
  });

  tool.onReadonlyChange(function () {
    lockUserInterface();
  });

  tool.onUserChange(function (user) {
    currentUser = user || getUserSafely();
    lockUserInterface();
  });
});
