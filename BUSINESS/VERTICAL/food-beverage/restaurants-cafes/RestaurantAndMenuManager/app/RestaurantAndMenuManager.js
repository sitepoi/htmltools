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
  deals: [],
  hero: { image_url: '', preset_images: [] },
  promotions: [],
  campaigns: [],
  promo_codes: [],
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

/* ===================================================================== */
/* GLORIA JSON IMPORT */
/* ===================================================================== */

/* Resolve Gloria's multi-field visibility into UniconHub's 3-mode system */
function resolveGloriaVisibility(obj) {
  if (obj.active === false || obj.active === 'false') {
    return 'hide';
  }
  if (obj.active_exact_from || obj.active_exact_until || obj.active_begin || obj.active_end) {
    return 'scheduled';
  }
  if (obj.active_days && obj.active_days > 0) {
    return 'scheduled';
  }
  return 'show';
}

/* Convert Gloria bitmask (Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64) to day arrays */
function gloriaBitmaskToDays(mask) {
  if (!mask || mask === 0) return null;
  var days = [];
  for (var i = 0; i < 7; i++) {
    if (mask & (1 << i)) days.push(i + 1); /* 1=Mon … 7=Sun */
  }
  if (days.length === 0) return null;
  return [{ days: days, start_time: '00:00', end_time: '23:59' }];
}

/* Parse tax ID mapping from textarea (e.g. "444286=Standard") */
function parseGloriaTaxMap(raw) {
  var map = {};
  if (!raw || !raw.trim()) return map;
  raw.split('\n').forEach(function(line) {
    var parts = line.split('=');
    if (parts.length === 2) {
      var id = parts[0].trim();
      var name = parts[1].trim();
      if (id && name) map[id] = name;
    }
  });
  return map;
}

/* Slugify helper for import */
function importSlugify(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

/* Main import function */
function importGloriaMenu() {
  var rawJson = document.getElementById('gloria-import-json').value.trim();
  var rawTaxMap = document.getElementById('gloria-tax-map').value;
  var resultsEl = document.getElementById('gloria-import-results');

  if (!rawJson) {
    resultsEl.style.display = '';
    resultsEl.innerHTML = '<div style="color:#dc2626;font-size:13px;">⚠️ Please paste Gloria JSON first.</div>';
    return;
  }

  var gloriaData;
  try { gloriaData = JSON.parse(rawJson); } catch (e) {
    resultsEl.style.display = '';
    resultsEl.innerHTML = '<div style="color:#dc2626;font-size:13px;">❌ Invalid JSON: ' + e.message + '</div>';
    return;
  }

  if (!gloriaData.categories || !Array.isArray(gloriaData.categories)) {
    resultsEl.style.display = '';
    resultsEl.innerHTML = '<div style="color:#dc2626;font-size:13px;">❌ JSON must contain a "categories" array.</div>';
    return;
  }

  var taxMap = parseGloriaTaxMap(rawTaxMap);

  var stats = { categories: 0, items: 0, modifier_groups: 0, options: 0, sizes: 0 };
  var groupMap = {}; /* key → unified UniconHub group */

  /* Helper: deduplicate & convert a Gloria group to UniconHub */
  function unifyGroup(gGroup) {
    var optNames = (gGroup.options || []).map(function(o) { return o.name; }).sort().join('|');
    var key = (gGroup.name || '') + '|||' + optNames;
    if (groupMap[key]) return groupMap[key];

    var mg = {
      id: uid(),
      group_name: gGroup.name || 'Unnamed Group',
      selection_type: (gGroup.force_max === 1 && gGroup.force_min === 1) ? 'single' : 'multi',
      allow_duplicates: !!gGroup.allow_quantity,
      is_required: !!gGroup.required,
      force_min: gGroup.force_min || 0,
      force_max: gGroup.force_max || 0,
      tax_category_id: taxMap[gGroup.tax_category_id] || null,
      photo_url: null,
      options: (gGroup.options || []).map(function(o) {
        stats.options++;
        return {
          id: uid(),
          option_name: o.name || 'Unnamed',
          price_adjustment: o.price || 0,
          is_default: !!o.default,
          is_available: true,
          availability: o.is_out_of_stock ? 'out_of_stock' : 'available',
          oos_type: o.is_out_of_stock ? 'undetermined' : null,
          oos_until: null,
          photo_url: null,
          show_internal_name: false,
          internal_name: ''
        };
      })
    };
    groupMap[key] = mg;
    stats.modifier_groups++;
    return mg;
  }

  /* Convert each Gloria category */
  (gloriaData.categories || []).forEach(function(gCat) {
    var catId = uid();
    var visMode = resolveGloriaVisibility(gCat);
    var schedType = null;
    var schedFrom = null, schedUntil = null;
    if (gCat.active_exact_from || gCat.active_exact_until) {
      schedType = 'date_range';
      schedFrom = gCat.active_exact_from || null;
      schedUntil = gCat.active_exact_until || null;
    } else if (gCat.active_begin || gCat.active_end) {
      schedType = 'date_range';
      schedFrom = gCat.active_begin || null;
      schedUntil = gCat.active_end || null;
    }

    var cat = {
      id: catId,
      name: gCat.name || 'Unnamed Category',
      description: gCat.description || '',
      visibility_mode: visMode,
      hide_until_date: gCat.hidden_until || null,
      schedule_type: schedType,
      schedule_from: schedFrom,
      schedule_until: schedUntil,
      schedule_time_windows: gloriaBitmaskToDays(gCat.active_days),
      photos: [],
      primary_photo_url: null,
      tax_category_id: null
    };
    data.menu.categories.push(cat);
    stats.categories++;

    /* Convert items inside this category */
    (gCat.items || []).forEach(function(gItem) {
      var itemVis = resolveGloriaVisibility(gItem);
      var itemSchedType = null;
      var itemSchedFrom = null, itemSchedUntil = null;
      if (gItem.active_exact_from || gItem.active_exact_until) {
        itemSchedType = 'date_range';
        itemSchedFrom = gItem.active_exact_from || null;
        itemSchedUntil = gItem.active_exact_until || null;
      } else if (gItem.active_begin || gItem.active_end) {
        itemSchedType = 'date_range';
        itemSchedFrom = gItem.active_begin || null;
        itemSchedUntil = gItem.active_end || null;
      }

      /* Collect channels from restaurant_menu_availabilities */
      var channels = [];
      (gItem.restaurant_menu_availabilities || []).forEach(function(a) {
        if (a.service && channels.indexOf(a.service) === -1) channels.push(a.service);
      });
      if (channels.length === 0) channels = ['pickup', 'delivery', 'on_premise'];

      var hasSizes = (gItem.sizes && gItem.sizes.length > 0);

      var item = {
        id: uid(),
        category_id: catId,
        item_name: gItem.name || 'Unnamed Item',
        slug: importSlugify(gItem.name),
        description: gItem.description || '',
        price: hasSizes ? null : (gItem.price || 0),
        sale_price: null,
        primary_photo_url: null,
        photos: [],
        allergens: [],
        dietary_marks: [],
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        spice_level: 0,
        calories: null,
        prep_time_minutes: null,
        ingredients: gItem.ingredients || '',
        additives: gItem.additives || '',
        nutrition_per: 'serving',
        nutrition: [],
        tags: gItem.tags ? gItem.tags.split(',').map(function(t) { return t.trim(); }) : [],
        modifier_group_ids: [],
        modifier_group_overrides: {},
        sizes: [],
        visibility_mode: itemVis,
        hide_until_date: gItem.hidden_until || null,
        schedule_type: itemSchedType,
        schedule_time_windows: gloriaBitmaskToDays(gItem.active_days),
        schedule_from: itemSchedFrom,
        schedule_until: itemSchedUntil,
        availability: 'available',
        show_on_channels: channels,
        tax_category_id: taxMap[gItem.tax_category_id] || null,
        show_internal_name: false,
        internal_name: '',
        hide_instructions: !!gItem.hide_instructions
      };

      /* Collect item-level modifier groups */
      var seenGroupIds = {};
      (gItem.groups || []).forEach(function(gGroup) {
        var unified = unifyGroup(gGroup);
        if (seenGroupIds[unified.id]) return;
        seenGroupIds[unified.id] = true;
        item.modifier_group_ids.push(unified.id);
        if (gGroup.required !== undefined || gGroup.allow_quantity !== undefined) {
          item.modifier_group_overrides[unified.id] = {};
          if (gGroup.required !== undefined) item.modifier_group_overrides[unified.id].is_required = !!gGroup.required;
          if (gGroup.allow_quantity !== undefined) item.modifier_group_overrides[unified.id].allow_duplicates = !!gGroup.allow_quantity;
        }
      });

      /* Convert sizes */
      (gItem.sizes || []).forEach(function(gSize) {
        var size = {
          id: uid(),
          label: gSize.name || 'Size',
          price: gSize.price || 0,
          modifier_group_ids: []
        };
        (gSize.groups || []).forEach(function(gGroup) {
          var unified = unifyGroup(gGroup);
          if (size.modifier_group_ids.indexOf(unified.id) === -1) {
            size.modifier_group_ids.push(unified.id);
          }
        });
        item.sizes.push(size);
        stats.sizes++;
      });

      data.menu.items.push(item);
      stats.items++;
    });
  });

  /* Add all unified modifier groups */
  Object.keys(groupMap).forEach(function(key) {
    var alreadyExists = data.menu.modifier_groups.some(function(mg) { return mg.id === groupMap[key].id; });
    if (!alreadyExists) data.menu.modifier_groups.push(groupMap[key]);
  });

  /* Close modal and refresh UI */
  document.getElementById('gloria-import-modal').style.display = 'none';
  document.getElementById('gloria-import-json').value = '';

  renderCategories();
  renderModGroups();
  renderItems();
  renderModGroupCheckboxes();
  scheduleSave();

  tool.notify(
    '✅ Imported: ' + stats.categories + ' categories, ' + stats.items + ' items, ' +
    stats.sizes + ' sizes, ' + stats.modifier_groups + ' modifier groups, ' + stats.options + ' options',
    'success'
  );
}

/* ---- Gloria Import Modal handlers ---- */
function openGloriaImportModal() {
  document.getElementById('gloria-import-json').value = '';
  document.getElementById('gloria-tax-map').value = '';
  document.getElementById('gloria-import-results').style.display = 'none';
  document.getElementById('gloria-import-modal').style.display = 'flex';
  document.getElementById('gloria-import-json').focus();
}

function closeGloriaImportModal() {
  document.getElementById('gloria-import-modal').style.display = 'none';
}

/* ===================================================================== */
/* PRESENTATION SECTIONS: DEALS, CAMPAIGNS, HERO AND PROMOTIONS */
/* ===================================================================== */
/* Shape source: docs/client-data-contract.html version 3.1, sections 21 and 23
   (extended rule types from 23.1, D-RAMM-18). Every key written here must
   match that contract. The website honors the deal "active" flag since
   2026-10-21 (D-RAMM-19). */

var DEAL_RULE_TYPES = ['bundle', 'min_quantity', 'tiered', 'two_for_one',
  'percentage_discount', 'subtotal_threshold', 'free_delivery',
  'free_item_with_purchase', 'buy_n_get_m', 'volume_pricing', 'free_modifier'];
var PROMO_CODE_RULE_TYPES = ['percentage_discount', 'subtotal_threshold', 'free_delivery'];
var CAMPAIGN_PRICING_VALUE = 'most_expensive';
var PROMOTION_LIMIT = 4;

/* Stored ids whose value this tool cannot edit. Their problems are reported as
   warnings, not errors, so an old hand-edited record can still be saved. */
var unsupportedDealRuleIds = {};
var unsupportedCampaignPricingIds = {};
var lastSaveBlockedReport = null;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readString(value) {
  return typeof value === 'string' ? value : '';
}

function readStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(function (entry) { return typeof entry === 'string' && entry !== ''; });
}

function readNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  var number = typeof value === 'number' ? value : parseFloat(value);
  return isFinite(number) ? number : null;
}

function isPositiveInteger(value) {
  return typeof value === 'number' && isFinite(value) && value > 0 && Math.floor(value) === value;
}

/* ---------- Normalization (runs on every load) ---------- */
function normalizeEntryList(rawList, normalizeEntry) {
  if (!Array.isArray(rawList)) return [];
  var usedIds = {};
  return rawList.filter(isPlainObject).map(function (entry) {
    return normalizeEntry(entry, usedIds);
  });
}

function normalizeRuleGroup(group, includeCharge) {
  var normalizedGroup = {
    group_id: readString(group.group_id) || uid(),
    label: readString(group.label),
    quantity: isPositiveInteger(group.quantity) ? group.quantity : (parseInt(group.quantity, 10) || 1)
  };
  var categoryIds = readStringArray(group.category_ids);
  var itemIds = readStringArray(group.item_ids);
  if (categoryIds.length > 0) normalizedGroup.category_ids = categoryIds;
  if (itemIds.length > 0) normalizedGroup.item_ids = itemIds;
  if (readString(group.size_label)) normalizedGroup.size_label = readString(group.size_label);
  if (readString(group.name_filter)) normalizedGroup.name_filter = readString(group.name_filter);
  if (includeCharge) normalizedGroup.charge = group.charge === 'free' ? 'free' : 'paid';
  return normalizedGroup;
}

function normalizeDealRule(deal) {
  var rule = deal.rule;

  if (deal.rule_type === 'bundle') {
    rule.groups = (Array.isArray(rule.groups) ? rule.groups : [])
      .filter(isPlainObject)
      .map(function (group) { return normalizeRuleGroup(group, false); });
    return;
  }

  if (deal.rule_type === 'min_quantity') {
    rule.category_ids = readStringArray(rule.category_ids);
    rule.min_quantity = isPositiveInteger(rule.min_quantity) ? rule.min_quantity : (parseInt(rule.min_quantity, 10) || 2);
    if (readString(rule.size_label)) rule.size_label = readString(rule.size_label);
    else delete rule.size_label;
    return;
  }

  if (deal.rule_type === 'tiered') {
    rule.item_ids = readStringArray(rule.item_ids);
    rule.tiers = (Array.isArray(rule.tiers) ? rule.tiers : [])
      .filter(isPlainObject)
      .map(function (tier) {
        return {
          quantity: isPositiveInteger(tier.quantity) ? tier.quantity : (parseInt(tier.quantity, 10) || 1),
          price: readNumberOrNull(tier.price),
          label: readString(tier.label)
        };
      });
    return;
  }

  if (deal.rule_type === 'two_for_one') {
    rule.required_item_count = isPositiveInteger(rule.required_item_count) ? rule.required_item_count : (parseInt(rule.required_item_count, 10) || 2);
    rule.category_ids = readStringArray(rule.category_ids);
    rule.same_size = rule.same_size !== false;
    return;
  }

  if (deal.rule_type === 'percentage_discount') {
    var percentValue = readNumberOrNull(rule.percent);
    rule.percent = (percentValue !== null && percentValue >= 1 && percentValue <= 100) ? percentValue : 10;
    var pctCategoryIds = readStringArray(rule.category_ids);
    var pctItemIds = readStringArray(rule.item_ids);
    if (pctCategoryIds.length > 0) rule.category_ids = pctCategoryIds; else delete rule.category_ids;
    if (pctItemIds.length > 0) rule.item_ids = pctItemIds; else delete rule.item_ids;
    return;
  }

  if (deal.rule_type === 'subtotal_threshold') {
    var thresholdMin = readNumberOrNull(rule.min_subtotal);
    var thresholdDiscount = readNumberOrNull(rule.discount);
    rule.min_subtotal = (thresholdMin !== null && thresholdMin >= 0) ? thresholdMin : 0;
    rule.discount = (thresholdDiscount !== null && thresholdDiscount >= 0) ? thresholdDiscount : 0;
    return;
  }

  if (deal.rule_type === 'free_delivery') {
    var deliveryMin = readNumberOrNull(rule.min_subtotal);
    if (deliveryMin !== null && deliveryMin >= 0) rule.min_subtotal = deliveryMin;
    else delete rule.min_subtotal;
    rule.always = rule.always === true;
    return;
  }

  if (deal.rule_type === 'free_item_with_purchase') {
    rule.groups = (Array.isArray(rule.groups) ? rule.groups : [])
      .filter(isPlainObject)
      .map(function (group) { return normalizeRuleGroup(group, true); });
    return;
  }

  if (deal.rule_type === 'buy_n_get_m') {
    rule.required_item_count = isPositiveInteger(rule.required_item_count) ? rule.required_item_count : (parseInt(rule.required_item_count, 10) || 2);
    rule.free_item_count = isPositiveInteger(rule.free_item_count) ? rule.free_item_count : (parseInt(rule.free_item_count, 10) || 1);
    var bngmCategoryIds = readStringArray(rule.category_ids);
    var bngmItemIds = readStringArray(rule.item_ids);
    if (bngmCategoryIds.length > 0) rule.category_ids = bngmCategoryIds; else delete rule.category_ids;
    if (bngmItemIds.length > 0) rule.item_ids = bngmItemIds; else delete rule.item_ids;
    rule.same_size = rule.same_size === true;
    return;
  }

  if (deal.rule_type === 'volume_pricing') {
    rule.category_ids = readStringArray(rule.category_ids);
    if (readString(rule.name_filter)) rule.name_filter = readString(rule.name_filter);
    else delete rule.name_filter;
    rule.bands = (Array.isArray(rule.bands) ? rule.bands : [])
      .filter(isPlainObject)
      .map(function (band) {
        var bandUnitPrice = readNumberOrNull(band.unit_price);
        return {
          min_quantity: isPositiveInteger(band.min_quantity) ? band.min_quantity : (parseInt(band.min_quantity, 10) || 1),
          unit_price: (bandUnitPrice !== null && bandUnitPrice >= 0) ? bandUnitPrice : 0
        };
      });
    return;
  }

  if (deal.rule_type === 'free_modifier') {
    rule.modifier_group_ids = readStringArray(rule.modifier_group_ids);
    rule.option_count = isPositiveInteger(rule.option_count) ? rule.option_count : (parseInt(rule.option_count, 10) || 1);
    var freeModCategoryIds = readStringArray(rule.category_ids);
    if (freeModCategoryIds.length > 0) rule.category_ids = freeModCategoryIds;
    else delete rule.category_ids;
  }
}

function normalizeDealSchedule(deal) {
  var schedule = deal.schedule;
  if (!isPlainObject(schedule)) { delete deal.schedule; return; }
  var normalizedSchedule = {};
  if (readString(schedule.date_from)) normalizedSchedule.date_from = readString(schedule.date_from);
  if (readString(schedule.date_until)) normalizedSchedule.date_until = readString(schedule.date_until);
  var weekdays = (Array.isArray(schedule.weekdays) ? schedule.weekdays : [])
    .filter(function (weekday) { return isPositiveInteger(weekday) && weekday >= 1 && weekday <= 7; });
  if (weekdays.length > 0) normalizedSchedule.weekdays = weekdays;
  if (readString(schedule.time_from)) normalizedSchedule.time_from = readString(schedule.time_from);
  if (readString(schedule.time_until)) normalizedSchedule.time_until = readString(schedule.time_until);
  if (Object.keys(normalizedSchedule).length === 0) delete deal.schedule;
  else deal.schedule = normalizedSchedule;
}

function normalizeDealEntry(rawDeal, usedIds) {
  var deal = isPlainObject(rawDeal) ? rawDeal : {};
  if (!deal.id || usedIds[deal.id]) deal.id = uid();
  usedIds[deal.id] = true;

  deal.title = readString(deal.title);
  deal.description = readString(deal.description);
  deal.section = readString(deal.section);
  deal.image_url = readString(deal.image_url);
  deal.price = readNumberOrNull(deal.price);
  if (typeof deal.active !== 'boolean') deal.active = true;
  if (!isPlainObject(deal.rule)) deal.rule = {};

  var ruleType = typeof deal.rule_type === 'string' ? deal.rule_type : '';
  if (ruleType === '') {
    deal.rule_type = 'bundle';
  } else if (DEAL_RULE_TYPES.indexOf(ruleType) === -1) {
    deal.rule_type = ruleType;
    unsupportedDealRuleIds[deal.id] = ruleType;
  } else {
    deal.rule_type = ruleType;
  }

  normalizeDealRule(deal);
  normalizeDealSchedule(deal);
  return deal;
}

function normalizeCampaignEntry(rawCampaign, usedIds) {
  var campaign = isPlainObject(rawCampaign) ? rawCampaign : {};
  if (!campaign.id || usedIds[campaign.id]) campaign.id = uid();
  usedIds[campaign.id] = true;

  campaign.title = readString(campaign.title);
  campaign.description = readString(campaign.description);
  campaign.required_item_count = isPositiveInteger(campaign.required_item_count)
    ? campaign.required_item_count
    : (parseInt(campaign.required_item_count, 10) || 2);
  campaign.same_size = campaign.same_size !== false;
  campaign.category_ids = readStringArray(campaign.category_ids);
  campaign.item_ids = readStringArray(campaign.item_ids);

  if (campaign.pricing === undefined || campaign.pricing === null || campaign.pricing === '') {
    campaign.pricing = CAMPAIGN_PRICING_VALUE;
  } else if (campaign.pricing !== CAMPAIGN_PRICING_VALUE) {
    unsupportedCampaignPricingIds[campaign.id] = campaign.pricing;
  }
  return campaign;
}

function normalizePromotionEntry(rawPromotion, usedIds) {
  var promotion = isPlainObject(rawPromotion) ? rawPromotion : {};
  if (!promotion.id || usedIds[promotion.id]) promotion.id = uid();
  usedIds[promotion.id] = true;

  promotion.title = readString(promotion.title);
  promotion.description = readString(promotion.description);
  promotion.image_url = readString(promotion.image_url);
  return promotion;
}

function normalizePromoCodeRule(promoCode) {
  var rule = promoCode.rule;

  if (promoCode.rule_type === 'percentage_discount') {
    var percentValue = readNumberOrNull(rule.percent);
    rule.percent = (percentValue !== null && percentValue >= 1 && percentValue <= 100) ? percentValue : 10;
    return;
  }

  if (promoCode.rule_type === 'subtotal_threshold') {
    var thresholdMin = readNumberOrNull(rule.min_subtotal);
    var thresholdDiscount = readNumberOrNull(rule.discount);
    rule.min_subtotal = (thresholdMin !== null && thresholdMin >= 0) ? thresholdMin : 0;
    rule.discount = (thresholdDiscount !== null && thresholdDiscount >= 0) ? thresholdDiscount : 0;
    return;
  }

  if (promoCode.rule_type === 'free_delivery') {
    var deliveryMin = readNumberOrNull(rule.min_subtotal);
    if (deliveryMin !== null && deliveryMin >= 0) rule.min_subtotal = deliveryMin;
    else delete rule.min_subtotal;
    rule.always = rule.always === true;
  }
}

function normalizePromoCodeEntry(rawPromoCode, usedIds) {
  var promoCode = isPlainObject(rawPromoCode) ? rawPromoCode : {};
  if (!promoCode.id || usedIds[promoCode.id]) promoCode.id = uid();
  usedIds[promoCode.id] = true;

  promoCode.code = readString(promoCode.code).toUpperCase();
  promoCode.title = readString(promoCode.title);
  if (!isPlainObject(promoCode.rule)) promoCode.rule = {};

  var ruleType = typeof promoCode.rule_type === 'string' ? promoCode.rule_type : '';
  if (PROMO_CODE_RULE_TYPES.indexOf(ruleType) === -1) promoCode.rule_type = 'percentage_discount';
  else promoCode.rule_type = ruleType;
  normalizePromoCodeRule(promoCode);

  var maxUses = readNumberOrNull(promoCode.max_uses);
  promoCode.max_uses = (maxUses !== null && isPositiveInteger(maxUses)) ? maxUses : null;
  return promoCode;
}

function normalizePresentationSections(documentData) {
  unsupportedDealRuleIds = {};
  unsupportedCampaignPricingIds = {};

  if (!isPlainObject(documentData.hero)) documentData.hero = { image_url: '', preset_images: [] };
  documentData.hero.image_url = readString(documentData.hero.image_url);
  documentData.hero.preset_images = readStringArray(documentData.hero.preset_images);

  documentData.deals = normalizeEntryList(documentData.deals, normalizeDealEntry);
  documentData.campaigns = normalizeEntryList(documentData.campaigns, normalizeCampaignEntry);
  documentData.promotions = normalizeEntryList(documentData.promotions, normalizePromotionEntry);
  documentData.promo_codes = normalizeEntryList(documentData.promo_codes, normalizePromoCodeEntry);
}

/* ---------- Menu reference index (T-03) ---------- */
function buildMenuReferenceIndex(documentData) {
  var source = documentData || data || {};
  var menu = isPlainObject(source.menu) ? source.menu : {};
  var categories = Array.isArray(menu.categories) ? menu.categories : [];
  var items = Array.isArray(menu.items) ? menu.items : [];
  var categoriesById = {};
  var itemsById = {};
  var sizeLabels = {};
  var modifierGroupsById = {};

  categories.forEach(function (category) {
    if (category && category.id) categoriesById[category.id] = category;
  });
  items.forEach(function (item) {
    if (!item || !item.id) return;
    itemsById[item.id] = item;
    (item.sizes || []).forEach(function (size) {
      if (size && size.label) sizeLabels[size.label] = true;
    });
  });
  ((menu && Array.isArray(menu.modifier_groups)) ? menu.modifier_groups : []).forEach(function (group) {
    if (group && group.id) modifierGroupsById[group.id] = group;
  });

  return {
    categoriesById: categoriesById,
    itemsById: itemsById,
    items: items,
    categoryIds: Object.keys(categoriesById),
    sizeLabels: Object.keys(sizeLabels).sort(),
    modifierGroupsById: modifierGroupsById
  };
}

