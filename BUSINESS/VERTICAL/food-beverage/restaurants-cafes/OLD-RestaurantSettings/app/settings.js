/* ===== DEFAULT SETTINGS ===== */
var DEFAULTS = {
  service_toggles: {
    pickup_enabled: false,
    delivery_enabled: false,
    on_premise_enabled: false,
    anonymous_ordering_allowed: false,
    table_reservation_enabled: false
  },
  opening_hours: [
    { day: 0, ranges: [{ open: '11:00', close: '21:00' }], is_closed: false },
    { day: 1, ranges: [{ open: '11:00', close: '21:00' }], is_closed: false },
    { day: 2, ranges: [{ open: '11:00', close: '21:00' }], is_closed: false },
    { day: 3, ranges: [{ open: '11:00', close: '21:00' }], is_closed: false },
    { day: 4, ranges: [{ open: '11:00', close: '21:00' }], is_closed: false },
    { day: 5, ranges: [{ open: '11:00', close: '21:00' }], is_closed: false },
    { day: 6, ranges: [{ open: '11:00', close: '21:00' }], is_closed: false }
  ],
  temporary_closure: null,
  special_hours: [],
  scheduled_orders: {
    enabled: false,
    pickup_min_advance: 30,
    pickup_max_advance: 1440,
    delivery_min_advance: 45,
    delivery_max_advance: 1440,
    time_slot_interval: 15
  },
  reservation_settings: {
    min_guests: 1,
    max_guests: 10,
    min_advance_hours: 1,
    max_advance_hours: 720,
    late_hold_minutes: 15,
    pre_order_enabled: false,
    deposit_enabled: false,
    deposit_amount: 0
  },
  taxation_currency: {
    currency: 'USD',
    tax_mode: 'exclusive',
    tax_name: 'Tax',
    tax_categories: [],
    delivery_fee_tax_rate: 0
  },
  payment_methods: {
    cash_delivery: true,
    cash_pickup: true,
    card_delivery: true,
    card_pickup: true,
    call_for_card_delivery: false,
    call_for_card_pickup: false,
    online_payment: false
  },
  alert_settings: { failed_push_alert: false, sound: 'default', supervisor_phone: '' },
  social_links: {
    facebook_url: '',
    smart_menu_link: 'https://menu.your-restaurant.com',
    website_enabled: false,
    website_domain: '',
    ios_app_enabled: false,
    android_app_enabled: false
  },
  device_connections: []
};

var DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
var DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

var settings = {};
var editingDayIndex = -1;

