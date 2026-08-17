/* ── MapleBooks Tax Prep · BC ──
   Personal + personal-company tax preparation for a Canadian (BC) taxpayer.
   Loads invoices / bank statements, extracts income & expenses with AI,
   hunts for missed deductions, and prepares regular tax + GST/PST summaries.
   Built for the UniconHub CMS html-tool system (window.tool SDK).
────────────────────────────────────────── */

/* ══ Constants ══ */
var SESSION_TYPE = 'ai-chat-sessions-uniconbaseapps';
var EXTRACT_CAP = 120000;          // chars of document text stored per file
var CHUNK_SIZE = 50000;            // chars per AI analysis prompt
var GST_RATE = 0.05;
var PST_RATE = 0.07;

var INCOME_CATEGORIES = [
	{ id: 'sales', label: 'Sales / Revenue' },
	{ id: 'services', label: 'Services Rendered' },
	{ id: 'employmentIncome', label: 'Employment Income (T4)' },
	{ id: 'interestIncome', label: 'Interest & Investment' },
	{ id: 'otherIncome', label: 'Other Income' }
];
var EXPENSE_CATEGORIES = [
	{ id: 'advertising', label: 'Advertising & Marketing' },
	{ id: 'meals', label: 'Meals & Entertainment (50%)' },
	{ id: 'officeSupplies', label: 'Office Supplies' },
	{ id: 'phoneInternet', label: 'Phone & Internet' },
	{ id: 'rent', label: 'Rent' },
	{ id: 'utilities', label: 'Utilities' },
	{ id: 'vehicle', label: 'Vehicle & Fuel' },
	{ id: 'travel', label: 'Travel' },
	{ id: 'insurance', label: 'Insurance' },
	{ id: 'bankFees', label: 'Bank & Merchant Fees' },
	{ id: 'professionalFees', label: 'Professional & Legal Fees' },
	{ id: 'subcontractors', label: 'Subcontractors & Labour' },
	{ id: 'software', label: 'Software & Subscriptions' },
	{ id: 'equipment', label: 'Equipment & Tools' },
	{ id: 'homeOffice', label: 'Home Office' },
	{ id: 'interest', label: 'Interest on Debt' },
	{ id: 'training', label: 'Training & Education' },
	{ id: 'memberships', label: 'Memberships & Licences' },
	{ id: 'salaries', label: 'Salaries & Wages' },
	{ id: 'otherExpense', label: 'Other Expense' }
];

/* Approximate 2025 BC combined (federal + provincial) marginal rates — planning only */
var BC_BRACKETS_2025 = [
	{ upTo: 47937, rate: 0.2006 },
	{ upTo: 95875, rate: 0.2270 },
	{ upTo: 110076, rate: 0.2820 },
	{ upTo: 133664, rate: 0.3100 },
	{ upTo: 181232, rate: 0.3279 },
	{ upTo: 252752, rate: 0.3829 },
	{ upTo: Infinity, rate: 0.5350 }
];

var KEYWORD_MAP = [
	{ pat: /rent|lease|property tax/i, cat: 'rent' },
	{ pat: /hydro|electric|fortis|bc hydro|utilit|gas bill|heating/i, cat: 'utilities' },
	{ pat: /internet|phone|telus|rogers|shaw|bell|mobile|cell|voip/i, cat: 'phoneInternet' },
	{ pat: /insurance|icbc/i, cat: 'insurance' },
	{ pat: /petro|shell|chevron|esso|fuel|gas station|husky|co-op/i, cat: 'vehicle' },
	{ pat: /mechanic|oil change|tire|auto repair|car wash/i, cat: 'vehicle' },
	{ pat: /uber|lyft|taxi|hotel|flight|air canada|westjet|airbnb|booking|ferry/i, cat: 'travel' },
	{ pat: /restaurant|coffee|starbucks|tim hortons|mcdonald|dinner|lunch|cater|pizza|sushi/i, cat: 'meals' },
	{ pat: /advertis|facebook ads|google ads|marketing|promo|flyer|sponsor/i, cat: 'advertising' },
	{ pat: /office depot|staples|grand.?toy|printer|paper|stationery/i, cat: 'officeSupplies' },
	{ pat: /accountant|lawyer|legal|bookkeep|notary|professional fee/i, cat: 'professionalFees' },
	{ pat: /bank fee|service charge|interac|monthly fee|account fee/i, cat: 'bankFees' },
	{ pat: /microsoft|adobe|dropbox|github|slack|zoom|subscription|domain|hosting|workspace|canva|quickbooks|xero/i, cat: 'software' },
	{ pat: /subcontract|contractor|freelance|labour|labor|payroll|salary|wage/i, cat: 'subcontractors' },
	{ pat: /training|course|udemy|coursera|conference|workshop|seminar|tuition/i, cat: 'training' },
	{ pat: /membership|license|licence|dues|chamber|registration fee/i, cat: 'memberships' },
	{ pat: /interest charge|loan interest/i, cat: 'interest' },
	{ pat: /computer|monitor|laptop|keyboard|tool|hardware|equipment/i, cat: 'equipment' }
];

/* ══ State ══ */
var DB = null;
var CHAT = { messages: [], activeSessionId: '' };
var _sessions = [];
var _sessionsError = false;
var _sessionsLoaded = false;
var _activeSessionId = '';
var isReadOnly = false;
var aiBusy = false;
var _lastRendered = '';
var _lastPersistAt = 0;

/* ══ Helpers ══ */
function el(id) { return document.getElementById(id); }
function qsa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function nowIso() { return new Date().toISOString(); }
function money(n) {
	try { return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n || 0); }
	catch (e) { return '$' + (n || 0).toFixed(2); }
}
function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
function numOrNull(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
function yearOf(d) { var y = parseInt(String(d || '').slice(0, 4), 10); return isNaN(y) ? 0 : y; }
function fmtDate(d) {
	if (!d) return '—';
	var dt = new Date(d.length === 10 ? d + 'T00:00:00' : d);
	if (isNaN(dt.getTime())) return String(d);
	return dt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtBytes(b) {
	if (!b && b !== 0) return '—';
	if (b < 1024) return b + ' B';
	if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
	return (b / 1048576).toFixed(1) + ' MB';
}
function relTime(iso) {
	if (!iso) return '';
	var diff = Date.now() - new Date(iso).getTime();
	var m = Math.floor(diff / 60000);
	if (m < 1) return 'just now';
	if (m < 60) return m + 'm ago';
	var h = Math.floor(m / 60);
	if (h < 24) return h + 'h ago';
	var d = Math.floor(h / 24);
	if (d < 30) return d + 'd ago';
	return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}
function catLabel(id) {
	var c = INCOME_CATEGORIES.concat(EXPENSE_CATEGORIES).find(function (x) { return x.id === id; });
	return c ? c.label : id;
}
function validCat(id, type) {
	var list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
	if (list.some(function (c) { return c.id === id; })) return id;
	return type === 'income' ? 'otherIncome' : 'otherExpense';
}
function classifyKeywords(desc) {
	var d = String(desc || '');
	for (var i = 0; i < KEYWORD_MAP.length; i++) {
		if (KEYWORD_MAP[i].pat.test(d)) return KEYWORD_MAP[i].cat;
	}
	return '';
}
function parseJsonAI(text) {
	if (!text) return null;
	var t = String(text).trim();
	var m = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (m) t = m[1].trim();
	var s = t.indexOf('{');
	var e = t.lastIndexOf('}');
	if (s > -1 && e > s) t = t.slice(s, e + 1);
	try { return JSON.parse(t); } catch (err) { return null; }
}
function chunkText(text, size) {
	var lines = String(text || '').split(/\r?\n/);
	var chunks = [];
	var cur = '';
	for (var i = 0; i < lines.length; i++) {
		if (cur.length + lines[i].length + 1 > size && cur) { chunks.push(cur); cur = ''; }
		cur += lines[i] + '\n';
	}
	if (cur.trim()) chunks.push(cur);
	return chunks.length ? chunks : [''];
}
function toast(message, severity) {
	severity = severity || 'info';
	var c = el('toast-container');
	if (!c) return;
	var t = document.createElement('div');
	t.className = 'toast ' + severity;
	t.textContent = message;
	c.appendChild(t);
	setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300); }, 3200);
}
function notify(msg, sev) {
	toast(msg, sev);
	if (typeof tool.notify === 'function') { try { tool.notify(msg, sev); } catch (e) {} }
}
function setStatus(id, text) { var n = el(id); if (n) n.textContent = text || ''; }

