/* ── Curriculum Builder ──
   Manager tool for creating and editing curriculum sections & lessons.
   Stores ONE master curriculum object in CMS.
   Built for UniconHub CMS html-tool system.
────────────────────────────────────────── */

/* ── Helpers ── */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function el(id) { return document.getElementById(id); }

/* ── State ── */
var sections = [];               // sections array from curriculum
var editingSectionIdx = null;    // Index being edited in sections array
var editingLessons = [];         // Temp array for lessons within the section being edited
var editingLessonIdx = null;     // Index being edited in editingLessons
var editingDirectSectionIdx = null; // When editing a lesson directly from main view (not via modal)
var editingQuizQuestions = [];
var editingSourceLinks = [];
var editingYoutubeUrls = [];
var editingPresentationPdfUrls = [];
var editingStudyDocPdfUrls = [];
var editingWorksheetPdfUrls = [];
var editingAnswerKeyPdfUrls = [];
var editingQuizQuestionIdx = null;
var editingQuizQuestionSetIdx = null;
var editingSourceLinkIdx = null;
var editingYoutubeIdx = null;
var editingPdfIdx = null;
var editingPdfType = null;

/* ── Constants ── */
var QUIZ_SETS = 3;
var QUIZ_PER_SET = 5;

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

/* ── Sub-modal ── */
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

/* ── HTML Editor ── */
function execCmd(cmd, val) { document.execCommand(cmd, false, val); }
function getHtmlContent() { return el('html-editor-content').innerHTML || ''; }
function setHtmlContent(html) { el('html-editor-content').innerHTML = html || ''; }

/* ── Sandbox-safe link URL input ── */
function showLinkUrlInput() {
  var existing = showLinkUrlInput._overlay;
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.className = 'link-url-overlay';
  overlay.innerHTML = '<div class="link-url-box"><div class="link-url-label">Enter URL:</div><input class="form-input" id="link-url-input" type="url" placeholder="https://..." value="https://"><div class="link-url-actions"><button class="btn btn-outline btn-sm" id="link-url-cancel">Cancel</button><button class="btn btn-primary btn-sm" id="link-url-ok">Insert Link</button></div></div>';
  document.body.appendChild(overlay);
  showLinkUrlInput._overlay = overlay;
  var input = overlay.querySelector('#link-url-input');
  setTimeout(function() { input.focus(); input.select(); }, 50);
  overlay.querySelector('#link-url-cancel').addEventListener('click', function() { overlay.remove(); showLinkUrlInput._overlay = null; });
  overlay.querySelector('#link-url-ok').addEventListener('click', function() {
    var url = input.value.trim();
    overlay.remove(); showLinkUrlInput._overlay = null;
    if (url) { el('html-editor-content').focus(); execCmd('createlink', url); }
  });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) { overlay.remove(); showLinkUrlInput._overlay = null; } });
  document.addEventListener('keydown', function onEsc(e) { if (e.key === 'Escape') { overlay.remove(); showLinkUrlInput._overlay = null; document.removeEventListener('keydown', onEsc); } });
}

/* ── Confirm dialog ── */
var _confirmCallback = null;
function sandboxConfirm(message, onYes) {
  _confirmCallback = onYes;
  el('confirm-message').textContent = message;
  el('confirm-overlay').style.display = '';
}
function hideConfirm() {
  el('confirm-overlay').style.display = 'none';
  _confirmCallback = null;
}

/* ═══════════════════════════════════════════
   DATA: LOAD & SAVE (plain tool.setValue — no CRUD)
   ═══════════════════════════════════════════ */

function loadCurriculum(val) {
  sections = (val && val.sections) ? val.sections : [];
  updateIdBadge();
  renderSections();
  tool.resize();
}

function saveCurriculum(callback) {
  if (tool.isReadOnly()) {
    tool.notify('Cannot save — the form is in read-only mode.', 'warning');
    if (callback) callback('read-only');
    return;
  }
  // Deep-clone to avoid any reference issues
  var data = JSON.parse(JSON.stringify({ sections: sections }));
  // Ensure CMS validation passes
  tool.reportValid(true, '');
  tool.setValue(data);
  // Re-render immediately (onValueChange may only fire for external changes)
  renderSections();
  if (callback) callback(null);
}

function updateIdBadge() {
  var badge = el('curriculum-id-badge');
  if (!badge) return;
  var oid = tool.param('builderObjectId', '');
  if (oid) {
    badge.textContent = '🔗 ID: ' + oid + ' (click to copy)';
    badge.title = 'Click to copy this contentId. Paste it as curriculumSourceId in the Student Self-Paced Learning tool.';
    badge.style.cursor = 'pointer';
    badge.onclick = function() {
      navigator.clipboard.writeText(oid).then(function() {
        tool.notify('Curriculum ID copied! Paste as curriculumSourceId in the Student tool.', 'success');
      }).catch(function() {
        tool.notify('Curriculum ID: ' + oid, 'info');
      });
    };
  } else {
    badge.textContent = '🔗 Set contentId param to show';
    badge.title = 'Configure the builderObjectId parameter with this CMS object\'s id field. Then click to copy for the Student tool.';
    badge.style.cursor = 'default';
    badge.onclick = null;
  }
}

/* ═══════════════════════════════════════════
   RENDER: SECTIONS LIST
   ═══════════════════════════════════════════ */