/* ===== DEEP MERGE HELPER ===== */
function deepMerge(target, source) {
  var output = JSON.parse(JSON.stringify(target));
  for (var key in source) {
    if (source.hasOwnProperty(key)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        output[key] = deepMerge(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    }
  }
  return output;
}

/* ===== GET/SET NESTED VALUE ===== */
function getNested(obj, path) {
  return path.split('.').reduce(function(o, k) { return o && o[k] !== undefined ? o[k] : undefined; }, obj);
}

function setNested(obj, path, value) {
  var keys = path.split('.');
  var last = keys.pop();
  var target = keys.reduce(function(o, k) {
    if (!o[k] || typeof o[k] !== 'object') o[k] = {};
    return o[k];
  }, obj);
  target[last] = value;
}

/* ===== SAVE ===== */
var saveTimeout = null;
function scheduleSave() {
  clearTimeout(saveTimeout);
  var statusEl = document.getElementById('save-status');
  if (statusEl) statusEl.textContent = 'Unsaved changes...';
  saveTimeout = setTimeout(function() {
    tool.setValue(JSON.parse(JSON.stringify(settings)));
    if (statusEl) statusEl.textContent = 'All changes saved';
  }, 400);
}

function saveNow() {
  clearTimeout(saveTimeout);
  tool.setValue(JSON.parse(JSON.stringify(settings)));
  var statusEl = document.getElementById('save-status');
  if (statusEl) statusEl.textContent = 'All changes saved';
  tool.notify('Settings saved successfully', 'success');
}

/* ===== ACCORDION ===== */
function initAccordions() {
  var headers = document.querySelectorAll('.accordion-header');
  headers.forEach(function(header) {
    header.addEventListener('click', function() {
      var section = header.dataset.section;
      var body = document.querySelector('.accordion-body[data-section="' + section + '"]');
      var isOpen = body.classList.contains('open');
      body.classList.toggle('open');
      header.classList.toggle('active');
      tool.resize();
    });
  });
}

/* ===== TOGGLE SWITCH HANDLERS ===== */
function initToggles() {
  document.querySelectorAll('.switch input[type="checkbox"]').forEach(function(input) {
    input.addEventListener('change', function() {
      var key = input.dataset.key;
      if (key) {
        setNested(settings, key, input.checked);
        scheduleSave();
        handleConditionalDisplays();
      }
    });
  });
}

/* ===== INPUT/CHANGE HANDLERS ===== */
function initInputs() {
  document.querySelectorAll('.form-input[data-key]').forEach(function(input) {
    if (input.type === 'checkbox') return; /* handled by toggle */
    var eventType = (input.tagName === 'SELECT' || input.type === 'radio') ? 'change' : 'input';
    input.addEventListener(eventType, function() {
      var key = input.dataset.key;
      var value;
      if (input.type === 'number') {
        value = parseFloat(input.value) || 0;
      } else if (input.type === 'radio') {
        if (input.checked) {
          value = input.value;
        } else {
          return;
        }
      } else {
        value = input.value;
      }
      if (key) {
        setNested(settings, key, value);
        scheduleSave();
        handleConditionalDisplays();
      }
    });
  });
}

/* ===== CONDITIONAL DISPLAYS ===== */
function handleConditionalDisplays() {
  /* Section 1: anonymous ordering sub-toggle */
  var onPremise = document.getElementById('on_premise_enabled');
  var anonRow = document.getElementById('anon-ordering-row');
  if (onPremise && anonRow) {
    anonRow.style.display = onPremise.checked ? '' : 'none';
  }

  /* Section 5: reservation */
  var reservationToggle = document.getElementById('table_reservation_enabled');
  var reservationAccordion = document.getElementById('reservation-accordion');
  if (reservationToggle && reservationAccordion) {
    reservationAccordion.style.display = reservationToggle.checked ? '' : 'none';
  }

  /* Section 4: scheduled orders */
  var scheduledToggle = document.getElementById('scheduled_enabled');
  var scheduledCond = document.getElementById('scheduled-conditional');
  if (scheduledToggle && scheduledCond) {
    scheduledCond.style.display = scheduledToggle.checked ? '' : 'none';
  }

  /* Section 5: deposit amount */
  var depositToggle = document.getElementById('deposit_enabled');
  var depositRow = document.getElementById('deposit-amount-row');
  if (depositToggle && depositRow) {
    depositRow.style.display = depositToggle.checked ? '' : 'none';
  }

  /* Section 9: website domain */
  var websiteToggle = document.getElementById('website_enabled');
  var websiteRow = document.getElementById('website-domain-row');
  if (websiteToggle && websiteRow) {
    websiteRow.style.display = websiteToggle.checked ? '' : 'none';
  }

  tool.resize();
}

/* ===== POPULATE FORM FROM SETTINGS ===== */
function populateForm() {
  /* Toggles */
  document.querySelectorAll('.switch input[type="checkbox"][data-key]').forEach(function(input) {
    var val = getNested(settings, input.dataset.key);
    input.checked = !!val;
  });

  /* Text/number/select inputs */
  document.querySelectorAll('.form-input[data-key]').forEach(function(input) {
    if (input.type === 'checkbox') return;
    var val = getNested(settings, input.dataset.key);
    if (val !== undefined) {
      if (input.type === 'radio') {
        input.checked = (input.value === String(val));
      } else if (input.tagName === 'SELECT') {
        input.value = val;
      } else {
        input.value = val;
      }
    }
  });

  /* Render sub-sections */
  renderOpeningHours();
  renderBulkDayPicker();
  renderTemporaryClosure();
  renderSpecialHours();
  renderTaxCategories();
  renderDevices();
  handleConditionalDisplays();
}

/* ===== SECTION 2: OPENING HOURS ===== */
function renderOpeningHours() {
  var grid = document.getElementById('hours-grid');
  if (!grid) return;
  grid.innerHTML = '';

  (settings.opening_hours || []).forEach(function(dayData, idx) {
    var dayEl = document.createElement('div');
    dayEl.className = 'hours-day' + (dayData.is_closed ? ' closed' : '');
    dayEl.dataset.dayIndex = idx;

    var nameEl = document.createElement('div');
    nameEl.className = 'hours-day-name';
    nameEl.textContent = DAY_NAMES[idx] || ('Day ' + idx);

    var rangesEl = document.createElement('div');
    rangesEl.className = 'hours-day-ranges';

    if (dayData.is_closed) {
      var closedLabel = document.createElement('div');
      closedLabel.className = 'hours-day-closed-label';
      closedLabel.textContent = 'Closed';
      rangesEl.appendChild(closedLabel);
    } else if (dayData.ranges && dayData.ranges.length > 0) {
      dayData.ranges.forEach(function(r) {
        var span = document.createElement('div');
        span.textContent = (r.open || '--:--') + ' - ' + (r.close || '--:--');
        rangesEl.appendChild(span);
      });
    } else {
      var emptySpan = document.createElement('div');
      emptySpan.textContent = 'No hours';
      emptySpan.style.color = '#9ca3af';
      rangesEl.appendChild(emptySpan);
    }

    dayEl.appendChild(nameEl);
    dayEl.appendChild(rangesEl);

    dayEl.addEventListener('click', function() {
      openTimeEditor(idx);
    });

    grid.appendChild(dayEl);
  });
}

function openTimeEditor(dayIndex) {
  editingDayIndex = dayIndex;
  var dayData = settings.opening_hours[dayIndex];
  var editor = document.getElementById('time-editor');
  var title = document.getElementById('time-editor-title');
  var container = document.getElementById('time-ranges-container');

  if (!editor || !title || !container) return;

  title.textContent = 'Edit Hours — ' + DAY_NAMES_FULL[dayIndex];
  container.innerHTML = '';

  if (dayData.ranges && dayData.ranges.length > 0) {
    dayData.ranges.forEach(function(r, ri) {
      addTimeRangeRow(container, r.open || '11:00', r.close || '21:00', ri);
    });
  } else {
    addTimeRangeRow(container, '11:00', '21:00', 0);
  }

  /* Closed toggle */
  var existingClosed = container.querySelector('.closed-toggle-row');
  if (existingClosed) existingClosed.remove();
  var closedRow = document.createElement('div');
  closedRow.className = 'closed-toggle-row';
  var closedCheck = document.createElement('input');
  closedCheck.type = 'checkbox';
  closedCheck.id = 'time-editor-closed';
  closedCheck.checked = dayData.is_closed;
  var closedLabel = document.createElement('label');
  closedLabel.htmlFor = 'time-editor-closed';
  closedLabel.textContent = 'Closed all day';
  closedRow.appendChild(closedCheck);
  closedRow.appendChild(closedLabel);
  container.appendChild(closedRow);

  /* Disable ranges if closed */
  var rangeRows = container.querySelectorAll('.time-range-row');
  function toggleRangeInputs() {
    rangeRows.forEach(function(row) {
      row.style.opacity = closedCheck.checked ? '0.4' : '1';
      row.querySelectorAll('input').forEach(function(inp) { inp.disabled = closedCheck.checked; });
    });
  }
  closedCheck.addEventListener('change', toggleRangeInputs);
  toggleRangeInputs();

  editor.style.display = '';
  tool.resize();
}

function addTimeRangeRow(container, openVal, closeVal, index) {
  var row = document.createElement('div');
  row.className = 'time-range-row';

  var openInput = document.createElement('input');
  openInput.type = 'time';
  openInput.value = openVal || '11:00';

  var sep = document.createElement('span');
  sep.textContent = 'to';

  var closeInput = document.createElement('input');
  closeInput.type = 'time';
  closeInput.value = closeVal || '21:00';

  var removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn btn-ghost btn-sm';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', function() {
    if (container.querySelectorAll('.time-range-row').length <= 1) return;
    row.remove();
    tool.resize();
  });

  row.appendChild(openInput);
  row.appendChild(sep);
  row.appendChild(closeInput);
  row.appendChild(removeBtn);
  container.appendChild(row);
}

