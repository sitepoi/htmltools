/* ===== UNICONHUB RESTAURANT & MENU MANAGER ===== */
/* Unified tool: General Info + Settings + Zones + Menu + Alerts + Devices */

/* ===== DEFAULTS ===== */
var DEFAULTS = {
  general_info: {
    restaurant_name: '',
    brand_name: '',
    cuisine_types: [],
    logo_url: '',
    website_url: '',
    phone: '',
    additional_phones: [],
    email: '',
    address: { street: '', city: '', state: '', zip: '', country: '' },
    coordinates: { lat: 40.7128, lng: -74.006 },
    timezone: '',
    legal: {
      entity_name: '', vat_tax_number: '', entity_type: '',
      registration_number: '', dpo_name: '', account_status: 'Active',
      legal_address: { street: '', city: '', state: '', zip: '', country: '' }
    }
  },
  service_settings: {
    service_toggles: {
      pickup_enabled: false, delivery_enabled: false, on_premise_enabled: false,
      anonymous_ordering_allowed: false, table_reservation_enabled: false
    },
    opening_hours: [
      { day: 0, ranges: [{ open: '09:00', close: '17:00' }], is_closed: false },
      { day: 1, ranges: [{ open: '09:00', close: '17:00' }], is_closed: false },
      { day: 2, ranges: [{ open: '09:00', close: '17:00' }], is_closed: false },
      { day: 3, ranges: [{ open: '09:00', close: '17:00' }], is_closed: false },
      { day: 4, ranges: [{ open: '09:00', close: '17:00' }], is_closed: false },
      { day: 5, ranges: [{ open: '09:00', close: '17:00' }], is_closed: false },
      { day: 6, ranges: [{ open: '09:00', close: '17:00' }], is_closed: false }
    ],
    scheduled_orders: {
      enabled: false, pickup_min_advance: 30, pickup_max_advance: 1440,
      delivery_min_advance: 45, delivery_max_advance: 1440, time_slot_interval: 15
    },
    reservation_settings: {
      min_guests: 1, max_guests: 10, min_advance_minutes: 60, max_advance_days: 30,
      late_hold_minutes: 15, pre_order_enabled: false, deposit_enabled: false, deposit_amount: 0
    },
    on_premise_settings: {
      min_advance_value: 30, min_advance_unit: 'minutes', max_advance_days: 7
    }
  },
  taxation_currency: {
    currency: 'USD', tax_mode: 'exclusive', tax_name: 'Tax',
    tax_categories: [], delivery_fee_tax_rate: 0
  },
  payment_methods: {
    cash_delivery: true, cash_pickup: true, cash_on_premise: true, cash_reservation: false,
    card_delivery: true, card_pickup: true, card_on_premise: true, card_reservation: false,
    call_for_card_delivery: false, call_for_card_pickup: false, call_for_card_on_premise: false, call_for_card_reservation: false,
    interac_delivery: false, interac_pickup: false, interac_on_premise: false, interac_reservation: false,
    online_payment: false
  },
  delivery_zones: { zones: [] },
  delivery_form_settings: {
    address_fields: {
      street: { enabled: true, required: true },
      city: { enabled: true, required: true },
      postal_code: { enabled: true, required: true },
      block: { enabled: false, required: false },
      intercom: { enabled: false, required: false },
      parking_info: { enabled: false, required: false },
      additional_info: { enabled: false, required: false }
    },
    custom_fields: [],
    accept_orders_outside_zone: false
  },
  menu: { categories: [], items: [], modifier_groups: [] },
  alert_settings: { failed_push_alert: false, sound: 'default', supervisor_phone: '' },
  social_links: {
    facebook_url: '', smart_menu_link: 'https://menu.your-restaurant.com',
    website_enabled: false, website_domain: '', ios_app_enabled: false, android_app_enabled: false
  },
  device_connections: []
};

var DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
var DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
var CUISINE_OPTIONS = [
  { id: 'italian', icon: '🍝', label: 'Italian' },
  { id: 'french', icon: '🥐', label: 'French' },
  { id: 'japanese', icon: '🍣', label: 'Japanese' },
  { id: 'chinese', icon: '🥡', label: 'Chinese' },
  { id: 'indian', icon: '🍛', label: 'Indian' },
  { id: 'mexican', icon: '🌮', label: 'Mexican' },
  { id: 'thai', icon: '🍜', label: 'Thai' },
  { id: 'turkish', icon: '🥙', label: 'Turkish' },
  { id: 'mediterranean', icon: '🫒', label: 'Mediterranean' },
  { id: 'american', icon: '🍔', label: 'American' },
  { id: 'fast_food', icon: '🍟', label: 'Fast Food' },
  { id: 'cafe', icon: '☕', label: 'Café' },
  { id: 'bakery', icon: '🥖', label: 'Bakery' },
  { id: 'seafood', icon: '🦞', label: 'Seafood' },
  { id: 'steakhouse', icon: '🥩', label: 'Steakhouse' },
  { id: 'vegan', icon: '🥬', label: 'Vegan / Vegetarian' },
  { id: 'fusion', icon: '🔀', label: 'Fusion' },
  { id: 'middle_eastern', icon: '🧆', label: 'Middle Eastern' },
  { id: 'korean', icon: '🇰🇷', label: 'Korean' },
  { id: 'latin_american', icon: '🌯', label: 'Latin American' }
];

var COUNTRIES = [
  { code: 'US', name: 'United States' }, { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' }, { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' }, { code: 'PT', name: 'Portugal' },
  { code: 'NL', name: 'Netherlands' }, { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' }, { code: 'AT', name: 'Austria' },
  { code: 'SE', name: 'Sweden' }, { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' }, { code: 'FI', name: 'Finland' },
  { code: 'IE', name: 'Ireland' }, { code: 'PL', name: 'Poland' },
  { code: 'GR', name: 'Greece' }, { code: 'TR', name: 'Turkey' },
  { code: 'AE', name: 'United Arab Emirates' }, { code: 'SA', name: 'Saudi Arabia' },
  { code: 'QA', name: 'Qatar' }, { code: 'KW', name: 'Kuwait' },
  { code: 'JP', name: 'Japan' }, { code: 'KR', name: 'South Korea' },
  { code: 'CN', name: 'China' }, { code: 'IN', name: 'India' },
  { code: 'SG', name: 'Singapore' }, { code: 'MY', name: 'Malaysia' },
  { code: 'TH', name: 'Thailand' }, { code: 'VN', name: 'Vietnam' },
  { code: 'ID', name: 'Indonesia' }, { code: 'PH', name: 'Philippines' },
  { code: 'AU', name: 'Australia' }, { code: 'NZ', name: 'New Zealand' },
  { code: 'BR', name: 'Brazil' }, { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' }, { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' }, { code: 'ZA', name: 'South Africa' },
  { code: 'EG', name: 'Egypt' }, { code: 'NG', name: 'Nigeria' },
  { code: 'KE', name: 'Kenya' }, { code: 'MA', name: 'Morocco' }
];

var US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'District of Columbia' }
];

var CA_PROVINCES = [
  { code: 'AB', name: 'Alberta' }, { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' }, { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' }, { code: 'NS', name: 'Nova Scotia' },
  { code: 'ON', name: 'Ontario' }, { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' }, { code: 'SK', name: 'Saskatchewan' },
  { code: 'NT', name: 'Northwest Territories' }, { code: 'NU', name: 'Nunavut' },
  { code: 'YT', name: 'Yukon' }
];

var GDPR_COUNTRIES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','GB','IS','LI','NO'];

var TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (UTC-5/-4)' },
  { value: 'America/Chicago', label: 'Central (UTC-6/-5)' },
  { value: 'America/Denver', label: 'Mountain (UTC-7/-6)' },
  { value: 'America/Los_Angeles', label: 'Pacific (UTC-8/-7)' },
  { value: 'America/Anchorage', label: 'Alaska (UTC-9/-8)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (UTC-10)' },
  { value: 'America/Toronto', label: 'Eastern Canada (UTC-5/-4)' },
  { value: 'America/Vancouver', label: 'Pacific Canada (UTC-8/-7)' },
  { value: 'Europe/London', label: 'London (UTC+0/+1)' },
  { value: 'Europe/Paris', label: 'Paris (UTC+1/+2)' },
  { value: 'Europe/Berlin', label: 'Berlin (UTC+1/+2)' },
  { value: 'Europe/Istanbul', label: 'Istanbul (UTC+3)' },
  { value: 'Europe/Moscow', label: 'Moscow (UTC+3)' },
  { value: 'Asia/Dubai', label: 'Dubai (UTC+4)' },
  { value: 'Asia/Riyadh', label: 'Riyadh (UTC+3)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (UTC+8)' },
  { value: 'Asia/Singapore', label: 'Singapore (UTC+8)' },
  { value: 'Asia/Kolkata', label: 'Mumbai (UTC+5:30)' },
  { value: 'Australia/Sydney', label: 'Sydney (UTC+10/+11)' },
  { value: 'Pacific/Auckland', label: 'Auckland (UTC+12/+13)' }
];

var ALLERGENS = ['Gluten', 'Dairy', 'Nuts', 'Soy', 'Eggs', 'Shellfish', 'Sulfites', 'Sesame', 'Mustard', 'Celery'];
var DIETARY_MARKS = ['Hot', 'Vegan', 'Vegetarian', 'Gluten Free', 'Halal', 'Dairy Free', 'Raw', 'Nut Free'];
var TAGS = ['Popular', 'New', 'Chef Special', 'Spicy', 'Bestseller', 'Limited', 'Seasonal'];
var SPICE_NAMES = ['Not Spicy', 'Mild', 'Medium', 'Hot', 'Very Hot', 'Extra Hot'];
var NUTRITION_NUTRIENTS = [
  { name: 'Total Calories', unit: 'kcal' },
  { name: 'Carbohydrate', unit: 'g' },
  { name: 'Total Fat', unit: 'g' },
  { name: 'Protein', unit: 'g' },
  { name: 'Sugar', unit: 'g' },
  { name: 'Salt', unit: 'g' },
  { name: 'Saturated Fat', unit: 'g' },
  { name: 'Fiber', unit: 'g' },
  { name: 'Sodium', unit: 'mg' }
];

var data = {};
var activeTab = 'general';
var editingDayIndex = -1;
var selectedCategoryId = null;
var editingCategoryId = null;
var editingItemId = null;
var editingModGroupId = null;
var _expandedModGroups = {}; /* Track which groups are expanded */
var _tempPhotos = []; /* URLs of photos uploaded for a new item before it is saved */
var _tempCatPhotos = []; /* URLs of photos uploaded for a new category before it is saved */
var _tempMgPhoto = null; /* URL of photo uploaded for a modifier group being edited */
var _tempOptPhoto = null; /* URL of photo uploaded for a modifier option being edited */
var _newItemDraft = null; /* In-memory draft for new item so pickers work before save */
var _drawerOpen = false; /* Guard to prevent accidental drawer closes */
var highlightedModGroupId = null; /* Track which modifier group is highlighted in right panel */
var _modFilterIds = []; /* Modifier group IDs used to filter the product list */

/* ---- Delivery Zones State ---- */
var zoneMap = null;
var zoneDrawnItems = null;
var zoneActiveTool = null;
var zoneEditingIndex = -1;
var zoneDrawControl = null;

/* ===== UTILITIES ===== */
function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function slugify(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function deepMerge(target, source) {
  var output = JSON.parse(JSON.stringify(target));
  for (var key in source) {
    if (source.hasOwnProperty(key)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        output[key] = deepMerge(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    }
  }
  return output;
}

function getNested(obj, path) {
  return path.split('.').reduce(function(o, k) { return o && o[k] !== undefined ? o[k] : undefined; }, obj);
}

function setNested(obj, path, value) {
  var keys = path.split('.');
  var last = keys.pop();
  var target = keys.reduce(function(o, k) {
    if (!o[k] || typeof o[k] !== 'object') o[k] = {};
    return o[k];
  }, obj);
  target[last] = value;
}

/* ===== SAVE ===== */
var saveTimeout = null;
function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(function() {
    tool.setValue(JSON.parse(JSON.stringify(data)));
  }, 500);
}

  /* Save All */
  var saveAllBtn = document.getElementById('save-all-btn');
  if (saveAllBtn) saveAllBtn.remove(); /* Remove legacy button */

function switchTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll('.main-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
  var tabBtn = document.querySelector('.main-tab[data-tab="' + tabName + '"]');
  var panel = document.querySelector('.tab-panel[data-tab="' + tabName + '"]');
  if (tabBtn) tabBtn.classList.add('active');
  if (panel) panel.classList.add('active');

  /* Invalidate map size when switching to delivery tab */
  if (tabName === 'delivery' && zoneMap) {
    setTimeout(function() { zoneMap.invalidateSize(); }, 100);
  }
  tool.resize();
}

function switchSubTab(parentTab, subTabName) {
  var panel = document.querySelector('.tab-panel[data-tab="' + parentTab + '"]');
  if (!panel) return;
  /* Update sub-tab buttons */
  panel.querySelectorAll('.sub-tab').forEach(function(st) { st.classList.remove('active'); });
  var activeBtn = panel.querySelector('.sub-tab[data-subtab="' + subTabName + '"]');
  if (activeBtn) activeBtn.classList.add('active');
  /* Show/hide sub-tab panels */
  panel.querySelectorAll('.subtab-panel').forEach(function(sp) { sp.classList.remove('active'); });
  var activePanel = panel.querySelector('.subtab-panel[data-subtab="' + subTabName + '"]');
  if (activePanel) activePanel.classList.add('active');

  /* Invalidate map when switching to zones sub-tab */
  if (subTabName === 'delivery-zones' && zoneMap) {
    setTimeout(function() { zoneMap.invalidateSize(); }, 100);
  }
  tool.resize();
}

/* ===== READ-ONLY ===== */
function lockUI(ro) {
  var els = document.querySelectorAll('input, select, textarea, button, .switch');
  els.forEach(function(el) {
    if (ro) { el.setAttribute('disabled', 'disabled'); el.style.pointerEvents = 'none'; }
    else { el.removeAttribute('disabled'); el.style.pointerEvents = ''; }
  });
}

/* ===== CONDITIONAL DISPLAYS (ALL TABS) ===== */
function handleConditionalDisplays() {
  /* Services: anonymous ordering sub-toggle */
  var onPrem = document.getElementById('svc-onpremise');
  var anonRow = document.getElementById('svc-anon-row');
  if (onPrem && anonRow) anonRow.style.display = onPrem.checked ? '' : 'none';

  /* Services: reservation card */
  var resToggle = document.getElementById('svc-reservation');
  var resCard = document.getElementById('svc-reservation-card');
  if (resToggle && resCard) resCard.style.display = resToggle.checked ? '' : 'none';

  /* Services: scheduled orders */
  var schedToggle = document.getElementById('svc-sched-enabled');
  var schedCond = document.getElementById('svc-sched-conditional');
  if (schedToggle && schedCond) schedCond.style.display = schedToggle.checked ? '' : 'none';

  /* Services: deposit amount */
  var depToggle = document.getElementById('svc-res-deposit');
  var depRow = document.getElementById('svc-res-deposit-row');
  if (depToggle && depRow) depRow.style.display = depToggle.checked ? '' : 'none';

  /* Services: on-premise dining card */
  var onPremToggle = document.getElementById('svc-onpremise');
  var onPremCard = document.getElementById('svc-onpremise-card');
  if (onPremToggle && onPremCard) onPremCard.style.display = onPremToggle.checked ? '' : 'none';

  /* Social: website domain */
  var webToggle = document.getElementById('soc-website');
  var webRow = document.getElementById('soc-domain-row');
  if (webToggle && webRow) webRow.style.display = webToggle.checked ? '' : 'none';

  /* Delivery tab: only visible when delivery is enabled */
  var delivToggle = document.getElementById('svc-delivery');
  var deliveryTab = document.querySelector('.main-tab[data-tab="delivery"]');
  if (delivToggle && deliveryTab) {
    var showDelivery = delivToggle.checked;
    deliveryTab.style.display = showDelivery ? '' : 'none';
    /* If delivery tab was active and is now hidden, switch to general */
    if (!showDelivery && activeTab === 'delivery') {
      switchTab('general');
    }
  }
}

/* ===================================================================== */
/* GENERAL INFO SECTION */
/* ===================================================================== */
function renderGeneralInfo() {
  /* Populate all data-path inputs */
  document.querySelectorAll('[data-path]').forEach(function(el) {
    if (el.closest('.tab-panel[data-tab="menu"]')) return; /* Skip menu */
    if (el.closest('.tab-panel[data-tab="delivery"]')) return; /* Skip delivery */
    var val = getNested(data, el.dataset.path);
    if (val === undefined) return;
    if (el.type === 'checkbox') {
      el.checked = !!val;
    } else if (el.type === 'radio') {
      el.checked = (el.value === String(val));
    } else if (el.tagName === 'SELECT') {
      el.value = val;
    } else {
      el.value = val;
    }
  });

  /* Logo preview */
  renderLogoPreview();
  /* Cuisine grid */
  renderCuisineGrid();
  /* Country / State dropdowns */
  renderCountryDropdown();
  renderStateDropdown();
  /* Legal conditional fields */
  renderLegalFields();
  /* Timezone */
  renderTimezoneDropdown();
  /* Additional phones */
  renderAdditionalPhones();
  /* Hours */
  renderOpeningHours();
  /* Tax categories */
  renderTaxCategories();
  /* Devices */
  renderDevices();
  /* Conditional displays */
  handleConditionalDisplays();
}

function renderLogoPreview() {
  var preview = document.getElementById('gen-logo-preview');
  if (!preview) return;
  var url = getNested(data, 'general_info.logo_url');
  if (url) {
    preview.innerHTML = '<img src="' + esc(url) + '" alt="Logo">';
  } else {
    preview.innerHTML = '🖼️';
  }
}

/* ---- Country / State / Timezone ---- */
function renderCountryDropdown() {
  var sel = document.getElementById('gen-address-country');
  if (!sel) return;
  var current = getNested(data, 'general_info.address.country') || '';
  sel.innerHTML = '<option value="">Select country...</option>';
  COUNTRIES.forEach(function(c) {
    sel.innerHTML += '<option value="' + c.code + '"' + (current === c.code ? ' selected' : '') + '>' + c.name + '</option>';
  });
  /* If current value is not in the list, add it as-is */
  if (current && !COUNTRIES.some(function(c) { return c.code === current; })) {
    sel.innerHTML += '<option value="' + current + '" selected>' + current + '</option>';
  }
}

function renderStateDropdown() {
  var container = document.getElementById('gen-address-state-container');
  if (!container) return;
  var country = getNested(data, 'general_info.address.country') || '';
  var current = getNested(data, 'general_info.address.state') || '';
  container.innerHTML = '';

  if (country === 'US' || country === 'CA') {
    var sel = document.createElement('select');
    sel.className = 'form-input';
    sel.id = 'gen-address-state';
    sel.setAttribute('data-path', 'general_info.address.state');
    var defaultLabel = country === 'US' ? 'Select state...' : 'Select province...';
    var options = country === 'US' ? US_STATES : CA_PROVINCES;
    sel.innerHTML = '<option value="">' + defaultLabel + '</option>';
    options.forEach(function(s) {
      sel.innerHTML += '<option value="' + s.code + '"' + (current === s.code ? ' selected' : '') + '>' + s.name + '</option>';
    });
    sel.addEventListener('change', function() {
      setNested(data, 'general_info.address.state', this.value);
      scheduleSave();
    });
    container.appendChild(sel);
  } else {
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-input';
    input.id = 'gen-address-state';
    input.setAttribute('data-path', 'general_info.address.state');
    input.placeholder = 'State / Province';
    input.value = current || '';
    input.addEventListener('input', function() {
      setNested(data, 'general_info.address.state', this.value);
      scheduleSave();
    });
    container.appendChild(input);
  }
}

/* ---- Legal conditional fields ---- */
function renderLegalFields() {
  var country = getNested(data, 'general_info.address.country') || '';
  var isGDPR = GDPR_COUNTRIES.indexOf(country) !== -1;
  var hint = document.getElementById('gen-legal-jurisdiction-hint');

  if (isGDPR && hint) {
    hint.textContent = '⚠️ GDPR jurisdiction — DPO recommended';
  } else if (hint) {
    hint.textContent = '';
  }

  /* Auto-expand advanced section if fields have data */
  var regNum = getNested(data, 'general_info.legal.registration_number') || '';
  var dpo = getNested(data, 'general_info.legal.dpo_name') || '';
  var panel = document.getElementById('gen-legal-advanced');
  var btn = document.getElementById('gen-legal-advanced-btn');
  if (panel && btn) {
    if (regNum || dpo || isGDPR) {
      panel.style.display = '';
      btn.classList.add('open');
    }
  }
}

function toggleLegalAdvanced() {
  var panel = document.getElementById('gen-legal-advanced');
  var btn = document.getElementById('gen-legal-advanced-btn');
  if (!panel || !btn) return;
  var isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : '';
  btn.classList.toggle('open', !isOpen);
  tool.resize();
}

function renderTimezoneDropdown() {
  var sel = document.getElementById('gen-timezone');
  if (!sel) return;
  var current = getNested(data, 'general_info.timezone') || '';
  sel.innerHTML = '<option value="">Select time zone...</option>';
  TIMEZONES.forEach(function(tz) {
    sel.innerHTML += '<option value="' + tz.value + '"' + (current === tz.value ? ' selected' : '') + '>' + tz.label + '</option>';
  });
}

/* ---- Additional Phones ---- */
function renderAdditionalPhones() {
  var container = document.getElementById('gen-additional-phones');
  if (!container) return;
  var phones = getNested(data, 'general_info.additional_phones') || [];
  container.innerHTML = '';
  phones.forEach(function(phone, i) {
    var row = document.createElement('div');
    row.className = 'phone-extra-row';
    var inp = document.createElement('input');
    inp.type = 'tel';
    inp.className = 'form-input';
    inp.placeholder = '+1 (555) 000-0000';
    inp.value = phone;
    inp.addEventListener('input', (function(idx) { return function() {
      data.general_info.additional_phones[idx] = this.value;
      scheduleSave();
    }; })(i));
    var rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.className = 'btn btn-sm btn-ghost';
    rmBtn.textContent = '✕';
    rmBtn.title = 'Remove';
    rmBtn.addEventListener('click', (function(idx) { return function() {
      data.general_info.additional_phones.splice(idx, 1);
      renderAdditionalPhones();
      scheduleSave();
    }; })(i));
    row.appendChild(inp);
    row.appendChild(rmBtn);
    container.appendChild(row);
  });
}

function addExtraPhone() {
  if (!data.general_info.additional_phones) data.general_info.additional_phones = [];
  data.general_info.additional_phones.push('');
  renderAdditionalPhones();
  scheduleSave();
  /* Focus the new input */
  setTimeout(function() {
    var rows = document.querySelectorAll('#gen-additional-phones .phone-extra-row input');
    if (rows.length > 0) rows[rows.length - 1].focus();
  }, 100);
}

function renderCuisineGrid() {
  var grid = document.getElementById('gen-cuisine-grid');
  if (!grid) return;
  grid.innerHTML = '';

  var selected = getNested(data, 'general_info.cuisine_types') || [];

  CUISINE_OPTIONS.forEach(function(opt) {
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'cuisine-chip' + (selected.indexOf(opt.id) !== -1 ? ' selected' : '');
    chip.dataset.cuisineId = opt.id;
    chip.innerHTML = '<span class="chip-icon">' + opt.icon + '</span>' + opt.label + '<span class="chip-check">✓</span>';
    chip.addEventListener('click', function() {
      toggleCuisine(opt.id);
    });
    grid.appendChild(chip);
  });

  /* Also render any custom cuisines not in the predefined list */
  selected.forEach(function(id) {
    var isPredefined = CUISINE_OPTIONS.some(function(o) { return o.id === id; });
    if (!isPredefined) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'cuisine-chip selected';
      chip.dataset.cuisineId = id;
      chip.innerHTML = '<span class="chip-icon">🍽️</span>' + esc(id) + '<span class="chip-check">✓</span>';
      chip.addEventListener('click', function() {
        toggleCuisine(id);
      });
      grid.appendChild(chip);
    }
  });
}

function toggleCuisine(cuisineId) {
  var types = getNested(data, 'general_info.cuisine_types') || [];
  var idx = types.indexOf(cuisineId);
  if (idx === -1) {
    types.push(cuisineId);
  } else {
    types.splice(idx, 1);
  }
  setNested(data, 'general_info.cuisine_types', types);
  renderCuisineGrid();
  scheduleSave();
}

function addCustomCuisine() {
  var input = document.getElementById('gen-cuisine-custom');
  var name = (input.value || '').trim();
  if (!name) { tool.notify('Enter a cuisine name', 'warning'); return; }
  var id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  var types = getNested(data, 'general_info.cuisine_types') || [];
  if (types.indexOf(id) === -1) {
    types.push(id);
    setNested(data, 'general_info.cuisine_types', types);
    input.value = '';
    renderCuisineGrid();
    scheduleSave();
    tool.notify('Cuisine "' + name + '" added', 'success');
  } else {
    tool.notify('This cuisine is already selected', 'info');
  }
}

