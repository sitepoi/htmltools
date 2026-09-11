/* Essay Subject Builder - UniconHub CMS html-tool.
   Builds ONE essay subject definition: assignment fields plus evaluation
   rubrics (system base rubric + subject rubrics on top, total weight 100%).
   The definition is saved as a CMS object that Essay Writing Educator loads. */

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

var SUBJECT_DEFINITIONS_OBJECT_TYPE = 'essay-subject-definitions-uniconbaseapps';
var BASE_RUBRIC_VERSION = 'ewe-base-v1';
var MAX_TOTAL_RUBRIC_COUNT = 8;
var MAX_SUBJECT_RUBRIC_COUNT = 3;
var IDENTITY_POLL_DELAYS = [400, 1200, 2600, 5000];

var builderState = null;
var currentUser = null;
var identityUnavailable = false;
var identityPollStep = 0;
var saveTimer = null;
var saveInFlight = false;
var lastStagedJson = null;
var lastSavedDefinitionSignature = null;
var saveWarningShown = false;
var rubricBeingEditedId = null;

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
function makeId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function closestNodeWithAction(startNode) {
  var node = startNode;
  while (node && node !== document) {
    if (node.getAttribute && node.getAttribute('data-act')) return node;
    node = node.parentNode;
  }
  return null;
}
function formatShortDateTime(isoString) {
  var date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Unknown';
  var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function padTwo(number) { return number < 10 ? '0' + number : String(number); }
  return monthNames[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear() +
    ' ' + padTwo(date.getHours()) + ':' + padTwo(date.getMinutes());
}
function safeResize() { try { tool.resize(); } catch (error) {} }

/* ── Params ── */
function getDefinitionsObjectType() {
  return String(tool.param('definitionsObjectType', SUBJECT_DEFINITIONS_OBJECT_TYPE) || '').trim() || SUBJECT_DEFINITIONS_OBJECT_TYPE;
}
function isObjectCrudAllowed() { return String(tool.param('allowObjectCRUD', '')).toLowerCase() === 'yes'; }

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
function hasObjectEditorAccess() {
  var user = currentUser || getUserSafely();
  return !!(user && user.effectiveAccess && (user.effectiveAccess.isEditor || user.effectiveAccess.isManager));
}
function canEditDefinition() {
  if (identityUnavailable) return !isReadOnlyNow();
  if (isReadOnlyNow()) return false;
  return hasAnyRole(['admin', 'owner', 'developer', 'user-manager', 'editor']) || hasObjectEditorAccess();
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
function createDefaultBuilderState() {
  return {
    version: 1,
    subject: '',
    instructions: '',
    language: 'English',
    minimumWordCount: 0,
    rubrics: copyBaseRubrics(),
    definitionId: '',
    savedAt: null,
    savedDefinitionVersion: 0
  };
}
function clampRubricWeight(value) {
  var number = Math.floor(toNumber(value, 10));
  if (number < 1) return 10;
  if (number > 100) return 100;
  return number;
}
function findRubricInList(rubricList, rubricId) {
  for (var i = 0; i < rubricList.length; i++) {
    if (rubricList[i].id === rubricId) return rubricList[i];
  }
  return null;
}
function normalizeBuilderState(rawValue) {
  if (!rawValue || typeof rawValue !== 'object') return createDefaultBuilderState();
  var output = createDefaultBuilderState();
  if (typeof rawValue.version === 'number') output.version = rawValue.version;
  if (typeof rawValue.subject === 'string') output.subject = rawValue.subject.slice(0, 200);
  if (typeof rawValue.instructions === 'string') output.instructions = rawValue.instructions.slice(0, 2000);
  if (typeof rawValue.language === 'string') output.language = rawValue.language.slice(0, 40);
  output.minimumWordCount = Math.max(0, Math.min(100000, Math.floor(toNumber(rawValue.minimumWordCount, 0))));
  if (Array.isArray(rawValue.rubrics) && rawValue.rubrics.length) {
    output.rubrics = [];
    rawValue.rubrics.forEach(function (rubric) {
      if (!rubric || typeof rubric !== 'object' || !rubric.name) return;
      if (output.rubrics.length >= MAX_TOTAL_RUBRIC_COUNT) return;
      if (rubric.builtIn) {
        var baseRubric = null;
        for (var i = 0; i < BASE_RUBRICS.length; i++) {
          if (BASE_RUBRICS[i].id === rubric.id) { baseRubric = BASE_RUBRICS[i]; break; }
        }
        if (!baseRubric) return;
        output.rubrics.push({ id: baseRubric.id, name: baseRubric.name, weight: clampRubricWeight(rubric.weight), description: baseRubric.description, builtIn: true });
      } else {
        output.rubrics.push({
          id: String(rubric.id || makeId('rubric')),
          name: String(rubric.name).slice(0, 80),
          weight: clampRubricWeight(rubric.weight),
          description: String(rubric.description || '').slice(0, 500),
          builtIn: false
        });
      }
    });
    BASE_RUBRICS.forEach(function (baseRubric) {
      if (!findRubricInList(output.rubrics, baseRubric.id) && output.rubrics.length < MAX_TOTAL_RUBRIC_COUNT) {
        output.rubrics.push({ id: baseRubric.id, name: baseRubric.name, weight: baseRubric.weight, description: baseRubric.description, builtIn: true });
      }
    });
  }
  output.definitionId = typeof rawValue.definitionId === 'string' ? rawValue.definitionId.slice(0, 120) : '';
  output.savedAt = typeof rawValue.savedAt === 'string' ? rawValue.savedAt : null;
  output.savedDefinitionVersion = Math.max(0, Math.floor(toNumber(rawValue.savedDefinitionVersion, 0)));
  return output;
}
function persistNow() {
  var snapshotJson = JSON.stringify(builderState);
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
  if (!canEditDefinition()) return;
  try {
    tool.requestSave(function (error, accepted) {
      if (error || !accepted) {
        if (!saveWarningShown) {
          saveWarningShown = true;
          tool.notify('Automatic save was not accepted by the CMS form. Use the CMS Save button to persist the draft.', 'warning');
        }
        return;
      }
      if (announceSuccess) tool.notify('Draft saved to the CMS record.', 'success');
    });
  } catch (error) {}
}

/* ── Rubric helpers ── */
function totalRubricWeight() {
  return builderState.rubrics.reduce(function (sum, rubric) { return sum + rubric.weight; }, 0);
}
function findRubricById(rubricId) {
  return findRubricInList(builderState.rubrics, rubricId);
}
function subjectRubricCount() {
  return builderState.rubrics.filter(function (rubric) { return !rubric.builtIn; }).length;
}

/* ── Definition data ── */
function definitionContentSignature() {
  return JSON.stringify({
    subject: builderState.subject.trim(),
    instructions: builderState.instructions.trim(),
    language: builderState.language.trim() || 'English',
    minimumWordCount: Math.max(0, Math.floor(toNumber(builderState.minimumWordCount, 0))),
    rubrics: builderState.rubrics.map(function (rubric) {
      return { id: rubric.id, name: rubric.name, weight: rubric.weight, description: rubric.description, builtIn: rubric.builtIn };
    })
  });
}
function buildDefinitionData() {
  var builtByName = (currentUser && currentUser.name) ? currentUser.name : 'CMS user';
  var builtById = (currentUser && currentUser.id) ? currentUser.id : '';
  return {
    subject: builderState.subject.trim(),
    instructions: builderState.instructions.trim(),
    language: builderState.language.trim() || 'English',
    minimumWordCount: Math.max(0, Math.floor(toNumber(builderState.minimumWordCount, 0))),
    rubrics: builderState.rubrics.map(function (rubric) {
      return { id: rubric.id, name: rubric.name, weight: rubric.weight, description: rubric.description, builtIn: rubric.builtIn };
    }),
    baseRubricVersion: BASE_RUBRIC_VERSION,
    updatedAt: new Date().toISOString(),
    builtBy: { userId: builtById, userName: builtByName }
  };
}
function collectDefinitionProblems() {
  var problems = [];
  if (!builderState.subject.trim()) problems.push('Give the essay a subject before saving.');
  if (!builderState.rubrics.length) problems.push('At least one rubric is required.');
  var total = totalRubricWeight();
  if (builderState.rubrics.length && total !== 100) {
    if (total < 100) problems.push('Rubric weights total ' + total + '%. Assign the remaining ' + (100 - total) + '%.');
    else problems.push('Rubric weights total ' + total + '%. Reduce the weights by ' + (total - 100) + '%.');
  }
  return problems;
}

/* ── Rendering ── */
function renderWholeTool() {
  renderAssignmentInputs();
  renderRubricSection();
  renderDefinitionStatus();
  lockUserInterface();
  safeResize();
}
function setInputValueUnlessFocused(inputId, value) {
  var input = elementById(inputId);
  if (!input) return;
  if (document.activeElement !== input) input.value = value;
}
function renderAssignmentInputs() {
  setInputValueUnlessFocused('esb-subject-input', builderState.subject);
  setInputValueUnlessFocused('esb-instructions-input', builderState.instructions);
  setInputValueUnlessFocused('esb-language-input', builderState.language);
  setInputValueUnlessFocused('esb-minimum-words-input', builderState.minimumWordCount > 0 ? builderState.minimumWordCount : '');
}
function renderRubricSection() {
  var baseList = elementById('esb-base-rubric-list');
  baseList.innerHTML = builderState.rubrics
    .filter(function (rubric) { return rubric.builtIn; })
    .map(function (rubric) {
      return '<div class="esb-rubric-row">' +
        '<div class="esb-rubric-row-main">' +
          '<div class="esb-rubric-name">' + escapeHtml(rubric.name) + '</div>' +
          '<div class="esb-rubric-desc">' + escapeHtml(rubric.description) + '</div>' +
        '</div>' +
        '<div class="esb-rubric-weight-wrap">' +
          '<input class="esb-weight-input" type="number" min="1" max="100" step="1" data-rubric-id="' + escapeHtml(rubric.id) + '" value="' + rubric.weight + '">' +
          '<div class="esb-weight-suffix">% of score</div>' +
        '</div>' +
      '</div>';
    }).join('');

  var subjectList = elementById('esb-subject-rubric-list');
  var subjectRubrics = builderState.rubrics.filter(function (rubric) { return !rubric.builtIn; });
  subjectList.innerHTML = subjectRubrics.map(function (rubric) {
    return '<div class="esb-rubric-row">' +
      '<div class="esb-rubric-row-main">' +
        '<div class="esb-rubric-name">' + escapeHtml(rubric.name) + '</div>' +
        '<div class="esb-rubric-desc">' + escapeHtml(rubric.description) + '</div>' +
      '</div>' +
      '<div class="esb-rubric-weight-wrap">' +
        '<div class="esb-weight-input-static">' + rubric.weight + '%</div>' +
      '</div>' +
      '<div class="esb-rubric-buttons">' +
        '<button class="esb-icon-btn esb-write-only" data-act="edit-subject-rubric" data-id="' + escapeHtml(rubric.id) + '" title="Edit rubric">✎</button>' +
        '<button class="esb-icon-btn esb-icon-danger esb-write-only" data-act="delete-subject-rubric" data-id="' + escapeHtml(rubric.id) + '" title="Delete rubric">✕</button>' +
      '</div>' +
    '</div>';
  }).join('') || '<div class="esb-empty-small">No subject rubrics yet. Add the criteria that are specific to this subject.</div>';

  updateWeightSummary();
  lockUserInterface();
}
function updateWeightSummary() {
  var summary = elementById('esb-weight-summary');
  var total = totalRubricWeight();
  if (total === 100) {
    summary.innerHTML = '<span class="esb-weight-ok">Total weight: 100% ✓</span>';
  } else if (total < 100) {
    summary.innerHTML = '<span class="esb-weight-warn">Total weight: ' + total + '% - assign the remaining ' + (100 - total) + '%</span>';
  } else {
    summary.innerHTML = '<span class="esb-weight-warn">Total weight: ' + total + '% - reduce by ' + (total - 100) + '%</span>';
  }
}
function renderDefinitionStatus() {
  var container = elementById('esb-definition-status');
  var html = '';
  var problems = collectDefinitionProblems();

  if (!isObjectCrudAllowed()) {
    html += '<div class="esb-alert esb-alert-warn">Definition storage is not enabled for this field. ' +
      'Set the field setting <code>allowObjectCRUD</code> to <code>yes</code> (and add the definition type to <code>allowedObjectTypes</code>), ' +
      'or use <b>Copy Definition JSON</b> and paste it into the evaluator\'s <code>subjectDefinitionJson</code> parameter instead.</div>';
  } else if (builderState.definitionId) {
    html += '<div class="esb-status-row"><span class="esb-status-ok">● Saved</span>' +
      '<span>Definition id:</span> <code>' + escapeHtml(builderState.definitionId) + '</code>' +
      '<button class="esb-btn esb-btn-ghost esb-write-only" data-act="copy-definition-id" style="padding:3px 10px;font-size:12px;">📋 Copy</button></div>' +
      '<div class="esb-hint">Saved ' + formatShortDateTime(builderState.savedAt) + ' - definition version ' + builderState.savedDefinitionVersion + '.</div>';
    if (lastSavedDefinitionSignature !== null && lastSavedDefinitionSignature !== definitionContentSignature()) {
      html += '<div class="esb-alert esb-alert-warn">There are unsaved changes. Click <b>Save Definition</b> again to update the stored definition.</div>';
    }
  } else {
    html += '<div class="esb-alert esb-alert-info">Not saved yet. Review the assignment and rubrics, then click <b>Save Definition</b>. ' +
      'The definition is stored as a CMS object that the Essay Writing Educator can load.</div>';
  }

  if (problems.length) {
    html += '<div class="esb-alert esb-alert-warn">Before saving:<ul class="esb-problem-list">' +
      problems.map(function (problem) { return '<li>' + escapeHtml(problem) + '</li>'; }).join('') +
      '</ul></div>';
  }

  html += '<div class="esb-connect">' +
    '<div class="esb-connect-title">How to use this definition in the Essay Writing Educator</div>' +
    '<ol>' +
      '<li>Open the field settings of the Essay Writing Educator field.</li>' +
      '<li>Set the parameter <code>subjectDefinitionId</code> to ' +
        (builderState.definitionId ? '<code>' + escapeHtml(builderState.definitionId) + '</code>' : 'the definition id shown here after saving') +
        '. The evaluator then uses this definition\'s subject, instructions, language, minimum word count and rubrics.</li>' +
      '<li>When using <code>subjectDefinitionId</code>, the evaluator field also needs <code>allowObjectCRUD: yes</code> and this entry in <code>allowedObjectTypes</code>:' +
        '<pre>{\n  "mainObjectType": "' + escapeHtml(getDefinitionsObjectType()) + '",\n  "role": "editor",\n  "scope": "shared"\n}</pre></li>' +
      '<li>Alternative without object access: paste the <b>Copy Definition JSON</b> text into the evaluator parameter <code>subjectDefinitionJson</code>.</li>' +
    '</ol>' +
  '</div>';

  container.innerHTML = html;
}

/* ── Rubric editor modal ── */
function openModal(title, bodyHtml) {
  elementById('esb-modal-title').textContent = title;
  elementById('esb-modal-body').innerHTML = bodyHtml;
  elementById('esb-modal-overlay').classList.add('esb-open');
}
function closeModal() {
  elementById('esb-modal-overlay').classList.remove('esb-open');
  rubricBeingEditedId = null;
}
function openSubjectRubricEditor(rubricId) {
  var rubric = rubricId ? findRubricById(rubricId) : null;
  if (rubric && rubric.builtIn) return;
  rubricBeingEditedId = rubricId || null;
  var name = rubric ? rubric.name : '';
  var description = rubric ? rubric.description : '';
  var weight = rubric ? rubric.weight : '';
  openModal(
    rubric ? 'Edit Subject Rubric' : 'Add Subject Rubric',
    '<div class="esb-form-row"><label for="esb-rubric-name">Rubric name</label>' +
    '<input class="esb-input" id="esb-rubric-name" type="text" maxlength="80" value="' + escapeHtml(name) + '" placeholder="e.g. Use of Evidence"></div>' +
    '<div class="esb-form-row"><label for="esb-rubric-desc">Description - what should the evaluator look for in this area?</label>' +
    '<textarea class="esb-input esb-textarea" id="esb-rubric-desc" rows="4" maxlength="500" placeholder="e.g. How well the essay integrates quotes, examples and data from sources.">' + escapeHtml(description) + '</textarea></div>' +
    '<div class="esb-form-row"><label for="esb-rubric-weight">Weight (% of the final score)</label>' +
    '<input class="esb-input" id="esb-rubric-weight" type="number" min="1" max="100" step="1" value="' + weight + '"></div>' +
    '<div class="esb-form-hint" id="esb-rubric-hint"></div>' +
    '<div class="esb-modal-actions">' +
    '<button class="esb-btn esb-btn-ghost" data-act="modal-cancel">Cancel</button>' +
    '<button class="esb-btn esb-btn-primary" data-act="modal-save">Save Rubric</button>' +
    '</div>'
  );
  updateRubricWeightHint();
}
function updateRubricWeightHint() {
  var weightInput = elementById('esb-rubric-weight');
  var hint = elementById('esb-rubric-hint');
  if (!weightInput || !hint) return;
  var newWeight = Math.floor(toNumber(weightInput.value, 0));
  var existing = rubricBeingEditedId ? findRubricById(rubricBeingEditedId) : null;
  var available = 100 - totalRubricWeight() + (existing ? existing.weight : 0);
  hint.classList.remove('esb-form-hint-error');
  if (!newWeight || newWeight < 1) { hint.textContent = 'Enter a weight between 1 and 100.'; return; }
  var remainingAfterSave = available - newWeight;
  if (remainingAfterSave < 0) {
    hint.textContent = 'Weight is too high. You have ' + available + '% available - lower a base rubric weight first.';
    hint.classList.add('esb-form-hint-error');
  } else {
    hint.textContent = 'Remaining weight after save: ' + remainingAfterSave + '%.';
  }
}
function saveSubjectRubricFromEditor() {
  var name = inputValueById('esb-rubric-name').trim();
  var description = inputValueById('esb-rubric-desc').trim();
  var weight = Math.floor(toNumber(inputValueById('esb-rubric-weight'), 0));
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
    tool.notify('Subject rubric "' + name + '" updated.', 'success');
  } else {
    if (subjectRubricCount() >= MAX_SUBJECT_RUBRIC_COUNT) {
      tool.notify('Maximum of ' + MAX_SUBJECT_RUBRIC_COUNT + ' subject rubrics reached. Delete one first.', 'warning');
      return;
    }
    if (builderState.rubrics.length >= MAX_TOTAL_RUBRIC_COUNT) {
      tool.notify('Maximum of ' + MAX_TOTAL_RUBRIC_COUNT + ' rubrics total reached.', 'warning');
      return;
    }
    builderState.rubrics.push({ id: makeId('rubric'), name: name, description: description, weight: weight, builtIn: false });
    tool.notify('Subject rubric "' + name + '" added.', 'success');
  }
  persistNow();
  closeModal();
  renderWholeTool();
}
function removeSubjectRubric(rubricId) {
  var rubric = findRubricById(rubricId);
  if (!rubric || rubric.builtIn) { tool.notify('Only subject rubrics can be removed. The system base rubric always stays.', 'warning'); return; }
  builderState.rubrics = builderState.rubrics.filter(function (item) { return item.id !== rubricId; });
  persistNow();
  renderWholeTool();
  tool.notify('Subject rubric "' + rubric.name + '" removed.', 'info');
}
function restoreBaseRubricWeights() {
  BASE_RUBRICS.forEach(function (baseRubric) {
    var rubric = findRubricById(baseRubric.id);
    if (rubric) rubric.weight = baseRubric.weight;
  });
  persistNow();
  renderWholeTool();
  tool.notify('Base rubric weights restored to 30/20/20/15/15.', 'success');
}

/* ── Saving the definition ── */
function saveDefinitionToCms() {
  if (!canEditDefinition()) { tool.notify('You do not have permission to save the definition.', 'warning'); return; }
  if (!isObjectCrudAllowed()) {
    tool.notify('Definition storage is not enabled. Set allowObjectCRUD to yes in the field settings.', 'error');
    renderDefinitionStatus();
    return;
  }
  var problems = collectDefinitionProblems();
  if (problems.length) {
    tool.notify(problems[0], 'warning');
    renderDefinitionStatus();
    return;
  }
  var definitionData = buildDefinitionData();
  var saveButton = elementById('esb-save-definition-button');
  if (saveButton) { saveButton.disabled = true; saveButton.textContent = '⏳ Saving...'; }
  var finishSave = function (error, result) {
    if (saveButton) { saveButton.disabled = false; saveButton.textContent = '💾 Save Definition'; }
    if (error || !result) {
      tool.notify('Definition save failed: ' + (error || 'no response from the CMS'), 'error');
      renderDefinitionStatus();
      return;
    }
    if (result.object && result.object.id) builderState.definitionId = result.object.id;
    builderState.savedAt = new Date().toISOString();
    builderState.savedDefinitionVersion += 1;
    lastSavedDefinitionSignature = definitionContentSignature();
    persistNow();
    requestParentSave(true);
    renderDefinitionStatus();
    tool.notify('Subject definition saved. Copy the definition id and configure it on the evaluator field.', 'success');
  };
  try {
    if (builderState.definitionId) {
      tool.requestObjects('update', {
        mainObjectType: getDefinitionsObjectType(),
        objectId: builderState.definitionId,
        productData: { data_categoriesBased: definitionData }
      }, finishSave);
    } else {
      tool.requestObjects('create', {
        mainObjectType: getDefinitionsObjectType(),
        name: definitionData.subject || 'Essay Subject Definition',
        productData: { data_categoriesBased: definitionData }
      }, finishSave);
    }
  } catch (error) {
    finishSave('object storage is unavailable in this CMS', null);
  }
}

/* ── Copy helpers ── */
function copyDefinitionJsonToClipboard() {
  copyTextToClipboard(JSON.stringify(buildDefinitionData(), null, 2));
}
function copyDefinitionIdToClipboard() {
  if (!builderState.definitionId) { tool.notify('Save the definition first.', 'warning'); return; }
  copyTextToClipboard(builderState.definitionId);
}
function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      function () { tool.notify('Copied to clipboard.', 'success'); },
      function () { showCopyFallbackModal(text); }
    );
  } else {
    showCopyFallbackModal(text);
  }
}
function showCopyFallbackModal(text) {
  openModal(
    'Copy',
    '<p class="esb-modal-hint">Select the text below and press Ctrl+C to copy it.</p>' +
    '<textarea class="esb-copy-area" id="esb-copy-area" readonly>' + escapeHtml(text) + '</textarea>'
  );
  var area = elementById('esb-copy-area');
  if (area) { area.focus(); area.select(); }
}

