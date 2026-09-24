// ════════════════════════════════════════════════════════════════
// Payments Management — UniconHub html-tool
// All data lives in the tool value:
//   { version, payees: [], regulars: [], requests: [] }
// No CMS object CRUD needed — simple, instant, zero admin setup.
// ════════════════════════════════════════════════════════════════
'use strict';

// ── Constants ────────────────────────────────────────────────
var METHODS = [
  { id: 'interac', label: 'Interac e-Transfer', hint: 'Email address for the e-Transfer' },
  { id: 'eft', label: 'Bank Transfer / EFT', hint: 'Account / routing details' },
  { id: 'cheque', label: 'Cheque', hint: 'Payable-to name / mailing info' },
  { id: 'cash', label: 'Cash', hint: 'Where / who handles the cash' },
  { id: 'card', label: 'Credit Card', hint: 'Card / account reference' },
  { id: 'paypal', label: 'PayPal', hint: 'PayPal email address' },
  { id: 'wire', label: 'Wire Transfer', hint: 'SWIFT / IBAN / bank details' },
  { id: 'other', label: 'Other', hint: 'Any details needed to make the payment' }
];
var CADENCES = [
  { id: 'weekly', label: 'Weekly', every: 'every 7 days' },
  { id: 'biweekly', label: 'Bi-weekly', every: 'every 14 days' },
  { id: 'monthly', label: 'Monthly', every: 'every month' },
  { id: 'quarterly', label: 'Quarterly', every: 'every 3 months' },
  { id: 'yearly', label: 'Yearly', every: 'every 12 months' }
];
var CURRENCIES = ['CAD', 'USD', 'TRY', 'EUR', 'GBP', 'AUD', 'AED', 'SAR'];
var DEFAULT_CATS = 'Rent,Utilities,Payroll,Insurance,Taxes,Software,Supplies,Reimbursement,Other';

// ── State ────────────────────────────────────────────────────
var DB = null;
var _user = null;
var _readOnly = false;
var _saving = false;
var _defaultCurrency = 'CAD';
var _resizeRaf = null;

