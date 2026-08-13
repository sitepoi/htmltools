// ══════════════════════════════════════════════════════════
// RESIZE GUARD — prevents infinite scroll loop
// Rule: tool.resize() is ONLY called via scheduleResize().
// scheduleResize() is ONLY called from combine(), switchTab(),
// toggleFlatDetail(), toggleGroup(), npToggleGroup(), toggleWarnPanel()
// and toggleImportSection(). NEVER from render sub-functions.
// ══════════════════════════════════════════════════════════
let _resizeRaf = null;
function scheduleResize() {
	if (_resizeRaf) cancelAnimationFrame(_resizeRaf);
	_resizeRaf = requestAnimationFrame(function () {
		_resizeRaf = null;
		tool.resize();
	});
}

// ══════════════════════════════════════════════════════════
// RENDERING GUARD — blocks onValueChange re-entry
// ══════════════════════════════════════════════════════════
let _isSaving = false;
let _pendingSourceSave = false;

// ── State ─────────────────────────────────────────────────
let qbData = [], cashData = [], peopleData = [], combined = [], unpledged = [], groupMap = {};
let sortCol = 'donor', sortDir = 1;
let npSortCol = 'name', npSortDir = 1;
const UNASSIGNED = 'Unassigned';
const QB_COLS = { transactionType: 'Transaction type', donor: 'Name', invoice: '#', date: 'Date', amount: 'Amount', balance: 'Open balance' };

// ── STORAGE ─────────────────────────────────────────────
// No CMS object CRUD — data is kept in the tool's saved value only.
let _cmsAvailable = false;
let _sourceUrls = { qb: '', cash: '', people: '' };
let _urlFetchBusy = false;

function saveStoredPeople(cb) { refreshPeopleCard(); if (cb) cb(null); }
function saveStoredCash(cb) { refreshCashCard(); if (cb) cb(null); }

// ── PEOPLE MANAGEMENT UI ───────────────────────────────
function refreshPeopleCard() {
	var label = document.getElementById('people-label');
	if (!label) return;
	if (peopleData.length) {
		label.textContent = '\u2713 ' + peopleData.length + ' people saved with this tool';
	} else {
		label.textContent = 'No people stored yet \u2014 import from file or add manually';
	}
	updateTabBadges();
}

function refreshCashCard() {
	var label = document.getElementById('cash-label');
	if (!label) return;
	if (cashData.length) {
		label.textContent = '\u2713 ' + cashData.length + ' payments saved with this tool';
	} else {
		label.textContent = 'No payments stored yet \u2014 import from file or add manually';
	}
	updateTabBadges();
}

// ── UPDATE ALL TAB BADGES ───────────────────────────────
function updateTabBadges() {
	var ib = document.getElementById('invoice-tab-count');
	if (ib) { ib.textContent = qbData.length; ib.style.display = qbData.length ? '' : 'none'; }
	var cb = document.getElementById('cash-tab-count');
	if (cb) { cb.textContent = cashData.length; cb.style.display = cashData.length ? '' : 'none'; }
	var pb = document.getElementById('people-tab-count');
	if (pb) { pb.textContent = peopleData.length; pb.style.display = peopleData.length ? '' : 'none'; }
}

function renderPeopleManager() {
	var tbody = document.getElementById('people-mgmt-body');
	var countEl = document.getElementById('people-mgmt-count');
	if (!tbody) return;
	tbody.innerHTML = '';
	if (!peopleData.length) {
		tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state" style="padding:24px"><div class="e-icon">\ud83d\udc65</div><h3>No people stored</h3><p>Add people manually or import from a file.</p></div></td></tr>';
		if (countEl) countEl.textContent = '';
		return;
	}
	var sorted = peopleData.slice().sort(function (a, b) {
		var ca = peopleCell(a), cb = peopleCell(b);
		return ca.group.localeCompare(cb.group) || ca.name.localeCompare(cb.name);
	});
	sorted.forEach(function (p) {
		var origIdx = peopleData.indexOf(p);
		var cell = peopleCell(p);
		var tr = document.createElement('tr');
		tr.id = 'prow-' + origIdx;
		tr.innerHTML =
			'<td><span class="mgmt-cell" id="pcell-name-' + origIdx + '">' + esc(cell.name) + '</span></td>' +
			'<td><span class="mgmt-cell" id="pcell-group-' + origIdx + '">' + esc(cell.group) + '</span></td>' +
			'<td><span class="mgmt-cell" id="pcell-phone-' + origIdx + '">' + esc(cell.phone) + '</span></td>' +
			'<td><button class="btn btn-outline btn-sm" onclick="editPerson(' + origIdx + ')" title="Edit">\u270f</button> <button class="btn btn-outline btn-sm" onclick="deletePerson(' + origIdx + ')" title="Delete" style="color:var(--c-red);border-color:var(--c-red-mid)">\u2715</button></td>';
		tbody.appendChild(tr);
	});
	if (countEl) countEl.textContent = peopleData.length + ' people stored';
}

function addPersonRow() {
	var name = prompt('Enter full name:');
	if (!name || !name.trim()) return;
	var group = prompt('Enter group name (or leave blank):') || '';
	var phone = prompt('Enter phone (or leave blank):') || '';
	peopleData.push(_mkPeopleRow(name.trim(), group.trim(), phone.trim()));
	renderPeopleManager();
	_persistSourceData();
	saveStoredPeople(function (err) { if (err) tool.notify('Save failed: ' + err, 'error'); else tool.notify('Person added \u2713', 'success'); });
	scheduleResize();
}

function editPerson(idx) {
	var p = peopleData[idx];
	var cell = peopleCell(p);
	var name = prompt('Edit name:', cell.name);
	if (name === null) return;
	var group = prompt('Edit group:', cell.group);
	if (group === null) return;
	var phone = prompt('Edit phone:', cell.phone);
	if (phone === null) return;
	if (peopleStd()) {
		p.name = name.trim(); p.group = group.trim(); p.phone = phone.trim();
	} else {
		var cols = _peopleCols();
		_setRowField(p, cols.name, 'name', name.trim());
		_setRowField(p, cols.group, 'group', group.trim());
		_setRowField(p, cols.phone, 'phone', phone.trim());
	}
	renderPeopleManager();
	_persistSourceData();
	saveStoredPeople(function (err) { if (err) tool.notify('Save failed: ' + err, 'error'); else tool.notify('Person updated \u2713', 'success'); });
	scheduleResize();
}

function deletePerson(idx) {
	var p = peopleData[idx];
	var cell = peopleCell(p);
	if (!confirm('Delete "' + (cell.name || 'this person') + '"?')) return;
	peopleData.splice(idx, 1);
	renderPeopleManager();
	_persistSourceData();
	saveStoredPeople(function (err) { if (err) tool.notify('Save failed: ' + err, 'error'); else tool.notify('Person deleted \u2713', 'success'); });
	scheduleResize();
}

function importPeopleFile() {
	document.getElementById('people-file').click();
}

// ── CASH MANAGEMENT UI ─────────────────────────────────
function renderCashManager() {
	var tbody = document.getElementById('cash-mgmt-body');
	var countEl = document.getElementById('cash-mgmt-count');
	if (!tbody) return;
	tbody.innerHTML = '';
	if (!cashData.length) {
		tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state" style="padding:24px"><div class="e-icon">\ud83d\udcb5</div><h3>No payments stored</h3><p>Add payments manually or import from a file.</p></div></td></tr>';
		if (countEl) countEl.textContent = '';
		return;
	}
	var sorted = cashData.slice().sort(function (a, b) {
		var ca = cashCell(a), cb = cashCell(b);
		return ca.donor.localeCompare(cb.donor) || ca.date.localeCompare(cb.date);
	});
	sorted.forEach(function (c) {
		var origIdx = cashData.indexOf(c);
		var cell = cashCell(c);
		var tr = document.createElement('tr');
		tr.id = 'crow-' + origIdx;
		tr.innerHTML =
			'<td><span class="mgmt-cell" id="ccell-donor-' + origIdx + '">' + esc(cell.donor) + '</span></td>' +
			'<td><span class="mgmt-cell" id="ccell-date-' + origIdx + '">' + esc(cell.date) + '</span></td>' +
			'<td style="font-weight:700;color:var(--c-green)"><span class="mgmt-cell" id="ccell-amount-' + origIdx + '">' + fmt(cell.amount) + '</span></td>' +
			'<td><span class="mgmt-cell" id="ccell-note-' + origIdx + '">' + esc(cell.note) + '</span></td>' +
			'<td><button class="btn btn-outline btn-sm" onclick="editCash(' + origIdx + ')" title="Edit">\u270f</button> <button class="btn btn-outline btn-sm" onclick="deleteCash(' + origIdx + ')" title="Delete" style="color:var(--c-red);border-color:var(--c-red-mid)">\u2715</button></td>';
		tbody.appendChild(tr);
	});
	if (countEl) countEl.textContent = cashData.length + ' payments stored';
}

function addCashRow() {
	var donor = prompt('Enter donor name:');
	if (!donor || !donor.trim()) return;
	var date = prompt('Enter payment date (e.g. 2024-01-15):') || '';
	var amt = parseFloat(prompt('Enter amount:') || '0');
	if (isNaN(amt) || amt <= 0) { tool.notify('Invalid amount', 'warning'); return; }
	var note = prompt('Enter note (or leave blank):') || '';
	cashData.push(_mkCashRow(donor.trim(), date.trim(), amt, note.trim()));
	renderCashManager();
	_persistSourceData();
	saveStoredCash(function (err) { if (err) tool.notify('Save failed: ' + err, 'error'); else tool.notify('Payment added \u2713', 'success'); });
	scheduleResize();
}

function editCash(idx) {
	var c = cashData[idx];
	var cell = cashCell(c);
	var donor = prompt('Edit donor name:', cell.donor);
	if (donor === null) return;
	var date = prompt('Edit date:', cell.date);
	if (date === null) return;
	var amt = parseFloat(prompt('Edit amount:', cell.amount || 0));
	if (isNaN(amt)) return;
	var note = prompt('Edit note:', cell.note);
	if (note === null) return;
	if (cashStd()) {
		c.donorName = donor.trim(); c.date = date.trim(); c.amount = amt; c.note = note.trim();
	} else {
		var cols = _cashCols();
		_setRowField(c, cols.donor, 'donorName', donor.trim());
		_setRowField(c, cols.date, 'date', date.trim());
		_setRowField(c, cols.amount, 'amount', amt);
		_setRowField(c, cols.note, 'note', note.trim());
	}
	renderCashManager();
	_persistSourceData();
	saveStoredCash(function (err) { if (err) tool.notify('Save failed: ' + err, 'error'); else tool.notify('Payment updated \u2713', 'success'); });
	scheduleResize();
}

function deleteCash(idx) {
	var c = cashData[idx];
	var cell = cashCell(c);
	if (!confirm('Delete payment from "' + (cell.donor || 'unknown') + '" for ' + fmt(cell.amount) + '?')) return;
	cashData.splice(idx, 1);
	renderCashManager();
	_persistSourceData();
	saveStoredCash(function (err) { if (err) tool.notify('Save failed: ' + err, 'error'); else tool.notify('Payment deleted \u2713', 'success'); });
	scheduleResize();
}

function importCashFile() {
	document.getElementById('cash-file').click();
}

// ── ROW FIELD HELPERS (CMS-standard & file-mapped rows) ──
function cashStd() { return _cmsAvailable || (cashData.length > 0 && cashData[0] && cashData[0].hasOwnProperty('donorName')); }
function peopleStd() { return _cmsAvailable || (peopleData.length > 0 && peopleData[0] && peopleData[0].hasOwnProperty('name') && peopleData[0].hasOwnProperty('group')); }
function _cashCols() {
	return {
		donor: (document.getElementById('cash-col-donor') || {}).value || '',
		date: (document.getElementById('cash-col-date') || {}).value || '',
		amount: (document.getElementById('cash-col-amount') || {}).value || '',
		note: (document.getElementById('cash-col-note') || {}).value || ''
	};
}
function _peopleCols() {
	return {
		name: (document.getElementById('people-col-name') || {}).value || '',
		group: (document.getElementById('people-col-group') || {}).value || '',
		phone: (document.getElementById('people-col-phone') || {}).value || ''
	};
}
function cashCell(c) {
	if (cashStd()) return { donor: String(c.donorName || ''), date: String(c.date || ''), amount: Number(c.amount) || 0, note: String(c.note || '') };
	var cols = _cashCols();
	return {
		donor: cols.donor ? String(c[cols.donor] || '') : String(c.donorName || c.Name || ''),
		date: cols.date ? String(c[cols.date] || '') : String(c.Date || ''),
		amount: cols.amount ? (parseFloat(String(c[cols.amount]).replace(/[^0-9.]/g, '')) || 0) : (Number(c.amount) || Number(c.Income) || 0),
		note: cols.note ? String(c[cols.note] || '') : String(c.Explanation || '')
	};
}
function peopleCell(p) {
	if (peopleStd()) return { name: String(p.name || ''), group: String(p.group || ''), phone: String(p.phone || '') };
	var cols = _peopleCols();
	return {
		name: cols.name ? String(p[cols.name] || '') : String(p.name || p.Name || ''),
		group: cols.group ? String(p[cols.group] || '') : String(p.group || p.Group || ''),
		phone: cols.phone ? String(p[cols.phone] || '') : String(p.phone || p.Phone || '')
	};
}
function _setRowField(row, colName, stdKey, val) {
	if (colName) { row[colName] = val; } else { row[stdKey] = val; }
}
function _mkCashRow(donor, date, amount, note) {
	if (cashStd()) return { donorName: donor, date: date, amount: amount, note: note };
	var cols = _cashCols();
	var row = {};
	_setRowField(row, cols.donor, 'donorName', donor);
	_setRowField(row, cols.date, 'date', date);
	_setRowField(row, cols.amount, 'amount', amount);
	_setRowField(row, cols.note, 'note', note);
	return row;
}
function _mkPeopleRow(name, group, phone) {
	if (peopleStd()) return { name: name, group: group, phone: phone };
	var cols = _peopleCols();
	var row = {};
	_setRowField(row, cols.name, 'name', name);
	_setRowField(row, cols.group, 'group', group);
	_setRowField(row, cols.phone, 'phone', phone);
	return row;
}

// ── TOP-LEVEL TAB SWITCHING ─────────────────────────────
var FILE_TABS = ['invoices', 'cash', 'people'];

function setFileTabsVisible(show) {
	document.querySelectorAll('.top-tab-btn[data-filetab]').forEach(function (b) {
		b.style.display = show ? '' : 'none';
	});
}

function setBannerTime(iso) {
	var sub = document.getElementById('saved-banner-sub');
	if (!sub || !iso) return;
	var d = new Date(iso);
	sub.textContent = 'Generated ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function updateSavedBanner() {
	var banner = document.getElementById('saved-banner');
	var reportShown = document.getElementById('report-content') && document.getElementById('report-content').style.display === 'block';
	if (banner) banner.style.display = reportShown ? 'block' : 'none';
}

