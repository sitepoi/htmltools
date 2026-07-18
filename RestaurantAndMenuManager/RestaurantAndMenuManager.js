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
    }
  },
  taxation_currency: {
    currency: 'USD', tax_mode: 'exclusive', tax_name: 'Tax',
    tax_categories: [], delivery_fee_tax_rate: 0
  },
  payment_methods: {
    cash_delivery: true, cash_pickup: true, card_delivery: true, card_pickup: true,
    call_for_card_delivery: false, call_for_card_pickup: false, online_payment: false
  },
  delivery_zones: { type: 'FeatureCollection', features: [] },
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
var TAGS = ['Popular', 'New', 'Chef Special', 'Spicy', 'Bestseller', 'Limited', 'Seasonal'];
var SPICE_NAMES = ['Not Spicy', 'Mild', 'Medium', 'Hot', 'Very Hot', 'Extra Hot'];

var data = {};
var activeTab = 'general';
var editingDayIndex = -1;
var selectedCategoryId = null;
var editingItemId = null;
var editingModGroupId = null;
var selectedItemIds = [];
var activeFilter = null;
var _tempPhotos = []; /* URLs of photos uploaded for a new item before it is saved */

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
  var s = document.getElementById('save-status');
  if (s) { s.textContent = 'Unsaved changes...'; s.classList.add('unsaved'); }
  saveTimeout = setTimeout(function() {
    tool.setValue(JSON.parse(JSON.stringify(data)));
    var st = document.getElementById('save-status');
    if (st) { st.textContent = 'All changes saved'; st.classList.remove('unsaved'); }
  }, 500);
}

function saveNow() {
  clearTimeout(saveTimeout);
  tool.setValue(JSON.parse(JSON.stringify(data)));
  var s = document.getElementById('save-status');
  if (s) { s.textContent = 'All changes saved'; s.classList.remove('unsaved'); }
  tool.notify('All settings saved successfully', 'success');
}

