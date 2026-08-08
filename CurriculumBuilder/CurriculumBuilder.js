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
var editingHtmlDocUrls = [];
var editingHtmlCode = '';       // Raw HTML code (not URL — embedded directly)
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

/* ── URL Transform: Storage → Hosting proxy (same fix as the Student tool) ──
   Firebase Storage download URLs aren't reliably readable cross-origin.
   The Cloud Function at /files/** streams the file server-side with proper
   CORS + content-type headers, so route reads through it instead. */
function toHostingUrl(url) {
  if (!url) return url;
  return url.replace(
    /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+?)(?:\.appspot\.com)?\/o\//,
    'https://$1.firebaseapp.com/files/'
  );
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
  editingPresentationPdfUrls = []; editingStudyDocPdfUrls = []; editingWorksheetPdfUrls = []; editingAnswerKeyPdfUrls = []; editingHtmlDocUrls = [];
  editingPdfIdx = null; editingPdfType = null;
  renderPdfEditorList('presentation'); renderPdfEditorList('studyDoc'); renderPdfEditorList('worksheet'); renderPdfEditorList('answerKey'); renderPdfEditorList('htmlDoc');
  hideSubModal('pdf-editor-panel');
  editingHtmlCode = '';
  if (el('edit-html-code')) el('edit-html-code').value = '';
  if (el('edit-html-code-v2')) el('edit-html-code-v2').value = '';
  updateHtmlPreview();
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
  editingHtmlDocUrls = normalizePdfArray(les.htmlDocUrls);
  editingPdfIdx = null; editingPdfType = null;
  renderPdfEditorList('presentation'); renderPdfEditorList('studyDoc'); renderPdfEditorList('worksheet'); renderPdfEditorList('answerKey'); renderPdfEditorList('htmlDoc');
  hideSubModal('pdf-editor-panel');
  editingHtmlCode = les.htmlCode || '';
  if (el('edit-html-code')) el('edit-html-code').value = editingHtmlCode;
  if (el('edit-html-code-v2')) el('edit-html-code-v2').value = editingHtmlCode;
  updateHtmlPreview();
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
  // Sync HTML code from textarea (v2 takes priority, fall back to v1)
  if (el('edit-html-code-v2')) editingHtmlCode = el('edit-html-code-v2').value;
  else if (el('edit-html-code')) editingHtmlCode = el('edit-html-code').value;

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
    htmlDocUrls: editingHtmlDocUrls.length > 0 ? JSON.parse(JSON.stringify(editingHtmlDocUrls)) : null,
    htmlCode: editingHtmlCode || null,
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
  editingPresentationPdfUrls = []; editingStudyDocPdfUrls = []; editingWorksheetPdfUrls = []; editingAnswerKeyPdfUrls = []; editingHtmlDocUrls = [];
  editingPdfIdx = null; editingPdfType = null;
  renderPdfEditorList('presentation'); renderPdfEditorList('studyDoc'); renderPdfEditorList('worksheet'); renderPdfEditorList('answerKey'); renderPdfEditorList('htmlDoc');
  hideSubModal('pdf-editor-panel');
  editingHtmlCode = '';
  if (el('edit-html-code')) el('edit-html-code').value = '';
  if (el('edit-html-code-v2')) el('edit-html-code-v2').value = '';
  updateHtmlPreview();
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
  editingHtmlDocUrls = normalizePdfArray(les.htmlDocUrls);
  editingPdfIdx = null; editingPdfType = null;
  renderPdfEditorList('presentation'); renderPdfEditorList('studyDoc'); renderPdfEditorList('worksheet'); renderPdfEditorList('answerKey'); renderPdfEditorList('htmlDoc');
  hideSubModal('pdf-editor-panel');
  editingHtmlCode = les.htmlCode || '';
  if (el('edit-html-code')) el('edit-html-code').value = editingHtmlCode;
  if (el('edit-html-code-v2')) el('edit-html-code-v2').value = editingHtmlCode;
  updateHtmlPreview();
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
  // Role-based: hide Code sub-tab in Study HTML for non-admin users
  if (tabName === 'studyHtml') updateStudyHtmlTabRoles();
  tool.resize();
}

