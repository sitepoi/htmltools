/* ═══════════════════════════════════════════════════════
   Future Bridge Academy — İnteraktif Sunum JS (Inline Drawer)
   FBA CMS HTML-Tool
   ═══════════════════════════════════════════════════════ */

function el(id) { return document.getElementById(id); }
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }

var currentSlide = 0;
var totalSlides = 21;
var isReadOnly = false;
var tabGroups = []; /* one controller per .pres-cards group */
var partnerCities = []; /* [{ city, partnerName, veliSunum, ogrenciSunum, sunumKatilim, veliWhatsappGrubu, ogrenciGradeGrubu, onlineDers, denemeSinav, denemeSinavSayi, denemeKayitDuzeni, denemeSonucYazilim, paylasimDuzenli, notes }] */
var decisions = {}; /* { pricing: '', priceLevel: '', grants: '', mixedModel: '', mentorModel: '', sponsorship: '', teacherPay: '', mentorChannels: '', volunteerRoles: '' } */
var STEP_LABELS = {
  veliSunum: 'Veli Sunumu',
  ogrenciSunum: 'Öğrenci Sunumu',
  sunumKatilim: 'Sunum Katılım',
  veliWhatsappGrubu: 'Veli WhatsApp Grubu',
  ogrenciGradeGrubu: 'Grade WhatsApp Grubu',
  onlineDers: 'Online Ders',
  denemeSinav: 'Deneme Sınavı',
  denemeSinavSayi: 'Sınav Sayısı',
  denemeKayitDuzeni: 'Kayıt Düzeni',
  denemeSonucYazilim: 'Sonuçlar Yazılımda',
  paylasimDuzenli: 'Düzenli Paylaşım'
};
var NUMERIC_FIELDS = ['sunumKatilim', 'denemeSinavSayi'];

