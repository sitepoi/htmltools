/* js build 2026-11-18-47 */
/* ── Curriculum Builder ──
   Manager tool for creating and editing curriculum sections & lessons.
   Stores ONE master curriculum object in CMS.
   Built for UniconHub CMS html-tool system.
────────────────────────────────────────── */

/* Tool build identifier - see html-tool-rules.txt "VISIBLE TOOL BUILD NUMBER". */
var TOOL_BUILD = '2026-11-18-47';
console.log('[TOOL:BOOT] build ' + TOOL_BUILD + ' ...');
// Boot diagnostic: is the large-file download channel present in this CMS build?
(function logFileChannelAvailability() {
  try {
    var channelPresent = (typeof tool !== 'undefined') && typeof tool.requestFileBinary === 'function';
    console.log('[TOOL:BOOT] large-file download channel: ' + (channelPresent ? 'requestFileBinary available' : 'requestFileBinary MISSING'));
    console.log('[TOOL:BOOT] PDF renderer: ' + (pdfJsLibraryAvailable() ? 'PDF.js injected' : 'PDF.js NOT injected (PDF page preview disabled)'));
    console.log('[TOOL:BOOT] OCR engine: ' + describeOcrEngine());
    console.log('[TOOL:BOOT] file settings probe: ' + JSON.stringify(collectToolCapabilitySnapshot().paramProbe));
    var bootBadge = document.getElementById('tool-build-badge');
    if (bootBadge) bootBadge.textContent = 'build ' + TOOL_BUILD + ' · waiting for CMS…';
  } catch (probeError) { console.warn('[TOOL:BOOT] could not probe the download channel:', probeError); }
})();

/* ── Early CMS handshake ─────────────────────────────────────────────
   The CMS pushes onReady / onValueChange as soon as the tool frame exists.
   This script is large, so a push can arrive BEFORE the entry point at the
   bottom of the file subscribes - the event was then lost and the tool sat
   there empty (the intermittent "the content is gone" reports). Subscribe
   here, remember what arrived, and replay it to the entry point. */
var earlyCmsHandshake = {
  readyListenerAttached: false,
  valueListenerAttached: false,
  readySeen: false,
  readyValue: undefined,
  readyFields: null,
  valueChangeSeen: false,
  lastValue: undefined,
  readyHandler: null,
  valueChangeHandler: null
};

function receiveEarlyCmsReady(cmsValue, cmsFields) {
  earlyCmsHandshake.readySeen = true;
  earlyCmsHandshake.readyValue = cmsValue;
  earlyCmsHandshake.readyFields = cmsFields;
  console.log('[TOOL:READY] the CMS sent onReady · value type: ' + (cmsValue === null ? 'null' : typeof cmsValue));
  if (earlyCmsHandshake.readyHandler) earlyCmsHandshake.readyHandler(cmsValue, cmsFields);
}

function receiveEarlyCmsValueChange(cmsValue) {
  earlyCmsHandshake.valueChangeSeen = true;
  earlyCmsHandshake.lastValue = cmsValue;
  if (earlyCmsHandshake.valueChangeHandler) earlyCmsHandshake.valueChangeHandler(cmsValue);
}

function attachEarlyCmsListeners() {
  if (typeof tool === 'undefined' || !tool) return;
  if (typeof tool.onReady === 'function' && !earlyCmsHandshake.readyListenerAttached) {
    try { tool.onReady(receiveEarlyCmsReady); earlyCmsHandshake.readyListenerAttached = true; }
    catch (earlyReadyError) { console.warn('[TOOL:BOOT] could not subscribe to onReady early:', earlyReadyError); }
  }
  if (typeof tool.onValueChange === 'function' && !earlyCmsHandshake.valueListenerAttached) {
    try { tool.onValueChange(receiveEarlyCmsValueChange); earlyCmsHandshake.valueListenerAttached = true; }
    catch (earlyValueError) { console.warn('[TOOL:BOOT] could not subscribe to onValueChange early:', earlyValueError); }
  }
}

attachEarlyCmsListeners();

/* ── Helpers ── */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function el(id) { return document.getElementById(id); }

/* ── State ── */
var sections = [];               // section tree from curriculum (sections can nest via `children`)
var curriculumLanguage = '';     // language saved with the curriculum (default OCR language)
var studioOcrLanguageOverride = ''; // per-document OCR language chosen in the Process drawer
var editingSectionIdx = null;    // Index being edited in editingSectionParent
var editingSectionParent = null; // Array that holds the section being edited (sections or a parent's children)
var editingLessons = [];         // Temp array for lessons within the section being edited
var editingLessonIdx = null;     // Index being edited in editingLessons
var editingDirectSection = null; // Section object when editing a lesson directly from main view (not via modal)
var bulkGenRunning = false;      // True while a bulk AI generation run is in progress
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
var editingPdfSourceUrl = '';

/* ── Constants ── */
var QUIZ_SETS = 3;
var QUIZ_PER_SET = 5;
var LESSON_DOC_TYPE = 'curriculum-lessons-uniconbase';

/* ── Section Tree Helpers ──
   Sections can nest to any depth: { id, title, order, lessons:[], children:[] }.
   Lessons can live on ANY section or subsection node. Flat legacy data
   (no `children` property) keeps working unchanged. */

/** Depth-first traversal of the section tree: fn(section, parentArray, indexInParent, depth) */
function eachSection(fn) {
  function walk(arr, depth) {
    if (!arr) return;
    for (var i = 0; i < arr.length; i++) {
      var s = arr[i];
      fn(s, arr, i, depth);
      walk(s.children, depth + 1);
    }
  }
  walk(sections, 0);
}

/** Find a section anywhere in the tree by id. Returns { section, parentArr, index, depth } or null. */
function findSectionById(id) {
  var found = null;
  eachSection(function(s, arr, i, depth) {
    if (!found && s.id === id) found = { section: s, parentArr: arr, index: i, depth: depth };
  });
  return found;
}

/** Flat list of every lesson in the tree: { section, lesson, li, depth } */
function collectAllLessons() {
  var out = [];
  eachSection(function(s, arr, i, depth) {
    var lessons = s.lessons || [];
    for (var li = 0; li < lessons.length; li++) {
      out.push({ section: s, lesson: lessons[li], li: li, depth: depth });
    }
  });
  return out;
}

/** Index of a lesson by id inside a section's lessons array (-1 when missing) */
function indexOfLessonById(lessonsArr, lessonId) {
  if (!lessonsArr) return -1;
  for (var i = 0; i < lessonsArr.length; i++) {
    if (lessonsArr[i].id === lessonId) return i;
  }
  return -1;
}

/** Replace a lesson by id inside a section object (used after async saves) */
function replaceLessonInSection(section, lessonId, newLesson) {
  if (!section || !section.lessons) return false;
  for (var i = 0; i < section.lessons.length; i++) {
    if (section.lessons[i].id === lessonId) {
      section.lessons[i] = newLesson;
      return true;
    }
  }
  return false;
}

/** Collect every lesson id in a section's subtree (for bulk generation scopes) */
function collectSubtreeLessons(section) {
  var out = [];
  function walk(s) {
    if (!s) return;
    var lessons = s.lessons || [];
    for (var li = 0; li < lessons.length; li++) {
      out.push({ section: s, lesson: lessons[li], li: li });
    }
    var kids = s.children || [];
    for (var k = 0; k < kids.length; k++) walk(kids[k]);
  }
  walk(section);
  return out;
}

/** Count lessons in a subtree (sorted by order per level) */
function countSubtreeLessons(section) {
  return collectSubtreeLessons(section).length;
}

/** Collect all lesson doc ids in a section's subtree (for delete cleanup) */
function collectSubtreeLessonDocIds(section) {
  var ids = [];
  collectSubtreeLessons(section).forEach(function(r) {
    if (r.lesson.lessonDocId) ids.push(r.lesson.lessonDocId);
  });
  return ids;
}

/** Sort helper: by order asc */
function byOrder(a, b) { return (a.order || 9999) - (b.order || 9999); }

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
    studyDocSources: les.studyDocSources || null,
    studyDocImages: les.studyDocImages || null,
    studyDocGenerated: les.studyDocGenerated || null,
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
var HEAVY_LESSON_FIELDS = ['content', 'htmlCode', 'studyHtmlData', 'presentationHtml', 'flashcards', 'quiz', 'sourceUrls', 'studyDocSources', 'studyDocImages', 'studyDocGenerated'];

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
  collectAllLessons().forEach(function(ref) {
    if (hasHeavyLessonFields(ref.lesson)) work.push(ref);
  });
  if (work.length === 0) { window._lessonsMigratedOnce = true; return; }
  window._lessonsMigratedOnce = true;
  console.log('[CurriculumBuilder] migrating ' + work.length + ' heavy lesson(s) to lesson docs...');

  var remaining = work.length;
  var anyFailed = false;
  function finishMigration() {
    for (var w2 = 0; w2 < work.length; w2++) {
      var wk = work[w2];
      var lesson = wk.lesson;
      if (lesson._keepHeavy) { delete lesson._keepHeavy; continue; }
      if (lesson.lessonDocId && hasHeavyLessonFields(lesson)) stripHeavyLessonFields(lesson);
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
      saveLessonDoc(wk.lesson, function(err, docId) {
        if (docId) wk.lesson.lessonDocId = docId;
        if (err) { anyFailed = true; wk.lesson._keepHeavy = true; }
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
  collectAllLessons().forEach(function(ref) {
    if (ref.lesson.lessonDocId && ref.lesson.quizCount === undefined) work.push(ref);
  });
  if (work.length === 0) { window._summariesBackfilledOnce = true; return; }
  window._summariesBackfilledOnce = true;
  console.log('[CurriculumBuilder] backfilling summary fields for ' + work.length + ' lesson(s)...');

  var remaining = work.length;
  var changed = false;
  for (var w = 0; w < work.length; w++) {
    (function(wk) {
      var current = wk.lesson;
      if (!current || !current.lessonDocId) {
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
          // Resolve the CURRENT tree copy (sections may have been refreshed).
          var found = findSectionById(wk.section.id);
          var targetSec = found ? found.section : wk.section;
          if (replaceLessonInSection(targetSec, current.id, merged)) changed = true;
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
      if (docData.studyDocSources !== undefined) merged.studyDocSources = docData.studyDocSources;
      if (docData.studyDocImages !== undefined) merged.studyDocImages = docData.studyDocImages;
      if (docData.studyDocGenerated !== undefined) merged.studyDocGenerated = docData.studyDocGenerated;
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

/** Detect AI component JSON ({ "components": [...] }) sitting in the study
 *  content Code textarea and render it to real HTML. This is the bridge for
 *  content that arrives by PASTE (or an older save path) instead of the
 *  built-in AI generator: the JSON is kept as studyHtmlData (source of
 *  truth) and htmlCode becomes the rendered HTML both the builder preview
 *  and the student tool can display. Returns true when a conversion ran. */
function normalizeStudyContentInput(notifyUser) {
  var raw = '';
  var v2 = el('edit-html-code-v2');
  var v1 = el('edit-html-code');
  if (v2 && v2.value) raw = v2.value;
  else if (v1 && v1.value) raw = v1.value;
  else raw = editingHtmlCode || '';
  var trimmed = String(raw).trim();
  if (trimmed.charAt(0) !== '{') return false;
  try {
    var obj = JSON.parse(trimmed);
    if (!obj || !Array.isArray(obj.components)) return false;
    editingStudyHtmlData = obj;
    var rendered = renderComponentsToHtml(obj.components);
    editingHtmlCode = rendered;
    if (v1) v1.value = rendered;
    if (v2) v2.value = rendered;
    if (notifyUser) tool.notify('✨ AI component JSON detected — rendered to HTML. Preview now shows the study guide.', 'info');
    return true;
  } catch (e) { /* not valid JSON - leave the text alone */ }
  return false;
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
  if (panel) {
    if (panelId === 'lesson-editor-panel') {
      // The lesson editor is a full-height right drawer.
      panel.style.display = '';
      panel.classList.add('lesson-drawer-open');
      document.body.classList.add('lesson-drawer-active');
      syncDrawerScrollLock();
    } else {
      panel.style.display = '';
    }
  }
  if (backdrop) backdrop.classList.add('active');
}
function hideSubModal(panelId) {
  var panel = el(panelId);
  var backdrop = el('sub-modal-backdrop');
  if (panel) {
    if (panelId === 'lesson-editor-panel') {
      panel.classList.remove('lesson-drawer-open');
      document.body.classList.remove('lesson-drawer-active');
      syncDrawerScrollLock();
      // Hide after the slide-out animation; guard against a quick re-open.
      setTimeout(function() {
        if (!panel.classList.contains('lesson-drawer-open')) panel.style.display = 'none';
      }, 300);
    } else {
      panel.style.display = 'none';
    }
  }
  if (backdrop) backdrop.classList.remove('active');
}

/** Keep a single scrollbar: lock the page behind open drawers */
function syncDrawerScrollLock() {
  if (!document.body || !document.body.classList) return;
  var lessonPanel = el('lesson-editor-panel');
  var studioDrawer = el('sd-studio-drawer');
  var lessonDrawerOpen = !!(lessonPanel && lessonPanel.classList.contains('lesson-drawer-open'));
  var studioDrawerOpen = !!(studioDrawer && studioDrawer.classList.contains('sd-drawer-open'));
  if (lessonDrawerOpen || studioDrawerOpen) document.body.classList.add('drawer-scroll-locked');
  else document.body.classList.remove('drawer-scroll-locked');
}

/* ── HTML Editor ── */
function execCmd(cmd, val) { document.execCommand(cmd, false, val); }
function getHtmlContent() { var contentEl = el('html-editor-content'); return contentEl ? (contentEl.innerHTML || '') : ''; }
function setHtmlContent(html) { var contentEl = el('html-editor-content'); if (contentEl) contentEl.innerHTML = html || ''; }

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
function sandboxConfirm(message, onYes, confirmLabel) {
  _confirmCallback = onYes;
  var messageEl = el('confirm-message');
  if (messageEl) messageEl.textContent = message;
  var yesButton = el('btn-confirm-yes');
  if (yesButton) {
    var label = confirmLabel || 'Yes, Continue';
    yesButton.textContent = label;
    yesButton.className = (label.indexOf('Delete') !== -1 || label.indexOf('Remove') !== -1) ? 'btn btn-danger' : 'btn btn-primary';
  }
  el('confirm-overlay').style.display = '';
}
function hideConfirm() {
  el('confirm-overlay').style.display = 'none';
  _confirmCallback = null;
}

/* ═══════════════════════════════════════════
   DATA: LOAD & SAVE (plain tool.setValue — no CRUD)
   ═══════════════════════════════════════════ */

/** Accept every shape the CMS can hand over: object, JSON string, or a
 *  { curriculum: … } / { data: … } wrapper. Returns null when there is
 *  nothing usable. */
function normalizeCurriculumValue(rawValue) {
  var value = rawValue;
  if (typeof value === 'string') {
    var textValue = value.trim();
    if (!textValue) return null;
    try {
      value = JSON.parse(textValue);
    } catch (parseError) {
      console.warn('[CURRICULUM:LOAD] the CMS value is a string but not valid JSON: ' + parseError.message);
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) return { sections: value };
  if (!value.sections && value.curriculum && typeof value.curriculum === 'object' && value.curriculum.sections) return value.curriculum;
  if (!value.sections && value.data && typeof value.data === 'object' && value.data.sections) return value.data;
  if (!value.sections && value.value && typeof value.value === 'object' && value.value.sections) return value.value;
  return value;
}

/** Show a plain line under the empty state when nothing usable arrived */
function annotateEmptyStateLoadInfo(rawValue, hasSectionsArray) {
  try {
    var emptyBox = document.getElementById('sections-empty');
    if (!emptyBox) return;
    var hintEl = document.getElementById('sections-empty-load-hint');
    if (!hintEl) {
      hintEl = document.createElement('div');
      hintEl.id = 'sections-empty-load-hint';
      hintEl.className = 'empty-desc';
      hintEl.style.marginTop = '10px';
      hintEl.style.fontSize = '11px';
      emptyBox.appendChild(hintEl);
    }
    var reloadButton = document.getElementById('sections-empty-reload');
    if (!reloadButton) {
      reloadButton = document.createElement('button');
      reloadButton.id = 'sections-empty-reload';
      reloadButton.type = 'button';
      reloadButton.className = 'btn btn-outline btn-sm';
      reloadButton.style.marginTop = '10px';
      reloadButton.textContent = '🔄 Reload data';
      reloadButton.onclick = function() { reloadCurriculumFromCms(); };
      emptyBox.appendChild(reloadButton);
    }
    if (hasSectionsArray) { hintEl.textContent = ''; if (reloadButton) reloadButton.style.display = 'none'; return; }
    if (reloadButton) reloadButton.style.display = 'inline-block';
    var valueKind = (rawValue === undefined) ? 'no value' : (rawValue === null ? 'null' : typeof rawValue);
    hintEl.textContent = 'The CMS did not send any curriculum content (' + valueKind + ', build ' + TOOL_BUILD + '). The tool keeps checking automatically - use "Reload data" once the record is back.';
  } catch (hintError) {
    console.warn('[CURRICULUM:LOAD] could not annotate the empty state:', hintError);
  }
}

/** Replace the section list with a readable error card instead of a blank page */
function showCurriculumLoadFailure(loadError) {
  var container = el('sections-list');
  if (!container) return;
  container.innerHTML = '<div class="empty-state">' +
    '<div class="empty-icon">⚠️</div>' +
    '<div class="empty-title">The curriculum could not be displayed</div>' +
    '<div class="empty-desc">' + esc(String((loadError && loadError.message) || loadError)) + '</div>' +
    '<div class="empty-desc" style="margin-top:8px;font-size:11px">Build ' + esc(TOOL_BUILD) + ' - the technical details are in the browser console.</div>' +
  '</div>';
}

/** When this tool last asked the CMS to save (protects against a transient
 *  empty value overwriting the screen right after a save). */
var lastSaveRequestedAt = 0;

/* ── Curriculum value guardian ──
   The CMS can push an EMPTY value while the record still exists: onReady/
   onValueChange race, re-mounted frame, save echo, slow upload. The guardian
   makes that harmless on every path:
     - an empty value NEVER replaces a curriculum that is already on screen;
     - the tool keeps reading tool.getValue() (the authoritative record) until
       the real curriculum arrives;
     - the empty state offers a "Reload data" button instead of a dead end. */
var curriculumHadSectionsThisSession = false;
var curriculumGuardianTimer = null;
var curriculumGuardianStartedAt = 0;
var CURRICULUM_GUARDIAN_POLL_MS = 1200;
var CURRICULUM_GUARDIAN_MAX_WAIT_MS = 60000;
var curriculumEmptyNoticeShown = false;

/** True when a raw CMS value carries at least one section */
function valueHasCurriculumSections(rawValue) {
  var normalizedValue = normalizeCurriculumValue(rawValue);
  return !!(normalizedValue && Array.isArray(normalizedValue.sections) && normalizedValue.sections.length);
}

/** Read the CMS value straight from the SDK (authoritative, not an event) */
function readCurriculumValueFromCms() {
  if (typeof tool === 'undefined' || !tool || typeof tool.getValue !== 'function') {
    return { value: undefined, hasSections: false };
  }
  var readValue;
  try { readValue = tool.getValue(); }
  catch (readError) {
    console.warn('[CURRICULUM:GUARD] tool.getValue() failed:', readError);
    return { value: undefined, hasSections: false };
  }
  return { value: readValue, hasSections: valueHasCurriculumSections(readValue) };
}

function stopCurriculumValueGuardian() {
  if (curriculumGuardianTimer) {
    clearInterval(curriculumGuardianTimer);
    curriculumGuardianTimer = null;
  }
}

/** Keep asking the CMS for the real curriculum until it arrives */
function startCurriculumValueGuardian(reasonLabel) {
  if (curriculumGuardianTimer) return;
  curriculumGuardianStartedAt = Date.now();
  console.warn('[CURRICULUM:GUARD] watching for the real CMS value · ' + reasonLabel);
  curriculumGuardianTimer = setInterval(function() {
    var waitedMs = Date.now() - curriculumGuardianStartedAt;
    var polledValue = readCurriculumValueFromCms();
    if (polledValue.hasSections) {
      stopCurriculumValueGuardian();
      console.warn('[CURRICULUM:GUARD] the real value arrived after ' + waitedMs + ' ms - rendering it');
      loadCurriculum(polledValue.value);
      return;
    }
    if (waitedMs >= CURRICULUM_GUARDIAN_MAX_WAIT_MS) {
      stopCurriculumValueGuardian();
      console.warn('[CURRICULUM:GUARD] no curriculum value after ' + waitedMs + ' ms - waiting for the next CMS event or a manual reload');
    }
  }, CURRICULUM_GUARDIAN_POLL_MS);
}

/** Tell the user once that an empty CMS value was ignored */
function showIgnoredEmptyValueNotice() {
  if (curriculumEmptyNoticeShown) return;
  curriculumEmptyNoticeShown = true;
  if (typeof tool !== 'undefined' && tool && typeof tool.notify === 'function') {
    tool.notify('The CMS sent an empty curriculum value - your loaded version stays on screen.', 'warning');
  }
}

/** User action: read the curriculum again (empty-state button + console helper) */
function reloadCurriculumFromCms() {
  var polledValue = readCurriculumValueFromCms();
  if (polledValue.hasSections) {
    loadCurriculum(polledValue.value);
    if (typeof tool.notify === 'function') tool.notify('Curriculum reloaded from the CMS.', 'success');
    return true;
  }
  if (typeof tool.notify === 'function') tool.notify('The CMS still reports no curriculum sections. Reload the page in a moment.', 'warning');
  startCurriculumValueGuardian('manual reload found no sections');
  return false;
}

function loadCurriculum(val) {
  window.__curriculumLastVal = val;  // inspectable from the browser console
  var curriculumValue = normalizeCurriculumValue(val);
  var receivedSections = !!(curriculumValue && Array.isArray(curriculumValue.sections));
  var incomingSectionCount = receivedSections ? curriculumValue.sections.length : 0;
  // The curriculum language travels with the value and is the default OCR
  // language for every document.
  var incomingLanguage = '';
  if (curriculumValue && typeof curriculumValue.language === 'string' && curriculumValue.language.trim()) {
    incomingLanguage = curriculumValue.language.trim();
  } else if (val && typeof val === 'object' && !Array.isArray(val) && typeof val.language === 'string' && val.language.trim()) {
    incomingLanguage = val.language.trim();
  }
  if (incomingLanguage) {
    curriculumLanguage = resolveOcrLanguage(incomingLanguage);
    syncCurriculumLanguageSelect();
  }
  // GUARD: an empty value must NEVER wipe a curriculum that is already on
  // screen. Keep the screen and keep reading tool.getValue() instead.
  if (!incomingSectionCount && sections.length > 0) {
    console.warn('[CURRICULUM:GUARD] ignored an empty CMS value - keeping ' + sections.length + ' loaded section(s)');
    showIgnoredEmptyValueNotice();
    startCurriculumValueGuardian('empty value while ' + sections.length + ' section(s) are loaded');
    return;
  }
  sections = receivedSections ? curriculumValue.sections : [];
  console.log('[CURRICULUM:LOAD] ' + sections.length + ' section(s) · value type: ' + (val === null ? 'null' : typeof val) + (receivedSections ? '' : ' · NO sections array in the CMS value'));
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    console.log('[CURRICULUM:LOAD] value keys: ' + Object.keys(val).slice(0, 12).join(', '));
  }
  if (receivedSections && sections.length) {
    stopCurriculumValueGuardian();
    curriculumHadSectionsThisSession = true;
    curriculumEmptyNoticeShown = false;
    try { window.__curriculumLastGoodValue = { sections: JSON.parse(JSON.stringify(sections)) }; }
    catch (snapshotError) { console.warn('[CURRICULUM:LOAD] could not keep a copy of the loaded curriculum:', snapshotError); }
  }
  if (isDeveloper()) {
    var totalLessons = collectAllLessons().length;
    var sectionCount = 0;
    eachSection(function() { sectionCount++; });
    console.log('[CurriculumBuilder] loadCurriculum: ' + sectionCount + ' section(s), ' + totalLessons + ' lesson(s) total');
    eachSection(function(sec, arr, i, depth) {
      console.log('  ' + '  '.repeat(depth) + 'section "' + (sec.title || '?') + '" id=' + (sec.id || '?') + ' order=' + (sec.order || '?') + ' lessons=' + ((sec.lessons || []).length) + ' children=' + ((sec.children || []).length));
      for (var lj = 0; lj < (sec.lessons || []).length; lj++) {
        console.log('    ' + '  '.repeat(depth) + 'lesson[' + lj + '] ' + (sec.lessons[lj].title || '?') + ' order=' + (sec.lessons[lj].order || '?'));
      }
    });
  }
  updateIdBadge();
  try {
    renderSections();
    annotateEmptyStateLoadInfo(val, receivedSections);
  } catch (renderError) {
    console.error('[CURRICULUM:LOAD] rendering failed:', renderError);
    showCurriculumLoadFailure(renderError);
  }
  if (!sections.length) startCurriculumValueGuardian('the tool has no sections yet');
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

/** The exact object written to the CMS: sections plus the optional curriculum language */
function buildCurriculumValueForCms() {
  var curriculumValue = { sections: sections };
  if (curriculumLanguage) curriculumValue.language = curriculumLanguage;
  return JSON.parse(JSON.stringify(curriculumValue));
}

/** Reflect the saved curriculum language in the toolbar picker */
function syncCurriculumLanguageSelect() {
  var languageSelect = el('curriculum-language-select');
  if (!languageSelect) return;
  var hasMatchingOption = false;
  for (var optionIndex = 0; optionIndex < languageSelect.options.length; optionIndex++) {
    if (languageSelect.options[optionIndex].value === curriculumLanguage) { hasMatchingOption = true; break; }
  }
  languageSelect.value = hasMatchingOption ? curriculumLanguage : '';
}

/** Reflect the per-document OCR override in the drawer picker */
function syncStudioOcrLanguageSelect() {
  var languageSelect = el('sd-ocr-language');
  if (languageSelect) languageSelect.value = studioOcrLanguageOverride || '';
}

function saveCurriculum(callback) {
  if (tool.isReadOnly()) {
    tool.notify('Cannot save — the form is in read-only mode.', 'warning');
    if (callback) callback('read-only');
    return;
  }
  lastSaveRequestedAt = Date.now();
  // Deep-clone to avoid any reference issues
  var data = buildCurriculumValueForCms();
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
  var allSections = [];
  eachSection(function(s) { allSections.push(s); });
  var countEl = el('manager-section-count');
  if (countEl) countEl.textContent = allSections.length + ' section(s)';
  var container = el('sections-list');
  var empty = el('sections-empty');
  if (!container) {
    console.warn('[CURRICULUM:LOAD] #sections-list is missing from the page markup - check that the HTML file matches this JS build ' + TOOL_BUILD);
    return;
  }
  if (allSections.length === 0) {
    container.innerHTML = '';
    if (empty) empty.style.display = '';
  } else {
    if (empty) empty.style.display = 'none';
    container.innerHTML = renderSectionTreeHtml(sections, 0);
    bindSectionTreeEvents(container);
  }
  tool.resize();
}

/** Recursive section-tree HTML. Children are indented per depth level. */
function renderSectionTreeHtml(arr, depth) {
  if (!arr || !arr.length) return '';
  var sorted = arr.slice().sort(byOrder);
  var html = '';
  for (var i = 0; i < sorted.length; i++) {
    html += sectionCardHtml(sorted[i], depth);
    html += renderSectionTreeHtml(sorted[i].children, depth + 1);
  }
  return depth > 0 ? '<div class="manager-children">' + html + '</div>' : html;
}

/** HTML for one section/subsection card (with its own lessons) */
function sectionCardHtml(s, depth) {
  var secId = esc(s.id || '');
  var lessonsSorted = (s.lessons || []).slice().sort(byOrder);
  var childCount = (s.children || []).length;
  var titlePrefix = depth > 0 ? '↳ ' : '';
  return '<div class="manager-section-card">' +
    '<div class="manager-section-header">' +
      '<div class="manager-section-header-left">' +
        '<strong>' + titlePrefix + esc(s.title || 'Untitled') + '</strong>' +
        '<span class="section-meta">' + (s.lessons ? s.lessons.length : 0) + ' lesson(s)' + (childCount ? ' | ' + childCount + ' subsection(s)' : '') + ' | Order: ' + (s.order || '—') + '</span>' +
      '</div>' +
      '<div class="manager-section-actions">' +
        '<button class="btn btn-sm btn-primary" data-add-les="' + secId + '">+ Add Lesson</button>' +
        '<button class="btn btn-sm btn-outline" data-add-subsec="' + secId + '">+ Add Subsection</button>' +
        '<button class="btn btn-sm btn-outline" data-edit-sec="' + secId + '">✏️ Edit</button>' +
        '<button class="btn btn-sm btn-danger" data-del-sec="' + secId + '">🗑 Delete</button>' +
        '<button class="btn btn-sm btn-gen" data-gen-sec="' + secId + '" title="Serially generate missing AI content (Study Content, Slides, Flashcards, Quiz) for every lesson in this section and its subsections — already-filled content is skipped">🚀 Generate All</button>' +
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
          '<td><div class="table-actions"><button class="btn btn-sm btn-outline" data-edit-les="' + secId + ':' + lesRealIdx + '">✏️</button><button class="btn btn-sm btn-danger" data-del-les="' + secId + ':' + lesRealIdx + '">🗑</button><button class="btn btn-sm btn-gen" data-gen-les="' + secId + ':' + lesRealIdx + '" title="Serially generate missing AI content for this lesson — already-filled content is skipped">🚀</button></div></td></tr>';
      }).join('') + '</tbody></table>'
      : '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">No lessons yet. Click "+ Add Lesson" above to add one.</div>'
    ) +
  '</div>';
}

/** Wire up all buttons inside the rendered section tree */
function bindSectionTreeEvents(container) {
  function each(selector, fn) {
    var nodes = container.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      (function(node) {
        node.addEventListener('click', function(e) {
          e.stopPropagation();
          fn.call(node, e);
        });
      })(nodes[i]);
    }
  }
  each('[data-add-les]', function() { startAddLessonDirect(this.getAttribute('data-add-les')); });
  each('[data-add-subsec]', function() { openSectionEditor(null, this.getAttribute('data-add-subsec')); });
  each('[data-edit-sec]', function() { openSectionEditor(this.getAttribute('data-edit-sec'), null); });
  each('[data-del-sec]', function() { deleteSection(this.getAttribute('data-del-sec')); });
  each('[data-gen-sec]', function() {
    var targetSectionId = this.getAttribute('data-gen-sec');
    var targetSection = findSectionById(targetSectionId);
    var targetName = targetSection ? targetSection.section.title : 'this section';
    sandboxConfirm('🚀 Generate the missing AI content (Study Content, Slides, Flashcards, Quiz) for "' + targetName + '" and its subsections? It runs the four generators one after another and may take several minutes. Lessons that already have content are skipped.', function() {
      startBulkForSection(targetSectionId);
    }, 'Yes, Generate');
  });
  each('[data-edit-les]', function() {
    var parts = this.getAttribute('data-edit-les').split(':');
    editLessonDirect(parts[0], parseInt(parts[1]));
  });
  each('[data-del-les]', function() {
    var parts = this.getAttribute('data-del-les').split(':');
    deleteLessonDirect(parts[0], parseInt(parts[1]));
  });
  each('[data-gen-les]', function() {
    var parts = this.getAttribute('data-gen-les').split(':');
    sandboxConfirm('🚀 Generate the missing AI content (Study Content, Slides, Flashcards, Quiz) for this lesson? It runs the four generators one after another and may take a few minutes. Content that already exists is skipped.', function() {
      startBulkForLesson(parts[0], parseInt(parts[1]));
    }, 'Yes, Generate');
  });
  each('[data-open-doc]', function() { openLessonDocUrl(this.getAttribute('data-open-doc')); });
}

/* ═══════════════════════════════════════════
   SECTION EDITOR MODAL
   ═══════════════════════════════════════════ */

function openSectionEditor(sectionId, parentSectionId) {
  editingSectionParent = sections;
  editingSectionIdx = null;
  editingLessons = [];
  if (sectionId) {
    var found = findSectionById(sectionId);
    if (!found) return;
    editingSectionParent = found.parentArr;
    editingSectionIdx = found.index;
    var s = found.section;
    el('edit-section-title').value = s.title || '';
    el('edit-section-order').value = typeof s.order === 'number' ? s.order : '';
    editingLessons = JSON.parse(JSON.stringify(s.lessons || []));
    el('modal-title').textContent = found.depth > 0 ? 'Edit Subsection' : 'Edit Section';
  } else if (parentSectionId) {
    var parent = findSectionById(parentSectionId);
    if (!parent) return;
    if (!parent.section.children) parent.section.children = [];
    editingSectionParent = parent.section.children;
    editingSectionIdx = null;
    el('edit-section-title').value = '';
    el('edit-section-order').value = editingSectionParent.length + 1;
    editingLessons = [];
    el('modal-title').textContent = 'Add Subsection to "' + (parent.section.title || 'Section') + '"';
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
  editingSectionParent = null;
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

  if (editingSectionIdx !== null && editingSectionParent && editingSectionParent[editingSectionIdx]) {
    var existing = editingSectionParent[editingSectionIdx];
    sectionData.id = existing.id;
    if (existing.children && existing.children.length) sectionData.children = existing.children; // preserve subsections
    editingSectionParent[editingSectionIdx] = sectionData;
  } else if (editingSectionParent) {
    editingSectionParent.push(sectionData);
  } else {
    sections.push(sectionData);
  }

  saveCurriculum(function(err) {
    if (err) return;
    closeSectionEditor();
    tool.notify('Section saved! ✅', 'success');
  });
}

function deleteSection(sectionId) {
  var found = findSectionById(sectionId);
  if (!found) return;
  var s = found.section;
  var lessonCount = countSubtreeLessons(s);
  var childCount = (s.children || []).length;
  var msg = 'Delete "' + (s.title || 'this section') + '"';
  if (lessonCount) msg += ' and its ' + lessonCount + ' lesson(s)';
  if (childCount) msg += ' and ' + childCount + ' subsection(s)';
  msg += '? This cannot be undone.';
  sandboxConfirm(msg, function() {
    found.parentArr.splice(found.index, 1);
    // Clean up lesson docs for the whole subtree
    var docIds = collectSubtreeLessonDocIds(s);
    for (var d = 0; d < docIds.length; d++) deleteLessonDoc(docIds[d]);
    saveCurriculum(function(err) {
      if (err) return;
      tool.notify('Section deleted.', 'info');
    });
  }, 'Yes, Delete');
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
        var delLesIdx = parseInt(this.getAttribute('data-del-les'));
        var delLesTitle = (editingLessons[delLesIdx] && editingLessons[delLesIdx].title) ? editingLessons[delLesIdx].title : 'this lesson';
        sandboxConfirm('Delete the lesson "' + delLesTitle + '" from this section? This cannot be undone.', function() {
          editingLessons.splice(delLesIdx, 1);
          renderLessonsEditorList();
        }, 'Yes, Delete');
      });
    }
  }
}

/* ═══════════════════════════════════════════
   LESSON EDITOR (tabbed panel)
   ═══════════════════════════════════════════ */

function startAddLesson() {
  editingDirectSection = null;  // ensure direct mode is off
  editingLessonIdx = null;
  el('edit-lesson-title').value = '';
  el('edit-lesson-order').value = editingLessons.length + 1;
  el('edit-lesson-minutes').value = '';
  editingStudyDocGeneratedHtmlMap = {};
  studioGeneratedHtml = '';
  editingYoutubeUrls = []; editingYoutubeIdx = null;
  renderYoutubeEditorList();
  hideSubModal('youtube-editor-panel');
  editingPresentationPdfUrls = []; editingStudyDocPdfUrls = []; editingWorksheetPdfUrls = []; editingAnswerKeyPdfUrls = []; editingHtmlDocUrls = [];
  editingHiddenDocUrls = [];
  editingFlashcards = [];
  editingPdfIdx = null; editingPdfType = null; editingPdfSourceUrl = '';
  renderPdfEditorList();
  hideSubModal('pdf-editor-panel');
  renderFlashcardsEditorList();
  editingHtmlCode = '';
  editingStudyHtmlData = null;
  editingStudyDocImages = [];
  editingStudyDocSources = [];
  editingStudyDocImagesMap = {};
  studioCurrentDocUrl = '';
  renderPdfEditorList();
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
  editingPdfIdx = null; editingPdfType = null; editingPdfSourceUrl = '';
  renderPdfEditorList();
  hideSubModal('pdf-editor-panel');
  var fcVal = les.flashcards;
  if (fcVal && typeof fcVal === 'string') { try { fcVal = JSON.parse(fcVal); } catch(e) { fcVal = null; } }
  editingFlashcards = (fcVal && Array.isArray(fcVal)) ? JSON.parse(JSON.stringify(fcVal)) : [];
  renderFlashcardsEditorList();
  editingHtmlCode = les.htmlCode || '';
  editingStudyHtmlData = les.studyHtmlData || null;
  editingStudyDocSources = (les.studyDocSources && Array.isArray(les.studyDocSources)) ? JSON.parse(JSON.stringify(les.studyDocSources)) : [];
  editingStudyDocImagesMap = (les.studyDocImages && typeof les.studyDocImages === 'object' && !Array.isArray(les.studyDocImages)) ? JSON.parse(JSON.stringify(les.studyDocImages)) : {};
  editingStudyDocGeneratedHtmlMap = (les.studyDocGenerated && typeof les.studyDocGenerated === 'object' && !Array.isArray(les.studyDocGenerated)) ? JSON.parse(JSON.stringify(les.studyDocGenerated)) : {};
  studioGeneratedHtml = '';
  editingStudyDocImages = [];
  studioCurrentDocUrl = '';
  editingPresentationHtml = les.presentationHtml || '';
  editingHiddenSections = (les.hiddenSections && Array.isArray(les.hiddenSections)) ? JSON.parse(JSON.stringify(les.hiddenSections)) : [];
  updateAllVisToggles();
  if (el('edit-html-code')) el('edit-html-code').value = editingHtmlCode;
  if (el('edit-html-code-v2')) el('edit-html-code-v2').value = editingHtmlCode;
  // Repair lessons whose htmlCode holds raw component JSON (pasted or saved
  // by an older flow): re-render it so the preview and the student tool work.
  // Runs AFTER the textareas are filled so the check reads THIS lesson's
  // content, never a stale value from the previously edited lesson.
  normalizeStudyContentInput(false);
  renderStudyDocStudio();
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
  // Pasted AI component JSON is rendered to HTML before saving, so the
  // student tool can display it (it renders htmlCode, not studyHtmlData).
  normalizeStudyContentInput(true);

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
    studyDocSources: editingStudyDocSources.length > 0 ? JSON.parse(JSON.stringify(editingStudyDocSources)) : null,
    studyDocImages: Object.keys(editingStudyDocImagesMap).length > 0 ? JSON.parse(JSON.stringify(editingStudyDocImagesMap)) : null,
    studyDocGenerated: Object.keys(editingStudyDocGeneratedHtmlMap).length > 0 ? JSON.parse(JSON.stringify(editingStudyDocGeneratedHtmlMap)) : null,
    presentationHtml: editingPresentationHtml || null,
    hiddenSections: editingHiddenSections.length > 0 ? JSON.parse(JSON.stringify(editingHiddenSections)) : null,
    flashcards: editingFlashcards.length > 0 ? JSON.parse(JSON.stringify(editingFlashcards)) : null,
    sourceUrls: editingSourceLinks.length > 0 ? JSON.parse(JSON.stringify(editingSourceLinks)) : null,
    quiz: editingQuizQuestions.length > 0 ? JSON.parse(JSON.stringify(editingQuizQuestions)) : null,
    lessonDocId: null  // populated by saveLessonDoc below
  };

  // Direct mode: save to editingDirectSection.lessons and persist immediately
  if (editingDirectSection) {
    var sec = editingDirectSection;
    if (!sec.lessons) sec.lessons = [];
    if (editingLessonIdx !== null && sec.lessons[editingLessonIdx]) {
      lessonData.id = sec.lessons[editingLessonIdx].id;
      lessonData.lessonDocId = sec.lessons[editingLessonIdx].lessonDocId || null;
    }
    var savedSectionId = sec.id;  // capture before clearing
    var savedLessonId = lessonData.id;
    // Place the lesson in the section immediately (heavy for now — the lesson
    // doc sync below strips it from the main doc once the copy is confirmed).
    sec.lessons = sec.lessons.filter(function(l) { return l.id !== savedLessonId; });
    sec.lessons.push(lessonData);
    hideSubModal('lesson-editor-panel');
    editingDirectSection = null;

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
      // Ensure the lesson is present in the CURRENT tree copy
      // (onValueChange may have replaced `sections` during the async call).
      var foundNow = findSectionById(savedSectionId);
      var secNow = foundNow ? foundNow.section : sec;
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
  editingDirectSection = null;
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
  if (editingDirectSection) {
    var foundSec = findSectionById(editingDirectSection.id);
    var sec = foundSec ? foundSec.section : editingDirectSection;
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

  // Pasted AI component JSON is rendered to HTML before persisting.
  normalizeStudyContentInput(false);
  persistStudioImages();

  // Sync current editor state into the lesson object
  targetLesson.htmlCode = editingHtmlCode || null;
  targetLesson.studyHtmlData = editingStudyHtmlData || null;
  targetLesson.studyDocSources = editingStudyDocSources.length > 0 ? JSON.parse(JSON.stringify(editingStudyDocSources)) : null;
  targetLesson.studyDocImages = Object.keys(editingStudyDocImagesMap).length > 0 ? JSON.parse(JSON.stringify(editingStudyDocImagesMap)) : null;
  targetLesson.studyDocGenerated = Object.keys(editingStudyDocGeneratedHtmlMap).length > 0 ? JSON.parse(JSON.stringify(editingStudyDocGeneratedHtmlMap)) : null;
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
    tool.setValue(buildCurriculumValueForCms());
    requestParentSave();
    updateAllVisToggles();
    return;
  }
  var autoSaveLessonId = targetLesson.id;
  saveLessonDoc(targetLesson, function(docErr, docId) {
    if (docId && !targetLesson.lessonDocId) {
      targetLesson.lessonDocId = docId;
      // Update the lessonDocId on the CURRENT tree copy too
      collectAllLessons().forEach(function(r) {
        if (r.lesson.id === autoSaveLessonId) r.lesson.lessonDocId = docId;
      });
    }
    if (docErr) {
      console.warn('autoSaveCurrentLesson: lesson doc save failed, heavy content kept in main doc:', docErr);
    } else {
      stripHeavyLessonFields(targetLesson);
    }
    tool.reportValid(true, '');
    tool.setValue(buildCurriculumValueForCms());
    requestParentSave();
    updateAllVisToggles();
  });
}

/* ── Direct Lesson Management (from main view, bypasses section modal) ── */

/** Documents, links and gallery images are lesson data - persist them at once. */
function autoSaveLessonAfterDocumentChange(reasonLabel) {
  if (tool.isReadOnly()) return;
  console.log('[STUDIO:SAVE] ' + reasonLabel + ' - saving the lesson now');
  autoSaveCurrentLesson();
}

function startAddLessonDirect(sectionId) {
  var found = findSectionById(sectionId);
  if (!found) return;
  editingDirectSection = found.section;
  editingSectionIdx = null;  // ensure modal mode is off
  editingLessonIdx = null;
  el('edit-lesson-title').value = '';
  el('edit-lesson-order').value = (editingDirectSection.lessons || []).length + 1;
  el('edit-lesson-minutes').value = '';
  editingStudyDocGeneratedHtmlMap = {};
  studioGeneratedHtml = '';
  editingYoutubeUrls = []; editingYoutubeIdx = null;
  renderYoutubeEditorList();
  hideSubModal('youtube-editor-panel');
  editingPresentationPdfUrls = []; editingStudyDocPdfUrls = []; editingWorksheetPdfUrls = []; editingAnswerKeyPdfUrls = []; editingHtmlDocUrls = [];
  editingHiddenDocUrls = [];
  editingPdfIdx = null; editingPdfType = null; editingPdfSourceUrl = '';
  renderPdfEditorList();
  hideSubModal('pdf-editor-panel');
  renderFlashcardsEditorList();
  editingHtmlCode = '';
  editingStudyHtmlData = null;
  editingStudyDocImages = [];
  editingStudyDocSources = [];
  editingStudyDocImagesMap = {};
  studioCurrentDocUrl = '';
  renderPdfEditorList();
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
  el('lesson-editor-heading').textContent = 'Add Lesson to ' + (editingDirectSection.title || 'Section');
}

function editLessonDirect(sectionId, lessonIdx) {
  var found = findSectionById(sectionId);
  if (!found) return;
  editingDirectSection = found.section;
  editingSectionIdx = null;
  editingLessonIdx = lessonIdx;
  var les = editingDirectSection.lessons && editingDirectSection.lessons[lessonIdx];
  if (!les) return;
  // Phase 1: try to load heavy content from lesson doc, fall back to main doc
  loadLessonDoc(les, function(err, enrichedLes) {
    populateEditorFromLesson(enrichedLes || les);
  });
}

function deleteLessonDirect(sectionId, lessonIdx) {
  var found = findSectionById(sectionId);
  if (!found) return;
  var sec = found.section;
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
  }, 'Yes, Delete');
}

/* ═══════════════════════════════════════════
   BULK SERIAL AI GENERATION
   Runs the four AI generators one after another for a scope of lessons.
   Each generator is skipped when its target field is already filled.
   ═══════════════════════════════════════════ */

var BULK_GEN_STEPS = [
  { name: 'Study Content', filled: function() {
      return !!((editingHtmlCode && editingHtmlCode.length > 20) ||
                (editingStudyHtmlData && editingStudyHtmlData.components && editingStudyHtmlData.components.length > 0));
    }, run: function(cb) { generateHtmlFromPdf(cb); } },
  { name: 'Presentation Slides', filled: function() {
      return !!(editingPresentationHtml && editingPresentationHtml.length > 50);
    }, run: function(cb) { generatePresentationFromPdf(cb); } },
  { name: 'Flashcards', filled: function() {
      return editingFlashcards.length > 0;
    }, run: function(cb) { generateFlashcardsFromPdf(cb); } },
  { name: 'Quiz Questions', filled: function() {
      return editingQuizQuestions.length > 0;
    }, run: function(cb) { generateQuizFromPdf(cb); } }
];

/** Lesson refs for an entire curriculum (all top-level sections + subsections) */
function bulkRefsForCurriculum() {
  var refs = [];
  for (var si = 0; si < sections.length; si++) {
    collectSubtreeLessons(sections[si]).forEach(function(r) {
      refs.push({ sectionId: r.section.id, lessonId: r.lesson.id });
    });
  }
  return refs;
}

/** Lesson refs for a section and its whole subtree */
function bulkRefsForSection(sectionId) {
  var found = findSectionById(sectionId);
  if (!found) return [];
  var refs = [];
  collectSubtreeLessons(found.section).forEach(function(r) {
    refs.push({ sectionId: r.section.id, lessonId: r.lesson.id });
  });
  return refs;
}

/** Single-lesson refs */
function bulkRefsForLesson(sectionId, li) {
  var found = findSectionById(sectionId);
  if (!found || !found.section.lessons || !found.section.lessons[li]) return [];
  return [{ sectionId: sectionId, lessonId: found.section.lessons[li].id }];
}

function startBulkForSection(sectionId) {
  var found = findSectionById(sectionId);
  runBulkGeneration(bulkRefsForSection(sectionId), found ? '"' + found.section.title + '"' : 'section');
}

function startBulkForLesson(sectionId, li) {
  runBulkGeneration(bulkRefsForLesson(sectionId, li), 'lesson');
}

function startBulkForCurriculum() {
  runBulkGeneration(bulkRefsForCurriculum(), 'curriculum');
}

/** Serial bulk generation: open each lesson, run the four AI steps one by
 *  one, skip steps whose fields are already filled, then move to the next
 *  lesson. Safe against concurrent runs (guarded by bulkGenRunning). */
function runBulkGeneration(refs, scopeLabel) {
  if (!refs || refs.length === 0) { tool.notify('No lessons in this scope.', 'info'); return; }
  if (bulkGenRunning) { tool.notify('A bulk generation is already running — please wait for it to finish.', 'warning'); return; }
  if (tool.isReadOnly()) { tool.notify('Cannot generate — the form is in read-only mode.', 'warning'); return; }
  bulkGenRunning = true;
  var queue = refs.slice();
  var total = queue.length;
  var done = 0;
  var skipped = 0;

  function finishAll() {
    bulkGenRunning = false;
    cancelLessonEditor();
    renderSections();
    var msg = '✅ Bulk generation finished: ' + done + ' of ' + total + ' lesson(s) processed';
    if (skipped > 0) msg += ' — ' + skipped + ' skipped (no base PDFs)';
    tool.notify(msg + '.', 'success');
  }

  function nextLesson() {
    if (!queue.length) { finishAll(); return; }
    var ref = queue.shift();
    var found = findSectionById(ref.sectionId);
    var section = found ? found.section : null;
    if (!section) { nextLesson(); return; }
    var li = indexOfLessonById(section.lessons, ref.lessonId);
    if (li === -1) { nextLesson(); return; }
    var lesson = section.lessons[li];

    editingDirectSection = section;
    editingSectionIdx = null;
    editingLessonIdx = li;

    // Base-content guard: AI generation needs source PDFs. The PDF URL arrays
    // are light fields on the lesson, so check BEFORE loading the lesson doc
    // or opening the editor — no PDFs means the run doesn't start for this lesson.
    var basePdfs = (lesson.presentationPdfUrls || []).length +
                   (lesson.studyDocPdfUrls || []).length +
                   (lesson.worksheetPdfUrls || []).length;
    if (basePdfs === 0) {
      tool.notify('⏭️ ' + (lesson.title || 'Lesson') + ' has no PDFs to generate from — skipped.', 'info');
      skipped++;
      done++;
      nextLesson();
      return;
    }

    loadLessonDoc(lesson, function(err, enriched) {
      populateEditorFromLesson(enriched || lesson);
      if (el('lesson-editor-heading')) {
        el('lesson-editor-heading').textContent = '🤖 Auto-generating: ' + (lesson.title || 'Lesson') + ' (' + (done + 1) + '/' + total + ')';
      }
      runStepsForLesson(0, function() {
        done++;
        nextLesson();
      });
    });
  }

  function runStepsForLesson(stepIdx, lessonDone) {
    if (stepIdx >= BULK_GEN_STEPS.length) { lessonDone(); return; }
    var step = BULK_GEN_STEPS[stepIdx];
    if (step.filled()) {
      // Field already filled — never regenerate
      setTimeout(function() { runStepsForLesson(stepIdx + 1, lessonDone); }, 50);
      return;
    }
    tool.notify('🤖 ' + (el('edit-lesson-title').value || 'Lesson') + ': ' + step.name + '…', 'info');
    step.run(function(err) {
      if (err) tool.notify('⚠️ ' + step.name + ' skipped: ' + err, 'warning');
      setTimeout(function() { runStepsForLesson(stepIdx + 1, lessonDone); }, 150);
    });
  }

  tool.notify('🚀 Bulk generation started: ' + total + ' lesson(s) in ' + (scopeLabel || 'scope') + '. Keep this page open.', 'info');
  nextLesson();
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
          var optionsPills = (q.options || []).map(function(opt, oi) {
            var isCorrect = oi === q.answer;
            return '<span class="quiz-opt-pill' + (isCorrect ? ' quiz-opt-correct' : '') + '">' + (isCorrect ? '✅ ' : '') + esc(opt) + '</span>';
          }).join('');
          var explanationSnippet = (q.explanation_correct || '').substring(0, 140);
          return '<div class="quiz-editor-item"><div class="quiz-editor-item-info"><div class="quiz-editor-item-title">' + (globalIdx + 1) + '. ' + esc(q.question || 'Untitled') +
            (q.difficulty ? ' <span class="quiz-difficulty difficulty-' + q.difficulty + '">' + q.difficulty + '</span>' : '') +
            '</div><div class="quiz-editor-options">' + optionsPills + '</div>' +
            '<div class="quiz-editor-item-meta">' + (q.options ? q.options.length : 0) + ' options · Answer: ' + esc(answerLabel) + (explanationSnippet ? ' · 💡 ' + esc(explanationSnippet) : '') + '</div></div>' +
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
      delBtns[j].addEventListener('click', function(e) {
        e.stopPropagation();
        var delQuizIdx = parseInt(this.getAttribute('data-del-quiz-idx'));
        var delQuizQuestion = (editingQuizQuestions[delQuizIdx] && editingQuizQuestions[delQuizIdx].question) ? editingQuizQuestions[delQuizIdx].question : 'this question';
        sandboxConfirm('Delete quiz question "' + (delQuizQuestion.length > 60 ? delQuizQuestion.substring(0, 60) + '…' : delQuizQuestion) + '"? Students will no longer answer it.', function() {
          editingQuizQuestions.splice(delQuizIdx, 1);
          renderQuizEditorList();
        }, 'Yes, Delete');
      });
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
      delBtns[j].addEventListener('click', function(e) {
        e.stopPropagation();
        var delSlIdx = parseInt(this.getAttribute('data-del-sl-idx'));
        var delSlLabel = (editingSourceLinks[delSlIdx] && editingSourceLinks[delSlIdx].label) ? editingSourceLinks[delSlIdx].label : 'this link';
        sandboxConfirm('Delete the resource link "' + delSlLabel + '"? Students will no longer see it.', function() {
          editingSourceLinks.splice(delSlIdx, 1);
          renderSourceLinksEditorList();
        }, 'Yes, Delete');
      });
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
      delBtns[j].addEventListener('click', function(e) {
        e.stopPropagation();
        var delYtIdx = parseInt(this.getAttribute('data-del-yt-idx'));
        var delYtUrl = editingYoutubeUrls[delYtIdx] || '';
        sandboxConfirm('Delete this video? Students will no longer see it in the study flow: ' + delYtUrl, function() {
          editingYoutubeUrls.splice(delYtIdx, 1);
          renderYoutubeEditorList();
        }, 'Yes, Delete');
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

/** True when a URL belongs to the source-document list (not a Real file) */
function isSourceDocumentUrl(url) {
  for (var i = 0; i < editingStudyDocSources.length; i++) {
    if (editingStudyDocSources[i].url === url) return true;
  }
  return false;
}

/** Remove a URL from whichever Real type array holds it. Returns its type or ''. */
function removeRealDocumentUrl(url) {
  var typeKeys = ['presentation', 'studyDoc', 'worksheet', 'answerKey', 'htmlDoc'];
  for (var t = 0; t < typeKeys.length; t++) {
    var arr = getPdfArray(typeKeys[t]);
    var idx = arr.indexOf(url);
    if (idx !== -1) {
      arr.splice(idx, 1);
      return typeKeys[t];
    }
  }
  return '';
}

/** Unified documents list: every Ready and Sample document in one list */
function renderPdfEditorList() {
  var list = el('pdf-list-all');
  var count = el('pdf-count-all');
  if (!list) return;
  var rows = [];
  var typeKeys = ['presentation', 'studyDoc', 'worksheet', 'answerKey', 'htmlDoc'];
  for (var t = 0; t < typeKeys.length; t++) {
    var arr = getPdfArray(typeKeys[t]);
    for (var i = 0; i < arr.length; i++) rows.push({ type: typeKeys[t], idx: i, url: arr[i], role: 'real' });
  }
  for (var s = 0; s < editingStudyDocSources.length; s++) {
    rows.push({ type: editingStudyDocSources[s].type || 'studyDoc', url: editingStudyDocSources[s].url, role: 'source' });
  }
  if (count) count.textContent = rows.length + ' document(s)';
  if (rows.length === 0) {
    list.innerHTML = '<div style="padding:10px 12px;text-align:center;color:var(--text-muted);font-size:12px;">No documents yet. Click "+ Add URL" or "⬆ Upload". ✅ Ready = your processed file used for AI content generation. 🧭 Sample = an outside sample used only to create your own Ready document.</div>';
    return;
  }
  list.innerHTML = rows.map(function(row) {
    var info = PDF_LABELS[row.type] || {};
    var displayName = readableFileName(row.url);
    var isHidden = row.role === 'real' && editingHiddenDocUrls.indexOf(row.url) !== -1;
    var typeBadge = '<span class="doc-type-badge">' + (info.icon || '📎') + ' ' + esc(info.label || row.type) + '</span>';
    var roleBadge = row.role === 'real' ? '<span class="doc-role-badge real">✅ Ready</span>' : '<span class="doc-role-badge source">🧭 Sample</span>';
    var imageCount = studioDocImageCount(row.url);
    var imageNote = imageCount ? ' · 🖼 ' + imageCount + ' image(s)' : '';
    var visibilityChip = row.role === 'real'
      ? (isHidden ? '<span class="doc-vis-chip hidden" title="Students cannot see this document">🙈 Hidden</span>' : '<span class="doc-vis-chip" title="Students can see this document">👁 Visible</span>')
      : '';
    var editButton = row.role === 'real'
      ? '<button class="btn btn-sm btn-outline doc-icon-btn" data-edit-pdf="' + row.type + ':' + row.idx + '" title="Edit this document (role, visibility, URL, delete)">✏️</button>'
      : '<button class="btn btn-sm btn-outline doc-icon-btn" data-edit-source="' + esc(row.url) + '" title="Edit this sample document (role, URL, delete)">✏️</button>';
    var downloadButton = '<button class="btn btn-sm btn-outline doc-icon-btn" data-download-doc="' + esc(row.url) + '" title="Download this file to your device">⬇</button>';
    var processButton = '<button class="btn btn-sm btn-primary doc-icon-btn" data-process-doc="' + esc(row.url) + '" title="Open the processing drawer for this document (extract images, upload, generate content)">⚙️</button>';
    return '<div class="source-link-editor-item"><div class="source-link-editor-item-info">' +
      '<div class="source-link-editor-item-title">' + typeBadge + roleBadge + visibilityChip + esc(displayName) + '</div>' +
      '<div class="source-link-editor-item-meta" title="' + esc(row.url) + '">' + esc(row.url.substring(0, 70)) + imageNote + '</div></div>' +
      '<div class="source-link-editor-item-actions">' + downloadButton + editButton + processButton + '</div></div>';
  }).join('');

  // ⬇ Download any document straight to the device
  var downloadBtns = list.querySelectorAll('[data-download-doc]');
  for (var dB = 0; dB < downloadBtns.length; dB++) {
    downloadBtns[dB].addEventListener('click', function(e) {
      e.stopPropagation();
      downloadStudyDocFile(this.getAttribute('data-download-doc'));
    });
  }

  // ✏️ Edit (Ready document)
  var editBtns = list.querySelectorAll('[data-edit-pdf]');
  for (var e2 = 0; e2 < editBtns.length; e2++) {
    editBtns[e2].addEventListener('click', function(e) {
      e.stopPropagation();
      var parts = this.getAttribute('data-edit-pdf').split(':');
      openPdfEditor(parts[0], parseInt(parts[1]));
    });
  }
  // ✏️ Edit (Sample document)
  var editSourceBtns = list.querySelectorAll('[data-edit-source]');
  for (var e3 = 0; e3 < editSourceBtns.length; e3++) {
    editSourceBtns[e3].addEventListener('click', function(e) {
      e.stopPropagation();
      openPdfEditor('studyDoc', null, this.getAttribute('data-edit-source'));
    });
  }
  // ⚙️ Open the processing drawer (Ready or Sample) - the pipeline itself is
  // started from the drawer's Process button, so no confirm pops up here.
  var processBtns = list.querySelectorAll('[data-process-doc]');
  for (var pB = 0; pB < processBtns.length; pB++) {
    processBtns[pB].addEventListener('click', function(e) {
      e.stopPropagation();
      openStudioDrawerForDoc(this.getAttribute('data-process-doc'));
    });
  }
}

function openPdfEditor(type, idx, sourceUrl) {
  editingPdfSourceUrl = sourceUrl || '';
  if (editingPdfSourceUrl) {
    // Editing a Sample: resolve its stored type for the heading/label
    for (var srcScan = 0; srcScan < editingStudyDocSources.length; srcScan++) {
      if (editingStudyDocSources[srcScan].url === editingPdfSourceUrl) {
        type = editingStudyDocSources[srcScan].type || type;
        break;
      }
    }
  }
  editingPdfType = type;
  editingPdfIdx = idx;
  showSubModal('pdf-editor-panel');
  var info = PDF_LABELS[type] || {};
  var isEdit = idx !== null || !!editingPdfSourceUrl;
  el('pdf-editor-heading').textContent = (isEdit ? 'Edit' : 'Add') + ' ' + (info.label || 'Document');
  var typeGroup = el('pdf-editor-type-group');
  var typeSelect = el('edit-pdf-item-type');
  if (typeGroup) typeGroup.style.display = isEdit ? 'none' : '';
  var urlValue = '';
  if (editingPdfSourceUrl) {
    for (var sIdx = 0; sIdx < editingStudyDocSources.length; sIdx++) {
      if (editingStudyDocSources[sIdx].url === editingPdfSourceUrl) {
        urlValue = editingStudyDocSources[sIdx].url;
        if (typeSelect) typeSelect.value = editingStudyDocSources[sIdx].type || 'studyDoc';
        break;
      }
    }
  } else if (idx !== null) {
    var arr = getPdfArray(type);
    urlValue = arr[idx] || '';
  }
  if (typeSelect && !editingPdfSourceUrl) typeSelect.value = type;
  el('edit-pdf-item-url').value = urlValue;
  updatePdfEditorRoleSwitch();
  updatePdfEditorVisSwitch();
  var deleteButton = el('btn-pdf-editor-delete');
  if (deleteButton) deleteButton.style.display = isEdit ? '' : 'none';
  // Update the URL label and button text based on type (the URL label is
  // the LAST .form-label inside the panel - the first one is the type).
  var isHtml = type === 'htmlDoc';
  var panelLabels = document.querySelectorAll('#pdf-editor-panel .form-label');
  var urlLabel = panelLabels.length ? panelLabels[panelLabels.length - 1] : null;
  if (urlLabel) urlLabel.textContent = (isHtml ? 'Web Document URL' : 'Document URL') + ' *';
  var btnEl = el('btn-pdf-editor-save');
  if (btnEl) btnEl.textContent = 'Save ' + (isHtml ? 'HTML Doc' : 'Document');
}

/** Reflect the current role in the edit drawer's Ready/Sample switch.
 *  Checked = Ready (positive state), unchecked = Sample. */
function updatePdfEditorRoleSwitch() {
  var roleSwitch = el('edit-pdf-item-role');
  var stateEl = el('pdf-editor-role-state');
  var visGroup = el('pdf-editor-vis-group');
  var roleHint = el('pdf-editor-role-hint');
  var isSample = !!editingPdfSourceUrl;
  if (roleSwitch) roleSwitch.checked = !isSample;
  if (stateEl) stateEl.textContent = isSample ? 'Sample' : 'Ready';
  if (visGroup) visGroup.style.display = isSample ? 'none' : '';
  if (roleHint) roleHint.textContent = isSample
    ? 'Sample = an outside document used only as the input for creating your own Ready document. It is never shown to students.'
    : 'Ready = your own processed file, shown to students and used for AI content generation in the other tabs.';
}

/** Reflect the current visibility in the edit drawer's Visible/Hidden switch.
 *  Checked = Visible (positive state), unchecked = Hidden. */
function updatePdfEditorVisSwitch() {
  var visSwitch = el('edit-pdf-item-vis');
  var stateEl = el('pdf-editor-vis-state');
  if (!visSwitch) return;
  var targetUrl = editingPdfSourceUrl;
  if (!targetUrl && editingPdfIdx !== null && editingPdfType) targetUrl = (getPdfArray(editingPdfType)[editingPdfIdx] || '');
  var isHidden = !!targetUrl && editingHiddenDocUrls.indexOf(targetUrl) !== -1;
  visSwitch.checked = !isHidden;
  if (stateEl) stateEl.textContent = isHidden ? 'Hidden' : 'Visible';
}

function closePdfEditor() { hideSubModal('pdf-editor-panel'); editingPdfType = null; editingPdfIdx = null; editingPdfSourceUrl = ''; }

/** Add or remove a document url in the hidden list */
function setDocHiddenState(docUrl, hidden) {
  var hidx = editingHiddenDocUrls.indexOf(docUrl);
  if (hidden && hidx === -1) editingHiddenDocUrls.push(docUrl);
  if (!hidden && hidx !== -1) editingHiddenDocUrls.splice(hidx, 1);
}

function savePdfUrl() {
  var url = el('edit-pdf-item-url').value.trim();
  if (!url) { tool.notify('Document URL is required.', 'warning'); return; }
  var roleSwitch = el('edit-pdf-item-role');
  var wantSample = roleSwitch ? !roleSwitch.checked : !!editingPdfSourceUrl;
  var targetType = editingPdfType || 'studyDoc';
  if (!editingPdfSourceUrl && editingPdfIdx === null) {
    var typeSelect = el('edit-pdf-item-type');
    if (typeSelect && typeSelect.value) targetType = typeSelect.value;
  } else if (editingPdfSourceUrl) {
    // Editing a Sample keeps its stored type
    for (var stIdx = 0; stIdx < editingStudyDocSources.length; stIdx++) {
      if (editingStudyDocSources[stIdx].url === editingPdfSourceUrl) {
        targetType = editingStudyDocSources[stIdx].type || 'studyDoc';
        break;
      }
    }
  }
  // Duplicate check across every Ready list and the Sample list (skip the row being edited)
  var allTypes = ['presentation', 'studyDoc', 'worksheet', 'answerKey', 'htmlDoc'];
  for (var t = 0; t < allTypes.length; t++) {
    var checkArr = getPdfArray(allTypes[t]);
    for (var c = 0; c < checkArr.length; c++) {
      if (!editingPdfSourceUrl && allTypes[t] === targetType && c === editingPdfIdx) continue;
      if (checkArr[c].trim().toLowerCase() === url.trim().toLowerCase()) {
        var label = (PDF_LABELS[allTypes[t]] || {}).label || allTypes[t];
        tool.notify('This URL is already a Ready ' + label + '.', 'warning');
        return;
      }
    }
  }
  for (var sc = 0; sc < editingStudyDocSources.length; sc++) {
    if (editingStudyDocSources[sc].url === editingPdfSourceUrl) continue;
    if (editingStudyDocSources[sc].url.trim().toLowerCase() === url.trim().toLowerCase()) {
      tool.notify('This URL is already a Sample document.', 'warning');
      return;
    }
  }
  var visSwitch = el('edit-pdf-item-vis');
  var wantHidden = visSwitch ? !visSwitch.checked : false;

  if (editingPdfSourceUrl) {
    // Editing a Sample: stays Sample or becomes Ready
    for (var rmIdx = 0; rmIdx < editingStudyDocSources.length; rmIdx++) {
      if (editingStudyDocSources[rmIdx].url === editingPdfSourceUrl) {
        editingStudyDocSources.splice(rmIdx, 1);
        break;
      }
    }
    if (wantSample) {
      editingStudyDocSources.push({ url: url, name: readableFileName(url), type: targetType });
      tool.notify('Sample document saved.', 'success');
    } else {
      getPdfArray(targetType).push(url);
      setDocHiddenState(url, wantHidden);
      tool.notify('Document saved as Ready - students will see it and AI generation may use it.', 'success');
    }
  } else if (editingPdfIdx !== null) {
    // Editing a Ready: stays Ready or becomes Sample
    var arr = getPdfArray(targetType);
    var oldUrl = arr[editingPdfIdx] || '';
    if (wantSample) {
      arr.splice(editingPdfIdx, 1);
      setDocHiddenState(oldUrl, false);
      editingStudyDocSources.push({ url: url, name: readableFileName(url), type: targetType });
      tool.notify('Document saved as Sample - it is now the input for creating your own Ready document and is not shown to students.', 'info');
    } else {
      arr[editingPdfIdx] = url;
      setDocHiddenState(url, wantHidden);
      tool.notify('Document saved!', 'success');
    }
  } else {
    // Adding a new document
    if (wantSample) {
      editingStudyDocSources.push({ url: url, name: readableFileName(url), type: targetType });
      tool.notify('Sample document added - use it to create your own Ready document.', 'info');
    } else {
      getPdfArray(targetType).push(url);
      setDocHiddenState(url, wantHidden);
      tool.notify('Document saved!', 'success');
    }
  }
  // Keep the image gallery attached when a Sample's URL changed
  if (editingPdfSourceUrl && editingPdfSourceUrl !== url && editingStudyDocImagesMap[editingPdfSourceUrl]) {
    editingStudyDocImagesMap[url] = editingStudyDocImagesMap[editingPdfSourceUrl];
    delete editingStudyDocImagesMap[editingPdfSourceUrl];
    if (studioCurrentDocUrl === editingPdfSourceUrl) studioCurrentDocUrl = url;
  }
  closePdfEditor();
  renderPdfEditorList();
  autoSaveLessonAfterDocumentChange('document added or edited');
}

/** 🗑 Delete the document open in the edit drawer */
function deletePdfFromEditor() {
  if (editingPdfSourceUrl) {
    var sampleUrl = editingPdfSourceUrl;
    sandboxConfirm('Delete sample document "' + readableFileName(sampleUrl) + '"? Its extracted images are removed from this lesson, but study content already generated from it keeps its own embedded copy and is not affected.', function() {
      for (var d1 = 0; d1 < editingStudyDocSources.length; d1++) {
        if (editingStudyDocSources[d1].url === sampleUrl) { editingStudyDocSources.splice(d1, 1); break; }
      }
      delete editingStudyDocImagesMap[sampleUrl];
      if (studioCurrentDocUrl === sampleUrl) closeStudioDrawer();
      closePdfEditor();
      renderPdfEditorList();
      autoSaveLessonAfterDocumentChange('sample document deleted');
      tool.notify('Sample document deleted.', 'info');
    }, 'Yes, Delete');
    return;
  }
  if (editingPdfIdx === null || !editingPdfType) return;
  var arr = getPdfArray(editingPdfType);
  var delUrl = arr[editingPdfIdx];
  if (!delUrl) return;
  var delLabel = (PDF_LABELS[editingPdfType] || {}).label || editingPdfType;
  sandboxConfirm('Delete "' + readableFileName(delUrl) + '" (' + delLabel + ')? Students will no longer see it. Content already generated from this document keeps its embedded images and is not affected.', function() {
    arr.splice(editingPdfIdx, 1);
    setDocHiddenState(delUrl, false);
    closePdfEditor();
    renderPdfEditorList();
    autoSaveLessonAfterDocumentChange('document deleted');
    tool.notify('Document deleted.', 'info');
  }, 'Yes, Delete');
}

/* ── ⚙️ Process document: extract images, upload to storage, generate content ── */

/** True when an image already lives on CMS storage (a hosted URL) */
function isImageHosted(image) {
  if (!image) return false;
  if (typeof image.url === 'string' && image.url.indexOf('http') === 0) return true;
  if (typeof image.dataUrl === 'string' && image.dataUrl.indexOf('http') === 0) return true;
  return false;
}

/** URL used when embedding an image into generated content (hosted preferred) */
function imageContentSrc(image) {
  if (!image) return '';
  if (typeof image.url === 'string' && image.url.indexOf('http') === 0) return image.url;
  return image.dataUrl || '';
}

/* ── Picture roles and versions ──
   Every gallery picture has a role and can carry a Generated version:
     real   = used directly in generated content
     source = must be replaced by a Generated version (a task)
   The ORIGINAL always stays in url/dataUrl; the generated copy lives in
   generatedUrl/generatedDataUrl. */
function studioImageRole(image) {
  return (image && image.role === 'source') ? 'source' : 'real';
}

/** New pictures inherit the role of the document they belong to */
function defaultStudioImageRole() {
  return studioDocRole(studioCurrentDocUrl) === 'source' ? 'source' : 'real';
}

function studioImageHasGenerated(image) {
  if (!image) return false;
  if (typeof image.generatedUrl === 'string' && image.generatedUrl.indexOf('http') === 0) return true;
  return !!(typeof image.generatedDataUrl === 'string' && image.generatedDataUrl);
}

function studioImageGeneratedSrc(image) {
  if (!image) return '';
  if (typeof image.generatedUrl === 'string' && image.generatedUrl.indexOf('http') === 0) return image.generatedUrl;
  return image.generatedDataUrl || '';
}

function studioImageNeedsGeneratedVersion(image) {
  return studioImageRole(image) === 'source' && !studioImageHasGenerated(image);
}

/** How many Source pictures of the open document still wait for a generated version */
function countStudioImagesWaitingForGenerated() {
  var waitingCount = 0;
  for (var imageIndex = 0; imageIndex < editingStudyDocImages.length; imageIndex++) {
    if (studioImageNeedsGeneratedVersion(editingStudyDocImages[imageIndex])) waitingCount++;
  }
  return waitingCount;
}

/** Image source used inside GENERATED content: the generated version wins for a source picture */
function imageSrcForGeneratedContent(image) {
  if (!image) return '';
  if (studioImageRole(image) === 'source' && studioImageHasGenerated(image)) return studioImageGeneratedSrc(image);
  return imageContentSrc(image);
}

/** Upload ONE gallery image to CMS storage (requestUploadBinary contract from
 *  html-tool-rules.txt). On success the embedded data URL is dropped so the
 *  stored lesson document stays small - the hosted URL is used everywhere. */
function uploadStudioImageToStorage(imageIndex, onDone) {
  var image = editingStudyDocImages[imageIndex];
  if (!image || !image.dataUrl) { if (onDone) onDone(false); return; }
  if (typeof tool.requestUploadBinary !== 'function') { if (onDone) onDone(false); return; }
  var uploadName = /\.(jpe?g|png|webp)$/i.test(image.name || '') ? image.name : (image.name || 'image') + '.jpg';
  tool.requestUploadBinary({ dataUrl: image.dataUrl, name: uploadName, contentType: 'image/jpeg' }, function(uploadError, uploadResult) {
    if (uploadError || !uploadResult || !uploadResult.url) {
      console.warn('Image upload failed for ' + image.name + ': ' + (uploadError || 'empty result'));
      if (onDone) onDone(false);
      return;
    }
    image.url = uploadResult.url;
    image.dataUrl = '';
    if (uploadResult.sizeKb) image.sizeKb = uploadResult.sizeKb;
    persistStudioImages();
    if (onDone) onDone(true);
  });
}

/** Resolve an image to a data URL usable as an AI reference (fetch hosted ones) */
function resolveStudioImageDataUrl(image, onDone) {
  if (!image) { onDone(''); return; }
  if (typeof image.dataUrl === 'string' && image.dataUrl.indexOf('data:') === 0) { onDone(image.dataUrl); return; }
  var hostedUrl = (typeof image.url === 'string' && image.url.indexOf('http') === 0) ? image.url : '';
  if (!hostedUrl && typeof image.dataUrl === 'string' && image.dataUrl.indexOf('http') === 0) hostedUrl = image.dataUrl;
  if (!hostedUrl) { onDone(''); return; }
  if (!binaryFileChannelAvailable()) { onDone(''); return; }
  fetchDocumentBytes(hostedUrl, { purpose: 'ai-image' }, function(fetchError, imageBytes, imageMeta) {
    if (fetchError || !imageBytes || !imageBytes.length) { onDone(''); return; }
    var contentType = (imageMeta && imageMeta.contentType) || 'image/jpeg';
    onDone(bytesToDataUrl(imageBytes, contentType));
  });
}

/** Upload the document's non-hosted images to CMS storage */
function uploadUnhostedStudioImages(onDone) {
  var unhostedIndexes = [];
  for (var u = 0; u < editingStudyDocImages.length; u++) {
    if (!isImageHosted(editingStudyDocImages[u])) unhostedIndexes.push(u);
  }
  if (!unhostedIndexes.length) { if (onDone) onDone(0); return; }
  if (typeof tool.requestUploadBinary !== 'function') {
    setStudioStatus('⚠️ Image upload is unavailable on this host - requestUploadBinary needs allowBinaryUpload: yes in the field settings. Extracted images stay embedded as data URLs until then.', 'warn');
    if (onDone) onDone(0);
    return;
  }
  var queue = unhostedIndexes.slice();
  var uploadedCount = 0;
  var failedCount = 0;
  function uploadNext() {
    if (!queue.length) {
      renderStudyDocImageGallery();
      renderPdfEditorList();
      if (uploadedCount > 0) {
        setStudioStatus('✅ Uploaded ' + uploadedCount + ' image(s) to CMS storage - the gallery and the generated content now use hosted URLs.', 'ok');
        autoSaveCurrentLesson();
      }
      if (failedCount > 0) tool.notify(failedCount + ' image(s) could not be uploaded to CMS storage - they stay embedded.', 'warning');
      if (onDone) onDone(uploadedCount);
      return;
    }
    var imageIndex = queue.shift();
    setStudioStatus('⏳ Uploading image ' + (imageIndex + 1) + ' of ' + editingStudyDocImages.length + ' to CMS storage…', 'busy');
    uploadStudioImageToStorage(imageIndex, function(uploaded) {
      if (uploaded) uploadedCount++; else failedCount++;
      uploadNext();
    });
  }
  uploadNext();
}

/** ⚙️ Process Document button INSIDE the studio drawer: confirm, then run the pipeline */
function startDocumentProcessFromDrawer() {
  var docUrl = studioCurrentDocUrl;
  if (!docUrl) { tool.notify('No document is open.', 'warning'); return; }
  var roleLabel = studioDocRole(docUrl) === 'final' ? 'Ready' : 'Sample';
  sandboxConfirm('⚙️ Process "' + readableFileName(docUrl) + '" (' + roleLabel + ' document)? It reads the document, captures its pictures, uploads them to CMS storage when the platform supports it, and regenerates the lesson Study Content from it.', function() {
    runDocumentProcessPipeline();
  }, 'Yes, Process');
}

/** Extract (PDF) → upload images → generate study content, one chain */
function runDocumentProcessPipeline() {
  var docUrl = studioCurrentDocUrl;
  if (!docUrl) { tool.notify('No document is open.', 'warning'); return; }
  var lowerUrl = docUrl.toLowerCase();
  var docType = studioDocType(docUrl);
  var isHtmlDocument = docType === 'htmlDoc' || /\.(html?|htm)(\?|#|$)/.test(lowerUrl);
  var existingImages = editingStudyDocImagesMap[docUrl];
  var hasImages = existingImages && existingImages.length > 0;
  if (isHtmlDocument) {
    setStudioStatus('⏳ Processing: HTML document - generating study content…', 'busy');
    uploadUnhostedStudioImages(function() { generateStudyGuideFromStudioDoc(); });
    return;
  }
  if (!hasImages) {
    setStudioStatus('⏳ Processing: extracting images from the PDF…', 'busy');
    extractStudyDocImages(function() {
      uploadUnhostedStudioImages(function() { generateStudyGuideFromStudioDoc(); });
    });
    return;
  }
  uploadUnhostedStudioImages(function() { generateStudyGuideFromStudioDoc(); });
}

/* ── 🎨 AI image generation (requestGenerateImage + requestUploadBinary) ── */

/** Button 🎨 Generate Image: a picture must be selected first */
function openGenerateImageForSelection() {
  if (!studioCurrentDocUrl) {
    tool.notify('Open a document in the Studio drawer first (⚙️ button on any document).', 'warning');
    return;
  }
  var selectedIndexes = studioSelectedImageIndexes();
  if (!selectedIndexes.length) {
    setStudioStatus('⚠️ Select one or more pictures in the grid first (press ☑ All to select every picture), then press 🎨 Generate Image.', 'warn');
    tool.notify('Select at least one picture to generate a version of (☑ All selects every picture).', 'warning');
    return;
  }
  openStudioRegenerateDialog(selectedIndexes);
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

/** Read one document for AI generation: download the FULL file (no relay
 *  cap) and read its text in the browser, falling back to the CMS text
 *  service. callback(errorText, fileResult | null) */
function readDocumentTextForAi(sourceUrl, callback) {
  function useCmsTextService() {
    if (typeof tool.requestFileContent !== 'function') {
      callback('The document text could not be read on this host.', null);
      return;
    }
    tool.requestFileContent(toHostingUrl(sourceUrl), function(readError, fileContent) {
      if (readError) { callback(readError, null); return; }
      callback(null, fileContent);
    });
  }
  if (!binaryFileChannelAvailable()) { useCmsTextService(); return; }
  fetchDocumentBytes(sourceUrl, { purpose: 'ai-text' }, function(fetchError, documentBytes) {
    var downloadedText = '';
    if (!fetchError && documentBytes && documentBytes.length) {
      if (isTextDocumentUrl(sourceUrl)) {
        downloadedText = decodeTextBytes(documentBytes);
      } else {
        try { downloadedText = extractPdfTextLocally(documentBytes); } catch (pdfTextError) { downloadedText = ''; }
      }
    }
    if (downloadedText && downloadedText.replace(/\s+/g, '').length >= 200) {
      callback(null, { text: downloadedText });
      return;
    }
    useCmsTextService();
  });
}

function generateQuizFromPdf(onDone) {
  var allUrls = [];
  allUrls = allUrls.concat(editingPresentationPdfUrls);
  allUrls = allUrls.concat(editingStudyDocPdfUrls);
  allUrls = allUrls.concat(editingWorksheetPdfUrls);
  allUrls = allUrls.filter(function(u) { return u && u.trim(); });
  // Sources are sample inputs - AI generators only ever read Real documents.
  allUrls = allUrls.filter(function(u) { return !isSourceDocumentUrl(u); });

  if (allUrls.length === 0) {
    showGenerateInfo(true);
    tool.notify('No PDFs added yet. Add PDFs to Presentation, Study Documents, or Worksheets first.', 'warning');
    if (onDone) onDone('no-pdfs');
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
      readDocumentTextForAi(allUrls[idx], function(err, fileResult) {
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
            if (onDone) onDone('no-text');
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

    var prompt = 'You are an expert quiz generator. Generate EXACTLY 15 multiple-choice questions that genuinely test whether a student UNDERSTOOD the documents below. Return ONLY a JSON array — no markdown, no intro text.\n\nCRITICAL: You MUST generate exactly 15 questions.\n\nQUESTION QUALITY RULES (strict):\n• NEVER ask for titles, headings, section names, document names or "what is this lesson about". Every question must test a FACT, CONCEPT, RULE, NUMBER, STEP, CAUSE or EFFECT found in the content.\n• Each question must be answerable ONLY by understanding the content - not by guessing the topic.\n• All 4 options must be plausible distractors with similar length and style. Never use "all of the above" or "none of the above".\n• Avoid double negatives and trick wording. Keep questions clear, specific and professional.\n• The correct answer must be unambiguous and directly supported by the document content.\n• explanation_correct must be a short step-by-step reasoning. explanations_incorrect must explain why EACH wrong option is wrong.\n\nDocument content:\n"""\n' + text + '\n"""\n\nThe 15 questions are organized as 3 identical sets of 5 questions each. Each set of 5 follows this difficulty pattern: easy, medium, medium, hard, hard. Each question must have exactly 4 options. Use this JSON format:\n{"question":"...","options":["A","B","C","D"],"answer":0,"difficulty":"easy|medium|hard","explanation_correct":"step-by-step solution","explanations_incorrect":["","","",""]}\n\nSTART YOUR RESPONSE WITH: [{"question":';

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
          if (onDone) onDone(null);
        } catch(e) {
          tool.notify('Response could not be parsed. See console.', 'error');
          console.error('Quiz gen parse error:', e, 'Raw:', fullResponse);
          if (onDone) onDone(e);
        }
      },
      onError: function(err) {
        updateGenerateButtons({ disabled: false, text: '🤖 Generate Quiz Questions from PDFs' });
        tool.notify('Generation failed: ' + err, 'error');
        if (onDone) onDone(err);
      }
    });
  }
}

function generateHtmlFromPdf(onDone) {
  var allUrls = [];
  allUrls = allUrls.concat(editingPresentationPdfUrls);
  allUrls = allUrls.concat(editingStudyDocPdfUrls);
  allUrls = allUrls.concat(editingWorksheetPdfUrls);
  allUrls = allUrls.filter(function(u) { return u && u.trim(); });
  // Sources are sample inputs - AI generators only ever read Real documents.
  allUrls = allUrls.filter(function(u) { return !isSourceDocumentUrl(u); });

  if (allUrls.length === 0) {
    tool.notify('No PDFs added yet. Add PDFs to Presentation, Study Documents, or Worksheets first.', 'warning');
    var infoEl = el('generate-html-info-v2');
    if (infoEl) { infoEl.style.display = ''; setTimeout(function() { infoEl.style.display = 'none'; }, 4000); }
    if (onDone) onDone('no-pdfs');
    return;
  }

  var genBtn = el('btn-generate-html-from-pdf-v2');
  if (genBtn) { genBtn.disabled = true; genBtn.textContent = '⏳ Reading ' + allUrls.length + ' PDF(s)...'; }
tool.notify('Reading ' + allUrls.length + ' PDF(s) for study content generation...', 'info');

  var combinedText = '';
  var remaining = allUrls.length;

  for (var ri = 0; ri < allUrls.length; ri++) {
    (function(idx) {
      readDocumentTextForAi(allUrls[idx], function(err, fileResult) {
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
            if (onDone) onDone('no-text');
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
            if (onDone) onDone(null);
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
          if (onDone) onDone('too-little');
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
        if (onDone) onDone(null);
      },
      onError: function(err) {
        if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🤖 Generate from PDFs'; }
        tool.notify('Generation failed: ' + err, 'error');
        if (onDone) onDone(err);
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
        var delFcIdx = parseInt(this.getAttribute('data-del-fc'));
        var delFcFront = (editingFlashcards[delFcIdx] && (editingFlashcards[delFcIdx].front || editingFlashcards[delFcIdx].q)) ? (editingFlashcards[delFcIdx].front || editingFlashcards[delFcIdx].q) : 'this flashcard';
        sandboxConfirm('Delete flashcard "' + (delFcFront.length > 60 ? delFcFront.substring(0, 60) + '…' : delFcFront) + '"?', function() {
          editingFlashcards.splice(delFcIdx, 1);
          renderFlashcardsEditorList();
          autoSaveCurrentLesson();
        }, 'Yes, Delete');
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
function generateFlashcardsFromPdf(onDone) {
  var allUrls = [];
  allUrls = allUrls.concat(editingPresentationPdfUrls);
  allUrls = allUrls.concat(editingStudyDocPdfUrls);
  allUrls = allUrls.concat(editingWorksheetPdfUrls);
  allUrls = allUrls.filter(function(u) { return u && u.trim(); });
  // Sources are sample inputs - AI generators only ever read Real documents.
  allUrls = allUrls.filter(function(u) { return !isSourceDocumentUrl(u); });

  if (allUrls.length === 0) {
    tool.notify('No PDFs added yet. Add PDFs first.', 'warning');
    if (onDone) onDone('no-pdfs');
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
      readDocumentTextForAi(allUrls[idx], function(err, fileResult) {
        remaining--;
        if (!err && fileResult) {
          var text = typeof fileResult === 'string' ? fileResult : (fileResult.text || fileResult.content || '');
          if (text && text.length > 50) combinedText += '\n\n--- Doc ' + (idx+1) + ' ---\n\n' + text;
        }
        if (remaining === 0) {
          if (!combinedText || combinedText.length < 50) {
            if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🃏 Generate Flashcards'; }
            tool.notify('Could not extract enough text.', 'warning');
            if (onDone) onDone('no-text');
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
                if (onDone) onDone(null);
              } catch(e) {
                tool.notify('Could not parse flashcards. Try again.', 'error');
                console.error('Flashcard parse error:', e, fullResponse);
                if (onDone) onDone(e);
              }
            },
            onError: function(err) {
              if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🃏 Generate Flashcards'; }
              tool.notify('Generation failed: ' + err, 'error');
              if (onDone) onDone(err);
            }
          });
        }
      });
    })(ri);
  }
}

/** AI: Generate presentation slides from PDFs */
function generatePresentationFromPdf(onDone) {
  var allUrls = [];
  allUrls = allUrls.concat(editingPresentationPdfUrls);
  allUrls = allUrls.concat(editingStudyDocPdfUrls);
  allUrls = allUrls.filter(function(u) { return u && u.trim(); });
  // Sources are sample inputs - AI generators only ever read Real documents.
  allUrls = allUrls.filter(function(u) { return !isSourceDocumentUrl(u); });

  if (allUrls.length === 0) {
    tool.notify('No PDFs added yet. Add PDFs to Presentation Slides or Study Documents first.', 'warning');
    if (onDone) onDone('no-pdfs');
    return;
  }

  var genBtn = el('btn-generate-presentation');
  if (genBtn) { genBtn.disabled = true; genBtn.textContent = '⏳ Reading ' + allUrls.length + ' PDF(s)...'; }
  tool.notify('Reading ' + allUrls.length + ' PDF(s) for presentation generation...', 'info');

  var combinedText = '';
  var remaining = allUrls.length;
  for (var ri = 0; ri < allUrls.length; ri++) {
    (function(idx) {
      readDocumentTextForAi(allUrls[idx], function(err, fileResult) {
        remaining--;
        if (!err && fileResult) {
          var text = typeof fileResult === 'string' ? fileResult : (fileResult.text || fileResult.content || '');
          if (text && text.length > 50) combinedText += '\n\n--- Document ' + (idx+1) + ' ---\n\n' + text;
        }
        if (remaining === 0) {
          if (!combinedText || combinedText.length < 50) {
            if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🎞️ Generate Presentation'; }
            tool.notify('Could not extract enough text from the PDFs.', 'warning');
            if (onDone) onDone('no-text');
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
          if (onDone) onDone('too-little');
          return;
        }
        editingPresentationHtml = raw;
        // Update the presentation preview
        updatePresentationPreview();
        autoSaveCurrentLesson();
        tool.notify('✅ Presentation generated & auto-saved! ' + (raw.match(/pres-slide/g)||[]).length + ' slides', 'success');
        if (onDone) onDone(null);
      },
      onError: function(err) {
        if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🎞️ Generate Presentation'; }
        tool.notify('Generation failed: ' + err, 'error');
        if (onDone) onDone(err);
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
  // A pasted AI component JSON is converted to rendered HTML on the fly.
  normalizeStudyContentInput(false);
  if (_htmlPreviewTimer) clearTimeout(_htmlPreviewTimer);
  _htmlPreviewTimer = setTimeout(updateHtmlPreview, 400);
}

/* ═══════════════════════════════════════════
   STUDY DOCUMENT STUDIO
   Upload or link a source document (Study Documents), extract its images
   client-side, AI-rephrase the document from scratch into study-guide HTML
   with the images embedded, and optionally AI-regenerate images with a
   side-by-side picker. Extracted images are stored as compressed JPEG data
   URLs inside studyHtmlData.docImages (the CMS has no binary re-upload
   channel yet, so re-uploading extracted images as separate CMS files is
   not possible - the gallery and the generated HTML share the same bytes).
   ═══════════════════════════════════════════ */

var editingStudyDocImages = []; // working copy: images of the document open in the studio drawer
var editingStudyDocGeneratedHtmlMap = {}; // { docUrl: { html, generatedAt, sourceLabel } } - generated equivalents, never student-facing
var studioGeneratedHtml = '';    // generated HTML of the document open in the drawer
var lastStudioTextSourceLabel = ''; // how the last generation read its text (diagnostics + generated entry)
var editingStudyDocSources = []; // [{url, name}] - processing inputs, never shown to students
var editingStudyDocImagesMap = {}; // { docUrl: [images] } - persisted per document
var studioCurrentDocUrl = ''; // the document currently open in the studio drawer
var studioLocalPdfUrl = '';    // document URL that the local PDF bytes belong to
var studioLocalPdfBytes = null; // Uint8Array of the PDF read from the user's disk (browser only)
var studioLocalPdfName = '';   // original file name of the local PDF
var studioLocalPdfBlobUrl = ''; // blob: URL of the local PDF, used for the preview
var studioPreviewBlobUrl = ''; // blob: URL built from the CMS relay preview

/* ── Large-file download channel (tool.requestFileBinary) ──
   html-tool-rules v3.1: the parent CMS downloads the whole file in the
   browser and hands the COMPLETE ArrayBuffer to the tool - no 500 KB cap and
   NO server fallback. Requires allowFileFetch: 'yes' in the field settings;
   when the channel is missing or switched off the tool reports that and never
   touches the legacy requestFetch relay. */
var STUDIO_BINARY_MAX_BYTES = 100 * 1024 * 1024;
var STUDIO_BINARY_TIMEOUT_MS = 120000;
/** In-memory cache: one document is downloaded once per session, never persisted. */
var studioFileBytesCache = {};
var studioFileBytesCacheKeys = [];
var studioFileBytesCacheTotal = 0;
var STUDIO_FILE_CACHE_MAX_BYTES = 64 * 1024 * 1024;
/** Concurrent calls for the same URL share a single download. */
var studioFileBytesInflight = {};
/** Why the last large-file download attempt did not use the new channel
 *  ('', a channel error code, or 'missing'). Shown in the error message so a
 *  misconfigured field is obvious instead of looking like a file-size issue. */
var lastFileChannelFailure = '';
var lastFileChannelFailureCode = '';
/** Which failure code already printed its diagnostic block (once per page) */
var fileChannelDiagnosticsPrintedFor = '';

/** Print the diagnostic block once per failure code per page load */
function logFileChannelFailureOnce(failureCode, details) {
  if (fileChannelDiagnosticsPrintedFor === failureCode) return;
  fileChannelDiagnosticsPrintedFor = failureCode;
  logFileChannelDiagnostics('automatic: ' + failureCode, details);
}

/** Names of every function the CMS SDK exposes (diagnostics only) */
function describeToolMethodNames() {
  var methodNames = [];
  try {
    for (var methodName in tool) {
      if (typeof tool[methodName] === 'function') methodNames.push(methodName);
    }
  } catch (toolError) { /* ignore */ }
  return methodNames.sort().join(', ') || '(none)';
}

/** Remember why the new channel was not used */
function recordFileChannelFailure(failureCode, fetchResult) {
  lastFileChannelFailureCode = String(failureCode || '');
  var detailText = (fetchResult && (fetchResult.detail || fetchResult.message)) ? String(fetchResult.detail || fetchResult.message) : '';
  lastFileChannelFailure = lastFileChannelFailureCode + (detailText ? ' - ' + detailText : '');
}

/** Explain the last channel failure in plain language ('' when it worked) */
function describeFileChannelFailure() {
  var codeText = lastFileChannelFailureCode;
  if (!codeText) return '';
  if (codeText === 'missing') return 'This CMS build does not provide tool.requestFileBinary';
  if (codeText === 'not_configured') return 'large-file download is switched off for this tool (allowFileFetch: yes is required)';
  if (codeText === 'blocked_host') return 'the CMS is not allowed to download from this host (allowed file hosts)';
  if (codeText === 'network') return 'the browser download failed - host unreachable or missing CORS headers' + (lastFileChannelFailure.indexOf(' - ') !== -1 ? ' (' + lastFileChannelFailure.split(' - ')[1] + ')' : '');
  if (codeText === 'timeout') return 'the download did not finish in time';
  if (codeText === 'channel_error') return 'the download channel threw an error' + (lastFileChannelFailure.indexOf(' - ') !== -1 ? ' (' + lastFileChannelFailure.split(' - ')[1] + ')' : '');
  if (codeText === 'cancelled') return 'the download was cancelled';
  return lastFileChannelFailure;
}

/* ── Download diagnostics (console only - never shown to end users) ── */

/** Hide anything that looks like a credential before printing settings */
function redactForDiagnostics(value) {
  if (!value || typeof value !== 'object') return value;
  var redacted = {};
  var keyNames = Object.keys(value).slice(0, 40);
  for (var keyIndex = 0; keyIndex < keyNames.length; keyIndex++) {
    var keyName = keyNames[keyIndex];
    if (/key|secret|token|password|auth|credential/i.test(keyName)) { continue; }
    var keyValue = value[keyName];
    if (keyValue === null || typeof keyValue !== 'object') redacted[keyName] = keyValue;
    else if (Array.isArray(keyValue)) redacted[keyName] = keyValue.slice(0, 10);
    else redacted[keyName] = '[object]';
  }
  return redacted;
}

/** Deep-ish, credential-free summary of any SDK object (2-3 levels) */
function summarizeObjectForDiagnostics(value, depth) {
  var remainingDepth = (typeof depth === 'number') ? depth : 2;
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    var arraySample = [];
    for (var sampleIndex = 0; sampleIndex < Math.min(value.length, 5); sampleIndex++) {
      arraySample.push(summarizeObjectForDiagnostics(value[sampleIndex], remainingDepth - 1));
    }
    return { arrayLength: value.length, sample: arraySample };
  }
  var summary = {};
  var keyNames = Object.keys(value);
  for (var keyIndex = 0; keyIndex < keyNames.length && keyIndex < 40; keyIndex++) {
    var keyName = keyNames[keyIndex];
    if (/key|secret|token|password|auth|credential/i.test(keyName)) continue;
    var keyValue = value[keyName];
    if (keyValue === null || typeof keyValue !== 'object') summary[keyName] = keyValue;
    else if (remainingDepth > 0) summary[keyName] = summarizeObjectForDiagnostics(keyValue, remainingDepth - 1);
    else summary[keyName] = Array.isArray(keyValue) ? ('array(' + keyValue.length + ')') : '[object]';
  }
  return summary;
}

/** Whatever the SDK exposes about download settings/capabilities */
function collectToolCapabilitySnapshot() {
  var snapshot = { build: TOOL_BUILD };
  try {
    snapshot.requestFileBinary = (typeof tool.requestFileBinary === 'function') ? 'function' : 'MISSING';
  } catch (probeError) {
    snapshot.requestFileBinary = 'tool threw: ' + probeError.message;
  }
  // Field definitions carry the settings block in most SDK builds - this shows
  // which keys really reach the tool frame.
  try {
    if (typeof tool.getFields === 'function') snapshot.getFields = summarizeObjectForDiagnostics(tool.getFields(), 3);
  } catch (fieldsError) {
    snapshot.getFields = 'threw: ' + fieldsError.message;
  }
  var getterNames = ['getSettings', 'getFieldSettings', 'getCapabilities', 'getConfig', 'getParams'];
  var settingsGetterFound = false;
  for (var getterIndex = 0; getterIndex < getterNames.length; getterIndex++) {
    var getterName = getterNames[getterIndex];
    try {
      if (typeof tool[getterName] === 'function') {
        snapshot[getterName] = redactForDiagnostics(tool[getterName]());
        settingsGetterFound = true;
      }
    } catch (getterError) {
      snapshot[getterName] = 'threw: ' + getterError.message;
    }
  }
  var settingKeys = ['allowFileFetch', 'maxFileFetchBytes', 'allowedFileFetchHosts', 'allowAllFileFetchHosts', 'allowFileContent', 'allowAllFetchHosts', 'allowedFetchHosts', 'maxFetchBytes', 'allowBinaryUpload'];
  var paramProbe = {};
  // Only probe params when the SDK has no settings getter (avoids SDK warnings)
  if (!settingsGetterFound) {
    for (var settingIndex = 0; settingIndex < settingKeys.length; settingIndex++) {
      var settingKey = settingKeys[settingIndex];
      try { paramProbe[settingKey] = tool.param(settingKey, '(not exposed)'); }
      catch (paramError) { paramProbe[settingKey] = 'threw: ' + paramError.message; }
    }
  }
  snapshot.paramProbe = paramProbe;
  snapshot.toolMethods = describeToolMethodNames();
  return snapshot;
}

/** Compact view of a requestFileBinary result (never prints the bytes) */
function summarizeFileChannelResult(fetchResult) {
  if (fetchResult === null || fetchResult === undefined) return null;
  if (typeof fetchResult !== 'object') return { value: String(fetchResult).substring(0, 200) };
  var summary = {};
  var fieldNames = ['status', 'statusText', 'contentType', 'fileName', 'byteLength', 'encoding', 'etag', 'fromCache', 'elapsedMs', 'detail', 'message', 'reason', 'limitBytes', 'code', 'error', 'host', 'url'];
  for (var fieldIndex = 0; fieldIndex < fieldNames.length; fieldIndex++) {
    if (fetchResult[fieldNames[fieldIndex]] !== undefined) summary[fieldNames[fieldIndex]] = fetchResult[fieldNames[fieldIndex]];
  }
  if (fetchResult.bytes) {
    summary.bytes = (typeof fetchResult.bytes === 'string')
      ? 'string(' + fetchResult.bytes.length + ' chars)'
      : ('ArrayBuffer(' + (fetchResult.bytes.byteLength || 0) + ' bytes)');
  }
  if (fetchResult.base64) summary.base64 = 'string(' + fetchResult.base64.length + ' chars)';
  summary.resultKeys = Object.keys(fetchResult).slice(0, 20).join(', ');
  return summary;
}

/** One copyable console block explaining what the channel saw */
function logFileChannelDiagnostics(stageLabel, details) {
  try {
    console.log('===== CURRICULUM BUILDER - FILE CHANNEL DIAGNOSTICS =====');
    console.log('stage: ' + stageLabel);
    console.log('build: ' + TOOL_BUILD);
    console.log('tool snapshot: ' + JSON.stringify(collectToolCapabilitySnapshot(), null, 2));
    if (details) console.log('details: ' + JSON.stringify(details, null, 2));
    console.log('===== END FILE CHANNEL DIAGNOSTICS =====');
  } catch (diagnosticsError) {
    console.warn('[STUDIO:DOWNLOAD] diagnostics could not be printed:', diagnosticsError);
  }
}

/** Console helper: real download test (no cache), defaults to the open document.
 *  Usage: __curriculumBuilderFileDiag()  or  __curriculumBuilderFileDiag('https://…') */
function runFileChannelSelfTest(testUrl) {
  var targetUrl = testUrl || (typeof studioCurrentDocUrl === 'string' ? studioCurrentDocUrl : '');
  logFileChannelDiagnostics('manual self-test start', {
    url: targetUrl,
    hasDocumentOpen: !!targetUrl,
    requestOptions: { maxBytes: STUDIO_BINARY_MAX_BYTES, timeoutMs: STUDIO_BINARY_TIMEOUT_MS }
  });
  if (!targetUrl) {
    console.warn('[DIAG] No document URL. Open a document first, or call __curriculumBuilderFileDiag("https://…").');
    return;
  }
  if (!binaryFileChannelAvailable()) {
    console.warn('[DIAG] tool.requestFileBinary is not a function on this host.');
    return;
  }
  var selfTestStartedAt = Date.now();
  requestFileBinarySafely({ url: targetUrl, maxBytes: STUDIO_BINARY_MAX_BYTES, timeoutMs: STUDIO_BINARY_TIMEOUT_MS }, function(errorCode, fetchResult) {
    console.log('[DIAG] callback after ' + (Date.now() - selfTestStartedAt) + ' ms - errorCode: ' + (errorCode || 'none'));
    console.log('[DIAG] result summary: ' + JSON.stringify(summarizeFileChannelResult(fetchResult), null, 2));
    logFileChannelDiagnostics('manual self-test result', {
      url: targetUrl,
      errorCode: errorCode || null,
      result: summarizeFileChannelResult(fetchResult)
    });
  });
}

if (typeof window !== 'undefined') {
  window.__curriculumBuilderFileDiag = runFileChannelSelfTest;
  /** Console helper: reload the curriculum from the CMS without a page reload */
  window.__curriculumBuilderReload = reloadCurriculumFromCms;
  /** Console helper: explain why the PDF page preview is not rendered */
  window.__curriculumBuilderPdfDiag = function() {
    logPdfPreviewDiagnostics('manual');
    return collectPdfPreviewDiagnostics();
  };
  /** Console helper: explain why OCR is not running / which engine was injected */
  window.__curriculumBuilderOcrDiag = function() {
    logOcrDiagnostics('manual');
    return collectOcrDiagnostics();
  };
  window.__curriculumBuilderToolSnapshot = function() {
    var snapshot = collectToolCapabilitySnapshot();
    console.log(JSON.stringify(snapshot, null, 2));
    return snapshot;
  };
  /** Console helper: what the tool currently holds (data + download settings) */
  window.__curriculumBuilderDebug = function() {
    var rawValue = window.__curriculumLastVal;
    var debugInfo = {
      build: TOOL_BUILD,
      hasCurriculumValue: rawValue !== undefined && rawValue !== null,
      valueType: (rawValue === null) ? 'null' : typeof rawValue,
      valueKeys: (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) ? Object.keys(rawValue).slice(0, 20) : [],
      valueLength: (typeof rawValue === 'string') ? rawValue.length : null,
      sectionCount: sections.length,
      lastGoodSectionCount: (window.__curriculumLastGoodValue && window.__curriculumLastGoodValue.sections) ? window.__curriculumLastGoodValue.sections.length : 0,
      secondsSinceLocalSave: lastSaveRequestedAt ? Math.round((Date.now() - lastSaveRequestedAt) / 1000) : null,
      downloadChannel: collectToolCapabilitySnapshot()
    };
    console.log('===== CURRICULUM BUILDER DEBUG =====');
    console.log(JSON.stringify(debugInfo, null, 2));
    console.log('===== END CURRICULUM BUILDER DEBUG =====');
    return debugInfo;
  };
}

/** Call requestFileBinary defensively: some SDK builds reject an options
 *  object that contains a function (postMessage cannot clone it), so retry
 *  once with plain values when that happens. */
function requestFileBinarySafely(channelOptions, onResult) {
  var plainOptions = {
    url: channelOptions.url,
    maxBytes: channelOptions.maxBytes,
    timeoutMs: channelOptions.timeoutMs,
    cacheKey: channelOptions.cacheKey
  };
  try {
    tool.requestFileBinary(channelOptions, function(errorCode, fetchResult) {
      if ((errorCode === 'invalid_options' || errorCode === 'invalid_request') && channelOptions.onProgress) {
        console.warn('[STUDIO:DOWNLOAD] requestFileBinary refused the options (' + errorCode + ') - retrying without callbacks');
        try { tool.requestFileBinary(plainOptions, onResult); return; } catch (retryError) { console.warn('[STUDIO:DOWNLOAD] retry failed:', retryError); }
      }
      onResult(errorCode, fetchResult);
    });
  } catch (channelError) {
    console.warn('[STUDIO:DOWNLOAD] requestFileBinary threw:', channelError);
    if (channelOptions.onProgress) {
      try { tool.requestFileBinary(plainOptions, onResult); return; } catch (retryError) { console.warn('[STUDIO:DOWNLOAD] retry failed:', retryError); }
    }
    onResult('channel_error', { detail: String((channelError && channelError.message) || channelError) });
  }
}

/** True when the large-file download channel exists on this host */
function binaryFileChannelAvailable() {
  return (typeof tool !== 'undefined') && (typeof tool.requestFileBinary === 'function');
}

/** True for documents that are plain text (decoded with TextDecoder) */
function isTextDocumentUrl(fileUrl) {
  return /\.(html?|txt|md|markdown|csv|json|xml|css|js)(\?|#|$)/i.test(String(fileUrl || ''));
}

/** Last path segment of a URL, usable as a file name on disk */
function safeDownloadFileName(fileUrlOrName, fallbackName) {
  var pathText = String(fileUrlOrName || '').split('?')[0].split('#')[0];
  var nameText = pathText.substring(pathText.lastIndexOf('/') + 1);
  return nameText || (fallbackName || 'document');
}

/** Decode text bytes (UTF-8 when the engine supports it, latin1 otherwise) */
function decodeTextBytes(textBytes) {
  try {
    if (typeof TextDecoder === 'function') return new TextDecoder('utf-8').decode(textBytes);
  } catch (decodeError) { /* fall through to latin1 */ }
  return bytesToLatin1String(textBytes);
}

/** data: URL for an in-memory file */
function bytesToDataUrl(fileBytes, contentType) {
  return 'data:' + (contentType || 'application/octet-stream') + ';base64,' + bytesToBase64(fileBytes);
}

/** "12.4 MB" / "840 KB" - used in status lines */
function formatFileSize(byteLength) {
  var sizeValue = Number(byteLength) || 0;
  if (sizeValue >= 1024 * 1024) return (Math.round((sizeValue / (1024 * 1024)) * 10) / 10) + ' MB';
  if (sizeValue >= 1024) return Math.round(sizeValue / 1024) + ' KB';
  return sizeValue + ' bytes';
}

/** Save in-memory bytes to the user's disk through a temporary blob link */
function saveBytesToDisk(fileBytes, fileName, contentType) {
  try {
    var fileBlob = new Blob([fileBytes], { type: contentType || 'application/octet-stream' });
    var blobUrl = URL.createObjectURL(fileBlob);
    var downloadAnchor = document.createElement('a');
    downloadAnchor.href = blobUrl;
    downloadAnchor.download = fileName || 'document';
    downloadAnchor.style.display = 'none';
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setTimeout(function() {
      try { URL.revokeObjectURL(blobUrl); } catch (revokeError) { /* already gone */ }
    }, 30000);
    return true;
  } catch (saveError) {
    console.warn('[STUDIO:DOWNLOAD] could not save the file:', saveError);
    return false;
  }
}

/** Keep downloaded bytes for this session (small budget, no persistence) */
function rememberStudioFileBytes(cacheKey, cacheEntry) {
  if (!cacheKey || !cacheEntry || !cacheEntry.bytes) return;
  if (cacheEntry.bytes.length > STUDIO_FILE_CACHE_MAX_BYTES) return;
  if (!studioFileBytesCache[cacheKey]) studioFileBytesCacheKeys.push(cacheKey);
  var previousEntry = studioFileBytesCache[cacheKey];
  if (previousEntry) studioFileBytesCacheTotal -= previousEntry.bytes.length;
  studioFileBytesCache[cacheKey] = cacheEntry;
  studioFileBytesCacheTotal += cacheEntry.bytes.length;
  while (studioFileBytesCacheTotal > STUDIO_FILE_CACHE_MAX_BYTES && studioFileBytesCacheKeys.length > 1) {
    var oldestKey = studioFileBytesCacheKeys.shift();
    if (oldestKey === cacheKey) { studioFileBytesCacheKeys.push(oldestKey); break; }
    var oldestEntry = studioFileBytesCache[oldestKey];
    if (oldestEntry) {
      studioFileBytesCacheTotal -= oldestEntry.bytes.length;
      delete studioFileBytesCache[oldestKey];
    }
  }
}

/** User-facing text for a download error code (no host or setting details) */
function describeFileFetchError(errorCode, fetchResult) {
  var codeText = String(errorCode || '');
  if (codeText === 'not_configured' || codeText === 'missing') return 'File downloads are switched off for this tool.';
  if (codeText === 'blocked_host') return 'This document is hosted somewhere the tool is not allowed to download from.';
  if (codeText === 'invalid_url') return 'That document link is not a valid address.';
  if (codeText === 'too_large') {
    var limitText = (fetchResult && fetchResult.limitBytes) ? formatFileSize(fetchResult.limitBytes) : 'the allowed limit';
    var actualText = (fetchResult && fetchResult.byteLength) ? ' (this file is ' + formatFileSize(fetchResult.byteLength) + ')' : '';
    return 'The document is larger than ' + limitText + actualText + '.';
  }
  if (codeText === 'http_error') return 'The file host could not deliver the document (HTTP ' + ((fetchResult && fetchResult.status) || 'error') + ').';
  if (codeText === 'timeout') return 'The download did not finish in time.';
  if (codeText === 'cancelled') return 'The download was cancelled.';
  if (codeText === 'network') return 'The document could not be downloaded - try again or open it directly.';
  if (codeText === 'channel_error') return 'The download failed - try again or open the file directly.';
  if (codeText === 'decode_failed') return 'The downloaded file could not be read.';
  return 'The file could not be downloaded.';
}

/** Developer-facing reason for the console (never shown to end users) */
function describeFileFetchFailureForConsole(errorCode, fetchResult) {
  var detailText = (fetchResult && (fetchResult.detail || fetchResult.reason || fetchResult.message))
    ? String(fetchResult.detail || fetchResult.reason || fetchResult.message)
    : '';
  var channelExplanation = describeFileChannelFailure();
  var parts = ['code: ' + String(errorCode || 'none')];
  if (channelExplanation) parts.push('channel: ' + channelExplanation);
  if (detailText) parts.push('detail: ' + detailText);
  return parts.join(' | ');
}

/** Turn a requestFileBinary result into bytes (arraybuffer or base64 form) */
function fileBytesFromFetchResult(fetchResult) {
  if (!fetchResult) return null;
  try {
    if (fetchResult.encoding === 'base64' && fetchResult.base64) return base64ToBytes(fetchResult.base64);
    if (fetchResult.bytes) {
      if (typeof fetchResult.bytes === 'string') return base64ToBytes(fetchResult.bytes);
      return new Uint8Array(fetchResult.bytes);
    }
    if (fetchResult.dataUrl) {
      var commaIndex = String(fetchResult.dataUrl).indexOf(',');
      if (commaIndex !== -1) return base64ToBytes(String(fetchResult.dataUrl).substring(commaIndex + 1));
    }
  } catch (bytesError) {
    console.warn('[STUDIO:DOWNLOAD] could not read the file bytes:', bytesError);
  }
  return null;
}

/** Turn a requestFileBinary result into bytes (arraybuffer or base64 form) */
function fetchDocumentBytes(sourceUrl, options, onDone) {
  var requestOptions = options || {};
  if (!sourceUrl) { onDone('invalid_url', null, null); return; }
  if (studioLocalPdfBytes && studioLocalPdfUrl === sourceUrl) {
    var localMeta = {
      bytes: studioLocalPdfBytes,
      contentType: 'application/pdf',
      fileName: studioLocalPdfName || safeDownloadFileName(sourceUrl, 'document.pdf'),
      byteLength: studioLocalPdfBytes.length,
      fromLocalFile: true
    };
    if (requestOptions.onProgress) requestOptions.onProgress(localMeta.byteLength, localMeta.byteLength);
    onDone(null, studioLocalPdfBytes, localMeta);
    return;
  }
  // One cache entry per URL - text, images and downloads share the download.
  var cacheKey = 'file|' + sourceUrl;
  if (studioFileBytesCache[cacheKey]) {
    var cachedEntry = studioFileBytesCache[cacheKey];
    if (requestOptions.onProgress) requestOptions.onProgress(cachedEntry.byteLength, cachedEntry.byteLength);
    onDone(null, cachedEntry.bytes, cachedEntry);
    return;
  }
  function finishDownload(errorCode, fileBytes, meta) {
    var waitingCallbacks = studioFileBytesInflight[cacheKey] || [];
    delete studioFileBytesInflight[cacheKey];
    for (var waitIndex = 0; waitIndex < waitingCallbacks.length; waitIndex++) waitingCallbacks[waitIndex](errorCode, fileBytes, meta);
    onDone(errorCode, fileBytes, meta);
  }
  if (studioFileBytesInflight[cacheKey]) {
    studioFileBytesInflight[cacheKey].push(onDone);
    return;
  }
  studioFileBytesInflight[cacheKey] = [];
  if (!binaryFileChannelAvailable()) {
    recordFileChannelFailure('missing');
    console.warn('[STUDIO:DOWNLOAD] tool.requestFileBinary is missing - tools available: ' + describeToolMethodNames());
    logFileChannelFailureOnce('missing', { url: sourceUrl, note: 'The SDK running inside this tool frame has no requestFileBinary method.' });
    finishDownload('missing', null, null);
    return;
  }
  var channelFinished = false;
  var channelWatchdog = setTimeout(function() {
    if (channelFinished) return;
    channelFinished = true;
    recordFileChannelFailure('timeout');
    console.warn('[STUDIO:DOWNLOAD] requestFileBinary never called back within ' + (STUDIO_BINARY_TIMEOUT_MS + 30000) + ' ms');
    logFileChannelFailureOnce('timeout', {
      url: sourceUrl,
      requestOptions: { maxBytes: STUDIO_BINARY_MAX_BYTES, timeoutMs: STUDIO_BINARY_TIMEOUT_MS },
      note: 'The SDK never invoked the callback.'
    });
    finishDownload('timeout', null, null);
  }, STUDIO_BINARY_TIMEOUT_MS + 30000);
  requestFileBinarySafely({
    url: sourceUrl,
    maxBytes: STUDIO_BINARY_MAX_BYTES,
    timeoutMs: STUDIO_BINARY_TIMEOUT_MS,
    cacheKey: cacheKey,
    onProgress: function(loadedBytes, totalBytes) {
      if (requestOptions.onProgress) requestOptions.onProgress(loadedBytes, totalBytes);
    }
  }, function(fetchErrorCode, fetchResult) {
    if (channelFinished) return;
    channelFinished = true;
    clearTimeout(channelWatchdog);
    if (!fetchErrorCode) {
      lastFileChannelFailure = '';
      lastFileChannelFailureCode = '';
      var fileBytes = fileBytesFromFetchResult(fetchResult);
      if (fileBytes && fileBytes.length) {
        var fileMeta = {
          bytes: fileBytes,
          contentType: (fetchResult && fetchResult.contentType) || '',
          fileName: (fetchResult && fetchResult.fileName) || safeDownloadFileName(sourceUrl, 'document'),
          byteLength: fileBytes.length,
          status: fetchResult ? fetchResult.status : 0
        };
        rememberStudioFileBytes(cacheKey, fileMeta);
        finishDownload(null, fileBytes, fileMeta);
        return;
      }
      recordFileChannelFailure('channel_error', { detail: 'the channel returned no bytes' });
      finishDownload('decode_failed', null, fetchResult);
      return;
    }
    // html-tool-rules v3.1: there is NO server fallback. Report the channel
    // error with its real reason; developer details stay in the console.
    recordFileChannelFailure(fetchErrorCode, fetchResult);
    console.warn('[STUDIO:DOWNLOAD] large-file channel did not deliver (' + fetchErrorCode + ') - ' + describeFileChannelFailure());
    logFileChannelFailureOnce(fetchErrorCode, {
      url: sourceUrl,
      requestOptions: { maxBytes: STUDIO_BINARY_MAX_BYTES, timeoutMs: STUDIO_BINARY_TIMEOUT_MS },
      callback: { errorCode: fetchErrorCode, result: summarizeFileChannelResult(fetchResult) }
    });
    finishDownload(fetchErrorCode, null, fetchResult);
  });
}

/* ── Local (browser-only) file helpers - no server relay involved ── */

/** Open the browser's own file picker (works even when tool.requestUpload is blocked) */
function pickLocalFile(acceptTypes, onPicked) {
  try {
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = acceptTypes || '';
    fileInput.setAttribute('data-local-picker', 'yes');
    fileInput.style.position = 'fixed';
    fileInput.style.left = '-10000px';
    fileInput.style.top = '-10000px';
    fileInput.style.opacity = '0';
    document.body.appendChild(fileInput);
    fileInput.addEventListener('change', function() {
      var pickedFile = (fileInput.files && fileInput.files.length) ? fileInput.files[0] : null;
      try { fileInput.remove(); } catch (removeError) { /* older engines */ }
      if (pickedFile) onPicked(pickedFile);
    });
    fileInput.click();
    return true;
  } catch (pickError) {
    console.error('Local file picker could not open:', pickError);
    return false;
  }
}

/** Read a local File as a data URL (browser only) */
function readLocalFileAsDataUrl(file, onDone) {
  var fileReader = new FileReader();
  fileReader.onload = function() { onDone(null, String(fileReader.result || '')); };
  fileReader.onerror = function() { onDone('Could not read "' + (file.name || 'the file') + '" from disk.'); };
  fileReader.readAsDataURL(file);
}

/** Upload a local File to CMS storage via requestUploadBinary (no file picker relay) */
function uploadLocalFileToStorage(file, onDone) {
  if (typeof tool.requestUploadBinary !== 'function') {
    onDone('Binary upload is not enabled (allowBinaryUpload: yes in the field settings).');
    return;
  }
  readLocalFileAsDataUrl(file, function(readError, dataUrl) {
    if (readError) { onDone(readError); return; }
    var contentType = file.type || (/\.pdf$/i.test(file.name || '') ? 'application/pdf' : 'application/octet-stream');
    tool.requestUploadBinary({ dataUrl: dataUrl, name: file.name, contentType: contentType }, function(uploadError, uploadResult) {
      if (uploadError || !uploadResult || !uploadResult.url) {
        onDone('Upload failed: ' + (uploadError || 'no URL returned'));
        return;
      }
      onDone(null, uploadResult);
    });
  });
}

/* ── Bytes / base64 helpers ── */
/* apply() rejects very long argument lists, so the binary string is built
   from fixed slices that stay well under the browser limit. */
var BYTE_STRING_CHUNK_SIZE = 32768;

function bytesToLatin1String(byteArray) {
  var chunks = [];
  for (var chunkStart = 0; chunkStart < byteArray.length; chunkStart += BYTE_STRING_CHUNK_SIZE) {
    chunks.push(String.fromCharCode.apply(null, byteArray.subarray(chunkStart, Math.min(chunkStart + BYTE_STRING_CHUNK_SIZE, byteArray.length))));
  }
  return chunks.join('');
}

function latin1StringToBytes(latin1Text) {
  var bytes = new Uint8Array(latin1Text.length);
  for (var i = 0; i < latin1Text.length; i++) bytes[i] = latin1Text.charCodeAt(i) & 0xff;
  return bytes;
}

/* btoa() pads every call it makes, so each slice MUST hold a multiple of
   3 bytes. A slice of 32768 leaves '=' padding in the MIDDLE of the joined
   result, which makes the whole base64 invalid - Chrome then refuses the
   data: URL with net::ERR_INVALID_URL and nothing can be decoded. */
var BASE64_CHUNK_SIZE = 32766;

function bytesToBase64(byteArray) {
  var latin1Text = bytesToLatin1String(byteArray);
  var base64 = '';
  for (var chunkStart = 0; chunkStart < latin1Text.length; chunkStart += BASE64_CHUNK_SIZE) {
    base64 += btoa(latin1Text.substring(chunkStart, chunkStart + BASE64_CHUNK_SIZE));
  }
  return base64;
}

function base64ToBytes(base64Text) {
  var latin1Text = atob(base64Text);
  return latin1StringToBytes(latin1Text);
}

/* ── Raw DEFLATE inflater (RFC 1951, no zlib header) ──
   PDF image streams use raw deflate; the sandbox has no external
   libraries, so this compact inflater handles stored, fixed-Huffman and
   dynamic-Huffman blocks. */
function inflateRawDeflate(inputBytes) {
  var sourcePos = 0;
  var output = [];
  var bitBuffer = 0;
  var bitCount = 0;

  function readBits(count) {
    while (bitCount < count) {
      bitBuffer |= (sourcePos < inputBytes.length ? inputBytes[sourcePos] : 0) << bitCount;
      sourcePos++;
      bitCount += 8;
    }
    var value = bitBuffer & ((1 << count) - 1);
    bitBuffer >>>= count;
    bitCount -= count;
    return value;
  }

  var LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  var LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  var DISTANCE_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  var DISTANCE_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  var CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  function buildHuffmanTable(codeLengths) {
    var lengthCounts = [];
    for (var c = 0; c <= 15; c++) lengthCounts.push(0);
    for (var i = 0; i < codeLengths.length; i++) {
      var len = codeLengths[i];
      if (len > 0 && len <= 15) lengthCounts[len]++;
    }
    var nextCode = [];
    for (var n = 0; n <= 15; n++) nextCode.push(0);
    var runningCode = 0;
    for (var bits = 1; bits <= 15; bits++) {
      runningCode = (runningCode + lengthCounts[bits - 1]) << 1;
      nextCode[bits] = runningCode;
    }
    var table = [];
    for (var t = 0; t <= 15; t++) table.push({});
    for (var symbol = 0; symbol < codeLengths.length; symbol++) {
      var symbolLen = codeLengths[symbol];
      if (symbolLen > 0) {
        table[symbolLen][nextCode[symbolLen]] = symbol;
        nextCode[symbolLen]++;
      }
    }
    return table;
  }

  function decodeSymbol(table) {
    var code = 0;
    for (var len = 1; len <= 15; len++) {
      code = (code << 1) | readBits(1);
      if (table[len][code] !== undefined) return table[len][code];
    }
    return -1;
  }

  var fixedLiteralLengths = [];
  for (var fl = 0; fl < 144; fl++) fixedLiteralLengths.push(8);
  for (var fl2 = 144; fl2 < 256; fl2++) fixedLiteralLengths.push(9);
  for (var fl3 = 256; fl3 < 280; fl3++) fixedLiteralLengths.push(7);
  for (var fl4 = 280; fl4 < 288; fl4++) fixedLiteralLengths.push(8);
  var fixedDistanceLengths = [];
  for (var fd = 0; fd < 32; fd++) fixedDistanceLengths.push(5);

  var literalTable = buildHuffmanTable(fixedLiteralLengths);
  var distanceTable = buildHuffmanTable(fixedDistanceLengths);

  function decodeCompressedBlock() {
    while (true) {
      var symbol = decodeSymbol(literalTable);
      if (symbol < 0) return 'invalid literal code';
      if (symbol < 256) {
        output.push(symbol);
      } else if (symbol === 256) {
        return null;
      } else {
        var lengthIndex = symbol - 257;
        if (lengthIndex < 0 || lengthIndex >= LENGTH_BASE.length) return 'invalid length symbol';
        var lengthValue = LENGTH_BASE[lengthIndex] + readBits(LENGTH_EXTRA[lengthIndex]);
        var distanceSymbol = decodeSymbol(distanceTable);
        if (distanceSymbol < 0) return 'invalid distance code';
        var distanceValue = DISTANCE_BASE[distanceSymbol] + readBits(DISTANCE_EXTRA[distanceSymbol]);
        if (distanceValue > output.length) return 'distance too far back';
        for (var copyStep = 0; copyStep < lengthValue; copyStep++) {
          output.push(output[output.length - distanceValue]);
        }
      }
    }
  }

  var finalBlock = false;
  while (!finalBlock) {
    finalBlock = readBits(1) === 1;
    var blockType = readBits(2);
    if (blockType === 0) {
      bitBuffer = 0;
      bitCount = 0;
      if (sourcePos + 4 > inputBytes.length) return null;
      var storedLength = inputBytes[sourcePos] | (inputBytes[sourcePos + 1] << 8);
      sourcePos += 2;
      var storedInverse = inputBytes[sourcePos] | (inputBytes[sourcePos + 1] << 8);
      sourcePos += 2;
      if ((storedLength ^ 0xffff) !== storedInverse) return null;
      for (var storedIndex = 0; storedIndex < storedLength; storedIndex++) {
        if (sourcePos >= inputBytes.length) return null;
        output.push(inputBytes[sourcePos++]);
      }
    } else if (blockType === 1 || blockType === 2) {
      if (blockType === 2) {
        var hlit = readBits(5) + 257;
        var hdist = readBits(5) + 1;
        var hclen = readBits(4) + 4;
        var codeLengthLengths = [];
        for (var cl = 0; cl < 19; cl++) codeLengthLengths.push(0);
        for (var ci = 0; ci < hclen; ci++) codeLengthLengths[CODE_LENGTH_ORDER[ci]] = readBits(3);
        var codeLengthTable = buildHuffmanTable(codeLengthLengths);
        var allLengths = [];
        while (allLengths.length < hlit + hdist) {
          var codeLengthSymbol = decodeSymbol(codeLengthTable);
          if (codeLengthSymbol < 0) return null;
          if (codeLengthSymbol < 16) {
            allLengths.push(codeLengthSymbol);
          } else if (codeLengthSymbol === 16) {
            var repeatCount = readBits(2) + 3;
            var previousLength = allLengths.length ? allLengths[allLengths.length - 1] : 0;
            for (var r16 = 0; r16 < repeatCount; r16++) allLengths.push(previousLength);
          } else if (codeLengthSymbol === 17) {
            var zeroRun17 = readBits(3) + 3;
            for (var z17 = 0; z17 < zeroRun17; z17++) allLengths.push(0);
          } else {
            var zeroRun18 = readBits(7) + 11;
            for (var z18 = 0; z18 < zeroRun18; z18++) allLengths.push(0);
          }
        }
        if (allLengths.length > hlit + hdist) return null;
        var literalLengths = allLengths.slice(0, hlit);
        var distanceLengths = allLengths.slice(hlit, hlit + hdist);
        if (!literalLengths[256]) literalLengths[256] = 1;
        literalTable = buildHuffmanTable(literalLengths);
        distanceTable = buildHuffmanTable(distanceLengths);
      } else {
        literalTable = buildHuffmanTable(fixedLiteralLengths);
        distanceTable = buildHuffmanTable(fixedDistanceLengths);
      }
      var blockError = decodeCompressedBlock();
      if (blockError) return null;
    } else {
      return null;
    }
  }
  return new Uint8Array(output);
}

/* ── PDF FlateDecode wrapper ──
   PDF FlateDecode streams are ZLIB streams (RFC 1950): a 2-byte header
   (0x78 0x9C ...) plus a 4-byte Adler-32 trailer. inflateRawDeflate() expects
   RAW deflate, so feeding it the whole stream fails on the header byte for
   every single image ("could not decompress the stream"). */
function isZlibWrappedStream(flateBytes) {
  return !!(flateBytes && flateBytes.length > 2 &&
    (flateBytes[0] & 0x0f) === 8 &&
    (((flateBytes[0] << 8) | flateBytes[1]) % 31) === 0);
}

/** Inflate a PDF Flate stream: zlib-wrapped when present, raw deflate otherwise */
function inflatePdfFlateStream(flateBytes) {
  if (!flateBytes || !flateBytes.length) return null;
  if (isZlibWrappedStream(flateBytes)) {
    var withoutZlibHeader = inflateRawDeflate(flateBytes.subarray(2));
    if (withoutZlibHeader) return withoutZlibHeader;
  }
  return inflateRawDeflate(flateBytes);
}

/** Same, but prefers the browser's native inflater (multimegabyte image
 *  streams are much faster there) - onDone(bytes | null) */
function inflatePdfFlateStreamAsync(flateBytes, onDone) {
  if (!flateBytes || !flateBytes.length) { onDone(null); return; }
  var zlibWrapped = isZlibWrappedStream(flateBytes);
  var deflatePayload = zlibWrapped ? flateBytes.subarray(2) : flateBytes;
  if (typeof DecompressionStream === 'function') {
    try {
      var decompressedStream = new Blob([deflatePayload]).stream().pipeThrough(new DecompressionStream('deflate'));
      new Response(decompressedStream).arrayBuffer().then(function (decompressedBuffer) {
        onDone(new Uint8Array(decompressedBuffer));
      }).catch(function (nativeInflateError) {
        console.warn('[STUDIO:IMAGES] native inflate failed, using the built-in inflater:', nativeInflateError);
        onDone(inflatePdfFlateStream(flateBytes));
      });
      return;
    } catch (streamSetupError) {
      console.warn('[STUDIO:IMAGES] DecompressionStream could not be used, using the built-in inflater:', streamSetupError);
    }
  }
  onDone(inflatePdfFlateStream(flateBytes));
}

/* ── PDF image stream discovery ── */
/* Diagnostics for the last scan, shown when nothing could be extracted. */
var lastPdfText = '';
var lastPdfScanInfo = {
  imageObjects: 0, inlineImages: 0, carvedImages: 0, encrypted: false,
  isPdf: false, imageMentions: 0, pageCount: 0, xobjectCount: 0, jp2Signature: false, masksSkipped: 0,
  filters: { dct: 0, flate: 0, jpx: 0, jbig2: 0, ccitt: 0 }
};

function findPdfImageStreams(pdfBytes) {
  var pdfText = bytesToLatin1String(pdfBytes);
  lastPdfText = pdfText;
  lastPdfScanInfo.masksSkipped = 0;
  var streams = [];
  // Object numbers referenced as /SMask or /Mask are alpha/soft masks, not
  // content images - decoding them returns solid black/gray squares.
  var maskObjectNumbers = {};
  var smaskRefPattern = /\/SMask\s+(\d+)\s+\d+\s+R/g;
  var smaskRefMatch;
  while ((smaskRefMatch = smaskRefPattern.exec(pdfText))) maskObjectNumbers[smaskRefMatch[1]] = true;
  var maskRefPattern = /\/Mask\s+(\d+)\s+\d+\s+R/g;
  var maskRefMatch;
  while ((maskRefMatch = maskRefPattern.exec(pdfText))) maskObjectNumbers[maskRefMatch[1]] = true;
  var maskArrayPattern = /\/Mask\s*\[([^\]]*?)\]/g;
  var maskArrayMatch;
  while ((maskArrayMatch = maskArrayPattern.exec(pdfText))) {
    var maskArrayNumbers = maskArrayMatch[1].match(/(\d+)\s+\d+\s+R/g) || [];
    for (var maskArrayIndex = 0; maskArrayIndex < maskArrayNumbers.length; maskArrayIndex++) {
      var maskNumberMatch = maskArrayNumbers[maskArrayIndex].match(/(\d+)/);
      if (maskNumberMatch) maskObjectNumbers[maskNumberMatch[1]] = true;
    }
  }
  // Walk the file object by object so every image gets its real object number
  // and dictionary (the old "look back 2000 chars" trick mis-assigned numbers
  // and could mistake real pictures for soft masks).
  var objectHeaderPattern = /(\d+)\s+\d+\s+obj\b/g;
  var headerMatch;
  while ((headerMatch = objectHeaderPattern.exec(pdfText)) && streams.length < 40) {
    var objectNumber = headerMatch[1];
    var dictionaryStart = headerMatch.index + headerMatch[0].length;
    var streamKeywordIndex = pdfText.indexOf('stream', dictionaryStart);
    if (streamKeywordIndex === -1) break;
    var dictText = pdfText.substring(dictionaryStart, streamKeywordIndex);
    var endObjectIndex = dictText.indexOf('endobj');
    if (endObjectIndex !== -1) { headerMatch.lastIndex = dictionaryStart + endObjectIndex; continue; }
    // Always hop over the whole payload, otherwise binary data could fake
    // another "N 0 obj" header.
    var payloadStart = streamKeywordIndex + 6;
    if (pdfText.charAt(payloadStart) === '\r') payloadStart++;
    if (pdfText.charAt(payloadStart) === '\n') payloadStart++;
    var endStreamIndex = pdfText.indexOf('endstream', payloadStart);
    if (endStreamIndex === -1) break;
    headerMatch.lastIndex = endStreamIndex + 9;
    if (!/\/Subtype\s*\/Image/.test(dictText)) continue;
    if (maskObjectNumbers[objectNumber]) { lastPdfScanInfo.masksSkipped++; continue; }
    var streamBytes = latin1StringToBytes(pdfText.substring(payloadStart, endStreamIndex));
    // Trim the EOL that precedes "endstream" so the binary payload is exact.
    var streamStart = 0;
    var streamEnd = streamBytes.length;
    while (streamStart < streamEnd && (streamBytes[streamStart] === 0x0d || streamBytes[streamStart] === 0x0a)) streamStart++;
    while (streamEnd > streamStart && (streamBytes[streamEnd - 1] === 0x0d || streamBytes[streamEnd - 1] === 0x0a)) streamEnd--;
    streams.push({ index: streams.length, objectNumber: objectNumber, dictText: dictText, streamBytes: streamBytes.subarray(streamStart, streamEnd) });
  }
  lastPdfScanInfo.imageObjects = streams.length;
  lastPdfScanInfo.inlineImages = 0;
  lastPdfScanInfo.carvedImages = 0;
  lastPdfScanInfo.encrypted = pdfText.indexOf('/Encrypt') !== -1;
  lastPdfScanInfo.isPdf = pdfText.indexOf('%PDF-') !== -1 && pdfText.indexOf('%PDF-') < 1024;
  lastPdfScanInfo.imageMentions = (pdfText.match(/\/Subtype\s*\/Image/g) || []).length;
  lastPdfScanInfo.pageCount = (pdfText.match(/\/Type\s*\/Page[^s]/g) || []).length;
  lastPdfScanInfo.xobjectCount = (pdfText.match(/\/XObject/g) || []).length;
  lastPdfScanInfo.filters = {
    dct: (pdfText.match(/\/DCTDecode/g) || []).length,
    flate: (pdfText.match(/\/FlateDecode/g) || []).length,
    jpx: (pdfText.match(/\/JPXDecode/g) || []).length,
    jbig2: (pdfText.match(/\/JBIG2Decode/g) || []).length,
    ccitt: (pdfText.match(/\/CCITTFaxDecode/g) || []).length
  };
  // JPEG2000 file signature (Chrome cannot decode JP2 images)
  lastPdfScanInfo.jp2Signature = false;
  var jp2SignatureBytes = [0x00, 0x00, 0x00, 0x0C, 0x6A, 0x50, 0x20, 0x20, 0x0D, 0x0A, 0x87, 0x0A];
  for (var jp2Index = 0; jp2Index < pdfBytes.length - jp2SignatureBytes.length; jp2Index++) {
    var jp2Match = true;
    for (var jp2ByteIndex = 0; jp2ByteIndex < jp2SignatureBytes.length; jp2ByteIndex++) {
      if (pdfBytes[jp2Index + jp2ByteIndex] !== jp2SignatureBytes[jp2ByteIndex]) { jp2Match = false; break; }
    }
    if (jp2Match) { lastPdfScanInfo.jp2Signature = true; break; }
  }
  // Inline images (BI ... ID ... EI) have no /Subtype /Image - common in PDFs
  // exported by design tools.
  var inlineImages = findInlinePdfImages(pdfText);
  for (var inlineIndex = 0; inlineIndex < inlineImages.length && streams.length < 40; inlineIndex++) {
    streams.push({ index: streams.length, dictText: inlineImages[inlineIndex].dictText, streamBytes: inlineImages[inlineIndex].streamBytes });
    lastPdfScanInfo.inlineImages++;
  }
  // Last resort: carve JPEG/PNG byte signatures straight out of the file.
  // Works for PDFs whose image dictionaries are hidden from the text scan
  // (compressed object streams, exotic producers).
  if (!streams.length) {
    var carvedImages = findRawImageSignatures(pdfBytes);
    for (var carvedIndex = 0; carvedIndex < carvedImages.length && streams.length < 40; carvedIndex++) {
      var carvedKind = carvedImages[carvedIndex].kind;
      streams.push({
        index: streams.length,
        dictText: '/Subtype /Image /Width 1 /Height 1' + (carvedKind === 'jpeg' ? ' /Filter /DCTDecode' : ''),
        streamBytes: carvedImages[carvedIndex].bytes
      });
      lastPdfScanInfo.carvedImages++;
    }
  }
  return streams;
}

/** Carve standalone JPEG/PNG files out of the raw PDF bytes */
function findRawImageSignatures(pdfBytes) {
  var carvedImages = [];
  var byteIndex = 0;
  var lengthLimit = pdfBytes.length - 3;
  while (byteIndex < lengthLimit && carvedImages.length < 30) {
    if (pdfBytes[byteIndex] === 0xFF && pdfBytes[byteIndex + 1] === 0xD8 && pdfBytes[byteIndex + 2] === 0xFF) {
      var jpegEnd = -1;
      for (var jpegScan = byteIndex + 2; jpegScan < pdfBytes.length - 1; jpegScan++) {
        if (pdfBytes[jpegScan] === 0xFF && pdfBytes[jpegScan + 1] === 0xD9) { jpegEnd = jpegScan + 2; break; }
      }
      if (jpegEnd > byteIndex + 200) {
        carvedImages.push({ kind: 'jpeg', bytes: pdfBytes.subarray(byteIndex, jpegEnd) });
        byteIndex = jpegEnd;
        continue;
      }
    } else if (pdfBytes[byteIndex] === 0x89 && pdfBytes[byteIndex + 1] === 0x50 && pdfBytes[byteIndex + 2] === 0x4E && pdfBytes[byteIndex + 3] === 0x47) {
      var pngEnd = -1;
      for (var pngScan = byteIndex + 8; pngScan < pdfBytes.length - 7; pngScan++) {
        if (pdfBytes[pngScan] === 0x49 && pdfBytes[pngScan + 1] === 0x45 && pdfBytes[pngScan + 2] === 0x4E && pdfBytes[pngScan + 3] === 0x44) { pngEnd = pngScan + 8; break; }
      }
      if (pngEnd > byteIndex + 200) {
        carvedImages.push({ kind: 'png', bytes: pdfBytes.subarray(byteIndex, pngEnd) });
        byteIndex = pngEnd;
        continue;
      }
    }
    byteIndex++;
  }
  return carvedImages;
}

/** Find inline images (BI/ID/EI) in the raw file and in inflated content streams */
function findInlinePdfImages(pdfText) {
  var foundInlineImages = [];
  function scanContentForInlineImages(contentText) {
    var inlinePattern = /\bBI\b([\s\S]{0,600}?)\bID\b([\s\S]*?)\sEI\b/g;
    var inlineMatch;
    while ((inlineMatch = inlinePattern.exec(contentText)) && foundInlineImages.length < 20) {
      var inlineDict = inlineMatch[1];
      if (!/\/W\s+\d+/.test(inlineDict) || !/\/H\s+\d+/.test(inlineDict)) continue;
      var rawBytes = latin1StringToBytes(inlineMatch[2]);
      var dataStart = 0;
      if (rawBytes.length && (rawBytes[0] === 0x0d || rawBytes[0] === 0x0a || rawBytes[0] === 0x20)) dataStart = 1;
      if (dataStart === 1 && rawBytes.length > 1 && rawBytes[0] === 0x0d && rawBytes[1] === 0x0a) dataStart = 2;
      var dataEnd = rawBytes.length;
      while (dataEnd > dataStart && (rawBytes[dataEnd - 1] === 0x0d || rawBytes[dataEnd - 1] === 0x0a || rawBytes[dataEnd - 1] === 0x20)) dataEnd--;
      foundInlineImages.push({ dictText: inlineDict, streamBytes: rawBytes.subarray(dataStart, dataEnd) });
    }
  }
  scanContentForInlineImages(pdfText);
  // Content streams are usually Flate-compressed - inflate them and scan again.
  var streamPattern = /stream\r?\n([\s\S]*?)endstream/g;
  var streamMatch;
  var scannedStreams = 0;
  while ((streamMatch = streamPattern.exec(pdfText)) && scannedStreams < 200 && foundInlineImages.length < 20) {
    scannedStreams++;
    var streamDict = pdfText.substring(Math.max(0, streamMatch.index - 1200), streamMatch.index);
    if (/\/Subtype\s*\/Image/.test(streamDict)) continue;
    if (!/\/FlateDecode/.test(streamDict)) continue;
    var inflatedContent = inflatePdfFlateStream(latin1StringToBytes(streamMatch[1]));
    if (inflatedContent) scanContentForInlineImages(bytesToLatin1String(inflatedContent));
  }
  return foundInlineImages;
}

/* ── Image normalization: extracted images keep their ORIGINAL size at
      web-level JPEG quality - they are meant to be uploaded to CMS storage
      as separate files, so no aggressive downscaling. ── */
function canvasCompressToJpeg(imageDataUrl, name, callback) {
  var sourceImage = new Image();
  sourceImage.onload = function() {
    try {
      var outputWidth = Math.max(1, sourceImage.width);
      var outputHeight = Math.max(1, sourceImage.height);
      var canvas = document.createElement('canvas');
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      var context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, outputWidth, outputHeight);
      context.drawImage(sourceImage, 0, 0, outputWidth, outputHeight);
      var jpegDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      callback(null, {
        id: genId(),
        name: name,
        width: sourceImage.width,
        height: sourceImage.height,
        dataUrl: jpegDataUrl,
        sizeKb: Math.max(1, Math.round(jpegDataUrl.length * 0.75 / 1024))
      });
    } catch (canvasError) {
      callback('browser could not decode the image: ' + canvasError.message);
    }
  };
  sourceImage.onerror = function() { callback('browser could not decode the image'); };
  sourceImage.src = imageDataUrl;
}

/** Shared: encode a canvas as a JPEG gallery image object */
function canvasToStudioImage(canvas, name, callback) {
  try {
    var jpegDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    callback(null, {
      id: genId(),
      name: name,
      width: canvas.width,
      height: canvas.height,
      dataUrl: jpegDataUrl,
      sizeKb: Math.max(1, Math.round(jpegDataUrl.length * 0.75 / 1024)),
      role: defaultStudioImageRole()
    });
  } catch (encodeError) {
    callback('browser could not encode the image: ' + encodeError.message);
  }
}

/** Indexed color (palette) images: map each index byte to the inline palette */
function indexedPixelsToJpeg(indexBytes, indexedInfo, name, callback) {
  try {
    var canvas = document.createElement('canvas');
    canvas.width = indexedInfo.width;
    canvas.height = indexedInfo.height;
    var context = canvas.getContext('2d');
    var imageData = context.createImageData(indexedInfo.width, indexedInfo.height);
    var data = imageData.data;
    var pixelCount = indexedInfo.width * indexedInfo.height;
    var bitsPerComponent = indexedInfo.bitsPerComponent;
    var palette = indexedInfo.palette;
    var maxIndex = (1 << bitsPerComponent) - 1;
    for (var pixel = 0; pixel < pixelCount; pixel++) {
      var indexValue;
      if (bitsPerComponent === 8) {
        indexValue = indexBytes[pixel] || 0;
      } else {
        var bitOffset = pixel * bitsPerComponent;
        var byteIndex = Math.floor(bitOffset / 8);
        if (byteIndex >= indexBytes.length) break;
        var shiftBits = 8 - bitsPerComponent - (bitOffset % 8);
        indexValue = (indexBytes[byteIndex] >> shiftBits) & maxIndex;
      }
      var paletteEntry = palette[indexValue] || palette[palette.length - 1] || [0, 0, 0];
      data[pixel * 4] = paletteEntry[0];
      data[pixel * 4 + 1] = paletteEntry[1];
      data[pixel * 4 + 2] = paletteEntry[2];
      data[pixel * 4 + 3] = 255;
    }
    context.putImageData(imageData, 0, 0);
    canvasToStudioImage(canvas, name, callback);
  } catch (indexedError) {
    callback('image skipped: ' + indexedError.message);
  }
}

/* ── PDF filter decoders (needed for real-world image streams) ── */
function asciiHexDecodePdf(inputBytes) {
  var outputBytes = [];
  var highNibble = -1;
  for (var i = 0; i < inputBytes.length; i++) {
    var byteValue = inputBytes[i];
    if (byteValue === 0x3E) break; // '>'
    var nibble = -1;
    if (byteValue >= 0x30 && byteValue <= 0x39) nibble = byteValue - 0x30;
    else if (byteValue >= 0x41 && byteValue <= 0x46) nibble = byteValue - 0x37;
    else if (byteValue >= 0x61 && byteValue <= 0x66) nibble = byteValue - 0x57;
    else continue;
    if (highNibble === -1) { highNibble = nibble; }
    else { outputBytes.push((highNibble << 4) | nibble); highNibble = -1; }
  }
  if (highNibble !== -1) outputBytes.push(highNibble << 4);
  return new Uint8Array(outputBytes);
}

function ascii85DecodePdf(inputBytes) {
  var outputBytes = [];
  var group = [];
  var i = 0;
  if (inputBytes.length > 1 && inputBytes[0] === 0x3C && inputBytes[1] === 0x7E) i = 2; // '<~'
  for (; i < inputBytes.length; i++) {
    var byteValue = inputBytes[i];
    if (byteValue === 0x7E) break; // '~'
    if (byteValue === 0x20 || byteValue === 0x0A || byteValue === 0x0D || byteValue === 0x09) continue;
    if (byteValue === 0x7A && group.length === 0) { outputBytes.push(0, 0, 0, 0); continue; } // 'z'
    if (byteValue < 0x21 || byteValue > 0x75) continue;
    group.push(byteValue - 0x21);
    if (group.length === 5) {
      var value = (((group[0] * 85 + group[1]) * 85 + group[2]) * 85 + group[3]) * 85 + group[4];
      outputBytes.push((value >>> 24) & 0xFF, (value >>> 16) & 0xFF, (value >>> 8) & 0xFF, value & 0xFF);
      group = [];
    }
  }
  if (group.length > 1) {
    var paddingCount = 5 - group.length;
    while (group.length < 5) group.push(84);
    var paddedValue = (((group[0] * 85 + group[1]) * 85 + group[2]) * 85 + group[3]) * 85 + group[4];
    var paddedBytes = [(paddedValue >>> 24) & 0xFF, (paddedValue >>> 16) & 0xFF, (paddedValue >>> 8) & 0xFF, paddedValue & 0xFF];
    for (var padIndex = 0; padIndex < 4 - paddingCount; padIndex++) outputBytes.push(paddedBytes[padIndex]);
  }
  return new Uint8Array(outputBytes);
}

function runLengthDecodePdf(inputBytes) {
  var outputBytes = [];
  var i = 0;
  while (i < inputBytes.length) {
    var controlByte = inputBytes[i++];
    if (controlByte === 128) break;
    if (controlByte < 128) {
      var literalCount = controlByte + 1;
      for (var literalIndex = 0; literalIndex < literalCount && i < inputBytes.length; literalIndex++) outputBytes.push(inputBytes[i++]);
    } else {
      var repeatCount = 257 - controlByte;
      var repeatedByte = inputBytes[i++];
      for (var repeatIndex = 0; repeatIndex < repeatCount; repeatIndex++) outputBytes.push(repeatedByte);
    }
  }
  return new Uint8Array(outputBytes);
}

/** Undo PNG predictors (Predictor 15) used by some Flate image streams */
function applyPngPredictor(predictedBytes, width, height, channels) {
  var rowLength = width * channels;
  var outputBytes = new Uint8Array(rowLength * height);
  var previousRow = new Uint8Array(rowLength);
  var sourceOffset = 0;
  for (var rowIndex = 0; rowIndex < height; rowIndex++) {
    if (sourceOffset >= predictedBytes.length) break;
    var filterType = predictedBytes[sourceOffset++];
    var rowOutput = outputBytes.subarray(rowIndex * rowLength, rowIndex * rowLength + rowLength);
    for (var columnIndex = 0; columnIndex < rowLength; columnIndex++) {
      var rawValue = sourceOffset < predictedBytes.length ? predictedBytes[sourceOffset++] : 0;
      var leftValue = columnIndex >= channels ? rowOutput[columnIndex - channels] : 0;
      var upValue = previousRow[columnIndex];
      var upLeftValue = columnIndex >= channels ? previousRow[columnIndex - channels] : 0;
      var restoredValue = rawValue;
      if (filterType === 1) restoredValue = rawValue + leftValue;
      else if (filterType === 2) restoredValue = rawValue + upValue;
      else if (filterType === 3) restoredValue = rawValue + Math.floor((leftValue + upValue) / 2);
      else if (filterType === 4) {
        var predictorValue = leftValue + upValue - upLeftValue;
        var distanceLeft = Math.abs(predictorValue - leftValue);
        var distanceUp = Math.abs(predictorValue - upValue);
        var distanceUpLeft = Math.abs(predictorValue - upLeftValue);
        restoredValue = rawValue + (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft ? leftValue : (distanceUp <= distanceUpLeft ? upValue : upLeftValue));
      }
      rowOutput[columnIndex] = restoredValue & 0xFF;
    }
    previousRow = rowOutput;
  }
  return outputBytes;
}

/** Parse an inline indexed palette: /ColorSpace [/Indexed /DeviceRGB n <hex>] */
function parseIndexedPalette(dictText) {
  var indexedMatch = dictText.match(/\/ColorSpace\s*\[\s*\/Indexed\s*\/(\w+)\s+(\d+)\s*([\s\S]{0,4000}?)\]/);
  if (!indexedMatch) return null;
  var baseSpaceName = indexedMatch[1];
  var baseChannels = baseSpaceName === 'DeviceGray' ? 1 : (baseSpaceName === 'DeviceCMYK' ? 4 : 3);
  var hexMatch = indexedMatch[3].match(/<([0-9A-Fa-f\s]+)>/);
  if (!hexMatch) return null;
  var hexValue = hexMatch[1].replace(/\s+/g, '');
  if (hexValue.length < baseChannels * 2) return null;
  var palette = [];
  for (var position = 0; position + baseChannels * 2 <= hexValue.length; position += baseChannels * 2) {
    var red = parseInt(hexValue.substr(position, 2), 16);
    var green = baseChannels >= 3 ? parseInt(hexValue.substr(position + 2, 2), 16) : red;
    var blue = baseChannels >= 3 ? parseInt(hexValue.substr(position + 4, 2), 16) : red;
    palette.push([red, green, blue]);
  }
  return palette.length ? palette : null;
}

/** Read one indirect object body (N 0 obj ... endobj) from the current PDF text */
function readPdfObjectBody(objectNumber) {
  if (!lastPdfText) return '';
  var objectPattern = new RegExp('(?:^|[\\r\\n\\s])' + objectNumber + '\\s+\\d+\\s+obj\\b([\\s\\S]{0,2000}?)endobj');
  var objectMatch = lastPdfText.match(objectPattern);
  return objectMatch ? objectMatch[1] : '';
}

var PDF_FILTER_NAMES = ['FlateDecode', 'Fl', 'DCTDecode', 'DCT', 'ASCIIHexDecode', 'AHx', 'ASCII85Decode', 'A85', 'RunLengthDecode', 'RL', 'LZWDecode', 'LZW', 'JPXDecode', 'CCITTFaxDecode', 'CCF', 'JBIG2Decode'];

/** Resolve /Filter: direct array, direct name, or an indirect object reference */
function resolvePdfFilterNames(dictText) {
  var filterArrayMatch = dictText.match(/\/Filter\s*\[([^\]]*?)\]/);
  if (filterArrayMatch) {
    var arrayNames = filterArrayMatch[1].match(/\/(\w+)/g);
    return arrayNames ? arrayNames.map(function(nameText) { return nameText.substring(1); }) : [];
  }
  var filterSingleMatch = dictText.match(/\/Filter\s*\/(\w+)/);
  if (filterSingleMatch) return [filterSingleMatch[1]];
  var filterIndirectMatch = dictText.match(/\/Filter\s+(\d+)\s+\d+\s+R/);
  if (filterIndirectMatch) {
    var filterBody = readPdfObjectBody(filterIndirectMatch[1]);
    var bodyNames = (filterBody.match(/\/(\w+)/g) || []).map(function(nameText) { return nameText.substring(1); });
    var knownNames = [];
    for (var nameIndex = 0; nameIndex < bodyNames.length; nameIndex++) {
      if (PDF_FILTER_NAMES.indexOf(bodyNames[nameIndex]) !== -1) knownNames.push(bodyNames[nameIndex]);
    }
    return knownNames;
  }
  return [];
}

/** Resolve the ColorSpace description (direct or indirect, ICCBased N-aware) */
function resolvePdfColorSpaceText(dictText) {
  var directArrayMatch = dictText.match(/\/ColorSpace\s*\[([\s\S]{0,1000}?)\]/);
  if (directArrayMatch) return '[' + directArrayMatch[1] + ']';
  var directNameMatch = dictText.match(/\/ColorSpace\s*\/(\w+)/);
  if (directNameMatch) return '/' + directNameMatch[1];
  var indirectMatch = dictText.match(/\/ColorSpace\s+(\d+)\s+\d+\s+R/);
  if (indirectMatch) {
    var bodyText = readPdfObjectBody(indirectMatch[1]);
    var colorNameMatch = bodyText.match(/\/(DeviceRGB|DeviceGray|DeviceCMYK|ICCBased|Indexed|CalRGB|CalGray|Lab)/);
    if (colorNameMatch) return bodyText;
    var iccComponentsMatch = bodyText.match(/\/N\s+(\d+)/);
    if (iccComponentsMatch) {
      var componentCount = parseInt(iccComponentsMatch[1], 10);
      if (componentCount === 3) return '/DeviceRGB';
      if (componentCount === 1) return '/DeviceGray';
      if (componentCount === 4) return '/DeviceCMYK';
    }
  }
  return '';
}

/** LZW decoder (PDF variant, EarlyChange support) */
function lzwDecodePdf(inputBytes, earlyChange) {
  var early = (earlyChange === 0) ? 0 : 1;
  var outputBytes = [];
  var dictionary = [];
  var codeLength = 9;
  var nextCode = 258;
  function resetDictionary() {
    dictionary = [];
    for (var i = 0; i < 256; i++) dictionary.push([i]);
    dictionary.push(null);
    dictionary.push(null);
    codeLength = 9;
    nextCode = 258;
  }
  resetDictionary();
  var bitBuffer = 0;
  var bitCount = 0;
  var previousEntry = null;
  for (var byteIndex = 0; byteIndex < inputBytes.length; byteIndex++) {
    bitBuffer = (bitBuffer << 8) | inputBytes[byteIndex];
    bitCount += 8;
    while (bitCount >= codeLength) {
      var code = (bitBuffer >> (bitCount - codeLength)) & ((1 << codeLength) - 1);
      bitCount -= codeLength;
      bitBuffer &= (bitCount > 0) ? ((1 << bitCount) - 1) : 0;
      if (code === 256) { resetDictionary(); previousEntry = null; continue; }
      if (code === 257) return new Uint8Array(outputBytes);
      var entry = null;
      if (code < dictionary.length && dictionary[code]) entry = dictionary[code];
      else if (previousEntry) entry = previousEntry.concat(previousEntry[0]);
      else return new Uint8Array(outputBytes);
      for (var entryIndex = 0; entryIndex < entry.length; entryIndex++) outputBytes.push(entry[entryIndex]);
      if (previousEntry && nextCode < 4096) {
        dictionary[nextCode++] = previousEntry.concat(entry[0]);
        if (nextCode + early === (1 << codeLength) && codeLength < 12) codeLength++;
      }
      previousEntry = entry;
    }
  }
  return new Uint8Array(outputBytes);
}

/** Read one sample from a packed PDF pixel buffer (1/2/4/8/16 bits) */
function unpackPdfSample(pixelBytes, sampleIndex, bitsPerComponent) {
  if (bitsPerComponent === 8) return pixelBytes[sampleIndex] || 0;
  if (bitsPerComponent === 16) {
    var highByte = pixelBytes[sampleIndex * 2] || 0;
    var lowByte = pixelBytes[sampleIndex * 2 + 1] || 0;
    return (highByte << 8) | lowByte;
  }
  var bitOffset = sampleIndex * bitsPerComponent;
  var byteIndex = Math.floor(bitOffset / 8);
  if (byteIndex >= pixelBytes.length) return 0;
  var shiftBits = 8 - bitsPerComponent - (bitOffset % 8);
  return (pixelBytes[byteIndex] >> shiftBits) & ((1 << bitsPerComponent) - 1);
}

/** Parse a /Decode array (used by image masks and inverted images) */
function parsePdfDecodeArray(dictText) {
  var decodeMatch = dictText.match(/\/Decode\s*\[([^\]]*?)\]/);
  if (!decodeMatch) return null;
  var values = decodeMatch[1].trim().split(/\s+/).map(function(valueText) { return parseFloat(valueText); });
  return values.length ? values : null;
}

/** Fixed PNG predictors 10-14 (no per-row filter byte) */
function applyFixedPngPredictor(predictedBytes, width, height, channels, predictor) {
  var rowLength = width * channels;
  var outputBytes = new Uint8Array(rowLength * height);
  var previousRow = new Uint8Array(rowLength);
  var sourceOffset = 0;
  for (var rowIndex = 0; rowIndex < height; rowIndex++) {
    var rowOutput = outputBytes.subarray(rowIndex * rowLength, rowIndex * rowLength + rowLength);
    for (var columnIndex = 0; columnIndex < rowLength; columnIndex++) {
      var rawValue = sourceOffset < predictedBytes.length ? predictedBytes[sourceOffset++] : 0;
      var leftValue = columnIndex >= channels ? rowOutput[columnIndex - channels] : 0;
      var upValue = previousRow[columnIndex];
      var upLeftValue = columnIndex >= channels ? previousRow[columnIndex - channels] : 0;
      var restoredValue = rawValue;
      if (predictor === 11) restoredValue = rawValue + leftValue;
      else if (predictor === 12) restoredValue = rawValue + upValue;
      else if (predictor === 13) restoredValue = rawValue + Math.floor((leftValue + upValue) / 2);
      else if (predictor === 14) {
        var predictorValue = leftValue + upValue - upLeftValue;
        var distanceLeft = Math.abs(predictorValue - leftValue);
        var distanceUp = Math.abs(predictorValue - upValue);
        var distanceUpLeft = Math.abs(predictorValue - upLeftValue);
        restoredValue = rawValue + (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft ? leftValue : (distanceUp <= distanceUpLeft ? upValue : upLeftValue));
      }
      rowOutput[columnIndex] = restoredValue & 0xFF;
    }
    previousRow = rowOutput;
  }
  return outputBytes;
}

/** Apply any PDF predictor (10-15). TIFF predictor 2 is left untouched. */
function applyPdfPredictor(predictedBytes, width, height, channels, predictor) {
  if (predictor === 15) return applyPngPredictor(predictedBytes, width, height, channels);
  if (predictor >= 10 && predictor <= 14) return applyFixedPngPredictor(predictedBytes, width, height, channels, predictor);
  return predictedBytes;
}

/** Map one PDF sample to 0-255 honoring its /Decode range */
function mapPdfSampleToByte(sample, bitsPerComponent, channelIndex, decodeArray) {
  var maxSampleValue = (bitsPerComponent === 16) ? 65535 : ((1 << bitsPerComponent) - 1);
  var decodeMin = 0;
  var decodeMax = 1;
  if (decodeArray && decodeArray.length >= (channelIndex + 1) * 2) {
    decodeMin = decodeArray[channelIndex * 2];
    decodeMax = decodeArray[channelIndex * 2 + 1];
  }
  var normalizedSample = maxSampleValue ? (sample / maxSampleValue) : 0;
  var decodedValue = decodeMin + normalizedSample * (decodeMax - decodeMin);
  return Math.max(0, Math.min(255, Math.round(decodedValue * 255)));
}

/** Render packed pixel samples (1/2/4/8/16-bit, Gray/RGB/CMYK, image masks) */
function packedPixelsToJpeg(pixelBytes, pixelInfo, name, callback) {
  try {
    var width = pixelInfo.width;
    var height = pixelInfo.height;
    var channels = pixelInfo.channels;
    var bitsPerComponent = pixelInfo.bitsPerComponent;
    var decodeArray = pixelInfo.decodeArray || null;
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var context = canvas.getContext('2d');
    var imageData = context.createImageData(width, height);
    var data = imageData.data;
    var totalPixels = width * height;
    for (var pixelIndex = 0; pixelIndex < totalPixels; pixelIndex++) {
      var baseSample = pixelIndex * channels;
      var red, green, blue;
      if (channels === 1) {
        var grayValue = mapPdfSampleToByte(unpackPdfSample(pixelBytes, baseSample, bitsPerComponent), bitsPerComponent, 0, decodeArray);
        red = green = blue = grayValue;
      } else if (channels === 3) {
        red = mapPdfSampleToByte(unpackPdfSample(pixelBytes, baseSample, bitsPerComponent), bitsPerComponent, 0, decodeArray);
        green = mapPdfSampleToByte(unpackPdfSample(pixelBytes, baseSample + 1, bitsPerComponent), bitsPerComponent, 1, decodeArray);
        blue = mapPdfSampleToByte(unpackPdfSample(pixelBytes, baseSample + 2, bitsPerComponent), bitsPerComponent, 2, decodeArray);
      } else {
        var cyan = mapPdfSampleToByte(unpackPdfSample(pixelBytes, baseSample, bitsPerComponent), bitsPerComponent, 0, decodeArray);
        var magenta = mapPdfSampleToByte(unpackPdfSample(pixelBytes, baseSample + 1, bitsPerComponent), bitsPerComponent, 1, decodeArray);
        var yellow = mapPdfSampleToByte(unpackPdfSample(pixelBytes, baseSample + 2, bitsPerComponent), bitsPerComponent, 2, decodeArray);
        var black = mapPdfSampleToByte(unpackPdfSample(pixelBytes, baseSample + 3, bitsPerComponent), bitsPerComponent, 3, decodeArray);
        red = 255 - Math.min(255, cyan + black);
        green = 255 - Math.min(255, magenta + black);
        blue = 255 - Math.min(255, yellow + black);
      }
      var dataOffset = pixelIndex * 4;
      data[dataOffset] = red;
      data[dataOffset + 1] = green;
      data[dataOffset + 2] = blue;
      data[dataOffset + 3] = 255;
    }
    context.putImageData(imageData, 0, 0);
    canvasToStudioImage(canvas, name, callback);
  } catch (packedError) {
    callback('image skipped: ' + packedError.message);
  }
}

/** Read the frame header (SOF marker) of a JPEG stream - diagnostics only */
function describeJpegFrame(jpegBytes) {
  var markerPos = 2;
  while (markerPos + 4 < jpegBytes.length) {
    if (jpegBytes[markerPos] !== 0xFF) { markerPos++; continue; }
    var markerCode = jpegBytes[markerPos + 1];
    if (markerCode === 0xFF) { markerPos++; continue; }
    if (markerCode === 0xD8 || markerCode === 0xD9 || (markerCode >= 0xD0 && markerCode <= 0xD7)) { markerPos += 2; continue; }
    if (markerCode === 0xDA) break; // start of scan - no frame header further down
    var isStartOfFrame = markerCode >= 0xC0 && markerCode <= 0xCF && markerCode !== 0xC4 && markerCode !== 0xC8 && markerCode !== 0xCC;
    if (isStartOfFrame && markerPos + 9 < jpegBytes.length) {
      return {
        precision: jpegBytes[markerPos + 4],
        height: (jpegBytes[markerPos + 5] << 8) | jpegBytes[markerPos + 6],
        width: (jpegBytes[markerPos + 7] << 8) | jpegBytes[markerPos + 8],
        components: jpegBytes[markerPos + 9]
      };
    }
    var segmentLength = (jpegBytes[markerPos + 2] << 8) | jpegBytes[markerPos + 3];
    if (segmentLength < 2) break;
    markerPos += 2 + segmentLength;
  }
  return null;
}

/** Short JPEG description appended to a decode error so the cause is visible */
function describeJpegStreamForError(jpegBytes, jpegFrame) {
  var details = [];
  if (jpegFrame) details.push(jpegFrame.width + 'x' + jpegFrame.height);
  details.push(Math.max(1, Math.round(jpegBytes.length / 1024)) + ' KB');
  if (jpegFrame && jpegFrame.components === 4) details.push('4-component CMYK JPEG, which Chrome cannot display');
  else if (jpegFrame && jpegFrame.components) details.push(jpegFrame.components + ' components');
  return ' (JPEG ' + details.join(', ') + ')';
}

/** Text of /DecodeParms - inline dictionary or an indirect object reference */
function resolvePdfDecodeParamsText(dictText) {
  var inlineMatch = dictText.match(/\/DecodeParms\s*(<<[\s\S]{0,800}?>>)/);
  if (inlineMatch) return inlineMatch[1];
  var indirectMatch = dictText.match(/\/DecodeParms\s+(\d+)\s+\d+\s+R/);
  if (indirectMatch) {
    var paramsBody = readPdfObjectBody(indirectMatch[1]);
    if (paramsBody) return paramsBody;
  }
  return '';
}

function decodePdfImageCandidate(candidate, callback) {
  var dictText = candidate.dictText;
  var width = 0;
  var height = 0;
  var widthMatch = dictText.match(/\/Width\s+(\d+)/) || dictText.match(/\/W\s+(\d+)/);
  var heightMatch = dictText.match(/\/Height\s+(\d+)/) || dictText.match(/\/H\s+(\d+)/);
  if (widthMatch) width = parseInt(widthMatch[1], 10);
  if (heightMatch) height = parseInt(heightMatch[1], 10);
  if (!width || !height) { callback({ error: 'image skipped: missing width/height' }); return; }
  var filters = resolvePdfFilterNames(dictText);
  var imageName = 'document-image-' + (candidate.index + 1);
  applyPdfImageFilters(candidate.streamBytes, filters, 0, dictText, function(filterError, filteredBytes, imageCodec) {
    if (filterError) { callback({ error: filterError }); return; }
    finishDecodingPdfImage(dictText, filteredBytes, imageCodec, width, height, imageName, callback);
  });
}

/** Run the PDF filter chain; FlateDecode goes through the (async) inflater */
function applyPdfImageFilters(streamBytes, filters, filterIndex, dictText, onDone) {
  if (filterIndex >= filters.length) { onDone(null, streamBytes, ''); return; }
  var filterName = filters[filterIndex];
  if (filterName === 'DCTDecode' || filterName === 'DCT') { onDone(null, streamBytes, 'jpeg'); return; }
  if (filterName === 'JPXDecode') { onDone('image skipped: JPEG2000 is not supported'); return; }
  if (filterName === 'FlateDecode' || filterName === 'Fl') {
    inflatePdfFlateStreamAsync(streamBytes, function(inflatedBytes) {
      if (!inflatedBytes) { onDone('image skipped: could not decompress the stream'); return; }
      applyPdfImageFilters(inflatedBytes, filters, filterIndex + 1, dictText, onDone);
    });
    return;
  }
  if (filterName === 'ASCIIHexDecode' || filterName === 'AHx') {
    applyPdfImageFilters(asciiHexDecodePdf(streamBytes), filters, filterIndex + 1, dictText, onDone);
    return;
  }
  if (filterName === 'ASCII85Decode' || filterName === 'A85') {
    applyPdfImageFilters(ascii85DecodePdf(streamBytes), filters, filterIndex + 1, dictText, onDone);
    return;
  }
  if (filterName === 'RunLengthDecode' || filterName === 'RL') {
    applyPdfImageFilters(runLengthDecodePdf(streamBytes), filters, filterIndex + 1, dictText, onDone);
    return;
  }
  if (filterName === 'LZWDecode' || filterName === 'LZW') {
    var earlyChangeMatch = dictText.match(/\/EarlyChange\s+(\d+)/);
    applyPdfImageFilters(lzwDecodePdf(streamBytes, earlyChangeMatch ? parseInt(earlyChangeMatch[1], 10) : 1), filters, filterIndex + 1, dictText, onDone);
    return;
  }
  if (filterName === 'CCITTFaxDecode' || filterName === 'CCF') { onDone('image skipped: CCITT fax images are not supported'); return; }
  if (filterName === 'JBIG2Decode') { onDone('image skipped: JBIG2 images are not supported'); return; }
  onDone('image skipped: unsupported filter ' + filterName);
}

/** Turn already-decoded samples into a gallery image */
function finishDecodingPdfImage(dictText, streamBytes, imageCodec, width, height, imageName, callback) {
  if (imageCodec === 'jpeg') {
    if (streamBytes.length < 4 || streamBytes[0] !== 0xFF || streamBytes[1] !== 0xD8) {
      callback({ error: 'image skipped: JPEG stream does not start with FF D8 (' + streamBytes.length + ' bytes)' });
      return;
    }
    var jpegFrame = describeJpegFrame(streamBytes);
    canvasCompressToJpeg('data:image/jpeg;base64,' + bytesToBase64(streamBytes), imageName, function(jpegError, jpegImage) {
      callback(jpegError ? { error: jpegError + describeJpegStreamForError(streamBytes, jpegFrame) } : { image: jpegImage });
    });
    return;
  }
  if (streamBytes.length > 8 && streamBytes[0] === 0x89 && streamBytes[1] === 0x50) {
    canvasCompressToJpeg('data:image/png;base64,' + bytesToBase64(streamBytes), imageName, function(pngError, pngImage) {
      callback(pngError ? { error: pngError + ' (PNG ' + Math.max(1, Math.round(streamBytes.length / 1024)) + ' KB)' } : { image: pngImage });
    });
    return;
  }
  var indexedPalette = parseIndexedPalette(dictText);
  var colorSpaceText = resolvePdfColorSpaceText(dictText);
  if (!indexedPalette && colorSpaceText.indexOf('/Indexed') !== -1) indexedPalette = parseIndexedPalette('/ColorSpace ' + colorSpaceText.replace(/^\//, ''));
  var isImageMask = /\/ImageMask\s+true/.test(dictText);
  var bitsMatch = dictText.match(/\/BitsPerComponent\s+(\d+)/) || dictText.match(/\/BPC\s+(\d+)/);
  var bitsPerComponent = isImageMask ? 1 : (bitsMatch ? parseInt(bitsMatch[1], 10) : 8);
  var decodeParamsText = resolvePdfDecodeParamsText(dictText);
  var predictorMatch = decodeParamsText.match(/\/Predictor\s+(\d+)/) || dictText.match(/\/Predictor\s+(\d+)/);
  if (predictorMatch) {
    var predictorValue = parseInt(predictorMatch[1], 10);
    if (predictorValue >= 10) {
      var colorsMatch = decodeParamsText.match(/\/Colors\s+(\d+)/) || dictText.match(/\/Colors\s+(\d+)/);
      var columnsMatch = decodeParamsText.match(/\/Columns\s+(\d+)/) || dictText.match(/\/Columns\s+(\d+)/);
      var baseChannelsForPredictor = colorsMatch
        ? parseInt(colorsMatch[1], 10)
        : (indexedPalette ? 1 : (/\/DeviceGray|CalGray/.test(colorSpaceText) ? 1 : (/\/DeviceCMYK/.test(colorSpaceText) ? 4 : 3)));
      var bytesPerSample = Math.max(1, Math.round(bitsPerComponent / 8));
      var predictorWidth = columnsMatch ? parseInt(columnsMatch[1], 10) : width;
      streamBytes = applyPdfPredictor(streamBytes, predictorWidth, height, baseChannelsForPredictor * bytesPerSample, predictorValue);
    }
  }
  if (indexedPalette && (bitsPerComponent === 1 || bitsPerComponent === 2 || bitsPerComponent === 4 || bitsPerComponent === 8)) {
    indexedPixelsToJpeg(streamBytes, { width: width, height: height, bitsPerComponent: bitsPerComponent, palette: indexedPalette }, imageName, function(indexedError, indexedImage) { callback(indexedError ? { error: indexedError } : { image: indexedImage }); });
    return;
  }
  var isGray = /\/DeviceGray|CalGray/.test(colorSpaceText);
  var isRgb = /\/DeviceRGB|CalRGB/.test(colorSpaceText);
  var isCmyk = /\/DeviceCMYK/.test(colorSpaceText);
  // Unknown/indirect color space: infer the channel count from the payload size.
  if (!isImageMask && !isGray && !isRgb && !isCmyk) {
    var bytesPerSampleGuess = Math.max(1, Math.round(bitsPerComponent / 8));
    var inferredChannels = Math.round(streamBytes.length / (width * height * bytesPerSampleGuess));
    if (inferredChannels === 1) isGray = true;
    else if (inferredChannels === 3) isRgb = true;
    else if (inferredChannels === 4) isCmyk = true;
  }
  if (isImageMask || isGray || isRgb || isCmyk) {
    var decodeArray = parsePdfDecodeArray(dictText);
    packedPixelsToJpeg(streamBytes, {
      width: width,
      height: height,
      bitsPerComponent: bitsPerComponent,
      channels: isCmyk ? 4 : (isRgb ? 3 : 1),
      decodeArray: decodeArray
    }, imageName, function(packedError, packedImage) { callback(packedError ? { error: packedError } : { image: packedImage }); });
    return;
  }
  callback({ error: 'image skipped: unsupported pixel format' + (indexedPalette ? ' (indexed)' : ' (bits=' + bitsPerComponent + ')') });
}

function decodePdfImageCandidates(candidates, callback) {
  var decodedImages = [];
  var skippedNotes = [];
  var candidateIndex = 0;
  function decodeNextCandidate() {
    if (candidateIndex >= candidates.length) { callback(null, decodedImages, skippedNotes); return; }
    var candidate = candidates[candidateIndex++];
    decodePdfImageCandidate(candidate, function(decodeResult) {
      if (decodeResult.error) {
        skippedNotes.push(decodeResult.error);
      } else {
        decodedImages.push(decodeResult.image);
      }
      decodeNextCandidate();
    });
  }
  decodeNextCandidate();
}

/* ── Studio rendering helpers ── */
var studioStatusTicker = null;

function stopStudioStatusTicker() {
  if (studioStatusTicker) {
    clearInterval(studioStatusTicker);
    studioStatusTicker = null;
  }
}

/** Write the status line without touching the ticker (internal) */
function writeStudioStatus(message, kind) {
  var statusEl = el('sd-status');
  if (!statusEl) return;
  if (!message) { statusEl.style.display = 'none'; return; }
  statusEl.style.display = '';
  statusEl.textContent = message;
  statusEl.className = 'sd-status ' + (kind || 'busy');
}

function setStudioStatus(message, kind) {
  stopStudioStatusTicker();
  writeStudioStatus(message, kind);
}

/** Live status line: base message + fresh details + elapsed seconds, updated every second */
function startStudioStatusTicker(baseMessage, detailProvider) {
  stopStudioStatusTicker();
  var startedAt = Date.now();
  function renderTicker() {
    var elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    var detailText = detailProvider ? detailProvider() : '';
    writeStudioStatus(baseMessage + (detailText ? ' · ' + detailText : '') + ' · ' + elapsedSeconds + 's', 'busy');
  }
  renderTicker();
  studioStatusTicker = setInterval(renderTicker, 1000);
}

/** 12345 -> "12,345" */
function formatCount(value) {
  return String(value || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Render the partial HTML stream visually (broken tags are auto-corrected) */
function renderStudioHtmlStreamPreview(rawHtml) {
  var previewFrame = el('sd-gen-preview');
  if (!previewFrame || !rawHtml) return;
  var partialHtml = String(rawHtml).replace(/^```(?:html)?\s*\n?/i, '');
  previewFrame.srcdoc = studioPreviewCss + partialHtml;
}

/** Disable the heavy actions while an AI run is streaming (visible on the button too) */
function setStudioActionButtonsBusy(isBusy) {
  var generateButton = el('btn-sd-generate');
  var processButton = el('btn-sd-process');
  if (generateButton) {
    generateButton.disabled = !!isBusy;
    generateButton.textContent = isBusy ? '⏳ Generating…' : '✨ Generate New Content';
  }
  if (processButton) processButton.disabled = !!isBusy;
}

/** Drawer layout defaults - the workspace rail (tabs + actions) is part of the HTML */
function arrangeStudioDrawerLayout() {
  var studioDrawer = el('sd-studio-drawer');
  if (!studioDrawer) return;
  if (!studioDrawer.getAttribute('data-active-tab')) studioDrawer.setAttribute('data-active-tab', 'document');
}

/* ── Workspace tabs: Source / Generated / Side by Side / Pictures ── */
var studioCompareMode = false;

/** Show one workspace tab ('document' = Source, 'content' = Generated, 'compare', 'pictures') */
function switchStudioTab(tabName) {
  var previewColumns = el('sd-preview-columns');
  if (!previewColumns) return;
  var allowedTabs = ['document', 'content', 'compare', 'pictures'];
  var chosenTab = allowedTabs.indexOf(tabName) === -1 ? 'document' : tabName;
  previewColumns.setAttribute('data-tab', chosenTab);
  var studioDrawer = el('sd-studio-drawer');
  if (studioDrawer) studioDrawer.setAttribute('data-active-tab', chosenTab);
  studioCompareMode = chosenTab === 'compare';
  var tabButtons = [
    { id: 'btn-sd-tab-document', name: 'document' },
    { id: 'btn-sd-tab-content', name: 'content' },
    { id: 'btn-sd-compare', name: 'compare' },
    { id: 'btn-sd-tab-pictures', name: 'pictures' }
  ];
  for (var tabIndex = 0; tabIndex < tabButtons.length; tabIndex++) {
    var tabButton = el(tabButtons[tabIndex].id);
    if (!tabButton) continue;
    var isActiveTab = tabButtons[tabIndex].name === chosenTab;
    tabButton.classList.toggle('sd-tab-active', isActiveTab);
    tabButton.setAttribute('aria-selected', isActiveTab ? 'true' : 'false');
  }
  tool.resize();
}

function toggleStudioCompareMode() {
  var previewColumns = el('sd-preview-columns');
  var currentTab = previewColumns ? previewColumns.getAttribute('data-tab') : '';
  switchStudioTab(currentTab === 'compare' ? 'document' : 'compare');
}

/* ── Screenshot import ──
   Vector drawings, charts and diagrams are page content, not embedded image
   objects, so they cannot be extracted from the PDF as files. A screenshot
   pasted from the clipboard is the practical way to capture them. */
function handleStudioImagePaste(pasteEvent) {
  if (!studioCurrentDocUrl) return;
  var studioDrawer = el('sd-studio-drawer');
  if (!studioDrawer || !studioDrawer.classList.contains('sd-drawer-open')) return;
  var clipboard = pasteEvent.clipboardData;
  if (!clipboard || !clipboard.items) return;
  var pastedImageFile = null;
  for (var itemIndex = 0; itemIndex < clipboard.items.length; itemIndex++) {
    var clipboardItem = clipboard.items[itemIndex];
    if (clipboardItem.kind === 'file' && clipboardItem.type && clipboardItem.type.indexOf('image/') === 0) {
      pastedImageFile = clipboardItem.getAsFile();
      break;
    }
  }
  if (!pastedImageFile) return; // a text paste must behave normally
  pasteEvent.preventDefault();
  readLocalFileAsDataUrl(pastedImageFile, function(readError, pastedDataUrl) {
    if (readError || !pastedDataUrl) {
      tool.notify('Could not read the pasted image: ' + (readError || 'empty clipboard data'), 'error');
      return;
    }
    var pastedImage = new Image();
    pastedImage.onload = function() { addPastedStudioScreenshot(pastedDataUrl, pastedImage.width, pastedImage.height); };
    pastedImage.onerror = function() { addPastedStudioScreenshot(pastedDataUrl, 0, 0); };
    pastedImage.src = pastedDataUrl;
  });
}

function addPastedStudioScreenshot(screenshotDataUrl, screenshotWidth, screenshotHeight) {
  var screenshotNumber = 1;
  for (var imageIndex = 0; imageIndex < editingStudyDocImages.length; imageIndex++) {
    if (String(editingStudyDocImages[imageIndex].name || '').indexOf('page-screenshot-') === 0) screenshotNumber++;
  }
  editingStudyDocImages.push({
    id: genId(),
    name: 'page-screenshot-' + screenshotNumber + '.png',
    width: screenshotWidth || 0,
    height: screenshotHeight || 0,
    dataUrl: screenshotDataUrl,
    sizeKb: Math.max(1, Math.round(screenshotDataUrl.length * 0.75 / 1024)),
    role: 'real'
  });
  var newImageIndex = editingStudyDocImages.length - 1;
  persistStudioImages();
  renderStudyDocImageGallery();
  renderPdfEditorList();
  setStudioStatus('🖼 Added the pasted screenshot to this document\'s images.', 'ok');
  uploadStudioImageToStorage(newImageIndex, function(uploaded) {
    if (uploaded) autoSaveCurrentLesson();
  });
}

/** Role of a document URL: 'final' (Ready - students see it), 'source' (Sample) or '' (unknown) */
function studioDocRole(docUrl) {
  if (isSourceDocumentUrl(docUrl)) return 'source';
  return studioDocType(docUrl) ? 'final' : '';
}

/** Write the working image array back to the per-document map */
function persistStudioImages() {
  if (!studioCurrentDocUrl) return;
  if (editingStudyDocImages.length) {
    editingStudyDocImagesMap[studioCurrentDocUrl] = JSON.parse(JSON.stringify(editingStudyDocImages));
  } else {
    delete editingStudyDocImagesMap[studioCurrentDocUrl];
  }
}

function studioDocImageCount(docUrl) {
  var images = editingStudyDocImagesMap[docUrl];
  return images ? images.length : 0;
}

/** Document type of a URL across Real lists and Source entries ('' when unknown) */
function studioDocType(docUrl) {
  var typeKeys = ['presentation', 'studyDoc', 'worksheet', 'answerKey', 'htmlDoc'];
  for (var t = 0; t < typeKeys.length; t++) {
    if (getPdfArray(typeKeys[t]).indexOf(docUrl) !== -1) return typeKeys[t];
  }
  for (var s = 0; s < editingStudyDocSources.length; s++) {
    if (editingStudyDocSources[s].url === docUrl) return editingStudyDocSources[s].type || 'studyDoc';
  }
  return '';
}

/* ── PDF preview rendering (CMS-hosted PDF.js, html-tool-rules v3.1) ──
   Chrome refuses to run its built-in PDF viewer inside sandboxed frames, so a
   PDF cannot be embedded directly. When the field enables allowPdfRender the
   CMS injects pdfjs-dist@3.11.174 before this script and wires the worker
   (GlobalWorkerOptions.workerSrc) itself - the tool never overrides it. */
var STUDIO_PDF_PREVIEW_MAX_PAGES = 12;
var STUDIO_PDF_PREVIEW_MIN_SCALE = 0.5;
var STUDIO_PDF_PREVIEW_MAX_SCALE = 3;
/** Why the last page preview could not be rendered (console + diagnostics) */
var lastPdfPreviewFailure = '';
var pdfPreviewRetryTimer = null;
var pdfPreviewRetryAttempts = 0;
var pdfPreviewRetryDocUrl = '';
var pdfDiagnosticsLoggedForUrl = '';

/** First bytes of a PDF as text - shows at a glance whether it is really a PDF */
function describePdfBytesForConsole(pdfBytes) {
  if (!pdfBytes || !pdfBytes.length) return '(empty)';
  var headerText = '';
  for (var byteIndex = 0; byteIndex < Math.min(8, pdfBytes.length); byteIndex++) {
    headerText += String.fromCharCode(pdfBytes[byteIndex]);
  }
  return headerText.replace(/[^\x20-\x7e]/g, '.');
}

/** Global names that look like a PDF library (in case the CMS injects another name) */
function listPdfLikeGlobals() {
  var globalNames = [];
  try {
    for (var globalName in window) {
      if (/pdf/i.test(globalName)) globalNames.push(globalName);
    }
  } catch (globalError) { /* ignore */ }
  return globalNames.slice(0, 20).join(', ') || '(none)';
}

/** Read one SDK param without letting a broken SDK break the diagnostics */
function readParamForDiagnostics(paramName) {
  try { return tool.param(paramName, '(not exposed)'); }
  catch (paramError) { return 'threw: ' + paramError.message; }
}

/** Everything needed to explain a missing page preview */
function collectPdfPreviewDiagnostics() {
  var pdfLibrary = (typeof window !== 'undefined') ? window.pdfjsLib : null;
  return {
    build: TOOL_BUILD,
    pdfjsLibPresent: !!pdfLibrary,
    pdfjsVersion: pdfLibrary ? (pdfLibrary.version || '(unknown)') : '',
    pdfjsWorkerWired: pdfJsWorkerDescription(),
    pdfjsWorkerSrcConfigured: (pdfLibrary && pdfLibrary.GlobalWorkerOptions) ? String(pdfLibrary.GlobalWorkerOptions.workerSrc || '(not set)') : '',
    pdfPreviewScaleParam: readParamForDiagnostics('pdfPreviewScale'),
    allowPdfRenderProbe: readParamForDiagnostics('allowPdfRender'),
    allowFileFetchProbe: readParamForDiagnostics('allowFileFetch'),
    requestFileBinary: (typeof tool.requestFileBinary === 'function') ? 'function' : 'MISSING',
    pdfLikeGlobals: listPdfLikeGlobals(),
    fieldSettings: (function () {
      try { return (typeof tool.getFields === 'function') ? summarizeObjectForDiagnostics(tool.getFields(), 3) : '(getFields not available)'; }
      catch (fieldsError) { return 'threw: ' + fieldsError.message; }
    })(),
    lastPreviewFailure: lastPdfPreviewFailure || '(none recorded)',
    documentUrl: studioCurrentDocUrl || '(none open)',
    documentType: studioCurrentDocUrl ? studioDocType(studioCurrentDocUrl) : '(none open)'
  };
}

/** Print a copyable console block explaining the preview state */
function logPdfPreviewDiagnostics(stageLabel) {
  try {
    console.log('===== CURRICULUM BUILDER - PDF PREVIEW DIAGNOSTICS =====');
    console.log('stage: ' + stageLabel);
    console.log(JSON.stringify(collectPdfPreviewDiagnostics(), null, 2));
    console.log('===== END PDF PREVIEW DIAGNOSTICS =====');
  } catch (diagnosticsError) {
    console.warn('[STUDIO:PREVIEW] diagnostics could not be printed:', diagnosticsError);
  }
}

/** Re-check for PDF.js a few times - the CMS may inject it after the tool */
function schedulePdfPreviewRetry() {
  if (pdfPreviewRetryTimer) return;
  if (pdfPreviewRetryDocUrl !== studioCurrentDocUrl) {
    pdfPreviewRetryDocUrl = studioCurrentDocUrl;
    pdfPreviewRetryAttempts = 0;
  }
  if (pdfPreviewRetryAttempts >= 5) return;
  pdfPreviewRetryAttempts++;
  pdfPreviewRetryTimer = setTimeout(function() {
    pdfPreviewRetryTimer = null;
    if (!studioCurrentDocUrl) return;
    if (pdfJsLibraryAvailable()) {
      console.warn('[STUDIO:PREVIEW] PDF.js appeared after the preview opened - rendering now');
      loadStudioDocumentPreview();
      return;
    }
    schedulePdfPreviewRetry();
  }, 1500);
}

function pdfJsLibraryAvailable() {
  return (typeof window !== 'undefined') && !!window.pdfjsLib && (typeof window.pdfjsLib.getDocument === 'function');
}

/** The PDF.js worker is wired by the CMS - report it instead of overriding it */
function pdfJsWorkerDescription() {
  try {
    var workerOptions = (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) ? window.pdfjsLib.GlobalWorkerOptions : null;
    return (workerOptions && workerOptions.workerSrc) ? String(workerOptions.workerSrc) : '(not set by the CMS)';
  } catch (workerError) {
    return '(unavailable)';
  }
}

/** User-facing placeholder - technical reasons go to the console only */
function showStudioPdfPreviewPlaceholder(previewFrame, noteEl, localPdfAvailable, diagnosticReason, userFacingHint) {
  lastPdfPreviewFailure = diagnosticReason || '';
  if (diagnosticReason) console.warn('[STUDIO:PREVIEW] page preview unavailable - ' + diagnosticReason);
  logPdfPreviewDiagnostics('placeholder shown');
  previewFrame.src = 'about:blank';
  var hintLine = userFacingHint
    ? '<div style="margin-top:6px;font-size:12px">' + esc(userFacingHint) + '</div>'
    : '';
  previewFrame.srcdoc = '<style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#475569;display:flex;align-items:center;justify-content:center;height:100%;padding:24px;text-align:center;font-size:13px;line-height:1.7}strong{color:#1e293b}</style>' +
    '<div><div style="font-size:30px;margin-bottom:6px">📄</div>' +
    '<div><strong>Page preview is not available for this document</strong></div>' +
    '<div style="margin-top:4px">Use <strong>⬇ Download File</strong> or <strong>👁 Open File</strong> to view it.</div>' +
    hintLine + '</div>';
  if (noteEl) noteEl.textContent = localPdfAvailable ? 'Local PDF loaded - use Download File to save it.' : '';
}

/** Put the already-rasterized pages into the preview frame */
function showStudioRenderedPdfPages(previewFrame, pageImages, totalPages) {
  lastPdfPreviewFailure = '';
  pdfPreviewRetryAttempts = 0;
  var pagesHtml = pageImages.map(function (pageImage, pageIndex) {
    return '<div class="pdf-page"><img src="' + pageImage + '" alt="Page ' + (pageIndex + 1) + '"></div>';
  }).join('');
  previewFrame.srcdoc = '<style>body{margin:0;background:#e2e8f0;padding:12px;display:flex;flex-direction:column;gap:12px;align-items:center;font-family:system-ui,sans-serif}.pdf-page{background:#fff;box-shadow:0 2px 10px rgba(15,23,42,.18);max-width:100%}.pdf-page img{display:block;width:100%;height:auto}.pdf-count{font-size:12px;color:#475569}</style>' +
    '<div class="pdf-count">' + pageImages.length + ' of ' + totalPages + ' page(s) rendered</div>' + pagesHtml;
}

/** Rasterize the PDF with PDF.js and stream the pages into the preview */
function renderPdfPreviewPages(pdfBytes, previewFrame, noteEl) {
  var pdfLibrary = window.pdfjsLib;
  if (!pdfLibrary) {
    showStudioPdfPreviewPlaceholder(previewFrame, noteEl, false,
      'window.pdfjsLib is missing (allowPdfRender is off or PDF.js was not injected)',
      'PDF page preview is switched off for this tool.');
    schedulePdfPreviewRetry();
    return;
  }
  var previewScale = parseFloat(tool.param('pdfPreviewScale', '1.2'));
  if (!previewScale || isNaN(previewScale)) previewScale = 1.2;
  previewScale = Math.max(STUDIO_PDF_PREVIEW_MIN_SCALE, Math.min(STUDIO_PDF_PREVIEW_MAX_SCALE, previewScale));
  console.log('[STUDIO:PREVIEW] PDF.js ' + (pdfLibrary.version || '(unknown version)') +
    ' · scale ' + previewScale + ' · worker: ' + pdfJsWorkerDescription());
  var loadingTask;
  try {
    // PDF.js detaches the buffer it receives - pass a copy so the bytes stay
    // usable for image extraction.
    loadingTask = pdfLibrary.getDocument({ data: new Uint8Array(pdfBytes) });
  } catch (pdfStartError) {
    showStudioPdfPreviewPlaceholder(previewFrame, noteEl, false,
      'getDocument threw: ' + (pdfStartError && pdfStartError.message),
      'The PDF could not be opened for preview.');
    return;
  }
  loadingTask.promise.then(function (pdfDocument) {
    console.log('[STUDIO:PREVIEW] PDF opened · ' + pdfDocument.numPages + ' page(s) · scale ' + previewScale);
    var pagesToRender = Math.min(pdfDocument.numPages, STUDIO_PDF_PREVIEW_MAX_PAGES);
    var pageImages = [];
    function renderNextPage(pageNumber) {
      if (pageNumber > pagesToRender) {
        if (!pageImages.length) {
          showStudioPdfPreviewPlaceholder(previewFrame, noteEl, false,
            'every page failed to render - see the per-page errors above',
            'The PDF could not be opened for preview.');
          return;
        }
        if (noteEl) {
          noteEl.textContent = pagesToRender < pdfDocument.numPages
            ? 'PDF preview · first ' + pagesToRender + ' of ' + pdfDocument.numPages + ' pages'
            : 'PDF preview · ' + pdfDocument.numPages + ' page(s)';
        }
        return;
      }
      pdfDocument.getPage(pageNumber).then(function (pdfPage) {
        var pageViewport = pdfPage.getViewport({ scale: previewScale });
        var pageCanvas = document.createElement('canvas');
        pageCanvas.width = Math.max(1, Math.floor(pageViewport.width));
        pageCanvas.height = Math.max(1, Math.floor(pageViewport.height));
        pdfPage.render({ canvasContext: pageCanvas.getContext('2d'), viewport: pageViewport }).promise.then(function () {
          pageImages.push(pageCanvas.toDataURL('image/jpeg', 0.82));
          showStudioRenderedPdfPages(previewFrame, pageImages, pdfDocument.numPages);
          if (noteEl) noteEl.textContent = 'Rendering page ' + (pageNumber + 1) + ' of ' + pagesToRender + '…';
          renderNextPage(pageNumber + 1);
        }).catch(function (pageRenderError) {
          console.warn('[STUDIO:PREVIEW] page ' + pageNumber + ' could not be rendered:', pageRenderError);
          renderNextPage(pageNumber + 1);
        });
      }).catch(function (pageLoadError) {
        console.warn('[STUDIO:PREVIEW] page ' + pageNumber + ' could not be loaded:', pageLoadError);
        renderNextPage(pageNumber + 1);
      });
    }
    renderNextPage(1);
  }).catch(function (pdfPreviewError) {
    showStudioPdfPreviewPlaceholder(previewFrame, noteEl, false,
      'the renderer could not open the document: ' + (pdfPreviewError && pdfPreviewError.message),
      'The PDF could not be opened for preview.');
  });
}

/** Preview the open document inside the studio drawer (HTML inline, PDF as a blob) */
function loadStudioDocumentPreview() {
  var previewFrame = el('sd-doc-preview');
  var noteEl = el('sd-preview-note');
  if (!previewFrame) return;
  if (!studioCurrentDocUrl) {
    previewFrame.src = 'about:blank';
    if (noteEl) noteEl.textContent = '';
    return;
  }
  var docType = studioDocType(studioCurrentDocUrl);
  var lowerUrl = studioCurrentDocUrl.toLowerCase();
  var isHtmlDocument = docType === 'htmlDoc' || /\.(html?|htm)(\?|#|$)/.test(lowerUrl);
  if (isHtmlDocument) {
    if (!binaryFileChannelAvailable()) {
      console.warn('[STUDIO:PREVIEW] inline HTML preview needs tool.requestFileBinary (allowFileFetch: yes)');
      previewFrame.srcdoc = '';
      if (noteEl) noteEl.textContent = 'Preview is unavailable here - use "Open File".';
      return;
    }
    if (noteEl) noteEl.textContent = 'Loading…';
    fetchDocumentBytes(studioCurrentDocUrl, { purpose: 'preview' }, function(fetchError, documentBytes, documentMeta) {
      if (fetchError || !documentBytes || !documentBytes.length) {
        console.warn('[STUDIO:PREVIEW] inline HTML preview failed - ' + describeFileFetchFailureForConsole(fetchError, documentMeta));
        previewFrame.srcdoc = '';
        if (noteEl) noteEl.textContent = 'The document could not be loaded here - use "Open File" or try again.';
        return;
      }
      previewFrame.srcdoc = decodeTextBytes(documentBytes);
      if (noteEl) noteEl.textContent = 'HTML preview';
    });
    return;
  }
  // PDF: Chrome blocks its built-in PDF viewer inside sandboxed CMS tool
  // frames, so the page must be rasterized. PDF.js is used when the CMS
  // injects it; otherwise a clear placeholder is shown.
  if (pdfJsLibraryAvailable()) {
    if (noteEl) noteEl.textContent = 'Rendering the PDF preview…';
    if (pdfDiagnosticsLoggedForUrl !== studioCurrentDocUrl) {
      pdfDiagnosticsLoggedForUrl = studioCurrentDocUrl;
      logPdfPreviewDiagnostics('preview open');
    }
    console.log('[STUDIO:PREVIEW] open · ' + studioCurrentDocUrl + ' · pdfjs ' +
      (window.pdfjsLib.version || '(unknown version)') + ' · requestFileBinary ' +
      (typeof tool.requestFileBinary === 'function' ? 'available' : 'MISSING'));
    var localPdfBytes = (studioLocalPdfBytes && studioLocalPdfUrl === studioCurrentDocUrl) ? studioLocalPdfBytes : null;
    if (localPdfBytes) {
      console.log('[STUDIO:PREVIEW] using local bytes · ' + localPdfBytes.length + ' byte(s) · header ' + describePdfBytesForConsole(localPdfBytes));
      renderPdfPreviewPages(localPdfBytes, previewFrame, noteEl);
      return;
    }
    fetchDocumentBytes(studioCurrentDocUrl, { purpose: 'preview' }, function(previewFetchError, previewBytes, previewMeta) {
      if (previewFetchError || !previewBytes || !previewBytes.length) {
        showStudioPdfPreviewPlaceholder(previewFrame, noteEl, false,
          describeFileFetchFailureForConsole(previewFetchError, previewMeta),
          'The document could not be downloaded for preview.');
        return;
      }
      console.log('[STUDIO:PREVIEW] bytes received · ' + previewBytes.length + ' byte(s) · type ' +
        ((previewMeta && previewMeta.contentType) || '?') + ' · header ' + describePdfBytesForConsole(previewBytes));
      renderPdfPreviewPages(previewBytes, previewFrame, noteEl);
    });
    return;
  }
  showStudioPdfPreviewPlaceholder(previewFrame, noteEl, !!(studioLocalPdfBlobUrl && studioLocalPdfUrl === studioCurrentDocUrl),
    'window.pdfjsLib is missing - enable settings.allowPdfRender = yes for this field',
    'PDF page preview is switched off for this tool.');
  schedulePdfPreviewRetry();
}

/* ── Pictures from a PDF (smart capture through PDF.js) ──   A scanned page is one big picture, so the whole page is the right image. A
   vector page is only ink: drawings and illustrations are the ink regions that
   are NOT text lines. The page is rendered, ink cells are grouped into
   connected regions, regions dominated by text are dropped and the rest are
   cropped as JPEGs. No PDF internals are needed, so it works for every
   producer (Illustrator, Word, LaTeX, scans). */

/** Text item boxes of one page, in rendered-canvas pixels */
function pdfTextItemBoxes(textContent, pageViewport) {
  var textBoxes = [];
  var textItems = (textContent && textContent.items) || [];
  for (var itemIndex = 0; itemIndex < textItems.length; itemIndex++) {
    var textItem = textItems[itemIndex];
    if (!textItem || !textItem.transform || !textItem.width) continue;
    var transformedMatrix;
    try { transformedMatrix = window.pdfjsLib.Util.transform(pageViewport.transform, textItem.transform); }
    catch (transformError) { continue; }
    var fontHeight = Math.hypot(transformedMatrix[2], transformedMatrix[3]) || 10;
    var textLeft = transformedMatrix[4];
    var textBaseline = transformedMatrix[5];
    var textWidth = (textItem.width || 0) * pageViewport.scale;
    textBoxes.push({
      left: textLeft,
      top: textBaseline - fontHeight,
      right: textLeft + textWidth,
      bottom: textBaseline + fontHeight * 0.35
    });
  }
  return textBoxes;
}

/** Merge boxes that overlap or are within gapPixels of each other */
function mergeOverlappingPictureBoxes(pictureBoxes, gapPixels) {
  var mergedBoxes = [];
  for (var boxIndex = 0; boxIndex < pictureBoxes.length; boxIndex++) {
    var currentBox = {
      left: pictureBoxes[boxIndex].left,
      top: pictureBoxes[boxIndex].top,
      right: pictureBoxes[boxIndex].right,
      bottom: pictureBoxes[boxIndex].bottom
    };
    var mergedSomething = true;
    while (mergedSomething) {
      mergedSomething = false;
      for (var otherIndex = mergedBoxes.length - 1; otherIndex >= 0; otherIndex--) {
        var otherBox = mergedBoxes[otherIndex];
        var boxesTouch = !(currentBox.right + gapPixels < otherBox.left || otherBox.right + gapPixels < currentBox.left ||
          currentBox.bottom + gapPixels < otherBox.top || otherBox.bottom + gapPixels < currentBox.top);
        if (!boxesTouch) continue;
        currentBox.left = Math.min(currentBox.left, otherBox.left);
        currentBox.top = Math.min(currentBox.top, otherBox.top);
        currentBox.right = Math.max(currentBox.right, otherBox.right);
        currentBox.bottom = Math.max(currentBox.bottom, otherBox.bottom);
        mergedBoxes.splice(otherIndex, 1);
        mergedSomething = true;
      }
    }
    mergedBoxes.push(currentBox);
  }
  return mergedBoxes;
}

/** Ink regions of one rendered page that are not text (the pictures) */
function detectPagePictureRegions(pageCanvas, textBoxes) {
  var pageWidth = pageCanvas.width;
  var pageHeight = pageCanvas.height;
  if (!pageWidth || !pageHeight) return [];
  var cellSize = 24;
  var columnCount = Math.ceil(pageWidth / cellSize);
  var rowCount = Math.ceil(pageHeight / cellSize);
  var pagePixels;
  try { pagePixels = pageCanvas.getContext('2d').getImageData(0, 0, pageWidth, pageHeight).data; }
  catch (pixelError) {
    console.warn('[STUDIO:PICTURES] page pixels could not be read:', pixelError);
    return [];
  }
  var inkCells = new Uint8Array(columnCount * rowCount);
  var sampledStep = 3;
  for (var pixelY = 0; pixelY < pageHeight; pixelY += sampledStep) {
    var rowOffset = pixelY * pageWidth * 4;
    for (var pixelX = 0; pixelX < pageWidth; pixelX += sampledStep) {
      var pixelOffset = rowOffset + pixelX * 4;
      if (pagePixels[pixelOffset + 3] < 16) continue;
      if (pagePixels[pixelOffset] > 245 && pagePixels[pixelOffset + 1] > 245 && pagePixels[pixelOffset + 2] > 245) continue;
      inkCells[Math.floor(pixelY / cellSize) * columnCount + Math.floor(pixelX / cellSize)] = 1;
    }
  }
  var textCells = new Uint8Array(columnCount * rowCount);
  for (var boxIndex = 0; boxIndex < textBoxes.length; boxIndex++) {
    var textBox = textBoxes[boxIndex];
    var firstColumn = Math.max(0, Math.floor(textBox.left / cellSize));
    var lastColumn = Math.min(columnCount - 1, Math.floor(textBox.right / cellSize));
    var firstRow = Math.max(0, Math.floor(textBox.top / cellSize));
    var lastRow = Math.min(rowCount - 1, Math.floor(textBox.bottom / cellSize));
    for (var textRow = firstRow; textRow <= lastRow; textRow++) {
      for (var textColumn = firstColumn; textColumn <= lastColumn; textColumn++) textCells[textRow * columnCount + textColumn] = 1;
    }
  }
  // Connected components over the ink cells.
  var visitedCells = new Uint8Array(columnCount * rowCount);
  var inkComponents = [];
  for (var startRow = 0; startRow < rowCount; startRow++) {
    for (var startColumn = 0; startColumn < columnCount; startColumn++) {
      var startIndex = startRow * columnCount + startColumn;
      if (!inkCells[startIndex] || visitedCells[startIndex]) continue;
      var pendingCells = [startIndex];
      visitedCells[startIndex] = 1;
      var inkComponent = {
        minColumn: startColumn, maxColumn: startColumn, minRow: startRow, maxRow: startRow,
        cellCount: 0, textCellCount: 0
      };
      while (pendingCells.length) {
        var cellIndex = pendingCells.pop();
        var cellRow = Math.floor(cellIndex / columnCount);
        var cellColumn = cellIndex % columnCount;
        inkComponent.cellCount++;
        if (textCells[cellIndex]) inkComponent.textCellCount++;
        if (cellColumn < inkComponent.minColumn) inkComponent.minColumn = cellColumn;
        if (cellColumn > inkComponent.maxColumn) inkComponent.maxColumn = cellColumn;
        if (cellRow < inkComponent.minRow) inkComponent.minRow = cellRow;
        if (cellRow > inkComponent.maxRow) inkComponent.maxRow = cellRow;
        var neighbourCells = [
          cellColumn > 0 ? cellIndex - 1 : -1,
          cellColumn < columnCount - 1 ? cellIndex + 1 : -1,
          cellRow > 0 ? cellIndex - columnCount : -1,
          cellRow < rowCount - 1 ? cellIndex + columnCount : -1
        ];
        for (var neighbourIndex = 0; neighbourIndex < neighbourCells.length; neighbourIndex++) {
          var neighbourCell = neighbourCells[neighbourIndex];
          if (neighbourCell < 0 || visitedCells[neighbourCell] || !inkCells[neighbourCell]) continue;
          visitedCells[neighbourCell] = 1;
          pendingCells.push(neighbourCell);
        }
      }
      inkComponents.push(inkComponent);
    }
  }
  // Keep picture-like components: big enough and not dominated by text.
  var pageArea = pageWidth * pageHeight;
  var pictureBoxes = [];
  for (var componentIndex = 0; componentIndex < inkComponents.length; componentIndex++) {
    var candidate = inkComponents[componentIndex];
    var boxLeft = candidate.minColumn * cellSize;
    var boxTop = candidate.minRow * cellSize;
    var boxRight = Math.min(pageWidth, (candidate.maxColumn + 1) * cellSize);
    var boxBottom = Math.min(pageHeight, (candidate.maxRow + 1) * cellSize);
    var boxWidth = boxRight - boxLeft;
    var boxHeight = boxBottom - boxTop;
    if (boxWidth < 120 || boxHeight < 120) continue;
    if (boxWidth * boxHeight < pageArea * 0.01) continue;
    var textShare = candidate.cellCount ? (candidate.textCellCount / candidate.cellCount) : 0;
    if (textShare > 0.45) continue;
    pictureBoxes.push({ left: boxLeft, top: boxTop, right: boxRight, bottom: boxBottom });
  }
  // One region covering almost the whole page = a scanned page.
  for (var pageBoxIndex = 0; pageBoxIndex < pictureBoxes.length; pageBoxIndex++) {
    var pageBox = pictureBoxes[pageBoxIndex];
    if ((pageBox.right - pageBox.left) * (pageBox.bottom - pageBox.top) > pageArea * 0.85) {
      return [{ left: 0, top: 0, width: pageWidth, height: pageHeight }];
    }
  }
  var mergedBoxes = mergeOverlappingPictureBoxes(pictureBoxes, 30);
  var pictureRegions = [];
  for (var mergedIndex = 0; mergedIndex < mergedBoxes.length; mergedIndex++) {
    var mergedBox = mergedBoxes[mergedIndex];
    var padding = 10;
    var regionLeft = Math.max(0, Math.floor(mergedBox.left - padding));
    var regionTop = Math.max(0, Math.floor(mergedBox.top - padding));
    var regionRight = Math.min(pageWidth, Math.ceil(mergedBox.right + padding));
    var regionBottom = Math.min(pageHeight, Math.ceil(mergedBox.bottom + padding));
    pictureRegions.push({
      left: regionLeft, top: regionTop,
      width: Math.max(1, regionRight - regionLeft),
      height: Math.max(1, regionBottom - regionTop)
    });
  }
  return pictureRegions;
}

/** Capture the pictures of the open document.
 *  Embedded raster images are used as they are (original quality). When the
 *  document has none (vector artwork), the drawing regions are cropped from
 *  the rendered pages instead. One button, automatic decision. */
function captureDocumentPictures(onDone) {
  var sourceUrl = studioCurrentDocUrl;
  if (!sourceUrl) {
    tool.notify('Open a document in the Studio drawer first.', 'warning');
    if (onDone) onDone();
    return;
  }
  var picturesBefore = editingStudyDocImages.length;
  function runWithBytes(pdfBytes) {
    var candidates = [];
    try { candidates = findPdfImageStreams(pdfBytes); } catch (scanError) { candidates = []; }
    if (!candidates.length) {
      console.log('[STUDIO:PICTURES] no raster image objects - capturing the drawings from the pages');
      importPdfIllustrations(pdfBytes, onDone);
      return;
    }
    decodeAndStorePdfImages(candidates, function() {
      if (editingStudyDocImages.length === picturesBefore) {
        console.log('[STUDIO:PICTURES] no embedded image could be decoded - capturing the drawings from the pages');
        importPdfIllustrations(pdfBytes, onDone);
        return;
      }
      if (onDone) onDone();
    });
  }
  if (studioLocalPdfBytes && studioLocalPdfUrl === sourceUrl) { runWithBytes(studioLocalPdfBytes); return; }
  if (!binaryFileChannelAvailable()) {
    console.warn('[STUDIO:DOWNLOAD] picture capture needs tool.requestFileBinary (allowFileFetch: yes)');
    tool.notify('File downloads are switched off for this tool. Use "📁 Local PDF" instead.', 'warning');
    if (onDone) onDone();
    return;
  }
  var captureProgress = { loadedBytes: 0, totalBytes: 0 };
  startStudioStatusTicker('⏳ Downloading the document to capture its pictures', function() {
    if (!captureProgress.loadedBytes) return '';
    return formatFileSize(captureProgress.loadedBytes) + (captureProgress.totalBytes ? ' of ' + formatFileSize(captureProgress.totalBytes) : '');
  });
  fetchDocumentBytes(sourceUrl, {
    purpose: 'pictures',
    onProgress: function(loadedBytes, totalBytes) {
      captureProgress.loadedBytes = loadedBytes || 0;
      captureProgress.totalBytes = totalBytes || 0;
    }
  }, function(fetchError, documentBytes, documentMeta) {
    if (fetchError || !documentBytes || !documentBytes.length) {
      console.warn('[STUDIO:PICTURES] download failed - ' + describeFileFetchFailureForConsole(fetchError, documentMeta));
      setStudioStatus('❌ ' + describeFileFetchError(fetchError, documentMeta), 'warn');
      if (onDone) onDone();
      return;
    }
    runWithBytes(documentBytes);
  });
}

function importPdfIllustrations(pdfBytes, onDone) {
  if (!pdfJsLibraryAvailable()) {
    tool.notify('PDF page rendering is not enabled for this tool (allowPdfRender).', 'warning');
    return;
  }
  var sourceUrl = studioCurrentDocUrl;
  if (!sourceUrl) { tool.notify('Open a document in the Studio drawer first.', 'warning'); return; }
  var pageScale = parseFloat(tool.param('pdfPageImageScale', '2'));
  if (!pageScale || isNaN(pageScale)) pageScale = 2;
  pageScale = Math.max(1, Math.min(3, pageScale));
  var maxPages = parseInt(tool.param('pdfPageImageMaxPages', '20'), 10);
  if (!maxPages || maxPages < 1) maxPages = 20;

  function addRenderedPagesToGallery(renderedPageImages, renderedCount, totalPages) {
    if (!renderedPageImages.length) {
      setStudioStatus('❌ None of the pages could be rendered.', 'warn');
      if (onDone) onDone();
      return;
    }
    var knownImageKeys = {};
    for (var existingIndex = 0; existingIndex < editingStudyDocImages.length; existingIndex++) {
      var existingKeys = studioImageMatchKeys(editingStudyDocImages[existingIndex]);
      for (var existingKeyIndex = 0; existingKeyIndex < existingKeys.length; existingKeyIndex++) knownImageKeys[existingKeys[existingKeyIndex]] = true;
    }
    var addedImageCount = 0;
    var duplicateImageCount = 0;
    for (var pageImageIndex = 0; pageImageIndex < renderedPageImages.length; pageImageIndex++) {
      var pageImage = renderedPageImages[pageImageIndex];
      var pageImageKeys = studioImageMatchKeys(pageImage);
      var alreadyKnown = false;
      for (var pageKeyIndex = 0; pageKeyIndex < pageImageKeys.length; pageKeyIndex++) {
        if (knownImageKeys[pageImageKeys[pageKeyIndex]]) alreadyKnown = true;
      }
      if (alreadyKnown) { duplicateImageCount++; continue; }
      for (var newKeyIndex = 0; newKeyIndex < pageImageKeys.length; newKeyIndex++) knownImageKeys[pageImageKeys[newKeyIndex]] = true;
      editingStudyDocImages.push(pageImage);
      addedImageCount++;
    }
    persistStudioImages();
    renderStudyDocImageGallery();
    renderPdfEditorList();
    if (!addedImageCount) {
      setStudioStatus('ℹ️ All ' + renderedPageImages.length + ' picture(s) are already in this document\'s list - nothing was added.', 'ok');
      if (onDone) onDone();
      return;
    }
    var status = '✅ Added ' + addedImageCount + ' picture(s).';
    if (duplicateImageCount) status += ' ' + duplicateImageCount + ' already in the list.';
    if (renderedCount < totalPages) status += ' First ' + renderedCount + ' of ' + totalPages + ' pages only (page limit).';
    setStudioStatus(status, 'ok');
    tool.notify(status, 'success');
    uploadUnhostedStudioImages(function(uploadedCount) {
      if (uploadedCount > 0) { persistStudioImages(); renderStudyDocImageGallery(); }
    });
    if (onDone) onDone();
  }

  function renderPagesToGallery(pdfBytes) {
    setStudioStatus('🖼 Looking for pictures on each page…', 'busy');
    window.pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise.then(function(pdfDocument) {
      var pagesToInspect = Math.min(pdfDocument.numPages, maxPages);
      var collectedPictures = [];
      function inspectNextPage(pageNumber) {
        if (pageNumber > pagesToInspect) { addRenderedPagesToGallery(collectedPictures, pagesToInspect, pdfDocument.numPages); return; }
        startStudioStatusTicker('🖼 Page ' + pageNumber + ' of ' + pagesToInspect + ' - finding pictures');
        inspectPage(pdfDocument, pageNumber, collectedPictures, function() { inspectNextPage(pageNumber + 1); });
      }
      inspectNextPage(1);
    }).catch(function(openError) {
      setStudioStatus('❌ The PDF could not be opened for pictures: ' + ((openError && openError.message) || openError), 'warn');
    });
  }

  function inspectPage(pdfDocument, pageNumber, collectedPictures, onPageDone) {
    pdfDocument.getPage(pageNumber).then(function(pdfPage) {
      var pageViewport = pdfPage.getViewport({ scale: pageScale });
      var pageCanvas = document.createElement('canvas');
      pageCanvas.width = Math.max(1, Math.floor(pageViewport.width));
      pageCanvas.height = Math.max(1, Math.floor(pageViewport.height));
      pdfPage.render({ canvasContext: pageCanvas.getContext('2d'), viewport: pageViewport }).promise.then(function() {
        pdfPage.getTextContent().then(function(textContent) {
          var textBoxes = pdfTextItemBoxes(textContent, pageViewport);
          var pictureRegions = detectPagePictureRegions(pageCanvas, textBoxes);
          if (!pictureRegions.length) {
            // Text-only or blank page: keep the page itself so nothing is lost.
            cropPictureRegion(pageCanvas, { left: 0, top: 0, width: pageCanvas.width, height: pageCanvas.height },
              'page-' + pageNumber + '.jpg', collectedPictures, onPageDone);
            return;
          }
          var regionIndex = 0;
          function cropNextRegion() {
            if (regionIndex >= pictureRegions.length) { onPageDone(); return; }
            var pictureRegion = pictureRegions[regionIndex];
            regionIndex++;
            cropPictureRegion(pageCanvas, pictureRegion, 'page-' + pageNumber + '-' + regionIndex + '.jpg', collectedPictures, cropNextRegion);
          }
          cropNextRegion();
        }).catch(function(textError) {
          console.warn('[STUDIO:PICTURES] page ' + pageNumber + ' text boxes could not be read:', textError);
          cropPictureRegion(pageCanvas, { left: 0, top: 0, width: pageCanvas.width, height: pageCanvas.height },
            'page-' + pageNumber + '.jpg', collectedPictures, onPageDone);
        });
      }).catch(function(renderError) {
        console.warn('[STUDIO:PICTURES] page ' + pageNumber + ' could not be rendered:', renderError);
        onPageDone();
      });
    }).catch(function(pageError) {
      console.warn('[STUDIO:PICTURES] page ' + pageNumber + ' could not be opened:', pageError);
      onPageDone();
    });
  }

  function cropPictureRegion(pageCanvas, pictureRegion, pictureName, collectedPictures, onCropped) {
    try {
      var cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.max(1, Math.floor(pictureRegion.width));
      cropCanvas.height = Math.max(1, Math.floor(pictureRegion.height));
      cropCanvas.getContext('2d').drawImage(pageCanvas, pictureRegion.left, pictureRegion.top, pictureRegion.width, pictureRegion.height, 0, 0, pictureRegion.width, pictureRegion.height);
      canvasToStudioImage(cropCanvas, pictureName, function(encodeError, pictureImage) {
        if (encodeError || !pictureImage) console.warn('[STUDIO:PICTURES] ' + pictureName + ' could not be encoded:', encodeError);
        else collectedPictures.push(pictureImage);
        onCropped();
      });
    } catch (cropError) {
      console.warn('[STUDIO:PICTURES] ' + pictureName + ' could not be cropped:', cropError);
      onCropped();
    }
  }

  if (pdfBytes && pdfBytes.length) { renderPagesToGallery(pdfBytes); return; }
  if (studioLocalPdfBytes && studioLocalPdfUrl === sourceUrl) { renderPagesToGallery(studioLocalPdfBytes); return; }
  setStudioStatus('⏳ Downloading the document for page images…', 'busy');
  fetchDocumentBytes(sourceUrl, { purpose: 'page-images' }, function(fetchError, documentBytes, documentMeta) {
    if (fetchError || !documentBytes || !documentBytes.length) {
      console.warn('[STUDIO:PAGES] download failed - ' + describeFileFetchFailureForConsole(fetchError, documentMeta));
      setStudioStatus('❌ ' + describeFileFetchError(fetchError, documentMeta), 'warn');
      return;
    }
    renderPagesToGallery(documentBytes);
  });
}

/* ── Client-side OCR (CMS-injected Tesseract.js) ──
   Same rule as PDF.js: the engine must be hosted and injected by the CMS
   (allowOcr). Nothing is fetched from a CDN and no network call is made here. */
function ocrEngineAvailable() {
  return (typeof window !== 'undefined') && !!window.Tesseract &&
    (typeof window.Tesseract.recognize === 'function' || typeof window.Tesseract.createWorker === 'function');
}

function describeOcrEngine() {
  if (!ocrEngineAvailable()) return 'Tesseract NOT injected';
  return 'Tesseract ' + (window.Tesseract.version || '(version unknown)') + ' injected';
}

/* Tesseract language files use ISO 639-2 codes (eng, tur, deu), not the
   2-letter codes most people type. Accept both and resolve to the file code. */
var OCR_LANGUAGE_ALIASES = {
  en: 'eng', tr: 'tur', de: 'deu', fr: 'fra', es: 'spa', it: 'ita', pt: 'por',
  nl: 'nld', ru: 'rus', ar: 'ara', hi: 'hin', ja: 'jpn', ko: 'kor',
  zh: 'chi_sim', 'zh-cn': 'chi_sim', 'zh-tw': 'chi_tra',
  pl: 'pol', sv: 'swe', da: 'dan', no: 'nor', fi: 'fin', el: 'ell', he: 'heb',
  fa: 'fas', ur: 'urd', az: 'aze', kk: 'kaz', uk: 'ukr', ro: 'ron', bg: 'bul',
  sr: 'srp', hr: 'hrv', sk: 'slk', sl: 'slv', cs: 'ces', hu: 'hun', id: 'ind',
  ms: 'msa', vi: 'vie', th: 'tha'
};

/** 'tr' -> 'tur', 'en+tur' -> 'eng+tur', unknown values pass through */
function resolveOcrLanguage(configuredLanguage) {
  var rawLanguage = String(configuredLanguage || '').trim();
  if (!rawLanguage) return 'eng';
  var languageParts = rawLanguage.split('+');
  var resolvedParts = [];
  for (var languageIndex = 0; languageIndex < languageParts.length; languageIndex++) {
    var languagePart = languageParts[languageIndex].trim().toLowerCase();
    if (!languagePart) continue;
    resolvedParts.push(OCR_LANGUAGE_ALIASES[languagePart] || languagePart);
  }
  return resolvedParts.length ? resolvedParts.join('+') : 'eng';
}

/** OCR language priority: drawer override > curriculum language > tool param > eng */
function resolveActiveOcrLanguage() {
  if (studioOcrLanguageOverride) return resolveOcrLanguage(studioOcrLanguageOverride);
  if (curriculumLanguage) return resolveOcrLanguage(curriculumLanguage);
  return resolveOcrLanguage(tool.param('ocrLanguage', 'eng'));
}

/** Document URL currently being OCR'd (prevents duplicate runs) */
var ocrInProgressDocUrl = '';

/** Everything needed to confirm the CMS injected the OCR engine */
function collectOcrDiagnostics() {
  var ocrEngine = (typeof window !== 'undefined') ? window.Tesseract : null;
  return {
    build: TOOL_BUILD,
    ocrEnginePresent: !!ocrEngine,
    ocrVersion: ocrEngine ? (ocrEngine.version || '(unknown)') : '',
    hasRecognize: !!(ocrEngine && typeof ocrEngine.recognize === 'function'),
    hasCreateWorker: !!(ocrEngine && typeof ocrEngine.createWorker === 'function'),
    ocrLanguage: readParamForDiagnostics('ocrLanguage'),
    ocrLanguageResolved: resolveActiveOcrLanguage(),
    curriculumLanguage: curriculumLanguage || '(not set)',
    ocrLanguageOverride: studioOcrLanguageOverride || '(follow curriculum language)',
    ocrMaxPages: readParamForDiagnostics('ocrMaxPages'),
    ocrPageScale: readParamForDiagnostics('ocrPageScale'),
    ocrWorkerPath: readParamForDiagnostics('ocrWorkerPath'),
    ocrCorePath: readParamForDiagnostics('ocrCorePath'),
    ocrLanguagePath: readParamForDiagnostics('ocrLanguagePath'),
    ocrGalleryImages: readParamForDiagnostics('ocrGalleryImages'),
    pdfjsLibPresent: pdfJsLibraryAvailable(),
    galleryImages: editingStudyDocImages.length,
    imagesWithRecognizedText: editingStudyDocImages.filter(function(image) { return !!(image && image.ocrText); }).length
  };
}

function logOcrDiagnostics(stageLabel) {
  try {
    console.log('===== CURRICULUM BUILDER - OCR DIAGNOSTICS =====');
    console.log('stage: ' + stageLabel);
    console.log(JSON.stringify(collectOcrDiagnostics(), null, 2));
    console.log('===== END OCR DIAGNOSTICS =====');
  } catch (diagnosticsError) {
    console.warn('[STUDIO:OCR] diagnostics could not be printed:', diagnosticsError);
  }
}

/** OCR one rendered page; callback(errorText, recognizedText) */
function runOcrOnCanvas(pageCanvas, onDone) {
  var ocrEngine = window.Tesseract;
  var ocrLanguageText = resolveActiveOcrLanguage();
  try {
    if (typeof ocrEngine.createWorker === 'function') {
      var workerOptions = {};
      var workerPath = tool.param('ocrWorkerPath', '');
      var corePath = tool.param('ocrCorePath', '');
      var languagePath = tool.param('ocrLanguagePath', '');
      if (workerPath) workerOptions.workerPath = workerPath;
      if (corePath) workerOptions.corePath = corePath;
      if (languagePath) workerOptions.langPath = languagePath;
      var workerPromise = ocrEngine.createWorker(ocrLanguageText, 1, workerOptions);
      workerPromise.then(function(ocrWorker) {
        ocrWorker.recognize(pageCanvas).then(function(recognition) {
          var recognizedText = (recognition && recognition.data && recognition.data.text) ? recognition.data.text : '';
          try { ocrWorker.terminate(); } catch (terminateError) { /* ignore */ }
          onDone(null, recognizedText);
        }).catch(function(recognizeError) {
          try { ocrWorker.terminate(); } catch (terminateError) { /* ignore */ }
          onDone(String((recognizeError && recognizeError.message) || recognizeError));
        });
      }).catch(function(workerError) {
        onDone(String((workerError && workerError.message) || workerError));
      });
      return;
    }
    ocrEngine.recognize(pageCanvas, ocrLanguageText).then(function(recognition) {
      onDone(null, (recognition && recognition.data && recognition.data.text) ? recognition.data.text : '');
    }).catch(function(recognizeError) {
      onDone(String((recognizeError && recognizeError.message) || recognizeError));
    });
  } catch (ocrError) {
    onDone(String((ocrError && ocrError.message) || ocrError));
  }
}

/** Render the first N pages with PDF.js and OCR them. callback(error, text, pagesOcr, totalPages) */
function ocrPdfBytesToText(pdfBytes, onDone) {
  if (!pdfJsLibraryAvailable()) { onDone('The PDF renderer (PDF.js) is not enabled, so pages cannot be rendered for OCR.'); return; }
  if (!ocrEngineAvailable()) { onDone('The OCR engine (Tesseract.js) is not enabled for this tool.'); return; }
  var ocrLanguageText = resolveActiveOcrLanguage();
  var ocrMaxPages = parseInt(tool.param('ocrMaxPages', '8'), 10);
  if (!ocrMaxPages || ocrMaxPages < 1) ocrMaxPages = 8;
  var ocrPageScale = parseFloat(tool.param('ocrPageScale', '2'));
  if (!ocrPageScale || isNaN(ocrPageScale)) ocrPageScale = 2;
  ocrPageScale = Math.max(1, Math.min(3, ocrPageScale));
  console.log('[STUDIO:OCR] starting · ' + describeOcrEngine() + ' · language ' + ocrLanguageText +
    ' · up to ' + ocrMaxPages + ' page(s) · scale ' + ocrPageScale);
  logOcrDiagnostics('page OCR start');
  window.pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise.then(function(pdfDocument) {
    var pagesToOcr = Math.min(pdfDocument.numPages, ocrMaxPages);
    var pageTexts = [];
    function ocrNextPage(pageNumber) {
      if (pageNumber > pagesToOcr) {
        var combinedText = pageTexts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
        onDone(null, combinedText, pagesToOcr, pdfDocument.numPages);
        return;
      }
      startStudioStatusTicker('🔍 OCR page ' + pageNumber + ' of ' + pagesToOcr);
      pdfDocument.getPage(pageNumber).then(function(pdfPage) {
        var pageViewport = pdfPage.getViewport({ scale: ocrPageScale });
        var pageCanvas = document.createElement('canvas');
        pageCanvas.width = Math.max(1, Math.floor(pageViewport.width));
        pageCanvas.height = Math.max(1, Math.floor(pageViewport.height));
        pdfPage.render({ canvasContext: pageCanvas.getContext('2d'), viewport: pageViewport }).promise.then(function() {
          runOcrOnCanvas(pageCanvas, function(ocrError, pageText) {
            if (ocrError) console.warn('[STUDIO:OCR] page ' + pageNumber + ' failed:', ocrError);
            if (pageText && pageText.trim()) pageTexts.push(pageText.trim());
            ocrNextPage(pageNumber + 1);
          });
        }).catch(function(renderError) {
          console.warn('[STUDIO:OCR] page ' + pageNumber + ' could not be rendered:', renderError);
          ocrNextPage(pageNumber + 1);
        });
      }).catch(function(pageError) {
        console.warn('[STUDIO:OCR] page ' + pageNumber + ' could not be opened:', pageError);
        ocrNextPage(pageNumber + 1);
      });
    }
    ocrNextPage(1);
  }).catch(function(openError) {
    onDone('The PDF could not be opened for OCR: ' + ((openError && openError.message) || openError));
  });
}

/** Load an image (data URL) into a canvas sized for OCR */
function loadImageCanvasForOcr(imageDataUrl, onDone) {
  var imageElement = new Image();
  imageElement.onload = function() {
    try {
      var maxSide = 1800;
      var scale = Math.min(1, maxSide / Math.max(imageElement.width || 1, imageElement.height || 1));
      var imageCanvas = document.createElement('canvas');
      imageCanvas.width = Math.max(1, Math.round((imageElement.width || 1) * scale));
      imageCanvas.height = Math.max(1, Math.round((imageElement.height || 1) * scale));
      imageCanvas.getContext('2d').drawImage(imageElement, 0, 0, imageCanvas.width, imageCanvas.height);
      onDone(null, imageCanvas);
    } catch (canvasError) {
      onDone(String((canvasError && canvasError.message) || canvasError));
    }
  };
  imageElement.onerror = function() { onDone('the image could not be loaded'); };
  imageElement.src = imageDataUrl;
}

/** OCR one gallery picture: callback(errorText, recognizedText) */
function ocrGalleryImage(image, onDone) {
  var embeddedDataUrl = (typeof image.dataUrl === 'string' && image.dataUrl.indexOf('data:') === 0) ? image.dataUrl : '';
  if (embeddedDataUrl) {
    loadImageCanvasForOcr(embeddedDataUrl, function(imageError, imageCanvas) {
      if (imageError) { onDone(imageError); return; }
      runOcrOnCanvas(imageCanvas, onDone);
    });
    return;
  }
  var hostedUrl = (typeof image.url === 'string' && image.url.indexOf('http') === 0) ? image.url : '';
  if (!hostedUrl) { onDone('the picture has no readable source'); return; }
  if (!binaryFileChannelAvailable()) { onDone('file downloads are switched off'); return; }
  fetchDocumentBytes(hostedUrl, { purpose: 'ocr-image' }, function(fetchError, imageBytes, imageMeta) {
    if (fetchError || !imageBytes || !imageBytes.length) {
      onDone(describeFileFetchFailureForConsole(fetchError, imageMeta));
      return;
    }
    var imageDataUrl = bytesToDataUrl(imageBytes, (imageMeta && imageMeta.contentType) || 'image/jpeg');
    loadImageCanvasForOcr(imageDataUrl, function(imageError, imageCanvas) {
      if (imageError) { onDone(imageError); return; }
      runOcrOnCanvas(imageCanvas, onDone);
    });
  });
}

/** OCR the open document's gallery pictures. Text is cached on each image
 *  (image.ocrText) so a second generation run does not repeat the work. */
function ocrStudioGalleryImages(onDone) {
  if (!ocrEngineAvailable()) { onDone('', '', 0); return; }
  logOcrDiagnostics('picture OCR start');
  var maxImages = parseInt(tool.param('ocrImageMaxCount', '4'), 10);
  if (!maxImages || maxImages < 1) maxImages = 4;
  var pendingImages = [];
  for (var imageIndex = 0; imageIndex < editingStudyDocImages.length && pendingImages.length < maxImages; imageIndex++) {
    var galleryImage = editingStudyDocImages[imageIndex];
    if (!galleryImage) continue;
    if (galleryImage.ocrText && galleryImage.ocrText.length > 20) continue;
    if ((galleryImage.width || 0) && galleryImage.width < 240) continue;
    if ((galleryImage.height || 0) && galleryImage.height < 120) continue;
    pendingImages.push(galleryImage);
  }
  if (!pendingImages.length) { onDone('', '', 0); return; }
  var collectedTexts = [];
  var imagesRead = 0;
  function ocrNextImage(imagePosition) {
    if (imagePosition >= pendingImages.length) {
      persistStudioImages();
      if (imagesRead > 0) autoSaveCurrentLesson();
      onDone('', collectedTexts.join('\n\n'), imagesRead);
      return;
    }
    startStudioStatusTicker('🔍 Reading the text inside picture ' + (imagePosition + 1) + ' of ' + pendingImages.length);
    var currentImage = pendingImages[imagePosition];
    ocrGalleryImage(currentImage, function(imageOcrError, imageText) {
      if (imageOcrError) console.warn('[STUDIO:OCR] picture "' + (currentImage.name || '') + '" could not be read:', imageOcrError);
      if (imageText && imageText.replace(/\s+/g, '').length >= 20) {
        currentImage.ocrText = imageText.trim().slice(0, 4000);
        collectedTexts.push('[' + (currentImage.name || 'image') + ']\n' + currentImage.ocrText);
        imagesRead++;
      }
      ocrNextImage(imagePosition + 1);
    });
  }
  ocrNextImage(0);
}

/** Download ANY study document to the user's disk.
 *  Local file bytes -> large-file download channel -> open in a new tab. */
function downloadStudyDocFile(docUrl) {
  var targetUrl = docUrl || studioCurrentDocUrl;
  if (!targetUrl && !studioLocalPdfBlobUrl) { tool.notify('No document is open.', 'warning'); return; }
  if (studioLocalPdfBlobUrl && studioLocalPdfUrl === targetUrl) {
    try {
      var downloadAnchor = document.createElement('a');
      downloadAnchor.href = studioLocalPdfBlobUrl;
      downloadAnchor.download = studioLocalPdfName || safeDownloadFileName(targetUrl, 'document.pdf');
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      tool.notify('Download started - open the file in your viewer.', 'info');
      return;
    } catch (downloadError) { /* fall through to the download channel */ }
  }
  var fallbackName = safeDownloadFileName(targetUrl, 'document');
  var downloadProgress = { loadedBytes: 0, totalBytes: 0 };
  startStudioStatusTicker('⏳ Downloading "' + fallbackName + '"', function() {
    if (!downloadProgress.loadedBytes) return '';
    return formatFileSize(downloadProgress.loadedBytes) + (downloadProgress.totalBytes ? ' of ' + formatFileSize(downloadProgress.totalBytes) : '');
  });
  fetchDocumentBytes(targetUrl, {
    purpose: 'download',
    onProgress: function(loadedBytes, totalBytes) {
      downloadProgress.loadedBytes = loadedBytes || 0;
      downloadProgress.totalBytes = totalBytes || 0;
    }
  }, function(fetchError, fileBytes, fileMeta) {
    if (fetchError || !fileBytes || !fileBytes.length) {
      console.warn('[STUDIO:DOWNLOAD] download failed - ' + describeFileFetchFailureForConsole(fetchError, fileMeta));
      setStudioStatus('❌ ' + describeFileFetchError(fetchError, fileMeta) + ' Opening it in a new tab instead.', 'warn');
      tool.openUrl(toHostingUrl(targetUrl));
      return;
    }
    var savedName = (fileMeta && fileMeta.fileName) || fallbackName;
    var savedToDisk = saveBytesToDisk(fileBytes, savedName, (fileMeta && fileMeta.contentType) || 'application/octet-stream');
    if (savedToDisk) {
      setStudioStatus('✅ Downloaded "' + savedName + '" (' + formatFileSize(fileBytes.length) + ').', 'ok');
      tool.notify('Downloaded "' + savedName + '".', 'success');
    } else {
      setStudioStatus('❌ The browser could not save the file - opening it in a new tab instead.', 'warn');
      tool.openUrl(toHostingUrl(targetUrl));
    }
  });
}

/** Download button inside the studio drawer (any document type) */
function downloadOpenPdf() {
  downloadStudyDocFile(studioCurrentDocUrl);
}

/** Download ONE gallery image to disk (embedded data URL or hosted URL) */
function downloadStudioImageFile(imageIndex) {
  var image = editingStudyDocImages[imageIndex];
  if (!image) return;
  var imageName = String(image.name || 'document-image');
  if (!/\.(jpe?g|png|webp)$/i.test(imageName)) imageName += '.jpg';
  var embeddedDataUrl = (typeof image.dataUrl === 'string' && image.dataUrl.indexOf('data:') === 0) ? image.dataUrl : '';
  if (embeddedDataUrl) {
    try {
      var headerEnd = embeddedDataUrl.indexOf(',');
      var semicolonIndex = embeddedDataUrl.indexOf(';');
      var contentType = embeddedDataUrl.substring(5, semicolonIndex === -1 ? headerEnd : semicolonIndex);
      saveBytesToDisk(base64ToBytes(embeddedDataUrl.substring(headerEnd + 1)), imageName, contentType || 'image/jpeg');
      return;
    } catch (embeddedError) { /* fall through to the hosted URL */ }
  }
  var hostedUrl = (typeof image.url === 'string' && image.url.indexOf('http') === 0) ? image.url : '';
  if (!hostedUrl) { tool.notify('This image has no downloadable source.', 'warning'); return; }
  var hostedName = safeDownloadFileName(hostedUrl, imageName);
  if (!/\.(jpe?g|png|webp)$/i.test(hostedName)) hostedName += '.jpg';
  tool.notify('Downloading "' + hostedName + '"…', 'info');
  fetchDocumentBytes(hostedUrl, { purpose: 'image-download' }, function(fetchError, imageBytes, imageMeta) {
    if (fetchError || !imageBytes || !imageBytes.length) {
      console.warn('[STUDIO:DOWNLOAD] image download failed - ' + describeFileFetchFailureForConsole(fetchError, imageMeta));
      tool.notify(describeFileFetchError(fetchError, imageMeta), 'error');
      return;
    }
    saveBytesToDisk(imageBytes, hostedName, (imageMeta && imageMeta.contentType) || 'image/jpeg');
    tool.notify('Downloaded "' + hostedName + '".', 'success');
  });
}

/** Re-render the studio-related lists (unified documents list) */
function renderStudyDocStudio() {
  renderPdfEditorList();
}

/** Open the Document Studio drawer for one document (final or source) */
function openStudioDrawerForDoc(docUrl) {
  if (!docUrl) { tool.notify('No document to open.', 'warning'); return; }
  // Local PDF bytes belong to one document - release them when switching docs.
  if (studioLocalPdfUrl && studioLocalPdfUrl !== docUrl) {
    if (studioLocalPdfBlobUrl) {
      try { URL.revokeObjectURL(studioLocalPdfBlobUrl); } catch (localRevokeError) { /* ignore */ }
      studioLocalPdfBlobUrl = '';
    }
    studioLocalPdfBytes = null;
    studioLocalPdfUrl = '';
    studioLocalPdfName = '';
  }
  persistStudioImages();
  studioCurrentDocUrl = docUrl;
  editingStudyDocImages = (editingStudyDocImagesMap[docUrl] && Array.isArray(editingStudyDocImagesMap[docUrl]))
    ? JSON.parse(JSON.stringify(editingStudyDocImagesMap[docUrl]))
    : [];
  // Repeated Extract clicks before duplicates were filtered can leave the same
  // picture several times in this list - collapse those copies when opening.
  var removedDuplicateImages = collapseDuplicateStudioImages();
  if (removedDuplicateImages) persistStudioImages();
  var role = studioDocRole(docUrl);
  var titleEl = el('sd-drawer-title');
  var subtitleEl = el('sd-drawer-subtitle');
  var roleButton = el('btn-sd-make-role');
  if (titleEl) titleEl.textContent = readableFileName(docUrl);
  if (subtitleEl) subtitleEl.textContent = (role === 'final' ? '✅ Ready document - processed, shown to students' : '🧭 Sample document - input for creating your Ready document') + ' · ' + editingStudyDocImages.length + ' image(s)';
  if (roleButton) roleButton.textContent = role === 'final' ? '🔄 To Sample' : '🔄 To Ready';
  setStudioStatus('', '');
  switchStudioTab('document');
  syncStudioOcrLanguageSelect();
  loadStudioGeneratedForDoc(docUrl);
  loadStudioDocumentPreview();
  renderStudyDocImageGallery();
  var drawer = el('sd-studio-drawer');
  var drawerBackdrop = el('sd-studio-backdrop');
  if (drawer) drawer.classList.add('sd-drawer-open');
  if (drawerBackdrop) drawerBackdrop.classList.add('sd-drawer-backdrop-open');
  syncDrawerScrollLock();
  tool.resize();
}

/** Load the Generated content saved for one document into the drawer */
function loadStudioGeneratedForDoc(docUrl) {
  var generatedEntry = editingStudyDocGeneratedHtmlMap[docUrl];
  studioGeneratedHtml = (generatedEntry && typeof generatedEntry.html === 'string') ? generatedEntry.html : '';
  renderStudioGeneratedPreview();
}

/** Show the Generated content of the open document (never student-facing) */
function renderStudioGeneratedPreview() {
  var previewFrame = el('sd-gen-preview');
  var statusEl = el('sd-gen-status');
  if (!previewFrame) return;
  if (!studioGeneratedHtml) {
    previewFrame.srcdoc = '';
    if (statusEl) statusEl.textContent = 'not generated yet';
    return;
  }
  previewFrame.srcdoc = studioPreviewCss + studioGeneratedHtml;
  var generatedEntry = editingStudyDocGeneratedHtmlMap[studioCurrentDocUrl];
  var generatedAtText = (generatedEntry && generatedEntry.generatedAt) ? new Date(generatedEntry.generatedAt).toLocaleString() : '';
  if (statusEl) statusEl.textContent = '💾 ' + formatCount(studioGeneratedHtml.length) + ' chars' + (generatedAtText ? ' · ' + generatedAtText : '');
}

/** Promote the Generated content into the lesson Study Content (student-facing) */
function publishGeneratedToStudyContent(mode) {
  if (!studioGeneratedHtml) {
    tool.notify('Generate the document first (✨ Generate Study Content).', 'warning');
    return;
  }
  var sourceName = readableFileName(studioCurrentDocUrl) || 'source document';
  if (mode === 'replace' || !editingHtmlCode) {
    editingHtmlCode = studioGeneratedHtml;
  } else {
    editingHtmlCode = editingHtmlCode +
      '\n\n<hr class="study-content-merge">\n<section class="study-content-part" data-source="' + esc(sourceName) + '">\n' +
      studioGeneratedHtml + '\n</section>';
  }
  editingStudyHtmlData = null;
  if (el('edit-html-code')) el('edit-html-code').value = editingHtmlCode;
  if (el('edit-html-code-v2')) el('edit-html-code-v2').value = editingHtmlCode;
  updateHtmlPreview();
  autoSaveCurrentLesson();
  var waitingForGeneratedCount = countStudioImagesWaitingForGenerated();
  if (waitingForGeneratedCount > 0) {
    tool.notify('Study Content updated, but ' + waitingForGeneratedCount + ' Source picture(s) still need a 🎨 generated version.', 'warning');
    setStudioStatus('⚠️ Study Content updated (student-facing). ' + waitingForGeneratedCount + ' Source picture(s) still wait for a generated version - open the Pictures tab and press 🎨 Generate Image.', 'warn');
    return;
  }
  tool.notify(mode === 'replace'
    ? 'The lesson Study Content now uses the Generated content.'
    : 'Added the Generated content to the lesson Study Content.', 'success');
  setStudioStatus('✅ Study Content updated (student-facing). Generated copies stay attached to their source documents.', 'ok');
}

/* ── Quality report: a separate AI call that compares Source vs Generated ──
   Temporary result: shown in a modal + logged to the console, never saved. */
function buildStudyContentQualityPrompt(sourceText, generatedHtml) {
  return 'You are a strict editorial reviewer for educational content. Compare the SOURCE text with the GENERATED document.\n' +
    'Return ONLY one JSON object (no markdown, no prose) with exactly these keys:\n' +
    '{"coverageScore":0-100,"similarityScore":0-100,"similarityRisk":"low|medium|high",' +
    '"coveredPoints":["..."],"missingPoints":["..."],"addedInformation":["..."],' +
    '"unverifiableClaims":["..."],"qualityVerdict":"one short paragraph","recommendations":["..."]}\n\n' +
    'RULES:\n' +
    '- coverageScore: how completely the generated document covers the facts, terms, numbers, definitions and rules of the source. 90+ only when nothing important is missing.\n' +
    '- similarityScore: textual similarity to the source. 0 = fully independently rewritten, 100 = verbatim copy. Above 40 is a copyright/plagiarism risk.\n' +
    '- similarityRisk must follow the score: low < 25, medium 25-50, high > 50.\n' +
    '- missingPoints: facts, definitions or examples from the source that the generated document lost or changed.\n' +
    '- addedInformation: statements in the generated document that are NOT in the source. Mark each with "(safe general knowledge)" or "(needs verification)".\n' +
    '- unverifiableClaims: added specifics (numbers, dates, names, statistics) that cannot be confirmed from the source. These must be removed or sourced.\n' +
    '- Never invent source content and never claim the source says something it does not.\n' +
    '- Recommendations must be concrete edits, max 6 items.\n\n' +
    'SOURCE DOCUMENT TEXT:\n"""\n' + sourceText + '\n"""\n\n' +
    'GENERATED DOCUMENT HTML:\n"""\n' + generatedHtml + '\n"""';
}

/** Parse the AI JSON defensively (accepts code fences and surrounding prose) */
function parseQualityReport(rawText) {
  var reportText = String(rawText || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  var firstBrace = reportText.indexOf('{');
  var lastBrace = reportText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) reportText = reportText.substring(firstBrace, lastBrace + 1);
  try { return JSON.parse(reportText); } catch (parseError) { return null; }
}

function showQualityReportModal(report, rawText) {
  var bodyHtml = '';
  if (!report) {
    bodyHtml = '<div class="sd-modal-section"><div class="sd-modal-label">The AI answer was not valid JSON</div>' +
      '<pre class="sd-quality-raw">' + esc(String(rawText || '').slice(0, 6000)) + '</pre></div>';
  } else {
    function scoreRow(labelText, scoreValue, isRisk) {
      var safeScore = Math.max(0, Math.min(100, Math.round(Number(scoreValue) || 0)));
      return '<div class="sd-quality-score">' +
        '<span class="sd-quality-score-label">' + esc(labelText) + '</span>' +
        '<span class="sd-quality-bar' + (isRisk ? ' is-risk' : '') + '"><span style="width:' + safeScore + '%"></span></span>' +
        '<strong>' + safeScore + '</strong>' +
      '</div>';
    }
    function listBlock(titleText, items) {
      if (!items || !items.length) return '';
      var listItems = '';
      for (var itemIndex = 0; itemIndex < items.length; itemIndex++) listItems += '<li>' + esc(String(items[itemIndex])) + '</li>';
      return '<div class="sd-quality-section"><h4>' + esc(titleText) + '</h4><ul>' + listItems + '</ul></div>';
    }
    bodyHtml = '<div class="sd-quality-scores">' +
        scoreRow('Coverage', report.coverageScore, false) +
        scoreRow('Similarity', report.similarityScore, true) +
      '</div>' +
      '<div class="sd-quality-section"><h4>Similarity risk: ' + esc(String(report.similarityRisk || 'unknown')).toUpperCase() + '</h4>' +
        '<ul><li>' + esc(String(report.qualityVerdict || 'No verdict returned.')) + '</li></ul></div>' +
      listBlock('Missing from the generated document', report.missingPoints) +
      listBlock('Added information (not in the source)', report.addedInformation) +
      listBlock('Unverifiable claims - remove or source', report.unverifiableClaims) +
      listBlock('Recommended edits', report.recommendations) +
      listBlock('Covered well', report.coveredPoints) +
      '<div class="sd-modal-section" style="margin-top:14px"><div class="sd-modal-label">Temporary result - not saved with the document</div></div>';
  }
  openStudioModal('🔍 Quality report (temporary)', bodyHtml);
  console.log('[STUDIO:QUALITY] report', report || rawText);
}

function runStudyContentQualityCheck() {
  if (typeof tool.requestAI !== 'function') {
    tool.notify('AI is not enabled for this tool (allowAI).', 'warning');
    return;
  }
  if (!studioCurrentDocUrl) { tool.notify('Open a document first.', 'warning'); return; }
  if (!studioGeneratedHtml) { tool.notify('Generate the document first (✨ Generate Study Content).', 'warning'); return; }
  var qualityButton = el('btn-sd-quality');
  if (qualityButton) qualityButton.disabled = true;
  setStudioStatus('🔍 Comparing the source document with the generated content…', 'busy');
  readSourceDocumentText(function(readError, sourceText) {
    if (readError || !sourceText) {
      if (qualityButton) qualityButton.disabled = false;
      setStudioStatus('❌ ' + (readError || 'The source text could not be read.'), 'warn');
      return;
    }
    var qualityPrompt = buildStudyContentQualityPrompt(sourceText.slice(0, 20000), studioGeneratedHtml.slice(0, 40000));
    tool.requestAI(qualityPrompt, null, function(aiError, aiResult) {
      if (qualityButton) qualityButton.disabled = false;
      if (aiError) {
        console.warn('[STUDIO:QUALITY] AI call failed:', aiError);
        setStudioStatus('❌ Quality check failed - try again.', 'warn');
        return;
      }
      var rawText = (typeof aiResult === 'string')
        ? aiResult
        : ((aiResult && (aiResult.text || aiResult.content || aiResult.message)) || '');
      var report = parseQualityReport(rawText);
      setStudioStatus('✅ Quality report ready (temporary - not saved).', 'ok');
      showQualityReportModal(report, rawText);
    });
  });
}

function closeStudioDrawer() {
  persistStudioImages();
  studioCurrentDocUrl = '';
  editingStudyDocImages = [];
  studioOcrLanguageOverride = '';
  syncStudioOcrLanguageSelect();
  // Keep the local PDF bytes/blob for the session: reopening the same document
  // does not require picking the file again. They are released when a
  // different document is opened (see openStudioDrawerForDoc).
  if (studioPreviewBlobUrl) {
    try { URL.revokeObjectURL(studioPreviewBlobUrl); } catch (previewRevokeError) { /* ignore */ }
    studioPreviewBlobUrl = '';
  }
  var drawer = el('sd-studio-drawer');
  var drawerBackdrop = el('sd-studio-backdrop');
  if (drawer) drawer.classList.remove('sd-drawer-open');
  if (drawerBackdrop) drawerBackdrop.classList.remove('sd-drawer-backdrop-open');
  syncDrawerScrollLock();
  var previewFrame = el('sd-doc-preview');
  if (previewFrame) previewFrame.src = 'about:blank';
  renderPdfEditorList();
  tool.resize();
}

/** Switch the open document between Final and Source (any type) */
function toggleStudioDocRole() {
  if (!studioCurrentDocUrl) return;
  var role = studioDocRole(studioCurrentDocUrl);
  if (role === 'final') {
    var removedType = removeRealDocumentUrl(studioCurrentDocUrl);
    if (!removedType) return;
    editingStudyDocSources.push({ url: studioCurrentDocUrl, name: readableFileName(studioCurrentDocUrl), type: removedType });
    tool.notify('Document marked as Sample - it is now the input for creating your own Ready document and is not shown to students.', 'info');
  } else if (role === 'source') {
    var sourceType = 'studyDoc';
    for (var i = 0; i < editingStudyDocSources.length; i++) {
      if (editingStudyDocSources[i].url === studioCurrentDocUrl) {
        sourceType = editingStudyDocSources[i].type || 'studyDoc';
        editingStudyDocSources.splice(i, 1);
        break;
      }
    }
    getPdfArray(sourceType).push(studioCurrentDocUrl);
    tool.notify('Document marked as Ready - students will now see it and AI generation may use it.', 'success');
  }
  var roleButton = el('btn-sd-make-role');
  if (roleButton) roleButton.textContent = studioDocRole(studioCurrentDocUrl) === 'final' ? '🔄 To Sample' : '🔄 To Ready';
  var subtitleEl = el('sd-drawer-subtitle');
  if (subtitleEl) subtitleEl.textContent = (studioDocRole(studioCurrentDocUrl) === 'final' ? '✅ Ready document - processed, shown to students' : '🧭 Sample document - input for creating your Ready document') + ' · ' + editingStudyDocImages.length + ' image(s)';
  renderPdfEditorList();
  autoSaveLessonAfterDocumentChange('document role changed');
}

function totalStudioImageKb() {
  var total = 0;
  for (var i = 0; i < editingStudyDocImages.length; i++) total += editingStudyDocImages[i].sizeKb || 0;
  return total;
}

/** Which version of each picture the gallery shows ('original' | 'generated') */
var studioImagePreviewVersion = {};

function renderStudyDocImageGallery() {
  var grid = el('sd-images-grid');
  var countEl = el('sd-images-count');
  var tabCountEl = el('sd-pictures-tab-count');
  if (!grid) return;
  var sourceImageCount = 0;
  for (var countIndex = 0; countIndex < editingStudyDocImages.length; countIndex++) {
    if (studioImageRole(editingStudyDocImages[countIndex]) === 'source') sourceImageCount++;
  }
  var pendingImageCount = countStudioImagesWaitingForGenerated();
  if (countEl) {
    countEl.textContent = editingStudyDocImages.length + ' picture(s) · ' + totalStudioImageKb() + ' KB' +
      (sourceImageCount ? ' · ' + sourceImageCount + ' source' + (pendingImageCount ? ' (' + pendingImageCount + ' need a generated version)' : '') : '');
  }
  if (tabCountEl) tabCountEl.textContent = String(editingStudyDocImages.length);
  if (!editingStudyDocImages.length) {
    grid.innerHTML = '<div class="sd-empty">No pictures yet. Use “Get Pictures”, “Add Image”, or paste a screenshot with Ctrl+V.</div>';
    return;
  }
  grid.innerHTML = editingStudyDocImages.map(function(image, idx) {
    var imageRole = studioImageRole(image);
    var hasGenerated = studioImageHasGenerated(image);
    var showGenerated = hasGenerated && studioImagePreviewVersion[idx] === 'generated';
    var previewSrc = showGenerated ? studioImageGeneratedSrc(image) : imageContentSrc(image);
    var badgeHtml = '';
    if (imageRole === 'source' && !hasGenerated) badgeHtml += '<span class="sd-image-badge needs">⏳ needs generated version</span>';
    if (hasGenerated) badgeHtml += '<span class="sd-image-badge ok">🎨 generated</span>';
    var versionToggle = hasGenerated
      ? '<div class="sd-image-version">' +
          '<button type="button" class="sd-version-btn' + (!showGenerated ? ' active' : '') + '" data-sd-version="' + idx + '" data-version="original">Original</button>' +
          '<button type="button" class="sd-version-btn' + (showGenerated ? ' active' : '') + '" data-sd-version="' + idx + '" data-version="generated">Generated</button>' +
        '</div>'
      : '';
    return '<div class="sd-image-card' + (imageRole === 'source' ? ' is-source' : '') + '">' +
      '<label class="sd-image-check"><input type="checkbox" data-sd-select="' + idx + '"> select</label>' +
      '<img src="' + previewSrc + '" alt="' + esc(image.name) + '" title="Click to view large" data-sd-view="' + idx + '">' +
      versionToggle +
      '<div class="sd-image-meta">' + esc(image.name) +
        '<span class="sd-muted">' + (isImageHosted(image) ? '🔗 hosted · ' : '') + (image.ocrText ? '📝 text · ' : '') + (image.width || '?') + '×' + (image.height || '?') + ' · ' + image.sizeKb + ' KB</span>' +
        badgeHtml +
      '</div>' +
      '<div class="sd-image-actions">' +
        '<button type="button" class="sd-image-role ' + (imageRole === 'source' ? 'is-source' : 'is-real') + '" data-sd-role="' + idx + '" title="Click to switch: Real = used directly by generated content, Source = needs a generated version">' +
          (imageRole === 'source' ? '◐ Source' : '● Real') + '</button>' +
        '<button type="button" class="btn btn-sm btn-outline" data-sd-regen="' + idx + '" title="Generate or regenerate a version of this picture">🎨</button>' +
        '<button type="button" class="btn btn-sm btn-danger" data-sd-remove="' + idx + '">🗑</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

/** Switch a picture between Real (use directly) and Source (needs a generated version) */
function toggleStudioImageRole(imageIndex) {
  var image = editingStudyDocImages[imageIndex];
  if (!image) return;
  image.role = studioImageRole(image) === 'source' ? 'real' : 'source';
  persistStudioImages();
  autoSaveCurrentLesson();
  renderStudyDocImageGallery();
  if (image.role === 'source' && !studioImageHasGenerated(image)) {
    tool.notify('Marked as Source - press 🎨 Generate Image to create its generated version.', 'info');
  } else if (image.role === 'real') {
    tool.notify('Marked as Real - generated content uses this picture directly.', 'info');
  }
}

/** Show the original or the generated version in the gallery card */
function setStudioImageVersion(imageIndex, version) {
  studioImagePreviewVersion[imageIndex] = version === 'generated' ? 'generated' : 'original';
  renderStudyDocImageGallery();
}

/** Store the AI result as the picture's GENERATED version (the original is kept) */
function applyGeneratedVersionToStudioImage(imageIndex, generatedDataUrl, generatedPromptText) {
  var targetImage = editingStudyDocImages[imageIndex];
  if (!targetImage) return;
  targetImage.generatedDataUrl = generatedDataUrl;
  targetImage.generatedUrl = '';
  targetImage.generatedSizeKb = Math.max(1, Math.round(generatedDataUrl.length * 0.75 / 1024));
  targetImage.generatedAt = Date.now();
  targetImage.generatedPrompt = generatedPromptText || '';
  if (!targetImage.role) targetImage.role = defaultStudioImageRole();
  studioImagePreviewVersion[imageIndex] = 'generated';
  persistStudioImages();
  renderStudyDocImageGallery();
  autoSaveCurrentLesson();
  uploadStudioGeneratedImageToStorage(imageIndex, function(uploaded) {
    renderStudyDocImageGallery();
    if (uploaded) autoSaveCurrentLesson();
  });
}

/** Upload a picture's generated version so the lesson stores a hosted URL */
function uploadStudioGeneratedImageToStorage(imageIndex, onDone) {
  var image = editingStudyDocImages[imageIndex];
  if (!image || !image.generatedDataUrl) { if (onDone) onDone(false); return; }
  if (typeof tool.requestUploadBinary !== 'function') { if (onDone) onDone(false); return; }
  var uploadName = 'generated-' + (/^[^/\\]+$/.test(image.name || '') ? image.name : 'image') + '.jpg';
  tool.requestUploadBinary({ dataUrl: image.generatedDataUrl, name: uploadName, contentType: 'image/jpeg' }, function(uploadError, uploadResult) {
    if (uploadError || !uploadResult || !uploadResult.url) {
      console.warn('[STUDIO:IMAGES] generated version upload failed for ' + image.name + ': ' + (uploadError || 'empty result'));
      if (onDone) onDone(false);
      return;
    }
    image.generatedUrl = uploadResult.url;
    image.generatedDataUrl = '';
    if (uploadResult.sizeKb) image.generatedSizeKb = uploadResult.sizeKb;
    persistStudioImages();
    if (onDone) onDone(true);
  });
}

function openStudioModal(title, bodyHtml) {
  closeStudioModal();
  var overlay = document.createElement('div');
  overlay.className = 'sd-modal-overlay';
  overlay.id = 'sd-modal-overlay';
  overlay.innerHTML = '<div class="sd-modal"><div class="sd-modal-header">' + esc(title) + '<button type="button" class="sd-modal-close" data-sd-close>✕</button></div><div class="sd-modal-body" id="sd-modal-body">' + bodyHtml + '</div></div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(event) {
    if (event.target === overlay) { closeStudioModal(); return; }
    if (event.target && event.target.getAttribute && event.target.getAttribute('data-sd-close') !== null) closeStudioModal();
  });
}

function closeStudioModal() {
  var overlay = el('sd-modal-overlay');
  if (overlay) overlay.remove();
}

function openStudioImageView(imageIndex) {
  var image = editingStudyDocImages[imageIndex];
  if (!image) return;
  var imageSrc = imageContentSrc(image);
  var imageRole = studioImageRole(image);
  var hasGenerated = studioImageHasGenerated(image);
  var generatedSrc = hasGenerated ? studioImageGeneratedSrc(image) : '';
  var roleLine = '<div class="sd-view-role">Role: <strong>' + (imageRole === 'source' ? '◐ Source' : '● Real') + '</strong>' +
    (imageRole === 'source' ? ' - generated content must use a generated version' : ' - generated content uses this picture directly') + '</div>';
  var generatedBlock = hasGenerated
    ? '<div class="sd-view-version"><div class="sd-compare-label">Original (kept)</div><img class="sd-view-image" src="' + imageSrc + '" alt="Original"></div>' +
      '<div class="sd-view-version"><div class="sd-compare-label">Generated version · ' + (image.generatedSizeKb || '?') + ' KB</div><img class="sd-view-image" src="' + generatedSrc + '" alt="Generated"></div>'
    : '<img class="sd-view-image" src="' + imageSrc + '" alt="' + esc(image.name) + '">';
  var bodyHtml = generatedBlock +
    '<div style="text-align:center;margin-top:10px;font-size:12px;color:var(--text-muted)">' + esc(image.name) + ' · ' + (image.width || '?') + '×' + (image.height || '?') + ' · ' + image.sizeKb + ' KB' + (isImageHosted(image) ? ' · 🔗 hosted' : '') + '</div>' +
    roleLine +
    '<div class="sd-modal-actions" style="justify-content:center">' +
      '<button type="button" class="btn btn-outline" data-sd-view-open>↗ Open Original</button>' +
      (hasGenerated ? '<button type="button" class="btn btn-outline" data-sd-view-open-generated>↗ Open Generated</button>' : '') +
      '<button type="button" class="btn btn-outline" data-sd-view-download>⬇ Download Original</button>' +
      '<button type="button" class="btn btn-primary" data-sd-view-regen>' + (hasGenerated ? '🎨 Regenerate Version' : '🎨 Generate Version') + '</button>' +
    '</div>';
  openStudioModal('🖼 ' + esc(image.name), bodyHtml);
  var modalBody = el('sd-modal-body');
  if (!modalBody) return;
  var openButton = modalBody.querySelector('[data-sd-view-open]');
  if (openButton) openButton.addEventListener('click', function() { tool.openUrl(imageSrc); });
  var openGeneratedButton = modalBody.querySelector('[data-sd-view-open-generated]');
  if (openGeneratedButton) openGeneratedButton.addEventListener('click', function() { tool.openUrl(generatedSrc); });
  var downloadButton = modalBody.querySelector('[data-sd-view-download]');
  if (downloadButton) {
    downloadButton.addEventListener('click', function() { downloadStudioImageFile(imageIndex); });
  }
  var regenButton = modalBody.querySelector('[data-sd-view-regen]');
  if (regenButton) regenButton.addEventListener('click', function() { closeStudioModal(); openStudioRegenerateDialog([imageIndex]); });
}

/* ── Studio actions: upload, extract, generate ── */
/** Upload dialog: choose the document type, then pick the file */
function openUploadDocumentDialog() {
  var typeKeys = ['presentation', 'studyDoc', 'worksheet', 'answerKey', 'htmlDoc'];
  var optionsHtml = typeKeys.map(function(t) {
    return '<option value="' + t + '">' + (PDF_LABELS[t] ? PDF_LABELS[t].icon + ' ' + PDF_LABELS[t].label : t) + '</option>';
  }).join('');
  var bodyHtml = '<div class="sd-modal-section"><div class="sd-modal-label">Document Type</div>' +
    '<select class="form-input" id="sd-upload-doc-type">' + optionsHtml + '</select></div>' +
    '<div class="sd-modal-section"><div class="sd-modal-label">File</div>' +
    '<button type="button" class="btn btn-primary" id="sd-upload-choose">📁 Choose File from Device</button></div>' +
    '<div class="sd-modal-actions"><button type="button" class="btn btn-outline" data-sd-close>Cancel</button></div>';
  openStudioModal('⬆ Upload Document', bodyHtml);
  var chooseButton = el('sd-upload-choose');
  if (!chooseButton) return;
  chooseButton.addEventListener('click', function() {
    function finishDocumentUpload(uploadedName, uploadedUrl) {
      var chosenType = 'studyDoc';
      var typeSelect = el('sd-upload-doc-type');
      if (typeSelect && typeSelect.value) chosenType = typeSelect.value;
      getPdfArray(chosenType).push(uploadedUrl);
      closeStudioModal();
      renderPdfEditorList();
      autoSaveLessonAfterDocumentChange('document uploaded');
      tool.notify('Uploaded "' + uploadedName + '" as a Ready ' + ((PDF_LABELS[chosenType] || {}).label || chosenType) + '.', 'success');
    }
    // Preferred path: read the file in the browser and upload it with
    // requestUploadBinary. This does not depend on the CMS file-picker relay,
    // which can fail silently in some hosts.
    if (typeof tool.requestUploadBinary === 'function') {
      var pickerOpened = pickLocalFile('.pdf,.doc,.docx,.xls,.xlsx,.html,.htm,.txt,.csv', function(selectedFile) {
        tool.notify('Uploading "' + selectedFile.name + '" to CMS storage…', 'info');
        uploadLocalFileToStorage(selectedFile, function(uploadError, uploadResult) {
          if (uploadError) { tool.notify(uploadError, 'error'); return; }
          finishDocumentUpload(selectedFile.name, uploadResult.url);
        });
      });
      if (!pickerOpened) tool.notify('The browser blocked the file picker. Try again from a click.', 'error');
      return;
    }
    if (typeof tool.requestUpload !== 'function') {
      tool.notify('CMS upload is not enabled (admin must set allowUpload: yes or allowBinaryUpload: yes).', 'warning');
      closeStudioModal();
      return;
    }
    tool.requestUpload('.pdf,.doc,.docx,.xls,.xlsx,.html,.htm,.txt,.csv', function(uploadError, uploadedFile) {
      if (uploadError || !uploadedFile) {
        if (uploadError) tool.notify('Upload failed: ' + uploadError, 'error');
        return;
      }
      finishDocumentUpload(uploadedFile.name, uploadedFile.url);
    });
  });
}

function addStudyDocImageDirectly() {
  if (!studioCurrentDocUrl) { tool.notify('Open a document in the Studio drawer first (⚙️ button).', 'warning'); return; }
  function storeUploadedImage(uploadedName, uploadedUrl, uploadedSizeKb) {
    editingStudyDocImages.push({ id: genId(), name: uploadedName, width: 0, height: 0, url: uploadedUrl, sizeKb: uploadedSizeKb || 0, role: 'real' });
    persistStudioImages();
    renderStudyDocImageGallery();
    renderPdfEditorList();
    autoSaveLessonAfterDocumentChange('image uploaded to the document gallery');
    tool.notify('Image added to this document with a reachable CMS URL.', 'success');
  }
  if (typeof tool.requestUploadBinary === 'function') {
    var pickerOpened = pickLocalFile('image/*', function(selectedFile) {
      tool.notify('Uploading "' + selectedFile.name + '" to CMS storage…', 'info');
      uploadLocalFileToStorage(selectedFile, function(uploadError, uploadResult) {
        if (uploadError) { tool.notify(uploadError, 'error'); return; }
        storeUploadedImage(selectedFile.name, uploadResult.url, uploadResult.sizeKb);
      });
    });
    if (!pickerOpened) tool.notify('The browser blocked the file picker. Try again from a click.', 'error');
    return;
  }
  if (typeof tool.requestUpload !== 'function') {
    tool.notify('CMS upload is not enabled (admin must set allowUpload: yes or allowBinaryUpload: yes).', 'warning');
    return;
  }
  tool.requestUpload('image/*', function(uploadError, uploadedFile) {
    if (uploadError || !uploadedFile) {
      if (uploadError) tool.notify('Upload failed: ' + uploadError, 'error');
      return;
    }
    storeUploadedImage(uploadedFile.name, uploadedFile.url, 0);
  });
}

/* ── 📁 Local PDF mode: read the file in the browser, no server relay ── */

/** Button handler: pick a PDF from the device and process it entirely locally */
function pickAndProcessLocalPdf() {
  var pickerOpened = pickLocalFile('.pdf,application/pdf', function(selectedFile) {
    processLocalPdfFile(selectedFile);
  });
  if (!pickerOpened) tool.notify('The browser blocked the file picker. Try again from a click.', 'error');
}

/** Read a local PDF into memory, then extract its images (and make it the target doc) */
function processLocalPdfFile(selectedFile) {
  if (!selectedFile) return;
  var lowerName = String(selectedFile.name || '').toLowerCase();
  if (lowerName.indexOf('.pdf') === -1 && selectedFile.type !== 'application/pdf') {
    tool.notify('Choose a PDF file - other formats cannot be read locally.', 'warning');
    return;
  }
  startStudioStatusTicker('📁 Reading "' + selectedFile.name + '" in your browser (no server)');
  var localReader = new FileReader();
  localReader.onerror = function() {
    setStudioStatus('❌ Could not read "' + selectedFile.name + '" from disk.', 'warn');
  };
  localReader.onload = function() {
    var pdfBytes = new Uint8Array(localReader.result);
    if (studioLocalPdfBlobUrl) {
      try { URL.revokeObjectURL(studioLocalPdfBlobUrl); } catch (localRevokeError) { /* ignore */ }
      studioLocalPdfBlobUrl = '';
    }
    studioLocalPdfBytes = pdfBytes;
    studioLocalPdfName = selectedFile.name;
    studioLocalPdfBlobUrl = URL.createObjectURL(selectedFile);
    ensureLocalPdfDocument(selectedFile, function(docError, docUrl) {
      if (docError) {
        setStudioStatus('❌ ' + docError + ' Tip: open an existing document first, then choose the local PDF - no upload is needed then.', 'warn');
        return;
      }
      studioLocalPdfUrl = docUrl;
      if (studioCurrentDocUrl !== docUrl) openStudioDrawerForDoc(docUrl);
      else loadStudioDocumentPreview();
      runLocalImageExtraction(pdfBytes);
    });
  };
  localReader.readAsArrayBuffer(selectedFile);
}

/** Use the open document, or upload the local PDF so it becomes a Ready document */
function ensureLocalPdfDocument(selectedFile, onDone) {
  if (studioCurrentDocUrl) { onDone(null, studioCurrentDocUrl); return; }
  uploadLocalFileToStorage(selectedFile, function(uploadError, uploadResult) {
    if (uploadError) { onDone(uploadError); return; }
    editingStudyDocPdfUrls.push(uploadResult.url);
    renderPdfEditorList();
    onDone(null, uploadResult.url);
  });
}

/** Scan local PDF bytes for images - no relay, no 500 KB limit */
function runLocalImageExtraction(pdfBytes, onDone) {
  startStudioStatusTicker('🧩 Scanning the local PDF for images (no server involved)');
  var candidates = findPdfImageStreams(pdfBytes);
  decodeAndStorePdfImages(candidates, onDone);
}

/** Stable identity for a gallery image so running Extract again does not add
 *  the same picture twice. The content hash is kept in image.contentKey
 *  because uploading to CMS storage clears image.dataUrl. */
function studioImageContentKey(image) {
  if (!image) return '';
  if (typeof image.contentKey === 'string' && image.contentKey) return image.contentKey;
  // Only an embedded data: URL identifies the picture itself. A hosted URL
  // (or an empty dataUrl left after the upload) says nothing about content,
  // so those images fall back to the name+size identity in studioImageMatchKeys().
  var dataUrlText = (typeof image.dataUrl === 'string' && image.dataUrl.indexOf('data:') === 0) ? image.dataUrl : '';
  if (!dataUrlText) return '';
  var hashValue = 2166136261;
  for (var position = 0; position < dataUrlText.length; position++) {
    hashValue ^= dataUrlText.charCodeAt(position);
    hashValue = (hashValue * 16777619) >>> 0;
  }
  var contentKey = (image.width || 0) + 'x' + (image.height || 0) + ':' + dataUrlText.length + ':' + hashValue.toString(36);
  image.contentKey = contentKey;
  return contentKey;
}

/** Every identity an image answers to. Two gallery entries sharing any key are
 *  the same picture (embedded content, extraction position, or stored URL). */
function studioImageMatchKeys(image) {
  if (!image) return [];
  var matchKeys = [];
  var contentKey = studioImageContentKey(image);
  if (contentKey) matchKeys.push('content:' + contentKey);
  var nameText = String(image.name || '');
  // Extraction results are named document-image-<n>; the name plus the exact
  // pixel size and a coarse byte-size bucket identifies them even after the
  // upload cleared their dataUrl (the CMS reports its own rounded sizeKb).
  if (/^document-image-\d+$/.test(nameText)) {
    var sizeBucket = Math.round((image.sizeKb || 0) / 16);
    matchKeys.push('extracted:' + nameText + '|' + (image.width || 0) + 'x' + (image.height || 0) + '|' + sizeBucket);
  }
  if (!matchKeys.length) matchKeys.push('ref:' + (image.url || image.dataUrl || ''));
  return matchKeys;
}

/** Remove duplicate entries from the open document's gallery. Returns how many
 *  were removed (duplicates created by repeated Extract clicks before the
 *  extraction started filtering them out). */
function collapseDuplicateStudioImages() {
  var seenImageKeys = {};
  var uniqueImages = [];
  var removedCount = 0;
  for (var imageIndex = 0; imageIndex < editingStudyDocImages.length; imageIndex++) {
    var galleryImage = editingStudyDocImages[imageIndex];
    var imageKeys = studioImageMatchKeys(galleryImage);
    var isDuplicate = false;
    for (var keyIndex = 0; keyIndex < imageKeys.length; keyIndex++) {
      if (seenImageKeys[imageKeys[keyIndex]]) isDuplicate = true;
    }
    if (isDuplicate) { removedCount++; continue; }
    for (var seenIndex = 0; seenIndex < imageKeys.length; seenIndex++) {
      seenImageKeys[imageKeys[seenIndex]] = true;
    }
    uniqueImages.push(galleryImage);
  }
  if (removedCount) {
    editingStudyDocImages = uniqueImages;
    console.log('[STUDIO:IMAGES] removed ' + removedCount + ' duplicate image entry(ies) from this document');
  }
  return removedCount;
}

/** Decode image candidates, add them to the open document's gallery and upload them */
function decodeAndStorePdfImages(candidates, onDone) {
  if (!candidates || !candidates.length) {
    var scanInfo = lastPdfScanInfo;
    var scanSummary = 'objects: ' + scanInfo.imageObjects + ', inline: ' + scanInfo.inlineImages + ', carved: ' + scanInfo.carvedImages +
      ' · image mentions: ' + scanInfo.imageMentions + ', pages: ' + scanInfo.pageCount + ', /XObject: ' + scanInfo.xobjectCount +
      ' · DCT: ' + scanInfo.filters.dct + ', Flate: ' + scanInfo.filters.flate + ', JPX: ' + scanInfo.filters.jpx +
      ', JBIG2: ' + scanInfo.filters.jbig2 + ', CCITT: ' + scanInfo.filters.ccitt +
      ' · encrypted: ' + (scanInfo.encrypted ? 'yes' : 'no');
    var scanAdvice = '';
    if (!scanInfo.isPdf) scanAdvice = ' This file does not start like a PDF - check that it is a real PDF file.';
    else if (scanInfo.encrypted) scanAdvice = ' The PDF is encrypted - the browser cannot read its images.';
    else if (scanInfo.filters.jpx > 0 || scanInfo.jp2Signature) scanAdvice = ' Its images are JPEG2000 (JPX) - Chrome cannot decode that format. Export the pages as standard JPEG/PNG or re-save the PDF as a standard PDF.';
    else if (scanInfo.filters.jbig2 > 0 || scanInfo.filters.ccitt > 0) scanAdvice = ' Its images are scanned fax/JBIG2 - the browser cannot decode them. Convert the scanned pages to JPEG/PNG first.';
    else if (scanInfo.imageMentions === 0) scanAdvice = ' No raster image objects exist in this file - the pictures are vector drawings. Use "� Get Pictures" to capture them as cropped images, or "⬇ Download File" to check the file.';
    console.log('[STUDIO:PDF-SCAN]', scanInfo);
    setStudioStatus('No images found in this document (' + scanSummary + ').' + scanAdvice + ' Use "⬇ Download File" to check the file.', 'warn');
    if (onDone) onDone();
    return;
  }
  startStudioStatusTicker('🧩 Found ' + candidates.length + ' image stream(s) - decoding images');
  decodePdfImageCandidates(candidates, function(decodeError, decodedImages, skippedNotes) {
    if (decodeError) { setStudioStatus('❌ ' + decodeError, 'warn'); if (onDone) onDone(); return; }
    if (!decodedImages.length) {
      var uniqueFailureReasons = [];
      for (var failureIndex = 0; failureIndex < skippedNotes.length; failureIndex++) {
        if (uniqueFailureReasons.indexOf(skippedNotes[failureIndex]) === -1) uniqueFailureReasons.push(skippedNotes[failureIndex]);
      }
      var reasons = uniqueFailureReasons.slice(0, 2).join(' · ');
      setStudioStatus('❌ Found ' + candidates.length + ' image(s) but none could be decoded. ' + (reasons || ''), 'warn');
      if (onDone) onDone();
      return;
    }
    // Ignore pictures that are already in this document's gallery - clicking
    // Extract again must not add the same images a second time.
    var knownImageKeys = {};
    for (var existingIndex = 0; existingIndex < editingStudyDocImages.length; existingIndex++) {
      var existingKeys = studioImageMatchKeys(editingStudyDocImages[existingIndex]);
      for (var existingKeyIndex = 0; existingKeyIndex < existingKeys.length; existingKeyIndex++) {
        knownImageKeys[existingKeys[existingKeyIndex]] = true;
      }
    }
    var addedImageCount = 0;
    var duplicateImageCount = 0;
    for (var i = 0; i < decodedImages.length; i++) {
      var decodedImage = decodedImages[i];
      var decodedKeys = studioImageMatchKeys(decodedImage);
      var isKnownImage = false;
      for (var decodedKeyIndex = 0; decodedKeyIndex < decodedKeys.length; decodedKeyIndex++) {
        if (knownImageKeys[decodedKeys[decodedKeyIndex]]) isKnownImage = true;
      }
      if (isKnownImage) { duplicateImageCount++; continue; }
      for (var newKeyIndex = 0; newKeyIndex < decodedKeys.length; newKeyIndex++) {
        knownImageKeys[decodedKeys[newKeyIndex]] = true;
      }
      editingStudyDocImages.push(decodedImage);
      addedImageCount++;
    }
    if (!addedImageCount) {
      var duplicateStatus = 'ℹ️ All ' + decodedImages.length + ' image(s) are already in this document\'s list - nothing was added.';
      setStudioStatus(duplicateStatus, 'ok');
      tool.notify('These images are already in the list - nothing was added.', 'info');
      if (onDone) onDone();
      return;
    }
    persistStudioImages();
    renderStudyDocImageGallery();
    renderPdfEditorList();
    var status = '✅ Extracted ' + addedImageCount + ' new image(s).';
    if (duplicateImageCount) status += ' ' + duplicateImageCount + ' already in the list (not added again).';
    if (skippedNotes.length) {
      var uniqueSkipReasons = [];
      for (var noteIndex = 0; noteIndex < skippedNotes.length; noteIndex++) {
        if (uniqueSkipReasons.indexOf(skippedNotes[noteIndex]) === -1) uniqueSkipReasons.push(skippedNotes[noteIndex]);
      }
      status += ' Skipped ' + skippedNotes.length + ' (' + uniqueSkipReasons.slice(0, 3).join('; ') + ').';
    }
    if (lastPdfScanInfo.masksSkipped) status += ' Ignored ' + lastPdfScanInfo.masksSkipped + ' soft mask(s).';
    setStudioStatus(status, 'ok');
    tool.notify(status, 'success');
    // Upload the extracted images one by one so the document stores hosted URLs.
    uploadUnhostedStudioImages(function(uploadedCount) {
      if (uploadedCount > 0) {
        setStudioStatus('✅ Extracted ' + addedImageCount + ' image(s) and uploaded ' + uploadedCount + ' to CMS storage.', 'ok');
      }
      if (onDone) onDone();
    });
  });
}

/** Button handler: capture the pictures of the open document. */
function extractStudyDocImages(onDone) {
  // Guard against being bound directly to a click handler (the event object
  // would otherwise arrive here as "onDone").
  if (typeof onDone !== 'function') onDone = null;
  captureDocumentPictures(onDone);
}

/* ── Studio generation: AI rewrites the document into raw HTML ── */
function buildStudioHtmlPrompt(sourceText, imageCount) {
  var prompt = 'You are an expert educational content editor. REPHRASE the document below into clean, well-structured HTML for a study guide. This is a rewriting step - the result is raw course content that will be edited and styled later.\n\n' +
    'OUTPUT RULES (strict):\n' +
    '- Return ONLY the HTML fragment: no markdown, no code fences, no JSON, no explanations, no <html>/<head>/<body> wrapper.\n' +
    '- Start with an <h1> title that you rewrite from the document, then use <h2>/<h3> sections, <p>, <ul>/<ol>/<li>, <table>/<thead>/<tbody>/<tr>/<th>/<td>, <blockquote>, <strong>, <em> and <figure>/<figcaption>.\n' +
    '- Never copy sentences verbatim - rewrite everything in your own words while keeping every fact, number, rule and term exact.\n' +
    '- Keep the full content of the document (do not summarize it away) and keep a logical reading order.\n' +
    '- Do not add styling attributes, classes, scripts or inline CSS - semantic HTML only.\n' +
    '- Use proper text for headings and lists; do not wrap whole paragraphs in <div>.\n';
  if (imageCount > 0) {
    prompt += '\nIMAGES: the document has ' + imageCount + ' image(s). Use the exact placeholder tokens below as image sources, for example: <figure><img src="{{IMG0}}" alt="short description"><figcaption>caption</figcaption></figure>. Place an image exactly where the document discusses that figure, chart, diagram or screenshot. Use each placeholder at most once and only where it belongs.\n';
    for (var imageIndex = 0; imageIndex < imageCount; imageIndex++) {
      var imageLabel = (editingStudyDocImages[imageIndex] && editingStudyDocImages[imageIndex].name) ? editingStudyDocImages[imageIndex].name : ('image-' + (imageIndex + 1));
      prompt += '{{IMG' + imageIndex + '}} = ' + imageLabel + '\n';
    }
  } else {
    prompt += '\nIMAGES: none available - do not add <img> tags.\n';
  }
  prompt += '\nDocument:\n"""\n' + sourceText + '\n"""\n\nRETURN THE HTML NOW (start with <h1>):';
  return prompt;
}

/** Swap {{IMG0}} tokens for real image URLs (string level - raw HTML) */
function replaceStudioImageTokens(htmlText) {
  var replacedHtml = String(htmlText || '');
  for (var imageIndex = 0; imageIndex < editingStudyDocImages.length; imageIndex++) {
    var imageUrl = imageSrcForGeneratedContent(editingStudyDocImages[imageIndex]);
    if (!imageUrl) continue;
    var tokenPatterns = ['{{IMG' + imageIndex + '}}', '{{ IMG' + imageIndex + ' }}', '[[IMG' + imageIndex + ']]', 'IMG:' + imageIndex];
    for (var tokenIndex = 0; tokenIndex < tokenPatterns.length; tokenIndex++) {
      replacedHtml = replacedHtml.split(tokenPatterns[tokenIndex]).join(imageUrl);
    }
  }
  // Remove leftover placeholders so they can never show up in the lesson.
  replacedHtml = replacedHtml.replace(/\{\{\s*IMG\s*\d+\s*\}\}/g, '').replace(/\[\[\s*IMG\s*\d+\s*\]\]/g, '');
  return replacedHtml;
}

/** Count image tags in generated raw HTML */
function countHtmlImages(htmlText) {
  var imageMatches = String(htmlText || '').match(/<img\b/gi);
  return imageMatches ? imageMatches.length : 0;
}

var studioPreviewCss = '<style>body{font-family:system-ui,sans-serif;font-size:15px;color:#1e293b;line-height:1.8;padding:20px;max-width:900px;margin:0 auto}.study-guide{line-height:1.8}img{max-width:100%;border-radius:8px}.sg-heading{font-size:22px;font-weight:800;color:#3730a3;margin:32px 0 14px;padding-bottom:10px;border-bottom:2px solid #eef2ff}.sg-hero{text-align:center;padding:32px 24px;background:linear-gradient(135deg,#eef2ff,#f0f4ff);border-radius:16px;margin-bottom:28px;border:1px solid #818cf8}.sg-q-radio{position:absolute;opacity:0;pointer-events:none;width:0;height:0}.sg-q-opt{display:block;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;margin-bottom:6px;background:#fafbfc}.sg-q-radio:checked+.sg-q-opt{border-color:#4f46e5;background:#eef2ff;font-weight:600}.sg-q-feedback{display:none;margin-top:12px;padding:14px 16px;background:#d1fae5;border:1px solid #6ee7b7;border-radius:12px}.sg-q-correct:checked~.sg-q-feedback{display:block}@keyframes sgSpotlight{0%,100%{box-shadow:0 0 10px rgba(79,70,229,.15)}50%{box-shadow:0 0 25px rgba(79,70,229,.35)}}.sg-spotlight{animation:sgSpotlight 2.5s ease-in-out infinite}</style>';

/* ── Local PDF text extraction (approximate, browser-only) ── */

/** Decode a PDF literal string (byte string) into readable text */
function decodePdfTextBytes(literal) {
  if (!literal) return '';
  if (literal.length >= 2) {
    var firstByte = literal.charCodeAt(0);
    var secondByte = literal.charCodeAt(1);
    if (firstByte === 0xFE && secondByte === 0xFF) {
      var bigEndianText = '';
      for (var beIndex = 2; beIndex + 1 < literal.length; beIndex += 2) {
        bigEndianText += String.fromCharCode((literal.charCodeAt(beIndex) << 8) | literal.charCodeAt(beIndex + 1));
      }
      return bigEndianText;
    }
    if (firstByte === 0xFF && secondByte === 0xFE) {
      var littleEndianText = '';
      for (var leIndex = 2; leIndex + 1 < literal.length; leIndex += 2) {
        littleEndianText += String.fromCharCode(literal.charCodeAt(leIndex) | (literal.charCodeAt(leIndex + 1) << 8));
      }
      return littleEndianText;
    }
  }
  var cp1252Special = {
    0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰',
    0x8A: 'Š', 0x8B: '‹', 0x8C: 'Œ', 0x8E: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•',
    0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9A: 'š', 0x9B: '›', 0x9C: 'œ', 0x9E: 'ž', 0x9F: 'Ÿ'
  };
  var decodedText = '';
  for (var charIndex = 0; charIndex < literal.length; charIndex++) {
    var byteValue = literal.charCodeAt(charIndex);
    decodedText += cp1252Special[byteValue] || String.fromCharCode(byteValue);
  }
  return decodedText;
}

/** Pull literal text strings out of one PDF content stream */
function extractTextFromPdfContentStream(content) {
  var outputText = '';
  var contentIndex = 0;
  var contentLength = content.length;
  while (contentIndex < contentLength) {
    var currentChar = content.charAt(contentIndex);
    if (currentChar === '(') {
      var nestDepth = 1;
      contentIndex++;
      var literalText = '';
      while (contentIndex < contentLength && nestDepth > 0) {
        var literalChar = content.charAt(contentIndex);
        if (literalChar === '\\') {
          var escapedChar = content.charAt(contentIndex + 1);
          if (escapedChar === 'n') { literalText += '\n'; contentIndex += 2; }
          else if (escapedChar === 'r') { literalText += '\r'; contentIndex += 2; }
          else if (escapedChar === 't') { literalText += '\t'; contentIndex += 2; }
          else if (escapedChar === 'b' || escapedChar === 'f') { contentIndex += 2; }
          else if (escapedChar === '(' || escapedChar === ')' || escapedChar === '\\') { literalText += escapedChar; contentIndex += 2; }
          else if (/[0-7]/.test(escapedChar)) {
            var octalDigits = escapedChar;
            contentIndex += 2;
            for (var octalCount = 0; octalCount < 2 && /[0-7]/.test(content.charAt(contentIndex)); octalCount++) {
              octalDigits += content.charAt(contentIndex);
              contentIndex++;
            }
            literalText += String.fromCharCode(parseInt(octalDigits, 8));
          } else { contentIndex += 2; }
        } else if (literalChar === '(') {
          nestDepth++;
          literalText += literalChar;
          contentIndex++;
        } else if (literalChar === ')') {
          nestDepth--;
          if (nestDepth > 0) literalText += literalChar;
          contentIndex++;
        } else { literalText += literalChar; contentIndex++; }
      }
      outputText += decodePdfTextBytes(literalText) + ' ';
    } else if (content.substr(contentIndex, 2) === 'ET' || content.substr(contentIndex, 2) === 'T*') {
      outputText += '\n';
      contentIndex += 2;
    } else if (content.substr(contentIndex, 3) === 'Td ' || content.substr(contentIndex, 3) === 'TD ') {
      outputText += ' ';
      contentIndex += 3;
    } else {
      contentIndex++;
    }
  }
  return outputText;
}

/** True when a PDF carries a font-based text layer at all. Scanned/image-only
 *  PDFs have no font objects, so no reader can extract words from them.
 *  Font dictionaries may be packed inside compressed object streams (/ObjStm). */
function pdfHasTextLayer(pdfBytes) {
  if (!pdfBytes || !pdfBytes.length) return false;
  var pdfSampleText = '';
  try { pdfSampleText = bytesToLatin1String(pdfBytes); } catch (textError) { return false; }
  if (/\/Type\s*\/Font/.test(pdfSampleText)) return true;
  if (/\/FontFile[23]?\b/.test(pdfSampleText)) return true;
  if (/\/Subtype\s*\/(Type1C|Type1|TrueType|OpenType|CIDFontType0|CIDFontType2|CIDFontType0C)\b/.test(pdfSampleText)) return true;
  if (!/\/Type\s*\/ObjStm/.test(pdfSampleText)) return false;
  // Fonts can live inside compressed object streams - inflate them and look.
  var objectStreamPattern = /stream\r?\n/g;
  var objectStreamMatch;
  var scannedObjectStreams = 0;
  while ((objectStreamMatch = objectStreamPattern.exec(pdfSampleText)) !== null && scannedObjectStreams < 40) {
    var objectStreamDictStart = Math.max(0, pdfSampleText.lastIndexOf('obj', objectStreamMatch.index));
    var objectStreamDict = pdfSampleText.substring(objectStreamDictStart, objectStreamMatch.index);
    if (!/\/Type\s*\/ObjStm/.test(objectStreamDict)) continue;
    scannedObjectStreams++;
    var objectStreamDataStart = objectStreamMatch.index + objectStreamMatch[0].length;
    var objectStreamDataEnd = pdfSampleText.indexOf('endstream', objectStreamDataStart);
    if (objectStreamDataEnd < 0) continue;
    var inflatedObjectStream = inflatePdfFlateStream(latin1StringToBytes(pdfSampleText.substring(objectStreamDataStart, objectStreamDataEnd)));
    if (!inflatedObjectStream) continue;
    var objectStreamText = bytesToLatin1String(inflatedObjectStream);
    if (/\/BaseFont|\/Type\s*\/Font|\/FontDescriptor/.test(objectStreamText)) return true;
  }
  return false;
}

/** Approximate text extraction from a PDF byte array - no server involved */
function extractPdfTextLocally(pdfBytes) {
  // Image-only scans have nothing to extract - skip the stream walk entirely.
  if (!pdfHasTextLayer(pdfBytes)) return '';
  var pdfText = bytesToLatin1String(pdfBytes);
  var streamPattern = /stream\r?\n([\s\S]*?)endstream/g;
  var textPieces = [];
  var streamMatch;
  var scannedStreams = 0;
  while ((streamMatch = streamPattern.exec(pdfText)) && scannedStreams < 300) {
    scannedStreams++;
    var dictStart = Math.max(0, streamMatch.index - 1200);
    var dictText = pdfText.substring(dictStart, streamMatch.index);
    if (/\/Subtype\s*\/Image/.test(dictText)) continue;
    if (/\/Type\s*\/XRef/.test(dictText)) continue;
    // Embedded font programs are binary and can contain a random "BT" - they
    // are not page content and must never be read as text.
    if (/\/Subtype\s*\/(Type1C|Type1|TrueType|OpenType|CIDFontType0|CIDFontType2)\b/.test(dictText)) continue;
    if (/\/Length1\b|\/FontFile[23]?\b/.test(dictText)) continue;
    var streamBytes = latin1StringToBytes(streamMatch[1]);
    if (/\/FlateDecode/.test(dictText)) {
      var inflatedBytes = inflatePdfFlateStream(streamBytes);
      if (!inflatedBytes) continue;
      streamBytes = inflatedBytes;
    } else if (/\/Filter\s*\/[A-Za-z0-9]+/.test(dictText)) {
      continue; // LZW / ASCII85 / JPX content streams are not supported locally
    }
    var streamContent = bytesToLatin1String(streamBytes);
    if (streamContent.indexOf('BT') === -1) continue;
    var extractedText = extractTextFromPdfContentStream(streamContent);
    if (extractedText && extractedText.replace(/\s+/g, '').length > 20) textPieces.push(extractedText);
  }
  return textPieces.join('\n')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Read the document text: local browser extraction first when bytes are
 *  available, then the downloaded file (large-file channel), then the CMS
 *  text service. */
function readSourceDocumentText(onDone) {
  var sourceUrl = studioCurrentDocUrl;
  var localBytesAvailable = !!(studioLocalPdfBytes && studioLocalPdfUrl === sourceUrl);
  var readablePdfBytes = localBytesAvailable ? studioLocalPdfBytes : null;
  var localText = '';

  /** Deliver the document text, adding OCR text from the gallery pictures
   *  when the document itself carries little text. */
  function deliverSourceText(sourceText, sourceLabel) {
    lastStudioTextSourceLabel = sourceLabel || '';
    var baseText = String(sourceText || '');
    var ocrGalleryEnabled = String(tool.param('ocrGalleryImages', 'yes')).toLowerCase() !== 'no';
    var textIsEnough = baseText.replace(/\s+/g, '').length > 8000;
    if (!ocrEngineAvailable() || !ocrGalleryEnabled || !editingStudyDocImages.length || textIsEnough) {
      onDone(null, baseText.substring(0, 15000), sourceLabel);
      return;
    }
    startStudioStatusTicker('🔍 Reading the text inside the document pictures');
    ocrStudioGalleryImages(function(imageOcrError, imageText, imagesRead) {
      var combinedText = baseText;
      if (imageText) combinedText += '\n\nTEXT RECOGNIZED INSIDE THE DOCUMENT IMAGES:\n' + imageText;
      var combinedLabel = sourceLabel + (imagesRead ? ' + OCR of ' + imagesRead + ' picture(s)' : '');
      onDone(null, combinedText.substring(0, 15000), combinedLabel);
    });
  }
  if (localBytesAvailable) {
    setStudioStatus('📝 Reading the PDF text locally in your browser…', 'busy');
    try { localText = extractPdfTextLocally(studioLocalPdfBytes); } catch (localTextError) { localText = ''; }
    if (localText && localText.replace(/\s+/g, '').length >= 200) {
      deliverSourceText(localText, 'local PDF text (approximate)');
      return;
    }
  }
  function useLocalText(reason) {
    if (localText && localText.replace(/\s+/g, '').length >= 200) {
      deliverSourceText(localText, 'local PDF text (approximate)');
      return;
    }
    // A scanned PDF has no text layer at all - read it with OCR when the CMS
    // injected an OCR engine, otherwise say exactly why it cannot be read.
    if (readablePdfBytes && readablePdfBytes.length && !pdfHasTextLayer(readablePdfBytes)) {
      console.warn('[STUDIO:TEXT] no text layer in ' + sourceUrl + ' - trying client-side OCR');
      if (!ocrEngineAvailable()) {
        onDone(reason + ' This PDF is a scan: its pages are images and it has no text layer. Client-side OCR needs the CMS to inject Tesseract.js for this tool (allowOcr).', '');
        return;
      }
      if (ocrInProgressDocUrl === sourceUrl) return;
      ocrInProgressDocUrl = sourceUrl;
      setStudioStatus('🔍 This PDF is a scan - reading it with OCR…', 'busy');
      ocrPdfBytesToText(readablePdfBytes, function(ocrError, ocrText, ocrPagesRead, ocrTotalPages) {
        ocrInProgressDocUrl = '';
        if (!ocrError && ocrText && ocrText.replace(/\s+/g, '').length >= 200) {
          deliverSourceText(ocrText, 'OCR of ' + ocrPagesRead + '/' + ocrTotalPages + ' page(s)');
          return;
        }
        onDone(reason + ' OCR read ' + (ocrText ? ocrText.replace(/\s+/g, '').length + ' character(s)' : 'nothing') +
          ' from this scan' + (ocrError ? ' (' + ocrError + ')' : '') + '.', '');
      });
      return;
    }
    onDone(reason + (localBytesAvailable
      ? ' The local text reader found too little readable text in this PDF.'
      : ' Use "📁 From Local PDF" to read the file in your browser instead.'), '');
  }
  function readThroughCmsTextService(downloadNote) {
    if (typeof tool.requestFileContent !== 'function') {
      useLocalText((downloadNote || '') + ' The CMS text service is not enabled (allowFileContent).');
      return;
    }
    startStudioStatusTicker('⏳ Reading the document text through the CMS service');
    var readFinished = false;
    var readWatchdog = setTimeout(function() {
      if (readFinished) return;
      readFinished = true;
      useLocalText((downloadNote || '') + ' The CMS text service did not respond within 45 seconds.');
    }, 45000);
    tool.requestFileContent(toHostingUrl(sourceUrl), function(readError, fileContent) {
      if (readFinished) return;
      readFinished = true;
      clearTimeout(readWatchdog);
      var documentText = '';
      if (!readError && fileContent) {
        documentText = typeof fileContent === 'string' ? fileContent : (fileContent.text || fileContent.content || '');
      }
      if (documentText && documentText.length > 50) {
        deliverSourceText(String(documentText), 'CMS text service');
        return;
      }
      useLocalText((downloadNote || '') + (readError ? (' The CMS text service failed: ' + readError + '.') : ' The CMS text service returned no text.'));
    });
  }
  // Full-file download: text documents are decoded, PDFs go through the local
  // text extractor - no relay size cap involved.
  var downloadProgress = { loadedBytes: 0, totalBytes: 0 };
  startStudioStatusTicker('⏳ Downloading the document to read its text', function() {
    if (!downloadProgress.loadedBytes) return '';
    return formatFileSize(downloadProgress.loadedBytes) + (downloadProgress.totalBytes ? ' of ' + formatFileSize(downloadProgress.totalBytes) : '');
  });
  fetchDocumentBytes(sourceUrl, {
    purpose: 'text',
    onProgress: function(loadedBytes, totalBytes) {
      downloadProgress.loadedBytes = loadedBytes || 0;
      downloadProgress.totalBytes = totalBytes || 0;
    }
  }, function(fetchError, documentBytes, documentMeta) {
    var downloadedText = '';
    if (!fetchError && documentBytes && documentBytes.length) {
      readablePdfBytes = documentBytes;
      if (isTextDocumentUrl(sourceUrl)) {
        downloadedText = decodeTextBytes(documentBytes);
      } else {
        try { downloadedText = extractPdfTextLocally(documentBytes); } catch (pdfTextError) { downloadedText = ''; }
      }
    }
    if (downloadedText && downloadedText.replace(/\s+/g, '').length >= 200) {
      deliverSourceText(downloadedText, (documentMeta && documentMeta.fromLocalFile)
        ? 'local PDF text (approximate)'
        : 'downloaded file (read in your browser)');
      return;
    }
    readThroughCmsTextService(fetchError ? (' ' + describeFileFetchError(fetchError, documentMeta)) : '');
  });
}

function generateStudyGuideFromStudioDoc(onDone) {
  var sourceUrl = studioCurrentDocUrl;
  if (!sourceUrl) {
    tool.notify('Open a document in the Studio drawer first (⚙️ button on any document).', 'warning');
    if (onDone) onDone('no-doc');
    return;
  }
  setStudioActionButtonsBusy(true);
  startStudioStatusTicker('⏳ Reading the document text… (step 1 of 2)');
  var genStatusEl = el('sd-gen-status');
  if (genStatusEl) genStatusEl.textContent = '⏳ reading…';
  var streamPreviewFrame = el('sd-gen-preview');
  if (streamPreviewFrame) streamPreviewFrame.srcdoc = '';
  readSourceDocumentText(function(readError, sourceText, textSourceLabel) {
    if (readError || !sourceText) {
      setStudioActionButtonsBusy(false);
      setStudioStatus('❌ ' + (readError || 'Could not read the document text.'), 'warn');
      if (genStatusEl) genStatusEl.textContent = '';
      tool.notify(readError || 'Could not read the document text.', 'error');
      if (onDone) onDone(readError || 'read-error');
      return;
    }
    var prompt = buildStudioHtmlPrompt(sourceText, editingStudyDocImages.length);
    var fullResponse = '';
    var streamedCharacters = 0;
    var streamFinished = false;
    var lastPreviewRenderedAt = 0;
    // Raw HTML rewriting of a long document can take many minutes - allow 15.
    var streamWatchdog = setTimeout(function() {
      if (streamFinished) return;
      streamFinished = true;
      setStudioActionButtonsBusy(false);
      setStudioStatus('❌ The AI did not finish within 15 minutes. Nothing was replaced - try again.', 'warn');
      if (genStatusEl) genStatusEl.textContent = '';
      tool.notify('AI generation timed out. Try again.', 'error');
      if (onDone) onDone('stream-timeout');
    }, 15 * 60 * 1000);
    if (genStatusEl) genStatusEl.textContent = '⏳ writing HTML…';
    startStudioStatusTicker('✨ AI is writing the generated content as HTML (step 2 of 2 · source: ' + textSourceLabel + ')', function() {
      renderStudioHtmlStreamPreview(fullResponse);
      return formatCount(streamedCharacters) + ' characters of HTML';
    });
    tool.requestAIStream(prompt, null, {
      onToken: function(token) {
        if (streamFinished) return;
        fullResponse += token;
        streamedCharacters += token.length;
        if (genStatusEl) genStatusEl.textContent = '⏳ writing HTML… ' + formatCount(streamedCharacters) + ' chars';
        // Throttled live render (~1/second) so the preview grows while the AI writes.
        var previewNow = Date.now();
        if (previewNow - lastPreviewRenderedAt > 900) {
          lastPreviewRenderedAt = previewNow;
          renderStudioHtmlStreamPreview(fullResponse);
        }
      },
      onComplete: function() {
        if (streamFinished) return;
        streamFinished = true;
        clearTimeout(streamWatchdog);
        finishStudioHtmlGeneration(fullResponse, onDone);
      },
      onError: function(streamError) {
        if (streamFinished) return;
        streamFinished = true;
        clearTimeout(streamWatchdog);
        setStudioActionButtonsBusy(false);
        setStudioStatus('❌ Generation failed: ' + streamError, 'warn');
        if (genStatusEl) genStatusEl.textContent = '';
        if (streamPreviewFrame) streamPreviewFrame.srcdoc = '';
        tool.notify('Generation failed: ' + streamError, 'error');
        if (onDone) onDone(streamError);
      }
    });
  });
}

function finishStudioHtmlGeneration(rawResponse, onDone) {
  setStudioActionButtonsBusy(false);
  var genStatusEl = el('sd-gen-status');
  var raw = String(rawResponse).trim()
    .replace(/^```(?:html)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
  // Keep only the HTML fragment when the model wrapped it in prose.
  var firstTag = raw.indexOf('<');
  var lastTag = raw.lastIndexOf('>');
  if (firstTag !== -1 && lastTag > firstTag) raw = raw.substring(firstTag, lastTag + 1);
  if (raw.length < 100) {
    setStudioStatus('❌ The AI returned too little HTML. Nothing was replaced - try again.', 'warn');
    if (genStatusEl) genStatusEl.textContent = '';
    var emptyPreview = el('sd-gen-preview');
    if (emptyPreview) emptyPreview.srcdoc = '';
    tool.notify('The AI returned too little HTML. Try again.', 'error');
    if (onDone) onDone('empty');
    return;
  }
  var generatedHtml = replaceStudioImageTokens(raw);
  // Generated content is its OWN document-level artefact. It is never written
  // into the student Study Content directly - the author promotes it with
  // "⬆ Add to Study Content" when it is good enough.
  var generatedEntry = {
    html: generatedHtml,
    generatedAt: Date.now(),
    sourceLabel: lastStudioTextSourceLabel || '',
    docName: readableFileName(studioCurrentDocUrl)
  };
  if (studioCurrentDocUrl) editingStudyDocGeneratedHtmlMap[studioCurrentDocUrl] = generatedEntry;
  studioGeneratedHtml = generatedHtml;
  renderStudioGeneratedPreview();
  if (genStatusEl) genStatusEl.textContent = '✅ generated · ' + formatCount(generatedHtml.length) + ' chars';
  var imageCount = countHtmlImages(generatedHtml);
  var status = '✅ Generated content saved for this source document (' + formatCount(generatedHtml.length) + ' characters';
  if (imageCount) status += ', ' + imageCount + ' image(s) linked';
  status += '). It is NOT student-facing yet - use “⬆ Add to Study Content” in the Generated tab.';
  if (generatedHtml.length > 700 * 1024) {
    status += ' ⚠️ ' + Math.round(generatedHtml.length / 1024) + ' KB - close to the Firestore 1 MB document limit.';
    setStudioStatus(status, 'warn');
  } else {
    setStudioStatus(status, 'ok');
  }
  autoSaveCurrentLesson();
  tool.notify('Generated content saved for this document (not student-facing yet).', 'success');
  if (onDone) onDone(null);
}

/* ── Image regeneration (needs the CMS image-generation relay) ── */
var STUDIO_IMAGE_STYLES = [
  { key: 'professional', label: '✨ More professional', prompt: 'Make this image look more professional and higher quality than the original while keeping the same content and subject.' },
  { key: 'same', label: '🔒 Same as original', prompt: 'Keep the image as close to the original as possible - it must not look different.' },
  { key: '3d', label: '🧊 3D version', prompt: 'Recreate this image as a polished 3D-style render.' },
  { key: 'colorful', label: '🌈 More colorful', prompt: 'Recreate this image with more vivid, colorful styling.' },
  { key: 'minimal', label: '⬜ Minimal flat', prompt: 'Recreate this image in a clean, minimal flat design style.' },
  { key: 'dark', label: '🌙 Dark theme', prompt: 'Recreate this image with a dark theme color palette.' },
  { key: 'light', label: '☀️ Light theme', prompt: 'Recreate this image with a light, airy color palette.' },
  { key: 'sketch', label: '✏️ Sketch style', prompt: 'Recreate this image as an elegant hand-drawn sketch.' }
];

function studioSelectedImageIndexes() {
  var indexes = [];
  var checkboxes = document.querySelectorAll('#sd-images-grid input[data-sd-select]');
  for (var i = 0; i < checkboxes.length; i++) {
    if (checkboxes[i].checked) indexes.push(parseInt(checkboxes[i].getAttribute('data-sd-select'), 10));
  }
  return indexes;
}

function openStudioRegenerateDialog(imageIndexes) {
  if (!imageIndexes.length) { tool.notify('Select one or more images first (or use the 🎨 button on an image).', 'warning'); return; }
  var chipsHtml = STUDIO_IMAGE_STYLES.map(function(style) {
    return '<button type="button" class="sd-style-chip" data-style="' + style.key + '">' + style.label + '</button>';
  }).join('');
  openStudioModal('🎨 Generate Picture Version' + (imageIndexes.length > 1 ? 's (' + imageIndexes.length + ')' : ''),
    '<div class="sd-modal-builtin" style="margin-bottom:10px">The original picture is kept. The AI result is stored as its Generated version and is what the generated content uses.</div>' +
    '<div class="sd-modal-section"><div class="sd-modal-label">Style helpers (click to set the instruction)</div><div class="sd-style-chips">' + chipsHtml + '</div></div>' +
    '<div class="sd-modal-section"><div class="sd-modal-label">Built-in instruction</div><div class="sd-modal-builtin" id="sd-regen-builtin">' + esc(STUDIO_IMAGE_STYLES[0].prompt) + '</div></div>' +
    '<div class="sd-modal-section"><div class="sd-modal-label">Additional comment (optional)</div><textarea class="form-input form-textarea" id="sd-regen-comment" placeholder="e.g. use the same colors, remove the background, add labels..." style="min-height:70px"></textarea></div>' +
    '<div class="sd-modal-actions"><button type="button" class="btn btn-outline" data-sd-close>Cancel</button><button type="button" class="btn btn-primary" id="sd-regen-run">🚀 Generate</button></div>');
  var builtinPrompt = STUDIO_IMAGE_STYLES[0].prompt;
  var builtinEl = el('sd-regen-builtin');
  var chipButtons = document.querySelectorAll('#sd-modal-body .sd-style-chip');
  for (var c = 0; c < chipButtons.length; c++) {
    chipButtons[c].addEventListener('click', function() {
      var styleKey = this.getAttribute('data-style');
      for (var s = 0; s < STUDIO_IMAGE_STYLES.length; s++) {
        if (STUDIO_IMAGE_STYLES[s].key === styleKey) {
          builtinPrompt = STUDIO_IMAGE_STYLES[s].prompt;
          builtinEl.textContent = builtinPrompt;
          break;
        }
      }
      for (var t = 0; t < chipButtons.length; t++) chipButtons[t].classList.toggle('active', chipButtons[t] === this);
    });
  }
  el('sd-regen-run').addEventListener('click', function() {
    var commentText = el('sd-regen-comment').value.trim();
    var finalPrompt = builtinPrompt + (commentText ? ' ' + commentText : '');
    closeStudioModal();
    runStudioImageRegenerationQueue(imageIndexes.slice(), finalPrompt);
  });
}

function runStudioImageRegenerationQueue(imageIndexes, finalPrompt) {
  if (typeof tool.requestGenerateImage !== 'function') {
    tool.notify('AI image generation is not enabled on this host - requestGenerateImage needs allowImageGeneration: yes in the field settings. The compare-and-select UI is ready and works as soon as the host enables it.', 'warning');
    return;
  }
  var queue = imageIndexes.slice();
  var queueTotal = queue.length;
  function processQueueItem() {
    if (!queue.length) {
      setStudioStatus('', '');
      tool.notify('✅ Picture generation finished.', 'success');
      renderStudyDocImageGallery();
      return;
    }
    var imageIndex = queue.shift();
    var originalImage = editingStudyDocImages[imageIndex];
    if (!originalImage) { processQueueItem(); return; }
    startStudioStatusTicker('🎨 AI is generating picture version ' + (queueTotal - queue.length) + ' of ' + queueTotal + ' (this can take up to 60 seconds)');
    // Hosted images have no embedded data URL - fetch the bytes for image-to-image.
    resolveStudioImageDataUrl(originalImage, function(baseImageDataUrl) {
      var generateOptions = { prompt: finalPrompt };
      if (baseImageDataUrl) generateOptions.baseImageDataUrl = baseImageDataUrl;
      tool.requestGenerateImage(generateOptions, function(generateError, generateResult) {
        if (generateError || !generateResult || !generateResult.dataUrl) {
          setStudioStatus('', '');
          tool.notify('Picture generation failed: ' + (generateError || 'empty result'), 'error');
          processQueueItem();
          return;
        }
        setStudioStatus('', '');
        openStudioImageCompare(imageIndex, generateResult.dataUrl, function(decision) {
          if (decision === 'again') queue.unshift(imageIndex);
          if (decision === 'use') {
            // The original picture is never overwritten: the AI result becomes its
            // GENERATED version, which is what the generated content uses.
            applyGeneratedVersionToStudioImage(imageIndex, generateResult.dataUrl, finalPrompt);
            renderPdfEditorList();
          }
          processQueueItem();
        });
      });
    });
  }
  processQueueItem();
}

function openStudioImageCompare(imageIndex, newDataUrl, decideCallback) {
  var originalImage = editingStudyDocImages[imageIndex];
  if (!originalImage) { decideCallback('keep'); return; }
  var bodyHtml = '<div class="sd-compare">' +
    '<div class="sd-compare-side"><div class="sd-compare-label">Original (kept)</div><img src="' + imageContentSrc(originalImage) + '" alt="Original"></div>' +
    '<div class="sd-compare-side"><div class="sd-compare-label">AI generated version</div><img src="' + newDataUrl + '" alt="Generated"></div>' +
    '</div>' +
    '<div class="sd-modal-builtin" style="margin-top:10px">Using the generated version keeps the original picture and adds it to the gallery as the Generated version. Generated content will use the generated version.</div>' +
    '<div class="sd-modal-actions"><button type="button" class="btn btn-outline" data-sd-decide="again">🔄 Regenerate Again</button><button type="button" class="btn btn-outline" data-sd-decide="keep">↩ Keep Original Only</button><button type="button" class="btn btn-primary" data-sd-decide="use">✅ Use Generated Version</button></div>';
  openStudioModal('🔍 Compare: ' + esc(originalImage.name), bodyHtml);
  var decideButtons = document.querySelectorAll('#sd-modal-body [data-sd-decide]');
  for (var b = 0; b < decideButtons.length; b++) {
    decideButtons[b].addEventListener('click', function() {
      var decision = this.getAttribute('data-sd-decide');
      closeStudioModal();
      decideCallback(decision);
    });
  }
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
   EVENT BINDINGS
   ═══════════════════════════════════════════ */

function bindEvents() {
  el('btn-add-section').addEventListener('click', function() { openSectionEditor(null, null); });
  var btnGenAllCurr = el('btn-generate-all-curriculum');
  if (btnGenAllCurr) {
    btnGenAllCurr.addEventListener('click', function() {
      sandboxConfirm('🚀 Generate the missing AI content (Study Content, Slides, Flashcards, Quiz) for the ENTIRE curriculum? It runs the four generators one after another over every lesson and may take a long time. Lessons that already have content are skipped.', function() { startBulkForCurriculum(); }, 'Yes, Generate');
    });
  }
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
  var btnPdfEditorDelete = el('btn-pdf-editor-delete');
  if (btnPdfEditorDelete) btnPdfEditorDelete.addEventListener('click', deletePdfFromEditor);
  var pdfRoleSwitch = el('edit-pdf-item-role');
  if (pdfRoleSwitch) {
    pdfRoleSwitch.addEventListener('change', function() {
      var stateEl = el('pdf-editor-role-state');
      var visGroup = el('pdf-editor-vis-group');
      var roleHint = el('pdf-editor-role-hint');
      if (stateEl) stateEl.textContent = this.checked ? 'Ready' : 'Sample';
      if (visGroup) visGroup.style.display = this.checked ? '' : 'none';
      if (roleHint) roleHint.textContent = this.checked
        ? 'Ready = your own processed file, shown to students and used for AI content generation in the other tabs.'
        : 'Sample = an outside document used only as the input for creating your own Ready document. It is never shown to students.';
    });
  }
  var pdfVisSwitch = el('edit-pdf-item-vis');
  if (pdfVisSwitch) {
    pdfVisSwitch.addEventListener('change', function() {
      var stateEl = el('pdf-editor-vis-state');
      if (stateEl) stateEl.textContent = this.checked ? 'Visible' : 'Hidden';
    });
  }

  // Study Document Studio buttons (all guarded - the drawer markup may be
  // absent in stale harness snapshots).
  var btnUploadDocument = el('btn-upload-document');
  if (btnUploadDocument) btnUploadDocument.addEventListener('click', openUploadDocumentDialog);
  var btnAddDocument = el('btn-add-document');
  if (btnAddDocument) btnAddDocument.addEventListener('click', function() { openPdfEditor('studyDoc', null); });
  var btnSdAddImage = el('btn-sd-add-image');
  if (btnSdAddImage) btnSdAddImage.addEventListener('click', addStudyDocImageDirectly);
  arrangeStudioDrawerLayout();
  var btnSdGenerateImage = el('btn-sd-generate-image');
  if (btnSdGenerateImage) btnSdGenerateImage.addEventListener('click', openGenerateImageForSelection);
  var curriculumLanguageSelect = el('curriculum-language-select');
  if (curriculumLanguageSelect) {
    curriculumLanguageSelect.addEventListener('change', function() {
      curriculumLanguage = this.value || '';
      syncCurriculumLanguageSelect();
      saveCurriculum();
      tool.notify(curriculumLanguage
        ? 'Curriculum language set to ' + resolveOcrLanguage(curriculumLanguage) + ' - used for OCR by default.'
        : 'Curriculum language cleared - the tool parameter is used for OCR.', 'success');
    });
  }
  var studioOcrLanguageSelect = el('sd-ocr-language');
  if (studioOcrLanguageSelect) {
    studioOcrLanguageSelect.addEventListener('change', function() {
      studioOcrLanguageOverride = this.value || '';
      console.log('[STUDIO:OCR] manual language override: ' + (studioOcrLanguageOverride || '(follow curriculum language)') +
        ' · effective ' + resolveActiveOcrLanguage());
      tool.notify(studioOcrLanguageOverride
        ? 'OCR language for this document: ' + resolveActiveOcrLanguage() + '.'
        : 'OCR language follows the curriculum setting.', 'info');
    });
  }
  var btnSdExtract = el('btn-sd-extract');
  if (btnSdExtract) btnSdExtract.addEventListener('click', function() { extractStudyDocImages(); });
  var btnSdExtractLocal = el('btn-sd-extract-local');
  if (btnSdExtractLocal) btnSdExtractLocal.addEventListener('click', pickAndProcessLocalPdf);
  var btnSdGenerate = el('btn-sd-generate');
  if (btnSdGenerate) {
    btnSdGenerate.addEventListener('click', function() {
      sandboxConfirm('✨ AI-rewrite the open document into a Generated version? The AI rephrases the document into semantic HTML with its image links and saves it as this source document\'s Generated content (nothing student-facing changes). This can take several minutes.', function() {
        generateStudyGuideFromStudioDoc();
      }, 'Yes, Generate');
    });
  }
  var btnSdProcess = el('btn-sd-process');
  if (btnSdProcess) btnSdProcess.addEventListener('click', startDocumentProcessFromDrawer);
  var btnSdOpenDoc = el('btn-sd-open-doc');
  if (btnSdOpenDoc) {
    btnSdOpenDoc.addEventListener('click', function() {
      if (!studioCurrentDocUrl) { tool.notify('No document is open.', 'warning'); return; }
      tool.openUrl(studioCurrentDocUrl);
    });
  }
  var btnSdDownloadPdf = el('btn-sd-download-pdf');
  if (btnSdDownloadPdf) btnSdDownloadPdf.addEventListener('click', downloadOpenPdf);
  var btnSdMakeRole = el('btn-sd-make-role');
  if (btnSdMakeRole) btnSdMakeRole.addEventListener('click', toggleStudioDocRole);
  var btnSdDrawerClose = el('btn-sd-drawer-close');
  if (btnSdDrawerClose) btnSdDrawerClose.addEventListener('click', closeStudioDrawer);
  var studioBackdrop = el('sd-studio-backdrop');
  if (studioBackdrop) studioBackdrop.addEventListener('click', closeStudioDrawer);
  var btnLessonDrawerClose = el('btn-lesson-drawer-close');
  if (btnLessonDrawerClose) btnLessonDrawerClose.addEventListener('click', cancelLessonEditor);
  var btnSdSelectAll = el('btn-sd-select-all');
  if (btnSdSelectAll) {
    btnSdSelectAll.addEventListener('click', function() {
      var checkboxes = document.querySelectorAll('#sd-images-grid input[data-sd-select]');
      var allChecked = true;
      for (var allIdx = 0; allIdx < checkboxes.length; allIdx++) {
        if (!checkboxes[allIdx].checked) { allChecked = false; break; }
      }
      for (var cbIdx = 0; cbIdx < checkboxes.length; cbIdx++) checkboxes[cbIdx].checked = !allChecked;
    });
  }
  var btnSdCompare = el('btn-sd-compare');
  if (btnSdCompare) btnSdCompare.addEventListener('click', toggleStudioCompareMode);
  var btnSdTabDocument = el('btn-sd-tab-document');
  if (btnSdTabDocument) btnSdTabDocument.addEventListener('click', function() { switchStudioTab('document'); });
  var btnSdTabContent = el('btn-sd-tab-content');
  if (btnSdTabContent) btnSdTabContent.addEventListener('click', function() { switchStudioTab('content'); });
  var btnSdTabPictures = el('btn-sd-tab-pictures');
  if (btnSdTabPictures) btnSdTabPictures.addEventListener('click', function() { switchStudioTab('pictures'); });
  var btnSdQuality = el('btn-sd-quality');
  if (btnSdQuality) btnSdQuality.addEventListener('click', runStudyContentQualityCheck);
  var btnSdPublish = el('btn-sd-publish');
  if (btnSdPublish) btnSdPublish.addEventListener('click', function() { publishGeneratedToStudyContent('add'); });
  var btnSdReplaceStudy = el('btn-sd-replace-study');
  if (btnSdReplaceStudy) {
    btnSdReplaceStudy.addEventListener('click', function() {
      sandboxConfirm('Replace the lesson Study Content with this Generated content? The current student-facing content is overwritten.', function() {
        publishGeneratedToStudyContent('replace');
      }, 'Yes, Replace');
    });
  }
  // Drawings and vector illustrations can only be captured as screenshots:
  // paste one with Ctrl+V while the Studio drawer is open.
  document.addEventListener('paste', handleStudioImagePaste);

  // Gallery delegation (view large, regenerate, remove)
  var studioImagesGrid = el('sd-images-grid');
  if (studioImagesGrid) {
    studioImagesGrid.addEventListener('click', function(event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var viewTarget = target.closest('[data-sd-view]');
      if (viewTarget) { openStudioImageView(parseInt(viewTarget.getAttribute('data-sd-view'), 10)); return; }
      var regenTarget = target.closest('[data-sd-regen]');
      if (regenTarget) { openStudioRegenerateDialog([parseInt(regenTarget.getAttribute('data-sd-regen'), 10)]); return; }
      var roleTarget = target.closest('[data-sd-role]');
      if (roleTarget) { toggleStudioImageRole(parseInt(roleTarget.getAttribute('data-sd-role'), 10)); return; }
      var versionTarget = target.closest('[data-sd-version]');
      if (versionTarget) {
        setStudioImageVersion(parseInt(versionTarget.getAttribute('data-sd-version'), 10), versionTarget.getAttribute('data-version'));
        return;
      }
      var removeTarget = target.closest('[data-sd-remove]');
      if (removeTarget) {
        var removeImageIndex = parseInt(removeTarget.getAttribute('data-sd-remove'), 10);
        var removeImageName = editingStudyDocImages[removeImageIndex] ? editingStudyDocImages[removeImageIndex].name : 'this image';
        sandboxConfirm('Remove "' + removeImageName + '" from this document\'s image gallery? Study content already generated keeps its own embedded copy and is not affected.', function() {
          editingStudyDocImages.splice(removeImageIndex, 1);
          studioImagePreviewVersion = {};
          persistStudioImages();
          renderStudyDocImageGallery();
          renderPdfEditorList();
          tool.notify('Image removed from this document.', 'info');
        }, 'Yes, Remove');
      }
    });
  }

  var pdfAddBtns = document.querySelectorAll('[data-add-pdf]');
  for (var pa = 0; pa < pdfAddBtns.length; pa++) {
    pdfAddBtns[pa].addEventListener('click', function() { openPdfEditor(this.getAttribute('data-add-pdf'), null); });
  }

  var btnGenQuiz = el('btn-generate-quiz-from-pdf');
  if (btnGenQuiz) {
    btnGenQuiz.addEventListener('click', function() {
      sandboxConfirm('🤖 Generate 15 quiz questions with AI from your Ready documents? The AI reads the documents and replaces the current questions. It may take about a minute.', function() { generateQuizFromPdf(); }, 'Yes, Generate');
    });
  }
  var btnGen2 = el('btn-generate-quiz-from-pdf-2');
  if (btnGen2) {
    btnGen2.addEventListener('click', function() {
      sandboxConfirm('🤖 Generate 15 quiz questions with AI from your Ready documents? The AI reads the documents and replaces the current questions. It may take about a minute.', function() { generateQuizFromPdf(); }, 'Yes, Generate');
    });
  }
  var btnGenHtmlV2 = el('btn-generate-html-from-pdf-v2');
  if (btnGenHtmlV2) {
    btnGenHtmlV2.addEventListener('click', function() {
      sandboxConfirm('🤖 Generate the study guide with AI from your Ready documents? The AI reads the documents and replaces the current lesson Study Content. It may take a few minutes.', function() { generateHtmlFromPdf(); }, 'Yes, Generate');
    });
  }
  var btnGenFlashcards = el('btn-generate-flashcards');
  if (btnGenFlashcards) {
    btnGenFlashcards.addEventListener('click', function() {
      sandboxConfirm('🃏 Generate flashcards with AI from your Ready documents? The AI reads the documents and replaces the current flashcards. It may take about a minute.', function() { generateFlashcardsFromPdf(); }, 'Yes, Generate');
    });
  }
  var btnGenFlashcardsV2 = el('btn-generate-flashcards-v2');
  if (btnGenFlashcardsV2) {
    btnGenFlashcardsV2.addEventListener('click', function() {
      sandboxConfirm('🃏 Generate flashcards with AI from your Ready documents? The AI reads the documents and replaces the current flashcards. It may take about a minute.', function() { generateFlashcardsFromPdf(); }, 'Yes, Generate');
    });
  }
  var btnGenPres = el('btn-generate-presentation');
  if (btnGenPres) {
    btnGenPres.addEventListener('click', function() {
      sandboxConfirm('🎞️ Generate the presentation slides with AI from your Ready documents? The AI reads the documents and replaces the current presentation. It may take about a minute.', function() { generatePresentationFromPdf(); }, 'Yes, Generate');
    });
  }

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

  // IMPORTANT: capture the callback BEFORE hideConfirm() - hideConfirm resets
  // _confirmCallback, so reading it afterwards would always be null.
  el('btn-confirm-yes').addEventListener('click', function() {
    var confirmedCallback = _confirmCallback;
    hideConfirm();
    if (confirmedCallback) confirmedCallback();
  });
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
      var studioDrawer = el('sd-studio-drawer');
      if (studioDrawer && studioDrawer.classList.contains('sd-drawer-open')) { closeStudioDrawer(); return; }
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

var curriculumToolStarted = false;

function startCurriculumTool(val, fields) {
  if (curriculumToolStarted) return;
  curriculumToolStarted = true;
  console.log('[TOOL:READY] onReady fired · value type: ' + (val === null ? 'null' : typeof val));
  if (el('tool-build-badge')) el('tool-build-badge').textContent = 'tool build ' + TOOL_BUILD;
  setTimeout(function() {
    if (el('loading-overlay').style.display !== 'none') {
      el('loading-overlay').style.display = 'none';
    }
  }, 12000);

  tool.declareParams([
    { name: 'builderObjectId', label: 'contentId (for display)', type: 'text', default: '', severity: 'goodToHave', hint: 'Optional: set to this CMS object\'s contentId. Displays in header for copying to the Student tool\'s curriculumSourceId.' },
    { name: 'managerRole', label: 'Manager Role(s)', type: 'text', default: 'admin,editor', severity: 'goodToHave', hint: 'Comma-separated roles that can manage the curriculum.' },
    { name: 'lessonDocUrlTemplate', label: 'Lesson Doc URL Template', type: 'text', default: '', severity: 'optional', hint: 'URL template for opening lesson Firestore docs. Use __ID__ for lessonDocId, __TYPE__ for object type, __ORIGIN__ for the tenant subdomain origin (auto-detected). Leave empty for the default: <tenant origin>/admin/objects/<type>/<id>.' },
    { name: 'tenantBaseUrl', label: 'Tenant Base URL', type: 'text', default: '', severity: 'optional', hint: 'Optional fallback for doc links when the tenant subdomain cannot be auto-detected from the parent page. Example: https://yourtenant.uniconbase.com' },
    { name: 'pdfPreviewScale', label: 'PDF Preview Quality', type: 'text', default: '1.2', severity: 'optional', hint: 'Optional page-render scale for the in-tool preview: 1.0 = normal, 1.2 = default, 1.5 = sharper but slower. The PDF.js worker and library are provided by the CMS - no other PDF setting is needed.' },
    { name: 'pdfPageImageScale', label: 'Picture Capture Scale', type: 'text', default: '2', severity: 'optional', hint: 'Render scale used by "🖼 Get Pictures" when it looks for drawings/illustrations on each page (2 = 200%).' },
    { name: 'pdfPageImageMaxPages', label: 'Picture Capture Page Limit', type: 'text', default: '20', severity: 'optional', hint: 'Maximum number of pages "🖼 Get Pictures" inspects for drawings/illustrations.' },
    { name: 'ocrLanguage', label: 'OCR Language', type: 'select', default: 'eng', severity: 'optional', options: [
      { value: 'eng', label: 'English (eng)' },
      { value: 'tur', label: 'Turkish (tur)' },
      { value: 'deu', label: 'German (deu)' },
      { value: 'fra', label: 'French (fra)' },
      { value: 'spa', label: 'Spanish (spa)' },
      { value: 'ita', label: 'Italian (ita)' },
      { value: 'por', label: 'Portuguese (por)' },
      { value: 'nld', label: 'Dutch (nld)' },
      { value: 'rus', label: 'Russian (rus)' },
      { value: 'ara', label: 'Arabic (ara)' },
      { value: 'fas', label: 'Persian (fas)' },
      { value: 'urd', label: 'Urdu (urd)' },
      { value: 'hin', label: 'Hindi (hin)' },
      { value: 'chi_sim', label: 'Chinese Simplified (chi_sim)' },
      { value: 'chi_tra', label: 'Chinese Traditional (chi_tra)' },
      { value: 'jpn', label: 'Japanese (jpn)' },
      { value: 'kor', label: 'Korean (kor)' },
      { value: 'ell', label: 'Greek (ell)' },
      { value: 'heb', label: 'Hebrew (heb)' },
      { value: 'pol', label: 'Polish (pol)' },
      { value: 'ukr', label: 'Ukrainian (ukr)' },
      { value: 'ron', label: 'Romanian (ron)' },
      { value: 'bul', label: 'Bulgarian (bul)' },
      { value: 'srp', label: 'Serbian (srp)' },
      { value: 'aze', label: 'Azerbaijani (aze)' },
      { value: 'kaz', label: 'Kazakh (kaz)' },
      { value: 'eng+tur', label: 'English + Turkish (eng+tur)' },
      { value: 'eng+deu', label: 'English + German (eng+deu)' },
      { value: 'eng+ara', label: 'English + Arabic (eng+ara)' }
    ], hint: 'Tesseract language file code (ISO 639-2, e.g. eng / tur / deu). 2-letter input such as en or tr is converted automatically. Only languages the CMS hosts in its tessdata folder can be used - a missing language file fails even if selected here.' },
    { name: 'ocrMaxPages', label: 'OCR Page Limit', type: 'text', default: '8', severity: 'optional', hint: 'How many pages to OCR from the start of a scanned PDF before generating content.' },
    { name: 'ocrPageScale', label: 'OCR Render Scale', type: 'text', default: '2', severity: 'optional', hint: 'Page render scale used before OCR (2 = 200%: better accuracy, slower).' },
    { name: 'ocrWorkerPath', label: 'OCR Worker Path', type: 'text', default: '', severity: 'optional', hint: 'Set by the CMS when it hosts Tesseract.js (same origin). Leave empty when the CMS passes it automatically.' },
    { name: 'ocrCorePath', label: 'OCR Core Path', type: 'text', default: '', severity: 'optional', hint: 'Set by the CMS when it hosts Tesseract.js (same origin). Leave empty when the CMS passes it automatically.' },
    { name: 'ocrLanguagePath', label: 'OCR Language Path', type: 'text', default: '', severity: 'optional', hint: 'Same-origin folder that holds the tesseract language files (eng.traineddata.gz, tur.traineddata.gz...). Set by the CMS.' },
    { name: 'ocrGalleryImages', label: 'OCR Document Pictures', type: 'text', default: 'yes', severity: 'optional', hint: 'Read the text inside the document pictures too when the document itself has little text. Set to no to skip.' },
    { name: 'ocrImageMaxCount', label: 'OCR Picture Limit', type: 'text', default: '4', severity: 'optional', hint: 'Maximum number of gallery pictures OCRed per generation run.' }
  ]);

  updateIdBadge();

  // onReady can deliver an empty value while the record exists - prefer a
  // direct read (the authoritative record) before the first render.
  var bootValue = val;
  if (!valueHasCurriculumSections(bootValue)) {
    var directBootValue = readCurriculumValueFromCms();
    if (directBootValue.hasSections) {
      console.warn('[TOOL:READY] onReady delivered no sections - using the value read from tool.getValue() instead');
      bootValue = directBootValue.value;
    }
  }

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

  // Never let an event-binding problem hide the data: the curriculum is
  // rendered even when one of the bindings fails.
  try {
    bindEvents();
  } catch (bindError) {
    console.error('[TOOL:BOOT] bindEvents failed - the curriculum will still be rendered:', bindError);
  }
  if (tool.isReadOnly()) {
    el('app').innerHTML = '<div style="text-align:center;padding:60px 20px"><div class="empty-icon">🔒</div><div class="empty-title">Read-Only Mode</div><div class="empty-desc">This tool is in read-only mode. Switch to edit mode to manage the curriculum.</div></div>';
    tool.resize();
    return;
  }

  tool.onReadonlyChange(function(ro) { if (ro) tool.notify('Read-only mode active. Switch to edit mode.', 'warning'); });

  try {
    loadCurriculum(bootValue);
  } catch (bootLoadError) {
    console.error('[TOOL:BOOT] loadCurriculum failed:', bootLoadError);
    showCurriculumLoadFailure(bootLoadError);
  }
  // Give the value-change subscription a second chance in case the SDK
  // rejected it at file start (the guarded attach never subscribes twice).
  attachEarlyCmsListeners();
  if (earlyCmsHandshake.valueChangeSeen && earlyCmsHandshake.lastValue !== undefined) {
    // A value change arrived while this script was still loading - apply it
    // now that the entry point has run.
    applyCurriculumValueFromCms(earlyCmsHandshake.lastValue);
  }
}

/** Load a value pushed by the CMS after the entry point already ran */
function applyCurriculumValueFromCms(cmsValue) {
  try {
    loadCurriculum(cmsValue);
  } catch (changeLoadError) {
    console.error('[TOOL:BOOT] loadCurriculum failed after a value change:', changeLoadError);
    showCurriculumLoadFailure(changeLoadError);
  }
}

/** If the CMS never delivers onReady, read the value directly so the tool
 *  still renders instead of staying on an empty loading screen. */
function startCurriculumValueWatchdog() {
  var waitedMs = 0;
  var pollIntervalMs = 1500;
  var maxWaitMs = 60000;
  console.log('[TOOL:WAIT] waiting for the CMS value · build ' + TOOL_BUILD);
  var watchdogTimer = setInterval(function() {
    if (curriculumToolStarted) { clearInterval(watchdogTimer); return; }
    waitedMs += pollIntervalMs;
    var polledValue = null;
    try {
      if (typeof tool !== 'undefined' && tool && typeof tool.getValue === 'function') polledValue = tool.getValue();
    } catch (pollError) {
      console.warn('[TOOL:WAIT] tool.getValue() failed:', pollError);
    }
    var polledCurriculum = polledValue ? normalizeCurriculumValue(polledValue) : null;
    if (polledCurriculum && Array.isArray(polledCurriculum.sections)) {
      console.warn('[TOOL:WAIT] onReady did not arrive - rendering the value read from tool.getValue() after ' + waitedMs + ' ms');
      startCurriculumTool(polledValue, null);
      clearInterval(watchdogTimer);
      return;
    }
    var waitingBadge = el('tool-build-badge');
    if (waitingBadge) waitingBadge.textContent = 'build ' + TOOL_BUILD + ' · CMS value not received (' + Math.round(waitedMs / 1000) + 's)';
    if (waitedMs === 6000) {
      console.warn('[TOOL:WAIT] no CMS value after 6 s · build ' + TOOL_BUILD + ' · the tool will stay empty until the CMS sends the record');
      var loadingOverlay = el('loading-overlay');
      if (loadingOverlay && loadingOverlay.style.display !== 'none') loadingOverlay.style.display = 'none';
    }
    if (waitedMs >= maxWaitMs) {
      clearInterval(watchdogTimer);
      console.warn('[TOOL:WAIT] no CMS value after ' + maxWaitMs + ' ms - starting the tool anyway; the value guardian keeps reading tool.getValue()');
      try {
        startCurriculumTool(polledValue, null);
      } catch (lateStartError) {
        console.error('[TOOL:WAIT] starting without a CMS value failed:', lateStartError);
        showCurriculumLoadFailure(lateStartError);
      }
    }
  }, pollIntervalMs);
}

earlyCmsHandshake.readyHandler = startCurriculumTool;
earlyCmsHandshake.valueChangeHandler = function(cmsValue) {
  if (!curriculumToolStarted) return; // replayed by startCurriculumTool
  applyCurriculumValueFromCms(cmsValue);
};

// Fallback: subscribe here too in case the early subscription was impossible.
attachEarlyCmsListeners();

if (earlyCmsHandshake.readySeen) {
  startCurriculumTool(earlyCmsHandshake.readyValue, earlyCmsHandshake.readyFields);
} else {
  startCurriculumValueWatchdog();
}