/* ===================================================================== */
/* SERVICE SETTINGS: OPENING HOURS — table with inline editing */
/* ===================================================================== */
function renderOpeningHours() {
  var wrap = document.getElementById('svc-hours-table');
  if (!wrap) return;
  var hours = getNested(data, 'service_settings.opening_hours') || DEFAULTS.service_settings.opening_hours;
  var html = '';

  hours.forEach(function(dayData, idx) {
    var isEditing = (editingDayIndex === idx);
    var isClosed = dayData.is_closed;
    var dayName = DAY_NAMES_FULL[idx];

    /* Row */
    html += '<div class="hours-row' + (isClosed ? ' closed-row' : '') + (isEditing ? ' editing' : '') + '" data-day="' + idx + '">';
    html += '<div class="hours-row-day">' + dayName + '</div>';
    html += '<div class="hours-row-status"><span class="hours-status-badge ' + (isClosed ? 'closed' : 'open') + '"><span class="hours-status-dot"></span>' + (isClosed ? 'Closed' : 'Open') + '</span></div>';
    html += '<div class="hours-row-times">';
    if (isClosed) {
      html += '—';
    } else if (dayData.ranges && dayData.ranges.length > 0) {
      dayData.ranges.forEach(function(r) {
        html += '<span class="time-pill">' + (r.open || '--:--') + ' – ' + (r.close || '--:--') + '</span>';
      });
    } else {
      html += '<span class="time-pill">No hours set</span>';
    }
    html += '</div>';
    html += '<div class="hours-row-edit">' + (isEditing ? '▲' : '✎') + '</div>';
    html += '</div>';

    /* Inline editor */
    if (isEditing) {
      html += '<div class="hours-editor">';
      /* Closed toggle */
      html += '<div class="hours-editor-closed"><label><input type="checkbox" id="svc-hours-closed-' + idx + '" ' + (isClosed ? 'checked' : '') + '> Closed all day</label></div>';
      /* Ranges */
      html += '<div class="hours-editor-ranges" id="svc-hours-ranges-' + idx + '">';
      var ranges = (dayData.ranges && dayData.ranges.length > 0) ? dayData.ranges : [{ open: '09:00', close: '17:00' }];
      ranges.forEach(function(r, ri) {
        html += '<div class="hours-editor-range">';
        html += '<input type="time" value="' + (r.open || '09:00') + '" data-range-idx="' + ri + '" data-field="open">';
        html += '<span>to</span>';
        html += '<input type="time" value="' + (r.close || '17:00') + '" data-range-idx="' + ri + '" data-field="close">';
        html += '<button type="button" class="btn btn-ghost btn-sm hours-remove-range" data-idx="' + ri + '">✕</button>';
        html += '</div>';
      });
      html += '</div>';
      /* Actions */
      html += '<div class="hours-editor-actions">';
      html += '<button type="button" class="btn btn-sm btn-outline hours-add-range" data-day="' + idx + '">+ Add Time Range</button>';
      html += '<button type="button" class="btn btn-sm btn-primary hours-save-day" data-day="' + idx + '">Save</button>';
      html += '<button type="button" class="btn btn-sm btn-ghost hours-cancel-day" data-day="' + idx + '">Cancel</button>';
      html += '</div>';
      html += '</div>';
    }
  });

  wrap.innerHTML = html;

  /* Attach click handlers for rows (open editor) */
  wrap.querySelectorAll('.hours-row').forEach(function(row) {
    row.addEventListener('click', function(e) {
      if (e.target.closest('button') || e.target.closest('input')) return;
      var dayIdx = parseInt(row.dataset.day);
      if (editingDayIndex === dayIdx) {
        editingDayIndex = -1; /* Collapse */
      } else {
        editingDayIndex = dayIdx;
      }
      renderOpeningHours();
      tool.resize();
    });
  });

  /* Attach handlers for inline editor elements */
  wrap.querySelectorAll('.hours-add-range').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var dayIdx = parseInt(btn.dataset.day);
      var container = document.getElementById('svc-hours-ranges-' + dayIdx);
      if (!container) return;
      var div = document.createElement('div');
      div.className = 'hours-editor-range';
      var ri = container.querySelectorAll('.hours-editor-range').length;
      div.innerHTML = '<input type="time" value="09:00" data-range-idx="' + ri + '" data-field="open"> <span>to</span> <input type="time" value="17:00" data-range-idx="' + ri + '" data-field="close"> <button type="button" class="btn btn-ghost btn-sm hours-remove-range" data-idx="' + ri + '">✕</button>';
      container.appendChild(div);
      div.querySelector('.hours-remove-range').addEventListener('click', function() { div.remove(); tool.resize(); });
      tool.resize();
    });
  });

  wrap.querySelectorAll('.hours-remove-range').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var rangeRow = btn.closest('.hours-editor-range');
      var container = btn.closest('.hours-editor-ranges');
      if (container && container.querySelectorAll('.hours-editor-range').length <= 1) return;
      if (rangeRow) rangeRow.remove();
      tool.resize();
    });
  });

  wrap.querySelectorAll('.hours-save-day').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var dayIdx = parseInt(btn.dataset.day);
      saveDayHours(dayIdx);
    });
  });

  wrap.querySelectorAll('.hours-cancel-day').forEach(function(btn) {
    btn.addEventListener('click', function() {
      editingDayIndex = -1;
      renderOpeningHours();
      tool.resize();
    });
  });
}

function saveDayHours(dayIdx) {
  var hours = getNested(data, 'service_settings.opening_hours');
  var dayData = hours[dayIdx];

  var closedCheck = document.getElementById('svc-hours-closed-' + dayIdx);
  dayData.is_closed = closedCheck ? closedCheck.checked : false;

  var rangesContainer = document.getElementById('svc-hours-ranges-' + dayIdx);
  var ranges = [];
  if (rangesContainer) {
    rangesContainer.querySelectorAll('.hours-editor-range').forEach(function(rangeEl) {
      var inputs = rangeEl.querySelectorAll('input[type="time"]');
      if (inputs.length >= 2) {
        ranges.push({ open: inputs[0].value, close: inputs[1].value });
      }
    });
  }
  dayData.ranges = ranges.length > 0 ? ranges : [{ open: '09:00', close: '17:00' }];

  editingDayIndex = -1;
  renderOpeningHours();
  scheduleSave();
  tool.resize();
}

/* ===================================================================== */
/* TAX CATEGORIES */
/* ===================================================================== */
function renderTaxCategories() {
  var tbody = document.getElementById('tax-cat-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  var categories = getNested(data, 'taxation_currency.tax_categories') || [];
  if (categories.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No tax categories defined</td></tr>';
    return;
  }

  categories.forEach(function(cat, idx) {
    var tr = document.createElement('tr');

    /* Name */
    var nameTd = document.createElement('td');
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = cat.name || '';
    nameInput.style.width = '100%';
    nameInput.addEventListener('input', (function(i) { return function() {
      data.taxation_currency.tax_categories[i].name = this.value;
      scheduleSave();
    }; })(idx));
    nameTd.appendChild(nameInput);
    tr.appendChild(nameTd);

    /* Rates */
    ['pickup', 'delivery', 'in_restaurant'].forEach(function(rateType) {
      var td = document.createElement('td');
      var inp = document.createElement('input');
      inp.type = 'number';
      inp.min = '0'; inp.max = '100'; inp.step = '0.01';
      inp.value = cat[rateType] !== undefined ? cat[rateType] : 0;
      inp.addEventListener('input', (function(i, rt) { return function() {
        data.taxation_currency.tax_categories[i][rt] = parseFloat(this.value) || 0;
        scheduleSave();
      }; })(idx, rateType));
      td.appendChild(inp);
      tr.appendChild(td);
    });

    /* Zero all */
    var zeroTd = document.createElement('td');
    var zeroCheck = document.createElement('input');
    zeroCheck.type = 'checkbox';
    zeroCheck.checked = (cat.pickup === 0 && cat.delivery === 0 && cat.in_restaurant === 0);
    zeroCheck.addEventListener('change', (function(i) { return function() {
      if (this.checked) {
        data.taxation_currency.tax_categories[i].pickup = 0;
        data.taxation_currency.tax_categories[i].delivery = 0;
        data.taxation_currency.tax_categories[i].in_restaurant = 0;
      }
      renderTaxCategories();
      scheduleSave();
    }; })(idx));
    zeroCheck.style.width = 'auto';
    zeroTd.appendChild(zeroCheck);
    tr.appendChild(zeroTd);

    /* Delete */
    var delTd = document.createElement('td');
    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-ghost btn-sm';
    delBtn.style.color = '#ef4444';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', (function(i) { return function() {
      data.taxation_currency.tax_categories.splice(i, 1);
      renderTaxCategories();
      scheduleSave();
    }; })(idx));
    delTd.appendChild(delBtn);
    tr.appendChild(delTd);

    tbody.appendChild(tr);
  });
}

function addTaxCategory() {
  if (!data.taxation_currency.tax_categories) data.taxation_currency.tax_categories = [];
  data.taxation_currency.tax_categories.push({ name: '', pickup: 0, delivery: 0, in_restaurant: 0 });
  renderTaxCategories();
  scheduleSave();
  tool.resize();
}

/* Populate a <select> element with tax category options */
function populateTaxCategorySelect(selectId, selectedId) {
  var sel = document.getElementById(selectId);
  if (!sel) return;
  var cats = data.taxation_currency.tax_categories || [];
  sel.innerHTML = '<option value="">-- None (default tax) --</option>';
  cats.forEach(function(cat) {
    sel.innerHTML += '<option value="' + (cat.name || '') + '"' + (selectedId === cat.name ? ' selected' : '') + '>' + esc(cat.name || '(unnamed)') + '</option>';
  });
}

/* ===================================================================== */
/* DEVICES */
/* ===================================================================== */
function renderDevices() {
  var tbody = document.getElementById('dev-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  var devices = data.device_connections || [];
  if (devices.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No devices connected yet</td></tr>';
    return;
  }

  devices.forEach(function(dev, idx) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + esc(dev.platform || '-') + '</td>' +
      '<td>' + esc(dev.os || '-') + '</td>' +
      '<td><code style="font-size:11px;">' + esc(dev.device_id || '-') + '</code></td>' +
      '<td>' + esc(dev.app_version || '-') + '</td>' +
      '<td>' + esc(dev.last_check || '-') + '</td>' +
      '<td><button type="button" class="btn btn-ghost btn-sm" data-remove-device="' + idx + '" style="color:#ef4444;">✕</button></td>';
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-remove-device]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var idx = parseInt(btn.dataset.removeDevice);
      data.device_connections.splice(idx, 1);
      renderDevices();
      scheduleSave();
    });
  });
}

function connectDevice() {
  var platform = document.getElementById('dev-new-platform').value;
  var deviceId = document.getElementById('dev-new-id').value.trim();
  if (!deviceId) { tool.notify('Please enter a device ID', 'warning'); return; }
  if (!data.device_connections) data.device_connections = [];
  data.device_connections.push({
    platform: platform, os: 'N/A', device_id: deviceId,
    app_version: 'N/A', last_check: 'Just now'
  });
  document.getElementById('dev-new-id').value = '';
  document.getElementById('dev-connect-panel').style.display = 'none';
  renderDevices();
  scheduleSave();
  tool.notify('Device connected', 'success');
}

/* ===================================================================== */
/* DELIVERY ZONES */
/* ===================================================================== */
function renderZonesList() {
  var container = document.getElementById('zones-list');
  if (!container) return;
  container.innerHTML = '';

  var zones = data.delivery_zones.zones || [];
  if (zones.length === 0) {
    container.innerHTML = '<div class="empty-state">No zones defined yet.<br>Click <strong>+ Add Zone</strong> to create one.</div>';
    return;
  }

  zones.forEach(function(zone, idx) {
    var card = document.createElement('div');
    card.className = 'zone-card' + (zoneEditingIndex === idx ? ' selected' : '');
    card.dataset.zoneIndex = idx;

    var swatch = document.createElement('div');
    swatch.className = 'zone-card-color';
    swatch.style.backgroundColor = zone.color || '#4f46e5';

    var info = document.createElement('div');
    info.className = 'zone-card-info';
    var shapeCount = (zone.shapes && zone.shapes.length) ? zone.shapes.length : 0;
    var shapeLabel = shapeCount === 1 ? '1 shape' : shapeCount + ' shapes';
    info.innerHTML =
      '<div class="zone-card-name">' + esc(zone.name || 'Zone ' + (idx + 1)) + '</div>' +
      '<div class="zone-card-meta">' + shapeLabel + ' &middot; Min: $' + (zone.min_order || 0) + ' &middot; Fee: $' + (zone.fee || 0) + '</div>';

    var actions = document.createElement('div');
    actions.className = 'zone-card-actions';
    actions.innerHTML =
      '<button title="Edit" class="edit-btn">✎</button>' +
      '<button title="Zoom to" class="zoom-btn">⊕</button>';

    actions.querySelector('.edit-btn').addEventListener('click', function(e) { e.stopPropagation(); editZone(idx); });
    actions.querySelector('.zoom-btn').addEventListener('click', function(e) { e.stopPropagation(); zoomToZone(idx); });
    card.addEventListener('click', function() { selectZone(idx); });

    card.appendChild(swatch);
    card.appendChild(info);
    card.appendChild(actions);
    container.appendChild(card);
  });
}

function zoomToZone(idx) {
  if (!zoneMap) return;
  var zones = data.delivery_zones.zones || [];
  if (idx < 0 || idx >= zones.length) return;
  var layers = findLayersByZoneIndex(idx);
  if (layers.length === 0) return;
  var group = new L.FeatureGroup(layers);
  zoneMap.fitBounds(group.getBounds(), { padding: [30, 30] });
}

function selectZone(idx) {
  zoneEditingIndex = idx;
  highlightZone(idx);
  renderZonesList();
}

function highlightZone(idx) {
  if (!zoneMap || !zoneDrawnItems) return;
  var zones = data.delivery_zones.zones || [];
  zoneDrawnItems.eachLayer(function(layer) {
    var zi = layer._zoneIndex;
    if (zi !== undefined && zi >= 0 && zi < zones.length) {
      var color = zones[zi].color || '#4f46e5';
      layer.setStyle({
        color: color, fillColor: color,
        fillOpacity: zi === idx ? 0.35 : 0.15,
        weight: zi === idx ? 3 : 2,
        opacity: zi === idx ? 1 : 0.7
      });
    }
  });
}

function findLayersByZoneIndex(idx) {
  var result = [];
  if (!zoneDrawnItems) return result;
  zoneDrawnItems.eachLayer(function(layer) {
    if (layer._zoneIndex === idx) result.push(layer);
  });
  return result;
}

function editZone(idx) {
  zoneEditingIndex = idx;
  var zones = data.delivery_zones.zones || [];
  var zone = zones[idx];
  if (!zone) return;

  document.getElementById('zone-form-title').textContent = 'Edit Delivery Zone';
  document.getElementById('zone-name').value = zone.name || '';
  document.getElementById('zone-color').value = zone.color || '#4f46e5';
  var swatch = document.getElementById('zone-color-swatch');
  var hexEl = document.getElementById('zone-color-hex');
  if (swatch) swatch.style.background = zone.color || '#4f46e5';
  if (hexEl) hexEl.textContent = zone.color || '#4f46e5';
  document.getElementById('zone-min-order').value = zone.min_order || 0;
  document.getElementById('zone-fee').value = zone.fee || 0;
  document.getElementById('zone-form').style.display = '';

  /* Show delete button */
  var deleteFormBtn = document.getElementById('zone-delete-form-btn');
  if (deleteFormBtn) deleteFormBtn.style.display = '';

  /* Show shapes section and render */
  document.getElementById('zone-shapes-section').style.display = '';
  renderZoneShapesList();

  /* Remove any orphan drawings */
  removeOrphanDrawings();

  /* Activate polygon tool for adding more shapes */
  document.querySelectorAll('.zone-draw-btn').forEach(function(b) { b.classList.remove('active'); });
  var polyBtn = document.querySelector('.zone-draw-btn[data-shape="polygon"]');
  if (polyBtn) polyBtn.classList.add('active');

  highlightZone(idx);
  zoomToZone(idx);
  renderZonesList();
  tool.resize();
}

function renderZoneShapesList() {
  var container = document.getElementById('zone-shapes-list');
  var countEl = document.getElementById('zone-shapes-count');
  if (!container) return;
  container.innerHTML = '';

  var zones = data.delivery_zones.zones || [];
  if (zoneEditingIndex < 0 || zoneEditingIndex >= zones.length) { container.innerHTML = ''; if (countEl) countEl.textContent = ''; return; }

  var shapes = zones[zoneEditingIndex].shapes || [];
  if (countEl) countEl.textContent = shapes.length > 0 ? '(' + shapes.length + ')' : '';

  if (shapes.length === 0) {
    container.innerHTML = '<div class="zone-shapes-empty">No shapes yet. Draw on the map and save.</div>';
    return;
  }

  var table = document.createElement('table');
  table.className = 'zone-shape-table';
  table.innerHTML =
    '<thead><tr><th class="shape-type-cell">Type</th><th class="shape-desc-cell">Shape</th><th class="shape-meta-cell">Details</th><th class="shape-action-cell"></th></tr></thead>';
  var tbody = document.createElement('tbody');

  shapes.forEach(function(shape, shapeIdx) {
    var tr = document.createElement('tr');

    /* Type cell with SVG icon */
    var tdType = document.createElement('td');
    tdType.className = 'shape-type-cell';
    var iconSpan = document.createElement('span');

    var shapeDesc = '';
    var metaText = '';

    if (shape.type === 'Polygon') {
      iconSpan.className = 'shape-icon polygon';
      iconSpan.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="8,1 15,5 13,12 3,12 1,5"/></svg>';
      var coords = (shape.coordinates && shape.coordinates[0]) ? shape.coordinates[0] : [];
      shapeDesc = 'Polygon';
      metaText = coords.length + ' vertices';
    } else if (shape.type === 'Circle') {
      iconSpan.className = 'shape-icon circle';
      iconSpan.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/></svg>';
      var r = shape.radius || 0;
      shapeDesc = 'Circle';
      metaText = r >= 1000 ? (r / 1000).toFixed(1) + ' km radius' : Math.round(r) + ' m radius';
    } else {
      /* Rectangle or other */
      iconSpan.className = 'shape-icon rectangle';
      iconSpan.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="2.5" width="13" height="11" rx="1"/></svg>';
      var coords2 = (shape.coordinates && shape.coordinates[0]) ? shape.coordinates[0] : [];
      shapeDesc = shape.type === 'MultiPolygon' ? 'Multi-Poly' : (shape.type || 'Shape');
      metaText = coords2.length > 0 ? coords2.length + ' vertices' : '';
    }

    tdType.appendChild(iconSpan);

    /* Description cell */
    var tdDesc = document.createElement('td');
    tdDesc.className = 'shape-desc-cell';
    tdDesc.textContent = shapeDesc;

    /* Meta cell */
    var tdMeta = document.createElement('td');
    tdMeta.className = 'shape-meta-cell';
    tdMeta.textContent = metaText;

    /* Action cell */
    var tdAction = document.createElement('td');
    tdAction.className = 'shape-action-cell';
    var delBtn = document.createElement('button');
    delBtn.className = 'shape-delete-btn';
    delBtn.title = 'Remove this shape';
    delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z"/></svg>';
    delBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      confirmRemoveShape(zoneEditingIndex, shapeIdx, shapeDesc + ' · ' + metaText);
    });
    tdAction.appendChild(delBtn);

    tr.appendChild(tdType);
    tr.appendChild(tdDesc);
    tr.appendChild(tdMeta);
    tr.appendChild(tdAction);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

/* ---- Shape delete with confirmation ---- */
var shapeDeleteZoneIdx = -1;
var shapeDeleteShapeIdx = -1;

function confirmRemoveShape(zoneIdx, shapeIdx, desc) {
  shapeDeleteZoneIdx = zoneIdx;
  shapeDeleteShapeIdx = shapeIdx;
  document.getElementById('shape-delete-modal-desc').textContent = desc;
  document.getElementById('shape-delete-modal').style.display = 'flex';
}

function removeShapeConfirmed() {
  document.getElementById('shape-delete-modal').style.display = 'none';
  var zoneIdx = shapeDeleteZoneIdx;
  var shapeIdx = shapeDeleteShapeIdx;
  shapeDeleteZoneIdx = -1;
  shapeDeleteShapeIdx = -1;
  if (zoneIdx < 0 || shapeIdx < 0) return;

  var zones = data.delivery_zones.zones || [];
  if (zoneIdx >= zones.length) return;
  var zone = zones[zoneIdx];
  if (!zone.shapes || shapeIdx >= zone.shapes.length) return;

  /* Remove from data */
  zone.shapes.splice(shapeIdx, 1);

  /* Remove corresponding Leaflet layers (may be multiple for complex shapes) */
  if (zoneDrawnItems) {
    var toRemove = [];
    zoneDrawnItems.eachLayer(function(layer) {
      if (layer._zoneIndex === zoneIdx && layer._shapeIndex === shapeIdx) toRemove.push(layer);
    });
    toRemove.forEach(function(l) { zoneDrawnItems.removeLayer(l); });
  }

  /* Re-index remaining shape layers for this zone */
  reindexShapeLayers(zoneIdx);

  renderZoneShapesList();
  scheduleSave();
  tool.notify('Shape removed', 'info');
}

function cancelShapeDelete() {
  document.getElementById('shape-delete-modal').style.display = 'none';
  shapeDeleteZoneIdx = -1;
  shapeDeleteShapeIdx = -1;
}

function reindexShapeLayers(zoneIdx) {
  if (!zoneDrawnItems) return;
  var si = 0;
  zoneDrawnItems.eachLayer(function(layer) {
    if (layer._zoneIndex === zoneIdx) { layer._shapeIndex = si; si++; }
  });
}

function confirmDeleteZone() {
  var zones = data.delivery_zones.zones || [];
  if (zoneEditingIndex < 0 || zoneEditingIndex >= zones.length) return;
  var zoneName = zones[zoneEditingIndex].name || 'Zone ' + (zoneEditingIndex + 1);
  document.getElementById('zone-delete-modal-name').textContent = '"' + zoneName + '"';
  document.getElementById('zone-delete-modal').style.display = 'flex';
}

function deleteZoneConfirmed() {
  var idx = zoneEditingIndex;
  document.getElementById('zone-delete-modal').style.display = 'none';
  var zones = data.delivery_zones.zones || [];
  if (idx < 0 || idx >= zones.length) return;
  zones.splice(idx, 1);

  /* Remove ALL layers for this zone */
  if (zoneDrawnItems) {
    var toRemove = [];
    zoneDrawnItems.eachLayer(function(layer) { if (layer._zoneIndex === idx) toRemove.push(layer); });
    toRemove.forEach(function(layer) { zoneDrawnItems.removeLayer(layer); });
  }
  reindexZoneLayers();
  zoneEditingIndex = -1;
  clearZoneForm();
  renderZonesList();
  scheduleSave();
  tool.notify('Zone deleted', 'info');
}

function cancelZoneDelete() {
  document.getElementById('zone-delete-modal').style.display = 'none';
}

function saveZone() {
  var name = document.getElementById('zone-name').value.trim();
  if (!name) { tool.notify('Zone name is required', 'warning'); return; }
  var color = document.getElementById('zone-color').value;
  var minOrder = parseFloat(document.getElementById('zone-min-order').value) || 0;
  var fee = parseFloat(document.getElementById('zone-fee').value) || 0;
  var zones = data.delivery_zones.zones || [];

  if (zoneEditingIndex >= 0 && zoneEditingIndex < zones.length) {
    /* Update existing zone properties */
    var zone = zones[zoneEditingIndex];
    zone.name = name; zone.color = color; zone.min_order = minOrder; zone.fee = fee;

    /* Collect new unsaved drawings and add them as shapes to THIS zone */
    var newShapes = extractUnsavedShapes();
    if (newShapes && newShapes.length > 0) {
      if (!zone.shapes) zone.shapes = [];
      newShapes.forEach(function(geom) {
        zone.shapes.push(geom);
      });
      /* Assign _zoneIndex and _shapeIndex to the consumed layers */
      markUnsavedLayersAsOwned(zoneEditingIndex, zone.shapes.length - newShapes.length);
    }

    /* Update layer styles */
    if (zoneDrawnItems) {
      zoneDrawnItems.eachLayer(function(layer) {
        if (layer._zoneIndex === zoneEditingIndex) layer.setStyle({ color: color, fillColor: color });
      });
    }
    tool.notify('Zone updated' + (newShapes && newShapes.length ? ' with ' + newShapes.length + ' new shape(s)' : ''), 'success');
  } else {
    /* Create new zone from unsaved drawings */
    var newShapes = extractUnsavedShapes();
    if (!newShapes || newShapes.length === 0) { tool.notify('Draw at least one shape on the map first', 'warning'); return; }
    var newZone = { id: uid(), name: name, color: color, min_order: minOrder, fee: fee, shapes: newShapes };
    zones.push(newZone);
    var newIdx = zones.length - 1;
    markUnsavedLayersAsOwned(newIdx, 0);
    tool.notify('Zone created with ' + newShapes.length + ' shape(s)', 'success');
  }

  data.delivery_zones.zones = zones;
  zoneEditingIndex = -1;
  clearZoneForm();
  renderZonesList();
  highlightZone(-1);
  scheduleSave();
}

/* Extract geometries from all unsaved (orphan) drawn layers */
function extractUnsavedShapes() {
  if (!zoneDrawnItems) return null;
  var shapes = [];
  zoneDrawnItems.eachLayer(function(layer) {
    if (layer._zoneIndex === undefined) {
      var geom = zoneLayerToGeoJSON(layer);
      if (geom) shapes.push(geom);
    }
  });
  return shapes.length > 0 ? shapes : null;
}

/* Mark unsaved layers as belonging to a zone, assigning _zoneIndex and _shapeIndex */
function markUnsavedLayersAsOwned(zoneIdx, startShapeIdx) {
  if (!zoneDrawnItems) return;
  var si = startShapeIdx;
  zoneDrawnItems.eachLayer(function(layer) {
    if (layer._zoneIndex === undefined) {
      layer._zoneIndex = zoneIdx;
      layer._shapeIndex = si;
      si++;
    }
  });
}

function zoneLayerToGeoJSON(layer) {
  if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
    var latlngs = layer.getLatLngs();
    var coords = zoneLatlngsToCoords(latlngs);
    if (coords.length > 0 && coords[0].length > 0) {
      var ring = coords[0];
      if (ring.length > 0) {
        var first = ring[0], last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
      }
    }
    return { type: 'Polygon', coordinates: coords };
  }
  if (layer instanceof L.Circle) {
    var center = layer.getLatLng();
    return { type: 'Circle', center: [center.lng, center.lat], radius: layer.getRadius() };
  }
  return null;
}

