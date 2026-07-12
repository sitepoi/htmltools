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

// ── State ─────────────────────────────────────────────────
let qbData = [], cashData = [], peopleData = [], combined = [], unpledged = [], groupMap = {};
let sortCol = 'donor', sortDir = 1;
let npSortCol = 'name', npSortDir = 1;
const UNASSIGNED = 'Unassigned';
const QB_COLS = { transactionType: 'Transaction type', donor: 'Name', invoice: '#', date: 'Date', amount: 'Amount', balance: 'Open balance' };

// ── CMS STORAGE ────────────────────────────────────────
const PEOPLE_TYPE = 'pledgePeople-uniconbaseapps';
const CASH_TYPE = 'pledgeCashPayments-uniconbaseapps';
const MASTER_ID = 'master-list';
let _cmsAvailable = false;
let _cmsBusy = false;
let _pendingCashFile = null;
let _sourceUrls = { qb: '', cash: '', people: '' };
let _urlFetchBusy = false;

function _cmsGet(type, cb) {
	tool.requestObjects('get', { mainObjectType: type, objectId: MASTER_ID }, function (err, result) {
		if (err) { _cmsAvailable = false; cb(err, null); return; }
		_cmsAvailable = true;
		var obj = result && result.object;
		var records = obj && obj.productData && obj.productData.data_categoriesBased && obj.productData.data_categoriesBased.records;
		cb(null, Array.isArray(records) ? records : []);
	});
}

function _cmsSave(type, records, cb) {
	if (_cmsBusy) { if (cb) cb('busy'); return; }
	_cmsBusy = true;
	var payload = { productData: { data_categoriesBased: { records: records } } };
	tool.requestObjects('get', { mainObjectType: type, objectId: MASTER_ID }, function (err, result) {
		if (err || !result || !result.object) {
			tool.requestObjects('create', {
				mainObjectType: type, objectId: MASTER_ID,
				name: type === PEOPLE_TYPE ? 'People & Groups Master List' : 'Cash Payments Master List',
				productData: { data_categoriesBased: { records: records } }
			}, function (e2, r2) {
				_cmsBusy = false;
				if (e2) { _cmsAvailable = false; if (cb) cb(e2); return; }
				_cmsAvailable = true;
				if (cb) cb(null);
			});
			return;
		}
		_cmsAvailable = true;
		tool.requestObjects('update', {
			mainObjectType: type, objectId: MASTER_ID, productData: payload.productData
		}, function (e2) {
			_cmsBusy = false;
			if (e2) { _cmsAvailable = false; if (cb) cb(e2); return; }
			if (cb) cb(null);
		});
	});
}

function loadStoredPeople(cb) { _cmsGet(PEOPLE_TYPE, function (err, records) { if (err) { peopleData = []; if (cb) cb(err); return; } peopleData = records; refreshPeopleCard(); renderPeopleManager(); if (cb) cb(null); }); }
function loadStoredCash(cb) { _cmsGet(CASH_TYPE, function (err, records) { if (err) { cashData = []; if (cb) cb(err); return; } cashData = records; refreshCashCard(); renderCashManager(); if (cb) cb(null); }); }
function saveStoredPeople(cb) { _cmsSave(PEOPLE_TYPE, peopleData, function (err) { if (!err) refreshPeopleCard(); if (cb) cb(err); }); }
function saveStoredCash(cb) { _cmsSave(CASH_TYPE, cashData, function (err) { if (!err) refreshCashCard(); if (cb) cb(err); }); }

// ── PEOPLE MANAGEMENT UI ───────────────────────────────
function refreshPeopleCard() {
	var label = document.getElementById('people-label');
	if (!label) return;
	if (_cmsAvailable && peopleData.length) {
		label.textContent = '\u2713 ' + peopleData.length + ' people stored in CMS';
	} else if (_cmsAvailable) {
		label.textContent = 'No people stored yet — add manually or import from file';
	} else {
		label.textContent = 'Upload an Excel/CSV file with Name, Group, and Phone columns';
	}
	updateTabBadges();
}