function showFilesForUpdate() {
	switchTopTab('invoices');
}

function switchTopTab(name) {
	document.querySelectorAll('.top-tab-btn').forEach(function (b) {
		b.classList.toggle('active', b.getAttribute('data-tab') === name);
	});
	document.querySelectorAll('.top-tab-panel').forEach(function (p) {
		p.classList.toggle('active', p.id === 'top-tab-' + name);
	});
	var isFileTab = FILE_TABS.indexOf(name) !== -1;
	var reportShown = document.getElementById('report-content') && document.getElementById('report-content').style.display === 'block';
	if (isFileTab) {
		setFileTabsVisible(true);
		document.getElementById('saved-banner').style.display = 'none';
	} else if (name === 'reports' && reportShown) {
		setFileTabsVisible(false);
		updateSavedBanner();
	}
	if (name === 'cash') { renderCashManager(); }
	if (name === 'people') { renderPeopleManager(); }
	if (name === 'invoices') { renderInvoiceList(); }
	scheduleResize();
}

// ── INVOICE LIST RENDERING ──────────────────────────────
function renderInvoiceList() {
	var tbody = document.getElementById('invoice-body');
	var countEl = document.getElementById('invoice-count');
	if (!tbody) return;
	var search = normalize((document.getElementById('invoice-search') || {}).value || '');
	var rows = qbData.filter(function (r) {
		if (!search) return true;
		var donor = String(r[QB_COLS.donor] || '');
		var inv = String(r[QB_COLS.invoice] || '');
		return normalize(donor).includes(search) || normalize(inv).includes(search);
	});
	tbody.innerHTML = '';
	if (!rows.length) {
		tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state" style="padding:32px"><div class="e-icon">📄</div><h3>' + (qbData.length ? 'No matching invoices' : 'No invoices loaded') + '</h3><p>' + (qbData.length ? 'Try a different search term.' : 'Upload a QuickBooks Invoice List export file above.') + '</p></div></td></tr>';
		if (countEl) countEl.textContent = qbData.length ? qbData.length + ' invoices (' + rows.length + ' shown)' : '';
		return;
	}
	rows.forEach(function (row) {
		var tr = document.createElement('tr');
		var amt = parseFloat(String(row[QB_COLS.amount] || '').replace(/[^0-9.]/g, '')) || 0;
		var bal = parseFloat(String(row[QB_COLS.balance] || '').replace(/[^0-9.]/g, '')) || 0;
		var balClass = bal <= 0 ? 'zero' : 'positive';
		tr.innerHTML =
			'<td><span class="badge" style="background:var(--c-blue-bg);color:var(--c-blue);border:1px solid var(--c-blue-mid)">' + esc(String(row[QB_COLS.transactionType] || 'Invoice')) + '</span></td>' +
			'<td><span class="donor-name">' + esc(String(row[QB_COLS.donor] || '')) + '</span></td>' +
			'<td><span class="invoice-no">' + esc(String(row[QB_COLS.invoice] || '')) + '</span></td>' +
			'<td style="font-size:12px;color:var(--c-text2)">' + esc(String(row[QB_COLS.date] || '')) + '</td>' +
			'<td class="invoice-amount">' + fmt(amt) + '</td>' +
			'<td class="invoice-balance ' + balClass + '">' + fmt(bal) + '</td>';
		tbody.appendChild(tr);
	});
	if (countEl) countEl.textContent = qbData.length + ' invoice rows (' + rows.length + ' shown)';
	var badge = document.getElementById('invoice-tab-count');
	if (badge) {
		badge.textContent = qbData.length;
		badge.style.display = qbData.length ? '' : 'none';
	}
}

// ── URL INPUT TOGGLE ───────────────────────────────────
function toggleUrlInput(type) {
	var wrap = document.getElementById(type + '-url-wrap');
	if (!wrap) return;
	var show = wrap.style.display === 'none';
	wrap.style.display = show ? 'flex' : 'none';
	if (show && _sourceUrls[type]) {
		document.getElementById(type + '-url').value = _sourceUrls[type];
	}
}

// ── SAVE SOURCE URLS TO TOOL VALUE ────────────────────
function saveSourceUrls() {
	var qb = document.getElementById('qb-url');
	var cash = document.getElementById('cash-url');
	var people = document.getElementById('people-url');
	_sourceUrls.qb = qb ? qb.value.trim() : '';
	_sourceUrls.cash = cash ? cash.value.trim() : '';
	_sourceUrls.people = people ? people.value.trim() : '';
	_persistSourceUrls();
}

function _persistSourceUrls() {
	if (_isSaving) return;
	var hasUrl = _sourceUrls.qb || _sourceUrls.cash || _sourceUrls.people;
	if (!hasUrl) return;
	var val = tool.getValue() || {};
	val.sourceUrls = { qb: _sourceUrls.qb, cash: _sourceUrls.cash, people: _sourceUrls.people };
	_isSaving = true;
	tool.setValue(sanitizeForSave(val));
	setTimeout(function () { _isSaving = false; }, 200);
}

// ── PERSIST RAW FILE CONTENT INTO SAVED VALUE ───────────
function _persistSourceData() {
	if (_isSaving) { _pendingSourceSave = true; return; }
	_pendingSourceSave = false;
	var val = tool.getValue() || {};
	val.qbRecords = qbData;
	val.cashRecords = cashData;
	val.peopleRecords = peopleData;
	_isSaving = true;
	tool.setValue(sanitizeForSave(val));
	setTimeout(function () {
		_isSaving = false;
		if (_pendingSourceSave) _persistSourceData();
	}, 200);
}

// ── SANITIZE DATA SENT TO THE CMS PARENT (Firestore-safe) ──
// Firestore rejects: undefined / NaN values and empty field names.
function sanitizeForSave(v) {
	if (Array.isArray(v)) {
		var arr = [];
		for (var i = 0; i < v.length; i++) arr.push(sanitizeForSave(v[i]));
		return arr;
	}
	if (v && typeof v === 'object' && !(v instanceof Date)) {
		var out = {};
		Object.keys(v).forEach(function (k) {
			if (!k || !String(k).trim()) return; // drop empty field names
			var val = v[k];
			if (val === undefined || val === null || (typeof val === 'number' && isNaN(val))) {
				out[k] = '';
			} else {
				out[k] = sanitizeForSave(val);
			}
		});
		return out;
	}
	return v;
}
function logUndefinedPaths(obj, path) {
	path = path || 'value';
	if (Array.isArray(obj)) {
		for (var i = 0; i < obj.length; i++) logUndefinedPaths(obj[i], path + '[' + i + ']');
		return;
	}
	if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
		Object.keys(obj).forEach(function (k) {
			var val = obj[k];
			if (val === undefined) { console.warn('[PledgeTracker] UNDEFINED at: ' + path + '.' + k); return; }
			logUndefinedPaths(val, path + '.' + k);
		});
		return;
	}
	if (obj === undefined) console.warn('[PledgeTracker] UNDEFINED at: ' + path);
}

// ── RESTORE RAW FILE CONTENT FROM SAVED VALUE ───────────
function restoreSourceData(val) {
	if (!val) return;
	// Invoices: always restored from the saved value
	if (Array.isArray(val.qbRecords) && val.qbRecords.length) {
		qbData = val.qbRecords;
		var qbDrop = document.getElementById('qb-drop');
		var qbLabel = document.getElementById('qb-label');
		if (qbDrop) qbDrop.classList.add('loaded');
		if (qbLabel) qbLabel.textContent = '\u2713 Restored from last save (' + qbData.length + ' invoice rows)';
		var qbMap = document.getElementById('qb-map');
		if (qbMap) qbMap.style.display = 'block';
		renderInvoiceList();
	}
	// Cash & people: fall back to the saved value only when CMS storage is unavailable
	if (!_cmsAvailable) {
		if (Array.isArray(val.cashRecords) && val.cashRecords.length) {
			cashData = val.cashRecords;
			var cDrop = document.getElementById('cash-drop');
			var cLabel = document.getElementById('cash-label');
			if (cDrop) cDrop.classList.add('loaded');
			if (cLabel) cLabel.textContent = '\u2713 Restored from last save (' + cashData.length + ' payments)';
			var cMap = document.getElementById('cash-map');
			if (cMap) cMap.style.display = 'block';
			var cCols = Object.keys(cashData[0] || {});
			populateSelect('cash-col-donor', cCols, ['name', 'donor', 'customer', 'payer']);
			populateSelect('cash-col-date', cCols, ['date', 'paid', 'payment']);
			populateSelect('cash-col-amount', cCols, ['income', 'amount', 'paid', 'cash', 'payment']);
			populateSelect('cash-col-note', cCols, ['explanation', 'note', 'description', 'memo', 'comment']);
			renderCashManager();
		}
		if (Array.isArray(val.peopleRecords) && val.peopleRecords.length) {
			peopleData = val.peopleRecords;
			var pDrop = document.getElementById('people-drop');
			var pLabel = document.getElementById('people-label');
			if (pDrop) pDrop.classList.add('loaded');
			if (pLabel) pLabel.textContent = '\u2713 Restored from last save (' + peopleData.length + ' people)';
			var pMap = document.getElementById('people-map');
			if (pMap) pMap.style.display = 'block';
			var pCols = Object.keys(peopleData[0] || {});
			populateSelect('people-col-name', pCols, ['name', 'donor', 'person', 'full']);
			populateSelect('people-col-group', pCols, ['group', 'location', 'team', 'category', 'class']);
			populateSelect('people-col-phone', pCols, ['phone', 'mobile', 'tel', 'cell']);
			renderPeopleManager();
		}
	}
	updateTabBadges();
}

// ── FETCH FILE FROM URL ───────────────────────────────
function fetchUrlFile(type) {
	var urlInput = document.getElementById(type + '-url');
	var url = urlInput ? urlInput.value.trim() : '';
	if (!url) { tool.notify('Please enter a URL first', 'warning'); return; }
	if (_urlFetchBusy) { tool.notify('A fetch is already in progress', 'warning'); return; }
	_urlFetchBusy = true;
	saveSourceUrls();
	tool.notify('Fetching ' + type + ' file from URL…', 'info');

	tool.requestFileContent(url, function (err, content) {
		_urlFetchBusy = false;
		if (err) { tool.notify('Fetch failed: ' + err, 'error'); return; }
		if (!content) { tool.notify('No content returned from URL', 'warning'); return; }
		try {
			var wb = XLSX.read(content, { type: 'string', cellDates: true });
			var ws = wb.Sheets[wb.SheetNames[0]];
			var raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
			var headerRowIdx = 0;
			if (type === 'qb') {
				for (var i = 0; i < Math.min(raw.length, 15); i++) {
					var rowStr = raw[i].map(function (c) { return String(c).toLowerCase(); }).join('|');
					if (rowStr.includes('transaction type') || rowStr.includes('transaction_type')) { headerRowIdx = i; break; }
				}
			} else {
				for (var i = 0; i < Math.min(raw.length, 15); i++) {
					var cells = raw[i].map(function (c) { return String(c).toLowerCase().trim(); });
					if (cells.includes('name') && (cells.includes('date') || cells.includes('income') || cells.includes('explanation') || cells.includes('group'))) { headerRowIdx = i; break; }
				}
			}
			var headers = raw[headerRowIdx].map(function (h) { return String(h).trim(); });
			var rows = [];
			for (var i = headerRowIdx + 1; i < raw.length; i++) {
				var rowArr = raw[i];
				if (rowArr.every(function (c) { return c === '' || c === null || c === undefined; })) continue;
				var obj = {};
				headers.forEach(function (h, j) { obj[h] = rowArr[j] !== undefined ? rowArr[j] : ''; });
				rows.push(obj);
			}
			if (!rows.length) { tool.notify('No data rows found in ' + type + ' file', 'warning'); return; }

			if (type === 'qb') {
				onQBLoad(rows);
			} else if (type === 'cash') {
				onCashLoad(rows);
			} else if (type === 'people') {
				onPeopleLoad(rows);
			}
			tool.notify('Fetched ' + rows.length + ' rows from ' + type + ' URL \u2713', 'success');
		} catch (e) {
			tool.notify('Parse error: ' + e.message, 'error');
		}
	});
}

// ── RESTORE SOURCE URLS FROM SAVED VALUE ──────────────
function _restoreSourceUrls(val) {
	if (val && val.sourceUrls) {
		_sourceUrls.qb = val.sourceUrls.qb || '';
		_sourceUrls.cash = val.sourceUrls.cash || '';
		_sourceUrls.people = val.sourceUrls.people || '';
		var qbEl = document.getElementById('qb-url');
		var cashEl = document.getElementById('cash-url');
		var peopleEl = document.getElementById('people-url');
		if (qbEl) qbEl.value = _sourceUrls.qb;
		if (cashEl) cashEl.value = _sourceUrls.cash;
		if (peopleEl) peopleEl.value = _sourceUrls.people;
		if (_sourceUrls.qb) { document.getElementById('qb-url-wrap').style.display = 'flex'; }
		if (_sourceUrls.cash) { document.getElementById('cash-url-wrap').style.display = 'flex'; }
		if (_sourceUrls.people) { document.getElementById('people-url-wrap').style.display = 'flex'; }
	}
}

// ── Toggle import section (kept for backward compat) ─────
function toggleImportSection() {
	switchTopTab('invoices');
}

