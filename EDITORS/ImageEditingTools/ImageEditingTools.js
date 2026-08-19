// ════════════════════════════════════════════════════════════════
// Image Editing Tools — UniconHub html-tool
// A lightweight, event-based image editing toolbox for the CMS:
//   • Convert   — PNG / JPEG / WebP file type converter
//   • Resize    — pixel dimensions with aspect lock
//   • Crop      — drag selection or numeric crop
//   • Rotate    — quarter turns, flips, fine rotation
//   • Filters   — live brightness/contrast/saturation/hue/blur presets
//   • Compress  — quality slider + auto-tune to a target size
//   • Watermark — text stamp (position, tilt, tile, shadow)
//   • Collage   — combine several images in predefined frames
//   • OCR       — text extraction (built-in engine or AI gateway)
// All edits are local (canvas in memory) and chain together; results
// are downloaded as files. Only lightweight UI settings are persisted
// via tool.setValue(). No CMS object CRUD required.
// ════════════════════════════════════════════════════════════════
'use strict';

// ── Constants ─────────────────────────────────────────────────
var MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
var MAX_PIXELS = 40 * 1000 * 1000; // 40 MP safety cap
var MAX_HISTORY = 25;
var MAX_FILE_BYTES = 40 * 1024 * 1024; // 40 MB
var ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

var OCR_PROMPT = [
  'You are an OCR (optical character recognition) assistant. The image to read is attached as a base64 data URL.',
  'Transcribe ALL readable text from the image.',
  'Rules:',
  '- Return ONLY the transcribed text, preserving line breaks and reading order.',
  '- Keep numbers, prices, dates, names and punctuation exactly as written.',
  '- If the image contains no readable text, reply with exactly: NO_TEXT_FOUND',
  '- Do not describe the image. Do not add commentary.'
].join('\n');

var LAYOUTS = {
  side: {
    label: 'Side by side',
    slots: [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }]
  },
  stack: {
    label: 'Stacked',
    slots: [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }]
  },
  grid4: {
    label: '2×2 grid',
    slots: [
      { x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }
    ]
  },
  strip3: {
    label: '3 strips',
    slots: [
      { x: 0, y: 0, w: 1 / 3, h: 1 }, { x: 1 / 3, y: 0, w: 1 / 3, h: 1 }, { x: 2 / 3, y: 0, w: 1 / 3, h: 1 }
    ]
  },
  col3: {
    label: '3 rows',
    slots: [
      { x: 0, y: 0, w: 1, h: 1 / 3 }, { x: 0, y: 1 / 3, w: 1, h: 1 / 3 }, { x: 0, y: 2 / 3, w: 1, h: 1 / 3 }
    ]
  },
  hero: {
    label: 'Hero + 2',
    slots: [
      { x: 0, y: 0, w: 0.55, h: 1 },
      { x: 0.55, y: 0, w: 0.45, h: 0.5 },
      { x: 0.55, y: 0.5, w: 0.45, h: 0.5 }
    ]
  }
};

var FONT_STACKS = {
  sans: 'Arial, Helvetica, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"Courier New", Courier, monospace',
  script: '"Segoe Script", "Brush Script MT", cursive',
  impact: 'Impact, "Arial Narrow", sans-serif'
};

var FILTER_SLIDERS = [
  { id: 'flt-brightness', val: 'flt-brightness-val', unit: '%' },
  { id: 'flt-contrast', val: 'flt-contrast-val', unit: '%' },
  { id: 'flt-saturate', val: 'flt-saturate-val', unit: '%' },
  { id: 'flt-hue', val: 'flt-hue-val', unit: '°' },
  { id: 'flt-blur', val: 'flt-blur-val', unit: 'px' },
  { id: 'flt-grayscale', val: 'flt-grayscale-val', unit: '%' },
  { id: 'flt-sepia', val: 'flt-sepia-val', unit: '%' },
  { id: 'flt-invert', val: 'flt-invert-val', unit: '%' }
];

var FILTER_PRESETS = {
  none: {},
  bw: { 'flt-grayscale': 100 },
  sepia: { 'flt-sepia': 100 },
  vintage: { 'flt-sepia': 60, 'flt-contrast': 110, 'flt-brightness': 105, 'flt-hue': -15 },
  cool: { 'flt-hue': -150, 'flt-saturate': 90, 'flt-brightness': 105 },
  warm: { 'flt-hue': -25, 'flt-saturate': 125, 'flt-contrast': 105 },
  vivid: { 'flt-saturate': 170, 'flt-contrast': 115 },
  fade: { 'flt-brightness': 115, 'flt-contrast': 80, 'flt-saturate': 60 }
};

var DEFAULTS = {
  fmt: 'image/jpeg', quality: 85,
  cmpFmt: 'image/jpeg', cmpQuality: 85,
  ocrLang: 'eng',
  colLayout: 'side', colAspect: '1:1', colWidth: 1600,
  colGap: 8, colPad: 24, colBg: '#ffffff',
  wmText: '', wmSize: 48, wmFont: 'sans', wmColor: '#ffffff',
  wmOpacity: 60, wmPos: 'mc', wmRot: 0, wmTile: false, wmShadow: true,
  rszLock: true, cropAr: 'free', fltPreset: 'none'
};

// ── State ─────────────────────────────────────────────────────
var _working = null;      // canvas — the image currently being edited
var _orig = null;         // canvas — pristine original
var _history = [];        // canvas undo stack
var _origMeta = { name: 'image', size: 0, type: '' };
var _filterLive = null;   // ctx.filter string while previewing filters
var _filterTimer = null;
var _cropRect = null;     // {x,y,w,h} in image coords
var _cropAr = 'free';
var _cropPtr = null;      // {start:{x,y}} while dragging a crop
var _previewFit = null;   // {dx,dy,dw,dh} of last drawn image
var _slots = [];          // collage slots: null or {canvas,name,fit}
var _pendingSlot = -1;    // slot index waiting for a file picker
var _ocrCanvas = null;
var _ocrBusy = false;
var _wmPos = 'mc';
var _rszLock = true;
var _fltPreset = 'none';
var _activeTab = 'convert';
var _settings = null;
var _saving = false;
var _saveTimer = null;
var _cnvEstTimer = null;
var _cmpEstTimer = null;
var _readOnly = false;
var _resizeObs = null;
var _zoomMode = 'fit';      // 'fit' = fit to window, 'zoom' = explicit scale
var _zoomScale = 1;         // 1 = full size (100%)
var _panX = 0, _panY = 0;   // pan offsets in CSS px
var _viewW = 0, _viewH = 0; // last preview viewport size
var _panPtr = null;         // {x, y, px, py} while panning

// ── Small helpers ─────────────────────────────────────────────
function el(id) { return document.getElementById(id); }
function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function parseNum(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }
function v(id) { var e = el(id); return e ? e.value : ''; }
function setV(id, val) { var e = el(id); if (e) e.value = val; }
function checked(id) { var e = el(id); return !!e && !!e.checked; }
function fmtSize(bytes) {
  var b = +bytes || 0;
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (Math.round(b / 102.4) / 10) + ' KB';
  return (Math.round(b / 104857.6) / 10) + ' MB';
}
function extOf(mime) { return MIME_EXT[mime] || 'img'; }
function baseName() {
  var n = _origMeta && _origMeta.name ? _origMeta.name : 'image';
  n = String(n).replace(/\.[^.]+$/, '');
  return n || 'image';
}
function notify(msg, sev) {
  if (typeof tool.notify === 'function') {
    try { tool.notify(msg, sev || 'info'); return; } catch (e) {}
  }
  if (typeof console !== 'undefined') console.log('[' + (sev || 'info') + '] ' + msg);
}
function scheduleResize() {
  if (typeof tool.resize === 'function') {
    try { tool.resize(); } catch (e) {}
  }
}
function setBusy(msg) {
  el('iet-busy-text').textContent = msg || 'Working…';
  el('iet-busy').style.display = 'flex';
}
function clearBusy() { el('iet-busy').style.display = 'none'; }
function needImage() {
  notify('Open an image first — use 📂 Open or drop a file on the preview', 'warning');
}

