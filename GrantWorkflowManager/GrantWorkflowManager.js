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
	grant: { name: '', year: '', targetAppDate: '', funder: '', totalBudget: 0, targetBudget: 0, approvedBudget: 0, otherFunding: 0, currency: 'USD', startDate: '', endDate: '', description: '', phase: 'drafting', problem: '', goals: '', method: '', beneficiaries: '', sustainability: '' },
	activities: [],
	expenses: [],
	budgetCategories: [],
	documents: [],
	applicationSources: [],
	applicationQA: [],
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
let quickInputCb = null;
let currentQAIndex = 0;
let isReviewing = false;

/* ── Phase ── */
function getPhase() { return DB.grant.phase || 'drafting'; }
function setPhase(p) {
	if (DB.grant.phase === p) return;
	DB.grant.phase = p;
	// Instant UI: just toggle body class + stepper dots (CSS handles nav visibility)
	document.body.className = document.body.className.replace(/phase-\S+/g, '');
	document.body.classList.add('phase-' + p);
	updatePhaseStepper();
	// Refresh dashboard stats only (lightweight — no full DOM rebuild)
	refreshDashboardStats();
	// Persist the phase change
	persist();
	// Only fully render expense/report tabs if navigating to them now
	if (currentPage === 'expenses') renderExpenses();
	if (currentPage === 'reports') renderReports();
}

function refreshDashboardStats() {
	// Fast partial update — only stat cards and phase badge, not full rebuild
	const g = getGrant();
	const cur = getCurrency();
	const totalBudget = getTotalBudget();
	const totalSpent = getTotalSpent();
	const remaining = totalBudget - totalSpent;
	const phase = getPhase();
	const isPreApproval = phase === 'drafting' || phase === 'applied';
	const actCount = DB.activities.length;
	const expCount = DB.expenses.length;
	const catCount = DB.budgetCategories.length;
	const docCount = DB.documents.length;
	const ongoingActs = DB.activities.filter(a => a.status === 'in-progress').length;
	const utilizationPct = getBudgetUtilizationPct();

	// Update phase badge in subtitle
	const phaseBadge = `<span class="badge badge-${phase === 'drafting' ? 'low' : phase === 'applied' ? 'medium' : phase === 'approved' ? 'in-progress' : 'completed'}">${phase.charAt(0).toUpperCase() + phase.slice(1)}</span>`;
	if (el('dash-grant-sub')) {
		el('dash-grant-sub').innerHTML = g.name
			? `${g.funder || 'Unknown Funder'}${g.year ? ' · ' + g.year : ''} &nbsp; ${phaseBadge}`
			: 'Set up your grant to get started';
	}

	// Fast stat row update
	if (el('dash-stats')) {
		el('dash-stats').innerHTML = `
			<div class="stat-card accent"><div class="stat-label">Total Budget</div><div class="stat-value">${fmtCurrency(totalBudget, cur)}</div><div class="stat-sub">${catCount} budget categories</div></div>
			<div class="stat-card ${isPreApproval ? 'purple' : (remaining >= 0 ? 'green' : 'red')}"><div class="stat-label">${isPreApproval ? 'Planned Activities' : 'Total Spent'}</div><div class="stat-value">${isPreApproval ? actCount : fmtCurrency(totalSpent, cur)}</div><div class="stat-sub">${isPreApproval ? ongoingActs + ' in progress' : expCount + ' expenses recorded'}</div></div>
			<div class="stat-card ${isPreApproval ? 'blue' : (remaining >= 0 ? 'blue' : 'red')}"><div class="stat-label">${isPreApproval ? 'Documents' : 'Remaining'}</div><div class="stat-value">${isPreApproval ? docCount : fmtCurrency(Math.abs(remaining), cur)}</div><div class="stat-sub">${isPreApproval ? 'attached to application' : (remaining >= 0 ? (remaining === totalBudget ? 'No spending yet' : utilPctText(utilizationPct)) : 'OVER BUDGET!')}</div></div>
			<div class="stat-card ${isPreApproval ? 'amber' : 'purple'}"><div class="stat-label">Phase</div><div class="stat-value" style="font-size:20px">${phase === 'drafting' ? '📝' : phase === 'applied' ? '📤' : phase === 'approved' ? '✅' : '🏁'}</div><div class="stat-sub">${phase === 'drafting' ? 'Preparing application' : phase === 'applied' ? 'Awaiting decision' : phase === 'approved' ? 'Active execution' : 'Completed'}</div></div>`;
	}

	// Toggle checklist visibility
	const checklistCard = el('dash-checklist-card');
	if (checklistCard) checklistCard.style.display = isPreApproval ? '' : 'none';
	if (isPreApproval && el('dash-checklist')) renderChecklist();

	// Toggle bottom row (expenses/categories)
	const bottomRow = el('dash-bottom-row');
	if (bottomRow) bottomRow.style.display = isPreApproval ? 'none' : '';

	// Update budget bar labels
	if (el('dash-budget-bar')) el('dash-budget-bar').style.width = utilizationPct + '%';
	if (el('dash-budget-spent')) el('dash-budget-spent').textContent = isPreApproval ? 'Budget planned: ' + fmtCurrency(totalBudget, cur) : fmtCurrency(totalSpent, cur) + ' spent';
	if (el('dash-budget-remaining')) el('dash-budget-remaining').textContent = isPreApproval ? 'Ready for allocation' : fmtCurrency(Math.max(0, remaining), cur) + ' remaining';

	// Refresh category bars if approved
	if (!isPreApproval && el('dash-category-breakdown')) renderDashboardCategories(cur);
	if (!isPreApproval && el('dash-recent-expenses')) renderDashboardExpenses(cur);
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
			grant: { name: '', year: '', targetAppDate: '', funder: '', totalBudget: 0, currency: 'USD', startDate: '', endDate: '', description: '', phase: 'drafting', problem: '', goals: '', method: '', beneficiaries: '', sustainability: '' },
			activities: [],
			expenses: [],
			budgetCategories: [],
			documents: [],
			applicationSources: [],
			applicationQA: [],
			checklist: {},
			_theme: 'light'
		}, val);
		if (!DB.grant || typeof DB.grant !== 'object') DB.grant = { name: '', id: '', funder: '', totalBudget: 0, currency: 'USD', startDate: '', endDate: '', description: '', phase: 'drafting', problem: '', goals: '', method: '', beneficiaries: '', sustainability: '' };
		if (!Array.isArray(DB.activities)) DB.activities = [];
		if (!Array.isArray(DB.expenses)) DB.expenses = [];
		if (!Array.isArray(DB.budgetCategories)) DB.budgetCategories = [];
		if (!Array.isArray(DB.documents)) DB.documents = [];
		if (!Array.isArray(DB.applicationSources)) DB.applicationSources = [];
		if (!Array.isArray(DB.applicationQA)) DB.applicationQA = [];
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
		case 'application': renderApplicationQA(); break;
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
	set('nav-application-count', (DB.applicationQA && DB.applicationQA.length) || 0);
}

/* ── Grant helpers ── */
function getGrant() { return DB.grant || {}; }
function getCurrency() { return getGrant().currency || 'USD'; }
function getTotalBudget() {
	const g = getGrant();
	const phase = g.phase || 'drafting';
	// Phase-aware budget: use approved budget if available, otherwise target/total
	if (phase === 'approved' || phase === 'closed') {
		return Number(g.approvedBudget) || Number(g.totalBudget) || Number(g.targetBudget) || 0;
	}
	return Number(g.targetBudget) || Number(g.totalBudget) || 0;
}

function getActiveBudgetLabel() {
	const phase = getPhase();
	if (phase === 'drafting') return 'Target Budget';
	if (phase === 'applied') return 'Applied Budget';
	if (phase === 'approved' || phase === 'closed') return 'Approved Budget';
	return 'Budget';
}