/* ── Init ── */
tool.onReady(function(value, fields) {
  if (value && typeof value.currentSlide === 'number') {
    currentSlide = Math.max(0, Math.min(value.currentSlide, totalSlides - 1));
  }
  if (value && value.partnerCities) {
    partnerCities = value.partnerCities;
  }
  if (!partnerCities || !partnerCities.length) {
    partnerCities = [];
  }
  if (value && value.decisions) {
    decisions = value.decisions;
  }
  if (tool.isReadOnly()) {
    isReadOnly = true;
    el('readonly-badge').style.display = 'inline-block';
  }

  initConfigDrawer();
  initTabGroups();
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
  /* Collapse any open tab-group before switching */
  resetAllTabGroups();

  qsa('.slide').forEach(function(s) { s.classList.remove('active'); });
  qsa('.nav-item').forEach(function(n) { n.classList.remove('active'); });

  var slide = qs('.slide[data-slide="' + index + '"]');
  if (slide) slide.classList.add('active');

  var navItem = qs('.nav-item[data-slide="' + index + '"]');
  if (navItem) { navItem.classList.add('active'); navItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }

  el('slide-container').scrollTop = 0;
  currentSlide = index;
  if (index === 1) { setTimeout(renderPartnerTable, 50); }
  if (index === 18) { setTimeout(loadDecisions, 100); }
  if (index === 19) { setTimeout(renderReport, 50); }
  if (index === 17) { /* slide 17 no longer has decisions */ }
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

/* ── Tab Groups ──────────────────────────────────────────────
   Each .pres-cards block becomes a self-contained "tab strip":
   clicking a card shrinks ALL cards in that group into small tabs
   and reveals the clicked card's detail content in one shared
   area below the strip — instead of an inline per-card drawer
   (which used to leave the other cards stretched with empty
   white space at the same row height). ── */
function initTabGroups() {
  qsa('.pres-cards').forEach(function(group) {
    tabGroups.push(createTabGroup(group));
  });
}

function createTabGroup(group) {
  var cards = Array.prototype.slice.call(group.children).filter(function(c) {
    return c.classList.contains('pres-card');
  });

  /* Nothing to tabify — leave a single card (or none) exactly as-is */
  if (cards.length < 2) return { reset: function() {} };

  /* Pull each card's detail markup out into memory, then remove the
     inline drawer node — the shared drawer below will render it instead */
  var contents = cards.map(function(card) {
    var drawer = card.querySelector('.pres-card-drawer');
    var html = '';
    if (drawer) {
      var innerEl = drawer.querySelector('.drawer-inner');
      html = innerEl ? innerEl.innerHTML : drawer.innerHTML;
      /* Store on card for PDF export */
      card.setAttribute('data-drawer-content', encodeURIComponent(html));
      drawer.parentNode.removeChild(drawer);
    }
    return html;
  });

  var shared = document.createElement('div');
  shared.className = 'pres-shared-drawer';
  shared.innerHTML = '<button type="button" class="drawer-close" aria-label="Kapat" title="Kapat">&#10005;</button><div class="drawer-inner"></div>';
  group.parentNode.insertBefore(shared, group.nextSibling);
  var innerBox = shared.querySelector('.drawer-inner');
  var closeBtn = shared.querySelector('.drawer-close');
  var selectedIdx = -1;

  function closeGroup() {
    if (selectedIdx === -1) return;
    selectedIdx = -1;
    group.classList.remove('tabs-mode');
    cards.forEach(function(c) { c.classList.remove('selected'); });
    shared.classList.remove('open');
    tool.resize();
  }

  function openCard(idx) {
    var wasOpen = selectedIdx !== -1;
    selectedIdx = idx;
    group.classList.add('tabs-mode');
    cards.forEach(function(c, i) { c.classList.toggle('selected', i === idx); });

    if (!wasOpen) {
      innerBox.innerHTML = contents[idx];
      shared.classList.add('open');
      tool.resize();
    } else {
      /* Switching tabs while already open — quick cross-fade of content */
      innerBox.classList.add('fading');
      setTimeout(function() {
        innerBox.innerHTML = contents[idx];
        innerBox.classList.remove('fading');
        tool.resize();
      }, 160);
    }
  }

  cards.forEach(function(card, idx) {
    card.addEventListener('click', function(e) {
      if (e.target.closest('a, button, input, textarea')) return;
      if (selectedIdx === idx) closeGroup();
      else openCard(idx);
    });
  });

  closeBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    closeGroup();
  });

  return { reset: closeGroup };
}

function resetAllTabGroups() {
  tabGroups.forEach(function(g) { g.reset(); });
}

/* ── Partner Cities Table & Config Drawer ──────────── */
function renderPartnerTable() {
  var wrap = el('partner-table-wrap');
  if (!wrap) return;

  if (partnerCities.length === 0) {
    wrap.innerHTML = '<div class="stats-empty">Henüz partner şehir eklenmedi. <strong>⚙️ Düzenle</strong> butonuna tıklayarak şehirleri ve durumlarını ekleyin.</div>';
    rebindEditBtn();
    return;
  }

  var stepKeys = Object.keys(STEP_LABELS);
  var boolKeys = stepKeys.filter(function(k) { return NUMERIC_FIELDS.indexOf(k) === -1; });
  var totalDone = 0, totalBoolSteps = partnerCities.length * boolKeys.length;

  var html = '<h4>📋 Partner Şehir Durum Takibi <button type="button" class="btn-edit-stats" id="btn-edit-stats">⚙️ Düzenle</button></h4>';
  html += '<div class="table-scroll"><table class="stats-table"><thead><tr><th>Şehir</th><th>Partner</th>';
  boolKeys.forEach(function(k) { html += '<th>' + STEP_LABELS[k] + '</th>'; });
  html += '<th>İlerleme</th></tr></thead><tbody>';

  partnerCities.forEach(function(p) {
    var done = 0;
    html += '<tr><td><strong>' + escHtml(p.city || '—') + '</strong></td><td>' + escHtml(p.partnerName || '—') + '</td>';
    boolKeys.forEach(function(k) {
      var isDone = !!p[k];
      if (isDone) done++;
      html += '<td style="text-align:center">' + (isDone ? '✅' : '⬜') + '</td>';
    });
    var pct = boolKeys.length > 0 ? Math.round(done / boolKeys.length * 100) : 0;
    html += '<td><span class="pct-bar" style="width:' + Math.min(pct, 100) + 'px;"></span><span class="pct-text">%' + pct + '</span></td></tr>';
    totalDone += done;
  });

  html += '</tbody></table></div>';
  var overallPct = totalBoolSteps > 0 ? Math.round(totalDone / totalBoolSteps * 100) : 0;
  html += '<div style="margin-top:8px;font-size:13px;color:var(--text-muted)">Genel ilerleme: <strong>%' + overallPct + '</strong> (' + totalDone + '/' + totalBoolSteps + ' adım tamamlandı)</div>';
  html += '<div class="pres-footer-note" style="margin-top:10px">💻 Detaylı veri girişi (sayısal değerler, notlar) için <strong>⚙️ Düzenle</strong> butonunu kullanın. Bu adımların takibi için özel bir yazılım geliştirilmektedir.</div>';

  wrap.innerHTML = html;
  rebindEditBtn();
}