function zoneLatlngsToCoords(latlngs) {
  if (!latlngs) return [];
  if (Array.isArray(latlngs) && latlngs.length > 0) {
    if (latlngs[0] instanceof L.LatLng) {
      return [latlngs.map(function(ll) { return [ll.lng, ll.lat]; })];
    }
    if (Array.isArray(latlngs[0])) {
      return latlngs.map(function(ring) {
        return ring.map(function(ll) {
          if (ll instanceof L.LatLng) return [ll.lng, ll.lat];
          if (Array.isArray(ll) && ll.length === 2) return [ll[1], ll[0]];
          return [0, 0];
        });
      });
    }
  }
  return [];
}

function removeOrphanDrawings() {
  if (!zoneDrawnItems) return;
  var toRemove = [];
  zoneDrawnItems.eachLayer(function(layer) { if (layer._zoneIndex === undefined) toRemove.push(layer); });
  toRemove.forEach(function(l) { zoneDrawnItems.removeLayer(l); });
}

function clearZoneForm() {
  document.getElementById('zone-form').style.display = 'none';
  document.getElementById('zone-name').value = '';
  document.getElementById('zone-min-order').value = '0';
  document.getElementById('zone-fee').value = '0';
  var deleteFormBtn = document.getElementById('zone-delete-form-btn');
  if (deleteFormBtn) deleteFormBtn.style.display = 'none';
  document.getElementById('zone-shapes-section').style.display = 'none';
  document.getElementById('zone-shapes-list').innerHTML = '';
  zoneEditingIndex = -1;
  deactivateZoneDraw();
  removeOrphanDrawings();
  highlightZone(-1);
  renderZonesList();
  tool.resize();
}

function reindexZoneLayers() {
  if (!zoneDrawnItems) return;
  /* Rebuild _zoneIndex and _shapeIndex based on zone data order */
  var zones = data.delivery_zones.zones || [];
  /* Reset ALL layers to unowned first */
  zoneDrawnItems.eachLayer(function(layer) { layer._zoneIndex = undefined; layer._shapeIndex = undefined; });
  /* Re-assign based on matching shapes */
  zones.forEach(function(zone, zi) {
    var shapes = zone.shapes || [];
    shapes.forEach(function(shape, si) {
      var match = findLayerByGeometry(shape);
      if (match) { match._zoneIndex = zi; match._shapeIndex = si; }
    });
  });
}

function findLayerByGeometry(geom) {
  var found = null;
  if (!zoneDrawnItems) return null;
  zoneDrawnItems.eachLayer(function(layer) {
    if (found) return;
    if (layer._zoneIndex !== undefined) return; /* already claimed */
    var layerGeom = zoneLayerToGeoJSON(layer);
    if (layerGeom && geometriesMatch(layerGeom, geom)) found = layer;
  });
  return found;
}

function geometriesMatch(a, b) {
  if (a.type !== b.type) return false;
  if (a.type === 'Circle' || (a.type === 'Point' && a.radius)) {
    var ca = a.center || a.coordinates;
    var cb = b.center || b.coordinates;
    if (!ca || !cb || ca.length !== 2 || cb.length !== 2) return false;
    return Math.abs(ca[0] - cb[0]) < 0.000001 && Math.abs(ca[1] - cb[1]) < 0.000001 && Math.abs((a.radius || 0) - (b.radius || 0)) < 1;
  }
  /* For polygons, compare coordinate count and first point */
  var coordsA = a.coordinates;
  var coordsB = b.coordinates;
  if (!coordsA || !coordsB) return false;
  if (coordsA.length !== coordsB.length) return false;
  if (coordsA[0] && coordsB[0] && coordsA[0].length !== coordsB[0].length) return false;
  /* Quick check: first vertex match */
  if (coordsA[0] && coordsA[0][0] && coordsB[0] && coordsB[0][0]) {
    return Math.abs(coordsA[0][0][0] - coordsB[0][0][0]) < 0.000001 && Math.abs(coordsA[0][0][1] - coordsB[0][0][1]) < 0.000001;
  }
  return false;
}

/* ---- Zone Map ---- */
function initZoneMap() {
  var mapEl = document.getElementById('delivery-map');
  if (!mapEl) return;

  zoneMap = L.map('delivery-map', { center: [40.7128, -74.006], zoom: 12, zoomControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(zoneMap);

  zoneDrawnItems = new L.FeatureGroup();
  zoneMap.addLayer(zoneDrawnItems);

  zoneMap.on(L.Draw.Event.CREATED, function(event) {
    var layer = event.layer;
    layer._zoneIndex = undefined;
    layer._shapeIndex = undefined;
    zoneDrawnItems.addLayer(layer);
    deactivateZoneDraw();
    /* Use editing zone's color if available, otherwise default */
    var drawColor = '#4f46e5';
    var zones = data.delivery_zones.zones || [];
    if (zoneEditingIndex >= 0 && zoneEditingIndex < zones.length) {
      drawColor = zones[zoneEditingIndex].color || '#4f46e5';
    }
    layer.setStyle({ color: drawColor, fillColor: drawColor, fillOpacity: 0.15, weight: 2 });
  });

  zoneMap.on(L.Draw.Event.EDITED, function() { syncAllZoneLayers(); scheduleSave(); });
  zoneMap.on(L.Draw.Event.DELETED, function() { syncAllZoneLayers(); scheduleSave(); });

  loadZonesOnMap();
}

function loadZonesOnMap() {
  if (!zoneMap || !zoneDrawnItems) return;
  zoneDrawnItems.clearLayers();
  var zones = data.delivery_zones.zones || [];
  zones.forEach(function(zone, zi) {
    var shapes = zone.shapes || [];
    shapes.forEach(function(shape, si) {
      var layer = zoneGeoJSONToLayer(shape);
      if (layer) {
        layer._zoneIndex = zi;
        layer._shapeIndex = si;
        var color = zone.color || '#4f46e5';
        layer.setStyle({ color: color, fillColor: color, fillOpacity: 0.15, weight: 2 });
        zoneDrawnItems.addLayer(layer);
      }
    });
  });
}

function zoneGeoJSONToLayer(geom) {
  if (!geom) return null;
  try {
    if (geom.type === 'Polygon') {
      var coords = geom.coordinates[0];
      var latlngs = coords.map(function(c) { return [c[1], c[0]]; });
      return L.polygon(latlngs);
    }
    if (geom.type === 'MultiPolygon') {
      var all = geom.coordinates.map(function(ring) { return ring.map(function(c) { return [c[1], c[0]]; }); });
      return L.polygon(all);
    }
    if (geom.type === 'Circle' || (geom.type === 'Point' && geom.radius)) {
      var center = geom.center || geom.coordinates;
      return L.circle([center[1], center[0]], { radius: geom.radius || 500 });
    }
  } catch(e) {}
  return null;
}

function syncAllZoneLayers() {
  /* Rebuild zones data from current map layers */
  if (!zoneDrawnItems) return;
  var zones = data.delivery_zones.zones || [];
  var zoneMap2 = {}; /* index → { zone, shapes } */
  zoneDrawnItems.eachLayer(function(layer) {
    var zi = layer._zoneIndex;
    if (zi === undefined) return;
    if (zi < 0 || zi >= zones.length) return;
    var geom = zoneLayerToGeoJSON(layer);
    if (!geom) return;
    if (!zoneMap2[zi]) zoneMap2[zi] = { zone: zones[zi], shapes: [] };
    zoneMap2[zi].shapes.push(geom);
  });
  /* Update zones shapes from the collected data */
  Object.keys(zoneMap2).forEach(function(key) {
    var zi = parseInt(key);
    zones[zi].shapes = zoneMap2[zi].shapes;
  });
}

function activateZoneDraw(type) {
  deactivateZoneDraw();
  if (!zoneMap) return;
  /* Use editing zone's color if available */
  var drawColor = '#4f46e5';
  var zones = data.delivery_zones.zones || [];
  if (zoneEditingIndex >= 0 && zoneEditingIndex < zones.length) {
    drawColor = zones[zoneEditingIndex].color || '#4f46e5';
  }
  var shapeOpts = { color: drawColor, fillColor: drawColor, fillOpacity: 0.15, weight: 2 };
  var options = { polygon: { shapeOptions: shapeOpts }, rectangle: { shapeOptions: shapeOpts }, circle: { shapeOptions: shapeOpts } };
  if (type === 'polygon') zoneDrawControl = new L.Draw.Polygon(zoneMap, options.polygon);
  else if (type === 'rectangle') zoneDrawControl = new L.Draw.Rectangle(zoneMap, options.rectangle);
  else if (type === 'circle') zoneDrawControl = new L.Draw.Circle(zoneMap, options.circle);
  if (zoneDrawControl) { zoneDrawControl.enable(); zoneActiveTool = type; updateZoneToolButtons(); }
}

function deactivateZoneDraw() {
  if (zoneDrawControl) { zoneDrawControl.disable(); zoneDrawControl = null; }
  zoneActiveTool = null;
  updateZoneToolButtons();
}

function updateZoneToolButtons() {
  document.querySelectorAll('.zone-draw-btn').forEach(function(btn) {
    btn.classList.remove('active');
  });
  if (zoneActiveTool) {
    var activeBtn = document.querySelector('.zone-draw-btn[data-shape="' + zoneActiveTool + '"]');
    if (activeBtn) activeBtn.classList.add('active');
  }
}

/* ===================================================================== */
/* DELIVERY FORM SETTINGS */
/* ===================================================================== */
var ADDRESS_FIELD_LABELS = {
  street: 'Street Address',
  city: 'City',
  postal_code: 'Postal / ZIP Code',
  block: 'Block / Neighborhood',
  intercom: 'Intercom / Buzzer Number',
  parking_info: 'Parking Information',
  additional_info: 'Additional Information / Notes'
};

function renderDeliveryFormSettings() {
  var settings = data.delivery_form_settings;
  if (!settings) return;

  /* Outside zone toggle */
  var outsideToggle = document.getElementById('delivery-outside-zone');
  if (outsideToggle) outsideToggle.checked = !!settings.accept_orders_outside_zone;

  /* Address fields */
  renderDeliveryAddressFields();

  /* Custom fields */
  renderDeliveryCustomFields();
}

function renderDeliveryAddressFields() {
  var container = document.getElementById('delivery-address-fields');
  if (!container) return;
  container.innerHTML = '';

  var settings = data.delivery_form_settings;
  if (!settings || !settings.address_fields) return;

  var fields = settings.address_fields;
  Object.keys(ADDRESS_FIELD_LABELS).forEach(function(key) {
    var field = fields[key] || { enabled: false, required: false };
    var row = document.createElement('div');
    row.className = 'delivery-field-row';

    var nameEl = document.createElement('span');
    nameEl.className = 'delivery-field-name';
    nameEl.textContent = ADDRESS_FIELD_LABELS[key];
    row.appendChild(nameEl);

    var toggles = document.createElement('div');
    toggles.className = 'delivery-field-toggles';

    /* Enabled/Disabled tag */
    var enabledTag = document.createElement('span');
    enabledTag.className = 'delivery-field-tag ' + (field.enabled ? 'enabled' : 'disabled');
    enabledTag.textContent = field.enabled ? 'ON' : 'OFF';
    enabledTag.addEventListener('click', function() {
      field.enabled = !field.enabled;
      if (!field.enabled) field.required = false;
      scheduleSave();
      renderDeliveryAddressFields();
    });
    toggles.appendChild(enabledTag);

    /* Required/Optional tag (only when enabled) */
    if (field.enabled) {
      var reqTag = document.createElement('span');
      reqTag.className = 'delivery-field-tag ' + (field.required ? 'required' : 'optional');
      reqTag.textContent = field.required ? 'Required' : 'Optional';
      reqTag.addEventListener('click', function() {
        field.required = !field.required;
        scheduleSave();
        renderDeliveryAddressFields();
      });
      toggles.appendChild(reqTag);
    }

    row.appendChild(toggles);
    container.appendChild(row);
  });
}

function renderDeliveryCustomFields() {
  var container = document.getElementById('delivery-custom-fields-list');
  if (!container) return;

  var settings = data.delivery_form_settings;
  if (!settings) return;
  var customFields = settings.custom_fields || [];
  container.innerHTML = '';

  customFields.forEach(function(cf, idx) {
    var row = document.createElement('div');
    row.className = 'delivery-custom-field-row';

    var label = document.createElement('span');
    label.className = 'cf-label';
    label.textContent = cf.label;
    row.appendChild(label);

    /* Required toggle */
    var reqBtn = document.createElement('button');
    reqBtn.className = 'cf-required-btn ' + (cf.required ? 'is-req' : 'not-req');
    reqBtn.textContent = cf.required ? 'Required' : 'Optional';
    reqBtn.addEventListener('click', function() {
      cf.required = !cf.required;
      scheduleSave();
      renderDeliveryCustomFields();
    });
    row.appendChild(reqBtn);

    /* Remove button */
    var removeBtn = document.createElement('button');
    removeBtn.className = 'cf-remove-btn';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove field';
    removeBtn.addEventListener('click', function() {
      customFields.splice(idx, 1);
      scheduleSave();
      renderDeliveryCustomFields();
    });
    row.appendChild(removeBtn);

    container.appendChild(row);
  });
}

function addDeliveryCustomField() {
  var input = document.getElementById('delivery-custom-field-input');
  if (!input) return;
  var label = input.value.trim();
  if (!label) return;

  var settings = data.delivery_form_settings;
  if (!settings) return;
  if (!settings.custom_fields) settings.custom_fields = [];

  /* Prevent duplicates */
  var exists = settings.custom_fields.some(function(cf) { return cf.label.toLowerCase() === label.toLowerCase(); });
  if (exists) { tool.notify('This field already exists', 'warning'); return; }

  settings.custom_fields.push({ label: label, required: false });
  input.value = '';
  scheduleSave();
  renderDeliveryCustomFields();
}

/* ===================================================================== */
/* MENU SECTION */
/* ===================================================================== */
function renderCategories() {
  var list = document.getElementById('menu-cat-list');
  if (!list) return;
  list.innerHTML = '';
  var categories = data.menu.categories || [];

  categories.forEach(function(cat) {
    /* Migrate old visible boolean to new visibility_mode */
    if (cat.visibility_mode === undefined) {
      cat.visibility_mode = (cat.visible !== false) ? 'show' : 'hide';
    }
    var itemCount = (data.menu.items || []).filter(function(i) { return i.category_id === cat.id; }).length;
    var el = document.createElement('div');
    el.className = 'category-item' + (selectedCategoryId === cat.id ? ' active' : '');
    el.dataset.catId = cat.id;
    /* Visibility badge based on mode */
    var visIcon, visLabel, visClass, visTitle;
    if (cat.visibility_mode === 'hide') {
      visIcon = '○'; visLabel = 'Hidden'; visClass = 'cat-vis-hidden';
      visTitle = 'Hidden';
      if (cat.hide_until_date) visTitle += ' until ' + cat.hide_until_date.replace('T', ' ');
    } else if (cat.visibility_mode === 'scheduled') {
      visIcon = '◐'; visLabel = 'Scheduled'; visClass = 'cat-vis-scheduled';
      visTitle = 'Scheduled: ';
      if (cat.schedule_type === 'time_windows' && cat.schedule_time_windows) {
        visTitle += cat.schedule_time_windows.map(function(w) {
          var days = ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
          return (w.days||[]).map(function(d) { return days[d]; }).join(',') + ' ' + (w.start_time||'') + '-' + (w.end_time||'');
        }).join('; ');
      } else if (cat.schedule_type === 'date_range') {
        visTitle += (cat.schedule_from||'?') + ' to ' + (cat.schedule_until||'?');
      }
    } else {
      visIcon = '●'; visLabel = 'Visible'; visClass = 'cat-vis-visible';
      visTitle = 'Always visible';
    }
    el.innerHTML =
      '<span class="drag-handle">⋮⋮</span>' +
      '<span class="cat-name">' + esc(cat.name) + '</span>' +
      '<span class="cat-vis-badge ' + visClass + '" title="' + esc(visTitle) + '">' + visIcon + '</span>' +
      '<span class="cat-count">' + itemCount + '</span>' +
      '<span class="cat-actions">' +
        '<button class="cat-edit-btn" title="Edit">✎</button>' +
      '</span>';

    el.addEventListener('click', function(e) {
      if (e.target.closest('.cat-actions')) return;
      selectCategory(cat.id);
    });
    el.querySelector('.cat-edit-btn').addEventListener('click', function(e) { e.stopPropagation(); editCategory(cat.id); });
    list.appendChild(el);
  });

  if (typeof Sortable !== 'undefined') {
    Sortable.create(list, {
      handle: '.drag-handle', animation: 150,
      onEnd: function() {
        var ids = [].map.call(list.querySelectorAll('.category-item'), function(el) { return el.dataset.catId; });
        data.menu.categories.sort(function(a, b) { return ids.indexOf(a.id) - ids.indexOf(b.id); });
        scheduleSave();
      }
    });
  }

}

function selectCategory(catId) {
  selectedCategoryId = catId;
  editingItemId = null;
  closeDrawer();
  renderCategories();
  renderItems();
}

function addCategory() {
  editingCategoryId = null;
  _tempCatPhotos = [];
  var title = document.getElementById('menu-cat-modal-title'); if (title) title.textContent = 'New Category';
  var nameEl = document.getElementById('menu-cat-name'); if (nameEl) nameEl.value = '';
  var descEl = document.getElementById('menu-cat-desc'); if (descEl) descEl.value = '';
  var modal = document.getElementById('menu-cat-modal'); if (modal) modal.style.display = 'flex';
  var visMode = document.getElementById('menu-cat-vis-mode'); if (visMode) visMode.value = 'show';
  resetCatVisOptions();
  renderCatPhotoPool(null);
  populateTaxCategorySelect('menu-cat-tax-cat', '');
  var dupBtn = document.getElementById('menu-cat-duplicate'); if (dupBtn) dupBtn.style.display = 'none';
  var delBtn = document.getElementById('menu-cat-delete-btn'); if (delBtn) delBtn.style.display = 'none';
  updateCatCharCounts();
  if (nameEl) nameEl.focus();
}

function editCategory(catId) {
  var cat = data.menu.categories.find(function(c) { return c.id === catId; });
  if (!cat) return;
  editingCategoryId = catId;
  var title = document.getElementById('menu-cat-modal-title'); if (title) title.textContent = 'Edit Category';
  var nameEl = document.getElementById('menu-cat-name'); if (nameEl) nameEl.value = cat.name || '';
  var descEl = document.getElementById('menu-cat-desc'); if (descEl) descEl.value = cat.description || '';
  var modal = document.getElementById('menu-cat-modal'); if (modal) modal.style.display = 'flex';
  /* Populate visibility */
  var visMode = document.getElementById('menu-cat-vis-mode'); if (visMode) visMode.value = cat.visibility_mode || 'show';
  var hideUntil = document.getElementById('menu-cat-hide-until'); if (hideUntil) hideUntil.value = cat.hide_until_date || '';
  var schedType = document.getElementById('menu-cat-schedule-type'); if (schedType) schedType.value = cat.schedule_type || 'time_windows';
  var schedFrom = document.getElementById('menu-cat-sched-from'); if (schedFrom) schedFrom.value = cat.schedule_from || '';
  var schedUntil = document.getElementById('menu-cat-sched-until'); if (schedUntil) schedUntil.value = cat.schedule_until || '';
  applyCatVisMode();
  renderCatTimeWindows(cat);
  /* Photos */
  _tempCatPhotos = [];
  renderCatPhotoPool(cat);
  /* Tax category */
  populateTaxCategorySelect('menu-cat-tax-cat', cat.tax_category_id || '');
  var dupBtn = document.getElementById('menu-cat-duplicate'); if (dupBtn) dupBtn.style.display = '';
  var delBtn = document.getElementById('menu-cat-delete-btn'); if (delBtn) delBtn.style.display = '';
  updateCatCharCounts();
  if (nameEl) nameEl.focus();
}

function resetCatVisOptions() {
  var hideOpts = document.getElementById('cat-hide-options'); if (hideOpts) hideOpts.style.display = 'none';
  var schedOpts = document.getElementById('cat-schedule-options'); if (schedOpts) schedOpts.style.display = 'none';
}

function applyCatVisMode() {
  resetCatVisOptions();
  var modeEl = document.getElementById('menu-cat-vis-mode');
  if (!modeEl) return;
  var mode = modeEl.value;
  if (mode === 'hide') {
    var hideOpts = document.getElementById('cat-hide-options'); if (hideOpts) hideOpts.style.display = '';
    var checkedRadio = document.querySelector('input[name="cat-hide-type"]:checked');
    var untilRow = document.getElementById('cat-hide-until-row');
    if (untilRow) untilRow.style.display = (checkedRadio && checkedRadio.value === 'until_date') ? '' : 'none';
  } else if (mode === 'scheduled') {
    var schedOpts = document.getElementById('cat-schedule-options'); if (schedOpts) schedOpts.style.display = '';
    var schedType = document.getElementById('menu-cat-schedule-type');
    var winDiv = document.getElementById('cat-schedule-windows');
    var dateDiv = document.getElementById('cat-schedule-dates');
    if (schedType && winDiv && dateDiv) {
      var isWindows = schedType.value === 'time_windows';
      winDiv.style.display = isWindows ? '' : 'none';
      dateDiv.style.display = isWindows ? 'none' : '';
    }
  }
}

function renderCatTimeWindows(cat) {
  var container = document.getElementById('cat-schedule-windows');
  if (!container) return;
  var windows = (cat && cat.schedule_time_windows && cat.schedule_time_windows.length > 0)
    ? cat.schedule_time_windows
    : [{ days: [1,2,3,4,5], start_time: '09:00', end_time: '17:00' }];
  container.innerHTML = '';
  windows.forEach(function(win, wi) {
    var row = document.createElement('div');
    row.className = 'cat-time-window-row';
    var daysChecked = function(d) { return (win.days||[]).indexOf(d) !== -1 ? ' checked' : ''; };
    row.innerHTML =
      '<div class="day-pills">' +
        ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(function(label, d) {
          var isChecked = (win.days||[]).indexOf(d+1) !== -1;
          return '<button type="button" class="day-pill' + (isChecked ? ' active' : '') + '" data-day="' + (d+1) + '">' + label + '</button>';
        }).join('') +
      '</div>' +
      '<input type="time" class="form-input form-input-sm cat-tw-start" value="' + (win.start_time||'09:00') + '" style="width:110px;">' +
      '<span style="color:var(--slate-400);font-size:var(--text-xs);">to</span>' +
      '<input type="time" class="form-input form-input-sm cat-tw-end" value="' + (win.end_time||'17:00') + '" style="width:110px;">' +
      (wi > 0 ? '<button type="button" class="btn btn-xs btn-ghost cat-tw-remove" style="color:#ef4444;" title="Remove this time window">✕</button>' : '');
    /* Wire up day-pill toggles */
    row.querySelectorAll('.day-pill').forEach(function(pill) {
      pill.addEventListener('click', function() { this.classList.toggle('active'); });
    });
    /* Wire up remove button */
    var removeBtn = row.querySelector('.cat-tw-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', function() {
        windows.splice(wi, 1);
        var fakeCat = { schedule_time_windows: windows };
        renderCatTimeWindows(fakeCat);
      });
    }
    container.appendChild(row);
  });
  var addBtn = document.createElement('button');
  addBtn.type = 'button'; addBtn.className = 'btn btn-xs btn-outline';
  addBtn.textContent = '+ Add time window'; addBtn.style.marginTop = '4px';
  addBtn.addEventListener('click', function() {
    windows.push({ days: [1,2,3,4,5], start_time: '09:00', end_time: '17:00' });
    var fakeCat = { schedule_time_windows: windows };
    renderCatTimeWindows(fakeCat);
  });
  container.appendChild(addBtn);
}

function collectCatTimeWindows() {
  var rows = document.querySelectorAll('#cat-schedule-windows .cat-time-window-row');
  var windows = [];
  rows.forEach(function(row) {
    var days = [];
    row.querySelectorAll('.day-pill.active').forEach(function(pill) { days.push(parseInt(pill.dataset.day)); });
    var start = row.querySelector('.cat-tw-start'); var end = row.querySelector('.cat-tw-end');
    if (days.length > 0) {
      windows.push({ days: days, start_time: start ? start.value : '09:00', end_time: end ? end.value : '17:00' });
    }
  });
  return windows;
}

/* ---- Item Visibility Helpers (parallel to category ones) ---- */
function applyItemVisMode() {
  resetItemVisOptions();
  var modeEl = document.getElementById('menu-item-vis-mode');
  if (!modeEl) return;
  var mode = modeEl.value;
  if (mode === 'hide') {
    var hideOpts = document.getElementById('item-hide-options'); if (hideOpts) hideOpts.style.display = '';
    var checkedRadio = document.querySelector('input[name="item-hide-type"]:checked');
    var untilRow = document.getElementById('item-hide-until-row');
    if (untilRow) untilRow.style.display = (checkedRadio && checkedRadio.value === 'until_date') ? '' : 'none';
  } else if (mode === 'scheduled') {
    var schedOpts = document.getElementById('item-schedule-options'); if (schedOpts) schedOpts.style.display = '';
    var schedType = document.getElementById('menu-item-schedule-type');
    var winDiv = document.getElementById('item-schedule-windows');
    var dateDiv = document.getElementById('item-schedule-dates');
    if (schedType && winDiv && dateDiv) {
      var isWindows = schedType.value === 'time_windows';
      winDiv.style.display = isWindows ? '' : 'none';
      dateDiv.style.display = isWindows ? 'none' : '';
    }
  }
}

function resetItemVisOptions() {
  var hideOpts = document.getElementById('item-hide-options'); if (hideOpts) hideOpts.style.display = 'none';
  var schedOpts = document.getElementById('item-schedule-options'); if (schedOpts) schedOpts.style.display = 'none';
}

function renderItemTimeWindows(item) {
  var container = document.getElementById('item-schedule-windows');
  if (!container) return;
  var windows = (item && item.schedule_time_windows && item.schedule_time_windows.length > 0)
    ? item.schedule_time_windows
    : [{ days: [1,2,3,4,5], start_time: '09:00', end_time: '17:00' }];
  container.innerHTML = '';
  windows.forEach(function(win, wi) {
    var row = document.createElement('div');
    row.className = 'cat-time-window-row';
    row.innerHTML =
      '<div class="day-pills">' +
        ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(function(label, d) {
          var isChecked = (win.days||[]).indexOf(d+1) !== -1;
          return '<button type="button" class="day-pill' + (isChecked ? ' active' : '') + '" data-day="' + (d+1) + '">' + label + '</button>';
        }).join('') +
      '</div>' +
      '<input type="time" class="form-input form-input-sm cat-tw-start" value="' + (win.start_time||'09:00') + '" style="width:110px;">' +
      '<span style="color:var(--slate-400);font-size:var(--text-xs);">to</span>' +
      '<input type="time" class="form-input form-input-sm cat-tw-end" value="' + (win.end_time||'17:00') + '" style="width:110px;">' +
      (wi > 0 ? '<button type="button" class="btn btn-xs btn-ghost cat-tw-remove" style="color:#ef4444;" title="Remove this time window">✕</button>' : '');
    row.querySelectorAll('.day-pill').forEach(function(pill) {
      pill.addEventListener('click', function() { this.classList.toggle('active'); });
    });
    var removeBtn = row.querySelector('.cat-tw-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', function() {
        windows.splice(wi, 1);
        var fake = { schedule_time_windows: windows };
        renderItemTimeWindows(fake);
      });
    }
    container.appendChild(row);
  });
  var addBtn = document.createElement('button');
  addBtn.type = 'button'; addBtn.className = 'btn btn-xs btn-outline';
  addBtn.textContent = '+ Add time window'; addBtn.style.marginTop = '4px';
  addBtn.addEventListener('click', function() {
    windows.push({ days: [1,2,3,4,5], start_time: '09:00', end_time: '17:00' });
    renderItemTimeWindows({ schedule_time_windows: windows });
  });
  container.appendChild(addBtn);
}

