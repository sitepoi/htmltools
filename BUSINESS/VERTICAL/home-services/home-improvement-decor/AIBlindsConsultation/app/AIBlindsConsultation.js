/* ── AI Blinds Concierge ──
   AI-Powered Window Treatment Consultation Tool
   Built for UniconHub CMS html-tool system.
────────────────────────────────────────── */

/* ── Helpers ── */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function el(id) { return document.getElementById(id); }
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }
function fmtMoney(n) { return '$' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

/* ── Product Catalog ── */
var CATALOG = [
  { id: 'roller-blackout', name: 'Premium Blackout Roller Shade', icon: '🪟', cat: 'roller', type: 'Roller Shade', lightControl: 'blackout', privacy: 'maximum', energy: false, moisture: true, motorized: false, childSafe: true, uv: true, noise: false, easyClean: true, styles: ['modern','transitional'], budget: 'mid-range', basePrice: 120, desc: 'Complete light block-out with a sleek, minimal profile. Perfect for bedrooms and media rooms. Available in hundreds of colors.', colors: ['#f5f0e8','#e8ddd0','#d4c5b2','#b8a590','#8c7b6b','#5c4a3a','#3a3a3a','#1a1a1a','#ffffff','#d4d4d4'], materials: ['PVC-Free Fabric','Polyester Blend'], mountTypes: ['inside','outside'] },
  { id: 'roller-light-filtering', name: 'Light Filtering Roller Shade', icon: '☀️', cat: 'roller', type: 'Roller Shade', lightControl: 'light-filtering', privacy: 'moderate', energy: false, moisture: true, motorized: false, childSafe: true, uv: true, noise: false, easyClean: true, styles: ['modern','transitional','traditional'], budget: 'mid-range', basePrice: 105, desc: 'Soft, diffused natural light while maintaining daytime privacy. Ideal for living rooms, kitchens, and dining areas.', colors: ['#faf8f3','#f0ebe0','#e8dcc8','#d4c8b0','#c8b898','#a89878','#f5f0e8','#ffffff','#e8e0d0','#d8d0c0'], materials: ['Light Filtering Fabric','Polyester Blend'], mountTypes: ['inside','outside'] },
  { id: 'roller-sheer', name: 'Sheer Elegance Roller Shade', icon: '☁️', cat: 'roller', type: 'Roller Shade', lightControl: 'sheer', privacy: 'minimal', energy: false, moisture: false, motorized: false, childSafe: true, uv: true, noise: false, easyClean: true, styles: ['modern','transitional'], budget: 'mid-range', basePrice: 130, desc: 'Maximum natural light with UV protection. Creates an airy, open feel while reducing glare. Perfect for sunrooms and dining areas.', colors: ['#ffffff','#fafaf5','#f5f0e5','#efe8d8','#e0d8c8','#d8d0c0','#f0e8d8','#e8e0d0'], materials: ['Sheer Fabric','UV-Coated Polyester'], mountTypes: ['inside','outside'] },
  { id: 'venetian-wood', name: 'Classic Wood Venetian Blind', icon: '🪵', cat: 'venetian', type: 'Venetian Blind', lightControl: 'light-filtering', privacy: 'moderate', energy: false, moisture: false, motorized: false, childSafe: false, uv: true, noise: false, easyClean: false, styles: ['traditional','transitional'], budget: 'premium', basePrice: 180, desc: 'Timeless elegance with genuine hardwood slats. Superior light control with tilt mechanism. Rich wood grains that elevate any room.', colors: ['#d4c4a8','#c4b490','#a89070','#907858','#786048','#584838','#e8d8c0','#d0c0a0','#b8a080','#c8b898'], materials: ['Basswood','Oak','Cherry Wood'], mountTypes: ['inside','outside'] },
  { id: 'venetian-faux-wood', name: 'Faux Wood Venetian Blind', icon: '🪟', cat: 'venetian', type: 'Venetian Blind', lightControl: 'light-filtering', privacy: 'moderate', energy: false, moisture: true, motorized: false, childSafe: false, uv: true, noise: false, easyClean: true, styles: ['traditional','transitional','modern'], budget: 'mid-range', basePrice: 90, desc: 'The look of real wood with moisture-resistant durability. Ideal for bathrooms, kitchens, and humid climates. Easy to clean and won\'t warp.', colors: ['#ffffff','#f5f0e8','#e8ddd0','#d4c5b2','#b8a590','#8c7b6b','#faf8f3','#e0d8c8','#d0c8b8','#c0b8a8'], materials: ['PVC','Composite Polymer'], mountTypes: ['inside','outside'] },
  { id: 'venetian-aluminum', name: 'Sleek Aluminum Mini Blind', icon: '🔧', cat: 'venetian', type: 'Venetian Blind', lightControl: 'light-filtering', privacy: 'moderate', energy: false, moisture: true, motorized: false, childSafe: false, uv: true, noise: false, easyClean: true, styles: ['modern','commercial'], budget: 'economy', basePrice: 40, desc: 'Affordable, durable, and practical. Perfect for rental properties, offices, and budget-conscious projects. Available in many colors.', colors: ['#ffffff','#e0e0e0','#c0c0c0','#a0a0a0','#808080','#d4c8b0','#f5f0e8','#e8e0d0'], materials: ['Aluminum'], mountTypes: ['inside','outside'] },
  { id: 'vertical-blind', name: 'Classic Vertical Blind', icon: '📏', cat: 'vertical', type: 'Vertical Blind', lightControl: 'light-filtering', privacy: 'moderate', energy: false, moisture: true, motorized: false, childSafe: true, uv: true, noise: false, easyClean: true, styles: ['traditional','transitional','commercial'], budget: 'economy', basePrice: 65, desc: 'Ideal for large windows, sliding doors, and patio doors. Easy light control with rotating vanes. Practical and affordable.', colors: ['#ffffff','#f5f0e8','#e8ddd0','#d4c5b2','#b8a590','#e0d8c8','#d0c8b8','#c0b8a8','#f0e8d8','#e8e0d0'], materials: ['PVC','Fabric Vanes'], mountTypes: ['inside','outside'] },
  { id: 'roman-shade', name: 'Elegant Roman Shade', icon: '🏛️', cat: 'roman', type: 'Roman Shade', lightControl: 'room-darkening', privacy: 'maximum', energy: true, moisture: false, motorized: false, childSafe: true, uv: true, noise: true, easyClean: false, styles: ['traditional','transitional','eclectic'], budget: 'premium', basePrice: 200, desc: 'Luxurious fabric folds that add warmth and sophistication. Fully lined for superior insulation and light control. A designer favorite.', colors: ['#f5f0e8','#e8ddd0','#d4c5b2','#b8a590','#c8b898','#a89878','#d8c8b0','#c0b090','#f0e0c8','#e0d0b8'], materials: ['Linen','Cotton Blend','Velvet','Silk Blend'], mountTypes: ['inside','outside'] },
  { id: 'cellular-blackout', name: 'Cellular Blackout Shade', icon: '🔋', cat: 'cellular', type: 'Cellular / Honeycomb', lightControl: 'blackout', privacy: 'maximum', energy: true, moisture: false, motorized: false, childSafe: true, uv: true, noise: true, easyClean: false, styles: ['modern','transitional','traditional'], budget: 'mid-range', basePrice: 140, desc: 'Energy-saving honeycomb cells trap air for superior insulation. Blackout liner for complete darkness. Can reduce energy bills by up to 40%.', colors: ['#f5f0e8','#e8ddd0','#d4c5b2','#ffffff','#d8d0c0','#b8a590','#c8c0b0','#e0d8c8','#f0e8d8','#a89878'], materials: ['Polyester Honeycomb','Aluminized Liner'], mountTypes: ['inside','outside'] },
  { id: 'cellular-light-filtering', name: 'Cellular Light Filtering Shade', icon: '🏠', cat: 'cellular', type: 'Cellular / Honeycomb', lightControl: 'light-filtering', privacy: 'moderate', energy: true, moisture: false, motorized: false, childSafe: true, uv: true, noise: true, easyClean: false, styles: ['modern','transitional','traditional'], budget: 'mid-range', basePrice: 110, desc: 'The perfect blend of energy efficiency and soft natural light. Honeycomb cells insulate year-round while filtering harsh sunlight.', colors: ['#faf8f3','#f0ebe0','#e8dcc8','#d4c8b0','#ffffff','#f5f0e8','#e8e0d0','#d8d0c0','#e0d8c8','#c8c0b0'], materials: ['Polyester Honeycomb','Soft Fabric'], mountTypes: ['inside','outside'] },
  { id: 'zebra-shade', name: 'Zebra Dual Transition Shade', icon: '🦓', cat: 'zebra', type: 'Zebra / Transition Shade', lightControl: 'light-filtering', privacy: 'moderate', energy: false, moisture: false, motorized: false, childSafe: true, uv: true, noise: false, easyClean: true, styles: ['modern','transitional'], budget: 'mid-range', basePrice: 130, desc: 'Innovative dual-layer design — alternating sheer and solid stripes let you transition from filtered light to privacy with a simple adjustment.', colors: ['#f5f0e8','#e8ddd0','#d4c5b2','#ffffff','#f0e8d8','#e0d8c8','#d0c8b8','#c0b8a8','#b8a590','#a89878'], materials: ['Polyester','Sheer + Solid Fabric'], mountTypes: ['inside','outside'] },
  { id: 'panel-track', name: 'Panel Track Blind', icon: '🖼️', cat: 'panel', type: 'Panel Track Blind', lightControl: 'light-filtering', privacy: 'moderate', energy: false, moisture: false, motorized: false, childSafe: true, uv: true, noise: false, easyClean: true, styles: ['modern','commercial'], budget: 'mid-range', basePrice: 150, desc: 'Wide fabric panels glide smoothly for large windows and room dividers. A contemporary solution for patio doors and panoramic windows.', colors: ['#f5f0e8','#e8ddd0','#d4c5b2','#b8a590','#ffffff','#f0e8d8','#e0d8c8','#d0c8b8','#c0b8a8','#a89878'], materials: ['Fabric Panel','Polyester'], mountTypes: ['ceiling','wall'] },
  { id: 'motorized-roller', name: 'Smart Motorized Roller Shade', icon: '🤖', cat: 'motorized', type: 'Motorized / Smart Shade', lightControl: 'blackout', privacy: 'maximum', energy: false, moisture: true, motorized: true, childSafe: true, uv: true, noise: false, easyClean: true, styles: ['modern','transitional'], budget: 'premium', basePrice: 350, desc: 'App-controlled, voice-activated luxury. Schedule open/close times, integrate with Alexa/Google Home, or use the included remote. Hardwired or battery options.', colors: ['#f5f0e8','#e8ddd0','#d4c5b2','#b8a590','#3a3a3a','#1a1a1a','#ffffff','#d4d4d4','#8c7b6b','#5c4a3a'], materials: ['Smart Fabric','PVC-Free'], mountTypes: ['inside','outside'] },
  { id: 'motorized-cellular', name: 'Smart Motorized Cellular Shade', icon: '🏠', cat: 'motorized', type: 'Motorized / Smart Shade', lightControl: 'light-filtering', privacy: 'moderate', energy: true, moisture: false, motorized: true, childSafe: true, uv: true, noise: true, easyClean: false, styles: ['modern','transitional'], budget: 'premium', basePrice: 380, desc: 'Energy-efficient cellular design with smart home integration. Program schedules to maximize energy savings — lower in summer, raise in winter automatically.', colors: ['#faf8f3','#f0ebe0','#e8dcc8','#d4c8b0','#ffffff','#f5f0e8','#e8e0d0','#d8d0c0','#e0d8c8','#c8c0b0'], materials: ['Polyester Honeycomb','Smart Motor'], mountTypes: ['inside','outside'] },
  { id: 'outdoor-solar', name: 'Outdoor Solar Shade', icon: '🌿', cat: 'outdoor', type: 'Outdoor Shade', lightControl: 'sheer', privacy: 'minimal', energy: false, moisture: true, motorized: false, childSafe: true, uv: true, noise: false, easyClean: true, styles: ['modern','transitional'], budget: 'premium', basePrice: 220, desc: 'Heavy-duty weather-resistant fabric for patios, pergolas, and decks. Blocks up to 95% of UV rays while maintaining your outdoor view.', colors: ['#d4c5b2','#b8a590','#8c7b6b','#5c4a3a','#3a3a3a','#1a1a1a','#a89878','#907858','#786048','#c8b898'], materials: ['Weather-Resistant PVC','Sunbrella Fabric'], mountTypes: ['outside','ceiling'] },
  { id: 'skylight-cellular', name: 'Skylight Cellular Shade', icon: '☀️', cat: 'cellular', type: 'Cellular / Honeycomb', lightControl: 'blackout', privacy: 'maximum', energy: true, moisture: false, motorized: false, childSafe: true, uv: true, noise: true, easyClean: false, styles: ['modern','transitional'], budget: 'premium', basePrice: 250, desc: 'Specialized for angled skylights and roof windows. Tension system keeps shade in place. Traps heat in winter, blocks it in summer.', colors: ['#ffffff','#f5f0e8','#e8ddd0','#d4c5b2','#faf8f3','#f0ebe0','#e8dcc8','#d8d0c0','#d4c8b0','#c8c0b0'], materials: ['Polyester Honeycomb','Tension System'], mountTypes: ['inside'] },
  { id: 'pleated-shade', name: 'Crisp Pleated Shade', icon: '📐', cat: 'cellular', type: 'Pleated Shade', lightControl: 'light-filtering', privacy: 'moderate', energy: false, moisture: false, motorized: false, childSafe: true, uv: true, noise: false, easyClean: true, styles: ['modern','transitional'], budget: 'economy', basePrice: 65, desc: 'Clean, crisp pleats at an affordable price. A lightweight, budget-friendly option that still looks polished. Great for rentals and starter homes.', colors: ['#ffffff','#f5f0e8','#e8ddd0','#d4c5b2','#faf8f3','#f0ebe0','#e0d8c8','#d0c8b8','#c0b8a8','#b8a590'], materials: ['Polyester'], mountTypes: ['inside','outside'] }
];

var ROOM_DEFAULTS = {
  'living-room': { lightControl: 'light-filtering', privacy: 'moderate', energy: false, moisture: false, motorized: false, childSafe: false, uv: true, noise: false, easyClean: true, style: 'transitional' },
  'bedroom': { lightControl: 'blackout', privacy: 'maximum', energy: false, moisture: false, motorized: false, childSafe: true, uv: true, noise: true, easyClean: false, style: 'traditional' },
  'kitchen': { lightControl: 'light-filtering', privacy: 'moderate', energy: false, moisture: true, motorized: false, childSafe: true, uv: true, noise: false, easyClean: true, style: 'modern' },
  'bathroom': { lightControl: 'light-filtering', privacy: 'maximum', energy: false, moisture: true, motorized: false, childSafe: true, uv: false, noise: false, easyClean: true, style: 'modern' },
  'home-office': { lightControl: 'light-filtering', privacy: 'moderate', energy: false, moisture: false, motorized: false, childSafe: false, uv: true, noise: true, easyClean: false, style: 'modern' },
  'dining-room': { lightControl: 'light-filtering', privacy: 'moderate', energy: false, moisture: false, motorized: false, childSafe: false, uv: true, noise: false, easyClean: false, style: 'traditional' },
  'nursery': { lightControl: 'blackout', privacy: 'maximum', energy: false, moisture: false, motorized: false, childSafe: true, uv: true, noise: true, easyClean: false, style: 'transitional' },
  'basement': { lightControl: 'light-filtering', privacy: 'maximum', energy: true, moisture: true, motorized: false, childSafe: true, uv: false, noise: false, easyClean: true, style: 'modern' },
  'sunroom': { lightControl: 'sheer', privacy: 'minimal', energy: false, moisture: false, motorized: false, childSafe: false, uv: true, noise: false, easyClean: true, style: 'modern' },
  'commercial': { lightControl: 'light-filtering', privacy: 'moderate', energy: false, moisture: false, motorized: false, childSafe: false, uv: true, noise: false, easyClean: true, style: 'modern' }
};

var COLOR_PALETTES = {
  warm: ['#f5f0e8','#e8ddd0','#d4c5b2','#b8a590','#8c7b6b','#5c4a3a','#c8b898','#d8c8b0','#e0d0b8','#a89878'],
  cool: ['#ffffff','#e8e8e8','#d0d0d0','#b8b8b8','#a0a0a0','#888888','#d8dce0','#c0c8d0','#a8b0b8','#9098a0'],
  bold: ['#3a3a3a','#1a1a1a','#4a3020','#2a4a3a','#1a2a4a','#4a1a2a','#584838','#2a3a4a','#3a2a1a','#4a3a2a']
};

var MOUNT_TYPES = { inside: 'Inside Mount (fits within window frame)', outside: 'Outside Mount (covers entire window opening)', ceiling: 'Ceiling Mount', wall: 'Wall Mount' };

/* ── State ── */
var DB = {
  currentStep: 'welcome',
  room: { type: '', size: 'medium' },
  windows: [],
  needs: { lightPriority: 'light-filtering', privacyLevel: 'moderate', energy: false, moisture: false, motorized: false, childSafe: false, uv: false, noise: false, easyClean: false, style: 'traditional', budget: 'mid-range' },
  recommendations: [],
  selectedProducts: [],
  quote: { name: '', email: '', phone: '' },
  chatMessages: [],
  consultations: [],
  _theme: 'light'
};
var isReadOnly = false;
var editingWindowId = null;
var aiThinking = false;

/* ── Persistence ── */
function persist() {
  tool.setValue(JSON.parse(JSON.stringify(DB)));
}
function loadFromValue(val) {
  if (val && typeof val === 'object') {
    if (val.currentStep) DB.currentStep = val.currentStep;
    if (val.room) DB.room = val.room;
    if (val.windows) DB.windows = val.windows;
    if (val.needs) DB.needs = val.needs;
    if (val.recommendations) DB.recommendations = val.recommendations;
    if (val.selectedProducts) DB.selectedProducts = val.selectedProducts;
    if (val.quote) DB.quote = val.quote;
    if (val.chatMessages) DB.chatMessages = val.chatMessages;
    if (val.consultations) DB.consultations = val.consultations;
    if (val._theme) DB._theme = val._theme;
  }
}

/* ── Navigation ── */
function navigateTo(page) {
  DB.currentStep = page;
  qsa('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  var navItem = qs('.nav-item[data-page="' + page + '"]');
  if (navItem) navItem.classList.add('active');
  qsa('.section').forEach(function(s) { s.classList.remove('active'); });
  var sec = el('sec-' + page);
  if (sec) sec.classList.add('active');
  renderPage(page);
  updateWizardProgress(page);
  persist();
  tool.resize();
}

function updateWizardProgress(page) {
  var wizardSteps = ['welcome','room','needs','recommend','customize','quote'];
  var currentIdx = wizardSteps.indexOf(page);
  if (currentIdx < 0) return;
  qsa('.wp-step').forEach(function(s) { s.classList.remove('active','done'); });
  qsa('.wp-line').forEach(function(l) { l.classList.remove('done'); });
  wizardSteps.forEach(function(p, i) {
    var step = qs('.wp-step[data-wp="' + p + '"]');
    if (!step) return;
    if (i < currentIdx) step.classList.add('done');
    if (i === currentIdx) step.classList.add('active');
  });
  qsa('.wp-line').forEach(function(l, i) {
    if (i < currentIdx) l.classList.add('done');
  });
}

function renderPage(page) {
  switch (page) {
    case 'welcome': break;
    case 'room': renderRoomPage(); break;
    case 'needs': renderNeedsPage(); break;
    case 'recommend': renderRecommendPage(); break;
    case 'customize': renderCustomizePage(); break;
    case 'quote': renderQuotePage(); break;
    case 'history': renderHistoryPage(); break;
    case 'catalog': renderCatalogPage(); break;
  }
  tool.resize();
}

/* ── Welcome ── */
function bindWelcome() {
  el('btn-start-consultation').addEventListener('click', function() { navigateTo('room'); });
  qsa('.qsc-card').forEach(function(card) {
    card.addEventListener('click', function() {
      var quick = card.dataset.quick;
      navigateTo('needs');
      if (quick === 'light-control') {
        qs('input[name="light-priority"][value="blackout"]').checked = true;
      } else if (quick === 'privacy') {
        qs('input[name="privacy-level"][value="maximum"]').checked = true;
      } else if (quick === 'energy') {
        el('need-energy').checked = true;
        el('need-noise').checked = true;
      } else if (quick === 'smart-home') {
        el('need-motorized').checked = true;
      }
      collectNeedsFromUI();
    });
  });
}

/* ── Room Assessment ── */
function renderRoomPage() {
  el('room-type').value = DB.room.type;
  el('room-size').value = DB.room.size;
  renderWindowsList();
}

function renderWindowsList() {
  var container = el('windows-container');
  var empty = el('windows-empty');
  if (DB.windows.length === 0) {
    container.innerHTML = '';
    container.appendChild(empty);
    empty.style.display = 'block';
  } else {
    if (empty) empty.remove();
    var html = '';
    DB.windows.forEach(function(w, i) {
      var miniViz = buildMiniWindowViz(w);
      var dirLabel = {north:'⬆️ North',south:'⬇️ South',east:'➡️ East',west:'⬅️ West'};
      var dirText = dirLabel[w.direction] || '—';
      var wp = getWindowPrefs(w);
      var lpIcons = {blackout:'🌑', 'room-darkening':'🌙', 'light-filtering':'🌤️', sheer:'☁️'};
      var privIcons = {maximum:'🔐', moderate:'🛡️', minimal:'👁️'};
      var budgetIcons = {economy:'💵', 'mid-range':'💶', premium:'💎', luxury:'👑'};
      var styleLabels = {modern:'Modern', traditional:'Classic', transitional:'Blend', eclectic:'Bold'};
      var presetBadge = buildPresetBadge(w);

      html += '<div class="window-card">' +
        '<div class="window-card-header">' +
          '<span class="window-card-title">🪟 Window #' + (i + 1) + ' — ' + esc(w.name || 'Unnamed') + '</span>' +
          '<div class="window-card-actions">' +
            '<button class="btn btn-outline btn-sm btn-edit-window" data-idx="' + i + '">✏️ Edit</button>' +
            '<button class="btn btn-outline btn-sm btn-del-window" data-idx="' + i + '" style="color:var(--red);border-color:var(--red)">🗑️</button>' +
          '</div>' +
        '</div>' +
        '<div class="window-card-body">' +
          '<div class="window-card-viz">' + miniViz + '</div>' +
          '<div class="window-card-details">' +
            '<div class="window-card-detail"><span class="form-label">Size</span><span>' + esc(w.width || '—') + '" × ' + esc(w.height || '—') + '"</span></div>' +
            '<div class="window-card-detail"><span class="form-label">Direction</span><span>' + dirText + '</span></div>' +
            '<div class="window-card-detail"><span class="form-label">Mount</span><span>' + (w.mountType === 'inside' ? 'Inside' : 'Outside') + '</span></div>' +
            '<div class="window-card-detail"><span class="form-label">Type</span><span>' + esc(w.windowType || 'standard') + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="window-card-prefs">' +
          '<div class="wcp-pills">' +
            '<span class="wcp-pill" title="Light: ' + wp.lightPriority + '">' + (lpIcons[wp.lightPriority] || '') + '</span>' +
            '<span class="wcp-pill" title="Privacy: ' + wp.privacyLevel + '">' + (privIcons[wp.privacyLevel] || '') + '</span>' +
            '<span class="wcp-pill" title="Style: ' + wp.style + '">' + (styleLabels[wp.style] || '') + '</span>' +
            '<span class="wcp-pill" title="Budget: ' + wp.budget + '">' + (budgetIcons[wp.budget] || '') + '</span>' +
            (wp.energy ? '<span class="wcp-pill wcp-pill-on" title="Energy Saver">🔋</span>' : '') +
            (wp.moisture ? '<span class="wcp-pill wcp-pill-on" title="Moisture Resistant">💧</span>' : '') +
            (wp.motorized ? '<span class="wcp-pill wcp-pill-on" title="Motorized">🔌</span>' : '') +
            (wp.childSafe ? '<span class="wcp-pill wcp-pill-on" title="Child Safe">👶</span>' : '') +
          '</div>' +
          (presetBadge ? '<div class="wcp-preset-badge">' + presetBadge + '</div>' : '') +
        '</div>' +
      '</div>';
    });
    container.innerHTML = html;

    qsa('.btn-edit-window').forEach(function(btn) {
      btn.addEventListener('click', function() { openWindowModal(parseInt(this.dataset.idx)); });
    });
    qsa('.btn-del-window').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.dataset.idx);
        DB.windows.splice(idx, 1);
        renderWindowsList();
        persist();
      });
    });
  }
}