function saveTimeRanges() {
  if (editingDayIndex < 0) return;
  var container = document.getElementById('time-ranges-container');
  var closedCheck = document.getElementById('time-editor-closed');
  if (!container) return;

  var rows = container.querySelectorAll('.time-range-row');
  var ranges = [];
  rows.forEach(function(row) {
    var inputs = row.querySelectorAll('input[type="time"]');
    if (inputs.length >= 2) {
      ranges.push({ open: inputs[0].value, close: inputs[1].value });
    }
  });

  settings.opening_hours[editingDayIndex].ranges = ranges;
  settings.opening_hours[editingDayIndex].is_closed = closedCheck ? closedCheck.checked : false;

  document.getElementById('time-editor').style.display = 'none';
  editingDayIndex = -1;
  renderOpeningHours();
  scheduleSave();
  tool.resize();
}

/* ===== SECTION 2b: BULK HOURS CHANGE ===== */
function renderBulkDayPicker() {
  var wrap = document.getElementById('bulk-hours-days');
  if (!wrap) return;
  wrap.innerHTML = '';
  DAY_NAMES.forEach(function (name, idx) {
    var label = document.createElement('label');
    label.className = 'bulk-day-chip';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.bulkDay = String(idx);
    cb.addEventListener('change', function () {
      label.classList.toggle('active', cb.checked);
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + name));
    wrap.appendChild(label);
  });
  var openInput = document.getElementById('bulk-open');
  var closeInput = document.getElementById('bulk-close');
  if (openInput && !openInput.value) openInput.value = '11:00';
  if (closeInput && !closeInput.value) closeInput.value = '21:00';
}

