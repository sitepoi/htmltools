/* ── Bus Company Work Order ──
   Single work order management for bus maintenance.
   Built for UniconHub CMS HTML-tool system.

   CONFIGURABLE TYPE IDs (via tool.param):
     vehiclesTypeId       — CMS Object Type for vehicles/buses (default: vehicles-uniconbaseapps)
     staffTypeId          — CMS Object Type for staff/technicians (default: staff-uniconbaseapps)
     technicianRoleFilter — role field value to filter technicians (default: technician, empty = all)

   Admin changes these in the html-tool field settings to match the company's
   existing CMS types. The app never hardcodes a type name.
────────────────────────────────────────── */

/* ── Configurable Type ID Helpers ── */
function getVehiclesTypeId()  { return tool.param('vehiclesTypeId',       'vehicles-uniconbaseapps'); }
function getStaffTypeId()     { return tool.param('staffTypeId',          'staff-uniconbaseapps'); }
function getTechRoleFilter()  { return tool.param('technicianRoleFilter', 'technician'); }

/* ── Constants ── */
const FILE_ACCEPT = '.pdf,.docx,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.webp,.txt';
const DEFAULT_DB = {
  status: 'active',
  busId: '',
  busName: '',
  odometer: '',
  date: '',
  technician: '',
  technicianId: '',
  files: [],
  records: [],
  lockedAt: null,
  lockedBy: null,
  _theme: 'light'
};