/* ══ DB lifecycle ══ */
function freshDB() {
	var ty = parseInt(tool.param('taxYear', '2025'), 10);
	if (isNaN(ty)) ty = 2025;
	return {
		version: '1.0.0',
		_instanceId: '',
		_parentRecordId: '',
		profile: {
			entityType: 'soleProp', businessName: '', taxYear: ty, fiscalYearEnd: '12-31',
			gstRegistered: 'yes', gstNumber: '', gstFrequency: 'annual', pstRegistered: 'no',
			industry: 'consulting', employmentIncome: 0, otherIncome: 0,
			accountantEmail: tool.param('accountantEmail', '') || ''
		},
		docs: [], transactions: [], checklist: [], suggestions: [], questions: [], activity: [],
		gstAdj: { debits: 0, credits: 0 },
		chatMessages: [], activeSessionId: '',
		_theme: 'light'
	};
}
function normalizeDB(val) {
	var d = val && typeof val === 'object' ? val : {};
	var fresh = freshDB();
	var db = fresh;
	if (d.version) db.version = d.version;
	if (d._instanceId) db._instanceId = d._instanceId;
	if (d._parentRecordId) db._parentRecordId = d._parentRecordId;
	db.profile = Object.assign({}, fresh.profile, d.profile || {});
	db.profile.taxYear = parseInt(db.profile.taxYear, 10) || fresh.profile.taxYear;
	db.gstAdj = Object.assign({}, fresh.gstAdj, d.gstAdj || {});
	db.docs = Array.isArray(d.docs) ? d.docs : [];
	db.transactions = Array.isArray(d.transactions) ? d.transactions : [];
	db.checklist = Array.isArray(d.checklist) ? d.checklist : [];
	db.suggestions = Array.isArray(d.suggestions) ? d.suggestions : [];
	db.questions = Array.isArray(d.questions) ? d.questions : [];
	db.activity = Array.isArray(d.activity) ? d.activity : [];
	db.chatMessages = Array.isArray(d.chatMessages) ? d.chatMessages : [];
	db.activeSessionId = d.activeSessionId || '';
	db._theme = d._theme || 'light';
	return db;
}
function persist() {
	DB._lastSavedAt = Date.now();
	try { tool.setValue(DB); } catch (e) {}
	_lastRendered = JSON.stringify(DB);
	var s = el('topbar-save');
	if (s) { s.textContent = '✓ Saved ' + new Date().toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' }); }
	try { tool.resize(); } catch (e) {}
}
function pushActivity(type, text) {
	DB.activity.unshift({ t: nowIso(), type: type || 'info', text: text });
	if (DB.activity.length > 60) DB.activity.length = 60;
}

/* ══ Checklist ══ */
function defaultChecklist() {
	return [
		{ id: 'ck-bank', label: 'All 12 months of bank & credit-card statements', done: false, source: 'system' },
		{ id: 'ck-invoices', label: 'All sales invoices issued during the year', done: false, source: 'system' },
		{ id: 'ck-receipts', label: 'Expense receipts & vendor bills', done: false, source: 'system' },
		{ id: 'ck-t4', label: 'T4 / T4A / T5 slips (personal income)', done: false, source: 'system' },
		{ id: 'ck-gst-prior', label: 'Prior-year GST return + notice of assessment', done: false, source: 'system' },
		{ id: 'ck-assets', label: 'List of equipment & asset purchases (CCA)', done: false, source: 'system' },
		{ id: 'ck-vehicle', label: 'Vehicle logbook — business km', done: false, source: 'system' },
		{ id: 'ck-homeoffice', label: 'Home-office details (area & expenses)', done: false, source: 'system' },
		{ id: 'ck-review', label: 'Review every AI-classified transaction', done: false, source: 'system' },
		{ id: 'ck-accountant', label: 'Send package to accountant / verify figures', done: false, source: 'system' }
	];
}
function ensureChecklist() {
	if (!DB.checklist.length) DB.checklist = defaultChecklist();
	else {
		defaultChecklist().forEach(function (c) {
			if (!DB.checklist.some(function (x) { return x.id === c.id; })) DB.checklist.push(c);
		});
	}
}
function addChecklistItem(item) {
	var label = String(item.label || '').slice(0, 140);
	if (!label) return;
	if (DB.checklist.some(function (c) { return c.label === label; })) return;
	DB.checklist.push({ id: genId(), label: label, done: false, source: item.source || 'ai' });
}
function toggleChecklist(id) {
	if (isReadOnly) return;
	var c = DB.checklist.find(function (x) { return x.id === id; });
	if (!c) return;
	c.done = !c.done;
	if (c.done) pushActivity('check', '✓ ' + c.label);
	persist(); refreshAll();
}

/* ══ Instance ID (session isolation) ══ */
function resolveInstanceId() {
	if (DB._instanceId && DB._instanceId.length > 20) return DB._instanceId;
	var parentRecordId = '';
	try {
		var q = window.location.search || '';
		var m = q.match(/[?&](objectId|recordId)=([^&?#]+)/);
		if (m) parentRecordId = decodeURIComponent(m[2]);
	} catch (e) {}
	if (!parentRecordId) {
		try { parentRecordId = String(tool.param('objectId', '') || tool.param('recordId', '')); } catch (e) {}
	}
	if (!parentRecordId) {
		try {
			var fields = tool.getFields();
			if (fields && (fields._id || fields.id)) parentRecordId = String(fields._id || fields.id);
		} catch (e) {}
	}
	var suffix = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
	DB._instanceId = parentRecordId ? 'rec_' + parentRecordId + '_' + suffix : 'inst_' + suffix;
	return DB._instanceId;
}

/* ══ AI chat session CRUD ══ */
function loadSessions(cb) {
	if (typeof tool.requestObjects !== 'function') { _sessionsError = true; _sessionsLoaded = true; if (cb) cb([]); return; }
	tool.requestObjects('query', { mainObjectType: SESSION_TYPE }, function (err, result) {
		if (err) {
			_sessionsError = true; _sessionsLoaded = true;
			if (cb) cb([]);
			return;
		}
		var all = (result && result.objects) ? result.objects : [];
		var myId = resolveInstanceId();
		_sessions = [];
		all.forEach(function (obj) {
			var dcb = ((obj.productData || {}).data_categoriesBased || {});
			if (dcb._toolInstanceId === myId) _sessions.push(obj);
			else if (!dcb._toolInstanceId && obj._parentObjectId === DB._parentRecordId) {
				_sessions.push(obj);
				if (typeof tool.requestObjects === 'function') {
					tool.requestObjects('update', {
						mainObjectType: SESSION_TYPE, objectId: obj.id,
						productData: { data_categoriesBased: { _toolInstanceId: myId } }
					}, function () {});
				}
			}
		});
		_sessions.sort(function (a, b) { return String(b.updated || '') > String(a.updated || '') ? 1 : -1; });
		_sessionsLoaded = true;
		if (cb) cb(_sessions);
	});
}
function createSession(cb) {
	if (_sessionsError) { if (cb) cb(null); return; }
	var user = tool.getUser() || {};
	tool.requestObjects('create', {
		mainObjectType: SESSION_TYPE,
		name: 'New Chat',
		productData: {
			data_categoriesBased: {
				messages: [],
				createdAt: nowIso(),
				updatedAt: nowIso(),
				createdBy: { userId: user.id || 'anon', userName: user.name || 'Anonymous' },
				_toolInstanceId: resolveInstanceId()
			}
		}
	}, function (err, result) {
		if (err) { _sessionsError = true; if (cb) cb(null); return; }
		var session = result.object;
		if (session._parentObjectId && !DB._parentRecordId) DB._parentRecordId = session._parentObjectId;
		_sessions.unshift(session);
		if (cb) cb(session);
	});
}
function saveCurrentSession() {
	if (!_activeSessionId || _sessionsError) return;
	if (typeof tool.requestObjects !== 'function') return;
	tool.requestObjects('update', {
		mainObjectType: SESSION_TYPE,
		objectId: _activeSessionId,
		productData: {
			data_categoriesBased: { messages: CHAT.messages, updatedAt: nowIso() }
		}
	}, function (err) { if (err) console.warn('[MapleBooks] session save error:', err); });
}
function autoTitleSession() {
	if (!_activeSessionId || _sessionsError) return;
	var session = _sessions.find(function (s) { return s.id === _activeSessionId; });
	if (!session || (session.name && session.name !== 'New Chat')) return;
	var first = CHAT.messages.find(function (m) { return m.role === 'user' && m.text; });
	if (!first) return;
	var title = first.text.replace(/\s+/g, ' ').trim().slice(0, 60);
	tool.requestObjects('update', { mainObjectType: SESSION_TYPE, objectId: _activeSessionId, name: title }, function () {
		session.name = title;
		renderSessionList();
	});
}
function ensureChatSession(cb) {
	if (_activeSessionId) { cb(); return; }
	if (_sessionsError || typeof tool.requestObjects !== 'function') { _sessionsError = true; cb(); return; }
	createSession(function (session) {
		if (!session) { _sessionsError = true; cb(); return; }
		_activeSessionId = session.id;
		DB.activeSessionId = session.id;
		persist();
		saveCurrentSession();
		cb();
	});
}
function deleteChatSession(id) {
	if (_activeSessionId === id) {
		_activeSessionId = '';
		DB.activeSessionId = '';
		CHAT.messages = [];
		DB.chatMessages = [];
	}
	var i = _sessions.findIndex(function (s) { return s.id === id; });
	if (i > -1) _sessions.splice(i, 1);
	if (typeof tool.requestObjects === 'function') {
		tool.requestObjects('delete', { mainObjectType: SESSION_TYPE, objectId: id }, function (err) {
			if (err) notify('Delete failed: ' + err, 'error');
		});
	}
	persist();
	renderSessionList();
	renderChatMessages();
}
function chatSessionClick(id) {
	if (id === _activeSessionId) return;
	if (_activeSessionId) saveCurrentSession();
	var session = _sessions.find(function (s) { return s.id === id; });
	if (!session) return;
	_activeSessionId = id;
	DB.activeSessionId = id;
	var dcb = ((session.productData || {}).data_categoriesBased || {});
	CHAT.messages = dcb.messages || [];
	DB.chatMessages = CHAT.messages;
	persist();
	renderSessionList();
	renderChatMessages();
}

/* ══ Ledger math ══ */
function isInTaxYear(d) { return yearOf(d) === DB.profile.taxYear; }
function txGst(tx) {
	if (tx.type === 'income') {
		if (tx.category === 'employmentIncome' || tx.category === 'employmentIncome' || DB.profile.gstRegistered !== 'yes') return 0;
		if (tx.gstAmount != null) return num(tx.gstAmount);
		return tx.gstIncluded ? num(tx.amount) * GST_RATE / (1 + GST_RATE) : num(tx.amount) * GST_RATE;
	}
	if (tx.gstAmount != null) return num(tx.gstAmount);
	return tx.gstIncluded ? num(tx.amount) * GST_RATE / (1 + GST_RATE) : 0;
}
function txPst(tx) {
	if (tx.type !== 'expense') return 0;
	if (tx.pstAmount != null) return num(tx.pstAmount);
	return tx.pstIncluded ? num(tx.amount) * PST_RATE / (1 + PST_RATE) : 0;
}
function txDeductible(tx) {
	if (tx.type !== 'expense') return 0;
	return tx.category === 'meals' ? num(tx.amount) * 0.5 : num(tx.amount);
}
function ledgerTotals() {
	var inc = 0, exp = 0;
	DB.transactions.forEach(function (t) {
		if (t.type === 'income') inc += num(t.amount);
		else exp += num(t.amount);
	});
	var personal = txCategorySum('income', ['employmentIncome', 'otherIncome']);
	return { inc: inc, exp: exp, net: inc - exp, bizNet: inc - personal - exp, personal: personal, deductible: DB.transactions.reduce(function (s, t) { return s + txDeductible(t); }, 0) };
}
function txCategorySum(type, cats) {
	return DB.transactions.reduce(function (s, t) {
		if (t.type === type && cats.indexOf(t.category) > -1) return s + num(t.amount);
		return s;
	}, 0);
}
function byCategory(type) {
	var map = {};
	DB.transactions.forEach(function (t) {
		if (t.type !== type) return;
		map[t.category] = (map[t.category] || 0) + num(t.amount);
	});
	var list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
	return list.map(function (c) { return { id: c.id, label: c.label, amount: map[c.id] || 0 }; })
		.filter(function (x) { return x.amount > 0; });
}
function gstTotals() {
	var collected = 0, itc = 0, pstPaid = 0, revenue = 0;
	var monthly = {};
	for (var m = 1; m <= 12; m++) monthly[m] = { rev: 0, col: 0, itc: 0 };
	DB.transactions.forEach(function (t) {
		if (!t.date || !isInTaxYear(t.date)) return;
		var m = parseInt(String(t.date).slice(5, 7), 10);
		if (!monthly[m]) return;
		if (t.type === 'income') {
			if (t.category === 'employmentIncome') return; // T4 income carries no GST
			if (t.category === 'employmentIncome') return; // T4 income has no GST
			monthly[m].rev += num(t.amount);
			var g = txGst(t);
			monthly[m].col += g;
			collected += g;
			revenue += num(t.amount);
		} else {
			var it = DB.profile.gstRegistered === 'yes' ? txGst(t) : 0;
			monthly[m].itc += it;
			itc += it;
			pstPaid += txPst(t);
		}
	});
	var adj = DB.gstAdj || { debits: 0, credits: 0 };
	var net = collected - itc + num(adj.debits) - num(adj.credits);
	return { collected: collected, itc: itc, net: net, pstPaid: pstPaid, revenue: revenue, monthly: monthly };
}
function filingPeriods() {
	var freq = DB.profile.gstFrequency || 'annual';
	if (freq === 'monthly') {
		var out = [];
		for (var m = 1; m <= 12; m++) out.push([m, m]);
		return out;
	}
	if (freq === 'quarterly') return [[1, 3], [4, 6], [7, 9], [10, 12]];
	return [[1, 12]];
}
function computeTaxEstimate() {
	var totals = ledgerTotals();
	var netBiz = totals.bizNet;
	var out = { amount: 0, label: '', note: 'Planning estimate only — not a filing figure. Verify with an accountant.', cpp: 0, breakdown: [] };
	if (DB.profile.entityType === 'corporation') {
		var small = Math.max(0, Math.min(500000, netBiz));
		var over = Math.max(0, netBiz - 500000);
		var t = small * 0.11 + over * 0.27;
		out.amount = t;
		out.label = 'CCPC corporate tax (BC, small-business 11% combined)';
		out.breakdown = [
			{ label: 'Small-business portion @ 11%', amount: small * 0.11 },
			{ label: 'General portion @ 27%', amount: over * 0.27 }
		];
		return out;
	}
	var empFromTx = txCategorySum('income', ['employmentIncome']);
	var otherFromTx = txCategorySum('income', ['otherIncome']);
	var empIncome = Math.max(num(DB.profile.employmentIncome), empFromTx);
	var otherInc = Math.max(num(DB.profile.otherIncome), otherFromTx);
	var taxable = Math.max(0, netBiz) + empIncome + otherInc;
	var tax = 0, prev = 0;
	BC_BRACKETS_2025.forEach(function (b) {
		if (taxable > prev) {
			tax += (Math.min(taxable, b.upTo) - prev) * b.rate;
			prev = b.upTo;
		}
	});
	var credits = Math.min(tax, 3600); // rough basic personal credits (fed + BC)
	tax = Math.max(0, tax - credits);
	// CPP self-employed on business income (2025: 11.9% between $3,500 and $71,300, capped)
	var cppBase = Math.max(0, Math.min(71300, Math.max(0, netBiz)) - 3500);
	var cpp = Math.min(8068.20, cppBase * 0.119);
	out.amount = tax;
	out.cpp = cpp;
	out.label = 'Personal income tax (BC combined, before final credits)';
	out.breakdown = [
		{ label: 'Business net income', amount: Math.max(0, netBiz) },
		{ label: 'Employment + other income', amount: empIncome + otherInc },
		{ label: 'Rough federal + BC tax', amount: tax }
	];
	return out;
}

/* ══ Transactions ══ */
function txKey(t) {
	return (t.date || '') + '|' + Math.round(num(t.amount) * 100) + '|' + String(t.description || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
}
function addTransactions(list, source, docId) {
	var keys = {};
	DB.transactions.forEach(function (t) { keys[txKey(t)] = 1; });
	var added = 0;
	(list || []).forEach(function (t) {
		var amount = Math.abs(num(t.amount));
		var type = t.direction === 'income' ? 'income' : 'expense';
		var tx = {
			id: genId(),
			date: t.date || '',
			description: String(t.description || t.desc || '').slice(0, 160),
			amount: amount,
			type: type,
			category: validCat(t.category, type),
			entity: defaultEntity(),
			gstIncluded: !!t.gstIncluded,
			gstAmount: numOrNull(t.gstAmount),
			pstAmount: numOrNull(t.pstAmount),
			source: source,
			sourceDocId: docId || '',
			confidence: t.confidence || 'medium',
			estimated: source === 'ai' && t.confidence === 'low',
			verified: false,
			notes: ''
		};
		if (!tx.date || !amount) return;
		if (keys[txKey(tx)]) return;
		keys[txKey(tx)] = 1;
		DB.transactions.push(tx);
		added++;
	});
	return added;
}
function defaultEntity() {
	return DB.profile.entityType === 'personal' ? 'personal' : 'company';
}

/* ══ CSV parsing ══ */
function parseCsvRows(text) {
	var lines = String(text || '').split(/\r?\n/).filter(function (l) { return l.trim(); });
	if (!lines.length) return { headers: [], rows: [] };
	var delim = lines[0].indexOf('\t') > -1 ? '\t' : (lines[0].split(',').length >= 2 ? ',' : ';');
	function split(line) {
		return line.split(delim).map(function (c) { return c.replace(/^"|"$/g, '').trim(); });
	}
	var headers = split(lines[0]);
	var rows = [];
	for (var i = 1; i < lines.length; i++) {
		var cells = split(lines[i]);
		if (cells.some(function (c) { return c; })) rows.push(cells);
	}
	return { headers: headers, rows: rows };
}
function isDateLike(v) {
	return /^\d{1,4}[-\/.]\d{1,2}[-\/.]\d{1,2}/.test(v) || /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(v);
}
function normDate(v) {
	var s = String(v || '').trim();
	if (!s) return '';
	var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
	if (m) return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
	m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
	if (m) {
		// Canadian statements are usually DD/MM/YYYY
		return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
	}
	m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2})$/);
	if (m) return '20' + m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
	var dt = new Date(s);
	if (!isNaN(dt.getTime())) {
		return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
	}
	return '';
}
function parseMoney(v) {
	var s = String(v || '').replace(/[$,\s]/g, '');
	var neg = /^\(.*\)$/.test(s) || /^-/.test(s);
	s = s.replace(/[()\-]/g, '');
	var n = parseFloat(s);
	if (isNaN(n)) return 0;
	return neg ? -n : n;
}
function findCsvColumns(headers, rows) {
	var h = headers.map(function (x) { return String(x).toLowerCase(); });
	var idx = { date: -1, desc: -1, debit: -1, credit: -1 };
	h.forEach(function (x, i) {
		if (idx.date < 0 && /date|posted/.test(x)) idx.date = i;
		if (idx.desc < 0 && /desc|detail|narr|memo|payee|merchant|particular/.test(x)) idx.desc = i;
		if (idx.debit < 0 && /debit|withdraw|money out|paid out/.test(x)) idx.debit = i;
		if (idx.credit < 0 && /credit|deposit|money in|paid in/.test(x)) idx.credit = i;
	});
	if (idx.date < 0) {
		for (var i = 0; i < Math.min(20, rows.length); i++) {
			for (var j = 0; j < rows[i].length; j++) {
				if (isDateLike(rows[i][j])) { idx.date = j; break; }
			}
			if (idx.date > -1) break;
		}
	}
	if (idx.debit < 0 && idx.credit < 0) {
		var numericCols = [];
		h.forEach(function (x, i) {
			if (i === idx.date || i === idx.desc) return;
			if (/amount|debit|credit|balance|value/i.test(x)) numericCols.push(i);
		});
		if (!numericCols.length) {
			for (var r = 0; r < Math.min(30, rows.length); r++) {
				for (var c2 = 0; c2 < rows[r].length; c2++) {
					if (c2 === idx.date || c2 === idx.desc) continue;
					if (parseMoney(rows[r][c2]) !== 0 && numericCols.indexOf(c2) < 0) numericCols.push(c2);
				}
			}
		}
		if (numericCols.length === 1) idx.debit = numericCols[0];
		else if (numericCols.length >= 2) {
			// prefer columns whose header mentions debit/credit first, else first two numeric
			var db = numericCols.find(function (i) { return /debit|out/i.test(h[i]); });
			var cr = numericCols.find(function (i) { return /credit|in/i.test(h[i]); });
			if (db === undefined && cr === undefined) { idx.debit = numericCols[0]; idx.credit = numericCols[1]; }
			else { idx.debit = db !== undefined ? db : -1; idx.credit = cr !== undefined ? cr : -1; }
		}
	}
	return idx;
}
function parseCsvDoc(docId) {
	var doc = DB.docs.find(function (d) { return d.id === docId; });
	if (!doc) return;
	if (!doc.extracted) { extractDoc(docId, function () { parseCsvDoc(docId); }); return; }
	setStatus('doc-status', 'Parsing ' + doc.name + '…');
	var parsed = parseCsvRows(doc.extracted);
	if (!parsed.rows.length) {
		doc.status = 'error';
		doc.notes = 'No data rows found in CSV.';
		persist(); refreshAll(); setStatus('doc-status', '');
		return;
	}
	var idx = findCsvColumns(parsed.headers, parsed.rows);
	var list = [];
	parsed.rows.forEach(function (cells) {
		var date = idx.date > -1 ? normDate(cells[idx.date]) : '';
		var desc = idx.desc > -1 ? cells[idx.desc] : cells.filter(function (c, i) {
			return i !== idx.date && i !== idx.debit && i !== idx.credit && !isDateLike(c) && parseMoney(c) === 0;
		}).join(' ');
		var debit = idx.debit > -1 ? parseMoney(cells[idx.debit]) : 0;
		var credit = idx.credit > -1 ? parseMoney(cells[idx.credit]) : 0;
		var amount = 0, direction = '';
		if (debit > 0) { amount = debit; direction = 'expense'; }
		else if (credit > 0) { amount = credit; direction = 'income'; }
		else if (debit < 0) { amount = -debit; direction = 'income'; }
		else if (credit < 0) { amount = -credit; direction = 'expense'; }
		if (!date || !amount || !direction) return;
		list.push({
			date: date, description: desc || 'Bank transaction', amount: amount,
			direction: direction, category: classifyKeywords(desc) || (direction === 'income' ? 'sales' : 'otherExpense'),
			confidence: 'high', gstIncluded: false
		});
	});
	var added = addTransactions(list, 'csv', docId);
	doc.status = 'analyzed';
	doc.analyzedAt = nowIso();
	doc.notes = 'Parsed ' + parsed.rows.length + ' rows · ' + added + ' new transactions. Use "Re-classify with AI" on the Transactions page to improve categories.';
	pushActivity('csv', 'Parsed ' + doc.name + ' → ' + added + ' transactions');
	persist(); refreshAll();
	setStatus('doc-status', '');
	notify(doc.name + ': ' + added + ' transactions imported', 'success');
}

/* ══ Documents ══ */
function kindOf(name) { return /\.csv$/i.test(name || '') ? 'csv' : 'document'; }
function uploadDocs() {
	if (isReadOnly) return;
	setStatus('doc-status', 'Opening file picker…');
	tool.requestUpload('.pdf,.docx,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.heic', function (err, file) {
		if (err) { setStatus('doc-status', ''); notify('Upload failed: ' + err, 'error'); return; }
		var doc = {
			id: genId(), name: file.name, url: file.url, size: file.size, type: file.type,
			kind: kindOf(file.name), status: 'uploaded', extracted: '', analyzedAt: null, txCount: 0, notes: ''
		};
		DB.docs.push(doc);
		persist(); refreshAll();
		pushActivity('doc', '📄 Uploaded ' + file.name);
		notify('Uploaded: ' + file.name, 'success');
		if (doc.kind === 'csv') {
			extractDoc(doc.id, function () { parseCsvDoc(doc.id); });
		} else {
			extractDoc(doc.id, function () { analyzeDoc(doc.id); });
		}
	});
}
function extractDoc(docId, cb) {
	var doc = DB.docs.find(function (d) { return d.id === docId; });
	if (!doc) { if (cb) cb('missing'); return; }
	if (doc.extracted) { if (cb) cb(null); return; }
	setStatus('doc-status', 'Extracting text from ' + doc.name + '…');
	tool.requestFileContent(doc.url, function (err, text) {
		if (err) {
			doc.status = 'error';
			doc.notes = 'Text extraction failed: ' + err;
			persist(); refreshAll(); setStatus('doc-status', '');
			if (cb) cb(err);
			return;
		}
		var truncated = (text || '').length > EXTRACT_CAP;
		doc.extracted = (text || '').slice(0, EXTRACT_CAP);
		doc.status = 'extracted';
		if (truncated) doc.notes = 'Long file — text truncated for AI. Consider splitting multi-month statements.';
		persist(); refreshAll();
		if (cb) cb(null);
	});
}
function analyzeDoc(docId) {
	var doc = DB.docs.find(function (d) { return d.id === docId; });
	if (!doc) return;
	if (!doc.extracted) { extractDoc(docId, function () { analyzeDoc(docId); }); return; }
	setStatus('doc-status', '🤖 AI analyzing ' + doc.name + '…');
	var chunks = chunkText(doc.extracted, CHUNK_SIZE);
	var i = 0;
	function next() {
		if (i >= chunks.length) {
			doc.status = 'analyzed';
			doc.analyzedAt = nowIso();
			doc.txCount = DB.transactions.filter(function (t) { return t.sourceDocId === docId; }).length;
			pushActivity('ai', '🤖 Analyzed ' + doc.name + ' (' + doc.txCount + ' tx)');
			persist(); refreshAll(); setStatus('doc-status', '');
			notify('Analysis complete: ' + doc.name, 'success');
			return;
		}
		var part = chunks[i]; i++;
		tool.requestAI(buildExtractPrompt(part, doc.name + ' (part ' + i + '/' + chunks.length + ')'), '', function (err, resp) {
			if (err && !resp) {
				doc.status = 'error';
				doc.notes = 'AI analysis error: ' + err;
				persist(); refreshAll(); setStatus('doc-status', '');
				return;
			}
			var json = parseJsonAI(resp);
			if (json) {
				var added = addTransactions(json.transactions || [], 'ai', docId);
				(json.missingDocs || []).forEach(function (m) {
					addChecklistItem({ label: typeof m === 'string' ? m : (m.label || m) });
				});
				if (json.notes) doc.notes = ((doc.notes ? doc.notes + ' ' : '') + json.notes).slice(0, 400);
			}
			next();
		});
	}
	next();
}
function analyzeAll() {
	var queue = DB.docs.filter(function (d) { return d.status !== 'analyzed' && d.status !== 'error'; });
	if (!queue.length) { notify('All documents are already analyzed.', 'info'); return; }
	var i = 0;
	function step() {
		if (i >= queue.length) { notify('Finished analyzing ' + queue.length + ' document(s).', 'success'); return; }
		var d = queue[i++];
		if (d.kind === 'csv') extractDoc(d.id, function () { parseCsvDoc(d.id); step(); });
		else extractDoc(d.id, function () { analyzeDoc(d.id); step(); });
	}
	notify('Analyzing ' + queue.length + ' document(s) with AI…', 'info');
	step();
}
function buildExtractPrompt(chunk, docName) {
	return [
		'You are a Canadian bookkeeping AI for a British Columbia taxpayer (tax year ' + DB.profile.taxYear + ').',
		'Extract income and expense transactions from this document chunk.',
		'Categories — income: sales, services, employmentIncome, interestIncome, otherIncome. expense: advertising, meals, officeSupplies, phoneInternet, rent, utilities, vehicle, travel, insurance, bankFees, professionalFees, subcontractors, software, equipment, homeOffice, interest, training, memberships, salaries, otherExpense.',
		'For each transaction return exactly these fields:',
		'  date: "YYYY-MM-DD"',
		'  description: short merchant/vendor name',
		'  amount: positive number (before tax)',
		'  direction: "income" or "expense"',
		'  category: one of the category ids above',
		'  gstAmount: 5% GST portion if visible, else null',
		'  pstAmount: 7% PST portion if visible, else null',
		'  gstIncluded: true if the amount includes GST',
		'  confidence: "high" | "medium" | "low"',
		'Also return:',
		'  missingDocs: array of document types that appear to be missing for a complete Canadian tax file (short strings)',
		'  notes: one-sentence summary of what this document contains',
		'Respond with ONLY valid JSON: {"transactions":[...],"missingDocs":[...],"notes":"..."}',
		'Document: ' + docName,
		'--- START ---',
		chunk,
		'--- END ---'
	].join('\n');
}

/* ══ Tax context for AI ══ */
function buildTaxContext() {
	var gst = gstTotals();
	return JSON.stringify({
		tool: 'MapleBooks Tax Prep (BC, Canada)',
		taxYear: DB.profile.taxYear,
		entityType: DB.profile.entityType,
		province: 'British Columbia',
		profile: DB.profile,
		ledger: {
			income: money(ledgerTotals().inc),
			expenses: money(ledgerTotals().exp),
			net: money(ledgerTotals().bizNet),
			byIncomeCategory: byCategory('income'),
			byExpenseCategory: byCategory('expense')
		},
		gst: {
			registered: DB.profile.gstRegistered,
			collected: money(gst.collected),
			itcs: money(gst.itc),
			net: money(gst.net),
			pstPaid: money(gst.pstPaid)
		},
		documents: DB.docs.map(function (d) { return { name: d.name, kind: d.kind, status: d.status, tx: d.txCount || 0 }; }),
		checklistPending: DB.checklist.filter(function (c) { return !c.done; }).map(function (c) { return c.label; }),
		pendingSuggestions: DB.suggestions.filter(function (s) { return s.status === 'pending'; }),
		questions: DB.questions
	}, null, 1);
}

/* ══ Expense Finder ══ */
function finderEnabled() { return typeof tool.requestAI === 'function'; }
function buildQuestionsPrompt() {
	return [
		'You are a Canadian tax preparer helping a British Columbia taxpayer (tax year ' + DB.profile.taxYear + ', entity: ' + DB.profile.entityType + ') find missed deductible expenses.',
		'Based on the profile, ledger and documents in the context, ask the taxpayer up to 6 SHORT questions whose answers will reveal additional deductible expenses or missing documents.',
		'Focus on: home office, vehicle, phone/internet, travel, meals, equipment, family members helping, subcontractors, subscriptions, professional fees, interest, and GST/PST registrations.',
		'Respond with ONLY valid JSON: {"questions":[{"id":"q1","question":"...","hint":"why this matters"}]}'
	].join('\n');
}
function buildSuggestionsPrompt(withAnswers) {
	var p = [
		'You are a Canadian tax preparer for a British Columbia taxpayer (tax year ' + DB.profile.taxYear + ', entity: ' + DB.profile.entityType + ').',
		'Suggest specific deductible expenses that appear to be MISSING from the ledger, based on profile + ledger + documents.',
		'Return ONLY valid JSON: {"suggestions":[{"name":"short expense name","category":"one of: advertising, meals, officeSupplies, phoneInternet, rent, utilities, vehicle, travel, insurance, bankFees, professionalFees, subcontractors, software, equipment, homeOffice, interest, training, memberships, salaries, otherExpense","amount":estimatedCAD,"reason":"why it is likely deductible","evidenceNeeded":"what document/receipt to find","confidence":"high|medium|low"}]}',
		'Only suggest realistic, CRA-compliant business deductions for a BC small business. Include at most 8 suggestions.'
	];
	if (withAnswers) p.push('The taxpayer answered these interview questions (use the answers to personalize suggestions):');
	return p.join('\n');
}
function startInterview() {
	if (!finderEnabled()) { notify('AI is not enabled for this tool.', 'warning'); return; }
	setStatus('finder-status', '🤖 Building interview questions…');
	tool.requestAI(buildQuestionsPrompt(), buildTaxContext(), function (err, resp) {
		setStatus('finder-status', '');
		var json = parseJsonAI(resp);
		if (json && json.questions && json.questions.length) {
			DB.questions = json.questions.map(function (q, i) {
				return { id: q.id || ('q' + (i + 1)), q: q.question || '', hint: q.hint || '', a: '' };
			});
			pushActivity('ai', '💡 AI interview started (' + DB.questions.length + ' questions)');
			persist(); refreshAll();
			notify('The AI wants to ask ' + DB.questions.length + ' questions.', 'info');
		} else {
			notify('AI returned no questions — try Quick Scan.', 'warning');
			refreshAll();
		}
	});
}
function submitAnswers() {
	var answered = DB.questions.filter(function (q) { return String(q.a || '').trim(); });
	if (!answered.length) { notify('Answer at least one question first.', 'warning'); return; }
	setStatus('finder-status', '🤖 Analyzing your answers…');
	var ctx = buildTaxContext() + '\n\nINTERVIEW ANSWERS:\n' + JSON.stringify(DB.questions, null, 1);
	tool.requestAI(buildSuggestionsPrompt(true), ctx, function (err, resp) {
		setStatus('finder-status', '');
		var json = parseJsonAI(resp);
		if (json && json.suggestions && json.suggestions.length) {
			var before = DB.suggestions.filter(function (s) { return s.status === 'pending'; }).length;
			json.suggestions.forEach(function (s) {
				DB.suggestions.push({
					id: genId(), name: String(s.name || '').slice(0, 120),
					category: validCat(s.category, 'expense'),
					amount: num(s.amount), reason: String(s.reason || '').slice(0, 300),
					evidenceNeeded: String(s.evidenceNeeded || '').slice(0, 200),
					confidence: s.confidence || 'medium', status: 'pending'
				});
			});
			pushActivity('ai', '💡 AI suggested ' + json.suggestions.length + ' possible deductions');
			persist(); refreshAll();
			notify(json.suggestions.length + ' new deduction suggestions ready.', 'success');
		} else {
			notify('No new suggestions found. Your books look thorough!', 'info');
			refreshAll();
		}
	});
}
function quickScan() {
	if (!finderEnabled()) { notify('AI is not enabled for this tool.', 'warning'); return; }
	setStatus('finder-status', '🤖 Scanning for missed deductions…');
	tool.requestAI(buildSuggestionsPrompt(false), buildTaxContext(), function (err, resp) {
		setStatus('finder-status', '');
		var json = parseJsonAI(resp);
		if (json && json.suggestions && json.suggestions.length) {
			json.suggestions.forEach(function (s) {
				DB.suggestions.push({
					id: genId(), name: String(s.name || '').slice(0, 120),
					category: validCat(s.category, 'expense'),
					amount: num(s.amount), reason: String(s.reason || '').slice(0, 300),
					evidenceNeeded: String(s.evidenceNeeded || '').slice(0, 200),
					confidence: s.confidence || 'medium', status: 'pending'
				});
			});
			pushActivity('ai', '⚡ Quick scan found ' + json.suggestions.length + ' possible deductions');
			persist(); refreshAll();
			notify(json.suggestions.length + ' new deduction suggestions ready.', 'success');
		} else {
			notify('No new suggestions found.', 'info');
		}
	});
}
function acceptSuggestion(id) {
	if (isReadOnly) return;
	var s = DB.suggestions.find(function (x) { return x.id === id; });
	if (!s || s.status === 'accepted') return;
	s.status = 'accepted';
	if (s.amount > 0) {
		var lastDay = DB.profile.taxYear + '-12-31';
		DB.transactions.push({
			id: genId(), date: lastDay, description: s.name, amount: s.amount, type: 'expense',
			category: s.category, entity: defaultEntity(), gstIncluded: false,
			gstAmount: null, pstAmount: null, source: 'ai', confidence: s.confidence,
			estimated: true, verified: false, notes: 'AI-suggested: ' + s.reason
		});
	}
	addChecklistItem({ label: 'Collect evidence for: ' + s.name + (s.evidenceNeeded ? ' — ' + s.evidenceNeeded : '') });
	pushActivity('expense', '✅ Accepted deduction: ' + s.name);
	persist(); refreshAll();
	notify('Added to ledger: ' + s.name, 'success');
}
function dismissSuggestion(id) {
	if (isReadOnly) return;
	var s = DB.suggestions.find(function (x) { return x.id === id; });
	if (!s) return;
	s.status = 'dismissed';
	persist(); refreshAll();
}

/* ══ Transaction modal ══ */
function openTxModal(id) {
	if (isReadOnly) return;
	var tx = id ? DB.transactions.find(function (t) { return t.id === id; }) : null;
	var showEntity = DB.profile.entityType !== 'personal';
	var incOpts = INCOME_CATEGORIES.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + '</option>'; }).join('');
	var expOpts = EXPENSE_CATEGORIES.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + '</option>'; }).join('');
	function selCat(list, cur) {
		return list.map(function (c) { return '<option value="' + c.id + '"' + (c.id === cur ? ' selected' : '') + '>' + esc(c.label) + '</option>'; }).join('');
	}
	var html = '<div class="modal-title">' + (tx ? '✏️ Edit Transaction' : '➕ Add Transaction') + '</div>' +
		'<div class="form-grid">' +
		'<label class="field"><span>Date</span><input type="date" class="form-input" id="tx-f-date" value="' + esc(tx ? tx.date : '') + '"></label>' +
		'<label class="field"><span>Type</span><select class="form-input" id="tx-f-type"><option value="expense"' + (tx && tx.type === 'income' ? '' : ' selected') + '>Expense</option><option value="income"' + (tx && tx.type === 'income' ? ' selected' : '') + '>Income</option></select></label>' +
		'<label class="field full"><span>Description</span><input type="text" class="form-input" id="tx-f-desc" value="' + esc(tx ? tx.description : '') + '" placeholder="Vendor / client name"></label>' +
		'<label class="field"><span>Amount (CAD)</span><input type="number" step="0.01" min="0" class="form-input" id="tx-f-amount" value="' + (tx ? tx.amount : '') + '"></label>' +
		'<label class="field"><span>Category</span><select class="form-input" id="tx-f-cat"><optgroup label="Income">' + selCat(INCOME_CATEGORIES, tx ? tx.category : '') + '</optgroup><optgroup label="Expense">' + selCat(EXPENSE_CATEGORIES, tx ? tx.category : '') + '</optgroup></select></label>' +
		(showEntity ? '<label class="field"><span>Entity</span><select class="form-input" id="tx-f-entity"><option value="company"' + (tx && tx.entity === 'personal' ? '' : ' selected') + '>Company</option><option value="personal"' + (tx && tx.entity === 'personal' ? ' selected' : '') + '>Personal</option></select></label>' : '') +
		'<label class="field"><span>GST portion (if known)</span><input type="number" step="0.01" min="0" class="form-input" id="tx-f-gst" value="' + (tx && tx.gstAmount != null ? tx.gstAmount : '') + '"></label>' +
		'<label class="field"><span>PST portion (if known)</span><input type="number" step="0.01" min="0" class="form-input" id="tx-f-pst" value="' + (tx && tx.pstAmount != null ? tx.pstAmount : '') + '"></label>' +
		'<label class="field full"><span class="inline-check"><input type="checkbox" id="tx-f-gstinc"' + (tx && tx.gstIncluded ? ' checked' : '') + '> Amount includes GST</span></label>' +
		'<label class="field full"><span class="inline-check"><input type="checkbox" id="tx-f-est"' + (tx && tx.estimated ? ' checked' : '') + '> This is an estimate (no receipt yet)</span></label>' +
		'</div>' +
		'<div class="modal-actions">' +
		(tx ? '<button class="btn btn-danger-ghost" id="tx-f-delete">🗑 Delete</button>' : '') +
		'<button class="btn" onclick="closeModal()">Cancel</button>' +
		'<button class="btn btn-primary" id="tx-f-save">💾 Save</button>' +
		'</div>';
	openModal(html);
	el('tx-f-type').addEventListener('change', function () {
		var t = el('tx-f-type').value;
		var catSel = el('tx-f-cat');
		var cur = catSel.value;
		catSel.innerHTML = (t === 'income' ? '<optgroup label="Income">' + incOpts + '</optgroup>' : '<optgroup label="Expense">' + expOpts + '</optgroup>');
		if (!(t === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).some(function (c) { return c.id === cur; })) {
			catSel.value = t === 'income' ? 'otherIncome' : 'otherExpense';
		}
	});
	el('tx-f-save').addEventListener('click', function () {
		var date = el('tx-f-date').value;
		var amount = num(el('tx-f-amount').value);
		var desc = el('tx-f-desc').value.trim();
		var type = el('tx-f-type').value;
		if (!date) { notify('Date is required.', 'warning'); return; }
		if (amount <= 0) { notify('Amount must be greater than zero.', 'warning'); return; }
		if (!desc) { notify('Description is required.', 'warning'); return; }
		var obj = {
			date: date, description: desc.slice(0, 160), amount: amount, type: type,
			category: validCat(el('tx-f-cat').value, type),
			entity: showEntity ? el('tx-f-entity').value : defaultEntity(),
			gstIncluded: el('tx-f-gstinc').checked,
			gstAmount: el('tx-f-gst').value ? num(el('tx-f-gst').value) : null,
			pstAmount: el('tx-f-pst').value ? num(el('tx-f-pst').value) : null,
			estimated: el('tx-f-est').checked,
			verified: false
		};
		if (tx) {
			Object.assign(tx, obj);
			pushActivity('tx', '✏️ Edited: ' + desc);
		} else {
			DB.transactions.push(Object.assign({ id: genId(), source: 'manual', sourceDocId: '', confidence: 'high', notes: '' }, obj));
			pushActivity('tx', '➕ Added: ' + desc);
		}
		closeModal();
		persist(); refreshAll();
		notify('Transaction saved.', 'success');
	});
	if (tx) {
		el('tx-f-delete').addEventListener('click', function () {
			closeModal();
			modalConfirm('Delete transaction?', 'This removes "' + tx.description + '" (' + money(tx.amount) + ') permanently.', function () {
				var i = DB.transactions.findIndex(function (t) { return t.id === tx.id; });
				if (i > -1) DB.transactions.splice(i, 1);
				pushActivity('tx', '🗑 Deleted: ' + tx.description);
				persist(); refreshAll();
			});
		});
	}
}
function deleteTx(id) {
	if (isReadOnly) return;
	var tx = DB.transactions.find(function (t) { return t.id === id; });
	if (!tx) return;
	modalConfirm('Delete transaction?', 'Remove "' + tx.description + '" (' + money(tx.amount) + ')?', function () {
		var i = DB.transactions.findIndex(function (t) { return t.id === id; });
		if (i > -1) DB.transactions.splice(i, 1);
		pushActivity('tx', '🗑 Deleted: ' + tx.description);
		persist(); refreshAll();
	});
}
function toggleVerify(id) {
	if (isReadOnly) return;
	var tx = DB.transactions.find(function (t) { return t.id === id; });
	if (!tx) return;
	tx.verified = !tx.verified;
	persist(); renderTransactions();
}
function reclassifyAI() {
	if (!finderEnabled()) { notify('AI is not enabled.', 'warning'); return; }
	var txs = DB.transactions.slice().sort(function (a, b) { return String(a.date) > String(b.date) ? -1 : 1; });
	if (!txs.length) { notify('No transactions to classify.', 'info'); return; }
	setStatus('doc-status', '🤖 Re-classifying ' + txs.length + ' transactions…');
	var chunks = [];
	for (var i = 0; i < txs.length; i += 300) chunks.push(txs.slice(i, i + 300));
	var ci = 0;
	var updated = 0;
	function next() {
		if (ci >= chunks.length) {
			setStatus('doc-status', '');
			notify('AI re-classified ' + updated + ' transaction(s).', 'success');
			pushActivity('ai', '🤖 Re-classified ' + updated + ' transactions');
			persist(); refreshAll();
			return;
		}
		var batch = chunks[ci++];
		var prompt = [
			'You are a Canadian bookkeeper. Classify these transactions for a BC small business.',
			'Categories: ' + EXPENSE_CATEGORIES.concat(INCOME_CATEGORIES).map(function (c) { return c.id; }).join(', '),
			'Return ONLY JSON: {"results":[{"id":"...","category":"catId"}]} — only include rows whose category should change.',
			JSON.stringify(batch.map(function (t) { return { id: t.id, date: t.date, description: t.description, amount: t.amount, type: t.type, current: t.category }; }))
		].join('\n');
		tool.requestAI(prompt, '', function (err, resp) {
			var json = parseJsonAI(resp);
			if (json && json.results) {
				json.results.forEach(function (r) {
					var tx = DB.transactions.find(function (t) { return t.id === r.id; });
					if (tx && r.category && r.category !== tx.category) {
						tx.category = validCat(r.category, tx.type);
						updated++;
					}
				});
			}
			next();
		});
	}
	next();
}

