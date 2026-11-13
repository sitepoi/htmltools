/* build 2026-11-13-5 */

/* =====================================================================
   RestaurantOrderTakingApp - application-level ACTIVE ORDERS BOARD
   (listing tool, TYPE 3) for the restaurant order application.

   APPLICATIONS (see docs/ssot.html section 4.1):
     1. restaurants-easyorder                 - one object per restaurant
        (profile, hours, closing time). The board resolves exactly ONE of
        them AT RUNTIME from the CMS page it is opened on (the board record
        or the restaurant in the page address); the tool definition itself
        is tenant wide and cannot name a restaurant per restaurant
        (D-ROTA-46).
     2. restaurant-orders-easyorder   - every order of every
        restaurant, one object per order. Each order carries
        restaurantId = the restaurant SLUG, which is the join key.
     3. restaurant-order-taking-app-easyorder - this tool. One record per
        restaurant; the tool shows only the active day slice of that
        restaurant's orders: 1:N.

   READ  : order records of the configured object type (parameter
           ordersObjectType, default restaurant-orders-easyorder) through
           tool.requestObjects('query'). The board refreshes on
           a timer and on demand, so the kitchen always sees the latest
           state of today's orders.
   WRITE : order status advances through tool.requestObjects('update')
           (status, statusChangedAt and the optional acceptedAt /
           estimatedReadyAt fields). Never a direct database or REST
           call from the sandbox.
   ===================================================================== */

/* Tool build stamp - MANDATORY (html-tool-rules GLOBAL REQUIREMENT):
   bump on EVERY code change so stale CMS uploads are detectable. */