/* ── Helpers ── */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function el(id) { return document.getElementById(id); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
function fileIcon(type) {
  if (!type) return '📄';
  if (type.includes('pdf')) return '📕';
  if (type.includes('word') || type.includes('docx')) return '📝';
  if (type.includes('sheet') || type.includes('xlsx') || type.includes('csv')) return '📊';
  if (type.includes('image')) return '🖼️';
  return '📎';
}

/* ── State ── */
let DB = JSON.parse(JSON.stringify(DEFAULT_DB));
let isReadOnly = false;
let isLocked = false;
let buses = [];           // vehicles loaded from CMS
let staffList = [];       // staff loaded from CMS (technicians)
let permittedUsers = [];  // fallback from object ACL

/* ── Persistence ── */
function persist() {
  tool.setValue(JSON.parse(JSON.stringify(DB)));
  tool.resize();
}

function isEditable() { return !isReadOnly && !isLocked; }

/* ── Theme ── */
function applyTheme(t) {
  DB._theme = t;
  document.documentElement.setAttribute('data-theme', t);
  el('theme-toggle').textContent = t === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
  applyTheme(DB._theme === 'dark' ? 'light' : 'dark');
  persist();
}

/* ── Lock / Unlock ── */
function setLocked(locked) {
  isLocked = locked;
  if (locked) {
    document.body.classList.add('locked');
    el('status-badge').textContent = '🔒 Locked';
    el('status-badge').className = 'status-badge locked';
    el('locked-info').style.display = '';
    var at = DB.lockedAt ? new Date(DB.lockedAt).toLocaleString() : 'just now';
    var by = DB.lockedBy || 'Unknown';
    el('locked-info').textContent = 'Locked ' + at + ' by ' + by;
    el('btn-lock').style.display = 'none';
  } else {
    document.body.classList.remove('locked');
    el('status-badge').textContent = '● Active';
    el('status-badge').className = 'status-badge active';
    el('locked-info').style.display = 'none';
    el('btn-lock').style.display = '';
  }
}

function lockWorkOrder() {
  el('lock-overlay').style.display = '';
  el('modal-lock').style.display = '';
}

function confirmLock() {
  DB.status = 'locked';
  DB.lockedAt = new Date().toISOString();
  var user = tool.getUser();
  DB.lockedBy = user ? user.name : 'System';
  setLocked(true);
  persist();
  tool.notify('Work order locked permanently.', 'warning');
  closeLockModal();
}

function closeLockModal() {
  el('lock-overlay').style.display = 'none';
  el('modal-lock').style.display = 'none';
}

/* ── Diagnostic helpers ── */
function _diag(title, typeId, err, result) {
  console.group('🔍 ' + title + ' — typeId: "' + typeId + '"');
  if (err) {
    console.error('❌ ERROR:', err);
    console.log('👉 This usually means the type is not in allowedObjectTypes, or the typeId is wrong.');
  } else {
    var count = (result && result.objects) ? result.objects.length : 0;
    console.log('✅ SUCCESS — ' + count + ' object(s) returned');
    if (count > 0) {
      console.log('📋 First object:');
      var first = result.objects[0];
      console.log('  id:      ', first.id);
      console.log('  name:    ', first.name);
      console.log('  slug:    ', first.slug);
      console.log('  cmsObjectType:', first.cmsObjectType);
      var pd = (first.productData && first.productData.data_categoriesBased) ? first.productData.data_categoriesBased : null;
      console.log('  productData.data_categoriesBased:', pd);
      if (pd) {
        console.log('  Available field keys:', Object.keys(pd));
      } else {
        console.warn('  ⚠️  No productData.data_categoriesBased — object may have no custom fields defined.');
      }
      console.log('📋 All objects (' + count + '):');
      result.objects.forEach(function(o, i) {
        var oPd = (o.productData && o.productData.data_categoriesBased) ? o.productData.data_categoriesBased : {};
        console.log('  [' + i + '] id=' + o.id + ' name="' + o.name + '" fields=' + JSON.stringify(Object.keys(oPd)));
      });
    } else {
      console.warn('⚠️  Empty result — no objects exist in type "' + typeId + '"');
      console.log('👉 Possible causes:');
      console.log('   1. No objects have been created in this type yet.');
      console.log('   2. The type ID is wrong (check allowedObjectTypes in field settings).');
      console.log('   3. The type is not registered in CMS Settings → App Designer.');
      console.log('   4. scope:"instance" but there are no objects scoped to this parent record.');
    }
  }
  console.groupEnd();
}

function _updateDiagVehicles() {
  var elm = document.getElementById('diag-vehicles');
  if (!elm) return;
  var typeId = getVehiclesTypeId();
  if (buses.length > 0) {
    elm.textContent = '✓ ' + buses.length + ' vehicle(s) loaded from "' + typeId + '"';
    elm.className = 'diag-info ok';
  } else {
    elm.textContent = '⚠️ 0 vehicles in "' + typeId + '" — open browser console (F12) for details';
    elm.className = 'diag-info warn';
  }
}

function _updateDiagStaff() {
  var elm = document.getElementById('diag-staff');
  if (!elm) return;
  var typeId = getStaffTypeId();
  if (staffList.length > 0) {
    elm.textContent = '✓ ' + staffList.length + ' technician(s) loaded from "' + typeId + '"';
    elm.className = 'diag-info ok';
  } else if (permittedUsers.length > 0) {
    elm.textContent = '⚠️ 0 staff in "' + typeId + '" — falling back to ' + permittedUsers.length + ' permitted user(s). Open console for details.';
    elm.className = 'diag-info warn';
  } else {
    elm.textContent = '⚠️ 0 staff in "' + typeId + '" and 0 permitted users — open browser console (F12) for details';
    elm.className = 'diag-info err';
  }
}

/* ── Vehicles (Bus) Management ── */
function loadBuses(callback) {
  if (typeof tool.requestObjects !== 'function') {
    tool.notify('Vehicle list unavailable — CMS object access not configured.', 'warning');
    _diag('Vehicles', getVehiclesTypeId(), 'tool.requestObjects is not a function', null);
    buses = [];
    if (callback) callback();
    return;
  }
  var typeId = getVehiclesTypeId();
  tool.requestObjects('query', { mainObjectType: typeId }, function(err, result) {
    _diag('Vehicles', typeId, err, result);
    if (err) {
      tool.notify('Could not load vehicle list (' + typeId + '): ' + err, 'warning');
      buses = [];
    } else {
      buses = (result && result.objects) ? result.objects : [];
      buses.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
      tool.notify('Loaded ' + buses.length + ' vehicle(s) from "' + typeId + '"', 'info');
    }
    _updateDiagVehicles();
    if (callback) callback();
  });
}

function renderBusDropdown() {
  var sel = el('bus-select');
  var currentVal = sel.value;
  sel.innerHTML = '<option value="">— Select a Vehicle —</option>';
  buses.forEach(function(b) {
    var opt = document.createElement('option');
    opt.value = b.id;
    var pd = (b.productData && b.productData.data_categoriesBased) ? b.productData.data_categoriesBased : {};
    var plate = pd.plate || pd.plateNumber || '';
    var make = pd.make || '';
    var model = pd.model || '';
    var parts = [b.name, plate, make, model].filter(Boolean);
    opt.textContent = parts.join(' — ');
    sel.appendChild(opt);
  });
  if (currentVal && buses.some(function(b) { return b.id === currentVal; })) {
    sel.value = currentVal;
  }
  sel.disabled = !isEditable();
  _updateDiagVehicles();
}

function onBusChange() {
  var busId = el('bus-select').value;
  if (!busId) {
    DB.busId = '';
    DB.busName = '';
    el('header-bus-name').textContent = 'No vehicle selected';
    persist();
    return;
  }
  var bus = buses.find(function(b) { return b.id === busId; });
  if (bus) {
    DB.busId = bus.id;
    DB.busName = bus.name;
    el('header-bus-name').textContent = bus.name;
    persist();
  }
}

function openAddBusModal() {
  el('new-bus-plate').value = '';
  el('new-bus-make').value = '';
  el('new-bus-model').value = '';
  el('new-bus-year').value = '';
  el('modal-overlay').style.display = '';
  el('modal-add-bus').style.display = '';
  setTimeout(function() { el('new-bus-plate').focus(); }, 100);
}

function closeAddBusModal() {
  el('modal-overlay').style.display = 'none';
  el('modal-add-bus').style.display = 'none';
}

function saveNewBus() {
  var plate = el('new-bus-plate').value.trim();
  if (!plate) { tool.notify('Please enter a plate or vehicle number.', 'warning'); return; }
  var make = el('new-bus-make').value.trim();
  var model = el('new-bus-model').value.trim();
  var year = el('new-bus-year').value.trim();
  var busName = plate + (make ? ' ' + make : '') + (model ? ' ' + model : '');

  if (typeof tool.requestObjects !== 'function') {
    tool.notify('Cannot create vehicle — CMS object access not configured.', 'error');
    return;
  }

  var pd = { plate: plate };
  if (make) pd.make = make;
  if (model) pd.model = model;
  if (year) pd.year = parseInt(year, 10);

  el('btn-save-bus').disabled = true;
  el('btn-save-bus').textContent = 'Saving...';

  var typeId = getVehiclesTypeId();
  tool.requestObjects('create', {
    mainObjectType: typeId,
    name: busName,
    productData: { data_categoriesBased: pd }
  }, function(err, result) {
    el('btn-save-bus').disabled = false;
    el('btn-save-bus').textContent = 'Save Vehicle';
    if (err) {
      tool.notify('Failed to create vehicle: ' + err, 'error');
      return;
    }
    tool.notify('Vehicle "' + busName + '" created.', 'success');
    closeAddBusModal();
    loadBuses(function() {
      renderBusDropdown();
      if (result && result.object) {
        el('bus-select').value = result.object.id;
        onBusChange();
      }
    });
  });
}

/* ── Staff (Technician) Management ── */
function loadStaff(callback) {
  if (typeof tool.requestObjects !== 'function') {
    staffList = [];
    if (callback) callback();
    return;
  }
  var typeId = getStaffTypeId();
  var roleFilter = getTechRoleFilter();
  tool.requestObjects('query', { mainObjectType: typeId }, function(err, result) {
    _diag('Staff', typeId, err, result);
    if (err) {
      staffList = [];
    } else {
      var all = (result && result.objects) ? result.objects : [];
      /* Filter by technician role if a filter is configured */
      if (roleFilter) {
        var before = all.length;
        staffList = all.filter(function(s) {
          var pd = (s.productData && s.productData.data_categoriesBased) ? s.productData.data_categoriesBased : {};
          var role = (pd.role || '').toLowerCase();
          return role === roleFilter.toLowerCase();
        });
        console.log('🔍 Staff role filter: "' + roleFilter + '" → kept ' + staffList.length + ' of ' + before + ' staff (filtered out ' + (before - staffList.length) + ' non-matching)');
      } else {
        staffList = all;
      }
      staffList.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
      tool.notify('Loaded ' + staffList.length + ' technician(s) from "' + typeId + '" (role filter: "' + (roleFilter || 'none') + '")', 'info');
    }
    _updateDiagStaff();
    if (callback) callback();
  });
}

/* Returns the effective list of technicians: staff from CMS first, fall back to permitted users */
function getTechnicians() {
  if (staffList.length > 0) return staffList;
  /* Fallback: convert permittedUsers to same shape as staff objects */
  return permittedUsers.map(function(u) {
    return {
      id: u.id,
      name: u.name,
      productData: { data_categoriesBased: { role: 'technician', email: u.email } }
    };
  });
}

/* ── File Management ── */
function uploadFile() {
  if (typeof tool.requestUpload !== 'function') {
    tool.notify('File upload not available — upload access not configured.', 'warning');
    return;
  }
  el('btn-upload').disabled = true;
  el('btn-upload').textContent = '⏳ Uploading...';
  tool.requestUpload(FILE_ACCEPT, function(err, file) {
    el('btn-upload').disabled = false;
    el('btn-upload').textContent = '📎 Upload File';
    if (err) {
      tool.notify('Upload failed: ' + err, 'error');
      return;
    }
    DB.files.push({
      name: file.name,
      url: file.url,
      size: file.size,
      type: file.type
    });
    tool.notify('File "' + file.name + '" uploaded.', 'success');
    persist();
    renderFiles();
  });
}

function removeFile(index) {
  var f = DB.files[index];
  DB.files.splice(index, 1);
  tool.notify('File "' + (f ? f.name : '') + '" removed.', 'info');
  persist();
  renderFiles();
}

function renderFiles() {
  var container = el('files-list');
  if (!DB.files || DB.files.length === 0) {
    container.innerHTML = '';
    return;
  }
  var html = '';
  DB.files.forEach(function(f, i) {
    html += '<div class="file-item">';
    html += '<span class="file-icon">' + fileIcon(f.type) + '</span>';
    html += '<span class="file-name"><a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a></span>';
    html += '<span class="file-size">' + fmtFileSize(f.size) + '</span>';
    if (isEditable()) {
      html += '<button class="btn-remove" onclick="removeFile(' + i + ')" title="Remove file">✕</button>';
    }
    html += '</div>';
  });
  container.innerHTML = html;
}

/* ── Records (Complaints & Solutions) ── */
function addRecord() {
  DB.records.push({
    id: genId(),
    complaint: '',
    solution: '',
    technician: '',
    technicianId: '',
    isDone: false
  });
  persist();
  renderRecords();
  tool.resize();
}

function updateRecord(index, field, value) {
  if (index < 0 || index >= DB.records.length) return;
  DB.records[index][field] = value;
  persist();
}

function deleteRecord(index) {
  if (index < 0 || index >= DB.records.length) return;
  DB.records.splice(index, 1);
  tool.notify('Record removed.', 'info');
  persist();
  renderRecords();
}

function renderRecords() {
  var tbody = el('records-tbody');
  var empty = el('records-empty');
  var count = el('records-count');

  count.textContent = DB.records.length + ' record' + (DB.records.length !== 1 ? 's' : '');

  if (DB.records.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = '';
    el('records-table').style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  el('records-table').style.display = '';

  var techs = getTechnicians();
  var html = '';
  DB.records.forEach(function(r, i) {
    var rowClass = r.isDone ? ' row-done' : '';
    html += '<tr class="' + rowClass + '">';
    html += '<td class="col-num">' + (i + 1) + '</td>';
    html += '<td><input type="text" class="table-input" value="' + esc(r.complaint) + '" placeholder="Describe the complaint..." onchange="updateRecord(' + i + ',\'complaint\',this.value)"' + (isEditable() ? '' : ' readonly') + '></td>';
    html += '<td><input type="text" class="table-input" value="' + esc(r.solution) + '" placeholder="Solution applied..." onchange="updateRecord(' + i + ',\'solution\',this.value)"' + (isEditable() ? '' : ' readonly') + '></td>';
    html += '<td><select class="table-select" onchange="updateRecord(' + i + ',\'technician\',this.value);updateRecord(' + i + ',\'technicianId\',this.selectedOptions[0]?this.selectedOptions[0].dataset.staffid||\'\':\'\')"' + (isEditable() ? '' : ' disabled') + '>';
    html += '<option value="">—</option>';
    techs.forEach(function(t) {
      var sel = (r.technicianId === t.id || r.technician === t.name) ? ' selected' : '';
      html += '<option value="' + esc(t.name) + '" data-staffid="' + esc(t.id) + '"' + sel + '>' + esc(t.name) + '</option>';
    });
    html += '</select></td>';
    html += '<td class="col-done"><input type="checkbox" class="done-checkbox"' + (r.isDone ? ' checked' : '') + (isEditable() ? ' onchange="updateRecord(' + i + ',\'isDone\',this.checked);renderRecords()"' : ' disabled') + '></td>';
    html += '<td class="col-actions">';
    if (isEditable()) {
      html += '<button class="btn-delete-row" onclick="deleteRecord(' + i + ')" title="Delete record">🗑️</button>';
    }
    html += '</td>';
    html += '</tr>';
  });
  tbody.innerHTML = html;
}

/* ── General Info Handlers ── */
function onOdometerChange() {
  DB.odometer = el('odometer').value;
  persist();
}
function onDateChange() {
  DB.date = el('work-date').value;
  persist();
}
function onTechnicianChange() {
  var sel = el('technician-select');
  DB.technician = sel.value;
  DB.technicianId = sel.selectedOptions[0] ? (sel.selectedOptions[0].dataset.staffid || '') : '';
  persist();
}

function renderTechnicianDropdowns() {
  /* Main technician dropdown — uses staff list, falls back to permitted users */
  var techs = getTechnicians();
  var sel = el('technician-select');
  var curVal = sel.value;
  sel.innerHTML = '<option value="">— Select Technician —</option>';
  techs.forEach(function(t) {
    var opt = document.createElement('option');
    opt.value = t.name;
    opt.dataset.staffid = t.id;
    opt.textContent = t.name;
    sel.appendChild(opt);
  });
  if (curVal) sel.value = curVal;
  sel.disabled = !isEditable();

  /* Also re-render records to update per-row technician dropdowns */
  renderRecords();
  _updateDiagStaff();
}

/* ── Main Render ── */
function render(val) {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    DB = Object.assign(JSON.parse(JSON.stringify(DEFAULT_DB)), val);
  }

  /* Ensure defaults for missing fields */
  if (!DB.files) DB.files = [];
  if (!DB.records) DB.records = [];
  if (!DB.status) DB.status = 'active';

  /* Determine locked state */
  isLocked = (DB.status === 'locked');
  setLocked(isLocked);

  /* Apply theme */
  applyTheme(DB._theme || 'light');

  /* Populate fields */
  renderBusDropdown();
  el('bus-select').value = DB.busId || '';
  el('header-bus-name').textContent = DB.busName || 'No vehicle selected';
  el('odometer').value = DB.odometer || '';
  el('work-date').value = DB.date || todayStr();
  if (!DB.date) { DB.date = todayStr(); persist(); }

  renderTechnicianDropdowns();
  el('technician-select').value = DB.technician || '';

  renderFiles();
  renderRecords();

  /* Read-only state for inputs */
  el('odometer').readOnly = !isEditable();
  el('work-date').readOnly = !isEditable();
  el('bus-select').disabled = !isEditable();
  el('btn-refresh-buses').style.display = isEditable() ? '' : 'none';
  el('btn-add-bus').style.display = isEditable() ? '' : 'none';
  el('btn-upload').style.display = isEditable() ? '' : 'none';
  el('btn-add-record').style.display = isEditable() ? '' : 'none';
  el('btn-lock').style.display = isEditable() && !isLocked ? '' : 'none';

  tool.resize();
}

/* ── Read-Only Toggle ── */
function lockUI(ro) {
  isReadOnly = ro;
  render(DB);
}

/* ── Bootstrap ── */
tool.onReady(function(val, fields) {

  /* ── Declare admin-configurable parameters ── */
  if (typeof tool.declareParams === 'function') {
    tool.declareParams([
      {
        name: 'vehiclesTypeId',
        label: 'Vehicles CMS Object Type ID',
        type: 'text',
        default: 'vehicles-uniconbaseapps',
        hint: 'mainObjectType for the vehicles/buses fleet. Change this to match the company\'s existing vehicle type (e.g. buses-companya, fleet-custom).'
      },
      {
        name: 'staffTypeId',
        label: 'Staff CMS Object Type ID',
        type: 'text',
        default: 'staff-uniconbaseapps',
        hint: 'mainObjectType for staff records. Used to populate technician dropdowns. Change to match the company\'s staff type.'
      },
      {
        name: 'technicianRoleFilter',
        label: 'Technician Role Filter',
        type: 'text',
        default: 'technician',
        hint: 'Value of the "role" field on staff objects that identifies technicians. Leave empty to show all staff.'
      }
    ]);
  }

  /* ── Report missing required parameters ── */
  if (typeof tool.reportMissingParams === 'function') {
    var missing = [];
    var vType = tool.param('vehiclesTypeId');       /* no fallback — check if configured */
    var sType = tool.param('staffTypeId');
    var roleF  = tool.param('technicianRoleFilter');

    if (!vType) {
      missing.push({
        name: 'vehiclesTypeId',
        label: 'Vehicles CMS Object Type ID',
        type: 'text',
        default: 'vehicles-uniconbaseapps',
        hint: 'CMS object type that holds vehicle/bus records (e.g. vehicles-uniconbaseapps, buses-companya)',
        reason: 'Cannot load the vehicle dropdown list without a vehicles type ID. The work order cannot be assigned to a vehicle.'
      });
    }
    if (!sType) {
      missing.push({
        name: 'staffTypeId',
        label: 'Staff CMS Object Type ID',
        type: 'text',
        default: 'staff-uniconbaseapps',
        hint: 'CMS object type that holds staff records with a "role" field (e.g. staff-uniconbaseapps, employees-customc)',
        reason: 'Cannot load the technician dropdown list without a staff type ID. Technicians cannot be assigned to records.'
      });
    }
    /* technicianRoleFilter is optional — it has a sensible default, so only warn if explicitly empty */
    if (roleF === '') {
      missing.push({
        name: 'technicianRoleFilter',
        label: 'Technician Role Filter',
        type: 'text',
        default: 'technician',
        hint: 'The "role" field value that identifies a staff member as a technician. Leave empty to show all staff, or set to e.g. "mechanic".',
        reason: 'The role filter is empty, which means ALL staff will appear in technician dropdowns — including supervisors, drivers, etc. Set this to filter properly.'
      });
    }
    if (missing.length > 0) {
      tool.reportMissingParams(missing,
        'This tool needs ' + missing.length + ' parameter(s) configured before it can load vehicle and technician data. Click "Configure" below to set them up.');
    }
  }

  /* ── Declare output schema ── */
  if (typeof tool.declareOutput === 'function') {
    tool.declareOutput({
      type: 'object',
      properties: {
        status:     { type: 'string', enum: ['active', 'locked'] },
        busId:      { type: 'string', description: 'Selected vehicle CMS object ID' },
        busName:    { type: 'string', description: 'Selected vehicle display name' },
        odometer:   { type: 'string', description: 'Odometer reading in km' },
        date:       { type: 'string', description: 'Work order date (ISO)' },
        technician: { type: 'string', description: 'Assigned technician name' },
        technicianId: { type: 'string', description: 'Assigned technician staff ID' },
        files:      { type: 'array',  description: 'Uploaded file attachments' },
        records:    { type: 'array',  description: 'Complaints & solutions records' },
        lockedAt:   { type: 'string', description: 'ISO timestamp when locked' },
        lockedBy:   { type: 'string', description: 'User who locked the work order' }
      }
    });
  }

  /* Load permitted users (fallback for technicians) */
  var users = tool.getPermittedUsers ? tool.getPermittedUsers() : [];
  permittedUsers = Array.isArray(users) ? users : [];

  /* Load both vehicles and staff, then render */
  var pending = 2;
  function onDataLoaded() {
    pending--;
    if (pending === 0) {
      render(val);
      if (tool.isReadOnly()) lockUI(true);
    }
  }
  loadBuses(onDataLoaded);
  loadStaff(onDataLoaded);

  /* Listeners */
  tool.onValueChange(function(v) { render(v); });
  tool.onFieldsChange(function(f) { /* react to sibling field changes if needed */ });
  tool.onReadonlyChange(function(ro) { lockUI(ro); });
  tool.onUserChange(function(user) { /* user session changed */ });
  tool.onPermittedUsersChange(function(users) {
    permittedUsers = Array.isArray(users) ? users : [];
    /* Only rebuild dropdowns if we're in fallback mode (no staff loaded) */
    if (staffList.length === 0) renderTechnicianDropdowns();
  });
});