/* ── Window preference helpers ── */
function getWindowPrefs(w) {
  var global = DB.needs;
  var wp = (w && w.prefs) || {};
  var result = {};
  var keys = ['lightPriority','privacyLevel','style','budget','energy','moisture','motorized','childSafe','uv','noise','easyClean'];
  keys.forEach(function(k) {
    result[k] = (wp[k] !== undefined && wp[k] !== null && wp[k] !== 'default') ? wp[k] : global[k];
  });
  return result;
}

function buildPresetBadge(w) {
  if (!w || !w.prefs || !w.prefs._preset) return '';
  var presets = {
    bedroom: '🌑 Bedroom Dark',
    living: '🌤️ Living Space',
    bathroom: '💧 Moisture-Ready',
    energy: '🔋 Energy Saver',
    luxury: '👑 Premium',
    budget_saver: '💵 Budget Saver',
    custom: '🎨 Customized'
  };
  return presets[w.prefs._preset] || '';
}

function applyPresetToWindow(w, preset) {
  if (!w.prefs) w.prefs = {};
  w.prefs._preset = preset;
  var p = {};
  switch (preset) {
    case 'bedroom':
      p = {lightPriority:'blackout', privacyLevel:'maximum', style:'traditional', budget:'mid-range', energy:false, moisture:false, motorized:false, childSafe:true, uv:true, noise:true, easyClean:false};
      break;
    case 'living':
      p = {lightPriority:'light-filtering', privacyLevel:'moderate', style:'transitional', budget:'mid-range', energy:false, moisture:false, motorized:false, childSafe:false, uv:true, noise:false, easyClean:true};
      break;
    case 'bathroom':
      p = {lightPriority:'light-filtering', privacyLevel:'maximum', style:'modern', budget:'economy', energy:false, moisture:true, motorized:false, childSafe:true, uv:false, noise:false, easyClean:true};
      break;
    case 'energy':
      p = {lightPriority:'light-filtering', privacyLevel:'moderate', style:'modern', budget:'mid-range', energy:true, moisture:false, motorized:false, childSafe:true, uv:true, noise:true, easyClean:false};
      break;
    case 'luxury':
      p = {lightPriority:'blackout', privacyLevel:'maximum', style:'transitional', budget:'premium', energy:false, moisture:false, motorized:true, childSafe:true, uv:true, noise:true, easyClean:false};
      break;
    case 'budget_saver':
      p = {lightPriority:'light-filtering', privacyLevel:'moderate', style:'modern', budget:'economy', energy:false, moisture:true, motorized:false, childSafe:false, uv:false, noise:false, easyClean:true};
      break;
    case 'room_default':
      // Remove all overrides — fully inherit from global
      w.prefs = {_preset: 'room_default'};
      return;
    case 'custom':
      // Keep existing overrides but mark as custom
      break;
    default: return;
  }
  // Apply preset values as overrides
  for (var k in p) {
    if (p[k] !== undefined) w.prefs[k] = p[k];
  }
}

