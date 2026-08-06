/* ── Self-Paced Education by Section (STUDENT TOOL) ──
   Reads curriculum from a Curriculum Builder CMS object.
   Progress stored locally per student via tool.setValue().
   Built for UniconHub CMS html-tool system.
────────────────────────────────────────── */

/* ── Helpers ── */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function el(id) { return document.getElementById(id); }

/* ── State ── */
var CONFIG = { curriculumSourceId: '' }; // Object-level config (set by admin per object)
var SECTIONS = [];            // Section array from curriculum
var PROGRESS = {};            // { sectionId: { lessonId: { status, score, completedAt, quizAnswers, ... } } }
var currentView = 'sections'; // 'sections' | 'lessons' | 'lesson-detail' | 'setup'
var currentSectionId = null;
var currentLessonId = null;
var quizAnswers = {};
var quizSubmitted = false;
var availableCurriculums = []; // Cached list of Builder objects for the setup picker

/* ── Constants ── */
var SECTIONS_TYPE = 'curriculum-builder-uniconbaseapps';
var MIN_PASS_SCORE = 60;
var QUIZ_SETS = 3;
var QUIZ_PER_SET = 5;
var STUDY_WAIT_MIN = 30;

/* ── Role check ── */
function isAdmin() {
  var user = tool.getUser();
  if (!user) return false;
  var roles = user.roles || [];
  for (var i = 0; i < roles.length; i++) {
    var r = (roles[i] || '').toLowerCase();
    if (r === 'admin' || r === 'developer' || r === 'owner') return true;
  }
  return false;
}

/* ── YouTube ID extraction ── */
function extractYouTubeId(url) {
  if (!url) return null;
  url = url.trim().replace(/&amp;/g, '&');
  var m = url.match(/(?:youtu\.be\/|embed\/|[?&]v=)([a-zA-Z0-9_-]{8,15})(?:[?\/\#&]|$)/);
  return m ? m[1] : null;
}

function normalizePdfArray(field) {
  if (!field) return [];
  if (typeof field === 'string') return [field];
  if (Array.isArray(field)) return JSON.parse(JSON.stringify(field));
  return [];
}

function hasLessonVideo(les) {
  return les.youtubeUrls && Array.isArray(les.youtubeUrls) && les.youtubeUrls.length > 0;
}

/* ═══════════════════════════════════════════
   DATA HELPERS
   ═══════════════════════════════════════════ */

function getSortedSections() {
  return SECTIONS.slice().sort(function(a, b) {
    return (a.order || 9999) - (b.order || 9999);
  });
}

function getLessons(section) {
  var lessons = section.lessons || [];
  return lessons.slice().sort(function(a, b) {
    return (a.order || 9999) - (b.order || 9999);
  });
}

function getAllLessonsInOrder() {
  var result = [];
  var sorted = getSortedSections();
  for (var i = 0; i < sorted.length; i++) {
    var lessons = getLessons(sorted[i]);
    for (var j = 0; j < lessons.length; j++) {
      result.push({ sectionId: sorted[i].id, sectionName: sorted[i].title || '', lessonId: lessons[j].id, lesson: lessons[j] });
    }
  }
  return result;
}

function getLessonProgress(sectionId, lessonId) {
  var sp = PROGRESS[sectionId];
  if (!sp) return { status: 'not_started' };
  return sp[lessonId] || { status: 'not_started' };
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

function isLessonAccessible(sectionId, lessonId) {
  var all = getAllLessonsInOrder();
  var targetIdx = -1;
  for (var i = 0; i < all.length; i++) {
    if (all[i].sectionId === sectionId && all[i].lessonId === lessonId) { targetIdx = i; break; }
  }
  if (targetIdx === -1) return false;
  if (targetIdx === 0) return true;
  for (var i = 0; i < targetIdx; i++) {
    if (getLessonProgress(all[i].sectionId, all[i].lessonId).status !== 'completed') return false;
  }
  return true;
}

function isSectionAccessible(sectionId) {
  var section = findSection(sectionId);
  if (!section) return false;
  var lessons = getLessons(section);
  if (lessons.length === 0) return true;
  return isLessonAccessible(sectionId, lessons[0].id);
}

function getSectionProgressSummary(sectionId) {
  var section = findSection(sectionId);
  if (!section) return { status: 'not_started', completed: 0, total: 0 };
  var lessons = getLessons(section);
  var completed = 0;
  for (var j = 0; j < lessons.length; j++) {
    if (getLessonProgress(sectionId, lessons[j].id).status === 'completed') completed++;
  }
  var total = lessons.length;
  var status = total === 0 ? 'not_started' : completed === total ? 'completed' : completed > 0 ? 'in_progress' : 'not_started';
  return { status: status, completed: completed, total: total };
}

function findSection(sectionId) {
  for (var i = 0; i < SECTIONS.length; i++) {
    if (SECTIONS[i].id === sectionId) return SECTIONS[i];
  }
  return null;
}

function findLesson(section, lessonId) {
  var lessons = getLessons(section);
  for (var i = 0; i < lessons.length; i++) {
    if (lessons[i].id === lessonId) return lessons[i];
  }
  return null;
}

function getNextLesson(sectionId, lessonId) {
  var all = getAllLessonsInOrder();
  for (var i = 0; i < all.length - 1; i++) {
    if (all[i].sectionId === sectionId && all[i].lessonId === lessonId) return all[i + 1];
  }
  return null;
}

function getPrevLesson(sectionId, lessonId) {
  var all = getAllLessonsInOrder();
  for (var i = 1; i < all.length; i++) {
    if (all[i].sectionId === sectionId && all[i].lessonId === lessonId) return all[i - 1];
  }
  return null;
}

/* ── Persist progress (preserves config) ── */
function saveProgress() {
  tool.setValue({ config: CONFIG, progress: PROGRESS });
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

  console.warn('[SelfPaced] renderSections called. SECTIONS.length=' + SECTIONS.length + ', sorted.length=' + sorted.length);
  console.warn('[SelfPaced] grid element =', grid, ', empty element =', empty);

  var filtered = sorted.filter(function(s) {
    var name = (s.title || '').toLowerCase();
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
        '<div class="section-group-card-title">' + esc(s.title || 'Untitled') + '</div>' +
        '<div class="section-group-card-meta">' +
          '<span>📚 ' + lessonsCount + ' lesson' + (lessonsCount !== 1 ? 's' : '') + '</span>' +
          '<span>✅ ' + summary.completed + '/' + summary.total + ' done</span>' +
        '</div>' + lockHtml +
      '</div>';
    }).join('');
  }
  updateProgressBar();
}

/* ═══════════════════════════════════════════
   RENDER: LESSONS LIST
   ═══════════════════════════════════════════ */

function renderLessons() {
  var section = findSection(currentSectionId);
  if (!section) { showSections(); return; }
  var lessons = getLessons(section);
  var summary = getSectionProgressSummary(section.id);

  el('section-info-title').textContent = '📁 ' + (section.title || 'Section');
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
      var scoreHtml = typeof prog.score === 'number' ? ' · Score: ' + prog.score + '%' : '';

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
            (les.quiz && les.quiz.length ? '<span>📝 Quiz</span>' : '') + scoreHtml +
          '</div>' +
        '</div>' +
        '<span class="lesson-card-badge ' + badgeClass + '">' + badgeLabel + '</span>' +
      '</div>';
    }).join('');
  }
  updateProgressBar();
}