function refreshBudgetSummary() {
	const phase = getPhase();
	const grantInp = el('bs-input-grant');
	const otherInp = el('bs-input-other');

	const grantVal = grantInp ? parseFloat(grantInp.value) || 0 : 0;
	const otherVal = otherInp ? parseFloat(otherInp.value) || 0 : 0;
	const total = grantVal + otherVal;

	const fmt = (n) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

	const bsValTotal = el('bs-val-total');
	const bsLabelGrant = el('bs-label-grant');
	const bsDotGrant = el('bs-dot-grant');
	const bsHelpGrant = el('bs-help-grant');
	const barGrant = el('bs-bar-grant');
	const barOther = el('bs-bar-other');

	if (bsValTotal) bsValTotal.textContent = fmt(total);

	// Phase-aware label, dot color, and help text
	const grantLabel = (phase === 'approved' || phase === 'closed') ? 'Approved Grant' : 'Grant Funding';
	if (bsLabelGrant) bsLabelGrant.textContent = grantLabel;
	if (bsDotGrant) bsDotGrant.style.background = (phase === 'approved' || phase === 'closed') ? 'var(--green)' : 'var(--accent)';
	if (bsHelpGrant) {
		bsHelpGrant.setAttribute('data-tip',
			(phase === 'approved' || phase === 'closed')
				? 'The actual amount the grantor approved. This may differ from what you applied for. All expense tracking uses this figure.'
				: 'The amount you are requesting from this grant. In Drafting this is your estimate. After applying it becomes your Applied Budget.'
		);
	}

	// Bar chart
	if (total > 0) {
		const grantPct = (grantVal / total) * 100;
		const otherPct = (otherVal / total) * 100;
		if (barGrant) { barGrant.style.width = grantPct + '%'; barGrant.style.display = grantPct > 0 ? '' : 'none'; }
		if (barOther) { barOther.style.width = otherPct + '%'; barOther.style.display = otherPct > 0 ? '' : 'none'; }
	} else {
		if (barGrant) { barGrant.style.width = '0%'; barGrant.style.display = 'none'; }
		if (barOther) { barOther.style.width = '0%'; barOther.style.display = 'none'; }
	}
}

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

// Safe element value setter — silently skips missing elements
function setVal(id, val) { const e = el(id); if (e) e.value = val; }
function getVal(id, fallback) { const e = el(id); return e ? e.value : (fallback !== undefined ? fallback : ''); }

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

