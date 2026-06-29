/* ---- Staff Training Verification - JS ---- */
var MODS = [
  { id: 'ohs',          type: 'self', num: 1 },
  { id: 'harassment',   type: 'self', num: 2 },
  { id: 'emergency',    type: 'self', num: 3 },
  { id: 'whmis',        type: 'self', num: 4 },
  { id: 'orientation',  type: 'supervised', num: 5 },
  { id: 'paperwork',    type: 'supervised', num: 6 },
  { id: 'industrial',   type: 'supervised', num: 7 },
  { id: 'ethics',       type: 'supervised', num: 8 },
  { id: 'edi',          type: 'supervised', num: 9 },
  { id: 'confidentiality', type: 'supervised', num: 10 },
  { id: 'clientservice',   type: 'supervised', num: 11 }
];
var TOTAL_MODS = MODS.length;
var readOnly = false;
var _selfSave = false;
var _saveTimer = null;
var _sigStore = {};
var $ = function (id) { return document.getElementById(id); };

/* ---- Signature helpers (adapted from EmploymentAgreementBuilder) ---- */
function initSignaturePad(canvasId) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext('2d'), drawing = false;
  var rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  canvas.width = rect.width * 2;
  canvas.height = rect.height * 2;
  ctx.scale(2, 2);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  function gp(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.touches ? e.touches[0].clientX : e.clientX) - r.left, y: (e.touches ? e.touches[0].clientY : e.clientY) - r.top };
  }
  function start(e) { if (readOnly) return; e.preventDefault(); drawing = true; var p = gp(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function move(e) { if (!drawing) return; e.preventDefault(); var p = gp(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
  function stop() { if (!drawing) return; drawing = false; storeSignatures(); }
  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', stop);
  canvas.addEventListener('mouseleave', stop);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', stop);
}

function clearSignature(canvasId) {
  var c = document.getElementById(canvasId);
  if (!c) return;
  c.getContext('2d').clearRect(0, 0, c.width, c.height);
  storeSignatures();
  updateProgress();
  updateSubmitState();
  tool.notify('Cleared.', 'info');
}

function isCanvasEmpty(canvas) {
  if (!canvas || canvas.width === 0 || canvas.height === 0) return true;
  try {
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (var i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
    return true;
  } catch(e) { return true; }
}

function getAllSigCanvasIds() {
  var ids = [];
  ['ohs','harassment','emergency','whmis'].forEach(function(m) { ids.push('sig-init-' + m); });
  ['orientation','paperwork','industrial','ethics','edi','confidentiality','clientservice'].forEach(function(m) {
    ids.push('sig-init-' + m + '-staff');
    ids.push('sig-init-' + m + '-sup');
  });
  ids.push('sig-init-handbook');
  ids.push('sigEmployee');
  ids.push('sigSupervisor');
  return ids;
}

function storeSignatures() {
  var sigs = {};
  getAllSigCanvasIds().forEach(function(id) {
    var c = document.getElementById(id);
    if (c && !isCanvasEmpty(c)) sigs[id] = c.toDataURL('image/png');
  });
  _sigStore = sigs;
  copySigsToHidden();
}

function restoreSignatures(sigData) {
  if (!sigData) return;
  Object.keys(sigData).forEach(function(id) {
    var c = document.getElementById(id);
    if (c && sigData[id]) {
      var img = new Image();
      img.onload = function() { c.getContext('2d').drawImage(img, 0, 0); };
      img.src = sigData[id];
    }
  });
}

function initAllSignaturePads() {
  getAllSigCanvasIds().forEach(function(id) { initSignaturePad(id); });
}

function copySigsToHidden() {
  ['ohs','harassment','emergency','whmis'].forEach(function(m) {
    var c = document.getElementById('sig-init-' + m);
    var h = document.querySelector('.stv-init[data-mod="' + m + '"]');
    if (h) h.value = (c && !isCanvasEmpty(c)) ? 'signed' : '';
  });
  ['orientation','paperwork','industrial','ethics','edi','confidentiality','clientservice'].forEach(function(m) {
    var cStaff = document.getElementById('sig-init-' + m + '-staff');
    var cSup = document.getElementById('sig-init-' + m + '-sup');
    var hStaff = document.querySelector('.stv-init[data-mod="' + m + '"][data-sup="staffInitials"]');
    var hSup = document.querySelector('.stv-init[data-mod="' + m + '"][data-sup="supervisorInitials"]');
    if (hStaff) hStaff.value = (cStaff && !isCanvasEmpty(cStaff)) ? 'signed' : '';
    if (hSup) hSup.value = (cSup && !isCanvasEmpty(cSup)) ? 'signed' : '';
  });
  var cHb = document.getElementById('sig-init-handbook');
  var hHb = document.getElementById('hbInitials');
  if (hHb) hHb.value = (cHb && !isCanvasEmpty(cHb)) ? 'signed' : '';
}

function isSelf(m) { return m.type === 'self'; }
function isSup(m) { return m.type === 'supervised'; }

/* ---- Data helpers ---- */
function defaultModData(m) {
  if (isSelf(m)) {
    return { type: 'self', completed: false, initials: '', answers: ['', '', ''], dateCompleted: '', deliveredBy: '' };
  }
  return { type: 'supervised', completed: false, staffInitials: '', supervisorInitials: '', dateCompleted: '', deliveredBy: '' };
}

function defaultData() {
  var mods = {};
  MODS.forEach(function (m) { mods[m.id] = defaultModData(m); });
  return {
    staffName: '', date: '', modules: mods, submittedAt: '',
    handbookAcknowledged: { confirmed: false, initials: '', dateAcknowledged: '' }
  };
}

/* ---- Gather current state from DOM ---- */
function gatherData() {
  var data = {
    staffName: ($('staffName').value || '').trim(),
    date: $('trainDate').value || '',
    modules: {},
    submittedAt: currentValue ? currentValue.submittedAt || '' : '',
    _signatures: _sigStore,
    _sigSupervisorName: $('sigSupName') ? ($('sigSupName').value || '').trim() : '',
    _sigSupervisorDate: $('sigSupDate') ? $('sigSupDate').value || '' : '',
    handbookAcknowledged: {
      confirmed: $('hbConfirmed') ? $('hbConfirmed').checked : false,
      initials: $('hbInitials') ? ($('hbInitials').value || '').trim() : '',
      dateAcknowledged: $('hbDate') ? $('hbDate').value || '' : ''
    }
  };
  var prev = currentValue ? (currentValue.modules || {}) : {};

  MODS.forEach(function (m) {
    var cb = document.querySelector('.stv-cb[data-mod="' + m.id + '"]');
    var completed = cb ? cb.checked : false;

    if (isSelf(m)) {
      var initEl = document.querySelector('.stv-init[data-mod="' + m.id + '"]');
      var answers = [];
      for (var q = 0; q < 3; q++) {
        var inp = document.querySelector('.stv-inp[data-mod="' + m.id + '"][data-q="' + q + '"]');
        answers.push(inp ? (inp.value || '').trim() : '');
      }
      data.modules[m.id] = {
        type: 'self',
        completed: completed,
        initials: initEl ? (initEl.value || '').trim() : '',
        answers: answers,
        dateCompleted: completed ? (prev[m.id] ? prev[m.id].dateCompleted || '' : '') : '',
        deliveredBy: ''
      };
    } else {
      var staffInitEl = document.querySelector('.stv-init[data-mod="' + m.id + '"][data-sup="staffInitials"]');
      var supInitEl = document.querySelector('.stv-init[data-mod="' + m.id + '"][data-sup="supervisorInitials"]');
      var dateEl = document.querySelector('.stv-inp[data-mod="' + m.id + '"][data-sup="date"]');
      var delByEl = document.querySelector('.stv-inp[data-mod="' + m.id + '"][data-sup="deliveredBy"]');
      data.modules[m.id] = {
        type: 'supervised',
        completed: completed,
        staffInitials: staffInitEl ? (staffInitEl.value || '').trim() : '',
        supervisorInitials: supInitEl ? (supInitEl.value || '').trim() : '',
        dateCompleted: dateEl ? dateEl.value || '' : '',
        deliveredBy: delByEl ? (delByEl.value || '').trim() : ''
      };
    }
  });
  return data;
}

/* ---- Populate DOM from saved data ---- */
function populateUI(data) {
  if (!data) return;
  $('staffName').value = data.staffName || '';
  $('trainDate').value = data.date || '';

  MODS.forEach(function (m) {
    var cb = document.querySelector('.stv-cb[data-mod="' + m.id + '"]');
    var mod = (data.modules && data.modules[m.id]) ? data.modules[m.id] : defaultModData(m);
    if (cb) cb.checked = !!mod.completed;

    if (isSelf(m)) {
      var initEl = document.querySelector('.stv-init[data-mod="' + m.id + '"]');
      if (initEl) initEl.value = mod.initials || '';
      for (var q = 0; q < 3; q++) {
        var inp = document.querySelector('.stv-inp[data-mod="' + m.id + '"][data-q="' + q + '"]');
        if (inp) inp.value = (mod.answers && mod.answers[q]) ? mod.answers[q] : '';
      }
    } else {
      var staffInitEl = document.querySelector('.stv-init[data-mod="' + m.id + '"][data-sup="staffInitials"]');
      var supInitEl = document.querySelector('.stv-init[data-mod="' + m.id + '"][data-sup="supervisorInitials"]');
      var dateEl = document.querySelector('.stv-inp[data-mod="' + m.id + '"][data-sup="date"]');
      var delByEl = document.querySelector('.stv-inp[data-mod="' + m.id + '"][data-sup="deliveredBy"]');
      if (staffInitEl) staffInitEl.value = mod.staffInitials || '';
      if (supInitEl) supInitEl.value = mod.supervisorInitials || '';
      if (dateEl) dateEl.value = mod.dateCompleted || '';
      if (delByEl) delByEl.value = mod.deliveredBy || '';
    }
  });
  // Handbook fields
  var hb = data.handbookAcknowledged || { confirmed: false, initials: '', dateAcknowledged: '' };
  if ($('hbConfirmed')) $('hbConfirmed').checked = !!hb.confirmed;
  if ($('hbInitials')) $('hbInitials').value = hb.initials || '';
  if ($('hbDate')) $('hbDate').value = hb.dateAcknowledged || '';

  // Supervisor signature fields
  if ($('sigSupName')) $('sigSupName').value = (data._sigSupervisorName || '');
  if ($('sigSupDate')) $('sigSupDate').value = (data._sigSupervisorDate || '');

  // Update staff name in signature section
  if ($('sigEmpName')) $('sigEmpName').textContent = data.staffName || '';
  if ($('sigEmpDate')) $('sigEmpDate').textContent = data.date || '';

  updateProgress();
  updateSubmitState();
  
  setTimeout(function() {
    initAllSignaturePads();
    if (data._signatures) restoreSignatures(data._signatures);
  }, 100);
}

/* ---- Check if a supervised module is complete ---- */
function isSupComplete(modData) {
  return modData.completed &&
    (modData.staffInitials || '').trim().length > 0 &&
    (modData.supervisorInitials || '').trim().length > 0 &&
    (modData.deliveredBy || '').trim().length > 0 &&
    (modData.dateCompleted || '').length > 0;
}

function isSelfComplete(modData) {
  return modData.completed && (modData.initials || '').trim().length > 0;
}

function isModuleComplete(modData) {
  if (!modData.completed) return false;
  if (modData.type === 'supervised') return isSupComplete(modData);
  return isSelfComplete(modData);
}

/* ---- Progress ---- */
function updateProgress() {
  var done = 0;
  MODS.forEach(function (m) {
    var cb = document.querySelector('.stv-cb[data-mod="' + m.id + '"]');
    var checked = cb ? cb.checked : false;
    var badge = $('badge-' + m.id);

    if (isSelf(m)) {
      var initEl = document.querySelector('.stv-init[data-mod="' + m.id + '"]');
      var hasInitials = initEl ? (initEl.value || '').trim().length > 0 : false;
      if (checked && hasInitials) {
        done++;
        if (badge) { badge.textContent = 'Done'; badge.className = 'stv-mod-badge stv-badge-done'; }
      } else if (checked || hasInitials) {
        if (badge) { badge.textContent = 'In progress'; badge.className = 'stv-mod-badge stv-badge-progress'; }
      } else {
        if (badge) { badge.textContent = ''; badge.className = 'stv-mod-badge'; }
      }
    } else {
      var sInitEl = document.querySelector('.stv-init[data-mod="' + m.id + '"][data-sup="staffInitials"]');
      var pInitEl = document.querySelector('.stv-init[data-mod="' + m.id + '"][data-sup="supervisorInitials"]');
      var delByEl = document.querySelector('.stv-inp[data-mod="' + m.id + '"][data-sup="deliveredBy"]');
      var dateEl = document.querySelector('.stv-inp[data-mod="' + m.id + '"][data-sup="date"]');
      var hasStaffInit = sInitEl ? (sInitEl.value || '').trim().length > 0 : false;
      var hasSupInit = pInitEl ? (pInitEl.value || '').trim().length > 0 : false;
      var hasDelBy = delByEl ? (delByEl.value || '').trim().length > 0 : false;
      var hasDate = dateEl ? (dateEl.value || '').length > 0 : false;
      var supDone = checked && hasStaffInit && hasSupInit && hasDelBy && hasDate;
      var supStarted = checked || hasStaffInit || hasSupInit || hasDelBy || hasDate;

      if (supDone) {
        done++;
        if (badge) { badge.textContent = 'Complete'; badge.className = 'stv-mod-badge stv-badge-done'; }
      } else if (supStarted) {
        if (badge) { badge.textContent = 'In progress'; badge.className = 'stv-mod-badge stv-badge-progress'; }
      } else {
        if (badge) { badge.textContent = ''; badge.className = 'stv-mod-badge'; }
      }
    }
  });
  // Handbook status
  var hbConfirmed = $('hbConfirmed') ? $('hbConfirmed').checked : false;
  var hbInitials = $('hbInitials') ? ($('hbInitials').value || '').trim().length > 0 : false;
  var hbStatus = $('hbStatus');
  if (hbConfirmed && hbInitials) {
    if (hbStatus) { hbStatus.textContent = 'Handbook Acknowledged \u2713'; hbStatus.className = 'stv-handbook-status stv-hb-ok'; }
  } else if (hbConfirmed || hbInitials) {
    if (hbStatus) { hbStatus.textContent = 'Handbook acknowledgement incomplete'; hbStatus.className = 'stv-handbook-status stv-hb-pending'; }
  } else {
    if (hbStatus) { hbStatus.textContent = ''; hbStatus.className = 'stv-handbook-status'; }
  }

  // Full signature status
  var sigEmpEmpty = isCanvasEmpty($('sigEmployee'));
  var sigSupEmpty = isCanvasEmpty($('sigSupervisor'));
  var sigSec = $('sigSection');
  if (sigSec) {
    if (!sigEmpEmpty && !sigSupEmpty) {
      sigSec.style.borderColor = 'var(--stv-green)';
    } else if (!sigEmpEmpty || !sigSupEmpty) {
      sigSec.style.borderColor = 'var(--stv-amber)';
    } else {
      sigSec.style.borderColor = '';
    }
  }

  var pct = Math.round((done / TOTAL_MODS) * 100);
  $('progFill').style.width = pct + '%';
  $('progLabel').textContent = done + ' of ' + TOTAL_MODS + ' modules complete';
}

/* ---- Submit state ---- */
function updateSubmitState() {
  var btn = $('btnSubmit');
  if (!btn) return;
  var data = gatherData();
  var hasName = data.staffName.length > 0;
  var allDone = MODS.every(function (m) {
    var mod = data.modules[m.id];
    return isModuleComplete(mod);
  });
  var someStarted = MODS.some(function (m) {
    var mod = data.modules[m.id];
    if (mod.completed) return true;
    if (isSelf(m)) {
      return (mod.initials || '').length > 0 || (mod.answers || []).some(function (a) { return a.length > 0; });
    }
    return (mod.staffInitials || '').length > 0 || (mod.supervisorInitials || '').length > 0 ||
      (mod.deliveredBy || '').length > 0 || (mod.dateCompleted || '').length > 0;
  });
  var hbOk = data.handbookAcknowledged && data.handbookAcknowledged.confirmed && (data.handbookAcknowledged.initials || '').length > 0;
  btn.disabled = !hasName || !allDone || !hbOk;
  var msgEl = $('submitMsg');
  if (!hasName && someStarted) {
    msgEl.textContent = 'Enter your name before submitting.';
  } else if (hasName && !allDone) {
    msgEl.textContent = 'Complete all ' + TOTAL_MODS + ' modules before submitting.';
  } else if (hasName && allDone && !hbOk) {
    msgEl.textContent = 'Acknowledge the Staff Handbook (check the box and enter your initials).';
  } else {
    msgEl.textContent = '';
  }
}

/* ---- Accordion ---- */
function toggleModule(modId) {
  var body = $('body-' + modId);
  var head = document.querySelector('.stv-mod-head[data-mod="' + modId + '"]');
  if (!body || !head) return;
  var expanded = head.getAttribute('aria-expanded') === 'true';
  if (expanded) {
    body.hidden = true;
    head.setAttribute('aria-expanded', 'false');
  } else {
    body.hidden = false;
    head.setAttribute('aria-expanded', 'true');
  }
  try { tool.resize(); } catch (e) {}
}

/* ---- Read-only ---- */
function lockUI(ro) {
  readOnly = ro;
  var root = $('stvRoot');
  if (ro) {
    root.setAttribute('data-readonly', 'true');
    $('btnSubmit').style.display = 'none';
    $('submitMsg').style.display = 'none';
  } else {
    root.setAttribute('data-readonly', 'false');
    root.removeAttribute('data-readonly');
    $('btnSubmit').style.display = '';
    $('submitMsg').style.display = '';
  }
}

/* ---- Validation ---- */
function validateForm() {
  var data = gatherData();
  if (!data.staffName) {
    tool.reportValid(false, 'Please enter your name.');
    return;
  }
  var hb = data.handbookAcknowledged || {};
  var incomplete = MODS.filter(function (m) {
    return !isModuleComplete(data.modules[m.id]);
  });
  if (incomplete.length > 0) {
    tool.reportValid(false, 'Complete all ' + TOTAL_MODS + ' modules before saving.');
    return;
  }
  if (!hb.confirmed || !(hb.initials || '').trim()) {
    tool.reportValid(false, 'Acknowledge the Staff Handbook before saving.');
    return;
  }
  tool.reportValid(true);
}

/* ---- Save ---- */
function saveValue(data) {
  _selfSave = true;
  storeSignatures();
  data._signatures = _sigStore;
  data._sigSupervisorName = $('sigSupName') ? ($('sigSupName').value || '').trim() : '';
  data._sigSupervisorDate = $('sigSupDate') ? $('sigSupDate').value || '' : '';
  try { tool.setValue(data); } catch (e) {}
  _selfSave = false;
  validateForm();
}

/* ---- Debounced save ---- */
function saveDebounced() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(function () {
    var data = gatherData();
    saveValue(data);
    _saveTimer = null;
  }, 400);
}

/* ---- Submit ---- */
function submitAll() {
  if (readOnly) return;
  var data = gatherData();
  if (!data.staffName) {
    tool.notify('Please enter your name before submitting.', 'warning');
    return;
  }
  var incomplete = MODS.filter(function (m) {
    return !isModuleComplete(data.modules[m.id]);
  });
  if (incomplete.length > 0) {
    tool.notify('Please complete all ' + TOTAL_MODS + ' modules before submitting.', 'warning');
    return;
  }
  var hb = data.handbookAcknowledged || {};
  if (!hb.confirmed || !(hb.initials || '').trim()) {
    tool.notify('Please acknowledge the Staff Handbook before submitting.', 'warning');
    return;
  }
  // Timestamp completed modules that don't have a date yet
  var now = new Date().toISOString();
  MODS.forEach(function (m) {
    var mod = data.modules[m.id];
    if (mod.completed && !mod.dateCompleted) {
      mod.dateCompleted = now;
    }
  });
  // Timestamp handbook
  if (data.handbookAcknowledged && data.handbookAcknowledged.confirmed && !data.handbookAcknowledged.dateAcknowledged) {
    data.handbookAcknowledged.dateAcknowledged = now;
  }
  data.submittedAt = now;
  saveValue(data);

  // Show confirmation
  $('modulesWrap').hidden = true;
  $('submitMsg').hidden = true;
  $('btnSubmit').hidden = true;
  $('resBanner').hidden = true;
  $('confirmedPanel').hidden = false;
  $('confirmedMeta').textContent = 'Submitted: ' + new Date(now).toLocaleString() + ' | Staff: ' + data.staffName;

  tool.notify('Training verification recorded. Your supervisor will review it.', 'success');
  try { tool.resize(); } catch (e) {}
}

/* ---- Resources toggle ---- */
function toggleResources() {
  var toggle = $('resToggle');
  var list = $('resList');
  var expanded = toggle.getAttribute('aria-expanded') === 'true';
  if (expanded) {
    list.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  } else {
    list.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
  }
  try { tool.resize(); } catch (e) {}
}

/* ---- Event binding ---- */
function bindEvents() {
  // Accordion headers
  document.querySelectorAll('.stv-mod-head').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var mod = this.getAttribute('data-mod');
      if (mod) toggleModule(mod);
    });
  });

  // Resources toggle
  var resToggle = $('resToggle');
  if (resToggle) resToggle.addEventListener('click', toggleResources);

  // Checkboxes - update progress
  document.querySelectorAll('.stv-cb').forEach(function (cb) {
    cb.addEventListener('change', function () {
      var data = gatherData();
      saveValue(data);
      updateProgress();
      updateSubmitState();
    });
  });

  // Initials fields (both self and supervised)
  document.querySelectorAll('.stv-init').forEach(function (inp) {
    inp.addEventListener('input', function () {
      updateProgress();
      updateSubmitState();
      saveDebounced();
    });
  });

  // Answer fields (self-study only) - debounced auto-save
  document.querySelectorAll('.stv-inp[data-q]').forEach(function (inp) {
    inp.addEventListener('input', function () {
      updateSubmitState();
      saveDebounced();
    });
  });

  // Supervised fields (date, deliveredBy) - debounced auto-save
  document.querySelectorAll('.stv-inp[data-sup="date"], .stv-inp[data-sup="deliveredBy"]').forEach(function (inp) {
    inp.addEventListener('input', function () {
      updateProgress();
      updateSubmitState();
      saveDebounced();
    });
    inp.addEventListener('change', function () {
      updateProgress();
      updateSubmitState();
      saveDebounced();
    });
  });

  // Staff name - debounced auto-save
  var nameEl = $('staffName');
  if (nameEl) {
    nameEl.addEventListener('input', function () {
      updateSubmitState();
      saveDebounced();
    });
  }

  // Date - auto-save
  var dateEl = $('trainDate');
  if (dateEl) {
    dateEl.addEventListener('change', function () {
      var data = gatherData();
      saveValue(data);
    });
  }

  // Handbook fields - update state + debounced save
  var hbConfirmed = $('hbConfirmed');
  if (hbConfirmed) {
    hbConfirmed.addEventListener('change', function () {
      updateProgress();
      updateSubmitState();
      saveDebounced();
    });
  }
  var hbInitials = $('hbInitials');
  if (hbInitials) {
    hbInitials.addEventListener('input', function () {
      updateProgress();
      updateSubmitState();
      saveDebounced();
    });
  }
  var hbDate = $('hbDate');
  if (hbDate) {
    hbDate.addEventListener('change', function () {
      saveDebounced();
    });
  }

  // Submit button
  var submitBtn = $('btnSubmit');
  if (submitBtn) {
    submitBtn.addEventListener('click', submitAll);
  }

  // Export PDF button
  var exportBtn = $('btnExportPdf');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToPDF);
  }
}