function rebindEditBtn() {
  var btn = el('btn-edit-stats');
  if (btn) btn.addEventListener('click', openConfigDrawer);
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Config Drawer (unified partner city form) ── */
function initConfigDrawer() {
  var overlay = document.createElement('div');
  overlay.className = 'config-drawer-overlay';
  overlay.id = 'config-drawer-overlay';
  overlay.addEventListener('click', closeConfigDrawer);

  var drawer = document.createElement('div');
  drawer.className = 'config-drawer';
  drawer.id = 'config-drawer';
  drawer.innerHTML = '<div class="config-drawer-header"><h3>⚙️ Partner Şehir Veri Girişi</h3><button type="button" class="config-drawer-close" id="config-drawer-close">✕</button></div><div class="config-drawer-body" id="config-drawer-body"></div><div class="config-drawer-footer"><button type="button" class="btn-add-city" id="btn-add-item">+ Partner Şehir Ekle</button><button type="button" class="btn-save-config" id="btn-save-config">Kaydet</button></div>';

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  el('config-drawer-close').addEventListener('click', closeConfigDrawer);

  el('btn-add-item').addEventListener('click', function() {
    var p = { city: '', partnerName: '' };
    Object.keys(STEP_LABELS).forEach(function(k) {
      p[k] = NUMERIC_FIELDS.indexOf(k) !== -1 ? 0 : false;
    });
    p.notes = '';
    partnerCities.push(p);
    renderConfigForm();
  });

  el('btn-save-config').addEventListener('click', function() {
    readConfigForm();
    closeConfigDrawer();
    renderPartnerTable();
    saveState();
    tool.notify('Partner şehir verileri kaydedildi', 'success');
  });
}

function openConfigDrawer() {
  if (isReadOnly) { tool.notify('Salt okunur modda düzenleme yapılamaz', 'warning'); return; }
  renderConfigForm();
  el('config-drawer-overlay').classList.add('open');
  el('config-drawer').classList.add('open');
}

function closeConfigDrawer() {
  el('config-drawer-overlay').classList.remove('open');
  el('config-drawer').classList.remove('open');
}

function renderConfigForm() {
  var body = el('config-drawer-body');
  if (partnerCities.length === 0) {
    body.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px;">Henüz partner şehir eklenmedi.<br><strong>+ Partner Şehir Ekle</strong> butonunu kullanın.</p>';
    return;
  }
  var stepKeys = Object.keys(STEP_LABELS);
  var boolKeys = stepKeys.filter(function(k) { return NUMERIC_FIELDS.indexOf(k) === -1; });
  var html = '';
  partnerCities.forEach(function(p, i) {
    html += '<div class="config-city-row"><div class="city-header"><strong>📍 ' + escHtml(p.city || 'Şehir #' + (i+1)) + '</strong><button type="button" class="btn-remove-item" data-idx="' + i + '" title="Bu şehri sil">🗑</button></div>';
    html += '<div class="field-row"><div class="field-half"><label>Şehir</label><input type="text" data-idx="' + i + '" data-field="city" value="' + escHtml(p.city || '') + '" placeholder="örn: Toronto"></div><div class="field-half"><label>Partner Adı</label><input type="text" data-idx="' + i + '" data-field="partnerName" value="' + escHtml(p.partnerName || '') + '" placeholder="örn: Ahmet Yılmaz"></div></div>';
    html += '<label style="margin-top:8px">Tamamlanan Adımlar</label>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px">';
    boolKeys.forEach(function(k) {
      html += '<label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;font-weight:400;text-transform:none;letter-spacing:0"><input type="checkbox" data-idx="' + i + '" data-field="' + k + '"' + (p[k] ? ' checked' : '') + ' style="width:auto;margin:0"> ' + STEP_LABELS[k] + '</label>';
    });
    html += '</div>';
    NUMERIC_FIELDS.forEach(function(k) {
      html += '<div class="field-row"><div class="field-half"><label>' + STEP_LABELS[k] + '</label><input type="number" data-idx="' + i + '" data-field="' + k + '" value="' + (p[k] || 0) + '"></div></div>';
    });
    html += '<label>Notlar</label><input type="text" data-idx="' + i + '" data-field="notes" value="' + escHtml(p.notes || '') + '" placeholder="Ek notlar...">';
    html += '</div>';
  });
  body.innerHTML = html;

  body.querySelectorAll('.btn-remove-item').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var idx = parseInt(this.getAttribute('data-idx'), 10);
      partnerCities.splice(idx, 1);
      renderConfigForm();
    });
  });
}