function renderSections() {
  var sorted = sections.slice().sort(function(a, b) { return (a.order || 9999) - (b.order || 9999); });
  el('manager-section-count').textContent = sorted.length + ' section(s)';
  var container = el('sections-list');
  var empty = el('sections-empty');

  if (sorted.length === 0) {
    container.innerHTML = '';
    empty.style.display = '';
  } else {
    empty.style.display = 'none';
    container.innerHTML = sorted.map(function(s, idx) {
      var realIdx = sections.indexOf(s);
      var lessonsSorted = (s.lessons || []).slice().sort(function(a,b){ return (a.order||9999)-(b.order||9999); });
      return '<div class="manager-section-card">' +
        '<div class="manager-section-header">' +
          '<div class="manager-section-header-left">' +
            '<strong>' + esc(s.title || 'Untitled') + '</strong>' +
            '<span class="section-meta">' + (s.lessons ? s.lessons.length : 0) + ' lesson(s) | Order: ' + (s.order || '—') + '</span>' +
          '</div>' +
          '<div class="manager-section-actions">' +
            '<button class="btn btn-sm btn-primary" data-add-les-sec="' + realIdx + '">+ Add Lesson</button>' +
            '<button class="btn btn-sm btn-outline" data-edit-sec="' + realIdx + '">✏️ Edit Section</button>' +
            '<button class="btn btn-sm btn-danger" data-del-sec="' + realIdx + '">🗑 Delete</button>' +
          '</div>' +
        '</div>' +
        (lessonsSorted.length > 0 ?
          '<table class="manager-lessons-table"><thead><tr><th>#</th><th>Lesson</th><th>Min</th><th>Media</th><th>Quiz</th><th>Actions</th></tr></thead><tbody>' +
          lessonsSorted.map(function(les, li) {
            var lesRealIdx = (s.lessons || []).indexOf(les);
            var media = (hasLessonVideo(les)?'🎬':'') + (les.presentationPdfUrls&&les.presentationPdfUrls.length?'📊':'') + (les.studyDocPdfUrls&&les.studyDocPdfUrls.length?'📖':'') + (les.worksheetPdfUrls&&les.worksheetPdfUrls.length?'📝':'') || '—';
            return '<tr><td>'+(li+1)+'</td><td><strong>'+esc(les.title||'Untitled')+'</strong></td><td>'+(les.estimatedMinutes||'—')+'</td><td>'+media+'</td><td>'+(les.quiz&&les.quiz.length?'✅ '+les.quiz.length+' Q':'—')+'</td>' +
              '<td><div class="table-actions"><button class="btn btn-sm btn-outline" data-edit-les-sec="' + realIdx + ':' + lesRealIdx + '">✏️</button><button class="btn btn-sm btn-danger" data-del-les-sec="' + realIdx + ':' + lesRealIdx + '">🗑</button></div></td></tr>';
          }).join('') + '</tbody></table>'
          : '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">No lessons yet. Click "+ Add Lesson" above to add one.</div>'
        ) +
      '</div>';
    }).join('');

    // Bind Add Lesson per section
    var addLesBtns = container.querySelectorAll('[data-add-les-sec]');
    for (var k = 0; k < addLesBtns.length; k++) {
      addLesBtns[k].addEventListener('click', function(e) {
        e.stopPropagation();
        startAddLessonDirect(parseInt(this.getAttribute('data-add-les-sec')));
      });
    }
    // Bind edit section
    var editBtns = container.querySelectorAll('[data-edit-sec]');
    for (var i = 0; i < editBtns.length; i++) {
      editBtns[i].addEventListener('click', function(e) {
        e.stopPropagation();
        openSectionEditor(parseInt(this.getAttribute('data-edit-sec')));
      });
    }
    // Bind delete section
    var delBtns = container.querySelectorAll('[data-del-sec]');
    for (var j = 0; j < delBtns.length; j++) {
      delBtns[j].addEventListener('click', function(e) {
        e.stopPropagation();
        deleteSection(parseInt(this.getAttribute('data-del-sec')));
      });
    }
    // Bind edit lesson (direct from main view)
    var editLesBtns = container.querySelectorAll('[data-edit-les-sec]');
    for (var l = 0; l < editLesBtns.length; l++) {
      editLesBtns[l].addEventListener('click', function(e) {
        e.stopPropagation();
        var parts = this.getAttribute('data-edit-les-sec').split(':');
        editLessonDirect(parseInt(parts[0]), parseInt(parts[1]));
      });
    }
    // Bind delete lesson (direct from main view)
    var delLesBtns = container.querySelectorAll('[data-del-les-sec]');
    for (var m = 0; m < delLesBtns.length; m++) {
      delLesBtns[m].addEventListener('click', function(e) {
        e.stopPropagation();
        var parts = this.getAttribute('data-del-les-sec').split(':');
        deleteLessonDirect(parseInt(parts[0]), parseInt(parts[1]));
      });
    }
  }
  tool.resize();
}

/* ═══════════════════════════════════════════
   SECTION EDITOR MODAL
   ═══════════════════════════════════════════ */

function openSectionEditor(idx) {
  editingSectionIdx = idx;
  editingLessons = [];
  if (idx !== null && sections[idx]) {
    var s = sections[idx];
    el('edit-section-title').value = s.title || '';
    el('edit-section-order').value = typeof s.order === 'number' ? s.order : '';
    editingLessons = JSON.parse(JSON.stringify(s.lessons || []));
    el('modal-title').textContent = 'Edit Section';
  } else {
    el('edit-section-title').value = '';
    el('edit-section-order').value = sections.length + 1;
    editingLessons = [];
    el('modal-title').textContent = 'Add New Section';
  }
  hideSubModal('lesson-editor-panel');
  el('modal-overlay').style.display = '';
  el('modal-section-fields').style.display = '';
  el('modal-lessons-area').style.display = '';
  renderLessonsEditorList();
  tool.resize();
}

function closeSectionEditor() {
  el('modal-overlay').style.display = 'none';
  editingSectionIdx = null;
  editingLessons = [];
  hideSubModal('lesson-editor-panel');
}

function saveSection() {
  var title = el('edit-section-title').value.trim();
  if (!title) { tool.notify('Section title is required.', 'warning'); return; }
  var order = parseInt(el('edit-section-order').value) || 0;

  var sectionData = {
    id: genId(),
    title: title,
    order: order,
    lessons: editingLessons.slice()
  };

  if (editingSectionIdx !== null && sections[editingSectionIdx]) {
    sectionData.id = sections[editingSectionIdx].id;
    sections[editingSectionIdx] = sectionData;
  } else {
    sections.push(sectionData);
  }

  saveCurriculum(function(err) {
    if (err) return;
    closeSectionEditor();
    tool.notify('Section saved! ✅', 'success');
  });
}

function deleteSection(idx) {
  var name = sections[idx] ? (sections[idx].title || 'this section') : 'this section';
  sandboxConfirm('Delete "' + name + '" and ALL its lessons? This cannot be undone.', function() {
    sections.splice(idx, 1);
    saveCurriculum(function(err) {
      if (err) return;
      tool.notify('Section deleted.', 'info');
    });
  });
}

/* ═══════════════════════════════════════════
   LESSONS EDITOR LIST (in modal)
   ═══════════════════════════════════════════ */

function renderLessonsEditorList() {
  var list = el('lessons-editor-list');
  el('lessons-editor-count').textContent = editingLessons.length + ' lesson(s)';
  if (editingLessons.length === 0) {
    list.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">No lessons added yet.</div>';
  } else {
    list.innerHTML = editingLessons.map(function(les, idx) {
      return '<div class="lesson-editor-item">' +
        '<div class="lesson-editor-item-info">' +
          '<div class="lesson-editor-item-title">' + (idx+1) + '. ' + esc(les.title || 'Untitled') + '</div>' +
          '<div class="lesson-editor-item-meta">⏱️ ' + (les.estimatedMinutes || '—') + ' min' +
            (hasLessonVideo(les) ? ' · 🎬' : '') +
            (les.presentationPdfUrls && les.presentationPdfUrls.length ? ' · 📊' : '') +
            (les.studyDocPdfUrls && les.studyDocPdfUrls.length ? ' · 📖' : '') +
            (les.worksheetPdfUrls && les.worksheetPdfUrls.length ? ' · 📝' : '') +
            (les.quiz && les.quiz.length ? ' · 📝 Quiz' : '') +
          '</div>' +
        '</div>' +
        '<div class="lesson-editor-item-actions">' +
          '<button class="btn btn-sm btn-outline" data-edit-les="' + idx + '">✏️</button>' +
          '<button class="btn btn-sm btn-danger" data-del-les="' + idx + '">🗑</button>' +
        '</div>' +
      '</div>';
    }).join('');

    var editBtns = list.querySelectorAll('[data-edit-les]');
    for (var i = 0; i < editBtns.length; i++) {
      editBtns[i].addEventListener('click', function(e) {
        e.stopPropagation();
        editLesson(parseInt(this.getAttribute('data-edit-les')));
      });
    }
    var delBtns = list.querySelectorAll('[data-del-les]');
    for (var j = 0; j < delBtns.length; j++) {
      delBtns[j].addEventListener('click', function(e) {
        e.stopPropagation();
        editingLessons.splice(parseInt(this.getAttribute('data-del-les')), 1);
        renderLessonsEditorList();
      });
    }
  }
}