var TOOL_BUILD = '2026-11-13-5';
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
  /* Workflow order for the status selector in the detail popup (D-ROTA-18). */
  var STATUS_ORDER = [STATUS_NEW, STATUS_ACCEPTED, STATUS_PREP, STATUS_READY, STATUS_DONE, STATUS_DECLINED, STATUS_CANCELLED];

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
    'restaurantId', 'restaurantSlug', 'restaurant_slug', 'restaurantKey',
    'restaurant', 'siteId', 'cmsRestaurantId',
    ACCEPTED_AT_FIELD, ETA_FIELD
  ];

  /* Where an order carries its restaurant. Production orders of the
     restaurant-orders-easyorder type store the restaurant SLUG in
     restaurantSlug (D-ROTA-50); the other names stay as aliases for older
     writers, but the slug is the documented contract. */
  var ORDER_RESTAURANT_FIELDS = [
    'restaurantId', 'restaurantSlug', 'restaurant_slug', 'restaurantKey',
    'restaurant', 'siteId', 'cmsRestaurantId'
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
  var FRESH_FLASH_MS = 6000;   /* how long a just-arrived order keeps its ring */
  var UI_SAVE_DEBOUNCE = 300;
  var SEARCH_DEBOUNCE = 250;
  var URGENT_WINDOW_MINUTES = 5;

  /* --------------------------------------------------------------- state */

  var _orders = [];            /* normalized order list from the last load */
  var _orderById = {};         /* id -> normalized order */
  var _knownIds = {};          /* ids seen on the previous successful load */
  var _freshIds = {};          /* ids that appeared in the last load (new-order flash) */
  var _freshClearTimer = null; /* clears the fresh rings after FRESH_FLASH_MS */
  var _silentNextLoad = false; /* true right after a sample import - no fresh rings, no toasts */
  var _firstLoadDone = false;

  var _ui = { tab: 'all', sort: 'waiting', search: '' };
  var _lastStagedUi = '';
  var _saveUiTimer = null;

  var _detailId = '';
  var _acceptFor = '';         /* order id the accept modal is open for */
  var _etaMinutes = 0;         /* chosen minutes in the accept modal, 0 = none */
  var _armed = { orderId: '', status: '', timer: null };
  var _busy = {};              /* orderId -> true while a write is in flight */

  /* Kitchen state the order type may not define (D-ROTA-51). The board never
     requires status timestamps or an ETA on the order: what the CMS refuses
     is remembered here so the board keeps showing the truth for this session
     and the next write stops asking for it. */
  var _rejectedOrderFields = {};  /* field name -> true once the CMS refused it */
  var _localOrderState = {};      /* orderId -> status values the board shows even when they are not stored */

  var _menuOpen = false;       /* three-dots action menu visibility */
  var _importBusy = false;     /* true while a sample import is running */
  var _clearArmed = false;     /* true while the remove-today confirm is armed */
  var _clearArmTimer = null;

  var _loading = false;
  var _error = '';
  var _lastRefreshAt = 0;

  /* Restaurant scope (D-ROTA-42): the settings object of THIS restaurant,
     the state of the slug lookup, and the counts behind the empty state. */
  var _restaurantSettings = null;
  var _restaurantState = 'pending';  /* pending | ready | no-context | not-found | duplicate | error */
  var _instanceRestaurantReferences = []; /* restaurant ids read from the board record (one record per restaurant) */
  var _boardRecordCount = 0;         /* board records found on the application page */
  var _boardRecordSummaries = [];    /* their restaurant references, for the diagnostic message */
  var _boardRecordError = '';        /* why the board-record list could not be read */
  var _boardRecordNotice = '';       /* 'not-allowed' | 'disabled' - read skipped on purpose */
  var _restaurantSlugSuggestions = []; /* restaurant slugs found when no board record exists */
  var _diagDone = false;             /* the reachability dump is printed once per boot */
  var _allOrders = [];               /* every order of the last load, before scoping */
  var _hiddenOrderCount = 0;         /* orders that belong to another restaurant */
  var _unassignedOrderCount = 0;     /* orders that carry no restaurant at all */
  var _warnedUnassignedOrders = false;

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
    ordersType: 'restaurant-orders-easyorder',
    settingsType: 'restaurants-easyorder',
    ordersDataCategory: '',         /* empty = use the category the orders were read from (e.g. orderData) */
    toolAppType: 'restaurant-order-taking-app-easyorder', /* the per-restaurant record this board runs in */
    readBoardRecords: true,        /* read this application's own records to find the restaurant (needs the type in allowedObjectTypes) */
    allowUnassignedOrders: false,  /* legacy escape hatch - off by default (cross-restaurant risk) */
    autoRefreshSeconds: 20,
    newOrderNotifications: true,
    warnMinutes: 10,
    timeZone: '',                  /* filled from the restaurant object, never from a parameter */
    currency: '',                  /* filled from the restaurant object, never from a parameter */
    printMode: 'dialog',        /* dialog = browser print dialog, rawbt = direct print through the RawBT app */
    printAgentUrl: ''           /* reserved - unused, kept out of the params */
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

  /* Date without the clock - the thermal ticket prints times separately so
     every line stays short on 80 mm paper. */
  function fmtDateOnly(iso) {
    if (!iso) return '';
    var date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    var options = { year: 'numeric', month: 'short', day: '2-digit' };
    if (_cfg.timeZone) options.timeZone = _cfg.timeZone;
    try {
      return new Intl.DateTimeFormat(undefined, options).format(date);
    } catch (err) {
      return date.toLocaleDateString();
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

  /* Compact gap label used on the order timeline line: "8 min", "1h 5m". */
  function fmtShortGap(milliseconds) {
    var minutes = Math.round(Math.abs(Number(milliseconds) || 0) / 60000);
    if (minutes < 1) return 'under 1 min';
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

  /* Category-based CMS data keeps the field values under a CATEGORY key on the
     real tenant objects - data_categoriesBased.orderData = { orderNumber,
     lines, totals, ... } - while the platform reference describes the flat
     shape data_categoriesBased = { fieldId: value }. Both shapes are read, so
     the board works on every tenant without a setting (D-ROTA-50). */
  function pushCategoryBags(bags, container) {
    if (!container || typeof container !== 'object' || Array.isArray(container)) return;
    for (var key in container) {
      if (!Object.prototype.hasOwnProperty.call(container, key)) continue;
      var value = container[key];
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      if (bags.indexOf(value) !== -1) continue;
      bags.push(value);
    }
  }

  function collectBags(source) {
    var bags = [];
    if (!source || typeof source !== 'object') return bags;
    bags.push(source);
    if (source.data_categoriesBased && typeof source.data_categoriesBased === 'object') {
      bags.push(source.data_categoriesBased);
      pushCategoryBags(bags, source.data_categoriesBased);
    }
    if (source.data && typeof source.data === 'object') bags.push(source.data);
    if (source.objectData && typeof source.objectData === 'object') {
      bags.push(source.objectData);
      if (source.objectData.data_categoriesBased && typeof source.objectData.data_categoriesBased === 'object') {
        bags.push(source.objectData.data_categoriesBased);
        pushCategoryBags(bags, source.objectData.data_categoriesBased);
      }
    }
    if (source.productData && typeof source.productData === 'object') {
      bags.push(source.productData);
      if (source.productData.data_categoriesBased && typeof source.productData.data_categoriesBased === 'object') {
        bags.push(source.productData.data_categoriesBased);
        pushCategoryBags(bags, source.productData.data_categoriesBased);
      }
    }
    return bags;
  }

  /* Key of the category that holds the order fields (e.g. "orderData"), or
     empty when the tenant stores the fields flat under data_categoriesBased.
     The write path mirrors whatever the read path found, so a status change
     lands in the same place the order app reads it from. */
  function dataCategoryOf(source) {
    if (!source || typeof source !== 'object') return '';
    var containers = [];
    if (source.productData && source.productData.data_categoriesBased) containers.push(source.productData.data_categoriesBased);
    if (source.data_categoriesBased) containers.push(source.data_categoriesBased);
    if (source.objectData && source.objectData.data_categoriesBased) containers.push(source.objectData.data_categoriesBased);

    for (var c = 0; c < containers.length; c++) {
      var container = containers[c];
      if (!container || typeof container !== 'object' || Array.isArray(container)) continue;
      var flat = false;
      for (var f = 0; f < ORDER_FIELDS.length; f++) {
        if (Object.prototype.hasOwnProperty.call(container, ORDER_FIELDS[f])) { flat = true; break; }
      }
      if (flat) continue;
      for (var key in container) {
        if (!Object.prototype.hasOwnProperty.call(container, key)) continue;
        var value = container[key];
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
        for (var g = 0; g < ORDER_FIELDS.length; g++) {
          if (Object.prototype.hasOwnProperty.call(value, ORDER_FIELDS[g])) return key;
        }
      }
    }
    return '';
  }

  /* Wraps a field patch in the category the order was read from. */
  function wrapOrderPatch(category, patch) {
    if (!category) return patch;
    var bag = {};
    bag[category] = patch;
    return bag;
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

  /* ------------------------------------------------ restaurant scope */
  /* ONE tool instance = ONE restaurant (D-ROTA-42 / D-ROTA-43).
     The SYSTEM ADMIN stores the restaurant SLUG on the tool instance; a
     restaurant user never edits tool parameters, so a board can never be
     pointed at another restaurant from inside the app. The board stays
     CLOSED until the slug resolves - there is no default restaurant and no
     "first object" fallback. */

  var RESTAURANT_KEY_FIELDS = ['restaurantId', 'restaurantKey', 'restaurant', 'siteId', 'cmsRestaurantId'];
  var RESTAURANT_SLUG_FIELDS = ['slug', 'restaurantSlug', 'restaurant_slug', 'storeSlug'];

  function normalizeSlug(value) {
    return String(value === undefined || value === null ? '' : value).trim().toLowerCase();
  }

  function restaurantKeyOfValue(value) {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value === 'object') {
      return String(value.id || value._id || value.slug || value.restaurantId || '');
    }
    return String(value);
  }

  /* Slug of a restaurant settings object: the object's own slug first, then
     the same key inside its data bags (the names restaurant admins use). */
  function restaurantSlugOf(source) {
    if (!source || typeof source !== 'object') return '';
    if (source.slug) return normalizeSlug(source.slug);
    var bags = collectBags(source);
    for (var b = 0; b < bags.length; b++) {
      for (var k = 0; k < RESTAURANT_SLUG_FIELDS.length; k++) {
        var slug = normalizeSlug(findKey(bags[b], RESTAURANT_SLUG_FIELDS[k]));
        if (slug) return slug;
      }
    }
    return '';
  }

  /* Every identifier that can point at ONE restaurant object: its own id and
     slug, plus the ids an order writer may copy onto an order
     (restaurantId, restaurantKey, siteId, ...). */
  function restaurantIdentifiersOf(source) {
    var identifiers = [];
    function push(value) {
      var key = normalizeSlug(restaurantKeyOfValue(value));
      if (key && identifiers.indexOf(key) === -1) identifiers.push(key);
    }
    if (!source || typeof source !== 'object') return identifiers;
    push(source.id);
    push(source.slug);
    var bags = collectBags(source);
    for (var b = 0; b < bags.length; b++) {
      for (var k = 0; k < RESTAURANT_KEY_FIELDS.length; k++) push(findKey(bags[b], RESTAURANT_KEY_FIELDS[k]));
      for (var s = 0; s < RESTAURANT_SLUG_FIELDS.length; s++) push(findKey(bags[b], RESTAURANT_SLUG_FIELDS[s]));
    }
    return identifiers;
  }

  /* Identifiers an order may carry to belong to this board. They come from the
     resolved restaurant object only - no tool parameter, so a tenant-wide
     definition can never impose a restaurant on every board. */
  function restaurantScopeKeys() {
    var keys = [];
    if (_restaurantSettings) {
      var identifiers = restaurantIdentifiersOf(_restaurantSettings);
      for (var i = 0; i < identifiers.length; i++) {
        if (keys.indexOf(identifiers[i]) === -1) keys.push(identifiers[i]);
      }
    }
    return keys;
  }

  /* Recomputes which orders this board may show (fail CLOSED): with no
     restaurant slug nothing is shown, an order of another restaurant is
     never shown, and an order that carries no restaurant at all is hidden
     unless the system admin explicitly turns the legacy escape hatch on. */
  function applyRestaurantScope() {
    var scopeKeys = restaurantScopeKeys();
    var configured = scopeKeys.length > 0;
    var kept = [];
    var hidden = 0;
    var unassigned = 0;
    for (var i = 0; i < _allOrders.length; i++) {
      var order = _allOrders[i];
      var orderKey = normalizeSlug(order.restaurantKey);
      if (!configured) { hidden++; continue; }
      if (!orderKey) {
        unassigned++;
        if (_cfg.allowUnassignedOrders) kept.push(order);
        continue;
      }
      if (scopeKeys.indexOf(orderKey) !== -1) kept.push(order);
      else hidden++;
    }
    _orders = kept;
    _orderById = {};
    for (var k = 0; k < kept.length; k++) _orderById[kept[k].id] = kept[k];
    _hiddenOrderCount = hidden;
    _unassignedOrderCount = unassigned;
    assignDayNumbers(_orders);
    if (unassigned && !_warnedUnassignedOrders) {
      _warnedUnassignedOrders = true;
      console.warn('[RestaurantOrderTakingApp] ' + unassigned + ' order(s) carry no restaurant reference (checked restaurantId / restaurantSlug / restaurantKey / restaurant / siteId) and are hidden. The order writer must store restaurantSlug on every order.');
    }
    return _orders;
  }

  function restaurantScopeReport() {
    return {
      slug: _restaurantSettings ? restaurantSlugOf(_restaurantSettings) : '',
      state: _restaurantState,
      keys: restaurantScopeKeys(),
      visible: _orders.length,
      hidden: _hiddenOrderCount,
      unassigned: _unassignedOrderCount,
      settingsId: _restaurantSettings ? String(_restaurantSettings.id || '') : ''
    };
  }

  /* ------------------------------------------- which restaurant is this? */
  /* The tool DEFINITION is tenant wide on a multi-restaurant tenant, so a
     parameter cannot name the restaurant per restaurant (D-ROTA-46) and no
     per-restaurant value is kept in the tool parameters at all (D-ROTA-49).
     The board derives it at runtime, strongest signal first:
       1. the board record the tool runs in (one record per restaurant):
          its restaurant reference, read by object id from the page address.
          Give that record the SAME SLUG as the restaurant object - then the
          matching is automatic and no extra field is needed
       2. the CMS page address: /admin/objects/<type>/<objectId>, or the last
          path segment of a per-restaurant page
       3. the ONLY restaurant of the tenant, when there is exactly one
     Nothing else is used - never a "first object" guess among several. */

  function parentPageUrl() {
    try {
      if (typeof tool !== 'undefined' && tool && typeof tool.getParentPageUrl === 'function') {
        var pageUrl = tool.getParentPageUrl();
        if (pageUrl && typeof pageUrl === 'string') return String(pageUrl);
      }
    } catch (err) { /* ignore */ }
    try {
      if (typeof window !== 'undefined' && window.location && window.location.ancestorOrigins && window.location.ancestorOrigins.length) {
        return String(window.location.ancestorOrigins[0] || '');
      }
    } catch (err) { /* ignore */ }
    return '';
  }

  /* Pure: splits a CMS page address into route parts (origin and query are
     stripped by the platform, the path is what we get). */
  function parseParentPageRoute(url) {
    var text = String(url || '');
    var path = text.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0];
    var segments = [];
    var rawSegments = path.split('/');
    for (var i = 0; i < rawSegments.length; i++) {
      if (!rawSegments[i]) continue;
      try { segments.push(decodeURIComponent(rawSegments[i])); }
      catch (err) { segments.push(rawSegments[i]); }
    }
    var route = {
      url: text,
      segments: segments,
      objectType: '',
      objectId: '',
      lastSegment: segments.length ? segments[segments.length - 1] : ''
    };
    for (var s = 0; s < segments.length - 1; s++) {
      if (normalizeSlug(segments[s]) !== 'objects') continue;
      route.objectType = normalizeSlug(segments[s + 1]);
      route.objectId = segments[s + 2] || '';
      break;
    }
    return route;
  }

  function parentPageRoute() { return parseParentPageRoute(parentPageUrl()); }

  /* Restaurant reference carried by the per-restaurant board record: the
     explicit reference fields first, then its own slug - never its own id,
     which identifies the record, not the restaurant. */
  function restaurantReferenceOf(source) {
    var values = [];
    function push(value) {
      var key = normalizeSlug(restaurantKeyOfValue(value));
      if (key && values.indexOf(key) === -1) values.push(key);
    }
    if (!source || typeof source !== 'object') return values;
    var bags = collectBags(source);
    for (var b = 0; b < bags.length; b++) {
      for (var k = 0; k < RESTAURANT_KEY_FIELDS.length; k++) push(findKey(bags[b], RESTAURANT_KEY_FIELDS[k]));
      for (var f = 0; f < RESTAURANT_SLUG_FIELDS.length; f++) push(findKey(bags[b], RESTAURANT_SLUG_FIELDS[f]));
    }
    if (source.slug) push(source.slug);
    return values;
  }

  function restaurantCandidates() {
    var candidates = [];
    function push(value, source, strong) {
      var key = normalizeSlug(value);
      if (!key) return;
      for (var i = 0; i < candidates.length; i++) {
        if (candidates[i].key === key) return;
      }
      candidates.push({ key: key, source: source, strong: strong !== false });
    }

    /* 1) the per-restaurant board record (strongest: the record IS this
          restaurant's board) */
    for (var r = 0; r < _instanceRestaurantReferences.length; r++) {
      push(_instanceRestaurantReferences[r], 'board record');
    }

    /* 2) the CMS page the board is opened on. An /objects/<type>/<id> route
          is a strong signal; a plain page slug is only tried as a weak one,
          so an unrelated page (e.g. /admin/dashboard) cannot pretend to be
          a restaurant. When the page IS the board record, its id names the
          record and never a restaurant, so those candidates are skipped. */
    var route = parentPageRoute();
    var pageIsBoardRecord = normalizeSlug(route.objectType) === normalizeSlug(_cfg.toolAppType);
    if (!pageIsBoardRecord && route.objectId) push(route.objectId, 'page address');
    if (!pageIsBoardRecord && route.lastSegment && normalizeSlug(route.lastSegment) !== normalizeSlug(route.objectId)) {
      push(route.lastSegment, 'page address', false);
    }

    return candidates;
  }

  /* Reads the board record this board belongs to. A tool cannot see its own
     parent record any other way, and the record is where the system admin
     pins the restaurant. Two page shapes are handled (D-ROTA-52):
       /objects/<boardType>/<recordId>  - the per-restaurant board page
       /objects/<boardType>             - the APPLICATION page, whose address
         carries no record; there the only board record of the tenant is used,
         and with several records the board refuses to guess. */
  function readInstanceRestaurantReference(done) {
    var route = parentPageRoute();
    var toolAppType = normalizeSlug(_cfg.toolAppType);
    if (!toolAppType || route.objectType !== toolAppType) { done(); return; }

    function pushRecordReferences(record) {
      var references = restaurantReferenceOf(record);
      for (var i = 0; i < references.length; i++) {
        if (_instanceRestaurantReferences.indexOf(references[i]) === -1) _instanceRestaurantReferences.push(references[i]);
      }
    }

    if (route.objectId) {
      tool.requestObjects('get', { mainObjectType: _cfg.toolAppType, objectId: route.objectId }, function (err, result) {
        var record = (!err && result)
          ? (result.object || (Array.isArray(result.objects) ? result.objects[0] : null))
          : null;
        if (!record) {
          console.warn('[RestaurantOrderTakingApp] the board record ' + route.objectId + ' could not be read - add ' + _cfg.toolAppType + ' to settings.allowedObjectTypes (role editor, scope shared) so the restaurant reference can be resolved from it. Falling back to the page address.');
          done();
          return;
        }
        pushRecordReferences(record);
        done();
      });
      return;
    }

    /* Application page without a record id: list the board records. This asks
       the host for the board's OWN type, so it is skipped when that is turned
       off or when the configured allowed list clearly does not contain it -
       the host would only answer with an access warning (D-ROTA-53). */
    if (!_cfg.readBoardRecords) {
      _boardRecordNotice = 'disabled';
      console.warn('[RestaurantOrderTakingApp] reading this application\'s own records is turned off for this tool (readBoardRecords = no). Open the board from its record page /objects/' + _cfg.toolAppType + '/<record id> or from the restaurant object page.');
      done();
      return;
    }
    var allowedNames = allowedTypeNamesFromParam();
    if (allowedNames && allowedNames.indexOf(normalizeSlug(_cfg.toolAppType)) === -1) {
      _boardRecordNotice = 'not-allowed';
      console.warn('[RestaurantOrderTakingApp] the board did not read its own ' + _cfg.toolAppType + ' records because settings.allowedObjectTypes does not list that type. Add it with read access if the board should find its restaurant from its record, or open the board from the record page.');
      done();
      return;
    }
    tool.requestObjects('query', { mainObjectType: _cfg.toolAppType }, function (err, result) {
      _boardRecordError = err ? String(err) : '';
      var list = (!err && result && Array.isArray(result.objects)) ? result.objects : [];
      _boardRecordCount = list.length;
      _boardRecordSummaries = [];
      for (var i = 0; i < list.length && i < 8; i++) {
        var summary = restaurantSlugOf(list[i]) || restaurantReferenceOf(list[i])[0] || list[i].slug || list[i].id || '';
        if (summary) _boardRecordSummaries.push(summary);
      }
      if (list.length === 1) {
        /* One board record for the whole tenant: it can only be this board. */
        pushRecordReferences(list[0]);
      } else if (!list.length) {
        console.warn('[RestaurantOrderTakingApp] no ' + _cfg.toolAppType + ' record exists yet - create one record per restaurant with the same slug as the ' + _cfg.settingsType + ' object so this board can identify itself.');
      } else {
        console.warn('[RestaurantOrderTakingApp] this page is the application page of ' + _cfg.toolAppType + ', shared by ' + list.length + ' board records (' + _boardRecordSummaries.join(', ') + '). Open the board from the record page of one restaurant (/objects/' + _cfg.toolAppType + '/<record id>) so it knows which restaurant it serves.');
      }
      done();
    });
  }

  /* Names listed in settings.allowedObjectTypes when the host exposes that
     setting through tool.param. Null when it is not readable, so the tool
     never guesses a restriction from an empty value. */
  function allowedTypeNamesFromParam() {
    var raw = String(paramRaw('allowedObjectTypes', '')).trim();
    if (!raw) return null;
    var names = [];
    /* Both shapes appear in field settings: a JSON list of objects
       ({ mainObjectType: "x" }) and the same with quoted keys. The key may
       therefore be followed by a closing quote before the colon. */
    var expression = /mainObjectType"?\s*:\s*['"]([^'"]+)['"]/g;
    var match;
    while ((match = expression.exec(raw)) !== null) names.push(normalizeSlug(match[1]));
    return names.length ? names : null;
  }

  /* Slugs of the restaurants the tool can see. Used only when the board has
     no restaurant at all, so the message can say which values a board record
     has to copy instead of staying generic (D-ROTA-54). */
  function loadRestaurantSlugSuggestions(done) {
    _restaurantSlugSuggestions = [];
    if (!_cfg.settingsType || typeof tool === 'undefined' || typeof tool.requestObjects !== 'function') { done(); return; }
    tool.requestObjects('query', { mainObjectType: _cfg.settingsType }, function (err, result) {
      var list = (!err && result && Array.isArray(result.objects)) ? result.objects : [];
      for (var i = 0; i < list.length && _restaurantSlugSuggestions.length < 6; i++) {
        var slug = restaurantSlugOf(list[i]) || restaurantReferenceOf(list[i])[0] || list[i].slug || '';
        if (slug && _restaurantSlugSuggestions.indexOf(slug) === -1) _restaurantSlugSuggestions.push(slug);
      }
      done();
    });
  }

  /* What to tell an admin when the page carries no usable restaurant. */
  function boardContextHint(recordCount, summaries, route, recordError, notice) {
    var boardType = _cfg.toolAppType;
    if (notice === 'not-allowed') {
      return 'The board did not read its own ' + boardType + ' records because settings.allowedObjectTypes does not list that type. Add it with read access if the board should find its restaurant from its record, or open the board from the record page /objects/' + boardType + '/<record id>.';
    }
    if (notice === 'disabled') {
      return 'Reading the board records is turned off for this tool (readBoardRecords = no). Open the board from the record page /objects/' + boardType + '/<record id> or from the restaurant object page.';
    }
    if (recordCount > 1) {
      return 'This page is the application page, shared by ' + recordCount + ' board records' +
        (summaries && summaries.length ? ' (' + summaries.join(', ') + ')' : '') +
        '. Open the board from the record page of one restaurant (/objects/' + boardType + '/<record id>) and give that record the same slug as the ' + _cfg.settingsType + ' object.';
    }
    if (recordCount === 1) {
      return 'The only board record has no restaurant reference. Give it the same slug as the ' + _cfg.settingsType + ' object, or open the board from the restaurant object page.';
    }
    if (recordError) {
      return 'The ' + boardType + ' records could not be read (' + recordError + '). Add ' + boardType + ' to settings.allowedObjectTypes (read) so the board can find its restaurant from its own record.';
    }
    var where = (route && route.objectType) ? ('/objects/' + route.objectType) : 'this page';
    var known = (_restaurantSlugSuggestions && _restaurantSlugSuggestions.length)
      ? '. Restaurants found: ' + _restaurantSlugSuggestions.join(', ') + '.'
      : '.';
    return 'This page (' + where + ') carries no ' + boardType + ' record, so nothing names the restaurant for this board. Create one board record per restaurant and give it the same slug as the ' + _cfg.settingsType + ' object' + known + ' Then open the board from that record\'s page (/objects/' + boardType + '/<record id>).';
  }

  /* ------------------------------------------------ console diagnostics */
  /* A compact, copy-pasteable dump of what the tool can actually reach:
     page route, parameters, and the first records of the three types with
     their top-level keys, data categories and restaurant field. It answers
     "can the tool see the id, the slug and the order payload at all?". */
  function describeRecord(record) {
    if (!record || typeof record !== 'object') return null;
    var container = (record.productData && record.productData.data_categoriesBased)
      ? record.productData.data_categoriesBased
      : (record.data_categoriesBased || null);
    var restaurantValue = '';
    var fieldBags = orderedBags(record);
    for (var i = 0; i < ORDER_RESTAURANT_FIELDS.length; i++) {
      var candidate = readField(fieldBags, ORDER_RESTAURANT_FIELDS[i]);
      if (candidate === undefined || candidate === null || candidate === '') continue;
      restaurantValue = String(restaurantKeyOfValue(candidate));
      break;
    }
    var bags = collectBags(record);
    return {
      id: String(record.id || record._id || ''),
      slug: String(record.slug || ''),
      hasTopLevelSlug: !!record.slug,
      cmsObjectType: String(record.cmsObjectType || ''),
      typeId: String(record.typeId || ''),
      name: String(record.name || ''),
      topLevelKeys: Object.keys(record).slice(0, 30),
      dataCategories: container ? Object.keys(container).slice(0, 20) : [],
      dataCategory: dataCategoryOf(record),
      restaurantField: restaurantValue,
      referenceCandidates: restaurantReferenceOf(record).slice(0, 4),
      orderFieldsSeen: {
        orderNumber: readField(fieldBags, 'orderNumber') !== undefined,
        placedAt: readField(fieldBags, 'placedAt') !== undefined,
        channel: readField(fieldBags, 'channel') !== undefined,
        lines: readField(fieldBags, 'lines') !== undefined,
        totals: readField(fieldBags, 'totals') !== undefined,
        status: readField(fieldBags, 'status') !== undefined
      }
    };
  }

  function collectReachability(done) {
    var report = {
      build: TOOL_BUILD,
      pageUrl: parentPageUrl(),
      route: parentPageRoute(),
      restaurantState: _restaurantState,
      resolvedRestaurant: _restaurantSettings ? (restaurantSlugOf(_restaurantSettings) || String(_restaurantSettings.id || '')) : '',
      boardRecordReferences: _instanceRestaurantReferences.slice(),
      boardRecordNotice: _boardRecordNotice,
      boardRecordError: _boardRecordError,
      parameters: {
        allowObjectCRUD: String(paramRaw('allowObjectCRUD', '')),
        allowedObjectTypes: String(paramRaw('allowedObjectTypes', '')),
        ordersObjectType: _cfg.ordersType,
        restaurantSettingsType: _cfg.settingsType,
        toolAppType: _cfg.toolAppType,
        readBoardRecords: _cfg.readBoardRecords ? 'yes' : 'no'
      }
    };

    function queryType(sectionName, typeName, sampleSize, next, skipReason) {
      var section = { type: typeName, error: '', count: 0, sample: [], skipped: skipReason || '' };
      report[sectionName] = section;
      /* Never ask for a type the tool was told not to read - the host would
         answer with the same access warning the board just avoided. */
      if (skipReason) { next(); return; }
      if (!typeName || typeof tool === 'undefined' || typeof tool.requestObjects !== 'function') { next(); return; }
      tool.requestObjects('query', { mainObjectType: typeName }, function (err, result) {
        if (err) section.error = String(err);
        var list = (!err && result && Array.isArray(result.objects)) ? result.objects : [];
        section.count = list.length;
        for (var i = 0; i < list.length && i < sampleSize; i++) section.sample.push(describeRecord(list[i]));
        next();
      });
    }

    var boardSkipReason = !_cfg.readBoardRecords
      ? 'readBoardRecords = no'
      : (_boardRecordNotice === 'not-allowed' ? 'type not listed in settings.allowedObjectTypes' : '');
    queryType('boardRecords', _cfg.toolAppType, 3, function () {
      queryType('restaurants', _cfg.settingsType, 2, function () {
        queryType('orders', _cfg.ordersType, 2, function () { done(report); });
      });
    }, boardSkipReason);
  }

  function logReachability() {
    if (_diagDone) return;
    _diagDone = true;
    collectReachability(function (report) {
      console.log('[ROTA-DIAG] what this board can reach (copy the block and send it back):\n----- ROTA DIAG START -----\n' + JSON.stringify(report, null, 2) + '\n----- ROTA DIAG END -----');
    });
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
    /* Category the order fields live in ("orderData" on production), so the
       write path can patch the same place it read from. */
    order.dataCategory = dataCategoryOf(obj);
    /* Whatever the order does not carry (because the type has no such field)
       is filled from what this board already did in this session, so the
       board works with defaults instead of demanding the fields (D-ROTA-51). */
    applyLocalOrderState(order);

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
    order.restaurantKey = '';
    for (var rf = 0; rf < ORDER_RESTAURANT_FIELDS.length; rf++) {
      var orderRestaurantValue = normalizeSlug(restaurantKeyOfValue(order[ORDER_RESTAURANT_FIELDS[rf]]));
      if (orderRestaurantValue) { order.restaurantKey = orderRestaurantValue; break; }
    }

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

  /* Daily sequence numbers (D-ROTA-19): orders placed today get a simple
     1-based number for the day - #1 is the first order of the day, #2 the
     second, and so on. The raw record number (e.g. EFOC-8001) stays in the
     CMS, but the board shows the friendly daily number as a chip. */
  function assignDayNumbers(list) {
    var todays = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].isToday && list[i].placeTs) todays.push(list[i]);
    }
    todays.sort(function (a, b) {
      return (a.placeTs - b.placeTs) || String(a.id).localeCompare(String(b.id));
    });
    for (var j = 0; j < todays.length; j++) todays[j].dayNumber = j + 1;
    return list;
  }

  /* Board-facing order label: the daily chip number when available, otherwise
     the raw record number as stored on the order. */
  function orderLabelOf(order) {
    if (order.dayNumber) return '#' + order.dayNumber;
    return order.orderNumber || ('#' + order.id);
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
    _cfg.ordersType = String(paramRaw('ordersObjectType', 'restaurant-orders-easyorder')).trim() || 'restaurant-orders-easyorder';
    _cfg.settingsType = String(paramRaw('restaurantSettingsType', 'restaurants-easyorder')).trim() || 'restaurants-easyorder';
    _cfg.ordersDataCategory = String(paramRaw('ordersDataCategory', '')).trim();
    _cfg.toolAppType = String(paramRaw('toolAppType', 'restaurant-order-taking-app-easyorder')).trim() || 'restaurant-order-taking-app-easyorder';
    _cfg.readBoardRecords = String(paramRaw('readBoardRecords', 'yes')).toLowerCase() !== 'no';
    _cfg.allowUnassignedOrders = String(paramRaw('allowUnassignedOrders', 'no')).toLowerCase() === 'yes';
    var refresh = parseInt(String(paramRaw('autoRefreshSeconds', '20')), 10);
    _cfg.autoRefreshSeconds = (isFinite(refresh) && refresh >= 0) ? refresh : 20;
    var notifyRaw = String(paramRaw('newOrderNotifications', 'yes')).toLowerCase();
    _cfg.newOrderNotifications = notifyRaw !== 'no';
    var warn = parseInt(String(paramRaw('newOrderWarningMinutes', '10')), 10);
    _cfg.warnMinutes = (isFinite(warn) && warn >= 0) ? warn : 10;
    _cfg.timeZone = '';
    _cfg.currency = '';
    _cfg.printMode = String(paramRaw('printMode', 'dialog')).trim().toLowerCase() === 'rawbt' ? 'rawbt' : 'dialog';
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
          hint: 'CMS field setting (settings.allowedObjectTypes) listing the order type, e.g. { mainObjectType: "restaurant-orders-easyorder", role: "editor", scope: "shared" }. Set in the Field Group Designer, not as a text param.'
        },
        {
          name: 'ordersObjectType', label: 'Orders object type',
          type: 'text', default: 'restaurant-orders-easyorder', severity: 'goodToHave',
          hint: 'CMS object type of the order objects inside the restaurant-orders-easyorder application. Default restaurant-orders-easyorder. Every order of that type must carry restaurantId = the restaurant slug.'
        },
        {
          name: 'restaurantSettingsType', label: 'Restaurant settings type',
          type: 'text', default: 'restaurants-easyorder', severity: 'goodToHave',
          hint: 'CMS object type of the restaurants-easyorder application, one object per restaurant (profile, opening hours, closing time). Used to warn when the shop closes within two hours. Empty disables the check.'
        },
        {
          name: 'ordersDataCategory', label: 'Orders data category (optional)',
          type: 'text', default: '', severity: 'optional',
          hint: 'Leave empty. The board reads the order fields from whichever category holds them (production orderData) and writes status changes back into that same category. Set it only when a tenant stores the fields flat and you want the writes placed under a category anyway.'
        },
        {
          name: 'toolAppType', label: 'Board application type',
          type: 'text', default: 'restaurant-order-taking-app-easyorder', severity: 'optional',
          hint: 'CMS object type of this board application, one record per restaurant. The tool reads the record whose page the board is opened on and takes its restaurantSlug / restaurantId / own slug from it. Add this type to settings.allowedObjectTypes (read) or the host refuses that read.'
        },
        {
          name: 'readBoardRecords', label: 'Read board records',
          type: 'toggle', default: 'yes', severity: 'optional',
          hint: 'yes = the board reads its own application records to find the restaurant, which needs restaurant-order-taking-app-easyorder in settings.allowedObjectTypes (read). no = the board never asks for its own type (no host access warning) and relies on the record page or the restaurant page instead.'
        },
        {
          name: 'allowUnassignedOrders', label: 'Show orders without a restaurant',
          type: 'toggle', default: 'no', severity: 'optional',
          hint: 'Legacy escape hatch. yes shows orders that carry NO restaurant id at all; with several restaurants those orders would be visible on every board, so keep it off.'
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
          name: 'printMode', label: 'Print mode',
          type: 'text', default: 'dialog', severity: 'optional',
          hint: 'dialog = the browser print dialog (Edge or Chrome started with --kiosk-printing prints with no dialog to the default printer). rawbt = open the RawBT app on an Android tablet with a raw ESC/POS ticket, which prints straight to its configured printer.'
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
      orderLabelOf(order), order.orderNumber, order.name, order.tableNumber,
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
    var silentLoad = _silentNextLoad;
    _silentNextLoad = false;
    var all = [];
    for (var i = 0; i < rawList.length; i++) {
      var order = normalizeOrder(rawList[i]);
      if (!order.id) continue;
      all.push(order);
    }

    /* Restaurant scope (D-ROTA-42): the board only ever holds the orders of
       the restaurant assigned to this instance. */
    _allOrders = all;
    var next = applyRestaurantScope();

    var freshIds = {};
    var announce = _firstLoadDone && !silentLoad && _cfg.newOrderNotifications;
    var markFresh = _firstLoadDone && !silentLoad; /* the FIRST load (and a sample import) never flashes (D-ROTA-16 / D-ROTA-22) */
    for (var k = 0; k < next.length; k++) {
      var freshOrder = next[k];
      if (!_knownIds[freshOrder.id]) {
        if (markFresh) freshIds[freshOrder.id] = true;
        if (announce && freshOrder.status === STATUS_NEW) {
          notify('New order ' + orderLabelOf(freshOrder) + ' - ' + orderTitleOf(freshOrder), 'info');
        }
      }
    }
    _knownIds = {};
    for (var k = 0; k < next.length; k++) _knownIds[next[k].id] = true;
    _freshIds = freshIds;

    /* The fresh ring is a short attention cue - clear it after a few
       seconds instead of waiting for the next poll (D-ROTA-22). */
    if (_freshClearTimer) { clearTimeout(_freshClearTimer); _freshClearTimer = null; }
    if (Object.keys(freshIds).length) {
      _freshClearTimer = setTimeout(function () {
        _freshClearTimer = null;
        _freshIds = {};
        renderBoard();
      }, FRESH_FLASH_MS);
    }
  }

  function softRefresh() {
    if (_loading) return;
    loadOrders(true);
  }

  /* ------------------------------------------- restaurant settings object */
  /* Closing time lives in a separate CMS object (D-ROTA-41). Its schema is
     not fixed, so every common shape is accepted: a direct closing time, a
     weekly schedule object or array, or a plain "09:00-22:00" string. When
     nothing usable is found the warning simply never appears - the board
     must never invent a closing time. */

  var CLOSING_KEYS = ['closingTime', 'closeTime', 'closingHour', 'closing', 'closeHour', 'closingAt', 'businessClosingTime'];
  var SCHEDULE_KEYS = ['openingHours', 'businessHours', 'workingHours', 'serviceHours', 'hours', 'schedule', 'openingTimes', 'tradingHours'];
  var DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  var CLOSING_WARNING_MINUTES = 120;

  function loadRestaurantSettings() {
    if (typeof tool === 'undefined' || typeof tool.requestObjects !== 'function') {
      _restaurantState = 'error';
      return;
    }
    if (!_cfg.settingsType) { _restaurantState = 'error'; return; }

    _restaurantSettings = null;
    _instanceRestaurantReferences = [];
    _boardRecordCount = 0;
    _boardRecordSummaries = [];
    _boardRecordError = '';
    _boardRecordNotice = '';
    _restaurantSlugSuggestions = [];
    _restaurantState = 'pending';

    /* A multi-restaurant tenant cannot store the restaurant on the tool
       definition (one definition serves every restaurant), so the board
       reads it from the page it is opened on first (D-ROTA-46). */
    readInstanceRestaurantReference(function () {
      var candidates = restaurantCandidates();
      var pageRoute = parentPageRoute();
      console.log('[RestaurantOrderTakingApp] restaurant lookup - page: ' + (pageRoute.url || '(unavailable)') +
        ' | candidates: ' + (candidates.length
          ? candidates.map(function (candidate) { return candidate.key + ' [' + candidate.source + ']'; }).join(', ')
          : 'none') +
        ' | board record references: ' + (_instanceRestaurantReferences.length ? _instanceRestaurantReferences.join(', ') : 'none'));
      if (!candidates.length) {
        _restaurantState = 'no-context';
        /* Name the restaurants that exist, so the message tells the admin
           exactly which slugs a board record must copy (D-ROTA-54). */
        loadRestaurantSlugSuggestions(function () {
          console.warn('[RestaurantOrderTakingApp] this board cannot tell which restaurant it belongs to. Page: ' + (pageRoute.url || '(unavailable)') + '. ' + boardContextHint(_boardRecordCount, _boardRecordSummaries, pageRoute, _boardRecordError, _boardRecordNotice));
          finishRestaurantLookup();
        });
        return;
      }

      tool.requestObjects('query', { mainObjectType: _cfg.settingsType }, function (err, result) {
        if (err) {
          _restaurantState = 'error';
          console.warn('[RestaurantOrderTakingApp] restaurant settings could not be read: ' + err + ' - the closing-time check stays off; orders stay scoped by the restaurant slug.');
          finishRestaurantLookup();
          return;
        }
        var list = (result && Array.isArray(result.objects)) ? result.objects : [];
        var matches = [];
        var matchedCandidate = '';
        for (var c = 0; c < candidates.length; c++) {
          for (var i = 0; i < list.length; i++) {
            if (restaurantIdentifiersOf(list[i]).indexOf(candidates[c].key) === -1) continue;
            if (matches.indexOf(list[i]) === -1) matches.push(list[i]);
            if (!matchedCandidate) matchedCandidate = candidates[c].key + ' (' + candidates[c].source + ')';
          }
        }
        if (matches.length === 1) {
          acceptRestaurant(matches[0], matchedCandidate);
          return;
        }
        if (matches.length > 1) {
          _restaurantState = 'duplicate';
          console.warn('[RestaurantOrderTakingApp] ' + matches.length + ' restaurants match "' + matchedCandidate + '" - the board stays closed until the match is unique.');
          finishRestaurantLookup();
          return;
        }
        /* Unambiguous single-restaurant tenant: the only restaurant is the
           restaurant. Never applied when the tenant has several. */
        if (list.length === 1) {
          acceptRestaurant(list[0], 'the only restaurant of this tenant');
          return;
        }
        _restaurantState = 'not-found';
        var hasStrongCandidate = false;
        for (var sc = 0; sc < candidates.length; sc++) {
          if (candidates[sc].strong) { hasStrongCandidate = true; break; }
        }
        if (!hasStrongCandidate) _restaurantState = 'no-context';
        console.warn('[RestaurantOrderTakingApp] no ' + _cfg.settingsType + ' object matches "' + candidates[0].key + '" (' + candidates[0].source + ') - ' + (hasStrongCandidate ? 'check that the board record slug equals the restaurant slug or that the page address points at an existing restaurant.' : 'this page carries no restaurant at all. Open the board from the restaurant page.') + ' The closing-time check stays off.');
        finishRestaurantLookup();
      });
    });
  }

  function acceptRestaurant(settingsObject, matchedBy) {
    _restaurantSettings = settingsObject;
    _restaurantState = 'ready';

    /* Currency and timezone belong to the restaurant, so they are read from
       its object only - a tool parameter would apply one restaurant's values
       to every board of the tenant (D-ROTA-49). */
    _cfg.currency = restaurantCurrencyOf();
    _cfg.timeZone = restaurantTimeZoneOf();

    console.log('[RestaurantOrderTakingApp] restaurant settings resolved by ' + matchedBy + ': ' + (restaurantSlugOf(settingsObject) || settingsObject.id) + '.');
    finishRestaurantLookup();
  }

  function finishRestaurantLookup() {
    applyRestaurantScope();
    renderAll();
    /* When the restaurant could not be resolved, print what the tool reaches
       so an admin can send one block instead of guessing (D-ROTA-53). */
    if (_restaurantState !== 'ready') logReachability();
  }

  /* The restaurant config object nests everything under restaurantDetails
     (see the sample in the SSOT, section 4.1): opening hours under
     service_settings, currency under taxation_currency, timezone under
     general_info. Those bags are added so the existing readers find them. */
  function settingsBags() {
    if (!_restaurantSettings) return [];
    var bags = collectBags(_restaurantSettings);
    for (var i = 0; i < bags.length; i++) {
      var details = findKey(bags[i], 'restaurantDetails');
      if (!details || typeof details !== 'object' || Array.isArray(details)) continue;
      bags.push(details);
      var nestedKeys = ['service_settings', 'taxation_currency', 'general_info'];
      for (var n = 0; n < nestedKeys.length; n++) {
        var child = findKey(details, nestedKeys[n]);
        if (child && typeof child === 'object' && !Array.isArray(child)) bags.push(child);
      }
    }
    return bags;
  }

  /* ISO 4217 code of the restaurant config (taxation_currency.currency). */
  function restaurantCurrencyOf() {
    var bags = settingsBags();
    for (var i = 0; i < bags.length; i++) {
      var code = String(findKey(bags[i], 'currency') || '').trim().toUpperCase();
      if (/^[A-Z]{3}$/.test(code)) return code;
    }
    return '';
  }

  /* IANA timezone of the restaurant config (general_info.timezone). */
  function restaurantTimeZoneOf() {
    var bags = settingsBags();
    for (var i = 0; i < bags.length; i++) {
      var timeZone = String(findKey(bags[i], 'timezone') || '').trim();
      if (timeZone) return timeZone;
    }
    return '';
  }

  /* "22:00", "10:00 PM", "22.00", 22 (hours) or 1320 (minutes). */
  function minutesFromTimeValue(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number') {
      if (value > 24 && value <= 1440) return Math.round(value);
      if (value >= 0 && value <= 24) return Math.round(value * 60);
      return null;
    }
    var text = String(value).trim().toLowerCase();
    var match = /^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/.exec(text);
    if (match) {
      var hours = parseInt(match[1], 10);
      var minutes = parseInt(match[2], 10);
      if (match[3]) hours = (hours % 12) + (match[3] === 'pm' ? 12 : 0);
      if (hours === 24 && minutes === 0) return 1440;
      if (hours > 24 || minutes > 59) return null;
      return hours * 60 + minutes;
    }
    match = /^(\d{1,2})\s*(am|pm)$/.exec(text);
    if (match) {
      var hourOnly = (parseInt(match[1], 10) % 12) + (match[2] === 'pm' ? 12 : 0);
      return hourOnly * 60;
    }
    return null;
  }

  function closeMinutesFromRange(value) {
    if (typeof value === 'string') {
      var parts = value.split(/\s*(?:-|\u2013|to)\s*/i);
      return parts.length === 2 ? minutesFromTimeValue(parts[1]) : null;
    }
    if (Array.isArray(value)) {
      return value.length >= 2 ? minutesFromTimeValue(value[1]) : null;
    }
    if (value && typeof value === 'object') {
      /* Real config shape (restaurants-easyorder, section 4.1 of the SSOT):
         { day: 0, is_closed: false, ranges: [ { open: '16:00', close: '22:00' } ] }
         A closed day has no closing time, and the LAST range of the day
         decides when the kitchen stops. */
      if (value.is_closed === true || value.isClosed === true || value.closed === true) return null;
      var ranges = findKey(value, 'ranges');
      if (Array.isArray(ranges) && ranges.length) return closeMinutesFromRange(ranges[ranges.length - 1]);
      var close = value.close;
      if (close === undefined) close = value.to;
      if (close === undefined) close = value.end;
      if (close === undefined) close = value.closing;
      return minutesFromTimeValue(close);
    }
    return null;
  }

  function closeMinutesFromSchedule(schedule, dayIndex) {
    if (!schedule) return null;
    if (typeof schedule === 'string') return closeMinutesFromRange(schedule);

    if (Array.isArray(schedule)) {
      for (var i = 0; i < schedule.length; i++) {
        var entry = schedule[i];
        if (!entry || typeof entry !== 'object') continue;
        var key = String(entry.day === undefined ? (entry.weekday === undefined ? (entry.name || '') : entry.weekday) : entry.day).toLowerCase();
        var matches = key === DAY_KEYS[dayIndex] || key === DAY_KEYS[dayIndex].slice(0, 3) || String(entry.day) === String(dayIndex);
        if (matches) return closeMinutesFromRange(entry);
      }
      return null;
    }

    if (typeof schedule === 'object') {
      /* A single range for every day: { open: '09:00', close: '22:00' } */
      if (schedule.close !== undefined || schedule.to !== undefined || schedule.end !== undefined) {
        return closeMinutesFromRange(schedule);
      }
      var names = [DAY_KEYS[dayIndex], DAY_KEYS[dayIndex].slice(0, 3), String(dayIndex), String(dayIndex + 1)];
      for (var n = 0; n < names.length; n++) {
        var dayValue = findKey(schedule, names[n]);
        if (dayValue !== undefined) return closeMinutesFromRange(dayValue);
      }
      return null;
    }
    return null;
  }

  /* Closing time of TODAY in minutes after midnight, or null when unknown. */
  function closingMinutesToday(dayIndex) {
    var day = (typeof dayIndex === 'number') ? dayIndex : new Date().getDay();
    var bags = settingsBags();
    for (var b = 0; b < bags.length; b++) {
      for (var k = 0; k < CLOSING_KEYS.length; k++) {
        var direct = minutesFromTimeValue(findKey(bags[b], CLOSING_KEYS[k]));
        if (direct !== null) return direct;
      }
      for (var s = 0; s < SCHEDULE_KEYS.length; s++) {
        var fromSchedule = closeMinutesFromSchedule(findKey(bags[b], SCHEDULE_KEYS[s]), day);
        if (fromSchedule !== null) return fromSchedule;
      }
    }
    return null;
  }

  function fmtClockMinutes(minutes) {
    if (minutes === null || minutes === undefined) return '';
    var total = minutes % 1440;
    var hours = Math.floor(total / 60);
    var mins = total % 60;
    var suffix = hours >= 12 ? 'p.m.' : 'a.m.';
    var display = hours % 12;
    if (display === 0) display = 12;
    return display + ':' + pad2(mins) + ' ' + suffix;
  }

  /* Warning shown in the accept dialog when the shop closes soon (D-ROTA-41):
     only inside the last two hours, so it stays meaningful. */
  function closingNoticeHtml(nowMinutes) {
    var closeMinutes = closingMinutesToday();
    if (closeMinutes === null) return '';
    var now = new Date();
    var minutesNow = (typeof nowMinutes === 'number') ? nowMinutes : (now.getHours() * 60 + now.getMinutes());
    var remaining = closeMinutes - minutesNow;
    if (remaining < 0 || remaining > CLOSING_WARNING_MINUTES) return '';
    var urgentClass = remaining <= 30 ? ' roa-closing-urgent' : '';
    return '<div class="roa-closing' + urgentClass + '">' +
      'Restaurant closes at ' + esc(fmtClockMinutes(closeMinutes)) +
      ' - ' + esc(fmtDurationMinutes(remaining)) + ' left to prepare this order.' +
      '</div>';
  }

  function setError(message) {
    _error = String(message || '');
    renderBoard();
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

  /* Update payload for one order. The patch is wrapped in the category the
     order was actually read from (production: orderData), so a status change
     lands where the order application reads it (D-ROTA-50). A flat order
     stays flat. */
  function orderUpdatePayload(orderId, patch) {
    var order = findOrder(orderId);
    var category = (order && order.dataCategory) || _cfg.ordersDataCategory;
    return {
      mainObjectType: _cfg.ordersType,
      objectId: orderId,
      productData: { data_categoriesBased: wrapOrderPatch(category, patch) }
    };
  }

  /* ------------------------------------------ order status with defaults */
  /* The order type owns only what it owns. Production order writers send the
     order without any kitchen field, and a tenant may never create
     statusChangedAt / acceptedAt / estimatedReadyAt at all. The board
     therefore treats them as OPTIONAL and supplies defaults (D-ROTA-51):
       - status           missing = new
       - statusChangedAt  missing = the order counts as changed today
       - acceptedAt       missing = the timeline uses the status time
       - estimatedReadyAt missing = no countdown, "not set"
       - internalNote     missing = no note
     A write still tries to store them, but a refused field can never block
     the status change itself. */

  function rememberOrderPatch(orderId, patch) {
    if (!orderId || !patch || typeof patch !== 'object') return;
    var local = _localOrderState[orderId] || (_localOrderState[orderId] = {});
    if (patch[STATUS_FIELD]) local.status = patch[STATUS_FIELD];
    if (patch[STATUS_TIME_FIELD]) local.statusChangedAt = patch[STATUS_TIME_FIELD];
    if (patch[ACCEPTED_AT_FIELD]) local.acceptedAt = patch[ACCEPTED_AT_FIELD];
    if (patch[ETA_FIELD]) local.estimatedReadyAt = patch[ETA_FIELD];
  }

  /* Fills a loaded order with the values this board already produced, but
     only where the CMS has nothing - stored data always wins. */
  function applyLocalOrderState(order) {
    if (!order || !order.id) return;
    var local = _localOrderState[order.id];
    if (!local) return;
    if (!order.status && local.status) order.status = local.status;
    if (!order.statusChangedAt && local.statusChangedAt) order.statusChangedAt = local.statusChangedAt;
    if (!order[ACCEPTED_AT_FIELD] && local.acceptedAt) order[ACCEPTED_AT_FIELD] = local.acceptedAt;
    if (!order[ETA_FIELD] && local.estimatedReadyAt) order[ETA_FIELD] = local.estimatedReadyAt;
  }

  /* Attempts for one write: the full patch, then the patch without fields
     the CMS already refused, then the status alone. Empty attempts and
     duplicates are dropped. */
  function buildWriteAttempts(patch) {
    var attempts = [];
    var seen = {};
    function add(candidate) {
      var keys = [];
      for (var key in candidate) {
        if (Object.prototype.hasOwnProperty.call(candidate, key)) keys.push(key);
      }
      if (!keys.length) return;
      keys.sort();
      var signature = keys.join('|');
      if (seen[signature]) return;
      seen[signature] = true;
      attempts.push(candidate);
    }

    /* The first attempt asks only for fields this order type accepted before,
       so a field it already refused is never sent again. */
    var writable = {};
    var statusOnly = {};
    var hasStatus = false;
    for (var key in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
      if (key === STATUS_FIELD) {
        hasStatus = true;
        statusOnly[key] = patch[key];
      }
      if (!_rejectedOrderFields[key]) writable[key] = patch[key];
    }
    add(writable);
    if (hasStatus) {
      add(statusOnly);
    } else if (Object.keys(writable).length > 1) {
      /* Optional fields only (accept time + ETA): try them one by one so a
         missing ETA never stops the accept time from being stored. */
      for (var singleKey in writable) {
        if (!Object.prototype.hasOwnProperty.call(writable, singleKey)) continue;
        var singleField = {};
        singleField[singleKey] = writable[singleKey];
        add(singleField);
      }
    }
    return attempts;
  }

  function markRejectedFields(patch, attempt) {
    for (var key in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
      if (Object.prototype.hasOwnProperty.call(attempt, key)) continue;
      if (!_rejectedOrderFields[key]) {
        console.warn('[RestaurantOrderTakingApp] the order type does not accept the "' + key + '" field - the board keeps that value for this session instead of requiring it on the order.');
      }
      _rejectedOrderFields[key] = true;
    }
  }

  /* Writes one patch and degrades instead of failing: a field the order type
     does not define is dropped, and the status (the one value the kitchen
     cannot work without) is still saved alone. */
  function writeOrderPatchWithFallback(orderId, patch, done) {
    var attempts = buildWriteAttempts(patch);
    if (!attempts.length) { done('there is nothing to save on this order'); return; }
    var attemptIndex = 0;
    function tryNextAttempt() {
      if (attemptIndex >= attempts.length) {
        if (patch[STATUS_FIELD]) {
          console.error('[RestaurantOrderTakingApp] the order type refused the status field. The kitchen status cannot be stored until the order type has a status field inside its order data category.');
        }
        done('the order fields could not be saved');
        return;
      }
      var attempt = attempts[attemptIndex];
      attemptIndex += 1;
      tool.requestObjects('update', orderUpdatePayload(orderId, attempt), function (err) {
        if (!err) {
          /* Saved with fewer fields than asked for: the omitted ones are not
             part of this order type, so stop requesting them. */
          markRejectedFields(patch, attempt);
          done(null);
          return;
        }
        markRejectedFields(patch, attempt);
        tryNextAttempt();
      });
    }
    tryNextAttempt();
  }

  function writeCoreFields(orderId, corePatch, extraPatch, successMessage) {
    setBusy(orderId, true);
    writeOrderPatchWithFallback(orderId, corePatch, function (err) {
      if (err) {
        setBusy(orderId, false);
        console.warn('[RestaurantOrderTakingApp] update failed: ' + err);
        notify('Could not save the change. Please try again.', 'error');
        return;
      }
      applyPatchLocal(orderId, corePatch);
      rememberOrderPatch(orderId, corePatch);
      if (extraPatch && Object.keys(extraPatch).length) {
        writeOrderPatchWithFallback(orderId, extraPatch, function (extraErr) {
          if (extraErr) {
            console.warn('[RestaurantOrderTakingApp] the optional order fields were not stored (' + extraErr + ') - the board keeps them in this session only.');
          }
          /* Shown either way: the accept time and the ETA are the board's own
             defaults when the order type has no field for them (D-ROTA-51). */
          applyPatchLocal(orderId, extraPatch);
          rememberOrderPatch(orderId, extraPatch);
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
    var message = 'Order ' + orderLabelOf(order) + ' accepted' +
      (chosenMinutes > 0 ? ' - estimated ' + etaKindLabel(order) + ' ' + fmtTime(Date.now() + chosenMinutes * 60000) : '') + '.';
    closeModal();
    setOrderStatus(orderId, STATUS_ACCEPTED, message, chosenMinutes);
  }

  function etaKindLabel(order) {
    return order.channelKey === 'delivery' ? 'delivery time' : 'ready time';
  }

  /* Short ETA label for the compact card row (the detail popup keeps the
     full wording). */
  function etaShortLabelOf(order) {
    return order.channelKey === 'delivery' ? 'deliver' : 'ready';
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

  /* Empty state that explains WHY the board is empty (D-ROTA-43): no
     restaurant assigned, an ambiguous slug, or orders that belong elsewhere. */
  function boardEmptyHtml() {
    if (_restaurantState === 'no-context') {
      return 'This board cannot tell which restaurant it belongs to, so it shows no orders. Give the board record the same slug as the restaurant object, or open the board from the restaurant page.';
    }
    if (_restaurantState === 'duplicate') {
      return 'More than one restaurant object matches this board. The board stays closed until the match is unique.';
    }
    if (_restaurantState === 'not-found') {
      return 'No restaurant object matches this board. A system admin must check the page address or the restaurant slug; until then only orders that carry it can appear here.';
    }
    if (_hiddenOrderCount) {
      return 'No orders for this restaurant right now. ' + _hiddenOrderCount + ' order' + (_hiddenOrderCount === 1 ? '' : 's') + ' from another restaurant stay hidden.';
    }
    if (_unassignedOrderCount) {
      return _unassignedOrderCount + ' order' + (_unassignedOrderCount === 1 ? '' : 's') + ' carry no restaurantSlug and are hidden. The order writer must store restaurantSlug = the restaurant slug on every order.';
    }
    return 'No orders yet. When a customer places an order, it appears here automatically.';
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
        state.innerHTML = boardEmptyHtml();
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
    if (!order.isTerminal) {
      html += '<span class="' + elapsedClass + '" data-id="' + esc(order.id) + '" data-ts="' + esc(String(tsOf(elapsedFrom))) + '" data-status="' + esc(order.status) + '"></span>';
    }
    html += '</div>';

    html += '<h3 class="roa-card-name">' + esc(orderTitleOf(order)) + '</h3>';

    /* Fixed info rows (D-ROTA-31). The street address is not repeated on the
       board (D-ROTA-40) - only the table matters during service; the accept
       dialog shows the delivery address. */
    html += '<div class="roa-card-fields">';

    html += '<div class="roa-field"><span class="roa-field-k">Order</span><span class="roa-field-v">' +
      '<span class="roa-order-no">' + esc(orderLabelOf(order)) + '</span>' +
      (order.placeTs ? '<span class="roa-field-at">' + esc(fmtTime(order.placeTs)) + '</span>' : '') +
      '</span></div>';

    if (order.tableNumber) {
      html += '<div class="roa-field"><span class="roa-field-k">Table</span>' +
        '<span class="roa-field-v">' + esc(order.tableNumber) + '</span></div>';
    }

    html += '<div class="roa-field"><span class="roa-field-k">Status</span>' +
      '<span class="roa-field-v"><span class="roa-status st-' + esc(meta.cls) + '">' + esc(meta.label) + '</span></span></div>';

    html += '<div class="roa-field"><span class="roa-field-k">' + (order.isTerminal ? 'Closed' : 'ETA') + '</span>' +
      '<span class="roa-field-v">';
    if (order.isTerminal) {
      html += '<span class="roa-field-empty">' + esc(order.statusChangedAt ? fmtTime(order.statusChangedAt) : meta.label.toLowerCase()) + '</span>';
    } else if (order[ETA_FIELD]) {
      html += '<span class="roa-est">' + esc(fmtTime(order[ETA_FIELD])) + '</span>' + countdownHtml(tsOf(order[ETA_FIELD]));
    } else {
      html += '<span class="roa-field-empty">not set</span>';
    }
    html += '</span></div>';

    if (order.internalNote) {
      html += '<div class="roa-field"><span class="roa-field-k">Note</span>' +
        '<span class="roa-field-v roa-field-note">' + esc(String(order.internalNote).slice(0, 140)) + '</span></div>';
    }

    html += '</div>';

    /* Money: total on its own line at the card bottom */
    var items = lineCountOf(order);
    html += '<div class="roa-card-money">';
    html += '<span class="roa-money-label">Total <span class="roa-money-items">' + esc(String(items)) + ' item' + (items === 1 ? '' : 's') + '</span></span>';
    html += '<span class="roa-card-total">' + esc(fmtMoney(order.totalNum)) + '</span>';
    html += '</div>';

    /* Action: next-step button and the quiet link on ONE line, always the
       very bottom of every card. */
    var actions = cardActionsHtml(order);
    if (actions) html += '<div class="roa-card-actionbar">' + actions + '</div>';

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
      html += '<button type="button" class="roa-btn roa-btn-quiet roa-btn-small" data-act="arm-status" data-status="' + STATUS_DECLINED + '">Decline</button>';
    } else if (order.status === STATUS_ACCEPTED || order.status === STATUS_PREP || order.status === STATUS_READY) {
      html += '<button type="button" class="roa-btn roa-btn-quiet roa-btn-small" data-act="arm-status" data-status="' + STATUS_CANCELLED + '">Cancel</button>';
    }
    return html;
  }

  function renderActionsInPlace(orderId) {
    if (!orderId) return;
    var order = findOrder(orderId);
    if (!order) return;
    var card = document.querySelector('.roa-card[data-id="' + orderId + '"]');
    if (card) {
      var wrap = card.querySelector('.roa-card-actionbar');
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

    /* Live timeline gaps: "12 min and counting" / "in 8 min" / "3 min late". */
    var liveGaps = document.querySelectorAll('[data-tl-mode]');
    for (var g = 0; g < liveGaps.length; g++) {
      var gap = liveGaps[g];
      var gapMode = gap.getAttribute('data-tl-mode');
      if (gapMode !== 'since' && gapMode !== 'until') continue;
      var gapTs = parseInt(gap.getAttribute('data-ts') || '0', 10);
      if (!gapTs) continue;
      var gapState = timelineGapText(gapMode, gapTs);
      var gapText = gap.querySelector ? gap.querySelector('.roa-tl-gap-text') : null;
      if (gapText) gapText.textContent = gapState.text;
      if (gap.classList) gap.classList.toggle('roa-tl-gap-late', gapState.late);
    }

    /* Timeline header numbers: elapsed since placed + time left (D-ROTA-33). */
    var stats = document.querySelectorAll('[data-tl-stat]');
    for (var s = 0; s < stats.length; s++) {
      var stat = stats[s];
      var statMode = stat.getAttribute('data-tl-stat');
      var statTs = parseInt(stat.getAttribute('data-ts') || '0', 10);
      if (!statTs) continue;
      if (statMode === 'since') {
        stat.textContent = fmtElapsedClock(secondsSince(statTs));
      } else if (statMode === 'until') {
        var statState = countdownState(statTs);
        stat.textContent = statState.text;
        if (stat.classList) {
          stat.classList.toggle('is-late', statState.late);
          stat.classList.toggle('is-urgent', !!statState.urgent);
        }
      }
    }
  }

  function renderFoot() {
    setText('roa-refreshed', _lastRefreshAt ? ('Updated ' + fmtTime(_lastRefreshAt)) : '');
  }

  function renderConfigBanner() {
    var banner = $id('roa-config');
    if (!banner) return;
    var messages = [];
    if (String(paramRaw('allowObjectCRUD', '')).toLowerCase() !== 'yes') {
      messages.push('Object access is not configured - the board cannot load orders. Enable allowObjectCRUD and add the order type to allowedObjectTypes in the CMS field settings (details in the console).');
    }
    if (_restaurantState === 'no-context') {
      var pageRoute = parentPageRoute();
      messages.push('This board cannot tell which restaurant it belongs to' +
        (pageRoute.url ? ' (page ' + pageRoute.url + ')' : '') +
        '. ' + boardContextHint(_boardRecordCount, _boardRecordSummaries, pageRoute, _boardRecordError, _boardRecordNotice));
    } else if (_restaurantState === 'not-found') {
      messages.push('This board has no restaurant yet. Give the board record the same slug as the ' + _cfg.settingsType + ' object, or open the board from the restaurant object page.');
    } else if (_restaurantState === 'duplicate') {
      messages.push('Several ' + _cfg.settingsType + ' objects match this board. The board stays closed and the closing-time check stays off until the match is unique.');
    } else if (_restaurantState === 'error') {
      messages.push('The restaurant settings object could not be read, so the closing-time check is off. Orders stay scoped to the restaurant slug.');
    }
    banner.hidden = !messages.length;
    if (messages.length) banner.textContent = messages.join(' ');
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

  /* Print (D-ROTA-36): the kitchen ticket exists while the order is
     accepted - that is the sheet the kitchen works from. */
  function canPrintOrder(order) {
    return !!order && order.status === STATUS_ACCEPTED;
  }

  function detailActionsHtml(order) {
    /* Rare actions live behind the three-dots menu (D-ROTA-34) - the
       header keeps only the next step and the quiet cancel/decline link. */
    var menu = '<div class="roa-menu roa-detail-menu">' +
      '<button type="button" class="roa-btn roa-btn-ghost roa-btn-small roa-menu-btn" id="roa-detail-menu-btn" data-act="detail-menu" aria-haspopup="true" aria-expanded="false" aria-label="More actions">&#8942;</button>' +
      '<div class="roa-menu-panel" id="roa-detail-menu-panel" hidden>' +
      '<button type="button" class="roa-menu-item" data-act="detail-open-cms">Open in admin</button>' +
      '<button type="button" class="roa-menu-item" id="roa-detail-menu-print" data-act="print-order">Print ticket</button>' +
      '</div></div>';
    var printBtn = canPrintOrder(order)
      ? '<button type="button" class="roa-btn roa-btn-ghost roa-btn-print" data-act="print-order">' +
        '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>' +
        'Print</button>'
      : '';

    if (_readOnly || !_canWrite) return printBtn + menu;
    if (isBusy(order.id)) {
      return '<button type="button" class="roa-btn roa-btn-ghost roa-btn-small" disabled>Saving...</button>' + printBtn + menu;
    }
    if (_armed.orderId === order.id) {
      return armedConfirmHtml() + ' <span class="roa-est">this action cannot be undone from the board</span>' + printBtn + menu;
    }
    var meta = statusMetaOf(order.status);
    var html = '';
    if (meta.next) {
      html += '<button type="button" class="roa-btn roa-btn-primary" data-act="' + esc(meta.action) + '" data-status="' + esc(meta.next) + '">' + esc(meta.nextLabel) + '</button>';
    }
    if (order.status === STATUS_NEW) {
      html += '<button type="button" class="roa-btn roa-btn-quiet" data-act="arm-status" data-status="' + STATUS_DECLINED + '">Decline order</button>';
    } else if (order.status === STATUS_ACCEPTED || order.status === STATUS_PREP || order.status === STATUS_READY) {
      html += '<button type="button" class="roa-btn roa-btn-quiet" data-act="arm-status" data-status="' + STATUS_CANCELLED + '">Cancel order</button>';
    }
    return html + printBtn + menu;
  }

  function closeDetailMenu() {
    var panel = $id('roa-detail-menu-panel');
    var btn = $id('roa-detail-menu-btn');
    if (panel) panel.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function toggleDetailMenu() {
    var panel = $id('roa-detail-menu-panel');
    var btn = $id('roa-detail-menu-btn');
    if (!panel) return;
    var willOpen = panel.hidden;
    panel.hidden = !willOpen;
    if (btn) btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }

  function rowHtml(label, value, valueClass) {
    return '<div class="roa-row"><span class="roa-k">' + esc(label) + '</span>' +
      '<span class="roa-v' + (valueClass ? ' ' + valueClass : '') + '">' + esc(value) + '</span></div>';
  }

  /* Status selector for the detail popup (D-ROTA-18): any status can be
     picked - forward OR back - not just the single next step of the
     workflow. The board and the popup update immediately after saving. */
  function statusSelectHtml(order) {
    var disabled = (_readOnly || !_canWrite || isBusy(order.id)) ? ' disabled' : '';
    var options = '';
    for (var i = 0; i < STATUS_ORDER.length; i++) {
      var key = STATUS_ORDER[i];
      var selected = key === order.status ? ' selected' : '';
      options += '<option value="' + esc(key) + '"' + selected + '>' + esc(statusMetaOf(key).label) + '</option>';
    }
    var hint = (_readOnly || !_canWrite)
      ? '<div class="roa-status-hint">Status changes are not available in this view.</div>'
      : '';
    return '<select class="roa-status-select" id="roa-status-select"' + disabled + '>' + options + '</select>' + hint;
  }

  /* ------------------------------------------------------------ timeline */

  /* The rail always shows the WHOLE workflow (D-ROTA-32): Placed ->
     Accepted -> Preparation -> Ready -> Completed. Steps already passed
     are filled, the current step is ringed, steps ahead are hollow. Only
     stored timestamps are printed - a passed step without a stored time
     keeps its dot and shows no clock. Terminal orders swap the tail for
     the closing status. */

  var TIMELINE_CHAIN = [
    { key: 'placed', label: 'Placed' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'prep', label: 'Preparation' },
    { key: 'ready', label: 'Ready' },
    { key: 'done', label: 'Completed' }
  ];

  var STATUS_RANK = {
    'new': 0,
    'accepted': 1,
    'in-preparation': 2,
    'ready': 3,
    'completed': 4
  };

  function timelineStageTs(order, key) {
    if (key === 'placed') return tsOf(order.placedAt);
    if (key === 'accepted') {
      var acceptedTs = tsOf(order.acceptedAt);
      if (!acceptedTs && order.status === STATUS_ACCEPTED) acceptedTs = tsOf(order.statusChangedAt);
      return acceptedTs;
    }
    if (key === 'prep') return order.status === STATUS_PREP ? tsOf(order.statusChangedAt) : 0;
    if (key === 'ready') return order.status === STATUS_READY ? tsOf(order.statusChangedAt) : 0;
    if (key === 'done') return order.status === STATUS_DONE ? tsOf(order.statusChangedAt) : 0;
    return 0;
  }

  function timelineStages(order) {
    var status = order.status;
    var etaTs = tsOf(order[ETA_FIELD]);
    var chain;
    var reachedIndex = STATUS_RANK[status];

    if (status === STATUS_DECLINED) {
      chain = [{ key: 'placed', label: 'Placed' }, { key: 'closed', label: 'Declined', tone: 'declined' }];
      reachedIndex = 1;
    } else if (status === STATUS_CANCELLED) {
      chain = [{ key: 'placed', label: 'Placed' }, { key: 'accepted', label: 'Accepted' },
        { key: 'closed', label: 'Cancelled', tone: 'cancelled' }];
      reachedIndex = 2;
    } else {
      chain = TIMELINE_CHAIN.slice();
      if (typeof reachedIndex !== 'number') reachedIndex = 0;
    }

    var stages = [];
    for (var i = 0; i < chain.length; i++) {
      var step = chain[i];
      var ts = step.key === 'closed' ? tsOf(order.statusChangedAt) : timelineStageTs(order, step.key);
      var state;
      if (i < reachedIndex) state = 'done';
      else if (i > reachedIndex) state = 'pending';
      else state = (step.key === 'closed' || step.key === 'done') ? 'closed' : (i === 0 ? 'done' : 'active');
      /* the placed dot is never in flight - the order already exists */
      if (i === 0 && state === 'active') state = 'done';

      stages.push({
        key: step.key,
        label: step.label,
        ts: ts,
        state: state,
        /* a tone only colours a step that was actually reached */
        tone: (state === 'pending') ? '' : (step.tone || (step.key === 'done' ? 'done' : ''))
      });
    }

    /* the estimate rides on the Ready dot while that step is still ahead */
    for (var e = 0; e < stages.length; e++) {
      if (stages[e].key === 'ready' && etaTs && !stages[e].ts && !order.isTerminal) stages[e].est = etaTs;
    }
    return stages;
  }

  function timelineGapText(mode, ts) {
    if (!ts) return { text: '', late: false };
    var now = Date.now();
    if (mode === 'since') return { text: fmtShortGap(now - ts) + ' and counting', late: false };
    var remaining = ts - now;
    if (remaining >= 0) return { text: 'in ' + fmtShortGap(remaining), late: false };
    return { text: fmtShortGap(-remaining) + ' late', late: true };
  }

  function timelineNodeHtml(stage) {
    var timeClass = 'roa-tl-time';
    var timeText = '';
    if (stage.ts) {
      timeText = fmtTime(stage.ts);
    } else if (stage.est) {
      timeText = 'est ' + fmtTime(stage.est);
      timeClass += ' roa-tl-time-est';
    } else if (stage.state !== 'pending') {
      timeText = '\u2014';
      timeClass += ' roa-tl-time-empty';
    }
    return '<li class="roa-tl-node roa-tl-' + esc(stage.state) +
      (stage.tone ? ' roa-tl-tone-' + esc(stage.tone) : '') + '">' +
      '<span class="roa-tl-dot"></span>' +
      '<span class="roa-tl-label">' + esc(stage.label) + '</span>' +
      '<span class="' + timeClass + '">' + esc(timeText) + '</span>' +
      '</li>';
  }

  function timelineGapHtml(previous, next) {
    var classes = 'roa-tl-gap';
    var liveMode = '';
    var liveTs = 0;
    var text = '';

    if (previous.ts && next.ts && next.ts >= previous.ts) {
      classes += ' roa-tl-gap-done';
      text = fmtShortGap(next.ts - previous.ts);
    } else if (next.state === 'pending' && previous.ts) {
      classes += ' roa-tl-gap-live';
      liveMode = 'since';
      liveTs = previous.ts;
    } else if (next.state === 'pending') {
      classes += ' roa-tl-gap-pending';
    } else if (next.state === 'closed') {
      classes += ' roa-tl-gap-closed';
    } else {
      classes += ' roa-tl-gap-unknown';
    }

    if (liveMode) {
      var live = timelineGapText(liveMode, liveTs);
      text = live.text;
      if (live.late) classes += ' roa-tl-gap-late';
    }

    return '<li class="' + classes + '"' +
      (liveMode ? ' data-tl-mode="' + liveMode + '" data-ts="' + esc(String(liveTs)) + '"' : '') + '>' +
      '<span class="roa-tl-line"></span>' +
      (text ? '<span class="roa-tl-gap-text">' + esc(text) + '</span>' : '') +
      '</li>';
  }

  /* The two numbers that matter (D-ROTA-33): how long the order has been
     with us, and how long is left until the promised time. */
  function timelineStatHtml(order) {
    var html = '';
    var placedTs = tsOf(order.placedAt);
    if (placedTs) {
      html += '<span class="roa-tl-stat"><span class="roa-tl-stat-k">Since placed</span>' +
        '<span class="roa-tl-stat-v" data-tl-stat="since" data-ts="' + esc(String(placedTs)) + '">' +
        esc(fmtElapsedClock(secondsSince(placedTs))) + '</span></span>';
    }
    var etaTs = tsOf(order[ETA_FIELD]);
    if (etaTs && !order.isTerminal) {
      var state = countdownState(etaTs);
      var extraClass = state.late ? ' is-late' : (state.urgent ? ' is-urgent' : '');
      html += '<span class="roa-tl-stat"><span class="roa-tl-stat-k">' +
        (order.channelKey === 'delivery' ? 'To delivery' : 'To ready') + '</span>' +
        '<span class="roa-tl-stat-v' + extraClass + '" data-tl-stat="until" data-ts="' + esc(String(etaTs)) + '">' +
        esc(state.text) + '</span></span>';
    } else if (!order.isTerminal) {
      html += '<span class="roa-tl-stat"><span class="roa-tl-stat-k">' +
        (order.channelKey === 'delivery' ? 'To delivery' : 'To ready') + '</span>' +
        '<span class="roa-tl-stat-v is-empty">not set</span></span>';
    }
    return html;
  }

  function timelineHtml(order) {
    var stages = timelineStages(order);
    if (stages.length < 2) return '';
    var rail = '';
    for (var i = 0; i < stages.length; i++) {
      if (i > 0) rail += timelineGapHtml(stages[i - 1], stages[i]);
      rail += timelineNodeHtml(stages[i]);
    }
    return '<section class="roa-tl-band">' +
      '<div class="roa-tl-head">' +
      '<h3 class="roa-tl-title">Timeline</h3>' +
      '<div class="roa-tl-stats">' + timelineStatHtml(order) + '</div>' +
      '</div>' +
      '<div class="roa-tl"><ol class="roa-tl-rail">' + rail + '</ol></div>' +
      '</section>';
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
    html += '<div class="roa-detail-title">';
    html += '<span class="roa-channel">' + esc(channel.icon + ' ' + channel.label) + '</span>';
    html += '<span class="roa-detail-number">' + esc(orderLabelOf(order)) + '</span>';
    html += '<span class="roa-status st-' + esc(meta.cls) + '">' + esc(meta.label) + '</span>';
    html += '</div>';
    html += '<div class="roa-detail-actions" id="roa-detail-actions">' + detailActionsHtml(order) + '</div>';
    html += '<button type="button" class="roa-modal-x" data-act="detail-back" aria-label="Close">&#10005;</button>';
    html += '</div>';

    html += '<div class="roa-detail-grid">';

    /* side column */
    html += '<div class="roa-detail-side">';

    html += '<section class="roa-block"><h3 class="roa-block-title"><span>Status</span>' +
      ((_readOnly || !_canWrite) ? '' : '<span class="roa-help" title="Pick any status - forward or back. The board updates immediately." aria-label="Pick any status - forward or back. The board updates immediately.">?</span>') +
      '</h3>';
    html += statusSelectHtml(order);
    html += '</section>';

    /* Customer collapses to the name (D-ROTA-30 pattern). */
    var customerName = customer.fullName || customer.name || 'Not provided';
    var customerRows = rowHtml('Name', customerName);
    var phone = customer.phone || '';
    if (phone) {
      customerRows += '<div class="roa-row"><span class="roa-k">Phone</span><span class="roa-v">' +
        '<button type="button" class="roa-link" data-act="call" data-phone="' + esc(phone) + '">' + esc(phone) + '</button></span></div>';
    }
    if (order.tableNumber) customerRows += rowHtml('Table', order.tableNumber);
    var address = order.address;
    if (address) {
      var addrLines = addressLines(address);
      if (addrLines.length) {
        customerRows += '<div class="roa-row roa-row-block"><span class="roa-k">Address</span>' +
          '<span class="roa-v roa-addr">' + addrLines.map(esc).join('<br>') + '</span></div>';
      }
    }
    var customFields = order.customAddressFields;
    if (customFields) {
      Object.keys(customFields).forEach(function (key) {
        var value = customFields[key];
        if (value === null || value === undefined || value === '') return;
        customerRows += rowHtml(key, value);
      });
    }
    html += '<details class="roa-block roa-fold">';
    html += '<summary class="roa-block-title"><span>Customer</span>' +
      '<span class="roa-fold-value">' + esc(customerName) + '</span>' +
      '<span class="roa-fold-caret">&#9662;</span></summary>';
    html += '<div class="roa-fold-body">' + customerRows + '</div></details>';

    html += '<details class="roa-block roa-fold">';
    html += '<summary class="roa-block-title"><span>Exact timestamps</span><span class="roa-fold-caret">&#9662;</span></summary>';
    html += '<div class="roa-fold-body">';
    if (order.placedAt) html += rowHtml('Placed on', fmtDateTime(order.placedAt));
    if (order.scheduledFor) html += rowHtml('Scheduled for', fmtDateTime(order.scheduledFor));
    if (order[ACCEPTED_AT_FIELD]) html += rowHtml('Accepted on', fmtDateTime(order[ACCEPTED_AT_FIELD]));
    if (order.statusChangedAt) html += rowHtml('Status changed', fmtDateTime(order.statusChangedAt));
    if (order[ETA_FIELD]) html += rowHtml('Estimated ' + etaKindLabel(order), fmtDateTime(order[ETA_FIELD]));
    html += '</div></details>';

    html += '<details class="roa-block roa-fold">';
    html += '<summary class="roa-block-title"><span>Payment</span>' +
      '<span class="roa-fold-value">' + esc(paymentLabelOf(order.paymentMethod) || 'Not selected') + '</span>' +
      '<span class="roa-fold-caret">&#9662;</span></summary>';
    html += '<div class="roa-fold-body">';
    var details = order.paymentDetails || {};
    var paymentRows = '';
    if (details.provider) paymentRows += rowHtml('Provider', details.provider);
    var card = cardSummary(details.card);
    if (card) paymentRows += rowHtml('Card', card);
    html += paymentRows || '<p class="roa-fold-empty">No further payment details on this order.</p>';
    html += '</div></details>';

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

    /* Items first in the main column - this is what the kitchen reads
       (D-ROTA-28). */
    html += '<section class="roa-block"><h3 class="roa-block-title">Items to prepare <span class="roa-block-count">' + esc(String(lineCountOf(order))) + '</span></h3>';
    html += linesHtml(order);
    html += '</section>';

    /* Totals collapse to the grand total (D-ROTA-30 pattern). */
    html += '<details class="roa-block roa-fold">';
    html += '<summary class="roa-block-title"><span>Totals</span>' +
      '<span class="roa-fold-value">' + esc(fmtMoney(order.totals.total)) + '</span>' +
      '<span class="roa-fold-caret">&#9662;</span></summary>';
    html += '<div class="roa-fold-body">' + totalsHtml(order, true) + '</div></details>';

    if (order.internalNote) {
      html += '<section class="roa-block"><h3 class="roa-block-title">Internal note</h3>' +
        '<div class="roa-note-box">' + esc(String(order.internalNote)) + '</div></section>';
    }

    html += '</div>';
    html += '</div>';

    /* Timeline at the BOTTOM (D-ROTA-29): a footer rail under the details,
       headed by the two numbers that matter (D-ROTA-33). */
    html += timelineHtml(order);

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
    html += '<span class="roa-qty">' + esc(String(quantity)) + '\u00D7</span>';
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
        if (entry.groupName) html += ' <span class="roa-mod-group">(' + esc(entry.groupName) + ')</span>';
        if (entryQty > 1) html += ' <span class="roa-mod-qty">\u00D7' + esc(String(entryQty)) + '</span>';
        if (entry.internalName) html += ' <span class="roa-mod-group">' + esc(entry.internalName) + '</span>';
        if (num(entry.priceAdjustment) !== 0) {
          html += ' <span class="roa-mod-price">' + (num(entry.priceAdjustment) > 0 ? '+' : '') +
            esc(fmtMoney(entry.priceAdjustment)) + '</span>';
        }
        html += '</li>';
      }
      html += '</ul>';
    }

    if (line.instructions) {
      html += '<div class="roa-instr"><span class="roa-instr-label">Note</span>' + esc(line.instructions) + '</div>';
    }

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

  function totalsHtml(order, summaryMode) {
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

    /* Collapsed summary already shows the total, so the body only lists the
       parts that make it up. */
    if (summaryMode) {
      if (!rows) return '<div class="roa-empty-inline">Only the grand total is stored on this order.</div>';
      return '<div class="roa-totals roa-totals-flat">' + rows + '</div>';
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

  /* Summary shown inside the accept dialog (D-ROTA-39): the customer, the
     delivery address (or the table / counter), the item count and the
     internal note, so the order taker sees where it goes before accepting. */
  function modalSummaryHtml(order) {
    var customer = order.customer || {};
    var rows = '';

    var customerText = customer.fullName || customer.name || '';
    if (customer.phone) customerText += (customerText ? ' \u00B7 ' : '') + customer.phone;
    if (customerText) {
      rows += '<div class="roa-modal-row"><span class="roa-modal-k">Customer</span>' +
        '<span class="roa-modal-v">' + esc(customerText) + '</span></div>';
    }

    /* Delivery decides the destination line (D-ROTA-40): the address is
       shown for delivery orders only, never for pickup / dine-in. */
    if (order.channelKey === 'delivery') {
      var addrLines = addressLines(order.address);
      rows += '<div class="roa-modal-row roa-modal-row-block"><span class="roa-modal-k">Deliver to</span>' +
        '<span class="roa-modal-v roa-modal-addr">' +
        (addrLines.length ? addrLines.map(esc).join('<br>') : 'Address not provided') +
        '</span></div>';
      var zone = order.deliveryZone;
      if (zone && (zone.name || zone.id)) {
        rows += '<div class="roa-modal-row"><span class="roa-modal-k">Zone</span>' +
          '<span class="roa-modal-v">' + esc(zone.name || zone.id) + '</span></div>';
      }
    } else if (order.tableNumber) {
      rows += '<div class="roa-modal-row"><span class="roa-modal-k">Serve at</span>' +
        '<span class="roa-modal-v">Table ' + esc(order.tableNumber) + '</span></div>';
    } else {
      rows += '<div class="roa-modal-row"><span class="roa-modal-k">Pickup</span>' +
        '<span class="roa-modal-v">At the counter</span></div>';
    }

    var items = lineCountOf(order);
    rows += '<div class="roa-modal-row"><span class="roa-modal-k">Items</span>' +
      '<span class="roa-modal-v">' + esc(String(items)) + ' item' + (items === 1 ? '' : 's') + '</span></div>';

    if (order.internalNote) {
      rows += '<div class="roa-modal-row roa-modal-row-block"><span class="roa-modal-k">Note</span>' +
        '<span class="roa-modal-v roa-modal-note">' + esc(String(order.internalNote)) + '</span></div>';
    }

    if (!rows) return '';
    return '<div class="roa-modal-summary">' + rows + '</div>';
  }

  function renderAcceptModal() {
    var order = findOrder(_acceptFor);
    if (!order) { closeModal(); return; }
    setText('roa-modal-title', 'Accept order');
    var channel = channelMetaOf(order.channelKey);
    var kind = etaKindLabel(order);

    var html = '<div class="roa-modal-order">' +
      '<span>' + esc(orderLabelOf(order)) + ' - ' + esc(orderTitleOf(order)) + '</span>' +
      '<span class="roa-card-total">' + esc(fmtMoney(order.totalNum)) + '</span></div>';

    /* Who and where must be visible BEFORE accepting (D-ROTA-39). */
    html += closingNoticeHtml();
    html += modalSummaryHtml(order);

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

  /* ------------------------------------------------------------- print */
  /* Black-only thermal ticket (D-ROTA-36). The sheet is built into a hidden
     container and revealed by the print media query, so window.print prints
     the ticket only - never the board. No colors, no logos, no line prices:
     a pick ticket for the kitchen and the driver. */

  function ensurePrintRoot() {
    var host = $id('roa-print');
    if (host) return host;
    var root = $id('roa-root');
    if (!root || typeof document.createElement !== 'function' || typeof root.appendChild !== 'function') return null;
    host = document.createElement('div');
    host.id = 'roa-print';
    host.className = 'roa-print';
    host.setAttribute('aria-hidden', 'true');
    root.appendChild(host);
    return host;
  }

  function printRowHtml(label, value) {
    if (value === undefined || value === null || value === '') return '';
    return '<div><span>' + esc(label) + '</span><span>' + esc(value) + '</span></div>';
  }

  function printLineHtml(line) {
    if (!line || typeof line !== 'object') return '';
    var quantity = num(line.quantity) || 1;
    var html = '<div class="roa-print-item">';
    html += '<div class="roa-print-item-line">' +
      '<span class="roa-print-qty">' + esc(String(quantity)) + 'x</span>' +
      '<span class="roa-print-name">' + esc(line.itemName || line.internalName || 'Item') + '</span>' +
      (line.sizeLabel ? '<span class="roa-print-size">' + esc(line.sizeLabel) + '</span>' : '') +
      '</div>';
    var entries = asArray(line.modifierEntries);
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i] || {};
      var entryQty = num(entry.quantity);
      html += '<div class="roa-print-mod">+ ' + esc(entry.optionName || entry.optionId || 'Option') +
        (entryQty > 1 ? ' x' + esc(String(entryQty)) : '') + '</div>';
    }
    if (line.instructions) {
      html += '<div class="roa-print-note">* ' + esc(line.instructions) + '</div>';
    }
    html += '</div>';
    return html;
  }

  function printSheetHtml(order) {
    var channel = channelMetaOf(order.channelKey);
    var customer = order.customer || {};
    var meta = statusMetaOf(order.status);

    var html = '<div class="roa-print-sheet">';

    html += '<div class="roa-print-head">' +
      '<span class="roa-print-brand">Kitchen order</span>' +
      '<span class="roa-print-num">' + esc(orderLabelOf(order)) + '</span>' +
      '</div>';
    html += '<div class="roa-print-rule"></div>';

    html += '<div class="roa-print-meta">';
    html += printRowHtml('Record', order.orderNumber || '');
    html += printRowHtml('Status', meta.label);
    html += printRowHtml('Type', channel.label);
    html += printRowHtml('Date', fmtDateOnly(order.placedAt));
    html += printRowHtml('Placed', fmtTime(order.placedAt));
    html += printRowHtml('Accepted', order[ACCEPTED_AT_FIELD] ? fmtTime(order[ACCEPTED_AT_FIELD]) : '');
    html += printRowHtml(order.channelKey === 'delivery' ? 'Deliver by' : 'Ready by',
      order[ETA_FIELD] ? fmtTime(order[ETA_FIELD]) : '');
    html += '</div>';

    html += '<div class="roa-print-rule"></div>';
    html += '<div class="roa-print-items">';
    if (!order.lines.length) {
      html += '<div class="roa-print-item">No line items on this order.</div>';
    } else {
      for (var i = 0; i < order.lines.length; i++) html += printLineHtml(order.lines[i]);
    }
    html += '</div>';

    html += '<div class="roa-print-rule"></div>';
    var items = lineCountOf(order);
    html += '<div class="roa-print-total"><span>' + esc(String(items)) + ' item' + (items === 1 ? '' : 's') + '</span>' +
      '<span>' + esc(fmtMoney(order.totalNum)) + '</span></div>';

    html += '<div class="roa-print-rule"></div>';
    html += '<div class="roa-print-meta">';
    html += printRowHtml('Customer', customer.fullName || customer.name || '');
    html += printRowHtml('Phone', customer.phone || '');
    if (order.tableNumber) html += printRowHtml('Table', order.tableNumber);
    var addrLines = addressLines(order.address);
    if (addrLines.length) {
      html += '<div><span>Address</span><span>' + addrLines.map(esc).join('<br>') + '</span></div>';
    }
    html += printRowHtml('Payment', paymentLabelOf(order.paymentMethod) || '');
    if (order.internalNote) html += printRowHtml('Note', order.internalNote);
    html += '</div>';

    html += '<div class="roa-print-rule"></div>';
    html += '<div class="roa-print-foot">Printed ' + esc(fmtDateOnly(new Date().toISOString())) + ' ' + esc(fmtTime(new Date().toISOString())) + '</div>';
    html += '</div>';

    return html;
  }

  function printOrder(orderId) {
    var order = findOrder(orderId || _detailId);
    if (!order) return;
    closeDetailMenu();
    if (_cfg.printMode === 'rawbt') {
      printViaRawbt(order);
      return;
    }
    printViaDialog(order);
  }

  function printViaDialog(order) {
    var host = ensurePrintRoot();
    if (!host) { notify('Printing is not available in this environment.', 'warning'); return; }
    host.innerHTML = printSheetHtml(order);
    try {
      if (typeof window !== 'undefined' && typeof window.print === 'function') window.print();
      else notify('Printing is not available in this environment.', 'warning');
    } catch (err) {
      notify('Printing failed - open the order in admin and print it there.', 'warning');
    }
  }

  /* --------------------------------------------- ESC/POS direct printing */
  /* A web page cannot skip the print dialog by itself. Anything faster needs
     a print owner on the device. On an Android tablet that owner can be the
     RawBT app: it accepts a base64 ESC/POS ticket in the URL, prints it on
     the printer configured inside the app and never shows a dialog. The URL
     is opened with tool.openUrl, the only external channel a tool has. */

  var ESC = '\u001B';
  var GS = '\u001D';

  function escPosInit() { return ESC + '@'; }
  function escPosAlignLeft() { return ESC + 'a' + '\u0000'; }
  function escPosAlignCenter() { return ESC + 'a' + '\u0001'; }
  function escPosBold(on) { return ESC + 'E' + (on ? '\u0001' : '\u0000'); }
  function escPosDouble(on) { return GS + '!' + (on ? '\u0011' : '\u0000'); }
  function escPosCut() { return GS + 'V' + '\u0041' + '\u0000'; }

  function escPosRule(width) {
    var line = '';
    for (var i = 0; i < width; i++) line += '-';
    return line;
  }

  function escPosTwoColumn(leftText, rightText, width) {
    var left = String(leftText === undefined || leftText === null ? '' : leftText);
    var right = String(rightText === undefined || rightText === null ? '' : rightText);
    if (left.length + right.length + 1 > width) {
      left = left.slice(0, Math.max(0, width - right.length - 1));
    }
    var spaces = width - left.length - right.length;
    var pad = '';
    for (var i = 0; i < Math.max(1, spaces); i++) pad += ' ';
    return left + pad + right;
  }

  /* 42 columns = 80 mm paper, 32 columns = 58 mm paper. */
  function buildEscPosTicket(order, columns) {
    var width = columns || 42;
    var meta = statusMetaOf(order.status);
    var channel = channelMetaOf(order.channelKey);
    var customer = order.customer || {};
    var out = '';

    out += escPosInit();
    out += escPosAlignCenter();
    out += escPosDouble(true) + escPosBold(true) + 'KITCHEN ORDER\r\n' + escPosDouble(false) + escPosBold(false);
    out += escPosDouble(true) + escPosBold(true) + orderLabelOf(order) + '\r\n' + escPosDouble(false) + escPosBold(false);
    out += meta.label.toUpperCase() + ' - ' + channel.label.toUpperCase() + '\r\n';

    out += escPosAlignLeft();
    out += escPosRule(width) + '\r\n';
    out += escPosTwoColumn('RECORD', order.orderNumber || '-', width) + '\r\n';
    out += escPosTwoColumn('DATE', fmtDateOnly(order.placedAt) || '-', width) + '\r\n';
    out += escPosTwoColumn('PLACED', fmtTime(order.placedAt) || '-', width) + '\r\n';
    if (order[ACCEPTED_AT_FIELD]) {
      out += escPosTwoColumn('ACCEPTED', fmtTime(order[ACCEPTED_AT_FIELD]), width) + '\r\n';
    }
    if (order[ETA_FIELD]) {
      out += escPosTwoColumn(order.channelKey === 'delivery' ? 'DELIVER BY' : 'READY BY',
        fmtTime(order[ETA_FIELD]), width) + '\r\n';
    }

    out += escPosRule(width) + '\r\n';
    for (var i = 0; i < order.lines.length; i++) {
      var line = order.lines[i] || {};
      var quantity = num(line.quantity) || 1;
      var size = line.sizeLabel ? ' (' + String(line.sizeLabel).toUpperCase() + ')' : '';
      out += escPosBold(true) + quantity + 'x ' + (line.itemName || line.internalName || 'Item') + size + '\r\n' + escPosBold(false);
      var entries = asArray(line.modifierEntries);
      for (var m = 0; m < entries.length; m++) {
        var entry = entries[m] || {};
        var entryQty = num(entry.quantity);
        out += '   + ' + (entry.optionName || entry.optionId || 'Option') +
          (entryQty > 1 ? ' x' + entryQty : '') + '\r\n';
      }
      if (line.instructions) {
        out += '   * ' + String(line.instructions).toUpperCase() + '\r\n';
      }
    }

    out += escPosRule(width) + '\r\n';
    var items = lineCountOf(order);
    out += escPosBold(true) + escPosTwoColumn(items + (items === 1 ? ' ITEM' : ' ITEMS'), fmtMoney(order.totalNum), width) +
      '\r\n' + escPosBold(false);

    out += escPosRule(width) + '\r\n';
    if (customer.fullName || customer.name) out += escPosTwoColumn('CUSTOMER', customer.fullName || customer.name, width) + '\r\n';
    if (customer.phone) out += escPosTwoColumn('PHONE', customer.phone, width) + '\r\n';
    if (order.tableNumber) out += escPosTwoColumn('TABLE', order.tableNumber, width) + '\r\n';
    var addrLines = addressLines(order.address);
    for (var a = 0; a < addrLines.length; a++) {
      out += escPosTwoColumn(a === 0 ? 'ADDRESS' : '', addrLines[a], width) + '\r\n';
    }
    if (order.paymentMethod) out += escPosTwoColumn('PAYMENT', paymentLabelOf(order.paymentMethod), width) + '\r\n';
    if (order.internalNote) out += escPosTwoColumn('NOTE', order.internalNote, width) + '\r\n';

    out += escPosRule(width) + '\r\n';
    out += escPosAlignCenter() + 'Printed ' + fmtDateOnly(new Date().toISOString()) + ' ' + fmtTime(new Date().toISOString()) + '\r\n';
    out += '\r\n\r\n\r\n';
    out += escPosCut();
    return out;
  }

  /* ESC/POS is ASCII plus control codes; UTF-8 keeps the control bytes and
     lets the printer render accented names with its own code page. */
  function utf8BytesOf(text) {
    var escaped = '';
    var value = String(text || '');
    for (var i = 0; i < value.length; i++) {
      var code = value.charCodeAt(i);
      if (code < 0x80) escaped += String.fromCharCode(code);
      else if (code < 0x800) escaped += String.fromCharCode(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
      else escaped += String.fromCharCode(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
    }
    return escaped;
  }

  function base64OfText(text) {
    var bytes = utf8BytesOf(text);
    if (typeof btoa === 'function') {
      try { return btoa(bytes); } catch (err) { /* fall through */ }
    }
    var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var output = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var b0 = bytes.charCodeAt(i);
      var b1 = i + 1 < bytes.length ? bytes.charCodeAt(i + 1) : NaN;
      var b2 = i + 2 < bytes.length ? bytes.charCodeAt(i + 2) : NaN;
      output += alphabet.charAt(b0 >> 2);
      output += alphabet.charAt(((b0 & 3) << 4) | (isNaN(b1) ? 0 : b1 >> 4));
      output += isNaN(b1) ? '=' : alphabet.charAt(((b1 & 15) << 2) | (isNaN(b2) ? 0 : b2 >> 6));
      output += isNaN(b2) ? '=' : alphabet.charAt(b2 & 63);
    }
    return output;
  }

  function printViaRawbt(order) {
    var ticket = base64OfText(buildEscPosTicket(order));
    var url = 'rawbt:base64,' + ticket;
    try {
      if (typeof tool.openUrl === 'function') {
        tool.openUrl(url);
        notify('Ticket sent to the printer.', 'success');
        return;
      }
    } catch (err) {
      console.warn('[RestaurantOrderTakingApp] RawBT handoff failed: ' + err);
    }
    notify('The print app is not available - opening the print dialog instead.', 'warning');
    printViaDialog(order);
  }

  /* --------------------------------------------- sample data import */
  /* TEMPORARY QA feature (D-ROTA-21): imports a sample JSON file as real
     CMS order objects so the board UI can be reviewed inside the CMS. */

  var SAMPLE_TIME_FIELDS = ['placedAt', 'statusChangedAt', 'acceptedAt', 'estimatedReadyAt', 'scheduledFor'];

  /* Relative time markers in sample files: "-45m" = 45 minutes ago,
     "+25m" = in 25 minutes, "-26h" = yesterday. Anything else (an ISO
     string or a missing value) passes through untouched. */
  function sampleTimeOf(value) {
    if (value === undefined || value === null || value === '') return value;
    if (typeof value !== 'string') return value;
    var match = /^([+-]?\d+)([mh])$/.exec(String(value).trim());
    if (!match) return value;
    var minutes = parseInt(match[1], 10) * (match[2] === 'h' ? 60 : 1);
    return new Date(Date.now() + minutes * 60000).toISOString();
  }

  function importPlanFromJson(parsed) {
    var entries = Array.isArray(parsed) ? parsed :
      (parsed && Array.isArray(parsed.orders) ? parsed.orders : null);
    if (!entries) return { error: 'Expected a JSON array of order objects (each entry is the data_categoriesBased payload of one order).' };
    if (!entries.length) return { error: 'The JSON file contains no orders.' };
    return { entries: entries, count: entries.length };
  }

  function entryToCreateOp(entry) {
    var dcb = (entry && typeof entry === 'object') ? entry : {};
    var prepared = {};
    for (var key in dcb) {
      if (Object.prototype.hasOwnProperty.call(dcb, key)) prepared[key] = dcb[key];
    }
    for (var fieldIndex = 0; fieldIndex < SAMPLE_TIME_FIELDS.length; fieldIndex++) {
      var timeField = SAMPLE_TIME_FIELDS[fieldIndex];
      var convertedTime = sampleTimeOf(dcb[timeField]);
      if (convertedTime !== undefined && convertedTime !== null) prepared[timeField] = convertedTime;
    }
    /* A sample row without a restaurant would vanish from the scoped board,
       so the resolved restaurant of THIS board is stamped on it (D-ROTA-42).
       The field is restaurantSlug - the value production orders carry. */
    var scopedRestaurantKey = _restaurantSettings
      ? (restaurantSlugOf(_restaurantSettings) || restaurantKeyOfValue(_restaurantSettings.id))
      : '';
    if (scopedRestaurantKey) {
      var hasRestaurant = false;
      for (var rf = 0; rf < ORDER_RESTAURANT_FIELDS.length; rf++) {
        if (prepared[ORDER_RESTAURANT_FIELDS[rf]]) { hasRestaurant = true; break; }
      }
      if (!hasRestaurant) prepared.restaurantSlug = scopedRestaurantKey;
    }
    var recordNumber = dcb.orderNumber || '';
    return {
      action: 'create',
      mainObjectType: _cfg.ordersType,
      name: recordNumber ? ('Order ' + recordNumber) : 'Sample order',
      productData: { data_categoriesBased: wrapOrderPatch(categoryForCreatedOrder(), prepared) }
    };
  }

  /* Category used for a new order: the configured one, else the category the
     loaded orders use, else flat (D-ROTA-50). */
  function categoryForCreatedOrder() {
    if (_cfg.ordersDataCategory) return _cfg.ordersDataCategory;
    for (var i = 0; i < _orders.length; i++) {
      if (_orders[i].dataCategory) return _orders[i].dataCategory;
    }
    return '';
  }

  function runSequentialImports(ops, index, total, done) {
    if (index >= ops.length) { done(); return; }
    var op = ops[index];
    tool.requestObjects('create', {
      mainObjectType: op.mainObjectType,
      name: op.name,
      productData: op.productData
    }, function (err) {
      if (err) {
        _importBusy = false;
        renderMenu();
        notify('Import stopped at item ' + (index + 1) + ' of ' + total + ' - ' + err, 'error');
        loadOrders(false);
        return;
      }
      runSequentialImports(ops, index + 1, total, done);
    });
  }

  function importOrdersFromText(text) {
    if (_readOnly || !_canWrite) { notify('You cannot change orders in this view.', 'warning'); return; }
    if (_importBusy) return;
    var parsed = null;
    try { parsed = JSON.parse(text); } catch (err) {
      notify('The selected file is not valid JSON.', 'error');
      return;
    }
    var plan = importPlanFromJson(parsed);
    if (plan.error) { notify(plan.error, 'error'); return; }

    var ops = [];
    for (var i = 0; i < plan.entries.length; i++) ops.push(entryToCreateOp(plan.entries[i]));

    _importBusy = true;
    renderMenu();
    notify('Importing ' + plan.count + ' sample order(s)...', 'info');

    var done = function () {
      _importBusy = false;
      renderMenu();
      notify('Imported ' + plan.count + ' sample order(s).', 'success');
      _silentNextLoad = true; /* imported orders must not flash or toast (D-ROTA-22) */
      loadOrders(false);
    };

    if (ops.length > 1) {
      tool.requestObjects('batch', { operations: ops }, function (batchErr) {
        if (!batchErr) { done(); return; }
        runSequentialImports(ops, 0, plan.count, done);
      });
    } else {
      runSequentialImports(ops, 0, plan.count, done);
    }
  }

  /* --------------------------------------------- remove today's orders */
  /* TEMPORARY QA feature (D-ROTA-21): deletes every order placed today so
     imported samples can be wiped from the CMS in one action. */

  function todayRemovalPlan() {
    var ids = [];
    for (var i = 0; i < _orders.length; i++) {
      var order = _orders[i];
      if (order.placeTs && order.isToday) ids.push(order.id);
    }
    return ids;
  }

  function runSequentialDeletes(ids, index, done) {
    if (index >= ids.length) { done(); return; }
    tool.requestObjects('delete', { mainObjectType: _cfg.ordersType, objectId: ids[index] }, function (err) {
      if (err) console.warn('[RestaurantOrderTakingApp] delete failed: ' + err);
      runSequentialDeletes(ids, index + 1, done);
    });
  }

  function executeClearToday() {
    disarmClearToday();
    closeMenu();
    var ids = todayRemovalPlan();
    if (!ids.length) { notify('Nothing to remove.', 'info'); return; }
    var ops = [];
    for (var i = 0; i < ids.length; i++) {
      ops.push({ action: 'delete', mainObjectType: _cfg.ordersType, objectId: ids[i] });
    }
    var finished = function () {
      notify('Removed ' + ids.length + ' order(s) placed today.', 'success');
      loadOrders(false);
    };
    if (ops.length > 1) {
      tool.requestObjects('batch', { operations: ops }, function (batchErr) {
        if (!batchErr) { finished(); return; }
        runSequentialDeletes(ids, 0, finished);
      });
    } else {
      runSequentialDeletes(ids, 0, finished);
    }
  }

  function armClearToday() {
    if (_readOnly || !_canWrite) { notify('You cannot change orders in this view.', 'warning'); return; }
    if (_importBusy) return;
    if (_clearArmed) { executeClearToday(); return; }
    var ids = todayRemovalPlan();
    if (!ids.length) { notify('No orders placed today to remove.', 'info'); closeMenu(); return; }
    _clearArmed = true;
    if (_clearArmTimer) clearTimeout(_clearArmTimer);
    _clearArmTimer = setTimeout(function () {
      disarmClearToday();
      renderMenu();
    }, ARM_SECONDS);
    renderMenu();
    notify('Remove ' + ids.length + ' order(s) placed today? Click the menu again within ' + (ARM_SECONDS / 1000) + ' seconds to confirm.', 'warning');
  }

  function disarmClearToday() {
    _clearArmed = false;
    if (_clearArmTimer) { clearTimeout(_clearArmTimer); _clearArmTimer = null; }
  }

  /* --------------------------------------------- three-dots action menu */

  function renderMenu() {
    var panel = $id('roa-menu-panel');
    var importBtn = $id('roa-menu-import');
    var clearBtn = $id('roa-menu-clear');
    var confirmBtn = $id('roa-menu-clear-confirm');
    var canUse = !_readOnly && _canWrite;
    if (panel) panel.hidden = !_menuOpen;
    if (importBtn) {
      importBtn.disabled = !canUse || _importBusy;
      importBtn.textContent = _importBusy ? 'Importing...' : 'Import sample JSON...';
    }
    if (clearBtn) {
      clearBtn.disabled = !canUse;
      clearBtn.hidden = !!_clearArmed;
    }
    if (confirmBtn) confirmBtn.hidden = !_clearArmed;
  }

  function toggleMenu(force) {
    var btn = $id('roa-menu-btn');
    _menuOpen = (force !== undefined) ? !!force : !_menuOpen;
    if (btn) btn.setAttribute('aria-expanded', _menuOpen ? 'true' : 'false');
    renderMenu();
  }

  function closeMenu() {
    if (_menuOpen) toggleMenu(false);
  }

  function handleAction(trigger) {
    var action = trigger.getAttribute('data-act');
    var orderId = trigger.closest ? (trigger.closest('[data-id]') ? trigger.closest('[data-id]').getAttribute('data-id') : '') : '';
    if (!orderId && _detailId) orderId = _detailId;

    if (action === 'tab') { _ui.tab = trigger.getAttribute('data-tab') || 'all'; persistUiSoon(); renderAll(); return; }
    if (action === 'retry') { _error = ''; loadOrders(false); return; }
    if (action === 'card-open' || action === 'open-detail') { if (orderId) openDetail(orderId); return; }
    if (action === 'detail-back') { closeDetail(); renderBoard(); return; }
    if (action === 'detail-open-cms') { closeDetailMenu(); openInCms(orderId); return; }
    if (action === 'detail-menu') { toggleDetailMenu(); return; }
    if (action === 'print-order') { printOrder(orderId); return; }
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
    if (action === 'menu') { toggleMenu(); return; }
    if (action === 'import-file') {
      closeMenu();
      if (_readOnly || !_canWrite) { notify('You cannot change orders in this view.', 'warning'); return; }
      if (_importBusy) return;
      var fileInput = $id('roa-import-file');
      if (fileInput) {
        fileInput.value = '';
        try { fileInput.click(); } catch (err) { notify('File picking is not available in this environment.', 'warning'); }
      }
      return;
    }
    if (action === 'clear-today') { armClearToday(); return; }
    if (action === 'clear-today-confirm') { executeClearToday(); return; }
    if (action === 'eta-chip') { chooseEtaChip(parseInt(trigger.getAttribute('data-min') || '0', 10)); return; }
    if (action === 'accept-now') { _etaMinutes = 0; if (_acceptFor) acceptOrder(_acceptFor); return; }
    if (action === 'accept-eta') { if (_acceptFor) acceptOrder(_acceptFor); return; }
  }

  function statusSuccessMessage(orderId, newStatus) {
    var order = findOrder(orderId);
    if (!order) return '';
    return 'Order ' + orderLabelOf(order) + ' set to ' + statusMetaOf(newStatus).label + '.';
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
      if (target && target.closest && !target.closest('.roa-detail-menu')) closeDetailMenu();
      if (_menuOpen && target && target.closest && !target.closest('#roa-menu')) closeMenu();
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
      if (target.id === 'roa-status-select') {
        if (_detailId) setOrderStatus(_detailId, target.value, statusSuccessMessage(_detailId, target.value));
        return;
      }
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
      refreshBtn.addEventListener('click', function () { loadOrders(false); loadRestaurantSettings(); });
    }

    var importInput = $id('roa-import-file');
    if (importInput && importInput.addEventListener && typeof FileReader !== 'undefined') {
      importInput.addEventListener('change', function () {
        var file = importInput.files && importInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () { importOrdersFromText(String(reader.result || '')); };
        reader.onerror = function () { notify('Could not read the selected file.', 'error'); };
        reader.readAsText(file);
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      var detailMenuPanel = $id('roa-detail-menu-panel');
      if (detailMenuPanel && !detailMenuPanel.hidden) { closeDetailMenu(); return; }
      if (_menuOpen) { closeMenu(); return; }
      var modal = $id('roa-modal');
      if (modal && !modal.hidden) { closeModal(); return; }
      if (_detailId) { closeDetail(); renderBoard(); }
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
    loadRestaurantSettings();

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
      assignDayNumbers: assignDayNumbers,
      orderLabelOf: orderLabelOf,
      statusSelectHtml: statusSelectHtml,
      timelineStages: timelineStages,
      timelineHtml: timelineHtml,
      timelineGapText: timelineGapText,
      fmtShortGap: fmtShortGap,
      canPrintOrder: canPrintOrder,
      printSheetHtml: printSheetHtml,
      printLineHtml: printLineHtml,
      buildEscPosTicket: buildEscPosTicket,
      escPosTwoColumn: escPosTwoColumn,
      modalSummaryHtml: modalSummaryHtml,
      minutesFromTimeValue: minutesFromTimeValue,
      closeMinutesFromSchedule: closeMinutesFromSchedule,
      closingMinutesToday: closingMinutesToday,
      fmtClockMinutes: fmtClockMinutes,
      restaurantSlugOf: restaurantSlugOf,
      restaurantIdentifiersOf: restaurantIdentifiersOf,
      boardContextHint: boardContextHint,
      collectReachability: collectReachability,
      logReachability: logReachability,
      dataCategoryOf: dataCategoryOf,
      wrapOrderPatch: wrapOrderPatch,
      buildWriteAttempts: buildWriteAttempts,
      localOrderStateOf: function (orderId) { return _localOrderState[orderId] || null; },
      restaurantReferenceOf: restaurantReferenceOf,
      restaurantScopeKeys: restaurantScopeKeys,
      restaurantScopeReport: restaurantScopeReport,
      restaurantCurrencyOf: restaurantCurrencyOf,
      restaurantTimeZoneOf: restaurantTimeZoneOf,
      parseParentPageRoute: parseParentPageRoute,
      normalizeSlug: normalizeSlug,
      sampleTimeOf: sampleTimeOf,
      importPlanFromJson: importPlanFromJson,
      entryToCreateOp: entryToCreateOp,
      todayRemovalPlan: todayRemovalPlan,
      importOrdersFromText: importOrdersFromText,
      executeClearToday: executeClearToday,
      boardOrders: boardOrders,
      tabOrders: tabOrders,
      boardListFor: boardListFor,
      matchesSearch: matchesSearch,
      fmtElapsedClock: fmtElapsedClock,
      etaKindLabel: etaKindLabel,
      etaShortLabelOf: etaShortLabelOf,
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

/* RESTAURANTORDERTAKINGAPP-JS-END build 2026-11-13-5 - if this line is missing in the CMS Tool Builder JS field, the JS was truncated */