/** Hide Code sub-tab in Study HTML for non-admin/developer users */
function updateStudyHtmlTabRoles() {
  var codeTab = document.querySelector('.study-html-tab[data-html-tab="code"]');
  if (!codeTab) return;
  var user = tool.getUser();
  var roles = (user && user.roles) ? user.roles.map(function(r) { return String(r).toLowerCase(); }) : [];
  var isAdminDev = roles.indexOf('admin') !== -1 || roles.indexOf('developer') !== -1 || roles.indexOf('owner') !== -1;
  if (isAdminDev) {
    codeTab.style.display = '';
  } else {
    codeTab.style.display = 'none';
    // Force Preview tab if Code is hidden but currently active
    if (codeTab.classList.contains('active')) {
      var previewTab = document.querySelector('.study-html-tab[data-html-tab="preview"]');
      if (previewTab) {
        codeTab.classList.remove('active');
        previewTab.classList.add('active');
        var panels = document.querySelectorAll('.study-html-panel');
        for (var hp = 0; hp < panels.length; hp++) {
          panels[hp].classList.toggle('active', panels[hp].getAttribute('data-html-panel') === 'preview');
        }
        updateHtmlPreview();
      }
    }
  }
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
  answerKey: { icon: '🔑', label: 'Answer Keys' },
  htmlDoc: { icon: '🌐', label: 'HTML Documents' }
};

function getPdfArray(type) {
  if (type === 'presentation') return editingPresentationPdfUrls;
  if (type === 'studyDoc') return editingStudyDocPdfUrls;
  if (type === 'worksheet') return editingWorksheetPdfUrls;
  if (type === 'answerKey') return editingAnswerKeyPdfUrls;
  if (type === 'htmlDoc') return editingHtmlDocUrls;
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
  // Update label and button text based on type
  var isHtml = type === 'htmlDoc';
  var labelEl = document.querySelector('#pdf-editor-panel .form-label');
  var btnEl = el('btn-pdf-editor-save');
  if (labelEl) labelEl.innerHTML = (isHtml ? 'HTML Document URL' : 'PDF URL') + ' <span class="required">*</span>';
  if (btnEl) btnEl.textContent = 'Save ' + (isHtml ? 'HTML Doc' : 'PDF');
}

function closePdfEditor() { hideSubModal('pdf-editor-panel'); editingPdfType = null; editingPdfIdx = null; }

