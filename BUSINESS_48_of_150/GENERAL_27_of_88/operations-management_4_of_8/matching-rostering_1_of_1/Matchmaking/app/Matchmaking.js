/* ══════════════════════════════════════════════════════════════
   MATCHMAKING — JavaScript
   Privacy-First Candidate Matching Engine
   Uses window.tool SDK (no DOMContentLoaded, no raw postMessage)
   ══════════════════════════════════════════════════════════════ */

// ── State ──
var STATE = {
  candidates: [],          // Array of candidate objects
  matches: {},             // { candidateId: [matchResults] }
  aiMatches: {},           // { candidateId: [aiEnhancedResults] }
  activeTab: 'dashboard',
  editingId: null,
  deleteId: null,
  uploadedFiles: [],       // Files pending for current form
  readOnly: false,
  user: null
};

// ── Helper: Generate unique anonymous code ──
function generateCode(gender, index) {
  var prefix = gender === 'male' ? 'M' : 'F';
  var num = String(index + 1).padStart(3, '0');
  return 'ADAY-' + prefix + num;
}

// ── Helper: Calculate age from date string ──
function calcAge(dateStr) {
  if (!dateStr) return null;
  var birth = new Date(dateStr);
  var today = new Date();
  var age = today.getFullYear() - birth.getFullYear();
  var m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) { age--; }
  return age;
}

// ── Helper: Escape HTML ──
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Helper: Debounce ──
function debounce(fn, ms) {
  var timer;
  return function() {
    var ctx = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(ctx, args); }, ms);
  };
}

// ══════════════════════════════════════════════════════════════
// SDK INITIALIZATION
// ══════════════════════════════════════════════════════════════
tool.onReady(function(val, fields) {
  // Load saved data
  if (val && Array.isArray(val.candidates)) {
    STATE.candidates = val.candidates;
  }
  if (val && val.matches) {
    STATE.matches = val.matches;
  }
  if (val && val.aiMatches) {
    STATE.aiMatches = val.aiMatches;
  }

  STATE.readOnly = tool.isReadOnly();
  STATE.user = tool.getUser();

  // Bind SDK listeners
  tool.onValueChange(function(v) {
    if (v && Array.isArray(v.candidates)) STATE.candidates = v.candidates;
    if (v && v.matches) STATE.matches = v.matches;
    if (v && v.aiMatches) STATE.aiMatches = v.aiMatches;
    refreshAll();
  });

  tool.onFieldsChange(function(f) {
    // React to sibling field changes if needed
  });

  tool.onReadonlyChange(function(ro) {
    STATE.readOnly = ro;
    lockUI(ro);
    refreshAll();
  });

  tool.onUserChange(function(u) {
    STATE.user = u;
  });

  // Declare output schema
  tool.declareOutput({
    type: 'object',
    properties: {
      candidates: { type: 'array', items: { type: 'object' } },
      matches: { type: 'object' },
      aiMatches: { type: 'object' }
    }
  });

  tool.declareParams([
    { name: 'allowAi', label: 'Enable AI Matching', type: 'boolean', default: 'yes', hint: 'Allow AI-powered deep matching via tool.requestAI' },
    { name: 'allowUpload', label: 'Enable File Upload', type: 'boolean', default: 'yes', hint: 'Allow photo/video uploads for candidates' },
    { name: 'maxMatches', label: 'Max Matches Per Candidate', type: 'number', default: '10', hint: 'Maximum number of matches to return per candidate' }
  ]);

  // Initial render
  initEventListeners();
  lockUI(STATE.readOnly);
  refreshAll();
  tool.resize();
});

// ── Save state to CMS ──
function saveState() {
  tool.setValue({
    candidates: STATE.candidates,
    matches: STATE.matches,
    aiMatches: STATE.aiMatches
  });
  tool.resize();
}

// ── Lock/unlock UI for read-only mode ──
function lockUI(ro) {
  var interactive = document.querySelectorAll('.mm-btn-primary, .mm-btn-danger, .mm-input, .mm-textarea, .mm-select, #upload-zone');
  for (var i = 0; i < interactive.length; i++) {
    if (ro) {
      interactive[i].setAttribute('disabled', 'disabled');
    } else {
      interactive[i].removeAttribute('disabled');
    }
  }
  var roBtn = document.getElementById('btn-toggle-ro');
  if (roBtn) roBtn.textContent = ro ? '🔓' : '🔒';
}

// ══════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ══════════════════════════════════════════════════════════════
function initEventListeners() {
  // Tab navigation
  var tabs = document.querySelectorAll('.mm-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function() {
      switchTab(this.getAttribute('data-tab'));
    });
  }

  // Toggle read-only
  var btnRo = document.getElementById('btn-toggle-ro');
  if (btnRo) {
    btnRo.addEventListener('click', function() {
      // In test harness, simulate toggle; in production, this is managed by CMS
      if (typeof tool._toggleReadOnly === 'function') {
        tool._toggleReadOnly();
      }
    });
  }

  // Dashboard quick actions
  var btnQuickAdd = document.getElementById('btn-quick-add');
  if (btnQuickAdd) btnQuickAdd.addEventListener('click', function() { switchTab('form'); });
  var btnQuickMatch = document.getElementById('btn-quick-match');
  if (btnQuickMatch) btnQuickMatch.addEventListener('click', function() { switchTab('matches'); });
  var btnQuickExport = document.getElementById('btn-quick-export');
  if (btnQuickExport) btnQuickExport.addEventListener('click', exportSummary);

  // Candidates view
  var btnAddCandidate = document.getElementById('btn-add-candidate');
  if (btnAddCandidate) btnAddCandidate.addEventListener('click', function() { resetForm(); switchTab('form'); });
  var candSearch = document.getElementById('cand-search');
  if (candSearch) candSearch.addEventListener('input', debounce(renderCandidatesList, 300));
  var candFilterGender = document.getElementById('cand-filter-gender');
  if (candFilterGender) candFilterGender.addEventListener('change', renderCandidatesList);

  // Form
  var btnFormCancel = document.getElementById('btn-form-cancel');
  if (btnFormCancel) btnFormCancel.addEventListener('click', function() { resetForm(); switchTab('candidates'); });
  var btnFormCancelBtm = document.getElementById('btn-form-cancel-btm');
  if (btnFormCancelBtm) btnFormCancelBtm.addEventListener('click', function() { resetForm(); switchTab('candidates'); });
  var form = document.getElementById('candidate-form');
  if (form) form.addEventListener('submit', function(e) { e.preventDefault(); saveCandidate(); });

  // Upload
  var uploadZone = document.getElementById('upload-zone');
  if (uploadZone) {
    uploadZone.addEventListener('click', function() {
      if (STATE.readOnly) return;
      handleUpload();
    });
  }

  // Match view
  var btnRunMatch = document.getElementById('btn-run-match');
  if (btnRunMatch) btnRunMatch.addEventListener('click', runMatchmaking);
  var btnAiMatch = document.getElementById('btn-ai-match');
  if (btnAiMatch) btnAiMatch.addEventListener('click', runAIMatchmaking);

  // Modals
  var modalDetailClose = document.getElementById('modal-detail-close');
  if (modalDetailClose) modalDetailClose.addEventListener('click', closeModalDetail);
  var modalDetailBackdrop = document.getElementById('modal-detail-backdrop');
  if (modalDetailBackdrop) modalDetailBackdrop.addEventListener('click', closeModalDetail);
  var modalDeleteClose = document.getElementById('modal-delete-close');
  if (modalDeleteClose) modalDeleteClose.addEventListener('click', closeModalDelete);
  var modalDeleteBackdrop = document.getElementById('modal-delete-backdrop');
  if (modalDeleteBackdrop) modalDeleteBackdrop.addEventListener('click', closeModalDelete);
  var btnDeleteCancel = document.getElementById('btn-delete-cancel');
  if (btnDeleteCancel) btnDeleteCancel.addEventListener('click', closeModalDelete);
  var btnDeleteConfirm = document.getElementById('btn-delete-confirm');
  if (btnDeleteConfirm) btnDeleteConfirm.addEventListener('click', confirmDelete);

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeModalDetail();
      closeModalDelete();
    }
  });
}