// ── Small helpers ────────────────────────────────────────────
function el(id) { return document.getElementById(id); }
function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function uid(p) { return (p || 'pm') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function parseISO(s) {
  if (!s) return null;
  var p = String(s).slice(0, 10).split('-');
  if (p.length !== 3) return null;
  return new Date(+p[0], +p[1] - 1, +p[2]);
}
function isoDay(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function clampDay(y, m1, day) { var dim = new Date(y, m1, 0).getDate(); return Math.min(day, dim); }
function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function monthEnd(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function fmtDate(d) {
  if (!d) return '—';
  var t = new Date();
  var sameYear = d.getFullYear() === t.getFullYear();
  var opts = { month: 'short', day: 'numeric' };
  if (!sameYear) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}
function fmtDateFull(d) {
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function monthLabel(ym) {
  if (!ym) return '—';
  var p = ym.split('-');
  var d = new Date(+p[0], +p[1] - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
function fmtMoney(amount, cur) {
  if (amount === '' || amount === null || amount === undefined || isNaN(+amount)) return '—';
  cur = cur || defCurrency();
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(+amount);
  } catch (e) {
    return cur + ' ' + Number(amount).toFixed(2);
  }
}
function defCurrency() {
  if (!_defaultCurrency) _defaultCurrency = tool.param('defaultCurrency', 'CAD') || 'CAD';
  return _defaultCurrency;
}
function methodById(id) {
  for (var i = 0; i < METHODS.length; i++) if (METHODS[i].id === id) return METHODS[i];
  return null;
}
function methodLabel(id) { var m = methodById(id); return m ? m.label : (id || '—'); }
function cadenceById(id) {
  for (var i = 0; i < CADENCES.length; i++) if (CADENCES[i].id === id) return CADENCES[i];
  return null;
}
function sumByCurrency(rows) {
  var map = {};
  rows.forEach(function (r) {
    var c = r.currency || defCurrency();
    var a = +r.amount;
    if (!isNaN(a) && a > 0) map[c] = (map[c] || 0) + a;
  });
  return map;
}
function fmtSumMap(map) {
  var keys = Object.keys(map);
  if (!keys.length) return '—';
  return keys.map(function (c) { return fmtMoney(map[c], c); }).join(' &middot; ');
}
function scheduleResize() {
  if (_resizeRaf) cancelAnimationFrame(_resizeRaf);
  _resizeRaf = requestAnimationFrame(function () {
    _resizeRaf = null;
    if (tool && tool.resize) tool.resize();
  });
}

// ── Document size (1 MB Firestore limit) ──────────────────
function estSizeBytes() {
  try {
    var s = JSON.stringify(DB);
    var ascii = 0, nonAscii = 0;
    for (var i = 0; i < s.length; i++) {
      if (s.charCodeAt(i) < 128) ascii++; else nonAscii++;
    }
    return ascii + nonAscii * 2; // UTF-8 estimate
  } catch (e) { return 0; }
}
function fmtSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(0) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}

// ── Roles / permissions ─────────────────────────────────────
function getRoles() {
  var u = _user || (tool.getUser ? tool.getUser() : null);
  return (u && u.roles) ? u.roles : [];
}
function canWrite() {
  var r = getRoles();
  return r.indexOf('developer') !== -1 || r.indexOf('owner') !== -1 || r.indexOf('admin') !== -1 ||
    r.indexOf('user-manager') !== -1 || r.indexOf('editor') !== -1;
}
function canAdmin() {
  var r = getRoles();
  return r.indexOf('developer') !== -1 || r.indexOf('owner') !== -1 || r.indexOf('admin') !== -1 ||
    r.indexOf('user-manager') !== -1;
}
function currentUserName() {
  var u = _user || (tool.getUser ? tool.getUser() : null);
  return (u && u.name) ? u.name : 'Unknown';
}
function currentUserId() {
  var u = _user || (tool.getUser ? tool.getUser() : null);
  return (u && u.id) ? u.id : 'unknown';
}
function currentUserEmail() {
  var u = _user || (tool.getUser ? tool.getUser() : null);
  return (u && u.email) ? String(u.email) : '';
}
// Users listed in the 'paymentsTeamEmails' param can manage regulars and mark
// things paid (like the accountant). Admins are always on the team.
function teamEmails() {
  var s = tool.param('paymentsTeamEmails', '');
  return (s || '').split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
}
function isPaymentTeam() {
  if (canAdmin()) return true;
  var e = currentUserEmail().toLowerCase();
  return !!e && teamEmails().indexOf(e) !== -1;
}
// 'own' = users see only the requests they added themselves (per department).
// 'all' = everyone with access sees all requests.
function requestVisibilityOwn() {
  return String(tool.param('requestVisibility', 'own')).toLowerCase() !== 'all';
}
function isOwnRequest(q) {
  var uid = currentUserId();
  if (q.requestedById && uid !== 'unknown' && q.requestedById === uid) return true;
  var email = currentUserEmail().toLowerCase();
  if (q.requestedByEmail && email && String(q.requestedByEmail).toLowerCase() === email) return true;
  if (q.requestedById && uid === 'unknown') return false;
  // legacy fallback: match by display name only when no id was ever stored
  if (!q.requestedById && !q.requestedByEmail && q.requestedBy && currentUserName() === q.requestedBy) return true;
  return false;
}
function canSeeRequest(q) {
  if (canAdmin() || isPaymentTeam()) return true;
  if (!requestVisibilityOwn()) return true;
  return isOwnRequest(q);
}
function canAddRequest() { return !_readOnly && canWrite(); }
// Manage regular payments, payees, and check anything off — admin or payments team.
function canManage() { return !_readOnly && canWrite() && isPaymentTeam(); }
// A requester can still edit or withdraw their own pending/declined request.
function canEditRequestRow(q) {
  if (_readOnly || !canWrite()) return false;
  if (canAdmin()) return true;
  return isOwnRequest(q) && (q.status === 'pending' || q.status === 'declined');
}
function visiblePendingRequests() {
  return DB.requests.filter(function (r) { return r.status === 'pending' && canSeeRequest(r); });
}
function roleLabel() {
  var r = getRoles();
  if (!_user) return 'Not signed in';
  if (r.indexOf('admin') !== -1 || r.indexOf('owner') !== -1) return 'Admin';
  if (r.indexOf('developer') !== -1) return 'Developer';
  if (r.indexOf('editor') !== -1) return 'Editor';
  return 'Viewer';
}

// ── DB normalisation / persistence ──────────────────────────
function normalizeDB(v) {
  var out = (v && typeof v === 'object') ? v : {};
  if (!Array.isArray(out.payees)) out.payees = [];
  if (!Array.isArray(out.regulars)) out.regulars = [];
  if (!Array.isArray(out.requests)) out.requests = [];
  if (!Array.isArray(out.departments)) out.departments = [];
  if (!Array.isArray(out.types)) out.types = [];
  if (!Array.isArray(out.sources)) out.sources = [];
  out.version = 1;
  out.payees.forEach(function (p) {
    if (!p.id) p.id = uid('pye');
    if (!p.method) p.method = 'interac';
    if (!p.detail) p.detail = '';
    if (!p.note) p.note = '';
  });
  out.departments.forEach(function (d) {
    if (!d.id) d.id = uid('dep');
    if (!d.name) d.name = 'Department';
    if (!d.budget) d.budget = 0;
    if (!d.currency) d.currency = defCurrency();
    if (!d.note) d.note = '';
  });
  out.types.forEach(function (t) {
    if (!t.id) t.id = uid('typ');
    if (!t.name) t.name = 'Type';
    if (!t.note) t.note = '';
  });
  out.sources.forEach(function (s) {
    if (!s.id) s.id = uid('src');
    if (!s.name) s.name = 'Source';
    if (!s.note) s.note = '';
  });
  var typeByName = {};
  out.types.forEach(function (t) { typeByName[String(t.name).toLowerCase()] = t; });
  function findOrCreateType(name) {
    name = String(name || '').trim();
    if (!name) return '';
    var key = name.toLowerCase();
    if (typeByName[key]) return typeByName[key].id;
    var t = { id: uid('typ'), name: name, note: '' };
    out.types.push(t);
    typeByName[key] = t;
    return t.id;
  }
  out.regulars.forEach(function (r) {
    if (!r.id) r.id = uid('reg');
    if (!r.cadence) r.cadence = 'monthly';
    if (!r.currency) r.currency = defCurrency();
    if (!Array.isArray(r.history)) r.history = [];
    if (r.active === undefined || r.active === null) r.active = true;
    if (!r.category) r.category = '';
    if (!r.typeId) r.typeId = findOrCreateType(r.category);
    if (!r.departmentId) r.departmentId = '';
    if (!r.sourceId) r.sourceId = '';
    if (!r.note) r.note = '';
    if (r.method === undefined || r.method === null) r.method = '';
    if (r.methodDetail === undefined) r.methodDetail = '';
    if (!r.who) r.who = '';
    if (r.amount === undefined || r.amount === null) r.amount = '';
  });
  out.requests.forEach(function (q) {
    if (!q.id) q.id = uid('req');
    if (!q.status) q.status = 'pending';
    if (!q.currency) q.currency = defCurrency();
    if (!q.category) q.category = '';
    if (!q.typeId) q.typeId = findOrCreateType(q.category);
    if (!q.departmentId) q.departmentId = '';
    if (!q.sourceId) q.sourceId = '';
    if (!q.note) q.note = '';
    if (q.method === undefined || q.method === null) q.method = '';
    if (q.methodDetail === undefined) q.methodDetail = '';
    if (!q.who) q.who = '';
    if (!q.requestedBy) q.requestedBy = currentUserName();
  });
  return out;
}
function persist() {
  _saving = true;
  tool.setValue(JSON.parse(JSON.stringify(DB)));
  setTimeout(function () { _saving = false; }, 300);
}
function notify(msg, sev) { if (tool.notify) tool.notify(msg, sev || 'info'); }

// ── Find helpers ────────────────────────────────────────────
function findRegular(id) { for (var i = 0; i < DB.regulars.length; i++) if (DB.regulars[i].id === id) return DB.regulars[i]; return null; }
function findRequest(id) { for (var i = 0; i < DB.requests.length; i++) if (DB.requests[i].id === id) return DB.requests[i]; return null; }
function findPayee(id) { for (var i = 0; i < DB.payees.length; i++) if (DB.payees[i].id === id) return DB.payees[i]; return null; }
function findDept(id) { for (var i = 0; i < DB.departments.length; i++) if (DB.departments[i].id === id) return DB.departments[i]; return null; }
function findType(id) { for (var i = 0; i < DB.types.length; i++) if (DB.types[i].id === id) return DB.types[i]; return null; }
function findSource(id) { for (var i = 0; i < DB.sources.length; i++) if (DB.sources[i].id === id) return DB.sources[i]; return null; }
function typeLabelOf(x) {
  if (x && x.typeId) { var t = findType(x.typeId); if (t) return t.name; }
  return (x && x.category) || '';
}
function deptNameOf(x) {
  if (x && x.departmentId) { var d = findDept(x.departmentId); if (d) return d.name; }
  return '';
}
function sourceNameOf(x) {
  if (x && x.sourceId) { var s = findSource(x.sourceId); if (s) return s.name; }
  return '';
}

// ── Schedule math ───────────────────────────────────────────
// Returns due dates in [from, to] (inclusive) for a regular payment.
function computeDueDates(reg, from, to) {
  var out = [];
  var cadence = reg.cadence || 'monthly';
  var stepDays = cadence === 'weekly' ? 7 : (cadence === 'biweekly' ? 14 : 0);
  var guard = 0;
  if (stepDays) {
    var anchor = reg.anchor ? parseISO(reg.anchor) : null;
    if (!anchor) return out;
    var d = new Date(anchor);
    while (d <= to && guard < 400) {
      if (d >= from) out.push(new Date(d));
      d = addDays(d, stepDays);
      guard++;
    }
    return out;
  }
  var stepM = cadence === 'quarterly' ? 3 : (cadence === 'yearly' ? 12 : 1);
  var start = reg.anchor ? parseISO(reg.anchor) : new Date(from.getFullYear(), from.getMonth(), 1);
  var y = start.getFullYear(), m = start.getMonth(), day = start.getDate();
  // Walk back to the first occurrence on or before `from`.
  var first = new Date(y, m, clampDay(y, m + 1, day));
  guard = 0;
  while (first > from && guard < 400) {
    m -= stepM;
    if (m < 0) { m += 12; y -= 1; }
    first = new Date(y, m, clampDay(y, m + 1, day));
    guard++;
  }
  var cur = new Date(first);
  guard = 0;
  while (cur <= to && guard < 400) {
    if (cur >= from) out.push(new Date(cur));
    m += stepM;
    if (m >= 12) { m -= 12; y += 1; }
    cur = new Date(y, m, clampDay(y, m + 1, day));
    guard++;
  }
  return out;
}
function isPeriodPaid(reg, due) {
  var key = isoDay(due);
  return (reg.history || []).some(function (h) { return h.dueDate === key; });
}
// Earliest unpaid dues: from (last paid + 1d | anchor | 120 days ago) to ~13 months ahead.
function unpaidDues(reg) {
  var today = startOfDay(new Date());
  var from = addDays(today, -120);
  var lastPaid = null;
  (reg.history || []).forEach(function (h) {
    var d = parseISO(h.dueDate);
    if (d && (!lastPaid || d > lastPaid)) lastPaid = d;
  });
  if (lastPaid) from = addDays(lastPaid, 1);
  if (reg.anchor) {
    var a = parseISO(reg.anchor);
    if (a && a > from) from = a;
  }
  var to = addDays(today, 400);
  return computeDueDates(reg, from, to).filter(function (d) { return !isPeriodPaid(reg, d); }).slice(0, 8);
}
function nextDue(reg) {
  var dues = unpaidDues(reg);
  return dues.length ? dues[0] : null;
}
function nextMonthlyAnchor(day) {
  var now = new Date();
  var d = new Date(now.getFullYear(), now.getMonth(), clampDay(now.getFullYear(), now.getMonth() + 1, day));
  if (d < startOfDay(now)) d = new Date(now.getFullYear(), now.getMonth() + 1, clampDay(now.getFullYear(), now.getMonth() + 2, day));
  return d;
}

// ── Due list (check-off view) ───────────────────────────────
function dueItems() {
  var items = [];
  var today = startOfDay(new Date());
  DB.regulars.forEach(function (reg) {
    if (!reg.active) return;
    unpaidDues(reg).forEach(function (due) {
      items.push({
        kind: 'regular', id: reg.id, name: reg.name, category: typeLabelOf(reg),
        who: reg.who, method: reg.method, detail: reg.methodDetail,
        amount: reg.amount, currency: reg.currency, due: due
      });
    });
  });
  DB.requests.forEach(function (q) {
    if (q.status !== 'approved') return;
    if (!canSeeRequest(q)) return;
    items.push({
      kind: 'request', id: q.id, name: q.title, category: typeLabelOf(q),
      who: q.who, method: q.method, detail: q.methodDetail,
      amount: q.amount, currency: q.currency,
      due: q.dueDate ? parseISO(q.dueDate) : null,
      requestedBy: q.requestedBy
    });
  });
  items.sort(function (a, b) {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due - b.due;
  });
  return items;
}
function dueBucket(item) {
  if (!item.due) return 'upcoming';
  var t = startOfDay(new Date());
  if (item.due < t) return 'overdue';
  if (item.due < new Date(t.getFullYear(), t.getMonth() + 1, 1)) return 'month';
  return 'upcoming';
}
function renderDue() {
  var list = el('due-list');
  if (!list) return;
  var q = (el('due-search').value || '').toLowerCase();
  var filter = el('due-filter').value || 'current';
  var items = dueItems().filter(function (it) {
    if (filter === 'current') {
      var b = dueBucket(it);
      var anytime = it.kind === 'request' && !it.due;
      if (b !== 'overdue' && b !== 'month' && !anytime) return false;
    } else if (filter !== 'all' && dueBucket(it) !== filter) {
      return false;
    }
    if (!q) return true;
    return (it.name + ' ' + it.who + ' ' + methodLabel(it.method) + ' ' + (it.detail || '') + ' ' + (it.category || '')).toLowerCase().indexOf(q) !== -1;
  });
  if (!items.length) {
    list.innerHTML = emptyState(
      filter === 'upcoming' ? '🔍' : '✅',
      filter === 'current' ? 'Nothing due right now — all caught up!' :
        (filter === 'all' ? 'Nothing due — all caught up!' : 'Nothing matches this filter'),
      'Unpaid regular payments and approved requests appear here. The accountant checks them off with one click. Use the filter to look ahead.'
    );
    return;
  }
  var html = '';
  items.slice(0, 200).forEach(function (it) {
    var bucket = dueBucket(it);
    var dueTxt = it.due ? fmtDate(it.due) : 'No due date';
    var subTxt;
    if (!it.due) subTxt = 'Anytime';
    else if (bucket === 'overdue') subTxt = 'Overdue ' + Math.round((startOfDay(new Date()) - it.due) / 86400000) + 'd';
    else if (bucket === 'month') subTxt = 'This month';
    else subTxt = 'Upcoming';
    var chipCls = bucket === 'overdue' ? 'pm-chip-red' : (bucket === 'month' ? 'pm-chip-accent' : 'pm-chip-slate');
    var meta = (it.kind === 'regular' ? '🔁 Regular' : '📩 Request by ' + esc(it.requestedBy || '—')) +
      ' &middot; 👥 ' + esc(it.who || '—') +
      (it.method ? ' &middot; ' + methodLabel(it.method) : '') +
      (it.detail ? ' &middot; ' + esc(it.detail) : '');
    html += '<div class="pm-item pm-item--' + bucket + '">' +
      '<div class="pm-item-main">' +
        '<div class="pm-item-title">' + esc(it.name) +
          (it.category ? ' <span class="pm-chip pm-chip-slate">' + esc(it.category) + '</span>' : '') +
          ' <span class="pm-chip ' + chipCls + '">' + (bucket === 'overdue' ? '⏰' : bucket === 'month' ? '📅' : '🔜') + ' ' + esc(subTxt) + '</span>' +
        '</div>' +
        '<div class="pm-item-meta">' + meta + '</div>' +
      '</div>' +
      '<div class="pm-item-due"><div class="pm-due-date">' + esc(dueTxt) + '</div><div class="pm-due-sub">' + (it.due ? fmtDateFull(it.due) : '') + '</div></div>' +
      '<div class="pm-item-amount">' + fmtMoney(it.amount, it.currency) + '</div>' +
      '<div class="pm-item-actions">' +
        (canManage() ?
          '<button class="pm-btn pm-btn-primary pm-btn-sm" type="button" onclick="openPayModal(\'' + it.kind + '\',\'' + it.id + '\',\'' + (it.due ? isoDay(it.due) : '') + '\')">✓ Mark Paid</button>' :
          '<span class="pm-chip pm-chip-slate">🔒</span>') +
      '</div>' +
    '</div>';
  });
  list.innerHTML = html;
}

// ── Regular payments tab ────────────────────────────────────
function renderRegulars() {
  var list = el('regular-list');
  if (!list) return;
  var q = (el('regular-search').value || '').toLowerCase();
  var filter = el('regular-filter').value;
  var rows = DB.regulars.slice().sort(function (a, b) {
    if (!!a.active !== !!b.active) return a.active ? -1 : 1;
    return (a.name || '').localeCompare(b.name || '');
  }).filter(function (r) {
    if (filter === 'active' && !r.active) return false;
    if (filter === 'paused' && r.active) return false;
    if (!q) return true;
    return (r.name + ' ' + r.who + ' ' + typeLabelOf(r) + ' ' + methodLabel(r.method) + ' ' + (r.methodDetail || '')).toLowerCase().indexOf(q) !== -1;
  });
  if (!rows.length) {
    list.innerHTML = emptyState('🔁', 'No regular payments yet',
      'Add recurring payments here — rent, internet, payroll, insurance… Set how often they repeat and who gets paid.');
    return;
  }
  var html = '';
  rows.forEach(function (r) {
    var cd = cadenceById(r.cadence);
    var next = r.active ? nextDue(r) : null;
    var last = (r.history || []).slice().sort(function (a, b) { return String(b.dueDate).localeCompare(String(a.dueDate)); })[0];
    var cadTxt = cd ? cd.label + ' · ' + cd.every : (r.cadence || '—');
    var nextTxt;
    if (!r.active) nextTxt = 'Paused';
    else if (next) {
      var b = next < startOfDay(new Date()) ? 'overdue' : 'month';
      nextTxt = 'Due ' + fmtDate(next);
      if (b === 'overdue') nextTxt += ' ⏰';
    } else nextTxt = 'No schedule';
    var meta = '👥 ' + esc(r.who || '—') +
      (r.method ? ' &middot; ' + methodLabel(r.method) : '') +
      (r.methodDetail ? ' &middot; ' + esc(r.methodDetail) : '') +
      (deptNameOf(r) ? ' &middot; 🏢 ' + esc(deptNameOf(r)) : '');
    var actions = '';
    if (canManage()) {
      if (r.active && next) actions += '<button class="pm-btn pm-btn-primary pm-btn-sm" type="button" onclick="openPayModal(\'regular\',\'' + r.id + '\',\'' + isoDay(next) + '\')">✓ Pay</button>';
      actions += '<button class="pm-btn pm-btn-ghost pm-btn-sm" type="button" onclick="openRegularForm(\'' + r.id + '\')" title="Edit">✏️</button>';
      actions += '<button class="pm-btn pm-btn-ghost pm-btn-sm" type="button" onclick="toggleRegularActive(\'' + r.id + '\')" title="' + (r.active ? 'Pause' : 'Resume') + '">' + (r.active ? '⏸' : '▶') + '</button>';
      actions += '<button class="pm-btn pm-btn-ghost pm-btn-sm" type="button" onclick="duplicateRegular(\'' + r.id + '\')" title="Duplicate (copy)">⧉</button>';
      if (canAdmin()) actions += '<button class="pm-btn pm-btn-danger pm-btn-sm" type="button" onclick="deleteRegular(\'' + r.id + '\')" title="Delete">🗑</button>';
    } else {
      actions += '<span class="pm-chip pm-chip-slate">🔒</span>';
    }
    actions += '<button class="pm-btn pm-btn-ghost pm-btn-sm" type="button" onclick="toggleHistory(\'' + r.id + '\')" title="History">📜</button>';
    html += '<div class="pm-item' + (r.active ? '' : ' pm-item--paused') + '">' +
      '<div class="pm-item-main">' +
        '<div class="pm-item-title">' + esc(r.name) +
          ' <span class="pm-chip pm-chip-slate">🔁 ' + esc(cd ? cd.label : r.cadence) + '</span>' +
          (typeLabelOf(r) ? ' <span class="pm-chip pm-chip-blue">' + esc(typeLabelOf(r)) + '</span>' : '') +
          (sourceNameOf(r) ? ' <span class="pm-chip pm-chip-accent">🏦 ' + esc(sourceNameOf(r)) + '</span>' : '') +
          (r.active ? '' : ' <span class="pm-chip pm-chip-amber">⏸ Paused</span>') +
        '</div>' +
        '<div class="pm-item-meta">' + meta + '</div>' +
        '<div class="pm-item-meta"><b>' + esc(nextTxt) + '</b>' +
          (last ? ' &middot; last paid ' + fmtDate(parseISO(last.dueDate)) + ' · ' + fmtMoney(last.amount, r.currency) : ' &middot; not paid yet') +
          (r.history.length ? ' &middot; ' + r.history.length + ' payment' + (r.history.length > 1 ? 's' : '') + ' logged' : '') +
        '</div>' +
      '</div>' +
      '<div class="pm-item-due"><div class="pm-due-date">' + esc(cadTxt) + '</div><div class="pm-due-sub">' + (r.cadence === 'monthly' && r.anchor ? 'on day ' + parseISO(r.anchor).getDate() : '') + '</div></div>' +
      '<div class="pm-item-amount">' + fmtMoney(r.amount, r.currency) + '</div>' +
      '<div class="pm-item-actions">' + actions + '</div>' +
    '</div>' +
    '<div class="pm-hist-box" id="hist-' + r.id + '" style="display:none"></div>';
  });
  list.innerHTML = html;
}
function toggleHistory(id) {
  var box = el('hist-' + id);
  if (!box) return;
  var r = findRegular(id);
  if (!r) return;
  var hist = (r.history || []).slice().sort(function (a, b) { return String(b.dueDate).localeCompare(String(a.dueDate)); });
  if (box.style.display === 'none') {
    var html = '';
    if (!hist.length) html = '<div class="pm-hist-empty">No payments logged yet.</div>';
    else hist.forEach(function (h) {
      html += '<div class="pm-hist-row">' +
        '<span class="h-due">Due ' + esc(fmtDate(parseISO(h.dueDate))) + '</span>' +
        '<span>' + esc(h.note || '—') + '</span>' +
        '<span class="h-amt">' + fmtMoney(h.amount, r.currency) + '</span>' +
        '<span class="h-by">paid ' + esc(fmtDate(parseISO(h.paidAt))) + ' by ' + esc(h.paidBy || '—') + '</span>' +
      '</div>';
    });
    box.innerHTML = html;
    box.style.display = 'block';
  } else {
    box.style.display = 'none';
  }
  scheduleResize();
}
function toggleRegularActive(id) {
  var r = findRegular(id);
  if (!r) return;
  r.active = !r.active;
  persist();
  renderAll();
  notify(r.active ? 'Payment reactivated: ' + r.name : 'Payment paused: ' + r.name, 'info');
}
function deleteRegular(id) {
  var r = findRegular(id);
  if (!r) return;
  confirmDlg('Delete this regular payment?',
    '<strong>' + esc(r.name) + '</strong> and its logged history will be removed. This cannot be undone.',
    'Delete', 'danger', function () {
      DB.regulars = DB.regulars.filter(function (x) { return x.id !== id; });
      persist();
      renderAll();
      notify('Deleted: ' + r.name, 'info');
    });
}

// ── Requests tab ────────────────────────────────────────────
function requestSort(a, b) {
  var w = { pending: 0, approved: 1, paid: 2, declined: 3 };
  if (w[a.status] !== w[b.status]) return w[a.status] - w[b.status];
  var da = a.dueDate ? parseISO(a.dueDate) : null;
  var db = b.dueDate ? parseISO(b.dueDate) : null;
  if (da && db) return da - db;
  if (!da && db) return 1;
  if (da && !db) return -1;
  return String(b.requestedAt || '').localeCompare(String(a.requestedAt || ''));
}
function renderRequests() {
  var list = el('requests-list');
  if (!list) return;
  var q = (el('requests-search').value || '').toLowerCase();
  var filter = el('requests-filter').value;
  var rows = DB.requests.slice().sort(requestSort).filter(function (r) {
    if (!canSeeRequest(r)) return false;
    if (filter === 'open' && r.status !== 'pending' && r.status !== 'approved') return false;
    if (filter !== 'open' && filter !== 'all' && r.status !== filter) return false;
    if (!q) return true;
    return (r.title + ' ' + r.who + ' ' + typeLabelOf(r) + ' ' + methodLabel(r.method) + ' ' + (r.methodDetail || '')).toLowerCase().indexOf(q) !== -1;
  });
  if (!rows.length) {
    list.innerHTML = emptyState('📩', 'No requests here',
      requestVisibilityOwn() && !canAdmin() && !isPaymentTeam()
        ? 'You will see the requests you add here — plus their status. Admin approves, the payments team pays.'
        : 'Managers submit one-off payments here — supplier invoices, reimbursements… You approve, the accountant pays, you both see the status.');
    var hint = el('req-vis-hint');
    if (hint) hint.style.display = (requestVisibilityOwn() && !canAdmin() && !isPaymentTeam()) ? '' : 'none';
    return;
  }
  var hint2 = el('req-vis-hint');
  if (hint2) hint2.style.display = (requestVisibilityOwn() && !canAdmin() && !isPaymentTeam()) ? '' : 'none';
  var statusChip = {
    pending: '<span class="pm-chip pm-chip-amber">🕐 Pending approval</span>',
    approved: '<span class="pm-chip pm-chip-blue">✅ Approved — ready to pay</span>',
    paid: '<span class="pm-chip pm-chip-green">💸 Paid</span>',
    declined: '<span class="pm-chip pm-chip-slate">✕ Declined</span>'
  };
  var html = '';
  rows.forEach(function (r) {
    var locked = _readOnly || !canWrite();
    var actions = '';
    if (!locked) {
      if (r.status === 'pending') {
        if (canAdmin()) actions += '<button class="pm-btn pm-btn-primary pm-btn-sm" type="button" onclick="approveRequest(\'' + r.id + '\')">✓ Approve</button>' +
          '<button class="pm-btn pm-btn-danger pm-btn-sm" type="button" onclick="declineRequest(\'' + r.id + '\')">✕ Decline</button>';
        if (canEditRequestRow(r)) actions += '<button class="pm-btn pm-btn-ghost pm-btn-sm" type="button" onclick="openRequestForm(\'' + r.id + '\')">✏️</button>';
      }
      if (r.status === 'approved') {
        if (canManage()) actions += '<button class="pm-btn pm-btn-primary pm-btn-sm" type="button" onclick="openPayModal(\'request\',\'' + r.id + '\',\'\')">✓ Mark Paid</button>';
        if (canAdmin()) actions += '<button class="pm-btn pm-btn-ghost pm-btn-sm" type="button" onclick="reopenRequest(\'' + r.id + '\')">↩ Back to pending</button>';
      }
      if (r.status === 'paid' || r.status === 'declined') {
        if (canAdmin()) actions += '<button class="pm-btn pm-btn-ghost pm-btn-sm" type="button" onclick="reopenRequest(\'' + r.id + '\')">↩ Reopen</button>';
      }
      if (canAdmin()) actions += '<button class="pm-btn pm-btn-danger pm-btn-sm" type="button" onclick="deleteRequest(\'' + r.id + '\')" title="Delete">🗑</button>';
    } else {
      actions += '<span class="pm-chip pm-chip-slate">🔒</span>';
    }
    var dueTxt = r.dueDate ? fmtDate(parseISO(r.dueDate)) : 'No due date';
    html += '<div class="pm-item">' +
      '<div class="pm-item-main">' +
        '<div class="pm-item-title">' + esc(r.title) +
          (typeLabelOf(r) ? ' <span class="pm-chip pm-chip-slate">' + esc(typeLabelOf(r)) + '</span>' : '') +
          (sourceNameOf(r) ? ' <span class="pm-chip pm-chip-accent">🏦 ' + esc(sourceNameOf(r)) + '</span>' : '') +
        '</div>' +
        '<div class="pm-item-meta">👥 ' + esc(r.who || '—') +
          (r.method ? ' &middot; ' + methodLabel(r.method) : '') +
          (r.methodDetail ? ' &middot; ' + esc(r.methodDetail) : '') +
          (deptNameOf(r) ? ' &middot; 🏢 ' + esc(deptNameOf(r)) : '') +
        '</div>' +
        '<div class="pm-subrow">' + statusChip[r.status] +
          '<span class="pm-chip pm-chip-slate">🙋 ' + esc(r.requestedBy || '—') + '</span>' +
          (isOwnRequest(r) ? '<span class="pm-chip pm-chip-accent">🧑‍💼 Your request</span>' : '') +
          (r.status === 'paid' ? '<span class="pm-chip pm-chip-green">' + esc(fmtDate(parseISO(r.paidAt))) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="pm-item-due"><div class="pm-due-date">' + esc(dueTxt) + '</div><div class="pm-due-sub">' + (r.note ? esc(r.note) : '') + '</div></div>' +
      '<div class="pm-item-amount">' + fmtMoney(r.amount, r.currency) + '</div>' +
      '<div class="pm-item-actions">' + actions + '</div>' +
    '</div>';
  });
  list.innerHTML = html;
}
function approveRequest(id) {
  var r = findRequest(id);
  if (!r) return;
  r.status = 'approved';
  r.approvedBy = currentUserName();
  r.approvedAt = new Date().toISOString();
  persist();
  renderAll();
  notify('Request approved: ' + r.title, 'success');
}
function declineRequest(id) {
  var r = findRequest(id);
  if (!r) return;
  confirmDlg('Decline this request?', '<strong>' + esc(r.title) + '</strong> will be marked as declined.', 'Decline', 'danger', function () {
    r.status = 'declined';
    r.approvedBy = currentUserName();
    r.approvedAt = new Date().toISOString();
    persist();
    renderAll();
    notify('Request declined: ' + r.title, 'warning');
  });
}
function reopenRequest(id) {
  var r = findRequest(id);
  if (!r) return;
  r.status = 'pending';
  r.paidAt = '';
  r.paidBy = '';
  persist();
  renderAll();
  notify('Request moved back to pending: ' + r.title, 'info');
}
function deleteRequest(id) {
  var r = findRequest(id);
  if (!r) return;
  confirmDlg('Delete this request?', '<strong>' + esc(r.title) + '</strong> will be removed. This cannot be undone.', 'Delete', 'danger', function () {
    DB.requests = DB.requests.filter(function (x) { return x.id !== id; });
    persist();
    renderAll();
    notify('Deleted: ' + r.title, 'info');
  });
}

// ── Payees tab ──────────────────────────────────────────────
function payeeUsage(payeeId) {
  var n = 0;
  DB.regulars.forEach(function (r) { if (r.payeeId === payeeId) n++; });
  DB.requests.forEach(function (r) { if (r.payeeId === payeeId) n++; });
  return n;
}
function renderPayees() {
  var list = el('payees-list');
  if (!list) return;
  if (!DB.payees.length) {
    list.innerHTML = emptyState('👥', 'No payees saved yet',
      'Save who you pay (and how) once, then pick them from the dropdown when adding any payment.');
    return;
  }
  var html = '';
  DB.payees.slice().sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); }).forEach(function (p) {
    var used = payeeUsage(p.id);
    html += '<div class="pm-item">' +
      '<div class="pm-item-main">' +
        '<div class="pm-item-title">' + esc(p.name) +
          ' <span class="pm-chip pm-chip-accent">' + methodLabel(p.method) + '</span>' +
        '</div>' +
        '<div class="pm-item-meta">' + (p.detail ? esc(p.detail) : 'no method details') + (p.note ? ' &middot; ' + esc(p.note) : '') + '</div>' +
      '</div>' +
      '<div class="pm-item-due"><div class="pm-due-date">' + used + '</div><div class="pm-due-sub">payments use this</div></div>' +
      '<div class="pm-item-actions">' +
        (canManage() ?
          '<button class="pm-btn pm-btn-ghost pm-btn-sm" type="button" onclick="openPayeeForm(\'' + p.id + '\')">✏️</button>' +
          '<button class="pm-btn pm-btn-danger pm-btn-sm" type="button" onclick="deletePayee(\'' + p.id + '\')">🗑</button>' :
          '<span class="pm-chip pm-chip-slate">🔒</span>') +
      '</div>' +
    '</div>';
  });
  list.innerHTML = html;
}
function deletePayee(id) {
  var p = findPayee(id);
  if (!p) return;
  confirmDlg('Delete this payee?',
    '<strong>' + esc(p.name) + '</strong> will be removed from the list. Existing payments keep their details.',
    'Delete', 'danger', function () {
      DB.payees = DB.payees.filter(function (x) { return x.id !== id; });
      persist();
      renderAll();
      notify('Payee deleted: ' + p.name, 'info');
    });
}

// ── Departments, types, sources (org tab) ────────────────────
function monthlyEquivalent(reg) {
  var a = +reg.amount;
  if (isNaN(a) || a <= 0) return 0;
  switch (reg.cadence) {
    case 'weekly': return a * 52 / 12;
    case 'biweekly': return a * 26 / 12;
    case 'quarterly': return a / 3;
    case 'yearly': return a / 12;
    default: return a;
  }
}
function deptStats(dept) {
  var yStr = String(new Date().getFullYear());
  var cur = dept.currency || defCurrency();
  var used = 0, planned = 0, activeRegs = 0;
  DB.regulars.forEach(function (r) {
    if (r.departmentId !== dept.id) return;
    if ((r.currency || defCurrency()) !== cur) return;
    if (r.active) { planned += monthlyEquivalent(r); activeRegs++; }
    (r.history || []).forEach(function (h) {
      var d = (h.departmentId !== undefined && h.departmentId !== '') ? h.departmentId : r.departmentId;
      if (d !== dept.id) return;
      if (String(h.paidAt || '').slice(0, 4) !== yStr) return;
      used += +h.amount || 0;
    });
  });
  DB.requests.forEach(function (q) {
    if (q.departmentId !== dept.id) return;
    if ((q.currency || defCurrency()) !== cur) return;
    if (q.status === 'paid' && String(q.paidAt || '').slice(0, 4) === yStr) {
      used += +(q.paidAmount !== '' && q.paidAmount !== undefined && q.paidAmount !== null ? q.paidAmount : q.amount) || 0;
    }
  });
  var budget = +dept.budget || 0;
  var left = budget - used;
  var monthsLeft = planned > 0 ? left / planned : null;
  return { used: used, planned: planned, budget: budget, left: left, monthsLeft: monthsLeft, activeRegs: activeRegs, currency: cur };
}
function renderOrg() {
  renderDepartments();
  renderTypes();
  renderSources();
}
function renderDepartments() {
  var list = el('dept-list');
  if (!list) return;
  if (!DB.departments.length) {
    list.innerHTML = emptyState('🏢', 'No departments yet',
      'Add departments (e.g. Marketing, Youth, Operations) and set a yearly budget. Link payments to them to watch the budget usage and forecast.');
    return;
  }
  var html = '';
  DB.departments.forEach(function (d) {
    var st = deptStats(d);
    var pct = st.budget > 0 ? st.used / st.budget * 100 : 0;
    var barCls = pct > 100 ? 'pm-progress-over' : (pct > 80 ? 'pm-progress-warn' : '');
    var monthsTxt;
    if (st.monthsLeft === null) monthsTxt = 'no recurring costs yet';
    else if (st.monthsLeft < 0) monthsTxt = '⚠ already over budget';
    else monthsTxt = '~' + Math.round(st.monthsLeft * 10) / 10 + ' months left at planned rate';
    html += '<div class="pm-item">' +
      '<div class="pm-item-main">' +
        '<div class="pm-item-title">' + esc(d.name) + ' <span class="pm-chip pm-chip-accent">' + esc(st.currency) + '</span>' +
          (d.note ? ' <span class="pm-chip pm-chip-slate">' + esc(d.note) + '</span>' : '') +
        '</div>' +
        '<div class="pm-item-meta">Planned recurring: ' + fmtMoney(st.planned, st.currency) + '/mo · ' + st.activeRegs + ' active regular' + (st.activeRegs !== 1 ? 's' : '') + ' · ' + esc(monthsTxt) + '</div>' +
        '<div class="pm-progress"><i class="' + barCls + '" style="width:' + Math.min(100, Math.max(0, pct)) + '%"></i></div>' +
      '</div>' +
      '<div class="pm-item-due"><div class="pm-due-date">' + fmtMoney(st.left, st.currency) + '</div><div class="pm-due-sub">left of ' + fmtMoney(st.budget, st.currency) + '</div></div>' +
      '<div class="pm-item-amount">' + fmtMoney(st.used, st.currency) + '<div class="pm-due-sub">used (' + Math.round(pct) + '%)</div></div>' +
      '<div class="pm-item-actions">' +
        (canManage() ? '<button class="pm-btn pm-btn-ghost pm-btn-sm" type="button" onclick="openDepartmentForm(\'' + d.id + '\')">✏️</button>' +
          (canAdmin() ? '<button class="pm-btn pm-btn-danger pm-btn-sm" type="button" onclick="deleteDepartment(\'' + d.id + '\')">🗑</button>' : '') :
          '<span class="pm-chip pm-chip-slate">🔒</span>') +
      '</div>' +
    '</div>';
  });
  list.innerHTML = html;
}
function listUsageCount(field, id) {
  var n = 0;
  DB.regulars.forEach(function (r) { if (r[field] === id) n++; });
  DB.requests.forEach(function (q) { if (q[field] === id) n++; });
  return n;
}
function renderTypes() {
  var list = el('types-list');
  if (!list) return;
  if (!DB.types.length) {
    list.innerHTML = emptyState('🏷', 'No payment types yet',
      'Types say what each payment is — salary, rent, event cost, utilities… Existing payments automatically created their type from the old category field.');
    return;
  }
  var html = '';
  DB.types.slice().sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); }).forEach(function (t) {
    var used = listUsageCount('typeId', t.id);
    html += '<div class="pm-item">' +
      '<div class="pm-item-main">' +
        '<div class="pm-item-title">' + esc(t.name) + '</div>' +
        '<div class="pm-item-meta">' + (t.note ? esc(t.note) : '') + '</div>' +
      '</div>' +
      '<div class="pm-item-due"><div class="pm-due-date">' + used + '</div><div class="pm-due-sub">payments use this</div></div>' +
      '<div class="pm-item-actions">' +
        (canManage() ? '<button class="pm-btn pm-btn-ghost pm-btn-sm" type="button" onclick="openTypeForm(\'' + t.id + '\')">✏️</button>' +
          (canAdmin() ? '<button class="pm-btn pm-btn-danger pm-btn-sm" type="button" onclick="deleteType(\'' + t.id + '\')">🗑</button>' : '') :
          '<span class="pm-chip pm-chip-slate">🔒</span>') +
      '</div>' +
    '</div>';
  });
  list.innerHTML = html;
}
function renderSources() {
  var list = el('sources-list');
  if (!list) return;
  if (!DB.sources.length) {
    list.innerHTML = emptyState('🏦', 'No money sources yet',
      'Sources say where the money comes from — a specific grant, a bank account, cash box… Add them here, then pick one on any payment.');
    return;
  }
  var html = '';
  DB.sources.slice().sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); }).forEach(function (s) {
    var used = listUsageCount('sourceId', s.id);
    html += '<div class="pm-item">' +
      '<div class="pm-item-main">' +
        '<div class="pm-item-title">' + esc(s.name) + '</div>' +
        '<div class="pm-item-meta">' + (s.note ? esc(s.note) : '') + '</div>' +
      '</div>' +
      '<div class="pm-item-due"><div class="pm-due-date">' + used + '</div><div class="pm-due-sub">payments use this</div></div>' +
      '<div class="pm-item-actions">' +
        (canManage() ? '<button class="pm-btn pm-btn-ghost pm-btn-sm" type="button" onclick="openSourceForm(\'' + s.id + '\')">✏️</button>' +
          (canAdmin() ? '<button class="pm-btn pm-btn-danger pm-btn-sm" type="button" onclick="deleteSource(\'' + s.id + '\')">🗑</button>' : '') :
          '<span class="pm-chip pm-chip-slate">🔒</span>') +
      '</div>' +
    '</div>';
  });
  list.innerHTML = html;
}
function _openDepartmentForm(id) {
  var d = id ? findDept(id) : null;
  openModal(
    '<div class="pm-modal-head"><div class="pm-modal-title">' + (d ? '✏️ Edit Department' : '🏢 New Department') + '</div>' +
    '<button class="pm-modal-close" type="button" onclick="closeModal()">✕</button></div>' +
    '<form onsubmit="event.preventDefault();saveDepartmentForm()">' +
    '<div class="pm-modal-body">' +
      '<div class="pm-form-grid">' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="dp-name">Department name <span class="pm-req">*</span></label>' +
        '<input class="pm-input" id="dp-name" placeholder="e.g. Marketing" value="' + esc(d ? d.name : '') + '" required></div>' +
        '<div class="pm-fld"><label class="pm-label" for="dp-budget">Yearly budget</label>' +
        '<input class="pm-input" id="dp-budget" type="number" min="0" step="0.01" placeholder="e.g. 50000" value="' + esc(d ? d.budget : '') + '"></div>' +
        '<div class="pm-fld"><label class="pm-label" for="dp-currency">Currency</label>' +
        '<select class="pm-input" id="dp-currency">' + currencyOptions(d ? d.currency : defCurrency()) + '</select></div>' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="dp-note">Note</label>' +
        '<input class="pm-input" id="dp-note" placeholder="Optional" value="' + esc(d ? d.note : '') + '"></div>' +
      '</div>' +
    '</div>' +
    '<div class="pm-modal-foot">' +
      '<button class="pm-btn pm-btn-ghost" type="button" onclick="closeModal()">Cancel</button>' +
      '<button class="pm-btn pm-btn-primary" type="submit">' + (d ? 'Save Changes' : 'Add Department') + '</button>' +
    '</div>' +
    '</form>'
  );
}
function saveDepartmentForm() {
  var id = _editDeptId || '';
  var d = id ? findDept(id) : null;
  var name = el('dp-name').value.trim();
  if (!name) { notify('Please enter a department name', 'warning'); return; }
  var data = {
    name: name,
    budget: Math.max(0, parseFloat(el('dp-budget').value) || 0),
    currency: el('dp-currency').value,
    note: el('dp-note').value.trim()
  };
  if (d) {
    Object.keys(data).forEach(function (k) { d[k] = data[k]; });
    notify('Department updated: ' + d.name, 'success');
  } else {
    data.id = uid('dep');
    DB.departments.push(data);
    notify('Department added: ' + data.name, 'success');
  }
  persist();
  closeModal();
  renderAll();
}
function deleteDepartment(id) {
  var d = findDept(id);
  if (!d) return;
  var used = listUsageCount('departmentId', id);
  confirmDlg('Delete this department?',
    '<strong>' + esc(d.name) + '</strong> is used by ' + used + ' payment' + (used !== 1 ? 's' : '') + '. They will keep their history but become unassigned. This cannot be undone.',
    'Delete', 'danger', function () {
      DB.departments = DB.departments.filter(function (x) { return x.id !== id; });
      persist();
      renderAll();
      notify('Deleted: ' + d.name, 'info');
    });
}
function _openTypeForm(id) {
  var t = id ? findType(id) : null;
  openModal(
    '<div class="pm-modal-head"><div class="pm-modal-title">' + (t ? '✏️ Edit Payment Type' : '🏷 New Payment Type') + '</div>' +
    '<button class="pm-modal-close" type="button" onclick="closeModal()">✕</button></div>' +
    '<form onsubmit="event.preventDefault();saveTypeForm()">' +
    '<div class="pm-modal-body">' +
      '<div class="pm-form-grid">' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="tp-name">Type name <span class="pm-req">*</span></label>' +
        '<input class="pm-input" id="tp-name" placeholder="e.g. Event Cost" value="' + esc(t ? t.name : '') + '" required></div>' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="tp-note">Note</label>' +
        '<input class="pm-input" id="tp-note" placeholder="Optional" value="' + esc(t ? t.note : '') + '"></div>' +
      '</div>' +
    '</div>' +
    '<div class="pm-modal-foot">' +
      '<button class="pm-btn pm-btn-ghost" type="button" onclick="closeModal()">Cancel</button>' +
      '<button class="pm-btn pm-btn-primary" type="submit">' + (t ? 'Save Changes' : 'Add Type') + '</button>' +
    '</div>' +
    '</form>'
  );
}
function saveTypeForm() {
  var id = _editTypeId || '';
  var t = id ? findType(id) : null;
  var name = el('tp-name').value.trim();
  if (!name) { notify('Please enter a type name', 'warning'); return; }
  var data = { name: name, note: el('tp-note').value.trim() };
  if (t) {
    Object.keys(data).forEach(function (k) { t[k] = data[k]; });
    notify('Type updated: ' + t.name, 'success');
  } else {
    data.id = uid('typ');
    DB.types.push(data);
    notify('Type added: ' + data.name, 'success');
  }
  persist();
  closeModal();
  renderAll();
}
function deleteType(id) {
  var t = findType(id);
  if (!t) return;
  var used = listUsageCount('typeId', id);
  confirmDlg('Delete this type?', '<strong>' + esc(t.name) + '</strong> is used by ' + used + ' payment' + (used !== 1 ? 's' : '') + '. They will keep the name but become unlinked.', 'Delete', 'danger', function () {
    DB.types = DB.types.filter(function (x) { return x.id !== id; });
    persist();
    renderAll();
    notify('Deleted: ' + t.name, 'info');
  });
}
function _openSourceForm(id) {
  var s = id ? findSource(id) : null;
  openModal(
    '<div class="pm-modal-head"><div class="pm-modal-title">' + (s ? '✏️ Edit Money Source' : '🏦 New Money Source') + '</div>' +
    '<button class="pm-modal-close" type="button" onclick="closeModal()">✕</button></div>' +
    '<form onsubmit="event.preventDefault();saveSourceForm()">' +
    '<div class="pm-modal-body">' +
      '<div class="pm-form-grid">' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="sr-name">Source name <span class="pm-req">*</span></label>' +
        '<input class="pm-input" id="sr-name" placeholder="e.g. Community Grant 2026" value="' + esc(s ? s.name : '') + '" required></div>' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="sr-note">Note</label>' +
        '<input class="pm-input" id="sr-note" placeholder="Optional" value="' + esc(s ? s.note : '') + '"></div>' +
      '</div>' +
    '</div>' +
    '<div class="pm-modal-foot">' +
      '<button class="pm-btn pm-btn-ghost" type="button" onclick="closeModal()">Cancel</button>' +
      '<button class="pm-btn pm-btn-primary" type="submit">' + (s ? 'Save Changes' : 'Add Source') + '</button>' +
    '</div>' +
    '</form>'
  );
}
function saveSourceForm() {
  var id = _editSourceId || '';
  var s = id ? findSource(id) : null;
  var name = el('sr-name').value.trim();
  if (!name) { notify('Please enter a source name', 'warning'); return; }
  var data = { name: name, note: el('sr-note').value.trim() };
  if (s) {
    Object.keys(data).forEach(function (k) { s[k] = data[k]; });
    notify('Source updated: ' + s.name, 'success');
  } else {
    data.id = uid('src');
    DB.sources.push(data);
    notify('Source added: ' + data.name, 'success');
  }
  persist();
  closeModal();
  renderAll();
}
function deleteSource(id) {
  var s = findSource(id);
  if (!s) return;
  var used = listUsageCount('sourceId', id);
  confirmDlg('Delete this source?', '<strong>' + esc(s.name) + '</strong> is used by ' + used + ' payment' + (used !== 1 ? 's' : '') + '. They will keep the name but become unlinked.', 'Delete', 'danger', function () {
    DB.sources = DB.sources.filter(function (x) { return x.id !== id; });
    persist();
    renderAll();
    notify('Deleted: ' + s.name, 'info');
  });
}

