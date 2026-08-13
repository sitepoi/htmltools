/* ══════════════════════════════════════════════════════════
   FUNDRAISING CAMPAIGN MANAGER — JS
   ══════════════════════════════════════════════════════════ */

/* ── HELPERS ── */
var genId = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
var esc = function (s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var el = function (id) { return document.getElementById(id); };
var qs = function (sel) { return document.querySelector(sel); };
var qsa = function (sel) { return document.querySelectorAll(sel); };

var CURRENCY_SYMBOLS = { USD: '$', EUR: '\u20AC', GBP: '\u00A3', TRY: '\u20BA', CAD: 'C$', AUD: 'A$' };

function fmtCurrency(amount, currency) {
  var sym = CURRENCY_SYMBOLS[currency] || '$';
  var n = Number(amount);
  if (isNaN(n)) return sym + '0';
  return sym + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtCurrencyShort(amount, currency) {
  var sym = CURRENCY_SYMBOLS[currency] || '$';
  var n = Number(amount);
  if (isNaN(n)) return sym + '0';
  if (n >= 1000000) return sym + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return sym + (n / 1000).toFixed(1) + 'K';
  return sym + n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDate(d) {
  if (!d) return '\u2014';
  var dt = new Date(d + 'T00:00:00');
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateISO(d) {
  if (!d) return '';
  var dt = new Date(d + 'T00:00:00');
  if (isNaN(dt.getTime())) return d;
  return dt.toISOString().slice(0, 10);
}

/* ── RESIZE SCHEDULER ── */
var _resizeRaf = null;
function scheduleResize() {
  if (_resizeRaf) cancelAnimationFrame(_resizeRaf);
  _resizeRaf = requestAnimationFrame(function () { _resizeRaf = null; tool.resize(); });
}

/* ── STATE ── */
var DEFAULT_STATE = {
  campaignName: 'Fundraising Campaign',
  targetAmount: 100000,
  currency: 'USD',
  donations: []
};

var state = JSON.parse(JSON.stringify(DEFAULT_STATE));
var isReadOnly = false;
var currentView = 'manage';
var editingId = null;
var sortCol = 'date';
var sortDir = -1;
var pendingImportRows = null;
var pendingPasteRows = null;
var AVATAR_COLORS = ['#2563eb','#7c3aed','#16a34a','#d97706','#0d9488','#dc2626','#ea580c','#8b5cf6','#059669','#c2410c'];

/* ── PERSISTENCE ── */
function persist() {
  tool.setValue(state);
  tool.reportValid(true);
  scheduleResize();
}

function loadState(val) {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    state.campaignName = val.campaignName || DEFAULT_STATE.campaignName;
    state.targetAmount = Number(val.targetAmount) || DEFAULT_STATE.targetAmount;
    state.currency = val.currency || DEFAULT_STATE.currency;
    state.donations = Array.isArray(val.donations) ? val.donations : [];
  } else {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
  if (state.targetAmount <= 0) state.targetAmount = DEFAULT_STATE.targetAmount;
}

/* ── COMPUTED ── */
function getTotalRaised() {
  return state.donations.reduce(function (sum, d) { return sum + (Number(d.amount) || 0); }, 0);
}

function getProgressPct() {
  if (state.targetAmount <= 0) return 0;
  return Math.min(100, Math.round((getTotalRaised() / state.targetAmount) * 100));
}

function getDonorCount() {
  var names = state.donations.map(function (d) { return d.donorName || ''; }).filter(Boolean);
  var unique = [];
  names.forEach(function (n) { if (unique.indexOf(n) === -1) unique.push(n); });
  return unique.length;
}

function getAverageDonation() {
  var count = state.donations.length;
  if (count === 0) return 0;
  return getTotalRaised() / count;
}

function getLargestDonation() {
  if (state.donations.length === 0) return 0;
  return state.donations.reduce(function (max, d) { return Math.max(max, Number(d.amount) || 0); }, 0);
}

function getSourceBreakdown() {
  var map = {};
  state.donations.forEach(function (d) {
    var src = d.source || 'Other';
    if (!map[src]) map[src] = { total: 0, count: 0 };
    map[src].total += Number(d.amount) || 0;
    map[src].count += 1;
  });
  return map;
}

/* ── FILTERED / SORTED DONATIONS ── */
function getFilteredDonations() {
  var search = (el('search-input').value || '').toLowerCase().trim();
  var sourceFilter = el('filter-source').value;
  var list = state.donations.slice();

  if (search) {
    list = list.filter(function (d) {
      return (d.donorName || '').toLowerCase().indexOf(search) !== -1 ||
             (d.notes || '').toLowerCase().indexOf(search) !== -1 ||
             (d.source || '').toLowerCase().indexOf(search) !== -1;
    });
  }
  if (sourceFilter !== 'all') {
    list = list.filter(function (d) { return (d.source || 'Manual') === sourceFilter; });
  }

  list.sort(function (a, b) {
    var va, vb;
    if (sortCol === 'date') {
      va = a.date || '0000-00-00';
      vb = b.date || '0000-00-00';
    } else if (sortCol === 'amount') {
      va = Number(a.amount) || 0;
      vb = Number(b.amount) || 0;
    } else if (sortCol === 'donor') {
      va = (a.donorName || '').toLowerCase();
      vb = (b.donorName || '').toLowerCase();
    } else {
      va = (a[sortCol] || '').toString().toLowerCase();
      vb = (b[sortCol] || '').toString().toLowerCase();
    }
    if (va < vb) return -1 * sortDir;
    if (va > vb) return 1 * sortDir;
    return 0;
  });

  return list;
}

/* ── RENDER ── */
function renderStats() {
  var total = getTotalRaised();
  var cur = state.currency;
  el('stat-raised').textContent = fmtCurrency(total, cur);
  el('stat-donors').textContent = getDonorCount() + ' donor' + (getDonorCount() !== 1 ? 's' : '');
  el('stat-target').textContent = fmtCurrency(state.targetAmount, cur);
  el('stat-avg').textContent = fmtCurrency(getAverageDonation(), cur);
  el('stat-largest').textContent = 'Largest: ' + fmtCurrency(getLargestDonation(), cur);
  el('stat-pct').textContent = getProgressPct() + '%';
  el('stat-remaining').textContent = fmtCurrency(Math.max(0, state.targetAmount - total), cur) + ' to go';

  el('header-title').textContent = state.campaignName;
  el('header-sub').textContent = 'Target: ' + fmtCurrency(state.targetAmount, cur) + ' \u2022 ' + getProgressPct() + '% funded';
}

function renderProgress() {
  var pct = getProgressPct();
  var fill = el('progress-fill');
  var label = el('progress-label');

  fill.style.width = Math.max(pct, pct > 0 ? 2 : 0) + '%';
  fill.className = 'progress-bar-fill';
  if (pct >= 90) fill.classList.add('great');
  else if (pct >= 60) fill.classList.add('good');
  else if (pct >= 30) fill.classList.add('mid');
  else if (pct > 0) fill.classList.add('low');

  label.textContent = pct + '%';

  // Milestones
  var milestones = [25, 50, 75, 100];
  var cur = state.currency;
  var html = '';
  milestones.forEach(function (m) {
    var amt = Math.round(state.targetAmount * m / 100);
    var reached = pct >= m;
    html += '<span class="milestone' + (reached ? ' reached' : '') + '" onclick="snapTarget(' + m + ')">' + fmtCurrencyShort(amt, cur) + '</span>';
  });
  el('progress-milestones').innerHTML = html;
}

function renderTable() {
  var list = getFilteredDonations();
  var cur = state.currency;
  var tbody = el('table-body');
  var empty = el('table-empty');
  var canWrite = !isReadOnly;

  if (list.length === 0) {
    tbody.innerHTML = '';
    empty.classList.add('show');
  } else {
    empty.classList.remove('show');
    tbody.innerHTML = list.map(function (d) {
      var sourceLabel = (d.source || 'Manual').replace(/\s/g, '');
      return '<tr>' +
        '<td class="col-donor">' + esc(d.donorName || '\u2014') + '</td>' +
        '<td class="amount-cell">' + fmtCurrency(d.amount, cur) + '</td>' +
        '<td>' + fmtDate(d.date) + '</td>' +
        '<td><span class="source-badge source-badge-' + esc(sourceLabel) + '">' + esc(d.source || 'Manual') + '</span></td>' +
        '<td class="col-notes">' + esc(d.notes || '\u2014') + '</td>' +
        '<td class="actions-cell">' +
          (canWrite ? '<button class="action-btn edit" onclick="editDonation(\'' + d.id + '\')" title="Edit">✏️</button>' : '') +
          (canWrite ? '<button class="action-btn delete" onclick="confirmDelete(\'' + d.id + '\')" title="Delete">🗑</button>' : '') +
        '</td>' +
      '</tr>';
    }).join('');
  }

  el('table-count').textContent = list.length + ' donation' + (list.length !== 1 ? 's' : '');
}

function renderRecentDonations() {
  var list = state.donations.slice().sort(function (a, b) {
    return (b.date || '0000-00-00').localeCompare(a.date || '0000-00-00');
  }).slice(0, 12);
  var cur = state.currency;
  var container = el('recent-list');
  el('dash-recent-count').textContent = state.donations.length + ' total';

  if (list.length === 0) {
    container.innerHTML = '<div class="recent-empty">No donations yet — click <strong>+ Add Donation</strong> to start</div>';
    return;
  }

  container.innerHTML = list.map(function (d, i) {
    var initial = (d.donorName || 'A')[0].toUpperCase();
    var color = AVATAR_COLORS[(d.donorName || '').length % AVATAR_COLORS.length];
    return '<div class="recent-item">' +
      '<div class="recent-avatar" style="background:' + color + '">' + esc(initial) + '</div>' +
      '<div class="recent-info">' +
        '<div class="recent-name">' + esc(d.donorName || 'Anonymous') + '</div>' +
        '<div class="recent-meta">' + fmtDate(d.date) + ' · ' + esc(d.source || 'Manual') + '</div>' +
      '</div>' +
      '<div class="recent-amount">' + fmtCurrency(d.amount, cur) + '</div>' +
    '</div>';
  }).join('');
}

function renderSourceCards() {
  var breakdown = getSourceBreakdown();
  var keys = Object.keys(breakdown);
  var container = el('source-cards');
  var total = getTotalRaised();
  var cur = state.currency;

  if (keys.length === 0) {
    container.innerHTML = '<div class="source-empty">Add donations to see source breakdown</div>';
    return;
  }

  var colors = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#0d9488', '#dc2626', '#ea580c', '#475569'];
  container.innerHTML = keys.map(function (key, i) {
    var d = breakdown[key];
    var pct = total > 0 ? Math.round((d.total / total) * 100) : 0;
    var color = colors[i % colors.length];
    return '<div class="source-card">' +
      '<div class="source-card-dot" style="background:' + color + '"></div>' +
      '<div class="source-card-info">' +
        '<div class="source-card-name">' + esc(key) + '</div>' +
        '<div class="source-card-count">' + d.count + ' donation' + (d.count !== 1 ? 's' : '') + '</div>' +
      '</div>' +
      '<div class="source-card-amount">' + fmtCurrency(d.total, cur) + '</div>' +
      '<div class="source-card-pct" style="color:' + color + '">' + pct + '%</div>' +
    '</div>';
  }).join('');
}

function renderDashboard() {
  renderRecentDonations();
  renderSourceCards();
}

function switchView(view) {
  currentView = view;
  el('dashboard-panels').style.display = view === 'dashboard' ? 'block' : 'none';
  el('manage-panels').style.display = view === 'manage' ? 'flex' : 'none';
  el('btn-view-dashboard').classList.toggle('active', view === 'dashboard');
  el('btn-view-manage').classList.toggle('active', view === 'manage');
  document.body.classList.toggle('view-dashboard', view === 'dashboard');
  document.body.classList.toggle('view-manage', view === 'manage');
  if (view === 'dashboard') renderDashboard();
  scheduleResize();
}

function renderAll() {
  renderStats();
  renderProgress();
  if (currentView === 'dashboard') {
    renderDashboard();
  } else {
    renderTable();
  }
  el('input-campaign-name').value = state.campaignName;
  el('input-target-amount').value = state.targetAmount;
  el('input-currency').value = state.currency;
  scheduleResize();
}

/* ── TARGET EDITOR (modal popup) ── */
function showTargetEditor() {
  if (isReadOnly) return;
  el('input-campaign-name').value = state.campaignName;
  el('input-target-amount').value = state.targetAmount;
  el('input-currency').value = state.currency;
  el('target-overlay').style.display = 'flex';
  el('input-campaign-name').focus();
  el('input-campaign-name').select();
  scheduleResize();
}

function hideTargetEditor() {
  el('target-overlay').style.display = 'none';
  scheduleResize();
}

function saveTarget() {
  var name = (el('input-campaign-name').value || '').trim();
  var amt = parseFloat(el('input-target-amount').value);
  var cur = el('input-currency').value;

  if (!name) { tool.notify('Campaign name is required', 'warning'); return; }
  if (isNaN(amt) || amt <= 0) { tool.notify('Target amount must be a positive number', 'warning'); return; }

  state.campaignName = name;
  state.targetAmount = amt;
  state.currency = cur;
  hideTargetEditor();
  persist();
  renderAll();
  tool.notify('Campaign settings saved', 'success');
}

function snapTarget(pct) {
  if (isReadOnly) return;
  var raised = getTotalRaised();
  if (raised <= 0) { tool.notify('No donations yet — cannot snap target', 'warning'); return; }
  // Set target so that current raised equals this percentage
  var newTarget = Math.round(raised / (pct / 100));
  state.targetAmount = newTarget;
  persist();
  renderAll();
  tool.notify('Target adjusted to ' + fmtCurrency(newTarget, state.currency) + ' (' + pct + '% funded)', 'success');
}

/* ── DONATION CRUD ── */
function openAddModal() {
  editingId = null;
  el('modal-title').textContent = 'Add Donation';
  el('form-donor').value = '';
  el('form-amount').value = '';
  el('form-date').value = new Date().toISOString().slice(0, 10);
  el('form-source').value = 'Manual';
  el('form-notes').value = '';
  el('modal-delete').style.display = 'none';
  el('modal-overlay').style.display = 'flex';
  el('form-donor').focus();
}

function editDonation(id) {
  var d = state.donations.filter(function (x) { return x.id === id; })[0];
  if (!d) return;
  editingId = id;
  el('modal-title').textContent = 'Edit Donation';
  el('form-donor').value = d.donorName || '';
  el('form-amount').value = d.amount || '';
  el('form-date').value = fmtDateISO(d.date);
  el('form-source').value = d.source || 'Manual';
  el('form-notes').value = d.notes || '';
  el('modal-delete').style.display = 'inline-flex';
  el('modal-overlay').style.display = 'flex';
  el('form-donor').focus();
}

function saveDonation() {
  var donor = (el('form-donor').value || '').trim();
  var amt = parseFloat(el('form-amount').value);
  var date = el('form-date').value;
  var source = el('form-source').value;
  var notes = (el('form-notes').value || '').trim();

  if (!donor) { tool.notify('Donor name is required', 'warning'); return; }
  if (isNaN(amt) || amt <= 0) { tool.notify('Amount must be a positive number', 'warning'); return; }

  if (editingId) {
    var idx = state.donations.findIndex(function (x) { return x.id === editingId; });
    if (idx !== -1) {
      state.donations[idx].donorName = donor;
      state.donations[idx].amount = amt;
      state.donations[idx].date = date || new Date().toISOString().slice(0, 10);
      state.donations[idx].source = source;
      state.donations[idx].notes = notes;
      state.donations[idx].updatedAt = new Date().toISOString();
    }
  } else {
    state.donations.push({
      id: genId(),
      donorName: donor,
      amount: amt,
      date: date || new Date().toISOString().slice(0, 10),
      source: source,
      notes: notes,
      createdAt: new Date().toISOString()
    });
  }

  closeModal();
  persist();
  renderAll();
  tool.notify(editingId ? 'Donation updated' : 'Donation added', 'success');
}

function confirmDelete(id) {
  var d = state.donations.filter(function (x) { return x.id === id; })[0];
  if (!d) return;
  el('confirm-title').textContent = 'Delete Donation';
  el('confirm-message').textContent = 'Delete donation from "' + d.donorName + '" for ' + fmtCurrency(d.amount, state.currency) + '? This cannot be undone.';
  el('confirm-overlay').style.display = 'flex';
  el('confirm-overlay')._deleteId = id;
}

function doDelete() {
  var id = el('confirm-overlay')._deleteId;
  if (!id) return;
  state.donations = state.donations.filter(function (x) { return x.id !== id; });
  el('confirm-overlay').style.display = 'none';
  el('confirm-overlay')._deleteId = null;
  persist();
  renderAll();
  tool.notify('Donation deleted', 'info');
}

function closeModal() {
  el('modal-overlay').style.display = 'none';
  editingId = null;
}

/* ── IMPORT ── */
function openImport() {
  if (isReadOnly) return;
  el('import-overlay').style.display = 'flex';
  // Reset
  el('import-file').value = '';
  el('import-paste-area').value = '';
  el('import-preview-file').style.display = 'none';
  el('import-preview-paste').style.display = 'none';
  pendingImportRows = null;
  pendingPasteRows = null;
  // Switch to file tab
  qs('.import-tab[data-import-tab="file"]').classList.add('active');
  qs('.import-tab[data-import-tab="paste"]').classList.remove('active');
  el('import-panel-file').classList.add('active');
  el('import-panel-paste').classList.remove('active');
}

function closeImport() {
  el('import-overlay').style.display = 'none';
}

function parseRow(row) {
  return {
    donorName: row['Donor Name'] || row['donorName'] || row['Donor'] || row['donor'] || row['Name'] || '',
    amount: parseFloat(row['Amount'] || row['amount'] || row['Donation'] || 0) || 0,
    date: row['Date'] || row['date'] || '',
    source: row['Source'] || row['source'] || 'Import',
    notes: row['Notes'] || row['notes'] || ''
  };
}

function handleFileUpload(file) {
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var wb = XLSX.read(e.target.result, { type: 'array' });
      var sheet = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!rows.length) { tool.notify('No rows found in file', 'warning'); return; }
      pendingImportRows = rows.map(parseRow).filter(function (r) { return r.amount > 0; });
      if (!pendingImportRows.length) { tool.notify('No valid donation rows found', 'warning'); return; }
      showImportPreview('file');
    } catch (err) {
      tool.notify('Failed to parse file: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function showImportPreview(type) {
  var rows = type === 'file' ? pendingImportRows : pendingPasteRows;
  var tbodyId = type === 'file' ? 'import-preview-tbody' : 'import-paste-tbody';
  var countId = type === 'file' ? 'import-preview-count' : 'import-paste-count';
  var panelId = type === 'file' ? 'import-preview-file' : 'import-preview-paste';
  var cur = state.currency;

  el(countId).textContent = rows.length + ' donation' + (rows.length !== 1 ? 's' : '') + ' detected';
  el(tbodyId).innerHTML = rows.map(function (r) {
    return '<tr><td>' + esc(r.donorName || '\u2014') + '</td><td>' + fmtCurrency(r.amount, cur) + '</td><td>' + fmtDate(r.date) + '</td><td>' + esc(r.source) + '</td></tr>';
  }).join('');
  el(panelId).style.display = 'block';
  scheduleResize();
}

function confirmImport(type) {
  var rows = type === 'file' ? pendingImportRows : pendingPasteRows;
  if (!rows || !rows.length) return;
  rows.forEach(function (r) {
    state.donations.push({
      id: genId(),
      donorName: r.donorName || 'Anonymous',
      amount: r.amount,
      date: r.date || new Date().toISOString().slice(0, 10),
      source: r.source || 'Import',
      notes: r.notes || '',
      createdAt: new Date().toISOString()
    });
  });
  pendingImportRows = null;
  pendingPasteRows = null;
  closeImport();
  persist();
  renderAll();
  tool.notify(rows.length + ' donation' + (rows.length !== 1 ? 's' : '') + ' imported', 'success');
}

function handlePaste() {
  var text = (el('import-paste-area').value || '').trim();
  if (!text) { tool.notify('Paste data first', 'warning'); return; }

  var lines = text.split('\n').filter(Boolean);
  if (lines.length < 2) { tool.notify('Need at least a header row + one data row', 'warning'); return; }

  var delimiter = text.indexOf('\t') !== -1 ? '\t' : ',';
  var headers = lines[0].split(delimiter).map(function (h) { return h.trim().replace(/"/g, ''); });

  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var vals = lines[i].split(delimiter).map(function (v) { return v.trim().replace(/"/g, ''); });
    var obj = {};
    headers.forEach(function (h, j) { obj[h] = vals[j] || ''; });
    rows.push(obj);
  }

  pendingPasteRows = rows.map(parseRow).filter(function (r) { return r.amount > 0; });
  if (!pendingPasteRows.length) { tool.notify('No valid donation rows found', 'warning'); return; }
  showImportPreview('paste');
}

/* ── EXPORT PDF ── */
function exportPdf() {
  var cur = state.currency;
  var total = getTotalRaised();
  var pct = getProgressPct();
  var list = getFilteredDonations();

  var rowsHtml = list.map(function (d) {
    return '<tr><td>' + esc(d.donorName || '-') + '</td><td style="text-align:right">' + fmtCurrency(d.amount, cur) + '</td><td>' + fmtDate(d.date) + '</td><td>' + esc(d.source || '') + '</td><td>' + esc(d.notes || '') + '</td></tr>';
  }).join('');

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(state.campaignName) + ' - Report</title>' +
    '<style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;color:#333}' +
    'h1{margin-bottom:4px}h2{color:#666;font-weight:400;font-size:14px;margin-bottom:24px}' +
    '.summary{display:flex;gap:24px;margin-bottom:24px}' +
    '.summary-box{background:#f5f5f5;border-radius:8px;padding:16px 20px;flex:1}' +
    '.summary-box .label{font-size:11px;text-transform:uppercase;color:#888}' +
    '.summary-box .value{font-size:24px;font-weight:700}' +
    '.progress{margin-bottom:24px}.progress-bar{height:24px;background:#e0e0e0;border-radius:12px;overflow:hidden}' +
    '.progress-fill{height:100%;background:#2563eb;border-radius:12px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;color:#fff;font-weight:700;font-size:12px}' +
    'table{width:100%;border-collapse:collapse}th{text-align:left;padding:8px 10px;border-bottom:2px solid #ccc;font-size:11px;text-transform:uppercase;color:#888}' +
    'td{padding:8px 10px;border-bottom:1px solid #eee;font-size:13px}' +
    '</style></head><body>' +
    '<h1>' + esc(state.campaignName) + '</h1>' +
    '<h2>Fundraising Report \u2022 Generated ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + '</h2>' +
    '<div class="summary">' +
      '<div class="summary-box"><div class="label">Total Raised</div><div class="value">' + fmtCurrency(total, cur) + '</div></div>' +
      '<div class="summary-box"><div class="label">Target</div><div class="value">' + fmtCurrency(state.targetAmount, cur) + '</div></div>' +
      '<div class="summary-box"><div class="label">Progress</div><div class="value">' + pct + '%</div></div>' +
      '<div class="summary-box"><div class="label">Donors</div><div class="value">' + getDonorCount() + '</div></div>' +
    '</div>' +
    '<div class="progress"><div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%">' + pct + '%</div></div></div>' +
    '<table><thead><tr><th>Donor</th><th>Amount</th><th>Date</th><th>Source</th><th>Notes</th></tr></thead><tbody>' + rowsHtml + '</tbody></table>' +
    '<p style="margin-top:20px;font-size:11px;color:#999">Generated by Fundraising Campaign Manager</p>' +
    '</body></html>';

  tool.requestExportPdf({ html: html, filename: (state.campaignName || 'campaign').replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase() + '-report' }, function (err, file) {
    if (err) { tool.notify('Export failed: ' + err, 'error'); return; }
    tool.notify('Report exported', 'success');
    tool.openUrl(file.url);
  });
}

/* ── EVENT BINDINGS ── */
function bindEvents() {
  // View toggle
  el('btn-view-dashboard').addEventListener('click', function () { switchView('dashboard'); });
  el('btn-view-manage').addEventListener('click', function () { switchView('manage'); });

  el('btn-add-donation').addEventListener('click', openAddModal);
  el('btn-set-target').addEventListener('click', showTargetEditor);
  el('btn-import').addEventListener('click', openImport);
  el('btn-export-pdf').addEventListener('click', exportPdf);

  el('modal-close').addEventListener('click', closeModal);
  el('modal-cancel').addEventListener('click', closeModal);
  el('modal-save').addEventListener('click', saveDonation);
  el('modal-delete').addEventListener('click', function () {
    if (editingId) { closeModal(); confirmDelete(editingId); }
  });

  el('modal-overlay').addEventListener('click', function (e) { if (e.target === el('modal-overlay')) closeModal(); });

  el('confirm-close').addEventListener('click', function () { el('confirm-overlay').style.display = 'none'; });
  el('confirm-cancel').addEventListener('click', function () { el('confirm-overlay').style.display = 'none'; });
  el('confirm-ok').addEventListener('click', doDelete);
  el('confirm-overlay').addEventListener('click', function (e) { if (e.target === el('confirm-overlay')) { el('confirm-overlay').style.display = 'none'; } });

  el('import-close').addEventListener('click', closeImport);
  el('import-overlay').addEventListener('click', function (e) { if (e.target === el('import-overlay')) closeImport(); });

  el('stat-target-card').addEventListener('click', function () { if (!isReadOnly) showTargetEditor(); });
  // Target modal
  el('target-close').addEventListener('click', hideTargetEditor);
  el('target-cancel').addEventListener('click', hideTargetEditor);
  el('target-save').addEventListener('click', saveTarget);
  el('target-overlay').addEventListener('click', function (e) { if (e.target === el('target-overlay')) hideTargetEditor(); });

  el('search-input').addEventListener('input', function () {
    el('search-clear').style.display = this.value ? 'inline-block' : 'none';
    renderTable();
  });
  el('search-clear').addEventListener('click', function () {
    el('search-input').value = '';
    el('search-clear').style.display = 'none';
    renderTable();
  });
  el('filter-source').addEventListener('change', function () { renderTable(); });

  el('btn-sort-date').addEventListener('click', function () {
    sortCol = 'date'; sortDir = sortDir === -1 ? 1 : -1;
    updateSortButtons();
    renderTable();
  });
  el('btn-sort-amount').addEventListener('click', function () {
    sortCol = 'amount'; sortDir = sortDir === -1 ? 1 : -1;
    updateSortButtons();
    renderTable();
  });

  // Import file
  var dropZone = el('import-drop');
  var fileInput = el('import-file');

  dropZone.addEventListener('click', function () { fileInput.click(); });
  dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.style.borderColor = 'var(--c-accent)'; });
  dropZone.addEventListener('dragleave', function () { dropZone.style.borderColor = ''; });
  dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropZone.style.borderColor = '';
    var file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  });
  fileInput.addEventListener('change', function () {
    if (this.files[0]) handleFileUpload(this.files[0]);
  });

  el('import-preview-confirm').addEventListener('click', function () { confirmImport('file'); });
  el('import-preview-cancel').addEventListener('click', function () {
    pendingImportRows = null;
    el('import-preview-file').style.display = 'none';
  });
  el('import-paste-btn').addEventListener('click', handlePaste);
  el('import-paste-confirm').addEventListener('click', function () { confirmImport('paste'); });
  el('import-paste-cancel').addEventListener('click', function () {
    pendingPasteRows = null;
    el('import-preview-paste').style.display = 'none';
  });

  // Import tabs
  qsa('.import-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var target = this.dataset.importTab;
      qsa('.import-tab').forEach(function (t) { t.classList.remove('active'); });
      this.classList.add('active');
      qsa('.import-panel').forEach(function (p) { p.classList.remove('active'); });
      el('import-panel-' + target).classList.add('active');
      scheduleResize();
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (el('modal-overlay').style.display === 'flex') closeModal();
      else if (el('target-overlay').style.display === 'flex') hideTargetEditor();
      else if (el('confirm-overlay').style.display === 'flex') el('confirm-overlay').style.display = 'none';
      else if (el('import-overlay').style.display === 'flex') closeImport();
    }
    if (e.key === 'Enter' && e.ctrlKey) {
      if (el('modal-overlay').style.display === 'flex') saveDonation();
      else if (el('target-overlay').style.display === 'flex') saveTarget();
    }
    // Ctrl+Shift+V = toggle Present / Manage view
    if (e.key === 'V' && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      switchView(currentView === 'dashboard' ? 'manage' : 'dashboard');
    }
  });

  // Double-click header title to exit present mode (subtle escape hatch)
  el('header-title').addEventListener('dblclick', function () {
    if (currentView === 'dashboard' && !isReadOnly) {
      switchView('manage');
      tool.notify('Switched to Manage mode', 'info');
    }
  });
}

function updateSortButtons() {
  el('btn-sort-date').classList.toggle('active', sortCol === 'date');
  el('btn-sort-amount').classList.toggle('active', sortCol === 'amount');
  var arrows = { date: ' ↓', amount: ' ↓' };
  if (sortDir === 1) { arrows.date = ' ↑'; arrows.amount = ' ↑'; }
  el('btn-sort-date').textContent = 'Date' + (sortCol === 'date' ? arrows.date : '');
  el('btn-sort-amount').textContent = 'Amount' + (sortCol === 'amount' ? arrows.amount : '');
}

/* ── ROLE-BASED UI ── */
function lockUI(ro) {
  isReadOnly = ro === true;
  document.body.classList.toggle('readonly', isReadOnly);
  if (isReadOnly) {
    hideTargetEditor();
    closeModal();
    closeImport();
  }
  renderAll();
  scheduleResize();
}

/* ══════════════════════════════════════════
   ENTRY POINT
══════════════════════════════════════════ */
tool.onReady(function (val, fields) {
  bindEvents();
  loadState(val);
  updateSortButtons();
  switchView('manage');  // ensure body class + panel visibility are synced on initial load
  renderAll();
  if (tool.isReadOnly()) lockUI(true);

  tool.onValueChange(function (v) { loadState(v); renderAll(); });
  tool.onFieldsChange(function () {}); // No sibling fields to sync
  tool.onReadonlyChange(function (ro) { lockUI(ro); });

  // Declare params for admin configuration
  tool.declareParams([
    {
      name: 'defaultCurrency',
      label: 'Default Currency',
      type: 'select',
      default: 'USD',
      hint: 'Default currency for new campaigns',
      severity: 'optional'
    },
    {
      name: 'allowObjectCRUD',
      label: 'Allow Object CRUD',
      type: 'text',
      default: '',
      hint: 'Internal — set by CMS',
      severity: 'optional'
    }
  ]);

  tool.reportValid(true);
});