function buildMiniWindowViz(w) {
  var ww = parseFloat(w.width) || 36;
  var wh = parseFloat(w.height) || 60;
  var maxDim = 80;
  var ratio = ww / wh;
  var vw, vh;
  if (ratio >= 1) { vw = maxDim; vh = maxDim / ratio; }
  else { vh = maxDim; vw = maxDim * ratio; }
  var sunX = 50, sunY = 50;
  if (w.direction === 'north') sunY = 8;
  else if (w.direction === 'south') sunY = 92;
  else if (w.direction === 'east') sunX = 92;
  else if (w.direction === 'west') sunX = 8;
  var shapeClass = 'mini-shape-' + (w.windowType || 'standard');
  var mountClass = w.mountType === 'outside' ? ' mini-mount-outside' : '';
  return '<div class="mini-window-viz' + mountClass + '" style="width:' + vw + 'px;height:' + vh + 'px">' +
    '<div class="mini-window-inner ' + shapeClass + '"></div>' +
    (w.direction ? '<div class="mini-sun" style="left:' + sunX + '%;top:' + sunY + '%">☀️</div>' : '') +
  '</div>';
}

function openWindowModal(idx) {
  editingWindowId = idx !== undefined && idx >= 0 ? idx : null;
  var w = editingWindowId !== null ? DB.windows[editingWindowId] : { name: '', width: '', height: '', direction: '', mountType: 'inside', windowType: 'standard' };
  var html = '<div class="modal-header"><span>' + (editingWindowId !== null ? 'Edit Window' : 'Add Window') + '</span><button class="modal-close" id="modal-close-window">✕</button></div>' +
    '<div class="modal-body">' +
      '<div class="ai-fill-row" style="margin-bottom:14px">' +
        '<input type="text" id="ai-desc-input" class="form-input" placeholder="🤖 Describe your window naturally… e.g. \"I need blackout blinds for a 48×60 inch bedroom window facing south, inside mount\"">' +
        '<button class="btn btn-primary btn-sm" id="btn-ai-fill">✨ AI Fill</button>' +
      '</div>' +
      '<div class="form-field" style="margin-bottom:12px"><label class="form-label">Window Name</label><input type="text" id="win-name" class="form-input" value="' + esc(w.name || '') + '" placeholder="e.g. Front Bay Window"></div>' +
      '<div class="form-row" style="margin-bottom:12px">' +
        '<div class="form-field"><label class="form-label">Width (inches) <span class="req">*</span></label><input type="number" id="win-width" class="form-input live-viz-input" value="' + esc(w.width || '') + '" placeholder="36" min="6" max="240" step="0.25"></div>' +
        '<div class="form-field"><label class="form-label">Height (inches) <span class="req">*</span></label><input type="number" id="win-height" class="form-input live-viz-input" value="' + esc(w.height || '') + '" placeholder="60" min="6" max="240" step="0.25"></div>' +
      '</div>' +
      '<div class="window-measure-visual" style="margin-bottom:12px">' +
        '<div class="blueprint" id="blueprint">' +
          '<div class="bp-grid"></div>' +
          '<div class="bp-canvas" id="bp-canvas">' +
            '<div class="bp-col bp-col-dim-h" id="bp-col-h-left"></div>' +
            '<div class="bp-col bp-col-main">' +
              '<div class="bp-dim bp-dim-w" id="bp-dim-w-top">' +
                '<span class="bp-dim-tick bp-dim-tick-l"></span>' +
                '<span class="bp-dim-tick bp-dim-tick-r"></span>' +
                '<span class="bp-dim-val" id="bp-dim-val-w">36″</span>' +
              '</div>' +
              '<div class="bp-window-wrap">' +
                '<div class="bp-scene" id="bp-scene">' +
                  '<div class="bp-wall"></div>' +
                  '<div class="bp-frame" id="bp-frame">' +
                    '<div class="bp-glass-pane"></div>' +
                    '<div class="bp-mullion bp-mullion-v"></div>' +
                    '<div class="bp-mullion bp-mullion-h"></div>' +
                    '<div class="bp-door-handle"></div>' +
                  '</div>' +
                  '<div class="bp-shade" id="bp-shade">' +
                    '<div class="bp-headrail"></div>' +
                    '<div class="bp-fabric"></div>' +
                    '<div class="bp-bottom-bar"></div>' +
                  '</div>' +
                  '<div class="bp-type-detail" id="bp-type-detail"></div>' +
                  '<div class="bp-sun" id="bp-sun">☀️</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="bp-col bp-col-dim-h" id="bp-col-h-right">' +
              '<div class="bp-dim bp-dim-h" id="bp-dim-h-right">' +
                '<span class="bp-dim-tick bp-dim-tick-t"></span>' +
                '<span class="bp-dim-tick bp-dim-tick-b"></span>' +
                '<span class="bp-dim-val" id="bp-dim-val-h">60″</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="bp-footer">' +
            '<span id="bp-ratio">Ratio 3:5</span>' +
            '<span class="bp-sep">·</span>' +
            '<span id="bp-mount">Inside Mount</span>' +
            '<span class="bp-sep">·</span>' +
            '<span id="bp-rule">Use narrowest width, longest height</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="form-row form-row-3" style="margin-bottom:12px">' +
        '<div class="form-field"><label class="form-label">Facing Direction</label><select id="win-direction" class="form-input live-viz-input">' +
          '<option value="">— Select —</option>' +
          '<option value="north"' + (w.direction === 'north' ? ' selected' : '') + '>North (cool, even light)</option>' +
          '<option value="south"' + (w.direction === 'south' ? ' selected' : '') + '>South (bright, warm all day)</option>' +
          '<option value="east"' + (w.direction === 'east' ? ' selected' : '') + '>East (morning sun)</option>' +
          '<option value="west"' + (w.direction === 'west' ? ' selected' : '') + '>West (strong afternoon sun)</option>' +
        '</select></div>' +
        '<div class="form-field"><label class="form-label">Mount Type</label><select id="win-mount" class="form-input live-viz-input">' +
          '<option value="inside"' + (w.mountType === 'inside' ? ' selected' : '') + '>Inside Mount</option>' +
          '<option value="outside"' + (w.mountType === 'outside' ? ' selected' : '') + '>Outside Mount</option>' +
        '</select></div>' +
        '<div class="form-field"><label class="form-label">Window Type</label><select id="win-type" class="form-input live-viz-input">' +
          '<option value="standard"' + (w.windowType === 'standard' ? ' selected' : '') + '>Standard</option>' +
          '<option value="bay"' + (w.windowType === 'bay' ? ' selected' : '') + '>Bay / Bow</option>' +
          '<option value="sliding"' + (w.windowType === 'sliding' ? ' selected' : '') + '>Sliding Door</option>' +
          '<option value="skylight"' + (w.windowType === 'skylight' ? ' selected' : '') + '>Skylight</option>' +
          '<option value="arched"' + (w.windowType === 'arched' ? ' selected' : '') + '>Arched</option>' +
          '<option value="french"' + (w.windowType === 'french' ? ' selected' : '') + '>French Door</option>' +
        '</select></div>' +
      '</div>' +
      '<div class="win-prefs-section" style="margin-bottom:12px">' +
        '<div class="win-prefs-toggle" id="win-prefs-toggle">' +
          '<span>⚙️ Window Preferences</span>' +
          '<span class="win-prefs-summary" id="win-prefs-summary">Using room defaults</span>' +
          '<span class="win-prefs-arrow">▸</span>' +
        '</div>' +
        '<div class="win-prefs-body" id="win-prefs-body" style="display:none">' +
          '<div class="win-presets" id="win-presets">' +
            '<button class="win-preset-btn" data-preset="room_default" title="Use global room settings">🏠 Room<br>Defaults</button>' +
            '<button class="win-preset-btn" data-preset="bedroom" title="Blackout, max privacy, quiet">🌑<br>Bedroom</button>' +
            '<button class="win-preset-btn" data-preset="living" title="Light filtering, moderate">🌤️<br>Living</button>' +
            '<button class="win-preset-btn" data-preset="bathroom" title="Moisture resistant, private">💧<br>Bath</button>' +
            '<button class="win-preset-btn" data-preset="energy" title="Insulating, energy saving">🔋<br>Energy</button>' +
            '<button class="win-preset-btn" data-preset="luxury" title="Premium, motorized">👑<br>Premium</button>' +
            '<button class="win-preset-btn" data-preset="budget_saver" title="Economy, practical">💵<br>Budget</button>' +
            '<button class="win-preset-btn" data-preset="custom" title="Fine-tune manually">🎨<br>Custom</button>' +
          '</div>' +
          '<div class="win-prefs-custom" id="win-prefs-custom" style="display:none">' +
            '<div class="form-row form-row-3" style="margin-top:10px">' +
              '<div class="form-field"><label class="form-label">Light Control</label><select id="wp-light" class="form-input form-input-sm">' +
                '<option value="default">↩ Room default</option>' +
                '<option value="blackout">🌑 Blackout</option>' +
                '<option value="room-darkening">🌙 Room Darkening</option>' +
                '<option value="light-filtering">🌤️ Light Filtering</option>' +
                '<option value="sheer">☁️ Sheer</option></select></div>' +
              '<div class="form-field"><label class="form-label">Privacy</label><select id="wp-privacy" class="form-input form-input-sm">' +
                '<option value="default">↩ Room default</option>' +
                '<option value="maximum">🔐 Maximum</option>' +
                '<option value="moderate">🛡️ Moderate</option>' +
                '<option value="minimal">👁️ Minimal</option></select></div>' +
              '<div class="form-field"><label class="form-label">Budget</label><select id="wp-budget" class="form-input form-input-sm">' +
                '<option value="default">↩ Room default</option>' +
                '<option value="economy">💵 Economy</option>' +
                '<option value="mid-range">💶 Mid-Range</option>' +
                '<option value="premium">💎 Premium</option>' +
                '<option value="luxury">👑 Luxury</option></select></div>' +
            '</div>' +
            '<div class="form-row form-row-3" style="margin-top:8px">' +
              '<div class="form-field"><label class="form-label">Style</label><select id="wp-style" class="form-input form-input-sm">' +
                '<option value="default">↩ Room default</option>' +
                '<option value="modern">🏢 Modern</option>' +
                '<option value="traditional">🏡 Traditional</option>' +
                '<option value="transitional">🏘️ Transitional</option>' +
                '<option value="eclectic">🎪 Eclectic</option></select></div>' +
            '</div>' +
            '<div class="checkbox-group" style="margin-top:8px">' +
              '<label class="check-option check-option-sm"><input type="checkbox" id="wp-energy"> <span>🔋 Energy Efficient</span></label>' +
              '<label class="check-option check-option-sm"><input type="checkbox" id="wp-moisture"> <span>💧 Moisture Resistant</span></label>' +
              '<label class="check-option check-option-sm"><input type="checkbox" id="wp-motorized"> <span>🔌 Motorized / Smart</span></label>' +
              '<label class="check-option check-option-sm"><input type="checkbox" id="wp-childsafe"> <span>👶 Child & Pet Safe</span></label>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<button class="btn btn-primary btn-full" id="btn-save-window">' + (editingWindowId !== null ? '💾 Update Window' : '➕ Add Window') + '</button>' +
    '</div>';
  showModal(html);
  el('btn-save-window').addEventListener('click', saveWindow);
  el('modal-close-window').addEventListener('click', closeModal);

  /* ── AI Native Fill ── */
  el('btn-ai-fill').addEventListener('click', aiFillForm);
  el('ai-desc-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); aiFillForm(); }
  });

  /* ── Live visual updates ── */
  updateMeasureVisual();
  qsa('.live-viz-input').forEach(function(inp) {
    inp.addEventListener('input', updateMeasureVisual);
    inp.addEventListener('change', updateMeasureVisual);
  });

  /* ── Window preferences section ── */
  initWindowPrefsUI(w);

  /* ── Preset buttons ── */
  qsa('.win-preset-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var preset = this.dataset.preset;
      qsa('.win-preset-btn').forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      if (preset === 'custom') {
        el('win-prefs-custom').style.display = 'block';
        el('win-prefs-summary').textContent = 'Custom settings';
      } else {
        el('win-prefs-custom').style.display = 'none';
        var labels = {room_default:'Room defaults',bedroom:'Bedroom dark',living:'Living space',bathroom:'Moisture-ready',energy:'Energy saver',luxury:'Premium',budget_saver:'Budget saver'};
        el('win-prefs-summary').textContent = labels[preset] || 'Custom';
        // Update the visual shade color based on preset
        updateShadeColor(preset);
      }
    });
  });

  /* ── Toggle prefs section ── */
  el('win-prefs-toggle').addEventListener('click', function() {
    var body = el('win-prefs-body');
    var arrow = qs('.win-prefs-arrow');
    var isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    arrow.textContent = isOpen ? '▸' : '▾';
    tool.resize();
  });
}

