// ════════════════════════════════════════════════════════════════
// Image Editing Tools — UniconHub html-tool
// A lightweight, event-based image editing toolbox for the CMS:
//   • Convert   — PNG / JPEG / WebP converter, favicon pack, base64
//   • Resize    — pixel dimensions with aspect lock
//   • Crop      — drag/numeric crop, social-size presets, circle crop
//   • Rotate    — quarter turns, flips, fine rotation, horizon straighten
//   • Frame     — border / mat / radius / shadow + Polaroid preset
//   • Filters   — live sliders, presets v2, duotone, vignette, grain,
//                 auto-enhance, area pixelate/blur
//   • Annotate  — arrows, boxes, circles, freehand, highlighter
//   • Compress  — quality slider + auto-tune to a target size
//   • Watermark — text stamp, pill, meme maker, logo overlay
//   • Collage   — predefined + custom N×M grid frames
//   • OCR       — built-in engine or AI gateway + history
// Editing is chained: undo/redo, step-history jump, keyboard shortcuts.
// All edits are local (canvas in memory); only lightweight settings and
// OCR history persist via tool.setValue(). No CMS object CRUD required.
// ════════════════════════════════════════════════════════════════
'use strict';

// ── Constants ─────────────────────────────────────────────────
var MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
var MAX_PIXELS = 40 * 1000 * 1000; // 40 MP safety cap
var MAX_HISTORY = 25;
var MAX_FILE_BYTES = 40 * 1024 * 1024; // 40 MB
var ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
var SOCIAL_CROPS = [
  { id: 'ig', label: 'IG 1:1', ar: 1, w: 1080, h: 1080 },
  { id: 'story', label: 'Story 9:16', ar: 9 / 16, w: 1080, h: 1920 },
  { id: 'yt', label: 'YouTube 16:9', ar: 16 / 9, w: 1280, h: 720 },
  { id: 'fb', label: 'FB Cover', ar: 820 / 312, w: 820, h: 312 },
  { id: 'li', label: 'LinkedIn', ar: 1584 / 396, w: 1584, h: 396 }
];

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
  { id: 'flt-invert', val: 'flt-invert-val', unit: '%' },
  { id: 'flt-vignette', val: 'flt-vignette-val', unit: '%' },
  { id: 'flt-vig-soft', val: 'flt-vig-soft-val', unit: '%' },
  { id: 'flt-grain', val: 'flt-grain-val', unit: '' }
];

var FILTER_PRESETS = {
  none: {},
  bw: { 'flt-grayscale': 100 },
  sepia: { 'flt-sepia': 100 },
  vintage: { 'flt-sepia': 60, 'flt-contrast': 110, 'flt-brightness': 105, 'flt-hue': -15 },
  cool: { 'flt-hue': -150, 'flt-saturate': 90, 'flt-brightness': 105 },
  warm: { 'flt-hue': -25, 'flt-saturate': 125, 'flt-contrast': 105 },
  vivid: { 'flt-saturate': 170, 'flt-contrast': 115 },
  fade: { 'flt-brightness': 115, 'flt-contrast': 80, 'flt-saturate': 60 },
  film: { 'flt-contrast': 115, 'flt-saturate': 85, 'flt-brightness': 95, 'flt-sepia': 15 },
  neon: { 'flt-saturate': 200, 'flt-contrast': 130, 'flt-brightness': 110 },
  kodak: { 'flt-sepia': 25, 'flt-contrast': 110, 'flt-saturate': 110, 'flt-brightness': 105 },
  drama: { 'flt-contrast': 140, 'flt-grayscale': 30, 'flt-brightness': 95 },
  noir: { 'flt-grayscale': 100, 'flt-contrast': 130, 'flt-brightness': 90 },
  duotone: { 'flt-grayscale': 100, 'flt-contrast': 115 }
};

