/* ── constants ── */
const HR_CRITERIA = [
	{ name: 'Technical Skills', desc: 'Domain knowledge and technical ability' },
	{ name: 'Problem Solving', desc: 'Approach to analysis and reasoning' },
	{ name: 'Communication', desc: 'Clarity, articulation, listening' },
	{ name: 'Culture Fit', desc: 'Values alignment and team compatibility' },
	{ name: 'Leadership', desc: 'Initiative, ownership, influence' },
	{ name: 'Motivation', desc: 'Drive, enthusiasm, growth mindset' }
];
const AVATAR_COLORS = ['#3d5cff', '#1a9e65', '#b87010', '#7c3aed', '#d63030', '#0f8a7a', '#c45c1a', '#2a7a4a'];
const GENERAL_POS_ID = '__general__';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS12 = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
const MINS = ['00', '15', '30', '45'];
const FIELD_MAP_OPTIONS = [
	{ key: 'name', label: 'Full Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' },
	{ key: 'source', label: 'Applied Via' }, { key: 'resume', label: 'Resume URL' },
	{ key: 'position', label: 'Position Applied For' }, { key: 'notes', label: 'Notes' }, { key: '_skip', label: '— Skip —' }
];

/* ── state ── */
let DB = { positions: [], interviewers: [], candidates: [], interviews: [], scores: [], screenings: [], placements: [], settings: {} };
let selectedCandPositions = [];
let selectedSchedInterviewers = [];
let selectedIntDetailIvrs = [];
let ivrSlotsBuffer = [];
let posCriteriaBuffer = [];
let confirmCallback = null;
let elimCallback = null;
let dupProceedCallback = null;
let isReadOnly = false;
let currentTheme = 'light';
let importData = { headers: [], rows: [], mapping: {}, posMapping: {} };
let scheduleSlots = [];
let checkedScreenIds = new Set();
let checkedCandIds = new Set();
let dupCheckTimer = null;
let calTab = 'list';
let calIvrFilter = '';
let calCursor = new Date();
let intDetailCandFilter = 'no-interview'; // 'no-interview' | 'advanced' | 'all'

/* ── helpers ── */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function avatarColor(n) { let h = 0; for (let c of n) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff; return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] }
function initials(n) { return n.split(' ').map(w => w[0]?.toUpperCase() || '').slice(0, 2).join('') }
function avatar(n, s = 30) { const c = avatarColor(n); return `<div class="avatar" style="width:${s}px;height:${s}px;background:${c}22;color:${c};font-size:${Math.round(s * .38)}px">${initials(n)}</div>` }
function fmtDate(d) { if (!d) return '—'; const dt = new Date(d + 'T00:00:00'); return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) }
function fmtDateTime(d) { if (!d) return '—'; return new Date(d).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) }
function fmtTime(d) { if (!d) return ''; return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) }
function getRecW(r) { return { 'strong-yes': 2, 'yes': 1, 'maybe': 0, 'no': -1 }[r] || 0 }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function normalizeName(n) { return String(n || '').toLowerCase().replace(/\s+/g, ' ').trim() }
function normalizeEmail(e) { return String(e || '').toLowerCase().trim() }

/* ── AM/PM slot helpers ── */
function slotToMinutes(slot) {
	let h = parseInt(slot.hour12 || '12'); const m = parseInt(slot.minute || '0'); const ap = String(slot.ampm || 'AM').toUpperCase();
	if (ap === 'AM') { if (h === 12) h = 0 } else { if (h !== 12) h += 12 }
	return h * 60 + m;
}
function minutesToSlot(totalMin) {
	let h = Math.floor(totalMin / 60); const m = totalMin % 60; const ampm = h < 12 ? 'AM' : 'PM'; let h12 = h % 12; if (h12 === 0) h12 = 12;
	return { hour12: String(h12), minute: String(m).padStart(2, '0'), ampm };
}
function slotLabel(slot) {
	if (!slot) return '?'; const h = slot.hour12; const m = String(slot.minute || '00').padStart(2, '0'); const ap = slot.ampm || 'AM'; if (!h) return '?'; return `${h}:${m} ${ap}`;
}
function migrateSlot(s) {
	if (s && s.hour12) return s;
	const [fh, fm] = (s.from || '09:00').split(':').map(Number); const [th, tm] = (s.to || '17:00').split(':').map(Number);
	const fromS = minutesToSlot(fh * 60 + fm); const toS = minutesToSlot(th * 60 + tm);
	return { day: s.day || 'Mon', hour12: fromS.hour12, minute: fromS.minute, ampm: fromS.ampm, toHour12: toS.hour12, toMinute: toS.minute, toAmpm: toS.ampm };
}

/* ── core helpers ── */
function getSettings() { return DB.settings || {} }
function getDefaultMeetingUrl() { return getSettings().meetingUrl || '' }
function getDefaultMeetingPlatform() { return getSettings().meetingPlatform || '' }
function getDefaultDuration() { return parseInt(getSettings().defaultDuration) || 30 }
function getDefaultBreak() { return parseInt(getSettings().defaultBreak) || 15 }
function getStage(cid) {
	if (DB.placements && DB.placements.some(p => p.selectedCandidateId === cid)) return 'selected';
	const c = DB.candidates.find(x => x.id === cid); if (!c) return 'unknown';
	if (c.eliminated) return 'eliminated';
	if (DB.screenings && DB.screenings.some(s => s.candidateId === cid && s.status === 'advanced')) return 'advanced';
	if ((c.positionIds || []).length > 0) return 'pending'; return 'new';
}
function findDuplicates(name, email, excludeId) {
	const nn = normalizeName(name), ne = normalizeEmail(email);
	return DB.candidates.filter(c => { if (excludeId && c.id === excludeId) return false; if (ne && normalizeEmail(c.email) === ne) return true; if (nn && normalizeName(c.name) === nn) return true; return false });
}
function findExistingForImport(name, email) {
	const ne = normalizeEmail(email), nn = normalizeName(name);
	if (ne) { const b = DB.candidates.find(c => normalizeEmail(c.email) === ne); if (b) return b }
	if (nn) { const b = DB.candidates.find(c => normalizeName(c.name) === nn); if (b) return b }
	return null;
}

/* ── theme ── */
function applyTheme(t) { currentTheme = t; document.documentElement.setAttribute('data-theme', t); const i = document.getElementById('theme-icon'); if (i) i.textContent = t === 'dark' ? '☀️' : '🌙' }
function toggleTheme() { applyTheme(currentTheme === 'dark' ? 'light' : 'dark'); DB._theme = currentTheme; persist() }

/* ── persist / render ── */
function persist() {
	if (!DB.screenings) DB.screenings = []; if (!DB.placements) DB.placements = []; if (!DB.settings) DB.settings = {};
	tool.setValue(DB); updateNavBadges(); tool.resize();
}
function render(val) {
	if (val && typeof val === 'object' && !Array.isArray(val)) {
		DB = Object.assign({ positions: [], interviewers: [], candidates: [], interviews: [], scores: [], screenings: [], placements: [], settings: {} }, val);
		if (!DB.screenings) DB.screenings = []; if (!DB.placements) DB.placements = []; if (!DB.settings) DB.settings = {};
	}
	if (DB._theme) applyTheme(DB._theme);
	updateNavBadges(); renderCurrentSection();
}
function syncFields() { }
function lockUI(ro) { isReadOnly = ro === true; document.body.classList.toggle('readonly', isReadOnly) }

/* ── nav ── */
let currentPage = 'dashboard';
function navigate(page) {
	currentPage = page;
	document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
	document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
	const sec = document.getElementById('sec-' + page); if (sec) sec.classList.add('active');
	document.querySelectorAll('.nav-item').forEach(n => { if (n.dataset.page === page) n.classList.add('active') });
	renderCurrentSection(); tool.resize();
}
function renderCurrentSection() {
	const p = currentPage;
	if (p === 'dashboard') renderDashboard();
	else if (p === 'pipeline') renderPipeline();
	else if (p === 'positions') renderPositions();
	else if (p === 'interviewers') renderInterviewers();
	else if (p === 'candidates') renderCandidates();
	else if (p === 'screening') renderScreening();
	else if (p === 'scheduler') renderSchedulePage();
	else if (p === 'calendar') renderCalendar();
	else if (p === 'candidate-print') renderCandidatePrintPage();
	else if (p === 'scoring') populateScoringSelects();
	else if (p === 'reports') renderReports();
	else if (p === 'placements') renderPlacements();
	else if (p === 'settings') renderSettings();
}
function updateNavBadges() {
	const si = id => document.getElementById(id);
	if (si('nav-positions-count')) si('nav-positions-count').textContent = DB.positions.length;
	if (si('nav-interviewers-count')) si('nav-interviewers-count').textContent = DB.interviewers.length;
	if (si('nav-candidates-count')) si('nav-candidates-count').textContent = DB.candidates.length;
	if (si('nav-pipeline-count')) si('nav-pipeline-count').textContent = DB.candidates.length;
	if (si('nav-calendar-count')) si('nav-calendar-count').textContent = DB.interviews.length;
	const pending = DB.candidates.filter(c => (c.positionIds || []).length > 0 && !c.eliminated && !DB.screenings.some(s => s.candidateId === c.id && s.status === 'advanced')).length;
	if (si('nav-screening-count')) si('nav-screening-count').textContent = pending;
	const adv = DB.candidates.filter(c => DB.screenings.some(s => s.candidateId === c.id && s.status === 'advanced') && !DB.interviews.some(i => i.candidateId === c.id)).length;
	if (si('nav-scheduler-count')) si('nav-scheduler-count').textContent = adv;
}

/* ── drawers ── */
function openDrawer(id) { document.getElementById(id + '-drawer')?.classList.add('open'); document.getElementById(id + '-drawer-overlay')?.classList.add('open'); document.body.classList.add('drawer-open') }
function closeDrawer(id) { document.getElementById(id + '-drawer')?.classList.remove('open'); document.getElementById(id + '-drawer-overlay')?.classList.remove('open'); if (!document.querySelector('.drawer.open')) document.body.classList.remove('drawer-open') }

/* ── modals ── */
function openConfirm(title, body, cb, okLabel = 'Confirm') { confirmCallback = cb; document.getElementById('confirm-title').textContent = title; document.getElementById('confirm-body').textContent = body; document.getElementById('confirm-ok-btn').textContent = okLabel; document.getElementById('confirm-modal').classList.add('open') }
function closeConfirm() { document.getElementById('confirm-modal').classList.remove('open'); confirmCallback = null }
function openElimModal(body, cb) { elimCallback = cb; document.getElementById('elim-modal-body').textContent = body; document.getElementById('elim-reason').value = ''; document.getElementById('elim-modal').classList.add('open') }
function closeElimModal() { document.getElementById('elim-modal').classList.remove('open'); elimCallback = null }
function openDupConfirm(msg, matches, cb) {
	dupProceedCallback = cb; document.getElementById('dup-confirm-body').textContent = msg;
	document.getElementById('dup-existing-cards').innerHTML = matches.map(c => `<div class="dup-existing-card"><div style="font-weight:600;font-size:13px">${esc(c.name)}</div><div style="color:var(--text3);font-size:11px">${c.email || ''}${c.phone ? ' · ' + esc(c.phone) : ''}</div></div>`).join('');
	document.getElementById('dup-confirm-modal').classList.add('open');
}
function closeDupConfirm() { document.getElementById('dup-confirm-modal').classList.remove('open'); dupProceedCallback = null }
function openResumePreview(url) {
	if (!url) { tool.notify('No resume URL', 'warning'); return }
	document.getElementById('resume-open-link').href = url;
	const el = document.getElementById('resume-preview-content');
	if (url.toLowerCase().includes('.pdf')) { el.innerHTML = `<iframe src="${esc('https://docs.google.com/viewer?url=' + encodeURIComponent(url) + '&embedded=true')}" style="width:100%;height:100%;border:none;border-radius:8px"></iframe>` }
	else { el.innerHTML = `<iframe src="${esc(url)}" style="width:100%;height:100%;border:none;border-radius:8px" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>` }
	document.getElementById('resume-modal').classList.add('open');
}
function closeResumeModal() { document.getElementById('resume-modal').classList.remove('open'); document.getElementById('resume-preview-content').innerHTML = '' }
function openEmailModal(title, to, subject, body) { document.getElementById('email-modal-title').textContent = title; document.getElementById('email-to').value = to || ''; document.getElementById('email-subject').value = subject || ''; document.getElementById('email-body').value = body || ''; document.getElementById('email-modal').classList.add('open') }
function closeEmailModal() { document.getElementById('email-modal').classList.remove('open') }
function copyEmailToClipboard() {
	const text = `Subject: ${document.getElementById('email-subject').value}\n\n${document.getElementById('email-body').value}`;
	if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(text).then(() => tool.notify('Copied', 'success')).catch(() => fallbackCopy(text)) } else fallbackCopy(text);
}
function fallbackCopy(text) { const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); tool.notify('Copied', 'success') } catch (e) { tool.notify('Failed', 'error') } document.body.removeChild(ta) }

/* ══════════════════════════════════════════
   INTERVIEW DETAIL MODAL
   - Manual creation with filtered candidate list
   - Edit from calendar
   - Status tracking (email sent, called, done)
══════════════════════════════════════════ */
function getCandListForDetail() {
	// Filter candidates based on intDetailCandFilter
	if (intDetailCandFilter === 'no-interview') {
		// Advanced candidates who don't yet have any interview
		return DB.candidates.filter(c => !c.eliminated && DB.screenings.some(s => s.candidateId === c.id && s.status === 'advanced') && !DB.interviews.some(i => i.candidateId === c.id));
	} else if (intDetailCandFilter === 'advanced') {
		// All advanced (may already have interviews)
		return DB.candidates.filter(c => !c.eliminated && DB.screenings.some(s => s.candidateId === c.id && s.status === 'advanced'));
	} else {
		// All non-eliminated
		return DB.candidates.filter(c => !c.eliminated);
	}
}

function openInterviewDetail(interviewId) {
	const isNew = !interviewId;
	const int = interviewId ? DB.interviews.find(x => x.id === interviewId) : null;
	selectedIntDetailIvrs = int ? (int.interviewerIds || [int.interviewerId]).filter(Boolean) : [];
	if (isNew) intDetailCandFilter = 'no-interview';
	document.getElementById('int-detail-title').textContent = isNew ? 'New Interview' : 'Interview Details';
	// Populate candidate dropdown
	rebuildIntDetailCandDropdown(int?.candidateId || '');
	// Date & time
	const dateEl = document.getElementById('int-d-date'); const timeEl = document.getElementById('int-d-time');
	if (int) {
		dateEl.value = int.date || '';
		if (int.scheduledTime) { const d = new Date(int.scheduledTime); timeEl.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
		else timeEl.value = '09:00';
	} else { dateEl.value = new Date().toISOString().slice(0, 10); timeEl.value = '09:00' }
	// Duration
	document.getElementById('int-d-duration').value = String(int?.durationMin || 60);
	// Position
	const posSel = document.getElementById('int-d-position');
	posSel.innerHTML = '<option value="">— General —</option>' + DB.positions.map(p => `<option value="${p.id}">${esc(p.title)}</option>`).join('');
	if (int) { const cand = DB.candidates.find(c => c.id === int.candidateId); const detectedPos = cand ? (cand.positionIds || [])[0] : null; if (detectedPos) posSel.value = detectedPos }
	// Meeting link
	document.getElementById('int-d-platform').value = int?.meetingPlatform || '';
	document.getElementById('int-d-url').value = int?.meetingUrl || '';
	const defUrl = getDefaultMeetingUrl(); const defPlatform = getDefaultMeetingPlatform();
	const hintEl = document.getElementById('int-d-default-url-hint');
	if (hintEl) hintEl.textContent = defUrl ? `Default: ${defPlatform ? defPlatform + ' — ' : ''}${defUrl}` : 'No default meeting URL (configure in Settings)';
	// Notes
	document.getElementById('int-d-notes').value = int?.notes || '';
	// Status checkboxes
	document.getElementById('int-d-status-email').checked = !!(int?.statusEmailSent);
	document.getElementById('int-d-status-called').checked = !!(int?.statusCalled);
	document.getElementById('int-d-status-done').checked = !!(int?.statusDone);
	// Hidden id
	document.getElementById('int-d-id').value = interviewId || '';
	// Delete btn
	const delBtn = document.getElementById('int-d-delete-btn'); if (delBtn) delBtn.style.display = isNew ? 'none' : '';
	// Score btn
	const scoreBtn = document.getElementById('int-d-score-btn'); if (scoreBtn) scoreBtn.style.display = isNew ? 'none' : '';
	// Interviewers
	buildIntDetailIvrDropdown(); renderIntDetailIvrDisplay();
	// Conflict check & end label
	checkIntDetailConflict(); updateIntDetailEndLabel();
	document.getElementById('int-detail-modal').classList.add('open');
}

function rebuildIntDetailCandDropdown(selectedCandId) {
	const candSel = document.getElementById('int-d-candidate'); if (!candSel) return;
	const list = getCandListForDetail();
	// Make sure selected cand is always present even if not in filtered list
	const extras = selectedCandId && !list.find(c => c.id === selectedCandId) ? [DB.candidates.find(c => c.id === selectedCandId)].filter(Boolean) : [];
	const all = [...list, ...extras];
	// Status label per candidate
	candSel.innerHTML = '<option value="">Select candidate...</option>' + all.map(c => {
		const hasInt = DB.interviews.some(i => i.candidateId === c.id);
		const stage = getStage(c.id);
		const lbl = `${esc(c.name)}${hasInt ? ' [has interview]' : ''}${stage === 'selected' ? ' [selected]' : ''}`;
		return `<option value="${c.id}" ${c.id === selectedCandId ? 'selected' : ''}>${lbl}</option>`;
	}).join('');
	// Summary banner
	const banner = document.getElementById('int-d-cand-banner');
	if (banner) {
		const adv = DB.candidates.filter(c => !c.eliminated && DB.screenings.some(s => s.candidateId === c.id && s.status === 'advanced'));
		const noInt = adv.filter(c => !DB.interviews.some(i => i.candidateId === c.id));
		const filters = {
			'no-interview': `Showing ${noInt.length} advanced without interviews`,
			'advanced': `Showing ${adv.length} advanced candidates`,
			'all': `Showing all ${DB.candidates.filter(c => !c.eliminated).length} candidates`
		};
		banner.textContent = filters[intDetailCandFilter] || '';
	}
}

function closeInterviewDetail() { document.getElementById('int-detail-modal').classList.remove('open'); selectedIntDetailIvrs = [] }
function buildIntDetailIvrDropdown() {
	const dd = document.getElementById('int-d-ivr-dropdown'); if (!dd) return;
	dd.innerHTML = DB.interviewers.map(ivr => `
    <div class="dropdown-item ${selectedIntDetailIvrs.includes(ivr.id) ? 'selected' : ''}" data-action="toggleIntDetailIvr" data-id="${ivr.id}">
      ${avatar(ivr.name, 22)} ${esc(ivr.name)}<span style="color:var(--text3);font-size:10px;margin-left:4px">${esc(ivr.role || '')}</span>
    </div>`).join('') || `<div class="dropdown-item" style="color:var(--text3)">No interviewers defined</div>`;
}
function renderIntDetailIvrDisplay() {
	const el = document.getElementById('int-d-ivr-display'); if (!el) return;
	if (!selectedIntDetailIvrs.length) { el.innerHTML = `<span class="multi-select-placeholder">Click to select...</span>`; return }
	el.innerHTML = selectedIntDetailIvrs.map(id => { const i = DB.interviewers.find(x => x.id === id); return i ? `<span class="multi-select-item">${esc(i.name)}<span class="rm" data-action="rmIntDetailIvr" data-id="${id}">×</span></span>` : '' }).join('');
}
function toggleIntDetailIvr(id) {
	if (selectedIntDetailIvrs.includes(id)) selectedIntDetailIvrs = selectedIntDetailIvrs.filter(x => x !== id);
	else selectedIntDetailIvrs.push(id);
	renderIntDetailIvrDisplay(); buildIntDetailIvrDropdown();
	document.getElementById('int-d-ivr-dropdown').classList.remove('open');
	checkIntDetailConflict();
}
function updateIntDetailEndLabel() {
	const timeVal = document.getElementById('int-d-time')?.value; const dateVal = document.getElementById('int-d-date')?.value;
	const dur = parseInt(document.getElementById('int-d-duration')?.value || '60');
	const lbl = document.getElementById('int-d-end-label'); if (!lbl) return;
	if (timeVal && dateVal) { const start = new Date(`${dateVal}T${timeVal}`); const end = new Date(start.getTime() + dur * 60000); lbl.textContent = `→ ${fmtTime(end.toISOString())}` } else lbl.textContent = '';
}
function checkIntDetailConflict() {
	const warnEl = document.getElementById('int-conflict-warn'); const msgEl = document.getElementById('int-conflict-msg'); if (!warnEl || !msgEl) return;
	const candId = document.getElementById('int-d-candidate')?.value; const dateVal = document.getElementById('int-d-date')?.value; const timeVal = document.getElementById('int-d-time')?.value;
	const dur = parseInt(document.getElementById('int-d-duration')?.value || '60'); const editId = document.getElementById('int-d-id')?.value;
	if (!candId || !dateVal || !timeVal) { warnEl.style.display = 'none'; return }
	const startMs = new Date(`${dateVal}T${timeVal}`).getTime(); const endMs = startMs + dur * 60000;
	const conflicts = DB.interviews.filter(int => {
		if (editId && int.id === editId) return false; if (int.candidateId !== candId) return false;
		const iStart = int.scheduledTime ? new Date(int.scheduledTime).getTime() : new Date(int.date + 'T09:00:00').getTime();
		const iEnd = iStart + (int.durationMin || 60) * 60000; return startMs < iEnd && endMs > iStart;
	});
	if (conflicts.length) { msgEl.textContent = `Conflict with existing interview at ${fmtDateTime(conflicts[0].scheduledTime || conflicts[0].date + 'T09:00:00')}. You can still save.`; warnEl.style.display = '' }
	else warnEl.style.display = 'none';
}
function saveInterviewDetail() {
	if (isReadOnly) return;
	const candId = document.getElementById('int-d-candidate').value; const dateVal = document.getElementById('int-d-date').value;
	const timeVal = document.getElementById('int-d-time').value; const dur = parseInt(document.getElementById('int-d-duration').value) || 60;
	const platform = document.getElementById('int-d-platform').value; const url = document.getElementById('int-d-url').value.trim();
	const notes = document.getElementById('int-d-notes').value.trim(); const editId = document.getElementById('int-d-id').value;
	const statusEmailSent = document.getElementById('int-d-status-email').checked;
	const statusCalled = document.getElementById('int-d-status-called').checked;
	const statusDone = document.getElementById('int-d-status-done').checked;
	if (!candId) { tool.notify('Select a candidate', 'warning'); return }
	if (!dateVal) { tool.notify('Select a date', 'warning'); return }
	const scheduledTime = timeVal ? new Date(`${dateVal}T${timeVal}`).toISOString() : '';
	const ivrIds = [...selectedIntDetailIvrs];
	if (editId) {
		const int = DB.interviews.find(x => x.id === editId);
		if (int) { int.candidateId = candId; int.date = dateVal; int.scheduledTime = scheduledTime; int.durationMin = dur; int.interviewerIds = ivrIds; int.meetingPlatform = platform; int.meetingUrl = url; int.notes = notes; int.statusEmailSent = statusEmailSent; int.statusCalled = statusCalled; int.statusDone = statusDone }
	} else {
		DB.interviews.push({ id: genId(), candidateId: candId, date: dateVal, scheduledTime, durationMin: dur, interviewerIds: ivrIds, meetingPlatform: platform, meetingUrl: url, notes, statusEmailSent, statusCalled, statusDone, createdAt: new Date().toISOString() });
	}
	persist(); closeInterviewDetail();
	if (currentPage === 'calendar') renderCalendar(); if (currentPage === 'scheduler') renderSchedulePage();
	updateNavBadges(); tool.notify(editId ? 'Interview updated' : 'Interview created', 'success');
}
function deleteInterviewFromDetail() {
	const editId = document.getElementById('int-d-id').value; if (!editId) return;
	const int = DB.interviews.find(x => x.id === editId); const cand = int ? DB.candidates.find(c => c.id === int.candidateId) : null;
	openConfirm('Delete Interview', `Delete interview${cand ? ' for ' + cand.name : ''}?`, () => {
		DB.interviews = DB.interviews.filter(x => x.id !== editId);
		persist(); closeInterviewDetail(); if (currentPage === 'calendar') renderCalendar(); if (currentPage === 'scheduler') renderSchedulePage(); updateNavBadges(); tool.notify('Deleted', 'info');
	}, 'Delete');
}
function goScoreFromDetail() {
	const editId = document.getElementById('int-d-id').value; if (!editId) { tool.notify('Save first', 'warning'); return }
	closeInterviewDetail(); navigate('scoring'); const el = document.getElementById('score-interview'); if (el) el.value = editId; loadScoringForm();
}
// Legacy aliases
function openInterviewLinkModal(id) { openInterviewDetail(id) }
function closeInterviewLinkModal() { closeInterviewDetail() }
function saveInterviewLink() { saveInterviewDetail() }

/* ── email generators ── */
function companyName() { return getSettings().companyName || tool.param('companyName', 'Our Company') }
function getMeetingBlock(int) { const url = int?.meetingUrl || getDefaultMeetingUrl(); const platform = int?.meetingPlatform || getDefaultMeetingPlatform(); if (!url) return ''; return `\n  🔗  ${platform || 'Meeting'} Link: ${url}` }
function generateOfferLetter(cand, pos) { const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); return `Dear ${cand.name},\n\nOn behalf of ${companyName()}, it is my great pleasure to formally offer you the position of ${pos.title}${pos.dept ? ' in our ' + pos.dept + ' department' : ''}.\n\nAfter a thorough review of your qualifications and our interview process, we are confident that your skills will be a tremendous asset to our team.\n\nPlease review the offer details and do not hesitate to reach out if you have any questions.\n\nWarm regards,\nHR Department\n${companyName()}\n${today}` }
function generateRejectionEmail(cand, posName) { const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); return `Dear ${cand.name},\n\nThank you sincerely for your interest in the ${posName} position at ${companyName()}.\n\nAfter careful consideration, we regret to inform you that we will not be moving forward with your application at this time.\n\nWe encourage you to apply for future openings.\n\nKind regards,\nHR Department\n${companyName()}\n${today}` }
function generateInviteEmail(cand, interviewers, dateTime, dur, pos, int) {
	const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); const posName = pos ? pos.title : 'the position'; const meetingBlock = getMeetingBlock(int);
	const ivrArr = Array.isArray(interviewers) ? interviewers : [interviewers]; const ivrLine = ivrArr.map(i => `${i.name}${i.role ? ' (' + i.role + ')' : ''}`).join(', ');
	return `Dear ${cand.name},\n\nWe are pleased to invite you to interview for the ${posName} position at ${companyName()}.\n\nInterview details:\n\n  📅  Date & Time: ${dateTime}\n  ⏱   Duration: ${dur} minutes\n  👤  Interviewer${ivrArr.length > 1 ? 's' : ''}: ${ivrLine}${meetingBlock}\n\nPlease confirm your attendance by replying to this email.\n\nBest regards,\nHR Department\n${companyName()}\n${today}`;
}

