/* ==========================================================================
   SHARED WEBPAGE BEHAVIOR - _docs/assets/webpage.js
   --------------------------------------------------------------------------
   One stable behavior for every tool marketing page (docs/webpage.html):
   - the screenshot gallery opens a full-screen lightbox viewer (click a
     thumbnail, browse with arrows, close with Esc / ✕ / backdrop). The
     public page carries IMAGES ONLY - the tool's code is never embedded,
     so nobody (human or AI) can reach the source from the page,
   - broken screenshot images fall back to a "Screenshot coming soon" plate,
   - in-page anchor links scroll smoothly.
   Idempotent: safe when several tool pages are pasted on the same website.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__wpEngineBooted) return;
  window.__wpEngineBooted = true;

  function boot() {
    // screenshot gallery -> lightbox viewer (images only, never tool code)
    var galleryItems = Array.prototype.slice.call(document.querySelectorAll('.wp-gallery-item'));
    if (galleryItems.length) {
      var lightbox = document.createElement('div');
      lightbox.className = 'wp-lightbox';
      lightbox.innerHTML =
        '<button class="wp-lightbox-close" type="button" title="Close">&times;</button>' +
        '<button class="wp-lightbox-arrow prev" type="button" title="Previous">&#9664;</button>' +
        '<img alt="Screenshot preview" />' +
        '<button class="wp-lightbox-arrow next" type="button" title="Next">&#9654;</button>' +
        '<div class="wp-lightbox-caption"></div>' +
        '<div class="wp-lightbox-counter"></div>';
      document.body.appendChild(lightbox);

      var lightboxImg = lightbox.querySelector('img');
      var lightboxCaption = lightbox.querySelector('.wp-lightbox-caption');
      var lightboxCounter = lightbox.querySelector('.wp-lightbox-counter');
      var currentGalleryIndex = 0;

      function showGalleryShot(index) {
        if (!galleryItems.length) return;
        currentGalleryIndex = ((index % galleryItems.length) + galleryItems.length) % galleryItems.length;
        var item = galleryItems[currentGalleryIndex];
        var thumbImg = item.querySelector('img');
        var label = item.querySelector('span');
        if (lightboxImg && thumbImg) { lightboxImg.src = thumbImg.src; }
        if (lightboxCaption) { lightboxCaption.textContent = label ? label.textContent : ''; }
        if (lightboxCounter) { lightboxCounter.textContent = (currentGalleryIndex + 1) + ' / ' + galleryItems.length; }
      }

      function openGallery(index) {
        lightbox.classList.add('open');
        showGalleryShot(index);
      }
      function closeGallery() {
        lightbox.classList.remove('open');
      }

      galleryItems.forEach(function (item, index) {
        item.addEventListener('click', function () { openGallery(index); });
      });
      lightbox.querySelector('.wp-lightbox-close').addEventListener('click', closeGallery);
      lightbox.querySelector('.wp-lightbox-arrow.prev').addEventListener('click', function () { showGalleryShot(currentGalleryIndex - 1); });
      lightbox.querySelector('.wp-lightbox-arrow.next').addEventListener('click', function () { showGalleryShot(currentGalleryIndex + 1); });
      lightbox.addEventListener('click', function (event) {
        if (event.target === lightbox) closeGallery();
      });
      document.addEventListener('keydown', function (event) {
        if (!lightbox.classList.contains('open')) return;
        if (event.key === 'Escape') closeGallery();
        else if (event.key === 'ArrowLeft') showGalleryShot(currentGalleryIndex - 1);
        else if (event.key === 'ArrowRight') showGalleryShot(currentGalleryIndex + 1);
      });
    }

    // broken screenshot images -> placeholder plate
    document.querySelectorAll('.wp-visual img').forEach(function (image) {
      image.addEventListener('error', function () {
        var visual = image.closest('.wp-visual');
        if (visual) visual.classList.add('wp-visual-empty');
      });
    });

    // smooth scroll for in-page anchors
    document.querySelectorAll('.wp-page a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (event) {
        var target = document.querySelector(anchor.getAttribute('href'));
        if (!target) return;
        event.preventDefault();
        try { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (error) { /* ignore */ }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