// ── History tab ─────────────────────────────────────────────
function historyItems() {
  var items = [];
  DB.regulars.forEach(function (r) {
    (r.history || []).forEach(function (h) {
      items.push({
        paidAt: h.paidAt || '', due: h.dueDate || '', name: r.name, kind: 'Regular',
        category: typeLabelOf(r), method: h.method || r.method || '', who: r.who || '',
        amount: h.amount, currency: r.currency || defCurrency(), paidBy: h.paidBy || '', note: h.note || ''
      });
    });
  });
  DB.requests.forEach(function (q) {
    if (q.status !== 'paid') return;
    if (!canSeeRequest(q)) return;
    items.push({
      paidAt: q.paidAt || '', due: q.dueDate || '', name: q.title, kind: 'Request',
      category: typeLabelOf(q), method: q.method || '', who: q.who || '',
      amount: (q.paidAmount !== '' && q.paidAmount !== undefined && q.paidAmount !== null) ? q.paidAmount : q.amount,
      currency: q.currency || defCurrency(), paidBy: q.paidBy || '', note: q.payNote || q.note || ''
    });
  });
  items.sort(function (a, b) { return String(b.paidAt || '').localeCompare(String(a.paidAt || '')); });
  return items;
}
function historyFiltered() {
  var month = el('history-month').value;
  var cat = el('history-cat').value;
  var q = (el('history-search').value || '').toLowerCase();
  return historyItems().filter(function (h) {
    if (month !== 'all' && String(h.paidAt || '').slice(0, 7) !== month) return false;
    if (cat !== 'all' && (h.category || '') !== cat) return false;
    if (!q) return true;
    return (h.name + ' ' + h.who + ' ' + h.category + ' ' + methodLabel(h.method) + ' ' + h.paidBy).toLowerCase().indexOf(q) !== -1;
  });
}
function renderHistory() {
  var monthSel = el('history-month'), catSel = el('history-cat');
  if (!monthSel) return;
  var prevMonth = monthSel.value, prevCat = catSel.value;
  var months = {}, cats = {};
  historyItems().forEach(function (h) {
    if (h.paidAt) months[String(h.paidAt).slice(0, 7)] = true;
    if (h.category) cats[h.category] = true;
  });
  var now = new Date();
  months[now.getFullYear() + '-' + pad2(now.getMonth() + 1)] = true;
  var mOpts = '<option value="all">All months</option>';
  Object.keys(months).sort().reverse().forEach(function (m) {
    mOpts += '<option value="' + esc(m) + '">' + esc(monthLabel(m)) + '</option>';
  });
  monthSel.innerHTML = mOpts;
  if (prevMonth && months[prevMonth]) monthSel.value = prevMonth;
  var cOpts = '<option value="all">All categories</option>';
  Object.keys(cats).sort().forEach(function (c) {
    cOpts += '<option value="' + esc(c) + '">' + esc(c) + '</option>';
  });
  catSel.innerHTML = cOpts;
  if (prevCat && cats[prevCat]) catSel.value = prevCat;

  var rows = historyFiltered();
  var body = el('history-body');
  var summary = el('history-summary');
  var sums = sumByCurrency(rows.map(function (r) { return { amount: r.amount, currency: r.currency }; }));
  summary.innerHTML =
    statChip('🧾', 'Payments', rows.length, 'in this view', '') +
    statChip('💰', 'Total', fmtSumMap(sums), 'all currencies', 'pm-stat--paid');
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="9"><div class="pm-empty" style="border:none"><div class="pm-empty-ic">📊</div><div class="pm-empty-title">No paid payments here</div><div class="pm-empty-sub">Mark payments as paid and they will show up in this log automatically.</div></div></td></tr>';
    el('history-count').textContent = '';
    return;
  }
  var html = '';
  rows.forEach(function (h) {
    html += '<tr>' +
      '<td>' + esc(fmtDate(parseISO(h.paidAt))) + '</td>' +
      '<td>' + esc(fmtDate(parseISO(h.due))) + '</td>' +
      '<td class="t-name" title="' + esc(h.note) + '">' + esc(h.name) + '</td>' +
      '<td>' + (h.kind === 'Regular' ? '🔁' : '📩') + ' ' + esc(h.kind) + '</td>' +
      '<td>' + esc(h.category) + '</td>' +
      '<td>' + esc(methodLabel(h.method)) + '</td>' +
      '<td>' + esc(h.who) + '</td>' +
      '<td class="t-amt">' + fmtMoney(h.amount, h.currency) + '</td>' +
      '<td>' + esc(h.paidBy) + '</td>' +
    '</tr>';
  });
  body.innerHTML = html;
  el('history-count').textContent = rows.length + ' payment' + (rows.length > 1 ? 's' : '') + ' shown';
}