/* ── settings ── */
function renderSettings() {
	const s = getSettings();
	const cn = document.getElementById('settings-company'); if (cn) cn.value = s.companyName || '';
	const mp = document.getElementById('settings-meeting-platform'); if (mp) mp.value = s.meetingPlatform || '';
	const mu = document.getElementById('settings-meeting-url'); if (mu) mu.value = s.meetingUrl || '';
	const dd = document.getElementById('settings-default-duration'); if (dd) dd.value = String(s.defaultDuration || '30');
	const db = document.getElementById('settings-default-break'); if (db) db.value = String(s.defaultBreak || '15');
}
function saveSettings() {
	DB.settings = DB.settings || {};
	DB.settings.companyName = document.getElementById('settings-company')?.value.trim() || '';
	DB.settings.meetingPlatform = document.getElementById('settings-meeting-platform')?.value || '';
	DB.settings.meetingUrl = document.getElementById('settings-meeting-url')?.value.trim() || '';
	DB.settings.defaultDuration = parseInt(document.getElementById('settings-default-duration')?.value) || 30;
	DB.settings.defaultBreak = parseInt(document.getElementById('settings-default-break')?.value) || 15;
	persist(); tool.notify('Settings saved', 'success');
}

/* ── pos criteria ── */
function renderPosCriteriaList() { const el = document.getElementById('pos-criteria-list'); if (!el) return; if (!posCriteriaBuffer.length) { el.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:4px 0">No additional criteria yet.</div>`; return } el.innerHTML = posCriteriaBuffer.map((c, i) => `<div class="pos-criterion-item"><input type="text" placeholder="Skill name" value="${esc(c.name)}" data-ci="${i}" data-field="name"><input type="text" placeholder="Description" value="${esc(c.desc || '')}" data-ci="${i}" data-field="desc"><button class="btn btn-danger btn-sm" data-action="rmCriterion" data-ci="${i}">✕</button></div>`).join('') }
function addPosCriterion() { posCriteriaBuffer.push({ name: '', desc: '' }); renderPosCriteriaList(); tool.resize() }
function removePosCriterion(i) { posCriteriaBuffer.splice(i, 1); renderPosCriteriaList(); tool.resize() }
function syncPosCriteria() { document.querySelectorAll('.pos-criterion-item').forEach(item => { item.querySelectorAll('input').forEach(inp => { const ci = parseInt(inp.dataset.ci), field = inp.dataset.field; if (!isNaN(ci) && field && posCriteriaBuffer[ci]) posCriteriaBuffer[ci][field] = inp.value.trim() }) }) }

/* ══ POSITIONS ══ */
function openPositionDrawer(editId) {
	posCriteriaBuffer = [];
	if (editId) { const p = DB.positions.find(x => x.id === editId); if (!p) return; document.getElementById('pos-title').value = p.title; document.getElementById('pos-dept').value = p.dept || ''; document.getElementById('pos-desc').value = p.desc || ''; document.getElementById('pos-status').value = p.status; document.getElementById('pos-closed-int').checked = p.closedForInterviews || false; document.getElementById('pos-edit-id').value = editId; document.getElementById('pos-drawer-title').textContent = 'Edit Position'; posCriteriaBuffer = JSON.parse(JSON.stringify(p.extraCriteria || [])) }
	else { ['pos-title', 'pos-dept', 'pos-desc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '' }); document.getElementById('pos-status').value = 'open'; document.getElementById('pos-closed-int').checked = false; document.getElementById('pos-edit-id').value = ''; document.getElementById('pos-drawer-title').textContent = 'Add Position' }
	renderPosCriteriaList(); openDrawer('pos'); tool.resize();
}
function closePositionDrawer() { closeDrawer('pos') }
function savePosition() {
	if (isReadOnly) return; syncPosCriteria();
	const title = document.getElementById('pos-title').value.trim(); const dept = document.getElementById('pos-dept').value.trim(); const desc = document.getElementById('pos-desc').value.trim(); const status = document.getElementById('pos-status').value; const closedForInterviews = document.getElementById('pos-closed-int').checked; const editId = document.getElementById('pos-edit-id').value;
	if (!title) { tool.notify('Position title required', 'warning'); return }
	const extraCriteria = posCriteriaBuffer.filter(c => c.name.trim());
	if (editId) { const p = DB.positions.find(x => x.id === editId); if (p) { p.title = title; p.dept = dept; p.desc = desc; p.status = status; p.closedForInterviews = closedForInterviews; p.extraCriteria = extraCriteria } }
	else DB.positions.push({ id: genId(), title, dept, desc, status, extraCriteria, closedForInterviews, createdAt: new Date().toISOString() });
	persist(); closePositionDrawer(); renderPositions(); tool.notify(editId ? 'Position updated' : 'Position added', 'success');
}
function renderPositions() {
	const search = (document.getElementById('pos-search')?.value || '').toLowerCase(); const filterStatus = document.getElementById('pos-filter-status')?.value || '';
	let list = DB.positions; if (search) list = list.filter(p => p.title.toLowerCase().includes(search) || (p.dept || '').toLowerCase().includes(search)); if (filterStatus) list = list.filter(p => p.status === filterStatus);
	const tbody = document.getElementById('positions-table-body'); if (!tbody) return; if (!list.length) { tbody.innerHTML = `<tr><td class="table-empty" colspan="8">No positions match</td></tr>`; return }
	tbody.innerHTML = list.map(pos => {
		const apps = DB.candidates.filter(c => (c.positionIds || []).includes(pos.id)).length; const sb = { open: 'badge-green', closed: 'badge-gray', 'on-hold': 'badge-amber' }[pos.status] || 'badge-gray'; const extra = (pos.extraCriteria || []).filter(c => c.name).length; const pl = (DB.placements || []).find(p => p.positionId === pos.id && p.selectedCandidateId); const sel = pl ? DB.candidates.find(c => c.id === pl.selectedCandidateId) : null; const intCount = DB.interviews.filter(i => (DB.candidates.find(c => c.id === i.candidateId)?.positionIds || []).includes(pos.id)).length;
		return `<tr><td><div style="font-weight:500">${esc(pos.title)}</div><div style="font-size:11px;color:var(--text3)">${esc(pos.desc || '').slice(0, 60)}${pos.desc && pos.desc.length > 60 ? '…' : ''}</div>${pos.closedForInterviews ? `<span class="badge badge-red" style="margin-top:4px">Closed</span>` : ''}</td><td>${esc(pos.dept || '—')}</td><td><span class="badge ${sb}">${pos.status}</span></td><td><span class="badge badge-blue">${apps}</span></td><td>${extra ? `<span class="badge badge-purple">+${extra}</span>` : '—'}</td><td>${sel ? `<div style="display:flex;align-items:center;gap:7px">${avatar(sel.name, 26)}<span style="font-size:12px;font-weight:500">${esc(sel.name)}</span></div>` : '—'}</td><td><span class="badge badge-teal">${intCount}</span></td><td><div style="display:flex;gap:5px"><button class="btn btn-ghost btn-sm" data-action="editPos" data-id="${pos.id}">Edit</button><button class="btn btn-danger btn-sm" data-action="delPos" data-id="${pos.id}">Del</button></div></td></tr>`;
	}).join('');
}
function deletePosition(id) { const p = DB.positions.find(x => x.id === id); if (!p) return; openConfirm('Delete Position', `Delete "${p.title}"?`, () => { DB.positions = DB.positions.filter(x => x.id !== id); DB.candidates.forEach(c => { c.positionIds = (c.positionIds || []).filter(pid => pid !== id) }); persist(); renderPositions(); tool.notify('Deleted', 'info') }, 'Delete') }

/* ══ INTERVIEWERS ══ */
function buildSlotItemHTML(slot, i) {
	const s = migrateSlot(slot);
	const mkH = (val, def) => HOURS12.map(h => `<option value="${h}" ${(s[val] || def) === h ? 'selected' : ''}>${h}</option>`).join('');
	const mkM = (val, def) => MINS.map(m => `<option value="${m}" ${(s[val] || def) === m ? 'selected' : ''}>${m}</option>`).join('');
	const mkA = (val, def) => ['AM', 'PM'].map(ap => `<option value="${ap}" ${(s[val] || def) === ap ? 'selected' : ''}>${ap}</option>`).join('');
	return `<div class="slot-item" data-si="${i}"><select class="slot-day-sel" data-si="${i}" data-field="day">${DAYS.map(d => `<option value="${d}" ${s.day === d ? 'selected' : ''}>${d}</option>`).join('')}</select><div class="slot-time-group"><span>From</span><select class="slot-hour-sel" data-si="${i}" data-field="hour12">${mkH('hour12', '9')}</select><span>:</span><select class="slot-min-sel" data-si="${i}" data-field="minute">${mkM('minute', '00')}</select><select class="slot-ampm-sel" data-si="${i}" data-field="ampm">${mkA('ampm', 'AM')}</select></div><div class="slot-separator">→</div><div class="slot-time-group"><span>To</span><select class="slot-hour-sel" data-si="${i}" data-field="toHour12">${mkH('toHour12', '5')}</select><span>:</span><select class="slot-min-sel" data-si="${i}" data-field="toMinute">${mkM('toMinute', '00')}</select><select class="slot-ampm-sel" data-si="${i}" data-field="toAmpm">${mkA('toAmpm', 'PM')}</select></div><button class="btn btn-danger btn-sm" data-action="rmSlot" data-si="${i}">✕</button></div>`;
}
function renderIvrSlots() { const el = document.getElementById('ivr-slots-list'); if (!el) return; if (!ivrSlotsBuffer.length) { el.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:4px 0">No slots yet.</div>`; return } el.innerHTML = ivrSlotsBuffer.map((s, i) => buildSlotItemHTML(s, i)).join('') }
function addIvrSlot() { ivrSlotsBuffer.push({ day: 'Mon', hour12: '9', minute: '00', ampm: 'AM', toHour12: '5', toMinute: '00', toAmpm: 'PM' }); renderIvrSlots(); tool.resize() }
function removeIvrSlot(i) { ivrSlotsBuffer.splice(i, 1); renderIvrSlots(); tool.resize() }
function syncIvrSlotsFromDOM() { document.querySelectorAll('.slot-item[data-si]').forEach(item => { const si = parseInt(item.dataset.si); if (isNaN(si) || !ivrSlotsBuffer[si]) return; item.querySelectorAll('[data-si][data-field]').forEach(el => { ivrSlotsBuffer[si][el.dataset.field] = el.value }) }) }
function openInterviewerDrawer(editId) {
	ivrSlotsBuffer = [];
	if (editId) { const ivr = DB.interviewers.find(x => x.id === editId); if (!ivr) return; document.getElementById('ivr-name').value = ivr.name; document.getElementById('ivr-email').value = ivr.email || ''; document.getElementById('ivr-role').value = ivr.role || ''; document.getElementById('ivr-dept').value = ivr.dept || ''; document.getElementById('ivr-duration').value = ivr.duration || 60; document.getElementById('ivr-edit-id').value = editId; document.getElementById('ivr-drawer-title').textContent = 'Edit Interviewer'; ivrSlotsBuffer = (ivr.slots || []).map(migrateSlot) }
	else { ['ivr-name', 'ivr-email', 'ivr-role', 'ivr-dept'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '' }); document.getElementById('ivr-duration').value = '60'; document.getElementById('ivr-edit-id').value = ''; document.getElementById('ivr-drawer-title').textContent = 'Add Interviewer' }
	renderIvrSlots(); openDrawer('ivr'); tool.resize();
}
function closeInterviewerDrawer() { closeDrawer('ivr') }
function saveInterviewer() {
	if (isReadOnly) return; syncIvrSlotsFromDOM();
	const name = document.getElementById('ivr-name').value.trim(); const email = document.getElementById('ivr-email').value.trim(); const role = document.getElementById('ivr-role').value.trim(); const dept = document.getElementById('ivr-dept').value.trim(); const duration = parseInt(document.getElementById('ivr-duration').value) || 60; const editId = document.getElementById('ivr-edit-id').value;
	if (!name) { tool.notify('Name required', 'warning'); return }
	const slots = ivrSlotsBuffer.filter(s => s.day);
	if (editId) { const i = DB.interviewers.find(x => x.id === editId); if (i) { i.name = name; i.email = email; i.role = role; i.dept = dept; i.duration = duration; i.slots = slots } }
	else DB.interviewers.push({ id: genId(), name, email, role, dept, duration, slots });
	persist(); closeInterviewerDrawer(); renderInterviewers(); tool.notify(editId ? 'Updated' : 'Added', 'success');
}
function renderInterviewers() {
	const search = (document.getElementById('ivr-search')?.value || '').toLowerCase(); let list = DB.interviewers; if (search) list = list.filter(i => i.name.toLowerCase().includes(search) || (i.role || '').toLowerCase().includes(search));
	const tbody = document.getElementById('interviewers-table-body'); if (!tbody) return; if (!list.length) { tbody.innerHTML = `<tr><td class="table-empty" colspan="9">No interviewers yet</td></tr>`; return }
	tbody.innerHTML = list.map(ivr => {
		const sessions = DB.scores.filter(s => s.interviewerId === ivr.id).length; const slots = (ivr.slots || []).map(migrateSlot); const uniqueDays = [...new Set(slots.map(s => s.day))].join(', ') || '—'; const hoursSummary = slots.length ? slots.map(s => `${s.day}: ${slotLabel(s)} – ${slotLabel({ hour12: s.toHour12, minute: s.toMinute, ampm: s.toAmpm })}`).join('; ') : 'No slots defined';
		return `<tr><td><div style="display:flex;align-items:center;gap:10px">${avatar(ivr.name, 34)}<div><div style="font-weight:500">${esc(ivr.name)}</div></div></div></td><td>${esc(ivr.role || '—')}</td><td>${esc(ivr.dept || '—')}</td><td style="font-size:12px">${esc(ivr.email || '—')}</td><td><span class="badge badge-teal">${slots.length} slot${slots.length !== 1 ? 's' : ''}</span> <span style="font-size:11px;color:var(--text3)">${uniqueDays}</span></td><td title="${esc(hoursSummary)}" style="font-size:11px;color:var(--text3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(hoursSummary)}</td><td><span class="badge badge-gray">${ivr.duration || 60} min</span></td><td><span class="badge badge-purple">${sessions}</span></td><td><div style="display:flex;gap:5px"><button class="btn btn-ghost btn-sm" data-action="editIvr" data-id="${ivr.id}">Edit</button><button class="btn btn-danger btn-sm" data-action="delIvr" data-id="${ivr.id}">Del</button></div></td></tr>`;
	}).join('');
}
function deleteInterviewer(id) { const i = DB.interviewers.find(x => x.id === id); if (!i) return; openConfirm('Delete', `Remove ${i.name}?`, () => { DB.interviewers = DB.interviewers.filter(x => x.id !== id); DB.interviews.forEach(int => { int.interviewerIds = (int.interviewerIds || []).filter(iid => iid !== id) }); persist(); renderInterviewers(); tool.notify('Removed', 'info') }, 'Delete') }

/* ══ CANDIDATES ══ */
function openCandidateDrawer(editId) {
	selectedCandPositions = []; hideDupWarning();
	if (editId) { const c = DB.candidates.find(x => x.id === editId); if (!c) return; document.getElementById('cand-name').value = c.name; document.getElementById('cand-email').value = c.email || ''; document.getElementById('cand-phone').value = c.phone || ''; document.getElementById('cand-source').value = c.source || ''; document.getElementById('cand-resume').value = c.resume || ''; document.getElementById('cand-notes').value = c.notes || ''; document.getElementById('cand-edit-id').value = editId; document.getElementById('cand-drawer-title').textContent = 'Edit Candidate'; selectedCandPositions = [...(c.positionIds || [])] }
	else { ['cand-name', 'cand-email', 'cand-phone', 'cand-resume', 'cand-notes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '' }); const src = document.getElementById('cand-source'); if (src) src.value = ''; document.getElementById('cand-edit-id').value = ''; document.getElementById('cand-drawer-title').textContent = 'Add Candidate' }
	buildCandPosDropdownItems(); renderCandPosDisplay(); openDrawer('cand'); tool.resize();
}
function closeCandidateDrawer() { closeDrawer('cand'); hideDupWarning() }
function buildCandPosDropdownItems() { const dd = document.getElementById('cand-positions-dropdown'); if (!dd) return; dd.innerHTML = DB.positions.map(pos => `<div class="dropdown-item ${selectedCandPositions.includes(pos.id) ? 'selected' : ''}" data-action="toggleCandPos" data-id="${pos.id}"><div class="color-dot" style="background:${pos.status === 'open' ? 'var(--green)' : pos.status === 'on-hold' ? 'var(--amber)' : 'var(--text3)'}"></div>${esc(pos.title)}<span style="color:var(--text3);font-size:10px;margin-left:4px">${esc(pos.dept || '')}</span></div>`).join('') || `<div class="dropdown-item" style="color:var(--text3)">No positions</div>` }
function toggleCandPos(id) { if (selectedCandPositions.includes(id)) selectedCandPositions = selectedCandPositions.filter(x => x !== id); else selectedCandPositions.push(id); renderCandPosDisplay(); buildCandPosDropdownItems(); document.getElementById('cand-positions-dropdown').classList.remove('open') }
function renderCandPosDisplay() { const el = document.getElementById('cand-positions-display'); if (!el) return; if (!selectedCandPositions.length) { el.innerHTML = `<span class="multi-select-placeholder">Click to select...</span>`; return } el.innerHTML = selectedCandPositions.map(id => { const p = DB.positions.find(x => x.id === id); return p ? `<span class="multi-select-item">${esc(p.title)}<span class="rm" data-action="rmCandPos" data-id="${id}">×</span></span>` : '' }).join('') }
function checkDupOnInput() { clearTimeout(dupCheckTimer); dupCheckTimer = setTimeout(() => { const name = document.getElementById('cand-name')?.value.trim(); const email = document.getElementById('cand-email')?.value.trim(); const editId = document.getElementById('cand-edit-id')?.value; if (!name && !email) return hideDupWarning(); const matches = findDuplicates(name, email, editId); if (matches.length) { document.getElementById('cand-name')?.classList.add('input-warn'); const names = matches.map(c => `<strong>${esc(c.name)}</strong>${c.email ? ' (' + esc(c.email) + ')' : ''}`).join(', '); const banner = document.getElementById('dup-warning-banner'); const msg = document.getElementById('dup-warning-msg'); if (banner && msg) { msg.innerHTML = `Already exists: ${names}. You can still save.`; banner.style.display = 'flex'; tool.resize() } } else hideDupWarning() }, 400) }
function hideDupWarning() { const b = document.getElementById('dup-warning-banner'); if (b) b.style.display = 'none'; document.getElementById('cand-name')?.classList.remove('input-warn') }
function doSaveCandidate(forceOverride) {
	if (isReadOnly) return;
	const name = document.getElementById('cand-name').value.trim(); const email = document.getElementById('cand-email').value.trim(); const phone = document.getElementById('cand-phone').value.trim(); const source = document.getElementById('cand-source').value; const resume = document.getElementById('cand-resume').value.trim(); const notes = document.getElementById('cand-notes').value.trim(); const editId = document.getElementById('cand-edit-id').value;
	if (!name) { tool.notify('Name required', 'warning'); return }
	if (!forceOverride && !editId) { const matches = findDuplicates(name, email, ''); if (matches.length) { openDupConfirm(`A candidate with matching name or email exists. Add "${name}" anyway?`, matches, () => doSaveCandidate(true)); return } }
	if (editId) { const c = DB.candidates.find(x => x.id === editId); if (c) { c.name = name; c.email = email; c.phone = phone; c.source = source; c.resume = resume; c.notes = notes; c.positionIds = [...selectedCandPositions] } }
	else DB.candidates.push({ id: genId(), name, email, phone, source, resume, notes, positionIds: [...selectedCandPositions], createdAt: new Date().toISOString() });
	hideDupWarning(); persist(); closeCandidateDrawer(); renderCandidates(); tool.notify(editId ? 'Updated' : 'Candidate added', 'success');
}
function saveCandidate() { doSaveCandidate(false) }
function deleteCandidate(id) { const c = DB.candidates.find(x => x.id === id); if (!c) return; openConfirm('Delete', `Delete "${c.name}"?`, () => { DB.candidates = DB.candidates.filter(x => x.id !== id); DB.interviews = DB.interviews.filter(i => i.candidateId !== id); DB.scores = DB.scores.filter(s => s.candidateId !== id); DB.screenings = DB.screenings.filter(s => s.candidateId !== id); persist(); renderCandidates(); tool.notify('Deleted', 'info') }, 'Delete') }
function renderCandidates() {
	const search = (document.getElementById('cand-search')?.value || '').toLowerCase(); const filterStatus = document.getElementById('cand-filter-status')?.value || '';
	const pf = document.getElementById('cand-filter-pos'); if (pf) { const cur = pf.value; pf.innerHTML = '<option value="">All positions</option>' + DB.positions.map(p => `<option value="${p.id}" ${p.id === cur ? 'selected' : ''}>${esc(p.title)}</option>`).join(''); if (cur) pf.value = cur }
	const filterPos = pf?.value || ''; let list = DB.candidates;
	if (search) list = list.filter(c => c.name.toLowerCase().includes(search) || (c.email || '').toLowerCase().includes(search));
	if (filterPos) list = list.filter(c => (c.positionIds || []).includes(filterPos));
	if (filterStatus) { list = list.filter(c => { const stage = getStage(c.id); if (filterStatus === 'eliminated') return c.eliminated; if (filterStatus === 'advanced') return stage === 'advanced'; if (filterStatus === 'selected') return stage === 'selected'; if (filterStatus === 'screening_pending') return stage === 'pending'; if (filterStatus === 'active') return !c.eliminated && stage !== 'selected'; return true }) }
	const tbody = document.getElementById('candidates-table-body'); if (!tbody) return;
	if (!list.length) { tbody.innerHTML = `<tr><td class="table-empty" colspan="8">No candidates match</td></tr>`; updateBulkBar(); return }
	tbody.innerHTML = list.map(c => {
		const positions = (c.positionIds || []).map(pid => { const p = DB.positions.find(x => x.id === pid); return p ? `<span class="badge badge-blue" style="font-size:9px">${esc(p.title)}</span>` : '' }).join('');
		const stage = getStage(c.id); const stageMap = { selected: 'badge-green', advanced: 'badge-teal', pending: 'badge-gray', eliminated: 'badge-red', new: 'badge-gray' }; const stageLbl = { selected: 'Selected', advanced: 'Advanced', pending: 'Pending', eliminated: 'Eliminated', new: 'New' };
		return `<tr><td><input type="checkbox" class="cand-check" data-id="${c.id}" ${checkedCandIds.has(c.id) ? 'checked' : ''}></td><td><div style="display:flex;align-items:center;gap:9px">${avatar(c.name, 34)}<div><div style="font-weight:500">${esc(c.name)}</div>${c.eliminationReason ? `<div style="font-size:10px;color:var(--red)">⛔ ${esc(c.eliminationReason.slice(0, 40))}</div>` : ''}</div></div></td><td><div style="font-size:12px">${esc(c.email || '—')}</div><div style="font-size:11px;color:var(--text3)">${esc(c.phone || '')}</div></td><td>${c.source ? `<span class="badge badge-gray">${esc(c.source)}</span>` : '—'}</td><td><div style="display:flex;gap:3px;flex-wrap:wrap">${positions || '<span style="color:var(--text3)">None</span>'}</div></td><td>${c.resume ? `<span class="resume-link" data-action="previewResume" data-url="${esc(c.resume)}">📄 View</span>` : '—'}</td><td><span class="badge ${stageMap[stage] || 'badge-gray'}">${stageLbl[stage] || stage}</span></td><td><div style="display:flex;gap:5px"><button class="btn btn-ghost btn-sm" data-action="editCand" data-id="${c.id}">Edit</button><button class="btn btn-danger btn-sm" data-action="delCand" data-id="${c.id}">Del</button></div></td></tr>`;
	}).join('');
	updateBulkBar();
}
function updateBulkBar() { const bar = document.getElementById('bulk-actions-bar'); const count = document.getElementById('bulk-count'); if (checkedCandIds.size > 0) { bar.style.display = 'flex'; if (count) count.textContent = `${checkedCandIds.size} selected` } else bar.style.display = 'none' }

/* ══ SCREENING ══ */
function renderScreening() {
	const filterPos = document.getElementById('screen-filter-pos')?.value || ''; const filterStatus = document.getElementById('screen-filter-status')?.value || ''; const search = (document.getElementById('screen-search')?.value || '').toLowerCase();
	const psel = document.getElementById('screen-filter-pos'); if (psel) { const cur = psel.value; psel.innerHTML = '<option value="">All positions</option>' + DB.positions.map(p => `<option value="${p.id}" ${p.id === cur ? 'selected' : ''}>${esc(p.title)}</option>`).join(''); psel.value = cur || '' }
	let cands = DB.candidates.filter(c => (c.positionIds || []).length > 0 || c.eliminated);
	if (filterPos) cands = cands.filter(c => (c.positionIds || []).includes(filterPos)); if (search) cands = cands.filter(c => c.name.toLowerCase().includes(search) || (c.email || '').toLowerCase().includes(search));
	if (filterStatus === 'pending') cands = cands.filter(c => !c.eliminated && !DB.screenings.some(s => s.candidateId === c.id && s.status === 'advanced')); else if (filterStatus === 'advanced') cands = cands.filter(c => !c.eliminated && DB.screenings.some(s => s.candidateId === c.id && s.status === 'advanced')); else if (filterStatus === 'eliminated') cands = cands.filter(c => c.eliminated);
	const el = document.getElementById('screening-list'); if (!el) return; if (!cands.length) { el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⊘</div><p>No candidates match</p></div>`; return }
	el.innerHTML = cands.map(c => {
		const elim = c.eliminated; const adv = DB.screenings.some(s => s.candidateId === c.id && s.status === 'advanced'); const positions = (c.positionIds || []).map(pid => { const p = DB.positions.find(x => x.id === pid); return p ? `<span class="badge badge-blue">${esc(p.title)}</span>` : '' }).join(''); const statusBadge = elim ? `<span class="badge badge-red">Eliminated</span>` : adv ? `<span class="badge badge-teal">Advanced ✓</span>` : `<span class="badge badge-gray">Pending</span>`;
		return `<div class="screen-card ${elim ? 'eliminated' : adv ? 'advanced' : ''}"><input type="checkbox" class="screen-check" data-id="${c.id}" ${checkedScreenIds.has(c.id) ? 'checked' : ''} style="margin-top:4px">${avatar(c.name, 40)}<div class="screen-info"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-weight:600;font-size:14px">${esc(c.name)}</span>${statusBadge}${c.source ? `<span class="badge badge-gray">${esc(c.source)}</span>` : ''}</div><div style="font-size:11px;color:var(--text3);margin-top:2px">${[c.email, c.phone].filter(Boolean).join(' · ')}</div><div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">${positions}</div>${elim && c.eliminationReason ? `<div style="font-size:11px;color:var(--red);background:var(--red-bg);border-radius:4px;padding:3px 8px;margin-top:5px;display:inline-block">⛔ ${esc(c.eliminationReason)}</div>` : ''}</div><div class="screen-actions">${!elim && !adv ? `<button class="btn btn-success btn-sm" data-action="advanceCandidate" data-id="${c.id}">✓ Advance</button>` : ''}${adv && !elim ? `<button class="btn btn-ghost btn-sm" data-action="unadvanceCandidate" data-id="${c.id}">↩ Undo</button>` : ''}${!elim ? `<button class="btn btn-danger btn-sm" data-action="eliminateCandidate" data-id="${c.id}">⛔ Eliminate</button>` : ''}${elim ? `<button class="btn btn-ghost btn-sm" data-action="reinstateCandidate" data-id="${c.id}">↩ Reinstate</button>` : ''}${c.email && elim ? `<button class="btn btn-ghost btn-sm" data-action="sendRejScreening" data-id="${c.id}">✉ Rejection</button>` : ''}</div></div>`;
	}).join('');
}
function advanceCandidate(id) { if (!DB.screenings) DB.screenings = []; const ex = DB.screenings.find(s => s.candidateId === id); if (ex) ex.status = 'advanced'; else DB.screenings.push({ candidateId: id, status: 'advanced', date: new Date().toISOString() }); persist(); renderScreening(); tool.notify('Advanced', 'success') }
function unadvanceCandidate(id) { DB.screenings = DB.screenings.filter(s => s.candidateId !== id); persist(); renderScreening(); tool.notify('Returned to pending', 'info') }
function eliminateCandidate(id) { const c = DB.candidates.find(x => x.id === id); if (!c) return; openElimModal(`Eliminating ${c.name}:`, (reason) => { c.eliminated = true; c.eliminationReason = reason; c.eliminationStage = 'screening'; c.eliminationDate = new Date().toISOString(); DB.screenings = DB.screenings.filter(s => s.candidateId !== id); checkedScreenIds.delete(id); persist(); renderScreening(); tool.notify('Eliminated', 'warning') }) }
function reinstateCandidate(id) { const c = DB.candidates.find(x => x.id === id); if (!c) return; openConfirm('Reinstate', `Reinstate ${c.name}?`, () => { c.eliminated = false; delete c.eliminationReason; delete c.eliminationStage; delete c.eliminationDate; persist(); renderScreening(); tool.notify('Reinstated', 'success') }, 'Reinstate') }
function bulkScreenAdvance() { const ids = [...checkedScreenIds]; const toAdv = ids.filter(id => { const c = DB.candidates.find(x => x.id === id); return c && !c.eliminated && !DB.screenings.some(s => s.candidateId === id && s.status === 'advanced') }); if (!toAdv.length) { tool.notify('No pending candidates selected', 'warning'); return } toAdv.forEach(id => { DB.screenings.push({ candidateId: id, status: 'advanced', date: new Date().toISOString() }) }); checkedScreenIds.clear(); persist(); renderScreening(); tool.notify(`${toAdv.length} advanced`, 'success') }
function bulkScreenEliminate() { const ids = [...checkedScreenIds].filter(id => { const c = DB.candidates.find(x => x.id === id); return c && !c.eliminated }); if (!ids.length) { tool.notify('No active candidates selected', 'warning'); return } openElimModal(`Eliminating ${ids.length} candidates:`, (reason) => { ids.forEach(id => { const c = DB.candidates.find(x => x.id === id); if (c) { c.eliminated = true; c.eliminationReason = reason; c.eliminationStage = 'screening'; c.eliminationDate = new Date().toISOString(); DB.screenings = DB.screenings.filter(s => s.candidateId !== id) } }); checkedScreenIds.clear(); persist(); renderScreening(); tool.notify(`${ids.length} eliminated`, 'warning') }) }
function sendRejScreening(id) { const c = DB.candidates.find(x => x.id === id); if (!c) return; const posNames = (c.positionIds || []).map(pid => { const p = DB.positions.find(x => x.id === pid); return p ? p.title : '' }).filter(Boolean).join(', ') || 'the position'; openEmailModal('Rejection Email', c.email || '', `Your Application — ${posNames}`, generateRejectionEmail(c, posNames)) }

/* ══════════════════════════════════════════
   CALENDAR
══════════════════════════════════════════ */
function getFilteredInterviews() { let list = DB.interviews; if (calIvrFilter) list = list.filter(i => (i.interviewerIds || [i.interviewerId]).filter(Boolean).includes(calIvrFilter)); return list }
function enrichInterview(int) {
	const cand = DB.candidates.find(c => c.id === int.candidateId); const ivrIds = (int.interviewerIds || [int.interviewerId]).filter(Boolean); const ivrs = ivrIds.map(id => DB.interviewers.find(x => x.id === id)).filter(Boolean); const pos = DB.positions.find(p => (cand?.positionIds || []).includes(p.id));
	const startTs = int.scheduledTime ? new Date(int.scheduledTime) : new Date(int.date + 'T09:00:00'); const dur = int.durationMin || 60; const endTs = new Date(startTs.getTime() + dur * 60000);
	const hasConflict = DB.interviews.some(other => { if (other.id === int.id) return false; if (other.candidateId !== int.candidateId) return false; const oStart = other.scheduledTime ? new Date(other.scheduledTime).getTime() : new Date(other.date + 'T09:00:00').getTime(); const oEnd = oStart + (other.durationMin || 60) * 60000; return startTs.getTime() < oEnd && endTs.getTime() > oStart });
	return { int, cand, ivrs, pos, startTs, endTs, dur, isPanel: ivrs.length > 1, hasConflict };
}
function isSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }
function getWeekMonday(d) { const dt = new Date(d); const day = dt.getDay(); const diff = day === 0 ? -6 : 1 - day; dt.setDate(dt.getDate() + diff); dt.setHours(0, 0, 0, 0); return dt }
function renderCalendar() {
	const ivrSel = document.getElementById('cal-ivr-filter'); if (ivrSel) { const cur = calIvrFilter; ivrSel.innerHTML = '<option value="">All Interviewers</option>' + DB.interviewers.map(i => `<option value="${i.id}" ${i.id === cur ? 'selected' : ''}>${esc(i.name)}</option>`).join(''); ivrSel.value = calIvrFilter }
	updateCalPeriodLabel(); if (calTab === 'list') renderCalList(); else if (calTab === 'week') renderCalWeek(); else renderCalMonth();
}
function updateCalPeriodLabel() {
	const el = document.getElementById('cal-period-label'); if (!el) return;
	if (calTab === 'list') { el.textContent = 'All interviews'; return }
	if (calTab === 'week') { const mon = getWeekMonday(calCursor); const sun = new Date(mon); sun.setDate(sun.getDate() + 6); el.textContent = `${mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sun.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`; return }
	el.textContent = calCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function statusBadgesHTML(int) {
	const badges = [];
	if (int.statusEmailSent) badges.push(`<span class="badge badge-blue" title="Invitation email sent">✉ Sent</span>`);
	if (int.statusCalled) badges.push(`<span class="badge badge-purple" title="Called for interview">📞 Called</span>`);
	if (int.statusDone) badges.push(`<span class="badge badge-green" title="Interview done">✓ Done</span>`);
	return badges.join('');
}
function renderCalList() {
	const el = document.getElementById('cal-view-list'); if (!el) return;
	const list = getFilteredInterviews().map(enrichInterview).sort((a, b) => a.startTs - b.startTs);
	if (!list.length) { el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">▦</div><p style="margin-bottom:6px;font-weight:500">No interviews scheduled${calIvrFilter ? ' for this interviewer' : ''}</p><p style="font-size:12px;color:var(--text3)">Use the Scheduler or click <strong>+ New Interview</strong> above.</p></div>`; tool.resize(); return }
	const groups = {}; list.forEach(e => { const key = e.startTs.toDateString(); if (!groups[key]) groups[key] = []; groups[key].push(e) });
	const todayStr = new Date().toDateString();
	el.innerHTML = Object.entries(groups).map(([dateStr, items]) => {
		const isToday = dateStr === todayStr; const label = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
		return `<div class="cal-list-day"><div class="cal-list-day-header ${isToday ? 'today' : ''}">${isToday ? '📍 Today — ' : ''}${label}<span class="badge badge-blue">${items.length}</span></div>${items.map(e => calListItemHTML(e)).join('')}</div>`;
	}).join('');
	tool.resize();
}
function calListItemHTML(e) {
	const { int, cand, ivrs, pos, startTs, endTs, dur, isPanel, hasConflict } = e;
	const timeLabel = `${fmtTime(startTs)} – ${fmtTime(endTs)}`; const candName = cand ? cand.name : 'Unknown Candidate'; const ivrNames = ivrs.map(i => i.name).join(', ') || '—';
	const effectiveUrl = int.meetingUrl || getDefaultMeetingUrl(); const effectivePlatform = int.meetingPlatform || getDefaultMeetingPlatform(); const isCustomLink = !!(int.meetingUrl && int.meetingUrl !== getDefaultMeetingUrl());
	const linkHtml = effectiveUrl ? `<a href="${esc(effectiveUrl)}" target="_blank" class="meeting-badge ${isCustomLink ? 'custom' : ''}" style="font-size:10px">${effectivePlatform || 'Meeting'}${isCustomLink ? ' (custom)' : ' (default)'} ↗</a>` : '';
	const sBadges = statusBadgesHTML(int);
	return `<div class="cal-list-item" style="${hasConflict ? 'border-color:var(--amber);' : ''}">
    <div class="cal-list-time" style="${hasConflict ? 'color:var(--amber)' : ''}">${timeLabel}${hasConflict ? ' ⚠️' : ''}</div>
    <div style="flex:0;margin:0 4px">${avatar(candName, 34)}</div>
    <div class="cal-list-info">
      <div class="cal-list-name">${esc(candName)}</div>
      <div class="cal-list-sub">👥 ${esc(ivrNames)} · ${dur} min${pos ? ' · ' + esc(pos.title) : ''}</div>
      <div class="cal-list-badges">${isPanel ? `<span class="badge badge-purple">Panel (${ivrs.length})</span>` : ''}${hasConflict ? `<span class="badge badge-amber">Conflict</span>` : ''}${linkHtml}${sBadges}</div>
    </div>
    <div class="cal-list-actions">
      <button class="btn btn-ghost btn-sm" data-action="openIntDetail" data-id="${int.id}">Edit</button>
      <button class="btn btn-ghost btn-sm" data-action="goScore" data-id="${int.id}">Score</button>
      ${cand?.email ? `<button class="btn btn-ghost btn-sm" data-action="sendInviteFromCal" data-id="${int.id}">✉</button>` : ''}
    </div>
  </div>`;
}
function renderCalWeek() {
	const el = document.getElementById('cal-view-week'); if (!el) return;
	const mon = getWeekMonday(calCursor); const days = []; for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(d.getDate() + i); days.push(d) }
	const todayStr = new Date().toDateString(); const START_H = 7, END_H = 21; const list = getFilteredInterviews().map(enrichInterview);
	let html = `<div class="cal-week-grid"><div class="cal-week-header-cell" style="border-bottom:1px solid var(--border)"></div>${days.map(d => `<div class="cal-week-header-cell ${d.toDateString() === todayStr ? 'today' : ''}">${d.toLocaleDateString('en-US', { weekday: 'short' })}<br><span style="font-size:13px;font-weight:700">${d.getDate()}</span></div>`).join('')}`;
	for (let h = START_H; h < END_H; h++) {
		html += `<div class="cal-week-time-col">${new Date(2000, 0, 1, h).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })}</div>`;
		days.forEach(d => { const isToday = d.toDateString() === todayStr; const dayEvents = list.filter(e => isSameDay(e.startTs, d) && e.startTs.getHours() === h); let cellHtml = ''; dayEvents.forEach(e => { const topPct = (e.startTs.getMinutes() / 60) * 100; const heightPct = Math.max((e.dur / 60) * 100, 15); const cName = e.cand ? e.cand.name : '?'; const conflictStyle = e.hasConflict ? 'background:var(--amber-bg);border-color:var(--amber);color:var(--amber)' : ''; cellHtml += `<div class="cal-week-event ${e.isPanel ? 'panel' : ''}" style="top:${topPct}%;height:calc(${heightPct}% - 2px);${conflictStyle}" title="${esc(cName)} — ${fmtTime(e.startTs)}${e.hasConflict ? ' ⚠️' : ''}" data-action="openIntDetail" data-id="${e.int.id}">${esc(cName)}${e.hasConflict ? ' ⚠️' : ''}</div>` }); html += `<div class="cal-week-cell ${isToday ? 'today-col' : ''}" style="position:relative">${cellHtml}</div>` });
	}
	html += '</div>'; el.innerHTML = html; tool.resize();
}
function renderCalMonth() {
	const el = document.getElementById('cal-view-month'); if (!el) return;
	const year = calCursor.getFullYear(), month = calCursor.getMonth(); const firstDay = new Date(year, month, 1); let startDate = new Date(firstDay); const dow = startDate.getDay(); startDate.setDate(startDate.getDate() - (dow === 0 ? 6 : dow - 1));
	const today = new Date(); today.setHours(0, 0, 0, 0); const list = getFilteredInterviews().map(enrichInterview);
	const DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; let html = `<div class="cal-month-grid">${DOWS.map(d => `<div class="cal-month-dow">${d}</div>`).join('')}`;
	let cur = new Date(startDate);
	for (let row = 0; row < 6; row++) {
		for (let col = 0; col < 7; col++) {
			const isCurrentMonth = cur.getMonth() === month; const isToday = cur.getTime() === today.getTime(); const dayEvents = list.filter(e => isSameDay(e.startTs, cur));
			const evHtml = dayEvents.slice(0, 3).map(e => `<div class="cal-month-event ${e.isPanel ? 'panel' : ''}" data-action="openIntDetail" data-id="${e.int.id}" style="${e.hasConflict ? 'background:var(--amber-bg);color:var(--amber)' : ''}">${fmtTime(e.startTs)} ${esc(e.cand ? e.cand.name.split(' ')[0] : '?')}${e.hasConflict ? ' ⚠' : ''}${e.int.statusDone ? ' ✓' : ''}</div>`).join('');
			const more = dayEvents.length > 3 ? `<div class="cal-month-more">+${dayEvents.length - 3} more</div>` : '';
			html += `<div class="cal-month-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}"><div class="cal-month-day-num">${cur.getDate()}</div>${evHtml}${more}</div>`;
			cur.setDate(cur.getDate() + 1);
		}
		if (cur.getMonth() !== month && row >= 4) break;
	}
	html += '</div>'; el.innerHTML = html; tool.resize();
}
function calNavPrev() { if (calTab === 'week') calCursor.setDate(calCursor.getDate() - 7); else if (calTab === 'month') calCursor.setMonth(calCursor.getMonth() - 1); renderCalendar() }
function calNavNext() { if (calTab === 'week') calCursor.setDate(calCursor.getDate() + 7); else if (calTab === 'month') calCursor.setMonth(calCursor.getMonth() + 1); renderCalendar() }
function calNavToday() { calCursor = new Date(); renderCalendar() }
function switchCalTab(tab) { calTab = tab; document.querySelectorAll('[data-cal-tab]').forEach(t => t.classList.toggle('active', t.dataset.calTab === tab)); document.querySelectorAll('.cal-view').forEach(v => v.style.display = 'none'); const target = document.getElementById('cal-view-' + tab); if (target) target.style.display = '';['cal-prev-btn', 'cal-next-btn', 'cal-today-btn'].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = tab === 'list' ? 'none' : '' }); const periodEl = document.getElementById('cal-period-label'); if (periodEl) periodEl.style.display = tab === 'list' ? 'none' : ''; renderCalendar() }
function sendInviteFromCal(interviewId) { const int = DB.interviews.find(x => x.id === interviewId); if (!int) return; const cand = DB.candidates.find(x => x.id === int.candidateId); if (!cand) return; const ivrIds = (int.interviewerIds || [int.interviewerId]).filter(Boolean); const ivrs = ivrIds.map(id => DB.interviewers.find(x => x.id === id)).filter(Boolean); const pos = DB.positions.find(p => (cand.positionIds || []).includes(p.id)); const startTs = int.scheduledTime ? new Date(int.scheduledTime) : new Date(int.date + 'T09:00:00'); openEmailModal('Interview Invitation', cand.email || '', `Interview Invitation — ${pos ? pos.title : 'Interview'}`, generateInviteEmail(cand, ivrs, fmtDateTime(startTs.toISOString()), int.durationMin || 60, pos, int)) }

/* ══════════════════════════════════════════
   SCHEDULER — single-day mode, precise duration
══════════════════════════════════════════ */
function openSchedulerDrawer() {
	const pf = document.getElementById('sched-pos-filter'); if (pf) { pf.innerHTML = '<option value="">All positions</option>' + DB.positions.map(p => `<option value="${p.id}">${esc(p.title)}</option>`).join('') }
	// Default to today
	const today = new Date(); const wsd = document.getElementById('sched-week-start'); if (wsd && !wsd.value) wsd.value = today.toISOString().slice(0, 10);
	// Set default duration and break from settings
	const sd = document.getElementById('sched-duration'); if (sd && !sd.value) { sd.value = ''; sd.options[0].textContent = 'Use company default (' + getDefaultDuration() + ' min)'; }
	const sb = document.getElementById('sched-break'); if (sb) sb.value = String(getDefaultBreak());
	buildSchedIvrDropdown(); renderSchedCandidatesPreview(); openDrawer('sched'); tool.resize();
}
function closeSchedulerDrawer() { closeDrawer('sched') }
function buildSchedIvrDropdown() {
	const dd = document.getElementById('sched-interviewers-dropdown'); if (!dd) return;
	dd.innerHTML = DB.interviewers.map(ivr => { const slots = (ivr.slots || []).map(migrateSlot); return `<div class="dropdown-item ${selectedSchedInterviewers.includes(ivr.id) ? 'selected' : ''}" data-action="toggleSchedIvr" data-id="${ivr.id}">${avatar(ivr.name, 22)} ${esc(ivr.name)}<span style="color:var(--text3);font-size:10px;margin-left:4px">${slots.length} slots · ${ivr.duration || 60}min</span></div>` }).join('') || `<div class="dropdown-item" style="color:var(--text3)">No interviewers defined</div>`;
}
function toggleSchedIvr(id) { if (selectedSchedInterviewers.includes(id)) selectedSchedInterviewers = selectedSchedInterviewers.filter(x => x !== id); else selectedSchedInterviewers.push(id); renderSchedIvrDisplay(); buildSchedIvrDropdown(); document.getElementById('sched-interviewers-dropdown').classList.remove('open') }
function renderSchedIvrDisplay() { const el = document.getElementById('sched-interviewers-display'); if (!el) return; if (!selectedSchedInterviewers.length) { el.innerHTML = `<span class="multi-select-placeholder">Click to select interviewers...</span>`; return } el.innerHTML = selectedSchedInterviewers.map(id => { const i = DB.interviewers.find(x => x.id === id); return i ? `<span class="multi-select-item">${esc(i.name)}<span class="rm" data-action="rmSchedIvr" data-id="${id}">×</span></span>` : '' }).join('') }
function renderSchedCandidatesPreview() {
	const el = document.getElementById('sched-candidates-preview'); if (!el) return; const filterPos = document.getElementById('sched-pos-filter')?.value || '';
	const adv = DB.candidates.filter(c => { if (c.eliminated || !DB.screenings.some(s => s.candidateId === c.id && s.status === 'advanced')) return false; if (filterPos && !(c.positionIds || []).includes(filterPos)) return false; return true });
	if (!adv.length) { el.innerHTML = `<div style="color:var(--text3);font-size:12px">No advanced candidates.</div>`; return }
	const noInt = adv.filter(c => !DB.interviews.some(i => i.candidateId === c.id));
	el.innerHTML = `<div style="font-size:11px;color:var(--text3);margin-bottom:6px">${adv.length} advanced · <strong>${noInt.length} without interview yet</strong></div>` +
		adv.map(c => { const hasSlot = scheduleSlots.some(s => s.candidateId === c.id); const hasInt = DB.interviews.some(i => i.candidateId === c.id); return `<div class="sched-item-preview">${avatar(c.name, 24)}<div style="flex:1"><div style="font-size:12px;font-weight:500">${esc(c.name)}</div></div>${hasSlot ? `<span class="badge badge-green" style="font-size:9px">Scheduled</span>` : hasInt ? `<span class="badge badge-amber" style="font-size:9px">Has interview</span>` : `<span class="badge badge-gray" style="font-size:9px">Needs interview</span>`}</div>` }).join('');
}

function candidateHasConflict(candidateId, startMs, endMs) {
	return DB.interviews.some(int => {
		if (int.candidateId !== candidateId) return false;
		const iStart = int.scheduledTime ? new Date(int.scheduledTime).getTime() : new Date(int.date + 'T09:00:00').getTime();
		const iEnd = iStart + (int.durationMin || 60) * 60000;
		return startMs < iEnd && endMs > iStart;
	});
}

function autoSchedule() {
	// sched-week-start is now a SINGLE DAY
	const schedDate = document.getElementById('sched-week-start')?.value;
	const breakMin = parseInt(document.getElementById('sched-break')?.value || String(getDefaultBreak()));
	const filterPos = document.getElementById('sched-pos-filter')?.value || '';
	const schedDurVal = parseInt(document.getElementById('sched-duration')?.value) || getDefaultDuration();
	if (!schedDate) { tool.notify('Select a date', 'warning'); return }
	if (!selectedSchedInterviewers.length) { tool.notify('Select at least one interviewer', 'warning'); return }
	const interviewers = DB.interviewers.filter(i => selectedSchedInterviewers.includes(i.id));
	const noSlots = interviewers.filter(i => !(i.slots || []).length);
	if (noSlots.length) { tool.notify(`${noSlots.map(i => i.name).join(', ')} ha${noSlots.length > 1 ? 've' : 's'} no availability slots.`, 'warning'); if (noSlots.length === interviewers.length) return }
	const candidates = DB.candidates.filter(c => {
		if (c.eliminated || !DB.screenings.some(s => s.candidateId === c.id && s.status === 'advanced')) return false;
		if (filterPos && !(c.positionIds || []).includes(filterPos)) return false;
		// Skip candidates who already have any interview (scheduled, done, or pending)
		if (DB.interviews.some(i => i.candidateId === c.id)) return false;
		return true;
	});
	if (!candidates.length) { tool.notify('No advanced candidates to schedule', 'warning'); return }

	// Duration: use explicit scheduler setting, or company default, or interviewer profile as fallback
	const dur = schedDurVal || (interviewers.length === 1 ? (interviewers[0].duration || getDefaultDuration()) : Math.min(...interviewers.map(i => i.duration || getDefaultDuration())));
	// Day-of-week name for the selected date
	const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const selectedDayName = DAY_NAMES[new Date(schedDate + 'T00:00:00').getDay()];
	const dayStartTs = new Date(schedDate + 'T00:00:00').getTime();

	// Build free ranges for the selected day only across all interviewers, then intersect
	function ivrFreeRangesForDay(ivr) {
		const ranges = []; const slots = (ivr.slots || []).map(migrateSlot).filter(s => s.day && s.hour12 && s.toHour12 && s.day === selectedDayName);
		slots.forEach(slot => {
			const fromMins = slotToMinutes({ hour12: slot.hour12, minute: slot.minute, ampm: slot.ampm });
			const toMins = slotToMinutes({ hour12: slot.toHour12, minute: slot.toMinute, ampm: slot.toAmpm });
			if (toMins <= fromMins) return;
			ranges.push({ start: fromMins, end: toMins });// minutes from midnight of selected day
		});
		return ranges;
	}
	function intersectRanges(a, b) {
		const result = []; const sa = a.slice().sort((x, y) => x.start - y.start); const sb = b.slice().sort((x, y) => x.start - y.start);
		let i = 0, j = 0; while (i < sa.length && j < sb.length) { const lo = Math.max(sa[i].start, sb[j].start); const hi = Math.min(sa[i].end, sb[j].end); if (hi > lo) result.push({ start: lo, end: hi }); if (sa[i].end < sb[j].end) i++; else j++ }
		return result;
	}

	let sharedRanges = ivrFreeRangesForDay(interviewers[0]);
	for (let i = 1; i < interviewers.length; i++) { sharedRanges = intersectRanges(sharedRanges, ivrFreeRangesForDay(interviewers[i])) }

	if (!sharedRanges.length) {
		tool.notify(`No availability for ${interviewers.map(i => i.name).join(' & ')} on ${selectedDayName} (${schedDate}). Check their slots for this day of the week.`, 'warning'); return;
	}

	// Slice into precise blocks of `dur` minutes with `breakMin` gap
	// All arithmetic in INTEGER minutes from midnight, no float issues
	const blocks = [];
	sharedRanges.forEach(range => {
		let cursor = range.start;// minutes from midnight
		while (cursor + dur <= range.end) {
			blocks.push({ startMs: dayStartTs + cursor * 60000, endMs: dayStartTs + (cursor + dur) * 60000, used: false });
			cursor += dur + breakMin;
		}
	});

	if (!blocks.length) {
		tool.notify(`Available windows on ${selectedDayName} are too short for a ${dur}-min interview with ${breakMin}-min breaks.`, 'warning'); return;
	}

	scheduleSlots = []; let skippedConflict = 0;
	for (const cand of candidates) {
		let assigned = false;
		for (const block of blocks) {
			if (block.used) continue; if (candidateHasConflict(cand.id, block.startMs, block.endMs)) continue;
			block.used = true; const pos = DB.positions.find(p => (cand.positionIds || []).includes(p.id));
			scheduleSlots.push({ candidateId: cand.id, interviewerIds: [...selectedSchedInterviewers], interviewerId: selectedSchedInterviewers[0], startTime: new Date(block.startMs).toISOString(), endTime: new Date(block.endMs).toISOString(), durationMin: dur, positionId: pos?.id || '' });
			assigned = true; break;
		}
		if (!assigned) { if (DB.interviews.some(i => i.candidateId === cand.id)) skippedConflict++; else tool.notify(`No available block for ${cand.name} — all ${blocks.length} slots are filled`, 'warning') }
	}
	closeSchedulerDrawer(); renderSchedulePage();
	tool.notify(`${scheduleSlots.length}/${candidates.length} scheduled on ${selectedDayName} ${schedDate} (${blocks.length} blocks available${skippedConflict > 0 ? `, ${skippedConflict} skipped - already have interviews` : ''})`, 'success');
}

function renderSchedulePage() {
	const clearBtn = document.getElementById('clear-schedule-btn'); if (clearBtn) clearBtn.style.display = scheduleSlots.length ? '' : 'none';
	const el = document.getElementById('schedule-result-full'); if (!el) return;
	if (!scheduleSlots.length) {
		const advCount = DB.candidates.filter(c => !c.eliminated && DB.screenings.some(s => s.candidateId === c.id && s.status === 'advanced')).length;
		const noInt = DB.candidates.filter(c => !c.eliminated && DB.screenings.some(s => s.candidateId === c.id && s.status === 'advanced') && !DB.interviews.some(i => i.candidateId === c.id)).length;
		el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">◷</div><p style="font-size:14px;font-weight:500;color:var(--text2);margin-bottom:6px">${advCount} advanced · <strong>${noInt} without interview yet</strong></p><p style="font-size:12px;color:var(--text3)">Select a <strong>single day</strong> and click Configure &amp; Schedule.<br>Interviewer slots for that day of the week will be used. 15/30/45-min durations are fully precise.</p></div>`; return;
	}
	const grouped = {}; scheduleSlots.forEach(s => { const day = new Date(s.startTime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); if (!grouped[day]) grouped[day] = []; grouped[day].push(s) });
	let html = `<div style="display:flex;gap:10px;margin-bottom:20px;align-items:center;flex-wrap:wrap"><button class="btn btn-success" id="confirm-schedule-btn">✓ Confirm &amp; Create Interviews</button><span style="font-size:12px;color:var(--text3)">${scheduleSlots.length} interview${scheduleSlots.length !== 1 ? 's' : ''} pending</span><button class="btn btn-ghost btn-sm" onclick="navigate('calendar')">📅 Calendar</button></div>`;
	Object.entries(grouped).forEach(([day, slots]) => {
		html += `<div class="sched-day-header"><span>📅</span>${day}<span class="badge badge-blue">${slots.length}</span></div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:10px;margin-bottom:16px">`;
		slots.forEach(s => {
			const c = DB.candidates.find(x => x.id === s.candidateId); const ivrIds = s.interviewerIds || [s.interviewerId].filter(Boolean); const ivrs = ivrIds.map(id => DB.interviewers.find(x => x.id === id)).filter(Boolean); const pos = s.positionId ? DB.positions.find(x => x.id === s.positionId) : null;
			const timeStr = new Date(s.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }); const endStr = new Date(s.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }); const ivrNames = ivrs.map(i => esc(i.name)).join(', ') || '?'; const panelBadge = ivrs.length > 1 ? `<span class="badge badge-purple" style="font-size:9px">Panel (${ivrs.length})</span>` : '';
			html += `<div class="sched-slot-row"><div class="sched-time">${timeStr}<span style="color:var(--text3);font-weight:400"> – ${endStr}</span></div><div style="flex:1"><div style="display:flex;align-items:center;gap:8px">${avatar(c ? c.name : '?', 30)}<div><div style="font-weight:500;font-size:13px">${c ? esc(c.name) : 'Unknown'}</div>${pos ? `<div style="font-size:11px;color:var(--text3)">${esc(pos.title)}</div>` : ''}</div></div><div class="sched-ivr" style="margin-top:5px">👥 ${ivrNames} ${panelBadge} · ${s.durationMin}min</div></div><div style="display:flex;flex-direction:column;gap:5px">${c?.email ? `<button class="btn btn-ghost btn-sm" data-action="sendInviteEmail" data-id="${s.candidateId}">✉</button>` : ''}</div></div>`;
		});
		html += '</div>';
	});
	el.innerHTML = html;
}

function confirmAllSchedule() {
	if (!scheduleSlots.length) { tool.notify('Nothing to confirm', 'warning'); return }
	let created = 0, skipped = 0;
	scheduleSlots.forEach(slot => {
		const startMs = new Date(slot.startTime).getTime(); const endMs = new Date(slot.endTime).getTime();
		if (candidateHasConflict(slot.candidateId, startMs, endMs)) { skipped++; return }
		if (!DB.interviews.find(i => i.candidateId === slot.candidateId)) {
			const ivrIds = slot.interviewerIds || [slot.interviewerId].filter(Boolean);
			DB.interviews.push({ id: genId(), candidateId: slot.candidateId, date: new Date(slot.startTime).toISOString().slice(0, 10), interviewerIds: ivrIds, notes: `Auto-scheduled. Time: ${fmtDateTime(slot.startTime)}${ivrIds.length > 1 ? ' (Panel: ' + ivrIds.map(id => { const i = DB.interviewers.find(x => x.id === id); return i ? i.name : '?' }).join(', ') + ')' : ''}`, scheduledTime: slot.startTime, durationMin: slot.durationMin, statusEmailSent: false, statusCalled: false, statusDone: false, createdAt: new Date().toISOString() });
			created++;
		}
	});
	persist(); scheduleSlots = []; renderSchedulePage(); updateNavBadges();
	tool.notify(skipped > 0 ? `${created} created, ${skipped} skipped (conflict)` : `${created} interviews created`, 'success');
}

function sendInviteEmail(candidateId) {
	const slot = scheduleSlots.find(s => s.candidateId === candidateId); const dbInt = DB.interviews.find(i => i.candidateId === candidateId); const c = DB.candidates.find(x => x.id === candidateId); if (!c) return;
	let ivrIds, startTime, dur, posId, intObj;
	if (slot) { ivrIds = slot.interviewerIds || [slot.interviewerId].filter(Boolean); startTime = slot.startTime; dur = slot.durationMin; posId = slot.positionId; intObj = dbInt }
	else if (dbInt) { ivrIds = (dbInt.interviewerIds || [dbInt.interviewerId]).filter(Boolean); startTime = dbInt.scheduledTime || dbInt.date + 'T09:00:00'; dur = dbInt.durationMin || 60; posId = ''; intObj = dbInt }
	else { tool.notify('No schedule for this candidate', 'warning'); return }
	const ivrs = ivrIds.map(id => DB.interviewers.find(x => x.id === id)).filter(Boolean); const pos = posId ? DB.positions.find(x => x.id === posId) : null;
	openEmailModal('Interview Invitation', c.email || '', `Interview Invitation — ${pos ? pos.title : 'Interview'}`, generateInviteEmail(c, ivrs, fmtDateTime(startTime), dur, pos, intObj));
}

/* ══ SCORING ══ */
function populateScoringSelects() {
	const intSel = document.getElementById('score-interview'); const ivrSel = document.getElementById('score-interviewer'); if (!intSel || !ivrSel) return;
	const curInt = intSel.value, curIvr = ivrSel.value;
	intSel.innerHTML = '<option value="">Select interview...</option>' + DB.interviews.map(int => { const c = DB.candidates.find(x => x.id === int.candidateId); return `<option value="${int.id}">${esc(c ? c.name : '?')} — ${fmtDate(int.date)}</option>` }).join('');
	ivrSel.innerHTML = '<option value="">Select interviewer...</option>' + DB.interviewers.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join('');
	if (curInt) intSel.value = curInt; if (curIvr) ivrSel.value = curIvr; if (intSel.value && ivrSel.value) loadScoringForm();
}
function getCriteriaId(name) { return 'sc-' + name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '') }
function allCriteriaAvg(score) {
	// If ineligible, return -1 as a sentinel (not a real score)
	if (score.ineligible) return -1;
	const all = [...Object.values(score.criteria || {}), ...Object.values(score.extraCriteria || {})].filter(v => typeof v === 'number');
	return all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
}
function loadScoringForm() {
	const interviewId = document.getElementById('score-interview').value; const interviewerId = document.getElementById('score-interviewer').value; const container = document.getElementById('scoring-form-container'); if (!container) return;
	if (!interviewId || !interviewerId) { container.innerHTML = ''; tool.resize(); return }
	const interview = DB.interviews.find(x => x.id === interviewId); const interviewer = DB.interviewers.find(x => x.id === interviewerId); const candidate = DB.candidates.find(x => x.id === interview?.candidateId);
	if (!interview || !interviewer || !candidate) { container.innerHTML = '<div style="color:var(--text3);padding:16px">Invalid selection</div>'; tool.resize(); return }
	const existing = DB.scores.find(s => s.interviewId === interviewId && s.interviewerId === interviewerId);
	const appliedIds = candidate.positionIds || []; const appliedFirst = [...DB.positions.filter(p => appliedIds.includes(p.id)), ...DB.positions.filter(p => !appliedIds.includes(p.id))]; const exPosId = existing?.positionId || (appliedFirst[0]?.id || GENERAL_POS_ID);
	const exCrit = existing?.criteria || {}; const exExtra = existing?.extraCriteria || {}; const exRec = existing?.recommendation || ''; const exNotes = existing?.notes || ''; const exSug = existing?.suggestedPositionId || '';
	const exIneligible = existing?.ineligible || false;
	const selPos = DB.positions.find(p => p.id === exPosId); const posExtra = (selPos?.extraCriteria || []).filter(c => c.name.trim()); const isGeneral = exPosId === GENERAL_POS_ID;
	const posOptions = appliedFirst.map(p => `<option value="${p.id}" ${p.id === exPosId ? 'selected' : ''}>${esc(p.title)}${appliedIds.includes(p.id) ? ' ★' : ''}</option>`).join('') + `<option value="${GENERAL_POS_ID}" ${isGeneral ? 'selected' : ''}>— General Evaluation —</option>`;
	const intSpecificUrl = interview.meetingUrl || ''; const defaultUrl = getDefaultMeetingUrl(); const effectiveUrl = intSpecificUrl || defaultUrl; const effectivePlatform = interview.meetingPlatform || getDefaultMeetingPlatform(); const isCustomLink = !!(intSpecificUrl && intSpecificUrl !== defaultUrl);
	const meetingInfo = effectiveUrl ? `<div style="background:var(--accent-bg);border:1px solid var(--accent);border-radius:var(--r2);padding:8px 12px;margin-bottom:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:11px;font-weight:600;color:var(--accent)">${effectivePlatform || 'Meeting'} ${isCustomLink ? '<span class="badge badge-purple">Custom</span>' : '<span class="badge badge-blue">Default</span>'}</span><a href="${esc(effectiveUrl)}" target="_blank" style="font-size:11px;color:var(--accent)">${esc(effectiveUrl)}</a><button class="btn btn-ghost btn-sm" style="margin-left:auto" data-action="openIntDetail" data-id="${interviewId}">Edit</button></div>` : `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r2);padding:8px 12px;margin-bottom:12px;display:flex;align-items:center;gap:8px"><span style="font-size:11px;color:var(--text3)">No meeting link</span><button class="btn btn-ghost btn-sm" style="margin-left:auto" data-action="openIntDetail" data-id="${interviewId}">+ Add</button></div>`;
	const ivrIds = (interview.interviewerIds || [interviewerId]); const panelInfo = ivrIds.length > 1 ? `<div style="background:var(--purple-bg);border:1px solid var(--purple);border-radius:var(--r2);padding:7px 12px;margin-bottom:12px;font-size:12px;color:var(--purple)">👥 Panel: ${ivrIds.map(id => { const i = DB.interviewers.find(x => x.id === id); return i ? i.name : '?' }).join(', ')}. Each panelist submits their own score.</div>` : '';
	// Show interview status
	const sBadges = statusBadgesHTML(interview); const statusRow = sBadges ? `<div style="margin-bottom:12px;display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span style="font-size:11px;color:var(--text3)">Status:</span>${sBadges}<button class="btn btn-ghost btn-sm" data-action="openIntDetail" data-id="${interviewId}">Update</button></div>` : '';
	container.innerHTML = `<div class="scoring-section"><div class="scoring-header"><span style="color:var(--accent)">◈</span> Scoring: <strong>${esc(candidate.name)}</strong> by <strong>${esc(interviewer.name)}</strong>${candidate.resume ? `<span class="resume-link" data-action="previewResume" data-url="${esc(candidate.resume)}" style="margin-left:auto">📄</span>` : ''}</div>
    ${panelInfo}${meetingInfo}${statusRow}
    ${isGeneral ? `<div class="general-eval-banner">⚡ General evaluation — not linked to a specific position.</div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
      <div class="form-group" style="margin:0"><label class="form-label">Evaluated for Position</label><select id="score-position" data-action="reloadScoringForm">${posOptions}</select><div style="font-size:10px;color:var(--text3);margin-top:3px">★ = applied</div></div>
      <div class="form-group" style="margin:0"><label class="form-label">Recommendation</label><select id="score-recommendation"><option value="" ${!exRec ? 'selected' : ''}>Select...</option><option value="strong-yes" ${'strong-yes' === exRec ? 'selected' : ''}>Strong Yes</option><option value="yes" ${'yes' === exRec ? 'selected' : ''}>Yes</option><option value="maybe" ${'maybe' === exRec ? 'selected' : ''}>Maybe</option><option value="no" ${'no' === exRec ? 'selected' : ''}>No</option></select></div>
    </div>
    ${!isGeneral ? `<div class="form-group"><label class="form-label">Suggest Alternative Position</label><select id="score-suggested-position"><option value="">— None —</option>${DB.positions.map(p => `<option value="${p.id}" ${p.id === exSug ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select></div>` : ''}
    <div class="form-group" style="margin-bottom:0">
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--red-bg);border:1px solid var(--red);border-radius:var(--r2)">
        <label class="toggle-switch danger"><input type="checkbox" id="score-ineligible" ${exIneligible ? 'checked' : ''} data-action="toggleIneligible"><span class="toggle-slider"></span></label>
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--red)">Not Eligible / Not Suitable</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">For grant-based or eligibility-restricted positions. When checked, scoring criteria become optional.</div>
        </div>
      </div>
    </div>
    <div class="section-sep"><div class="section-sep-label">HR / General Criteria<span class="section-sep-badge">All positions</span></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px">${HR_CRITERIA.map(cr => `<div class="criteria-row"><div><div class="criteria-name">${esc(cr.name)}</div><div class="criteria-desc">${esc(cr.desc)}</div></div><div><input type="number" id="${getCriteriaId(cr.name)}" min="1" max="10" value="${esc(exCrit[cr.name] || '')}" placeholder="1–10" data-ctype="hr" data-cname="${esc(cr.name)}"></div></div>`).join('')}</div>
    ${posExtra.length ? `<div class="section-sep"><div class="section-sep-label">Position-Specific<span class="section-sep-badge pos-specific">${esc(selPos.title)}</span></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px">${posExtra.map(cr => `<div class="criteria-row"><div><div class="criteria-name">${esc(cr.name)}</div><div class="criteria-desc">${esc(cr.desc || '')}</div></div><div><input type="number" id="${getCriteriaId('extra_' + cr.name)}" min="1" max="10" value="${esc(exExtra[cr.name] || '')}" placeholder="1–10" data-ctype="extra" data-cname="${esc(cr.name)}"></div></div>`).join('')}</div>` : ''}
    <div class="form-group"><label class="form-label">Notes</label><textarea id="score-notes">${esc(exNotes)}</textarea></div>
    <div style="display:flex;gap:8px;align-items:center"><button class="btn btn-primary" data-action="submitScore" data-int="${interviewId}" data-ivr="${interviewerId}">${existing ? 'Update' : 'Submit'} Score</button>${existing ? `<button class="btn btn-danger btn-sm" data-action="deleteScore" data-int="${interviewId}" data-ivr="${interviewerId}">Remove</button>` : ''}<span id="score-avg-display" style="font-size:11px;color:var(--text3);margin-left:auto"></span></div>
  </div>`;
	updateScoreAvg(); tool.resize();
}
function reloadScoringFormWithNewPos() { const interviewId = document.getElementById('score-interview').value; const interviewerId = document.getElementById('score-interviewer').value; if (!interviewId || !interviewerId) return; const newPosId = document.getElementById('score-position')?.value; if (!newPosId) return; const hrSnap = {}; HR_CRITERIA.forEach(cr => { const el = document.getElementById(getCriteriaId(cr.name)); if (el) hrSnap[cr.name] = el.value }); const existing = DB.scores.find(s => s.interviewId === interviewId && s.interviewerId === interviewerId); if (existing) { existing.positionId = newPosId; existing.criteria = Object.assign({}, existing.criteria, hrSnap); existing.recommendation = document.getElementById('score-recommendation')?.value || ''; existing.notes = document.getElementById('score-notes')?.value || '' } loadScoringForm() }
function updateScoreAvg() { const vals = []; document.querySelectorAll('#scoring-form-container input[type=number]').forEach(inp => { const v = parseFloat(inp.value || ''); if (!isNaN(v) && v >= 1 && v <= 10) vals.push(v) }); const el = document.getElementById('score-avg-display'); if (el) { const inel = document.getElementById('score-ineligible')?.checked; if (inel) el.textContent = 'Ineligible'; else el.textContent = vals.length ? 'Avg: ' + (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) + '/10' : '' } }
function submitScore(interviewId, interviewerId) {
	if (isReadOnly) return; const positionId = document.getElementById('score-position')?.value; const recommendation = document.getElementById('score-recommendation')?.value; const suggestedPositionId = document.getElementById('score-suggested-position')?.value || ''; const notes = document.getElementById('score-notes')?.value.trim() || ''; const ineligible = document.getElementById('score-ineligible')?.checked || false; const criteria = {}; const extraCriteria = {}; let filled = 0;
	document.querySelectorAll('#scoring-form-container input[type=number]').forEach(inp => { const v = parseFloat(inp.value || ''); if (!isNaN(v) && v >= 1 && v <= 10) { if (inp.dataset.ctype === 'extra') extraCriteria[inp.dataset.cname] = v; else criteria[inp.dataset.cname] = v; filled++ } });
	if (!positionId) { tool.notify('Select a position', 'warning'); return }
	// When ineligible, recommendation and criteria are optional
	if (!ineligible) {
		if (!recommendation) { tool.notify('Select a recommendation', 'warning'); return }
		if (!filled) { tool.notify('Score at least one criterion', 'warning'); return }
	}
	const candidateId = DB.interviews.find(x => x.id === interviewId)?.candidateId; const idx = DB.scores.findIndex(s => s.interviewId === interviewId && s.interviewerId === interviewerId); const obj = { id: idx >= 0 ? DB.scores[idx].id : genId(), interviewId, interviewerId, positionId, candidateId, criteria, extraCriteria, recommendation, suggestedPositionId, notes, ineligible, date: new Date().toISOString() }; if (idx >= 0) DB.scores[idx] = obj; else DB.scores.push(obj);
	persist(); loadScoringForm(); tool.notify('Score saved', 'success');
}
function deleteScore(interviewId, interviewerId) { openConfirm('Remove Score', 'Remove this score?', () => { DB.scores = DB.scores.filter(s => !(s.interviewId === interviewId && s.interviewerId === interviewerId)); persist(); loadScoringForm(); tool.notify('Removed', 'info') }, 'Remove') }

/* ══ PIPELINE ══ */
function renderPipeline() {
	const search = (document.getElementById('pipeline-search')?.value || '').toLowerCase(); const pf = document.getElementById('pipeline-pos-filter'); if (pf) { const cur = pf.value; pf.innerHTML = '<option value="">All positions</option>' + DB.positions.map(p => `<option value="${p.id}" ${p.id === cur ? 'selected' : ''}>${esc(p.title)}</option>`).join(''); pf.value = cur || '' } const filterPos = pf?.value || '';
	const stages = [{ id: 'pending', label: 'Pending Screening', color: 'var(--amber)' }, { id: 'advanced', label: 'Advanced', color: 'var(--teal)' }, { id: 'eliminated', label: 'Eliminated', color: 'var(--red)' }, { id: 'selected', label: 'Selected', color: 'var(--green)' }];
	let cands = DB.candidates; if (search) cands = cands.filter(c => c.name.toLowerCase().includes(search) || (c.email || '').toLowerCase().includes(search)); if (filterPos) cands = cands.filter(c => (c.positionIds || []).includes(filterPos));
	const board = document.getElementById('kanban-board'); if (!board) return;
	board.innerHTML = stages.map(stage => { const cols = cands.filter(c => getStage(c.id) === stage.id); return `<div class="kanban-col"><div class="kanban-col-header"><span style="color:${stage.color}">${stage.label}</span><span class="kanban-col-count">${cols.length}</span></div>${cols.slice(0, 50).map(c => { const positions = (c.positionIds || []).slice(0, 2).map(pid => { const p = DB.positions.find(x => x.id === pid); return p ? `<span class="badge badge-blue" style="font-size:9px">${esc(p.title)}</span>` : '' }).join(''); return `<div class="kanban-card"><div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">${avatar(c.name, 26)}<div style="min-width:0"><div class="kanban-card-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</div><div class="kanban-card-sub">${c.source ? esc(c.source) : (c.email || '')}</div></div></div><div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:6px">${positions}</div>${c.eliminationReason && stage.id === 'eliminated' ? `<div style="font-size:10px;color:var(--red);background:var(--red-bg);padding:2px 6px;border-radius:4px;margin-bottom:5px">${esc(c.eliminationReason.slice(0, 60))}</div>` : ''}<div class="kanban-card-actions">${stage.id === 'pending' ? `<button class="btn btn-success btn-sm" data-action="advanceCandidate" data-id="${c.id}">✓</button><button class="btn btn-danger btn-sm" data-action="eliminateCandidate" data-id="${c.id}">⛔</button>` : ''}${stage.id === 'advanced' ? `<button class="btn btn-ghost btn-sm" data-action="unadvanceCandidate" data-id="${c.id}">↩</button><button class="btn btn-danger btn-sm" data-action="eliminateCandidate" data-id="${c.id}">⛔</button>` : ''}${stage.id === 'eliminated' ? `<button class="btn btn-ghost btn-sm" data-action="reinstateCandidate" data-id="${c.id}">↩</button>` : ''}<button class="btn btn-ghost btn-sm" data-action="editCand" data-id="${c.id}">Edit</button></div></div>` }).join('')}${cols.length > 50 ? `<div style="font-size:11px;color:var(--text3);text-align:center;padding:8px">+${cols.length - 50} more</div>` : ''}</div>` }).join('');
}

/* ══ REPORTS ══ */
function switchReportTab(tab, el) { document.querySelectorAll('.report-tab-content').forEach(c => c.style.display = 'none'); document.querySelectorAll('.tab[data-tab]').forEach(t => t.classList.remove('active')); const rc = document.getElementById('report-' + tab); if (rc) rc.style.display = ''; if (el) el.classList.add('active'); tool.resize() }
function renderReports() { renderCandidateReport(); renderPositionReport(); renderMatrixReport(); renderRejectionReport() }
function renderCandidateReport() {
	const el = document.getElementById('report-candidates'); if (!el) return; if (!DB.scores.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">◫</div><p>No scores yet.</p></div>'; return }
	const recFilter = document.getElementById('report-rec-filter')?.value || '';
	const eligFilter = document.getElementById('report-elig-filter')?.value || '';
	const allPosIds = [...new Set(DB.scores.map(s => s.positionId))];
	const rows = DB.candidates.map(c => {
		const posScores = allPosIds.map(posId => {
			const sc = DB.scores.filter(s => s.candidateId === c.id && s.positionId === posId);
			if (!sc.length) return null;
			const inelCount = sc.filter(s => s.ineligible).length;
			const validSc = sc.filter(s => !s.ineligible);
			const avg = validSc.length ? validSc.reduce((a, s) => a + allCriteriaAvg(s), 0) / validSc.length : -1;
			const recScore = sc.reduce((a, s) => a + getRecW(s.recommendation), 0);
			const isGeneral = posId === GENERAL_POS_ID;
			const pos = isGeneral ? null : DB.positions.find(p => p.id === posId);
			const hasIneligible = inelCount > 0;
			const allIneligible = sc.length > 0 && sc.every(s => s.ineligible);
			return { posId, pos, isGeneral, avg, recScore, count: sc.length, inelCount, hasIneligible, allIneligible, applied: (c.positionIds || []).includes(posId), scores: sc };
		}).filter(Boolean);
		const filteredScores = recFilter ? posScores.filter(ps => ps.scores.some(s => s.recommendation === recFilter)) : posScores;
		const eligFiltered = eligFilter === 'ineligible' ? filteredScores.filter(ps => ps.hasIneligible) : eligFilter === 'eligible' ? filteredScores.filter(ps => !ps.allIneligible) : filteredScores;
		if (!eligFiltered.length) return null;
		const best = eligFiltered.length ? Math.max(...eligFiltered.map(p => p.avg >= 0 ? p.avg : 0)) : 0;
		return { c, posScores: eligFiltered, best };
	}).filter(Boolean).sort((a, b) => b.best - a.best);
	if (!rows.length) { const filtMsg = (recFilter || eligFilter) ? ' matching filters' : ''; el.innerHTML = '<div class="empty-state"><p>No scored candidates' + filtMsg + '.</p></div>'; return }
	el.innerHTML = rows.map((item, idx) => {
		const c = item.c, posScores = item.posScores;
		const elim = c.eliminated;
		const sel = getStage(c.id) === 'selected';
		// Build position scores HTML
		const scoresSorted = posScores.sort((a, b) => b.avg - a.avg);
		let posScoresHTML = '';
		scoresSorted.forEach(ps => {
			const bc = ps.allIneligible ? 'var(--red)' : ps.avg >= 7 ? 'var(--green)' : ps.avg >= 5 ? 'var(--amber)' : 'var(--red)';
			const rb = ps.recScore > 0 ? 'badge-green' : ps.recScore < 0 ? 'badge-red' : 'badge-gray';
			const rt = ps.recScore > 1 ? 'Strong Hire' : ps.recScore > 0 ? 'Hire' : ps.recScore === 0 ? 'Neutral' : 'No Hire';
			const title = ps.isGeneral ? 'General' : esc(ps.pos?.title || '?');
			const tag = ps.isGeneral ? '<span class="badge badge-teal">General</span>' : ps.applied ? '<span class="badge badge-blue">Applied</span>' : '<span class="badge badge-teal">Suggested</span>';
			const inelTag = ps.hasIneligible ? '<span class="badge badge-red">' + ps.inelCount + ' ineligible</span>' : '';
			const rpClass = ps.applied ? 'rp-applied' : ps.isGeneral ? 'rp-general' : '';
			const scoreDisplay = ps.allIneligible ? 'INELIGIBLE' : ps.avg.toFixed(1) + '<span style="font-size:11px;color:var(--text3)">/10</span>';
			const barWidth = ps.allIneligible ? 100 : Math.round(ps.avg * 10);
			posScoresHTML += '<div class="report-position ' + rpClass + '">' +
				'<div style="font-size:11px;font-weight:500">' + title + ' ' + tag + ' ' + inelTag + '</div>' +
				'<div style="font-family:var(--mono);font-size:18px;font-weight:600;color:' + bc + ';margin-top:3px">' + scoreDisplay + '</div>' +
				'<div class="score-bar"><div class="score-bar-fill" style="width:' + barWidth + '%;background:' + bc + '"></div></div>' +
				'<div style="font-size:10px;color:var(--text3);margin-top:2px">' + ps.count + ' session' + (ps.count !== 1 ? 's' : '') + ' <span class="badge ' + rb + '">' + rt + '</span></div>' +
				'</div>';
		});
		// Build scoring status HTML
		let scoringStatusHTML = '';
		const candInts = DB.interviews.filter(i => i.candidateId === c.id);
		if (candInts.length) {
			let sRows = '';
			candInts.forEach(int => {
				const ivrIds = (int.interviewerIds || [int.interviewerId]).filter(Boolean);
				let iRows = '';
				ivrIds.forEach(ivrId => {
					const ivr = DB.interviewers.find(x => x.id === ivrId);
					const sc = DB.scores.find(s => s.interviewId === int.id && s.interviewerId === ivrId);
					const isSc = !!sc;
					const inel = sc?.ineligible;
					const av = sc ? allCriteriaAvg(sc) : 0;
					iRows += '<div class="score-status-row ' + (isSc ? 'scored' : 'pending') + '">' +
						avatar(ivr ? ivr.name : '?', 20) +
						'<span style="font-size:11px;font-weight:500">' + esc(ivr ? ivr.name : 'Unknown') + '</span>' +
						(isSc ? (inel ? '<span class="badge badge-red">Ineligible</span>' : '<span class="badge badge-green">Scored ' + (av >= 0 ? av.toFixed(1) : '') + '</span>') : '<span class="badge badge-amber">Pending</span>') +
						(isSc ? '<button class="btn btn-ghost btn-sm" data-action="goScore" data-id="' + int.id + '" style="margin-left:auto">View</button>' : '') +
						'</div>';
				});
				sRows += '<div class="score-status-int"><div style="font-size:10px;font-weight:600;color:var(--text3);margin-bottom:4px">' + fmtDate(int.date) + (int.statusDone ? ' Done' : '') + '</div>' + iRows + '</div>';
			});
			scoringStatusHTML = '<div class="score-status-section">' +
				'<div class="score-status-toggle" onclick="this.classList.toggle(\'open\');this.nextElementSibling.classList.toggle(\'open\')" style="cursor:pointer;display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;user-select:none">' +
				'<span class="toggle-arrow" style="transition:transform .2s;display:inline-block">▶</span> Scoring Status <span class="badge badge-gray" style="font-size:9px">' + candInts.length + ' interview' + (candInts.length !== 1 ? 's' : '') + '</span></div>' +
				'<div class="score-status-body" style="display:none;margin-top:10px">' + sRows + '</div>' +
				'</div>';
		}
		// Build report card
		return '<div class="report-card" style="' + (elim ? 'opacity:.65' : '') + '">' +
			'<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">' +
				avatar(c.name, 40) +
				'<div style="flex:1">' +
					'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
						'<span style="font-size:15px;font-weight:600">' + esc(c.name) + '</span>' +
						'<span class="badge ' + (idx === 0 ? 'badge-amber' : idx < 3 ? 'badge-teal' : 'badge-gray') + '">#' + (idx + 1) + '</span>' +
						(elim ? '<span class="badge badge-red">Eliminated</span>' : '') +
						(sel ? '<span class="badge badge-green">Selected</span>' : '') +
					'</div>' +
					'<div style="font-size:11px;color:var(--text3)">' + (c.email || '') + '</div>' +
				'</div>' +
				'<div style="text-align:right">' +
					'<div style="font-family:var(--mono);font-size:20px;font-weight:600;color:var(--green)">' + item.best.toFixed(1) + '</div>' +
					'<div style="font-size:10px;color:var(--text3)">best avg</div>' +
				'</div>' +
			'</div>' +
			'<div class="report-positions">' + posScoresHTML + '</div>' +
			scoringStatusHTML +
		'</div>';
	}).join('');
}

function renderPositionReport() {
	const el = document.getElementById('report-positions'); if (!el) return; if (!DB.scores.length) { el.innerHTML = `<div class="empty-state"><p>No scores yet.</p></div>`; return }
	const allPosIds = [...new Set(DB.scores.map(s => s.positionId))];
	const posData = allPosIds.map(posId => { const sc = DB.scores.filter(s => s.positionId === posId); if (!sc.length) return null; const isGeneral = posId === GENERAL_POS_ID; const pos = isGeneral ? { title: 'General Evaluation', status: 'open', id: GENERAL_POS_ID } : DB.positions.find(p => p.id === posId); if (!pos) return null; const ranked = [...new Set(sc.map(s => s.candidateId))].map(cid => { const cs = sc.filter(s => s.candidateId === cid); const validCs = cs.filter(s => !s.ineligible); const avg = validCs.length ? validCs.reduce((a, s) => a + allCriteriaAvg(s), 0) / validCs.length : -1; const inelCount = cs.filter(s => s.ineligible).length; return { cand: DB.candidates.find(c => c.id === cid), avg, inelCount, allIneligible: cs.length > 0 && cs.every(s => s.ineligible), recScore: cs.reduce((a, s) => a + getRecW(s.recommendation), 0), count: cs.length } }).filter(x => x.cand).sort((a, b) => b.avg - a.avg); return { pos, isGeneral, ranked } }).filter(Boolean);
	if (!posData.length) { el.innerHTML = `<div class="empty-state"><p>No positions scored yet.</p></div>`; return }
	el.innerHTML = posData.map(pd => { const sb = pd.isGeneral ? 'badge-teal' : { open: 'badge-green', closed: 'badge-gray', 'on-hold': 'badge-amber' }[pd.pos.status] || 'badge-gray'; return `<div class="report-card"><div style="margin-bottom:14px"><div style="font-size:15px;font-weight:600">${esc(pd.pos.title)}</div><div style="display:flex;gap:6px;margin-top:4px"><span class="badge ${sb}">${pd.isGeneral ? 'general' : pd.pos.status}</span><span class="badge badge-blue">${pd.ranked.length} candidates</span></div></div><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Candidate</th><th>Avg</th><th>Sessions</th><th>Rec</th></tr></thead><tbody>${pd.ranked.map((r, i) => { const applied = !pd.isGeneral && (r.cand.positionIds || []).includes(pd.pos.id); const bc = r.avg >= 7 ? 'var(--green)' : r.avg >= 5 ? 'var(--amber)' : 'var(--red)'; const rb = r.recScore > 0 ? 'badge-green' : r.recScore < 0 ? 'badge-red' : 'badge-gray'; return `<tr><td><span class="badge ${i === 0 ? 'badge-amber' : i < 3 ? 'badge-teal' : 'badge-gray'}">#${i + 1}</span></td><td><div style="display:flex;align-items:center;gap:7px">${avatar(r.cand.name, 24)}<div><div style="font-weight:500;font-size:12px">${esc(r.cand.name)}</div>${!applied && !pd.isGeneral ? '<span class="badge badge-teal" style="font-size:9px">Suggested</span>' : ''}</div></div></td><td><span style="font-family:var(--mono);font-weight:600;color:${bc}">${r.allIneligible ? 'INELIGIBLE' : r.avg.toFixed(1)}</span></td><td>${r.count}${r.inelCount ? ' <span class="badge badge-red" style="font-size:9px">' + r.inelCount + ' inel.</span>' : ''}</td><td><span class="badge ${rb}">${r.recScore > 1 ? 'Strong Hire' : r.recScore > 0 ? 'Hire' : r.recScore === 0 ? 'Neutral' : 'No Hire'}</span></td></tr>` }).join('')}</tbody></table></div></div>` }).join('');
}
function renderMatrixReport() {
	const el = document.getElementById('report-matrix'); if (!el) return; const scoredCands = [...new Set(DB.scores.map(s => s.candidateId))]; const scoredPos = [...new Set(DB.scores.map(s => s.positionId))]; if (!scoredCands.length) { el.innerHTML = `<div class="empty-state"><p>No scores yet.</p></div>`; return }
	const cands = DB.candidates.filter(c => scoredCands.includes(c.id)); const positions = scoredPos.map(pid => pid === GENERAL_POS_ID ? { id: GENERAL_POS_ID, title: 'General' } : DB.positions.find(p => p.id === pid)).filter(Boolean);
	el.innerHTML = `<div class="card"><div class="table-wrap"><table style="table-layout:fixed"><thead><tr><th style="width:150px">Candidate</th>${positions.map(p => `<th style="max-width:110px;overflow:hidden;text-overflow:ellipsis">${esc(p.title)}</th>`).join('')}</tr></thead><tbody>${cands.map(c => { const cells = positions.map(pos => { const sc = DB.scores.filter(s => s.candidateId === c.id && s.positionId === pos.id); if (!sc.length) return '<td style="text-align:center;color:var(--text3)">—</td>'; const avg = sc.reduce((a, s) => a + allCriteriaAvg(s), 0) / sc.length; const col = avg >= 7 ? 'var(--green)' : avg >= 5 ? 'var(--amber)' : 'var(--red)'; const applied = pos.id !== GENERAL_POS_ID && (c.positionIds || []).includes(pos.id); return `<td style="text-align:center"><div style="font-family:var(--mono);font-weight:600;color:${col};font-size:14px">${avg.toFixed(1)}</div><div style="font-size:10px;color:${applied ? 'var(--accent)' : 'var(--teal)'}">${pos.id === GENERAL_POS_ID ? 'General' : applied ? 'Applied' : 'Suggested'}</div></td>` }).join(''); return `<tr><td><div style="display:flex;align-items:center;gap:6px">${avatar(c.name, 22)}<span style="font-size:12px;font-weight:500">${esc(c.name)}</span></div></td>${cells}</tr>` }).join('')}</tbody></table></div></div>`;
}
function renderRejectionReport() {
	const el = document.getElementById('report-rejection'); if (!el) return; const nonSel = DB.candidates.filter(c => getStage(c.id) !== 'selected'); if (!nonSel.length) { el.innerHTML = `<div class="empty-state"><p>No non-selected candidates.</p></div>`; return }
	el.innerHTML = nonSel.map(c => { const elim = c.eliminated; const posNames = (c.positionIds || []).map(pid => { const p = DB.positions.find(x => x.id === pid); return p ? p.title : '' }).filter(Boolean).join(', ') || 'the position'; return `<div class="email-card">${avatar(c.name, 34)}<div style="flex:1;min-width:0"><div style="font-weight:500;font-size:13px">${esc(c.name)}</div><div style="font-size:11px;color:var(--text3)">${c.email || 'No email'}</div><div style="margin-top:4px">${elim ? `<span class="badge badge-red">Screening</span>` : `<span class="badge badge-amber">Interview stage</span>`}</div></div><div style="display:flex;flex-direction:column;gap:7px;align-items:flex-end"><button class="btn btn-ghost btn-sm" data-action="openRejEmail" data-id="${c.id}" data-stage="${elim ? 'screening' : 'interview'}">✉ Email</button><label class="email-sent-check"><input type="checkbox" ${c.rejectionEmailSent ? 'checked' : ''} data-action="toggleRejSent" data-id="${c.id}"> Sent</label></div></div>` }).join('');
}

/* ══ PLACEMENTS ══ */
function renderPlacements() {
	const el = document.getElementById('placements-content'); if (!el) return; if (!DB.positions.length) { el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✦</div><p>No positions defined yet.</p></div>`; return } if (!DB.placements) DB.placements = [];
	el.innerHTML = DB.positions.map(pos => {
		const pl = DB.placements.find(p => p.positionId === pos.id) || { positionId: pos.id, selectedCandidateId: null, offerLetterSent: false }; const scoredIds = [...new Set(DB.scores.filter(s => s.positionId === pos.id).map(s => s.candidateId))]; const applied = DB.candidates.filter(c => (c.positionIds || []).includes(pos.id) && !c.eliminated); const suggested = DB.candidates.filter(c => !(c.positionIds || []).includes(pos.id) && !c.eliminated && scoredIds.includes(c.id)); const all = [...applied, ...suggested]; const sb = { open: 'badge-green', closed: 'badge-gray', 'on-hold': 'badge-amber' }[pos.status] || 'badge-gray';
		return `<div class="placement-card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px"><div><div style="font-size:16px;font-weight:600">${esc(pos.title)}</div><div style="display:flex;gap:6px;margin-top:4px"><span class="badge ${sb}">${pos.status}</span>${pos.dept ? `<span class="badge badge-gray">${esc(pos.dept)}</span>` : ''}${pos.closedForInterviews ? `<span class="badge badge-red">Closed</span>` : ''}</div></div><label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2);cursor:pointer">Close for interviews<label class="toggle-switch danger"><input type="checkbox" ${pos.closedForInterviews ? 'checked' : ''} data-action="togglePosClosedInt" data-id="${pos.id}"><span class="toggle-slider"></span></label></label></div>${!all.length ? `<div style="color:var(--text3);font-size:13px;padding:8px 0">No candidates for this position.</div>` : ''}${all.map(c => { const sc = DB.scores.filter(s => s.candidateId === c.id && s.positionId === pos.id); const avg = sc.length ? sc.reduce((a, s) => a + allCriteriaAvg(s), 0) / sc.length : null; const isApplied = (c.positionIds || []).includes(pos.id); const isSelected = pl.selectedCandidateId === c.id; const bc = avg != null ? (avg >= 7 ? 'var(--green)' : avg >= 5 ? 'var(--amber)' : 'var(--red)') : 'var(--text3)'; return `<div class="placement-candidate-row ${isSelected ? 'is-selected' : ''}">${avatar(c.name, 34)}<div style="flex:1;min-width:0"><div style="font-weight:500;font-size:13px">${esc(c.name)}</div><div style="font-size:11px;color:var(--text3)">${c.email || ''}${c.phone ? ' · ' + esc(c.phone) : ''}</div><div style="display:flex;gap:5px;margin-top:3px;flex-wrap:wrap">${isApplied ? `<span class="badge badge-blue">Applied</span>` : `<span class="badge badge-teal">Suggested</span>`}${avg != null ? `<span style="font-family:var(--mono);font-size:12px;font-weight:600;color:${bc}">${avg.toFixed(1)}/10</span>` : '<span style="font-size:11px;color:var(--text3)">Not scored</span>'}</div></div><div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">${!isSelected ? `<button class="btn btn-ghost btn-sm" data-action="selectForPos" data-posid="${pos.id}" data-candid="${c.id}">☆ Select</button>` : `<span class="badge badge-green">✓ Selected</span><button class="btn btn-danger btn-sm" data-action="deselectForPos" data-posid="${pos.id}">Deselect</button>`}${isSelected ? `<button class="btn btn-primary btn-sm" data-action="openOfferLetter" data-posid="${pos.id}" data-candid="${c.id}">✉ Offer</button><label class="email-sent-check"><input type="checkbox" ${pl.offerLetterSent ? 'checked' : ''} data-action="toggleOfferSent" data-posid="${pos.id}"> Sent</label>` : ''}</div></div>` }).join('')}</div>`;
	}).join('');
}
function selectForPos(posId, candId) { if (!DB.placements) DB.placements = []; const idx = DB.placements.findIndex(p => p.positionId === posId); if (idx >= 0) DB.placements[idx].selectedCandidateId = candId; else DB.placements.push({ positionId: posId, selectedCandidateId: candId, offerLetterSent: false }); persist(); renderPlacements(); tool.notify('Candidate selected', 'success') }
function deselectForPos(posId) { const pl = DB.placements && DB.placements.find(p => p.positionId === posId); if (pl) { pl.selectedCandidateId = null; pl.offerLetterSent = false } persist(); renderPlacements(); tool.notify('Cleared', 'info') }
function openOfferLetter(posId, candId) { const pos = DB.positions.find(x => x.id === posId); const cand = DB.candidates.find(x => x.id === candId); if (!pos || !cand) return; openEmailModal('Offer Letter', cand.email || '', `Job Offer — ${pos.title}`, generateOfferLetter(cand, pos)) }
function toggleOfferSent(posId, val) { const pl = DB.placements && DB.placements.find(p => p.positionId === posId); if (pl) pl.offerLetterSent = val; persist() }
function togglePosClosedInt(posId, val) { const p = DB.positions.find(x => x.id === posId); if (!p) return; p.closedForInterviews = val; persist(); renderPlacements(); renderPositions() }

/* ══ DASHBOARD ══ */
function renderDashboard() {
	const stats = [{ val: DB.positions.filter(p => p.status === 'open').length, label: 'Open Positions', color: 'var(--green)' }, { val: DB.candidates.filter(c => !c.eliminated).length, label: 'Active Candidates', color: 'var(--accent)' }, { val: DB.candidates.filter(c => DB.screenings.some(s => s.candidateId === c.id && s.status === 'advanced')).length, label: 'Advanced', color: 'var(--teal)' }, { val: DB.candidates.filter(c => c.eliminated).length, label: 'Eliminated', color: 'var(--red)' }, { val: (DB.placements || []).filter(p => p.selectedCandidateId).length, label: 'Placed', color: 'var(--amber)' }];
	const statsEl = document.getElementById('dash-stats'); if (statsEl) statsEl.innerHTML = stats.map(s => `<div class="stat-card"><div class="stat-val" style="color:${s.color}">${s.val}</div><div class="stat-label">${s.label}</div></div>`).join('');
	const totalCands = DB.candidates.length; const pipeEl = document.getElementById('dash-pipeline-overview'); if (pipeEl) pipeEl.innerHTML = [{ label: 'Pending Screening', count: DB.candidates.filter(c => getStage(c.id) === 'pending').length, color: 'var(--amber)' }, { label: 'Advanced to Interview', count: DB.candidates.filter(c => getStage(c.id) === 'advanced').length, color: 'var(--teal)' }, { label: 'Selected / Placed', count: DB.candidates.filter(c => getStage(c.id) === 'selected').length, color: 'var(--green)' }].map(s => `<div class="stat-card" style="text-align:center"><div class="stat-val" style="color:${s.color}">${s.count}</div><div class="stat-label">${s.label}</div><div style="height:4px;background:var(--surface3);border-radius:2px;margin-top:8px;overflow:hidden"><div style="height:100%;background:${s.color};border-radius:2px;width:${totalCands ? Math.round(s.count / totalCands * 100) : 0}%"></div></div></div>`).join('');
	const rc = document.getElementById('dash-recent-candidates'); if (rc) { const recent = [...DB.candidates].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 6); rc.innerHTML = recent.length ? recent.map(c => `<div style="display:flex;align-items:center;gap:9px;padding:9px 0;border-bottom:1px solid var(--border)">${avatar(c.name, 30)}<div style="flex:1"><div style="font-weight:500;font-size:13px">${esc(c.name)}</div><div style="font-size:11px;color:var(--text3)">${(c.positionIds || []).length} position(s)${c.source ? ' · ' + esc(c.source) : ''}</div></div><span class="badge badge-gray" style="font-size:9px">${getStage(c.id)}</span><button class="btn btn-ghost btn-sm" data-action="editCand" data-id="${c.id}">View</button></div>`).join('') : `<div style="color:var(--text3);font-size:12px;padding:14px 0">No candidates yet</div>` }
	const today = new Date().toISOString().slice(0, 10); const upcoming = [...DB.interviews].filter(i => i.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6); const ui = document.getElementById('dash-upcoming-interviews'); if (ui) { const defaultUrl = getDefaultMeetingUrl(); const defaultPlatform = getDefaultMeetingPlatform(); ui.innerHTML = upcoming.length ? upcoming.map(int => { const c = DB.candidates.find(x => x.id === int.candidateId); const effectiveUrl = int.meetingUrl || defaultUrl; const effectivePlatform = int.meetingPlatform || defaultPlatform; const isCustom = !!(int.meetingUrl && int.meetingUrl !== defaultUrl); const sBadges = statusBadgesHTML(int); return c ? `<div style="display:flex;align-items:center;gap:9px;padding:9px 0;border-bottom:1px solid var(--border)">${avatar(c.name, 30)}<div style="flex:1"><div style="font-weight:500;font-size:13px">${esc(c.name)}</div><div style="font-size:11px;color:var(--text3)">${fmtDate(int.date)}${effectiveUrl ? ` · <a href="${esc(effectiveUrl)}" target="_blank" style="color:var(--accent)">${effectivePlatform || 'Meeting'}${isCustom ? ' (custom)' : ''}</a>` : ''}</div>${sBadges ? `<div style="margin-top:3px;display:flex;gap:4px">${sBadges}</div>` : ''}</div><button class="btn btn-ghost btn-sm" data-action="goScore" data-id="${int.id}">Score</button></div>` : '' }).join('') : `<div style="color:var(--text3);font-size:12px;padding:14px 0">No upcoming interviews</div>` }
}
function goScore(interviewId) { navigate('scoring'); const el = document.getElementById('score-interview'); if (el) el.value = interviewId; loadScoringForm() }

/* ══ EXCEL IMPORT ══ */
function openImportModal() { document.getElementById('import-modal').classList.add('open'); document.getElementById('import-step-1').style.display = ''; document.getElementById('import-step-2').style.display = 'none'; document.getElementById('import-step-3').style.display = 'none' }
function closeImportModal() { document.getElementById('import-modal').classList.remove('open'); importData = { headers: [], rows: [], mapping: {}, posMapping: {} }; const fi = document.getElementById('excel-file-input'); if (fi) fi.value = '' }
function handleExcelFile(file) {
	if (!file) return; const ext = file.name.split('.').pop().toLowerCase(); const reader = new FileReader();
	if (ext === 'csv') { reader.onload = e => { const lines = e.target.result.split('\n').map(l => l.trim()).filter(Boolean); if (!lines.length) { tool.notify('Empty file', 'error'); return } importData.headers = parseCSVLine(lines[0]); importData.rows = lines.slice(1).map(l => parseCSVLine(l)); showImportStep2() }; reader.readAsText(file) }
	else { reader.onload = e => { try { if (typeof XLSX === 'undefined') { tool.notify('SheetJS not loaded. Try CSV.', 'error'); return } const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]]; const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }); if (!json.length) { tool.notify('Empty sheet', 'error'); return } importData.headers = json[0].map(String); importData.rows = json.slice(1).filter(r => r.some(c => String(c).trim())); showImportStep2() } catch (err) { tool.notify('Could not read file. Try CSV.', 'error') } }; reader.readAsArrayBuffer(file) }
}
function parseCSVLine(line) { const result = []; let cur = ''; let inQ = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { inQ = !inQ } else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = '' } else cur += ch } result.push(cur.trim()); return result }
function showImportStep2() {
	document.getElementById('import-step-1').style.display = 'none'; document.getElementById('import-step-2').style.display = ''; importData.mapping = {};
	importData.headers.forEach((h, i) => { const hl = h.toLowerCase(); if (hl.includes('name') && !hl.includes('position') && !hl.includes('job')) importData.mapping[i] = 'name'; else if (hl.includes('email')) importData.mapping[i] = 'email'; else if (hl.includes('phone') || hl.includes('mobile')) importData.mapping[i] = 'phone'; else if (hl.includes('source') || hl.includes('via')) importData.mapping[i] = 'source'; else if (hl.includes('resume') || hl.includes('cv') || hl.includes('url')) importData.mapping[i] = 'resume'; else if (hl.includes('position') || hl.includes('job') || hl.includes('role')) importData.mapping[i] = 'position'; else if (hl.includes('note')) importData.mapping[i] = 'notes'; else importData.mapping[i] = '_skip' });
	renderColumnMapper(); renderImportPreview(); document.getElementById('import-row-count').textContent = `${importData.rows.length} rows detected`; buildPosMatchSection();
}
function renderColumnMapper() { const el = document.getElementById('column-mapper'); if (!el) return; el.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Your Column</div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Maps to</div></div>` + importData.headers.map((h, i) => `<div class="column-map-row"><div class="column-map-label" title="${esc(h)}">${esc(h)}</div><div style="text-align:center;color:var(--text3)">→</div><select data-col="${i}" class="col-map-select" style="font-size:12px;padding:5px 8px">${FIELD_MAP_OPTIONS.map(o => `<option value="${o.key}" ${importData.mapping[i] === o.key ? 'selected' : ''}>${o.label}</option>`).join('')}</select></div>`).join('') }
function renderImportPreview() { const tbl = document.getElementById('import-preview-table'); if (!tbl) return; tbl.innerHTML = `<thead><tr>${importData.headers.map(h => `<th style="padding:6px 10px;border-bottom:1px solid var(--border);white-space:nowrap">${esc(h)}</th>`).join('')}</tr></thead><tbody>${importData.rows.slice(0, 5).map(row => `<tr>${row.map(cell => `<td style="padding:6px 10px;border-bottom:1px solid var(--border);white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis">${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody>` }
function buildPosMatchSection() {
	const posColIdx = parseInt(Object.entries(importData.mapping).find(([, v]) => v === 'position')?.[0] ?? '-1'); const sec = document.getElementById('import-pos-match-section'); if (posColIdx < 0) { if (sec) sec.style.display = 'none'; return }
	const uniquePosCells = [...new Set(importData.rows.map(r => (r[posColIdx] || '').trim()).filter(Boolean))]; if (!uniquePosCells.length) { if (sec) sec.style.display = 'none'; return }
	importData.posMapping = {}; if (sec) sec.style.display = ''; const pml = document.getElementById('import-pos-match-list'); if (!pml) return;
	pml.innerHTML = uniquePosCells.map(posCell => { const match = DB.positions.find(p => normalizeName(p.title) === normalizeName(posCell)); const matchId = match ? match.id : ''; importData.posMapping[posCell] = matchId; return `<div class="pos-match-row"><div style="font-size:12px;font-weight:500;font-family:var(--mono)">${esc(posCell)}</div><div style="text-align:center;color:var(--text3)">→</div><select data-pos-cell="${esc(posCell)}" class="pos-map-select" style="font-size:12px;padding:5px 8px"><option value="">— Don't assign —</option>${DB.positions.map(p => `<option value="${p.id}" ${p.id === matchId ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}<option value="__new__">+ Create: "${esc(posCell)}"</option></select></div>` }).join('');
}
function confirmImport() {
	document.querySelectorAll('.col-map-select').forEach(sel => { importData.mapping[parseInt(sel.dataset.col)] = sel.value });
	document.querySelectorAll('.pos-map-select').forEach(sel => { const cell = sel.getAttribute('data-pos-cell'); if (!cell) return; let val = sel.value; if (val === '__new__') { const np = { id: genId(), title: cell, dept: '', desc: '', status: 'open', extraCriteria: [], closedForInterviews: false, createdAt: new Date().toISOString() }; DB.positions.push(np); val = np.id } importData.posMapping[cell] = val });
	const posColIdx = parseInt(Object.entries(importData.mapping).find(([, v]) => v === 'position')?.[0] ?? '-1'); const grouped = new Map();
	importData.rows.forEach(row => { const obj = {}; importData.headers.forEach((_, i) => { const field = importData.mapping[i]; if (field && field !== '_skip' && field !== 'position') obj[field] = (row[i] || '').trim() }); if (!obj.name && !obj.email) return; const posVal = posColIdx >= 0 ? (row[posColIdx] || '').trim() : ''; const key = (normalizeEmail(obj.email) || '') + '||' + normalizeName(obj.name || ''); if (!grouped.has(key)) grouped.set(key, { fields: obj, positionValues: posVal ? [posVal] : [] }); else { const ex = grouped.get(key); Object.keys(obj).forEach(k => { if (obj[k] && !ex.fields[k]) ex.fields[k] = obj[k] }); if (posVal && !ex.positionValues.includes(posVal)) ex.positionValues.push(posVal) } });
	const results = [];
	grouped.forEach(({ fields, positionValues }) => {
		if (!fields.name) { results.push({ status: 'skipped', reason: 'No name', name: '?' }); return }
		const newPosIds = positionValues.map(pv => importData.posMapping[pv] || '').filter(Boolean); const existing = findExistingForImport(fields.name, fields.email || '');
		if (existing) { let merged = false; if (fields.phone && !existing.phone) { existing.phone = fields.phone; merged = true } if (fields.source && !existing.source) { existing.source = fields.source; merged = true } if (fields.resume && !existing.resume) { existing.resume = fields.resume; merged = true } if (fields.notes && !existing.notes) { existing.notes = fields.notes; merged = true } newPosIds.forEach(pid => { if (!(existing.positionIds || []).includes(pid)) { if (!existing.positionIds) existing.positionIds = []; existing.positionIds.push(pid); merged = true } }); results.push({ status: 'merged', name: existing.name, detail: merged ? `Merged; added ${newPosIds.length} position(s)` : 'Already up to date' }) }
		else { DB.candidates.push({ id: genId(), name: fields.name, email: fields.email || '', phone: fields.phone || '', source: fields.source || '', resume: fields.resume || '', notes: fields.notes || '', positionIds: newPosIds, createdAt: new Date().toISOString() }); results.push({ status: 'ok', name: fields.name, detail: `Added${newPosIds.length ? ' with ' + newPosIds.length + ' position(s)' : ''}` }) }
	});
	persist(); showImportResults(results);
}
function showImportResults(results) {
	document.getElementById('import-step-2').style.display = 'none'; document.getElementById('import-step-3').style.display = ''; const ok = results.filter(r => r.status === 'ok').length; const merged = results.filter(r => r.status === 'merged').length; const skipped = results.filter(r => r.status === 'skipped').length; const rc = document.getElementById('import-results-content'); if (!rc) return;
	rc.innerHTML = `<div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">${ok ? `<span class="badge badge-green" style="font-size:12px;padding:5px 12px">✓ ${ok} imported</span>` : ''} ${merged ? `<span class="badge badge-teal" style="font-size:12px;padding:5px 12px">⟳ ${merged} merged</span>` : ''} ${skipped ? `<span class="badge badge-gray" style="font-size:12px;padding:5px 12px">— ${skipped} skipped</span>` : ''}</div><div style="max-height:320px;overflow-y:auto">${results.map(r => `<div class="import-result-row ${r.status}"><span style="font-weight:500">${esc(r.name)}</span><span style="opacity:.8">${esc(r.detail || r.reason || '')}</span></div>`).join('')}</div>`;
}

/* ══════════════════════════════════════════
/* ══ CANDIDATE PRINT VIEW ══ */
function renderCandidatePrintPage() {
	const sel = document.getElementById('cp-candidate-select');
	if (sel) {
		const cur = sel.value;
		const candsWithInts = [...new Set(DB.interviews.map(i => i.candidateId))];
		const opts = candsWithInts.map(cid => {
			const c = DB.candidates.find(x => x.id === cid);
			return c ? '<option value="' + cid + '" ' + (cid === cur ? 'selected' : '') + '>' + esc(c.name) + '</option>' : '';
		}).join('');
		sel.innerHTML = '<option value="">Select a candidate with scheduled interview...</option>' + opts;
		if (cur) sel.value = cur;
	}
	renderCandidateCard();
}
function renderCandidateCard() {
	const cid = document.getElementById('cp-candidate-select')?.value;
	const container = document.getElementById('cp-card-container');
	if (!container) return;
	if (!cid) { container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🖹</div><p>Select a candidate to view their interview card.</p></div>'; tool.resize(); return }
	const c = DB.candidates.find(x => x.id === cid);
	if (!c) { container.innerHTML = '<div class="empty-state"><p>Candidate not found.</p></div>'; tool.resize(); return }
	const ints = DB.interviews.filter(i => i.candidateId === cid).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
	if (!ints.length) { container.innerHTML = '<div class="empty-state"><p>No interviews scheduled for this candidate.</p></div>'; tool.resize(); return }
	const defaultUrl = getDefaultMeetingUrl();
	const defaultPlatform = getDefaultMeetingPlatform();
	const coName = companyName();
	container.innerHTML = ints.map(int => {
		const ivrIds = (int.interviewerIds || [int.interviewerId]).filter(Boolean);
		const ivrs = ivrIds.map(id => DB.interviewers.find(x => x.id === id)).filter(Boolean);
		const ivrNames = ivrs.map(i => i.name).join(', ') || 'TBD';
		const pos = DB.positions.find(p => (c.positionIds || []).includes(p.id));
		const dateObj = int.scheduledTime ? new Date(int.scheduledTime) : new Date(int.date + 'T09:00:00');
		const endObj = new Date(dateObj.getTime() + (int.durationMin || 60) * 60000);
		const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
		const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
		const endStr = endObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
		const effectiveUrl = int.meetingUrl || defaultUrl;
		const effectivePlatform = int.meetingPlatform || defaultPlatform;
		return '<div class="cp-card">' +
			'<div class="cp-card-header">' +
				'<div class="cp-logo">' + esc(coName) + '</div>' +
				'<div class="cp-label">INTERVIEW CONFIRMATION</div>' +
			'</div>' +
			'<div class="cp-body">' +
				'<div class="cp-greeting">Dear <strong>' + esc(c.name) + '</strong>,</div>' +
				'<p class="cp-intro">We are pleased to confirm your interview' + (pos ? ' for the <strong>' + esc(pos.title) + '</strong> position' : '') + '.</p>' +
				'<div class="cp-details">' +
					'<div class="cp-detail-row"><span class="cp-detail-icon">📅</span><div><span class="cp-detail-label">Date</span><span class="cp-detail-value">' + dateStr + '</span></div></div>' +
					'<div class="cp-detail-row"><span class="cp-detail-icon">⏰</span><div><span class="cp-detail-label">Time</span><span class="cp-detail-value">' + timeStr + ' – ' + endStr + ' (' + (int.durationMin || 60) + ' minutes)</span></div></div>' +
					'<div class="cp-detail-row"><span class="cp-detail-icon">👤</span><div><span class="cp-detail-label">Interviewer' + (ivrs.length > 1 ? 's' : '') + '</span><span class="cp-detail-value">' + esc(ivrNames) + '</span></div></div>' +
					(effectiveUrl ? '<div class="cp-detail-row"><span class="cp-detail-icon">🔗</span><div><span class="cp-detail-label">' + (effectivePlatform || 'Meeting') + ' Link</span><span class="cp-detail-value"><a href="' + esc(effectiveUrl) + '" target="_blank" style="color:var(--accent)">' + esc(effectiveUrl) + '</a></span></div></div>' : '') +
					(pos ? '<div class="cp-detail-row"><span class="cp-detail-icon">📋</span><div><span class="cp-detail-label">Position</span><span class="cp-detail-value">' + esc(pos.title) + (pos.dept ? ' — ' + esc(pos.dept) : '') + '</span></div></div>' : '') +
				'</div>' +
				'<div class="cp-footer-note">Please confirm your attendance at your earliest convenience. If you have any questions, do not hesitate to contact us.</div>' +
			'</div>' +
			'<div class="cp-card-footer">' + esc(coName) + ' · Interview Confirmation · ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</div>' +
		'</div>';
	}).join('');
	tool.resize();
}
function printCandidateCard() {
	const container = document.getElementById('cp-card-container');
	if (!container || !container.innerHTML.trim()) { tool.notify('Select a candidate first', 'warning'); return }
	const printWin = window.open('', '_blank', 'width=800,height=600');
	if (!printWin) { tool.notify('Popup blocked. Allow popups for printing.', 'warning'); return }
	const coName = companyName();
	printWin.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Interview Card</title>' +
		'<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#fff;color:#1a1d26;padding:16px;display:flex;justify-content:center}.cp-card{border:2px solid #3d5cff;border-radius:10px;overflow:hidden;max-width:380px;box-shadow:0 2px 12px rgba(0,0,0,.1);page-break-inside:avoid}.cp-card-header{background:#3d5cff;color:#fff;padding:14px 18px;text-align:center}.cp-logo{font-size:17px;font-weight:700}.cp-label{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;opacity:.85;margin-top:3px}.cp-body{padding:14px 16px}.cp-greeting{font-size:13px;margin-bottom:8px;line-height:1.5}.cp-intro{font-size:11px;color:#5a6070;line-height:1.5;margin-bottom:12px}.cp-details{background:#f4f5f7;border-radius:6px;padding:10px 12px}.cp-detail-row{display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid #dde0e8}.cp-detail-row:last-child{border-bottom:none}.cp-detail-icon{font-size:16px;width:22px;text-align:center}.cp-detail-label{display:block;font-size:8px;color:#9399aa;text-transform:uppercase;margin-bottom:1px}.cp-detail-value{font-size:12px;font-weight:500;word-break:break-all}.cp-footer-note{margin-top:10px;font-size:10px;color:#9399aa;text-align:center}.cp-card-footer{background:#f0f1f4;padding:8px 16px;text-align:center;font-size:9px;color:#9399aa;text-transform:uppercase}@media print{body{padding:0}.cp-card{border:none;box-shadow:none;max-width:100%}}</style></head><body>' +
		container.innerHTML + '</body></html>');
	printWin.document.close();
	setTimeout(() => printWin.print(), 500);
}
async function copyCandidateCardAsImage() {
	const container = document.getElementById('cp-card-container');
	if (!container || !container.querySelector('.cp-card')) { tool.notify('Select a candidate first', 'warning'); return }
	try {
		// Use html2canvas if available, otherwise use a simpler approach
		if (typeof html2canvas !== 'undefined') {
			const card = container.querySelector('.cp-card');
			const canvas = await html2canvas(card, { backgroundColor: '#ffffff', scale: 2, width: card.offsetWidth, height: card.offsetHeight });
			const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
			tool.notify('Card copied as image! Paste into WhatsApp', 'success');
		} else {
			// Fallback: open print-friendly window for screenshot
			const card = container.querySelector('.cp-card');
			const clone = card.cloneNode(true);
			const win = window.open('', '_blank', 'width=700,height=500');
			win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:system-ui;padding:16px;background:#fff;display:flex;justify-content:center}.cp-card{border:2px solid #3d5cff;border-radius:10px;overflow:hidden;max-width:380px;box-shadow:0 2px 12px rgba(0,0,0,.1)}.cp-card-header{background:#3d5cff;color:#fff;padding:14px 18px;text-align:center}.cp-logo{font-size:17px;font-weight:700}.cp-label{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;opacity:.85;margin-top:3px}.cp-body{padding:14px 16px}.cp-greeting{font-size:13px;margin-bottom:8px}.cp-intro{font-size:11px;color:#5a6070;margin-bottom:12px}.cp-details{background:#f4f5f7;border-radius:6px;padding:10px 12px}.cp-detail-row{display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid #dde0e8}.cp-detail-row:last-child{border-bottom:none}.cp-detail-icon{font-size:16px;width:22px;text-align:center}.cp-detail-label{display:block;font-size:8px;color:#9399aa;text-transform:uppercase;margin-bottom:1px}.cp-detail-value{font-size:12px;font-weight:500;word-break:break-all}.cp-footer-note{margin-top:10px;font-size:10px;color:#9399aa;text-align:center}.cp-card-footer{background:#f0f1f4;padding:8px 16px;text-align:center;font-size:9px;color:#9399aa}</style></head><body>');
			win.document.body.appendChild(clone);
			win.document.close();
			tool.notify('Card opened for screenshot. Use Win+Shift+S or Cmd+Shift+4', 'info');
		}
	} catch(e) {
		tool.notify('Copy failed: ' + e.message, 'error');
	}
}
function generateWhatsAppMessage() {
	const cid = document.getElementById('cp-candidate-select')?.value;
	if (!cid) { tool.notify('Select a candidate first', 'warning'); return ''; }
	const c = DB.candidates.find(x => x.id === cid);
	if (!c) return '';
	const ints = DB.interviews.filter(i => i.candidateId === cid).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
	if (!ints.length) { tool.notify('No interviews for this candidate', 'warning'); return ''; }
	const int = ints[0];
	const ivrIds = (int.interviewerIds || [int.interviewerId]).filter(Boolean);
	const ivrs = ivrIds.map(id => DB.interviewers.find(x => x.id === id)).filter(Boolean);
	const ivrNames = ivrs.map(i => i.name).join(', ') || 'TBD';
	const pos = DB.positions.find(p => (c.positionIds || []).includes(p.id));
	const posName = pos ? pos.title : 'the position';
	const coName = companyName();
	const dateObj = int.scheduledTime ? new Date(int.scheduledTime) : new Date(int.date + 'T09:00:00');
	const endObj = new Date(dateObj.getTime() + (int.durationMin || 60) * 60000);
	const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
	const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
	const endStr = endObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
	const effectiveUrl = int.meetingUrl || getDefaultMeetingUrl();
	const effectivePlatform = int.meetingPlatform || getDefaultMeetingPlatform();
	let msg = '';
	msg += '\uD83C\uDF1F *INTERVIEW CONFIRMATION* \uD83C\uDF1F\n\n';
	msg += 'Dear *' + c.name + '*,\n\n';
	msg += 'We are pleased to confirm your interview for the *' + posName + '* position at *' + coName + '*.\n\n';
	msg += '\uD83D\uDCC5 *Date:* ' + dateStr + '\n';
	msg += '\u23F0 *Time:* ' + timeStr + ' \u2013 ' + endStr + ' (' + (int.durationMin || 60) + ' min)\n';
	msg += '\uD83D\uDC64 *Interviewer' + (ivrs.length > 1 ? 's' : '') + ':* ' + ivrNames + '\n';
	if (effectiveUrl) msg += '\uD83D\uDD17 *' + (effectivePlatform || 'Meeting') + ' Link:* ' + effectiveUrl + '\n';
	msg += '\nPlease confirm your attendance at your earliest convenience. Let us know if you have any questions!\n\n';
	msg += 'Best regards,\n';
	msg += '*' + coName + '* HR Team';
	return msg;
}
function copyWhatsAppMessage() {
	const msg = generateWhatsAppMessage();
	if (!msg) return;
	if (navigator.clipboard?.writeText) {
		navigator.clipboard.writeText(msg).then(function() { tool.notify('WhatsApp message copied! Paste into chat', 'success'); });
	} else {
		const ta = document.createElement('textarea'); ta.value = msg; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); tool.notify('WhatsApp message copied!', 'success'); } catch(e) { tool.notify('Copy failed', 'error'); } document.body.removeChild(ta);
	}
}


/* ══════════════════════════════════════════
   EVENT DELEGATION
══════════════════════════════════════════ */
document.addEventListener('click', e => {
	if (e.target.classList.contains('drawer-overlay')) { ['pos', 'ivr', 'cand', 'sched'].forEach(id => { if (e.target.id === id + '-drawer-overlay') closeDrawer(id) }); return }
	const t = e.target.closest('[data-action]');
	if (t) {
		const a = t.dataset.action, id = t.dataset.id;
		if (a === 'editPos') openPositionDrawer(id); if (a === 'delPos') deletePosition(id);
		if (a === 'editIvr') openInterviewerDrawer(id); if (a === 'delIvr') deleteInterviewer(id);
		if (a === 'editCand') openCandidateDrawer(id); if (a === 'delCand') deleteCandidate(id);
		if (a === 'toggleCandPos') toggleCandPos(id);
		if (a === 'rmCandPos') { selectedCandPositions = selectedCandPositions.filter(x => x !== id); renderCandPosDisplay(); buildCandPosDropdownItems() }
		if (a === 'rmCriterion') removePosCriterion(parseInt(t.dataset.ci)); if (a === 'rmSlot') removeIvrSlot(parseInt(t.dataset.si));
		if (a === 'advanceCandidate') advanceCandidate(id); if (a === 'unadvanceCandidate') unadvanceCandidate(id); if (a === 'eliminateCandidate') eliminateCandidate(id); if (a === 'reinstateCandidate') reinstateCandidate(id);
		if (a === 'sendRejScreening') sendRejScreening(id); if (a === 'previewResume') openResumePreview(t.dataset.url);
		if (a === 'goScore') goScore(id); if (a === 'reloadScoringForm') reloadScoringFormWithNewPos();
		if (a === 'submitScore') submitScore(t.dataset.int, t.dataset.ivr); if (a === 'deleteScore') deleteScore(t.dataset.int, t.dataset.ivr);
		if (a === 'selectForPos') selectForPos(t.dataset.posid, t.dataset.candid); if (a === 'deselectForPos') deselectForPos(t.dataset.posid); if (a === 'openOfferLetter') openOfferLetter(t.dataset.posid, t.dataset.candid);
		if (a === 'openRejEmail') { const c = DB.candidates.find(x => x.id === id); if (c) { const pn = (c.positionIds || []).map(pid => { const p = DB.positions.find(x => x.id === pid); return p ? p.title : '' }).filter(Boolean).join(', ') || 'the position'; openEmailModal('Rejection Email', c.email || '', `Your Application — ${pn}`, generateRejectionEmail(c, pn)) } }
		if (a === 'sendInviteEmail') sendInviteEmail(id); if (a === 'sendInviteFromCal') sendInviteFromCal(id);
		if (a === 'openIntDetail') openInterviewDetail(id || null);
		if (a === 'navImport') openImportModal();
		if (a === 'toggleSchedIvr') toggleSchedIvr(id); if (a === 'rmSchedIvr') { selectedSchedInterviewers = selectedSchedInterviewers.filter(x => x !== id); renderSchedIvrDisplay(); buildSchedIvrDropdown() }
		if (a === 'toggleIntDetailIvr') toggleIntDetailIvr(id); if (a === 'rmIntDetailIvr') { selectedIntDetailIvrs = selectedIntDetailIvrs.filter(x => x !== id); renderIntDetailIvrDisplay(); buildIntDetailIvrDropdown() }
		if (a === 'togglePosClosedInt') { const p = DB.positions.find(x => x.id === id); if (p) { p.closedForInterviews = t.checked; persist(); renderPlacements(); renderPositions() } }
		if (a === 'toggleOfferSent') toggleOfferSent(t.dataset.posid, t.checked);
		if (a === 'toggleRejSent') { const c = DB.candidates.find(x => x.id === id); if (c) { c.rejectionEmailSent = t.checked; persist(); tool.notify(t.checked ? 'Marked sent' : 'Unmarked', 'info') } }
		if (a === 'toggleIneligible') { updateScoreAvg(); }
		return;
	}
	const navItem = e.target.closest('.nav-item[data-page]'); if (navItem) { navigate(navItem.dataset.page); return }
	const calTabEl = e.target.closest('[data-cal-tab]'); if (calTabEl) { switchCalTab(calTabEl.dataset.calTab); return }
	const tabEl = e.target.closest('.tab[data-tab]'); if (tabEl) { switchReportTab(tabEl.dataset.tab, tabEl); return }
	if (e.target.closest('#cand-positions-display')) { document.getElementById('cand-positions-dropdown').classList.toggle('open'); return }
	if (e.target.closest('#sched-interviewers-display')) { document.getElementById('sched-interviewers-dropdown').classList.toggle('open'); return }
	if (e.target.closest('#int-d-ivr-display')) { document.getElementById('int-d-ivr-dropdown').classList.toggle('open'); return }
	if (!e.target.closest('.dropdown-wrap')) document.querySelectorAll('.dropdown-list').forEach(d => d.classList.remove('open'));
});

document.addEventListener('click', e => {
	const t = e.target;
	if (t.id === 'add-position-btn') openPositionDrawer(null); if (t.id === 'pos-save-btn') savePosition(); if (t.id === 'pos-drawer-close' || t.id === 'pos-drawer-cancel') closePositionDrawer(); if (t.id === 'pos-add-criterion-btn') addPosCriterion();
	if (t.id === 'add-interviewer-btn') openInterviewerDrawer(null); if (t.id === 'ivr-save-btn') saveInterviewer(); if (t.id === 'ivr-drawer-close' || t.id === 'ivr-drawer-cancel') closeInterviewerDrawer(); if (t.id === 'ivr-add-slot-btn') addIvrSlot();
	if (t.id === 'add-candidate-btn') openCandidateDrawer(null); if (t.id === 'cand-save-btn') saveCandidate(); if (t.id === 'cand-drawer-close' || t.id === 'cand-drawer-cancel') closeCandidateDrawer(); if (t.id === 'cand-preview-resume-btn') openResumePreview(document.getElementById('cand-resume')?.value);
	if (t.id === 'open-scheduler-form-btn') openSchedulerDrawer(); if (t.id === 'auto-schedule-btn') autoSchedule(); if (t.id === 'sched-drawer-close' || t.id === 'sched-drawer-cancel') closeSchedulerDrawer();
	if (t.id === 'confirm-schedule-btn') confirmAllSchedule(); if (t.id === 'clear-schedule-btn') openConfirm('Clear Schedule', 'Remove all pending slots?', () => { scheduleSlots = []; renderSchedulePage(); tool.notify('Cleared', 'info') }, 'Clear');
	if (t.id === 'confirm-cancel-btn') closeConfirm(); if (t.id === 'confirm-ok-btn') { if (confirmCallback) confirmCallback(); closeConfirm() }
	if (t.id === 'resume-modal-close') closeResumeModal(); if (t.id === 'email-modal-close' || t.id === 'email-modal-close2') closeEmailModal(); if (t.id === 'email-copy-btn') copyEmailToClipboard();
	if (t.id === 'elim-cancel-btn') closeElimModal(); if (t.id === 'elim-ok-btn') { const r = document.getElementById('elim-reason').value.trim(); if (!r) { tool.notify('Provide a reason', 'warning'); return } if (elimCallback) elimCallback(r); closeElimModal() }
	if (t.id === 'dup-cancel-btn') closeDupConfirm(); if (t.id === 'dup-proceed-btn') { if (dupProceedCallback) dupProceedCallback(); closeDupConfirm() }
	if (t.id === 'dup-warning-dismiss') hideDupWarning();
	if (t.id === 'int-detail-close' || t.id === 'int-d-cancel-btn') closeInterviewDetail(); if (t.id === 'int-d-save-btn') saveInterviewDetail(); if (t.id === 'int-d-delete-btn') deleteInterviewFromDetail(); if (t.id === 'int-d-score-btn') goScoreFromDetail();
	if (t.id === 'add-interview-btn') openInterviewDetail(null);
	if (t.id === 'theme-toggle') toggleTheme();
	if (t.id === 'open-import-btn') openImportModal(); if (t.id === 'import-modal-close') closeImportModal(); if (t.id === 'import-back-btn') { document.getElementById('import-step-1').style.display = ''; document.getElementById('import-step-2').style.display = 'none' }
	if (t.id === 'import-confirm-btn') confirmImport(); if (t.id === 'import-done-btn') { closeImportModal(); renderCandidates(); navigate('candidates') }
	if (t.id === 'excel-browse-btn') document.getElementById('excel-file-input').click();
	if (t.id === 'screen-bulk-advance-btn') bulkScreenAdvance(); if (t.id === 'screen-bulk-elim-btn') bulkScreenEliminate();
	if (t.id === 'settings-save-btn') saveSettings(); if (t.id === 'cp-candidate-select') renderCandidateCard(); if (t.id === 'cp-print-btn') printCandidateCard(); if (t.id === 'cp-copy-img-btn') copyCandidateCardAsImage(); if (t.id === 'cp-copy-wa-btn') copyWhatsAppMessage();
	if (t.id === 'cal-prev-btn') calNavPrev(); if (t.id === 'cal-next-btn') calNavNext(); if (t.id === 'cal-today-btn') calNavToday();
	if (t.id === 'bulk-advance-btn') { const ids = [...checkedCandIds]; const toAdv = ids.filter(id => { const c = DB.candidates.find(x => x.id === id); return c && !c.eliminated && !DB.screenings.some(s => s.candidateId === id && s.status === 'advanced') }); toAdv.forEach(id => { DB.screenings.push({ candidateId: id, status: 'advanced', date: new Date().toISOString() }) }); checkedCandIds.clear(); persist(); renderCandidates(); tool.notify(`${toAdv.length} advanced`, 'success') }
	if (t.id === 'bulk-eliminate-btn') { const ids = [...checkedCandIds].filter(id => { const c = DB.candidates.find(x => x.id === id); return c && !c.eliminated }); if (!ids.length) { tool.notify('No active candidates selected', 'warning'); return } openElimModal(`Eliminating ${ids.length} candidates:`, (reason) => { ids.forEach(id => { const c = DB.candidates.find(x => x.id === id); if (c) { c.eliminated = true; c.eliminationReason = reason; c.eliminationStage = 'screening'; c.eliminationDate = new Date().toISOString() } }); checkedCandIds.clear(); persist(); renderCandidates(); tool.notify(`${ids.length} eliminated`, 'warning') }) }
	if (t.id === 'bulk-clear-btn') { checkedCandIds.clear(); renderCandidates() }
	if (t.id === 'select-all-cands') { document.querySelectorAll('.cand-check').forEach(cb => { cb.checked = t.checked; if (t.checked) checkedCandIds.add(cb.dataset.id); else checkedCandIds.delete(cb.dataset.id) }); updateBulkBar() }
	// Candidate filter buttons in interview detail modal
	if (t.dataset.candFilter) { intDetailCandFilter = t.dataset.candFilter; document.querySelectorAll('[data-cand-filter]').forEach(b => b.classList.toggle('btn-primary', b.dataset.candFilter === intDetailCandFilter)); document.querySelectorAll('[data-cand-filter]').forEach(b => b.classList.toggle('btn-ghost', b.dataset.candFilter !== intDetailCandFilter)); rebuildIntDetailCandDropdown(document.getElementById('int-d-candidate')?.value || '') }
});

document.addEventListener('change', e => {
	const t = e.target;
	if (t.id === 'score-interview' || t.id === 'score-interviewer') loadScoringForm(); if (t.id === 'score-position' || t.dataset.action === 'reloadScoringForm') reloadScoringFormWithNewPos();
	if (t.id === 'screen-filter-pos' || t.id === 'screen-filter-status') renderScreening(); if (t.id === 'pipeline-pos-filter') renderPipeline(); if (t.id === 'sched-pos-filter') renderSchedCandidatesPreview();
	if (t.id === 'cand-filter-status' || t.id === 'cand-filter-pos') renderCandidates(); if (t.id === 'pos-filter-status') renderPositions(); if (t.id === 'ivr-search') renderInterviewers();
	if (t.id === 'cal-ivr-filter') { calIvrFilter = t.value; renderCalendar() } if (t.id === 'report-rec-filter' || t.id === 'report-elig-filter') renderCandidateReport();
	if (t.classList.contains('cand-check')) { if (t.checked) checkedCandIds.add(t.dataset.id); else checkedCandIds.delete(t.dataset.id); updateBulkBar() }
	if (t.classList.contains('screen-check')) { if (t.checked) checkedScreenIds.add(t.dataset.id); else checkedScreenIds.delete(t.dataset.id) }
	if (t.id === 'excel-file-input') handleExcelFile(t.files[0]);
	if (t.classList.contains('col-map-select')) { importData.mapping[parseInt(t.dataset.col)] = t.value; if (t.value === 'position') buildPosMatchSection(); else if (!Object.values(importData.mapping).includes('position')) { const s = document.getElementById('import-pos-match-section'); if (s) s.style.display = 'none' } }
	if (t.classList.contains('pos-map-select')) { const cell = t.getAttribute('data-pos-cell'); if (!cell) return; let val = t.value; if (val === '__new__') { const np = { id: genId(), title: cell, dept: '', desc: '', status: 'open', extraCriteria: [], closedForInterviews: false, createdAt: new Date().toISOString() }; DB.positions.push(np); val = np.id; t.value = val; persist() } importData.posMapping[cell] = val }
	if (t.dataset.si !== undefined && t.dataset.field) { const si = parseInt(t.dataset.si); if (!isNaN(si) && ivrSlotsBuffer[si]) ivrSlotsBuffer[si][t.dataset.field] = t.value }
	if (['int-d-candidate', 'int-d-date', 'int-d-time', 'int-d-duration'].includes(t.id)) { checkIntDetailConflict(); updateIntDetailEndLabel() }
});

document.addEventListener('input', e => {
	const t = e.target;
	if (t.closest('#scoring-form-container')) updateScoreAvg(); if (t.id === 'cand-search') renderCandidates(); if (t.id === 'screen-search') renderScreening(); if (t.id === 'pipeline-search') renderPipeline(); if (t.id === 'ivr-search') renderInterviewers(); if (t.id === 'pos-search') renderPositions(); if (t.id === 'cand-name' || t.id === 'cand-email') checkDupOnInput();
	if (t.dataset.ci !== undefined && t.dataset.field) { const ci = parseInt(t.dataset.ci), field = t.dataset.field; if (!isNaN(ci) && field && posCriteriaBuffer[ci]) posCriteriaBuffer[ci][field] = t.value }
	if (['int-d-date', 'int-d-time', 'int-d-duration'].includes(t.id)) updateIntDetailEndLabel();
});

document.addEventListener('keydown', e => {
	if (e.key === 'Escape') { ['sched', 'cand', 'ivr', 'pos'].forEach(id => { const d = document.getElementById(id + '-drawer'); if (d && d.classList.contains('open')) closeDrawer(id) }); closeConfirm(); closeElimModal(); closeDupConfirm(); closeEmailModal(); closeResumeModal(); closeInterviewDetail() }
});

document.addEventListener('dragover', e => { if (document.getElementById('excel-drop-zone')) e.preventDefault() });
document.addEventListener('drop', e => { const dz = document.getElementById('excel-drop-zone'); if (!dz) return; e.preventDefault(); dz.classList.remove('dragover'); const file = e.dataTransfer?.files[0]; if (file) handleExcelFile(file) });
document.addEventListener('dragenter', e => { const dz = document.getElementById('excel-drop-zone'); if (dz) dz.classList.add('dragover') });
document.addEventListener('dragleave', e => { const dz = document.getElementById('excel-drop-zone'); if (dz) dz.classList.remove('dragover') });

(function () { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; document.head.appendChild(s);
// Try loading html2canvas for copy-as-image feature
const h2c = document.createElement('script'); h2c.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; document.head.appendChild(h2c) })();

tool.onReady((val, fields) => {
	tool.declareOutput({ type: 'object', properties: { positions: { type: 'array' }, interviewers: { type: 'array' }, candidates: { type: 'array' }, interviews: { type: 'array' }, scores: { type: 'array' }, screenings: { type: 'array' }, placements: { type: 'array' }, settings: { type: 'object' }, _theme: { type: 'string' } } });
	tool.declareParams([{ name: 'companyName', label: 'Company Name', type: 'string', default: 'Our Company', hint: 'Fallback company name for emails' }]);
	render(val, fields); if (tool.isReadOnly()) lockUI(true); tool.onValueChange(v => render(v)); tool.onFieldsChange(f => syncFields(f)); tool.onReadonlyChange(ro => lockUI(ro));
	switchCalTab('list'); tool.resize();
});