function readConfigForm() {
  var body = el('config-drawer-body');
  body.querySelectorAll('input[data-field]').forEach(function(inp) {
    var idx = parseInt(inp.getAttribute('data-idx'), 10);
    var field = inp.getAttribute('data-field');
    if (idx >= 0 && idx < partnerCities.length) {
      if (inp.type === 'checkbox') {
        partnerCities[idx][field] = inp.checked;
      } else if (inp.type === 'number') {
        partnerCities[idx][field] = parseInt(inp.value, 10) || 0;
      } else {
        partnerCities[idx][field] = inp.value;
      }
    }
  });
}

/* ── Decisions (slide 17 textareas) ── */
function loadDecisions() {
  qsa('.decision-item textarea').forEach(function(ta) {
    var key = ta.getAttribute('data-decision');
    if (key && decisions[key] !== undefined) {
      ta.value = decisions[key] || '';
    }
    ta.addEventListener('blur', function() {
      saveDecision(key, ta.value);
    });
    var timer;
    ta.addEventListener('input', function() {
      clearTimeout(timer);
      timer = setTimeout(function() { saveDecision(key, ta.value); }, 800);
    });
  });
  /* PDF export button */
  var expBtn = el('btn-export-pdf');
  if (expBtn) expBtn.addEventListener('click', exportDecisionsPdf);
}

function exportDecisionsPdf() {
  var html = '<h2>Future Bridge Academy — Karar Bekleyen Konular</h2>';
  html += '<p>Tarih: ' + new Date().toLocaleDateString('tr-TR') + '</p><hr>';
  var labels = {
    pricing: 'Hangi hizmetler ücretli olacak?', priceLevel: 'Hangi seviyeden itibaren ücret alınacak?',
    grants: 'Grant başvuruları', mixedModel: 'Karma model',
    mentorModel: 'Mentor gönüllü/ücretli dengesi', sponsorship: 'Sponsorluk stratejisi',
    teacherPay: 'Öğretmenler ücretli mi?', mentorChannels: 'İki kanallı mentorluk modeli',
    volunteerRoles: 'Gönüllü talepleri'
  };
  Object.keys(labels).forEach(function(k) {
    html += '<h3>' + labels[k] + '</h3><p>' + (decisions[k] || '(Henüz karar verilmedi)') + '</p>';
  });
  openExportWindow(html, 'kararlar');
}