function initWindowPrefsUI(w) {
  var wp = w.prefs || {};
  var preset = wp._preset || 'room_default';

  /* Highlight active preset */
  qsa('.win-preset-btn').forEach(function(b) {
    b.classList.remove('active');
    if (b.dataset.preset === preset) b.classList.add('active');
  });

  /* Show custom fields if custom preset */
  if (preset === 'custom') {
    el('win-prefs-custom').style.display = 'block';
    el('win-prefs-summary').textContent = 'Custom settings';
  } else {
    var labels = {room_default:'Using room defaults',bedroom:'Bedroom dark',living:'Living space',bathroom:'Moisture-ready',energy:'Energy saver',luxury:'Premium',budget_saver:'Budget saver'};
    el('win-prefs-summary').textContent = labels[preset] || 'Using room defaults';
  }

  /* Fill custom fields */
  el('wp-light').value = wp.lightPriority || 'default';
  el('wp-privacy').value = wp.privacyLevel || 'default';
  el('wp-budget').value = wp.budget || 'default';
  el('wp-style').value = wp.style || 'default';
  el('wp-energy').checked = wp.energy || false;
  el('wp-moisture').checked = wp.moisture || false;
  el('wp-motorized').checked = wp.motorized || false;
  el('wp-childsafe').checked = wp.childSafe || false;

  /* Update shade visual */
  updateShadeColor(preset);
}

function updateShadeColor(preset) {
  var fabric = qs('.bp-fabric');
  if (!fabric) return;
  var colors = {
    bedroom: 'linear-gradient(180deg, #3a3a4a, #2a2a38, #353545)',
    living: 'linear-gradient(180deg, #f5f0e8, #ede4d4, #f0e8d8)',
    bathroom: 'linear-gradient(180deg, #f0f4f8, #e0e8f0, #e8eef4)',
    energy: 'linear-gradient(180deg, #e8ecd8, #dce4c8, #e4e8d4)',
    luxury: 'linear-gradient(180deg, #e8e0d0, #d8c8b0, #e0d4c0)',
    budget_saver: 'linear-gradient(180deg, #f8f4f0, #f0ebe4, #f5f0ea)'
  };
  fabric.style.background = colors[preset] || '';
}

/* ── Live Blueprint Visual Updater ── */
function updateMeasureVisual() {
  var scene = el('bp-scene');
  var sun = el('bp-sun');
  var valW = el('bp-dim-val-w');
  var valH = el('bp-dim-val-h');
  var ratioEl = el('bp-ratio');
  var mountEl = el('bp-mount');
  var ruleEl = el('bp-rule');
  if (!scene) return;

  var ww = parseFloat(el('win-width').value) || 36;
  var wh = parseFloat(el('win-height').value) || 60;
  var dir = el('win-direction').value;
  var mount = el('win-mount').value;
  var wtype = el('win-type').value;

  /* Scale scene to fit max area while keeping proportion */
  var maxW = 220, maxH = 240;
  var ratio = ww / wh;
  var fw, fh;
  if (ratio >= (maxW / maxH)) { fw = maxW; fh = Math.round(maxW / ratio); }
  else { fh = maxH; fw = Math.round(maxH * ratio); }

  /* Scene is the single source of truth */
  scene.style.width = fw + 'px';
  scene.style.height = fh + 'px';
  var isOutside = mount === 'outside';
  scene.className = 'bp-scene type-' + (wtype || 'standard') + (isOutside ? ' mount-outside' : ' mount-inside');

  /* Dimension bars — same width/height as scene for perfect alignment */
  var dimW = el('bp-dim-w-top');
  var dimH = el('bp-dim-h-right');
  if (dimW) dimW.style.width = fw + 'px';
  if (dimH) dimH.style.height = fh + 'px';
  if (valW) valW.textContent = ww + '\u2033';
  if (valH) valH.textContent = wh + '\u2033';

  /* Ratio display */
  var gcd = function(a, b) { return b ? gcd(b, a % b) : a; };
  var g = gcd(Math.round(ww * 4), Math.round(wh * 4));
  var rw = Math.round(ww * 4) / g;
  var rh = Math.round(wh * 4) / g;
  if (rw > 20 || rh > 20) { rw = +(rw / 4).toFixed(1); rh = +(rh / 4).toFixed(1); }
  if (ratioEl) {
    if (rw % 1 === 0 && rh % 1 === 0 && rw < 20 && rh < 20) {
      ratioEl.textContent = 'Ratio ' + rw + ':' + rh;
    } else {
      ratioEl.textContent = ww + '\u2033 \u00d7 ' + wh + '\u2033';
    }
  }

  /* Mount label */
  if (mountEl) {
    mountEl.textContent = isOutside ? 'Outside Mount' : 'Inside Mount';
    mountEl.style.color = isOutside ? 'var(--blue)' : '';
  }

  /* Direction sun */
  if (sun) {
    var sx = 50, sy = 50;
    if (dir === 'north') sy = 6;
    else if (dir === 'south') sy = 94;
    else if (dir === 'east') sx = 94;
    else if (dir === 'west') sx = 6;
    sun.style.left = sx + '%';
    sun.style.top = sy + '%';
    sun.style.display = dir ? 'block' : 'none';
  }

  /* Rule hint */
  if (ruleEl) ruleEl.innerHTML = 'Use <strong>narrowest</strong> width, <strong>longest</strong> height';
}