var DEFAULTS = {
  fmt: 'image/jpeg', quality: 85,
  cmpFmt: 'image/jpeg', cmpQuality: 85,
  ocrLang: 'eng', ocrHistory: [],
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
var _redo = [];             // canvas redo stack
var _opLog = [];            // [{label, time}] applied ops in order
var _opIndex = 0;           // number of ops currently applied (0 = original)
var _socialCrop = null;     // active social crop preset or null
var _straightenActive = false;
var _lineStart = null, _lineEnd = null; // horizon line in 0..1 preview coords
var _regionActive = false;
var _regionPtr = null;
var _regionRect = null;
var _annotMarks = [];
var _annotTool = 'arrow';
var _annotPtr = null;
var _logoCanvas = null;
var _logoName = '';
var _exifData = null;
var _frPreset = 'none';
var _ocrHistory = [];     // saved OCR extractions (persisted in settings)
var _colLayout = 'side';  // collage layout id (buttons set this, no input element)

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
  _regionRect = null;
  refreshResizeInputs();
  initCropInputs();
  updateHeader();
  updateAllEsts();
  renderPreview();
  renderOpLog();
  scheduleResize();
}
function commit(c, label) {
  if (!c) return;
  pushHistory();
  _redo = [];
  _opLog = _opLog.slice(0, _opIndex);
  _opLog.push({ label: label || 'Edit', time: Date.now() });
  _opIndex = _opLog.length;
  _working = c;
  afterImageChange();
}
function setWorking(c, meta) {
  _orig = cloneCanvas(c);
  _working = c;
  _history = [];
  _redo = [];
  _opLog = [];
  _opIndex = 0;
  _socialCrop = null;
  updateSocialChips();
  _exifData = null;
  _origMeta = meta || { name: 'image', size: 0, type: '' };
  resetZoomState();
  afterImageChange();
}
function undoWorking() {
  if (!_history.length) { notify('Nothing to undo', 'info'); return; }
  _redo.push(cloneCanvas(_working));
  _working = _history.pop();
  _opIndex = Math.max(0, _opIndex - 1);
  afterImageChange();
}
function redoWorking() {
  if (!_redo.length) { notify('Nothing to redo', 'info'); return; }
  _history.push(cloneCanvas(_working));
  _working = _redo.pop();
  _opIndex = Math.min(_opLog.length, _opIndex + 1);
  afterImageChange();
}
function resetWorking() {
  if (!_orig) { needImage(); return; }
  pushHistory();
  _redo = [];
  _opLog = _opLog.slice(0, _opIndex);
  _opLog.push({ label: '↺ Reset to original', time: Date.now() });
  _opIndex = _opLog.length;
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
  if (_activeTab === 'filters') {
    var vig = parseNum(v('flt-vignette'));
    if (vig > 0 && fit.dw > 0) {
      var soft = parseNum(v('flt-vig-soft')) / 100;
      var grad = x.createRadialGradient(fit.dx + fit.dw / 2, fit.dy + fit.dh / 2, Math.min(fit.dw, fit.dh) * (0.2 + soft * 0.5), fit.dx + fit.dw / 2, fit.dy + fit.dh / 2, Math.max(fit.dw, fit.dh) * 0.72);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,' + (vig / 100 * 0.8).toFixed(3) + ')');
      x.fillStyle = grad;
      x.fillRect(fit.dx, fit.dy, fit.dw, fit.dh);
    }
  }
  if (_activeTab === 'crop' && _cropRect) drawCropOverlay(x, src, fit);
  if (_activeTab === 'filters' && _regionRect) drawRegionOverlay(x, src, fit);
  if (_straightenActive && _lineStart && _lineEnd) drawStraightenLine(x, src, fit);
  if (_activeTab === 'annotate') drawAnnotOverlay(x, src, fit);
  updateZoomUI();
}
function drawRegionOverlay(x, src, fit) {
  var r = _regionRect;
  if (!r) return;
  var px = fit.dx + r.x / src.width * fit.dw;
  var py = fit.dy + r.y / src.height * fit.dh;
  var pw = r.w / src.width * fit.dw;
  var ph = r.h / src.height * fit.dh;
  x.save();
  x.strokeStyle = '#ff5f56';
  x.lineWidth = 2;
  x.setLineDash([6, 4]);
  x.strokeRect(px, py, pw, ph);
  x.restore();
}
function drawStraightenLine(x, src, fit) {
  x.save();
  x.strokeStyle = '#ffd166';
  x.lineWidth = 2;
  x.setLineDash([8, 5]);
  x.beginPath();
  x.moveTo(fit.dx + _lineStart.x * fit.dw, fit.dy + _lineStart.y * fit.dh);
  x.lineTo(fit.dx + _lineEnd.x * fit.dw, fit.dy + _lineEnd.y * fit.dh);
  x.stroke();
  x.setLineDash([]);
  x.fillStyle = '#ffd166';
  x.beginPath();
  x.arc(fit.dx + _lineStart.x * fit.dw, fit.dy + _lineStart.y * fit.dh, 4, 0, Math.PI * 2);
  x.fill();
  x.beginPath();
  x.arc(fit.dx + _lineEnd.x * fit.dw, fit.dy + _lineEnd.y * fit.dh, 4, 0, Math.PI * 2);
  x.fill();
  x.restore();
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
  el('iet-btn-redo').disabled = !has || !_redo.length;
  el('iet-btn-reset').disabled = !has;
  el('iet-btn-download').disabled = !has;
  el('iet-btn-steps').disabled = !has;
  el('iet-btn-meta').disabled = !has;
  el('iet-btn-copy').disabled = !has;
  el('iet-meta-dims').textContent = has ? (_working.width + ' × ' + _working.height) : '—';
  el('iet-meta-steps').textContent = has ? ('Step ' + _opIndex + '/' + _opLog.length + ' · original ' + fmtSize(_origMeta.size)) : '—';
  if (has) {
    el('iet-file-name').textContent = _origMeta.name || 'image';
    el('iet-file-dims').textContent = _working.width + '×' + _working.height + ' · ' + fmtSize(_origMeta.size);
  }
}
// ── Modal + step history ──────────────────────────────────────
function openModal(title, html) {
  el('iet-modal-title').textContent = title;
  el('iet-modal-body').innerHTML = html;
  el('iet-modal').style.display = 'flex';
  scheduleResize();
}
function closeModal() {
  el('iet-modal').style.display = 'none';
}
function fmtTime(t) {
  try {
    var d = new Date(t);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch (e) { return ''; }
}
function renderOpLog() {
  var list = el('iet-oplog-list');
  if (!list) return;
  var html = '<div class="iet-oplog-item' + (_opIndex === 0 ? ' current' : '') + '" data-step="0">' +
    '<span class="iet-oplog-step">0</span><span class="iet-oplog-label">Original image</span><span class="iet-oplog-time"></span></div>';
  for (var i = 0; i < _opLog.length; i++) {
    html += '<div class="iet-oplog-item' + (_opIndex === i + 1 ? ' current' : '') + '" data-step="' + (i + 1) + '">' +
      '<span class="iet-oplog-step">' + (i + 1) + '</span>' +
      '<span class="iet-oplog-label">' + esc(_opLog[i].label) + '</span>' +
      '<span class="iet-oplog-time">' + fmtTime(_opLog[i].time) + '</span></div>';
  }
  list.innerHTML = html;
}
function openOpLog() {
  if (!_working) { needImage(); return; }
  openModal('🕘 Step history — click a step to jump back', '<div id="iet-oplog-list"></div>');
  renderOpLog();
}
function jumpToStep(t) {
  t = clamp(Math.round(t), 0, _opLog.length);
  var guard = 0;
  while (_opIndex > t && guard++ < 300) undoWorking();
  while (_opIndex < t && guard++ < 300) redoWorking();
  renderOpLog();
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
    if (_activeTab !== 'collage' && _activeTab !== 'ocr') {
      readExifFromFile(file, function (ex) { _exifData = ex; });
    }
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
  if (t !== 'rotate' && _straightenActive) stopStraighten();
  if (t !== 'filters' && _regionActive) stopRegionSelect();
  updateDropTitle();
  updateAllEsts();
  renderPreview();
  scheduleResize();
  persistSettingsSoon();
  try {
    el('iet-preview').style.cursor = (t === 'crop' || t === 'annotate') ? 'crosshair' : 'grab';
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
      commit(c, 'Convert format');
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
  commit(c, 'Resize ' + w + '×' + h);
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
  _socialCrop = null;
  updateCropArChips();
  updateSocialChips();
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
  _socialCrop = null;
  updateSocialChips();
  initCropInputs();
  renderPreview();
}
function updateSocialChips() {
  var chips = document.querySelectorAll('#crop-social .iet-chip-btn');
  for (var i = 0; i < chips.length; i++) {
    chips[i].classList.toggle('active', !!_socialCrop && chips[i].getAttribute('data-social') === _socialCrop.id);
  }
}
function applySocialCrop(preset) {
  if (!_working) { needImage(); return; }
  _socialCrop = preset;
  var ar = preset.ar;
  var W = _working.width, H = _working.height;
  var w, h;
  if (W / H >= ar) { h = H; w = H * ar; } else { w = W; h = W / ar; }
  _cropRect = { x: (W - w) / 2, y: (H - h) / 2, w: w, h: h };
  _cropAr = preset.w + ':' + preset.h;
  updateCropArChips();
  updateSocialChips();
  syncCropInputs();
  renderPreview();
}
function applyCircleCrop() {
  if (!_working) { needImage(); return; }
  var r = _cropRect || cropRectFromInputs();
  if (!r || r.w < 1 || r.h < 1) { notify('Select an area first — drag on the preview', 'warning'); return; }
  var c = makeCanvas(r.w, r.h);
  var x = c.getContext('2d');
  var cx = r.w / 2, cy = r.h / 2, rad = Math.min(r.w, r.h) / 2;
  x.beginPath();
  x.arc(cx, cy, rad, 0, Math.PI * 2);
  x.closePath();
  x.clip();
  x.drawImage(_working, -r.x, -r.y);
  var ring = Math.round(parseNum(v('crop-circle-ring')));
  if (ring > 0) {
    x.lineWidth = ring;
    x.strokeStyle = v('crop-circle-color');
    x.beginPath();
    x.arc(cx, cy, Math.max(1, rad - ring / 2), 0, Math.PI * 2);
    x.stroke();
  }
  commit(c, 'Circle crop');
  notify('Circle crop applied', 'success');
}
function applyCrop() {
  if (!_working) { needImage(); return; }
  var r = _cropRect || cropRectFromInputs();
  if (!r || r.w < 1 || r.h < 1) { notify('Select an area first — drag on the preview', 'warning'); return; }
  if (r.w >= _working.width && r.h >= _working.height && !_socialCrop) { notify('The selection covers the whole image', 'info'); return; }
  var c = makeCanvas(r.w, r.h);
  c.getContext('2d').drawImage(_working, -r.x, -r.y);
  var label = 'Crop';
  if (_socialCrop) {
    var t = makeCanvas(_socialCrop.w, _socialCrop.h);
    var tx = t.getContext('2d');
    tx.imageSmoothingEnabled = true;
    tx.imageSmoothingQuality = 'high';
    tx.drawImage(c, 0, 0, t.width, t.height);
    c = t;
    label = 'Crop (' + _socialCrop.label + ')';
  }
  commit(c, label);
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
  commit(c, dir > 0 ? 'Rotated 90° right' : 'Rotated 90° left');
  notify(dir > 0 ? 'Rotated 90° right' : 'Rotated 90° left', 'success');
}
function rotate180() {
  if (!_working) { needImage(); return; }
  var c = makeCanvas(_working.width, _working.height);
  var x = c.getContext('2d');
  x.translate(c.width, c.height);
  x.rotate(Math.PI);
  x.drawImage(_working, 0, 0);
  commit(c, 'Rotated 180°');
  notify('Rotated 180°', 'success');
}
function flipH() {
  if (!_working) { needImage(); return; }
  var c = makeCanvas(_working.width, _working.height);
  var x = c.getContext('2d');
  x.translate(c.width, 0);
  x.scale(-1, 1);
  x.drawImage(_working, 0, 0);
  commit(c, 'Flipped horizontally');
  notify('Flipped horizontally', 'success');
}
function flipV() {
  if (!_working) { needImage(); return; }
  var c = makeCanvas(_working.width, _working.height);
  var x = c.getContext('2d');
  x.translate(0, c.height);
  x.scale(1, -1);
  x.drawImage(_working, 0, 0);
  commit(c, 'Flipped vertically');
  notify('Flipped vertically', 'success');
}
function applyRotation(deg, bg, label) {
  var rad = deg * Math.PI / 180;
  var cs = Math.abs(Math.cos(rad)), sn = Math.abs(Math.sin(rad));
  var W = _working.width, H = _working.height;
  var nw = Math.ceil(W * cs + H * sn), nh = Math.ceil(W * sn + H * cs);
  if (nw < 1) nw = 1;
  if (nh < 1) nh = 1;
  if (nw * nh > MAX_PIXELS * 2) { notify('Rotated canvas would be too large', 'warning'); return false; }
  var c = makeCanvas(nw, nh);
  var x = c.getContext('2d');
  x.fillStyle = bg || '#ffffff';
  x.fillRect(0, 0, nw, nh);
  x.translate(nw / 2, nh / 2);
  x.rotate(rad);
  x.drawImage(_working, -W / 2, -H / 2);
  commit(c, label || 'Rotated ' + deg + '°');
  return true;
}
function applyFineRotate() {
  if (!_working) { needImage(); return; }
  var deg = parseNum(v('rot-angle'));
  if (!deg) { notify('Angle is 0° — nothing to do', 'info'); return; }
  if (!applyRotation(deg, v('rot-bg'), 'Rotated ' + deg + '°')) return;
  setV('rot-angle', 0);
  el('rot-angle-val').textContent = '0°';
  notify('Rotated ' + deg + '°', 'success');
}
// ── Straighten (horizon drag) ─────────────────────────────────
function toggleStraighten() {
  if (!_working) { needImage(); return; }
  _straightenActive = !_straightenActive;
  _lineStart = null;
  _lineEnd = null;
  el('rot-straighten').classList.toggle('active', _straightenActive);
  el('rot-straighten-hint').style.display = _straightenActive ? 'inline' : 'none';
  try { el('iet-preview').style.cursor = _straightenActive ? 'crosshair' : 'grab'; } catch (e) {}
  renderPreview();
}
function stopStraighten() { if (_straightenActive) toggleStraighten(); }
function straightenDown(e) {
  if (!_straightenActive || !_working) return;
  var p = cvPointerPos(e);
  if (!p) return;
  e.preventDefault();
  _lineStart = p;
  _lineEnd = p;
  try { el('iet-preview').setPointerCapture(e.pointerId); } catch (ignore) {}
}
function straightenMove(e) {
  if (!_lineStart) return;
  var p = cvPointerPos(e);
  if (!p) return;
  _lineEnd = p;
  renderPreview();
}
function straightenUp(e) {
  if (!_lineStart || !_lineEnd) return;
  var dx = _lineEnd.x - _lineStart.x;
  var dy = _lineEnd.y - _lineStart.y;
  var len = Math.sqrt(dx * dx + dy * dy);
  _lineStart = null;
  _lineEnd = null;
  if (len < 0.03) { renderPreview(); notify('Drag a line along the horizon', 'info'); return; }
  var deg = Math.atan2(dy, dx) * 180 / Math.PI;
  var fix = -deg;
  if (Math.abs(fix) < 0.15) { notify('Already level', 'info'); return; }
  var rounded = Math.round(fix * 10) / 10;
  applyRotation(rounded, v('rot-bg'), 'Straightened ' + rounded + '°');
  stopStraighten();
  notify('Straightened by ' + rounded + '°', 'success');
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
  var vig = parseNum(v('flt-vignette'));
  var grain = parseNum(v('flt-grain'));
  if (!f && !vig && !grain) { notify('All adjustments are at default — nothing to apply', 'info'); return; }
  var c = cloneCanvas(_working);
  var x = c.getContext('2d');
  if (f) {
    x.filter = f;
    x.drawImage(_working, 0, 0);
    x.filter = 'none';
  }
  if (vig > 0) {
    var soft = parseNum(v('flt-vig-soft')) / 100;
    var grad = x.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * (0.2 + soft * 0.5), c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.72);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,' + (vig / 100 * 0.8).toFixed(3) + ')');
    x.fillStyle = grad;
    x.fillRect(0, 0, c.width, c.height);
  }
  if (grain > 0) addGrain(x, c, grain);
  _fltPreset = 'none';
  applyFilterPreset('none');
  _filterLive = null;
  commit(c, 'Filters applied');
  notify('Filters applied', 'success');
}
function addGrain(x, c, amount) {
  var n = makeCanvas(256, 256);
  var nx = n.getContext('2d');
  var img = nx.createImageData(256, 256);
  for (var i = 0; i < img.data.length; i += 4) {
    var g = Math.round(Math.random() * 255);
    img.data[i] = g;
    img.data[i + 1] = g;
    img.data[i + 2] = g;
    img.data[i + 3] = Math.round(amount / 40 * 128);
  }
  nx.putImageData(img, 0, 0);
  var pat = x.createPattern(n, 'repeat');
  x.save();
  x.globalCompositeOperation = 'overlay';
  x.fillStyle = pat;
  x.fillRect(0, 0, c.width, c.height);
  x.restore();
}
// ── Duotone ───────────────────────────────────────────────────
function hexToRgb(hex) {
  var h = String(hex || '#000000').replace('#', '');
  if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
  var n = parseInt(h, 16);
  if (isNaN(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function applyDuotone() {
  if (!_working) { needImage(); return; }
  if (_working.width * _working.height > 8e6) notify('Large image — duotone may take a moment', 'info');
  setBusy('Applying duotone…');
  setTimeout(function () {
    try {
      var c1 = hexToRgb(v('flt-duo-1'));
      var c2 = hexToRgb(v('flt-duo-2'));
      var c = cloneCanvas(_working);
      var x = c.getContext('2d');
      var img = x.getImageData(0, 0, c.width, c.height);
      var d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        var lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        var t = lum / 255;
        d[i] = c1.r + (c2.r - c1.r) * t;
        d[i + 1] = c1.g + (c2.g - c1.g) * t;
        d[i + 2] = c1.b + (c2.b - c1.b) * t;
      }
      x.putImageData(img, 0, 0);
      clearBusy();
      commit(c, 'Duotone');
      notify('Duotone applied', 'success');
    } catch (e) {
      clearBusy();
      notify('Duotone failed: ' + e, 'error');
    }
  }, 30);
}
// ── Auto enhance ──────────────────────────────────────────────
function imageStats(src) {
  var s = Math.min(1, 128 / Math.max(src.width, src.height));
  var c = makeCanvas(Math.max(1, Math.round(src.width * s)), Math.max(1, Math.round(src.height * s)));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  var sum = 0, sum2 = 0, n = 0;
  for (var i = 0; i < d.length; i += 4) {
    var lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    sum += lum;
    sum2 += lum * lum;
    n++;
  }
  var mean = n ? sum / n : 128;
  var std = n ? Math.sqrt(Math.max(0, sum2 / n - mean * mean)) : 0;
  return { mean: mean, std: std };
}
function applyAutoEnhance() {
  if (!_working) { needImage(); return; }
  setBusy('Analyzing image…');
  setTimeout(function () {
    try {
      var stats = imageStats(_working);
      clearBusy();
      var bright = clamp(1 + (128 - stats.mean) / 128 * 0.3, 0.85, 1.3);
      var contrast = clamp(1 + (46 - stats.std) / 46 * 0.35, 1, 1.45);
      var f = 'brightness(' + bright.toFixed(2) + ') contrast(' + contrast.toFixed(2) + ') saturate(1.15)';
      var c = cloneCanvas(_working);
      var x = c.getContext('2d');
      x.filter = f;
      x.drawImage(_working, 0, 0);
      x.filter = 'none';
      commit(c, 'Auto enhance');
      notify('Auto-enhanced — brightness ' + Math.round(bright * 100) + '%, contrast ' + Math.round(contrast * 100) + '%', 'success');
    } catch (e) {
      clearBusy();
      notify('Auto enhance failed', 'error');
    }
  }, 30);
}
// ── Region blur / pixelate ────────────────────────────────────
function toggleRegionSelect() {
  if (!_working) { needImage(); return; }
  _regionActive = !_regionActive;
  _regionPtr = null;
  if (!_regionActive) _regionRect = null;
  el('flt-region-btn').classList.toggle('active', _regionActive);
  try { el('iet-preview').style.cursor = _regionActive ? 'crosshair' : 'grab'; } catch (e) {}
  renderPreview();
}
function stopRegionSelect() { if (_regionActive) toggleRegionSelect(); }
function regionDown(e) {
  if (!_regionActive || !_working) return;
  var p = cvPointerPos(e);
  if (!p) return;
  e.preventDefault();
  _regionPtr = { start: p };
  try { el('iet-preview').setPointerCapture(e.pointerId); } catch (ignore) {}
}
function regionMove(e) {
  if (!_regionPtr || !_working) return;
  var p = cvPointerPos(e);
  if (!p) return;
  var W = _working.width, H = _working.height;
  var x = Math.min(_regionPtr.start.x, p.x) * W;
  var y = Math.min(_regionPtr.start.y, p.y) * H;
  var w = Math.abs(p.x - _regionPtr.start.x) * W;
  var h = Math.abs(p.y - _regionPtr.start.y) * H;
  _regionRect = { x: Math.max(0, x), y: Math.max(0, y), w: Math.max(1, Math.min(w, W)), h: Math.max(1, Math.min(h, H)) };
  renderPreview();
}
function regionUp(e) {
  if (!_regionPtr) return;
  _regionPtr = null;
  if (!_regionRect || _regionRect.w < 2 || _regionRect.h < 2) {
    notify('Drag a box over the area to hide', 'info');
    return;
  }
  applyRegion(_regionRect);
  stopRegionSelect();
}
function applyRegion(r) {
  var mode = v('flt-region-mode');
  var strength = Math.round(parseNum(v('flt-region-strength')));
  var c = cloneCanvas(_working);
  var x = c.getContext('2d');
  var rx = Math.max(0, Math.round(r.x)), ry = Math.max(0, Math.round(r.y));
  var rw = Math.min(c.width - rx, Math.round(r.w)), rh = Math.min(c.height - ry, Math.round(r.h));
  if (rw < 2 || rh < 2) return;
  if (mode === 'pixelate') {
    var bs = Math.max(2, strength);
    var tmp = makeCanvas(Math.max(1, Math.ceil(rw / bs)), Math.max(1, Math.ceil(rh / bs)));
    tmp.getContext('2d').drawImage(c, rx, ry, rw, rh, 0, 0, tmp.width, tmp.height);
    x.imageSmoothingEnabled = false;
    x.drawImage(tmp, 0, 0, tmp.width, tmp.height, rx, ry, rw, rh);
    x.imageSmoothingEnabled = true;
  } else {
    var bl = Math.max(1, Math.round(strength / 3));
    x.save();
    x.beginPath();
    x.rect(rx, ry, rw, rh);
    x.clip();
    x.filter = 'blur(' + bl + 'px)';
    x.drawImage(c, 0, 0);
    x.filter = 'none';
    x.restore();
  }
  commit(c, mode === 'pixelate' ? 'Pixelated area' : 'Blurred area');
  notify(mode === 'pixelate' ? 'Area pixelated' : 'Area blurred', 'success');
}

// ── Annotate ──────────────────────────────────────────────────
function strokePoly(x, pts) {
  if (!pts || pts.length < 2) return;
  x.beginPath();
  x.moveTo(pts[0].x, pts[0].y);
  for (var i = 1; i < pts.length; i++) x.lineTo(pts[i].x, pts[i].y);
  x.stroke();
}
function drawArrowShape(x, a, b, size) {
  x.beginPath();
  x.moveTo(a.x, a.y);
  x.lineTo(b.x, b.y);
  x.stroke();
  var ang = Math.atan2(b.y - a.y, b.x - a.x);
  var al = Math.max(10, size * 3.5);
  x.beginPath();
  x.moveTo(b.x, b.y);
  x.lineTo(b.x - al * Math.cos(ang - 0.45), b.y - al * Math.sin(ang - 0.45));
  x.moveTo(b.x, b.y);
  x.lineTo(b.x - al * Math.cos(ang + 0.45), b.y - al * Math.sin(ang + 0.45));
  x.stroke();
}
function drawMarksOnCtx(x, dx, dy, sx, sy) {
  x.lineCap = 'round';
  x.lineJoin = 'round';
  for (var i = 0; i < _annotMarks.length; i++) {
    var m = _annotMarks[i];
    if (m.tool === 'highlight') {
      x.strokeStyle = m.color;
      x.globalAlpha = 0.35;
      x.lineWidth = m.size * 4;
      strokePoly(x, m.pts);
      x.globalAlpha = 1;
      continue;
    }
    x.strokeStyle = m.color;
    x.fillStyle = m.color;
    x.lineWidth = m.size;
    if (m.tool === 'arrow') drawArrowShape(x, m.pts[0], m.pts[m.pts.length - 1], m.size);
    else if (m.tool === 'rect') x.strokeRect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0);
    else if (m.tool === 'ellipse') {
      x.beginPath();
      x.ellipse((m.x0 + m.x1) / 2, (m.y0 + m.y1) / 2, Math.abs(m.x1 - m.x0) / 2, Math.abs(m.y1 - m.y0) / 2, 0, 0, Math.PI * 2);
      x.stroke();
    } else if (m.tool === 'freehand') strokePoly(x, m.pts);
  }
}
function drawAnnotOverlay(x, src, fit) {
  if (!_annotMarks.length) return;
  x.save();
  x.translate(fit.dx, fit.dy);
  x.scale(fit.dw / src.width, fit.dh / src.height);
  drawMarksOnCtx(x, 0, 0, 1, 1);
  x.restore();
}
function annotDown(e) {
  if (_activeTab !== 'annotate' || !_working) return;
  var p = cvPointerPos(e);
  if (!p) return;
  e.preventDefault();
  var ip = { x: p.x * _working.width, y: p.y * _working.height };
  _annotMarks.push({ tool: _annotTool, color: v('ann-color'), size: parseNum(v('ann-size')), x0: ip.x, y0: ip.y, x1: ip.x, y1: ip.y, pts: [ip] });
  _annotPtr = _annotMarks[_annotMarks.length - 1];
  renderPreview();
}
function annotMove(e) {
  if (!_annotPtr || !_working) return;
  var p = cvPointerPos(e);
  if (!p) return;
  var ip = { x: p.x * _working.width, y: p.y * _working.height };
  if (_annotPtr.tool === 'freehand' || _annotPtr.tool === 'highlight') {
    if (_annotPtr.pts.length > 300) return;
    _annotPtr.pts.push(ip);
  } else {
    _annotPtr.x1 = ip.x;
    _annotPtr.y1 = ip.y;
  }
  renderPreview();
}
function annotUp() { _annotPtr = null; }
function bakeAnnotations() {
  if (!_working) { needImage(); return; }
  if (!_annotMarks.length) { notify('Draw something first', 'info'); return; }
  var c = cloneCanvas(_working);
  drawMarksOnCtx(c.getContext('2d'), 0, 0, 1, 1);
  _annotMarks = [];
  commit(c, 'Annotations baked');
  notify('Annotations baked into the image', 'success');
}
function annotRemoveLast() {
  if (!_annotMarks.length) { notify('No marks to remove', 'info'); return; }
  _annotMarks.pop();
  renderPreview();
}
function annotClearAll() {
  _annotMarks = [];
  renderPreview();
  notify('Annotations cleared', 'info');
}
function updateAnnotToolChips() {
  var chips = document.querySelectorAll('#ann-tools .iet-chip-btn');
  for (var i = 0; i < chips.length; i++) {
    chips[i].classList.toggle('active', chips[i].getAttribute('data-tool') === _annotTool);
  }
}
// ── Frame & border studio ─────────────────────────────────────
function roundRectPath(x, px, py, pw, ph, r) {
  r = Math.max(0, Math.min(r, pw / 2, ph / 2));
  x.beginPath();
  if (!r) { x.rect(px, py, pw, ph); return; }
  x.moveTo(px + r, py);
  x.arcTo(px + pw, py, px + pw, py + ph, r);
  x.arcTo(px + pw, py + ph, px, py + ph, r);
  x.arcTo(px, py + ph, px, py, r);
  x.arcTo(px, py, px + pw, py, r);
  x.closePath();
}
function updateFrameChips() {
  var chips = document.querySelectorAll('#fr-presets .iet-chip-btn');
  for (var i = 0; i < chips.length; i++) {
    chips[i].classList.toggle('active', chips[i].getAttribute('data-frame') === _frPreset);
  }
}
function applyFrame() {
  if (!_working) { needImage(); return; }
  var polaroid = _frPreset === 'polaroid';
  var border = Math.round(parseNum(v('fr-border')));
  var radius = Math.round(parseNum(v('fr-radius')));
  var mat = Math.round(parseNum(v('fr-mat')));
  var shOp = parseNum(v('fr-shadow-op')) / 100;
  var caption = (v('fr-caption') || '').trim();
  var W = _working.width, H = _working.height;
  var padS, padB, captionH = 0;
  if (polaroid) {
    padS = Math.round(Math.min(W, H) * 0.045);
    padB = Math.round(Math.min(W, H) * 0.18);
    border = 0;
    mat = 0;
    radius = 0;
    if (caption) captionH = Math.round(Math.min(W, H) * 0.09);
  } else {
    padS = mat + border;
    padB = padS;
  }
  var outW = W + padS * 2;
  var outH = H + padS + padB + captionH;
  var sh = shOp > 0 ? Math.max(24, Math.round(Math.min(outW, outH) * 0.035)) : 0;
  var c = makeCanvas(outW + sh * 2, outH + sh * 2);
  var x = c.getContext('2d');
  if (shOp > 0) {
    x.save();
    x.shadowColor = 'rgba(0,0,0,' + (0.55 * shOp).toFixed(2) + ')';
    x.shadowBlur = sh;
    x.shadowOffsetX = 0;
    x.shadowOffsetY = Math.round(sh * 0.4);
  }
  x.fillStyle = polaroid ? '#ffffff' : v('fr-mat-color');
  roundRectPath(x, sh, sh, outW, outH, radius);
  x.fill();
  if (shOp > 0) x.restore();
  x.save();
  roundRectPath(x, sh + padS, sh + padS, W, H, Math.max(0, radius - border));
  x.clip();
  x.drawImage(_working, sh + padS, sh + padS, W, H);
  x.restore();
  if (border > 0) {
    x.strokeStyle = v('fr-border-color');
    x.lineWidth = border;
    roundRectPath(x, sh + padS + border / 2, sh + padS + border / 2, W - border, H - border, Math.max(0, radius - border));
    x.stroke();
  }
  if (captionH > 0 && caption) {
    x.fillStyle = '#4a4a4a';
    x.font = Math.max(14, Math.round(captionH * 0.55)) + 'px "Segoe Script", "Brush Script MT", cursive';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(caption, c.width / 2, sh + padS + H + captionH / 2, W);
  }
  commit(c, polaroid ? 'Frame (polaroid)' : 'Frame applied');
  notify('Frame applied', 'success');
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
    if (checked('wm-pill')) {
      var tw = x.measureText(text).width;
      var pw2 = tw + size * 0.9;
      var ph2 = size * 1.7;
      x.fillStyle = 'rgba(0,0,0,0.55)';
      roundRectPath(x, -pw2 / 2, -ph2 / 2, pw2, ph2, ph2 / 2);
      x.fill();
      x.fillStyle = color;
    }
    x.fillText(text, 0, 0);
    x.restore();
  }
  x.restore();
  commit(c, 'Watermark');
  notify('Watermark applied — Undo removes it', 'success');
}
// ── Meme maker ────────────────────────────────────────────────
function applyMeme() {
  if (!_working) { needImage(); return; }
  var top = (v('wm-meme-top') || '').trim();
  var bottom = (v('wm-meme-bottom') || '').trim();
  if (!top && !bottom) { notify('Type meme text first', 'warning'); return; }
  var c = cloneCanvas(_working);
  var x = c.getContext('2d');
  var W = c.width, H = c.height;
  var size = Math.max(14, Math.round(Math.min(W, H) / 10));
  x.font = 'bold ' + size + 'px Impact, "Arial Narrow", sans-serif';
  x.textAlign = 'center';
  x.lineJoin = 'round';
  function drawLine(text, y, baseline) {
    if (!text) return;
    x.textBaseline = baseline;
    x.lineWidth = Math.max(3, size / 6);
    x.strokeStyle = '#000';
    x.strokeText(text, W / 2, y, W - size);
    x.fillStyle = '#fff';
    x.fillText(text, W / 2, y, W - size);
  }
  drawLine(top.toUpperCase(), size * 0.4, 'top');
  drawLine(bottom.toUpperCase(), H - size * 1.4, 'alphabetic');
  commit(c, 'Meme text');
  notify('Meme text applied', 'success');
}
// ── Logo overlay ──────────────────────────────────────────────
function applyLogo() {
  if (!_working) { needImage(); return; }
  if (!_logoCanvas) { notify('Choose a logo file first', 'warning'); return; }
  var maxPct = parseNum(v('wm-logo-max')) / 100;
  var op = parseNum(v('wm-logo-opacity')) / 100;
  var pos = v('wm-logo-pos');
  var maxW = Math.max(8, _working.width * maxPct);
  var s = Math.min(1, maxW / _logoCanvas.width);
  var lw = _logoCanvas.width * s, lh = _logoCanvas.height * s;
  var margin = Math.max(4, Math.round(_working.width * 0.02));
  var px = pos.charAt(1) === 'l' ? margin : _working.width - margin - lw;
  var py = pos.charAt(0) === 't' ? margin : _working.height - margin - lh;
  var c = cloneCanvas(_working);
  var x = c.getContext('2d');
  x.globalAlpha = op;
  x.drawImage(_logoCanvas, px, py, lw, lh);
  x.globalAlpha = 1;
  commit(c, 'Logo overlay');
  notify('Logo applied', 'success');
}

