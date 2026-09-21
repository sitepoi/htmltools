/* ==========================================================================
   Shared behavior for tool marketing presentations
   --------------------------------------------------------------------------
   Lives ONCE in _docs/assets/presentation.js and is linked by every
   generated docs/presentation.html. It drives prev/next navigation, the
   keyboard shortcuts, the progress bar, the slide counter, and PDF export
   (browser print - every slide prints on its own page).
   ========================================================================== */
(function () {
  'use strict';
  if (window.__presentationEngineBooted) { return; }
  window.__presentationEngineBooted = true;

  function byId(id) { return document.getElementById(id); }
  function all(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function boot() {
    var slides = all('.pres-slide');
    if (!slides.length) { return; }
    var currentIndex = parseInt(window.location.hash.replace('#slide-', ''), 10);
    if (!(currentIndex >= 0) || currentIndex >= slides.length) { currentIndex = 0; }

    function showSlide(index) {
      if (index < 0 || index >= slides.length) { return; }
      currentIndex = index;
      slides.forEach(function (slide, slideIndex) {
        slide.classList.toggle('active', slideIndex === currentIndex);
      });
      var counter = document.querySelector('.pres-counter');
      if (counter) { counter.textContent = (currentIndex + 1) + ' / ' + slides.length; }
      var progress = document.querySelector('.pres-progress');
      if (progress) { progress.style.width = ((currentIndex + 1) / slides.length) * 100 + '%'; }
      window.location.hash = 'slide-' + (currentIndex + 1);
    }

    function nextSlide() { showSlide(currentIndex + 1); }
    function previousSlide() { showSlide(currentIndex - 1); }

    var previousButton = document.querySelector('.pres-nav-prev');
    var nextButton = document.querySelector('.pres-nav-next');
    var exportButton = document.querySelector('.pres-nav-export');
    if (previousButton) { previousButton.addEventListener('click', previousSlide); }
    if (nextButton) { nextButton.addEventListener('click', nextSlide); }
    if (exportButton) {
      exportButton.addEventListener('click', function () {
        try { window.print(); } catch (error) { alert('Print is not available - use your browser menu to print to PDF.'); }
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown') { nextSlide(); }
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') { previousSlide(); }
      else if (event.key === 'Home') { showSlide(0); }
      else if (event.key === 'End') { showSlide(slides.length - 1); }
    });

    var stage = document.querySelector('.pres-stage');
    if (stage) {
      stage.addEventListener('click', function (event) {
        var middle = window.innerWidth / 2;
        if (event.clientX > middle) { nextSlide(); } else { previousSlide(); }
      });
    }

    showSlide(currentIndex);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