/* ---- Export PDF ---- */
function exportToPDF() {
  if (typeof tool !== 'undefined' && tool.requestExportPdf) {
    var staffName = ($('staffName').value || 'staff').trim().replace(/[^a-zA-Z0-9_-]/g, '-');
    tool.requestExportPdf({
      filename: 'training-verification-' + (staffName || 'record'),
      landscape: false
    }, function(err, file) {
      if (err) {
        tool.notify('Export failed: ' + err, 'error');
        return;
      }
      tool.notify('Document exported: ' + file.url, 'success');
      window.open(file.url, '_blank');
    });
  } else {
    window.print();
  }
}

/* ---- Current value ---- */
var currentValue = null;

/* ---- Render ---- */
function render(val) {
  if (_selfSave) return;
  currentValue = val || defaultData();
  if (!currentValue.modules) currentValue = defaultData();
  populateUI(currentValue);

  // If already submitted, show confirmed panel
  if (currentValue.submittedAt) {
    $('modulesWrap').hidden = true;
    $('submitMsg').hidden = true;
    $('btnSubmit').hidden = true;
    $('resBanner').hidden = true;
    $('confirmedPanel').hidden = false;
    $('confirmedMeta').textContent = 'Submitted: ' + new Date(currentValue.submittedAt).toLocaleString() + ' | Staff: ' + (currentValue.staffName || 'Unknown');
  }

  // Set date defaults if empty
  var todayStr;
  if (!$('trainDate').value) {
    var d = new Date();
    todayStr = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    $('trainDate').value = todayStr;
  }
  if (!$('hbDate').value) {
    if (!todayStr) { var d2 = new Date(); todayStr = d2.getFullYear() + '-' + ('0' + (d2.getMonth() + 1)).slice(-2) + '-' + ('0' + d2.getDate()).slice(-2); }
    $('hbDate').value = todayStr;
  }

  updateProgress();
  updateSubmitState();
  validateForm();
  try { tool.resize(); } catch (e) {}
}

/* ---- ENTRY POINT ---- */
tool.onReady(function (val) {
  bindEvents();
  render(val);
  if (tool.isReadOnly()) lockUI(true);

  tool.onValueChange(function (v) {
    if (_selfSave) return;
    currentValue = v;
    render(v);
  });

  tool.onReadonlyChange(function (ro) {
    lockUI(ro);
  });
});