function applyBulkHours() {
  var openVal = document.getElementById('bulk-open').value;
  var closeVal = document.getElementById('bulk-close').value;
  if (!openVal || !closeVal) { tool.notify('Set both open and close times', 'warning'); return; }
  var checkedDays = [];
  document.querySelectorAll('#bulk-hours-days input[data-bulk-day]').forEach(function (cb) {
    if (cb.checked) checkedDays.push(parseInt(cb.dataset.bulkDay, 10));
  });
  if (checkedDays.length === 0) { tool.notify('Tick at least one day', 'warning'); return; }
  checkedDays.forEach(function (idx) {
    settings.opening_hours[idx].ranges = [{ open: openVal, close: closeVal }];
    settings.opening_hours[idx].is_closed = false;
  });
  renderOpeningHours();
  scheduleSave();
  tool.notify('Hours applied to ' + checkedDays.length + ' day(s)', 'success');
}

/* ===== SECTION 2c: TEMPORARY CLOSURE ===== */
function todayIsoDate() {
  var now = new Date();
  var month = String(now.getMonth() + 1).padStart(2, '0');
  var day = String(now.getDate()).padStart(2, '0');
  return now.getFullYear() + '-' + month + '-' + day;
}

function renderTemporaryClosure() {
  var toggle = document.getElementById('temp-closure-enabled');
  var fields = document.getElementById('temp-closure-fields');
  var dateInput = document.getElementById('temp-closure-date');
  var reasonInput = document.getElementById('temp-closure-reason');
  var statusEl = document.getElementById('temp-closure-status');
  if (!toggle || !fields || !dateInput || !reasonInput) return;
  var closure = settings.temporary_closure;
  var isOn = !!(closure && closure.date);
  toggle.checked = isOn;
  dateInput.value = isOn ? closure.date : todayIsoDate();
  reasonInput.value = closure && closure.reason ? closure.reason : '';
  fields.style.display = isOn ? '' : 'none';
  if (statusEl) {
    statusEl.textContent = isOn
      ? ('The restaurant is closed for ordering on ' + closure.date + '.')
      : '';
    statusEl.style.display = isOn ? '' : 'none';
  }
}

function updateTemporaryClosure() {
  var toggle = document.getElementById('temp-closure-enabled');
  var dateInput = document.getElementById('temp-closure-date');
  var reasonInput = document.getElementById('temp-closure-reason');
  if (!toggle || !dateInput || !reasonInput) return;
  if (toggle.checked) {
    settings.temporary_closure = {
      date: dateInput.value || todayIsoDate(),
      reason: reasonInput.value.trim()
    };
  } else {
    settings.temporary_closure = null;
  }
  renderTemporaryClosure();
  scheduleSave();
}

