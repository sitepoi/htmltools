/* ── Self-Paced Education by Section ──
   Curriculum delivery tool with Section → Lesson hierarchy.
   Sections group lessons; students must complete
   all previous lessons before accessing the next.
   Supports YouTube embeds, PDF embeds, and source links.
   Built for UniconHub CMS html-tool system.
────────────────────────────────────────── */

/* ── Helpers ── */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function el(id) { return document.getElementById(id); }

/* ── State ── */
var SECTIONS = [];            // Section groups from CMS (each contains lessons[])
var PROGRESS = {};            // { sectionId: { lessonId: { status, score, completedAt, quizAnswers } } }
var isReadOnly = false;
var isManager = false;
var currentView = 'sections'; // 'sections' | 'lessons' | 'lesson-detail' | 'manager'
var currentSectionId = null;
var currentLessonId = null;
var editingSectionId = null;  // For manager: which section group is being edited
var editingLessonId = null;   // For manager: which lesson is being edited (within editingSectionId)
var quizAnswers = {};
var quizSubmitted = false;
var editingLessons = [];      // Temp array for manager lesson editing
var editingQuizQuestions = []; // Temp array for quiz editor [{question, options:[], answer}]
var editingSourceLinks = [];   // Temp array for source editor [{label, url}]
var editingYoutubeUrls = [];   // Temp array for YouTube editor [url_string]
var editingPresentationPdfUrls = []; // Temp array for presentation PDFs [url_string]
var editingStudyDocPdfUrls = [];     // Temp array for study document PDFs [url_string]
var editingWorksheetPdfUrls = [];    // Temp array for worksheet PDFs [url_string]
var editingAnswerKeyPdfUrls = [];    // Temp array for answer key PDFs [url_string]
var editingQuizQuestionIdx = null; // Index being edited in quiz, null = adding new
var editingQuizQuestionSetIdx = null; // Which set to add to (0,1,2) when adding new question
var editingSourceLinkIdx = null;   // Index being edited in sources, null = adding new
var editingYoutubeIdx = null;      // Index being edited in YouTube list, null = adding new
var editingPdfIdx = null;          // Index being edited in current PDF list, null = adding new
var editingPdfType = null;         // Which PDF type is being edited: 'presentation'|'studyDoc'|'worksheet'|'answerKey'

/* ── Constants ── */
var SECTIONS_TYPE = 'selfPacedSections-uniconbaseapps';
var MIN_PASS_SCORE = 60; // Minimum % to pass a quiz; below = must retry after 30min study
var QUIZ_SETS = 3;       // Number of question sets per lesson
var QUIZ_PER_SET = 5;    // Questions per set
var STUDY_WAIT_MIN = 30; // Minutes to wait after failed attempt before retry

/* ═══════════════════════════════════════════
   DATA HELPERS
   ═══════════════════════════════════════════ */

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

function getSectionData(section) {
  return (section.productData && section.productData.data_categoriesBased) || {};
}

function getLessons(section) {
  var d = getSectionData(section);
  var lessons = d.lessons || [];
  return lessons.slice().sort(function(a, b) {
    return (a.order || 9999) - (b.order || 9999);
  });
}

/** Flatten all lessons across all sections in order. */
function getAllLessonsInOrder() {
  var result = [];
  var sortedSections = getSortedSections();
  for (var i = 0; i < sortedSections.length; i++) {
    var lessons = getLessons(sortedSections[i]);
    for (var j = 0; j < lessons.length; j++) {
      result.push({
        sectionId: sortedSections[i].id,
        sectionName: sortedSections[i].name || getSectionData(sortedSections[i]).title || '',
        lessonId: lessons[j].id,
        lesson: lessons[j]
      });
    }
  }
  return result;
}

function getLessonProgress(sectionId, lessonId) {
  var sp = PROGRESS[sectionId];
  if (!sp) return { status: 'not_started' };
  var lp = sp[lessonId];
  return lp || { status: 'not_started' };
}

function getOverallProgressPct() {
  var all = getAllLessonsInOrder();
  if (all.length === 0) return 0;
  var completed = 0;
  for (var i = 0; i < all.length; i++) {
    if (getLessonProgress(all[i].sectionId, all[i].lessonId).status === 'completed') completed++;
  }
  return Math.round((completed / all.length) * 100);
}

/** A lesson is accessible only if ALL previous lessons (across all sections) are completed. */
function isLessonAccessible(sectionId, lessonId) {
  // Manager can always access
  if (isManager) return true;
  var all = getAllLessonsInOrder();
  var targetIdx = -1;
  for (var i = 0; i < all.length; i++) {
    if (all[i].sectionId === sectionId && all[i].lessonId === lessonId) {
      targetIdx = i;
      break;
    }
  }
  if (targetIdx === -1) return false;
  if (targetIdx === 0) return true; // First lesson always accessible
  for (var i = 0; i < targetIdx; i++) {
    var prev = all[i];
    if (getLessonProgress(prev.sectionId, prev.lessonId).status !== 'completed') return false;
  }
  return true;
}

/** A section is accessible if its first lesson is accessible (or if it has no lessons). */
function isSectionAccessible(sectionId) {
  if (isManager) return true;
  var section = null;
  for (var i = 0; i < SECTIONS.length; i++) {
    if (SECTIONS[i].id === sectionId) { section = SECTIONS[i]; break; }
  }
  if (!section) return false;
  var lessons = getLessons(section);
  if (lessons.length === 0) return true; // Empty section is always accessible
  return isLessonAccessible(sectionId, lessons[0].id);
}

/** Get a section group's completion status summary. */
function getSectionProgressSummary(sectionId) {
  var section = null;
  for (var i = 0; i < SECTIONS.length; i++) {
    if (SECTIONS[i].id === sectionId) { section = SECTIONS[i]; break; }
  }
  if (!section) return { status: 'not_started', completed: 0, total: 0 };
  var lessons = getLessons(section);
  var completed = 0;
  for (var j = 0; j < lessons.length; j++) {
    if (getLessonProgress(sectionId, lessons[j].id).status === 'completed') completed++;
  }
  var total = lessons.length;
  var status = total === 0 ? 'not_started' :
    completed === total ? 'completed' :
    completed > 0 ? 'in_progress' : 'not_started';
  return { status: status, completed: completed, total: total };
}

/** Find a section object by ID. */
function findSection(sectionId) {
  for (var i = 0; i < SECTIONS.length; i++) {
    if (SECTIONS[i].id === sectionId) return SECTIONS[i];
  }
  return null;
}

/** Find a lesson object within a section. */
function findLesson(section, lessonId) {
  var lessons = getLessons(section);
  for (var i = 0; i < lessons.length; i++) {
    if (lessons[i].id === lessonId) return lessons[i];
  }
  return null;
}

/** Get the next lesson after the given one (returns {sectionId, lessonId} or null). */
function getNextLesson(sectionId, lessonId) {
  var all = getAllLessonsInOrder();
  for (var i = 0; i < all.length - 1; i++) {
    if (all[i].sectionId === sectionId && all[i].lessonId === lessonId) {
      return all[i + 1];
    }
  }
  return null;
}

/** Check if a lesson has any video */
function hasLessonVideo(les) {
  return les.youtubeUrls && Array.isArray(les.youtubeUrls) && les.youtubeUrls.length > 0;
}

/** Get the previous lesson before the given one (returns {sectionId, lessonId} or null). */
function getPrevLesson(sectionId, lessonId) {
  var all = getAllLessonsInOrder();
  for (var i = 1; i < all.length; i++) {
    if (all[i].sectionId === sectionId && all[i].lessonId === lessonId) {
      return all[i - 1];
    }
  }
  return null;
}

