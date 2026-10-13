/* build 2026-10-10-1 */

/* =====================================================================
   RestaurantOrderManager - manager-facing detail view of ONE restaurant
   order record (cmsObjectType restaurant-orders, application
   restaurant-order-manager-uniconbaseapps).

   READ  : the parent object record through the CMS tool SDK
           (onReady second arg, tool.getFields, tool.onFieldsChange).
   WRITE : the CMS-native field editing API (tool.setField / tool.setFields)
           for the order status, statusChangedAt and internalNote.
           Never a database or REST call from the sandbox.
   ===================================================================== */

/* Tool build stamp - MANDATORY (html-tool-rules GLOBAL REQUIREMENT):
   bump on EVERY code change so stale CMS uploads are detectable. */
var TOOL_BUILD = '2026-10-10-1';
console.log('[TOOL:BOOT] build ' + TOOL_BUILD + ' RestaurantOrderManager starting...');

(function () {
  'use strict';

  /* ----------------------------------------------------------- constants */

  var ORDER_FIELDS = [
    'orderNumber', 'placedAt', 'channel', 'customer', 'address',
    'customAddressFields', 'tableNumber', 'deliveryZone', 'scheduledFor',
    'paymentMethod', 'paymentDetails', 'lines', 'totals',
    'status', 'statusChangedAt', 'internalNote'
  ];

  var STATUS_FIELD = 'status';
  var STATUS_TIME_FIELD = 'statusChangedAt';
  var NOTE_FIELD = 'internalNote';

  var STATUS_ORDER = ['new', 'accepted', 'in-preparation', 'ready', 'completed', 'declined', 'cancelled'];

  var STATUS_META = {
    'new': { label: 'New', cls: 'new', next: 'accepted', nextLabel: 'Accept order' },
    'accepted': { label: 'Accepted', cls: 'accepted', next: 'in-preparation', nextLabel: 'Start preparation' },
    'in-preparation': { label: 'In preparation', cls: 'prep', next: 'ready', nextLabel: 'Mark ready' },
    'ready': { label: 'Ready', cls: 'ready', next: 'completed', nextLabel: 'Complete order' },
    'completed': { label: 'Completed', cls: 'done', next: null, nextLabel: '' },
    'declined': { label: 'Declined', cls: 'declined', next: null, nextLabel: '' },
    'cancelled': { label: 'Cancelled', cls: 'cancelled', next: null, nextLabel: '' }
  };

  var CHANNEL_META = {
    'pickup': { label: 'Pickup', icon: '\uD83E\uDD61' },
    'delivery': { label: 'Delivery', icon: '\uD83D\uDEF5' },
    'on_premise': { label: 'Dine-in', icon: '\uD83C\uDF7D' },
    'on-premise': { label: 'Dine-in', icon: '\uD83C\uDF7D' },
    'onpremise': { label: 'Dine-in', icon: '\uD83C\uDF7D' }
  };

  var PAYMENT_LABELS = {
    'cash': 'Cash',
    'card': 'Card',
    'interac': 'Interac',
    'online': 'Online payment'
  };

  var WRITE_ROLES = ['admin', 'owner', 'developer', 'user-manager', 'editor'];

  /* --------------------------------------------------------------- state */

  var _order = {};
  var _record = {};
  var _readOnly = false;
  var _noIdentity = false;
  var _user = null;
  var _canWrite = false;
  var _warnedSave = false;
  var _armedStatus = null;
  var _armedTimer = null;
  var _tickTimer = null;
  var _wired = false;

  var _cfg = {
    warnMinutes: 10,
    timeZone: '',
    currency: '',
    ordersType: 'restaurant-orders',
    allowFallback: false
  };

  /* ------------------------------------------------------- tiny helpers */

  function $id(id) { return document.getElementById(id); }

  function esc(value) {
    if (value === undefined || value === null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function num(value) {
    if (typeof value === 'number') return isFinite(value) ? value : 0;
    var parsed = parseFloat(String(value === undefined || value === null ? '' : value).replace(/[^0-9.\-]/g, ''));
    return isFinite(parsed) ? parsed : 0;
  }

  function fmtMoney(value) {
    var amount = num(value);
    if (_cfg.currency) {
      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: _cfg.currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(amount);
      } catch (err) { /* fall through to plain amount */ }
    }
    return amount.toFixed(2);
  }

  function fmtDateTime(iso) {
    if (!iso) return '';
    var date = new Date(iso);
    if (isNaN(date.getTime())) return String(iso);
    var options = { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' };
    if (_cfg.timeZone) options.timeZone = _cfg.timeZone;
    try {
      return new Intl.DateTimeFormat(undefined, options).format(date);
    } catch (err) {
      return date.toLocaleString();
    }
  }

  function minutesSince(iso) {
    if (!iso) return null;
    var date = new Date(iso);
    if (isNaN(date.getTime())) return null;
    return Math.floor((Date.now() - date.getTime()) / 60000);
  }

  function fmtElapsed(minutes) {
    if (minutes === null || minutes === undefined) return '';
    if (minutes < 1) return 'just now';
    if (minutes < 60) return minutes + ' min ago';
    var hours = Math.floor(minutes / 60);
    var rest = minutes % 60;
    return hours + 'h' + (rest ? ' ' + rest + 'm' : '') + ' ago';
  }

  function fmtDuration(minutes) {
    if (minutes < 60) return minutes + ' min';
    var hours = Math.floor(minutes / 60);
    var rest = minutes % 60;
    return hours + 'h' + (rest ? ' ' + rest + 'm' : '');
  }

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      try {
        var parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) { return []; }
    }
    return [];
  }

  function asObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      try {
        var parsed = JSON.parse(value);
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : null;
      } catch (err) { return null; }
    }
    return null;
  }

  function merge(objectA, objectB) {
    var out = {};
    var key;
    if (objectA && typeof objectA === 'object') {
      for (key in objectA) { if (Object.prototype.hasOwnProperty.call(objectA, key)) out[key] = objectA[key]; }
    }
    if (objectB && typeof objectB === 'object') {
      for (key in objectB) { if (Object.prototype.hasOwnProperty.call(objectB, key)) out[key] = objectB[key]; }
    }
    return out;
  }

  function notify(message, severity) {
    try {
      if (typeof tool.notify === 'function') { tool.notify(message, severity || 'info'); return; }
    } catch (err) { /* ignore */ }
    console.log('[RestaurantOrderManager] ' + (severity || 'info') + ': ' + message);
  }

  /* ------------------------------------------------ reading the record */

  function normalizeKey(key) {
    return String(key === undefined || key === null ? '' : key).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function findKey(bag, name) {
    if (!bag || typeof bag !== 'object') return undefined;
    if (Object.prototype.hasOwnProperty.call(bag, name)) return bag[name];
    var wanted = normalizeKey(name);
    for (var key in bag) {
      if (!Object.prototype.hasOwnProperty.call(bag, key)) continue;
      if (normalizeKey(key) === wanted) return bag[key];
    }
    return undefined;
  }

  function collectBags(source) {
    var bags = [];
    if (!source || typeof source !== 'object') return bags;
    bags.push(source);
    if (source.data_categoriesBased) bags.push(source.data_categoriesBased);
    if (source.data && typeof source.data === 'object') bags.push(source.data);
    if (source.objectData && typeof source.objectData === 'object') {
      bags.push(source.objectData);
      if (source.objectData.data_categoriesBased) bags.push(source.objectData.data_categoriesBased);
    }
    if (source.productData && typeof source.productData === 'object') {
      bags.push(source.productData);
      if (source.productData.data_categoriesBased) bags.push(source.productData.data_categoriesBased);
    }
    return bags;
  }

  function bagScore(bag) {
    if (!bag || typeof bag !== 'object') return 0;
    var score = 0;
    for (var i = 0; i < ORDER_FIELDS.length; i++) {
      if (findKey(bag, ORDER_FIELDS[i]) !== undefined) score++;
    }
    return score;
  }

  function orderedBags(sources) {
    var scored = [];
    for (var s = 0; s < sources.length; s++) {
      var bags = collectBags(sources[s]);
      for (var b = 0; b < bags.length; b++) {
        var score = bagScore(bags[b]);
        if (score > 0) scored.push({ bag: bags[b], score: score });
      }
    }
    scored.sort(function (x, y) { return y.score - x.score; });
    return scored.map(function (entry) { return entry.bag; });
  }

  function readField(bags, name) {
    for (var i = 0; i < bags.length; i++) {
      var value = findKey(bags[i], name);
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
  }

  function readOrder(value, fields) {
    _record = (fields && typeof fields === 'object') ? fields : {};
    var sources = [_record];
    if (value && typeof value === 'object') sources.push(value);
    var bags = orderedBags(sources);
    var order = {};
    for (var i = 0; i < ORDER_FIELDS.length; i++) {
      order[ORDER_FIELDS[i]] = readField(bags, ORDER_FIELDS[i]);
    }
    order.__objectId = _record.id || _record._id || readField([_record], 'id') || '';
    order.__recordName = _record.name || '';
    return order;
  }

  function hasOrderData(order) {
    if (!order) return false;
    if (order.orderNumber || order.placedAt || order.channel || order.status) return true;
    if (asArray(order.lines).length) return true;
    if (asObject(order.totals)) return true;
    if (asObject(order.customer)) return true;
    return false;
  }

  /* ------------------------------------------- admin-configured params */

  function paramRaw(name, fallback) {
    try {
      if (typeof tool === 'undefined' || typeof tool.param !== 'function') return fallback;
      var value = tool.param(name, fallback);
      return (value === undefined || value === null || value === '') ? fallback : value;
    } catch (err) { return fallback; }
  }

  function readConfig() {
    var warn = parseInt(String(paramRaw('newOrderWarningMinutes', '10')), 10);
    _cfg.warnMinutes = (isFinite(warn) && warn >= 0) ? warn : 10;
    _cfg.timeZone = String(paramRaw('restaurantTimezone', '')).trim();
    _cfg.currency = String(paramRaw('currencyCode', '')).trim().toUpperCase();
    _cfg.ordersType = String(paramRaw('ordersObjectType', 'restaurant-orders')).trim() || 'restaurant-orders';
    _cfg.allowFallback = String(paramRaw('allowObjectWriteFallback', 'no')).toLowerCase() === 'yes';
  }

  function declareToolParams() {
    if (typeof tool === 'undefined' || typeof tool.declareParams !== 'function') return;
    try {
      tool.declareParams([
        {
          name: 'newOrderWarningMinutes', label: 'New-order warning (minutes)',
          type: 'number', default: '10', severity: 'goodToHave',
          hint: 'Show a warning banner when an order stays new for longer than this many minutes.'
        },
        {
          name: 'restaurantTimezone', label: 'Restaurant timezone',
          type: 'text', default: '', severity: 'goodToHave',
          hint: 'IANA timezone used to display times, for example Europe/Istanbul or America/New_York. Empty = the viewer timezone.'
        },
        {
          name: 'currencyCode', label: 'Currency code',
          type: 'text', default: '', severity: 'goodToHave',
          hint: 'ISO 4217 currency code used to format the totals, for example USD, EUR, TRY. Empty = plain amounts.'
        },
        {
          name: 'ordersObjectType', label: 'Orders object type',
          type: 'text', default: 'restaurant-orders', severity: 'optional',
          hint: 'CMS object type holding the order records (read; update only through the fallback below). Default restaurant-orders.'
        },
        {
          name: 'allowObjectWriteFallback', label: 'Allow requestObjects write fallback',
          type: 'toggle', default: 'no', severity: 'optional',
          hint: 'If the CMS field editor is unavailable, write the status through tool.requestObjects update (needs allowObjectCRUD and an allowedObjectTypes entry).'
        }
      ]);
    } catch (err) {
      console.warn('[RestaurantOrderManager] declareParams failed', err);
    }
  }

  /* ------------------------------------------------------------ lookups */

  function statusMetaOf(status) {
    var key = String(status || 'new').toLowerCase().trim();
    if (STATUS_META[key]) return STATUS_META[key];
    return { label: status ? String(status) : 'Unknown', cls: 'new', next: null, nextLabel: '' };
  }

  function channelMetaOf(channel) {
    var key = String(channel || '').toLowerCase().trim();
    if (CHANNEL_META[key]) return CHANNEL_META[key];
    if (!key) return { label: 'Order', icon: '\uD83E\uDD61' };
    return { label: String(channel), icon: '\uD83C\uDF7D' };
  }

  function paymentLabelOf(method) {
    var key = String(method || '').toLowerCase().trim();
    if (!key) return '';
    return PAYMENT_LABELS[key] || String(method);
  }

  /* Only the last 4 digits and the expiry of a card are ever surfaced. */
  function cardSummary(card) {
    if (!card || typeof card !== 'object') return '';
    var brand = card.brand || card.scheme || card.network || '';
    var last4 = card.last4 || card.lastFour || card.last_4 || '';
    var expiry = '';
    if (card.expiry) expiry = String(card.expiry);
    else if (card.exp_month && card.exp_year) expiry = String(card.exp_month) + '/' + String(card.exp_year).slice(-2);
    else if (card.expMonth && card.expYear) expiry = String(card.expMonth) + '/' + String(card.expYear).slice(-2);
    var parts = [];
    if (brand) parts.push(String(brand));
    if (last4) parts.push('**** ' + String(last4).slice(-4));
    if (expiry) parts.push('exp ' + expiry);
    return parts.join(' ');
  }

  function addressLines(address) {
    var lines = [];
    if (!address || typeof address !== 'object') return lines;
    if (address.street) lines.push(String(address.street));
    var cityBits = [];
    if (address.city) cityBits.push(String(address.city));
    if (address.postal_code || address.postalCode || address.zip) {
      cityBits.push(String(address.postal_code || address.postalCode || address.zip));
    }
    if (cityBits.length) lines.push(cityBits.join(', '));
    if (address.state || address.province) lines.push(String(address.state || address.province));
    if (address.country) lines.push(String(address.country));
    if (address.block) lines.push('Block: ' + String(address.block));
    if (address.intercom) lines.push('Intercom: ' + String(address.intercom));
    if (address.parking_info || address.parkingInfo) lines.push('Parking: ' + String(address.parking_info || address.parkingInfo));
    if (address.additional_info || address.additionalInfo) lines.push(String(address.additional_info || address.additionalInfo));
    if (!lines.length) {
      Object.keys(address).forEach(function (key) {
        var value = address[key];
        if (value === null || value === undefined || value === '') return;
        lines.push(key + ': ' + value);
      });
    }
    return lines;
  }

  /* ----------------------------------------------------------- rendering */

  function setText(id, text) {
    var el = $id(id);
    if (el) el.textContent = (text === undefined || text === null) ? '' : String(text);
  }

  function show(id, visible) {
    var el = $id(id);
    if (el) el.style.display = visible ? '' : 'none';
  }

  function rowHtml(label, value, valueClass) {
    return '<div class="rom-row"><span class="rom-k">' + esc(label) + '</span>' +
      '<span class="rom-v' + (valueClass ? ' ' + valueClass : '') + '">' + esc(value) + '</span></div>';
  }

  function renderHeader(order) {
    var channel = channelMetaOf(order.channel);
    var badge = $id('rom-channel-badge');
    if (badge) badge.textContent = channel.icon + ' ' + channel.label;

    setText('rom-order-number', order.orderNumber || order.__recordName || 'Order');

    var meta = statusMetaOf(order.status);
    var statusBadge = $id('rom-status-badge');
    if (statusBadge) {
      statusBadge.textContent = meta.label;
      statusBadge.className = 'rom-status st-' + meta.cls;
    }

    var placed = order.placedAt ? ('Placed ' + fmtDateTime(order.placedAt)) : '';
    setText('rom-placed-at', placed);
    show('rom-sep-placed', !!placed);
    updateWaiting(order);
  }

  function updateWaiting(order) {
    var el = $id('rom-waiting');
    if (!el) return;
    var statusKey = String(order.status || 'new').toLowerCase().trim();
    if (statusKey === 'completed' || statusKey === 'declined' || statusKey === 'cancelled') {
      el.textContent = '';
      return;
    }
    el.textContent = fmtElapsed(minutesSince(order.placedAt));
  }

  function renderWarning(order) {
    var box = $id('rom-warning');
    if (!box) return;
    var statusKey = String(order.status || 'new').toLowerCase().trim();
    if (statusKey !== 'new') { box.style.display = 'none'; return; }
    if (order.scheduledFor) {
      var scheduled = new Date(order.scheduledFor);
      if (!isNaN(scheduled.getTime()) && scheduled.getTime() > Date.now()) { box.style.display = 'none'; return; }
    }
    var minutes = minutesSince(order.placedAt);
    if (minutes === null || minutes < _cfg.warnMinutes) { box.style.display = 'none'; return; }
    setText('rom-warning-text', 'This order has been waiting for ' + fmtDuration(minutes) + ' without being accepted.');
    box.style.display = '';
  }

  function renderCustomer(order) {
    var host = $id('rom-customer');
    if (!host) return;
    var customer = asObject(order.customer) || {};
    var address = asObject(order.address);
    var customFields = asObject(order.customAddressFields);

    var html = '<h3 class="rom-block-title">Customer</h3>';
    html += rowHtml('Name', customer.fullName || customer.name || '-');

    var phone = customer.phone || '';
    if (phone) {
      html += '<div class="rom-row"><span class="rom-k">Phone</span><span class="rom-v">' +
        '<button type="button" class="rom-link" data-act="call" data-phone="' + esc(phone) + '" title="Call ' + esc(phone) + '">' +
        esc(phone) + '</button></span></div>';
    }

    if (order.tableNumber) html += rowHtml('Table', order.tableNumber);

    if (address) {
      var lines = addressLines(address);
      if (lines.length) {
        html += '<div class="rom-row rom-row-block"><span class="rom-k">Address</span>' +
          '<span class="rom-v rom-addr">' + lines.map(esc).join('<br>') + '</span></div>';
      }
    }

    if (customFields) {
      Object.keys(customFields).forEach(function (key) {
        var value = customFields[key];
        if (value === null || value === undefined || value === '') return;
        html += rowHtml(key, value);
      });
    }

    host.innerHTML = html;
  }

  function renderZone(order) {
    var host = $id('rom-zone');
    if (!host) return;
    var zone = asObject(order.deliveryZone);
    var totals = asObject(order.totals) || {};
    var isDelivery = String(order.channel || '').toLowerCase() === 'delivery';
    if (!zone && !isDelivery) {
      host.innerHTML = '';
      host.style.display = 'none';
      return;
    }
    host.style.display = '';
    var html = '<h3 class="rom-block-title">Delivery zone</h3>';
    if (zone) html += rowHtml('Zone', zone.name || zone.id || '-');
    if (totals.deliveryFee !== undefined && totals.deliveryFee !== null && totals.deliveryFee !== '') {
      html += rowHtml('Delivery fee', fmtMoney(totals.deliveryFee));
    }
    if (num(totals.minOrder) > 0) html += rowHtml('Minimum order', fmtMoney(totals.minOrder));
    if (num(totals.remainingToMinimum) > 0) html += rowHtml('Remaining to minimum', fmtMoney(totals.remainingToMinimum), 'warn');
    host.innerHTML = html;
  }

  function renderSchedule(order) {
    var host = $id('rom-schedule');
    if (!host) return;
    var channel = channelMetaOf(order.channel);
    var html = '<h3 class="rom-block-title">Timing</h3>';
    html += rowHtml('Channel', channel.label);
    if (order.scheduledFor) html += rowHtml('Scheduled for', fmtDateTime(order.scheduledFor));
    else html += rowHtml('Timing', 'As soon as possible');
    if (order.placedAt) html += rowHtml('Placed', fmtDateTime(order.placedAt));
    if (order.statusChangedAt) html += rowHtml('Status changed', fmtDateTime(order.statusChangedAt));
    host.innerHTML = html;
  }

  function renderPayment(order) {
    var host = $id('rom-payment');
    if (!host) return;
    var details = asObject(order.paymentDetails) || {};
    var html = '<h3 class="rom-block-title">Payment</h3>';
    html += rowHtml('Method', paymentLabelOf(order.paymentMethod) || 'Not selected');
    if (details.provider) html += rowHtml('Provider', details.provider);
    var card = cardSummary(details.card);
    if (card) html += rowHtml('Card', card);
    host.innerHTML = html;
  }

  function modifierTotal(line) {
    var entries = asArray(line.modifierEntries);
    var total = 0;
    for (var i = 0; i < entries.length; i++) {
      total += num(entries[i].priceAdjustment) * (num(entries[i].quantity) || 1);
    }
    return total;
  }

  function lineHtml(line) {
    if (!line || typeof line !== 'object') return '';
    var quantity = num(line.quantity) || 1;
    var baseUnit = num(line.unitPrice);
    var modifierSum = modifierTotal(line);
    var lineTotal = (baseUnit + modifierSum) * quantity;

    var html = '<div class="rom-line">';
    html += '<div class="rom-line-main">';
    html += '<div class="rom-line-title">';
    html += '<span class="rom-qty">' + esc(String(quantity)) + ' x</span>';
    html += '<span class="rom-item">' + esc(line.itemName || line.internalName || 'Item') + '</span>';
    if (line.sizeLabel) html += '<span class="rom-size">' + esc(line.sizeLabel) + '</span>';
    html += '</div>';

    if (line.internalName && line.internalName !== line.itemName) {
      html += '<div class="rom-line-internal">' + esc(line.internalName) + '</div>';
    }

    var entries = asArray(line.modifierEntries);
    if (entries.length) {
      html += '<ul class="rom-mods">';
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i] || {};
        var entryQty = num(entry.quantity);
        html += '<li>';
        html += '<span class="rom-mod-name">' + esc(entry.optionName || entry.optionId || 'Option') + '</span>';
        if (entryQty > 1) html += ' <span class="rom-mod-qty">x' + esc(String(entryQty)) + '</span>';
        if (num(entry.priceAdjustment) !== 0) {
          html += ' <span class="rom-mod-price">' + (num(entry.priceAdjustment) > 0 ? '+' : '') +
            esc(fmtMoney(entry.priceAdjustment)) + '</span>';
        }
        if (entry.groupName) html += ' <span class="rom-mod-group">' + esc(entry.groupName) + '</span>';
        if (entry.internalName) html += ' <span class="rom-mod-group">' + esc(entry.internalName) + '</span>';
        html += '</li>';
      }
      html += '</ul>';
    }

    if (line.instructions) html += '<div class="rom-instr">Note: ' + esc(line.instructions) + '</div>';

    html += '</div>';
    html += '<div class="rom-line-price">';
    html += '<span class="rom-unit">' + esc(fmtMoney(baseUnit)) + '</span>';
    if (modifierSum) {
      html += '<span class="rom-unit-note">' + (modifierSum > 0 ? '+' : '') + esc(fmtMoney(modifierSum)) + '</span>';
    }
    html += '<span class="rom-line-total">' + esc(fmtMoney(lineTotal)) + '</span>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderLines(order) {
    var host = $id('rom-lines');
    if (!host) return;
    var lines = asArray(order.lines);
    if (!lines.length) {
      host.innerHTML = '<div class="rom-empty-inline">No line items on this order.</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < lines.length; i++) html += lineHtml(lines[i]);
    host.innerHTML = html;
  }

  function renderTotals(order) {
    var host = $id('rom-totals');
    if (!host) return;
    var totals = asObject(order.totals) || {};
    var rows = '';
    var hasAny = false;

    function totalRow(label, value) {
      if (value === undefined || value === null || value === '') return '';
      hasAny = true;
      return '<div class="rom-total-row"><span>' + esc(label) + '</span><span>' + esc(fmtMoney(value)) + '</span></div>';
    }

    rows += totalRow('Subtotal', totals.subtotal);
    rows += totalRow('Tax', totals.tax);
    rows += totalRow('Delivery fee', totals.deliveryFee);
    rows += totalRow('Delivery fee tax', totals.deliveryFeeTax);

    var hasTotal = !(totals.total === undefined || totals.total === null || totals.total === '');
    if (!hasAny && !hasTotal) {
      host.innerHTML = '<div class="rom-empty-inline">No totals on this order.</div>';
      return;
    }

    host.innerHTML = '<div class="rom-totals-title">Totals</div>' + rows +
      '<div class="rom-total-grand"><span>Total</span><span>' + esc(fmtMoney(totals.total)) + '</span></div>';
  }

  function renderNote(order) {
    var area = $id('rom-note');
    if (!area) return;
    var incoming = (order.internalNote === undefined || order.internalNote === null) ? '' : String(order.internalNote);
    if (document.activeElement !== area && area.value !== incoming) area.value = incoming;
    var editable = _canWrite && !_readOnly;
    area.disabled = !editable;
    var saveBtn = $id('rom-note-save');
    if (saveBtn) saveBtn.disabled = !editable;
  }

  function armedButtonHtml(status, label) {
    if (_armedStatus === status) {
      return '<button type="button" class="rom-btn rom-btn-danger" data-act="status-confirm" data-status="' + esc(status) + '">Confirm ' + esc(label.toLowerCase()) + '</button>' +
        '<button type="button" class="rom-btn rom-btn-ghost rom-btn-small" data-act="status-arm-cancel">Keep</button>';
    }
    return '<button type="button" class="rom-btn rom-btn-ghost" data-act="status-arm" data-status="' + esc(status) + '">' + esc(label) + '</button>';
  }

  function renderActions() {
    var host = $id('rom-actions');
    if (!host) return;
    var order = _order || {};
    if (!hasOrderData(order)) { host.innerHTML = ''; return; }
    if (_readOnly) {
      host.innerHTML = '<div class="rom-actions-note">Read-only view. Status changes are disabled.</div>';
      return;
    }
    if (!_canWrite) {
      host.innerHTML = '<div class="rom-actions-note">You do not have permission to change this order.</div>';
      return;
    }

    var statusKey = String(order.status || 'new').toLowerCase().trim();
    var meta = statusMetaOf(order.status);

    var html = '<div class="rom-actions-head">';
    html += '<span class="rom-actions-label">Update status</span>';
    html += '<select class="rom-select" id="rom-status-select">';
    for (var i = 0; i < STATUS_ORDER.length; i++) {
      var key = STATUS_ORDER[i];
      html += '<option value="' + esc(key) + '"' + (key === statusKey ? ' selected' : '') + '>' +
        esc(STATUS_META[key].label) + '</option>';
    }
    html += '</select>';
    html += '</div>';

    html += '<div class="rom-actions-btns">';
    if (meta.next) {
      html += '<button type="button" class="rom-btn rom-btn-primary" data-act="status" data-status="' + esc(meta.next) + '">' +
        esc(meta.nextLabel) + '</button>';
    }
    if (statusKey === 'new') {
      html += armedButtonHtml('declined', 'Decline order');
    } else if (statusKey === 'accepted' || statusKey === 'in-preparation' || statusKey === 'ready') {
      html += armedButtonHtml('cancelled', 'Cancel order');
    }
    html += '</div>';

    host.innerHTML = html;
  }

  function updateReadonlyChrome() {
    var banner = $id('rom-readonly');
    if (!banner) return;
    if (_readOnly) {
      banner.textContent = 'Read-only view. You can inspect this order but not change it.';
      banner.style.display = '';
    } else {
      banner.style.display = 'none';
    }
  }

  function renderAll() {
    var order = _order || {};
    var has = hasOrderData(order);
    show('rom-empty', !has);
    show('rom-body', has);

    if (has) {
      renderHeader(order);
      renderCustomer(order);
      renderZone(order);
      renderSchedule(order);
      renderPayment(order);
      renderLines(order);
      renderTotals(order);
      renderNote(order);
      renderWarning(order);
    } else {
      var badge = $id('rom-channel-badge');
      if (badge) badge.textContent = '-';
      setText('rom-order-number', '-');
      var statusBadge = $id('rom-status-badge');
      if (statusBadge) { statusBadge.textContent = '-'; statusBadge.className = 'rom-status'; }
      setText('rom-placed-at', '');
      setText('rom-waiting', '');
      show('rom-sep-placed', false);
      show('rom-warning', false);
    }

    renderActions();
    updateReadonlyChrome();

    if (typeof tool.resize === 'function') {
      try { tool.resize(); } catch (err) { /* ignore */ }
    }
  }

  /* -------------------------------------------------------- write path */

  function requestHostSave() {
    if (typeof tool.requestSave !== 'function') return;
    try {
      tool.requestSave(function (err, ok) {
        if ((err || !ok) && !_warnedSave) {
          _warnedSave = true;
          notify('Saved in the form. The CMS will store it when the record is saved.', 'info');
        }
      });
    } catch (err) { /* ignore */ }
  }

  function writeOrderFields(patch) {
    if (typeof tool === 'undefined' || !tool) return false;
    try {
      if (typeof tool.setFields === 'function') {
        tool.setFields(patch);
        requestHostSave();
        return true;
      }
      if (typeof tool.setField === 'function') {
        Object.keys(patch).forEach(function (key) { tool.setField(key, patch[key]); });
        requestHostSave();
        return true;
      }
    } catch (err) {
      console.warn('[RestaurantOrderManager] CMS field edit failed', err);
    }

    if (_cfg.allowFallback && typeof tool.requestObjects === 'function' && _order && _order.__objectId) {
      var bag = {};
      Object.keys(patch).forEach(function (key) { bag[key] = patch[key]; });
      tool.requestObjects('update', {
        mainObjectType: _cfg.ordersType,
        objectId: _order.__objectId,
        productData: { data_categoriesBased: bag }
      }, function (err) {
        if (err) notify('Could not save the status change.', 'error');
      });
      return true;
    }

    notify('Could not save the change: the CMS field editor is unavailable.', 'error');
    return false;
  }

  function armStatus(status) {
    _armedStatus = status;
    renderActions();
    if (_armedTimer) clearTimeout(_armedTimer);
    _armedTimer = setTimeout(function () {
      _armedStatus = null;
      _armedTimer = null;
      renderActions();
    }, 5000);
  }

  function clearArm() {
    _armedStatus = null;
    if (_armedTimer) { clearTimeout(_armedTimer); _armedTimer = null; }
  }

  function setStatus(newStatus) {
    if (!newStatus) return;
    newStatus = String(newStatus).toLowerCase().trim();
    if (_readOnly || !_canWrite) { notify('You cannot change this order.', 'warning'); return; }

    var current = String((_order && _order.status) || 'new').toLowerCase().trim();
    if (newStatus === current) { clearArm(); renderActions(); return; }

    var stamp = new Date().toISOString();
    var patch = {};
    patch[STATUS_FIELD] = newStatus;
    patch[STATUS_TIME_FIELD] = stamp;

    var ok = writeOrderFields(patch);

    _order.status = newStatus;
    _order.statusChangedAt = stamp;
    clearArm();
    renderHeader(_order);
    renderSchedule(_order);
    renderWarning(_order);
    renderActions();

    if (ok) notify('Order ' + (_order.orderNumber || '') + ' set to ' + statusMetaOf(newStatus).label + '.', 'success');
  }

  function saveNote() {
    if (_readOnly || !_canWrite) return;
    var area = $id('rom-note');
    if (!area) return;
    var value = area.value;
    var patch = {};
    patch[NOTE_FIELD] = value;

    var ok = writeOrderFields(patch);
    _order.internalNote = value;

    var statusEl = $id('rom-note-status');
    if (statusEl) statusEl.textContent = ok ? 'Note saved' : 'Not saved';
    if (ok) notify('Note saved on the order.', 'success');
  }

  function callPhone(phone) {
    var digits = String(phone || '').replace(/[^0-9+]/g, '');
    if (!digits) return;
    try {
      if (typeof tool.openUrl === 'function') { tool.openUrl('tel:' + digits); return; }
    } catch (err) { /* ignore */ }
    notify('Phone: ' + phone, 'info');
  }

  /* --------------------------------------------------------------- events */

  function wireEvents() {
    if (_wired) return;
    _wired = true;
    var root = $id('rom-root');
    if (!root) return;

    root.addEventListener('click', function (event) {
      var target = event.target;
      var trigger = (target && target.closest) ? target.closest('[data-act]') : null;
      if (!trigger) return;
      var action = trigger.getAttribute('data-act');

      if (action === 'call') { callPhone(trigger.getAttribute('data-phone')); return; }
      if (action === 'status') { event.preventDefault(); setStatus(trigger.getAttribute('data-status')); return; }
      if (action === 'status-arm') { event.preventDefault(); armStatus(trigger.getAttribute('data-status')); return; }
      if (action === 'status-arm-cancel') { event.preventDefault(); clearArm(); renderActions(); return; }
      if (action === 'status-confirm') { event.preventDefault(); setStatus(trigger.getAttribute('data-status')); return; }
    });

    root.addEventListener('change', function (event) {
      var target = event.target;
      if (target && target.id === 'rom-status-select') setStatus(target.value);
    });

    var saveBtn = $id('rom-note-save');
    if (saveBtn) saveBtn.addEventListener('click', saveNote);
  }

  /* ---------------------------------------------------------- permissions */

  function getUserSafe() {
    try { return (typeof tool.getUser === 'function') ? tool.getUser() : null; } catch (err) { return null; }
  }

  function computeCanWrite() {
    var roles = (_user && _user.roles && _user.roles.length) ? _user.roles.slice() : [];
    var access = (_user && _user.effectiveAccess) ? _user.effectiveAccess : {};
    if (!roles.length) {
      if (access.isManager) roles.push('admin');
      else if (access.isEditor) roles.push('editor');
      else if (access.isViewer) roles.push('viewer');
    }
    var allowed = false;
    for (var i = 0; i < WRITE_ROLES.length; i++) {
      if (roles.indexOf(WRITE_ROLES[i]) !== -1) { allowed = true; break; }
    }
    _canWrite = _noIdentity ? true : allowed;
  }

  function bootIdentity() {
    _noIdentity = (typeof tool.getUser !== 'function');
    _user = getUserSafe();
    computeCanWrite();
    if (_noIdentity || (_user && _user.roles && _user.roles.length)) return;

    var delays = [400, 1200, 2600, 5000];
    delays.forEach(function (delay) {
      setTimeout(function () {
        var user = getUserSafe();
        if (user) { _user = user; computeCanWrite(); renderActions(); renderNote(_order || {}); }
      }, delay);
    });
    setTimeout(function () {
      if (!_user) { _noIdentity = true; computeCanWrite(); renderActions(); renderNote(_order || {}); }
    }, 5400);
  }

  /* --------------------------------------------------------- SDK sources */

  function safeGetFields() {
    try {
      if (typeof tool.getFields === 'function') {
        var fields = tool.getFields();
        if (fields && typeof fields === 'object') return fields;
      }
    } catch (err) { /* ignore */ }
    return null;
  }

  function safeGetValue() {
    try { if (typeof tool.getValue === 'function') return tool.getValue(); } catch (err) { /* ignore */ }
    return null;
  }

  function startTick() {
    if (_tickTimer) return;
    _tickTimer = setInterval(function () {
      if (!hasOrderData(_order)) return;
      updateWaiting(_order);
      renderWarning(_order);
    }, 30000);
  }

  function bindSdkListeners() {
    if (typeof tool.onValueChange === 'function') {
      tool.onValueChange(function (value) {
        _order = readOrder(value, safeGetFields());
        renderAll();
      });
    }
    if (typeof tool.onFieldsChange === 'function') {
      tool.onFieldsChange(function (fields) {
        _order = readOrder(safeGetValue(), fields);
        renderAll();
      });
    }
    if (typeof tool.onReadonlyChange === 'function') {
      tool.onReadonlyChange(function (readOnly) {
        _readOnly = !!readOnly;
        renderAll();
      });
    }
    if (typeof tool.onUserChange === 'function') {
      tool.onUserChange(function (user) {
        _user = user || null;
        if (user) _noIdentity = false;
        computeCanWrite();
        renderActions();
        renderNote(_order || {});
      });
    }
  }

  /* ----------------------------------------------------------------- boot */

  function boot(value, fields) {
    var buildEl = $id('rom-build');
    if (buildEl) buildEl.textContent = 'tool build ' + TOOL_BUILD;

    readConfig();
    _order = readOrder(value, merge(fields, safeGetFields()));
    _readOnly = (typeof tool.isReadOnly === 'function') ? !!tool.isReadOnly() : false;

    bootIdentity();
    wireEvents();
    renderAll();
    startTick();
    bindSdkListeners();

    console.log('[RestaurantOrderManager] build ' + TOOL_BUILD + ' ready - reading the order record via tool.getFields/onFieldsChange, writing status via tool.setField/setFields.');
  }

  declareToolParams();

  tool.onReady(function (value, fields) {
    boot(value, fields);
  });
})();

/* RESTAURANTORDERMANAGER-JS-END build 2026-10-10-1 - if this line is missing in the CMS Tool Builder JS field, the JS was truncated */