/* ═══════════════════════════════════════════
   RENDER: LESSON DETAIL (Step-by-Step Flow)
   ═══════════════════════════════════════════ */

function renderLessonDetail() {
  var section = findSection(currentSectionId);
  if (!section) { showSections(); return; }
  var lesson = findLesson(section, currentLessonId);
  if (!lesson) { openSection(currentSectionId); return; }

  var prog = getLessonProgress(section.id, lesson.id);

  el('detail-breadcrumb').innerHTML =
    '<span onclick="showSections()">📚 All Sections</span> › ' +
    '<span onclick="openSection(\'' + esc(section.id) + '\')">' + esc(section.title || 'Section') + '</span> › ' +
    '<span>' + esc(lesson.title || 'Lesson') + '</span>';

  el('detail-title').textContent = lesson.title || 'Untitled Lesson';
  el('detail-estimated').textContent = '⏱️ Estimated: ' + (lesson.estimatedMinutes || '—') + ' min';

  var badge = el('detail-badge');
  var statusLabels = { not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed' };
  var statusClasses = { not_started: 'status-not_started', in_progress: 'status-in_progress', completed: 'status-completed' };
  badge.textContent = statusLabels[prog.status] || 'Not Started';
  badge.className = 'detail-badge ' + (statusClasses[prog.status] || 'status-not_started');
  el('detail-status-label').textContent = typeof prog.score === 'number' ? ' | Score: ' + prog.score + '%' : '';

  var youtubeUrls = normalizePdfArray(lesson.youtubeUrls);
  var presentationPdfs = normalizePdfArray(lesson.presentationPdfUrls);
  var studyDocPdfs = normalizePdfArray(lesson.studyDocPdfUrls);
  var worksheetPdfs = normalizePdfArray(lesson.worksheetPdfUrls);
  var answerKeyPdfs = normalizePdfArray(lesson.answerKeyPdfUrls);
  var content = lesson.content || '';

  var quizData = lesson.quiz;
  if (quizData && typeof quizData === 'string') { try { quizData = JSON.parse(quizData); } catch(e) { quizData = null; } }
  var hasQuiz = quizData && Array.isArray(quizData) && quizData.length > 0;

  var steps = [];
  var stepNum = 0;

  if (youtubeUrls.length > 0) {
    stepNum++;
    var videoIds = [];
    for (var vi = 0; vi < youtubeUrls.length; vi++) { var vid = extractYouTubeId(youtubeUrls[vi]); if (vid) videoIds.push(vid); }
    steps.push({ num: stepNum, icon: '🎬', title: 'Watch Video' + (videoIds.length > 1 ? 's' : ''), type: 'video', videoIds: videoIds, hasContent: videoIds.length > 0 });
  }
  if (presentationPdfs.length > 0) { stepNum++; steps.push({ num: stepNum, icon: '📊', title: 'Review Presentation' + (presentationPdfs.length > 1 ? 's' : ''), type: 'pdfs', pdfUrls: presentationPdfs, label: 'Presentation Slide', hasContent: true }); }
  if (studyDocPdfs.length > 0) { stepNum++; steps.push({ num: stepNum, icon: '📖', title: 'Read Study Document' + (studyDocPdfs.length > 1 ? 's' : ''), type: 'pdfs', pdfUrls: studyDocPdfs, label: 'Study Material', hasContent: true }); }
  if (worksheetPdfs.length > 0) { stepNum++; steps.push({ num: stepNum, icon: '📝', title: 'Complete Worksheet' + (worksheetPdfs.length > 1 ? 's' : ''), type: 'pdfs', pdfUrls: worksheetPdfs, label: 'Worksheet', hasContent: true }); }
  if (answerKeyPdfs.length > 0) { stepNum++; steps.push({ num: stepNum, icon: '🔑', title: 'Check Answer Key' + (answerKeyPdfs.length > 1 ? 's' : ''), type: 'pdfs', pdfUrls: answerKeyPdfs, label: 'Answer Key', hasContent: true }); }
  if (content && content !== '<br>' && content !== '<br>') { stepNum++; steps.push({ num: stepNum, icon: '📄', title: 'Lesson Notes', type: 'html', html: content, hasContent: true }); }
  if (hasQuiz) { stepNum++; steps.push({ num: stepNum, icon: '📝', title: 'Knowledge Check', type: 'quiz', quizData: quizData, hasContent: true }); }

  var flowEl = el('study-flow');
  var html = '';

  if (steps.length === 0) {
    html = '<div class="study-flow-empty"><div class="empty-icon">📖</div><div class="empty-title">No study materials yet</div><div class="empty-desc">This lesson has no content. A manager needs to add materials.</div></div>';
  } else {
    html = '<div class="study-steps">';
    for (var si = 0; si < steps.length; si++) {
      var step = steps[si];
      var stepId = 'study-step-' + si;
      var isLast = si === steps.length - 1;
      html += '<div class="study-step" id="' + stepId + '">';
      // Connector line between steps
      if (!isLast) html += '<div class="study-step-connector"></div>';
      // Step header
      html += '<div class="study-step-header" onclick="toggleStudyStep(\'' + stepId + '\')">';
      html += '<div class="study-step-badge">' + step.num + '</div>';
      html += '<div class="study-step-info">';
      html += '<div class="study-step-icon">' + step.icon + '</div>';
      html += '<div class="study-step-title">' + esc(step.title) + '</div>';
      html += '</div>';
      html += '<div class="study-step-toggle">▼</div>';
      html += '</div>';
      // Step body
      html += '<div class="study-step-body">';

      if (step.type === 'video') {
        for (var vj = 0; vj < step.videoIds.length; vj++) {
          html += '<div class="study-embed">';
          if (step.videoIds.length > 1) html += '<div class="study-embed-label">🎬 Video ' + (vj+1) + ' of ' + step.videoIds.length + '</div>';
          html += '<div class="embed-container youtube-container"><iframe src="https://www.youtube.com/embed/' + step.videoIds[vj] + '?modestbranding=1&rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div></div>';
        }
      } else if (step.type === 'pdfs') {
        for (var pj = 0; pj < step.pdfUrls.length; pj++) {
          html += '<div class="study-embed">';
          if (step.pdfUrls.length > 1) html += '<div class="study-embed-label">' + esc(step.label) + ' ' + (pj+1) + ' of ' + step.pdfUrls.length + '</div>';
          html += '<div class="embed-container pdf-container"><iframe src="' + esc(step.pdfUrls[pj]) + '#toolbar=1&navpanes=1" frameborder="0" allowfullscreen></iframe></div>';
          html += '<a class="embed-download-link" href="' + esc(step.pdfUrls[pj]) + '" target="_blank" rel="noopener">📥 Download ' + esc(step.label) + '</a></div>';
        }
      } else if (step.type === 'html') {
        html += '<div class="detail-content">' + step.html + '</div>';
      } else if (step.type === 'quiz') {
        html += '<div class="study-quiz-wrap">' + renderQuizInFlow(step.quizData, prog, currentSectionId, currentLessonId) + '</div>';
      }

      html += '</div></div>';
    }
    html += '</div>';
  }
  flowEl.innerHTML = html;

  setTimeout(function() {
    var allSteps = flowEl.querySelectorAll('.study-step');
    var expanded = false;
    if (prog.status === 'completed' && hasQuiz) {
      for (var es = 0; es < allSteps.length; es++) {
        if (steps[es] && steps[es].type === 'quiz') { allSteps[es].classList.add('expanded'); expanded = true; break; }
      }
    }
    if (!expanded && allSteps.length > 0) allSteps[0].classList.add('expanded');
  }, 50);

  // Source links
  var sourcesArea = el('source-links-area');
  var sourcesList = el('source-links-list');
  var sourceUrls = lesson.sourceUrls;
  if (sourceUrls && typeof sourceUrls === 'string') { try { sourceUrls = JSON.parse(sourceUrls); } catch(e) { sourceUrls = null; } }
  if (sourceUrls && Array.isArray(sourceUrls) && sourceUrls.length > 0) {
    sourcesArea.style.display = '';
    sourcesList.innerHTML = sourceUrls.map(function(s) { return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">🔗 ' + esc(s.label || s.url) + '</a></li>'; }).join('');
  } else {
    sourcesArea.style.display = 'none';
  }

  var prevLesson = getPrevLesson(section.id, lesson.id);
  var nextLesson = getNextLesson(section.id, lesson.id);
  el('btn-prev-lesson').disabled = !prevLesson;
  el('btn-next-lesson').disabled = !nextLesson || (nextLesson && !isLessonAccessible(nextLesson.sectionId, nextLesson.lessonId));

  if (prog.status === 'completed') {
    el('btn-mark-complete').style.display = 'none';
    el('btn-mark-inprogress').style.display = '';
  } else {
    el('btn-mark-complete').style.display = '';
    el('btn-mark-inprogress').style.display = 'none';
  }

  tool.resize();
}

function toggleStudyStep(stepId) {
  var step = el(stepId);
  if (!step) return;
  step.classList.toggle('expanded');
  tool.resize();
}

/* ═══════════════════════════════════════════
   QUIZ IN STUDY FLOW
   ═══════════════════════════════════════════ */

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
    html += '<div class="quiz-study-timer"><div class="quiz-study-icon">📚</div><div class="quiz-study-title">Study Time</div><div class="quiz-study-desc">Review the materials above for at least <strong>' + STUDY_WAIT_MIN + ' minutes</strong> before your next attempt.</div><div class="quiz-study-countdown">⏳ ~' + studyRemaining + ' min remaining</div><div class="quiz-study-attempts">Best score so far: ' + (typeof prog.score === 'number' ? prog.score + '%' : '—') + '</div></div>';
    setTimeout(function() { renderLessonDetail(); }, 30000);
  } else if (activeQuestions.length > 0 && !isCompleted) {
    html += '<div class="quiz-set-label">Question Set ' + (currentSet + 1) + ' of ' + QUIZ_SETS + '</div>';
    html += activeQuestions.map(function(q, qi) {
      var opts = (q.options || []).map(function(opt, oi) {
        var selected = quizAnswers[qi] === oi;
        var correctClass = '';
        if (wasSubmitted) { if (oi === q.answer) correctClass = ' correct'; else if (selected && oi !== q.answer) correctClass = ' incorrect'; }
        return '<label class="quiz-option' + (selected ? ' selected' : '') + correctClass + '"><input type="radio" name="q' + qi + '" value="' + oi + '" ' + (selected ? 'checked' : '') + ' ' + (wasSubmitted ? 'disabled' : '') + '><span>' + esc(opt) + '</span></label>';
      }).join('');
      var expHtml = '';
      if (isCompleted && q.explanation_correct) expHtml += '<div class="quiz-explanation correct">✅ ' + esc(q.explanation_correct) + '</div>';
      if (wasSubmitted && q.explanations_incorrect && Array.isArray(q.explanations_incorrect)) {
        for (var ei = 0; ei < q.explanations_incorrect.length; ei++) {
          if (q.explanations_incorrect[ei] && ei !== q.answer) expHtml += '<div class="quiz-explanation incorrect">❌ Option ' + (ei+1) + ': ' + esc(q.explanations_incorrect[ei]) + '</div>';
        }
      }
      return '<div class="quiz-question"><div class="quiz-q-text">' + (qi+1) + '. ' + esc(q.question) + (q.difficulty ? ' <span class="quiz-difficulty difficulty-' + q.difficulty + '">' + q.difficulty + '</span>' : '') + '</div>' + opts + expHtml + '</div>';
    }).join('');

    if (!wasSubmitted) {
      html += '<div class="quiz-actions"><button class="btn btn-primary" id="btn-submit-quiz-inline">Submit Answers</button></div>';
      html += '<div class="quiz-result" id="quiz-result-inline" style="display:none"></div>';
    } else if (!isCompleted && !isStudying) {
      var score = calcQuizScore(activeQuestions, prog.quizAnswers);
      var passed = score >= MIN_PASS_SCORE;
      html += '<div class="quiz-result ' + (passed ? 'pass' : 'fail') + '" style="display:block">Quiz ' + (passed ? 'passed' : 'failed') + ' — Score: ' + score + '%' + (passed ? '' : ' (need ' + MIN_PASS_SCORE + '%)') + '</div>';
      if (!passed && currentSet < QUIZ_SETS - 1) html += '<div class="quiz-actions"><button class="btn btn-outline" id="btn-retry-quiz-inline">🔄 Retry Quiz</button></div>';
    }
  } else if (isCompleted) {
    html += '<div class="quiz-set-label">✅ Quiz Completed — All Sets Passed</div>';
    html += quizData.map(function(q, qi) {
      var myAnswer = prog.quizAnswers && typeof prog.quizAnswers[qi] === 'number' ? prog.quizAnswers[qi] : -1;
      var optsHTML = (q.options || []).map(function(opt, oi) {
        var cls = oi === q.answer ? ' correct' : (oi === myAnswer && oi !== q.answer ? ' incorrect' : '');
        return '<label class="quiz-option' + cls + '" style="cursor:default"><input type="radio" disabled ' + (oi === myAnswer ? 'checked' : '') + '><span>' + esc(opt) + (oi === q.answer ? ' ✓' : '') + '</span></label>';
      }).join('');
      var exp = q.explanation_correct ? '<div class="quiz-explanation correct">✅ ' + esc(q.explanation_correct) + '</div>' : '';
      return '<div class="quiz-question"><div class="quiz-q-text">' + (qi+1) + '. ' + esc(q.question) + (q.difficulty ? ' <span class="quiz-difficulty difficulty-' + q.difficulty + '">' + q.difficulty + '</span>' : '') + '</div>' + optsHTML + exp + '</div>';
    }).join('');
    html += '<div class="quiz-result pass" style="display:block">✅ Quiz passed! Final score: ' + (typeof prog.score === 'number' ? prog.score + '%' : '—') + '</div>';
  }

  // Bind interactions after render
  setTimeout(function() {
    var submitBtn = el('btn-submit-quiz-inline');
    var retryBtn = el('btn-retry-quiz-inline');
    if (submitBtn) submitBtn.addEventListener('click', function() {
      var allAnswered = true;
      for (var qi = 0; qi < activeQuestions.length; qi++) { if (typeof quizAnswers[qi] !== 'number') { allAnswered = false; break; } }
      if (!allAnswered) { tool.notify('Please answer all questions before submitting.', 'warning'); return; }
      submitQuiz(quizData);
    });
    if (retryBtn) retryBtn.addEventListener('click', function() { retryQuiz(); });
    if (!wasSubmitted) {
      var flowEl = el('study-flow');
      if (!flowEl) return;
      var radios = flowEl.querySelectorAll('input[type="radio"]');
      for (var r = 0; r < radios.length; r++) {
        radios[r].addEventListener('change', function() {
          var qi = parseInt(this.name.replace('q', ''));
          quizAnswers[qi] = parseInt(this.value);
          var allOpts = flowEl.querySelectorAll('.quiz-option');
          for (var ao = 0; ao < allOpts.length; ao++) allOpts[ao].classList.remove('selected');
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
  for (var i = 0; i < quizData.length; i++) { if (answers[i] === quizData[i].answer) correct++; }
  return quizData.length > 0 ? Math.round((correct / quizData.length) * 100) : 0;
}

/* ═══════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════ */

function showSections() {
  currentView = 'sections'; currentSectionId = null; currentLessonId = null;
  el('view-sections').style.display = '';
  el('view-lessons').style.display = 'none';
  el('view-lesson-detail').style.display = 'none';
  el('btn-back').style.display = 'none';
  el('app-title').textContent = '📚 Self-Paced Learning';
  el('search-input').value = ''; el('filter-status').value = 'all';
  renderSections();
  tool.resize();
}

function openSection(sectionId) {
  if (!isSectionAccessible(sectionId)) { tool.notify('🔒 You must complete all previous sections first.', 'warning'); return; }
  currentView = 'lessons'; currentSectionId = sectionId; currentLessonId = null;
  el('view-sections').style.display = 'none';
  el('view-lessons').style.display = '';
  el('view-lesson-detail').style.display = 'none';
  el('btn-back').style.display = '';
  var section = findSection(sectionId);
  el('app-title').textContent = '📁 ' + (section ? (section.title || 'Section') : 'Section');
  renderLessons();
  window.scrollTo(0, 0);
  tool.resize();
}

function openLesson(sectionId, lessonId) {
  if (!isLessonAccessible(sectionId, lessonId)) { tool.notify('🔒 You must complete all previous lessons first.', 'warning'); return; }
  currentView = 'lesson-detail'; currentSectionId = sectionId; currentLessonId = lessonId;
  el('view-sections').style.display = 'none';
  el('view-lessons').style.display = 'none';
  el('view-lesson-detail').style.display = '';
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
  for (var i = 0; i < all.length; i++) { if (all[i].sectionId === currentSectionId && all[i].lessonId === currentLessonId) { idx = i; break; } }
  if (idx === -1) return;
  var newIdx = idx + direction;
  if (newIdx >= 0 && newIdx < all.length) openLesson(all[newIdx].sectionId, all[newIdx].lessonId);
}

function handleBack() {
  if (currentView === 'lesson-detail') openSection(currentSectionId);
  else if (currentView === 'lessons') showSections();
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
  if (quizData && typeof quizData === 'string') { try { quizData = JSON.parse(quizData); } catch(e) { quizData = null; } }
  var hasQuiz = quizData && Array.isArray(quizData) && quizData.length > 0;

  if (hasQuiz && quizSubmitted) {
    var prog = getLessonProgress(currentSectionId, currentLessonId);
    if (prog.status !== 'completed' && typeof prog.score === 'number' && prog.score < MIN_PASS_SCORE) {
      tool.notify('You must retry and pass the quiz (≥' + MIN_PASS_SCORE + '%) before completing.', 'warning');
      return;
    }
  }

  if (hasQuiz && !quizSubmitted) {
    var allAnswered = true;
    for (var qi = 0; qi < quizData.length; qi++) { if (typeof quizAnswers[qi] !== 'number') { allAnswered = false; break; } }
    if (!allAnswered) { tool.notify('Please answer all quiz questions before marking complete.', 'warning'); return; }
    submitQuiz(quizData);
    return;
  }

  if (!PROGRESS[currentSectionId]) PROGRESS[currentSectionId] = {};
  PROGRESS[currentSectionId][currentLessonId] = { status: 'completed', score: null, completedAt: new Date().toISOString(), quizAttempts: [], quizAnswers: {} };
  saveProgress();
  renderLessonDetail();
  updateProgressBar();
  tool.notify('Lesson marked as complete! ✅', 'success');

  var next = getNextLesson(currentSectionId, currentLessonId);
  if (next && isLessonAccessible(next.sectionId, next.lessonId)) setTimeout(function() { openLesson(next.sectionId, next.lessonId); }, 800);
  else setTimeout(function() { openSection(currentSectionId); }, 800);
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
  var prog = getLessonProgress(currentSectionId, currentLessonId);
  var currentSet = typeof prog.currentSet === 'number' ? prog.currentSet : 0;
  if (currentSet >= QUIZ_SETS) currentSet = QUIZ_SETS - 1;
  var setStart = currentSet * QUIZ_PER_SET;
  var setEnd = Math.min(setStart + QUIZ_PER_SET, quizData.length);
  var activeQuestions = quizData.slice(setStart, setEnd);
  var score = calcQuizScore(activeQuestions, quizAnswers);
  var passed = score >= MIN_PASS_SCORE;
  var attempts = (prog.quizAttempts && Array.isArray(prog.quizAttempts)) ? prog.quizAttempts.slice() : [];
  attempts.push({ setIndex: currentSet, score: score, timestamp: new Date().toISOString() });

  if (!PROGRESS[currentSectionId]) PROGRESS[currentSectionId] = {};

  if (passed) {
    PROGRESS[currentSectionId][currentLessonId] = { status: 'completed', score: score, completedAt: new Date().toISOString(), quizAttempts: attempts, currentSet: 0, studyUntil: null, quizAnswers: JSON.parse(JSON.stringify(quizAnswers)) };
  } else {
    var nextSet = currentSet + 1;
    if (nextSet >= QUIZ_SETS) nextSet = 0;
    PROGRESS[currentSectionId][currentLessonId] = { status: 'studying', score: score, completedAt: null, quizAttempts: attempts, currentSet: nextSet, studyUntil: new Date(Date.now() + STUDY_WAIT_MIN * 60 * 1000).toISOString(), quizAnswers: JSON.parse(JSON.stringify(quizAnswers)) };
  }

  quizSubmitted = true;
  saveProgress();
  renderLessonDetail();
  updateProgressBar();

  if (passed) {
    tool.notify('Quiz passed! Score: ' + score + '% ✅', 'success');
    var next = getNextLesson(currentSectionId, currentLessonId);
    if (next && isLessonAccessible(next.sectionId, next.lessonId)) setTimeout(function() { openLesson(next.sectionId, next.lessonId); }, 1200);
    else setTimeout(function() { openSection(currentSectionId); }, 1200);
  } else {
    tool.notify('Score: ' + score + '%. Study for ' + STUDY_WAIT_MIN + ' minutes, then try again.', 'warning');
  }
}

function retryQuiz() {
  var prog = getLessonProgress(currentSectionId, currentLessonId);
  var studyUntil = prog.studyUntil ? new Date(prog.studyUntil) : null;
  if (studyUntil && studyUntil > new Date()) { tool.notify('Please study for ' + Math.ceil((studyUntil - new Date()) / 60000) + ' more minute(s).', 'warning'); return; }
  quizSubmitted = false;
  quizAnswers = {};
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
   DATA LOADING
   ═══════════════════════════════════════════ */

function loadCurriculum(callback) {
  var sourceId = CONFIG.curriculumSourceId;
  var fieldName = tool.param('builderFieldName', '');

  console.warn('[SelfPaced] loadCurriculum called');
  console.warn('[SelfPaced] curriculumSourceId =', JSON.stringify(sourceId));
  console.warn('[SelfPaced] builderFieldName  =', JSON.stringify(fieldName));
  console.warn('[SelfPaced] sectionsTypeId    =', JSON.stringify(SECTIONS_TYPE));

  if (!sourceId) {
    console.warn('[SelfPaced] No curriculumSourceId configured');
    SECTIONS = [];
    if (callback) callback();
    renderCurrentView();
    updateProgressBar();
    tool.resize();
    return;
  }

  showLoading(true);

  var queryParams = { mainObjectType: SECTIONS_TYPE };
  console.warn('[SelfPaced] Calling requestObjects("query",', JSON.stringify(queryParams), ')');

  // Query all objects of this type, then find by contentId (stable, admin-controlled)
  tool.requestObjects('query', queryParams, function(err, result) {
    showLoading(false);
    console.warn('[SelfPaced] requestObjects callback fired');
    console.warn('[SelfPaced] err   =', JSON.stringify(err));
    console.warn('[SelfPaced] result=', JSON.stringify(result ? (result.objects ? '(has .objects, length='+result.objects.length+')' : '(no .objects)') : '(null/undefined)'));
    console.warn('[SelfPaced] result (full) =', JSON.stringify(result));

    if (err) {
      tool.notify('Error loading curriculum: ' + JSON.stringify(err), 'error');
      SECTIONS = [];
    } else {
      // Try multiple possible result shapes: { objects: [...] }, { items: [...] }, or plain array
      var objects = [];
      if (result) {
        if (Array.isArray(result)) { objects = result; console.warn('[SelfPaced] result is a plain array, length=' + result.length); }
        else if (Array.isArray(result.objects)) { objects = result.objects; console.warn('[SelfPaced] using result.objects, length=' + result.objects.length); }
        else if (Array.isArray(result.items)) { objects = result.items; console.warn('[SelfPaced] using result.items, length=' + result.items.length); }
        else if (Array.isArray(result.data)) { objects = result.data; console.warn('[SelfPaced] using result.data, length=' + result.data.length); }
        else { console.warn('[SelfPaced] result is not an array and has no .objects/.items/.data arrays. Keys:', Object.keys(result)); }
      }

      // Diagnostic: show what we found
      var contentIdsFound = [];
      for (var k = 0; k < objects.length; k++) {
        var cid = objects[k].contentId || objects[k].id || '(no id)';
        contentIdsFound.push(cid);
      }

      console.warn('[SelfPaced] objects extracted count =', objects.length);
      console.warn('[SelfPaced] contentIds found =', JSON.stringify(contentIdsFound));
      console.warn('[SelfPaced] looking for contentId =', JSON.stringify(sourceId));

      if (objects.length === 0) {
        tool.notify('Query returned 0 objects of type "' + SECTIONS_TYPE + '". Check: 1) An object of this type exists, 2) The type ID matches exactly.', 'error');
        SECTIONS = [];
      } else {
        var found = null;
        for (var i = 0; i < objects.length; i++) {
          if (objects[i].contentId === sourceId) { found = objects[i]; break; }
        }
        if (!found) {
          tool.notify('Found ' + objects.length + ' object(s) but none with contentId="' + sourceId + '". ContentIds found: ' + contentIdsFound.join(', '), 'error');
          SECTIONS = [];
        } else {
          console.warn('[SelfPaced] Object found! Checking for sections at field "' + (fieldName || '(auto-search)') + '"');
          SECTIONS = findSectionsInObject(found, fieldName);
          console.warn('[SelfPaced] SECTIONS extracted count =', SECTIONS.length);
          if (SECTIONS.length === 0) {
            if (fieldName) {
              tool.notify('Object found but no sections at field "' + fieldName + '". Check that builderFieldName matches the field ID where the Builder is installed.', 'warning');
            } else {
              tool.notify('Object found but no sections data. Set <strong>builderFieldName</strong> to the field ID where the Curriculum Builder is installed.', 'warning');
            }
          }
        }
      }
    }
    if (callback) callback();
    renderCurrentView();
    updateProgressBar();
    tool.resize();
  });
}

/** Search a CMS object's productData for curriculum sections (set by the Builder's tool.setValue).
 *  fieldName - the tool field ID where the Curriculum Builder is installed on the CMS object.
 *  If provided, we look at that exact field. Otherwise we search all fields (less reliable). */
function findSectionsInObject(obj, fieldName) {
  var dcb = obj.productData && obj.productData.data_categoriesBased;
  if (!dcb) return [];

  // If fieldName is specified, try to find it
  if (fieldName) {
    // Case 1: data_categoriesBased.{fieldName}.sections (flat — Builder stores data directly under the field name)
    var directVal = dcb[fieldName];
    if (directVal && directVal.sections && Array.isArray(directVal.sections)) {
      return directVal.sections;
    }

    // Case 2: data_categoriesBased.{fgKey}.{fieldName}.sections (nested — older CMS patterns)
    var fgKeys = Object.keys(dcb);
    for (var i = 0; i < fgKeys.length; i++) {
      var fg = dcb[fgKeys[i]];
      if (!fg || typeof fg !== 'object') continue;
      var fieldVal = fg[fieldName];
      if (fieldVal && fieldVal.sections && Array.isArray(fieldVal.sections)) {
        return fieldVal.sections;
      }
    }
    // Field name specified but not found in either pattern
    return [];
  }

  // No fieldName — search all fields (fallback, may match wrong field)
  // Try flat first: data_categoriesBased.{key}.sections
  var allKeys = Object.keys(dcb);
  for (var j = 0; j < allKeys.length; j++) {
    var v = dcb[allKeys[j]];
    if (v && v.sections && Array.isArray(v.sections)) {
      return v.sections;
    }
  }
  // Then try nested: data_categoriesBased.{key}.{subkey}.sections
  for (var i2 = 0; i2 < allKeys.length; i2++) {
    var fg2 = dcb[allKeys[i2]];
    if (!fg2 || typeof fg2 !== 'object') continue;
    var fieldKeys = Object.keys(fg2);
    for (var k = 0; k < fieldKeys.length; k++) {
      var fieldVal2 = fg2[fieldKeys[k]];
      if (fieldVal2 && fieldVal2.sections && Array.isArray(fieldVal2.sections)) {
        return fieldVal2.sections;
      }
    }
  }
  return [];
}

function loadData(val) {
  // Load config (object-level, set by admin per object)
  if (val && val.config && typeof val.config === 'object') {
    CONFIG.curriculumSourceId = val.config.curriculumSourceId || '';
  }
  // Legacy: also check tool param for backward compat
  if (!CONFIG.curriculumSourceId) {
    CONFIG.curriculumSourceId = tool.param('curriculumSourceId', '');
  }
  // Load progress
  if (val && typeof val === 'object' && val.progress) {
    PROGRESS = val.progress;
  } else {
    PROGRESS = {};
  }
}

function renderCurrentView() {
  if (currentView === 'setup') renderSetup();
  else if (currentView === 'lesson-detail') renderLessonDetail();
  else if (currentView === 'lessons') renderLessons();
  else renderSections();
}

function updateProgressBar() {
  var pct = getOverallProgressPct();
  var all = getAllLessonsInOrder();
  var completed = 0;
  for (var i = 0; i < all.length; i++) { if (getLessonProgress(all[i].sectionId, all[i].lessonId).status === 'completed') completed++; }
  el('progress-bar-fill').style.width = pct + '%';
  el('progress-bar-text').textContent = pct + '% Complete (' + completed + ' of ' + all.length + ' lessons)';
}

function showLoading(show) { el('loading-overlay').style.display = show ? '' : 'none'; }

/* ── Role badge ── */
function updateRoleBadge(user) {
  var badge = el('role-badge');
  if (!badge) return;
  if (!user) { badge.style.display = 'none'; return; }
  badge.style.display = '';
  var name = user.name || user.displayName || user.email || user.id || 'Student';
  badge.textContent = '👤 ' + name;
}

/* ═══════════════════════════════════════════
   SETUP: Admin picks curriculum per object
   ═══════════════════════════════════════════ */

/** Fetch all Builder objects to populate the curriculum picker */
function fetchAvailableCurriculums(callback) {
  showLoading(true);
  tool.requestObjects('query', { mainObjectType: SECTIONS_TYPE }, function(err, result) {
    showLoading(false);
    if (err) {
      availableCurriculums = [];
    } else {
      var objects = [];
      if (result) {
        if (Array.isArray(result)) objects = result;
        else if (Array.isArray(result.objects)) objects = result.objects;
      }
      availableCurriculums = objects;
    }
    if (callback) callback();
  });
}

/** Show the setup screen (only for admins) */
function showSetup() {
  currentView = 'setup';
  el('view-sections').style.display = 'none';
  el('view-lessons').style.display = 'none';
  el('view-lesson-detail').style.display = 'none';
  el('view-setup').style.display = '';
  el('btn-back').style.display = 'none';
  el('btn-change-course').style.display = 'none';
  el('progress-bar-wrap').style.display = 'none';
  el('app-title').textContent = '⚙️ Course Setup';

  fetchAvailableCurriculums(function() {
    renderSetup();
  });
}

function renderSetup() {
  var select = el('setup-curriculum-select');
  var hint = el('setup-hint');

  if (availableCurriculums.length === 0) {
    select.innerHTML = '<option value="">-- No curriculums found --</option>';
    hint.innerHTML = '⚠️ No curriculum objects found. Create one with the Curriculum Builder tool first.';
    return;
  }

  var optionsHtml = '<option value="">-- Select a curriculum --</option>';
  for (var i = 0; i < availableCurriculums.length; i++) {
    var c = availableCurriculums[i];
    var cid = c.contentId || c.id || '';
    var name = c.name || cid || 'Unnamed';
    var selected = (cid === CONFIG.curriculumSourceId) ? ' selected' : '';
    optionsHtml += '<option value="' + esc(cid) + '"' + selected + '>' + esc(name) + ' (' + esc(cid) + ')</option>';
  }
  select.innerHTML = optionsHtml;

  hint.innerHTML = isAdmin()
    ? 'Select a curriculum and click Save. Only admins can change this later.'
    : '🔒 Only admins can configure the curriculum. Please contact your administrator.';
}

/** Cancel setup and return to previous view */
function cancelSetup() {
  if (CONFIG.curriculumSourceId) {
    // Curriculum already configured — go back to sections
    el('view-setup').style.display = 'none';
    el('view-sections').style.display = '';
    el('progress-bar-wrap').style.display = '';
    currentView = 'sections';
    el('app-title').textContent = '📚 Self-Paced Learning';
    updateAdminUI();
    renderSections();
    updateProgressBar();
  }
  tool.resize();
}
function saveSetupConfig() {
  if (!isAdmin()) {
    tool.notify('Only admins can configure the curriculum.', 'warning');
    return;
  }

  var selectedId = el('setup-curriculum-select').value;

  if (!selectedId) {
    tool.notify('Please select a curriculum.', 'warning');
    return;
  }

  CONFIG.curriculumSourceId = selectedId;
  saveProgress();

  tool.notify('Curriculum configured! Loading...', 'success');

  // Hide setup, show sections view
  el('view-setup').style.display = 'none';
  el('progress-bar-wrap').style.display = '';
  currentView = 'sections';

  loadCurriculum(function() {
    updateProgressBar();
    renderSections();
    updateAdminUI();
    tool.resize();
  });
}

/** Show/hide admin-only controls */
function updateAdminUI() {
  var changeBtn = el('btn-change-course');
  if (changeBtn) {
    changeBtn.style.display = (isAdmin() && CONFIG.curriculumSourceId) ? '' : 'none';
  }
  // Disable save button in setup if not admin
  var saveBtn = el('btn-setup-save');
  if (saveBtn && currentView === 'setup') {
    saveBtn.disabled = !isAdmin();
  }
}

/* ═══════════════════════════════════════════
   EVENT BINDINGS
   ═══════════════════════════════════════════ */

function bindEvents() {
  el('btn-back').addEventListener('click', handleBack);
  el('btn-prev-lesson').addEventListener('click', function() { navigateLesson(-1); });
  el('btn-next-lesson').addEventListener('click', function() { navigateLesson(1); });
  el('btn-mark-complete').addEventListener('click', markComplete);
  el('btn-mark-inprogress').addEventListener('click', markInProgress);
  el('search-input').addEventListener('input', function() { renderSections(); });
  el('filter-status').addEventListener('change', function() { renderSections(); });
  el('btn-setup-save').addEventListener('click', saveSetupConfig);
  el('btn-setup-cancel').addEventListener('click', cancelSetup);
  el('btn-change-course').addEventListener('click', function() { showSetup(); });
}

/* ═══════════════════════════════════════════
   ENTRY POINT
   ═══════════════════════════════════════════ */

tool.onReady(function(val, fields) {
  setTimeout(function() {
    if (el('loading-overlay').style.display !== 'none') el('loading-overlay').style.display = 'none';
  }, 12000);

  tool.declareParams([
    { name: 'builderFieldName', label: 'Builder Field Name (default)', type: 'text', default: '', severity: 'goodToHave', hint: 'Default field ID of the Curriculum Builder tool inside CMS objects. Can be overridden per-object in setup.' },
    { name: 'curriculumBuilderAppId', label: 'Curriculum Builder App ID', type: 'text', default: 'curriculum-builder-uniconbaseapps', severity: 'goodToHave', hint: 'The CMS object type ID of the Curriculum Builder app. Used to query curriculum objects. Default works for most cases.' }
  ]);

  // Dump ALL params for debugging
  console.warn('[SelfPaced] === TOOL STARTUP ===');
  console.warn('[SelfPaced] builderFieldName   =', JSON.stringify(tool.param('builderFieldName', '')));
  console.warn('[SelfPaced] curriculumBuilderAppId =', JSON.stringify(tool.param('curriculumBuilderAppId', '')));
  console.warn('[SelfPaced] val (onReady data) =', JSON.stringify(val));
  console.warn('[SelfPaced] fields             =', JSON.stringify(fields));
  console.warn('[SelfPaced] tool.getUser()     =', JSON.stringify(tool.getUser()));
  console.warn('[SelfPaced] SECTIONS_TYPE      =', JSON.stringify(SECTIONS_TYPE));

  var stype = tool.param('curriculumBuilderAppId', 'curriculum-builder-uniconbaseapps');
  SECTIONS_TYPE = stype || 'curriculum-builder-uniconbaseapps';

  // Load config from object data (set by admin via setup screen)
  loadData(val);
  updateRoleBadge(tool.getUser());
  bindEvents();

  console.warn('[SelfPaced] CONFIG.curriculumSourceId =', JSON.stringify(CONFIG.curriculumSourceId));
  console.warn('[SelfPaced] isAdmin() =', isAdmin());

  tool.onValueChange(function(v) {
    loadData(v);
    // If config changed externally, reload curriculum
    if (CONFIG.curriculumSourceId && currentView !== 'setup') {
      loadCurriculum(function() {
        updateProgressBar();
        renderCurrentView();
        tool.resize();
      });
    } else {
      renderCurrentView();
      updateProgressBar();
    }
  });
  tool.onUserChange(function() { updateRoleBadge(tool.getUser()); updateAdminUI(); });

  // Decide what to show
  if (!CONFIG.curriculumSourceId) {
    // No curriculum configured — show setup (admins can pick, students see message)
    showSetup();
    updateAdminUI();
    tool.resize();
  } else {
    // Curriculum is configured — load it
    updateAdminUI();
    loadCurriculum(function() {
      updateProgressBar();
      renderSections();
      tool.resize();
    });
  }
});
