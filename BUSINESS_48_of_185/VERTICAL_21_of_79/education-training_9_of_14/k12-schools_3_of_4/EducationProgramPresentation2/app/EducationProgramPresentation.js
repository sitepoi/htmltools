/* ═══════════════════════════════════════════════════════
   Eğitim Programı — İnteraktif Sunum JS
   UNICONHUB CMS HTML-Tool
   ═══════════════════════════════════════════════════════ */

/* ── Helpers ── */
function el(id) { return document.getElementById(id); }
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }

/* ── State ── */
let currentSlide = 0;
const totalSlides = 18;
let isReadOnly = false;

/* ── Init ── */
tool.onReady(function(value, fields) {
  /* Restore saved slide position if any */
  if (value && typeof value.currentSlide === 'number') {
    currentSlide = Math.max(0, Math.min(value.currentSlide, totalSlides - 1));
  }

  /* Check read-only */
  if (tool.isReadOnly()) {
    isReadOnly = true;
    el('readonly-badge').style.display = 'inline-block';
  }

  /* Render */
  renderSlide(currentSlide);
  buildDots();
  updateProgress();
  updateNavButtons();

  /* Event listeners */
  bindEvents();

  /* SDK listeners */
  tool.onValueChange(function(v) {
    if (v && typeof v.currentSlide === 'number') {
      navigateTo(Math.max(0, Math.min(v.currentSlide, totalSlides - 1)));
    }
  });

  tool.onReadonlyChange(function(ro) {
    isReadOnly = !!ro;
    el('readonly-badge').style.display = isReadOnly ? 'inline-block' : 'none';
  });

  /* Resize after initial render */
  setTimeout(function() { tool.resize(); }, 100);
});

/* ── Render ── */
function renderSlide(index) {
  /* Deactivate all slides */
  qsa('.slide').forEach(function(s) { s.classList.remove('active'); });
  qsa('.nav-item').forEach(function(n) { n.classList.remove('active'); });

  /* Activate target */
  var slide = qs('.slide[data-slide="' + index + '"]');
  if (slide) slide.classList.add('active');

  var navItem = qs('.nav-item[data-slide="' + index + '"]');
  if (navItem) navItem.classList.add('active');

  /* Scroll sidebar to visible */
  if (navItem) {
    navItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /* Scroll slide container to top */
  var container = el('slide-container');
  if (container) container.scrollTop = 0;

  currentSlide = index;
  updateProgress();
  updateNavButtons();
  updateDots();
  saveState();
  tool.resize();
}

function navigateTo(index) {
  if (index === currentSlide) return;
  if (index < 0 || index >= totalSlides) return;
  renderSlide(index);
}

function nextSlide() {
  if (currentSlide < totalSlides - 1) {
    renderSlide(currentSlide + 1);
  }
}

function prevSlide() {
  if (currentSlide > 0) {
    renderSlide(currentSlide - 1);
  }
}

/* ── Progress ── */
function updateProgress() {
  var pct = ((currentSlide + 1) / totalSlides) * 100;
  el('progress-bar').style.width = pct + '%';
  el('progress-text').textContent = (currentSlide + 1) + ' / ' + totalSlides;
}

/* ── Dots ── */
function buildDots() {
  var dotsContainer = el('slide-dots');
  dotsContainer.innerHTML = '';
  for (var i = 0; i < totalSlides; i++) {
    var dot = document.createElement('span');
    dot.className = 'slide-dot' + (i === currentSlide ? ' active' : '');
    dot.setAttribute('data-index', i);
    dot.title = 'Slayt ' + (i + 1);
    dot.addEventListener('click', function(e) {
      var idx = parseInt(this.getAttribute('data-index'), 10);
      renderSlide(idx);
    });
    dotsContainer.appendChild(dot);
  }
}

function updateDots() {
  qsa('.slide-dot').forEach(function(dot, i) {
    dot.classList.toggle('active', i === currentSlide);
  });
}

/* ── Nav Buttons ── */
function updateNavButtons() {
  el('btn-prev').disabled = (currentSlide === 0);
  el('btn-next').disabled = (currentSlide === totalSlides - 1);
}

/* ── Save State ── */
function saveState() {
  if (isReadOnly) return;
  tool.setValue({ currentSlide: currentSlide });
}

/* ── Accordion Toggle ── */
function toggleAccordion(bodyId, headerEl) {
  var body = el(bodyId);
  if (!body) return;
  var item = headerEl.closest('.accordion-item');
  var isOpen = body.style.display !== 'none';

  if (isOpen) {
    body.style.display = 'none';
    if (item) item.classList.remove('open');
    headerEl.querySelector('.acc-arrow').textContent = '▸';
  } else {
    body.style.display = 'block';
    if (item) item.classList.add('open');
    headerEl.querySelector('.acc-arrow').textContent = '▾';
  }

  tool.resize();
}

/* ── Mobile Menu ── */
function toggleSidebar() {
  var sidebar = el('sidebar');
  sidebar.classList.toggle('open');
}

function closeSidebar() {
  el('sidebar').classList.remove('open');
}

/* ── Bind Events ── */
function bindEvents() {
  /* Nav buttons */
  el('btn-prev').addEventListener('click', prevSlide);
  el('btn-next').addEventListener('click', nextSlide);

  /* Sidebar nav */
  qsa('.nav-item').forEach(function(item) {
    item.addEventListener('click', function() {
      var idx = parseInt(this.getAttribute('data-slide'), 10);
      if (!isNaN(idx)) {
        renderSlide(idx);
        closeSidebar();
      }
    });
  });

  /* Accordion headers */
  qsa('.accordion-header').forEach(function(header) {
    header.addEventListener('click', function() {
      var targetId = this.getAttribute('data-toggle');
      if (targetId) {
        toggleAccordion(targetId, this);
      }
    });
  });

  /* Mobile menu button */
  el('btn-menu').addEventListener('click', toggleSidebar);

  /* Close sidebar on outside click */
  el('slide-container').addEventListener('click', function(e) {
    if (el('sidebar').classList.contains('open')) {
      closeSidebar();
    }
  });

  /* Keyboard navigation */
  document.addEventListener('keydown', function(e) {
    /* Don't navigate if user is typing in an input */
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        nextSlide();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        prevSlide();
        break;
      case 'Home':
        e.preventDefault();
        renderSlide(0);
        break;
      case 'End':
        e.preventDefault();
        renderSlide(totalSlides - 1);
        break;
    }
  });

  /* Touch swipe support */
  var touchStartX = 0;
  var touchStartY = 0;

  el('slide-container').addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  el('slide-container').addEventListener('touchend', function(e) {
    var dx = e.changedTouches[0].clientX - touchStartX;
    var dy = e.changedTouches[0].clientY - touchStartY;

    /* Only trigger if horizontal swipe is dominant */
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  });

  /* Resize observer */
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function() {
      tool.resize();
    });
    ro.observe(el('app'));
  }
}
