/* Harness for the crop popup layout / help / Source default and the gallery
   card redesign. */
var fs = require('fs');
var vm = require('vm');

var appDirectory = 'd:/PROJECTS/UNICONHUB/CODE/HTMLBasedTools/BUSINESS/VERTICAL/education-training/tutoring-test-prep/CurriculumBuilder/app';
var toolSource = fs.readFileSync(appDirectory + '/CurriculumBuilder.js', 'utf8');

var passCount = 0;
var failCount = 0;
function check(label, condition, detail) {
  if (condition) { passCount++; return; }
  failCount++;
  console.log('FAIL: ' + label + (detail === undefined ? '' : ' -> ' + detail));
}
function near(actual, expected, tolerance, label) {
  check(label, Math.abs(actual - expected) <= tolerance, actual + ' vs ' + expected + ' ±' + tolerance);
}

function inkAt(inkRects, x, y) {
  for (var index = 0; index < inkRects.length; index++) {
    var rect = inkRects[index];
    if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) return true;
  }
  return false;
}
function makeCanvas(width, height) {
  var canvas = {
    width: width || 1,
    height: height || 1,
    style: {},
    className: '',
    __inkRects: null,
    __source: null,
    getContext: function() { return canvas.__context; },
    toDataURL: function() { return 'data:image/jpeg;base64,TEST'; }
  };
  canvas.__context = {
    fillStyle: '#ffffff',
    fillRect: function() {},
    drawImage: function(source, sx, sy, sw, sh) {
      if (typeof sx === 'number') canvas.__source = { canvas: source, sx: sx, sy: sy, sw: sw, sh: sh };
      else canvas.__source = { canvas: source, sx: 0, sy: 0, sw: source.width, sh: source.height };
    },
    getImageData: function(x, y, w, h) {
      var data = new Uint8ClampedArray(w * h * 4);
      for (var offset = 0; offset < data.length; offset += 4) {
        data[offset] = 255; data[offset + 1] = 255; data[offset + 2] = 255; data[offset + 3] = 255;
      }
      var source = canvas.__source;
      if (source && source.canvas && source.canvas.__inkRects) {
        for (var py = 0; py < h; py++) {
          for (var px = 0; px < w; px++) {
            var pageX = source.sx + (px + 0.5) * (source.sw / w);
            var pageY = source.sy + (py + 0.5) * (source.sh / h);
            if (!inkAt(source.canvas.__inkRects, pageX, pageY)) continue;
            var pixelOffset = (py * w + px) * 4;
            data[pixelOffset] = 0; data[pixelOffset + 1] = 0; data[pixelOffset + 2] = 0; data[pixelOffset + 3] = 255;
          }
        }
      }
      return { data: data, width: w, height: h };
    },
    createImageData: function(w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
    putImageData: function() {}
  };
  return canvas;
}

var fakeElements = {};
function makeElement(id) {
  return {
    id: id,
    style: {},
    className: '',
    innerHTML: '',
    textContent: '',
    hidden: false,
    disabled: false,
    value: '',
    max: '',
    width: 1,
    height: 1,
    clientWidth: 900,
    clientHeight: 600,
    children: [],
    classList: {
      _set: {},
      add: function(name) { this._set[name] = true; },
      remove: function(name) { delete this._set[name]; },
      toggle: function(name, on) { if (on) this._set[name] = true; else delete this._set[name]; },
      contains: function(name) { return !!this._set[name]; }
    },
    addEventListener: function() {},
    removeEventListener: function() {},
    appendChild: function(child) { this.children.push(child); return child; },
    getBoundingClientRect: function() { return { left: 0, top: 0, width: 1000, height: 1000, right: 1000, bottom: 1000 }; },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    remove: function() {},
    setAttribute: function() {},
    getAttribute: function() { return null; }
  };
}
['sd-crop-stage', 'sd-crop-stage-wrap', 'sd-crop-selection', 'sd-crop-save', 'sd-crop-info', 'sd-crop-preview',
 'sd-crop-status', 'sd-crop-page', 'sd-crop-page-total', 'sd-crop-prev', 'sd-crop-next', 'sd-crop-whole-page',
 'sd-crop-clear', 'sd-crop-render-size', 'sd-crop-zoom', 'sd-crop-empty', 'sd-crop-saved', 'sd-crop-saved-title',
 'sd-crop-help', 'sd-crop-help-btn', 'sd-crop-help-close', 'sd-modal-overlay',
 'sd-images-grid', 'sd-images-count', 'sd-pictures-tab-count', 'sd-placement-report'
].forEach(function(id) { fakeElements[id] = makeElement(id); });
fakeElements['sd-crop-preview'].getContext = function() { return makeCanvas(1, 1).getContext(); };

var documentStub = {
  getElementById: function(id) { return fakeElements[id] || null; },
  createElement: function(tagName) { return tagName === 'canvas' ? makeCanvas(1, 1) : makeElement('created-' + tagName); },
  querySelectorAll: function() { return []; },
  addEventListener: function() {},
  removeEventListener: function() {},
  body: { appendChild: function() {} }
};

var uploads = [];
var windowStub = { addEventListener: function() {}, removeEventListener: function() {}, pdfjsLib: null, location: { hostname: 'localhost' } };
var toolStub = {
  capabilities: {},
  onReady: function() {}, onValueChange: function() {}, onReadonlyChange: function() {}, onUserChange: function() {},
  param: function(name, fallback) { return fallback; },
  getValue: function() { return null; }, setValue: function() {}, getFields: function() { return {}; }, getUser: function() { return null; },
  notify: function() {}, resize: function() {}, declareParams: function() {}, declareOutput: function() {}, reportValid: function() {},
  requestUploadBinary: function(options, callback) { uploads.push(options); callback(null, { url: 'https://cdn.example/new.jpg', sizeKb: 12 }); },
  requestUpload: function() {}, requestAI: function() {}, requestAIStream: function() {}, requestObjects: function() {},
  requestExportPdf: function() {}, openUrl: function() {}
};

var sandbox = {
  console: { log: function() {}, warn: function() {}, error: function() {}, info: function() {} },
  window: windowStub, document: documentStub, tool: toolStub,
  setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: setInterval, clearInterval: clearInterval,
  Math: Math, Date: Date, JSON: JSON, Promise: Promise, Uint8Array: Uint8Array, Uint8ClampedArray: Uint8ClampedArray,
  URL: URL, navigator: { userAgent: 'node' }, location: windowStub.location,
  Image: function() { return { width: 0, height: 0 }; }
};
vm.createContext(sandbox);
try {
  vm.runInContext(toolSource, sandbox, { filename: 'CurriculumBuilder.js' });
} catch (loadError) {
  console.log('LOAD FAILED: ' + loadError.message);
  process.exit(1);
}
console.log('loaded tool JS');

/* ── 1. crop popup markup: side panel + help, no bottom hint ── */
var toolHtml = sandbox.buildStudioCropToolHtml();
check('page area + right side', toolHtml.indexOf('class="sd-crop-main"') !== -1 && toolHtml.indexOf('class="sd-crop-side"') !== -1);
check('selection block holds the preview', toolHtml.indexOf('id="sd-crop-preview"') !== -1 && toolHtml.indexOf('id="sd-crop-save"') !== -1);
check('saved list lives in the side panel', toolHtml.indexOf('sd-crop-side-saved') !== -1 && toolHtml.indexOf('id="sd-crop-saved-title"') !== -1);
check('help button in the toolbar', toolHtml.indexOf('id="sd-crop-help-btn"') !== -1);
check('help panel exists', toolHtml.indexOf('id="sd-crop-help"') !== -1 && toolHtml.indexOf('How to crop a picture') !== -1);
check('bottom hint removed', toolHtml.indexOf('sd-crop-hint') === -1);
check('bottom footer removed', toolHtml.indexOf('sd-crop-footer') === -1);
check('zoom still fit width by default', toolHtml.indexOf('<option value="fit-width" selected>Fit width</option>') !== -1);
check('whole page + clear kept', toolHtml.indexOf('id="sd-crop-whole-page"') !== -1 && toolHtml.indexOf('id="sd-crop-clear"') !== -1);

/* ── 2. help toggles, Escape closes it first ── */
sandbox.studioCropState = sandbox.defaultStudioCropState();
fakeElements['sd-crop-help'].hidden = true;
sandbox.toggleStudioCropHelp();
check('help opens', fakeElements['sd-crop-help'].hidden === false);
check('help button marked active', fakeElements['sd-crop-help-btn'].classList.contains('is-active'));
sandbox.toggleStudioCropHelp(false);
check('help closes', fakeElements['sd-crop-help'].hidden === true);

/* ── 3. saved crops: vertical rows in the side panel ── */
sandbox.editingStudyDocImages = [
  { name: 'page-3-crop-1.jpg', sourcePage: 3, manualCrop: true, width: 200, height: 300, dataUrl: 'data:image/jpeg;base64,A' },
  { name: 'page-4-crop-1.jpg', sourcePage: 4, manualCrop: true, width: 100, height: 100, dataUrl: 'data:image/jpeg;base64,B' }
];
sandbox.studioCropState.pageNumber = 3;
sandbox.studioCropState.pageCanvas = makeCanvas(1000, 1200);
sandbox.renderStudioCropSavedStrip();
var savedStrip = fakeElements['sd-crop-saved'];
check('saved title counts this page', fakeElements['sd-crop-saved-title'].textContent.indexOf('Saved from page 3 (1)') !== -1, fakeElements['sd-crop-saved-title'].textContent);
check('saved row has a name and size', savedStrip.innerHTML.indexOf('sd-crop-saved-name') !== -1 && savedStrip.innerHTML.indexOf('200 × 300 px') !== -1);
check('saved row keeps the remove button', savedStrip.innerHTML.indexOf('data-crop-remove="0"') !== -1);
check('saved source marker', savedStrip.innerHTML.indexOf('◐ page-3-crop-1.jpg') !== -1);

/* ── 4. manual crops are Source by default ── */
sandbox.editingStudyDocImages = [];
sandbox.studioCropState = sandbox.defaultStudioCropState();
sandbox.studioCropState.pageNumber = 2;
sandbox.studioCropState.pageCanvas = makeCanvas(1000, 1200);
sandbox.studioCropState.pageLines = [];
sandbox.studioCropState.selection = { x: 0.1, y: 0.1, width: 0.2, height: 0.2 };
var realRenderGallery = sandbox.renderStudyDocImageGallery;
sandbox.persistStudioImages = function() {};
sandbox.renderStudyDocImageGallery = function() {};
sandbox.renderPdfEditorList = function() {};
sandbox.autoSaveCurrentLesson = function() {};
uploads.length = 0;
sandbox.uploadStudioImageToStorage = function(imageIndex, onDone) { uploads.push(imageIndex); if (onDone) onDone(true); };
sandbox.saveStudioCropSelection();
check('crop saved', sandbox.editingStudyDocImages.length === 1, sandbox.editingStudyDocImages.length);
var savedCrop = sandbox.editingStudyDocImages[0];
if (savedCrop) {
  check('crop role is Source', savedCrop.role === 'source', savedCrop.role);
  check('crop marked manual', savedCrop.manualCrop === true);
  check('crop still anchored to the page', savedCrop.sourcePage === 2);
  check('crop uploaded', uploads.length === 1, JSON.stringify(uploads));
}

/* ── 5. gallery card redesign ── */
sandbox.editingStudyDocImages = [
  { id: 'img-1', name: 'page-3-crop-1.jpg', sourcePage: 3, orderOnPage: 1, manualCrop: true, role: 'source',
    width: 200, height: 300, sizeKb: 40, dataUrl: 'data:image/jpeg;base64,A', anchorBefore: 'Turning the vehicle on' }
];
sandbox.studioSelectedImageIds = {};
sandbox.studioCurrentDocUrl = 'https://cdn.example/doc.pdf';
sandbox.studioImagePreviewVersion = {};
sandbox.renderStudioPlacementReportPanel = function() {};
realRenderGallery();
var galleryHtml = fakeElements['sd-images-grid'].innerHTML;
check('card has a thumb wrapper', galleryHtml.indexOf('class="sd-image-thumb"') !== -1);
check('card uses contain-fit thumb', galleryHtml.indexOf('data-sd-view="0"') !== -1);
check('select control overlays the image', galleryHtml.indexOf('sd-image-check') !== -1 && galleryHtml.indexOf('> select</label>') === -1);
check('role chip overlays the image', galleryHtml.indexOf('class="sd-image-role is-source"') !== -1);
check('role chip is not in the action row', galleryHtml.indexOf('sd-image-actions">' + '<button type="button" class="sd-image-role') === -1);
var pinIndex = galleryHtml.indexOf('data-sd-pin="0"');
var removeIndex = galleryHtml.indexOf('data-sd-remove="0"');
check('five action buttons', pinIndex !== -1 && removeIndex !== -1 &&
  galleryHtml.indexOf('data-sd-move="0"') !== -1 && galleryHtml.indexOf('data-sd-regen="0"') !== -1);
check('source role label', galleryHtml.indexOf('◐ Source') !== -1);
check('remove button has a tooltip', galleryHtml.indexOf('title="Remove this picture from the document"') !== -1);

/* ── 6. engine regression ── */
var refinedPage = makeCanvas(1000, 1200);
refinedPage.__inkRects = [{ x: 100, y: 96, width: 500, height: 504 }];
var refined = sandbox.refineStudioCropRect(refinedPage, { left: 100, top: 100, width: 500, height: 480 });
check('crop refinement still works', refined.top <= 96 && refined.top + refined.height >= 600, JSON.stringify(refined));
var cropBox = sandbox.visionBoxToCropRect({ box: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } }, 1000, 1000);
check('vision box padding still works', cropBox.left === 230 && cropBox.width === 540);

console.log((failCount ? 'FAILED' : 'ALL PASS') + ' ' + passCount + ' · FAIL ' + failCount);
process.exit(failCount ? 1 : 0);
