/* build 2026-10-30-3 */

/* =====================================================================
   RestaurantOrderTakingApp - application-level ACTIVE ORDERS BOARD
   (listing tool, TYPE 3) for the restaurant order application.

   READ  : all order records of the CMS object type (restaurant-orders)
           through tool.requestObjects('query'). The board refreshes on
           a timer and on demand, so the kitchen always sees the latest
           state of today's orders.
   WRITE : order status advances through tool.requestObjects('update')
           (status, statusChangedAt and the optional acceptedAt /
           estimatedReadyAt fields). Never a direct database or REST
           call from the sandbox.
   ===================================================================== */

/* Tool build stamp - MANDATORY (html-tool-rules GLOBAL REQUIREMENT):
   bump on EVERY code change so stale CMS uploads are detectable. */
var TOOL_BUILD = '2026-10-30-3';
console.log('[TOOL:BOOT] build ' + TOOL_BUILD + ' RestaurantOrderTakingApp starting...');

(function () {
  'use strict';

  /* ----------------------------------------------------------- constants */

  var STATUS_FIELD = 'status';
  var STATUS_TIME_FIELD = 'statusChangedAt';
  var ACCEPTED_AT_FIELD = 'acceptedAt';
  var ETA_FIELD = 'estimatedReadyAt';

  var STATUS_NEW = 'new';
  var STATUS_ACCEPTED = 'accepted';
  var STATUS_PREP = 'in-preparation';
  var STATUS_READY = 'ready';
  var STATUS_DONE = 'completed';
  var STATUS_DECLINED = 'declined';
  var STATUS_CANCELLED = 'cancelled';

  var ACTIVE_STATUSES = [STATUS_NEW, STATUS_ACCEPTED, STATUS_PREP, STATUS_READY];
  var TERMINAL_STATUSES = [STATUS_DONE, STATUS_DECLINED, STATUS_CANCELLED];

  var STATUS_META = {
    'new': { label: 'New', cls: 'new', next: STATUS_ACCEPTED, nextLabel: 'Accept', tab: 'new', action: 'accept' },
    'accepted': { label: 'Accepted', cls: 'accepted', next: STATUS_PREP, nextLabel: 'Start prep', tab: 'progress', action: 'status' },
    'in-preparation': { label: 'In preparation', cls: 'prep', next: STATUS_READY, nextLabel: 'Mark ready', tab: 'progress', action: 'status' },
    'ready': { label: 'Ready', cls: 'ready', next: STATUS_DONE, nextLabel: 'Complete', tab: 'ready', action: 'status' },
    'completed': { label: 'Completed', cls: 'done', next: null, nextLabel: '', tab: 'finished', action: '' },
    'declined': { label: 'Declined', cls: 'declined', next: null, nextLabel: '', tab: 'finished', action: '' },
    'cancelled': { label: 'Cancelled', cls: 'cancelled', next: null, nextLabel: '', tab: 'finished', action: '' }
  };

  var TABS = [
    { id: 'all', label: 'All' },
    { id: 'new', label: 'New' },
    { id: 'progress', label: 'In progress' },
    { id: 'ready', label: 'Ready' },
    { id: 'finished', label: 'Finished' }
  ];

  var ORDER_FIELDS = [
    'orderNumber', 'placedAt', 'channel', 'customer', 'address',
    'customAddressFields', 'tableNumber', 'deliveryZone', 'scheduledFor',
    'paymentMethod', 'paymentDetails', 'lines', 'totals',
    'status', 'statusChangedAt', 'internalNote',
    ACCEPTED_AT_FIELD, ETA_FIELD
  ];

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

  var ETA_CHIPS = [15, 30, 45, 60, 90, 120];

  var MAX_BOARD_ITEMS = 200;
  var ARM_SECONDS = 6000;
  var UI_SAVE_DEBOUNCE = 300;
  var SEARCH_DEBOUNCE = 250;
  var URGENT_WINDOW_MINUTES = 5;

  /* --------------------------------------------------------------- state */

  var _orders = [];            /* normalized order list from the last load */
  var _orderById = {};         /* id -> normalized order */
  var _knownIds = {};          /* ids seen on the previous successful load */
  var _freshIds = {};          /* ids that appeared in the last load (new-order flash) */
  var _firstLoadDone = false;

  var _ui = { tab: 'all', sort: 'waiting', search: '' };
  var _lastStagedUi = '';
  var _saveUiTimer = null;

  var _detailId = '';
  var _acceptFor = '';         /* order id the accept modal is open for */
  var _etaMinutes = 0;         /* chosen minutes in the accept modal, 0 = none */
  var _armed = { orderId: '', status: '', timer: null };
  var _busy = {};              /* orderId -> true while a write is in flight */

  var _loading = false;
  var _error = '';
  var _lastRefreshAt = 0;

  var _readOnly = false;
  var _noIdentity = false;
  var _user = null;
  var _canWrite = false;
  var _wired = false;
  var _warnedAccess = false;
  var _pollTimer = null;
  var _tickTimer = null;
  var _searchTimer = null;

  var _cfg = {
    ordersType: 'restaurant-orders',
    autoRefreshSeconds: 20,
    newOrderNotifications: true,
    warnMinutes: 10,
    timeZone: '',
    currency: ''
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

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function fmtMoney(value) {
    var amount = num(value);
    if (_cfg.currency) {
      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: _cfg.currency,
          currencyDisplay: 'narrowSymbol',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(amount);
      } catch (err) { /* fall through to plain amount */ }
    }
    return amount.toFixed(2);
  }

  function fmtTime(tsOrIso) {
    if (!tsOrIso) return '';
    var date = new Date(tsOrIso);
    if (isNaN(date.getTime())) return '';
    var options = { hour: '2-digit', minute: '2-digit' };
    if (_cfg.timeZone) options.timeZone = _cfg.timeZone;
    try {
      return new Intl.DateTimeFormat(undefined, options).format(date);
    } catch (err) {
      return date.toLocaleTimeString();
    }
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

  function tsOf(iso) {
    if (!iso) return 0;
    var t = new Date(iso).getTime();
    return isNaN(t) ? 0 : t;
  }

  function minutesSince(iso) {
    var t = tsOf(iso);
    if (!t) return null;
    return Math.floor((Date.now() - t) / 60000);
  }

  function secondsSince(iso) {
    var t = tsOf(iso);
    if (!t) return null;
    return Math.max(0, Math.floor((Date.now() - t) / 1000));
  }

  /* Kitchen-style clock: "05:10", then "1h 05m" past an hour. */
  function fmtElapsedClock(seconds) {
    if (seconds === null || seconds === undefined) return '';
    if (seconds < 0) seconds = 0;
    if (seconds >= 3600) {
      var hours = Math.floor(seconds / 3600);
      var rest = Math.floor((seconds % 3600) / 60);
      return hours + 'h ' + pad2(rest) + 'm';
    }
    return pad2(Math.floor(seconds / 60)) + ':' + pad2(seconds % 60);
  }

  function fmtDurationMinutes(minutes) {
    if (minutes === null || minutes === undefined) return '';
    if (minutes < 1) return 'less than a minute';
    if (minutes < 60) return minutes + ' min';
    var hours = Math.floor(minutes / 60);
    var rest = minutes % 60;
    return hours + 'h' + (rest ? ' ' + rest + 'm' : '');
  }

  function isSameLocalDay(ts) {
    if (!ts) return false;
    var a = new Date(ts);
    var b = new Date();
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
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
    console.log('[RestaurantOrderTakingApp] ' + (severity || 'info') + ': ' + message);
  }

  /* --------------------------------------------- reading order records */

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

  function orderedBags(source) {
    var bags = collectBags(source);
    var scored = [];
    for (var b = 0; b < bags.length; b++) {
      var score = bagScore(bags[b]);
      if (score > 0) scored.push({ bag: bags[b], score: score });
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

  function statusKeyOf(status) {
    var key = String(status === undefined || status === null ? '' : status).toLowerCase().trim();
    if (STATUS_META[key]) return key;
    return '';
  }

  function normalizeOrder(obj) {
    var bags = orderedBags(obj);
    var order = {};
    for (var i = 0; i < ORDER_FIELDS.length; i++) {
      order[ORDER_FIELDS[i]] = readField(bags, ORDER_FIELDS[i]);
    }
    order.id = String(obj && (obj.id || obj._id) ? (obj.id || obj._id) : readField(bags, 'id') || '');
    order.name = obj && obj.name ? String(obj.name) : '';
    order.created = obj && obj.created ? String(obj.created) : '';
    order.updated = obj && obj.updated ? String(obj.updated) : '';

    var status = statusKeyOf(order.status);
    order.status = status || STATUS_NEW;           /* missing status = new (default per order app) */
    order.statusKnown = !!status;

    order.lines = asArray(order.lines);
    order.totals = asObject(order.totals) || {};
    order.customer = asObject(order.customer) || {};
    order.address = asObject(order.address);
    order.customAddressFields = asObject(order.customAddressFields);
    order.deliveryZone = asObject(order.deliveryZone);
    order.paymentDetails = asObject(order.paymentDetails) || {};

    order.totalNum = num(order.totals.total);
    order.placeTs = tsOf(order.placedAt);
    order.channelKey = String(order.channel || '').toLowerCase().trim();
    refreshDerivedOrderFields(order);
    return order;
  }

  /* Recomputes every field derived from the raw fields (status, dates).
     Runs on load AND after every local write so tabs, counts and board
     membership are correct IMMEDIATELY - an order that was just completed
     must show up in the Finished tab without waiting for the next poll. */
  function refreshDerivedOrderFields(order) {
    order.status = statusKeyOf(order.status) || STATUS_NEW;
    order.statusChangedTs = tsOf(order.statusChangedAt);
    order.isTerminal = TERMINAL_STATUSES.indexOf(order.status) !== -1;
    order.isActive = !order.isTerminal;
    order.isToday = order.placeTs ? isSameLocalDay(order.placeTs) : true;
    order.statusChangedToday = order.statusChangedTs ? isSameLocalDay(order.statusChangedTs) : order.isToday;
    /* Board window (D-ROTA-02 + D-ROTA-14): active orders always show;
       finished orders show when placed today OR when their status changed
       today (completing an order must never make it vanish). */
    order.onBoard = order.isActive || order.isToday || (order.isTerminal && order.statusChangedToday);
  }

  function findOrder(orderId) { return _orderById[orderId] || null; }

  function orderTitleOf(order) {
    var channel = channelMetaOf(order.channelKey);
    var customer = order.customer || {};
    if (order.tableNumber) return 'Table ' + order.tableNumber;
    if (customer.fullName || customer.name) return String(customer.fullName || customer.name);
    return channel.label + ' order';
  }

  function cardSublineOf(order) {
    if (order.tableNumber) return order.customer.fullName || order.customer.name || '';
    if (order.address) return addressFirstLine(order.address);
    return '';
  }

  function lineCountOf(order) {
    var count = 0;
    for (var i = 0; i < order.lines.length; i++) {
      count += num(order.lines[i].quantity) || 1;
    }
    return count;
  }

  function statusMetaOf(status) {
    return STATUS_META[status] || { label: 'New', cls: 'new', next: null, nextLabel: '', tab: 'new', action: '' };
  }

  function channelMetaOf(channelKey) {
    if (CHANNEL_META[channelKey]) return CHANNEL_META[channelKey];
    if (!channelKey) return { label: 'Order', icon: '\uD83E\uDD61' };
    return { label: channelKey, icon: '\uD83C\uDF7D' };
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

  function addressFirstLine(address) {
    if (!address || typeof address !== 'object') return '';
    if (address.street) return String(address.street);
    var bits = [];
    if (address.city) bits.push(String(address.city));
    if (address.postal_code || address.postalCode || address.zip) {
      bits.push(String(address.postal_code || address.postalCode || address.zip));
    }
    return bits.join(', ');
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
    if (!lines.length) {
      Object.keys(address).forEach(function (key) {
        var value = address[key];
        if (value === null || value === undefined || value === '') return;
        lines.push(key + ': ' + value);
      });
    }
    return lines;
  }

  /* ------------------------------------------------ admin-configured params */

  function paramRaw(name, fallback) {
    try {
      if (typeof tool === 'undefined' || typeof tool.param !== 'function') return fallback;
      var value = tool.param(name, fallback);
      return (value === undefined || value === null || value === '') ? fallback : value;
    } catch (err) { return fallback; }
  }

  function readConfig() {
    _cfg.ordersType = String(paramRaw('ordersObjectType', 'restaurant-orders')).trim() || 'restaurant-orders';
    var refresh = parseInt(String(paramRaw('autoRefreshSeconds', '20')), 10);
    _cfg.autoRefreshSeconds = (isFinite(refresh) && refresh >= 0) ? refresh : 20;
    var notifyRaw = String(paramRaw('newOrderNotifications', 'yes')).toLowerCase();
    _cfg.newOrderNotifications = notifyRaw !== 'no';
    var warn = parseInt(String(paramRaw('newOrderWarningMinutes', '10')), 10);
    _cfg.warnMinutes = (isFinite(warn) && warn >= 0) ? warn : 10;
    _cfg.timeZone = String(paramRaw('restaurantTimezone', '')).trim();
    _cfg.currency = String(paramRaw('currencyCode', 'USD')).trim().toUpperCase();
  }

  function declareToolParams() {
    if (typeof tool === 'undefined' || typeof tool.declareParams !== 'function') return;
    try {
      tool.declareParams([
        {
          name: 'allowObjectCRUD', label: 'Allow Object CRUD',
          type: 'toggle', default: 'yes', severity: 'mandatory',
          hint: 'The CMS field setting (settings.allowObjectCRUD) that enables tool.requestObjects, which this board reads and writes orders through.'
        },
        {
          name: 'allowedObjectTypes', label: 'Allowed Object Types',
          type: 'text', default: '', severity: 'goodToHave',
          hint: 'CMS field setting (settings.allowedObjectTypes) listing the order type, e.g. { mainObjectType: "restaurant-orders", role: "editor", scope: "shared" }. Set in the Field Group Designer, not as a text param.'
        },
        {
          name: 'ordersObjectType', label: 'Orders object type',
          type: 'text', default: 'restaurant-orders', severity: 'goodToHave',
          hint: 'CMS object type holding the order records. Default restaurant-orders.'
        },
        {
          name: 'autoRefreshSeconds', label: 'Auto refresh (seconds)',
          type: 'number', default: '20', severity: 'goodToHave',
          hint: 'How often the board quietly reloads the order list. 0 turns auto refresh off.'
        },
        {
          name: 'newOrderNotifications', label: 'New-order notifications',
          type: 'toggle', default: 'yes', severity: 'optional',
          hint: 'Show a toast when an order with status new appears while the board is open.'
        },
        {
          name: 'newOrderWarningMinutes', label: 'New-order warning (minutes)',
          type: 'number', default: '10', severity: 'optional',
          hint: 'Highlight a new order card when it has been waiting longer than this many minutes.'
        },
        {
          name: 'restaurantTimezone', label: 'Restaurant timezone',
          type: 'text', default: '', severity: 'goodToHave',
          hint: 'IANA timezone used to display times, for example Europe/Istanbul or America/New_York. Empty = the viewer timezone.'
        },
        {
          name: 'currencyCode', label: 'Currency code',
          type: 'text', default: '', severity: 'goodToHave',
          hint: 'ISO 4217 currency code used to format totals, for example USD, EUR, TRY. Empty = plain amounts.'
        }
      ]);
    } catch (err) {
      console.warn('[RestaurantOrderTakingApp] declareParams failed', err);
    }
  }

  function reportMissingConfig() {
    var missing = [];
    if (String(paramRaw('allowObjectCRUD', '')).toLowerCase() !== 'yes') {
      missing.push({
        name: 'allowObjectCRUD', label: 'Allow Object CRUD',
        type: 'toggle', default: 'yes',
        hint: 'Enable settings.allowObjectCRUD on this html-tool field so the board can load and update orders.',
        reason: 'The board reads and writes order records through the CMS object relay.',
        severity: 'mandatory'
      });
    }
    if (missing.length && typeof tool.reportMissingParams === 'function') {
      try {
        tool.reportMissingParams(missing, 'This tool needs CMS object access configured before the orders board can work.');
      } catch (err) { /* ignore */ }
    }
  }

  /* ------------------------------------------------------- own UI state */

  function readSavedUi() {
    try {
      if (typeof tool.getValue === 'function') {
        var value = tool.getValue();
        if (value && typeof value === 'object' && value.ui && typeof value.ui === 'object') {
          var ui = value.ui;
          if (TABS.some(function (t) { return t.id === ui.tab; })) _ui.tab = ui.tab;
          if (ui.sort === 'waiting' || ui.sort === 'newest' || ui.sort === 'total') _ui.sort = ui.sort;
          if (typeof ui.search === 'string') _ui.search = ui.search;
        }
      }
    } catch (err) { /* ignore */ }
    _lastStagedUi = JSON.stringify(_ui);
  }

  function persistUiSoon() {
    if (_saveUiTimer) clearTimeout(_saveUiTimer);
    _saveUiTimer = setTimeout(persistUiNow, UI_SAVE_DEBOUNCE);
  }

  function persistUiNow() {
    if (_saveUiTimer) { clearTimeout(_saveUiTimer); _saveUiTimer = null; }
    var json = JSON.stringify(_ui);
    if (json === _lastStagedUi) return;
    _lastStagedUi = json;
    try {
      tool.setValue({ version: '1', ui: _ui });
    } catch (err) { /* ignore */ }
  }

  /* -------------------------------------------------------------- list */

  function boardOrders() {
    var list = [];
    for (var i = 0; i < _orders.length; i++) {
      if (_orders[i].onBoard) list.push(_orders[i]);
    }
    return list;
  }

  function tabOrders(tabId) {
    var list = boardOrders();
    if (tabId === 'all') return list;
    if (tabId === 'new') return list.filter(function (o) { return o.status === STATUS_NEW; });
    if (tabId === 'progress') {
      return list.filter(function (o) { return o.status === STATUS_ACCEPTED || o.status === STATUS_PREP; });
    }
    if (tabId === 'ready') return list.filter(function (o) { return o.status === STATUS_READY; });
    if (tabId === 'finished') return list.filter(function (o) { return o.isTerminal; });
    return list;
  }

  function tabCounts() {
    var counts = {};
    for (var t = 0; t < TABS.length; t++) counts[TABS[t].id] = tabOrders(TABS[t].id).length;
    return counts;
  }

  function matchesSearch(order, query) {
    if (!query) return true;
    var hay = [
      order.orderNumber, order.name, order.tableNumber,
      order.customer.fullName, order.customer.name, order.customer.phone,
      addressLines(order.address).join(' '),
      order.address && order.address.street ? String(order.address.street) : ''
    ].join(' ').toLowerCase();
    return hay.indexOf(query) !== -1;
  }

  function sortOrders(list) {
    var sortKey = _ui.sort;
    var sorted = list.slice();
    sorted.sort(function (a, b) {
      if (sortKey === 'newest') return (b.placeTs - a.placeTs) || a.id.localeCompare(b.id);
      if (sortKey === 'total') return (b.totalNum - a.totalNum) || (a.placeTs - b.placeTs);
      /* waiting - active first (longest waiting at the top), then finished */
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (!a.isActive) return b.placeTs - a.placeTs;
      return (a.placeTs || Infinity) - (b.placeTs || Infinity) || a.id.localeCompare(b.id);
    });
    return sorted;
  }

  function boardListFor(tabId) {
    var list = tabOrders(tabId);
    var query = String(_ui.search || '').toLowerCase().trim();
    if (query) list = list.filter(function (o) { return matchesSearch(o, query); });
    return sortOrders(list);
  }

  /* ------------------------------------------------------------- loading */

  function loadOrders(silent) {
    if (typeof tool === 'undefined' || typeof tool.requestObjects !== 'function') {
      setError('Object access is not available in this environment.');
      return;
    }
    if (_loading) return;
    _loading = true;
    if (!silent && !_orders.length) renderBoard();
    _error = '';
    tool.requestObjects('query', { mainObjectType: _cfg.ordersType }, function (err, result) {
      _loading = false;
      if (err) {
        setError(err);
        return;
      }
      var rawList = (result && Array.isArray(result.objects)) ? result.objects : [];
      applyOrders(rawList);
      _firstLoadDone = true;
      _lastRefreshAt = Date.now();
      renderAll();
    });
  }

  function applyOrders(rawList) {
    var next = [];
    var nextById = {};
    var freshIds = {};
    var announce = _firstLoadDone && _cfg.newOrderNotifications;
    var markFresh = _firstLoadDone; /* the FIRST load is the baseline - never flash it (D-ROTA-16) */
    for (var i = 0; i < rawList.length; i++) {
      var order = normalizeOrder(rawList[i]);
      if (!order.id) continue;
      next.push(order);
      nextById[order.id] = order;
      if (!_knownIds[order.id]) {
        if (markFresh) freshIds[order.id] = true;
        if (announce && order.status === STATUS_NEW) {
          notify('New order ' + (order.orderNumber || order.id) + ' - ' + orderTitleOf(order), 'info');
        }
      }
    }
    _orders = next;
    _orderById = nextById;
    _knownIds = {};
    for (var k = 0; k < next.length; k++) _knownIds[next[k].id] = true;
    _freshIds = freshIds;
  }

  function softRefresh() {
    if (_loading) return;
    loadOrders(true);
  }

  function setError(message) {
    _error = String(message || '');
    renderBoard();
    renderTop();
    if (!_warnedAccess) {
      _warnedAccess = true;
      console.warn('[RestaurantOrderTakingApp] object query failed: ' + message);
      console.warn('[RestaurantOrderTakingApp] the CMS field needs settings.allowObjectCRUD = "yes" and an allowedObjectTypes entry, e.g. { mainObjectType: "' + _cfg.ordersType + '", role: "editor", scope: "shared", targetCollection: "public" }');
      notify('Could not load orders - check the object access settings for this tool.', 'warning');
    }
  }

  /* ------------------------------------------------------- write actions */

  function isBusy(orderId) { return !!_busy[orderId]; }

  function setBusy(orderId, busy) {
    if (busy) _busy[orderId] = true;
    else delete _busy[orderId];
    renderActionsInPlace(orderId);
  }

  function applyPatchLocal(orderId, patch) {
    var order = findOrder(orderId);
    if (!order) return;
    for (var key in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) order[key] = patch[key];
    }
    if (patch.status) order.status = statusKeyOf(patch.status) || patch.status;
    if (patch.totals) order.totals = asObject(patch.totals) || {};
    refreshDerivedOrderFields(order);
  }

  function writeCoreFields(orderId, corePatch, extraPatch, successMessage) {
    setBusy(orderId, true);
    tool.requestObjects('update', {
      mainObjectType: _cfg.ordersType,
      objectId: orderId,
      productData: { data_categoriesBased: corePatch }
    }, function (err) {
      if (err) {
        setBusy(orderId, false);
        console.warn('[RestaurantOrderTakingApp] update failed: ' + err);
        notify('Could not save the change. Please try again.', 'error');
        return;
      }
      applyPatchLocal(orderId, corePatch);
      if (extraPatch && Object.keys(extraPatch).length) {
        tool.requestObjects('update', {
          mainObjectType: _cfg.ordersType,
          objectId: orderId,
          productData: { data_categoriesBased: extraPatch }
        }, function (extraErr) {
          if (extraErr) {
            console.warn('[RestaurantOrderTakingApp] optional fields not saved: ' + extraErr);
          } else {
            applyPatchLocal(orderId, extraPatch);
          }
          setBusy(orderId, false);
          afterStatusChange(orderId, successMessage);
        });
      } else {
        setBusy(orderId, false);
        afterStatusChange(orderId, successMessage);
      }
    });
  }

  function afterStatusChange(orderId, successMessage) {
    clearArm(false);
    if (successMessage) notify(successMessage, 'success');
    renderAll();
    setTimeout(softRefresh, 700);
  }

  function setOrderStatus(orderId, newStatus, successMessage, chosenEtaMinutes) {
    var order = findOrder(orderId);
    if (!order) return;
    if (_readOnly || !_canWrite) { notify('You cannot change orders in this view.', 'warning'); return; }
    if (isBusy(orderId)) return;
    newStatus = statusKeyOf(newStatus);
    if (!newStatus || !STATUS_META[newStatus]) return;
    if (order.status === newStatus) { clearArm(true); return; }

    var nowIso = new Date().toISOString();
    var corePatch = {};
    corePatch[STATUS_FIELD] = newStatus;
    corePatch[STATUS_TIME_FIELD] = nowIso;
    var extraPatch = null;

    if (newStatus === STATUS_ACCEPTED) {
      extraPatch = {};
      extraPatch[ACCEPTED_AT_FIELD] = nowIso;
      var etaMinutes = (chosenEtaMinutes === undefined || chosenEtaMinutes === null) ? _etaMinutes : chosenEtaMinutes;
      if (etaMinutes > 0) extraPatch[ETA_FIELD] = new Date(Date.now() + etaMinutes * 60000).toISOString();
    }

    writeCoreFields(orderId, corePatch, extraPatch, successMessage);
  }

  function acceptOrder(orderId) {
    var order = findOrder(orderId);
    if (!order) return;
    if (_readOnly || !_canWrite) { notify('You cannot change orders in this view.', 'warning'); return; }
    if (isBusy(orderId)) return;
    if (order.status !== STATUS_NEW) {
      closeModal();
      notify('This order is no longer waiting - the board refreshed.', 'warning');
      softRefresh();
      return;
    }
    var chosenMinutes = _etaMinutes;
    var message = 'Order ' + (order.orderNumber || order.id) + ' accepted' +
      (chosenMinutes > 0 ? ' - estimated ' + etaKindLabel(order) + ' ' + fmtTime(Date.now() + chosenMinutes * 60000) : '') + '.';
    closeModal();
    setOrderStatus(orderId, STATUS_ACCEPTED, message, chosenMinutes);
  }

  function etaKindLabel(order) {
    return order.channelKey === 'delivery' ? 'delivery time' : 'ready time';
  }

  /* ----------------------------------------------------- armed two-step */

  function armStatus(orderId, status) {
    if (_readOnly || !_canWrite) { notify('You cannot change orders in this view.', 'warning'); return; }
    if (isBusy(orderId)) return;
    _armed.orderId = orderId;
    _armed.status = status;
    if (_armed.timer) clearTimeout(_armed.timer);
    _armed.timer = setTimeout(function () {
      _armed.orderId = '';
      _armed.status = '';
      _armed.timer = null;
      renderActionsInPlace(orderId);
      if (_detailId === orderId) renderDetail();
    }, ARM_SECONDS);
    renderActionsInPlace(orderId);
    if (_detailId === orderId) renderDetail();
  }

  function clearArm(reRender) {
    var wasOrderId = _armed.orderId;
    _armed.orderId = '';
    _armed.status = '';
    if (_armed.timer) { clearTimeout(_armed.timer); _armed.timer = null; }
    if (reRender && wasOrderId) renderActionsInPlace(wasOrderId);
  }

  /* ----------------------------------------------------------- rendering */

  function setText(id, text) {
    var el = $id(id);
    if (el) el.textContent = (text === undefined || text === null) ? '' : String(text);
  }

  function renderTop() {
    var list = boardOrders();
    var waiting = 0;
    var ready = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].status === STATUS_NEW) waiting++;
      else if (list[i].status === STATUS_READY) ready++;
    }
    var parts = [];
    if (_loading && !list.length) parts.push('Loading orders');
    else {
      parts.push(list.length + (list.length === 1 ? ' order' : ' orders') + ' on the board');
      parts.push(waiting + ' waiting');
      parts.push(ready + ' ready');
    }
    if (_error) parts.push('offline');
    setText('roa-top-sub', parts.join(' - '));
  }

  function renderTabs() {
    var host = $id('roa-tabs');
    if (!host) return;
    var counts = tabCounts();
    var html = '';
    for (var i = 0; i < TABS.length; i++) {
      var tab = TABS[i];
      html += '<button type="button" class="roa-tab roa-tab-' + esc(tab.id) + (tab.id === _ui.tab ? ' roa-tab-on' : '') + '" data-act="tab" data-tab="' + esc(tab.id) + '">' +
        esc(tab.label) +
        '<span class="roa-tab-count">' + esc(String(counts[tab.id])) + '</span>' +
        '</button>';
    }
    host.innerHTML = html;
  }

  function renderBoard() {
    var host = $id('roa-board');
    var state = $id('roa-state');
    if (!host || !state) return;

    if (_loading && !_orders.length) {
      state.hidden = false;
      state.innerHTML = 'Loading orders...';
      host.innerHTML = '';
      return;
    }
    if (_error) {
      state.hidden = false;
      state.innerHTML = 'Could not load orders. ' +
        '<button type="button" class="roa-btn roa-btn-ghost roa-btn-small" data-act="retry">Try again</button>';
      host.innerHTML = '';
      return;
    }

    var list = boardListFor(_ui.tab);
    if (!list.length) {
      state.hidden = false;
      if (!boardOrders().length) {
        state.innerHTML = 'No orders yet. When a customer places an order, it appears here automatically.';
      } else if (_ui.search) {
        state.innerHTML = 'No orders match the current search.';
      } else {
        state.innerHTML = 'Nothing in this column right now.';
      }
      host.innerHTML = '';
      return;
    }

    state.hidden = true;
    var html = '';
    var cap = Math.min(list.length, MAX_BOARD_ITEMS);
    for (var i = 0; i < cap; i++) html += cardHtml(list[i]);
    host.innerHTML = html;
    setText('roa-loaded', cap + ' of ' + list.length + ' shown');
  }

  /* Countdown to the estimated ready/delivery time. Before the target it
     shows "in MM:SS"; inside the last few minutes it turns amber (urgent);
     after the target it shows "LATE MM:SS" in red. */
  function countdownState(etaTs) {
    var remainingMs = etaTs - Date.now();
    if (remainingMs > 0) {
      var urgent = remainingMs <= URGENT_WINDOW_MINUTES * 60000;
      return { late: false, urgent: urgent, text: 'in ' + fmtElapsedClock(Math.ceil(remainingMs / 1000)) };
    }
    return { late: true, urgent: false, text: 'LATE ' + fmtElapsedClock(Math.ceil(-remainingMs / 1000)) };
  }

  function countdownHtml(etaTs) {
    var state = countdownState(etaTs);
    var extraClass = state.late ? ' roa-countdown-late' : (state.urgent ? ' roa-countdown-urgent' : '');
    return '<span class="roa-countdown' + extraClass + '" data-ts="' + esc(String(etaTs)) + '">' + esc(state.text) + '</span>';
  }

  function cardHtml(order) {
    var meta = statusMetaOf(order.status);
    var channel = channelMetaOf(order.channelKey);
    var waitingMinutes = order.isTerminal ? null : minutesSince(order.placedAt);
    var warn = !order.isTerminal && order.status === STATUS_NEW && waitingMinutes !== null && waitingMinutes >= _cfg.warnMinutes;
    var fresh = !!_freshIds[order.id];

    var elapsedFrom = (order.status === STATUS_READY && order.statusChangedAt) ? order.statusChangedAt : order.placedAt;
    var elapsedClass = 'roa-elapsed' +
      (order.status === STATUS_READY ? ' roa-elapsed-ready' : '') +
      (warn ? ' roa-elapsed-warn' : '');

    var etaState = null;
    if (!order.isTerminal && order[ETA_FIELD]) etaState = countdownState(tsOf(order[ETA_FIELD]));
    var etaCardClass = etaState ? (etaState.late ? ' roa-card-late' : (etaState.urgent ? ' roa-card-urgent' : '')) : '';

    var html = '<article class="roa-card st-' + esc(meta.cls) +
      (warn ? ' roa-card-warn' : '') +
      etaCardClass +
      (fresh ? ' roa-card-fresh' : '') + '" data-id="' + esc(order.id) + '">';

    html += '<div class="roa-card-top">';
    html += '<span class="roa-channel">' + esc(channel.icon + ' ' + channel.label) + '</span>';
    if (order.isTerminal) {
      html += '<span class="roa-elapsed">' + (order.placeTs ? esc(fmtTime(order.placeTs)) : '') + '</span>';
    } else {
      html += '<span class="' + elapsedClass + '" data-id="' + esc(order.id) + '" data-ts="' + esc(String(tsOf(elapsedFrom))) + '" data-status="' + esc(order.status) + '"></span>';
    }
    html += '</div>';

    html += '<h3 class="roa-card-name">' + esc(orderTitleOf(order)) + '</h3>';

    var sub = cardSublineOf(order);
    html += '<div class="roa-card-sub">';
    html += '<span class="roa-order-no">' + esc(order.orderNumber || ('#' + order.id)) + '</span>';
    if (order.placeTs) html += '<span>' + esc(fmtTime(order.placeTs)) + '</span>';
    if (sub) html += '<span>' + esc(sub) + '</span>';
    html += '</div>';

    html += '<div class="roa-card-meta">';
    html += '<span class="roa-status st-' + esc(meta.cls) + '">' + esc(meta.label) + '</span>';
    if (!order.isTerminal && order[ETA_FIELD]) {
      html += '<span class="roa-est">est. ' + esc(etaKindLabel(order)) + ' ' + esc(fmtTime(order[ETA_FIELD])) + '</span>';
      html += countdownHtml(tsOf(order[ETA_FIELD]));
    }
    html += '</div>';

    var items = lineCountOf(order);
    html += '<div class="roa-card-foot">';
    html += '<div class="roa-card-actions">' + cardActionsHtml(order) + '</div>';
    html += '<span class="roa-card-total" title="' + esc(String(items)) + ' item' + (items === 1 ? '' : 's') + '">' + esc(fmtMoney(order.totalNum)) + '</span>';
    html += '</div>';

    if (order.internalNote) {
      html += '<p class="roa-card-note">' + esc(String(order.internalNote).slice(0, 140)) + '</p>';
    }

    html += '</article>';
    return html;
  }

  function armedConfirmHtml() {
    var label = statusMetaOf(_armed.status).label;
    return '<button type="button" class="roa-btn roa-btn-danger roa-btn-small" data-act="confirm-status">Confirm ' + esc(label.toLowerCase()) + '</button>' +
      '<button type="button" class="roa-btn roa-btn-ghost roa-btn-small" data-act="unarm">Keep</button>';
  }

  function cardActionsHtml(order) {
    if (_readOnly || !_canWrite) {
      if (order.isTerminal) return '';
      return '<button type="button" class="roa-btn roa-btn-ghost roa-btn-small" data-act="card-open">Open</button>';
    }
    if (isBusy(order.id)) {
      return '<button type="button" class="roa-btn roa-btn-ghost roa-btn-small" disabled>Saving...</button>';
    }
    if (_armed.orderId === order.id) return armedConfirmHtml();

    var meta = statusMetaOf(order.status);
    var html = '';
    if (meta.next) {
      html += '<button type="button" class="roa-btn roa-btn-primary roa-btn-small" data-act="' + esc(meta.action) + '" data-status="' + esc(meta.next) + '">' + esc(meta.nextLabel) + '</button>';
    }
    if (order.status === STATUS_NEW) {
      html += '<button type="button" class="roa-btn roa-btn-ghost roa-btn-small" data-act="arm-status" data-status="' + STATUS_DECLINED + '">Decline</button>';
    } else if (order.status === STATUS_ACCEPTED || order.status === STATUS_PREP || order.status === STATUS_READY) {
      html += '<button type="button" class="roa-btn roa-btn-ghost roa-btn-small" data-act="arm-status" data-status="' + STATUS_CANCELLED + '">Cancel</button>';
    }
    return html;
  }

  function renderActionsInPlace(orderId) {
    if (!orderId) return;
    var order = findOrder(orderId);
    if (!order) return;
    var card = document.querySelector('.roa-card[data-id="' + orderId + '"]');
    if (card) {
      var wrap = card.querySelector('.roa-card-actions');
      if (wrap) wrap.innerHTML = cardActionsHtml(order);
    }
    if (_detailId === orderId) {
      var detailActions = $id('roa-detail-actions');
      if (detailActions) detailActions.innerHTML = detailActionsHtml(order);
    }
  }

  function updateElapsedSpans() {
    var spans = document.querySelectorAll('.roa-elapsed[data-id]');
    for (var i = 0; i < spans.length; i++) {
      var span = spans[i];
      var ts = parseInt(span.getAttribute('data-ts') || '0', 10);
      if (!ts) continue;
      span.textContent = fmtElapsedClock(secondsSince(ts));
    }

    var countdowns = document.querySelectorAll('.roa-countdown[data-ts]');
    for (var c = 0; c < countdowns.length; c++) {
      var countdownSpan = countdowns[c];
      var etaTs = parseInt(countdownSpan.getAttribute('data-ts') || '0', 10);
      if (!etaTs) continue;
      var state = countdownState(etaTs);
      countdownSpan.textContent = state.text;
      countdownSpan.classList.toggle('roa-countdown-late', state.late);
      countdownSpan.classList.toggle('roa-countdown-urgent', !!state.urgent);
      var card = countdownSpan.closest ? countdownSpan.closest('.roa-card') : null;
      if (card) {
        card.classList.toggle('roa-card-late', state.late);
        card.classList.toggle('roa-card-urgent', !!state.urgent);
      }
    }
  }

  function renderFoot() {
    setText('roa-refreshed', _lastRefreshAt ? ('Updated ' + fmtTime(_lastRefreshAt)) : '');
  }

  function renderConfigBanner() {
    var banner = $id('roa-config');
    if (!banner) return;
    if (String(paramRaw('allowObjectCRUD', '')).toLowerCase() !== 'yes') {
      banner.hidden = false;
      banner.textContent = 'Object access is not configured - the board cannot load orders. Enable allowObjectCRUD and add the order type to allowedObjectTypes in the CMS field settings (details in the console).';
    } else {
      banner.hidden = true;
    }
  }

  function renderReadonlyBanner() {
    var banner = $id('roa-readonly');
    if (!banner) return;
    if (_readOnly) {
      banner.hidden = false;
      banner.textContent = 'Read-only view - you can watch the board but not change order statuses.';
    } else {
      banner.hidden = true;
    }
  }

  function renderSearchSort() {
    var search = $id('roa-search');
    var sort = $id('roa-sort');
    if (search && document.activeElement !== search) search.value = _ui.search;
    if (sort) sort.value = _ui.sort;
  }

  function renderAll() {
    renderTop();
    renderTabs();
    renderBoard();
    renderSearchSort();
    renderFoot();
    renderReadonlyBanner();
    renderConfigBanner();
    if (_detailId) renderDetail();
    updateElapsedSpans();
    requestResize();
  }

  /* ------------------------------------------------------- detail view */

  function openDetail(orderId) {
    var order = findOrder(orderId);
    if (!order) return;
    _detailId = orderId;
    closeModal();
    renderDetail();
  }

  function closeDetail() {
    _detailId = '';
    clearArm(false);
    var detail = $id('roa-detail');
    if (detail) detail.hidden = true;
    requestResize();
  }

  function detailActionsHtml(order) {
    if (_readOnly || !_canWrite) {
      return '<button type="button" class="roa-btn roa-btn-ghost roa-btn-small" data-act="detail-open-cms">Open in CMS</button>';
    }
    if (isBusy(order.id)) {
      return '<button type="button" class="roa-btn roa-btn-ghost roa-btn-small" disabled>Saving...</button>';
    }
    if (_armed.orderId === order.id) {
      return armedConfirmHtml() + ' <span class="roa-est">this action cannot be undone from the board</span>';
    }
    var meta = statusMetaOf(order.status);
    var html = '';
    if (meta.next) {
      html += '<button type="button" class="roa-btn roa-btn-primary" data-act="' + esc(meta.action) + '" data-status="' + esc(meta.next) + '">' + esc(meta.nextLabel) + '</button>';
    }
    if (order.status === STATUS_NEW) {
      html += '<button type="button" class="roa-btn roa-btn-ghost" data-act="arm-status" data-status="' + STATUS_DECLINED + '">Decline order</button>';
    } else if (order.status === STATUS_ACCEPTED || order.status === STATUS_PREP || order.status === STATUS_READY) {
      html += '<button type="button" class="roa-btn roa-btn-ghost" data-act="arm-status" data-status="' + STATUS_CANCELLED + '">Cancel order</button>';
    }
    html += '<button type="button" class="roa-btn roa-btn-ghost" data-act="detail-open-cms">Open in CMS</button>';
    return html;
  }

  function rowHtml(label, value, valueClass) {
    return '<div class="roa-row"><span class="roa-k">' + esc(label) + '</span>' +
      '<span class="roa-v' + (valueClass ? ' ' + valueClass : '') + '">' + esc(value) + '</span></div>';
  }

  function renderDetail() {
    var host = $id('roa-detail');
    if (!host) return;
    var order = findOrder(_detailId);
    if (!order) { closeDetail(); return; }
    host.hidden = false;

    var meta = statusMetaOf(order.status);
    var channel = channelMetaOf(order.channelKey);
    var customer = order.customer || {};

    var html = '<div class="roa-detail-shell">';
    html += '<div class="roa-detail-head">';
    html += '<button type="button" class="roa-btn roa-btn-ghost roa-btn-small" data-act="detail-back">&#8592; Back to orders</button>';
    html += '<div class="roa-detail-title">';
    html += '<span class="roa-channel">' + esc(channel.icon + ' ' + channel.label) + '</span>';
    html += '<span class="roa-detail-number">' + esc(order.orderNumber || ('#' + order.id)) + '</span>';
    html += '<span class="roa-status st-' + esc(meta.cls) + '">' + esc(meta.label) + '</span>';
    html += '</div>';
    html += '<div class="roa-detail-actions" id="roa-detail-actions">' + detailActionsHtml(order) + '</div>';
    html += '<button type="button" class="roa-modal-x" data-act="detail-back" aria-label="Close">&#10005;</button>';
    html += '</div>';

    html += '<div class="roa-detail-grid">';

    /* side column */
    html += '<div class="roa-detail-side">';

    html += '<section class="roa-block"><h3 class="roa-block-title">Customer</h3>';
    html += rowHtml('Name', customer.fullName || customer.name || '-');
    var phone = customer.phone || '';
    if (phone) {
      html += '<div class="roa-row"><span class="roa-k">Phone</span><span class="roa-v">' +
        '<button type="button" class="roa-link" data-act="call" data-phone="' + esc(phone) + '">' + esc(phone) + '</button></span></div>';
    }
    if (order.tableNumber) html += rowHtml('Table', order.tableNumber);
    var address = order.address;
    if (address) {
      var addrLines = addressLines(address);
      if (addrLines.length) {
        html += '<div class="roa-row roa-row-block"><span class="roa-k">Address</span>' +
          '<span class="roa-v roa-addr">' + addrLines.map(esc).join('<br>') + '</span></div>';
      }
    }
    var customFields = order.customAddressFields;
    if (customFields) {
      Object.keys(customFields).forEach(function (key) {
        var value = customFields[key];
        if (value === null || value === undefined || value === '') return;
        html += rowHtml(key, value);
      });
    }
    html += '</section>';

    html += '<section class="roa-block"><h3 class="roa-block-title">Timing</h3>';
    if (order.placedAt) html += rowHtml('Placed on', fmtDateTime(order.placedAt));
    if (order.scheduledFor) html += rowHtml('Scheduled for', fmtDateTime(order.scheduledFor));
    if (order[ACCEPTED_AT_FIELD]) html += rowHtml('Accepted on', fmtDateTime(order[ACCEPTED_AT_FIELD]));
    if (order.statusChangedAt) html += rowHtml('Status changed', fmtDateTime(order.statusChangedAt));
    if (order[ETA_FIELD]) {
      html += rowHtml('Estimated ' + etaKindLabel(order), fmtDateTime(order[ETA_FIELD]));
      html += '<div class="roa-row"><span class="roa-k">Countdown</span><span class="roa-v">' + countdownHtml(tsOf(order[ETA_FIELD])) + '</span></div>';
    }
    html += '</section>';

    html += '<section class="roa-block"><h3 class="roa-block-title">Payment</h3>';
    html += rowHtml('Method', paymentLabelOf(order.paymentMethod) || 'Not selected');
    var details = order.paymentDetails || {};
    if (details.provider) html += rowHtml('Provider', details.provider);
    var card = cardSummary(details.card);
    if (card) html += rowHtml('Card', card);
    html += '</section>';

    var zone = order.deliveryZone;
    if (zone || order.channelKey === 'delivery') {
      html += '<section class="roa-block"><h3 class="roa-block-title">Delivery zone</h3>';
      if (zone) html += rowHtml('Zone', zone.name || zone.id || '-');
      if (order.totals.deliveryFee !== undefined && order.totals.deliveryFee !== null && order.totals.deliveryFee !== '') {
        html += rowHtml('Delivery fee', fmtMoney(order.totals.deliveryFee));
      }
      html += '</section>';
    }

    html += '</div>';

    /* main column */
    html += '<div class="roa-detail-main">';

    html += '<section class="roa-block"><h3 class="roa-block-title">Order lines</h3>';
    html += linesHtml(order);
    html += '</section>';

    html += '<section class="roa-block">' + totalsHtml(order) + '</section>';

    if (order.internalNote) {
      html += '<section class="roa-block"><h3 class="roa-block-title">Internal note</h3>' +
        '<div class="roa-note-box">' + esc(String(order.internalNote)) + '</div></section>';
    }

    html += '</div>';
    html += '</div>';
    html += '</div>'; /* /roa-detail-shell */

    host.innerHTML = html;
    updateElapsedSpans();
    requestResize();
  }

  function modifierTotal(line) {
    var entries = asArray(line.modifierEntries);
    var total = 0;
    for (var i = 0; i < entries.length; i++) {
      total += num(entries[i].priceAdjustment) * (num(entries[i].quantity) || 1);
    }
    return total;
  }

  function linesHtml(order) {
    if (!order.lines.length) {
      return '<div class="roa-empty-inline">No line items on this order.</div>';
    }
    var html = '<div class="roa-lines">';
    for (var i = 0; i < order.lines.length; i++) html += lineHtml(order.lines[i]);
    html += '</div>';
    return html;
  }

  function lineHtml(line) {
    if (!line || typeof line !== 'object') return '';
    var quantity = num(line.quantity) || 1;
    var baseUnit = num(line.unitPrice);
    var modifierSum = modifierTotal(line);
    var lineTotal = (baseUnit + modifierSum) * quantity;

    var html = '<div class="roa-line">';
    html += '<div class="roa-line-main">';
    html += '<div class="roa-line-title">';
    html += '<span class="roa-qty">' + esc(String(quantity)) + ' x</span>';
    html += '<span class="roa-item">' + esc(line.itemName || line.internalName || 'Item') + '</span>';
    if (line.sizeLabel) html += '<span class="roa-size">' + esc(line.sizeLabel) + '</span>';
    html += '</div>';

    if (line.internalName && line.internalName !== line.itemName) {
      html += '<div class="roa-line-internal">' + esc(line.internalName) + '</div>';
    }

    var entries = asArray(line.modifierEntries);
    if (entries.length) {
      html += '<ul class="roa-mods">';
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i] || {};
        var entryQty = num(entry.quantity);
        html += '<li>';
        html += '<span class="roa-mod-name">' + esc(entry.optionName || entry.optionId || 'Option') + '</span>';
        if (entryQty > 1) html += ' <span class="roa-mod-qty">x' + esc(String(entryQty)) + '</span>';
        if (num(entry.priceAdjustment) !== 0) {
          html += ' <span class="roa-mod-price">' + (num(entry.priceAdjustment) > 0 ? '+' : '') +
            esc(fmtMoney(entry.priceAdjustment)) + '</span>';
        }
        if (entry.groupName) html += ' <span class="roa-mod-group">' + esc(entry.groupName) + '</span>';
        if (entry.internalName) html += ' <span class="roa-mod-group">' + esc(entry.internalName) + '</span>';
        html += '</li>';
      }
      html += '</ul>';
    }

    if (line.instructions) html += '<div class="roa-instr">Note: ' + esc(line.instructions) + '</div>';

    html += '</div>';
    html += '<div class="roa-line-price">';
    html += '<span class="roa-unit">' + esc(fmtMoney(baseUnit)) + '</span>';
    if (modifierSum) {
      html += '<span class="roa-unit-note">' + (modifierSum > 0 ? '+' : '') + esc(fmtMoney(modifierSum)) + '</span>';
    }
    html += '<span class="roa-line-total">' + esc(fmtMoney(lineTotal)) + '</span>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  function totalsHtml(order) {
    var totals = order.totals || {};
    var rows = '';
    var hasAny = false;

    function totalRow(label, value) {
      if (value === undefined || value === null || value === '') return '';
      hasAny = true;
      return '<div class="roa-total-row"><span>' + esc(label) + '</span><span>' + esc(fmtMoney(value)) + '</span></div>';
    }

    rows += totalRow('Subtotal', totals.subtotal);
    rows += totalRow('Tax', totals.tax);
    rows += totalRow('Delivery fee', totals.deliveryFee);
    rows += totalRow('Delivery fee tax', totals.deliveryFeeTax);

    var hasTotal = !(totals.total === undefined || totals.total === null || totals.total === '');
    if (!hasAny && !hasTotal) {
      return '<div class="roa-empty-inline">No totals on this order.</div>';
    }

    return '<div class="roa-totals"><div class="roa-totals-title">Totals</div>' + rows +
      '<div class="roa-total-grand"><span>Total</span><span>' + esc(fmtMoney(totals.total)) + '</span></div></div>';
  }

  /* -------------------------------------------------------- accept modal */

  function openAcceptModal(orderId) {
    var order = findOrder(orderId);
    if (!order) return;
    if (_readOnly || !_canWrite) { notify('You cannot change orders in this view.', 'warning'); return; }
    if (isBusy(orderId)) return;
    _acceptFor = orderId;
    _etaMinutes = 0;
    renderAcceptModal();
    var modal = $id('roa-modal');
    if (modal) modal.hidden = false;
    var input = $id('roa-eta-min');
    if (input) input.value = '';
    updateEtaResult();
    requestResize();
  }

  function closeModal() {
    _acceptFor = '';
    _etaMinutes = 0;
    var modal = $id('roa-modal');
    if (modal) modal.hidden = true;
  }

  function renderAcceptModal() {
    var order = findOrder(_acceptFor);
    if (!order) { closeModal(); return; }
    setText('roa-modal-title', 'Accept order');
    var channel = channelMetaOf(order.channelKey);
    var kind = etaKindLabel(order);

    var html = '<div class="roa-modal-order">' +
      '<span>' + esc(order.orderNumber || ('#' + order.id)) + ' - ' + esc(orderTitleOf(order)) + '</span>' +
      '<span class="roa-card-total">' + esc(fmtMoney(order.totalNum)) + '</span></div>';

    html += '<span class="roa-eta-label">Estimated ' + esc(kind) + ' (optional)</span>';
    html += '<div class="roa-eta-chips">';
    for (var i = 0; i < ETA_CHIPS.length; i++) {
      html += '<button type="button" class="roa-eta-chip' + (_etaMinutes === ETA_CHIPS[i] ? ' roa-eta-chip-on' : '') +
        '" data-act="eta-chip" data-min="' + esc(String(ETA_CHIPS[i])) + '">' + esc(String(ETA_CHIPS[i])) + ' min</button>';
    }
    html += '</div>';
    html += '<div class="roa-eta-input-row">' +
      '<span>Custom</span>' +
      '<input type="number" class="roa-eta-input" id="roa-eta-min" min="0" max="480" step="5" placeholder="minutes">' +
      '<span>minutes</span></div>';
    html += '<div class="roa-eta-result roa-eta-result-empty" id="roa-eta-result"></div>';

    var body = $id('roa-modal-body');
    if (body) body.innerHTML = html;

    var foot = $id('roa-modal-foot');
    if (foot) {
      foot.innerHTML = '<button type="button" class="roa-btn roa-btn-ghost" data-act="modal-close">Cancel</button>' +
        '<button type="button" class="roa-btn roa-btn-ghost" data-act="accept-now">Accept now</button>' +
        '<button type="button" class="roa-btn roa-btn-primary" data-act="accept-eta">ACCEPT (' + esc(fmtTime(Date.now())) + ')</button>';
    }
  }

  function updateEtaResult() {
    var result = $id('roa-eta-result');
    var etaBtn = document.querySelector('.roa-modal-foot [data-act="accept-eta"]');
    if (!result) return;
    if (_etaMinutes > 0) {
      var target = Date.now() + _etaMinutes * 60000;
      var order = findOrder(_acceptFor);
      result.className = 'roa-eta-result';
      result.textContent = 'Estimated ' + (order ? etaKindLabel(order) : 'ready time') + ' around ' + fmtTime(target) + ' (' + fmtDurationMinutes(_etaMinutes) + ' from now).';
      if (etaBtn) etaBtn.textContent = 'ACCEPT (' + fmtTime(target) + ')';
    } else {
      result.className = 'roa-eta-result roa-eta-result-empty';
      result.textContent = 'No time set - accept without an estimate.';
      if (etaBtn) etaBtn.textContent = 'ACCEPT (' + fmtTime(Date.now()) + ')';
    }
  }

  function chooseEtaChip(minutes) {
    _etaMinutes = minutes;
    var input = $id('roa-eta-min');
    if (input) input.value = '';
    var chips = document.querySelectorAll('.roa-eta-chip');
    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      chip.classList.toggle('roa-eta-chip-on', parseInt(chip.getAttribute('data-min') || '0', 10) === minutes);
    }
    updateEtaResult();
  }

  function chooseEtaInput() {
    var input = $id('roa-eta-min');
    if (!input) return;
    var minutes = parseInt(input.value, 10);
    if (!isFinite(minutes) || minutes < 0) minutes = 0;
    _etaMinutes = minutes;
    var chips = document.querySelectorAll('.roa-eta-chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.remove('roa-eta-chip-on');
    }
    updateEtaResult();
  }

  /* ------------------------------------------------------------ actions */

  function callPhone(phone) {
    var digits = String(phone || '').replace(/[^0-9+]/g, '');
    if (!digits) return;
    try {
      if (typeof tool.openUrl === 'function') { tool.openUrl('tel:' + digits); return; }
    } catch (err) { /* ignore */ }
    notify('Phone: ' + phone, 'info');
  }

  function openInCms(orderId) {
    var order = findOrder(orderId);
    if (!order) return;
    try {
      if (typeof tool.openObjectDetail === 'function') {
        tool.openObjectDetail(_cfg.ordersType, order.id);
        return;
      }
    } catch (err) { /* ignore */ }
    notify('The CMS detail view is not available here.', 'warning');
  }

  function handleAction(trigger) {
    var action = trigger.getAttribute('data-act');
    var orderId = trigger.closest ? (trigger.closest('[data-id]') ? trigger.closest('[data-id]').getAttribute('data-id') : '') : '';
    if (!orderId && _detailId) orderId = _detailId;

    if (action === 'tab') { _ui.tab = trigger.getAttribute('data-tab') || 'all'; persistUiSoon(); renderAll(); return; }
    if (action === 'retry') { _error = ''; loadOrders(false); return; }
    if (action === 'card-open' || action === 'open-detail') { if (orderId) openDetail(orderId); return; }
    if (action === 'detail-back') { closeDetail(); renderBoard(); renderTop(); return; }
    if (action === 'detail-open-cms') { openInCms(orderId); return; }
    if (action === 'call') { callPhone(trigger.getAttribute('data-phone')); return; }
    if (action === 'accept') { if (orderId) openAcceptModal(orderId); return; }
    if (action === 'status') { setOrderStatus(orderId, trigger.getAttribute('data-status'), statusSuccessMessage(orderId, trigger.getAttribute('data-status'))); return; }
    if (action === 'arm-status') { if (orderId) armStatus(orderId, trigger.getAttribute('data-status')); return; }
    if (action === 'unarm') { clearArm(true); return; }
    if (action === 'confirm-status') {
      var status = _armed.status;
      if (orderId && status) setOrderStatus(orderId, status, statusSuccessMessage(orderId, status));
      return;
    }
    if (action === 'modal-close') { closeModal(); return; }
    if (action === 'eta-chip') { chooseEtaChip(parseInt(trigger.getAttribute('data-min') || '0', 10)); return; }
    if (action === 'accept-now') { _etaMinutes = 0; if (_acceptFor) acceptOrder(_acceptFor); return; }
    if (action === 'accept-eta') { if (_acceptFor) acceptOrder(_acceptFor); return; }
  }

  function statusSuccessMessage(orderId, newStatus) {
    var order = findOrder(orderId);
    if (!order) return '';
    var number = order.orderNumber || order.id;
    return 'Order ' + number + ' set to ' + statusMetaOf(newStatus).label + '.';
  }

  /* ------------------------------------------------------------- events */

  function wireEvents() {
    if (_wired) return;
    _wired = true;
    var root = $id('roa-root');
    if (!root) return;

    root.addEventListener('click', function (event) {
      var target = event.target;
      var trigger = (target && target.closest) ? target.closest('[data-act]') : null;
      if (trigger) { handleAction(trigger); return; }
      var card = (target && target.closest) ? target.closest('.roa-card[data-id]') : null;
      if (card) { openDetail(card.getAttribute('data-id')); return; }
      var modalCard = (target && target.closest) ? target.closest('.roa-modal-card') : null;
      var modal = $id('roa-modal');
      if (modal && !modal.hidden && modalCard) return; /* click inside modal, not on a button */
      var detailOverlay = $id('roa-detail');
      if (detailOverlay && !detailOverlay.hidden && target === detailOverlay) { closeDetail(); return; }
    });

    root.addEventListener('change', function (event) {
      var target = event.target;
      if (!target) return;
      if (target.id === 'roa-sort') { _ui.sort = target.value || 'waiting'; persistUiSoon(); renderBoard(); return; }
    });

    root.addEventListener('input', function (event) {
      var target = event.target;
      if (!target) return;
      if (target.id === 'roa-search') {
        _ui.search = target.value || '';
        if (_searchTimer) clearTimeout(_searchTimer);
        _searchTimer = setTimeout(function () { persistUiSoon(); renderBoard(); }, SEARCH_DEBOUNCE);
        return;
      }
      if (target.id === 'roa-eta-min') { chooseEtaInput(); return; }
    });

    var refreshBtn = $id('roa-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () { loadOrders(false); });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      var modal = $id('roa-modal');
      if (modal && !modal.hidden) { closeModal(); return; }
      if (_detailId) { closeDetail(); renderBoard(); renderTop(); }
    });
  }

  /* ------------------------------------------------------- permissions */

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
        if (user) { _user = user; computeCanWrite(); renderAll(); }
      }, delay);
    });
    setTimeout(function () {
      if (!_user) { _noIdentity = true; computeCanWrite(); renderAll(); }
    }, 5400);
  }

  /* ------------------------------------------------------- timers & poll */

  function startTick() {
    if (_tickTimer) return;
    _tickTimer = setInterval(updateElapsedSpans, 1000);
  }

  function startPolling() {
    if (_pollTimer || !_cfg.autoRefreshSeconds) return;
    _pollTimer = setInterval(softRefresh, _cfg.autoRefreshSeconds * 1000);
    try {
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) softRefresh();
      });
    } catch (err) { /* ignore */ }
  }

  function requestResize() {
    if (typeof tool.resize === 'function') {
      try { tool.resize(); } catch (err) { /* ignore */ }
    }
  }

  /* -------------------------------------------------------------- boot */

  function bindSdkListeners() {
    if (typeof tool.onValueChange === 'function') {
      tool.onValueChange(function (value) {
        if (value && typeof value === 'object' && value.ui && typeof value.ui === 'object') {
          var json = JSON.stringify({ ui: value.ui });
          if (json === _lastStagedUi) return; /* echo of our own save */
          _lastStagedUi = json;
          var ui = value.ui;
          if (TABS.some(function (t) { return t.id === ui.tab; })) _ui.tab = ui.tab;
          if (ui.sort === 'waiting' || ui.sort === 'newest' || ui.sort === 'total') _ui.sort = ui.sort;
          if (typeof ui.search === 'string') _ui.search = ui.search;
          renderAll();
        }
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
        renderAll();
      });
    }
  }

  function boot() {
    var buildEl = $id('roa-build');
    if (buildEl) buildEl.textContent = 'tool build ' + TOOL_BUILD;

    readConfig();
    reportMissingConfig();
    readSavedUi();
    _readOnly = (typeof tool.isReadOnly === 'function') ? !!tool.isReadOnly() : false;

    bootIdentity();
    wireEvents();
    renderAll();
    startTick();
    startPolling();
    bindSdkListeners();

    loadOrders(false);

    console.log('[RestaurantOrderTakingApp] build ' + TOOL_BUILD + ' ready - live board over ' + _cfg.ordersType + ' via requestObjects query/update.');
  }

  declareToolParams();

  tool.onReady(function () {
    boot();
  });

  /* Test hooks (pure functions only - smoke tests in Node use them). */
  if (typeof window !== 'undefined') {
    window.__roaTest = {
      build: TOOL_BUILD,
      normalizeOrder: normalizeOrder,
      statusKeyOf: statusKeyOf,
      boardOrders: boardOrders,
      tabOrders: tabOrders,
      boardListFor: boardListFor,
      matchesSearch: matchesSearch,
      fmtElapsedClock: fmtElapsedClock,
      etaKindLabel: etaKindLabel,
      countdownState: countdownState,
      findOrder: findOrder,
      openDetail: openDetail,
      closeDetail: closeDetail,
      cardActionsHtml: cardActionsHtml,
      setOrderStatus: setOrderStatus,
      acceptOrder: acceptOrder
    };
  }
})();

/* RESTAURANTORDERTAKINGAPP-JS-END build 2026-10-30-3 - if this line is missing in the CMS Tool Builder JS field, the JS was truncated */