/* ══ Chat ══ */
function chatUser() { var u = tool.getUser() || {}; return { userId: u.id || 'anon', userName: u.name || 'Anonymous' }; }
function chatSystemText() {
	return 'You are "MapleBooks Assistant", a Canadian tax preparation assistant for British Columbia (tax year ' + DB.profile.taxYear + '). ' +
		'Help with personal (T1), sole proprietor (T1 + T2125) and small CCPC corporation (T2) returns, plus GST/HST and BC PST. ' +
		'Be practical and specific. Cite CRA line numbers where useful. Always remind the user to verify final numbers with an accountant. ' +
		'If the user asks about missing files, list exactly which documents to upload next.';
}
function appendChatMsg(msg) {
	var u = chatUser();
	var full = {
		role: msg.role,
		text: String(msg.text || ''),
		time: nowIso(),
		userId: msg.role === 'user' ? u.userId : 'ai',
		userName: msg.role === 'user' ? u.userName : 'AI Assistant'
	};
	if (msg.isError) full.isError = true;
	CHAT.messages.push(full);
	rotateChatIfNeeded();
	DB.chatMessages = CHAT.messages;
	persist();
	renderChatMessages();
	if (msg.role === 'user') {
		ensureChatSession(function () {
			saveCurrentSession();
			autoTitleSession();
		});
	} else {
		saveCurrentSession();
	}
}
function sendChat(text) {
	text = String(text || '').trim();
	if (!text) return;
	if (isReadOnly) { notify('Read-only mode — chat is disabled.', 'warning'); return; }
	if (aiBusy) { notify('AI is still answering…', 'warning'); return; }
	aiBusy = true;
	appendChatMsg({ role: 'user', text: text });
	setChatStatus('🤖 AI is thinking…');
	el('chat-send').disabled = true;
	var prompt = chatSystemText() + '\n\nUser question: ' + text;
	var ctx = buildTaxContext();
	if (typeof tool.requestAIStream === 'function') {
		var bubble = addStreamBubble();
		tool.requestAIStream(prompt, ctx, {
			onToken: function (token) { bubble.textContent += token; el('chat-messages').scrollTop = el('chat-messages').scrollHeight; },
			onComplete: function (fullText) {
				bubble.classList.remove('typing-dots');
				appendChatMsg({ role: 'ai', text: fullText });
				finishChatTurn();
			},
			onError: function (err) {
				if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
				appendChatMsg({ role: 'ai', text: '⚠️ ' + err, isError: true });
				finishChatTurn();
			}
		});
	} else {
		tool.requestAI(prompt, ctx, function (err, resp) {
			if (resp) appendChatMsg({ role: 'ai', text: resp });
			else if (err) appendChatMsg({ role: 'ai', text: '⚠️ ' + err, isError: true });
			else appendChatMsg({ role: 'ai', text: '⚠️ No response from AI service.', isError: true });
			finishChatTurn();
		});
	}
}
function finishChatTurn() {
	aiBusy = false;
	setChatStatus('');
	var b = el('chat-send'); if (b) b.disabled = false;
	pushActivity('chat', '💬 Assistant question answered');
	persist();
}
function addStreamBubble() {
	var box = el('chat-messages');
	var div = document.createElement('div');
	div.className = 'chat-msg ai';
	div.innerHTML = '<div class="chat-bubble typing-dots"></div><div class="chat-meta">AI Assistant</div>';
	box.appendChild(div);
	box.scrollTop = box.scrollHeight;
	return div.querySelector('.chat-bubble');
}
function setChatStatus(t) { var s = el('chat-status'); if (s) s.textContent = t || ''; }
function rotateChatIfNeeded() {
	if (CHAT.messages.length <= 450) return;
	if (_activeSessionId) saveCurrentSession();
	var carry = CHAT.messages.slice(-8);
	_activeSessionId = '';
	DB.activeSessionId = '';
	CHAT.messages = carry;
	notify('Started a fresh chat session (the previous one was getting long).', 'info');
}
function msgHtml(m) {
	var cls = m.role === 'user' ? 'user' : 'ai';
	var body = esc(m.text);
	if (m.isError) body = '<span style="color:var(--red)">' + body + '</span>';
	return '<div class="chat-msg ' + cls + '"><div class="chat-bubble">' + body + '</div>' +
		'<div class="chat-meta">' + esc(m.userName) + ' · ' + relTime(m.time) + '</div></div>';
}
function renderChatMessages() {
	var box = el('chat-messages');
	if (!box) return;
	box.innerHTML = CHAT.messages.length
		? CHAT.messages.map(msgHtml).join('')
		: '<div class="chat-msg ai"><div class="chat-bubble">👋 Hi! I\'m your MapleBooks tax assistant. I can see everything you\'ve loaded — ask me about missing documents, deductions, GST, or how to get your return ready.<br><br>Tip: upload bank statements and invoices first, then ask me <i>"What documents am I still missing?"</i></div><div class="chat-meta">AI Assistant</div></div>';
	box.scrollTop = box.scrollHeight;
}
function renderSessionList() {
	var list = el('chat-sessions-list');
	if (!list) return;
	if (_sessionsError) {
		list.innerHTML = '<div class="muted" style="padding:10px;font-size:11.5px">Chat history is stored locally (CRUD not configured).</div>';
		return;
	}
	list.innerHTML = _sessions.length
		? _sessions.map(function (s) {
			var dcb = ((s.productData || {}).data_categoriesBased || {});
			var n = (dcb.messages || []).length;
			return '<div class="chat-session' + (s.id === _activeSessionId ? ' active' : '') + '" onclick="chatSessionClick(\'' + s.id + '\')">' +
				'<span>' + esc(s.name || 'New Chat') + '</span>' +
				'<span class="muted" style="font-size:10px">' + n + '</span>' +
				'<button class="icon-btn danger cs-del" onclick="event.stopPropagation();deleteChatSession(\'' + s.id + '\')" title="Delete chat">✕</button>' +
				'</div>';
		}).join('')
		: '<div class="muted" style="padding:10px;font-size:11.5px">No chats yet — start one below.</div>';
}

