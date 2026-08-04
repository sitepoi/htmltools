/* ── Self-Paced Education by Section ──
   Curriculum delivery tool: admin adds sections (subjects),
   users progress through them one by one.
   Built for UniconHub CMS html-tool system.
────────────────────────────────────────── */

/* ── Helpers ── */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function el(id) { return document.getElementById(id); }

/* ── State ── */
var SECTIONS = [];           // loaded from CMS
var PROGRESS = {};           // { sectionId: { status, score, completedAt, quizAnswers } }
var isReadOnly = false;
var isManager = false;
var currentView = 'list';    // 'list' | 'detail' | 'manager'
var currentSectionId = null; // which section is open in detail view
var editingSectionId = null; // which section is being edited (null = new)
var quizAnswers = {};        // { questionIndex: selectedOptionIndex }
var quizSubmitted = false;

/* ── Constants ── */
var SECTIONS_TYPE = 'selfPacedSections-uniconbaseapps';

/* ── Data helpers ── */
function getSortedSections() {
  return SECTIONS.slice().sort(function(a, b) {
    var da = a.productData && a.productData.data_categoriesBased;
    var db = b.productData && b.productData.data_categoriesBased;
    var oa = da && typeof da.order === 'number' ? da.order : 9999;
    var ob = db && typeof db.order === 'number' ? db.order : 9999;
    if (oa !== ob) return oa - ob;
    return (a.name || '').localeCompare(b.name || '');
  });
}

function getProgress(sectionId) {
  return PROGRESS[sectionId] || { status: 'not_started' };
}

function getProgressPct() {
  var sorted = getSortedSections();
  if (sorted.length === 0) return 0;
  var completed = sorted.filter(function(s) {
    return getProgress(s.id).status === 'completed';
  }).length;
  return Math.round((completed / sorted.length) * 100);
}

function getSectionData(section) {
  return (section.productData && section.productData.data_categoriesBased) || {};
}

/* ── Persist progress ── */
function saveProgress() {
  tool.setValue({ progress: PROGRESS });
}