// ── Canvas helpers ────────────────────────────────────────────
function makeCanvas(w, h) {
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}
function cloneCanvas(src) {
  var c = makeCanvas(src.width, src.height);
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}
function fitRect(iw, ih, maxw, maxh) {
  maxw = Math.max(8, maxw);
  maxh = Math.max(8, maxh);
  var s = Math.min(maxw / iw, maxh / ih);
  var w = iw * s, h = ih * s;
  return { dx: (maxw - w) / 2, dy: (maxh - h) / 2, dw: w, dh: h };
}
function fileToCanvas(file, cb) {
  var reader = new FileReader();
  reader.onload = function () { dataUrlToCanvas(reader.result, cb); };
  reader.onerror = function () { cb('Could not read the file'); };
  reader.readAsDataURL(file);
}
function dataUrlToCanvas(url, cb) {
  var img = new Image();
  img.onload = function () {
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    if (!w || !h) { cb('Unsupported or empty image'); return; }
    if (w * h > MAX_PIXELS) { cb('Image too large: ' + w + '×' + h + ' (limit is 40 MP)'); return; }
    var c = makeCanvas(w, h);
    try { c.getContext('2d').drawImage(img, 0, 0); } catch (e) { cb('Could not decode the image'); return; }
    cb(null, c);
  };
  img.onerror = function () { cb('Unsupported image format — try PNG, JPG, WEBP, GIF or BMP'); };
  img.src = url;
}
function loadImageFromUrl(url, name, cb) {
  var img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function () {
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    if (!w || !h) { cb('Could not decode the image'); return; }
    if (w * h > MAX_PIXELS) { cb('Image too large: ' + w + '×' + h); return; }
    var c = makeCanvas(w, h);
    try {
      c.getContext('2d').drawImage(img, 0, 0);
      c.getContext('2d').getImageData(0, 0, 1, 1); // taint probe
    } catch (e) {
      cb('CMS storage blocks pixel access for this file (CORS). Download it and drop the file here instead.');
      return;
    }
    cb(null, c);
  };
  img.onerror = function () { cb('Could not load the image from storage'); };
  img.src = url;
}
function hasAlpha(canvas) {
  try {
    var x = canvas.getContext('2d');
    var d = x.getImageData(0, 0, canvas.width, canvas.height);
    var step = 4 * 257; // sample roughly every 257th pixel
    for (var i = 3; i < d.data.length; i += step) {
      if (d.data[i] < 255) return true;
    }
  } catch (e) {}
  return false;
}
function flatten(canvas, color) {
  var c = cloneCanvas(canvas);
  var x = c.getContext('2d');
  x.globalCompositeOperation = 'destination-over';
  x.fillStyle = color || '#ffffff';
  x.fillRect(0, 0, c.width, c.height);
  return c;
}
function drawFit(x, src, rx, ry, rw, rh, mode) {
  var s = mode === 'contain'
    ? Math.min(rw / src.width, rh / src.height)
    : Math.max(rw / src.width, rh / src.height);
  var w = src.width * s, h = src.height * s;
  x.drawImage(src, rx + (rw - w) / 2, ry + (rh - h) / 2, w, h);
}

// ── Core pipeline ─────────────────────────────────────────────
function pushHistory() {
  if (!_working) return;
  _history.push(cloneCanvas(_working));
  if (_history.length > MAX_HISTORY) _history.shift();
}
function afterImageChange() {
  _filterLive = null;
  _cropRect = null;
  refreshResizeInputs();
  initCropInputs();
  updateHeader();
  updateAllEsts();
  renderPreview();
  scheduleResize();
}
function commit(c) {
  if (!c) return;
  pushHistory();
  _working = c;
  afterImageChange();
}
function setWorking(c, meta) {
  _orig = cloneCanvas(c);
  _working = c;
  _history = [];
  _origMeta = meta || { name: 'image', size: 0, type: '' };
  resetZoomState();
  afterImageChange();
}
function undoWorking() {
  if (!_history.length) { notify('Nothing to undo', 'info'); return; }
  _working = _history.pop();
  afterImageChange();
}
function resetWorking() {
  if (!_orig) { needImage(); return; }
  pushHistory();
  _working = cloneCanvas(_orig);
  resetZoomState();
  afterImageChange();
  notify('Back to the original image', 'success');
}

// ── Stage / preview ───────────────────────────────────────────
function showStage(has) {
  el('iet-drop').style.display = has ? 'none' : 'flex';
  el('iet-canvas-wrap').style.display = has ? 'flex' : 'none';
  el('iet-stage-meta').style.display = has ? 'flex' : 'none';
}
function drawChecker(x, dx, dy, dw, dh) {
  var s = 8;
  x.save();
  x.beginPath();
  x.rect(dx, dy, dw, dh);
  x.clip();
  x.fillStyle = '#1c202b';
  x.fillRect(dx, dy, dw, dh);
  x.fillStyle = '#242a38';
  for (var gy = 0; gy * s < dh; gy++) {
    for (var gx = 0; gx * s < dw; gx++) {
      if ((gx + gy) % 2 === 0) x.fillRect(dx + gx * s, dy + gy * s, s, s);
    }
  }
  x.restore();
}
function drawCropOverlay(x, src, fit) {
  var r = _cropRect;
  if (!r) return;
  var px = fit.dx + r.x / src.width * fit.dw;
  var py = fit.dy + r.y / src.height * fit.dh;
  var pw = r.w / src.width * fit.dw;
  var ph = r.h / src.height * fit.dh;
  x.save();
  x.beginPath();
  x.rect(fit.dx, fit.dy, fit.dw, fit.dh);
  x.rect(px, py, pw, ph);
  x.fillStyle = 'rgba(5,6,10,0.55)';
  x.fill('evenodd');
  x.strokeStyle = '#6d7cff';
  x.lineWidth = 2;
  x.setLineDash([7, 5]);
  x.strokeRect(px, py, pw, ph);
  x.restore();
}
function previewSrc() {
  return (_activeTab === 'ocr') ? (_ocrCanvas || _working) : _working;
}
function previewHasImage() { return !!previewSrc(); }
function resetZoomState() {
  _zoomMode = 'fit';
  _zoomScale = 1;
  _panX = 0;
  _panY = 0;
  _panPtr = null;
}
function resetZoom() {
  resetZoomState();
  renderPreview();
}
function clampPan(cw, ch) {
  var f = _previewFit;
  if (!f) return;
  var m = 48; // keep at least 48 px of image visible on each axis
  if (f.dw <= cw) _panX = 0; else _panX = clamp(_panX, cw - f.dw - m, m);
  if (f.dh <= ch) _panY = 0; else _panY = clamp(_panY, ch - f.dh - m, m);
}
function renderPreview() {
  var src = previewSrc();
  if (!src) { showStage(false); return; }
  showStage(true);
  var wrap = el('iet-canvas-wrap');
  var cv = el('iet-preview');
  var rect = wrap.getBoundingClientRect();
  var cw = Math.max(40, Math.floor(rect.width));
  var ch = Math.max(40, Math.floor(rect.height));
  _viewW = cw;
  _viewH = ch;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var pw = Math.floor(cw * dpr), ph = Math.floor(ch * dpr);
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  cv.style.width = cw + 'px';
  cv.style.height = ch + 'px';
  var x = cv.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, cw, ch);
  x.fillStyle = '#14161c';
  x.fillRect(0, 0, cw, ch);
  var fit;
  if (_zoomMode === 'zoom') {
    var dw = Math.max(1, src.width * _zoomScale);
    var dh = Math.max(1, src.height * _zoomScale);
    fit = { dx: (cw - dw) / 2 + _panX, dy: (ch - dh) / 2 + _panY, dw: dw, dh: dh };
    _previewFit = fit;
    clampPan(cw, ch);
    fit.dx = (cw - fit.dw) / 2 + _panX;
    fit.dy = (ch - fit.dh) / 2 + _panY;
  } else {
    _panX = 0;
    _panY = 0;
    fit = fitRect(src.width, src.height, cw - 32, ch - 32);
  }
  _previewFit = fit;
  drawChecker(x, fit.dx, fit.dy, fit.dw, fit.dh);
  if (_filterLive) { try { x.filter = _filterLive; } catch (e) {} }
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  x.drawImage(src, fit.dx, fit.dy, fit.dw, fit.dh);
  x.filter = 'none';
  if (_activeTab === 'crop' && _cropRect) drawCropOverlay(x, src, fit);
  updateZoomUI();
}
// ── Zoom / pan viewer controls ────────────────────────────────
function currentScale() {
  var src = previewSrc();
  var f = _previewFit;
  if (!src || !f || !f.dw) return 1;
  return (_zoomMode === 'fit') ? f.dw / src.width : _zoomScale;
}
function nextScale(s, dir) {
  var i;
  if (dir > 0) {
    for (i = 0; i < ZOOM_STEPS.length; i++) {
      if (ZOOM_STEPS[i] > s * 1.001) return ZOOM_STEPS[i];
    }
    return Math.min(8, s * 1.5);
  }
  for (i = ZOOM_STEPS.length - 1; i >= 0; i--) {
    if (ZOOM_STEPS[i] < s * 0.999) return ZOOM_STEPS[i];
  }
  return Math.max(0.05, s / 1.5);
}
function zoomAt(dir, cx, cy) {
  var src = previewSrc();
  var f = _previewFit;
  if (!src || !f || !f.dw) return;
  var oldScale = currentScale();
  // image-space point under the cursor
  var ix = (cx - f.dx) / f.dw;
  var iy = (cy - f.dy) / f.dh;
  _zoomScale = clamp(nextScale(oldScale, dir), 0.05, 8);
  _zoomMode = 'zoom';
  var dw = src.width * _zoomScale;
  var dh = src.height * _zoomScale;
  _panX = cx - ix * dw - (_viewW - dw) / 2;
  _panY = cy - iy * dh - (_viewH - dh) / 2;
  renderPreview();
}
function setZoomScale(scale) {
  if (!previewHasImage()) return;
  _zoomMode = 'zoom';
  _zoomScale = clamp(scale, 0.05, 8);
  _panX = 0;
  _panY = 0;
  renderPreview();
}
function updateZoomUI() {
  var pct = el('iet-zoom-pct');
  var sel = el('iet-zoom-preset');
  if (!pct || !sel) return;
  var src = previewSrc();
  var f = _previewFit;
  if (!src || !f) return;
  if (_zoomMode === 'fit') {
    sel.value = 'fit';
    pct.textContent = 'Fit';
    return;
  }
  var s = currentScale();
  pct.textContent = Math.round(s * 100) + '%';
  var exact = String(Math.round(s * 100) / 100);
  if (exact === '0.25' || exact === '0.5' || exact === '1' || exact === '2' || exact === '4') {
    sel.value = exact;
  } else {
    sel.value = 'custom';
  }
}
function panDown(e) {
  if (!previewHasImage()) return;
  e.preventDefault();
  _panPtr = { x: e.clientX, y: e.clientY, px: _panX, py: _panY };
  try { el('iet-preview').setPointerCapture(e.pointerId); } catch (ignore) {}
}
function panMove(e) {
  if (!_panPtr) return;
  _panX = _panPtr.px + (e.clientX - _panPtr.x);
  _panY = _panPtr.py + (e.clientY - _panPtr.y);
  renderPreview();
}
function panUp() { _panPtr = null; }
function wheelZoom(e) {
  if (!previewHasImage()) return;
  e.preventDefault();
  var b = el('iet-preview').getBoundingClientRect();
  zoomAt(e.deltaY < 0 ? 1 : -1, e.clientX - b.left, e.clientY - b.top);
}