// ── Month view (per-month monitor — what is done / not done) ─
function currentMonthKey() {
  var now = new Date();
  return now.getFullYear() + '-' + pad2(now.getMonth() + 1);
}
function monthViewRows(ym) {
  var p = ym.split('-');
  var ms = new Date(+p[0], +p[1] - 1, 1);
  var me = new Date(+p[0], +p[1], 0);
  var rows = [];
  DB.regulars.forEach(function (r) {
    if (!r.active) return;
    computeDueDates(r, ms, me).forEach(function (due) {
      var key = isoDay(due);
      var paid = null;
      (r.history || []).forEach(function (h) { if (h.dueDate === key) paid = h; });
      rows.push({
        kind: 'regular', name: r.name, category: typeLabelOf(r), who: r.who, method: r.method,
        due: due,
        amount: paid ? paid.amount : r.amount,
        currency: r.currency,
        status: paid ? 'paid' : 'unpaid',
        paidAt: paid ? paid.paidAt : '',
        paidBy: paid ? paid.paidBy : '',
        note: paid ? paid.note : ''
      });
    });
  });
  DB.requests.forEach(function (q) {
    if (!canSeeRequest(q)) return;
    var inMonth = q.dueDate && String(q.dueDate).slice(0, 7) === ym;
    var createdIn = !q.dueDate && String(q.requestedAt || '').slice(0, 7) === ym;
    if (!inMonth && !createdIn) return;
    rows.push({
      kind: 'request', name: q.title, category: typeLabelOf(q), who: q.who, method: q.method,
      due: inMonth ? parseISO(q.dueDate) : null,
      amount: (q.status === 'paid' && q.paidAmount !== '' && q.paidAmount !== undefined && q.paidAmount !== null) ? q.paidAmount : q.amount,
      currency: q.currency,
      status: q.status,
      paidAt: q.paidAt || '',
      paidBy: q.paidBy || '',
      note: q.payNote || q.note || '',
      requestedBy: q.requestedBy
    });
  });
  var notDone = [], done = [];
  rows.forEach(function (row) {
    if (row.status === 'paid' || row.status === 'declined') done.push(row);
    else notDone.push(row);
  });
  notDone.sort(function (a, b) {
    var ta = a.due ? a.due.getTime() : 8640000000000;
    var tb = b.due ? b.due.getTime() : 8640000000000;
    return ta - tb;
  });
  done.sort(function (a, b) { return String(b.paidAt).localeCompare(String(a.paidAt)); });
  var sumNot = sumByCurrency(notDone.map(function (r) { return { amount: r.amount, currency: r.currency }; }));
  var sumPaid = sumByCurrency(done.filter(function (r) { return r.status === 'paid'; }).map(function (r) { return { amount: r.amount, currency: r.currency }; }));
  var sumTotal = {};
  [sumNot, sumPaid].forEach(function (m) { Object.keys(m).forEach(function (c) { sumTotal[c] = (sumTotal[c] || 0) + m[c]; }); });
  return { rows: rows, notDone: notDone, done: done, sumNot: sumNot, sumPaid: sumPaid, sumTotal: sumTotal };
}
function monthViewRowHtml(row) {
  var today = startOfDay(new Date());
  var isLate = row.status !== 'paid' && row.status !== 'declined' && row.due && row.due < today;
  var typeChip = row.kind === 'regular' ? '<span class="pm-chip pm-chip-slate">🔁 Regular</span>' : '<span class="pm-chip pm-chip-slate">📩 Request</span>';
  var statusChip;
  if (row.status === 'paid') statusChip = '<span class="pm-chip pm-chip-green">✓ Paid</span>';
  else if (row.status === 'declined') statusChip = '<span class="pm-chip pm-chip-slate">✕ Declined</span>';
  else if (row.status === 'pending') statusChip = '<span class="pm-chip pm-chip-amber">🕐 Pending approval</span>';
  else if (row.status === 'approved') statusChip = '<span class="pm-chip pm-chip-blue">✅ Approved</span>';
  else statusChip = '<span class="pm-chip pm-chip-red">✗ Not paid</span>';
  var itemCls = row.status === 'paid' ? 'pm-item--month' : (isLate ? 'pm-item--overdue' : 'pm-item--upcoming');
  var sideTxt = row.status === 'paid'
    ? 'Paid ' + esc(fmtDate(parseISO(row.paidAt))) + ' by ' + esc(row.paidBy || '—')
    : (row.due ? 'Due ' + esc(fmtDateFull(row.due)) : 'No due date');
  return '<div class="pm-item ' + itemCls + '">' +
    '<div class="pm-item-main">' +
      '<div class="pm-item-title">' + esc(row.name) + ' ' + typeChip + ' ' + statusChip +
        (row.category ? ' <span class="pm-chip pm-chip-blue">' + esc(row.category) + '</span>' : '') +
      '</div>' +
      '<div class="pm-item-meta">👥 ' + esc(row.who || '—') + (row.method ? ' &middot; ' + methodLabel(row.method) : '') + '</div>' +
    '</div>' +
    '<div class="pm-item-due"><div class="pm-due-date">' + sideTxt + '</div><div class="pm-due-sub">' + (row.note ? esc(row.note) : '') + '</div></div>' +
    '<div class="pm-item-amount">' + fmtMoney(row.amount, row.currency) + '</div>' +
    '<div class="pm-item-actions"></div>' +
  '</div>';
}
function renderMonthView() {
  var sel = el('mv-month');
  if (!sel) return;
  var prev = sel.value;
  var now = new Date();
  var opts = '';
  for (var i = -12; i <= 12; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    var ym = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
    opts += '<option value="' + ym + '">' + esc(monthLabel(ym)) + '</option>';
  }
  sel.innerHTML = opts;
  var cur = currentMonthKey();
  var found = false;
  for (var j = 0; j < sel.options.length; j++) {
    if (sel.options[j].value === prev) { found = true; break; }
  }
  sel.value = found ? prev : cur;
  var ymNow = sel.value;
  var data = monthViewRows(ymNow);
  var sumBox = el('mv-summary');
  if (sumBox) {
    var donePaid = data.done.filter(function (r) { return r.status === 'paid'; }).length;
    sumBox.innerHTML =
      statChip('📆', 'Due in ' + monthLabel(ymNow), fmtSumMap(data.sumTotal), data.rows.length + ' item' + (data.rows.length !== 1 ? 's' : ''), 'pm-stat--due') +
      statChip('❌', 'Not done', fmtSumMap(data.sumNot), data.notDone.length + ' outstanding', 'pm-stat--overdue') +
      statChip('✅', 'Done', fmtSumMap(data.sumPaid), donePaid + ' paid', 'pm-stat--paid');
  }
  var nd = el('mv-not-done');
  if (nd) {
    var ndHtml = '<div class="pm-mv-title">❌ Not done <span class="pm-chip pm-chip-red">' + data.notDone.length + '</span><span class="pm-mv-total">' + fmtSumMap(data.sumNot) + '</span></div>';
    if (!data.notDone.length) {
      ndHtml += emptyState('🎉', 'Nothing outstanding for this month', 'Every payment due in this month has been checked off.');
    } else {
      data.notDone.forEach(function (row) { ndHtml += monthViewRowHtml(row); });
    }
    nd.innerHTML = ndHtml;
  }
  var dn = el('mv-done');
  if (dn) {
    var dnHtml = '<div class="pm-mv-title">✅ Done <span class="pm-chip pm-chip-green">' + data.done.length + '</span><span class="pm-mv-total">' + fmtSumMap(data.sumPaid) + '</span></div>';
    if (!data.done.length) {
      dnHtml += '<div class="pm-empty" style="padding:20px"><div class="pm-empty-sub">Nothing paid in this month yet.</div></div>';
    } else {
      data.done.forEach(function (row) { dnHtml += monthViewRowHtml(row); });
    }
    dn.innerHTML = dnHtml;
  }
  scheduleResize();
}
function exportMonthCsv() {
  var sel = el('mv-month');
  var ym = (sel && sel.value) ? sel.value : currentMonthKey();
  var data = monthViewRows(ym);
  if (!data.rows.length) { notify('Nothing to export for ' + monthLabel(ym), 'warning'); return; }
  var statusLabel = { paid: 'Paid', unpaid: 'Not paid', pending: 'Pending approval', approved: 'Approved', declined: 'Declined' };
  var lines = [['Month', 'Payment', 'Type', 'Who', 'Method', 'Due', 'Status', 'Amount', 'Currency', 'Paid on', 'Paid by', 'Note']];
  data.notDone.concat(data.done).forEach(function (r) {
    lines.push([ym, r.name, r.kind === 'regular' ? 'Regular' : 'Request', r.who, methodLabel(r.method), r.due ? isoDay(r.due) : '', statusLabel[r.status] || r.status, r.amount, r.currency, r.paidAt, r.paidBy, r.note]);
  });
  if (downloadCsv('payments-month-' + ym + '.csv', lines)) notify('CSV downloaded', 'success');
  else notify('CSV export failed in this browser', 'error');
}

// ── Trim old data (keep the 1 MB document small) ───────────
function openTrimModal() {
  var now = new Date();
  var opts = '';
  for (var i = 3; i <= 36; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var ym = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
    opts += '<option value="' + ym + '">' + esc(monthLabel(ym)) + '</option>';
  }
  var def = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  var defYm = def.getFullYear() + '-' + pad2(def.getMonth() + 1);
  openModal(
    '<div class="pm-modal-head"><div class="pm-modal-title">🧹 Trim Old Data</div>' +
    '<button class="pm-modal-close" type="button" onclick="closeModal()">✕</button></div>' +
    '<form onsubmit="event.preventDefault();doTrim()">' +
    '<div class="pm-modal-body">' +
      '<p class="pm-hint" style="margin:0 0 10px">The tool keeps everything in one CMS document (1 MB limit). Delete old payment records to keep it small. <strong>Export the History tab to CSV first</strong> if you need to keep the records.</p>' +
      '<div class="pm-form-grid">' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="tm-month">Delete everything before this month</label>' +
        '<select class="pm-input" id="tm-month">' + opts + '</select></div>' +
        '<div class="pm-fld pm-fld-full"><label class="pm-check"><input type="checkbox" id="tm-regulars" checked> Regular payment history (the bulk of the data)</label></div>' +
        '<div class="pm-fld pm-fld-full"><label class="pm-check"><input type="checkbox" id="tm-requests"> Paid / declined requests</label></div>' +
      '</div>' +
    '</div>' +
    '<div class="pm-modal-foot">' +
      '<button class="pm-btn pm-btn-ghost" type="button" onclick="closeModal()">Cancel</button>' +
      '<button class="pm-btn pm-btn-danger" type="submit">Delete Old Data</button>' +
    '</div>' +
    '</form>'
  );
  var sel = el('tm-month');
  if (sel) sel.value = defYm;
}
function doTrim() {
  var monthVal = el('tm-month').value;
  if (!monthVal) { notify('Choose a cutoff month', 'warning'); return; }
  var cutoff = monthVal + '-01';
  var trimRegulars = el('tm-regulars') ? el('tm-regulars').checked : true;
  var trimRequests = el('tm-requests') ? el('tm-requests').checked : false;
  var before = estSizeBytes();
  var removed = 0;
  if (trimRegulars) {
    DB.regulars.forEach(function (r) {
      var beforeCount = (r.history || []).length;
      r.history = (r.history || []).filter(function (h) {
        return !h.paidAt || String(h.paidAt).slice(0, 10) >= cutoff;
      });
      removed += beforeCount - r.history.length;
    });
  }
  if (trimRequests) {
    var kept = [];
    DB.requests.forEach(function (q) {
      var ok = true;
      if (q.status === 'paid' || q.status === 'declined') {
        var refDate = String(q.paidAt || q.dueDate || q.requestedAt || '').slice(0, 10);
        if (refDate && refDate < cutoff) ok = false;
      }
      if (ok) kept.push(q); else removed++;
    });
    DB.requests = kept;
  }
  if (!removed) {
    notify('Nothing to delete before ' + monthLabel(monthVal), 'info');
    closeModal();
    return;
  }
  var after = estSizeBytes();
  persist();
  closeModal();
  renderAll();
  notify('Trimmed ' + removed + ' old record' + (removed !== 1 ? 's' : '') + ' — freed ~' + fmtSize(Math.max(0, before - after)), 'success');
}

// ── Exports ─────────────────────────────────────────────────
function csvCell(c) {
  c = String(c === null || c === undefined ? '' : c);
  return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
}
function downloadCsv(filename, lines) {
  var csv = lines.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
  try {
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    return true;
  } catch (e) {
    return false;
  }
}
function exportCsv() {
  var rows = historyFiltered();
  if (!rows.length) { notify('Nothing to export with the current filters', 'warning'); return; }
  var lines = [['Paid on', 'Due', 'Payment', 'Type', 'Category', 'Method', 'Who', 'Amount', 'Currency', 'Paid by', 'Note']];
  rows.forEach(function (h) {
    lines.push([h.paidAt, h.due, h.name, h.kind, h.category, methodLabel(h.method), h.who, h.amount, h.currency, h.paidBy, h.note]);
  });
  if (downloadCsv('payments-history-' + isoDay(new Date()) + '.csv', lines)) notify('CSV downloaded', 'success');
  else notify('CSV export failed in this browser', 'error');
}
function exportPdf() {
  var rows = historyFiltered();
  if (!rows.length) { notify('Nothing to export with the current filters', 'warning'); return; }
  var rowsHtml = rows.map(function (h) {
    return '<tr>' +
      '<td>' + esc(fmtDate(parseISO(h.paidAt))) + '</td>' +
      '<td>' + esc(fmtDate(parseISO(h.due))) + '</td>' +
      '<td>' + esc(h.name) + '</td>' +
      '<td>' + esc(h.kind) + '</td>' +
      '<td>' + esc(h.category) + '</td>' +
      '<td>' + esc(methodLabel(h.method)) + '</td>' +
      '<td>' + esc(h.who) + '</td>' +
      '<td style="white-space:nowrap">' + fmtMoney(h.amount, h.currency) + '</td>' +
      '<td>' + esc(h.paidBy) + '</td>' +
    '</tr>';
  }).join('');
  var sums = sumByCurrency(rows.map(function (r) { return { amount: r.amount, currency: r.currency }; }));
  var html = '<div style="font-family:Arial,sans-serif;color:#111;padding:24px">' +
    '<h1 style="font-size:22px;margin:0 0 4px">Payments History</h1>' +
    '<p style="color:#555;margin:0 0 18px">Exported ' + new Date().toLocaleString() + ' · ' + rows.length + ' payments · Total ' + fmtSumMap(sums) + '</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
    '<thead><tr>' +
    ['Paid on', 'Due', 'Payment', 'Type', 'Category', 'Method', 'Who', 'Amount', 'Paid by'].map(function (t) { return '<th style="text-align:left;padding:8px;border-bottom:2px solid #999">' + t + '</th>'; }).join('') +
    '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
  if (tool.requestExportPdf) {
    tool.requestExportPdf({ html: html, filename: 'payments-history-' + isoDay(new Date()) }, function (err, file) {
      if (err) { notify('PDF export failed: ' + err, 'error'); return; }
      notify('Report exported', 'success');
      if (file && file.url && tool.openUrl) tool.openUrl(file.url);
    });
  } else {
    notify('PDF export is not available in this environment', 'warning');
  }
}