function itemHasSizeLabel(item, sizeLabel) {
  if (!sizeLabel) return true;
  return (item.sizes || []).some(function (size) {
    return !!size && size.label === sizeLabel;
  });
}

function itemMatchesDealFilters(item, filters) {
  if (!item) return false;
  var itemIds = filters.itemIds || [];
  if (itemIds.length > 0) return itemIds.indexOf(item.id) !== -1;

  var categoryIds = filters.categoryIds || [];
  if (categoryIds.length > 0 && categoryIds.indexOf(item.category_id) === -1) return false;
  if (filters.sizeLabel && !itemHasSizeLabel(item, filters.sizeLabel)) return false;
  if (filters.nameFilter) {
    var itemName = (item.item_name || '').toLowerCase();
    if (itemName.indexOf(filters.nameFilter.toLowerCase()) === -1) return false;
  }
  return true;
}

function collectMatchingItems(filters, referenceIndex) {
  return referenceIndex.items.filter(function (item) {
    return itemMatchesDealFilters(item, filters);
  });
}

/* ---------- Validation (T-04) ---------- */
function describeDeal(deal) {
  return 'Deal "' + (deal.title || deal.id || 'untitled') + '"';
}

function validateBundleRule(deal, referenceIndex, errors, warnings, dealLabel) {
  var groups = deal.rule.groups || [];
  if (groups.length === 0) {
    errors.push(dealLabel + ': add at least one group.');
  }

  groups.forEach(function (group, index) {
    var groupLabel = dealLabel + ', group ' + (index + 1) + ' "' + (group.label || 'untitled') + '"';
    if (!group.label) errors.push(groupLabel + ': label is required.');
    if (!isPositiveInteger(group.quantity)) errors.push(groupLabel + ': quantity must be a whole number of 1 or more.');

    var fixedItemIds = group.item_ids || [];
    if (fixedItemIds.length > 0) {
      fixedItemIds.forEach(function (itemId) {
        if (!referenceIndex.itemsById[itemId]) warnings.push(groupLabel + ': item ' + itemId + ' no longer exists in the menu.');
      });
      return;
    }

    var hasFilter = (group.category_ids || []).length > 0 || !!group.size_label || !!group.name_filter;
    if (!hasFilter) {
      errors.push(groupLabel + ': choose at least one category, size or name filter.');
      return;
    }

    var matches = collectMatchingItems({
      categoryIds: group.category_ids || [],
      sizeLabel: group.size_label || '',
      nameFilter: group.name_filter || ''
    }, referenceIndex);
    if (matches.length === 0) errors.push(groupLabel + ': the filters match no menu items.');
  });

  if (deal.price === null) errors.push(dealLabel + ': a bundle needs a fixed total price.');
  else if (!(deal.price >= 0)) errors.push(dealLabel + ': price must be zero or more.');
}

function validateMinQuantityRule(deal, referenceIndex, errors, warnings, dealLabel) {
  if (!(deal.rule.min_quantity >= 2)) errors.push(dealLabel + ': minimum quantity must be 2 or more.');
  if ((deal.rule.category_ids || []).length === 0) errors.push(dealLabel + ': choose at least one category.');
  if (deal.price === null) errors.push(dealLabel + ': a per-unit price is required.');
  else if (!(deal.price >= 0)) errors.push(dealLabel + ': price must be zero or more.');

  var sizeLabel = deal.rule.size_label || '';
  if (sizeLabel && referenceIndex.sizeLabels.indexOf(sizeLabel) === -1) {
    warnings.push(dealLabel + ': size "' + sizeLabel + '" no longer exists on any menu item.');
  }

  var matches = collectMatchingItems({ categoryIds: deal.rule.category_ids || [], sizeLabel: sizeLabel }, referenceIndex);
  if (matches.length === 0) errors.push(dealLabel + ': the filters match no menu items.');
}

function validateTieredRule(deal, referenceIndex, errors, warnings, dealLabel) {
  if ((deal.rule.item_ids || []).length === 0) errors.push(dealLabel + ': choose the items this deal applies to.');
  if ((deal.rule.tiers || []).length === 0) errors.push(dealLabel + ': add at least one price tier.');
  if (deal.price !== null) errors.push(dealLabel + ': a tiered deal must not store a price of its own.');

  (deal.rule.tiers || []).forEach(function (tier, index) {
    var tierLabel = dealLabel + ', tier ' + (index + 1);
    if (!isPositiveInteger(tier.quantity)) errors.push(tierLabel + ': quantity must be a whole number of 1 or more.');
    if (tier.price === null || !(tier.price >= 0)) errors.push(tierLabel + ': price must be zero or more.');
    if (!tier.label) errors.push(tierLabel + ': label is required.');
  });

  (deal.rule.item_ids || []).forEach(function (itemId) {
    if (!referenceIndex.itemsById[itemId]) warnings.push(dealLabel + ': item ' + itemId + ' no longer exists in the menu.');
  });

  var matches = collectMatchingItems({ itemIds: deal.rule.item_ids || [] }, referenceIndex);
  if (matches.length === 0) errors.push(dealLabel + ': the selected items do not exist in the menu.');
}

function validateTwoForOneRule(deal, referenceIndex, errors, warnings, dealLabel) {
  if (!(deal.rule.required_item_count >= 2)) errors.push(dealLabel + ': the required item count must be 2 or more.');
  if ((deal.rule.category_ids || []).length === 0) errors.push(dealLabel + ': choose at least one category.');
  if (typeof deal.rule.same_size !== 'boolean') errors.push(dealLabel + ': same size must be true or false.');
  if (deal.price !== null) errors.push(dealLabel + ': a two-for-one deal must not store a price of its own.');

  var matches = collectMatchingItems({ categoryIds: deal.rule.category_ids || [] }, referenceIndex);
  if (matches.length === 0) errors.push(dealLabel + ': the filters match no menu items.');
}

function validatePercentageDiscountRule(deal, referenceIndex, errors, dealLabel) {
  var percent = deal.rule.percent;
  if (percent === null || percent === undefined || !(percent >= 1) || !(percent <= 100)) {
    errors.push(dealLabel + ': the percent must be between 1 and 100.');
  }
  if (deal.price !== null) errors.push(dealLabel + ': a percentage discount must not store a price of its own.');
  var categoryIds = deal.rule.category_ids || [];
  var itemIds = deal.rule.item_ids || [];
  if (categoryIds.length > 0 || itemIds.length > 0) {
    var matches = collectMatchingItems({ categoryIds: categoryIds, itemIds: itemIds }, referenceIndex);
    if (matches.length === 0) errors.push(dealLabel + ': the filters match no menu items.');
  }
}

function validateSubtotalThresholdRule(deal, errors, dealLabel) {
  var minSubtotal = deal.rule.min_subtotal;
  var discount = deal.rule.discount;
  if (minSubtotal === null || minSubtotal === undefined || !(minSubtotal >= 0)) {
    errors.push(dealLabel + ': the minimum subtotal must be zero or more.');
  }
  if (discount === null || discount === undefined || !(discount >= 0)) {
    errors.push(dealLabel + ': the discount must be zero or more.');
  } else if (minSubtotal !== null && minSubtotal !== undefined && discount > minSubtotal) {
    errors.push(dealLabel + ': the discount cannot be higher than the minimum subtotal.');
  }
  if (deal.price !== null) errors.push(dealLabel + ': a subtotal threshold must not store a price of its own.');
}

function validateFreeDeliveryRule(deal, errors, dealLabel) {
  if (deal.rule.min_subtotal !== undefined && deal.rule.min_subtotal !== null && !(deal.rule.min_subtotal >= 0)) {
    errors.push(dealLabel + ': the minimum subtotal must be zero or more.');
  }
  if (typeof deal.rule.always !== 'boolean') errors.push(dealLabel + ': always must be true or false.');
  if (deal.price !== null) errors.push(dealLabel + ': free delivery must not store a price of its own.');
}

function validateFreeItemWithPurchaseRule(deal, referenceIndex, errors, warnings, dealLabel) {
  var groups = deal.rule.groups || [];
  if (groups.length === 0) errors.push(dealLabel + ': add at least one group.');
  var paidCount = 0;
  var freeCount = 0;

  groups.forEach(function (group, index) {
    var groupLabel = dealLabel + ', group ' + (index + 1) + ' "' + (group.label || 'untitled') + '"';
    if (!group.label) errors.push(groupLabel + ': label is required.');
    if (!isPositiveInteger(group.quantity)) errors.push(groupLabel + ': quantity must be a whole number of 1 or more.');
    if (group.charge === 'free') freeCount++;
    else if (group.charge === 'paid') paidCount++;
    else errors.push(groupLabel + ': each group must be paid or free.');

    var fixedItemIds = group.item_ids || [];
    if (fixedItemIds.length > 0) {
      fixedItemIds.forEach(function (itemId) {
        if (!referenceIndex.itemsById[itemId]) warnings.push(groupLabel + ': item ' + itemId + ' no longer exists in the menu.');
      });
      return;
    }

    var hasFilter = (group.category_ids || []).length > 0 || !!group.size_label || !!group.name_filter;
    if (!hasFilter) {
      errors.push(groupLabel + ': choose at least one category, size or name filter.');
      return;
    }

    var matches = collectMatchingItems({
      categoryIds: group.category_ids || [],
      sizeLabel: group.size_label || '',
      nameFilter: group.name_filter || ''
    }, referenceIndex);
    if (matches.length === 0) errors.push(groupLabel + ': the filters match no menu items.');
  });

  if (paidCount === 0) errors.push(dealLabel + ': add at least one paid group.');
  if (freeCount === 0) errors.push(dealLabel + ': add at least one free group.');
  if (deal.price !== null) errors.push(dealLabel + ': a free-item deal must not store a price of its own.');
}

function validateBuyNGetMRule(deal, referenceIndex, errors, dealLabel) {
  if (!(deal.rule.required_item_count >= 2)) errors.push(dealLabel + ': the paid item count must be 2 or more.');
  if (!(deal.rule.free_item_count >= 1)) errors.push(dealLabel + ': the free item count must be 1 or more.');
  if (typeof deal.rule.same_size !== 'boolean') errors.push(dealLabel + ': same size must be true or false.');
  var categoryIds = deal.rule.category_ids || [];
  var itemIds = deal.rule.item_ids || [];
  if (categoryIds.length === 0 && itemIds.length === 0) {
    errors.push(dealLabel + ': choose at least one category or item.');
  } else {
    var matches = collectMatchingItems({ categoryIds: categoryIds, itemIds: itemIds }, referenceIndex);
    if (matches.length === 0) errors.push(dealLabel + ': the filters match no menu items.');
  }
  if (deal.price !== null) errors.push(dealLabel + ': a buy-N-get-M deal must not store a price of its own.');
}

function validateVolumePricingRule(deal, referenceIndex, errors, dealLabel) {
  if ((deal.rule.category_ids || []).length === 0) errors.push(dealLabel + ': choose at least one category.');
  var bands = deal.rule.bands || [];
  if (bands.length === 0) errors.push(dealLabel + ': add at least one quantity band.');
  var previousMin = 0;
  bands.forEach(function (band, index) {
    var bandLabel = dealLabel + ', band ' + (index + 1);
    if (!isPositiveInteger(band.min_quantity)) {
      errors.push(bandLabel + ': the minimum quantity must be a whole number of 1 or more.');
      return;
    }
    if (band.min_quantity <= previousMin) errors.push(bandLabel + ': bands must start at increasing quantities.');
    previousMin = band.min_quantity;
    if (band.unit_price === null || band.unit_price === undefined || !(band.unit_price >= 0)) {
      errors.push(bandLabel + ': the unit price must be zero or more.');
    }
  });
  if ((deal.rule.category_ids || []).length > 0) {
    var matches = collectMatchingItems({ categoryIds: deal.rule.category_ids || [], nameFilter: deal.rule.name_filter || '' }, referenceIndex);
    if (matches.length === 0) errors.push(dealLabel + ': the filters match no menu items.');
  }
  if (deal.price !== null) errors.push(dealLabel + ': a volume deal must not store a price of its own.');
}

function validateFreeModifierRule(deal, referenceIndex, errors, warnings, dealLabel) {
  if ((deal.rule.modifier_group_ids || []).length === 0) errors.push(dealLabel + ': choose at least one modifier group.');
  if (!(deal.rule.option_count >= 1)) errors.push(dealLabel + ': the free option count must be 1 or more.');
  (deal.rule.modifier_group_ids || []).forEach(function (groupId) {
    if (!referenceIndex.modifierGroupsById[groupId]) {
      warnings.push(dealLabel + ': modifier group ' + groupId + ' no longer exists in the menu.');
    }
  });
  var categoryIds = deal.rule.category_ids || [];
  if (categoryIds.length > 0) {
    var matches = collectMatchingItems({ categoryIds: categoryIds }, referenceIndex);
    if (matches.length === 0) errors.push(dealLabel + ': the category filter matches no menu items.');
  }
  if (deal.price !== null) errors.push(dealLabel + ': a free-modifier deal must not store a price of its own.');
}

function validateDealSchedule(deal, errors, dealLabel) {
  var schedule = deal.schedule;
  if (!isPlainObject(schedule)) return;
  if (schedule.date_from && schedule.date_until && schedule.date_from > schedule.date_until) {
    errors.push(dealLabel + ': the schedule start date cannot be after the end date.');
  }
  if (schedule.time_from && schedule.time_until && schedule.time_from >= schedule.time_until) {
    errors.push(dealLabel + ': the schedule start time must be before the end time.');
  }
  (schedule.weekdays || []).forEach(function (weekday) {
    if (!isPositiveInteger(weekday) || weekday < 1 || weekday > 7) {
      errors.push(dealLabel + ': schedule weekdays must be 1 (Monday) to 7 (Sunday).');
    }
  });
}

function validateDeal(deal, referenceIndex) {
  var errors = [];
  var warnings = [];
  var dealLabel = describeDeal(deal);

  if (!deal.id) errors.push(dealLabel + ': id is missing.');
  if (!deal.title) errors.push(dealLabel + ': title is required.');
  if (typeof deal.active !== 'boolean') errors.push(dealLabel + ': the active flag must be true or false.');

  if (deal.rule_type === undefined || DEAL_RULE_TYPES.indexOf(deal.rule_type) === -1) {
    warnings.push(dealLabel + ': rule type "' + (deal.rule_type || '') + '" cannot be edited in this tool and is published unchanged.');
    return { errors: errors, warnings: warnings };
  }

  if (deal.rule_type === 'bundle') validateBundleRule(deal, referenceIndex, errors, warnings, dealLabel);
  if (deal.rule_type === 'min_quantity') validateMinQuantityRule(deal, referenceIndex, errors, warnings, dealLabel);
  if (deal.rule_type === 'tiered') validateTieredRule(deal, referenceIndex, errors, warnings, dealLabel);
  if (deal.rule_type === 'two_for_one') validateTwoForOneRule(deal, referenceIndex, errors, warnings, dealLabel);
  if (deal.rule_type === 'percentage_discount') validatePercentageDiscountRule(deal, referenceIndex, errors, dealLabel);
  if (deal.rule_type === 'subtotal_threshold') validateSubtotalThresholdRule(deal, errors, dealLabel);
  if (deal.rule_type === 'free_delivery') validateFreeDeliveryRule(deal, errors, dealLabel);
  if (deal.rule_type === 'free_item_with_purchase') validateFreeItemWithPurchaseRule(deal, referenceIndex, errors, warnings, dealLabel);
  if (deal.rule_type === 'buy_n_get_m') validateBuyNGetMRule(deal, referenceIndex, errors, dealLabel);
  if (deal.rule_type === 'volume_pricing') validateVolumePricingRule(deal, referenceIndex, errors, dealLabel);
  if (deal.rule_type === 'free_modifier') validateFreeModifierRule(deal, referenceIndex, errors, warnings, dealLabel);

  validateDealSchedule(deal, errors, dealLabel);

  return { errors: errors, warnings: warnings };
}

function validateCampaign(campaign, referenceIndex) {
  var errors = [];
  var warnings = [];
  var campaignLabel = 'Campaign "' + (campaign.title || campaign.id || 'untitled') + '"';

  if (!campaign.id) errors.push(campaignLabel + ': id is missing.');
  if (!campaign.title) errors.push(campaignLabel + ': title is required.');
  if (!(campaign.required_item_count >= 2)) errors.push(campaignLabel + ': the required item count must be 2 or more.');
  if (typeof campaign.same_size !== 'boolean') errors.push(campaignLabel + ': same size must be true or false.');

  var categoryIds = campaign.category_ids || [];
  var itemIds = campaign.item_ids || [];
  if (categoryIds.length === 0 && itemIds.length === 0) {
    errors.push(campaignLabel + ': choose at least one category or item.');
  } else {
    var matches = collectMatchingItems({ categoryIds: categoryIds, itemIds: itemIds }, referenceIndex);
    if (matches.length === 0) errors.push(campaignLabel + ': the filters match no menu items.');
  }

  if (campaign.pricing !== CAMPAIGN_PRICING_VALUE) {
    warnings.push(campaignLabel + ': pricing "' + (campaign.pricing || '') + '" is not supported; the website only understands "' + CAMPAIGN_PRICING_VALUE + '".');
  }

  return { errors: errors, warnings: warnings };
}

function validatePromotions(promotions) {
  var errors = [];
  var warnings = [];

  (promotions || []).forEach(function (promotion, index) {
    if (!promotion.title) errors.push('Promotion ' + (index + 1) + ': title is required.');
  });

  if ((promotions || []).length > PROMOTION_LIMIT) {
    warnings.push('Only the first ' + PROMOTION_LIMIT + ' promotions are shown on the website; ' + promotions.length + ' are stored.');
  }

  return { errors: errors, warnings: warnings };
}

function describePromoCode(promoCode) {
  return 'Promo code "' + (promoCode.code || promoCode.title || promoCode.id || 'untitled') + '"';
}

function validatePromoCodeRule(promoCode, errors, promoCodeLabel) {
  var rule = promoCode.rule || {};

  if (promoCode.rule_type === 'percentage_discount') {
    if (rule.percent === null || rule.percent === undefined || !(rule.percent >= 1) || !(rule.percent <= 100)) {
      errors.push(promoCodeLabel + ': the percent must be between 1 and 100.');
    }
    return;
  }

  if (promoCode.rule_type === 'subtotal_threshold') {
    if (rule.min_subtotal === null || rule.min_subtotal === undefined || !(rule.min_subtotal >= 0)) {
      errors.push(promoCodeLabel + ': the minimum subtotal must be zero or more.');
    }
    if (rule.discount === null || rule.discount === undefined || !(rule.discount >= 0)) {
      errors.push(promoCodeLabel + ': the discount must be zero or more.');
    } else if (rule.min_subtotal !== null && rule.min_subtotal !== undefined && rule.discount > rule.min_subtotal) {
      errors.push(promoCodeLabel + ': the discount cannot be higher than the minimum subtotal.');
    }
    return;
  }

  if (promoCode.rule_type === 'free_delivery') {
    if (rule.min_subtotal !== undefined && rule.min_subtotal !== null && !(rule.min_subtotal >= 0)) {
      errors.push(promoCodeLabel + ': the minimum subtotal must be zero or more.');
    }
    if (typeof rule.always !== 'boolean') errors.push(promoCodeLabel + ': always must be true or false.');
  }
}

function validatePromoCodes(promoCodes) {
  var errors = [];
  var warnings = [];
  var seenCodes = {};

  (promoCodes || []).forEach(function (promoCode) {
    var promoCodeLabel = describePromoCode(promoCode);
    if (!promoCode.code) {
      errors.push(promoCodeLabel + ': the code is required.');
    } else if (seenCodes[promoCode.code.toUpperCase()]) {
      errors.push(promoCodeLabel + ': this code is already used.');
    } else {
      seenCodes[promoCode.code.toUpperCase()] = true;
    }
    if (!promoCode.title) errors.push(promoCodeLabel + ': title is required.');
    if (PROMO_CODE_RULE_TYPES.indexOf(promoCode.rule_type) === -1) {
      errors.push(promoCodeLabel + ': rule type "' + (promoCode.rule_type || '') + '" is not supported for promo codes.');
    } else {
      validatePromoCodeRule(promoCode, errors, promoCodeLabel);
    }
    if (promoCode.max_uses !== null && promoCode.max_uses !== undefined && !isPositiveInteger(promoCode.max_uses)) {
      errors.push(promoCodeLabel + ': max uses must be a whole number of 1 or more, or empty for unlimited.');
    }
  });

  return { errors: errors, warnings: warnings };
}

function appendValidationReport(targetReport, sourceReport) {
  targetReport.errors = targetReport.errors.concat(sourceReport.errors);
  targetReport.warnings = targetReport.warnings.concat(sourceReport.warnings);
}

function validatePresentationDocument(documentData) {
  var referenceIndex = buildMenuReferenceIndex(documentData);
  var report = { errors: [], warnings: [] };

  (documentData.deals || []).forEach(function (deal) {
    appendValidationReport(report, validateDeal(deal, referenceIndex));
  });
  (documentData.campaigns || []).forEach(function (campaign) {
    appendValidationReport(report, validateCampaign(campaign, referenceIndex));
  });
  appendValidationReport(report, validatePromotions(documentData.promotions));
  appendValidationReport(report, validatePromoCodes(documentData.promo_codes));

  return report;
}

/* Console helpers for the test harness and for quick manual checks. */
window.rammDeals = {
  ruleTypes: DEAL_RULE_TYPES.slice(),
  promoCodeRuleTypes: PROMO_CODE_RULE_TYPES.slice(),
  buildMenuReferenceIndex: buildMenuReferenceIndex,
  normalizePresentationSections: normalizePresentationSections,
  validateDeal: validateDeal,
  validateCampaign: validateCampaign,
  validatePromoCodes: validatePromoCodes,
  validatePresentationDocument: validatePresentationDocument,
  getLastSaveBlockedReport: function () { return lastSaveBlockedReport; }
};