function saveDecision(key, value) {
  if (isReadOnly) return;
  decisions[key] = value;
  saveState();
}

/* ── Partner Report (slide 19) ── */
function renderReport() {
  var wrap = el('partner-report-wrap');
  if (!wrap) return;
  var stepKeys = Object.keys(STEP_LABELS);
  var boolKeys = stepKeys.filter(function(k) { return NUMERIC_FIELDS.indexOf(k) === -1; });

  if (partnerCities.length === 0) {
    wrap.innerHTML = '<div class="stats-empty">Henüz veri girilmedi. ⚙️ Veri Girişi butonundan partner şehir ekleyin.</div>';
    return;
  }

  var html = '<div style="margin-bottom:16px"><button type="button" class="btn-config" id="btn-export-report-pdf" style="font-size:14px;padding:8px 18px">📄 PDF Olarak Dışa Aktar</button></div>';
  partnerCities.forEach(function(p) {
    var done = 0;
    boolKeys.forEach(function(k) { if (!!p[k]) done++; });
    var pct = boolKeys.length > 0 ? Math.round(done / boolKeys.length * 100) : 0;

    html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px 20px;margin-bottom:12px">';
    html += '<h4 style="margin-bottom:8px">📍 ' + escHtml(p.city || '—') + ' — ' + escHtml(p.partnerName || '—') + ' <span style="color:var(--accent-dark);font-size:14px">%' + pct + '</span></h4>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px 14px">';
    stepKeys.forEach(function(k) {
      if (NUMERIC_FIELDS.indexOf(k) !== -1) {
        html += '<span style="font-size:13px">' + STEP_LABELS[k] + ': <strong>' + (p[k] || 0) + '</strong></span>';
      } else {
        html += '<span style="font-size:13px">' + (!!p[k] ? '✅' : '⬜') + ' ' + STEP_LABELS[k] + '</span>';
      }
    });
    html += '</div>';
    if (p.notes) html += '<div style="margin-top:6px;font-size:13px;color:var(--text-secondary)">📝 ' + escHtml(p.notes) + '</div>';
    html += '</div>';
  });
  wrap.innerHTML = html;

  var expBtn = el('btn-export-report-pdf');
  if (expBtn) expBtn.addEventListener('click', exportReportPdf);
}

function exportReportPdf() {
  var html = '<h2>Future Bridge Academy — Partner Şehir Raporu</h2>';
  html += '<p>Tarih: ' + new Date().toLocaleDateString('tr-TR') + '</p><hr>';
  partnerCities.forEach(function(p) {
    html += '<h3>' + escHtml(p.city || '—') + ' — ' + escHtml(p.partnerName || '—') + '</h3><ul>';
    Object.keys(STEP_LABELS).forEach(function(k) {
      var val = NUMERIC_FIELDS.indexOf(k) !== -1 ? (p[k] || 0) : (!!p[k] ? '✅' : '⬜');
      html += '<li>' + STEP_LABELS[k] + ': ' + val + '</li>';
    });
    if (p.notes) html += '<li>Not: ' + escHtml(p.notes) + '</li>';
    html += '</ul>';
  });
  openExportWindow(html, 'partner-raporu');
}

