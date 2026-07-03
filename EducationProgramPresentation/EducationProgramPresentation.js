/* ═══════════════════════════════════════════════════════
   Eğitim Programı — İnteraktif Sunum JS (Inline Drawer)
   UNICONHUB CMS HTML-Tool
   ═══════════════════════════════════════════════════════ */

function el(id) { return document.getElementById(id); }
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }

var currentSlide = 0;
var totalSlides = 18;
var isReadOnly = false;
var activeCard = null; /* currently expanded card */

/* ── Init ── */
tool.onReady(function(value, fields) {
  if (value && typeof value.currentSlide === 'number') {
    currentSlide = Math.max(0, Math.min(value.currentSlide, totalSlides - 1));
  }
  if (tool.isReadOnly()) {
    isReadOnly = true;
    el('readonly-badge').style.display = 'inline-block';
  }

  renderSlide(currentSlide);
  buildDots();
  updateProgress();
  updateNavButtons();
  bindEvents();

  tool.onValueChange(function(v) {
    if (v && typeof v.currentSlide === 'number') {
      navigateTo(Math.max(0, Math.min(v.currentSlide, totalSlides - 1)));
    }
  });

  tool.onReadonlyChange(function(ro) {
    isReadOnly = !!ro;
    el('readonly-badge').style.display = isReadOnly ? 'inline-block' : 'none';
  });

  setTimeout(function() { tool.resize(); }, 150);
});

/* ── Slide Navigation ── */
function renderSlide(index) {
  /* Collapse any open drawer before switching */
  collapseAll();

  qsa('.slide').forEach(function(s) { s.classList.remove('active'); });
  qsa('.nav-item').forEach(function(n) { n.classList.remove('active'); });

  var slide = qs('.slide[data-slide="' + index + '"]');
  if (slide) slide.classList.add('active');

  var navItem = qs('.nav-item[data-slide="' + index + '"]');
  if (navItem) { navItem.classList.add('active'); navItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }

  el('slide-container').scrollTop = 0;
  currentSlide = index;
  activeCard = null;
  updateProgress();
  updateNavButtons();
  updateDots();
  saveState();
  tool.resize();
}

function navigateTo(index) {
  if (index === currentSlide || index < 0 || index >= totalSlides) return;
  renderSlide(index);
}

function nextSlide() { if (currentSlide < totalSlides - 1) renderSlide(currentSlide + 1); }
function prevSlide() { if (currentSlide > 0) renderSlide(currentSlide - 1); }

/* ── Drawer Toggle ── */
function toggleCard(card) {
  if (!card) return;

  var isExpanded = card.classList.contains('expanded');

  /* Collapse currently expanded card (if different) */
  if (activeCard && activeCard !== card) {
    activeCard.classList.remove('expanded');
  }

  if (isExpanded) {
    /* Collapse this card */
    card.classList.remove('expanded');
    activeCard = null;
  } else {
    /* Expand this card */
    card.classList.add('expanded');
    activeCard = card;
    /* Scroll the expanded drawer into view after animation starts */
    setTimeout(function() {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }

  tool.resize();
}

function collapseAll() {
  if (activeCard) {
    activeCard.classList.remove('expanded');
    activeCard = null;
  }
}

/* ── Progress ── */
function updateProgress() {
  el('progress-bar').style.width = ((currentSlide + 1) / totalSlides * 100) + '%';
  el('progress-text').textContent = (currentSlide + 1) + ' / ' + totalSlides;
}

/* ── Dots ── */
function buildDots() {
  var dots = el('slide-dots');
  dots.innerHTML = '';
  for (var i = 0; i < totalSlides; i++) {
    var dot = document.createElement('span');
    dot.className = 'slide-dot' + (i === currentSlide ? ' active' : '');
    dot.setAttribute('data-index', i);
    dot.title = 'Slayt ' + (i + 1);
    dot.addEventListener('click', function() { renderSlide(parseInt(this.getAttribute('data-index'), 10)); });
    dots.appendChild(dot);
  }
}

function updateDots() {
  qsa('.slide-dot').forEach(function(d, i) { d.classList.toggle('active', i === currentSlide); });
}

function updateNavButtons() {
  el('btn-prev').disabled = (currentSlide === 0);
  el('btn-next').disabled = (currentSlide === totalSlides - 1);
}

function saveState() { if (!isReadOnly) tool.setValue({ currentSlide: currentSlide }); }

/* ── Sidebar ── */
function toggleSidebar() { el('sidebar').classList.toggle('open'); }
function closeSidebar() { el('sidebar').classList.remove('open'); }

/* ── Bind Events ── */
function bindEvents() {
  el('btn-prev').addEventListener('click', prevSlide);
  el('btn-next').addEventListener('click', nextSlide);

  /* Sidebar nav */
  qsa('.nav-item').forEach(function(item) {
    item.addEventListener('click', function() {
      var idx = parseInt(this.getAttribute('data-slide'), 10);
      if (!isNaN(idx)) { renderSlide(idx); closeSidebar(); }
    });
  });

  /* Card click → toggle inline drawer */
  el('slide-container').addEventListener('click', function(e) {
    var card = e.target.closest('.pres-card');
    if (!card) return;
    /* Don't toggle if clicking a link/button inside the drawer */
    if (e.target.closest('a, button, input, textarea')) return;
    toggleCard(card);
  });

  /* Mobile menu */
  el('btn-menu').addEventListener('click', toggleSidebar);
  el('slide-container').addEventListener('click', function(e) {
    if (e.target === el('slide-container') && el('sidebar').classList.contains('open')) {
      closeSidebar();
    }
  });

  /* Keyboard */
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': e.preventDefault(); nextSlide(); break;
      case 'ArrowLeft': case 'ArrowUp': e.preventDefault(); prevSlide(); break;
      case 'Home': e.preventDefault(); renderSlide(0); break;
      case 'End': e.preventDefault(); renderSlide(totalSlides - 1); break;
      case 'Escape': e.preventDefault(); collapseAll(); break;
    }
  });

  /* Touch swipe */
  var touchX = 0, touchY = 0;
  el('slide-container').addEventListener('touchstart', function(e) {
    touchX = e.touches[0].clientX; touchY = e.touches[0].clientY;
  }, { passive: true });
  el('slide-container').addEventListener('touchend', function(e) {
    var dx = e.changedTouches[0].clientX - touchX;
    var dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) { dx < 0 ? nextSlide() : prevSlide(); }
  });

  /* ResizeObserver */
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function() { tool.resize(); });
    ro.observe(el('app'));
  }
}