/* ===== SECTION 2d: SPECIAL HOURS BY DATE ===== */
function renderSpecialHours() {
  var list = document.getElementById('special-hours-list');
  if (!list) return;
  list.innerHTML = '';
  var entries = settings.special_hours || [];
  if (entries.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'special-hours-empty';
    empty.textContent = 'No special dates yet.';
    list.appendChild(empty);
    return;
  }
  entries.forEach(function (entry, idx) {
    var row = document.createElement('div');
    row.className = 'special-hours-row';

    var dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'form-input';
    dateInput.value = entry.date || todayIsoDate();
    dateInput.addEventListener('change', function () {
      settings.special_hours[idx].date = dateInput.value;
      scheduleSave();
    });

    var closedLabel = document.createElement('label');
    closedLabel.className = 'special-hours-closed';
    var closedCheck = document.createElement('input');
    closedCheck.type = 'checkbox';
    closedCheck.checked = !!entry.is_closed;
    closedLabel.appendChild(closedCheck);
    closedLabel.appendChild(document.createTextNode(' Closed'));

    var openInput = document.createElement('input');
    openInput.type = 'time';
    openInput.className = 'form-input';
    var firstRange = (entry.ranges && entry.ranges[0]) || { open: '11:00', close: '21:00' };
    openInput.value = firstRange.open || '11:00';

    var closeInput = document.createElement('input');
    closeInput.type = 'time';
    closeInput.className = 'form-input';
    closeInput.value = firstRange.close || '21:00';

    function syncDisabled() {
      openInput.disabled = closedCheck.checked;
      closeInput.disabled = closedCheck.checked;
    }
    syncDisabled();

    closedCheck.addEventListener('change', function () {
      settings.special_hours[idx].is_closed = closedCheck.checked;
      if (closedCheck.checked) settings.special_hours[idx].ranges = [];
      else settings.special_hours[idx].ranges = [{ open: openInput.value || '11:00', close: closeInput.value || '21:00' }];
      syncDisabled();
      scheduleSave();
    });
    openInput.addEventListener('change', function () {
      settings.special_hours[idx].ranges = [{ open: openInput.value, close: closeInput.value }];
      scheduleSave();
    });
    closeInput.addEventListener('change', function () {
      settings.special_hours[idx].ranges = [{ open: openInput.value, close: closeInput.value }];
      scheduleSave();
    });

    var noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.className = 'form-input';
    noteInput.placeholder = 'Note (e.g. Christmas Eve)';
    noteInput.value = entry.note || '';
    noteInput.addEventListener('input', function () {
      settings.special_hours[idx].note = noteInput.value;
      scheduleSave();
    });

    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-ghost btn-sm';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', function () {
      settings.special_hours.splice(idx, 1);
      renderSpecialHours();
      scheduleSave();
    });

    row.appendChild(dateInput);
    row.appendChild(closedLabel);
    row.appendChild(openInput);
    row.appendChild(closeInput);
    row.appendChild(noteInput);
    row.appendChild(delBtn);
    list.appendChild(row);
  });
}

function addSpecialHour() {
  if (!settings.special_hours) settings.special_hours = [];
  var nextDate = todayIsoDate();
  settings.special_hours.push({
    id: 'sh-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    date: nextDate,
    is_closed: false,
    ranges: [{ open: '11:00', close: '21:00' }],
    note: ''
  });
  renderSpecialHours();
  scheduleSave();
}

