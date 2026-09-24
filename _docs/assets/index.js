/* ==========================================================================
   SHARED DOCS INDEX BEHAVIOR - _docs/assets/index.js
   --------------------------------------------------------------------------
   The engine behind every tool's docs/index.html (linked from this one
   shared copy). The per-tool index.html carries ONLY its data - two JSON
   payloads (code-payload for the HTML/CSS/JS panes, shots-payload for the
   screenshot viewer). All behavior lives here:
   - left menu switching between document iframes,
   - code viewer panes with Copy / Open buttons,
   - the screenshot viewer (preview + info panel + thumbnails),
   - ?doc= URL shortcut and keyboard navigation.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__docsIndexEngineBooted) return;
  window.__docsIndexEngineBooted = true;

  function boot() {
    var frame = document.getElementById('docs-frame');
    var openButton = document.getElementById('docs-open');
    var codeView = document.getElementById('docs-code-view');
    var codeTitle = document.getElementById('docs-code-title');
    var codeMeta = document.getElementById('docs-code-meta');
    var codeElement = document.getElementById('docs-code-code');
    var codeCopyButton = document.getElementById('docs-code-copy');
    var codeOpenButton = document.getElementById('docs-code-open');
    var navItems = Array.prototype.slice.call(document.querySelectorAll('.docs-nav-item'));
    var currentSource = 'ssot.html';
    var currentCodeKind = '';

    var codePayload = { html: null, css: null, js: null };
    try {
      codePayload = JSON.parse(document.getElementById('code-payload').textContent) || codePayload;
    } catch (error) { /* payload unavailable */ }

    /* ---- screenshots viewer ---- */
    var shotsView = document.getElementById('docs-shots-view');
    var shotsImg = document.getElementById('docs-shots-img');
    var shotsEmpty = document.getElementById('docs-shots-empty');
    var shotsInfo = document.getElementById('docs-shots-info');
    var shotsThumbs = document.getElementById('docs-shots-thumbs');
    var shotsPrev = document.getElementById('docs-shots-prev');
    var shotsNext = document.getElementById('docs-shots-next');
    var shotsPayload = [];
    try {
      shotsPayload = JSON.parse(document.getElementById('shots-payload').textContent) || [];
    } catch (error) { /* payload unavailable */ }
    var currentShotIndex = 0;

    function activateItem(activeItem) {
      navItems.forEach(function (item) { item.classList.toggle('active', item === activeItem); });
    }

    function showCodePane(kind) {
      var entry = codePayload[kind];
      currentCodeKind = kind;
      codeView.classList.add('visible');
      shotsView.classList.remove('visible');
      frame.style.display = 'none';
      if (openButton) openButton.style.display = 'none';
      if (!entry) {
        codeTitle.textContent = kind.toUpperCase() + ' code';
        codeMeta.textContent = 'no ' + kind + ' file in the app folder';
        codeElement.textContent = '';
        return;
      }
      codeTitle.textContent = entry.name;
      var lineCount = entry.content ? entry.content.split('\n').length : 0;
      codeMeta.textContent = lineCount + ' lines - ' + (entry.content ? entry.content.length : 0) + ' characters';
      codeElement.textContent = entry.content || '';
      codeView.scrollTop = 0;
    }

    function renderShotsInfo(shot) {
      if (!shotsInfo) return;
      if (!shot) { shotsInfo.innerHTML = ''; return; }
      var fields = [
        ['File', shot.name || ''],
        ['Shot', shot.label || ''],
        ['Page', shot.page || ''],
        ['Viewport', shot.viewport || ''],
        ['Dimensions', shot.width && shot.height ? shot.width + ' \u00d7 ' + shot.height + ' px' : ''],
        ['Captured', shot.capturedAt ? shot.capturedAt.replace('T', ' ').slice(0, 19) + ' UTC' : ''],
        ['Used in', Array.isArray(shot.usedIn) && shot.usedIn.length ? shot.usedIn.join(', ') : 'docs index viewer'],
      ];
      shotsInfo.innerHTML = '<p class="docs-shots-counter">Screenshot ' + (currentShotIndex + 1) + ' of ' + shotsPayload.length + '</p>' +
        '<dl>' + fields.filter(function (field) { return field[1]; })
          .map(function (field) { return '<div><dt>' + field[0] + '</dt><dd>' + field[1] + '</dd></div>'; })
          .join('') + '</dl>';
    }

    function showShot(index) {
      if (!shotsPayload.length) {
        if (shotsImg) shotsImg.style.display = 'none';
        if (shotsEmpty) shotsEmpty.style.display = '';
        if (shotsPrev) shotsPrev.style.display = 'none';
        if (shotsNext) shotsNext.style.display = 'none';
        if (shotsThumbs) shotsThumbs.style.display = 'none';
        renderShotsInfo(null);
        return;
      }
      currentShotIndex = ((index % shotsPayload.length) + shotsPayload.length) % shotsPayload.length;
      var shot = shotsPayload[currentShotIndex];
      if (shotsImg) {
        shotsImg.style.display = '';
        shotsImg.src = shot.src;
      }
      if (shotsEmpty) shotsEmpty.style.display = 'none';
      if (shotsPrev) shotsPrev.style.display = shotsPayload.length > 1 ? '' : 'none';
      if (shotsNext) shotsNext.style.display = shotsPayload.length > 1 ? '' : 'none';
      if (shotsThumbs) {
        shotsThumbs.innerHTML = shotsPayload.map(function (entry, i) {
          return '<button class="docs-shots-thumb' + (i === currentShotIndex ? ' active' : '') + '" type="button" data-shot-index="' + i + '">' +
            '<img src="' + entry.src + '" alt="' + (entry.label || entry.name) + '" loading="lazy" />' +
            '<span>' + (entry.label || entry.name) + '</span></button>';
        }).join('');
      }
      renderShotsInfo(shot);
    }

    function openShotsPane() {
      currentCodeKind = '';
      codeView.classList.remove('visible');
      shotsView.classList.add('visible');
      frame.style.display = 'none';
      if (openButton) openButton.style.display = 'none';
      showShot(currentShotIndex);
    }

    if (shotsThumbs) {
      shotsThumbs.addEventListener('click', function (event) {
        var thumb = event.target.closest ? event.target.closest('.docs-shots-thumb') : null;
        if (!thumb) return;
        showShot(Number(thumb.getAttribute('data-shot-index')) || 0);
      });
    }
    if (shotsPrev) shotsPrev.addEventListener('click', function () { showShot(currentShotIndex - 1); });
    if (shotsNext) shotsNext.addEventListener('click', function () { showShot(currentShotIndex + 1); });
    document.addEventListener('keydown', function (event) {
      if (!shotsView.classList.contains('visible')) return;
      if (event.key === 'ArrowLeft') showShot(currentShotIndex - 1);
      if (event.key === 'ArrowRight') showShot(currentShotIndex + 1);
      if (event.key === 'Escape') { shotsView.classList.remove('visible'); frame.style.display = ''; if (openButton) openButton.style.display = ''; }
    });

    function showDocumentPane(item) {
      currentCodeKind = '';
      codeView.classList.remove('visible');
      shotsView.classList.remove('visible');
      frame.style.display = '';
      if (openButton) openButton.style.display = '';
      currentSource = item.getAttribute('data-src');
      frame.src = currentSource;
    }

    function openItem(item) {
      if (!item) return;
      activateItem(item);
      if (item.getAttribute('data-doc') === 'screenshots') {
        openShotsPane();
      } else if (item.getAttribute('data-doc').indexOf('code-') === 0) {
        showCodePane(item.getAttribute('data-doc').slice(5));
      } else {
        showDocumentPane(item);
      }
      try { window.location.hash = 'doc=' + item.getAttribute('data-doc'); } catch (error) { /* ignore */ }
    }

    navItems.forEach(function (item) {
      item.addEventListener('click', function () { openItem(item); });
    });

    if (openButton) {
      openButton.addEventListener('click', function () {
        var fullUrl = new URL(currentSource, window.location.href).href;
        try { window.open(fullUrl, '_blank'); } catch (error) { /* blocked */ }
      });
    }

    if (codeCopyButton) {
      codeCopyButton.addEventListener('click', function () {
        var entry = codePayload[currentCodeKind];
        var text = entry && entry.content ? entry.content : '';
        if (!text) return;
        function markCopied() {
          codeCopyButton.textContent = 'Copied \u2713';
          codeCopyButton.classList.add('copied');
          setTimeout(function () {
            codeCopyButton.textContent = 'Copy code';
            codeCopyButton.classList.remove('copied');
          }, 1600);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(markCopied).catch(function () { fallbackCopy(text, markCopied); });
        } else {
          fallbackCopy(text, markCopied);
        }
      });
    }

    if (codeOpenButton) {
      codeOpenButton.addEventListener('click', function () {
        var entry = codePayload[currentCodeKind];
        if (!entry || !entry.src) return;
        var fullUrl = new URL(entry.src, window.location.href).href;
        try { window.open(fullUrl, '_blank'); } catch (error) { /* blocked */ }
      });
    }

    function fallbackCopy(text, markCopied) {
      var textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try { document.execCommand('copy'); } catch (error) { /* copying unavailable */ }
      document.body.removeChild(textArea);
      markCopied();
    }

    // ?doc= or #doc= shortcut opens that document on load
    try {
      var requestedDoc = new URLSearchParams(window.location.search).get('doc')
        || window.location.hash.replace(/^#doc=/, '');
      if (requestedDoc) {
        var requestedItem = navItems.find(function (item) { return item.getAttribute('data-doc') === requestedDoc; });
        if (requestedItem) openItem(requestedItem);
      }
    } catch (error) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
