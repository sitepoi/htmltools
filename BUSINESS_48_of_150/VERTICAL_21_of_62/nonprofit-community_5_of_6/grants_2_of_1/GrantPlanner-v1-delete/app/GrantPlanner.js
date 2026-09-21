/* ── Grant Planner ──
   A comprehensive post-grant activity planning, budget management,
   and expense tracking application.
   Built for UniconHub CMS HTML-tool system.
────────────────────────────────────────── */

/* ── Constants ── */
const CATEGORY_COLORS = [
	'#0d9488', '#2563eb', '#7c3aed', '#dc2626', '#d97706',
	'#16a34a', '#ea580c', '#0891b2', '#be185d', '#4f46e5',
	'#059669', '#9333ea', '#c2410c', '#0284c7', '#b91c1c'
];

const CURRENCY_SYMBOLS = {
	USD: '$', EUR: '€', GBP: '£', TRY: '₺', CAD: 'C$', AUD: 'A$'
};

/* ── Helpers ── */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fmtDate(d) { if (!d) return '—'; const dt = new Date(d + 'T00:00:00'); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function fmtDateShort(d) { if (!d) return '—'; const dt = new Date(d + 'T00:00:00'); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function fmtCurrency(amount, currency) {
	const sym = CURRENCY_SYMBOLS[currency] || '$';
	const n = Number(amount);
	if (isNaN(n)) return sym + '0.00';
	return sym + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function el(id) { return document.getElementById(id); }
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }

/* ── State ── */
let DB = {
	grant: { name: '', id: '', funder: '', totalBudget: 0, currency: 'USD', startDate: '', endDate: '', description: '', phase: 'drafting', problem: '', goals: '', method: '', beneficiaries: '', sustainability: '' },
	activities: [],
	expenses: [],
	budgetCategories: [],
	documents: [],
	checklist: {},
	_theme: 'light'
};
let isReadOnly = false;
let currentPage = 'dashboard';
let editingActivityId = null;
let editingExpenseId = null;
let editingCategoryId = null;
let editingDocumentId = null;
let confirmCb = null;
let lineItemsBuffer = [];

/* ── Phase ── */
function getPhase() { return DB.grant.phase || 'drafting'; }
function setPhase(p) {
	DB.grant.phase = p;
	document.body.className = document.body.className.replace(/phase-\S+/g, '');
	document.body.classList.add('phase-' + p);
	updatePhaseStepper();
	if (['approved','closed'].includes(p)) { renderExpenses(); renderReports(); }
	renderDashboard();
	persist();
}
function updatePhaseStepper() {
	const phase = getPhase();
	const phases = ['drafting','applied','approved','closed'];
	const idx = phases.indexOf(phase);
	qsa('.phase-step').forEach(s => { s.classList.remove('active','done'); if (s.dataset.phase === phase) s.classList.add('active'); });
	qsa('.phase-line').forEach(l => l.classList.remove('done'));
	phases.forEach((p, i) => {
		const step = qs(`.phase-step[data-phase="${p}"]`);
		if (i < idx && step) step.classList.add('done');
	});
	qsa('.phase-line').forEach((l, i) => { if (i < idx) l.classList.add('done'); });
}

/* ── Theme ── */
function applyTheme(t) {
	DB._theme = t;
	document.documentElement.setAttribute('data-theme', t);
	const icon = el('theme-icon');
	if (icon) icon.textContent = t === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
	applyTheme(DB._theme === 'dark' ? 'light' : 'dark');
	persist();
}

/* ── Persistence ── */
function persist() {
	tool.setValue(DB);
	updateNavBadges();
	tool.resize();
}

function render(val) {
	if (val && typeof val === 'object' && !Array.isArray(val)) {
		DB = Object.assign({
			grant: { name: '', id: '', funder: '', totalBudget: 0, currency: 'USD', startDate: '', endDate: '', description: '', phase: 'drafting', problem: '', goals: '', method: '', beneficiaries: '', sustainability: '' },
			activities: [],
			expenses: [],
			budgetCategories: [],
			documents: [],
			checklist: {},
			_theme: 'light'
		}, val);
		if (!DB.grant || typeof DB.grant !== 'object') DB.grant = { name: '', id: '', funder: '', totalBudget: 0, currency: 'USD', startDate: '', endDate: '', description: '', phase: 'drafting', problem: '', goals: '', method: '', beneficiaries: '', sustainability: '' };
		if (!Array.isArray(DB.activities)) DB.activities = [];
		if (!Array.isArray(DB.expenses)) DB.expenses = [];
		if (!Array.isArray(DB.budgetCategories)) DB.budgetCategories = [];
		if (!Array.isArray(DB.documents)) DB.documents = [];
		if (!DB.checklist || typeof DB.checklist !== 'object') DB.checklist = {};
	}
	if (DB._theme) applyTheme(DB._theme);
	updatePhaseStepper();
	setPhase(getPhase());
	updateNavBadges();
	renderCurrentSection();
	syncGrantForm();
}

function syncFields() { }
function lockUI(ro) { isReadOnly = ro === true; document.body.classList.toggle('readonly', isReadOnly); }

/* ── Navigation ── */
function navigate(page) {
	currentPage = page;
	qsa('.section').forEach(s => s.classList.remove('active'));
	qsa('.nav-item').forEach(n => n.classList.remove('active'));
	const sec = el('sec-' + page);
	if (sec) sec.classList.add('active');
	qsa('.nav-item').forEach(n => { if (n.dataset.page === page) n.classList.add('active'); });
	renderCurrentSection();
	tool.resize();
}

function renderCurrentSection() {
	switch (currentPage) {
		case 'dashboard': renderDashboard(); break;
		case 'grant': syncGrantForm(); break;
		case 'documents': renderDocuments(); break;
		case 'activities': renderActivities(); break;
		case 'budget': renderBudget(); break;
		case 'expenses': renderExpenses(); break;
		case 'reports': renderReports(); break;
	}
}

function updateNavBadges() {
	const set = (id, v) => { const e = el(id); if (e) e.textContent = v; };
	set('nav-activities-count', DB.activities.length);
	set('nav-budget-count', DB.budgetCategories.length);
	set('nav-expenses-count', DB.expenses.length);
	set('nav-documents-count', DB.documents.length);
}

/* ── Grant helpers ── */
function getGrant() { return DB.grant || {}; }
function getCurrency() { return getGrant().currency || 'USD'; }
function getTotalBudget() { return Number(getGrant().totalBudget) || 0; }
function getTotalAllocated() { return DB.budgetCategories.reduce((s, c) => s + (Number(c.allocated) || 0), 0); }
function getTotalSpent() { return DB.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0); }
function getRemaining() { return getTotalBudget() - getTotalSpent(); }
function getSpentForCategory(catId) { return DB.expenses.filter(e => e.category === catId).reduce((s, e) => s + (Number(e.amount) || 0), 0); }
function getSpentForActivity(actId) { return DB.expenses.filter(e => e.activityId === actId).reduce((s, e) => s + (Number(e.amount) || 0), 0); }
function getLineItemsTotal(items) { return (items || []).reduce((s, li) => s + (Number(li.cost) || 0), 0); }
function getActivityBudget(a) { const li = a.lineItems; return (li && li.length > 0) ? getLineItemsTotal(li) : (Number(a.budgetAllocated) || 0); }
function getCategoryById(id) { return DB.budgetCategories.find(c => c.id === id) || null; }
function getActivityById(id) { return DB.activities.find(a => a.id === id) || null; }

function getBudgetUtilizationPct() {
	const budget = getTotalBudget();
	if (budget <= 0) return 0;
	return Math.min(100, (getTotalSpent() / budget) * 100);
}

/* ══════════════════════════════════════════
   MODALS
══════════════════════════════════════════ */
function openModal(id) {
	el('modal-backdrop').hidden = false;
	qsa('.modal').forEach(m => m.style.display = 'none');
	const modal = el(id);
	if (modal) modal.style.display = 'flex';
}
function closeAllModals() {
	el('modal-backdrop').hidden = true;
	qsa('.modal').forEach(m => m.style.display = 'none');
	editingActivityId = null;
	editingExpenseId = null;
	editingCategoryId = null;
}
function openConfirm(title, body, cb) {
	confirmCb = cb;
	el('confirm-title').textContent = title;
	el('confirm-body').textContent = body;
	openModal('modal-confirm');
}

/* ══════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════ */
function renderDashboard() {
	const g = getGrant();
	const totalBudget = getTotalBudget();
	const totalSpent = getTotalSpent();
	const remaining = totalBudget - totalSpent;
	const actCount = DB.activities.length;
	const expCount = DB.expenses.length;
	const catCount = DB.budgetCategories.length;
	const docCount = DB.documents.length;
	const ongoingActs = DB.activities.filter(a => a.status === 'in-progress').length;
	const utilizationPct = getBudgetUtilizationPct();
	const cur = getCurrency();
	const phase = getPhase();
	const isPreApproval = phase === 'drafting' || phase === 'applied';

	el('dash-grant-name').textContent = g.name || 'Grant Dashboard';
	const phaseBadge = `<span class="badge badge-${phase === 'drafting' ? 'low' : phase === 'applied' ? 'medium' : phase === 'approved' ? 'in-progress' : 'completed'}">${phase.charAt(0).toUpperCase() + phase.slice(1)}</span>`;
	el('dash-grant-sub').innerHTML = g.name
		? `${g.funder || 'Unknown Funder'}${g.id ? ' · ' + g.id : ''} &nbsp; ${phaseBadge}`
		: 'Set up your grant to get started';

	// Stats row — phase-aware
	el('dash-stats').innerHTML = `
		<div class="stat-card accent">
			<div class="stat-label">Total Budget</div>
			<div class="stat-value">${fmtCurrency(totalBudget, cur)}</div>
			<div class="stat-sub">${catCount} budget categories</div>
		</div>
		<div class="stat-card ${isPreApproval ? 'purple' : (remaining >= 0 ? 'green' : 'red')}">
			<div class="stat-label">${isPreApproval ? 'Planned Activities' : 'Total Spent'}</div>
			<div class="stat-value">${isPreApproval ? actCount : fmtCurrency(totalSpent, cur)}</div>
			<div class="stat-sub">${isPreApproval ? ongoingActs + ' in progress' : expCount + ' expenses recorded'}</div>
		</div>
		<div class="stat-card ${isPreApproval ? 'blue' : (remaining >= 0 ? 'blue' : 'red')}">
			<div class="stat-label">${isPreApproval ? 'Documents' : 'Remaining'}</div>
			<div class="stat-value">${isPreApproval ? docCount : fmtCurrency(Math.abs(remaining), cur)}</div>
			<div class="stat-sub">${isPreApproval ? 'attached to application' : (remaining >= 0 ? (remaining === totalBudget ? 'No spending yet' : utilPctText(utilizationPct)) : 'OVER BUDGET!')}</div>
		</div>
		<div class="stat-card ${isPreApproval ? 'amber' : 'purple'}">
			<div class="stat-label">Phase</div>
			<div class="stat-value" style="font-size:20px">${phase === 'drafting' ? '📝' : phase === 'applied' ? '📤' : phase === 'approved' ? '✅' : '🏁'}</div>
			<div class="stat-sub">${phase === 'drafting' ? 'Preparing application' : phase === 'applied' ? 'Awaiting decision' : phase === 'approved' ? 'Active execution' : 'Completed'}</div>
		</div>
	`;

	// Checklist card (pre-approval only)
	const checklistCard = el('dash-checklist-card');
	if (isPreApproval) {
		checklistCard.style.display = '';
		renderChecklist();
	} else {
		checklistCard.style.display = 'none';
	}

	// Budget bar — always visible but label changes
	el('dash-budget-bar').style.width = utilizationPct + '%';
	el('dash-budget-spent').textContent = isPreApproval ? 'Budget planned: ' + fmtCurrency(totalBudget, cur) : fmtCurrency(totalSpent, cur) + ' spent';
	el('dash-budget-remaining').textContent = isPreApproval ? 'Ready for allocation' : fmtCurrency(Math.max(0, remaining), cur) + ' remaining';

	// Hide/show bottom row based on phase
	el('dash-bottom-row').style.display = isPreApproval ? 'none' : '';

	// Upcoming activities
	const upcoming = [...DB.activities]
		.filter(a => a.status === 'planned' || a.status === 'in-progress')
		.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
		.slice(0, 5);
	if (upcoming.length === 0) {
		el('dash-upcoming-activities').innerHTML = '<div class="empty-state">No activities planned yet</div>';
	} else {
		el('dash-upcoming-activities').innerHTML = '<ul class="mini-list">' + upcoming.map(a => {
			const spent = getSpentForActivity(a.id);
			return `<li class="mini-item">
				<div class="mini-item-avatar" style="background:${accentBg(a.status)};color:${accentColor(a.status)}">${statusIcon(a.status)}</div>
				<div class="mini-item-info">
					<div class="mini-item-title">${esc(a.name)}</div>
					<div class="mini-item-sub">${fmtDate(a.startDate)} → ${fmtDate(a.endDate)} · <span class="badge badge-${a.priority || 'medium'}">${a.priority || 'medium'}</span></div>
				</div>
				<div class="mini-item-value">${fmtCurrency(spent, cur)} / ${fmtCurrency(getActivityBudget(a), cur)}</div>
			</li>`;
		}).join('') + '</ul>';
	}

	// Only render expenses / category breakdown if not pre-approval
	if (!isPreApproval) {
		renderDashboardExpenses(cur);
		renderDashboardCategories(cur);
	}

	tool.resize();
}

function renderDashboardExpenses(cur) {
	const recentExps = [...DB.expenses].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);
	if (recentExps.length === 0) {
		el('dash-recent-expenses').innerHTML = '<div class="empty-state">No expenses recorded yet</div>';
	} else {
		el('dash-recent-expenses').innerHTML = '<ul class="mini-list">' + recentExps.map(e => {
			const act = e.activityId ? getActivityById(e.activityId) : null;
			const cat = e.category ? getCategoryById(e.category) : null;
			return `<li class="mini-item">
				<div class="mini-item-avatar" style="background:${cat ? cat.color + '22' : 'var(--surface3)'};color:${cat ? cat.color : 'var(--text3)'}">$</div>
				<div class="mini-item-info">
					<div class="mini-item-title">${esc(e.description || 'Expense')}</div>
					<div class="mini-item-sub">${fmtDate(e.date)}${act ? ' · ' + esc(act.name) : ''}${cat ? ' · ' + esc(cat.name) : ''}</div>
				</div>
				<div class="mini-item-value">${fmtCurrency(e.amount, cur)}</div>
			</li>`;
		}).join('') + '</ul>';
	}
}