// ── Header / info ─────────────────────────────────────────────
function updateHeader() {
  var has = !!_working;
  el('iet-filechip').style.display = has ? 'flex' : 'none';
  el('iet-btn-undo').disabled = !has || !_history.length;
  el('iet-btn-reset').disabled = !has;
  el('iet-btn-download').disabled = !has;
  el('iet-meta-dims').textContent = has ? (_working.width + ' × ' + _working.height) : '—';
  el('iet-meta-steps').textContent = has ? ('Step ' + (_history.length + 1) + ' · original ' + fmtSize(_origMeta.size)) : '—';
  if (has) {
    el('iet-file-name').textContent = _origMeta.name || 'image';
    el('iet-file-dims').textContent = _working.width + '×' + _working.height + ' · ' + fmtSize(_origMeta.size);
  }
}
function updateLock() {
  el('iet-lock').style.display = _readOnly ? 'inline-block' : 'none';
}

// ── File loading & routing ────────────────────────────────────
function routeCanvas(c, name, size) {
  if (_activeTab === 'collage') {
    var i = _pendingSlot >= 0 ? _pendingSlot : firstEmptySlot();
    _pendingSlot = -1;
    if (i < 0) { notify('All slots are full — replace an image or clear one first', 'warning'); return; }
    addImageToSlot(i, c, name);
  } else if (_activeTab === 'ocr') {
    loadOcrImage(c, name);
    notify('Image loaded for OCR — pick an engine', 'success');
  } else {
    setWorking(c, { name: name, size: size || 0, type: '' });
    notify('Image loaded: ' + name, 'success');
  }
}
function handleFile(file, slotIdx) {
  if (!file) return;
  var looksImage = (file.type && file.type.indexOf('image/') === 0) ||
    /\.(png|jpe?g|gif|webp|bmp|svg|avif|ico|tiff?)$/i.test(file.name || '');
  if (!looksImage) { notify('Please choose an image file', 'warning'); return; }
  if (file.size > MAX_FILE_BYTES) { notify('File too large (limit 40 MB)', 'warning'); return; }
  _pendingSlot = slotIdx;
  setBusy('Loading ' + file.name + '…');
  fileToCanvas(file, function (err, c) {
    clearBusy();
    if (err) { notify(err, 'error'); _pendingSlot = -1; return; }
    routeCanvas(c, file.name, file.size);
  });
}
function openFilePicker() {
  var inp = el('iet-file');
  inp.value = '';
  inp.click();
}
function firstEmptySlot() {
  for (var i = 0; i < _slots.length; i++) if (!_slots[i]) return i;
  return -1;
}
function uploadFromCms() {
  if (typeof tool.requestUpload !== 'function') {
    notify('CMS upload is not enabled for this tool (admin must set allowUpload)', 'error');
    return;
  }
  setBusy('Opening the CMS file picker…');
  tool.requestUpload('image/*', function (err, file) {
    clearBusy();
    if (err || !file) {
      if (err) notify('Upload failed: ' + err, 'error');
      return;
    }
    loadImageFromUrl(file.url, file.name, function (e2, c) {
      if (e2) { notify(e2, 'error'); return; }
      routeCanvas(c, file.name, file.size || 0);
    });
  });
}

// ── Tabs ──────────────────────────────────────────────────────
function switchTab(t) {
  if (!el('pane-' + t)) t = 'convert';
  _activeTab = t;
  var tabs = document.querySelectorAll('.iet-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === t);
  }
  var panes = document.querySelectorAll('.iet-pane');
  for (var j = 0; j < panes.length; j++) {
    panes[j].classList.toggle('active', panes[j].id === 'pane-' + t);
  }
  if (t === 'crop') { initCropInputs(); }
  if (t === 'collage') { renderSlotGrid(); }
  if (t === 'resize') { refreshResizeInputs(); }
  if (t === 'filters') { updateFilterLive(); } else { _filterLive = null; }
  updateDropTitle();
  updateAllEsts();
  renderPreview();
  scheduleResize();
  persistSettingsSoon();
  try {
    el('iet-preview').style.cursor = (t === 'crop') ? 'crosshair' : 'grab';
  } catch (e) {}
}
function updateDropTitle() {
  var title = el('iet-drop-title');
  if (_activeTab === 'collage') title.textContent = 'Drop images into the slots';
  else if (_activeTab === 'ocr') title.textContent = 'Drop a document image for OCR';
  else title.textContent = 'Drop an image here';
}

// ── Estimates ─────────────────────────────────────────────────
function updateAllEsts() {
  updateConvertEst();
  updateCmpEst();
}

// ── Convert ───────────────────────────────────────────────────
function onCnvFormatChanged() {
  var mime = v('cnv-format');
  el('cnv-quality-row').style.display = (mime === 'image/png') ? 'none' : 'block';
  el('cnv-bg-row').style.display = (mime === 'image/jpeg') ? 'block' : 'none';
  updateConvertEst();
}
function updateConvertEst() {
  if (!_working) { el('cnv-est').style.display = 'none'; return; }
  var mime = v('cnv-format');
  var q = +v('cnv-quality');
  estimateSize(_working, mime, q, function (size) {
    var box = el('cnv-est');
    if (!size) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    var pct = _origMeta.size > 0 ? Math.round((1 - size / _origMeta.size) * 100) : 0;
    box.innerHTML = 'Output: ≈ <b>' + fmtSize(size) + '</b>' +
      (_origMeta.size > 0 ? ' · ' + (pct >= 0 ? pct + '% smaller' : 'bigger') : '');
  });
}
function scheduleConvertEst() {
  clearTimeout(_cnvEstTimer);
  _cnvEstTimer = setTimeout(updateConvertEst, 220);
}
function convertDownload() {
  if (!_working) { needImage(); return; }
  var mime = v('cnv-format');
  var q = +v('cnv-quality');
  var src = (mime === 'image/jpeg') ? flatten(_working, v('cnv-bg')) : _working;
  saveCanvas(src, baseName() + '-converted', mime, q);
}
function convertUseInEditor() {
  if (!_working) { needImage(); return; }
  var mime = v('cnv-format');
  var q = +v('cnv-quality');
  var src = (mime === 'image/jpeg') ? flatten(_working, v('cnv-bg')) : _working;
  try {
    var url = src.toDataURL(mime, mime === 'image/png' ? undefined : q / 100);
    dataUrlToCanvas(url, function (err, c) {
      if (err) { notify(err, 'error'); return; }
      commit(c);
      notify('Converted result is now the working image', 'success');
    });
  } catch (e) {
    notify('This format is not supported by the browser', 'error');
  }
}

// ── Resize ────────────────────────────────────────────────────
function refreshResizeInputs() {
  if (!_working) return;
  setV('rsz-w', _working.width);
  setV('rsz-h', _working.height);
  setV('rsz-pct', 100);
}
function onRszWidthChanged() {
  if (!_working || !_rszLock) return;
  var w = parseNum(v('rsz-w'));
  if (w > 0) setV('rsz-h', Math.max(1, Math.round(w * _working.height / _working.width)));
}
function onRszPctChanged() {
  if (!_working) return;
  var p = parseNum(v('rsz-pct'));
  if (p <= 0) return;
  setV('rsz-w', Math.max(1, Math.round(_working.width * p / 100)));
  setV('rsz-h', Math.max(1, Math.round(_working.height * p / 100)));
}
function applyResize() {
  if (!_working) { needImage(); return; }
  var w = Math.round(parseNum(v('rsz-w')));
  var h = Math.round(parseNum(v('rsz-h')));
  if (w < 1 || h < 1) { notify('Width and height must be at least 1 px', 'warning'); return; }
  if (w * h > MAX_PIXELS) { notify('Target too large (over 40 MP)', 'warning'); return; }
  if (w === _working.width && h === _working.height) { notify('Size is unchanged', 'info'); return; }
  var c = makeCanvas(w, h);
  var x = c.getContext('2d');
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  x.drawImage(_working, 0, 0, w, h);
  commit(c);
  notify('Resized to ' + w + '×' + h, 'success');
}
function toggleRszLock() {
  _rszLock = !_rszLock;
  updateLockBtn();
  persistSettingsSoon();
}