function openQuickInput(title, label, placeholder, cb) {
	quickInputCb = cb;
	el('qui-title').textContent = title;
	el('qui-label').textContent = label;
	el('qui-input').placeholder = placeholder || '';
	el('qui-input').value = '';
	openModal('modal-quick-input');
	setTimeout(() => el('qui-input').focus(), 100);
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
		? `${g.funder || 'Unknown Funder'}${g.year ? ' · ' + g.year : ''} &nbsp; ${phaseBadge}`
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
	{ key: 'problem_stmt', label: 'Write project summary', hint: 'Grant Setup' },
	{ key: 'application_qa', label: 'Complete application Q&A (AI-powered)', hint: 'Apply' },
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
		problem_stmt: !!(g.problem && g.problem.length > 20),
		application_qa: (DB.applicationQA && DB.applicationQA.length >= 3 && DB.applicationQA.filter(q => (q.answer || '').length > 20).length >= 2),
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
		const target = item.key === 'categories' ? 'budget' : item.key === 'activities' ? 'activities' : item.key === 'documents' ? 'documents' : item.key === 'application_qa' ? 'application' : 'grant';
		return `<div class="checklist-item${isDone ? ' done' : ''}" onclick="navigate('${target}')">
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

/* ══════════════════════════════════════════
   APPLICATION Q&A — AI-Powered Dynamic Questions
   Uses CMS iframe communication for AI & file upload
══════════════════════════════════════════ */

// AI & Upload helpers (communicate via tool SDK / parent CMS)
// Protocol: parent CMS receives {type:'tool:ai', prompt, context} and responds with {type:'tool:ai:result', response}
// For file upload: parent receives {type:'tool:upload', accept} and responds with {type:'tool:upload:result', file:{name,url,size,type}}
// These are implemented in the test harness mock; in production the CMS handles them.

function requestAIGenerate(prompt, context) {
	return new Promise((resolve, reject) => {
		// Use tool.param to check if AI is available
		if (typeof tool.requestAI === 'function') {
			tool.requestAI(prompt, context, (err, response) => {
				if (err) reject(err);
				else resolve(response);
			});
		} else {
			// Fallback: show guidance
			resolve(null);
		}
	});
}

function requestFileUpload(accept) {
	return new Promise((resolve, reject) => {
		if (typeof tool.requestUpload === 'function') {
			tool.requestUpload(accept, (err, file) => {
				if (err) reject(err);
				else resolve(file);
			});
		} else {
			resolve(null);
		}
	});
}

function requestFileContent(fileUrl) {
	return new Promise((resolve, reject) => {
		if (typeof tool.requestFileContent === 'function') {
			tool.requestFileContent(fileUrl, (err, content) => {
				if (err) reject(err);
				else resolve(content);
			});
		} else {
			resolve(null);
		}
	});
}

// Document Intelligence: analyzes company/org docs + grant requirements to guide the user
function analyzeDocumentGaps() {
	const sources = DB.applicationSources || [];
	const docs = DB.documents || [];
	if (sources.length === 0 && docs.length === 0) {
		tool.notify('Add source documents or upload files first to get gap analysis.', 'info');
		return;
	}

	// Build analysis from available metadata
	const hasOrgDoc = docs.some(d => d.type === 'org-doc');
	const hasFinancial = docs.some(d => d.type === 'financial');
	const hasProposal = docs.some(d => d.type === 'proposal');
	const hasGrantDoc = docs.some(d => d.type === 'grant-doc');
	const hasSupport = docs.some(d => d.type === 'support-letter');
	const sourceNames = sources.map(s => s.name).join(', ');

	let warnings = [];
	if (!hasOrgDoc) warnings.push('⚠ Missing: Organization charter/registration document. Most funders require proof of legal status.');
	if (!hasFinancial) warnings.push('⚠ Missing: Financial statements or budget documents. Funders typically require recent financial records.');
	if (!hasGrantDoc) warnings.push('⚠ Missing: Grant agreement or call document. Upload the grant call PDF for AI analysis.');
	if (!hasSupport) warnings.push('💡 Consider adding: Support letters from partners strengthen your application significantly.');
	if ((DB.applicationQA || []).length === 0) warnings.push('🤖 No application questions yet. Use "Generate Questions" to create grant-specific Q&A.');
	if (!getGrant().problem || getGrant().problem.length < 30) warnings.push('📝 Project summary is brief. Consider expanding it in Grant Setup.');

	if (warnings.length === 0) {
		tool.notify('✅ Your application documents look comprehensive! All key document types are present.', 'success');
	} else {
		const msg = warnings.slice(0, 4).join('\n');
		// Show in a modal-style notification
		tool.notify('Document Analysis:\n' + msg, 'warning');
		// Also show in the Q&A sources card
		const sourcesCard = el('app-qa-sources-card');
		if (sourcesCard) {
			const existingBanner = sourcesCard.querySelector('.doc-gap-banner');
			if (existingBanner) existingBanner.remove();
			const banner = document.createElement('div');
			banner.className = 'doc-gap-banner';
			banner.style.cssText = 'margin-top:8px;padding:8px 10px;background:var(--amber-bg);border:1px solid var(--amber);border-radius:var(--r3);font-size:11px;color:var(--amber);line-height:1.5';
			banner.innerHTML = '<strong>📋 Recommended documents:</strong><br>' + warnings.map(w => w.replace(/^[^\s]+\s/, '')).join('<br>');
			sourcesCard.appendChild(banner);
		}
	}
	return warnings;
}

function renderApplicationQA() {
	const hasQuestions = DB.applicationQA && DB.applicationQA.length > 0;
	const hasSources = DB.applicationSources && DB.applicationSources.length > 0;
	const isActive = hasQuestions || hasSources;

	el('app-qa-empty').style.display = isActive ? 'none' : '';
	el('app-qa-active').style.display = isActive ? '' : 'none';

	if (isActive) {
		renderQANav();
		renderQASourcesInline();
		renderQACurrentQuestion();
		updateQAProgress();
		updateQAScore();
	}
	updateNavBadges();
	tool.resize();
}

/* ── Question Navigator Sidebar ── */
function renderQANav() {
	const questions = DB.applicationQA || [];
	const container = el('qa-nav');
	if (!container) return;

	let html = '';
	questions.forEach((q, i) => {
		let dotClass = '';
		if (q.aiScore != null) dotClass = ' scored';
		else if ((q.answer || '').trim().length > 0) dotClass = ' filled';

		const active = i === currentQAIndex ? ' active' : '';
		const label = esc(q.question).substring(0, 30) + (q.question.length > 30 ? '…' : '');
		html += `<div class="qa-nav-item${active}" data-index="${i}" onclick="selectQuestion(${i})">
			<span class="qa-nav-dot${dotClass}"></span>
			<span class="qa-nav-num">${i + 1}</span>
			<span class="qa-nav-label">${label}</span>
		</div>`;
	});

	html += `<div class="qa-nav-add" onclick="addAppQuestion()">+ Add Question</div>`;

	container.innerHTML = html;
}

/* ── Current Question Panel ── */
function renderQACurrentQuestion() {
	const questions = DB.applicationQA || [];
	const panel = el('qa-panel');
	if (!panel) return;

	if (questions.length === 0) {
		panel.innerHTML = '<div class="qa-panel-empty" style="text-align:center;padding:60px 20px;color:var(--text3)"><div style="font-size:36px;margin-bottom:8px">📝</div><div>No questions yet. Add a source document and click "Generate Questions"</div></div>';
		return;
	}

	if (currentQAIndex >= questions.length) currentQAIndex = questions.length - 1;
	if (currentQAIndex < 0) currentQAIndex = 0;

	const q = questions[currentQAIndex];
	const answer = q.answer || '';
	const score = q.aiScore;

	let scoreHtml = '';
	if (score != null) {
		const sc = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
		scoreHtml = `<span class="qa-panel-score ${sc}">AI Score: ${score}/100</span>`;
	}

	panel.innerHTML = `
		<div class="qa-panel-header">
			<div>
				<div class="qa-panel-qnum">Question ${currentQAIndex + 1} of ${questions.length}</div>
				<div class="qa-panel-question">${esc(q.question)}</div>
			</div>
			${scoreHtml}
		</div>
		<textarea class="qa-panel-answer" id="qa-panel-answer" placeholder="Type your answer here... (save happens automatically on blur)" onblur="updateAppAnswer(${currentQAIndex}, this.value)">${esc(answer)}</textarea>
		<div class="qa-panel-meta">
			<span>${q.source ? '📎 From: ' + esc(q.source) : '✏️ Custom question'}</span>
			<span>${answer.length} characters</span>
		</div>
		<div class="qa-panel-nav">
			<button class="btn btn-ghost btn-sm" onclick="goPrevQuestion()" ${currentQAIndex === 0 ? 'disabled' : ''}>← Previous</button>
			<button class="btn btn-ghost btn-sm" onclick="removeAppQuestion(${currentQAIndex})" style="color:var(--red)">🗑 Delete</button>
			<button class="btn btn-ghost btn-sm" onclick="goNextQuestion()" ${currentQAIndex >= questions.length - 1 ? 'disabled' : ''}>Next →</button>
		</div>
	`;
}

/* ── Navigation ── */
function selectQuestion(index) {
	const questions = DB.applicationQA || [];
	if (index < 0 || index >= questions.length) return;

	// Save current answer first
	const curAnswer = el('qa-panel-answer');
	if (curAnswer && currentQAIndex < questions.length && currentQAIndex >= 0) {
		questions[currentQAIndex].answer = curAnswer.value;
		persist();
	}

	currentQAIndex = index;
	renderQANav();
	renderQACurrentQuestion();
	updateQAProgress();
}

function goPrevQuestion() { selectQuestion(currentQAIndex - 1); }
function goNextQuestion() { selectQuestion(currentQAIndex + 1); }

/* ── Answer Update ── */
function updateAppAnswer(index, value) {
	const questions = DB.applicationQA || [];
	if (index < 0 || index >= questions.length) return;
	questions[index].answer = value || '';
	renderQANav();
	updateQAProgress();
	persist();
}

/* ── Progress ── */
function updateQAProgress() {
	const questions = DB.applicationQA || [];
	const total = questions.length;
	const filled = questions.filter(q => (q.answer || '').trim().length > 0).length;
	const pct = total > 0 ? Math.round((filled / total) * 100) : 0;

	const fill = el('qa-progress-fill');
	const text = el('qa-progress-text');
	if (fill) fill.style.width = pct + '%';
	if (text) text.textContent = pct + '% complete (' + filled + '/' + total + ' answered)';
}

/* ── AI Quality Score ── */
function updateQAScore() {
	const questions = DB.applicationQA || [];
	const scored = questions.filter(q => q.aiScore != null);
	if (scored.length === 0) {
		const wrap = el('qa-score-wrap');
		if (wrap) wrap.style.display = 'none';
		return;
	}

	const avg = Math.round(scored.reduce((s, q) => s + (q.aiScore || 0), 0) / scored.length);
	const wrap = el('qa-score-wrap');
	const value = el('qa-score-value');
	const badge = el('qa-score-badge');

	if (wrap) wrap.style.display = '';
	if (value) value.textContent = avg + '/100';
	if (badge) {
		badge.textContent = avg >= 70 ? 'Strong' : avg >= 40 ? 'Adequate' : 'Needs Work';
		badge.className = 'qa-score-badge ' + (avg >= 70 ? 'high' : avg >= 40 ? 'medium' : 'low');
	}
}

/* ── AI Review All Answers ── */
function reviewAllAnswers() {
	const questions = DB.applicationQA || [];
	if (questions.length === 0) { tool.notify('No questions to review', 'warning'); return; }
	if (isReviewing) return;

	isReviewing = true;
	const btn = el('btn-ai-review');
	if (btn) { btn.disabled = true; btn.textContent = '⏳ Reviewing...'; }

	// Build prompt with all Q&A
	const qaText = questions.map((q, i) => `Q${i + 1}: ${q.question}\nA${i + 1}: ${q.answer || '(not answered)'}`).join('\n\n');
	const prompt = `Review these grant application answers. For each question, assign a quality score from 0-100 based on: completeness, specificity, relevance, and persuasiveness. Return ONLY a JSON array of numbers, e.g. [85, 60, 90, 30]. Do NOT include any other text.\n\n${qaText}`;

	tool.notify('AI is reviewing your answers...', 'info');

	requestAIGenerate(prompt, 'Answer quality review').then(response => {
		let scores = [];
		if (response) {
			try {
				const parsed = JSON.parse(response);
				scores = Array.isArray(parsed) ? parsed : [];
			} catch (e) {
				scores = [];
			}
		}
		// Fallback: basic heuristic
		if (scores.length !== questions.length) {
			scores = questions.map(q => {
				const a = (q.answer || '').trim();
				if (!a) return 0;
				let sc = 20;
				if (a.length > 50) sc += 15;
				if (a.length > 150) sc += 15;
				if (a.length > 300) sc += 10;
				if (/\d/.test(a)) sc += 10;
				if (/because|therefore|specifically|for example/i.test(a)) sc += 15;
				if (/outcome|measure|impact|result/i.test(a)) sc += 15;
				return Math.min(100, sc);
			});
			tool.notify('AI unavailable — used basic answer analysis. Connect AI for deeper review.', 'info');
		} else {
			tool.notify(`AI reviewed ${scores.length} answers!`, 'success');
		}

		questions.forEach((q, i) => { q.aiScore = scores[i] != null ? Math.round(Number(scores[i])) : null; });
		updateQAScore();
		renderQANav();
		renderQACurrentQuestion();
		persist();
		isReviewing = false;
		if (btn) { btn.disabled = false; btn.textContent = '⭐ AI Review All Answers'; }
	}).catch(() => {
		tool.notify('AI review failed. Try again later.', 'error');
		isReviewing = false;
		if (btn) { btn.disabled = false; btn.textContent = '⭐ AI Review All Answers'; }
	});
}

/* ── Sources (inline bottom bar) ── */
function renderQASourcesInline() {
	const sources = DB.applicationSources || [];
	const container = el('qa-sources-list');
	if (!container) return;
	if (sources.length === 0) {
		container.innerHTML = 'None';
	} else {
		container.innerHTML = sources.map((s, i) =>
			`<span class="source-doc-card"><span class="source-doc-icon">${s.type === 'url' ? '🔗' : '📄'}</span>${esc(s.name || 'Untitled')} <button class="btn btn-ghost btn-xs" onclick="removeAppSource(${i})" style="color:var(--red);margin-left:4px">×</button></span>`
		).join('');
	}
}

function startApplicationQA() {
	if (!DB.applicationSources) DB.applicationSources = [];
	if (!DB.applicationQA) DB.applicationQA = [];
	if (DB.applicationQA.length === 0) {
		const g = getGrant();
		DB.applicationQA = [
			{ id: genId(), question: 'Describe your organization and its mission.', answer: '', source: 'Organization profile', aiScore: null },
			{ id: genId(), question: 'What is the specific problem or need this project addresses?', answer: g.problem || '', source: 'Grant Setup', aiScore: null },
			{ id: genId(), question: 'What are the key objectives and expected outcomes?', answer: g.goals || '', source: 'Grant Setup', aiScore: null }
		];
	}
	currentQAIndex = 0;
	renderApplicationQA();
	persist();
}

function addAppSource() {
	setVal('f-src-name', '');
	setVal('f-src-url', '');
	openModal('modal-add-source');
	const nameEl = el('f-src-name');
	if (nameEl) setTimeout(() => nameEl.focus(), 100);
}

function saveAppSource() {
	const name = getVal('f-src-name').trim();
	const url = getVal('f-src-url').trim();
	if (!name) { tool.notify('Source name is required', 'warning'); return; }
	const type = url ? 'url' : 'file';
	if (!DB.applicationSources) DB.applicationSources = [];
	DB.applicationSources.push({
		id: genId(), name, type, url, fileName: '', dateAdded: new Date().toISOString().slice(0, 10)
	});
	closeAllModals();
	renderApplicationQA();
	persist();
	tool.notify('Source added. Use "Generate Questions" to analyze it with AI.', 'success');
}

function uploadAppSourceFile() {
	tool.notify('Opening file picker...', 'info');
	if (typeof tool.requestUpload === 'function') {
		tool.requestUpload('.pdf,.docx,.txt', (err, file) => {
			if (err) { tool.notify('Upload failed: ' + err, 'error'); return; }
			const urlEl = el('f-src-url'); if (urlEl) urlEl.value = file.url || '';
			const nameEl = el('f-src-name'); if (nameEl && !nameEl.value) nameEl.value = file.name || '';
			tool.notify(`Uploaded: ${file.name}`, 'success');
		});
	} else {
		tool.notify('File upload requires CMS integration. Paste a URL or use the test harness mock.', 'warning');
	}
}

function removeAppSource(index) {
	if (!DB.applicationSources) return;
	DB.applicationSources.splice(index, 1);
	renderApplicationQA();
	persist();
}

function generateQuestions() {
	const sources = DB.applicationSources || [];
	if (sources.length === 0) {
		tool.notify('Add source documents or URLs first, then generate questions.', 'warning');
		return;
	}

	// Build context from sources
	const sourceSummary = sources.map(s => `${s.name} (${s.type}): ${s.url || s.fileName || 'uploaded'}`).join('; ');
	const prompt = `Based on the following grant application sources: ${sourceSummary}. Generate 5-8 specific questions that the applicant needs to answer for this grant. The grant is "${getGrant().name || 'Untitled'}" from "${getGrant().funder || 'Unknown funder'}". Make questions specific and practical. Return ONLY a JSON array of question strings.`;

	// Show loading in the panel
	const panel = el('qa-panel');
	if (panel) panel.innerHTML = '<div class="ai-loading"><div class="ai-loading-dots"><span></span><span></span><span></span></div>Analyzing documents with AI...</div>';
	tool.resize();

	requestAIGenerate(prompt, sourceSummary).then(response => {
		let questions = [];
		if (response) {
			try {
				const parsed = JSON.parse(response);
				questions = Array.isArray(parsed) ? parsed : [];
			} catch (e) {
				questions = response.split('\n').filter(l => l.trim().length > 10).map(l => l.replace(/^\d+[\.\)]\s*/, '').trim());
			}
		}

		if (questions.length === 0) {
			questions = generateFallbackQuestions();
			tool.notify('AI not available — using template questions. Integrate AI via CMS for custom results.', 'info');
		} else {
			tool.notify(`AI generated ${questions.length} questions!`, 'success');
		}

		if (!DB.applicationQA) DB.applicationQA = [];
		questions.forEach(q => {
			DB.applicationQA.push({ id: genId(), question: q, answer: '', source: 'AI-generated from sources', aiScore: null });
		});
		currentQAIndex = DB.applicationQA.length - questions.length; // focus first new question
		renderApplicationQA();
		persist();
	}).catch(() => {
		const questions = generateFallbackQuestions();
		if (!DB.applicationQA) DB.applicationQA = [];
		questions.forEach(q => {
			DB.applicationQA.push({ id: genId(), question: q, answer: '', source: 'Template (AI unavailable)', aiScore: null });
		});
		currentQAIndex = Math.max(0, DB.applicationQA.length - questions.length);
		renderApplicationQA();
		persist();
		tool.notify('Generated template questions. Connect AI via CMS for custom grant-specific questions.', 'info');
	});
}

function generateFallbackQuestions() {
	const g = getGrant();
	return [
		'Describe your organization\'s experience and capacity to deliver this project.',
		'What is the detailed timeline for project implementation?',
		'How will you measure success? Provide specific metrics and indicators.',
		'What partnerships or collaborations will support this project?',
		'Describe your budget in detail — how will each dollar be spent?',
		'What risks could affect the project, and how will you mitigate them?',
		'How will you ensure the project benefits reach the target community?',
		'What is your plan for reporting and communicating results to stakeholders?'
	];
}

function addAppQuestion() {
	openQuickInput('Add Custom Question', 'Enter your custom question:', '', (q) => {
		if (!q) return;
		if (!DB.applicationQA) DB.applicationQA = [];
		DB.applicationQA.push({ id: genId(), question: q, answer: '', source: 'Manually added', aiScore: null });
		currentQAIndex = DB.applicationQA.length - 1;
		renderApplicationQA();
		persist();
	});
}

function removeAppQuestion(index) {
	if (!DB.applicationQA) return;
	DB.applicationQA.splice(index, 1);
	if (currentQAIndex >= DB.applicationQA.length) currentQAIndex = Math.max(0, DB.applicationQA.length - 1);
	renderApplicationQA();
	persist();
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
	const phase = getPhase();
	el('grant-name').value = g.name || '';
	if (el('grant-year')) el('grant-year').value = g.year || '';
	if (el('grant-app-date')) el('grant-app-date').value = g.targetAppDate || '';
	el('grant-funder').value = g.funder || '';
	// Editable budget breakdown — phase-aware grant amount
	const bsGrant = el('bs-input-grant');
	const bsOther = el('bs-input-other');
	if (bsGrant) bsGrant.value = (phase === 'approved' || phase === 'closed')
		? (g.approvedBudget || g.targetBudget || g.totalBudget || '')
		: (g.targetBudget || g.totalBudget || '');
	if (bsOther) bsOther.value = g.otherFunding || '';
	el('grant-currency').value = g.currency || 'USD';
	el('grant-start').value = g.startDate || '';
	el('grant-end').value = g.endDate || '';
	el('grant-desc').value = g.description || '';
	el('grant-problem').value = g.problem || '';
	if (el('grant-goals')) el('grant-goals').value = g.goals || '';
	if (el('grant-method')) el('grant-method').value = g.method || '';
	if (el('grant-beneficiaries')) el('grant-beneficiaries').value = g.beneficiaries || '';
	if (el('grant-sustainability')) el('grant-sustainability').value = g.sustainability || '';

	refreshBudgetSummary();
}

function saveGrant() {
	const name = el('grant-name').value.trim();
	const funder = el('grant-funder').value.trim();
	const phase = getPhase();

	// Read from editable budget breakdown
	const bsGrant = el('bs-input-grant');
	const bsOther = el('bs-input-other');
	const budget = bsGrant ? parseFloat(bsGrant.value) || 0 : 0;
	const otherFunding = bsOther ? parseFloat(bsOther.value) || 0 : 0;

	if (!name) { tool.notify('Grant name is required', 'warning'); return; }
	// Funder and budget are optional — can be filled in later

	DB.grant = {
		name: name,
		funder: funder,
		year: el('grant-year')?.value || DB.grant.year || '',
		targetAppDate: el('grant-app-date')?.value || DB.grant.targetAppDate || '',
		totalBudget: budget,
		targetBudget: (phase === 'approved' || phase === 'closed') ? (DB.grant.targetBudget || budget) : budget,
		approvedBudget: (phase === 'approved' || phase === 'closed') ? budget : (DB.grant.approvedBudget || 0),
		otherFunding: otherFunding,
		currency: el('grant-currency').value,
		startDate: el('grant-start').value,
		endDate: el('grant-end').value,
		description: el('grant-desc').value.trim(),
		phase: DB.grant.phase || 'drafting',
		problem: el('grant-problem').value.trim(),
		goals: el('grant-goals')?.value?.trim() || DB.grant.goals || '',
		method: el('grant-method')?.value?.trim() || DB.grant.method || '',
		beneficiaries: el('grant-beneficiaries')?.value?.trim() || DB.grant.beneficiaries || '',
		sustainability: el('grant-sustainability')?.value?.trim() || DB.grant.sustainability || ''
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
	const titleEl = el('modal-activity-title');
	if (titleEl) titleEl.textContent = id ? 'Edit Activity' : 'Add Activity';
	setVal('f-act-id', id || '');
	setVal('f-act-name', a ? a.name : '');
	setVal('f-act-start', a ? a.startDate : '');
	setVal('f-act-end', a ? a.endDate : '');
	setVal('f-act-budget', a ? (a.budgetAllocated || '') : '');
	setVal('f-act-estimated-budget', a ? (a.estimatedBudget || '') : '');
	setVal('f-act-attendees', a ? (a.expectedAttendees || '') : '');
	setVal('f-act-desc', a ? (a.description || '') : '');
	setVal('f-act-priority', a ? (a.priority || 'medium') : 'medium');
	setVal('f-act-status', a ? (a.status || 'planned') : 'planned');

	// Outcomes
	setVal('f-act-actual-attendees', a ? (a.actualAttendees || '') : '');
	setVal('f-act-completion', a ? (a.completionPct || '') : '');
	setVal('f-act-outcomes', a ? (a.outcomes || '') : '');
	setVal('f-act-lessons', a ? (a.lessons || '') : '');

	// Populate category dropdown
	const catSelect = el('f-act-category');
	if (catSelect) {
		catSelect.innerHTML = '<option value="">Select category...</option>' + DB.budgetCategories.map(c => `<option value="${c.id}" ${a && a.category === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
		if (a) catSelect.value = a.category || '';
	}

	// Line items
	const hasLineItems = a && a.lineItems && a.lineItems.length > 0;
	lineItemsBuffer = hasLineItems ? a.lineItems.map(li => ({...li})) : [];
	const autoSum = a ? (a.lineItems && a.lineItems.length > 0) : true;
	const autoSumEl = el('f-act-auto-sum');
	if (autoSumEl) autoSumEl.checked = autoSum;
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
	const autoSumEl = el('f-act-auto-sum');
	const budgetEl = el('f-act-budget');
	if (autoSumEl && autoSumEl.checked && budgetEl) {
		const total = getLineItemsTotal(lineItemsBuffer);
		budgetEl.value = total > 0 ? total.toFixed(2) : '';
	}
}

