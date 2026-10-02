/* RevenueBasedInvoiceBuilder
   Invoices for a software product priced on the customer's MONTHLY TICKET REVENUE.
   The fee is computed with a waterfall (each rate applies only to the revenue inside
   its bracket) using the attached pricing agreement. One tool instance = one
   customer account. Everything is stored in tool.setValue() - no requestObjects. */
(function () {
  'use strict';

  /* ── Pricing agreement (the attached waterfall rules) ─────────────────── */
  var AGREEMENT_BRACKETS = [
    { id: 'b1', label: 'CA $0 - $20,000', from: 0, to: 20000, kind: 'minimum', fee: 300, ratePct: 0, cap: 0 },
    { id: 'b2', label: 'CA $20,001 - $75,000', from: 20000, to: 75000, kind: 'rate', fee: 0, ratePct: 1.1, cap: 550 },
    { id: 'b3', label: 'CA $75,001 - $200,000', from: 75000, to: 200000, kind: 'rate', fee: 0, ratePct: 0.8, cap: 1000 },
    { id: 'b4', label: 'CA $200,001 - $500,000', from: 200000, to: 500000, kind: 'rate', fee: 0, ratePct: 0.6, cap: 1800 },
    { id: 'b5', label: 'CA $500,001 - $1,500,000', from: 500000, to: 1500000, kind: 'rate', fee: 0, ratePct: 0.3, cap: 3000 },
    { id: 'b6', label: 'CA $1,500,001 - $3,000,000', from: 1500000, to: 3000000, kind: 'rate', fee: 0, ratePct: 0.2, cap: 3000 },
    { id: 'b7', label: 'CA $3,000,001+ - negotiated', from: 3000000, to: null, kind: 'negotiated', fee: 0, ratePct: 0, cap: 0 }
  ];
  var NEGOTIATED_FROM = 3000000;

  var CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'TRY'];
  var PAYMENT_TERMS = ['Due on receipt', 'Net 7', 'Net 15', 'Net 30'];
  var WRITE_ROLES = ['admin', 'owner', 'developer', 'user-manager', 'editor'];
  var ADMIN_ROLES = ['admin', 'owner', 'developer', 'user-manager'];
  var ROLE_POLL_DELAYS = [400, 1200, 2600, 5000];

  /* ── State ── */
  var DB = null;
  var _user = null;
  var _readOnly = false;
  var _noIdentity = false;
  var _lastStagedJson = '';
  var _persistTimer = null;
  var _warnedAutosave = false;
  var _editInvoiceId = null;
  var _armDeleteId = null;
  var _armDeleteTimer = null;
  var _editCustomerId = null;
  var _customerPricingDraft = null;
  var _armDeleteCustomerId = null;
  var _armDeleteCustomerTimer = null;
  var _formLines = [];
  var _supportTypesDraft = null;

  function el(id) { return document.getElementById(id); }

  /* ── Small helpers ── */
  function strOf(v) { return typeof v === 'string' ? v : ''; }
  function numOf(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function pad3(n) { return String(n).padStart(3, '0'); }
  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function clampNum(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function escHtml(s) {
    return strOf(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function fmtMoney(amount, currency) {
    try {
      return new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency || 'CAD' }).format(amount);
    } catch (err) {
      return (currency || 'CAD') + ' ' + Number(amount).toFixed(2);
    }
  }
  function validCurrency(c) { return CURRENCIES.indexOf(c) !== -1 ? c : 'CAD'; }
  function validPaymentTerms(t) { return PAYMENT_TERMS.indexOf(t) !== -1 ? t : 'Net 15'; }

  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function monthLabel(month) {
    var m = strOf(month);
    var parts = m.split('-');
    var year = parseInt(parts[0], 10);
    var monthIndex = parseInt(parts[1], 10) - 1;
    if (!year || isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return m;
    return MONTH_NAMES[monthIndex] + ' ' + year;
  }
  function currentMonth() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }
  function monthEndDate(month) {
    var parts = strOf(month).split('-');
    var year = parseInt(parts[0], 10);
    var monthNumber = parseInt(parts[1], 10);
    if (!year || !monthNumber) return '';
    var lastDay = new Date(year, monthNumber, 0).getDate();
    return year + '-' + String(monthNumber).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
  }
  function todayIso() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }
  function fmtDate(iso) {
    if (!iso) return '-';
    var parts = iso.slice(0, 10).split('-');
    if (parts.length !== 3) return iso;
    return parts[2] + ' ' + MONTH_NAMES[parseInt(parts[1], 10) - 1].slice(0, 3) + ' ' + parts[0];
  }

  /* ── Pricing engine (the waterfall - the heart of the tool) ───────────── */
  function copyBrackets(list) {
    return (Array.isArray(list) ? list : []).map(function (b) {
      return {
        id: strOf(b.id), label: strOf(b.label),
        from: numOf(b.from), to: b.to === null ? null : numOf(b.to),
        kind: b.kind === 'rate' || b.kind === 'minimum' ? b.kind : 'negotiated',
        fee: numOf(b.fee), ratePct: numOf(b.ratePct), cap: numOf(b.cap)
      };
    });
  }
  function normalizeBrackets(list) {
    var incoming = Array.isArray(list) ? list : [];
    var out = copyBrackets(AGREEMENT_BRACKETS);
    out.forEach(function (b, index) {
      var src = incoming[index];
      if (!src) return;
      if (b.kind === 'minimum') {
        b.fee = clampNum(numOf(src.fee), 0, 1000000);
      } else if (b.kind === 'rate') {
        b.ratePct = clampNum(numOf(src.ratePct), 0, 100);
        b.cap = clampNum(numOf(src.cap), 0, 100000000);
      }
    });
    return out;
  }

  /* Waterfall: each rate applies only to the revenue inside its bracket. */
  function calculateWaterfall(revenue, brackets, applyMinimum, negotiatedFee) {
    var rev = Math.max(0, numOf(revenue));
    var rows = [];
    var standardTotal = 0;
    var needsNegotiation = false;
    (brackets || []).forEach(function (b) {
      if (b.kind === 'negotiated') {
        if (rev > NEGOTIATED_FROM) needsNegotiation = true;
        return;
      }
      var width = Math.min(rev, b.to) - b.from;
      if (width <= 0) {
        rows.push({
          bracketId: b.id, label: b.label, kind: b.kind,
          revenueInBracket: 0, ratePct: b.ratePct, computedFee: 0, cap: b.cap,
          appliedFee: 0, capped: false
        });
        return;
      }
      if (b.kind === 'minimum') {
        var minimumApplied = applyMinimum ? b.fee : 0;
        standardTotal += minimumApplied;
        rows.push({
          bracketId: b.id, label: b.label, kind: b.kind,
          revenueInBracket: Math.min(rev, b.to), ratePct: 0, computedFee: b.fee,
          cap: 0, appliedFee: minimumApplied, capped: false
        });
        return;
      }
      var computedFee = round2(width * b.ratePct / 100);
      var capped = b.cap > 0 && computedFee > b.cap;
      var appliedFee = capped ? b.cap : computedFee;
      standardTotal += appliedFee;
      rows.push({
        bracketId: b.id, label: b.label, kind: b.kind,
        revenueInBracket: width, ratePct: b.ratePct, computedFee: computedFee,
        cap: b.cap, appliedFee: appliedFee, capped: capped
      });
    });
    var negotiatedApplied = 0;
    var negotiatedSet = false;
    if (needsNegotiation && negotiatedFee !== null && negotiatedFee !== '' && isFinite(numOf(negotiatedFee))) {
      negotiatedApplied = round2(numOf(negotiatedFee));
      negotiatedSet = true;
    }
    var fee = round2(standardTotal + negotiatedApplied);
    return {
      rows: rows,
      standardTotal: round2(standardTotal),
      needsNegotiation: needsNegotiation,
      negotiatedApplied: negotiatedApplied,
      negotiatedSet: negotiatedSet,
      fee: fee
    };
  }

  /* Maximum fee each bracket can contribute, for the cumulative-max column. */
  function cumulativeMaxes(brackets) {
    var running = 0;
    return (brackets || []).map(function (b) {
      if (b.kind === 'negotiated') return null;
      var contribution;
      if (b.kind === 'minimum') {
        contribution = b.fee;
      } else {
        var width = b.to - b.from;
        contribution = (b.cap > 0) ? Math.min(round2(width * b.ratePct / 100), b.cap) : round2(width * b.ratePct / 100);
      }
      running = round2(running + contribution);
      return running;
    });
  }

  /* ── Value normalization ── */
  function normalizeLineItem(line) {
    if (!line || typeof line !== 'object') return null;
    return {
      id: strOf(line.id) || uid('ln'),
      description: strOf(line.description),
      amount: round2(numOf(line.amount))
    };
  }

  function normalizeSupportType(supportType) {
    if (!supportType || typeof supportType !== 'object') return null;
    return {
      id: strOf(supportType.id) || uid('sup'),
      name: strOf(supportType.name),
      fee: round2(numOf(supportType.fee))
    };
  }

  /* Pure totals: tax applies to subscription fee + support fee + extra lines. */
  function computeInvoiceTotals(subscriptionFee, extraTotal, taxRate) {
    var subtotal = round2(numOf(subscriptionFee) + numOf(extraTotal));
    var taxAmount = round2(subtotal * clampNum(numOf(taxRate), 0, 100) / 100);
    return { subtotal: subtotal, taxAmount: taxAmount, total: round2(subtotal + taxAmount) };
  }

  function normalizeInvoice(inv) {
    if (!inv || typeof inv !== 'object') return null;
    var lineItems = (Array.isArray(inv.lineItems) ? inv.lineItems : []).map(normalizeLineItem).filter(function (l) { return l !== null; });
    var lineItemsTotal = lineItems.reduce(function (sum, line) { return round2(sum + line.amount); }, 0);
    var supportTypeFee = round2(numOf(inv.supportTypeFee));
    var extraTotal = inv.extraTotal === undefined || inv.extraTotal === null ? round2(lineItemsTotal + supportTypeFee) : round2(numOf(inv.extraTotal));
    var fee = round2(numOf(inv.fee));
    var subtotal = inv.subtotal === undefined || inv.subtotal === null ? round2(fee + extraTotal) : round2(numOf(inv.subtotal));
    return {
      id: strOf(inv.id) || uid('inv'),
      number: strOf(inv.number),
      month: strOf(inv.month),
      revenue: round2(numOf(inv.revenue)),
      currency: validCurrency(inv.currency),
      applyMinimum: inv.applyMinimum !== false,
      negotiatedFee: inv.negotiatedFee === null || inv.negotiatedFee === undefined || inv.negotiatedFee === '' ? null : round2(numOf(inv.negotiatedFee)),
      taxRate: clampNum(numOf(inv.taxRate), 0, 100),
      fee: fee,
      taxAmount: round2(numOf(inv.taxAmount)),
      total: round2(numOf(inv.total)),
      subtotal: subtotal,
      extraTotal: extraTotal,
      lineItems: lineItems,
      supportTypeId: strOf(inv.supportTypeId),
      supportTypeName: strOf(inv.supportTypeName),
      supportTypeFee: supportTypeFee,
      breakdown: Array.isArray(inv.breakdown) ? inv.breakdown : [],
      pricingSnapshot: inv.pricingSnapshot && typeof inv.pricingSnapshot === 'object' ? inv.pricingSnapshot : null,
      pricingSource: inv.pricingSource === 'custom' ? 'custom' : 'default',
      customerId: strOf(inv.customerId),
      customerName: strOf(inv.customerName),
      customerEmail: strOf(inv.customerEmail),
      customerAddress: strOf(inv.customerAddress),
      status: ['draft', 'sent', 'paid', 'void'].indexOf(inv.status) !== -1 ? inv.status : 'draft',
      issuedAt: strOf(inv.issuedAt),
      dueDate: strOf(inv.dueDate),
      paidAt: strOf(inv.paidAt),
      notes: strOf(inv.notes),
      createdAt: strOf(inv.createdAt),
      updatedAt: strOf(inv.updatedAt)
    };
  }

  function normalizeCustomer(customer) {
    if (!customer || typeof customer !== 'object') return null;
    var out = {
      id: strOf(customer.id) || uid('cust'),
      name: strOf(customer.name),
      email: strOf(customer.email),
      address: strOf(customer.address),
      useDefaultPricing: customer.useDefaultPricing !== false,
      pricing: null,
      createdAt: strOf(customer.createdAt),
      updatedAt: strOf(customer.updatedAt)
    };
    if (!out.useDefaultPricing && customer.pricing && typeof customer.pricing === 'object') {
      out.pricing = {
        brackets: normalizeBrackets(customer.pricing.brackets),
        negotiatedNote: strOf(customer.pricing.negotiatedNote)
      };
    }
    return out;
  }

  function normalizeValue(raw) {
    var src = (raw && typeof raw === 'object') ? raw : {};
    var customers = (Array.isArray(src.customers) ? src.customers : []).map(normalizeCustomer).filter(function (c) { return c !== null; });
    /* v1 migration: the old single customer becomes the first customer. */
    if (!customers.length) {
      var legacyCustomer = src.customer;
      if (legacyCustomer && (legacyCustomer.name || legacyCustomer.email)) {
        customers.push(normalizeCustomer({
          id: strOf(legacyCustomer.id) || uid('cust'),
          name: legacyCustomer.name,
          email: legacyCustomer.email,
          address: legacyCustomer.address,
          useDefaultPricing: true,
          pricing: null
        }));
      }
    }
    var invoices = (Array.isArray(src.invoices) ? src.invoices : []).map(normalizeInvoice).filter(function (i) { return i !== null; });
    var firstCustomer = customers[0] || null;
    invoices.forEach(function (inv) {
      if (!inv.customerId && firstCustomer) {
        inv.customerId = firstCustomer.id;
        if (!inv.customerName) inv.customerName = firstCustomer.name;
        if (!inv.customerEmail) inv.customerEmail = firstCustomer.email;
        if (!inv.customerAddress) inv.customerAddress = firstCustomer.address;
      }
    });
    return {
      version: 3,
      flags: (src.flags && typeof src.flags === 'object') ? src.flags : {},
      company: {
        name: strOf(src.company && src.company.name),
        taxId: strOf(src.company && src.company.taxId),
        email: strOf(src.company && src.company.email),
        phone: strOf(src.company && src.company.phone),
        address: strOf(src.company && src.company.address),
        logoUrl: strOf(src.company && src.company.logoUrl),
        logoName: strOf(src.company && src.company.logoName)
      },
      customers: customers,
      settings: {
        currency: validCurrency(src.settings && src.settings.currency),
        taxRate: clampNum(numOf(src.settings && src.settings.taxRate), 0, 100),
        prefix: strOf(src.settings && src.settings.prefix) || 'INV',
        nextSeq: Math.max(1, Math.floor(numOf(src.settings && src.settings.nextSeq)) || 1),
        paymentTerms: validPaymentTerms(src.settings && src.settings.paymentTerms),
        defaultCustomerId: strOf(src.settings && src.settings.defaultCustomerId),
        defaultSupportTypeId: strOf(src.settings && src.settings.defaultSupportTypeId),
        supportTypes: normalizeSupportTypes(src.settings && src.settings.supportTypes)
      },
      pricing: {
        brackets: normalizeBrackets(src.pricing && src.pricing.brackets),
        negotiatedNote: strOf(src.pricing && src.pricing.negotiatedNote)
      },
      invoices: invoices,
      ui: {
        tab: ['invoices', 'customers', 'pricing', 'settings'].indexOf(src.ui && src.ui.tab) !== -1 ? src.ui.tab : 'invoices',
        filter: ['all', 'draft', 'sent', 'paid', 'void'].indexOf(src.ui && src.ui.filter) !== -1 ? src.ui.filter : 'all'
      }
    };
  }

  /* Support types default to three familiar tiers with no fee until the
     user sets one - the default support type is simply a label on invoices. */
  function normalizeSupportTypes(list) {
    var incoming = Array.isArray(list) ? list.map(normalizeSupportType).filter(function (s) { return s !== null; }) : [];
    if (incoming.length) return incoming;
    return [
      { id: 'sup_standard', name: 'Standard', fee: 0 },
      { id: 'sup_premium', name: 'Premium', fee: 0 },
      { id: 'sup_priority', name: 'Priority', fee: 0 }
    ];
  }

  function emptyDatabase() {
    return normalizeValue({
      settings: { currency: 'CAD', taxRate: 0, prefix: 'INV', nextSeq: 1, paymentTerms: 'Net 15' }
    });
  }

  /* ── Customers and per-customer waterfalls ── */
  function findCustomerById(customerId) {
    for (var i = 0; i < DB.customers.length; i++) {
      if (DB.customers[i].id === customerId) return DB.customers[i];
    }
    return null;
  }
  /* The brackets used to bill a customer: their own waterfall when they
     customized it, otherwise the default pricing agreement. */
  function bracketsForCustomer(customerId) {
    var customer = findCustomerById(customerId);
    if (customer && !customer.useDefaultPricing && customer.pricing && customer.pricing.brackets) {
      return customer.pricing.brackets;
    }
    return DB.pricing.brackets;
  }
  function negotiatedNoteForCustomer(customerId) {
    var customer = findCustomerById(customerId);
    if (customer && !customer.useDefaultPricing && customer.pricing) {
      return customer.pricing.negotiatedNote;
    }
    return DB.pricing.negotiatedNote;
  }
  function customWaterfallCustomerCount() {
    return DB.customers.filter(function (c) { return !c.useDefaultPricing && c.pricing; }).length;
  }

  /* ── Support types ── */
  function findSupportTypeById(supportTypeId) {
    for (var i = 0; i < DB.settings.supportTypes.length; i++) {
      if (DB.settings.supportTypes[i].id === supportTypeId) return DB.settings.supportTypes[i];
    }
    return null;
  }
  /* The settings tab edits a draft; Save Settings commits it. */
  function supportTypesDraft() {
    if (!_supportTypesDraft) {
      _supportTypesDraft = DB.settings.supportTypes.map(function (s) {
        return { id: s.id, name: s.name, fee: s.fee };
      });
    }
    return _supportTypesDraft;
  }
  function renderSupportSelect(select, selectedId) {
    if (!select) return;
    select.innerHTML = DB.settings.supportTypes.map(function (s) {
      return '<option value="' + escHtml(s.id) + '">' + escHtml(s.name) + '</option>';
    }).join('');
    if (selectedId && findSupportTypeById(selectedId)) select.value = selectedId;
    else if (DB.settings.supportTypes.length) select.value = DB.settings.supportTypes[0].id;
  }
  function renderLogo() {
    var thumb = el('rbi-logo-thumb');
    var nameEl = el('rbi-logo-name');
    if (!thumb) return;
    if (DB.company.logoUrl) {
      thumb.innerHTML = '<img src="' + escHtml(DB.company.logoUrl) + '" alt="Company logo">';
    } else {
      thumb.textContent = 'No logo';
    }
    if (nameEl) nameEl.textContent = DB.company.logoName || '';
    var removeButton = el('rbi-btn-remove-logo');
    if (removeButton) removeButton.style.display = DB.company.logoUrl ? '' : 'none';
  }

  /* ── Identity and permissions ── */
  function hasUserApi() { return typeof tool.getUser === 'function'; }
  function getUserSafe() {
    try { return hasUserApi() ? tool.getUser() : null; } catch (err) { return null; }
  }
  function effectiveRoles() {
    if (!_user) return [];
    if (Array.isArray(_user.roles) && _user.roles.length) return _user.roles;
    var roles = [];
    var access = _user.effectiveAccess;
    if (access) {
      if (access.isManager) roles.push('admin');
      if (access.isEditor) roles.push('editor');
      if (access.isViewer) roles.push('viewer');
    }
    return roles;
  }
  function canWrite() {
    if (_readOnly) return false;
    if (_noIdentity) return true;
    var roles = effectiveRoles();
    return WRITE_ROLES.some(function (r) { return roles.indexOf(r) !== -1; });
  }
  function canAdmin() {
    if (_readOnly) return false;
    if (_noIdentity) return true;
    var roles = effectiveRoles();
    if (ADMIN_ROLES.some(function (r) { return roles.indexOf(r) !== -1; })) return true;
    return !!( _user && _user.effectiveAccess && _user.effectiveAccess.isManager);
  }
  function refreshUser() {
    _user = getUserSafe();
    if (!_user || !effectiveRoles().length) scheduleRolePoll(0);
  }
  function scheduleRolePoll(attemptIndex) {
    if (attemptIndex >= ROLE_POLL_DELAYS.length) {
      if (!hasUserApi() || !_user) _noIdentity = true;
      applyPermissions();
      return;
    }
    setTimeout(function () {
      _user = getUserSafe();
      if (_user && effectiveRoles().length) {
        _noIdentity = false;
        applyPermissions();
        return;
      }
      scheduleRolePoll(attemptIndex + 1);
    }, ROLE_POLL_DELAYS[attemptIndex]);
  }

  /* ── Persistence ── */
  function persist() {
    if (_persistTimer) clearTimeout(_persistTimer);
    _persistTimer = setTimeout(flushPersist, 350);
  }
  function flushPersist() {
    _persistTimer = null;
    var json = JSON.stringify(DB);
    if (json === _lastStagedJson) return;
    tool.setValue(JSON.parse(json));
    _lastStagedJson = json;
    if (typeof tool.requestSave !== 'function') return;
    if (!_warnedAutosave) {
      _warnedAutosave = true;
      tool.requestSave(function (err, ok) {
        if (err || !ok) {
          tool.notify('Changes are staged - enable autosave (allowRequestSave) in the field settings to save them automatically.', 'warning');
        }
      });
    } else {
      tool.requestSave(function () {});
    }
  }
  function persistNow() {
    if (_persistTimer) clearTimeout(_persistTimer);
    _persistTimer = null;
    flushPersist();
  }

  /* ── Permission-driven UI state ── */
  function applyPermissions() {
    var writable = canWrite();
    var admin = canAdmin();
    var shell = el('rbi-shell');
    if (shell) {
      shell.classList.toggle('rbi-ro', !writable);
      shell.classList.toggle('rbi-admin-mode', admin);
    }
    var banner = el('rbi-lock-banner');
    if (banner) banner.style.display = writable ? 'none' : 'block';
    var inputs = document.querySelectorAll('.rbi-input');
    for (var i = 0; i < inputs.length; i++) inputs[i].disabled = !writable;
    el('rbi-inv-minimum').disabled = !writable;
    el('rbi-inv-negotiated').disabled = !writable;
    el('rbi-cu-use-default').disabled = !writable;
    var priceInputs = document.querySelectorAll('.rbi-px-input');
    for (var j = 0; j < priceInputs.length; j++) priceInputs[j].disabled = !canAdmin();
    var customerPriceInputs = document.querySelectorAll('.rbi-cux-input');
    for (var k = 0; k < customerPriceInputs.length; k++) customerPriceInputs[k].disabled = !writable;
    renderModalActions();
  }

  /* ── Rendering ── */
  function renderAll() {
    renderTabs();
    renderStats();
    renderInvoices();
    renderCustomers();
    renderPricing();
    renderExampleBox();
    renderSettings();
    applyPermissions();
    tool.resize();
  }

  function renderTabs() {
    var buttons = document.querySelectorAll('#rbi-tabs .rbi-tab-btn');
    var panes = document.querySelectorAll('.rbi-pane');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('active', buttons[i].getAttribute('data-tab') === DB.ui.tab);
    }
    for (var j = 0; j < panes.length; j++) {
      panes[j].classList.toggle('active', panes[j].id === 'pane-' + DB.ui.tab);
    }
  }

  function renderStats() {
    var invoices = DB.invoices;
    var invoicedFee = 0;
    var collectedTotal = 0;
    var outstandingTotal = 0;
    var draftCount = 0;
    invoices.forEach(function (inv) {
      if (inv.status === 'void') return;
      invoicedFee += inv.fee;
      if (inv.status === 'paid') collectedTotal += inv.total;
      if (inv.status === 'sent') outstandingTotal += inv.total;
      if (inv.status === 'draft') draftCount++;
    });
    el('rbi-stats').innerHTML =
      '<div class="rbi-stat"><div class="rbi-stat-label">Invoiced fees</div><div class="rbi-stat-value rbi-stat-accent">' + fmtMoney(invoicedFee, DB.settings.currency) + '</div></div>' +
      '<div class="rbi-stat"><div class="rbi-stat-label">Outstanding</div><div class="rbi-stat-value">' + fmtMoney(outstandingTotal, DB.settings.currency) + '</div></div>' +
      '<div class="rbi-stat"><div class="rbi-stat-label">Collected</div><div class="rbi-stat-value">' + fmtMoney(collectedTotal, DB.settings.currency) + '</div></div>' +
      '<div class="rbi-stat"><div class="rbi-stat-label">Drafts</div><div class="rbi-stat-value">' + draftCount + '</div></div>';
  }

  function statusChipHtml(status) {
    return '<span class="rbi-status st-' + status + '">' + status + '</span>';
  }

  function buildInvoiceRowHtml(inv) {
    var sub = (inv.customerName ? escHtml(inv.customerName) + ' · ' : '') +
      'Revenue ' + fmtMoney(inv.revenue, inv.currency) +
      ' · Fee ' + fmtMoney(inv.fee, inv.currency) +
      (inv.taxAmount > 0 ? ' + tax ' + fmtMoney(inv.taxAmount, inv.currency) : '');
    return '<div class="rbi-row" data-act="inv-open" data-id="' + escHtml(inv.id) + '">' +
      '<div class="rbi-row-main">' +
        '<div class="rbi-row-title">' + escHtml(inv.number || 'Draft') + ' · ' + escHtml(monthLabel(inv.month)) + '</div>' +
        '<div class="rbi-row-sub">' + sub + '</div>' +
      '</div>' +
      statusChipHtml(inv.status) +
      '<strong class="rbi-row-total">' + fmtMoney(inv.total, inv.currency) + '</strong>' +
      '<div class="rbi-row-actions">' +
        '<button type="button" class="rbi-rowbtn" data-act="inv-print" data-id="' + escHtml(inv.id) + '" title="Print / save as PDF">📄</button>' +
        '<button type="button" class="rbi-rowbtn" data-act="inv-email" data-id="' + escHtml(inv.id) + '" title="Email to customer">✉️</button>' +
      '</div>' +
    '</div>';
  }

  function renderInvoices() {
    var searchText = el('rbi-inv-search').value.trim().toLowerCase();
    var filter = el('rbi-inv-filter').value;
    var list = DB.invoices.slice().sort(function (a, b) {
      if (a.month !== b.month) return a.month < b.month ? 1 : -1;
      return (a.createdAt || '') < (b.createdAt || '') ? 1 : -1;
    }).filter(function (inv) {
      if (filter !== 'all' && inv.status !== filter) return false;
      if (!searchText) return true;
      var haystack = (inv.number + ' ' + monthLabel(inv.month) + ' ' + inv.notes + ' ' + inv.customerName + ' ' + inv.revenue + ' ' + inv.total).toLowerCase();
      return haystack.indexOf(searchText) !== -1;
    });
    el('rbi-inv-list').innerHTML = list.map(buildInvoiceRowHtml).join('');
    el('rbi-inv-empty').style.display = list.length ? 'none' : 'block';
  }

  function renderPricing() {
    var brackets = DB.pricing.brackets;
    var cumulative = cumulativeMaxes(brackets);
    var writable = canWrite();
    var admin = canAdmin();
    var rowsHtml = brackets.map(function (b, index) {
      if (b.kind === 'minimum') {
        return '<tr>' +
          '<td>' + escHtml(b.label) + '</td>' +
          '<td><span class="rbi-bd-capped">Minimum fee</span></td>' +
          '<td><input type="number" min="0" step="0.01" id="rbi-px-fee-' + index + '" class="rbi-input rbi-px-input" value="' + b.fee + '"' + (admin ? '' : ' disabled') + '></td>' +
          '<td class="rbi-num-right">' + fmtMoney(cumulative[index], DB.settings.currency) + '</td>' +
        '</tr>';
      }
      if (b.kind === 'rate') {
        return '<tr>' +
          '<td>' + escHtml(b.label) + '</td>' +
          '<td><input type="number" min="0" step="0.01" id="rbi-px-rate-' + index + '" class="rbi-input rbi-px-input" value="' + b.ratePct + '"' + (admin ? '' : ' disabled') + '> %</td>' +
          '<td><input type="number" min="0" step="0.01" id="rbi-px-cap-' + index + '" class="rbi-input rbi-px-input" value="' + b.cap + '"' + (admin ? '' : ' disabled') + '></td>' +
          '<td class="rbi-num-right">' + fmtMoney(cumulative[index], DB.settings.currency) + '</td>' +
        '</tr>';
      }
      return '<tr>' +
        '<td>' + escHtml(b.label) + '</td>' +
        '<td><span class="rbi-bd-capped">Negotiated</span></td>' +
        '<td colspan="1"><input type="text" id="rbi-px-note" class="rbi-input rbi-px-input rbi-px-input-wide" placeholder="Custom - agreed per contract" value="' + escHtml(DB.pricing.negotiatedNote) + '"' + (admin ? '' : ' disabled') + '></td>' +
        '<td class="rbi-num-right">-</td>' +
      '</tr>';
    }).join('');
    el('rbi-price-body').innerHTML = rowsHtml;
    var customCount = customWaterfallCustomerCount();
    el('rbi-pricing-saved').textContent = customCount
      ? 'default waterfall - ' + customCount + ' customer(s) use their own waterfall (see the Customers tab)'
      : 'default waterfall - all customers use it';
  }

  function renderCustomers() {
    var customers = DB.customers.slice().sort(function (a, b) {
      return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
    });
    var admin = canAdmin();
    el('rbi-cu-list').innerHTML = customers.map(function (customer) {
      var custom = !customer.useDefaultPricing && customer.pricing;
      var badge = custom
        ? '<span class="rbi-cu-badge rbi-cu-badge-custom">Custom waterfall</span>'
        : '<span class="rbi-cu-badge rbi-cu-badge-default">Default waterfall</span>';
      return '<div class="rbi-row" data-act="cu-edit" data-id="' + escHtml(customer.id) + '">' +
        '<div class="rbi-row-main">' +
          '<div class="rbi-row-title">' + escHtml(customer.name) + '</div>' +
          '<div class="rbi-row-sub">' + escHtml(customer.email || 'No email') + '</div>' +
        '</div>' +
        badge +
        '<div class="rbi-row-actions">' +
          '<button type="button" class="rbi-rowbtn" data-act="cu-edit" data-id="' + escHtml(customer.id) + '">✏️ Edit</button>' +
          (admin
            ? '<button type="button" class="rbi-rowbtn rbi-rowbtn-danger" data-act="cu-delete" data-id="' + escHtml(customer.id) + '">' + (_armDeleteCustomerId === customer.id ? 'Confirm?' : '🗑 Delete') + '</button>'
            : '') +
        '</div>' +
      '</div>';
    }).join('');
    el('rbi-cu-empty').style.display = customers.length ? 'none' : 'block';
  }

  function renderExampleBox() {
    var exampleRevenue = 160000;
    var wf = calculateWaterfall(exampleRevenue, DB.pricing.brackets, true, null);
    var rowsHtml = wf.rows.filter(function (r) { return r.appliedFee > 0 || r.kind === 'minimum'; }).map(function (r) {
      var rateText = r.kind === 'minimum' ? 'Minimum' : r.ratePct + '%';
      var note = r.capped ? ' <span class="rbi-bd-capped">(capped at ' + fmtMoney(r.cap, DB.settings.currency) + ')</span>' : '';
      return '<div class="rbi-breakdown-row">' +
        '<span class="rbi-bd-label">' + escHtml(r.label) + '</span>' +
        '<span class="rbi-bd-amount">' + rateText + ' on ' + fmtMoney(r.revenueInBracket, DB.settings.currency) + note + '</span>' +
        '<span class="rbi-bd-applied">' + fmtMoney(r.appliedFee, DB.settings.currency) + '</span>' +
      '</div>';
    }).join('');
    rowsHtml += '<div class="rbi-breakdown-row"><span class="rbi-bd-label">Total</span><span class="rbi-bd-amount"></span><span class="rbi-bd-applied">' + fmtMoney(wf.fee, DB.settings.currency) + '</span></div>';
    el('rbi-example-box').innerHTML = rowsHtml;
  }

  function renderSettings() {
    el('rbi-st-name').value = DB.company.name;
    el('rbi-st-taxid').value = DB.company.taxId;
    el('rbi-st-email').value = DB.company.email;
    el('rbi-st-phone').value = DB.company.phone;
    el('rbi-st-address').value = DB.company.address;
    renderLogo();
    renderSettingsDefaultCustomer();
    renderSettingsSupportTypes();
    renderSettingsDefaultSupport();
    el('rbi-st-currency').value = DB.settings.currency;
    el('rbi-st-taxrate').value = DB.settings.taxRate;
    el('rbi-st-prefix').value = DB.settings.prefix;
    el('rbi-st-nextseq').value = DB.settings.nextSeq;
    el('rbi-st-terms').value = DB.settings.paymentTerms;
  }

  function renderSettingsDefaultCustomer() {
    var select = el('rbi-st-defaultcustomer');
    var customers = DB.customers;
    select.innerHTML = customers.map(function (customer) {
      return '<option value="' + escHtml(customer.id) + '">' + escHtml(customer.name) + '</option>';
    }).join('');
    var chosenId = DB.settings.defaultCustomerId;
    if (chosenId && findCustomerById(chosenId)) {
      select.value = chosenId;
    } else if (customers.length) {
      select.value = customers[0].id;
    }
  }

  function renderSettingsSupportTypes() {
    var draft = supportTypesDraft();
    el('rbi-support-types').innerHTML = draft.map(function (supportType, index) {
      return '<div class="rbi-sup-row">' +
        '<input type="text" class="rbi-input rbi-sup-name" id="rbi-sup-name-' + index + '" placeholder="Support type name" value="' + escHtml(supportType.name) + '">' +
        '<input type="number" min="0" step="0.01" class="rbi-input rbi-sup-fee" id="rbi-sup-fee-' + index + '" placeholder="Monthly fee" value="' + supportType.fee + '">' +
        '<button type="button" class="rbi-rowbtn rbi-rowbtn-danger" data-act="sup-remove" data-idx="' + index + '">✕</button>' +
      '</div>';
    }).join('');
    var writable = canWrite();
    for (var i = 0; i < draft.length; i++) {
      (function (index) {
        var nameInput = el('rbi-sup-name-' + index);
        var feeInput = el('rbi-sup-fee-' + index);
        nameInput.disabled = !writable;
        feeInput.disabled = !writable;
        nameInput.addEventListener('input', function () { draft[index].name = this.value; });
        feeInput.addEventListener('input', function () { draft[index].fee = round2(numOf(this.value)); });
      })(i);
    }
    el('rbi-btn-add-support-type').style.display = writable ? '' : 'none';
  }

  function renderSettingsDefaultSupport() {
    var select = el('rbi-st-defaultsupport');
    var draft = supportTypesDraft();
    select.innerHTML = draft.map(function (s) {
      return '<option value="' + escHtml(s.id) + '">' + escHtml(s.name) + '</option>';
    }).join('');
    var chosenId = DB.settings.defaultSupportTypeId;
    if (chosenId && draft.some(function (s) { return s.id === chosenId; })) select.value = chosenId;
    else if (draft.length) select.value = draft[0].id;
  }

  function addSupportType() {
    var draft = supportTypesDraft();
    draft.push({ id: uid('sup'), name: 'New support type', fee: 0 });
    renderSettingsSupportTypes();
    renderSettingsDefaultSupport();
  }

  function removeSupportType(index) {
    var draft = supportTypesDraft();
    if (draft.length <= 1) {
      tool.notify('Keep at least one support type.', 'warning');
      return;
    }
    var removed = draft[index];
    draft.splice(index, 1);
    if (DB.settings.defaultSupportTypeId === removed.id) DB.settings.defaultSupportTypeId = draft[0].id;
    renderSettingsSupportTypes();
    renderSettingsDefaultSupport();
  }

  function uploadCompanyLogo() {
    if (typeof tool.requestUpload !== 'function') {
      tool.notify('Uploads are not enabled - set allowUpload: yes in the field settings.', 'warning');
      return;
    }
    tool.requestUpload('image/*', function (err, file) {
      if (err) { tool.notify('Logo upload failed: ' + err, 'error'); return; }
      if (!file || !file.url) { tool.notify('No logo file selected.', 'warning'); return; }
      DB.company.logoUrl = file.url;
      DB.company.logoName = file.name || '';
      persistNow();
      renderSettings();
      tool.notify('Logo saved - it appears on printed invoices and emails.', 'success');
    });
  }

  function removeCompanyLogo() {
    DB.company.logoUrl = '';
    DB.company.logoName = '';
    persistNow();
    renderSettings();
    tool.notify('Logo removed.', 'info');
  }

  /* ── Breakdown (shared by the live form and saved invoices) ── */
  function buildBreakdownRowsHtml(rows, currency, negotiatedInfo) {
    var html = rows.map(function (r) {
      if (r.kind === 'negotiated') {
        return '<div class="rbi-breakdown-row rbi-bd-row-negotiated">' +
          '<span class="rbi-bd-label">CA $3,000,001+ - negotiated</span>' +
          '<span class="rbi-bd-amount">agreed fee</span>' +
          '<span class="rbi-bd-applied">' + fmtMoney(r.appliedFee, currency) + '</span>' +
        '</div>';
      }
      var rateText = r.kind === 'minimum' ? 'Minimum fee' : r.ratePct + '%';
      var capNote = r.capped ? ' <span class="rbi-bd-capped">(capped at ' + fmtMoney(r.cap, currency) + ')</span>' : '';
      return '<div class="rbi-breakdown-row">' +
        '<span class="rbi-bd-label">' + escHtml(r.label) + '</span>' +
        '<span class="rbi-bd-amount">' + rateText + ' on ' + fmtMoney(r.revenueInBracket, currency) + capNote + '</span>' +
        '<span class="rbi-bd-applied">' + fmtMoney(r.appliedFee, currency) + '</span>' +
      '</div>';
    }).join('');
    return html;
  }

  /* ── Modal ── */
  function openModal() { el('rbi-backdrop').style.display = 'flex'; tool.resize(); }
  function closeModal() {
    el('rbi-backdrop').style.display = 'none';
    _editInvoiceId = null;
    _armDeleteId = null;
    if (_armDeleteTimer) clearTimeout(_armDeleteTimer);
  }
  function findInvoiceById(id) {
    for (var i = 0; i < DB.invoices.length; i++) if (DB.invoices[i].id === id) return DB.invoices[i];
    return null;
  }

  function setFormFieldsEnabled(enabled) {
    var ids = ['rbi-inv-customer', 'rbi-inv-month', 'rbi-inv-revenue', 'rbi-inv-currency', 'rbi-inv-support', 'rbi-inv-taxrate', 'rbi-inv-due', 'rbi-inv-notes', 'rbi-inv-minimum', 'rbi-inv-negotiated'];
    ids.forEach(function (id) { el(id).disabled = !enabled; });
    el('rbi-btn-add-line').style.display = enabled ? '' : 'none';
  }

  function renderInvoiceCustomerSelect() {
    var select = el('rbi-inv-customer');
    var customers = DB.customers;
    if (!customers.length) {
      select.innerHTML = '<option value="">No customers yet - add one in the Customers tab</option>';
      return;
    }
    select.innerHTML = customers.map(function (customer) {
      return '<option value="' + escHtml(customer.id) + '">' + escHtml(customer.name) + '</option>';
    }).join('');
    var chosenId = DB.settings.defaultCustomerId;
    if (chosenId && findCustomerById(chosenId)) {
      select.value = chosenId;
    } else {
      select.value = customers[0].id;
    }
  }

  /* ── Custom invoice lines (in-memory while the modal is open) ── */
  function renderLineRows() {
    el('rbi-inv-lines').innerHTML = _formLines.map(function (line, index) {
      return '<div class="rbi-line-row">' +
        '<input type="text" class="rbi-input rbi-line-desc" id="rbi-line-desc-' + index + '" placeholder="Description (e.g. POS integration setup)" value="' + escHtml(line.description) + '">' +
        '<input type="number" min="0" step="0.01" class="rbi-input rbi-line-amt" id="rbi-line-amt-' + index + '" placeholder="0.00" value="' + line.amount + '">' +
        '<button type="button" class="rbi-rowbtn rbi-rowbtn-danger" data-act="inv-line-remove" data-idx="' + index + '">✕</button>' +
      '</div>';
    }).join('');
    var editable = canWrite() && (!_editInvoiceId || findInvoiceById(_editInvoiceId).status === 'draft');
    for (var i = 0; i < _formLines.length; i++) {
      (function (index) {
        var descInput = el('rbi-line-desc-' + index);
        var amountInput = el('rbi-line-amt-' + index);
        descInput.disabled = !editable;
        amountInput.disabled = !editable;
        descInput.addEventListener('input', function () {
          _formLines[index].description = this.value;
        });
        amountInput.addEventListener('input', function () {
          _formLines[index].amount = round2(numOf(this.value));
          liveRecalc();
        });
      })(i);
    }
  }

  function addFormLine() {
    _formLines.push({ id: uid('ln'), description: '', amount: 0 });
    renderLineRows();
    liveRecalc();
  }

  function removeFormLine(index) {
    _formLines.splice(index, 1);
    renderLineRows();
    liveRecalc();
  }

  function formLineItemsTotal() {
    return _formLines.reduce(function (sum, line) { return round2(sum + numOf(line.amount)); }, 0);
  }

  function openNewInvoiceModal() {
    _editInvoiceId = null;
    _formLines = [];
    el('rbi-modal-title').textContent = 'New Invoice';
    el('rbi-view-bar').style.display = 'none';
    setFormFieldsEnabled(true);
    renderInvoiceCustomerSelect();
    renderSupportSelect(el('rbi-inv-support'), DB.settings.defaultSupportTypeId);
    el('rbi-inv-month').value = currentMonth();
    el('rbi-inv-revenue').value = '';
    el('rbi-inv-currency').value = DB.settings.currency;
    el('rbi-inv-taxrate').value = DB.settings.taxRate;
    el('rbi-inv-due').value = monthEndDate(currentMonth());
    el('rbi-inv-minimum').checked = true;
    el('rbi-inv-negotiated').value = '';
    el('rbi-inv-notes').value = '';
    renderLineRows();
    el('rbi-inv-save').style.display = canWrite() ? '' : 'none';
    renderModalActions();
    liveRecalc();
    openModal();
  }

  function openInvoiceModal(invoiceId) {
    var inv = findInvoiceById(invoiceId);
    if (!inv) return;
    _editInvoiceId = invoiceId;
    _formLines = inv.lineItems.map(function (line) { return { id: line.id, description: line.description, amount: line.amount }; });
    var isDraft = inv.status === 'draft';
    el('rbi-modal-title').textContent = isDraft ? 'Draft Invoice' : 'Invoice';
    var viewBar = el('rbi-view-bar');
    viewBar.style.display = 'flex';
    el('rbi-view-status').innerHTML = statusChipHtml(inv.status);
    el('rbi-view-number').textContent = inv.number || 'Draft';
    el('rbi-view-dates').textContent =
      (inv.customerName ? 'Customer: ' + inv.customerName + ' · ' : '') +
      'Issued ' + fmtDate(inv.issuedAt) +
      (inv.dueDate ? ' · Due ' + fmtDate(inv.dueDate) : '') +
      (inv.paidAt ? ' · Paid ' + fmtDate(inv.paidAt) : '');

    setFormFieldsEnabled(isDraft && canWrite());
    renderInvoiceCustomerSelect();
    if (inv.customerId && findCustomerById(inv.customerId)) {
      el('rbi-inv-customer').value = inv.customerId;
    }
    renderSupportSelect(el('rbi-inv-support'), inv.supportTypeId || DB.settings.defaultSupportTypeId);
    el('rbi-inv-month').value = inv.month;
    el('rbi-inv-revenue').value = inv.revenue;
    el('rbi-inv-currency').value = inv.currency;
    el('rbi-inv-taxrate').value = inv.taxRate;
    el('rbi-inv-due').value = inv.dueDate;
    el('rbi-inv-minimum').checked = inv.applyMinimum;
    el('rbi-inv-negotiated').value = inv.negotiatedFee === null ? '' : inv.negotiatedFee;
    el('rbi-inv-notes').value = inv.notes;
    renderLineRows();
    el('rbi-inv-save').style.display = (isDraft && canWrite()) ? '' : 'none';
    renderModalActions();
    if (isDraft) {
      liveRecalc();
    } else {
      renderSavedInvoiceBreakdown(inv);
    }
    openModal();
  }

  /* Extra rows: support type and custom lines, shared by live and saved views. */
  function buildExtraRowsHtml(supportTypeName, supportTypeFee, lineItems, currency) {
    var html = '';
    if (supportTypeName) {
      html += '<div class="rbi-breakdown-row">' +
        '<span class="rbi-bd-label">Support - ' + escHtml(supportTypeName) + '</span>' +
        '<span class="rbi-bd-amount">monthly support fee</span>' +
        '<span class="rbi-bd-applied">' + fmtMoney(supportTypeFee, currency) + '</span>' +
      '</div>';
    }
    (lineItems || []).forEach(function (line) {
      html += '<div class="rbi-breakdown-row">' +
        '<span class="rbi-bd-label">' + escHtml(line.description || 'Additional line') + '</span>' +
        '<span class="rbi-bd-amount">extra line</span>' +
        '<span class="rbi-bd-applied">' + fmtMoney(line.amount, currency) + '</span>' +
      '</div>';
    });
    return html;
  }

  function renderSavedInvoiceBreakdown(inv) {
    var currency = inv.currency;
    var rows = inv.breakdown.length ? inv.breakdown : calculateWaterfall(inv.revenue, DB.pricing.brackets, inv.applyMinimum, inv.negotiatedFee).rows;
    var rowsCopy = rows.slice();
    if (inv.revenue > NEGOTIATED_FROM) {
      rowsCopy.push({ kind: 'negotiated', label: 'CA $3,000,001+ - negotiated', appliedFee: inv.negotiatedFee === null ? 0 : inv.negotiatedFee });
    }
    var waterfallHtml = buildBreakdownRowsHtml(rowsCopy, currency);
    var extrasHtml = buildExtraRowsHtml(inv.supportTypeName, inv.supportTypeFee, inv.lineItems, currency);
    var subtotal = inv.subtotal !== undefined ? inv.subtotal : round2(inv.fee + inv.extraTotal);
    var totalsHtml =
      '<div class="rbi-breakdown-row"><span class="rbi-bd-label">Subtotal (before tax)</span><span class="rbi-bd-amount"></span><span class="rbi-bd-applied">' + fmtMoney(subtotal, currency) + '</span></div>' +
      (inv.taxAmount > 0
        ? '<div class="rbi-breakdown-row"><span class="rbi-bd-label">Tax (' + inv.taxRate + '%)</span><span class="rbi-bd-amount"></span><span class="rbi-bd-applied">' + fmtMoney(inv.taxAmount, currency) + '</span></div>'
        : '');
    el('rbi-breakdown').innerHTML = waterfallHtml + extrasHtml + totalsHtml;
    el('rbi-inv-total').textContent = fmtMoney(inv.total, currency);
    el('rbi-total-label').textContent = 'Invoice total';
    el('rbi-note-tax').textContent = inv.taxAmount > 0
      ? 'Tax (' + inv.taxRate + '%) is applied on the subtotal: ' + fmtMoney(inv.taxAmount, currency) + '.'
      : 'No tax applied on this invoice.';
    el('rbi-negotiated-block').style.display = inv.revenue > NEGOTIATED_FROM ? 'block' : 'none';
    el('rbi-breakdown-sub').textContent = inv.pricingSource === 'custom'
      ? 'computed from ' + (inv.customerName || 'the customer') + "'s custom waterfall (frozen)"
      : 'computed from the default pricing agreement (frozen)';
  }

  /* Recompute the waterfall live from the form as the user types. */
  function liveRecalc() {
    var revenue = numOf(el('rbi-inv-revenue').value);
    var currency = validCurrency(el('rbi-inv-currency').value);
    var applyMinimum = el('rbi-inv-minimum').checked;
    var negotiatedInput = el('rbi-inv-negotiated').value.trim();
    var negotiatedFee = negotiatedInput === '' ? null : numOf(negotiatedInput);
    var customerId = el('rbi-inv-customer').value;
    var customer = findCustomerById(customerId);
    var brackets = bracketsForCustomer(customerId);
    var wf = calculateWaterfall(revenue, brackets, applyMinimum, negotiatedFee);

    var supportType = findSupportTypeById(el('rbi-inv-support').value);
    var supportTypeName = supportType ? supportType.name : '';
    var supportTypeFee = supportType ? supportType.fee : 0;
    var lineItemsTotal = formLineItemsTotal();
    var extraTotal = round2(supportTypeFee + lineItemsTotal);
    var taxRatePct = clampNum(numOf(el('rbi-inv-taxrate').value), 0, 100);
    var totals = computeInvoiceTotals(wf.fee, extraTotal, taxRatePct);

    el('rbi-negotiated-block').style.display = wf.needsNegotiation ? 'block' : 'none';
    el('rbi-negotiated-hint').textContent = wf.needsNegotiation
      ? 'Revenue exceeds CA $3,000,000. The agreement requires a negotiated fee for the portion above that. Enter the agreed amount - the standard waterfall still applies up to $3,000,000.'
      : '';

    var rowsWithNegotiated = wf.rows.slice();
    if (wf.needsNegotiation) {
      rowsWithNegotiated.push({ kind: 'negotiated', label: 'CA $3,000,001+ - negotiated', appliedFee: wf.negotiatedApplied });
    }
    var waterfallHtml = buildBreakdownRowsHtml(rowsWithNegotiated, currency);
    var extrasHtml = buildExtraRowsHtml(supportTypeName, supportTypeFee, _formLines, currency);
    var totalsHtml =
      '<div class="rbi-breakdown-row"><span class="rbi-bd-label">Subtotal (before tax)</span><span class="rbi-bd-amount"></span><span class="rbi-bd-applied">' + fmtMoney(totals.subtotal, currency) + '</span></div>' +
      (totals.taxAmount > 0
        ? '<div class="rbi-breakdown-row"><span class="rbi-bd-label">Tax (' + taxRatePct + '%)</span><span class="rbi-bd-amount"></span><span class="rbi-bd-applied">' + fmtMoney(totals.taxAmount, currency) + '</span></div>'
        : '');
    el('rbi-breakdown').innerHTML = waterfallHtml + extrasHtml + totalsHtml;

    el('rbi-inv-total').textContent = wf.needsNegotiation && !wf.negotiatedSet
      ? 'Enter the negotiated fee'
      : fmtMoney(totals.total, currency);
    el('rbi-total-label').textContent = wf.needsNegotiation && !wf.negotiatedSet ? 'Invoice total (needs negotiated fee)' : 'Invoice total';
    el('rbi-note-tax').textContent = totals.taxAmount > 0
      ? 'Tax (' + taxRatePct + '%) is applied on the subtotal: ' + fmtMoney(totals.taxAmount, currency) + '.'
      : 'No tax applied on this invoice.';
    if (!customer) {
      el('rbi-breakdown-sub').textContent = 'select a customer to compute the waterfall';
    } else if (customer.useDefaultPricing || !customer.pricing) {
      el('rbi-breakdown-sub').textContent = 'computed from the default pricing agreement for ' + customer.name;
    } else {
      el('rbi-breakdown-sub').textContent = 'computed from ' + customer.name + "'s custom waterfall";
    }
    return wf;
  }

  /* Action buttons rendered for the open invoice. */
  function renderModalActions() {
    var box = el('rbi-inv-actions');
    if (!box) return;
    var actions = [];
    if (_editInvoiceId) {
      var inv = findInvoiceById(_editInvoiceId);
      if (inv) {
        actions.push(buttonHtml('inv-print', '📄 Print / PDF', false));
        actions.push(buttonHtml('inv-email', '✉️ Email', false));
        if (canWrite()) {
          if (inv.status === 'draft') actions.push(buttonHtml('inv-status', '➜ Mark sent', false, 'sent'));
          if (inv.status === 'sent') actions.push(buttonHtml('inv-status', '✓ Mark paid', false, 'paid'));
          if (inv.status === 'draft') actions.push(buttonHtml('inv-duplicate', '⧉ Duplicate', false));
          if (inv.status !== 'draft') actions.push(buttonHtml('inv-duplicate', '⧉ Duplicate', false));
          if (inv.status !== 'void') actions.push(buttonHtml('inv-status', '✕ Void', false, 'void'));
        }
        if (canAdmin()) actions.push(buttonHtml('inv-delete', _armDeleteId === inv.id ? 'Confirm delete?' : '🗑 Delete', true));
      }
    }
    box.innerHTML = actions.join('');
  }
  function buttonHtml(action, label, danger, statusValue) {
    return '<button type="button" class="rbi-rowbtn' + (danger ? ' rbi-rowbtn-danger' : '') + '" data-act="' + action + '"' +
      (statusValue ? ' data-status="' + statusValue + '"' : '') +
      ' data-id="' + escHtml(_editInvoiceId || '') + '">' + label + '</button>';
  }

  /* ── Invoice operations ── */
  function assignInvoiceNumber(month) {
    var year = strOf(month).slice(0, 4) || String(new Date().getFullYear());
    var number = DB.settings.prefix + '-' + year + '-' + pad3(DB.settings.nextSeq);
    DB.settings.nextSeq += 1;
    return number;
  }

  function saveInvoiceFromForm() {
    var month = strOf(el('rbi-inv-month').value);
    if (!month) { tool.notify('Choose the billing month first.', 'error'); return; }
    var customerId = el('rbi-inv-customer').value;
    var customer = findCustomerById(customerId);
    if (!customer) {
      tool.notify('Select a customer first - add one in the Customers tab.', 'error');
      return;
    }
    var revenue = round2(numOf(el('rbi-inv-revenue').value));
    var currency = validCurrency(el('rbi-inv-currency').value);
    var taxRatePct = clampNum(numOf(el('rbi-inv-taxrate').value), 0, 100);
    var applyMinimum = el('rbi-inv-minimum').checked;
    var negotiatedInput = el('rbi-inv-negotiated').value.trim();
    var negotiatedFee = negotiatedInput === '' ? null : round2(numOf(negotiatedInput));

    var brackets = bracketsForCustomer(customerId);
    var wf = calculateWaterfall(revenue, brackets, applyMinimum, negotiatedFee);
    if (wf.needsNegotiation && !wf.negotiatedSet) {
      tool.notify('Revenue is above CA $3,000,000 - enter the negotiated fee for that portion.', 'error');
      return;
    }
    var supportType = findSupportTypeById(el('rbi-inv-support').value);
    var lineItems = _formLines
      .map(function (line) { return { id: line.id || uid('ln'), description: strOf(line.description).trim(), amount: round2(numOf(line.amount)) }; })
      .filter(function (line) { return line.description || line.amount > 0; });
    var lineItemsTotal = lineItems.reduce(function (sum, line) { return round2(sum + line.amount); }, 0);
    var supportTypeFee = supportType ? supportType.fee : 0;
    var extraTotal = round2(supportTypeFee + lineItemsTotal);
    var totals = computeInvoiceTotals(wf.fee, extraTotal, taxRatePct);
    var nowIso = new Date().toISOString();

    var existing = _editInvoiceId ? findInvoiceById(_editInvoiceId) : null;
    if (existing && existing.status !== 'draft') return;
    var inv = existing || {
      id: uid('inv'),
      status: 'draft',
      issuedAt: todayIso(),
      createdAt: nowIso
    };
    if (!inv.number) inv.number = assignInvoiceNumber(month);
    inv.month = month;
    inv.customerId = customer.id;
    inv.customerName = customer.name;
    inv.customerEmail = customer.email;
    inv.customerAddress = customer.address;
    inv.pricingSource = (customer.useDefaultPricing || !customer.pricing) ? 'default' : 'custom';
    inv.revenue = revenue;
    inv.currency = currency;
    inv.applyMinimum = applyMinimum;
    inv.negotiatedFee = wf.needsNegotiation ? wf.negotiatedApplied : null;
    inv.supportTypeId = supportType ? supportType.id : '';
    inv.supportTypeName = supportType ? supportType.name : '';
    inv.supportTypeFee = supportTypeFee;
    inv.lineItems = lineItems;
    inv.extraTotal = extraTotal;
    inv.subtotal = totals.subtotal;
    inv.taxRate = taxRatePct;
    inv.fee = wf.fee;
    inv.taxAmount = totals.taxAmount;
    inv.total = totals.total;
    inv.breakdown = wf.rows;
    inv.pricingSnapshot = {
      brackets: copyBrackets(brackets),
      negotiatedNote: negotiatedNoteForCustomer(customerId),
      pricingSource: inv.pricingSource
    };
    inv.dueDate = strOf(el('rbi-inv-due').value);
    inv.notes = strOf(el('rbi-inv-notes').value);
    inv.updatedAt = nowIso;

    if (!existing) DB.invoices.push(inv);
    persistNow();
    closeModal();
    renderAll();
    tool.notify('Invoice ' + inv.number + ' saved for ' + customer.name + '.', 'success');
  }

  function markInvoiceStatus(invoiceId, status) {
    var inv = findInvoiceById(invoiceId);
    if (!inv || inv.status === status) return;
    if (!canWrite()) return;
    inv.status = status;
    if (status === 'paid') inv.paidAt = todayIso();
    inv.updatedAt = new Date().toISOString();
    persistNow();
    renderAll();
    if (_editInvoiceId === invoiceId) openInvoiceModal(invoiceId);
    tool.notify('Invoice ' + (inv.number || 'draft') + ' marked ' + status + '.', 'success');
  }

  function duplicateInvoice(invoiceId) {
    var inv = findInvoiceById(invoiceId);
    if (!inv || !canWrite()) return;
    var copy = JSON.parse(JSON.stringify(inv));
    copy.id = uid('inv');
    copy.number = '';
    copy.status = 'draft';
    copy.issuedAt = todayIso();
    copy.paidAt = '';
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    copy.notes = inv.notes ? inv.notes + ' (copy)' : 'Copy of invoice from ' + monthLabel(inv.month);
    DB.invoices.push(copy);
    persistNow();
    renderAll();
    openInvoiceModal(copy.id);
    tool.notify('Invoice duplicated as a draft.', 'info');
  }

  function deleteInvoice(invoiceId) {
    if (!canAdmin()) return;
    if (_armDeleteId !== invoiceId) {
      _armDeleteId = invoiceId;
      renderModalActions();
      if (_armDeleteTimer) clearTimeout(_armDeleteTimer);
      _armDeleteTimer = setTimeout(function () {
        _armDeleteId = null;
        renderModalActions();
      }, 4000);
      return;
    }
    DB.invoices = DB.invoices.filter(function (inv) { return inv.id !== invoiceId; });
    persistNow();
    closeModal();
    renderAll();
    tool.notify('Invoice deleted.', 'info');
  }

  /* ── Customer management ── */
  function openCustomerModal(customerId) {
    _editCustomerId = customerId || null;
    var customer = customerId ? findCustomerById(customerId) : null;
    _customerPricingDraft = customer
      ? {
          useDefault: customer.useDefaultPricing,
          brackets: customer.pricing ? copyBrackets(customer.pricing.brackets) : copyBrackets(DB.pricing.brackets),
          negotiatedNote: customer.pricing ? customer.pricing.negotiatedNote : ''
        }
      : { useDefault: true, brackets: copyBrackets(DB.pricing.brackets), negotiatedNote: '' };
    el('rbi-cu-modal-title').textContent = customer ? 'Edit Customer' : 'Add Customer';
    el('rbi-cu-name').value = customer ? customer.name : '';
    el('rbi-cu-email').value = customer ? customer.email : '';
    el('rbi-cu-address').value = customer ? customer.address : '';
    el('rbi-cu-use-default').checked = _customerPricingDraft.useDefault;
    toggleCustomerPricingBlock();
    el('rbi-cu-backdrop').style.display = 'flex';
    tool.resize();
  }

  function closeCustomerModal() {
    el('rbi-cu-backdrop').style.display = 'none';
    _editCustomerId = null;
    _customerPricingDraft = null;
    _armDeleteCustomerId = null;
    if (_armDeleteCustomerTimer) clearTimeout(_armDeleteCustomerTimer);
  }

  function toggleCustomerPricingBlock() {
    var useDefault = el('rbi-cu-use-default').checked;
    el('rbi-cu-price-block').style.display = useDefault ? 'none' : 'block';
    if (!useDefault) renderCustomerBracketRows();
  }

  /* Renders the per-customer waterfall editor from the in-memory draft. */
  function renderCustomerBracketRows() {
    var brackets = _customerPricingDraft.brackets;
    var cumulative = cumulativeMaxes(brackets);
    el('rbi-cu-price-body').innerHTML = brackets.map(function (b, index) {
      if (b.kind === 'minimum') {
        return '<tr>' +
          '<td>' + escHtml(b.label) + '</td>' +
          '<td><span class="rbi-bd-capped">Minimum fee</span></td>' +
          '<td><input type="number" min="0" step="0.01" id="rbi-cux-fee-' + index + '" class="rbi-input rbi-cux-input" value="' + b.fee + '"></td>' +
          '<td class="rbi-num-right">' + fmtMoney(cumulative[index], DB.settings.currency) + '</td>' +
        '</tr>';
      }
      if (b.kind === 'rate') {
        return '<tr>' +
          '<td>' + escHtml(b.label) + '</td>' +
          '<td><input type="number" min="0" step="0.01" id="rbi-cux-rate-' + index + '" class="rbi-input rbi-cux-input" value="' + b.ratePct + '"> %</td>' +
          '<td><input type="number" min="0" step="0.01" id="rbi-cux-cap-' + index + '" class="rbi-input rbi-cux-input" value="' + b.cap + '"></td>' +
          '<td class="rbi-num-right">' + fmtMoney(cumulative[index], DB.settings.currency) + '</td>' +
        '</tr>';
      }
      return '<tr>' +
        '<td>' + escHtml(b.label) + '</td>' +
        '<td><span class="rbi-bd-capped">Negotiated</span></td>' +
        '<td><input type="text" id="rbi-cux-note" class="rbi-input rbi-cux-input rbi-px-input-wide" placeholder="Custom - agreed per contract" value="' + escHtml(_customerPricingDraft.negotiatedNote) + '"></td>' +
        '<td class="rbi-num-right">-</td>' +
      '</tr>';
    }).join('');
    var writable = canWrite();
    var customerPriceInputs = document.querySelectorAll('.rbi-cux-input');
    for (var k = 0; k < customerPriceInputs.length; k++) customerPriceInputs[k].disabled = !writable;
  }

  function readCustomerBracketInputs() {
    var brackets = _customerPricingDraft.brackets;
    brackets.forEach(function (b, index) {
      if (b.kind === 'minimum') {
        var feeInput = el('rbi-cux-fee-' + index);
        if (feeInput) b.fee = clampNum(numOf(feeInput.value), 0, 1000000);
      } else if (b.kind === 'rate') {
        var rateInput = el('rbi-cux-rate-' + index);
        var capInput = el('rbi-cux-cap-' + index);
        if (rateInput) b.ratePct = clampNum(numOf(rateInput.value), 0, 100);
        if (capInput) b.cap = clampNum(numOf(capInput.value), 0, 100000000);
      }
    });
    var noteInput = el('rbi-cux-note');
    if (noteInput) _customerPricingDraft.negotiatedNote = strOf(noteInput.value);
  }

  function saveCustomerModal() {
    if (!canWrite()) return;
    var name = strOf(el('rbi-cu-name').value).trim();
    if (!name) {
      tool.notify('Enter the customer name first.', 'error');
      return;
    }
    var useDefault = el('rbi-cu-use-default').checked;
    if (!useDefault) readCustomerBracketInputs();
    var existing = _editCustomerId ? findCustomerById(_editCustomerId) : null;
    var customer = existing || { id: uid('cust'), createdAt: new Date().toISOString() };
    customer.name = name;
    customer.email = strOf(el('rbi-cu-email').value).trim();
    customer.address = strOf(el('rbi-cu-address').value);
    customer.useDefaultPricing = useDefault;
    customer.pricing = useDefault
      ? null
      : { brackets: copyBrackets(_customerPricingDraft.brackets), negotiatedNote: _customerPricingDraft.negotiatedNote };
    customer.updatedAt = new Date().toISOString();
    if (!existing) {
      DB.customers.push(customer);
      if (!findCustomerById(DB.settings.defaultCustomerId)) DB.settings.defaultCustomerId = customer.id;
    }
    persistNow();
    closeCustomerModal();
    renderAll();
    tool.notify('Customer ' + customer.name + ' saved.', 'success');
  }

  function deleteCustomer(customerId) {
    if (!canAdmin()) return;
    if (_armDeleteCustomerId !== customerId) {
      _armDeleteCustomerId = customerId;
      renderCustomers();
      if (_armDeleteCustomerTimer) clearTimeout(_armDeleteCustomerTimer);
      _armDeleteCustomerTimer = setTimeout(function () {
        _armDeleteCustomerId = null;
        renderCustomers();
      }, 4000);
      return;
    }
    DB.customers = DB.customers.filter(function (customer) { return customer.id !== customerId; });
    if (DB.settings.defaultCustomerId === customerId) DB.settings.defaultCustomerId = '';
    _armDeleteCustomerId = null;
    persistNow();
    closeCustomerModal();
    renderAll();
    tool.notify('Customer deleted - their invoices keep the saved details.', 'info');
  }

  /* ── Print and email ── */
  function companyMonogramHtml() {
    var initials = (DB.company.name || 'Co')
      .split(/\s+/)
      .filter(function (word) { return word; })
      .slice(0, 2)
      .map(function (word) { return word.charAt(0).toUpperCase(); })
      .join('');
    return '<span class="monogram">' + escHtml(initials || 'Co') + '</span>';
  }

  function printWaterfallRowsHtml(inv) {
    var currency = inv.currency;
    var rows = inv.breakdown.length ? inv.breakdown : [];
    var html = '<tr class="group"><td colspan="3">Software subscription - ' + escHtml(monthLabel(inv.month)) + '</td></tr>';
    var contributingRows = rows.filter(function (r) { return r.appliedFee > 0; });
    if (inv.revenue <= 0) {
      html += '<tr class="data"><td>No subscription fee</td><td class="num">monthly ticket revenue ' + fmtMoney(0, currency) + '</td><td class="num">' + fmtMoney(0, currency) + '</td></tr>';
    } else if (!contributingRows.length) {
      html += '<tr class="data"><td>No subscription fee this month</td><td class="num">minimum waived</td><td class="num">' + fmtMoney(0, currency) + '</td></tr>';
    } else {
      html += contributingRows.map(function (r) {
        if (r.kind === 'minimum') {
          return '<tr class="data"><td>Minimum monthly fee (first $20,000)</td><td class="num">flat fee</td><td class="num">' + fmtMoney(r.appliedFee, currency) + '</td></tr>';
        }
        var capText = r.capped ? ', capped at ' + fmtMoney(r.cap, currency) : '';
        return '<tr class="data"><td>Waterfall fee - ' + escHtml(r.label) + ' (' + r.ratePct + '%' + capText + ')</td>' +
          '<td class="num">' + fmtMoney(r.revenueInBracket, currency) + ' in bracket</td>' +
          '<td class="num">' + fmtMoney(r.appliedFee, currency) + '</td></tr>';
      }).join('');
      if (inv.revenue > NEGOTIATED_FROM) {
        html += '<tr class="data"><td>Negotiated fee (above CA $3,000,000)</td><td class="num">agreed</td><td class="num">' + fmtMoney(inv.negotiatedFee === null ? 0 : inv.negotiatedFee, currency) + '</td></tr>';
      }
    }
    html += '<tr class="sub-line"><td colspan="2" class="num">Subscription fee</td><td class="num">' + fmtMoney(inv.fee, currency) + '</td></tr>';
    return html;
  }

  function printStatusPillHtml(status) {
    return '<span class="pill pill-' + status + '">' + status.toUpperCase() + '</span>';
  }

  function printExtrasRowsHtml(inv) {
    var currency = inv.currency;
    var html = '';
    if (inv.supportTypeName) {
      html += '<tr><td>Support - ' + escHtml(inv.supportTypeName) + '</td><td class="num">monthly fee</td><td class="num">' + fmtMoney(inv.supportTypeFee, currency) + '</td></tr>';
    }
    (inv.lineItems || []).forEach(function (line) {
      html += '<tr><td>' + escHtml(line.description || 'Additional line') + '</td><td class="num">one-time</td><td class="num">' + fmtMoney(line.amount, currency) + '</td></tr>';
    });
    return html;
  }

  function buildInvoicePrintHtml(inv) {
    var currency = inv.currency;
    var company = DB.company;
    var customerName = inv.customerName || (findCustomerById(inv.customerId) || {}).name || 'Customer';
    var customerAddress = inv.customerAddress || (findCustomerById(inv.customerId) || {}).address || '';
    var customerEmail = inv.customerEmail || (findCustomerById(inv.customerId) || {}).email || '';
    var waterfallRows = printWaterfallRowsHtml(inv);
    var extrasRows = printExtrasRowsHtml(inv);
    var subtotal = inv.subtotal !== undefined ? inv.subtotal : round2(inv.fee + inv.extraTotal);
    var logoHtml = company.logoUrl
      ? '<img class="logo" src="' + escHtml(company.logoUrl) + '" alt="' + escHtml(company.name) + '">'
      : companyMonogramHtml();
    return '<html><head><meta charset="utf-8"><title>Invoice ' + escHtml(inv.number || 'Draft') + '</title><style>' +
      'body{font-family:Helvetica,Arial,sans-serif;color:#0f172a;margin:0;background:#eef2f7;font-size:12.5px}' +
      '.page{max-width:720px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dde4ee}' +
      '.band{background:linear-gradient(120deg,#4f46e5,#4338ca);color:#ffffff;padding:26px 30px;display:flex;justify-content:space-between;align-items:center}' +
      '.band .left{display:flex;align-items:center;gap:14px}' +
      '.logo{max-height:56px;max-width:180px;object-fit:contain}' +
      '.monogram{width:52px;height:52px;border-radius:12px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.35);display:inline-flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;letter-spacing:1px}' +
      '.band .co{font-size:17px;font-weight:800}' +
      '.band .co-sub{font-size:10.5px;opacity:.85;margin-top:3px}' +
      '.band .right{text-align:right}' +
      '.inv-title{font-size:27px;font-weight:800;letter-spacing:3px}' +
      '.inv-no{font-size:12px;opacity:.9;margin-top:4px}' +
      '.pill{display:inline-block;margin-top:8px;font-size:9px;font-weight:800;letter-spacing:1.4px;padding:4px 12px;border-radius:999px;text-transform:uppercase;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.4)}' +
      '.body{padding:30px 36px}' +
      '.meta{display:flex;gap:20px;justify-content:space-between;flex-wrap:wrap;margin-bottom:22px}' +
      '.meta-box{flex:1;min-width:170px}' +
      '.meta-box h4{font-size:9.5px;text-transform:uppercase;letter-spacing:1.2px;color:#94a3b8;margin:0 0 6px;font-weight:800}' +
      '.meta-box .v{font-size:12.5px;line-height:1.55}' +
      '.lines{width:100%;border-collapse:collapse}' +
      '.lines th{text-align:left;padding:9px 14px;background:#f1f5f9;color:#64748b;font-size:9.5px;text-transform:uppercase;letter-spacing:1px;border:none}' +
      '.lines td{padding:9px 14px;border-bottom:1px solid #eef2f7;vertical-align:top}' +
      '.lines tr:last-child td{border-bottom:none}' +
      '.lines tr.data:nth-child(even) td{background:#fbfdfe}' +
      '.lines td.num{text-align:right;white-space:nowrap}' +
      '.lines tr.group td{background:#f8fafc;font-weight:800;color:#475569;font-size:10px;text-transform:uppercase;letter-spacing:.8px;padding-top:12px}' +
      '.lines tr.data td{font-size:12.5px}' +
      '.lines tr.sub-line td{font-weight:700;color:#0f172a}' +
      '.totals{width:100%;border-collapse:collapse;margin-top:12px}' +
      '.totals td{padding:5px 12px;border:none;font-size:12.5px;color:#475569}' +
      '.totals td.num{text-align:right}' +
      '.totals tr.total td{font-size:17px;font-weight:800;color:#4f46e5;border-top:2px solid #e2e8f0;padding-top:10px}' +
      '.notes{margin-top:16px;background:#f8fafc;border-radius:10px;padding:12px 14px;font-size:11.5px;color:#475569;line-height:1.6}' +
      '.footer{margin-top:22px;text-align:center;color:#94a3b8;font-size:10.5px;padding-bottom:26px}' +
      '@media print{body{background:#ffffff}.page{border:none;border-radius:0;max-width:none}}' +
      '</style></head><body><div class="page">' +
      '<div class="band">' +
        '<div class="left">' + logoHtml +
          '<div><div class="co">' + escHtml(company.name || 'Your Company') + '</div>' +
          '<div class="co-sub">' + escHtml(company.address) + '</div></div>' +
        '</div>' +
        '<div class="right"><div class="inv-title">INVOICE</div>' +
        '<div class="inv-no">' + escHtml(inv.number || 'Draft') + '</div>' +
        printStatusPillHtml(inv.status) + '</div>' +
      '</div>' +
      '<div class="body">' +
        '<div class="meta">' +
          '<div class="meta-box"><h4>Billed to</h4><div class="v">' + escHtml(customerName) + '<br>' + escHtml(customerAddress) + (customerEmail ? '<br>' + escHtml(customerEmail) : '') + '</div></div>' +
          '<div class="meta-box"><h4>Invoice details</h4><div class="v">Issued ' + fmtDate(inv.issuedAt) + '<br>Due ' + fmtDate(inv.dueDate || '-') + '<br>Terms ' + escHtml(DB.settings.paymentTerms) + '</div></div>' +
          '<div class="meta-box"><h4>Provider</h4><div class="v">' + escHtml(company.email || '') + (company.phone ? '<br>' + escHtml(company.phone) : '') + (company.taxId ? '<br>Tax / GST ID: ' + escHtml(company.taxId) : '') + '</div></div>' +
        '</div>' +
        '<table class="lines">' +
        '<tr><th>Description</th><th class="num">Detail</th><th class="num">Amount</th></tr>' +
        waterfallRows +
        extrasRows +
        '</table>' +
        '<table class="totals">' +
        '<tr><td class="num">Subtotal</td><td class="num">' + fmtMoney(subtotal, currency) + '</td></tr>' +
        (inv.taxAmount > 0 ? '<tr><td class="num">Tax (' + inv.taxRate + '%)</td><td class="num">' + fmtMoney(inv.taxAmount, currency) + '</td></tr>' : '') +
        '<tr class="total"><td class="num">Total due</td><td class="num">' + fmtMoney(inv.total, currency) + '</td></tr>' +
        '</table>' +
        (inv.notes ? '<div class="notes">' + escHtml(inv.notes) + '</div>' : '') +
        '<div class="footer">Questions about this invoice? ' + escHtml(company.email || '') + (company.phone ? ' · ' + escHtml(company.phone) : '') + '</div>' +
        '<div class="footer" style="margin-top:6px">Thank you for your business. · ' + escHtml(company.name || '') + '</div>' +
      '</div>' +
      '</div></body></html>';
  }

  function buildEmailHtml(inv) {
    var currency = inv.currency;
    var company = DB.company;
    var customerName = inv.customerName || (findCustomerById(inv.customerId) || {}).name || 'Customer';
    var waterfallRows = printWaterfallRowsHtml(inv).replace(/class="(group|data|sub-line)"/g, 'style="font-size:12px"');
    var extrasRows = printExtrasRowsHtml(inv);
    var subtotal = inv.subtotal !== undefined ? inv.subtotal : round2(inv.fee + inv.extraTotal);
    var logoCell = company.logoUrl
      ? '<img src="' + escHtml(company.logoUrl) + '" alt="" style="max-height:44px;max-width:160px">'
      : '<span style="font-size:18px;font-weight:800;color:#4f46e5">' + escHtml(company.name || '') + '</span>';
    return '<p>Dear ' + escHtml(customerName) + ',</p>' +
      '<p>Please find invoice <strong>' + escHtml(inv.number || 'Draft') + '</strong> for ' + escHtml(monthLabel(inv.month)) + ' below.</p>' +
      '<table border="0" cellpadding="10" cellspacing="0" style="border-collapse:collapse;font-size:13px;background:#ffffff">' +
      '<tr><td style="border-bottom:1px solid #eef2f7">' + logoCell + '</td><td align="right" style="border-bottom:1px solid #eef2f7;color:#4f46e5;font-weight:800;font-size:16px">INVOICE</td></tr>' +
      '<tr style="background:#f1f5f9"><td><strong>Description</strong></td><td align="right"><strong>Detail</strong></td><td align="right"><strong>Amount</strong></td></tr>' +
      waterfallRows +
      extrasRows +
      '<tr><td align="right" colspan="2">Subtotal</td><td align="right">' + fmtMoney(subtotal, currency) + '</td></tr>' +
      (inv.taxAmount > 0 ? '<tr><td align="right" colspan="2">Tax (' + inv.taxRate + '%)</td><td align="right">' + fmtMoney(inv.taxAmount, currency) + '</td></tr>' : '') +
      '<tr style="border-top:2px solid #e2e8f0"><td align="right" colspan="2"><strong style="color:#4f46e5">Total due</strong></td><td align="right"><strong style="color:#4f46e5">' + fmtMoney(inv.total, currency) + '</strong></td></tr>' +
      '</table>' +
      (inv.dueDate ? '<p>Due date: ' + fmtDate(inv.dueDate) + '</p>' : '') +
      '<p>' + escHtml(DB.settings.paymentTerms) + '. Thank you for your business.</p>';
  }

  function printInvoice(invoiceId) {
    var inv = findInvoiceById(invoiceId);
    if (!inv) return;
    tool.requestExportPdf({
      html: buildInvoicePrintHtml(inv),
      filename: inv.number || 'invoice-draft'
    }, function (err, file) {
      if (err) { tool.notify('Export failed: ' + err, 'error'); return; }
      tool.notify('Invoice opened for printing - use Print to save as PDF.', 'success');
      tool.openUrl(file.url);
    });
  }

  function emailInvoice(invoiceId) {
    var inv = findInvoiceById(invoiceId);
    if (!inv) return;
    var customer = findCustomerById(inv.customerId);
    var recipientEmail = (inv.customerEmail || (customer ? customer.email : '') || '').trim();
    if (!recipientEmail) {
      tool.notify('The customer has no email - edit the customer in the Customers tab.', 'warning');
      return;
    }
    tool.requestSendEmail({
      to: recipientEmail,
      subject: 'Invoice ' + (inv.number || 'Draft') + ' - ' + monthLabel(inv.month),
      title: 'Invoice ' + (inv.number || 'Draft'),
      htmlBody: buildEmailHtml(inv)
    }, function (err, result) {
      if (err) { tool.notify('Email failed: ' + err, 'error'); return; }
      tool.notify('Invoice emailed to ' + recipientEmail + '.', 'success');
    });
  }

  /* ── Settings ── */
  function saveSettings() {
    DB.company.name = strOf(el('rbi-st-name').value);
    DB.company.taxId = strOf(el('rbi-st-taxid').value);
    DB.company.email = strOf(el('rbi-st-email').value);
    DB.company.phone = strOf(el('rbi-st-phone').value);
    DB.company.address = strOf(el('rbi-st-address').value);
    var defaultCustomerId = el('rbi-st-defaultcustomer').value;
    DB.settings.defaultCustomerId = findCustomerById(defaultCustomerId) ? defaultCustomerId : '';
    if (_supportTypesDraft) {
      DB.settings.supportTypes = _supportTypesDraft
        .map(function (s) { return { id: s.id, name: strOf(s.name).trim() || 'Support', fee: round2(numOf(s.fee)) }; })
        .filter(function (s) { return s.name; });
      if (!DB.settings.supportTypes.length) DB.settings.supportTypes = normalizeSupportTypes(null);
    }
    var defaultSupportId = el('rbi-st-defaultsupport').value;
    DB.settings.defaultSupportTypeId = findSupportTypeById(defaultSupportId) ? defaultSupportId : DB.settings.supportTypes[0].id;
    DB.settings.currency = validCurrency(el('rbi-st-currency').value);
    DB.settings.taxRate = clampNum(numOf(el('rbi-st-taxrate').value), 0, 100);
    DB.settings.prefix = strOf(el('rbi-st-prefix').value).trim() || 'INV';
    DB.settings.nextSeq = Math.max(1, Math.floor(numOf(el('rbi-st-nextseq').value)) || 1);
    DB.settings.paymentTerms = validPaymentTerms(el('rbi-st-terms').value);
    _supportTypesDraft = null;
    persistNow();
    renderAll();
    tool.notify('Settings saved.', 'success');
  }

  function savePricing() {
    if (!canAdmin()) return;
    var brackets = DB.pricing.brackets;
    brackets.forEach(function (b, index) {
      if (b.kind === 'minimum') {
        var feeInput = el('rbi-px-fee-' + index);
        if (feeInput) b.fee = clampNum(numOf(feeInput.value), 0, 1000000);
      } else if (b.kind === 'rate') {
        var rateInput = el('rbi-px-rate-' + index);
        var capInput = el('rbi-px-cap-' + index);
        if (rateInput) b.ratePct = clampNum(numOf(rateInput.value), 0, 100);
        if (capInput) b.cap = clampNum(numOf(capInput.value), 0, 100000000);
      }
    });
    var noteInput = el('rbi-px-note');
    if (noteInput) DB.pricing.negotiatedNote = strOf(noteInput.value);
    persistNow();
    renderPricing();
    renderExampleBox();
    tool.notify('Pricing saved. Existing invoices keep the amounts they were issued with.', 'success');
  }

  function resetPricingToAgreement() {
    if (!canAdmin()) return;
    DB.pricing.brackets = copyBrackets(AGREEMENT_BRACKETS);
    DB.pricing.negotiatedNote = '';
    persistNow();
    renderPricing();
    renderExampleBox();
    tool.notify('Pricing reset to the agreement defaults.', 'success');
  }

  function resetAllData() {
    if (!canAdmin()) return;
    var button = el('rbi-btn-reset-data');
    if (button.getAttribute('data-armed') !== '1') {
      button.setAttribute('data-armed', '1');
      button.textContent = '⚠️ Click again to confirm - this deletes everything';
      setTimeout(function () {
        button.setAttribute('data-armed', '0');
        button.textContent = '🗑 Delete All Data';
      }, 4000);
      return;
    }
    DB = emptyDatabase();
    _lastStagedJson = '';
    persistNow();
    renderAll();
    tool.notify('All data deleted - the tool is fresh.', 'info');
  }

  /* ── Params seeding (one-time) ── */
  function seedFromParams() {
    if (DB.flags.seeded) return;
    var seeds = [
      { param: 'companyName', setter: function (v) { if (!DB.company.name && v) DB.company.name = v; } },
      { param: 'companyTaxId', setter: function (v) { if (!DB.company.taxId && v) DB.company.taxId = v; } },
      { param: 'companyEmail', setter: function (v) { if (!DB.company.email && v) DB.company.email = v; } },
      { param: 'customerName', setter: function (v) {
          if (!v) return;
          var firstCustomer = DB.customers[0] || { id: uid('cust'), createdAt: new Date().toISOString(), useDefaultPricing: true, pricing: null };
          if (!firstCustomer.name) firstCustomer.name = v;
          if (DB.customers.indexOf(firstCustomer) === -1) DB.customers.push(firstCustomer);
        } },
      { param: 'customerEmail', setter: function (v) {
          if (!v) return;
          var firstCustomer = DB.customers[0] || { id: uid('cust'), createdAt: new Date().toISOString(), useDefaultPricing: true, pricing: null };
          if (!firstCustomer.email) firstCustomer.email = v;
          if (DB.customers.indexOf(firstCustomer) === -1) DB.customers.push(firstCustomer);
        } },
      { param: 'defaultCurrency', setter: function (v) { if (v && CURRENCIES.indexOf(v) !== -1) DB.settings.currency = v; } },
      { param: 'defaultTaxRate', setter: function (v) { if (v !== '' && v !== null) DB.settings.taxRate = clampNum(numOf(v), 0, 100); } },
      { param: 'invoicePrefix', setter: function (v) { if (v) DB.settings.prefix = v; } },
      { param: 'paymentTerms', setter: function (v) { if (v && PAYMENT_TERMS.indexOf(v) !== -1) DB.settings.paymentTerms = v; } }
    ];
    seeds.forEach(function (seed) {
      var value = tool.param(seed.param, '');
      seed.setter(value);
    });
    DB.flags.seeded = true;
    persist();
  }

  /* ── Event wiring ── */
  function wireEvents() {
    var tabButtons = document.querySelectorAll('#rbi-tabs .rbi-tab-btn');
    for (var i = 0; i < tabButtons.length; i++) {
      tabButtons[i].addEventListener('click', function () {
        switchTab(this.getAttribute('data-tab'));
      });
    }
    el('rbi-inv-search').addEventListener('input', renderInvoices);
    el('rbi-inv-filter').addEventListener('change', function () {
      DB.ui.filter = this.value;
      renderInvoices();
      persist();
    });
    el('rbi-btn-new-invoice').addEventListener('click', function () {
      if (!canWrite()) return;
      if (!DB.customers.length) {
        tool.notify('Add a customer first - do it in the Customers tab.', 'warning');
        switchTab('customers');
        return;
      }
      openNewInvoiceModal();
    });
    el('rbi-btn-new-customer').addEventListener('click', function () {
      if (!canWrite()) return;
      openCustomerModal(null);
    });
    el('rbi-btn-save-settings').addEventListener('click', saveSettings);
    el('rbi-btn-reset-data').addEventListener('click', resetAllData);
    el('rbi-btn-save-pricing').addEventListener('click', savePricing);
    el('rbi-btn-reset-pricing').addEventListener('click', resetPricingToAgreement);

    el('rbi-modal-x').addEventListener('click', closeModal);
    el('rbi-inv-cancel').addEventListener('click', closeModal);
    el('rbi-inv-save').addEventListener('click', saveInvoiceFromForm);
    el('rbi-backdrop').addEventListener('click', function (e) {
      if (e.target === el('rbi-backdrop')) closeModal();
    });

    el('rbi-cu-close').addEventListener('click', closeCustomerModal);
    el('rbi-cu-cancel').addEventListener('click', closeCustomerModal);
    el('rbi-cu-save').addEventListener('click', saveCustomerModal);
    el('rbi-cu-use-default').addEventListener('change', toggleCustomerPricingBlock);
    el('rbi-cu-copy-default').addEventListener('click', function () {
      _customerPricingDraft.brackets = copyBrackets(DB.pricing.brackets);
      renderCustomerBracketRows();
    });
    el('rbi-cu-backdrop').addEventListener('click', function (e) {
      if (e.target === el('rbi-cu-backdrop')) closeCustomerModal();
    });

    var formFieldIds = ['rbi-inv-month', 'rbi-inv-revenue', 'rbi-inv-currency', 'rbi-inv-taxrate', 'rbi-inv-due', 'rbi-inv-notes'];
    formFieldIds.forEach(function (id) {
      el(id).addEventListener('input', liveRecalc);
      el(id).addEventListener('change', liveRecalc);
    });
    el('rbi-inv-customer').addEventListener('change', liveRecalc);
    el('rbi-inv-support').addEventListener('change', liveRecalc);
    el('rbi-inv-minimum').addEventListener('change', liveRecalc);
    el('rbi-inv-negotiated').addEventListener('input', liveRecalc);
    el('rbi-btn-add-line').addEventListener('click', function () {
      if (!canWrite()) return;
      addFormLine();
    });
    el('rbi-btn-upload-logo').addEventListener('click', uploadCompanyLogo);
    el('rbi-btn-remove-logo').addEventListener('click', removeCompanyLogo);
    el('rbi-btn-add-support-type').addEventListener('click', addSupportType);

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (el('rbi-cu-backdrop').style.display !== 'none') closeCustomerModal();
      else if (el('rbi-backdrop').style.display !== 'none') closeModal();
    });

    document.addEventListener('click', function (e) {
      var target = e.target;
      var button = null;
      var node = target;
      while (node && node !== document) {
        if (node.getAttribute && node.getAttribute('data-act')) { button = node; break; }
        node = node.parentNode;
      }
      if (!button) return;
      var action = button.getAttribute('data-act');
      var dataId = button.getAttribute('data-id');
      if (action === 'inv-open') openInvoiceModal(dataId);
      else if (action === 'inv-print') printInvoice(dataId);
      else if (action === 'inv-email') emailInvoice(dataId);
      else if (action === 'inv-status') markInvoiceStatus(dataId, button.getAttribute('data-status'));
      else if (action === 'inv-duplicate') duplicateInvoice(dataId);
      else if (action === 'inv-delete') deleteInvoice(dataId);
      else if (action === 'inv-line-remove') removeFormLine(parseInt(button.getAttribute('data-idx'), 10) || 0);
      else if (action === 'cu-edit') openCustomerModal(dataId);
      else if (action === 'cu-delete') deleteCustomer(dataId);
      else if (action === 'sup-remove') removeSupportType(parseInt(button.getAttribute('data-idx'), 10) || 0);
    });
  }

  function switchTab(tab) {
    if (['invoices', 'customers', 'pricing', 'settings'].indexOf(tab) === -1) return;
    DB.ui.tab = tab;
    renderTabs();
    persist();
    tool.resize();
  }

  /* ── Harness sample data ── */
  window.loadSample = function () {
    var currentTab = DB ? DB.ui.tab : 'invoices';
    var sample = emptyDatabase();
    sample.company = {
      name: 'Acme Software Inc.',
      taxId: '123456789 RT0001',
      email: 'billing@acmesoftware.ca',
      phone: '+1 (416) 555-0142',
      address: '100 King St W, Toronto, ON M5X 1A9'
    };
    var harbourBrackets = copyBrackets(AGREEMENT_BRACKETS);
    harbourBrackets[0].fee = 400;          /* minimum */
    harbourBrackets[1].ratePct = 1.0;      /* 20k-75k */
    harbourBrackets[1].cap = 450;
    harbourBrackets[2].ratePct = 0.9;      /* 75k-200k */
    harbourBrackets[2].cap = 900;
    sample.customers = [
      {
        id: 'cust_lakeside',
        name: 'Lakeside Cinemas Group',
        email: 'accounts@lakesidecinemas.ca',
        address: '22 Harbour Rd, Halifax, NS B3J 1C4',
        useDefaultPricing: true,
        pricing: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'cust_harbour',
        name: 'Harbour Ferry Tours',
        email: 'billing@harbourferry.ca',
        address: '9 Waterfront Dr, Victoria, BC V8W 1A1',
        useDefaultPricing: false,
        pricing: { brackets: harbourBrackets, negotiatedNote: 'Agreed per contract addendum A' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    sample.settings = {
      currency: 'CAD',
      taxRate: 13,
      prefix: 'INV',
      nextSeq: 4,
      paymentTerms: 'Net 15',
      defaultCustomerId: 'cust_lakeside',
      defaultSupportTypeId: 'sup_standard',
      supportTypes: [
        { id: 'sup_standard', name: 'Standard', fee: 0 },
        { id: 'sup_premium', name: 'Premium', fee: 250 },
        { id: 'sup_priority', name: 'Priority', fee: 500 }
      ]
    };
    sample.flags = { seeded: true };

    function buildSampleInvoice(month, revenue, customer, taxRate, status, negotiatedFee, notes, supportType, lineItems) {
      var applyMinimum = true;
      var brackets = (customer.useDefaultPricing || !customer.pricing) ? sample.pricing.brackets : customer.pricing.brackets;
      var wf = calculateWaterfall(revenue, brackets, applyMinimum, negotiatedFee);
      var supportTypeFee = supportType ? supportType.fee : 0;
      var lineItemsTotal = (lineItems || []).reduce(function (sum, line) { return round2(sum + line.amount); }, 0);
      var extraTotal = round2(supportTypeFee + lineItemsTotal);
      var totals = computeInvoiceTotals(wf.fee, extraTotal, taxRate);
      var now = new Date();
      var dueDate = monthEndDate(month);
      return normalizeInvoice({
        id: uid('inv'),
        number: 'INV-' + month.slice(0, 4) + '-' + pad3(sample.settings.nextSeq++),
        month: month,
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerAddress: customer.address,
        pricingSource: (customer.useDefaultPricing || !customer.pricing) ? 'default' : 'custom',
        revenue: revenue,
        currency: 'CAD',
        applyMinimum: applyMinimum,
        negotiatedFee: negotiatedFee,
        supportTypeId: supportType ? supportType.id : '',
        supportTypeName: supportType ? supportType.name : '',
        supportTypeFee: supportTypeFee,
        lineItems: (lineItems || []).map(function (line) { return { id: uid('ln'), description: line.description, amount: line.amount }; }),
        extraTotal: extraTotal,
        subtotal: totals.subtotal,
        taxRate: taxRate,
        fee: wf.fee,
        taxAmount: totals.taxAmount,
        total: totals.total,
        breakdown: wf.rows,
        pricingSnapshot: { brackets: copyBrackets(brackets), negotiatedNote: '', pricingSource: (customer.useDefaultPricing || !customer.pricing) ? 'default' : 'custom' },
        status: status,
        issuedAt: todayIso(),
        dueDate: dueDate,
        paidAt: status === 'paid' ? todayIso() : '',
        notes: notes,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      });
    }

    var previousMonth = new Date();
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    var monthBefore = previousMonth.getFullYear() + '-' + String(previousMonth.getMonth() + 1).padStart(2, '0');
    var nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    var monthAfter = nextMonth.getFullYear() + '-' + String(nextMonth.getMonth() + 1).padStart(2, '0');

    var lakeside = sample.customers[0];
    var harbour = sample.customers[1];
    var standardSupport = sample.settings.supportTypes[0];
    var prioritySupport = sample.settings.supportTypes[2];
    sample.invoices = [
      buildSampleInvoice(monthBefore, 18500, lakeside, 13, 'paid', null, 'First months after launch - only the minimum applies.', standardSupport, null),
      buildSampleInvoice(monthBefore, 90000, harbour, 13, 'sent', null, 'Custom waterfall: CA $400 + CA $450 (capped) + CA $135 = CA $985 before tax. Priority support and a POS setup line.', prioritySupport, [
        { description: 'POS integration setup', amount: 800 }
      ]),
      buildSampleInvoice(currentMonth(), 160000, lakeside, 13, 'sent', null, 'Agreement worked example: CA $300 + CA $550 + CA $680 = CA $1,530 before tax.', standardSupport, null),
      buildSampleInvoice(monthAfter, 3450000, lakeside, 13, 'draft', 1250, 'Above CA $3,000,000 - negotiated fee agreed with the customer.', standardSupport, [
        { description: 'Custom reporting module', amount: 1200 }
      ])
    ];
    sample.ui.tab = ['invoices', 'customers', 'pricing', 'settings'].indexOf(currentTab) !== -1 ? currentTab : 'invoices';
    DB = sample;
    var sampleJson = JSON.stringify(DB);
    tool.setValue(JSON.parse(sampleJson));
    _lastStagedJson = sampleJson;
    if (typeof tool.requestSave === 'function') tool.requestSave(function () {});
    renderAll();
    applyDemoHooks();
    tool.notify('Sample data loaded - 2 customers (default + custom waterfall) and 4 invoices.', 'info');
  };

  /* QA hooks used by screenshots (params are ignored in the real CMS). */
  function applyDemoHooks() {
    var demoModalRevenue = tool.param('demoModal', '');
    if (demoModalRevenue) {
      openNewInvoiceModal();
      el('rbi-inv-revenue').value = demoModalRevenue;
      liveRecalc();
      return;
    }
    if (tool.param('demoView', '') === '1') {
      var sentInvoice = null;
      for (var i = 0; i < DB.invoices.length; i++) {
        if (DB.invoices[i].status === 'sent') { sentInvoice = DB.invoices[i]; break; }
      }
      if (sentInvoice) openInvoiceModal(sentInvoice.id);
      return;
    }
    if (tool.param('demoCustomer', '') === '1') {
      var customCustomer = null;
      for (var j = 0; j < DB.customers.length; j++) {
        if (!DB.customers[j].useDefaultPricing) { customCustomer = DB.customers[j]; break; }
      }
      openCustomerModal(customCustomer ? customCustomer.id : (DB.customers[0] ? DB.customers[0].id : null));
    }
  }

  /* ── Boot ── */
  tool.onReady(function (initialValue) {
    DB = normalizeValue(initialValue);
    _lastStagedJson = JSON.stringify(DB);

    wireEvents();
    seedFromParams();

    var currencySelects = [el('rbi-st-currency'), el('rbi-inv-currency')];
    currencySelects.forEach(function (select) {
      if (!select) return;
      select.innerHTML = CURRENCIES.map(function (c) {
        return '<option value="' + c + '">' + c + '</option>';
      }).join('');
    });
    el('rbi-st-terms').innerHTML = PAYMENT_TERMS.map(function (t) {
      return '<option value="' + t + '">' + t + '</option>';
    }).join('');

    refreshUser();

    var qaTab = tool.param('tab', '');
    if (qaTab) switchTab(qaTab);

    /* QA hook for screenshots: ?demoModal=160000 opens the new-invoice form pre-filled. */
    applyDemoHooks();

    tool.declareParams([
      { name: 'companyName', label: 'Company Name', type: 'text', default: '', hint: 'Provider name shown on invoice headers.', severity: 'optional' },
      { name: 'companyTaxId', label: 'Company Tax / GST ID', type: 'text', default: '', hint: 'Tax registration number shown on invoices.', severity: 'optional' },
      { name: 'companyEmail', label: 'Company Email', type: 'text', default: '', hint: 'Contact email shown on invoices.', severity: 'optional' },
      { name: 'customerName', label: 'First Customer Name', type: 'text', default: '', hint: 'Seeds the first customer in the Customers tab.', severity: 'optional' },
      { name: 'customerEmail', label: 'First Customer Email', type: 'text', default: '', hint: 'Seeds the first customer\'s email - where their invoices are emailed.', severity: 'optional' },
      { name: 'defaultCurrency', label: 'Default Currency', type: 'select', default: 'CAD', hint: 'Currency for new invoices (CAD, USD, EUR, GBP, TRY).', severity: 'optional' },
      { name: 'defaultTaxRate', label: 'Default Tax Rate %', type: 'number', default: '0', hint: 'Tax rate pre-filled on new invoices (e.g. 13 for HST).', severity: 'optional' },
      { name: 'invoicePrefix', label: 'Invoice Prefix', type: 'text', default: 'INV', hint: 'Prefix for invoice numbers, e.g. INV.', severity: 'optional' },
      { name: 'paymentTerms', label: 'Payment Terms', type: 'select', default: 'Net 15', hint: 'Shown on invoices: Due on receipt, Net 7, Net 15, Net 30.', severity: 'optional' }
    ]);

    tool.onValueChange(function (newValue) {
      if (newValue === null || newValue === undefined) return;
      var incomingJson = JSON.stringify(newValue);
      if (incomingJson === _lastStagedJson) return;
      DB = normalizeValue(newValue);
      _lastStagedJson = incomingJson;
      renderAll();
      tool.notify('Reloaded - the value changed elsewhere.', 'info');
    });
    tool.onReadonlyChange(function (readOnly) {
      _readOnly = !!readOnly;
      applyPermissions();
    });
    tool.onUserChange(function (user) {
      if (user) { _user = user; _noIdentity = false; }
      applyPermissions();
    });

    renderAll();
  });
})();
