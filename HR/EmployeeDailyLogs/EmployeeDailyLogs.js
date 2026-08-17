/* ---- state ---- */
var state = { employee: { name: '', position: '' }, entries: [] };
var currentUser = null;
var editingId = null, confirmId = null, readOnly = false, theme = 'light';
var openDays = {}, modalLinks = [];
var cfg = { target: 30, wage: 0, endDate: '', defStart: '09:00', defEnd: '17:00' };
var $ = function (id) { return document.getElementById(id); };

/* ---- helpers ---- */
function el(tag, attrs, kids) {
	var n = document.createElement(tag);
	if (attrs) for (var k in attrs) {
		if (k === 'class') n.className = attrs[k];
		else if (k === 'text') n.textContent = attrs[k];
		else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
		else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
	}
	if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
		if (c == null || c === false) return;
		n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
	});
	return n;
}
function uid() { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function todayStr() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function toMin(t) { if (!t) return null; var p = t.split(':'); return (+p[0]) * 60 + (+p[1]); }
function calcHours(s, e, b) { var a = toMin(s), z = toMin(e); if (a == null || z == null || z <= a) return 0; var m = z - a - (b || 0); if (m < 0) m = 0; return Math.round((m / 60) * 100) / 100; }
function fmtH(h) { return (Math.round(h * 100) / 100) + ' h'; }
function fmtDate(ds) { return new Date(ds + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
function fmtDT(iso) { if (!iso) return ''; return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function isoWeek(ds) { var t = new Date(ds + 'T00:00:00'); t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7)); var w1 = new Date(t.getFullYear(), 0, 4); var wk = 1 + Math.round(((t - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7); return t.getFullYear() + '-W' + (wk < 10 ? '0' + wk : wk); }
function weekRange(ds) { var d = new Date(ds + 'T00:00:00'); var off = (d.getDay() + 6) % 7; var mon = new Date(d); mon.setDate(d.getDate() - off); var sun = new Date(mon); sun.setDate(mon.getDate() + 6); var f = function (x) { return x.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }; return f(mon) + ' – ' + f(sun); }
function userRef(u) { return u ? { id: u.id || null, name: u.name || u.email || 'Unknown' } : null; }
function sameUser(a, b) { if (!a || !b) return false; if (a.id && b.id) return a.id === b.id; return (a.name || '').toLowerCase() === (b.name || '').toLowerCase(); }
function escapeText(t) { var d = document.createElement('div'); d.textContent = t == null ? '' : t; return d.innerHTML; }
function normalizeUrl(u) { u = (u || '').trim(); if (!u) return null; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; try { return new URL(u).href; } catch (e) { return null; } }
function hostLabel(url) { try { var h = new URL(url); return h.hostname.replace(/^www\./, '') + (h.pathname !== '/' ? h.pathname : ''); } catch (e) { return url; } }

/* ---- persistence ---- */
function commit() { try { tool.setValue(state); } catch (e) { } validate(); }
function validate() {
	if (!state.employee.name || !state.employee.name.trim()) { tool.reportValid(false, 'Add the employee name before saving the form.'); return; }
	if (state.entries.some(function (e) { return !e.activities || !e.activities.trim(); })) { tool.reportValid(false, 'Every logged day needs an activity summary.'); return; }
	tool.reportValid(true);
}

/* ---- modal ---- */
function openModal(entry) {
	editingId = entry ? entry.id : null;
	modalLinks = entry && Array.isArray(entry.links) ? entry.links.map(function (l) { return { label: l.label || '', url: l.url }; }) : [];
	$('modalTitle').textContent = entry ? 'Edit work day' : 'Add work day';
	$('btnSave').textContent = entry ? 'Save changes' : 'Add entry';
	$('fDate').value = entry ? entry.date : todayStr();
	$('fStart').value = entry ? entry.start : cfg.defStart;
	$('fEnd').value = entry ? entry.end : cfg.defEnd;
	$('fBreak').value = entry ? (entry.breakMin || 0) : 0;
	$('fLoc').value = entry ? (entry.location || 'On-site') : 'On-site';
	$('fAct').value = entry ? (entry.activities || '') : '';
	$('fLinkLabel').value = ''; $('fLinkUrl').value = '';
	if (cfg.endDate) $('fDate').setAttribute('max', cfg.endDate); else $('fDate').removeAttribute('max');
	renderModalLinks();
	$('backdrop').hidden = false;
	$('cwlRoot').style.minHeight = '640px';
	modalValidate();
	try { tool.resize(); } catch (e) { }
	$('fDate').focus();
}
function closeModal() {
	$('backdrop').hidden = true; editingId = null; modalLinks = [];
	$('cwlRoot').style.minHeight = '';
	try { tool.resize(); } catch (e) { }
}
function addLink() {
	var url = normalizeUrl($('fLinkUrl').value);
	if (!url) { tool.notify('Enter a valid URL (e.g. https://example.com).', 'warning'); return; }
	var label = $('fLinkLabel').value.trim();
	if (modalLinks.some(function (l) { return l.url === url; })) { tool.notify('That link is already added.', 'info'); return; }
	modalLinks.push({ label: label, url: url });
	$('fLinkLabel').value = ''; $('fLinkUrl').value = '';
	renderModalLinks(); $('fLinkUrl').focus();
	try { tool.resize(); } catch (e) { }
}
function renderModalLinks() {
	var box = $('linkList'); box.textContent = '';
	modalLinks.forEach(function (l, i) {
		box.appendChild(el('div', { class: 'cwl-link-item' }, [
			el('span', { class: 'cwl-link-ico', text: '🔗' }),
			el('div', { class: 'cwl-link-info' }, [
				el('div', { class: 'cwl-link-name', text: l.label || hostLabel(l.url) }),
				el('div', { class: 'cwl-link-url-txt', text: l.url })
			]),
			el('button', { class: 'cwl-link-del', 'aria-label': 'Remove link', text: '×', onclick: function () { modalLinks.splice(i, 1); renderModalLinks(); try { tool.resize(); } catch (e) { } } })
		]));
	});
}
function modalValidate() {
	var date = $('fDate').value, s = $('fStart').value, e = $('fEnd').value, act = $('fAct').value.trim();
	var brk = parseInt($('fBreak').value, 10) || 0;
	var note = $('modalNote'), save = $('btnSave'), calc = $('fCalc');
	var msg = '', ok = true;
	if (!date) ok = false;
	else if (state.entries.some(function (x) { return x.date === date && x.id !== editingId; })) { msg = 'This day is already logged. Pick a different date.'; ok = false; }
	else if (cfg.endDate && date > cfg.endDate) msg = 'Heads up: this date is after the work period end date (' + cfg.endDate + ').';
	if (s && e && toMin(e) <= toMin(s)) { msg = 'End time must be after the start time.'; ok = false; }
	if (!s || !e || !act) ok = false;
	calc.textContent = (s && e && toMin(e) > toMin(s)) ? fmtH(calcHours(s, e, brk)) : '—';
	note.hidden = !msg; note.textContent = msg;
	note.style.background = ok ? 'var(--warn-soft)' : 'var(--accent-soft)';
	note.style.color = ok ? 'var(--warn)' : 'var(--accent-d)';
	save.disabled = !ok || readOnly;
}
function saveEntry() {
	var date = $('fDate').value, s = $('fStart').value, e = $('fEnd').value, act = $('fAct').value.trim();
	var brk = parseInt($('fBreak').value, 10) || 0, loc = $('fLoc').value;
	if (!date || !s || !e || !act || toMin(e) <= toMin(s)) { tool.notify('Please complete all required fields correctly.', 'warning'); return; }
	if (state.entries.some(function (x) { return x.date === date && x.id !== editingId; })) { tool.notify('That day is already logged.', 'error'); return; }
	var hrs = calcHours(s, e, brk), links = modalLinks.slice();
	if (editingId) {
		var i = state.entries.findIndex(function (x) { return x.id === editingId; });
		var was = state.entries[i].approved;
		var en = state.entries[i];
		en.date = date; en.start = s; en.end = e; en.breakMin = brk; en.location = loc; en.activities = act; en.hours = hrs; en.links = links;
		en.approved = false; en.verifiedBy = null; en.verifiedAt = null;
		tool.notify(was ? 'Entry updated — verification was cleared because the log changed.' : 'Entry updated.', was ? 'warning' : 'success');
	} else {
		state.entries.push({
			id: uid(), date: date, start: s, end: e, breakMin: brk, location: loc, activities: act, hours: hrs, links: links,
			approved: false, loggedBy: userRef(currentUser) || { id: null, name: 'Unknown' }, loggedAt: new Date().toISOString(),
			verifiedBy: null, verifiedAt: null
		});
		tool.notify('Work day logged.', 'success');
	}
	closeModal(); commit(); render();
}

/* ---- verification (segregation of duties) ---- */
function canVerify(e) { return !readOnly && currentUser && !e.approved && !sameUser(e.loggedBy, currentUser); }
function verify(e) { if (!canVerify(e)) return; e.approved = true; e.verifiedBy = userRef(currentUser); e.verifiedAt = new Date().toISOString(); tool.notify('Verified by ' + e.verifiedBy.name + '.', 'success'); commit(); render(); }
function unverify(e) { if (readOnly || !currentUser || sameUser(e.loggedBy, currentUser)) return; e.approved = false; e.verifiedBy = null; e.verifiedAt = null; tool.notify('Verification removed.', 'info'); commit(); render(); }
function deleteEntry(id) { state.entries = state.entries.filter(function (e) { return e.id !== id; }); confirmId = null; delete openDays[id]; tool.notify('Entry removed.', 'info'); commit(); render(); }

/* ---- render ---- */
function totalHours() { return state.entries.reduce(function (s, e) { return s + (e.hours || 0); }, 0); }
function renderWho() {
	var w = $('whoami');
	if (currentUser) w.innerHTML = 'Signed in as <b>' + escapeText(currentUser.name) + '</b>';
	else w.textContent = 'No signed-in user — verification is disabled.';
}
function renderStats() {
	var bar = $('statBar'); bar.textContent = '';
	var weeks = {}, verified = 0;
	state.entries.forEach(function (e) { weeks[isoWeek(e.date)] = 1; if (e.approved) verified++; });
	var stats = [
		{ n: state.entries.length, l: 'Days logged' },
		{ n: fmtH(totalHours()), l: 'Total hours', a: true },
		{ n: Object.keys(weeks).length, l: 'Weeks worked' },
		{ n: verified + ' / ' + state.entries.length, l: 'Verified' }
	];
	if (cfg.wage > 0) stats.push({ n: '$' + (totalHours() * cfg.wage).toFixed(2), l: 'Est. gross pay (info)' });
	stats.forEach(function (s) {
		bar.appendChild(el('div', { class: 'cwl-stat' + (s.a ? ' cwl-stat-accent' : '') }, [
			el('div', { class: 'cwl-stat-num', text: String(s.n) }), el('div', { class: 'cwl-stat-lab', text: s.l })
		]));
	});
}
function renderList() {
	var body = $('listBody'); body.textContent = '';
	$('dayCount').textContent = state.entries.length ? state.entries.length + ' day' + (state.entries.length > 1 ? 's' : '') : '';
	if (!state.entries.length) { body.appendChild(el('div', { class: 'cwl-empty', text: readOnly ? 'No work days have been logged yet.' : 'No work days yet — use “Add work day” to log the first one.' })); return; }
	var sorted = state.entries.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
	var groups = {};
	sorted.forEach(function (e) { (groups[isoWeek(e.date)] = groups[isoWeek(e.date)] || []).push(e); });
	Object.keys(groups).sort().reverse().forEach(function (wk) {
		var items = groups[wk], wkTotal = items.reduce(function (s, e) { return s + (e.hours || 0); }, 0), meets = wkTotal >= cfg.target;
		var wrap = el('div', { class: 'cwl-week' }, [
			el('div', { class: 'cwl-week-head' }, [
				el('div', {}, [el('span', { class: 'cwl-week-title', text: 'Week ' + wk.split('-W')[1] }), el('span', { class: 'cwl-week-range', text: weekRange(items[0].date) })]),
				el('div', { class: 'cwl-week-total' }, [el('span', { text: fmtH(wkTotal) }), el('span', { class: 'cwl-badge ' + (meets ? 'cwl-badge-ok' : 'cwl-badge-warn'), text: meets ? '≥ ' + cfg.target + 'h ✓' : 'under ' + cfg.target + 'h' })])
			])
		]);
		items.forEach(function (e) { wrap.appendChild(renderDay(e)); });
		body.appendChild(wrap);
	});
}
function renderDay(e) {
	var open = !!openDays[e.id];
	var statusBadge = e.approved ? el('span', { class: 'cwl-badge cwl-badge-ok', text: '✓ Verified' }) : el('span', { class: 'cwl-badge cwl-badge-pend', text: 'Pending' });

	var head = el('div', { class: 'cwl-day-head' }, [
		el('span', { class: 'cwl-chev', text: '▶' }),
		el('span', { class: 'cwl-day-date', text: fmtDate(e.date) }),
		el('span', { class: 'cwl-chip', text: e.location || 'On-site' }),
		el('span', { class: 'cwl-day-spacer' }),
		statusBadge,
		el('span', { class: 'cwl-day-hours', text: fmtH(e.hours || 0) })
	]);

	var vCtrl;
	if (readOnly) vCtrl = null;
	else if (e.approved) vCtrl = (currentUser && !sameUser(e.loggedBy, currentUser)) ? el('button', { class: 'cwl-btn cwl-btn-ghost cwl-btn-sm', text: 'Unverify', onclick: function () { unverify(e); } }) : null;
	else if (canVerify(e)) vCtrl = el('button', { class: 'cwl-btn cwl-btn-primary cwl-btn-sm', text: 'Verify', onclick: function () { verify(e); } });
	else vCtrl = el('span', { class: 'cwl-hint', text: !currentUser ? 'Sign in to verify.' : 'You logged this day — a different person must verify it.' });

	var actions;
	if (readOnly) actions = el('span', {});
	else if (confirmId === e.id) actions = el('div', { class: 'cwl-actions' }, [
		el('button', { class: 'cwl-btn cwl-btn-danger cwl-btn-sm', text: 'Confirm delete', onclick: function () { deleteEntry(e.id); } }),
		el('button', { class: 'cwl-btn cwl-btn-ghost cwl-btn-sm', text: 'Cancel', onclick: function () { confirmId = null; render(); } })
	]);
	else actions = el('div', { class: 'cwl-actions' }, [
		vCtrl,
		el('button', { class: 'cwl-btn cwl-btn-ghost cwl-btn-sm', text: 'Edit', onclick: function () { openModal(e); } }),
		el('button', { class: 'cwl-btn cwl-btn-danger cwl-btn-sm', text: 'Delete', onclick: function () { confirmId = e.id; render(); } })
	]);

	var late = cfg.endDate && e.date > cfg.endDate ? el('span', { class: 'cwl-flag', text: 'After work period end date' }) : null;

	var linksView = null;
	if (e.links && e.links.length) {
		var chips = [el('span', { class: 'cwl-lab', text: 'Reference links' })];
		e.links.forEach(function (l) {
			chips.push(el('a', { class: 'cwl-link-chip', href: l.url, target: '_blank', rel: 'noopener noreferrer' }, [
				el('span', { text: '🔗 ' + (l.label || hostLabel(l.url)) })
			]));
		});
		linksView = el('div', { class: 'cwl-links-view' }, chips);
	}

	var bodyEl = el('div', { class: 'cwl-day-body' }, [
		el('div', { class: 'cwl-detail-row' }, [
			el('span', {}, [el('b', { text: e.start + ' – ' + e.end }), document.createTextNode('  hours')]),
			e.breakMin ? el('span', {}, [el('b', { text: e.breakMin + ' min' }), document.createTextNode('  break')]) : null,
			el('span', {}, [el('b', { text: e.location || 'On-site' }), document.createTextNode('  location')])
		]),
		el('p', { class: 'cwl-act', text: e.activities || '' }),
		linksView,
		late,
		el('div', { class: 'cwl-meta' }, [
			el('span', {}, [document.createTextNode('Logged by '), el('b', { text: (e.loggedBy && e.loggedBy.name) || 'Unknown' }), document.createTextNode(e.loggedAt ? ' · ' + fmtDT(e.loggedAt) : '')]),
			el('span', {}, e.approved
				? [document.createTextNode('Verified by '), el('b', { text: (e.verifiedBy && e.verifiedBy.name) || '—' }), document.createTextNode(e.verifiedAt ? ' · ' + fmtDT(e.verifiedAt) : '')]
				: [document.createTextNode('Awaiting verification by a second person')])
		]),
		el('div', { class: 'cwl-day-foot' }, [
			el('span', { class: 'cwl-vstate ' + (e.approved ? 'cwl-vstate-on' : 'cwl-vstate-off'), text: e.approved ? '✓ Verified' : '○ Not verified' }),
			actions
		])
	]);

	var card = el('div', { class: 'cwl-day' + (open ? ' cwl-open' : '') }, [head, bodyEl]);
	head.addEventListener('click', function () {
		if (openDays[e.id]) { delete openDays[e.id]; card.classList.remove('cwl-open'); }
		else { openDays[e.id] = true; card.classList.add('cwl-open'); }
		try { tool.resize(); } catch (x) { }
	});
	return card;
}
function render() { $('empName').value = state.employee.name || ''; $('empPos').value = state.employee.position || ''; renderWho(); renderStats(); renderList(); try { tool.resize(); } catch (e) { } }

/* ---- theme ---- */
function setTheme(t) {
	theme = (t === 'dark') ? 'dark' : 'light';
	$('cwlRoot').setAttribute('data-theme', theme);
	$('themeIco').textContent = theme === 'dark' ? '☾' : '☀';
	$('themeTxt').textContent = theme === 'dark' ? 'Dark' : 'Light';
}

/* ---- export ---- */
function csvCell(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
function exportCsv() {
	if (!state.entries.length) { tool.notify('Nothing to export yet.', 'info'); return; }
	var rows = [['Date', 'Weekday', 'Start', 'End', 'Break (min)', 'Hours', 'Location', 'Logged by', 'Verified', 'Verified by', 'Reference links', 'Activity summary']];
	state.entries.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (e) {
		var links = (e.links || []).map(function (l) { return l.label ? l.label + ' ' + l.url : l.url; }).join(' | ');
		rows.push([e.date, new Date(e.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' }), e.start, e.end, e.breakMin || 0, e.hours || 0, e.location || '',
		(e.loggedBy && e.loggedBy.name) || '', e.approved ? 'Yes' : 'No', (e.verifiedBy && e.verifiedBy.name) || '', links, e.activities || '']);
	});
	rows.push([], ['Employee', state.employee.name || ''], ['Position', state.employee.position || ''], ['Total hours', totalHours()]);
	var csv = rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
	var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
	var a = document.createElement('a');
	a.href = url; a.download = 'worklog_' + (state.employee.name || 'employee').replace(/[^a-z0-9]+/gi, '_').toLowerCase() + '_' + todayStr() + '.csv';
	document.body.appendChild(a); a.click(); document.body.removeChild(a);
	setTimeout(function () { URL.revokeObjectURL(url); }, 1500); tool.notify('CSV exported.', 'success');
}

/* ---- read-only ---- */
function lockUI(ro) {
	readOnly = !!ro;
	['empName', 'empPos'].forEach(function (id) { $(id).disabled = readOnly; });
	$('btnAdd').disabled = readOnly;
	if (readOnly && !$('backdrop').hidden) closeModal();
	render();
}

/* ---- load ---- */
function loadValue(val) {
	state = { employee: { name: '', position: '' }, entries: [] };
	if (val && typeof val === 'object') {
		if (val.employee) { state.employee.name = val.employee.name || ''; state.employee.position = val.employee.position || ''; }
		if (Array.isArray(val.entries)) state.entries = val.entries.map(function (e) {
			return {
				id: e.id || uid(), date: e.date || '', start: e.start || '', end: e.end || '', breakMin: e.breakMin || 0,
				location: e.location || 'On-site', activities: e.activities || '',
				hours: (typeof e.hours === 'number') ? e.hours : calcHours(e.start, e.end, e.breakMin || 0),
				links: Array.isArray(e.links) ? e.links.filter(function (l) { return l && l.url; }).map(function (l) { return { label: l.label || '', url: l.url }; }) : [],
				approved: !!e.approved, loggedBy: e.loggedBy || { id: null, name: 'Unknown' }, loggedAt: e.loggedAt || null,
				verifiedBy: e.verifiedBy || null, verifiedAt: e.verifiedAt || null
			};
		}).filter(function (e) { return e.date; });
	}
	if (!state.employee.name) state.employee.name = tool.param('employeeName', '') || (currentUser && currentUser.name) || '';
	if (!state.employee.position) state.employee.position = tool.param('position', '') || '';
}

/* ---- entry point ---- */
tool.onReady(function (val, fields) {
	currentUser = userRef(tool.getUser());
	cfg.target = parseFloat(tool.param('weeklyTarget', 30)) || 30;
	cfg.wage = parseFloat(tool.param('hourlyWage', 0)) || 0;
	cfg.endDate = tool.param('endDate', '') || '';
	cfg.defStart = tool.param('defaultStart', '09:00') || '09:00';
	cfg.defEnd = tool.param('defaultEnd', '17:00') || '17:00';
	setTheme(tool.param('defaultTheme', 'light'));

	try {
		tool.declareOutput({
			type: 'object', properties: {
				employee: { type: 'object', properties: { name: { type: 'string' }, position: { type: 'string' } } },
				entries: {
					type: 'array', items: {
						type: 'object', properties: {
							id: { type: 'string' }, date: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' },
							breakMin: { type: 'number' }, location: { type: 'string' }, activities: { type: 'string' }, hours: { type: 'number' },
							links: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, url: { type: 'string' } } } },
							approved: { type: 'boolean' }, loggedBy: { type: 'object' }, loggedAt: { type: 'string' }, verifiedBy: { type: 'object' }, verifiedAt: { type: 'string' }
						}
					}
				}
			}
		});
		tool.declareParams([
			{ name: 'employeeName', label: 'Employee name', type: 'text', default: '', hint: 'Pre-fills the employee field' },
			{ name: 'position', label: 'Position / job title', type: 'text', default: '', hint: 'Pre-fills the position field' },
			{ name: 'weeklyTarget', label: 'Weekly hour target', type: 'number', default: 30, hint: 'Used for the weekly hours summary badge' },
			{ name: 'endDate', label: 'Work period end date (YYYY-MM-DD)', type: 'text', default: '', hint: 'Caps the date picker and flags later days' },
			{ name: 'hourlyWage', label: 'Hourly wage', type: 'number', default: 0, hint: 'Optional; shows estimated gross pay' },
			{ name: 'defaultStart', label: 'Default start time', type: 'text', default: '09:00', hint: 'HH:MM pre-filled in the form' },
			{ name: 'defaultEnd', label: 'Default end time', type: 'text', default: '17:00', hint: 'HH:MM pre-filled in the form' },
			{ name: 'defaultTheme', label: 'Default theme', type: 'text', default: 'light', hint: '“light” or “dark”' }
		]);
	} catch (e) { }

	loadValue(val);
	render();
	if (tool.isReadOnly()) lockUI(true);

	$('empName').addEventListener('change', function () { state.employee.name = this.value.trim(); commit(); renderWho(); });
	$('empPos').addEventListener('change', function () { state.employee.position = this.value.trim(); commit(); });
	$('themeBtn').addEventListener('click', function () { setTheme(theme === 'dark' ? 'light' : 'dark'); });
	$('btnAdd').addEventListener('click', function () { if (!readOnly) openModal(null); });
	$('btnExport').addEventListener('click', exportCsv);

	['fDate', 'fStart', 'fEnd', 'fBreak', 'fAct'].forEach(function (id) { $(id).addEventListener('input', modalValidate); $(id).addEventListener('change', modalValidate); });
	$('btnAddLink').addEventListener('click', addLink);
	$('fLinkUrl').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); addLink(); } });
	$('btnSave').addEventListener('click', saveEntry);
	$('btnCancel').addEventListener('click', closeModal);
	$('btnClose').addEventListener('click', closeModal);
	$('backdrop').addEventListener('click', function (ev) { if (ev.target === this) closeModal(); });
	document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !$('backdrop').hidden) closeModal(); });

	tool.onValueChange(function (v) { loadValue(v); render(); });
	tool.onReadonlyChange(function (ro) { lockUI(ro); });
	tool.onUserChange(function (u) { currentUser = userRef(u); render(); });
	tool.onFieldsChange(function (f) { /* no sibling-field dependencies */ });

	validate();
});