// ── Restore saved report from CMS value ───────────────────
function restoreFromValue(val) {
	if (!val || !val.records || !Array.isArray(val.records) || !val.records.length) return false;

	// Restore combined records
	combined = val.records.map(function (r) {
		return {
			donor: r.donor || '',
			key: r.donor ? r.donor.toLowerCase().replace(/[^a-z0-9]/g, '') : '',
			group: r.group || UNASSIGNED,
			phone: r.phone || '',
			invoice: r.invoice || '',
			date: r.date || '',
			pledged: r.pledged || 0,
			paid: r.paid || 0,
			balance: r.balance || 0,
			status: r.status || 'unpaid',
			pct: r.pct || 0,
			qbPaid: (r.qbPaid !== undefined && r.qbPaid !== null) ? (Number(r.qbPaid) || 0)
				: Math.max(0, (Number(r.pledged) || 0) - (Number(r.balance) || 0)),
			payments: Array.isArray(r.payments) ? r.payments.map(function (p) { return { date: String(p.date || ''), amount: Number(p.amount) || 0, note: String(p.note || '') }; }) : []
		};
	});

	// ── FIX: Restore unpledged records from saved value ──────
	unpledged = [];
	if (val.unpledgedRecords && Array.isArray(val.unpledgedRecords) && val.unpledgedRecords.length) {
		unpledged = val.unpledgedRecords.map(function (r) {
			return {
				name: r.name || '',
				key: r.name ? r.name.toLowerCase().replace(/[^a-z0-9]/g, '') : '',
				group: r.group || UNASSIGNED,
				phone: r.phone || ''
			};
		});
	}

	// Show saved banner
	var banner = document.getElementById('saved-banner');
	if (banner) {
		setBannerTime(val.generatedAt);
		banner.style.display = 'block';
	}

	var importSec = document.getElementById('import-section');
	if (importSec) importSec.style.display = 'none';

	var pill = document.getElementById('header-status');
	var pillText = document.getElementById('header-status-text');
	if (pill && pillText) {
		pillText.textContent = combined.length + ' donors (saved)';
		pill.style.display = 'flex';
	}

	updateStats();
	populateGroupFilters();
	document.getElementById('stats-row').style.display = 'grid';
	document.getElementById('report-content').style.display = 'block';
	document.getElementById('no-report-state').style.display = 'none';

	// ── FIX: Show/hide No-Pledge tabs based on restored data ─
	var hasUnpledged = unpledged.length > 0;
	document.getElementById('tab-btn-nopledge-list').style.display = hasUnpledged ? '' : 'none';
	document.getElementById('tab-btn-nopledge-group').style.display = hasUnpledged ? '' : 'none';

	if (hasUnpledged) {
		// Populate no-pledge group filter
		var npGroups = [];
		var npGroupSet = {};
		unpledged.forEach(function (r) { if (!npGroupSet[r.group]) { npGroupSet[r.group] = true; npGroups.push(r.group); } });
		npGroups.sort(function (a, b) { return a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b); });
		var npSel = document.getElementById('nopledge-filter-group');
		npSel.innerHTML = '<option value="">All groups</option>';
		npGroups.forEach(function (g) { var o = document.createElement('option'); o.value = g; o.textContent = g; npSel.appendChild(o); });
	}

	renderFlat();
	renderGroupView();
	renderSummary();
	renderCards();
	if (hasUnpledged) { renderNoPledgeList(); renderNoPledgeGroup(); }

	// ── Restore mismatches (persist across refresh) ──────────
	warnResolved = {};
	if (val.resolvedMismatches && Array.isArray(val.resolvedMismatches)) {
		val.resolvedMismatches.forEach(function (k) { warnResolved[k] = true; });
	}
	renderWarnings(val.mismatches && Array.isArray(val.mismatches) ? val.mismatches : []);

	return true;
}

// ── FILE LOADING ──────────────────────────────────────────
function setupDrop(dropId, fileId, onLoad) {
	var drop = document.getElementById(dropId);
	var file = document.getElementById(fileId);
	if (!drop || !file) return;
	file.onchange = function (e) { handleFile(e.target.files[0], dropId, onLoad); };
	drop.onclick = function () { file.click(); };
	drop.ondragover = function (e) { e.preventDefault(); drop.classList.add('drag-over'); };
	drop.ondragleave = function () { drop.classList.remove('drag-over'); };
	drop.ondrop = function (e) { e.preventDefault(); drop.classList.remove('drag-over'); handleFile(e.dataTransfer.files[0], dropId, onLoad); };
}

function handleFile(file, dropId, onLoad) {
	if (!file) return;
	var reader = new FileReader();
	reader.onload = function (e) {
		var wb = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
		var ws = wb.Sheets[wb.SheetNames[0]];
		var raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
		var headerRowIdx = 0;
		if (dropId === 'qb-drop') {
			for (var i = 0; i < Math.min(raw.length, 15); i++) {
				var rowStr = raw[i].map(function (c) { return String(c).toLowerCase(); }).join('|');
				if (rowStr.includes('transaction type') || rowStr.includes('transaction_type')) { headerRowIdx = i; break; }
			}
		} else if (dropId === 'cash-drop') {
			for (var i = 0; i < Math.min(raw.length, 15); i++) {
				var cells = raw[i].map(function (c) { return String(c).toLowerCase().trim(); });
				if (cells.includes('name') && (cells.includes('date') || cells.includes('income') || cells.includes('explanation'))) { headerRowIdx = i; break; }
			}
		}
		var headers = raw[headerRowIdx].map(function (h) { return String(h).trim(); });
		var rows = [];
		for (var i = headerRowIdx + 1; i < raw.length; i++) {
			var rowArr = raw[i];
			if (rowArr.every(function (c) { return c === '' || c === null || c === undefined; })) continue;
			var obj = {};
			headers.forEach(function (h, j) { obj[h] = rowArr[j] !== undefined ? rowArr[j] : ''; });
			rows.push(obj);
		}
		if (!rows.length) { tool.notify('No data found in file.', 'error'); return; }
		document.getElementById(dropId).classList.add('loaded');
		var labelMap = { 'qb-drop': 'qb-label', 'cash-drop': 'cash-label', 'people-drop': 'people-label' };
		document.getElementById(labelMap[dropId]).textContent = '\u2713 ' + file.name + ' (' + rows.length + ' rows)';
		onLoad(rows);
	};
	reader.readAsBinaryString(file);
}

function populateSelect(selId, cols, preferred) {
	var sel = document.getElementById(selId);
	sel.innerHTML = '<option value="">-- not mapped --</option>';
	cols.forEach(function (c) {
		var opt = document.createElement('option');
		opt.value = c; opt.textContent = c;
		if (preferred.some(function (p) { return c.toLowerCase().includes(p); })) opt.selected = true;
		sel.appendChild(opt);
	});
}

function onQBLoad(rows) {
	var invoiceRows = rows.filter(function (row) {
		var typeVal = String(row[QB_COLS.transactionType] || '').trim().toLowerCase();
		if (typeVal !== 'invoice') return false;
		var invoiceNum = String(row[QB_COLS.invoice] || '').trim();
		if (!invoiceNum) return false;
		var amt = parseFloat(String(row[QB_COLS.amount] || '').replace(/[^0-9.]/g, ''));
		return !isNaN(amt);
	});
	qbData = invoiceRows;
	document.getElementById('qb-map').style.display = 'block';
	var labelEl = document.getElementById('qb-label');
	var kept = invoiceRows.length, total = rows.length;
	if (kept === 0) {
		labelEl.textContent = '\u26a0 Loaded ' + total + ' rows but found 0 Invoice rows \u2014 check "Transaction type" column';
	} else {
		labelEl.textContent = '\u2713 QB export (' + kept + ' invoice rows of ' + total + ' total)';
	}
	renderInvoiceList();
	updateTabBadges();
	_persistSourceData();
}

function onCashLoad(rows) {
	var cols = Object.keys(rows[0]);
	var nameColGuess = cols.find(function (c) { return c.toLowerCase().trim() === 'name'; }) ||
		cols.find(function (c) { return ['name', 'donor', 'customer', 'payer'].some(function (p) { return c.toLowerCase().includes(p); }); }) || '';
	var rawCash = nameColGuess ? rows.filter(function (r) { return String(r[nameColGuess] || '').trim() !== ''; }) : rows;
	document.getElementById('cash-map').style.display = 'block';
	populateSelect('cash-col-donor', cols, ['name', 'donor', 'customer', 'payer']);
	populateSelect('cash-col-date', cols, ['date', 'paid', 'payment']);
	populateSelect('cash-col-amount', cols, ['income', 'amount', 'paid', 'cash', 'payment']);
	populateSelect('cash-col-note', cols, ['explanation', 'note', 'description', 'memo', 'comment']);
	var noteColGuess = cols.find(function (c) { return ['explanation', 'note', 'description', 'memo', 'comment'].some(function (p) { return c.toLowerCase().includes(p); }); }) || '';
	var explSel = document.getElementById('cash-col-expl-val');
	explSel.innerHTML = '<option value="">\u2014 All (no filter) \u2014</option>';
	if (noteColGuess) {
		var unique = [];
		var seen = {};
		rawCash.forEach(function (r) { var v = String(r[noteColGuess] || '').trim(); if (v && !seen[v]) { seen[v] = true; unique.push(v); } });
		unique.sort();
		unique.forEach(function (val) {
			var o = document.createElement('option');
			o.value = val; o.textContent = val;
			if (/donation/i.test(val)) o.selected = true;
			explSel.appendChild(o);
		});
	}
	document.getElementById('cash-expl-filter').style.display = 'block';

	cashData = rawCash;
	var labelEl = document.getElementById('cash-label');
	var kept = rawCash.length, total = rows.length;
	if (labelEl) labelEl.textContent = '\u2713 ' + kept + ' rows' + (kept < total ? ' of ' + total + ' total' : '') + ' \u2014 saved with this tool';
	renderCashManager();
	_persistSourceData();
}

function onPeopleLoad(rows) {
	var cols = Object.keys(rows[0]);
	document.getElementById('people-map').style.display = 'block';
	populateSelect('people-col-name', cols, ['name', 'donor', 'person', 'full']);
	populateSelect('people-col-group', cols, ['group', 'location', 'team', 'category', 'class']);
	populateSelect('people-col-phone', cols, ['phone', 'mobile', 'tel', 'cell']);
	peopleData = rows;
	var labelEl = document.getElementById('people-label');
	if (labelEl) labelEl.textContent = '\u2713 ' + rows.length + ' rows \u2014 saved with this tool';
	renderPeopleManager();
	_persistSourceData();
}

// ── CMS SDK ENTRY POINT ───────────────────────────────────
tool.onReady(function (val, fields) {
	// Declare output schema
	tool.declareOutput({
		type: 'object',
		properties: {
			generatedAt: { type: 'string' },
			summary: { type: 'object' },
			records: { type: 'array' },
			unpledgedRecords: { type: 'array' },
			qbRecords: { type: 'array' },
			cashRecords: { type: 'array' },
			peopleRecords: { type: 'array' }
		}
	});

	// Declare params
	tool.declareParams([
		{ name: 'allowFileContent', label: 'Allow File Content Extraction', type: 'toggle', default: 'yes', hint: 'Enable fetching files from URLs (for source file URLs)' },
		{ name: 'allowExportPdf', label: 'Allow PDF Export', type: 'toggle', default: 'yes', hint: 'Enable PDF export via CMS' }
	]);

	setupDrop('qb-drop', 'qb-file', onQBLoad);
	setupDrop('cash-drop', 'cash-file', onCashLoad);
	setupDrop('people-drop', 'people-file', onPeopleLoad);

	function lockUI(ro) {
		document.querySelectorAll('input, select, button').forEach(function (el) { el.disabled = !!ro; });
		document.querySelectorAll('.drop-zone').forEach(function (z) {
			z.style.pointerEvents = ro ? 'none' : '';
			z.style.opacity = ro ? '0.5' : '';
		});
	}
	if (tool.isReadOnly()) lockUI(true);
	tool.onReadonlyChange(function (ro) { lockUI(ro); });

	// Restore saved source URLs
	_restoreSourceUrls(val);

	// Restore raw file content from the saved value
	restoreSourceData(val);
	// Restore saved report
	var restored = restoreFromValue(val);
	if (restored) {
		switchTab('dashboard');
		switchTopTab('reports');
	} else {
		switchTopTab('invoices');
	}
	updateTabBadges();

	// Auto-fetch QB URL if present and no QB data loaded
	if (_sourceUrls.qb && !qbData.length) {
		setTimeout(function () { fetchUrlFile('qb'); }, 500);
	}
	scheduleResize();

	tool.onValueChange(function (newVal) {
		if (_isSaving) return;
		restoreFromValue(newVal);
	});
});

function refreshExplOptions() {
	var noteCol = document.getElementById('cash-col-note').value;
	if (!noteCol || !cashData.length) return;
	var explSel = document.getElementById('cash-col-expl-val');
	var prev = explSel.value;
	explSel.innerHTML = '<option value="">\u2014 All (no filter) \u2014</option>';
	var unique = [];
	var seen = {};
	cashData.forEach(function (r) { var v = String(r[noteCol] || '').trim(); if (v && !seen[v]) { seen[v] = true; unique.push(v); } });
	unique.sort();
	unique.forEach(function (val) {
		var o = document.createElement('option');
		o.value = val; o.textContent = val;
		if (val === prev) o.selected = true;
		else if (/donation/i.test(val) && prev === '') o.selected = true;
		explSel.appendChild(o);
	});
	document.getElementById('cash-expl-filter').style.display = 'block';
}

