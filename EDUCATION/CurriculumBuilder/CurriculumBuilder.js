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
var editingHiddenDocUrls = [];  // URLs hidden from student view
var editingFlashcards = [];     // Flashcards (generated from PDFs)
var editingHtmlCode = '';       // Raw HTML code (not URL — embedded directly)
var editingStudyHtmlData = null;   // JSON data: { components: [...] }
var editingPresentationHtml = '';  // AI-generated presentation HTML (slides)
var editingHiddenSections = [];    // Content sections hidden from students
var editingQuizQuestionIdx = null;
var editingQuizQuestionSetIdx = null;
var editingSourceLinkIdx = null;
var editingYoutubeIdx = null;
var editingPdfIdx = null;
var editingPdfType = null;

/* ── Constants ── */
var QUIZ_SETS = 3;
var QUIZ_PER_SET = 5;
var LESSON_DOC_TYPE = 'curriculum-lessons-uniconbase';

/* ── Lesson Document CRUD (Phase 2: heavy content lives in lesson docs) ──
   Heavy lesson content (notes, HTML code, study data, presentation HTML,
   flashcards, quiz, source links) is stored ONLY in separate CMS objects of
   type curriculum-lessons-uniconbase. The main curriculum document keeps
   only light metadata (title, order, minutes, file URLs, lessonDocId) so it
   never approaches the Firestore 1MB document limit. The student tool
   already reads heavy content from the lesson docs via lessonDocId.

   REQUIRED CMS ADMIN CONFIG (Field Group → settings.allowedObjectTypes):
     { mainObjectType: 'curriculum-lessons-uniconbase',
       role: 'editor',
       scope: 'shared',
       targetCollection: 'private' }
   • scope: 'shared' → accessible across all curriculum instances, no parent filtering
   • targetCollection: 'private' → stores in om_private_objects (same
     collection as the main curriculum doc)
   • Also set: settings.allowObjectCRUD: 'yes'

   Gracefully degrades if CRUD is not configured. */

/** Check if lesson doc CRUD is available */
function canUseLessonDocs() {
  return typeof tool.requestObjects === 'function';
}

/** Extract heavy fields from a lesson object for the lesson doc */
function extractHeavyLessonData(les) {
  return {
    curriculumId: tool.param('builderObjectId', '') || null,
    lessonId: les.id || null,
    title: les.title || '',
    content: les.content || null,
    htmlCode: les.htmlCode || null,
    studyHtmlData: les.studyHtmlData || null,
    presentationHtml: les.presentationHtml || null,
    flashcards: les.flashcards || null,
    quiz: les.quiz || null,
    sourceUrls: les.sourceUrls || null,
    hiddenSections: les.hiddenSections || null
  };
}

/* ── 1MB Guard: heavy lesson content lives in lesson docs, NOT the main doc ──
   The main curriculum document must stay under Firestore's 1MB limit.
   These helpers keep only light metadata in the main doc and mirror heavy
   fields (content, htmlCode, studyHtmlData, presentationHtml, flashcards,
   quiz, sourceUrls) exclusively to curriculum-lessons-uniconbase docs. */
var HEAVY_LESSON_FIELDS = ['content', 'htmlCode', 'studyHtmlData', 'presentationHtml', 'flashcards', 'quiz', 'sourceUrls'];

function hasHeavyLessonFields(les) {
  for (var i = 0; i < HEAVY_LESSON_FIELDS.length; i++) {
    if (les[HEAVY_LESSON_FIELDS[i]]) return true;
  }
  return false;
}