/* ══ Renderers ══ */
function refreshAll() {
	renderTopbar();
	renderDashboard();
	renderDocuments();
	renderTransactions();
	renderFinder();
	renderGst();
	renderSettings();
	renderChatMessages();
	renderSessionList();
	updateNavBadges();
	applyTheme(DB._theme || 'light');
}
function renderTopbar() {
	var u = tool.getUser();
	var chip = el('user-chip');
	if (chip) chip.textContent = u ? u.name || u.email || '' : '';
	var pill = el('ai-pill');
	if (pill) {
		if (typeof tool.requestAI === 'function') { pill.textContent = 'AI: connected'; pill.className = 'ai-pill ok'; }
		else { pill.textContent = 'AI: unavailable'; pill.className = 'ai-pill off'; }
	}
	var sy = el('sidebar-tax-year'); if (sy) sy.textContent = DB.profile.taxYear;
	var sg = el('sidebar-gst-status');
	if (sg) sg.textContent = 'GST: ' + (DB.profile.gstRegistered === 'yes' ? 'Registered' : 'Not registered');
}
function updateNavBadges() {
	var d = el('nav-docs-count'); if (d) d.textContent = DB.docs.length || '';
	var t = el('nav-tx-count'); if (t) t.textContent = DB.transactions.length || '';
	var f = el('nav-finder-count');
	if (f) {
		var n = DB.suggestions.filter(function (s) { return s.status === 'pending'; }).length;
		f.textContent = n || '';
	}
}
function renderDashboard() {
	var ty = el('dash-tax-year'); if (ty) ty.textContent = DB.profile.taxYear;
	var totals = ledgerTotals();
	var gst = gstTotals();
	var est = computeTaxEstimate();
	var stats = el('dash-stats');
	if (stats) {
		stats.innerHTML =
			statCard('Revenue', money(totals.inc), DB.transactions.filter(function (t) { return t.type === 'income'; }).length + ' income tx', 'inc') +
			statCard('Expenses', money(totals.exp), DB.transactions.filter(function (t) { return t.type === 'expense'; }).length + ' expense tx', 'exp') +
			statCard('Net profit', money(totals.bizNet), est.label + ': ' + money(est.amount + (est.cpp || 0)), 'net') +
			statCard('GST net', money(gst.net), gst.net >= 0 ? 'you remit to CRA' : 'refund due back', gst.net >= 0 ? 'exp' : 'inc') +
			statCard('Documents', DB.docs.length, DB.transactions.length + ' transactions extracted', '') +
			statCard('Deductions found', DB.suggestions.filter(function (s) { return s.status === 'accepted'; }).length, money(totals.deductible) + ' deductible', '');
	}
	var r = readiness();
	var pct = el('dash-readiness-pct'); if (pct) pct.textContent = r.pct + '%';
	var bar = el('dash-readiness-bar'); if (bar) bar.style.width = r.pct + '%';
	var ri = el('dash-readiness-items');
	if (ri) ri.innerHTML = r.items.map(function (i) {
		return '<div class="readiness-item' + (i.done ? ' done' : '') + '"><span class="ri-icon">' + (i.done ? '✔' : '◌') + '</span>' + esc(i.label) + '</div>';
	}).join('');
	var cl = el('dash-checklist');
	if (cl) {
		var items = DB.checklist.slice(0, 8);
		cl.innerHTML = items.length
			? items.map(function (c) {
				return '<div class="checklist-row' + (c.done ? ' done' : '') + '" onclick="toggleChecklist(\'' + c.id + '\')">' +
					'<span class="ri-icon">' + (c.done ? '✅' : '⬜') + '</span><span class="ck-text">' + esc(c.label) + '</span></div>';
			}).join('')
			: '<div class="muted">No checklist items yet.</div>';
	}
	var ac = el('dash-actions');
	if (ac) {
		ac.innerHTML =
			actionBtn('📂', 'Load documents (invoices, statements)', 'documents') +
			actionBtn('🤖', 'Analyze documents with AI', 'analyze') +
			actionBtn('💡', 'Find more deductible expenses', 'finder') +
			actionBtn('🤖', 'Ask the Tax Assistant', 'assistant') +
			actionBtn('📤', 'Export Preparer Package (PDF)', 'export') +
			actionBtn('⚙', 'Complete your profile & GST setup', 'settings');
	}
	var act = el('dash-activity');
	if (act) {
		act.innerHTML = DB.activity.length
			? DB.activity.slice(0, 12).map(function (a) {
				return '<div class="activity-item"><span class="at-time">' + relTime(a.t) + '</span><span>' + esc(a.text) + '</span></div>';
			}).join('')
			: '<div class="muted">No activity yet — start by uploading your first bank statement.</div>';
	}
	var fa = el('dash-finder-alert');
	if (fa) {
		var n = DB.suggestions.filter(function (s) { return s.status === 'pending'; }).length;
		fa.style.display = n ? '' : 'none';
		var fn = el('dash-finder-alert-n'); if (fn) fn.textContent = n;
	}
}
function statCard(label, value, sub, cls) {
	return '<div class="stat-card ' + (cls || '') + '"><div class="stat-label">' + esc(label) + '</div><div class="stat-value">' + esc(value) + '</div><div class="stat-sub">' + esc(sub) + '</div></div>';
}
function actionBtn(icon, label, target) {
	return '<button class="action-btn" onclick="navAction(\'' + target + '\')"><span class="ab-icon">' + icon + '</span>' + esc(label) + '</button>';
}
function navAction(a) {
	if (a === 'analyze') { navigate('documents'); analyzeAll(); }
	else if (a === 'export') { exportPackage(); }
	else { navigate(a); }
}
function readiness() {
	var profileDone = !!(DB.profile.businessName && DB.profile.entityType);
	var cl = DB.checklist;
	var clPct = cl.length ? cl.filter(function (c) { return c.done; }).length / cl.length : 0;
	var pendingSuggestions = DB.suggestions.filter(function (s) { return s.status === 'pending'; }).length;
	var items = [
		{ label: 'Profile completed', done: profileDone },
		{ label: 'At least one document loaded', done: DB.docs.length > 0 },
		{ label: 'Transactions extracted', done: DB.transactions.length > 0 },
		{ label: 'Checklist ' + Math.round(clPct * 100) + '% complete', done: clPct >= 0.8 },
		{ label: 'GST registration set', done: !!DB.profile.gstRegistered },
		{ label: 'All AI suggestions reviewed', done: pendingSuggestions === 0 }
	];
	var weights = [20, 15, 15, 25, 10, 15];
	var pct = 0;
	items.forEach(function (it, i) { if (it.done) pct += weights[i]; });
	return { items: items, pct: Math.min(100, Math.round(pct)) };
}
function renderDocuments() {
	var tbody = el('docs-tbody');
	if (!tbody) return;
	var filter = el('doc-filter') ? el('doc-filter').value : 'all';
	var rows = DB.docs.filter(function (d) {
		if (filter === 'csv') return d.kind === 'csv';
		if (filter === 'document') return d.kind !== 'csv';
		if (filter === 'pending') return d.status !== 'analyzed';
		return true;
	});
	tbody.innerHTML = rows.length ? rows.map(function (d) {
		var statusBadge = docStatusBadge(d);
		return '<tr>' +
			'<td><div style="font-weight:700">' + esc(d.name) + '</div>' +
			(d.notes ? '<div class="muted" style="font-size:11px">' + esc(d.notes) + '</div>' : '') + '</td>' +
			'<td><span class="badge ' + (d.kind === 'csv' ? 'src-csv' : '') + '">' + (d.kind === 'csv' ? 'CSV' : (d.type || 'file')) + '</span></td>' +
			'<td>' + fmtBytes(d.size) + '</td>' +
			'<td>' + statusBadge + '</td>' +
			'<td class="num">' + d.txCount + '</td>' +
			'<td style="white-space:nowrap">' +
			(d.extracted ? '<button class="icon-btn" title="View extracted text" onclick="openDocViewer(\'' + d.id + '\')">👁</button>' : '') +
			(d.status !== 'analyzed' ? '<button class="icon-btn" title="Analyze with AI" onclick="analyzeDoc(\'' + d.id + '\')">🤖</button>' : '') +
			'<button class="icon-btn danger" title="Remove" onclick="removeDoc(\'' + d.id + '\')">✕</button>' +
			'</td></tr>';
	}).join('') : '<tr class="empty-row"><td colspan="6">No documents yet — upload invoices, receipts and bank statements.</td></tr>';
}
function docStatusBadge(d) {
	if (d.status === 'analyzed') return '<span class="badge ok">✓ Analyzed</span>';
	if (d.status === 'error') return '<span class="badge warn">⚠ ' + esc((d.notes || 'error').slice(0, 40)) + '</span>';
	if (d.status === 'extracted') return '<span class="badge src-ai">Extracted — ready</span>';
	return '<span class="badge">Uploaded</span>';
}
function openDocViewer(id) {
	var d = DB.docs.find(function (x) { return x.id === id; });
	if (!d) return;
	openModal('<div class="modal-title">👁 ' + esc(d.name) + '</div>' +
		'<div class="doc-viewer">' + esc(d.extracted || '(No extracted text available for this file type.)') + '</div>' +
		'<div class="modal-actions"><button class="btn" onclick="closeModal()">Close</button>' +
		'<button class="btn btn-primary" onclick="closeModal();analyzeDoc(\'' + id + '\')">🤖 Analyze with AI</button></div>');
}
function removeDoc(id) {
	if (isReadOnly) return;
	var d = DB.docs.find(function (x) { return x.id === id; });
	if (!d) return;
	modalConfirm('Remove document?', '"' + d.name + '" will be removed. Transactions already extracted are kept.', function () {
		DB.docs = DB.docs.filter(function (x) { return x.id !== id; });
		pushActivity('doc', '🗑 Removed document: ' + d.name);
		persist(); refreshAll();
	});
}
function renderTransactions() {
	var tbody = el('tx-tbody');
	if (!tbody) return;
	var typeF = el('tx-type-filter') ? el('tx-type-filter').value : 'all';
	var catF = el('tx-cat-filter') ? el('tx-cat-filter').value : 'all';
	var entF = el('tx-entity-filter') ? el('tx-entity-filter').value : 'all';
	var search = el('tx-search') ? el('tx-search').value.toLowerCase() : '';
	var rows = DB.transactions.filter(function (t) {
		if (typeF !== 'all' && t.type !== typeF) return false;
		if (catF !== 'all' && t.category !== catF) return false;
		if (entF !== 'all' && t.entity !== entF) return false;
		if (search && String(t.description).toLowerCase().indexOf(search) < 0) return false;
		return true;
	}).sort(function (a, b) { return String(b.date) > String(a.date) ? 1 : -1; });
	var catSel = el('tx-cat-filter');
	if (catSel && catSel.options.length <= 1) {
		var html = '<option value="all">All categories</option>';
		INCOME_CATEGORIES.concat(EXPENSE_CATEGORIES).forEach(function (c) { html += '<option value="' + c.id + '">' + esc(c.label) + '</option>'; });
		catSel.innerHTML = html;
		catSel.value = catF;
	}
	var chips = el('tx-chips');
	if (chips) {
		var t = ledgerTotals();
		chips.innerHTML =
			'<div class="chip-stat inc"><span>Income</span>' + money(t.inc) + '</div>' +
			'<div class="chip-stat exp"><span>Expenses</span>' + money(t.exp) + '</div>' +
			'<div class="chip-stat net"><span>Net</span>' + money(t.bizNet) + '</div>' +
			'<div class="chip-stat"><span>Deductible</span>' + money(t.deductible) + '</div>';
	}
	tbody.innerHTML = rows.length ? rows.map(function (t) {
		var gstTxt = '';
		if (t.type === 'expense' || DB.profile.gstRegistered === 'yes') {
			var g = txGst(t);
			var p = txPst(t);
			if (g || p) gstTxt = (g ? 'GST ' + money(g) : '') + (p ? (g ? ' · ' : '') + 'PST ' + money(p) : '');
		}
		return '<tr>' +
			'<td style="white-space:nowrap">' + fmtDate(t.date) + '</td>' +
			'<td><div style="font-weight:600">' + esc(t.description) + '</div>' +
			(t.notes ? '<div class="muted" style="font-size:11px">' + esc(t.notes) + '</div>' : '') + '</td>' +
			'<td><span class="badge ' + (t.type === 'income' ? 'inc' : 'exp') + '">' + esc(catLabel(t.category)) + '</span></td>' +
			'<td>' + (t.entity === 'personal' ? '<span class="badge entity-personal">Personal</span>' : '<span class="badge entity-company">Company</span>') + '</td>' +
			'<td class="num muted" style="font-size:11px">' + gstTxt + '</td>' +
			'<td class="num ' + (t.type === 'income' ? 'amt-in' : 'amt-out') + '">' + (t.type === 'income' ? '+' : '−') + money(t.amount) + '</td>' +
			'<td>' + sourceBadge(t) + (t.estimated ? ' <span class="badge est">estimate</span>' : '') + '</td>' +
			'<td style="white-space:nowrap">' +
			'<button class="verif' + (t.verified ? '' : ' unverified') + '" title="Mark reviewed" onclick="toggleVerify(\'' + t.id + '\')">' + (t.verified ? '✅' : '⬜') + '</button>' +
			'<button class="icon-btn" title="Edit" onclick="openTxModal(\'' + t.id + '\')">✏️</button>' +
			'<button class="icon-btn danger" title="Delete" onclick="deleteTx(\'' + t.id + '\')">✕</button>' +
			'</td></tr>';
	}).join('') : '<tr class="empty-row"><td colspan="8">No transactions yet — upload documents and let the AI extract them, or add one manually.</td></tr>';
}
function sourceBadge(t) {
	if (t.source === 'ai') return '<span class="badge src-ai">🤖 AI</span>';
	if (t.source === 'csv') return '<span class="badge src-csv">CSV</span>';
	return '<span class="badge src-manual">Manual</span>';
}
function renderFinder() {
	var iv = el('finder-interview');
	if (iv) {
		if (!DB.questions.length) {
			iv.innerHTML = '<div class="muted">No interview yet. Click "Start Expense Interview" and answer the AI\'s questions — it will suggest deductions you may have missed.</div>';
		} else {
			iv.innerHTML = DB.questions.map(function (q, i) {
				return '<div class="question-card">' +
					'<div class="qc-q">' + (i + 1) + '. ' + esc(q.q) + '</div>' +
					(q.hint ? '<div class="qc-hint">💭 ' + esc(q.hint) + '</div>' : '') +
					'<input type="text" class="form-input" data-qid="' + esc(q.id) + '" placeholder="Your answer…" value="' + esc(q.a || '') + '">' +
					'</div>';
			}).join('') +
				'<button class="btn btn-primary" id="btn-finder-submit">💡 Get my deduction suggestions</button>';
			var sb = el('btn-finder-submit');
			if (sb) sb.onclick = function () { collectAnswers(); submitAnswers(); };
		}
	}
	var sug = el('finder-suggestions');
	if (sug) {
		var pending = DB.suggestions.filter(function (s) { return s.status !== 'dismissed'; });
		sug.innerHTML = pending.length ? pending.map(function (s) {
			return '<div class="suggestion-card' + (s.status === 'accepted' ? ' accepted' : '') + '">' +
				'<div class="sc-name">' + esc(s.name) + '</div>' +
				'<div class="sc-meta">' +
				'<span class="badge exp">' + esc(catLabel(s.category)) + '</span>' +
				'<strong>' + money(s.amount) + '</strong>' +
				'<span class="badge">' + esc(s.confidence || 'medium') + ' confidence</span>' +
				(s.status === 'accepted' ? '<span class="badge ok">✓ added</span>' : '') +
				'</div>' +
				(s.reason ? '<div class="sc-reason">' + esc(s.reason) + '</div>' : '') +
				(s.evidenceNeeded ? '<div class="sc-evidence">📄 Evidence to find: ' + esc(s.evidenceNeeded) + '</div>' : '') +
				(s.status === 'pending'
					? '<div class="sc-actions"><button class="btn btn-primary btn-sm" onclick="acceptSuggestion(\'' + s.id + '\')">✓ Add to ledger</button><button class="btn btn-ghost btn-sm" onclick="dismissSuggestion(\'' + s.id + '\')">Dismiss</button></div>'
					: '') +
				'</div>';
		}).join('') : '<div class="muted">No suggestions yet. Run the interview or quick scan — the AI compares your profile against typical BC small-business deductions.</div>';
	}
}
function collectAnswers() {
	qsa('[data-qid]').forEach(function (input) {
		var q = DB.questions.find(function (x) { return x.id === input.getAttribute('data-qid'); });
		if (q) q.a = input.value;
	});
	persist();
}
function renderGst() {
	var gst = gstTotals();
	var card = el('gst-reg-card');
	if (card) {
		card.innerHTML = '<div class="card-header"><span class="card-title">🧾 Registration status</span>' +
			'<button class="btn btn-ghost btn-sm" onclick="navigate(\'settings\')">Edit in Settings</button></div>' +
			'<div class="card-body">' +
			'<div style="display:flex;gap:18px;flex-wrap:wrap;font-size:12.5px">' +
			'<span><strong>GST/HST:</strong> ' + (DB.profile.gstRegistered === 'yes' ? 'Registered ✓' : 'Not registered') + (DB.profile.gstNumber ? ' · ' + esc(DB.profile.gstNumber) : '') + '</span>' +
			'<span><strong>Filing:</strong> ' + esc(DB.profile.gstFrequency) + '</span>' +
			'<span><strong>BC PST:</strong> ' + (DB.profile.pstRegistered === 'yes' ? 'Registered' : 'Not registered') + '</span>' +
			'<span class="muted">GST 5% · PST 7% (BC)</span>' +
			'</div></div>';
	}
	var stats = el('gst-stats');
	if (stats) {
		stats.innerHTML =
			statCard('Sales (year)', money(gst.revenue), 'before adjustments', '') +
			statCard('GST collected', money(gst.collected), 'box 103', 'inc') +
			statCard('Input tax credits', money(gst.itc), 'box 108', 'exp') +
			statCard('Net GST ' + (gst.net >= 0 ? 'payable' : 'refund'), money(Math.abs(gst.net)), gst.net >= 0 ? 'remit to CRA' : 'CRA owes you', 'net') +
			statCard('BC PST paid', money(gst.pstPaid), 'generally not recoverable — expense', '');
	}
	var mt = el('gst-monthly-tbody');
	if (mt) {
		var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		mt.innerHTML = names.map(function (n, i) {
			var m = gst.monthly[i + 1];
			return '<tr><td>' + n + ' ' + DB.profile.taxYear + '</td>' +
				'<td class="num">' + money(m.rev) + '</td>' +
				'<td class="num">' + money(m.col) + '</td>' +
				'<td class="num">' + money(m.itc) + '</td>' +
				'<td class="num" style="font-weight:700">' + money(m.col - m.itc) + '</td></tr>';
		}).join('');
	}
	var pb = el('gst-periods-body');
	if (pb) {
		var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		pb.innerHTML = filingPeriods().map(function (p) {
			var col = 0, itc = 0;
			for (var m = p[0]; m <= p[1]; m++) { col += gst.monthly[m].col; itc += gst.monthly[m].itc; }
			return '<tr><td>' + names[p[0] - 1] + ' – ' + names[p[1] - 1] + ' ' + DB.profile.taxYear + '</td>' +
				'<td class="num">' + money(col) + '</td>' +
				'<td class="num">' + money(itc) + '</td>' +
				'<td class="num" style="font-weight:700">' + money(col - itc) + '</td></tr>';
		}).join('');
	}
	var adjD = el('gst-adj-debits');
	if (adjD && document.activeElement !== adjD) adjD.value = num(DB.gstAdj.debits) || '';
	var adjC = el('gst-adj-credits');
	if (adjC && document.activeElement !== adjC) adjC.value = num(DB.gstAdj.credits) || '';
}
function renderSettings() {
	var pr = DB.profile;
	qsa('input[name="set-entityType"]').forEach(function (r) { r.checked = r.value === pr.entityType; });
	var set = function (id, val) { var n = el(id); if (n && document.activeElement !== n) n.value = val; };
	set('set-businessName', pr.businessName || '');
	set('set-taxYear', pr.taxYear);
	set('set-fiscalEnd', pr.fiscalYearEnd);
	set('set-gstRegistered', pr.gstRegistered);
	set('set-gstNumber', pr.gstNumber || '');
	set('set-gstFrequency', pr.gstFrequency);
	set('set-pstRegistered', pr.pstRegistered);
	set('set-industry', pr.industry);
	set('set-employmentIncome', pr.employmentIncome ? num(pr.employmentIncome) : '');
	set('set-otherIncome', pr.otherIncome ? num(pr.otherIncome) : '');
	set('set-accountantEmail', pr.accountantEmail || '');
}