/* ── Lock UI per role ── */
function lockUserInterface() {
  var root = elementById('esb-app');
  if (!root) return;
  var canEdit = canEditDefinition();
  root.classList.toggle('esb-can-write', canEdit);
  ['esb-subject-input', 'esb-instructions-input', 'esb-language-input', 'esb-minimum-words-input'].forEach(function (id) {
    var input = elementById(id);
    if (input) input.disabled = !canEdit;
  });
  var weightInputs = root.querySelectorAll('.esb-weight-input');
  for (var i = 0; i < weightInputs.length; i++) weightInputs[i].disabled = !canEdit;
  var saveButton = elementById('esb-save-definition-button');
  if (saveButton) saveButton.disabled = !canEdit;
}

/* ── Events ── */
function handleAssignmentFieldInput(target) {
  var id = target.id;
  if (id === 'esb-subject-input') builderState.subject = target.value;
  else if (id === 'esb-instructions-input') builderState.instructions = target.value;
  else if (id === 'esb-language-input') builderState.language = target.value;
  else if (id === 'esb-minimum-words-input') {
    builderState.minimumWordCount = Math.max(0, Math.min(100000, Math.floor(toNumber(target.value, 0))));
  }
  schedulePersist();
  renderDefinitionStatus();
}
function handleWeightInput(target) {
  var rubric = findRubricById(target.getAttribute('data-rubric-id'));
  if (!rubric) return;
  var parsedWeight = Math.floor(toNumber(target.value, 0));
  if (parsedWeight > 0) rubric.weight = Math.min(100, parsedWeight);
  schedulePersist();
  updateWeightSummary();
  renderDefinitionStatus();
}
function handleGlobalInput(event) {
  var target = event.target;
  if (!target) return;
  if (target.classList && target.classList.contains('esb-weight-input')) {
    handleWeightInput(target);
    return;
  }
  if (!target.id) return;
  if (target.id === 'esb-subject-input' || target.id === 'esb-instructions-input' ||
      target.id === 'esb-language-input' || target.id === 'esb-minimum-words-input') {
    handleAssignmentFieldInput(target);
  }
}
function handleGlobalClick(event) {
  var actionNode = closestNodeWithAction(event.target);
  if (actionNode) {
    var action = actionNode.getAttribute('data-act');
    if (action === 'save-definition') saveDefinitionToCms();
    else if (action === 'add-subject-rubric') { if (canEditDefinition()) openSubjectRubricEditor(null); }
    else if (action === 'edit-subject-rubric') { if (canEditDefinition()) openSubjectRubricEditor(actionNode.getAttribute('data-id')); }
    else if (action === 'delete-subject-rubric') { if (canEditDefinition()) removeSubjectRubric(actionNode.getAttribute('data-id')); }
    else if (action === 'restore-base-weights') { if (canEditDefinition()) restoreBaseRubricWeights(); }
    else if (action === 'copy-definition-json') copyDefinitionJsonToClipboard();
    else if (action === 'copy-definition-id') copyDefinitionIdToClipboard();
    else if (action === 'close-modal') closeModal();
    else if (action === 'modal-cancel') closeModal();
    else if (action === 'modal-save') saveSubjectRubricFromEditor();
    return;
  }
  if (event.target === elementById('esb-modal-overlay')) closeModal();
}
function handleGlobalKeydown(event) {
  if (event.key === 'Escape') closeModal();
  if (event.key === 'Enter' && elementById('esb-modal-overlay').classList.contains('esb-open')) {
    var focused = document.activeElement;
    if (focused && focused.tagName && focused.tagName.toLowerCase() === 'input' && focused.id === 'esb-rubric-weight') {
      saveSubjectRubricFromEditor();
    }
  }
}
function handleModalInput(event) {
  if (event.target && event.target.id === 'esb-rubric-weight') updateRubricWeightHint();
}
function bindGlobalEvents() {
  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('input', handleGlobalInput);
  document.addEventListener('keydown', handleGlobalKeydown);
  var modalOverlay = elementById('esb-modal-overlay');
  if (modalOverlay) modalOverlay.addEventListener('input', handleModalInput);
}