// ── HELPERS ───────────────────────────────────────────────
function normalize(str) { return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim(); }
function fmt(n) { return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function v(id) { return document.getElementById(id).value; }
function badge(status) {
	return status === 'paid' ? '<span class="badge badge-paid">Paid</span>'
		: status === 'partial' ? '<span class="badge badge-partial">Partial</span>'
		: status === 'nopledge' ? '<span class="badge badge-nopledge">No Pledge</span>'
			: '<span class="badge badge-unpaid">Unpaid</span>';
}
function fillClass(status) { return status === 'paid' ? 'fill-paid' : status === 'partial' ? 'fill-partial' : status === 'nopledge' ? 'fill-nopledge' : 'fill-unpaid'; }
function pledgedFirst(a, b) {
	var aNp = a.status === 'nopledge' ? 1 : 0;
	var bNp = b.status === 'nopledge' ? 1 : 0;
	if (aNp !== bNp) return aNp - bNp;
	return 0;
}

// ── COMBINE & SAVE ────────────────────────────────────────
function combine() {
	if (!qbData.length) {
		var dropLoaded = document.getElementById('qb-drop').classList.contains('loaded');
		showNotice(dropLoaded
			? 'File loaded but no Invoice rows found. Check "Transaction type" column has "Invoice" values.'
			: 'Please import QuickBooks invoices first.');
		return;
	}

	var btn = document.getElementById('generate-btn');
	var btnText = document.getElementById('generate-btn-text');
	if (btn) btn.disabled = true;
	if (btnText) btnText.textContent = 'Generating\u2026';

	// Build group map from peopleData (standardized fields when CMS, column-mapped when file-only)
	groupMap = {};
	if (peopleData.length) {
		var useStandardPeople = _cmsAvailable || (peopleData[0] && peopleData[0].hasOwnProperty('name') && peopleData[0].hasOwnProperty('group'));
		if (useStandardPeople) {
			peopleData.forEach(function (row) {
				var key = normalize(row.name || '');
				if (!key) return;
				var grp = String(row.group || '').trim() || UNASSIGNED;
				var phone = String(row.phone || '').trim();
				groupMap[key] = { group: grp, phone: phone };
			});
		} else {
			var nameCol = v('people-col-name'), groupCol = v('people-col-group'), phoneCol = v('people-col-phone');
			peopleData.forEach(function (row) {
				var key = normalize(row[nameCol] || '');
				if (!key) return;
				var grp = String(row[groupCol] || '').trim() || UNASSIGNED;
				var phone = phoneCol ? String(row[phoneCol] || '').trim() : '';
				groupMap[key] = { group: grp, phone: phone };
			});
		}
	}

	// Build cash payment map from cashData (standardized fields when CMS, column-mapped when file-only)
	var useStandardCash = _cmsAvailable || (cashData[0] && cashData[0].hasOwnProperty('donorName'));
	var cashPayMap = {};
	if (useStandardCash) {
		cashData.forEach(function (row) {
			var key = normalize(row.donorName || '');
			if (!key) return;
			if (!cashPayMap[key]) cashPayMap[key] = [];
			cashPayMap[key].push({
				date: String(row.date || ''),
				amount: Number(row.amount) || 0,
				note: String(row.note || '')
			});
		});
	} else {
		var cashDonorC = v('cash-col-donor'), cashAmC = v('cash-col-amount'),
			cashDateC = v('cash-col-date'), cashNoteC = v('cash-col-note');
		var explSel = document.getElementById('cash-col-expl-val');
		var cashExplFilter = explSel ? explSel.value.trim() : '';
		var filteredCash = cashData.filter(function (row) {
			if (!cashExplFilter) return true;
			var expl = String(row[cashNoteC] || '').trim();
			return expl.toLowerCase() === cashExplFilter.toLowerCase();
		});
		filteredCash.forEach(function (row) {
			if (!cashDonorC || !cashAmC) return;
			var key = normalize(row[cashDonorC]);
			if (!key) return;
			if (!cashPayMap[key]) cashPayMap[key] = [];
			cashPayMap[key].push({
				date: cashDateC ? String(row[cashDateC] || '') : '',
				amount: parseFloat(String(row[cashAmC]).replace(/[^0-9.]/g, '')) || 0,
				note: cashNoteC ? String(row[cashNoteC] || '') : ''
			});
		});
	}

	combined = qbData.map(function (row) {
		var donor = String(row[QB_COLS.donor] || '').trim();
		var key = normalize(donor);
		var pledged = parseFloat(String(row[QB_COLS.amount] || '').replace(/[^0-9.]/g, '')) || 0;
		var qbBalRaw = row[QB_COLS.balance];
		var qbBalance = (qbBalRaw !== '' && qbBalRaw !== undefined && qbBalRaw !== null)
			? parseFloat(String(qbBalRaw).replace(/[^0-9.]/g, '')) : null;
		var payments = cashPayMap[key] || [];
		var cashPaid = payments.reduce(function (s, p) { return s + p.amount; }, 0);
		var paid, balance, qbPaid = 0;
		if (qbBalance !== null && !isNaN(qbBalance)) {
			qbPaid = pledged - qbBalance;
			paid = qbPaid + cashPaid;
			balance = pledged - paid;
		} else {
			paid = cashPaid;
			balance = pledged - paid;
		}
		if (balance < 0) balance = 0;
		var status = paid >= pledged ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
		var pct = pledged > 0 ? Math.min(100, Math.round(paid / pledged * 100)) : 0;
		var personInfo = groupMap[key] || {};
		var group = personInfo.group || UNASSIGNED;
		var phone = personInfo.phone || '';
		return {
			donor: donor, key: key, group: group, phone: phone,
			invoice: String(row[QB_COLS.invoice] || ''), date: String(row[QB_COLS.date] || ''),
			pledged: pledged, paid: paid, balance: balance, status: status, pct: pct, qbPaid: qbPaid,
			payments: payments.map(function (p) { return { date: p.date, amount: p.amount, note: p.note }; })
		};
	});

	// ── Build unpledged list ──────────────────────────────────
	var qbKeys = new Set(combined.map(function (r) { return r.key; }));
	unpledged = [];
	if (peopleData.length) {
		var useStdP = _cmsAvailable || (peopleData[0] && peopleData[0].hasOwnProperty('name') && peopleData[0].hasOwnProperty('group'));
		if (useStdP) {
			peopleData.forEach(function (row) {
				var orig = String(row.name || '').trim();
				var key = normalize(orig);
				if (!key || qbKeys.has(key)) return;
				var grp = String(row.group || '').trim() || UNASSIGNED;
				var phone = String(row.phone || '').trim();
				unpledged.push({ name: orig, key: key, group: grp, phone: phone });
			});
		} else {
			var ncol = v('people-col-name');
			var gcol = v('people-col-group');
			var pcol = v('people-col-phone');
			peopleData.forEach(function (row) {
				var orig = String(row[ncol] || '').trim();
				var key = normalize(orig);
				if (!key || qbKeys.has(key)) return;
				var grp = String(row[gcol] || '').trim() || UNASSIGNED;
				var phone = pcol ? String(row[pcol] || '').trim() : '';
				unpledged.push({ name: orig, key: key, group: grp, phone: phone });
			});
		}
	}

	// ── Append people without pledges as 0-pledge records ─────
	if (peopleData.length) {
		var useStdP3 = _cmsAvailable || (peopleData[0] && peopleData[0].hasOwnProperty('name') && peopleData[0].hasOwnProperty('group'));
		if (useStdP3) {
			peopleData.forEach(function (row) {
				var orig = String(row.name || '').trim();
				var key = normalize(orig);
				if (!key || qbKeys.has(key)) return;
				combined.push({
					donor: orig, key: key,
					group: String(row.group || '').trim() || UNASSIGNED,
					phone: String(row.phone || '').trim(),
					invoice: '', date: '',
					pledged: 0, paid: 0, balance: 0,
					status: 'nopledge', pct: 0, qbPaid: 0,
					payments: []
				});
			});
		} else {
			var ncol3 = v('people-col-name');
			var gcol3 = v('people-col-group');
			var pcol3 = v('people-col-phone');
			peopleData.forEach(function (row) {
				var orig = String(row[ncol3] || '').trim();
				var key = normalize(orig);
				if (!key || qbKeys.has(key)) return;
				combined.push({
					donor: orig, key: key,
					group: String(row[gcol3] || '').trim() || UNASSIGNED,
					phone: pcol3 ? String(row[pcol3] || '').trim() : '',
					invoice: '', date: '',
					pledged: 0, paid: 0, balance: 0,
					status: 'nopledge', pct: 0, qbPaid: 0,
					payments: []
				});
			});
		}
	}

	var totalPledged = combined.reduce(function (s, r) { return s + r.pledged; }, 0);
	var totalPaid = combined.reduce(function (s, r) { return s + r.paid; }, 0);
	var totalBalance = combined.reduce(function (s, r) { return s + r.balance; }, 0);

	if (btn) btn.disabled = false;
	if (btnText) btnText.textContent = 'Combine & Generate Report';

	var pill = document.getElementById('header-status');
	var pillText = document.getElementById('header-status-text');
	if (pill && pillText) {
		pillText.textContent = combined.length + ' donors \u00b7 ' + new Date().toLocaleTimeString();
		pill.style.display = 'flex';
	}

	setBannerTime(new Date().toISOString());
	document.getElementById('no-report-state').style.display = 'none';
	document.getElementById('report-content').style.display = 'block';

	// ── MISMATCH DETECTION ────────────────────────────────────
	var qbNames = {}, cashNames = {}, peopleOrig = {};
	qbData.forEach(function (row) {
		var orig = String(row[QB_COLS.donor] || '').trim();
		var key = normalize(orig);
		if (key) qbNames[key] = orig;
	});
	// Cash names for mismatch detection
	var useStdC = _cmsAvailable || (cashData[0] && cashData[0].hasOwnProperty('donorName'));
	if (useStdC) {
		cashData.forEach(function (row) {
			var orig = String(row.donorName || '').trim();
			var key = normalize(orig);
			if (key) cashNames[key] = orig;
		});
	} else {
		var cashDonorC2 = v('cash-col-donor'), cashNoteC2 = v('cash-col-note');
		var explSel2 = document.getElementById('cash-col-expl-val');
		var cashExplFilter2 = explSel2 ? explSel2.value.trim() : '';
		var filteredCash2 = cashData.filter(function (row) {
			if (!cashExplFilter2) return true;
			return String(row[cashNoteC2] || '').trim().toLowerCase() === cashExplFilter2.toLowerCase();
		});
		if (cashDonorC2) {
			filteredCash2.forEach(function (row) {
				var orig = String(row[cashDonorC2] || '').trim();
				var key = normalize(orig);
				if (key) cashNames[key] = orig;
			});
		}
	}
	if (peopleData.length) {
		var useStdP2 = _cmsAvailable || (peopleData[0] && peopleData[0].hasOwnProperty('name') && peopleData[0].hasOwnProperty('group'));
		if (useStdP2) {
			peopleData.forEach(function (row) {
				var orig = String(row.name || '').trim();
				var key = normalize(orig);
				if (key) peopleOrig[key] = orig;
			});
		} else {
			var nameColP = v('people-col-name');
			peopleData.forEach(function (row) {
				var orig = String(row[nameColP] || '').trim();
				var key = normalize(orig);
				if (key) peopleOrig[key] = orig;
			});
		}
	}
	var peopleKeys = new Set(Object.keys(peopleOrig));
	function isCaseOnly(a, b) { return a.toLowerCase() === b.toLowerCase() && a !== b; }
	var mismatches = [], seenM = new Set();
	function addIssue(source, nameOrig, detail, priority) {
		var dedup = source + '|' + normalize(nameOrig);
		if (seenM.has(dedup)) return;
		seenM.add(dedup);
		mismatches.push({ source: source, name: nameOrig, detail: detail, priority: priority || 'High' });
	}
	if (peopleData.length) {
		Object.keys(qbNames).forEach(function (key) {
			var orig = qbNames[key];
			if (peopleKeys.has(key)) return;
			var caseMatch = peopleOrig[key];
			if (caseMatch) { if (isCaseOnly(orig, caseMatch)) addIssue('QuickBooks', orig, 'Case mismatch with People file: "' + caseMatch + '"', 'Low'); return; }
			addIssue('QuickBooks', orig, 'Not found in People/Groups file \u2014 check spelling or add to people list', 'High');
		});
		Object.keys(cashNames).forEach(function (key) {
			var orig = cashNames[key];
			if (peopleKeys.has(key)) return;
			addIssue('Cash Payments', orig, 'Not found in People/Groups file \u2014 check spelling or add to people list', 'High');
		});
		Object.keys(cashNames).forEach(function (key) {
			var orig = cashNames[key];
			if (!qbNames[key]) addIssue('Cash Payments', orig, 'No matching QuickBooks invoice \u2014 payment cannot be linked to a pledge', 'High');
		});
	} else {
		Object.keys(cashNames).forEach(function (key) {
			var orig = cashNames[key];
			if (!qbNames[key]) addIssue('Cash Payments', orig, 'No matching QuickBooks invoice \u2014 payment cannot be linked to a pledge', 'High');
		});
	}
	mismatches.sort(function (a, b) {
		if (a.priority !== b.priority) return a.priority === 'High' ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
	renderWarnings(mismatches);

	// ── Show/hide No-Pledge tabs ──────────────────────────────
	var hasUnpledged = unpledged.length > 0;
	document.getElementById('tab-btn-nopledge-list').style.display = hasUnpledged ? '' : 'none';
	document.getElementById('tab-btn-nopledge-group').style.display = hasUnpledged ? '' : 'none';

	if (hasUnpledged) {
		var npGroupsArr = [];
		var npGroupSet = {};
		unpledged.forEach(function (r) { if (!npGroupSet[r.group]) { npGroupSet[r.group] = true; npGroupsArr.push(r.group); } });
		npGroupsArr.sort(function (a, b) { return a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b); });
		var npSel = document.getElementById('nopledge-filter-group');
		npSel.innerHTML = '<option value="">All groups</option>';
		npGroupsArr.forEach(function (g) { var o = document.createElement('option'); o.value = g; o.textContent = g; npSel.appendChild(o); });
	}

	updateStats();
	populateGroupFilters();
	document.getElementById('stats-row').style.display = 'grid';
	document.getElementById('report-content').style.display = 'block';
	document.getElementById('no-report-state').style.display = 'none';
	document.getElementById('notice').style.display = 'none';

	renderFlat();
	renderGroupView();
	renderSummary();
	renderCards();
	if (hasUnpledged) { renderNoPledgeList(); renderNoPledgeGroup(); }

	updateTabBadges();

	// ── Auto-save full report payload (incl. mismatches) ─────
	var reportPayload = {
		generatedAt: new Date().toISOString(),
		sourceUrls: { qb: _sourceUrls.qb, cash: _sourceUrls.cash, people: _sourceUrls.people },
		summary: {
			donors: new Set(combined.map(function (r) { return r.key; })).size,
			groups: new Set(combined.map(function (r) { return r.group; })).size,
			pledged: totalPledged,
			paid: totalPaid,
			balance: totalBalance,
			fullyPaid: combined.filter(function (r) { return r.status === 'paid'; }).length,
			unpaid: combined.filter(function (r) { return r.status === 'unpaid'; }).length
		},
		records: combined.map(function (r) {
			return {
				donor: r.donor, group: r.group, phone: r.phone, invoice: r.invoice,
				date: r.date, pledged: r.pledged, paid: r.paid, balance: r.balance,
				status: r.status, pct: r.pct, qbPaid: r.qbPaid,
				payments: (r.payments || []).map(function (p) { return { date: String(p.date || ''), amount: Number(p.amount) || 0, note: String(p.note || '') }; })
			};
		}),
		unpledgedRecords: unpledged.map(function (r) {
			return { name: r.name, group: r.group, phone: r.phone };
		}),
		qbRecords: qbData,
		cashRecords: cashData,
		peopleRecords: peopleData,
		mismatches: mismatches,
		resolvedMismatches: Object.keys(warnResolved)
	};

	logUndefinedPaths(reportPayload, 'reportPayload');
	console.log('[PledgeTracker] SAVING to CMS:', JSON.stringify(sanitizeForSave(reportPayload)));
	_isSaving = true;
	tool.setValue(sanitizeForSave(reportPayload));
	setTimeout(function () { _isSaving = false; }, 200);
	tool.notify('Report generated and saved \u2713', 'success');

	setFileTabsVisible(false);
	switchTab('dashboard');
	switchTopTab('reports');
	scheduleResize();
}

function updateStats() {
	var pledged = combined.reduce(function (s, r) { return s + r.pledged; }, 0);
	var paid = combined.reduce(function (s, r) { return s + r.paid; }, 0);
	var balance = combined.reduce(function (s, r) { return s + r.balance; }, 0);
	document.getElementById('s-donors').textContent = new Set(combined.map(function (r) { return r.key; })).size;
	document.getElementById('s-groups').textContent = new Set(combined.map(function (r) { return r.group; })).size;
	document.getElementById('s-pledged').textContent = fmt(pledged);
	document.getElementById('s-paid').textContent = fmt(paid);
	document.getElementById('s-balance').textContent = fmt(balance);
	document.getElementById('s-full').textContent = combined.filter(function (r) { return r.status === 'paid'; }).length;
	document.getElementById('s-unpaid').textContent = combined.filter(function (r) { return r.status === 'unpaid'; }).length;
	var npEl = document.getElementById('s-nopledge');
	if (npEl) npEl.textContent = combined.filter(function (r) { return r.status === 'nopledge'; }).length;
}

function populateGroupFilters() {
	var groupsArr = [];
	var groupSet = {};
	combined.forEach(function (r) { if (!groupSet[r.group]) { groupSet[r.group] = true; groupsArr.push(r.group); } });
	groupsArr.sort(function (a, b) { return a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b); });
	['filter-group', 'cards-filter-group'].forEach(function (id) {
		var sel = document.getElementById(id);
		sel.innerHTML = '<option value="">All groups</option>';
		groupsArr.forEach(function (g) { var o = document.createElement('option'); o.value = g; o.textContent = g; sel.appendChild(o); });
	});
}

function switchTab(name) {
	document.querySelectorAll('.tab-btn').forEach(function (b) {
		var matches = b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + name + "'");
		b.classList.toggle('active', matches);
	});
	document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
	document.getElementById('tab-' + name).classList.add('active');
	scheduleResize();
}