/* ===== SAVE ===== */
var saveTimeout = null;
function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(function() {
    var validationReport = validatePresentationDocument(data);
    if (validationReport.errors.length > 0) {
      lastSaveBlockedReport = validationReport;
      var extraCount = validationReport.errors.length - 1;
      tool.notify(
        'Not saved: ' + validationReport.errors[0] + (extraCount > 0 ? ' (+' + extraCount + ' more)' : ''),
        'error'
      );
      console.error('[SAVE BLOCKED]', validationReport.errors, validationReport.warnings);
      return;
    }
    lastSaveBlockedReport = null;
    if (validationReport.warnings.length > 0) {
      console.warn('[SAVE WARNINGS]', validationReport.warnings);
    }
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

  /* Coordinate hint and state/province tax template hint */
  updateCoordinateHint();
  renderTaxTemplateHint();
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

  var initialMapCenter = resolveMapCenter();
  zoneMap = L.map('delivery-map', { center: [initialMapCenter.latitude, initialMapCenter.longitude], zoom: 12, zoomControl: true });
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
  updateRestaurantMarker();
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

  /* "All categories" row - clears the category filter */
  var allEl = document.createElement('div');
  allEl.className = 'category-item all-cat-item' + (selectedCategoryId ? '' : ' active');
  allEl.innerHTML =
    '<span class="drag-handle" style="visibility:hidden;">⋮⋮</span>' +
    '<span class="all-cat-icon">▤</span>' +
    '<span class="cat-name">All categories</span>' +
    '<span class="cat-count">' + (data.menu.items || []).length + '</span>' +
    '<span class="cat-actions"></span>';
  allEl.addEventListener('click', function () { selectCategory(null); });
  list.appendChild(allEl);

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

    /* Group row — two-line layout: name on top, metadata below */
    var el = document.createElement('div');
    el.className = 'modgroup-item' + (editingModGroupId === mg.id ? ' active' : '') + (highlightedModGroupId === mg.id ? ' highlighted' : '');
    el.dataset.mgId = mg.id;

    /* Top row: expand, filter, name, actions */
    var topRow = document.createElement('div');
    topRow.className = 'mg-row-top';
    topRow.innerHTML =
      '<span class="mg-expand">' + (isExpanded ? '▼' : '▶') + '</span>' +
      '<span class="mg-name">' + esc(mg.group_name) + '</span>' +
      '<span class="mg-actions"><button class="mg-edit-btn" title="Edit">✎</button></span>';
    el.appendChild(topRow);

    /* Bottom row: metadata */
    var bottomRow = document.createElement('div');
    bottomRow.className = 'mg-row-bottom';
    bottomRow.innerHTML =
      '<span class="mg-meta">' + (hasOpts ? mg.options.length + ' options' : '0 options') + ' · ' +
      (mg.selection_type === 'single' ? 'Single' : 'Multi') +
      (mg.allow_duplicates ? ' · Dup' : '') +
      (mg.is_required ? ' · Req' : '') +
      (mg.force_min > 0 ? ' · Min ' + mg.force_min : '') +
      (mg.force_max > 0 ? ' · Max ' + mg.force_max : '') + '</span>';
    el.appendChild(bottomRow);

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

  if (items.length === 0) {
    grid.innerHTML = selectedCategoryId
      ? '<div class="empty-state">No items in this category yet.<br>Click "+ Add Item" to add the first one.</div>'
      : '<div class="empty-state">No items yet.<br>Click "+ Add Item" to add the first one.</div>';
    return;
  }

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

/* ---- T-29: find the deals that list an item (D-RAMM-17) ---- */
function findDealsReferencingItem(itemId) {
  var referencingDeals = [];
  (data.deals || []).forEach(function (deal) {
    var rule = isPlainObject(deal.rule) ? deal.rule : {};
    /* A tiered deal's item_ids is its fixed list - breaking when the item disappears. */
    if (deal.rule_type === 'tiered' && (rule.item_ids || []).indexOf(itemId) !== -1) {
      referencingDeals.push(deal);
      return;
    }
    /* A bundle group with item_ids is a fixed extra - same breakage. */
    if (deal.rule_type === 'bundle') {
      var listedInFixedExtra = (rule.groups || []).some(function (group) {
        return (group.item_ids || []).indexOf(itemId) !== -1;
      });
      if (listedInFixedExtra) referencingDeals.push(deal);
    }
  });
  return referencingDeals;
}

function describeReferencingDeals(referencingDeals) {
  var names = referencingDeals.map(function (deal) { return '"' + (deal.title || 'Untitled deal') + '"'; });
  if (names.length <= 3) return names.join(', ');
  return names.slice(0, 3).join(', ') + ' and ' + (names.length - 3) + ' more';
}

function deleteItem() {
  if (!editingItemId) return;

  /* T-29: block deleting an item that a deal lists (D-RAMM-17). */
  var referencingDeals = findDealsReferencingItem(editingItemId);
  if (referencingDeals.length > 0) {
    tool.notify(
      'Cannot delete this item: it is listed in ' + describeReferencingDeals(referencingDeals) + '. Edit or delete those deals first.',
      'warning'
    );
    return;
  }

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

  /* General Info: coordinate picker */
  var openCoordinateMapButton = document.getElementById('gen-coord-open-map-btn');
  if (openCoordinateMapButton) openCoordinateMapButton.addEventListener('click', openCoordinatePicker);
  var applyCoordinateLinkButton = document.getElementById('gen-coord-maps-apply');
  if (applyCoordinateLinkButton) applyCoordinateLinkButton.addEventListener('click', applyCoordinateMapsLink);
  var coordinateLinkInput = document.getElementById('gen-coord-maps-link');
  if (coordinateLinkInput) {
    coordinateLinkInput.addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyCoordinateMapsLink();
      }
    });
  }

  /* Tax: add category */
  var addTaxBtn = document.getElementById('tax-add-cat');
  if (addTaxBtn) addTaxBtn.addEventListener('click', addTaxCategory);

  /* Tax: state / province template */
  var taxTemplateButton = document.getElementById('tax-apply-template-btn');
  if (taxTemplateButton) taxTemplateButton.addEventListener('click', openTaxTemplateConfirm);
  var taxTemplateApplyButton = document.getElementById('tax-template-apply-btn');
  if (taxTemplateApplyButton) taxTemplateApplyButton.addEventListener('click', applyTaxTemplate);
  var taxTemplateCancelButton = document.getElementById('tax-template-cancel-btn');
  if (taxTemplateCancelButton) taxTemplateCancelButton.addEventListener('click', cancelTaxTemplate);

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
  var zoneCenterButton = document.getElementById('zone-center-btn');
  if (zoneCenterButton) zoneCenterButton.addEventListener('click', centerZoneMapOnRestaurant);

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

  /* Gloria Import */
  var gloriaImportBtn = document.getElementById('menu-import-gloria-btn');
  if (gloriaImportBtn) gloriaImportBtn.addEventListener('click', openGloriaImportModal);
  document.getElementById('gloria-import-run').addEventListener('click', importGloriaMenu);
  document.getElementById('gloria-import-cancel').addEventListener('click', closeGloriaImportModal);

  /* Sample Menu Import */
  var menuSampleBtn = document.getElementById('menu-import-sample-btn');
  if (menuSampleBtn) menuSampleBtn.addEventListener('click', openMenuImportModal);
  var menuImportRunBtn = document.getElementById('menu-import-run');
  if (menuImportRunBtn) menuImportRunBtn.addEventListener('click', runMenuImport);
  var menuImportCancelBtn = document.getElementById('menu-import-cancel');
  if (menuImportCancelBtn) menuImportCancelBtn.addEventListener('click', closeMenuImportModal);
  var menuImportCloseBtn = document.getElementById('menu-import-close');
  if (menuImportCloseBtn) menuImportCloseBtn.addEventListener('click', closeMenuImportModal);
  wireJsonFilePicker('menu-import-file-input', 'menu-import-file-btn', 'menu-import-file-name', 'menu-import-json');

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

  /* Deals tab: sub-tabs, list actions, editor and rule editors */
  wireDealEditor();
  wireDealAiDialog();

  /* Campaigns, hero and promotions editors (T-17 to T-20) */
  wirePresentationEditors();

  /* Promo codes section (T-40) */
  wirePromoCodeEditor();
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
/* DEALS TAB - list, ordering, editor and rule editors (T-06 to T-16) */
/* ===================================================================== */

var editingDealId = null;
var pendingDealDeleteId = null;
var draggedDealId = null;

function isDealEditingBlocked() {
  return !!(tool.isReadOnly && tool.isReadOnly());
}

/* ---------- List helpers ---------- */
function groupDealsBySection(deals) {
  var sectionOrder = [];
  var groups = {};
  (deals || []).forEach(function (deal) {
    var sectionName = deal.section || '';
    if (!groups[sectionName]) {
      groups[sectionName] = [];
      sectionOrder.push(sectionName);
    }
    groups[sectionName].push(deal);
  });
  return sectionOrder.map(function (sectionName) {
    return { section: sectionName, deals: groups[sectionName] };
  });
}

function describeDealRule(deal) {
  var rule = deal.rule || {};
  if (deal.rule_type === 'bundle') return 'Bundle · ' + ((rule.groups || []).length) + ' group(s)';
  if (deal.rule_type === 'min_quantity') return 'Minimum ' + (rule.min_quantity || 0) + ' items · per unit';
  if (deal.rule_type === 'tiered') return 'Tiered · ' + ((rule.tiers || []).length) + ' tier(s)';
  if (deal.rule_type === 'two_for_one') return 'Two for one · pick ' + (rule.required_item_count || 0);
  if (deal.rule_type === 'percentage_discount') return 'Percent off · ' + (rule.percent || 0) + '%';
  if (deal.rule_type === 'subtotal_threshold') return 'Save ' + (rule.discount || 0) + ' over ' + (rule.min_subtotal || 0);
  if (deal.rule_type === 'free_delivery') return rule.always ? 'Free delivery always' : 'Free delivery over ' + (rule.min_subtotal || 0);
  if (deal.rule_type === 'free_item_with_purchase') return 'Free item · ' + ((rule.groups || []).length) + ' group(s)';
  if (deal.rule_type === 'buy_n_get_m') return 'Buy ' + (rule.required_item_count || 0) + ' get ' + (rule.free_item_count || 0) + ' free';
  if (deal.rule_type === 'volume_pricing') return 'Volume · ' + ((rule.bands || []).length) + ' band(s)';
  if (deal.rule_type === 'free_modifier') return 'Free modifier · ' + (rule.option_count || 0) + ' option(s)';
  return 'Unsupported type: ' + (deal.rule_type || 'none');
}

function describeDealPrice(deal) {
  var rule = deal.rule || {};
  if (deal.rule_type === 'bundle' || deal.rule_type === 'min_quantity') {
    if (deal.price === null || deal.price === undefined) return 'No price yet';
    return '$' + Number(deal.price).toFixed(2);
  }
  if (deal.rule_type === 'percentage_discount') return '−' + (rule.percent || 0) + '%';
  if (deal.rule_type === 'subtotal_threshold') return '−$' + Number(rule.discount || 0).toFixed(2);
  if (deal.rule_type === 'free_delivery') return 'Free delivery';
  if (deal.rule_type === 'volume_pricing') {
    var firstBand = (rule.bands || [])[0];
    if (firstBand && firstBand.unit_price !== null && firstBand.unit_price !== undefined) {
      return 'From $' + Number(firstBand.unit_price).toFixed(2);
    }
    return 'From bands';
  }
  return 'Price from picks';
}

function describeDealSchedule(deal) {
  var schedule = deal.schedule;
  if (!isPlainObject(schedule)) return '';
  var parts = [];
  if (schedule.date_from || schedule.date_until) {
    parts.push((schedule.date_from || '?') + ' → ' + (schedule.date_until || '?'));
  }
  if ((schedule.weekdays || []).length > 0) {
    parts.push(schedule.weekdays.map(function (weekday) { return DAY_NAMES[weekday - 1] || weekday; }).join('·'));
  }
  if (schedule.time_from || schedule.time_until) {
    parts.push((schedule.time_from || '?') + '–' + (schedule.time_until || '?'));
  }
  return parts.join(' · ');
}

function renderDealCardHtml(deal) {
  var referenceIndex = buildMenuReferenceIndex(data);
  var report = validateDeal(deal, referenceIndex);
  var badges = '';
  if (deal.active === false) {
    badges += '<span class="deal-badge deal-badge-inactive" title="The website hides this deal from the Deals page">Inactive (hidden)</span>';
  }
  var scheduleText = describeDealSchedule(deal);
  if (scheduleText) {
    badges += '<span class="deal-badge deal-badge-scheduled" title="Scheduled: ' + esc(scheduleText) + '">🕐</span>';
  }
  if (report.errors.length > 0) {
    badges += '<span class="deal-badge deal-badge-error" title="' + esc(report.errors[0]) + '">Needs a fix</span>';
  } else if (report.warnings.length > 0) {
    badges += '<span class="deal-badge deal-badge-warning" title="' + esc(report.warnings[0]) + '">Check</span>';
  }

  var thumbHtml = deal.image_url
    ? '<div class="deal-card-thumb" style="background-image:url(' + esc(deal.image_url) + ')"></div>'
    : '<div class="deal-card-thumb deal-card-thumb-empty">🏷️</div>';

  return '<div class="deal-card" draggable="true" data-deal-id="' + esc(deal.id) + '">' +
    thumbHtml +
    '<div class="deal-card-body">' +
      '<div class="deal-card-title">' + esc(deal.title || 'Untitled deal') + badges + '</div>' +
      '<div class="deal-card-meta"><span>' + esc(describeDealRule(deal)) + '</span>' +
        '<span class="deal-card-price">' + esc(describeDealPrice(deal)) + '</span></div>' +
      (deal.description ? '<div class="deal-card-desc">' + esc(deal.description) + '</div>' : '') +
    '</div>' +
    '<div class="deal-card-actions">' +
      '<button type="button" class="deal-card-btn" data-deal-action="edit" title="Edit">✎</button>' +
      '<button type="button" class="deal-card-btn" data-deal-action="duplicate" title="Duplicate">📋</button>' +
      '<button type="button" class="deal-card-btn deal-card-btn-danger" data-deal-action="delete" title="Delete">🗑</button>' +
    '</div>' +
  '</div>';
}

function refreshDealSectionOptions() {
  var dataList = document.getElementById('deal-section-options');
  if (!dataList) return;
  var seenSections = {};
  (data.deals || []).forEach(function (deal) {
    var sectionName = deal.section || '';
    if (sectionName) seenSections[sectionName] = true;
  });
  dataList.innerHTML = Object.keys(seenSections).sort().map(function (sectionName) {
    return '<option value="' + esc(sectionName) + '"></option>';
  }).join('');
}

function renderDeals() {
  var listContainer = document.getElementById('deals-list');
  if (!listContainer) return;

  refreshDealSectionOptions();

  var deals = data.deals || [];
  if (deals.length === 0) {
    listContainer.innerHTML = '<div class="empty-state"><strong>No deals yet.</strong><br>Click "+ Add Deal" to create the first customer offer.</div>';
    return;
  }

  listContainer.innerHTML = groupDealsBySection(deals).map(function (group) {
    var sectionName = group.section || 'No section';
    return '<div class="deals-section" data-deal-section="' + esc(group.section) + '">' +
      '<div class="deals-section-header">' +
        '<span class="deals-section-name">' + esc(sectionName) + '</span>' +
        '<span class="deals-section-count">' + group.deals.length + '</span>' +
      '</div>' +
      '<div class="deals-section-cards">' + group.deals.map(renderDealCardHtml).join('') + '</div>' +
    '</div>';
  }).join('');

  wireDealCardEvents();

  if (isDealEditingBlocked()) lockUI(true);
}

function clearDealDropMarkers() {
  document.querySelectorAll('.deal-card.drop-before, .deal-card.drop-after').forEach(function (card) {
    card.classList.remove('drop-before', 'drop-after');
  });
  document.querySelectorAll('.deals-section.drop-target').forEach(function (section) {
    section.classList.remove('drop-target');
  });
}