// ── Collage ───────────────────────────────────────────────────
function getLayout() {
  var id = _colLayout;
  if (id === 'custom') {
    var rows = clamp(Math.round(parseNum(v('col-rows'))), 1, 5);
    var cols = clamp(Math.round(parseNum(v('col-cols'))), 1, 5);
    var slots = [];
    for (var r = 0; r < rows; r++) {
      for (var cc = 0; cc < cols; cc++) {
        slots.push({ x: cc / cols, y: r / rows, w: 1 / cols, h: 1 / rows });
      }
    }
    return { label: 'Custom grid', slots: slots };
  }
  return LAYOUTS[id] || LAYOUTS.side;
}
function updateColLayoutChips() {
  var btns = document.querySelectorAll('#col-layouts .iet-layout-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-layout') === _colLayout);
  }
  var row = el('col-custom-row');
  if (row) row.style.display = _colLayout === 'custom' ? 'grid' : 'none';
}
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
  commit(c, 'Collage');
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
  ocrStatus('Loading the OCR engine… the first run downloads the engine (~15 MB) and the ' + lang + ' language pack — this can take a minute.');
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
// ── OCR history ───────────────────────────────────────────────
function saveOcrToHistory() {
  var text = el('ocr-result').value;
  if (!text.trim()) { notify('Nothing to save — extract text first', 'info'); return; }
  _ocrHistory.unshift({
    id: 'ocr' + Date.now().toString(36),
    name: baseName(),
    text: String(text).slice(0, 4000),
    lines: text.split(/\n/).length,
    time: new Date().toISOString()
  });
  if (_ocrHistory.length > 20) _ocrHistory.length = 20;
  renderOcrHistory();
  persistSettingsSoon();
  notify('Saved to OCR history', 'success');
}
function renderOcrHistory() {
  var box = el('ocr-history');
  if (!box) return;
  var q = (v('ocr-search') || '').toLowerCase();
  var items = _ocrHistory.filter(function (h) {
    return !q || (h.name && h.name.toLowerCase().indexOf(q) !== -1) || (h.text && h.text.toLowerCase().indexOf(q) !== -1);
  });
  if (!items.length) {
    box.innerHTML = '<div class="iet-ocr-empty">' + (_ocrHistory.length ? 'No matches.' : 'Nothing saved yet — extract text, then 💾 Save to history.') + '</div>';
    return;
  }
  box.innerHTML = items.map(function (h) {
    var idx = _ocrHistory.indexOf(h);
    return '<div class="iet-ocr-item" data-idx="' + idx + '"><b>' + esc(h.name) + ' · ' + h.lines + ' lines</b>' +
      '<span class="iet-oplog-time">' + esc(h.time ? h.time.slice(5, 16).replace('T', ' ') : '') + '</span>' +
      '<button class="iet-slot-btn" data-del="' + idx + '" type="button" title="Delete">✕</button></div>';
  }).join('');
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
// ── Favicon / ICO pack ────────────────────────────────────────
function base64ToBytes(b64) {
  var bin = atob(b64);
  var out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function buildIcoBlob(canvases) {
  var pngs = [];
  var offset = 6 + 16 * canvases.length;
  for (var i = 0; i < canvases.length; i++) {
    var u = canvases[i].toDataURL('image/png');
    var b64 = u.slice(u.indexOf(',') + 1);
    var bytes = base64ToBytes(b64);
    pngs.push(bytes);
    offset += bytes.length;
  }
  var buf = new Uint8Array(offset);
  var dv = new DataView(buf.buffer);
  dv.setUint16(0, 0, true);
  dv.setUint16(2, 1, true);
  dv.setUint16(4, canvases.length, true);
  var pos = 6 + 16 * canvases.length;
  for (var j = 0; j < canvases.length; j++) {
    var e = 6 + 16 * j;
    var s = canvases[j].width;
    buf[e] = s >= 256 ? 0 : s;
    buf[e + 1] = s >= 256 ? 0 : s;
    buf[e + 2] = 0;
    buf[e + 3] = 0;
    dv.setUint16(e + 4, 1, true);
    dv.setUint16(e + 6, 32, true);
    dv.setUint32(e + 8, pngs[j].length, true);
    dv.setUint32(e + 12, pos, true);
    buf.set(pngs[j], pos);
    pos += pngs[j].length;
  }
  return new Blob([buf], { type: 'image/x-icon' });
}
function faviconPack() {
  if (!_working) { needImage(); return; }
  setBusy('Building favicon pack…');
  setTimeout(function () {
    try {
      var sizes = [16, 32, 48, 64];
      var frames = [];
      var last = null;
      for (var i = 0; i < sizes.length; i++) {
        var s = sizes[i];
        var c = makeCanvas(s, s);
        var x = c.getContext('2d');
        x.imageSmoothingEnabled = true;
        x.imageSmoothingQuality = 'high';
        x.drawImage(_working, 0, 0, s, s);
        frames.push(c);
        last = c;
      }
      var big = makeCanvas(256, 256);
      var bx = big.getContext('2d');
      bx.imageSmoothingEnabled = true;
      bx.imageSmoothingQuality = 'high';
      bx.drawImage(_working, 0, 0, 256, 256);
      triggerDownload(buildIcoBlob(frames), baseName() + '-favicon.ico');
      notify('Favicon .ico saved (16/32/48/64)', 'success');
      saveCanvas(big, baseName() + '-icon-256', 'image/png', 100);
      clearBusy();
    } catch (e) {
      clearBusy();
      notify('Favicon export failed: ' + e, 'error');
    }
  }, 30);
}
// ── Base64 / HTML snippet ─────────────────────────────────────
function snippetModal(kind) {
  if (!_working) { needImage(); return; }
  var mime = _settings.fmt || 'image/png';
  var q = (mime === 'image/png') ? undefined : (_settings.quality || 85) / 100;
  var src = (mime === 'image/jpeg') ? flatten(_working, v('cnv-bg')) : _working;
  try {
    var url = src.toDataURL(mime, q);
    var txt = kind === 'html'
      ? '<img src="' + url + '" alt="' + esc(baseName()) + '" width="' + src.width + '" height="' + src.height + '">'
      : url;
    var note = txt.length > 200000 ? '<div class="iet-subhint" style="margin-top:8px">Large payload — consider JPEG quality for smaller snippets.</div>' : '';
    openModal(kind === 'html' ? '&lt;img&gt; HTML snippet' : 'Base64 data URL',
      '<textarea class="iet-snippet-textarea" id="iet-snippet" readonly>' + esc(txt) + '</textarea>' +
      '<div class="iet-row" style="margin-top:8px">' +
      '<button class="iet-btn iet-btn-primary" id="iet-snippet-copy" type="button">📋 Copy</button>' +
      '<span class="iet-subhint">' + fmtSize(txt.length) + '</span>' +
      '</div>' + note);
    el('iet-snippet-copy').addEventListener('click', function () {
      var ta = el('iet-snippet');
      try {
        ta.focus();
        ta.select();
        if (document.execCommand('copy')) notify('Copied to clipboard', 'success');
        else notify('Copy blocked — select the text and press Ctrl+C', 'warning');
      } catch (e) { notify('Copy blocked — select the text and press Ctrl+C', 'warning'); }
    });
  } catch (e) {
    notify('This browser cannot encode ' + mime, 'error');
  }
}
// ── Copy image to clipboard ───────────────────────────────────
function copyImageToClipboard() {
  if (!_working) { needImage(); return; }
  try {
    _working.toBlob(function (blob) {
      if (!blob) { notify('Clipboard image encoding failed', 'error'); return; }
      if (navigator.clipboard && navigator.clipboard.write) {
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(function () {
          notify('Image copied to clipboard', 'success');
        }, function () {
          notify('Clipboard blocked by the sandbox — download instead', 'warning');
        });
      } else {
        notify('Clipboard API not available — download instead', 'warning');
      }
    }, 'image/png');
  } catch (e) {
    notify('Clipboard blocked by the sandbox — download instead', 'warning');
  }
}
// ── EXIF / metadata ───────────────────────────────────────────
function readExifFromFile(file, cb) {
  try {
    var reader = new FileReader();
    reader.onload = function () { cb(parseExif(reader.result)); };
    reader.onerror = function () { cb(null); };
    reader.readAsArrayBuffer(file);
  } catch (e) { cb(null); }
}
function parseExif(buf) {
  if (!buf || buf.byteLength < 32) return null;
  var dv = new DataView(buf);
  if (dv.getUint8(0) !== 0xFF || dv.getUint8(1) !== 0xD8) return null;
  var out = {};
  var off = 2;
  while (off + 4 < buf.byteLength) {
    if (dv.getUint8(off) !== 0xFF) break;
    var marker = dv.getUint8(off + 1);
    var len = dv.getUint16(off + 2);
    if (marker === 0xE1 && dv.getUint8(off + 4) === 0x45 && dv.getUint8(off + 5) === 0x78) {
      var tiff = off + 10;
      var le = dv.getUint16(tiff) === 0x4949; // 'II' = little endian, 'MM' = big
      if (dv.getUint16(tiff + 2, le) === 42) {
        try {
          var ifd0 = tiff + dv.getUint32(tiff + 4, le);
          walkIfd(dv, ifd0, le, out);
        } catch (e) {}
      }
      break;
    }
    if (marker === 0xDA) break;
    off += 2 + len;
  }
  return Object.keys(out).length ? out : null;
}
function walkIfd(dv, base, le, out) {
  try {
    var n = dv.getUint16(base, le);
    for (var i = 0; i < n && base + 2 + i * 12 + 12 <= dv.byteLength; i++) {
      var e = base + 2 + i * 12;
      var tag = dv.getUint16(e, le);
      var type = dv.getUint16(e + 2, le);
      var count = dv.getUint32(e + 4, le);
      var valOff = e + 8;
      var ts = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8 }[type] || 1;
      var dataOff = count * ts > 4 ? base + dv.getUint32(valOff, le) : valOff;
      if (tag === 0x010F) out.make = readStr(dv, dataOff, count);
      else if (tag === 0x0110) out.model = readStr(dv, dataOff, count);
      else if (tag === 0x0112) out.orientation = dv.getUint16(valOff, le);
      else if (tag === 0x0131) out.software = readStr(dv, dataOff, count);
      else if (tag === 0x0132) out.dateTime = readStr(dv, dataOff, count);
      else if (tag === 0x8825) {
        try { walkGps(dv, base + dv.getUint32(valOff, le), le, out); } catch (e2) {}
      } else if (tag === 0x8769) {
        try { walkExifIfd(dv, base + dv.getUint32(valOff, le), le, out); } catch (e3) {}
      }
    }
  } catch (e) {}
}
function walkExifIfd(dv, base, le, out) {
  var n = dv.getUint16(base, le);
  for (var i = 0; i < n; i++) {
    var e = base + 2 + i * 12;
    var tag = dv.getUint16(e, le);
    if (tag === 0x9003) {
      var count = dv.getUint32(e + 4, le);
      var dataOff = count > 4 ? base + dv.getUint32(e + 8, le) : e + 8;
      out.dateOriginal = readStr(dv, dataOff, count);
    } else if (tag === 0xA405) {
      out.focalLength = Math.round((dv.getUint32(e + 8, le) / (dv.getUint32(e + 12, le) || 1)) * 10) / 10 + ' mm';
    }
  }
}
function walkGps(dv, base, le, out) {
  var n = dv.getUint16(base, le);
  for (var i = 0; i < n; i++) {
    var e = base + 2 + i * 12;
    var tag = dv.getUint16(e, le);
    var count = dv.getUint32(e + 4, le);
    if (tag === 0x0002) out.lat = readRational(dv, base + dv.getUint32(e + 8, le), le, count);
    else if (tag === 0x0004) out.lon = readRational(dv, base + dv.getUint32(e + 8, le), le, count);
  }
}
function readRational(dv, off, le, count) {
  if (!count) return null;
  var deg = dv.getUint32(off, le) / (dv.getUint32(off + 4, le) || 1);
  var min = count > 1 ? dv.getUint32(off + 8, le) / (dv.getUint32(off + 12, le) || 1) : 0;
  var sec = count > 2 ? dv.getUint32(off + 16, le) / (dv.getUint32(off + 20, le) || 1) : 0;
  return deg + min / 60 + sec / 3600;
}
function readStr(dv, off, count) {
  var s = '';
  for (var i = 0; i < Math.min(count, 120); i++) {
    var ch = dv.getUint8(off + i);
    if (!ch) break;
    s += String.fromCharCode(ch);
  }
  return s.trim();
}
function openMetaModal() {
  if (!_working) { needImage(); return; }
  var ex = _exifData;
  var gps = '';
  if (ex && ex.lat !== undefined && ex.lon !== undefined) {
    gps = ex.lat.toFixed(5) + '°, ' + ex.lon.toFixed(5) + '°';
  }
  var rows = [
    ['File', esc(_origMeta.name || '—')],
    ['Dimensions', _working.width + ' × ' + _working.height + ' px'],
    ['File size', fmtSize(_origMeta.size)],
    ['Working step', _opIndex + ' of ' + _opLog.length],
    ['Camera make', esc((ex && ex.make) || '—')],
    ['Camera model', esc((ex && ex.model) || '—')],
    ['Captured', esc((ex && (ex.dateOriginal || ex.dateTime)) || '—')],
    ['Focal length', esc((ex && ex.focalLength) || '—')],
    ['GPS', gps || '—'],
    ['Software', esc((ex && ex.software) || '—')]
  ];
  var html = '<table class="iet-meta-table">' + rows.map(function (r) {
    return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>';
  }).join('') + '</table>' +
    '<div class="iet-subhint" style="margin-top:10px">✅ Privacy by design: every export from this tool is re-encoded by the browser, so EXIF / GPS metadata never leaves your device.</div>';
  openModal('ℹ️ Image info &amp; metadata', html);
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
    colLayout: _colLayout, colAspect: v('col-aspect'), colWidth: +v('col-width'),
    colGap: +v('col-gap'), colPad: +v('col-pad'), colBg: v('col-bg'),
    wmText: v('wm-text'), wmSize: +v('wm-size'), wmFont: v('wm-font'), wmColor: v('wm-color'),
    wmOpacity: +v('wm-opacity'), wmPos: _wmPos, wmRot: +v('wm-rot'),
    wmTile: checked('wm-tile'), wmShadow: checked('wm-shadow'),
    rszLock: _rszLock, cropAr: _cropAr, fltPreset: _fltPreset,
    ocrHistory: _ocrHistory
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
  _colLayout = s.colLayout || 'side';
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
  _ocrHistory = Array.isArray(s.ocrHistory) ? s.ocrHistory : [];
  updateControlLabels();
  updateLockBtn();
  updateCropArChips();
  updateWmPosChips();
  updateFilterPresetChips();
  updateColLayoutChips();
  renderOcrHistory();
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
  el('iet-btn-redo').addEventListener('click', redoWorking);
  el('iet-btn-reset').addEventListener('click', resetWorking);
  el('iet-btn-steps').addEventListener('click', openOpLog);
  el('iet-btn-meta').addEventListener('click', openMetaModal);
  el('iet-btn-copy').addEventListener('click', copyImageToClipboard);
  el('iet-btn-download').addEventListener('click', downloadCurrent);
  // modal
  el('iet-modal-close').addEventListener('click', closeModal);
  el('iet-modal').addEventListener('click', function (e) {
    if (e.target === el('iet-modal')) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && el('iet-modal').style.display === 'flex') closeModal();
  });
  // op log delegation
  el('iet-modal-body').addEventListener('click', function (e) {
    var node = e.target;
    while (node && node !== el('iet-modal-body')) {
      if (node.classList && node.classList.contains('iet-oplog-item')) {
        jumpToStep(+node.getAttribute('data-step'));
        return;
      }
      node = node.parentNode;
    }
  });
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
  // keyboard: shortcuts
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (_straightenActive) stopStraighten();
      else if (_regionActive) stopRegionSelect();
      else closeModal();
      return;
    }
    var tag = e.target && e.target.tagName ? e.target.tagName : '';
    var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (typing || e.altKey || e.metaKey) return;
    if (e.ctrlKey) {
      if (e.shiftKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); redoWorking(); }
      else if (!e.shiftKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undoWorking(); }
      else if (!e.shiftKey && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redoWorking(); }
      return;
    }
    switch (e.key) {
      case 'r': case 'R': rotate90(1); break;
      case 'c': case 'C': switchTab('crop'); break;
      case 'f': case 'F': switchTab('filters'); break;
      case '+': case '=': zoomAt(1, _viewW / 2, _viewH / 2); break;
      case '-': zoomAt(-1, _viewW / 2, _viewH / 2); break;
      case '0': setZoomScale(1); break;
      case 'd': case 'D': downloadCurrent(); break;
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
  el('cnv-favicon').addEventListener('click', faviconPack);
  el('cnv-base64').addEventListener('click', function () { snippetModal('b64'); });
  el('cnv-html').addEventListener('click', function () { snippetModal('html'); });
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
  el('crop-circle-apply').addEventListener('click', applyCircleCrop);
  el('crop-circle-ring').addEventListener('input', function () {
    el('crop-circle-ring-val').textContent = this.value + 'px';
  });
  var socialChips = document.querySelectorAll('#crop-social .iet-chip-btn');
  for (var sc = 0; sc < socialChips.length; sc++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-social');
        for (var i = 0; i < SOCIAL_CROPS.length; i++) {
          if (SOCIAL_CROPS[i].id === id) { applySocialCrop(SOCIAL_CROPS[i]); return; }
        }
      });
    })(socialChips[sc]);
  }
  // rotate
  el('rot-ccw').addEventListener('click', function () { rotate90(-1); });
  el('rot-cw').addEventListener('click', function () { rotate90(1); });
  el('rot-180').addEventListener('click', rotate180);
  el('flip-h').addEventListener('click', flipH);
  el('flip-v').addEventListener('click', flipV);
  el('rot-angle').addEventListener('input', function () { el('rot-angle-val').textContent = this.value + '°'; });
  el('rot-apply-custom').addEventListener('click', applyFineRotate);
  el('rot-straighten').addEventListener('click', toggleStraighten);
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
  el('flt-auto').addEventListener('click', applyAutoEnhance);
  el('flt-duo-apply').addEventListener('click', applyDuotone);
  el('flt-region-btn').addEventListener('click', toggleRegionSelect);
  el('flt-region-strength').addEventListener('input', function () {
    el('flt-region-strength-val').textContent = this.value;
  });
  // annotate
  var annTools = document.querySelectorAll('#ann-tools .iet-chip-btn');
  for (var at = 0; at < annTools.length; at++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        _annotTool = btn.getAttribute('data-tool');
        updateAnnotToolChips();
      });
    })(annTools[at]);
  }
  el('ann-size').addEventListener('input', function () { el('ann-size-val').textContent = this.value + 'px'; });
  el('ann-apply').addEventListener('click', bakeAnnotations);
  el('ann-undo').addEventListener('click', annotRemoveLast);
  el('ann-clear').addEventListener('click', annotClearAll);
  // frame
  var frChips = document.querySelectorAll('#fr-presets .iet-chip-btn');
  for (var fc = 0; fc < frChips.length; fc++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        _frPreset = btn.getAttribute('data-frame');
        updateFrameChips();
      });
    })(frChips[fc]);
  }
  el('fr-border').addEventListener('input', function () { el('fr-border-val').textContent = this.value + 'px'; });
  el('fr-radius').addEventListener('input', function () { el('fr-radius-val').textContent = this.value + 'px'; });
  el('fr-mat').addEventListener('input', function () { el('fr-mat-val').textContent = this.value + 'px'; });
  el('fr-shadow-op').addEventListener('input', function () { el('fr-shadow-op-val').textContent = this.value + '%'; });
  el('fr-apply').addEventListener('click', applyFrame);
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
  ['wm-text', 'wm-size', 'wm-font', 'wm-color', 'wm-opacity', 'wm-rot', 'wm-tile', 'wm-shadow', 'wm-pill'].forEach(function (id) {
    el(id).addEventListener('change', persistSettingsSoon);
  });
  el('wm-meme-toggle').addEventListener('click', function () {
    var box = el('wm-meme-box');
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
    scheduleResize();
  });
  el('wm-meme-apply').addEventListener('click', applyMeme);
  el('wm-logo-toggle').addEventListener('click', function () {
    var box = el('wm-logo-box');
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
    scheduleResize();
  });
  el('wm-logo-file').addEventListener('click', function () { el('iet-logo-file').click(); });
  el('iet-logo-file').addEventListener('change', function () {
    var files = this.files;
    if (files && files.length) {
      var f = files[0];
      fileToCanvas(f, function (err, c) {
        if (err) { notify(err, 'error'); return; }
        _logoCanvas = c;
        _logoName = f.name;
        el('wm-logo-name').textContent = f.name;
        notify('Logo loaded: ' + f.name, 'success');
      });
    }
    this.value = '';
  });
  el('wm-logo-max').addEventListener('input', function () { el('wm-logo-max-val').textContent = this.value + '%'; });
  el('wm-logo-opacity').addEventListener('input', function () { el('wm-logo-opacity-val').textContent = this.value + '%'; });
  el('wm-logo-apply').addEventListener('click', applyLogo);
  // collage
  el('col-layouts').addEventListener('click', function (e) {
    var btn = e.target;
    while (btn && btn !== this && !(btn.classList && btn.classList.contains('iet-layout-btn'))) btn = btn.parentNode;
    if (!btn || btn === this) return;
    _colLayout = btn.getAttribute('data-layout');
    updateColLayoutChips();
    renderSlotGrid();
    persistSettingsSoon();
  });
  el('col-rows').addEventListener('change', renderSlotGrid);
  el('col-cols').addEventListener('change', renderSlotGrid);
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
  ['col-aspect', 'col-width', 'col-bg'].forEach(function (id) {
    el(id).addEventListener('change', function () {
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
  el('ocr-save').addEventListener('click', saveOcrToHistory);
  el('ocr-search').addEventListener('input', renderOcrHistory);
  el('ocr-history').addEventListener('click', function (e) {
    var del = e.target;
    if (del && del.classList && del.classList.contains('iet-slot-btn')) {
      var di = +del.getAttribute('data-del');
      if (_ocrHistory[di]) {
        _ocrHistory.splice(di, 1);
        renderOcrHistory();
        persistSettingsSoon();
      }
      return;
    }
    var node = e.target;
    while (node && node !== el('ocr-history')) {
      if (node.classList && node.classList.contains('iet-ocr-item')) {
        var idx = +node.getAttribute('data-idx');
        if (_ocrHistory[idx]) {
          el('ocr-result').value = _ocrHistory[idx].text;
          ocrStatus('Opened from history: ' + esc(_ocrHistory[idx].name), 'ok');
        }
        return;
      }
      node = node.parentNode;
    }
  });
  el('ocr-copy').addEventListener('click', ocrCopy);
  el('ocr-download').addEventListener('click', ocrDownloadTxt);
  el('ocr-clear').addEventListener('click', function () {
    el('ocr-result').value = '';
    el('ocr-status').style.display = 'none';
  });
  // preview canvas pointer interaction: mode-specific
  el('iet-preview').addEventListener('pointerdown', function (e) {
    if (_straightenActive) straightenDown(e);
    else if (_regionActive) regionDown(e);
    else if (_activeTab === 'crop') cropDown(e);
    else if (_activeTab === 'annotate') annotDown(e);
    else panDown(e);
  });
  el('iet-preview').addEventListener('pointermove', function (e) {
    if (_straightenActive) straightenMove(e);
    else if (_regionActive) regionMove(e);
    else if (_cropPtr) cropMove(e);
    else if (_activeTab === 'annotate') annotMove(e);
    else panMove(e);
  });
  el('iet-preview').addEventListener('pointerup', function (e) {
    straightenUp(e);
    regionUp(e);
    cropUp(e);
    annotUp();
    panUp();
  });
  el('iet-preview').addEventListener('pointercancel', function (e) {
    straightenUp(e);
    regionUp(e);
    cropUp(e);
    annotUp();
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