/* ===== SECTION 6: TAX CATEGORIES ===== */
function renderTaxCategories() {
  var tbody = document.getElementById('tax-categories-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  var categories = settings.taxation_currency.tax_categories || [];
  if (categories.length === 0) {
    var tr = document.createElement('tr');
    tr.className = 'empty-row';
    var td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = 'No tax categories defined';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  categories.forEach(function(cat, idx) {
    var tr = document.createElement('tr');

    var nameTd = document.createElement('td');
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = cat.name || '';
    nameInput.style.width = '100%';
    nameInput.addEventListener('input', (function(i) { return function() {
      settings.taxation_currency.tax_categories[i].name = this.value;
      scheduleSave();
    }; })(idx));
    nameTd.appendChild(nameInput);
    tr.appendChild(nameTd);

    ['pickup', 'delivery', 'in_restaurant'].forEach(function(rateType) {
      var td = document.createElement('td');
      var inp = document.createElement('input');
      inp.type = 'number';
      inp.min = '0';
      inp.max = '100';
      inp.step = '0.01';
      inp.value = cat[rateType] !== undefined ? cat[rateType] : 0;
      inp.addEventListener('input', (function(i, rt) { return function() {
        settings.taxation_currency.tax_categories[i][rt] = parseFloat(this.value) || 0;
        scheduleSave();
      }; })(idx, rateType));
      td.appendChild(inp);
      tr.appendChild(td);
    });

    var zeroTd = document.createElement('td');
    var zeroCheck = document.createElement('input');
    zeroCheck.type = 'checkbox';
    zeroCheck.checked = (cat.pickup === 0 && cat.delivery === 0 && cat.in_restaurant === 0);
    zeroCheck.addEventListener('change', (function(i) { return function() {
      if (this.checked) {
        settings.taxation_currency.tax_categories[i].pickup = 0;
        settings.taxation_currency.tax_categories[i].delivery = 0;
        settings.taxation_currency.tax_categories[i].in_restaurant = 0;
      }
      renderTaxCategories();
      scheduleSave();
    }; })(idx));
    zeroCheck.style.width = 'auto';
    zeroTd.appendChild(zeroCheck);
    tr.appendChild(zeroTd);

    var delTd = document.createElement('td');
    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-ghost btn-sm';
    delBtn.style.color = '#ef4444';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', (function(i) { return function() {
      settings.taxation_currency.tax_categories.splice(i, 1);
      renderTaxCategories();
      scheduleSave();
    }; })(idx));
    delTd.appendChild(delBtn);
    tr.appendChild(delTd);

    tbody.appendChild(tr);
  });
}

function addTaxCategory() {
  if (!settings.taxation_currency.tax_categories) settings.taxation_currency.tax_categories = [];
  settings.taxation_currency.tax_categories.push({ name: '', pickup: 0, delivery: 0, in_restaurant: 0 });
  renderTaxCategories();
  scheduleSave();
  tool.resize();
}

/* ===== SECTION 10: DEVICE CONNECTIONS ===== */
function renderDevices() {
  var tbody = document.getElementById('devices-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  var devices = settings.device_connections || [];
  if (devices.length === 0) {
    var tr = document.createElement('tr');
    tr.className = 'empty-row';
    var td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = 'No devices connected yet';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  devices.forEach(function(dev, idx) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + escapeHtml(dev.platform || '-') + '</td>' +
      '<td>' + escapeHtml(dev.os || '-') + '</td>' +
      '<td><code style="font-size:11px;">' + escapeHtml(dev.device_id || '-') + '</code></td>' +
      '<td>' + escapeHtml(dev.app_version || '-') + '</td>' +
      '<td>' + escapeHtml(dev.last_check || '-') + '</td>' +
      '<td><button type="button" class="btn btn-ghost btn-sm" data-remove-device="' + idx + '" style="color:#ef4444;">✕</button></td>';
    tbody.appendChild(tr);
  });

  /* Attach remove listeners */
  tbody.querySelectorAll('[data-remove-device]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var idx = parseInt(btn.dataset.removeDevice);
      settings.device_connections.splice(idx, 1);
      renderDevices();
      scheduleSave();
    });
  });
}