function collectItemTimeWindows() {
  var rows = document.querySelectorAll('#item-schedule-windows .cat-time-window-row');
  var windows = [];
  rows.forEach(function(row) {
    var days = [];
    row.querySelectorAll('.day-pill.active').forEach(function(pill) { days.push(parseInt(pill.dataset.day)); });
    var start = row.querySelector('.cat-tw-start'); var end = row.querySelector('.cat-tw-end');
    if (days.length > 0) {
      windows.push({ days: days, start_time: start ? start.value : '09:00', end_time: end ? end.value : '17:00' });
    }
  });
  return windows;
}

function collectItemVisibility() {
  var visData = { visibility_mode: document.getElementById('menu-item-vis-mode').value };
  if (visData.visibility_mode === 'hide') {
    var hideType = document.querySelector('input[name="item-hide-type"]:checked');
    if (hideType && hideType.value === 'until_date') {
      visData.hide_until_date = document.getElementById('menu-item-hide-until').value || null;
    }
  } else if (visData.visibility_mode === 'scheduled') {
    visData.schedule_type = document.getElementById('menu-item-schedule-type').value;
    if (visData.schedule_type === 'time_windows') {
      visData.schedule_time_windows = collectItemTimeWindows();
    } else {
      visData.schedule_from = document.getElementById('menu-item-sched-from').value || null;
      visData.schedule_until = document.getElementById('menu-item-sched-until').value || null;
    }
  }
  return visData;
}

/* ---- Item Channel Availability ---- */
function getEnabledChannels() {
  var channels = [];
  var toggles = (data.service_settings && data.service_settings.service_toggles) ? data.service_settings.service_toggles : {};
  if (toggles.pickup_enabled) channels.push({ id: 'pickup', label: 'Pickup' });
  if (toggles.delivery_enabled) channels.push({ id: 'delivery', label: 'Delivery' });
  if (toggles.on_premise_enabled) channels.push({ id: 'on_premise', label: 'In-Premise' });
  return channels;
}

function renderItemChannels(selectedChannels) {
  var container = document.getElementById('menu-item-channels');
  if (!container) return;
  container.innerHTML = '';
  var channels = getEnabledChannels();
  if (channels.length === 0) { container.innerHTML = '<span style="font-size:11px;color:var(--slate-400);">No service channels enabled — check Services tab</span>'; return; }
  selectedChannels = selectedChannels || [];
  channels.forEach(function(ch) {
    var isActive = selectedChannels.indexOf(ch.id) !== -1;
    var pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'channel-pill' + (isActive ? ' active' : '');
    pill.textContent = ch.label;
    pill.dataset.channel = ch.id;
    pill.addEventListener('click', function() {
      this.classList.toggle('active');
    });
    container.appendChild(pill);
  });
}

function collectItemChannels() {
  var pills = document.querySelectorAll('#menu-item-channels .channel-pill.active');
  var channels = [];
  pills.forEach(function(p) { channels.push(p.dataset.channel); });
  return channels;
}

/* ---- Item Out-of-Stock options ---- */
function applyItemOosOptions() {
  var statusEl = document.getElementById('menu-item-avail-status');
  var oosOpts = document.getElementById('item-oos-options');
  if (!statusEl || !oosOpts) return;
  oosOpts.style.display = statusEl.value === 'out_of_stock' ? '' : 'none';
  if (statusEl.value === 'out_of_stock') {
    var checkedRadio = document.querySelector('input[name="item-oos-type"]:checked');
    var dateRow = document.getElementById('item-oos-date-row');
    if (dateRow) dateRow.style.display = (checkedRadio && checkedRadio.value === 'date') ? '' : 'none';
  }
}

function resetItemOosOptions() {
  var oosOpts = document.getElementById('item-oos-options'); if (oosOpts) oosOpts.style.display = 'none';
  var dateRow = document.getElementById('item-oos-date-row'); if (dateRow) dateRow.style.display = 'none';
  var oosUntil = document.getElementById('menu-item-oos-until'); if (oosUntil) oosUntil.value = '';
}

function collectItemOosData() {
  var statusEl = document.getElementById('menu-item-avail-status');
  if (!statusEl || statusEl.value !== 'out_of_stock') return null;
  var oosType = document.querySelector('input[name="item-oos-type"]:checked');
  var type = oosType ? oosType.value : 'tomorrow';
  var until = null;
  if (type === 'tomorrow') {
    var t = new Date(); t.setDate(t.getDate() + 1); t.setHours(0, 0, 0, 0);
    until = t.toISOString();
  } else if (type === 'date') {
    until = document.getElementById('menu-item-oos-until').value || null;
    if (until) until = new Date(until).toISOString();
  }
  return { oos_type: type, oos_until: until };
}

/* ---- Modifier Option Out-of-Stock helpers ---- */
function applyOptOosOptions() {
  var availEl = document.getElementById('menu-mg-opt-avail');
  var oosOpts = document.getElementById('opt-oos-options');
  if (!availEl || !oosOpts) return;
  oosOpts.style.display = availEl.value === 'out_of_stock' ? '' : 'none';
  if (availEl.value === 'out_of_stock') {
    var checkedRadio = document.querySelector('input[name="opt-oos-type"]:checked');
    var dateRow = document.getElementById('opt-oos-date-row');
    if (dateRow) dateRow.style.display = (checkedRadio && checkedRadio.value === 'date') ? '' : 'none';
  }
}

function resetOptOosOptions() {
  var oosOpts = document.getElementById('opt-oos-options'); if (oosOpts) oosOpts.style.display = 'none';
  var dateRow = document.getElementById('opt-oos-date-row'); if (dateRow) dateRow.style.display = 'none';
  var oosUntil = document.getElementById('menu-mg-opt-oos-until'); if (oosUntil) oosUntil.value = '';
}

function collectOptOosData() {
  var availEl = document.getElementById('menu-mg-opt-avail');
  if (!availEl || availEl.value !== 'out_of_stock') return { type: null, until: null };
  var oosType = document.querySelector('input[name="opt-oos-type"]:checked');
  var type = oosType ? oosType.value : 'tomorrow';
  var until = null;
  if (type === 'tomorrow') {
    var t = new Date(); t.setDate(t.getDate() + 1); t.setHours(0, 0, 0, 0);
    until = t.toISOString();
  } else if (type === 'date') {
    until = document.getElementById('menu-mg-opt-oos-until') ? (document.getElementById('menu-mg-opt-oos-until').value || null) : null;
    if (until) until = new Date(until).toISOString();
  }
  return { type: type, until: until };
}

function optOosTooltip(opt) {
  if (opt.availability !== 'out_of_stock') return '';
  var until = opt.oos_until;
  if (!until) return 'Out of stock';
  if (opt.oos_type === 'tomorrow') return 'OOS until tomorrow';
  if (opt.oos_type === 'date') return 'OOS until ' + new Date(until).toLocaleString();
  return 'OOS for undetermined time';
}

function updateCatCharCounts() {
  var nameEl = document.getElementById('menu-cat-name');
  var descEl = document.getElementById('menu-cat-desc');
  var nameCount = document.getElementById('cat-name-count');
  var descCount = document.getElementById('cat-desc-count');
  if (nameEl && nameCount) nameCount.textContent = (nameEl.value || '').length + '/80';
  if (descEl && descCount) descCount.textContent = (descEl.value || '').length + '/200';
}

function saveCategory() {
  var nameEl = document.getElementById('menu-cat-name');
  var descEl = document.getElementById('menu-cat-desc');
  if (!nameEl) return;
  var name = nameEl.value.trim();
  if (!name) { tool.notify('Category name is required', 'warning'); return; }
  if (name.length > 80) { tool.notify('Category name must be 80 characters or fewer', 'warning'); return; }
  var desc = descEl ? (descEl.value || '').trim() : '';
  if (desc.length > 200) { tool.notify('Description must be 200 characters or fewer', 'warning'); return; }

  /* Collect visibility settings */
  var visData = {
    visibility_mode: document.getElementById('menu-cat-vis-mode').value
  };
  if (visData.visibility_mode === 'hide') {
    var hideType = document.querySelector('input[name="cat-hide-type"]:checked');
    if (hideType && hideType.value === 'until_date') {
      visData.hide_until_date = document.getElementById('menu-cat-hide-until').value || null;
    }
  } else if (visData.visibility_mode === 'scheduled') {
    visData.schedule_type = document.getElementById('menu-cat-schedule-type').value;
    if (visData.schedule_type === 'time_windows') {
      visData.schedule_time_windows = collectCatTimeWindows();
    } else {
      visData.schedule_from = document.getElementById('menu-cat-sched-from').value || null;
      visData.schedule_until = document.getElementById('menu-cat-sched-until').value || null;
    }
  }

  var catData = {
    name: name, description: desc,
    visibility_mode: visData.visibility_mode,
    hide_until_date: visData.hide_until_date || null,
    schedule_type: visData.schedule_type || null,
    schedule_time_windows: visData.schedule_time_windows || null,
    schedule_from: visData.schedule_from || null,
    schedule_until: visData.schedule_until || null,
    tax_category_id: document.getElementById('menu-cat-tax-cat') ? (document.getElementById('menu-cat-tax-cat').value || null) : null
  };

  if (editingCategoryId) {
    var cat = data.menu.categories.find(function(c) { return c.id === editingCategoryId; });
    if (cat) {
      /* Preserve photos if editing (they are modified in-place by renderCatPhotoPool) */
      /* For new categories, use temp photos */
      if (!cat.photos || cat.photos.length === 0) {
        cat.photos = _tempCatPhotos.slice();
        if (cat.photos.length > 0 && !cat.primary_photo_url) cat.primary_photo_url = cat.photos[0];
      }
      Object.assign(cat, catData);
    }
    editingCategoryId = null;
  } else {
    catData.id = uid();
    catData.photos = _tempCatPhotos.slice();
    catData.primary_photo_url = catData.photos.length > 0 ? catData.photos[0] : null;
    data.menu.categories.push(catData);
  }
  _tempCatPhotos = [];
  closeCategoryForm();
  renderCategories();
  scheduleSave();
  tool.notify(editingCategoryId ? 'Category updated' : 'Category added', 'success');
}

function closeCategoryForm() {
  var modal = document.getElementById('menu-cat-modal'); if (modal) modal.style.display = 'none';
  var nameEl = document.getElementById('menu-cat-name'); if (nameEl) nameEl.value = '';
  var descEl = document.getElementById('menu-cat-desc'); if (descEl) descEl.value = '';
  var dupBtn = document.getElementById('menu-cat-duplicate'); if (dupBtn) dupBtn.style.display = 'none';
  var delBtn = document.getElementById('menu-cat-delete-btn'); if (delBtn) delBtn.style.display = 'none';
  editingCategoryId = null;
}

function duplicateCategory() {
  if (!editingCategoryId) return;
  var cat = data.menu.categories.find(function(c) { return c.id === editingCategoryId; });
  if (!cat) return;
  /* Append " (Copy)" but respect 80-char limit */
  var baseName = (cat.name || 'Category') + ' (Copy)';
  if (baseName.length > 80) baseName = baseName.substring(0, 77) + '...';
  /* Ensure unique name */
  var name = baseName;
  var counter = 1;
  while (data.menu.categories.some(function(c) { return c.name === name; })) {
    counter++;
    name = baseName.replace(/ \(Copy\)/, '') + ' (Copy ' + counter + ')';
    if (name.length > 80) name = name.substring(0, 80);
  }
  var newCat = { id: uid(), name: name, description: cat.description || '', visible: cat.visible !== false };
  data.menu.categories.push(newCat);
  renderCategories();
  scheduleSave();
  tool.notify('Category duplicated', 'success');
}

/* Category delete with confirmation */
var catDeleteId = null;

function confirmDeleteCategory() {
  if (!editingCategoryId) return;
  var cat = data.menu.categories.find(function(c) { return c.id === editingCategoryId; });
  if (!cat) return;
  /* Prevent deletion if category has items */
  var itemCount = (data.menu.items || []).filter(function(i) { return i.category_id === editingCategoryId; }).length;
  if (itemCount > 0) {
    tool.notify('Cannot delete category with ' + itemCount + ' item(s). Move or delete them first.', 'warning');
    return;
  }
  catDeleteId = editingCategoryId;
  var nameEl = document.getElementById('cat-delete-modal-name'); if (nameEl) nameEl.textContent = '"' + (cat.name || 'Unnamed') + '"';
  var modal = document.getElementById('cat-delete-modal'); if (modal) modal.style.display = 'flex';
}

function deleteCategoryConfirmed() {
  var modal = document.getElementById('cat-delete-modal'); if (modal) modal.style.display = 'none';
  if (!catDeleteId) return;
  data.menu.categories = (data.menu.categories || []).filter(function(c) { return c.id !== catDeleteId; });
  /* Unlink items from deleted category */
  (data.menu.items || []).forEach(function(item) {
    if (item.category_id === catDeleteId) item.category_id = '';
  });
  var deletedId = catDeleteId;
  catDeleteId = null;
  editingCategoryId = null;
  if (selectedCategoryId === deletedId) { selectedCategoryId = null; }
  closeCategoryForm();
  renderCategories();
  renderItems();
  scheduleSave();
  tool.notify('Category deleted', 'info');
}

function cancelCategoryDelete() {
  var modal = document.getElementById('cat-delete-modal'); if (modal) modal.style.display = 'none';
  catDeleteId = null;
}

/* ---- Modifier Groups ---- */
function getModGroupById(id) {
  return (data.menu.modifier_groups || []).find(function(g) { return g.id === id; });
}

/* ---- Hybrid Modifier Assignment Helpers ---- */
/* Resolve a modifier group ID from an assignment (string or object) */
function resolveModGroupId(assignment) {
  if (typeof assignment === 'string') return assignment;
  return assignment && assignment.group_id ? assignment.group_id : null;
}

/* Get all modifier group IDs from an array of mixed assignments */
function getModGroupIds(assignments) {
  if (!assignments) return [];
  return assignments.map(function(a) { return resolveModGroupId(a); }).filter(Boolean);
}

/* Get the override object for an assignment, or null if it's a plain string */
function getModOverride(assignments, groupId) {
  if (!assignments) return null;
  for (var i = 0; i < assignments.length; i++) {
    var id = resolveModGroupId(assignments[i]);
    if (id === groupId && typeof assignments[i] === 'object') return assignments[i];
  }
  return null;
}

/* Read a property from an assignment with fallback to group definition */
function getModProp(assignments, groupId, prop, defaultVal) {
  if (defaultVal === undefined) defaultVal = false;
  var override = getModOverride(assignments, groupId);
  if (override && override[prop] !== undefined) return override[prop];
  var mg = getModGroupById(groupId);
  if (mg && mg[prop] !== undefined) return mg[prop];
  return defaultVal;
}

/* Set an override property on an assignment (converts string to object if needed) */
function setModOverride(assignments, groupId, prop, value) {
  if (!assignments) return;
  for (var i = 0; i < assignments.length; i++) {
    var id = resolveModGroupId(assignments[i]);
    if (id === groupId) {
      if (typeof assignments[i] === 'string') {
        assignments[i] = { group_id: groupId };
      }
      assignments[i][prop] = value;
      return;
    }
  }
}

/* Remove modifier group from assignments by group ID */
function removeModFromAssignments(assignments, groupId) {
  if (!assignments) return;
  for (var i = assignments.length - 1; i >= 0; i--) {
    if (resolveModGroupId(assignments[i]) === groupId) {
      assignments.splice(i, 1);
    }
  }
}

/* Check if a modifier group ID exists in the assignments */
function hasModGroup(assignments, groupId) {
  if (!assignments) return false;
  return getModGroupIds(assignments).indexOf(groupId) !== -1;
}

function focusModGroup(mgId) {
  highlightedModGroupId = mgId;
  /* Switch left panel to Modifiers tab */
  switchLeftTab('modifiers');
  renderModGroups();
  /* Scroll to the highlighted group after render */
  setTimeout(function() {
    var el = document.querySelector('.modgroup-item[data-mg-id="' + mgId + '"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 50);
}

function switchLeftTab(tabName) {
  document.querySelectorAll('.panel-tab').forEach(function(t) {
    t.classList.toggle('active', t.dataset.leftTab === tabName);
  });
  document.querySelectorAll('.panel-content').forEach(function(p) {
    p.classList.toggle('active', p.id === 'left-tab-' + tabName);
  });
  if (tabName === 'modifiers') renderModGroups();
  if (tabName === 'categories') renderCategories();
  tool.resize();
}

function getModGroupUsage(mgId) {
  var result = [];
  (data.menu.items || []).forEach(function(item) {
    /* Check item-level assignment */
    if ((item.modifier_group_ids || []).indexOf(mgId) !== -1) {
      result.push({ itemName: item.item_name || 'Untitled', sizeLabel: null });
    }
    /* Check size-level assignment */
    (item.sizes || []).forEach(function(sz) {
      if ((sz.modifier_group_ids || []).indexOf(mgId) !== -1) {
        result.push({ itemName: item.item_name || 'Untitled', sizeLabel: sz.label });
      }
    });
  });
  return result;
}

function renderModGroups() {
  var list = document.getElementById('menu-mg-list');
  if (!list) return;
  list.innerHTML = '';
  (data.menu.modifier_groups || []).forEach(function(mg) {
    var hasOpts = mg.options && mg.options.length > 0;
    /* Track expand state: default collapsed unless previously expanded */
    if (_expandedModGroups[mg.id] === undefined) _expandedModGroups[mg.id] = false;
    var isExpanded = _expandedModGroups[mg.id] || highlightedModGroupId === mg.id;

    /* Group row */
    var el = document.createElement('div');
    el.className = 'modgroup-item' + (editingModGroupId === mg.id ? ' active' : '') + (highlightedModGroupId === mg.id ? ' highlighted' : '');
    el.dataset.mgId = mg.id;
    el.innerHTML =
      '<span class="mg-expand">' + (isExpanded ? '▼' : '▶') + '</span>' +
      '<span class="mg-name">' + esc(mg.group_name) + '</span>' +
      '<span class="mg-meta">' + (hasOpts ? mg.options.length + '' : '0') + ' · ' + (mg.selection_type === 'single' ? 'Single' : 'Multi') + (mg.allow_duplicates ? ' · Dup' : '') + (mg.is_required ? ' · Req' : '') + (mg.force_min > 0 ? ' · Min:' + mg.force_min : '') + (mg.force_max > 0 ? ' · Max:' + mg.force_max : '') + '</span>' +
      '<span class="mg-actions"><button class="mg-edit-btn" title="Edit">✎</button></span>';

    el.querySelector('.mg-expand').addEventListener('click', function(e) {
      e.stopPropagation();
      highlightedModGroupId = null;
      _expandedModGroups[mg.id] = !_expandedModGroups[mg.id];
      renderModGroups();
    });
    el.addEventListener('click', function(e) {
      if (e.target.closest('.mg-actions') || e.target.closest('.mg-expand')) return;
      highlightedModGroupId = null;
      _expandedModGroups[mg.id] = !_expandedModGroups[mg.id];
      renderModGroups();
    });
    /* Filter checkbox — visible on hover, stays when checked */
    var filterCb = document.createElement('input');
    filterCb.type = 'checkbox';
    filterCb.className = 'mg-filter-cb';
    filterCb.title = 'Filter products by this modifier group';
    filterCb.checked = _modFilterIds.indexOf(mg.id) !== -1;
    filterCb.addEventListener('click', function(e) {
      e.stopPropagation();
      if (this.checked) { if (_modFilterIds.indexOf(mg.id) === -1) _modFilterIds.push(mg.id); }
      else { _modFilterIds = _modFilterIds.filter(function(id) { return id !== mg.id; }); }
      renderModGroups();
      renderItems();
    });
    el.querySelector('.mg-expand').insertAdjacentElement('afterend', filterCb);

    el.querySelector('.mg-edit-btn').addEventListener('click', function(e) { e.stopPropagation(); editModGroup(mg.id); });
    list.appendChild(el);

    /* Sub-list (always rendered so Add button is available even for empty groups) */
    var subList = document.createElement('div');
    subList.className = 'mg-sub-list';
    subList.style.display = isExpanded ? '' : 'none';

    /* Existing options */
    (mg.options || []).forEach(function(opt, idx) {
      var optRow = document.createElement('div');
      optRow.className = 'mg-sub-row';
      var priceStr = (opt.price_adjustment && opt.price_adjustment !== 0) ? ((opt.price_adjustment > 0 ? '+' : '') + '$' + opt.price_adjustment.toFixed(2)) : '';
      optRow.innerHTML =
        '<span class="mg-sub-name">' + esc(opt.option_name || '(unnamed)') + '</span>' +
        (opt.is_default ? '<span class="mg-sub-default">★ Default</span>' : '') +
        (opt.is_available === false ? '<span style="color:var(--slate-300);font-size:10px;">Hidden</span>' : '') +
        (opt.availability === 'out_of_stock' ? '<span class="oos-badge opt-oos-badge" title="' + esc(optOosTooltip(opt)) + '">OOS</span>' : '') +
        '<span class="mg-sub-price">' + priceStr + '</span>' +
        '<button class="mg-sub-edit" title="Edit">✎</button>';
      optRow.querySelector('.mg-sub-edit').addEventListener('click', function(e) {
        e.stopPropagation();
        editModOption(mg.id, idx);
      });
      subList.appendChild(optRow);
    });

    /* Add Option button (always visible) */
    var addBtn = document.createElement('button');
    addBtn.className = 'mg-sub-add-btn';
    addBtn.textContent = '+ Add Option';
    addBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      addModOption(mg.id);
    });
    subList.appendChild(addBtn);
    list.appendChild(subList);

    /* ---- Usage: show where this modifier group is used ---- */
    var usage = getModGroupUsage(mg.id);
    if (usage.length > 0) {
      var usageToggle = document.createElement('div');
      usageToggle.className = 'mg-usage-toggle';
      usageToggle.textContent = '▸ Used in ' + usage.length + ' product(s)';
      usageToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        var ul = this.nextElementSibling;
        var isOpen = ul.classList.toggle('open');
        this.textContent = (isOpen ? '▾' : '▸') + ' Used in ' + usage.length + ' product(s)';
      });
      list.appendChild(usageToggle);

      var usageList = document.createElement('div');
      usageList.className = 'mg-usage-list';
      usage.forEach(function(u) {
        var line = document.createElement('span');
        line.innerHTML = '<span class="mg-usage-item-name">' + esc(u.itemName) + '</span>' + (u.sizeLabel ? '<span class="mg-usage-size">→ ' + esc(u.sizeLabel) + '</span>' : '');
        usageList.appendChild(line);
      });
      list.appendChild(usageList);
    }
  });
}