function renderDashboardCategories(cur) {
	if (DB.budgetCategories.length === 0) {
		el('dash-category-breakdown').innerHTML = '<div class="empty-state">No budget categories defined</div>';
	} else {
		const maxAlloc = Math.max(...DB.budgetCategories.map(c => Number(c.allocated) || 0), 1);
		el('dash-category-breakdown').innerHTML = DB.budgetCategories.map(c => {
			const spent = getSpentForCategory(c.id);
			const alloc = Number(c.allocated) || 0;
			const spentPct = alloc > 0 ? Math.min(100, (spent / alloc) * 100) : 0;
			return `<div class="category-bar-row">
				<div class="category-bar-color" style="background:${c.color || '#0d9488'}"></div>
				<div class="category-bar-label">${esc(c.name)}</div>
				<div class="category-bar-track">
					<div class="category-bar-fill" style="width:${spentPct}%;background:${c.color || '#0d9488'}"></div>
				</div>
				<div class="category-bar-amount">${fmtCurrency(spent, cur)} / ${fmtCurrency(alloc, cur)}</div>
			</div>`;
		}).join('');
	}
}

/* ── Checklist ── */
const CHECKLIST_ITEMS = [
	{ key: 'grant_name', label: 'Define grant name and funder', hint: 'Grant Setup' },
	{ key: 'budget_set', label: 'Set total budget amount', hint: 'Grant Setup' },
	{ key: 'categories', label: 'Define budget categories & allocations', hint: 'Budget' },
	{ key: 'activities', label: 'Plan at least 2 activities with timelines', hint: 'Activities' },
	{ key: 'problem_stmt', label: 'Write problem statement / needs assessment', hint: 'Grant Setup' },
	{ key: 'goals', label: 'Define goals & measurable objectives', hint: 'Grant Setup' },
	{ key: 'methodology', label: 'Describe methodology and approach', hint: 'Grant Setup' },
	{ key: 'beneficiaries', label: 'Identify target beneficiaries', hint: 'Grant Setup' },
	{ key: 'sustainability', label: 'Plan for sustainability after funding', hint: 'Grant Setup' },
	{ key: 'documents', label: 'Attach supporting documents', hint: 'Documents' }
];