/* ══ Reports ══ */
function buildPackageHtml() {
	var t = ledgerTotals();
	var gst = gstTotals();
	var est = computeTaxEstimate();
	var incCats = byCategory('income');
	var expCats = byCategory('expense');
	function catTable(list) {
		return '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
			list.map(function (c) {
				return '<tr><td style="padding:4px 6px;border-bottom:1px solid #e5e7eb">' + esc(c.label) + '</td><td style="text-align:right;padding:4px 6px;border-bottom:1px solid #e5e7eb">' + money(c.amount) + '</td></tr>';
			}).join('') + '</table>';
	}
	function txTable() {
		var rows = DB.transactions.slice().sort(function (a, b) { return String(b.date) > String(a.date) ? 1 : -1; });
		return '<table style="width:100%;border-collapse:collapse;font-size:11px">' +
			'<tr style="background:#f3f4f6"><th style="text-align:left;padding:4px 6px">Date</th><th style="text-align:left;padding:4px 6px">Description</th><th style="text-align:left;padding:4px 6px">Category</th><th style="text-align:right;padding:4px 6px">GST</th><th style="text-align:right;padding:4px 6px">Amount</th></tr>' +
			rows.map(function (x) {
				return '<tr><td style="padding:3px 6px;border-bottom:1px solid #f0f1f4">' + fmtDate(x.date) + '</td>' +
					'<td style="padding:3px 6px;border-bottom:1px solid #f0f1f4">' + esc(x.description) + '</td>' +
					'<td style="padding:3px 6px;border-bottom:1px solid #f0f1f4">' + esc(catLabel(x.category)) + '</td>' +
					'<td style="text-align:right;padding:3px 6px;border-bottom:1px solid #f0f1f4">' + (txGst(x) ? money(txGst(x)) : '') + '</td>' +
					'<td style="text-align:right;padding:3px 6px;border-bottom:1px solid #f0f1f4">' + (x.type === 'income' ? '+' : '−') + money(x.amount) + '</td></tr>';
			}).join('') + '</table>';
	}
	var checklistHtml = DB.checklist.map(function (c) {
		return '<li>' + (c.done ? '✅' : '⬜') + ' ' + esc(c.label) + '</li>';
	}).join('');
	var docsHtml = DB.docs.map(function (d) {
		return '<li>' + esc(d.name) + ' — <a href="' + esc(d.url) + '">open source</a></li>';
	}).join('') || '<li>No documents loaded.</li>';
	return '<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:820px;margin:0 auto;padding:28px">' +
		'<h1 style="font-size:24px;margin:0 0 4px">🍁 Tax Preparer Package — ' + esc(DB.profile.taxYear) + '</h1>' +
		'<div style="color:#6b7280;font-size:13px;margin-bottom:20px">' + esc(DB.profile.businessName || 'Taxpayer') + ' · British Columbia · Entity: ' + esc(DB.profile.entityType) + ' · GST ' + (DB.profile.gstRegistered === 'yes' ? 'registered' : 'not registered') + '</div>' +
		'<h2 style="font-size:16px;border-bottom:2px solid #0f766e;padding-bottom:4px">Summary</h2>' +
		'<table style="width:100%;font-size:13px;margin-bottom:18px">' +
		'<tr><td style="padding:4px 0">Revenue (business)</td><td style="text-align:right;font-weight:700">' + money(t.inc - t.personal) + '</td></tr>' +
		'<tr><td style="padding:4px 0">Expenses</td><td style="text-align:right;font-weight:700">' + money(t.exp) + '</td></tr>' +
		'<tr><td style="padding:4px 0">Net profit</td><td style="text-align:right;font-weight:700">' + money(t.bizNet) + '</td></tr>' +
		'<tr><td style="padding:4px 0">GST collected / ITCs / net</td><td style="text-align:right;font-weight:700">' + money(gst.collected) + ' / ' + money(gst.itc) + ' / ' + money(gst.net) + '</td></tr>' +
		'<tr><td style="padding:4px 0">' + esc(est.label) + '</td><td style="text-align:right;font-weight:700">' + money(est.amount + (est.cpp || 0)) + '</td></tr>' +
		'</table>' +
		'<h2 style="font-size:16px;border-bottom:2px solid #0f766e;padding-bottom:4px">Income by category</h2>' + catTable(incCats) +
		'<h2 style="font-size:16px;border-bottom:2px solid #0f766e;padding-bottom:4px;margin-top:18px">Expenses by category</h2>' + catTable(expCats) +
		'<h2 style="font-size:16px;border-bottom:2px solid #0f766e;padding-bottom:4px;margin-top:18px">Transaction ledger</h2>' + txTable() +
		'<h2 style="font-size:16px;border-bottom:2px solid #0f766e;padding-bottom:4px;margin-top:18px">GST / PST</h2>' +
		'<p style="font-size:12.5px">GST collected (box 103): <strong>' + money(gst.collected) + '</strong> · ITCs (box 108): <strong>' + money(gst.itc) + '</strong> · Net (box 109): <strong>' + money(gst.net) + '</strong> · BC PST paid (expense): <strong>' + money(gst.pstPaid) + '</strong></p>' +
		'<h2 style="font-size:16px;border-bottom:2px solid #0f766e;padding-bottom:4px;margin-top:18px">Document register</h2><ul style="font-size:12.5px">' + docsHtml + '</ul>' +
		'<h2 style="font-size:16px;border-bottom:2px solid #0f766e;padding-bottom:4px;margin-top:18px">Checklist & open items</h2><ul style="font-size:12.5px">' + checklistHtml + '</ul>' +
		'<p style="color:#9ca3af;font-size:11px;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:10px">Prepared with MapleBooks Tax Prep (AI-assisted) on ' + new Date().toLocaleDateString('en-CA') + '. Figures are derived from loaded documents and AI classification — review against source documents and confirm with an accountant before filing with the CRA. Tax estimates are planning aids only.</p>' +
		'</div>';
}
function buildGstHtml() {
	var gst = gstTotals();
	var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	return '<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:820px;margin:0 auto;padding:28px">' +
		'<h1 style="font-size:22px;margin:0 0 4px">🧾 GST / HST Summary — ' + esc(DB.profile.taxYear) + '</h1>' +
		'<div style="color:#6b7280;font-size:13px;margin-bottom:18px">' + esc(DB.profile.businessName || 'Taxpayer') + ' · British Columbia · Filing: ' + esc(DB.profile.gstFrequency) + '</div>' +
		'<table style="width:100%;font-size:13px;margin-bottom:18px">' +
		'<tr><td style="padding:5px 0">GST collected on sales (box 103)</td><td style="text-align:right;font-weight:700">' + money(gst.collected) + '</td></tr>' +
		'<tr><td style="padding:5px 0">Input tax credits (box 108)</td><td style="text-align:right;font-weight:700">' + money(gst.itc) + '</td></tr>' +
		'<tr><td style="padding:5px 0">Other adjustments (box 104/107)</td><td style="text-align:right;font-weight:700">' + money(num(DB.gstAdj.debits) - num(DB.gstAdj.credits)) + '</td></tr>' +
		'<tr style="font-size:15px"><td style="padding:8px 0;border-top:2px solid #111827"><strong>Net GST (box 109)</strong></td><td style="text-align:right;font-weight:800;border-top:2px solid #111827">' + money(gst.net) + (gst.net >= 0 ? ' payable' : ' refund') + '</td></tr>' +
		'</table>' +
		'<h2 style="font-size:15px">Monthly detail</h2>' +
		'<table style="width:100%;border-collapse:collapse;font-size:12px">' +
		'<tr style="background:#f3f4f6"><th style="text-align:left;padding:4px 6px">Month</th><th style="text-align:right;padding:4px 6px">Collected</th><th style="text-align:right;padding:4px 6px">ITCs</th><th style="text-align:right;padding:4px 6px">Net</th></tr>' +
		names.map(function (n, i) {
			var m = gst.monthly[i + 1];
			return '<tr><td style="padding:3px 6px;border-bottom:1px solid #f0f1f4">' + n + '</td>' +
				'<td style="text-align:right;padding:3px 6px;border-bottom:1px solid #f0f1f4">' + money(m.col) + '</td>' +
				'<td style="text-align:right;padding:3px 6px;border-bottom:1px solid #f0f1f4">' + money(m.itc) + '</td>' +
				'<td style="text-align:right;padding:3px 6px;border-bottom:1px solid #f0f1f4">' + money(m.col - m.itc) + '</td></tr>';
		}).join('') + '</table>' +
		'<p style="color:#9ca3af;font-size:11px;margin-top:20px">BC PST paid on purchases (' + money(gst.pstPaid) + ') is generally not recoverable for most businesses — record it as an expense. Verify with an accountant.</p>' +
		'</div>';
}
function exportPdf(html, filename) {
	tool.requestExportPdf({ html: html, filename: filename }, function (err, file) {
		if (err) { notify('Export failed: ' + err, 'error'); return; }
		notify('Export ready: ' + file.name, 'success');
		tool.openUrl(file.url);
	});
}
function exportPackage() { exportPdf(buildPackageHtml(), 'tax-preparer-package-' + DB.profile.taxYear); }
function exportGst() { exportPdf(buildGstHtml(), 'gst-summary-' + DB.profile.taxYear); }
function emailAccountant() {
	var to = (DB.profile.accountantEmail || '').trim();
	if (!to) { notify('Set the accountant email in Settings first.', 'warning'); return; }
	var t = ledgerTotals();
	var gst = gstTotals();
	var htmlBody =
		'<h2>Tax preparation package — ' + esc(DB.profile.taxYear) + '</h2>' +
		'<p>' + esc(DB.profile.businessName || 'Taxpayer') + ' (British Columbia)</p>' +
		'<table style="border-collapse:collapse;font-size:14px;margin:14px 0">' +
		'<tr><td style="padding:5px 14px 5px 0">Revenue</td><td style="padding:5px 0;font-weight:700">' + money(t.inc - t.personal) + '</td></tr>' +
		'<tr><td style="padding:5px 14px 5px 0">Expenses</td><td style="padding:5px 0;font-weight:700">' + money(t.exp) + '</td></tr>' +
		'<tr><td style="padding:5px 14px 5px 0">Net profit</td><td style="padding:5px 0;font-weight:700">' + money(t.bizNet) + '</td></tr>' +
		'<tr><td style="padding:5px 14px 5px 0">GST collected</td><td style="padding:5px 0;font-weight:700">' + money(gst.collected) + '</td></tr>' +
		'<tr><td style="padding:5px 14px 5px 0">GST ITCs</td><td style="padding:5px 0;font-weight:700">' + money(gst.itc) + '</td></tr>' +
		'<tr><td style="padding:5px 14px 5px 0">GST net</td><td style="padding:5px 0;font-weight:700">' + money(gst.net) + '</td></tr>' +
		'</table>' +
		'<p>Documents loaded: ' + DB.docs.length + ' · Transactions: ' + DB.transactions.length + '</p>' +
		'<p style="font-size:12px;color:#666">Generated by MapleBooks Tax Prep (AI-assisted) — please review against source documents.</p>';
	tool.requestSendEmail({
		to: to,
		subject: 'Tax preparation package — ' + DB.profile.taxYear + ' (' + (DB.profile.businessName || 'Taxpayer') + ')',
		title: 'Tax Preparation Package',
		htmlBody: htmlBody
	}, function (err, result) {
		if (err) { notify('Email failed: ' + err, 'error'); return; }
		notify('Summary emailed to ' + to, 'success');
		pushActivity('email', '✉️ Sent summary to accountant');
		persist();
	});
}