function addModGroup() {
  editingModGroupId = null;
  _tempMgPhoto = null;
  document.getElementById('menu-mg-modal-title').textContent = 'New Modifier Group';
  document.getElementById('menu-mg-name').value = '';
  document.getElementById('menu-mg-multi').checked = true;
  document.getElementById('menu-mg-allow-duplicates').checked = false;
  document.getElementById('menu-mg-required').checked = false;
  document.getElementById('menu-mg-force-min').value = '0';
  document.getElementById('menu-mg-force-max').value = '0';
  populateTaxCategorySelect('menu-mg-tax-cat', '');
  renderSinglePhoto('menu-mg-photo-area', null, null);
  document.getElementById('menu-mg-delete-btn').style.display = 'none';
  document.getElementById('menu-mg-modal').style.display = 'flex';
  document.getElementById('menu-mg-name').focus();
}

function editModGroup(mgId) {
  var mg = data.menu.modifier_groups.find(function(g) { return g.id === mgId; });
  if (!mg) return;
  editingModGroupId = mgId;
  document.getElementById('menu-mg-modal-title').textContent = 'Edit Modifier Group';
  document.getElementById('menu-mg-name').value = mg.group_name;
  document.getElementById('menu-mg-multi').checked = mg.selection_type !== 'single';
  document.getElementById('menu-mg-allow-duplicates').checked = !!mg.allow_duplicates;
  document.getElementById('menu-mg-required').checked = !!mg.is_required;
  document.getElementById('menu-mg-force-min').value = mg.force_min || 0;
  document.getElementById('menu-mg-force-max').value = mg.force_max || 0;
  populateTaxCategorySelect('menu-mg-tax-cat', mg.tax_category_id || '');
  /* Photo */
  _tempMgPhoto = mg.photo_url || null;
  renderSinglePhoto('menu-mg-photo-area', _tempMgPhoto, function() { _tempMgPhoto = null; renderSinglePhoto('menu-mg-photo-area', null, null); });
  document.getElementById('menu-mg-delete-btn').style.display = '';
  document.getElementById('menu-mg-modal').style.display = 'flex';
  document.getElementById('menu-mg-name').focus();
}

function closeModGroupModal() {
  document.getElementById('menu-mg-modal').style.display = 'none';
  editingModGroupId = null;
  renderModGroups();
}

function confirmDeleteModGroup() {
  if (!editingModGroupId) return;
  var mg = data.menu.modifier_groups.find(function(g) { return g.id === editingModGroupId; });
  if (!mg) return;
  document.getElementById('mg-delete-modal-name').textContent = '"' + (mg.group_name || 'Unnamed') + '"';
  document.getElementById('mg-delete-modal').style.display = 'flex';
}

function deleteModGroupConfirmed() {
  document.getElementById('mg-delete-modal').style.display = 'none';
  if (!editingModGroupId) return;
  var mgId = editingModGroupId;
  data.menu.modifier_groups = data.menu.modifier_groups.filter(function(g) { return g.id !== mgId; });
  (data.menu.items || []).forEach(function(item) {
    if (item.modifier_group_ids) item.modifier_group_ids = item.modifier_group_ids.filter(function(id) { return id !== mgId; });
  });
  editingModGroupId = null;
  document.getElementById('menu-mg-modal').style.display = 'none';
  document.getElementById('menu-mg-options-panel').style.display = 'none';
  renderModGroups();
  renderModGroupCheckboxes();
  scheduleSave();
  tool.notify('Group deleted', 'info');
}

function cancelDeleteModGroup() {
  document.getElementById('mg-delete-modal').style.display = 'none';
}

function saveModGroup() {
  var name = document.getElementById('menu-mg-name').value.trim();
  if (!name) { tool.notify('Group name required', 'warning'); return; }
  var mgData = {
    id: editingModGroupId || uid(),
    group_name: name,
    selection_type: document.getElementById('menu-mg-multi').checked ? 'multi' : 'single',
    allow_duplicates: document.getElementById('menu-mg-allow-duplicates').checked,
    is_required: document.getElementById('menu-mg-required').checked,
    force_min: parseInt(document.getElementById('menu-mg-force-min').value) || 0,
    force_max: parseInt(document.getElementById('menu-mg-force-max').value) || 0,
    tax_category_id: document.getElementById('menu-mg-tax-cat') ? (document.getElementById('menu-mg-tax-cat').value || null) : null,
    photo_url: _tempMgPhoto || null,
    options: []
  };
  _tempMgPhoto = null;
  if (editingModGroupId) {
    var existing = data.menu.modifier_groups.find(function(g) { return g.id === editingModGroupId; });
    if (existing) { mgData.options = existing.options || []; Object.assign(existing, mgData); }
  } else {
    data.menu.modifier_groups.push(mgData);
  }
  editingModGroupId = null;
  document.getElementById('menu-mg-modal').style.display = 'none';
  renderModGroups();
  renderModGroupCheckboxes();
  scheduleSave();
  tool.notify('Group saved', 'success');
}

/* ---- Modifier Options ---- */
var _editingOptGroupId = null;
var _editingOptIdx = -1;

function addModOption(mgId) {
  _editingOptGroupId = mgId;
  _editingOptIdx = -1;
  _tempOptPhoto = null;
  document.getElementById('menu-mg-opt-modal-title').textContent = 'Add Option';
  document.getElementById('menu-mg-opt-name').value = '';
  document.getElementById('menu-mg-opt-price').value = '0';
  document.getElementById('menu-mg-opt-default').checked = false;
  document.getElementById('menu-mg-opt-delete-btn').style.display = 'none';
  /* Reset availability */
  var availEl = document.getElementById('menu-mg-opt-avail'); if (availEl) availEl.value = 'available';
  resetOptOosOptions();
  /* Reset photo */
  renderSinglePhoto('menu-mg-opt-photo-area', null, null);
  /* Reset special instructions */
  document.getElementById('menu-mg-opt-internal-name-toggle').checked = false;
  document.getElementById('menu-mg-opt-internal-name').value = '';
  document.getElementById('mg-opt-internal-name-row').style.display = 'none';
  document.getElementById('menu-mg-opt-modal').style.display = 'flex';
  document.getElementById('menu-mg-opt-name').focus();
}

function editModOption(mgId, optIdx) {
  var mg = data.menu.modifier_groups.find(function(g) { return g.id === mgId; });
  if (!mg || !mg.options || optIdx < 0 || optIdx >= mg.options.length) return;
  var opt = mg.options[optIdx];
  _editingOptGroupId = mgId;
  _editingOptIdx = optIdx;
  document.getElementById('menu-mg-opt-modal-title').textContent = 'Edit Option';
  document.getElementById('menu-mg-opt-name').value = opt.option_name || '';
  document.getElementById('menu-mg-opt-price').value = opt.price_adjustment || 0;
  document.getElementById('menu-mg-opt-default').checked = !!opt.is_default;
  document.getElementById('menu-mg-opt-delete-btn').style.display = '';
  /* Populate availability */
  var availEl = document.getElementById('menu-mg-opt-avail'); if (availEl) availEl.value = opt.availability || 'available';
  if (opt.oos_type) {
    var oosRadio = document.querySelector('input[name="opt-oos-type"][value="' + opt.oos_type + '"]');
    if (oosRadio) oosRadio.checked = true;
    if (opt.oos_until && opt.oos_type === 'date') {
      var oosEl = document.getElementById('menu-mg-opt-oos-until'); if (oosEl) oosEl.value = opt.oos_until.slice(0, 16);
    }
  }
  applyOptOosOptions();
  /* Photo */
  _tempOptPhoto = opt.photo_url || null;
  renderSinglePhoto('menu-mg-opt-photo-area', _tempOptPhoto, function() { _tempOptPhoto = null; renderSinglePhoto('menu-mg-opt-photo-area', null, null); });
  /* Special instructions */
  document.getElementById('menu-mg-opt-internal-name-toggle').checked = !!opt.show_internal_name;
  document.getElementById('menu-mg-opt-internal-name').value = opt.internal_name || '';
  document.getElementById('mg-opt-internal-name-row').style.display = opt.show_internal_name ? '' : 'none';
  document.getElementById('menu-mg-opt-modal').style.display = 'flex';
  document.getElementById('menu-mg-opt-name').focus();
}

function closeModOptionModal() {
  document.getElementById('menu-mg-opt-modal').style.display = 'none';
  _editingOptGroupId = null;
  _editingOptIdx = -1;
}

function saveModOption() {
  if (!_editingOptGroupId) return;
  var mg = data.menu.modifier_groups.find(function(g) { return g.id === _editingOptGroupId; });
  if (!mg) return;
  var name = document.getElementById('menu-mg-opt-name').value.trim();
  if (!name) { tool.notify('Option name required', 'warning'); return; }
  var price = parseFloat(document.getElementById('menu-mg-opt-price').value) || 0;
  var isDefault = document.getElementById('menu-mg-opt-default').checked;
  /* Collect availability */
  var availability = document.getElementById('menu-mg-opt-avail') ? document.getElementById('menu-mg-opt-avail').value : 'available';
  var oosData = collectOptOosData();

  var optData = { option_name: name, price_adjustment: price, is_default: isDefault, availability: availability, photo_url: _tempOptPhoto || null, show_internal_name: document.getElementById('menu-mg-opt-internal-name-toggle').checked, internal_name: document.getElementById('menu-mg-opt-internal-name-toggle').checked ? document.getElementById('menu-mg-opt-internal-name').value.trim() : '' };
  _tempOptPhoto = null;
  if (availability === 'out_of_stock') {
    optData.oos_type = oosData.type;
    if (oosData.type === 'date' && oosData.until) optData.oos_until = oosData.until;
  }

  if (_editingOptIdx >= 0) {
    var opt = mg.options[_editingOptIdx];
    if (opt) { Object.keys(optData).forEach(function(k) { opt[k] = optData[k]; }); }
  } else {
    if (!mg.options) mg.options = [];
    optData.id = uid();
    optData.is_available = true;
    mg.options.push(optData);
  }
  closeModOptionModal();
  renderModGroups();
  scheduleSave();
  tool.notify(_editingOptIdx >= 0 ? 'Option updated' : 'Option added', 'success');
}

function confirmDeleteModOption() {
  if (!_editingOptGroupId || _editingOptIdx < 0) return;
  var mg = data.menu.modifier_groups.find(function(g) { return g.id === _editingOptGroupId; });
  if (!mg || !mg.options) return;
  var opt = mg.options[_editingOptIdx];
  if (!opt) return;
  document.getElementById('mg-opt-delete-modal-name').textContent = '"' + (opt.option_name || 'Unnamed') + '"';
  document.getElementById('mg-opt-delete-modal').style.display = 'flex';
}

function deleteModOptionConfirmed() {
  document.getElementById('mg-opt-delete-modal').style.display = 'none';
  if (!_editingOptGroupId || _editingOptIdx < 0) return;
  var mg = data.menu.modifier_groups.find(function(g) { return g.id === _editingOptGroupId; });
  if (mg && mg.options) { mg.options.splice(_editingOptIdx, 1); }
  closeModOptionModal();
  renderModGroups();
  scheduleSave();
  tool.notify('Option deleted', 'info');
}

function cancelDeleteModOption() {
  document.getElementById('mg-opt-delete-modal').style.display = 'none';
}

/* ---- Reusable Modifier Chip Picker ---- */
function renderModChipPicker(containerId, getSelectedIds, onIdsChanged, getOverridesTarget) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  container.className = 'mod-picker';

  var selectedIds = getSelectedIds();
  if (!Array.isArray(selectedIds)) selectedIds = [];

  /* Render selected chips */
  selectedIds.forEach(function(mgId) {
    var mg = getModGroupById(mgId);
    if (!mg) return;
    var chip = document.createElement('span');
    chip.className = 'mod-picker-chip';
    var optCount = (mg.options && mg.options.length) ? mg.options.length : 0;
    var hasOverrides = !!getOverridesTarget;
    chip.innerHTML = esc(mg.group_name) + ' <small>(' + optCount + ')</small>' +
      (hasOverrides ? '<span class="mod-picker-chip-settings" title="Override settings for this assignment">⚙</span>' : '') +
      '<span class="mod-picker-chip-remove">✕</span>';
    chip.querySelector('.mod-picker-chip-remove').addEventListener('click', function(e) {
      e.stopPropagation();
      var newIds = getSelectedIds().filter(function(id) { return id !== mgId; });
      onIdsChanged(newIds);
      renderModChipPicker(containerId, getSelectedIds, onIdsChanged, getOverridesTarget);
    });
    /* ⚙ opens inline override mini-form */
    if (hasOverrides) {
      chip.querySelector('.mod-picker-chip-settings').addEventListener('click', function(e) {
        e.stopPropagation();
        showModOverrideForm(chip, mgId, getOverridesTarget);
      });
    }
    container.appendChild(chip);
  });

  /* Dropdown trigger */
  var trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'mod-picker-trigger';
  trigger.textContent = selectedIds.length === 0 ? '+ Add modifiers' : '+ Add more';
  trigger.addEventListener('click', function(e) {
    e.stopPropagation();
    /* Toggle dropdown */
    var existing = container.querySelector('.mod-picker-dropdown');
    if (existing) { existing.remove(); return; }
    /* Close any other open dropdowns */
    document.querySelectorAll('.mod-picker-dropdown').forEach(function(d) { d.remove(); });
    showModPickerDropdown(container, getSelectedIds, onIdsChanged, function() { renderModChipPicker(containerId, getSelectedIds, onIdsChanged, getOverridesTarget); }, getOverridesTarget);
  });
  container.appendChild(trigger);
}

function showModPickerDropdown(container, getSelectedIds, onIdsChanged, onClose, getOverridesTarget) {
  var selectedIds = getSelectedIds();
  var dropdown = document.createElement('div');
  dropdown.className = 'mod-picker-dropdown';

  (data.menu.modifier_groups || []).forEach(function(mg) {
    var checked = selectedIds.indexOf(mg.id) !== -1;
    var row = document.createElement('div');
    row.className = 'mod-picker-option' + (checked ? ' checked' : '');
    var optCount = (mg.options && mg.options.length) ? mg.options.length : 0;
    row.innerHTML = '<span class="mod-picker-option-name">' + esc(mg.group_name) + '</span><span class="mod-picker-option-meta">' + optCount + ' opt · ' + (mg.selection_type === 'single' ? 'Single' : 'Multi') + '</span>';
    row.addEventListener('click', function() {
      var ids = getSelectedIds();
      if (checked) {
        ids = ids.filter(function(id) { return id !== mg.id; });
      } else {
        if (ids.indexOf(mg.id) === -1) ids = ids.concat([mg.id]);
      }
      onIdsChanged(ids);
      dropdown.remove();
      onClose();
    });
    dropdown.appendChild(row);
  });

  if ((data.menu.modifier_groups || []).length === 0) {
    dropdown.innerHTML = '<div class="mod-picker-empty">No modifier groups yet — create one in the right panel</div>';
  }

  container.appendChild(dropdown);

  /* Close dropdown on outside click */
  setTimeout(function() {
    document.addEventListener('click', function closeHandler(e) {
      if (!dropdown.parentNode) { document.removeEventListener('click', closeHandler); return; }
      if (!dropdown.contains(e.target) && e.target !== container.querySelector('.mod-picker-trigger')) {
        dropdown.remove();
        document.removeEventListener('click', closeHandler);
      }
    });
  }, 10);
}

function renderModGroupCheckboxes() {
  renderModChipPicker('menu-mg-checkboxes',
    function() { var it = getEditingItem(); return it ? (it.modifier_group_ids || []) : []; },
    function(newIds) {
      var it = getEditingItem();
      if (it) { it.modifier_group_ids = newIds; }
    },
    function() { return getEditingItem(); } /* overrides target */
  );
}

/* ---- Override form for modifier assignment ---- */
function showModOverrideForm(chipEl, mgId, getOverridesTarget) {
  /* Remove any existing override popup */
  var existing = document.querySelector('.mod-override-popup');
  if (existing) existing.remove();

  var target = getOverridesTarget();
  if (!target) return;
  var mg = getModGroupById(mgId);
  if (!mg) return;

  if (!target.modifier_group_overrides) target.modifier_group_overrides = {};
  if (!target.modifier_group_overrides[mgId]) target.modifier_group_overrides[mgId] = {};

  var ov = target.modifier_group_overrides[mgId];
  var isReq = ov.is_required !== undefined ? ov.is_required : (mg.is_required || false);
  var isDup = ov.allow_duplicates !== undefined ? ov.allow_duplicates : (mg.allow_duplicates || false);

  var popup = document.createElement('div');
  popup.className = 'mod-override-popup';
  popup.innerHTML =
    '<div class="mod-override-title">' + esc(mg.group_name) + ' — overrides</div>' +
    '<label class="mod-override-row"><input type="checkbox" class="mod-override-req"' + (isReq ? ' checked' : '') + '> Required</label>' +
    '<label class="mod-override-row"><input type="checkbox" class="mod-override-dup"' + (isDup ? ' checked' : '') + '> Allow duplicates</label>' +
    '<button type="button" class="mod-override-close">Done</button>';

  popup.querySelector('.mod-override-req').addEventListener('change', function() { ov.is_required = this.checked; scheduleSave(); });
  popup.querySelector('.mod-override-dup').addEventListener('change', function() { ov.allow_duplicates = this.checked; scheduleSave(); });
  popup.querySelector('.mod-override-close').addEventListener('click', function() { popup.remove(); });

  /* Position near the chip */
  var rect = chipEl.getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.top = (rect.bottom + 4) + 'px';
  popup.style.left = Math.min(rect.left, window.innerWidth - 230) + 'px';
  document.body.appendChild(popup);

  /* Click outside to close */
  setTimeout(function() {
    document.addEventListener('click', function closeHandler(e) {
      if (!popup.parentNode) { document.removeEventListener('click', closeHandler); return; }
      if (!popup.contains(e.target) && e.target !== chipEl.querySelector('.mod-picker-chip-settings')) {
        popup.remove();
        document.removeEventListener('click', closeHandler);
      }
    });
  }, 10);
}