function wireDealCardEvents() {
  var listContainer = document.getElementById('deals-list');
  if (!listContainer) return;

  listContainer.querySelectorAll('.deal-card').forEach(function (card) {
    var dealId = card.dataset.dealId;

    card.addEventListener('click', function (event) {
      var actionButton = event.target.closest('[data-deal-action]');
      if (!actionButton) {
        openDealEditor(dealId);
        return;
      }
      event.stopPropagation();
      var action = actionButton.dataset.dealAction;
      if (action === 'edit') openDealEditor(dealId);
      if (action === 'duplicate') duplicateDeal(dealId);
      if (action === 'delete') openDealDeleteConfirm(dealId);
    });

    card.addEventListener('dragstart', function (event) {
      if (isDealEditingBlocked()) { event.preventDefault(); return; }
      draggedDealId = dealId;
      card.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', dealId);
    });

    card.addEventListener('dragend', function () {
      card.classList.remove('dragging');
      draggedDealId = null;
      clearDealDropMarkers();
    });

    card.addEventListener('dragover', function (event) {
      if (!draggedDealId || draggedDealId === dealId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      var cardRect = card.getBoundingClientRect();
      var isAfter = (event.clientY - cardRect.top) > (cardRect.height / 2);
      card.classList.toggle('drop-after', isAfter);
      card.classList.toggle('drop-before', !isAfter);
    });

    card.addEventListener('dragleave', function () {
      card.classList.remove('drop-before', 'drop-after');
    });

    card.addEventListener('drop', function (event) {
      event.preventDefault();
      event.stopPropagation();
      var isAfter = card.classList.contains('drop-after');
      card.classList.remove('drop-before', 'drop-after');
      if (draggedDealId) moveDealRelativeTo(draggedDealId, dealId, isAfter);
    });
  });

  listContainer.querySelectorAll('.deals-section').forEach(function (sectionElement) {
    sectionElement.addEventListener('dragover', function (event) {
      if (!draggedDealId || event.target.closest('.deal-card')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      sectionElement.classList.add('drop-target');
    });
    sectionElement.addEventListener('dragleave', function (event) {
      if (event.target.closest('.deal-card')) return;
      sectionElement.classList.remove('drop-target');
    });
    sectionElement.addEventListener('drop', function (event) {
      if (event.target.closest('.deal-card')) return;
      event.preventDefault();
      sectionElement.classList.remove('drop-target');
      if (draggedDealId) moveDealIntoSection(draggedDealId, sectionElement.dataset.dealSection || '');
    });
  });
}

function moveDealRelativeTo(draggedId, targetId, placeAfter) {
  var draggedIndex = (data.deals || []).findIndex(function (deal) { return deal.id === draggedId; });
  if (draggedIndex < 0) return;
  var draggedDeal = data.deals.splice(draggedIndex, 1)[0];

  var targetIndex = data.deals.findIndex(function (deal) { return deal.id === targetId; });
  if (targetIndex < 0) {
    data.deals.splice(draggedIndex, 0, draggedDeal);
    return;
  }

  draggedDeal.section = data.deals[targetIndex].section || '';
  data.deals.splice(placeAfter ? targetIndex + 1 : targetIndex, 0, draggedDeal);
  renderDeals();
  scheduleSave();
}

function moveDealIntoSection(draggedId, sectionName) {
  var draggedIndex = (data.deals || []).findIndex(function (deal) { return deal.id === draggedId; });
  if (draggedIndex < 0) return;
  var draggedDeal = data.deals.splice(draggedIndex, 1)[0];
  draggedDeal.section = sectionName || '';

  var insertIndex = data.deals.length;
  for (var index = data.deals.length - 1; index >= 0; index--) {
    if ((data.deals[index].section || '') === draggedDeal.section) {
      insertIndex = index + 1;
      break;
    }
  }
  data.deals.splice(insertIndex, 0, draggedDeal);
  renderDeals();
  scheduleSave();
}

/* ---------- Editor ---------- */
function setDealImagePreview(imageUrl) {
  var preview = document.getElementById('deal-image-preview');
  if (!preview) return;
  preview.innerHTML = imageUrl ? '<img src="' + esc(imageUrl) + '" alt="">' : '<span>🏷️</span>';
}

function renderDealCategoryChips(selectedCategoryIds) {
  var referenceIndex = buildMenuReferenceIndex(data);
  if (referenceIndex.categoryIds.length === 0) {
    return '<p class="deal-empty-hint">No menu categories yet. Create a category in the Menu tab first.</p>';
  }
  return '<div class="deal-category-chips">' + referenceIndex.categoryIds.map(function (categoryId) {
    var category = referenceIndex.categoriesById[categoryId];
    var isSelected = (selectedCategoryIds || []).indexOf(categoryId) !== -1;
    return '<button type="button" class="chip deal-category-chip' + (isSelected ? ' active' : '') + '" data-deal-category="' + esc(categoryId) + '">' +
      esc(category && category.name ? category.name : categoryId) + '</button>';
  }).join('') + '</div>';
}

function renderDealItemPicker(selectedItemIds, checkboxClass) {
  var referenceIndex = buildMenuReferenceIndex(data);
  if (referenceIndex.items.length === 0) {
    return '<p class="deal-empty-hint">No menu items yet. Create items in the Menu tab first.</p>';
  }
  return '<div class="deal-item-picker">' + referenceIndex.items.map(function (item) {
    var isChecked = (selectedItemIds || []).indexOf(item.id) !== -1;
    var sizeLabels = (item.sizes || []).map(function (size) { return size.label; }).filter(Boolean);
    return '<label class="deal-item-option">' +
      '<input type="checkbox" class="' + checkboxClass + '" data-deal-item="' + esc(item.id) + '"' + (isChecked ? ' checked="checked"' : '') + '>' +
      '<span>' + esc(item.item_name || item.id) + '</span>' +
      (sizeLabels.length > 0 ? '<span class="deal-item-sizes">' + esc(sizeLabels.join(' / ')) + '</span>' : '') +
    '</label>';
  }).join('') + '</div>';
}

function renderDealSizeSelect(selectedSizeLabel, cssClass) {
  var referenceIndex = buildMenuReferenceIndex(data);
  var options = '<option value="">Any size</option>' + referenceIndex.sizeLabels.map(function (sizeLabel) {
    return '<option value="' + esc(sizeLabel) + '"' + (sizeLabel === selectedSizeLabel ? ' selected' : '') + '>' + esc(sizeLabel) + '</option>';
  }).join('');
  return '<select class="form-input ' + cssClass + '">' + options + '</select>';
}

function renderDealGroupCard(group, groupIndex, options) {
  var includeCharge = !!(options && options.includeCharge);
  var isFixedExtra = (group.item_ids || []).length > 0;
  var charge = group.charge === 'free' ? 'free' : 'paid';
  return '<div class="deal-group-card" data-group-id="' + esc(group.group_id || uid()) + '">' +
    '<div class="deal-group-top">' +
      '<div class="form-group"><label class="form-label">Group label</label>' +
        '<input type="text" class="form-input deal-group-label" value="' + esc(group.label || '') + '" placeholder="e.g. Pizzas"></div>' +
      '<div class="form-group deal-group-quantity-group"><label class="form-label">How many</label>' +
        '<input type="number" class="form-input deal-group-quantity" min="1" step="1" value="' + (group.quantity || 1) + '"></div>' +
      (includeCharge
        ? '<div class="form-group deal-group-quantity-group"><label class="form-label">Charge</label>' +
          '<select class="form-input deal-group-charge">' +
            '<option value="paid"' + (charge === 'paid' ? ' selected' : '') + '>Paid</option>' +
            '<option value="free"' + (charge === 'free' ? ' selected' : '') + '>Free</option>' +
          '</select></div>'
        : '') +
      '<button type="button" class="deal-group-remove" data-deal-remove-group title="Remove group">✕</button>' +
    '</div>' +
    '<div class="form-group"><label class="form-label">Option pool</label>' + renderDealCategoryChips(group.category_ids || []) + '</div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label class="form-label">Size filter</label>' + renderDealSizeSelect(group.size_label || '', 'deal-group-size') + '</div>' +
      '<div class="form-group"><label class="form-label">Name filter</label>' +
        '<input type="text" class="form-input deal-group-name-filter" value="' + esc(group.name_filter || '') + '" placeholder="Optional text in the item name"></div>' +
    '</div>' +
    '<div class="form-group"><label class="form-label">Fixed extras (optional)</label>' +
      '<p class="deal-rule-hint">Tick any item here and the group becomes a fixed extra: the customer picks nothing and the filters above are ignored.</p>' +
      renderDealItemPicker(group.item_ids || [], 'deal-group-item') + '</div>' +
    (isFixedExtra ? '<p class="deal-rule-hint"><strong>This group is a fixed extra.</strong></p>' : '') +
  '</div>';
}

function renderDealTierRow(tier, tierIndex) {
  return '<div class="deal-tier-row">' +
    '<div class="form-group deal-tier-number-group"><label class="form-label">Quantity</label>' +
      '<input type="number" class="form-input deal-tier-quantity" min="1" step="1" value="' + (tier.quantity || 1) + '"></div>' +
    '<div class="form-group deal-tier-number-group"><label class="form-label">Price</label>' +
      '<input type="number" class="form-input deal-tier-price" min="0" step="0.01" value="' + (tier.price === null || tier.price === undefined ? '' : tier.price) + '"></div>' +
    '<div class="form-group deal-tier-label-group"><label class="form-label">Label</label>' +
      '<input type="text" class="form-input deal-tier-label" value="' + esc(tier.label || '') + '" placeholder="e.g. 2 pizzas for 24"></div>' +
    '<button type="button" class="deal-group-remove" data-deal-remove-tier title="Remove tier">✕</button>' +
  '</div>';
}

function renderDealVolumeBandRow(band, bandIndex) {
  return '<div class="deal-band-row">' +
    '<div class="form-group deal-band-number-group"><label class="form-label">From quantity</label>' +
      '<input type="number" class="form-input deal-band-min" min="1" step="1" value="' + (band.min_quantity || 1) + '"></div>' +
    '<div class="form-group deal-band-number-group"><label class="form-label">Unit price</label>' +
      '<input type="number" class="form-input deal-band-price" min="0" step="0.01" value="' + (band.unit_price === null || band.unit_price === undefined ? '' : band.unit_price) + '"></div>' +
    '<button type="button" class="deal-group-remove" data-deal-remove-band title="Remove band">✕</button>' +
  '</div>';
}

function renderDealModifierGroupChips(selectedGroupIds) {
  var groups = (data.menu && Array.isArray(data.menu.modifier_groups)) ? data.menu.modifier_groups : [];
  if (groups.length === 0) {
    return '<p class="deal-empty-hint">No modifier groups yet. Create modifier groups in the Menu tab first.</p>';
  }
  return '<div class="deal-category-chips">' + groups.map(function (group) {
    var isSelected = (selectedGroupIds || []).indexOf(group.id) !== -1;
    return '<button type="button" class="chip deal-mod-group' + (isSelected ? ' active' : '') + '" data-deal-mod-group="' + esc(group.id) + '">' +
      esc(group.group_name || group.id) + '</button>';
  }).join('') + '</div>';
}

function renderDealScheduleEditor(schedule) {
  var scheduleData = schedule || {};
  var weekdays = scheduleData.weekdays || [];
  var weekdayChips = [1, 2, 3, 4, 5, 6, 7].map(function (weekday) {
    var isActive = weekdays.indexOf(weekday) !== -1;
    return '<button type="button" class="chip deal-weekday-chip' + (isActive ? ' active' : '') + '" data-deal-weekday="' + weekday + '">' + DAY_NAMES[weekday - 1] + '</button>';
  }).join('');
  return '<div class="deal-rule-block deal-schedule-block">' +
    '<div class="deal-rule-block-title">Schedule (optional)</div>' +
    '<p class="deal-rule-hint">Leave everything empty for an always-on deal. The website hides the deal outside this window.</p>' +
    '<div class="form-row">' +
      '<div class="form-group"><label class="form-label">From date</label><input type="date" class="form-input" id="deal-schedule-date-from" value="' + esc(scheduleData.date_from || '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Until date</label><input type="date" class="form-input" id="deal-schedule-date-until" value="' + esc(scheduleData.date_until || '') + '"></div>' +
    '</div>' +
    '<div class="form-group"><label class="form-label">Weekdays</label><div class="deal-weekday-chips">' + weekdayChips + '</div></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label class="form-label">From time</label><input type="time" class="form-input" id="deal-schedule-time-from" value="' + esc(scheduleData.time_from || '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Until time</label><input type="time" class="form-input" id="deal-schedule-time-until" value="' + esc(scheduleData.time_until || '') + '"></div>' +
    '</div>' +
  '</div>';
}

function renderDealRuleEditor(ruleType, rule) {
  var container = document.getElementById('deal-rule-editor');
  if (!container) return;
  var ruleData = rule || {};
  var html = '';

  if (ruleType === 'bundle') {
    var groups = (ruleData.groups && ruleData.groups.length > 0) ? ruleData.groups : [{ group_id: uid(), label: '', quantity: 1 }];
    html += '<div class="deal-rule-block">' +
      '<div class="deal-rule-block-title">Bundle groups</div>' +
      '<p class="deal-rule-hint">Each group is one choice the customer makes. The bundle price is the fixed total for everything.</p>' +
      '<div id="deal-groups">' + groups.map(renderDealGroupCard).join('') + '</div>' +
      '<div class="deal-inline-actions"><button type="button" class="btn btn-sm btn-outline" data-deal-add-group>+ Add group</button></div>' +
    '</div>';
  }

  if (ruleType === 'min_quantity') {
    html += '<div class="deal-rule-block">' +
      '<div class="deal-rule-block-title">Minimum quantity rule</div>' +
      '<p class="deal-rule-hint">The customer must pick at least this many items. The price above is charged per unit.</p>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Minimum quantity</label>' +
          '<input type="number" class="form-input" id="deal-min-quantity" min="2" step="1" value="' + (ruleData.min_quantity || 2) + '"></div>' +
        '<div class="form-group"><label class="form-label">Size filter</label>' + renderDealSizeSelect(ruleData.size_label || '', 'deal-min-size') + '</div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Categories</label>' + renderDealCategoryChips(ruleData.category_ids || []) + '</div>' +
    '</div>';
  }

  if (ruleType === 'tiered') {
    var tiers = (ruleData.tiers && ruleData.tiers.length > 0) ? ruleData.tiers : [{ quantity: 2, price: null, label: '' }];
    html += '<div class="deal-rule-block">' +
      '<div class="deal-rule-block-title">Tiered pricing</div>' +
      '<p class="deal-rule-hint">The customer picks from this fixed item list. The price comes from the matching tier, so the price field above stays empty.</p>' +
      '<div class="form-group"><label class="form-label">Items in this deal</label>' +
        renderDealItemPicker(ruleData.item_ids || [], 'deal-tier-item') + '</div>' +
      '<div class="form-group"><label class="form-label">Tiers</label><div id="deal-tiers">' +
        tiers.map(renderDealTierRow).join('') + '</div></div>' +
      '<div class="deal-inline-actions"><button type="button" class="btn btn-sm btn-outline" data-deal-add-tier>+ Add tier</button></div>' +
    '</div>';
  }

  if (ruleType === 'two_for_one') {
    html += '<div class="deal-rule-block">' +
      '<div class="deal-rule-block-title">Two for one rule</div>' +
      '<p class="deal-rule-hint">The customer picks the required number of items and the cheapest is free. The price field above stays empty.</p>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Items the customer picks</label>' +
          '<input type="number" class="form-input" id="deal-required-count" min="2" step="1" value="' + (ruleData.required_item_count || 2) + '"></div>' +
        '<div class="form-group"><label class="form-label">Same size only</label>' +
          '<label class="switch" style="margin-top:6px;"><input type="checkbox" id="deal-same-size"' + (ruleData.same_size !== false ? ' checked' : '') + '><span class="slider"></span></label></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Categories</label>' + renderDealCategoryChips(ruleData.category_ids || []) + '</div>' +
    '</div>';
  }

  if (ruleType === 'percentage_discount') {
    html += '<div class="deal-rule-block">' +
      '<div class="deal-rule-block-title">Percentage discount</div>' +
      '<p class="deal-rule-hint">Takes a percent off the eligible items. Leave categories and items empty to apply to the whole order.</p>' +
      '<div class="form-group"><label class="form-label">Percent off</label>' +
        '<input type="number" class="form-input" id="deal-percent" min="1" max="100" step="1" value="' + (ruleData.percent || 10) + '"></div>' +
      '<div class="form-group"><label class="form-label">Categories (optional)</label>' + renderDealCategoryChips(ruleData.category_ids || []) + '</div>' +
      '<div class="form-group"><label class="form-label">Items (optional)</label>' + renderDealItemPicker(ruleData.item_ids || [], 'deal-pct-item') + '</div>' +
    '</div>';
  }

  if (ruleType === 'subtotal_threshold') {
    html += '<div class="deal-rule-block">' +
      '<div class="deal-rule-block-title">Subtotal discount</div>' +
      '<p class="deal-rule-hint">Orders at or above the minimum subtotal save the fixed discount. The price field above stays empty.</p>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Minimum subtotal</label>' +
          '<input type="number" class="form-input" id="deal-threshold-min" min="0" step="0.01" value="' + (ruleData.min_subtotal === null || ruleData.min_subtotal === undefined ? '' : ruleData.min_subtotal) + '"></div>' +
        '<div class="form-group"><label class="form-label">Discount</label>' +
          '<input type="number" class="form-input" id="deal-threshold-discount" min="0" step="0.01" value="' + (ruleData.discount === null || ruleData.discount === undefined ? '' : ruleData.discount) + '"></div>' +
      '</div>' +
    '</div>';
  }

  if (ruleType === 'free_delivery') {
    html += '<div class="deal-rule-block">' +
      '<div class="deal-rule-block-title">Free delivery</div>' +
      '<p class="deal-rule-hint">The website zeroes the delivery fee. The price field above stays empty.</p>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Minimum subtotal (optional)</label>' +
          '<input type="number" class="form-input" id="deal-freedelivery-min" min="0" step="0.01" value="' + (ruleData.min_subtotal === null || ruleData.min_subtotal === undefined ? '' : ruleData.min_subtotal) + '"></div>' +
        '<div class="form-group"><label class="form-label">Always free</label>' +
          '<label class="switch" style="margin-top:6px;"><input type="checkbox" id="deal-freedelivery-always"' + (ruleData.always === true ? ' checked' : '') + '><span class="slider"></span></label></div>' +
      '</div>' +
    '</div>';
  }

  if (ruleType === 'free_item_with_purchase') {
    var paidFreeGroups = (ruleData.groups && ruleData.groups.length > 0) ? ruleData.groups : [{ group_id: uid(), label: '', quantity: 1, charge: 'paid' }];
    html += '<div class="deal-rule-block">' +
      '<div class="deal-rule-block-title">Paid + free groups</div>' +
      '<p class="deal-rule-hint">Each group is one choice the customer makes. Paid groups are charged; free groups come free with the purchase. The price field above stays empty.</p>' +
      '<div id="deal-groups">' + paidFreeGroups.map(function (group) { return renderDealGroupCard(group, 0, { includeCharge: true }); }).join('') + '</div>' +
      '<div class="deal-inline-actions"><button type="button" class="btn btn-sm btn-outline" data-deal-add-group>+ Add group</button></div>' +
    '</div>';
  }

  if (ruleType === 'buy_n_get_m') {
    html += '<div class="deal-rule-block">' +
      '<div class="deal-rule-block-title">Buy N get M free</div>' +
      '<p class="deal-rule-hint">The customer picks N paid products and M more that come free. The price field above stays empty.</p>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Paid items</label>' +
          '<input type="number" class="form-input" id="deal-bngm-required" min="2" step="1" value="' + (ruleData.required_item_count || 2) + '"></div>' +
        '<div class="form-group"><label class="form-label">Free items</label>' +
          '<input type="number" class="form-input" id="deal-bngm-free" min="1" step="1" value="' + (ruleData.free_item_count || 1) + '"></div>' +
        '<div class="form-group"><label class="form-label">Same size only</label>' +
          '<label class="switch" style="margin-top:6px;"><input type="checkbox" id="deal-bngm-same-size"' + (ruleData.same_size === true ? ' checked' : '') + '><span class="slider"></span></label></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Categories</label>' + renderDealCategoryChips(ruleData.category_ids || []) + '</div>' +
      '<div class="form-group"><label class="form-label">Items</label>' + renderDealItemPicker(ruleData.item_ids || [], 'deal-bngm-item') + '</div>' +
    '</div>';
  }

  if (ruleType === 'volume_pricing') {
    var volumeBands = (ruleData.bands && ruleData.bands.length > 0) ? ruleData.bands : [{ min_quantity: 1, unit_price: null }];
    html += '<div class="deal-rule-block">' +
      '<div class="deal-rule-block-title">Volume pricing</div>' +
      '<p class="deal-rule-hint">The unit price depends on the quantity band. The price field above stays empty.</p>' +
      '<div class="form-group"><label class="form-label">Categories</label>' + renderDealCategoryChips(ruleData.category_ids || []) + '</div>' +
      '<div class="form-group"><label class="form-label">Name filter (optional)</label>' +
        '<input type="text" class="form-input" id="deal-volume-name-filter" value="' + esc(ruleData.name_filter || '') + '" placeholder="Optional text in the item name"></div>' +
      '<div class="form-group"><label class="form-label">Quantity bands</label><div id="deal-volume-bands">' +
        volumeBands.map(renderDealVolumeBandRow).join('') + '</div></div>' +
      '<div class="deal-inline-actions"><button type="button" class="btn btn-sm btn-outline" data-deal-add-band>+ Add band</button></div>' +
    '</div>';
  }

  if (ruleType === 'free_modifier') {
    html += '<div class="deal-rule-block">' +
      '<div class="deal-rule-block-title">Free modifier options</div>' +
      '<p class="deal-rule-hint">The cheapest selected options from the chosen modifier groups come free. The price field above stays empty.</p>' +
      '<div class="form-group"><label class="form-label">Modifier groups</label>' + renderDealModifierGroupChips(ruleData.modifier_group_ids || []) + '</div>' +
      '<div class="form-group"><label class="form-label">Free options</label>' +
        '<input type="number" class="form-input" id="deal-freemod-option-count" min="1" step="1" value="' + (ruleData.option_count || 1) + '"></div>' +
      '<div class="form-group"><label class="form-label">Categories (optional)</label>' + renderDealCategoryChips(ruleData.category_ids || []) + '</div>' +
    '</div>';
  }

  container.innerHTML = html;
}

function renderDealScheduleTab(schedule) {
  var container = document.getElementById('deal-schedule-editor');
  if (!container) return;
  container.innerHTML = renderDealScheduleEditor(schedule);
}

function refreshDealScheduleTabBadge() {
  var tabButton = document.querySelector('#deal-editor-tabs .deal-modal-tab[data-deal-tab="schedule"]');
  if (!tabButton) return;
  tabButton.classList.toggle('has-value', collectDealScheduleFromForm() !== null);
}

function updateDealPriceFieldState(ruleType) {
  var priceInput = document.getElementById('deal-price');
  var priceHint = document.getElementById('deal-price-hint');
  if (!priceInput || !priceHint) return;

  var usesDealPrice = (ruleType === 'bundle' || ruleType === 'min_quantity');
  priceInput.disabled = !usesDealPrice;
  if (!usesDealPrice) priceInput.value = '';

  if (ruleType === 'bundle') priceHint.textContent = 'Fixed total price for the whole bundle.';
  else if (ruleType === 'min_quantity') priceHint.textContent = 'Price per unit. The customer pays this times the quantity.';
  else if (ruleType === 'tiered') priceHint.textContent = 'Not used: the tier sets the price.';
  else if (ruleType === 'two_for_one') priceHint.textContent = 'Not used: the cart charges the paid pick.';
  else if (ruleType === 'percentage_discount') priceHint.textContent = 'Not used: the discount is the percent.';
  else if (ruleType === 'subtotal_threshold') priceHint.textContent = 'Not used: the discount is the fixed amount.';
  else if (ruleType === 'free_delivery') priceHint.textContent = 'Not used: the cart drops the delivery fee.';
  else if (ruleType === 'free_item_with_purchase') priceHint.textContent = 'Not used: the paid group sets the price.';
  else if (ruleType === 'buy_n_get_m') priceHint.textContent = 'Not used: the cart charges the paid picks.';
  else if (ruleType === 'volume_pricing') priceHint.textContent = 'Not used: the bands set the unit price.';
  else if (ruleType === 'free_modifier') priceHint.textContent = 'Not used: the cart discounts the options.';
  else priceHint.textContent = '';
}

function collectDealBandsFromForm() {
  var bands = [];
  document.querySelectorAll('#deal-volume-bands .deal-band-row').forEach(function (row) {
    var minInput = row.querySelector('.deal-band-min');
    var priceInput = row.querySelector('.deal-band-price');
    bands.push({
      min_quantity: parseInt(minInput ? minInput.value : '1', 10) || 1,
      unit_price: readNumberOrNull(priceInput ? priceInput.value : '')
    });
  });
  return bands;
}

function collectDealScheduleFromForm() {
  var dateFromInput = document.getElementById('deal-schedule-date-from');
  var dateUntilInput = document.getElementById('deal-schedule-date-until');
  var timeFromInput = document.getElementById('deal-schedule-time-from');
  var timeUntilInput = document.getElementById('deal-schedule-time-until');
  var schedule = {};
  if (dateFromInput && dateFromInput.value) schedule.date_from = dateFromInput.value;
  if (dateUntilInput && dateUntilInput.value) schedule.date_until = dateUntilInput.value;
  var weekdays = Array.prototype.map.call(document.querySelectorAll('#deal-schedule-editor .deal-weekday-chip.active'), function (chip) {
    return parseInt(chip.dataset.dealWeekday, 10);
  }).filter(function (weekday) { return weekday >= 1 && weekday <= 7; });
  if (weekdays.length > 0) schedule.weekdays = weekdays;
  if (timeFromInput && timeFromInput.value) schedule.time_from = timeFromInput.value;
  if (timeUntilInput && timeUntilInput.value) schedule.time_until = timeUntilInput.value;
  if (Object.keys(schedule).length === 0) return null;
  return schedule;
}

function openDealEditor(dealId) {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }

  var deal = dealId ? (data.deals || []).find(function (entry) { return entry.id === dealId; }) : null;
  if (deal && DEAL_RULE_TYPES.indexOf(deal.rule_type) === -1) {
    tool.notify('This deal uses "' + deal.rule_type + '", which this tool cannot edit. Delete it or leave it unchanged.', 'warning');
    return;
  }

  editingDealId = deal ? deal.id : null;

  switchDealEditorTab('basics');

  document.getElementById('deal-editor-title').textContent = deal ? 'Edit Deal' : 'New Deal';
  document.getElementById('deal-title').value = deal ? (deal.title || '') : '';
  document.getElementById('deal-description').value = deal ? (deal.description || '') : '';
  document.getElementById('deal-section').value = deal ? (deal.section || '') : '';
  document.getElementById('deal-image-url').value = deal ? (deal.image_url || '') : '';
  document.getElementById('deal-active').checked = deal ? deal.active !== false : true;
  document.getElementById('deal-delete-btn').style.display = deal ? '' : 'none';
  document.getElementById('deal-editor-errors').style.display = 'none';

  var ruleType = deal ? deal.rule_type : 'bundle';
  document.getElementById('deal-rule-type').value = ruleType;

  var priceInput = document.getElementById('deal-price');
  priceInput.value = (deal && deal.price !== null && deal.price !== undefined) ? deal.price : '';
  updateDealPriceFieldState(ruleType);

  setDealImagePreview(deal ? deal.image_url : '');
  renderDealRuleEditor(ruleType, deal ? deal.rule : {});
  renderDealScheduleTab(deal ? deal.schedule : undefined);
  refreshDealScheduleTabBadge();
  renderDealMatchPreview();

  document.getElementById('deal-editor-modal').style.display = 'flex';
  tool.resize();
}

function closeDealEditor() {
  var modal = document.getElementById('deal-editor-modal');
  if (modal) modal.style.display = 'none';
  editingDealId = null;
}

function switchDealEditorTab(tabName) {
  var modal = document.getElementById('deal-editor-modal');
  if (!modal) return;
  modal.querySelectorAll('.deal-modal-tab').forEach(function (tabButton) {
    tabButton.classList.toggle('active', tabButton.dataset.dealTab === tabName);
  });
  modal.querySelectorAll('.deal-tab-content').forEach(function (tabContent) {
    tabContent.classList.toggle('active', tabContent.id === 'deal-tab-' + tabName);
  });
  tool.resize();
}

function collectDealDraftFromForm() {
  var ruleTypeInput = document.getElementById('deal-rule-type');
  if (!ruleTypeInput) return null;

  var draft = {
    id: editingDealId,
    title: readString(document.getElementById('deal-title').value),
    description: readString(document.getElementById('deal-description').value),
    section: readString(document.getElementById('deal-section').value),
    image_url: readString(document.getElementById('deal-image-url').value),
    active: document.getElementById('deal-active').checked,
    price: readNumberOrNull(document.getElementById('deal-price').value),
    rule_type: ruleTypeInput.value,
    rule: {}
  };

  if (draft.rule_type === 'bundle') {
    draft.rule.groups = collectDealGroupsFromForm();
  }

  if (draft.rule_type === 'min_quantity') {
    var minQuantityInput = document.getElementById('deal-min-quantity');
    var minSizeSelect = document.querySelector('#deal-rule-editor .deal-min-size');
    draft.rule = {
      category_ids: collectActiveCategoryIds('#deal-rule-editor'),
      min_quantity: parseInt(minQuantityInput ? minQuantityInput.value : '2', 10) || 2
    };
    if (minSizeSelect && minSizeSelect.value) draft.rule.size_label = minSizeSelect.value;
  }

  if (draft.rule_type === 'tiered') {
    draft.rule = {
      item_ids: collectCheckedDealItems('#deal-rule-editor .deal-tier-item'),
      tiers: collectDealTiersFromForm()
    };
  }

  if (draft.rule_type === 'two_for_one') {
    var requiredCountInput = document.getElementById('deal-required-count');
    var sameSizeInput = document.getElementById('deal-same-size');
    draft.rule = {
      required_item_count: parseInt(requiredCountInput ? requiredCountInput.value : '2', 10) || 2,
      category_ids: collectActiveCategoryIds('#deal-rule-editor'),
      same_size: !!(sameSizeInput && sameSizeInput.checked)
    };
  }

  if (draft.rule_type === 'percentage_discount') {
    var percentInput = document.getElementById('deal-percent');
    draft.rule = {
      percent: parseInt(percentInput ? percentInput.value : '10', 10) || 10,
      category_ids: collectActiveCategoryIds('#deal-rule-editor'),
      item_ids: collectCheckedDealItems('#deal-rule-editor .deal-pct-item')
    };
  }

  if (draft.rule_type === 'subtotal_threshold') {
    var thresholdMinInput = document.getElementById('deal-threshold-min');
    var thresholdDiscountInput = document.getElementById('deal-threshold-discount');
    draft.rule = {
      min_subtotal: readNumberOrNull(thresholdMinInput ? thresholdMinInput.value : ''),
      discount: readNumberOrNull(thresholdDiscountInput ? thresholdDiscountInput.value : '')
    };
  }

  if (draft.rule_type === 'free_delivery') {
    var freeDeliveryMinInput = document.getElementById('deal-freedelivery-min');
    var freeDeliveryAlwaysInput = document.getElementById('deal-freedelivery-always');
    draft.rule = {
      min_subtotal: readNumberOrNull(freeDeliveryMinInput ? freeDeliveryMinInput.value : ''),
      always: !!(freeDeliveryAlwaysInput && freeDeliveryAlwaysInput.checked)
    };
  }

  if (draft.rule_type === 'free_item_with_purchase') {
    draft.rule.groups = collectDealGroupsFromForm(true);
  }

  if (draft.rule_type === 'buy_n_get_m') {
    var bngmRequiredInput = document.getElementById('deal-bngm-required');
    var bngmFreeInput = document.getElementById('deal-bngm-free');
    var bngmSameSizeInput = document.getElementById('deal-bngm-same-size');
    draft.rule = {
      required_item_count: parseInt(bngmRequiredInput ? bngmRequiredInput.value : '2', 10) || 2,
      free_item_count: parseInt(bngmFreeInput ? bngmFreeInput.value : '1', 10) || 1,
      category_ids: collectActiveCategoryIds('#deal-rule-editor'),
      item_ids: collectCheckedDealItems('#deal-rule-editor .deal-bngm-item'),
      same_size: !!(bngmSameSizeInput && bngmSameSizeInput.checked)
    };
  }

  if (draft.rule_type === 'volume_pricing') {
    var volumeNameFilterInput = document.getElementById('deal-volume-name-filter');
    draft.rule = {
      category_ids: collectActiveCategoryIds('#deal-rule-editor'),
      name_filter: readString(volumeNameFilterInput ? volumeNameFilterInput.value : ''),
      bands: collectDealBandsFromForm()
    };
  }

  if (draft.rule_type === 'free_modifier') {
    var freeModCountInput = document.getElementById('deal-freemod-option-count');
    draft.rule = {
      modifier_group_ids: Array.prototype.map.call(document.querySelectorAll('#deal-rule-editor .deal-mod-group.active'), function (chip) {
        return chip.dataset.dealModGroup;
      }).filter(Boolean),
      option_count: parseInt(freeModCountInput ? freeModCountInput.value : '1', 10) || 1,
      category_ids: collectActiveCategoryIds('#deal-rule-editor')
    };
  }

  draft.schedule = collectDealScheduleFromForm();

  return draft;
}

function collectActiveCategoryIds(scopeSelector) {
  var scope = document.querySelector(scopeSelector);
  if (!scope) return [];
  return Array.prototype.map.call(scope.querySelectorAll('.deal-category-chip.active'), function (chip) {
    return chip.dataset.dealCategory;
  }).filter(Boolean);
}

function collectCheckedDealItems(selector, rootElement) {
  var scope = rootElement || document;
  return Array.prototype.map.call(scope.querySelectorAll(selector + ':checked'), function (input) {
    return input.dataset.dealItem;
  }).filter(Boolean);
}

function collectDealGroupsFromForm(includeCharge) {
  var groups = [];
  document.querySelectorAll('#deal-groups .deal-group-card').forEach(function (card) {
    var labelInput = card.querySelector('.deal-group-label');
    var quantityInput = card.querySelector('.deal-group-quantity');
    var group = {
      group_id: card.dataset.groupId || uid(),
      label: labelInput ? readString(labelInput.value) : '',
      quantity: parseInt(quantityInput ? quantityInput.value : '1', 10) || 1
    };

    if (includeCharge) {
      var chargeSelect = card.querySelector('.deal-group-charge');
      group.charge = chargeSelect && chargeSelect.value === 'free' ? 'free' : 'paid';
    }

    var itemIds = collectCheckedDealItems('.deal-group-item', card);
    if (itemIds.length > 0) {
      group.item_ids = itemIds;
    } else {
      group.category_ids = Array.prototype.map.call(card.querySelectorAll('.deal-category-chip.active'), function (chip) {
        return chip.dataset.dealCategory;
      }).filter(Boolean);
      var sizeSelect = card.querySelector('.deal-group-size');
      if (sizeSelect && sizeSelect.value) group.size_label = sizeSelect.value;
      var nameFilterInput = card.querySelector('.deal-group-name-filter');
      if (nameFilterInput && nameFilterInput.value.trim()) group.name_filter = nameFilterInput.value.trim();
    }
    groups.push(group);
  });
  return groups;
}

function collectDealTiersFromForm() {
  var tiers = [];
  document.querySelectorAll('#deal-tiers .deal-tier-row').forEach(function (row) {
    var quantityInput = row.querySelector('.deal-tier-quantity');
    var priceInput = row.querySelector('.deal-tier-price');
    var labelInput = row.querySelector('.deal-tier-label');
    tiers.push({
      quantity: parseInt(quantityInput ? quantityInput.value : '1', 10) || 1,
      price: readNumberOrNull(priceInput ? priceInput.value : ''),
      label: readString(labelInput ? labelInput.value : '')
    });
  });
  return tiers;
}

function serializeDealDraft(draft) {
  var serialized = {
    id: draft.id || uid(),
    title: readString(draft.title),
    description: readString(draft.description),
    price: null,
    image_url: readString(draft.image_url),
    active: draft.active !== false,
    rule_type: draft.rule_type,
    rule: {}
  };

  if (draft.section) serialized.section = draft.section;

  if (draft.rule_type === 'bundle') {
    serialized.price = readNumberOrNull(draft.price);
    serialized.rule.groups = (draft.rule.groups || []).map(function (group) {
      var serializedGroup = {
        group_id: group.group_id || uid(),
        label: readString(group.label),
        quantity: parseInt(group.quantity, 10) || 1
      };
      if (group.item_ids && group.item_ids.length > 0) {
        serializedGroup.item_ids = group.item_ids.slice();
      } else {
        serializedGroup.category_ids = (group.category_ids || []).slice();
        if (group.size_label) serializedGroup.size_label = group.size_label;
        if (group.name_filter) serializedGroup.name_filter = group.name_filter;
      }
      return serializedGroup;
    });
  }

  if (draft.rule_type === 'min_quantity') {
    serialized.price = readNumberOrNull(draft.price);
    serialized.rule.category_ids = (draft.rule.category_ids || []).slice();
    if (draft.rule.size_label) serialized.rule.size_label = draft.rule.size_label;
    serialized.rule.min_quantity = parseInt(draft.rule.min_quantity, 10) || 2;
  }

  if (draft.rule_type === 'tiered') {
    serialized.rule.item_ids = (draft.rule.item_ids || []).slice();
    serialized.rule.tiers = (draft.rule.tiers || []).map(function (tier) {
      return {
        quantity: parseInt(tier.quantity, 10) || 1,
        price: readNumberOrNull(tier.price),
        label: readString(tier.label)
      };
    });
  }

  if (draft.rule_type === 'two_for_one') {
    serialized.rule.required_item_count = parseInt(draft.rule.required_item_count, 10) || 2;
    serialized.rule.category_ids = (draft.rule.category_ids || []).slice();
    serialized.rule.same_size = draft.rule.same_size !== false;
  }

  if (draft.rule_type === 'percentage_discount') {
    serialized.rule.percent = parseInt(draft.rule.percent, 10) || 10;
    if (draft.rule.category_ids && draft.rule.category_ids.length > 0) serialized.rule.category_ids = draft.rule.category_ids.slice();
    if (draft.rule.item_ids && draft.rule.item_ids.length > 0) serialized.rule.item_ids = draft.rule.item_ids.slice();
  }

  if (draft.rule_type === 'subtotal_threshold') {
    serialized.rule.min_subtotal = readNumberOrNull(draft.rule.min_subtotal);
    serialized.rule.discount = readNumberOrNull(draft.rule.discount);
  }

  if (draft.rule_type === 'free_delivery') {
    if (draft.rule.min_subtotal !== null && draft.rule.min_subtotal !== undefined) {
      serialized.rule.min_subtotal = draft.rule.min_subtotal;
    }
    serialized.rule.always = draft.rule.always === true;
  }

  if (draft.rule_type === 'free_item_with_purchase') {
    serialized.rule.groups = (draft.rule.groups || []).map(function (group) {
      var serializedGroup = {
        group_id: group.group_id || uid(),
        label: readString(group.label),
        quantity: parseInt(group.quantity, 10) || 1,
        charge: group.charge === 'free' ? 'free' : 'paid'
      };
      if (group.item_ids && group.item_ids.length > 0) {
        serializedGroup.item_ids = group.item_ids.slice();
      } else {
        serializedGroup.category_ids = (group.category_ids || []).slice();
        if (group.size_label) serializedGroup.size_label = group.size_label;
        if (group.name_filter) serializedGroup.name_filter = group.name_filter;
      }
      return serializedGroup;
    });
  }

  if (draft.rule_type === 'buy_n_get_m') {
    serialized.rule.required_item_count = parseInt(draft.rule.required_item_count, 10) || 2;
    serialized.rule.free_item_count = parseInt(draft.rule.free_item_count, 10) || 1;
    if (draft.rule.category_ids && draft.rule.category_ids.length > 0) serialized.rule.category_ids = draft.rule.category_ids.slice();
    if (draft.rule.item_ids && draft.rule.item_ids.length > 0) serialized.rule.item_ids = draft.rule.item_ids.slice();
    serialized.rule.same_size = draft.rule.same_size === true;
  }

  if (draft.rule_type === 'volume_pricing') {
    serialized.rule.category_ids = (draft.rule.category_ids || []).slice();
    if (draft.rule.name_filter) serialized.rule.name_filter = draft.rule.name_filter;
    serialized.rule.bands = (draft.rule.bands || []).map(function (band) {
      return {
        min_quantity: parseInt(band.min_quantity, 10) || 1,
        unit_price: readNumberOrNull(band.unit_price)
      };
    });
  }

  if (draft.rule_type === 'free_modifier') {
    serialized.rule.modifier_group_ids = (draft.rule.modifier_group_ids || []).slice();
    serialized.rule.option_count = parseInt(draft.rule.option_count, 10) || 1;
    if (draft.rule.category_ids && draft.rule.category_ids.length > 0) serialized.rule.category_ids = draft.rule.category_ids.slice();
  }

  if (draft.schedule) serialized.schedule = draft.schedule;

  return serialized;
}

function describeDealMatch(matches) {
  if (matches.length === 0) return '<span class="deal-match-empty">no menu items match</span>';
  var sampleNames = matches.slice(0, 3).map(function (item) { return esc(item.item_name || item.id); }).join(', ');
  return matches.length + ' item(s): ' + sampleNames + (matches.length > 3 ? ', ...' : '');
}

function renderDealMatchPreview() {
  var preview = document.getElementById('deal-match-preview');
  var draft = collectDealDraftFromForm();
  if (!preview || !draft) return;

  var referenceIndex = buildMenuReferenceIndex(data);
  var lines = [];

  if (draft.rule_type === 'bundle') {
    (draft.rule.groups || []).forEach(function (group, index) {
      var matches = collectMatchingItems({
        categoryIds: group.category_ids || [],
        itemIds: group.item_ids || [],
        sizeLabel: group.size_label || '',
        nameFilter: group.name_filter || ''
      }, referenceIndex);
      lines.push('Group ' + (index + 1) + ' "' + esc(group.label || 'untitled') + '": ' + describeDealMatch(matches));
    });
  }

  if (draft.rule_type === 'min_quantity') {
    var minMatches = collectMatchingItems({
      categoryIds: draft.rule.category_ids || [],
      sizeLabel: draft.rule.size_label || ''
    }, referenceIndex);
    lines.push('At least ' + draft.rule.min_quantity + ': ' + describeDealMatch(minMatches));
  }

  if (draft.rule_type === 'tiered') {
    lines.push('Fixed item list: ' + describeDealMatch(collectMatchingItems({ itemIds: draft.rule.item_ids || [] }, referenceIndex)));
  }

  if (draft.rule_type === 'two_for_one') {
    var picksMatches = collectMatchingItems({ categoryIds: draft.rule.category_ids || [] }, referenceIndex);
    lines.push('Pick ' + draft.rule.required_item_count + ': ' + describeDealMatch(picksMatches));
  }

  if (draft.rule_type === 'percentage_discount') {
    var pctRestricted = ((draft.rule.category_ids || []).length + (draft.rule.item_ids || []).length) > 0;
    if (pctRestricted) {
      var pctMatches = collectMatchingItems({ categoryIds: draft.rule.category_ids || [], itemIds: draft.rule.item_ids || [] }, referenceIndex);
      lines.push('−' + (draft.rule.percent || 0) + '% on: ' + describeDealMatch(pctMatches));
    } else {
      lines.push('−' + (draft.rule.percent || 0) + '% on the whole order');
    }
  }

  if (draft.rule_type === 'subtotal_threshold') {
    lines.push('Orders over ' + (draft.rule.min_subtotal === null || draft.rule.min_subtotal === undefined ? '?' : draft.rule.min_subtotal) + ' save ' + (draft.rule.discount === null || draft.rule.discount === undefined ? '?' : draft.rule.discount));
  }

  if (draft.rule_type === 'free_delivery') {
    lines.push(draft.rule.always
      ? 'Delivery is always free'
      : (draft.rule.min_subtotal !== null && draft.rule.min_subtotal !== undefined
        ? 'Free delivery over ' + draft.rule.min_subtotal
        : 'Free delivery on any order'));
  }

  if (draft.rule_type === 'free_item_with_purchase') {
    (draft.rule.groups || []).forEach(function (group, index) {
      var matches = collectMatchingItems({
        categoryIds: group.category_ids || [],
        itemIds: group.item_ids || [],
        sizeLabel: group.size_label || '',
        nameFilter: group.name_filter || ''
      }, referenceIndex);
      lines.push('Group ' + (index + 1) + ' "' + esc(group.label || 'untitled') + '" (' + (group.charge === 'free' ? 'free' : 'paid') + '): ' + describeDealMatch(matches));
    });
  }

  if (draft.rule_type === 'buy_n_get_m') {
    var bngmMatches = collectMatchingItems({ categoryIds: draft.rule.category_ids || [], itemIds: draft.rule.item_ids || [] }, referenceIndex);
    lines.push('Buy ' + draft.rule.required_item_count + ' get ' + draft.rule.free_item_count + ' free: ' + describeDealMatch(bngmMatches));
  }

  if (draft.rule_type === 'volume_pricing') {
    var volumeMatches = collectMatchingItems({ categoryIds: draft.rule.category_ids || [], nameFilter: draft.rule.name_filter || '' }, referenceIndex);
    lines.push('Eligible: ' + describeDealMatch(volumeMatches));
    lines.push('Bands: ' + (draft.rule.bands || []).map(function (band) {
      return band.min_quantity + '+ = ' + (band.unit_price === null || band.unit_price === undefined ? '?' : band.unit_price);
    }).join(' · '));
  }

  if (draft.rule_type === 'free_modifier') {
    var freeModLine = (draft.rule.modifier_group_ids || []).length + ' modifier group(s) · ' + (draft.rule.option_count || 1) + ' cheapest option(s) free';
    if ((draft.rule.category_ids || []).length > 0) {
      freeModLine += ' · ' + describeDealMatch(collectMatchingItems({ categoryIds: draft.rule.category_ids || [] }, referenceIndex));
    }
    lines.push(freeModLine);
  }

  if (draft.schedule) {
    var scheduleParts = [];
    if (draft.schedule.date_from || draft.schedule.date_until) scheduleParts.push((draft.schedule.date_from || '?') + ' → ' + (draft.schedule.date_until || '?'));
    if ((draft.schedule.weekdays || []).length > 0) scheduleParts.push((draft.schedule.weekdays || []).map(function (weekday) { return DAY_NAMES[weekday - 1] || weekday; }).join('·'));
    if (draft.schedule.time_from || draft.schedule.time_until) scheduleParts.push((draft.schedule.time_from || '?') + '–' + (draft.schedule.time_until || '?'));
    if (scheduleParts.length > 0) lines.push('🕐 ' + scheduleParts.join(' · '));
  }

  preview.innerHTML = lines.map(function (line) {
    return '<span class="deal-match-line">' + line + '</span>';
  }).join('');
}

function showDealEditorErrors(errors) {
  var container = document.getElementById('deal-editor-errors');
  if (!container) return;
  container.style.display = '';
  container.innerHTML = '<strong>Fix these before saving:</strong><ul>' + errors.map(function (message) {
    return '<li>' + esc(message) + '</li>';
  }).join('') + '</ul>';
}

function saveDealFromEditor() {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }

  var draft = collectDealDraftFromForm();
  if (!draft) return;

  var serializedDeal = serializeDealDraft(draft);
  var validation = validateDeal(serializedDeal, buildMenuReferenceIndex(data));
  if (validation.errors.length > 0) {
    showDealEditorErrors(validation.errors);
    tool.notify(validation.errors[0], 'error');
    return;
  }

  if (editingDealId) {
    var existingIndex = data.deals.findIndex(function (deal) { return deal.id === editingDealId; });
    if (existingIndex >= 0) data.deals[existingIndex] = serializedDeal;
    else data.deals.push(serializedDeal);
  } else {
    data.deals.push(serializedDeal);
  }

  closeDealEditor();
  renderDeals();
  scheduleSave();
  tool.notify('Deal saved', 'success');
}

function duplicateDeal(dealId) {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }
  var sourceDeal = (data.deals || []).find(function (deal) { return deal.id === dealId; });
  if (!sourceDeal) return;

  var copy = JSON.parse(JSON.stringify(sourceDeal));
  copy.id = uid();
  copy.title = (sourceDeal.title || 'Deal') + ' (Copy)';

  var sourceIndex = data.deals.indexOf(sourceDeal);
  data.deals.splice(sourceIndex + 1, 0, copy);
  renderDeals();
  scheduleSave();
  tool.notify('Deal duplicated', 'success');
}

function openDealDeleteConfirm(dealId) {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }
  var deal = (data.deals || []).find(function (entry) { return entry.id === dealId; });
  if (!deal) return;
  pendingDealDeleteId = dealId;
  document.getElementById('deal-delete-modal-name').textContent = '"' + (deal.title || 'Untitled deal') + '"';
  document.getElementById('deal-delete-modal').style.display = 'flex';
}