/* ═══════════════════════════════════════════
   LESSON EDITOR (tabbed panel)
   ═══════════════════════════════════════════ */

function startAddLesson() {
  editingLessonIdx = null;
  el('edit-lesson-title').value = '';
  el('edit-lesson-order').value = editingLessons.length + 1;
  el('edit-lesson-minutes').value = '';
  editingYoutubeUrls = []; editingYoutubeIdx = null;
  renderYoutubeEditorList();
  hideSubModal('youtube-editor-panel');
  editingPresentationPdfUrls = []; editingStudyDocPdfUrls = []; editingWorksheetPdfUrls = []; editingAnswerKeyPdfUrls = [];
  editingPdfIdx = null; editingPdfType = null;
  renderPdfEditorList('presentation'); renderPdfEditorList('studyDoc'); renderPdfEditorList('worksheet'); renderPdfEditorList('answerKey');
  hideSubModal('pdf-editor-panel');
  setHtmlContent('');
  editingSourceLinks = []; editingSourceLinkIdx = null;
  renderSourceLinksEditorList();
  hideSubModal('source-link-editor-panel');
  editingQuizQuestions = []; editingQuizQuestionIdx = null;
  renderQuizEditorList();
  hideSubModal('quiz-question-editor-panel');
  showSubModal('lesson-editor-panel');
  switchLessonEditorTab('info');
  el('lesson-editor-heading').textContent = 'Add Lesson';
}

function editLesson(idx) {
  editingLessonIdx = idx;
  var les = editingLessons[idx];
  if (!les) return;
  el('edit-lesson-title').value = les.title || '';
  el('edit-lesson-order').value = typeof les.order === 'number' ? les.order : '';
  el('edit-lesson-minutes').value = les.estimatedMinutes || '';
  editingYoutubeUrls = normalizePdfArray(les.youtubeUrls);
  editingYoutubeIdx = null;
  renderYoutubeEditorList();
  hideSubModal('youtube-editor-panel');
  editingPresentationPdfUrls = normalizePdfArray(les.presentationPdfUrls);
  editingStudyDocPdfUrls = normalizePdfArray(les.studyDocPdfUrls);
  editingWorksheetPdfUrls = normalizePdfArray(les.worksheetPdfUrls);
  editingAnswerKeyPdfUrls = normalizePdfArray(les.answerKeyPdfUrls);
  editingPdfIdx = null; editingPdfType = null;
  renderPdfEditorList('presentation'); renderPdfEditorList('studyDoc'); renderPdfEditorList('worksheet'); renderPdfEditorList('answerKey');
  hideSubModal('pdf-editor-panel');
  setHtmlContent(les.content || '');
  var srcVal = les.sourceUrls;
  if (srcVal && typeof srcVal === 'string') { try { srcVal = JSON.parse(srcVal); } catch(e) { srcVal = null; } }
  editingSourceLinks = (srcVal && Array.isArray(srcVal)) ? JSON.parse(JSON.stringify(srcVal)) : [];
  editingSourceLinkIdx = null;
  renderSourceLinksEditorList();
  hideSubModal('source-link-editor-panel');
  var quizVal = les.quiz;
  if (quizVal && typeof quizVal === 'string') { try { quizVal = JSON.parse(quizVal); } catch(e) { quizVal = null; } }
  editingQuizQuestions = (quizVal && Array.isArray(quizVal)) ? JSON.parse(JSON.stringify(quizVal)) : [];
  editingQuizQuestionIdx = null;
  renderQuizEditorList();
  hideSubModal('quiz-question-editor-panel');
  showSubModal('lesson-editor-panel');
  switchLessonEditorTab('info');
  el('lesson-editor-heading').textContent = 'Edit Lesson';
}

function saveLessonFromEditor() {
  var title = el('edit-lesson-title').value.trim();
  if (!title) { tool.notify('Lesson title is required.', 'warning'); return; }
  var content = getHtmlContent();
  var order = parseInt(el('edit-lesson-order').value) || editingLessons.length + 1;
  var minutes = parseInt(el('edit-lesson-minutes').value) || 0;

  var lessonData = {
    id: genId(),
    title: title,
    order: order,
    estimatedMinutes: minutes,
    content: content,
    youtubeUrls: editingYoutubeUrls.length > 0 ? JSON.parse(JSON.stringify(editingYoutubeUrls)) : null,
    presentationPdfUrls: editingPresentationPdfUrls.length > 0 ? JSON.parse(JSON.stringify(editingPresentationPdfUrls)) : null,
    studyDocPdfUrls: editingStudyDocPdfUrls.length > 0 ? JSON.parse(JSON.stringify(editingStudyDocPdfUrls)) : null,
    worksheetPdfUrls: editingWorksheetPdfUrls.length > 0 ? JSON.parse(JSON.stringify(editingWorksheetPdfUrls)) : null,
    answerKeyPdfUrls: editingAnswerKeyPdfUrls.length > 0 ? JSON.parse(JSON.stringify(editingAnswerKeyPdfUrls)) : null,
    sourceUrls: editingSourceLinks.length > 0 ? JSON.parse(JSON.stringify(editingSourceLinks)) : null,
    quiz: editingQuizQuestions.length > 0 ? JSON.parse(JSON.stringify(editingQuizQuestions)) : null
  };

  // Direct mode: save to sections[editingDirectSectionIdx].lessons and persist immediately
  if (editingDirectSectionIdx !== null) {
    var sec = sections[editingDirectSectionIdx];
    if (!sec.lessons) sec.lessons = [];
    if (editingLessonIdx !== null && sec.lessons[editingLessonIdx]) {
      lessonData.id = sec.lessons[editingLessonIdx].id;
      sec.lessons[editingLessonIdx] = lessonData;
    } else {
      sec.lessons.push(lessonData);
    }
    hideSubModal('lesson-editor-panel');
    editingDirectSectionIdx = null;
    saveCurriculum(function(err) {
      if (err) return;
      tool.notify('Lesson saved! ✅', 'success');
    });
    return;
  }

  // Modal mode: save to editingLessons temp array
  if (editingLessonIdx !== null && editingLessons[editingLessonIdx]) {
    lessonData.id = editingLessons[editingLessonIdx].id;
    editingLessons[editingLessonIdx] = lessonData;
  } else {
    editingLessons.push(lessonData);
  }

  hideSubModal('lesson-editor-panel');
  renderLessonsEditorList();
  tool.notify('Lesson saved! ✅', 'success');
}