// ── FLAT LIST ─────────────────────────────────────────────
function sortBy(col) {
	if (sortCol === col) sortDir *= -1; else { sortCol = col; sortDir = 1; }
	renderFlat();
}
function renderFlat() {
	var search = normalize(v('search')), statusF = v('filter-status'), groupF = v('filter-group');
	var rows = combined.filter(function (r) {
		if (search && !normalize(r.donor).includes(search) && !normalize(r.invoice).includes(search)) return false;
		if (statusF && r.status !== statusF) return false;
		if (groupF && r.group !== groupF) return false;
		return true;
	});
	rows.sort(function (a, b) {
		var p = pledgedFirst(a, b);
		if (p !== 0) return p;
		var av = a[sortCol], bv = b[sortCol];
		if (typeof av === 'string') av = av.toLowerCase();
		if (typeof bv === 'string') bv = bv.toLowerCase();
		return av < bv ? -sortDir : av > bv ? sortDir : 0;
	});
	var tbody = document.getElementById('report-body');
	tbody.innerHTML = '';
	if (!rows.length) {
		tbody.innerHTML = '<tr><td colspan="11"><div class="empty-state"><div class="e-icon">\ud83d\udd0d</div><h3>No results</h3><p>Adjust your search or filter.</p></div></td></tr>';
		document.getElementById('row-count').textContent = '';
		return;
	}
	rows.forEach(function (r, i) {
		var tr = document.createElement('tr');
		tr.innerHTML =
			'<td><span class="expand-btn" onclick="toggleFlatDetail(' + i + ')" data-expand="' + i + '">\u25b6</span></td>' +
			'<td style="color:var(--c-text3);font-size:11px;font-weight:700">' + (i + 1) + '</td>' +
			'<td><div class="donor-name">' + esc(r.donor) + '</div>' + (r.phone ? '<div style="font-size:11px;color:var(--c-text3);margin-top:2px">' + esc(r.phone) + '</div>' : '') + '</td>' +
			'<td><span style="font-size:11px;font-weight:700;color:var(--c-blue);background:var(--c-blue-bg);padding:2px 8px;border-radius:12px">' + esc(r.group) + '</span></td>' +
			'<td><span class="invoice-no">' + esc(r.invoice) + '</span></td>' +
			'<td style="color:var(--c-text2);font-size:12px">' + esc(r.date) + '</td>' +
			'<td style="font-weight:800">' + fmt(r.pledged) + '</td>' +
			'<td style="font-weight:800;color:var(--c-green)">' + fmt(r.paid) + '</td>' +
			'<td style="font-weight:800;color:var(--c-red)">' + fmt(r.balance) + '</td>' +
			'<td><div style="display:flex;align-items:center;gap:6px"><div class="progress-bar"><div class="progress-fill ' + fillClass(r.status) + '" style="width:' + r.pct + '%"></div></div><span style="font-size:10px;color:var(--c-text3);font-weight:600">' + r.pct + '%</span></div></td>' +
			'<td>' + badge(r.status) + '</td>';
		tr.dataset.idx = i;
		tbody.appendChild(tr);
		var dtr = document.createElement('tr');
		dtr.id = 'flat-detail-' + i;
		dtr.className = 'detail-row';
		dtr.style.display = 'none';
		var payHtml = r.payments && r.payments.length
			? '<table style="width:100%"><thead><tr><th>Date</th><th>Amount</th><th>Note</th></tr></thead><tbody>' +
			r.payments.map(function (p) { return '<tr><td>' + esc(p.date) + '</td><td style="color:var(--c-green);font-weight:700">' + fmt(p.amount) + '</td><td style="color:var(--c-text2)">' + esc(p.note) + '</td></tr>'; }).join('') +
			'</tbody></table>'
			: '<p style="font-size:12px;color:var(--c-text3)">No cash payments recorded.</p>';
		var cashPaid = (r.payments || []).reduce(function (s, p) { return s + (Number(p.amount) || 0); }, 0);
		var qbPaid = (r.qbPaid === undefined || r.qbPaid === null)
			? Math.max(0, (Number(r.pledged) || 0) - (Number(r.balance) || 0) - cashPaid)
			: (Number(r.qbPaid) || 0);
		var sumHtml = '<div class="detail-summary">' +
			'<div class="ds-item"><span class="ds-label">From QuickBooks invoices</span><span class="ds-value ds-qb">' + fmt(qbPaid) + '</span></div>' +
			'<div class="ds-item"><span class="ds-label">From cash payments</span><span class="ds-value ds-cash">' + fmt(cashPaid) + '</span></div>' +
			'<div class="ds-item"><span class="ds-label">Total paid</span><span class="ds-value">' + fmt(Number(r.paid) || 0) + '</span></div>' +
			'</div>';
		dtr.innerHTML = '<td colspan="11"><div class="detail-inner">' + sumHtml + '<div class="section-title-sm" style="margin-top:8px">Cash payment list</div>' + payHtml + '</div></td>';
		tbody.appendChild(dtr);
	});
	document.getElementById('row-count').textContent = rows.length + ' of ' + combined.length + ' records shown';
}
function toggleFlatDetail(idx) {
	var dtr = document.getElementById('flat-detail-' + idx);
	var btn = document.querySelector('[data-expand="' + idx + '"]');
	if (!dtr || !btn) return;
	var open = dtr.style.display === 'none';
	dtr.style.display = open ? '' : 'none';
	btn.textContent = open ? '\u25bc' : '\u25b6';
	scheduleResize();
}

// ── GROUP VIEW ────────────────────────────────────────────
function renderGroupView() {
	var search = normalize(v('group-search')), statusF = v('group-filter-status');
	var container = document.getElementById('group-view');
	container.innerHTML = '';
	var groups = {};
	combined.forEach(function (r) {
		if (search && !normalize(r.donor).includes(search)) return;
		if (statusF && r.status !== statusF) return;
		if (!groups[r.group]) groups[r.group] = [];
		groups[r.group].push(r);
	});
	if (!Object.keys(groups).length) {
		container.innerHTML = '<div class="empty-state"><div class="e-icon">\ud83d\udd0d</div><h3>No results</h3></div>';
		return;
	}
	var sortedGroups = Object.keys(groups).sort(function (a, b) { return a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b); });
	sortedGroups.forEach(function (grp) {
		var members = groups[grp];
		members.sort(function (a, b) {
			var p = pledgedFirst(a, b);
			if (p !== 0) return p;
			return (a.donor || '').localeCompare(b.donor || '');
		});
		var tPledged = members.reduce(function (s, r) { return s + r.pledged; }, 0);
		var tPaid = members.reduce(function (s, r) { return s + r.paid; }, 0);
		var tBalance = members.reduce(function (s, r) { return s + r.balance; }, 0);
		var pct = tPledged > 0 ? Math.round(tPaid / tPledged * 100) : 0;
		var card = document.createElement('div');
		card.className = 'group-card';
		card.innerHTML =
			'<div class="group-header" onclick="toggleGroup(this)">' +
			'<div class="group-title">\u25b6 ' + esc(grp) + ' <span style="font-size:11px;color:var(--c-text3);font-weight:500">' + members.length + ' donor' + (members.length !== 1 ? 's' : '') + '</span></div>' +
			'<div class="group-meta">' +
			'<span>Pledged: <strong>' + fmt(tPledged) + '</strong></span>' +
			'<span>Paid: <strong style="color:var(--c-green)">' + fmt(tPaid) + '</strong></span>' +
			'<span>Balance: <strong style="color:var(--c-red)">' + fmt(tBalance) + '</strong></span>' +
			'<span style="color:var(--c-blue);font-weight:800">' + pct + '% collected</span>' +
			'</div>' +
			'<div class="group-actions" onclick="event.stopPropagation()">' + imgBtns(grp) + '</div>' +
			'</div>' +
			'<div class="group-body">' +
			'<table><thead><tr><th>Donor</th><th>Invoice #</th><th>Date</th><th>Pledged</th><th>Paid</th><th>Balance</th><th>Progress</th><th>Status</th></tr></thead>' +
			'<tbody>' + members.map(function (r) {
				return '<tr>' +
					'<td><div class="donor-name">' + esc(r.donor) + '</div>' + (r.phone ? '<div style="font-size:11px;color:var(--c-text3)">' + esc(r.phone) + '</div>' : '') + '</td>' +
					'<td><span class="invoice-no">' + esc(r.invoice) + '</span></td>' +
					'<td style="font-size:12px;color:var(--c-text2)">' + esc(r.date) + '</td>' +
					'<td style="font-weight:800">' + fmt(r.pledged) + '</td>' +
					'<td style="color:var(--c-green);font-weight:700">' + fmt(r.paid) + '</td>' +
					'<td style="color:var(--c-red);font-weight:700">' + fmt(r.balance) + '</td>' +
					'<td><div style="display:flex;align-items:center;gap:6px"><div class="progress-bar"><div class="progress-fill ' + fillClass(r.status) + '" style="width:' + r.pct + '%"></div></div><span style="font-size:10px;color:var(--c-text3)">' + r.pct + '%</span></div></td>' +
					'<td>' + badge(r.status) + '</td>' +
					'</tr>';
			}).join('') + '</tbody></table>' +
			'</div>';
		container.appendChild(card);
	});
}
function toggleGroup(header) {
	var body = header.nextElementSibling;
	var arrow = header.querySelector('.group-title');
	var open = body.classList.toggle('open');
	arrow.innerHTML = arrow.innerHTML.replace(open ? '\u25b6' : '\u25bc', open ? '\u25bc' : '\u25b6');
	scheduleResize();
}
function expandAll() { document.querySelectorAll('#group-view .group-body').forEach(function (b) { if (!b.classList.contains('open')) toggleGroup(b.previousElementSibling); }); }
function collapseAll() { document.querySelectorAll('#group-view .group-body.open').forEach(function (b) { toggleGroup(b.previousElementSibling); }); }

// ── SUMMARY ───────────────────────────────────────────────
function renderSummary() {
	var groups = {};
	combined.forEach(function (r) {
		if (!groups[r.group]) groups[r.group] = { pledged: 0, paid: 0, balance: 0, count: 0, full: 0, unpaid: 0 };
		var g = groups[r.group];
		g.pledged += r.pledged; g.paid += r.paid; g.balance += r.balance; g.count++;
		if (r.status === 'paid') g.full++; if (r.status === 'unpaid') g.unpaid++;
	});
	var sortedGroups = Object.keys(groups).sort(function (a, b) { return a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b); });
	var tbody = document.getElementById('summary-body');
	tbody.innerHTML = '';
	var totals = { pledged: 0, paid: 0, balance: 0, count: 0, full: 0, unpaid: 0 };
	sortedGroups.forEach(function (grp) {
		var g = groups[grp];
		var pct = g.pledged > 0 ? Math.round(g.paid / g.pledged * 100) : 0;
		Object.keys(totals).forEach(function (k) { totals[k] += g[k]; });
		var tr = document.createElement('tr');
		tr.innerHTML =
			'<td style="font-weight:800">' + esc(grp) + '</td>' +
			'<td>' + g.count + '</td>' +
			'<td style="font-weight:800">' + fmt(g.pledged) + '</td>' +
			'<td style="color:var(--c-green);font-weight:800">' + fmt(g.paid) + '</td>' +
			'<td style="color:var(--c-red);font-weight:800">' + fmt(g.balance) + '</td>' +
			'<td><div style="display:flex;align-items:center;gap:8px"><div class="progress-bar" style="width:100px"><div class="progress-fill ' + (pct === 100 ? 'fill-paid' : pct > 0 ? 'fill-partial' : 'fill-unpaid') + '" style="width:' + pct + '%"></div></div><span style="font-size:12px;font-weight:700">' + pct + '%</span></div></td>' +
			'<td style="color:var(--c-green);font-weight:800">' + g.full + '</td>' +
			'<td style="color:var(--c-red);font-weight:800">' + g.unpaid + '</td>' +
			'<td><div class="share-cell">' + imgBtns(grp) + '</div></td>';
		tbody.appendChild(tr);
	});
	var tpct = totals.pledged > 0 ? Math.round(totals.paid / totals.pledged * 100) : 0;
	var ttr = document.createElement('tr');
	ttr.style.cssText = 'background:linear-gradient(135deg,var(--c-blue-bg),var(--c-indigo-bg));font-weight:900;border-top:2px solid var(--c-blue)';
	ttr.innerHTML =
		'<td style="color:var(--c-blue);font-weight:900">TOTAL</td>' +
		'<td>' + totals.count + '</td>' +
		'<td style="font-weight:900">' + fmt(totals.pledged) + '</td>' +
		'<td style="color:var(--c-green);font-weight:900">' + fmt(totals.paid) + '</td>' +
		'<td style="color:var(--c-red);font-weight:900">' + fmt(totals.balance) + '</td>' +
		'<td><div style="display:flex;align-items:center;gap:8px"><div class="progress-bar" style="width:100px"><div class="progress-fill fill-partial" style="width:' + tpct + '%"></div></div><span style="font-size:12px;font-weight:800">' + tpct + '%</span></div></td>' +
		'<td style="color:var(--c-green);font-weight:900">' + totals.full + '</td>' +
		'<td style="color:var(--c-red);font-weight:900">' + totals.unpaid + '</td>' +
		'<td></td>';
	tbody.appendChild(ttr);
}