function saveWindow() {
  var win = {
    name: el('win-name').value.trim(),
    width: el('win-width').value,
    height: el('win-height').value,
    direction: el('win-direction').value,
    mountType: el('win-mount').value,
    windowType: el('win-type').value
  };
  if (!win.width || !win.height) { showToast('Please enter width and height.', 'warning'); return; }
  win.width = parseFloat(win.width);
  win.height = parseFloat(win.height);
  if (win.width < 6 || win.height < 6) { showToast('Minimum window size is 6 inches.', 'warning'); return; }

  /* Collect per-window preferences */
  var activePreset = 'room_default';
  qsa('.win-preset-btn.active').forEach(function(b) { activePreset = b.dataset.preset; });
  win.prefs = { _preset: activePreset };

  if (activePreset === 'custom') {
    /* Read custom fields — only store non-default values */
    var fields = [
      {id:'wp-light', key:'lightPriority'}, {id:'wp-privacy', key:'privacyLevel'},
      {id:'wp-budget', key:'budget'}, {id:'wp-style', key:'style'}
    ];
    fields.forEach(function(f) {
      var val = el(f.id).value;
      if (val && val !== 'default') win.prefs[f.key] = val;
    });
    if (el('wp-energy').checked) win.prefs.energy = true;
    if (el('wp-moisture').checked) win.prefs.moisture = true;
    if (el('wp-motorized').checked) win.prefs.motorized = true;
    if (el('wp-childsafe').checked) win.prefs.childSafe = true;
  } else if (activePreset !== 'room_default') {
    /* Apply preset values */
    applyPresetToWindow(win, activePreset);
  }

  if (editingWindowId !== null) {
    DB.windows[editingWindowId] = win;
  } else {
    DB.windows.push(win);
  }
  editingWindowId = null;
  closeModal();
  renderWindowsList();
  persist();
  showToast('Window saved!', 'success');
}

/* ── Needs Analysis ── */
function renderNeedsPage() {
  var n = DB.needs;
  var lightRadio = qs('input[name="light-priority"][value="' + n.lightPriority + '"]');
  if (lightRadio) lightRadio.checked = true;
  var privacyRadio = qs('input[name="privacy-level"][value="' + n.privacyLevel + '"]');
  if (privacyRadio) privacyRadio.checked = true;
  var styleRadio = qs('input[name="style-preference"][value="' + n.style + '"]');
  if (styleRadio) styleRadio.checked = true;
  var budgetRadio = qs('input[name="budget-range"][value="' + n.budget + '"]');
  if (budgetRadio) budgetRadio.checked = true;
  el('need-energy').checked = n.energy;
  el('need-moisture').checked = n.moisture;
  el('need-motorized').checked = n.motorized;
  el('need-child-safe').checked = n.childSafe;
  el('need-uv').checked = n.uv;
  el('need-noise').checked = n.noise;
  el('need-easy-clean').checked = n.easyClean;
}

function collectNeedsFromUI() {
  var n = DB.needs;
  var lightEl = qs('input[name="light-priority"]:checked');
  if (lightEl) n.lightPriority = lightEl.value;
  var privacyEl = qs('input[name="privacy-level"]:checked');
  if (privacyEl) n.privacyLevel = privacyEl.value;
  var styleEl = qs('input[name="style-preference"]:checked');
  if (styleEl) n.style = styleEl.value;
  var budgetEl = qs('input[name="budget-range"]:checked');
  if (budgetEl) n.budget = budgetEl.value;
  n.energy = el('need-energy').checked;
  n.moisture = el('need-moisture').checked;
  n.motorized = el('need-motorized').checked;
  n.childSafe = el('need-child-safe').checked;
  n.uv = el('need-uv').checked;
  n.noise = el('need-noise').checked;
  n.easyClean = el('need-easy-clean').checked;
}

function applyRoomDefaults() {
  var roomType = DB.room.type;
  if (!roomType || !ROOM_DEFAULTS[roomType]) return;
  var d = ROOM_DEFAULTS[roomType];
  DB.needs.lightPriority = d.lightControl;
  DB.needs.privacyLevel = d.privacy;
  DB.needs.style = d.style;
  DB.needs.energy = d.energy;
  DB.needs.moisture = d.moisture;
  DB.needs.motorized = d.motorized;
  DB.needs.childSafe = d.childSafe;
  DB.needs.uv = d.uv;
  DB.needs.noise = d.noise;
  DB.needs.easyClean = d.easyClean;
  renderNeedsPage();
}

/* ── AI Recommendations ── */
function scoreProduct(p, n) {
  var score = 0;
  var maxScore = 10;

  if (p.lightControl === n.lightPriority) score += 3;
  else if ((p.lightControl === 'room-darkening' && n.lightPriority === 'blackout') ||
           (p.lightControl === 'blackout' && n.lightPriority === 'room-darkening')) score += 1;

  if (p.privacy === n.privacyLevel) score += 2;
  else if ((p.privacy === 'maximum' && n.privacyLevel === 'moderate') ||
           (p.privacy === 'moderate' && n.privacyLevel === 'maximum')) score += 1;

  if (n.energy && p.energy) score += 1;
  if (n.moisture && p.moisture) score += 1;
  if (n.motorized && p.motorized) score += 1;
  if (n.childSafe && p.childSafe) score += 1;
  if (n.uv && p.uv) score += 1;
  if (n.noise && p.noise) score += 1;
  if (n.easyClean && p.easyClean) score += 1;

  if (p.styles.indexOf(n.style) >= 0) score += 2;

  var budgetTiers = ['economy','mid-range','premium','luxury'];
  var pTier = budgetTiers.indexOf(p.budget);
  var nTier = budgetTiers.indexOf(n.budget);
  if (pTier === nTier) score += 1;
  else if (Math.abs(pTier - nTier) === 1) score += 0.5;

  return { score: score, max: maxScore, pct: Math.round((score / maxScore) * 100) };
}

function runAIRecommendations() {
  collectNeedsFromUI();
  /* Score each product against ALL windows, average the scores */
  var windowPrefs = DB.windows.map(function(w) { return getWindowPrefs(w); });
  if (!windowPrefs.length) windowPrefs = [DB.needs]; // fallback to global
  var scored = CATALOG.map(function(p) {
    var totalScore = 0;
    windowPrefs.forEach(function(wp) {
      totalScore += scoreProduct(p, wp).score;
    });
    var avgScore = totalScore / windowPrefs.length;
    var avgPct = Math.round((avgScore / 10) * 100);
    // Also get reasons from primary prefs
    var reasons = generateReason(p, windowPrefs[0]);
    return { product: p, score: avgScore, pct: avgPct, reason: reasons };
  });
  scored.sort(function(a, b) { return b.score - a.score; });
  DB.recommendations = scored.slice(0, 6).map(function(s) { return { productId: s.product.id, pct: s.pct, reason: s.reason }; });
  renderRecommendPage();
  persist();
}

function generateReason(p, n) {
  var reasons = [];
  if (p.lightControl === n.lightPriority) reasons.push('Matches your ' + n.lightPriority.replace('-',' ') + ' light preference');
  if (p.privacy === n.privacyLevel) reasons.push('Provides ' + n.privacyLevel + ' privacy');
  if (n.energy && p.energy) reasons.push('Energy-efficient cellular design saves on bills');
  if (n.moisture && p.moisture) reasons.push('Moisture-resistant — perfect for humid spaces');
  if (n.motorized && p.motorized) reasons.push('Smart home compatible with app/voice control');
  if (n.childSafe && p.childSafe) reasons.push('Cordless design for child & pet safety');
  if (n.uv && p.uv) reasons.push('UV protection for furniture & flooring');
  if (n.noise && p.noise) reasons.push('Sound-dampening for quieter rooms');
  if (n.easyClean && p.easyClean) reasons.push('Low-maintenance, easy-clean surface');
  if (p.styles.indexOf(n.style) >= 0) reasons.push('Complements ' + n.style + ' décor');
  if (reasons.length === 0) reasons.push('A versatile choice for your space');
  return reasons;
}

function renderRecommendPage() {
  var container = el('recommendations-container');
  var empty = el('recommend-empty');
  if (!DB.recommendations.length) {
    container.innerHTML = '';
    container.appendChild(empty);
    empty.style.display = 'block';
    return;
  }
  if (empty) empty.remove();
  var html = '';
  DB.recommendations.forEach(function(rec, i) {
    var p = findProduct(rec.productId);
    if (!p) return;
    var selected = DB.selectedProducts.some(function(sp) { return sp.productId === rec.productId; });
    html += '<div class="rec-card' + (selected ? ' selected' : '') + '" data-pid="' + esc(rec.productId) + '">' +
      '<div class="rec-card-header">' +
        '<div class="rec-card-icon">' + esc(p.icon) + '</div>' +
        '<div class="rec-card-info">' +
          '<div class="rec-card-name">' + esc(p.name) + '</div>' +
          '<div class="rec-card-type">' + esc(p.type) + '</div>' +
        '</div>' +
        '<div class="rec-card-match">🎯 ' + esc(rec.pct) + '% Match</div>' +
      '</div>' +
      '<div class="rec-card-desc">' + esc(p.desc) + '</div>' +
      '<div class="rec-card-tags">' +
        rec.reason.map(function(r) { return '<span class="rec-tag good">✓ ' + esc(r) + '</span>'; }).join('') +
        '<span class="rec-tag">' + esc(p.budget.replace('-',' ')) + '</span>' +
      '</div>' +
      '<div class="rec-card-footer">' +
        '<div class="rec-card-price">' + fmtMoney(p.basePrice) + ' <small>est. per window</small></div>' +
        '<button class="btn ' + (selected ? 'btn-outline' : 'btn-primary') + ' btn-sm btn-select-rec" data-pid="' + esc(rec.productId) + '">' + (selected ? '✓ Selected' : '+ Add to Quote') + '</button>' +
      '</div>' +
    '</div>';
  });
  container.innerHTML = html;

  qsa('.btn-select-rec').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleProductSelection(this.dataset.pid);
    });
  });
  qsa('.rec-card').forEach(function(card) {
    card.addEventListener('click', function() {
      toggleProductSelection(card.dataset.pid);
    });
  });
}

function toggleProductSelection(productId) {
  var idx = DB.selectedProducts.findIndex(function(sp) { return sp.productId === productId; });
  if (idx >= 0) {
    DB.selectedProducts.splice(idx, 1);
    showToast('Removed from quote', 'info');
  } else {
    var p = findProduct(productId);
    if (!p) return;
    DB.selectedProducts.push({
      productId: productId,
      color: p.colors[0],
      material: p.materials[0],
      mountType: p.mountTypes[0],
      quantity: DB.windows.length || 1,
      motorized: p.motorized,
      notes: ''
    });
    showToast('Added to quote!', 'success');
  }
  renderRecommendPage();
  persist();
}

function findProduct(id) {
  return CATALOG.find(function(p) { return p.id === id; });
}

/* ── AI Streaming Recommendation Generation ── */
function generateAIRecommendationsWithStream() {
  collectNeedsFromUI();
  var thinking = el('ai-thinking');
  thinking.style.display = 'block';
  var container = el('recommendations-container');
  var empty = el('recommend-empty');
  if (empty) empty.style.display = 'none';

  var prompt = buildRecommendationPrompt();
  var context = buildRecommendationContext();

  el('ai-thinking-text').textContent = 'Analyzing your room requirements...';

  tool.requestAIStream(prompt, context, {
    onToken: function(token) {
      el('ai-thinking-text').textContent = 'AI is thinking: ' + token.slice(0, 60) + (token.length > 60 ? '...' : '');
    },
    onComplete: function(fullText) {
      thinking.style.display = 'none';
      runAIRecommendations();
    },
    onError: function(err) {
      thinking.style.display = 'none';
      showToast('AI unavailable — using rule-based matching instead.', 'warning');
      runAIRecommendations();
    }
  });
}

function buildRecommendationPrompt() {
  var n = DB.needs;
  var windows = DB.windows;
  var room = DB.room;
  return 'You are a professional window treatment consultant. Based on the following customer needs, recommend the best 3-4 types of blinds or shades. For each recommendation, provide: product name, why it fits, and a price range estimate.\n\n' +
    'Customer needs:\n' +
    '- Room: ' + (room.type || 'Not specified') + ' (' + (room.size || 'medium') + ')\n' +
    '- Windows: ' + (windows.length || 1) + ' window(s)\n' +
    '- Light control: ' + n.lightPriority + '\n' +
    '- Privacy: ' + n.privacyLevel + '\n' +
    '- Style: ' + n.style + '\n' +
    '- Budget: ' + n.budget + '\n' +
    '- Energy efficiency: ' + (n.energy ? 'Yes' : 'No') + '\n' +
    '- Moisture resistant: ' + (n.moisture ? 'Yes' : 'No') + '\n' +
    '- Motorized/smart: ' + (n.motorized ? 'Yes' : 'No') + '\n' +
    '- Child/pet safe: ' + (n.childSafe ? 'Yes' : 'No') + '\n' +
    '- UV protection: ' + (n.uv ? 'Yes' : 'No') + '\n' +
    '- Noise reduction: ' + (n.noise ? 'Yes' : 'No') + '\n' +
    '- Easy clean: ' + (n.easyClean ? 'Yes' : 'No') + '\n\n' +
    'Respond concisely with your top recommendations.';
}