// ── Crop ──────────────────────────────────────────────────────
function parseAr(s) {
  if (!s || s === 'free') return 0;
  var p = String(s).split(':');
  var a = parseNum(p[0]), b = parseNum(p[1]);
  return (a > 0 && b > 0) ? a / b : 0;
}
function initCropInputs() {
  if (!_working) return;
  setV('crop-x', 0);
  setV('crop-y', 0);
  setV('crop-w', _working.width);
  setV('crop-h', _working.height);
}
function syncCropInputs() {
  if (!_working) return;
  if (!_cropRect) { initCropInputs(); return; }
  setV('crop-x', Math.round(_cropRect.x));
  setV('crop-y', Math.round(_cropRect.y));
  setV('crop-w', Math.round(_cropRect.w));
  setV('crop-h', Math.round(_cropRect.h));
}
function cropRectFromInputs() {
  if (!_working) return null;
  var W = _working.width, H = _working.height;
  var x = clamp(Math.round(parseNum(v('crop-x'))), 0, W - 1);
  var y = clamp(Math.round(parseNum(v('crop-y'))), 0, H - 1);
  var w = clamp(Math.round(parseNum(v('crop-w'))), 1, W - x);
  var h = clamp(Math.round(parseNum(v('crop-h'))), 1, H - y);
  return { x: x, y: y, w: w, h: h };
}
function setCropAr(ar) {
  _cropAr = ar;
  updateCropArChips();
  if (_cropRect && _working && ar !== 'free') {
    var ratio = parseAr(ar);
    if (ratio > 0) {
      var nh = _cropRect.w / ratio;
      if (_cropRect.y + nh > _working.height) {
        nh = _working.height - _cropRect.y;
        _cropRect.w = nh * ratio;
      }
      _cropRect.h = nh;
      syncCropInputs();
      renderPreview();
    }
  }
  persistSettingsSoon();
}
function updateCropArChips() {
  var chips = document.querySelectorAll('#crop-aspects .iet-chip-btn');
  for (var i = 0; i < chips.length; i++) {
    chips[i].classList.toggle('active', chips[i].getAttribute('data-ar') === _cropAr);
  }
}
function clearCropSelection() {
  _cropRect = null;
  initCropInputs();
  renderPreview();
}
function applyCrop() {
  if (!_working) { needImage(); return; }
  var r = _cropRect || cropRectFromInputs();
  if (!r || r.w < 1 || r.h < 1) { notify('Select an area first — drag on the preview', 'warning'); return; }
  if (r.w >= _working.width && r.h >= _working.height) { notify('The selection covers the whole image', 'info'); return; }
  var c = makeCanvas(r.w, r.h);
  c.getContext('2d').drawImage(_working, -r.x, -r.y);
  commit(c);
  notify('Cropped to ' + c.width + '×' + c.height, 'success');
}
function cvPointerPos(e) {
  var cv = el('iet-preview');
  var b = cv.getBoundingClientRect();
  var px = e.clientX - b.left;
  var py = e.clientY - b.top;
  var f = _previewFit;
  if (!f || !f.dw || !f.dh) return null;
  return { x: clamp((px - f.dx) / f.dw, 0, 1), y: clamp((py - f.dy) / f.dh, 0, 1) };
}
function cropDown(e) {
  if (_activeTab !== 'crop' || !_working) return;
  var p = cvPointerPos(e);
  if (!p) return;
  e.preventDefault();
  _cropPtr = { start: p };
  try { el('iet-preview').setPointerCapture(e.pointerId); } catch (ignore) {}
}
function cropMove(e) {
  if (!_cropPtr || !_working) return;
  var p = cvPointerPos(e);
  if (!p) return;
  var W = _working.width, H = _working.height;
  var sx = _cropPtr.start.x * W, sy = _cropPtr.start.y * H;
  var dx = p.x * W - sx, dy = p.y * H - sy;
  var ratio = parseAr(_cropAr);
  if (ratio > 0) {
    if (Math.abs(dx) / ratio > Math.abs(dy)) {
      dy = (dy < 0 ? -1 : 1) * Math.abs(dx) / ratio;
    } else {
      dx = (dx < 0 ? -1 : 1) * Math.abs(dy) * ratio;
    }
  }
  var x = Math.min(sx, sx + dx), y = Math.min(sy, sy + dy);
  var w = Math.abs(dx), h = Math.abs(dy);
  if (x < 0) { w += x; x = 0; }
  if (y < 0) { h += y; y = 0; }
  if (x + w > W) w = W - x;
  if (y + h > H) h = H - y;
  _cropRect = { x: x, y: y, w: Math.max(1, w), h: Math.max(1, h) };
  renderPreview();
}
function cropUp(e) {
  if (!_cropPtr) return;
  _cropPtr = null;
  syncCropInputs();
}

// ── Rotate & flip ─────────────────────────────────────────────
function rotate90(dir) {
  if (!_working) { needImage(); return; }
  var W = _working.width, H = _working.height;
  var c = makeCanvas(H, W);
  var x = c.getContext('2d');
  if (dir > 0) { x.translate(H, 0); x.rotate(Math.PI / 2); }
  else { x.translate(0, W); x.rotate(-Math.PI / 2); }
  x.drawImage(_working, 0, 0);
  commit(c);
  notify(dir > 0 ? 'Rotated 90° right' : 'Rotated 90° left', 'success');
}
function rotate180() {
  if (!_working) { needImage(); return; }
  var c = makeCanvas(_working.width, _working.height);
  var x = c.getContext('2d');
  x.translate(c.width, c.height);
  x.rotate(Math.PI);
  x.drawImage(_working, 0, 0);
  commit(c);
  notify('Rotated 180°', 'success');
}
function flipH() {
  if (!_working) { needImage(); return; }
  var c = makeCanvas(_working.width, _working.height);
  var x = c.getContext('2d');
  x.translate(c.width, 0);
  x.scale(-1, 1);
  x.drawImage(_working, 0, 0);
  commit(c);
  notify('Flipped horizontally', 'success');
}
function flipV() {
  if (!_working) { needImage(); return; }
  var c = makeCanvas(_working.width, _working.height);
  var x = c.getContext('2d');
  x.translate(0, c.height);
  x.scale(1, -1);
  x.drawImage(_working, 0, 0);
  commit(c);
  notify('Flipped vertically', 'success');
}
function applyFineRotate() {
  if (!_working) { needImage(); return; }
  var deg = parseNum(v('rot-angle'));
  if (!deg) { notify('Angle is 0° — nothing to do', 'info'); return; }
  var rad = deg * Math.PI / 180;
  var cs = Math.abs(Math.cos(rad)), sn = Math.abs(Math.sin(rad));
  var W = _working.width, H = _working.height;
  var nw = Math.ceil(W * cs + H * sn), nh = Math.ceil(W * sn + H * cs);
  if (nw < 1) nw = 1;
  if (nh < 1) nh = 1;
  if (nw * nh > MAX_PIXELS * 2) { notify('Rotated canvas would be too large', 'warning'); return; }
  var c = makeCanvas(nw, nh);
  var x = c.getContext('2d');
  x.fillStyle = v('rot-bg');
  x.fillRect(0, 0, nw, nh);
  x.translate(nw / 2, nh / 2);
  x.rotate(rad);
  x.drawImage(_working, -W / 2, -H / 2);
  commit(c);
  setV('rot-angle', 0);
  el('rot-angle-val').textContent = '0°';
  notify('Rotated ' + deg + '°', 'success');
}

// ── Filters ───────────────────────────────────────────────────
function buildFilterString() {
  var parts = [];
  var b = parseNum(v('flt-brightness'));
  var c = parseNum(v('flt-contrast'));
  var s = parseNum(v('flt-saturate'));
  var hue = parseNum(v('flt-hue'));
  var blur = parseNum(v('flt-blur'));
  var g = parseNum(v('flt-grayscale'));
  var sp = parseNum(v('flt-sepia'));
  var inv = parseNum(v('flt-invert'));
  if (blur > 0) parts.push('blur(' + blur + 'px)');
  if (b !== 100) parts.push('brightness(' + (b / 100) + ')');
  if (c !== 100) parts.push('contrast(' + (c / 100) + ')');
  if (s !== 100) parts.push('saturate(' + (s / 100) + ')');
  if (hue !== 0) parts.push('hue-rotate(' + hue + 'deg)');
  if (g > 0) parts.push('grayscale(' + (g / 100) + ')');
  if (sp > 0) parts.push('sepia(' + (sp / 100) + ')');
  if (inv > 0) parts.push('invert(' + (inv / 100) + ')');
  return parts.join(' ');
}
function updateFilterLive() {
  _filterLive = buildFilterString() || null;
  renderPreview();
}
function scheduleFilterLive() {
  clearTimeout(_filterTimer);
  _filterTimer = setTimeout(updateFilterLive, 90);
}
function applyFilterPreset(name) {
  _fltPreset = name;
  var vals = FILTER_PRESETS[name] || {};
  for (var i = 0; i < FILTER_SLIDERS.length; i++) {
    var sl = FILTER_SLIDERS[i];
    setV(sl.id, vals[sl.id] !== undefined ? vals[sl.id] : defaultFilterValue(sl.id));
  }
  updateFilterLabels();
  updateFilterPresetChips();
  scheduleFilterLive();
  persistSettingsSoon();
}
function defaultFilterValue(id) {
  if (id === 'flt-brightness' || id === 'flt-contrast' || id === 'flt-saturate') return 100;
  return 0;
}
function updateFilterLabels() {
  for (var i = 0; i < FILTER_SLIDERS.length; i++) {
    var sl = FILTER_SLIDERS[i];
    el(sl.val).textContent = v(sl.id) + sl.unit;
  }
}
function updateFilterPresetChips() {
  var chips = document.querySelectorAll('#flt-presets .iet-chip-btn');
  for (var i = 0; i < chips.length; i++) {
    chips[i].classList.toggle('active', chips[i].getAttribute('data-preset') === _fltPreset);
  }
}
function onFilterSliderMoved() {
  _fltPreset = 'custom';
  updateFilterLabels();
  updateFilterPresetChips();
  scheduleFilterLive();
}
function applyFilters() {
  if (!_working) { needImage(); return; }
  var f = buildFilterString();
  if (!f) { notify('All sliders are at default — nothing to apply', 'info'); return; }
  var c = cloneCanvas(_working);
  var x = c.getContext('2d');
  x.filter = f;
  x.drawImage(_working, 0, 0);
  x.filter = 'none';
  _fltPreset = 'none';
  applyFilterPreset('none');
  _filterLive = null;
  commit(c);
  notify('Filters applied', 'success');
}