function cancelLessonEditor() {
  hideSubModal('lesson-editor-panel');
  editingDirectSectionIdx = null;
}

/* ── Direct Lesson Management (from main view, bypasses section modal) ── */

function startAddLessonDirect(sectionIdx) {
  editingDirectSectionIdx = sectionIdx;
  editingLessonIdx = null;
  el('edit-lesson-title').value = '';
  el('edit-lesson-order').value = (sections[sectionIdx].lessons || []).length + 1;
  el('edit-lesson-minutes').value = '';
  editingYoutubeUrls = []; editingYoutubeIdx = null;
  renderYoutubeEditorList();
  hideSubModal('youtube-editor-panel');
  editingPresentationPdfUrls = []; editingStudyDocPdfUrls = []; editingWorksheetPdfUrls = []; editingAnswerKeyPdfUrls = [];
  editingPdfIdx = null; editingPdfType = null;
  renderPdfEditorList('presentation'); renderPdfEditorList('studyDoc'); renderPdfEditorList('worksheet'); renderPdfEditorList('answerKey');
  hideSubModal('pdf-editor-panel');
  setHtmlContent('');
  editingSourceLinks = []; editingSourceLinkIdx = null;
  renderSourceLinksEditorList();
  hideSubModal('source-link-editor-panel');
  editingQuizQuestions = []; editingQuizQuestionIdx = null;
  renderQuizEditorList();
  hideSubModal('quiz-question-editor-panel');
  showSubModal('lesson-editor-panel');
  switchLessonEditorTab('info');
  el('lesson-editor-heading').textContent = 'Add Lesson to ' + (sections[sectionIdx].title || 'Section');
}

function editLessonDirect(sectionIdx, lessonIdx) {
  editingDirectSectionIdx = sectionIdx;
  editingLessonIdx = lessonIdx;
  var sec = sections[sectionIdx];
  var les = sec.lessons && sec.lessons[lessonIdx];
  if (!les) return;
  el('edit-lesson-title').value = les.title || '';
  el('edit-lesson-order').value = typeof les.order === 'number' ? les.order : '';
  el('edit-lesson-minutes').value = les.estimatedMinutes || '';
  editingYoutubeUrls = normalizePdfArray(les.youtubeUrls); editingYoutubeIdx = null;
  renderYoutubeEditorList();
  hideSubModal('youtube-editor-panel');
  editingPresentationPdfUrls = normalizePdfArray(les.presentationPdfUrls);
  editingStudyDocPdfUrls = normalizePdfArray(les.studyDocPdfUrls);
  editingWorksheetPdfUrls = normalizePdfArray(les.worksheetPdfUrls);
  editingAnswerKeyPdfUrls = normalizePdfArray(les.answerKeyPdfUrls);
  editingPdfIdx = null; editingPdfType = null;
  renderPdfEditorList('presentation'); renderPdfEditorList('studyDoc'); renderPdfEditorList('worksheet'); renderPdfEditorList('answerKey');
  hideSubModal('pdf-editor-panel');
  setHtmlContent(les.content || '');
  var srcVal = les.sourceUrls;
  if (srcVal && typeof srcVal === 'string') { try { srcVal = JSON.parse(srcVal); } catch(e) { srcVal = null; } }
  editingSourceLinks = (srcVal && Array.isArray(srcVal)) ? JSON.parse(JSON.stringify(srcVal)) : [];
  editingSourceLinkIdx = null;
  renderSourceLinksEditorList();
  hideSubModal('source-link-editor-panel');
  var quizVal = les.quiz;
  if (quizVal && typeof quizVal === 'string') { try { quizVal = JSON.parse(quizVal); } catch(e) { quizVal = null; } }
  editingQuizQuestions = (quizVal && Array.isArray(quizVal)) ? JSON.parse(JSON.stringify(quizVal)) : [];
  editingQuizQuestionIdx = null;
  renderQuizEditorList();
  hideSubModal('quiz-question-editor-panel');
  showSubModal('lesson-editor-panel');
  switchLessonEditorTab('info');
  el('lesson-editor-heading').textContent = 'Edit Lesson';
}

function deleteLessonDirect(sectionIdx, lessonIdx) {
  var sec = sections[sectionIdx];
  var les = sec.lessons && sec.lessons[lessonIdx];
  var name = les ? (les.title || 'this lesson') : 'this lesson';
  sandboxConfirm('Delete "' + name + '" from "' + (sec.title || 'Section') + '"? This cannot be undone.', function() {
    if (sec.lessons) sec.lessons.splice(lessonIdx, 1);
    saveCurriculum(function(err) {
      if (err) return;
      tool.notify('Lesson deleted.', 'info');
    });
  });
}

/* ═══════════════════════════════════════════
   LESSON EDITOR TABS
   ═══════════════════════════════════════════ */

function switchLessonEditorTab(tabName) {
  var tabs = document.querySelectorAll('.lesson-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].getAttribute('data-lesson-tab') === tabName);
  }
  var panels = document.querySelectorAll('.lesson-tab-panel');
  for (var j = 0; j < panels.length; j++) {
    panels[j].classList.toggle('active', panels[j].getAttribute('data-lesson-panel') === tabName);
  }
  tool.resize();
}

/* ═══════════════════════════════════════════
   QUIZ QUESTIONS EDITOR
   ═══════════════════════════════════════════ */