function savePdfUrl() {
  var url = el('edit-pdf-item-url').value.trim();
  if (!url) { tool.notify('PDF URL is required.', 'warning'); return; }
  var allTypes = ['presentation', 'studyDoc', 'worksheet', 'answerKey', 'htmlDoc'];
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

  // Fire ALL PDF reads in parallel — each callback decrements the shared counter.
  // When the last one completes (remaining === 0), we hand the combined text to AI.
  for (var ri = 0; ri < allUrls.length; ri++) {
    (function(idx) {
      tool.requestFileContent(toHostingUrl(allUrls[idx]), function(err, fileResult) {
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
    })(ri);
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
}

function generateHtmlFromPdf() {
  var allUrls = [];
  allUrls = allUrls.concat(editingPresentationPdfUrls);
  allUrls = allUrls.concat(editingStudyDocPdfUrls);
  allUrls = allUrls.concat(editingWorksheetPdfUrls);
  allUrls = allUrls.filter(function(u) { return u && u.trim(); });

  if (allUrls.length === 0) {
    tool.notify('No PDFs added yet. Add PDFs to Presentation, Study Documents, or Worksheets first.', 'warning');
    var infoEl = el('generate-html-info-v2');
    if (infoEl) { infoEl.style.display = ''; setTimeout(function() { infoEl.style.display = 'none'; }, 4000); }
    return;
  }

  var genBtn = el('btn-generate-html-from-pdf-v2');
  if (genBtn) { genBtn.disabled = true; genBtn.textContent = '⏳ Reading ' + allUrls.length + ' PDF(s)...'; }
  tool.notify('Reading ' + allUrls.length + ' PDF(s) for HTML generation...', 'info');

  var combinedText = '';
  var remaining = allUrls.length;

  for (var ri = 0; ri < allUrls.length; ri++) {
    (function(idx) {
      tool.requestFileContent(toHostingUrl(allUrls[idx]), function(err, fileResult) {
        remaining--;
        if (!err && fileResult) {
          var text = typeof fileResult === 'string' ? fileResult : (fileResult.text || fileResult.content || '');
          if (text && text.length > 50) {
            combinedText += '\n\n--- Document ' + (idx+1) + ' ---\n\n' + text;
          }
        }
        if (remaining === 0) {
          if (!combinedText || combinedText.length < 50) {
            if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🤖 AI Generate from PDFs'; }
            tool.notify('Could not extract enough text from the PDFs.', 'warning');
            return;
          }
          generateHtmlWithAI(combinedText);
        }
      });
    })(ri);
  }

  function generateHtmlWithAI(text) {
    var maxLen = 15000;
    if (text.length > maxLen) text = text.substring(0, maxLen) + '\n\n[... content truncated ...]';
    if (genBtn) genBtn.textContent = '⏳ AI generating HTML...';

    var prompt = 'You are an expert educational content designer creating an INTERACTIVE STUDY GUIDE. Based on the document content below, generate a beautiful, well-structured, highly interactive HTML study document. Return ONLY raw HTML — no markdown fences, no intro text.\n\n' +
      '⭐ YOUR GOAL: Create a step-by-step learning experience that engages the student actively, not passively.\n\n' +
      '🔷 OVERALL STRUCTURE (follow this order):\n' +
      '1. <div class="study-guide"> wrapper\n' +
      '2. <div class="sg-hero"> — eye-catching title + subtitle + estimated reading time\n' +
      '3. <div class="sg-summary"> — Learning Objectives with animated bullet icons\n' +
      '4. <section> blocks for each major topic, ordered logically from basics to advanced\n' +
      '5. Between sections, include <div class="sg-divider"></div> for visual rhythm\n' +
      '6. End with <div class="sg-summary sg-recap"> — Key Takeaways recap\n\n' +
      '🔷 SECTION STYLING (use these exact classes):\n' +
      '- <section> wraps each topic\n' +
      '- <h2 class="sg-heading"> for section titles (purple, bold)\n' +
      '- <h3 class="sg-subheading"> for sub-topics\n' +
      '- <p> for paragraphs, <strong> for key terms, <em> for emphasis\n' +
      '- <ul class="sg-list"> / <ol class="sg-list"> for lists\n' +
      '- <blockquote class="sg-note"> for important tips, warnings, or key takeaways (amber left border)\n' +
      '- <div class="sg-highlight"> for critical concepts that need emphasis (purple background)\n' +
      '- <div class="sg-step"> for numbered step-by-step instructions with <span class="sg-step-num">\n' +
      '- Use <table class="sg-table"> for comparison data with <thead> and striped rows\n\n' +
      '🔷 INTERACTIVE QUIZ — USE THIS EXACT HTML STRUCTURE (do NOT reorder elements):\n' +
      'For EVERY major concept, create a clickable self-check quiz item. COPY THIS EXACT TEMPLATE — only change the text:\n\n' +
      '<div class="sg-quiz-item-v3">\n' +
      '  <p class="sg-quiz-question-v3">❓ Question text?</p>\n' +
      '  <div class="sg-quiz-choices-v3">\n' +
      '    <input type="radio" name="qN" id="qN-a" class="sg-q-radio"><label class="sg-q-opt" for="qN-a">A) Option one</label>\n' +
      '    <input type="radio" name="qN" id="qN-b" class="sg-q-radio sg-q-correct"><label class="sg-q-opt" for="qN-b">B) Correct option</label>\n' +
      '    <input type="radio" name="qN" id="qN-c" class="sg-q-radio"><label class="sg-q-opt" for="qN-c">C) Option three</label>\n' +
      '    <input type="radio" name="qN" id="qN-d" class="sg-q-radio"><label class="sg-q-opt" for="qN-d">D) Option four</label>\n' +
      '  </div>\n' +
      '  <button class="sg-show-answer-btn" disabled>🔍 Show Answer</button>\n' +
      '  <div class="sg-q-feedback" style="display:none">\n' +
      '    <p class="sg-answer-correct">🎉 <strong>Correct! B) Correct option</strong></p>\n' +
      '    <p class="sg-answer-wrong" style="display:none">❌ <strong>Not quite.</strong> The correct answer is <strong>B) Correct option</strong>.</p>\n' +
      '    <p class="sg-explanation">💡 <strong>Explanation:</strong> Detailed step-by-step reasoning. Reference the source material. Explain WHY each wrong option is incorrect.</p>\n' +
      '  </div>\n' +
      '</div>\n\n' +
      '⚠️ ABSOLUTE RULES — follow exactly or the quiz will break:\n' +
      '1. Radio inputs MUST come BEFORE their labels (input+label pairs, not label wrapping input)\n' +
      '2. The sg-show-answer-btn button MUST come between the choices div and sg-q-feedback div\n' +
      '3. The sg-q-feedback div MUST be the VERY LAST element inside sg-quiz-item-v3, with style="display:none"\n' +
      '4. ONLY the correct answer input gets class="sg-q-radio sg-q-correct" — wrong answers get class="sg-q-radio" only\n' +
      '5. The sg-show-answer-btn MUST have the disabled attribute initially\n' +
      '6. BOTH sg-answer-correct AND sg-answer-wrong paragraphs MUST be present inside sg-q-feedback — each with style="display:none" initially\n' +
      '7. Every question needs a UNIQUE name (q1, q2, q3...) so radio groups are independent\n' +
      '8. Every id must be unique too (q1-a, q1-b, q2-a, q2-b...)\n' +
      '9. Each label must reference its input via for="..." matching the id\n' +
      '10. Include 5-8 quiz items, each inside its own sg-quiz-item-v3, all wrapped in <div class="sg-quiz-section">\n\n' +
      '🔷 VISUAL ENHANCEMENTS (use these classes for professional look):\n' +
      '- <span class="sg-badge"> for inline labels/tags\n' +
      '- <div class="sg-card"> for grouped info boxes with <div class="sg-card-header"> and <div class="sg-card-body">\n' +
      '- <div class="sg-timeline"> with <div class="sg-timeline-item"> for chronological/sequential content\n' +
      '- <div class="sg-grid-2"> for side-by-side comparisons (2-column grid)\n' +
      '- Use emoji icons strategically in headings (📌 🎯 ⚡ 🔍 💡 ⭐)\n\n' +
      '🔷 COLOR PALETTE (use inline where helpful — the CMS provides matching CSS):\n' +
      '- Primary/Accent: #4f46e5 (purple), #eef2ff (light purple bg)\n' +
      '- Success: #059669 (green), #d1fae5 (light green bg)\n' +
      '- Warning: #d97706 (amber), #fef3c7 (light amber bg)\n' +
      '- Text: #1e293b (dark), #64748b (muted)\n' +
      '- Backgrounds: #ffffff (white), #f8fafc (light gray), #fafbfe (blue-tinted)\n\n' +
      '🔷 LENGTH & QUALITY:\n' +
      '- Comprehensive: 1000-3000 words\n' +
      '- Well-researched: derive ALL facts from the source material\n' +
      '- Engaging tone: friendly but academic, like a knowledgeable tutor\n' +
      '- Short paragraphs (2-4 sentences max) for readability\n' +
      '- Use bullet points and numbered lists liberally for scannability\n\n' +
      'Document content:\n"""\n' + text + '\n"""\n\nSTART YOUR RESPONSE WITH: <div class="study-guide">';

    var fullResponse = '';
    tool.requestAIStream(prompt, null, {
      onToken: function(token) { fullResponse += token; },
      onComplete: function() {
        if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🤖 AI Generate from PDFs'; }
        var html = fullResponse.trim();
        html = html.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
        // Extract HTML content (between first < and last >)
        var startIdx = html.indexOf('<');
        var endIdx = html.lastIndexOf('>');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          html = html.substring(startIdx, endIdx + 1);
        }
        if (html.length < 20) {
          tool.notify('AI generated too little content. Try again with more PDFs.', 'warning');
          return;
        }
        editingHtmlCode = html;
        if (el('edit-html-code')) el('edit-html-code').value = html;
        if (el('edit-html-code-v2')) el('edit-html-code-v2').value = html;
        updateHtmlPreview();
        tool.notify('✅ Study HTML generated! Review it in the Study HTML tab, then save the lesson.', 'success');
      },
      onError: function(err) {
        if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🤖 AI Generate from PDFs'; }
        tool.notify('AI generation failed: ' + err, 'error');
      }
    });
  }
}

/** Update the live HTML preview iframe from the code textarea */
function updateHtmlPreview() {
  var iframe = el('study-html-preview-iframe');
  if (!iframe) return;
  var code = '';
  if (el('edit-html-code-v2')) code = el('edit-html-code-v2').value;
  else if (el('edit-html-code')) code = el('edit-html-code').value;

  // Base CSS that matches the SelfPacedLearn tool's study guide styles
  var previewCss = '<style>'
    + ':root{--primary:#4f46e5;--primary-light:#818cf8;--primary-dark:#3730a3;--primary-bg:#eef2ff;--success:#059669;--success-light:#d1fae5;--warning:#d97706;--warning-light:#fef3c7;--border:#e2e8f0;--text:#1e293b;--text-muted:#64748b;--radius:8px;--radius-lg:12px;--radius-xl:16px}'
    + 'body{font-family:system-ui,sans-serif;font-size:15px;color:#1e293b;line-height:1.8;padding:20px;max-width:900px;margin:0 auto;-webkit-font-smoothing:antialiased}'
    + '.study-guide{line-height:1.8;font-size:15px}'
    + '.sg-hero{text-align:center;padding:32px 24px;background:linear-gradient(135deg,#eef2ff,#f0f4ff);border-radius:16px;margin-bottom:28px;border:1px solid #818cf8}'
    + '.sg-hero h1{font-size:26px;font-weight:800;color:#3730a3;margin-bottom:8px}'
    + '.sg-hero p{font-size:15px;color:#64748b;max-width:600px;margin:0 auto}'
    + '.sg-heading{font-size:22px;font-weight:800;color:#3730a3;margin:32px 0 14px;padding-bottom:10px;border-bottom:2px solid #eef2ff}'
    + '.sg-subheading{font-size:17px;font-weight:700;color:#1e293b;margin:22px 0 10px}'
    + '.sg-summary{background:linear-gradient(135deg,#eef2ff,#f0f4ff);border:1px solid #818cf8;border-radius:12px;padding:22px 26px;margin-bottom:24px}'
    + '.sg-summary h2{font-size:18px;font-weight:700;color:#3730a3;margin-bottom:10px}'
    + '.sg-summary ul,.sg-summary ol{margin:0 0 0 20px}.sg-summary li{margin-bottom:7px}'
    + '.sg-recap{background:linear-gradient(135deg,#fef3c7,#fef9e7);border-color:#fcd34d}.sg-recap h2{color:#92400e}'
    + '.sg-note{border-left:4px solid #d97706;padding:14px 18px;margin:18px 0;background:#fef3c7;border-radius:0 8px 8px 0;color:#92400e}'
    + '.sg-highlight{background:#eef2ff;border:1px solid #818cf8;border-radius:12px;padding:16px 20px;margin:16px 0}'
    + '.sg-highlight strong{color:#3730a3}'
    + '.sg-divider{height:1px;background:#e2e8f0;margin:28px 0}'
    + '.sg-badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#eef2ff;color:#4f46e5;margin:0 2px}'
    + '.sg-list{margin:8px 0 12px 22px}.sg-list li{margin-bottom:6px}'
    + '.sg-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}'
    + '.sg-table th{text-align:left;padding:10px 14px;background:#f1f5f9;font-weight:600;border-bottom:2px solid #e2e8f0}'
    + '.sg-table td{padding:10px 14px;border-bottom:1px solid #e2e8f0}'
    + '.sg-table tr:nth-child(even) td{background:#fafbfc}'
    + '.sg-step{display:flex;gap:14px;margin:14px 0;align-items:flex-start}'
    + '.sg-step-num{flex-shrink:0;width:30px;height:30px;border-radius:50%;background:#4f46e5;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700}'
    + '.sg-card{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin:14px 0;background:#fff}'
    + '.sg-card-header{padding:12px 18px;background:#f1f5f9;font-weight:700;border-bottom:1px solid #e2e8f0}'
    + '.sg-card-body{padding:16px 18px}'
    + '.sg-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:14px 0}'
    + '.sg-timeline{position:relative;padding-left:28px;margin:14px 0}'
    + '.sg-timeline::before{content:"";position:absolute;left:8px;top:4px;bottom:4px;width:2px;background:#818cf8}'
    + '.sg-timeline-item{position:relative;margin-bottom:16px}'
    + '.sg-timeline-item::before{content:"";position:absolute;left:-24px;top:6px;width:10px;height:10px;border-radius:50%;background:#4f46e5;border:2px solid #fff;box-shadow:0 0 0 2px #4f46e5}'
    /* Interactive Q&A v3 — clickable options with radio buttons */
    + '.sg-quiz-section{margin:28px 0}'
    + '.sg-quiz-item-v3{border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin-bottom:12px;background:#fff}'
    + '.sg-quiz-question-v3{font-weight:700;font-size:15px;margin-bottom:12px}'
    + '.sg-quiz-choices-v3{position:relative}'
    + '.sg-q-radio{position:absolute;opacity:0;pointer-events:none;width:0;height:0}'
    + '.sg-q-opt{display:block;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;margin-bottom:6px;background:#fafbfc;font-size:14px;transition:all 0.15s ease}'
    + '.sg-q-opt:hover{border-color:#818cf8;background:#eef2ff}'
    + '.sg-q-radio:checked+.sg-q-opt{border-color:#4f46e5;background:#eef2ff;font-weight:600;box-shadow:0 0 0 1px #4f46e5}'
    + '.sg-q-feedback{display:none;margin-top:12px;padding:14px 16px;background:linear-gradient(135deg,#d1fae5,#ecfdf5);border:1px solid #6ee7b7;border-radius:12px;animation:sgFadeSlide 0.3s ease}'
    + '.sg-q-correct:checked~.sg-q-feedback{display:block}'
    + '.sg-q-feedback .sg-answer-correct{font-size:15px;margin-bottom:6px;color:#065f46}'
    + '.sg-q-feedback .sg-explanation{font-size:14px;color:#64748b;line-height:1.7;margin-top:6px}'
    + '@keyframes sgFadeSlide{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}'
    + '@media(max-width:600px){.sg-grid-2{grid-template-columns:1fr}.sg-hero{padding:20px 16px}.sg-hero h1{font-size:20px}}'
    + '</style>';

  if (!code || code.length < 10) {
    iframe.srcdoc = previewCss + '<body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui;color:#94a3b8;font-size:14px">📝 Enter HTML code to see a live preview here</body>';
  } else {
    iframe.srcdoc = previewCss + code;
  }
}

/** Debounced preview update on typing */
var _htmlPreviewTimer = null;
function onHtmlCodeInput() {
  if (_htmlPreviewTimer) clearTimeout(_htmlPreviewTimer);
  _htmlPreviewTimer = setTimeout(updateHtmlPreview, 400);
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

  var btnGenQuiz = el('btn-generate-quiz-from-pdf');
  if (btnGenQuiz) btnGenQuiz.addEventListener('click', generateQuizFromPdf);
  var btnGen2 = el('btn-generate-quiz-from-pdf-2');
  if (btnGen2) btnGen2.addEventListener('click', generateQuizFromPdf);
  var btnGenHtmlV2 = el('btn-generate-html-from-pdf-v2');
  if (btnGenHtmlV2) btnGenHtmlV2.addEventListener('click', generateHtmlFromPdf);

  // Study HTML sub-tabs (Code / Preview)
  var htmlTabs = document.querySelector('.study-html-tabs');
  if (htmlTabs) {
    htmlTabs.addEventListener('click', function(e) {
      var tab = e.target.closest('.study-html-tab');
      if (!tab) return;
      var tabName = tab.getAttribute('data-html-tab');
      var allTabs = htmlTabs.querySelectorAll('.study-html-tab');
      for (var ht = 0; ht < allTabs.length; ht++) allTabs[ht].classList.remove('active');
      tab.classList.add('active');
      var panels = document.querySelectorAll('.study-html-panel');
      for (var hp = 0; hp < panels.length; hp++) {
        panels[hp].classList.toggle('active', panels[hp].getAttribute('data-html-panel') === tabName);
      }
      // Auto-refresh preview when switching to Preview tab
      if (tabName === 'preview') updateHtmlPreview();
    });
  }

  // Live preview: input on code textarea triggers debounced preview update
  var codeAreaV2 = el('edit-html-code-v2');
  if (codeAreaV2) codeAreaV2.addEventListener('input', onHtmlCodeInput);
  var refreshBtn = el('btn-refresh-preview');
  if (refreshBtn) refreshBtn.addEventListener('click', updateHtmlPreview);

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