/** Count items in a value that can be an array or a JSON-string array */
function countList(val) {
  if (!val) return 0;
  if (Array.isArray(val)) return val.length;
  if (typeof val === 'string') {
    try {
      var parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch (e) { return val.length > 0 ? 1 : 0; }
  }
  return 0;
}

/** Count quiz questions in either array or JSON-string form */
function countQuizQuestions(quiz) {
  return countList(quiz);
}

/** Count flashcards in either array or JSON-string form */
function countFlashcards(flashcards) {
  return countList(flashcards);
}

/** True when a lesson has real (non-empty) notes/rich text content */
function hasLessonNotes(les) {
  return !!(les.content && String(les.content).replace(/<[^>]*>/g, '').trim());
}

/** True when a lesson has generated study content (htmlCode / studyHtmlData) */
function hasLessonStudyContent(les) {
  return !!((les.htmlCode && String(les.htmlCode).length > 20) ||
            (les.studyHtmlData && String(les.studyHtmlData).length > 20));
}

/** Compute and set lightweight summary fields so the main doc's lesson list
 *  can show quiz/media counts even after heavy fields are stripped. */
function writeLessonSummaryFields(les) {
  les.quizCount = countQuizQuestions(les.quiz);
  les.flashcardCount = countFlashcards(les.flashcards);
  les.sourceUrlCount = countList(les.sourceUrls);
  les.hasNotes = hasLessonNotes(les);
  les.hasStudyContent = hasLessonStudyContent(les);
  les.hasPresentation = !!(les.presentationHtml && String(les.presentationHtml).length > 20);
  return les;
}

function stripHeavyLessonFields(les) {
  // Persist lightweight summary fields before removing the heavy originals.
  writeLessonSummaryFields(les);
  for (var i = 0; i < HEAVY_LESSON_FIELDS.length; i++) {
    delete les[HEAVY_LESSON_FIELDS[i]];
  }
  return les;
}

/** One-time-per-page-load migration: move legacy heavy content out of the
 *  main curriculum document into per-lesson docs (fixes the Firestore 1MB
 *  limit error on the main doc). Only strips lessons whose doc copy is
 *  confirmed to exist — on doc failure the heavy content stays put. */
function migrateLessonsToDocsIfNeeded() {
  if (window._lessonsMigratedOnce) return;
  if (!canUseLessonDocs()) { window._lessonsMigratedOnce = true; return; }
  if (tool.isReadOnly && tool.isReadOnly()) return; // retry when editable
  var work = [];
  for (var si = 0; si < sections.length; si++) {
    var lessons = sections[si].lessons || [];
    for (var li = 0; li < lessons.length; li++) {
      if (hasHeavyLessonFields(lessons[li])) work.push({ si: si, li: li });
    }
  }
  if (work.length === 0) { window._lessonsMigratedOnce = true; return; }
  window._lessonsMigratedOnce = true;
  console.log('[CurriculumBuilder] migrating ' + work.length + ' heavy lesson(s) to lesson docs...');

  var remaining = work.length;
  var anyFailed = false;
  function finishMigration() {
    for (var si2 = 0; si2 < sections.length; si2++) {
      var ls = sections[si2].lessons || [];
      for (var li2 = 0; li2 < ls.length; li2++) {
        var les = ls[li2];
        if (les._keepHeavy) { delete les._keepHeavy; continue; }
        if (les.lessonDocId && hasHeavyLessonFields(les)) stripHeavyLessonFields(les);
      }
    }
    saveCurriculum();
    if (anyFailed) {
      tool.notify('⚠️ Curriculum shrunk, but some lesson docs failed to save — those lessons keep their content in the main document.', 'warning');
    } else {
      tool.notify('✅ Curriculum optimized: heavy lesson content moved to lesson docs.', 'success');
    }
  }
  for (var w = 0; w < work.length; w++) {
    (function(wk) {
      var lesson = sections[wk.si].lessons[wk.li];
      saveLessonDoc(lesson, function(err, docId) {
        if (docId) lesson.lessonDocId = docId;
        if (err) { anyFailed = true; lesson._keepHeavy = true; }
        remaining--;
        if (remaining <= 0) finishMigration();
      });
    })(work[w]);
  }
}

/** One-time-per-page-load backfill: lessons stripped by the PRE-summary
 *  migration have no quizCount/flashcardCount/etc. in the main doc, so the
 *  list can't show counts. Read each such lesson's doc and persist the
 *  summary fields. Failed reads are skipped (retried on next load). */
function backfillLessonSummariesIfNeeded() {
  if (window._summariesBackfilledOnce) return;
  if (!canUseLessonDocs()) { window._summariesBackfilledOnce = true; return; }
  if (tool.isReadOnly && tool.isReadOnly()) return; // retry when editable
  var work = [];
  for (var si = 0; si < sections.length; si++) {
    var lessons = sections[si].lessons || [];
    for (var li = 0; li < lessons.length; li++) {
      var les = lessons[li];
      if (les.lessonDocId && les.quizCount === undefined) work.push({ si: si, li: li, id: les.id });
    }
  }
  if (work.length === 0) { window._summariesBackfilledOnce = true; return; }
  window._summariesBackfilledOnce = true;
  console.log('[CurriculumBuilder] backfilling summary fields for ' + work.length + ' lesson(s)...');

  var remaining = work.length;
  var changed = false;
  for (var w = 0; w < work.length; w++) {
    (function(wk) {
      var sec = sections[wk.si];
      var current = sec && sec.lessons ? sec.lessons[wk.li] : null;
      if (!current || current.id !== wk.id || !current.lessonDocId) {
        remaining--;
        if (remaining === 0 && changed) saveCurriculum();
        return;
      }
      loadLessonDoc(current, function(err, merged) {
        remaining--;
        if (!err && merged) {
          // Summaries come from doc data; heavy fields are already safe in
          // the doc, so strip them from the main-doc copy too.
          writeLessonSummaryFields(merged);
          stripHeavyLessonFields(merged);
          var secNow = sections[wk.si];
          if (secNow && secNow.lessons && secNow.lessons[wk.li] && secNow.lessons[wk.li].id === wk.id) {
            secNow.lessons[wk.li] = merged;
            changed = true;
          }
        }
        // On failure leave summary fields unset so the next load retries.
        if (remaining === 0 && changed) saveCurriculum();
      });
    })(work[w]);
  }
}

/** Create or update a lesson doc. Returns lessonDocId via callback. */
function saveLessonDoc(lessonObj, callback) {
  if (!canUseLessonDocs()) {
    if (callback) callback(null, lessonObj.lessonDocId || null);
    return;
  }
  var heavyData = extractHeavyLessonData(lessonObj);
  var lessonDocId = lessonObj.lessonDocId;
  
  if (lessonDocId) {
    // Update existing lesson doc
    tool.requestObjects('update', {
      mainObjectType: LESSON_DOC_TYPE,
      objectId: lessonDocId,
      name: lessonObj.title || 'Lesson',
      productData: { data_categoriesBased: { lessonJson: JSON.stringify(heavyData) } }
    }, function(err) {
      if (err) { console.warn('Lesson doc update failed:', err); }
      // Don't pass docId — it already exists, no need to re-save main doc
      if (callback) callback(err);
    });
  } else {
    // Create new lesson doc
    tool.requestObjects('create', {
      mainObjectType: LESSON_DOC_TYPE,
      name: lessonObj.title || 'Lesson',
      productData: { data_categoriesBased: { lessonJson: JSON.stringify(heavyData) } }
    }, function(err, result) {
      if (err) { console.warn('Lesson doc create failed:', err); }
      var newId = (result && result.object) ? result.object.id : null;
      if (callback) callback(err, newId);
    });
  }
}

/** Load heavy lesson data from a lesson doc. Falls back to main doc data. */
function loadLessonDoc(lessonObj, callback) {
  if (!canUseLessonDocs() || !lessonObj.lessonDocId) {
    // No lesson doc — use data already in the main doc lesson object
    if (callback) callback(null, lessonObj);
    return;
  }
  tool.requestObjects('get', {
    mainObjectType: LESSON_DOC_TYPE,
    objectId: lessonObj.lessonDocId
  }, function(err, result) {
    if (err || !result || !result.object) {
      // Fall back to data in the main doc
      console.warn('Lesson doc load failed, using main doc data:', err);
      if (callback) callback(err || new Error('lesson doc not found'), lessonObj);
      return;
    }
    try {
      var pd = result.object.productData;
      var raw = pd && pd.data_categoriesBased && pd.data_categoriesBased.lessonJson;
      var docData = raw ? JSON.parse(raw) : {};
      // Merge: lesson doc data wins, fall back to main doc for any missing fields
      var merged = JSON.parse(JSON.stringify(lessonObj));
      if (docData.content !== undefined) merged.content = docData.content;
      if (docData.htmlCode !== undefined) merged.htmlCode = docData.htmlCode;
      if (docData.studyHtmlData !== undefined) merged.studyHtmlData = docData.studyHtmlData;
      if (docData.presentationHtml !== undefined) merged.presentationHtml = docData.presentationHtml;
      if (docData.flashcards !== undefined) merged.flashcards = docData.flashcards;
      if (docData.quiz !== undefined) merged.quiz = docData.quiz;
      if (docData.sourceUrls !== undefined) merged.sourceUrls = docData.sourceUrls;
      if (docData.hiddenSections !== undefined) merged.hiddenSections = docData.hiddenSections;
      if (callback) callback(null, merged);
    } catch(e) {
      console.warn('Lesson doc parse error, using main doc data:', e);
      if (callback) callback(e, lessonObj);
    }
  });
}

/** Delete a lesson doc (fire-and-forget) */
function deleteLessonDoc(lessonDocId) {
  if (!canUseLessonDocs() || !lessonDocId) return;
  tool.requestObjects('delete', {
    mainObjectType: LESSON_DOC_TYPE,
    objectId: lessonDocId
  }, function(err) {
    if (err) console.warn('Lesson doc delete failed:', err);
  });
}

/** True only when the current user has the 'developer' role.
 *  Admin alone does NOT qualify — the Firestore doc link is developer-only. */
function isDeveloper() {
  try {
    var user = tool.getUser();
    var roles = (user && user.roles) ? user.roles.map(function(r) { return String(r).toLowerCase(); }) : [];
    return roles.indexOf('developer') !== -1;
  } catch (e) { return false; }
}

/** Resolve the tenant CMS origin for doc links. The tool runs in a sandboxed
 *  iframe where window.location.origin is 'null', so the link must start with
 *  the tenant subdomain of the parent CMS page instead:
 *  1. window.location.ancestorOrigins[0] (the top-level CMS origin)
 *  2. document.referrer origin
 *  3. explicit tenantBaseUrl parameter */
function getTenantOrigin() {
  try {
    if (window.location && window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0) {
      return window.location.ancestorOrigins[0].replace(/\/+$/, '');
    }
  } catch (e) { /* ignore */ }
  try {
    var ref = document.referrer;
    if (ref) {
      var m = ref.match(/^(https?:\/\/[^/]+)/i);
      if (m) return m[1];
    }
  } catch (e) { /* ignore */ }
  var fallback = tool.param('tenantBaseUrl', '');
  if (fallback) return fallback.replace(/\/+$/, '');
  return '';
}

/** Open a lesson's Firestore document in the CMS viewer (new tab).
 *  The URL starts with the tenant subdomain origin, not this iframe's origin. */
function openLessonDocUrl(lessonDocId) {
  if (!lessonDocId) return;
  var origin = getTenantOrigin();
  if (!origin) {
    tool.notify('Could not determine the tenant URL. Set the "tenantBaseUrl" parameter.', 'warning');
    return;
  }
  var template = tool.param('lessonDocUrlTemplate', '');
  var url;
  if (template) {
    url = template.replace('__ID__', lessonDocId).replace('__TYPE__', LESSON_DOC_TYPE).replace('__ORIGIN__', origin);
  } else {
    // Default: CMS Firestore object viewer for the lesson doc
    url = origin + '/admin/objects/' + LESSON_DOC_TYPE + '/' + lessonDocId;
  }
  tool.openUrl(url);
}

/** Show/hide the 📄 lesson doc link in the editor heading (developer only) */
function updateLessonEditorDocLink(lessonObj) {
  var heading = el('lesson-editor-heading');
  if (!heading) return;
  // Remove existing link if any
  var existing = heading.querySelector('.lesson-doc-link');
  if (existing) existing.remove();
  // Developer role only — admins without the developer role don't see the link
  if (!isDeveloper()) return;
  // Add link if lesson has a doc ID
  var docId = lessonObj && lessonObj.lessonDocId;
  if (docId) {
    var link = document.createElement('span');
    link.className = 'lesson-doc-link';
    link.style.cssText = 'margin-left:10px;font-size:11px;font-weight:400;cursor:pointer;color:#7c3aed;text-decoration:underline;white-space:nowrap';
    link.textContent = '📄 Open Lesson Doc';
    link.title = 'Open this lesson\'s Firestore document in a new tab';
    link.addEventListener('click', function(e) {
      e.stopPropagation();
      openLessonDocUrl(docId);
    });
    heading.appendChild(link);
  }
}

/* ═══════════════════════════════════════════
   STUDY CONTENT COMPONENTS — Rich Block Library (101 block types)
   System composes them freely: {"components":[{type,data},...]}
   ═══════════════════════════════════════════ */
var STUDY_COMPONENTS = {
  // ── 1. callout ── colored left-border alert box
  'callout': {
    desc: 'Colored alert box. variant: info|tip|key|warn. Each has icon + color.',
    render: function(d) {
      var colors = { info: ['#3b82f6','#eff6ff','ℹ️'], tip: ['#059669','#ecfdf5','💡'], key: ['#d97706','#fef3c7','🔑'], warn: ['#dc2626','#fee2e2','⚠️'] };
      var c = colors[d.variant] || colors.info;
      return '<div style="border-left:4px solid '+c[0]+';background:'+c[1]+';padding:14px 18px;margin:16px 0;border-radius:0 8px 8px 0">' +
        '<div style="font-weight:700;color:'+c[0]+';margin-bottom:4px">'+c[2]+' ' + esc(d.title || '') + '</div>' +
        '<p style="color:#1e293b;margin:0">'+esc(d.body || d.text || '')+'</p></div>';
    }
  },
  // ── 2. html ── raw HTML block
  'html': {
    desc: 'Raw HTML content (scripts stripped)',
    render: function(d) {
      var safe = (d.html || '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      return '<div class="detail-content">' + safe + '</div>';
    }
  },
  // ── 3. image-block ── centered image with captions
  'image-block': {
    desc: 'Centered image with optional alt, caption, credit, maxHeight',
    render: function(d) {
      var h = '<div style="text-align:center;margin:20px 0">';
      h += '<img src="'+esc(d.url)+'" alt="'+esc(d.alt||'')+'" style="max-width:100%;max-height:'+(d.maxHeight||400)+'px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1)">';
      if (d.caption) h += '<p style="font-style:italic;color:#64748b;margin-top:8px">'+esc(d.caption)+'</p>';
      if (d.credit) h += '<p style="font-size:11px;color:#94a3b8">'+esc(d.credit)+'</p>';
      return h + '</div>';
    }
  },
  // ── 4. intro-hero ── large gradient hero for section/lesson start
  'intro-hero': {
    desc: 'Large hero card. icon(emoji), heading, description, optional objectives array.',
    render: function(d) {
      var h = '<div class="sg-hero" style="padding:40px 24px">';
      if (d.icon) h += '<div style="font-size:56px;margin-bottom:12px">'+esc(d.icon)+'</div>';
      h += '<h1 style="font-family:Georgia,serif;font-size:28px;font-weight:800;color:#3730a3;margin-bottom:8px">'+esc(d.heading)+'</h1>';
      h += '<p style="font-size:16px;color:#64748b;max-width:650px;margin:0 auto 16px">'+esc(d.description)+'</p>';
      if (d.objectives && d.objectives.length) {
        h += '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center">';
        for (var i=0;i<d.objectives.length;i++) h += '<span style="display:inline-flex;align-items:center;gap:4px;background:#d1fae5;color:#065f46;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600">✅ '+esc(typeof d.objectives[i]==='string'?d.objectives[i]:d.objectives[i].text)+'</span>';
        h += '</div>';
      }
      return h + '</div>';
    }
  },
  // ── 5. fact-grid ── responsive grid of label/value cards
  'fact-grid': {
    desc: 'Grid of label/value cards. cols: 2|3|4. items: [{label, value}].',
    render: function(d) {
      var cols = { '2':'1fr 1fr','3':'1fr 1fr 1fr','4':'1fr 1fr 1fr 1fr' };
      var h = '<div style="display:grid;grid-template-columns:'+(cols[d.cols]||cols['2'])+';gap:12px;margin:16px 0">';
      for (var i=0;i<(d.items||[]).length;i++) {
        var it = d.items[i];
        h += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center">';
        h += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:4px">'+esc(it.label)+'</div>';
        h += '<div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1e293b">'+esc(it.value)+'</div>';
        h += '</div>';
      }
      return h + '</div>';
    }
  },
  // ── 6. pros-cons ── side-by-side green/red panels
  'pros-cons': {
    desc: 'Side-by-side pros (green) and cons (red)',
    render: function(d) {
      var h = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0">';
      h += '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:16px"><h3 style="color:#065f46;margin-bottom:8px">✅ '+esc(d.prosTitle||'Pros')+'</h3><ul style="list-style:none;padding:0">';
      for (var i=0;i<(d.pros||[]).length;i++) h += '<li style="padding:4px 0;color:#475569">➕ '+esc(d.pros[i])+'</li>';
      h += '</ul></div>';
      h += '<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:16px"><h3 style="color:#991b1b;margin-bottom:8px">❌ '+esc(d.consTitle||'Cons')+'</h3><ul style="list-style:none;padding:0">';
      for (var j=0;j<(d.cons||[]).length;j++) h += '<li style="padding:4px 0;color:#475569">➖ '+esc(d.cons[j])+'</li>';
      h += '</ul></div></div>';
      return h;
    }
  },
  // ── 7. data-table ── styled header+body table
  'data-table': {
    desc: 'Styled table. columns:[{key,header}], rows:[{key:value}].',
    render: function(d) {
      var cols = d.columns || [];
      var rows = d.rows || [];
      if (!cols.length || !rows.length) return '';
      var h = '<div style="overflow-x:auto;margin:16px 0"><table class="sg-table"><thead><tr>';
      for (var c=0;c<cols.length;c++) h += '<th>'+esc(cols[c].header||cols[c])+'</th>';
      h += '</tr></thead><tbody>';
      for (var r=0;r<rows.length;r++) {
        h += '<tr>';
        for (var c2=0;c2<cols.length;c2++) h += '<td>'+esc(rows[r][cols[c2].key]||'')+'</td>';
        h += '</tr>';
      }
      return h + '</tbody></table></div>';
    }
  },
  // ── 8. key-numbers ── large centered stat numbers
  'key-numbers': {
    desc: 'Large centered stat numbers. items:[{value,unit,label}].',
    render: function(d) {
      var h = '<div style="display:flex;flex-wrap:wrap;gap:24px;justify-content:center;margin:24px 0">';
      for (var i=0;i<(d.items||[]).length;i++) {
        var it = d.items[i];
        h += '<div style="text-align:center;min-width:120px"><div style="font-family:Georgia,serif;font-size:36px;font-weight:800;color:#4f46e5">'+esc(it.value);
        if (it.unit) h += '<span style="font-size:18px;color:#818cf8">'+esc(it.unit)+'</span>';
        h += '</div><div style="font-size:13px;color:#64748b;margin-top:4px">'+esc(it.label)+'</div></div>';
      }
      return h + '</div>';
    }
  },
  // ── 9. memory-box ── amber key-takeaways box with pin
  'memory-box': {
    desc: 'Amber key takeaways box. title, rows:[{key,value}].',
    render: function(d) {
      var h = '<div style="background:linear-gradient(135deg,#fef3c7,#fef9e7);border:1px solid #fcd34d;border-radius:12px;padding:20px 24px;margin:16px 0">';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:20px">📌</span><strong style="color:#92400e;font-size:16px">'+esc(d.title||'Key Takeaways')+'</strong></div>';
      for (var i=0;i<(d.rows||[]).length;i++) {
        var r = d.rows[i];
        h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #fde68a"><strong style="color:#b45309">'+esc(r.key)+'</strong><span style="color:#64748b">'+esc(r.value)+'</span></div>';
      }
      return h + '</div>';
    }
  },
  // ── 10. definition-list ── term/definition with alternating bg
  'definition-list': {
    desc: 'Term/definition list. title, terms:[{term,definition}].',
    render: function(d) {
      var h = '<div style="margin:16px 0">';
      if (d.title) h += '<h3 style="color:#4f46e5;margin-bottom:10px;font-weight:700">📖 '+esc(d.title)+'</h3>';
      for (var i=0;i<(d.terms||[]).length;i++) {
        var t = d.terms[i];
        var bg = i%2===0?'#f8fafc':'#fff';
        h += '<div style="display:flex;gap:16px;padding:10px 14px;background:'+bg+';border-radius:6px"><strong style="min-width:140px;text-align:right;color:#4f46e5">'+esc(t.term)+'</strong><span style="color:#64748b">'+esc(t.definition)+'</span></div>';
      }
      return h + '</div>';
    }
  },
  // ── 11. stat-row ── horizontal emoji stat cards
  'stat-row': {
    desc: 'Horizontal stat cards. items:[{emoji,value,label}].',
    render: function(d) {
      var h = '<div style="display:flex;flex-wrap:wrap;gap:12px;margin:16px 0">';
      for (var i=0;i<(d.items||[]).length;i++) {
        var it = d.items[i];
        h += '<div style="flex:1;min-width:140px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center">';
        if (it.emoji) h += '<div style="font-size:28px;margin-bottom:6px">'+esc(it.emoji)+'</div>';
        h += '<div style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#1e293b">'+esc(it.value)+'</div>';
        h += '<div style="font-size:11px;color:#94a3b8;margin-top:2px">'+esc(it.label)+'</div></div>';
      }
      return h + '</div>';
    }
  },
  // ── 12. weight-bar ── visual range indicator with colored dots
  'weight-bar': {
    desc: 'Weight/range bars. segments:[{range,label,rule,color:green|blue|amber|red}].',
    render: function(d) {
      var dotColors = { green:'#059669', blue:'#3b82f6', amber:'#d97706', red:'#dc2626' };
      var h = '<div style="margin:16px 0">';
      for (var i=0;i<(d.segments||[]).length;i++) {
        var s = d.segments[i];
        var dc = dotColors[s.color] || '#3b82f6';
        h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0">';
        h += '<span style="width:12px;height:12px;border-radius:50%;background:'+dc+';flex-shrink:0"></span>';
        h += '<strong style="min-width:80px;color:#1e293b">'+esc(s.range)+'</strong>';
        h += '<span style="color:#64748b">'+esc(s.label)+'</span>';
        if (s.rule) h += '<span style="font-size:11px;color:#94a3b8;margin-left:auto">'+esc(s.rule)+'</span>';
        h += '</div>';
      }
      return h + '</div>';
    }
  },
  // ── 13. phase-flow ── vertical connected timeline
  'phase-flow': {
    desc: 'Vertical timeline. phases:[{name,description,emoji,color:green|blue|amber|red|purple}].',
    render: function(d) {
      var dotColors = { green:'#059669', blue:'#3b82f6', amber:'#d97706', red:'#dc2626', purple:'#7c3aed' };
      var h = '<div style="position:relative;padding-left:40px;margin:20px 0">';
      h += '<div style="position:absolute;left:17px;top:8px;bottom:8px;width:2px;background:#e2e8f0"></div>';
      for (var i=0;i<(d.phases||[]).length;i++) {
        var p = d.phases[i];
        var dc = dotColors[p.color] || '#4f46e5';
        h += '<div style="position:relative;margin-bottom:20px">';
        h += '<div style="position:absolute;left:-28px;top:4px;width:24px;height:24px;border-radius:50%;background:'+dc+';display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;border:3px solid #fff;box-shadow:0 0 0 2px '+dc+'">'+(p.emoji||'●')+'</div>';
        h += '<strong style="color:#1e293b">'+esc(p.name)+'</strong>';
        h += '<p style="color:#64748b;margin:4px 0 0">'+esc(p.description)+'</p>';
        h += '</div>';
      }
      return h + '</div>';
    }
  },
  // ── 14. icon-grid ── responsive emoji card grid
  'icon-grid': {
    desc: 'Emoji card grid. cols:2|3|4. items:[{emoji,name,subtitle,highlight:yes}].',
    render: function(d) {
      var cols = { '2':'1fr 1fr','3':'1fr 1fr 1fr','4':'1fr 1fr 1fr 1fr' };
      var h = '<div style="display:grid;grid-template-columns:'+(cols[d.cols]||cols['3'])+';gap:12px;margin:16px 0">';
      for (var i=0;i<(d.items||[]).length;i++) {
        var it = d.items[i];
        var border = it.highlight==='yes' ? '2px solid #4f46e5' : '1px solid #e2e8f0';
        h += '<div style="background:#fff;border:'+border+';border-radius:10px;padding:20px 12px;text-align:center">';
        h += '<div style="font-size:32px;margin-bottom:8px">'+esc(it.emoji||'📌')+'</div>';
        h += '<div style="font-weight:600;color:#1e293b">'+esc(it.name)+'</div>';
        if (it.subtitle) h += '<div style="font-size:12px;color:#94a3b8;margin-top:4px">'+esc(it.subtitle)+'</div>';
        h += '</div>';
      }
      return h + '</div>';
    }
  },
  // ── 15. card-grid ── expandable detail cards
  'card-grid': {
    desc: 'Expandable cards. cols:2|3. items:[{emoji,name,tag,tagColor,description,imageUrl,detail:{facts,pros,cons,note}}].',
    render: function(d) {
      var cols = { '2':'1fr 1fr','3':'1fr 1fr 1fr' };
      var tagColors = { blue:'#3b82f6', green:'#059669', amber:'#d97706', purple:'#7c3aed', red:'#dc2626' };
      var h = '<div style="display:grid;grid-template-columns:'+(cols[d.cols]||cols['2'])+';gap:14px;margin:16px 0">';
      for (var i=0;i<(d.items||[]).length;i++) {
        var it = d.items[i];
        h += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">';
        if (it.imageUrl) h += '<img src="'+esc(it.imageUrl)+'" style="width:100%;height:140px;object-fit:cover" alt="">';
        h += '<div style="padding:16px">';
        if (it.emoji) h += '<div style="font-size:28px;margin-bottom:6px">'+esc(it.emoji)+'</div>';
        h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><strong style="color:#1e293b">'+esc(it.name)+'</strong>';
        if (it.tag) h += '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:'+(tagColors[it.tagColor]||'#3b82f6')+';color:#fff">'+esc(it.tag)+'</span>';
        h += '</div>';
        if (it.description) h += '<p style="color:#64748b;font-size:13px;margin-bottom:10px">'+esc(it.description)+'</p>';
        if (it.detail) {
          h += '<details style="margin-top:8px"><summary style="cursor:pointer;color:#4f46e5;font-weight:600;font-size:13px">📋 Show details</summary>';
          h += '<div style="margin-top:10px;padding:12px;background:#f8fafc;border-radius:8px">';
          var dt = it.detail;
          if (dt.facts && dt.facts.length) {
            h += '<table style="width:100%;font-size:12px;margin-bottom:10px">';
            for (var f=0;f<dt.facts.length;f++) h += '<tr><td style="padding:4px 0;font-weight:600;color:#4f46e5">'+esc(dt.facts[f].label)+'</td><td style="color:#64748b">'+esc(dt.facts[f].value)+'</td></tr>';
            h += '</table>';
          }
          if (dt.pros && dt.pros.length) { h += '<div style="color:#065f46;font-size:12px"><strong>✅ Pros:</strong><ul style="margin:4px 0 8px 16px">'; for (var pp=0;pp<dt.pros.length;pp++) h += '<li>'+esc(dt.pros[pp])+'</li>'; h += '</ul></div>'; }
          if (dt.cons && dt.cons.length) { h += '<div style="color:#991b1b;font-size:12px"><strong>❌ Cons:</strong><ul style="margin:4px 0 8px 16px">'; for (var cc=0;cc<dt.cons.length;cc++) h += '<li>'+esc(dt.cons[cc])+'</li>'; h += '</ul></div>'; }
          if (dt.note) h += STUDY_COMPONENTS.callout.render(dt.note);
          h += '</div></details>';
        }
        h += '</div></div>';
      }
      return h + '</div>';
    }
  },
  // ── 16. scenario ── purple scenario box with hidden debrief
  'scenario': {
    desc: 'Purple scenario box. context, question, debrief (hidden behind Reveal button).',
    render: function(d) {
      var h = '<div style="background:linear-gradient(135deg,#f5f3ff,#ede9fe);border:1px solid #c4b5fd;border-radius:12px;padding:20px;margin:16px 0">';
      h += '<div style="font-weight:700;color:#6d28d9;margin-bottom:8px">🎬 Scenario</div>';
      h += '<p style="color:#1e293b"><strong>Situation:</strong> '+esc(d.context||d.situation)+'</p>';
      if (d.question) h += '<p style="color:#4f46e5;font-weight:600;margin-top:10px">❓ '+esc(d.question)+'</p>';
      h += '<details style="margin-top:12px"><summary style="cursor:pointer;background:#7c3aed;color:#fff;border:none;padding:8px 18px;border-radius:6px;font-weight:600;font-size:13px;display:inline-block">👁️ Reveal Debrief</summary>';
      h += '<div style="margin-top:12px;padding:14px;background:#fff;border-radius:8px;border:1px solid #c4b5fd">';
      h += '<strong style="color:#6d28d9">💡 Debrief:</strong><p style="color:#64748b;margin-top:4px">'+esc(d.debrief||d.answer||d.explanation||'')+'</p>';
      h += '</div></details></div>';
      return h;
    }
  },
  // ── 17. separator ── horizontal divider with optional label
  'separator': {
    desc: 'Divider line with optional centered label.',
    render: function(d) {
      if (d.label) {
        return '<div style="display:flex;align-items:center;gap:12px;margin:24px 0"><div style="flex:1;height:1px;background:#e2e8f0"></div><span style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;white-space:nowrap">'+esc(d.label)+'</span><div style="flex:1;height:1px;background:#e2e8f0"></div></div>';
      }
      return '<div class="sg-divider"></div>';
    }
  },
  // ── 18. quiz ── interactive Q&A with radio buttons
  'quiz': {
    desc: 'Interactive quiz. items:[{question, options:[], correct:0, explanation}].',
    render: function(d) {
      var items = d.items || [];
      if (!items.length) return '';
      var h = '<div class="sg-quiz-section">';
      for (var i = 0; i < items.length; i++) {
        var q = items[i];
        var qid = 'q-' + Date.now() + '-' + i;
        h += '<div class="sg-quiz-item-v3"><div class="sg-quiz-question-v3">' + (i+1) + '. ' + esc(q.question || '') + '</div><div class="sg-quiz-choices-v3">';
        for (var o = 0; o < (q.options || []).length; o++) {
          var isCorrect = o === (q.correct || 0);
          var cls = isCorrect ? ' sg-q-correct' : '';
          h += '<input type="radio" class="sg-q-radio' + cls + '" name="' + qid + '" id="' + qid + '-' + o + '"><label class="sg-q-opt" for="' + qid + '-' + o + '">' + esc(q.options[o]) + '</label>';
        }
        h += '<div class="sg-q-feedback"><div class="sg-answer-correct">✅ ' + esc(q.options && q.options[q.correct || 0] ? q.options[q.correct || 0] : 'Correct answer') + '</div>';
        if (q.explanation) h += '<div class="sg-explanation">' + esc(q.explanation) + '</div>';
        h += '</div></div></div>';
      }
      return h + '</div>';
    }
  },
  // ── 19. accordion ── collapsible sections
  'accordion': {
    desc: 'Collapsible sections. items:[{title, content, icon?, open?}].',
    render: function(d) {
      var h = '<div style="margin:16px 0">';
      for (var i=0;i<(d.items||[]).length;i++) {
        var it = d.items[i];
        h += '<details style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;overflow:hidden"'+(it.open?' open':'')+'>';
        h += '<summary style="padding:12px 16px;background:#f8fafc;cursor:pointer;font-weight:600;color:#1e293b;user-select:none">'+(it.icon||'📂')+' '+esc(it.title)+'</summary>';
        h += '<div style="padding:14px 16px;color:#475569;line-height:1.7">'+(it.content||it.body||'')+'</div>';
        h += '</details>';
      }
      return h+'</div>';
    }
  },
  // ── 20. quote ── styled blockquote
  'quote': {
    desc: 'Styled quotation. text, attribution?, icon? (💬).',
    render: function(d) {
      var icon = d.icon||'💬';
      return '<blockquote style="border-left:4px solid #818cf8;margin:20px 0;padding:16px 24px;background:linear-gradient(135deg,#eef2ff,#f8fafc);border-radius:0 12px 12px 0">'+
        '<div style="font-size:24px;margin-bottom:8px">'+icon+'</div>'+
        '<p style="margin:0;font-style:italic;color:#475569;font-size:15px">'+esc(d.text||d.quote||'')+'</p>'+
        (d.attribution?'<footer style="margin-top:10px;font-style:normal;font-weight:600;color:#4f46e5;font-size:13px">— '+esc(d.attribution)+'</footer>':'')+
        '</blockquote>';
    }
  },
  // ── 21. comparison ── multi-dimension A vs B table
  'comparison': {
    desc: 'Side-by-side comparison. aLabel, bLabel, rows:[{dimension, a, b}].',
    render: function(d) {
      var h = '<div style="overflow-x:auto;margin:16px 0"><table style="width:100%;border-collapse:collapse;font-size:14px">';
      h += '<thead><tr><th style="padding:10px 14px;background:#f1f5f9;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0;width:30%">Dimension</th>';
      h += '<th style="padding:10px 14px;background:#eef2ff;text-align:left;font-weight:600;border-bottom:2px solid #818cf8;color:#4f46e5">'+esc(d.aLabel||'A')+'</th>';
      h += '<th style="padding:10px 14px;background:#fef3c7;text-align:left;font-weight:600;border-bottom:2px solid #fcd34d;color:#92400e">'+esc(d.bLabel||'B')+'</th>';
      h += '</tr></thead><tbody>';
      for (var i=0;i<(d.rows||[]).length;i++) {
        var r = d.rows[i];
        var bg = i%2===0?'#fff':'#fafbfc';
        h += '<tr><td style="padding:10px 14px;background:'+bg+';font-weight:600;color:#1e293b;border-bottom:1px solid #e2e8f0">'+esc(r.dimension||r.label||'')+'</td>';
        h += '<td style="padding:10px 14px;background:'+bg+';color:#64748b;border-bottom:1px solid #e2e8f0">'+esc(r.a)+'</td>';
        h += '<td style="padding:10px 14px;background:'+bg+';color:#64748b;border-bottom:1px solid #e2e8f0">'+esc(r.b)+'</td></tr>';
      }
      return h+'</tbody></table></div>';
    }
  },
  // ── 22. timeline ── horizontal chronological timeline
  'timeline': {
    desc: 'Horizontal timeline. events:[{date, title, description?, icon?}].',
    render: function(d) {
      var h = '<div style="overflow-x:auto;margin:24px 0;padding:10px 0">';
      h += '<div style="display:flex;gap:0;min-width:max-content">';
      for (var i=0;i<(d.events||[]).length;i++) {
        var ev = d.events[i];
        var connColor = d.lineColor||'#e2e8f0';
        var dotColor = d.dotColor||'#4f46e5';
        h += '<div style="flex:1;min-width:160px;text-align:center;position:relative;padding:0 12px">';
        if (i>0) h += '<div style="position:absolute;top:20px;right:50%;width:100%;height:2px;background:'+connColor+';z-index:0"></div>';
        h += '<div style="position:relative;z-index:1;width:40px;height:40px;border-radius:50%;background:'+dotColor+';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:16px;margin-bottom:8px;box-shadow:0 0 0 4px #eef2ff">'+(ev.icon||'●')+'</div>';
        h += '<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">'+esc(ev.date||'')+'</div>';
        h += '<div style="font-weight:600;color:#1e293b;font-size:14px">'+esc(ev.title)+'</div>';
        if (ev.description) h += '<div style="font-size:12px;color:#64748b;margin-top:4px">'+esc(ev.description)+'</div>';
        h += '</div>';
      }
      return h+'</div></div>';
    }
  },
  // ── 23. worked-example ── problem → steps → solution
  'worked-example': {
    desc: 'Worked example. problem, steps:[], answer, note?.',
    render: function(d) {
      var h = '<div style="border:2px solid #a7f3d0;border-radius:12px;overflow:hidden;margin:16px 0">';
      h += '<div style="background:linear-gradient(135deg,#d1fae5,#ecfdf5);padding:14px 20px;font-weight:700;color:#065f46">✏️ Worked Example</div>';
      h += '<div style="padding:20px">';
      h += '<div style="margin-bottom:16px"><strong style="color:#1e293b">Problem:</strong> <span style="color:#64748b">'+esc(d.problem||'')+'</span></div>';
      if (d.steps && d.steps.length) {
        h += '<div style="margin-bottom:16px"><strong style="color:#1e293b">Solution Steps:</strong><ol style="margin:8px 0 0 18px;color:#64748b">';
        for (var i=0;i<d.steps.length;i++) h += '<li style="margin-bottom:6px">'+esc(d.steps[i])+'</li>';
        h += '</ol></div>';
      }
      h += '<div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:8px;padding:12px 16px"><strong style="color:#065f46">✅ Answer:</strong> <span style="color:#1e293b">'+esc(d.answer||'')+'</span></div>';
      if (d.note) h += '<div style="margin-top:12px;font-size:13px;color:#94a3b8">💡 '+esc(d.note)+'</div>';
      return h+'</div></div>';
    }
  },
  // ── 24. steps ── numbered procedural steps
  'steps': {
    desc: 'Numbered procedure. title?, steps:[{title?, description, icon?}].',
    render: function(d) {
      var h = '<div style="margin:16px 0">';
      if (d.title) h += '<h3 style="color:#4f46e5;margin-bottom:16px;font-weight:700">📋 '+esc(d.title)+'</h3>';
      for (var i=0;i<(d.steps||[]).length;i++) {
        var s = d.steps[i];
        h += '<div style="display:flex;gap:14px;margin-bottom:16px;align-items:flex-start">';
        h += '<div style="flex-shrink:0;width:34px;height:34px;border-radius:50%;background:#4f46e5;color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700">'+(i+1)+'</div>';
        h += '<div><strong style="color:#1e293b">'+(s.icon?s.icon+' ':'')+esc(s.title||'Step '+(i+1))+'</strong>';
        if (s.description) h += '<p style="color:#64748b;margin:4px 0 0;font-size:14px">'+esc(s.description)+'</p>';
        h += '</div></div>';
      }
      return h+'</div>';
    }
  },
  // ── 25. summary-box ── TL;DR recap
  'summary-box': {
    desc: 'End-of-section recap. title?, points:[] (key takeaways), body?.',
    render: function(d) {
      var h = '<div style="background:linear-gradient(135deg,#fef3c7,#fff7ed);border:2px solid #fcd34d;border-radius:12px;padding:22px 24px;margin:24px 0">';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:22px">📝</span><strong style="color:#92400e;font-size:17px">'+esc(d.title||'Summary')+'</strong></div>';
      if (d.body) h += '<p style="color:#64748b;margin:0 0 12px">'+esc(d.body)+'</p>';
      if (d.points && d.points.length) {
        h += '<ul style="margin:0;padding-left:20px">';
        for (var i=0;i<d.points.length;i++) h += '<li style="color:#475569;margin-bottom:6px">'+esc(d.points[i])+'</li>';
        h += '</ul>';
      }
      return h+'</div>';
    }
  },
  // ── 26. video-embed ── YouTube/Vimeo iframe
  'video-embed': {
    desc: 'Embedded video. url (YouTube/Vimeo), title?, aspectRatio:16by9|4by3.',
    render: function(d) {
      var ratio = d.aspectRatio==='4by3'?'75%':'56.25%';
      var h = '<div style="margin:16px 0">';
      if (d.title) h += '<p style="font-weight:600;color:#1e293b;margin-bottom:8px">🎬 '+esc(d.title)+'</p>';
      h += '<div style="position:relative;padding-bottom:'+ratio+';height:0;overflow:hidden;border-radius:10px">';
      h += '<iframe src="'+esc(d.url)+'" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allowfullscreen loading="lazy"></iframe>';
      h += '</div></div>';
      return h;
    }
  },
  // ── 27. gallery ── image gallery grid
  'gallery': {
    desc: 'Image gallery. cols:2|3|4, images:[{url, caption?, alt?}].',
    render: function(d) {
      var cols = { '2':'1fr 1fr','3':'1fr 1fr 1fr','4':'1fr 1fr 1fr 1fr' };
      var h = '<div style="display:grid;grid-template-columns:'+(cols[d.cols]||cols['3'])+';gap:12px;margin:16px 0">';
      for (var i=0;i<(d.images||[]).length;i++) {
        var img = d.images[i];
        h += '<div style="border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;background:#fff">';
        h += '<img src="'+esc(img.url||img.src)+'" alt="'+esc(img.alt||'')+'" style="width:100%;height:180px;object-fit:cover;display:block" loading="lazy">';
        if (img.caption) h += '<div style="padding:8px 12px;font-size:12px;color:#64748b;text-align:center">'+esc(img.caption)+'</div>';
        h += '</div>';
      }
      return h+'</div>';
    }
  },
  // ── 28. highlight-box ── prominent emphasis box
  'highlight-box': {
    desc: 'Prominent emphasis box. variant:idea|important|discover|challenge. title?, body.',
    render: function(d) {
      var themes = {
        idea: ['💡','#eef2ff','#4f46e5','#818cf8'],
        important: ['⭐','#fef3c7','#92400e','#fcd34d'],
        discover: ['🔍','#f0fdf4','#065f46','#6ee7b7'],
        challenge: ['🎯','#fee2e2','#991b1b','#fca5a5']
      };
      var t = themes[d.variant]||themes.idea;
      return '<div style="background:'+t[1]+';border:2px solid '+t[3]+';border-radius:12px;padding:20px 22px;margin:18px 0">'+
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="font-size:24px">'+t[0]+'</span><strong style="color:'+t[2]+';font-size:16px">'+esc(d.title||'')+'</strong></div>'+
        '<p style="color:#475569;margin:0;font-size:15px">'+esc(d.body||d.text||'')+'</p></div>';
    }
  },
  // ── 29. resource-links ── external resource cards
  'resource-links': {
    desc: 'Resource link cards. title?, links:[{label, url, description?, type:video|article|book|tool|pdf}].',
    render: function(d) {
      var typeIcons = { video:'🎬', article:'📄', book:'📚', tool:'🔧', pdf:'📎' };
      var h = '<div style="margin:16px 0">';
      if (d.title) h += '<h3 style="color:#4f46e5;margin-bottom:12px;font-weight:700">📖 '+esc(d.title)+'</h3>';
      for (var i=0;i<(d.links||[]).length;i++) {
        var lnk = d.links[i];
        h += '<a href="'+esc(lnk.url)+'" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;text-decoration:none;margin-bottom:8px;background:#fff">';
        h += '<span style="font-size:22px">'+(typeIcons[lnk.type]||'🔗')+'</span>';
        h += '<div style="flex:1;min-width:0"><div style="font-weight:600;color:#1e293b">'+esc(lnk.label)+'</div>';
        if (lnk.description) h += '<div style="font-size:12px;color:#94a3b8;margin-top:2px">'+esc(lnk.description)+'</div></div>';
        h += '<span style="color:#818cf8;font-size:18px">↗</span></a>';
      }
      return h+'</div>';
    }
  },
  // ── 30. prerequisites ── before-you-begin box
  'prerequisites': {
    desc: 'Before-you-begin box. title?, body?, items:[].',
    render: function(d) {
      var h = '<div style="border:2px dashed #818cf8;border-radius:10px;padding:18px 22px;margin:16px 0;background:#fafbff">';
      h += '<div style="font-weight:700;color:#4f46e5;margin-bottom:10px">📋 '+esc(d.title||'Before You Begin')+'</div>';
      if (d.body) h += '<p style="color:#64748b;margin:0 0 10px;font-size:14px">'+esc(d.body)+'</p>';
      if (d.items && d.items.length) {
        h += '<ul style="margin:0;padding-left:20px">';
        for (var i=0;i<d.items.length;i++) h += '<li style="color:#475569;margin-bottom:4px">'+esc(typeof d.items[i]==='string'?d.items[i]:d.items[i].text||d.items[i])+'</li>';
        h += '</ul>';
      }
      return h+'</div>';
    }
  },
  // ── 31. checklist ── simple checkable list
  'checklist': {
    desc: 'Checkable list. title?, items:[{text, checked?}].',
    render: function(d) {
      var h = '<div style="margin:16px 0">';
      if (d.title) h += '<h3 style="color:#4f46e5;margin-bottom:10px;font-weight:700">✅ '+esc(d.title)+'</h3>';
      for (var i=0;i<(d.items||[]).length;i++) {
        var it = d.items[i];
        var chk = it.checked?' checked':'';
        var txt = typeof it==='string'?it:(it.text||'');
        h += '<div style="display:flex;align-items:flex-start;gap:10px;padding:6px 0"><input type="checkbox"'+chk+' style="margin-top:3px;accent-color:#4f46e5"><span style="color:#475569">'+esc(txt)+'</span></div>';
      }
      return h+'</div>';
    }
  },
  // ── 32. formula ── styled math/equation display
  'formula': {
    desc: 'Math/equation display. formula, caption?, variant:highlight|basic.',
    render: function(d) {
      var bg = d.variant==='highlight'?'background:linear-gradient(135deg,#eef2ff,#f0f4ff);border:1px solid #818cf8;':'background:#f8fafc;border:1px solid #e2e8f0;';
      var h = '<div style="'+bg+'border-radius:10px;padding:20px;margin:16px 0;text-align:center">';
      h += '<div style="font-family:Georgia,serif;font-size:20px;color:#1e293b;letter-spacing:1px">'+esc(d.formula||d.equation||'')+'</div>';
      if (d.caption) h += '<div style="font-size:12px;color:#94a3b8;margin-top:8px">'+esc(d.caption)+'</div>';
      return h+'</div>';
    }
  },
  // ── 33. flashcards-inline ── click-to-flip CSS cards (ENHANCED — rich visuals, categories, difficulty, mastered toggle)
  'flashcards-inline': {
    desc: 'Click-to-flip flashcards. cards:[{front, back, category?, difficulty?, type?, hint?, imageUrl?}], cols:2|3. Supports rich HTML.',
    render: function(d) {
      var cols = { '2':'1fr 1fr','3':'1fr 1fr 1fr' };
      var cards = d.cards||d.items||[];
      if (!cards.length) return '';
      var catColors = [
        { bg:'#eef2ff', border:'#818cf8', text:'#4f46e5', dot:'#4f46e5' },
        { bg:'#ecfdf5', border:'#6ee7b7', text:'#059669', dot:'#059669' },
        { bg:'#fef3c7', border:'#fcd34d', text:'#d97706', dot:'#d97706' },
        { bg:'#fce7f3', border:'#f9a8d4', text:'#db2777', dot:'#db2777' },
        { bg:'#f0fdf4', border:'#86efac', text:'#16a34a', dot:'#16a34a' },
        { bg:'#fef2f2', border:'#fca5a5', text:'#dc2626', dot:'#dc2626' },
        { bg:'#f5f3ff', border:'#c4b5fd', text:'#7c3aed', dot:'#7c3aed' },
        { bg:'#ecfeff', border:'#67e8f9', text:'#0891b2', dot:'#0891b2' }
      ];
      var diffBadges = { easy:'🟢 Easy', medium:'🟡 Medium', hard:'🔴 Hard' };
      var diffDots = { easy:'#059669', medium:'#d97706', hard:'#dc2626' };
      var typeIcons = { term:'📖', question:'❓', code:'💻', image:'🖼️', concept:'💡' };
      var typeLabels = { term:'TERM', question:'QUESTION', code:'CODE', image:'VISUAL', concept:'CONCEPT' };
      var uniqueId = Date.now();
      var h = '<div class="enhanced-fc-section" style="margin:20px 0">';
      h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">';
      h += '<span style="font-weight:700;color:#1e293b;font-size:15px">🃏 '+esc(d.title||'Flashcards')+'</span>';
      h += '<span style="font-size:12px;color:#94a3b8;background:#f1f5f9;padding:4px 12px;border-radius:20px;font-weight:600">'+cards.length+' card'+(cards.length!==1?'s':'')+'</span>';
      h += '</div>';
      var cats = {};
      for (var ci=0;ci<cards.length;ci++) { var cat=cards[ci].category||''; if(cat) cats[cat]=(cats[cat]||0)+1; }
      var catKeys = Object.keys(cats);
      if (catKeys.length>0) {
        h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">';
        h += '<span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;background:#4f46e5;color:#fff">📋 All ('+cards.length+')</span>';
        for (var ck=0;ck<catKeys.length;ck++) {
          var cc = catColors[ck%catColors.length];
          h += '<span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;background:'+cc.bg+';color:'+cc.text+';border:1px solid '+cc.border+'">'+esc(catKeys[ck])+' ('+cats[catKeys[ck]]+')</span>';
        }
        h += '</div>';
      }
      h += '<div style="display:grid;grid-template-columns:'+(cols[d.cols]||cols['2'])+';gap:16px">';
      for (var i=0;i<cards.length;i++) {
        var cid = 'efc-'+uniqueId+'-'+i;
        var card = cards[i];
        var diff = card.difficulty||'medium';
        var type = card.type||'term';
        var catIdx = card.category?catKeys.indexOf(card.category):-1;
        var cc2 = catColors[catIdx>=0?catIdx%catColors.length:i%catColors.length];
        var accentColor = diffDots[diff]||cc2.dot;
        var icon = typeIcons[type]||'📖';
        var typeLabel = typeLabels[type]||'TERM';
        var frontContent = card.front||card.q||card.term||'';
        var backContent = card.back||card.a||card.definition||'';
        var isRich = /<[a-z][\s\S]*>/i.test(frontContent+backContent);
        h += '<div style="perspective:800px">';
        var mid = 'efc-mastered-'+uniqueId+'-'+i;
        h += '<input type="checkbox" class="efc-mastered-check" id="'+mid+'" style="position:absolute;opacity:0;pointer-events:none">';
        h += '<input type="checkbox" class="efc-flip-check" id="'+cid+'" style="position:absolute;opacity:0;pointer-events:none">';
        h += '<label class="efc-card-label" for="'+cid+'" style="display:block;cursor:pointer">';
        h += '<div class="efc-card-inner" style="position:relative;width:100%;min-height:220px;transition:transform 0.6s cubic-bezier(0.4,0,0.2,1);transform-style:preserve-3d">';
        h += '<div class="efc-front" style="position:absolute;inset:0;backface-visibility:hidden;background:linear-gradient(145deg,'+cc2.bg+',#fff);border:2px solid '+accentColor+'33;border-radius:14px;padding:20px;display:flex;flex-direction:column;box-shadow:0 2px 8px rgba(0,0,0,0.04)">';
        h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;flex-wrap:wrap">';
        h += '<span style="display:inline-flex;align-items:center;gap:3px;background:'+accentColor+';color:#fff;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:700;letter-spacing:0.3px">'+icon+' '+typeLabel+'</span>';
        if (card.category) h += '<span style="display:inline-flex;align-items:center;gap:3px;background:'+cc2.bg+';color:'+cc2.text+';border:1px solid '+cc2.border+';padding:2px 10px;border-radius:12px;font-size:10px;font-weight:600">'+esc(card.category)+'</span>';
        h += '<span style="margin-left:auto;font-size:10px;color:#94a3b8;font-weight:600">'+(i+1)+'/'+cards.length+'</span>';
        h += '</div>';
        h += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:10px"><span style="width:8px;height:8px;border-radius:50%;background:'+accentColor+';display:inline-block"></span><span style="font-size:10px;color:'+accentColor+';font-weight:600">'+esc(diffBadges[diff]||diff)+'</span></div>';
        if (card.imageUrl) h += '<div style="margin-bottom:10px;text-align:center"><img src="'+esc(card.imageUrl)+'" style="max-width:100%;max-height:80px;border-radius:8px;object-fit:contain" alt=""></div>';
        h += '<div class="efc-content" style="flex:1;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;padding:6px 2px;text-align:center;font-weight:700;color:#1e293b;font-size:15px;line-height:1.5;min-height:0">';
        h += isRich?frontContent:('<p style="margin:auto 0">'+esc(frontContent)+'</p>');
        h += '</div>';
        if (card.hint) h += '<div style="text-align:center;margin-top:8px;font-size:11px;color:#94a3b8;font-style:italic">💭 '+esc(card.hint)+'</div>';
        h += '<div style="text-align:center;margin-top:10px;font-size:10px;color:#94a3b8;opacity:0.7">👆 Click to flip</div>';
        h += '</div>';
        h += '<div class="efc-back" style="position:absolute;inset:0;backface-visibility:hidden;background:linear-gradient(145deg,#ecfdf5,#f0fdf4);border:2px solid #05966933;border-radius:14px;padding:20px;display:flex;flex-direction:column;box-shadow:0 2px 8px rgba(0,0,0,0.04);transform:rotateY(180deg)">';
        h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:12px">';
        h += '<span style="display:inline-flex;align-items:center;gap:3px;background:#059669;color:#fff;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:700">💡 ANSWER</span>';
        h += '<span style="margin-left:auto;font-size:10px;color:#94a3b8;font-weight:600">'+(i+1)+'/'+cards.length+'</span>';
        h += '</div>';
        h += '<div class="efc-content" style="flex:1;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;padding:6px 2px;text-align:center;font-weight:600;color:#065f46;font-size:14px;line-height:1.6;min-height:0">';
        h += isRich?backContent:('<p style="margin:auto 0">'+esc(backContent)+'</p>');
        h += '</div>';
        h += '<div style="text-align:center;margin-top:10px">';
        h += '<label for="'+mid+'" style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:14px;font-size:10px;font-weight:600;cursor:pointer;background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;transition:all 0.2s">⬜ Mark mastered</label>';
        h += '</div>';
        h += '<div style="text-align:center;margin-top:6px;font-size:10px;color:#94a3b8;opacity:0.7">👆 Click to flip back</div>';
        h += '</div>';
        h += '</div></label>';
        h += '<style>';
        h += '#'+cid+':checked+.efc-card-label .efc-card-inner{transform:rotateY(180deg)}';
        h += '#'+mid+':checked~.efc-card-label .efc-front,';
        h += '#'+mid+':checked~.efc-card-label .efc-back{opacity:0.5;filter:grayscale(35%)}';
        h += '.efc-card-label:hover .efc-front,.efc-card-label:hover .efc-back{box-shadow:0 6px 20px rgba(79,70,229,0.12)}';
        h += '.efc-mastered-check:checked+label .efc-card-label .efc-mastered-btn,';
        h += '.efc-mastered-check:checked~.efc-card-label .efc-mastered-btn{background:#d1fae5!important;color:#059669!important;border-color:#6ee7b7!important}';
        h += '</style>';
        h += '</div>';
      }
      h += '</div>';
      h += '<div style="text-align:center;padding:12px;color:#94a3b8;font-size:12px;margin-top:8px">🃏 Click cards to flip · Mark mastered when you know them cold</div>';
      return h+'</div>';
    }
  },
  // ── 34. code-block ── syntax-highlighted code
  'code-block': {
    desc: 'Code block with language label. code, language?, filename?, highlightLines?',
    render: function(d) {
      var h = '<div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:16px 0">';
      h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:#1e293b;color:#e2e8f0;font-size:12px">';
      h += '<span>'+esc(d.language||d.filename||'Code')+'</span>';
      if (d.filename) h += '<span style="color:#94a3b8">'+esc(d.filename)+'</span>';
      h += '</div>';
      h += '<pre style="margin:0;padding:16px 18px;background:#0f172a;color:#e2e8f0;font-family:\'Fira Code\',\'Cascadia Code\',\'Consolas\',monospace;font-size:13px;line-height:1.6;overflow-x:auto"><code>'+esc(d.code||d.text||'')+'</code></pre>';
      return h+'</div>';
    }
  },
  // ── 35. reflection-prompt ── pause-and-think box
  'reflection-prompt': {
    desc: 'Pause-and-reflect prompt. title?, questions:[], icon? (🤔).',
    render: function(d) {
      var h = '<div style="border:2px dashed #fbbf24;border-radius:12px;padding:20px 22px;margin:16px 0;background:linear-gradient(135deg,#fffbeb,#fef3c7)">';
      h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span style="font-size:26px">'+(d.icon||'🤔')+'</span><strong style="color:#92400e;font-size:16px">'+esc(d.title||'Pause & Reflect')+'</strong></div>';
      if (d.questions && d.questions.length) {
        h += '<ol style="margin:0;padding-left:20px">';
        for (var i=0;i<d.questions.length;i++) h += '<li style="color:#475569;margin-bottom:8px;font-weight:500">'+esc(typeof d.questions[i]==='string'?d.questions[i]:d.questions[i].text||d.questions[i])+'</li>';
        h += '</ol>';
      }
      if (d.body) h += '<p style="color:#78716c;margin:10px 0 0;font-size:13px">'+esc(d.body)+'</p>';
      return h+'</div>';
    }
  },
  // ── 36. self-assessment ── 1-5 understanding scale
  'self-assessment': {
    desc: 'Understanding self-check. question?, labels?:[low,high].',
    render: function(d) {
      var qid = 'sa-'+Date.now();
      var h = '<div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:16px 0;background:#fff">';
      h += '<div style="font-weight:700;color:#1e293b;margin-bottom:14px">📊 '+esc(d.question||'How well do you understand this topic?')+'</div>';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">';
      for (var i=1;i<=5;i++) {
        h += '<label style="cursor:pointer;text-align:center;flex:1">';
        h += '<input type="radio" name="'+qid+'" value="'+i+'" style="display:none" class="sa-radio">';
        h += '<div class="sa-star" style="font-size:28px;filter:grayscale(100%);opacity:0.4;transition:all 0.2s">⭐</div>';
        h += '<div style="font-size:10px;color:#94a3b8;margin-top:4px">'+i+'</div></label>';
      }
      h += '</div>';
      h += '<div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-top:4px"><span>'+esc(d.lowLabel||'Not yet')+'</span><span>'+esc(d.highLabel||'Got it!')+'</span></div>';
      return h+'</div>';
    }
  },
  // ── 37. common-mistake ── pitfall warning box
  'common-mistake': {
    desc: 'Common pitfall warning. title?, mistake, correct?, explanation?.',
    render: function(d) {
      var h = '<div style="border-left:4px solid #dc2626;background:linear-gradient(135deg,#fef2f2,#fee2e2);padding:16px 20px;margin:16px 0;border-radius:0 10px 10px 0">';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:20px">⚠️</span><strong style="color:#991b1b">'+esc(d.title||'Common Mistake')+'</strong></div>';
      h += '<p style="color:#475569;margin:0 0 8px"><strong>❌ Wrong:</strong> '+esc(d.mistake||'')+'</p>';
      if (d.correct) h += '<p style="color:#065f46;margin:0 0 8px"><strong>✅ Correct:</strong> '+esc(d.correct)+'</p>';
      if (d.explanation) h += '<p style="color:#475569;margin:0;font-size:13px">💡 '+esc(d.explanation)+'</p>';
      return h+'</div>';
    }
  },
  // ── 38. exam-hint ── exam focus tip box
  'exam-hint': {
    desc: 'Exam-focused tip. title?, tips:[], body?.',
    render: function(d) {
      var h = '<div style="border:2px solid #7c3aed;background:linear-gradient(135deg,#f5f3ff,#ede9fe);border-radius:10px;padding:18px 20px;margin:16px 0">';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="font-size:20px">🎯</span><strong style="color:#6d28d9">'+esc(d.title||'Exam Focus')+'</strong></div>';
      if (d.body) h += '<p style="color:#475569;margin:0 0 10px;font-size:14px">'+esc(d.body)+'</p>';
      if (d.tips && d.tips.length) {
        h += '<ul style="margin:0;padding-left:18px">';
        for (var i=0;i<d.tips.length;i++) h += '<li style="color:#475569;margin-bottom:4px">'+esc(d.tips[i])+'</li>';
        h += '</ul>';
      }
      return h+'</div>';
    }
  },
  // ── 39. real-world ── real-world application box
  'real-world': {
    desc: 'Real-world application. title?, example, body?, icon? (🌍).',
    render: function(d) {
      var h = '<div style="border:2px solid #059669;background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:10px;padding:18px 20px;margin:16px 0">';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:20px">'+(d.icon||'🌍')+'</span><strong style="color:#065f46">'+esc(d.title||'Real-World Application')+'</strong></div>';
      h += '<p style="color:#475569;margin:0 0 8px;font-weight:500">'+esc(d.example||d.body||'')+'</p>';
      if (d.body && d.example) h += '<p style="color:#475569;margin:0;font-size:13px">'+esc(d.body)+'</p>';
      return h+'</div>';
    }
  },
  // ── 40. study-tip ── learning strategy box
  'study-tip': {
    desc: 'Learning strategy tip. title?, tip, method?.',
    render: function(d) {
      var h = '<div style="border:2px solid #f59e0b;background:linear-gradient(135deg,#fffbeb,#fef3c7);border-radius:10px;padding:18px 20px;margin:16px 0">';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:20px">📚</span><strong style="color:#92400e">'+esc(d.title||'Study Smart')+'</strong></div>';
      h += '<p style="color:#475569;margin:0">'+esc(d.tip||d.body||'')+'</p>';
      if (d.method) h += '<div style="margin-top:10px;padding:10px 14px;background:#fff;border-radius:6px;font-size:13px"><strong style="color:#4f46e5">🧠 '+esc(d.method)+'</strong></div>';
      return h+'</div>';
    }
  },
  // ── 41. swot ── 2×2 SWOT analysis grid
  'swot': {
    desc: 'SWOT analysis 2×2 grid. strengths:[], weaknesses:[], opportunities:[], threats:[].',
    render: function(d) {
      var cells = [
        { title:'💪 Strengths', items:d.strengths||[], bg:'#ecfdf5', border:'#6ee7b7', color:'#065f46' },
        { title:'⚠️ Weaknesses', items:d.weaknesses||[], bg:'#fef2f2', border:'#fca5a5', color:'#991b1b' },
        { title:'🚀 Opportunities', items:d.opportunities||[], bg:'#eef2ff', border:'#818cf8', color:'#3730a3' },
        { title:'🔥 Threats', items:d.threats||[], bg:'#fef3c7', border:'#fcd34d', color:'#92400e' }
      ];
      var h = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;margin:16px 0;border-radius:12px;overflow:hidden;border:2px solid #e2e8f0">';
      for (var c=0;c<4;c++) {
        var cell = cells[c];
        h += '<div style="background:'+cell.bg+';padding:16px 18px">';
        h += '<strong style="color:'+cell.color+';font-size:14px">'+cell.title+'</strong>';
        if (cell.items.length) {
          h += '<ul style="margin:8px 0 0 16px;font-size:13px">';
          for (var i=0;i<cell.items.length;i++) h += '<li style="color:'+cell.color+';margin-bottom:3px">'+esc(cell.items[i])+'</li>';
          h += '</ul>';
        }
        h += '</div>';
      }
      return h+'</div>';
    }
  },
  // ── 42. pyramid ── hierarchy triangle
  'pyramid': {
    desc: 'Hierarchy pyramid. levels:[{label, description?, color?}] (bottom to top).',
    render: function(d) {
      var colors = ['#3b82f6','#4f46e5','#7c3aed','#a855f7','#d946ef'];
      var levels = d.levels||[];
      if (!levels.length) return '';
      var h = '<div style="margin:24px auto;max-width:500px">';
      for (var i=levels.length-1;i>=0;i--) {
        var lvl = levels[i];
        var width = 50 + ((i+1)/levels.length)*50; // 50% to 100%
        var bg = lvl.color||colors[i%colors.length];
        h += '<div style="margin:0 auto;width:'+width+'%;background:'+bg+';color:#fff;text-align:center;padding:12px 10px;border-radius:6px;margin-bottom:4px;font-weight:600;font-size:14px;box-shadow:0 2px 4px rgba(0,0,0,0.1)">';
        h += esc(lvl.label||'');
        if (lvl.description) h += '<div style="font-size:11px;opacity:0.85;font-weight:400;margin-top:2px">'+esc(lvl.description)+'</div>';
        h += '</div>';
      }
      return h+'</div>';
    }
  },
  // ── 43. next-steps ── where-to-go-from-here
  'next-steps': {
    desc: 'Post-lesson guidance. title?, steps:[{label, description?, type:next|review|practice|explore}].',
    render: function(d) {
      var typeIcons = { next:'➡️', review:'🔄', practice:'✏️', explore:'🔍' };
      var h = '<div style="border:2px solid #4f46e5;border-radius:12px;overflow:hidden;margin:20px 0">';
      h += '<div style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:14px 20px;color:#fff;font-weight:700;font-size:16px">🚀 '+esc(d.title||'Next Steps')+'</div>';
      h += '<div style="padding:16px 20px;background:#fff">';
      for (var i=0;i<(d.steps||[]).length;i++) {
        var s = d.steps[i];
        h += '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9">';
        h += '<span style="font-size:22px">'+(typeIcons[s.type]||'➡️')+'</span>';
        h += '<div><strong style="color:#1e293b">'+esc(s.label||'')+'</strong>';
        if (s.description) h += '<div style="font-size:12px;color:#64748b;margin-top:2px">'+esc(s.description)+'</div></div>';
        h += '</div>';
      }
      return h+'</div></div>';
    }
  },
  // ── 44. fill-blank ── fill-in-the-blank with answer reveal
  'fill-blank': {
    desc: 'Fill-in-the-blank with reveal. items:[{prompt, answer, hint?}].',
    render: function(d) {
      var h = '<div style="margin:16px 0">';
      for (var i=0;i<(d.items||[]).length;i++) {
        var it = d.items[i];
        var fid = 'fb-'+Date.now()+'-'+i;
        h += '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;margin-bottom:10px;background:#fff">';
        h += '<p style="color:#1e293b;margin:0 0 8px">'+(i+1)+'. '+esc(it.prompt||it.text||'')+'</p>';
        h += '<input type="text" style="border:none;border-bottom:2px dashed #4f46e5;padding:4px 8px;font-size:14px;color:#1e293b;min-width:200px;outline:none;background:transparent;font-family:inherit" placeholder="type your answer...">';
        h += '<details style="display:inline-block;margin-left:8px"><summary style="cursor:pointer;color:#4f46e5;font-weight:600;font-size:13px;display:inline;list-style:none">👁️ Reveal</summary>';
        h += '<span style="color:#059669;font-weight:700;font-size:15px;margin-left:6px">'+esc(it.answer||'')+'</span>';
        if (it.hint) h += '<span style="color:#94a3b8;font-size:12px;margin-left:6px">('+esc(it.hint)+')</span>';
        h += '</details></div>';
      }
      return h+'</div>';
    }
  },
  // ── 45. difficulty-meter ── difficulty badge indicator
  'difficulty-meter': {
    desc: 'Difficulty badge. level:beginner|intermediate|advanced|expert, label?.',
    render: function(d) {
      var levels = {
        beginner: ['🟢','Beginner','#059669','#d1fae5'],
        intermediate: ['🟡','Intermediate','#d97706','#fef3c7'],
        advanced: ['🔴','Advanced','#dc2626','#fee2e2'],
        expert: ['🟣','Expert','#7c3aed','#ede9fe']
      };
      var l = levels[d.level]||levels.beginner;
      return '<div style="display:inline-flex;align-items:center;gap:8px;background:'+l[3]+';border:1px solid '+l[2]+';border-radius:20px;padding:6px 16px;margin:8px 0">'+
        '<span style="font-size:14px">'+l[0]+'</span><span style="font-weight:700;color:'+l[2]+';font-size:13px">'+esc(d.label||l[1])+'</span></div>';
    }
  },
  // ── 46. columns-2 ── two-column layout container
  'columns-2': {
    desc: 'Two-column container. left (HTML), right (HTML), leftWidth? (e.g. 60%), rightWidth?.',
    render: function(d) {
      var lw = d.leftWidth||'1fr';
      var rw = d.rightWidth||'1fr';
      var h = '<div style="display:grid;grid-template-columns:'+lw+' '+rw+';gap:20px;margin:16px 0">';
      h += '<div>'+(d.left||'')+'</div>';
      h += '<div>'+(d.right||'')+'</div>';
      return h+'</div>';
    }
  },
  // ── 47. did-you-know ── fun fact box (all ages)
  'did-you-know': {
    desc: 'Fun fact box. fact, icon? (🦋 for kids, 💡 for general), source?.',
    render: function(d) {
      return '<div style="border:2px solid #fbbf24;background:linear-gradient(135deg,#fffbeb,#fef9e7);border-radius:12px;padding:16px 20px;margin:16px 0">'+
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:22px">'+(d.icon||'💡')+'</span><strong style="color:#92400e;font-size:15px">'+esc(d.title||'Did You Know?')+'</strong></div>'+
        '<p style="color:#475569;margin:0;font-size:15px;line-height:1.7">'+esc(d.fact||d.body||'')+'</p>'+
        (d.source?'<div style="font-size:11px;color:#a8a29e;margin-top:6px">📖 '+esc(d.source)+'</div>':'')+
        '</div>';
    }
  },
  // ── 48. story-box ── narrative storytelling container
  'story-box': {
    desc: 'Story/narrative box. title?, story, moral?, character? (for kids: character name).',
    render: function(d) {
      var h = '<div style="border:2px solid #c084fc;background:linear-gradient(135deg,#faf5ff,#f3e8ff);border-radius:12px;overflow:hidden;margin:16px 0">';
      h += '<div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:10px 20px;color:#fff;font-weight:700;font-size:14px">📖 '+esc(d.title||'Story Time')+(d.character?' — with '+esc(d.character):'')+'</div>';
      h += '<div style="padding:18px 20px">';
      h += '<p style="color:#475569;margin:0;line-height:1.8;font-size:15px">'+esc(d.story||d.body||'')+'</p>';
      if (d.moral) h += '<div style="margin-top:14px;padding:10px 14px;background:#fff;border-radius:8px;border:1px solid #c084fc"><strong style="color:#7c3aed">🌟 Moral:</strong> <span style="color:#475569">'+esc(d.moral)+'</span></div>';
      return h+'</div></div>';
    }
  },
  // ── 49. tip-jar ── collection of quick tips
  'tip-jar': {
    desc: 'Collection of quick tips. title?, tips:[], icon? (🫙).',
    render: function(d) {
      var h = '<div style="border:2px solid #fbbf24;background:linear-gradient(135deg,#fffbeb,#fefce8);border-radius:12px;padding:18px 20px;margin:16px 0">';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:24px">'+(d.icon||'🫙')+'</span><strong style="color:#92400e;font-size:16px">'+esc(d.title||'Quick Tips')+'</strong></div>';
      for (var i=0;i<(d.tips||[]).length;i++) {
        var tip = d.tips[i];
        h += '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #fde68a">';
        h += '<span style="color:#f59e0b;font-weight:700;flex-shrink:0">'+(i+1)+'.</span>';
        h += '<span style="color:#475569">'+esc(typeof tip==='string'?tip:tip.text||tip)+'</span></div>';
      }
      return h+'</div>';
    }
  },
  // ── 50. try-it ── hands-on activity prompt
  'try-it': {
    desc: 'Try-it-yourself activity. title?, instruction, hint?, timeEstimate?.',
    render: function(d) {
      var h = '<div style="border:2px dashed #06b6d4;background:linear-gradient(135deg,#ecfeff,#cffafe);border-radius:12px;padding:20px;margin:16px 0">';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="font-size:24px">🧪</span><strong style="color:#0e7490;font-size:16px">'+esc(d.title||'Try It Yourself')+'</strong>';
      if (d.timeEstimate) h += '<span style="font-size:11px;color:#0891b2;margin-left:auto">⏱️ ~'+esc(d.timeEstimate)+'</span>';
      h += '</div>';
      h += '<p style="color:#155e75;margin:0;font-size:15px;line-height:1.7">'+esc(d.instruction||d.body||'')+'</p>';
      if (d.hint) h += '<details style="margin-top:12px"><summary style="cursor:pointer;color:#0891b2;font-weight:600;font-size:13px">💡 Need a hint?</summary><p style="color:#475569;margin:8px 0 0;font-size:14px">'+esc(d.hint)+'</p></details>';
      return h+'</div>';
    }
  },
  // ── 51. analogy ── "Think of it like..." bridge concept
  'analogy': {
    desc: 'Analogy bridge. concept, analogy, explanation?, icon? (🌉).',
    render: function(d) {
      return '<div style="border:2px solid #a78bfa;background:linear-gradient(135deg,#f5f3ff,#ede9fe);border-radius:12px;padding:20px;margin:16px 0;text-align:center">'+
        '<div style="font-size:28px;margin-bottom:8px">'+(d.icon||'🌉')+'</div>'+
        '<div style="font-weight:700;color:#6d28d9;font-size:16px;margin-bottom:10px">Think of it like this...</div>'+
        '<div style="display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">'+
        '<span style="background:#fff;border:2px solid #7c3aed;border-radius:8px;padding:8px 16px;font-weight:700;color:#5b21b6">'+esc(d.concept||'')+'</span>'+
        '<span style="font-size:20px;color:#a78bfa">≣</span>'+
        '<span style="background:#fef3c7;border:2px solid #fcd34d;border-radius:8px;padding:8px 16px;font-weight:700;color:#92400e">'+esc(d.analogy||'')+'</span>'+
        '</div>'+
        (d.explanation?'<p style="color:#64748b;margin:0;font-size:14px">'+esc(d.explanation)+'</p>':'')+
        '</div>';
    }
  },
  // ── 52. before-after ── side-by-side transformation
  'before-after': {
    desc: 'Before/after transformation. beforeTitle?, beforeBody, afterTitle?, afterBody.',
    render: function(d) {
      var h = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0">';
      h += '<div style="background:#fef2f2;border:2px solid #fca5a5;border-radius:10px;padding:16px">';
      h += '<div style="font-weight:700;color:#991b1b;margin-bottom:8px">❌ '+esc(d.beforeTitle||'Before')+'</div>';
      h += '<p style="color:#475569;margin:0;font-size:14px">'+esc(d.beforeBody||d.before||'')+'</p></div>';
      h += '<div style="background:#ecfdf5;border:2px solid #6ee7b7;border-radius:10px;padding:16px">';
      h += '<div style="font-weight:700;color:#065f46;margin-bottom:8px">✅ '+esc(d.afterTitle||'After')+'</div>';
      h += '<p style="color:#475569;margin:0;font-size:14px">'+esc(d.afterBody||d.after||'')+'</p></div>';
      return h+'</div>';
    }
  },
  // ── 53. progress-tracker ── visual completion bar
  'progress-tracker': {
    desc: 'Progress bar. percent (0-100), label?, steps?:[{label, done?}], color? (#4f46e5).',
    render: function(d) {
      var pct = Math.min(100,Math.max(0,parseInt(d.percent)||0));
      var color = d.color||'#4f46e5';
      var h = '<div style="margin:16px 0">';
      if (d.label) h += '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-weight:600;color:#1e293b;font-size:14px">'+esc(d.label)+'</span><span style="color:'+color+';font-weight:700;font-size:14px">'+pct+'%</span></div>';
      h += '<div style="width:100%;height:12px;background:#e2e8f0;border-radius:6px;overflow:hidden">';
      h += '<div style="width:'+pct+'%;height:100%;background:'+color+';border-radius:6px;transition:width 0.6s ease"></div></div>';
      if (d.steps && d.steps.length) {
        h += '<div style="display:flex;justify-content:space-between;margin-top:8px">';
        for (var i=0;i<d.steps.length;i++) {
          var s = d.steps[i];
          var done = s.done?'✅':'⬜';
          h += '<span style="font-size:11px;color:'+(s.done?'#059669':'#94a3b8')+'">'+done+' '+esc(s.label||'')+'</span>';
        }
        h += '</div>';
      }
      return h+'</div>';
    }
  },
  // ── 54. star-award ── achievement badge
  'star-award': {
    desc: 'Achievement badge. title, subtitle?, stars?:1-5, icon? (🏆).',
    render: function(d) {
      var stars = Math.min(5,Math.max(1,parseInt(d.stars)||3));
      var h = '<div style="display:inline-block;background:linear-gradient(135deg,#fef3c7,#fff7ed);border:2px solid #fcd34d;border-radius:16px;padding:16px 24px;margin:12px 0;text-align:center;min-width:160px">';
      h += '<div style="font-size:32px;margin-bottom:6px">'+(d.icon||'🏆')+'</div>';
      h += '<div style="font-weight:800;color:#92400e;font-size:16px">'+esc(d.title||'Achievement Unlocked')+'</div>';
      if (d.subtitle) h += '<div style="color:#b45309;font-size:13px;margin-top:4px">'+esc(d.subtitle)+'</div>';
      h += '<div style="margin-top:8px;font-size:24px;letter-spacing:2px">';
      for (var i=0;i<5;i++) h += i<stars?'⭐':'☆';
      return h+'</div></div>';
    }
  },
  // ── 55. word-bank ── vocabulary tag pills
  'word-bank': {
    desc: 'Key vocabulary as colorful pills. title?, words:[{word, hint?}], color? (#4f46e5).',
    render: function(d) {
      var color = d.color||'#4f46e5';
      var h = '<div style="margin:16px 0">';
      if (d.title) h += '<h3 style="color:'+color+';margin-bottom:10px;font-weight:700">📝 '+esc(d.title||'Word Bank')+'</h3>';
      h += '<div style="display:flex;flex-wrap:wrap;gap:8px">';
      for (var i=0;i<(d.words||[]).length;i++) {
        var w = d.words[i];
        var word = typeof w==='string'?w:(w.word||'');
        h += '<span style="display:inline-flex;align-items:center;gap:4px;background:#eef2ff;color:'+color+';border:1px solid '+color+';border-radius:20px;padding:5px 14px;font-size:13px;font-weight:600">'+esc(word);
        if (w.hint) h += '<span style="font-size:10px;opacity:0.6">('+esc(w.hint)+')</span>';
        h += '</span>';
      }
      return h+'</div></div>';
    }
  },
  // ── 56. concept-map ── simple mind map
  'concept-map': {
    desc: 'Concept mind map. central, nodes:[{label, description?, icon?}], color?.',
    render: function(d) {
      var color = d.color||'#4f46e5';
      var h = '<div style="margin:24px 0;text-align:center">';
      // Central node
      h += '<div style="display:inline-block;background:'+color+';color:#fff;padding:14px 22px;border-radius:12px;font-weight:700;font-size:16px;margin-bottom:16px;box-shadow:0 4px 12px rgba(79,70,229,0.3)">'+esc(d.central||d.topic||'')+'</div>';
      // Connector lines + nodes
      h += '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px;position:relative">';
      for (var i=0;i<(d.nodes||[]).length;i++) {
        var n = d.nodes[i];
        h += '<div style="background:#fff;border:2px solid '+color+';border-radius:10px;padding:12px 16px;text-align:center;min-width:100px;position:relative">';
        if (n.icon) h += '<div style="font-size:22px;margin-bottom:4px">'+esc(n.icon)+'</div>';
        h += '<div style="font-weight:600;color:#1e293b;font-size:13px">'+esc(n.label||'')+'</div>';
        if (n.description) h += '<div style="font-size:11px;color:#94a3b8;margin-top:2px">'+esc(n.description)+'</div>';
        h += '</div>';
      }
      return h+'</div></div>';
    }
  },
  // ── 57. perspectives ── two viewpoints side-by-side (for solo reflection, NOT classroom debate)
  'perspectives': {
    desc: 'Two perspectives for student consideration. topic, viewA:{label,points:[]}, viewB:{label,points:[]}. Accepts positionA/positionB for compat.',
    render: function(d) {
      var h = '<div style="border:2px solid #e2e8f0;border-radius:12px;overflow:hidden;margin:16px 0">';
      h += '<div style="background:#f1f5f9;padding:12px 20px;font-weight:700;color:#1e293b;text-align:center">🔍 '+esc(d.topic||'Two Perspectives')+'</div>';
      h += '<div style="padding:8px 12px;color:#94a3b8;font-size:11px;text-align:center">Consider both before forming your own conclusion</div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr">';
      // View A
      h += '<div style="padding:16px;border-right:1px solid #e2e8f0">';
      h += '<div style="font-weight:700;color:#4f46e5;margin-bottom:10px">🔵 '+esc((d.viewA||d.positionA||{}).label||'View A')+'</div>';
      var ptsA = (d.viewA||d.positionA||{}).points||[];
      for (var a=0;a<ptsA.length;a++) h += '<div style="display:flex;gap:8px;margin-bottom:6px;font-size:14px"><span style="color:#4f46e5;font-weight:700">'+ (a+1)+'.</span><span style="color:#475569">'+esc(ptsA[a])+'</span></div>';
      h += '</div>';
      // View B
      h += '<div style="padding:16px">';
      h += '<div style="font-weight:700;color:#d97706;margin-bottom:10px">🟠 '+esc((d.viewB||d.positionB||{}).label||'View B')+'</div>';
      var ptsB = (d.viewB||d.positionB||{}).points||[];
      for (var b=0;b<ptsB.length;b++) h += '<div style="display:flex;gap:8px;margin-bottom:6px;font-size:14px"><span style="color:#d97706;font-weight:700">'+ (b+1)+'.</span><span style="color:#475569">'+esc(ptsB[b])+'</span></div>';
      h += '</div>';
      return h+'</div></div>';
    }
  },
  // ── 58. character-guide ── mascot/character speech bubble
  'character-guide': {
    desc: 'Character/mascot speaking. character, emoji? (🦊), message, variant:kid|teacher|expert|coach.',
    render: function(d) {
      var themes = {
        kid: ['🦊','#fef3c7','#92400e'],
        teacher: ['👩‍🏫','#eef2ff','#3730a3'],
        expert: ['🧑‍🔬','#f0fdf4','#065f46'],
        coach: ['💪','#fee2e2','#991b1b']
      };
      var t = themes[d.variant]||themes.teacher;
      var h = '<div style="display:flex;gap:14px;align-items:flex-start;margin:16px 0;padding:16px 20px;background:'+t[1]+';border-radius:14px;border:2px solid '+t[2]+'">';
      h += '<div style="font-size:40px;flex-shrink:0;line-height:1">'+(d.emoji||t[0])+'</div>';
      h += '<div>';
      h += '<div style="font-weight:700;color:'+t[2]+';margin-bottom:4px">'+esc(d.character||'Guide')+' says...</div>';
      h += '<p style="color:#475569;margin:0;font-size:15px;line-height:1.7">'+esc(d.message||d.body||'')+'</p>';
      h += '</div></div>';
      return h;
    }
  },
  // ── 59. vocab-card ── rich vocabulary card
  'vocab-card': {
    desc: 'Rich vocabulary card. word, definition, example?, partOfSpeech?, pronunciation?, color?.',
    render: function(d) {
      var color = d.color||'#4f46e5';
      var h = '<div style="border:2px solid '+color+';border-radius:12px;overflow:hidden;margin:12px 0;background:#fff;max-width:500px">';
      h += '<div style="background:'+color+';padding:12px 18px;display:flex;align-items:center;gap:10px">';
      h += '<span style="color:#fff;font-weight:800;font-size:18px">'+esc(d.word||'')+'</span>';
      if (d.pronunciation) h += '<span style="color:rgba(255,255,255,0.7);font-size:13px">/'+esc(d.pronunciation)+'/</span>';
      if (d.partOfSpeech) h += '<span style="margin-left:auto;background:rgba(255,255,255,0.2);color:#fff;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:600">'+esc(d.partOfSpeech)+'</span>';
      h += '</div>';
      h += '<div style="padding:16px 18px">';
      h += '<p style="color:#475569;margin:0 0 10px;font-size:14px"><strong style="color:#1e293b">Definition:</strong> '+esc(d.definition||'')+'</p>';
      if (d.example) h += '<p style="color:#64748b;margin:0;font-size:13px;font-style:italic">💬 '+esc(d.example)+'</p>';
      return h+'</div></div>';
    }
  },
  // ── 60. encouragement ── motivational boost box
  'encouragement': {
    desc: 'Motivational boost. message, icon? (🌟), variant:cheer|persist|celebrate|believe.',
    render: function(d) {
      var themes = {
        cheer: ['🎉','#ecfdf5','#059669'],
        persist: ['💪','#eef2ff','#4f46e5'],
        celebrate: ['🏆','#fef3c7','#d97706'],
        believe: ['🌟','#fdf2f8','#db2777']
      };
      var t = themes[d.variant]||themes.believe;
      var h = '<div style="text-align:center;padding:20px 24px;margin:20px 0;background:'+t[1]+';border-radius:16px;border:2px solid '+t[2]+'">';
      h += '<div style="font-size:40px;margin-bottom:8px">'+(d.icon||t[0])+'</div>';
      h += '<p style="color:'+t[2]+';font-weight:700;font-size:18px;margin:0">'+esc(d.message||'You\u2019ve got this! 💪')+'</p></div>';
      return h;
    }
  },
  // ══════════════════════════════════════
  //  CHARTS & DATA VISUALIZATION (61-72)
  // ══════════════════════════════════════
  // ── 61. bar-chart ── horizontal bar chart
  'bar-chart': {
    desc: 'Horizontal bar chart. title?, items:[{label, value, color?, maxValue?}], showValues?, height?:24.',
    render: function(d) {
      var maxVal = d.maxValue || 0;
      if (!maxVal) { for (var i=0;i<(d.items||[]).length;i++) { var v=parseFloat(d.items[i].value)||0; if(v>maxVal)maxVal=v; } }
      if (maxVal===0) maxVal=100;
      var barH = (d.height||24)+'px';
      var colors = ['#4f46e5','#059669','#d97706','#dc2626','#7c3aed','#0891b2','#db2777','#ca8a04'];
      var h = '<div style="margin:16px 0">';
      if (d.title) h += '<h3 style="color:#1e293b;margin-bottom:14px;font-weight:700">📊 '+esc(d.title)+'</h3>';
      for (var i=0;i<(d.items||[]).length;i++) {
        var it = d.items[i];
        var val = parseFloat(it.value)||0;
        var pct = Math.round((val/maxVal)*100);
        var clr = it.color||colors[i%colors.length];
        h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
        h += '<span style="min-width:100px;font-size:13px;color:#475569;text-align:right">'+esc(it.label||'')+'</span>';
        h += '<div style="flex:1;background:#f1f5f9;border-radius:4px;height:'+barH+';overflow:hidden">';
        h += '<div style="width:'+pct+'%;height:100%;background:'+clr+';border-radius:4px;transition:width 0.8s ease;display:flex;align-items:center;justify-content:flex-end;padding-right:6px">';
        if (d.showValues!==false) h += '<span style="font-size:10px;color:#fff;font-weight:700">'+esc(it.value)+'</span>';
        h += '</div></div></div>';
      }
      return h+'</div>';
    }
  },
  // ── 62. pie-chart ── pie/donut using conic-gradient
  'pie-chart': {
    desc: 'Pie or donut chart. title?, segments:[{label, value, color?}], donut?:true, size?:200, showLegend?:true.',
    render: function(d) {
      var segs = d.segments||[];
      if (!segs.length) return '';
      var total = 0;
      for (var i=0;i<segs.length;i++) total += parseFloat(segs[i].value)||0;
      if (total===0) return '';
      var colors = ['#4f46e5','#059669','#d97706','#dc2626','#7c3aed','#0891b2','#db2777','#ca8a04','#2563eb','#16a34a'];
      var gradParts = [];
      var cumPct = 0;
      for (var j=0;j<segs.length;j++) {
        var pct = ((parseFloat(segs[j].value)||0)/total)*100;
        var clr = segs[j].color||colors[j%colors.length];
        gradParts.push(clr+' '+cumPct+'% '+(cumPct+pct)+'%');
        cumPct += pct;
      }
      var size = (d.size||200)+'px';
      var isDonut = d.donut!==false; // default to donut
      var cssGrad = 'conic-gradient('+gradParts.join(',')+')';
      var h = '<div style="margin:16px 0;text-align:center">';
      if (d.title) h += '<h3 style="color:#1e293b;margin-bottom:12px;font-weight:700">🥧 '+esc(d.title)+'</h3>';
      h += '<div style="display:inline-block;position:relative;width:'+size+';height:'+size+'">';
      // Pie/donut
      h += '<div style="width:100%;height:100%;border-radius:50%;background:'+cssGrad+'"></div>';
      if (isDonut) {
        var holeSize = (parseInt(d.size||200)*0.45)+'px';
        h += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:'+holeSize+';height:'+holeSize+';background:#fff;border-radius:50%"></div>';
        if (d.centerLabel) h += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-weight:800;color:#1e293b;font-size:18px">'+esc(d.centerLabel)+'</div>';
      }
      h += '</div>';
      // Legend
      if (d.showLegend!==false) {
        h += '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:12px">';
        for (var k=0;k<segs.length;k++) {
          var lclr = segs[k].color||colors[k%colors.length];
          h += '<div style="display:flex;align-items:center;gap:4px;font-size:12px"><span style="width:10px;height:10px;border-radius:2px;background:'+lclr+';flex-shrink:0"></span><span style="color:#475569">'+esc(segs[k].label||'')+' ('+Math.round((parseFloat(segs[k].value)||0)/total*100)+'%)</span></div>';
        }
        h += '</div>';
      }
      return h+'</div>';
    }
  },
  // ── 63. gauge ── semi-circular gauge
  'gauge': {
    desc: 'Speedometer gauge. value, min?, max:100, label?, colorScheme?:green|blue|multi, size?:180.',
    render: function(d) {
      var val = parseFloat(d.value)||0;
      var minV = parseFloat(d.min)||0;
      var maxV = parseFloat(d.max)||100;
      var pct = Math.max(0,Math.min(100,((val-minV)/(maxV-minV))*100));
      var size = (d.size||180)+'px';
      var schemes = {
        green: ['#e2e8f0','#059669'],
        blue: ['#e2e8f0','#4f46e5'],
        multi: ['#e2e8f0', pct>80?'#059669':pct>50?'#d97706':'#dc2626']
      };
      var scheme = schemes[d.colorScheme||'blue'];
      var trackColor = scheme[0];
      var fillColor = typeof scheme[1]==='function'?scheme[1]():scheme[1];
      var h = '<div style="margin:16px 0;text-align:center">';
      h += '<div style="display:inline-block;position:relative;width:'+size+';height:'+(parseInt(size)/2)+'px;overflow:hidden">';
      h += '<div style="width:'+size+';height:'+size+';border-radius:50%;background:conic-gradient('+fillColor+' 0% '+pct+'%, '+trackColor+' '+pct+'% 100%)"></div>';
      h += '</div>';
      h += '<div style="font-family:Georgia,serif;font-size:28px;font-weight:800;color:#1e293b;margin-top:-10px">'+esc(d.value)+'<span style="font-size:14px;color:#94a3b8"> / '+esc(d.max||100)+'</span></div>';
      if (d.label) h += '<div style="font-size:12px;color:#64748b;margin-top:2px">'+esc(d.label)+'</div>';
      return h+'</div>';
    }
  },
  // ── 64. funnel ── funnel/trapezoid stages
  'funnel': {
    desc: 'Funnel chart. title?, stages:[{label, value, color?}] (top to bottom narrowing).',
    render: function(d) {
      var stages = d.stages||[];
      if (!stages.length) return '';
      var colors = ['#4f46e5','#6366f1','#818cf8','#a5b4fc','#c7d2fe','#e0e7ff'];
      var maxV = 0;
      for (var i=0;i<stages.length;i++) { var sv=parseFloat(stages[i].value)||0; if(sv>maxV)maxV=sv; }
      var h = '<div style="margin:16px 0;text-align:center">';
      if (d.title) h += '<h3 style="color:#1e293b;margin-bottom:14px;font-weight:700">🔽 '+esc(d.title)+'</h3>';
      for (var j=0;j<stages.length;j++) {
        var st = stages[j];
        var pct = maxV>0?Math.max(15,Math.round(((parseFloat(st.value)||0)/maxV)*100)):100;
        var clr = st.color||colors[j%colors.length];
        h += '<div style="margin:0 auto 4px;width:'+pct+'%;background:'+clr+';color:#fff;padding:8px 16px;font-weight:600;font-size:13px;position:relative;min-width:60px">';
        h += esc(st.label||'')+' — '+esc(st.value||'');
        h += '</div>';
      }
      return h+'</div>';
    }
  },
  // ── 65. metric-card ── single KPI with trend
  'metric-card': {
    desc: 'Single KPI card. value, label, trend:up|down|flat, delta?, icon?, color?.',
    render: function(d) {
      var trendIcons = { up:'📈', down:'📉', flat:'📊' };
      var trendColors = { up:'#059669', down:'#dc2626', flat:'#94a3b8' };
      var trendArrows = { up:'↑', down:'↓', flat:'→' };
      var tr = d.trend||'flat';
      var h = '<div style="display:inline-block;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 22px;margin:8px;text-align:center;min-width:140px">';
      if (d.icon) h += '<div style="font-size:28px;margin-bottom:6px">'+esc(d.icon)+'</div>';
      h += '<div style="font-family:Georgia,serif;font-size:32px;font-weight:800;color:'+(d.color||'#1e293b')+'">'+esc(d.value)+'</div>';
      h += '<div style="font-size:12px;color:#64748b;margin:4px 0">'+esc(d.label||'')+'</div>';
      h += '<div style="font-size:13px;font-weight:600;color:'+trendColors[tr]+'">'+trendArrows[tr]+' '+(d.delta||'')+'</div>';
      return h+'</div>';
    }
  },
  // ── 66. ranked-list ── ranked listing of things/concepts (NOT people — solo study)
  'ranked-list': {
    desc: 'Ranked list of things/concepts by metric. title?, items:[{label, value, highlight?}], showRanks?:true, sortDesc?:true. For ranking concepts by importance/frequency — NOT students.',
    render: function(d) {
      var items = (d.items||[]).slice();
      if (d.sortDesc!==false) items.sort(function(a,b){ return (parseFloat(b.value)||0)-(parseFloat(a.value)||0); });
      var h = '<div style="margin:16px 0;max-width:500px">';
      if (d.title) h += '<h3 style="color:#1e293b;margin-bottom:10px;font-weight:700">📊 '+esc(d.title)+'</h3>';
      for (var i=0;i<items.length;i++) {
        var it = items[i];
        var bg = it.highlight?'#eef2ff':(i%2===0?'#fafbfc':'#fff');
        var rankIcon = d.showRanks!==false?('#'+(i+1)):'';
        h += '<div style="display:flex;align-items:center;padding:8px 14px;background:'+bg+';border-radius:6px;margin-bottom:4px">';
        if (rankIcon) h += '<span style="font-size:14px;width:36px;text-align:center;color:#94a3b8">'+rankIcon+'</span>';
        h += '<span style="flex:1;font-weight:500;color:#1e293b">'+esc(it.label||'')+'</span>';
        h += '<span style="font-weight:700;color:#4f46e5">'+esc(it.value||'')+'</span>';
        h += '</div>';
      }
      return h+'</div>';
    }
  },
  // ── 67. heatmap ── color intensity grid
  'heatmap': {
    desc: 'Heatmap grid. title?, rowLabels?:[], colLabels?:[], cells:[[value]], lowColor?:"#e2e8f0", highColor?:"#4f46e5".',
    render: function(d) {
      var lowC = d.lowColor||'#e2e8f0';
      var highC = d.highColor||'#4f46e5';
      var cells = d.cells||[];
      var rowLabels = d.rowLabels||[];
      var colLabels = d.colLabels||[];
      // Find min/max
      var minV=Infinity, maxV=-Infinity;
      for (var r=0;r<cells.length;r++) {
        for (var c=0;c<(cells[r]||[]).length;c++) {
          var cv = parseFloat(cells[r][c]); if(!isNaN(cv)){ if(cv<minV)minV=cv; if(cv>maxV)maxV=cv; }
        }
      }
      if (minV===Infinity) return '';
      var range = maxV-minV||1;
      var h = '<div style="overflow-x:auto;margin:16px 0">';
      if (d.title) h += '<h3 style="color:#1e293b;margin-bottom:10px;font-weight:700">🔥 '+esc(d.title)+'</h3>';
      h += '<table style="border-collapse:collapse;font-size:12px"><tbody>';
      // Header row
      if (colLabels.length) {
        h += '<tr><td></td>';
        for (var cl=0;cl<colLabels.length;cl++) h += '<td style="padding:4px 8px;text-align:center;font-weight:600;color:#64748b;font-size:11px">'+esc(colLabels[cl])+'</td>';
        h += '</tr>';
      }
      for (var r2=0;r2<cells.length;r2++) {
        h += '<tr>';
        if (rowLabels[r2]) h += '<td style="padding:4px 8px;font-weight:600;color:#475569;font-size:11px;text-align:right">'+esc(rowLabels[r2])+'</td>';
        for (var c2=0;c2<(cells[r2]||[]).length;c2++) {
          var v2 = parseFloat(cells[r2][c2]);
          var t = isNaN(v2)?0:((v2-minV)/range);
          // Interpolate between lowC and highC
          var rVal = parseInt(lowC.substr(1,2),16); var gVal = parseInt(lowC.substr(3,2),16); var bVal = parseInt(lowC.substr(5,2),16);
          var rHi = parseInt(highC.substr(1,2),16); var gHi = parseInt(highC.substr(3,2),16); var bHi = parseInt(highC.substr(5,2),16);
          var rr = Math.round(rVal+(rHi-rVal)*t);
          var gg = Math.round(gVal+(gHi-gVal)*t);
          var bb = Math.round(bVal+(bHi-bVal)*t);
          var bgColor = 'rgb('+rr+','+gg+','+bb+')';
          var textColor = t>0.5?'#fff':'#1e293b';
          h += '<td style="padding:6px 12px;text-align:center;background:'+bgColor+';color:'+textColor+';font-weight:500;border-radius:4px;margin:1px">'+esc(isNaN(v2)?'':cells[r2][c2])+'</td>';
        }
        h += '</tr>';
      }
      return h+'</tbody></table></div>';
    }
  },
  // ── 68. venn-diagram ── overlapping circles
  'venn-diagram': {
    desc: 'Venn diagram. title?, sets:[{label, size?, color?}], intersections?:[{labels:[],text}], size?:300.',
    render: function(d) {
      var sets = d.sets||[];
      if (sets.length<2) return '';
      var size = d.size||280;
      var colors = ['rgba(79,70,229,0.5)','rgba(5,150,105,0.5)','rgba(217,119,6,0.5)'];
      var borderColors = ['#4f46e5','#059669','#d97706'];
      // Layout: 2 sets = side-by-side; 3 sets = triangle
      var h = '<div style="margin:16px 0;text-align:center">';
      if (d.title) h += '<h3 style="color:#1e293b;margin-bottom:14px;font-weight:700">🔴🔵 '+esc(d.title)+'</h3>';
      h += '<div style="position:relative;display:inline-block;width:'+size+'px;height:'+size+'px">';
      for (var i=0;i<sets.length;i++) {
        var s = sets[i];
        var sz = (s.size||(size*0.6))+'px';
        var bg = s.color||colors[i];
        var border = borderColors[i%3];
        // Position circles overlapping
        var positions = [
          { left:'10%', top:'20%' },
          { left:'45%', top:'20%' },
          { left:'27%', top:'45%' }
        ];
        var pos = positions[i]||positions[0];
        h += '<div style="position:absolute;left:'+pos.left+';top:'+pos.top+';width:'+sz+';height:'+sz+';border-radius:50%;background:'+bg+';border:2px solid '+border+';display:flex;align-items:center;justify-content:center;font-weight:700;color:#1e293b;font-size:13px">'+esc(s.label||'')+'</div>';
      }
      // Intersection labels
      if (d.intersections) {
        for (var j=0;j<d.intersections.length;j++) {
          var inter = d.intersections[j];
          h += '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:11px;color:#1e293b;font-weight:600;background:rgba(255,255,255,0.8);padding:2px 8px;border-radius:10px;z-index:2">'+esc(inter.text||'')+'</div>';
        }
      }
      return h+'</div></div>';
    }
  },
  // ── 69. dashboard-grid ── grid of KPI metric cards
  'dashboard-grid': {
    desc: 'KPI dashboard grid. title?, cards:[{value, label, trend?, delta?, icon?, color?}], cols:2|3|4.',
    render: function(d) {
      var cols = { '2':'1fr 1fr','3':'1fr 1fr 1fr','4':'1fr 1fr 1fr 1fr' };
      var trendIcons = { up:'📈', down:'📉', flat:'📊' };
      var trendArrows = { up:'↑', down:'↓', flat:'→' };
      var trendColors = { up:'#059669', down:'#dc2626', flat:'#94a3b8' };
      var h = '<div style="margin:16px 0">';
      if (d.title) h += '<h3 style="color:#1e293b;margin-bottom:12px;font-weight:700">📋 '+esc(d.title)+'</h3>';
      h += '<div style="display:grid;grid-template-columns:'+(cols[d.cols]||cols['3'])+';gap:12px">';
      for (var i=0;i<(d.cards||[]).length;i++) {
        var c = d.cards[i];
        var tr = c.trend||'flat';
        h += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 16px;text-align:center">';
        if (c.icon) h += '<div style="font-size:26px;margin-bottom:6px">'+esc(c.icon)+'</div>';
        h += '<div style="font-family:Georgia,serif;font-size:28px;font-weight:800;color:'+(c.color||'#1e293b')+'">'+esc(c.value)+'</div>';
        h += '<div style="font-size:11px;color:#64748b;margin:4px 0">'+esc(c.label||'')+'</div>';
        h += '<div style="font-size:12px;font-weight:600;color:'+trendColors[tr]+'">'+trendArrows[tr]+' '+(c.delta||'')+'</div>';
        h += '</div>';
      }
      return h+'</div></div>';
    }
  },
  // ── 70. bullet-chart ── value vs target bar
  'bullet-chart': {
    desc: 'Bullet chart. value, target, max, label?, color?, targetColor?:"#dc2626".',
    render: function(d) {
      var val = parseFloat(d.value)||0;
      var target = parseFloat(d.target)||0;
      var maxV = parseFloat(d.max)||100;
      var valPct = Math.min(100,Math.round((val/maxV)*100));
      var targetPct = Math.min(100,Math.round((target/maxV)*100));
      var color = d.color||'#4f46e5';
      var h = '<div style="margin:12px 0">';
      if (d.label) h += '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-weight:600;color:#1e293b;font-size:13px">'+esc(d.label)+'</span><span style="color:#64748b;font-size:12px">'+esc(d.value)+' / '+esc(d.target||'Target: '+d.target)+'</span></div>';
      h += '<div style="position:relative;height:22px;background:#f1f5f9;border-radius:4px;overflow:hidden">';
      h += '<div style="position:absolute;left:0;top:0;height:100%;width:'+valPct+'%;background:'+color+';border-radius:4px"></div>';
      // Target marker
      h += '<div style="position:absolute;left:'+targetPct+'%;top:-2px;height:26px;width:3px;background:'+(d.targetColor||'#dc2626')+';border-radius:2px"></div>';
      h += '</div></div>';
      return h;
    }
  },
  // ── 71. sparkline ── tiny inline trend bars
  'sparkline': {
    desc: 'Tiny sparkline trend. values:[], color?:"#4f46e5", height?:40, highlightMax?:true, label?.',
    render: function(d) {
      var vals = d.values||[];
      if (!vals.length) return '';
      var maxV = -Infinity, minV = Infinity;
      for (var i=0;i<vals.length;i++) { var v=parseFloat(vals[i])||0; if(v>maxV)maxV=v; if(v<minV)minV=v; }
      var range = maxV-minV||1;
      var barW = Math.max(4,Math.floor(300/vals.length));
      var h = '<div style="display:inline-flex;align-items:flex-end;gap:2px;height:'+(d.height||40)+'px;padding:4px 0;vertical-align:middle">';
      for (var j=0;j<vals.length;j++) {
        var bv = parseFloat(vals[j])||0;
        var bh = Math.max(2,((bv-minV)/range)*(d.height||40));
        var isMax = d.highlightMax!==false && bv===maxV;
        var clr = isMax?(d.highlightColor||'#dc2626'):(d.color||'#4f46e5');
        h += '<div style="width:'+barW+'px;height:'+bh+'px;background:'+clr+';border-radius:2px 2px 0 0;opacity:'+(isMax?'1':'0.7')+'" title="'+esc(bv)+'"></div>';
      }
      h += '</div>';
      if (d.label) h += '<span style="font-size:11px;color:#64748b;margin-left:8px">'+esc(d.label)+'</span>';
      return '<div style="margin:8px 0">'+h+'</div>';
    }
  },
  // ── 72. waterfall ── running total cascade
  'waterfall': {
    desc: 'Waterfall chart. title?, items:[{label, value, isTotal?}], colorUp?:"#059669", colorDown?:"#dc2626", colorTotal?:"#4f46e5".',
    render: function(d) {
      var items = d.items||[];
      if (!items.length) return '';
      var colorUp = d.colorUp||'#059669';
      var colorDown = d.colorDown||'#dc2626';
      var colorTotal = d.colorTotal||'#4f46e5';
      var running = 0;
      var allVals = [];
      for (var i=0;i<items.length;i++) { var v=parseFloat(items[i].value)||0; running+=v; allVals.push(Math.abs(v)); allVals.push(Math.abs(running)); }
      var maxAbs = Math.max.apply(null,allVals)||100;
      running = 0;
      var h = '<div style="margin:16px 0">';
      if (d.title) h += '<h3 style="color:#1e293b;margin-bottom:14px;font-weight:700">🌊 '+esc(d.title)+'</h3>';
      for (var j=0;j<items.length;j++) {
        var it = items[j];
        var iv = parseFloat(it.value)||0;
        var isTotal = it.isTotal;
        var barStart = running;
        running += iv;
        var barEnd = running;
        var barLeft = Math.round((Math.min(barStart,barEnd)/maxAbs)*100);
        var barW = Math.max(2,Math.round((Math.abs(iv)/maxAbs)*100));
        var clr = isTotal?colorTotal:(iv>=0?colorUp:colorDown);
        var connectorColor = '#cbd5e1';
        h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
        h += '<span style="min-width:90px;font-size:12px;color:#475569;text-align:right">'+esc(it.label||'')+'</span>';
        h += '<div style="flex:1;height:18px;position:relative">';
        // Invisible connector from 0 to barStart
        if (barStart>0) h += '<div style="position:absolute;left:0;top:6px;width:'+Math.round((barStart/maxAbs)*100)+'%;height:6px;background:'+connectorColor+';border-radius:3px"></div>';
        // Bar
        h += '<div style="position:absolute;left:'+barLeft+'%;top:2px;width:'+barW+'%;height:14px;background:'+clr+';border-radius:3px"></div>';
        h += '</div>';
        h += '<span style="min-width:50px;font-size:12px;font-weight:600;color:#1e293b;text-align:right">'+esc(iv)+'</span>';
        h += '</div>';
      }
      return h+'</div>';
    }
  },
  // ── 73. info-card ── single card with colored header + body
  'info-card': {
    desc: 'Single info card. icon?, title, body, variant:default|definition|reference|example, color?.',
    render: function(d) {
      var themes = {
        default: ['📋','#4f46e5','#eef2ff'],
        definition: ['📖','#7c3aed','#f5f3ff'],
        reference: ['🔗','#0891b2','#ecfeff'],
        example: ['✏️','#059669','#ecfdf5']
      };
      var t = themes[d.variant]||themes.default;
      var color = d.color||t[1];
      var h = '<div class="sg-card" style="margin:14px 0">';
      h += '<div class="sg-card-header" style="background:'+t[2]+';border-bottom:2px solid '+color+'">'+(d.icon||t[0])+' <strong>'+esc(d.title||'')+'</strong></div>';
      h += '<div class="sg-card-body">'+(d.body||d.content||'')+'</div>';
      return h+'</div>';
    }
  },
  // ── 74. heading ── styled section heading with icon
  'heading': {
    desc: 'Section heading. text, icon?, level:section|subsection (section=larger with border).',
    render: function(d) {
      if (d.level==='subsection') {
        return '<h3 class="sg-subheading">'+(d.icon||'')+' '+esc(d.text||d.title||'')+'</h3>';
      }
      return '<h2 class="sg-heading">'+(d.icon||'')+' '+esc(d.text||d.title||'')+'</h2>';
    }
  },
  // ── 75. reading-time ── estimated reading time indicator
  'reading-time': {
    desc: 'Reading time badge. minutes, label?, badgeText? (e.g. section name).',
    render: function(d) {
      var h = '<p class="sg-reading-time" style="color:#94a3b8;font-size:13px;margin:8px 0 16px">⏱️ '+esc(d.label||'Estimated Reading Time')+': '+esc(d.minutes||'5-10')+' min';
      if (d.badgeText) h += ' | <span class="sg-badge">'+esc(d.badgeText)+'</span>';
      return h+'</p>';
    }
  },
  // ══════════════════════════════════════
  //  ENGAGEMENT & DEEP LEARNING (76-87)
  // ══════════════════════════════════════
  // ── 76. curiosity-hook ── spark interest before content
  'curiosity-hook': {
    desc: 'Curiosity-sparking opener. hook (question or statement), reveal?, icon? (🤔).',
    render: function(d) {
      var h = '<div style="border:2px dashed #818cf8;background:linear-gradient(135deg,#eef2ff,#fafbff);border-radius:12px;padding:18px 22px;margin:18px 0">';
      h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="font-size:24px">'+(d.icon||'🤔')+'</span><strong style="color:#4f46e5;font-size:16px">'+esc(d.title||'Have You Ever Wondered?')+'</strong></div>';
      h += '<p style="color:#1e293b;font-size:16px;font-weight:500;margin:0;line-height:1.7">'+esc(d.hook||d.question||'')+'</p>';
      if (d.reveal) h += '<details style="margin-top:12px"><summary style="cursor:pointer;color:#4f46e5;font-weight:600;font-size:14px">👁️ Reveal the answer</summary><p style="color:#475569;margin:8px 0 0;line-height:1.7">'+esc(d.reveal)+'</p></details>';
      return h+'</div>';
    }
  },
  // ── 77. myth-buster ── correct common misconceptions
  'myth-buster': {
    desc: 'Myth vs reality. myth, reality, explanation?, icon? (💥).',
    render: function(d) {
      return '<div style="border:2px solid #f97316;background:linear-gradient(135deg,#fff7ed,#fffbeb);border-radius:12px;padding:18px 22px;margin:18px 0">'+
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="font-size:22px">'+(d.icon||'💥')+'</span><strong style="color:#c2410c;font-size:16px">'+esc(d.title||'Myth Buster')+'</strong></div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
        '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:12px 14px"><strong style="color:#991b1b">❌ Myth:</strong><p style="color:#475569;margin:4px 0 0;font-size:14px">'+esc(d.myth||'')+'</p></div>'+
        '<div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:12px 14px"><strong style="color:#065f46">✅ Reality:</strong><p style="color:#475569;margin:4px 0 0;font-size:14px">'+esc(d.reality||'')+'</p></div>'+
        '</div>'+
        (d.explanation?'<p style="color:#78716c;margin:10px 0 0;font-size:13px">💡 '+esc(d.explanation)+'</p>':'')+
        '</div>';
    }
  },
  // ── 78. imagine ── put student in a realistic scenario
  'imagine': {
    desc: 'Scenario immersion. scenario, question?, reflection?, icon? (🎬).',
    render: function(d) {
      var h = '<div style="border:2px solid #06b6d4;background:linear-gradient(135deg,#ecfeff,#f0f9ff);border-radius:12px;overflow:hidden;margin:18px 0">';
      h += '<div style="background:linear-gradient(135deg,#0891b2,#06b6d4);padding:10px 20px;color:#fff;font-weight:700;font-size:14px">'+(d.icon||'🎬')+' '+esc(d.title||'Put Yourself Here')+'</div>';
      h += '<div style="padding:18px 20px">';
      h += '<p style="color:#155e75;margin:0;line-height:1.8;font-size:15px">'+esc(d.scenario||d.body||'')+'</p>';
      if (d.question) h += '<p style="color:#0891b2;font-weight:600;margin:12px 0 0;font-size:15px">🤔 '+esc(d.question)+'</p>';
      if (d.reflection) h += '<details style="margin-top:10px"><summary style="cursor:pointer;color:#0891b2;font-weight:600;font-size:13px">💭 Reflect on this</summary><p style="color:#475569;margin:8px 0 0;font-size:14px">'+esc(d.reflection)+'</p></details>';
      return h+'</div></div>';
    }
  },
  // ── 79. insight ── crystallize the key "aha!" takeaway
  'insight': {
    desc: 'Key insight / aha moment. insight, title?, icon? (💎).',
    render: function(d) {
      return '<div style="border:2px solid #8b5cf6;background:linear-gradient(135deg,#f5f3ff,#ede9fe);border-radius:12px;padding:18px 22px;margin:18px 0;text-align:center">'+
        '<div style="font-size:28px;margin-bottom:6px">'+(d.icon||'💎')+'</div>'+
        '<div style="font-weight:700;color:#6d28d9;font-size:14px;margin-bottom:8px">'+esc(d.title||'Key Insight')+'</div>'+
        '<p style="color:#475569;font-size:17px;font-weight:600;margin:0;line-height:1.7">'+esc(d.insight||d.body||'')+'</p>'+
        '</div>';
    }
  },
  // ── 80. rule-of-thumb ── memorable heuristic
  'rule-of-thumb': {
    desc: 'Memorable rule of thumb. rule, context?, icon? (👍).',
    render: function(d) {
      return '<div style="border:2px solid #f59e0b;background:linear-gradient(135deg,#fffbeb,#fefce8);border-radius:10px;padding:16px 20px;margin:16px 0;display:flex;align-items:center;gap:12px">'+
        '<span style="font-size:32px;flex-shrink:0">'+(d.icon||'👍')+'</span>'+
        '<div><div style="font-weight:700;color:#92400e;font-size:14px;margin-bottom:4px">'+esc(d.title||'Rule of Thumb')+'</div>'+
        '<p style="color:#475569;margin:0;font-size:15px;font-weight:600">'+esc(d.rule||d.body||'')+'</p>'+
        (d.context?'<p style="color:#a8a29e;margin:4px 0 0;font-size:12px">'+esc(d.context)+'</p>':'')+
        '</div></div>';
    }
  },
  // ── 81. contrast ── "don't confuse X with Y"
  'contrast': {
    desc: 'Contrast two easily-confused concepts. a:{label,desc}, b:{label,desc}, title?.',
    render: function(d) {
      var h = '<div style="border:2px solid #e2e8f0;border-radius:12px;overflow:hidden;margin:16px 0">';
      h += '<div style="background:#f1f5f9;padding:10px 18px;font-weight:700;color:#1e293b">⚠️ '+esc(d.title||'Don\'t Confuse These')+'</div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr">';
      h += '<div style="padding:14px 16px;border-right:1px solid #e2e8f0"><div style="font-weight:700;color:#4f46e5;margin-bottom:6px">🔵 '+esc((d.a||{}).label||'Concept A')+'</div><p style="color:#475569;margin:0;font-size:14px">'+esc((d.a||{}).desc||'')+'</p></div>';
      h += '<div style="padding:14px 16px"><div style="font-weight:700;color:#d97706;margin-bottom:6px">🟠 '+esc((d.b||{}).label||'Concept B')+'</div><p style="color:#475569;margin:0;font-size:14px">'+esc((d.b||{}).desc||'')+'</p></div>';
      return h+'</div></div>';
    }
  },
  // ── 82. common-question ── FAQ-style box
  'common-question': {
    desc: 'FAQ / common student question. question, answer, icon? (❓).',
    render: function(d) {
      return '<div style="border:1px solid #cbd5e1;background:#fafbfc;border-radius:10px;padding:16px 20px;margin:14px 0">'+
        '<div style="display:flex;align-items:flex-start;gap:10px"><span style="font-size:22px;flex-shrink:0">'+(d.icon||'❓')+'</span>'+
        '<div><div style="font-weight:700;color:#1e293b;margin-bottom:6px">Students often ask: <span style="color:#4f46e5">'+esc(d.question||'')+'</span></div>'+
        '<p style="color:#475569;margin:0;font-size:14px;line-height:1.7">'+esc(d.answer||d.body||'')+'</p></div></div></div>';
    }
  },
  // ── 83. pause-point ── comprehension checkpoint
  'pause-point': {
    desc: 'Comprehension checkpoint. checks:[string questions], title?, icon? (🛑).',
    render: function(d) {
      var h = '<div style="border:2px solid #fbbf24;background:linear-gradient(135deg,#fffbeb,#fefce8);border-radius:12px;padding:18px 22px;margin:20px 0">';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:24px">'+(d.icon||'🛑')+'</span><strong style="color:#92400e;font-size:16px">'+esc(d.title||'Pause & Check Yourself')+'</strong></div>';
      h += '<p style="color:#78716c;margin:0 0 10px;font-size:13px">Before continuing, make sure you can answer these:</p>';
      h += '<ol style="margin:0;padding-left:20px">';
      for (var i=0;i<(d.checks||d.items||[]).length;i++) h += '<li style="color:#475569;margin-bottom:6px"><input type="checkbox" style="margin-right:8px;accent-color:#f59e0b">'+esc(typeof d.checks[i]==='string'?d.checks[i]:d.checks[i].text||d.checks[i])+'</li>';
      h += '</ol></div>';
      return h;
    }
  },
  // ── 84. joke ── appropriate humor break
  'joke': {
    desc: 'Light humor break (use only when subject-appropriate — NOT law/medicine/serious). joke, icon? (😄).',
    render: function(d) {
      return '<div style="border:2px dashed #a78bfa;background:linear-gradient(135deg,#faf5ff,#fefce8);border-radius:10px;padding:14px 20px;margin:16px 0;text-align:center">'+
        '<div style="font-size:28px;margin-bottom:4px">'+(d.icon||'😄')+'</div>'+
        '<p style="color:#475569;font-style:italic;margin:0;font-size:15px">'+esc(d.joke||d.body||'')+'</p>'+
        (d.punchline?'<p style="color:#475569;font-weight:700;margin:4px 0 0;font-size:14px">'+esc(d.punchline)+'</p>':'')+
        '</div>';
    }
  },
  // ── 85. speed-run ── ultra-condensed review
  'speed-run': {
    desc: 'Ultra-condensed review. title?, points:[] (one-liner summaries).',
    render: function(d) {
      var h = '<div style="border:2px solid #14b8a6;background:linear-gradient(135deg,#f0fdfa,#ccfbf1);border-radius:12px;overflow:hidden;margin:18px 0">';
      h += '<div style="background:linear-gradient(135deg,#0d9488,#14b8a6);padding:8px 18px;color:#fff;font-weight:700;font-size:14px">⚡ '+esc(d.title||'Speed Run — 30-Second Recap')+'</div>';
      h += '<div style="padding:14px 18px">';
      for (var i=0;i<(d.points||d.items||[]).length;i++) h += '<div style="display:flex;gap:8px;padding:4px 0;font-size:13px;color:#0f766e"><span style="color:#14b8a6;font-weight:700">▸</span><span>'+esc(typeof d.points[i]==='string'?d.points[i]:d.points[i].text||d.points[i])+'</span></div>';
      return h+'</div></div>';
    }
  },
  // ── 86. expert-voice ── first-person practitioner insight
  'expert-voice': {
    desc: 'First-person expert insight. quote, expertName, expertRole?, icon? (🎙️).',
    render: function(d) {
      return '<div style="border-left:4px solid #0891b2;background:linear-gradient(135deg,#fafdfe,#ecfeff);padding:16px 20px;margin:18px 0;border-radius:0 10px 10px 0">'+
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:22px">'+(d.icon||'🎙️')+'</span><strong style="color:#0e7490">'+esc(d.expertName||'Expert')+'</strong>'+(d.expertRole?'<span style="color:#94a3b8;font-size:12px;font-weight:400"> — '+esc(d.expertRole)+'</span>':'')+'</div>'+
        '<p style="color:#164e63;margin:0;font-style:italic;font-size:15px;line-height:1.7">"'+esc(d.quote||d.body||'')+'"</p>'+
        '</div>';
    }
  },
  // ── 87. visual-metaphor ── text-based metaphor for abstract concepts
  'visual-metaphor': {
    desc: 'Text-based visual metaphor. concept, metaphor, explanation?, icon? (🔍).',
    render: function(d) {
      return '<div style="border:2px solid #c084fc;background:linear-gradient(135deg,#faf5ff,#f5f3ff);border-radius:12px;padding:20px;margin:18px 0;text-align:center">'+
        '<div style="font-size:26px;margin-bottom:6px">'+(d.icon||'🔍')+'</div>'+
        '<div style="font-weight:700;color:#7c3aed;font-size:15px;margin-bottom:10px">Think of it this way...</div>'+
        '<div style="display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">'+
        '<span style="background:#fff;border:2px solid #a78bfa;border-radius:8px;padding:10px 18px;font-weight:700;color:#6d28d9;font-size:15px">'+esc(d.concept||'')+'</span>'+
        '<span style="font-size:22px;color:#a78bfa">→</span>'+
        '<span style="background:#fef3c7;border:2px solid #fcd34d;border-radius:8px;padding:10px 18px;font-weight:700;color:#92400e;font-size:15px">'+esc(d.metaphor||'')+'</span>'+
        '</div>'+
        (d.explanation?'<p style="color:#64748b;margin:0;font-size:13px">'+esc(d.explanation)+'</p>':'')+
        '</div>';
    }
  },
  // ══════════════════════════════════════
  //  READING & INTERACTIVE REVEAL (88-93)
  // ══════════════════════════════════════
  // ── 88. paragraph ── regular reading paragraph (MOST IMPORTANT — use for 60-70% of content)
  'paragraph': {
    desc: 'Regular reading paragraph. text, variant?:normal|lead|small|muted. Use heavily — this is the main reading content.',
    render: function(d) {
      var styles = {
        normal: 'font-size:15px;color:#1e293b;line-height:1.85;margin:0 0 14px',
        lead: 'font-size:17px;color:#334155;line-height:1.85;margin:0 0 16px;font-weight:500',
        small: 'font-size:13px;color:#64748b;line-height:1.65;margin:0 0 10px',
        muted: 'font-size:13px;color:#94a3b8;line-height:1.6;margin:0 0 8px;font-style:italic'
      };
      var s = styles[d.variant||'normal'];
      return '<p style="'+s+'">'+esc(d.text||d.body||'')+'</p>';
    }
  },
  // ── 89. reveal ── generic click-to-reveal hidden content
  'reveal': {
    desc: 'Click-to-reveal hidden content. teaser, content, icon? (👁️). Great for "Think first, then check" pattern.',
    render: function(d) {
      return '<div style="border:2px dashed #818cf8;background:linear-gradient(135deg,#eef2ff,#fafbff);border-radius:10px;padding:16px 20px;margin:14px 0">'+
        '<details><summary style="cursor:pointer;color:#4f46e5;font-weight:600;font-size:14px;list-style:none">'+(d.icon||'👁️')+' '+esc(d.teaser||d.label||'Click to reveal')+'</summary>'+
        '<div style="margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0;line-height:1.7;color:#475569">'+(d.content||d.body||'')+'</div></details></div>';
    }
  },
  // ── 90. stat-chart ── statistics / survey results bar chart (display-only, no voting)
  'stat-chart': {
    desc: 'Display survey/statistics results as a bar chart. title?, options:[{label, value}], showValues?:true. Use for showing real-world data in study content.',
    render: function(d) {
      var totalVal = 0;
      for (var i=0;i<(d.options||[]).length;i++) totalVal += parseFloat(d.options[i].value)||0;
      var colors = ['#4f46e5','#059669','#d97706','#dc2626','#7c3aed','#0891b2'];
      var h = '<div style="border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin:16px 0;background:#fff">';
      h += '<div style="font-weight:700;color:#1e293b;margin-bottom:12px">📊 '+esc(d.title||d.question||'Statistics')+'</div>';
      for (var j=0;j<(d.options||[]).length;j++) {
        var opt = d.options[j];
        var val = parseFloat(opt.value||opt.votes)||0;
        var pct = totalVal>0?Math.round((val/totalVal)*100):0;
        var clr = colors[j%colors.length];
        h += '<div style="margin-bottom:10px">';
        h += '<div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px"><span style="color:#475569">'+esc(opt.label||'')+'</span><span style="color:#94a3b8;font-weight:600">'+(d.showValues!==false?pct+'%':val)+'</span></div>';
        h += '<div style="height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden">';
        h += '<div style="height:100%;width:'+(d.showValues!==false?pct:0)+'%;background:'+clr+';border-radius:4px;transition:width 0.8s ease"></div></div></div>';
      }
      if (d.showValues!==false&&totalVal>0) h += '<div style="font-size:11px;color:#94a3b8;margin-top:8px;text-align:center">Based on '+totalVal+' data points</div>';
      return h+'</div>';
    }
  },
  // ── 91. spotlight ── animated pulsing attention highlight
  'spotlight': {
    desc: 'Animated spotlight highlight. text, icon? (💡), color? (#4f46e5). Pulsing glow draws attention to key point.',
    render: function(d) {
      var color = d.color||'#4f46e5';
      return '<div class="sg-spotlight" style="border:2px solid '+color+';background:#fff;border-radius:12px;padding:18px 22px;margin:18px 0;text-align:center;box-shadow:0 0 20px '+color+'33">'+
        '<div style="font-size:28px;margin-bottom:6px">'+(d.icon||'💡')+'</div>'+
        '<p style="color:#1e293b;font-weight:600;font-size:16px;margin:0">'+esc(d.text||d.body||'')+'</p></div>';
    }
  },
  // ── 92. ordered-list ── mentally sort then reveal correct order
  'ordered-list': {
    desc: 'Sort-then-reveal. title?, items:[string] (scrambled), correctOrder?:"Reveal correct order" button.',
    render: function(d) {
      var h = '<div style="border:2px solid #e2e8f0;border-radius:12px;overflow:hidden;margin:16px 0">';
      h += '<div style="background:#f1f5f9;padding:10px 18px;font-weight:700;color:#1e293b">🔢 '+esc(d.title||'Put These in Order')+'</div>';
      h += '<div style="padding:14px 18px">';
      h += '<p style="color:#64748b;font-size:13px;margin:0 0 12px">Mentally arrange these in the correct sequence, then check your answer:</p>';
      h += '<ol style="margin:0 0 12px 20px;color:#475569;line-height:1.8">';
      for (var i=0;i<(d.items||[]).length;i++) h += '<li style="margin-bottom:4px">'+esc(typeof d.items[i]==='string'?d.items[i]:d.items[i].text||d.items[i])+'</li>';
      h += '</ol>';
      h += '<details><summary style="cursor:pointer;color:#4f46e5;font-weight:600;font-size:13px;list-style:none">✅ Reveal correct order</summary>';
      h += '<div style="margin-top:10px;padding:12px 14px;background:#ecfdf5;border-radius:8px;line-height:1.8;color:#065f46;font-weight:500"><ol style="margin:0 0 0 18px">';
      for (var j=0;j<(d.correctOrder||d.items||[]).length;j++) h += '<li>'+esc(typeof d.correctOrder[j]==='string'?d.correctOrder[j]:d.correctOrder[j].text||d.correctOrder[j])+'</li>';
      h += '</ol></div></details></div></div>';
      return h;
    }
  },
  // ── 93. match ── match pairs with reveal (right column auto-shuffled)
  'match': {
    desc: 'Match pairs. title?, pairs:[{a, b}] or left:[], right:[] — mentally match then reveal. Right column is shuffled automatically.',
    render: function(d) {
      var pairs = d.pairs||[];
      // Support left/right format too
      if (!pairs.length && d.left && d.right) {
        var len = Math.min(d.left.length, d.right.length);
        for (var k=0;k<len;k++) pairs.push({a:d.left[k], b:d.right[k]});
      }
      if (!pairs.length) return '';
      // Defensive: extract plain strings from nested objects the AI might generate
      function toStr(v) {
        if (typeof v==='string') return v;
        if (v&&typeof v==='object') return v.text||v.label||v.name||v.desc||v.value||'';
        return String(v||'');
      }
      for (var p=0;p<pairs.length;p++) { pairs[p].a=toStr(pairs[p].a); pairs[p].b=toStr(pairs[p].b); }
      // Shuffle right column so pairs aren't obviously side-by-side
      var rightShuffled = pairs.map(function(x){return x.b;});
      for (var s=rightShuffled.length-1;s>0;s--) { var j=Math.floor(Math.random()*(s+1)); var tmp=rightShuffled[s]; rightShuffled[s]=rightShuffled[j]; rightShuffled[j]=tmp; }
      var h = '<div style="border:2px solid #e2e8f0;border-radius:12px;overflow:hidden;margin:16px 0">';
      h += '<div style="background:#f1f5f9;padding:10px 18px;font-weight:700;color:#1e293b">🔗 '+esc(d.title||'Match the Pairs')+'</div>';
      h += '<div style="padding:14px 18px">';
      h += '<p style="color:#64748b;font-size:13px;margin:0 0 12px">Mentally match each left item to its pair on the right, then reveal to check:</p>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';
      for (var i=0;i<pairs.length;i++) {
        h += '<div style="padding:8px 12px;background:#fafbfc;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;color:#475569">'+esc(pairs[i].a)+'</div>';
        h += '<div style="padding:8px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;color:#475569">'+esc(rightShuffled[i])+'</div>';
      }
      h += '</div>';
      h += '<details><summary style="cursor:pointer;color:#4f46e5;font-weight:600;font-size:13px;list-style:none">✅ Reveal matches</summary>';
      h += '<div style="margin-top:10px;padding:12px 14px;background:#ecfdf5;border-radius:8px;line-height:1.8;color:#065f46">';
      for (var j=0;j<pairs.length;j++) h += '<div style="padding:4px 0">'+(j+1)+'. <strong>'+esc(pairs[j].a)+'</strong> ↔ <strong>'+esc(pairs[j].b)+'</strong></div>';
      h += '</div></details></div></div>';
      return h;
    }
  },
  // ═══════════════════════════════════════════
  // NEW: ENGAGING SOLO-STUDY COMPONENTS (94–101)
  // ═══════════════════════════════════════════
  // ── 94. flip-card ── CSS 3D click-to-flip term card (solo study: key concept drill)
  'flip-card': {
    desc: 'Click-to-flip term card. front, back — single concept drill. Use 1-3 per section for key terms.',
    render: function(d) {
      var cid = 'fc-'+Date.now()+'-'+Math.floor(Math.random()*9999);
      return '<div style="perspective:800px;margin:16px 0">'+
        '<label for="'+cid+'" style="cursor:pointer;display:block">'+
        '<input type="checkbox" id="'+cid+'" style="position:absolute;opacity:0;pointer-events:none">'+
        '<div class="sg-flip-card" style="position:relative;width:100%;min-height:140px;transition:transform 0.6s cubic-bezier(0.4,0,0.2,1);transform-style:preserve-3d">'+
        '<div class="sg-flip-front" style="position:absolute;inset:0;backface-visibility:hidden;background:#eef2ff;border:2px solid #c7d2fe;border-radius:12px;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">'+
        '<div style="font-size:13px;color:#6366f1;margin-bottom:8px;font-weight:600">🧠 KEY CONCEPT</div>'+
        '<div style="font-size:17px;font-weight:700;color:#1e293b">'+esc(d.front||d.q||'')+'</div>'+
        '<div style="font-size:12px;color:#94a3b8;margin-top:10px">👆 Click to reveal</div></div>'+
        '<div class="sg-flip-back" style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg);background:#ecfdf5;border:2px solid #a7f3d0;border-radius:12px;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">'+
        '<div style="font-size:13px;color:#059669;margin-bottom:8px;font-weight:600">💡 ANSWER</div>'+
        '<div style="font-size:16px;color:#1e293b;line-height:1.6">'+esc(d.back||d.a||'')+'</div>'+
        '<div style="font-size:12px;color:#94a3b8;margin-top:10px">👆 Click to flip back</div></div>'+
        '</div></label>'+
        '<style>#'+cid+':checked+.sg-flip-card{transform:rotateY(180deg)}</style></div>';
    }
  },
  // ── 95. progress-ring ── SVG animated circular stat (mastery/section completion visual)
  'progress-ring': {
    desc: 'Animated SVG ring chart. percent:0-100, label?, color?:"#4f46e5", size?:120. Use after completing a topic subsection.',
    render: function(d) {
      var pct = Math.min(100,Math.max(0,parseFloat(d.percent)||0));
      var sz = d.size||120;
      var color = d.color||'#4f46e5';
      var r = (sz/2)-10;
      var circ = 2*Math.PI*r;
      var offset = circ*(1-pct/100);
      var animId = 'pr-'+Date.now();
      return '<div style="text-align:center;margin:20px 0">'+
        '<style>@keyframes '+animId+'{from{stroke-dashoffset:'+circ+'}to{stroke-dashoffset:'+offset+'}}</style>'+
        '<svg width="'+sz+'" height="'+sz+'" style="display:inline-block"><circle cx="'+(sz/2)+'" cy="'+(sz/2)+'" r="'+r+'" fill="none" stroke="#e2e8f0" stroke-width="8"/>'+
        '<circle cx="'+(sz/2)+'" cy="'+(sz/2)+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="8" stroke-linecap="round" stroke-dasharray="'+circ+'" stroke-dashoffset="'+circ+'" style="animation:'+animId+' 1.2s ease-out forwards;transform:rotate(-90deg);transform-origin:'+(sz/2)+'px '+(sz/2)+'px"/>'+
        '<text x="'+(sz/2)+'" y="'+(sz/2)+'" text-anchor="middle" dominant-baseline="central" style="font-family:Georgia,serif;font-size:'+(sz*0.22)+'px;font-weight:800;fill:'+color+'">'+Math.round(pct)+'%</text></svg>'+
        (d.label?'<div style="margin-top:8px;font-weight:600;color:#1e293b;font-size:14px">'+esc(d.label)+'</div>':'')+
        '</div>';
    }
  },
  // ── 96. mind-map ── radial concept map (section summary visual)
  'mind-map': {
    desc: 'Radial concept map. central:{label,icon?}, nodes:[{label,description?,icon?}], color?:"#4f46e5". Perfect for END of a major section — "see how it all connects".',
    render: function(d) {
      var color = d.color||'#4f46e5';
      var nodes = d.nodes||[];
      var h = '<div style="margin:24px 0;text-align:center">';
      // Central node
      h += '<div style="display:inline-block;background:'+color+';color:#fff;border-radius:50%;width:90px;height:90px;line-height:90px;text-align:center;font-weight:700;font-size:14px;margin-bottom:18px;box-shadow:0 4px 16px '+color+'44;position:relative;z-index:2">'+esc(d.central.label||d.central||'')+'</div>';
      // Branch nodes in a responsive grid
      h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;max-width:700px;margin:0 auto">';
      for (var i=0;i<nodes.length;i++) {
        var nd = nodes[i];
        h += '<div class="mind-map-node" style="background:#fff;border:2px solid '+color+'33;border-radius:12px;padding:14px 12px;position:relative;text-align:center;transition:transform 0.2s,box-shadow 0.2s">';
        h += '<div style="font-size:24px;margin-bottom:4px">'+(nd.icon||'•')+'</div>';
        h += '<div style="font-weight:700;color:#1e293b;font-size:14px">'+esc(nd.label||'')+'</div>';
        if (nd.description) h += '<div style="font-size:12px;color:#64748b;margin-top:4px;line-height:1.4">'+esc(nd.description)+'</div>';
        h += '</div>';
      }
      h += '</div>';
      if (d.title) h += '<div style="margin-top:12px;font-size:13px;color:#64748b;font-weight:600">'+esc(d.title)+'</div>';
      return h+'</div>';
    }
  },
  // ── 97. process-flow ── horizontal step flow with arrows (procedures, methods, sequences)
  'process-flow': {
    desc: 'Horizontal process flow with arrows. title?, steps:[{label, description?, icon?}], color?:"#4f46e5". For procedures, methods, lifecycles — clearer than phase-flow.',
    render: function(d) {
      var color = d.color||'#4f46e5';
      var steps = d.steps||[];
      if (!steps.length) return '';
      var h = '<div style="margin:20px 0;overflow-x:auto;padding:8px 0">';
      if (d.title) h += '<div style="text-align:center;font-weight:700;color:#1e293b;margin-bottom:14px;font-size:15px">🔄 '+esc(d.title)+'</div>';
      h += '<div style="display:flex;align-items:flex-start;gap:0;min-width:max-content;justify-content:center">';
      for (var i=0;i<steps.length;i++) {
        var stp = steps[i];
        h += '<div style="flex-shrink:0;text-align:center;width:140px">';
        h += '<div class="process-flow-step" style="background:#fff;border:2px solid '+color+';border-radius:12px;padding:14px 10px;position:relative;box-shadow:0 2px 8px '+color+'18">';
        if (stp.icon) h += '<div style="font-size:24px;margin-bottom:4px">'+esc(stp.icon)+'</div>';
        h += '<div style="font-weight:700;color:'+color+';font-size:13px;margin-bottom:2px">Step '+(i+1)+'</div>';
        h += '<div style="font-weight:600;color:#1e293b;font-size:14px">'+esc(stp.label||'')+'</div>';
        if (stp.description) h += '<div style="font-size:11px;color:#64748b;margin-top:4px;line-height:1.3">'+esc(stp.description)+'</div>';
        h += '</div></div>';
        // Arrow connector (except after last)
        if (i<steps.length-1) {
          h += '<div style="flex-shrink:0;display:flex;align-items:center;padding:0 2px;margin-top:30px">'+
            '<div style="width:24px;height:2px;background:'+color+'55;position:relative">'+
            '<div style="position:absolute;right:-4px;top:-5px;width:0;height:0;border-left:8px solid '+color+';border-top:6px solid transparent;border-bottom:6px solid transparent"></div></div></div>';
        }
      }
      return h+'</div></div>';
    }
  },
  // ── 98. count-up ── animated stat highlight (large number with label, CSS entrance)
  'count-up': {
    desc: 'Animated stat highlight. value, label?, prefix?, suffix?, icon?, color?:"#4f46e5". For impressive numbers — "over 1,200 species..." with animated entrance.',
    render: function(d) {
      var color = d.color||'#4f46e5';
      var animId = 'cu-'+Date.now();
      return '<div class="count-up-box" style="text-align:center;margin:20px 0;padding:24px;background:linear-gradient(135deg,'+color+'08,'+color+'15);border-radius:16px;border:1px solid '+color+'22">'+
        (d.icon?'<div style="font-size:36px;margin-bottom:6px">'+esc(d.icon)+'</div>':'')+
        '<style>@keyframes '+animId+'{0%{opacity:0;transform:scale(0.6)}60%{transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}</style>'+
        '<div style="font-family:Georgia,serif;font-size:42px;font-weight:900;color:'+color+';animation:'+animId+' 0.7s ease-out forwards;line-height:1.1">'+(d.prefix||'')+esc(d.value)+''+(d.suffix||'')+'</div>'+
        (d.label?'<div style="font-size:14px;color:#64748b;margin-top:6px;font-weight:500">'+esc(d.label)+'</div>':'')+
        '</div>';
    }
  },
  // ── 99. typewriter ── animated text reveal (dramatic quote or key insight)
  'typewriter': {
    desc: 'Typewriter text reveal. text, speed?:"medium" (slow|medium|fast). Use ONCE per guide for dramatic impact — key insight or motivational quote.',
    render: function(d) {
      var text = d.text||'';
      var speedMap = {slow:'5s',medium:'3s',fast:'1.5s'};
      var dur = speedMap[d.speed]||'3s';
      var steps = Math.max(20,text.length);
      var animId = 'tw-'+Date.now();
      // Use a wrapper with width animation + overflow hidden + white-space:nowrap + border-right cursor
      return '<div class="typewriter-box" style="text-align:center;margin:24px 0;padding:20px;background:#1e293b;color:#f1f5f9;border-radius:12px">'+
        '<style>@keyframes '+animId+'{from{width:0}to{width:100%}}@keyframes tw-blink-'+animId+'{0%,100%{border-color:transparent}50%{border-color:#f1f5f9}}</style>'+
        '<div style="display:inline-block;overflow:hidden;white-space:nowrap;border-right:3px solid #f1f5f9;max-width:100%;animation:'+animId+' '+dur+' steps('+steps+') forwards,tw-blink-'+animId+' 0.7s step-end 5;font-family:Georgia,serif;font-size:17px;line-height:1.6;letter-spacing:0.02em">'+
        esc(text)+'</div>'+
        '<div style="margin-top:10px;font-size:12px;color:#94a3b8">⌨️ '+esc(d.label||'Key Insight')+'</div>'+
        '</div>';
    }
  },
  // ── 100. slider-compare ── side-by-side comparison (before/after, A vs B)
  'slider-compare': {
    desc: 'Side-by-side concept comparison. leftTitle?, leftContent, rightTitle?, rightContent, leftColor?:"#fef2f2", rightColor?:"#ecfdf5". For before/after, two approaches, then vs now.',
    render: function(d) {
      var leftC = d.leftColor||'#fef2f2';
      var rightC = d.rightColor||'#ecfdf5';
      var leftBorder = d.leftColor?'#fecaca':'#e2e8f0';
      var rightBorder = d.rightColor?'#a7f3d0':'#e2e8f0';
      return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0">'+
        '<div class="slider-compare-panel" style="background:'+leftC+';border:2px solid '+leftBorder+';border-radius:12px;padding:18px">'+
        '<div style="font-weight:700;color:#dc2626;margin-bottom:10px;font-size:14px">⬅ '+esc(d.leftTitle||'Before')+'</div>'+
        '<div style="color:#475569;font-size:14px;line-height:1.7">'+esc(d.leftContent||'')+'</div></div>'+
        '<div class="slider-compare-panel" style="background:'+rightC+';border:2px solid '+rightBorder+';border-radius:12px;padding:18px">'+
        '<div style="font-weight:700;color:#059669;margin-bottom:10px;font-size:14px">'+esc(d.rightTitle||'After')+' ➡</div>'+
        '<div style="color:#475569;font-size:14px;line-height:1.7">'+esc(d.rightContent||'')+'</div></div></div>';
    }
  },
  // ── 101. hierarchy-tree ── CSS tree/organizational chart (classification, taxonomy)
  'hierarchy-tree': {
    desc: 'Hierarchy tree diagram. title?, root:{label,icon?}, children:[{label,children:[...]?,icon?}], color?:"#4f46e5". For taxonomy, org structures, classification.',
    render: function(d) {
      var color = d.color||'#4f46e5';
      function renderNode(node, depth) {
        var h = '<div style="text-align:center">';
        h += '<div class="hierarchy-node" style="display:inline-block;background:#fff;border:2px solid '+color+';border-radius:10px;padding:10px 16px;font-weight:600;font-size:13px;color:#1e293b;white-space:nowrap;box-shadow:0 1px 4px '+color+'18">';
        if (node.icon) h += '<span style="margin-right:4px">'+esc(node.icon)+'</span>';
        h += esc(node.label||'');
        h += '</div></div>';
        if (node.children && node.children.length) {
          // Connector line
          h += '<div style="height:18px;border-left:2px solid '+color+'55;margin:0 auto;width:0"></div>';
          h += '<div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;position:relative">';
          // Horizontal connector bar
          h += '<div style="position:absolute;top:0;left:15%;right:15%;height:2px;background:'+color+'55"></div>';
          for (var j=0;j<node.children.length;j++) {
            h += '<div style="position:relative;padding-top:8px">';
            h += '<div style="height:10px;border-left:2px solid '+color+'55;margin:0 auto;width:0"></div>';
            h += renderNode(node.children[j],depth+1);
            h += '</div>';
          }
          h += '</div>';
        }
        return h;
      }
      var h = '<div style="margin:20px 0;overflow-x:auto;padding:10px 0">';
      if (d.title) h += '<div style="text-align:center;font-weight:700;color:#1e293b;margin-bottom:14px;font-size:15px">🌳 '+esc(d.title)+'</div>';
      h += renderNode(d.root||{label:d.label||'Root'},0);
      return h+'</div>';
    }
  }
};

// ── Backward-compat aliases (old names → new names) ──
STUDY_COMPONENTS['poll'] = STUDY_COMPONENTS['stat-chart'];
STUDY_COMPONENTS['debate'] = STUDY_COMPONENTS['perspectives'];
STUDY_COMPONENTS['leaderboard'] = STUDY_COMPONENTS['ranked-list'];

/** Render a components array into full study HTML */
function renderComponentsToHtml(components) {
  if (!components || !components.length) return '';
  var h = '<div class="study-guide">';
  for (var i = 0; i < components.length; i++) {
    var comp = components[i];
    var renderer = STUDY_COMPONENTS[comp.type || comp.component];
    if (renderer) h += renderer.render(comp.data || comp);
  }
  return h + '</div>';
}

/** Render study content for preview: component-based format or raw content fallback */
function getStudyHtmlForPreview() {
  if (editingStudyHtmlData && editingStudyHtmlData.components) {
    return renderComponentsToHtml(editingStudyHtmlData.components);
  }
  return editingHtmlCode || '';
}

/* ── YouTube ID extraction ── */
function extractYouTubeId(url) {
  if (!url) return null;
  url = url.trim().replace(/&amp;/g, '&');
  var m = url.match(/(?:youtu\.be\/|embed\/|[?&]v=)([a-zA-Z0-9_-]{8,15})(?:[?\/\#&]|$)/);
  return m ? m[1] : null;
}

/** Extract a human-readable name from a file URL */
function readableFileName(url) {
  if (!url) return 'Unknown';
  try {
    var decoded = decodeURIComponent(url);
    var pathPart = decoded.split('?')[0];
    var segments = pathPart.split('/');
    var meaningful = [];
    for (var s = segments.length - 1; s >= 0 && meaningful.length < 3; s--) {
      var seg = segments[s];
      if (seg === 'o' || seg === '' || seg.length > 100) continue;
      meaningful.unshift(seg);
    }
    return meaningful.join('/') || (segments[segments.length - 1] || url);
  } catch(e) {
    return url.substring(url.lastIndexOf('/')+1) || url;
  }
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

/** Build the Media column for a lesson row: labeled icon chips with a count
 *  badge on the icon's edge, so it's easy to see exactly what is inside. */
function buildMediaSummary(les) {
  var chips = [];
  function chip(icon, count, label) {
    var badge = (count === null || count === undefined) ? '' : '<span class="media-chip-badge">' + count + '</span>';
    return '<span class="media-chip" title="' + label + (count ? ': ' + count : '') + '">' +
      '<span class="media-chip-icon">' + icon + badge + '</span>' +
      '<span class="media-chip-label">' + label + '</span></span>';
  }
  var videoCount = (les.youtubeUrls && Array.isArray(les.youtubeUrls)) ? les.youtubeUrls.length : 0;
  if (videoCount > 0) chips.push(chip('🎬', videoCount, 'Videos'));
  var presCount = countList(les.presentationPdfUrls);
  if (presCount > 0) chips.push(chip('📊', presCount, 'Slides'));
  var studyCount = countList(les.studyDocPdfUrls);
  if (studyCount > 0) chips.push(chip('📖', studyCount, 'Docs'));
  var wsCount = countList(les.worksheetPdfUrls);
  if (wsCount > 0) chips.push(chip('📝', wsCount, 'Sheets'));
  var akCount = countList(les.answerKeyPdfUrls);
  if (akCount > 0) chips.push(chip('🔑', akCount, 'Keys'));
  var hdCount = countList(les.htmlDocUrls);
  if (hdCount > 0) chips.push(chip('🌐', hdCount, 'Web'));
  if (les.hasStudyContent || hasLessonStudyContent(les)) chips.push(chip('🧠', null, 'Study'));
  if (les.hasPresentation || (les.presentationHtml && String(les.presentationHtml).length > 20)) chips.push(chip('🎞️', null, 'Pres.'));
  var fcCount = les.flashcardCount || countFlashcards(les.flashcards);
  if (fcCount > 0) chips.push(chip('🃏', fcCount, 'Cards'));
  if (les.hasNotes || hasLessonNotes(les)) chips.push(chip('📄', null, 'Notes'));
  var srcCount = les.sourceUrlCount || countList(les.sourceUrls);
  if (srcCount > 0) chips.push(chip('🔗', srcCount, 'Links'));
  return chips.length ? chips.join('') : '—';
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
  // One-time per page load: move legacy heavy content out of the main doc
  // into lesson docs (fixes the Firestore 1MB limit error on the main doc),
  // then backfill list summary counts for lessons stripped before summary
  // fields existed (they have no quizCount in the main doc).
  setTimeout(function() {
    migrateLessonsToDocsIfNeeded();
    setTimeout(function() { backfillLessonSummariesIfNeeded(); }, 800);
  }, 50);
}

/** Ask the parent form to commit the record to Firestore now (if the CMS
 *  supports it via the allowRequestSave field setting). Silent otherwise. */
function requestParentSave() {
  try {
    if (typeof tool.requestSave === 'function') {
      tool.requestSave(function(err, ok) {
        if (err || !ok) console.warn('requestSave rejected:', err || 'denied');
      });
    }
  } catch(e) {}
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
  requestParentSave();  // immediate Firestore commit when the CMS allows it
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
            var media = buildMediaSummary(les);
            var quizCount = les.quizCount || countQuizQuestions(les.quiz);
            var quizIndicator = quizCount > 0 ? '✅ ' + quizCount + ' Q' : '—';
            var docLinkBtn = (isDeveloper() && les.lessonDocId) ? '<button class="btn btn-sm" data-open-doc="' + esc(les.lessonDocId) + '" title="Open lesson Firestore document in new tab" style="padding:2px 8px;font-size:11px;border:1px solid #c4b5fd;border-radius:4px;background:#f5f3ff;color:#7c3aed;cursor:pointer;font-family:inherit">📄</button>' : '';
            return '<tr><td>'+(li+1)+'</td><td><strong>'+esc(les.title||'Untitled')+'</strong> ' + docLinkBtn + '</td><td>'+(les.estimatedMinutes||'—')+'</td><td>'+media+'</td><td>'+quizIndicator+'</td>' +
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
    // Bind open lesson doc buttons
    var docBtns = container.querySelectorAll('[data-open-doc]');
    for (var n = 0; n < docBtns.length; n++) {
      docBtns[n].addEventListener('click', function(e) {
        e.stopPropagation();
        openLessonDocUrl(this.getAttribute('data-open-doc'));
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
            ((les.quizCount || countQuizQuestions(les.quiz)) > 0 ? ' · 📝 ' + (les.quizCount || countQuizQuestions(les.quiz)) + ' Q' : '') +
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
  editingHiddenDocUrls = [];
  editingFlashcards = [];
  editingPdfIdx = null; editingPdfType = null;
  renderPdfEditorList('presentation'); renderPdfEditorList('studyDoc'); renderPdfEditorList('worksheet'); renderPdfEditorList('answerKey'); renderPdfEditorList('htmlDoc');
  hideSubModal('pdf-editor-panel');
  renderFlashcardsEditorList();
  editingHtmlCode = '';
  editingStudyHtmlData = null;
  editingPresentationHtml = '';
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
  updateAllVisToggles();
  updateLessonEditorDocLink(null);  // clear doc link for new lesson
  el('lesson-editor-heading').textContent = 'Add Lesson';
}

/** Populate the lesson editor fields from a lesson data object */
function populateEditorFromLesson(les) {
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
  var fcVal = les.flashcards;
  if (fcVal && typeof fcVal === 'string') { try { fcVal = JSON.parse(fcVal); } catch(e) { fcVal = null; } }
  editingFlashcards = (fcVal && Array.isArray(fcVal)) ? JSON.parse(JSON.stringify(fcVal)) : [];
  renderFlashcardsEditorList();
  editingHtmlCode = les.htmlCode || '';
  editingStudyHtmlData = les.studyHtmlData || null;
  editingPresentationHtml = les.presentationHtml || '';
  editingHiddenSections = (les.hiddenSections && Array.isArray(les.hiddenSections)) ? JSON.parse(JSON.stringify(les.hiddenSections)) : [];
  updateAllVisToggles();
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
  // Show lesson doc link if available
  updateLessonEditorDocLink(les);
}

function editLesson(idx) {
  editingLessonIdx = idx;
  var les = editingLessons[idx];
  if (!les) return;
  // Phase 1: try to load heavy content from lesson doc, fall back to main doc
  loadLessonDoc(les, function(err, enrichedLes) {
    populateEditorFromLesson(enrichedLes || les);
  });
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
    hiddenDocUrls: editingHiddenDocUrls.length > 0 ? JSON.parse(JSON.stringify(editingHiddenDocUrls)) : null,
    htmlCode: editingHtmlCode || null,
    studyHtmlData: editingStudyHtmlData || null,
    presentationHtml: editingPresentationHtml || null,
    hiddenSections: editingHiddenSections.length > 0 ? JSON.parse(JSON.stringify(editingHiddenSections)) : null,
    flashcards: editingFlashcards.length > 0 ? JSON.parse(JSON.stringify(editingFlashcards)) : null,
    sourceUrls: editingSourceLinks.length > 0 ? JSON.parse(JSON.stringify(editingSourceLinks)) : null,
    quiz: editingQuizQuestions.length > 0 ? JSON.parse(JSON.stringify(editingQuizQuestions)) : null,
    lessonDocId: null  // populated by saveLessonDoc below
  };

  // Direct mode: save to sections[editingDirectSectionIdx].lessons and persist immediately
  if (editingDirectSectionIdx !== null) {
    var sec = sections[editingDirectSectionIdx];
    if (!sec.lessons) sec.lessons = [];
    if (editingLessonIdx !== null && sec.lessons[editingLessonIdx]) {
      lessonData.id = sec.lessons[editingLessonIdx].id;
      lessonData.lessonDocId = sec.lessons[editingLessonIdx].lessonDocId || null;
    }
    var savedSectionIdx = editingDirectSectionIdx;  // capture before clearing
    var savedLessonId = lessonData.id;
    // Place the lesson in the section immediately (heavy for now — the lesson
    // doc sync below strips it from the main doc once the copy is confirmed).
    sec.lessons = sec.lessons.filter(function(l) { return l.id !== savedLessonId; });
    sec.lessons.push(lessonData);
    hideSubModal('lesson-editor-panel');
    editingDirectSectionIdx = null;

    if (!canUseLessonDocs()) {
      saveCurriculum();
      tool.notify('⚠️ Lesson doc storage unavailable — lesson content stays in the main document.', 'warning');
      tool.notify('Lesson saved! ✅', 'success');
      return;
    }

    saveLessonDoc(lessonData, function(docErr, docId) {
      if (docId) lessonData.lessonDocId = docId;
      if (docErr) {
        // Keep heavy content in the main doc as fallback (already there).
        tool.notify('⚠️ Lesson doc save failed — lesson content stays in the main document.', 'warning');
      } else {
        // Heavy content is now safe in the lesson doc — strip it from the main doc.
        stripHeavyLessonFields(lessonData);
      }
      // Ensure the lesson is present in the CURRENT sections array
      // (onValueChange may have replaced `sections` during the async call).
      var secNow = sections[savedSectionIdx];
      if (secNow) {
        if (!secNow.lessons) secNow.lessons = [];
        var found = false;
        for (var f = 0; f < secNow.lessons.length; f++) {
          if (secNow.lessons[f].id === savedLessonId) { found = true; break; }
        }
        if (!found) secNow.lessons.push(lessonData);
      }
      saveCurriculum();
      tool.notify('Lesson saved! ✅', 'success');
    });
    return;
  }

  // Modal mode: save to editingLessons temp array
  if (editingLessonIdx !== null && editingLessons[editingLessonIdx]) {
    lessonData.id = editingLessons[editingLessonIdx].id;
    lessonData.lessonDocId = editingLessons[editingLessonIdx].lessonDocId || null;
    editingLessons[editingLessonIdx] = lessonData;
  } else {
    editingLessons.push(lessonData);
  }

  hideSubModal('lesson-editor-panel');
  renderLessonsEditorList();

  if (!canUseLessonDocs()) {
    tool.notify('⚠️ Lesson doc storage unavailable — lesson content stays in the main document.', 'warning');
    tool.notify('Lesson saved! ✅', 'success');
    return;
  }

  // Mirror heavy content to the lesson doc; once confirmed, strip it from
  // the main-doc copy so the main curriculum document stays under 1MB.
  saveLessonDoc(lessonData, function(docErr, docId) {
    if (docId) lessonData.lessonDocId = docId;
    if (docErr) {
      tool.notify('⚠️ Lesson doc save failed — lesson content stays in the main document.', 'warning');
    } else {
      stripHeavyLessonFields(lessonData);
      renderLessonsEditorList();
    }
  });
  tool.notify('Lesson saved! ✅', 'success');
}

function cancelLessonEditor() {
  hideSubModal('lesson-editor-panel');
  editingDirectSectionIdx = null;
}

/** Update ALL per-tab visibility toggle buttons */
function updateAllVisToggles() {
  // Map of vis-key to whether there's content for that section
  var statusMap = {
    'presentation': !!editingPresentationHtml,
    'studyContent': !!(editingHtmlCode || editingStudyHtmlData),
    'flashcards': editingFlashcards.length > 0,
    'questions': editingQuizQuestions.length > 0,
    'videos': editingYoutubeUrls.length > 0,
    'slides': editingPresentationPdfUrls.length > 0,
    'studyDocs': editingStudyDocPdfUrls.length > 0,
    'worksheets': editingWorksheetPdfUrls.length > 0,
    'answerKeys': editingAnswerKeyPdfUrls.length > 0,
    'webDocs': editingHtmlDocUrls.length > 0,
    'notes': !!(typeof getHtmlContent === 'function' && getHtmlContent())
  };

  var toggles = document.querySelectorAll('.vis-tab-toggle');
  for (var i = 0; i < toggles.length; i++) {
    var btn = toggles[i];
    var key = btn.getAttribute('data-vis-key');
    var isHidden = editingHiddenSections.indexOf(key) !== -1;
    var hasContent = statusMap[key] || false;
    btn.innerHTML = isHidden ? '🙈 Hidden' : '👁️ Visible';
    btn.style.opacity = hasContent ? '1' : '0.45';
    btn.style.background = isHidden ? '#fee2e2' : '#fff';
    btn.style.borderColor = isHidden ? '#fca5a5' : 'var(--border)';
    btn.style.color = isHidden ? '#991b1b' : 'inherit';
  }
}

/** Toggle a single section's visibility */

/** Auto-save the current lesson state to CMS without closing the editor.
 *  Called after AI generation (quiz, flashcards, study content) and flashcard edits.
 *  If this is a new (unsaved) lesson, it creates the lesson first. */
function autoSaveCurrentLesson() {
  if (tool.isReadOnly()) return;
  // Determine which lesson and where it lives
  var targetLesson = null;
  var targetArray = null;
  if (editingDirectSectionIdx !== null) {
    var sec = sections[editingDirectSectionIdx];
    if (!sec) return;
    if (!sec.lessons) sec.lessons = [];
    targetArray = sec.lessons;
  } else if (editingSectionIdx !== null) {
    targetArray = editingLessons;
  }
  if (!targetArray) return;

  // If this is a new lesson (no idx yet), create it in the array
  if (editingLessonIdx === null) {
    var title = el('edit-lesson-title').value.trim() || 'Untitled Lesson';
    var order = parseInt(el('edit-lesson-order').value) || targetArray.length + 1;
    var minutes = parseInt(el('edit-lesson-minutes').value) || 0;
    var newLesson = {
      id: genId(),
      title: title,
      order: order,
      estimatedMinutes: minutes,
      content: getHtmlContent() || null
    };
    targetArray.push(newLesson);
    editingLessonIdx = targetArray.length - 1;
  }

  targetLesson = targetArray[editingLessonIdx];
  if (!targetLesson) return;

  // Sync current editor state into the lesson object
  targetLesson.htmlCode = editingHtmlCode || null;
  targetLesson.studyHtmlData = editingStudyHtmlData || null;
  targetLesson.presentationHtml = editingPresentationHtml || null;
  targetLesson.flashcards = editingFlashcards.length > 0 ? JSON.parse(JSON.stringify(editingFlashcards)) : null;
  targetLesson.quiz = editingQuizQuestions.length > 0 ? JSON.parse(JSON.stringify(editingQuizQuestions)) : null;
  targetLesson.sourceUrls = editingSourceLinks.length > 0 ? JSON.parse(JSON.stringify(editingSourceLinks)) : null;
  targetLesson.hiddenSections = editingHiddenSections.length > 0 ? JSON.parse(JSON.stringify(editingHiddenSections)) : null;
  // Also sync content (rich text) and pdf urls to keep lesson doc complete
  targetLesson.content = getHtmlContent() || null;
  targetLesson.youtubeUrls = editingYoutubeUrls.length > 0 ? JSON.parse(JSON.stringify(editingYoutubeUrls)) : null;
  targetLesson.presentationPdfUrls = editingPresentationPdfUrls.length > 0 ? JSON.parse(JSON.stringify(editingPresentationPdfUrls)) : null;
  targetLesson.studyDocPdfUrls = editingStudyDocPdfUrls.length > 0 ? JSON.parse(JSON.stringify(editingStudyDocPdfUrls)) : null;
  targetLesson.worksheetPdfUrls = editingWorksheetPdfUrls.length > 0 ? JSON.parse(JSON.stringify(editingWorksheetPdfUrls)) : null;
  targetLesson.answerKeyPdfUrls = editingAnswerKeyPdfUrls.length > 0 ? JSON.parse(JSON.stringify(editingAnswerKeyPdfUrls)) : null;
  targetLesson.htmlDocUrls = editingHtmlDocUrls.length > 0 ? JSON.parse(JSON.stringify(editingHtmlDocUrls)) : null;
  targetLesson.hiddenDocUrls = editingHiddenDocUrls.length > 0 ? JSON.parse(JSON.stringify(editingHiddenDocUrls)) : null;

  // Mirror heavy content to the lesson doc, then strip it from the main-doc
  // copy so the main curriculum document never approaches the 1MB Firestore
  // limit. If lesson docs are unavailable or the write fails, the heavy
  // content stays in the main document as a fallback.
  if (!canUseLessonDocs()) {
    tool.reportValid(true, '');
    tool.setValue(JSON.parse(JSON.stringify({ sections: sections })));
    requestParentSave();
    updateAllVisToggles();
    return;
  }
  var autoSaveLessonId = targetLesson.id;
  saveLessonDoc(targetLesson, function(docErr, docId) {
    if (docId && !targetLesson.lessonDocId) {
      targetLesson.lessonDocId = docId;
      // Update the lessonDocId on the CURRENT sections copy too
      for (var si = 0; si < sections.length; si++) {
        var slessons = sections[si].lessons;
        if (!slessons) continue;
        for (var li = 0; li < slessons.length; li++) {
          if (slessons[li].id === autoSaveLessonId) {
            slessons[li].lessonDocId = docId;
            break;
          }
        }
      }
    }
    if (docErr) {
      console.warn('autoSaveCurrentLesson: lesson doc save failed, heavy content kept in main doc:', docErr);
    } else {
      stripHeavyLessonFields(targetLesson);
    }
    tool.reportValid(true, '');
    tool.setValue(JSON.parse(JSON.stringify({ sections: sections })));
    requestParentSave();
    updateAllVisToggles();
  });
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
  editingHiddenDocUrls = [];
  editingPdfIdx = null; editingPdfType = null;
  renderPdfEditorList('presentation'); renderPdfEditorList('studyDoc'); renderPdfEditorList('worksheet'); renderPdfEditorList('answerKey'); renderPdfEditorList('htmlDoc');
  hideSubModal('pdf-editor-panel');
  renderFlashcardsEditorList();
  editingHtmlCode = '';
  editingStudyHtmlData = null;
  editingPresentationHtml = '';
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
  updateAllVisToggles();
  updateLessonEditorDocLink(null);  // clear doc link for new lesson
  el('lesson-editor-heading').textContent = 'Add Lesson to ' + (sections[sectionIdx].title || 'Section');
}

function editLessonDirect(sectionIdx, lessonIdx) {
  editingDirectSectionIdx = sectionIdx;
  editingLessonIdx = lessonIdx;
  var sec = sections[sectionIdx];
  var les = sec.lessons && sec.lessons[lessonIdx];
  if (!les) return;
  // Phase 1: try to load heavy content from lesson doc, fall back to main doc
  loadLessonDoc(les, function(err, enrichedLes) {
    populateEditorFromLesson(enrichedLes || les);
  });
}

function deleteLessonDirect(sectionIdx, lessonIdx) {
  var sec = sections[sectionIdx];
  var les = sec.lessons && sec.lessons[lessonIdx];
  var name = les ? (les.title || 'this lesson') : 'this lesson';
  var docId = les ? les.lessonDocId : null;
  sandboxConfirm('Delete "' + name + '" from "' + (sec.title || 'Section') + '"? This cannot be undone.', function() {
    if (sec.lessons) sec.lessons.splice(lessonIdx, 1);
    saveCurriculum(function(err) {
      if (err) return;
      // Phase 1: also delete the lesson doc
      if (docId) deleteLessonDoc(docId);
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
  // Role-based: hide Code sub-tab in Study Content for non-admin users
  if (tabName === 'studyHtml') updateStudyHtmlTabRoles();
  if (tabName === 'presentation') updatePresentationPreview();
  if (tabName === 'flashcards') renderFlashcardsEditorList();
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
  htmlDoc: { icon: '🌐', label: 'Web Documents' }
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
      var isHidden = editingHiddenDocUrls.indexOf(url) !== -1;
      var displayName = readableFileName(url);
      return '<div class="source-link-editor-item"><div class="source-link-editor-item-info"><div class="source-link-editor-item-title">📎 ' + esc(displayName) + (isHidden ? ' <span style="color:var(--text-muted);font-size:11px;font-weight:400">(hidden)</span>' : '') + '</div><div class="source-link-editor-item-meta" title="' + esc(url) + '">' + esc(url.substring(0, 80) + (url.length > 80 ? '…' : '')) + '</div></div><div class="source-link-editor-item-actions"><button class="btn btn-sm doc-vis-toggle' + (isHidden ? ' doc-vis-hidden' : '') + '" data-vis-pdf="' + type + ':' + idx + '" title="' + (isHidden ? 'Show to students' : 'Hide from students') + '">' + (isHidden ? '👁‍🗨' : '👁') + '</button><button class="btn btn-sm btn-outline" data-edit-pdf="' + type + ':' + idx + '">✏️</button><button class="btn btn-sm btn-danger" data-del-pdf="' + type + ':' + idx + '">🗑</button></div></div>';
    }).join('');
    // Wire visibility toggles
    var visBtns = list.querySelectorAll('[data-vis-pdf]');
    for (var k = 0; k < visBtns.length; k++) {
      visBtns[k].addEventListener('click', function(e) {
        e.stopPropagation();
        var parts = this.getAttribute('data-vis-pdf').split(':');
        var t = parts[0];
        var i = parseInt(parts[1]);
        var u = getPdfArray(t)[i];
        var hidx = editingHiddenDocUrls.indexOf(u);
        if (hidx === -1) {
          editingHiddenDocUrls.push(u);
        } else {
          editingHiddenDocUrls.splice(hidx, 1);
        }
        renderPdfEditorList(t);
      });
    }
    var editBtns = list.querySelectorAll('[data-edit-pdf]');
    for (var i = 0; i < editBtns.length; i++) {
      editBtns[i].addEventListener('click', function(e) { e.stopPropagation(); var parts = this.getAttribute('data-edit-pdf').split(':'); openPdfEditor(parts[0], parseInt(parts[1])); });
    }
    var delBtns = list.querySelectorAll('[data-del-pdf]');
    for (var j = 0; j < delBtns.length; j++) {
      delBtns[j].addEventListener('click', function(e) { e.stopPropagation(); var parts = this.getAttribute('data-del-pdf').split(':'); var t = parts[0]; var i = parseInt(parts[1]); var arr = getPdfArray(t); var u = arr[i]; arr.splice(i, 1);
        // Also remove from hidden list when deleted
        var hidx = editingHiddenDocUrls.indexOf(u);
        if (hidx !== -1) editingHiddenDocUrls.splice(hidx, 1);
        renderPdfEditorList(t); });
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
  if (labelEl) labelEl.innerHTML = (isHtml ? 'Web Document URL' : 'PDF URL') + ' <span class="required">*</span>';
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
    updateGenerateButtons({ text: '⏳ Generating...' });

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
          autoSaveCurrentLesson();
          var msg = '✅ Generated ' + questions.length + ' questions & auto-saved!';
          if (questions.length < 15) msg += ' Generated fewer than 15 — you can add more manually.';
          tool.notify(msg, 'success');
        } catch(e) {
          tool.notify('Response could not be parsed. See console.', 'error');
          console.error('Quiz gen parse error:', e, 'Raw:', fullResponse);
        }
      },
      onError: function(err) {
        updateGenerateButtons({ disabled: false, text: '🤖 Generate Quiz Questions from PDFs' });
        tool.notify('Generation failed: ' + err, 'error');
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
tool.notify('Reading ' + allUrls.length + ' PDF(s) for study content generation...', 'info');

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
            if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🤖 Generate from PDFs'; }
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
    if (genBtn) genBtn.textContent = '⏳ Generating content...';

    var prompt = 'You are an expert educational content designer. Compose a rich study guide using COMPONENTS from the library below. Return ONLY a JSON object.\n\n' +
      'COMPONENT LIBRARY (101 types — Grade 1 to professional, pick freely):\n' +
      'STRUCTURAL (5):\n' +
      '1. "accordion" {items:[{title, content, icon?, open?}]}\n' +
      '2. "separator" {label?}\n' +
      '3. "columns-2" {left, right, leftWidth?, rightWidth?}\n' +
      '4. "heading" {text, icon?, level:"section"|"subsection"}\n' +
      '5. "reading-time" {minutes, label?, badgeText?}\n' +
      'READING — use "paragraph" for 60-70% of all content (study guide first, components enhance):\n' +
      '6. "paragraph" — regular reading {text, variant:"normal"|"lead"|"small"|"muted"} ← USE HEAVILY\n' +
      'HERO & EMPHASIS (8):\n' +
      '7. "intro-hero" {icon, heading, description, objectives:[...]}\n' +
      '8. "highlight-box" {variant:"idea"|"important"|"discover"|"challenge", title?, body}\n' +
      '9. "callout" {variant:"info"|"tip"|"key"|"warn", title?, body}\n' +
      '10. "quote" {text, attribution?, icon?}\n' +
      '11. "difficulty-meter" {level:"beginner"|"intermediate"|"advanced"|"expert", label?}\n' +
      '12. "star-award" {title, subtitle?, stars:1-5, icon?}\n' +
      '13. "encouragement" {message, variant:"cheer"|"persist"|"celebrate"|"believe"}\n' +
      '14. "character-guide" {character, emoji?, message, variant:"kid"|"teacher"|"expert"|"coach"}\n' +
      'ENGAGEMENT & DEEP LEARNING (12):\n' +
      '15. "curiosity-hook" — spark interest {hook, reveal?, icon?}\n' +
      '16. "myth-buster" — correct misconceptions {myth, reality, explanation?}\n' +
      '17. "imagine" — put student in scenario {scenario, question?, reflection?}\n' +
      '18. "insight" — crystallize key takeaway {insight, title?}\n' +
      '19. "rule-of-thumb" — memorable heuristic {rule, context?}\n' +
      '20. "contrast" — don\'t confuse X with Y {a:{label,desc}, b:{label,desc}}\n' +
      '21. "common-question" — FAQ {question, answer}\n' +
      '22. "pause-point" — comprehension checkpoint {checks:[strings]}\n' +
      '23. "joke" — humor (ONLY light subjects — NEVER law/medicine/safety) {joke, punchline?}\n' +
      '24. "speed-run" — 30-second recap {title?, points:[]}\n' +
      '25. "expert-voice" — practitioner quote {quote, expertName, expertRole?}\n' +
      '26. "visual-metaphor" — concept→metaphor {concept, metaphor, explanation?}\n' +
      '27. "spotlight" — animated pulsing highlight {text, icon?, color?} — draws attention\n' +
      'INTERACTIVE REVEAL (4) — "think first, then check" pattern (no voting, no competition):\n' +
      '28. "reveal" — generic click-to-reveal {teaser, content, icon?}\n' +
      '29. "ordered-list" — mentally sort then reveal correct order {title?, items:[scrambled], correctOrder?:[correct]}\n' +
      '30. "match" — match pairs then reveal {title?, pairs:[{a,b}] or left:[],right:[]}\n' +
      '31. "fill-blank" — type answers then reveal {items:[{prompt, answer, hint?}]} — student types in <input>, then checks\n' +
      'STATISTICS DISPLAY (1) — data visualization, not interactive voting:\n' +
      '32. "stat-chart" — bar chart of survey/statistics data {title?, options:[{label, value}]} — display-only, use for real-world data\n' +
      'DATA & STATS (12):\n' +
      '33. "fact-grid" {cols, items:[{label,value}]}\n' +
      '34. "key-numbers" {items:[{value,unit?,label}]}\n' +
      '35. "stat-row" {items:[{emoji?,value,label}]}\n' +
      '36. "weight-bar" {segments:[{range,label,rule?,color}]}\n' +
      '37. "data-table" {columns:[{key,header}],rows:[{key:value}]}\n' +
      '38. "formula" {formula,caption?,variant:"highlight"|"basic"}\n' +
      '39. "swot" {strengths:[],weaknesses:[],opportunities:[],threats:[]}\n' +
      '40. "pyramid" — hierarchy levels bottom→top {levels:[{label,description?,color?}]}. USE for ANY layered/hierarchical concept — legal systems, Maslow, food chains, org levels. When you WRITE "imagine a pyramid", you MUST add this component.\n' +
      '41. "concept-map" {central,nodes:[{label,description?,icon?}],color?}\n' +
      '42. "progress-tracker" {percent,label?,steps:[{label,done?}]}\n' +
      '43. "metric-card" {value,label,trend:"up"|"down"|"flat",delta?,icon?}\n' +
      '44. "dashboard-grid" {title?,cards:[{value,label,trend?,delta?,icon?}],cols}\n' +
      'CHARTS (10):\n' +
      '45. "bar-chart" {title?,items:[{label,value,color?}],showValues?}\n' +
      '46. "pie-chart" {title?,segments:[{label,value,color?}],donut?:true,size?,showLegend?}\n' +
      '47. "gauge" {value,min?,max,label?,colorScheme?,size?}\n' +
      '48. "funnel" {title?,stages:[{label,value,color?}]}\n' +
      '49. "leaderboard" {title?,items:[{label,value,highlight?}],medals?:true}\n' +
      '50. "heatmap" {title?,rowLabels?,colLabels?,cells:[[value]],lowColor?,highColor?}\n' +
      '51. "venn-diagram" {title?,sets:[{label,size?,color?}],intersections?}\n' +
      '52. "bullet-chart" {value,target,max,label?,color?}\n' +
      '53. "sparkline" {values:[],color?,height?,highlightMax?,label?}\n' +
      '54. "waterfall" {title?,items:[{label,value,isTotal?}],colorUp?,colorDown?}\n' +
      'COMPARISON (8):\n' +
      '55. "pros-cons" {prosTitle?,pros:[],consTitle?,cons:[]}\n' +
      '56. "comparison" {aLabel,bLabel,rows:[{dimension,a,b}]}\n' +
      '57. "definition-list" {title?,terms:[{term,definition}]}\n' +
      '58. "memory-box" {title?,rows:[{key,value}]}\n' +
      '59. "summary-box" {title?,body?,points:[]}\n' +
      '60. "before-after" {beforeTitle?,beforeBody,afterTitle?,afterBody}\n' +
      '61. "perspectives" {topic,viewA:{label,points:[]},viewB:{label,points:[]}} — two views for student to consider, NOT classroom debate\n' +
      '62. "analogy" {concept,analogy,explanation?}\n' +
      'FLOW (3):\n' +
      '63. "phase-flow" {phases:[{name,description,emoji?,color}]}\n' +
      '64. "timeline" {events:[{date,title,description?,icon?}]}\n' +
      '65. "steps" {title?,steps:[{title?,description,icon?}]}\n' +
      'CARDS & GRIDS (5):\n' +
      '66. "icon-grid" {cols,items:[{emoji,name,subtitle?,highlight?}]}\n' +
      '67. "card-grid" {cols,items:[{emoji?,name,tag?,description?,detail}]}\n' +
      '68. "gallery" {cols,images:[{url,caption?,alt?}]}\n' +
      '69. "resource-links" {title?,links:[{label,url,description?,type}]}\n' +
      '70. "info-card" {icon?, title, body, variant:"default"|"definition"|"reference"|"example"}\n' +
      'INSTRUCTIONAL (14):\n' +
      '71. "worked-example" {problem,steps:[],answer,note?}\n' +
      '72. "scenario" {context,question,debrief}\n' +
      '73. "prerequisites" {title?,body?,items:[]}\n' +
      '74. "checklist" {title?,items:[{text,checked?}]}\n' +
      '75. "common-mistake" {title?,mistake,correct?,explanation?}\n' +
      '76. "exam-hint" {title?,tips:[],body?}\n' +
      '77. "real-world" {title?,example,body?}\n' +
      '78. "study-tip" {title?,tip,method?}\n' +
      '79. "did-you-know" {fact,icon?,title?,source?}\n' +
      '80. "story-box" {title?,story,moral?,character?}\n' +
      '81. "tip-jar" {title?,tips:[],icon?}\n' +
      '82. "try-it" {title?,instruction,hint?,timeEstimate?}\n' +
      '83. "word-bank" {title?,words:[{word,hint?}],color?}\n' +
      '84. "vocab-card" {word,definition,example?,partOfSpeech?,pronunciation?}\n' +
      'MEDIA (4):\n' +
      '85. "image-block" {url,alt?,caption?,credit?,maxHeight?}\n' +
      '86. "video-embed" {url,title?,aspectRatio:"16by9"|"4by3"}\n' +
      '87. "code-block" {code,language?,filename?}\n' +
      '88. "html" {html}\n' +
      'INTERACTIVE (5):\n' +
      '89. "quiz" {items:[{question,options:[],correct:0,explanation}]}\n' +
      '90. "flashcards-inline" {cards:[{front,back}],cols}\n' +
      '91. "reflection-prompt" {title?,questions:[],icon?}\n' +
      '92. "self-assessment" {question?,lowLabel?,highLabel?}\n' +
      '93. "next-steps" {title?,steps:[{label,description?,type}]}\n' +
      'SOLO ENGAGEMENT (8) — animated, visual, & interactive components for personal study:\n' +
      '94. "flip-card" — click-to-flip term card {front, back} — drill key concepts. Place 1-3 per section right after introducing a new term. Student clicks to self-test.\n' +
      '95. "progress-ring" — animated SVG ring {percent:0-100, label?, color?, size?} — show mastery/topic coverage. Use after completing a difficult subsection: "You just covered 3 of 4 aerodynamic forces!".\n' +
      '96. "mind-map" — radial concept map {central:{label}, nodes:[{label,description?,icon?}], title?} — visual summary. Use at END of a major section to show connections. Replace bullet-point summaries.\n' +
      '97. "process-flow" — horizontal step flow {title?, steps:[{label,description?,icon?}], color?} — arrows connect steps. For procedures, methods, lifecycles. Clearer than phase-flow for sequential processes.\n' +
      '98. "count-up" — animated stat highlight {value, label?, prefix?, suffix?, icon?, color?} — large number with animated entrance. Use for impressive stats: "over 1,200 known species". 1-2 per guide max.\n' +
      '99. "typewriter" — animated text reveal {text, speed?:"medium"|"slow"|"fast", label?} — dramatic key insight. Use ONCE per guide for maximum impact. Best after a build-up paragraph. Dark background, white text.\n' +
      '100. "slider-compare" — side-by-side comparison {leftTitle?, leftContent, rightTitle?, rightContent, leftColor?, rightColor?} — before/after, approach A vs B. For contrasting two states, methods, or time periods.\n' +
      '101. "hierarchy-tree" — tree diagram {title?, root:{label,icon?}, children:[{label,children?:[...],icon?}]} — MUST include children for 2-4 levels. Example: root:"Aeronautics Act", children:[{label:"CARs"},{label:"Minister Powers"}] — each child can have its own children. For taxonomy, org charts, legal hierarchies. NEVER use with root only.\n\n' +
      'RETURN FORMAT:\n{"components":[{"type":"paragraph","data":{"text":"..."}},{"type":"heading","data":{...}},{"type":"quiz","data":{"items":[...]}}]}\n\n' +
      'CRITICAL RULES — VISUAL STUDY GUIDE (balance text with visuals):\n' +
      '• VISUAL RATIO: 40-50% paragraphs, 50-60% visual/interactive components. This is a RICH, visually engaging study experience.\n' +
      '• MAXIMUM 3 consecutive paragraphs without a visual component. After 2-3 paragraphs, insert a flip-card, slider-compare, callout, curiosity-hook, myth-buster, or chart.\n' +
      '• VISUAL METAPHOR MATCHING: When you WRITE a metaphor or analogy in paragraph text, you MUST follow it with the matching visual component. "Imagine a pyramid of laws" → immediately add a pyramid component. "Think of it like a tree" → immediately add a hierarchy-tree. "It works like a chain reaction" → immediately add a process-flow.\n' +
      '• Generate 25-40 components total for a substantial lesson.\n' +
      '• LEARNING ARC: Hook (curiosity-hook/myth-buster/count-up) → Reading (paragraph×2-3 maximum, then visual break) → Visualize (pyramid/hierarchy-tree/process-flow/stat-chart — match the metaphor in the text) → Deepen (imagine/expert-voice/visual-metaphor → its visual partner) → Interact (reveal/flip-card/ordered-list/match/fill-blank) → Check (pause-point/quiz) → Reflect (reflection-prompt/self-assessment) → Map (mind-map) → Recap (summary-box/speed-run) → Next (next-steps).\n' +
      '• Use reveal, ordered-list, match, fill-blank, and flip-card throughout for "think first, then check" interactivity.\n' +
      '• FLIP-CARD: after introducing a key term, insert a flip-card so the student can self-test. Front=term/question, Back=definition/answer. 1-3 per section.\n' +
      '• PYRAMID: for ANY layered concept (legal systems, food chains, Maslow hierarchy, organizational levels). When you write "at the top... then... then... at the bottom" — you MUST add a pyramid. levels:[bottomLabel...topLabel] in order.\n' +
      '• HIERARCHY-TREE: for ANY parent→child classification (taxonomy, org charts, legal hierarchies, concept breakdowns). Root at top, 2-4 levels of children below. NEVER use without children — the whole point is showing the branches.\n' +
      '• PROGRESS-RING: after a difficult subsection, show topic coverage: "You\'ve now covered X% of this topic." Use at most 2 per guide.\n' +
      '• MIND-MAP: at the end of each major section, replace bullet-point summaries with a mind-map. Central concept in a colored circle, 4-8 branches around it.\n' +
      '• PROCESS-FLOW: for any procedural topic (scientific method, workflow, lifecycle, recipe), use process-flow with numbered steps connected by arrows.\n' +
      '• COUNT-UP: place 1-2 impressive statistics early in the guide. Pair with "did-you-know" for maximum impact.\n' +
      '• TYPEWRITER: use exactly ONCE per guide for the single most powerful insight. Dark background creates contrast.\n' +
      '• SLIDER-COMPARE: for before/after, two approaches, two time periods. Left=red tint (before/option A), Right=green tint (after/option B).\n' +
      '• STAT-CHART: when the source document contains survey data, statistics, or percentages — display them visually.\n' +
      '• Use spotlight for the single most important point in each major section.\n' +
      '• Use myth-buster for any widely-held misconceptions.\n' +
      '• Use perspectives (NOT debate) to present two viewpoints for student consideration.\n' +
      '• Use ranked-list (NOT leaderboard) to rank things/concepts by metric — never rank people.\n' +
      '• Use contrast when two concepts are easily confused.\n' +
      '• Use joke ONLY for light subjects (never law/medicine/safety/compliance). Maximum 1 joke per guide.\n' +
      '• Use columns-2 for side-by-side comparisons or juxtaposing two related concepts.\n' +
      '• Use progress-tracker to show progress through a process described in the content — NOT the student course progress.\n' +
      '• Use self-assessment for student reflection only (not scored) — ask "how confident are you?"\n' +
      '• For data: prefer charts over raw data-table.\n' +
      '• End with summary-box OR speed-run → self-assessment → quiz → next-steps.\n' +
      '• 5-8 quiz questions (correct=0-based). Include explanation on every question.\n' +
      '• For kids: use character-guide, story-box, star-award, encouragement, joke.\n' +
      '• For professionals: use code-block, perspectives, waterfall, expert-voice, concept-map, ranked-list.\n' +
      '• COLOR RULES: headings/labels on colored backgrounds keep their semantic color (red for danger, green for correct). Body text on colored backgrounds always uses dark neutral (#475569 or #1e293b) — never same-hue text on same-hue background.\n\n' +
      'Document:\n"""\n' + text + '\n"""\n\nSTART WITH: {"components":';

    var fullResponse = '';
    var _htmlStreamState = { scrolling: true, tokenCount: 0 }; // object, not primitive
    // Track manual scroll on the textarea — if user scrolls up, pause auto-scroll
    var taScroll = el('edit-html-code-v2') || el('edit-html-code');
    if (taScroll) {
      taScroll._onScroll = function() {
        var atBottom = taScroll.scrollTop + taScroll.clientHeight >= taScroll.scrollHeight - 50;
        _htmlStreamState.scrolling = atBottom;
      };
      taScroll.addEventListener('scroll', taScroll._onScroll);
    }
    tool.requestAIStream(prompt, null, {
      onToken: function(token) {
        fullResponse += token;
        // Live-update the HTML code textarea as tokens stream in
        var ta = el('edit-html-code-v2') || el('edit-html-code');
        if (ta) {
          ta.value = fullResponse;
          // Auto-scroll to end unless user manually scrolled up
          if (_htmlStreamState.scrolling) {
            ta.scrollTop = ta.scrollHeight;
          }
        }
        // Live-update the preview iframe every 150 tokens (reduced — avoids constant scroll reset)
        _htmlStreamState.tokenCount++;
        if (_htmlStreamState.tokenCount % 150 === 0) {
          updateHtmlPreview();
        }
      },
      onComplete: function() {
        // Clean up stream state
        if (taScroll && taScroll._onScroll) {
          taScroll.removeEventListener('scroll', taScroll._onScroll);
        }
        _htmlStreamState = null;
        // Final preview refresh
        updateHtmlPreview();
        if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🤖 Generate from PDFs'; }
        var raw = fullResponse.trim();
        raw = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
        // Try component-based format: { "components": [...] }
        try {
          var obj = JSON.parse(raw);
          if (obj.components && Array.isArray(obj.components)) {
            editingStudyHtmlData = obj;
            var rendered = renderComponentsToHtml(obj.components);
            editingHtmlCode = rendered;
            if (el('edit-html-code')) el('edit-html-code').value = rendered;
            if (el('edit-html-code-v2')) el('edit-html-code-v2').value = rendered;
            updateHtmlPreview();
            var compTypes = {};
            for (var ci = 0; ci < obj.components.length; ci++) {
              var ct = obj.components[ci].type || '?';
              compTypes[ct] = (compTypes[ct] || 0) + 1;
            }
            var summary = Object.keys(compTypes).map(function(k) { return k + '×' + compTypes[k]; }).join(', ');
            autoSaveCurrentLesson();
            tool.notify('✅ Study content generated with ' + obj.components.length + ' components & auto-saved! (' + summary + ')', 'success');
            return;
          }
        } catch(e) { /* fall through */ }
        // Parse as raw HTML fallback
        var html = raw;
        var startIdx = html.indexOf('<');
        var endIdx = html.lastIndexOf('>');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          html = html.substring(startIdx, endIdx + 1);
        }
        if (html.length < 20) {
          tool.notify('Generated too little content. Try again with more PDFs.', 'warning');
          return;
        }
        editingHtmlCode = html;
        editingStudyHtmlData = null;
        if (el('edit-html-code')) el('edit-html-code').value = html;
        if (el('edit-html-code-v2')) el('edit-html-code-v2').value = html;
        updateHtmlPreview();
        // Warn if source PDFs are still visible to students
        var stillVisible = [];
        for (var su = 0; su < allUrls.length; su++) {
          if (editingHiddenDocUrls.indexOf(allUrls[su]) === -1) {
            stillVisible.push(allUrls[su]);
          }
        }
        autoSaveCurrentLesson();
        var msg = '✅ Study content generated & auto-saved!';
        if (stillVisible.length > 0) {
          msg += ' 💡 ' + stillVisible.length + ' source PDF(s) are still visible to students — use the 👁 toggle in the Documents tab to hide them.';
        }
        tool.notify(msg, 'success');
      },
      onError: function(err) {
        if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🤖 Generate from PDFs'; }
        tool.notify('Generation failed: ' + err, 'error');
      }
    });
  }
}

/** Render the flashcards list in the Flashcards editor tab */
function renderFlashcardsEditorList() {
  var list = el('flashcards-editor-list');
  var count = el('flashcards-editor-count');
  if (count) count.textContent = editingFlashcards.length + ' card(s)';
  if (!list) return;
  if (editingFlashcards.length === 0) {
    list.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">No flashcards yet. Click "Generate" to create them from your PDFs, or add manually.</div>';
  } else {
    list.innerHTML = editingFlashcards.map(function(card, idx) {
      var diffIcon = { easy:'🟢', medium:'🟡', hard:'🔴' };
      var typeIcon = { term:'📖', question:'❓', code:'💻', concept:'💡', image:'🖼️' };
      var dIcon = diffIcon[card.difficulty]||'';
      var tIcon = typeIcon[card.type]||'📖';
      var metaParts = [];
      if (card.type) metaParts.push(tIcon+' '+((card.type||'term').charAt(0).toUpperCase()+(card.type||'term').slice(1)));
      if (card.difficulty) metaParts.push(dIcon+' '+((card.difficulty||'').charAt(0).toUpperCase()+(card.difficulty||'').slice(1)));
      if (card.category) metaParts.push('🏷 '+esc(card.category));
      var meta = metaParts.join(' · ') || '💡 ' + esc((card.back||card.a||'').substring(0,60));
      return '<div class="quiz-editor-item"><div class="quiz-editor-item-info"><div class="quiz-editor-item-title">🃏 ' + esc(card.front || card.q || '') + '</div><div class="quiz-editor-item-meta">' + meta + '</div></div><div class="quiz-editor-item-actions"><button class="btn btn-sm btn-outline" data-edit-fc="' + idx + '">✏️</button><button class="btn btn-sm btn-danger" data-del-fc="' + idx + '">🗑</button></div></div>';
    }).join('');
    var editBtns = list.querySelectorAll('[data-edit-fc]');
    for (var i = 0; i < editBtns.length; i++) {
      editBtns[i].addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute('data-edit-fc'));
        showFlashcardInlineEditor(idx, this.closest('.quiz-editor-item'));
      });
    }
    var delBtns = list.querySelectorAll('[data-del-fc]');
    for (var j = 0; j < delBtns.length; j++) {
      delBtns[j].addEventListener('click', function(e) {
        e.stopPropagation();
        editingFlashcards.splice(parseInt(this.getAttribute('data-del-fc')), 1);
        renderFlashcardsEditorList();
        autoSaveCurrentLesson();
      });
    }
  }
}

/** Inline editor for a flashcard — with category, difficulty, type, hint, imageUrl fields */
function showFlashcardInlineEditor(idx, rowEl) {
  var card = editingFlashcards[idx];
  if (!card || !rowEl) return;
  var diff = card.difficulty||'medium';
  var type = card.type||'term';
  var cat = card.category||'';
  var hint = card.hint||'';
  var imgUrl = card.imageUrl||'';
  rowEl.innerHTML = '<div style="flex:1;display:flex;flex-direction:column;gap:6px;min-width:0">' +
    '<div style="display:flex;gap:6px">' +
    '<input class="form-input fc-inline-front" value="' + esc(card.front || card.q || '') + '" placeholder="Question / term" style="flex:1;font-size:12px;padding:6px 8px">' +
    '<input class="form-input fc-inline-back" value="' + esc(card.back || card.a || '') + '" placeholder="Answer / definition" style="flex:1;font-size:12px;padding:6px 8px">' +
    '</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
    '<select class="form-input fc-inline-type" style="font-size:11px;padding:3px 6px;width:auto"><option value="term"'+(type==='term'?' selected':'')+'>📖 Term</option><option value="question"'+(type==='question'?' selected':'')+'>❓ Question</option><option value="code"'+(type==='code'?' selected':'')+'>💻 Code</option><option value="concept"'+(type==='concept'?' selected':'')+'>💡 Concept</option><option value="image"'+(type==='image'?' selected':'')+'>🖼️ Visual</option></select>' +
    '<select class="form-input fc-inline-diff" style="font-size:11px;padding:3px 6px;width:auto"><option value="easy"'+(diff==='easy'?' selected':'')+'>🟢 Easy</option><option value="medium"'+(diff==='medium'?' selected':'')+'>🟡 Medium</option><option value="hard"'+(diff==='hard'?' selected':'')+'>🔴 Hard</option></select>' +
    '<input class="form-input fc-inline-cat" value="' + esc(cat) + '" placeholder="Category (e.g. Physics)" style="font-size:11px;padding:3px 6px;width:120px">' +
    '</div>' +
    '<div style="display:flex;gap:6px">' +
    '<input class="form-input fc-inline-hint" value="' + esc(hint) + '" placeholder="Hint shown on front (optional)" style="flex:1;font-size:11px;padding:4px 6px">' +
    '<input class="form-input fc-inline-img" value="' + esc(imgUrl) + '" placeholder="Image URL (optional)" style="flex:1;font-size:11px;padding:4px 6px">' +
    '</div>' +
    '</div>' +
    '<div style="display:flex;gap:4px;flex-shrink:0;align-items:flex-start">' +
    '<button class="btn btn-sm btn-primary fc-inline-save">✓</button>' +
    '<button class="btn btn-sm btn-outline fc-inline-cancel">✕</button></div>';

  rowEl.querySelector('.fc-inline-save').addEventListener('click', function() {
    var front = rowEl.querySelector('.fc-inline-front').value.trim();
    var back = rowEl.querySelector('.fc-inline-back').value.trim();
    if (!front) { tool.notify('Question/term is required.', 'warning'); return; }
    var newCard = {
      front: front,
      back: back,
      type: rowEl.querySelector('.fc-inline-type').value,
      difficulty: rowEl.querySelector('.fc-inline-diff').value,
      category: rowEl.querySelector('.fc-inline-cat').value.trim(),
      hint: rowEl.querySelector('.fc-inline-hint').value.trim(),
      imageUrl: rowEl.querySelector('.fc-inline-img').value.trim()
    };
    if (!newCard.category) delete newCard.category;
    if (!newCard.hint) delete newCard.hint;
    if (!newCard.imageUrl) delete newCard.imageUrl;
    editingFlashcards[idx] = newCard;
    renderFlashcardsEditorList();
    autoSaveCurrentLesson();
  });
  rowEl.querySelector('.fc-inline-cancel').addEventListener('click', function() {
    renderFlashcardsEditorList();
  });
  setTimeout(function() {
    var f = rowEl.querySelector('.fc-inline-front');
    if (f) { f.focus(); f.select(); }
  }, 50);
}

/** AI: Generate flashcards from PDFs */
function generateFlashcardsFromPdf() {
  var allUrls = [];
  allUrls = allUrls.concat(editingPresentationPdfUrls);
  allUrls = allUrls.concat(editingStudyDocPdfUrls);
  allUrls = allUrls.concat(editingWorksheetPdfUrls);
  allUrls = allUrls.filter(function(u) { return u && u.trim(); });

  if (allUrls.length === 0) {
    tool.notify('No PDFs added yet. Add PDFs first.', 'warning');
    return;
  }

  var genBtn = el('btn-generate-flashcards') || el('btn-generate-flashcards-v2');
  var genBtn2 = el('btn-generate-flashcards-v2');
  if (genBtn) { genBtn.disabled = true; genBtn.textContent = '⏳ Reading PDFs...'; }
  if (genBtn2 && genBtn2 !== genBtn) { genBtn2.disabled = true; genBtn2.textContent = '⏳ Reading PDFs...'; }

  var combinedText = '';
  var remaining = allUrls.length;
  for (var ri = 0; ri < allUrls.length; ri++) {
    (function(idx) {
      tool.requestFileContent(toHostingUrl(allUrls[idx]), function(err, fileResult) {
        remaining--;
        if (!err && fileResult) {
          var text = typeof fileResult === 'string' ? fileResult : (fileResult.text || fileResult.content || '');
          if (text && text.length > 50) combinedText += '\n\n--- Doc ' + (idx+1) + ' ---\n\n' + text;
        }
        if (remaining === 0) {
          if (!combinedText || combinedText.length < 50) {
            if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🃏 Generate Flashcards'; }
            tool.notify('Could not extract enough text.', 'warning');
            return;
          }
          var prompt = 'You are an expert flashcard creator. Generate 15-25 high-quality flashcards from the document content below. Return ONLY a JSON array — no markdown, no intro.\n\nEach flashcard must have this structure:\n{\n  "front": "Question, term, or prompt",\n  "back": "Answer, definition, or explanation",\n  "type": "term|question|code|concept|image",\n  "difficulty": "easy|medium|hard",\n  "category": "short category label (e.g. Aerodynamics, Regulations, Weather)",\n  "hint": "brief memory hint (optional, omit if not helpful)"\n}\n\nRULES:\n• Vary types: ~40% term (vocabulary definitions), ~30% question (test understanding), ~15% concept (big ideas), ~10% code (if applicable), ~5% image (visual identification)\n• Vary difficulty: ~30% easy, ~40% medium, ~30% hard\n• Group related cards under the same category label (3-5 unique categories)\n• Back answers must be thorough — complete definitions/explanations, not one word\n• Use hints only for genuinely tricky cards where a small clue helps without giving away the answer\n• Professional/educational tone matching the source material\n\nDocument:\n"""\n' + combinedText.substring(0, 12000) + '\n"""\n\nSTART WITH: [{"front":';
          var fullResponse = '';
          var _fcStreamState = { tokenCount: 0 };
          // Update status during generation
          var statusEl = el('flashcards-status');
          if (statusEl) { statusEl.style.display = ''; statusEl.textContent = '⏳ Generating flashcards...'; }
          tool.requestAIStream(prompt, null, {
            onToken: function(t) {
              fullResponse += t;
              _fcStreamState.tokenCount++;
              // Every 25 tokens, update the status + try to show partial card count
              if (_fcStreamState.tokenCount % 25 === 0) {
                var partialCount = (fullResponse.match(/"front"/gi) || []).length;
                if (statusEl) statusEl.textContent = '⏳ Generated ~' + partialCount + ' cards so far (' + fullResponse.length + ' chars)';
              }
            },
            onComplete: function() {
              if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🃏 Generate Flashcards'; }
              if (genBtn2 && genBtn2 !== genBtn) { genBtn2.disabled = false; genBtn2.textContent = '🃏 Generate Flashcards from PDFs'; }
              if (statusEl) statusEl.style.display = 'none';
              try {
                var json = fullResponse.trim().replace(/^```[\\s\\S]*?\n?/i, '').replace(/\n?```\s*$/i, '');
                var arrMatch = json.match(/\[[\s\S]*\]/);
                if (arrMatch) json = arrMatch[0];
                var cards = JSON.parse(json);
                if (!Array.isArray(cards)) throw new Error('Not an array');
                editingFlashcards = cards;
                renderFlashcardsEditorList();
                autoSaveCurrentLesson();
                tool.notify('✅ Generated ' + cards.length + ' flashcards & auto-saved!', 'success');
              } catch(e) {
                tool.notify('Could not parse flashcards. Try again.', 'error');
                console.error('Flashcard parse error:', e, fullResponse);
              }
            },
            onError: function(err) {
              if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🃏 Generate Flashcards'; }
              tool.notify('Generation failed: ' + err, 'error');
            }
          });
        }
      });
    })(ri);
  }
}

/** AI: Generate presentation slides from PDFs */
function generatePresentationFromPdf() {
  var allUrls = [];
  allUrls = allUrls.concat(editingPresentationPdfUrls);
  allUrls = allUrls.concat(editingStudyDocPdfUrls);
  allUrls = allUrls.filter(function(u) { return u && u.trim(); });

  if (allUrls.length === 0) {
    tool.notify('No PDFs added yet. Add PDFs to Presentation Slides or Study Documents first.', 'warning');
    return;
  }

  var genBtn = el('btn-generate-presentation');
  if (genBtn) { genBtn.disabled = true; genBtn.textContent = '⏳ Reading ' + allUrls.length + ' PDF(s)...'; }
  tool.notify('Reading ' + allUrls.length + ' PDF(s) for presentation generation...', 'info');

  var combinedText = '';
  var remaining = allUrls.length;
  for (var ri = 0; ri < allUrls.length; ri++) {
    (function(idx) {
      tool.requestFileContent(toHostingUrl(allUrls[idx]), function(err, fileResult) {
        remaining--;
        if (!err && fileResult) {
          var text = typeof fileResult === 'string' ? fileResult : (fileResult.text || fileResult.content || '');
          if (text && text.length > 50) combinedText += '\n\n--- Document ' + (idx+1) + ' ---\n\n' + text;
        }
        if (remaining === 0) {
          if (!combinedText || combinedText.length < 50) {
            if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🎞️ Generate Presentation'; }
            tool.notify('Could not extract enough text from the PDFs.', 'warning');
            return;
          }
          generatePresWithAI(combinedText);
        }
      });
    })(ri);
  }

  function generatePresWithAI(text) {
    var maxLen = 12000;
    if (text.length > maxLen) text = text.substring(0, maxLen) + '\n\n[... content truncated ...]';
    if (genBtn) genBtn.textContent = '⏳ Generating slides...';

    var prompt = 'You are an expert presentation designer. Create a VISUALLY STUNNING, professional HTML slide deck from the document below. Return ONLY valid HTML — no markdown, no intro text, no code fences.\n\n' +
      'CRITICAL OUTPUT FORMAT:\n' +
      'Your ENTIRE response must be: <style>...ALL CSS rules...</style><div class="pres-deck">...slides...</div>\n' +
      'The <style> tag MUST come FIRST, immediately followed by <div class="pres-deck">. Do NOT use markdown code blocks.\n\n' +
      'SLIDE HTML STRUCTURE — every slide must follow this exact pattern:\n' +
      '<div class="pres-slide" style="background:...gradient or color...">\n' +
      '  <div class="pres-slide-inner">\n' +
      '    <!-- Put your content here — use inline styles for cards, icons, stat boxes etc. -->\n' +
      '  </div>\n' +
      '  <div class="pres-slide-num">1</div>\n' +
      '</div>\n\n' +
      'CSS TEMPLATE — COPY this EXACTLY into your <style> tag, then CUSTOMIZE the slide background colors via inline style="" on each .pres-slide:\n' +
      '.pres-deck{max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,sans-serif}\n' +
      '.pres-slide{width:100%;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;box-sizing:border-box;position:relative;overflow:hidden}\n' +
      '.pres-slide-inner{max-width:800px;width:100%;padding:36px 44px;box-sizing:border-box}\n' +
      '.pres-slide h1{font-size:34px;font-weight:800;margin:0 0 10px 0;line-height:1.25;letter-spacing:-0.02em}\n' +
      '.pres-slide h2{font-size:24px;font-weight:700;margin:0 0 8px 0;line-height:1.3}\n' +
      '.pres-slide p,.pres-slide li{font-size:16px;line-height:1.55;margin:0 0 6px 0;color:#334155}\n' +
      '.pres-slide ul,.pres-slide ol{margin:0;padding-left:22px}\n' +
      '.pres-slide-num{position:absolute;bottom:12px;right:18px;font-size:11px;color:rgba(148,163,184,0.8);font-weight:600}\n' +
      '@media print{.pres-slide{page-break-after:always;width:100vw;height:100vh}}\n\n' +
      'SLIDE TYPES — generate 7-10 varied slides:\n' +
      '1. TITLE SLIDE: Full-slide gradient background (e.g. linear-gradient(135deg,#4f46e5,#7c3aed)), white text, large h1 title, subtitle in lighter white, optional document source line at bottom\n' +
      '2. CONTENT SLIDES (3-5): Clean heading + 2-3 paragraphs wrapped in styled cards (use inline style: background:rgba(255,255,255,0.92);border-radius:12px;padding:20px 24px;box-shadow:0 2px 12px rgba(0,0,0,0.06)). Use light pastel slide backgrounds.\n' +
      '3. BULLET SLIDES (1-2): Heading + 4-5 bullet points with emoji markers (🎯 💡 ✅ 📌 ⭐). Each bullet can be a small card.\n' +
      '4. KEY STATS / HIGHLIGHT SLIDE (1): 2-4 stat cards side by side (use inline flex/grid) with big numbers and labels\n' +
      '5. QUOTE SLIDE (1): Centered impactful quote with large decorative quote marks, attribution below\n' +
      '6. SUMMARY SLIDE (1): 5-7 one-line takeaways in a compact list or card grid\n\n' +
      'VISUAL DESIGN RULES — EVERY slide must look designed:\n' +
      '• Pick ONE color scheme: Blue-Indigo (#4f46e5,#3730a3,#eef2ff), Green-Teal (#059669,#0d9488,#d1fae5), or Warm-Amber (#d97706,#92400e,#fef3c7)\n' +
      '• EVERY slide MUST have a non-white background (gradient or solid color). Use light tints for content slides (e.g. #f8faff, #f5f9ff), bold gradients for title/section slides\n' +
      '• Content text should be in styled cards/boxes — never just bare text on the slide\n' +
      '• Use subtle shadows (box-shadow:0 2px 12px rgba(0,0,0,0.06)), rounded corners (border-radius:12px)\n' +
      '• Use emoji icons as visual anchors in headings and bullet points\n' +
      '• Slide numbers (.pres-slide-num) on EVERY slide\n' +
      '• Title slide h1 color: white (#fff). Title slide p/subtitle color: rgba(255,255,255,0.85)\n\n' +
      'CONTENT FIT GUIDELINES (keep slides from overflowing):\n' +
      '• Max 5 bullet points per slide, each 1 line (~80 chars)\n' +
      '• Content slides: 1 heading + max 2 paragraphs (3-4 sentences each) OR 1 heading + 4-5 bullets\n' +
      '• If you have more content, split into an additional slide — more slides is better than overflow\n' +
      '• Total ~100-130 words max per content slide\n\n' +
      'Document to present:\n"""\n' + text + '\n"""\n\n' +
      'REMEMBER: Start with <style> tag, then <div class="pres-deck">. Every slide colored. Content in styled cards. Make it BEAUTIFUL.';

    var fullResponse = '';
    tool.requestAIStream(prompt, null, {
      onToken: function(token) { fullResponse += token; },
      onComplete: function() {
        if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🎞️ Generate Presentation'; }
        var raw = fullResponse.trim();
        raw = raw.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
        // Extract HTML: prefer <style> first, then pres-deck, then any div
        var startIdx = raw.indexOf('<style');
        if (startIdx === -1) startIdx = raw.indexOf('<div class="pres-deck"');
        if (startIdx === -1) startIdx = raw.indexOf('<div class=\'pres-deck\'');
        if (startIdx === -1) startIdx = raw.indexOf('<div');
        var endIdx = raw.lastIndexOf('</div>');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          raw = raw.substring(startIdx, endIdx + 6);
        }
        if (raw.length < 50) {
          tool.notify('Generated too little content. Try again.', 'warning');
          return;
        }
        editingPresentationHtml = raw;
        // Update the presentation preview
        updatePresentationPreview();
        autoSaveCurrentLesson();
        tool.notify('✅ Presentation generated & auto-saved! ' + (raw.match(/pres-slide/g)||[]).length + ' slides', 'success');
      },
      onError: function(err) {
        if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🎞️ Generate Presentation'; }
        tool.notify('Generation failed: ' + err, 'error');
      }
    });
  }
}

/** Update the presentation preview iframe */
function updatePresentationPreview() {
  var iframe = el('pres-preview-iframe');
  if (!iframe) return;
  if (!editingPresentationHtml || editingPresentationHtml.length < 10) {
    iframe.srcdoc = '<body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui;color:#94a3b8;font-size:14px;text-align:center"><div>🎞️<br><br>Click <strong>Generate Presentation</strong> to create slides from PDFs.</div></body>';
    return;
  }
  var navHtml = '<div style="text-align:center;padding:12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-family:system-ui;position:sticky;top:0;z-index:10">' +
    '<button onclick="window.presPrev&&window.presPrev()" style="padding:6px 14px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;margin:0 4px;font-size:13px">◀ Prev</button>' +
    '<span class="pres-counter" style="margin:0 12px;font-size:13px;color:#64748b;font-weight:600">Slide 1</span>' +
    '<button onclick="window.presNext&&window.presNext()" style="padding:6px 14px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;margin:0 4px;font-size:13px">Next ▶</button>' +
    '<button onclick="window.print()" style="padding:6px 14px;border:1px solid #059669;border-radius:6px;background:#ecfdf5;color:#059669;cursor:pointer;margin:0 4px;font-size:13px;font-weight:600">📄 Export PDF</button>' +
    '</div>';
  var slideJs = '<script>var slides=document.querySelectorAll(".pres-slide");var cur=0;function showSlide(n){slides.forEach(function(s,i){s.style.display=i===n?"flex":"none"});var c=document.querySelector(".pres-counter");if(c)c.textContent="Slide "+(n+1)+" of "+slides.length};window.presNext=function(){cur=Math.min(cur+1,slides.length-1);showSlide(cur)};window.presPrev=function(){cur=Math.max(cur-1,0);showSlide(cur)};showSlide(0);</' + 'script>';
  iframe.srcdoc = navHtml + editingPresentationHtml + slideJs;
}

/** Update the live HTML preview iframe from the code textarea */
function updateHtmlPreview() {
  var iframe = el('study-html-preview-iframe');
  if (!iframe) return;
  var code = getStudyHtmlForPreview();

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
    + 'details{margin:8px 0}details summary{padding:8px 0;font-weight:600;color:#4f46e5;cursor:pointer;user-select:none}details summary:hover{color:#3730a3}'
    + '.sg-show-answer-btn{display:inline-flex;align-items:center;gap:6px;margin-top:14px;padding:8px 18px;border:1px solid #4f46e5;border-radius:8px;background:#eef2ff;color:#4f46e5;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}'
    + '.sg-show-answer-btn:hover:not(:disabled){background:#4f46e5;color:#fff}'
    + '.sg-show-answer-btn:disabled{opacity:0.45;cursor:not-allowed;border-color:#e2e8f0;background:#f1f5f9;color:#94a3b8}'
    + '.sg-answer-correct{font-size:15px;margin-bottom:6px;color:#065f46}'
    + '.sg-answer-wrong{font-size:15px;margin-bottom:6px;color:#991b1b}'
    /* New component styles */
    + 'blockquote p{margin:0}'
    + 'a[rel="noopener"]:hover{background:#f8fafc!important;border-color:#818cf8!important}'
    + 'details summary:hover{color:#4f46e5}'
    /* Flashcard flip */
    + '.fc-flip-check:checked+.fc-card-label .fc-card-inner{transform:rotateY(180deg)!important}'
    + '.fc-card-wrapper:hover .fc-card-inner{box-shadow:0 4px 16px rgba(79,70,229,0.15)}'
    /* Self-assessment stars */
    + '.sa-radio:checked+.sa-star{filter:none!important;opacity:1!important;transform:scale(1.15)}'
    + '.sa-star:hover{filter:none!important;opacity:0.8!important}'
    /* Fill-blank */
    + 'details summary::-webkit-details-marker{display:none}'
    /* Spotlight animation */
    + '@keyframes sgSpotlight{0%,100%{box-shadow:0 0 10px rgba(79,70,229,0.15);transform:scale(1)}50%{box-shadow:0 0 25px rgba(79,70,229,0.35);transform:scale(1.01)}}'
    + '.sg-spotlight{animation:sgSpotlight 2.5s ease-in-out infinite}'
    + '@media(max-width:600px){.sg-grid-2{grid-template-columns:1fr}.sg-hero{padding:20px 16px}.sg-hero h1{font-size:20px}}'
    + '</style>';

  if (!code || code.length < 10) {
    iframe.srcdoc = previewCss + '<body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui;color:#94a3b8;font-size:14px;text-align:center;padding:20px"><div>🤖<br><br>Click <strong>Generate from PDFs</strong> above to create a study guide.<br><small>Generates a rich lesson using 101 visual components — Grade 1 to professional.</small></div></body>';
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
  var btnGenFlashcards = el('btn-generate-flashcards');
  if (btnGenFlashcards) btnGenFlashcards.addEventListener('click', generateFlashcardsFromPdf);
  var btnGenFlashcardsV2 = el('btn-generate-flashcards-v2');
  if (btnGenFlashcardsV2) btnGenFlashcardsV2.addEventListener('click', generateFlashcardsFromPdf);
  var btnGenPres = el('btn-generate-presentation');
  if (btnGenPres) btnGenPres.addEventListener('click', generatePresentationFromPdf);

  // Visibility toggle clicks (delegated)
  var editorPanel = el('lesson-editor-panel');
  if (editorPanel) {
    editorPanel.addEventListener('click', function(e) {
      var toggleBtn = e.target.closest('.vis-tab-toggle');
      if (!toggleBtn) return;
      var key = toggleBtn.getAttribute('data-vis-key');
      if (!key) return;
      var idx = editingHiddenSections.indexOf(key);
      if (idx === -1) {
        editingHiddenSections.push(key);
      } else {
        editingHiddenSections.splice(idx, 1);
      }
      autoSaveCurrentLesson();
      updateAllVisToggles();
    });
  }

  // Study Content sub-tabs (Code / Preview)
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
    { name: 'managerRole', label: 'Manager Role(s)', type: 'text', default: 'admin,editor', severity: 'goodToHave', hint: 'Comma-separated roles that can manage the curriculum.' },
    { name: 'lessonDocUrlTemplate', label: 'Lesson Doc URL Template', type: 'text', default: '', severity: 'optional', hint: 'URL template for opening lesson Firestore docs. Use __ID__ for lessonDocId, __TYPE__ for object type, __ORIGIN__ for the tenant subdomain origin (auto-detected). Leave empty for the default: <tenant origin>/admin/objects/<type>/<id>.' },
    { name: 'tenantBaseUrl', label: 'Tenant Base URL', type: 'text', default: '', severity: 'optional', hint: 'Optional fallback for doc links when the tenant subdomain cannot be auto-detected from the parent page. Example: https://yourtenant.uniconbase.com' }
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