/* ══ Settings actions ══ */
function saveSettings() {
	if (isReadOnly) return;
	var radio = qsa('input[name="set-entityType"]').find(function (r) { return r.checked; });
	var ty = parseInt(el('set-taxYear').value, 10);
	if (!ty || ty < 2015 || ty > 2035) { notify('Enter a valid tax year (e.g. 2025).', 'warning'); return; }
	DB.profile.entityType = radio ? radio.value : 'soleProp';
	DB.profile.businessName = el('set-businessName').value.trim().slice(0, 120);
	DB.profile.taxYear = ty;
	DB.profile.fiscalYearEnd = el('set-fiscalEnd').value;
	DB.profile.gstRegistered = el('set-gstRegistered').value;
	DB.profile.gstNumber = el('set-gstNumber').value.trim().slice(0, 20);
	DB.profile.gstFrequency = el('set-gstFrequency').value;
	DB.profile.pstRegistered = el('set-pstRegistered').value;
	DB.profile.industry = el('set-industry').value;
	DB.profile.employmentIncome = num(el('set-employmentIncome').value);
	DB.profile.otherIncome = num(el('set-otherIncome').value);
	DB.profile.accountantEmail = el('set-accountantEmail').value.trim().slice(0, 120);
	pushActivity('settings', '⚙ Profile updated (' + DB.profile.entityType + ', ' + DB.profile.taxYear + ')');
	persist(); refreshAll();
	notify('Settings saved.', 'success');
}
function saveGstAdj() {
	if (isReadOnly) return;
	DB.gstAdj.debits = num(el('gst-adj-debits').value);
	DB.gstAdj.credits = num(el('gst-adj-credits').value);
	persist(); refreshAll();
	notify('GST adjustments saved.', 'success');
}
function resetTool() {
	if (isReadOnly) return;
	modalConfirm('Reset everything?', 'This permanently deletes ALL documents, transactions, checklist and chat data for this record. This cannot be undone.', function () {
		DB = normalizeDB(null);
		ensureChecklist();
		CHAT.messages = [];
		_activeSessionId = '';
		_sessions = [];
		persist(); refreshAll();
		notify('Tool reset complete.', 'info');
	});
}