// ── Compress ──────────────────────────────────────────────────
function onCmpFormatChanged() {
  el('cmp-quality-row').style.display = (v('cmp-format') === 'image/png') ? 'none' : 'block';
  updateCmpEst();
}
function updateCmpEst() {
  if (!_working) { el('cmp-est').style.display = 'none'; return; }
  var mime = v('cmp-format');
  var q = +v('cmp-quality');
  estimateSize(_working, mime, q, function (size) {
    var box = el('cmp-est');
    if (!size) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    var pct = _origMeta.size > 0 ? Math.round((1 - size / _origMeta.size) * 100) : 0;
    var note = (mime === 'image/jpeg' && hasAlpha(_working)) ? ' · transparency becomes white' : '';
    box.innerHTML = 'Compressed: ≈ <b>' + fmtSize(size) + '</b>' +
      (_origMeta.size > 0 ? ' · ' + (pct >= 0 ? pct + '% smaller' : 'bigger than original') : '') + note;
  });
}
function scheduleCmpEst() {
  clearTimeout(_cmpEstTimer);
  _cmpEstTimer = setTimeout(updateCmpEst, 220);
}
function runAutoQuality() {
  if (!_working) { needImage(); return; }
  var mime = v('cmp-format');
  if (mime === 'image/png') { notify('PNG is lossless — auto-tune works with JPEG or WebP', 'info'); return; }
  var target = parseNum(v('cmp-target')) * 1024;
  if (target < 512) { notify('Enter a target size in KB first', 'warning'); return; }
  var best = -1, bestQ = 50;
  var started = false;
  function step(lo, hi, it) {
    if (it <= 0 || !_working) {
      if (started) {
        setV('cmp-quality', bestQ);
        el('cmp-quality-val').textContent = bestQ + '%';
        updateCmpEst();
        notify('Quality tuned to ' + bestQ + '%', 'success');
      }
      return;
    }
    var mid = Math.round((lo + hi) / 2);
    estimateSize(_working, mime, mid, function (size) {
      if (!size) { return; }
      if (!started) { started = true; best = size; bestQ = mid; }
      else if (Math.abs(size - target) < Math.abs(best - target)) { best = size; bestQ = mid; }
      if (size > target) step(lo, mid, it - 1);
      else step(mid, hi, it - 1);
    });
  }
  step(1, 100, 8);
}
function compressDownload() {
  if (!_working) { needImage(); return; }
  var mime = v('cmp-format');
  var q = +v('cmp-quality');
  var src = (mime === 'image/jpeg') ? flatten(_working, '#ffffff') : _working;
  saveCanvas(src, baseName() + '-compressed', mime, q);
}

// ── Watermark ─────────────────────────────────────────────────
function updateWmPosChips() {
  var btns = document.querySelectorAll('#wm-posgrid .iet-pos-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-pos') === _wmPos);
  }
}
function applyWatermark() {
  if (!_working) { needImage(); return; }
  var text = (v('wm-text') || '').trim();
  if (!text) { notify('Enter watermark text first', 'warning'); return; }
  var size = parseNum(v('wm-size'));
  var font = FONT_STACKS[v('wm-font')] || FONT_STACKS.sans;
  var color = v('wm-color');
  var opacity = parseNum(v('wm-opacity')) / 100;
  var rot = parseNum(v('wm-rot')) * Math.PI / 180;
  var tile = checked('wm-tile');
  var shadow = checked('wm-shadow');
  var W = _working.width, H = _working.height;
  var c = cloneCanvas(_working);
  var x = c.getContext('2d');
  x.save();
  x.globalAlpha = opacity;
  x.fillStyle = color;
  x.font = size + 'px ' + font;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  if (shadow) {
    x.shadowColor = 'rgba(0,0,0,0.4)';
    x.shadowBlur = Math.max(2, size / 12);
    x.shadowOffsetX = Math.max(1, size / 24);
    x.shadowOffsetY = Math.max(1, size / 24);
  }
  if (tile) {
    var step = size * 3;
    for (var yy = step / 2; yy < H + step; yy += step) {
      for (var xx = step / 2; xx < W + step; xx += step) {
        x.save();
        x.translate(xx, yy);
        x.rotate(rot);
        x.fillText(text, 0, 0);
        x.restore();
      }
    }
  } else {
    var margin = Math.round(size * 0.7);
    var px, py;
    var pc = _wmPos.charAt(0), pr = _wmPos.charAt(1);
    px = pc === 'l' ? margin : (pc === 'r' ? W - margin : W / 2);
    py = pr === 't' ? margin + size / 2 : (pr === 'b' ? H - margin - size / 2 : H / 2);
    x.save();
    x.translate(px, py);
    x.rotate(rot);
    x.fillText(text, 0, 0);
    x.restore();
  }
  x.restore();
  commit(c);
  notify('Watermark applied — Undo removes it', 'success');
}

// ── Collage ───────────────────────────────────────────────────
function getLayout() { return LAYOUTS[v('col-layout')] || LAYOUTS.side; }
function syncSlots() {
  var lay = getLayout();
  var count = lay.slots.length;
  while (_slots.length < count) _slots.push(null);
  if (_slots.length > count) _slots = _slots.slice(0, count);
}
function slotHtml(i) {
  var slot = _slots[i];
  var body = slot
    ? '<canvas class="iet-slot-thumb" data-thumb="' + i + '"></canvas>'
    : '<div class="iet-slot-empty"><b>＋</b>Add image</div>';
  return '<div class="iet-slot" data-i="' + i + '">' +
    '<div class="iet-slot-body" data-i="' + i + '" title="' + (slot ? 'Replace image' : 'Add image') + '">' + body + '</div>' +
    '<div class="iet-slot-bar">' +
    '<select class="iet-slot-fit" title="Fit mode">' +
    '<option value="cover"' + (!slot || slot.fit !== 'contain' ? ' selected' : '') + '>Cover</option>' +
    '<option value="contain"' + (slot && slot.fit === 'contain' ? ' selected' : '') + '>Contain</option>' +
    '</select>' +
    '<button class="iet-slot-btn" type="button" data-act="replace" title="Replace">✎</button>' +
    '<button class="iet-slot-btn" type="button" data-act="clear" title="Remove">✕</button>' +
    '</div></div>';
}
function renderSlotGrid() {
  syncSlots();
  var box = el('col-slots');
  if (!box) return;
  var html = '';
  for (var i = 0; i < _slots.length; i++) html += slotHtml(i);
  box.innerHTML = html;
  renderSlotThumbs();
}
function renderSlotThumbs() {
  var thumbs = document.querySelectorAll('#col-slots .iet-slot-thumb');
  for (var t = 0; t < thumbs.length; t++) {
    var i = +thumbs[t].getAttribute('data-thumb');
    var slot = _slots[i];
    if (!slot || !slot.canvas) continue;
    var parent = thumbs[t].parentNode;
    var w = Math.max(40, parent.clientWidth || 120);
    var h = Math.max(40, parent.clientHeight || 82);
    if (thumbs[t].width !== w) thumbs[t].width = w;
    if (thumbs[t].height !== h) thumbs[t].height = h;
    var x = thumbs[t].getContext('2d');
    x.fillStyle = '#14161c';
    x.fillRect(0, 0, w, h);
    drawFit(x, slot.canvas, 0, 0, w, h, slot.fit || 'cover');
  }
}
function addImageToSlot(i, canvas, name) {
  syncSlots();
  if (i < 0 || i >= _slots.length) return;
  _slots[i] = { canvas: canvas, name: name, fit: 'cover' };
  renderSlotGrid();
}
function closestSlot(node) {
  try {
    while (node && node !== document) {
      if (node.classList && node.classList.contains('iet-slot')) return node;
      node = node.parentNode;
    }
  } catch (e) {}
  return null;
}
function buildCollage() {
  syncSlots();
  var filled = 0;
  for (var i = 0; i < _slots.length; i++) if (_slots[i]) filled++;
  if (!filled) { notify('Add at least one image to a slot first', 'warning'); return; }
  var arParts = String(v('col-aspect')).split(':');
  var ar = (parseNum(arParts[0]) > 0 && parseNum(arParts[1]) > 0) ? parseNum(arParts[0]) / parseNum(arParts[1]) : 1;
  var outW = clamp(Math.round(parseNum(v('col-width'))), 200, 8000);
  var outH = Math.max(1, Math.round(outW / ar));
  if (outW * outH > MAX_PIXELS) { notify('Canvas too large — lower the width', 'warning'); return; }
  var gap = parseNum(v('col-gap'));
  var pad = parseNum(v('col-pad'));
  var lay = getLayout();
  var c = makeCanvas(outW, outH);
  var x = c.getContext('2d');
  x.fillStyle = v('col-bg');
  x.fillRect(0, 0, outW, outH);
  var ix = pad, iy = pad;
  var iw = Math.max(1, outW - 2 * pad);
  var ih = Math.max(1, outH - 2 * pad);
  for (var s = 0; s < lay.slots.length; s++) {
    var slot = _slots[s];
    if (!slot) continue;
    var r = lay.slots[s];
    var rx = ix + r.x * iw + gap / 2;
    var ry = iy + r.y * ih + gap / 2;
    var rw = Math.max(1, r.w * iw - gap);
    var rh = Math.max(1, r.h * ih - gap);
    x.save();
    x.beginPath();
    x.rect(rx, ry, rw, rh);
    x.clip();
    drawFit(x, slot.canvas, rx, ry, rw, rh, slot.fit || 'cover');
    x.restore();
  }
  commit(c);
  notify('Collage built — download it or keep editing', 'success');
}