function buildRecommendationContext() {
  return 'Product catalog includes: ' + CATALOG.map(function(p) { return p.name + ' (' + p.type + ', ' + p.budget + ')'; }).join('; ') + '.';
}

/* ── Customize ── */
function renderCustomizePage() {
  var container = el('customize-container');
  if (!DB.selectedProducts.length) {
    container.innerHTML = '<div class="empty-state">No products selected yet. Go back to AI Recommendations and select your favorites.</div>';
    return;
  }
  var html = '';
  DB.selectedProducts.forEach(function(sp, i) {
    var p = findProduct(sp.productId);
    if (!p) return;
    html += '<div class="customize-item">' +
      '<div class="customize-item-header">' +
        '<div class="customize-item-icon">' + esc(p.icon) + '</div>' +
        '<div>' +
          '<div class="customize-item-name">' + esc(p.name) + '</div>' +
          '<div class="customize-item-type">' + esc(p.type) + ' · ' + fmtMoney(p.basePrice) + ' base</div>' +
        '</div>' +
        '<button class="btn btn-outline btn-sm" style="margin-left:auto" data-remove-custom="' + i + '">✕ Remove</button>' +
      '</div>' +
      '<div class="form-row form-row-3" style="margin-bottom:12px">' +
        '<div class="form-field">' +
          '<label class="form-label">Color</label>' +
          '<div class="color-swatches">' +
            (p.colors || []).map(function(c) {
              return '<div class="color-swatch' + (c === sp.color ? ' selected' : '') + '" style="background:' + c + '" data-color="' + c + '" data-idx="' + i + '" title="' + c + '"></div>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="form-field">' +
          '<label class="form-label">Material</label>' +
          '<select class="form-input custom-material" data-idx="' + i + '">' +
            (p.materials || []).map(function(m) {
              return '<option value="' + esc(m) + '"' + (m === sp.material ? ' selected' : '') + '>' + esc(m) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="form-field">' +
          '<label class="form-label">Mount Type</label>' +
          '<select class="form-input custom-mount" data-idx="' + i + '">' +
            (p.mountTypes || []).map(function(mt) {
              return '<option value="' + esc(mt) + '"' + (mt === sp.mountType ? ' selected' : '') + '>' + esc(MOUNT_TYPES[mt] || mt) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
      '</div>' +
      '<div class="form-row form-row-3">' +
        '<div class="form-field">' +
          '<label class="form-label">Quantity</label>' +
          '<input type="number" class="form-input custom-qty" data-idx="' + i + '" value="' + sp.quantity + '" min="1" max="50">' +
        '</div>' +
        (p.motorized ? '' : '<div class="form-field">' +
          '<label class="check-option"><input type="checkbox" class="custom-motorized" data-idx="' + i + '"' + (sp.motorized ? ' checked' : '') + '> <span>🔌 Add Motorization (+$180/window)</span></label>' +
        '</div>') +
        '<div class="form-field">' +
          '<label class="form-label">Notes</label>' +
          '<input type="text" class="form-input custom-notes" data-idx="' + i + '" value="' + esc(sp.notes || '') + '" placeholder="Special instructions...">' +
        '</div>' +
      '</div>' +
    '</div>';
  });
  container.innerHTML = html;

  qsa('.color-swatch').forEach(function(sw) {
    sw.addEventListener('click', function() {
      var idx = parseInt(this.dataset.idx);
      var color = this.dataset.color;
      DB.selectedProducts[idx].color = color;
      renderCustomizePage();
      persist();
    });
  });
  qsa('.custom-material').forEach(function(sel) {
    sel.addEventListener('change', function() {
      DB.selectedProducts[parseInt(this.dataset.idx)].material = this.value;
      persist();
    });
  });
  qsa('.custom-mount').forEach(function(sel) {
    sel.addEventListener('change', function() {
      DB.selectedProducts[parseInt(this.dataset.idx)].mountType = this.value;
      persist();
    });
  });
  qsa('.custom-qty').forEach(function(inp) {
    inp.addEventListener('change', function() {
      DB.selectedProducts[parseInt(this.dataset.idx)].quantity = Math.max(1, parseInt(this.value) || 1);
      persist();
    });
  });
  qsa('.custom-motorized').forEach(function(cb) {
    cb.addEventListener('change', function() {
      DB.selectedProducts[parseInt(this.dataset.idx)].motorized = this.checked;
      persist();
    });
  });
  qsa('.custom-notes').forEach(function(inp) {
    inp.addEventListener('change', function() {
      DB.selectedProducts[parseInt(this.dataset.idx)].notes = this.value;
      persist();
    });
  });
  qsa('[data-remove-custom]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      DB.selectedProducts.splice(parseInt(this.dataset.removeCustom), 1);
      renderCustomizePage();
      persist();
    });
  });
}

/* ── Quote ── */
function renderQuotePage() {
  el('quote-name').value = DB.quote.name;
  el('quote-email').value = DB.quote.email;
  el('quote-phone').value = DB.quote.phone;
  renderQuoteItems();
  renderQuoteSummary();
}

function renderQuoteItems() {
  var container = el('quote-items-container');
  if (!DB.selectedProducts.length) {
    container.innerHTML = '<div class="empty-state">No products in your quote. Go back and add some!</div>';
    return;
  }
  var html = '';
  DB.selectedProducts.forEach(function(sp, i) {
    var p = findProduct(sp.productId);
    if (!p) return;
    var basePrice = p.basePrice;
    if (sp.motorized && !p.motorized) basePrice += 180;
    var itemTotal = basePrice * sp.quantity;
    html += '<div class="quote-item">' +
      '<div class="quote-item-icon">' + esc(p.icon) + '</div>' +
      '<div class="quote-item-info">' +
        '<div class="quote-item-name">' + esc(p.name) + '</div>' +
        '<div class="quote-item-detail">' + esc(sp.material) + ' · ' + esc(MOUNT_TYPES[sp.mountType] || sp.mountType) + ' · Color: <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:' + esc(sp.color) + ';vertical-align:middle;border:1px solid var(--border)"></span>' + (sp.motorized ? ' · Motorized' : '') + '</div>' +
        (sp.notes ? '<div class="quote-item-detail">📝 ' + esc(sp.notes) + '</div>' : '') +
      '</div>' +
      '<input type="number" class="form-input quote-item-qty" value="' + sp.quantity + '" min="1" data-qty-idx="' + i + '" style="width:60px">' +
      '<div class="quote-item-price">' + fmtMoney(itemTotal) + '</div>' +
      '<button class="quote-item-remove" data-remove-idx="' + i + '" title="Remove">🗑️</button>' +
    '</div>';
  });
  container.innerHTML = html;

  qsa('.quote-item-qty').forEach(function(inp) {
    inp.addEventListener('change', function() {
      var idx = parseInt(this.dataset.qtyIdx);
      DB.selectedProducts[idx].quantity = Math.max(1, parseInt(this.value) || 1);
      renderQuoteItems();
      renderQuoteSummary();
      persist();
    });
  });
  qsa('.quote-item-remove').forEach(function(btn) {
    btn.addEventListener('click', function() {
      DB.selectedProducts.splice(parseInt(this.dataset.removeIdx), 1);
      renderQuoteItems();
      renderQuoteSummary();
      persist();
    });
  });
}

function renderQuoteSummary() {
  var container = el('quote-summary');
  var summaryCard = el('quote-summary-card');
  if (!DB.selectedProducts.length) {
    summaryCard.style.display = 'none';
    return;
  }
  summaryCard.style.display = 'block';
  var subtotal = 0;
  DB.selectedProducts.forEach(function(sp) {
    var p = findProduct(sp.productId);
    if (!p) return;
    var base = p.basePrice;
    if (sp.motorized && !p.motorized) base += 180;
    subtotal += base * sp.quantity;
  });
  var installPerWindow = 45;
  var windowCount = DB.windows.length || DB.selectedProducts.reduce(function(sum, sp) { return sum + sp.quantity; }, 0);
  var installFee = windowCount * installPerWindow;
  var tax = Math.round((subtotal + installFee) * 0.08 * 100) / 100;
  var total = Math.round((subtotal + installFee + tax) * 100) / 100;

  var html = '';
  html += '<div class="quote-summary-row"><span>Products Subtotal (' + DB.selectedProducts.length + ' type' + (DB.selectedProducts.length > 1 ? 's' : '') + ')</span><span>' + fmtMoney(subtotal) + '</span></div>';
  html += '<div class="quote-summary-row"><span>Estimated Installation (' + windowCount + ' window' + (windowCount > 1 ? 's' : '') + ' @ ' + fmtMoney(installPerWindow) + '/ea)</span><span>' + fmtMoney(installFee) + '</span></div>';
  html += '<div class="quote-summary-row"><span>Estimated Tax (8%)</span><span>' + fmtMoney(tax) + '</span></div>';
  html += '<div class="quote-summary-row total"><span>Estimated Total</span><span>' + fmtMoney(total) + '</span></div>';
  html += '<div style="font-size:11px;color:var(--text3);margin-top:8px">* This is an estimate. Final pricing confirmed after in-home measurement.</div>';
  container.innerHTML = html;
}

function collectQuoteInfo() {
  DB.quote.name = el('quote-name').value.trim();
  DB.quote.email = el('quote-email').value.trim();
  DB.quote.phone = el('quote-phone').value.trim();
}

function saveConsultation() {
  collectQuoteInfo();
  if (!DB.quote.name || !DB.quote.email) { showToast('Please enter your name and email.', 'warning'); return; }
  var consultation = {
    id: genId(),
    date: new Date().toISOString(),
    name: DB.quote.name,
    email: DB.quote.email,
    phone: DB.quote.phone,
    room: JSON.parse(JSON.stringify(DB.room)),
    windows: JSON.parse(JSON.stringify(DB.windows)),
    needs: JSON.parse(JSON.stringify(DB.needs)),
    products: JSON.parse(JSON.stringify(DB.selectedProducts)),
    totalWindows: DB.windows.length || DB.selectedProducts.reduce(function(s, sp) { return s + sp.quantity; }, 0)
  };
  DB.consultations.unshift(consultation);
  if (DB.consultations.length > 50) DB.consultations = DB.consultations.slice(0, 50);
  persist();
  showToast('Consultation saved! 📁', 'success');
  navigateTo('history');
}

/* ── History ── */
function renderHistoryPage() {
  var container = el('history-container');
  if (!DB.consultations.length) {
    container.innerHTML = '<div class="empty-state">No saved consultations yet. Complete a consultation and save it to see it here.</div>';
    return;
  }
  var html = '';
  DB.consultations.forEach(function(c) {
    var productCount = c.products ? c.products.length : 0;
    var totalEstimate = 0;
    if (c.products) {
      c.products.forEach(function(sp) {
        var p = findProduct(sp.productId);
        if (p) {
          var base = p.basePrice;
          if (sp.motorized && !p.motorized) base += 180;
          totalEstimate += base * (sp.quantity || 1);
        }
      });
    }
    html += '<div class="history-item" data-cons-id="' + esc(c.id) + '">' +
      '<div class="history-item-header">' +
        '<span style="font-weight:600">' + esc(c.name) + '</span>' +
        '<span class="history-item-date">' + fmtDate(c.date) + '</span>' +
      '</div>' +
      '<div class="history-item-rooms">' +
        '🏠 ' + esc(c.room.type || 'Not specified') + ' · ' +
        '🪟 ' + (c.windows ? c.windows.length : c.totalWindows || 0) + ' window(s) · ' +
        '📦 ' + productCount + ' product(s) · ' +
        '🎨 ' + esc(c.needs.style || 'N/A') +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">' +
        '<span class="history-item-total">Est. ' + fmtMoney(totalEstimate) + '</span>' +
        '<div>' +
          '<button class="btn btn-outline btn-sm btn-load-cons" data-cons-id="' + esc(c.id) + '">📂 Load</button>' +
          '<button class="btn btn-outline btn-sm btn-del-cons" data-cons-id="' + esc(c.id) + '" style="color:var(--red);border-color:var(--red);margin-left:4px">🗑️</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  });
  container.innerHTML = html;

  qsa('.btn-load-cons').forEach(function(btn) {
    btn.addEventListener('click', function() { loadConsultation(this.dataset.consId); });
  });
  qsa('.btn-del-cons').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var id = this.dataset.consId;
      DB.consultations = DB.consultations.filter(function(c) { return c.id !== id; });
      renderHistoryPage();
      persist();
      showToast('Consultation deleted.', 'info');
    });
  });
  qsa('.history-item').forEach(function(item) {
    item.addEventListener('click', function() { loadConsultation(item.dataset.consId); });
  });
}

function loadConsultation(id) {
  var c = DB.consultations.find(function(x) { return x.id === id; });
  if (!c) return;
  DB.room = c.room || { type: '', size: 'medium' };
  DB.windows = c.windows || [];
  DB.needs = c.needs || {};
  DB.selectedProducts = c.products || [];
  DB.quote = { name: c.name || '', email: c.email || '', phone: c.phone || '' };
  DB.recommendations = [];
  showToast('Consultation loaded!', 'success');
  navigateTo('room');
}

/* ── Catalog ── */
function renderCatalogPage() {
  var search = (el('catalog-search').value || '').toLowerCase();
  var filter = el('catalog-filter').value;
  var filtered = CATALOG.filter(function(p) {
    if (filter && p.cat !== filter) return false;
    if (search && p.name.toLowerCase().indexOf(search) < 0 && p.type.toLowerCase().indexOf(search) < 0 && p.desc.toLowerCase().indexOf(search) < 0) return false;
    return true;
  });
  var grid = el('catalog-grid');
  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">No products match your search.</div>';
    return;
  }
  var html = '';
  filtered.forEach(function(p) {
    html += '<div class="catalog-card" data-pid="' + esc(p.id) + '">' +
      '<div class="catalog-card-visual" style="background:linear-gradient(135deg, var(--accent-light) 0%, var(--surface) 100%)">' +
        '<span>' + esc(p.icon) + '</span>' +
      '</div>' +
      '<div class="catalog-card-body">' +
        '<div class="catalog-card-cat">' + esc(p.type) + '</div>' +
        '<div class="catalog-card-name">' + esc(p.name) + '</div>' +
        '<div class="catalog-card-desc">' + esc(p.desc.slice(0, 100)) + '...</div>' +
        '<div class="catalog-card-footer">' +
          '<span class="catalog-card-price">' + fmtMoney(p.basePrice) + '</span>' +
          '<button class="btn btn-primary btn-sm btn-catalog-add" data-pid="' + esc(p.id) + '">+ Add</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  });
  grid.innerHTML = html;

  qsa('.btn-catalog-add').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleProductSelection(this.dataset.pid);
      renderCatalogPage();
    });
  });
  qsa('.catalog-card').forEach(function(card) {
    card.addEventListener('click', function() {
      toggleProductSelection(card.dataset.pid);
      renderCatalogPage();
    });
  });
}