function connectDevice() {
  var platform = document.getElementById('new-device-platform').value;
  var deviceId = document.getElementById('new-device-id').value.trim();
  if (!deviceId) { tool.notify('Please enter a device ID', 'warning'); return; }

  if (!settings.device_connections) settings.device_connections = [];
  settings.device_connections.push({
    platform: platform,
    os: 'N/A',
    device_id: deviceId,
    app_version: 'N/A',
    last_check: 'Just now'
  });

  document.getElementById('new-device-id').value = '';
  document.getElementById('device-connect-panel').style.display = 'none';
  renderDevices();
  scheduleSave();
  tool.notify('Device connected', 'success');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ===== READ-ONLY MODE ===== */
function lockUI(isReadOnly) {
  var interactive = document.querySelectorAll('input, select, textarea, button, .switch');
  interactive.forEach(function(el) {
    if (isReadOnly) {
      el.setAttribute('disabled', 'disabled');
      el.style.pointerEvents = 'none';
    } else {
      el.removeAttribute('disabled');
      el.style.pointerEvents = '';
    }
  });
  var saveBar = document.getElementById('save-bar');
  if (saveBar) saveBar.style.display = isReadOnly ? 'none' : '';
}

/* ===== MAIN RENDER ===== */
function render(value, fields) {
  /* Merge incoming value with defaults */
  var incoming = value;
  if (incoming === null || incoming === undefined || (typeof incoming === 'object' && Object.keys(incoming).length === 0)) {
    incoming = {};
  }
  settings = deepMerge(DEFAULTS, incoming);

  /* Ensure arrays are present */
  if (!settings.opening_hours || !Array.isArray(settings.opening_hours) || settings.opening_hours.length < 7) {
    settings.opening_hours = DEFAULTS.opening_hours;
  }
  if (!settings.taxation_currency.tax_categories) settings.taxation_currency.tax_categories = [];
  if (!settings.device_connections) settings.device_connections = [];
  populateForm();
  tool.resize();
}

function syncFields(fields) {
  /* React to sibling field changes if needed */
}

/* ===== INIT ===== */
function initEventDelegation() {
  /* Add time range button */
  var addRangeBtn = document.getElementById('add-time-range');
  if (addRangeBtn) {
    addRangeBtn.addEventListener('click', function() {
      var container = document.getElementById('time-ranges-container');
      if (container) addTimeRangeRow(container, '11:00', '21:00', container.querySelectorAll('.time-range-row').length);
    });
  }

  /* Save time ranges */
  var saveRangesBtn = document.getElementById('save-time-ranges');
  if (saveRangesBtn) saveRangesBtn.addEventListener('click', saveTimeRanges);

  /* Close time editor */
  var closeEditorBtn = document.getElementById('time-editor-close');
  if (closeEditorBtn) {
    closeEditorBtn.addEventListener('click', function() {
      document.getElementById('time-editor').style.display = 'none';
      editingDayIndex = -1;
      tool.resize();
    });
  }

  /* Save all button */
  var saveAllBtn = document.getElementById('save-all-btn');
  if (saveAllBtn) saveAllBtn.addEventListener('click', saveNow);

  /* Bulk hours change */
  var bulkApplyBtn = document.getElementById('bulk-hours-apply');
  if (bulkApplyBtn) bulkApplyBtn.addEventListener('click', applyBulkHours);

  /* Temporary closure */
  var closureToggle = document.getElementById('temp-closure-enabled');
  if (closureToggle) closureToggle.addEventListener('change', updateTemporaryClosure);
  var closureDate = document.getElementById('temp-closure-date');
  if (closureDate) closureDate.addEventListener('change', updateTemporaryClosure);
  var closureReason = document.getElementById('temp-closure-reason');
  if (closureReason) closureReason.addEventListener('input', function () {
    if (settings.temporary_closure) {
      settings.temporary_closure.reason = closureReason.value.trim();
      scheduleSave();
    }
  });

  /* Special hours */
  var addSpecialBtn = document.getElementById('special-hours-add');
  if (addSpecialBtn) addSpecialBtn.addEventListener('click', addSpecialHour);

  /* Add tax category */
  var addTaxBtn = document.getElementById('add-tax-category');
  if (addTaxBtn) addTaxBtn.addEventListener('click', addTaxCategory);

  /* Device connection */
  var connectBtn = document.getElementById('connect-device-btn');
  if (connectBtn) {
    connectBtn.addEventListener('click', function() {
      document.getElementById('device-connect-panel').style.display = '';
      tool.resize();
    });
  }

  var confirmConnectBtn = document.getElementById('confirm-connect');
  if (confirmConnectBtn) confirmConnectBtn.addEventListener('click', connectDevice);

  var cancelConnectBtn = document.getElementById('cancel-connect');
  if (cancelConnectBtn) {
    cancelConnectBtn.addEventListener('click', function() {
      document.getElementById('device-connect-panel').style.display = 'none';
      tool.resize();
    });
  }
}

/* ===== BOOT ===== */
tool.onReady(function(val, fields) {
  render(val, fields);

  initAccordions();
  initToggles();
  initInputs();
  initEventDelegation();

  if (tool.isReadOnly()) lockUI(true);

  tool.onValueChange(function(v) { render(v); });
  tool.onFieldsChange(function(f) { syncFields(f); });
  tool.onReadonlyChange(function(ro) { lockUI(ro); });
});