function refreshCashCard() {
	var label = document.getElementById('cash-label');
	if (!label) return;
	if (_cmsAvailable && cashData.length) {
		label.textContent = '\u2713 ' + cashData.length + ' payments stored in CMS';
	} else if (_cmsAvailable) {
		label.textContent = 'No payments stored yet — add manually or import from file';
	} else {
		label.textContent = 'Upload an Excel/CSV file with payment records';
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
	var sorted = peopleData.slice().sort(function (a, b) { return (a.group || '').localeCompare(b.group || '') || (a.name || '').localeCompare(b.name || ''); });
	sorted.forEach(function (p, i) {
		var tr = document.createElement('tr');
		tr.id = 'prow-' + i;
		tr.innerHTML =
			'<td><span class="mgmt-cell" id="pcell-name-' + i + '">' + esc(p.name || '') + '</span></td>' +
			'<td><span class="mgmt-cell" id="pcell-group-' + i + '">' + esc(p.group || '') + '</span></td>' +
			'<td><span class="mgmt-cell" id="pcell-phone-' + i + '">' + esc(p.phone || '') + '</span></td>' +
			'<td><button class="btn btn-outline btn-sm" onclick="editPerson(' + i + ')" title="Edit">\u270f</button> <button class="btn btn-outline btn-sm" onclick="deletePerson(' + i + ')" title="Delete" style="color:var(--c-red);border-color:var(--c-red-mid)">\u2715</button></td>';
		tbody.appendChild(tr);
	});
	if (countEl) countEl.textContent = peopleData.length + ' people stored';
}

function addPersonRow() {
	var name = prompt('Enter full name:');
	if (!name || !name.trim()) return;
	var group = prompt('Enter group name (or leave blank):') || '';
	var phone = prompt('Enter phone (or leave blank):') || '';
	peopleData.push({ name: name.trim(), group: group.trim(), phone: phone.trim() });
	renderPeopleManager();
	saveStoredPeople(function (err) { if (err) tool.notify('Save failed: ' + err, 'error'); else tool.notify('Person added \u2713', 'success'); });
	scheduleResize();
}

function editPerson(idx) {
	var p = peopleData[idx];
	var name = prompt('Edit name:', p.name || '');
	if (name === null) return;
	var group = prompt('Edit group:', p.group || '');
	if (group === null) return;
	var phone = prompt('Edit phone:', p.phone || '');
	if (phone === null) return;
	p.name = name.trim();
	p.group = group.trim();
	p.phone = phone.trim();
	renderPeopleManager();
	saveStoredPeople(function (err) { if (err) tool.notify('Save failed: ' + err, 'error'); else tool.notify('Person updated \u2713', 'success'); });
	scheduleResize();
}

function deletePerson(idx) {
	var p = peopleData[idx];
	if (!confirm('Delete "' + (p.name || 'this person') + '"?')) return;
	peopleData.splice(idx, 1);
	renderPeopleManager();
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
	var sorted = cashData.slice().sort(function (a, b) { return (a.donorName || '').localeCompare(b.donorName || '') || (a.date || '').localeCompare(b.date || ''); });
	sorted.forEach(function (c, i) {
		var tr = document.createElement('tr');
		tr.id = 'crow-' + i;
		tr.innerHTML =
			'<td><span class="mgmt-cell" id="ccell-donor-' + i + '">' + esc(c.donorName || '') + '</span></td>' +
			'<td><span class="mgmt-cell" id="ccell-date-' + i + '">' + esc(c.date || '') + '</span></td>' +
			'<td style="font-weight:700;color:var(--c-green)"><span class="mgmt-cell" id="ccell-amount-' + i + '">' + fmt(c.amount || 0) + '</span></td>' +
			'<td><span class="mgmt-cell" id="ccell-note-' + i + '">' + esc(c.note || '') + '</span></td>' +
			'<td><button class="btn btn-outline btn-sm" onclick="editCash(' + i + ')" title="Edit">\u270f</button> <button class="btn btn-outline btn-sm" onclick="deleteCash(' + i + ')" title="Delete" style="color:var(--c-red);border-color:var(--c-red-mid)">\u2715</button></td>';
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
	cashData.push({ donorName: donor.trim(), date: date.trim(), amount: amt, note: note.trim() });
	renderCashManager();
	saveStoredCash(function (err) { if (err) tool.notify('Save failed: ' + err, 'error'); else tool.notify('Payment added \u2713', 'success'); });
	scheduleResize();
}

function editCash(idx) {
	var c = cashData[idx];
	var donor = prompt('Edit donor name:', c.donorName || '');
	if (donor === null) return;
	var date = prompt('Edit date:', c.date || '');
	if (date === null) return;
	var amt = parseFloat(prompt('Edit amount:', c.amount || 0));
	if (isNaN(amt)) return;
	var note = prompt('Edit note:', c.note || '');
	if (note === null) return;
	c.donorName = donor.trim();
	c.date = date.trim();
	c.amount = amt;
	c.note = note.trim();
	renderCashManager();
	saveStoredCash(function (err) { if (err) tool.notify('Save failed: ' + err, 'error'); else tool.notify('Payment updated \u2713', 'success'); });
	scheduleResize();
}

function deleteCash(idx) {
	var c = cashData[idx];
	if (!confirm('Delete payment from "' + (c.donorName || 'unknown') + '" for ' + fmt(c.amount || 0) + '?')) return;
	cashData.splice(idx, 1);
	renderCashManager();
	saveStoredCash(function (err) { if (err) tool.notify('Save failed: ' + err, 'error'); else tool.notify('Payment deleted \u2713', 'success'); });
	scheduleResize();
}

function importCashFile() {
	document.getElementById('cash-file').click();
}

// ── TOP-LEVEL TAB SWITCHING ─────────────────────────────
function switchTopTab(name) {
	document.querySelectorAll('.top-tab-btn').forEach(function (b) {
		b.classList.toggle('active', b.getAttribute('data-tab') === name);
	});
	document.querySelectorAll('.top-tab-panel').forEach(function (p) {
		p.classList.toggle('active', p.id === 'top-tab-' + name);
	});
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
	tool.setValue(val);
	setTimeout(function () { _isSaving = false; }, 200);
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
				_pendingCashFile = rows;
				document.getElementById('cash-map').style.display = 'block';
				var cols = Object.keys(rows[0]);
				populateSelect('cash-col-donor', cols, ['name', 'donor', 'customer', 'payer']);
				populateSelect('cash-col-date', cols, ['date', 'paid', 'payment']);
				populateSelect('cash-col-amount', cols, ['income', 'amount', 'paid', 'cash', 'payment']);
				populateSelect('cash-col-note', cols, ['explanation', 'note', 'description', 'memo', 'comment']);
				var importBtn = document.getElementById('cash-import-to-cms-btn');
				if (importBtn) importBtn.style.display = '';
				document.getElementById('cash-label').textContent = '\u26a1 ' + rows.length + ' rows from URL — map columns & save';
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
			payments: []
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
	var sub = document.getElementById('saved-banner-sub');
	if (banner) {
		if (val.generatedAt) {
			var d = new Date(val.generatedAt);
			sub.textContent = 'Generated ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
		}
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

	return true;
}

// ── FILE LOADING ──────────────────────────────────────────
function setupDrop(dropId, fileId, onLoad) {
	var drop = document.getElementById(dropId);
	var file = document.getElementById(fileId);
	if (!drop || !file) return;
	file.onchange = function (e) { handleFile(e.target.files[0], dropId, onLoad); };
	drop.onclick = function () { if (_cmsAvailable && (dropId === 'cash-drop' || dropId === 'people-drop')) return; file.click(); };
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

	if (_cmsAvailable) {
		_pendingCashFile = rawCash;
		var importBtn = document.getElementById('cash-import-to-cms-btn');
		if (importBtn) importBtn.style.display = '';
		var labelEl = document.getElementById('cash-label');
		var kept = rawCash.length, total = rows.length;
		if (labelEl) labelEl.textContent = '\u26a1 ' + kept + ' rows loaded — map columns & click "Save to Stored"';
	} else {
		cashData = rawCash;
		var labelEl2 = document.getElementById('cash-label');
		var kept2 = rawCash.length, total2 = rows.length;
		if (labelEl2) labelEl2.textContent = '\u2713 ' + kept2 + ' rows' + (kept2 < total2 ? ' of ' + total2 + ' total' : '') + ' (temp)';
	}
}

function saveCashImportToCMS() {
	if (!_cmsAvailable) { tool.notify('CMS storage not available', 'warning'); return; }
	if (!_pendingCashFile || !_pendingCashFile.length) { tool.notify('No file data to import. Upload a cash file first.', 'warning'); return; }
	var cashDonorC = document.getElementById('cash-col-donor').value;
	var cashAmC = document.getElementById('cash-col-amount').value;
	var cashDateC = document.getElementById('cash-col-date').value;
	var cashNoteC = document.getElementById('cash-col-note').value;
	var explSel = document.getElementById('cash-col-expl-val');
	var cashExplFilter = explSel ? explSel.value.trim() : '';

	var filteredCash = _pendingCashFile.filter(function (row) {
		if (!cashExplFilter) return true;
		var expl = String(row[cashNoteC] || '').trim();
		return expl.toLowerCase() === cashExplFilter.toLowerCase();
	});

	var imported = filteredCash.map(function (r) {
		return {
			donorName: cashDonorC ? String(r[cashDonorC] || '').trim() : '',
			date: cashDateC ? String(r[cashDateC] || '').trim() : '',
			amount: cashAmC ? (parseFloat(String(r[cashAmC]).replace(/[^0-9.]/g, '')) || 0) : 0,
			note: cashNoteC ? String(r[cashNoteC] || '').trim() : ''
		};
	}).filter(function (r) { return r.donorName !== '' && r.amount > 0; });

	if (!imported.length) { tool.notify('No valid payment rows to import', 'warning'); return; }

	var existingKeys = {};
	cashData.forEach(function (c) { existingKeys[normalize(c.donorName) + '|' + c.date + '|' + c.amount] = true; });
	var added = 0;
	imported.forEach(function (r) {
		var dedup = normalize(r.donorName) + '|' + r.date + '|' + r.amount;
		if (!existingKeys[dedup]) {
			cashData.push(r);
			existingKeys[dedup] = true;
			added++;
		}
	});

	saveStoredCash(function (err) {
		if (!err) {
			tool.notify('Imported ' + added + ' new payments to CMS \u2713', 'success');
			_pendingCashFile = null;
			document.getElementById('cash-import-to-cms-btn').style.display = 'none';
			document.getElementById('cash-label').textContent = '\u2713 ' + cashData.length + ' payments stored in CMS';
		} else {
			tool.notify('Import failed: ' + err, 'error');
		}
	});
	renderCashManager();
	refreshCashCard();
	scheduleResize();
}

function onPeopleLoad(rows) {
	var cols = Object.keys(rows[0]);
	document.getElementById('people-map').style.display = 'block';
	populateSelect('people-col-name', cols, ['name', 'donor', 'person', 'full']);
	populateSelect('people-col-group', cols, ['group', 'location', 'team', 'category', 'class']);
	populateSelect('people-col-phone', cols, ['phone', 'mobile', 'tel', 'cell']);

	if (_cmsAvailable) {
		var nameCol = document.getElementById('people-col-name').value || cols.find(function (c) { return c.toLowerCase().trim() === 'name'; }) || '';
		var groupCol = document.getElementById('people-col-group').value || '';
		var phoneCol = document.getElementById('people-col-phone').value || '';
		var imported = rows.map(function (r) {
			return {
				name: String(r[nameCol] || '').trim(),
				group: groupCol ? String(r[groupCol] || '').trim() : '',
				phone: phoneCol ? String(r[phoneCol] || '').trim() : ''
			};
		}).filter(function (r) { return r.name !== ''; });
		if (imported.length) {
			var existingKeys = {};
			peopleData.forEach(function (p) { existingKeys[normalize(p.name)] = true; });
			var added = 0;
			imported.forEach(function (r) {
				if (!existingKeys[normalize(r.name)]) {
					peopleData.push(r);
					existingKeys[normalize(r.name)] = true;
					added++;
				}
			});
			saveStoredPeople(function (err) {
				if (!err) tool.notify('Imported ' + added + ' new people to CMS \u2713', 'success');
				else tool.notify('Import failed: ' + err, 'error');
			});
			renderPeopleManager();
			refreshPeopleCard();
		}
	} else {
		peopleData = rows;
		var labelEl = document.getElementById('people-label');
		if (labelEl) labelEl.textContent = '\u2713 ' + rows.length + ' rows (temp — CMS storage not available)';
	}
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
			unpledgedRecords: { type: 'array' }
		}
	});

	// Declare params
	tool.declareParams([
		{ name: 'allowObjectCRUD', label: 'Allow CMS Object CRUD', type: 'toggle', default: 'yes', hint: 'Enable CMS object storage for people & cash lists' },
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

	// Try to load stored data from CMS
	_cmsAvailable = true;
	loadStoredPeople(function (err) {
		if (err) { _cmsAvailable = false; console.log('CMS people load failed, file-only mode'); }
		loadStoredCash(function (err2) {
			if (err2) { _cmsAvailable = false; console.log('CMS cash load failed, file-only mode'); }
			// Now restore saved report
			var restored = restoreFromValue(val);
			if (restored) {
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
		});
	});

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
			: '<span class="badge badge-unpaid">Unpaid</span>';
}
function fillClass(status) { return status === 'paid' ? 'fill-paid' : status === 'partial' ? 'fill-partial' : 'fill-unpaid'; }

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
		var paid, balance;
		if (qbBalance !== null && !isNaN(qbBalance)) {
			var qbPaid = pledged - qbBalance;
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
			pledged: pledged, paid: paid, balance: balance, status: status, pct: pct,
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

	var totalPledged = combined.reduce(function (s, r) { return s + r.pledged; }, 0);
	var totalPaid = combined.reduce(function (s, r) { return s + r.paid; }, 0);
	var totalBalance = combined.reduce(function (s, r) { return s + r.balance; }, 0);

	// ── FIX: Include unpledgedRecords in saved payload ────────
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
				status: r.status, pct: r.pct
			};
		}),
		unpledgedRecords: unpledged.map(function (r) {
			return { name: r.name, group: r.group, phone: r.phone };
		})
	};

	_isSaving = true;
	tool.setValue(reportPayload);
	setTimeout(function () { _isSaving = false; }, 200);

	tool.notify('Report generated and saved \u2713', 'success');

	if (btn) btn.disabled = false;
	if (btnText) btnText.textContent = 'Combine & Generate Report';

	var pill = document.getElementById('header-status');
	var pillText = document.getElementById('header-status-text');
	if (pill && pillText) {
		pillText.textContent = combined.length + ' donors \u00b7 ' + new Date().toLocaleTimeString();
		pill.style.display = 'flex';
	}

	document.getElementById('saved-banner').style.display = 'none';
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
		Object.keys(peopleOrig).forEach(function (key) {
			var orig = peopleOrig[key];
			if (!qbNames[key]) addIssue('People/Groups', orig, 'Person is in your groups list but has no QuickBooks invoice', 'Low');
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
		var av = a[sortCol], bv = b[sortCol];
		if (typeof av === 'string') av = av.toLowerCase();
		if (typeof bv === 'string') bv = bv.toLowerCase();
		return av < bv ? -sortDir : av > bv ? sortDir : 0;
	});
	var tbody = document.getElementById('report-body');
	tbody.innerHTML = '';
	if (!rows.length) {
		tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><div class="e-icon">\ud83d\udd0d</div><h3>No results</h3><p>Adjust your search or filter.</p></div></td></tr>';
		document.getElementById('row-count').textContent = '';
		return;
	}
	rows.forEach(function (r, i) {
		var tr = document.createElement('tr');
		tr.innerHTML =
			'<td><span class="expand-btn" onclick="toggleFlatDetail(' + i + ')" data-expand="' + i + '">\u25b6</span></td>' +
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
		dtr.innerHTML = '<td colspan="10"><div class="detail-inner"><div class="section-title-sm">Cash payments</div>' + payHtml + '</div></td>';
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
			'<td style="color:var(--c-red);font-weight:800">' + g.unpaid + '</td>';
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
		'<td style="color:var(--c-red);font-weight:900">' + totals.unpaid + '</td>';
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
	}).sort(function (a, b) { return a.group.localeCompare(b.group) || a.donor.localeCompare(b.donor); });
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
function exportExcel() {
	if (!combined.length) return;
	var wb = XLSX.utils.book_new();
	var fullHeader = ['Group', 'Donor', 'Phone', 'Invoice #', 'Date', 'Pledged', 'Paid', 'Balance', '% Paid', 'Status'];
	var fullRows = combined.slice().sort(function (a, b) { return a.group.localeCompare(b.group) || a.donor.localeCompare(b.donor); })
		.map(function (r) { return [r.group, r.donor, r.phone, r.invoice, r.date, +fmtNum(r.pledged), +fmtNum(r.paid), +fmtNum(r.balance), r.pct, r.status]; });
	var wsAll = XLSX.utils.aoa_to_sheet([fullHeader].concat(fullRows));
	styleSheet(wsAll, [18, 22, 14, 14, 12, 12, 12, 12, 8, 10]);
	XLSX.utils.book_append_sheet(wb, wsAll, 'Full List');
	var groups = {};
	combined.forEach(function (r) {
		if (!groups[r.group]) groups[r.group] = { pledged: 0, paid: 0, balance: 0, count: 0, full: 0, unpaid: 0 };
		var g = groups[r.group];
		g.pledged += r.pledged; g.paid += r.paid; g.balance += r.balance; g.count++;
		if (r.status === 'paid') g.full++; if (r.status === 'unpaid') g.unpaid++;
	});
	var sortedGroups = Object.keys(groups).sort(function (a, b) { return a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b); });
	var sumHeader = ['Group', 'Donors', 'Pledged', 'Paid', 'Balance', '% Collected', 'Fully Paid', 'Unpaid'];
	var totals = { pledged: 0, paid: 0, balance: 0, count: 0, full: 0, unpaid: 0 };
	var sumRows = sortedGroups.map(function (grp) {
		var g = groups[grp]; Object.keys(totals).forEach(function (k) { totals[k] += g[k]; });
		return [grp, g.count, +fmtNum(g.pledged), +fmtNum(g.paid), +fmtNum(g.balance), g.pledged > 0 ? Math.round(g.paid / g.pledged * 100) : 0, g.full, g.unpaid];
	});
	var tpct = totals.pledged > 0 ? Math.round(totals.paid / totals.pledged * 100) : 0;
	sumRows.push(['TOTAL', totals.count, +fmtNum(totals.pledged), +fmtNum(totals.paid), +fmtNum(totals.balance), tpct, totals.full, totals.unpaid]);
	var wsSum = XLSX.utils.aoa_to_sheet([sumHeader].concat(sumRows));
	styleSheet(wsSum, [20, 8, 14, 14, 14, 12, 10, 8]);
	XLSX.utils.book_append_sheet(wb, wsSum, 'Summary');
	sortedGroups.forEach(function (grp) {
		var members = combined.filter(function (r) { return r.group === grp; }).sort(function (a, b) { return a.donor.localeCompare(b.donor); });
		var hdr = ['Donor', 'Phone', 'Invoice #', 'Date', 'Pledged', 'Paid', 'Balance', '% Paid', 'Status'];
		var rs = members.map(function (r) { return [r.donor, r.phone, r.invoice, r.date, +fmtNum(r.pledged), +fmtNum(r.paid), +fmtNum(r.balance), r.pct, r.status]; });
		var tP = members.reduce(function (s, r) { return s + r.pledged; }, 0), tPd = members.reduce(function (s, r) { return s + r.paid; }, 0), tB = members.reduce(function (s, r) { return s + r.balance; }, 0);
		rs.push(['TOTAL', '', '', '', +fmtNum(tP), +fmtNum(tPd), +fmtNum(tB), '', '']);
		var wsG = XLSX.utils.aoa_to_sheet([hdr].concat(rs));
		styleSheet(wsG, [22, 14, 14, 12, 12, 12, 12, 8, 10]);
		XLSX.utils.book_append_sheet(wb, wsG, grp.replace(/[\\\/:*?"<>|]/g, '').substring(0, 31) || 'Group');
	});
	XLSX.writeFile(wb, 'pledge-report.xlsx');
}

// ── EXPORT GROUP IMAGES ───────────────────────────────────
function drawGroupCard(grp, members) {
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
function renderWarnings(mismatches) {
	warnData = mismatches;
	var panel = document.getElementById('warn-panel'), countEl = document.getElementById('warn-count');
	var tabBtn = document.getElementById('top-tab-mismatches');
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
		var isHigh = m.priority === 'High';
		var priBg = isHigh ? 'var(--c-red-bg)' : 'var(--c-amber-bg)';
		var priCol = isHigh ? 'var(--c-red)' : 'var(--c-amber)';
		var icon = m.source === 'QuickBooks' ? '\ud83d\udcc4' : m.source === 'Cash Payments' ? '\ud83d\udcb5' : '\ud83d\udc65';
		var resolved = document.getElementById(rowId) && document.getElementById(rowId).classList.contains('resolved');
		return '<tr id="' + rowId + '" class="warn-row' + (resolved ? ' resolved' : '') + '" style="border-bottom:1px solid var(--c-border)">' +
			'<td style="padding:9px 12px"><span class="badge" style="background:' + priBg + ';color:' + priCol + '">' + esc(m.priority) + '</span></td>' +
			'<td style="padding:9px 12px;font-weight:800;font-size:13px">' + esc(m.name) + '</td>' +
			'<td style="padding:9px 12px;font-size:12px;color:var(--c-text2)">' + icon + ' ' + esc(m.source) + '</td>' +
			'<td style="padding:9px 12px;font-size:12px;color:var(--c-text2)">' + esc(m.detail) + '</td>' +
			'<td style="padding:9px 12px;text-align:center"><input type="checkbox" ' + (resolved ? 'checked' : '') + ' onchange="resolveWarn(this,\'' + rowId + '\')" title="Mark as fixed"></td>' +
			'</tr>';
	}).join('');
	list.innerHTML = '<table style="width:100%;border-collapse:collapse"><thead><tr>' + thHtml + '</tr></thead><tbody>' + rowsHtml + '</tbody></table>';
}
function warnSort(col) { if (warnSortCol === col) warnSortDir *= -1; else { warnSortCol = col; warnSortDir = 1; } renderWarnTable(); }
function resolveWarn(cb, rowId) { var row = document.getElementById(rowId); if (!row) return; if (cb.checked) row.classList.add('resolved'); else row.classList.remove('resolved'); }
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

	if (_cmsAvailable) {
		// Use standardized format for CMS storage
		peopleData = [{ name: 'Smith, John', group: 'North Side', phone: '555-0101' }, { name: 'Cohen, Rachel', group: 'North Side', phone: '555-0102' }, { name: 'Green, Nancy', group: 'North Side', phone: '555-0103' }, { name: 'Harris, Paul', group: 'North Side', phone: '555-0104' }, { name: 'Goldberg, David', group: 'Downtown', phone: '555-0201' }, { name: 'Levy, Sarah', group: 'Downtown', phone: '555-0202' }, { name: 'Klein, Peter', group: 'Downtown', phone: '555-0203' }, { name: 'Miller, Robert', group: 'East End', phone: '555-0301' }, { name: 'Davis, Emily', group: 'East End', phone: '555-0302' }, { name: 'Torres, Maria', group: 'East End', phone: '555-0303' }, { name: 'Brown, Michael', group: '', phone: '555-0401' }, { name: 'Wilson, Lisa', group: '', phone: '555-0402' }, { name: 'Adams, Carol', group: '', phone: '555-0403' }];
		cashData = [{ donorName: 'Smith, John', date: '2024-03-10', amount: 2500, note: 'Donation 26' }, { donorName: 'Smith, John', date: '2024-05-01', amount: 2500, note: 'Donation 26' }, { donorName: 'Cohen, Rachel', date: '2024-04-15', amount: 1500, note: 'Donation 26' }, { donorName: 'Goldberg, David', date: '2024-02-20', amount: 2000, note: 'Donation 26' }, { donorName: 'Davis, Emily', date: '2024-04-01', amount: 1200, note: 'Donation 26' }];
		saveStoredPeople();
		saveStoredCash();
		renderPeopleManager();
		renderCashManager();
		refreshPeopleCard();
		refreshCashCard();
	} else {
		// Fallback: use file-based format with column mapping
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