/* ===== TAB NAVIGATION ===== */
function switchTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll('.main-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
  var tabBtn = document.querySelector('.main-tab[data-tab="' + tabName + '"]');
  var panel = document.querySelector('.tab-panel[data-tab="' + tabName + '"]');
  if (tabBtn) tabBtn.classList.add('active');
  if (panel) panel.classList.add('active');

  /* Invalidate map size when switching to zones tab */
  if (tabName === 'zones' && zoneMap) {
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
  var sb = document.getElementById('save-bar');
  if (sb) sb.style.display = ro ? 'none' : '';
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

  /* Social: website domain */
  var webToggle = document.getElementById('soc-website');
  var webRow = document.getElementById('soc-domain-row');
  if (webToggle && webRow) webRow.style.display = webToggle.checked ? '' : 'none';

  /* Zones tab: only visible when delivery is enabled */
  var delivToggle = document.getElementById('svc-delivery');
  var zonesTab = document.querySelector('.main-tab[data-tab="zones"]');
  if (delivToggle && zonesTab) {
    var showZones = delivToggle.checked;
    zonesTab.style.display = showZones ? '' : 'none';
    /* If zones tab was active and is now hidden, switch to general */
    if (!showZones && activeTab === 'zones') {
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
    if (el.closest('.tab-panel[data-tab="zones"]')) return; /* Skip zones */
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

  var features = (data.delivery_zones && data.delivery_zones.features) ? data.delivery_zones.features : [];
  if (features.length === 0) {
    container.innerHTML = '<div class="empty-state">No zones defined yet.<br>Draw a shape on the map, then click <strong>+ New Zone From Drawing</strong>.</div>';
    return;
  }

  features.forEach(function(feature, idx) {
    var props = feature.properties || {};
    var card = document.createElement('div');
    card.className = 'zone-card' + (zoneEditingIndex === idx ? ' selected' : '');
    card.dataset.zoneIndex = idx;

    var swatch = document.createElement('div');
    swatch.className = 'zone-card-color';
    swatch.style.backgroundColor = props.color || '#4f46e5';

    var info = document.createElement('div');
    info.className = 'zone-card-info';
    info.innerHTML =
      '<div class="zone-card-name">' + esc(props.name || 'Zone ' + (idx + 1)) + '</div>' +
      '<div class="zone-card-meta">Min: $' + (props.min_order || 0) + ' &middot; Fee: $' + (props.fee || 0) + '</div>';

    var actions = document.createElement('div');
    actions.className = 'zone-card-actions';
    actions.innerHTML =
      '<button title="Edit" class="edit-btn">✎</button>' +
      '<button title="Zoom to" class="zoom-btn">⊕</button>' +
      '<button title="Delete" class="delete-btn">✕</button>';

    actions.querySelector('.edit-btn').addEventListener('click', function(e) { e.stopPropagation(); editZone(idx); });
    actions.querySelector('.zoom-btn').addEventListener('click', function(e) { e.stopPropagation(); zoomToZone(idx); });
    actions.querySelector('.delete-btn').addEventListener('click', function(e) { e.stopPropagation(); deleteZone(idx); });
    card.addEventListener('click', function() { selectZone(idx); });

    card.appendChild(swatch);
    card.appendChild(info);
    card.appendChild(actions);
    container.appendChild(card);
  });
}

function zoomToZone(idx) {
  if (!zoneMap || idx < 0 || idx >= (data.delivery_zones.features || []).length) return;
  var layer = findLayerByZoneFeature(data.delivery_zones.features[idx]);
  if (layer) zoneMap.fitBounds(layer.getBounds(), { padding: [30, 30] });
}

function selectZone(idx) {
  zoneEditingIndex = idx;
  highlightZone(idx);
  renderZonesList();
}

function highlightZone(idx) {
  if (!zoneMap || !zoneDrawnItems) return;
  zoneDrawnItems.eachLayer(function(layer) {
    var zi = layer._zoneIndex;
    if (zi !== undefined && zi >= 0 && zi < (data.delivery_zones.features || []).length) {
      var color = data.delivery_zones.features[zi].properties.color || '#4f46e5';
      layer.setStyle({
        color: color, fillColor: color,
        fillOpacity: zi === idx ? 0.35 : 0.15,
        weight: zi === idx ? 3 : 2,
        opacity: zi === idx ? 1 : 0.7
      });
    }
  });
}

function findLayerByZoneFeature(feature) {
  var found = null;
  if (!zoneDrawnItems) return null;
  zoneDrawnItems.eachLayer(function(layer) {
    if (layer._zoneIndex !== undefined && layer._zoneIndex >= 0 && layer._zoneIndex < (data.delivery_zones.features || []).length) {
      if (data.delivery_zones.features[layer._zoneIndex] === feature) found = layer;
    }
  });
  return found;
}

function editZone(idx) {
  zoneEditingIndex = idx;
  var feature = data.delivery_zones.features[idx];
  if (!feature) return;
  var props = feature.properties || {};

  document.getElementById('zone-name').value = props.name || '';
  document.getElementById('zone-color').value = props.color || '#4f46e5';
  document.getElementById('zone-min-order').value = props.min_order || 0;
  document.getElementById('zone-fee').value = props.fee || 0;
  document.getElementById('zone-form').style.display = '';
  document.getElementById('zone-add-btn').style.display = 'none';

  highlightZone(idx);
  zoomToZone(idx);
  renderZonesList();
  tool.resize();
}

function deleteZone(idx) {
  if (idx < 0 || idx >= (data.delivery_zones.features || []).length) return;
  data.delivery_zones.features.splice(idx, 1);

  if (zoneDrawnItems) {
    var toRemove = null;
    zoneDrawnItems.eachLayer(function(layer) { if (layer._zoneIndex === idx) toRemove = layer; });
    if (toRemove) zoneDrawnItems.removeLayer(toRemove);
  }
  reindexZoneLayers();
  zoneEditingIndex = -1;
  clearZoneForm();
  renderZonesList();
  scheduleSave();
  tool.notify('Zone deleted', 'info');
}

function saveZone() {
  var name = document.getElementById('zone-name').value.trim();
  if (!name) { tool.notify('Zone name is required', 'warning'); return; }
  var color = document.getElementById('zone-color').value;
  var minOrder = parseFloat(document.getElementById('zone-min-order').value) || 0;
  var fee = parseFloat(document.getElementById('zone-fee').value) || 0;

  if (!data.delivery_zones.features) data.delivery_zones.features = [];

  if (zoneEditingIndex >= 0 && zoneEditingIndex < data.delivery_zones.features.length) {
    data.delivery_zones.features[zoneEditingIndex].properties = { name: name, color: color, min_order: minOrder, fee: fee };
    if (zoneDrawnItems) {
      zoneDrawnItems.eachLayer(function(layer) {
        if (layer._zoneIndex === zoneEditingIndex) layer.setStyle({ color: color, fillColor: color });
      });
    }
    tool.notify('Zone updated', 'success');
  } else {
    var newFeature = extractFromDrawnLayers(name, color, minOrder, fee);
    if (!newFeature) { tool.notify('Draw a shape on the map first, then try again', 'warning'); return; }
    data.delivery_zones.features.push(newFeature);
    reindexZoneLayers();
    tool.notify('Zone created', 'success');
  }

  zoneEditingIndex = -1;
  clearZoneForm();
  renderZonesList();
  highlightZone(-1);
  scheduleSave();
}

function extractFromDrawnLayers(name, color, minOrder, fee) {
  if (!zoneDrawnItems) return null;
  var candidate = null;
  zoneDrawnItems.eachLayer(function(layer) {
    if (layer._zoneIndex === undefined) candidate = layer;
  });
  if (!candidate) return null;
  var geometry = zoneLayerToGeoJSON(candidate);
  if (!geometry) return null;
  return { type: 'Feature', properties: { name: name, color: color, min_order: minOrder, fee: fee }, geometry: geometry };
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
    return { type: 'Point', coordinates: [center.lng, center.lat], radius: layer.getRadius() };
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

function clearZoneForm() {
  document.getElementById('zone-form').style.display = 'none';
  document.getElementById('zone-add-btn').style.display = '';
  document.getElementById('zone-name').value = '';
  document.getElementById('zone-min-order').value = '0';
  document.getElementById('zone-fee').value = '0';
  zoneEditingIndex = -1;
  highlightZone(-1);
  renderZonesList();
  tool.resize();
}

function reindexZoneLayers() {
  if (!zoneDrawnItems) return;
  var idx = 0;
  zoneDrawnItems.eachLayer(function(layer) { layer._zoneIndex = idx; idx++; });
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
    zoneDrawnItems.addLayer(layer);
    deactivateZoneDraw();
    layer.setStyle({ color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.15, weight: 2 });
  });

  zoneMap.on(L.Draw.Event.EDITED, function() { syncAllZoneLayers(); scheduleSave(); });
  zoneMap.on(L.Draw.Event.DELETED, function() { syncAllZoneLayers(); scheduleSave(); });

  loadZonesOnMap();
}

function loadZonesOnMap() {
  if (!zoneMap || !zoneDrawnItems) return;
  zoneDrawnItems.clearLayers();
  var features = (data.delivery_zones && data.delivery_zones.features) ? data.delivery_zones.features : [];
  features.forEach(function(feature, idx) {
    var layer = zoneGeoJSONToLayer(feature);
    if (layer) {
      layer._zoneIndex = idx;
      var color = feature.properties.color || '#4f46e5';
      layer.setStyle({ color: color, fillColor: color, fillOpacity: 0.15, weight: 2 });
      zoneDrawnItems.addLayer(layer);
    }
  });
}

function zoneGeoJSONToLayer(feature) {
  if (!feature || !feature.geometry) return null;
  var geom = feature.geometry;
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
    if (geom.type === 'Point' && geom.radius) {
      return L.circle([geom.coordinates[1], geom.coordinates[0]], { radius: geom.radius });
    }
  } catch(e) {}
  return null;
}

function syncAllZoneLayers() {
  var newFeatures = [];
  if (!zoneDrawnItems) return;
  zoneDrawnItems.eachLayer(function(layer) {
    var geom = zoneLayerToGeoJSON(layer);
    if (!geom) return;
    var idx = layer._zoneIndex;
    var features = data.delivery_zones.features || [];
    var props = { name: '', color: '#4f46e5', min_order: 0, fee: 0 };
    if (idx !== undefined && idx >= 0 && idx < features.length) props = features[idx].properties || props;
    newFeatures.push({ type: 'Feature', properties: props, geometry: geom });
  });
  data.delivery_zones.features = newFeatures;
  reindexZoneLayers();
}

function activateZoneDraw(type) {
  deactivateZoneDraw();
  if (!zoneMap) return;
  var options = {
    polygon: { shapeOptions: { color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.15, weight: 2 } },
    rectangle: { shapeOptions: { color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.15, weight: 2 } },
    circle: { shapeOptions: { color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.15, weight: 2 } }
  };
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
  ['zone-draw-polygon', 'zone-draw-circle', 'zone-draw-rectangle'].forEach(function(id) {
    var btn = document.getElementById(id);
    if (btn) btn.classList.remove('active-tool');
  });
  if (zoneActiveTool) {
    var activeId = 'zone-draw-' + zoneActiveTool;
    var activeBtn = document.getElementById(activeId);
    if (activeBtn) activeBtn.classList.add('active-tool');
  }
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
    var itemCount = (data.menu.items || []).filter(function(i) { return i.category_id === cat.id; }).length;
    var el = document.createElement('div');
    el.className = 'category-item' + (selectedCategoryId === cat.id ? ' active' : '');
    el.dataset.catId = cat.id;
    el.innerHTML =
      '<span class="drag-handle">⋮⋮</span>' +
      '<span class="cat-name">' + esc(cat.name) + '</span>' +
      '<span class="cat-count">' + itemCount + '</span>' +
      '<span class="cat-actions">' +
        '<button class="cat-edit-btn" title="Edit">✎</button>' +
        '<button class="cat-delete-btn" title="Delete">✕</button>' +
      '</span>';

    el.addEventListener('click', function(e) {
      if (e.target.closest('.cat-actions')) return;
      selectCategory(cat.id);
    });
    el.querySelector('.cat-edit-btn').addEventListener('click', function(e) { e.stopPropagation(); editCategory(cat.id); });
    el.querySelector('.cat-delete-btn').addEventListener('click', function(e) { e.stopPropagation(); deleteCategory(cat.id); });
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

  /* Update bulk category dropdown */
  var bulkSelect = document.getElementById('menu-bulk-cat');
  if (bulkSelect) {
    var currentVal = bulkSelect.value;
    bulkSelect.innerHTML = '<option value="">Move to...</option>';
    categories.forEach(function(c) { bulkSelect.innerHTML += '<option value="' + c.id + '">' + esc(c.name) + '</option>'; });
    bulkSelect.value = currentVal;
  }
}

function selectCategory(catId) {
  selectedCategoryId = catId;
  selectedItemIds = [];
  editingItemId = null;
  closeDrawer();
  renderCategories();
  renderItems();
}

function addCategory() {
  var form = document.getElementById('menu-cat-form');
  var input = document.getElementById('menu-cat-name');
  form.style.display = '';
  input.value = '';
  input.focus();
}

function saveCategory() {
  var input = document.getElementById('menu-cat-name');
  var name = input.value.trim();
  if (!name) { tool.notify('Category name required', 'warning'); return; }
  data.menu.categories.push({ id: uid(), name: name });
  document.getElementById('menu-cat-form').style.display = 'none';
  input.value = '';
  renderCategories();
  scheduleSave();
  tool.notify('Category added', 'success');
}

function editCategory(catId) {
  var cat = data.menu.categories.find(function(c) { return c.id === catId; });
  if (!cat) return;
  var form = document.getElementById('menu-cat-form');
  var input = document.getElementById('menu-cat-name');
  form.style.display = '';
  input.value = cat.name;
  input.dataset.editCatId = catId;
  input.focus();
}

function saveCategoryEdit() {
  var input = document.getElementById('menu-cat-name');
  var name = input.value.trim();
  var catId = input.dataset.editCatId;
  if (!name || !catId) return;
  var cat = data.menu.categories.find(function(c) { return c.id === catId; });
  if (cat) cat.name = name;
  document.getElementById('menu-cat-form').style.display = 'none';
  input.value = '';
  delete input.dataset.editCatId;
  renderCategories();
  scheduleSave();
}

function deleteCategory(catId) {
  data.menu.categories = data.menu.categories.filter(function(c) { return c.id !== catId; });
  (data.menu.items || []).forEach(function(item) { if (item.category_id === catId) item.category_id = null; });
  if (selectedCategoryId === catId) selectedCategoryId = null;
  renderCategories();
  renderItems();
  scheduleSave();
}

/* ---- Modifier Groups ---- */
function renderModGroups() {
  var list = document.getElementById('menu-mg-list');
  if (!list) return;
  list.innerHTML = '';
  (data.menu.modifier_groups || []).forEach(function(mg) {
    var el = document.createElement('div');
    el.className = 'modgroup-item' + (editingModGroupId === mg.id ? ' active' : '');
    el.dataset.mgId = mg.id;
    el.innerHTML =
      '<span class="mg-name">' + esc(mg.group_name) + '</span>' +
      '<span class="mg-meta">' + (mg.selection_type === 'single' ? 'Single' : 'Multi') + (mg.is_required ? ' · Req' : '') + '</span>' +
      '<span class="mg-actions"><button class="mg-edit-btn" title="Edit">✎</button><button class="mg-delete-btn" title="Delete">✕</button></span>';
    el.addEventListener('click', function(e) { if (e.target.closest('.mg-actions')) return; editModGroup(mg.id); });
    el.querySelector('.mg-edit-btn').addEventListener('click', function(e) { e.stopPropagation(); editModGroup(mg.id); });
    el.querySelector('.mg-delete-btn').addEventListener('click', function(e) { e.stopPropagation(); deleteModGroup(mg.id); });
    list.appendChild(el);
  });
}

function addModGroup() {
  editingModGroupId = null;
  var form = document.getElementById('menu-mg-form');
  document.getElementById('menu-mg-name').value = '';
  document.getElementById('menu-mg-type').value = 'multi';
  document.getElementById('menu-mg-required').checked = false;
  document.getElementById('menu-mg-options').innerHTML = '';
  form.style.display = '';
  renderModGroups();
  tool.resize();
}

function editModGroup(mgId) {
  var mg = data.menu.modifier_groups.find(function(g) { return g.id === mgId; });
  if (!mg) return;
  editingModGroupId = mgId;
  var form = document.getElementById('menu-mg-form');
  document.getElementById('menu-mg-name').value = mg.group_name;
  document.getElementById('menu-mg-type').value = mg.selection_type;
  document.getElementById('menu-mg-required').checked = !!mg.is_required;
  renderModGroupOptions(mg);
  form.style.display = '';
  renderModGroups();
  tool.resize();
}

function renderModGroupOptions(mg) {
  var container = document.getElementById('menu-mg-options');
  if (!container) return;
  container.innerHTML = '';
  (mg.options || []).forEach(function(opt, idx) {
    var row = document.createElement('div');
    row.className = 'modgroup-option-row';
    row.dataset.optIdx = idx;
    row.innerHTML =
      '<span class="drag-handle">⋮⋮</span>' +
      '<input type="text" class="form-input form-input-sm" value="' + esc(opt.option_name) + '" placeholder="Option name" data-opt-field="name">' +
      '<input type="number" class="form-input form-input-sm" value="' + (opt.price_adjustment || 0) + '" step="0.01" placeholder="+/- $" data-opt-field="price">' +
      '<label style="font-size:10px;"><input type="radio" name="mg-default-opt" value="' + idx + '" ' + (opt.is_default ? 'checked' : '') + '> Default</label>' +
      '<label style="font-size:10px;"><input type="checkbox" ' + (opt.is_available !== false ? 'checked' : '') + ' data-opt-field="avail"> Avail</label>' +
      '<button type="button" class="opt-delete-btn">✕</button>';
    row.querySelector('[data-opt-field="name"]').addEventListener('input', function() { mg.options[idx].option_name = this.value; });
    row.querySelector('[data-opt-field="price"]').addEventListener('input', function() { mg.options[idx].price_adjustment = parseFloat(this.value) || 0; });
    row.querySelector('[data-opt-field="avail"]').addEventListener('change', function() { mg.options[idx].is_available = this.checked; });
    row.querySelector('input[type="radio"]').addEventListener('change', function() { mg.options.forEach(function(o, i) { o.is_default = (i === idx); }); });
    row.querySelector('.opt-delete-btn').addEventListener('click', function() { mg.options.splice(idx, 1); renderModGroupOptions(mg); });
    container.appendChild(row);
  });
  if (typeof Sortable !== 'undefined') {
    Sortable.create(container, {
      handle: '.drag-handle', animation: 150,
      onEnd: function() {
        var newOrder = [].map.call(container.querySelectorAll('.modgroup-option-row'), function(r) { return parseInt(r.dataset.optIdx); });
        mg.options = newOrder.map(function(i) { return mg.options[i]; });
        renderModGroupOptions(mg);
      }
    });
  }
}

function addModOption() {
  if (!editingModGroupId) return;
  var mg = data.menu.modifier_groups.find(function(g) { return g.id === editingModGroupId; });
  if (!mg) return;
  if (!mg.options) mg.options = [];
  mg.options.push({ id: uid(), option_name: '', price_adjustment: 0, is_default: false, is_available: true });
  renderModGroupOptions(mg);
}

function saveModGroup() {
  var name = document.getElementById('menu-mg-name').value.trim();
  if (!name) { tool.notify('Group name required', 'warning'); return; }
  var mgData = {
    id: editingModGroupId || uid(),
    group_name: name,
    selection_type: document.getElementById('menu-mg-type').value,
    is_required: document.getElementById('menu-mg-required').checked,
    options: []
  };
  if (editingModGroupId) {
    var existing = data.menu.modifier_groups.find(function(g) { return g.id === editingModGroupId; });
    if (existing) { mgData.options = existing.options || []; Object.assign(existing, mgData); }
  } else {
    data.menu.modifier_groups.push(mgData);
  }
  editingModGroupId = null;
  document.getElementById('menu-mg-form').style.display = 'none';
  renderModGroups();
  renderModGroupCheckboxes();
  scheduleSave();
  tool.notify('Modifier group saved', 'success');
}

function deleteModGroup(mgId) {
  data.menu.modifier_groups = data.menu.modifier_groups.filter(function(g) { return g.id !== mgId; });
  (data.menu.items || []).forEach(function(item) {
    if (item.modifier_group_ids) item.modifier_group_ids = item.modifier_group_ids.filter(function(id) { return id !== mgId; });
  });
  editingModGroupId = null;
  document.getElementById('menu-mg-form').style.display = 'none';
  renderModGroups();
  renderModGroupCheckboxes();
  scheduleSave();
}

function renderModGroupCheckboxes() {
  var container = document.getElementById('menu-mg-checkboxes');
  if (!container) return;
  var item = getEditingItem();
  var selectedIds = item ? (item.modifier_group_ids || []) : [];
  container.innerHTML = '';
  (data.menu.modifier_groups || []).forEach(function(mg) {
    var label = document.createElement('label');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = mg.id;
    cb.checked = selectedIds.indexOf(mg.id) !== -1;
    cb.addEventListener('change', function() {
      var it = getEditingItem();
      if (!it) return;
      if (!it.modifier_group_ids) it.modifier_group_ids = [];
      if (this.checked) { if (it.modifier_group_ids.indexOf(mg.id) === -1) it.modifier_group_ids.push(mg.id); }
      else { it.modifier_group_ids = it.modifier_group_ids.filter(function(id) { return id !== mg.id; }); }
      scheduleSave();
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + mg.group_name + ' (' + (mg.selection_type === 'single' ? 'Single' : 'Multi') + ')'));
    container.appendChild(label);
  });
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

  if (activeFilter === 'vegetarian') items = items.filter(function(i) { return i.is_vegetarian; });
  if (activeFilter === 'vegan') items = items.filter(function(i) { return i.is_vegan; });
  if (activeFilter === 'gluten_free') items = items.filter(function(i) { return i.is_gluten_free; });
  if (activeFilter === 'available') items = items.filter(function(i) { return i.is_available !== false; });

  var sortBy = document.getElementById('menu-sort').value;
  if (sortBy === 'name_asc') items.sort(function(a, b) { return (a.item_name || '').localeCompare(b.item_name || ''); });
  if (sortBy === 'name_desc') items.sort(function(a, b) { return (b.item_name || '').localeCompare(a.item_name || ''); });
  if (sortBy === 'price_asc') items.sort(function(a, b) { return (a.price || 0) - (b.price || 0); });
  if (sortBy === 'price_desc') items.sort(function(a, b) { return (b.price || 0) - (a.price || 0); });

  if (items.length === 0) { grid.innerHTML = '<div class="empty-state">No items found</div>'; return; }

  items.forEach(function(item) {
    var card = document.createElement('div');
    card.className = 'item-card' + (selectedItemIds.indexOf(item.id) !== -1 ? ' selected' : '');
    card.dataset.itemId = item.id;

    var photoHtml = item.primary_photo_url ? '<img src="' + item.primary_photo_url + '" alt="">' : '🍽️';
    var badges = '';
    if (item.is_vegetarian) badges += '<span class="badge badge-veg">V</span>';
    if (item.is_vegan) badges += '<span class="badge badge-vegan">VG</span>';
    if (item.is_gluten_free) badges += '<span class="badge badge-gf">GF</span>';
    if (item.tags && item.tags.length > 0) badges += '<span class="badge badge-tag">' + esc(item.tags[0]) + '</span>';

    var priceDisplay = '$' + (item.price || 0).toFixed(2);
    var saleDisplay = item.sale_price ? '<span class="card-sale">$' + item.sale_price.toFixed(2) + '</span>' : '';
    var descSnippet = item.description ? '<div class="card-description">' + esc(item.description) + '</div>' : '';

    card.innerHTML =
      '<div class="card-photo"><div class="card-check">✓</div>' + photoHtml + '</div>' +
      '<div class="card-body">' +
        '<div class="card-name">' + esc(item.item_name || 'Untitled') + '</div>' +
        descSnippet +
        '<div class="card-pricing"><span class="card-price">' + priceDisplay + '</span>' + saleDisplay + '</div>' +
        '<div class="card-badges">' + badges + '</div>' +
      '</div>' +
      '<div class="card-footer"><span>' + (item.calories ? item.calories + ' cal' : '') + '</span><span class="availability-dot ' + (item.is_available !== false ? 'on' : 'off') + '"></span></div>';

    card.addEventListener('click', function(e) {
      if (e.ctrlKey || e.metaKey) { toggleItemSelection(item.id); return; }
      openItemDrawer(item.id);
    });
    grid.appendChild(card);
  });
  updateBulkBar();
}

function toggleItemSelection(itemId) {
  var idx = selectedItemIds.indexOf(itemId);
  if (idx === -1) selectedItemIds.push(itemId); else selectedItemIds.splice(idx, 1);
  renderItems();
}

function updateBulkBar() {
  var bar = document.getElementById('menu-bulk-bar');
  var count = document.getElementById('menu-bulk-count');
  if (bar) bar.style.display = selectedItemIds.length > 0 ? '' : 'none';
  if (count) count.textContent = selectedItemIds.length + ' selected';
}

function clearSelection() { selectedItemIds = []; renderItems(); }

/* ---- Item Drawer ---- */
function openItemDrawer(itemId) {
  editingItemId = itemId;
  var item = data.menu.items.find(function(i) { return i.id === itemId; });
  var panel = document.getElementById('menu-drawer');
  var title = document.getElementById('menu-drawer-title');
  if (panel) panel.style.display = '';
  if (title) title.textContent = item ? 'Edit Item' : 'New Item';

  if (item) {
    document.getElementById('menu-item-name').value = item.item_name || '';
    document.getElementById('menu-item-slug').value = item.slug || '';
    document.getElementById('menu-item-desc').value = item.description || '';
    document.getElementById('menu-item-price').value = item.price || '';
    document.getElementById('menu-item-sale').value = item.sale_price || '';
    document.getElementById('menu-item-veg').checked = !!item.is_vegetarian;
    document.getElementById('menu-item-vegan').checked = !!item.is_vegan;
    document.getElementById('menu-item-gf').checked = !!item.is_gluten_free;
    document.getElementById('menu-item-spice').value = item.spice_level || 0;
    document.getElementById('menu-spice-label').textContent = SPICE_NAMES[item.spice_level || 0];
    document.getElementById('menu-item-cal').value = item.calories || '';
    document.getElementById('menu-item-prep').value = item.prep_time_minutes || '';
    document.getElementById('menu-item-avail').checked = item.is_available !== false;
    document.getElementById('menu-item-delete').style.display = '';
    renderPrimaryPhoto(item);
    renderPhotoPool(item);
    renderAllergenPicker(item);
    renderTagPicker(item);
    renderModGroupCheckboxes();
  } else {
    clearItemForm();
    document.getElementById('menu-item-delete').style.display = 'none';
    renderAllergenPicker(null);
    renderTagPicker(null);
    renderModGroupCheckboxes();
  }
  tool.resize();
}

function getEditingItem() {
  if (!editingItemId) return null;
  return data.menu.items.find(function(i) { return i.id === editingItemId; }) || null;
}

function clearItemForm() {
  document.getElementById('menu-item-name').value = '';
  document.getElementById('menu-item-slug').value = '';
  document.getElementById('menu-item-desc').value = '';
  document.getElementById('menu-item-price').value = '';
  document.getElementById('menu-item-sale').value = '';
  document.getElementById('menu-item-veg').checked = false;
  document.getElementById('menu-item-vegan').checked = false;
  document.getElementById('menu-item-gf').checked = false;
  document.getElementById('menu-item-spice').value = 0;
  document.getElementById('menu-spice-label').textContent = 'Not Spicy';
  document.getElementById('menu-item-cal').value = '';
  document.getElementById('menu-item-prep').value = '';
  document.getElementById('menu-item-avail').checked = true;
  document.getElementById('menu-photo-preview').innerHTML = '🍽️';
  document.getElementById('menu-photo-pool').innerHTML = '';
  document.getElementById('menu-item-delete').style.display = 'none';
  _tempPhotos = [];
}

function closeDrawer() {
  document.getElementById('menu-drawer').style.display = 'none';
  editingItemId = null;
  tool.resize();
}

/* ---- Allergens & Tags ---- */
function renderAllergenPicker(item) {
  var container = document.getElementById('menu-allergen-picker');
  if (!container) return;
  container.innerHTML = '';
  var selected = item ? (item.allergens || []) : [];
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

/* ---- Photos ---- */
function renderPrimaryPhoto(item) {
  var preview = document.getElementById('menu-photo-preview');
  if (!preview) return;
  if (item && item.primary_photo_url) preview.innerHTML = '<img src="' + item.primary_photo_url + '" alt="">';
  else preview.innerHTML = '🍽️';
}

function renderPhotoPoolForTemp() {
  var pool = document.getElementById('menu-photo-pool');
  if (!pool) return;
  pool.innerHTML = '';
  _tempPhotos.forEach(function(url, idx) {
    var el = document.createElement('div');
    el.className = 'photo-pool-item' + (idx === 0 ? ' primary' : '');
    el.innerHTML = '<img src="' + url + '" alt=""><span class="pool-delete">✕</span>';
    el.querySelector('.pool-delete').addEventListener('click', function(e) {
      e.stopPropagation();
      _tempPhotos.splice(idx, 1);
      if (idx === 0 && _tempPhotos.length > 0) {
        document.getElementById('menu-photo-preview').innerHTML = '<img src="' + _tempPhotos[0] + '" alt="">';
      } else if (_tempPhotos.length === 0) {
        document.getElementById('menu-photo-preview').innerHTML = '🍽️';
      }
      renderPhotoPoolForTemp();
    });
    pool.appendChild(el);
  });
}

function renderPhotoPool(item) {
  var pool = document.getElementById('menu-photo-pool');
  if (!pool) return;
  pool.innerHTML = '';
  if (!item || !item.photos || item.photos.length === 0) return;
  item.photos.forEach(function(photoUrl, idx) {
    var el = document.createElement('div');
    el.className = 'photo-pool-item' + (photoUrl === item.primary_photo_url ? ' primary' : '');
    el.innerHTML = '<img src="' + photoUrl + '" alt=""><span class="pool-delete">✕</span>';
    el.addEventListener('click', function(e) {
      if (e.target.classList.contains('pool-delete')) return;
      item.primary_photo_url = photoUrl;
      renderPrimaryPhoto(item);
      renderPhotoPool(item);
      scheduleSave();
    });
    el.querySelector('.pool-delete').addEventListener('click', function(e) {
      e.stopPropagation();
      var it = getEditingItem();
      if (!it) return;
      it.photos.splice(idx, 1);
      if (it.primary_photo_url === photoUrl) it.primary_photo_url = it.photos.length > 0 ? it.photos[0] : null;
      renderPrimaryPhoto(it);
      renderPhotoPool(it);
      scheduleSave();
    });
    pool.appendChild(el);
  });
}

function handlePrimaryPhoto() {
  tool.requestUpload('image/*', function(err, file) {
    if (err || !file) { if (err) tool.notify('Upload failed: ' + err, 'error'); return; }
    var url = file.url;
    var item = getEditingItem();
    if (!item) {
      _tempPhotos = [url];
      document.getElementById('menu-photo-preview').innerHTML = '<img src="' + url + '" alt="">';
      return;
    }
    item.primary_photo_url = url;
    if (!item.photos) item.photos = [];
    if (item.photos.indexOf(url) === -1) item.photos.push(url);
    renderPrimaryPhoto(item);
    renderPhotoPool(item);
    scheduleSave();
  });
}

function handleGalleryPhotos() {
  var item = getEditingItem();
  tool.requestUpload('image/*', function(err, file) {
    if (err || !file) { if (err) tool.notify('Upload failed: ' + err, 'error'); return; }
    var url = file.url;
    if (!item) {
      _tempPhotos.push(url);
      renderPhotoPoolForTemp();
      return;
    }
    if (!item.photos) item.photos = [];
    if (item.photos.indexOf(url) === -1) item.photos.push(url);
    if (!item.primary_photo_url) { item.primary_photo_url = url; renderPrimaryPhoto(item); }
    renderPhotoPool(item);
    scheduleSave();
  });
}

/* ---- Save / Delete Item ---- */
function saveItem() {
  var name = document.getElementById('menu-item-name').value.trim();
  var price = parseFloat(document.getElementById('menu-item-price').value);
  if (!name) { tool.notify('Item name is required', 'warning'); return; }
  if (isNaN(price) || price < 0) { tool.notify('Valid price is required', 'warning'); return; }

  if (!editingItemId) {
    var primaryUrl = _tempPhotos.length > 0 ? _tempPhotos[0] : null;
    var newItem = {
      id: uid(), category_id: selectedCategoryId || null,
      item_name: name, slug: slugify(name),
      description: document.getElementById('menu-item-desc').value,
      price: price, sale_price: parseFloat(document.getElementById('menu-item-sale').value) || null,
      primary_photo_url: primaryUrl,
      photos: _tempPhotos.slice(),
      allergens: [], is_vegetarian: document.getElementById('menu-item-veg').checked,
      is_vegan: document.getElementById('menu-item-vegan').checked,
      is_gluten_free: document.getElementById('menu-item-gf').checked,
      spice_level: parseInt(document.getElementById('menu-item-spice').value),
      calories: parseInt(document.getElementById('menu-item-cal').value) || null,
      prep_time_minutes: parseInt(document.getElementById('menu-item-prep').value) || null,
      tags: [], modifier_group_ids: [],
      is_available: document.getElementById('menu-item-avail').checked
    };
    data.menu.items.push(newItem);
    editingItemId = newItem.id;
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

/* ---- Bulk Actions ---- */
function bulkMove() {
  var targetCatId = document.getElementById('menu-bulk-cat').value;
  if (!targetCatId || selectedItemIds.length === 0) return;
  selectedItemIds.forEach(function(id) {
    var item = data.menu.items.find(function(i) { return i.id === id; });
    if (item) item.category_id = targetCatId;
  });
  clearSelection();
  renderItems();
  renderCategories();
  scheduleSave();
  tool.notify('Items moved', 'success');
}

function bulkToggleAvailable() {
  selectedItemIds.forEach(function(id) {
    var item = data.menu.items.find(function(i) { return i.id === id; });
    if (item) item.is_available = !item.is_available;
  });
  clearSelection();
  renderItems();
  scheduleSave();
  tool.notify('Items toggled', 'success');
}

function bulkDelete() {
  data.menu.items = data.menu.items.filter(function(i) { return selectedItemIds.indexOf(i.id) === -1; });
  clearSelection();
  renderItems();
  renderCategories();
  scheduleSave();
  tool.notify('Items deleted', 'info');
}

/* ===================================================================== */
/* INIT EVENT DELEGATION */
/* ===================================================================== */
function initAllEvents() {
  /* Tab Navigation */
  document.querySelectorAll('.main-tab').forEach(function(tab) {
    tab.addEventListener('click', function() { switchTab(tab.dataset.tab); });
  });

  /* General Info: data-path inputs */
  document.querySelectorAll('[data-path]').forEach(function(el) {
    if (el.closest('[data-tab="menu"]') || el.closest('[data-tab="zones"]')) return;
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

  /* Zones */
  document.getElementById('zone-draw-polygon').addEventListener('click', function() {
    if (zoneActiveTool === 'polygon') deactivateZoneDraw(); else activateZoneDraw('polygon');
  });
  document.getElementById('zone-draw-circle').addEventListener('click', function() {
    if (zoneActiveTool === 'circle') deactivateZoneDraw(); else activateZoneDraw('circle');
  });
  document.getElementById('zone-draw-rectangle').addEventListener('click', function() {
    if (zoneActiveTool === 'rectangle') deactivateZoneDraw(); else activateZoneDraw('rectangle');
  });
  document.getElementById('zone-clear-drawing').addEventListener('click', function() {
    deactivateZoneDraw();
    if (!zoneDrawnItems) return;
    var toRemove = [];
    zoneDrawnItems.eachLayer(function(layer) { if (layer._zoneIndex === undefined) toRemove.push(layer); });
    toRemove.forEach(function(l) { zoneDrawnItems.removeLayer(l); });
  });
  document.getElementById('zone-edit-layers').addEventListener('click', function() {
    deactivateZoneDraw();
    if (!zoneDrawnItems || zoneDrawnItems.getLayers().length === 0) return;
    new L.EditToolbar.Edit(zoneMap, { featureGroup: zoneDrawnItems }).enable();
    document.getElementById('zone-edit-layers').classList.add('active-tool');
  });
  document.getElementById('zone-add-btn').addEventListener('click', function() {
    zoneEditingIndex = -1;
    document.getElementById('zone-name').value = '';
    document.getElementById('zone-min-order').value = '0';
    document.getElementById('zone-fee').value = '0';
    document.getElementById('zone-color').value = '#4f46e5';
    document.getElementById('zone-form').style.display = '';
    document.getElementById('zone-add-btn').style.display = 'none';
    tool.resize();
  });
  document.getElementById('zone-save-btn').addEventListener('click', saveZone);
  document.getElementById('zone-cancel-btn').addEventListener('click', clearZoneForm);

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
  document.getElementById('menu-cat-save').addEventListener('click', function() {
    var input = document.getElementById('menu-cat-name');
    if (input.dataset.editCatId) saveCategoryEdit(); else saveCategory();
  });
  document.getElementById('menu-cat-cancel').addEventListener('click', function() {
    var input = document.getElementById('menu-cat-name');
    document.getElementById('menu-cat-form').style.display = 'none';
    input.value = '';
    delete input.dataset.editCatId;
  });
  document.getElementById('menu-cat-name').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      if (this.dataset.editCatId) saveCategoryEdit(); else saveCategory();
    }
  });

  /* Menu: Modifier Groups */
  document.getElementById('menu-mg-add').addEventListener('click', addModGroup);
  document.getElementById('menu-mg-save').addEventListener('click', saveModGroup);
  document.getElementById('menu-mg-cancel').addEventListener('click', function() {
    editingModGroupId = null;
    document.getElementById('menu-mg-form').style.display = 'none';
    renderModGroups();
  });
  document.getElementById('menu-mg-add-opt').addEventListener('click', addModOption);

  /* Menu: Search & Sort */
  document.getElementById('menu-search').addEventListener('input', function() { renderItems(); });
  document.getElementById('menu-sort').addEventListener('change', function() { renderItems(); });

  /* Menu: Filter Chips */
  document.querySelectorAll('#menu-filter-chips .chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      if (activeFilter === chip.dataset.filter) { activeFilter = null; }
      else { activeFilter = chip.dataset.filter; }
      document.querySelectorAll('#menu-filter-chips .chip').forEach(function(c) { c.classList.remove('active'); });
      if (activeFilter) chip.classList.add('active');
      renderItems();
    });
  });

  /* Menu: Drawer */
  document.getElementById('menu-drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('menu-item-cancel').addEventListener('click', closeDrawer);
  document.getElementById('menu-item-save').addEventListener('click', saveItem);
  document.getElementById('menu-item-delete').addEventListener('click', deleteItem);

  /* Menu: Bulk */
  document.getElementById('menu-bulk-move').addEventListener('click', bulkMove);
  document.getElementById('menu-bulk-toggle').addEventListener('click', bulkToggleAvailable);
  document.getElementById('menu-bulk-delete').addEventListener('click', bulkDelete);
  document.getElementById('menu-bulk-clear').addEventListener('click', clearSelection);

  /* Menu: Double-click to create item */
  document.getElementById('menu-items-grid').addEventListener('dblclick', function() {
    editingItemId = null;
    openItemDrawer(null);
  });

  /* Menu: Drawer live inputs */
  initDrawerInputs();

  /* Menu: Photo uploads via CMS */
  var primaryPhotoBtn = document.getElementById('menu-photo-upload-btn');
  if (primaryPhotoBtn) primaryPhotoBtn.addEventListener('click', handlePrimaryPhoto);
  var galleryPhotoBtn = document.getElementById('menu-gallery-upload-btn');
  if (galleryPhotoBtn) galleryPhotoBtn.addEventListener('click', handleGalleryPhotos);

  /* Save All */
  var saveAllBtn = document.getElementById('save-all-btn');
  if (saveAllBtn) saveAllBtn.addEventListener('click', saveNow);
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

  ['menu-item-veg', 'menu-item-vegan', 'menu-item-gf'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var prop = id.replace('menu-item-', '').replace(/-/g, '_');
    el.addEventListener('change', function() {
      var item = getEditingItem();
      if (!item) return;
      item[prop] = el.checked;
      scheduleSave();
    });
  });

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
}

/* ===================================================================== */
/* MAIN RENDER & BOOT */
/* ===================================================================== */
function render(value) {
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
  if (!data.taxation_currency.tax_categories) data.taxation_currency.tax_categories = [];
  if (!data.menu.categories) data.menu.categories = [];
  if (!data.menu.items) data.menu.items = [];
  if (!data.menu.modifier_groups) data.menu.modifier_groups = [];
  if (!data.delivery_zones) data.delivery_zones = { type: 'FeatureCollection', features: [] };
  if (!data.delivery_zones.features) data.delivery_zones.features = [];
  if (!data.device_connections) data.device_connections = [];

  /* Render all sections */
  renderGeneralInfo();
  renderCategories();
  renderItems();
  renderModGroups();
  renderZonesList();
  if (zoneMap && zoneDrawnItems) loadZonesOnMap();
  closeDrawer();
  tool.resize();
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
      if (zoneMap && activeTab === 'zones') zoneMap.invalidateSize();
    }).observe(document.body);
  }
});