// ══════════════════════════════════════════════════════════════
// TAB NAVIGATION
// ══════════════════════════════════════════════════════════════
function switchTab(tabName) {
  STATE.activeTab = tabName;
  var tabs = document.querySelectorAll('.mm-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tabName);
  }
  var views = document.querySelectorAll('.mm-view');
  for (var j = 0; j < views.length; j++) {
    views[j].classList.toggle('active', views[j].id === 'view-' + tabName);
  }
  if (tabName === 'dashboard') renderDashboard();
  if (tabName === 'candidates') renderCandidatesList();
  if (tabName === 'matches') renderMatchesView();
  if (tabName === 'form' && !STATE.editingId) resetForm();
  tool.resize();
}

// ══════════════════════════════════════════════════════════════
// REFRESH ALL ACTIVE VIEWS
// ══════════════════════════════════════════════════════════════
function refreshAll() {
  renderDashboard();
  if (STATE.activeTab === 'candidates') renderCandidatesList();
  if (STATE.activeTab === 'matches') renderMatchesView();
  updateBadge();
}

function updateBadge() {
  var badge = document.getElementById('badge-candidate-count');
  if (badge) badge.textContent = STATE.candidates.length + ' Candidates';
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════
function renderDashboard() {
  var total = STATE.candidates.length;
  var males = STATE.candidates.filter(function(c) { return c.gender === 'male'; }).length;
  var females = STATE.candidates.filter(function(c) { return c.gender === 'female'; }).length;
  var totalMatches = 0;
  var matchKeys = Object.keys(STATE.matches);
  for (var i = 0; i < matchKeys.length; i++) {
    totalMatches += (STATE.matches[matchKeys[i]] || []).length;
  }

  var statTotal = document.getElementById('stat-total');
  if (statTotal) statTotal.textContent = total;
  var statMale = document.getElementById('stat-male');
  if (statMale) statMale.textContent = males;
  var statFemale = document.getElementById('stat-female');
  if (statFemale) statFemale.textContent = females;
  var statMatched = document.getElementById('stat-matched');
  if (statMatched) statMatched.textContent = totalMatches;

  // Recent candidates
  var tbody = document.getElementById('dash-recent-candidates');
  if (!tbody) return;
  var recent = STATE.candidates.slice().reverse().slice(0, 5);
  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td class="mm-table-empty" colspan="7">No candidates yet</td></tr>';
  } else {
    var rows = '';
    for (var r = 0; r < recent.length; r++) {
      var c = recent[r];
      rows += '<tr>' +
        '<td><span class="mm-code">' + esc(c.code) + '</span></td>' +
        '<td><span class="mm-tag ' + (c.gender === 'male' ? 'mm-tag-male' : 'mm-tag-female') + '">' + (c.gender === 'male' ? '♂ Male' : '♀ Female') + '</span></td>' +
        '<td>' + (c.age || '—') + '</td>' +
        '<td>' + esc(c.location || '—') + '</td>' +
        '<td>' + esc(truncate(c.education, 40) || '—') + '</td>' +
        '<td>' + esc(c.createdAt || '—') + '</td>' +
        '<td><button class="mm-btn mm-btn-sm mm-btn-outline" onclick="viewCandidateDetail(\'' + c.id + '\')">👁 View</button></td>' +
        '</tr>';
    }
    tbody.innerHTML = rows;
  }

  // Match overview
  var overview = document.getElementById('dash-match-overview');
  if (overview) {
    if (totalMatches === 0) {
      overview.innerHTML = '<div class="mm-empty">Run matchmaking to see results here</div>';
    } else {
      var overviewHtml = '<div class="mm-match-stats">';
      overviewHtml += '<div class="mm-match-stat"><div class="mm-match-stat-val">' + totalMatches + '</div><div class="mm-match-stat-lbl">Total Matches</div></div>';
      overviewHtml += '<div class="mm-match-stat"><div class="mm-match-stat-val">' + Object.keys(STATE.matches).length + '</div><div class="mm-match-stat-lbl">Candidates Matched</div></div>';
      overviewHtml += '</div>';
      overview.innerHTML = overviewHtml;
    }
  }
}