function renderQuizEditorList() {
  var list = el('quiz-editor-list');
  el('quiz-editor-count').textContent = editingQuizQuestions.length + ' question(s) — 3 sets of 5';
  if (editingQuizQuestions.length === 0) {
    list.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">No quiz questions yet. Click "Generate Questions" or add manually.</div>';
  } else {
    var setLabels = ['Set 1', 'Set 2', 'Set 3'];
    var html = '';
    for (var setIdx = 0; setIdx < QUIZ_SETS; setIdx++) {
      var setStart = setIdx * QUIZ_PER_SET;
      var setQuestions = editingQuizQuestions.slice(setStart, setStart + QUIZ_PER_SET);
      var canAdd = setQuestions.length < QUIZ_PER_SET;
      html += '<div class="quiz-set-group"><div class="quiz-set-group-header"><span>📋 ' + setLabels[setIdx] + ' — ' + setQuestions.length + ' of ' + QUIZ_PER_SET + ' questions</span>' +
        (canAdd ? '<button class="btn btn-sm btn-primary" data-add-quiz-set="' + setIdx + '" style="font-size:11px;padding:2px 8px">+ Add</button>' : '<span style="font-size:10px;color:var(--success)">✓ Full</span>') +
        '</div>';
      if (setQuestions.length === 0) {
        html += '<div style="padding:8px 12px;color:var(--text-muted);font-size:12px;">No questions in this set yet.</div>';
      } else {
        html += setQuestions.map(function(q, qi) {
          var globalIdx = setStart + qi;
          var answerLabel = q.options && q.options[q.answer] ? q.options[q.answer] : 'Not set';
          return '<div class="quiz-editor-item"><div class="quiz-editor-item-info"><div class="quiz-editor-item-title">' + (globalIdx+1) + '. ' + esc(q.question || 'Untitled') +
            (q.difficulty ? ' <span class="quiz-difficulty difficulty-' + q.difficulty + '">' + q.difficulty + '</span>' : '') +
            '</div><div class="quiz-editor-item-meta">' + (q.options?q.options.length:0) + ' options · Answer: ' + esc(answerLabel) + '</div></div>' +
            '<div class="quiz-editor-item-actions"><button class="btn btn-sm btn-outline" data-edit-quiz-idx="' + globalIdx + '">✏️</button><button class="btn btn-sm btn-danger" data-del-quiz-idx="' + globalIdx + '">🗑</button></div></div>';
        }).join('');
      }
      html += '</div>';
    }
    list.innerHTML = html;

    var addBtns = list.querySelectorAll('[data-add-quiz-set]');
    for (var a = 0; a < addBtns.length; a++) {
      addBtns[a].addEventListener('click', function(e) { e.stopPropagation(); openQuizQuestionEditor(null, parseInt(this.getAttribute('data-add-quiz-set'))); });
    }
    var editBtns = list.querySelectorAll('[data-edit-quiz-idx]');
    for (var i = 0; i < editBtns.length; i++) {
      editBtns[i].addEventListener('click', function(e) { e.stopPropagation(); openQuizQuestionEditor(parseInt(this.getAttribute('data-edit-quiz-idx'))); });
    }
    var delBtns = list.querySelectorAll('[data-del-quiz-idx]');
    for (var j = 0; j < delBtns.length; j++) {
      delBtns[j].addEventListener('click', function(e) { e.stopPropagation(); editingQuizQuestions.splice(parseInt(this.getAttribute('data-del-quiz-idx')), 1); renderQuizEditorList(); });
    }
  }
}