/* ---- Items Grid ---- */
function renderItems() {
  var grid = document.getElementById('menu-items-grid');
  if (!grid) return;
  grid.innerHTML = '';

  var items = data.menu.items || [];
  if (selectedCategoryId) items = items.filter(function(i) { return i.category_id === selectedCategoryId; });

  var query = (document.getElementById('menu-search').value || '').toLowerCase();
  if (query) items = items.filter(function(i) { return (i.item_name || '').toLowerCase().indexOf(query) !== -1; });

  var showAvailableOnly = document.getElementById('menu-filter-avail');
  if (showAvailableOnly && showAvailableOnly.checked) items = items.filter(function(i) {
    /* Migrate old is_available to visibility_mode */
    if (i.visibility_mode === undefined) i.visibility_mode = (i.is_available !== false) ? 'show' : 'hide';
    return i.visibility_mode !== 'hide';
  });

  /* Filter by selected modifier groups (union / OR) */
  if (_modFilterIds.length > 0) {
    items = items.filter(function(item) {
      var itemMods = item.modifier_group_ids || [];
      var sizeMods = [];
      (item.sizes || []).forEach(function(sz) { sizeMods = sizeMods.concat(sz.modifier_group_ids || []); });
      var allMods = itemMods.concat(sizeMods);
      return _modFilterIds.some(function(mgId) { return allMods.indexOf(mgId) !== -1; });
    });
  }

  var sortBy = document.getElementById('menu-sort').value;
  if (sortBy === 'name_asc') items.sort(function(a, b) { return (a.item_name || '').localeCompare(b.item_name || ''); });
  if (sortBy === 'name_desc') items.sort(function(a, b) { return (b.item_name || '').localeCompare(a.item_name || ''); });
  if (sortBy === 'price_asc') items.sort(function(a, b) { return (a.price || 0) - (b.price || 0); });
  if (sortBy === 'price_desc') items.sort(function(a, b) { return (b.price || 0) - (a.price || 0); });

  if (items.length === 0) { grid.innerHTML = '<div class="empty-state">No items found</div>'; return; }

  var list = document.createElement('div');
  list.className = 'item-list';

  var modifierGroups = data.menu.modifier_groups || [];

  /* Build chip HTML for a list of modifier group IDs */
  function buildModChipsHtml(mgIds, cssClass, prefix) {
    var html = '';
    (mgIds || []).forEach(function(mgId) {
      var mg = getModGroupById(mgId);
      if (!mg) return;
      var optCount = (mg.options && mg.options.length) ? mg.options.length : 0;
      html += '<span class="mod-chip ' + (cssClass || '') + '" data-mg-id="' + mgId + '" title="' + esc(mg.group_name) + ' · ' + optCount + ' options">' + (prefix || '') + esc(mg.group_name) + ' <small>(' + optCount + ')</small><span class="mod-chip-inline-settings">⚙</span></span>';
    });
    return html;
  }

  items.forEach(function(item) {
    var hasMods = item.modifier_group_ids && item.modifier_group_ids.length > 0;
    var hasSizes = item.sizes && item.sizes.length > 0;

    /* ---- Group wrapper ---- */
    var group = document.createElement('div');
    group.className = 'item-group' + (editingItemId === item.id ? ' editing' : '');

    /* ---- Main row ---- */
    var row = document.createElement('div');
    row.className = 'item-row' + (hasMods ? ' has-mods' : '') + (hasSizes ? ' has-sizes' : '');
    row.dataset.itemId = item.id;
    row.draggable = true;

    var expandBtn = (hasMods || hasSizes) ? '<span class="item-expand">▶</span>' : '<span class="item-expand item-expand-empty"></span>';
    var thumbUrl = item.primary_photo_url || (item.photos && item.photos.length > 0 ? item.photos[0] : null);
    var photoHtml = thumbUrl
      ? '<div class="item-thumb" style="background-image:url(' + esc(thumbUrl) + ')"></div>'
      : '<div class="item-thumb item-thumb-placeholder">🍽️</div>';

    /* Price hidden when sizes exist — pricing is per-size */
    var priceDisplay = hasSizes ? '' : '<span class="item-price">$' + (item.price || 0).toFixed(2) + '</span>';
    var modChipsHtml = hasMods ? '<span class="item-mod-chips">' + buildModChipsHtml(item.modifier_group_ids, '', '') + '</span>' : '';

    /* Visibility badge — same system as categories */
    if (item.visibility_mode === undefined) item.visibility_mode = (item.is_available !== false) ? 'show' : 'hide';
    var itemVisIcon, itemVisLabel, itemVisClass, itemVisTitle;
    if (item.visibility_mode === 'hide') {
      itemVisIcon = '○'; itemVisLabel = 'Hidden'; itemVisClass = 'cat-vis-hidden';
      itemVisTitle = 'Hidden';
      if (item.hide_until_date) itemVisTitle += ' until ' + item.hide_until_date.replace('T', ' ');
    } else if (item.visibility_mode === 'scheduled') {
      itemVisIcon = '◐'; itemVisLabel = 'Scheduled'; itemVisClass = 'cat-vis-scheduled';
      itemVisTitle = 'Scheduled';
      if (item.schedule_type === 'time_windows' && item.schedule_time_windows) {
        itemVisTitle += ': ' + item.schedule_time_windows.map(function(w) {
          var days = ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
          return (w.days||[]).map(function(d) { return days[d]; }).join(',') + ' ' + (w.start_time||'') + '-' + (w.end_time||'');
        }).join('; ');
      } else if (item.schedule_type === 'date_range') {
        itemVisTitle += ': ' + (item.schedule_from||'?') + ' to ' + (item.schedule_until||'?');
      }
    } else {
      itemVisIcon = '●'; itemVisLabel = 'Visible'; itemVisClass = 'cat-vis-visible';
      itemVisTitle = 'Always visible';
    }
    var visBadge = '<span class="cat-vis-badge item-vis-badge ' + itemVisClass + '" title="' + esc(itemVisTitle) + '">' + itemVisIcon + '</span>';

    /* OOS (out-of-stock) badge */
    var oosBadge = '';
    if (item.availability === 'out_of_stock') {
      var oosTitle = 'Out of Stock';
      if (item.oos_type === 'tomorrow') oosTitle += ' — until tomorrow';
      else if (item.oos_type === 'date' && item.oos_until) oosTitle += ' — until ' + item.oos_until.replace('T', ' ').slice(0, 16);
      else if (item.oos_type === 'undetermined') oosTitle += ' — undetermined';
      oosBadge = '<span class="oos-badge" title="' + esc(oosTitle) + '">OOS</span>';
    }

    row.innerHTML =
      expandBtn +
      photoHtml +
      '<div class="item-body">' +
        '<div class="item-name">' + esc(item.item_name || 'Untitled') + visBadge + oosBadge + '</div>' +
        '<div class="item-meta">' +
          modChipsHtml +
          priceDisplay +
        '</div>' +
      '</div>' +
      '<div class="item-actions">' +
        '<button class="item-add-size-btn" title="Add Size">📏</button>' +
      '</div>';

    /* Expand toggle — traverse siblings within group */
    if (hasMods || hasSizes) {
      row.querySelector('.item-expand').addEventListener('click', function(e) {
        e.stopPropagation();
        var next = row.nextElementSibling;
        while (next && (next.classList.contains('item-sub-list') || next.classList.contains('item-size-row'))) {
          var isOpen = next.style.display !== 'none';
          next.style.display = isOpen ? 'none' : '';
          next = next.nextElementSibling;
        }
        row.querySelector('.item-expand').textContent = row.querySelector('.item-expand').textContent === '▶' ? '▼' : '▶';
      });
    }

    row.addEventListener('click', function(e) {
      if (e.target.closest('.item-expand') || e.target.closest('.item-add-size-btn') || e.target.closest('.mod-chip')) return;
      openItemDrawer(item.id);
    });

    /* Add-size button on item row → opens add-size modal */
    row.querySelector('.item-add-size-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      openAddSizeModal(item);
    });

    row.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('text/plain', item.id);
      e.dataTransfer.effectAllowed = 'move';
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', function() {
      row.classList.remove('dragging');
      var catList = document.getElementById('menu-cat-list');
      if (catList) catList.querySelectorAll('.category-item').forEach(function(el) { el.classList.remove('drag-over'); });
    });

    group.appendChild(row);

    /* ---- Size sub-rows ---- */
    if (hasSizes) {
      item.sizes.forEach(function(sz, idx) {
        var szRow = document.createElement('div');
        szRow.className = 'item-size-row';
        szRow.dataset.sizeId = sz.id;
        /* Deduplicate: inherited chips exclude groups also owned by the size */
        var ownIds = sz.modifier_group_ids || [];
        var inheritedIds = (item.modifier_group_ids || []).filter(function(id) { return ownIds.indexOf(id) === -1; });
        var inheritedChips = buildModChipsHtml(inheritedIds, 'mod-chip-inherited', '↳ ');
        var ownChips = buildModChipsHtml(ownIds, 'mod-chip-own', '');
        var hasAnyChips = inheritedChips || ownChips;
        var displayMods = hasAnyChips ? '<span class="size-chips">' + inheritedChips + ownChips + '</span>' : '';
        szRow.innerHTML =
          '<span class="size-label">' + esc(sz.label) + '</span>' +
          '<span class="size-price">$' + (sz.price || 0).toFixed(2) + '</span>' +
          displayMods;
        /* Click on size row → open size edit modal */
        szRow.addEventListener('click', function(e) {
          if (e.target.closest('.mod-chip')) return;
          editItemSize(item, idx);
        });
        group.appendChild(szRow);
      });
    }

    /* ---- Sub-rows: modifier options ---- */
    if (hasMods) {
      var subList = document.createElement('div');
      subList.className = 'item-sub-list';
      subList.style.display = 'none';

      item.modifier_group_ids.forEach(function(mgId) {
        var mg = modifierGroups.find(function(g) { return g.id === mgId; });
        if (!mg) return;
        var mgHeader = document.createElement('div');
        mgHeader.className = 'item-sub-header';
        mgHeader.textContent = mg.group_name + ' (' + (mg.selection_type === 'single' ? 'Pick one' : 'Pick any') + ')';
        subList.appendChild(mgHeader);

        (mg.options || []).forEach(function(opt) {
          var optRow = document.createElement('div');
          optRow.className = 'item-sub-row';
          var priceStr = (opt.price && opt.price > 0) ? ' +$' + opt.price.toFixed(2) : '';
          optRow.innerHTML = '<span class="item-sub-name">└ ' + esc(opt.name) + '</span><span class="item-sub-price">' + priceStr + '</span>';
          subList.appendChild(optRow);
        });
      });

      group.appendChild(subList);
    }

    list.appendChild(group);
  });

  /* Event delegation: mod-chip clicks → focus modifier group, ⚙ → override popup */
  list.addEventListener('click', function(e) {
    var settingsIcon = e.target.closest('.mod-chip-inline-settings');
    if (settingsIcon) {
      e.stopPropagation();
      var chip = settingsIcon.closest('.mod-chip');
      var mgId = chip ? chip.dataset.mgId : null;
      if (!mgId) return;
      /* Determine the override target: size or item */
      var sizeRow = chip.closest('.item-size-row');
      if (sizeRow) {
        var itemRow = sizeRow.previousElementSibling;
        while (itemRow && !itemRow.classList.contains('item-row')) itemRow = itemRow.previousElementSibling;
        if (itemRow) {
          var itemId = itemRow.dataset.itemId;
          var it = data.menu.items.find(function(i) { return i.id === itemId; });
          if (it) {
            var sizeId = sizeRow.dataset.sizeId;
            var sz = (it.sizes || []).find(function(s) { return s.id === sizeId; });
            if (sz) { showModOverrideForm(settingsIcon, mgId, function() { return sz; }); return; }
          }
        }
      }
      /* Fallback: item-level override */
      var itemRow2 = chip.closest('.item-row');
      if (itemRow2) {
        var itemId2 = itemRow2.dataset.itemId;
        var it2 = data.menu.items.find(function(i) { return i.id === itemId2; });
        if (it2) { showModOverrideForm(settingsIcon, mgId, function() { return it2; }); return; }
      }
      return;
    }
    var chip = e.target.closest('.mod-chip');
    if (!chip) return;
    e.stopPropagation();
    var mgId = chip.dataset.mgId;
    if (mgId) focusModGroup(mgId);
  });

  grid.appendChild(list);
}

/* ---- Item Drawer ---- */
function openItemDrawer(itemId) {
  _drawerOpen = true;
  editingItemId = itemId;
  var item = data.menu.items.find(function(i) { return i.id === itemId; });
  var panel = document.getElementById('menu-drawer');
  var title = document.getElementById('menu-drawer-title');
  if (panel) panel.style.display = '';
  if (title) title.textContent = item ? 'Edit Item' : 'New Item';
  renderItems(); /* Update highlight on selected row */

  /* Reset advanced settings to collapsed */
  var advBody = document.getElementById('advanced-body');
  var advToggle = document.getElementById('advanced-toggle');
  if (advBody) { advBody.classList.remove('open'); }
  if (advToggle) { advToggle.classList.remove('open'); }

  /* Populate category dropdown */
  var catSelect = document.getElementById('menu-item-category');
  if (catSelect) {
    catSelect.innerHTML = '<option value="">-- Select Category --</option>';
    (data.menu.categories || []).forEach(function(c) {
      catSelect.innerHTML += '<option value="' + c.id + '">' + esc(c.name) + '</option>';
    });
    catSelect.value = item ? (item.category_id || '') : (selectedCategoryId || '');
  }

  if (item) {
    _newItemDraft = null;
    document.getElementById('menu-item-name').value = item.item_name || '';
    document.getElementById('menu-item-slug').value = item.slug || '';
    document.getElementById('menu-item-desc').value = item.description || '';
    document.getElementById('menu-item-price').value = item.price || '';
    document.getElementById('menu-item-sale').value = item.sale_price || '';
    document.getElementById('menu-item-spice').value = item.spice_level || 0;
    document.getElementById('menu-spice-label').textContent = SPICE_NAMES[item.spice_level || 0];
    document.getElementById('menu-item-cal').value = item.calories || '';
    document.getElementById('menu-item-prep').value = item.prep_time_minutes || '';
    /* Populate visibility */
    var visModeEl = document.getElementById('menu-item-vis-mode'); if (visModeEl) visModeEl.value = item.visibility_mode || 'show';
    var hideUntilEl = document.getElementById('menu-item-hide-until'); if (hideUntilEl) hideUntilEl.value = item.hide_until_date || '';
    var schedTypeEl = document.getElementById('menu-item-schedule-type'); if (schedTypeEl) schedTypeEl.value = item.schedule_type || 'time_windows';
    var schedFromEl = document.getElementById('menu-item-sched-from'); if (schedFromEl) schedFromEl.value = item.schedule_from || '';
    var schedUntilEl = document.getElementById('menu-item-sched-until'); if (schedUntilEl) schedUntilEl.value = item.schedule_until || '';
    applyItemVisMode();
    renderItemTimeWindows(item);
    /* Availability */
    var availStatus = document.getElementById('menu-item-avail-status'); if (availStatus) availStatus.value = item.availability || 'available';
    if (item.oos_type) {
      var oosRadio = document.querySelector('input[name="item-oos-type"][value="' + item.oos_type + '"]');
      if (oosRadio) oosRadio.checked = true;
      if (item.oos_until && item.oos_type === 'date') {
        var oosUntil = document.getElementById('menu-item-oos-until'); if (oosUntil) oosUntil.value = item.oos_until.slice(0, 16);
      }
    }
    applyItemOosOptions();
    renderItemChannels(item.show_on_channels || []);
    document.getElementById('menu-item-delete').style.display = '';
    renderItemSizes(item);
    renderPhotoPool(item);
    renderAllergenPicker(item);
    renderDietaryPicker(item);
    renderTagPicker(item);
    renderModGroupCheckboxes();
    /* Tax category */
    populateTaxCategorySelect('menu-item-tax-cat', item.tax_category_id || '');
    /* Ingredients, additives, nutrition */
    document.getElementById('menu-item-ingredients').value = item.ingredients || '';
    document.getElementById('menu-item-additives').value = item.additives || '';
    renderNutritionTable(item);
    /* Special instructions */
    document.getElementById('menu-item-internal-name-toggle').checked = !!item.show_internal_name;
    document.getElementById('menu-item-internal-name').value = item.internal_name || '';
    document.getElementById('item-internal-name-row').style.display = item.show_internal_name ? '' : 'none';
    document.getElementById('menu-item-hide-instructions').checked = !!item.hide_instructions;
  } else {
    /* Create in-memory draft so pickers can modify it before save */
    _newItemDraft = {
      id: null, allergens: [], dietary_marks: [], tags: [], modifier_group_ids: [],
      is_vegetarian: false, is_vegan: false, is_gluten_free: false,
      spice_level: 0, is_available: true, photos: [], sizes: [],
      ingredients: '', additives: '', nutrition: [], nutrition_per: 'serving',
      show_internal_name: false, internal_name: '', hide_instructions: false
    };
    _tempPhotos = [];
    clearItemForm();
    renderItemSizes(null);
    document.getElementById('menu-item-delete').style.display = 'none';
    renderAllergenPicker(_newItemDraft);
    renderDietaryPicker(_newItemDraft);
    renderTagPicker(_newItemDraft);
    renderModGroupCheckboxes();
    /* Tax category — reset for new item */
    populateTaxCategorySelect('menu-item-tax-cat', '');
    renderNutritionTable(_newItemDraft);
  }
  tool.resize();
}

function getEditingItem() {
  if (!editingItemId) return _newItemDraft;
  return data.menu.items.find(function(i) { return i.id === editingItemId; }) || null;
}

function clearItemForm() {
  document.getElementById('menu-item-name').value = '';
  document.getElementById('menu-item-slug').value = '';
  document.getElementById('menu-item-desc').value = '';
  document.getElementById('menu-item-price').value = '';
  document.getElementById('menu-item-sale').value = '';
  document.getElementById('menu-item-spice').value = 0;
  document.getElementById('menu-spice-label').textContent = 'Not Spicy';
  document.getElementById('menu-item-cal').value = '';
  document.getElementById('menu-item-prep').value = '';
  document.getElementById('menu-item-ingredients').value = '';
  document.getElementById('menu-item-additives').value = '';
  /* Reset special instructions */
  document.getElementById('menu-item-internal-name-toggle').checked = false;
  document.getElementById('menu-item-internal-name').value = '';
  document.getElementById('item-internal-name-row').style.display = 'none';
  document.getElementById('menu-item-hide-instructions').checked = false;
  /* Reset visibility to default */
  var visModeEl = document.getElementById('menu-item-vis-mode'); if (visModeEl) visModeEl.value = 'show';
  resetItemVisOptions();
  /* Reset availability */
  var availEl = document.getElementById('menu-item-avail-status'); if (availEl) availEl.value = 'available';
  resetItemOosOptions();
  renderItemChannels([]);
  document.getElementById('menu-photo-pool').innerHTML = '';
  document.getElementById('menu-item-delete').style.display = 'none';
  _tempPhotos = [];
  _newItemDraft = null;
}

/* ---- Item Sizes ---- */
function renderItemSizes(item) {
  var container = document.getElementById('menu-item-sizes-list');
  if (!container) return;
  container.innerHTML = '';
  var sizes = item ? (item.sizes || []) : (_newItemDraft ? (_newItemDraft.sizes || []) : []);
  var priceRow = document.getElementById('menu-item-price').closest('.form-row');
  if (sizes.length > 0) {
    if (priceRow) priceRow.style.display = 'none';
  } else {
    if (priceRow) priceRow.style.display = '';
  }
  var MAX_VISIBLE_MODS = 2; /* Show at most 2 modifier chips, rest as "+N more" */
  sizes.forEach(function(sz, idx) {
    var chip = document.createElement('span');
    chip.className = 'size-chip';
    chip.style.cursor = 'pointer';
    chip.title = 'Click to edit';

    var target = item || _newItemDraft;
    var allModIds = sz.modifier_group_ids || [];
    var visibleIds = allModIds.slice(0, MAX_VISIBLE_MODS);
    var hiddenCount = allModIds.length - MAX_VISIBLE_MODS;

    /* Build visible modifier chips */
    var modChipsHtml = '';
    visibleIds.forEach(function(mgId) {
      var mg = getModGroupById(mgId);
      if (!mg) return;
      var optCount = (mg.options && mg.options.length) ? mg.options.length : 0;
      modChipsHtml += '<span class="mod-chip mod-chip-own mod-chip-xs" data-mg-id="' + mgId + '">' + esc(mg.group_name) + ' (' + optCount + ')<span class="mod-chip-inline-settings">⚙</span></span>';
    });
    if (hiddenCount > 0) {
      modChipsHtml += '<span class="mod-chip-more" title="' + hiddenCount + ' more modifier group(s) — click to edit">+' + hiddenCount + ' more</span>';
    }

    chip.innerHTML = '<span class="size-chip-label">' + esc(sz.label) + '</span>' +
      '<span class="size-chip-price">$' + (sz.price || 0).toFixed(2) + '</span>' +
      (modChipsHtml ? '<span class="size-chip-mods">' + modChipsHtml + '</span>' : '') +
      '<span class="size-chip-remove" data-idx="' + idx + '">✕</span>';

    /* Click chip → edit size */
    chip.addEventListener('click', function(e) {
      if (e.target.classList.contains('size-chip-remove') || e.target.closest('.mod-chip') || e.target.closest('.mod-chip-inline-settings') || e.target.closest('.mod-chip-more')) return;
      editItemSize(item || _newItemDraft, idx);
    });

    /* ✕ remove */
    chip.querySelector('.size-chip-remove').addEventListener('click', function(e) {
      e.stopPropagation();
      var t = item || _newItemDraft;
      if (t && t.sizes) t.sizes.splice(idx, 1);
      renderItemSizes(item || _newItemDraft);
    });

    container.appendChild(chip);
  });
}

var _editingSizeItem = null;
var _editingSizeIdx = -1;
var _addingSizeTarget = null; /* Item we're adding a new size to */
var _tempNewSizeModIds = []; /* Modifier IDs for the size being added */

/* Open modal to ADD a new size to an item */
function openAddSizeModal(item) {
  _addingSizeTarget = item || _newItemDraft;
  _editingSizeItem = null;
  _editingSizeIdx = -1;
  _tempNewSizeModIds = [];
  document.getElementById('menu-size-modal-title').textContent = 'Add Size';
  document.getElementById('menu-size-label').value = '';
  document.getElementById('menu-size-price').value = '';
  document.getElementById('menu-size-delete-btn').style.display = 'none';
  /* Render modifier picker for the new size (no overrides in add mode) */
  renderModChipPicker('menu-size-mg-checkboxes',
    function() { return _tempNewSizeModIds; },
    function(newIds) { _tempNewSizeModIds = newIds; }
  );
  document.getElementById('menu-size-modal').style.display = 'flex';
}

/* Open modal to EDIT an existing size */
function editItemSize(item, idx) {
  _addingSizeTarget = null;
  _editingSizeItem = item;
  _editingSizeIdx = idx;
  var sz = item.sizes[idx];
  document.getElementById('menu-size-modal-title').textContent = 'Edit Size: ' + sz.label;
  document.getElementById('menu-size-label').value = sz.label;
  document.getElementById('menu-size-price').value = sz.price || 0;
  document.getElementById('menu-size-delete-btn').style.display = '';
  renderSizeModCheckboxes(sz);
  document.getElementById('menu-size-modal').style.display = 'flex';
}

function renderSizeModCheckboxes(sz) {
  if (!sz) return;
  /* Ensure modifier_group_ids exists on the size object */
  if (!sz.modifier_group_ids) sz.modifier_group_ids = [];
  renderModChipPicker('menu-size-mg-checkboxes',
    function() { return sz.modifier_group_ids; },
    function(newIds) { sz.modifier_group_ids = newIds; },
    function() { return sz; } /* overrides target is the size object */
  );
}

function saveItemSize() {
  var label = document.getElementById('menu-size-label').value.trim();
  var price = parseFloat(document.getElementById('menu-size-price').value) || 0;
  if (!label) { tool.notify('Enter a size label', 'warning'); return; }

  if (_addingSizeTarget) {
    /* Add mode */
    if (!_addingSizeTarget.sizes) _addingSizeTarget.sizes = [];
    _addingSizeTarget.sizes.push({ id: uid(), label: label, price: price, modifier_group_ids: _tempNewSizeModIds.slice() });
    var t = _addingSizeTarget;
    closeSizeModal();
    renderItemSizes(t);
    renderItems();
    scheduleSave();
    tool.notify('Size added', 'success');
  } else if (_editingSizeItem && _editingSizeIdx >= 0) {
    /* Edit mode */
    var sz = _editingSizeItem.sizes[_editingSizeIdx];
    sz.label = label;
    sz.price = price;
    var targetItem = _editingSizeItem;
    closeSizeModal();
    renderItemSizes(targetItem);
    renderItems();
    scheduleSave();
    tool.notify('Size updated', 'success');
  }
}

function closeSizeModal() {
  document.getElementById('menu-size-modal').style.display = 'none';
  _editingSizeItem = null;
  _editingSizeIdx = -1;
  _addingSizeTarget = null;
  _tempNewSizeModIds = [];
}

/* Show confirmation before deleting a size */
function confirmDeleteItemSize() {
  if (!_editingSizeItem || _editingSizeIdx < 0) return;
  var sz = _editingSizeItem.sizes[_editingSizeIdx];
  document.getElementById('size-delete-modal-name').textContent = '"' + sz.label + '"';
  document.getElementById('size-delete-modal').style.display = 'flex';
}

function deleteItemSizeConfirmed() {
  document.getElementById('size-delete-modal').style.display = 'none';
  if (!_editingSizeItem || _editingSizeIdx < 0) return;
  _editingSizeItem.sizes.splice(_editingSizeIdx, 1);
  var targetItem = _editingSizeItem;
  closeSizeModal();
  renderItemSizes(targetItem);
  renderItems();
  scheduleSave();
  tool.notify('Size deleted', 'info');
}

function cancelDeleteItemSize() {
  document.getElementById('size-delete-modal').style.display = 'none';
}

function closeDrawer() {
  if (!_drawerOpen) return; /* Safety: prevent accidental close */
  _drawerOpen = false;
  document.getElementById('menu-drawer').style.display = 'none';
  editingItemId = null;
  _newItemDraft = null;
  _tempPhotos = [];
  renderItems();
  tool.resize();
}

/* ---- Allergens & Tags ---- */
function renderAllergenPicker(item) {
  var container = document.getElementById('menu-allergen-picker');
  if (!container) return;
  container.innerHTML = '';
  var selected = item ? (item.allergens || []) : [];
  /* Show standard allergen chips */
  ALLERGENS.forEach(function(a) {
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (selected.indexOf(a) !== -1 ? ' active' : '');
    chip.textContent = a;
    chip.addEventListener('click', function() {
      var it = getEditingItem();
      if (!it) return;
      if (!it.allergens) it.allergens = [];
      var idx = it.allergens.indexOf(a);
      if (idx === -1) it.allergens.push(a); else it.allergens.splice(idx, 1);
      renderAllergenPicker(it);
      scheduleSave();
    });
    container.appendChild(chip);
  });
  /* Show custom (non-standard) allergen chips */
  selected.forEach(function(a) {
    if (ALLERGENS.indexOf(a) !== -1) return; /* Already rendered above */
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip active custom-chip';
    chip.innerHTML = a + ' <span style="font-size:10px;opacity:0.7;">✕</span>';
    chip.addEventListener('click', function() {
      var it = getEditingItem();
      if (!it) return;
      if (!it.allergens) it.allergens = [];
      var idx = it.allergens.indexOf(a);
      if (idx !== -1) it.allergens.splice(idx, 1);
      renderAllergenPicker(it);
      scheduleSave();
    });
    container.appendChild(chip);
  });
  /* Clear the custom input */
  var customInput = document.getElementById('menu-allergen-custom');
  if (customInput) customInput.value = '';
}

/* ---- Dietary Marks (chip picker) ---- */
function renderDietaryPicker(item) {
  var container = document.getElementById('menu-dietary-picker');
  if (!container) return;
  container.innerHTML = '';
  var selected = item ? (item.dietary_marks || []) : [];
  /* Migrate old boolean flags to new dietary_marks on first render */
  if (item && (!item.dietary_marks || item.dietary_marks.length === 0)) {
    if (item.is_vegetarian && selected.indexOf('Vegetarian') === -1) selected.push('Vegetarian');
    if (item.is_vegan && selected.indexOf('Vegan') === -1) selected.push('Vegan');
    if (item.is_gluten_free && selected.indexOf('Gluten Free') === -1) selected.push('Gluten Free');
    item.dietary_marks = selected;
  }
  DIETARY_MARKS.forEach(function(m) {
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (selected.indexOf(m) !== -1 ? ' active' : '');
    chip.textContent = m;
    chip.addEventListener('click', function() {
      var it = getEditingItem();
      if (!it) return;
      if (!it.dietary_marks) it.dietary_marks = [];
      var idx = it.dietary_marks.indexOf(m);
      if (idx === -1) it.dietary_marks.push(m); else it.dietary_marks.splice(idx, 1);
      renderDietaryPicker(it);
      scheduleSave();
    });
    container.appendChild(chip);
  });
}