/* ── Full Presentation Export ── */
function showExportOptions() {
  /* Simple confirm-style: two buttons */
  var overlay = document.createElement('div');
  overlay.className = 'config-drawer-overlay open';
  overlay.id = 'export-overlay';

  var popup = document.createElement('div');
  popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1001;background:var(--surface);border-radius:var(--radius-md);padding:28px 32px;box-shadow:0 8px 32px rgba(0,0,0,0.25);text-align:center;max-width:400px;width:90%';
  popup.innerHTML = '<h3 style="font-size:20px;margin-bottom:8px">📄 Sunumu Dışa Aktar</h3><p style="font-size:15px;color:var(--text-secondary);margin-bottom:20px">Hangi formatta aktarmak istersiniz?</p>' +
    '<button type="button" id="export-collapsed" style="display:block;width:100%;padding:12px;margin-bottom:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);font-size:15px;cursor:pointer;font-family:var(--font)">📋 <strong>Detaylar Kapalı</strong><br><span style="font-size:13px;color:var(--text-muted)">Sadece kart başlıkları, özet görünüm</span></button>' +
    '<button type="button" id="export-expanded" style="display:block;width:100%;padding:12px;margin-bottom:10px;border:1px solid var(--primary);border-radius:8px;background:var(--primary-light);font-size:15px;cursor:pointer;font-family:var(--font)">📖 <strong>Detaylar Açık</strong><br><span style="font-size:13px;color:var(--text-muted)">Tüm kart içerikleri ve açıklamalar</span></button>' +
    '<button type="button" id="export-cancel" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:13px;font-family:var(--font);margin-top:6px">İptal</button>';

  document.body.appendChild(overlay);
  document.body.appendChild(popup);

  function cleanup() { overlay.remove(); popup.remove(); }

  overlay.addEventListener('click', cleanup);
  popup.querySelector('#export-cancel').addEventListener('click', function(e) { e.stopPropagation(); cleanup(); });
  popup.querySelector('#export-collapsed').addEventListener('click', function(e) { e.stopPropagation(); cleanup(); exportPresentationPdf(false); });
  popup.querySelector('#export-expanded').addEventListener('click', function(e) { e.stopPropagation(); cleanup(); exportPresentationPdf(true); });
}

function openExportWindow(html, filename) {
  if (typeof tool.requestExportPdf === 'function') {
    tool.requestExportPdf({ html: html, filename: filename, landscape: true }, function(err, file) {
      if (!err && file && file.url && file.url !== '#' && file.url.length > 2) {
        window.open(file.url, '_blank');
      } else {
        /* Fallback: open HTML in new window for print-to-PDF */
        openFallbackWindow(html);
      }
    });
  } else {
    openFallbackWindow(html);
  }
}

function openFallbackWindow(html) {
  var w = window.open('', '_blank');
  if (!w) { tool.notify('Lütfen pop-up engelleyiciyi devre dışı bırakın', 'warning'); return; }
  w.document.write('<html><head><meta charset="UTF-8"><title>Future Bridge Academy</title><style>body{font-family:Arial,sans-serif;margin:0;padding:0}.slide-card{border:1px solid #e5e7eb;border-radius:12px;padding:14px 18px;margin-bottom:8px;background:#fff;page-break-inside:avoid}.page-break{page-break-after:always}</style></head><body>' + html + '<script>window.onload=function(){window.print();}</script></body></html>');
  w.document.close();
}

