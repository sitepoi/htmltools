// ════════════════════════════════════════════════════════════════
// Simple Invoice & Expense Collector — UniconHub html-tool
// Two books, one CMS record:
//   • Sales   — invoices: customers, line items, VAT, due dates,
//               print to PDF, email to the customer.
//   • Costs   — expenses: upload a receipt → extract its text →
//               AI reads the bill → details pre-filled → save.
// Everything lives in tool.setValue() — no CMS object CRUD config.
// Accountant exports: invoices CSV, expenses CSV, printable report.
// ════════════════════════════════════════════════════════════════
'use strict';

// ── Constants ─────────────────────────────────────────────────
var CATEGORIES = ['Advertising', 'Bank Fees', 'Equipment', 'Food & Dining', 'Fuel', 'Insurance', 'Office Supplies', 'Rent', 'Repairs & Maintenance', 'Services', 'Software', 'Taxes', 'Travel', 'Utilities', 'Other'];
var PAY_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'bank', label: 'Bank transfer' },
  { id: 'other', label: 'Other' }
];
var CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP', 'CAD', 'AED', 'SAR', 'AUD'];
var OCR_PROMPT = [
  'You are an accounting OCR assistant. Analyze the receipt / bill text below and return STRICT JSON only (no markdown fences, no commentary) with exactly these fields:',
  '{"vendor":"","date":"YYYY-MM-DD","amount":0,"taxAmount":0,"taxRate":0,"currency":"","category":"","paymentMethod":"","confidence":"","notes":""}',
  'Rules:',
  '- vendor: the seller / merchant name.',
  '- date: the receipt date as YYYY-MM-DD. Use today if not visible.',
  '- amount: the TOTAL amount paid (gross, tax included if the receipt shows tax).',
  '- taxAmount: the VAT / tax shown on the receipt (0 if not shown).',
  '- taxRate: the VAT percent shown (0 if unknown).',
  '- currency: ISO code such as TRY, USD, EUR.',
  '- category: one of Advertising, Bank Fees, Equipment, Food & Dining, Fuel, Insurance, Office Supplies, Rent, Repairs & Maintenance, Services, Software, Taxes, Travel, Utilities, Other.',
  '- paymentMethod: cash, card, bank or other.',
  '- confidence: high, medium or low.',
  '- notes: receipt number or short description if visible.',
  'If a value is unknown leave it empty or 0. Return only the JSON object.'
].join('\n');

// ── State ─────────────────────────────────────────────────────
var DB = null;
var _user = null;
var _readOnly = false;
var _saving = false;
var _editInvoiceId = '';
var _editExpenseId = '';
var _editCustomerId = '';
var _scan = { stage: 'idle', file: null, text: '', parsed: null, error: '' };
var _scanPrefill = null;
var _dropReceipt = false;
var _resizeRaf = null;
// True when the host SDK provides no user/session info at all (e.g. the
// CMS 'dynamic-html-tool' field injects a reduced SDK without getUser).
// In that mode the CMS itself enforces permissions server-side and the tool
// only respects the host's read-only flag.
var _noIdentity = false;