function getChecklistState() {
	const g = getGrant();
	const st = DB.checklist || {};
	return {
		grant_name: !!(g.name && g.funder),
		budget_set: !!(Number(g.totalBudget) > 0),
		categories: DB.budgetCategories.length > 0,
		activities: DB.activities.length >= 2,
		problem_stmt: !!(g.problem && g.problem.length > 30),
		goals: !!(g.goals && g.goals.length > 30),
		methodology: !!(g.method && g.method.length > 30),
		beneficiaries: !!(g.beneficiaries && g.beneficiaries.length > 10),
		sustainability: !!(g.sustainability && g.sustainability.length > 10),
		documents: DB.documents.length > 0,
		...st
	};
}

function renderChecklist() {
	const state = getChecklistState();
	const keys = Object.keys(state);
	const done = keys.filter(k => state[k]).length;
	const total = CHECKLIST_ITEMS.length;
	el('checklist-progress').textContent = done + '/' + total;
	el('dash-checklist').innerHTML = CHECKLIST_ITEMS.map(item => {
		const isDone = state[item.key];
		return `<div class="checklist-item${isDone ? ' done' : ''}" onclick="navigate('${item.key === 'categories' ? 'budget' : item.key === 'activities' ? 'activities' : item.key === 'documents' ? 'documents' : 'grant'}')">
			<div class="checklist-check">✓</div>
			<span class="checklist-label">${item.label}</span>
			<span class="checklist-hint">→ ${item.hint}</span>
		</div>`;
	}).join('');
}

/* ── Documents ── */
function renderDocuments() {
	const tbody = el('documents-table-body');
	if (DB.documents.length === 0) {
		tbody.innerHTML = '<tr><td class="table-empty" colspan="5">No documents added yet</td></tr>';
	} else {
		tbody.innerHTML = [...DB.documents].sort((a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || '')).map(d => `<tr>
			<td><div style="font-weight:600">${esc(d.name)}</div>${d.notes ? `<div style="font-size:11px;color:var(--text3)">${esc(d.notes)}</div>` : ''}</td>
			<td><span class="badge badge-low">${docTypeLabel(d.type)}</span></td>
			<td style="font-size:12px">${fmtDate(d.dateAdded)}</td>
			<td><span class="badge badge-${d.status === 'submitted' ? 'completed' : d.status === 'ready' ? 'in-progress' : 'planned'}">${d.status || 'draft'}</span></td>
			<td class="row-actions">
				${d.url ? `<a href="${esc(d.url)}" target="_blank" class="btn btn-ghost btn-xs" style="text-decoration:none">Open</a>` : ''}
				<button class="btn btn-ghost btn-xs" data-action="edit-document" data-id="${d.id}">Edit</button>
				<button class="btn btn-ghost btn-xs" data-action="delete-document" data-id="${d.id}" style="color:var(--red)">Del</button>
			</td>
		</tr>`).join('');
	}
	tool.resize();
}

function docTypeLabel(t) {
	const map = { 'org-doc': 'Org Doc', 'grant-doc': 'Grant Doc', 'financial': 'Financial', 'proposal': 'Proposal', 'support-letter': 'Support Letter', 'other': 'Other' };
	return map[t] || t;
}

function openDocumentModal(id) {
	editingDocumentId = id || null;
	const d = id ? DB.documents.find(x => x.id === id) : null;
	el('modal-document-title').textContent = id ? 'Edit Document' : 'Add Document';
	el('f-doc-id').value = id || '';
	el('f-doc-name').value = d ? d.name : '';
	el('f-doc-type').value = d ? (d.type || 'org-doc') : 'org-doc';
	el('f-doc-status').value = d ? (d.status || 'draft') : 'draft';
	el('f-doc-url').value = d ? (d.url || '') : '';
	el('f-doc-notes').value = d ? (d.notes || '') : '';
	el('btn-delete-document').style.display = id ? '' : 'none';
	openModal('modal-document');
}

function saveDocument() {
	const id = el('f-doc-id').value;
	const name = el('f-doc-name').value.trim();
	if (!name) { tool.notify('Document name is required', 'warning'); return; }
	const data = {
		id: id || genId(),
		name: name,
		type: el('f-doc-type').value,
		status: el('f-doc-status').value,
		url: el('f-doc-url').value.trim(),
		notes: el('f-doc-notes').value.trim(),
		dateAdded: id ? (DB.documents.find(x => x.id === id) || {}).dateAdded : new Date().toISOString().slice(0, 10)
	};
	if (id) {
		const idx = DB.documents.findIndex(x => x.id === id);
		if (idx >= 0) DB.documents[idx] = data;
	} else {
		DB.documents.push(data);
	}
	closeAllModals();
	persist();
	renderDocuments();
	tool.notify(id ? 'Document updated' : 'Document added', 'success');
}

function deleteDocument(id) {
	const d = DB.documents.find(x => x.id === id);
	if (!d) return;
	openConfirm('Delete Document', `Delete "${d.name}"?`, () => {
		DB.documents = DB.documents.filter(x => x.id !== id);
		closeAllModals();
		persist();
		renderDocuments();
		tool.notify('Document deleted', 'success');
	});
}