/* ── Configuration reporting ── */
function declareConfiguration() {
  try {
    tool.declareParams([
      {
        name: 'allowObjectCRUD', label: 'Allow Definition Storage', type: 'toggle', default: 'yes', severity: 'mandatory',
        hint: "The field setting allowObjectCRUD must be 'yes' for definitions to be saved as CMS objects."
      },
      {
        name: 'definitionsObjectType', label: 'Definitions Object Type', type: 'text', default: SUBJECT_DEFINITIONS_OBJECT_TYPE, severity: 'optional',
        hint: 'CMS object type where essay subject definitions are stored. Keep the default unless you use a custom type.'
      }
    ]);
    tool.declareOutput({
      type: 'object',
      description: 'One essay subject definition: assignment fields, the full rubric set (system base plus subject rubrics) and the saved definition object id.',
      properties: {
        subject: { type: 'string', description: 'The essay subject shown to the student.' },
        instructions: { type: 'string', description: 'Extra instructions for the student.' },
        language: { type: 'string', description: 'Language the essay is written in.' },
        minimumWordCount: { type: 'number', description: 'Minimum essay length in words. 0 means no minimum.' },
        rubrics: { type: 'array', description: 'Full rubric list: the system base rubrics plus subject rubrics. Each item: id, name, weight (percent), description, builtIn.' },
        definitionId: { type: 'string', description: 'CMS object id of the saved definition.' },
        savedAt: { type: 'string', description: 'ISO timestamp of the last save.' },
        savedDefinitionVersion: { type: 'number', description: 'How many times the definition was saved.' }
      }
    });
  } catch (error) {}
}
function reportMissingConfiguration() {
  var missing = [];
  if (!isObjectCrudAllowed()) {
    missing.push({
      name: 'allowObjectCRUD', label: 'Allow Definition Storage', type: 'toggle', default: 'yes',
      hint: "The field setting allowObjectCRUD must be 'yes' for definitions to be saved as CMS objects.",
      reason: 'Definitions cannot be saved while object storage is disabled.',
      severity: 'mandatory'
    });
  }
  if (missing.length) {
    try {
      tool.reportMissingParams(missing, 'Essay Subject Builder needs object storage enabled before it can save definitions.');
    } catch (error) {}
  }
}

/* ── Entry point ── */
tool.onReady(function (initialValue) {
  builderState = normalizeBuilderState(initialValue);
  lastSavedDefinitionSignature = builderState.definitionId ? definitionContentSignature() : null;
  declareConfiguration();
  reportMissingConfiguration();
  try { tool.reportValid(true, ''); } catch (error) {}
  bindGlobalEvents();
  refreshCurrentUser();
  renderWholeTool();

  tool.onValueChange(function (newValue) {
    if (saveInFlight) return;
    var incomingJson = JSON.stringify(newValue || null);
    if (incomingJson === lastStagedJson) return;
    builderState = normalizeBuilderState(newValue);
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