function refreshLineItemsTotal() {
	const total = getLineItemsTotal(lineItemsBuffer);
	const cur = getCurrency();
	const totalEl = el('line-items-total');
	if (totalEl) {
		if (lineItemsBuffer.length > 0) {
			totalEl.style.display = 'block';
			totalEl.textContent = 'Line items total: ' + fmtCurrency(total, cur);
		} else {
			totalEl.style.display = 'none';
		}
	}
	const autoSumEl = el('f-act-auto-sum');
	const budgetEl = el('f-act-budget');
	const autoSum = autoSumEl && autoSumEl.checked;
	if (autoSum && lineItemsBuffer.length > 0 && budgetEl) {
		budgetEl.readOnly = true;
		budgetEl.style.opacity = '0.6';
		const total2 = getLineItemsTotal(lineItemsBuffer);
		budgetEl.value = total2 > 0 ? total2.toFixed(2) : '';
	} else if (budgetEl) {
		budgetEl.readOnly = false;
		budgetEl.style.opacity = '1';
	}
}

function saveActivity() {
	const id = getVal('f-act-id');
	const name = getVal('f-act-name').trim();
	if (!name) { tool.notify('Activity name is required', 'warning'); return; }

	const autoSumEl = el('f-act-auto-sum');
	const autoSum = autoSumEl && autoSumEl.checked && lineItemsBuffer.length > 0;
	const budgetManual = parseFloat(getVal('f-act-budget', '0')) || 0;
	const budgetFromItems = getLineItemsTotal(lineItemsBuffer);
	const finalBudget = autoSum ? budgetFromItems : budgetManual;

	const data = {
		id: id || genId(),
		name: name,
		description: getVal('f-act-desc').trim(),
		startDate: getVal('f-act-start'),
		endDate: getVal('f-act-end'),
		budgetAllocated: finalBudget,
		estimatedBudget: parseFloat(getVal('f-act-estimated-budget', '0')) || 0,
		expectedAttendees: parseInt(getVal('f-act-attendees', '0')) || 0,
		category: getVal('f-act-category'),
		priority: getVal('f-act-priority'),
		status: getVal('f-act-status'),
		lineItems: lineItemsBuffer.length > 0 ? lineItemsBuffer.map(li => ({
			id: li.id, description: li.description || '', cost: Number(li.cost) || 0, status: li.status || 'planned'
		})) : [],
		actualAttendees: parseInt(getVal('f-act-actual-attendees', '0')) || 0,
		completionPct: parseInt(getVal('f-act-completion', '0')) || 0,
		outcomes: getVal('f-act-outcomes').trim(),
		lessons: getVal('f-act-lessons').trim()
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
	renderReportTab(currentReportTab || 'summary');
	tool.resize();
}

let currentReportTab = 'summary';

function switchReportTab(tab) {
	currentReportTab = tab;
	qsa('.report-tab').forEach(t => t.classList.toggle('active', t.dataset.rtab === tab));
	qsa('.report-tab-content').forEach(c => c.classList.toggle('active', c.id === 'rtab-' + tab));
	renderReportTab(tab);
	tool.resize();
}

function renderReportTab(tab) {
	const cur = getCurrency();
	switch (tab) {
		case 'summary': renderReportSummary(cur); break;
		case 'financial': renderReportFinancial(cur); break;
		case 'activities': renderReportActivities(cur); break;
		case 'narrative': renderReportNarrative(cur); break;
		case 'export': renderReportExport(cur); break;
	}
}

/* ── Tab 1: Executive Summary ── */
function renderReportSummary(cur) {
	const g = getGrant();
	const totalBudget = getTotalBudget();
	const totalSpent = getTotalSpent();
	const remaining = totalBudget - totalSpent;
	const actCount = DB.activities.length;
	const completed = DB.activities.filter(a => a.status === 'completed').length;
	const inProgress = DB.activities.filter(a => a.status === 'in-progress').length;
	const expCount = DB.expenses.length;
	const docCount = DB.documents.length;
	const phase = getPhase();
	const totalAttendees = DB.activities.reduce((s, a) => s + (a.expectedAttendees || 0), 0);
	const totalActual = DB.activities.reduce((s, a) => s + (a.actualAttendees || 0), 0);

	const html = `
		<div class="report-kpi-row">
			<div class="report-kpi"><div class="report-kpi-value">${fmtCurrency(totalBudget, cur)}</div><div class="report-kpi-label">Total Budget</div></div>
			<div class="report-kpi"><div class="report-kpi-value">${fmtCurrency(totalSpent, cur)}</div><div class="report-kpi-label">Total Spent</div></div>
			<div class="report-kpi"><div class="report-kpi-value" style="color:${remaining >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtCurrency(remaining, cur)}</div><div class="report-kpi-label">Remaining</div></div>
			<div class="report-kpi"><div class="report-kpi-value">${getBudgetUtilizationPct().toFixed(0)}%</div><div class="report-kpi-label">Utilization</div></div>
			<div class="report-kpi"><div class="report-kpi-value">${actCount}</div><div class="report-kpi-label">Activities</div></div>
			<div class="report-kpi"><div class="report-kpi-value">${expCount}</div><div class="report-kpi-label">Expenses</div></div>
		</div>
		<div class="report-summary-grid">
			<div class="card">
				<div class="card-header"><span class="card-title">Grant Overview</span></div>
				<div style="font-size:12px;line-height:1.8">
					<div><strong>Grant:</strong> ${esc(g.name || '—')}</div>
					<div><strong>Funder:</strong> ${esc(g.funder || '—')}</div>
					<div><strong>Year:</strong> ${esc(g.year || '—')}</div>
					<div><strong>Target App Date:</strong> ${fmtDate(g.targetAppDate) || '—'}</div>
					<div><strong>Funding Period:</strong> ${fmtDate(g.startDate)} → ${fmtDate(g.endDate)}</div>
					<div><strong>Phase:</strong> ${phase.charAt(0).toUpperCase() + phase.slice(1)}</div>
					<div><strong>Documents:</strong> ${docCount} attached</div>
				</div>
			</div>
			<div class="card">
				<div class="card-header"><span class="card-title">Activity Status</span></div>
				<div style="font-size:12px;line-height:1.8">
					<div>✅ Completed: <strong>${completed}</strong></div>
					<div>🔄 In Progress: <strong>${inProgress}</strong></div>
					<div>📋 Planned: <strong>${DB.activities.filter(a => a.status === 'planned').length}</strong></div>
					<div>❌ Cancelled: <strong>${DB.activities.filter(a => a.status === 'cancelled').length}</strong></div>
					<div style="margin-top:6px">👥 Expected Attendees: <strong>${totalAttendees}</strong></div>
					<div>✅ Actual Attendees: <strong>${totalActual}</strong></div>
				</div>
			</div>
			<div class="card">
				<div class="card-header"><span class="card-title">Budget Status</span></div>
				<div style="font-size:12px;line-height:1.8">
					<div>📦 Categories: <strong>${DB.budgetCategories.length}</strong></div>
					<div>💰 Total Allocated: <strong>${fmtCurrency(getTotalAllocated(), cur)}</strong></div>
					<div>💸 Total Spent: <strong>${fmtCurrency(totalSpent, cur)}</strong></div>
					<div>🏦 Remaining: <strong class="${remaining >= 0 ? 'text-green' : 'text-red'}">${fmtCurrency(remaining, cur)}</strong></div>
				</div>
			</div>
			<div class="card">
				<div class="card-header"><span class="card-title">Budget Utilization</span></div>
				<div id="report-summary-bars">${buildCategoryBars(cur)}</div>
			</div>
		</div>`;

	el('rtab-summary').innerHTML = html;
}

function buildCategoryBars(cur) {
	if (DB.budgetCategories.length === 0) return '<div class="empty-state">No budget categories</div>';
	const maxAlloc = Math.max(...DB.budgetCategories.map(c => Number(c.allocated) || 0), 1);
	return DB.budgetCategories.map(c => {
		const spent = getSpentForCategory(c.id);
		const alloc = Number(c.allocated) || 0;
		const spentPct = alloc > 0 ? Math.min(100, (spent / alloc) * 100) : 0;
		return `<div class="category-bar-row">
			<div class="category-bar-color" style="background:${c.color || '#0d9488'}"></div>
			<div class="category-bar-label">${esc(c.name)}</div>
			<div class="category-bar-track"><div class="category-bar-fill" style="width:${spentPct}%;background:${c.color || '#0d9488'}"></div></div>
			<div class="category-bar-amount">${fmtCurrency(spent, cur)} / ${fmtCurrency(alloc, cur)}</div>
		</div>`;
	}).join('');
}

/* ── Tab 2: Financial Report ── */
function renderReportFinancial(cur) {
	const totalBudget = getTotalBudget();
	const totalSpent = getTotalSpent();
	const remaining = totalBudget - totalSpent;

	let html = `
		<div class="report-kpi-row">
			<div class="report-kpi"><div class="report-kpi-value">${fmtCurrency(totalBudget, cur)}</div><div class="report-kpi-label">Budget</div></div>
			<div class="report-kpi"><div class="report-kpi-value">${fmtCurrency(totalSpent, cur)}</div><div class="report-kpi-label">Spent</div></div>
			<div class="report-kpi"><div class="report-kpi-value" style="color:${remaining >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtCurrency(remaining, cur)}</div><div class="report-kpi-label">Variance</div></div>
			<div class="report-kpi"><div class="report-kpi-value">${getBudgetUtilizationPct().toFixed(0)}%</div><div class="report-kpi-label">Utilization</div></div>
		</div>
		<div class="card" style="margin-bottom:14px">
			<div class="card-header"><span class="card-title">Budget Variance by Category</span></div>
			<div class="table-wrap">
				<table>
					<thead><tr><th>Category</th><th>Allocated</th><th>Spent</th><th>Remaining</th><th>Variance %</th><th>Status</th></tr></thead>
					<tbody>`;

	if (DB.budgetCategories.length === 0) {
		html += '<tr><td class="table-empty" colspan="6">No categories defined</td></tr>';
	} else {
		DB.budgetCategories.forEach(c => {
			const spent = getSpentForCategory(c.id);
			const alloc = Number(c.allocated) || 0;
			const rem = alloc - spent;
			const varPct = alloc > 0 ? ((spent - alloc) / alloc * 100) : 0;
			const status = spent > alloc ? '⚠ Over' : spent === 0 ? 'Not started' : rem < alloc * 0.1 ? 'Nearly done' : 'On track';
			const varClass = spent > alloc ? 'var-neg' : spent === 0 ? 'var-neutral' : 'var-pos';
			html += `<tr>
				<td><div style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:${c.color || '#0d9488'}"></span>${esc(c.name)}</div></td>
				<td class="amount-cell">${fmtCurrency(alloc, cur)}</td>
				<td class="amount-cell">${fmtCurrency(spent, cur)}</td>
				<td class="amount-cell ${rem < 0 ? 'text-red' : ''}">${fmtCurrency(rem, cur)}</td>
				<td class="amount-cell ${varClass}">${varPct > 0 ? '+' : ''}${varPct.toFixed(1)}%</td>
				<td><span class="badge badge-${spent > alloc ? 'cancelled' : spent === 0 ? 'low' : 'completed'}">${status}</span></td>
			</tr>`;
		});
	}
	html += '</tbody></table></div></div>';

	// Spending by activity
	html += `<div class="card" style="margin-bottom:14px">
		<div class="card-header"><span class="card-title">Spending by Activity</span></div>`;
	const maxActSpent = Math.max(...DB.activities.map(a => getSpentForActivity(a.id)), 1);
	if (DB.activities.length === 0) {
		html += '<div class="empty-state">No activities planned</div>';
	} else {
		html += DB.activities.map(a => {
			const spent = getSpentForActivity(a.id);
			const alloc = getActivityBudget(a);
			const pct = maxActSpent > 0 ? (spent / maxActSpent) * 100 : 0;
			const over = alloc > 0 && spent > alloc;
			return `<div class="category-bar-row">
				<div class="category-bar-color" style="background:${over ? 'var(--red)' : 'var(--accent)'}"></div>
				<div class="category-bar-label" style="width:130px">${esc(a.name)}</div>
				<div class="category-bar-track"><div class="category-bar-fill" style="width:${pct}%;background:${over ? 'var(--red)' : 'var(--accent)'}"></div></div>
				<div class="category-bar-amount">${fmtCurrency(spent, cur)}${alloc > 0 ? ' / ' + fmtCurrency(alloc, cur) : ''}</div>
			</div>`;
		}).join('');
	}
	html += '</div>';

	// Expense timeline
	const sortedExps = [...DB.expenses].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
	html += `<div class="card"><div class="card-header"><span class="card-title">All Expenses</span><span style="font-size:11px;color:var(--text3)">${DB.expenses.length} total</span></div>`;
	if (sortedExps.length === 0) {
		html += '<div class="empty-state">No expenses recorded</div>';
	} else {
		html += '<ul class="timeline-list">' + sortedExps.map(e => {
			const act = e.activityId ? getActivityById(e.activityId) : null;
			const cat = e.category ? getCategoryById(e.category) : null;
			return `<li class="timeline-item">
				<div class="timeline-date">${fmtDate(e.date)}</div>
				<div class="timeline-dot" style="background:${cat ? cat.color : 'var(--accent)'}"></div>
				<div class="timeline-content"><div class="timeline-title">${esc(e.description || 'Expense')}</div>
				<div class="timeline-meta">${act ? esc(act.name) + ' · ' : ''}${cat ? esc(cat.name) + ' · ' : ''}${e.vendor ? esc(e.vendor) : ''}</div></div>
				<div class="timeline-amount">${fmtCurrency(e.amount, cur)}</div>
			</li>`;
		}).join('') + '</ul>';
	}
	html += '</div>';

	el('rtab-financial').innerHTML = html;
}

/* ── Tab 3: Activity Report ── */
function renderReportActivities(cur) {
	if (DB.activities.length === 0) {
		el('rtab-activities').innerHTML = '<div class="card"><div class="empty-state">No activities to report</div></div>';
		return;
	}
	let html = '';
	DB.activities.forEach(a => {
		const spent = getSpentForActivity(a.id);
		const alloc = getActivityBudget(a);
		const liCount = (a.lineItems && a.lineItems.length) || 0;
		const liDone = a.lineItems ? a.lineItems.filter(li => li.status === 'completed').length : 0;
		const attDiff = (a.actualAttendees || 0) - (a.expectedAttendees || 0);
		html += `<div class="card" style="margin-bottom:12px">
			<div class="card-header">
				<span class="card-title">${statusIcon(a.status)} ${esc(a.name)}</span>
				<span class="badge badge-${a.status || 'planned'}">${(a.status || 'planned').replace('-', ' ')}</span>
			</div>
			<div style="font-size:12px;line-height:1.7">
				<div><strong>Dates:</strong> ${fmtDate(a.startDate)} → ${fmtDate(a.endDate)}</div>
				<div><strong>Budget:</strong> ${fmtCurrency(spent, cur)} spent of ${fmtCurrency(alloc, cur)} allocated${liCount > 0 ? ' · ' + liCount + ' line items (' + liDone + ' done)' : ''}</div>
				<div><strong>Attendees:</strong> ${a.expectedAttendees || 0} expected${a.actualAttendees ? ' · ' + a.actualAttendees + ' actual (' + (attDiff >= 0 ? '+' : '') + attDiff + ')' : ''}</div>
				${a.completionPct ? `<div><strong>Completion:</strong> ${a.completionPct}%</div>` : ''}
				${a.description ? `<div style="margin-top:4px;color:var(--text2)"><strong>Description:</strong> ${esc(a.description)}</div>` : ''}
				${a.outcomes ? `<div style="margin-top:6px;padding:8px 10px;background:var(--green-bg);border-radius:var(--r3);color:var(--green)"><strong>✅ Outcomes:</strong> ${esc(a.outcomes)}</div>` : ''}
				${a.lessons ? `<div style="margin-top:4px;padding:8px 10px;background:var(--blue-bg);border-radius:var(--r3);color:var(--blue)"><strong>💡 Lessons:</strong> ${esc(a.lessons)}</div>` : ''}
			</div>
		</div>`;
	});
	el('rtab-activities').innerHTML = html;
}

/* ── Tab 4: Narrative Report Generator ── */
function renderReportNarrative(cur) {
	const g = getGrant();
	const totalBudget = getTotalBudget();
	const totalSpent = getTotalSpent();
	const remaining = totalBudget - totalSpent;

	const sections = [
		{
			title: '1. Executive Summary',
			body: `Project "${g.name || '[Project Name]'}" was funded by ${g.funder || '[Funder]'} with a total budget of ${fmtCurrency(totalBudget, cur)}. The project ran from ${fmtDate(g.startDate)} to ${fmtDate(g.endDate)}. Of the total budget, ${fmtCurrency(totalSpent, cur)} was spent (${getBudgetUtilizationPct().toFixed(0)}% utilization), leaving ${fmtCurrency(remaining, cur)} remaining. The project comprised ${DB.activities.length} activities, of which ${DB.activities.filter(a => a.status === 'completed').length} were completed and ${DB.activities.filter(a => a.status === 'in-progress').length} are in progress.`
		},
		{
			title: '2. Problem Statement',
			body: g.problem || '[No problem statement provided. Please fill in the Grant Setup → Problem Statement field.]'
		},
		{
			title: '3. Goals & Objectives',
			body: g.goals || '[No goals defined. Please fill in the Grant Setup → Goals & Objectives field.]'
		},
		{
			title: '4. Methodology & Implementation',
			body: g.method || '[No methodology provided. Please fill in the Grant Setup → Methodology field.]'
		},
		{
			title: '5. Activities & Outcomes',
			body: DB.activities.length === 0 ? 'No activities were planned.' :
				DB.activities.map(a => {
					let text = `**${a.name}** (${a.status}) — ${fmtDate(a.startDate)} to ${fmtDate(a.endDate)}. `;
					if (a.outcomes) text += `Outcomes: ${a.outcomes} `;
					if (a.actualAttendees) text += `Reached ${a.actualAttendees} attendees (${a.expectedAttendees || 0} expected). `;
					if (a.lessons) text += `Lessons: ${a.lessons}`;
					return text;
				}).join('\n\n')
		},
		{
			title: '6. Budget & Expenditure',
			body: `Total budget: ${fmtCurrency(totalBudget, cur)}. Total spent: ${fmtCurrency(totalSpent, cur)} (${getBudgetUtilizationPct().toFixed(0)}%). Remaining: ${fmtCurrency(remaining, cur)}.\n\nCategory breakdown:\n` +
				DB.budgetCategories.map(c => {
					const spent = getSpentForCategory(c.id);
					return `- ${c.name}: ${fmtCurrency(spent, cur)} spent of ${fmtCurrency(Number(c.allocated) || 0, cur)} allocated`;
				}).join('\n')
		},
		{
			title: '7. Beneficiaries',
			body: g.beneficiaries || '[No beneficiary information provided. Please fill in the Grant Setup → Beneficiaries field.]'
		},
		{
			title: '8. Sustainability',
			body: g.sustainability || '[No sustainability plan provided. Please fill in the Grant Setup → Sustainability field.]'
		}
	];

	let html = '<div style="margin-bottom:12px;font-size:12px;color:var(--text3)">📝 Copy any section below and paste into your funder report template. Sections marked with [brackets] need your input.</div>';

	sections.forEach(s => {
		html += `<div class="narrative-block">
			<div class="narrative-block-header">
				<span class="narrative-block-title">${s.title}</span>
				<button class="btn btn-ghost btn-xs" onclick="copyNarrativeBlock(this)" data-text="${esc(s.body).replace(/"/g, '&quot;')}">📋 Copy</button>
			</div>
			<div class="narrative-block-body">${esc(s.body)}</div>
		</div>`;
	});

	html += `<div class="card" style="margin-top:12px">
		<div class="card-header"><span class="card-title">📄 Full Report Text</span><button class="btn btn-primary btn-sm" onclick="copyFullNarrative()">📋 Copy All</button></div>
		<div class="narrative-block-body" id="full-narrative-text" style="max-height:400px">${esc(sections.map(s => s.title + '\n' + '='.repeat(s.title.length) + '\n\n' + s.body).join('\n\n' + '—'.repeat(40) + '\n\n'))}</div>
	</div>`;

	el('rtab-narrative').innerHTML = html;
}

function copyNarrativeBlock(btn) {
	const text = btn.dataset.text;
	copyToClipboard(text);
	tool.notify('Copied to clipboard', 'success');
}

function copyFullNarrative() {
	const text = el('full-narrative-text').textContent;
	copyToClipboard(text);
	tool.notify('Full report copied to clipboard', 'success');
}

function copyToClipboard(text) {
	if (navigator.clipboard && navigator.clipboard.writeText) {
		navigator.clipboard.writeText(text);
	} else {
		const ta = document.createElement('textarea');
		ta.value = text;
		ta.style.cssText = 'position:fixed;opacity:0';
		document.body.appendChild(ta);
		ta.select();
		document.execCommand('copy');
		document.body.removeChild(ta);
	}
}

/* ── Tab 5: Export ── */
function renderReportExport(cur) {
	const html = `
		<div class="export-option">
			<div class="export-option-info"><div class="export-option-title">📊 Expenses CSV</div><div class="export-option-desc">All expenses with date, amount, activity, category, vendor, receipt ref, and notes</div></div>
			<button class="btn btn-primary btn-sm" onclick="exportCSV('expenses')">Download</button>
		</div>
		<div class="export-option">
			<div class="export-option-info"><div class="export-option-title">📋 Activities CSV</div><div class="export-option-desc">All activities with status, dates, budget, attendees, outcomes, and lessons learned</div></div>
			<button class="btn btn-primary btn-sm" onclick="exportCSV('activities')">Download</button>
		</div>
		<div class="export-option">
			<div class="export-option-info"><div class="export-option-title">💰 Budget Categories CSV</div><div class="export-option-desc">Budget allocation vs actual spending with variance analysis per category</div></div>
			<button class="btn btn-primary btn-sm" onclick="exportCSV('budget')">Download</button>
		</div>
		<div class="export-option">
			<div class="export-option-info"><div class="export-option-title">📝 Full Narrative Report</div><div class="export-option-desc">Complete narrative report text for pasting into funder templates</div></div>
			<button class="btn btn-primary btn-sm" onclick="switchReportTab('narrative');">Go to Narrative</button>
		</div>
		<div class="export-option">
			<div class="export-option-info"><div class="export-option-title">🖨 Print Report</div><div class="export-option-desc">Print the current report view (use browser print dialog)</div></div>
			<button class="btn btn-primary btn-sm" onclick="window.print()">Print</button>
		</div>`;

	el('rtab-export').innerHTML = html;
}

function exportCSV(type) {
	const cur = getCurrency();
	let headers, rows, filename;
	const today = new Date().toISOString().slice(0, 10);

	if (type === 'expenses') {
		headers = ['Date', 'Description', 'Amount', 'Activity', 'Category', 'Vendor', 'Receipt Ref', 'Notes'];
		rows = DB.expenses.map(e => {
			const act = e.activityId ? getActivityById(e.activityId) : null;
			const cat = e.category ? getCategoryById(e.category) : null;
			return [e.date || '', e.description || '', e.amount || 0, (act ? act.name : ''), (cat ? cat.name : ''), e.vendor || '', e.receiptRef || '', e.notes || ''];
		});
		filename = `grant-expenses-${today}.csv`;
	} else if (type === 'activities') {
		headers = ['Activity', 'Status', 'Start Date', 'End Date', 'Budget Allocated', 'Amount Spent', 'Expected Attendees', 'Actual Attendees', 'Completion %', 'Priority', 'Outcomes', 'Lessons Learned', 'Description'];
		rows = DB.activities.map(a => [a.name, a.status, a.startDate, a.endDate, getActivityBudget(a), getSpentForActivity(a.id), a.expectedAttendees || '', a.actualAttendees || '', a.completionPct || '', a.priority || '', a.outcomes || '', a.lessons || '', a.description || '']);
		filename = `grant-activities-${today}.csv`;
	} else if (type === 'budget') {
		headers = ['Category', 'Allocated', 'Spent', 'Remaining', 'Variance %', 'Status'];
		rows = DB.budgetCategories.map(c => {
			const spent = getSpentForCategory(c.id);
			const alloc = Number(c.allocated) || 0;
			const rem = alloc - spent;
			const varPct = alloc > 0 ? ((spent - alloc) / alloc * 100).toFixed(1) : '0';
			return [c.name, alloc, spent, rem, varPct + '%', spent > alloc ? 'Over Budget' : spent === 0 ? 'Not Started' : 'On Track'];
		});
		filename = `grant-budget-${today}.csv`;
	} else { return; }

	const csv = [headers.join(','), ...rows.map(r => r.map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(','))].join('\n');
	const blob = new Blob([csv], { type: 'text/csv' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
	tool.notify(type.charAt(0).toUpperCase() + type.slice(1) + ' exported', 'success');
}

/* ══════════════════════════════════════════
   EVENT BINDINGS
══════════════════════════════════════════ */
function bindEvents() {
	// Helper: safe event binding
	const on = (id, event, fn) => { const e = el(id); if (e) e.addEventListener(event, fn); };

	// Theme toggle
	on('theme-toggle', 'click', toggleTheme);

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
	on('btn-add-document', 'click', () => openDocumentModal(null));
	on('btn-close-document', 'click', closeAllModals);
	on('btn-cancel-document', 'click', closeAllModals);
	on('btn-save-document', 'click', saveDocument);
	on('btn-delete-document', 'click', () => {
		const id = el('f-doc-id'); if (!id) return;
		closeAllModals(); deleteDocument(id.value);
	});
	on('btn-doc-upload', 'click', () => {
		tool.notify('Opening file picker...', 'info');
		if (typeof tool.requestUpload === 'function') {
			tool.requestUpload('*', (err, file) => {
				if (err) { tool.notify('Upload failed: ' + err, 'error'); return; }
				const u = el('f-doc-url'); if (u) u.value = file.url || '';
				const n = el('f-doc-name'); if (n && !n.value) n.value = file.name || '';
				tool.notify(`Uploaded: ${file.name}`, 'success');
			});
		} else {
			tool.notify('File upload requires CMS integration (tool.requestUpload). Paste URL manually for now.', 'warning');
		}
	});

	// Quick Input modal
	on('btn-save-qui', 'click', () => {
		const inp = el('qui-input');
		const val = inp ? inp.value.trim() : '';
		closeAllModals();
		if (quickInputCb) { const cb = quickInputCb; quickInputCb = null; cb(val); }
	});
	on('btn-cancel-qui', 'click', () => { quickInputCb = null; closeAllModals(); });
	on('btn-close-qui', 'click', () => { quickInputCb = null; closeAllModals(); });

	// Application Q&A
	on('btn-ai-start', 'click', startApplicationQA);
	on('btn-ai-manual', 'click', () => { if (!DB.applicationQA) DB.applicationQA = []; addAppQuestion(); });
	on('btn-ai-generate', 'click', generateQuestions);
	on('btn-ai-add-source', 'click', addAppSource);
	on('btn-ai-add-question', 'click', addAppQuestion);
	on('btn-ai-check-reqs', 'click', analyzeDocumentGaps);

	// Source modal
	on('btn-save-source', 'click', saveAppSource);
	on('btn-cancel-source', 'click', closeAllModals);
	on('btn-close-source', 'click', closeAllModals);
	on('btn-src-upload', 'click', uploadAppSourceFile);

	// Activity modal
	on('btn-add-activity', 'click', () => openActivityModal(null));
	on('btn-close-activity', 'click', closeAllModals);
	on('btn-cancel-activity', 'click', closeAllModals);
	on('btn-save-activity', 'click', saveActivity);
	on('btn-delete-activity', 'click', () => {
		const fe = el('f-act-id'); if (!fe) return;
		const id = fe.value; if (id) { closeAllModals(); deleteActivity(id); }
	});
	on('btn-add-line-item', 'click', addLineItem);
	on('f-act-auto-sum', 'change', refreshLineItemsTotal);

	// Activity filters
	on('act-search', 'input', renderActivities);
	on('act-filter-status', 'change', renderActivities);
	on('act-filter-priority', 'change', renderActivities);

	// Category modal
	on('btn-add-category', 'click', () => openCategoryModal(null));
	on('btn-close-category', 'click', closeAllModals);
	on('btn-cancel-category', 'click', closeAllModals);
	on('btn-save-category', 'click', saveCategory);
	on('btn-delete-category', 'click', () => {
		const fe = el('f-cat-id'); if (!fe) return;
		const id = fe.value; if (id) { closeAllModals(); deleteCategory(id); }
	});

	// Expense modal
	on('btn-add-expense', 'click', () => openExpenseModal(null));
	on('btn-close-expense', 'click', closeAllModals);
	on('btn-cancel-expense', 'click', closeAllModals);
	on('btn-save-expense', 'click', saveExpense);
	on('btn-delete-expense', 'click', () => {
		const fe = el('f-exp-id'); if (!fe) return;
		const id = fe.value; if (id) { closeAllModals(); deleteExpense(id); }
	});

	// Expense filters
	on('exp-search', 'input', renderExpenses);
	on('exp-filter-activity', 'change', renderExpenses);
	on('exp-filter-category', 'change', renderExpenses);

	// Confirm modal
	on('btn-confirm-cancel', 'click', () => { closeAllModals(); });
	on('btn-confirm-ok', 'click', () => {
		if (confirmCb) { confirmCb(); confirmCb = null; }
		closeAllModals();
	});

	// Modal backdrop click to close
	on('modal-backdrop', 'click', (e) => {
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
	qsa('.report-tab').forEach(t => {
		t.addEventListener('click', () => switchReportTab(t.dataset.rtab));
	});

	// Keyboard shortcut: Escape to close modals
	document.addEventListener('keydown', (e) => {
		const mb = el('modal-backdrop');
		if (e.key === 'Escape' && mb && !mb.hidden) closeAllModals();
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