function utilPctText(pct) {
	if (pct >= 100) return 'Fully utilized';
	if (pct >= 75) return pct.toFixed(0) + '% utilized';
	if (pct > 0) return pct.toFixed(0) + '% utilized';
	return 'No spending';
}

function statusIcon(status) {
	switch (status) {
		case 'planned': return '○';
		case 'in-progress': return '◐';
		case 'completed': return '✓';
		case 'cancelled': return '✕';
		default: return '○';
	}
}

function accentBg(status) {
	switch (status) {
		case 'planned': return 'var(--blue-bg)';
		case 'in-progress': return 'var(--amber-bg)';
		case 'completed': return 'var(--green-bg)';
		case 'cancelled': return 'var(--red-bg)';
		default: return 'var(--surface3)';
	}
}

function accentColor(status) {
	switch (status) {
		case 'planned': return 'var(--blue)';
		case 'in-progress': return 'var(--amber)';
		case 'completed': return 'var(--green)';
		case 'cancelled': return 'var(--red)';
		default: return 'var(--text3)';
	}
}

/* ══════════════════════════════════════════
   GRANT SETUP
══════════════════════════════════════════ */
function syncGrantForm() {
	const g = getGrant();
	el('grant-name').value = g.name || '';
	el('grant-id').value = g.id || '';
	el('grant-funder').value = g.funder || '';
	el('grant-budget').value = g.totalBudget || '';
	el('grant-currency').value = g.currency || 'USD';
	el('grant-start').value = g.startDate || '';
	el('grant-end').value = g.endDate || '';
	el('grant-desc').value = g.description || '';
	el('grant-problem').value = g.problem || '';
	el('grant-goals').value = g.goals || '';
	el('grant-method').value = g.method || '';
	el('grant-beneficiaries').value = g.beneficiaries || '';
	el('grant-sustainability').value = g.sustainability || '';
}

function saveGrant() {
	const name = el('grant-name').value.trim();
	const funder = el('grant-funder').value.trim();
	const budget = parseFloat(el('grant-budget').value) || 0;

	if (!name) { tool.notify('Grant name is required', 'warning'); return; }
	if (!funder) { tool.notify('Funding source is required', 'warning'); return; }
	if (budget <= 0) { tool.notify('Budget must be greater than zero', 'warning'); return; }

	DB.grant = {
		name: name,
		id: el('grant-id').value.trim(),
		funder: funder,
		totalBudget: budget,
		currency: el('grant-currency').value,
		startDate: el('grant-start').value,
		endDate: el('grant-end').value,
		description: el('grant-desc').value.trim(),
		phase: DB.grant.phase || 'drafting',
		problem: el('grant-problem').value.trim(),
		goals: el('grant-goals').value.trim(),
		method: el('grant-method').value.trim(),
		beneficiaries: el('grant-beneficiaries').value.trim(),
		sustainability: el('grant-sustainability').value.trim()
	};

	persist();
	tool.notify('Grant details saved', 'success');
	renderDashboard();
}

/* ══════════════════════════════════════════
   ACTIVITIES
══════════════════════════════════════════ */
function renderActivities() {
	const search = (el('act-search')?.value || '').toLowerCase();
	const filterStatus = el('act-filter-status')?.value || '';
	const filterPriority = el('act-filter-priority')?.value || '';

	let filtered = [...DB.activities];
	if (search) filtered = filtered.filter(a => a.name.toLowerCase().includes(search) || (a.description || '').toLowerCase().includes(search));
	if (filterStatus) filtered = filtered.filter(a => a.status === filterStatus);
	if (filterPriority) filtered = filtered.filter(a => a.priority === filterPriority);

	filtered.sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999'));

	const cur = getCurrency();
	const tbody = el('activities-table-body');
	if (filtered.length === 0) {
		tbody.innerHTML = '<tr><td class="table-empty" colspan="7">No activities found</td></tr>';
	} else {
		tbody.innerHTML = filtered.map(a => {
			const spent = getSpentForActivity(a.id);
			const alloc = getActivityBudget(a);
			const liCount = (a.lineItems && a.lineItems.length) || 0;
			const liDone = a.lineItems ? a.lineItems.filter(li => li.status === 'completed').length : 0;
			return `<tr>
				<td>
					<div style="font-weight:600">${esc(a.name)}</div>
					<div style="font-size:11px;color:var(--text3)">${esc((a.description || '').slice(0, 60))}${(a.description || '').length > 60 ? '...' : ''}</div>
				</td>
				<td style="white-space:nowrap;font-size:12px">${fmtDateShort(a.startDate)} → ${fmtDateShort(a.endDate)}</td>
				<td class="amount-cell">${fmtCurrency(spent, cur)}<span style="font-weight:400;color:var(--text3)"> / ${fmtCurrency(alloc, cur)}</span>${liCount > 0 ? `<span class="amount-sub">${liCount} items${liDone > 0 ? ' · ' + liDone + ' done' : ''}</span>` : ''}</td>
				<td style="text-align:center">${a.expectedAttendees || '—'}</td>
				<td><span class="badge badge-${a.priority || 'medium'}">${a.priority || 'medium'}</span></td>
				<td><span class="badge badge-${a.status || 'planned'}">${(a.status || 'planned').replace('-', ' ')}</span></td>
				<td class="row-actions">
					<button class="btn btn-ghost btn-xs" data-action="edit-activity" data-id="${a.id}">Edit</button>
					<button class="btn btn-ghost btn-xs" data-action="delete-activity" data-id="${a.id}" style="color:var(--red)">Del</button>
				</td>
			</tr>`;
		}).join('');
	}

	tool.resize();
}