/* ── YouTube URL parsing ── */
function extractYouTubeId(url) {
  if (!url) return null;
  url = url.trim();
  // Strip HTML entities that might have snuck in
  url = url.replace(/&amp;/g, '&');
  // Try youtu.be/VIDEO_ID format
  var shortMatch = url.match(/(?:youtu\.be\/)([a-zA-Z0-9_-]{8,15})(?:[?\/\#]|$)/);
  if (shortMatch) return shortMatch[1];
  // Try /embed/VIDEO_ID format
  var embedMatch = url.match(/(?:embed\/)([a-zA-Z0-9_-]{8,15})(?:[?\/\#]|$)/);
  if (embedMatch) return embedMatch[1];
  // Try ?v=VIDEO_ID or &v=VIDEO_ID format (query parameter)
  var queryMatch = url.match(/(?:[?&]v=)([a-zA-Z0-9_-]{8,15})(?:[&?#]|$)/);
  if (queryMatch) return queryMatch[1];
  return null;
}

/* ── Persist progress ── */
function saveProgress() {
  tool.setValue({ progress: PROGRESS });
}

/* ── Sandbox-safe confirm dialog (replaces window.confirm in sandboxed iframes) ── */
var _confirmCallback = null;
function sandboxConfirm(message, onYes) {
  _confirmCallback = onYes;
  var msgEl = el('confirm-message');
  var overlayEl = el('confirm-overlay');
  if (msgEl) msgEl.textContent = message;
  if (overlayEl) overlayEl.style.display = '';
}

function hideConfirm() {
  var overlayEl = el('confirm-overlay');
  if (overlayEl) overlayEl.style.display = 'none';
  _confirmCallback = null;
}

/* ── Sub-modal backdrop (lesson editor & quiz editor popups) ── */
function showSubModal(panelId) {
  var panel = el(panelId);
  var backdrop = el('sub-modal-backdrop');
  if (panel) panel.style.display = '';
  if (backdrop) backdrop.classList.add('active');
}
function hideSubModal(panelId) {
  var panel = el(panelId);
  var backdrop = el('sub-modal-backdrop');
  if (panel) panel.style.display = 'none';
  if (backdrop) backdrop.classList.remove('active');
}

/* ═══════════════════════════════════════════
   RENDER: SECTION GROUPS LIST
   ═══════════════════════════════════════════ */
function renderSections() {
  var grid = el('section-group-grid');
  var empty = el('sections-empty');
  var searchTerm = (el('search-input').value || '').toLowerCase();
  var filterStatus = el('filter-status').value;

  var sorted = getSortedSections();
  var filtered = sorted.filter(function(s) {
    var d = getSectionData(s);
    var name = (s.name || d.title || '').toLowerCase();
    if (searchTerm && name.indexOf(searchTerm) === -1) return false;
    if (filterStatus !== 'all') {
      var summary = getSectionProgressSummary(s.id);
      if (summary.status !== filterStatus) return false;
    }
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
    grid.innerHTML = filtered.map(function(s) {
      var d = getSectionData(s);
      var summary = getSectionProgressSummary(s.id);
      var accessible = isSectionAccessible(s.id);
      var locked = !accessible;
      var statusLabel = { not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed' }[summary.status] || 'Not Started';
      var statusClass = 'status-' + (locked ? 'locked' : summary.status);
      var lessonsCount = summary.total;
      var lockHtml = locked ? '<div class="section-group-card-lock">🔒 Complete previous sections first</div>' : '';

      var idx = sorted.indexOf(s) + 1;
      return '<div class="section-group-card' + (locked ? ' locked' : '') + '"' +
        (locked ? '' : ' onclick="openSection(\'' + esc(s.id) + '\')"') + ' data-id="' + esc(s.id) + '">' +
        '<div class="section-group-card-header">' +
          '<span class="section-group-card-num">Section ' + idx + '</span>' +
          '<span class="section-group-card-status ' + statusClass + '">' + (locked ? '🔒 Locked' : statusLabel) + '</span>' +
        '</div>' +
        '<div class="section-group-card-title">' + esc(s.name || d.title || 'Untitled') + '</div>' +
        '<div class="section-group-card-meta">' +
          '<span>📚 ' + lessonsCount + ' lesson' + (lessonsCount !== 1 ? 's' : '') + '</span>' +
          '<span>✅ ' + summary.completed + '/' + summary.total + ' done</span>' +
        '</div>' +
        lockHtml +
      '</div>';
    }).join('');
  }

  updateProgressBar();
}

/* ═══════════════════════════════════════════
   RENDER: LESSONS LIST (within a section)
   ═══════════════════════════════════════════ */
function renderLessons() {
  var section = findSection(currentSectionId);
  if (!section) { showSections(); return; }

  var d = getSectionData(section);
  var lessons = getLessons(section);
  var summary = getSectionProgressSummary(section.id);
  var accessible = isSectionAccessible(section.id);

  el('section-info-title').textContent = '📁 ' + (section.name || d.title || 'Section');
  el('section-info-progress').textContent = summary.completed + ' of ' + summary.total + ' lessons completed';

  var list = el('lesson-list');
  var empty = el('lessons-empty');

  if (lessons.length === 0) {
    list.innerHTML = '';
    empty.style.display = '';
  } else {
    empty.style.display = 'none';
    list.innerHTML = lessons.map(function(les, idx) {
      var prog = getLessonProgress(section.id, les.id);
      var lock = !isLessonAccessible(section.id, les.id);
      var iconClass = lock ? 'locked' : prog.status;
      var iconMap = { completed: '✅', in_progress: '📖', not_started: '📌', locked: '🔒' };
      var icon = iconMap[lock ? 'locked' : prog.status] || '📌';
      var badgeMap = { completed: 'Completed', in_progress: 'In Progress', not_started: 'Not Started', locked: 'Locked' };
      var badgeLabel = badgeMap[lock ? 'locked' : prog.status] || 'Not Started';
      var badgeClass = 'status-' + (lock ? 'locked' : prog.status);
      var scoreHtml = '';
      if (typeof prog.score === 'number') {
        scoreHtml = ' · Score: ' + prog.score + '%';
      }

      return '<div class="lesson-card' + (lock ? ' locked' : '') + '"' +
        (lock ? '' : ' onclick="openLesson(\'' + esc(section.id) + '\',\'' + esc(les.id) + '\')"') + '>' +
        '<div class="lesson-card-icon ' + iconClass + '">' + icon + '</div>' +
        '<div class="lesson-card-body">' +
          '<div class="lesson-card-title">' + (idx + 1) + '. ' + esc(les.title || 'Untitled Lesson') + '</div>' +
          '<div class="lesson-card-meta">' +
            '<span>⏱️ ' + (les.estimatedMinutes || '—') + ' min</span>' +
            (hasLessonVideo(les) ? '<span>🎬 Video</span>' : '') +
            (les.presentationPdfUrls && les.presentationPdfUrls.length ? '<span>📊 Pres.</span>' : '') +
            (les.studyDocPdfUrls && les.studyDocPdfUrls.length ? '<span>📖 Study</span>' : '') +
            (les.worksheetPdfUrls && les.worksheetPdfUrls.length ? '<span>📝 WS</span>' : '') +
            (les.quiz && les.quiz.length ? '<span>📝 Quiz</span>' : '') +
            scoreHtml +
          '</div>' +
        '</div>' +
        '<span class="lesson-card-badge ' + badgeClass + '">' + badgeLabel + '</span>' +
      '</div>';
    }).join('');
  }

  updateProgressBar();
}

/* ═══════════════════════════════════════════
   RENDER: LESSON DETAIL (Step-by-Step Study Flow)
   ═══════════════════════════════════════════ */
function renderLessonDetail() {
  var section = findSection(currentSectionId);
  if (!section) { showSections(); return; }
  var lesson = findLesson(section, currentLessonId);
  if (!lesson) { openSection(currentSectionId); return; }

  var d = getSectionData(section);
  var prog = getLessonProgress(section.id, lesson.id);

  // Breadcrumb
  el('detail-breadcrumb').innerHTML =
    '<span onclick="showSections()">📚 All Sections</span> › ' +
    '<span onclick="openSection(\'' + esc(section.id) + '\')">' + esc(section.name || d.title || 'Section') + '</span> › ' +
    '<span>' + esc(lesson.title || 'Lesson') + '</span>';

  el('detail-title').textContent = lesson.title || 'Untitled Lesson';
  el('detail-estimated').textContent = '⏱️ Estimated: ' + (lesson.estimatedMinutes || '—') + ' min';

  // Status badge
  var badge = el('detail-badge');
  var statusLabels = { not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed' };
  var statusClasses = { not_started: 'status-not_started', in_progress: 'status-in_progress', completed: 'status-completed' };
  badge.textContent = statusLabels[prog.status] || 'Not Started';
  badge.className = 'detail-badge ' + (statusClasses[prog.status] || 'status-not_started');
  el('detail-status-label').textContent = typeof prog.score === 'number' ? ' | Score: ' + prog.score + '%' : '';

  // ── Build step-by-step study flow ──
  var youtubeUrls = normalizePdfArray(lesson.youtubeUrls);

  // PDF arrays
  var presentationPdfs = normalizePdfArray(lesson.presentationPdfUrls);
  var studyDocPdfs = normalizePdfArray(lesson.studyDocPdfUrls);
  var worksheetPdfs = normalizePdfArray(lesson.worksheetPdfUrls);
  var answerKeyPdfs = normalizePdfArray(lesson.answerKeyPdfUrls);
  var content = lesson.content || '';

  // Quiz data
  var quizData = lesson.quiz;
  if (quizData && typeof quizData === 'string') {
    try { quizData = JSON.parse(quizData); } catch(e) { quizData = null; }
  }
  var hasQuiz = quizData && Array.isArray(quizData) && quizData.length > 0;

  // Build steps array
  var steps = [];
  var stepNum = 0;

  // Step: Videos
  if (youtubeUrls && Array.isArray(youtubeUrls) && youtubeUrls.length > 0) {
    stepNum++;
    var videoIds = [];
    for (var vi = 0; vi < youtubeUrls.length; vi++) {
      var vid = extractYouTubeId(youtubeUrls[vi]);
      if (vid) videoIds.push(vid);
    }
    steps.push({
      num: stepNum,
      icon: '🎬',
      title: 'Watch Video' + (videoIds.length > 1 ? 's' : ''),
      type: 'video',
      videoIds: videoIds,
      hasContent: videoIds.length > 0
    });
  }

  // Step: Presentation
  if (presentationPdfs.length > 0) {
    stepNum++;
    steps.push({
      num: stepNum, icon: '📊', title: 'Review Presentation' + (presentationPdfs.length > 1 ? 's' : ''),
      type: 'pdfs', pdfUrls: presentationPdfs, label: 'Presentation Slide',
      hasContent: true
    });
  }

  // Step: Study Document
  if (studyDocPdfs.length > 0) {
    stepNum++;
    steps.push({
      num: stepNum, icon: '📖', title: 'Read Study Document' + (studyDocPdfs.length > 1 ? 's' : ''),
      type: 'pdfs', pdfUrls: studyDocPdfs, label: 'Study Material',
      hasContent: true
    });
  }

  // Step: Worksheet
  if (worksheetPdfs.length > 0) {
    stepNum++;
    steps.push({
      num: stepNum, icon: '📝', title: 'Complete Worksheet' + (worksheetPdfs.length > 1 ? 's' : ''),
      type: 'pdfs', pdfUrls: worksheetPdfs, label: 'Worksheet',
      hasContent: true
    });
  }

  // Step: Answer Key
  if (answerKeyPdfs.length > 0) {
    stepNum++;
    steps.push({
      num: stepNum, icon: '🔑', title: 'Check Answer Key' + (answerKeyPdfs.length > 1 ? 's' : ''),
      type: 'pdfs', pdfUrls: answerKeyPdfs, label: 'Answer Key',
      hasContent: true
    });
  }

  // Step: Lesson Content (HTML)
  if (content && content !== '<br>' && content !== '<br>') {
    stepNum++;
    steps.push({
      num: stepNum, icon: '📄', title: 'Lesson Notes',
      type: 'html', html: content,
      hasContent: true
    });
  }

  // Step: Quiz (always last)
  if (hasQuiz) {
    stepNum++;
    steps.push({
      num: stepNum, icon: '📝', title: 'Knowledge Check',
      type: 'quiz', quizData: quizData,
      hasContent: true
    });
  }

  // ── Render the flow ──
  var flowEl = el('study-flow');
  var html = '';

  if (steps.length === 0) {
    html = '<div class="study-flow-empty"><div class="empty-icon">📖</div><div class="empty-title">No study materials yet</div><div class="empty-desc">This lesson has no content. A manager needs to add materials.</div></div>';
  } else {
    html = '<div class="study-steps">';
    for (var si = 0; si < steps.length; si++) {
      var step = steps[si];
      var isLast = si === steps.length - 1;
      var stepId = 'study-step-' + si;
      html += '<div class="study-step" id="' + stepId + '">';
      // Step header
      html += '<div class="study-step-header" onclick="toggleStudyStep(\'' + stepId + '\')">';
      html += '<div class="study-step-num">' + step.num + '</div>';
      html += '<div class="study-step-icon">' + step.icon + '</div>';
      html += '<div class="study-step-title">' + esc(step.title) + '</div>';
      html += '<div class="study-step-toggle">▼</div>';
      html += '</div>';
      // Step body
      html += '<div class="study-step-body">';

      if (step.type === 'video') {
        for (var vj = 0; vj < step.videoIds.length; vj++) {
          html += '<div class="study-embed">';
          if (step.videoIds.length > 1) {
            html += '<div class="study-embed-label">Video ' + (vj + 1) + ' of ' + step.videoIds.length + '</div>';
          }
          html += '<div class="embed-container youtube-container">';
          html += '<iframe src="https://www.youtube.com/embed/' + step.videoIds[vj] + '?modestbranding=1&rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
          html += '</div></div>';
        }
      } else if (step.type === 'pdf') {
        html += '<div class="study-embed">';
        html += '<div class="embed-container pdf-container">';
        html += '<iframe src="https://docs.google.com/viewer?url=' + encodeURIComponent(step.pdfUrl) + '&embedded=true" frameborder="0"></iframe>';
        html += '</div>';
        html += '<a class="embed-download-link" href="' + esc(step.pdfUrl) + '" target="_blank" rel="noopener">📎 Open ' + esc(step.label) + ' in new tab</a>';
        html += '</div>';
      } else if (step.type === 'pdfs') {
        for (var pj = 0; pj < step.pdfUrls.length; pj++) {
          html += '<div class="study-embed">';
          if (step.pdfUrls.length > 1) {
            html += '<div class="study-embed-label">' + esc(step.label) + ' ' + (pj + 1) + ' of ' + step.pdfUrls.length + '</div>';
          }
          html += '<div class="embed-container pdf-container">';
          html += '<iframe src="https://docs.google.com/viewer?url=' + encodeURIComponent(step.pdfUrls[pj]) + '&embedded=true" frameborder="0"></iframe>';
          html += '</div>';
          html += '<a class="embed-download-link" href="' + esc(step.pdfUrls[pj]) + '" target="_blank" rel="noopener">📎 Open ' + esc(step.label) + ' in new tab</a>';
          html += '</div>';
        }
      } else if (step.type === 'html') {
        html += '<div class="detail-content">' + step.html + '</div>';
      } else if (step.type === 'quiz') {
        html += renderQuizInFlow(step.quizData, prog, currentSectionId, currentLessonId);
      }

      html += '</div>'; // study-step-body
      html += '</div>'; // study-step
    }
    html += '</div>'; // study-steps
  }

  flowEl.innerHTML = html;

  // Auto-expand the appropriate step
  setTimeout(function() {
    var allSteps = flowEl.querySelectorAll('.study-step');
    var expanded = false;
    // If completed, expand quiz step to show results
    if (prog.status === 'completed' && hasQuiz) {
      for (var es = 0; es < allSteps.length; es++) {
        var stepType = steps[es] ? steps[es].type : '';
        if (stepType === 'quiz') { allSteps[es].classList.add('expanded'); expanded = true; break; }
      }
    }
    // Otherwise expand first step
    if (!expanded && allSteps.length > 0) {
      allSteps[0].classList.add('expanded');
    }
  }, 50);

  // Source links (below the flow)
  var sourcesArea = el('source-links-area');
  var sourcesList = el('source-links-list');
  var sourceUrls = lesson.sourceUrls;
  if (sourceUrls && typeof sourceUrls === 'string') {
    try { sourceUrls = JSON.parse(sourceUrls); } catch(e) { sourceUrls = null; }
  }
  if (sourceUrls && Array.isArray(sourceUrls) && sourceUrls.length > 0) {
    sourcesArea.style.display = '';
    sourcesList.innerHTML = sourceUrls.map(function(s) {
      return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">🔗 ' + esc(s.label || s.url) + '</a></li>';
    }).join('');
  } else {
    sourcesArea.style.display = 'none';
  }

  // Navigation buttons
  var prevLesson = getPrevLesson(section.id, lesson.id);
  var nextLesson = getNextLesson(section.id, lesson.id);
  el('btn-prev-lesson').disabled = !prevLesson;
  el('btn-next-lesson').disabled = !nextLesson ||
    (nextLesson && !isLessonAccessible(nextLesson.sectionId, nextLesson.lessonId));

  // Mark complete / in-progress
  if (prog.status === 'completed') {
    el('btn-mark-complete').style.display = 'none';
    el('btn-mark-inprogress').style.display = '';
  } else {
    el('btn-mark-complete').style.display = '';
    el('btn-mark-inprogress').style.display = 'none';
  }

  tool.resize();
}

/** Toggle expand/collapse of a study step */
function toggleStudyStep(stepId) {
  var step = el(stepId);
  if (!step) return;
  step.classList.toggle('expanded');
  tool.resize();
}

/** Render the quiz inside a study flow step */
function renderQuizInFlow(quizData, prog, sectionId, lessonId) {
  var currentSet = typeof prog.currentSet === 'number' ? prog.currentSet : 0;
  if (currentSet >= QUIZ_SETS) currentSet = QUIZ_SETS - 1;
  var setStart = currentSet * QUIZ_PER_SET;
  var setEnd = Math.min(setStart + QUIZ_PER_SET, quizData.length);
  var activeQuestions = quizData.slice(setStart, setEnd);

  var isStudying = prog.status === 'studying';
  var studyUntil = prog.studyUntil ? new Date(prog.studyUntil) : null;
  var studyRemaining = studyUntil && studyUntil > new Date() ? Math.ceil((studyUntil - new Date()) / 60000) : 0;

  if (isStudying && studyRemaining <= 0 && studyUntil) {
    isStudying = false;
    if (!PROGRESS[sectionId]) PROGRESS[sectionId] = {};
    PROGRESS[sectionId][lessonId].status = 'in_progress';
    prog.status = 'in_progress';
    saveProgress();
  }

  var wasSubmitted = prog.status === 'completed' || (prog.quizAnswers && Object.keys(prog.quizAnswers).length > 0);
  var isCompleted = prog.status === 'completed';

  quizSubmitted = wasSubmitted;
  quizAnswers = prog.quizAnswers ? JSON.parse(JSON.stringify(prog.quizAnswers)) : {};

  var html = '';

  if (isStudying && studyRemaining > 0) {
    html += '<div class="quiz-study-timer">' +
      '<div class="quiz-study-icon">📚</div>' +
      '<div class="quiz-study-title">Study Time</div>' +
      '<div class="quiz-study-desc">Review the materials above for at least <strong>' + STUDY_WAIT_MIN + ' minutes</strong> before your next attempt.</div>' +
      '<div class="quiz-study-countdown">⏳ ~' + studyRemaining + ' min remaining</div>' +
      '<div class="quiz-study-attempts">Best score so far: ' + (typeof prog.score === 'number' ? prog.score + '%' : '—') + '</div>' +
      '</div>';
    setTimeout(function() { renderLessonDetail(); }, 30000);
  } else if (activeQuestions.length > 0 && !isCompleted) {
    html += '<div class="quiz-set-label">Question Set ' + (currentSet + 1) + ' of ' + QUIZ_SETS + '</div>';
    html += activeQuestions.map(function(q, qi) {
      var opts = (q.options || []).map(function(opt, oi) {
        var selected = quizAnswers[qi] === oi;
        var correctClass = '';
        if (wasSubmitted) {
          if (oi === q.answer) correctClass = ' correct';
          else if (selected && oi !== q.answer) correctClass = ' incorrect';
        }
        return '<label class="quiz-option' + (selected ? ' selected' : '') + correctClass + '">' +
          '<input type="radio" name="q' + qi + '" value="' + oi + '" ' +
          (selected ? 'checked' : '') + ' ' + (wasSubmitted ? 'disabled' : '') + '>' +
          '<span>' + esc(opt) + '</span></label>';
      }).join('');
      var expHtml = '';
      if (isCompleted && q.explanation_correct) {
        expHtml += '<div class="quiz-explanation correct">✅ ' + esc(q.explanation_correct) + '</div>';
      }
      if (wasSubmitted && q.explanations_incorrect && Array.isArray(q.explanations_incorrect)) {
        for (var ei = 0; ei < q.explanations_incorrect.length; ei++) {
          if (q.explanations_incorrect[ei] && ei !== q.answer) {
            expHtml += '<div class="quiz-explanation incorrect">❌ Option ' + (ei + 1) + ': ' + esc(q.explanations_incorrect[ei]) + '</div>';
          }
        }
      }
      return '<div class="quiz-question"><div class="quiz-q-text">' + (qi + 1) + '. ' + esc(q.question) +
        (q.difficulty ? ' <span class="quiz-difficulty difficulty-' + q.difficulty + '">' + q.difficulty + '</span>' : '') +
        '</div>' + opts + expHtml + '</div>';
    }).join('');

    if (!wasSubmitted) {
      html += '<div class="quiz-actions"><button class="btn btn-primary" id="btn-submit-quiz-inline">Submit Answers</button></div>';
      html += '<div class="quiz-result" id="quiz-result-inline" style="display:none"></div>';
    } else if (!isCompleted && !isStudying) {
      var score = calcQuizScore(activeQuestions, prog.quizAnswers);
      var passed = score >= MIN_PASS_SCORE;
      html += '<div class="quiz-result ' + (passed ? 'pass' : 'fail') + '" style="display:block">' +
        'Quiz ' + (passed ? 'passed' : 'failed') + ' — Score: ' + score + '%' + (passed ? '' : ' (need ' + MIN_PASS_SCORE + '%)') +
        '</div>';
      if (!passed && currentSet < QUIZ_SETS - 1) {
        html += '<div class="quiz-actions"><button class="btn btn-outline" id="btn-retry-quiz-inline">🔄 Retry Quiz</button></div>';
      }
    }
  } else if (isCompleted) {
    html += '<div class="quiz-set-label">✅ Quiz Completed — All Sets Passed</div>';
    html += quizData.map(function(q, qi) {
      var myAnswer = prog.quizAnswers && typeof prog.quizAnswers[qi] === 'number' ? prog.quizAnswers[qi] : -1;
      var correctAnswer = q.answer;
      var opts = (q.options || []).map(function(opt, oi) {
        var isCorrect = oi === correctAnswer;
        var isMyAnswer = oi === myAnswer;
        var cls = isCorrect ? ' correct' : (isMyAnswer && !isCorrect ? ' incorrect' : '');
        return '<label class="quiz-option' + cls + '" style="cursor:default">' +
          '<input type="radio" disabled ' + (isMyAnswer ? 'checked' : '') + '>' +
          '<span>' + esc(opt) + (isCorrect ? ' ✓' : '') + '</span></label>';
      }).join('');
      var expHtml = q.explanation_correct ? '<div class="quiz-explanation correct">✅ ' + esc(q.explanation_correct) + '</div>' : '';
      return '<div class="quiz-question"><div class="quiz-q-text">' + (qi + 1) + '. ' + esc(q.question) +
        (q.difficulty ? ' <span class="quiz-difficulty difficulty-' + q.difficulty + '">' + q.difficulty + '</span>' : '') +
        '</div>' + opts + expHtml + '</div>';
    }).join('');
    html += '<div class="quiz-result pass" style="display:block">✅ Quiz passed! Final score: ' + (typeof prog.score === 'number' ? prog.score + '%' : '—') + '</div>';
  }

  // Bind quiz interactions after render
  setTimeout(function() {
    var submitBtn = el('btn-submit-quiz-inline');
    var retryBtn = el('btn-retry-quiz-inline');
    if (submitBtn) {
      submitBtn.addEventListener('click', function() {
        var allAnswered = true;
        for (var qi = 0; qi < activeQuestions.length; qi++) {
          if (typeof quizAnswers[qi] !== 'number') { allAnswered = false; break; }
        }
        if (!allAnswered) { tool.notify('Please answer all questions before submitting.', 'warning'); return; }
        submitQuiz(quizData);
      });
    }
    if (retryBtn) {
      retryBtn.addEventListener('click', function() { retryQuiz(); });
    }
    // Bind radio clicks
    if (!wasSubmitted) {
      var flowEl = el('study-flow');
      if (!flowEl) return;
      var radios = flowEl.querySelectorAll('input[type="radio"]');
      for (var r = 0; r < radios.length; r++) {
        radios[r].addEventListener('change', function() {
          var qi = parseInt(this.name.replace('q', ''));
          quizAnswers[qi] = parseInt(this.value);
          var allOpts = flowEl.querySelectorAll('.quiz-option');
          for (var ao = 0; ao < allOpts.length; ao++) { allOpts[ao].classList.remove('selected'); }
          var parentLabel = this.closest('.quiz-option');
          if (parentLabel) parentLabel.classList.add('selected');
        });
      }
    }
  }, 100);

  return html;
}

function calcQuizScore(quizData, answers) {
  var correct = 0;
  for (var i = 0; i < quizData.length; i++) {
    if (answers[i] === quizData[i].answer) correct++;
  }
  return quizData.length > 0 ? Math.round((correct / quizData.length) * 100) : 0;
}

/* ═══════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════ */

function showSections() {
  currentView = 'sections';
  currentSectionId = null;
  currentLessonId = null;
  el('view-sections').style.display = '';
  el('view-lessons').style.display = 'none';
  el('view-lesson-detail').style.display = 'none';
  el('view-manager').style.display = 'none';
  el('btn-back').style.display = 'none';
  el('app-title').textContent = '📚 Self-Paced Learning';
  el('search-input').value = '';
  el('filter-status').value = 'all';
  renderSections();
  tool.resize();
}

function openSection(sectionId) {
  // Check accessibility
  if (!isSectionAccessible(sectionId) && !isManager) {
    tool.notify('🔒 You must complete all previous sections first.', 'warning');
    return;
  }
  currentView = 'lessons';
  currentSectionId = sectionId;
  currentLessonId = null;
  el('view-sections').style.display = 'none';
  el('view-lessons').style.display = '';
  el('view-lesson-detail').style.display = 'none';
  el('view-manager').style.display = 'none';
  el('btn-back').style.display = '';
  var section = findSection(sectionId);
  var d = getSectionData(section);
  el('app-title').textContent = '📁 ' + (section ? (section.name || d.title || 'Section') : 'Section');
  renderLessons();
  window.scrollTo(0, 0);
  tool.resize();
}

function openLesson(sectionId, lessonId) {
  if (!isLessonAccessible(sectionId, lessonId) && !isManager) {
    tool.notify('🔒 You must complete all previous lessons first.', 'warning');
    return;
  }
  currentView = 'lesson-detail';
  currentSectionId = sectionId;
  currentLessonId = lessonId;
  el('view-sections').style.display = 'none';
  el('view-lessons').style.display = 'none';
  el('view-lesson-detail').style.display = '';
  el('view-manager').style.display = 'none';
  el('btn-back').style.display = '';
  var section = findSection(sectionId);
  var lesson = section ? findLesson(section, lessonId) : null;
  el('app-title').textContent = '📖 ' + (lesson ? (lesson.title || 'Lesson') : 'Lesson');
  renderLessonDetail();
  window.scrollTo(0, 0);
  tool.resize();
}

function navigateLesson(direction) {
  var all = getAllLessonsInOrder();
  var idx = -1;
  for (var i = 0; i < all.length; i++) {
    if (all[i].sectionId === currentSectionId && all[i].lessonId === currentLessonId) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return;
  var newIdx = idx + direction;
  if (newIdx >= 0 && newIdx < all.length) {
    var target = all[newIdx];
    openLesson(target.sectionId, target.lessonId);
  }
}

/* ── Back button handler ── */
function handleBack() {
  if (currentView === 'lesson-detail') {
    openSection(currentSectionId);
  } else if (currentView === 'lessons') {
    showSections();
  } else if (currentView === 'manager') {
    showSections();
  }
}

/* ═══════════════════════════════════════════
   PROGRESS ACTIONS
   ═══════════════════════════════════════════ */

function markComplete() {
  if (!currentSectionId || !currentLessonId) return;

  var section = findSection(currentSectionId);
  if (!section) return;
  var lesson = findLesson(section, currentLessonId);
  if (!lesson) return;

  var quizData = lesson.quiz;
  if (quizData && typeof quizData === 'string') {
    try { quizData = JSON.parse(quizData); } catch(e) { quizData = null; }
  }
  var hasQuiz = quizData && Array.isArray(quizData) && quizData.length > 0;

  // If quiz exists and was previously submitted but FAILED, require retry
  if (hasQuiz && quizSubmitted) {
    var prog = getLessonProgress(currentSectionId, currentLessonId);
    if (prog.status !== 'completed' && typeof prog.score === 'number' && prog.score < MIN_PASS_SCORE) {
      tool.notify('You must retry and pass the quiz (≥' + MIN_PASS_SCORE + '%) before completing this lesson.', 'warning');
      return;
    }
  }

  if (hasQuiz && !quizSubmitted) {
    var allAnswered = true;
    for (var qi = 0; qi < quizData.length; qi++) {
      if (typeof quizAnswers[qi] !== 'number') { allAnswered = false; break; }
    }
    if (!allAnswered) {
      tool.notify('Please answer all quiz questions before marking complete.', 'warning');
      return;
    }
    submitQuiz(quizData);
    return;
  }

  // No quiz — allow direct completion
  if (!PROGRESS[currentSectionId]) PROGRESS[currentSectionId] = {};
  PROGRESS[currentSectionId][currentLessonId] = {
    status: 'completed',
    score: null,
    completedAt: new Date().toISOString(),
    quizAttempts: [],
    quizAnswers: {}
  };
  saveProgress();
  renderLessonDetail();
  updateProgressBar();
  tool.notify('Lesson marked as complete! ✅', 'success');

  // Auto-advance only if next lesson is accessible
  var next = getNextLesson(currentSectionId, currentLessonId);
  if (next && isLessonAccessible(next.sectionId, next.lessonId)) {
    setTimeout(function() { openLesson(next.sectionId, next.lessonId); }, 800);
  } else {
    setTimeout(function() { openSection(currentSectionId); }, 800);
  }
}

function markInProgress() {
  if (!currentSectionId || !currentLessonId) return;
  if (!PROGRESS[currentSectionId]) PROGRESS[currentSectionId] = {};
  PROGRESS[currentSectionId][currentLessonId] = { status: 'in_progress' };
  saveProgress();
  renderLessonDetail();
  updateProgressBar();
  tool.notify('Lesson moved back to In Progress.', 'info');
}

function submitQuiz(quizData) {
  // Score only the current active set (5 questions), not all 15
  var prog = getLessonProgress(currentSectionId, currentLessonId);
  var currentSet = typeof prog.currentSet === 'number' ? prog.currentSet : 0;
  if (currentSet >= QUIZ_SETS) currentSet = QUIZ_SETS - 1;
  var setStart = currentSet * QUIZ_PER_SET;
  var setEnd = Math.min(setStart + QUIZ_PER_SET, quizData.length);
  var activeQuestions = quizData.slice(setStart, setEnd);
  var score = calcQuizScore(activeQuestions, quizAnswers);
  var passed = score >= MIN_PASS_SCORE;
  var attempts = (prog.quizAttempts && Array.isArray(prog.quizAttempts)) ? prog.quizAttempts.slice() : [];
  var currentSet = typeof prog.currentSet === 'number' ? prog.currentSet : 0;

  // Record this attempt
  attempts.push({ setIndex: currentSet, score: score, timestamp: new Date().toISOString() });

  if (!PROGRESS[currentSectionId]) PROGRESS[currentSectionId] = {};

  if (passed) {
    PROGRESS[currentSectionId][currentLessonId] = {
      status: 'completed',
      score: score,
      completedAt: new Date().toISOString(),
      quizAttempts: attempts,
      currentSet: 0,
      studyUntil: null,
      quizAnswers: JSON.parse(JSON.stringify(quizAnswers))
    };
  } else {
    var nextSet = currentSet + 1;
    // Loop back to set 0 after exhausting all sets — student must keep studying until they pass
    if (nextSet >= QUIZ_SETS) nextSet = 0;
    var studyUntil = new Date(Date.now() + STUDY_WAIT_MIN * 60 * 1000).toISOString();
    PROGRESS[currentSectionId][currentLessonId] = {
      status: 'studying',
      score: score,
      completedAt: null,
      quizAttempts: attempts,
      currentSet: nextSet,
      studyUntil: studyUntil,
      quizAnswers: JSON.parse(JSON.stringify(quizAnswers))
    };
  }

  quizSubmitted = true;
  saveProgress();
  renderLessonDetail();
  updateProgressBar();

  if (passed) {
    tool.notify('Quiz passed! Score: ' + score + '% ✅', 'success');
    var next = getNextLesson(currentSectionId, currentLessonId);
    if (next && isLessonAccessible(next.sectionId, next.lessonId)) {
      setTimeout(function() { openLesson(next.sectionId, next.lessonId); }, 1200);
    } else {
      setTimeout(function() { openSection(currentSectionId); }, 1200);
    }
  } else {
    tool.notify('Score: ' + score + '%. Study for ' + STUDY_WAIT_MIN + ' minutes, then try again. Keep going — you will pass!', 'warning');
  }
}

function retryQuiz() {
  var prog = getLessonProgress(currentSectionId, currentLessonId);
  var studyUntil = prog.studyUntil ? new Date(prog.studyUntil) : null;
  if (studyUntil && studyUntil > new Date()) {
    var remaining = Math.ceil((studyUntil - new Date()) / 60000);
    tool.notify('Please study for ' + remaining + ' more minute(s) before retrying.', 'warning');
    return;
  }
  quizSubmitted = false;
  quizAnswers = {};
  // Clear only quiz answers, keep progression data
  if (PROGRESS[currentSectionId] && PROGRESS[currentSectionId][currentLessonId]) {
    PROGRESS[currentSectionId][currentLessonId].quizAnswers = {};
    PROGRESS[currentSectionId][currentLessonId].status = 'in_progress';
    PROGRESS[currentSectionId][currentLessonId].studyUntil = null;
  }
  saveProgress();
  renderLessonDetail();
  updateProgressBar();
  tool.notify('Quiz ready. Good luck!', 'info');
}

/* ═══════════════════════════════════════════
   AI: GENERATE QUIZ FROM PDF
   ═══════════════════════════════════════════ */

/** Update all Generate Quiz buttons (there are two: Documents tab + Questions tab) */
function updateGenerateButtons(opts) {
  var btns = document.querySelectorAll('.btn-generate-quiz');
  for (var i = 0; i < btns.length; i++) {
    if (opts.disabled !== undefined) btns[i].disabled = opts.disabled;
    if (opts.text !== undefined) btns[i].textContent = opts.text;
  }
}

/** Show/hide the "no PDFs" info on both tabs */
function showGenerateInfo(show) {
  var info1 = el('generate-quiz-info');
  var info2 = el('generate-quiz-info-2');
  if (info1) info1.style.display = show ? '' : 'none';
  if (info2) info2.style.display = show ? '' : 'none';
  if (show) setTimeout(function() { showGenerateInfo(false); }, 4000);
}

function generateQuizFromPdf() {
  // Collect all PDF URLs from presentation, study docs, and worksheets
  var allUrls = [];
  allUrls = allUrls.concat(editingPresentationPdfUrls);
  allUrls = allUrls.concat(editingStudyDocPdfUrls);
  allUrls = allUrls.concat(editingWorksheetPdfUrls);
  allUrls = allUrls.filter(function(u) { return u && u.trim(); });

  if (allUrls.length === 0) {
    showGenerateInfo(true);
    tool.notify('No PDFs added yet. Add PDFs to Presentation, Study Documents, or Worksheets first.', 'warning');
    return;
  }

  updateGenerateButtons({ disabled: true, text: '⏳ Reading ' + allUrls.length + ' PDF(s)...' });
  tool.notify('Reading ' + allUrls.length + ' PDF(s)...', 'info');

  // Step 1: Read ALL PDFs and combine text
  var combinedText = '';
  var remaining = allUrls.length;

  function readNext(idx) {
    if (idx >= allUrls.length) {
      // All PDFs read — now generate quiz
      if (!combinedText || combinedText.length < 50) {
        updateGenerateButtons({ disabled: false, text: '🤖 Generate Quiz Questions from PDFs' });
        tool.notify('Could not extract enough text from the PDFs. Try different files.', 'warning');
        return;
      }
      generateWithAI(combinedText);
      return;
    }

    tool.requestFileContent(allUrls[idx], function(err, fileResult) {
      remaining--;
      if (!err && fileResult) {
        var text = '';
        if (typeof fileResult === 'string') text = fileResult;
        else if (fileResult.text) text = fileResult.text;
        else if (fileResult.content) text = fileResult.content;
        if (text && text.length > 50) {
          combinedText += '\n\n--- Document ' + (idx + 1) + ' ---\n\n' + text;
        }
      }
      if (remaining === 0) {
        if (!combinedText || combinedText.length < 50) {
          updateGenerateButtons({ disabled: false, text: '🤖 Generate Quiz Questions from PDFs' });
          tool.notify('Could not extract enough text from the PDFs. Try different files.', 'warning');
          return;
        }
        generateWithAI(combinedText);
      }
    });
  }

  function generateWithAI(text) {
    var maxLen = 12000;
    if (text.length > maxLen) {
      text = text.substring(0, maxLen) + '\n\n[... content truncated ...]';
    }
    updateGenerateButtons({ text: '⏳ AI generating...' });

    var prompt = 'You are an expert quiz generator. Generate EXACTLY 15 multiple-choice questions based on the documents below. Return ONLY a JSON array — no markdown, no intro text, no closing remarks.\n\n' +
      'CRITICAL: You MUST generate exactly 15 questions. Not 4, not 10 — exactly 15.\n\n' +
      'Document content:\n"""\n' + text + '\n"""\n\n' +
      'The 15 questions are organized as 3 identical sets of 5 questions each.\n' +
      'Each set of 5 follows this difficulty pattern: easy, medium, medium, hard, hard.\n' +
      'So: Q1=easy, Q2=medium, Q3=medium, Q4=hard, Q5=hard, Q6=easy, Q7=medium... Q15=hard.\n\n' +
      'Each question must have exactly 4 options. Use this JSON format:\n' +
      '{"question":"...","options":["A","B","C","D"],"answer":0,"difficulty":"easy|medium|hard","explanation_correct":"step-by-step solution","explanations_incorrect":["","why wrong if non-trivial","",""]}\n\n' +
      'RULES:\n' +
      '- explanation_correct: ALWAYS provide. Math: show step-by-step calculation. Concepts: explain the reasoning.\n' +
      '- explanations_incorrect: Only explain if it represents a common misconception.\n' +
      '- easy=basic recall, medium=combine concepts, hard=multi-step reasoning.\n\n' +
      'START YOUR RESPONSE WITH: [{"question":';

    var fullResponse = '';
    tool.requestAIStream(prompt, null, {
      onToken: function(token) { fullResponse += token; },
      onComplete: function() {
        updateGenerateButtons({ disabled: false, text: '🤖 Generate Quiz Questions from PDFs' });
        var jsonStr = fullResponse.trim();
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
        var arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (arrayMatch) jsonStr = arrayMatch[0];
        try {
          var questions = JSON.parse(jsonStr);
          if (!Array.isArray(questions) || questions.length === 0) throw new Error('Invalid format');
          for (var i = 0; i < questions.length; i++) {
            var q = questions[i];
            if (!q.question || !Array.isArray(q.options) || q.options.length < 2 || typeof q.answer !== 'number') {
              throw new Error('Question ' + (i + 1) + ' is missing required fields');
            }
            if (!q.difficulty) {
              var posInSet = i % QUIZ_PER_SET;
              q.difficulty = posInSet === 0 ? 'easy' : posInSet <= 2 ? 'medium' : 'hard';
            }
            if (!q.explanation_correct) q.explanation_correct = '';
            if (!q.explanations_incorrect) q.explanations_incorrect = ['', '', '', ''];
          }
          editingQuizQuestions = questions;
          editingQuizQuestionIdx = null;
          editingQuizQuestionSetIdx = null;
          renderQuizEditorList();
          hideSubModal('quiz-question-editor-panel');
          var msg = '✅ Generated ' + questions.length + ' questions from ' + allUrls.length + ' PDF(s).';
          if (questions.length < 15) msg += ' AI produced fewer than 15 — you can add more manually.';
          tool.notify(msg, 'success');
        } catch(e) {
          tool.notify('AI response could not be parsed. Raw response logged to console.', 'error');
          console.error('Quiz generation parse error:', e);
          console.log('Raw AI response:', fullResponse);
        }
      },
      onError: function(err) {
        updateGenerateButtons({ disabled: false, text: '🤖 Generate Quiz Questions from PDFs' });
        tool.notify('AI generation failed: ' + err, 'error');
      }
    });
  }

  // Start reading PDFs sequentially
  readNext(0);
}

/* ═══════════════════════════════════════════
   RENDER: MANAGER
   ═══════════════════════════════════════════ */

function showManager() {
  currentView = 'manager';
  el('view-sections').style.display = 'none';
  el('view-lessons').style.display = 'none';
  el('view-lesson-detail').style.display = 'none';
  el('view-manager').style.display = '';
  el('btn-back').style.display = '';
  el('app-title').textContent = '⚙️ Manage Sections & Lessons';
  renderManager();
  tool.resize();
}

function renderManager() {
  var sorted = getSortedSections();
  el('manager-section-count').textContent = sorted.length + ' section(s)';
  var container = el('manager-sections-list');
  var empty = el('manager-empty');

  if (sorted.length === 0) {
    container.innerHTML = '';
    empty.style.display = '';
  } else {
    empty.style.display = 'none';
    container.innerHTML = sorted.map(function(s) {
      var d = getSectionData(s);
      var lessons = getLessons(s);
      return '<div class="manager-section-card">' +
        '<div class="manager-section-header">' +
          '<div class="manager-section-header-left">' +
            '<strong>' + esc(s.name || d.title || 'Untitled') + '</strong>' +
            '<span class="section-meta">' + lessons.length + ' lesson(s) | Order: ' + (d.order || '—') + '</span>' +
          '</div>' +
          '<div class="manager-section-actions">' +
            '<button class="btn btn-sm btn-outline" data-edit-section="' + esc(s.id) + '">✏️ Edit</button>' +
            '<button class="btn btn-sm btn-danger" data-delete-section="' + esc(s.id) + '">🗑 Delete</button>' +
          '</div>' +
        '</div>' +
        (lessons.length > 0 ?
          '<table class="manager-lessons-table">' +
            '<thead><tr><th>#</th><th>Lesson</th><th>Min</th><th>Media</th><th>Quiz</th><th>Actions</th></tr></thead>' +
            '<tbody>' + lessons.map(function(les, idx) {
              var hasYt = hasLessonVideo(les) ? '🎬' : '';
              var hasPres = les.presentationPdfUrls && les.presentationPdfUrls.length ? '📊' : '';
              var hasStudy = les.studyDocPdfUrls && les.studyDocPdfUrls.length ? '📖' : '';
              var hasWs = les.worksheetPdfUrls && les.worksheetPdfUrls.length ? '📝' : '';
              var hasSrc = les.sourceUrls && (Array.isArray(les.sourceUrls) ? les.sourceUrls.length : (typeof les.sourceUrls === 'string' && les.sourceUrls.trim())) ? '🔗' : '';
              var media = hasYt + hasPres + hasStudy + hasWs + hasSrc || '—';
              return '<tr>' +
                '<td>' + (idx + 1) + '</td>' +
                '<td><strong>' + esc(les.title || 'Untitled') + '</strong></td>' +
                '<td>' + (les.estimatedMinutes || '—') + '</td>' +
                '<td>' + media + '</td>' +
                '<td>' + (les.quiz && les.quiz.length ? '✅ ' + les.quiz.length + ' Q' : '—') + '</td>' +
                '<td><div class="table-actions">' +
                  '<button class="btn btn-sm btn-outline" data-edit-lesson="' + esc(s.id) + '::' + esc(les.id) + '">✏️</button>' +
                  '<button class="btn btn-sm btn-danger" data-delete-lesson="' + esc(s.id) + '::' + esc(les.id) + '">🗑</button>' +
                '</div></td>' +
              '</tr>';
            }).join('') + '</tbody></table>'
          :
          '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">No lessons yet. Edit the section to add lessons.</div>'
        ) +
      '</div>';
    }).join('');

    // Bind edit section buttons
    var editSecBtns = container.querySelectorAll('[data-edit-section]');
    for (var i = 0; i < editSecBtns.length; i++) {
      editSecBtns[i].addEventListener('click', function(e) {
        e.stopPropagation();
        openEditor(this.getAttribute('data-edit-section'));
      });
    }

    // Bind delete section buttons
    var delSecBtns = container.querySelectorAll('[data-delete-section]');
    for (var j = 0; j < delSecBtns.length; j++) {
      delSecBtns[j].addEventListener('click', function(e) {
        e.stopPropagation();
        deleteSection(this.getAttribute('data-delete-section'));
      });
    }

    // Bind edit lesson buttons
    var editLesBtns = container.querySelectorAll('[data-edit-lesson]');
    for (var k = 0; k < editLesBtns.length; k++) {
      editLesBtns[k].addEventListener('click', function(e) {
        e.stopPropagation();
        var parts = this.getAttribute('data-edit-lesson').split('::');
        openEditor(parts[0], parts[1]);
      });
    }

    // Bind delete lesson buttons
    var delLesBtns = container.querySelectorAll('[data-delete-lesson]');
    for (var l = 0; l < delLesBtns.length; l++) {
      delLesBtns[l].addEventListener('click', function(e) {
        e.stopPropagation();
        var parts = this.getAttribute('data-delete-lesson').split('::');
        deleteLesson(parts[0], parts[1]);
      });
    }
  }
}

/* ═══════════════════════════════════════════
   MANAGER CRUD: SECTION
   ═══════════════════════════════════════════ */

function openEditor(sectionId, lessonId) {
  editingSectionId = sectionId || null;
  editingLessonId = lessonId || null;
  editingLessons = [];

  if (sectionId) {
    var section = findSection(sectionId);
    if (section) {
      var d = getSectionData(section);
      el('edit-section-title').value = section.name || d.title || '';
      el('edit-section-order').value = typeof d.order === 'number' ? d.order : '';
      editingLessons = JSON.parse(JSON.stringify(getLessons(section)));
    }
    el('modal-title').textContent = lessonId ? 'Edit Lesson' : 'Edit Section';
    el('modal-section-fields').style.display = lessonId ? 'none' : '';
    el('modal-lessons-area').style.display = lessonId ? 'none' : '';
  } else {
    el('edit-section-title').value = '';
    el('edit-section-order').value = '';
    editingLessons = [];
    el('modal-title').textContent = 'Add New Section';
    el('modal-section-fields').style.display = '';
    el('modal-lessons-area').style.display = 'none';
  }

  // Hide lesson editor panel initially
  hideSubModal('lesson-editor-panel');

  el('modal-overlay').style.display = '';

  if (lessonId) {
    // Editing a specific lesson - show lesson editor directly
    var les = null;
    for (var i = 0; i < editingLessons.length; i++) {
      if (editingLessons[i].id === lessonId) { les = editingLessons[i]; break; }
    }
    if (les) {
      populateLessonEditor(les);
      showSubModal('lesson-editor-panel');
      el('lesson-editor-heading').textContent = 'Edit Lesson';
    }
    el('modal-section-fields').style.display = 'none';
    el('modal-lessons-area').style.display = 'none';
  } else if (sectionId) {
    // Show section fields + lessons list
    el('modal-section-fields').style.display = '';
    el('modal-lessons-area').style.display = '';
    renderLessonsEditorList();
  }

  tool.resize();
}

function closeEditor() {
  el('modal-overlay').style.display = 'none';
  editingSectionId = null;
  editingLessonId = null;
  editingLessons = [];
}

function populateLessonEditor(les) {
  el('edit-lesson-title').value = les.title || '';
  el('edit-lesson-order').value = typeof les.order === 'number' ? les.order : '';
  el('edit-lesson-minutes').value = les.estimatedMinutes || '';
  // YouTube URLs
  editingYoutubeUrls = normalizePdfArray(les.youtubeUrls);
  editingYoutubeIdx = null;
  renderYoutubeEditorList();
  hideSubModal('youtube-editor-panel');
  // PDF documents
  editingPresentationPdfUrls = normalizePdfArray(les.presentationPdfUrls);
  editingStudyDocPdfUrls = normalizePdfArray(les.studyDocPdfUrls);
  editingWorksheetPdfUrls = normalizePdfArray(les.worksheetPdfUrls);
  editingAnswerKeyPdfUrls = normalizePdfArray(les.answerKeyPdfUrls);
  editingPdfIdx = null; editingPdfType = null;
  renderPdfEditorList('presentation'); renderPdfEditorList('studyDoc');
  renderPdfEditorList('worksheet'); renderPdfEditorList('answerKey');
  hideSubModal('pdf-editor-panel');
  // Rich HTML editor
  setHtmlContent(les.content || '');
  // Source links
  var srcVal = les.sourceUrls;
  if (srcVal && typeof srcVal === 'string') {
    try { srcVal = JSON.parse(srcVal); } catch(e) { srcVal = null; }
  }
  editingSourceLinks = (srcVal && Array.isArray(srcVal)) ? JSON.parse(JSON.stringify(srcVal)) : [];
  editingSourceLinkIdx = null;
  renderSourceLinksEditorList();
  hideSubModal('source-link-editor-panel');
  // Quiz questions
  var quizVal = les.quiz;
  if (quizVal && typeof quizVal === 'string') {
    try { quizVal = JSON.parse(quizVal); } catch(e) { quizVal = null; }
  }
  editingQuizQuestions = (quizVal && Array.isArray(quizVal)) ? JSON.parse(JSON.stringify(quizVal)) : [];
  editingQuizQuestionIdx = null;
  renderQuizEditorList();
  hideSubModal('quiz-question-editor-panel');
  switchLessonEditorTab('info');
}

/** Normalize a PDF field to array (handles single-string values that may have been stored before) */
function normalizePdfArray(field) {
  if (!field) return [];
  if (typeof field === 'string') return [field];
  if (Array.isArray(field)) return JSON.parse(JSON.stringify(field));
  return [];
}

function renderLessonsEditorList() {
  var list = el('lessons-editor-list');
  el('lessons-editor-count').textContent = editingLessons.length + ' lesson(s)';

  if (editingLessons.length === 0) {
    list.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">No lessons added yet.</div>';
  } else {
    list.innerHTML = editingLessons.map(function(les, idx) {
      return '<div class="lesson-editor-item">' +
        '<div class="lesson-editor-item-info">' +
          '<div class="lesson-editor-item-title">' + (idx + 1) + '. ' + esc(les.title || 'Untitled') + '</div>' +
          '<div class="lesson-editor-item-meta">⏱️ ' + (les.estimatedMinutes || '—') + ' min' +
            (hasLessonVideo(les) ? ' · 🎬' : '') +
            (les.presentationPdfUrls && les.presentationPdfUrls.length ? ' · 📊' : '') +
            (les.studyDocPdfUrls && les.studyDocPdfUrls.length ? ' · 📖' : '') +
            (les.worksheetPdfUrls && les.worksheetPdfUrls.length ? ' · 📝' : '') +
            (les.quiz && les.quiz.length ? ' · 📝' : '') +
          '</div>' +
        '</div>' +
        '<div class="lesson-editor-item-actions">' +
          '<button class="btn btn-sm btn-outline" data-edit-les-idx="' + idx + '">✏️</button>' +
          '<button class="btn btn-sm btn-danger" data-del-les-idx="' + idx + '">🗑</button>' +
        '</div>' +
      '</div>';
    }).join('');

    // Bind edit
    var editBtns = list.querySelectorAll('[data-edit-les-idx]');
    for (var i = 0; i < editBtns.length; i++) {
      editBtns[i].addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute('data-edit-les-idx'));
        populateLessonEditor(editingLessons[idx]);
        showSubModal('lesson-editor-panel');
        el('lesson-editor-heading').textContent = 'Edit Lesson';
        // Store editing index
        el('lesson-editor-panel').setAttribute('data-editing-idx', idx);
      });
    }

    // Bind delete
    var delBtns = list.querySelectorAll('[data-del-les-idx]');
    for (var j = 0; j < delBtns.length; j++) {
      delBtns[j].addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute('data-del-les-idx'));
        editingLessons.splice(idx, 1);
        renderLessonsEditorList();
      });
    }
  }
}

function startAddLesson() {
  // Clear lesson editor
  el('edit-lesson-title').value = '';
  el('edit-lesson-order').value = editingLessons.length + 1;
  el('edit-lesson-minutes').value = '';
  editingYoutubeUrls = [];
  editingYoutubeIdx = null;
  renderYoutubeEditorList();
  hideSubModal('youtube-editor-panel');
  editingPresentationPdfUrls = [];
  editingStudyDocPdfUrls = [];
  editingWorksheetPdfUrls = [];
  editingAnswerKeyPdfUrls = [];
  editingPdfIdx = null; editingPdfType = null;
  renderPdfEditorList('presentation'); renderPdfEditorList('studyDoc');
  renderPdfEditorList('worksheet'); renderPdfEditorList('answerKey');
  hideSubModal('pdf-editor-panel');
  setHtmlContent('');
  el('html-editor-wrap').classList.remove('expanded');
  editingSourceLinks = [];
  editingSourceLinkIdx = null;
  renderSourceLinksEditorList();
  hideSubModal('source-link-editor-panel');
  editingQuizQuestions = [];
  editingQuizQuestionIdx = null;
  renderQuizEditorList();
  hideSubModal('quiz-question-editor-panel');
  showSubModal('lesson-editor-panel');
  switchLessonEditorTab('info');
  el('lesson-editor-heading').textContent = 'Add Lesson';
  el('lesson-editor-panel').removeAttribute('data-editing-idx');
}

function saveLessonFromEditor() {
  var title = el('edit-lesson-title').value.trim();
  var content = getHtmlContent();
  if (!title) { tool.notify('Lesson title is required.', 'warning'); return; }

  var order = parseInt(el('edit-lesson-order').value) || editingLessons.length + 1;
  var minutes = parseInt(el('edit-lesson-minutes').value) || 0;
  var youtubeUrls = editingYoutubeUrls.length > 0 ? JSON.parse(JSON.stringify(editingYoutubeUrls)) : null;
  var presentationPdfUrls = editingPresentationPdfUrls.length > 0 ? JSON.parse(JSON.stringify(editingPresentationPdfUrls)) : null;
  var studyDocPdfUrls = editingStudyDocPdfUrls.length > 0 ? JSON.parse(JSON.stringify(editingStudyDocPdfUrls)) : null;
  var worksheetPdfUrls = editingWorksheetPdfUrls.length > 0 ? JSON.parse(JSON.stringify(editingWorksheetPdfUrls)) : null;
  var answerKeyPdfUrls = editingAnswerKeyPdfUrls.length > 0 ? JSON.parse(JSON.stringify(editingAnswerKeyPdfUrls)) : null;

  var sourceUrls = editingSourceLinks.length > 0 ? JSON.parse(JSON.stringify(editingSourceLinks)) : null;
  var quiz = editingQuizQuestions.length > 0 ? JSON.parse(JSON.stringify(editingQuizQuestions)) : null;

  var lessonData = {
    id: genId(),
    title: title,
    order: order,
    estimatedMinutes: minutes,
    content: content,
    youtubeUrls: youtubeUrls,
    presentationPdfUrls: presentationPdfUrls,
    studyDocPdfUrls: studyDocPdfUrls,
    worksheetPdfUrls: worksheetPdfUrls,
    answerKeyPdfUrls: answerKeyPdfUrls,
    sourceUrls: sourceUrls,
    quiz: quiz
  };

  var editingIdx = el('lesson-editor-panel').getAttribute('data-editing-idx');
  if (editingIdx !== null && editingIdx !== undefined && editingIdx !== '') {
    // Update existing
    var idx = parseInt(editingIdx);
    lessonData.id = editingLessons[idx].id; // Preserve ID
    editingLessons[idx] = lessonData;
  } else {
    editingLessons.push(lessonData);
  }

  // Close lesson editor panel
  hideSubModal('lesson-editor-panel');
  el('lesson-editor-panel').removeAttribute('data-editing-idx');

  // If editing a lesson directly from manager (not inside section editor), persist immediately
  if (editingLessonId) {
    saveSection();
    return;
  }

  renderLessonsEditorList();
  tool.notify('Lesson saved!', 'success');
}

function cancelLessonEditor() {
  hideSubModal('lesson-editor-panel');
  el('lesson-editor-panel').removeAttribute('data-editing-idx');
  // If editing a lesson directly from manager (not inside section editor), also close the modal
  if (editingLessonId) closeEditor();
}

/* ═══════════════════════════════════════════
   HTML RICH EDITOR
   ═══════════════════════════════════════════ */

function execCmd(command, value) {
  document.execCommand(command, false, value);
}

function getHtmlContent() {
  return el('html-editor-content').innerHTML || '';
}

function setHtmlContent(html) {
  el('html-editor-content').innerHTML = html || '';
}

/** Sandbox-safe link URL input — replaces prompt() which is blocked in sandboxed iframes */
function showLinkUrlInput() {
  var existing = showLinkUrlInput._overlay;
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.className = 'link-url-overlay';
  overlay.innerHTML = '<div class="link-url-box">' +
    '<div class="link-url-label">Enter URL:</div>' +
    '<input class="form-input" id="link-url-input" type="url" placeholder="https://..." value="https://">' +
    '<div class="link-url-actions">' +
      '<button class="btn btn-outline btn-sm" id="link-url-cancel">Cancel</button>' +
      '<button class="btn btn-primary btn-sm" id="link-url-ok">Insert Link</button>' +
    '</div>' +
  '</div>';
  document.body.appendChild(overlay);
  showLinkUrlInput._overlay = overlay;

  var input = overlay.querySelector('#link-url-input');
  setTimeout(function() { input.focus(); input.select(); }, 50);

  overlay.querySelector('#link-url-cancel').addEventListener('click', function() { overlay.remove(); showLinkUrlInput._overlay = null; });
  overlay.querySelector('#link-url-ok').addEventListener('click', function() {
    var url = input.value.trim();
    overlay.remove();
    showLinkUrlInput._overlay = null;
    if (url) {
      el('html-editor-content').focus();
      execCmd('createlink', url);
    }
  });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); showLinkUrlInput._overlay = null; } });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { overlay.remove(); showLinkUrlInput._overlay = null; document.removeEventListener('keydown', onEsc); }
  });
}

/* ═══════════════════════════════════════════
   QUIZ QUESTION MANAGED EDITOR
   ═══════════════════════════════════════════ */

function renderQuizEditorList() {
  var list = el('quiz-editor-list');
  el('quiz-editor-count').textContent = editingQuizQuestions.length + ' question(s) — 3 sets of 5';

  if (editingQuizQuestions.length === 0) {
    list.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">No quiz questions added yet. Click "Generate Questions" or add manually.</div>';
  } else {
    var setLabels = ['Set 1', 'Set 2', 'Set 3'];
    var html = '';
    for (var setIdx = 0; setIdx < QUIZ_SETS; setIdx++) {
      var setStart = setIdx * QUIZ_PER_SET;
      var setQuestions = editingQuizQuestions.slice(setStart, setStart + QUIZ_PER_SET);
      var canAdd = setQuestions.length < QUIZ_PER_SET;
      html += '<div class="quiz-set-group">' +
        '<div class="quiz-set-group-header">' +
          '<span>📋 ' + setLabels[setIdx] + ' — ' + setQuestions.length + ' of ' + QUIZ_PER_SET + ' questions</span>' +
          (canAdd ? '<button class="btn btn-sm btn-primary" data-add-quiz-set="' + setIdx + '" style="font-size:11px;padding:2px 8px">+ Add</button>' : '<span style="font-size:10px;color:var(--success)">✓ Full</span>') +
        '</div>';
      if (setQuestions.length === 0) {
        html += '<div style="padding:8px 12px;color:var(--text-muted);font-size:12px;">No questions in this set yet.</div>';
      } else {
        html += setQuestions.map(function(q, qi) {
          var globalIdx = setStart + qi;
          var answerLabel = q.options && q.options[q.answer] ? q.options[q.answer] : 'Not set';
          return '<div class="quiz-editor-item">' +
            '<div class="quiz-editor-item-info">' +
              '<div class="quiz-editor-item-title">' + (globalIdx + 1) + '. ' + esc(q.question || 'Untitled') +
                (q.difficulty ? ' <span class="quiz-difficulty difficulty-' + q.difficulty + '">' + q.difficulty + '</span>' : '') +
              '</div>' +
              '<div class="quiz-editor-item-meta">' + (q.options ? q.options.length : 0) + ' options · Answer: ' + esc(answerLabel) + '</div>' +
            '</div>' +
            '<div class="quiz-editor-item-actions">' +
              '<button class="btn btn-sm btn-outline" data-edit-quiz-idx="' + globalIdx + '">✏️</button>' +
              '<button class="btn btn-sm btn-danger" data-del-quiz-idx="' + globalIdx + '">🗑</button>' +
            '</div>' +
          '</div>';
        }).join('');
      }
      html += '</div>';
    }
    list.innerHTML = html;

    // Bind per-set Add buttons
    var addBtns = list.querySelectorAll('[data-add-quiz-set]');
    for (var a = 0; a < addBtns.length; a++) {
      addBtns[a].addEventListener('click', function(e) {
        e.stopPropagation();
        openQuizQuestionEditor(null, parseInt(this.getAttribute('data-add-quiz-set')));
      });
    }
    var editBtns = list.querySelectorAll('[data-edit-quiz-idx]');
    for (var i = 0; i < editBtns.length; i++) {
      editBtns[i].addEventListener('click', function(e) {
        e.stopPropagation();
        openQuizQuestionEditor(parseInt(this.getAttribute('data-edit-quiz-idx')));
      });
    }
    var delBtns = list.querySelectorAll('[data-del-quiz-idx]');
    for (var j = 0; j < delBtns.length; j++) {
      delBtns[j].addEventListener('click', function(e) {
        e.stopPropagation();
        deleteQuizQuestion(parseInt(this.getAttribute('data-del-quiz-idx')));
      });
    }
  }
}

function openQuizQuestionEditor(idx, setIdx) {
  editingQuizQuestionIdx = idx;
  editingQuizQuestionSetIdx = (idx === null) ? (setIdx || 0) : null; // only used for new questions
  showSubModal('quiz-question-editor-panel');
  el('quiz-editor-heading').textContent = idx !== null ? 'Edit Question' : 'Add Question to Set ' + ((setIdx || 0) + 1);

  if (idx !== null && editingQuizQuestions[idx]) {
    var q = editingQuizQuestions[idx];
    el('edit-quiz-question-text').value = q.question || '';
    el('edit-quiz-answer').value = typeof q.answer === 'number' ? q.answer : 0;
    renderQuizOptionsEditor(q.options || []);
  } else {
    el('edit-quiz-question-text').value = '';
    el('edit-quiz-answer').value = 0;
    renderQuizOptionsEditor(['', '', '', '']);
  }
}

function closeQuizQuestionEditor() {
  hideSubModal('quiz-question-editor-panel');
  editingQuizQuestionIdx = null;
}

function renderQuizOptionsEditor(options) {
  var container = el('quiz-options-editor-container');
  container.innerHTML = options.map(function(opt, oi) {
    return '<div class="quiz-option-editor-row">' +
      '<input class="form-input" type="text" value="' + esc(opt) + '" data-opt-idx="' + oi + '" placeholder="Option ' + (oi + 1) + '">' +
      '<button class="btn btn-sm btn-danger" data-remove-opt="' + oi + '" title="Remove">✕</button>' +
      '</div>';
  }).join('');

  var removeBtns = container.querySelectorAll('[data-remove-opt]');
  for (var i = 0; i < removeBtns.length; i++) {
    removeBtns[i].addEventListener('click', function(e) {
      e.stopPropagation();
      var oi = parseInt(this.getAttribute('data-remove-opt'));
      var currentOpts = getCurrentQuizOptions();
      if (currentOpts.length <= 2) { tool.notify('You need at least 2 options.', 'warning'); return; }
      currentOpts.splice(oi, 1);
      renderQuizOptionsEditor(currentOpts);
    });
  }
}

function getCurrentQuizOptions() {
  var inputs = el('quiz-options-editor-container').querySelectorAll('input[type="text"]');
  var opts = [];
  for (var i = 0; i < inputs.length; i++) {
    opts.push(inputs[i].value);
  }
  return opts;
}

function addQuizOption() {
  var currentOpts = getCurrentQuizOptions();
  currentOpts.push('');
  renderQuizOptionsEditor(currentOpts);
}

function saveQuizQuestion() {
  var text = el('edit-quiz-question-text').value.trim();
  if (!text) { tool.notify('Question text is required.', 'warning'); return; }
  var options = getCurrentQuizOptions();
  var validOpts = options.filter(function(o) { return o.trim() !== ''; });
  if (validOpts.length < 2) { tool.notify('You need at least 2 non-empty options.', 'warning'); return; }
  var answer = parseInt(el('edit-quiz-answer').value) || 0;
  if (answer >= validOpts.length) { tool.notify('Correct answer index is out of range.', 'warning'); return; }

  var questionData = {
    question: text,
    options: validOpts,
    answer: answer
  };

  if (editingQuizQuestionIdx !== null) {
    editingQuizQuestions[editingQuizQuestionIdx] = questionData;
  } else {
    // Insert at the correct position for the target set
    var targetSet = editingQuizQuestionSetIdx || 0;
    var insertAt = targetSet * QUIZ_PER_SET;
    // Find the actual insertion point (first empty slot or append within set)
    for (var si = insertAt; si < insertAt + QUIZ_PER_SET && si < editingQuizQuestions.length; si++) {
      if (!editingQuizQuestions[si]) { insertAt = si; break; }
    }
    if (insertAt >= editingQuizQuestions.length) {
      editingQuizQuestions.push(questionData);
    } else {
      editingQuizQuestions.splice(insertAt, 0, questionData);
    }
    editingQuizQuestionSetIdx = null;
  }

  closeQuizQuestionEditor();
  renderQuizEditorList();
  tool.notify('Question saved!', 'success');
}

function deleteQuizQuestion(idx) {
  editingQuizQuestions.splice(idx, 1);
  renderQuizEditorList();
}

/* ═══════════════════════════════════════════
   SOURCE LINKS MANAGED EDITOR
   ═══════════════════════════════════════════ */

function renderSourceLinksEditorList() {
  var list = el('source-links-editor-list');
  el('source-links-editor-count').textContent = editingSourceLinks.length + ' link(s)';

  if (editingSourceLinks.length === 0) {
    list.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">No source links added yet.</div>';
  } else {
    list.innerHTML = editingSourceLinks.map(function(sl, idx) {
      return '<div class="source-link-editor-item">' +
        '<div class="source-link-editor-item-info">' +
          '<div class="source-link-editor-item-title">🔗 ' + esc(sl.label || 'Untitled') + '</div>' +
          '<div class="source-link-editor-item-meta">' + esc(sl.url || '') + '</div>' +
        '</div>' +
        '<div class="source-link-editor-item-actions">' +
          '<button class="btn btn-sm btn-outline" data-edit-sl-idx="' + idx + '">✏️</button>' +
          '<button class="btn btn-sm btn-danger" data-del-sl-idx="' + idx + '">🗑</button>' +
        '</div>' +
      '</div>';
    }).join('');

    var editBtns = list.querySelectorAll('[data-edit-sl-idx]');
    for (var i = 0; i < editBtns.length; i++) {
      editBtns[i].addEventListener('click', function(e) {
        e.stopPropagation();
        openSourceLinkEditor(parseInt(this.getAttribute('data-edit-sl-idx')));
      });
    }
    var delBtns = list.querySelectorAll('[data-del-sl-idx]');
    for (var j = 0; j < delBtns.length; j++) {
      delBtns[j].addEventListener('click', function(e) {
        e.stopPropagation();
        deleteSourceLink(parseInt(this.getAttribute('data-del-sl-idx')));
      });
    }
  }
}

function openSourceLinkEditor(idx) {
  editingSourceLinkIdx = idx;
  showSubModal('source-link-editor-panel');
  el('source-link-editor-heading').textContent = idx !== null ? 'Edit Source Link' : 'Add Source Link';

  if (idx !== null && editingSourceLinks[idx]) {
    var sl = editingSourceLinks[idx];
    el('edit-source-link-label').value = sl.label || '';
    el('edit-source-link-url').value = sl.url || '';
  } else {
    el('edit-source-link-label').value = '';
    el('edit-source-link-url').value = '';
  }
}

function closeSourceLinkEditor() {
  hideSubModal('source-link-editor-panel');
  editingSourceLinkIdx = null;
}

function saveSourceLink() {
  var label = el('edit-source-link-label').value.trim();
  var url = el('edit-source-link-url').value.trim();
  if (!label) { tool.notify('Label is required.', 'warning'); return; }
  if (!url) { tool.notify('URL is required.', 'warning'); return; }

  var linkData = { label: label, url: url };

  if (editingSourceLinkIdx !== null) {
    editingSourceLinks[editingSourceLinkIdx] = linkData;
  } else {
    editingSourceLinks.push(linkData);
  }

  closeSourceLinkEditor();
  renderSourceLinksEditorList();
  tool.notify('Source link saved!', 'success');
}

function deleteSourceLink(idx) {
  editingSourceLinks.splice(idx, 1);
  renderSourceLinksEditorList();
}

/* ═══════════════════════════════════════════
   YOUTUBE URLS MANAGED EDITOR
   ═══════════════════════════════════════════ */

function renderYoutubeEditorList() {
  var list = el('youtube-editor-list');
  el('youtube-editor-count').textContent = editingYoutubeUrls.length + ' video(s)';

  if (editingYoutubeUrls.length === 0) {
    list.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">No videos added yet.</div>';
  } else {
    list.innerHTML = editingYoutubeUrls.map(function(url, idx) {
      var videoId = extractYouTubeId(url);
      var thumbHtml = videoId ? '<img src="https://img.youtube.com/vi/' + videoId + '/default.jpg" style="width:60px;height:34px;object-fit:cover;border-radius:4px;margin-right:8px;flex-shrink:0" alt="">' : '';
      return '<div class="source-link-editor-item">' +
        '<div class="source-link-editor-item-info" style="display:flex;align-items:center">' +
          thumbHtml +
          '<div>' +
            '<div class="source-link-editor-item-title">🎬 ' + (videoId ? 'youtube.com/watch?v=' + videoId : esc(url)) + '</div>' +
            '<div class="source-link-editor-item-meta">' + esc(url) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="source-link-editor-item-actions">' +
          '<button class="btn btn-sm btn-outline" data-edit-yt-idx="' + idx + '">✏️</button>' +
          '<button class="btn btn-sm btn-danger" data-del-yt-idx="' + idx + '">🗑</button>' +
        '</div>' +
      '</div>';
    }).join('');

    var editBtns = list.querySelectorAll('[data-edit-yt-idx]');
    for (var i = 0; i < editBtns.length; i++) {
      editBtns[i].addEventListener('click', function(e) {
        e.stopPropagation();
        openYoutubeEditor(parseInt(this.getAttribute('data-edit-yt-idx')));
      });
    }
    var delBtns = list.querySelectorAll('[data-del-yt-idx]');
    for (var j = 0; j < delBtns.length; j++) {
      delBtns[j].addEventListener('click', function(e) {
        e.stopPropagation();
        deleteYoutubeUrl(parseInt(this.getAttribute('data-del-yt-idx')));
      });
    }
  }
}

function openYoutubeEditor(idx) {
  editingYoutubeIdx = idx;
  showSubModal('youtube-editor-panel');
  el('youtube-editor-heading').textContent = idx !== null ? 'Edit YouTube Video' : 'Add YouTube Video';
  el('edit-youtube-item-url').value = idx !== null ? (editingYoutubeUrls[idx] || '') : '';
}

function closeYoutubeEditor() {
  hideSubModal('youtube-editor-panel');
  editingYoutubeIdx = null;
}

function saveYoutubeUrl() {
  var url = el('edit-youtube-item-url').value.trim();
  if (!url) { tool.notify('YouTube URL is required.', 'warning'); return; }
  if (!extractYouTubeId(url)) { tool.notify('Could not parse a YouTube video ID from this URL.', 'warning'); return; }

  if (editingYoutubeIdx !== null) {
    editingYoutubeUrls[editingYoutubeIdx] = url;
  } else {
    editingYoutubeUrls.push(url);
  }

  closeYoutubeEditor();
  renderYoutubeEditorList();
  tool.notify('Video saved!', 'success');
}

function deleteYoutubeUrl(idx) {
  editingYoutubeUrls.splice(idx, 1);
  renderYoutubeEditorList();
}

/* ═══════════════════════════════════════════
   PDF URLS MANAGED EDITOR (generic for all 4 types)
   ═══════════════════════════════════════════ */

var PDF_LABELS = {
  presentation: { icon: '📊', label: 'Presentation Slides' },
  studyDoc:     { icon: '📖', label: 'Study Documents' },
  worksheet:    { icon: '📝', label: 'Worksheets' },
  answerKey:    { icon: '🔑', label: 'Answer Keys' }
};

function getPdfArray(type) {
  if (type === 'presentation') return editingPresentationPdfUrls;
  if (type === 'studyDoc') return editingStudyDocPdfUrls;
  if (type === 'worksheet') return editingWorksheetPdfUrls;
  if (type === 'answerKey') return editingAnswerKeyPdfUrls;
  return [];
}

function renderPdfEditorList(type) {
  var arr = getPdfArray(type);
  var list = el('pdf-list-' + type);
  var count = el('pdf-count-' + type);
  if (count) count.textContent = arr.length + ' file(s)';

  if (!list) return;
  if (arr.length === 0) {
    list.innerHTML = '<div style="padding:8px 12px;color:var(--text-muted);font-size:12px;">No files added yet.</div>';
  } else {
    list.innerHTML = arr.map(function(url, idx) {
      return '<div class="source-link-editor-item">' +
        '<div class="source-link-editor-item-info">' +
          '<div class="source-link-editor-item-title">📎 ' + esc(url.substring(url.lastIndexOf('/') + 1) || url) + '</div>' +
          '<div class="source-link-editor-item-meta">' + esc(url) + '</div>' +
        '</div>' +
        '<div class="source-link-editor-item-actions">' +
          '<button class="btn btn-sm btn-outline" data-edit-pdf="' + type + ':' + idx + '">✏️</button>' +
          '<button class="btn btn-sm btn-danger" data-del-pdf="' + type + ':' + idx + '">🗑</button>' +
        '</div>' +
      '</div>';
    }).join('');

    var editBtns = list.querySelectorAll('[data-edit-pdf]');
    for (var i = 0; i < editBtns.length; i++) {
      editBtns[i].addEventListener('click', function(e) {
        e.stopPropagation();
        var parts = this.getAttribute('data-edit-pdf').split(':');
        openPdfEditor(parts[0], parseInt(parts[1]));
      });
    }
    var delBtns = list.querySelectorAll('[data-del-pdf]');
    for (var j = 0; j < delBtns.length; j++) {
      delBtns[j].addEventListener('click', function(e) {
        e.stopPropagation();
        var parts = this.getAttribute('data-del-pdf').split(':');
        deletePdfUrl(parts[0], parseInt(parts[1]));
      });
    }
  }
}

function openPdfEditor(type, idx) {
  editingPdfType = type;
  editingPdfIdx = idx;
  showSubModal('pdf-editor-panel');
  var info = PDF_LABELS[type] || {};
  el('pdf-editor-heading').textContent = (idx !== null ? 'Edit' : 'Add') + ' ' + (info.label || 'PDF');
  var arr = getPdfArray(type);
  el('edit-pdf-item-url').value = idx !== null ? (arr[idx] || '') : '';
}

function closePdfEditor() {
  hideSubModal('pdf-editor-panel');
  editingPdfType = null;
  editingPdfIdx = null;
}

function savePdfUrl() {
  var url = el('edit-pdf-item-url').value.trim();
  if (!url) { tool.notify('PDF URL is required.', 'warning'); return; }
  // Check for duplicate URLs across ALL PDF arrays
  var allTypes = ['presentation', 'studyDoc', 'worksheet', 'answerKey'];
  for (var t = 0; t < allTypes.length; t++) {
    var checkArr = getPdfArray(allTypes[t]);
    for (var c = 0; c < checkArr.length; c++) {
      // When editing an existing entry, allow its own URL
      if (allTypes[t] === editingPdfType && c === editingPdfIdx) continue;
      if (checkArr[c].trim().toLowerCase() === url.trim().toLowerCase()) {
        var label = (PDF_LABELS[allTypes[t]] || {}).label || allTypes[t];
        tool.notify('This URL is already in ' + label + '. Duplicate files are not allowed.', 'warning');
        return;
      }
    }
  }
  var arr = getPdfArray(editingPdfType);
  if (editingPdfIdx !== null) {
    arr[editingPdfIdx] = url;
  } else {
    arr.push(url);
  }
  var savedType = editingPdfType; // save before closePdfEditor nulls it
  closePdfEditor();
  renderPdfEditorList(savedType);
  tool.notify('PDF saved!', 'success');
}

function deletePdfUrl(type, idx) {
  var arr = getPdfArray(type);
  arr.splice(idx, 1);
  renderPdfEditorList(type);
}

/** Switch between tabs in the lesson editor panel */
function switchLessonEditorTab(tabName) {
  // Update tab button states
  var tabs = document.querySelectorAll('.lesson-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].getAttribute('data-lesson-tab') === tabName);
  }
  // Update panel visibility
  var panels = document.querySelectorAll('.lesson-tab-panel');
  for (var j = 0; j < panels.length; j++) {
    panels[j].classList.toggle('active', panels[j].getAttribute('data-lesson-panel') === tabName);
  }
  tool.resize();
}

function saveSection() {
  var title = el('edit-section-title').value.trim();
  if (!title) { tool.notify('Section title is required.', 'warning'); return; }

  // If editing a single lesson
  if (editingLessonId) {
    saveLessonDirectly();
    return;
  }

  var order = parseInt(el('edit-section-order').value) || 0;

  var data = {
    data_categoriesBased: {
      title: title,
      order: order,
      lessons: editingLessons
    }
  };

  showLoading(true);

  if (editingSectionId) {
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

function saveLessonDirectly() {
  // Save a lesson edit that was opened directly from manager
  var title = el('edit-lesson-title').value.trim();
  var content = getHtmlContent();
  if (!title) { tool.notify('Lesson title is required.', 'warning'); return; }

  var section = findSection(editingSectionId);
  if (!section) return;
  var d = getSectionData(section);
  var lessons = JSON.parse(JSON.stringify(getLessons(section)));

  var order = parseInt(el('edit-lesson-order').value) || 0;
  var minutes = parseInt(el('edit-lesson-minutes').value) || 0;
  var youtubeUrls = editingYoutubeUrls.length > 0 ? JSON.parse(JSON.stringify(editingYoutubeUrls)) : null;
  var presentationPdfUrls = editingPresentationPdfUrls.length > 0 ? JSON.parse(JSON.stringify(editingPresentationPdfUrls)) : null;
  var studyDocPdfUrls = editingStudyDocPdfUrls.length > 0 ? JSON.parse(JSON.stringify(editingStudyDocPdfUrls)) : null;
  var worksheetPdfUrls = editingWorksheetPdfUrls.length > 0 ? JSON.parse(JSON.stringify(editingWorksheetPdfUrls)) : null;
  var answerKeyPdfUrls = editingAnswerKeyPdfUrls.length > 0 ? JSON.parse(JSON.stringify(editingAnswerKeyPdfUrls)) : null;

  var sourceUrls = editingSourceLinks.length > 0 ? JSON.parse(JSON.stringify(editingSourceLinks)) : null;
  var quiz = editingQuizQuestions.length > 0 ? JSON.parse(JSON.stringify(editingQuizQuestions)) : null;

  var updated = false;
  for (var i = 0; i < lessons.length; i++) {
    if (lessons[i].id === editingLessonId) {
      lessons[i].title = title;
      lessons[i].order = order;
      lessons[i].estimatedMinutes = minutes;
      lessons[i].content = content;
      lessons[i].youtubeUrls = youtubeUrls;
      lessons[i].presentationPdfUrls = presentationPdfUrls;
      lessons[i].studyDocPdfUrls = studyDocPdfUrls;
      lessons[i].worksheetPdfUrls = worksheetPdfUrls;
      lessons[i].answerKeyPdfUrls = answerKeyPdfUrls;
      lessons[i].sourceUrls = sourceUrls;
      lessons[i].quiz = quiz;
      updated = true;
      break;
    }
  }

  if (!updated) {
    tool.notify('Lesson not found.', 'error');
    return;
  }

  var newData = {
    data_categoriesBased: {
      title: section.name || d.title || '',
      order: d.order || 0,
      lessons: lessons
    }
  };

  showLoading(true);
  tool.requestObjects('update', {
    mainObjectType: SECTIONS_TYPE,
    objectId: editingSectionId,
    name: section.name || d.title || '',
    productData: newData
  }, function(err) {
    showLoading(false);
    if (err) { tool.notify('Error updating lesson: ' + err, 'error'); return; }
    closeEditor();
    tool.notify('Lesson updated!', 'success');
    loadSections();
  });
}

function deleteSection(sectionId) {
  var section = findSection(sectionId);
  var name = section ? (section.name || 'this section') : 'this section';
  sandboxConfirm('Are you sure you want to delete "' + name + '" and ALL its lessons? This cannot be undone.', function() {
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
  });
}

function deleteLesson(sectionId, lessonId) {
  var section = findSection(sectionId);
  if (!section) return;
  var d = getSectionData(section);
  var lessons = JSON.parse(JSON.stringify(getLessons(section)));
  var lessonName = 'this lesson';
  for (var i = 0; i < lessons.length; i++) {
    if (lessons[i].id === lessonId) { lessonName = lessons[i].title || 'this lesson'; break; }
  }
  sandboxConfirm('Are you sure you want to delete "' + lessonName + '"? This cannot be undone.', function() {
    lessons = lessons.filter(function(l) { return l.id !== lessonId; });
    var newData = {
      data_categoriesBased: {
        title: section.name || d.title || '',
        order: d.order || 0,
        lessons: lessons
      }
    };
    showLoading(true);
    tool.requestObjects('update', {
      mainObjectType: SECTIONS_TYPE,
      objectId: sectionId,
      name: section.name || d.title || '',
      productData: newData
    }, function(err) {
      showLoading(false);
      if (err) { tool.notify('Error deleting lesson: ' + err, 'error'); return; }
      tool.notify('Lesson deleted.', 'info');
      loadSections();
    });
  });
}

/* ═══════════════════════════════════════════
   DATA LOADING
   ═══════════════════════════════════════════ */

function loadSections(callback) {
  showLoading(true);
  var done = false;
  // Safety timeout: hide loading after 5s even if CMS never responds
  var safetyTimer = setTimeout(function() {
    if (!done) {
      done = true;
      showLoading(false);
      SECTIONS = [];
      if (callback) callback();
      renderCurrentView();
    }
  }, 5000);

  try {
    tool.requestObjects('query', { mainObjectType: SECTIONS_TYPE }, function(err, result) {
      if (done) return;
      done = true;
      clearTimeout(safetyTimer);
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
  } catch(e) {
    if (done) return;
    done = true;
    clearTimeout(safetyTimer);
    showLoading(false);
    SECTIONS = [];
    if (callback) callback();
    renderCurrentView();
  }
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
  else if (currentView === 'lesson-detail') renderLessonDetail();
  else if (currentView === 'lessons') renderLessons();
  else renderSections();
}

function updateProgressBar() {
  var pct = getOverallProgressPct();
  var all = getAllLessonsInOrder();
  var completed = 0;
  for (var i = 0; i < all.length; i++) {
    if (getLessonProgress(all[i].sectionId, all[i].lessonId).status === 'completed') completed++;
  }
  el('progress-bar-fill').style.width = pct + '%';
  el('progress-bar-text').textContent = pct + '% Complete (' + completed + ' of ' + all.length + ' lessons)';
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

/** Display user identity + roles in the header badge */
function updateRoleBadge(user) {
  var badge = el('role-badge');
  if (!badge) return;
  if (!user) {
    badge.style.display = 'none';
    return;
  }
  badge.style.display = '';
  var name = user.name || user.displayName || user.email || user.id || 'User';
  var roles = (user.roles && user.roles.length > 0) ? user.roles.join(', ') : 'no roles';
  badge.textContent = name + '  ·  ' + roles;
  badge.title = 'Email: ' + (user.email || '?') + '\nRoles: ' + roles;
}

function checkManagerRole() {
  var user = tool.getUser();
  if (!user) { isManager = false; updateRoleBadge(null); return; }
  var managerRole = tool.param('managerRole', 'admin,editor');
  var allowedRoles = managerRole.split(',').map(function(r) { return r.trim().toLowerCase(); });
  var userRoles = (user.roles || []).map(function(r) { return String(r).toLowerCase(); });
  // Show user info in UI
  updateRoleBadge(user);

  // Check configured manager roles (exact match — CMS roles are single-word)
  for (var i = 0; i < allowedRoles.length; i++) {
    if (userRoles.indexOf(allowedRoles[i]) !== -1) { isManager = true; return; }
  }
  // Fallback: documented CMS roles that always have write access (per html-tool-rules)
  // 'developer', 'owner', 'admin', 'user-manager' get full write access to all objects
  var writeRoles = ['developer', 'owner', 'admin', 'user-manager'];
  for (var j = 0; j < writeRoles.length; j++) {
    if (userRoles.indexOf(writeRoles[j]) !== -1) { isManager = true; return; }
  }
  isManager = false;
}

/* ═══════════════════════════════════════════
   EVENT BINDINGS
   ═══════════════════════════════════════════ */

function bindEvents() {
  el('btn-back').addEventListener('click', handleBack);
  el('btn-manager-toggle').addEventListener('click', function() {
    if (currentView === 'manager') showSections(); else showManager();
  });
  el('btn-add-section-group').addEventListener('click', function() { openEditor(null); });
  el('btn-modal-close').addEventListener('click', closeEditor);
  el('btn-modal-cancel').addEventListener('click', closeEditor);
  el('btn-modal-save').addEventListener('click', saveSection);
  el('btn-prev-lesson').addEventListener('click', function() { navigateLesson(-1); });
  el('btn-next-lesson').addEventListener('click', function() { navigateLesson(1); });
  el('btn-mark-complete').addEventListener('click', markComplete);
  el('btn-mark-inprogress').addEventListener('click', markInProgress);

  el('search-input').addEventListener('input', function() { renderSections(); });
  el('filter-status').addEventListener('change', function() { renderSections(); });

  // Lesson editor buttons
  el('btn-add-lesson').addEventListener('click', startAddLesson);
  el('btn-lesson-editor-save').addEventListener('click', saveLessonFromEditor);
  el('btn-lesson-editor-cancel').addEventListener('click', cancelLessonEditor);

  // Lesson editor tab switching
  var lessonTabs = document.querySelector('.lesson-tabs');
  if (lessonTabs) {
    lessonTabs.addEventListener('click', function(e) {
      var tab = e.target.closest('.lesson-tab');
      if (!tab) return;
      switchLessonEditorTab(tab.getAttribute('data-lesson-tab'));
    });
  }

  // Quiz editor buttons
  el('btn-add-quiz-question').addEventListener('click', function() { openQuizQuestionEditor(null, 0); });
  el('btn-quiz-editor-save').addEventListener('click', saveQuizQuestion);
  el('btn-quiz-editor-cancel').addEventListener('click', closeQuizQuestionEditor);
  el('btn-add-quiz-option').addEventListener('click', addQuizOption);

  // Source links editor buttons
  el('btn-add-source-link').addEventListener('click', function() { openSourceLinkEditor(null); });
  el('btn-source-link-editor-save').addEventListener('click', saveSourceLink);
  el('btn-source-link-editor-cancel').addEventListener('click', closeSourceLinkEditor);

  // YouTube URLs editor buttons
  el('btn-add-youtube').addEventListener('click', function() { openYoutubeEditor(null); });
  el('btn-youtube-editor-save').addEventListener('click', saveYoutubeUrl);
  el('btn-youtube-editor-cancel').addEventListener('click', closeYoutubeEditor);

  // PDF URLs editor buttons (generic, shared panel)
  el('btn-pdf-editor-save').addEventListener('click', savePdfUrl);
  el('btn-pdf-editor-cancel').addEventListener('click', closePdfEditor);
  // Bind "Add" buttons for each PDF type via data attributes
  var pdfAddBtns = document.querySelectorAll('[data-add-pdf]');
  for (var pa = 0; pa < pdfAddBtns.length; pa++) {
    pdfAddBtns[pa].addEventListener('click', function() {
      openPdfEditor(this.getAttribute('data-add-pdf'), null);
    });
  }

  // PDF-to-Quiz AI generation
  el('btn-generate-quiz-from-pdf').addEventListener('click', generateQuizFromPdf);
  var btnGen2 = el('btn-generate-quiz-from-pdf-2');
  if (btnGen2) btnGen2.addEventListener('click', generateQuizFromPdf);

  // Sandbox-safe confirm dialog
  var btnYes = el('btn-confirm-yes');
  var btnNo = el('btn-confirm-no');
  if (btnYes) {
    btnYes.addEventListener('click', function() {
      hideConfirm();
      if (_confirmCallback) { var cb = _confirmCallback; _confirmCallback = null; cb(); }
    });
  }
  if (btnNo) {
    btnNo.addEventListener('click', function() { hideConfirm(); });
  }

  // HTML editor toolbar
  var toolbar = el('html-editor-toolbar');
  if (toolbar) {
    toolbar.addEventListener('click', function(e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var cmd = btn.getAttribute('data-cmd');
      var val = btn.getAttribute('data-val') || null;
      if (cmd === 'createlink') {
        // Sandbox-safe: show inline URL input instead of prompt()
        showLinkUrlInput();
      } else if (cmd) {
        execCmd(cmd, val);
      }
      el('html-editor-content').focus();
    });
  }

  // Close modal on overlay click
  el('modal-overlay').addEventListener('click', function(e) {
    if (e.target === el('modal-overlay')) closeEditor();
  });

  // Close sub-modal (lesson editor / quiz editor) on backdrop click — only if clicking directly on backdrop
  var backdrop = el('sub-modal-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', function(e) {
      if (e.target !== backdrop) return;
      var ytPanel = el('youtube-editor-panel');
      var pdfPanel = el('pdf-editor-panel');
      var quizPanel = el('quiz-question-editor-panel');
      var srcPanel = el('source-link-editor-panel');
      var lessonPanel = el('lesson-editor-panel');
      if (ytPanel && ytPanel.style.display !== 'none') {
        closeYoutubeEditor();
      } else if (pdfPanel && pdfPanel.style.display !== 'none') {
        closePdfEditor();
      } else if (quizPanel && quizPanel.style.display !== 'none') {
        closeQuizQuestionEditor();
      } else if (srcPanel && srcPanel.style.display !== 'none') {
        closeSourceLinkEditor();
      } else if (lessonPanel && lessonPanel.style.display !== 'none') {
        cancelLessonEditor();
      }
    });
  }

  // Keyboard: Escape — close popups in order (deepest first)
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var ytPanel = el('youtube-editor-panel');
      var pdfPanel = el('pdf-editor-panel');
      var quizPanel = el('quiz-question-editor-panel');
      var srcPanel = el('source-link-editor-panel');
      var lessonPanel = el('lesson-editor-panel');
      if (ytPanel && ytPanel.style.display !== 'none') {
        closeYoutubeEditor();
      } else if (pdfPanel && pdfPanel.style.display !== 'none') {
        closePdfEditor();
      } else if (quizPanel && quizPanel.style.display !== 'none') {
        closeQuizQuestionEditor();
      } else if (srcPanel && srcPanel.style.display !== 'none') {
        closeSourceLinkEditor();
      } else if (lessonPanel && lessonPanel.style.display !== 'none') {
        cancelLessonEditor();
      } else if (el('modal-overlay').style.display !== 'none') {
        closeEditor();
      } else if (currentView === 'lesson-detail') {
        openSection(currentSectionId);
      } else if (currentView === 'lessons') {
        showSections();
      } else if (currentView === 'manager') {
        showSections();
      }
    }
  });
}

/* ═══════════════════════════════════════════
   ENTRY POINT
   ═══════════════════════════════════════════ */

tool.onReady(function(val, fields) {
  // Global safety: ensure loading overlay is never stuck forever
  setTimeout(function() {
    if (el('loading-overlay').style.display !== 'none') {
      el('loading-overlay').style.display = 'none';
      console.warn('[SelfPaced] Loading overlay forcibly hidden after 12s safety timeout.');
    }
  }, 12000);

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

  SECTIONS_TYPE = tool.param('sectionsTypeId', 'selfPacedSections-uniconbaseapps');

  loadProgress(val);
  checkManagerRole();
  bindEvents();

  if (tool.isReadOnly()) lockUI(true);

  if (isManager && !isReadOnly) {
    el('btn-manager-toggle').style.display = '';
  } else if (isManager) {
    el('btn-manager-toggle').style.display = 'none';
  } else {
    el('btn-manager-toggle').style.display = 'none';
  }

  tool.onValueChange(function(v) { loadProgress(v); renderCurrentView(); });
  tool.onReadonlyChange(function(ro) { lockUI(ro); renderCurrentView(); });
  tool.onUserChange(function() { checkManagerRole(); renderCurrentView(); });

  loadSections(function() {
    updateProgressBar();
    renderSections();
    tool.resize();
  });
});