// ── DONOR CARDS ───────────────────────────────────────────
function renderCards() {
	var search = normalize(v('cards-search')), groupF = v('cards-filter-group'), statusF = v('cards-filter-status');
	var grid = document.getElementById('cards-grid');
	grid.innerHTML = '';
	var rows = combined.filter(function (r) {
		if (search && !normalize(r.donor).includes(search)) return false;
		if (groupF && r.group !== groupF) return false;
		if (statusF && r.status !== statusF) return false;
		return true;
	}).sort(function (a, b) {
		var g = a.group.localeCompare(b.group);
		if (g !== 0) return g;
		var p = pledgedFirst(a, b);
		if (p !== 0) return p;
		return a.donor.localeCompare(b.donor);
	});
	if (!rows.length) { grid.innerHTML = '<div class="empty-state"><div class="e-icon">\ud83d\udd0d</div><h3>No results</h3></div>'; return; }
	rows.forEach(function (r) {
		var fillGrad = r.status === 'paid' ? 'linear-gradient(90deg,#15803d,#22c55e)' : r.status === 'partial' ? 'linear-gradient(90deg,#b45309,#f59e0b)' : 'linear-gradient(90deg,#b91c1c,#ef4444)';
		var card = document.createElement('div');
		card.className = 'donor-card';
		var payRows = r.payments && r.payments.length
			? r.payments.map(function (p) { return '<div class="dc-pay-row"><span>' + esc(p.date) + '</span><span style="color:var(--c-green);font-weight:700">' + fmt(p.amount) + '</span><span style="color:var(--c-text3)">' + esc(p.note) + '</span></div>'; }).join('')
			: '<div style="color:var(--c-text3)">No cash payments</div>';
		card.innerHTML =
			'<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">' +
			'<div><div class="dc-name">' + esc(r.donor) + '</div><div class="dc-group">' + esc(r.group) + (r.phone ? ' \u00b7 ' + esc(r.phone) : '') + '</div></div>' +
			badge(r.status) +
			'</div>' +
			'<div class="dc-bar"><div class="dc-bar-fill" style="width:' + r.pct + '%;background:' + fillGrad + '"></div></div>' +
			'<div style="text-align:right;font-size:10px;color:var(--c-text3);margin-bottom:6px;font-weight:600">' + r.pct + '% complete</div>' +
			'<div class="dc-row"><span class="label">Invoice #</span><span class="invoice-no">' + esc(r.invoice) + '</span></div>' +
			'<div class="dc-row"><span class="label">Date</span><span>' + esc(r.date) + '</span></div>' +
			'<div class="dc-row"><span class="label">Pledged</span><span style="font-weight:800">' + fmt(r.pledged) + '</span></div>' +
			'<div class="dc-row"><span class="label">Paid</span><span style="color:var(--c-green);font-weight:800">' + fmt(r.paid) + '</span></div>' +
			'<div class="dc-row"><span class="label">Balance</span><span style="color:var(--c-red);font-weight:800">' + fmt(r.balance) + '</span></div>' +
			'<div class="dc-payments"><div class="section-title-sm" style="margin-top:10px;margin-bottom:6px">Cash Payments</div>' + payRows + '</div>';
		grid.appendChild(card);
	});
}

// ── NO PLEDGE ─────────────────────────────────────────────
function npSortBy(col) {
	if (npSortCol === col) npSortDir *= -1; else { npSortCol = col; npSortDir = 1; }
	renderNoPledgeList();
}
function renderNoPledgeList() {
	var search = normalize(document.getElementById('nopledge-search').value);
	var groupF = document.getElementById('nopledge-filter-group').value;
	var tbody = document.getElementById('nopledge-body');
	var countEl = document.getElementById('nopledge-count');
	var rows = unpledged.filter(function (r) {
		if (search && !normalize(r.name).includes(search)) return false;
		if (groupF && r.group !== groupF) return false;
		return true;
	});
	rows.sort(function (a, b) {
		var av = a[npSortCol], bv = b[npSortCol];
		if (typeof av === 'string') av = av.toLowerCase();
		if (typeof bv === 'string') bv = bv.toLowerCase();
		return av < bv ? -npSortDir : av > bv ? npSortDir : 0;
	});
	tbody.innerHTML = '';
	if (!rows.length) {
		tbody.innerHTML = '<tr><td colspan="3"><div class="empty-state"><div class="e-icon">\ud83d\udd0d</div><h3>No results</h3></div></td></tr>';
		countEl.textContent = ''; return;
	}
	rows.forEach(function (r) {
		var tr = document.createElement('tr');
		tr.innerHTML = '<td><div class="donor-name">' + esc(r.name) + '</div></td>' +
			'<td><span style="font-size:11px;font-weight:700;color:var(--c-amber);background:var(--c-amber-bg);padding:2px 8px;border-radius:12px">' + esc(r.group) + '</span></td>' +
			'<td style="font-size:12px;color:var(--c-text3)">' + esc(r.phone) + '</td>';
		tbody.appendChild(tr);
	});
	countEl.textContent = rows.length + ' of ' + unpledged.length + ' people \u2014 no pledge on file';
}
function renderNoPledgeGroup() {
	var search = normalize(document.getElementById('nopledge-group-search').value);
	var container = document.getElementById('nopledge-group-view');
	container.innerHTML = '';
	var groups = {};
	unpledged.forEach(function (r) {
		if (search && !normalize(r.name).includes(search)) return;
		if (!groups[r.group]) groups[r.group] = [];
		groups[r.group].push(r);
	});
	if (!Object.keys(groups).length) { container.innerHTML = '<div class="empty-state"><div class="e-icon">\ud83d\udd0d</div><h3>No results</h3></div>'; return; }
	var sortedGroups = Object.keys(groups).sort(function (a, b) { return a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b); });
	sortedGroups.forEach(function (grp) {
		var members = groups[grp].slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
		var card = document.createElement('div');
		card.className = 'group-card';
		var memberRows = members.map(function (r) {
			return '<tr>' +
				'<td><div class="donor-name">' + esc(r.name) + '</div></td>' +
				'<td style="font-size:12px;color:var(--c-text3)">' + esc(r.phone) + '</td>' +
				'<td><span class="badge" style="background:linear-gradient(135deg,var(--c-amber-bg),#fef3c7);color:var(--c-amber);border:1px solid var(--c-amber-mid)">No Pledge</span></td>' +
				'</tr>';
		}).join('');
		card.innerHTML =
			'<div class="group-header" onclick="npToggleGroup(this)">' +
			'<div class="group-title">\u25b6 ' + esc(grp) + ' <span style="font-size:11px;color:var(--c-text3);font-weight:500">' + members.length + ' person' + (members.length !== 1 ? 's' : '') + ' \u2014 no pledge</span></div>' +
			'<div class="group-meta"><span style="color:var(--c-amber);font-weight:700">\u26a0 ' + members.length + ' pending pledge' + (members.length !== 1 ? 's' : '') + '</span></div>' +
			'</div>' +
			'<div class="group-body"><table><thead><tr><th>Name</th><th>Phone</th><th>Status</th></tr></thead><tbody>' + memberRows + '</tbody></table></div>';
		container.appendChild(card);
	});
}
function npToggleGroup(header) {
	var body = header.nextElementSibling;
	var arrow = header.querySelector('.group-title');
	var open = body.classList.toggle('open');
	arrow.innerHTML = arrow.innerHTML.replace(open ? '\u25b6' : '\u25bc', open ? '\u25bc' : '\u25b6');
	scheduleResize();
}
function npExpandAll() { document.querySelectorAll('#nopledge-group-view .group-body').forEach(function (b) { if (!b.classList.contains('open')) npToggleGroup(b.previousElementSibling); }); }
function npCollapseAll() { document.querySelectorAll('#nopledge-group-view .group-body.open').forEach(function (b) { npToggleGroup(b.previousElementSibling); }); }

// ── EXPORT EXCEL ──────────────────────────────────────────
function styleSheet(ws, colWidths) { ws['!cols'] = colWidths.map(function (w) { return { wch: w }; }); }
function fmtNum(n) { return Number(n || 0).toFixed(2); }