/* ── AI Chat ── */
function addChatMessage(role, text) {
  DB.chatMessages.push({ role: role, text: text, time: Date.now() });
  renderChatMessages();
}

function renderChatMessages() {
  var container = el('ai-chat-messages');
  var html = '';
  DB.chatMessages.forEach(function(m) {
    var cls = m.role === 'user' ? 'ai-msg-user' : 'ai-msg-bot';
    var avatar = m.role === 'user' ? '👤' : '🤖';
    html += '<div class="ai-msg ' + cls + '"><div class="ai-msg-avatar">' + avatar + '</div><div class="ai-msg-text">' + esc(m.text) + '</div></div>';
  });
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

function sendChatMessage() {
  var input = el('ai-chat-input');
  var text = input.value.trim();
  if (!text || aiThinking) return;
  input.value = '';
  addChatMessage('user', text);

  var context = 'The customer is consulting about blinds and shades. Their room: ' + (DB.room.type || 'unspecified') +
    ', light need: ' + DB.needs.lightPriority + ', privacy: ' + DB.needs.privacyLevel +
    ', style: ' + DB.needs.style + ', budget: ' + DB.needs.budget + '.';

  aiThinking = true;
  tool.requestAI(text, context, function(err, response) {
    aiThinking = false;
    if (err && !response) {
      addChatMessage('bot', 'Sorry, I encountered an issue. Let me provide general guidance instead. ' + getFallbackResponse(text));
    } else {
      if (err) console.warn('AI warning:', err);
      addChatMessage('bot', response || getFallbackResponse(text));
    }
    persist();
    tool.resize();
  });
}

function getFallbackResponse(query) {
  var q = query.toLowerCase();
  if (q.indexOf('blackout') >= 0 || q.indexOf('dark') >= 0 || q.indexOf('bedroom') >= 0) {
    return 'For complete darkness, I recommend **Blackout Roller Shades** or **Cellular Blackout Shades**. Roller shades offer a sleek modern look, while cellular shades add energy-saving insulation — perfect for bedrooms. Both block 99%+ of light.';
  }
  if (q.indexOf('energy') >= 0 || q.indexOf('save') >= 0 || q.indexOf('bill') >= 0) {
    return 'For energy savings, **Cellular (Honeycomb) Shades** are your best bet. Their honeycomb cells trap air, creating an insulating layer that can reduce heat loss by up to 40% in winter and block heat gain in summer. They pay for themselves over time!';
  }
  if (q.indexOf('bathroom') >= 0 || q.indexOf('kitchen') >= 0 || q.indexOf('moisture') >= 0 || q.indexOf('humidity') >= 0) {
    return 'For moisture-prone areas like bathrooms and kitchens, go with **Faux Wood Venetian Blinds** or **PVC Roller Shades**. They won\'t warp, crack, or fade from humidity, and they\'re super easy to wipe clean.';
  }
  if (q.indexOf('smart') >= 0 || q.indexOf('motor') >= 0 || q.indexOf('alexa') >= 0 || q.indexOf('google') >= 0) {
    return 'Our **Smart Motorized Shades** work with Alexa, Google Home, and Apple HomeKit. You can schedule them to open/close automatically, control them by voice, or use the smartphone app from anywhere. Battery and hardwired options available.';
  }
  if (q.indexOf('price') >= 0 || q.indexOf('cost') >= 0 || q.indexOf('budget') >= 0) {
    return 'Our pricing ranges from about **$40/window** for basic aluminum blinds to **$500+/window** for premium motorized custom shades. Most homeowners spend $80–$200 per window for quality mid-range options like faux wood blinds or cellular shades. Installation is typically $35–$60 per window.';
  }
  if (q.indexOf('measure') >= 0 || q.indexOf('size') >= 0 || q.indexOf('dimension') >= 0) {
    return '📐 **Measuring Guide:** For inside mount — measure width at top, middle, and bottom (use narrowest). Measure height at left, center, and right (use longest). For outside mount — measure the exact area you want to cover and add 2–3 inches on each side for overlap. Always use a steel tape measure, not a cloth one!';
  }
  return 'Great question! Based on your profile, I\'d suggest exploring our **Cellular Shades** for energy efficiency, **Faux Wood Blinds** for durability, or **Roller Shades** for a clean modern look. Would you like me to run a full AI recommendation based on your needs? Just click "Get AI Recommendations" on the Needs Analysis page!';
}

/* ── Email Quote ── */
function emailQuote() {
  collectQuoteInfo();
  if (!DB.quote.email) { showToast('Please enter your email address first.', 'warning'); return; }
  if (!DB.selectedProducts.length) { showToast('No products in your quote.', 'warning'); return; }

  var bodyHtml = '<h2>Your Window Treatment Quote</h2><p>Thank you, ' + esc(DB.quote.name) + '! Here\'s a summary:</p><table style="width:100%;border-collapse:collapse;">' +
    '<tr style="background:#f5f0e8"><th style="padding:8px;text-align:left">Product</th><th style="padding:8px">Qty</th><th style="padding:8px;text-align:right">Price</th></tr>';
  var subtotal = 0;
  DB.selectedProducts.forEach(function(sp) {
    var p = findProduct(sp.productId);
    if (!p) return;
    var base = p.basePrice;
    if (sp.motorized && !p.motorized) base += 180;
    var itemTotal = base * sp.quantity;
    subtotal += itemTotal;
    bodyHtml += '<tr><td style="padding:8px">' + esc(p.name) + ' — ' + esc(sp.material) + '</td><td style="padding:8px;text-align:center">' + sp.quantity + '</td><td style="padding:8px;text-align:right">' + fmtMoney(itemTotal) + '</td></tr>';
  });
  bodyHtml += '<tr style="font-weight:bold"><td colspan="2" style="padding:8px;text-align:right">Estimated Total:</td><td style="padding:8px;text-align:right">' + fmtMoney(subtotal) + '</td></tr></table>';
  bodyHtml += '<p style="color:#888;font-size:12px">* Final pricing after in-home measurement. Contact us to schedule!</p>';

  tool.requestSendEmail({
    to: DB.quote.email,
    subject: 'Your Window Treatment Quote — AI Blinds Concierge',
    title: 'Your Blinds Quote',
    htmlBody: bodyHtml
  }, function(err, result) {
    if (err) {
      showToast('Email failed: ' + err, 'error');
      showToast('Quote data ready for manual copy. Check console.', 'warning');
      return;
    }
    showToast('Quote emailed to ' + DB.quote.email + '! 📧', 'success');
  });
}

/* ── Print / Export PDF ── */
function printQuote() {
  collectQuoteInfo();
  if (!DB.selectedProducts.length) { showToast('No products in your quote.', 'warning'); return; }

  var html = '<div style="font-family:sans-serif;max-width:700px;margin:auto;padding:20px">' +
    '<h1 style="color:#8b5a2b;border-bottom:3px solid #b8753e;padding-bottom:10px">🪟 AI Blinds Concierge — Quote</h1>' +
    '<p><strong>Prepared for:</strong> ' + esc(DB.quote.name || 'Valued Customer') + '<br>' +
    '<strong>Email:</strong> ' + esc(DB.quote.email || '—') + '<br>' +
    '<strong>Date:</strong> ' + new Date().toLocaleDateString() + '</p>' +
    '<h2>Selected Products</h2><table style="width:100%;border-collapse:collapse">' +
    '<tr style="background:#f5f0e8"><th style="padding:8px;text-align:left;border:1px solid #ddd">Product</th><th style="padding:8px;text-align:left;border:1px solid #ddd">Details</th><th style="padding:8px;text-align:center;border:1px solid #ddd">Qty</th><th style="padding:8px;text-align:right;border:1px solid #ddd">Est. Price</th></tr>';

  var subtotal = 0;
  DB.selectedProducts.forEach(function(sp) {
    var p = findProduct(sp.productId);
    if (!p) return;
    var base = p.basePrice;
    if (sp.motorized && !p.motorized) base += 180;
    var itemTotal = base * sp.quantity;
    subtotal += itemTotal;
    html += '<tr><td style="padding:8px;border:1px solid #ddd"><strong>' + esc(p.name) + '</strong><br><small>' + esc(p.type) + '</small></td>' +
      '<td style="padding:8px;border:1px solid #ddd;font-size:12px">Material: ' + esc(sp.material) + '<br>Mount: ' + esc(sp.mountType) + '<br>Color: <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:' + esc(sp.color) + ';vertical-align:middle;border:1px solid #999"></span>' + (sp.motorized ? '<br>⚡ Motorized' : '') + '</td>' +
      '<td style="padding:8px;text-align:center;border:1px solid #ddd">' + sp.quantity + '</td>' +
      '<td style="padding:8px;text-align:right;border:1px solid #ddd">' + fmtMoney(itemTotal) + '</td></tr>';
  });
  html += '<tr style="font-weight:bold;font-size:16px"><td colspan="3" style="padding:8px;text-align:right;border:1px solid #ddd">Estimated Total:</td><td style="padding:8px;text-align:right;border:1px solid #ddd;color:#8b5a2b">' + fmtMoney(subtotal) + '</td></tr></table>';
  html += '<p style="color:#888;font-size:11px;margin-top:20px">* This is a preliminary estimate. Final pricing confirmed after professional in-home measurement and consultation. Prices subject to change.</p>';
  html += '<p style="margin-top:30px;color:#888">AI Blinds Concierge — Smart Window Fashion Consultation</p></div>';

  tool.requestExportPdf({ html: html, filename: 'blinds-quote-' + new Date().toISOString().slice(0, 10) }, function(err, file) {
    if (err) { showToast('Export failed: ' + err, 'error'); return; }
    showToast('PDF exported! Opening...', 'success');
    tool.openUrl(file.url);
  });
}

/* ── Modal ── */
function showModal(html) {
  el('modal-content').innerHTML = html;
  el('modal-overlay').style.display = 'flex';
}

/* ── AI Native Form Fill ── */
function aiFillForm() {
  var input = el('ai-desc-input');
  var desc = (input.value || '').trim();
  if (!desc) { showToast('Please describe your window first.', 'warning'); return; }

  var prompt = 'You are a window treatment configurator. Extract the following fields from this user description. Return ONLY valid JSON (no markdown, no explanation). Use these exact values:\n' +
    '- width: number in inches (if mentioned like 48x60, width is first number)\n' +
    '- height: number in inches\n' +
    '- direction: "north", "south", "east", "west", or "" if not mentioned\n' +
    '- mountType: "inside" or "outside" or "" if not mentioned\n' +
    '- windowType: "standard", "bay", "sliding", "skylight", "arched", "french" or "" if not mentioned\n' +
    '- lightPriority: "blackout", "room-darkening", "light-filtering", "sheer" or "" if not mentioned\n' +
    '- privacyLevel: "maximum", "moderate", "minimal" or "" if not mentioned\n' +
    '- style: "modern", "traditional", "transitional", "eclectic" or "" if not mentioned\n' +
    '- budget: "economy", "mid-range", "premium", "luxury" or "" if not mentioned\n' +
    '- name: a short window name like "Front Bay Window" or "" if not mentioned\n' +
    'USER DESCRIPTION: ' + desc;

  el('btn-ai-fill').textContent = '⏳ ...';
  el('btn-ai-fill').disabled = true;

  tool.requestAI(prompt, '', function(err, response) {
    el('btn-ai-fill').textContent = '✨ AI Fill';
    el('btn-ai-fill').disabled = false;
    if (err) { showToast('AI unavailable — please fill manually.', 'warning'); return; }
    try {
      /* Try to parse JSON from response (may be wrapped in markdown) */
      var json = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      var data = JSON.parse(json);
      if (data.width) el('win-width').value = data.width;
      if (data.height) el('win-height').value = data.height;
      if (data.direction) el('win-direction').value = data.direction;
      if (data.mountType) el('win-mount').value = data.mountType;
      if (data.windowType) el('win-type').value = data.windowType;
      if (data.name) el('win-name').value = data.name;
      /* Preferences */
      if (data.lightPriority) {
        qsa('.win-preset-btn').forEach(function(b) { b.classList.remove('active'); });
        var customBtn = qs('.win-preset-btn[data-preset="custom"]');
        if (customBtn) customBtn.classList.add('active');
        el('win-prefs-custom').style.display = 'block';
        el('win-prefs-summary').textContent = 'Custom (AI-filled)';
        el('wp-light').value = data.lightPriority;
        if (data.privacyLevel) el('wp-privacy').value = data.privacyLevel;
        if (data.budget) el('wp-budget').value = data.budget;
        if (data.style) el('wp-style').value = data.style;
      }
      updateMeasureVisual();
      showToast('✅ Form filled from your description!', 'success');
    } catch (e) {
      console.warn('AI parse error:', e, 'Raw:', response);
      /* Fallback: try simple keyword matching */
      fallbackFillFromText(desc);
      updateMeasureVisual();
      showToast('⚠️ Best-guess fill applied. Please verify.', 'warning');
    }
  });
}

function fallbackFillFromText(desc) {
  var d = desc.toLowerCase();
  if (d.indexOf('bedroom') >= 0 || d.indexOf('blackout') >= 0 || d.indexOf('dark') >= 0) {
    qsa('.win-preset-btn').forEach(function(b) { b.classList.remove('active'); });
    var btn = qs('.win-preset-btn[data-preset="bedroom"]');
    if (btn) { btn.classList.add('active'); el('win-prefs-summary').textContent = 'Bedroom dark'; }
  }
  if (d.indexOf('bathroom') >= 0 || d.indexOf('kitchen') >= 0 || d.indexOf('moisture') >= 0) {
    qsa('.win-preset-btn').forEach(function(b) { b.classList.remove('active'); });
    var btn = qs('.win-preset-btn[data-preset="bathroom"]');
    if (btn) { btn.classList.add('active'); el('win-prefs-summary').textContent = 'Moisture-ready'; }
  }
  var sizeMatch = d.match(/(\d+)\s*[x×]\s*(\d+)/);
  if (sizeMatch) { el('win-width').value = sizeMatch[1]; el('win-height').value = sizeMatch[2]; }
  if (d.indexOf('south') >= 0) el('win-direction').value = 'south';
  else if (d.indexOf('north') >= 0) el('win-direction').value = 'north';
  else if (d.indexOf('east') >= 0) el('win-direction').value = 'east';
  else if (d.indexOf('west') >= 0) el('win-direction').value = 'west';
  if (d.indexOf('outside') >= 0) el('win-mount').value = 'outside';
  if (d.indexOf('bay') >= 0) el('win-type').value = 'bay';
  else if (d.indexOf('sliding') >= 0) el('win-type').value = 'sliding';
  else if (d.indexOf('skylight') >= 0) el('win-type').value = 'skylight';
  else if (d.indexOf('arched') >= 0) el('win-type').value = 'arched';
  else if (d.indexOf('french') >= 0) el('win-type').value = 'french';
}

function closeModal() {
  el('modal-overlay').style.display = 'none';
  el('modal-content').innerHTML = '';
  editingWindowId = null;
}

/* ── Toast ── */
function showToast(msg, severity) {
  severity = severity || 'info';
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + severity;
  toast.textContent = msg;
  el('toast-container').appendChild(toast);
  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .3s';
    setTimeout(function() { toast.remove(); }, 300);
  }, 3000);
}