function openQuizQuestionEditor(idx, setIdx) {
  editingQuizQuestionIdx = idx;
  editingQuizQuestionSetIdx = (idx === null) ? (setIdx || 0) : null;
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

function closeQuizQuestionEditor() { hideSubModal('quiz-question-editor-panel'); editingQuizQuestionIdx = null; }

function renderQuizOptionsEditor(options) {
  var container = el('quiz-options-editor-container');
  container.innerHTML = options.map(function(opt, oi) {
    return '<div class="quiz-option-editor-row"><input class="form-input" type="text" value="' + esc(opt) + '" data-opt-idx="' + oi + '" placeholder="Option ' + (oi+1) + '"><button class="btn btn-sm btn-danger" data-remove-opt="' + oi + '" title="Remove">✕</button></div>';
  }).join('');
  var removeBtns = container.querySelectorAll('[data-remove-opt]');
  for (var i = 0; i < removeBtns.length; i++) {
    removeBtns[i].addEventListener('click', function(e) {
      e.stopPropagation();
      var oi = parseInt(this.getAttribute('data-remove-opt'));
      var currentOpts = getCurrentQuizOptions();
      if (currentOpts.length <= 2) { tool.notify('Need at least 2 options.', 'warning'); return; }
      currentOpts.splice(oi, 1);
      renderQuizOptionsEditor(currentOpts);
    });
  }
}

function getCurrentQuizOptions() {
  var inputs = el('quiz-options-editor-container').querySelectorAll('input[type="text"]');
  var opts = [];
  for (var i = 0; i < inputs.length; i++) { opts.push(inputs[i].value); }
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
  if (validOpts.length < 2) { tool.notify('Need at least 2 non-empty options.', 'warning'); return; }
  var answer = parseInt(el('edit-quiz-answer').value) || 0;
  if (answer >= validOpts.length) { tool.notify('Answer index out of range.', 'warning'); return; }

  var questionData = { question: text, options: validOpts, answer: answer };

  if (editingQuizQuestionIdx !== null) {
    editingQuizQuestions[editingQuizQuestionIdx] = questionData;
  } else {
    var targetSet = editingQuizQuestionSetIdx || 0;
    var insertAt = targetSet * QUIZ_PER_SET;
    for (var si = insertAt; si < insertAt + QUIZ_PER_SET && si < editingQuizQuestions.length; si++) {
      if (!editingQuizQuestions[si]) { insertAt = si; break; }
    }
    if (insertAt >= editingQuizQuestions.length) { editingQuizQuestions.push(questionData); }
    else { editingQuizQuestions.splice(insertAt, 0, questionData); }
    editingQuizQuestionSetIdx = null;
  }
  closeQuizQuestionEditor();
  renderQuizEditorList();
  tool.notify('Question saved!', 'success');
}

/* ═══════════════════════════════════════════
   SOURCE LINKS EDITOR
   ═══════════════════════════════════════════ */

function renderSourceLinksEditorList() {
  var list = el('source-links-editor-list');
  el('source-links-editor-count').textContent = editingSourceLinks.length + ' link(s)';
  if (editingSourceLinks.length === 0) {
    list.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">No source links added yet.</div>';
  } else {
    list.innerHTML = editingSourceLinks.map(function(sl, idx) {
      return '<div class="source-link-editor-item"><div class="source-link-editor-item-info"><div class="source-link-editor-item-title">🔗 ' + esc(sl.label || 'Untitled') + '</div><div class="source-link-editor-item-meta">' + esc(sl.url || '') + '</div></div><div class="source-link-editor-item-actions"><button class="btn btn-sm btn-outline" data-edit-sl-idx="' + idx + '">✏️</button><button class="btn btn-sm btn-danger" data-del-sl-idx="' + idx + '">🗑</button></div></div>';
    }).join('');
    var editBtns = list.querySelectorAll('[data-edit-sl-idx]');
    for (var i = 0; i < editBtns.length; i++) {
      editBtns[i].addEventListener('click', function(e) { e.stopPropagation(); openSourceLinkEditor(parseInt(this.getAttribute('data-edit-sl-idx'))); });
    }
    var delBtns = list.querySelectorAll('[data-del-sl-idx]');
    for (var j = 0; j < delBtns.length; j++) {
      delBtns[j].addEventListener('click', function(e) { e.stopPropagation(); editingSourceLinks.splice(parseInt(this.getAttribute('data-del-sl-idx')), 1); renderSourceLinksEditorList(); });
    }
  }
}

function openSourceLinkEditor(idx) {
  editingSourceLinkIdx = idx;
  showSubModal('source-link-editor-panel');
  el('source-link-editor-heading').textContent = idx !== null ? 'Edit Source Link' : 'Add Source Link';
  if (idx !== null && editingSourceLinks[idx]) {
    el('edit-source-link-label').value = editingSourceLinks[idx].label || '';
    el('edit-source-link-url').value = editingSourceLinks[idx].url || '';
  } else {
    el('edit-source-link-label').value = '';
    el('edit-source-link-url').value = '';
  }
}

function closeSourceLinkEditor() { hideSubModal('source-link-editor-panel'); editingSourceLinkIdx = null; }

function saveSourceLink() {
  var label = el('edit-source-link-label').value.trim();
  var url = el('edit-source-link-url').value.trim();
  if (!label) { tool.notify('Label is required.', 'warning'); return; }
  if (!url) { tool.notify('URL is required.', 'warning'); return; }
  var linkData = { label: label, url: url };
  if (editingSourceLinkIdx !== null) { editingSourceLinks[editingSourceLinkIdx] = linkData; }
  else { editingSourceLinks.push(linkData); }
  closeSourceLinkEditor();
  renderSourceLinksEditorList();
  tool.notify('Source link saved!', 'success');
}

/* ═══════════════════════════════════════════
   YOUTUBE EDITOR
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
      return '<div class="source-link-editor-item"><div class="source-link-editor-item-info" style="display:flex;align-items:center">' + thumbHtml + '<div><div class="source-link-editor-item-title">🎬 ' + (videoId ? 'youtube.com/watch?v=' + videoId : esc(url)) + '</div><div class="source-link-editor-item-meta">' + esc(url) + '</div></div></div><div class="source-link-editor-item-actions"><button class="btn btn-sm btn-outline" data-edit-yt-idx="' + idx + '">✏️</button><button class="btn btn-sm btn-danger" data-del-yt-idx="' + idx + '">🗑</button></div></div>';
    }).join('');
    var editBtns = list.querySelectorAll('[data-edit-yt-idx]');
    for (var i = 0; i < editBtns.length; i++) {
      editBtns[i].addEventListener('click', function(e) { e.stopPropagation(); openYoutubeEditor(parseInt(this.getAttribute('data-edit-yt-idx'))); });
    }
    var delBtns = list.querySelectorAll('[data-del-yt-idx]');
    for (var j = 0; j < delBtns.length; j++) {
      delBtns[j].addEventListener('click', function(e) { e.stopPropagation(); editingYoutubeUrls.splice(parseInt(this.getAttribute('data-del-yt-idx')), 1); renderYoutubeEditorList(); });
    }
  }
}

function openYoutubeEditor(idx) {
  editingYoutubeIdx = idx;
  showSubModal('youtube-editor-panel');
  el('youtube-editor-heading').textContent = idx !== null ? 'Edit YouTube Video' : 'Add YouTube Video';
  el('edit-youtube-item-url').value = idx !== null ? (editingYoutubeUrls[idx] || '') : '';
}

function closeYoutubeEditor() { hideSubModal('youtube-editor-panel'); editingYoutubeIdx = null; }

function saveYoutubeUrl() {
  var url = el('edit-youtube-item-url').value.trim();
  if (!url) { tool.notify('YouTube URL is required.', 'warning'); return; }
  if (!extractYouTubeId(url)) { tool.notify('Could not parse a YouTube video ID from this URL.', 'warning'); return; }
  if (editingYoutubeIdx !== null) { editingYoutubeUrls[editingYoutubeIdx] = url; }
  else { editingYoutubeUrls.push(url); }
  closeYoutubeEditor();
  renderYoutubeEditorList();
  tool.notify('Video saved!', 'success');
}

/* ═══════════════════════════════════════════
   PDF EDITOR (generic for 4 types)
   ═══════════════════════════════════════════ */

var PDF_LABELS = {
  presentation: { icon: '📊', label: 'Presentation Slides' },
  studyDoc: { icon: '📖', label: 'Study Documents' },
  worksheet: { icon: '📝', label: 'Worksheets' },
  answerKey: { icon: '🔑', label: 'Answer Keys' }
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
      return '<div class="source-link-editor-item"><div class="source-link-editor-item-info"><div class="source-link-editor-item-title">📎 ' + esc(url.substring(url.lastIndexOf('/')+1) || url) + '</div><div class="source-link-editor-item-meta">' + esc(url) + '</div></div><div class="source-link-editor-item-actions"><button class="btn btn-sm btn-outline" data-edit-pdf="' + type + ':' + idx + '">✏️</button><button class="btn btn-sm btn-danger" data-del-pdf="' + type + ':' + idx + '">🗑</button></div></div>';
    }).join('');
    var editBtns = list.querySelectorAll('[data-edit-pdf]');
    for (var i = 0; i < editBtns.length; i++) {
      editBtns[i].addEventListener('click', function(e) { e.stopPropagation(); var parts = this.getAttribute('data-edit-pdf').split(':'); openPdfEditor(parts[0], parseInt(parts[1])); });
    }
    var delBtns = list.querySelectorAll('[data-del-pdf]');
    for (var j = 0; j < delBtns.length; j++) {
      delBtns[j].addEventListener('click', function(e) { e.stopPropagation(); var parts = this.getAttribute('data-del-pdf').split(':'); var t = parts[0]; getPdfArray(t).splice(parseInt(parts[1]), 1); renderPdfEditorList(t); });
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

function closePdfEditor() { hideSubModal('pdf-editor-panel'); editingPdfType = null; editingPdfIdx = null; }

function savePdfUrl() {
  var url = el('edit-pdf-item-url').value.trim();
  if (!url) { tool.notify('PDF URL is required.', 'warning'); return; }
  var allTypes = ['presentation', 'studyDoc', 'worksheet', 'answerKey'];
  for (var t = 0; t < allTypes.length; t++) {
    var checkArr = getPdfArray(allTypes[t]);
    for (var c = 0; c < checkArr.length; c++) {
      if (allTypes[t] === editingPdfType && c === editingPdfIdx) continue;
      if (checkArr[c].trim().toLowerCase() === url.trim().toLowerCase()) {
        var label = (PDF_LABELS[allTypes[t]] || {}).label || allTypes[t];
        tool.notify('This URL is already in ' + label + '.', 'warning');
        return;
      }
    }
  }
  var arr = getPdfArray(editingPdfType);
  if (editingPdfIdx !== null) { arr[editingPdfIdx] = url; } else { arr.push(url); }
  var savedType = editingPdfType;
  closePdfEditor();
  renderPdfEditorList(savedType);
  tool.notify('PDF saved!', 'success');
}

/* ═══════════════════════════════════════════
   AI: GENERATE QUIZ FROM PDFs
   ═══════════════════════════════════════════ */

function updateGenerateButtons(opts) {
  var btns = document.querySelectorAll('.btn-generate-quiz');
  for (var i = 0; i < btns.length; i++) {
    if (opts.disabled !== undefined) btns[i].disabled = opts.disabled;
    if (opts.text !== undefined) btns[i].textContent = opts.text;
  }
}

function showGenerateInfo(show) {
  var info1 = el('generate-quiz-info');
  var info2 = el('generate-quiz-info-2');
  if (info1) info1.style.display = show ? '' : 'none';
  if (info2) info2.style.display = show ? '' : 'none';
  if (show) setTimeout(function() { showGenerateInfo(false); }, 4000);
}

function generateQuizFromPdf() {
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

  var combinedText = '';
  var remaining = allUrls.length;

  function readNext(idx) {
    if (idx >= allUrls.length) {
      if (!combinedText || combinedText.length < 50) {
        updateGenerateButtons({ disabled: false, text: '🤖 Generate Quiz Questions from PDFs' });
        tool.notify('Could not extract enough text from the PDFs.', 'warning');
        return;
      }
      generateWithAI(combinedText);
      return;
    }
    tool.requestFileContent(allUrls[idx], function(err, fileResult) {
      remaining--;
      if (!err && fileResult) {
        var text = typeof fileResult === 'string' ? fileResult : (fileResult.text || fileResult.content || '');
        if (text && text.length > 50) {
          combinedText += '\n\n--- Document ' + (idx+1) + ' ---\n\n' + text;
        }
      }
      if (remaining === 0) {
        if (!combinedText || combinedText.length < 50) {
          updateGenerateButtons({ disabled: false, text: '🤖 Generate Quiz Questions from PDFs' });
          tool.notify('Could not extract enough text from the PDFs.', 'warning');
          return;
        }
        generateWithAI(combinedText);
      }
    });
  }

  function generateWithAI(text) {
    var maxLen = 12000;
    if (text.length > maxLen) text = text.substring(0, maxLen) + '\n\n[... content truncated ...]';
    updateGenerateButtons({ text: '⏳ AI generating...' });

    var prompt = 'You are an expert quiz generator. Generate EXACTLY 15 multiple-choice questions based on the documents below. Return ONLY a JSON array — no markdown, no intro text.\n\nCRITICAL: You MUST generate exactly 15 questions.\n\nDocument content:\n"""\n' + text + '\n"""\n\nThe 15 questions are organized as 3 identical sets of 5 questions each. Each set of 5 follows this difficulty pattern: easy, medium, medium, hard, hard. Each question must have exactly 4 options. Use this JSON format:\n{"question":"...","options":["A","B","C","D"],"answer":0,"difficulty":"easy|medium|hard","explanation_correct":"step-by-step solution","explanations_incorrect":["","","",""]}\n\nSTART YOUR RESPONSE WITH: [{"question":';

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
            if (!q.question || !Array.isArray(q.options) || q.options.length < 2 || typeof q.answer !== 'number') throw new Error('Question ' + (i+1) + ' missing fields');
            if (!q.difficulty) { var posInSet = i % QUIZ_PER_SET; q.difficulty = posInSet === 0 ? 'easy' : posInSet <= 2 ? 'medium' : 'hard'; }
            if (!q.explanation_correct) q.explanation_correct = '';
            if (!q.explanations_incorrect) q.explanations_incorrect = ['', '', '', ''];
          }
          editingQuizQuestions = questions;
          editingQuizQuestionIdx = null; editingQuizQuestionSetIdx = null;
          renderQuizEditorList();
          hideSubModal('quiz-question-editor-panel');
          var msg = '✅ Generated ' + questions.length + ' questions from ' + allUrls.length + ' PDF(s).';
          if (questions.length < 15) msg += ' AI produced fewer than 15 — you can add more manually.';
          tool.notify(msg, 'success');
        } catch(e) {
          tool.notify('AI response could not be parsed. See console.', 'error');
          console.error('Quiz gen parse error:', e, 'Raw:', fullResponse);
        }
      },
      onError: function(err) {
        updateGenerateButtons({ disabled: false, text: '🤖 Generate Quiz Questions from PDFs' });
        tool.notify('AI generation failed: ' + err, 'error');
      }
    });
  }

  readNext(0);
}