// ── Excel formatting helpers ─────────────────────────────
var XL_STYLES = {
	hdr: { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '1D4ED8' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { bottom: { style: 'medium', color: { rgb: '93C5FD' } } } },
	title: { font: { bold: true, sz: 16, color: { rgb: '0F172A' } }, alignment: { vertical: 'center', horizontal: 'left' } },
	sub: { font: { sz: 9, color: { rgb: '64748B' } }, alignment: { vertical: 'center', horizontal: 'left' } },
	tot: { font: { bold: true, sz: 11, color: { rgb: '1E3A8A' } }, fill: { fgColor: { rgb: 'DBEAFE' } } },
	zebra: { fill: { fgColor: { rgb: 'F8FAFC' } } },
	groupCell: { font: { bold: true, color: { rgb: '1D4ED8' } } },
	donorCell: { font: { bold: true, color: { rgb: '0F172A' } } },
	center: { alignment: { horizontal: 'center' } },
	bar: { font: { name: 'Consolas', sz: 9, color: { rgb: '334155' } }, alignment: { horizontal: 'left', vertical: 'center' } },
	barStyle: function (s) {
		var col = s === 'paid' ? '15803D' : s === 'partial' ? 'B45309' : s === 'nopledge' ? '64748B' : 'B91C1C';
		var bg = s === 'paid' ? 'F0FDF4' : s === 'partial' ? 'FFFBEB' : s === 'nopledge' ? 'F1F5F9' : 'FEF2F2';
		return { font: { name: 'Consolas', sz: 9, bold: true, color: { rgb: col } }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: 'left', vertical: 'center' } };
	},
	pctStyle: function (s) {
		var col = s === 'paid' ? '15803D' : s === 'partial' ? 'B45309' : s === 'nopledge' ? '64748B' : 'B91C1C';
		return { font: { bold: true, color: { rgb: col } }, alignment: { horizontal: 'center' } };
	},
	moneyFmt: '$#,##0.00',
	pctFmt: '0"%"',
	statusStyle: function (s) {
		if (s === 'paid') return { font: { bold: true, color: { rgb: '15803D' } }, fill: { fgColor: { rgb: 'F0FDF4' } }, alignment: { horizontal: 'center' } };
		if (s === 'partial') return { font: { bold: true, color: { rgb: 'B45309' } }, fill: { fgColor: { rgb: 'FFFBEB' } }, alignment: { horizontal: 'center' } };
		if (s === 'nopledge') return { font: { color: { rgb: '64748B' } }, fill: { fgColor: { rgb: 'F1F5F9' } }, alignment: { horizontal: 'center' } };
		return { font: { bold: true, color: { rgb: 'B91C1C' } }, fill: { fgColor: { rgb: 'FEF2F2' } }, alignment: { horizontal: 'center' } };
	}
};
function xlAddr(r, c) { return XLSX.utils.encode_cell({ r: r, c: c }); }
function xlSet(ws, r, c, style) {
	var a = xlAddr(r, c);
	if (!ws[a]) return;
	if (!ws[a].s) ws[a].s = {};
	Object.keys(style).forEach(function (k) { ws[a].s[k] = style[k]; });
}
function xlRowBase(ws, r, ncols, zebra) {
	if (!zebra) return;
	for (var c = 0; c < ncols; c++) xlSet(ws, r, c, XL_STYLES.zebra);
}
function xlTitle(ws, title, subtitle, ncols) {
	ws['!merges'] = [
		{ s: { r: 0, c: 0 }, e: { r: 0, c: ncols - 1 } },
		{ s: { r: 1, c: 0 }, e: { r: 1, c: ncols - 1 } }
	];
	xlSet(ws, 0, 0, XL_STYLES.title);
	xlSet(ws, 1, 0, XL_STYLES.sub);
	ws['!rows'] = ws['!rows'] || [];
	ws['!rows'][0] = { hpt: 28 };
	ws['!rows'][1] = { hpt: 16 };
}
function xlHeaderRow(ws, r, ncols) {
	for (var c = 0; c < ncols; c++) xlSet(ws, r, c, XL_STYLES.hdr);
	ws['!rows'] = ws['!rows'] || [];
	ws['!rows'][r] = { hpt: 20 };
}
function xlPct(ws, r, c, status) {
	var s = XL_STYLES.pctStyle(status);
	s.numFmt = XL_STYLES.pctFmt;
	xlSet(ws, r, c, s);
}
function xlTableBorders(ws, r1, c1, r2, c2) {
	var b = { style: 'thin', color: { rgb: 'D8DEE9' } };
	for (var r = r1; r <= r2; r++) {
		for (var c = c1; c <= c2; c++) {
			xlSet(ws, r, c, { border: { top: b, bottom: b, left: b, right: b } });
		}
	}
}
function barText(pct) {
	var filled = Math.round(Math.min(100, Math.max(0, pct)) / 10);
	var bar = '';
	for (var i = 0; i < 10; i++) bar += i < filled ? '\u2588' : '\u2591';
	return bar + ' ' + pct + '%';
}
function statusText(s) { return s === 'paid' ? 'Paid' : s === 'partial' ? 'Partial' : s === 'nopledge' ? 'No Pledge' : 'Unpaid'; }
function exportExcel() {
	if (!combined.length) return;
	var wb = XLSX.utils.book_new();
	var genDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

	// ── Aggregates ─────────────────────────────────────────
	var groups = {};
	combined.forEach(function (r) {
		if (!groups[r.group]) groups[r.group] = { pledged: 0, paid: 0, balance: 0, count: 0, full: 0, unpaid: 0, noPledge: 0 };
		var g = groups[r.group];
		g.pledged += r.pledged; g.paid += r.paid; g.balance += r.balance; g.count++;
		if (r.status === 'paid') g.full++;
		if (r.status === 'unpaid') g.unpaid++;
		if (r.status === 'nopledge') g.noPledge++;
	});
	var sortedGroups = Object.keys(groups).sort(function (a, b) { return a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b); });
	var totals = { pledged: 0, paid: 0, balance: 0, count: 0, full: 0, unpaid: 0, noPledge: 0 };
	sortedGroups.forEach(function (grp) { var g = groups[grp]; Object.keys(totals).forEach(function (k) { totals[k] += g[k]; }); });
	var tPctAll = totals.pledged > 0 ? Math.round(totals.paid / totals.pledged * 100) : 0;

	// ── Sheet 1: Full List ─────────────────────────────────
	var flHeader = ['Group', 'Donor', 'Phone', 'Invoice #', 'Date', 'Pledged', 'Paid', 'Balance', '% Paid', 'Progress', 'Status'];
	var flSorted = combined.slice().sort(function (a, b) {
		var g = a.group.localeCompare(b.group);
		if (g !== 0) return g;
		var p = pledgedFirst(a, b);
		if (p !== 0) return p;
		return a.donor.localeCompare(b.donor);
	});
	var flAoa = [
		['PLEDGE & DONATION REPORT'],
		['Full List \u00b7 Generated ' + genDate + ' \u00b7 ' + totals.count + ' donors \u00b7 ' + sortedGroups.length + ' groups \u00b7 ' + tPctAll + '% collected'],
		[],
		flHeader
	];
	flSorted.forEach(function (r) {
		flAoa.push([r.group, r.donor, r.phone, r.invoice, r.date, +fmtNum(r.pledged), +fmtNum(r.paid), +fmtNum(r.balance), r.pct, barText(r.pct), statusText(r.status)]);
	});
	flAoa.push(['TOTAL', '', '', '', '', +fmtNum(totals.pledged), +fmtNum(totals.paid), +fmtNum(totals.balance), tPctAll, barText(tPctAll), '']);
	var wsAll = XLSX.utils.aoa_to_sheet(flAoa);
	styleSheet(wsAll, [18, 22, 14, 14, 12, 13, 13, 13, 9, 16, 12]);
	xlTitle(wsAll, flAoa[0][0], flAoa[1][0], 11);
	xlHeaderRow(wsAll, 3, 11);
	var flBase = 4;
	flSorted.forEach(function (r, i) {
		var rowIdx = flBase + i;
		xlRowBase(wsAll, rowIdx, 11, i % 2 === 1);
		xlSet(wsAll, rowIdx, 0, XL_STYLES.groupCell);
		xlSet(wsAll, rowIdx, 1, XL_STYLES.donorCell);
		xlSet(wsAll, rowIdx, 5, { numFmt: XL_STYLES.moneyFmt });
		xlSet(wsAll, rowIdx, 6, { numFmt: XL_STYLES.moneyFmt });
		xlSet(wsAll, rowIdx, 7, { numFmt: XL_STYLES.moneyFmt });
		xlPct(wsAll, rowIdx, 8, r.status);
		xlSet(wsAll, rowIdx, 9, XL_STYLES.barStyle(r.status));
		xlSet(wsAll, rowIdx, 10, XL_STYLES.statusStyle(r.status));
	});
	var flTot = flBase + flSorted.length;
	for (var cF = 0; cF < 11; cF++) xlSet(wsAll, flTot, cF, XL_STYLES.tot);
	xlSet(wsAll, flTot, 5, { numFmt: XL_STYLES.moneyFmt });
	xlSet(wsAll, flTot, 6, { numFmt: XL_STYLES.moneyFmt });
	xlSet(wsAll, flTot, 7, { numFmt: XL_STYLES.moneyFmt });
	xlSet(wsAll, flTot, 8, { numFmt: XL_STYLES.pctFmt, alignment: { horizontal: 'center' } });
	xlSet(wsAll, flTot, 9, XL_STYLES.bar);
	xlTableBorders(wsAll, flBase, 0, flTot, 10);
	wsAll['!autofilter'] = { ref: 'A4:K' + (flTot + 1) };
	XLSX.utils.book_append_sheet(wb, wsAll, 'Full List');

	// ── Sheet 2: Summary ───────────────────────────────────
	var smHeader = ['Group', 'Donors', 'Pledged', 'Paid', 'Balance', '% Collected', 'Progress', 'Fully Paid', 'Unpaid'];
	var smAoa = [
		['GROUP SUMMARY'],
		['Generated ' + genDate + ' \u00b7 ' + sortedGroups.length + ' groups \u00b7 ' + totals.count + ' donors \u00b7 ' + tPctAll + '% collected overall'],
		[],
		smHeader
	];
	sortedGroups.forEach(function (grp) {
		var g = groups[grp];
		var pct = g.pledged > 0 ? Math.round(g.paid / g.pledged * 100) : 0;
		smAoa.push([grp, g.count, +fmtNum(g.pledged), +fmtNum(g.paid), +fmtNum(g.balance), pct, barText(pct), g.full, g.unpaid]);
	});
	smAoa.push(['TOTAL', totals.count, +fmtNum(totals.pledged), +fmtNum(totals.paid), +fmtNum(totals.balance), tPctAll, barText(tPctAll), totals.full, totals.unpaid]);
	var wsSum = XLSX.utils.aoa_to_sheet(smAoa);
	styleSheet(wsSum, [20, 9, 14, 14, 14, 12, 16, 11, 9]);
	xlTitle(wsSum, smAoa[0][0], smAoa[1][0], 9);
	xlHeaderRow(wsSum, 3, 9);
	var smBase = 4;
	sortedGroups.forEach(function (grp, i) {
		var g = groups[grp];
		var pct = g.pledged > 0 ? Math.round(g.paid / g.pledged * 100) : 0;
		var gStat = g.pledged > 0 ? (g.paid >= g.pledged ? 'paid' : g.paid > 0 ? 'partial' : 'unpaid') : 'nopledge';
		var rowIdx = smBase + i;
		xlRowBase(wsSum, rowIdx, 9, i % 2 === 1);
		xlSet(wsSum, rowIdx, 0, XL_STYLES.groupCell);
		xlSet(wsSum, rowIdx, 1, XL_STYLES.center);
		xlSet(wsSum, rowIdx, 2, { numFmt: XL_STYLES.moneyFmt });
		xlSet(wsSum, rowIdx, 3, { numFmt: XL_STYLES.moneyFmt });
		xlSet(wsSum, rowIdx, 4, { numFmt: XL_STYLES.moneyFmt });
		xlPct(wsSum, rowIdx, 5, gStat);
		xlSet(wsSum, rowIdx, 6, XL_STYLES.barStyle(gStat));
		xlSet(wsSum, rowIdx, 7, XL_STYLES.center);
		xlSet(wsSum, rowIdx, 8, XL_STYLES.center);
	});
	var smTot = smBase + sortedGroups.length;
	for (var cS = 0; cS < 9; cS++) xlSet(wsSum, smTot, cS, XL_STYLES.tot);
	xlSet(wsSum, smTot, 2, { numFmt: XL_STYLES.moneyFmt });
	xlSet(wsSum, smTot, 3, { numFmt: XL_STYLES.moneyFmt });
	xlSet(wsSum, smTot, 4, { numFmt: XL_STYLES.moneyFmt });
	xlSet(wsSum, smTot, 5, { numFmt: XL_STYLES.pctFmt, alignment: { horizontal: 'center' } });
	xlSet(wsSum, smTot, 6, XL_STYLES.bar);
	xlTableBorders(wsSum, smBase, 0, smTot, 8);
	wsSum['!autofilter'] = { ref: 'A4:I' + (smTot + 1) };
	XLSX.utils.book_append_sheet(wb, wsSum, 'Summary');

	// ── Sheet 3+: one per group (screenshot-ready) ──────────
	sortedGroups.forEach(function (grp) {
		var members = combined.filter(function (r) { return r.group === grp; }).sort(function (a, b) {
			var p = pledgedFirst(a, b);
			if (p !== 0) return p;
			return a.donor.localeCompare(b.donor);
		});
		var tP = members.reduce(function (s, r) { return s + r.pledged; }, 0);
		var tPd = members.reduce(function (s, r) { return s + r.paid; }, 0);
		var tB = members.reduce(function (s, r) { return s + r.balance; }, 0);
		var gPct = tP > 0 ? Math.round(tPd / tP * 100) : 0;
		var gHeader = ['Donor', 'Phone', 'Invoice #', 'Date', 'Pledged', 'Paid', 'Balance', '% Paid', 'Progress', 'Status'];
		var gAoa = [
			[grp.toUpperCase()],
			['Generated ' + genDate + ' \u00b7 ' + members.length + ' donors \u00b7 ' + fmt(tP) + ' pledged \u00b7 ' + fmt(tPd) + ' paid \u00b7 ' + fmt(tB) + ' balance \u00b7 ' + gPct + '% collected'],
			[],
			gHeader
		];
		members.forEach(function (r) {
			gAoa.push([r.donor, r.phone, r.invoice, r.date, +fmtNum(r.pledged), +fmtNum(r.paid), +fmtNum(r.balance), r.pct, barText(r.pct), statusText(r.status)]);
		});
		gAoa.push(['TOTAL', '', '', '', +fmtNum(tP), +fmtNum(tPd), +fmtNum(tB), gPct, barText(gPct), '']);
		var wsG = XLSX.utils.aoa_to_sheet(gAoa);
		styleSheet(wsG, [22, 14, 14, 12, 13, 13, 13, 9, 16, 12]);
		xlTitle(wsG, gAoa[0][0], gAoa[1][0], 10);
		xlHeaderRow(wsG, 3, 10);
		var gBase = 4;
		members.forEach(function (r, i) {
			var rowIdx = gBase + i;
			xlRowBase(wsG, rowIdx, 10, i % 2 === 1);
			xlSet(wsG, rowIdx, 0, XL_STYLES.donorCell);
			xlSet(wsG, rowIdx, 4, { numFmt: XL_STYLES.moneyFmt });
			xlSet(wsG, rowIdx, 5, { numFmt: XL_STYLES.moneyFmt });
			xlSet(wsG, rowIdx, 6, { numFmt: XL_STYLES.moneyFmt });
			xlPct(wsG, rowIdx, 7, r.status);
			xlSet(wsG, rowIdx, 8, XL_STYLES.barStyle(r.status));
			xlSet(wsG, rowIdx, 9, XL_STYLES.statusStyle(r.status));
		});
		var gTot = gBase + members.length;
		for (var cG = 0; cG < 10; cG++) xlSet(wsG, gTot, cG, XL_STYLES.tot);
		xlSet(wsG, gTot, 4, { numFmt: XL_STYLES.moneyFmt });
		xlSet(wsG, gTot, 5, { numFmt: XL_STYLES.moneyFmt });
		xlSet(wsG, gTot, 6, { numFmt: XL_STYLES.moneyFmt });
		xlSet(wsG, gTot, 7, { numFmt: XL_STYLES.pctFmt, alignment: { horizontal: 'center' } });
		xlSet(wsG, gTot, 8, XL_STYLES.bar);
		xlTableBorders(wsG, gBase, 0, gTot, 9);
		wsG['!autofilter'] = { ref: 'A4:J' + (gTot + 1) };
		XLSX.utils.book_append_sheet(wb, wsG, grp.replace(/[\\\/:*?"<>|]/g, '').substring(0, 31) || 'Group');
	});

	XLSX.writeFile(wb, 'pledge-report.xlsx');
}

// ── EXPORT GROUP IMAGES ───────────────────────────────────
function drawGroupCard(grp, members) {
	members.sort(function (a, b) {
		var p = pledgedFirst(a, b);
		if (p !== 0) return p;
		return (a.donor || '').localeCompare(b.donor || '');
	});
	var CARD_W = 800, ROW_H = 36, HEADER_H = 100, FOOTER_H = 50, PADDING = 24;
	var cardH = HEADER_H + (members.length + 1) * ROW_H + FOOTER_H + PADDING;
	var canvas = document.createElement('canvas');
	canvas.width = CARD_W * 2; canvas.height = cardH * 2;
	canvas.style.width = CARD_W + 'px'; canvas.style.height = cardH + 'px';
	var ctx = canvas.getContext('2d'); ctx.scale(2, 2);
	var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	var C = isDark
		? { bg: '#0c0e14', surface: '#161820', surface2: '#1e2029', text: '#f1f5f9', text2: '#94a3b8', text3: '#64748b', accent: '#60a5fa', success: '#4ade80', danger: '#f87171', warning: '#fbbf24', border: 'rgba(255,255,255,0.06)' }
		: { bg: '#eef1f6', surface: '#ffffff', surface2: '#f6f8fb', text: '#0f172a', text2: '#475569', text3: '#94a3b8', accent: '#1d4ed8', success: '#15803d', danger: '#b91c1c', warning: '#b45309', border: 'rgba(0,0,0,0.07)' };
	ctx.fillStyle = C.bg; ctx.fillRect(0, 0, CARD_W, cardH);
	roundRect(ctx, PADDING, PADDING, CARD_W - PADDING * 2, HEADER_H - PADDING, 10); ctx.fillStyle = '#1a3a6e'; ctx.fill();
	ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px sans-serif'; ctx.fillText(grp, PADDING * 2, PADDING + 30);
	ctx.font = '13px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText(members.length + ' donor' + (members.length !== 1 ? 's' : ''), PADDING * 2, PADDING + 50);
	var tPledged = members.reduce(function (s, r) { return s + r.pledged; }, 0);
	var tPaid = members.reduce(function (s, r) { return s + r.paid; }, 0);
	var tBal = members.reduce(function (s, r) { return s + r.balance; }, 0);
	var tPct = tPledged > 0 ? Math.round(tPaid / tPledged * 100) : 0;
	var sx = CARD_W - PADDING - 350;
	[['Pledged', fmt(tPledged)], ['Paid', fmt(tPaid)], ['Balance', fmt(tBal)], [tPct + '% collected', '']].forEach(function (pair) {
		ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '10px sans-serif'; ctx.fillText(pair[0], sx, PADDING + 30);
		ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; if (pair[1]) ctx.fillText(pair[1], sx, PADDING + 50); sx += 90;
	});
	var barY = PADDING + 62, barW = CARD_W - PADDING * 2 - 16;
	ctx.fillStyle = 'rgba(255,255,255,0.2)'; roundRect(ctx, PADDING * 2, barY, barW, 8, 4); ctx.fill();
	ctx.fillStyle = tPct === 100 ? '#22c55e' : tPct > 0 ? '#f59e0b' : '#ef4444';
	roundRect(ctx, PADDING * 2, barY, Math.max(8, barW * tPct / 100), 8, 4); ctx.fill();
	var tableY = HEADER_H + 4;
	var cols = [{ label: 'Donor', x: PADDING, w: 200 }, { label: 'Invoice #', x: PADDING + 200, w: 130 }, { label: 'Pledged', x: PADDING + 330, w: 110 }, { label: 'Paid', x: PADDING + 440, w: 110 }, { label: 'Balance', x: PADDING + 550, w: 110 }, { label: 'Status', x: PADDING + 660, w: 90 }];
	ctx.fillStyle = C.surface2; ctx.fillRect(PADDING, tableY, CARD_W - PADDING * 2, ROW_H);
	ctx.fillStyle = C.text3; ctx.font = 'bold 10px sans-serif';
	cols.forEach(function (c) { ctx.fillText(c.label.toUpperCase(), c.x + 6, tableY + 22); });
	members.forEach(function (r, i) {
		var rowY = tableY + ROW_H * (i + 1);
		ctx.fillStyle = i % 2 === 0 ? C.surface : C.surface2; ctx.fillRect(PADDING, rowY, CARD_W - PADDING * 2, ROW_H);
		var sColor = r.status === 'paid' ? C.success : r.status === 'partial' ? C.warning : C.danger;
		ctx.fillStyle = C.text; ctx.font = 'bold 12px sans-serif'; ctx.fillText(truncate(ctx, r.donor, 190), cols[0].x + 6, rowY + 23);
		ctx.fillStyle = C.text3; ctx.font = '11px sans-serif'; ctx.fillText(r.invoice, cols[1].x + 6, rowY + 23);
		ctx.fillStyle = C.text; ctx.font = '12px sans-serif'; ctx.fillText(fmt(r.pledged), cols[2].x + 6, rowY + 23);
		ctx.fillStyle = C.success; ctx.fillText(fmt(r.paid), cols[3].x + 6, rowY + 23);
		ctx.fillStyle = C.danger; ctx.fillText(fmt(r.balance), cols[4].x + 6, rowY + 23);
		var bx = cols[5].x + 6, by = rowY + 8, bw = 70, bh = 18;
		ctx.fillStyle = r.status === 'paid' ? '#f0fdf4' : r.status === 'partial' ? '#fffbeb' : '#fef2f2';
		roundRect(ctx, bx, by, bw, bh, 9); ctx.fill();
		ctx.fillStyle = sColor; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
		ctx.fillText(r.status.charAt(0).toUpperCase() + r.status.slice(1), bx + bw / 2, by + 13); ctx.textAlign = 'left';
	});
	var totRowY = tableY + ROW_H * (members.length + 1);
	ctx.fillStyle = '#eff6ff'; ctx.fillRect(PADDING, totRowY, CARD_W - PADDING * 2, ROW_H);
	ctx.fillStyle = C.accent; ctx.font = 'bold 12px sans-serif';
	ctx.fillText('TOTAL', cols[0].x + 6, totRowY + 23); ctx.fillText(fmt(tPledged), cols[2].x + 6, totRowY + 23);
	ctx.fillStyle = C.success; ctx.fillText(fmt(tPaid), cols[3].x + 6, totRowY + 23);
	ctx.fillStyle = C.danger; ctx.fillText(fmt(tBal), cols[4].x + 6, totRowY + 23);
	ctx.fillStyle = C.text3; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
	ctx.fillText('Pledge Report \u00b7 ' + grp + ' \u00b7 ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), CARD_W / 2, totRowY + ROW_H + 20);
	ctx.textAlign = 'left';
	return canvas;
}
function roundRect(ctx, x, y, w, h, r) {
	ctx.beginPath(); ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
	ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
	ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
	ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
	ctx.closePath();
}
function truncate(ctx, text, maxW) {
	if (ctx.measureText(text).width <= maxW) return text;
	while (text.length > 1 && ctx.measureText(text + '...').width > maxW) text = text.slice(0, -1);
	return text + '...';
}
function jsq(str) { return String(str == null ? '' : str).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function getGroupMembers(grp) {
	return combined.filter(function (r) { return r.group === grp; });
}
function imgBtns(grp) {
	var g = jsq(grp);
	return '<button class="btn btn-outline btn-sm" title="Copy group image (paste into WhatsApp)" onclick="copyGroupImage(this, \'' + g + '\')">📋</button> <button class="btn btn-outline btn-sm" title="Download group image" onclick="downloadGroupImage(\'' + g + '\')">⬇</button>';
}
function downloadGroupImage(grp) {
	var members = getGroupMembers(grp);
	if (!members.length) { tool.notify('No data for this group', 'warning'); return; }
	var canvas = drawGroupCard(grp, members);
	canvas.toBlob(function (blob) {
		if (!blob) { tool.notify('Image generation failed', 'error'); return; }
		var a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = String(grp).replace(/[^a-zA-Z0-9]/g, '_') + '-pledge-report.png';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
		tool.notify('Downloaded "' + grp + '" report image \u2713', 'success');
	}, 'image/png');
}
function copyGroupImage(btn, grp) {
	var members = getGroupMembers(grp);
	if (!members.length) { tool.notify('No data for this group', 'warning'); return; }
	var canvas = drawGroupCard(grp, members);
	canvas.toBlob(function (blob) {
		if (!blob) { tool.notify('Image generation failed', 'error'); return; }
		function copiedEffect(ok) {
			if (btn) {
				var orig = btn.textContent;
				btn.classList.add('copied');
				btn.textContent = '\u2705';
				setTimeout(function () {
					btn.classList.remove('copied');
					btn.textContent = orig;
				}, 1600);
			}
			if (ok) tool.notify('Group image copied \u2014 paste into WhatsApp \u2713', 'success');
		}
		if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
			navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
				.then(function () { copiedEffect(true); })
				.catch(function (e) { copiedEffect(false); tool.notify('Copy failed: ' + e.message, 'error'); });
		} else {
			copiedEffect(false);
			tool.notify('Clipboard image copy not supported in this browser', 'warning');
		}
	}, 'image/png');
}
async function exportGroupImages() {
	if (!combined.length) return;
	var groups = {};
	combined.forEach(function (r) { if (!groups[r.group]) groups[r.group] = []; groups[r.group].push(r); });
	var sortedGroups = Object.keys(groups).sort(function (a, b) { return a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b); });
	if (sortedGroups.length === 1) {
		var grp = sortedGroups[0]; var canvas = drawGroupCard(grp, groups[grp]);
		canvas.toBlob(function (blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = grp.replace(/[^a-zA-Z0-9]/g, '_') + '-pledge-report.png'; a.click(); }, 'image/png');
		return;
	}
	for (var i = 0; i < sortedGroups.length; i++) {
		var grp = sortedGroups[i]; var canvas = drawGroupCard(grp, groups[grp]);
		await new Promise(function (resolve) { canvas.toBlob(function (blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = grp.replace(/[^a-zA-Z0-9]/g, '_') + '-pledge-report.png'; a.click(); setTimeout(resolve, 300); }, 'image/png'); });
	}
}
function exportCSV() { exportExcel(); }

// ── WARNINGS ──────────────────────────────────────────────
var warnData = [], warnSortCol = 'priority', warnSortDir = 1;
var warnResolved = {};
function renderWarnings(mismatches) {
	warnData = mismatches;
	var panel = document.getElementById('warn-panel'), countEl = document.getElementById('warn-count');
	var tabBtn = document.getElementById('tab-btn-mismatches');
	var tabCount = document.getElementById('mismatch-tab-count');
	if (!mismatches.length) {
		if (panel) panel.style.display = 'none';
		if (tabBtn) tabBtn.style.display = 'none';
		return;
	}
	if (panel) panel.style.display = 'block';
	if (tabBtn) tabBtn.style.display = '';
	if (tabCount) tabCount.textContent = mismatches.length;
	if (countEl) countEl.textContent = mismatches.length + ' issue' + (mismatches.length !== 1 ? 's' : '');
	document.getElementById('warn-panel-body').style.display = 'block';
	document.getElementById('warn-toggle-label').textContent = 'Hide \u25b4';
	renderWarnTable();
}
function renderWarnTable() {
	var list = document.getElementById('warn-list');
	var sorted = warnData.slice().sort(function (a, b) {
		var av = a[warnSortCol], bv = b[warnSortCol];
		if (typeof av === 'string') av = av.toLowerCase(); if (typeof bv === 'string') bv = bv.toLowerCase();
		return av < bv ? -warnSortDir : av > bv ? warnSortDir : 0;
	});
	function arrow(col) { if (warnSortCol !== col) return '<span style="opacity:0.3">\u2195</span>'; return warnSortDir === 1 ? '\u2191' : '\u2193'; }
	var cols = [{ key: 'priority', label: 'Priority' }, { key: 'name', label: 'Name' }, { key: 'source', label: 'Source' }, { key: 'detail', label: 'Issue' }];
	var thHtml = cols.map(function (c) {
		return '<th onclick="warnSort(\'' + c.key + '\')" style="cursor:pointer;user-select:none;padding:9px 12px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:var(--c-text3);background:var(--c-surface2);border-bottom:1px solid var(--c-border);white-space:nowrap">' + esc(c.label) + ' ' + arrow(c.key) + '</th>';
	}).join('') + '<th style="padding:9px 12px;background:var(--c-surface2);border-bottom:1px solid var(--c-border);font-size:10px;color:var(--c-text3)">Fixed?</th>';
	var rowsHtml = sorted.map(function (m) {
		var origIdx = warnData.indexOf(m), rowId = 'wrow-' + origIdx;
		var dedup = m.source + '|' + normalize(m.name);
		var isHigh = m.priority === 'High';
		var priBg = isHigh ? 'var(--c-red-bg)' : 'var(--c-amber-bg)';
		var priCol = isHigh ? 'var(--c-red)' : 'var(--c-amber)';
		var icon = m.source === 'QuickBooks' ? '\ud83d\udcc4' : m.source === 'Cash Payments' ? '\ud83d\udcb5' : '\ud83d\udc65';
		var resolved = !!warnResolved[dedup];
		return '<tr id="' + rowId + '" class="warn-row' + (resolved ? ' resolved' : '') + '" style="border-bottom:1px solid var(--c-border)">' +
			'<td style="padding:9px 12px"><span class="badge" style="background:' + priBg + ';color:' + priCol + '">' + esc(m.priority) + '</span></td>' +
			'<td style="padding:9px 12px;font-weight:800;font-size:13px">' + esc(m.name) + '</td>' +
			'<td style="padding:9px 12px;font-size:12px;color:var(--c-text2)">' + icon + ' ' + esc(m.source) + '</td>' +
			'<td style="padding:9px 12px;font-size:12px;color:var(--c-text2)">' + esc(m.detail) + '</td>' +
			'<td style="padding:9px 12px;text-align:center"><input type="checkbox" ' + (resolved ? 'checked' : '') + ' onchange="resolveWarn(this,\'' + jsq(dedup) + '\')" title="Mark as fixed"></td>' +
			'</tr>';
	}).join('');
	list.innerHTML = '<table style="width:100%;border-collapse:collapse"><thead><tr>' + thHtml + '</tr></thead><tbody>' + rowsHtml + '</tbody></table>';
}
function warnSort(col) { if (warnSortCol === col) warnSortDir *= -1; else { warnSortCol = col; warnSortDir = 1; } renderWarnTable(); }
function resolveWarn(cb, dedupKey) {
	if (cb.checked) { warnResolved[dedupKey] = true; } else { delete warnResolved[dedupKey]; }
	var row = cb.parentNode.parentNode;
	if (row) row.classList.toggle('resolved', cb.checked);
	_persistResolvedWarns();
}
function _persistResolvedWarns() {
	if (_isSaving) return;
	var val = tool.getValue() || {};
	val.resolvedMismatches = Object.keys(warnResolved);
	_isSaving = true;
	tool.setValue(sanitizeForSave(val));
	setTimeout(function () { _isSaving = false; }, 200);
}
function toggleWarnPanel() {
	var body = document.getElementById('warn-panel-body'), label = document.getElementById('warn-toggle-label');
	var open = body.style.display === 'none';
	body.style.display = open ? 'block' : 'none';
	label.textContent = open ? 'Hide \u25b4' : 'Show \u25be';
	scheduleResize();
}
function showNotice(msg) { var n = document.getElementById('notice'); n.textContent = msg; n.style.display = 'block'; }

// ── SAMPLE DATA ───────────────────────────────────────────
function loadSample() {
	qbData = [{ 'Transaction type': 'Invoice', Name: 'Smith, John', '#': 'INV-1001', Date: '2024-01-15', Amount: 5000, 'Open balance': 5000 }, { 'Transaction type': 'Invoice', Name: 'Cohen, Rachel', '#': 'INV-1002', Date: '2024-01-20', Amount: 3000, 'Open balance': 3000 }, { 'Transaction type': 'Invoice', Name: 'Goldberg, David', '#': 'INV-1003', Date: '2024-02-01', Amount: 10000, 'Open balance': 8000 }, { 'Transaction type': 'Invoice', Name: 'Levy, Sarah', '#': 'INV-1004', Date: '2024-02-10', Amount: 2500, 'Open balance': 2500 }, { 'Transaction type': 'Invoice', Name: 'Miller, Robert', '#': 'INV-1005', Date: '2024-03-01', Amount: 7500, 'Open balance': 7500 }, { 'Transaction type': 'Invoice', Name: 'Davis, Emily', '#': 'INV-1006', Date: '2024-03-15', Amount: 1200, 'Open balance': 1200 }, { 'Transaction type': 'Invoice', Name: 'Brown, Michael', '#': 'INV-1007', Date: '2024-03-20', Amount: 4000, 'Open balance': 4000 }, { 'Transaction type': 'Invoice', Name: 'Wilson, Lisa', '#': 'INV-1008', Date: '2024-03-25', Amount: 6000, 'Open balance': 6000 }];

	{
		// Use file-based format with column mapping
		cashData = [{ Name: 'Smith, John', Date: '2024-03-10', Income: 2500, Explanation: 'Donation 26' }, { Name: 'Smith, John', Date: '2024-05-01', Income: 2500, Explanation: 'Donation 26' }, { Name: 'COHEN, RACHEL', Date: '2024-04-15', Income: 1500, Explanation: 'Donation 26' }, { Name: 'Goldberg, David', Date: '2024-02-20', Income: 2000, Explanation: 'Donation 26' }, { Name: 'Davis, Emily', Date: '2024-04-01', Income: 1200, Explanation: 'Donation 26' }, { Name: 'Brown, Michael', Date: '2024-02-15', Expense: 50, Explanation: 'Winter camp table cloth' }, { Name: 'Wilson, Lisa', Date: '2024-03-01', Expense: 30, Explanation: 'Office supplies' }, { Name: 'Thompson, Alice', Date: '2024-04-10', Income: 500, Explanation: 'Donation 26' }];
		peopleData = [{ Name: 'Smith, John', Group: 'North Side', Phone: '555-0101' }, { Name: 'Cohen, Rachel', Group: 'North Side', Phone: '555-0102' }, { Name: 'Green, Nancy', Group: 'North Side', Phone: '555-0103' }, { Name: 'Harris, Paul', Group: 'North Side', Phone: '555-0104' }, { Name: 'Goldberg, David', Group: 'Downtown', Phone: '555-0201' }, { Name: 'Levy, Sarah', Group: 'Downtown', Phone: '555-0202' }, { Name: 'Klein, Peter', Group: 'Downtown', Phone: '555-0203' }, { Name: 'Miller, Robert', Group: 'East End', Phone: '555-0301' }, { Name: 'Davis, Emily', Group: 'East End', Phone: '555-0302' }, { Name: 'Torres, Maria', Group: 'East End', Phone: '555-0303' }, { Name: 'Brown, Michael', Group: '', Phone: '555-0401' }, { Name: 'Wilson, Lisa', Group: '', Phone: '555-0402' }, { Name: 'Adams, Carol', Group: '', Phone: '555-0403' }];
		['qb-drop', 'cash-drop', 'people-drop'].forEach(function (id) { document.getElementById(id).classList.add('loaded'); });
		document.getElementById('qb-label').textContent = '\u2713 sample-invoices.xlsx (8 invoice rows)';
		document.getElementById('cash-label').textContent = '\u2713 sample-cash.xlsx (8 rows)';
		document.getElementById('people-label').textContent = '\u2713 sample-people.xlsx (13 rows)';
		document.getElementById('qb-map').style.display = 'block';
		document.getElementById('cash-map').style.display = 'block';
		var cashCols = Object.keys(cashData[0]);
		['cash-col-donor', 'cash-col-date', 'cash-col-amount', 'cash-col-note'].forEach(function (id) {
			var sel = document.getElementById(id); sel.innerHTML = '';
			cashCols.forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
		});
		document.getElementById('cash-col-donor').value = 'Name';
		document.getElementById('cash-col-date').value = 'Date';
		document.getElementById('cash-col-amount').value = 'Income';
		document.getElementById('cash-col-note').value = 'Explanation';
		refreshExplOptions();
		document.getElementById('cash-col-expl-val').value = 'Donation 26';
		document.getElementById('cash-expl-filter').style.display = 'block';
		document.getElementById('people-map').style.display = 'block';
		var peopleCols = Object.keys(peopleData[0]);
		['people-col-name', 'people-col-group', 'people-col-phone'].forEach(function (id) {
			var sel = document.getElementById(id); sel.innerHTML = '';
			peopleCols.forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
		});
		document.getElementById('people-col-name').value = 'Name';
		document.getElementById('people-col-group').value = 'Group';
		document.getElementById('people-col-phone').value = 'Phone';
	}

	document.getElementById('qb-drop').classList.add('loaded');
	document.getElementById('qb-label').textContent = '\u2713 sample-invoices.xlsx (8 invoice rows)';
	document.getElementById('qb-map').style.display = 'block';
	renderInvoiceList();
	updateTabBadges();
	combine();
}