/* ── Lock UI ── */
function lockUI(ro) {
  isReadOnly = ro;
  qsa('button, input, select, textarea').forEach(function(el) {
    if (ro) { el.setAttribute('disabled', 'disabled'); el.style.opacity = '0.6'; }
    else { el.removeAttribute('disabled'); el.style.opacity = '1'; }
  });
}

/* ── Event Binding ── */
function bindAllEvents() {
  /* Navigation */
  qsa('.nav-item').forEach(function(item) {
    item.addEventListener('click', function() {
      var page = this.dataset.page;
      if (page) navigateTo(page);
    });
  });

  /* Welcome */
  bindWelcome();

  /* Room */
  el('btn-add-window').addEventListener('click', function() { openWindowModal(null); });
  el('btn-room-back').addEventListener('click', function() { navigateTo('welcome'); });
  el('btn-room-next').addEventListener('click', function() {
    DB.room.type = el('room-type').value;
    DB.room.size = el('room-size').value;
    if (!DB.room.type) { showToast('Please select a room type.', 'warning'); return; }
    if (!DB.windows.length) { showToast('Please add at least one window.', 'warning'); return; }
    applyRoomDefaults();
    navigateTo('needs');
  });
  el('room-type').addEventListener('change', function() {
    DB.room.type = this.value;
    persist();
  });
  el('room-size').addEventListener('change', function() {
    DB.room.size = this.value;
    persist();
  });

  /* Needs */
  el('btn-needs-back').addEventListener('click', function() { navigateTo('room'); });
  el('btn-needs-next').addEventListener('click', function() {
    collectNeedsFromUI();
    navigateTo('recommend');
    generateAIRecommendationsWithStream();
  });
  qsa('input[name="light-priority"], input[name="privacy-level"], input[name="style-preference"], input[name="budget-range"]').forEach(function(r) {
    r.addEventListener('change', function() { collectNeedsFromUI(); persist(); });
  });
  qsa('#need-energy, #need-moisture, #need-motorized, #need-child-safe, #need-uv, #need-noise, #need-easy-clean').forEach(function(cb) {
    cb.addEventListener('change', function() { collectNeedsFromUI(); persist(); });
  });

  /* Recommend */
  el('btn-recommend-back').addEventListener('click', function() { navigateTo('needs'); });
  el('btn-recommend-next').addEventListener('click', function() { navigateTo('customize'); });

  /* AI Chat */
  el('btn-ai-send').addEventListener('click', sendChatMessage);
  el('ai-chat-input').addEventListener('keydown', function(e) { if (e.key === 'Enter') sendChatMessage(); });
  el('btn-clear-chat').addEventListener('click', function() { DB.chatMessages = []; renderChatMessages(); persist(); });

  /* Customize */
  el('btn-customize-back').addEventListener('click', function() { navigateTo('recommend'); });
  el('btn-customize-next').addEventListener('click', function() { navigateTo('quote'); });

  /* Quote */
  el('btn-quote-back').addEventListener('click', function() { navigateTo('customize'); });
  el('btn-quote-save').addEventListener('click', saveConsultation);
  el('btn-quote-email').addEventListener('click', emailQuote);
  el('btn-quote-print').addEventListener('click', printQuote);
  el('quote-name').addEventListener('change', function() { DB.quote.name = this.value; persist(); });
  el('quote-email').addEventListener('change', function() { DB.quote.email = this.value; persist(); });
  el('quote-phone').addEventListener('change', function() { DB.quote.phone = this.value; persist(); });

  /* Catalog */
  el('catalog-search').addEventListener('input', renderCatalogPage);
  el('catalog-filter').addEventListener('change', renderCatalogPage);

  /* Modal overlay click to close */
  el('modal-overlay').addEventListener('click', function(e) { if (e.target === this) closeModal(); });

  /* Keyboard: Escape to close modal */
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeModal(); });
}

/* ── INIT ── */
tool.onReady(function(val, fields) {
  loadFromValue(val);
  navigateTo(DB.currentStep || 'welcome');
  bindAllEvents();
  if (tool.isReadOnly()) lockUI(true);

  tool.onValueChange(function(v) { loadFromValue(v); navigateTo(DB.currentStep || 'welcome'); });
  tool.onFieldsChange(function(f) { /* react to sibling fields if needed */ });
  tool.onReadonlyChange(function(ro) { lockUI(ro); });
});
