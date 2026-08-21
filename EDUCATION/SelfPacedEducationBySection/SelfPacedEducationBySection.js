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
var CONFIG = { curriculumSourceId: '', managementType: 'self_paced', dashboardVisible: false }; // Object-level config (set by admin per object)
var SECTIONS = [];            // Section array from curriculum
var PROGRESS = {};            // { sectionId: { lessonId: { status, score, completedAt, quizAnswers, ... } } }
var currentView = 'sections'; // 'sections' | 'lessons' | 'lesson-detail' | 'setup'
var currentSectionId = null;
var currentLessonId = null;
var quizAnswers = {};
var quizSubmitted = false;
var activeStudyTab = 0;                 // remember which tab is open across re-renders
var _suppressNextValueChange = false;   // skip onValueChange reload after our own save
var _lastSavedJson = null;              // JSON of our last internal save (to tell internal vs external changes apart)
var availableCurriculums = []; // Cached list of Builder objects for the setup picker

/* ── Constants ── */
var SECTIONS_TYPE = 'curriculum-builder-uniconbaseapps';
var LESSON_DOC_TYPE = 'curriculum-lessons-uniconbase';
var MIN_PASS_SCORE = 60;
var QUIZ_SETS = 3;
var QUIZ_PER_SET = 5;
var STUDY_WAIT_MIN = 30;

/* ── Lesson Doc Loader (Phase 2: read heavy content from separate docs) ── */
/** Fetch a lesson's heavy content from its curriculum-lessons-uniconbase doc.
 *  Falls back to the main curriculum doc data if lesson doc is unavailable. */
function loadLessonDocData(lesson, callback) {
  if (!lesson || !lesson.lessonDocId || typeof tool.requestObjects !== 'function') {
    // No lesson doc — use data already in the lesson object (backward compat)
    if (callback) callback(null, lesson);
    return;
  }
  tool.requestObjects('get', {
    mainObjectType: LESSON_DOC_TYPE,
    objectId: lesson.lessonDocId
  }, function(err, result) {
    if (err || !result || !result.object) {
      // Fall back to main doc data, but make the misconfiguration visible.
      if (!window._lessonDocLoadWarned) {
        window._lessonDocLoadWarned = true;
        console.warn('[SelfPaced] lesson doc load failed for "' + lesson.lessonDocId + '":', err);
        tool.notify('⚠️ Could not load the lesson document. Add { "mainObjectType": "curriculum-lessons-uniconbase", "role": "editor", "scope": "shared", "targetCollection": "private" } to this field\'s allowedObjectTypes.', 'warning');
      }
      if (callback) callback(null, lesson);
      return;
    }
    try {
      var pd = result.object.productData;
      var raw = pd && pd.data_categoriesBased && pd.data_categoriesBased.lessonJson;
      var docData = raw ? JSON.parse(raw) : {};
      // Merge: lesson doc data wins, main doc as fallback
      var enriched = JSON.parse(JSON.stringify(lesson));
      if (docData.content !== undefined) enriched.content = docData.content;
      if (docData.htmlCode !== undefined) enriched.htmlCode = docData.htmlCode;
      if (docData.studyHtmlData !== undefined) enriched.studyHtmlData = docData.studyHtmlData;
      if (docData.presentationHtml !== undefined) enriched.presentationHtml = docData.presentationHtml;
      if (docData.flashcards !== undefined) enriched.flashcards = docData.flashcards;
      if (docData.quiz !== undefined) enriched.quiz = docData.quiz;
      if (docData.sourceUrls !== undefined) enriched.sourceUrls = docData.sourceUrls;
      if (docData.hiddenSections !== undefined) enriched.hiddenSections = docData.hiddenSections;
      if (callback) callback(null, enriched);
    } catch(e) {
      // Parse error — fall back to main doc
      if (callback) callback(null, lesson);
    }
  });
}

/** One-time startup probe: verify the tool can read lesson docs via CRUD.
 *  If not, the field's allowedObjectTypes is missing the lesson-doc type —
 *  show the admin exactly what to add. */
function probeLessonDocAccess() {
  if (window._lessonDocProbeDone || typeof tool.requestObjects !== 'function') return;
  window._lessonDocProbeDone = true;
  var all = getAllLessonsInOrder();
  var probeId = null;
  for (var i = 0; i < all.length; i++) {
    if (all[i].lesson && all[i].lesson.lessonDocId) { probeId = all[i].lesson.lessonDocId; break; }
  }
  if (!probeId) return;
  tool.requestObjects('get', {
    mainObjectType: LESSON_DOC_TYPE,
    objectId: probeId
  }, function(err, result) {
    if (err || !result || !result.object) {
      console.warn('[SelfPaced] lesson doc probe FAILED:', err);
      tool.notify('⚠️ Lesson documents are not readable from this tool. Add { "mainObjectType": "curriculum-lessons-uniconbase", "role": "editor", "scope": "shared", "targetCollection": "private" } to this field\'s allowedObjectTypes.', 'warning');
    } else {
      console.log('[SelfPaced] lesson doc probe OK');
    }
  });
}

/* ── Role check ── */
/** Uses effectiveAccess.isManager (raw object-level admin flag) to determine
 *  if the current user has admin/manager rights on this CMS record.
 *  This disambiguates system-level from object-level access — unlike the
 *  merged roles[] array, which may include 'admin' for everyone if the
 *  object's folder/app permissions grant broad access. */
function isAdmin() {
  var user = tool.getUser();
  if (!user) return false;
  // Primary: raw object-level manager flag (most reliable)
  if (user.effectiveAccess && user.effectiveAccess.isManager) return true;
  // Fallback: system-level developer/owner always have full access
  var roles = user.roles || [];
  for (var i = 0; i < roles.length; i++) {
    var r = (roles[i] || '').toLowerCase();
    if (r === 'developer' || r === 'owner') return true;
  }
  return false;
}

/** Debug: log what the CMS sandbox tells us about the current user. */
function debugLogUser() {
  try {
    var user = tool.getUser();
    console.log('[SelfPaced] tool.getUser():', JSON.stringify(user, null, 2));
    console.log('[SelfPaced] effectiveAccess:', user ? (user.effectiveAccess || 'none') : 'null');
    console.log('[SelfPaced] isAdmin():', isAdmin());
  } catch(e) {
    console.log('[SelfPaced] tool.getUser() threw:', e);
  }
}

/** Diagnostic: log the SDK save capability so admins can verify the
 *  "Allow Save Request" setting is active. */
function probeToolApi() {
  try {
    console.log('[SelfPaced] tool API keys:', Object.keys(tool || {}).join(', '));
    console.log('[SelfPaced] tool.isReadOnly():', tool.isReadOnly ? tool.isReadOnly() : '(not available)');
    console.log('[SelfPaced] tool.requestSave available:', typeof tool.requestSave === 'function');
    console.log('[SelfPaced] allowRequestSave param:', tool.param ? tool.param('allowRequestSave', '(unset)') : '(no param API)');
    console.log('[SelfPaced] save-like SDK methods found:', findSaveTriggers().join(', ') || '(none)');
    console.log('[SelfPaced] current stored value:', (JSON.stringify(tool.getValue ? tool.getValue() : null) || '').slice(0, 400));
  } catch(e) {
    console.log('[SelfPaced] probeToolApi threw:', e);
  }
}

/* ── URL Transform: Storage → Hosting proxy ── */
function toHostingUrl(url) {
  if (!url) return url;
  // Firebase Storage URL → Firebase Hosting + Cloud Function proxy
  // https://firebasestorage.googleapis.com/v0/b/PROJECTID.appspot.com/o/PATH?alt=media&token=X
  // → https://PROJECTID.firebaseapp.com/files/PATH?alt=media&token=X
  // The Cloud Function at /files/** reads from Storage server-side and returns
  // the PDF with embed-friendly headers (no X-Frame-Options).
  // NOTE: using .firebaseapp.com (not .web.app) — .web.app is frequently on
  // ad-blocker/security blocklists since it's a common free-hosting domain.
  return url.replace(
    /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+?)(?:\.appspot\.com)?\/o\//,
    'https://$1.firebaseapp.com/files/'
  );
}

/* ── PDF.js: dynamic ES-module loader + canvas renderer (avoids nested iframes entirely) ── */
// PDF.js v4+ ships ONLY as ES modules (pdf.mjs / pdf.worker.mjs) — there is no
// legacy "pdf.min.js" global-script build anymore, so we must load it via a
// dynamic import() rather than a <script src> tag (which 404s every time).
// Try our own Firebase Hosting domain FIRST (proven reliable all session), then
// fall back to the public CDN in case the self-hosted copy is missing/not deployed yet.
var PDFJS_SOURCES = [
  { base: 'https://websites-a0e13.firebaseapp.com/vendor/pdfjs/', lib: 'pdf.mjs', worker: 'pdf.worker.mjs' },
  { base: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/', lib: 'pdf.min.mjs', worker: 'pdf.worker.min.mjs' }
];
var pdfJsLoadPromise = null;

function loadModuleFrom(source) {
  return import(/* webpackIgnore: true */ source.base + source.lib).then(function(mod) {
    mod.GlobalWorkerOptions.workerSrc = source.base + source.worker;
    window.pdfjsLib = mod;
  });
}

function ensurePdfJsLoaded() {
  if (window.pdfjsLib) return Promise.resolve();
  if (pdfJsLoadPromise) return pdfJsLoadPromise;
  pdfJsLoadPromise = PDFJS_SOURCES.reduce(function(chain, source) {
    return chain.catch(function() { return loadModuleFrom(source); });
  }, Promise.reject());
  return pdfJsLoadPromise;
}

/** Fetches a PDF via fetch() (NOT an iframe navigation — avoids the sandboxed
 *  nested-frame blocking seen on this CMS) and renders every page as a
 *  <canvas> directly into the given container element. */
function renderPdfIntoContainer(containerId, url) {
  var container = el(containerId);
  if (!container) return;
  container.innerHTML = '<div class="pdf-canvas-loading">⏳ Loading PDF…</div>';

  ensurePdfJsLoaded()
    .then(function() {
      return fetch(url).then(function(resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.arrayBuffer();
      });
    })
    .then(function(buf) {
      return window.pdfjsLib.getDocument({ data: buf }).promise;
    })
    .then(function(pdf) {
      container.innerHTML = '';
      var totalPages = pdf.numPages;
      var safeId = containerId.replace(/[^a-zA-Z0-9_-]/g, '_');

      // Store state for zoom re-rendering
      container._pdfDoc = pdf;
      container._pdfUrl = url;
      container._pdfSafeId = safeId;
      container._pdfTotalPages = totalPages;

      /** Render all pages at the given zoom factor (1.0 = fit-width). Returns a Promise. */
      function renderAllPages(zoomFactor) {
        // Clear existing canvases
        var existingCanvases = container.querySelectorAll('.pdf-page-canvas');
        for (var ec = 0; ec < existingCanvases.length; ec++) {
          existingCanvases[ec].remove();
        }
        container._pdfZoom = zoomFactor;
        var containerWidth = container.clientWidth || 760;

        function renderPage(pageNum) {
          return pdf.getPage(pageNum).then(function(page) {
            var baseViewport = page.getViewport({ scale: 1 });
            var fitScale = Math.min(3.0, (containerWidth - 24) / baseViewport.width);
            var scale = fitScale * zoomFactor;
            var viewport = page.getViewport({ scale: scale });
            var canvas = document.createElement('canvas');
            canvas.className = 'pdf-page-canvas';
            canvas.id = 'pdf-page-' + safeId + '-' + pageNum;
            canvas.setAttribute('data-page', pageNum);
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            container.appendChild(canvas);
            var ctx = canvas.getContext('2d');
            return page.render({ canvasContext: ctx, viewport: viewport }).promise;
          });
        }

        // Sequential render, return promise that resolves when all pages are done
        var promise = Promise.resolve();
        for (var pn = 1; pn <= totalPages; pn++) {
          (function(n) {
            promise = promise
              .then(function() { return renderPage(n); })
              .then(function() { tool.resize(); });
          })(pn);
        }
        return promise.then(function() {
          buildPdfPageNav(container, safeId, totalPages);
        });
      }
      container._renderAllPages = renderAllPages;

      // Initial render at fit-width, then add zoom controls
      return renderAllPages(1.0).then(function() {
        var card = container.closest('.pdf-viewer-card');
        if (!card) return;
        var toolbar = card.querySelector('.pdf-viewer-toolbar');
        if (!toolbar) return;
        // Avoid duplicate zoom controls
        if (toolbar.querySelector('.pdf-zoom-group')) return;

        var zoomGroup = document.createElement('span');
        zoomGroup.className = 'pdf-zoom-group';
        zoomGroup.innerHTML =
          '<span class="pdf-zoom-sep"></span>' +
          '<button class="pdf-zoom-btn" title="Zoom Out" data-zoom-dir="-1">➖</button>' +
          '<span class="pdf-zoom-label">100%</span>' +
          '<button class="pdf-zoom-btn" title="Zoom In" data-zoom-dir="1">➕</button>' +
          '<button class="pdf-zoom-btn pdf-zoom-fit" title="Fit Width">⊡</button>';

        var openLink = toolbar.querySelector('[data-open-url]');
        if (openLink) {
          toolbar.insertBefore(zoomGroup, openLink);
        } else {
          toolbar.appendChild(zoomGroup);
        }

        // Wire zoom buttons
        var zoomBtns = zoomGroup.querySelectorAll('[data-zoom-dir]');
        var zoomLabel = zoomGroup.querySelector('.pdf-zoom-label');
        var zoomFitBtn = zoomGroup.querySelector('.pdf-zoom-fit');
        for (var zb = 0; zb < zoomBtns.length; zb++) {
          (function(btn) {
            btn.addEventListener('click', function(e) {
              e.stopPropagation();
              var dir = parseInt(btn.getAttribute('data-zoom-dir'));
              var newZoom = Math.max(0.25, Math.min(3.0, container._pdfZoom + dir * 0.25));
              renderAllPages(newZoom).then(function() {
                if (zoomLabel) zoomLabel.textContent = Math.round(newZoom * 100) + '%';
              });
            });
          })(zoomBtns[zb]);
        }
        if (zoomFitBtn) {
          zoomFitBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            renderAllPages(1.0).then(function() {
              if (zoomLabel) zoomLabel.textContent = '100%';
            });
          });
        }
      });
    })
    .catch(function(err) {
      console.error('PDF render error:', err);
      container.innerHTML = '';
      var errBox = document.createElement('div');
      errBox.className = 'pdf-canvas-error';
      var msg = document.createElement('div');
      msg.textContent = '⚠️ Could not load PDF preview.';
      var link = document.createElement('a');
      link.textContent = '↗ Open PDF in New Tab';
      link.addEventListener('click', function() { tool.openUrl(url); });
      errBox.appendChild(msg);
      errBox.appendChild(link);
      container.appendChild(errBox);
      tool.resize();
    });
}