/* ═══════════════════════════════════════════
   ROLE CHECK
   ═══════════════════════════════════════════ */

function updateRoleBadge(user) {
  var badge = el('role-badge');
  if (!badge) return;
  if (!user) { badge.style.display = 'none'; return; }
  badge.style.display = '';
  var name = user.name || user.displayName || user.email || user.id || 'User';
  var roles = (user.roles && user.roles.length > 0) ? user.roles.join(', ') : 'no roles';
  badge.textContent = name + '  ·  ' + roles;
}

function checkManagerRole() {
  var user = tool.getUser();
  if (!user) { updateRoleBadge(null); return true; } // No user = CMS hasn't loaded yet, allow
  updateRoleBadge(user);
  var userRoles = (user.roles || []).map(function(r) { return String(r).toLowerCase(); });
  // If no roles reported, allow access (CMS handles permissions at object level)
  if (userRoles.length === 0) return true;
  // Check configured manager roles
  var managerRole = tool.param('managerRole', 'admin,editor');
  var allowedRoles = managerRole.split(',').map(function(r) { return r.trim().toLowerCase(); });
  for (var i = 0; i < allowedRoles.length; i++) {
    if (userRoles.indexOf(allowedRoles[i]) !== -1) return true;
  }
  // Fallback: documented CMS write roles
  var writeRoles = ['developer', 'owner', 'admin', 'user-manager'];
  for (var j = 0; j < writeRoles.length; j++) {
    if (userRoles.indexOf(writeRoles[j]) !== -1) return true;
  }
  // Only deny if user explicitly has non-manager roles
  return false;
}

/* ═══════════════════════════════════════════
   LOADING
   ═══════════════════════════════════════════ */

function showLoading(show) { el('loading-overlay').style.display = show ? '' : 'none'; }

/* ═══════════════════════════════════════════
   EVENT BINDINGS
   ═══════════════════════════════════════════ */