/* ══ Modal ══ */
function openModal(html) {
	var ov = el('modal-overlay');
	var box = el('modal-box');
	if (!ov || !box) return;
	box.innerHTML = html;
	ov.style.display = 'flex';
}
function closeModal() {
	var ov = el('modal-overlay');
	if (ov) ov.style.display = 'none';
}
function modalConfirm(title, message, onYes) {
	openModal('<div class="modal-title">' + esc(title) + '</div>' +
		'<p class="muted">' + esc(message) + '</p>' +
		'<div class="modal-actions"><button class="btn" onclick="closeModal()">Cancel</button>' +
		'<button class="btn btn-danger-ghost" id="m-yes">Yes, continue</button></div>');
	var b = el('m-yes');
	if (b) b.onclick = function () { closeModal(); onYes(); };
}

/* ══ Navigation / theme / readonly ══ */
function navigate(page) {
	qsa('.nav-item').forEach(function (n) { n.classList.toggle('active', n.getAttribute('data-page') === page); });
	qsa('.section').forEach(function (s) { s.classList.remove('active'); });
	var sec = el('sec-' + page);
	if (sec) sec.classList.add('active');
	try { tool.resize(); } catch (e) {}
}
function applyTheme(t) {
	document.documentElement.setAttribute('data-theme', t);
	var i = el('theme-icon');
	if (i) i.textContent = t === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
	DB._theme = DB._theme === 'dark' ? 'light' : 'dark';
	applyTheme(DB._theme);
	persist();
}
function lockUI(ro) {
	isReadOnly = !!ro;
	document.body.classList.toggle('is-ro', isReadOnly);
}