// ══════════════════════════════════════════════════════════════
// CANDIDATES LIST
// ══════════════════════════════════════════════════════════════
function renderCandidatesList() {
  var tbody = document.getElementById('candidates-table-body');
  if (!tbody) return;

  var searchTerm = '';
  var searchInput = document.getElementById('cand-search');
  if (searchInput) searchTerm = searchInput.value.toLowerCase().trim();

  var filterGender = '';
  var genderSelect = document.getElementById('cand-filter-gender');
  if (genderSelect) filterGender = genderSelect.value;

  var filtered = STATE.candidates.filter(function(c) {
    if (filterGender && c.gender !== filterGender) return false;
    if (searchTerm) {
      var haystack = (c.code + ' ' + c.location + ' ' + c.education + ' ' + c.nativeLang + ' ' + (c.otherLangs || '')).toLowerCase();
      if (haystack.indexOf(searchTerm) === -1) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td class="mm-table-empty" colspan="9">' + (STATE.candidates.length === 0 ? 'No candidates registered yet' : 'No candidates match the filter') + '</td></tr>';
    return;
  }

  var rows = '';
  for (var i = 0; i < filtered.length; i++) {
    var c = filtered[i];
    rows += '<tr>' +
      '<td><span class="mm-code">' + esc(c.code) + '</span></td>' +
      '<td><span class="mm-tag ' + (c.gender === 'male' ? 'mm-tag-male' : 'mm-tag-female') + '">' + (c.gender === 'male' ? '♂ M' : '♀ F') + '</span></td>' +
      '<td>' + (c.age || '—') + '</td>' +
      '<td>' + esc(c.location || '—') + '</td>' +
      '<td>' + esc(truncate(c.education, 30) || '—') + '</td>' +
      '<td>' + esc(truncate(c.otherLangs || c.nativeLang || '—', 25)) + '</td>' +
      '<td>' + (c.height ? c.height + ' cm' : '—') + '</td>' +
      '<td>' + esc(c.createdAt || '—') + '</td>' +
      '<td><div class="mm-table-actions">' +
        '<button class="mm-btn mm-btn-sm mm-btn-outline" onclick="viewCandidateDetail(\'' + c.id + '\')" title="View">👁</button>' +
        '<button class="mm-btn mm-btn-sm mm-btn-outline" onclick="editCandidate(\'' + c.id + '\')" title="Edit">✏️</button>' +
        '<button class="mm-btn mm-btn-sm mm-btn-danger" onclick="deleteCandidate(\'' + c.id + '\')" title="Delete">🗑</button>' +
      '</div></td>' +
      '</tr>';
  }
  tbody.innerHTML = rows;
}

// ══════════════════════════════════════════════════════════════
// FORM HANDLING
// ══════════════════════════════════════════════════════════════
function resetForm() {
  STATE.editingId = null;
  STATE.uploadedFiles = [];
  var form = document.getElementById('candidate-form');
  if (form) form.reset();
  var formId = document.getElementById('form-candidate-id');
  if (formId) formId.value = '';
  var formTitle = document.getElementById('form-title');
  if (formTitle) formTitle.textContent = 'Add New Candidate';
  var uploadList = document.getElementById('upload-list');
  if (uploadList) uploadList.innerHTML = '';
}

function editCandidate(id) {
  var c = findCandidate(id);
  if (!c) return;
  STATE.editingId = id;
  STATE.uploadedFiles = c.files || [];

  var formTitle = document.getElementById('form-title');
  if (formTitle) formTitle.textContent = 'Edit Candidate: ' + c.code;

  // Populate form fields
  setFieldVal('form-candidate-id', c.id);
  setFieldVal('f-gender', c.gender || '');
  setFieldVal('f-fullname', c.fullname || '');
  setFieldVal('f-location', c.location || '');
  setFieldVal('f-contact', c.contact || '');
  setFieldVal('f-consultant', c.consultant || '');
  setFieldVal('f-ref-name', c.refName || '');
  setFieldVal('f-ref-phone', c.refPhone || '');
  setFieldVal('f-ref-location', c.refLocation || '');
  setFieldVal('f-birth-date', c.birthDate || '');
  setFieldVal('f-birth-real', c.birthReal || '');
  setFieldVal('f-birth-place', c.birthPlace || '');
  setFieldVal('f-native-lang', c.nativeLang || '');
  setFieldVal('f-other-langs', c.otherLangs || '');
  setFieldVal('f-mother-info', c.motherInfo || '');
  setFieldVal('f-father-info', c.fatherInfo || '');
  setFieldVal('f-siblings-total', c.siblingsTotal || '');
  setFieldVal('f-siblings-brothers', c.siblingsBrothers || '');
  setFieldVal('f-siblings-sisters', c.siblingsSisters || '');
  setFieldVal('f-sibling-rank', c.siblingRank || '');
  setFieldVal('f-education', c.education || '');
  setFieldVal('f-hobbies', c.hobbies || '');
  setFieldVal('f-artistic', c.artistic || '');
  setFieldVal('f-media', c.media || '');
  setFieldVal('f-prayer', c.prayer || '');
  setFieldVal('f-reading', c.reading || '');
  setFieldVal('f-role-models', c.roleModels || '');
  setFieldVal('f-volunteering', c.volunteering || '');
  setFieldVal('f-personality', c.personality || '');
  setFieldVal('f-redlines', c.redlines || '');
  setFieldVal('f-gender-relations', c.genderRelations || '');
  setFieldVal('f-strengths-weaknesses', c.strengthsWeaknesses || '');
  setFieldVal('f-values', c.values || '');
  setFieldVal('f-decision-making', c.decisionMaking || '');
  setFieldVal('f-important-people', c.importantPeople || '');
  setFieldVal('f-marriage-expectations', c.marriageExpectations || '');
  setFieldVal('f-marriage-effort', c.marriageEffort || '');
  setFieldVal('f-spouse-redlines', c.spouseRedlines || '');
  setFieldVal('f-spouse-yellowlines', c.spouseYellowlines || '');
  setFieldVal('f-spouse-green', c.spouseGreen || '');
  setFieldVal('f-spouse-social-media', c.spouseSocialMedia || '');
  setFieldVal('f-age-min', c.ageMin || '');
  setFieldVal('f-age-max', c.ageMax || '');
  setFieldVal('f-spouse-past', c.spousePast || '');
  setFieldVal('f-family-role', c.familyRole || '');
  setFieldVal('f-relocation-view', c.relocationView || '');
  setFieldVal('f-residency-status', c.residencyStatus || '');
  setFieldVal('f-current-housing', c.currentHousing || '');
  setFieldVal('f-future-housing', c.futureHousing || '');
  setFieldVal('f-income-source', c.incomeSource || '');
  setFieldVal('f-career-plans', c.careerPlans || '');
  setFieldVal('f-budget-views', c.budgetViews || '');
  setFieldVal('f-financial-future', c.financialFuture || '');
  setFieldVal('f-past-relationships', c.pastRelationships || '');
  setFieldVal('f-current-interest', c.currentInterest || '');
  setFieldVal('f-additional-notes', c.additionalNotes || '');
  setFieldVal('f-height', c.height || '');
  setFieldVal('f-weight', c.weight || '');
  setFieldVal('f-eye-color', c.eyeColor || '');
  setFieldVal('f-hair', c.hair || '');

  renderUploadList();
  switchTab('form');
}

function setFieldVal(id, val) {
  var el = document.getElementById(id);
  if (el) el.value = val !== null && val !== undefined ? val : '';
}

function getFieldVal(id) {
  var el = document.getElementById(id);
  if (!el) return '';
  return el.value.trim();
}

function saveCandidate() {
  if (STATE.readOnly) {
    tool.notify('Cannot save in read-only mode', 'warning');
    return;
  }

  var gender = getFieldVal('f-gender');
  if (!gender) {
    tool.notify('Please select gender', 'error');
    tool.reportValid(false, 'Gender is required');
    return;
  }

  var fullname = getFieldVal('f-fullname');
  var birthDate = getFieldVal('f-birth-date');
  var location = getFieldVal('f-location');
  var nativeLang = getFieldVal('f-native-lang');

  if (!fullname || !birthDate || !location || !nativeLang) {
    tool.notify('Please fill in all required fields (Name, Birth Date, Location, Native Language)', 'error');
    tool.reportValid(false, 'Required fields missing');
    return;
  }

  var age = calcAge(birthDate);

  var candidateData = {
    id: STATE.editingId || generateUUID(),
    code: '', // Will be set below
    gender: gender,
    fullname: fullname,
    location: location,
    contact: getFieldVal('f-contact'),
    consultant: getFieldVal('f-consultant'),
    refName: getFieldVal('f-ref-name'),
    refPhone: getFieldVal('f-ref-phone'),
    refLocation: getFieldVal('f-ref-location'),
    birthDate: birthDate,
    birthReal: getFieldVal('f-birth-real'),
    birthPlace: getFieldVal('f-birth-place'),
    age: age,
    nativeLang: nativeLang,
    otherLangs: getFieldVal('f-other-langs'),
    motherInfo: getFieldVal('f-mother-info'),
    fatherInfo: getFieldVal('f-father-info'),
    siblingsTotal: getFieldVal('f-siblings-total'),
    siblingsBrothers: getFieldVal('f-siblings-brothers'),
    siblingsSisters: getFieldVal('f-siblings-sisters'),
    siblingRank: getFieldVal('f-sibling-rank'),
    education: getFieldVal('f-education'),
    hobbies: getFieldVal('f-hobbies'),
    artistic: getFieldVal('f-artistic'),
    media: getFieldVal('f-media'),
    prayer: getFieldVal('f-prayer'),
    reading: getFieldVal('f-reading'),
    roleModels: getFieldVal('f-role-models'),
    volunteering: getFieldVal('f-volunteering'),
    personality: getFieldVal('f-personality'),
    redlines: getFieldVal('f-redlines'),
    genderRelations: getFieldVal('f-gender-relations'),
    strengthsWeaknesses: getFieldVal('f-strengths-weaknesses'),
    values: getFieldVal('f-values'),
    decisionMaking: getFieldVal('f-decision-making'),
    importantPeople: getFieldVal('f-important-people'),
    marriageExpectations: getFieldVal('f-marriage-expectations'),
    marriageEffort: getFieldVal('f-marriage-effort'),
    spouseRedlines: getFieldVal('f-spouse-redlines'),
    spouseYellowlines: getFieldVal('f-spouse-yellowlines'),
    spouseGreen: getFieldVal('f-spouse-green'),
    spouseSocialMedia: getFieldVal('f-spouse-social-media'),
    ageMin: parseInt(getFieldVal('f-age-min')) || null,
    ageMax: parseInt(getFieldVal('f-age-max')) || null,
    spousePast: getFieldVal('f-spouse-past'),
    familyRole: getFieldVal('f-family-role'),
    relocationView: getFieldVal('f-relocation-view'),
    residencyStatus: getFieldVal('f-residency-status'),
    currentHousing: getFieldVal('f-current-housing'),
    futureHousing: getFieldVal('f-future-housing'),
    incomeSource: getFieldVal('f-income-source'),
    careerPlans: getFieldVal('f-career-plans'),
    budgetViews: getFieldVal('f-budget-views'),
    financialFuture: getFieldVal('f-financial-future'),
    pastRelationships: getFieldVal('f-past-relationships'),
    currentInterest: getFieldVal('f-current-interest'),
    additionalNotes: getFieldVal('f-additional-notes'),
    height: parseFloat(getFieldVal('f-height')) || null,
    weight: parseFloat(getFieldVal('f-weight')) || null,
    eyeColor: getFieldVal('f-eye-color'),
    hair: getFieldVal('f-hair'),
    files: STATE.uploadedFiles.slice(),
    updatedAt: new Date().toISOString().slice(0, 10)
  };

  if (STATE.editingId) {
    // Update existing
    var idx = findCandidateIndex(STATE.editingId);
    if (idx >= 0) {
      candidateData.code = STATE.candidates[idx].code;
      candidateData.createdAt = STATE.candidates[idx].createdAt;
      STATE.candidates[idx] = candidateData;
    }
  } else {
    // New candidate - generate code
    var sameGender = STATE.candidates.filter(function(c) { return c.gender === gender; });
    candidateData.code = generateCode(gender, sameGender.length);
    candidateData.createdAt = new Date().toISOString().slice(0, 10);
    STATE.candidates.push(candidateData);
  }

  saveState();
  resetForm();
  tool.notify('Candidate saved successfully: ' + candidateData.code, 'success');
  tool.reportValid(true);
  switchTab('candidates');
  refreshAll();
}

// ══════════════════════════════════════════════════════════════
// UPLOAD HANDLING
// ══════════════════════════════════════════════════════════════
function handleUpload() {
  if (STATE.readOnly) return;
  // Check if upload is allowed via tool params
  var allowUpload = tool.param('allowUpload', 'yes');
  if (allowUpload !== 'yes') {
    tool.notify('File upload is not enabled for this tool', 'warning');
    return;
  }

  tool.requestUpload('.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi', function(err, file) {
    if (err) {
      tool.notify('Upload failed: ' + err, 'error');
      return;
    }
    if (file) {
      STATE.uploadedFiles.push(file);
      renderUploadList();
      tool.notify('Uploaded: ' + file.name, 'success');
      tool.resize();
    }
  });
}

function renderUploadList() {
  var list = document.getElementById('upload-list');
  if (!list) return;
  if (STATE.uploadedFiles.length === 0) {
    list.innerHTML = '';
    return;
  }
  var html = '';
  for (var i = 0; i < STATE.uploadedFiles.length; i++) {
    var f = STATE.uploadedFiles[i];
    html += '<div class="mm-upload-item">' +
      '<span><span class="mm-upload-item-name">' + esc(f.name) + '</span><span class="mm-upload-item-size">(' + formatBytes(f.size) + ')</span></span>' +
      '<span class="mm-upload-item-remove" onclick="removeUpload(' + i + ')">✕</span>' +
      '</div>';
  }
  list.innerHTML = html;
}

function removeUpload(index) {
  STATE.uploadedFiles.splice(index, 1);
  renderUploadList();
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  var k = 1024;
  var sizes = ['B', 'KB', 'MB', 'GB'];
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ══════════════════════════════════════════════════════════════
// MATCHMAKING ENGINE
// ══════════════════════════════════════════════════════════════

// ── Structured Comparison Scoring ──
function computeStructuredScore(candidate, target) {
  var score = 0;
  var maxScore = 0;
  var details = {};

  // 1. Age compatibility (15 pts)
  maxScore += 15;
  var ageScore = 0;
  if (candidate.age && target.age) {
    var ageDiff = Math.abs(candidate.age - target.age);
    // Check if within target's preferred range
    var inTargetRange = true;
    if (target.ageMin && candidate.age < target.ageMin) inTargetRange = false;
    if (target.ageMax && candidate.age > target.ageMax) inTargetRange = false;
    // Check if within candidate's preferred range
    var inCandidateRange = true;
    if (candidate.ageMin && target.age < candidate.ageMin) inCandidateRange = false;
    if (candidate.ageMax && target.age > candidate.ageMax) inCandidateRange = false;

    if (inTargetRange && inCandidateRange) {
      ageScore = 15;
    } else if (inTargetRange || inCandidateRange) {
      ageScore = 8;
    } else if (ageDiff <= 5) {
      ageScore = 6;
    } else if (ageDiff <= 10) {
      ageScore = 3;
    }
  }
  score += ageScore;
  details.age = ageScore;

  // 2. Location compatibility (10 pts)
  maxScore += 10;
  var locScore = 0;
  if (candidate.location && target.location) {
    var loc1 = candidate.location.toLowerCase();
    var loc2 = target.location.toLowerCase();
    // Extract city and country
    var parts1 = loc1.split(',').map(function(s) { return s.trim(); });
    var parts2 = loc2.split(',').map(function(s) { return s.trim(); });
    var sameCity = parts1[0] === parts2[0];
    var sameCountry = parts1.length > 1 && parts2.length > 1 && parts1[parts1.length - 1] === parts2[parts2.length - 1];

    if (sameCity && sameCountry) {
      locScore = 10;
    } else if (sameCountry) {
      locScore = 7;
    } else {
      // Check relocation willingness
      var reloc1 = (candidate.relocationView || '').toLowerCase();
      var reloc2 = (target.relocationView || '').toLowerCase();
      var willing1 = reloc1.indexOf('değiş') >= 0 || reloc1.indexOf('taşın') >= 0 || reloc1.indexOf('açığım') >= 0 || reloc1.indexOf('olumlu') >= 0 || reloc1.indexOf('sorun') >= 0 || reloc1.indexOf('problem') < 0;
      var willing2 = reloc2.indexOf('değiş') >= 0 || reloc2.indexOf('taşın') >= 0 || reloc2.indexOf('açığım') >= 0 || reloc2.indexOf('olumlu') >= 0 || reloc2.indexOf('sorun') >= 0 || reloc2.indexOf('problem') < 0;
      if (willing1 && willing2) {
        locScore = 5;
      } else {
        locScore = 2;
      }
    }
  }
  score += locScore;
  details.location = locScore;

  // 3. Education compatibility (8 pts)
  maxScore += 8;
  var eduScore = 0;
  if (candidate.education && target.education) {
    var edu1 = candidate.education.toLowerCase();
    var edu2 = target.education.toLowerCase();
    var eduKeywords = ['üniversite', 'üniversitesi', 'university', 'master', 'yüksek lisans', 'doktora', 'phd', 'lisans', 'bachelor', 'college'];
    var level1 = 0, level2 = 0;
    for (var ek = 0; ek < eduKeywords.length; ek++) {
      if (edu1.indexOf(eduKeywords[ek]) >= 0) level1 = Math.max(level1, ek < 6 ? 2 : 1);
      if (edu2.indexOf(eduKeywords[ek]) >= 0) level2 = Math.max(level2, ek < 6 ? 2 : 1);
    }
    if (level1 > 0 && level2 > 0) {
      eduScore = Math.abs(level1 - level2) === 0 ? 8 : 5;
    } else if (level1 > 0 || level2 > 0) {
      eduScore = 3;
    }
  }
  score += eduScore;
  details.education = eduScore;

  // 4. Language compatibility (8 pts)
  maxScore += 8;
  var langScore = 0;
  if (candidate.nativeLang && target.nativeLang) {
    if (candidate.nativeLang.toLowerCase() === target.nativeLang.toLowerCase()) {
      langScore += 4;
    }
  }
  var otherLangs1 = (candidate.otherLangs || '').toLowerCase();
  var otherLangs2 = (target.otherLangs || '').toLowerCase();
  var commonLanguages = ['ingilizce', 'english', 'arapça', 'arabic', 'fransızca', 'french', 'almanca', 'german', 'ispanyolca', 'spanish'];
  for (var cl = 0; cl < commonLanguages.length; cl++) {
    if (otherLangs1.indexOf(commonLanguages[cl]) >= 0 && otherLangs2.indexOf(commonLanguages[cl]) >= 0) {
      langScore += 2;
      break;
    }
  }
  score += Math.min(langScore, 8);
  details.language = Math.min(langScore, 8);

  // 5. Religious practice compatibility (10 pts)
  maxScore += 10;
  var prayerScore = 0;
  if (candidate.prayer && target.prayer) {
    var p1 = candidate.prayer.toLowerCase();
    var p2 = target.prayer.toLowerCase();
    var regularKeywords = ['düzenli', '5 vakit', 'beş vakit', 'her vakit', 'tam', 'her gün', 'hergün', 'aksatm', 'devamlı'];
    var partialKeywords = ['çoğu', 'bazen', 'kılıyorum', 'kılarım', 'bazı', 'arada', 'vakit'];
    var notKeywords = ['kılmıyorum', 'kılamıyorum', 'başlamadım', 'nadiren', 'seyrek'];

    function getPrayerLevel(str) {
      for (var pk = 0; pk < regularKeywords.length; pk++) {
        if (str.indexOf(regularKeywords[pk]) >= 0) return 3;
      }
      for (var pk2 = 0; pk2 < partialKeywords.length; pk2++) {
        if (str.indexOf(partialKeywords[pk2]) >= 0) return 2;
      }
      for (var pk3 = 0; pk3 < notKeywords.length; pk3++) {
        if (str.indexOf(notKeywords[pk3]) >= 0) return 1;
      }
      return 1;
    }

    var pLevel1 = getPrayerLevel(p1);
    var pLevel2 = getPrayerLevel(p2);
    prayerScore = Math.abs(pLevel1 - pLevel2) === 0 ? 10 : (Math.abs(pLevel1 - pLevel2) === 1 ? 7 : 3);
  }
  score += prayerScore;
  details.prayer = prayerScore;

  // 6. Lifestyle & Hobbies compatibility (10 pts)
  maxScore += 10;
  var hobbyScore = 0;
  if (candidate.hobbies && target.hobbies) {
    var h1 = candidate.hobbies.toLowerCase();
    var h2 = target.hobbies.toLowerCase();
    var hobbyKeywords = ['spor', 'yürüyüş', 'doğa', 'kitap', 'okuma', 'müzik', 'seyahat', 'gezi', 'sinema', 'film', 'yüzme', 'fotoğraf', 'resim', 'yemek', 'bahçe', 'koşu', 'fitness', 'kamp', 'bisiklet', 'tenis', 'voleybol', 'futbol', 'basketbol', 'yoga', 'meditasyon'];
    var matchCount = 0;
    for (var hk = 0; hk < hobbyKeywords.length; hk++) {
      if (h1.indexOf(hobbyKeywords[hk]) >= 0 && h2.indexOf(hobbyKeywords[hk]) >= 0) {
        matchCount++;
      }
    }
    if (matchCount >= 4) hobbyScore = 10;
    else if (matchCount >= 2) hobbyScore = 7;
    else if (matchCount >= 1) hobbyScore = 4;
    else hobbyScore = 1;
  }
  score += hobbyScore;
  details.hobbies = hobbyScore;

  // 7. Values & Personality compatibility (12 pts via keyword analysis)
  maxScore += 12;
  var valuesScore = 0;
  var valueFields1 = [(candidate.values || '') + ' ' + (candidate.personality || '') + ' ' + (candidate.redlines || '')].join(' ').toLowerCase();
  var valueFields2 = [(target.values || '') + ' ' + (target.personality || '') + ' ' + (target.redlines || '')].join(' ').toLowerCase();
  var valueKeywords = ['dürüst', 'saygı', 'güven', 'sadakat', 'aile', 'merhamet', 'adalet', 'sorumluluk', 'hoşgörü', 'empati', 'yardımsever', 'çalışkan', 'mütevazi', 'sabır', 'şefkat', 'vefa', 'cömert'];
  var vMatch = 0;
  for (var vk = 0; vk < valueKeywords.length; vk++) {
    if (valueFields1.indexOf(valueKeywords[vk]) >= 0 && valueFields2.indexOf(valueKeywords[vk]) >= 0) {
      vMatch++;
    }
  }
  if (vMatch >= 5) valuesScore = 12;
  else if (vMatch >= 3) valuesScore = 8;
  else if (vMatch >= 1) valuesScore = 4;
  else valuesScore = 2;
  score += valuesScore;
  details.values = valuesScore;

  // 8. Marriage expectations compatibility (10 pts)
  maxScore += 10;
  var marriageScore = 0;
  if (candidate.marriageExpectations && target.marriageExpectations) {
    var me1 = candidate.marriageExpectations.toLowerCase();
    var me2 = target.marriageExpectations.toLowerCase();
    var marriageKeywords = ['saygı', 'sevgi', 'güven', 'sadakat', 'huzur', 'mutluluk', 'anlayış', 'destek', 'paylaş', 'yoldaş', 'arkadaş', 'aile', 'çocuk', 'yuva', 'huzurlu', 'bağlılık', 'iletişim', 'fedakarlık', 'sabır'];
    var mMatch = 0;
    for (var mk = 0; mk < marriageKeywords.length; mk++) {
      if (me1.indexOf(marriageKeywords[mk]) >= 0 && me2.indexOf(marriageKeywords[mk]) >= 0) {
        mMatch++;
      }
    }
    if (mMatch >= 5) marriageScore = 10;
    else if (mMatch >= 3) marriageScore = 7;
    else if (mMatch >= 1) marriageScore = 4;
    else marriageScore = 2;
  }
  score += marriageScore;
  details.marriage = marriageScore;

  // 9. Financial outlook compatibility (7 pts)
  maxScore += 7;
  var finScore = 0;
  if (candidate.financialFuture && target.financialFuture) {
    var fin1 = candidate.financialFuture.toLowerCase();
    var fin2 = target.financialFuture.toLowerCase();
    if ((fin1.indexOf('ev') >= 0 && fin2.indexOf('ev') >= 0) ||
        (fin1.indexOf('minimal') >= 0 && fin2.indexOf('minimal') >= 0) ||
        (fin1.indexOf('konfor') >= 0 && fin2.indexOf('konfor') >= 0)) {
      finScore = 7;
    } else if (fin1.length > 10 && fin2.length > 10) {
      finScore = 3;
    }
  }
  score += finScore;
  details.financial = finScore;

  // 10. Height compatibility (5 pts) - based on common preference patterns
  maxScore += 5;
  var heightScore = 0;
  if (candidate.height && target.height && candidate.gender !== target.gender) {
    var maleH = candidate.gender === 'male' ? candidate.height : target.height;
    var femaleH = candidate.gender === 'female' ? candidate.height : target.height;
    if (maleH && femaleH && maleH > femaleH) {
      heightScore = 5; // Traditional height pattern
    } else if (maleH && femaleH) {
      heightScore = 3;
    }
  } else {
    heightScore = 2;
  }
  score += heightScore;
  details.height = heightScore;

  // 11. Reading / intellectual compatibility (5 pts)
  maxScore += 5;
  var readScore = 0;
  if (candidate.reading && target.reading) {
    var r1 = candidate.reading.toLowerCase();
    var r2 = target.reading.toLowerCase();
    var readKeywords = ['roman', 'tarih', 'felsefe', 'psikoloji', 'kişisel gelişim', 'bilim', 'şiir', 'deneme', 'araştırma', 'biyografi'];
    var rMatch = 0;
    for (var rk = 0; rk < readKeywords.length; rk++) {
      if (r1.indexOf(readKeywords[rk]) >= 0 && r2.indexOf(readKeywords[rk]) >= 0) rMatch++;
    }
    readScore = rMatch >= 2 ? 5 : (rMatch >= 1 ? 3 : 1);
  }
  score += readScore;
  details.reading = readScore;

  var percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return {
    totalScore: score,
    maxScore: maxScore,
    percentage: Math.min(percentage, 100),
    details: details
  };
}

// ── Run Structured Matchmaking ──
function runMatchmaking() {
  var selectEl = document.getElementById('match-select-candidate');
  var selectedId = selectEl ? selectEl.value : '';

  if (!selectedId) {
    tool.notify('Please select a candidate first', 'warning');
    return;
  }

  var candidate = findCandidate(selectedId);
  if (!candidate) {
    tool.notify('Candidate not found', 'error');
    return;
  }

  var oppositeGender = candidate.gender === 'male' ? 'female' : 'male';
  var pool = STATE.candidates.filter(function(c) {
    return c.gender === oppositeGender && c.id !== candidate.id;
  });

  if (pool.length === 0) {
    tool.notify('No opposite-gender candidates available for matching', 'warning');
    return;
  }

  var maxMatches = parseInt(tool.param('maxMatches', '10')) || 10;

  // Compute scores for all opposite-gender candidates
  var scored = [];
  for (var i = 0; i < pool.length; i++) {
    var result = computeStructuredScore(candidate, pool[i]);
    scored.push({
      candidate: pool[i],
      score: result.percentage,
      totalScore: result.totalScore,
      maxScore: result.maxScore,
      details: result.details
    });
  }

  // Sort by score descending
  scored.sort(function(a, b) { return b.score - a.score; });

  // Take top N
  var topMatches = scored.slice(0, maxMatches);

  // Store matches
  STATE.matches[candidate.id] = topMatches;
  saveState();
  renderMatchResults(candidate, topMatches);
  tool.notify('Structured matching complete! Found ' + topMatches.length + ' matches for ' + candidate.code, 'success');
}

// ── AI Deep Matchmaking ──
function runAIMatchmaking() {
  var selectEl = document.getElementById('match-select-candidate');
  var selectedId = selectEl ? selectEl.value : '';

  if (!selectedId) {
    tool.notify('Please select a candidate first', 'warning');
    return;
  }

  var candidate = findCandidate(selectedId);
  if (!candidate) {
    tool.notify('Candidate not found', 'error');
    return;
  }

  // First run structured matching
  var oppositeGender = candidate.gender === 'male' ? 'female' : 'male';
  var pool = STATE.candidates.filter(function(c) {
    return c.gender === oppositeGender && c.id !== candidate.id;
  });

  if (pool.length === 0) {
    tool.notify('No opposite-gender candidates available', 'warning');
    return;
  }

  // Compute structured scores first
  var scored = [];
  for (var i = 0; i < pool.length; i++) {
    var result = computeStructuredScore(candidate, pool[i]);
    scored.push({
      candidate: pool[i],
      score: result.percentage,
      totalScore: result.totalScore,
      maxScore: result.maxScore,
      details: result.details
    });
  }
  scored.sort(function(a, b) { return b.score - a.score; });

  var maxMatches = parseInt(tool.param('maxMatches', '10')) || 10;
  var topCandidates = scored.slice(0, Math.min(maxMatches * 2, pool.length)); // Take top 20 for AI refinement

  // Check if AI is allowed
  var allowAi = tool.param('allowAi', 'yes');
  if (allowAi !== 'yes') {
    tool.notify('AI matching is not enabled. Running structured matching only.', 'warning');
    var topMatches = scored.slice(0, maxMatches);
    STATE.matches[candidate.id] = topMatches;
    saveState();
    renderMatchResults(candidate, topMatches);
    return;
  }

  // Show AI progress modal
  showAIProgress();

  // Build prompt for AI
  var candidateSummary = buildCandidateSummary(candidate);
  var topSummaries = [];
  for (var t = 0; t < topCandidates.length; t++) {
    topSummaries.push('--- Candidate ' + (t + 1) + ' (' + topCandidates[t].candidate.code + ', Structured Score: ' + topCandidates[t].score + '%) ---\n' + buildCandidateSummary(topCandidates[t].candidate));
  }

  var prompt = 'You are a professional matchmaking advisor. Below is a PRIMARY candidate and a list of potential matches (opposite gender).\n\n' +
    'PRIMARY CANDIDATE:\n' + candidateSummary + '\n\n' +
    'POTENTIAL MATCHES (pre-scored by structured algorithm):\n' + topSummaries.join('\n\n') + '\n\n' +
    'TASK: Analyze the compatibility between the primary candidate and EACH potential match. Consider:\n' +
    '1. Value alignment and life philosophy\n' +
    '2. Marriage expectations and relationship approach\n' +
    '3. Personality compatibility and communication style\n' +
    '4. Lifestyle, hobbies, and interests overlap\n' +
    '5. Future plans and financial outlook alignment\n' +
    '6. Religious/spiritual practice harmony\n' +
    '7. Family background and expectations\n\n' +
    'Return a JSON array of the top ' + maxMatches + ' matches, ordered by AI-assessed compatibility (highest first). Each entry must have:\n' +
    '- "code": the candidate code (e.g. ADAY-F001)\n' +
    '- "aiScore": a score from 0-100\n' +
    '- "aiReasoning": a brief 1-2 sentence explanation in Turkish of why they are compatible\n\n' +
    'Return ONLY valid JSON array. No other text.';

  var context = 'Matchmaking analysis. Primary: ' + candidate.code + '. Pool size: ' + topCandidates.length + '. The candidates are all from the same cultural/religious community.';

  tool.requestAI(prompt, context, function(err, response) {
    hideAIProgress();

    if (err && !response) {
      tool.notify('AI matching failed: ' + err + '. Using structured scores only.', 'error');
      var fallback = scored.slice(0, maxMatches);
      STATE.matches[candidate.id] = fallback;
      saveState();
      renderMatchResults(candidate, fallback);
      return;
    }

    if (err) {
      tool.notify('Warning: ' + err, 'warning');
    }

    // Parse AI response
    try {
      // Try to extract JSON from response
      var jsonStr = response.trim();
      // Remove markdown code fences if present
      jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      var aiResults = JSON.parse(jsonStr);

      if (!Array.isArray(aiResults)) {
        throw new Error('AI response is not an array');
      }

      // Merge AI scores with structured scores
      var merged = [];
      for (var a = 0; a < aiResults.length; a++) {
        var aiEntry = aiResults[a];
        // Find matching structured result
        var structured = null;
        for (var s = 0; s < scored.length; s++) {
          if (scored[s].candidate.code === aiEntry.code) {
            structured = scored[s];
            break;
          }
        }
        if (structured) {
          merged.push({
            candidate: structured.candidate,
            score: Math.round((structured.score + (aiEntry.aiScore || 50)) / 2),
            totalScore: structured.totalScore,
            maxScore: structured.maxScore,
            details: structured.details,
            aiScore: aiEntry.aiScore || 50,
            aiReasoning: aiEntry.aiReasoning || 'AI değerlendirmesi yapıldı.'
          });
        }
      }

      // Sort by combined score
      merged.sort(function(a, b) { return b.score - a.score; });

      var finalMatches = merged.slice(0, maxMatches);
      STATE.matches[candidate.id] = finalMatches;
      STATE.aiMatches[candidate.id] = finalMatches;
      saveState();
      renderMatchResults(candidate, finalMatches);
      tool.notify('AI deep matching complete! ' + finalMatches.length + ' refined matches for ' + candidate.code, 'success');

    } catch (parseErr) {
      tool.notify('AI response could not be parsed. Using structured scores.', 'warning');
      var fallback = scored.slice(0, maxMatches);
      STATE.matches[candidate.id] = fallback;
      saveState();
      renderMatchResults(candidate, fallback);
    }
  });
}

// ── Build text summary of a candidate for AI ──
function buildCandidateSummary(c) {
  var parts = [];
  parts.push('Code: ' + c.code);
  parts.push('Gender: ' + (c.gender === 'male' ? 'Male' : 'Female'));
  parts.push('Age: ' + (c.age || 'Unknown'));
  parts.push('Location: ' + (c.location || 'N/A'));
  parts.push('Native Language: ' + (c.nativeLang || 'N/A'));
  parts.push('Other Languages: ' + (c.otherLangs || 'N/A'));
  parts.push('Education & Career: ' + truncate(c.education, 200));
  parts.push('Hobbies & Interests: ' + truncate(c.hobbies, 150));
  parts.push('Artistic Abilities: ' + truncate(c.artistic, 100));
  parts.push('Religious Practice: ' + truncate(c.prayer, 150));
  parts.push('Reading Habits: ' + truncate(c.reading, 150));
  parts.push('Role Models: ' + truncate(c.roleModels, 100));
  parts.push('Volunteering: ' + truncate(c.volunteering, 100));
  parts.push('Personality: ' + truncate(c.personality, 150));
  parts.push('Personal Red Lines: ' + truncate(c.redlines, 150));
  parts.push('Gender Relations Approach: ' + truncate(c.genderRelations, 100));
  parts.push('Strengths & Weaknesses: ' + truncate(c.strengthsWeaknesses, 150));
  parts.push('Core Values: ' + truncate(c.values, 150));
  parts.push('Decision Making: ' + truncate(c.decisionMaking, 100));
  parts.push('Important People: ' + truncate(c.importantPeople, 100));
  parts.push('Marriage Expectations: ' + truncate(c.marriageExpectations, 200));
  parts.push('Marriage Effort View: ' + truncate(c.marriageEffort, 150));
  parts.push('Spouse Criteria - Red Lines: ' + truncate(c.spouseRedlines, 150));
  parts.push('Spouse Criteria - Yellow Lines: ' + truncate(c.spouseYellowlines, 100));
  parts.push('Spouse Criteria - Green (Desired): ' + truncate(c.spouseGreen, 150));
  parts.push('Social Media View: ' + truncate(c.spouseSocialMedia, 100));
  parts.push('Age Preference: ' + (c.ageMin || '?') + ' - ' + (c.ageMax || '?'));
  parts.push('Past Relationships View: ' + truncate(c.spousePast, 100));
  parts.push('Family Role in Decision: ' + truncate(c.familyRole, 100));
  parts.push('Relocation View: ' + truncate(c.relocationView, 100));
  parts.push('Residency Status: ' + (c.residencyStatus || 'N/A'));
  parts.push('Current Housing: ' + (c.currentHousing || 'N/A'));
  parts.push('Future Housing Plans: ' + truncate(c.futureHousing, 100));
  parts.push('Income Source: ' + (c.incomeSource || 'N/A'));
  parts.push('Career Plans: ' + truncate(c.careerPlans, 150));
  parts.push('Budget Views: ' + truncate(c.budgetViews, 100));
  parts.push('Financial Future: ' + truncate(c.financialFuture, 150));
  parts.push('Additional Notes: ' + truncate(c.additionalNotes, 150));
  parts.push('Height: ' + (c.height || '?') + ' cm, Weight: ' + (c.weight || '?') + ' kg');
  parts.push('Eye Color: ' + (c.eyeColor || 'N/A') + ', Hair: ' + (c.hair || 'N/A'));
  return parts.join('\n');
}

// ── Render Match Results ──
function renderMatchResults(candidate, matches) {
  var container = document.getElementById('match-results-container');
  var summaryCard = document.getElementById('match-summary-card');
  var baseCandidateEl = document.getElementById('match-base-candidate');
  var statsEl = document.getElementById('match-stats');
  var emptyEl = document.getElementById('match-empty');

  if (!candidate || !matches || matches.length === 0) {
    if (summaryCard) summaryCard.style.display = 'none';
    if (container) {
      container.innerHTML = '<div class="mm-card"><div class="mm-empty" id="match-empty">No matches found. Try adding more candidates or adjusting criteria.</div></div>';
    }
    return;
  }

  // Show summary
  if (summaryCard) summaryCard.style.display = '';
  if (baseCandidateEl) baseCandidateEl.innerHTML = '<span class="mm-code">' + esc(candidate.code) + '</span> — ' + esc(candidate.gender === 'male' ? '♂ Male' : '♀ Female') + ', ' + (candidate.age || '?') + ' yrs, ' + esc(candidate.location || '');

  if (statsEl) {
    var avgScore = 0;
    for (var i = 0; i < matches.length; i++) { avgScore += matches[i].score; }
    avgScore = Math.round(avgScore / matches.length);

    statsEl.innerHTML =
      '<div class="mm-match-stat"><div class="mm-match-stat-val">' + matches.length + '</div><div class="mm-match-stat-lbl">Matches Found</div></div>' +
      '<div class="mm-match-stat"><div class="mm-match-stat-val">' + avgScore + '%</div><div class="mm-match-stat-lbl">Avg Score</div></div>' +
      '<div class="mm-match-stat"><div class="mm-match-stat-val">' + (matches[0] ? matches[0].score + '%' : '—') + '</div><div class="mm-match-stat-lbl">Top Score</div></div>' +
      '<div class="mm-match-stat"><div class="mm-match-stat-val">' + (matches[matches.length - 1] ? matches[matches.length - 1].score + '%' : '—') + '</div><div class="mm-match-stat-lbl">Lowest Score</div></div>';
  }

  // Render match cards
  var html = '';
  for (var m = 0; m < matches.length; m++) {
    var match = matches[m];
    var rank = m + 1;
    var rankClass = rank === 1 ? 'mm-match-rank-1' : (rank === 2 ? 'mm-match-rank-2' : (rank === 3 ? 'mm-match-rank-3' : 'mm-match-rank-other'));
    var scoreColor = match.score >= 75 ? 'mm-match-bar-fill-high' : (match.score >= 50 ? 'mm-match-bar-fill-mid' : 'mm-match-bar-fill-low');

    html += '<div class="mm-match-card">' +
      '<div class="mm-match-rank ' + rankClass + '">' + rank + '</div>' +
      '<div class="mm-match-body">' +
        '<div class="mm-match-header-row">' +
          '<span class="mm-code">' + esc(match.candidate.code) + '</span>' +
          '<span class="mm-tag ' + (match.candidate.gender === 'male' ? 'mm-tag-male' : 'mm-tag-female') + '">' + (match.candidate.gender === 'male' ? '♂ Male' : '♀ Female') + '</span>' +
        '</div>' +
        '<div class="mm-match-info">' +
          '<span>📍 ' + esc(match.candidate.location || '—') + '</span>' +
          '<span>🎂 ' + (match.candidate.age || '—') + ' yrs</span>' +
          '<span>📏 ' + (match.candidate.height || '—') + ' cm</span>' +
          '<span>🎓 ' + esc(truncate(match.candidate.education, 30) || '—') + '</span>' +
        '</div>';

    if (match.aiReasoning) {
      html += '<div style="margin-top:8px;font-size:12px;color:var(--mm-secondary);font-style:italic;">🤖 AI: ' + esc(match.aiReasoning) + '</div>';
    }

    if (match.details) {
      html += '<div class="mm-match-bars">' +
        buildBarRow('Age', match.details.age, 15, scoreColor) +
        buildBarRow('Location', match.details.location, 10, scoreColor) +
        buildBarRow('Education', match.details.education, 8, scoreColor) +
        buildBarRow('Languages', match.details.language, 8, scoreColor) +
        buildBarRow('Prayer', match.details.prayer, 10, scoreColor) +
        buildBarRow('Hobbies', match.details.hobbies, 10, scoreColor) +
        buildBarRow('Values', match.details.values, 12, scoreColor) +
        buildBarRow('Marriage', match.details.marriage, 10, scoreColor) +
        '</div>';
    }

    html += '</div>' +
      '<div class="mm-match-score-col">' +
        '<div class="mm-match-score">' + match.score + '%</div>' +
        '<div class="mm-match-score-label">Match</div>' +
      '</div>' +
      '<div style="flex-shrink:0;">' +
        '<button class="mm-btn mm-btn-sm mm-btn-outline" onclick="viewCandidateDetail(\'' + match.candidate.id + '\')">👁 Detail</button>' +
      '</div>' +
      '</div>';
  }

  if (container) container.innerHTML = html;
  tool.resize();
}

function buildBarRow(label, score, maxScore, colorClass) {
  if (score === undefined || maxScore === undefined) return '';
  var pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return '<div class="mm-match-bar-row">' +
    '<span class="mm-match-bar-label">' + label + '</span>' +
    '<div class="mm-match-bar-track"><div class="mm-match-bar-fill ' + (pct >= 70 ? 'mm-match-bar-fill-high' : (pct >= 40 ? 'mm-match-bar-fill-mid' : 'mm-match-bar-fill-low')) + '" style="width:' + pct + '%"></div></div>' +
    '<span style="font-size:10px;color:var(--mm-text-muted);width:28px;text-align:right">' + score + '/' + maxScore + '</span>' +
    '</div>';
}

// ── Render Matches View (tab) ──
function renderMatchesView() {
  var selectEl = document.getElementById('match-select-candidate');
  if (!selectEl) return;

  // Populate candidate dropdown
  var options = '<option value="">Select a candidate...</option>';
  for (var i = 0; i < STATE.candidates.length; i++) {
    var c = STATE.candidates[i];
    options += '<option value="' + c.id + '">' + c.code + ' (' + (c.gender === 'male' ? '♂' : '♀') + ', ' + (c.age || '?') + ' yrs, ' + esc(c.location || '') + ')</option>';
  }
  selectEl.innerHTML = options;

  // Check if we have a previously selected candidate
  var lastId = '';
  var matchKeys = Object.keys(STATE.matches);
  if (matchKeys.length > 0) {
    lastId = matchKeys[matchKeys.length - 1];
    selectEl.value = lastId;
    var candidate = findCandidate(lastId);
    var matches = STATE.matches[lastId];
    if (candidate && matches) {
      renderMatchResults(candidate, matches);
      return;
    }
  }

  // Reset
  var container = document.getElementById('match-results-container');
  var summaryCard = document.getElementById('match-summary-card');
  if (summaryCard) summaryCard.style.display = 'none';
  if (container) {
    container.innerHTML = '<div class="mm-card"><div class="mm-empty" id="match-empty">Select a candidate and run matchmaking to see top ' + (parseInt(tool.param('maxMatches', '10')) || 10) + ' matches</div></div>';
  }
}

// ══════════════════════════════════════════════════════════════
// CANDIDATE DETAIL MODAL
// ══════════════════════════════════════════════════════════════
function viewCandidateDetail(id) {
  var c = findCandidate(id);
  if (!c) return;

  var modal = document.getElementById('modal-detail');
  var title = document.getElementById('modal-detail-title');
  var body = document.getElementById('modal-detail-body');

  if (!modal || !title || !body) return;

  title.textContent = 'Candidate: ' + c.code;

  var html = '<div class="mm-detail-grid">';
  html += detailRow('Cinsiyet / Gender', c.gender === 'male' ? '♂ Male' : '♀ Female');
  html += detailRow('Yaş / Age', c.age || '—');
  html += detailRow('İkamet / Location', c.location || '—');
  html += detailRow('İrtibat / Contact', c.contact || '—');
  html += detailRow('Danışman / Consultant', c.consultant || '—');
  html += detailRow('Doğum Tarihi / Birth Date', c.birthDate || '—');
  html += detailRow('Doğum Yeri / Birth Place', c.birthPlace || '—');
  html += detailRow('Anadil / Native Lang', c.nativeLang || '—');
  html += detailRow('Diğer Diller / Other Langs', c.otherLangs || '—');
  html += detailRow('Boy / Height', c.height ? c.height + ' cm' : '—');
  html += detailRow('Kilo / Weight', c.weight ? c.weight + ' kg' : '—');
  html += detailRow('Göz Rengi / Eye Color', c.eyeColor || '—');
  html += detailRow('Saç / Hair', c.hair || '—');
  html += detailFull('Referans / Reference', (c.refName || '') + (c.refPhone ? ' — ' + c.refPhone : '') + (c.refLocation ? ' — ' + c.refLocation : ''));
  html += detailFull('Anne Bilgileri / Mother', c.motherInfo || '—');
  html += detailFull('Baba Bilgileri / Father', c.fatherInfo || '—');
  html += detailRow('Kardeş Sayısı / Siblings', c.siblingsTotal || '—');
  html += detailRow('Kardeş Sıralaması / Rank', c.siblingRank || '—');
  html += detailFull('Eğitim & Kariyer / Education', c.education || '—');
  html += detailFull('Hobiler / Hobbies', c.hobbies || '—');
  html += detailFull('Sanatsal / Artistic', c.artistic || '—');
  html += detailFull('Medya Tercihleri / Media', c.media || '—');
  html += detailFull('Namaz / Prayer', c.prayer || '—');
  html += detailFull('Kitap Okuma / Reading', c.reading || '—');
  html += detailFull('Rol Modeller / Role Models', c.roleModels || '—');
  html += detailFull('Gönüllülük / Volunteering', c.volunteering || '—');
  html += detailFull('Kişilik / Personality', c.personality || '—');
  html += detailFull('Kırmızı Çizgiler / Red Lines', c.redlines || '—');
  html += detailFull('Bayan-Erkek Münasebet / Gender Relations', c.genderRelations || '—');
  html += detailFull('Güçlü & Zayıf Yönler / Strengths', c.strengthsWeaknesses || '—');
  html += detailFull('Değer Yargıları / Values', c.values || '—');
  html += detailFull('Karar Verme / Decision Making', c.decisionMaking || '—');
  html += detailFull('Önemli İnsanlar / Important People', c.importantPeople || '—');
  html += detailFull('Evlilik Beklentileri / Marriage Expectations', c.marriageExpectations || '—');
  html += detailFull('Evlilik Emek / Marriage Effort', c.marriageEffort || '—');
  html += detailFull('Eş Kırmızı Çizgiler / Spouse Red Lines', c.spouseRedlines || '—');
  html += detailFull('Eş Sarı Çizgiler / Spouse Yellow Lines', c.spouseYellowlines || '—');
  html += detailFull('Eş Yeşil Alan / Spouse Green', c.spouseGreen || '—');
  html += detailFull('Sosyal Medya Görüşü / Social Media', c.spouseSocialMedia || '—');
  html += detailRow('Yaş Tercihi / Age Pref', (c.ageMin || '?') + ' — ' + (c.ageMax || '?'));
  html += detailFull('Geçmiş Birliktelik Görüşü / Past View', c.spousePast || '—');
  html += detailFull('Aile Rolü / Family Role', c.familyRole || '—');
  html += detailFull('Yer Değiştirme Görüşü / Relocation', c.relocationView || '—');
  html += detailFull('Oturum Durumu / Residency', c.residencyStatus || '—');
  html += detailFull('Mevcut İkamet / Current Housing', c.currentHousing || '—');
  html += detailFull('Evlilik Sonrası İkamet / Future Housing', c.futureHousing || '—');
  html += detailFull('Gelir Kaynağı / Income', c.incomeSource || '—');
  html += detailFull('Kariyer Planları / Career Plans', c.careerPlans || '—');
  html += detailFull('Bütçe Görüşleri / Budget Views', c.budgetViews || '—');
  html += detailFull('Finansal Gelecek / Financial Future', c.financialFuture || '—');
  html += detailFull('Geçmiş İlişkiler / Past Relationships', c.pastRelationships || '—');
  html += detailFull('Mevcut İlgi / Current Interest', c.currentInterest || '—');
  html += detailFull('Ek Notlar / Additional Notes', c.additionalNotes || '—');
  html += '</div>';

  // Files
  if (c.files && c.files.length > 0) {
    html += '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--mm-border);"><strong style="font-size:13px;">📸 Uploaded Files:</strong><ul style="margin-top:8px;padding-left:20px;">';
    for (var f = 0; f < c.files.length; f++) {
      html += '<li style="font-size:12px;margin-bottom:4px;">' + esc(c.files[f].name) + ' <span style="color:var(--mm-text-muted)">(' + formatBytes(c.files[f].size) + ')</span></li>';
    }
    html += '</ul></div>';
  }

  body.innerHTML = html;
  modal.classList.add('active');
}

function detailRow(label, value) {
  return '<div class="mm-detail-item"><div class="mm-detail-label">' + esc(label) + '</div><div class="mm-detail-value">' + esc(value) + '</div></div>';
}
function detailFull(label, value) {
  return '<div class="mm-detail-item mm-detail-full"><div class="mm-detail-label">' + esc(label) + '</div><div class="mm-detail-value">' + esc(value) + '</div></div>';
}

function closeModalDetail() {
  var modal = document.getElementById('modal-detail');
  if (modal) modal.classList.remove('active');
}

// ══════════════════════════════════════════════════════════════
// DELETE CONFIRMATION
// ══════════════════════════════════════════════════════════════
function deleteCandidate(id) {
  if (STATE.readOnly) {
    tool.notify('Cannot delete in read-only mode', 'warning');
    return;
  }
  var c = findCandidate(id);
  if (!c) return;
  STATE.deleteId = id;
  var nameEl = document.getElementById('modal-delete-name');
  if (nameEl) nameEl.textContent = c.code + ' — ' + (c.gender === 'male' ? 'Male' : 'Female') + ', ' + (c.age || '?') + ' yrs';
  var modal = document.getElementById('modal-delete');
  if (modal) modal.classList.add('active');
}

function closeModalDelete() {
  var modal = document.getElementById('modal-delete');
  if (modal) modal.classList.remove('active');
  STATE.deleteId = null;
}

function confirmDelete() {
  if (!STATE.deleteId) return;
  var idx = findCandidateIndex(STATE.deleteId);
  if (idx >= 0) {
    var c = STATE.candidates[idx];
    STATE.candidates.splice(idx, 1);
    // Clean up matches
    delete STATE.matches[c.id];
    delete STATE.aiMatches[c.id];
    saveState();
    tool.notify('Candidate ' + c.code + ' deleted', 'info');
  }
  closeModalDelete();
  refreshAll();
  if (STATE.activeTab === 'form' && STATE.editingId === STATE.deleteId) {
    resetForm();
  }
}

// ══════════════════════════════════════════════════════════════
// AI PROGRESS MODAL
// ══════════════════════════════════════════════════════════════
function showAIProgress() {
  var modal = document.getElementById('modal-ai-progress');
  if (modal) modal.classList.add('active');
  var bar = document.getElementById('ai-progress-bar');
  if (bar) { bar.style.width = '0%'; }
  // Simulate progress
  var width = 0;
  var interval = setInterval(function() {
    if (width >= 90) { clearInterval(interval); return; }
    width += Math.random() * 15;
    if (width > 90) width = 90;
    if (bar) bar.style.width = width + '%';
  }, 600);
  STATE._aiProgressInterval = interval;
}

function hideAIProgress() {
  var modal = document.getElementById('modal-ai-progress');
  if (modal) modal.classList.remove('active');
  if (STATE._aiProgressInterval) {
    clearInterval(STATE._aiProgressInterval);
    STATE._aiProgressInterval = null;
  }
}

// ══════════════════════════════════════════════════════════════
// EXPORT SUMMARY
// ══════════════════════════════════════════════════════════════
function exportSummary() {
  var summary = {
    totalCandidates: STATE.candidates.length,
    males: STATE.candidates.filter(function(c) { return c.gender === 'male'; }).length,
    females: STATE.candidates.filter(function(c) { return c.gender === 'female'; }).length,
    totalMatches: 0,
    matchDetails: {}
  };

  var matchKeys = Object.keys(STATE.matches);
  for (var i = 0; i < matchKeys.length; i++) {
    var key = matchKeys[i];
    var matches = STATE.matches[key];
    summary.totalMatches += matches.length;
    summary.matchDetails[key] = matches.map(function(m) {
      return { code: m.candidate.code, score: m.score, aiScore: m.aiScore || null };
    });
  }

  // Display in a notification or console
  tool.notify('Summary: ' + summary.totalCandidates + ' candidates, ' + summary.totalMatches + ' matches generated. Check console for details.', 'info');

  // Also update the tool value with summary
  // We use the console for debugging in test harness
  if (typeof console !== 'undefined') {
    console.log('MATCHMAKING SUMMARY:', JSON.stringify(summary, null, 2));
  }
}

// ══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════
function findCandidate(id) {
  for (var i = 0; i < STATE.candidates.length; i++) {
    if (STATE.candidates[i].id === id) return STATE.candidates[i];
  }
  return null;
}

function findCandidateIndex(id) {
  for (var i = 0; i < STATE.candidates.length; i++) {
    if (STATE.candidates[i].id === id) return i;
  }
  return -1;
}

function generateUUID() {
  return 'cand-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}