function exportPresentationPdf(includeDetails) {
  var slides = qsa('.slide');
  var html = '<div style="font-family:Arial,sans-serif;color:#111;max-width:1100px;margin:0 auto;padding:20px">';
  html += '<h1 style="text-align:center;font-size:24px;margin-bottom:4px">🎓 Future Bridge Academy</h1>';
  html += '<p style="text-align:center;color:#666;font-size:13px;margin-bottom:20px">Eğitim Programı Sunumu — ' + new Date().toLocaleDateString('tr-TR') + '</p>';

  slides.forEach(function(slide, idx) {
    var hero = slide.querySelector('.pres-hero');
    var title = hero ? hero.querySelector('.pres-title') : null;
    var sub = hero ? hero.querySelector('.pres-sub') : null;
    var icon = hero ? hero.querySelector('.pres-icon') : null;

    html += '<div class="slide-card">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
    html += '<span style="background:#4f46e5;color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600;flex-shrink:0">' + (idx + 1) + '</span>';
    if (icon) html += '<span style="font-size:20px">' + icon.textContent + '</span>';
    if (title) html += '<strong style="font-size:15px">' + title.textContent + '</strong>';
    html += '</div>';
    if (sub) html += '<p style="font-size:11px;color:#666;margin:0 0 8px 0">' + sub.textContent + '</p>';

    var cardFronts = slide.querySelectorAll('.pres-card-front');
    if (cardFronts.length > 0) {
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
      cardFronts.forEach(function(front) {
        var cIcon = front.querySelector('.pres-card-icon');
        var cTitle = front.querySelector('.pres-card-title');
        var cDesc = front.querySelector('.pres-card-desc');
        html += '<div style="flex:1 1 160px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;text-align:center">';
        if (cIcon) html += '<div style="font-size:20px;margin-bottom:3px">' + cIcon.textContent + '</div>';
        if (cTitle) html += '<strong style="font-size:11px">' + cTitle.textContent + '</strong>';
        if (cDesc && includeDetails) html += '<p style="font-size:10px;color:#666;margin:3px 0 0">' + cDesc.textContent + '</p>';
        html += '</div>';
      });
      html += '</div>';
    }

    if (includeDetails) {
      slide.querySelectorAll('.pres-card[data-drawer-content]').forEach(function(card) {
        try {
          var content = decodeURIComponent(card.getAttribute('data-drawer-content'));
          var cTitle = card.querySelector('.pres-card-title');
          html += '<div style="margin-top:6px;padding:6px 10px;background:#f3f4f6;border-radius:6px;font-size:10px;line-height:1.4">';
          if (cTitle) html += '<strong>' + cTitle.textContent + ':</strong> ';
          html += content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 250);
          html += '</div>';
        } catch(e) {}
      });
    }

    html += '</div>';
    if ((idx + 1) % 3 === 0 && idx < slides.length - 1) {
      html += '<div class="page-break"></div>';
    }
  });

  html += '</div>';
  openExportWindow(html, 'future-bridge-academy-sunum');
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

function saveState() { if (!isReadOnly) tool.setValue({ currentSlide: currentSlide, partnerCities: partnerCities, decisions: decisions }); }

/* ── Sidebar ── */
function toggleSidebar() { el('sidebar').classList.toggle('open'); }
function closeSidebar() { el('sidebar').classList.remove('open'); }

/* ── Bind Events ── */
function bindEvents() {
  el('btn-prev').addEventListener('click', prevSlide);
  el('btn-next').addEventListener('click', nextSlide);

  /* Topbar config button */
  var cfgBtn = el('btn-config-top');
  if (cfgBtn) cfgBtn.addEventListener('click', function() { openConfigDrawer(); });

  /* Topbar export button */
  var expBtn = el('btn-export-pres');
  if (expBtn) expBtn.addEventListener('click', showExportOptions);

  /* Sidebar nav */
  qsa('.nav-item').forEach(function(item) {
    item.addEventListener('click', function() {
      var idx = parseInt(this.getAttribute('data-slide'), 10);
      if (!isNaN(idx)) { renderSlide(idx); closeSidebar(); }
    });
  });

  /* Close sidebar when clicking outside (on main area) */
  qs('main').addEventListener('click', function(e) {
    if (el('sidebar').classList.contains('open') && !e.target.closest('.sidebar') && !e.target.closest('.btn-menu')) {
      closeSidebar();
    }
  });

  /* Mobile menu */
  el('btn-menu').addEventListener('click', toggleSidebar);

  /* Keyboard */
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); nextSlide(); break;
      case 'ArrowLeft': e.preventDefault(); prevSlide(); break;
      case 'Home': e.preventDefault(); renderSlide(0); break;
      case 'End': e.preventDefault(); renderSlide(totalSlides - 1); break;
      case 'Escape': e.preventDefault(); resetAllTabGroups(); break;
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