/* ── Render: Section List ── */
function renderList() {
  var grid = el('section-grid');
  var empty = el('empty-state');
  var searchTerm = (el('search-input').value || '').toLowerCase();
  var filterStatus = el('filter-status').value;

  var sorted = getSortedSections();
  var filtered = sorted.filter(function(s) {
    var d = getSectionData(s);
    var name = (s.name || d.title || '').toLowerCase();
    if (searchTerm && name.indexOf(searchTerm) === -1) return false;
    if (filterStatus !== 'all' && getProgress(s.id).status !== filterStatus) return false;
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.style.display = '';
    if (sorted.length === 0) {
      empty.querySelector('.empty-title').textContent = 'No sections available yet';
      empty.querySelector('.empty-desc').textContent = 'A manager needs to add curriculum sections first.';
    } else {
      empty.querySelector('.empty-title').textContent = 'No matching sections';
      empty.querySelector('.empty-desc').textContent = 'Try adjusting your search or filter.';
    }
  } else {
    empty.style.display = 'none';
    grid.innerHTML = filtered.map(function(s, i) {
      var d = getSectionData(s);
      var prog = getProgress(s.id);
      var statusLabel = { not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed' }[prog.status] || 'Not Started';
      var statusClass = 'status-' + prog.status;
      var scoreHtml = '';
      if (typeof prog.score === 'number') {
        scoreHtml = '<div class="section-card-score" style="color:' + (prog.score >= 70 ? 'var(--success)' : 'var(--warning)') + '">Score: ' + prog.score + '%</div>';
      }
      var idx = sorted.indexOf(s) + 1;
      return '<div class="section-card" data-id="' + esc(s.id) + '" onclick="openSection(\'' + esc(s.id) + '\')">' +
        '<div class="section-card-header">' +
          '<span class="section-card-num">Section ' + idx + '</span>' +
          '<span class="section-card-status ' + statusClass + '">' + statusLabel + '</span>' +
        '</div>' +
        '<div class="section-card-title">' + esc(s.name || d.title || 'Untitled') + '</div>' +
        '<div class="section-card-meta">' +
          '<span>⏱️ ' + (d.estimatedMinutes || '—') + ' min</span>' +
          (d.quiz && d.quiz.length ? '<span>📝 Quiz (' + d.quiz.length + ' Q)</span>' : '') +
        '</div>' +
        scoreHtml +
      '</div>';
    }).join('');
  }

  updateProgressBar();
}

/* ── Render: Section Detail ── */
function renderDetail() {
  var section = null;
  for (var i = 0; i < SECTIONS.length; i++) {
    if (SECTIONS[i].id === currentSectionId) { section = SECTIONS[i]; break; }
  }
  if (!section) { showList(); return; }

  var d = getSectionData(section);
  var prog = getProgress(section.id);
  var sorted = getSortedSections();
  var idx = -1;
  for (var j = 0; j < sorted.length; j++) {
    if (sorted[j].id === section.id) { idx = j; break; }
  }

  el('detail-title').textContent = section.name || d.title || 'Untitled Section';
  el('detail-estimated').textContent = '⏱️ Estimated: ' + (d.estimatedMinutes || '—') + ' min';
  el('detail-content').innerHTML = d.content || '<p><em>No content for this section.</em></p>';

  // Status badge
  var badge = el('detail-badge');
  var statusLabels = { not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed' };
  var statusClasses = { not_started: 'status-not_started', in_progress: 'status-in_progress', completed: 'status-completed' };
  badge.textContent = statusLabels[prog.status] || 'Not Started';
  badge.className = 'detail-badge ' + (statusClasses[prog.status] || 'status-not_started');
  el('detail-status-label').textContent = typeof prog.score === 'number' ? ' | Score: ' + prog.score + '%' : '';

  // Quiz
  var quizData = d.quiz;
  if (quizData && typeof quizData === 'string') {
    try { quizData = JSON.parse(quizData); } catch(e) { quizData = null; }
  }
  var hasQuiz = quizData && Array.isArray(quizData) && quizData.length > 0;
  var quizSection = el('quiz-section');
  var quizQuestions = el('quiz-questions');
  var quizResult = el('quiz-result');
  var submitBtn = el('btn-submit-quiz');

  if (hasQuiz) {
    quizSection.style.display = '';
    quizSubmitted = prog.status === 'completed' || (prog.quizAnswers && Object.keys(prog.quizAnswers).length > 0);
    quizAnswers = prog.quizAnswers ? JSON.parse(JSON.stringify(prog.quizAnswers)) : {};

    quizQuestions.innerHTML = quizData.map(function(q, qi) {
      var opts = (q.options || []).map(function(opt, oi) {
        var selected = quizAnswers[qi] === oi;
        var correctClass = '';
        if (quizSubmitted) {
          if (oi === q.answer) correctClass = ' correct';
          else if (selected && oi !== q.answer) correctClass = ' incorrect';
        }
        return '<label class="quiz-option' + (selected ? ' selected' : '') + correctClass + '">' +
          '<input type="radio" name="q' + qi + '" value="' + oi + '" ' +
          (selected ? 'checked' : '') + ' ' +
          (quizSubmitted ? 'disabled' : '') + '>' +
          '<span>' + esc(opt) + '</span>' +
        '</label>';
      }).join('');
      return '<div class="quiz-question">' +
        '<div class="quiz-q-text">' + (qi + 1) + '. ' + esc(q.question) + '</div>' +
        opts +
      '</div>';
    }).join('');

    // Bind radio clicks
    if (!quizSubmitted) {
      setTimeout(function() {
        var radios = quizQuestions.querySelectorAll('input[type="radio"]');
        for (var r = 0; r < radios.length; r++) {
          radios[r].addEventListener('change', function() {
            var qi = parseInt(this.name.replace('q', ''));
            quizAnswers[qi] = parseInt(this.value);
            // Update selected classes
            var allOpts = quizQuestions.querySelectorAll('.quiz-option');
            for (var ao = 0; ao < allOpts.length; ao++) { allOpts[ao].classList.remove('selected'); }
            var parentLabel = this.closest('.quiz-option');
            if (parentLabel) parentLabel.classList.add('selected');
          });
        }
      }, 50);
    }

    submitBtn.style.display = quizSubmitted ? 'none' : '';
    quizResult.style.display = 'none';

    if (quizSubmitted && prog.quizAnswers) {
      var score = calcQuizScore(quizData, prog.quizAnswers);
      quizResult.style.display = '';
      quizResult.textContent = 'Quiz completed — Score: ' + score + '% (' + score + '/' + quizData.length + ')';
      quizResult.className = 'quiz-result ' + (score >= 70 ? 'pass' : 'fail');
    }
  } else {
    quizSection.style.display = 'none';
    quizAnswers = {};
    quizSubmitted = false;
  }

  // Navigation buttons
  el('btn-prev-section').disabled = idx <= 0;
  el('btn-next-section').disabled = idx >= sorted.length - 1;

  // Mark complete / in-progress buttons
  if (prog.status === 'completed') {
    el('btn-mark-complete').style.display = 'none';
    el('btn-mark-inprogress').style.display = '';
  } else {
    el('btn-mark-complete').style.display = '';
    el('btn-mark-inprogress').style.display = 'none';
  }

  tool.resize();
}

function calcQuizScore(quizData, answers) {
  var correct = 0;
  for (var i = 0; i < quizData.length; i++) {
    if (answers[i] === quizData[i].answer) correct++;
  }
  return quizData.length > 0 ? Math.round((correct / quizData.length) * 100) : 0;
}

/* ── Navigation ── */
function showList() {
  currentView = 'list';
  currentSectionId = null;
  el('view-list').style.display = '';
  el('view-detail').style.display = 'none';
  el('view-manager').style.display = 'none';
  el('btn-back').style.display = 'none';
  el('app-title').textContent = '📚 Self-Paced Learning';
  el('search-input').value = '';
  el('filter-status').value = 'all';
  renderList();
  tool.resize();
}

function showManager() {
  currentView = 'manager';
  el('view-list').style.display = 'none';
  el('view-detail').style.display = 'none';
  el('view-manager').style.display = '';
  el('btn-back').style.display = 'none';
  el('app-title').textContent = '⚙️ Manage Sections';
  renderManager();
  tool.resize();
}

function openSection(sectionId) {
  currentView = 'detail';
  currentSectionId = sectionId;
  el('view-list').style.display = 'none';
  el('view-detail').style.display = '';
  el('view-manager').style.display = 'none';
  el('btn-back').style.display = '';
  el('app-title').textContent = '📚 Section Detail';
  renderDetail();
  tool.resize();
}

function navigateSection(direction) {
  var sorted = getSortedSections();
  var idx = -1;
  for (var i = 0; i < sorted.length; i++) {
    if (sorted[i].id === currentSectionId) { idx = i; break; }
  }
  if (idx === -1) return;
  var newIdx = idx + direction;
  if (newIdx >= 0 && newIdx < sorted.length) {
    openSection(sorted[newIdx].id);
    window.scrollTo(0, 0);
  }
}

/* ── Progress actions ── */
function markComplete() {
  if (!currentSectionId) return;

  var section = null;
  for (var i = 0; i < SECTIONS.length; i++) {
    if (SECTIONS[i].id === currentSectionId) { section = SECTIONS[i]; break; }
  }
  if (!section) return;

  var d = getSectionData(section);
  var quizData = d.quiz;
  if (quizData && typeof quizData === 'string') {
    try { quizData = JSON.parse(quizData); } catch(e) { quizData = null; }
  }
  var hasQuiz = quizData && Array.isArray(quizData) && quizData.length > 0;

  // If there's a quiz, require it to be submitted
  if (hasQuiz && !quizSubmitted) {
    // Check if all questions answered
    var allAnswered = true;
    for (var qi = 0; qi < quizData.length; qi++) {
      if (typeof quizAnswers[qi] !== 'number') { allAnswered = false; break; }
    }
    if (!allAnswered) {
      tool.notify('Please answer all quiz questions before marking complete.', 'warning');
      return;
    }
    // Submit quiz
    submitQuiz(quizData);
    return;
  }

  PROGRESS[currentSectionId] = {
    status: 'completed',
    score: typeof PROGRESS[currentSectionId] === 'object' && typeof PROGRESS[currentSectionId].score === 'number' ? PROGRESS[currentSectionId].score : null,
    completedAt: new Date().toISOString(),
    quizAnswers: (PROGRESS[currentSectionId] && PROGRESS[currentSectionId].quizAnswers) || {}
  };
  saveProgress();
  renderDetail();
  tool.notify('Section marked as complete! ✅', 'success');

  // Auto-advance to next section
  var sorted = getSortedSections();
  var idx = -1;
  for (var j = 0; j < sorted.length; j++) {
    if (sorted[j].id === currentSectionId) { idx = j; break; }
  }
  if (idx < sorted.length - 1) {
    setTimeout(function() { navigateSection(1); }, 800);
  }
}

function markInProgress() {
  if (!currentSectionId) return;
  PROGRESS[currentSectionId] = { status: 'in_progress' };
  saveProgress();
  renderDetail();
  tool.notify('Section moved back to In Progress.', 'info');
}

function submitQuiz(quizData) {
  var score = calcQuizScore(quizData, quizAnswers);
  PROGRESS[currentSectionId] = {
    status: 'completed',
    score: score,
    completedAt: new Date().toISOString(),
    quizAnswers: JSON.parse(JSON.stringify(quizAnswers))
  };
  quizSubmitted = true;
  saveProgress();
  renderDetail();
  tool.notify('Quiz submitted! Score: ' + score + '%', score >= 70 ? 'success' : 'warning');

  var sorted = getSortedSections();
  var idx = -1;
  for (var j = 0; j < sorted.length; j++) {
    if (sorted[j].id === currentSectionId) { idx = j; break; }
  }
  if (idx < sorted.length - 1) {
    setTimeout(function() { navigateSection(1); }, 1200);
  }
}

/* ── Render: Manager ── */
function renderManager() {
  var sorted = getSortedSections();
  el('manager-section-count').textContent = sorted.length + ' section(s)';
  var tbody = el('manager-table-body');
  var empty = el('manager-empty');

  if (sorted.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = '';
  } else {
    empty.style.display = 'none';
    tbody.innerHTML = sorted.map(function(s, i) {
      var d = getSectionData(s);
      var quizData = d.quiz;
      if (quizData && typeof quizData === 'string') {
        try { quizData = JSON.parse(quizData); } catch(e) { quizData = null; }
      }
      var hasQuiz = quizData && Array.isArray(quizData) && quizData.length > 0;
      return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td><strong>' + esc(s.name || d.title || 'Untitled') + '</strong></td>' +
        '<td>' + (d.estimatedMinutes || '—') + '</td>' +
        '<td>' + (hasQuiz ? '✅ ' + quizData.length + ' Q' : '—') + '</td>' +
        '<td><div class="table-actions">' +
          '<button class="btn btn-sm btn-outline" data-edit="' + esc(s.id) + '">✏️ Edit</button>' +
          '<button class="btn btn-sm btn-danger" data-delete="' + esc(s.id) + '">🗑 Delete</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    // Bind edit buttons
    var editBtns = tbody.querySelectorAll('[data-edit]');
    for (var eb = 0; eb < editBtns.length; eb++) {
      editBtns[eb].addEventListener('click', function(e) {
        e.stopPropagation();
        openEditor(this.getAttribute('data-edit'));
      });
    }
    // Bind delete buttons
    var delBtns = tbody.querySelectorAll('[data-delete]');
    for (var db = 0; db < delBtns.length; db++) {
      delBtns[db].addEventListener('click', function(e) {
        e.stopPropagation();
        deleteSection(this.getAttribute('data-delete'));
      });
    }
  }
}

/* ── Section CRUD ── */
function openEditor(sectionId) {
  editingSectionId = sectionId || null;
  el('modal-title').textContent = sectionId ? 'Edit Section' : 'Add New Section';
  el('modal-overlay').style.display = '';

  if (sectionId) {
    var section = null;
    for (var i = 0; i < SECTIONS.length; i++) {
      if (SECTIONS[i].id === sectionId) { section = SECTIONS[i]; break; }
    }
    if (section) {
      var d = getSectionData(section);
      el('edit-title').value = section.name || d.title || '';
      el('edit-order').value = typeof d.order === 'number' ? d.order : '';
      el('edit-minutes').value = d.estimatedMinutes || '';
      el('edit-content').value = d.content || '';
      var quizVal = d.quiz;
      if (quizVal && typeof quizVal === 'object') {
        el('edit-quiz').value = JSON.stringify(quizVal, null, 2);
      } else {
        el('edit-quiz').value = typeof quizVal === 'string' ? quizVal : '';
      }
    }
  } else {
    el('edit-title').value = '';
    el('edit-order').value = '';
    el('edit-minutes').value = '';
    el('edit-content').value = '';
    el('edit-quiz').value = '';
  }
}

function closeEditor() {
  el('modal-overlay').style.display = 'none';
  editingSectionId = null;
}

function saveSection() {
  var title = el('edit-title').value.trim();
  var content = el('edit-content').value.trim();
  if (!title) { tool.notify('Title is required.', 'warning'); return; }
  if (!content) { tool.notify('Content is required.', 'warning'); return; }

  var order = parseInt(el('edit-order').value) || 0;
  var minutes = parseInt(el('edit-minutes').value) || 0;
  var quizRaw = el('edit-quiz').value.trim();
  var quiz = null;
  if (quizRaw) {
    try { quiz = JSON.parse(quizRaw); } catch(e) {
      tool.notify('Quiz JSON is invalid. Please check the format.', 'error'); return;
    }
  }

  var data = {
    data_categoriesBased: {
      title: title,
      order: order,
      estimatedMinutes: minutes,
      content: content,
      quiz: quiz
    }
  };

  showLoading(true);

  if (editingSectionId) {
    // Update
    tool.requestObjects('update', {
      mainObjectType: SECTIONS_TYPE,
      objectId: editingSectionId,
      name: title,
      productData: data
    }, function(err) {
      showLoading(false);
      if (err) { tool.notify('Error updating section: ' + err, 'error'); return; }
      closeEditor();
      tool.notify('Section updated!', 'success');
      loadSections();
    });
  } else {
    // Create
    tool.requestObjects('create', {
      mainObjectType: SECTIONS_TYPE,
      name: title,
      productData: data
    }, function(err, result) {
      showLoading(false);
      if (err) { tool.notify('Error creating section: ' + err, 'error'); return; }
      closeEditor();
      tool.notify('Section created!', 'success');
      loadSections();
    });
  }
}

function deleteSection(sectionId) {
  var section = null;
  for (var i = 0; i < SECTIONS.length; i++) {
    if (SECTIONS[i].id === sectionId) { section = SECTIONS[i]; break; }
  }
  var name = section ? (section.name || 'this section') : 'this section';
  if (!confirm('Are you sure you want to delete "' + name + '"? This cannot be undone.')) return;

  showLoading(true);
  tool.requestObjects('delete', {
    mainObjectType: SECTIONS_TYPE,
    objectId: sectionId
  }, function(err) {
    showLoading(false);
    if (err) { tool.notify('Error deleting section: ' + err, 'error'); return; }
    tool.notify('Section deleted.', 'info');
    loadSections();
  });
}

/* ── Data loading ── */
function loadSections(callback) {
  showLoading(true);
  tool.requestObjects('query', {
    mainObjectType: SECTIONS_TYPE
  }, function(err, result) {
    showLoading(false);
    if (err) {
      tool.notify('Error loading sections: ' + err, 'error');
      SECTIONS = [];
    } else {
      SECTIONS = result && result.objects ? result.objects : [];
    }
    if (callback) callback();
    renderCurrentView();
  });
}

function loadProgress(val) {
  if (val && typeof val === 'object' && val.progress) {
    PROGRESS = val.progress;
  } else {
    PROGRESS = {};
  }
}

function renderCurrentView() {
  if (currentView === 'manager') renderManager();
  else if (currentView === 'detail') renderDetail();
  else renderList();
}

function updateProgressBar() {
  var pct = getProgressPct();
  el('progress-bar-fill').style.width = pct + '%';
  el('progress-bar-text').textContent = pct + '% Complete (' +
    getSortedSections().filter(function(s) { return getProgress(s.id).status === 'completed'; }).length +
    ' of ' + getSortedSections().length + ' sections)';
}

function showLoading(show) {
  el('loading-overlay').style.display = show ? '' : 'none';
}

/* ── Read-only ── */
function lockUI(ro) {
  isReadOnly = !!ro;
  el('btn-manager-toggle').style.display = (isManager && !isReadOnly) ? '' : 'none';
  if (ro) {
    el('btn-mark-complete').style.display = 'none';
    el('btn-mark-inprogress').style.display = 'none';
  }
}

/* ── Manager role check ── */
function checkManagerRole() {
  var user = tool.getUser();
  if (!user) { isManager = false; return; }
  var managerRole = tool.param('managerRole', 'admin');
  var roles = managerRole.split(',').map(function(r) { return r.trim().toLowerCase(); });
  var userRoles = (user.roles || []).map(function(r) { return String(r).toLowerCase(); });
  for (var i = 0; i < roles.length; i++) {
    if (userRoles.indexOf(roles[i]) !== -1) { isManager = true; return; }
  }
  isManager = false;
}

/* ── Event bindings ── */
function bindEvents() {
  el('btn-back').addEventListener('click', showList);
  el('btn-manager-toggle').addEventListener('click', function() {
    if (currentView === 'manager') showList(); else showManager();
  });
  el('btn-add-section').addEventListener('click', function() { openEditor(null); });
  el('btn-modal-close').addEventListener('click', closeEditor);
  el('btn-modal-cancel').addEventListener('click', closeEditor);
  el('btn-modal-save').addEventListener('click', saveSection);
  el('btn-prev-section').addEventListener('click', function() { navigateSection(-1); });
  el('btn-next-section').addEventListener('click', function() { navigateSection(1); });
  el('btn-mark-complete').addEventListener('click', markComplete);
  el('btn-mark-inprogress').addEventListener('click', markInProgress);
  el('btn-submit-quiz').addEventListener('click', function() {
    var section = null;
    for (var i = 0; i < SECTIONS.length; i++) {
      if (SECTIONS[i].id === currentSectionId) { section = SECTIONS[i]; break; }
    }
    if (!section) return;
    var d = getSectionData(section);
    var quizData = d.quiz;
    if (quizData && typeof quizData === 'string') {
      try { quizData = JSON.parse(quizData); } catch(e) { quizData = null; }
    }
    if (quizData && Array.isArray(quizData)) {
      var allAnswered = true;
      for (var qi = 0; qi < quizData.length; qi++) {
        if (typeof quizAnswers[qi] !== 'number') { allAnswered = false; break; }
      }
      if (!allAnswered) {
        tool.notify('Please answer all questions before submitting.', 'warning');
        return;
      }
      submitQuiz(quizData);
    }
  });

  el('search-input').addEventListener('input', function() { renderList(); });
  el('filter-status').addEventListener('change', function() { renderList(); });

  // Close modal on overlay click
  el('modal-overlay').addEventListener('click', function(e) {
    if (e.target === el('modal-overlay')) closeEditor();
  });

  // Keyboard: Escape to close modal / go back
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (el('modal-overlay').style.display !== 'none') {
        closeEditor();
      } else if (currentView === 'detail') {
        showList();
      } else if (currentView === 'manager') {
        showList();
      }
    }
  });
}

/* ── Entry Point ── */
tool.onReady(function(val, fields) {
  // Declare params
  tool.declareParams([
    {
      name: 'managerRole',
      label: 'Manager Role(s)',
      type: 'text',
      default: 'admin',
      severity: 'goodToHave',
      hint: 'Comma-separated user roles that can manage sections (add/edit/delete). Default: admin'
    },
    {
      name: 'sectionsTypeId',
      label: 'Sections Type ID',
      type: 'text',
      default: 'selfPacedSections-uniconbaseapps',
      severity: 'mandatory',
      hint: 'CMS object type for storing curriculum sections. Must be authorized in allowedObjectTypes.'
    }
  ]);

  // Report missing params
  var missing = [];
  var stype = tool.param('sectionsTypeId', '');
  if (!stype) {
    missing.push({
      name: 'sectionsTypeId',
      label: 'Sections Type ID',
      type: 'text',
      default: 'selfPacedSections-uniconbaseapps',
      hint: 'CMS object type for curriculum sections',
      reason: 'Cannot load or save sections without a type ID.',
      severity: 'mandatory'
    });
  }
  if (missing.length) {
    tool.reportMissingParams(missing, 'This tool requires configuration before it can display curriculum sections.');
  }

  // Use configured type
  SECTIONS_TYPE = tool.param('sectionsTypeId', 'selfPacedSections-uniconbaseapps');

  // Set up state
  loadProgress(val);
  checkManagerRole();
  bindEvents();

  if (tool.isReadOnly()) lockUI(true);

  // Show manager button if applicable
  if (isManager && !isReadOnly) {
    el('btn-manager-toggle').style.display = '';
    el('role-badge').textContent = 'Manager';
    el('role-badge').style.display = '';
  } else if (isManager) {
    el('role-badge').textContent = 'Manager';
    el('role-badge').style.display = '';
  } else {
    el('role-badge').style.display = 'none';
  }

  // Listeners
  tool.onValueChange(function(v) { loadProgress(v); renderCurrentView(); });
  tool.onReadonlyChange(function(ro) { lockUI(ro); renderCurrentView(); });
  tool.onUserChange(function() { checkManagerRole(); renderCurrentView(); });

  // Load sections from CMS, then render
  loadSections(function() {
    updateProgressBar();
    renderList();
    tool.resize();
  });
});