function bindEvents() {
  el('btn-add-section').addEventListener('click', function() { openSectionEditor(null); });
  el('btn-modal-close').addEventListener('click', closeSectionEditor);
  el('btn-modal-cancel').addEventListener('click', closeSectionEditor);
  el('btn-modal-save').addEventListener('click', saveSection);
  el('btn-add-lesson').addEventListener('click', startAddLesson);
  el('btn-lesson-editor-save').addEventListener('click', saveLessonFromEditor);
  el('btn-lesson-editor-cancel').addEventListener('click', cancelLessonEditor);

  var lessonTabs = document.querySelector('.lesson-tabs');
  if (lessonTabs) {
    lessonTabs.addEventListener('click', function(e) {
      var tab = e.target.closest('.lesson-tab');
      if (!tab) return;
      switchLessonEditorTab(tab.getAttribute('data-lesson-tab'));
    });
  }

  el('btn-add-quiz-question').addEventListener('click', function() { openQuizQuestionEditor(null, 0); });
  el('btn-quiz-editor-save').addEventListener('click', saveQuizQuestion);
  el('btn-quiz-editor-cancel').addEventListener('click', closeQuizQuestionEditor);
  el('btn-add-quiz-option').addEventListener('click', addQuizOption);
  el('btn-add-source-link').addEventListener('click', function() { openSourceLinkEditor(null); });
  el('btn-source-link-editor-save').addEventListener('click', saveSourceLink);
  el('btn-source-link-editor-cancel').addEventListener('click', closeSourceLinkEditor);
  el('btn-add-youtube').addEventListener('click', function() { openYoutubeEditor(null); });
  el('btn-youtube-editor-save').addEventListener('click', saveYoutubeUrl);
  el('btn-youtube-editor-cancel').addEventListener('click', closeYoutubeEditor);
  el('btn-pdf-editor-save').addEventListener('click', savePdfUrl);
  el('btn-pdf-editor-cancel').addEventListener('click', closePdfEditor);

  var pdfAddBtns = document.querySelectorAll('[data-add-pdf]');
  for (var pa = 0; pa < pdfAddBtns.length; pa++) {
    pdfAddBtns[pa].addEventListener('click', function() { openPdfEditor(this.getAttribute('data-add-pdf'), null); });
  }

  el('btn-generate-quiz-from-pdf').addEventListener('click', generateQuizFromPdf);
  var btnGen2 = el('btn-generate-quiz-from-pdf-2');
  if (btnGen2) btnGen2.addEventListener('click', generateQuizFromPdf);

  el('btn-confirm-yes').addEventListener('click', function() { hideConfirm(); if (_confirmCallback) { var cb = _confirmCallback; _confirmCallback = null; cb(); } });
  el('btn-confirm-no').addEventListener('click', function() { hideConfirm(); });

  var toolbar = el('html-editor-toolbar');
  if (toolbar) {
    toolbar.addEventListener('click', function(e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var cmd = btn.getAttribute('data-cmd');
      if (cmd === 'createlink') { showLinkUrlInput(); }
      else if (cmd) { execCmd(cmd, btn.getAttribute('data-val') || null); }
      el('html-editor-content').focus();
    });
  }

  el('modal-overlay').addEventListener('click', function(e) { if (e.target === el('modal-overlay')) closeSectionEditor(); });

  var backdrop = el('sub-modal-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', function(e) {
      if (e.target !== backdrop) return;
      var panels = ['youtube-editor-panel','pdf-editor-panel','quiz-question-editor-panel','source-link-editor-panel','lesson-editor-panel'];
      for (var i = 0; i < panels.length; i++) {
        var p = el(panels[i]);
        if (p && p.style.display !== 'none') {
          if (panels[i] === 'youtube-editor-panel') closeYoutubeEditor();
          else if (panels[i] === 'pdf-editor-panel') closePdfEditor();
          else if (panels[i] === 'quiz-question-editor-panel') closeQuizQuestionEditor();
          else if (panels[i] === 'source-link-editor-panel') closeSourceLinkEditor();
          else if (panels[i] === 'lesson-editor-panel') cancelLessonEditor();
          return;
        }
      }
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var panels = ['youtube-editor-panel','pdf-editor-panel','quiz-question-editor-panel','source-link-editor-panel','lesson-editor-panel'];
      for (var i = 0; i < panels.length; i++) {
        var p = el(panels[i]);
        if (p && p.style.display !== 'none') {
          if (panels[i] === 'youtube-editor-panel') closeYoutubeEditor();
          else if (panels[i] === 'pdf-editor-panel') closePdfEditor();
          else if (panels[i] === 'quiz-question-editor-panel') closeQuizQuestionEditor();
          else if (panels[i] === 'source-link-editor-panel') closeSourceLinkEditor();
          else if (panels[i] === 'lesson-editor-panel') cancelLessonEditor();
          return;
        }
      }
      if (el('modal-overlay').style.display !== 'none') closeSectionEditor();
    }
  });
}

/* ═══════════════════════════════════════════
   ENTRY POINT
   ═══════════════════════════════════════════ */

tool.onReady(function(val, fields) {
  setTimeout(function() {
    if (el('loading-overlay').style.display !== 'none') {
      el('loading-overlay').style.display = 'none';
    }
  }, 12000);

  tool.declareParams([
    { name: 'builderObjectId', label: 'contentId (for display)', type: 'text', default: '', severity: 'goodToHave', hint: 'Optional: set to this CMS object\'s contentId. Displays in header for copying to the Student tool\'s curriculumSourceId.' },
    { name: 'managerRole', label: 'Manager Role(s)', type: 'text', default: 'admin,editor', severity: 'goodToHave', hint: 'Comma-separated roles that can manage the curriculum.' }
  ]);

  updateIdBadge();

  if (!checkManagerRole()) {
    var user = tool.getUser();
    var userInfo = user ? (user.name || user.email || user.id || 'Unknown') : 'Not logged in';
    var rolesInfo = (user && user.roles && user.roles.length > 0) ? user.roles.join(', ') : 'no roles';
    el('app').innerHTML = '<div style="text-align:center;padding:60px 20px">' +
      '<div class="empty-icon">🔒</div>' +
      '<div class="empty-title">Access Denied</div>' +
      '<div class="empty-desc">You need manager permissions to use the Curriculum Builder.</div>' +
      '<div style="margin-top:20px;padding:16px;background:#f8fafc;border:1px solid var(--border);border-radius:var(--radius);display:inline-block;text-align:left;font-size:13px;line-height:1.8">' +
        '<div><strong>User:</strong> ' + esc(userInfo) + '</div>' +
        '<div><strong>Roles received:</strong> ' + esc(rolesInfo) + '</div>' +
        '<div><strong>Required roles:</strong> ' + esc(tool.param('managerRole', 'admin,editor')) + '</div>' +
      '</div>' +
    '</div>';
    tool.resize();
    return;
  }

  bindEvents();
  if (tool.isReadOnly()) {
    el('app').innerHTML = '<div style="text-align:center;padding:60px 20px"><div class="empty-icon">🔒</div><div class="empty-title">Read-Only Mode</div><div class="empty-desc">This tool is in read-only mode. Switch to edit mode to manage the curriculum.</div></div>';
    tool.resize();
    return;
  }

  tool.onReadonlyChange(function(ro) { if (ro) tool.notify('Read-only mode active. Switch to edit mode.', 'warning'); });

  loadCurriculum(val);
  tool.onValueChange(function(v) { loadCurriculum(v); });
});