function openActivityModal(id) {
	editingActivityId = id || null;
	const a = id ? getActivityById(id) : null;
	el('modal-activity-title').textContent = id ? 'Edit Activity' : 'Add Activity';
	el('f-act-id').value = id || '';
	el('f-act-name').value = a ? a.name : '';
	el('f-act-start').value = a ? a.startDate : '';
	el('f-act-end').value = a ? a.endDate : '';
	el('f-act-budget').value = a ? (a.budgetAllocated || '') : '';
	el('f-act-attendees').value = a ? (a.expectedAttendees || '') : '';
	el('f-act-desc').value = a ? (a.description || '') : '';
	el('f-act-priority').value = a ? (a.priority || 'medium') : 'medium';
	el('f-act-status').value = a ? (a.status || 'planned') : 'planned';

	// Populate category dropdown
	const catSelect = el('f-act-category');
	catSelect.innerHTML = '<option value="">Select category...</option>' + DB.budgetCategories.map(c => `<option value="${c.id}" ${a && a.category === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
	if (a) catSelect.value = a.category || '';

	// Line items
	const hasLineItems = a && a.lineItems && a.lineItems.length > 0;
	lineItemsBuffer = hasLineItems ? a.lineItems.map(li => ({...li})) : [];
	const autoSum = a ? (a.lineItems && a.lineItems.length > 0) : true;
	el('f-act-auto-sum').checked = autoSum;
	el('f-act-budget').readOnly = autoSum && lineItemsBuffer.length > 0;
	el('f-act-budget').style.opacity = (autoSum && lineItemsBuffer.length > 0) ? '0.6' : '1';
	renderLineItems();

	el('btn-delete-activity').style.display = id ? '' : 'none';
	openModal('modal-activity');
}

/* ── Line Items UI ── */
function renderLineItems() {
	const container = el('line-items-container');
	const cur = getCurrency();
	if (lineItemsBuffer.length === 0) {
		container.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:4px 0">No line items yet — add them below or just use the Budget field above.</div>';
	} else {
		container.innerHTML = lineItemsBuffer.map((li, i) => `
			<div class="line-item-row" data-li-index="${i}">
				<input type="text" class="form-input li-desc" value="${esc(li.description || '')}" placeholder="Item description" onchange="updateLineItem(${i},'description',this.value)">
				<div class="input-with-prefix li-cost-wrap"><span class="input-prefix">$</span><input type="number" class="form-input li-cost-input" value="${li.cost || ''}" placeholder="0.00" min="0" step="0.01" onchange="updateLineItem(${i},'cost',this.value)"></div>
				<select class="form-input li-status" onchange="updateLineItem(${i},'status',this.value)">
					<option value="planned" ${li.status === 'planned' ? 'selected' : ''}>Planned</option>
					<option value="in-progress" ${li.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
					<option value="completed" ${li.status === 'completed' ? 'selected' : ''}>Done</option>
				</select>
				<button class="btn btn-ghost btn-xs li-del" onclick="removeLineItem(${i})" title="Remove">×</button>
			</div>`).join('');
	}
	refreshLineItemsTotal();
}

function addLineItem() {
	lineItemsBuffer.push({ id: genId(), description: '', cost: 0, status: 'planned' });
	renderLineItems();
	if (el('f-act-auto-sum').checked) {
		el('f-act-budget').readOnly = true;
		el('f-act-budget').style.opacity = '0.6';
	}
	setTimeout(() => {
		const rows = el('line-items-container').querySelectorAll('.line-item-row');
		const last = rows[rows.length - 1];
		if (last) { const inp = last.querySelector('.li-desc'); if (inp) inp.focus(); }
	}, 50);
}

function removeLineItem(index) {
	lineItemsBuffer.splice(index, 1);
	renderLineItems();
	if (lineItemsBuffer.length === 0) {
		el('f-act-budget').readOnly = false;
		el('f-act-budget').style.opacity = '1';
	}
}

function updateLineItem(index, field, value) {
	if (lineItemsBuffer[index]) {
		if (field === 'cost') lineItemsBuffer[index].cost = parseFloat(value) || 0;
		else lineItemsBuffer[index][field] = value;
	}
	refreshLineItemsTotal();
	if (el('f-act-auto-sum').checked) {
		const total = getLineItemsTotal(lineItemsBuffer);
		el('f-act-budget').value = total > 0 ? total.toFixed(2) : '';
	}
}

function refreshLineItemsTotal() {
	const total = getLineItemsTotal(lineItemsBuffer);
	const cur = getCurrency();
	const totalEl = el('line-items-total');
	if (lineItemsBuffer.length > 0) {
		totalEl.style.display = 'block';
		totalEl.textContent = 'Line items total: ' + fmtCurrency(total, cur);
	} else {
		totalEl.style.display = 'none';
	}
	const autoSum = el('f-act-auto-sum').checked;
	if (autoSum && lineItemsBuffer.length > 0) {
		el('f-act-budget').readOnly = true;
		el('f-act-budget').style.opacity = '0.6';
		const total2 = getLineItemsTotal(lineItemsBuffer);
		el('f-act-budget').value = total2 > 0 ? total2.toFixed(2) : '';
	} else {
		el('f-act-budget').readOnly = false;
		el('f-act-budget').style.opacity = '1';
	}
}

function saveActivity() {
	const id = el('f-act-id').value;
	const name = el('f-act-name').value.trim();
	if (!name) { tool.notify('Activity name is required', 'warning'); return; }

	const autoSum = el('f-act-auto-sum').checked && lineItemsBuffer.length > 0;
	const budgetManual = parseFloat(el('f-act-budget').value) || 0;
	const budgetFromItems = getLineItemsTotal(lineItemsBuffer);
	const finalBudget = autoSum ? budgetFromItems : budgetManual;

	const data = {
		id: id || genId(),
		name: name,
		description: el('f-act-desc').value.trim(),
		startDate: el('f-act-start').value,
		endDate: el('f-act-end').value,
		budgetAllocated: finalBudget,
		expectedAttendees: parseInt(el('f-act-attendees').value) || 0,
		category: el('f-act-category').value,
		priority: el('f-act-priority').value,
		status: el('f-act-status').value,
		lineItems: lineItemsBuffer.length > 0 ? lineItemsBuffer.map(li => ({
			id: li.id, description: li.description || '', cost: Number(li.cost) || 0, status: li.status || 'planned'
		})) : []
	};

	if (id) {
		const idx = DB.activities.findIndex(a => a.id === id);
		if (idx >= 0) DB.activities[idx] = data;
	} else {
		DB.activities.push(data);
	}

	closeAllModals();
	persist();
	renderActivities();
	tool.notify(id ? 'Activity updated' : 'Activity added', 'success');
}

function deleteActivity(id) {
	const a = getActivityById(id);
	if (!a) return;
	const linkedExpenses = DB.expenses.filter(e => e.activityId === id).length;
	let msg = `Delete activity "${a.name}"?`;
	if (linkedExpenses > 0) msg += ` This activity has ${linkedExpenses} linked expense(s) which will become unlinked.`;
	openConfirm('Delete Activity', msg, () => {
		DB.activities = DB.activities.filter(a => a.id !== id);
		DB.expenses.forEach(e => { if (e.activityId === id) e.activityId = ''; });
		closeAllModals();
		persist();
		renderActivities();
		tool.notify('Activity deleted', 'success');
	});
}

/* ══════════════════════════════════════════
   BUDGET CATEGORIES
══════════════════════════════════════════ */
function renderBudget() {
	const cur = getCurrency();
	const totalBudget = getTotalBudget();
	const totalAllocated = getTotalAllocated();
	const totalSpent = getTotalSpent();

	const tbody = el('budget-table-body');
	if (DB.budgetCategories.length === 0) {
		tbody.innerHTML = '<tr><td class="table-empty" colspan="6">No budget categories defined. Add categories to allocate your grant budget.</td></tr>';
	} else {
		tbody.innerHTML = DB.budgetCategories.map((c, i) => {
			const spent = getSpentForCategory(c.id);
			const alloc = Number(c.allocated) || 0;
			const remaining = alloc - spent;
			const pct = alloc > 0 ? Math.min(100, (spent / alloc) * 100) : 0;
			const overBudget = spent > alloc;
			return `<tr>
				<td>
					<div style="display:flex;align-items:center;gap:8px">
						<div style="width:10px;height:10px;border-radius:50%;background:${c.color || CATEGORY_COLORS[i % CATEGORY_COLORS.length]};flex-shrink:0"></div>
						<span style="font-weight:600">${esc(c.name)}</span>
					</div>
				</td>
				<td class="amount-cell">${fmtCurrency(alloc, cur)}</td>
				<td class="amount-cell">${fmtCurrency(spent, cur)}</td>
				<td class="amount-cell ${overBudget ? 'text-red' : 'text-green'}">${fmtCurrency(remaining, cur)}${overBudget ? ' ⚠' : ''}</td>
				<td>
					<div style="display:flex;align-items:center;gap:8px">
						<div style="flex:1;height:6px;background:var(--surface3);border-radius:6px;overflow:hidden">
							<div style="height:100%;width:${pct}%;background:${overBudget ? 'var(--red)' : (c.color || '#0d9488')};border-radius:6px;transition:width .3s"></div>
						</div>
						<span style="font-size:11px;font-weight:600;color:var(--text2);white-space:nowrap">${pct.toFixed(0)}%</span>
					</div>
				</td>
				<td class="row-actions">
					<button class="btn btn-ghost btn-xs" data-action="edit-category" data-id="${c.id}">Edit</button>
					<button class="btn btn-ghost btn-xs" data-action="delete-category" data-id="${c.id}" style="color:var(--red)">Del</button>
				</td>
			</tr>`;
		}).join('');
	}

	// Budget summary bars
	const unallocated = totalBudget - totalAllocated;
	el('budget-summary-bars').innerHTML = `
		<div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:8px">
			<div style="flex:1;min-width:200px">
				<div style="font-size:11px;color:var(--text3);text-transform:uppercase;font-weight:600;margin-bottom:8px">Budget Allocation</div>
				<div style="height:24px;background:var(--surface3);border-radius:6px;overflow:hidden;display:flex">
					${DB.budgetCategories.map((c, i) => {
						const alloc = Number(c.allocated) || 0;
						const pct = totalBudget > 0 ? (alloc / totalBudget) * 100 : 0;
						return pct > 0 ? `<div style="width:${pct}%;background:${c.color || CATEGORY_COLORS[i]};transition:width .3s" title="${esc(c.name)}: ${fmtCurrency(alloc, cur)}"></div>` : '';
					}).join('')}
					${unallocated > 0 ? `<div style="flex:1;background:var(--border);min-width:2px" title="Unallocated: ${fmtCurrency(unallocated, cur)}"></div>` : ''}
				</div>
				<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:11px">
					${DB.budgetCategories.map((c, i) => `<span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:${c.color || CATEGORY_COLORS[i]}"></span>${esc(c.name)}</span>`).join('')}
					${unallocated > 0 ? `<span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:var(--border)"></span>Unallocated: ${fmtCurrency(unallocated, cur)}</span>` : ''}
				</div>
			</div>
			<div style="text-align:right;min-width:140px">
				<div style="font-size:11px;color:var(--text3);text-transform:uppercase;font-weight:600;margin-bottom:4px">Total Spent</div>
				<div style="font-size:22px;font-weight:800;color:${totalSpent > totalBudget ? 'var(--red)' : 'var(--text)'}">${fmtCurrency(totalSpent, cur)}</div>
				<div style="font-size:11px;color:var(--text3)">of ${fmtCurrency(totalBudget, cur)} total</div>
			</div>
		</div>
	`;

	tool.resize();
}

function openCategoryModal(id) {
	editingCategoryId = id || null;
	const c = id ? getCategoryById(id) : null;
	el('modal-category-title').textContent = id ? 'Edit Budget Category' : 'Add Budget Category';
	el('f-cat-id').value = id || '';
	el('f-cat-name').value = c ? c.name : '';
	el('f-cat-amount').value = c ? (c.allocated || '') : '';
	el('f-cat-color').value = c ? (c.color || CATEGORY_COLORS[DB.budgetCategories.length % CATEGORY_COLORS.length]) : CATEGORY_COLORS[DB.budgetCategories.length % CATEGORY_COLORS.length];
	el('btn-delete-category').style.display = id ? '' : 'none';
	openModal('modal-category');
}

function saveCategory() {
	const id = el('f-cat-id').value;
	const name = el('f-cat-name').value.trim();
	const amount = parseFloat(el('f-cat-amount').value) || 0;

	if (!name) { tool.notify('Category name is required', 'warning'); return; }

	const data = {
		id: id || genId(),
		name: name,
		allocated: amount,
		color: el('f-cat-color').value
	};

	if (id) {
		const idx = DB.budgetCategories.findIndex(c => c.id === id);
		if (idx >= 0) DB.budgetCategories[idx] = data;
	} else {
		DB.budgetCategories.push(data);
	}

	closeAllModals();
	persist();
	renderBudget();
	tool.notify(id ? 'Category updated' : 'Category added', 'success');
}

function deleteCategory(id) {
	const c = getCategoryById(id);
	if (!c) return;
	const linkedExpenses = DB.expenses.filter(e => e.category === id).length;
	let msg = `Delete category "${c.name}"?`;
	if (linkedExpenses > 0) msg += ` ${linkedExpenses} expense(s) are linked and will become uncategorized.`;
	openConfirm('Delete Category', msg, () => {
		DB.budgetCategories = DB.budgetCategories.filter(c => c.id !== id);
		DB.expenses.forEach(e => { if (e.category === id) e.category = ''; });
		closeAllModals();
		persist();
		renderBudget();
		tool.notify('Category deleted', 'success');
	});
}

/* ══════════════════════════════════════════
   EXPENSES
══════════════════════════════════════════ */
function renderExpenses() {
	const search = (el('exp-search')?.value || '').toLowerCase();
	const filterActivity = el('exp-filter-activity')?.value || '';
	const filterCategory = el('exp-filter-category')?.value || '';
	const cur = getCurrency();

	// Populate filter dropdowns
	const actFilter = el('exp-filter-activity');
	const prevActVal = actFilter.value;
	actFilter.innerHTML = '<option value="">All Activities</option>' + DB.activities.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
	actFilter.value = prevActVal;

	const catFilter = el('exp-filter-category');
	const prevCatVal = catFilter.value;
	catFilter.innerHTML = '<option value="">All Categories</option>' + DB.budgetCategories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
	catFilter.value = prevCatVal;

	let filtered = [...DB.expenses];
	if (search) filtered = filtered.filter(e => (e.description || '').toLowerCase().includes(search) || (e.vendor || '').toLowerCase().includes(search) || (e.notes || '').toLowerCase().includes(search));
	if (filterActivity) filtered = filtered.filter(e => e.activityId === filterActivity);
	if (filterCategory) filtered = filtered.filter(e => e.category === filterCategory);

	filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

	const tbody = el('expenses-table-body');
	if (filtered.length === 0) {
		tbody.innerHTML = '<tr><td class="table-empty" colspan="6">No expenses found</td></tr>';
	} else {
		tbody.innerHTML = filtered.map(e => {
			const act = e.activityId ? getActivityById(e.activityId) : null;
			const cat = e.category ? getCategoryById(e.category) : null;
			return `<tr>
				<td style="white-space:nowrap;font-size:12px">${fmtDate(e.date)}</td>
				<td>
					<div style="font-weight:600">${esc(e.description || 'Expense')}</div>
					${e.vendor ? `<div style="font-size:11px;color:var(--text3)">${esc(e.vendor)}${e.receiptRef ? ' · Ref: ' + esc(e.receiptRef) : ''}</div>` : ''}
				</td>
				<td style="font-size:12px">${act ? esc(act.name) : '<span style="color:var(--text3)">—</span>'}</td>
				<td style="font-size:12px">${cat ? `<span style="display:flex;align-items:center;gap:6px"><span style="width:7px;height:7px;border-radius:50%;background:${cat.color}"></span>${esc(cat.name)}</span>` : '<span style="color:var(--text3)">—</span>'}</td>
				<td class="amount-cell">${fmtCurrency(e.amount, cur)}</td>
				<td class="row-actions">
					<button class="btn btn-ghost btn-xs" data-action="edit-expense" data-id="${e.id}">Edit</button>
					<button class="btn btn-ghost btn-xs" data-action="delete-expense" data-id="${e.id}" style="color:var(--red)">Del</button>
				</td>
			</tr>`;
		}).join('');
	}

	tool.resize();
}

function openExpenseModal(id) {
	editingExpenseId = id || null;
	const e = id ? DB.expenses.find(x => x.id === id) : null;
	el('modal-expense-title').textContent = id ? 'Edit Expense' : 'Log Expense';
	el('f-exp-id').value = id || '';
	el('f-exp-desc').value = e ? (e.description || '') : '';
	el('f-exp-date').value = e ? (e.date || '') : new Date().toISOString().slice(0, 10);
	el('f-exp-amount').value = e ? (e.amount || '') : '';
	el('f-exp-vendor').value = e ? (e.vendor || '') : '';
	el('f-exp-receipt').value = e ? (e.receiptRef || '') : '';
	el('f-exp-notes').value = e ? (e.notes || '') : '';

	// Populate activity dropdown
	const actSelect = el('f-exp-activity');
	actSelect.innerHTML = '<option value="">No specific activity</option>' + DB.activities.map(a => `<option value="${a.id}" ${e && e.activityId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
	if (e) actSelect.value = e.activityId || '';

	// Populate category dropdown
	const catSelect = el('f-exp-category');
	catSelect.innerHTML = '<option value="">Select category...</option>' + DB.budgetCategories.map(c => `<option value="${c.id}" ${e && e.category === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
	if (e) catSelect.value = e.category || '';

	el('btn-delete-expense').style.display = id ? '' : 'none';
	openModal('modal-expense');
}

function saveExpense() {
	const id = el('f-exp-id').value;
	const desc = el('f-exp-desc').value.trim();
	const date = el('f-exp-date').value;
	const amount = parseFloat(el('f-exp-amount').value) || 0;

	if (!desc) { tool.notify('Description is required', 'warning'); return; }
	if (!date) { tool.notify('Date is required', 'warning'); return; }
	if (amount <= 0) { tool.notify('Amount must be greater than zero', 'warning'); return; }

	const data = {
		id: id || genId(),
		description: desc,
		date: date,
		amount: amount,
		activityId: el('f-exp-activity').value,
		category: el('f-exp-category').value,
		vendor: el('f-exp-vendor').value.trim(),
		receiptRef: el('f-exp-receipt').value.trim(),
		notes: el('f-exp-notes').value.trim()
	};

	if (id) {
		const idx = DB.expenses.findIndex(e => e.id === id);
		if (idx >= 0) DB.expenses[idx] = data;
	} else {
		DB.expenses.push(data);
	}

	// Check if over budget for category
	if (data.category) {
		const cat = getCategoryById(data.category);
		if (cat) {
			const spent = getSpentForCategory(data.category);
			const alloc = Number(cat.allocated) || 0;
			if (spent > alloc && alloc > 0) {
				tool.notify(`⚠ Warning: "${cat.name}" category is now over budget by ${fmtCurrency(spent - alloc, getCurrency())}`, 'warning');
			}
		}
	}

	closeAllModals();
	persist();
	renderExpenses();
	tool.notify(id ? 'Expense updated' : 'Expense logged', 'success');
}

function deleteExpense(id) {
	const e = DB.expenses.find(x => x.id === id);
	if (!e) return;
	openConfirm('Delete Expense', `Delete expense "${e.description}" for ${fmtCurrency(e.amount, getCurrency())}?`, () => {
		DB.expenses = DB.expenses.filter(x => x.id !== id);
		closeAllModals();
		persist();
		renderExpenses();
		tool.notify('Expense deleted', 'success');
	});
}

/* ══════════════════════════════════════════
   REPORTS
══════════════════════════════════════════ */
function renderReports() {
	const cur = getCurrency();
	const totalBudget = getTotalBudget();
	const totalSpent = getTotalSpent();
	const totalAllocated = getTotalAllocated();
	const remaining = totalBudget - totalSpent;

	el('report-stats').innerHTML = `
		<div class="stat-card accent">
			<div class="stat-label">Total Budget</div>
			<div class="stat-value">${fmtCurrency(totalBudget, cur)}</div>
		</div>
		<div class="stat-card green">
			<div class="stat-label">Total Spent</div>
			<div class="stat-value">${fmtCurrency(totalSpent, cur)}</div>
		</div>
		<div class="stat-card ${remaining >= 0 ? 'blue' : 'red'}">
			<div class="stat-label">Remaining</div>
			<div class="stat-value">${fmtCurrency(Math.abs(remaining), cur)}</div>
			<div class="stat-sub">${remaining >= 0 ? '' : 'OVER BUDGET'}</div>
		</div>
		<div class="stat-card amber">
			<div class="stat-label">Budget Utilization</div>
			<div class="stat-value">${getBudgetUtilizationPct().toFixed(0)}%</div>
		</div>
	`;

	// Budget vs Actual spending by category
	const maxVal = Math.max(totalBudget, 1);
	const catRows = DB.budgetCategories.map(c => {
		const spent = getSpentForCategory(c.id);
		const alloc = Number(c.allocated) || 0;
		const allocPct = maxVal > 0 ? (alloc / maxVal) * 100 : 0;
		const spentPct = maxVal > 0 ? (spent / maxVal) * 100 : 0;
		return { name: c.name, color: c.color || '#0d9488', alloc, spent, allocPct, spentPct };
	});
	// Also show unallocated spending
	const unallocatedSpent = DB.expenses.filter(e => !e.category || !getCategoryById(e.category)).reduce((s, e) => s + (Number(e.amount) || 0), 0);
	if (unallocatedSpent > 0) {
		catRows.push({ name: 'Uncategorized', color: 'var(--text3)', alloc: 0, spent: unallocatedSpent, allocPct: 0, spentPct: maxVal > 0 ? (unallocatedSpent / maxVal) * 100 : 0 });
	}

	el('report-budget-vs-actual').innerHTML = catRows.length === 0
		? '<div class="empty-state">No budget categories defined</div>'
		: catRows.map(r => `<div class="report-bar-row">
			<div class="report-bar-label">${esc(r.name)}</div>
			<div class="report-bar-track">
				<div class="report-bar-bg"></div>
				<div class="report-bar-plan" style="width:${r.allocPct}%"></div>
				<div class="report-bar-actual" style="width:${r.spentPct}%"></div>
			</div>
			<div class="report-bar-amount">${fmtCurrency(r.spent, cur)} / ${fmtCurrency(r.alloc, cur)}</div>
		</div>`).join('')
		+ '<div style="font-size:10px;color:var(--text3);margin-top:6px;display:flex;gap:16px"><span>■ Planned (Budget Allocation)</span><span>■ Actual Spending</span></div>';

	// Spending by activity
	const maxActSpent = Math.max(...DB.activities.map(a => getSpentForActivity(a.id)), 1);
	el('report-spending-by-activity').innerHTML = DB.activities.length === 0
		? '<div class="empty-state">No activities planned</div>'
		: DB.activities.map(a => {
			const spent = getSpentForActivity(a.id);
			const alloc = getActivityBudget(a);
			const pct = maxActSpent > 0 ? (spent / maxActSpent) * 100 : 0;
			const overBudget = alloc > 0 && spent > alloc;
			return `<div class="category-bar-row">
				<div class="category-bar-color" style="background:${overBudget ? 'var(--red)' : 'var(--accent)'}"></div>
				<div class="category-bar-label" style="width:120px">${esc(a.name)}</div>
				<div class="category-bar-track">
					<div class="category-bar-fill" style="width:${pct}%;background:${overBudget ? 'var(--red)' : 'var(--accent)'}"></div>
				</div>
				<div class="category-bar-amount">${fmtCurrency(spent, cur)}${alloc > 0 ? ' / ' + fmtCurrency(alloc, cur) : ''}</div>
			</div>`;
		}).join('');

	// Expense timeline
	const sortedExps = [...DB.expenses].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
	el('report-expense-timeline').innerHTML = sortedExps.length === 0
		? '<div class="empty-state">No expenses recorded</div>'
		: '<ul class="timeline-list">' + sortedExps.map(e => {
			const act = e.activityId ? getActivityById(e.activityId) : null;
			const cat = e.category ? getCategoryById(e.category) : null;
			return `<li class="timeline-item">
				<div class="timeline-date">${fmtDate(e.date)}</div>
				<div class="timeline-dot" style="background:${cat ? cat.color : 'var(--accent)'}"></div>
				<div class="timeline-content">
					<div class="timeline-title">${esc(e.description || 'Expense')}</div>
					<div class="timeline-meta">${act ? esc(act.name) + ' · ' : ''}${cat ? esc(cat.name) + ' · ' : ''}${e.vendor ? esc(e.vendor) : ''}</div>
				</div>
				<div class="timeline-amount">${fmtCurrency(e.amount, cur)}</div>
			</li>`;
		}).join('') + '</ul>';

	tool.resize();
}

function exportCSV() {
	if (DB.expenses.length === 0) { tool.notify('No expenses to export', 'warning'); return; }
	const cur = getCurrency();
	const sym = CURRENCY_SYMBOLS[cur] || '$';
	const headers = ['Date', 'Description', 'Amount', 'Activity', 'Category', 'Vendor', 'Receipt Ref', 'Notes'];
	const rows = DB.expenses.map(e => {
		const act = e.activityId ? getActivityById(e.activityId) : null;
		const cat = e.category ? getCategoryById(e.category) : null;
		return [
			e.date || '',
			(e.description || '').replace(/"/g, '""'),
			e.amount || 0,
			(act ? act.name : '').replace(/"/g, '""'),
			(cat ? cat.name : '').replace(/"/g, '""'),
			(e.vendor || '').replace(/"/g, '""'),
			(e.receiptRef || '').replace(/"/g, '""'),
			(e.notes || '').replace(/"/g, '""')
		].map(v => '"' + v + '"').join(',');
	});
	const csv = [headers.join(','), ...rows].join('\n');
	const blob = new Blob([csv], { type: 'text/csv' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `grant-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
	a.click();
	URL.revokeObjectURL(url);
	tool.notify('Expenses exported to CSV', 'success');
}

/* ══════════════════════════════════════════
   EVENT BINDINGS
══════════════════════════════════════════ */
function bindEvents() {
	// Theme toggle
	el('theme-toggle').addEventListener('click', toggleTheme);

	// Navigation
	qsa('.nav-item').forEach(n => {
		n.addEventListener('click', () => navigate(n.dataset.page));
	});

	// Quick expense button
	el('btn-quick-expense').addEventListener('click', () => {
		navigate('expenses');
		setTimeout(() => openExpenseModal(null), 100);
	});

	// Grant save
	el('btn-save-grant').addEventListener('click', saveGrant);

	// Phase stepper
	qsa('.phase-step').forEach(step => {
		step.addEventListener('click', () => setPhase(step.dataset.phase));
	});

	// Document modal
	el('btn-add-document').addEventListener('click', () => openDocumentModal(null));
	el('btn-close-document').addEventListener('click', closeAllModals);
	el('btn-cancel-document').addEventListener('click', closeAllModals);
	el('btn-save-document').addEventListener('click', saveDocument);
	el('btn-delete-document').addEventListener('click', () => {
		const id = el('f-doc-id').value;
		if (id) { closeAllModals(); deleteDocument(id); }
	});

	// Activity modal
	el('btn-add-activity').addEventListener('click', () => openActivityModal(null));
	el('btn-close-activity').addEventListener('click', closeAllModals);
	el('btn-cancel-activity').addEventListener('click', closeAllModals);
	el('btn-save-activity').addEventListener('click', saveActivity);
	el('btn-delete-activity').addEventListener('click', () => {
		const id = el('f-act-id').value;
		if (id) { closeAllModals(); deleteActivity(id); }
	});
	el('btn-add-line-item').addEventListener('click', addLineItem);
	el('f-act-auto-sum').addEventListener('change', refreshLineItemsTotal);

	// Activity filters
	el('act-search').addEventListener('input', renderActivities);
	el('act-filter-status').addEventListener('change', renderActivities);
	el('act-filter-priority').addEventListener('change', renderActivities);

	// Category modal
	el('btn-add-category').addEventListener('click', () => openCategoryModal(null));
	el('btn-close-category').addEventListener('click', closeAllModals);
	el('btn-cancel-category').addEventListener('click', closeAllModals);
	el('btn-save-category').addEventListener('click', saveCategory);
	el('btn-delete-category').addEventListener('click', () => {
		const id = el('f-cat-id').value;
		if (id) { closeAllModals(); deleteCategory(id); }
	});

	// Expense modal
	el('btn-add-expense').addEventListener('click', () => openExpenseModal(null));
	el('btn-close-expense').addEventListener('click', closeAllModals);
	el('btn-cancel-expense').addEventListener('click', closeAllModals);
	el('btn-save-expense').addEventListener('click', saveExpense);
	el('btn-delete-expense').addEventListener('click', () => {
		const id = el('f-exp-id').value;
		if (id) { closeAllModals(); deleteExpense(id); }
	});

	// Expense filters
	el('exp-search').addEventListener('input', renderExpenses);
	el('exp-filter-activity').addEventListener('change', renderExpenses);
	el('exp-filter-category').addEventListener('change', renderExpenses);

	// Confirm modal
	el('btn-confirm-cancel').addEventListener('click', () => { closeAllModals(); });
	el('btn-confirm-ok').addEventListener('click', () => {
		if (confirmCb) { confirmCb(); confirmCb = null; }
		closeAllModals();
	});

	// Modal backdrop click to close
	el('modal-backdrop').addEventListener('click', (e) => {
		if (e.target === el('modal-backdrop')) closeAllModals();
	});

	// Delegate table actions
	document.addEventListener('click', (e) => {
		const btn = e.target.closest('[data-action]');
		if (!btn) return;
		const action = btn.dataset.action;
		const id = btn.dataset.id;

		switch (action) {
			case 'edit-activity': openActivityModal(id); break;
			case 'delete-activity': deleteActivity(id); break;
			case 'edit-expense': openExpenseModal(id); break;
			case 'delete-expense': deleteExpense(id); break;
			case 'edit-category': openCategoryModal(id); break;
			case 'delete-category': deleteCategory(id); break;
			case 'edit-document': openDocumentModal(id); break;
			case 'delete-document': deleteDocument(id); break;
		}
	});

	// Export CSV
	el('btn-export-csv').addEventListener('click', exportCSV);

	// Keyboard shortcut: Escape to close modals
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && !el('modal-backdrop').hidden) closeAllModals();
	});
}

/* ══════════════════════════════════════════
   ENTRY POINT
══════════════════════════════════════════ */
tool.onReady((val, fields) => {
	bindEvents();
	render(val);
	if (tool.isReadOnly()) lockUI(true);

	tool.onValueChange(v => render(v));
	tool.onFieldsChange(f => syncFields(f));
	tool.onReadonlyChange(ro => lockUI(ro));
});