function confirmDeleteDeal() {
  document.getElementById('deal-delete-modal').style.display = 'none';
  if (!pendingDealDeleteId) return;
  data.deals = (data.deals || []).filter(function (deal) { return deal.id !== pendingDealDeleteId; });
  pendingDealDeleteId = null;
  renderDeals();
  scheduleSave();
  tool.notify('Deal deleted', 'info');
}

function cancelDeleteDeal() {
  document.getElementById('deal-delete-modal').style.display = 'none';
  pendingDealDeleteId = null;
}

/* ===================================================================== */
/* AI DEAL GENERATION - payload, prompt, parser and insert (T-52, T-62) */
/* ===================================================================== */

var DEAL_AI_MAX_ITEMS = 150;

/* Compact description of every rule shape, sent to the model. Source of truth:
   docs/client-data-contract.html version 3.3, section 23. */
var DEAL_AI_RULE_GUIDE = {
  bundle: 'groups[] where each group has label, quantity, and either category_ids[] with optional size_label and name_filter, or item_ids[] for a fixed extra. price = fixed total number.',
  min_quantity: 'category_ids[], optional size_label, min_quantity (whole number >= 2). price = price per unit number.',
  tiered: 'item_ids[], tiers[] of { quantity, price, label }. price must be null.',
  two_for_one: 'required_item_count (>= 2), category_ids[], same_size boolean. price must be null.',
  percentage_discount: 'percent (1 to 100), optional category_ids[] or item_ids[]. price must be null.',
  subtotal_threshold: 'min_subtotal number, discount number. price must be null.',
  free_delivery: 'always boolean, optional min_subtotal number. price must be null.',
  free_item_with_purchase: 'groups[] where each group has label, quantity, charge ("paid" or "free") and category_ids[] or item_ids[]. price must be null.',
  buy_n_get_m: 'required_item_count (>= 2), free_item_count (>= 1), optional category_ids[] or item_ids[], same_size boolean. price must be null.',
  volume_pricing: 'category_ids[], optional name_filter, bands[] of { min_quantity, unit_price }. price must be null.',
  free_modifier: 'modifier_group_ids[], option_count (>= 1), optional category_ids[]. price must be null.'
};

function buildDealAiPayload() {
  var referenceIndex = buildMenuReferenceIndex(data);
  var generalInfo = data.general_info || {};
  var address = generalInfo.address || {};
  var allItems = referenceIndex.items;
  var itemLimit = Math.min(allItems.length, DEAL_AI_MAX_ITEMS);

  var compactItems = [];
  for (var itemIndex = 0; itemIndex < itemLimit; itemIndex += 1) {
    var item = allItems[itemIndex];
    if (!item || !item.id) continue;
    compactItems.push({
      id: item.id,
      name: item.item_name || '',
      category_id: item.category_id || '',
      price: (typeof item.price === 'number') ? item.price : null,
      sizes: (item.sizes || []).map(function (size) {
        return { label: size.label || '', price: size.price };
      }),
      tags: item.tags || [],
      available: item.availability !== 'out_of_stock' && (item.visibility_mode || 'show') !== 'hide'
    });
  }

  return {
    restaurant: {
      name: generalInfo.restaurant_name || '',
      country: address.country || '',
      state: address.state || '',
      currency: (data.taxation_currency && data.taxation_currency.currency) || '',
      timezone: generalInfo.timezone || ''
    },
    categories: (data.menu.categories || []).map(function (category) {
      return { id: category.id, name: category.name };
    }),
    items: compactItems,
    items_truncated: allItems.length > itemLimit,
    modifier_groups: (data.menu.modifier_groups || []).map(function (group) {
      return { id: group.id, name: group.group_name, options: (group.options || []).length };
    }),
    existing_deals: (data.deals || []).map(function (deal) {
      return { title: deal.title, rule_type: deal.rule_type, price: deal.price, active: deal.active !== false };
    })
  };
}

function buildDealAiPrompt(requestedTypes) {
  var payload = buildDealAiPayload();
  var typeLines = requestedTypes.map(function (ruleType) {
    return '- ' + ruleType + ': ' + DEAL_AI_RULE_GUIDE[ruleType];
  }).join('\n');

  return 'You are a restaurant promotion planner. Build realistic, sellable offers from the menu below.\n\n' +
    'OUTPUT RULES\n' +
    '- Return ONLY valid JSON, no markdown and no explanation. Shape: {"deals":[ ... ]}\n' +
    '- Create exactly one deal per requested type.\n' +
    '- Use ONLY ids that appear in the menu payload. Never invent an item id or a category id.\n' +
    '- Never pair unrelated products. A discounted or free item must belong with the paid item (a dip with a pizza, not a pizza with a can).\n' +
    '- Keep prices plausible for this menu: a bundle total below the sum of its parts, volume unit prices that fall as quantity rises, thresholds a normal basket can reach.\n' +
    '- Do not duplicate an existing deal listed in the payload.\n' +
    '- Write a title of at most 60 characters, a one-sentence description, and a short section such as "Weekend" or "Family", in the restaurant language.\n' +
    '- Do not return id, active or image_url; the tool adds them.\n\n' +
    'DEAL SHAPES\n' + typeLines + '\n\n' +
    'REQUESTED TYPES\n' + requestedTypes.join(', ') + '\n\n' +
    'MENU AND EXISTING DEALS (JSON)\n' + JSON.stringify(payload);
}

function extractDealAiJson(rawText) {
  var text = String(rawText || '').trim();
  if (!text) return null;

  var objectStart = text.indexOf('{');
  var arrayStart = text.indexOf('[');
  var start = -1;
  if (objectStart < 0) start = arrayStart;
  else if (arrayStart < 0) start = objectStart;
  else start = Math.min(objectStart, arrayStart);
  if (start < 0) return null;

  var end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    return null;
  }
}

function collectDealAiDrafts(parsedPayload) {
  if (Array.isArray(parsedPayload)) return parsedPayload;
  if (parsedPayload && Array.isArray(parsedPayload.deals)) return parsedPayload.deals;
  return null;
}

function insertAiDealDrafts(aiDrafts, requestedTypes) {
  var referenceIndex = buildMenuReferenceIndex(data);
  var createdDeals = [];
  var skippedEntries = [];

  (aiDrafts || []).forEach(function (aiDraft) {
    if (!isPlainObject(aiDraft)) return;

    var ruleType = readString(aiDraft.rule_type);
    if (DEAL_RULE_TYPES.indexOf(ruleType) === -1) {
      skippedEntries.push({ type: ruleType || 'unknown', reason: 'unsupported rule type' });
      return;
    }

    var serializedDeal = serializeDealDraft({
      title: readString(aiDraft.title),
      description: readString(aiDraft.description),
      section: readString(aiDraft.section),
      image_url: '',
      active: false,
      price: aiDraft.price,
      rule_type: ruleType,
      rule: isPlainObject(aiDraft.rule) ? aiDraft.rule : {}
    });

    var validationReport = validateDeal(serializedDeal, referenceIndex);
    if (validationReport.errors.length > 0) {
      skippedEntries.push({ type: ruleType, reason: validationReport.errors[0] });
      return;
    }

    data.deals.push(serializedDeal);
    createdDeals.push(serializedDeal);
  });

  (requestedTypes || []).forEach(function (ruleType) {
    var wasCreated = createdDeals.some(function (deal) { return deal.rule_type === ruleType; });
    var wasSkipped = skippedEntries.some(function (entry) { return entry.type === ruleType; });
    if (!wasCreated && !wasSkipped) {
      skippedEntries.push({ type: ruleType, reason: 'the AI returned no deal for this type' });
    }
  });

  return { created: createdDeals, skipped: skippedEntries };
}

function requestDealAiText(prompt, onFinished) {
  if (typeof tool.requestAI !== 'function') {
    onFinished('AI is not available in this environment.', null);
    return;
  }

  var hasFinished = false;
  function finish(errorMessage, responseText) {
    if (hasFinished) return;
    hasFinished = true;
    onFinished(errorMessage, responseText);
  }

  try {
    var maybePromise = tool.requestAI(prompt, '', function (error, responseText) {
      if (error) { finish(String(error), null); return; }
      finish(null, responseText);
    });
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.then(function (response) {
        var text = (typeof response === 'string') ? response : ((response && response.text) || '');
        finish(null, text);
      }).catch(function (error) {
        finish((error && error.message) || 'AI request failed.', null);
      });
    }
  } catch (error) {
    finish((error && error.message) || 'AI request failed.', null);
  }
}

function setDealAiBusy(isBusy) {
  var runButton = document.getElementById('deal-ai-run');
  var cancelButton = document.getElementById('deal-ai-cancel');
  if (runButton) {
    runButton.disabled = isBusy;
    runButton.textContent = isBusy ? 'Generating...' : 'Generate deals';
  }
  if (cancelButton) cancelButton.disabled = isBusy;
}

function showDealAiError(message) {
  var errorBox = document.getElementById('deal-ai-error');
  if (!errorBox) { tool.notify(message, 'error'); return; }
  errorBox.style.display = '';
  errorBox.textContent = message;
}

function clearDealAiError() {
  var errorBox = document.getElementById('deal-ai-error');
  if (!errorBox) return;
  errorBox.style.display = 'none';
  errorBox.textContent = '';
}

function openDealAiGenerateModal() {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }
  if (typeof tool.requestAI !== 'function') {
    tool.notify('AI is not configured for this tool yet.', 'warning');
    return;
  }

  clearDealAiError();
  var typeCheckboxes = document.querySelectorAll('#deal-ai-types input[type="checkbox"]');
  typeCheckboxes.forEach(function (checkbox) { checkbox.checked = true; });
  var modal = document.getElementById('deal-ai-modal');
  if (modal) modal.style.display = 'flex';
  tool.resize();
}

function closeDealAiGenerateModal() {
  var modal = document.getElementById('deal-ai-modal');
  if (modal) modal.style.display = 'none';
  setDealAiBusy(false);
}

function runDealAiGeneration() {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }

  var checkedBoxes = document.querySelectorAll('#deal-ai-types input[type="checkbox"]:checked');
  var requestedTypes = Array.prototype.map.call(checkedBoxes, function (checkbox) {
    return checkbox.value;
  }).filter(function (ruleType) {
    return DEAL_RULE_TYPES.indexOf(ruleType) !== -1;
  });

  if (requestedTypes.length === 0) {
    tool.notify('Choose at least one deal type.', 'warning');
    return;
  }

  clearDealAiError();
  setDealAiBusy(true);

  requestDealAiText(buildDealAiPrompt(requestedTypes), function (errorMessage, responseText) {
    setDealAiBusy(false);

    if (errorMessage) {
      showDealAiError(errorMessage);
      return;
    }

    var parsedPayload = extractDealAiJson(responseText);
    var aiDrafts = collectDealAiDrafts(parsedPayload);
    if (!aiDrafts) {
      showDealAiError('The AI did not return usable JSON. Try again.');
      return;
    }

    var summary = insertAiDealDrafts(aiDrafts, requestedTypes);
    closeDealAiGenerateModal();
    renderDeals();
    scheduleSave();

    if (summary.created.length === 0) {
      tool.notify('The AI returned no usable deal. Nothing was added.', 'warning');
    } else {
      tool.notify('AI added ' + summary.created.length + ' inactive deal(s) for review.', 'success');
    }
    if (summary.skipped.length > 0) {
      console.warn('[AI DEALS SKIPPED]', summary.skipped);
    }
  });
}

function wireDealAiDialog() {
  var generateButton = document.getElementById('deals-ai-generate-btn');
  if (generateButton) generateButton.addEventListener('click', openDealAiGenerateModal);
  var closeButton = document.getElementById('deal-ai-close');
  if (closeButton) closeButton.addEventListener('click', closeDealAiGenerateModal);
  var cancelButton = document.getElementById('deal-ai-cancel');
  if (cancelButton) cancelButton.addEventListener('click', closeDealAiGenerateModal);
  var runButton = document.getElementById('deal-ai-run');
  if (runButton) runButton.addEventListener('click', runDealAiGeneration);
}