// ── OCR ───────────────────────────────────────────────────────
function loadOcrImage(c, name) {
  _ocrCanvas = c;
  _ocrBusy = false;
  ocrStatus('Loaded: ' + esc(name) + ' — choose an engine below', '');
  renderPreview();
}
function ocrStatus(msg, kind) {
  var box = el('ocr-status');
  box.style.display = 'block';
  box.className = 'iet-status' + (kind ? ' ' + kind : '');
  box.textContent = msg;
  scheduleResize();
}
function runOcrLocal() {
  if (_ocrBusy) return;
  var src = _ocrCanvas;
  if (!src) { notify('Load an image first — use 📂 Open or drop a file while on the OCR tab', 'warning'); return; }
  var lang = v('ocr-lang');
  _ocrBusy = true;
  ocrStatus('Loading the OCR engine…');
  loadTesseract(function (err) {
    if (err) {
      _ocrBusy = false;
      ocrStatus('Built-in engine could not load: ' + err + '. The sandbox may block its files — try AI extraction, or use this tool outside the CMS.', 'warn');
      return;
    }
    tessCreateWorker(lang, function (m) {
      if (m && m.status) {
        var pct = Math.round((m.progress || 0) * 100);
        ocrStatus('Recognizing… ' + pct + '% (' + m.status + ')');
      }
    }, function (e2, worker) {
      if (e2 || !worker) {
        _ocrBusy = false;
        ocrStatus('OCR engine failed: ' + (e2 || 'unknown error') + '. Try AI extraction.', 'error');
        return;
      }
      ocrStatus('Reading the image…');
      worker.recognize(src).then(function (res) {
        _ocrBusy = false;
        var text = (res && res.data && res.data.text) ? res.data.text : '';
        el('ocr-result').value = text;
        if (text.trim()) {
          ocrStatus('Done — ' + text.split(/\n/).length + ' lines extracted.', 'ok');
        } else {
          ocrStatus('No text found in the image.', 'warn');
        }
        try { worker.terminate(); } catch (ignore) {}
      }, function (re) {
        _ocrBusy = false;
        ocrStatus('OCR failed: ' + (re && re.message ? re.message : re), 'error');
        try { worker.terminate(); } catch (ignore2) {}
      });
    });
  });
}
function loadTesseract(cb) {
  if (window.Tesseract) { cb(null); return; }
  var url = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  if (typeof tool.param === 'function') {
    var p = String(tool.param('ocrEngineUrl', '') || '').trim();
    if (p) url = p;
  }
  var s = document.createElement('script');
  s.src = url;
  s.onload = function () {
    if (window.Tesseract) cb(null);
    else cb('engine script loaded but no Tesseract global');
  };
  s.onerror = function () { cb('could not download ' + url); };
  document.head.appendChild(s);
}
function tessCreateWorker(lang, logger, cb) {
  var T = window.Tesseract;
  var p = null;
  try {
    p = T.createWorker(lang, 1, { logger: logger });
  } catch (e1) {
    try {
      p = T.createWorker({ logger: logger });
    } catch (e2) {
      cb('Unsupported Tesseract.js version');
      return;
    }
    p = p.then(function (w) {
      return w.loadLanguage(lang).then(function () { return w.initialize(lang); }).then(function () { return w; });
    });
  }
  p.then(function (w) { cb(null, w); }, function (err) {
    cb(err && err.message ? err.message : String(err));
  });
}
function downscaleForOcr(src) {
  var maxSide = 1280;
  if (src.width <= maxSide && src.height <= maxSide) return src;
  var s = Math.min(maxSide / src.width, maxSide / src.height);
  var c = makeCanvas(Math.round(src.width * s), Math.round(src.height * s));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c;
}
function runOcrAi() {
  if (_ocrBusy) return;
  var src = _ocrCanvas;
  if (!src) { notify('Load an image first — use 📂 Open or drop a file while on the OCR tab', 'warning'); return; }
  if (typeof tool.requestAI !== 'function') {
    notify('AI channel is not enabled for this tool (admin must set allowAi)', 'error');
    return;
  }
  _ocrBusy = true;
  ocrStatus('Preparing the image for the AI…');
  var b64;
  try {
    b64 = downscaleForOcr(src).toDataURL('image/jpeg', 0.72);
  } catch (e) {
    _ocrBusy = false;
    ocrStatus('Could not encode the image. Use the built-in engine instead.', 'error');
    return;
  }
  ocrStatus('Asking the AI to read the image…');
  tool.requestAI(OCR_PROMPT, b64, function (err, resp) {
    _ocrBusy = false;
    if (err && !resp) { ocrStatus('AI OCR failed: ' + err, 'error'); return; }
    if (resp) {
      el('ocr-result').value = String(resp).trim();
      ocrStatus('AI response received' + (err ? ' (note: ' + err + ')' : '') + '.', 'ok');
    }
  });
}
function ocrCopy() {
  var t = el('ocr-result').value;
  if (!t) { notify('Nothing to copy yet', 'info'); return; }
  function done() { notify('Text copied to clipboard', 'success'); }
  function fail() { notify('Clipboard is blocked here — select the text and press Ctrl+C', 'warning'); }
  function fallback() {
    var ta = el('ocr-result');
    try {
      ta.focus();
      ta.select();
      if (document.execCommand('copy')) done(); else fail();
    } catch (e) { fail(); }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(done, fallback);
  } else {
    fallback();
  }
}
function ocrDownloadTxt() {
  var t = el('ocr-result').value;
  if (!t) { notify('Nothing to save yet', 'info'); return; }
  var blob = new Blob([t], { type: 'text/plain' });
  triggerDownload(blob, baseName() + '-ocr.txt');
}

// ── Download helpers ──────────────────────────────────────────
function triggerDownload(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () {
    try { URL.revokeObjectURL(url); } catch (e) {}
  }, 4000);
}
function saveCanvas(canvas, name, mime, quality) {
  var q = (mime === 'image/png') ? undefined : clamp(quality || 80, 1, 100) / 100;
  if (canvas.toBlob) {
    try {
      canvas.toBlob(function (blob) {
        if (!blob) { notify('Encoding failed for this format', 'error'); return; }
        triggerDownload(blob, name + '.' + extOf(mime));
        notify('Saved ' + name + '.' + extOf(mime), 'success');
      }, mime, q);
      return;
    } catch (e) {}
  }
  try {
    var url = canvas.toDataURL(mime, quality / 100);
    var a = document.createElement('a');
    a.href = url;
    a.download = name + '.' + extOf(mime);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    notify('Saved ' + name + '.' + extOf(mime), 'success');
  } catch (e2) {
    notify('This browser cannot encode ' + mime, 'error');
  }
}
function estimateSize(canvas, mime, quality, cb) {
  if (!canvas) { cb(0); return; }
  if (canvas.toBlob) {
    try {
      canvas.toBlob(function (b) { cb(b ? b.size : 0); }, mime, clamp(quality || 80, 1, 100) / 100);
      return;
    } catch (e) {}
  }
  try {
    var u = canvas.toDataURL(mime, clamp(quality || 80, 1, 100) / 100);
    var idx = u.indexOf(',');
    cb(idx >= 0 ? Math.round((u.length - idx - 1) * 3 / 4) : 0);
  } catch (e2) { cb(0); }
}
function downloadCurrent() {
  if (!_working) { needImage(); return; }
  var mime = _settings.fmt || 'image/png';
  var src = (mime === 'image/jpeg') ? flatten(_working, v('cnv-bg')) : _working;
  saveCanvas(src, baseName(), mime, _settings.quality || 85);
}