// ── Copy / paste regular payment lists between tool instances ─
// Export strips ids & history — import creates fresh copies so the
// schedule starts clean in the new instance.
function exportRegulars() {
  if (!DB.regulars.length) { notify('No regular payments to export', 'warning'); return; }
  var clean = DB.regulars.map(function (r) {
    return {
      name: r.name, category: typeLabelOf(r), amount: r.amount, currency: r.currency,
      cadence: r.cadence, day: r.day, anchor: r.anchor,
      who: r.who || '', method: r.method || '', methodDetail: r.methodDetail || '',
      note: r.note || '', active: !!r.active,
      department: deptNameOf(r), type: typeLabelOf(r), source: sourceNameOf(r)
    };
  });
  var payees = DB.payees.map(function (p) {
    return { name: p.name, method: p.method || 'interac', detail: p.detail || '', note: p.note || '' };
  });
  var payload = { version: 1, payees: payees, regulars: clean };
  openModal(
    '<div class="pm-modal-head"><div class="pm-modal-title">⬇ Export Regular Payments</div>' +
    '<button class="pm-modal-close" type="button" onclick="closeModal()">✕</button></div>' +
    '<div class="pm-modal-body">' +
      '<p class="pm-hint" style="margin:0 0 8px">Copy everything below, open the other Payments Manager instance, and use <strong>⬆ Import List</strong> there. Paid history and ids are intentionally left out — each import starts fresh.</p>' +
      '<textarea class="pm-input pm-textarea" id="ex-json" readonly></textarea>' +
    '</div>' +
    '<div class="pm-modal-foot">' +
      '<button class="pm-btn pm-btn-ghost" type="button" onclick="closeModal()">Close</button>' +
      '<button class="pm-btn pm-btn-primary" type="button" onclick="copyExportText()">📋 Select &amp; Copy</button>' +
    '</div>'
  );
  var ta = el('ex-json');
  ta.value = JSON.stringify(payload, null, 2);
  ta.focus();
  ta.select();
}
function copyExportText() {
  var ta = el('ex-json');
  if (!ta) return;
  ta.focus();
  ta.select();
  var ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  notify(ok ? 'Copied — now paste it into the other instance with Import List' : 'Press Ctrl+C now to copy', ok ? 'success' : 'info');
}
function importRegulars() {
  openModal(
    '<div class="pm-modal-head"><div class="pm-modal-title">⬆ Import Regular Payments</div>' +
    '<button class="pm-modal-close" type="button" onclick="closeModal()">✕</button></div>' +
    '<form onsubmit="event.preventDefault();doImportRegulars()">' +
    '<div class="pm-modal-body">' +
      '<p class="pm-hint" style="margin:0 0 8px">Paste the text copied from another instance&rsquo;s <strong>Export List</strong>. New copies of the payments are added here (existing ones stay untouched).</p>' +
      '<textarea class="pm-input pm-textarea" id="im-json" placeholder="Paste the exported JSON here…" required></textarea>' +
    '</div>' +
    '<div class="pm-modal-foot">' +
      '<button class="pm-btn pm-btn-ghost" type="button" onclick="closeModal()">Cancel</button>' +
      '<button class="pm-btn pm-btn-primary" type="submit">Import</button>' +
    '</div>' +
    '</form>'
  );
}
function doImportRegulars() {
  var txt = el('im-json').value.trim();
  var data;
  try { data = JSON.parse(txt); } catch (e) { notify('Invalid text — make sure you pasted the whole export', 'error'); return; }
  var regs = Array.isArray(data) ? data : data.regulars;
  if (!Array.isArray(regs) || !regs.length) { notify('No regular payments found in the pasted text', 'warning'); return; }
  var payees = Array.isArray(data.payees) ? data.payees : [];
  var addedPayees = 0, addedRegs = 0, skipped = 0;
  payees.forEach(function (p) {
    var nm = String(p.name || '').trim();
    if (!nm) return;
    var exists = DB.payees.some(function (x) { return x.name.toLowerCase() === nm.toLowerCase(); });
    if (exists) return;
    DB.payees.push({ id: uid('pye'), name: nm, method: p.method || 'interac', detail: p.detail || '', note: p.note || '' });
    addedPayees++;
  });
  regs.forEach(function (rc) {
    if (!rc.name) { skipped++; return; }
    var cadence = rc.cadence || 'monthly';
    // link org fields by name (type auto-created, dept/source only if they exist)
    var typeId = '', category = rc.category || rc.type || '';
    if (category) {
      var tmatch = null;
      DB.types.forEach(function (t) { if (t.name.toLowerCase() === category.toLowerCase()) tmatch = t; });
      if (tmatch) typeId = tmatch.id;
      else {
        var nt = { id: uid('typ'), name: category, note: '' };
        DB.types.push(nt);
        typeId = nt.id;
      }
    }
    var departmentId = '';
    if (rc.department) {
      DB.departments.forEach(function (d) { if (d.name.toLowerCase() === String(rc.department).toLowerCase()) departmentId = d.id; });
    }
    var sourceId = '';
    if (rc.source) {
      DB.sources.forEach(function (s) { if (s.name.toLowerCase() === String(rc.source).toLowerCase()) sourceId = s.id; });
    }
    var nr = {
      id: uid('reg'),
      name: String(rc.name).trim(),
      category: category,
      typeId: typeId,
      departmentId: departmentId,
      sourceId: sourceId,
      amount: rc.amount !== undefined && rc.amount !== null && rc.amount !== '' ? rc.amount : '',
      currency: rc.currency || defCurrency(),
      cadence: cadence,
      day: rc.day || null,
      anchor: rc.anchor || '',
      payeeId: '',
      who: rc.who || '',
      method: rc.method || '',
      methodDetail: rc.methodDetail || '',
      note: rc.note || '',
      active: rc.active !== false,
      history: [],
      createdBy: currentUserName(),
      createdAt: new Date().toISOString()
    };
    if (cadence !== 'monthly' && !nr.anchor) { skipped++; return; }
    if (cadence === 'monthly' && !nr.anchor) nr.anchor = isoDay(nextMonthlyAnchor(nr.day || 1));
    DB.payees.forEach(function (p) {
      if (nr.who && p.name.toLowerCase() === nr.who.toLowerCase()) nr.payeeId = p.id;
    });
    DB.regulars.push(nr);
    addedRegs++;
  });
  persist();
  closeModal();
  renderAll();
  notify('Imported ' + addedRegs + ' payment' + (addedRegs !== 1 ? 's' : '') +
    (addedPayees ? ' and ' + addedPayees + ' payee' + (addedPayees !== 1 ? 's' : '') : '') +
    (skipped ? ' — ' + skipped + ' skipped (missing info)' : ''), 'success');
}
function duplicateRegular(id) {
  var r = findRegular(id);
  if (!r) return;
  var copy = JSON.parse(JSON.stringify(r));
  copy.id = uid('reg');
  copy.name = (r.name || '') + ' (copy)';
  copy.history = [];
  copy.createdBy = currentUserName();
  copy.createdAt = new Date().toISOString();
  DB.regulars.push(copy);
  persist();
  renderAll();
  notify('Duplicated: ' + r.name, 'success');
}

// ── QuickBooks expense import ────────────────────────────────
var _qb = null;
function parseCsv(text) {
  var rows = [], row = [], cell = '', inQ = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c === '\r') { /* skip */ }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(function (r) { return r.some(function (c) { return c.trim() !== ''; }); });
}
function parseQbDate(s) {
  s = String(s || '').trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]);
  m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
  if (m) {
    var a = +m[1], b = +m[2];
    if (a > 12) return m[3] + '-' + pad2(b) + '-' + pad2(a); // DD/MM/YYYY
    return m[3] + '-' + pad2(a) + '-' + pad2(b);               // MM/DD/YYYY (QB default)
  }
  return s;
}
function parseQbAmount(s) {
  s = String(s || '').replace(/[$€£₺, ]/g, '');
  var neg = /^\(.*\)$/.test(s.trim());
  s = s.replace(/[()]/g, '');
  var v = parseFloat(s);
  if (isNaN(v)) return null;
  return neg ? -v : v;
}
function qbColIndex(headers, keywords) {
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).toLowerCase();
    for (var k = 0; k < keywords.length; k++) {
      if (h.indexOf(keywords[k]) !== -1) return i;
    }
  }
  return -1;
}
function openQbImport() {
  _qb = null;
  openModal(
    '<div class="pm-modal-head"><div class="pm-modal-title">📥 Import QuickBooks Expenses</div>' +
    '<button class="pm-modal-close" type="button" onclick="closeModal()">✕</button></div>' +
    '<div class="pm-modal-body">' +
      '<p class="pm-hint" style="margin:0 0 8px">Paste your QuickBooks expense export (CSV) below — or load a .csv file. Imported rows become paid records; rows whose payee matches a regular payment can automatically check off the unpaid period near that date.</p>' +
      '<div class="pm-toolbar" style="margin:0 0 8px"><button class="pm-btn pm-btn-ghost pm-btn-sm" type="button" onclick="document.getElementById(\'qb-file\').click()">📁 Load .csv file</button><input type="file" id="qb-file" accept=".csv,.txt" style="display:none" onchange="qbLoadFile(this)"></div>' +
      '<textarea class="pm-input pm-textarea" id="qb-csv" placeholder="Date,Type,No.,Payee,Account,Memo,Debit,Credit…"></textarea>' +
      '<div id="qb-map-area"></div>' +
    '</div>' +
    '<div class="pm-modal-foot">' +
      '<button class="pm-btn pm-btn-ghost" type="button" onclick="closeModal()">Cancel</button>' +
      '<button class="pm-btn pm-btn-primary" type="button" onclick="qbPreview()">1️⃣ Map &amp; Preview</button>' +
    '</div>'
  );
}
function qbLoadFile(input) {
  var f = input.files && input.files[0];
  if (!f) return;
  var reader = new FileReader();
  reader.onload = function () {
    var ta = el('qb-csv');
    if (ta) ta.value = String(reader.result || '');
    notify('File loaded — click Map & Preview', 'success');
  };
  reader.readAsText(f);
}
function qbPreview() {
  var text = el('qb-csv').value;
  var rows = parseCsv(text);
  if (rows.length < 2) { notify('Paste a CSV with a header row and at least one data row', 'warning'); return; }
  var headers = rows[0];
  var map = {
    date: qbColIndex(headers, ['date']),
    payee: qbColIndex(headers, ['payee', 'vendor', 'name', 'customer']),
    memo: qbColIndex(headers, ['memo', 'description', 'notes']),
    debit: qbColIndex(headers, ['debit', 'payment', 'amount']),
    credit: qbColIndex(headers, ['credit', 'received'])
  };
  if (map.date === -1 || map.payee === -1 || map.debit === -1) {
    notify('Could not auto-detect columns — make sure the CSV has Date, Payee and Debit/Amount headers', 'error');
    return;
  }
  _qb = { headers: headers, rows: rows.slice(1), map: map, preview: [] };
  var skipped = 0;
  _qb.rows.forEach(function (row, idx) {
    var date = parseQbDate(row[map.date]);
    var payee = String(row[map.payee] || '').trim();
    var memo = map.memo !== -1 ? String(row[map.memo] || '').trim() : '';
    var amount = parseQbAmount(row[map.debit]);
    if (amount === null && map.credit !== -1) amount = parseQbAmount(row[map.credit]);
    if (amount === null || amount === 0 || !payee || !date) { skipped++; return; }
    var matchId = '', matchName = '';
    DB.regulars.forEach(function (r) {
      if (!matchId && r.who && (r.who.toLowerCase().indexOf(payee.toLowerCase()) !== -1 || payee.toLowerCase().indexOf(r.who.toLowerCase()) !== -1)) {
        matchId = r.id; matchName = r.name;
      }
    });
    if (!matchId) {
      DB.payees.forEach(function (p) {
        if (!matchId && p.name && (p.name.toLowerCase().indexOf(payee.toLowerCase()) !== -1 || payee.toLowerCase().indexOf(p.name.toLowerCase()) !== -1)) matchName = p.name;
      });
    }
    _qb.preview.push({ idx: idx, date: date, payee: payee, memo: memo, amount: Math.abs(amount), matchId: matchId, matchName: matchName });
  });
  var matchOpts = function (p) {
    var o = '<option value="">— no match (new request) —</option>';
    DB.regulars.forEach(function (r) {
      o += '<option value="' + esc(r.id) + '"' + (p.matchId === r.id ? ' selected' : '') + '>' + esc(r.name) + '</option>';
    });
    return o;
  };
  var deptOpts = '<option value="">— leave unassigned —</option>' + DB.departments.map(function (d) { return '<option value="' + esc(d.id) + '">' + esc(d.name) + '</option>'; }).join('');
  var typeOpts = '<option value="">— leave unassigned —</option>' + DB.types.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>'; }).join('');
  var srcOpts = '<option value="">— leave unassigned —</option>' + DB.sources.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('');
  var rowsHtml = '';
  _qb.preview.forEach(function (p) {
    rowsHtml += '<div class="pm-qb-row">' +
      '<span class="pm-qb-date">' + esc(p.date) + '</span>' +
      '<span class="pm-qb-payee">' + esc(p.payee) + '</span>' +
      '<span class="pm-qb-memo">' + esc(p.memo) + '</span>' +
      '<span class="pm-qb-amt">' + fmtMoney(p.amount, defCurrency()) + '</span>' +
      '<select class="pm-input pm-select" id="qb-row-match-' + p.idx + '">' + matchOpts(p) + '</select>' +
    '</div>';
  });
  el('qb-map-area').innerHTML =
    '<div class="pm-mv-title" style="margin-top:12px">2️⃣ Review ' + _qb.preview.length + ' row' + (_qb.preview.length !== 1 ? 's' : '') + (skipped ? ' (' + skipped + ' skipped — missing date/payee/amount)' : '') + '</div>' +
    '<div class="pm-qb-rows">' + rowsHtml + '</div>' +
    '<div class="pm-form-grid" style="margin-top:12px">' +
      '<div class="pm-fld"><label class="pm-label">Assign department to all</label><select class="pm-input" id="qb-dept">' + deptOpts + '</select></div>' +
      '<div class="pm-fld"><label class="pm-label">Assign type to all</label><select class="pm-input" id="qb-type">' + typeOpts + '</select></div>' +
      '<div class="pm-fld"><label class="pm-label">Assign source to all</label><select class="pm-input" id="qb-src">' + srcOpts + '</select></div>' +
    '</div>' +
    '<div class="pm-fld pm-fld-full" style="margin-top:10px"><label class="pm-check"><input type="checkbox" id="qb-autocheck" checked> Auto-check off matching regular payments (mark the unpaid period near each expense date as paid)</label></div>' +
    '<div class="pm-modal-foot" style="margin-top:12px;border-radius:10px">' +
      '<button class="pm-btn pm-btn-ghost" type="button" onclick="closeModal()">Cancel</button>' +
      '<button class="pm-btn pm-btn-primary" type="button" onclick="qbDoImport()">Import ' + _qb.preview.length + ' expense' + (_qb.preview.length !== 1 ? 's' : '') + '</button>' +
    '</div>';
  scheduleResize();
}
function qbDoImport() {
  if (!_qb || !_qb.preview.length) return;
  var deptId = el('qb-dept').value, typeId = el('qb-type').value, srcId = el('qb-src').value;
  var autoCheck = el('qb-autocheck') ? el('qb-autocheck').checked : true;
  var marked = 0, created = 0, skipped = 0;
  _qb.preview.forEach(function (p) {
    var matchSel = el('qb-row-match-' + p.idx);
    var matchId = matchSel ? matchSel.value : p.matchId;
    var dept = deptId, type = typeId, source = srcId;
    if (matchId) {
      var r = findRegular(matchId);
      if (r) {
        if (!dept) dept = r.departmentId || '';
        if (!type) type = r.typeId || '';
        if (!source) source = r.sourceId || '';
        var dues = unpaidDues(r);
        var best = null, bestDist = 9999;
        var d0 = parseISO(p.date);
        if (d0 && autoCheck) {
          dues.forEach(function (due) {
            var dist = Math.abs(due - d0) / 86400000;
            if (dist <= 14 && dist < bestDist) { bestDist = dist; best = due; }
          });
        }
        if (best) {
          r.history = r.history || [];
          r.history = r.history.filter(function (h) { return h.dueDate !== isoDay(best); });
          r.history.push({
            dueDate: isoDay(best), amount: p.amount, paidAt: p.date,
            paidBy: 'QuickBooks', note: p.memo, method: r.method || '',
            departmentId: dept, typeId: type, sourceId: source
          });
          r.history.sort(function (a, b) { return String(b.dueDate).localeCompare(String(a.dueDate)); });
          marked++;
          return;
        }
      }
    }
    DB.requests.push({
      id: uid('req'), title: p.payee + (p.memo ? ' — ' + p.memo.slice(0, 60) : ''),
      amount: p.amount, currency: defCurrency(), category: typeId && findType(typeId) ? findType(typeId).name : '',
      typeId: type, departmentId: dept, sourceId: source,
      dueDate: p.date, payeeId: '', who: p.payee, method: '', methodDetail: '',
      note: 'Imported from QuickBooks' + (p.memo ? ': ' + p.memo : ''),
      status: 'paid',
      requestedBy: 'QuickBooks import', requestedById: 'qb', requestedByEmail: '',
      requestedAt: new Date().toISOString(),
      approvedBy: currentUserName(), approvedAt: new Date().toISOString(),
      paidAt: p.date, paidBy: 'QuickBooks', paidAmount: p.amount
    });
    created++;
  });
  skipped = _qb.preview.length - marked - created;
  _qb = null;
  persist();
  closeModal();
  renderAll();
  notify('QuickBooks import done — ' + marked + ' regular payment' + (marked !== 1 ? 's' : '') + ' checked off, ' +
    created + ' new record' + (created !== 1 ? 's' : '') + ' created' +
    (skipped ? ', ' + skipped + ' skipped' : ''), 'success');
}