function wireDealEditor() {
  var subTabNav = document.getElementById('deals-subtabs');
  if (subTabNav) {
    subTabNav.querySelectorAll('.sub-tab').forEach(function (subTabButton) {
      subTabButton.addEventListener('click', function () {
        switchSubTab('deals', subTabButton.dataset.subtab);
      });
    });
  }

  var editorTabs = document.getElementById('deal-editor-tabs');
  if (editorTabs) {
    editorTabs.querySelectorAll('.deal-modal-tab').forEach(function (tabButton) {
      tabButton.addEventListener('click', function () {
        switchDealEditorTab(tabButton.dataset.dealTab);
      });
    });
  }
  document.querySelectorAll('[data-deal-tab-goto]').forEach(function (gotoButton) {
    gotoButton.addEventListener('click', function () {
      switchDealEditorTab(gotoButton.dataset.dealTabGoto);
  var addDealButton = document.getElementById('deals-add-btn');
  if (addDealButton) addDealButton.addEventListener('click', function () { openDealEditor(null); });

  var importButton = document.getElementById('deals-import-btn');
  if (importButton) importButton.addEventListener('click', openDealsImportModal);
  var importCloseButton = document.getElementById('deals-import-close');
  if (importCloseButton) importCloseButton.addEventListener('click', closeDealsImportModal);
  var importCancelButton = document.getElementById('deals-import-cancel');
  if (importCancelButton) importCancelButton.addEventListener('click', closeDealsImportModal);
  var importRunButton = document.getElementById('deals-import-run');
  if (importRunButton) importRunButton.addEventListener('click', runDealsImport);
  wireJsonFilePicker('deals-import-file-input', 'deals-import-file-btn', 'deals-import-file-name', 'deals-import-json');

  var aiGenerateButton = document.getElementById('deals-ai-generate-btn');
  if (aiGenerateButton) aiGenerateButton.addEventListener('click', openDealAiGenerateModal);

  var closeButton = document.getElementById('deal-editor-close');
  if (closeButton) closeButton.addEventListener('click', closeDealEditor);
  var cancelButton = document.getElementById('deal-cancel-btn');
  if (cancelButton) cancelButton.addEventListener('click', closeDealEditor);
  var saveButton = document.getElementById('deal-save-btn');
  if (saveButton) saveButton.addEventListener('click', saveDealFromEditor);

  var deleteButton = document.getElementById('deal-delete-btn');
  if (deleteButton) {
    deleteButton.addEventListener('click', function () {
      if (editingDealId) openDealDeleteConfirm(editingDealId);
    });
  }
  var deleteConfirmButton = document.getElementById('deal-delete-confirm-btn');
  if (deleteConfirmButton) deleteConfirmButton.addEventListener('click', confirmDeleteDeal);
  var deleteCancelButton = document.getElementById('deal-delete-cancel-btn');
  if (deleteCancelButton) deleteCancelButton.addEventListener('click', cancelDeleteDeal);

  var imageUploadButton = document.getElementById('deal-image-upload');
  if (imageUploadButton) {
    imageUploadButton.addEventListener('click', function () {
      tool.requestUpload('image/*', function (error, file) {
        if (error || !file) { if (error) tool.notify('Upload failed: ' + error, 'error'); return; }
        document.getElementById('deal-image-url').value = file.url;
        setDealImagePreview(file.url);
      });
    });
  }
  var imageClearButton = document.getElementById('deal-image-clear');
  if (imageClearButton) {
    imageClearButton.addEventListener('click', function () {
      document.getElementById('deal-image-url').value = '';
      setDealImagePreview('');
    });
  }

  var imageUrlInput = document.getElementById('deal-image-url');
  if (imageUrlInput) {
    imageUrlInput.addEventListener('input', function () { setDealImagePreview(imageUrlInput.value.trim()); });
  }

  var editorBody = document.getElementById('deal-editor-body');
  if (!editorBody) return;

  editorBody.addEventListener('input', function () {
    renderDealMatchPreview();
    refreshDealScheduleTabBadge();
  });

  editorBody.addEventListener('change', function (event) {
    if (event.target.id === 'deal-rule-type') {
      var nextRuleType = event.target.value;
      updateDealPriceFieldState(nextRuleType);
      renderDealRuleEditor(nextRuleType, {});
    }
    renderDealMatchPreview();
    refreshDealScheduleTabBadge();
  });

  editorBody.addEventListener('click', function (event) {
    if (event.target.closest('.deal-category-chip')) {
      event.target.closest('.deal-category-chip').classList.toggle('active');
      renderDealMatchPreview();
      return;
    }

    var weekdayChip = event.target.closest('.deal-weekday-chip');
    if (weekdayChip) {
      weekdayChip.classList.toggle('active');
      renderDealMatchPreview();
      refreshDealScheduleTabBadge();
      return;
    }

    var modGroupChip = event.target.closest('.deal-mod-group');
    if (modGroupChip) {
      modGroupChip.classList.toggle('active');
      renderDealMatchPreview();
      return;
    }

    var removeBandButton = event.target.closest('[data-deal-remove-band]');
    if (removeBandButton) {
      var bandRow = removeBandButton.closest('.deal-band-row');
      var bandsContainer = document.getElementById('deal-volume-bands');
      if (bandRow && bandsContainer && bandsContainer.querySelectorAll('.deal-band-row').length > 1) {
        bandRow.remove();
        renderDealMatchPreview();
      } else {
        tool.notify('Add at least one quantity band.', 'warning');
      }
      return;
    }

    var addBandButton = event.target.closest('[data-deal-add-band]');
    if (addBandButton) {
      var bandsContainerToAppend = document.getElementById('deal-volume-bands');
      if (bandsContainerToAppend) {
        bandsContainerToAppend.insertAdjacentHTML('beforeend', renderDealVolumeBandRow({ min_quantity: 1, unit_price: null }, 0));
        renderDealMatchPreview();
      }
      return;
    }

    var removeGroupButton = event.target.closest('[data-deal-remove-group]');
    if (removeGroupButton) {
      var groupCard = removeGroupButton.closest('.deal-group-card');
      var groupContainer = document.getElementById('deal-groups');
      if (groupCard && groupContainer && groupContainer.querySelectorAll('.deal-group-card').length > 1) {
        groupCard.remove();
        renderDealMatchPreview();
      } else {
        tool.notify('A bundle needs at least one group.', 'warning');
      }
      return;
    }

    var addGroupButton = event.target.closest('[data-deal-add-group]');
    if (addGroupButton) {
      var groupsContainer = document.getElementById('deal-groups');
      if (groupsContainer) {
        groupsContainer.insertAdjacentHTML('beforeend', renderDealGroupCard({ group_id: uid(), label: '', quantity: 1 }, 0));
        renderDealMatchPreview();
      }
      return;
    }

    var removeTierButton = event.target.closest('[data-deal-remove-tier]');
    if (removeTierButton) {
      var tierRow = removeTierButton.closest('.deal-tier-row');
      var tiersContainer = document.getElementById('deal-tiers');
      if (tierRow && tiersContainer && tiersContainer.querySelectorAll('.deal-tier-row').length > 1) {
        tierRow.remove();
        renderDealMatchPreview();
      } else {
        tool.notify('Add at least one price tier.', 'warning');
      }
      return;
    }

    var addTierButton = event.target.closest('[data-deal-add-tier]');
    if (addTierButton) {
      var tiersContainerToAppend = document.getElementById('deal-tiers');
      if (tiersContainerToAppend) {
        tiersContainerToAppend.insertAdjacentHTML('beforeend', renderDealTierRow({ quantity: 1, price: null, label: '' }, 0));
        renderDealMatchPreview();
      }
    }
  });
}

/* ===================================================================== */
/* PRESENTATION EDITORS - campaigns, hero and promotions (T-17 to T-20) */
/* ===================================================================== */
var editingCampaignId = null;
var pendingCampaignDeleteId = null;
var editingPromotionId = null;
var pendingPromotionDeleteId = null;
var draggedPromotionId = null;

/* ---------- Campaigns (T-17) ---------- */
function describeCampaign(campaign) {
  return 'Campaign "' + (campaign.title || campaign.id || 'untitled') + '"';
}

function renderCampaignCardHtml(campaign) {
  var referenceIndex = buildMenuReferenceIndex(data);
  var report = validateCampaign(campaign, referenceIndex);
  var badges = '';
  if (unsupportedCampaignPricingIds[campaign.id]) {
    badges += '<span class="deal-badge deal-badge-warning" title="pricing ' + esc(unsupportedCampaignPricingIds[campaign.id]) + ' is not supported">Check</span>';
  }
  if (report.errors.length > 0) {
    badges += '<span class="deal-badge deal-badge-error" title="' + esc(report.errors[0]) + '">Needs a fix</span>';
  }

  return '<div class="deal-card campaign-card" data-campaign-id="' + esc(campaign.id) + '">' +
    '<div class="deal-card-thumb deal-card-thumb-empty">📣</div>' +
    '<div class="deal-card-body">' +
      '<div class="deal-card-title">' + esc(campaign.title || 'Untitled campaign') + badges + '</div>' +
      '<div class="deal-card-meta"><span>Two-for-one · pick ' + (campaign.required_item_count || 2) +
        (campaign.same_size ? ' · same size' : '') + '</span></div>' +
      (campaign.description ? '<div class="deal-card-desc">' + esc(campaign.description) + '</div>' : '') +
    '</div>' +
    '<div class="deal-card-actions">' +
      '<button type="button" class="deal-card-btn" data-campaign-action="edit" title="Edit">✎</button>' +
      '<button type="button" class="deal-card-btn" data-campaign-action="to-deal" title="Copy as a two-for-one deal">📋</button>' +
      '<button type="button" class="deal-card-btn deal-card-btn-danger" data-campaign-action="delete" title="Delete">🗑</button>' +
    '</div>' +
  '</div>';
}

function renderCampaigns() {
  var listContainer = document.getElementById('campaigns-list');
  if (!listContainer) return;

  var campaigns = data.campaigns || [];
  if (campaigns.length === 0) {
    listContainer.innerHTML = '<div class="empty-state"><strong>No legacy campaigns.</strong><br>Campaigns are shown on the website as two-for-one deals. Create new offers as Deals instead.</div>';
    return;
  }

  listContainer.innerHTML = '<div class="deals-section"><div class="deals-section-cards">' +
    campaigns.map(renderCampaignCardHtml).join('') + '</div></div>';

  wireCampaignCardEvents();
}

function wireCampaignCardEvents() {
  var listContainer = document.getElementById('campaigns-list');
  if (!listContainer) return;

  listContainer.querySelectorAll('.campaign-card').forEach(function (card) {
    var campaignId = card.dataset.campaignId;
    card.addEventListener('click', function (event) {
      var actionButton = event.target.closest('[data-campaign-action]');
      if (!actionButton) {
        openCampaignEditor(campaignId);
        return;
      }
      event.stopPropagation();
      var action = actionButton.dataset.campaignAction;
      if (action === 'edit') openCampaignEditor(campaignId);
      if (action === 'to-deal') duplicateCampaignAsDeal(campaignId);
      if (action === 'delete') openCampaignDeleteConfirm(campaignId);
    });
  });
}

function openCampaignEditor(campaignId) {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }

  var campaign = campaignId ? (data.campaigns || []).find(function (entry) { return entry.id === campaignId; }) : null;
  editingCampaignId = campaign ? campaign.id : null;

  document.getElementById('campaign-editor-title').textContent = campaign ? 'Edit Campaign' : 'New Campaign';
  document.getElementById('campaign-title').value = campaign ? (campaign.title || '') : '';
  document.getElementById('campaign-description').value = campaign ? (campaign.description || '') : '';
  document.getElementById('campaign-required-count').value = campaign ? (campaign.required_item_count || 2) : 2;
  document.getElementById('campaign-same-size').checked = campaign ? campaign.same_size !== false : true;
  document.getElementById('campaign-pricing').value = CAMPAIGN_PRICING_VALUE;
  document.getElementById('campaign-delete-btn').style.display = campaign ? '' : 'none';
  document.getElementById('campaign-editor-errors').style.display = 'none';

  document.getElementById('campaign-categories').innerHTML =
    renderDealCategoryChips(campaign ? (campaign.category_ids || []) : []);
  document.getElementById('campaign-items').innerHTML =
    renderDealItemPicker(campaign ? (campaign.item_ids || []) : [], 'campaign-item');

  renderCampaignMatchPreview();

  document.getElementById('campaign-editor-modal').style.display = 'flex';
  tool.resize();
}

function closeCampaignEditor() {
  var modal = document.getElementById('campaign-editor-modal');
  if (modal) modal.style.display = 'none';
  editingCampaignId = null;
}

function collectCampaignDraftFromForm() {
  return {
    id: editingCampaignId,
    title: readString(document.getElementById('campaign-title').value),
    description: readString(document.getElementById('campaign-description').value),
    required_item_count: parseInt(document.getElementById('campaign-required-count').value, 10) || 2,
    same_size: document.getElementById('campaign-same-size').checked,
    category_ids: Array.prototype.map.call(
      document.querySelectorAll('#campaign-categories .deal-category-chip.active'),
      function (chip) { return chip.dataset.dealCategory; }
    ).filter(Boolean),
    item_ids: collectCheckedDealItems('#campaign-items .campaign-item')
  };
}

function serializeCampaignDraft(draft) {
  return {
    id: draft.id || uid(),
    title: readString(draft.title),
    description: readString(draft.description),
    required_item_count: parseInt(draft.required_item_count, 10) || 2,
    same_size: draft.same_size !== false,
    category_ids: (draft.category_ids || []).slice(),
    item_ids: (draft.item_ids || []).slice(),
    pricing: CAMPAIGN_PRICING_VALUE
  };
}

function renderCampaignMatchPreview() {
  var preview = document.getElementById('campaign-match-preview');
  if (!preview) return;
  var draft = collectCampaignDraftFromForm();
  if (!draft) return;

  var referenceIndex = buildMenuReferenceIndex(data);
  var matches = collectMatchingItems({
    categoryIds: draft.category_ids || [],
    itemIds: draft.item_ids || []
  }, referenceIndex);
  preview.innerHTML = '<span class="deal-match-line">Eligible items: ' + describeDealMatch(matches) + '</span>';
}

function showCampaignEditorErrors(errors) {
  var errorContainer = document.getElementById('campaign-editor-errors');
  if (!errorContainer) return;
  errorContainer.innerHTML = errors.map(esc).join('<br>');
  errorContainer.style.display = '';
}

function saveCampaignFromEditor() {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }

  var draft = collectCampaignDraftFromForm();
  if (!draft) return;

  var serializedCampaign = serializeCampaignDraft(draft);
  var validation = validateCampaign(serializedCampaign, buildMenuReferenceIndex(data));
  if (validation.errors.length > 0) {
    showCampaignEditorErrors(validation.errors);
    tool.notify(validation.errors[0], 'error');
    return;
  }

  if (editingCampaignId) {
    var existingIndex = data.campaigns.findIndex(function (campaign) { return campaign.id === editingCampaignId; });
    if (existingIndex >= 0) data.campaigns[existingIndex] = serializedCampaign;
    else data.campaigns.push(serializedCampaign);
  } else {
    data.campaigns.push(serializedCampaign);
  }

  closeCampaignEditor();
  renderCampaigns();
  scheduleSave();
  tool.notify('Campaign saved', 'success');
}

function openCampaignDeleteConfirm(campaignId) {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }
  var campaign = (data.campaigns || []).find(function (entry) { return entry.id === campaignId; });
  if (!campaign) return;
  pendingCampaignDeleteId = campaignId;
  document.getElementById('campaign-delete-modal-name').textContent = '"' + (campaign.title || 'Untitled campaign') + '"';
  document.getElementById('campaign-delete-modal').style.display = 'flex';
}

function confirmDeleteCampaign() {
  document.getElementById('campaign-delete-modal').style.display = 'none';
  if (!pendingCampaignDeleteId) return;
  data.campaigns = (data.campaigns || []).filter(function (campaign) { return campaign.id !== pendingCampaignDeleteId; });
  pendingCampaignDeleteId = null;
  renderCampaigns();
  scheduleSave();
  tool.notify('Campaign deleted', 'info');
}

function cancelDeleteCampaign() {
  document.getElementById('campaign-delete-modal').style.display = 'none';
  pendingCampaignDeleteId = null;
}

/* ---------- Duplicate campaign as deal (T-18) ---------- */
function duplicateCampaignAsDeal(campaignId) {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }
  var campaign = (data.campaigns || []).find(function (entry) { return entry.id === campaignId; });
  if (!campaign) return;

  var newDeal = {
    id: uid(),
    title: campaign.title || 'Untitled campaign',
    description: campaign.description || '',
    price: null,
    image_url: '',
    active: true,
    rule_type: 'two_for_one',
    rule: {
      required_item_count: campaign.required_item_count || 2,
      category_ids: (campaign.category_ids || []).slice(),
      same_size: campaign.same_size !== false
    }
  };

  data.deals.push(newDeal);
  renderDeals();
  scheduleSave();
  openDealEditor(newDeal.id);
  tool.notify('Campaign copied as a two-for-one deal', 'success');
}

/* ---------- Hero (T-19) ---------- */
function setHeroImagePreview(url) {
  var preview = document.getElementById('hero-image-preview');
  if (!preview) return;
  if (url) {
    preview.innerHTML = '<img src="' + esc(url) + '" alt="Hero preview">';
  } else {
    preview.innerHTML = '<span class="hero-image-empty">🖼️ No hero image</span>';
  }
}

function renderHero() {
  var hero = data.hero || { image_url: '', preset_images: [] };
  var urlInput = document.getElementById('hero-image-url');
  if (urlInput) urlInput.value = hero.image_url || '';
  setHeroImagePreview(hero.image_url || '');

  var presetGroup = document.getElementById('hero-preset-group');
  var presetGrid = document.getElementById('hero-preset-grid');
  if (presetGroup && presetGrid) {
    var presets = hero.preset_images || [];
    if (presets.length === 0) {
      presetGroup.style.display = 'none';
      presetGrid.innerHTML = '';
    } else {
      presetGroup.style.display = '';
      presetGrid.innerHTML = presets.map(function (presetUrl, index) {
        var isCurrent = presetUrl === (hero.image_url || '');
        return '<button type="button" class="hero-preset-item' + (isCurrent ? ' active' : '') + '" data-hero-preset="' + esc(presetUrl) + '" title="Use this preset">' +
          '<img src="' + esc(presetUrl) + '" alt="Preset ' + (index + 1) + '">' + (isCurrent ? '<span class="hero-preset-current">✓</span>' : '') +
        '</button>';
      }).join('');
    }
  }
}

function saveHeroImageUrl(url) {
  if (!data.hero || !isPlainObject(data.hero)) data.hero = { image_url: '', preset_images: [] };
  data.hero.image_url = url;
  renderHero();
  scheduleSave();
}

/* ---------- Promotions (T-20) ---------- */
function renderPromotionCardHtml(promotion) {
  var thumbHtml = promotion.image_url
    ? '<div class="deal-card-thumb" style="background-image:url(' + esc(promotion.image_url) + ')"></div>'
    : '<div class="deal-card-thumb deal-card-thumb-empty">📌</div>';

  return '<div class="deal-card promotion-card" draggable="true" data-promotion-id="' + esc(promotion.id) + '">' +
    thumbHtml +
    '<div class="deal-card-body">' +
      '<div class="deal-card-title">' + esc(promotion.title || 'Untitled promotion') + '</div>' +
      (promotion.description ? '<div class="deal-card-desc">' + esc(promotion.description) + '</div>' : '') +
    '</div>' +
    '<div class="deal-card-actions">' +
      '<button type="button" class="deal-card-btn" data-promotion-action="edit" title="Edit">✎</button>' +
      '<button type="button" class="deal-card-btn deal-card-btn-danger" data-promotion-action="delete" title="Delete">🗑</button>' +
    '</div>' +
  '</div>';
}

function renderPromotions() {
  var listContainer = document.getElementById('promotions-list');
  if (!listContainer) return;

  var addButton = document.getElementById('promotions-add-btn');
  var promotions = data.promotions || [];
  if (addButton) {
    addButton.disabled = promotions.length >= PROMOTION_LIMIT;
    addButton.title = promotions.length >= PROMOTION_LIMIT
      ? 'At most ' + PROMOTION_LIMIT + ' promotions can be stored'
      : 'Add a promotion';
  }

  if (promotions.length === 0) {
    listContainer.innerHTML = '<div class="empty-state"><strong>No promotions yet.</strong><br>Add up to ' + PROMOTION_LIMIT + ' promotions. The website shows them under the hero.</div>';
    return;
  }

  listContainer.innerHTML = '<div class="deals-section"><div class="deals-section-cards">' +
    promotions.map(renderPromotionCardHtml).join('') + '</div></div>';

  wirePromotionCardEvents();
}

function wirePromotionCardEvents() {
  var listContainer = document.getElementById('promotions-list');
  if (!listContainer) return;

  listContainer.querySelectorAll('.promotion-card').forEach(function (card) {
    var promotionId = card.dataset.promotionId;

    card.addEventListener('click', function (event) {
      var actionButton = event.target.closest('[data-promotion-action]');
      if (!actionButton) {
        openPromotionEditor(promotionId);
        return;
      }
      event.stopPropagation();
      var action = actionButton.dataset.promotionAction;
      if (action === 'edit') openPromotionEditor(promotionId);
      if (action === 'delete') openPromotionDeleteConfirm(promotionId);
    });

    card.addEventListener('dragstart', function (event) {
      if (isDealEditingBlocked()) { event.preventDefault(); return; }
      draggedPromotionId = promotionId;
      card.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', promotionId);
    });

    card.addEventListener('dragend', function () {
      card.classList.remove('dragging');
      draggedPromotionId = null;
      listContainer.querySelectorAll('.promotion-card').forEach(function (otherCard) {
        otherCard.classList.remove('drop-after', 'drop-before');
      });
    });

    card.addEventListener('dragover', function (event) {
      if (!draggedPromotionId || draggedPromotionId === promotionId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      var cardRect = card.getBoundingClientRect();
      var isAfter = (event.clientY - cardRect.top) > (cardRect.height / 2);
      card.classList.toggle('drop-after', isAfter);
      card.classList.toggle('drop-before', !isAfter);
    });

    card.addEventListener('dragleave', function () {
      card.classList.remove('drop-before', 'drop-after');
    });

    card.addEventListener('drop', function (event) {
      event.preventDefault();
      event.stopPropagation();
      var isAfter = card.classList.contains('drop-after');
      card.classList.remove('drop-before', 'drop-after');
      if (draggedPromotionId) movePromotionRelativeTo(draggedPromotionId, promotionId, isAfter);
    });
  });
}

function movePromotionRelativeTo(movedPromotionId, targetPromotionId, placeAfter) {
  var promotions = data.promotions || [];
  var movedIndex = promotions.findIndex(function (promotion) { return promotion.id === movedPromotionId; });
  var targetIndex = promotions.findIndex(function (promotion) { return promotion.id === targetPromotionId; });
  if (movedIndex < 0 || targetIndex < 0 || movedIndex === targetIndex) return;

  var movedPromotion = promotions.splice(movedIndex, 1)[0];
  var insertIndex = promotions.indexOf(promotions[targetIndex]);
  if (placeAfter) insertIndex += 1;
  promotions.splice(insertIndex, 0, movedPromotion);

  renderPromotions();
  scheduleSave();
}

function openPromotionEditor(promotionId) {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }

  var promotion = promotionId ? (data.promotions || []).find(function (entry) { return entry.id === promotionId; }) : null;
  editingPromotionId = promotion ? promotion.id : null;

  document.getElementById('promotion-editor-title').textContent = promotion ? 'Edit Promotion' : 'New Promotion';
  document.getElementById('promotion-title').value = promotion ? (promotion.title || '') : '';
  document.getElementById('promotion-description').value = promotion ? (promotion.description || '') : '';
  document.getElementById('promotion-image-url').value = promotion ? (promotion.image_url || '') : '';
  document.getElementById('promotion-delete-btn').style.display = promotion ? '' : 'none';
  document.getElementById('promotion-editor-errors').style.display = 'none';

  setPromotionImagePreview(promotion ? promotion.image_url : '');

  document.getElementById('promotion-editor-modal').style.display = 'flex';
  tool.resize();
}

function closePromotionEditor() {
  var modal = document.getElementById('promotion-editor-modal');
  if (modal) modal.style.display = 'none';
  editingPromotionId = null;
}

function setPromotionImagePreview(url) {
  var preview = document.getElementById('promotion-image-preview');
  if (!preview) return;
  if (url) {
    preview.innerHTML = '<img src="' + esc(url) + '" alt="Promotion preview">';
  } else {
    preview.innerHTML = '📌';
  }
}

function collectPromotionDraftFromForm() {
  return {
    id: editingPromotionId,
    title: readString(document.getElementById('promotion-title').value),
    description: readString(document.getElementById('promotion-description').value),
    image_url: readString(document.getElementById('promotion-image-url').value)
  };
}

function serializePromotionDraft(draft) {
  return {
    id: draft.id || uid(),
    title: readString(draft.title),
    description: readString(draft.description),
    image_url: readString(draft.image_url)
  };
}

function showPromotionEditorErrors(errors) {
  var errorContainer = document.getElementById('promotion-editor-errors');
  if (!errorContainer) return;
  errorContainer.innerHTML = errors.map(esc).join('<br>');
  errorContainer.style.display = '';
}

function savePromotionFromEditor() {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }

  var draft = collectPromotionDraftFromForm();
  if (!draft) return;
  if (!draft.title) {
    showPromotionEditorErrors(['Promotion: title is required.']);
    tool.notify('Promotion title is required', 'error');
    return;
  }

  var serializedPromotion = serializePromotionDraft(draft);

  if (editingPromotionId) {
    var existingIndex = data.promotions.findIndex(function (promotion) { return promotion.id === editingPromotionId; });
    if (existingIndex >= 0) data.promotions[existingIndex] = serializedPromotion;
    else data.promotions.push(serializedPromotion);
  } else {
    if ((data.promotions || []).length >= PROMOTION_LIMIT) {
      tool.notify('At most ' + PROMOTION_LIMIT + ' promotions can be stored.', 'warning');
      return;
    }
    data.promotions.push(serializedPromotion);
  }

  closePromotionEditor();
  renderPromotions();
  scheduleSave();
  tool.notify('Promotion saved', 'success');
}