/** Build a page-navigation dropdown in the PDF toolbar.
 *  On desktop it opens on hover; on mobile it's a click-to-toggle dropdown.
 *  The trigger text auto-updates to show the current visible page as the user scrolls. */
function buildPdfPageNav(canvasContainer, safeId, totalPages) {
  if (totalPages <= 1) return; // no need for nav with single page
  // Find the parent pdf-viewer-card and its toolbar
  var card = canvasContainer.closest('.pdf-viewer-card');
  if (!card) return;
  var toolbar = card.querySelector('.pdf-viewer-toolbar');
  if (!toolbar) return;

  // Remove existing nav if re-building (e.g., after zoom change)
  var existingNav = toolbar.querySelector('.pdf-page-nav');
  if (existingNav) existingNav.remove();

  // Create the pages dropdown
  var navWrap = document.createElement('div');
  navWrap.className = 'pdf-page-nav';

  var trigger = document.createElement('button');
  trigger.className = 'btn btn-sm btn-outline pdf-page-nav-trigger';
  trigger.innerHTML = '📄 <span class="pdf-page-nav-label">Page 1</span> of ' + totalPages + ' <span class="pdf-page-nav-arrow">▾</span>';

  var dropdown = document.createElement('div');
  dropdown.className = 'pdf-page-nav-dropdown';
  var listHtml = '';
  for (var p = 1; p <= totalPages; p++) {
    listHtml += '<button class="pdf-page-nav-item" data-page="' + p + '" data-target="pdf-page-' + safeId + '-' + p + '">Page ' + p + '</button>';
  }
  dropdown.innerHTML = listHtml;

  navWrap.appendChild(trigger);
  navWrap.appendChild(dropdown);
  toolbar.appendChild(navWrap);

  // ── Scroll spy: update trigger label to current visible page ──
  var labelEl = trigger.querySelector('.pdf-page-nav-label');
  var currentPage = 1;

  function updateTriggerText(pageNum) {
    if (pageNum === currentPage) return;
    currentPage = pageNum;
    if (labelEl) labelEl.textContent = 'Page ' + pageNum;
    // Also highlight the active item in the dropdown
    var items = dropdown.querySelectorAll('.pdf-page-nav-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', parseInt(items[i].getAttribute('data-page')) === pageNum);
    }
  }

  // Use IntersectionObserver to detect which page is most visible
  if (typeof IntersectionObserver !== 'undefined') {
    var pageCanvases = [];
    for (var cp = 1; cp <= totalPages; cp++) {
      var c = document.getElementById('pdf-page-' + safeId + '-' + cp);
      if (c) pageCanvases.push(c);
    }
    var visMap = {}; // pageNum → ratio
    var observer = new IntersectionObserver(function(entries) {
      for (var ei = 0; ei < entries.length; ei++) {
        var e = entries[ei];
        var pn = parseInt(e.target.getAttribute('data-page'));
        if (!isNaN(pn)) visMap[pn] = e.intersectionRatio;
      }
      // Find page with highest intersection ratio
      var bestPage = 1;
      var bestRatio = 0;
      var keys = Object.keys(visMap);
      for (var ki = 0; ki < keys.length; ki++) {
        var k = parseInt(keys[ki]);
        if (visMap[k] > bestRatio) { bestRatio = visMap[k]; bestPage = k; }
      }
      if (bestRatio > 0) updateTriggerText(bestPage);
    }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
    for (var op = 0; op < pageCanvases.length; op++) {
      observer.observe(pageCanvases[op]);
    }
  }

  // ── Wire hover/click ──
  var hideTimer = null;

  function showDropdown() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    navWrap.classList.add('open');
  }
  function hideDropdown() {
    hideTimer = setTimeout(function() { navWrap.classList.remove('open'); }, 150);
  }

  // Desktop: hover to open
  trigger.addEventListener('mouseenter', showDropdown);
  navWrap.addEventListener('mouseenter', function() { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } });
  navWrap.addEventListener('mouseleave', hideDropdown);

  // Mobile: click to toggle
  trigger.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (navWrap.classList.contains('open')) {
      navWrap.classList.remove('open');
    } else {
      showDropdown();
    }
  });

  // Page items: click to scroll to that canvas
  var items = dropdown.querySelectorAll('.pdf-page-nav-item');
  for (var i = 0; i < items.length; i++) {
    items[i].addEventListener('click', function(e) {
      e.stopPropagation();
      var pageNum = parseInt(this.getAttribute('data-page'));
      var targetId = this.getAttribute('data-target');
      var target = document.getElementById(targetId);
      if (target) {
        // Update the trigger text immediately for responsiveness
        updateTriggerText(pageNum);
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        var containerRect = canvasContainer.getBoundingClientRect();
        var targetRect = target.getBoundingClientRect();
        canvasContainer.scrollTop += targetRect.top - containerRect.top - 20;
      }
      navWrap.classList.remove('open');
    });
  }

  // Close on outside click
  document.addEventListener('click', function closeNav(e) {
    if (!navWrap.contains(e.target)) navWrap.classList.remove('open');
  });
}