// ── Stats & badges ──────────────────────────────────────────
function renderStats() {
  var box = el('pm-stats');
  if (!box) return;
  var items = dueItems();
  var today = startOfDay(new Date());
  var ms = monthStart(today), me = monthEnd(today);
  var overdue = [], month = [], upcoming = [];
  items.forEach(function (it) {
    var b = dueBucket(it);
    if (b === 'overdue') overdue.push(it);
    else if (b === 'month') month.push(it);
    else upcoming.push(it);
  });
  var paidRows = historyItems().filter(function (h) {
    var d = parseISO(h.paidAt);
    return d && d >= ms && d <= me;
  });
  var pending = visiblePendingRequests();
  var activeRegs = DB.regulars.filter(function (r) { return r.active; }).length;
  // Money owed right now = overdue + due this month + approved requests without a date.
  var owed = items.filter(function (it) {
    var b = dueBucket(it);
    return b === 'overdue' || b === 'month' || (it.kind === 'request' && !it.due);
  });
  box.innerHTML =
    statChip('📅', 'Due this month', fmtSumMap(sumByCurrency(month)), month.length + ' payment' + (month.length !== 1 ? 's' : ''), 'pm-stat--due') +
    statChip('⏰', 'Overdue', fmtSumMap(sumByCurrency(overdue)), overdue.length + ' unpaid', 'pm-stat--overdue') +
    statChip('💰', 'Owed now', fmtSumMap(sumByCurrency(owed)), owed.length + ' total', 'pm-stat--owed') +
    statChip('✅', 'Paid this month', fmtSumMap(sumByCurrency(paidRows)), paidRows.length + ' paid', 'pm-stat--paid') +
    statChip('📩', 'Awaiting approval', fmtSumMap(sumByCurrency(pending)), pending.length + ' request' + (pending.length !== 1 ? 's' : ''), 'pm-stat--pending') +
    statChip('🔁', 'Active regulars', activeRegs, 'schedules running', '');
  scheduleResize();
}
function updateBadges() {
  var bd = el('badge-due'), br = el('badge-regular'), bq = el('badge-requests');
  var actionable = dueItems().filter(function (it) {
    var b = dueBucket(it);
    return b === 'overdue' || b === 'month';
  }).length;
  if (bd) { bd.textContent = actionable; bd.style.display = actionable ? '' : 'none'; }
  if (br) { br.textContent = DB.regulars.filter(function (r) { return r.active; }).length; br.style.display = DB.regulars.length ? '' : 'none'; }
  if (bq) {
    var pendCount = visiblePendingRequests().length;
    bq.textContent = pendCount;
    bq.style.display = pendCount ? '' : 'none';
  }
}

// ── Dashboard ────────────────────────────────────────────────
function dashEmpty(msg) { return '<div class="pm-dash-empty">' + msg + '</div>'; }
function renderDashboard() {
  var dueBox = el('dash-due');
  if (dueBox) {
    var items = dueItems().filter(function (it) {
      var b = dueBucket(it);
      return b === 'overdue' || b === 'month' || (it.kind === 'request' && !it.due);
    });
    if (!items.length) dueBox.innerHTML = dashEmpty('✅ All caught up — nothing due right now.');
    else {
      var html = '';
      items.slice(0, 5).forEach(function (it) {
        var b = dueBucket(it);
        html += '<div class="pm-dash-row">' +
          '<span class="pm-dash-icon">' + (it.kind === 'regular' ? '🔁' : '📩') + '</span>' +
          '<span class="pm-dash-name" title="' + esc(it.name) + '">' + esc(it.name) + '</span>' +
          '<span class="pm-dash-date' + (b === 'overdue' ? ' pm-dash-overdue' : '') + '">' + (it.due ? esc(fmtDate(it.due)) : 'Anytime') + '</span>' +
          '<span class="pm-dash-amt">' + fmtMoney(it.amount, it.currency) + '</span>' +
        '</div>';
      });
      if (items.length > 5) html += '<div class="pm-dash-more">+' + (items.length - 5) + ' more in Due &amp; Check-off</div>';
      dueBox.innerHTML = html;
    }
  }
  var dBox = el('dash-depts');
  if (dBox) {
    if (!DB.departments.length) dBox.innerHTML = dashEmpty('No departments yet — add them in Departments &amp; Budgets.');
    else {
      var html = '';
      DB.departments.slice(0, 6).forEach(function (d) {
        var st = deptStats(d);
        var pct = st.budget > 0 ? Math.min(100, st.used / st.budget * 100) : 0;
        html += '<div class="pm-dash-row">' +
          '<span class="pm-dash-name" title="' + esc(d.name) + '">' + esc(d.name) + '</span>' +
          '<span class="pm-dash-amt">' + fmtMoney(st.used, st.currency) + ' / ' + fmtMoney(st.budget, st.currency) + '</span>' +
        '</div>' +
        '<div class="pm-progress" style="margin:-2px 0 6px"><i style="width:' + Math.min(100, Math.max(0, pct)) + '%"></i></div>';
      });
      dBox.innerHTML = html;
    }
  }
  var pBox = el('dash-pending');
  if (pBox) {
    var pend = visiblePendingRequests();
    if (!pend.length) pBox.innerHTML = dashEmpty('No requests waiting for approval.');
    else {
      var html = '';
      pend.slice(0, 5).forEach(function (q) {
        html += '<div class="pm-dash-row">' +
          '<span class="pm-dash-icon">📩</span>' +
          '<span class="pm-dash-name" title="' + esc(q.title) + '">' + esc(q.title) + '</span>' +
          '<span class="pm-dash-date">' + esc(q.requestedBy || '') + '</span>' +
          '<span class="pm-dash-amt">' + fmtMoney(q.amount, q.currency) + '</span>' +
        '</div>';
      });
      if (pend.length > 5) html += '<div class="pm-dash-more">+' + (pend.length - 5) + ' more…</div>';
      pBox.innerHTML = html;
    }
  }
  var paidBox = el('dash-paid');
  if (paidBox) {
    var paid = historyItems().slice(0, 5);
    if (!paid.length) paidBox.innerHTML = dashEmpty('Nothing paid yet — check off the first payment in Due &amp; Check-off.');
    else {
      var html = '';
      paid.forEach(function (h) {
        html += '<div class="pm-dash-row">' +
          '<span class="pm-dash-icon">✅</span>' +
          '<span class="pm-dash-name" title="' + esc(h.name) + '">' + esc(h.name) + '</span>' +
          '<span class="pm-dash-date">' + esc(fmtDate(parseISO(h.paidAt))) + '</span>' +
          '<span class="pm-dash-amt">' + fmtMoney(h.amount, h.currency) + '</span>' +
        '</div>';
      });
      paidBox.innerHTML = html;
    }
  }
}

// ── Empty state helper ──────────────────────────────────────
function emptyState(icon, title, sub) {
  return '<div class="pm-empty"><div class="pm-empty-ic">' + icon + '</div>' +
    '<div class="pm-empty-title">' + esc(title) + '</div>' +
    '<div class="pm-empty-sub">' + esc(sub) + '</div></div>';
}
function statChip(icon, label, big, sub, cls) {
  return '<div class="pm-stat ' + (cls || '') + '">' +
    '<div class="pm-stat-top"><span class="pm-stat-icon">' + icon + '</span><span class="pm-stat-label">' + label + '</span></div>' +
    '<div class="pm-stat-value' + (cls ? ' money' : '') + '">' + big + '</div>' +
    (sub ? '<div class="pm-stat-sub">' + sub + '</div>' : '') +
  '</div>';
}