/* ---- Nutrition Table ---- */
function renderNutritionTable(item) {
  var wrap = document.getElementById('menu-nutrition-table');
  if (!wrap) return;
  var nutrition = (item && item.nutrition) ? item.nutrition : [];
  var nutritionPer = (item && item.nutrition_per) ? item.nutrition_per : 'serving';
  var perEl = document.getElementById('menu-item-nutrition-per');
  if (perEl) perEl.value = nutritionPer;

  var sizes = (item && item.sizes) ? item.sizes : [];
  var hasSizes = sizes.length > 0;

  var html = '<table class="nutrition-table"><thead><tr><th>Nutrient</th>';
  if (hasSizes) {
    html += '<th>Default</th>';
    sizes.forEach(function(s) { html += '<th>' + esc(s.label || s.size_name || '?') + '</th>'; });
  } else {
    html += '<th>Value</th>';
  }
  html += '</tr></thead><tbody>';

  NUTRITION_NUTRIENTS.forEach(function(nut) {
    var nutData = nutrition.find(function(n) { return n.name === nut.name; }) || { name: nut.name, value: '', unit: nut.unit, size_values: {} };
    html += '<tr><td>' + nut.name + ' <span class="nutrient-unit">(' + nut.unit + ')</span></td>';
    if (hasSizes) {
      html += '<td><input type="text" class="nutrient-val" data-nutrient="' + nut.name + '" data-size="" value="' + esc(String(nutData.value || '')) + '" placeholder="-"></td>';
      sizes.forEach(function(s) {
        var sv = (nutData.size_values && nutData.size_values[s.id]) ? nutData.size_values[s.id] : '';
        html += '<td><input type="text" class="nutrient-val" data-nutrient="' + nut.name + '" data-size="' + s.id + '" value="' + esc(String(sv)) + '" placeholder="-"></td>';
      });
    } else {
      html += '<td><input type="text" class="nutrient-val" data-nutrient="' + nut.name + '" data-size="" value="' + esc(String(nutData.value || '')) + '" placeholder="-"></td>';
    }
    html += '</tr>';
  });

  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function collectNutritionData() {
  var nutrition = [];
  var nutritionPer = document.getElementById('menu-item-nutrition-per') ? document.getElementById('menu-item-nutrition-per').value : 'serving';
  NUTRITION_NUTRIENTS.forEach(function(nut) {
    var nd = { name: nut.name, unit: nut.unit, value: '', size_values: {} };
    var inputs = document.querySelectorAll('.nutrient-val[data-nutrient="' + nut.name + '"]');
    inputs.forEach(function(inp) {
      var sizeId = inp.dataset.size || '';
      var val = inp.value.trim();
      if (sizeId === '') { nd.value = val; }
      else { nd.size_values[sizeId] = val; }
    });
    nutrition.push(nd);
  });
  return { nutrition_per: nutritionPer, nutrition: nutrition };
}

function renderTagPicker(item) {
  var container = document.getElementById('menu-tag-picker');
  if (!container) return;
  container.innerHTML = '';
  var selected = item ? (item.tags || []) : [];
  TAGS.forEach(function(t) {
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (selected.indexOf(t) !== -1 ? ' active' : '');
    chip.textContent = t;
    chip.addEventListener('click', function() {
      var it = getEditingItem();
      if (!it) return;
      if (!it.tags) it.tags = [];
      var idx = it.tags.indexOf(t);
      if (idx === -1) it.tags.push(t); else it.tags.splice(idx, 1);
      renderTagPicker(it);
      scheduleSave();
    });
    container.appendChild(chip);
  });
}

/* ---- Photos (unified gallery with primary selection) ---- */
function getPhotoArray(item) {
  if (item) return (item.photos || []);
  return _tempPhotos;
}

function setPhotoArray(item, arr) {
  if (item) { item.photos = arr; }
  else { _tempPhotos = arr; }
}

function getPrimaryPhoto(item) {
  if (item) return item.primary_photo_url || null;
  return _tempPhotos.length > 0 ? _tempPhotos[0] : null;
}

function setPrimaryPhoto(item, url) {
  if (item) { item.primary_photo_url = url; }
}

function renderPhotoPool(item) {
  var pool = document.getElementById('menu-photo-pool');
  if (!pool) return;
  pool.innerHTML = '';
  var photos = getPhotoArray(item);
  if (photos.length === 0) return;
  var primary = getPrimaryPhoto(item);
  photos.forEach(function(url, idx) {
    var el = document.createElement('div');
    el.className = 'photo-pool-item' + (url === primary || (idx === 0 && !primary) ? ' primary' : '');
    el.draggable = true;
    var isPrimary = (url === primary || (idx === 0 && !primary));
    el.innerHTML = '<img src="' + url + '" alt="">' +
      (isPrimary ? '<span class="pool-primary-badge" title="Primary photo — shown in listings">★</span><span class="pool-primary-label">Primary</span>' : '') +
      '<span class="pool-set-primary" title="Set as primary">★</span>' +
      '<span class="pool-delete" title="Remove">✕</span>';

    /* Click "set primary" overlay to set as primary */
    if (!isPrimary && item) {
      el.querySelector('.pool-set-primary').addEventListener('click', function(e) {
        e.stopPropagation();
        item.primary_photo_url = url;
        renderPhotoPool(item);
        scheduleSave();
      });
    }

    /* Right-click context menu to set as primary */
    el.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      if (item) {
        item.primary_photo_url = url;
        renderPhotoPool(item);
        scheduleSave();
        tool.notify('Set as primary photo', 'success');
      }
    });

    /* Delete photo */
    el.querySelector('.pool-delete').addEventListener('click', function(e) {
      e.stopPropagation();
      var arr = getPhotoArray(item);
      arr.splice(idx, 1);
      if (item) {
        if (item.primary_photo_url === url) item.primary_photo_url = arr.length > 0 ? arr[0] : null;
        scheduleSave();
      }
      if (arr.length === 0) setPrimaryPhoto(item, null);
      renderPhotoPool(item);
      renderItems();
    });

    /* Drag to reorder */
    el.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('text/plain', String(idx));
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', function() { el.classList.remove('dragging'); });
    el.addEventListener('dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    el.addEventListener('drop', function(e) {
      e.preventDefault();
      var fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      if (isNaN(fromIdx) || fromIdx === idx) return;
      var arr = getPhotoArray(item);
      var moved = arr.splice(fromIdx, 1)[0];
      arr.splice(idx, 0, moved);
      if (item) scheduleSave();
      renderPhotoPool(item);
    });

    pool.appendChild(el);
  });
}

function handlePhotoUpload() {
  var item = getEditingItem();
  tool.requestUpload('image/*', function(err, file) {
    if (err || !file) { if (err) tool.notify('Upload failed: ' + err, 'error'); return; }
    var url = file.url;
    if (!item) {
      /* New item: add to temp photos */
      _tempPhotos.push(url);
      renderPhotoPool(null);
      return;
    }
    /* Existing item */
    if (!item.photos) item.photos = [];
    if (item.photos.indexOf(url) === -1) item.photos.push(url);
    if (!item.primary_photo_url) item.primary_photo_url = url;
    renderPhotoPool(item);
    renderItems();
    scheduleSave();
  });
}

/* ---- Category Photo Pool (like items but separate state) ---- */
function getCatPhotoArray(cat) {
  if (cat) return (cat.photos || []);
  return _tempCatPhotos;
}

function getCatPrimaryPhoto(cat) {
  if (cat) return cat.primary_photo_url || null;
  return _tempCatPhotos.length > 0 ? _tempCatPhotos[0] : null;
}

function renderCatPhotoPool(cat) {
  var pool = document.getElementById('menu-cat-photo-pool');
  if (!pool) return;
  pool.innerHTML = '';
  var photos = getCatPhotoArray(cat);
  if (photos.length === 0) return;
  var primary = getCatPrimaryPhoto(cat);
  photos.forEach(function(url, idx) {
    var el = document.createElement('div');
    el.className = 'photo-pool-item' + (url === primary || (idx === 0 && !primary) ? ' primary' : '');
    el.draggable = true;
    var isPrimary = (url === primary || (idx === 0 && !primary));
    el.innerHTML = '<img src="' + url + '" alt="">' +
      (isPrimary ? '<span class="pool-primary-badge" title="Primary photo">★</span><span class="pool-primary-label">Primary</span>' : '') +
      '<span class="pool-set-primary" title="Set as primary">★</span>' +
      '<span class="pool-delete" title="Remove">✕</span>';

    if (!isPrimary && cat) {
      el.querySelector('.pool-set-primary').addEventListener('click', function(e) {
        e.stopPropagation();
        cat.primary_photo_url = url;
        renderCatPhotoPool(cat);
        scheduleSave();
      });
    }
    el.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      if (cat) { cat.primary_photo_url = url; renderCatPhotoPool(cat); scheduleSave(); tool.notify('Set as primary photo', 'success'); }
    });
    el.querySelector('.pool-delete').addEventListener('click', function(e) {
      e.stopPropagation();
      var arr = getCatPhotoArray(cat);
      arr.splice(idx, 1);
      if (cat) { if (cat.primary_photo_url === url) cat.primary_photo_url = arr.length > 0 ? arr[0] : null; scheduleSave(); }
      renderCatPhotoPool(cat);
    });
    /* Drag to reorder */
    el.addEventListener('dragstart', function(e) { e.dataTransfer.setData('text/plain', String(idx)); el.classList.add('dragging'); });
    el.addEventListener('dragend', function() { el.classList.remove('dragging'); });
    el.addEventListener('dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    el.addEventListener('drop', function(e) {
      e.preventDefault();
      var fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      if (isNaN(fromIdx) || fromIdx === idx) return;
      var arr = getCatPhotoArray(cat);
      var moved = arr.splice(fromIdx, 1)[0];
      arr.splice(idx, 0, moved);
      if (cat) scheduleSave();
      renderCatPhotoPool(cat);
    });
    pool.appendChild(el);
  });
}

function handleCatPhotoUpload() {
  var cat = editingCategoryId ? data.menu.categories.find(function(c) { return c.id === editingCategoryId; }) : null;
  tool.requestUpload('image/*', function(err, file) {
    if (err || !file) { if (err) tool.notify('Upload failed: ' + err, 'error'); return; }
    var url = file.url;
    if (!cat) {
      _tempCatPhotos.push(url);
      renderCatPhotoPool(null);
      return;
    }
    if (!cat.photos) cat.photos = [];
    if (cat.photos.indexOf(url) === -1) cat.photos.push(url);
    if (!cat.primary_photo_url) cat.primary_photo_url = url;
    renderCatPhotoPool(cat);
    scheduleSave();
  });
}

/* ---- Single Photo Helpers (modifier group & option) ---- */
function renderSinglePhoto(areaId, photoUrl, onRemove) {
  var area = document.getElementById(areaId);
  if (!area) return;
  area.innerHTML = '';
  if (!photoUrl) return;
  var el = document.createElement('div');
  el.className = 'single-photo-thumb';
  el.innerHTML = '<img src="' + photoUrl + '" alt=""><span class="single-photo-remove" title="Remove photo">✕</span>';
  el.querySelector('.single-photo-remove').addEventListener('click', function(e) {
    e.stopPropagation();
    if (onRemove) onRemove();
  });
  area.appendChild(el);
}

function handleSinglePhotoUpload(requestUploadFn, areaId, getPhotoFn, setPhotoFn) {
  tool.requestUpload('image/*', function(err, file) {
    if (err || !file) { if (err) tool.notify('Upload failed: ' + err, 'error'); return; }
    setPhotoFn(file.url);
    renderSinglePhoto(areaId, getPhotoFn(), function() { setPhotoFn(null); renderSinglePhoto(areaId, null, null); scheduleSave(); });
    scheduleSave();
  });
}

/* ---- Save / Delete Item ---- */
function saveItem() {
  var name = document.getElementById('menu-item-name').value.trim();
  var price = parseFloat(document.getElementById('menu-item-price').value);
  if (!name) { tool.notify('Item name is required', 'warning'); return; }
  if (isNaN(price) || price < 0) { tool.notify('Valid price is required', 'warning'); return; }

  var catSelect = document.getElementById('menu-item-category');
  var categoryId = catSelect ? (catSelect.value || null) : (selectedCategoryId || null);

  if (editingItemId) {
    /* Update existing item */
    var item = data.menu.items.find(function(i) { return i.id === editingItemId; });
    if (item) {
      item.category_id = categoryId;
      item.item_name = name; item.slug = slugify(name);
      item.description = document.getElementById('menu-item-desc').value;
      item.price = price; item.sale_price = parseFloat(document.getElementById('menu-item-sale').value) || null;
      /* Dietary marks (from chip picker, also set legacy booleans) */
      var dmarks = item.dietary_marks || [];
      item.is_vegetarian = dmarks.indexOf('Vegetarian') !== -1;
      item.is_vegan = dmarks.indexOf('Vegan') !== -1;
      item.is_gluten_free = dmarks.indexOf('Gluten Free') !== -1;
      item.spice_level = parseInt(document.getElementById('menu-item-spice').value);
      item.calories = parseInt(document.getElementById('menu-item-cal').value) || null;
      item.prep_time_minutes = parseInt(document.getElementById('menu-item-prep').value) || null;
      /* Ingredients & additives */
      item.ingredients = document.getElementById('menu-item-ingredients').value;
      item.additives = document.getElementById('menu-item-additives').value;
      /* Nutrition */
      var nutData = collectNutritionData();
      item.nutrition_per = nutData.nutrition_per;
      item.nutrition = nutData.nutrition;
      /* Special instructions */
      item.show_internal_name = document.getElementById('menu-item-internal-name-toggle').checked;
      item.internal_name = item.show_internal_name ? document.getElementById('menu-item-internal-name').value.trim() : '';
      item.hide_instructions = document.getElementById('menu-item-hide-instructions').checked;
      /* Visibility */
      var itemVis = collectItemVisibility();
      item.visibility_mode = itemVis.visibility_mode;
      item.hide_until_date = itemVis.hide_until_date || null;
      item.schedule_type = itemVis.schedule_type || null;
      item.schedule_time_windows = itemVis.schedule_time_windows || null;
      item.schedule_from = itemVis.schedule_from || null;
      item.schedule_until = itemVis.schedule_until || null;
      /* Availability */
      item.availability = document.getElementById('menu-item-avail-status').value;
      item.show_on_channels = collectItemChannels();
      item.tax_category_id = document.getElementById('menu-item-tax-cat') ? (document.getElementById('menu-item-tax-cat').value || null) : null;
      var oosData = collectItemOosData();
      if (oosData) { item.oos_type = oosData.oos_type; item.oos_until = oosData.oos_until; }
      else { item.oos_type = null; item.oos_until = null; }
      /* Sizes are already in item.sizes (modified by renderItemSizes/addItemSize) */
    }
  } else {
    /* Build new item from form + draft picker data */
    var primaryUrl = _tempPhotos.length > 0 ? _tempPhotos[0] : (_newItemDraft && _newItemDraft.photos ? _newItemDraft.photos[0] : null);
    var draft = _newItemDraft || {};
    var itemVis = collectItemVisibility();
    var newItem = {
      id: uid(), category_id: categoryId,
      item_name: name, slug: slugify(name),
      description: document.getElementById('menu-item-desc').value,
      price: price, sale_price: parseFloat(document.getElementById('menu-item-sale').value) || null,
      primary_photo_url: primaryUrl,
      photos: _tempPhotos.length > 0 ? _tempPhotos.slice() : (draft.photos || []),
      allergens: draft.allergens || [],
      dietary_marks: draft.dietary_marks || [],
      is_vegetarian: (draft.dietary_marks || []).indexOf('Vegetarian') !== -1,
      is_vegan: (draft.dietary_marks || []).indexOf('Vegan') !== -1,
      is_gluten_free: (draft.dietary_marks || []).indexOf('Gluten Free') !== -1,
      spice_level: parseInt(document.getElementById('menu-item-spice').value),
      calories: parseInt(document.getElementById('menu-item-cal').value) || null,
      prep_time_minutes: parseInt(document.getElementById('menu-item-prep').value) || null,
      ingredients: document.getElementById('menu-item-ingredients').value,
      additives: document.getElementById('menu-item-additives').value,
      nutrition_per: (draft.nutrition_per) || 'serving',
      nutrition: (draft.nutrition && draft.nutrition.length > 0) ? draft.nutrition : [],
      tags: draft.tags || [],
      modifier_group_ids: draft.modifier_group_ids || [],
      sizes: draft.sizes || [],
      visibility_mode: itemVis.visibility_mode,
      hide_until_date: itemVis.hide_until_date || null,
      schedule_type: itemVis.schedule_type || null,
      schedule_time_windows: itemVis.schedule_time_windows || null,
      schedule_from: itemVis.schedule_from || null,
      schedule_until: itemVis.schedule_until || null,
      availability: document.getElementById('menu-item-avail-status').value,
      show_on_channels: collectItemChannels(),
      tax_category_id: document.getElementById('menu-item-tax-cat') ? (document.getElementById('menu-item-tax-cat').value || null) : null,
      show_internal_name: document.getElementById('menu-item-internal-name-toggle').checked,
      internal_name: document.getElementById('menu-item-internal-name-toggle').checked ? document.getElementById('menu-item-internal-name').value.trim() : '',
      hide_instructions: document.getElementById('menu-item-hide-instructions').checked
    };
    var oosData = collectItemOosData();
    if (oosData) { newItem.oos_type = oosData.oos_type; newItem.oos_until = oosData.oos_until; }
    data.menu.items.push(newItem);
    editingItemId = newItem.id;
    _newItemDraft = null;
    _tempPhotos = [];
  }
  closeDrawer();
  renderItems();
  renderCategories();
  scheduleSave();
  tool.notify('Item saved', 'success');
}

function deleteItem() {
  if (!editingItemId) return;
  data.menu.items = data.menu.items.filter(function(i) { return i.id !== editingItemId; });
  closeDrawer();
  renderItems();
  renderCategories();
  scheduleSave();
  tool.notify('Item deleted', 'info');
}

/* ---- Copy / Paste Item ---- */
var _copiedItem = null;

function copyItem() {
  var item = getEditingItem();
  if (!item) { tool.notify('No item to copy', 'warning'); return; }
  _copiedItem = JSON.parse(JSON.stringify(item));
  /* Clear ID so paste creates a new one */
  delete _copiedItem.id;
  delete _copiedItem.slug;
  tool.notify('Item "' + (item.item_name || 'Untitled') + '" copied to clipboard', 'success');
}

function pasteItem() {
  if (!_copiedItem) { tool.notify('Nothing to paste. Copy an item first.', 'warning'); return; }
  var catSelect = document.getElementById('menu-item-category');
  var targetCat = catSelect ? (catSelect.value || selectedCategoryId || null) : (selectedCategoryId || null);
  var newItem = JSON.parse(JSON.stringify(_copiedItem));
  newItem.id = uid();
  newItem.category_id = targetCat;
  newItem.slug = slugify(newItem.item_name || 'item');
  /* Ensure unique name */
  var base = newItem.item_name || 'Copied Item';
  var nameTry = base;
  var counter = 1;
  while (data.menu.items.some(function(i) { return i.item_name === nameTry; })) {
    counter++;
    nameTry = base + ' (' + counter + ')';
  }
  newItem.item_name = nameTry;
  data.menu.items.push(newItem);
  editingItemId = newItem.id;
  /* Refresh drawer with pasted item */
  openItemDrawer(newItem.id);
  renderItems();
  renderCategories();
  scheduleSave();
  tool.notify('Item pasted', 'success');
}

/* ---- Drag & Drop: items to categories ---- */
function initCategoryDropTargets() {
  var catList = document.getElementById('menu-cat-list');
  if (!catList) return;

  catList.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    var catEl = e.target.closest('.category-item');
    catList.querySelectorAll('.category-item').forEach(function(el) { el.classList.remove('drag-over'); });
    if (catEl) catEl.classList.add('drag-over');
  });
  catList.addEventListener('dragleave', function(e) {
    var catEl = e.target.closest('.category-item');
    if (catEl) catEl.classList.remove('drag-over');
  });
  catList.addEventListener('drop', function(e) {
    e.preventDefault();
    var catEl = e.target.closest('.category-item');
    catList.querySelectorAll('.category-item').forEach(function(el) { el.classList.remove('drag-over'); });
    if (!catEl) return;
    var itemId = e.dataTransfer.getData('text/plain');
    var targetCatId = catEl.dataset.catId;
    if (!itemId || !targetCatId) return;
    var item = data.menu.items.find(function(i) { return i.id === itemId; });
    if (item) {
      item.category_id = targetCatId;
      renderItems();
      renderCategories();
      scheduleSave();
      tool.notify('Item moved to category', 'success');
    }
  });
}

/* ---- Drag & Drop: modifiers to items ---- */
function initModifierDragDrop() {
  /* Make modifier group items draggable */
  document.addEventListener('dragstart', function(e) {
    var mgEl = e.target.closest('.modgroup-item');
    if (mgEl) {
      e.dataTransfer.setData('application/x-modgroup', mgEl.dataset.mgId);
      e.dataTransfer.effectAllowed = 'link';
    }
  });

  /* Item rows AND size rows accept modifier drops */
  var grid = document.getElementById('menu-items-grid');
  if (grid) {
    grid.addEventListener('dragover', function(e) {
      var row = e.target.closest('.item-row') || e.target.closest('.item-size-row');
      if (!row || e.dataTransfer.types.indexOf('application/x-modgroup') === -1) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'link';
    });
    grid.addEventListener('drop', function(e) {
      var row = e.target.closest('.item-row');
      var sizeRow = e.target.closest('.item-size-row');
      if (!row && !sizeRow) return;
      var mgId = e.dataTransfer.getData('application/x-modgroup');
      if (!mgId) return;
      e.preventDefault();

      if (sizeRow) {
        /* Drop on a size row — add modifier group to that size */
        var sizeId = sizeRow.dataset.sizeId;
        var itemId = sizeRow.closest('.item-row')?.dataset.itemId;
        if (!itemId || !sizeId) return;
        var item = data.menu.items.find(function(i) { return i.id === itemId; });
        if (!item || !item.sizes) return;
        var size = item.sizes.find(function(s) { return s.id === sizeId; });
        if (!size) return;
        if (!size.modifier_group_ids) size.modifier_group_ids = [];
        if (size.modifier_group_ids.indexOf(mgId) === -1) {
          size.modifier_group_ids.push(mgId);
          renderItems();
          scheduleSave();
          tool.notify('Modifier added to size', 'success');
        }
      } else if (row) {
        /* Drop on main item row */
        var itemId = row.dataset.itemId;
        var item = data.menu.items.find(function(i) { return i.id === itemId; });
        if (!item) return;
        if (!item.modifier_group_ids) item.modifier_group_ids = [];
        if (item.modifier_group_ids.indexOf(mgId) === -1) {
          item.modifier_group_ids.push(mgId);
          renderItems();
          scheduleSave();
          tool.notify('Modifier added to item', 'success');
        }
      }
    });
  }
}