// ── Settings persistence ──────────────────────────────────────
function readSettingsFromValue(val) {
  var s = {};
  for (var k in DEFAULTS) {
    if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) s[k] = DEFAULTS[k];
  }
  if (val && typeof val === 'object' && val.settings && typeof val.settings === 'object') {
    for (var k2 in s) {
      if (Object.prototype.hasOwnProperty.call(s, k2) &&
        val.settings[k2] !== undefined && val.settings[k2] !== null) {
        s[k2] = val.settings[k2];
      }
    }
  }
  return s;
}
function collectSettings() {
  return {
    fmt: v('cnv-format'), quality: +v('cnv-quality'),
    cmpFmt: v('cmp-format'), cmpQuality: +v('cmp-quality'),
    ocrLang: v('ocr-lang'),
    colLayout: v('col-layout'), colAspect: v('col-aspect'), colWidth: +v('col-width'),
    colGap: +v('col-gap'), colPad: +v('col-pad'), colBg: v('col-bg'),
    wmText: v('wm-text'), wmSize: +v('wm-size'), wmFont: v('wm-font'), wmColor: v('wm-color'),
    wmOpacity: +v('wm-opacity'), wmPos: _wmPos, wmRot: +v('wm-rot'),
    wmTile: checked('wm-tile'), wmShadow: checked('wm-shadow'),
    rszLock: _rszLock, cropAr: _cropAr, fltPreset: _fltPreset
  };
}
function updateControlLabels() {
  el('cnv-quality-val').textContent = v('cnv-quality') + '%';
  el('cmp-quality-val').textContent = v('cmp-quality') + '%';
  el('col-gap-val').textContent = v('col-gap') + 'px';
  el('col-pad-val').textContent = v('col-pad') + 'px';
  el('wm-size-val').textContent = v('wm-size') + 'px';
  el('wm-opacity-val').textContent = v('wm-opacity') + '%';
  el('wm-rot-val').textContent = v('wm-rot') + '°';
  el('rot-angle-val').textContent = v('rot-angle') + '°';
  updateFilterLabels();
}
function updateLockBtn() {
  var b = el('rsz-lock');
  if (b) b.classList.toggle('active', _rszLock);
}
function applySettings(s) {
  _settings = s;
  setV('cnv-format', s.fmt);
  setV('cnv-quality', s.quality);
  setV('cmp-format', s.cmpFmt);
  setV('cmp-quality', s.cmpQuality);
  setV('ocr-lang', s.ocrLang);
  setV('col-layout', s.colLayout);
  setV('col-aspect', s.colAspect);
  setV('col-width', s.colWidth);
  setV('col-gap', s.colGap);
  setV('col-pad', s.colPad);
  setV('col-bg', s.colBg);
  setV('wm-text', s.wmText);
  setV('wm-size', s.wmSize);
  setV('wm-font', s.wmFont);
  setV('wm-color', s.wmColor);
  setV('wm-opacity', s.wmOpacity);
  setV('wm-rot', s.wmRot);
  el('wm-tile').checked = !!s.wmTile;
  el('wm-shadow').checked = !!s.wmShadow;
  _wmPos = s.wmPos || 'mc';
  _rszLock = s.rszLock !== false;
  _cropAr = s.cropAr || 'free';
  _fltPreset = s.fltPreset || 'none';
  updateControlLabels();
  updateLockBtn();
  updateCropArChips();
  updateWmPosChips();
  updateFilterPresetChips();
  onCnvFormatChanged();
  onCmpFormatChanged();
}
function persistSettingsSoon() {
  if (_readOnly) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(persistNow, 500);
}
function persistNow() {
  if (_readOnly) return;
  _settings = collectSettings();
  _saving = true;
  try {
    tool.setValue({ v: 1, settings: _settings, updatedAt: new Date().toISOString() });
  } catch (e) {}
  setTimeout(function () { _saving = false; }, 400);
}