// ── Tabs ────────────────────────────────────────────────────
function switchTab(name) {
  var btns = document.querySelectorAll('.pm-tab-btn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].getAttribute('data-tab') === name);
  var panes = document.querySelectorAll('.pm-tabpane');
  for (var j = 0; j < panes.length; j++) panes[j].classList.toggle('active', panes[j].id === 'pane-' + name);
  renderAll();
}

// ── Modal system ────────────────────────────────────────────
function openModal(html) {
  el('pm-modal').innerHTML = html;
  el('pm-backdrop').style.display = 'flex';
  scheduleResize();
}
function closeModal() {
  el('pm-backdrop').style.display = 'none';
  el('pm-modal').innerHTML = '';
  scheduleResize();
}
function confirmDlg(title, msg, okLabel, okClass, cb) {
  openModal(
    '<div class="pm-modal-head"><div class="pm-modal-title">' + esc(title) + '</div>' +
    '<button class="pm-modal-close" type="button" onclick="closeModal()">✕</button></div>' +
    '<div class="pm-modal-body"><p class="pm-confirm-text">' + msg + '</p></div>' +
    '<div class="pm-modal-foot">' +
    '<button class="pm-btn pm-btn-ghost" type="button" onclick="closeModal()">Cancel</button>' +
    '<button class="pm-btn ' + (okClass === 'danger' ? 'pm-btn-danger' : 'pm-btn-primary') + '" type="button" id="pm-confirm-ok">' + esc(okLabel) + '</button>' +
    '</div>'
  );
  el('pm-confirm-ok').addEventListener('click', function () { closeModal(); cb(); });
}

// ── Shared form building blocks ─────────────────────────────
function methodOptions(selected) {
  return METHODS.map(function (m) {
    return '<option value="' + m.id + '"' + (m.id === selected ? ' selected' : '') + '>' + esc(m.label) + '</option>';
  }).join('');
}
function currencyOptions(selected) {
  var cur = selected || defCurrency();
  var list = CURRENCIES.slice();
  if (list.indexOf(cur) === -1) list.unshift(cur);
  return list.map(function (c) {
    return '<option value="' + esc(c) + '"' + (c === cur ? ' selected' : '') + '>' + esc(c) + '</option>';
  }).join('');
}
function payeeOptions(selectedId) {
  var opts = '<option value="">— Choose payee… —</option>';
  DB.payees.forEach(function (p) {
    opts += '<option value="' + esc(p.id) + '"' + (p.id === selectedId ? ' selected' : '') + '>' + esc(p.name) + '</option>';
  });
  opts += '<option value="__new"' + (selectedId === '__new' ? ' selected' : '') + '>＋ New payee…</option>';
  return opts;
}
function deptOptions(selectedId) {
  var opts = '<option value="">— None —</option>';
  DB.departments.forEach(function (d) {
    opts += '<option value="' + esc(d.id) + '"' + (d.id === selectedId ? ' selected' : '') + '>' + esc(d.name) + '</option>';
  });
  return opts;
}
function typeOptions(selectedId) {
  var opts = '<option value="">— None —</option>';
  DB.types.forEach(function (t) {
    opts += '<option value="' + esc(t.id) + '"' + (t.id === selectedId ? ' selected' : '') + '>' + esc(t.name) + '</option>';
  });
  opts += '<option value="__new"' + (selectedId === '__new' ? ' selected' : '') + '>＋ New type…</option>';
  return opts;
}
function sourceOptions(selectedId) {
  var opts = '<option value="">— None —</option>';
  DB.sources.forEach(function (s) {
    opts += '<option value="' + esc(s.id) + '"' + (s.id === selectedId ? ' selected' : '') + '>' + esc(s.name) + '</option>';
  });
  opts += '<option value="__new"' + (selectedId === '__new' ? ' selected' : '') + '>＋ New source…</option>';
  return opts;
}
function orgSelectChanged(prefix, which) {
  var box = el(prefix + '-new' + which);
  var sel = el(prefix + '-' + which);
  if (!sel || !box) return;
  box.style.display = sel.value === '__new' ? 'grid' : 'none';
  scheduleResize();
}
// Reads department/type/source selects + optional inline new-type/new-source blocks.
function resolveOrgFields(prefix) {
  var departmentId = el(prefix + '-department').value;
  var typeSel = el(prefix + '-type');
  var sourceSel = el(prefix + '-source');
  var typeId = typeSel.value && typeSel.value !== '__new' ? typeSel.value : '';
  var sourceId = sourceSel.value && sourceSel.value !== '__new' ? sourceSel.value : '';
  var category = typeId ? (findType(typeId) ? findType(typeId).name : '') : '';
  if (typeSel.value === '__new') {
    var tn = el(prefix + '-nt-name') ? el(prefix + '-nt-name').value.trim() : '';
    if (tn) {
      var t = { id: uid('typ'), name: tn, note: '' };
      DB.types.push(t);
      typeId = t.id;
      category = tn;
    }
  }
  if (sourceSel.value === '__new') {
    var sn = el(prefix + '-ns-name') ? el(prefix + '-ns-name').value.trim() : '';
    if (sn) {
      var s = { id: uid('src'), name: sn, note: '' };
      DB.sources.push(s);
      sourceId = s.id;
    }
  }
  return { departmentId: departmentId, typeId: typeId, category: category, sourceId: sourceId };
}
function methodChanged(sel, detailId) {
  var m = methodById(sel.value);
  var d = el(detailId);
  if (d && m) d.placeholder = m.hint;
}
function payeeSelectChanged(prefix, sel) {
  var box = el(prefix + '-newpayee');
  if (sel.value === '__new') {
    if (box) box.style.display = 'grid';
  } else {
    if (box) box.style.display = 'none';
    var p = findPayee(sel.value);
    if (p) {
      var who = el(prefix + '-who'); if (who) who.value = p.name;
      var me = el(prefix + '-method'); if (me) { me.value = p.method; methodChanged(me, prefix + '-detail'); }
      var det = el(prefix + '-detail'); if (det) det.value = p.detail || '';
    }
  }
  scheduleResize();
}
// Reads the who/method/detail fields + optional inline new-payee block.
// Returns { payeeId, who, method, methodDetail, createdPayee }
function resolvePayeeFields(prefix) {
  var sel = el(prefix + '-payee');
  var who = el(prefix + '-who').value.trim();
  var method = el(prefix + '-method').value;
  var detail = el(prefix + '-detail').value.trim();
  var payeeId = sel.value && sel.value !== '__new' ? sel.value : '';
  var createdPayee = null;
  if (sel.value === '__new') {
    var npName = el(prefix + '-np-name') ? el(prefix + '-np-name').value.trim() : '';
    var npMethod = el(prefix + '-np-method') ? el(prefix + '-np-method').value : 'interac';
    var npDetail = el(prefix + '-np-detail') ? el(prefix + '-np-detail').value.trim() : '';
    var payeeName = npName || who;
    if (payeeName) {
      createdPayee = { id: uid('pye'), name: payeeName, method: npMethod, detail: npDetail, note: '' };
      DB.payees.push(createdPayee);
      payeeId = createdPayee.id;
      who = payeeName;
      method = npMethod;
      detail = npDetail;
    }
  }
  return { payeeId: payeeId, who: who, method: method, methodDetail: detail, createdPayee: createdPayee };
}

// ── Regular payment form ────────────────────────────────────
function cadenceChanged() {
  var c = el('rf-cadence').value;
  var dayWrap = el('rf-day-wrap'), anchorWrap = el('rf-anchor-wrap');
  if (dayWrap) dayWrap.style.display = c === 'monthly' ? 'flex' : 'none';
  if (anchorWrap) anchorWrap.style.display = c === 'monthly' ? 'none' : 'flex';
  var anchorLabel = el('rf-anchor-label');
  if (anchorLabel) anchorLabel.textContent = (c === 'yearly') ? 'First due date (month & day)' : 'First payment date';
  scheduleResize();
}
function _openRegularForm(id) {
  var r = id ? findRegular(id) : null;
  var todayIso = isoDay(new Date());
  var method = r ? r.method : 'interac';
  var html =
    '<div class="pm-modal-head"><div class="pm-modal-title">' + (r ? '✏️ Edit Regular Payment' : '🔁 New Regular Payment') + '</div>' +
    '<button class="pm-modal-close" type="button" onclick="closeModal()">✕</button></div>' +
    '<form onsubmit="event.preventDefault();saveRegularForm()">' +
    '<div class="pm-modal-body">' +
      '<div class="pm-form-grid">' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="rf-name">Payment name <span class="pm-req">*</span></label>' +
        '<input class="pm-input" id="rf-name" placeholder="e.g. Office Rent" value="' + esc(r ? r.name : '') + '" required></div>' +
        '<div class="pm-fld"><label class="pm-label" for="rf-department">Department</label>' +
        '<select class="pm-input" id="rf-department">' + deptOptions(r ? r.departmentId : '') + '</select><div class="pm-hint">Counts against that department\'s budget</div></div>' +
        '<div class="pm-fld"><label class="pm-label" for="rf-amount">Amount</label>' +
        '<input class="pm-input" id="rf-amount" type="number" min="0" step="0.01" placeholder="e.g. 1200" value="' + esc(r ? r.amount : '') + '"><div class="pm-hint">Leave empty if it changes every time</div></div>' +
        '<div class="pm-fld"><label class="pm-label" for="rf-currency">Currency</label>' +
        '<select class="pm-input" id="rf-currency">' + currencyOptions(r ? r.currency : defCurrency()) + '</select></div>' +
        '<div class="pm-fld"><label class="pm-label" for="rf-type">Payment type</label>' +
        '<select class="pm-input" id="rf-type" onchange="orgSelectChanged(\'rf\', \'type\')">' + typeOptions(r ? r.typeId : '') + '</select><div class="pm-hint">Salary, rent, event cost…</div></div>' +
        '<div class="pm-newpayee-box" id="rf-newtype" style="display:none">' +
          '<div class="pm-fld pm-fld-full"><label class="pm-label">New payment type name</label><input class="pm-input" id="rf-nt-name" placeholder="e.g. Event Cost"></div>' +
        '</div>' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="rf-source">Money source</label>' +
        '<select class="pm-input" id="rf-source" onchange="orgSelectChanged(\'rf\', \'source\')">' + sourceOptions(r ? r.sourceId : '') + '</select><div class="pm-hint">Which grant / bank account / cash this is paid from</div></div>' +
        '<div class="pm-newpayee-box" id="rf-newsource" style="display:none">' +
          '<div class="pm-fld pm-fld-full"><label class="pm-label">New money source name</label><input class="pm-input" id="rf-ns-name" placeholder="e.g. Community Grant 2026"></div>' +
        '</div>' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="rf-payee">Payee (who gets paid)</label>' +
        '<select class="pm-input" id="rf-payee" onchange="payeeSelectChanged(\'rf\', this)">' + payeeOptions(r ? r.payeeId : '') + '</select></div>' +
        '<div class="pm-fld"><label class="pm-label" for="rf-who">Who <span class="pm-req">*</span></label>' +
        '<input class="pm-input" id="rf-who" placeholder="Name / company" value="' + esc(r ? r.who : '') + '" required></div>' +
        '<div class="pm-fld"><label class="pm-label" for="rf-method">Payment method</label>' +
        '<select class="pm-input" id="rf-method" onchange="methodChanged(this, \'rf-detail\')">' + methodOptions(method) + '</select></div>' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="rf-detail">Method details</label>' +
        '<input class="pm-input" id="rf-detail" placeholder="' + esc((methodById(method) || {}).hint || '') + '" value="' + esc(r ? r.methodDetail : '') + '"><div class="pm-hint">e.g. email for Interac, account number for bank transfer</div></div>' +
        '<div class="pm-newpayee-box" id="rf-newpayee" style="display:none">' +
          '<div class="pm-fld"><label class="pm-label">New payee name</label><input class="pm-input" id="rf-np-name" placeholder="Name / company"></div>' +
          '<div class="pm-fld"><label class="pm-label">Method</label><select class="pm-input" id="rf-np-method">' + methodOptions('interac') + '</select></div>' +
          '<div class="pm-fld"><label class="pm-label">Details</label><input class="pm-input" id="rf-np-detail" placeholder="Email, account…"></div>' +
        '</div>' +
        '<div class="pm-fld"><label class="pm-label" for="rf-cadence">How often</label>' +
        '<select class="pm-input" id="rf-cadence" onchange="cadenceChanged()">' +
          CADENCES.map(function (c) {
            return '<option value="' + c.id + '"' + ((r ? r.cadence : 'monthly') === c.id ? ' selected' : '') + '>' + esc(c.label) + ' — ' + esc(c.every) + '</option>';
          }).join('') +
        '</select></div>' +
        '<div class="pm-fld" id="rf-day-wrap"><label class="pm-label" for="rf-day">Day of month</label>' +
        '<input class="pm-input" id="rf-day" type="number" min="1" max="31" value="' + (r ? String((parseISO(r.anchor) || new Date()).getDate()) : String(Math.min(28, new Date().getDate()))) + '"></div>' +
        '<div class="pm-fld" id="rf-anchor-wrap" style="display:none"><label class="pm-label" id="rf-anchor-label" for="rf-anchor">First payment date</label>' +
        '<input class="pm-input" id="rf-anchor" type="date" value="' + (r && r.anchor ? esc(r.anchor) : todayIso) + '"></div>' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="rf-note">Note</label>' +
        '<input class="pm-input" id="rf-note" placeholder="Anything the accountant should know" value="' + esc(r ? r.note : '') + '"></div>' +
      '</div>' +
    '</div>' +
    '<div class="pm-modal-foot">' +
      '<button class="pm-btn pm-btn-ghost" type="button" onclick="closeModal()">Cancel</button>' +
      '<button class="pm-btn pm-btn-primary" type="submit">' + (r ? 'Save Changes' : 'Add Payment') + '</button>' +
    '</div>' +
    '</form>';
  openModal(html);
  cadenceChanged();
}
function saveRegularForm() {
  var id = _editRegularId || '';
  var r = id ? findRegular(id) : null;
  var name = el('rf-name').value.trim();
  if (!name) { notify('Please enter a payment name', 'warning'); return; }
  var who = el('rf-who').value.trim();
  if (!who) { notify('Please enter who gets paid', 'warning'); return; }
  var cadence = el('rf-cadence').value;
  var anchor = null, day = null;
  if (cadence === 'monthly') {
    day = Math.min(31, Math.max(1, parseInt(el('rf-day').value, 10) || 1));
    anchor = isoDay(nextMonthlyAnchor(day));
  } else {
    var av = el('rf-anchor').value;
    if (!av) { notify('Please choose the first payment date', 'warning'); return; }
    anchor = av;
    day = parseISO(av).getDate();
  }
  var pay = resolvePayeeFields('rf');
  var org = resolveOrgFields('rf');
  var amountStr = el('rf-amount').value.trim();
  var amount = amountStr === '' ? '' : Math.max(0, parseFloat(amountStr) || 0);
  var data = {
    name: name,
    category: org.category,
    typeId: org.typeId,
    departmentId: org.departmentId,
    sourceId: org.sourceId,
    amount: amount,
    currency: el('rf-currency').value,
    payeeId: pay.payeeId,
    who: pay.who,
    method: pay.method,
    methodDetail: pay.methodDetail,
    cadence: cadence,
    day: day,
    anchor: anchor,
    note: el('rf-note').value.trim()
  };
  if (r) {
    Object.keys(data).forEach(function (k) { r[k] = data[k]; });
    notify('Payment updated: ' + r.name, 'success');
  } else {
    data.id = uid('reg');
    data.active = true;
    data.history = [];
    data.createdBy = currentUserName();
    data.createdAt = new Date().toISOString();
    DB.regulars.push(data);
    notify('Regular payment added: ' + data.name, 'success');
  }
  persist();
  closeModal();
  renderAll();
}

// ── Request form ────────────────────────────────────────────
function _openRequestForm(id) {
  var r = id ? findRequest(id) : null;
  var html =
    '<div class="pm-modal-head"><div class="pm-modal-title">' + (r ? '✏️ Edit Request' : '📩 New Payment Request') + '</div>' +
    '<button class="pm-modal-close" type="button" onclick="closeModal()">✕</button></div>' +
    '<form onsubmit="event.preventDefault();saveRequestForm()">' +
    '<div class="pm-modal-body">' +
      (r ? '' : '<p class="pm-modal-note">Submit a one-off payment — supplier invoice, reimbursement, anything non-regular. The admin approves it, the accountant pays & checks it off.</p>') +
      '<div class="pm-form-grid">' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="rq-title">What is this for? <span class="pm-req">*</span></label>' +
        '<input class="pm-input" id="rq-title" placeholder="e.g. Reimburse John — client lunch" value="' + esc(r ? r.title : '') + '" required></div>' +
        '<div class="pm-fld"><label class="pm-label" for="rq-amount">Amount <span class="pm-req">*</span></label>' +
        '<input class="pm-input" id="rq-amount" type="number" min="0" step="0.01" placeholder="e.g. 86.40" value="' + esc(r ? r.amount : '') + '" required></div>' +
        '<div class="pm-fld"><label class="pm-label" for="rq-currency">Currency</label>' +
        '<select class="pm-input" id="rq-currency">' + currencyOptions(r ? r.currency : defCurrency()) + '</select></div>' +
        '<div class="pm-fld"><label class="pm-label" for="rq-department">Department</label>' +
        '<select class="pm-input" id="rq-department">' + deptOptions(r ? r.departmentId : '') + '</select><div class="pm-hint">Counts against that department\'s budget</div></div>' +
        '<div class="pm-fld"><label class="pm-label" for="rq-due">Due date</label>' +
        '<input class="pm-input" id="rq-due" type="date" value="' + esc(r ? (r.dueDate || '') : '') + '"><div class="pm-hint">Optional</div></div>' +
        '<div class="pm-fld"><label class="pm-label" for="rq-type">Payment type</label>' +
        '<select class="pm-input" id="rq-type" onchange="orgSelectChanged(\'rq\', \'type\')">' + typeOptions(r ? r.typeId : '') + '</select></div>' +
        '<div class="pm-fld"><label class="pm-label" for="rq-source">Money source</label>' +
        '<select class="pm-input" id="rq-source" onchange="orgSelectChanged(\'rq\', \'source\')">' + sourceOptions(r ? r.sourceId : '') + '</select></div>' +
        '<div class="pm-newpayee-box" id="rq-newtype" style="display:none">' +
          '<div class="pm-fld pm-fld-full"><label class="pm-label">New payment type name</label><input class="pm-input" id="rq-nt-name" placeholder="e.g. Event Cost"></div>' +
        '</div>' +
        '<div class="pm-newpayee-box" id="rq-newsource" style="display:none">' +
          '<div class="pm-fld pm-fld-full"><label class="pm-label">New money source name</label><input class="pm-input" id="rq-ns-name" placeholder="e.g. Community Grant 2026"></div>' +
        '</div>' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="rq-payee">Payee (who gets paid)</label>' +
        '<select class="pm-input" id="rq-payee" onchange="payeeSelectChanged(\'rq\', this)">' + payeeOptions(r ? r.payeeId : '') + '</select></div>' +
        '<div class="pm-fld"><label class="pm-label" for="rq-who">Who <span class="pm-req">*</span></label>' +
        '<input class="pm-input" id="rq-who" placeholder="Name / company" value="' + esc(r ? r.who : '') + '" required></div>' +
        '<div class="pm-fld"><label class="pm-label" for="rq-method">Payment method</label>' +
        '<select class="pm-input" id="rq-method" onchange="methodChanged(this, \'rq-detail\')">' + methodOptions(r ? r.method : 'interac') + '</select></div>' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="rq-detail">Method details</label>' +
        '<input class="pm-input" id="rq-detail" placeholder="Email for Interac, account number…" value="' + esc(r ? r.methodDetail : '') + '"></div>' +
        '<div class="pm-newpayee-box" id="rq-newpayee" style="display:none">' +
          '<div class="pm-fld"><label class="pm-label">New payee name</label><input class="pm-input" id="rq-np-name" placeholder="Name / company"></div>' +
          '<div class="pm-fld"><label class="pm-label">Method</label><select class="pm-input" id="rq-np-method">' + methodOptions('interac') + '</select></div>' +
          '<div class="pm-fld"><label class="pm-label">Details</label><input class="pm-input" id="rq-np-detail" placeholder="Email, account…"></div>' +
        '</div>' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="rq-note">Note</label>' +
        '<input class="pm-input" id="rq-note" placeholder="Context, invoice number, link…" value="' + esc(r ? r.note : '') + '"></div>' +
      '</div>' +
    '</div>' +
    '<div class="pm-modal-foot">' +
      '<button class="pm-btn pm-btn-ghost" type="button" onclick="closeModal()">Cancel</button>' +
      '<button class="pm-btn pm-btn-primary" type="submit">' + (r ? 'Save Changes' : 'Submit Request') + '</button>' +
    '</div>' +
    '</form>';
  openModal(html);
  if (r) { var m = el('rq-method'); if (m) methodChanged(m, 'rq-detail'); }
}
function saveRequestForm() {
  var id = _editRequestId || '';
  var r = id ? findRequest(id) : null;
  var title = el('rq-title').value.trim();
  if (!title) { notify('Please enter what this request is for', 'warning'); return; }
  var amount = parseFloat(el('rq-amount').value);
  if (isNaN(amount) || amount <= 0) { notify('Please enter a valid amount', 'warning'); return; }
  var who = el('rq-who').value.trim();
  if (!who) { notify('Please enter who gets paid', 'warning'); return; }
  var pay = resolvePayeeFields('rq');
  var org = resolveOrgFields('rq');
  var data = {
    title: title,
    amount: amount,
    currency: el('rq-currency').value,
    category: org.category,
    typeId: org.typeId,
    departmentId: org.departmentId,
    sourceId: org.sourceId,
    dueDate: el('rq-due').value || '',
    payeeId: pay.payeeId,
    who: pay.who,
    method: pay.method,
    methodDetail: pay.methodDetail,
    note: el('rq-note').value.trim()
  };
  if (r) {
    Object.keys(data).forEach(function (k) { r[k] = data[k]; });
    notify('Request updated: ' + r.title, 'success');
  } else {
    data.id = uid('req');
    data.status = 'pending';
    data.requestedBy = currentUserName();
    data.requestedById = currentUserId();
    data.requestedByEmail = currentUserEmail();
    data.requestedAt = new Date().toISOString();
    DB.requests.push(data);
    notify('Request submitted — waiting for approval', 'success');
  }
  persist();
  closeModal();
  renderAll();
}

// ── Payee form ──────────────────────────────────────────────
function _openPayeeForm(id) {
  var p = id ? findPayee(id) : null;
  var html =
    '<div class="pm-modal-head"><div class="pm-modal-title">' + (p ? '✏️ Edit Payee' : '👥 New Payee') + '</div>' +
    '<button class="pm-modal-close" type="button" onclick="closeModal()">✕</button></div>' +
    '<form onsubmit="event.preventDefault();savePayeeForm()">' +
    '<div class="pm-modal-body">' +
      '<div class="pm-form-grid">' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="pe-name">Name / company <span class="pm-req">*</span></label>' +
        '<input class="pm-input" id="pe-name" placeholder="e.g. Landlord, Hydro One, Payroll provider" value="' + esc(p ? p.name : '') + '" required></div>' +
        '<div class="pm-fld"><label class="pm-label" for="pe-method">Usual payment method</label>' +
        '<select class="pm-input" id="pe-method" onchange="methodChanged(this, \'pe-detail\')">' + methodOptions(p ? p.method : 'interac') + '</select></div>' +
        '<div class="pm-fld"><label class="pm-label" for="pe-detail">Method details</label>' +
        '<input class="pm-input" id="pe-detail" placeholder="Email for Interac, account number…" value="' + esc(p ? p.detail : '') + '"></div>' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="pe-note">Note</label>' +
        '<input class="pm-input" id="pe-note" placeholder="Optional" value="' + esc(p ? p.note : '') + '"></div>' +
      '</div>' +
    '</div>' +
    '<div class="pm-modal-foot">' +
      '<button class="pm-btn pm-btn-ghost" type="button" onclick="closeModal()">Cancel</button>' +
      '<button class="pm-btn pm-btn-primary" type="submit">' + (p ? 'Save Changes' : 'Add Payee') + '</button>' +
    '</div>' +
    '</form>';
  openModal(html);
  var m = el('pe-method'); if (m) methodChanged(m, 'pe-detail');
}
function savePayeeForm() {
  var id = _editPayeeId || '';
  var p = id ? findPayee(id) : null;
  var name = el('pe-name').value.trim();
  if (!name) { notify('Please enter a name', 'warning'); return; }
  var data = {
    name: name,
    method: el('pe-method').value,
    detail: el('pe-detail').value.trim(),
    note: el('pe-note').value.trim()
  };
  if (p) {
    Object.keys(data).forEach(function (k) { p[k] = data[k]; });
    notify('Payee updated: ' + p.name, 'success');
  } else {
    data.id = uid('pye');
    DB.payees.push(data);
    notify('Payee added: ' + data.name, 'success');
  }
  persist();
  closeModal();
  renderAll();
}

// ── Mark paid modal ─────────────────────────────────────────
function openPayModal(kind, id, dueIso) {
  var name, amount, currency, who, method, detail;
  if (kind === 'regular') {
    var r = findRegular(id);
    if (!r) return;
    name = r.name;
    amount = r.amount;
    currency = r.currency || defCurrency();
    who = r.who; method = r.method; detail = r.methodDetail;
  } else {
    var q = findRequest(id);
    if (!q) return;
    name = q.title;
    amount = q.amount;
    currency = q.currency || defCurrency();
    who = q.who; method = q.method; detail = q.methodDetail;
  }
  var todayIso = isoDay(new Date());
  openModal(
    '<div class="pm-modal-head"><div class="pm-modal-title">✓ Mark as Paid</div>' +
    '<button class="pm-modal-close" type="button" onclick="closeModal()">✕</button></div>' +
    '<form onsubmit="event.preventDefault();confirmPay(\'' + kind + '\',\'' + id + '\',\'' + dueIso + '\')">' +
    '<div class="pm-modal-body">' +
      '<p class="pm-modal-note"><strong>' + esc(name) + '</strong>' +
        (who ? ' &middot; ' + esc(who) : '') +
        (method ? ' &middot; ' + methodLabel(method) : '') +
        (detail ? ' &middot; ' + esc(detail) : '') + '</p>' +
      '<div class="pm-form-grid">' +
        '<div class="pm-fld"><label class="pm-label" for="pm-pay-amount">Amount (' + esc(currency) + ') <span class="pm-req">*</span></label>' +
        '<input class="pm-input" id="pm-pay-amount" type="number" min="0" step="0.01" value="' + esc(amount) + '" required></div>' +
        '<div class="pm-fld"><label class="pm-label" for="pm-pay-date">Paid on</label>' +
        '<input class="pm-input" id="pm-pay-date" type="date" value="' + todayIso + '"></div>' +
        '<div class="pm-fld"><label class="pm-label" for="pm-pay-method">Method</label>' +
        '<select class="pm-input" id="pm-pay-method">' + methodOptions(method || 'interac') + '</select></div>' +
        '<div class="pm-fld pm-fld-full"><label class="pm-label" for="pm-pay-note">Note</label>' +
        '<input class="pm-input" id="pm-pay-note" placeholder="Reference number, confirmation code…"></div>' +
      '</div>' +
    '</div>' +
    '<div class="pm-modal-foot">' +
      '<button class="pm-btn pm-btn-ghost" type="button" onclick="closeModal()">Cancel</button>' +
      '<button class="pm-btn pm-btn-primary" type="submit">Confirm — Mark Paid ✓</button>' +
    '</div>' +
    '</form>'
  );
}
function confirmPay(kind, id, dueIso) {
  var amount = parseFloat(el('pm-pay-amount').value);
  if (isNaN(amount) || amount <= 0) { notify('Please enter a valid amount', 'warning'); return; }
  var paidDate = el('pm-pay-date').value || isoDay(new Date());
  var method = el('pm-pay-method').value;
  var note = el('pm-pay-note').value.trim();
  var paidBy = currentUserName();
  if (kind === 'regular') {
    var r = findRegular(id);
    if (!r) return;
    r.history = r.history || [];
    // Avoid duplicates for the same period.
    r.history = r.history.filter(function (h) { return h.dueDate !== dueIso; });
    r.history.push({
      dueDate: dueIso, amount: amount, paidAt: paidDate, paidBy: paidBy, note: note, method: method,
      departmentId: r.departmentId || '', typeId: r.typeId || '', sourceId: r.sourceId || ''
    });
    r.history.sort(function (a, b) { return String(b.dueDate).localeCompare(String(a.dueDate)); });
    notify('✓ Paid: ' + r.name + ' — ' + fmtMoney(amount, r.currency), 'success');
  } else {
    var q = findRequest(id);
    if (!q) return;
    q.status = 'paid';
    q.paidAt = paidDate;
    q.paidBy = paidBy;
    q.paidAmount = amount;
    q.payMethod = method;
    q.payNote = note;
    notify('✓ Paid: ' + q.title + ' — ' + fmtMoney(amount, q.currency), 'success');
  }
  persist();
  closeModal();
  renderAll();
}

// ── User / lock UI ──────────────────────────────────────────
function renderUser() {
  var chip = el('pm-user-chip');
  if (!chip) return;
  var u = _user || (tool.getUser ? tool.getUser() : null);
  if (!u || !u.name) chip.textContent = '👤 Viewing (not signed in)';
  else chip.textContent = '👤 ' + u.name + ' · ' + roleLabel();
  var mc = el('pm-month-chip');
  if (mc) mc.textContent = '🗓 ' + new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
function updateLock() {
  var locked = _readOnly || !canWrite();
  var banner = el('pm-lock-banner');
  if (!banner) return;
  if (locked) {
    var txt = el('pm-lock-text');
    if (!_user) txt.textContent = 'Not signed in — view-only mode';
    else if (_readOnly) txt.textContent = 'This form is read-only';
    else txt.textContent = 'You have view-only access';
    banner.style.display = 'block';
  } else {
    banner.style.display = 'none';
  }
  var shell = el('pm-shell');
  if (shell) shell.classList.toggle('pm-locked', locked);
}
function syncToolbarLocks() {
  // Requests: any user with write access can submit.
  ['btn-add-request-quick', 'btn-add-request'].forEach(function (id) {
    var b = el(id);
    if (b) b.style.display = canAddRequest() ? '' : 'none';
  });
  // Regulars, payees, copy tools: payment team only (admin or listed team emails).
  ['btn-add-regular-quick', 'btn-add-regular', 'btn-add-payee', 'btn-export-regulars', 'btn-import-regulars'].forEach(function (id) {
    var b = el(id);
    if (b) b.style.display = canManage() ? '' : 'none';
  });
  // Data trimming: admins only.
  var tr = el('btn-trim');
  if (tr) tr.style.display = (canAdmin() && !_readOnly) ? '' : 'none';
  // QuickBooks import: payment team.
  var qb = el('btn-import-qb');
  if (qb) qb.style.display = canManage() ? '' : 'none';
  // Org lists: payment team.
  ['btn-add-dept', 'btn-add-type', 'btn-add-source'].forEach(function (id) {
    var b = el(id);
    if (b) b.style.display = canManage() ? '' : 'none';
  });
  // Dashboard quick actions.
  var dr = el('btn-dash-request');
  if (dr) dr.style.display = canAddRequest() ? '' : 'none';
  ['btn-dash-regular', 'btn-dash-qb'].forEach(function (id) {
    var b = el(id);
    if (b) b.style.display = canManage() ? '' : 'none';
  });
}

// ── Categories datalist ─────────────────────────────────────
function buildDatalist() {
  var dl = el('pm-cat-options');
  if (!dl) return;
  var paramCats = (tool.param('categories', DEFAULT_CATS) || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var set = {};
  paramCats.forEach(function (c) { set[c.toLowerCase()] = c; });
  DB.regulars.forEach(function (r) { if (r.category) set[r.category.toLowerCase()] = r.category; });
  DB.requests.forEach(function (r) { if (r.category) set[r.category.toLowerCase()] = r.category; });
  dl.innerHTML = Object.keys(set).map(function (k) {
    return '<option value="' + esc(set[k]) + '"></option>';
  }).join('');
}

// ── Render everything ───────────────────────────────────────
function renderAll() {
  if (!DB) return;
  buildDatalist();
  renderStats();
  updateBadges();
  renderDashboard();
  renderDue();
  renderRegulars();
  renderRequests();
  renderMonthView();
  renderHistory();
  renderPayees();
  renderOrg();
  renderUser();
  syncToolbarLocks();
  scheduleResize();
}

// ── Sample data (for the test harness) ──────────────────────
function loadSample() {
  var t = new Date();
  var y = t.getFullYear(), m = t.getMonth();
  function day(n) { return isoDay(new Date(y, m, n)); }
  function dayLastMonth(n) { return isoDay(new Date(y, m - 1, n)); }
  function dayNext(n) { return isoDay(new Date(y, m, n + 14 > 28 ? 28 : n + 14)); }
  var anchorPayroll = addDays(new Date(), -10);
  DB = { version: 1, payees: [], regulars: [], requests: [], departments: [], types: [], sources: [] };
  DB.departments.push(
    { id: 'dep_ops', name: 'Operations', budget: 90000, currency: 'CAD', note: '' },
    { id: 'dep_mkt', name: 'Marketing & Events', budget: 45000, currency: 'CAD', note: 'Event costs live here' },
    { id: 'dep_youth', name: 'Youth Programs', budget: 60000, currency: 'CAD', note: 'Funded by Community Grant' }
  );
  DB.types.push(
    { id: 'typ_rent', name: 'Rent', note: '' },
    { id: 'typ_utils', name: 'Utilities', note: '' },
    { id: 'typ_payroll', name: 'Payroll', note: '' },
    { id: 'typ_insurance', name: 'Insurance', note: '' },
    { id: 'typ_software', name: 'Software', note: '' },
    { id: 'typ_supplies', name: 'Supplies', note: '' },
    { id: 'typ_reimb', name: 'Reimbursement', note: '' }
  );
  DB.sources.push(
    { id: 'src_grant', name: 'Community Grant 2026', note: '' },
    { id: 'src_bank', name: 'Operating Bank Account', note: 'Main account' }
  );
  DB.payees.push(
    { id: 'pye_landlord', name: 'Landlord — 123 Main St', method: 'interac', detail: 'landlord@example.com', note: '' },
    { id: 'pye_hydro', name: 'City Hydro', method: 'interac', detail: 'billing@cityhydro.example', note: '' },
    { id: 'pye_internet', name: 'NetCo Internet', method: 'card', detail: 'Visa •• 4242', note: '' },
    { id: 'pye_payroll', name: 'Payroll Provider', method: 'eft', detail: 'Account 001234 — Branch 003', note: 'Submit 2 days before payday' },
    { id: 'pye_insurance', name: 'Shield Insurance', method: 'eft', detail: 'Policy #INS-99887', note: '' },
    { id: 'pye_supplier', name: 'Office Depot Supplier', method: 'wire', detail: 'IBAN TR00 0000 1234 5678', note: '' }
  );
  function mkReg(o) {
    o.id = uid('reg');
    o.active = o.active !== false;
    o.history = o.history || [];
    o.createdBy = 'Ada Owner';
    o.createdAt = new Date().toISOString();
    DB.regulars.push(o);
  }
  mkReg({
    name: 'Office Rent', category: 'Rent', typeId: 'typ_rent', departmentId: 'dep_ops', sourceId: 'src_bank',
    amount: 4500, currency: 'CAD',
    cadence: 'monthly', day: 1, anchor: isoDay(nextMonthlyAnchor(1)),
    payeeId: 'pye_landlord', who: 'Landlord — 123 Main St', method: 'interac', methodDetail: 'landlord@example.com', note: '',
    history: [
      { dueDate: dayLastMonth(1), amount: 4500, paidAt: dayLastMonth(2), paidBy: 'Ali Accountant', note: 'e-Transfer sent', departmentId: 'dep_ops', typeId: 'typ_rent', sourceId: 'src_bank' },
      { dueDate: isoDay(new Date(y, m - 2, 1)), amount: 4500, paidAt: isoDay(new Date(y, m - 2, 3)), paidBy: 'Ali Accountant', note: '', departmentId: 'dep_ops', typeId: 'typ_rent', sourceId: 'src_bank' }
    ]
  });
  mkReg({
    name: 'Office Internet', category: 'Utilities', typeId: 'typ_utils', departmentId: 'dep_ops', sourceId: 'src_bank',
    amount: 89.99, currency: 'CAD',
    cadence: 'monthly', day: 15, anchor: isoDay(nextMonthlyAnchor(15)),
    payeeId: 'pye_internet', who: 'NetCo Internet', method: 'card', methodDetail: 'Visa •• 4242', note: ''
  });
  mkReg({
    name: 'Payroll — Bi-weekly', category: 'Payroll', typeId: 'typ_payroll', departmentId: 'dep_ops', sourceId: 'src_bank',
    amount: 6200, currency: 'CAD',
    cadence: 'biweekly', anchor: isoDay(anchorPayroll),
    payeeId: 'pye_payroll', who: 'Payroll Provider', method: 'eft', methodDetail: 'Account 001234 — Branch 003', note: '',
    history: [
      { dueDate: isoDay(addDays(anchorPayroll, -14)), amount: 6200, paidAt: isoDay(addDays(anchorPayroll, -13)), paidBy: 'Ali Accountant', note: '', departmentId: 'dep_ops', typeId: 'typ_payroll', sourceId: 'src_bank' },
      { dueDate: isoDay(addDays(anchorPayroll, -28)), amount: 6200, paidAt: isoDay(addDays(anchorPayroll, -27)), paidBy: 'Ali Accountant', note: '', departmentId: 'dep_ops', typeId: 'typ_payroll', sourceId: 'src_bank' }
    ]
  });
  mkReg({
    name: 'Business Insurance', category: 'Insurance', typeId: 'typ_insurance', departmentId: 'dep_ops', sourceId: 'src_bank',
    amount: 780, currency: 'CAD',
    cadence: 'quarterly', anchor: isoDay(new Date(y, m, 5)),
    payeeId: 'pye_insurance', who: 'Shield Insurance', method: 'eft', methodDetail: 'Policy #INS-99887', note: ''
  });
  mkReg({
    name: 'Accounting Software', category: 'Software', typeId: 'typ_software', departmentId: 'dep_ops', sourceId: 'src_bank',
    amount: 349, currency: 'CAD',
    cadence: 'yearly', anchor: isoDay(new Date(y, 3, 10)),
    payeeId: '', who: 'Ledgerly Software', method: 'card', methodDetail: 'Corporate Visa', note: 'Auto-renewal',
    history: [{ dueDate: isoDay(new Date(y, 3, 10)), amount: 349, paidAt: isoDay(new Date(y, 3, 12)), paidBy: 'Ali Accountant', note: '', departmentId: 'dep_ops', typeId: 'typ_software', sourceId: 'src_bank' }]
  });
  mkReg({
    name: 'Youth Event Supplies', category: 'Supplies', typeId: 'typ_supplies', departmentId: 'dep_youth', sourceId: 'src_grant',
    amount: '', currency: 'CAD',
    cadence: 'monthly', day: 20, anchor: isoDay(nextMonthlyAnchor(20)),
    payeeId: '', who: 'Sparkle Cleaning', method: 'interac', methodDetail: 'sparkle@example.com', note: 'Amount varies each visit', active: false
  });
  var reqAt = new Date(Date.now() - 2 * 86400000).toISOString();
  DB.requests.push({
    id: uid('req'), title: 'New laptops for marketing team', category: 'Supplies', typeId: 'typ_supplies', departmentId: 'dep_mkt', sourceId: 'src_bank',
    amount: 2499, currency: 'CAD', dueDate: dayNext(5),
    payeeId: 'pye_supplier', who: 'Office Depot Supplier', method: 'wire', methodDetail: 'IBAN TR00 0000 1234 5678',
    note: 'Quote attached in email thread', status: 'pending',
    requestedBy: 'Mina Manager', requestedById: 'u_mina', requestedByEmail: 'mina@uniconhub.com', requestedAt: reqAt
  });
  DB.requests.push({
    id: uid('req'), title: 'Reimburse John — client lunch', category: 'Reimbursement', typeId: 'typ_reimb', departmentId: 'dep_mkt', sourceId: 'src_bank',
    amount: 86.4, currency: 'CAD', dueDate: isoDay(addDays(new Date(), 3)),
    payeeId: '', who: 'John Smith', method: 'interac', methodDetail: 'john@example.com',
    note: '', status: 'approved',
    requestedBy: 'Mina Manager', requestedById: 'u_mina', requestedByEmail: 'mina@uniconhub.com',
    requestedAt: new Date(Date.now() - 86400000).toISOString(),
    approvedBy: 'Ada Owner', approvedAt: new Date().toISOString()
  });
  DB.requests.push({
    id: uid('req'), title: 'Office furniture deposit', category: 'Supplies', typeId: 'typ_supplies', departmentId: 'dep_ops', sourceId: 'src_bank',
    amount: 650, currency: 'CAD', dueDate: dayLastMonth(20),
    payeeId: '', who: 'FurniWorks Ltd', method: 'cheque', methodDetail: 'Payable to FurniWorks Ltd',
    note: '', status: 'paid',
    requestedBy: 'Mina Manager', requestedById: 'u_mina', requestedByEmail: 'mina@uniconhub.com',
    requestedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    approvedBy: 'Ada Owner', approvedAt: new Date(Date.now() - 19 * 86400000).toISOString(),
    paidAt: dayLastMonth(21), paidBy: 'Ali Accountant', paidAmount: 650
  });
  DB.requests.push({
    id: uid('req'), title: 'Office supplies — printer toner', category: 'Supplies', typeId: 'typ_supplies', departmentId: 'dep_ops', sourceId: 'src_bank',
    amount: 214.75, currency: 'CAD', dueDate: isoDay(addDays(new Date(), 6)),
    payeeId: '', who: 'TonerMart', method: 'interac', methodDetail: 'payments@tonermart.example',
    note: 'Own request example — visible to the editor role', status: 'pending',
    requestedBy: 'Ali Accountant', requestedById: 'u_ali', requestedByEmail: 'ali@uniconhub.com', requestedAt: reqAt
  });
  persist();
  renderAll();
  notify('Sample data loaded — switch roles with the harness bar', 'success');
}

// ── Form edit-state helpers ─────────────────────────────────
var _editRegularId = '';
var _editRequestId = '';
var _editPayeeId = '';
var _editDeptId = '';
var _editTypeId = '';
var _editSourceId = '';
function openRegularForm(id) {
  _editRegularId = id || '';
  _openRegularForm(_editRegularId);
}
function openRequestForm(id) {
  _editRequestId = id || '';
  _openRequestForm(_editRequestId);
}
function openPayeeForm(id) {
  _editPayeeId = id || '';
  _openPayeeForm(_editPayeeId);
}
function openDepartmentForm(id) {
  _editDeptId = id || '';
  _openDepartmentForm(_editDeptId);
}
function openTypeForm(id) {
  _editTypeId = id || '';
  _openTypeForm(_editTypeId);
}
function openSourceForm(id) {
  _editSourceId = id || '';
  _openSourceForm(_editSourceId);
}

// ── Entry point ─────────────────────────────────────────────
tool.onReady(function (val, fields) {
  _defaultCurrency = (tool.param('defaultCurrency', 'CAD') || 'CAD').toUpperCase();
  DB = normalizeDB(val);
  _user = tool.getUser ? tool.getUser() : null;
  _readOnly = tool.isReadOnly ? tool.isReadOnly() : false;

  tool.declareOutput({
    type: 'object',
    properties: {
      version: { type: 'number' },
      payees: { type: 'array', items: { type: 'object' } },
      regulars: { type: 'array', items: { type: 'object' } },
      requests: { type: 'array', items: { type: 'object' } }
    }
  });
  tool.declareParams([
    { name: 'defaultCurrency', label: 'Default Currency', type: 'text', default: 'CAD', severity: 'optional', hint: 'Default currency for new payments (e.g. CAD, USD, TRY, EUR, GBP).' },
    { name: 'categories', label: 'Payment Categories', type: 'text', default: DEFAULT_CATS, severity: 'optional', hint: 'Comma-separated category suggestions for the category fields.' },
    { name: 'requestVisibility', label: 'Request Visibility', type: 'text', default: 'own', severity: 'optional', hint: "'own' = users see only the requests they added themselves (per department). 'all' = everyone with access sees all requests. Admins and the payments team always see everything." },
    { name: 'paymentsTeamEmails', label: 'Payments Team Emails', type: 'text', default: '', severity: 'goodToHave', hint: 'Comma-separated emails of users who may manage regular payments and mark things paid (e.g. the accountant). Admins always have this access. Leave empty if only admins should check off payments.' }
  ]);

  el('pm-backdrop').addEventListener('click', function (e) {
    if (e.target && e.target.id === 'pm-backdrop') closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  tool.reportValid(true);
  updateLock();
  renderAll();

  tool.onValueChange(function (v) {
    if (_saving) { _saving = false; return; }
    DB = normalizeDB(v);
    renderAll();
  });
  tool.onReadonlyChange(function (ro) {
    _readOnly = ro;
    updateLock();
    renderAll();
  });
  tool.onUserChange(function (u) {
    _user = u;
    renderUser();
    updateLock();
    renderAll();
  });
  tool.onFieldsChange(function () { renderUser(); });
});