/** Fetches an HTML document via the proxy URL and renders it inline. */
function renderHtmlDocIntoContainer(containerId, url) {
  var container = el(containerId);
  if (!container) return;
  fetch(url)
    .then(function(resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.text();
    })
    .then(function(htmlText) {
      // Strip out scripts for safety, then inject
      var safeHtml = htmlText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      container.innerHTML = '<div class="detail-content">' + safeHtml + '</div>';
      tool.resize();
    })
    .catch(function(err) {
      console.error('HTML doc render error:', err);
      container.innerHTML = '<div class="pdf-canvas-error"><div>⚠️ Could not load document.</div><a onclick="tool.openUrl(\'' + url + '\')">↗ Open in New Tab</a></div>';
      tool.resize();
    });
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
  // Check management type: supervised requires previous lesson approved, self-paced requires completed
  var mgmtType = (CONFIG.managementType || 'self_paced');
  for (var i = 0; i < targetIdx; i++) {
    var prevProg = getLessonProgress(all[i].sectionId, all[i].lessonId);
    if (mgmtType === 'supervised') {
      if (prevProg.supervisorStatus !== 'approved' && prevProg.status !== 'completed') return false;
    } else {
      if (prevProg.status !== 'completed') return false;
    }
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
  var active = 0;
  for (var j = 0; j < lessons.length; j++) {
    var st = getLessonProgress(sectionId, lessons[j].id).status;
    if (st === 'completed') completed++;
    else if (st === 'in_progress' || st === 'studying' || st === 'pending_review') active++;
  }
  var total = lessons.length;
  var status = total === 0 ? 'not_started' : completed === total ? 'completed' : (completed + active) > 0 ? 'in_progress' : 'not_started';
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

/* ── Persist progress to the parent CMS object ──
 *  Progress lives on the REAL CMS record this tool is installed on.
 *  Save semantics (verified with the CMS codebase):
 *    • tool.setValue() only STAGES the value in the parent form.
 *    • tool.requestSave(cb) asks the parent to commit the whole record to
 *      Firestore NOW — same cascade as the parent Save button.
 *      Requires the field setting allowRequestSave: 'yes'.
 *  saveProgress(immediate) stages on every call; when immediate=true
 *  (Submit Answers, Mark Complete, …) it also fires requestSave and reports
 *  the true outcome. We never claim "saved" unless the save was accepted. */
function findSaveTriggers() {
  var found = [];
  try {
    var keys = Object.keys(tool || {});
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (/save|commit|persist|flush/i.test(k) && typeof tool[k] === 'function' && found.indexOf(k) === -1) {
        found.push(k);
      }
    }
  } catch(e) {}
  return found;
}

function saveProgress(immediate, onDone) {
  var data = { config: CONFIG, progress: PROGRESS };
  _lastSavedJson = JSON.stringify(data || null);
  _suppressNextValueChange = true;
  var readOnly = false;
  try { readOnly = !!(tool.isReadOnly && tool.isReadOnly()); } catch(e) {}
  try { tool.reportValid(true, ''); } catch(e) {}
  // 1) Stage the latest value in the parent form.
  try { tool.setValue(data); } catch(e) {}
  var staged = false;
  try { staged = JSON.stringify(tool.getValue() || null) === _lastSavedJson; } catch(e) {}
  var result = { ok: true, readOnly: readOnly, staged: staged, saved: false, saveError: '' };
  // 2) On explicit user actions, ask the parent CMS to commit the record to
  //    Firestore immediately (it flushes the latest staged value first).
  if (immediate) {
    if (typeof tool.requestSave === 'function') {
      try {
        tool.requestSave(function(err, ok) {
          if (ok) {
            result.saved = true;
            console.log('[SelfPaced] requestSave accepted — Firestore write dispatched');
          } else {
            result.saveError = err || 'denied — enable "Allow Save Request" in the field settings';
            console.log('[SelfPaced] requestSave rejected:', result.saveError);
          }
          if (onDone) onDone(result);
        });
        return;
      } catch(e) {
        result.saveError = String(e);
        console.log('[SelfPaced] requestSave threw:', e);
      }
    } else {
      result.saveError = 'CMS does not support requestSave — update the CMS or enable "Save on Change" on the field.';
      console.log('[SelfPaced] requestSave not available');
    }
  }
  if (onDone) onDone(result);
}

/** Report a save outcome honestly — "Saved ✓" only when the parent CMS
 *  accepted the save request (real Firestore commit dispatched). */
function reportSaveResult(res, successPrefix) {
  console.log('[SelfPaced] save result:', JSON.stringify(res || null));
  var st = el('quiz-save-status-inline');
  if (res.readOnly) {
    var m1 = '⚠️ Could not save — the page is read-only. Ask an admin to save the record.';
    if (st) { st.textContent = m1; st.style.color = '#dc2626'; }
    tool.notify(m1, 'warning');
  } else if (res.saved) {
    var m2 = (successPrefix || 'Saved') + ' ✓';
    if (st) { st.textContent = m2; st.style.color = '#059669'; }
    tool.notify(m2, 'success');
  } else if (res.saveError) {
    var m2b = '⚠️ Save to the course record failed: ' + res.saveError;
    if (st) { st.textContent = m2b; st.style.color = '#dc2626'; }
    tool.notify(m2b, 'error');
  } else if (res.staged) {
    var m4 = '📝 Recorded in the form — click Save in the CMS toolbar to keep it permanently.';
    if (st) { st.textContent = m4; st.style.color = '#d97706'; }
    tool.notify(m4, 'warning');
  } else {
    var m5 = '⚠️ Could not record the value in the form. Please try again.';
    if (st) { st.textContent = m5; st.style.color = '#dc2626'; }
    tool.notify(m5, 'error');
  }
  return res;
}

/** Flush any pending debounced saves (flashcards, quiz staging) */
function flushPendingSaves() {
  var pending = false;
  if (window._quizStageTimer) { clearTimeout(window._quizStageTimer); window._quizStageTimer = null; pending = true; }
  if (window._sfcSaveTimer) { clearTimeout(window._sfcSaveTimer); window._sfcSaveTimer = null; pending = true; }
  if (pending) saveProgress(true);
}

/** Debounced staging of in-progress quiz answers into PROGRESS + the parent
 *  form. This is NOT a database save — the parent CMS only writes to
 *  Firestore when the form is saved. The real save happens when the student
 *  clicks "Submit Answers" (or an admin clicks the CMS Save button).
 *  No "Saved" message is shown here — that would be misleading. */
function scheduleQuizAutoSave() {
  if (!currentSectionId || !currentLessonId) return;
  if (!PROGRESS[currentSectionId]) PROGRESS[currentSectionId] = {};
  if (!PROGRESS[currentSectionId][currentLessonId]) PROGRESS[currentSectionId][currentLessonId] = {};
  PROGRESS[currentSectionId][currentLessonId].quizAnswers = JSON.parse(JSON.stringify(quizAnswers));
  if (window._quizStageTimer) clearTimeout(window._quizStageTimer);
  window._quizStageTimer = setTimeout(function() {
    window._quizStageTimer = null;
    saveProgress();  // silent stage only — never claims "saved"
  }, 1000);
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

  var infoTitle = el('section-info-title');
  if (infoTitle) infoTitle.textContent = '📁 ' + (section.title || 'Section');
  var infoProgress = el('section-info-progress');
  if (infoProgress) infoProgress.textContent = summary.completed + ' of ' + summary.total + ' lessons completed';

  var list = el('lesson-list');
  var empty = el('lessons-empty');
  if (!list || !empty) return;

  if (lessons.length === 0) {
    list.innerHTML = '';
    empty.style.display = '';
  } else {
    empty.style.display = 'none';
    list.innerHTML = lessons.map(function(les, idx) {
      var prog = getLessonProgress(section.id, les.id);
      var lock = !isLessonAccessible(section.id, les.id);
      // Status key drives icon + badge. pending_review / studying must NOT
      // fall back to "Not Started" (the old maps lacked those two keys).
      var stKey = lock ? 'locked' : (prog.status || 'not_started');
      var iconMap = { completed: '✅', in_progress: '📖', studying: '🔁', pending_review: '⏳', not_started: '📌', locked: '🔒' };
      var icon = iconMap[stKey] || '📌';
      var badgeMap = { completed: 'Completed', in_progress: 'In Progress', studying: 'Study & Retry', pending_review: 'Awaiting Review', not_started: 'Not Started', locked: 'Locked' };
      var badgeLabel = badgeMap[stKey] || 'Not Started';
      var iconClass = stKey;
      var badgeClass = 'status-' + stKey;
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
  // Use enriched lesson from lesson doc if available, else fall back to main doc data
  var lesson = window._currentEnrichedLesson || findLesson(section, currentLessonId);
  if (!lesson) { openSection(currentSectionId); return; }

  var prog = getLessonProgress(section.id, lesson.id);

  el('detail-breadcrumb').innerHTML =
    '<span onclick="showSections()">📚 All Sections</span> › ' +
    '<span onclick="openSection(\'' + esc(section.id) + '\')">' + esc(section.title || 'Section') + '</span> › ' +
    '<span>' + esc(lesson.title || 'Lesson') + '</span>';

  el('detail-title').textContent = lesson.title || 'Untitled Lesson';
  el('detail-estimated').textContent = '⏱️ Estimated: ' + (lesson.estimatedMinutes || '—') + ' min';

  var badge = el('detail-badge');
  var statusLabels = { not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed', pending_review: 'Awaiting Review', studying: 'Study & Retry' };
  var statusClasses = { not_started: 'status-not_started', in_progress: 'status-in_progress', completed: 'status-completed', pending_review: 'status-pending_review', studying: 'status-studying' };
  badge.textContent = statusLabels[prog.status] || 'Not Started';
  badge.className = 'detail-badge ' + (statusClasses[prog.status] || 'status-not_started');
  var statusExtra = typeof prog.score === 'number' ? ' | Score: ' + prog.score + '%' : '';
  if (prog.supervisorStatus === 'rejected' && prog.supervisorNotes) {
    statusExtra += ' | 📝 Supervisor feedback: ' + esc(prog.supervisorNotes);
  }
  el('detail-status-label').textContent = statusExtra;

  var youtubeUrls = normalizePdfArray(lesson.youtubeUrls);
  var presentationPdfs = normalizePdfArray(lesson.presentationPdfUrls);
  var studyDocPdfs = normalizePdfArray(lesson.studyDocPdfUrls);
  var worksheetPdfs = normalizePdfArray(lesson.worksheetPdfUrls);
  var answerKeyPdfs = normalizePdfArray(lesson.answerKeyPdfUrls);
  var htmlDocs = normalizePdfArray(lesson.htmlDocUrls);

  // Filter out hidden documents (manager toggled them off for students)
  var hiddenDocUrls = normalizePdfArray(lesson.hiddenDocUrls);
  if (hiddenDocUrls.length > 0) {
    function isHiddenDoc(url) {
      for (var hd = 0; hd < hiddenDocUrls.length; hd++) {
        if (hiddenDocUrls[hd] === url) return true;
      }
      return false;
    }
    presentationPdfs = presentationPdfs.filter(function(u) { return !isHiddenDoc(u); });
    studyDocPdfs = studyDocPdfs.filter(function(u) { return !isHiddenDoc(u); });
    worksheetPdfs = worksheetPdfs.filter(function(u) { return !isHiddenDoc(u); });
    answerKeyPdfs = answerKeyPdfs.filter(function(u) { return !isHiddenDoc(u); });
    htmlDocs = htmlDocs.filter(function(u) { return !isHiddenDoc(u); });
  }

  var content = lesson.content || '';

  // Check hidden sections (visibility toggles set by manager)
  var hiddenSections = (lesson.hiddenSections && Array.isArray(lesson.hiddenSections)) ? lesson.hiddenSections : [];
  function isHidden(key) { return hiddenSections.indexOf(key) !== -1; }

  var quizData = lesson.quiz;
  if (quizData && typeof quizData === 'string') { try { quizData = JSON.parse(quizData); } catch(e) { quizData = null; } }
  var hasQuiz = quizData && Array.isArray(quizData) && quizData.length > 0;

  var steps = [];
  var stepNum = 0;

  if (youtubeUrls.length > 0 && !isHidden('videos')) {
    stepNum++;
    var videoIds = [];
    for (var vi = 0; vi < youtubeUrls.length; vi++) { var vid = extractYouTubeId(youtubeUrls[vi]); if (vid) videoIds.push(vid); }
    steps.push({ num: stepNum, icon: '🎬', title: 'Video' + (videoIds.length > 1 ? 's' : ''), type: 'video', videoIds: videoIds, hasContent: videoIds.length > 0 });
  }
  if (presentationPdfs.length > 0 && !isHidden('slides')) { stepNum++; steps.push({ num: stepNum, icon: '📊', title: 'Slides', type: 'pdfs', pdfUrls: presentationPdfs, label: 'Presentation Slide', hasContent: true }); }
  if (studyDocPdfs.length > 0 && !isHidden('studyDocs')) { stepNum++; steps.push({ num: stepNum, icon: '📖', title: 'Documents', type: 'pdfs', pdfUrls: studyDocPdfs, label: 'Study Material', hasContent: true }); }
  if (worksheetPdfs.length > 0 && !isHidden('worksheets')) { stepNum++; steps.push({ num: stepNum, icon: '📝', title: 'Worksheet', type: 'pdfs', pdfUrls: worksheetPdfs, label: 'Worksheet', hasContent: true }); }
  if (answerKeyPdfs.length > 0 && !isHidden('answerKeys')) { stepNum++; steps.push({ num: stepNum, icon: '🔑', title: 'Answers', type: 'pdfs', pdfUrls: answerKeyPdfs, label: 'Answer Key', hasContent: true }); }
  if (htmlDocs.length > 0 && !isHidden('webDocs')) { stepNum++; steps.push({ num: stepNum, icon: '🌐', title: 'Web Doc', type: 'htmlDoc', htmlDocUrls: htmlDocs, label: 'Web Doc', hasContent: true }); }
  var htmlCode = lesson.htmlCode || '';
  if (htmlCode && htmlCode.length > 20 && !isHidden('studyContent')) { stepNum++; steps.push({ num: stepNum, icon: '📖', title: 'Study Guide', type: 'htmlCode', htmlCode: htmlCode, hasContent: true }); }
  // Presentation slides tab
  var presHtml = lesson.presentationHtml || '';
  if (presHtml && presHtml.length > 50 && !isHidden('presentation')) { stepNum++; steps.push({ num: stepNum, icon: '🎞️', title: 'Presentation', type: 'presentation', presHtml: presHtml, hasContent: true }); }
  // Flashcards tab
  var flashcards = lesson.flashcards;
  if (flashcards && typeof flashcards === 'string') { try { flashcards = JSON.parse(flashcards); } catch(e) { flashcards = null; } }
  var hasFlashcards = flashcards && Array.isArray(flashcards) && flashcards.length > 0;
  if (hasFlashcards && !isHidden('flashcards')) { stepNum++; steps.push({ num: stepNum, icon: '🃏', title: 'Flashcards', type: 'flashcards', flashcards: flashcards, hasContent: true }); }
  if (content && content !== '<br>' && content !== '<br>' && !isHidden('notes')) { stepNum++; steps.push({ num: stepNum, icon: '📄', title: 'Notes', type: 'html', html: content, hasContent: true }); }
  if (hasQuiz && !isHidden('questions')) { stepNum++; steps.push({ num: stepNum, icon: '📝', title: 'Quiz', type: 'quiz', quizData: quizData, hasContent: true }); }
  // Always add a nav step at the end with Previous/Next/Complete buttons
  stepNum++; steps.push({ num: stepNum, icon: '✅', title: 'Finish', type: 'nav', hasContent: true });

  var flowEl = el('study-flow');
  var html = '';
  window._pdfRenderQueue = [];

  // Build tab bar (shown on desktop, hidden on mobile)
  var tabsHtml = '';
  if (steps.length > 0) {
    tabsHtml = '<div class="study-tabs"><div class="study-tabs-inner">';
    for (var ti = 0; ti < steps.length; ti++) {
      tabsHtml += '<button class="study-tab-btn" data-tab-step="' + ti + '"><span class="study-tab-badge">' + steps[ti].num + '</span>' + steps[ti].icon + ' ' + esc(steps[ti].title) + '</button>';
    }
    tabsHtml += '</div></div>';
  }

  if (steps.length === 0) {
    html = '<div class="study-flow-empty"><div class="empty-icon">📖</div><div class="empty-title">No study materials yet</div><div class="empty-desc">This lesson has no content. A manager needs to add materials.</div></div>';
  } else {
    html = tabsHtml + '<div class="study-steps">';
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
          var proxyUrl = toHostingUrl(step.pdfUrls[pj]);
          var pdfName = step.label + (step.pdfUrls.length > 1 ? ' ' + (pj+1) + ' of ' + step.pdfUrls.length : '');
          var canvasContainerId = 'pdf-canvas-' + si + '-' + pj;
          html += '<div class="study-embed">';
          html += '<div class="pdf-viewer-card">';
          html += '<div class="pdf-viewer-toolbar"><span class="pdf-viewer-icon">📄</span><span class="pdf-viewer-name">' + esc(pdfName) + '</span><a class="btn btn-outline btn-sm" style="margin-left:auto" title="Open in new tab" data-open-url="' + esc(proxyUrl) + '">↗ Open in New Tab</a></div>';
          html += '<div class="pdf-canvas-container" id="' + canvasContainerId + '"></div>';
          html += '</div></div>';
          window._pdfRenderQueue.push({ containerId: canvasContainerId, url: proxyUrl });
        }
      } else if (step.type === 'htmlDoc') {
        for (var hj = 0; hj < step.htmlDocUrls.length; hj++) {
          var htmlProxyUrl = toHostingUrl(step.htmlDocUrls[hj]);
          var htmlDocName = step.label + (step.htmlDocUrls.length > 1 ? ' ' + (hj+1) + ' of ' + step.htmlDocUrls.length : '');
          var htmlContainerId = 'html-doc-' + si + '-' + hj;
          html += '<div class="study-embed">';
          html += '<div class="pdf-viewer-card">';
          html += '<div class="pdf-viewer-toolbar"><span class="pdf-viewer-icon">🌐</span><span class="pdf-viewer-name">' + esc(htmlDocName) + '</span><a class="btn btn-outline btn-sm" style="margin-left:auto" title="Open in new tab" data-open-url="' + esc(htmlProxyUrl) + '">↗ Open in New Tab</a></div>';
          html += '<div class="html-doc-container" id="' + htmlContainerId + '"><div class="pdf-canvas-loading">⏳ Loading HTML document…</div></div>';
          html += '</div></div>';
          window._htmlDocRenderQueue = window._htmlDocRenderQueue || [];
          window._htmlDocRenderQueue.push({ containerId: htmlContainerId, url: htmlProxyUrl });
        }
      } else if (step.type === 'htmlCode') {
        html += '<div class="detail-content">' + step.htmlCode + '</div>';
      } else if (step.type === 'presentation') {
        html += renderPresentationInFlow(step.presHtml);
      } else if (step.type === 'flashcards') {
        html += renderFlashcardsInFlow(step.flashcards, prog, currentSectionId, currentLessonId);
      } else if (step.type === 'html') {
        html += '<div class="detail-content">' + step.html + '</div>';
      } else if (step.type === 'quiz') {
        html += '<div class="study-quiz-wrap">' + renderQuizInFlow(step.quizData, prog, currentSectionId, currentLessonId) + '</div>';
      } else if (step.type === 'nav') {
        // Completion step — final action to finish the lesson
        var mgmtTypeNav = CONFIG.managementType || 'self_paced';
        var isAwaitingReview = prog.status === 'pending_review';
        html += '<div class="quiz-nav-actions">';
        html += '<button class="btn btn-outline" id="btn-prev-lesson-inline"' + (!getPrevLesson(section.id, lesson.id) ? ' disabled' : '') + '>← Previous</button>';
        if (isAwaitingReview) {
          html += '<button class="btn btn-outline" disabled>⏳ Awaiting Supervisor Approval</button>';
        } else if (prog.status === 'completed') {
          html += '<button class="btn btn-outline" id="btn-mark-inprogress-inline">📖 Mark In Progress</button>';
        } else {
          var completeLabel = (mgmtTypeNav === 'supervised') ? '✓ Mark Complete & Submit for Review' : '✓ Mark Complete';
          html += '<button class="btn btn-success" id="btn-mark-complete-inline">' + completeLabel + '</button>';
        }
        html += '<button class="btn btn-outline" id="btn-next-lesson-inline"' + (!getNextLesson(section.id, lesson.id) || (getNextLesson(section.id, lesson.id) && !isLessonAccessible(getNextLesson(section.id, lesson.id).sectionId, getNextLesson(section.id, lesson.id).lessonId)) ? ' disabled' : '') + '>Next →</button>';
        html += '</div>';
        if (!hasQuiz && !isAwaitingReview && prog.status !== 'completed') {
          html += '<div style="text-align:center;padding:14px 0 0;color:var(--text-muted);font-size:13px">📭 There are no questions for this lesson — review the materials, then click Mark Complete.</div>';
        }
        if (hasQuiz && !isAwaitingReview && prog.status !== 'completed' && prog.quizPassed !== true && !(typeof prog.score === 'number' && prog.score >= MIN_PASS_SCORE)) {
          html += '<div style="text-align:center;padding:14px 0 0;color:var(--warning);font-size:13px">📝 You must pass the quiz in the Quiz tab before you can mark this lesson complete.</div>';
        }
      }

      html += '</div></div>';
    }
    html += '</div>';
  }
  flowEl.innerHTML = html;

  // Initialize all flashcard containers (progress bars, filter state)
  window.sfcInitAll();

  // Initialize all presentation containers (hide all slides except #1, update counters)
  window.presInitAll();

  // Wire "Open in New Tab" links via tool.openUrl (reliable inside the sandboxed iframe)
  var openLinks = flowEl.querySelectorAll('[data-open-url]');
  for (var ol = 0; ol < openLinks.length; ol++) {
    (function(linkEl) {
      linkEl.addEventListener('click', function() { tool.openUrl(linkEl.getAttribute('data-open-url')); });
    })(openLinks[ol]);
  }

  // Render queued PDFs as canvas pages (no iframes — avoids sandboxed nested-frame blocking)
  var pdfQueue = window._pdfRenderQueue || [];
  for (var pq = 0; pq < pdfQueue.length; pq++) {
    renderPdfIntoContainer(pdfQueue[pq].containerId, pdfQueue[pq].url);
  }

  // Render queued HTML documents inline
  var htmlDocQueue = window._htmlDocRenderQueue || [];
  for (var hq = 0; hq < htmlDocQueue.length; hq++) {
    renderHtmlDocIntoContainer(htmlDocQueue[hq].containerId, htmlDocQueue[hq].url);
  }

  setTimeout(function() {
    var allSteps = flowEl.querySelectorAll('.study-step');
    var expanded = false;
    if ((prog.status === 'completed' || prog.status === 'pending_review' || prog.status === 'studying') && hasQuiz) {
      // Open the quiz tab on submitted/completed lessons so results are visible
      for (var es = 0; es < allSteps.length; es++) {
        if (steps[es] && steps[es].type === 'quiz') { allSteps[es].classList.add('expanded'); expanded = true; activeStudyTab = es; break; }
      }
    }
    if (!expanded && allSteps.length > 0) allSteps[0].classList.add('expanded');

    // Wire tab bar (desktop)
    var tabBar = flowEl.querySelector('.study-tabs');
    if (tabBar && steps.length > 0) {
      var tabBtns = tabBar.querySelectorAll('.study-tab-btn');
      var stepEls = flowEl.querySelectorAll('.study-step');

      // Click a tab → show only that step's content, preserving scroll per tab
      var activeStepIdx = -1; // -1 so first activateTab(0) actually runs
      var tabScrollPositions = {}; // remember scrollTop per tab
      function activateTab(idx) {
        if (activeStepIdx === idx) return;
        // Save scroll position of current tab
        if (stepEls[activeStepIdx]) {
          tabScrollPositions[activeStepIdx] = window.scrollY || document.documentElement.scrollTop;
          stepEls[activeStepIdx].classList.remove('active-tab');
        }
        activeStepIdx = idx;
        activeStudyTab = idx; // remember across re-renders
        if (stepEls[idx]) {
          stepEls[idx].classList.add('active-tab');
          // Restore scroll position for this tab
          if (typeof tabScrollPositions[idx] === 'number') {
            setTimeout(function() {
              window.scrollTo(0, tabScrollPositions[idx]);
            }, 50);
          } else {
            // First time opening this tab — scroll to top
            window.scrollTo(0, 0);
          }
        }
        // Update tab styling
        for (var tb2 = 0; tb2 < tabBtns.length; tb2++) {
          tabBtns[tb2].classList.toggle('active', tb2 === idx);
        }
        tool.resize();
      }
      for (var tb = 0; tb < tabBtns.length; tb++) {
        (function(btn, idx) {
          btn.addEventListener('click', function() { activateTab(idx); });
        })(tabBtns[tb], tb);
      }
      // Restore the tab the student was on (defaults to first tab)
      var defaultTab = (typeof activeStudyTab === 'number' && activeStudyTab >= 0 && activeStudyTab < tabBtns.length) ? activeStudyTab : 0;
      activateTab(defaultTab);
    }
  }, 50);

  // Wire up interactive quiz "Show Answer" buttons in AI-generated study guide content
  setTimeout(function() {
    var quizItems = document.querySelectorAll('.sg-quiz-item-v3');
    for (var qi = 0; qi < quizItems.length; qi++) {
      (function(item) {
        var radios = item.querySelectorAll('.sg-q-radio');
        var showBtn = item.querySelector('.sg-show-answer-btn');
        var feedback = item.querySelector('.sg-q-feedback');
        var correctMsg = feedback ? feedback.querySelector('.sg-answer-correct') : null;
        var wrongMsg = feedback ? feedback.querySelector('.sg-answer-wrong') : null;
        if (!showBtn || !feedback) return;

        // Enable "Show Answer" button when any radio is selected
        for (var ri = 0; ri < radios.length; ri++) {
          radios[ri].addEventListener('change', function() {
            if (showBtn) showBtn.disabled = false;
          });
        }

        // Reveal feedback on button click
        showBtn.addEventListener('click', function() {
          var selectedIsCorrect = false;
          for (var ri = 0; ri < radios.length; ri++) {
            if (radios[ri].checked && radios[ri].classList.contains('sg-q-correct')) {
              selectedIsCorrect = true;
              break;
            }
          }
          // Show feedback with correct/wrong message
          feedback.style.display = 'block';
          if (correctMsg) correctMsg.style.display = selectedIsCorrect ? '' : 'none';
          if (wrongMsg) wrongMsg.style.display = selectedIsCorrect ? 'none' : '';
          // Lock the quiz after reveal
          showBtn.disabled = true;
          for (var ri = 0; ri < radios.length; ri++) {
            radios[ri].disabled = true;
          }
        });
      })(quizItems[qi]);
    }
    tool.resize();
  }, 150);

  // Wire inline nav buttons (inside the Completion tab)
  var prevBtn = el('btn-prev-lesson-inline');
  var nextBtn = el('btn-next-lesson-inline');
  var completeBtn = el('btn-mark-complete-inline');
  var inprogressBtn = el('btn-mark-inprogress-inline');
  if (prevBtn) prevBtn.addEventListener('click', function() { navigateLesson(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function() { navigateLesson(1); });
  if (completeBtn) completeBtn.addEventListener('click', markComplete);
  if (inprogressBtn) inprogressBtn.addEventListener('click', markInProgress);

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

  // Submitted = the student actually pressed Submit / Mark Complete (explicit flag
  // or a terminal status). Merely having auto-saved answers does NOT count — the
  // student must still see the Submit button when they return.
  var wasSubmitted = prog.quizSubmitted === true || prog.status === 'completed' || prog.status === 'pending_review' || prog.status === 'studying';
  var isCompleted = prog.status === 'completed';
  var hasSavedAnswers = !!(prog.quizAnswers && typeof prog.quizAnswers === 'object' && Object.keys(prog.quizAnswers).length > 0);
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
      html += '<div class="quiz-actions"><button class="btn btn-primary" id="btn-submit-quiz-inline">Submit Answers</button><span id="quiz-save-status-inline" style="font-size:12px;color:var(--text-muted);align-self:center">Answer all questions, then click Submit Answers to save</span></div>';
      html += '<div class="quiz-result" id="quiz-result-inline" style="display:none"></div>';
    } else if (!isCompleted && !isStudying) {
      var score = calcQuizScore(activeQuestions, prog.quizAnswers);
      var passed = score >= MIN_PASS_SCORE;
      html += '<div class="quiz-result ' + (passed ? 'pass' : 'fail') + '" style="display:block">Quiz ' + (passed ? 'passed' : 'failed') + ' — Score: ' + score + '%' + (passed ? '' : ' (need ' + MIN_PASS_SCORE + '%)') + '</div>';
      html += '<span id="quiz-save-status-inline" style="display:block;text-align:center;font-size:12px;color:var(--text-muted);margin-top:8px"></span>';
      if (passed) {
        var mgmtTypeQ = CONFIG.managementType || 'self_paced';
        html += '<div style="text-align:center;padding:12px 16px;background:var(--primary-bg);border-radius:8px;font-size:13px;color:var(--primary-dark);margin-top:12px">✅ Great! Next step: open the <strong>Finish</strong> tab and click <strong>“' + (mgmtTypeQ === 'supervised' ? 'Mark Complete & Submit for Review' : 'Mark Complete') + '”</strong> to save your completion.</div>';
      }
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
          // Auto-save the answer immediately (debounced) — nothing is lost
          scheduleQuizAutoSave();
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

/** Render flashcards as enhanced flip-card grid with categories, difficulty, progress tracking */
function renderFlashcardsInFlow(flashcards, prog, sectionId, lessonId) {
  if (!flashcards || !flashcards.length) return '';
  var uniqueId = 'sfc-' + Date.now();
  // Load mastered card indices from progress (persisted across sessions)
  var masteredIndices = (prog && prog.flashcardMastered && Array.isArray(prog.flashcardMastered)) ? prog.flashcardMastered : [];
  // Store sectionId/lessonId on container for save callbacks
  var sectionIdEsc = esc(sectionId || '');
  var lessonIdEsc = esc(lessonId || '');
  // Category color palette
  var catColors = [
    { bg:'#eef2ff', border:'#818cf8', text:'#4f46e5' },
    { bg:'#ecfdf5', border:'#6ee7b7', text:'#059669' },
    { bg:'#fef3c7', border:'#fcd34d', text:'#d97706' },
    { bg:'#fce7f3', border:'#f9a8d4', text:'#db2777' },
    { bg:'#f0fdf4', border:'#86efac', text:'#16a34a' },
    { bg:'#fef2f2', border:'#fca5a5', text:'#dc2626' },
    { bg:'#f5f3ff', border:'#c4b5fd', text:'#7c3aed' },
    { bg:'#ecfeff', border:'#67e8f9', text:'#0891b2' }
  ];
  var diffBadges = { easy:'🟢 Easy', medium:'🟡 Medium', hard:'🔴 Hard' };
  var diffDots = { easy:'#059669', medium:'#d97706', hard:'#dc2626' };
  var typeIcons = { term:'📖', question:'❓', code:'💻', image:'🖼️', concept:'💡' };
  var typeLabels = { term:'TERM', question:'QUESTION', code:'CODE', image:'VISUAL', concept:'CONCEPT' };

  // Gather categories
  var cats = {};
  for (var fi = 0; fi < flashcards.length; fi++) {
    var cat = flashcards[fi].category || '';
    if (cat) cats[cat] = (cats[cat] || 0) + 1;
  }
  var catKeys = Object.keys(cats);

  var html = '<div class="enhanced-fc-student" id="' + uniqueId + '" data-sfc-cat-filter="all" data-sfc-status-filter="all" data-sfc-sid="' + sectionIdEsc + '" data-sfc-lid="' + lessonIdEsc + '">';

  // Header with card count
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">';
  html += '<span style="font-weight:700;color:var(--text);font-size:16px">🃏 Flashcards</span>';
  html += '<span style="font-size:12px;color:var(--text-muted);background:var(--surface-secondary,#f1f5f9);padding:4px 12px;border-radius:20px;font-weight:600">' + flashcards.length + ' cards</span>';
  html += '</div>';

  // Status filter buttons (All / Pending / Done) — always show
  html += '<div class="sfc-status-bar" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">';
  html += '<button class="sfc-status-btn sfc-status-active" data-sfc-status="all" onclick="window.sfcApplyStatusFilter(\'' + uniqueId + '\',\'all\')" style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid #e2e8f0;background:#fff;color:#1e293b;cursor:pointer;font-family:inherit">📋 All (' + flashcards.length + ')</button>';
  html += '<button class="sfc-status-btn" data-sfc-status="pending" onclick="window.sfcApplyStatusFilter(\'' + uniqueId + '\',\'pending\')" style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid #e2e8f0;background:#fff;color:#1e293b;cursor:pointer;font-family:inherit">⏳ Pending (' + flashcards.length + ')</button>';
  html += '<button class="sfc-status-btn" data-sfc-status="done" onclick="window.sfcApplyStatusFilter(\'' + uniqueId + '\',\'done\')" style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid #e2e8f0;background:#fff;color:#1e293b;cursor:pointer;font-family:inherit">✅ Done (0)</button>';
  html += '</div>';

  // Category filter chips (clickable)
  if (catKeys.length > 0) {
    html += '<div class="sfc-filter-bar" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">';
    html += '<button class="sfc-filter-chip sfc-filter-active" data-sfc-filter="all" onclick="window.sfcApplyFilter(\'' + uniqueId + '\',\'all\')" style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid #4f46e5;background:#4f46e5;color:#fff;cursor:pointer;font-family:inherit">📋 All (' + flashcards.length + ')</button>';
    for (var ck = 0; ck < catKeys.length; ck++) {
      var cc = catColors[ck % catColors.length];
      html += '<button class="sfc-filter-chip" data-sfc-filter="' + esc(catKeys[ck]) + '" onclick="window.sfcApplyFilter(\'' + uniqueId + '\',\'' + esc(catKeys[ck]) + '\')" style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid ' + cc.border + ';background:' + cc.bg + ';color:' + cc.text + ';cursor:pointer;font-family:inherit">' + esc(catKeys[ck]) + ' (' + cats[catKeys[ck]] + ')</button>';
    }
    html += '</div>';
  }

  // Progress bar
  html += '<div class="sfc-progress" style="margin-bottom:16px">';
  html += '<div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px;color:var(--text-muted)"><span>Progress</span><span class="sfc-progress-text">0 mastered · 0 / ' + flashcards.length + ' reviewed</span></div>';
  html += '<div style="width:100%;height:6px;background:var(--border,#e2e8f0);border-radius:3px;overflow:hidden">';
  html += '<div class="sfc-progress-fill" style="width:0%;height:100%;background:#059669;border-radius:3px;transition:width 0.3s ease"></div>';
  html += '</div></div>';

  // Card grid
  html += '<div class="sfc-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px">';
  for (var i = 0; i < flashcards.length; i++) {
    var card = flashcards[i];
    var diff = card.difficulty || 'medium';
    var type = card.type || 'term';
    var catIdx = card.category ? catKeys.indexOf(card.category) : -1;
    var cc2 = catColors[catIdx >= 0 ? catIdx % catColors.length : i % catColors.length];
    var accentColor = diffDots[diff] || cc2.dot;
    var icon = typeIcons[type] || '📖';
    var typeLabel = typeLabels[type] || 'TERM';
    var frontContent = card.front || card.q || card.term || '';
    var backContent = card.back || card.a || card.definition || '';
    var isRich = /<[a-z][\s\S]*>/i.test(frontContent + backContent);

    var isMastered = masteredIndices.indexOf(i) !== -1;
    html += '<div class="sfc-card-wrapper' + (isMastered ? ' sfc-mastered' : '') + '" data-sfc-cat="' + esc(card.category || '') + '" data-sfc-diff="' + diff + '" data-sfc-idx="' + i + '" style="perspective:1000px">';
    html += '<div class="sfc-card" onclick="window.sfcFlipCard(this.closest(\'.sfc-card-wrapper\'),\'' + uniqueId + '\')" title="Click to flip">';
    html += '<div class="sfc-card-inner" style="position:relative;width:100%;min-height:240px;transition:transform 0.6s cubic-bezier(0.4,0,0.2,1);transform-style:preserve-3d">';

    // ── FRONT ──
    html += '<div class="sfc-face sfc-front" style="position:absolute;inset:0;backface-visibility:hidden;background:linear-gradient(145deg,' + cc2.bg + ',#fff);border:2px solid ' + accentColor + '33;border-radius:14px;padding:20px;display:flex;flex-direction:column;box-shadow:0 2px 8px rgba(0,0,0,0.04)">';
    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;flex-wrap:wrap">';
    html += '<span style="display:inline-flex;align-items:center;gap:3px;background:' + accentColor + ';color:#fff;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:700;letter-spacing:0.3px">' + icon + ' ' + typeLabel + '</span>';
    if (card.category) html += '<span style="display:inline-flex;align-items:center;gap:3px;background:' + cc2.bg + ';color:' + cc2.text + ';border:1px solid ' + cc2.border + ';padding:2px 10px;border-radius:12px;font-size:10px;font-weight:600">' + esc(card.category) + '</span>';
    html += '<span style="margin-left:auto;font-size:10px;color:#94a3b8;font-weight:600">' + (i + 1) + '/' + flashcards.length + '</span>';
    html += '</div>';
    html += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:10px"><span style="width:8px;height:8px;border-radius:50%;background:' + accentColor + ';display:inline-block"></span><span style="font-size:10px;color:' + accentColor + ';font-weight:600">' + esc(diffBadges[diff] || diff) + '</span></div>';
    html += '<div class="sfc-content" style="flex:1;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;padding:6px 2px;text-align:center;font-weight:700;color:#1e293b;font-size:15px;line-height:1.5;min-height:0">';
    html += isRich ? frontContent : ('<p style="margin:auto 0">' + esc(frontContent) + '</p>');
    html += '</div>';
    if (card.hint) html += '<div style="text-align:center;margin-top:8px;font-size:11px;color:#94a3b8;font-style:italic">💭 ' + esc(card.hint) + '</div>';
    html += '<div style="text-align:center;margin-top:10px;font-size:10px;color:#94a3b8;opacity:0.7">👆 Click to reveal</div>';
    html += '</div>';

    // ── BACK ──
    html += '<div class="sfc-face sfc-back" style="position:absolute;inset:0;backface-visibility:hidden;background:linear-gradient(145deg,#ecfdf5,#f0fdf4);border:2px solid #05966933;border-radius:14px;padding:20px;display:flex;flex-direction:column;box-shadow:0 2px 8px rgba(0,0,0,0.04);transform:rotateY(180deg)">';
    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:12px">';
    html += '<span style="display:inline-flex;align-items:center;gap:3px;background:#059669;color:#fff;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:700">💡 ANSWER</span>';
    html += '<span style="margin-left:auto;font-size:10px;color:#94a3b8;font-weight:600">' + (i + 1) + '/' + flashcards.length + '</span>';
    html += '</div>';
    html += '<div class="sfc-content" style="flex:1;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;padding:6px 2px;text-align:center;font-weight:600;color:#065f46;font-size:14px;line-height:1.6;min-height:0">';
    html += isRich ? backContent : ('<p style="margin:auto 0">' + esc(backContent) + '</p>');
    html += '</div>';
    // "I know this" / "Review again" toggle button
    html += '<div style="text-align:center;margin-top:10px">';
    html += '<button class="sfc-know-btn" onclick="event.stopPropagation();window.sfcToggleKnow(this,\'' + uniqueId + '\')" style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:14px;font-size:10px;font-weight:600;cursor:pointer;background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;font-family:inherit">' + (isMastered ? '✅ Got it!' : '⬜ I know this') + '</button>';
    html += '</div>';
    html += '<div style="text-align:center;margin-top:6px;font-size:10px;color:#94a3b8;opacity:0.7">👆 Click to flip back</div>';
    html += '</div>';

    html += '</div></div></div>';
  }
  html += '</div>';

  // Footer
  html += '<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:12px;margin-top:8px">🃏 Click cards to flip · Mark "I know this" when mastered · Use filters above</div>';

  return html + '</div>';
}

/** Render presentation slides with navigation and PDF export */
function renderPresentationInFlow(presHtml) {
  if (!presHtml) return '';
  var uniqueId = 'pres-' + Date.now();
  var html = '<div class="pres-container" id="' + uniqueId + '">';
  // Navigation bar
  html += '<div class="pres-nav" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 16px;background:var(--surface-alt,#f1f5f9);border:1px solid var(--border,#e2e8f0);border-radius:12px 12px 0 0;flex-wrap:wrap">';
  html += '<button class="btn btn-outline btn-sm" onclick="window.presNav(\'' + uniqueId + '\',-1)" title="Previous slide">◀ Prev</button>';
  html += '<span class="pres-counter" style="font-size:13px;color:var(--text-muted);font-weight:600;min-width:100px;text-align:center">Slide 1</span>';
  html += '<button class="btn btn-outline btn-sm" onclick="window.presNav(\'' + uniqueId + '\',1)" title="Next slide">Next ▶</button>';
  html += '<span style="color:var(--border);margin:0 4px">|</span>';
  html += '<button class="btn btn-sm" onclick="window.presFullscreen(\'' + uniqueId + '\')" style="background:var(--primary-bg,#eef2ff);color:var(--primary);border:1px solid var(--primary-light,#818cf8);font-size:12px;font-weight:600" title="Fullscreen presentation">📺 Fullscreen</button>';
  html += '<button class="btn btn-sm" onclick="window.print()" style="background:var(--success-light,#d1fae5);color:var(--success);border:1px solid var(--success);font-size:12px;font-weight:600" title="Export to PDF">📄 Export PDF</button>';
  html += '</div>';
  // Slides container
  html += '<div class="pres-slides-wrap" style="border:1px solid var(--border,#e2e8f0);border-top:none;border-radius:0 0 12px 12px;background:#fff;overflow:hidden">';
  html += presHtml;
  html += '</div>';
  return html + '</div>';
}

/* ═══════════════════════════════════════════
   PRESENTATION INTERACTIVITY (global functions — innerHTML-safe)
   ═══════════════════════════════════════════ */

window.presSlides = {};

/** Navigate slides: dir = -1 (prev) or +1 (next) */
window.presNav = function(containerId, dir) {
  var c = document.getElementById(containerId);
  if (!c) return;
  var slides = c.querySelectorAll('.pres-slide');
  if (!slides.length) return;
  var cur = window.presSlides[containerId] || 0;
  cur = Math.max(0, Math.min(slides.length - 1, cur + dir));
  window.presSlides[containerId] = cur;
  for (var i = 0; i < slides.length; i++) {
    slides[i].style.display = i === cur ? 'flex' : 'none';
  }
  var cnt = c.querySelector('.pres-counter');
  if (cnt) cnt.textContent = 'Slide ' + (cur + 1) + ' of ' + slides.length;
};

/** Toggle fullscreen for a presentation using browser Fullscreen API */
window.presFullscreen = function(containerId) {
  var c = document.getElementById(containerId);
  if (!c) return;
  var wrap = c.querySelector('.pres-slides-wrap');
  if (!wrap) return;
  // If already in our custom fullscreen, exit
  if (wrap.classList.contains('pres-fullscreen')) {
    window._presExitFullscreen(containerId);
    return;
  }
  // Try browser Fullscreen API first
  if (wrap.requestFullscreen) {
    wrap.requestFullscreen().catch(function() {
      // Fallback: CSS-only fullscreen
      window._presCssFullscreen(containerId, wrap);
    });
  } else if (wrap.webkitRequestFullscreen) {
    wrap.webkitRequestFullscreen();
  } else {
    // Fallback: CSS-only fullscreen
    window._presCssFullscreen(containerId, wrap);
  }
};

/** CSS fallback fullscreen with floating nav bar */
window._presCssFullscreen = function(containerId, wrap) {
  wrap.classList.add('pres-fullscreen');
  document.body.style.overflow = 'hidden';
  window._presShowFsNav(containerId, true);
};

/** Exit fullscreen (browser API or CSS) */
window._presExitFullscreen = function(containerId) {
  var c = document.getElementById(containerId);
  if (!c) return;
  var wrap = c.querySelector('.pres-slides-wrap');
  if (!wrap) return;
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(function(){});
  } else if (document.webkitFullscreenElement) {
    document.webkitExitFullscreen();
  }
  wrap.classList.remove('pres-fullscreen');
  document.body.style.overflow = '';
  window._presShowFsNav(containerId, false);
};

/** Show/hide floating fullscreen nav bar */
window._presShowFsNav = function(containerId, show) {
  var existing = document.querySelector('.pres-fs-nav');
  if (existing) existing.remove();
  if (!show) return;
  var c = document.getElementById(containerId);
  if (!c) return;
  var slides = c.querySelectorAll('.pres-slide');
  var cur = window.presSlides[containerId] || 0;
  var nav = document.createElement('div');
  nav.className = 'pres-fs-nav show';
  nav.innerHTML = '<button onclick="window.presNav(\'' + containerId + '\',-1)">◀ Prev</button>' +
    '<span class="pres-fs-counter">Slide ' + (cur+1) + ' of ' + slides.length + '</span>' +
    '<button onclick="window.presNav(\'' + containerId + '\',1)">Next ▶</button>' +
    '<button class="pres-fs-exit" onclick="window._presExitFullscreen(\'' + containerId + '\')">✕ Exit</button>';
  document.body.appendChild(nav);
  // Store ref for updating counter
  nav.setAttribute('data-pres-id', containerId);
};

/** Update fullscreen nav counter when slide changes */
window._presUpdateFsCounter = function(containerId) {
  var nav = document.querySelector('.pres-fs-nav[data-pres-id="' + containerId + '"]');
  if (!nav) return;
  var c = document.getElementById(containerId);
  if (!c) return;
  var slides = c.querySelectorAll('.pres-slide');
  var cur = window.presSlides[containerId] || 0;
  var cnt = nav.querySelector('.pres-fs-counter');
  if (cnt) cnt.textContent = 'Slide ' + (cur+1) + ' of ' + slides.length;
};

/** Navigate slides: dir = -1 (prev) or +1 (next) */
window.presNav = function(containerId, dir) {
  var c = document.getElementById(containerId);
  if (!c) return;
  var slides = c.querySelectorAll('.pres-slide');
  if (!slides.length) return;
  var cur = window.presSlides[containerId] || 0;
  cur = Math.max(0, Math.min(slides.length - 1, cur + dir));
  window.presSlides[containerId] = cur;
  for (var i = 0; i < slides.length; i++) {
    slides[i].style.display = i === cur ? 'flex' : 'none';
  }
  var cnt = c.querySelector('.pres-counter');
  if (cnt) cnt.textContent = 'Slide ' + (cur + 1) + ' of ' + slides.length;
  // Update fullscreen nav counter too
  window._presUpdateFsCounter(containerId);
};

/** Export to PDF — tries multiple methods */
window.presExportPdf = function() {
  try {
    // Try direct print first
    window.print();
  } catch(e1) {
    try {
      // Try parent window
      window.top.print();
    } catch(e2) {
      // Show fallback message
      if (typeof tool !== 'undefined' && tool.notify) {
        tool.notify('📄 To export as PDF: press Ctrl+P (or Cmd+P on Mac) in your browser, then choose "Save as PDF" as the printer.', 'info');
      } else {
        alert('To export as PDF: press Ctrl+P (or Cmd+P on Mac), then choose "Save as PDF".');
      }
    }
  }
};

/** Initialize all presentation containers: show slide 1, update counters, wire keyboard */
window.presInitAll = function() {
  var containers = document.querySelectorAll('.pres-container');
  for (var i = 0; i < containers.length; i++) {
    var c = containers[i];
    var slides = c.querySelectorAll('.pres-slide');
    if (slides.length) {
      for (var s = 0; s < slides.length; s++) {
        slides[s].style.display = s === 0 ? 'flex' : 'none';
      }
      var cnt = c.querySelector('.pres-counter');
      if (cnt) cnt.textContent = 'Slide 1 of ' + slides.length;
      window.presSlides[c.id] = 0;
    }
  }
  // Wire keyboard: left/right arrows navigate the currently visible presentation
  if (!window._presKeyBound) {
    window._presKeyBound = true;
    document.addEventListener('keydown', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        var dir = e.key === 'ArrowRight' ? 1 : -1;
        // Find the first visible pres-container (inside an expanded study step or active tab)
        var allContainers = document.querySelectorAll('.pres-container');
        for (var ci = 0; ci < allContainers.length; ci++) {
          var container = allContainers[ci];
          // Check if this container is visible (inside expanded step or active tab)
          var step = container.closest('.study-step');
          if (step) {
            var isExpanded = step.classList.contains('expanded');
            var isActiveTab = step.classList.contains('active-tab');
            var body = step.querySelector('.study-step-body');
            var bodyVisible = body && (body.style.display !== 'none');
            if (isExpanded || isActiveTab || bodyVisible) {
              window.presNav(container.id, dir);
              e.preventDefault();
              break;
            }
          } else {
            // Not inside a study step — just navigate
            window.presNav(container.id, dir);
            e.preventDefault();
            break;
          }
        }
      }
      // Escape key exits fullscreen
      if (e.key === 'Escape') {
        var fsNav = document.querySelector('.pres-fs-nav.show');
        if (fsNav) {
          var fsId = fsNav.getAttribute('data-pres-id');
          if (fsId) window._presExitFullscreen(fsId);
        }
      }
    });
  }
};

/* ═══════════════════════════════════════════
   FLASHCARD INTERACTIVITY (global functions — innerHTML-safe)
   ═══════════════════════════════════════════ */

/** Called onclick on a flashcard wrapper div. Toggles flip & updates progress. */
window.sfcFlipCard = function(wrapper, containerId) {
  var wasFlipped = wrapper.classList.contains('sfc-flipped');
  wrapper.classList.toggle('sfc-flipped');
  if (!wasFlipped) {
    window.updateSfcProgress(containerId);
  }
};

/** Called onclick on the "I know this" / "Got it!" button. Toggles mastered state. */
window.sfcToggleKnow = function(btn, containerId) {
  var wrapper = btn.closest('.sfc-card-wrapper');
  if (!wrapper) return;
  wrapper.classList.toggle('sfc-mastered');
  var isNowMastered = wrapper.classList.contains('sfc-mastered');
  btn.textContent = isNowMastered ? '✅ Got it!' : '⬜ I know this';
  window.updateSfcProgress(containerId);
  // Re-apply current status filter (so mastered cards move between Pending/Done)
  var container = document.getElementById(containerId);
  if (container) {
    var activeStatus = container.getAttribute('data-sfc-status-filter') || 'all';
    window.sfcApplyStatusFilter(containerId, activeStatus);
  }
  // Persist mastered state to in-memory PROGRESS (debounced save — no reload on every click)
  var sid = container ? container.getAttribute('data-sfc-sid') : '';
  var lid = container ? container.getAttribute('data-sfc-lid') : '';
  if (sid && lid) {
    if (!PROGRESS[sid]) PROGRESS[sid] = {};
    if (!PROGRESS[sid][lid]) PROGRESS[sid][lid] = {};
    var mastered = PROGRESS[sid][lid].flashcardMastered || [];
    var idx = parseInt(wrapper.getAttribute('data-sfc-idx'));
    if (!isNaN(idx)) {
      if (isNowMastered && mastered.indexOf(idx) === -1) {
        mastered.push(idx);
      } else if (!isNowMastered) {
        var pos = mastered.indexOf(idx);
        if (pos !== -1) mastered.splice(pos, 1);
      }
      PROGRESS[sid][lid].flashcardMastered = mastered;
      // Debounced save — avoids full re-render on every click
      if (window._sfcSaveTimer) clearTimeout(window._sfcSaveTimer);
      window._sfcSaveTimer = setTimeout(function() {
        saveProgress();
      }, 1500);
    }
  }
};

/** Called onclick on a category filter chip. Shows/hides cards by category. */
window.sfcApplyFilter = function(containerId, category) {
  var container = document.getElementById(containerId);
  if (!container) return;
  // Update active chip styling
  var chips = container.querySelectorAll('.sfc-filter-chip');
  for (var c = 0; c < chips.length; c++) {
    var chip = chips[c];
    var isActive = chip.getAttribute('data-sfc-filter') === category;
    if (isActive) {
      chip.classList.add('sfc-filter-active');
    } else {
      chip.classList.remove('sfc-filter-active');
    }
  }
  // Store current category filter
  container.setAttribute('data-sfc-cat-filter', category);
  // Apply combined filters (category + status)
  window._sfcApplyCombinedFilters(container);
};

/** Called onclick on a status filter button (All / Pending / Done). */
window.sfcApplyStatusFilter = function(containerId, status) {
  var container = document.getElementById(containerId);
  if (!container) return;
  // Update active button styling
  var btns = container.querySelectorAll('.sfc-status-btn');
  for (var b = 0; b < btns.length; b++) {
    var btn = btns[b];
    if (btn.getAttribute('data-sfc-status') === status) {
      btn.classList.add('sfc-status-active');
    } else {
      btn.classList.remove('sfc-status-active');
    }
  }
  // Store current status filter
  container.setAttribute('data-sfc-status-filter', status);
  // Apply combined filters
  window._sfcApplyCombinedFilters(container);
};

/** Internal: apply both category and status filters together */
window._sfcApplyCombinedFilters = function(container) {
  var catFilter = container.getAttribute('data-sfc-cat-filter') || 'all';
  var statusFilter = container.getAttribute('data-sfc-status-filter') || 'all';
  var wrappers = container.querySelectorAll('.sfc-card-wrapper');
  for (var w = 0; w < wrappers.length; w++) {
    var wr = wrappers[w];
    var cat = wr.getAttribute('data-sfc-cat') || '';
    var mastered = wr.classList.contains('sfc-mastered');
    var showByCat = (catFilter === 'all' || cat === catFilter);
    var showByStatus = (statusFilter === 'all' ||
      (statusFilter === 'done' && mastered) ||
      (statusFilter === 'pending' && !mastered));
    wr.style.display = (showByCat && showByStatus) ? '' : 'none';
  }
  window.updateSfcProgress(container.id);
};

/** Update the progress bar and text for a flashcard container. */
window.updateSfcProgress = function(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var wrappers = container.querySelectorAll('.sfc-card-wrapper');
  var total = wrappers.length;
  var mastered = 0;
  var reviewed = 0;
  for (var w = 0; w < wrappers.length; w++) {
    if (wrappers[w].classList.contains('sfc-mastered')) mastered++;
    if (wrappers[w].classList.contains('sfc-flipped')) reviewed++;
  }
  var fill = container.querySelector('.sfc-progress-fill');
  if (fill) fill.style.width = total > 0 ? Math.round((reviewed / total) * 100) + '%' : '0%';
  var txt = container.querySelector('.sfc-progress-text');
  if (txt) txt.textContent = mastered + ' mastered · ' + reviewed + ' / ' + total + ' reviewed';
  // Update the status filter button counts
  var allBtn = container.querySelector('.sfc-status-btn[data-sfc-status="all"]');
  if (allBtn) allBtn.textContent = '📋 All (' + total + ')';
  var pendingBtn = container.querySelector('.sfc-status-btn[data-sfc-status="pending"]');
  if (pendingBtn) pendingBtn.textContent = '⏳ Pending (' + (total - mastered) + ')';
  var doneBtn = container.querySelector('.sfc-status-btn[data-sfc-status="done"]');
  if (doneBtn) doneBtn.textContent = '✅ Done (' + mastered + ')';
};

/** Initialize all flashcard containers on the page (called after innerHTML insertion). */
window.sfcInitAll = function() {
  var containers = document.querySelectorAll('.enhanced-fc-student');
  for (var i = 0; i < containers.length; i++) {
    window.updateSfcProgress(containers[i].id);
  }
};

function showSections() {
  // Flush any pending debounced saves before navigating away
  flushPendingSaves();
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
  // Flush any pending debounced saves before navigating away
  flushPendingSaves();
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
  // Flush any pending debounced saves before navigating to a new lesson
  flushPendingSaves();
  if (!isLessonAccessible(sectionId, lessonId)) { tool.notify('🔒 You must complete all previous lessons first.', 'warning'); return; }
  activeStudyTab = 0; // new lesson starts on the first tab
  currentView = 'lesson-detail'; currentSectionId = sectionId; currentLessonId = lessonId;
  el('view-sections').style.display = 'none';
  el('view-lessons').style.display = 'none';
  el('view-lesson-detail').style.display = '';
  el('btn-back').style.display = '';
  var section = findSection(sectionId);
  var lesson = section ? findLesson(section, lessonId) : null;
  el('app-title').textContent = '📖 ' + (lesson ? (lesson.title || 'Lesson') : 'Lesson');
  // Phase 2: load heavy content from lesson doc (fallback to main doc data)
  loadLessonDocData(lesson, function(err, enrichedLesson) {
    window._currentEnrichedLesson = enrichedLesson || lesson;
    renderLessonDetail();
    window.scrollTo(0, 0);
    tool.resize();
  });
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
    if (prog.status !== 'completed' && prog.quizPassed !== true && !(typeof prog.score === 'number' && prog.score >= MIN_PASS_SCORE)) {
      tool.notify('You must pass the quiz (≥' + MIN_PASS_SCORE + '%) before completing this lesson.', 'warning');
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
  var mgmtType = CONFIG.managementType || 'self_paced';
  var newStatus = (mgmtType === 'supervised' && hasQuiz) ? 'pending_review' : 'completed';
  // Preserve quiz score + answers instead of wiping them on completion
  var existingProg = getLessonProgress(currentSectionId, currentLessonId);
  var prevScore = typeof existingProg.score === 'number' ? existingProg.score : null;
  var prevAnswers = (existingProg.quizAnswers && typeof existingProg.quizAnswers === 'object') ? JSON.parse(JSON.stringify(existingProg.quizAnswers)) : {};
  var prevAttempts = (existingProg.quizAttempts && Array.isArray(existingProg.quizAttempts)) ? JSON.parse(JSON.stringify(existingProg.quizAttempts)) : [];
  PROGRESS[currentSectionId][currentLessonId] = { status: newStatus, score: prevScore, completedAt: new Date().toISOString(), quizAttempts: prevAttempts, quizAnswers: prevAnswers, quizPassed: existingProg.quizPassed === true, quizSubmitted: true, flashcardMastered: (existingProg.flashcardMastered && Array.isArray(existingProg.flashcardMastered)) ? JSON.parse(JSON.stringify(existingProg.flashcardMastered)) : [], supervisorStatus: null, supervisorNotes: '' };
  if (window._quizStageTimer) { clearTimeout(window._quizStageTimer); window._quizStageTimer = null; }
  renderLessonDetail();
  updateProgressBar();
  saveProgress(true, function(res) {
    reportSaveResult(res, newStatus === 'pending_review' ? 'Lesson submitted for supervisor review' : 'Lesson marked as complete');
  });

  if (newStatus === 'completed') {
    var next = getNextLesson(currentSectionId, currentLessonId);
    if (next && isLessonAccessible(next.sectionId, next.lessonId)) setTimeout(function() { openLesson(next.sectionId, next.lessonId); }, 800);
    else setTimeout(function() { openSection(currentSectionId); }, 800);
  }
}

function markInProgress() {
  if (!currentSectionId || !currentLessonId) return;
  if (!PROGRESS[currentSectionId]) PROGRESS[currentSectionId] = {};
  PROGRESS[currentSectionId][currentLessonId] = { status: 'in_progress' };
  if (window._quizStageTimer) { clearTimeout(window._quizStageTimer); window._quizStageTimer = null; }
  renderLessonDetail();
  updateProgressBar();
  saveProgress(true, function(res) { reportSaveResult(res, 'Status changed'); });
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
  var prev = PROGRESS[currentSectionId][currentLessonId] || {};

  // Save the quiz result to the CMS, but DO NOT change the lesson status here.
  // Completion (or submission for supervisor review) only happens when the
  // student clicks "Mark Complete" in the Finish tab.
  if (passed) {
    PROGRESS[currentSectionId][currentLessonId] = {
      status: (prev.status === 'completed' || prev.status === 'pending_review') ? prev.status : 'in_progress',
      score: score,
      quizPassed: true,
      completedAt: prev.completedAt || null,
      quizAttempts: attempts,
      currentSet: 0,
      studyUntil: null,
      quizAnswers: JSON.parse(JSON.stringify(quizAnswers)),
      quizSubmitted: true,
      flashcardMastered: prev.flashcardMastered || [],
      supervisorStatus: prev.supervisorStatus || null,
      supervisorNotes: prev.supervisorNotes || ''
    };
  } else {
    var nextSet = currentSet + 1;
    if (nextSet >= QUIZ_SETS) nextSet = 0;
    PROGRESS[currentSectionId][currentLessonId] = {
      status: 'studying',
      score: score,
      quizPassed: false,
      completedAt: null,
      quizAttempts: attempts,
      currentSet: nextSet,
      studyUntil: new Date(Date.now() + STUDY_WAIT_MIN * 60 * 1000).toISOString(),
      quizAnswers: JSON.parse(JSON.stringify(quizAnswers)),
      quizSubmitted: true,
      flashcardMastered: prev.flashcardMastered || []
    };
  }

  quizSubmitted = true;
  if (window._quizStageTimer) { clearTimeout(window._quizStageTimer); window._quizStageTimer = null; }
  renderLessonDetail();
  updateProgressBar();
  // Real save attempt on Submit Answers — outcome reported honestly.
  saveProgress(true, function(res) {
    reportSaveResult(res, 'Quiz answers saved');
  });

  if (passed) {
    var mgmtType2 = CONFIG.managementType || 'self_paced';
    if (mgmtType2 === 'supervised') {
      tool.notify('Quiz passed! Score: ' + score + '%. Now go to the Finish tab and click "Mark Complete & Submit for Review".', 'success');
    } else {
      tool.notify('Quiz passed! Score: ' + score + '%. Now go to the Finish tab and click "Mark Complete".', 'success');
    }
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
    PROGRESS[currentSectionId][currentLessonId].quizSubmitted = false;
    PROGRESS[currentSectionId][currentLessonId].studyUntil = null;
  }
  if (window._quizStageTimer) { clearTimeout(window._quizStageTimer); window._quizStageTimer = null; }
  renderLessonDetail();
  updateProgressBar();
  saveProgress(true, function(res) { reportSaveResult(res, 'Quiz reset'); });
  tool.notify('Quiz ready. Good luck!', 'info');
}

/* ═══════════════════════════════════════════
   DATA LOADING
   ═══════════════════════════════════════════ */

function loadCurriculum(callback) {
  var sourceId = CONFIG.curriculumSourceId;
  var fieldName = tool.param('builderFieldName', '');

  if (!sourceId) {
    SECTIONS = [];
    if (callback) callback();
    renderCurrentView();
    updateProgressBar();
    tool.resize();
    return;
  }

  showLoading(true);

  var queryParams = { mainObjectType: SECTIONS_TYPE };

  tool.requestObjects('query', queryParams, function(err, result) {
    showLoading(false);

    if (err) {
      tool.notify('Error loading curriculum: ' + JSON.stringify(err), 'error');
      SECTIONS = [];
    } else {
      var objects = [];
      if (result) {
        if (Array.isArray(result)) { objects = result; }
        else if (Array.isArray(result.objects)) { objects = result.objects; }
        else if (Array.isArray(result.items)) { objects = result.items; }
        else if (Array.isArray(result.data)) { objects = result.data; }
      }

      var contentIdsFound = [];
      for (var k = 0; k < objects.length; k++) {
        var cid = objects[k].contentId || objects[k].id || '(no id)';
        contentIdsFound.push(cid);
      }

      if (objects.length === 0) {
        tool.notify('Query returned 0 objects of type "' + SECTIONS_TYPE + '". Check the Curriculum Builder App ID matches.', 'error');
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
          SECTIONS = findSectionsInObject(found, fieldName);
          if (SECTIONS.length === 0) {
            if (fieldName) {
              tool.notify('Object found but no sections at field "' + fieldName + '". Check builderFieldName.', 'warning');
            } else {
              tool.notify('Object found but no sections data. Set builderFieldName in Tool Parameters.', 'warning');
            }
          }
        }
      }
    }
    if (callback) callback();
    probeLessonDocAccess();  // diagnose missing lesson-doc CRUD config once
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
    CONFIG.managementType = val.config.managementType || 'self_paced';
    CONFIG.dashboardVisible = val.config.dashboardVisible !== undefined ? val.config.dashboardVisible : false;
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
  var fill = el('progress-bar-fill');
  var text = el('progress-bar-text');
  if (fill) fill.style.width = pct + '%';
  if (text) text.textContent = pct + '% Complete (' + completed + ' of ' + all.length + ' lessons)';
}

function showLoading(show) { el('loading-overlay').style.display = show ? '' : 'none'; }

/* ── Role badge ── */
function updateRoleBadge(user) {
  var badge = el('role-badge');
  if (!badge) return;
  if (!user) { badge.style.display = 'none'; return; }
  badge.style.display = '';
  var name = user.name || user.displayName || user.email || user.id || 'Student';
  badge.textContent = '👤 ' + name + (isAdmin() ? ' 🛡️' : '');
  badge.title = isAdmin() ? 'Admin (manager access on this record)' : 'Student (no manager access)';
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

/** Show the setup screen (only for admins). Non-admins are redirected back. */
function showSetup() {
  if (!isAdmin()) {
    // Non-admins: silently redirect. If no curriculum, show a clean message in the UI.
    if (!CONFIG.curriculumSourceId) {
      el('view-setup').style.display = 'none';
      el('view-sections').style.display = '';
      el('view-lessons').style.display = 'none';
      el('view-lesson-detail').style.display = 'none';
      el('progress-bar-wrap').style.display = 'none';
      el('app-title').textContent = '📚 Self-Paced Learning';
      el('section-group-grid').innerHTML = '<div class="empty-state"><div class="empty-icon">🔒</div><div class="empty-title">No course configured yet</div><div class="empty-desc">Please contact your administrator to set up the course curriculum.</div></div>';
      tool.resize();
      return;
    }
    cancelSetup();
    return;
  }
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

  // Management type selector — update value if it exists, create if not
  var selectContainer = select.parentNode;
  var existingMgmt = el('setup-management-type');
  if (existingMgmt) {
    existingMgmt.value = CONFIG.managementType || 'self_paced';
  } else {
    var mgmtHtml = '<label class="setup-label" style="margin-top:16px">📋 Course Management Type</label>';
    mgmtHtml += '<select class="setup-select" id="setup-management-type">';
    mgmtHtml += '<option value="self_paced"' + (CONFIG.managementType !== 'supervised' ? ' selected' : '') + '>🚀 Self-Paced — lessons unlock automatically</option>';
    mgmtHtml += '<option value="supervised"' + (CONFIG.managementType === 'supervised' ? ' selected' : '') + '>🛡️ Supervised — supervisor approves each lesson</option>';
    mgmtHtml += '</select>';
    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = mgmtHtml;
    selectContainer.appendChild(tempDiv.firstElementChild);
  }

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
  var mgmtSelect = el('setup-management-type');
  var mgmtType = mgmtSelect ? mgmtSelect.value : 'self_paced';

  if (!selectedId) {
    tool.notify('Please select a curriculum.', 'warning');
    return;
  }

  // Reset progress if switching to a different curriculum
  if (CONFIG.curriculumSourceId && CONFIG.curriculumSourceId !== selectedId) {
    PROGRESS = {};
  }

  CONFIG.curriculumSourceId = selectedId;
  CONFIG.managementType = mgmtType;

  // Switch view BEFORE saving — so onValueChange won't re-render setup
  el('view-setup').style.display = 'none';
  el('progress-bar-wrap').style.display = '';
  currentView = 'sections';

  // Persist config
  saveProgress(true);

  tool.notify('Curriculum configured! Loading...', 'success');

  // Load curriculum now (onValueChange may also trigger this, but double-load is harmless)
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
  // Dashboard toggle — visible for admins when curriculum is loaded
  var dashBtn = el('btn-toggle-dashboard');
  if (dashBtn) {
    dashBtn.style.display = (isAdmin() && CONFIG.curriculumSourceId) ? '' : 'none';
    dashBtn.textContent = (CONFIG.dashboardVisible !== false) ? '📊 Hide Dashboard' : '📊 Dashboard';
  }
  // Disable save button in setup if not admin
  var saveBtn = el('btn-setup-save');
  if (saveBtn && currentView === 'setup') {
    saveBtn.disabled = !isAdmin();
  }
  // Force-remove supervisor panel from DOM for non-admins (belt-and-suspenders)
  if (!isAdmin()) {
    var panel = el('supervisor-panel');
    if (panel) panel.remove();
  }
  // Render supervisor panel if in supervised mode
  renderSupervisorPanel();
}

/** Supervisor panel — admin dashboard showing full course progress + pending reviews */
function renderSupervisorPanel() {
  var existing = el('supervisor-panel');
  if (existing) existing.remove();
  if (!isAdmin()) return;
  if (CONFIG.dashboardVisible === false) return;

  var all = getAllLessonsInOrder();
  if (all.length === 0) return;

  // Gather stats
  var totalLessons = all.length;
  var completed = 0, inProgress = 0, notStarted = 0, pendingReview = 0;
  var pendingItems = [];
  var sectionStats = {}; // sectionId → { title, total, completed, inProgress, notStarted, pendingReview }
  for (var i = 0; i < all.length; i++) {
    var sid = all[i].sectionId;
    var lid = all[i].lessonId;
    var prog = getLessonProgress(sid, lid);
    var sec = findSection(sid);
    var les = sec ? findLesson(sec, lid) : null;
    var secTitle = sec ? sec.title : 'Unknown Section';
    if (!sectionStats[sid]) sectionStats[sid] = { title: secTitle, total: 0, completed: 0, inProgress: 0, notStarted: 0, pendingReview: 0, lessons: [] };
    sectionStats[sid].total++;
    var lessonEntry = { lessonId: lid, title: les ? les.title : 'Unknown', status: prog.status, score: prog.score };
    sectionStats[sid].lessons.push(lessonEntry);
    if (prog.status === 'completed') { completed++; sectionStats[sid].completed++; }
    else if (prog.status === 'pending_review') { pendingReview++; sectionStats[sid].pendingReview++; pendingItems.push({ sectionId: sid, lessonId: lid, sectionTitle: secTitle, lessonTitle: les ? les.title : '', score: prog.score }); }
    else if (prog.status === 'in_progress' || prog.status === 'studying') { inProgress++; sectionStats[sid].inProgress++; }
    else { notStarted++; sectionStats[sid].notStarted++; }
  }
  var overallPct = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;

  var panel = document.createElement('div');
  panel.id = 'supervisor-panel';
  panel.style.cssText = 'margin:12px 20px;padding:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-md)';

  // ── Header ──
  var html = '<div style="background:linear-gradient(135deg,#1e293b,#334155);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">';
  html += '<div style="display:flex;align-items:center;gap:10px"><span style="font-size:22px">📊</span><div><div style="font-weight:700;color:#f1f5f9;font-size:15px">Supervisor Dashboard</div><div style="font-size:11px;color:#94a3b8">' + esc(CONFIG.managementType === 'supervised' ? '🛡️ Supervised' : '🚀 Self-Paced') + ' · ' + totalLessons + ' lessons in ' + Object.keys(sectionStats).length + ' section(s)</div></div></div>';
  // Overall progress ring
  html += '<div style="display:flex;align-items:center;gap:12px;background:rgba(255,255,255,0.08);border-radius:10px;padding:8px 16px">';
  html += '<svg width="44" height="44"><circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="4"/><circle cx="22" cy="22" r="18" fill="none" stroke="#22c55e" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + (2*Math.PI*18) + '" stroke-dashoffset="' + (2*Math.PI*18*(1-overallPct/100)) + '" transform="rotate(-90,22,22)"/><text x="22" y="22" text-anchor="middle" dominant-baseline="central" style="font-size:10px;font-weight:800;fill:#f1f5f9">' + overallPct + '%</text></svg>';
  html += '<div style="color:#f1f5f9;font-size:12px;line-height:1.4"><strong>' + completed + '</strong> done<br><span style="color:#94a3b8">' + inProgress + ' active · ' + notStarted + ' new</span></div>';
  html += '</div></div>';

  // ── Quick stats bar ──
  html += '<div style="display:flex;flex-wrap:wrap;gap:6px;padding:10px 20px;border-bottom:1px solid var(--border);background:var(--surface-alt);align-items:center">';
  html += '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#d1fae5;color:#065f46">✅ ' + completed + ' Completed</span>';
  html += '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#fef3c7;color:#92400e">📖 ' + inProgress + ' In Progress</span>';
  html += '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#f1f5f9;color:#64748b">📌 ' + notStarted + ' Not Started</span>';
  if (pendingReview > 0) html += '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#fee2e2;color:#991b1b">⏳ ' + pendingReview + ' Awaiting Review</span>';
  html += '<span style="flex:1"></span>';
  html += '<button data-sup-reset-all style="font-size:10px;padding:3px 10px;border-radius:12px;border:1px solid #d1d5db;background:#fff;color:#64748b;cursor:pointer;white-space:nowrap" title="Reset all student progress back to Not Started">🗑 Reset All Progress</button>';
  html += '</div>';

  // ── Section breakdown ──
  html += '<div style="padding:14px 20px">';
  html += '<div style="font-weight:700;color:var(--text);font-size:13px;margin-bottom:10px">📁 Section Breakdown</div>';
  var secIds = Object.keys(sectionStats);
  for (var si = 0; si < secIds.length; si++) {
    var ss = sectionStats[secIds[si]];
    var secPct = ss.total > 0 ? Math.round((ss.completed / ss.total) * 100) : 0;
    var barColor = secPct === 100 ? '#22c55e' : secPct > 0 ? '#f59e0b' : '#e2e8f0';
    html += '<div style="margin-bottom:10px">';
    html += '<div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:12px"><span style="font-weight:600;color:var(--text)">' + esc(ss.title) + '</span><span style="color:var(--text-muted)">' + ss.completed + '/' + ss.total + ' · ' + secPct + '%</span></div>';
    html += '<div style="width:100%;height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden;display:flex">';
    if (ss.completed > 0) html += '<div style="width:' + (ss.completed/ss.total*100) + '%;height:100%;background:#22c55e;border-radius:3px 0 0 3px"></div>';
    if (ss.inProgress > 0) html += '<div style="width:' + (ss.inProgress/ss.total*100) + '%;height:100%;background:#f59e0b"></div>';
    if (ss.pendingReview > 0) html += '<div style="width:' + (ss.pendingReview/ss.total*100) + '%;height:100%;background:#ef4444"></div>';
    html += '</div>';
    // Lesson status dots
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">';
    for (var li = 0; li < ss.lessons.length; li++) {
      var l = ss.lessons[li];
      var dot = l.status === 'completed' ? '🟢' : l.status === 'pending_review' ? '🟡' : l.status === 'in_progress' || l.status === 'studying' ? '🔵' : '⚪';
      html += '<span title="' + esc(l.title) + ' — ' + (l.status === 'completed' ? 'Done' + (typeof l.score==='number'?' ('+l.score+'%)':'') : l.status === 'pending_review' ? 'Pending review' : l.status === 'in_progress'||l.status==='studying' ? 'In progress' : 'Not started') + '" style="font-size:14px;cursor:default">' + dot + '</span>';
    }
    html += '</div></div>';
  }
  html += '</div>';

  // ── Pending review actions (supervised mode only) ──
  var mgmtType = CONFIG.managementType || 'self_paced';
  if (pendingItems.length > 0 && mgmtType === 'supervised') {
    html += '<div style="border-top:2px solid #fca5a5;padding:14px 20px;background:#fef2f2">';
    html += '<div style="font-weight:700;color:#991b1b;font-size:13px;margin-bottom:8px">⏳ Pending Review — Action Required</div>';
    html += pendingItems.map(function(p) {
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;margin-bottom:4px;background:#fff;border:1px solid #fecaca;border-radius:8px;gap:8px;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:0"><strong style="font-size:13px">' + esc(p.lessonTitle) + '</strong> <span style="color:var(--text-muted);font-size:11px">in ' + esc(p.sectionTitle) + '</span>' +
        (typeof p.score === 'number' ? ' <span style="font-size:11px;color:#92400e;font-weight:600">· ' + p.score + '%</span>' : '') +
        '</div>' +
        '<div style="display:flex;gap:4px;flex-shrink:0">' +
        '<button class="btn btn-sm" data-sup-approve="' + p.sectionId + '|' + p.lessonId + '" style="background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;font-size:11px;padding:3px 10px">✓ Approve</button>' +
        '<button class="btn btn-sm" data-sup-reject="' + p.sectionId + '|' + p.lessonId + '" style="background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;font-size:11px;padding:3px 10px">✕ Reject</button>' +
        '</div></div>';
    }).join('');
    html += '</div>';
  }

  panel.innerHTML = html;

  var header = document.querySelector('.app-header');
  if (header && header.parentNode) {
    header.parentNode.insertBefore(panel, header.nextSibling);
  }

  // Wire approve/reject/reset buttons
  setTimeout(function() {
    var approveBtns = panel.querySelectorAll('[data-sup-approve]');
    for (var a = 0; a < approveBtns.length; a++) {
      approveBtns[a].addEventListener('click', function() {
        var parts = this.getAttribute('data-sup-approve').split('|');
        supervisorAction(parts[0], parts[1], 'approved', '');
      });
    }
    var rejectBtns = panel.querySelectorAll('[data-sup-reject]');
    for (var r = 0; r < rejectBtns.length; r++) {
      rejectBtns[r].addEventListener('click', function() {
        var parts = this.getAttribute('data-sup-reject').split('|');
        var notes = prompt('Rejection reason / feedback for the student:');
        if (notes === null) return;
        supervisorAction(parts[0], parts[1], 'rejected', notes || 'Please review and resubmit.');
      });
    }
    var resetBtn = panel.querySelector('[data-sup-reset-all]');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetAllProgress);
    }
  }, 50);
}

function supervisorAction(sectionId, lessonId, decision, notes) {
  if (!PROGRESS[sectionId]) PROGRESS[sectionId] = {};
  if (!PROGRESS[sectionId][lessonId]) PROGRESS[sectionId][lessonId] = {};
  var p = PROGRESS[sectionId][lessonId];
  if (decision === 'approved') {
    p.status = 'completed';
    p.supervisorStatus = 'approved';
    p.supervisorNotes = notes;
    p.completedAt = new Date().toISOString();
    tool.notify('Lesson approved! ✅', 'success');
  } else {
    p.status = 'in_progress';
    p.supervisorStatus = 'rejected';
    p.supervisorNotes = notes;
    p.completedAt = null;
    tool.notify('Lesson rejected. Student will see your feedback. 📝', 'info');
  }
  renderSupervisorPanel();
  updateProgressBar();
  if (currentView === 'lessons') renderLessons();
  saveProgress(true, function(res) { reportSaveResult(res, 'Supervisor decision saved'); });
}

/** Show/hide the supervisor dashboard panel */
function toggleDashboard() {
  CONFIG.dashboardVisible = !CONFIG.dashboardVisible;
  var dashBtn = el('btn-toggle-dashboard');
  dashBtn.textContent = CONFIG.dashboardVisible ? '📊 Hide Dashboard' : '📊 Dashboard';
  saveProgress(true);
  renderSupervisorPanel();
}

/** Reset all student progress back to Not Started (admin only) */
function resetAllProgress() {
  if (!isAdmin()) { tool.notify('Only admins can reset progress.', 'warning'); return; }
  if (!confirm('This will reset ALL lesson progress for this student back to "Not Started".\n\nThis action cannot be undone. Continue?')) return;
  PROGRESS = {};
  saveProgress(true, function(res) { reportSaveResult(res, 'Progress reset'); });
  renderSupervisorPanel();
  updateProgressBar();
  if (currentView === 'sections') renderSections();
  else if (currentView === 'lessons') renderLessons();
  else if (currentView === 'lesson-detail') renderLessonDetail();
  tool.notify('All progress has been reset.', 'success');
}

/* ═══════════════════════════════════════════
   EVENT BINDINGS
   ═══════════════════════════════════════════ */

function bindEvents() {
  el('btn-back').addEventListener('click', handleBack);
  el('search-input').addEventListener('input', function() { renderSections(); });
  el('filter-status').addEventListener('change', function() { renderSections(); });
  el('btn-setup-save').addEventListener('click', saveSetupConfig);
  el('btn-setup-cancel').addEventListener('click', cancelSetup);
  el('btn-change-course').addEventListener('click', function() { showSetup(); });
  el('btn-toggle-dashboard').addEventListener('click', toggleDashboard);
  el('btn-dark-mode').addEventListener('click', toggleDarkMode);
}

/* ── Dark Mode ── */
function toggleDarkMode() {
  var isDark = document.body.classList.toggle('dark');
  localStorage.setItem('sp-dark-mode', isDark ? '1' : '0');
  el('btn-dark-mode').textContent = isDark ? '☀️' : '🌙';
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
    { name: 'curriculumBuilderAppId', label: 'Curriculum Builder App ID', type: 'text', default: 'curriculum-builder-uniconbaseapps', severity: 'goodToHave', hint: 'The CMS object type ID of the Curriculum Builder app. Used to query curriculum objects. Default works for most cases.' },
    { name: 'allowRequestSave', label: 'Allow Save Request', type: 'toggle', default: 'no', severity: 'mandatory', hint: 'Must be "yes" so quiz answers and progress are saved to the CMS record immediately on Submit Answers (field setting: Allow Save Request).' }
  ]);

  var stype = tool.param('curriculumBuilderAppId', 'curriculum-builder-uniconbaseapps');
  SECTIONS_TYPE = stype || 'curriculum-builder-uniconbaseapps';

  // Guide the admin: without Allow Save Request, Submit Answers can only
  // stage data and a warning is shown instead of a save confirmation.
  if (tool.param('allowRequestSave', 'no') !== 'yes') {
    try {
      tool.reportMissingParams([{
        name: 'allowRequestSave', label: 'Allow Save Request', type: 'toggle', default: 'yes', severity: 'mandatory',
        reason: 'Quiz answers and lesson progress must be saved to the CMS record immediately when the student clicks Submit Answers.'
      }], 'This tool needs "Allow Save Request" enabled on the field settings so student answers persist immediately.');
    } catch(e) {}
  }

  // Load config from object data (set by admin via setup screen)
  loadData(val);
  updateRoleBadge(tool.getUser());
  bindEvents();
  debugLogUser();         // log CMS user identity to browser console
  probeToolApi();         // log SDK save capability + settings (see console)

  // Dark mode init
  if (localStorage.getItem('sp-dark-mode') === '1') {
    document.body.classList.add('dark');
    el('btn-dark-mode').textContent = '☀️';
  }

  tool.onValueChange(function(v) {
    var internal = _suppressNextValueChange && JSON.stringify(v || null) === _lastSavedJson;
    _suppressNextValueChange = false;
    loadData(v);
    // Our own saveProgress() — the caller already re-rendered the view.
    // Skip the heavy curriculum reload so the active tab stays put and
    // nothing flickers or appears to lose data.
    if (internal) return;
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
      updateAdminUI();  // re-render supervisor panel now that SECTIONS is loaded
      tool.resize();
    });
  }
});