/* ===================================================================== */
/* INIT EVENT DELEGATION */
/* ===================================================================== */
function initAllEvents() {
  /* Tab Navigation */
  document.querySelectorAll('.main-tab').forEach(function(tab) {
    tab.addEventListener('click', function() { switchTab(tab.dataset.tab); });
  });

  /* Sub-tab Navigation (Delivery) */
  document.querySelectorAll('#delivery-subtabs .sub-tab').forEach(function(st) {
    st.addEventListener('click', function() { switchSubTab('delivery', st.dataset.subtab); });
  });

  /* General Info: data-path inputs */
  document.querySelectorAll('[data-path]').forEach(function(el) {
    if (el.closest('[data-tab="menu"]') || el.closest('[data-tab="delivery"]')) return;
    if (el.type === 'checkbox') {
      el.addEventListener('change', function() {
        setNested(data, el.dataset.path, el.checked);
        scheduleSave();
        handleConditionalDisplays();
      });
    } else if (el.type === 'radio') {
      el.addEventListener('change', function() {
        if (el.checked) { setNested(data, el.dataset.path, el.value); scheduleSave(); }
      });
    } else if (el.type === 'number') {
      el.addEventListener('input', function() {
        setNested(data, el.dataset.path, parseFloat(el.value) || 0);
        scheduleSave();
      });
    } else if (el.tagName === 'SELECT') {
      el.addEventListener('change', function() {
        setNested(data, el.dataset.path, el.value);
        scheduleSave();
        handleConditionalDisplays();
      });
    } else {
      el.addEventListener('input', function() {
        setNested(data, el.dataset.path, el.value);
        scheduleSave();
      });
    }
  });

  /* General Info: logo upload via CMS */
  var logoUploadBtn = document.getElementById('gen-logo-upload-btn');
  if (logoUploadBtn) {
    logoUploadBtn.addEventListener('click', function() {
      tool.requestUpload('image/*', function(err, file) {
        if (err || !file) { if (err) tool.notify('Logo upload failed: ' + err, 'error'); return; }
        setNested(data, 'general_info.logo_url', file.url);
        document.getElementById('gen-logo-url').value = file.url;
        renderLogoPreview();
        scheduleSave();
        tool.notify('Logo uploaded: ' + file.name, 'success');
      });
    });
  }

  /* General Info: add cuisine */
  var addCuisineBtn = document.getElementById('gen-add-cuisine-btn');
  if (addCuisineBtn) addCuisineBtn.addEventListener('click', addCustomCuisine);
  var cuisineCustomInput = document.getElementById('gen-cuisine-custom');
  if (cuisineCustomInput) {
    cuisineCustomInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); addCustomCuisine(); }
    });
  }

  /* General Info: phone add button */
  var phoneAddBtn = document.getElementById('gen-phone-add-btn');
  if (phoneAddBtn) phoneAddBtn.addEventListener('click', addExtraPhone);

  /* General Info: country change -> re-render state dropdown */
  var countrySel = document.getElementById('gen-address-country');
  if (countrySel) {
    countrySel.addEventListener('change', function() {
      setNested(data, 'general_info.address.country', this.value);
      setNested(data, 'general_info.address.state', '');
      renderStateDropdown();
      renderLegalFields();
      scheduleSave();
    });
  }

  /* General Info: legal advanced toggle */
  var legalAdvBtn = document.getElementById('gen-legal-advanced-btn');
  if (legalAdvBtn) legalAdvBtn.addEventListener('click', toggleLegalAdvanced);

  /* General Info: copy restaurant address to legal address */
  var copyAddrBtn = document.getElementById('gen-legal-copy-addr');
  if (copyAddrBtn) {
    copyAddrBtn.addEventListener('click', function() {
      var src = data.general_info.address || {};
      if (!data.general_info.legal.legal_address) data.general_info.legal.legal_address = {};
      var dest = data.general_info.legal.legal_address;
      dest.street = src.street || '';
      dest.city = src.city || '';
      dest.state = src.state || '';
      dest.zip = src.zip || '';
      dest.country = src.country || '';
      /* Populate form fields */
      ['street','city','state','zip','country'].forEach(function(f) {
        var el = document.getElementById('gen-legal-addr-' + f);
        if (el) el.value = dest[f] || '';
      });
      scheduleSave();
      tool.notify('Legal address copied from restaurant', 'success');
    });
  }

  /* General Info: logo URL manual input */
  var logoUrlInput = document.getElementById('gen-logo-url');
  if (logoUrlInput) {
    logoUrlInput.addEventListener('input', function() {
      setNested(data, 'general_info.logo_url', this.value);
      renderLogoPreview();
      scheduleSave();
    });
  }

  /* Tax: add category */
  var addTaxBtn = document.getElementById('tax-add-cat');
  if (addTaxBtn) addTaxBtn.addEventListener('click', addTaxCategory);

  /* Devices */
  var devConnectBtn = document.getElementById('dev-connect-btn');
  if (devConnectBtn) devConnectBtn.addEventListener('click', function() {
    document.getElementById('dev-connect-panel').style.display = '';
    tool.resize();
  });
  var devConfirmBtn = document.getElementById('dev-confirm-connect');
  if (devConfirmBtn) devConfirmBtn.addEventListener('click', connectDevice);
  var devCancelBtn = document.getElementById('dev-cancel-connect');
  if (devCancelBtn) devCancelBtn.addEventListener('click', function() {
    document.getElementById('dev-connect-panel').style.display = 'none';
    tool.resize();
  });

  /* Zones: add button */
  document.getElementById('zone-add-btn').addEventListener('click', function() {
    zoneEditingIndex = -1;
    document.getElementById('zone-form-title').textContent = 'New Delivery Zone';
    document.getElementById('zone-name').value = '';
    document.getElementById('zone-min-order').value = '0';
    document.getElementById('zone-fee').value = '0';
    document.getElementById('zone-color').value = '#4f46e5';
    var swatch = document.getElementById('zone-color-swatch');
    var hexEl = document.getElementById('zone-color-hex');
    if (swatch) swatch.style.background = '#4f46e5';
    if (hexEl) hexEl.textContent = '#4f46e5';
    document.getElementById('zone-form').style.display = '';
    /* Hide delete button when adding new zone */
    var deleteFormBtn = document.getElementById('zone-delete-form-btn');
    if (deleteFormBtn) deleteFormBtn.style.display = 'none';
    /* Hide shapes section when adding new zone */
    document.getElementById('zone-shapes-section').style.display = 'none';
    document.getElementById('zone-shapes-list').innerHTML = '';
    /* Remove any orphan drawings from previous cancelled sessions */
    removeOrphanDrawings();
    /* Activate polygon drawing by default */
    activateZoneDraw('polygon');
    /* Highlight the polygon button */
    document.querySelectorAll('.zone-draw-btn').forEach(function(b) { b.classList.remove('active'); });
    var polyBtn = document.querySelector('.zone-draw-btn[data-shape="polygon"]');
    if (polyBtn) polyBtn.classList.add('active');
    renderZonesList();
    tool.resize();
  });
  document.getElementById('zone-save-btn').addEventListener('click', saveZone);
  document.getElementById('zone-cancel-btn').addEventListener('click', clearZoneForm);
  document.getElementById('zone-delete-form-btn').addEventListener('click', confirmDeleteZone);
  document.getElementById('zone-delete-confirm-btn').addEventListener('click', deleteZoneConfirmed);
  document.getElementById('zone-delete-cancel-btn').addEventListener('click', cancelZoneDelete);

  /* Shape delete modal */
  document.getElementById('shape-delete-confirm-btn').addEventListener('click', removeShapeConfirmed);
  document.getElementById('shape-delete-cancel-btn').addEventListener('click', cancelShapeDelete);

  /* Delivery settings */
  document.getElementById('delivery-outside-zone').addEventListener('change', function() {
    data.delivery_form_settings.accept_orders_outside_zone = this.checked;
    scheduleSave();
  });
  document.getElementById('delivery-custom-field-add-btn').addEventListener('click', addDeliveryCustomField);
  document.getElementById('delivery-custom-field-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); addDeliveryCustomField(); }
  });

  /* Zones: embedded draw tool buttons */
  document.querySelectorAll('.zone-draw-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var shape = btn.dataset.shape;
      document.querySelectorAll('.zone-draw-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activateZoneDraw(shape);
    });
  });
  document.querySelector('.zone-draw-clear').addEventListener('click', function() {
    deactivateZoneDraw();
    removeOrphanDrawings();
  });

  /* Zones: color picker sync */
  var zoneColorInput = document.getElementById('zone-color');
  var zoneColorSwatch = document.getElementById('zone-color-swatch');
  var zoneColorHex = document.getElementById('zone-color-hex');
  if (zoneColorInput && zoneColorSwatch) {
    zoneColorInput.addEventListener('input', function() {
      zoneColorSwatch.style.background = this.value;
      if (zoneColorHex) zoneColorHex.textContent = this.value;
    });
    zoneColorSwatch.addEventListener('click', function() {
      zoneColorInput.click();
    });
  }

  /* Menu: Panel Tabs */
  document.querySelectorAll('.panel-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.panel-tab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelectorAll('.panel-content').forEach(function(c) { c.classList.remove('active'); });
      tab.classList.add('active');
      var target = document.querySelector('[data-panel-content="' + tab.dataset.panelTab + '"]');
      if (target) target.classList.add('active');
      if (tab.dataset.panelTab === 'modifier-groups') renderModGroups();
    });
  });

  /* Menu: Categories */
  document.getElementById('menu-add-cat').addEventListener('click', addCategory);
  var catSaveBtn = document.getElementById('menu-cat-save'); if (catSaveBtn) catSaveBtn.addEventListener('click', saveCategory);
  var catCancelBtn = document.getElementById('menu-cat-cancel'); if (catCancelBtn) catCancelBtn.addEventListener('click', closeCategoryForm);
  document.getElementById('menu-cat-name').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); saveCategory(); }
  });
  document.getElementById('menu-cat-name').addEventListener('input', updateCatCharCounts);
  document.getElementById('menu-cat-desc').addEventListener('input', updateCatCharCounts);
  var dupBtn = document.getElementById('menu-cat-duplicate'); if (dupBtn) dupBtn.addEventListener('click', duplicateCategory);
  var delBtn = document.getElementById('menu-cat-delete-btn'); if (delBtn) delBtn.addEventListener('click', confirmDeleteCategory);
  /* Category delete modal */
  var catDelConfirm = document.getElementById('cat-delete-confirm-btn'); if (catDelConfirm) catDelConfirm.addEventListener('click', deleteCategoryConfirmed);
  var catDelCancel = document.getElementById('cat-delete-cancel-btn'); if (catDelCancel) catDelCancel.addEventListener('click', cancelCategoryDelete);

  /* Category visibility mode listeners */
  var catVisMode = document.getElementById('menu-cat-vis-mode');
  if (catVisMode) catVisMode.addEventListener('change', applyCatVisMode);
  var catHideRadios = document.querySelectorAll('input[name="cat-hide-type"]');
  catHideRadios.forEach(function(r) { r.addEventListener('change', applyCatVisMode); });
  var catSchedType = document.getElementById('menu-cat-schedule-type');
  if (catSchedType) catSchedType.addEventListener('change', applyCatVisMode);
  /* Category photo upload */
  var catPhotoBtn = document.getElementById('menu-cat-photo-upload-btn');
  if (catPhotoBtn) catPhotoBtn.addEventListener('click', handleCatPhotoUpload);

  /* Menu: Items */
  document.getElementById('menu-add-item-btn').addEventListener('click', function() { openItemDrawer(null); });

  /* Menu: Modifier Groups */
  document.getElementById('menu-mg-add').addEventListener('click', addModGroup);
  document.getElementById('menu-mg-save').addEventListener('click', saveModGroup);
  document.getElementById('menu-mg-cancel').addEventListener('click', closeModGroupModal);
  document.getElementById('menu-mg-delete-btn').addEventListener('click', confirmDeleteModGroup);
  document.getElementById('mg-delete-confirm-btn').addEventListener('click', deleteModGroupConfirmed);
  document.getElementById('mg-delete-cancel-btn').addEventListener('click', cancelDeleteModGroup);
  /* Modifier group photo upload */
  var mgPhotoBtn = document.getElementById('menu-mg-photo-upload-btn');
  if (mgPhotoBtn) mgPhotoBtn.addEventListener('click', function() {
    handleSinglePhotoUpload(
      tool.requestUpload, 'menu-mg-photo-area',
      function() { return _tempMgPhoto; },
      function(url) { _tempMgPhoto = url; }
    );
  });
  document.getElementById('menu-mg-opt-save').addEventListener('click', saveModOption);
  document.getElementById('menu-mg-opt-cancel').addEventListener('click', closeModOptionModal);
  document.getElementById('menu-mg-opt-delete-btn').addEventListener('click', confirmDeleteModOption);
  document.getElementById('mg-opt-delete-confirm-btn').addEventListener('click', deleteModOptionConfirmed);
  document.getElementById('mg-opt-delete-cancel-btn').addEventListener('click', cancelDeleteModOption);
  /* Modifier option availability toggle */
  var optAvailEl = document.getElementById('menu-mg-opt-avail');
  if (optAvailEl) optAvailEl.addEventListener('change', applyOptOosOptions);
  document.querySelectorAll('input[name="opt-oos-type"]').forEach(function(r) {
    r.addEventListener('change', applyOptOosOptions);
  });
  /* Modifier option photo upload */
  var optPhotoBtn = document.getElementById('menu-mg-opt-photo-upload-btn');
  if (optPhotoBtn) optPhotoBtn.addEventListener('click', function() {
    handleSinglePhotoUpload(
      tool.requestUpload, 'menu-mg-opt-photo-area',
      function() { return _tempOptPhoto; },
      function(url) { _tempOptPhoto = url; }
    );
  });
  /* Modifier option internal name toggle */
  var optInternalToggle = document.getElementById('menu-mg-opt-internal-name-toggle');
  if (optInternalToggle) optInternalToggle.addEventListener('change', function() {
    document.getElementById('mg-opt-internal-name-row').style.display = this.checked ? '' : 'none';
  });

  /* ---- Item internal name toggle & hide instructions ---- */
  var itemInternalToggle = document.getElementById('menu-item-internal-name-toggle');
  if (itemInternalToggle) itemInternalToggle.addEventListener('change', function() {
    document.getElementById('item-internal-name-row').style.display = this.checked ? '' : 'none';
  });

  /* Left panel tab switching */
  document.querySelectorAll('.panel-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      switchLeftTab(tab.dataset.leftTab);
    });
  });

  /* Menu: Search & Sort */
  document.getElementById('menu-search').addEventListener('input', function() { renderItems(); });
  document.getElementById('menu-sort').addEventListener('change', function() { renderItems(); });

  /* Menu: Availability filter toggle */
  var availCb = document.getElementById('menu-filter-avail');
  if (availCb) availCb.addEventListener('change', function() { renderItems(); });

  /* Menu: Drawer */
  document.getElementById('menu-drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('menu-item-cancel').addEventListener('click', closeDrawer);
  document.getElementById('menu-item-save').addEventListener('click', saveItem);
  document.getElementById('menu-item-delete').addEventListener('click', deleteItem);
  document.getElementById('menu-item-copy').addEventListener('click', copyItem);
  document.getElementById('menu-item-paste').addEventListener('click', pasteItem);
  document.getElementById('menu-item-size-add-btn').addEventListener('click', function() {
    var item = getEditingItem();
    openAddSizeModal(item || _newItemDraft);
  });

  /* Item visibility mode listeners */
  var itemVisMode = document.getElementById('menu-item-vis-mode');
  if (itemVisMode) itemVisMode.addEventListener('change', applyItemVisMode);
  var itemHideRadios = document.querySelectorAll('input[name="item-hide-type"]');
  itemHideRadios.forEach(function(r) { r.addEventListener('change', applyItemVisMode); });
  var itemSchedType = document.getElementById('menu-item-schedule-type');
  if (itemSchedType) itemSchedType.addEventListener('change', applyItemVisMode);

  /* Item OOS (out-of-stock) listeners */
  var itemAvailStatus = document.getElementById('menu-item-avail-status');
  if (itemAvailStatus) itemAvailStatus.addEventListener('change', applyItemOosOptions);
  var itemOosRadios = document.querySelectorAll('input[name="item-oos-type"]');
  itemOosRadios.forEach(function(r) { r.addEventListener('change', applyItemOosOptions); });

  /* Drawer size chips: ⚙ icon delegation → override popup */
  var sizesList = document.getElementById('menu-item-sizes-list');
  if (sizesList) {
    sizesList.addEventListener('click', function(e) {
      var settingsIcon = e.target.closest('.mod-chip-inline-settings');
      if (!settingsIcon) return;
      e.stopPropagation();
      var chip = settingsIcon.closest('.mod-chip');
      var mgId = chip ? chip.dataset.mgId : null;
      if (!mgId) return;
      var sizeChip = chip.closest('.size-chip');
      if (!sizeChip) return;
      /* Find the size index and item/draft */
      var allChips = sizesList.querySelectorAll('.size-chip');
      var idx = Array.prototype.indexOf.call(allChips, sizeChip);
      if (idx < 0) return;
      var item = getEditingItem();
      var target = item || _newItemDraft;
      if (!target || !target.sizes || idx >= target.sizes.length) return;
      var sz = target.sizes[idx];
      showModOverrideForm(settingsIcon, mgId, function() { return sz; });
    });
  }

  /* Advanced settings toggle */
  document.getElementById('advanced-toggle').addEventListener('click', function() {
    var body = document.getElementById('advanced-body');
    var toggle = document.getElementById('advanced-toggle');
    var isOpen = body.classList.toggle('open');
    toggle.classList.toggle('open', isOpen);
  });

  /* Size edit modal */
  document.getElementById('menu-size-save').addEventListener('click', saveItemSize);
  document.getElementById('menu-size-cancel').addEventListener('click', closeSizeModal);
  document.getElementById('menu-size-delete-btn').addEventListener('click', confirmDeleteItemSize);

  /* Size delete confirmation modal */
  document.getElementById('size-delete-confirm-btn').addEventListener('click', deleteItemSizeConfirmed);
  document.getElementById('size-delete-cancel-btn').addEventListener('click', cancelDeleteItemSize);

  /* Menu: Double-click to create item */
  document.getElementById('menu-items-grid').addEventListener('dblclick', function() {
    editingItemId = null;
    openItemDrawer(null);
  });

  /* Menu: Drawer live inputs */
  initDrawerInputs();

  /* Menu: Photo upload via CMS */
  var photoBtn = document.getElementById('menu-photo-upload-btn');
  if (photoBtn) photoBtn.addEventListener('click', handlePhotoUpload);
}

function initDrawerInputs() {
  var nameInput = document.getElementById('menu-item-name');
  var slugInput = document.getElementById('menu-item-slug');
  if (nameInput && slugInput) {
    nameInput.addEventListener('input', function() {
      slugInput.value = slugify(nameInput.value);
      var item = getEditingItem();
      if (item) { item.item_name = nameInput.value; item.slug = slugInput.value; scheduleSave(); }
    });
    slugInput.addEventListener('input', function() {
      var item = getEditingItem();
      if (item) { item.slug = slugInput.value; scheduleSave(); }
    });
  }

  var drawerFields = {
    'menu-item-name': 'item_name', 'menu-item-slug': 'slug', 'menu-item-desc': 'description',
    'menu-item-price': 'price', 'menu-item-sale': 'sale_price', 'menu-item-cal': 'calories',
    'menu-item-prep': 'prep_time_minutes'
  };

  Object.keys(drawerFields).forEach(function(fieldId) {
    var el = document.getElementById(fieldId);
    if (!el) return;
    var prop = drawerFields[fieldId];
    el.addEventListener('input', function() {
      var item = getEditingItem();
      if (!item) return;
      if (el.type === 'number') item[prop] = parseFloat(el.value) || (prop === 'sale_price' ? null : 0);
      else item[prop] = el.value;
      scheduleSave();
    });
  });

  /* Dietary marks are now chip-based — no legacy toggles; handled by renderDietaryPicker */

  var availEl = document.getElementById('menu-item-avail');
  if (availEl) availEl.addEventListener('change', function() {
    var item = getEditingItem();
    if (!item) return;
    item.is_available = availEl.checked;
    scheduleSave();
  });

  var spiceEl = document.getElementById('menu-item-spice');
  if (spiceEl) spiceEl.addEventListener('input', function() {
    var val = parseInt(spiceEl.value);
    document.getElementById('menu-spice-label').textContent = SPICE_NAMES[val];
    var item = getEditingItem();
    if (item) { item.spice_level = val; scheduleSave(); }
  });

  /* Custom allergen input: Enter to add */
  var allergenCustom = document.getElementById('menu-allergen-custom');
  if (allergenCustom) allergenCustom.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      var val = this.value.trim();
      if (!val) return;
      var it = getEditingItem();
      if (!it) return;
      if (!it.allergens) it.allergens = [];
      if (it.allergens.indexOf(val) === -1) it.allergens.push(val);
      renderAllergenPicker(it);
      scheduleSave();
    }
  });

  /* Nutrition per-select: re-render table */
  var nutPerEl = document.getElementById('menu-item-nutrition-per');
  if (nutPerEl) nutPerEl.addEventListener('change', function() {
    var it = getEditingItem();
    if (it) { it.nutrition_per = this.value; scheduleSave(); }
    renderNutritionTable(it);
  });

  /* Nutrition value inputs: save on blur */
  var nutTable = document.getElementById('menu-nutrition-table');
  if (nutTable) nutTable.addEventListener('blur', function(e) {
    if (e.target.classList.contains('nutrient-val')) {
      var it = getEditingItem();
      if (!it) return;
      /* Collect all nutrition data */
      var nutData = collectNutritionData();
      it.nutrition_per = nutData.nutrition_per;
      it.nutrition = nutData.nutrition;
      scheduleSave();
    }
  }, true);
}

/* ===================================================================== */
/* MAIN RENDER & BOOT */
/* ===================================================================== */
function render(value) {
  /* Preserve drawer state across re-renders */
  var wasDrawerOpen = _drawerOpen;
  var savedEditingItemId = editingItemId;
  var savedDraft = _newItemDraft;
  var savedPhotos = _tempPhotos.slice();

  var incoming = value;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) incoming = {};
  data = deepMerge(DEFAULTS, incoming);

  /* Ensure nested arrays/objects exist */
  if (!data.general_info) data.general_info = DEFAULTS.general_info;
  if (!data.general_info.address) data.general_info.address = DEFAULTS.general_info.address;
  if (!data.general_info.coordinates) data.general_info.coordinates = DEFAULTS.general_info.coordinates;
  if (!data.general_info.legal) data.general_info.legal = DEFAULTS.general_info.legal;
  if (!data.general_info.legal.legal_address) data.general_info.legal.legal_address = DEFAULTS.general_info.legal.legal_address;
  /* Migrate old single restaurant_type to cuisine_types array */
  if (data.general_info.restaurant_type && !data.general_info.cuisine_types) {
    data.general_info.cuisine_types = [data.general_info.restaurant_type];
    delete data.general_info.restaurant_type;
  }
  if (data.general_info.custom_cuisine_types && data.general_info.custom_cuisine_types.length > 0) {
    var merged = data.general_info.cuisine_types || [];
    data.general_info.custom_cuisine_types.forEach(function(c) {
      var id = c.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      if (merged.indexOf(id) === -1) merged.push(id);
    });
    data.general_info.cuisine_types = merged;
    delete data.general_info.custom_cuisine_types;
  }
  if (!data.general_info.cuisine_types) data.general_info.cuisine_types = [];
  if (!data.general_info.additional_phones) data.general_info.additional_phones = [];
  if (!data.general_info.timezone) data.general_info.timezone = '';
  if (!data.service_settings) data.service_settings = DEFAULTS.service_settings;
  if (!data.service_settings.opening_hours || data.service_settings.opening_hours.length < 7) data.service_settings.opening_hours = DEFAULTS.service_settings.opening_hours;
  /* Migrate old reservation advance field names */
  var rs = data.service_settings.reservation_settings;
  if (rs) {
    if (rs.min_advance_hours !== undefined && rs.min_advance_minutes === undefined) {
      rs.min_advance_minutes = rs.min_advance_hours * 60; delete rs.min_advance_hours;
    }
    if (rs.max_advance_hours !== undefined && rs.max_advance_days === undefined) {
      rs.max_advance_days = Math.max(1, Math.round(rs.max_advance_hours / 24)); delete rs.max_advance_hours;
    }
    if (!rs.min_advance_minutes) rs.min_advance_minutes = DEFAULTS.service_settings.reservation_settings.min_advance_minutes;
    if (!rs.max_advance_days) rs.max_advance_days = DEFAULTS.service_settings.reservation_settings.max_advance_days;
  }
  if (!data.service_settings.on_premise_settings) data.service_settings.on_premise_settings = DEFAULTS.service_settings.on_premise_settings;
  if (!data.taxation_currency.tax_categories) data.taxation_currency.tax_categories = [];
  if (!data.menu.categories) data.menu.categories = [];
  if (!data.menu.items) data.menu.items = [];
  if (!data.menu.modifier_groups) data.menu.modifier_groups = [];
  if (!data.delivery_zones) data.delivery_zones = { zones: [] };
  /* Migrate old FeatureCollection format → new zones array */
  if (data.delivery_zones.features && !data.delivery_zones.zones) {
    var zonesMap = {};
    data.delivery_zones.features.forEach(function(f) {
      var p = f.properties || {};
      var key = (p.name || '') + '|' + (p.color || '') + '|' + (p.min_order || 0) + '|' + (p.fee || 0);
      if (!zonesMap[key]) {
        zonesMap[key] = { id: uid(), name: p.name || '', color: p.color || '#4f46e5', min_order: p.min_order || 0, fee: p.fee || 0, shapes: [] };
      }
      /* Extract geometry, handle Circle stored as Point+radius */
      if (f.geometry) {
        if (f.geometry.type === 'Point' && f.geometry.radius) {
          zonesMap[key].shapes.push({ type: 'Circle', center: f.geometry.coordinates, radius: f.geometry.radius });
        } else {
          zonesMap[key].shapes.push(f.geometry);
        }
      }
    });
    data.delivery_zones = { zones: Object.values(zonesMap) };
    delete data.delivery_zones.features;
  }
  if (!data.delivery_zones.zones) data.delivery_zones.zones = [];
  if (!data.delivery_form_settings) data.delivery_form_settings = DEFAULTS.delivery_form_settings;
  if (!data.delivery_form_settings.address_fields) data.delivery_form_settings.address_fields = DEFAULTS.delivery_form_settings.address_fields;
  if (!data.delivery_form_settings.custom_fields) data.delivery_form_settings.custom_fields = [];
  if (data.delivery_form_settings.accept_orders_outside_zone === undefined) data.delivery_form_settings.accept_orders_outside_zone = false;
  if (!data.device_connections) data.device_connections = [];

  /* Render all sections */
  renderGeneralInfo();
  renderCategories();
  renderItems();
  initCategoryDropTargets();
  initModifierDragDrop();
  renderModGroups();
  renderZonesList();
  if (zoneMap && zoneDrawnItems) loadZonesOnMap();
  renderDeliveryFormSettings();
  /* Only close drawer if it wasn't already open (preserve during auto-save re-renders) */
  if (!wasDrawerOpen) closeDrawer();
  tool.resize();

  /* Restore drawer state after re-render */
  if (wasDrawerOpen) {
    _drawerOpen = true;
    editingItemId = savedEditingItemId;
    _newItemDraft = savedDraft;
    _tempPhotos = savedPhotos;
    var panel = document.getElementById('menu-drawer');
    if (panel) panel.style.display = '';
  }
}

/* ===== BOOT ===== */
tool.onReady(function(val) {
  render(val);

  /* Init zone map (needs DOM ready) */
  initZoneMap();

  /* Init all event delegation */
  initAllEvents();

  /* Check read-only */
  if (tool.isReadOnly()) lockUI(true);

  /* SDK listeners */
  tool.onValueChange(function(v) { render(v); });
  tool.onReadonlyChange(function(ro) { lockUI(ro); });

  /* Resize observer for zone map */
  if (window.ResizeObserver) {
    new ResizeObserver(function() {
      if (zoneMap && activeTab === 'delivery') zoneMap.invalidateSize();
    }).observe(document.body);
  }
});