function openPromotionDeleteConfirm(promotionId) {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }
  var promotion = (data.promotions || []).find(function (entry) { return entry.id === promotionId; });
  if (!promotion) return;
  pendingPromotionDeleteId = promotionId;
  document.getElementById('promotion-delete-modal-name').textContent = '"' + (promotion.title || 'Untitled promotion') + '"';
  document.getElementById('promotion-delete-modal').style.display = 'flex';
}

function confirmDeletePromotion() {
  document.getElementById('promotion-delete-modal').style.display = 'none';
  if (!pendingPromotionDeleteId) return;
  data.promotions = (data.promotions || []).filter(function (promotion) { return promotion.id !== pendingPromotionDeleteId; });
  pendingPromotionDeleteId = null;
  renderPromotions();
  scheduleSave();
  tool.notify('Promotion deleted', 'info');
}

function cancelDeletePromotion() {
  document.getElementById('promotion-delete-modal').style.display = 'none';
  pendingPromotionDeleteId = null;
}

/* ---------- Wiring for campaigns, hero and promotions (T-17 to T-20) ---------- */
function wirePresentationEditors() {
  /* Campaigns */
  var addCampaignButton = document.getElementById('campaigns-add-btn');
  if (addCampaignButton) addCampaignButton.addEventListener('click', function () { openCampaignEditor(null); });

  var campaignCloseButton = document.getElementById('campaign-editor-close');
  if (campaignCloseButton) campaignCloseButton.addEventListener('click', closeCampaignEditor);
  var campaignCancelButton = document.getElementById('campaign-cancel-btn');
  if (campaignCancelButton) campaignCancelButton.addEventListener('click', closeCampaignEditor);
  var campaignSaveButton = document.getElementById('campaign-save-btn');
  if (campaignSaveButton) campaignSaveButton.addEventListener('click', saveCampaignFromEditor);
  var campaignDeleteButton = document.getElementById('campaign-delete-btn');
  if (campaignDeleteButton) {
    campaignDeleteButton.addEventListener('click', function () {
      if (editingCampaignId) openCampaignDeleteConfirm(editingCampaignId);
    });
  }
  var campaignDeleteConfirmButton = document.getElementById('campaign-delete-confirm-btn');
  if (campaignDeleteConfirmButton) campaignDeleteConfirmButton.addEventListener('click', confirmDeleteCampaign);
  var campaignDeleteCancelButton = document.getElementById('campaign-delete-cancel-btn');
  if (campaignDeleteCancelButton) campaignDeleteCancelButton.addEventListener('click', cancelDeleteCampaign);

  var campaignBody = document.getElementById('campaign-editor-body');
  if (campaignBody) {
    campaignBody.addEventListener('input', renderCampaignMatchPreview);
    campaignBody.addEventListener('change', renderCampaignMatchPreview);
    campaignBody.addEventListener('click', function (event) {
      if (event.target.closest('.deal-category-chip')) {
        event.target.closest('.deal-category-chip').classList.toggle('active');
        renderCampaignMatchPreview();
      }
    });
  }

  /* Hero */
  var heroUploadButton = document.getElementById('hero-image-upload');
  if (heroUploadButton) {
    heroUploadButton.addEventListener('click', function () {
      tool.requestUpload('image/*', function (error, file) {
        if (error || !file) { if (error) tool.notify('Upload failed: ' + error, 'error'); return; }
        document.getElementById('hero-image-url').value = file.url;
        saveHeroImageUrl(file.url);
      });
    });
  }
  var heroClearButton = document.getElementById('hero-image-clear');
  if (heroClearButton) {
    heroClearButton.addEventListener('click', function () {
      document.getElementById('hero-image-url').value = '';
      saveHeroImageUrl('');
    });
  }
  var heroUrlInput = document.getElementById('hero-image-url');
  if (heroUrlInput) {
    heroUrlInput.addEventListener('input', function () { setHeroImagePreview(heroUrlInput.value.trim()); });
    heroUrlInput.addEventListener('change', function () { saveHeroImageUrl(heroUrlInput.value.trim()); });
    heroUrlInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveHeroImageUrl(heroUrlInput.value.trim());
      }
    });
  }
  var heroApplyButton = document.getElementById('hero-image-apply');
  if (heroApplyButton) {
    heroApplyButton.addEventListener('click', function () {
      saveHeroImageUrl(heroUrlInput.value.trim());
    });
  }
  var heroPresetGrid = document.getElementById('hero-preset-grid');
  if (heroPresetGrid) {
    heroPresetGrid.addEventListener('click', function (event) {
      var presetButton = event.target.closest('[data-hero-preset]');
      if (!presetButton) return;
      document.getElementById('hero-image-url').value = presetButton.dataset.heroPreset;
      saveHeroImageUrl(presetButton.dataset.heroPreset);
    });
  }

  /* Promotions */
  var addPromotionButton = document.getElementById('promotions-add-btn');
  if (addPromotionButton) addPromotionButton.addEventListener('click', function () { openPromotionEditor(null); });

  var promotionCloseButton = document.getElementById('promotion-editor-close');
  if (promotionCloseButton) promotionCloseButton.addEventListener('click', closePromotionEditor);
  var promotionCancelButton = document.getElementById('promotion-cancel-btn');
  if (promotionCancelButton) promotionCancelButton.addEventListener('click', closePromotionEditor);
  var promotionSaveButton = document.getElementById('promotion-save-btn');
  if (promotionSaveButton) promotionSaveButton.addEventListener('click', savePromotionFromEditor);
  var promotionDeleteButton = document.getElementById('promotion-delete-btn');
  if (promotionDeleteButton) {
    promotionDeleteButton.addEventListener('click', function () {
      if (editingPromotionId) openPromotionDeleteConfirm(editingPromotionId);
    });
  }
  var promotionDeleteConfirmButton = document.getElementById('promotion-delete-confirm-btn');
  if (promotionDeleteConfirmButton) promotionDeleteConfirmButton.addEventListener('click', confirmDeletePromotion);
  var promotionDeleteCancelButton = document.getElementById('promotion-delete-cancel-btn');
  if (promotionDeleteCancelButton) promotionDeleteCancelButton.addEventListener('click', cancelDeletePromotion);

  var promotionImageUploadButton = document.getElementById('promotion-image-upload');
  if (promotionImageUploadButton) {
    promotionImageUploadButton.addEventListener('click', function () {
      tool.requestUpload('image/*', function (error, file) {
        if (error || !file) { if (error) tool.notify('Upload failed: ' + error, 'error'); return; }
        document.getElementById('promotion-image-url').value = file.url;
        setPromotionImagePreview(file.url);
      });
    });
  }
  var promotionImageClearButton = document.getElementById('promotion-image-clear');
  if (promotionImageClearButton) {
    promotionImageClearButton.addEventListener('click', function () {
      document.getElementById('promotion-image-url').value = '';
      setPromotionImagePreview('');
    });
  }
  var promotionImageUrlInput = document.getElementById('promotion-image-url');
  if (promotionImageUrlInput) {
    promotionImageUrlInput.addEventListener('input', function () { setPromotionImagePreview(promotionImageUrlInput.value.trim()); });
  }
}

/* ===================================================================== */
/* PROMO CODES (T-40) */
/* ===================================================================== */
var editingPromoCodeId = null;
var pendingPromoCodeDeleteId = null;

function describePromoCodeRule(promoCode) {
  var rule = promoCode.rule || {};
  if (promoCode.rule_type === 'percentage_discount') return 'Percent off · ' + (rule.percent || 0) + '%';
  if (promoCode.rule_type === 'subtotal_threshold') return 'Save ' + (rule.discount || 0) + ' over ' + (rule.min_subtotal || 0);
  if (promoCode.rule_type === 'free_delivery') {
    if (rule.always) return 'Free delivery always';
    if (rule.min_subtotal === null || rule.min_subtotal === undefined) return 'Free delivery on any order';
    return 'Free delivery over ' + rule.min_subtotal;
  }
  return 'Unsupported offer';
}

function renderPromoCodeCardHtml(promoCode) {
  var report = validatePromoCodes([promoCode]);
  var badges = report.errors.length > 0
    ? '<span class="deal-badge deal-badge-error" title="' + esc(report.errors[0]) + '">Needs a fix</span>'
    : '';

  return '<div class="deal-card promo-code-card" data-promo-code-id="' + esc(promoCode.id) + '">' +
    '<div class="deal-card-thumb deal-card-thumb-empty">🎟️</div>' +
    '<div class="deal-card-body">' +
      '<div class="deal-card-title"><span class="promo-code-value">' + esc(promoCode.code || 'NO CODE') + '</span> — ' + esc(promoCode.title || 'Untitled code') + badges + '</div>' +
      '<div class="deal-card-meta"><span>' + esc(describePromoCodeRule(promoCode)) + '</span>' +
        '<span class="deal-card-price">' + (promoCode.max_uses === null || promoCode.max_uses === undefined ? 'Unlimited uses' : promoCode.max_uses + ' uses') + '</span></div>' +
    '</div>' +
    '<div class="deal-card-actions">' +
      '<button type="button" class="deal-card-btn" data-promo-code-action="edit" title="Edit">✎</button>' +
      '<button type="button" class="deal-card-btn deal-card-btn-danger" data-promo-code-action="delete" title="Delete">🗑</button>' +
    '</div>' +
  '</div>';
}

function renderPromoCodes() {
  var listContainer = document.getElementById('promo-codes-list');
  if (!listContainer) return;

  var promoCodes = data.promo_codes || [];
  if (promoCodes.length === 0) {
    listContainer.innerHTML = '<div class="empty-state"><strong>No promo codes yet.</strong><br>Add a code customers can type at checkout. Supported offers: percent off, subtotal discount and free delivery.</div>';
    return;
  }

  listContainer.innerHTML = '<div class="deals-section"><div class="deals-section-cards">' +
    promoCodes.map(renderPromoCodeCardHtml).join('') + '</div></div>';

  wirePromoCodeCardEvents();
}

function wirePromoCodeCardEvents() {
  var listContainer = document.getElementById('promo-codes-list');
  if (!listContainer) return;

  listContainer.querySelectorAll('.promo-code-card').forEach(function (card) {
    var promoCodeId = card.dataset.promoCodeId;
    card.addEventListener('click', function (event) {
      var actionButton = event.target.closest('[data-promo-code-action]');
      if (!actionButton) {
        openPromoCodeEditor(promoCodeId);
        return;
      }
      event.stopPropagation();
      var action = actionButton.dataset.promoCodeAction;
      if (action === 'edit') openPromoCodeEditor(promoCodeId);
      if (action === 'delete') openPromoCodeDeleteConfirm(promoCodeId);
    });
  });
}

function renderPromoCodeRuleEditor(ruleType, rule) {
  var container = document.getElementById('promo-code-rule-editor');
  if (!container) return;
  var ruleData = rule || {};
  var html = '';

  if (ruleType === 'percentage_discount') {
    html = '<div class="deal-rule-block">' +
      '<div class="deal-rule-block-title">Percent off</div>' +
      '<div class="form-group"><label class="form-label">Percent</label>' +
        '<input type="number" class="form-input" id="pc-percent" min="1" max="100" step="1" value="' + (ruleData.percent || 10) + '"></div>' +
    '</div>';
  } else if (ruleType === 'subtotal_threshold') {
    html = '<div class="deal-rule-block">' +
      '<div class="deal-rule-block-title">Subtotal discount</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Minimum subtotal</label>' +
          '<input type="number" class="form-input" id="pc-threshold-min" min="0" step="0.01" value="' + (ruleData.min_subtotal === null || ruleData.min_subtotal === undefined ? '' : ruleData.min_subtotal) + '"></div>' +
        '<div class="form-group"><label class="form-label">Discount</label>' +
          '<input type="number" class="form-input" id="pc-threshold-discount" min="0" step="0.01" value="' + (ruleData.discount === null || ruleData.discount === undefined ? '' : ruleData.discount) + '"></div>' +
      '</div>' +
    '</div>';
  } else if (ruleType === 'free_delivery') {
    html = '<div class="deal-rule-block">' +
      '<div class="deal-rule-block-title">Free delivery</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Minimum subtotal (optional)</label>' +
          '<input type="number" class="form-input" id="pc-freedelivery-min" min="0" step="0.01" value="' + (ruleData.min_subtotal === null || ruleData.min_subtotal === undefined ? '' : ruleData.min_subtotal) + '"></div>' +
        '<div class="form-group"><label class="form-label">Always free</label>' +
          '<label class="switch" style="margin-top:6px;"><input type="checkbox" id="pc-freedelivery-always"' + (ruleData.always === true ? ' checked' : '') + '><span class="slider"></span></label></div>' +
      '</div>' +
    '</div>';
  }

  container.innerHTML = html;
}

function openPromoCodeEditor(promoCodeId) {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }

  var promoCode = promoCodeId ? (data.promo_codes || []).find(function (entry) { return entry.id === promoCodeId; }) : null;
  editingPromoCodeId = promoCode ? promoCode.id : null;

  document.getElementById('promo-code-editor-title').textContent = promoCode ? 'Edit Promo Code' : 'New Promo Code';
  document.getElementById('promo-code-code').value = promoCode ? (promoCode.code || '') : '';
  document.getElementById('promo-code-title').value = promoCode ? (promoCode.title || '') : '';
  document.getElementById('promo-code-max-uses').value = promoCode && promoCode.max_uses !== null && promoCode.max_uses !== undefined ? promoCode.max_uses : '';
  document.getElementById('promo-code-delete-btn').style.display = promoCode ? '' : 'none';
  document.getElementById('promo-code-editor-errors').style.display = 'none';

  var ruleType = promoCode ? promoCode.rule_type : 'percentage_discount';
  document.getElementById('promo-code-rule-type').value = ruleType;
  renderPromoCodeRuleEditor(ruleType, promoCode ? promoCode.rule : {});

  document.getElementById('promo-code-editor-modal').style.display = 'flex';
  tool.resize();
}

function closePromoCodeEditor() {
  var modal = document.getElementById('promo-code-editor-modal');
  if (modal) modal.style.display = 'none';
  editingPromoCodeId = null;
}

function collectPromoCodeRuleFromForm() {
  var ruleTypeInput = document.getElementById('promo-code-rule-type');
  var ruleType = ruleTypeInput ? ruleTypeInput.value : 'percentage_discount';
  var rule = {};

  if (ruleType === 'percentage_discount') {
    var percentInput = document.getElementById('pc-percent');
    rule.percent = parseInt(percentInput ? percentInput.value : '10', 10) || 10;
  } else if (ruleType === 'subtotal_threshold') {
    var minInput = document.getElementById('pc-threshold-min');
    var discountInput = document.getElementById('pc-threshold-discount');
    rule.min_subtotal = readNumberOrNull(minInput ? minInput.value : '');
    rule.discount = readNumberOrNull(discountInput ? discountInput.value : '');
  } else if (ruleType === 'free_delivery') {
    var freeMinInput = document.getElementById('pc-freedelivery-min');
    var alwaysInput = document.getElementById('pc-freedelivery-always');
    rule.min_subtotal = readNumberOrNull(freeMinInput ? freeMinInput.value : '');
    rule.always = !!(alwaysInput && alwaysInput.checked);
  }

  return rule;
}

function collectPromoCodeDraftFromForm() {
  var ruleTypeInput = document.getElementById('promo-code-rule-type');
  if (!ruleTypeInput) return null;
  return {
    id: editingPromoCodeId,
    code: readString(document.getElementById('promo-code-code').value),
    title: readString(document.getElementById('promo-code-title').value),
    rule_type: ruleTypeInput.value,
    rule: collectPromoCodeRuleFromForm(),
    max_uses: readNumberOrNull(document.getElementById('promo-code-max-uses').value)
  };
}

function serializePromoCodeDraft(draft) {
  return {
    id: draft.id || uid(),
    code: readString(draft.code).toUpperCase(),
    title: readString(draft.title),
    rule_type: draft.rule_type,
    rule: draft.rule,
    max_uses: draft.max_uses
  };
}

function showPromoCodeEditorErrors(errors) {
  var errorContainer = document.getElementById('promo-code-editor-errors');
  if (!errorContainer) return;
  errorContainer.innerHTML = errors.map(esc).join('<br>');
  errorContainer.style.display = '';
}

function savePromoCodeFromEditor() {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }

  var draft = collectPromoCodeDraftFromForm();
  if (!draft) return;

  var serializedPromoCode = serializePromoCodeDraft(draft);
  var validation = validatePromoCodes([serializedPromoCode]);
  var otherCodes = (data.promo_codes || []).filter(function (code) { return code.id !== serializedPromoCode.id; });
  var hasClash = serializedPromoCode.code && otherCodes.some(function (code) {
    return code.code && code.code.toUpperCase() === serializedPromoCode.code.toUpperCase();
  });
  if (hasClash) validation.errors.push('Promo code "' + serializedPromoCode.code + '": this code is already used.');

  if (validation.errors.length > 0) {
    showPromoCodeEditorErrors(validation.errors);
    tool.notify(validation.errors[0], 'error');
    return;
  }

  if (editingPromoCodeId) {
    var existingIndex = data.promo_codes.findIndex(function (code) { return code.id === editingPromoCodeId; });
    if (existingIndex >= 0) data.promo_codes[existingIndex] = serializedPromoCode;
    else data.promo_codes.push(serializedPromoCode);
  } else {
    data.promo_codes.push(serializedPromoCode);
  }

  closePromoCodeEditor();
  renderPromoCodes();
  scheduleSave();
  tool.notify('Promo code saved', 'success');
}

function openPromoCodeDeleteConfirm(promoCodeId) {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }
  var promoCode = (data.promo_codes || []).find(function (entry) { return entry.id === promoCodeId; });
  if (!promoCode) return;
  pendingPromoCodeDeleteId = promoCodeId;
  document.getElementById('promo-code-delete-modal-name').textContent = '"' + (promoCode.code || 'this code') + '"';
  document.getElementById('promo-code-delete-modal').style.display = 'flex';
}

function confirmDeletePromoCode() {
  document.getElementById('promo-code-delete-modal').style.display = 'none';
  if (!pendingPromoCodeDeleteId) return;
  data.promo_codes = (data.promo_codes || []).filter(function (code) { return code.id !== pendingPromoCodeDeleteId; });
  pendingPromoCodeDeleteId = null;
  renderPromoCodes();
  scheduleSave();
  tool.notify('Promo code deleted', 'info');
}

function cancelDeletePromoCode() {
  document.getElementById('promo-code-delete-modal').style.display = 'none';
  pendingPromoCodeDeleteId = null;
}

function wirePromoCodeEditor() {
  var addButton = document.getElementById('promo-codes-add-btn');
  if (addButton) addButton.addEventListener('click', function () { openPromoCodeEditor(null); });

  var closeButton = document.getElementById('promo-code-editor-close');
  if (closeButton) closeButton.addEventListener('click', closePromoCodeEditor);
  var cancelButton = document.getElementById('promo-code-cancel-btn');
  if (cancelButton) cancelButton.addEventListener('click', closePromoCodeEditor);
  var saveButton = document.getElementById('promo-code-save-btn');
  if (saveButton) saveButton.addEventListener('click', savePromoCodeFromEditor);

  var deleteButton = document.getElementById('promo-code-delete-btn');
  if (deleteButton) {
    deleteButton.addEventListener('click', function () {
      if (editingPromoCodeId) openPromoCodeDeleteConfirm(editingPromoCodeId);
    });
  }
  var deleteConfirmButton = document.getElementById('promo-code-delete-confirm-btn');
  if (deleteConfirmButton) deleteConfirmButton.addEventListener('click', confirmDeletePromoCode);
  var deleteCancelButton = document.getElementById('promo-code-delete-cancel-btn');
  if (deleteCancelButton) deleteCancelButton.addEventListener('click', cancelDeletePromoCode);

  var ruleTypeSelect = document.getElementById('promo-code-rule-type');
  if (ruleTypeSelect) {
    ruleTypeSelect.addEventListener('change', function () {
      renderPromoCodeRuleEditor(ruleTypeSelect.value, {});
    });
  }
}

/* ===================================================================== */
/* SAMPLE DATA IMPORT (deals, campaigns, promotions, hero, promo codes)  */
/* ===================================================================== */
/* Loads a chosen .json file into the import textarea via FileReader. */
function wireJsonFilePicker(fileInputId, buttonId, fileNameId, textareaId) {
  var fileInput = document.getElementById(fileInputId);
  var button = document.getElementById(buttonId);
  var fileName = document.getElementById(fileNameId);
  var textarea = document.getElementById(textareaId);
  if (!fileInput || !button || !fileName || !textarea) return;
  button.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      textarea.value = String(reader.result || '');
      fileName.textContent = file.name;
      tool.notify('Loaded ' + file.name + ' - review the JSON and click Import.', 'info');
    };
    reader.onerror = function () {
      tool.notify('Could not read the selected file.', 'error');
    };
    reader.readAsText(file);
  });
}

function openDealsImportModal() {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }
  var modal = document.getElementById('deals-import-modal');
  if (!modal) return;

  document.getElementById('deals-import-json').value = '';
  var fileInput = document.getElementById('deals-import-file-input');
  if (fileInput) fileInput.value = '';
  var fileName = document.getElementById('deals-import-file-name');
  if (fileName) fileName.textContent = 'No file chosen';
  document.getElementById('deals-import-deals').checked = true;
  document.getElementById('deals-import-campaigns').checked = true;
  document.getElementById('deals-import-promotions').checked = true;
  document.getElementById('deals-import-hero').checked = true;
  document.getElementById('deals-import-promo-codes').checked = true;
  document.getElementById('deals-import-append').checked = true;
  modal.style.display = 'flex';
  tool.resize();
}

function closeDealsImportModal() {
  var modal = document.getElementById('deals-import-modal');
  if (modal) modal.style.display = 'none';
}

function showDealsImportErrors(errors) {
  var errorContainer = document.getElementById('deals-import-errors');
  if (!errorContainer) return;
  var referenceMismatch = errors.some(function (message) {
    return message.indexOf('no menu items') !== -1 ||
      message.indexOf('do not exist in the menu') !== -1 ||
      message.indexOf('category filter matches') !== -1;
  });
  errorContainer.innerHTML = '<strong>Nothing was imported - fix these first:</strong><br>' +
    errors.map(esc).join('<br>') +
    (referenceMismatch
      ? '<br><strong>Tip:</strong> these reference errors usually mean the deals sample and the menu do not match. Import the matching bundled menu first: Menu tab → 📥 Samples, then pick the menu file listed next to the deals file you chose.'
      : '');
  errorContainer.style.display = '';
}

function cloneEntriesWithFreshIds(entries) {
  return (entries || []).map(function (entry) {
    var copy = JSON.parse(JSON.stringify(entry));
    copy.id = uid();
    return copy;
  });
}

function runDealsImport() {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }

  var errorContainer = document.getElementById('deals-import-errors');
  if (errorContainer) errorContainer.style.display = 'none';

  var isReplace = !document.getElementById('deals-import-append').checked;
  var importDeals = document.getElementById('deals-import-deals').checked;
  var importCampaigns = document.getElementById('deals-import-campaigns').checked;
  var importPromotions = document.getElementById('deals-import-promotions').checked;
  var importHero = document.getElementById('deals-import-hero').checked;
  var importPromoCodes = document.getElementById('deals-import-promo-codes').checked;

  function applyImport(incoming) {
    if (!isPlainObject(incoming)) {
      showDealsImportErrors(['The imported JSON must be an object with at least one of: deals, campaigns, promotions, hero, promo_codes.']);
      return;
    }

    var candidate = JSON.parse(JSON.stringify(data));
    var importedCounts = {};

    function applySection(sectionName, isEmpty, appendEntries) {
      if (isEmpty()) return;
      if (isReplace) {
        candidate[sectionName] = JSON.parse(JSON.stringify(incoming[sectionName]));
      } else {
        var appended = appendEntries();
        candidate[sectionName] = (candidate[sectionName] || []).concat(appended);
      }
      importedCounts[sectionName] = candidate[sectionName].length;
    }

    applySection('deals', function () { return !importDeals || !Array.isArray(incoming.deals); },
      function () { return cloneEntriesWithFreshIds(incoming.deals); });
    applySection('campaigns', function () { return !importCampaigns || !Array.isArray(incoming.campaigns); },
      function () { return cloneEntriesWithFreshIds(incoming.campaigns); });
    applySection('promotions', function () { return !importPromotions || !Array.isArray(incoming.promotions); },
      function () { return cloneEntriesWithFreshIds(incoming.promotions); });
    applySection('promo_codes', function () { return !importPromoCodes || !Array.isArray(incoming.promo_codes); },
      function () { return cloneEntriesWithFreshIds(incoming.promo_codes); });

    if (importHero && isReplace && isPlainObject(incoming.hero)) {
      candidate.hero = JSON.parse(JSON.stringify(incoming.hero));
      importedCounts.hero = 1;
    }

    normalizePresentationSections(candidate);
    var validation = validatePresentationDocument(candidate);
    if (validation.errors.length > 0) {
      showDealsImportErrors(validation.errors);
      tool.notify('Import blocked: ' + validation.errors.length + ' validation error(s)', 'error');
      return;
    }

    data = candidate;
    renderDeals();
    renderCampaigns();
    renderHero();
    renderPromotions();
    renderPromoCodes();
    scheduleSave();

    var summary = Object.keys(importedCounts).map(function (sectionName) {
      return sectionName + ': ' + importedCounts[sectionName];
    }).join(', ');
    if (validation.warnings.length > 0) {
      tool.notify('Imported (' + summary + ') with ' + validation.warnings.length + ' warning(s) - see console', 'warning');
      console.warn('[IMPORT WARNINGS]', validation.warnings);
    } else {
      tool.notify('Sample data imported (' + summary + ')', 'success');
    }
    closeDealsImportModal();
  }

  var pastedText = document.getElementById('deals-import-json').value.trim();
  if (!pastedText) {
    showDealsImportErrors(['Paste a JSON object with at least one of: deals, campaigns, promotions, hero, promo_codes, or choose a JSON file first.']);
    return;
  }
  var parsed;
  try {
    parsed = JSON.parse(pastedText);
  } catch (parseError) {
    showDealsImportErrors(['The pasted text is not valid JSON: ' + parseError.message]);
    return;
  }
  applyImport(parsed);
}