// ── Events ────────────────────────────────────────────────────
function wireEvents() {
  // tabs
  var tabs = document.querySelectorAll('.iet-tab');
  for (var i = 0; i < tabs.length; i++) {
    (function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.getAttribute('data-tab')); });
    })(tabs[i]);
  }
  // header
  el('iet-btn-open').addEventListener('click', openFilePicker);
  el('iet-btn-cms').addEventListener('click', uploadFromCms);
  el('iet-btn-undo').addEventListener('click', undoWorking);
  el('iet-btn-reset').addEventListener('click', resetWorking);
  el('iet-btn-download').addEventListener('click', downloadCurrent);
  // file input
  el('iet-file').addEventListener('change', function () {
    var files = this.files;
    var slot = _pendingSlot;
    _pendingSlot = -1;
    if (files && files.length) handleFile(files[0], slot);
  });
  // dropzone
  el('iet-drop').addEventListener('click', openFilePicker);
  el('iet-drop').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFilePicker(); }
  });
  el('iet-drop-cms').addEventListener('click', function (e) { e.stopPropagation(); uploadFromCms(); });
  // stage drag & drop
  el('iet-stage').addEventListener('dragover', function (e) {
    e.preventDefault();
    el('iet-drop').classList.add('dragover');
  });
  el('iet-stage').addEventListener('dragleave', function (e) {
    if (e.target === el('iet-stage') || e.target === el('iet-drop')) {
      el('iet-drop').classList.remove('dragover');
    }
  });
  el('iet-stage').addEventListener('drop', function (e) {
    e.preventDefault();
    el('iet-drop').classList.remove('dragover');
    var f = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null;
    if (f) handleFile(f, -1);
  });
  // paste
  document.addEventListener('paste', function (e) {
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i2 = 0; i2 < items.length; i2++) {
      if (items[i2].type && items[i2].type.indexOf('image/') === 0) {
        var f = items[i2].getAsFile();
        if (f) { e.preventDefault(); handleFile(f, -1); }
        break;
      }
    }
  });
  // keyboard: Ctrl+Z undo
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      undoWorking();
    }
  });
  // convert
  el('cnv-format').addEventListener('change', function () { onCnvFormatChanged(); persistSettingsSoon(); });
  el('cnv-quality').addEventListener('input', function () {
    el('cnv-quality-val').textContent = this.value + '%';
    scheduleConvertEst();
  });
  el('cnv-quality').addEventListener('change', persistSettingsSoon);
  el('cnv-bg').addEventListener('change', function () { updateConvertEst(); persistSettingsSoon(); });
  el('cnv-download').addEventListener('click', convertDownload);
  el('cnv-use').addEventListener('click', convertUseInEditor);
  // resize
  el('rsz-lock').addEventListener('click', toggleRszLock);
  el('rsz-w').addEventListener('input', onRszWidthChanged);
  el('rsz-pct').addEventListener('input', onRszPctChanged);
  el('rsz-apply').addEventListener('click', applyResize);
  var presets = document.querySelectorAll('#rsz-presets .iet-chip-btn');
  for (var p2 = 0; p2 < presets.length; p2++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        setV('rsz-pct', btn.getAttribute('data-pct'));
        onRszPctChanged();
      });
    })(presets[p2]);
  }
  // crop
  var arChips = document.querySelectorAll('#crop-aspects .iet-chip-btn');
  for (var c2 = 0; c2 < arChips.length; c2++) {
    (function (btn) {
      btn.addEventListener('click', function () { setCropAr(btn.getAttribute('data-ar')); });
    })(arChips[c2]);
  }
  var cropNums = ['crop-x', 'crop-y', 'crop-w', 'crop-h'];
  for (var cn = 0; cn < cropNums.length; cn++) {
    (function (id) {
      el(id).addEventListener('change', function () {
        _cropRect = cropRectFromInputs();
        renderPreview();
      });
    })(cropNums[cn]);
  }
  el('crop-reset-sel').addEventListener('click', clearCropSelection);
  el('crop-apply').addEventListener('click', applyCrop);
  // rotate
  el('rot-ccw').addEventListener('click', function () { rotate90(-1); });
  el('rot-cw').addEventListener('click', function () { rotate90(1); });
  el('rot-180').addEventListener('click', rotate180);
  el('flip-h').addEventListener('click', flipH);
  el('flip-v').addEventListener('click', flipV);
  el('rot-angle').addEventListener('input', function () { el('rot-angle-val').textContent = this.value + '°'; });
  el('rot-apply-custom').addEventListener('click', applyFineRotate);
  // filters
  var fltChips = document.querySelectorAll('#flt-presets .iet-chip-btn');
  for (var f2 = 0; f2 < fltChips.length; f2++) {
    (function (btn) {
      btn.addEventListener('click', function () { applyFilterPreset(btn.getAttribute('data-preset')); });
    })(fltChips[f2]);
  }
  for (var s2 = 0; s2 < FILTER_SLIDERS.length; s2++) {
    (function (sl) {
      el(sl.id).addEventListener('input', onFilterSliderMoved);
    })(FILTER_SLIDERS[s2]);
  }
  el('flt-reset').addEventListener('click', function () {
    _fltPreset = 'none';
    applyFilterPreset('none');
  });
  el('flt-apply').addEventListener('click', applyFilters);
  // compress
  el('cmp-format').addEventListener('change', function () { onCmpFormatChanged(); persistSettingsSoon(); });
  el('cmp-quality').addEventListener('input', function () {
    el('cmp-quality-val').textContent = this.value + '%';
    scheduleCmpEst();
  });
  el('cmp-quality').addEventListener('change', persistSettingsSoon);
  el('cmp-auto').addEventListener('click', runAutoQuality);
  el('cmp-download').addEventListener('click', compressDownload);
  // watermark
  var wmBtns = document.querySelectorAll('#wm-posgrid .iet-pos-btn');
  for (var w2 = 0; w2 < wmBtns.length; w2++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        _wmPos = btn.getAttribute('data-pos');
        updateWmPosChips();
        persistSettingsSoon();
      });
    })(wmBtns[w2]);
  }
  el('wm-size').addEventListener('input', function () {
    el('wm-size-val').textContent = this.value + 'px';
  });
  el('wm-opacity').addEventListener('input', function () {
    el('wm-opacity-val').textContent = this.value + '%';
  });
  el('wm-rot').addEventListener('input', function () {
    el('wm-rot-val').textContent = this.value + '°';
  });
  el('wm-apply').addEventListener('click', applyWatermark);
  ['wm-text', 'wm-size', 'wm-font', 'wm-color', 'wm-opacity', 'wm-rot', 'wm-tile', 'wm-shadow'].forEach(function (id) {
    el(id).addEventListener('change', persistSettingsSoon);
  });
  // collage
  el('col-layouts').addEventListener('click', function (e) {
    var btn = e.target;
    while (btn && btn !== this && !(btn.classList && btn.classList.contains('iet-layout-btn'))) btn = btn.parentNode;
    if (!btn || btn === this) return;
    var btns = document.querySelectorAll('#col-layouts .iet-layout-btn');
    for (var i3 = 0; i3 < btns.length; i3++) btns[i3].classList.toggle('active', btns[i3] === btn);
    renderSlotGrid();
    persistSettingsSoon();
  });
  el('col-slots').addEventListener('click', function (e) {
    var slotNode = closestSlot(e.target);
    if (!slotNode) return;
    var i = +slotNode.getAttribute('data-i');
    var btn = e.target;
    while (btn && btn !== slotNode && !(btn.classList && btn.classList.contains('iet-slot-btn'))) btn = btn.parentNode;
    if (btn && btn !== slotNode) {
      var act = btn.getAttribute('data-act');
      if (act === 'clear') { _slots[i] = null; renderSlotGrid(); }
      else { _pendingSlot = i; openFilePicker(); }
    } else if (!_slots[i]) {
      _pendingSlot = i;
      openFilePicker();
    }
  });
  el('col-slots').addEventListener('change', function (e) {
    if (!e.target || !e.target.classList || !e.target.classList.contains('iet-slot-fit')) return;
    var slotNode = closestSlot(e.target);
    if (!slotNode) return;
    var i = +slotNode.getAttribute('data-i');
    if (_slots[i]) { _slots[i].fit = e.target.value; renderSlotThumbs(); }
  });
  el('col-slots').addEventListener('dragover', function (e) {
    var s = closestSlot(e.target);
    if (s) { e.preventDefault(); s.classList.add('dragover'); }
  });
  el('col-slots').addEventListener('dragleave', function (e) {
    var s = closestSlot(e.target);
    if (s) s.classList.remove('dragover');
  });
  el('col-slots').addEventListener('drop', function (e) {
    var s = closestSlot(e.target);
    if (!s) return;
    e.preventDefault();
    s.classList.remove('dragover');
    var f = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null;
    if (f) handleFile(f, +s.getAttribute('data-i'));
  });
  ['col-layout', 'col-aspect', 'col-width', 'col-bg'].forEach(function (id) {
    el(id).addEventListener('change', function () {
      if (id === 'col-layout') renderSlotGrid();
      persistSettingsSoon();
    });
  });
  el('col-gap').addEventListener('input', function () { el('col-gap-val').textContent = this.value + 'px'; });
  el('col-gap').addEventListener('change', persistSettingsSoon);
  el('col-pad').addEventListener('input', function () { el('col-pad-val').textContent = this.value + 'px'; });
  el('col-pad').addEventListener('change', persistSettingsSoon);
  el('col-build').addEventListener('click', buildCollage);
  // OCR
  el('ocr-lang').addEventListener('change', persistSettingsSoon);
  el('ocr-btn-local').addEventListener('click', runOcrLocal);
  el('ocr-btn-ai').addEventListener('click', runOcrAi);
  el('ocr-btn-cms').addEventListener('click', uploadFromCms);
  el('ocr-copy').addEventListener('click', ocrCopy);
  el('ocr-download').addEventListener('click', ocrDownloadTxt);
  el('ocr-clear').addEventListener('click', function () {
    el('ocr-result').value = '';
    el('ocr-status').style.display = 'none';
  });
  // preview canvas pointer interaction: crop drag OR pan, plus wheel zoom
  el('iet-preview').addEventListener('pointerdown', function (e) {
    if (_activeTab === 'crop') cropDown(e); else panDown(e);
  });
  el('iet-preview').addEventListener('pointermove', function (e) {
    if (_cropPtr) cropMove(e); else panMove(e);
  });
  el('iet-preview').addEventListener('pointerup', function (e) {
    cropUp(e);
    panUp();
  });
  el('iet-preview').addEventListener('pointercancel', function (e) {
    cropUp(e);
    panUp();
  });
  el('iet-preview').addEventListener('wheel', wheelZoom, { passive: false });
  // zoom viewer controls
  el('iet-zoom-preset').addEventListener('change', function () {
    var val = this.value;
    if (val === 'fit') resetZoom();
    else if (val !== 'custom') setZoomScale(parseFloat(val));
  });
  el('iet-zoom-out').addEventListener('click', function () { zoomAt(-1, _viewW / 2, _viewH / 2); });
  el('iet-zoom-in').addEventListener('click', function () { zoomAt(1, _viewW / 2, _viewH / 2); });
  el('iet-zoom-pct').addEventListener('click', resetZoom);
  el('iet-zoom-100').addEventListener('click', function () { setZoomScale(1); });
  // stage visibility of CMS buttons
  var canUpload = typeof tool.requestUpload === 'function';
  el('iet-btn-cms').style.display = canUpload ? '' : 'none';
  el('iet-drop-cms').style.display = canUpload ? '' : 'none';
  el('ocr-btn-cms').style.display = canUpload ? '' : 'none';
}

// ── Resize observation ────────────────────────────────────────
function setupResize() {
  try {
    if (_resizeObs) _resizeObs.disconnect();
    _resizeObs = new ResizeObserver(function () { renderPreview(); });
    _resizeObs.observe(el('iet-canvas-wrap'));
  } catch (e) {
    window.addEventListener('resize', function () { renderPreview(); });
  }
}

// ── Boot ──────────────────────────────────────────────────────
tool.declareParams([
  {
    name: 'ocrEngineUrl',
    label: 'OCR Engine URL',
    type: 'text',
    default: '',
    hint: 'Optional override for the Tesseract.js script URL (jsdelivr CDN is used by default).',
    severity: 'optional'
  },
  {
    name: 'defaultQuality',
    label: 'Default Quality',
    type: 'number',
    default: '85',
    hint: 'Default JPEG / WebP quality (1-100) for convert, compress and download.',
    severity: 'optional'
  },
  {
    name: 'defaultWatermark',
    label: 'Default Watermark Text',
    type: 'text',
    default: '',
    hint: 'Prefills the watermark text input, e.g. © Your Company.',
    severity: 'optional'
  }
]);

tool.declareOutput({
  type: 'object',
  properties: {
    v: { type: 'number', description: 'Schema version' },
    settings: { type: 'object', description: 'UI settings only — image data never leaves the browser' },
    updatedAt: { type: 'string', description: 'ISO timestamp of the last settings save' }
  }
});

tool.onReady(function (val) {
  wireEvents();
  _settings = readSettingsFromValue(val);
  if (typeof tool.param === 'function') {
    var dq = parseNum(tool.param('defaultQuality', '85'));
    if (dq >= 1 && dq <= 100) _settings.quality = dq;
    var dw = String(tool.param('defaultWatermark', '') || '').trim();
    if (dw && !_settings.wmText) _settings.wmText = dw;
  }
  applySettings(_settings);
  _readOnly = !!tool.isReadOnly();
  updateLock();
  renderSlotGrid();
  updateHeader();
  updateDropTitle();
  setupResize();
  renderPreview();
  scheduleResize();
  tool.reportValid(true);
  tool.onValueChange(function (newVal) {
    if (_saving) return;
    _settings = readSettingsFromValue(newVal);
    applySettings(_settings);
  });
  tool.onReadonlyChange(function (ro) {
    _readOnly = !!ro;
    updateLock();
  });
});

// ── Harness hooks (developer testing only) ────────────────────
window.__ietLoadSample = function (url, name) {
  dataUrlToCanvas(url, function (err, c) {
    if (err) { notify(err, 'error'); return; }
    setWorking(c, { name: name || 'sample.png', size: 0, type: 'image/png' });
  });
};
window.__ietLoadOcrSample = function (url, name) {
  dataUrlToCanvas(url, function (err, c) {
    if (err) { notify(err, 'error'); return; }
    loadOcrImage(c, name || 'sample.png');
  });
};