/* ══ Event binding ══ */
function bindEvents() {
	qsa('.nav-item').forEach(function (n) {
		n.onclick = function () { navigate(this.getAttribute('data-page')); };
	});
	el('theme-toggle').onclick = toggleTheme;
	el('btn-upload-docs').onclick = uploadDocs;
	el('btn-upload-docs2').onclick = function (e) { if (e) e.stopPropagation(); uploadDocs(); };
	el('doc-dropzone').onclick = uploadDocs;
	el('btn-analyze-all').onclick = analyzeAll;
	el('doc-filter').onchange = function () { renderDocuments(); };
	el('btn-add-tx').onclick = function () { openTxModal(null); };
	el('tx-type-filter').onchange = function () { renderTransactions(); };
	el('tx-cat-filter').onchange = function () { renderTransactions(); };
	el('tx-entity-filter').onchange = function () { renderTransactions(); };
	el('tx-search').oninput = function () { renderTransactions(); };
	el('btn-reclassify-ai').onclick = reclassifyAI;
	el('btn-finder-interview').onclick = startInterview;
	el('btn-finder-scan').onclick = quickScan;
	el('btn-save-gst-adj').onclick = saveGstAdj;
	el('btn-save-settings').onclick = saveSettings;
	el('btn-reset-tool').onclick = resetTool;
	el('btn-export-package').onclick = exportPackage;
	el('btn-export-gst').onclick = exportGst;
	el('btn-email-accountant').onclick = emailAccountant;
	el('btn-new-chat').onclick = newChat;
	el('chat-send').onclick = function () { sendChat(el('chat-input').value); };
	el('chat-input').addEventListener('keydown', function (e) {
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(el('chat-input').value); }
	});
	el('chat-input').addEventListener('input', function () {
		this.style.height = 'auto';
		this.style.height = Math.min(this.scrollHeight, 120) + 'px';
	});
	qsa('#chat-quick-chips .chip').forEach(function (c) {
		c.onclick = function () { sendChat(this.getAttribute('data-q')); };
	});
	qsa('[data-nav]').forEach(function (b) {
		b.onclick = function () { navigate(this.getAttribute('data-nav')); };
	});
	el('modal-overlay').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
	document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
}
function newChat() {
	if (_activeSessionId) saveCurrentSession();
	_activeSessionId = '';
	DB.activeSessionId = '';
	CHAT.messages = [];
	DB.chatMessages = [];
	persist();
	renderSessionList();
	renderChatMessages();
	setChatStatus('New chat started.');
}

/* ══ Boot ══ */
tool.onReady(function (val) {
	DB = normalizeDB(val);
	ensureChecklist();
	CHAT.messages = DB.chatMessages || [];
	_activeSessionId = DB.activeSessionId || '';

	tool.declareOutput({
		type: 'object',
		description: 'MapleBooks Tax Prep BC — profile, documents, ledger, GST and AI suggestions',
		properties: {
			profile: { type: 'object' },
			docs: { type: 'array' },
			transactions: { type: 'array' },
			checklist: { type: 'array' },
			suggestions: { type: 'array' }
		}
	});
	tool.declareParams([
		{ name: 'allowAi', label: 'Enable AI Prompt Relay', type: 'toggle', default: 'yes', severity: 'mandatory', hint: 'Required for document analysis, expense finder and the tax assistant chat.' },
		{ name: 'allowUpload', label: 'Enable File Upload', type: 'toggle', default: 'yes', severity: 'mandatory', hint: 'Required to load invoices, receipts and bank statements.' },
		{ name: 'allowFileContent', label: 'Enable File Content Extraction', type: 'toggle', default: 'yes', severity: 'mandatory', hint: 'Extracts text from PDF/DOCX/XLSX/CSV files for AI analysis.' },
		{ name: 'allowObjectCRUD', label: 'Enable CMS Object CRUD', type: 'toggle', default: 'yes', severity: 'mandatory', hint: 'Stores AI chat history in ai-chat-sessions-uniconbaseapps. Also add that type to allowedObjectTypes (role editor, scope instance).' },
		{ name: 'allowExportPdf', label: 'Enable PDF Export', type: 'toggle', default: 'yes', severity: 'goodToHave', hint: 'Enables the Preparer Package and GST summary PDF export.' },
		{ name: 'allowSendEmail', label: 'Enable Email', type: 'toggle', default: 'no', severity: 'goodToHave', hint: 'Lets users send the summary package to their accountant.' },
		{ name: 'taxYear', label: 'Tax Year', type: 'text', default: '2025', severity: 'optional', hint: 'Default tax year for this tool instance (e.g. 2025).' },
		{ name: 'accountantEmail', label: 'Accountant Email', type: 'text', default: '', severity: 'optional', hint: 'Default recipient for the handoff email.' }
	]);

	var missing = [];
	if (tool.param('allowAi', '') !== 'yes') missing.push({ name: 'allowAi', label: 'Enable AI Prompt Relay', type: 'toggle', default: 'yes', severity: 'mandatory', hint: 'Set to "yes" to enable AI document analysis and chat.', reason: 'Document analysis, expense finder and chat all need tool.requestAI.' });
	if (tool.param('allowUpload', '') !== 'yes') missing.push({ name: 'allowUpload', label: 'Enable File Upload', type: 'toggle', default: 'yes', severity: 'mandatory', hint: 'Set to "yes" to let users load invoices and statements.', reason: 'Cannot load invoices, receipts or bank statements without uploads.' });
	if (tool.param('allowFileContent', '') !== 'yes') missing.push({ name: 'allowFileContent', label: 'Enable File Content Extraction', type: 'toggle', default: 'yes', severity: 'mandatory', hint: 'Set to "yes" to extract text from uploaded files.', reason: 'The AI needs extracted file text to find income and expenses.' });
	if (tool.param('allowObjectCRUD', '') !== 'yes') missing.push({ name: 'allowObjectCRUD', label: 'Enable CMS Object CRUD', type: 'toggle', default: 'yes', severity: 'mandatory', hint: 'Set to "yes" and add ai-chat-sessions-uniconbaseapps (editor, instance) to allowedObjectTypes.', reason: 'AI chat history is stored in ai-chat-sessions-uniconbaseapps.' });
	if (missing.length) {
		tool.reportMissingParams(missing, 'This tax tool needs AI, upload and storage capabilities configured before it can analyze documents and keep chat history.');
	}

	refreshAll();
	lockUI(tool.isReadOnly());
	bindEvents();
	resolveInstanceId();

	loadSessions(function (sessions) {
		var active = sessions.find(function (s) { return s.id === DB.activeSessionId; });
		if (active) {
			_activeSessionId = active.id;
			var dcb = ((active.productData || {}).data_categoriesBased || {});
			CHAT.messages = dcb.messages || [];
			DB.chatMessages = CHAT.messages;
		} else if (DB.chatMessages && DB.chatMessages.length) {
			var legacy = DB.chatMessages.slice();
			DB.chatMessages = [];
			persist();
			createSession(function (session) {
				if (!session) { CHAT.messages = legacy; DB.chatMessages = legacy; persist(); renderChatMessages(); return; }
				_activeSessionId = session.id;
				DB.activeSessionId = session.id;
				CHAT.messages = legacy;
				saveCurrentSession();
				autoTitleSession();
				persist();
				renderSessionList();
				renderChatMessages();
			});
		} else if (!DB.activeSessionId && !CHAT.messages.length) {
			_activeSessionId = '';
		}
		renderSessionList();
		renderChatMessages();
	});

	try { tool.reportValid(true); } catch (e) {}
	if (!DB.activity.length) pushActivity('setup', '👋 Welcome! Start by loading bank statements and invoices.');
	persist();
});

tool.onValueChange(function (v) {
	var snap = JSON.stringify(v || null);
	if (snap !== _lastRendered) {
		_lastRendered = snap;
		DB = normalizeDB(v);
		ensureChecklist();
		refreshAll();
	}
});
tool.onReadonlyChange(function (ro) { lockUI(ro); });
tool.onUserChange(function () { renderTopbar(); });