// ── Small helpers ─────────────────────────────────────────────
function el(id) { return document.getElementById(id); }
function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function uid(p) { return (p || 'sx') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function pad3(n) { return (n < 10 ? '00' : n < 100 ? '0' : '') + n; }
function parseNum(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
function round2(n) { return Math.round(n * 100) / 100; }
function parseISO(s) {
  if (!s) return null;
  var p = String(s).slice(0, 10).split('-');
  if (p.length !== 3) return null;
  return new Date(+p[0], +p[1] - 1, +p[2]);
}
function validIso(s) {
  if (!s) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var d = parseISO(s);
  return d && d.getFullYear() === +s.slice(0, 4) && d.getMonth() + 1 === +s.slice(5, 7) && d.getDate() === +s.slice(8, 10);
}
function isoDay(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function todayISO() { return isoDay(new Date()); }
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtDate(s) {
  var d = s ? parseISO(s) : null;
  if (!d) return '—';
  var t = new Date();
  var opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== t.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}
function fmtDateFull(s) {
  var d = s ? parseISO(s) : null;
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
function fmtQty(n) {
  var v = round2(n);
  return String(v).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
function defCurrency() {
  if (DB && DB.company && DB.company.currency) return DB.company.currency;
  return 'USD';
}
function defTaxRate() {
  if (DB && DB.company && DB.company.taxRate !== undefined && DB.company.taxRate !== null && DB.company.taxRate !== '') return parseNum(DB.company.taxRate);
  return 0;
}
function sumByCurrency(rows, amountOf) {
  var map = {};
  rows.forEach(function (r) {
    var c = r.currency || defCurrency();
    var a = amountOf(r);
    if (!isNaN(a) && a > 0) map[c] = (map[c] || 0) + a;
  });
  return map;
}
function fmtSumMap(map) {
  var keys = Object.keys(map);
  if (!keys.length) return '—';
  return keys.map(function (c) { return fmtMoney(round2(map[c]), c); }).join(' &middot; ');
}
function fmtRate(r) {
  var v = round2(r);
  return String(v).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') + '%';
}
function scheduleResize() {
  if (_resizeRaf) cancelAnimationFrame(_resizeRaf);
  _resizeRaf = requestAnimationFrame(function () {
    _resizeRaf = null;
    if (tool && tool.resize) tool.resize();
  });
}

// ── Permissions ───────────────────────────────────────────────
function getUserSafe() {
  try {
    if (tool && typeof tool.getUser === 'function') return tool.getUser() || null;
  } catch (e) { /* session not ready yet */ }
  return null;
}
function hasUserApi() {
  try { return !!(tool && typeof tool.getUser === 'function'); } catch (e) { return false; }
}
function sameUser(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && String((a.roles || []).join(',')) === String((b.roles || []).join(','));
}
function refreshUser() {
  var u = getUserSafe();
  if (!sameUser(u, _user)) {
    _user = u;
    renderAll();
  }
}
function getRoles() {
  if (!_user) return [];
  var roles = (_user.roles && _user.roles.slice) ? _user.roles.slice() : [];
  // Fallback: some CMS builds deliver the user without the pre-merged roles
  // array — derive an equivalent role from the raw object-level access flags.
  if (!roles.length && _user.effectiveAccess) {
    if (_user.effectiveAccess.isManager) roles.push('admin');
    if (_user.effectiveAccess.isEditor) roles.push('editor');
    if (_user.effectiveAccess.isViewer) roles.push('viewer');
  }
  return roles;
}
function canAdmin() {
  if (_noIdentity) return !_readOnly;
  var r = getRoles();
  return r.indexOf('admin') !== -1 || r.indexOf('owner') !== -1 || r.indexOf('user-manager') !== -1 || r.indexOf('developer') !== -1;
}
function canWrite() {
  if (_noIdentity) return !_readOnly;
  return !!_user && !_readOnly && (canAdmin() || getRoles().indexOf('editor') !== -1);
}
function roleLabel() {
  if (_noIdentity) return 'CMS session';
  var r = getRoles();
  if (!_user) return 'Not signed in';
  if (r.indexOf('admin') !== -1 || r.indexOf('owner') !== -1) return 'Admin';
  if (r.indexOf('developer') !== -1) return 'Developer';
  if (r.indexOf('editor') !== -1) return 'Editor';
  return 'Viewer';
}
function currentUserName() {
  return (_user && _user.name) ? _user.name : 'Unknown';
}

// ── DB normalisation / persistence ────────────────────────────
function normalizeDB(v) {
  var out = (v && typeof v === 'object') ? v : {};
  if (!out.company || typeof out.company !== 'object') out.company = {};
  var c = out.company;
  if (!c.seeded) {
    c.name = c.name || (tool.param('companyName', '') || '').trim();
    c.taxId = c.taxId || (tool.param('companyTaxId', '') || '').trim();
    c.email = c.email || (tool.param('companyEmail', '') || '').trim();
    c.phone = c.phone || '';
    c.address = c.address || '';
    c.currency = c.currency || (tool.param('defaultCurrency', 'USD') || 'USD').toUpperCase();
    if (c.taxRate === undefined || c.taxRate === null || c.taxRate === '') c.taxRate = parseNum(tool.param('defaultTaxRate', '18'));
    c.invoicePrefix = (c.invoicePrefix || (tool.param('invoicePrefix', 'INV') || 'INV')).trim() || 'INV';
    c.nextSeq = parseInt(c.nextSeq, 10) > 0 ? parseInt(c.nextSeq, 10) : 1;
    c.seeded = true;
  } else {
    if (c.name === undefined || c.name === null) c.name = '';
    if (c.taxId === undefined || c.taxId === null) c.taxId = '';
    if (c.email === undefined || c.email === null) c.email = '';
    if (c.phone === undefined || c.phone === null) c.phone = '';
    if (c.address === undefined || c.address === null) c.address = '';
    if (!c.currency) c.currency = 'USD';
    if (c.taxRate === undefined || c.taxRate === null || c.taxRate === '') c.taxRate = 0;
    if (!c.invoicePrefix) c.invoicePrefix = 'INV';
    if (!c.nextSeq || parseInt(c.nextSeq, 10) < 1) c.nextSeq = 1;
  }
  c.nextSeq = parseInt(c.nextSeq, 10) > 0 ? parseInt(c.nextSeq, 10) : 1;
  if (!Array.isArray(out.customers)) out.customers = [];
  if (!Array.isArray(out.invoices)) out.invoices = [];
  if (!Array.isArray(out.expenses)) out.expenses = [];
  out.version = 1;
  out.customers.forEach(function (x) {
    if (!x.id) x.id = uid('cus');
    if (!x.name) x.name = '';
    if (!x.email) x.email = '';
    if (!x.taxId) x.taxId = '';
    if (!x.phone) x.phone = '';
    if (!x.address) x.address = '';
  });
  out.invoices.forEach(function (i) {
    if (!i.id) i.id = uid('inv');
    if (!i.number) i.number = '';
    if (!i.customerId) i.customerId = '';
    if (!i.customerName) i.customerName = '';
    if (!validIso(i.issueDate)) i.issueDate = todayISO();
    if (!Array.isArray(i.items)) i.items = [];
    i.items.forEach(function (it) {
      if (it.desc === undefined) it.desc = '';
      if (it.qty === undefined || it.qty === null || it.qty === '') it.qty = 1;
      if (it.unitPrice === undefined || it.unitPrice === null || it.unitPrice === '') it.unitPrice = 0;
    });
    if (!i.currency) i.currency = c.currency;
    if (i.taxRate === undefined || i.taxRate === null || i.taxRate === '') i.taxRate = c.taxRate;
    if (!i.status) i.status = 'draft';
    if (!i.paidDate) i.paidDate = '';
    if (!i.notes) i.notes = '';
    if (!i.createdAt) i.createdAt = new Date().toISOString();
    if (!i.createdBy) i.createdBy = '';
  });
  out.expenses.forEach(function (e) {
    if (!e.id) e.id = uid('exp');
    if (!e.vendor) e.vendor = '';
    if (!validIso(e.expenseDate)) e.expenseDate = todayISO();
    if (!e.currency) e.currency = c.currency;
    if (e.amount === undefined || e.amount === null || e.amount === '') e.amount = 0;
    if (e.taxRate === undefined || e.taxRate === null || e.taxRate === '') e.taxRate = 0;
    if (e.taxAmount === undefined || e.taxAmount === null || e.taxAmount === '') e.taxAmount = round2(parseNum(e.amount) * parseNum(e.taxRate) / (100 + parseNum(e.taxRate)));
    if (!e.category) e.category = '';
    if (!e.paymentMethod) e.paymentMethod = 'other';
    if (!e.status) e.status = 'unpaid';
    if (!e.paidDate) e.paidDate = '';
    if (!e.notes) e.notes = '';
    if (e.receipt && typeof e.receipt === 'string') e.receipt = { name: 'Receipt', url: e.receipt, size: 0, type: '' };
    if (!e.receipt) e.receipt = null;
    if (e.ocrText === undefined) e.ocrText = '';
    if (!e.createdAt) e.createdAt = new Date().toISOString();
    if (!e.createdBy) e.createdBy = '';
  });
  return out;
}
function blankDB() {
  return {
    version: 1,
    company: { name: '', taxId: '', email: '', phone: '', address: '', currency: defCurrency(), taxRate: 0, invoicePrefix: 'INV', nextSeq: 1, seeded: true },
    customers: [],
    invoices: [],
    expenses: []
  };
}
function persist() {
  _saving = true;
  tool.setValue(JSON.parse(JSON.stringify(DB)));
  setTimeout(function () { _saving = false; }, 300);
}
function notify(msg, sev) { if (tool.notify) tool.notify(msg, sev || 'info'); }

// ── Find helpers ──────────────────────────────────────────────
function findCustomer(id) { for (var i = 0; i < DB.customers.length; i++) if (DB.customers[i].id === id) return DB.customers[i]; return null; }
function findInvoice(id) { for (var i = 0; i < DB.invoices.length; i++) if (DB.invoices[i].id === id) return DB.invoices[i]; return null; }
function findExpense(id) { for (var i = 0; i < DB.expenses.length; i++) if (DB.expenses[i].id === id) return DB.expenses[i]; return null; }

// ── Invoice math & status ─────────────────────────────────────
function invSubtotal(inv) {
  var s = 0;
  (inv.items || []).forEach(function (it) { s += (parseNum(it.qty) || 0) * (parseNum(it.unitPrice) || 0); });
  return round2(s);
}
function invTax(inv) { return round2(invSubtotal(inv) * (parseNum(inv.taxRate) || 0) / 100); }
function invTotal(inv) { return round2(invSubtotal(inv) + invTax(inv)); }
function invStatus(inv) {
  if (inv.status === 'void') return 'void';
  if (inv.status === 'paid') return 'paid';
  if (validIso(inv.dueDate) && parseISO(inv.dueDate) < startOfDay(new Date())) return 'overdue';
  return inv.status === 'sent' ? 'sent' : 'draft';
}
function invStatusLabel(st) {
  switch (st) {
    case 'draft': return 'Draft';
    case 'sent': return 'Sent';
    case 'paid': return 'Paid';
    case 'void': return 'Void';
    case 'overdue': return 'Overdue';
    default: return st || '—';
  }
}
function invStatusChip(st) {
  var cls = st === 'paid' ? 'sx-chip-green' : st === 'overdue' ? 'sx-chip-red' : st === 'sent' ? 'sx-chip-blue' : st === 'void' ? 'sx-chip-gray' : 'sx-chip-slate';
  var ic = st === 'paid' ? '✅' : st === 'overdue' ? '⏰' : st === 'sent' ? '📨' : st === 'void' ? '🚫' : '📝';
  return '<span class="sx-chip ' + cls + '">' + ic + ' ' + esc(invStatusLabel(st)) + '</span>';
}
function invoiceEmailTarget(inv) {
  var cust = inv.customerId ? findCustomer(inv.customerId) : null;
  return ((cust && cust.email) || (DB.company && DB.company.email) || '').trim();
}
function expTax(e) { return round2(parseNum(e.taxAmount) || 0); }

// ── Invoice numbering ─────────────────────────────────────────
function invoiceSeq() { return parseInt(DB.company.nextSeq, 10) || 1; }
function nextInvoiceNumber(commit) {
  var seq = invoiceSeq();
  var num = ((DB.company.invoicePrefix || 'INV') + '-' + new Date().getFullYear() + '-' + pad3(seq));
  if (commit) DB.company.nextSeq = seq + 1;
  return num;
}

// ── Tabs ──────────────────────────────────────────────────────
function switchTab(name) {
  var btns = document.querySelectorAll('.sx-tab-btn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].getAttribute('data-tab') === name);
  var panes = document.querySelectorAll('.sx-tabpane');
  for (var j = 0; j < panes.length; j++) panes[j].classList.toggle('active', panes[j].id === 'pane-' + name);
  renderAll();
}

// ── Modal system ──────────────────────────────────────────────
function openModal(html) {
  el('sx-modal').innerHTML = html;
  el('sx-backdrop').style.display = 'flex';
  scheduleResize();
}
function closeModal() {
  el('sx-backdrop').style.display = 'none';
  el('sx-modal').innerHTML = '';
  scheduleResize();
}
function confirmDlg(title, msg, okLabel, okClass, cb) {
  openModal(
    '<div class="sx-modal-head"><div class="sx-modal-title">' + esc(title) + '</div>' +
    '<button class="sx-modal-close" type="button" onclick="closeModal()">✕</button></div>' +
    '<div class="sx-modal-body"><p class="sx-confirm-text">' + msg + '</p></div>' +
    '<div class="sx-modal-foot">' +
    '<button class="sx-btn sx-btn-ghost" type="button" onclick="closeModal()">Cancel</button>' +
    '<button class="sx-btn ' + (okClass === 'danger' ? 'sx-btn-danger' : 'sx-btn-primary') + '" type="button" id="sx-confirm-ok">' + esc(okLabel) + '</button>' +
    '</div>'
  );
  el('sx-confirm-ok').addEventListener('click', function () { closeModal(); cb(); });
}
function formErr(id, msg) {
  var box = el(id);
  if (!box) return;
  box.style.display = 'block';
  box.textContent = '⚠ ' + msg;
  scheduleResize();
}

// ── Shared option builders ────────────────────────────────────
function currencyOptions(selected) {
  var cur = selected || defCurrency();
  var list = CURRENCIES.slice();
  if (list.indexOf(cur) === -1) list.unshift(cur);
  return list.map(function (c) {
    return '<option value="' + esc(c) + '"' + (c === cur ? ' selected' : '') + '>' + esc(c) + '</option>';
  }).join('');
}
function methodOptions(selected) {
  return PAY_METHODS.map(function (m) {
    return '<option value="' + m.id + '"' + (m.id === selected ? ' selected' : '') + '>' + esc(m.label) + '</option>';
  }).join('');
}
function customerOptions(selectedId) {
  var opts = '<option value="">— Choose customer… —</option>';
  DB.customers.forEach(function (p) {
    opts += '<option value="' + esc(p.id) + '"' + (p.id === selectedId ? ' selected' : '') + '>' + esc(p.name) + '</option>';
  });
  opts += '<option value="__new"' + (selectedId === '__new' ? ' selected' : '') + '>＋ New customer…</option>';
  return opts;
}
function buildDatalist() {
  var dl = el('sx-cat-options');
  if (!dl) return;
  var set = {};
  CATEGORIES.forEach(function (c) { set[c.toLowerCase()] = c; });
  DB.expenses.forEach(function (e) { if (e.category) set[e.category.toLowerCase()] = e.category; });
  dl.innerHTML = Object.keys(set).map(function (k) {
    return '<option value="' + esc(set[k]) + '"></option>';
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// RECEIPT SCANNING — upload → extract text → AI read → prefill
// ═══════════════════════════════════════════════════════════════
function startReceiptScan() {
  if (!canWrite()) { notify('Read-only — you cannot add expenses', 'warning'); return; }
  if (_scan.stage === 'uploading' || _scan.stage === 'extract' || _scan.stage === 'ai') { notify('A receipt scan is already running', 'info'); return; }
  if (typeof tool.requestUpload !== 'function') { notify('Receipt upload is not enabled for this tool (admin must set allowUpload)', 'error'); return; }
  _scan = { stage: 'uploading', file: null, text: '', parsed: null, error: '' };
  renderScanCard();
  tool.requestUpload('image/*,.pdf,.jpg,.jpeg,.png,.heic', function (err, file) {
    if (err || !file) {
      _scan = { stage: 'idle', file: null, text: '', parsed: null, error: '' };
      renderScanCard();
      notify('Receipt upload failed: ' + (err || 'no file selected'), 'error');
      return;
    }
    _scan.file = file;
    _scan.stage = 'extract';
    renderScanCard();
    if (typeof tool.requestFileContent !== 'function') {
      _finishScanWithText('');
      return;
    }
    tool.requestFileContent(file.url, function (err2, content) {
      var text = (!err2 && content) ? String(content) : '';
      if (err2) _scan.error = 'Text extraction unavailable — ' + err2;
      _finishScanWithText(text);
    });
  });
}
function _finishScanWithText(text) {
  _scan.text = String(text || '').slice(0, 6000);
  _scan.stage = 'ai';
  renderScanCard();
  if (typeof tool.requestAI !== 'function') {
    _scan.error = 'AI reading is not enabled for this tool (admin must set allowAi).';
    _scan.stage = 'ready';
    renderScanCard();
    openExpenseFormWithScan(null);
    return;
  }
  var context = _scan.text || 'No text could be extracted from "' + _scan.file.name + '". Use the file name only.';
  tool.requestAI(OCR_PROMPT, context, function (err3, resp) {
    if (err3 && !resp) {
      _scan.error = 'AI reading failed — ' + err3;
    } else {
      _scan.parsed = parseAiJson(resp);
    }
    _scan.stage = 'ready';
    renderScanCard();
    openExpenseFormWithScan(_scan.parsed);
  });
}
function parseAiJson(resp) {
  if (!resp) return null;
  var s = String(resp).replace(/```json/gi, '').replace(/```/g, '');
  var a = s.indexOf('{');
  var b = s.lastIndexOf('}');
  if (a === -1 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}
function renderScanCard() {
  var box = el('scan-status');
  if (!box) return;
  if (_scan.stage === 'idle') { box.style.display = 'none'; box.innerHTML = ''; scheduleResize(); return; }
  box.style.display = 'block';
  var steps = [
    { id: 'uploading', label: '📎 Picking receipt' },
    { id: 'extract', label: '🔍 Extracting text' },
    { id: 'ai', label: '🤖 AI reading the bill' },
    { id: 'ready', label: '✅ Details ready' }
  ];
  var order = ['uploading', 'extract', 'ai', 'ready'];
  var curIdx = order.indexOf(_scan.stage);
  var html = '<div class="sx-scan-top">';
  html += (_scan.stage === 'ready') ? '<span class="sx-scan-title">✅ Receipt read</span>'
    : '<span class="sx-spinner"></span><span class="sx-scan-title">Reading receipt&hellip;</span>';
  if (_scan.file) html += '<span class="sx-scan-file">' + esc(_scan.file.name) + '</span>';
  html += '</div><div class="sx-scan-steps">';
  order.forEach(function (sid, idx) {
    var cls = idx < curIdx ? ' done' : (idx === curIdx ? ' current' : '');
    var mark = idx < curIdx ? '✓ ' : '';
    html += '<span class="sx-scan-step' + cls + '">' + mark + steps[idx].label + '</span>';
  });
  html += '</div>';
  if (_scan.error) html += '<div class="sx-scan-warn">⚠ ' + esc(_scan.error) + ' — you can still enter the details by hand.</div>';
  if (_scan.stage === 'ready') {
    html += '<div class="sx-scan-actions">' +
      '<button class="sx-btn sx-btn-primary sx-btn-sm" type="button" onclick="openExpenseFormWithScan(_scan.parsed)">＋ Add expense from this receipt</button>' +
      '<button class="sx-btn sx-btn-ghost sx-btn-sm" type="button" onclick="startReceiptScan()">↻ Scan another</button>' +
      '</div>';
  }
  box.innerHTML = html;
  scheduleResize();
}

// ═══════════════════════════════════════════════════════════════
// EXPENSE FORM
// ═══════════════════════════════════════════════════════════════
function openExpenseForm(id) {
  if (!canWrite()) return;
  _editExpenseId = id || '';
  _scanPrefill = null;
  _dropReceipt = false;
  _openExpenseForm();
}
function openExpenseFormWithScan(parsed) {
  if (!canWrite()) return;
  _editExpenseId = '';
  _scanPrefill = parsed || null;
  _dropReceipt = false;
  _openExpenseForm();
}
function _openExpenseForm() {
  var existing = _editExpenseId ? findExpense(_editExpenseId) : null;
  var p = !existing && _scanPrefill ? _scanPrefill : null;
  var amount = existing ? existing.amount : '';
  var rate = existing ? existing.taxRate : defTaxRate();
  var vendor = existing ? existing.vendor : '';
  var dateV = existing ? existing.expenseDate : todayISO();
  var cur = existing ? existing.currency : defCurrency();
  var category = existing ? existing.category : '';
  var method = existing ? existing.paymentMethod : 'other';
  var status = existing ? existing.status : 'unpaid';
  var paidDate = existing ? existing.paidDate : '';
  var notes = existing ? existing.notes : '';
  var aiChip = '';
  if (p) {
    vendor = p.vendor || vendor;
    if (validIso(p.date)) dateV = p.date;
    if (parseNum(p.amount) > 0) amount = p.amount;
    if (parseNum(p.taxRate) > 0) rate = p.taxRate;
    else if (parseNum(p.taxAmount) > 0 && parseNum(amount) > parseNum(p.taxAmount)) rate = round2(100 * parseNum(p.taxAmount) / (parseNum(amount) - parseNum(p.taxAmount)));
    if (p.currency && CURRENCIES.indexOf(String(p.currency).toUpperCase()) !== -1) cur = String(p.currency).toUpperCase();
    if (p.category) category = p.category;
    if (p.paymentMethod) {
      var mm = String(p.paymentMethod).toLowerCase();
      method = (mm === 'cash' || mm === 'card' || mm === 'bank') ? mm : 'other';
    }
    if (p.notes) notes = p.notes;
    var conf = p.confidence ? String(p.confidence).toLowerCase() : '';
    if (conf === 'high') aiChip = '<span class="sx-chip sx-chip-green">🤖 AI read · high confidence</span>';
    else if (conf === 'medium') aiChip = '<span class="sx-chip sx-chip-amber">🤖 AI read · medium confidence</span>';
    else if (conf === 'low') aiChip = '<span class="sx-chip sx-chip-red">🤖 AI read · low confidence — please check</span>';
    else aiChip = '<span class="sx-chip sx-chip-accent">🤖 AI read</span>';
  }
  var receipt = _scan.file || (existing && existing.receipt) || null;
  var receiptHtml = '';
  if (receipt) {
    receiptHtml = '<div class="sx-receipt-card" id="expf-receipt">' +
      '<span class="sx-receipt-ic">📎</span>' +
      '<span class="sx-receipt-name">' + esc(receipt.name || 'Receipt') + '</span>' +
      (receipt.size ? '<span class="sx-hint">' + fmtSize(receipt.size) + '</span>' : '') +
      '<button class="sx-rowlink" type="button" onclick="viewReceiptUrl(\'' + escJsUrl(receipt.url) + '\')">👁 View</button>' +
      '<button class="sx-rowbtn sx-rowbtn--danger" type="button" onclick="dropReceiptInForm()">✕ Remove</button>' +
      '</div>';
  }
  openModal(
    '<div class="sx-modal-head"><div class="sx-modal-title">🧮 ' + (existing ? 'Edit expense' : 'New expense') + ' ' + aiChip + '</div>' +
    '<button class="sx-modal-close" type="button" onclick="cancelExpenseForm()">✕</button></div>' +
    '<div class="sx-modal-body">' +
    receiptHtml +
    (p && p.confidence === 'low' ? '<div class="sx-modal-note">The AI was not sure about some fields on this receipt — check the date, amount and VAT before saving.</div>' : '') +
    '<div class="sx-form-grid">' +
    '<div class="sx-fld"><label class="sx-label">Vendor <span class="sx-req">*</span></label><input class="sx-input" type="text" id="expf-vendor" value="' + esc(vendor) + '" placeholder="Who billed us"></div>' +
    '<div class="sx-fld"><label class="sx-label">Expense date <span class="sx-req">*</span></label><input class="sx-input" type="date" id="expf-date" value="' + esc(dateV) + '"></div>' +
    '<div class="sx-fld"><label class="sx-label">Amount — gross <span class="sx-req">*</span></label><input class="sx-input" type="number" step="0.01" min="0" id="expf-amount" value="' + esc(amount) + '" oninput="expRecalc()" placeholder="0.00"></div>' +
    '<div class="sx-fld"><label class="sx-label">Currency</label><select class="sx-input sx-select" id="expf-currency" style="width:100%" onchange="expRecalc()">' + currencyOptions(cur) + '</select></div>' +
    '<div class="sx-fld"><label class="sx-label">VAT rate %</label><input class="sx-input" type="number" step="0.1" min="0" id="expf-taxrate" value="' + esc(rate) + '" oninput="expRecalc()"></div>' +
    '<div class="sx-fld"><label class="sx-label">VAT included in amount</label><input class="sx-input" type="text" id="expf-taxdisp" readonly value="—"></div>' +
    '<div class="sx-fld"><label class="sx-label">Category</label><input class="sx-input" type="text" id="expf-category" list="sx-cat-options" value="' + esc(category) + '" placeholder="e.g. Office Supplies"></div>' +
    '<div class="sx-fld"><label class="sx-label">Payment method</label><select class="sx-input sx-select" id="expf-method" style="width:100%">' + methodOptions(method) + '</select></div>' +
    '<div class="sx-fld"><label class="sx-label">Status</label><select class="sx-input sx-select" id="expf-status" style="width:100%" onchange="expStatusChanged()">' +
    '<option value="unpaid"' + (status === 'unpaid' ? ' selected' : '') + '>⏳ Unpaid</option>' +
    '<option value="paid"' + (status === 'paid' ? ' selected' : '') + '>✅ Paid</option>' +
    '</select></div>' +
    '<div class="sx-fld" id="expf-paiddate-wrap" style="' + (status === 'paid' ? '' : 'display:none') + '"><label class="sx-label">Paid date</label><input class="sx-input" type="date" id="expf-paiddate" value="' + esc(paidDate || todayISO()) + '"></div>' +
    '<div class="sx-fld sx-fld-full"><label class="sx-label">Notes</label><textarea class="sx-input" id="expf-notes" rows="2" placeholder="Invoice number, what it was for&hellip;">' + esc(notes) + '</textarea></div>' +
    '</div>' +
    '<div class="sx-form-err" id="expf-err" style="display:none"></div>' +
    '</div>' +
    '<div class="sx-modal-foot">' +
    '<button class="sx-btn sx-btn-ghost" type="button" onclick="cancelExpenseForm()">Cancel</button>' +
    '<button class="sx-btn sx-btn-primary" type="button" onclick="saveExpense()">💾 Save Expense</button>' +
    '</div>'
  );
  expRecalc();
  scheduleResize();
}
function escJsUrl(u) {
  return String(u || '').replace(/'/g, '\\u0027').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function fmtSize(bytes) {
  var b = +bytes || 0;
  if (b < 1024) return b + ' B';
  if (b < 1048576) return round2(b / 1024) + ' KB';
  return round2(b / 1048576) + ' MB';
}
function viewReceiptUrl(u) { if (u) tool.openUrl(u); }
function dropReceiptInForm() {
  _dropReceipt = true;
  if (_scan.file) { _scan.file = null; _scan.text = ''; _scan.parsed = null; _scan.stage = 'idle'; }
  renderScanCard();
  var rc = el('expf-receipt');
  if (rc) rc.style.display = 'none';
  scheduleResize();
}
function expRecalc() {
  var amount = parseNum(el('expf-amount').value);
  var rate = Math.max(0, parseNum(el('expf-taxrate').value));
  var cur = el('expf-currency').value || defCurrency();
  var tax = round2(amount * rate / (100 + rate));
  el('expf-taxdisp').value = fmtMoney(tax, cur) + '   (net ' + fmtMoney(round2(amount - tax), cur) + ')';
}
function expStatusChanged() {
  var paid = el('expf-status').value === 'paid';
  el('expf-paiddate-wrap').style.display = paid ? '' : 'none';
  if (paid && !el('expf-paiddate').value) el('expf-paiddate').value = todayISO();
  scheduleResize();
}
function cancelExpenseForm() {
  if (_scan.stage === 'ready' && _scan.file) {
    renderScanCard();
    notify('Receipt kept — you can still add it as an expense', 'info');
  } else if (_scan.file) {
    _scan = { stage: 'idle', file: null, text: '', parsed: null, error: '' };
    renderScanCard();
  }
  _scanPrefill = null;
  _dropReceipt = false;
  closeModal();
}
function saveExpense() {
  var vendor = el('expf-vendor').value.trim();
  var dateV = el('expf-date').value;
  var amount = parseNum(el('expf-amount').value);
  if (!vendor) { formErr('expf-err', 'Vendor name is required.'); return; }
  if (!validIso(dateV)) { formErr('expf-err', 'Expense date is required.'); return; }
  if (!(amount > 0)) { formErr('expf-err', 'Amount must be greater than 0.'); return; }
  var rate = Math.max(0, parseNum(el('expf-taxrate').value));
  var cur = el('expf-currency').value || defCurrency();
  var taxAmount = round2(amount * rate / (100 + rate));
  var exp = _editExpenseId ? findExpense(_editExpenseId) : null;
  var status = el('expf-status').value;
  var paidDate = status === 'paid' ? (el('expf-paiddate').value || todayISO()) : '';
  var receipt = (exp && exp.receipt) ? exp.receipt : null;
  if (_scan.file) receipt = { name: _scan.file.name, url: _scan.file.url, size: _scan.file.size || 0, type: _scan.file.type || '' };
  if (_dropReceipt) receipt = null;
  var data = {
    id: exp ? exp.id : uid('exp'),
    vendor: vendor,
    expenseDate: dateV,
    currency: cur,
    amount: amount,
    taxRate: rate,
    taxAmount: taxAmount,
    category: el('expf-category').value.trim(),
    paymentMethod: el('expf-method').value,
    status: status,
    paidDate: paidDate,
    notes: el('expf-notes').value.trim(),
    receipt: receipt,
    ocrText: _scan.text ? String(_scan.text).slice(0, 2500) : (exp ? exp.ocrText : ''),
    createdAt: exp ? exp.createdAt : new Date().toISOString(),
    createdBy: exp ? exp.createdBy : currentUserName()
  };
  if (exp) DB.expenses[DB.expenses.indexOf(exp)] = data; else DB.expenses.push(data);
  _scan = { stage: 'idle', file: null, text: '', parsed: null, error: '' };
  _scanPrefill = null;
  _dropReceipt = false;
  renderScanCard();
  persist();
  renderAll();
  closeModal();
  notify('Expense saved' + (data.receipt ? ' with receipt attached' : ''), 'success');
}

// ═══════════════════════════════════════════════════════════════
// INVOICE FORM
// ═══════════════════════════════════════════════════════════════
function openInvoiceForm(id) {
  if (!canWrite()) return;
  _editInvoiceId = id || '';
  _openInvoiceForm();
}
function _openInvoiceForm() {
  var existing = _editInvoiceId ? findInvoice(_editInvoiceId) : null;
  var issue = existing ? existing.issueDate : todayISO();
  var due = existing ? existing.dueDate : isoDay(addDays(new Date(), 14));
  var cur = existing ? existing.currency : defCurrency();
  var rate = existing ? existing.taxRate : defTaxRate();
  var customerId = existing ? existing.customerId : '';
  var titleHtml = existing
    ? '<span class="sx-chip sx-chip-slate">' + esc(existing.number) + '</span> ' + invStatusChip(invStatus(existing))
    : '<span class="sx-chip sx-chip-accent">New — will be numbered ' + esc(nextInvoiceNumber(false)) + '</span>';
  openModal(
    '<div class="sx-modal-head"><div class="sx-modal-title">🧾 ' + (existing ? 'Edit invoice' : 'New invoice') + '</div>' +
    '<button class="sx-modal-close" type="button" onclick="cancelInvoiceForm()">✕</button></div>' +
    '<div class="sx-modal-body">' +
    '<div class="sx-modal-note">' + titleHtml + '</div>' +
    '<div class="sx-form-grid">' +
    '<div class="sx-fld sx-fld-full"><label class="sx-label">Customer <span class="sx-req">*</span></label>' +
    '<select class="sx-input sx-select" id="invf-customer" style="width:100%" onchange="invfCustomerChanged()">' + customerOptions(customerId) + '</select></div>' +
    '<div class="sx-newcust-box" id="invf-newcust" style="display:none">' +
    '<div class="sx-fld"><label class="sx-label">New customer name</label><input class="sx-input" type="text" id="invf-nc-name" placeholder="Company / person"></div>' +
    '<div class="sx-fld"><label class="sx-label">Email (invoice will be sent here)</label><input class="sx-input" type="text" id="invf-nc-email" placeholder="billing@customer.com"></div>' +
    '</div>' +
    '<div class="sx-fld"><label class="sx-label">Issue date</label><input class="sx-input" type="date" id="invf-issued" value="' + esc(issue) + '"></div>' +
    '<div class="sx-fld"><label class="sx-label">Due date</label><input class="sx-input" type="date" id="invf-due" value="' + esc(due) + '"></div>' +
    '<div class="sx-fld"><label class="sx-label">Currency</label><select class="sx-input sx-select" id="invf-currency" style="width:100%" onchange="recalcInvTotals()">' + currencyOptions(cur) + '</select></div>' +
    '<div class="sx-fld"><label class="sx-label">VAT rate %</label><input class="sx-input" type="number" step="0.1" min="0" id="invf-taxrate" value="' + esc(rate) + '" oninput="recalcInvTotals()"></div>' +
    '</div>' +
    '<div class="sx-itemrow-head" style="margin-top:16px"><span>Description</span><span>Qty</span><span>Unit price</span><span></span></div>' +
    '<div id="invf-items"></div>' +
    '<button class="sx-rowbtn" type="button" onclick="addItemRow()">＋ Add line item</button>' +
    '<div class="sx-totals" id="invf-totals"></div>' +
    '<div class="sx-fld" style="margin-top:12px"><label class="sx-label">Notes (shown on the invoice)</label><textarea class="sx-input" id="invf-notes" rows="2" placeholder="Payment terms, thank-you note&hellip;">' + esc(existing ? existing.notes : '') + '</textarea></div>' +
    '<div class="sx-form-err" id="invf-err" style="display:none"></div>' +
    '</div>' +
    '<div class="sx-modal-foot">' +
    '<button class="sx-btn sx-btn-ghost" type="button" onclick="cancelInvoiceForm()">Cancel</button>' +
    '<button class="sx-btn sx-btn-primary" type="button" onclick="saveInvoice()">💾 Save Invoice</button>' +
    '</div>'
  );
  if (existing && existing.items && existing.items.length) {
    existing.items.forEach(function (it) { addItemRow(it); });
  } else {
    addItemRow(null);
  }
  recalcInvTotals();
  scheduleResize();
}
function cancelInvoiceForm() {
  _editInvoiceId = '';
  closeModal();
}
function invfCustomerChanged() {
  var sel = el('invf-customer');
  var box = el('invf-newcust');
  if (sel && box) box.style.display = sel.value === '__new' ? 'grid' : 'none';
  scheduleResize();
}
function addItemRow(data) {
  var box = el('invf-items');
  if (!box) return;
  var idx = box.querySelectorAll('.sx-itemrow').length;
  var row = document.createElement('div');
  row.className = 'sx-itemrow';
  row.setAttribute('data-idx', idx);
  row.innerHTML =
    '<input class="sx-input inv-it-desc" id="inv-it-desc-' + idx + '" placeholder="Description" value="' + esc(data ? data.desc : '') + '" oninput="recalcInvTotals()">' +
    '<input class="sx-input inv-it-qty" id="inv-it-qty-' + idx + '" type="number" min="0" step="any" placeholder="1" value="' + esc(data ? data.qty : 1) + '" oninput="recalcInvTotals()">' +
    '<input class="sx-input inv-it-price" id="inv-it-price-' + idx + '" type="number" min="0" step="0.01" placeholder="0.00" value="' + esc(data ? data.unitPrice : '') + '" oninput="recalcInvTotals()">' +
    '<button class="sx-rowbtn sx-rowbtn--danger" type="button" title="Remove row" onclick="removeItemRow(' + idx + ')">✕</button>';
  box.appendChild(row);
  scheduleResize();
}
function removeItemRow(idx) {
  var box = el('invf-items');
  var rows = box.querySelectorAll('.sx-itemrow');
  if (rows[idx]) box.removeChild(rows[idx]);
  var remain = box.querySelectorAll('.sx-itemrow');
  for (var i = 0; i < remain.length; i++) {
    remain[i].setAttribute('data-idx', i);
    var btn = remain[i].querySelector('button');
    if (btn) btn.setAttribute('onclick', 'removeItemRow(' + i + ')');
    remain[i].querySelector('.inv-it-desc').id = 'inv-it-desc-' + i;
    remain[i].querySelector('.inv-it-qty').id = 'inv-it-qty-' + i;
    remain[i].querySelector('.inv-it-price').id = 'inv-it-price-' + i;
  }
  recalcInvTotals();
  scheduleResize();
}
function collectInvoiceItems() {
  var box = el('invf-items');
  var rows = box ? box.querySelectorAll('.sx-itemrow') : [];
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    out.push({
      desc: rows[i].querySelector('.inv-it-desc').value.trim(),
      qty: parseNum(rows[i].querySelector('.inv-it-qty').value),
      unitPrice: parseNum(rows[i].querySelector('.inv-it-price').value)
    });
  }
  return out;
}
function recalcInvTotals() {
  var totals = el('invf-totals');
  if (!totals) return;
  var cur = el('invf-currency').value || defCurrency();
  var rate = Math.max(0, parseNum(el('invf-taxrate').value));
  var subtotal = 0;
  collectInvoiceItems().forEach(function (it) { subtotal += (it.qty || 0) * (it.unitPrice || 0); });
  subtotal = round2(subtotal);
  var tax = round2(subtotal * rate / 100);
  var total = round2(subtotal + tax);
  totals.innerHTML =
    '<div class="sx-total-row"><span class="lbl">Subtotal</span><span class="val">' + fmtMoney(subtotal, cur) + '</span></div>' +
    '<div class="sx-total-row"><span class="lbl">VAT (' + fmtRate(rate) + ')</span><span class="val">' + fmtMoney(tax, cur) + '</span></div>' +
    '<div class="sx-total-row grand"><span class="lbl">Total</span><span class="val">' + fmtMoney(total, cur) + '</span></div>';
}
function resolveInvoiceCustomer() {
  var sel = el('invf-customer');
  var id = sel.value;
  if (id === '__new') {
    var name = el('invf-nc-name').value.trim();
    if (!name) return '';
    var cust = {
      id: uid('cus'),
      name: name,
      email: el('invf-nc-email').value.trim(),
      taxId: '', phone: '', address: ''
    };
    DB.customers.push(cust);
    return cust.id;
  }
  return id;
}
function saveInvoice() {
  var customerId = resolveInvoiceCustomer();
  if (!customerId) { formErr('invf-err', 'Choose a customer or type a new customer name.'); return; }
  var items = collectInvoiceItems().filter(function (it) {
    return it.desc && ((parseNum(it.qty) || 0) > 0 && (parseNum(it.unitPrice) || 0) >= 0);
  });
  if (!items.length) { formErr('invf-err', 'Add at least one line item with a description and a price.'); return; }
  var issue = el('invf-issued').value;
  if (!validIso(issue)) { formErr('invf-err', 'Issue date is required.'); return; }
  var inv = _editInvoiceId ? findInvoice(_editInvoiceId) : null;
  var data = {
    id: inv ? inv.id : uid('inv'),
    number: inv ? inv.number : nextInvoiceNumber(true),
    customerId: customerId,
    customerName: (findCustomer(customerId) || {}).name || '',
    issueDate: issue,
    dueDate: el('invf-due').value,
    currency: el('invf-currency').value || defCurrency(),
    taxRate: Math.max(0, parseNum(el('invf-taxrate').value)),
    items: items,
    notes: el('invf-notes').value.trim(),
    status: inv ? inv.status : 'draft',
    paidDate: inv ? inv.paidDate : '',
    createdAt: inv ? inv.createdAt : new Date().toISOString(),
    createdBy: inv ? inv.createdBy : currentUserName()
  };
  if (inv) DB.invoices[DB.invoices.indexOf(inv)] = data; else DB.invoices.push(data);
  _editInvoiceId = '';
  persist();
  renderAll();
  closeModal();
  notify('Invoice ' + data.number + ' saved', 'success');
}

// ═══════════════════════════════════════════════════════════════
// INVOICE ACTIONS — PDF, email, mark paid, void, delete
// ═══════════════════════════════════════════════════════════════
function buildInvoiceHtml(inv) {
  var cust = inv.customerId ? findCustomer(inv.customerId) : null;
  var c = DB.company || {};
  var rows = (inv.items || []).map(function (it) {
    var line = round2((parseNum(it.qty) || 0) * (parseNum(it.unitPrice) || 0));
    return '<tr><td>' + esc(it.desc) + '</td>' +
      '<td style="text-align:center">' + esc(fmtQty(it.qty)) + '</td>' +
      '<td style="text-align:right">' + fmtMoney(it.unitPrice, inv.currency) + '</td>' +
      '<td style="text-align:right">' + fmtMoney(line, inv.currency) + '</td></tr>';
  }).join('');
  var paidStamp = invStatus(inv) === 'paid'
    ? '<div style="position:absolute;top:170px;right:40px;transform:rotate(-14deg);border:4px solid #15803d;color:#15803d;font-size:34px;font-weight:900;padding:6px 18px;border-radius:12px;opacity:.75">PAID</div>'
    : '';
  return '<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#101828;max-width:760px;margin:0 auto;padding:36px 20px">' +
    paidStamp +
    '<table style="width:100%;border-collapse:collapse"><tr>' +
    '<td><div style="font-size:22px;font-weight:800">' + esc(c.name || 'Company') + '</div>' +
    '<div style="font-size:12px;color:#64748b;line-height:1.6">' + esc(c.address || '') + (c.phone ? '<br>📞 ' + esc(c.phone) : '') + (c.email ? '<br>✉ ' + esc(c.email) : '') + (c.taxId ? '<br>Tax ID: ' + esc(c.taxId) : '') + '</div></td>' +
    '<td style="text-align:right"><div style="font-size:26px;font-weight:900;color:#4338ca">INVOICE</div>' +
    '<div style="font-size:13px;font-weight:700">' + esc(inv.number) + '</div>' +
    '<div style="font-size:12px;color:#64748b;margin-top:6px">Issued: ' + fmtDateFull(inv.issueDate) + '<br>Due: ' + fmtDateFull(inv.dueDate || '') + '<br>Status: ' + esc(invStatusLabel(invStatus(inv))) + '</div></td>' +
    '</tr></table>' +
    '<div style="margin-top:22px;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px">' +
    '<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748b">Billed to</div>' +
    '<div style="font-size:14px;font-weight:700;margin-top:3px">' + esc(inv.customerName || (cust && cust.name) || '') + '</div>' +
    (cust && (cust.address || cust.taxId) ? '<div style="font-size:12px;color:#64748b;margin-top:2px">' + esc(cust.address || '') + (cust.taxId ? ' · Tax ID: ' + esc(cust.taxId) : '') + '</div>' : '') +
    '</div>' +
    '<table style="width:100%;border-collapse:collapse;margin-top:18px;font-size:13px">' +
    '<thead><tr style="background:#4338ca;color:#fff">' +
    '<th style="padding:9px 12px;text-align:left">Description</th>' +
    '<th style="padding:9px 12px;text-align:center">Qty</th>' +
    '<th style="padding:9px 12px;text-align:right">Unit price</th>' +
    '<th style="padding:9px 12px;text-align:right">Amount</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:14px"><tr><td style="width:60%"></td><td>' +
    '<div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#64748b">Subtotal</span><b>' + fmtMoney(invSubtotal(inv), inv.currency) + '</b></div>' +
    '<div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#64748b">VAT (' + fmtRate(inv.taxRate) + ')</span><b>' + fmtMoney(invTax(inv), inv.currency) + '</b></div>' +
    '<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #101828;font-size:16px"><span style="font-weight:800">Total</span><b style="color:#4338ca">' + fmtMoney(invTotal(inv), inv.currency) + '</b></div>' +
    '</td></tr></table>' +
    (inv.notes ? '<div style="margin-top:16px;font-size:12px;color:#64748b"><b>Notes:</b> ' + esc(inv.notes) + '</div>' : '') +
    '<div style="margin-top:26px;font-size:11px;color:#94a3b8;text-align:center">Generated ' + todayISO() + ' · ' + esc(c.name || '') + '</div>' +
    '</div>';
}
function viewInvoicePdf(id) {
  var inv = findInvoice(id);
  if (!inv) return;
  if (typeof tool.requestExportPdf !== 'function') { notify('PDF export is not enabled (admin must set allowExportPdf)', 'error'); return; }
  tool.requestExportPdf({ html: buildInvoiceHtml(inv), filename: inv.number }, function (err, file) {
    if (err) { notify('PDF export failed: ' + err, 'error'); return; }
    if (file && file.url) tool.openUrl(file.url);
    else notify('Invoice opened for printing', 'success');
  });
}
function buildInvoiceEmailBody(inv) {
  return '<p>Dear customer,</p>' +
    '<p>Please find invoice <b>' + esc(inv.number) + '</b> attached, totaling <b>' + fmtMoney(invTotal(inv), inv.currency) + '</b>, due on ' + fmtDateFull(inv.dueDate || '') + '.</p>' +
    '<p style="color:#64748b;font-size:13px">Thank you for your business.</p>';
}
function emailInvoice(id) {
  var inv = findInvoice(id);
  if (!inv) return;
  if (!canWrite()) { notify('Read-only — you cannot send emails', 'warning'); return; }
  var email = invoiceEmailTarget(inv);
  if (!email) { notify('No email address — add one to the customer or in Settings', 'warning'); return; }
  if (typeof tool.requestSendEmail !== 'function') { notify('Email is not enabled (admin must set allowSendEmail)', 'error'); return; }
  function send(attachment) {
    tool.requestSendEmail({
      to: email,
      subject: 'Invoice ' + inv.number + ' from ' + (DB.company.name || 'our company'),
      title: 'Invoice ' + inv.number,
      htmlBody: buildInvoiceEmailBody(inv),
      attachments: attachment ? [attachment] : []
    }, function (err, res) {
      if (err) { notify('Email failed: ' + err, 'error'); return; }
      if (inv.status === 'draft') { inv.status = 'sent'; }
      inv.sentAt = new Date().toISOString();
      persist();
      renderAll();
      notify('Invoice emailed to ' + email, 'success');
    });
  }
  if (typeof tool.requestExportPdf !== 'function') { send(null); return; }
  tool.requestExportPdf({ html: buildInvoiceHtml(inv), filename: inv.number }, function (err, file) {
    send(err || !file ? null : { filename: file.name || inv.number + '.html', url: file.url });
  });
}
function markInvoicePaid(id) {
  var inv = findInvoice(id);
  if (!inv || !canWrite()) return;
  confirmDlg('Mark invoice paid', 'Mark invoice <b>' + esc(inv.number) + '</b> as paid today? This records the revenue for reporting.', 'Mark paid', 'ok', function () {
    inv.status = 'paid';
    inv.paidDate = todayISO();
    persist();
    renderAll();
    notify('Invoice ' + inv.number + ' marked paid', 'success');
  });
}
function markInvoiceUnpaid(id) {
  var inv = findInvoice(id);
  if (!inv || !canWrite()) return;
  confirmDlg('Reopen invoice', 'Set invoice <b>' + esc(inv.number) + '</b> back to Sent (payment not received)?', 'Reopen', 'ok', function () {
    inv.status = 'sent';
    inv.paidDate = '';
    persist();
    renderAll();
    notify('Invoice ' + inv.number + ' reopened', 'info');
  });
}
function toggleVoidInvoice(id) {
  var inv = findInvoice(id);
  if (!inv || !canWrite()) return;
  if (inv.status === 'void') {
    confirmDlg('Restore invoice', 'Restore invoice <b>' + esc(inv.number) + '</b> as a draft?', 'Restore', 'ok', function () {
      inv.status = 'draft';
      persist();
      renderAll();
      notify('Invoice ' + inv.number + ' restored', 'info');
    });
  } else {
    confirmDlg('Void invoice', 'Void invoice <b>' + esc(inv.number) + '</b>? It stays in the records but is excluded from revenue and VAT reports.', 'Void invoice', 'danger', function () {
      inv.status = 'void';
      inv.paidDate = '';
      persist();
      renderAll();
      notify('Invoice ' + inv.number + ' voided', 'info');
    });
  }
}
function deleteInvoice(id) {
  var inv = findInvoice(id);
  if (!inv || !canAdmin()) return;
  confirmDlg('Delete invoice', 'Permanently delete invoice <b>' + esc(inv.number) + '</b>? This cannot be undone.', 'Delete', 'danger', function () {
    DB.invoices = DB.invoices.filter(function (i) { return i.id !== id; });
    persist();
    renderAll();
    notify('Invoice deleted', 'info');
  });
}

// ═══════════════════════════════════════════════════════════════
// EXPENSE ACTIONS
// ═══════════════════════════════════════════════════════════════
function viewReceipt(id) {
  var e = findExpense(id);
  if (!e || !e.receipt || !e.receipt.url) { notify('No receipt file for this expense', 'info'); return; }
  tool.openUrl(e.receipt.url);
}
function markExpensePaid(id) {
  var e = findExpense(id);
  if (!e || !canWrite()) return;
  confirmDlg('Mark expense paid', 'Mark the expense from <b>' + esc(e.vendor) + '</b> as paid today?', 'Mark paid', 'ok', function () {
    e.status = 'paid';
    e.paidDate = todayISO();
    persist();
    renderAll();
    notify('Expense marked paid', 'success');
  });
}
function markExpenseUnpaid(id) {
  var e = findExpense(id);
  if (!e || !canWrite()) return;
  e.status = 'unpaid';
  e.paidDate = '';
  persist();
  renderAll();
  notify('Expense reopened as unpaid', 'info');
}
function deleteExpense(id) {
  var e = findExpense(id);
  if (!e || !canAdmin()) return;
  confirmDlg('Delete expense', 'Permanently delete the expense from <b>' + esc(e.vendor) + '</b>? This cannot be undone.', 'Delete', 'danger', function () {
    DB.expenses = DB.expenses.filter(function (x) { return x.id !== id; });
    persist();
    renderAll();
    notify('Expense deleted', 'info');
  });
}

// ═══════════════════════════════════════════════════════════════
// CUSTOMER FORM & ACTIONS
// ═══════════════════════════════════════════════════════════════
function openCustomerForm(id) {
  if (!canWrite()) return;
  _editCustomerId = id || '';
  var existing = _editCustomerId ? findCustomer(_editCustomerId) : null;
  openModal(
    '<div class="sx-modal-head"><div class="sx-modal-title">👥 ' + (existing ? 'Edit customer' : 'Add customer') + '</div>' +
    '<button class="sx-modal-close" type="button" onclick="closeModal()">✕</button></div>' +
    '<div class="sx-modal-body"><div class="sx-form-grid">' +
    '<div class="sx-fld sx-fld-full"><label class="sx-label">Name <span class="sx-req">*</span></label><input class="sx-input" type="text" id="custf-name" value="' + esc(existing ? existing.name : '') + '"></div>' +
    '<div class="sx-fld"><label class="sx-label">Email</label><input class="sx-input" type="text" id="custf-email" value="' + esc(existing ? existing.email : '') + '" placeholder="billing@customer.com"></div>' +
    '<div class="sx-fld"><label class="sx-label">Tax ID</label><input class="sx-input" type="text" id="custf-taxid" value="' + esc(existing ? existing.taxId : '') + '"></div>' +
    '<div class="sx-fld"><label class="sx-label">Phone</label><input class="sx-input" type="text" id="custf-phone" value="' + esc(existing ? existing.phone : '') + '"></div>' +
    '<div class="sx-fld sx-fld-full"><label class="sx-label">Address</label><input class="sx-input" type="text" id="custf-address" value="' + esc(existing ? existing.address : '') + '"></div>' +
    '</div>' +
    '<div class="sx-form-err" id="custf-err" style="display:none"></div>' +
    '</div>' +
    '<div class="sx-modal-foot">' +
    '<button class="sx-btn sx-btn-ghost" type="button" onclick="closeModal()">Cancel</button>' +
    '<button class="sx-btn sx-btn-primary" type="button" onclick="saveCustomer()">💾 Save Customer</button>' +
    '</div>'
  );
}
function saveCustomer() {
  var name = el('custf-name').value.trim();
  if (!name) { formErr('custf-err', 'Customer name is required.'); return; }
  var existing = _editCustomerId ? findCustomer(_editCustomerId) : null;
  var data = {
    id: existing ? existing.id : uid('cus'),
    name: name,
    email: el('custf-email').value.trim(),
    taxId: el('custf-taxid').value.trim(),
    phone: el('custf-phone').value.trim(),
    address: el('custf-address').value.trim()
  };
  if (existing) DB.customers[DB.customers.indexOf(existing)] = data; else DB.customers.push(data);
  _editCustomerId = '';
  persist();
  renderAll();
  closeModal();
  notify('Customer saved', 'success');
}
function deleteCustomer(id) {
  var c = findCustomer(id);
  if (!c || !canAdmin()) return;
  var used = DB.invoices.filter(function (i) { return i.customerId === id; }).length;
  confirmDlg('Delete customer', 'Delete <b>' + esc(c.name) + '</b>?' + (used ? ' ' + used + ' invoice(s) keep the customer name as a snapshot, so old invoices stay intact.' : ''), 'Delete', 'danger', function () {
    DB.customers = DB.customers.filter(function (x) { return x.id !== id; });
    persist();
    renderAll();
    notify('Customer deleted', 'info');
  });
}

// ═══════════════════════════════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════════════════════════════
function statCard(icon, label, value, sub, cls) {
  return '<div class="sx-stat ' + (cls || '') + '">' +
    '<div class="sx-stat-top"><span class="sx-stat-icon">' + icon + '</span><span class="sx-stat-label">' + label + '</span></div>' +
    '<div class="sx-stat-value' + (/sx-stat--(revenue|expense|vat|net)/.test(cls || '') ? ' money' : '') + '">' + value + '</div>' +
    (sub ? '<div class="sx-stat-sub">' + sub + '</div>' : '') +
    '</div>';
}
function emptyHtml(ic, title, sub) {
  return '<div class="sx-empty"><div class="sx-empty-ic">' + ic + '</div>' +
    '<div class="sx-empty-title">' + esc(title) + '</div>' +
    (sub ? '<div class="sx-empty-sub">' + esc(sub) + '</div>' : '') + '</div>';
}
function renderStats() {
  var m = todayISO().slice(0, 7);
  var open = DB.invoices.filter(function (i) { var s = invStatus(i); return s !== 'paid' && s !== 'void'; });
  var overdue = open.filter(function (i) { return invStatus(i) === 'overdue'; });
  var paidMonth = DB.invoices.filter(function (i) { return invStatus(i) === 'paid' && i.issueDate.slice(0, 7) === m; });
  var vatMonth = DB.invoices.filter(function (i) { return invStatus(i) !== 'void' && i.issueDate.slice(0, 7) === m; });
  var expMonth = DB.expenses.filter(function (e) { return e.expenseDate.slice(0, 7) === m; });
  var revenue = sumByCurrency(paidMonth, invTotal);
  var expenses = sumByCurrency(expMonth, function (e) { return parseNum(e.amount); });
  var vatOut = sumByCurrency(vatMonth, invTax);
  var vatIn = sumByCurrency(expMonth, expTax);
  var html = statCard('💰', 'Receivable now', fmtSumMap(sumByCurrency(open, invTotal)), open.length + ' open invoice' + (open.length !== 1 ? 's' : ''), 'sx-stat--open') +
    statCard('⏰', 'Overdue', fmtSumMap(sumByCurrency(overdue, invTotal)), overdue.length + ' overdue', 'sx-stat--overdue') +
    statCard('📈', 'Revenue — ' + monthLabel(m), fmtSumMap(revenue), paidMonth.length + ' paid invoice' + (paidMonth.length !== 1 ? 's' : ''), 'sx-stat--revenue') +
    statCard('💸', 'Expenses — ' + monthLabel(m), fmtSumMap(expenses), expMonth.length + ' expense' + (expMonth.length !== 1 ? 's' : ''), 'sx-stat--expense') +
    statCard('🧾', 'VAT collected — ' + monthLabel(m), fmtSumMap(vatOut), 'on issued invoices', 'sx-stat--vat') +
    statCard('⚖️', 'Net — ' + monthLabel(m), fmtSumMap({ '-': 1 }), '—', 'sx-stat--net');
  el('sx-stats').innerHTML = html;
  var netMap = {};
  Object.keys(revenue).forEach(function (c) { netMap[c] = round2((revenue[c] || 0)); });
  Object.keys(expenses).forEach(function (c) { netMap[c] = round2((netMap[c] || 0) - (expenses[c] || 0)); });
  el('sx-stats').querySelector('.sx-stat--net .sx-stat-value').innerHTML = fmtSumMap(netMap);
}
function renderDashboard() {
  var invs = DB.invoices.slice().sort(function (a, b) {
    return String(b.issueDate).localeCompare(String(a.issueDate)) || String(b.number).localeCompare(String(a.number));
  }).slice(0, 4);
  el('dash-invoices').innerHTML = invs.length ? invs.map(function (i) {
    var st = invStatus(i);
    return '<div class="sx-dash-row"><span class="sx-dash-icon">🧾</span>' +
      '<span class="sx-dash-name">' + esc(i.number) + ' · ' + esc(i.customerName || '—') + '</span>' +
      '<span class="sx-dash-date' + (st === 'overdue' ? ' sx-dash-overdue' : '') + '">' + (st === 'overdue' ? 'due ' : '') + fmtDate(i.dueDate || i.issueDate) + '</span>' +
      '<span class="sx-dash-amt">' + fmtMoney(invTotal(i), i.currency) + '</span></div>';
  }).join('') : emptyHtml('🧾', 'No invoices yet', 'Create your first invoice and send it to a customer.');
  var exps = DB.expenses.slice().sort(function (a, b) {
    return String(b.expenseDate).localeCompare(String(a.expenseDate));
  }).slice(0, 4);
  el('dash-expenses').innerHTML = exps.length ? exps.map(function (e) {
    return '<div class="sx-dash-row"><span class="sx-dash-icon">🧮</span>' +
      '<span class="sx-dash-name">' + esc(e.vendor) + (e.category ? ' · ' + esc(e.category) : '') + '</span>' +
      '<span class="sx-dash-date">' + fmtDate(e.expenseDate) + '</span>' +
      '<span class="sx-dash-amt">' + fmtMoney(e.amount, e.currency) + '</span></div>';
  }).join('') : emptyHtml('📷', 'No expenses yet', 'Scan a receipt with the camera — the AI reads it and fills in the details.');
}
function renderInvoices() {
  var q = el('inv-search').value.trim().toLowerCase();
  var f = el('inv-filter').value;
  var rows = DB.invoices.filter(function (i) {
    if (f !== 'all' && invStatus(i) !== f) return false;
    if (q) {
      var hay = (i.number + ' ' + i.customerName + ' ' + i.notes).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }).sort(function (a, b) {
    return String(b.issueDate).localeCompare(String(a.issueDate)) || String(b.number).localeCompare(String(a.number));
  });
  el('inv-list').innerHTML = rows.length ? rows.map(function (i) {
    return invoiceCard(i);
  }).join('') : emptyHtml('🧾', 'No invoices match', 'Change the filter or create a new invoice.');
}
function invoiceCard(i) {
  var st = invStatus(i);
  var viewRow = '<div class="sx-viewrow">' +
    '<button class="sx-rowlink" type="button" onclick="viewInvoicePdf(\'' + i.id + '\')">🖨 Print / PDF</button></div>';
  var actions = '<div class="sx-item-actions">';
  if (invoiceEmailTarget(i)) {
    actions += '<button class="sx-rowbtn" type="button" onclick="emailInvoice(\'' + i.id + '\')">✉ Email</button>';
  }
  if (canWrite()) {
    actions += '<button class="sx-rowbtn" type="button" onclick="openInvoiceForm(\'' + i.id + '\')">✏ Edit</button>';
    if (st === 'paid') actions += '<button class="sx-rowbtn" type="button" onclick="markInvoiceUnpaid(\'' + i.id + '\')">↩ Reopen</button>';
    else if (st !== 'void') actions += '<button class="sx-rowbtn" type="button" onclick="markInvoicePaid(\'' + i.id + '\')">✅ Mark paid</button>';
    actions += '<button class="sx-rowbtn" type="button" onclick="toggleVoidInvoice(\'' + i.id + '\')">' + (st === 'void' ? '↩ Restore' : '🚫 Void') + '</button>';
  }
  if (canAdmin()) actions += '<button class="sx-rowbtn sx-rowbtn--danger" type="button" onclick="deleteInvoice(\'' + i.id + '\')">🗑</button>';
  actions += '</div>';
  var meta = '<b>' + esc(i.customerName || '—') + '</b> · issued ' + fmtDate(i.issueDate);
  if (st !== 'paid' && st !== 'void' && i.dueDate) meta += ' · due ' + fmtDate(i.dueDate);
  if (i.paidDate) meta += ' · paid ' + fmtDate(i.paidDate);
  meta += ' · ' + (i.items || []).length + ' item' + ((i.items || []).length !== 1 ? 's' : '');
  return '<div class="sx-item sx-item--' + st + '">' +
    '<div class="sx-item-main">' +
    '<div class="sx-item-title">🧾 ' + esc(i.number) + ' ' + invStatusChip(st) + '</div>' +
    '<div class="sx-item-meta">' + meta + '</div>' +
    '<div class="sx-item-meta" style="margin-top:2px">Subtotal ' + fmtMoney(invSubtotal(i), i.currency) +
    ' · VAT ' + fmtMoney(invTax(i), i.currency) + ' (' + fmtRate(i.taxRate) + ')</div>' +
    '</div>' +
    '<div class="sx-item-right">' +
    '<div class="sx-item-amount">' + fmtMoney(invTotal(i), i.currency) + '<span class="cur">' + esc(i.currency) + '</span></div>' +
    viewRow +
    actions +
    '</div></div>';
}
function renderExpenses() {
  var q = el('exp-search').value.trim().toLowerCase();
  var f = el('exp-filter').value;
  var rows = DB.expenses.filter(function (e) {
    if (f !== 'all' && e.status !== f) return false;
    if (q) {
      var hay = (e.vendor + ' ' + e.category + ' ' + e.notes).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }).sort(function (a, b) {
    return String(b.expenseDate).localeCompare(String(a.expenseDate));
  });
  el('exp-list').innerHTML = rows.length ? rows.map(expenseCard).join('') :
    emptyHtml('📷', 'No expenses yet', 'Tap “Scan Receipt” — upload a photo of the bill and the AI reads vendor, date, amount and VAT for you.');
}
function expenseCard(e) {
  var viewRow = '<div class="sx-viewrow">';
  if (e.receipt && e.receipt.url) viewRow += '<button class="sx-rowlink" type="button" onclick="viewReceipt(\'' + e.id + '\')">📎 Receipt</button>';
  viewRow += '</div>';
  var actions = '<div class="sx-item-actions">';
  if (canWrite()) {
    actions += '<button class="sx-rowbtn" type="button" onclick="openExpenseForm(\'' + e.id + '\')">✏ Edit</button>';
    if (e.status === 'paid') actions += '<button class="sx-rowbtn" type="button" onclick="markExpenseUnpaid(\'' + e.id + '\')">↩ Unpaid</button>';
    else actions += '<button class="sx-rowbtn" type="button" onclick="markExpensePaid(\'' + e.id + '\')">✅ Mark paid</button>';
  }
  if (canAdmin()) actions += '<button class="sx-rowbtn sx-rowbtn--danger" type="button" onclick="deleteExpense(\'' + e.id + '\')">🗑</button>';
  actions += '</div>';
  var paidChip = e.status === 'paid' ? '<span class="sx-chip sx-chip-green">✅ Paid</span>' : '<span class="sx-chip sx-chip-amber">⏳ Unpaid</span>';
  var meta = '📅 ' + fmtDate(e.expenseDate);
  if (e.category) meta += ' · 🏷 ' + esc(e.category);
  meta += ' · ' + methodLabel(e.paymentMethod);
  if (e.paidDate) meta += ' · paid ' + fmtDate(e.paidDate);
  meta += ' · VAT ' + fmtMoney(expTax(e), e.currency) + ' (' + fmtRate(e.taxRate) + ')';
  if (e.ocrText) meta += ' · <span class="sx-receipt-note">🤖 read by AI</span>';
  return '<div class="sx-item sx-item--' + (e.status === 'paid' ? 'paid' : 'draft') + '">' +
    '<div class="sx-item-main">' +
    '<div class="sx-item-title">🧮 ' + esc(e.vendor || 'Expense') + ' ' + paidChip + '</div>' +
    '<div class="sx-item-meta">' + meta + '</div>' +
    (e.notes ? '<div class="sx-item-meta">' + esc(e.notes) + '</div>' : '') +
    '</div>' +
    '<div class="sx-item-right">' +
    '<div class="sx-item-amount">' + fmtMoney(e.amount, e.currency) + '<span class="cur">' + esc(e.currency) + '</span></div>' +
    viewRow +
    actions +
    '</div></div>';
}
function methodLabel(id) {
  for (var i = 0; i < PAY_METHODS.length; i++) if (PAY_METHODS[i].id === id) return PAY_METHODS[i].label;
  return id || '—';
}
function renderCustomers() {
  el('cust-list').innerHTML = DB.customers.length ? DB.customers.map(function (c) {
    var invCount = DB.invoices.filter(function (i) { return i.customerId === c.id; }).length;
    var owed = sumByCurrency(DB.invoices.filter(function (i) {
      var s = invStatus(i);
      return i.customerId === c.id && s !== 'paid' && s !== 'void';
    }), invTotal);
    var actions = '<div class="sx-item-actions">';
    if (canWrite()) actions += '<button class="sx-rowbtn" type="button" onclick="openCustomerForm(\'' + c.id + '\')">✏ Edit</button>';
    if (canAdmin()) actions += '<button class="sx-rowbtn sx-rowbtn--danger" type="button" onclick="deleteCustomer(\'' + c.id + '\')">🗑</button>';
    actions += '</div>';
    return '<div class="sx-item">' +
      '<div class="sx-item-main">' +
      '<div class="sx-item-title">👥 ' + esc(c.name) + '</div>' +
      '<div class="sx-item-meta">' +
      (c.email ? '✉ ' + esc(c.email) : '') +
      (c.email && c.phone ? ' · ' : '') + (c.phone ? '📞 ' + esc(c.phone) : '') +
      (c.taxId ? ' · Tax ID: ' + esc(c.taxId) : '') +
      '</div>' +
      '<div class="sx-item-meta">' + invCount + ' invoice' + (invCount !== 1 ? 's' : '') +
      (Object.keys(owed).length ? ' · open balance ' + fmtSumMap(owed) : '') + '</div>' +
      '</div><div class="sx-item-right">' + actions + '</div></div>';
  }).join('') : emptyHtml('👥', 'No customers yet', 'Add customers so invoices fill in automatically and can be emailed.');
}

// ── Reports ───────────────────────────────────────────────────
function reportMonths() {
  var set = {};
  function add(s) { if (s && String(s).length >= 7) set[String(s).slice(0, 7)] = 1; }
  DB.invoices.forEach(function (i) { add(i.issueDate); add(i.paidDate); });
  DB.expenses.forEach(function (e) { add(e.expenseDate); add(e.paidDate); });
  add(todayISO());
  return Object.keys(set).sort().reverse();
}
function invoicesInPeriod(ym) {
  return DB.invoices.filter(function (i) { return ym === 'all' || String(i.issueDate).slice(0, 7) === ym; });
}
function expensesInPeriod(ym) {
  return DB.expenses.filter(function (e) { return ym === 'all' || String(e.expenseDate).slice(0, 7) === ym; });
}
function periodStats(ym) {
  var invs = invoicesInPeriod(ym);
  var exps = expensesInPeriod(ym);
  var revenue = 0, vatOut = 0, outstanding = 0, expTotal = 0, vatIn = 0;
  var revMap = {}, vatOutMap = {}, outMap = {}, expMap = {}, vatInMap = {};
  function bump(map, key, val) { if (isNaN(val) || val <= 0) return; map[key] = (map[key] || 0) + val; }
  invs.forEach(function (i) {
    var c = i.currency || defCurrency();
    if (invStatus(i) === 'paid') { revenue += invTotal(i); bump(revMap, c, invTotal(i)); }
    else if (invStatus(i) !== 'void') { outstanding += invTotal(i); bump(outMap, c, invTotal(i)); }
    if (invStatus(i) !== 'void') { vatOut += invTax(i); bump(vatOutMap, c, invTax(i)); }
  });
  exps.forEach(function (e) {
    var c = e.currency || defCurrency();
    var amt = parseNum(e.amount) || 0;
    expTotal += amt; bump(expMap, c, amt);
    vatIn += expTax(e); bump(vatInMap, c, expTax(e));
  });
  return {
    revenue: round2(revenue), vatOut: round2(vatOut), outstanding: round2(outstanding),
    expenses: round2(expTotal), vatIn: round2(vatIn), net: round2(revenue - expTotal),
    revMap: revMap, outMap: outMap, vatOutMap: vatOutMap, expMap: expMap, vatInMap: vatInMap
  };
}
function renderReports() {
  var sel = el('rep-month');
  var prev = sel.value || 'all';
  var months = reportMonths();
  sel.innerHTML = '<option value="all">📅 All data</option>' +
    months.map(function (m) { return '<option value="' + m + '"' + (m === prev ? ' selected' : '') + '>' + monthLabel(m) + '</option>'; }).join('');
  var ym = sel.value;
  var s = periodStats(ym);
  var label = ym === 'all' ? 'All data' : monthLabel(ym);
  el('rep-summary').innerHTML =
    statCard('📈', 'Revenue — ' + label, fmtSumMap(s.revMap), '', 'sx-stat--revenue') +
    statCard('💰', 'Outstanding — ' + label, fmtSumMap(s.outMap), 'invoices not yet paid', 'sx-stat--open') +
    statCard('💸', 'Expenses — ' + label, fmtSumMap(s.expMap), '', 'sx-stat--expense') +
    statCard('🧾', 'VAT collected — ' + label, fmtSumMap(s.vatOutMap), 'from issued invoices', 'sx-stat--vat') +
    statCard('🧮', 'VAT paid — ' + label, fmtSumMap(s.vatInMap), 'from expense receipts', 'sx-stat--vat') +
    statCard('⚖️', 'Net — ' + label, fmtSumMap(netMapOf(s)), 'revenue minus expenses', 'sx-stat--net');
  var list = ym === 'all' ? months.slice().reverse() : [ym];
  var trs = '';
  list.forEach(function (m) {
    var st = periodStats(m);
    trs += '<tr><td class="t-name">' + monthLabel(m) + '</td>' +
      '<td class="t-amt t-pos">' + fmtSumMap(st.revMap) + '</td>' +
      '<td class="t-amt">' + fmtSumMap(st.vatOutMap) + '</td>' +
      '<td class="t-amt">' + fmtSumMap(st.expMap) + '</td>' +
      '<td class="t-amt">' + fmtSumMap(st.vatInMap) + '</td>' +
      '<td class="t-amt ' + (st.net >= 0 ? 't-pos' : 't-neg') + '">' + fmtSumMap(netMapOf(st)) + '</td></tr>';
  });
  el('rep-table-body').innerHTML = trs || '<tr><td colspan="6" style="color:#64748b">No data yet</td></tr>';
  var cats = {};
  expensesInPeriod(ym).forEach(function (e) {
    var k = e.category || 'Uncategorized';
    if (!cats[k]) cats[k] = { count: 0, amount: 0, vat: 0 };
    cats[k].count++;
    cats[k].amount += parseNum(e.amount) || 0;
    cats[k].vat += expTax(e);
  });
  var keys = Object.keys(cats).sort(function (a, b) { return cats[b].amount - cats[a].amount; });
  var grand = keys.reduce(function (acc, k) { return acc + cats[k].amount; }, 0);
  el('rep-cats-body').innerHTML = keys.length ? keys.map(function (k) {
    var share = grand > 0 ? Math.round(cats[k].amount / grand * 100) : 0;
    return '<tr><td class="t-name">' + esc(k) + '</td>' +
      '<td>' + cats[k].count + '</td>' +
      '<td class="t-amt">' + fmtMoney(round2(cats[k].amount), defCurrency()) + '</td>' +
      '<td class="t-amt">' + fmtMoney(round2(cats[k].vat), defCurrency()) + '</td>' +
      '<td>' + share + '%</td></tr>';
  }).join('') : '<tr><td colspan="5" style="color:#64748b">No expenses in this period</td></tr>';
  el('rep-cats-sub').textContent = label.toLowerCase();
}
function netMapOf(s) {
  var map = {};
  Object.keys(s.revMap).forEach(function (c) { map[c] = round2(s.revMap[c]); });
  Object.keys(s.expMap).forEach(function (c) { map[c] = round2((map[c] || 0) - s.expMap[c]); });
  return map;
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS — CSV + PDF report (for the accountant)
// ═══════════════════════════════════════════════════════════════
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
function invoiceItemsText(i) {
  return (i.items || []).map(function (it) { return it.desc + ' x' + fmtQty(it.qty) + ' @' + it.unitPrice; }).join('; ');
}
function exportInvoicesCsv() {
  if (!DB.invoices.length) { notify('No invoices to export', 'warning'); return; }
  var lines = [['Number', 'Issue date', 'Due date', 'Customer', 'Status', 'Items', 'Subtotal', 'VAT', 'Total', 'Currency', 'Paid date', 'Notes']];
  DB.invoices.slice().sort(function (a, b) { return String(b.issueDate).localeCompare(String(a.issueDate)); }).forEach(function (i) {
    lines.push([i.number, i.issueDate, i.dueDate, i.customerName, invStatusLabel(invStatus(i)), invoiceItemsText(i),
      round2(invSubtotal(i)), round2(invTax(i)), round2(invTotal(i)), i.currency, i.paidDate, i.notes]);
  });
  if (downloadCsv('invoices-' + todayISO() + '.csv', lines)) notify('Invoices CSV downloaded', 'success');
  else notify('CSV export failed in this browser', 'error');
}
function exportExpensesCsv() {
  if (!DB.expenses.length) { notify('No expenses to export', 'warning'); return; }
  var lines = [['Vendor', 'Date', 'Category', 'Amount', 'VAT', 'VAT rate', 'Currency', 'Method', 'Status', 'Paid date', 'Receipt', 'Notes']];
  DB.expenses.slice().sort(function (a, b) { return String(b.expenseDate).localeCompare(String(a.expenseDate)); }).forEach(function (e) {
    lines.push([e.vendor, e.expenseDate, e.category, e.amount, expTax(e), e.taxRate, e.currency, methodLabel(e.paymentMethod),
      e.status === 'paid' ? 'paid' : 'unpaid', e.paidDate, (e.receipt && e.receipt.name) || '', e.notes]);
  });
  if (downloadCsv('expenses-' + todayISO() + '.csv', lines)) notify('Expenses CSV downloaded', 'success');
  else notify('CSV export failed in this browser', 'error');
}
function buildReportHtml(ym) {
  var c = DB.company || {};
  var label = ym === 'all' ? 'All data' : monthLabel(ym);
  var s = periodStats(ym);
  var invRows = invoicesInPeriod(ym).slice().sort(function (a, b) { return String(b.issueDate).localeCompare(String(a.issueDate)); })
    .map(function (i) {
      return '<tr><td>' + esc(i.number) + '</td><td>' + esc(i.customerName) + '</td><td>' + fmtDateFull(i.issueDate) + '</td>' +
        '<td>' + esc(invStatusLabel(invStatus(i))) + '</td><td style="text-align:right">' + fmtMoney(invTotal(i), i.currency) + '</td></tr>';
    }).join('');
  var expRows = expensesInPeriod(ym).slice().sort(function (a, b) { return String(b.expenseDate).localeCompare(String(a.expenseDate)); })
    .map(function (e) {
      return '<tr><td>' + esc(e.vendor) + '</td><td>' + esc(e.category || '') + '</td><td>' + fmtDateFull(e.expenseDate) + '</td>' +
        '<td>' + (e.status === 'paid' ? 'Paid' : 'Unpaid') + '</td><td style="text-align:right">' + fmtMoney(e.amount, e.currency) + '</td>' +
        '<td style="text-align:right">' + fmtMoney(expTax(e), e.currency) + '</td></tr>';
    }).join('');
  var cats = {};
  expensesInPeriod(ym).forEach(function (e) {
    var k = e.category || 'Uncategorized';
    if (!cats[k]) cats[k] = { count: 0, amount: 0, vat: 0 };
    cats[k].count++;
    cats[k].amount += parseNum(e.amount) || 0;
    cats[k].vat += expTax(e);
  });
  var catRows = Object.keys(cats).sort(function (a, b) { return cats[b].amount - cats[a].amount; }).map(function (k) {
    return '<tr><td>' + esc(k) + '</td><td>' + cats[k].count + '</td>' +
      '<td style="text-align:right">' + fmtMoney(round2(cats[k].amount), defCurrency()) + '</td>' +
      '<td style="text-align:right">' + fmtMoney(round2(cats[k].vat), defCurrency()) + '</td></tr>';
  }).join('');
  var th = 'background:#4338ca;color:#fff';
  var td = 'padding:7px 10px;border-bottom:1px solid #eef2f6;font-size:12.5px';
  return '<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#101828;max-width:820px;margin:0 auto;padding:30px 18px">' +
    '<div style="font-size:22px;font-weight:800">' + esc(c.name || 'Company') + '</div>' +
    '<div style="font-size:12px;color:#64748b">' + (c.taxId ? 'Tax ID: ' + esc(c.taxId) + ' · ' : '') + esc(c.address || '') + '</div>' +
    '<div style="font-size:26px;font-weight:900;color:#4338ca;margin-top:18px">Accounting Report</div>' +
    '<div style="font-size:13px;color:#64748b;margin-bottom:16px">Period: <b>' + esc(label) + '</b> · Generated ' + todayISO() + '</div>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:20px">' +
    '<tr><td style="' + td + ';background:#f8fafc;font-weight:700">Revenue</td><td style="' + td + ';text-align:right;font-weight:800">' + fmtSumMap(s.revMap) + '</td></tr>' +
    '<tr><td style="' + td + ';background:#f8fafc;font-weight:700">VAT collected</td><td style="' + td + ';text-align:right">' + fmtSumMap(s.vatOutMap) + '</td></tr>' +
    '<tr><td style="' + td + ';background:#f8fafc;font-weight:700">Outstanding receivables</td><td style="' + td + ';text-align:right">' + fmtSumMap(s.outMap) + '</td></tr>' +
    '<tr><td style="' + td + ';background:#f8fafc;font-weight:700">Expenses</td><td style="' + td + ';text-align:right;font-weight:800">' + fmtSumMap(s.expMap) + '</td></tr>' +
    '<tr><td style="' + td + ';background:#f8fafc;font-weight:700">VAT paid</td><td style="' + td + ';text-align:right">' + fmtSumMap(s.vatInMap) + '</td></tr>' +
    '<tr><td style="' + td + ';background:#f8fafc;font-weight:700">Net</td><td style="' + td + ';text-align:right;font-weight:800">' + fmtSumMap(netMapOf(s)) + '</td></tr>' +
    '</table>' +
    '<div style="font-size:15px;font-weight:800;margin:18px 0 8px">Invoices</div>' +
    '<table style="width:100%;border-collapse:collapse">' +
    '<tr><th style="' + td + ';' + th + ';text-align:left">Number</th><th style="' + td + ';' + th + ';text-align:left">Customer</th><th style="' + td + ';' + th + ';text-align:left">Issued</th><th style="' + td + ';' + th + ';text-align:left">Status</th><th style="' + td + ';' + th + ';text-align:right">Total</th></tr>' +
    (invRows || '<tr><td style="' + td + '" colspan="5">No invoices in this period</td></tr>') +
    '</table>' +
    '<div style="font-size:15px;font-weight:800;margin:18px 0 8px">Expenses</div>' +
    '<table style="width:100%;border-collapse:collapse">' +
    '<tr><th style="' + td + ';' + th + ';text-align:left">Vendor</th><th style="' + td + ';' + th + ';text-align:left">Category</th><th style="' + td + ';' + th + ';text-align:left">Date</th><th style="' + td + ';' + th + ';text-align:left">Status</th><th style="' + td + ';' + th + ';text-align:right">Amount</th><th style="' + td + ';' + th + ';text-align:right">VAT</th></tr>' +
    (expRows || '<tr><td style="' + td + '" colspan="6">No expenses in this period</td></tr>') +
    '</table>' +
    '<div style="font-size:15px;font-weight:800;margin:18px 0 8px">Expense categories</div>' +
    '<table style="width:100%;border-collapse:collapse">' +
    '<tr><th style="' + td + ';' + th + ';text-align:left">Category</th><th style="' + td + ';' + th + '">Count</th><th style="' + td + ';' + th + ';text-align:right">Amount</th><th style="' + td + ';' + th + ';text-align:right">VAT</th></tr>' +
    (catRows || '<tr><td style="' + td + '" colspan="4">No expenses in this period</td></tr>') +
    '</table>' +
    '<div style="margin-top:24px;font-size:11px;color:#94a3b8;text-align:center">Prepared with the Simple Invoice &amp; Expense Collector</div>' +
    '</div>';
}
function exportReportPdf() {
  var ym = el('rep-month') ? el('rep-month').value : 'all';
  if (typeof tool.requestExportPdf !== 'function') { notify('PDF export is not enabled (admin must set allowExportPdf)', 'error'); return; }
  var filename = 'accounting-report-' + (ym === 'all' ? 'all' : ym);
  tool.requestExportPdf({ html: buildReportHtml(ym), filename: filename }, function (err, file) {
    if (err) { notify('PDF export failed: ' + err, 'error'); return; }
    if (file && file.url) tool.openUrl(file.url);
    else notify('Report opened for printing', 'success');
  });
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════
function fillSettingsForm() {
  var c = DB.company || {};
  el('st-name').value = c.name || '';
  el('st-taxid').value = c.taxId || '';
  el('st-email').value = c.email || '';
  el('st-phone').value = c.phone || '';
  el('st-address').value = c.address || '';
  el('st-currency').innerHTML = currencyOptions(c.currency || 'USD');
  el('st-taxrate').value = c.taxRate;
  el('st-prefix').value = c.invoicePrefix || 'INV';
  el('st-nextseq').value = parseInt(c.nextSeq, 10) || 1;
}
function saveSettings() {
  var c = DB.company;
  c.name = el('st-name').value.trim();
  c.taxId = el('st-taxid').value.trim();
  c.email = el('st-email').value.trim();
  c.phone = el('st-phone').value.trim();
  c.address = el('st-address').value.trim();
  c.currency = el('st-currency').value || 'USD';
  c.taxRate = Math.max(0, parseNum(el('st-taxrate').value));
  c.invoicePrefix = (el('st-prefix').value.trim() || 'INV');
  c.nextSeq = Math.max(1, parseInt(el('st-nextseq').value, 10) || 1);
  persist();
  notify('Settings saved', 'success');
  renderAll();
}
function resetAllData() {
  if (!canAdmin()) return;
  confirmDlg('Delete ALL data', 'This permanently removes every invoice, expense and customer stored in this tool. There is no undo — export CSVs or the PDF report first if you want a copy.', 'Delete everything', 'danger', function () {
    DB = blankDB();
    persist();
    renderAll();
    fillSettingsForm();
    notify('All data deleted', 'info');
  });
}

// ── User chip / lock banner / badges ──────────────────────────
function renderUser() {
  var chip = el('sx-user-chip');
  if (!chip) return;
  chip.textContent = _noIdentity
    ? '👤 CMS session — permissions handled by CMS'
    : (_user ? ('👤 ' + _user.name + ' · ' + roleLabel()) : '👤 Guest');
}
function updateLock() {
  var shell = el('sx-shell');
  var locked = !canWrite();
  shell.classList.toggle('sx-ro', locked);
  var b = el('sx-lock-banner');
  if (_noIdentity) {
    // Host-controlled mode: the CMS enforces permissions itself — only show
    // the banner when the host has explicitly set the form to read-only.
    b.style.display = locked ? '' : 'none';
    el('sx-lock-text').textContent = 'View only — this form is read-only in the CMS';
    return;
  }
  b.style.display = locked ? '' : 'none';
  el('sx-lock-text').textContent = !_user
    ? 'Signed-in session not detected — refresh the page if you are logged in'
    : 'View only — you need editor or admin access to make changes';
}
function updateBadges() {
  var openCount = DB.invoices.filter(function (i) { var s = invStatus(i); return s !== 'paid' && s !== 'void'; }).length;
  var b1 = el('badge-inv');
  b1.style.display = openCount ? '' : 'none';
  b1.textContent = openCount;
  var unpaidCount = DB.expenses.filter(function (e) { return e.status !== 'paid'; }).length;
  var b2 = el('badge-exp');
  b2.style.display = unpaidCount ? '' : 'none';
  b2.textContent = unpaidCount;
}

// ── Render everything ─────────────────────────────────────────
function renderAll() {
  if (!DB) return;
  buildDatalist();
  renderStats();
  renderDashboard();
  renderInvoices();
  renderExpenses();
  renderReports();
  renderCustomers();
  renderUser();
  updateBadges();
  updateLock();
  scheduleResize();
}

// ═══════════════════════════════════════════════════════════════
// SAMPLE DATA (test harness)
// ═══════════════════════════════════════════════════════════════
function loadSample() {
  var t = new Date();
  var y = t.getFullYear(), m = t.getMonth();
  function day(n) { return isoDay(new Date(y, m, n)); }
  function lastMonth(n) { return isoDay(new Date(y, m - 1, n)); }
  function lastMonth2(n) { return isoDay(new Date(y, m - 2, n)); }
  DB = {
    version: 1,
    company: {
      name: 'UniconHub Teknoloji', taxId: 'TR 123 456 7890', email: 'muhasebe@uniconhub.com',
      phone: '+90 212 555 1234', address: 'Merkez Mah. Örnek Sok. No:12, İstanbul',
      currency: 'TRY', taxRate: 18, invoicePrefix: 'INV', nextSeq: 6, seeded: true
    },
    customers: [
      { id: 'cus_acme', name: 'Acme Yapı Ltd', taxId: 'TR 987 654 3210', email: 'finans@acme.example', phone: '+90 212 111 2233', address: 'Ankara Cd. 45, İstanbul' },
      { id: 'cus_nova', name: 'Nova Danışmanlık A.Ş.', taxId: 'TR 555 666 7770', email: 'billing@nova.example', phone: '', address: '' },
      { id: 'cus_star', name: 'Star Logistics', taxId: '', email: 'ap@starlog.example', phone: '', address: '' }
    ],
    invoices: [
      {
        id: 'inv_s1', number: 'INV-' + y + '-001', customerId: 'cus_acme', customerName: 'Acme Yapı Ltd',
        issueDate: lastMonth(10), dueDate: lastMonth(24), currency: 'TRY', taxRate: 18,
        items: [
          { desc: 'Project consultancy — July', qty: 12, unitPrice: 1500 },
          { desc: 'Site inspection fee', qty: 1, unitPrice: 2500 }
        ],
        notes: 'Payment via bank transfer. Thank you!', status: 'paid', paidDate: lastMonth(26),
        createdAt: new Date().toISOString(), createdBy: 'Ada Owner'
      },
      {
        id: 'inv_s2', number: 'INV-' + y + '-002', customerId: 'cus_nova', customerName: 'Nova Danışmanlık A.Ş.',
        issueDate: day(3), dueDate: isoDay(addDays(new Date(), 11)), currency: 'TRY', taxRate: 18,
        items: [
          { desc: 'Monthly retainer — August', qty: 1, unitPrice: 8000 }
        ],
        notes: '', status: 'sent', paidDate: '',
        createdAt: new Date().toISOString(), createdBy: 'Ali Accountant'
      },
      {
        id: 'inv_s3', number: 'INV-' + y + '-003', customerId: 'cus_star', customerName: 'Star Logistics',
        issueDate: lastMonth(15), dueDate: lastMonth(29), currency: 'TRY', taxRate: 18,
        items: [
          { desc: 'Software setup & training', qty: 2, unitPrice: 4200 },
          { desc: 'Travel expenses (flat)', qty: 1, unitPrice: 980 }
        ],
        notes: 'Reminder sent twice.', status: 'sent', paidDate: '',
        createdAt: new Date().toISOString(), createdBy: 'Ada Owner'
      },
      {
        id: 'inv_s4', number: 'INV-' + y + '-004', customerId: 'cus_nova', customerName: 'Nova Danışmanlık A.Ş.',
        issueDate: todayISO(), dueDate: isoDay(addDays(new Date(), 14)), currency: 'TRY', taxRate: 18,
        items: [{ desc: 'Quarterly performance report', qty: 1, unitPrice: 6500 }],
        notes: 'Draft — not sent yet.', status: 'draft', paidDate: '',
        createdAt: new Date().toISOString(), createdBy: 'Ali Accountant'
      },
      {
        id: 'inv_s5', number: 'INV-' + y + '-005', customerId: 'cus_acme', customerName: 'Acme Yapı Ltd',
        issueDate: day(1), dueDate: day(10), currency: 'TRY', taxRate: 18,
        items: [{ desc: 'Cancelled order', qty: 1, unitPrice: 1000 }],
        notes: 'Created by mistake.', status: 'void', paidDate: '',
        createdAt: new Date().toISOString(), createdBy: 'Ada Owner'
      }
    ],
    expenses: [
      {
        id: 'exp_e1', vendor: 'Karaköy Lokantası', expenseDate: day(2), currency: 'TRY',
        amount: 1250, taxRate: 18, taxAmount: 190.68,
        category: 'Food & Dining', paymentMethod: 'card', status: 'paid', paidDate: day(2),
        notes: 'Client lunch — read by AI from the receipt photo',
        receipt: { name: 'receipt-lunch.jpg', url: '#', size: 204800, type: 'image/jpeg' },
        ocrText: 'KARAKOY LOKANTASI\nTARIH: ' + day(2) + '\nTOPILAM: 1.250,00 TL\nKDV %18: 190,68 TL',
        createdAt: new Date().toISOString(), createdBy: 'Ali Accountant'
      },
      {
        id: 'exp_e2', vendor: 'Kırtasiye Dünyası', expenseDate: day(5), currency: 'TRY',
        amount: 2499, taxRate: 18, taxAmount: 381.20,
        category: 'Office Supplies', paymentMethod: 'bank', status: 'unpaid', paidDate: '',
        notes: 'Ink, paper, folders — invoice no. KD-2281',
        receipt: { name: 'kd-2281.pdf', url: '#', size: 51200, type: 'application/pdf' },
        ocrText: '', createdAt: new Date().toISOString(), createdBy: 'Mina Manager'
      },
      {
        id: 'exp_e3', vendor: 'Petrol Ofisi', expenseDate: lastMonth(12), currency: 'TRY',
        amount: 1500, taxRate: 18, taxAmount: 228.81,
        category: 'Fuel', paymentMethod: 'card', status: 'paid', paidDate: lastMonth(12),
        notes: 'Company car fuel', receipt: null, ocrText: '',
        createdAt: new Date().toISOString(), createdBy: 'Ali Accountant'
      },
      {
        id: 'exp_e4', vendor: 'Ledgerly Software', expenseDate: lastMonth2(20), currency: 'TRY',
        amount: 299, taxRate: 0, taxAmount: 0,
        category: 'Software', paymentMethod: 'card', status: 'paid', paidDate: lastMonth2(21),
        notes: 'Annual accounting subscription (tax exempt)', receipt: null, ocrText: '',
        createdAt: new Date().toISOString(), createdBy: 'Ali Accountant'
      },
      {
        id: 'exp_e5', vendor: 'Ofis Emlak', expenseDate: day(1), currency: 'TRY',
        amount: 18000, taxRate: 0, taxAmount: 0,
        category: 'Rent', paymentMethod: 'bank', status: 'unpaid', paidDate: '',
        notes: 'August office rent', receipt: null, ocrText: '',
        createdAt: new Date().toISOString(), createdBy: 'Ada Owner'
      }
    ]
  };
  persist();
  renderAll();
  fillSettingsForm();
  notify('Sample data loaded — switch roles with the harness bar', 'success');
}

// ═══════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════
tool.onReady(function (val, fields) {
  DB = normalizeDB(val);
  _noIdentity = !hasUserApi();
  _user = getUserSafe();
  _readOnly = tool.isReadOnly ? tool.isReadOnly() : false;

  tool.declareOutput({
    type: 'object',
    properties: {
      version: { type: 'number' },
      company: { type: 'object' },
      customers: { type: 'array', items: { type: 'object' } },
      invoices: { type: 'array', items: { type: 'object' } },
      expenses: { type: 'array', items: { type: 'object' } }
    }
  });
  tool.declareParams([
    { name: 'companyName', label: 'Company Name', type: 'text', default: '', severity: 'optional', hint: 'Shown on invoices and PDF reports. Also editable in the Settings tab.' },
    { name: 'companyTaxId', label: 'Company Tax / VAT ID', type: 'text', default: '', severity: 'optional', hint: 'Tax number shown on invoices.' },
    { name: 'companyEmail', label: 'Company Email', type: 'text', default: '', severity: 'optional', hint: 'Fallback recipient when a customer has no email (for sending invoices).' },
    { name: 'defaultCurrency', label: 'Default Currency', type: 'text', default: 'USD', severity: 'optional', hint: 'e.g. TRY, USD, EUR, GBP. New invoices and expenses start with this.' },
    { name: 'defaultTaxRate', label: 'Default VAT Rate (%)', type: 'text', default: '18', severity: 'optional', hint: 'Default VAT percent on new invoices and expenses.' },
    { name: 'invoicePrefix', label: 'Invoice Number Prefix', type: 'text', default: 'INV', severity: 'optional', hint: 'Invoice numbers look like INV-2026-001.' }
  ]);

  el('sx-backdrop').addEventListener('click', function (e) {
    if (e.target && e.target.id === 'sx-backdrop') closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  tool.reportValid(true);
  fillSettingsForm();
  renderAll();

  tool.onValueChange(function (v) {
    if (_saving) { _saving = false; return; }
    DB = normalizeDB(v);
    fillSettingsForm();
    renderAll();
  });
  tool.onReadonlyChange(function (ro) {
    _readOnly = ro;
    renderAll();
  });
  tool.onUserChange(function (u) {
    _user = u || getUserSafe();
    if (_user) _noIdentity = false;
    renderAll();
  });
  tool.onFieldsChange(function () { renderUser(); });

  // The CMS may deliver the authenticated session shortly AFTER onReady
  // (the user info arrives via postMessage asynchronously). Poll briefly
  // so a signed-in user is never stuck behind the view-only lock. If the
  // session still never arrives (e.g. the dynamic-html-tool field injects
  // a reduced SDK without user APIs), fall back to host-controlled mode:
  // the CMS enforces permissions itself and the tool only respects the
  // host's read-only flag.
  [400, 1200, 2600, 5000].forEach(function (ms) {
    setTimeout(function () {
      refreshUser();
      if (!_user && ms === 5000) {
        _noIdentity = true;
        renderAll();
        notify('No session info from the CMS — edit permissions are handled by the CMS itself', 'info');
      }
    }, ms);
  });
});