/* ---- Sample menu import (T-46, updated T-48) ---- */

function openMenuImportModal() {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }
  var modal = document.getElementById('menu-import-modal');
  if (!modal) return;
  document.getElementById('menu-import-json').value = '';
  var fileInput = document.getElementById('menu-import-file-input');
  if (fileInput) fileInput.value = '';
  var fileName = document.getElementById('menu-import-file-name');
  if (fileName) fileName.textContent = 'No file chosen';
  document.getElementById('menu-import-categories').checked = true;
  document.getElementById('menu-import-items').checked = true;
  document.getElementById('menu-import-modifiers').checked = true;
  document.getElementById('menu-import-append').checked = true;
  modal.style.display = 'flex';
  tool.resize();
}

function closeMenuImportModal() {
  var modal = document.getElementById('menu-import-modal');
  if (modal) modal.style.display = 'none';
}

function showMenuImportErrors(errors) {
  var errorContainer = document.getElementById('menu-import-errors');
  if (!errorContainer) return;
  errorContainer.innerHTML = '<strong>Nothing was imported - fix these first:</strong><br>' +
    errors.map(esc).join('<br>');
  errorContainer.style.display = '';
}

function runMenuImport() {
  if (isDealEditingBlocked()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }
  var errorContainer = document.getElementById('menu-import-errors');
  if (errorContainer) errorContainer.style.display = 'none';

  var isReplace = !document.getElementById('menu-import-append').checked;
  var importCategories = document.getElementById('menu-import-categories').checked;
  var importItems = document.getElementById('menu-import-items').checked;
  var importModifiers = document.getElementById('menu-import-modifiers').checked;

  function applyImport(incoming) {
    var menuIncoming = isPlainObject(incoming) && isPlainObject(incoming.menu) ? incoming.menu : incoming;
    var hasCategories = Array.isArray(menuIncoming.categories);
    var hasItems = Array.isArray(menuIncoming.items);
    var hasModifiers = Array.isArray(menuIncoming.modifier_groups);
    if (!isPlainObject(menuIncoming) || (!hasCategories && !hasItems && !hasModifiers)) {
      showMenuImportErrors(['The imported JSON must be an object with a "menu" key (or the menu object itself) holding at least one of: categories, items, modifier_groups.']);
      return;
    }

    var structuralErrors = [];
    function checkId(list, label, requiredField) {
      (list || []).forEach(function (entry) {
        var entryLabel = entry && entry.id ? entry.id : '?';
        if (!entry || !entry.id) structuralErrors.push(label + ' entries need an "id" field.');
        if (entry && !entry[requiredField]) structuralErrors.push(label + ' entry "' + entryLabel + '" is missing "' + requiredField + '".');
      });
    }
    if (hasCategories && importCategories) checkId(menuIncoming.categories, 'Category', 'name');
    if (hasItems && importItems) {
      checkId(menuIncoming.items, 'Item', 'item_name');
      (menuIncoming.items || []).forEach(function (entry) {
        if (entry && entry.id && !entry.category_id && entry.category_id !== '') {
          structuralErrors.push('Item "' + entry.id + '" is missing "category_id".');
        }
      });
    }
    if (hasModifiers && importModifiers) {
      checkId(menuIncoming.modifier_groups, 'Modifier group', 'group_name');
      (menuIncoming.modifier_groups || []).forEach(function (group) {
        (group.options || []).forEach(function (opt) {
          if (!opt || !opt.id) structuralErrors.push('Modifier group "' + (group.id || '?') + '" has an option without an "id".');
          if (opt && opt.id && !opt.option_name) structuralErrors.push('Modifier option "' + opt.id + '" is missing "option_name".');
        });
      });
    }
    if (structuralErrors.length > 0) {
      showMenuImportErrors(structuralErrors);
      return;
    }

    var candidate = JSON.parse(JSON.stringify(data));
    var importedCounts = {};
    var skippedCounts = {};

    function appendUnique(section, incomingList) {
      var existing = candidate.menu[section] || [];
      var existingIds = {};
      existing.forEach(function (entry) { existingIds[entry.id] = true; });
      var added = 0;
      var skipped = 0;
      (incomingList || []).forEach(function (entry) {
        if (existingIds[entry.id]) { skipped++; return; }
        existingIds[entry.id] = true;
        existing.push(JSON.parse(JSON.stringify(entry)));
        added++;
      });
      candidate.menu[section] = existing;
      importedCounts[section] = added;
      if (skipped > 0) skippedCounts[section] = skipped;
    }

    if (isReplace) {
      candidate.menu = { categories: [], items: [], modifier_groups: [] };
      if (hasCategories) candidate.menu.categories = JSON.parse(JSON.stringify(menuIncoming.categories));
      if (hasItems) candidate.menu.items = JSON.parse(JSON.stringify(menuIncoming.items));
      if (hasModifiers) candidate.menu.modifier_groups = JSON.parse(JSON.stringify(menuIncoming.modifier_groups));
      importedCounts.categories = candidate.menu.categories.length;
      importedCounts.items = candidate.menu.items.length;
      importedCounts.modifier_groups = candidate.menu.modifier_groups.length;
    } else {
      if (hasCategories && importCategories) appendUnique('categories', menuIncoming.categories);
      if (hasItems && importItems) appendUnique('items', menuIncoming.items);
      if (hasModifiers && importModifiers) appendUnique('modifier_groups', menuIncoming.modifier_groups);
    }

    if (Object.keys(importedCounts).length === 0) {
      showMenuImportErrors(['Nothing to import - the JSON does not contain any of the selected sections, or every entry id already exists.']);
      return;
    }

    data = candidate;
    renderCategories();
    renderModGroups();
    renderItems();
    renderModGroupCheckboxes();
    renderDeals();
    scheduleSave();

    var summary = Object.keys(importedCounts).map(function (key) { return key + ': ' + importedCounts[key]; }).join(', ');
    var skippedNote = Object.keys(skippedCounts).map(function (key) {
      return skippedCounts[key] + ' ' + key + ' skipped (same id already exists)';
    }).join(', ');
    var validation = validatePresentationDocument(data);
    if (validation.errors.length > 0) {
      tool.notify('Menu imported (' + summary + ') - ' + validation.errors.length + ' existing deal error(s) remain', 'warning');
    } else {
      tool.notify('Sample menu imported (' + summary + ')' + (skippedNote ? '; ' + skippedNote : ''), 'success');
    }
    closeMenuImportModal();
  }

  var pastedText = document.getElementById('menu-import-json').value.trim();
  if (!pastedText) {
    showMenuImportErrors(['Paste a JSON object with a "menu" key holding categories, items and modifier_groups, or choose a JSON file first.']);
    return;
  }
  var parsed;
  try {
    parsed = JSON.parse(pastedText);
  } catch (parseError) {
    showMenuImportErrors(['The pasted text is not valid JSON: ' + parseError.message]);
    return;
  }
  applyImport(parsed);
}

/* ===================================================================== */
/* RESTAURANT LOCATION TOOLING (T-59) AND MAP CENTERING (T-50) */
/* ===================================================================== */

var DEFAULT_MAP_CENTER = [40.7128, -74.006];
var coordinatePickerMap = null;
var coordinatePickerMarker = null;
var restaurantMapMarker = null;

function readRestaurantCoordinates() {
  var coordinates = (data.general_info && data.general_info.coordinates) || {};
  var latitude = parseFloat(coordinates.lat);
  var longitude = parseFloat(coordinates.lng);
  if (!isFinite(latitude) || !isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude: latitude, longitude: longitude };
}

function readFirstZoneCenter() {
  var zones = (data.delivery_zones && data.delivery_zones.zones) || [];
  for (var zoneIndex = 0; zoneIndex < zones.length; zoneIndex += 1) {
    var shapes = zones[zoneIndex].shapes || [];
    for (var shapeIndex = 0; shapeIndex < shapes.length; shapeIndex += 1) {
      var shape = shapes[shapeIndex];
      if (shape.type === 'Circle' && shape.center && shape.center.length === 2) {
        return { latitude: shape.center[1], longitude: shape.center[0] };
      }
      if (shape.coordinates && shape.coordinates[0] && shape.coordinates[0][0]) {
        var ring = shape.coordinates[0];
        var latitudeSum = 0;
        var longitudeSum = 0;
        ring.forEach(function (point) {
          longitudeSum += point[0];
          latitudeSum += point[1];
        });
        return { latitude: latitudeSum / ring.length, longitude: longitudeSum / ring.length };
      }
    }
  }
  return null;
}

function resolveMapCenter() {
  return readRestaurantCoordinates() || readFirstZoneCenter() || { latitude: DEFAULT_MAP_CENTER[0], longitude: DEFAULT_MAP_CENTER[1] };
}

function updateRestaurantMarker() {
  if (!zoneMap) return;
  var coordinates = readRestaurantCoordinates();
  if (!coordinates) {
    if (restaurantMapMarker) { zoneMap.removeLayer(restaurantMapMarker); restaurantMapMarker = null; }
    return;
  }
  var latlng = [coordinates.latitude, coordinates.longitude];
  if (!restaurantMapMarker) {
    restaurantMapMarker = L.circleMarker(latlng, {
      radius: 7, color: '#ffffff', weight: 2, fillColor: '#4f46e5', fillOpacity: 1
    }).addTo(zoneMap);
    restaurantMapMarker.bindTooltip('Restaurant', { direction: 'top', offset: [0, -6] });
  } else {
    restaurantMapMarker.setLatLng(latlng);
  }
}

function centerZoneMapOnRestaurant() {
  if (!zoneMap) return;
  var coordinates = readRestaurantCoordinates();
  if (!coordinates) {
    tool.notify('Set the restaurant coordinates in the General tab first.', 'warning');
    return;
  }
  zoneMap.setView([coordinates.latitude, coordinates.longitude], 13);
  updateRestaurantMarker();
}

/* ---------- Coordinate picker ---------- */
function updateCoordinateHint() {
  var hint = document.getElementById('gen-coord-hint');
  if (!hint) return;
  var coordinates = readRestaurantCoordinates();
  hint.textContent = coordinates
    ? ('Pinned at ' + coordinates.latitude.toFixed(6) + ', ' + coordinates.longitude.toFixed(6))
    : 'No point selected yet.';
}

function setCoordinatePickerMarker(latitude, longitude) {
  if (!coordinatePickerMap) return;
  var latlng = [latitude, longitude];
  if (!coordinatePickerMarker) {
    coordinatePickerMarker = L.marker(latlng, { draggable: true }).addTo(coordinatePickerMap);
    coordinatePickerMarker.on('dragend', function () {
      var position = coordinatePickerMarker.getLatLng();
      applyPickedCoordinates(position.lat, position.lng, false);
    });
  } else {
    coordinatePickerMarker.setLatLng(latlng);
  }
}

function applyPickedCoordinates(latitude, longitude, movePickerMarker) {
  var latitudeValue = parseFloat(latitude);
  var longitudeValue = parseFloat(longitude);
  if (!isFinite(latitudeValue) || !isFinite(longitudeValue)) return;
  if (latitudeValue < -90 || latitudeValue > 90 || longitudeValue < -180 || longitudeValue > 180) return;

  var roundedLatitude = Math.round(latitudeValue * 1000000) / 1000000;
  var roundedLongitude = Math.round(longitudeValue * 1000000) / 1000000;

  if (!data.general_info.coordinates) data.general_info.coordinates = { lat: roundedLatitude, lng: roundedLongitude };
  data.general_info.coordinates.lat = roundedLatitude;
  data.general_info.coordinates.lng = roundedLongitude;

  var latitudeInput = document.getElementById('gen-coord-lat');
  var longitudeInput = document.getElementById('gen-coord-lng');
  if (latitudeInput) latitudeInput.value = roundedLatitude;
  if (longitudeInput) longitudeInput.value = roundedLongitude;

  if (movePickerMarker) setCoordinatePickerMarker(roundedLatitude, roundedLongitude);
  updateCoordinateHint();
  updateRestaurantMarker();
  scheduleSave();
}

function openCoordinatePicker() {
  var mapWrap = document.getElementById('gen-coord-map-wrap');
  if (!mapWrap) return;
  mapWrap.style.display = '';

  if (!coordinatePickerMap) {
    coordinatePickerMap = L.map('gen-coord-map', { center: DEFAULT_MAP_CENTER, zoom: 3, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(coordinatePickerMap);
    coordinatePickerMap.on('click', function (event) {
      applyPickedCoordinates(event.latlng.lat, event.latlng.lng, true);
    });
  }

  var coordinates = readRestaurantCoordinates();
  if (coordinates) {
    coordinatePickerMap.setView([coordinates.latitude, coordinates.longitude], 14);
    setCoordinatePickerMarker(coordinates.latitude, coordinates.longitude);
  } else {
    coordinatePickerMap.setView(DEFAULT_MAP_CENTER, 3);
  }

  setTimeout(function () {
    if (coordinatePickerMap) coordinatePickerMap.invalidateSize();
    tool.resize();
  }, 80);
  updateCoordinateHint();
}

function parseCoordinatesFromMapsLink(rawText) {
  var text = String(rawText || '').trim();
  if (!text) return null;
  var patterns = [
    /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /[?&]q=(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /[?&]ll=(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/
  ];
  for (var patternIndex = 0; patternIndex < patterns.length; patternIndex += 1) {
    var match = text.match(patterns[patternIndex]);
    if (!match) continue;
    var latitude = parseFloat(match[1]);
    var longitude = parseFloat(match[2]);
    if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
      return { latitude: latitude, longitude: longitude };
    }
  }
  return null;
}

function applyCoordinateMapsLink() {
  var linkInput = document.getElementById('gen-coord-maps-link');
  if (!linkInput) return;
  var coordinates = parseCoordinatesFromMapsLink(linkInput.value);
  if (!coordinates) {
    tool.notify('That link does not contain coordinates. Paste a Google Maps link or "lat, lng".', 'warning');
    return;
  }
  if (!coordinatePickerMap) openCoordinatePicker();
  coordinatePickerMap.setView([coordinates.latitude, coordinates.longitude], 14);
  applyPickedCoordinates(coordinates.latitude, coordinates.longitude, true);
  linkInput.value = '';
  tool.notify('Coordinates taken from the link.', 'success');
}

/* ===================================================================== */
/* STATE AND PROVINCE TAX TEMPLATES (T-51, D-RAMM-32) */
/* ===================================================================== */

var TAX_TEMPLATE_EFFECTIVE = '2026-01';
var pendingTaxTemplate = null;

function usStateTaxTemplate(stateCode, stateName, rate) {
  return {
    country: 'US', code: stateCode, label: stateName,
    taxName: 'Sales Tax (' + stateCode + ')', rate: rate,
    note: 'State base rate only. County, city and special district taxes are additional and must be confirmed locally.'
  };
}

function canadaProvinceTaxTemplate(provinceCode, provinceName, taxName, rate) {
  return {
    country: 'CA', code: provinceCode, label: provinceName,
    taxName: taxName + ' (' + provinceCode + ')', rate: rate,
    note: 'Combined federal and provincial rate. Confirm the current rate and any local additions before relying on it.'
  };
}

var TAX_TEMPLATES = [
  usStateTaxTemplate('AL', 'Alabama', 4.0),
  usStateTaxTemplate('AK', 'Alaska', 0),
  usStateTaxTemplate('AZ', 'Arizona', 5.6),
  usStateTaxTemplate('AR', 'Arkansas', 6.5),
  usStateTaxTemplate('CA', 'California', 7.25),
  usStateTaxTemplate('CO', 'Colorado', 2.9),
  usStateTaxTemplate('CT', 'Connecticut', 6.35),
  usStateTaxTemplate('DE', 'Delaware', 0),
  usStateTaxTemplate('DC', 'District of Columbia', 6.0),
  usStateTaxTemplate('FL', 'Florida', 6.0),
  usStateTaxTemplate('GA', 'Georgia', 4.0),
  usStateTaxTemplate('HI', 'Hawaii', 4.0),
  usStateTaxTemplate('ID', 'Idaho', 6.0),
  usStateTaxTemplate('IL', 'Illinois', 6.25),
  usStateTaxTemplate('IN', 'Indiana', 7.0),
  usStateTaxTemplate('IA', 'Iowa', 6.0),
  usStateTaxTemplate('KS', 'Kansas', 6.5),
  usStateTaxTemplate('KY', 'Kentucky', 6.0),
  usStateTaxTemplate('LA', 'Louisiana', 4.45),
  usStateTaxTemplate('ME', 'Maine', 5.5),
  usStateTaxTemplate('MD', 'Maryland', 6.0),
  usStateTaxTemplate('MA', 'Massachusetts', 6.25),
  usStateTaxTemplate('MI', 'Michigan', 6.0),
  usStateTaxTemplate('MN', 'Minnesota', 6.875),
  usStateTaxTemplate('MS', 'Mississippi', 7.0),
  usStateTaxTemplate('MO', 'Missouri', 4.225),
  usStateTaxTemplate('MT', 'Montana', 0),
  usStateTaxTemplate('NE', 'Nebraska', 5.5),
  usStateTaxTemplate('NV', 'Nevada', 6.85),
  usStateTaxTemplate('NH', 'New Hampshire', 0),
  usStateTaxTemplate('NJ', 'New Jersey', 6.625),
  usStateTaxTemplate('NM', 'New Mexico', 4.875),
  usStateTaxTemplate('NY', 'New York', 4.0),
  usStateTaxTemplate('NC', 'North Carolina', 4.75),
  usStateTaxTemplate('ND', 'North Dakota', 5.0),
  usStateTaxTemplate('OH', 'Ohio', 5.75),
  usStateTaxTemplate('OK', 'Oklahoma', 4.5),
  usStateTaxTemplate('OR', 'Oregon', 0),
  usStateTaxTemplate('PA', 'Pennsylvania', 6.0),
  usStateTaxTemplate('RI', 'Rhode Island', 7.0),
  usStateTaxTemplate('SC', 'South Carolina', 6.0),
  usStateTaxTemplate('SD', 'South Dakota', 4.2),
  usStateTaxTemplate('TN', 'Tennessee', 7.0),
  usStateTaxTemplate('TX', 'Texas', 6.25),
  usStateTaxTemplate('UT', 'Utah', 4.85),
  usStateTaxTemplate('VT', 'Vermont', 6.0),
  usStateTaxTemplate('VA', 'Virginia', 4.3),
  usStateTaxTemplate('WA', 'Washington', 6.5),
  usStateTaxTemplate('WV', 'West Virginia', 6.0),
  usStateTaxTemplate('WI', 'Wisconsin', 5.0),
  usStateTaxTemplate('WY', 'Wyoming', 4.0),
  canadaProvinceTaxTemplate('AB', 'Alberta', 'GST', 5.0),
  canadaProvinceTaxTemplate('BC', 'British Columbia', 'GST + PST', 12.0),
  canadaProvinceTaxTemplate('MB', 'Manitoba', 'GST + RST', 12.0),
  canadaProvinceTaxTemplate('NB', 'New Brunswick', 'HST', 15.0),
  canadaProvinceTaxTemplate('NL', 'Newfoundland and Labrador', 'HST', 15.0),
  canadaProvinceTaxTemplate('NS', 'Nova Scotia', 'HST', 14.0),
  canadaProvinceTaxTemplate('NT', 'Northwest Territories', 'GST', 5.0),
  canadaProvinceTaxTemplate('NU', 'Nunavut', 'GST', 5.0),
  canadaProvinceTaxTemplate('ON', 'Ontario', 'HST', 13.0),
  canadaProvinceTaxTemplate('PE', 'Prince Edward Island', 'HST', 15.0),
  canadaProvinceTaxTemplate('QC', 'Quebec', 'GST + QST', 14.975),
  canadaProvinceTaxTemplate('SK', 'Saskatchewan', 'GST + PST', 11.0),
  canadaProvinceTaxTemplate('YT', 'Yukon', 'GST', 5.0)
];

function findTaxTemplate(countryCode, regionCode) {
  var country = String(countryCode || '').toUpperCase();
  var region = String(regionCode || '').toUpperCase();
  if (!country || !region) return null;
  for (var index = 0; index < TAX_TEMPLATES.length; index += 1) {
    if (TAX_TEMPLATES[index].country === country && TAX_TEMPLATES[index].code === region) {
      return TAX_TEMPLATES[index];
    }
  }
  return null;
}

function readCurrentAddressRegion() {
  var address = (data.general_info && data.general_info.address) || {};
  return { country: address.country || '', region: address.state || '' };
}

function renderTaxTemplateHint() {
  var hint = document.getElementById('tax-template-hint');
  if (!hint) return;
  var address = readCurrentAddressRegion();
  var template = findTaxTemplate(address.country, address.region);
  if (!address.country || !address.region) {
    hint.textContent = 'Select a country and state or province in General to see a template.';
    return;
  }
  hint.textContent = template
    ? ('Template available: ' + template.taxName + ' at ' + template.rate + '%. Effective ' + TAX_TEMPLATE_EFFECTIVE + '.')
    : 'No template for this country and region.';
}

function openTaxTemplateConfirm() {
  if (tool.isReadOnly && tool.isReadOnly()) {
    tool.notify('This record is read-only.', 'warning');
    return;
  }
  var address = readCurrentAddressRegion();
  var template = findTaxTemplate(address.country, address.region);
  if (!template) {
    tool.notify('Select a country and state or province in General first.', 'warning');
    return;
  }

  pendingTaxTemplate = template;
  var existingCategories = (data.taxation_currency && data.taxation_currency.tax_categories) || [];

  var nameElement = document.getElementById('tax-template-confirm-name');
  if (nameElement) nameElement.textContent = template.taxName + ' at ' + template.rate + '%';
  var noteElement = document.getElementById('tax-template-confirm-note');
  if (noteElement) noteElement.textContent = template.note;
  var existingElement = document.getElementById('tax-template-confirm-existing');
  if (existingElement) {
    existingElement.textContent = existingCategories.length > 0
      ? ('This replaces ' + existingCategories.length + ' existing tax categor' + (existingCategories.length === 1 ? 'y' : 'ies') + '.')
      : 'This creates one tax category.';
  }

  var modal = document.getElementById('tax-template-modal');
  if (modal) modal.style.display = 'flex';
}

function applyTaxTemplate() {
  if (!pendingTaxTemplate) return;
  var template = pendingTaxTemplate;
  pendingTaxTemplate = null;

  var modal = document.getElementById('tax-template-modal');
  if (modal) modal.style.display = 'none';

  if (!data.taxation_currency) {
    data.taxation_currency = { currency: 'USD', tax_mode: 'exclusive', tax_name: 'Tax', tax_categories: [], delivery_fee_tax_rate: 0 };
  }
  data.taxation_currency.tax_name = template.taxName;
  data.taxation_currency.tax_categories = [{
    name: template.taxName, pickup: template.rate, delivery: template.rate, in_restaurant: template.rate
  }];
  data.taxation_currency.delivery_fee_tax_rate = template.rate;

  var nameInput = document.getElementById('tax-name');
  if (nameInput) nameInput.value = template.taxName;
  var feeInput = document.getElementById('tax-deliv-fee-rate');
  if (feeInput) feeInput.value = template.rate;

  renderTaxCategories();
  renderTaxTemplateHint();
  scheduleSave();
  tool.notify('Tax template applied: ' + template.taxName + ' at ' + template.rate + '%.', 'success');
}

function cancelTaxTemplate() {
  pendingTaxTemplate = null;
  var modal = document.getElementById('tax-template-modal');
  if (modal) modal.style.display = 'none';
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

  /* Normalize the optional presentation sections: deals, hero, promotions, campaigns. */
  normalizePresentationSections(data);

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
  renderDeals();
  renderCampaigns();
  renderHero();
  renderPromotions();
  renderPromoCodes();
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
