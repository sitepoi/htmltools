/* ═══════════════════════════════════════════════════════════
   TRAVEL PLANNER — UniconHub html-tool
   Chat-driven travel planning. The AI answers with JSON plans
   built from the component catalog below; this tool renders
   every component itself.
   ═══════════════════════════════════════════════════════════ */
'use strict';

/* ── Tiny helpers ── */
function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function el(id) { return document.getElementById(id); }
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      try { tool.notify('Copied to clipboard', 'success'); } catch (e) {}
    }, function() {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}
function fallbackCopy(text) {
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    try { tool.notify('Copied to clipboard', 'success'); } catch (e) {}
  } catch (e) {
    try { tool.notify('Copy failed — please copy manually', 'warning'); } catch (e2) {}
  }
}
function fmtMoney(amount, currency) {
  if (amount === null || amount === undefined || amount === '') return '';
  var n = Number(amount);
  if (isNaN(n)) return '';
  var s = n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return (currency ? String(currency) + ' ' : '') + s;
}
function fmtDate(d) {
  try {
    var t = new Date(String(d) + (String(d).length === 10 ? 'T00:00:00' : ''));
    if (isNaN(t.getTime())) return String(d);
    return t.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) { return String(d); }
}
function slugify(s) {
  var out = String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return out || 'travel-plan';
}
function daysBetween(startDate, endDate) {
  try {
    var a = new Date(startDate + 'T00:00:00');
    var b = new Date(endDate + 'T00:00:00');
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
    return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  } catch (e) { return 0; }
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT CATALOG — the ONLY building blocks the AI may use.
   Each entry: icon, label, desc, fields, render(d).
   ═══════════════════════════════════════════════════════════ */
var TRANSPORT_ICONS = {
  flight: '✈️', train: '🚆', bus: '🚌', car: '🚗', taxi: '🚕',
  ferry: '⛴️', metro: '🚇', tram: '🚋', walk: '🚶', bike: '🚲',
  rental: '🔑', other: '🚐'
};
var MEAL_ICONS = {
  breakfast: '🥐', lunch: '🥗', dinner: '🍽️', snack: '🍿', coffee: '☕', other: '🍴'
};
var STYLE_OPTIONS = ['mixed', 'relaxed', 'culture', 'adventure', 'beach', 'foodie', 'budget', 'luxury', 'nature', 'city'];
var TRAVELER_OPTIONS = ['solo', 'couple', 'friends', 'family', 'group'];

var DAY_COMPONENTS = {
  activity: {
    icon: '🎯', label: 'Activity', kind: 'day',
    desc: 'A sightseeing stop, tour, museum, beach time, hike or experience.',
    fields: '{title, time:"HH:MM", duration, location, description, cost, booking, tips:[], tags:[]}',
    render: function(d) {
      return tpItem('activity', '🎯', tpTime(d.time), esc(d.title || 'Activity'), sub(
        (d.location ? '📍 ' + esc(d.location) : '') +
        (d.duration ? (d.location ? ' · ' : '') + '⏱ ' + esc(d.duration) : '')
      ), esc(d.description || ''), chips(
        (d.cost !== undefined && d.cost !== null && d.cost !== '' ? chip(fmtMoney(d.cost, d.currency), 'cost') : '') +
        (d.booking ? chip(esc(d.booking), 'booking') : '') +
        (d.tags || []).map(function(t) { return chip(esc(t), 'tag'); }).join('')
      ), tipsHtml(d.tips));
    }
  },
  sightseeing: {
    icon: '🏛️', label: 'Sightseeing', kind: 'day',
    desc: 'A landmark, monument, viewpoint or cultural site to visit.',
    fields: '{title, time, location, description, cost, tips:[]}',
    render: function(d) {
      return tpItem('sightseeing', '🏛️', tpTime(d.time), esc(d.title || 'Sightseeing'), sub(
        (d.location ? '📍 ' + esc(d.location) : '')
      ), esc(d.description || ''), chips(
        (d.cost !== undefined && d.cost !== null && d.cost !== '' ? chip(fmtMoney(d.cost, d.currency), 'cost') : '') +
        (d.booking ? chip(esc(d.booking), 'booking') : '')
      ), tipsHtml(d.tips));
    }
  },
  transport: {
    icon: '🚆', label: 'Transport', kind: 'day',
    desc: 'A journey leg: flight, train, bus, taxi, ferry, metro, walk, rental car…',
    fields: '{mode:"flight|train|bus|car|taxi|ferry|metro|tram|walk|bike|rental|other", from, to, departure:"HH:MM", arrival:"HH:MM", ref, cost, booking, notes}',
    render: function(d) {
      var mode = String(d.mode || 'other').toLowerCase();
      var ico = TRANSPORT_ICONS[mode] || '🚐';
      var route = esc(d.from || '') + (d.from && d.to ? ' → ' : '') + esc(d.to || '');
      var times = (d.departure ? esc(d.departure) : '') + (d.departure && d.arrival ? ' – ' : '') + (d.arrival ? esc(d.arrival) : '');
      return tpItem('transport', ico, tpTime(d.departure), route || ('Transport'), sub(times), esc(d.notes || ''), chips(
        (d.ref ? chip(esc(d.ref), 'booking') : '') +
        (d.cost !== undefined && d.cost !== null && d.cost !== '' ? chip(fmtMoney(d.cost, d.currency), 'cost') : '') +
        (d.booking ? chip(esc(d.booking), 'booking') : '')
      ), '');
    }
  },
  stay: {
    icon: '🏨', label: 'Stay / Accommodation', kind: 'day',
    desc: 'Where the traveler sleeps: hotel, apartment, hostel, resort, camp…',
    fields: '{name, type:"hotel|apartment|hostel|airbnb|resort|camp|other", checkIn:"HH:MM", checkOut:"HH:MM", address, cost, booking, notes, rating:0-5}',
    render: function(d) {
      var stars = '';
      var r = Number(d.rating);
      if (!isNaN(r) && r > 0) stars = ' ' + '★'.repeat(Math.min(5, Math.round(r)));
      var check = (d.checkIn ? 'Check-in ' + esc(d.checkIn) : '') +
        (d.checkIn && d.checkOut ? ' · ' : '') + (d.checkOut ? 'Check-out ' + esc(d.checkOut) : '');
      return tpItem('stay', '🏨', '', esc(d.name || 'Accommodation') + stars, sub(
        (d.type ? esc(d.type) : '') + (d.type && check ? ' · ' : '') + check
      ), esc(d.notes || ''), chips(
        (d.address ? chip('📍 ' + esc(d.address), '') : '') +
        (d.cost !== undefined && d.cost !== null && d.cost !== '' ? chip(fmtMoney(d.cost, d.currency), 'cost') : '') +
        (d.booking ? chip(esc(d.booking), 'booking') : '')
      ), '');
    }
  },
  meal: {
    icon: '🍽️', label: 'Meal / Food stop', kind: 'day',
    desc: 'A breakfast, lunch, dinner, snack or coffee stop.',
    fields: '{meal:"breakfast|lunch|dinner|snack|coffee|other", name, place, cuisine, cost, reservation, kidFriendly:bool, notes}',
    render: function(d) {
      var m = String(d.meal || 'other').toLowerCase();
      var ico = MEAL_ICONS[m] || '🍴';
      var title = esc(d.name || d.place || 'Meal');
      return tpItem('meal', ico, tpTime(d.time), title, sub(
        (d.place ? '📍 ' + esc(d.place) : '') +
        (d.cuisine ? (d.place ? ' · ' : '') + esc(d.cuisine) : '')
      ), esc(d.notes || ''), chips(
        (d.kidFriendly ? chip('👶 kid-friendly', 'tag') : '') +
        (d.reservation ? chip(esc(d.reservation), 'booking') : '') +
        (d.cost !== undefined && d.cost !== null && d.cost !== '' ? chip(fmtMoney(d.cost, d.currency), 'cost') : '')
      ), '');
    }
  },
  freeTime: {
    icon: '☕', label: 'Free time', kind: 'day',
    desc: 'An unplanned block with optional suggestions (shopping, wandering, rest).',
    fields: '{title, duration, suggestions:[], notes}',
    render: function(d) {
      var body = esc(d.notes || '');
      if (d.suggestions && d.suggestions.length) {
        body += '<ul class="tp-tips-list">';
        for (var i = 0; i < d.suggestions.length; i++) body += '<li>' + esc(d.suggestions[i]) + '</li>';
        body += '</ul>';
      }
      return tpItem('freeTime', '☕', '', esc(d.title || 'Free time'), sub(d.duration ? '⏱ ' + esc(d.duration) : ''), body, '', '');
    }
  },
  note: {
    icon: '📝', label: 'Note', kind: 'day',
    desc: 'A plain informational note for the day (reminders, addresses, names).',
    fields: '{title, text}',
    render: function(d) {
      return tpItem('note', '📝', '', esc(d.title || 'Note'), '', esc(d.text || ''), '', '');
    }
  },
  alert: {
    icon: '⚠️', label: 'Alert', kind: 'day',
    desc: 'A day-level warning: weather, closure, visa reminder, scam warning…',
    fields: '{level:"info|warning|danger", text}',
    render: function(d) {
      var lvl = String(d.level || 'info').toLowerCase();
      if (['info', 'warning', 'danger'].indexOf(lvl) === -1) lvl = 'info';
      return '<div class="tp-item"><div class="tp-item-ico alert">⚠️</div><div class="tp-item-main">' +
        '<div class="tp-alert-strip ' + lvl + '">' + esc(d.text || '') + '</div></div></div>';
    }
  }
};

var SECTION_COMPONENTS = {
  packing: {
    icon: '🧳', label: 'Packing list', kind: 'section',
    desc: 'What to pack, grouped by category.',
    fields: '{items:[{name, category:"Clothing|Toiletries|Documents|Electronics|Health|Kids|Other", essential:bool, note}]}',
    render: function(d) {
      var items = (d.items || []).filter(function(x) { return x && (x.name || x.text); });
      if (!items.length) return '<div class="tp-list-text">Empty packing list.</div>';
      var groups = {};
      var order = [];
      items.forEach(function(it) {
        var cat = String(it.category || 'General').trim() || 'General';
        if (!groups[cat]) { groups[cat] = []; order.push(cat); }
        groups[cat].push(it);
      });
      var h = '';
      for (var g = 0; g < order.length; g++) {
        var cat = order[g];
        h += '<div style="font-weight:700;font-size:11px;color:#0e7490;margin:8px 0 3px">' + esc(cat) + '</div>';
        for (var i = 0; i < groups[cat].length; i++) {
          var it = groups[cat][i];
          h += '<div class="tp-list-row"><span class="ico">' + (it.essential ? '✅' : '▫️') + '</span>' +
            '<div class="tp-list-main"><div class="tp-list-title">' + esc(it.name || it.text) + '</div>' +
            (it.note ? '<div class="tp-list-text">' + esc(it.note) + '</div>' : '') + '</div>' +
            (it.essential ? '<span class="tp-chip essential">essential</span>' : '') + '</div>';
        }
      }
      return h;
    }
  },
  budget: {
    icon: '💰', label: 'Budget breakdown', kind: 'section',
    desc: 'Estimated costs per category with a total.',
    fields: '{currency, items:[{label, amount, category}], notes}',
    render: function(d) {
      var items = (d.items || []).filter(function(x) { return x && (x.label || x.name); });
      var cur = d.currency || DB.plan.budget.currency || '';
      var h = '';
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var label = it.label || it.name;
        var amt = it.amount !== undefined ? it.amount : it.cost;
        h += '<div class="tp-budget-row"><span class="tp-budget-label">' + esc(label) +
          (it.category ? ' <span class="tp-budget-cat">' + esc(it.category) + '</span>' : '') + '</span>' +
          '<span class="tp-budget-amount">' + esc(fmtMoney(amt, cur)) + '</span></div>';
      }
      if (items.length > 1) {
        var sums = {};
        items.forEach(function(it) {
          var c = String(it.category || 'Other');
          var a = Number(it.amount !== undefined ? it.amount : it.cost) || 0;
          sums[c] = (sums[c] || 0) + a;
        });
        var cats = Object.keys(sums);
        if (cats.length > 1) {
          for (var c2 = 0; c2 < cats.length; c2++) {
            h += '<div class="tp-cat-sum"><span>' + esc(cats[c2]) + '</span><span>' + esc(fmtMoney(sums[cats[c2]], cur)) + '</span></div>';
          }
        }
      }
      var total = 0;
      items.forEach(function(it) { total += Number(it.amount !== undefined ? it.amount : it.cost) || 0; });
      if (total > 0) {
        h += '<div class="tp-budget-total"><span>Estimated total</span><span>' + esc(fmtMoney(total, cur)) + '</span></div>';
        var cnt = (DB.plan.travelers && DB.plan.travelers.count) ? Number(DB.plan.travelers.count) : 0;
        if (cnt > 1) h += '<div class="tp-cat-sum"><span>Per person</span><span>' + esc(fmtMoney(total / cnt, cur)) + '</span></div>';
      }
      if (d.notes) h += '<div class="tp-list-text" style="margin-top:8px">' + esc(d.notes) + '</div>';
      return h || '<div class="tp-list-text">No budget items yet.</div>';
    }
  },
  documents: {
    icon: '🛂', label: 'Documents & visas', kind: 'section',
    desc: 'Passport, visa, insurance and other paperwork with a status.',
    fields: '{items:[{name, status:"apply|pending|ready", note}]}',
    render: function(d) {
      var items = (d.items || []).filter(function(x) { return x && (x.name || x.title); });
      if (!items.length) return '<div class="tp-list-text">No documents listed.</div>';
      var h = '';
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var st = String(it.status || '').toLowerCase();
        var cls = 'status-' + (st === 'ready' || st === 'booked' || st === 'done' ? 'ready' : st === 'pending' ? 'pending' : st === 'apply' || st === 'required' || st === 'needed' ? 'apply' : 'pending');
        h += '<div class="tp-list-row"><span class="ico">📄</span><div class="tp-list-main">' +
          '<div class="tp-list-title">' + esc(it.name || it.title) + '</div>' +
          (it.note ? '<div class="tp-list-text">' + esc(it.note) + '</div>' : '') + '</div>' +
          '<span class="tp-chip ' + cls + '">' + esc(it.status || 'pending') + '</span></div>';
      }
      return h;
    }
  },
  tips: {
    icon: '💡', label: 'Local tips & customs', kind: 'section',
    desc: 'Dos and don\u2019ts, local etiquette, money, transport and safety tips.',
    fields: '{items:[{title, text}]}',
    render: function(d) {
      var items = (d.items || []).filter(function(x) { return x && (x.title || x.text); });
      if (!items.length) return '<div class="tp-list-text">No tips yet.</div>';
      var h = '';
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        h += '<div class="tp-list-row"><span class="ico">💡</span><div class="tp-list-main">' +
          '<div class="tp-list-title">' + esc(it.title || it.text) + '</div>' +
          (it.title && it.text ? '<div class="tp-list-text">' + esc(it.text) + '</div>' : '') + '</div></div>';
      }
      return h;
    }
  },
  phrases: {
    icon: '🗣️', label: 'Useful phrases', kind: 'section',
    desc: 'Key phrases in the local language with translation and pronunciation.',
    fields: '{language, items:[{phrase, translation, phonetic}]}',
    render: function(d) {
      var items = (d.items || []).filter(function(x) { return x && (x.phrase || x.translation); });
      var h = '';
      if (d.language) h += '<div class="tp-section-sub" style="font-size:11px;color:#64748b;margin-bottom:4px">Language: ' + esc(d.language) + '</div>';
      if (!items.length) return h + '<div class="tp-list-text">No phrases yet.</div>';
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        h += '<div class="tp-phrase"><span class="tp-phrase-orig">' + esc(it.phrase) + '</span>' +
          '<span class="tp-phrase-trans">' + esc(it.translation) + '</span>' +
          (it.phonetic ? '<span class="tp-phrase-phon">(' + esc(it.phonetic) + ')</span>' : '') + '</div>';
      }
      return h;
    }
  },
  emergency: {
    icon: '🆘', label: 'Emergency info', kind: 'section',
    desc: 'Emergency numbers, embassy, hospital, pharmacy.',
    fields: '{items:[{title, text, phone}]}',
    render: function(d) {
      var items = (d.items || []).filter(function(x) { return x && (x.title || x.text); });
      if (!items.length) return '<div class="tp-list-text">No emergency info yet.</div>';
      var h = '';
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        h += '<div class="tp-list-row"><span class="ico">🆘</span><div class="tp-list-main">' +
          '<div class="tp-list-title">' + esc(it.title || it.text) + '</div>' +
          (it.title && it.text ? '<div class="tp-list-text">' + esc(it.text) + '</div>' : '') + '</div>' +
          (it.phone ? '<span class="tp-chip tag">📞 ' + esc(it.phone) + '</span>' : '') + '</div>';
      }
      return h;
    }
  },
  flights: {
    icon: '✈️', label: 'Flights', kind: 'section',
    desc: 'Flight details for outbound and return legs.',
    fields: '{items:[{direction:"outbound|return|onward", airline, flightNo, from, to, departure:"YYYY-MM-DD HH:MM", arrival, cost, booking}]}',
    render: function(d) {
      var items = (d.items || []).filter(function(x) { return x && (x.from || x.to || x.flightNo || x.airline); });
      if (!items.length) return '<div class="tp-list-text">No flights added.</div>';
      var h = '';
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        h += '<div class="tp-list-row"><span class="ico">✈️</span><div class="tp-list-main">' +
          '<div class="tp-list-title">' + (it.direction ? esc(it.direction) + ' · ' : '') + esc(it.from || '?') + ' → ' + esc(it.to || '?') + '</div>' +
          '<div class="tp-list-text">' + esc([it.airline, it.flightNo].filter(Boolean).join(' · ')) + '</div>' +
          '<div class="tp-list-meta">' +
          (it.departure ? '<span class="tp-chip">🛫 ' + esc(it.departure) + '</span>' : '') +
          (it.arrival ? '<span class="tp-chip">🛬 ' + esc(it.arrival) + '</span>' : '') +
          (it.cost !== undefined && it.cost !== null && it.cost !== '' ? '<span class="tp-chip cost">' + esc(fmtMoney(it.cost, d.currency || it.currency)) + '</span>' : '') +
          (it.booking ? '<span class="tp-chip booking">' + esc(it.booking) + '</span>' : '') +
          '</div></div></div>';
      }
      return h;
    }
  },
  map: {
    icon: '🗺️', label: 'Key places (map)', kind: 'section',
    desc: 'Important points with coordinates so they can be opened in Google Maps.',
    fields: '{points:[{label, lat, lng, note}]}',
    render: function(d) {
      var points = (d.points || d.items || []).filter(function(x) { return x && (x.label || x.name || x.title); });
      if (!points.length) return '<div class="tp-list-text">No places pinned yet.</div>';
      var h = '';
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        var label = p.label || p.name || p.title;
        h += '<div class="tp-list-row"><span class="ico">📍</span><div class="tp-list-main">' +
          '<div class="tp-list-title">' + esc(label) + '</div>' +
          (p.note ? '<div class="tp-list-text">' + esc(p.note) + '</div>' : '') + '</div>' +
          (p.lat !== undefined && p.lng !== undefined ?
            '<button class="tp-map-btn" data-map-open="1" data-lat="' + esc(p.lat) + '" data-lng="' + esc(p.lng) + '" data-label="' + esc(label) + '">Open in Maps</button>' : '') +
          '</div>';
      }
      return h;
    }
  }
};

/* ── Shared renderer helpers ── */
function tpTime(t) { return t ? '<span class="tp-item-time">' + esc(t) + '</span>' : ''; }
function sub(s) { return s ? '<div class="tp-item-sub">' + s + '</div>' : ''; }
function chip(text, cls) { return '<span class="tp-chip' + (cls ? ' ' + cls : '') + '">' + text + '</span>'; }
function chips(joined) { return joined ? '<div class="tp-item-meta">' + joined + '</div>' : ''; }
function tipsHtml(tips) {
  if (!tips || !tips.length) return '';
  var h = '<ul class="tp-tips-list">';
  for (var i = 0; i < tips.length; i++) h += '<li>' + esc(tips[i]) + '</li>';
  return h + '</ul>';
}
function tpItem(cls, ico, timeHtml, titleHtml, subHtml, bodyHtml, metaHtml, tips) {
  return '<div class="tp-item"><div class="tp-item-ico ' + cls + '">' + ico + '</div><div class="tp-item-main">' +
    '<div class="tp-item-head">' + timeHtml + '<span class="tp-item-title">' + titleHtml + '</span></div>' +
    subHtml + bodyHtml + metaHtml + tips + '</div></div>';
}

function renderComponent(c) {
  if (!c || !c.type) return '';
  var comp = DAY_COMPONENTS[c.type];
  if (!comp) {
    try {
      return '<div class="tp-item"><div class="tp-item-ico alert">⚠️</div><div class="tp-item-main">' +
        '<div class="tp-item-unknown">Unknown component "' + esc(c.type) + '" — ' + esc(JSON.stringify(c.data || {}).substring(0, 300)) + '</div></div></div>';
    } catch (e) { return ''; }
  }
  try { return comp.render(c.data || {}); }
  catch (e) {
    return '<div class="tp-item"><div class="tp-item-ico alert">⚠️</div><div class="tp-item-main">' +
      '<div class="tp-item-unknown">Component "' + esc(c.type) + '" failed: ' + esc(String(e && e.message ? e.message : e)) + '</div></div></div>';
  }
}

/* ═══════════════════════════════════════════════════════════
   DATA MODEL + NORMALIZATION
   ═══════════════════════════════════════════════════════════ */
function blankPlan() {
  return {
    title: '', destination: '', country: '',
    startDate: '', endDate: '',
    travelers: { type: 'solo', count: 1, names: [], notes: '' },
    budget: { total: 0, currency: _p('defaultCurrency', 'USD') },
    style: 'mixed',
    days: [],
    sections: []
  };
}

function normalizeComponent(c) {
  if (!c || typeof c !== 'object') return null;
  var type = String(c.type || '').trim();
  if (!type) return null;
  return { type: type, data: (c.data && typeof c.data === 'object') ? c.data : {} };
}

function normalizeDay(d, idx) {
  d = d || {};
  var dayNum = parseInt(d.day, 10);
  if (isNaN(dayNum) || dayNum < 1) dayNum = (idx || 0) + 1;
  var comps = [];
  var src = (d.components && d.components.length) ? d.components : [];
  for (var i = 0; i < src.length; i++) {
    var c = normalizeComponent(src[i]);
    if (c) comps.push(c);
  }
  return {
    day: dayNum,
    date: d.date ? String(d.date).substring(0, 10) : '',
    title: String(d.title || '').substring(0, 120),
    components: comps
  };
}

function normalizeSection(s) {
  if (!s || typeof s !== 'object') return null;
  var type = String(s.type || '').trim();
  if (!type) return null;
  return { type: type, data: (s.data && typeof s.data === 'object') ? s.data : {} };
}

function normalizePlan(p) {
  p = p || {};
  var travelers = p.travelers || {};
  var budget = p.budget || {};
  var days = [];
  var srcDays = (p.days && p.days.length) ? p.days : [];
  for (var i = 0; i < srcDays.length; i++) days.push(normalizeDay(srcDays[i], i));
  days.sort(function(a, b) { return a.day - b.day; });
  for (var j = 0; j < days.length; j++) days[j].day = j + 1;
  var sections = [];
  var srcSec = (p.sections && p.sections.length) ? p.sections : [];
  for (var k = 0; k < srcSec.length; k++) {
    var s = normalizeSection(srcSec[k]);
    if (s) sections.push(s);
  }
  var style = String(p.style || 'mixed').toLowerCase();
  if (STYLE_OPTIONS.indexOf(style) === -1) style = 'mixed';
  var tType = String(travelers.type || 'solo').toLowerCase();
  if (TRAVELER_OPTIONS.indexOf(tType) === -1) tType = 'solo';
  var count = parseInt(travelers.count, 10);
  if (isNaN(count) || count < 1) count = 1;
  var total = Number(budget.total);
  if (isNaN(total)) total = 0;
  return {
    title: String(p.title || '').substring(0, 140),
    destination: String(p.destination || '').substring(0, 140),
    country: String(p.country || '').substring(0, 120),
    startDate: p.startDate ? String(p.startDate).substring(0, 10) : '',
    endDate: p.endDate ? String(p.endDate).substring(0, 10) : '',
    travelers: {
      type: tType,
      count: count,
      names: Array.isArray(travelers.names) ? travelers.names.slice(0, 30).map(function(n) { return String(n); }) : [],
      notes: String(travelers.notes || '').substring(0, 300)
    },
    budget: {
      total: total,
      currency: String(budget.currency || _p('defaultCurrency', 'USD')).substring(0, 8)
    },
    style: style,
    days: days,
    sections: sections
  };
}

function normalizeValue(v) {
  if (!v || typeof v !== 'object') v = {};
  var plan = (v.plan && typeof v.plan === 'object') ? normalizePlan(v.plan) : blankPlan();
  var cache = v.chatCache || { sessionId: '', messages: [] };
  return {
    plan: plan,
    version: String(v.version || '1.0.0'),
    activeSessionId: String(v.activeSessionId || ''),
    chatCache: { sessionId: String(cache.sessionId || ''), messages: Array.isArray(cache.messages) ? cache.messages : [] },
    _instanceId: String(v._instanceId || ''),
    _parentRecordId: String(v._parentRecordId || '')
  };
}

var DB = {
  plan: blankPlan(),
  version: '1.0.0',
  activeSessionId: '',
  chatCache: { sessionId: '', messages: [] },
  chatMessages: [],
  _instanceId: '',
  _parentRecordId: ''
};

function _p(name, def) {
  try {
    var v = tool.param(name, def);
    return (v === null || v === undefined || v === '') ? def : String(v);
  } catch (e) { return def; }
}

/* ═══════════════════════════════════════════════════════════
   PLAN RENDERING (tool UI)
   ═══════════════════════════════════════════════════════════ */
function sortedDays() {
  var days = (DB.plan.days || []).slice();
  days.sort(function(a, b) { return a.day - b.day; });
  return days;
}

function renderDayCard(d) {
  var comps = '';
  var items = d.components || [];
  for (var i = 0; i < items.length; i++) comps += renderComponent(items[i]);
  if (!comps) {
    comps = '<div class="tp-item"><div class="tp-item-ico">📝</div><div class="tp-item-main">' +
      '<div class="tp-item-sub">No activities yet — ask the AI to fill this day.</div></div></div>';
  }
  var isTarget = _targetDay === d.day;
  return '<div class="tp-day-card">' +
    '<div class="tp-day-head">' +
      '<div class="tp-day-num">DAY ' + esc(d.day) + '</div>' +
      '<div class="tp-day-title-wrap">' +
        '<div class="tp-day-title">' + esc(d.title || ('Day ' + d.day)) + '</div>' +
        (d.date ? '<div class="tp-day-date">' + esc(fmtDate(d.date)) + '</div>' : '') +
      '</div>' +
      '<button class="btn-icon' + (isTarget ? ' on' : '') + '" data-target-day="' + d.day + '" title="Target: next AI message edits only this day">🎯</button>' +
      '<button class="btn-icon" data-day-up="' + d.day + '" title="Move up">↑</button>' +
      '<button class="btn-icon" data-day-down="' + d.day + '" title="Move down">↓</button>' +
      '<button class="btn-icon danger" data-day-del="' + d.day + '" title="Delete day">✕</button>' +
    '</div>' +
    '<div class="tp-day-body">' + comps + '</div>' +
  '</div>';
}

function renderItinerary() {
  var wrap = el('days-wrap');
  var emptyEl = el('itinerary-empty');
  if (!wrap) return;
  var days = sortedDays();
  if (!days.length) {
    wrap.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  var h = '';
  for (var i = 0; i < days.length; i++) h += renderDayCard(days[i]);
  wrap.innerHTML = h;
}

function renderSectionCard(s) {
  var comp = SECTION_COMPONENTS[s.type];
  var ico = comp ? comp.icon : '📦';
  var title = comp ? comp.label : s.type;
  var body;
  if (comp) {
    try { body = comp.render(s.data || {}); }
    catch (e) { body = '<div class="tp-list-text">Render error: ' + esc(String(e && e.message ? e.message : e)) + '</div>'; }
  } else {
    body = '<div class="tp-list-text">Unknown section "' + esc(s.type) + '".</div>';
  }
  return '<div class="tp-section-card"><div class="tp-section-head">' +
    '<span class="tp-section-ico">' + ico + '</span>' +
    '<span class="tp-section-title">' + esc(title) + '</span></div>' +
    '<div class="tp-section-body">' + body + '</div></div>';
}

function renderEssentials() {
  var grid = el('sections-grid');
  var emptyEl = el('essentials-empty');
  if (!grid) return;
  var sections = DB.plan.sections || [];
  if (!sections.length) {
    grid.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  var h = '';
  for (var i = 0; i < sections.length; i++) h += renderSectionCard(sections[i]);
  grid.innerHTML = h;
}

function renderTripHeader() {
  var input = el('trip-title-input');
  if (input && document.activeElement !== input) input.value = DB.plan.title || '';
  var line = el('trip-meta-line');
  if (line) {
    var chipsOut = [];
    if (DB.plan.destination) chipsOut.push('📍 ' + DB.plan.destination + (DB.plan.country ? ', ' + DB.plan.country : ''));
    if (DB.plan.startDate || DB.plan.endDate) {
      var dCount = DB.plan.startDate && DB.plan.endDate ? daysBetween(DB.plan.startDate, DB.plan.endDate) : 0;
      chipsOut.push('📅 ' + (DB.plan.startDate || '?') + (DB.plan.endDate ? ' → ' + DB.plan.endDate : '') + (dCount > 0 ? ' (' + dCount + ' days)' : ''));
    }
    var tv = DB.plan.travelers || {};
    chipsOut.push('👥 ' + tv.type + (tv.count > 1 ? ' · ' + tv.count : ''));
    if (DB.plan.budget && DB.plan.budget.total > 0) chipsOut.push('💰 ' + fmtMoney(DB.plan.budget.total, DB.plan.budget.currency));
    chipsOut.push('🎨 ' + (DB.plan.style || 'mixed'));
    var h2 = '';
    for (var i = 0; i < chipsOut.length; i++) h2 += '<span class="meta-chip">' + esc(chipsOut[i]) + '</span>';
    line.innerHTML = h2;
  }
  var badge = el('tp-day-badge');
  if (badge) badge.textContent = (DB.plan.days || []).length + ' day' + ((DB.plan.days || []).length === 1 ? '' : 's');
  var bBadge = el('tp-budget-badge');
  if (bBadge) {
    if (DB.plan.budget && DB.plan.budget.total > 0) {
      bBadge.style.display = '';
      bBadge.textContent = '💰 ' + fmtMoney(DB.plan.budget.total, DB.plan.budget.currency);
    } else {
      bBadge.style.display = 'none';
    }
  }
}

function renderVersion() {
  var badge = el('tool-version');
  if (badge) badge.textContent = 'v' + (DB.version || '1.0.0');
}

function renderPlan() {
  renderTripHeader();
  renderItinerary();
  renderEssentials();
  renderVersion();
  updateTargetChip();
}

/* ═══════════════════════════════════════════════════════════
   AI PROMPT — includes the FULL component catalog so the AI
   knows every building block and its data shape.
   ═══════════════════════════════════════════════════════════ */
function catalogText() {
  var out = [];
  out.push('DAY COMPONENTS — inside days[].components as {"type": "...", "data": {...}}:');
  for (var k in DAY_COMPONENTS) {
    if (!Object.prototype.hasOwnProperty.call(DAY_COMPONENTS, k)) continue;
    var m = DAY_COMPONENTS[k];
    out.push('• "' + k + '" — ' + m.label + '. ' + m.desc + ' Data: ' + m.fields);
  }
  out.push('');
  out.push('PLAN SECTIONS — inside plan.sections as {"type": "...", "data": {...}}:');
  for (var s in SECTION_COMPONENTS) {
    if (!Object.prototype.hasOwnProperty.call(SECTION_COMPONENTS, s)) continue;
    var ms = SECTION_COMPONENTS[s];
    out.push('• "' + s + '" — ' + ms.label + '. ' + ms.desc + ' Data: ' + ms.fields);
  }
  out.push('');
  out.push('ENUM VALUES:');
  out.push('• transport.mode: flight|train|bus|car|taxi|ferry|metro|tram|walk|bike|rental|other');
  out.push('• meal.meal: breakfast|lunch|dinner|snack|coffee|other');
  out.push('• alert.level: info|warning|danger');
  out.push('• travelers.type: solo|couple|friends|family|group');
  out.push('• plan.style: ' + STYLE_OPTIONS.join('|'));
  out.push('• documents[].status: apply|pending|ready');
  out.push('• Currency: 3-letter codes (USD, EUR, TRY, GBP, JPY…) used in budget.currency and cost.currency');
  return out.join('\n');
}

function planStateBlock() {
  var p = DB.plan;
  var lines = [];
  lines.push('Title: ' + (p.title || '(untitled)'));
  if (p.destination) lines.push('Destination: ' + p.destination + (p.country ? ', ' + p.country : ''));
  if (p.startDate || p.endDate) lines.push('Dates: ' + (p.startDate || '?') + ' → ' + (p.endDate || '?'));
  lines.push('Travelers: ' + (p.travelers.type || 'solo') + ' × ' + (p.travelers.count || 1) + (p.travelers.notes ? ' (' + p.travelers.notes + ')' : ''));
  lines.push('Budget: ' + fmtMoney(p.budget.total, p.budget.currency) + ' (' + p.budget.currency + ')');
  lines.push('Style: ' + (p.style || 'mixed'));
  lines.push('');
  if (!p.days.length) {
    lines.push('NO DAYS YET — build the whole plan from scratch.');
  } else {
    lines.push(p.days.length + ' day(s):');
    for (var i = 0; i < p.days.length; i++) {
      var d = p.days[i];
      var types = [];
      for (var j = 0; j < d.components.length; j++) types.push(d.components[j].type);
      lines.push(d.day + '. ' + (d.date || '?') + ' "' + (d.title || 'Day ' + d.day) + '" — components: ' + (types.join(', ') || 'none'));
    }
  }
  var secTypes = [];
  for (var k = 0; k < p.sections.length; k++) secTypes.push(p.sections[k].type);
  lines.push('Sections present: ' + (secTypes.join(', ') || 'none'));
  return lines.join('\n');
}

function buildChatPrompt(userMsg) {
  var parts = [];
  parts.push('You are an expert travel planner inside the UniconHub Travel Planner — a chat-driven trip planning studio. You plan trips of ANY type (city breaks, roadtrips, beach holidays, backpacking, luxury getaways…) for solo travelers, couples, friends, families and groups, at any destination and budget.');
  parts.push('');
  parts.push('=== CURRENT PLAN ===');
  parts.push(planStateBlock());
  parts.push('');
  parts.push('=== USER REQUEST ===');
  parts.push(userMsg);
  parts.push('');
  if (_targetDay) {
    parts.push('=== TARGETED DAY ===');
    parts.push('The user TARGETED day ' + _targetDay + '. Apply the request ONLY to that day — return a single upsertDay patch with day: ' + _targetDay + ' (keep its existing date and title; edit or add components inside it). Do NOT touch any other day.');
    parts.push('');
  }
  parts.push('=== COMPONENT CATALOG (the ONLY building blocks — never invent other types) ===');
  parts.push(catalogText());
  parts.push('');
  parts.push('HOW TO RESPOND:');
  parts.push('• JSON ONLY for plan changes: the tool renders every component from your JSON. Never output raw HTML, and never invent component or section types not listed in the catalog.');
  parts.push('• From scratch → return the FULL PLAN JSON. For edits to an existing plan → prefer the compact PATCHES format so untouched days stay exactly as they are.');
  parts.push('• Questions, ideas or explanations → answer in prose and end with 3-5 clickable next-step lines using the [[suggest_id]] label format.');
  parts.push('');
  parts.push('=== OUTPUT CONTRACT ===');
  parts.push('FULL PLAN (from scratch or full redesign):');
  parts.push('{"plan":{"title":"…","destination":"…","country":"…","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","travelers":{"type":"family","count":4,"names":["…"],"notes":"kids 6 and 9"},"budget":{"total":2400,"currency":"EUR"},"style":"mixed","days":[{"day":1,"date":"YYYY-MM-DD","title":"…","components":[{"type":"transport","data":{…}},{"type":"activity","data":{…}}]}],"sections":[{"type":"packing","data":{…}},{"type":"budget","data":{…}},{"type":"documents","data":{…}},{"type":"tips","data":{…}},{"type":"phrases","data":{…}},{"type":"emergency","data":{…}},{"type":"flights","data":{…}},{"type":"map","data":{…}}]},"summary":"short plain-language summary of what you planned","suggestions":["[[suggest_x]] add a beach day","[[suggest_x]] add a packing list"]}');
  parts.push('');
  parts.push('PATCHES (preferred for edits to an existing plan — list ONLY what changes):');
  parts.push('{"patches":[{"op":"upsertDay","day":{"day":2,"date":"…","title":"…","components":[…]}},{"op":"dayComponents","day":3,"components":[…]},{"op":"deleteDay","day":4},{"op":"moveDay","day":5,"to":1},{"op":"section","type":"packing","data":{…}},{"op":"removeSection","type":"tips"},{"op":"meta","title":"…","destination":"…","startDate":"…","endDate":"…","travelers":{…},"budget":{"total":…,"currency":"…"},"style":"…"}],"summary":"what changed","suggestions":["[[suggest_x]] …"]}');
  parts.push('• "upsertDay" matches an existing day by its day number — it REPLACES that day. For new days use the next unused day number (the tool renumbers automatically).');
  parts.push('• "dayComponents" replaces only the components of an existing day, keeping its date and title.');
  parts.push('• "section" upserts a section by type; "removeSection" deletes one.');
  parts.push('');
  parts.push('=== PLANNING RULES ===');
  parts.push('• Day numbers 1..N, each with date "YYYY-MM-DD" and a short descriptive title.');
  parts.push('• Each day: 3-7 components in chronological order (transport → activity → meal → stay …).');
  parts.push('• Real, specific content — no placeholders like "TBD" or "lorem ipsum".');
  parts.push('• Language of ALL content: ' + _p('lang', 'en') + '. Costs in ' + DB.plan.budget.currency + ' unless the user says otherwise.');
  parts.push('• Match the plan to the traveler type (family → kid-friendly meals/activities; solo → walkable flexible days; friends → social/outdoor options) and to the requested style.');
  parts.push('• Long trips: keep each day concise (3-5 components) so the whole plan fits one response. The user can refine day by day afterwards.');
  parts.push('• Always add helpful sections for real trips: at least packing, budget, documents, tips and emergency — plus phrases and map when relevant.');
  parts.push('• ALWAYS end with a "summary" and 3-5 "suggestions" in [[suggest_id]] label format so the user can keep refining by clicking.');
  return parts.join('\n');
}

/* ═══════════════════════════════════════════════════════════
   AI RESPONSE PARSING + APPLY
   ═══════════════════════════════════════════════════════════ */
function tryParseJson(s) {
  try { return JSON.parse(s); } catch (e1) {}
  var cleaned = String(s)
    .replace(/^\s*\/\/[^\n]*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1');
  try { return JSON.parse(cleaned); } catch (e2) { return null; }
}

function parseSuggestions(text) {
  var out = [];
  var seen = {};
  var lines = String(text || '').split(/\r?\n/);
  var re = /\[\[([a-zA-Z0-9_\-]+)\]\](.*)$/;
  for (var i = 0; i < lines.length; i++) {
    var m = re.exec(lines[i]);
    if (!m) continue;
    var id = m[1];
    var label = m[2].replace(/["\]},]+$/, '').trim() || id;
    if (seen[label]) continue;
    seen[label] = true;
    out.push({ id: id, text: label });
    if (out.length >= 6) break;
  }
  return out;
}

function parseSuggestionList(arr) {
  var out = [];
  var seen = {};
  if (!Array.isArray(arr)) return out;
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i];
    var txt = typeof it === 'string' ? it : String((it && (it.text || it.label)) || '');
    if (!txt) continue;
    var m = /\[\[([a-zA-Z0-9_\-]+)\]\](.*)$/.exec(txt.trim());
    var id = m ? m[1] : 's' + i;
    var label = m ? (m[2].trim() || id) : txt.trim();
    if (seen[label]) continue;
    seen[label] = true;
    out.push({ id: id, text: label });
    if (out.length >= 6) break;
  }
  return out;
}

function cleanProse(text) {
  var out = [];
  var lines = String(text || '').split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    if (/^\s*\[\[[a-zA-Z0-9_\-]+\]\]/.test(lines[i])) continue;
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

function parseAIResponse(raw) {
  var text = String(raw || '');
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  var suggestions = parseSuggestions(text);
  var s = text.indexOf('{');
  var e = text.lastIndexOf('}');
  var json = null;
  if (s !== -1 && e > s) json = tryParseJson(text.substring(s, e + 1));
  return { json: json, text: text, suggestions: suggestions };
}

function applyPatchOp(p) {
  if (!p || !p.op) return false;
  var op = String(p.op);
  var days = DB.plan.days;
  if (op === 'upsertDay') {
    if (!p.day) return false;
    var d = normalizeDay(p.day, days.length);
    var idx = -1;
    for (var i = 0; i < days.length; i++) if (days[i].day === d.day) { idx = i; break; }
    if (idx === -1) days.push(d);
    else days[idx] = d;
    days.sort(function(a, b) { return a.day - b.day; });
    for (var j = 0; j < days.length; j++) days[j].day = j + 1;
    return true;
  }
  if (op === 'dayComponents') {
    var dn = parseInt(p.day, 10);
    var idx2 = -1;
    for (var k = 0; k < days.length; k++) if (days[k].day === dn) { idx2 = k; break; }
    if (idx2 === -1 || !Array.isArray(p.components)) return false;
    var comps = [];
    for (var c = 0; c < p.components.length; c++) {
      var nc = normalizeComponent(p.components[c]);
      if (nc) comps.push(nc);
    }
    days[idx2].components = comps;
    return true;
  }
  if (op === 'deleteDay') {
    var dd = parseInt(p.day, 10);
    for (var m = 0; m < days.length; m++) {
      if (days[m].day === dd) {
        days.splice(m, 1);
        for (var r = 0; r < days.length; r++) days[r].day = r + 1;
        return true;
      }
    }
    return false;
  }
  if (op === 'moveDay') {
    var md = parseInt(p.day, 10);
    var mi = -1;
    for (var q = 0; q < days.length; q++) if (days[q].day === md) { mi = q; break; }
    if (mi === -1 || days.length < 2) return false;
    var to = parseInt(p.to, 10);
    if (isNaN(to) || to < 0) to = 0;
    if (to > days.length - 1) to = days.length - 1;
    if (mi === to) return false;
    var moved = days.splice(mi, 1)[0];
    days.splice(to, 0, moved);
    for (var w = 0; w < days.length; w++) days[w].day = w + 1;
    return true;
  }
  if (op === 'section') {
    if (!p.type) return false;
    var sec = normalizeSection({ type: p.type, data: p.data });
    if (!sec) return false;
    var found = -1;
    for (var x = 0; x < DB.plan.sections.length; x++) {
      if (DB.plan.sections[x].type === sec.type) { found = x; break; }
    }
    if (found === -1) DB.plan.sections.push(sec);
    else DB.plan.sections[found] = sec;
    return true;
  }
  if (op === 'removeSection') {
    if (!p.type) return false;
    for (var y = 0; y < DB.plan.sections.length; y++) {
      if (DB.plan.sections[y].type === String(p.type)) {
        DB.plan.sections.splice(y, 1);
        return true;
      }
    }
    return false;
  }
  if (op === 'meta') {
    var changed = false;
    if (p.title !== undefined) { DB.plan.title = String(p.title).substring(0, 140); changed = true; }
    if (p.destination !== undefined) { DB.plan.destination = String(p.destination).substring(0, 140); changed = true; }
    if (p.country !== undefined) { DB.plan.country = String(p.country).substring(0, 120); changed = true; }
    if (p.startDate !== undefined) { DB.plan.startDate = String(p.startDate).substring(0, 10); changed = true; }
    if (p.endDate !== undefined) { DB.plan.endDate = String(p.endDate).substring(0, 10); changed = true; }
    if (p.style !== undefined) {
      var st = String(p.style).toLowerCase();
      if (STYLE_OPTIONS.indexOf(st) !== -1) { DB.plan.style = st; changed = true; }
    }
    if (p.travelers && typeof p.travelers === 'object') {
      var merged = DB.plan.travelers || { type: 'solo', count: 1, names: [], notes: '' };
      if (p.travelers.type !== undefined) merged.type = String(p.travelers.type).toLowerCase();
      if (p.travelers.count !== undefined) merged.count = Math.max(1, parseInt(p.travelers.count, 10) || 1);
      if (p.travelers.notes !== undefined) merged.notes = String(p.travelers.notes).substring(0, 300);
      if (p.travelers.names !== undefined) merged.names = Array.isArray(p.travelers.names) ? p.travelers.names.map(function(n) { return String(n); }) : merged.names;
      DB.plan.travelers = merged;
      changed = true;
    }
    if (p.budget && typeof p.budget === 'object') {
      var mb = DB.plan.budget || { total: 0, currency: _p('defaultCurrency', 'USD') };
      if (p.budget.total !== undefined) mb.total = Number(p.budget.total) || 0;
      if (p.budget.currency !== undefined) mb.currency = String(p.budget.currency).substring(0, 8);
      DB.plan.budget = mb;
      changed = true;
    }
    return changed;
  }
  return false;
}

function applyAIResponse(raw) {
  _aiCallActive = false;
  _reqToken = null;
  clearAiTimeout();
  _setAiUIActive(false);
  updateConnStatus('ok');
  var parsed = parseAIResponse(raw);
  var json = parsed.json;
  var changed = false;
  var summary = '';
  var options = parsed.suggestions.slice();

  if (json) {
    if (Array.isArray(json.patches) && json.patches.length) {
      for (var i = 0; i < json.patches.length; i++) {
        if (applyPatchOp(json.patches[i])) changed = true;
      }
      summary = json.summary ? String(json.summary) : '';
    } else if (json.plan && typeof json.plan === 'object') {
      DB.plan = normalizePlan(json.plan);
      changed = true;
      summary = json.summary ? String(json.summary) : '';
    } else if (json.days || json.title || json.destination || json.sections) {
      DB.plan = normalizePlan(json);
      changed = true;
      summary = json.summary ? String(json.summary) : '';
    } else {
      summary = json.summary ? String(json.summary) : '';
    }
    var jsonSugs = parseSuggestionList(json.suggestions);
    var seenSug = {};
    for (var so = 0; so < options.length; so++) seenSug[options[so].text] = true;
    for (var s = 0; s < jsonSugs.length; s++) {
      if (!seenSug[jsonSugs[s].text]) { options.push(jsonSugs[s]); seenSug[jsonSugs[s].text] = true; }
    }
  }

  var aiText;
  if (changed) {
    if (_targetDay) clearTargetDay();
    _aiJustUpdated = true;
    _bumpVersion('minor');
    persist();
    renderPlan();
    aiText = summary || '✅ Plan updated.';
    try { tool.notify('💾 Plan saved — v' + DB.version, 'success'); } catch (e) {}
  } else if (json) {
    aiText = summary || '✅ Done.';
  } else {
    aiText = cleanProse(parsed.text) || '⚠️ The AI returned an empty response. Please try again.';
  }
  addChatMessage('ai', aiText, { options: options, planVersion: changed ? DB.version : '', isError: !json && !aiText });
  tool.resize();
}

/* ═══════════════════════════════════════════════════════════
   AI CALL FLOW (stream with single-shot fallback)
   ═══════════════════════════════════════════════════════════ */
var _aiCallActive = false;
var _reqToken = null;
var _aiTimeoutId = null;
var _thinkingMsgEl = null;
var _thinkingTimer = null;
var _streamCallback = null;
var _thinkingStartTime = 0;
var _lastTokenAt = 0;
var _batchToken = null;
var _aiEnabled = true; /* optimistic default; set in onReady from the allowAi param */

function showThinkingBubble(label) {
  hideThinkingBubble();
  var container = el('chat-messages');
  if (!container) return;
  _thinkingStartTime = Date.now();
  _lastTokenAt = 0;
  var bubble = document.createElement('div');
  bubble.className = 'chat-msg ai';
  bubble.id = 'thinking-bubble';
  bubble.innerHTML =
    '<div class="chat-avatar">✈️</div>' +
    '<div class="think-bubble">' +
      '<div class="think-header" id="think-hdr" style="cursor:pointer">' +
        '<span class="chat-thinking-dots"><span></span><span></span><span></span></span>' +
        '<span class="think-label" id="think-label">' + esc(label || 'Planning your trip…') + '</span>' +
        '<span class="think-time" id="think-time">0:00</span>' +
        '<span class="think-toggle" id="think-toggle">▶</span>' +
        '<button class="think-cancel" id="think-cancel" title="Stop generation" style="display:none">⏹ Stop</button>' +
      '</div>' +
      '<div class="think-body" id="think-body" style="display:none">' +
        '<div class="think-stream-label">Waiting for AI response…</div>' +
        '<div class="think-stream" id="think-stream"></div>' +
      '</div>' +
    '</div>';
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  _thinkingMsgEl = bubble;

  var hdr = bubble.querySelector('#think-hdr');
  var bodyEl = bubble.querySelector('#think-body');
  var toggleEl = bubble.querySelector('#think-toggle');
  hdr.onclick = function() {
    var isOpen = bodyEl.style.display !== 'none';
    bodyEl.style.display = isOpen ? 'none' : 'block';
    toggleEl.textContent = isOpen ? '▶' : '▼';
    container.scrollTop = container.scrollHeight;
  };

  var firstToken = true;
  _streamCallback = function(token) {
    if (firstToken) {
      bodyEl.style.display = 'block';
      toggleEl.textContent = '▼';
      firstToken = false;
    }
    appendStreamToken(token);
  };

  var cancelBtn = bubble.querySelector('#think-cancel');
  if (cancelBtn) {
    setTimeout(function() {
      if (_thinkingMsgEl === bubble && cancelBtn) cancelBtn.style.display = '';
    }, 5000);
    cancelBtn.onclick = function(e) {
      e.stopPropagation();
      cancelAiRequest();
    };
  }

  var dots = 0;
  _thinkingTimer = setInterval(function() {
    dots = (dots + 1) % 4;
    var lbl = bubble.querySelector('#think-label');
    var elapsed = Math.floor((Date.now() - _thinkingStartTime) / 1000);
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    var timeStr = mins + ':' + (secs < 10 ? '0' : '') + secs;
    if (lbl) {
      if (_lastTokenAt > _thinkingStartTime) {
        var idleSec = Math.floor((Date.now() - _lastTokenAt) / 1000);
        lbl.textContent = idleSec < 2 ? 'Planning…' + Array(dots + 1).join('.') : 'Planning… (last update ' + idleSec + 's ago)';
      } else if (elapsed > 45) {
        lbl.textContent = 'Building your plan… ' + timeStr + ' (long trips take longer)';
      } else if (elapsed > 15) {
        lbl.textContent = 'Building your plan… ' + timeStr;
      } else {
        lbl.textContent = (label || 'Planning your trip…') + Array(dots + 1).join('.');
      }
    }
    var timeEl = bubble.querySelector('#think-time');
    if (timeEl) timeEl.textContent = timeStr;
  }, 500);
}

function appendStreamToken(token) {
  if (!_thinkingMsgEl) return;
  var stream = _thinkingMsgEl.querySelector('#think-stream');
  if (stream) {
    var t = stream.textContent + token;
    if (t.length > 8000) t = t.slice(-8000);
    stream.textContent = t;
    stream.scrollTop = stream.scrollHeight;
    var container = el('chat-messages');
    if (container) {
      var dist = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (dist < 100) container.scrollTop = container.scrollHeight;
    }
  }
}

function hideThinkingBubble() {
  if (_thinkingTimer) { clearInterval(_thinkingTimer); _thinkingTimer = null; }
  if (_thinkingMsgEl) {
    var el2 = _thinkingMsgEl;
    el2.style.opacity = '0';
    el2.style.transition = 'opacity 0.2s';
    setTimeout(function() { if (el2.parentNode) el2.parentNode.removeChild(el2); }, 200);
    _thinkingMsgEl = null;
  }
  _streamCallback = null;
}

function _markThinkingComplete(elapsedMs) {
  if (_thinkingTimer) { clearInterval(_thinkingTimer); _thinkingTimer = null; }
  if (!_thinkingMsgEl) return;
  var bubble = _thinkingMsgEl;
  var label = bubble.querySelector('#think-label');
  var dots = bubble.querySelector('.chat-thinking-dots');
  var cancel = bubble.querySelector('#think-cancel');
  if (label) label.textContent = '✓ Complete in ' + (elapsedMs / 1000).toFixed(1) + 's';
  if (dots) dots.style.display = 'none';
  if (cancel) cancel.style.display = 'none';
  var secs = Math.floor(elapsedMs / 1000);
  var mins = Math.floor(secs / 60);
  var timeEl = bubble.querySelector('#think-time');
  if (timeEl) timeEl.textContent = mins + ':' + (secs % 60 < 10 ? '0' : '') + (secs % 60);
  setTimeout(function() {
    if (bubble && bubble.parentNode) {
      bubble.style.opacity = '0';
      bubble.style.transition = 'opacity 0.5s';
      setTimeout(function() { if (bubble.parentNode) bubble.parentNode.removeChild(bubble); }, 500);
    }
  }, 3000);
}

function updateConnStatus(state) {
  var dot = el('chat-conn-status');
  if (!dot) return;
  dot.className = 'chat-status-dot' + (state === 'ok' ? ' ok' : state === 'busy' ? ' busy' : state === 'error' ? ' error' : '');
}

function _setAiUIActive(active) {
  var send = el('btn-chat-send');
  if (send) { send.disabled = active; send.style.opacity = active ? '0.4' : ''; }
  var stop = el('btn-chat-stop');
  if (stop) stop.style.display = active ? '' : 'none';
  var input = el('chat-input');
  if (input) { input.disabled = active; input.style.opacity = active ? '0.5' : ''; }
}

/* ── AI request timeouts ──────────────────────────────────────
   The CMS gateway enforces its own hard limits (120 s per request,
   1 concurrent batch request with others queued) and ALWAYS invokes
   the callback — success, truncation warning or error. So the client
   must NOT race the gateway with a short timer (the old 135 s timer
   killed healthy requests that were queued or slow to start). These
   guards only catch a completely dead relay:
     • stream: no token/error/completion within AI_STREAM_SILENT_MS
               (30 s — a healthy gateway sends the first token in
               seconds) → silently switch to the batch channel
     • batch:  no callback within AI_BATCH_WATCHDOG_MS (10 min, long
               enough for queued requests) → give up with guidance.
               We do NOT auto-retry: extra requests just pile up
               behind the same stuck queue and make the wait worse.
   ─────────────────────────────────────────────────────────── */
var AI_STREAM_SILENT_MS = 30000;
var AI_BATCH_WATCHDOG_MS = 600000;

function setAiTimeout(promptLen, onFire) {
  clearAiTimeout();
  _aiTimeoutId = setTimeout(function() {
    _aiTimeoutId = null;
    if (onFire) onFire();
  }, AI_BATCH_WATCHDOG_MS);
}

function clearAiTimeout() {
  if (_aiTimeoutId) { clearTimeout(_aiTimeoutId); _aiTimeoutId = null; }
}

function cancelAiRequest() {
  if (_reqToken) _reqToken.cancelled = true;
  _aiCallActive = false;
  clearAiTimeout();
  hideThinkingBubble();
  _setAiUIActive(false);
  updateConnStatus('ok');
  addChatMessage('ai', '⏹ **Generation stopped.** You can send another message to continue.');
  tool.resize();
}

function sendChatMessage() {
  var input = el('chat-input');
  if (!input) return;
  if (_aiCallActive) {
    try { tool.notify('The AI is still planning. Wait or press Stop.', 'warning'); } catch (e) {}
    return;
  }
  if (!canWrite()) {
    try { tool.notify('This tool is in read-only mode — AI edits are disabled.', 'warning'); } catch (e) {}
    return;
  }
  if (!_aiEnabled) {
    addChatMessage('ai', '⚠️ **AI is disabled for this tool.** Add "allowAi": "yes" to the toolParams in the CMS field settings and reload — until then the planner cannot reach the AI gateway.', { isError: true });
    try { tool.notify('AI disabled — set allowAi: "yes" in the field settings.', 'warning'); } catch (e) {}
    return;
  }
  var msg = input.value.trim();
  if (!msg) return;

  var tok = { cancelled: false };
  _reqToken = tok;

  addChatMessage('user', msg);
  input.value = '';
  input.style.height = 'auto';

  if (!DB.activeSessionId && _sessionsLoaded) {
    createSession(function(newSession) {
      if (newSession) {
        DB.activeSessionId = newSession.id;
        persist();
        renderSessionList();
      }
    });
  }
  _generateSingle(msg, tok);
}

function _generateSingle(msg, tok) {
  var prompt = buildChatPrompt(msg);
  updateConnStatus('busy');
  _aiCallActive = true;
  _setAiUIActive(true);

  var useStream = typeof tool.requestAIStream === 'function';
  if (useStream) {
    showThinkingBubble('✈️ Planning your trip…');
    var fullResponse = '';
    var streamStart = Date.now();
    var streamSettled = false;
    var firstTokenLogged = false;

    /* The CMS gateway always fires onComplete/onError (its own limit is
       120 s), so this watchdog only triggers when the stream relay is
       completely unresponsive. Instead of failing the user we silently
       switch to the reliable batch channel. */
    var watchdogId = setTimeout(function() {
      if (streamSettled || tok.cancelled) return;
      console.warn('[TRAVELPLANNER:STREAM] silent for ' + AI_STREAM_SILENT_MS + ' ms — falling back to batch AI');
      streamSettled = true;
      tok.cancelled = true; /* ignore any late stream callbacks */
      _reqToken = null;
      clearAiTimeout();
      hideThinkingBubble();
      _aiCallActive = false;
      _callAiBatch(msg, { cancelled: false }, prompt);
    }, AI_STREAM_SILENT_MS);

    function finishStream(fullText) {
      streamSettled = true;
      clearTimeout(watchdogId);
      if (tok.cancelled) { _reqToken = null; return; }
      _reqToken = null;
      clearAiTimeout();
      _markThinkingComplete(Date.now() - streamStart);
      var complete = (fullText && String(fullText).trim().length > 5) ? String(fullText) : fullResponse;
      console.log('[TRAVELPLANNER:AI] stream complete after ' + ((Date.now() - streamStart) / 1000).toFixed(1) + 's — ' + (complete ? complete.length : 0) + ' chars');
      if (complete && complete.trim() && complete.length > 5) {
        applyAIResponse(complete);
      } else {
        _aiCallActive = false;
        _setAiUIActive(false);
        updateConnStatus('error');
        addChatMessage('ai', '⚠️ **The AI stream returned empty.** Try again, or ask your CMS admin to check the AI gateway (allowAi: yes).', { isError: true });
        tool.resize();
      }
    }

    try {
      console.log('[TRAVELPLANNER:AI] requestAIStream sent — ' + prompt.length + ' chars');
      tool.requestAIStream(prompt, '', {
        onToken: function(token) {
          if (tok.cancelled) return;
          if (!firstTokenLogged) {
            firstTokenLogged = true;
            console.log('[TRAVELPLANNER:AI] stream first token after ' + ((Date.now() - streamStart) / 1000).toFixed(1) + 's');
          }
          clearTimeout(watchdogId); /* first token proves the relay is alive */
          _lastTokenAt = Date.now();
          fullResponse += token;
          if (_streamCallback) _streamCallback(token);
        },
        onComplete: function(fullText) { finishStream(fullText); },
        onError: function(err) {
          console.warn('[TRAVELPLANNER:AI] stream error: ' + (err || 'unknown'));
          streamSettled = true;
          clearTimeout(watchdogId);
          if (tok.cancelled) { _reqToken = null; return; }
          _reqToken = null;
          if (fullResponse && fullResponse.trim().length > 5) {
            clearAiTimeout();
            _markThinkingComplete(Date.now() - streamStart);
            applyAIResponse(fullResponse);
            return;
          }
          /* Stream failed before any token — fall back to single-shot. */
          _aiCallActive = false;
          clearAiTimeout();
          hideThinkingBubble();
          tok.cancelled = true;
          _callAiBatch(msg, { cancelled: false }, prompt);
        }
      });
    } catch (e) {
      console.warn('[TRAVELPLANNER:AI] stream call threw: ' + (e && e.message ? e.message : e));
      streamSettled = true;
      clearTimeout(watchdogId);
      _aiCallActive = false;
      _reqToken = null;
      clearAiTimeout();
      hideThinkingBubble();
      tok.cancelled = true;
      _callAiBatch(msg, { cancelled: false }, prompt);
    }
  } else {
    _callAiBatch(msg, tok, prompt);
  }
}

function _callAiBatch(msg, tok, prompt) {
  updateConnStatus('busy');
  _aiCallActive = true;
  _setAiUIActive(true);
  showThinkingBubble('✈️ Planning your trip…');
  _batchToken = tok; /* only the newest batch call may apply a response */
  var batchStart = Date.now();
  var settled = false;

  function finish(err, response) {
    if (settled) return;
    settled = true;
    if (_batchToken !== tok) return; /* superseded by a newer call */
    if (tok.cancelled) { _reqToken = null; return; }
    _reqToken = null;
    clearAiTimeout();
    _markThinkingComplete(Date.now() - batchStart);
    console.log('[TRAVELPLANNER:AI] batch callback after ' + ((Date.now() - batchStart) / 1000).toFixed(1) + 's — err=' + (err ? String(err) : 'none') + ', response ' + (response ? String(response).length : 0) + ' chars');
    if (response && response.trim() && response.length > 5) {
      applyAIResponse(response);
    } else if (err) {
      _aiCallActive = false;
      updateConnStatus('error');
      _setAiUIActive(false);
      addChatMessage('ai', '⚠️ **AI Error:** ' + esc(err), { isError: true });
    } else {
      _aiCallActive = false;
      updateConnStatus('error');
      _setAiUIActive(false);
      addChatMessage('ai', '⚠️ **No AI response received.** Check that the CMS AI service is configured (allowAi: yes).', { isError: true });
    }
    tool.resize();
  }

  try {
    console.log('[TRAVELPLANNER:AI] requestAI sent — ' + prompt.length + ' chars');
    tool.requestAI(prompt, '', finish);
  } catch (e) {
    finish(e.message || 'Unknown error', null);
  }

  /* Dead-relay guard only. The gateway enforces the 120 s limit and
     always calls back (success, truncation warning or error), and queued
     requests may wait behind other tools — so 10 minutes of silence means
     the relay is broken for this tool (most often: allowAi not enabled in
     the field settings). Do NOT auto-retry: extra requests just pile up
     behind the same stuck queue. */
  setAiTimeout(prompt.length, function() {
    if (settled) return;
    settled = true;
    console.warn('[TRAVELPLANNER:TIMEOUT] batch AI got no callback (prompt ' + prompt.length + ' chars)');
    _aiCallActive = false;
    hideThinkingBubble();
    _setAiUIActive(false);
    addChatMessage('ai', '⏰ **The AI service did not respond within 10 minutes.** The gateway handles only 1 request at a time and queues the rest — but a wait this long usually means AI is not enabled for this tool. Verify "allowAi": "yes" in the field settings, check the console for [TRAVELPLANNER:AI] logs, then press Send to try again.', { isError: true });
    updateConnStatus('error');
    tool.resize();
  });
}

/* ═══════════════════════════════════════════════════════════
   SESSION CRUD (ai-chat-sessions-uniconbaseapps)
   ═══════════════════════════════════════════════════════════ */
var SESSION_TYPE = 'ai-chat-sessions-uniconbaseapps';
var CHAT_CACHE_MAX = 20;
var CHAT_CACHE_TEXT_MAX = 2000;
var _sessions = [];
var _sessionsLoaded = false;
var _sessionWarnShown = false;

function _resolveInstanceId() {
  if (DB._instanceId) return DB._instanceId;
  var parentId = DB._parentRecordId || '';
  if (!parentId) {
    try {
      var m = (window.location.search || '').match(/[?&](?:objectId|recordId|id)=([^&?#]+)/);
      if (m) parentId = decodeURIComponent(m[1]);
    } catch (e) {}
  }
  if (!parentId) {
    try {
      var f = tool.getFields();
      if (f && (f._id || f.id)) parentId = String(f._id || f.id);
    } catch (e) {}
  }
  if (!parentId) { try { var p1 = tool.param('objectId', ''); if (p1) parentId = String(p1); } catch (e) {} }
  if (!parentId) { try { var p2 = tool.param('recordId', ''); if (p2) parentId = String(p2); } catch (e) {} }
  DB._instanceId = parentId ? ('rec_' + parentId) : 'inst_unknown';
  try { persist(); } catch (e) {}
  return DB._instanceId;
}

function _toolInstanceId() {
  var myId = _resolveInstanceId();
  var parentId = (myId && myId.indexOf('rec_') === 0) ? myId.substring(4) : (DB._parentRecordId || 'unknown');
  return 'travel_' + parentId;
}

function _warnSessionStorage(msg) {
  if (_sessionWarnShown) return;
  _sessionWarnShown = true;
  console.warn('[TRAVELPLANNER:SESSION] ' + msg);
  try {
    tool.notify('⚠ Chat history storage unavailable — messages are cached inside the record until it is fixed. Check allowObjectCRUD: yes and the ai-chat-sessions-uniconbaseapps type in field settings.', 'warning');
  } catch (e) {}
}

function loadSessions(callback) {
  try {
    tool.requestObjects('query', { mainObjectType: SESSION_TYPE }, function(err, result) {
      if (err) { _warnSessionStorage('Query error: ' + err); _sessions = []; }
      else {
        var all = (result && result.objects) ? result.objects : [];
        var myId = _toolInstanceId();
        var myRec = _resolveInstanceId();
        _sessions = [];
        for (var i = 0; i < all.length; i++) {
          var obj = all[i];
          var pd = obj.productData || {};
          var dcb = pd.data_categoriesBased || {};
          if (dcb._toolInstanceId === myId ||
              (myId !== 'travel_unknown' && dcb._toolInstanceId && String(dcb._toolInstanceId).indexOf(myId) === 0)) {
            _sessions.push(obj);
          } else if (!dcb._toolInstanceId && obj._parentObjectId && DB._parentRecordId && obj._parentObjectId === DB._parentRecordId) {
            _sessions.push(obj);
            tool.requestObjects('update', {
              mainObjectType: SESSION_TYPE,
              objectId: obj.id,
              productData: { data_categoriesBased: { _toolInstanceId: myId } }
            }, function() {});
          } else if (!dcb._toolInstanceId && obj._parentObjectId && myRec !== 'inst_unknown') {
            /* adopt legacy sessions for this record */
            _sessions.push(obj);
            tool.requestObjects('update', {
              mainObjectType: SESSION_TYPE,
              objectId: obj.id,
              productData: { data_categoriesBased: { _toolInstanceId: myId } }
            }, function() {});
          }
        }
      }
      _sessionsLoaded = true;
      if (callback) callback(_sessions);
    });
  } catch (e) {
    _warnSessionStorage('query threw: ' + e.message);
    _sessions = [];
    _sessionsLoaded = true;
    if (callback) callback([]);
  }
}

function createSession(callback) {
  var user = getUserSafe() || {};
  try {
    tool.requestObjects('create', {
      mainObjectType: SESSION_TYPE,
      name: 'New Chat',
      productData: {
        data_categoriesBased: {
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: { userId: user.id || 'anon', userName: user.name || 'Anonymous' },
          _toolInstanceId: _toolInstanceId()
        }
      }
    }, function(err, result) {
      if (err) { _warnSessionStorage('create error: ' + err); if (callback) callback(null); return; }
      var session = result.object;
      if (session._parentObjectId && !DB._parentRecordId) DB._parentRecordId = session._parentObjectId;
      _sessions.unshift(session);
      if (callback) callback(session);
    });
  } catch (e) {
    _warnSessionStorage('create threw: ' + e.message);
    if (callback) callback(null);
  }
}

function saveCurrentSession(callback) {
  if (!DB.activeSessionId) { if (callback) callback(null); return; }
  try {
    var session = null;
    for (var si = 0; si < _sessions.length; si++) {
      if (_sessions[si].id === DB.activeSessionId) { session = _sessions[si]; break; }
    }
    var oldDcb = (session && session.productData && session.productData.data_categoriesBased) ? session.productData.data_categoriesBased : {};
    var dcb = {};
    for (var k in oldDcb) {
      if (Object.prototype.hasOwnProperty.call(oldDcb, k)) dcb[k] = oldDcb[k];
    }
    dcb.messages = DB.chatMessages || [];
    dcb.updatedAt = new Date().toISOString();
    tool.requestObjects('update', {
      mainObjectType: SESSION_TYPE,
      objectId: DB.activeSessionId,
      productData: { data_categoriesBased: dcb }
    }, function(err) {
      if (err) _warnSessionStorage('save error: ' + err);
      if (callback) callback(err ? null : true);
    });
  } catch (e) {
    _warnSessionStorage('save threw: ' + e.message);
    if (callback) callback(null);
  }
}

function deleteSession(sessionId, callback) {
  try {
    tool.requestObjects('delete', { mainObjectType: SESSION_TYPE, objectId: sessionId }, function(err) {
      if (err) { if (callback) callback(false); return; }
      for (var i = 0; i < _sessions.length; i++) {
        if (_sessions[i].id === sessionId) { _sessions.splice(i, 1); break; }
      }
      if (callback) callback(true);
    });
  } catch (e) {
    if (callback) callback(false);
  }
}

function restoreActiveSession() {
  /* On reload DB.activeSessionId is already set from the saved value, so
     switchSession() would early-return and skip loading server messages. */
  var session = null;
  for (var i = 0; i < _sessions.length; i++) {
    if (_sessions[i].id === DB.activeSessionId) { session = _sessions[i]; break; }
  }
  if (session) {
    var pd = session.productData || {};
    var dcb = pd.data_categoriesBased || {};
    var msgs = (dcb.messages && dcb.messages.length) ? dcb.messages : null;
    if (msgs) {
      DB.chatMessages = msgs;
    } else if (DB.chatCache && DB.chatCache.sessionId === DB.activeSessionId && DB.chatCache.messages && DB.chatCache.messages.length) {
      DB.chatMessages = DB.chatCache.messages.slice();
      saveCurrentSession();
    } else {
      DB.chatMessages = [];
    }
  } else if (!(DB.chatCache && DB.chatCache.sessionId === DB.activeSessionId && DB.chatCache.messages && DB.chatCache.messages.length)) {
    DB.chatMessages = [];
  }
  persist();
  renderChatMessages();
  renderSessionList();
  switchChatTab('chat');
}

function switchSession(sessionId) {
  if (sessionId === DB.activeSessionId) return;
  if (DB.activeSessionId) saveCurrentSession();
  DB.activeSessionId = sessionId;
  var session = null;
  for (var i = 0; i < _sessions.length; i++) {
    if (_sessions[i].id === sessionId) { session = _sessions[i]; break; }
  }
  if (session) {
    var pd = session.productData || {};
    var dcb = pd.data_categoriesBased || {};
    var msgs = (dcb.messages && dcb.messages.length) ? dcb.messages : null;
    if (msgs) {
      DB.chatMessages = msgs;
    } else if (DB.chatCache && DB.chatCache.sessionId === sessionId && DB.chatCache.messages && DB.chatCache.messages.length) {
      DB.chatMessages = DB.chatCache.messages.slice();
      saveCurrentSession();
    } else {
      DB.chatMessages = [];
    }
  } else {
    DB.chatMessages = [];
    if (DB.chatCache && DB.chatCache.sessionId === sessionId && DB.chatCache.messages && DB.chatCache.messages.length) {
      DB.chatMessages = DB.chatCache.messages.slice();
    }
  }
  /* Persist AFTER loading the session's messages so saveCurrentSession()
     cannot clobber the transcript with a stale in-memory copy. */
  persist();
  renderChatMessages();
  renderSessionList();
  switchChatTab('chat');
}

function autoTitleSession() {
  if (!DB.activeSessionId) return;
  var session = null;
  for (var i = 0; i < _sessions.length; i++) {
    if (_sessions[i].id === DB.activeSessionId) { session = _sessions[i]; break; }
  }
  if (!session) return;
  var curName = session.name || '';
  if (curName && curName !== 'New Chat') return;
  var bestTitle = '';
  if (DB.plan.title && DB.plan.title.length > 1) bestTitle = DB.plan.title.substring(0, 60);
  if (!bestTitle) {
    var messages = DB.chatMessages || [];
    for (var j = 0; j < messages.length; j++) {
      if (messages[j].role === 'user' && messages[j].text) {
        var txt = messages[j].text.replace(/\n/g, ' ').trim();
        if (txt.length > 15) { bestTitle = txt.substring(0, 60); break; }
      }
    }
  }
  if (!bestTitle) return;
  if (bestTitle.length >= 60) bestTitle += '…';
  try {
    tool.requestObjects('update', { mainObjectType: SESSION_TYPE, objectId: DB.activeSessionId, name: bestTitle }, function() {});
  } catch (e) {}
  session.name = bestTitle;
  renderSessionList();
}

function formatTimeAgo(isoTime) {
  if (!isoTime) return '';
  var then;
  try { then = new Date(isoTime).getTime(); } catch (e) { return ''; }
  var diff = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  try { return new Date(isoTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch (e) { return ''; }
}

function renderSessionList() {
  var list = el('session-list');
  if (!list) return;
  if (!_sessions || !_sessions.length) {
    list.innerHTML = '<div class="session-empty">No chats yet.<br>Send a message to start.</div>';
    return;
  }
  var sorted = _sessions.slice().sort(function(a, b) {
    var ta = ((a.productData && a.productData.data_categoriesBased) || {}).updatedAt || a.updated || '';
    var tb = ((b.productData && b.productData.data_categoriesBased) || {}).updatedAt || b.updated || '';
    return tb > ta ? 1 : (tb < ta ? -1 : 0);
  });
  var h = '';
  for (var i = 0; i < sorted.length; i++) {
    var s = sorted[i];
    var name = s.name || 'New Chat';
    var timeAgo = formatTimeAgo(((s.productData && s.productData.data_categoriesBased) || {}).updatedAt || s.updated || '');
    var isActive = s.id === DB.activeSessionId;
    h += '<div class="session-item' + (isActive ? ' session-active' : '') + '" data-sid="' + esc(s.id) + '">' +
      '<span class="session-dot">' + (isActive ? '●' : '○') + '</span>' +
      '<div class="session-info"><div class="session-name" data-sid="' + esc(s.id) + '" title="Double-click to rename">' + esc(name) + '</div>' +
      '<div class="session-time">' + timeAgo + '</div></div>' +
      '<button class="session-rename" data-sid="' + esc(s.id) + '" title="Rename chat">✎</button>' +
      '<button class="session-delete" data-sid="' + esc(s.id) + '" title="Delete chat">✕</button></div>';
  }
  list.innerHTML = h;
  var items = list.querySelectorAll('.session-item');
  for (var j = 0; j < items.length; j++) {
    items[j].onclick = function() { switchSession(this.getAttribute('data-sid')); };
    var delBtn = items[j].querySelector('.session-delete');
    if (delBtn) {
      delBtn.onclick = function(e) {
        e.stopPropagation();
        var sid = this.getAttribute('data-sid');
        if (sid) {
          deleteSession(sid, function(ok) {
            if (ok) {
              if (DB.activeSessionId === sid) {
                DB.activeSessionId = '';
                DB.chatMessages = [];
                persist();
                renderChatMessages();
              }
              renderSessionList();
            }
          });
        }
      };
    }
    var renameBtn = items[j].querySelector('.session-rename');
    if (renameBtn) {
      renameBtn.onclick = function(e) {
        e.stopPropagation();
        startRenameSession(this.getAttribute('data-sid'));
      };
    }
    var nameEl = items[j].querySelector('.session-name');
    if (nameEl) {
      nameEl.ondblclick = function(e) {
        e.stopPropagation();
        startRenameSession(this.getAttribute('data-sid'));
      };
    }
  }
}

function startRenameSession(sessionId) {
  var list = el('session-list');
  if (!list) return;
  var nameEl = list.querySelector('.session-name[data-sid="' + sessionId + '"]');
  if (!nameEl) return;
  var session = null;
  for (var i = 0; i < _sessions.length; i++) {
    if (_sessions[i].id === sessionId) { session = _sessions[i]; break; }
  }
  if (!session) return;
  var currentName = session.name || 'New Chat';
  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'session-name-input';
  input.value = currentName;
  nameEl.parentNode.replaceChild(input, nameEl);
  input.focus();
  input.select();
  var saveRename = function() {
    var newName = input.value.trim();
    if (!newName) newName = 'New Chat';
    if (newName.length > 80) newName = newName.substring(0, 80);
    try {
      tool.requestObjects('update', { mainObjectType: SESSION_TYPE, objectId: sessionId, name: newName }, function() {
        for (var i = 0; i < _sessions.length; i++) {
          if (_sessions[i].id === sessionId) { _sessions[i].name = newName; break; }
        }
        renderSessionList();
      });
    } catch (e) {}
  };
  input.onblur = saveRename;
  input.onkeydown = function(e) {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = currentName; input.blur(); }
  };
}

/* ═══════════════════════════════════════════════════════════
   USER (safe getters — identity may arrive late)
   ═══════════════════════════════════════════════════════════ */
var _user = null;
function getUserSafe() {
  try {
    var u = tool.getUser();
    if (u) { _user = u; return u; }
    return _user;
  } catch (e) { return _user; }
}
function refreshUser() {
  var delays = [400, 1200, 2600, 5000];
  var i = 0;
  (function poll() {
    var u = getUserSafe();
    if (u && u.roles && u.roles.length) return;
    if (i < delays.length) {
      setTimeout(function() { i++; poll(); }, delays[i] || 5000);
    }
  })();
}
function getRoles() {
  var u = getUserSafe();
  if (!u) return [];
  if (u.roles && u.roles.length) return u.roles;
  try {
    var out = [];
    var ea = u.effectiveAccess || {};
    if (ea.isManager) out.push('admin');
    if (ea.isEditor) out.push('editor');
    if (ea.isViewer) out.push('viewer');
    return out;
  } catch (e) { return []; }
}
function canWrite() {
  try { return !tool.isReadOnly(); } catch (e) { return true; }
}

/* ═══════════════════════════════════════════════════════════
   CHAT MESSAGES UI
   ═══════════════════════════════════════════════════════════ */
function shortTime(iso) {
  try {
    var d = new Date(iso);
    var h = d.getHours(), m = d.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  } catch (e) { return ''; }
}

function markdownLite(text) {
  var t = esc(text || '');
  t = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/^\s*[-*] (.+)$/gm, '• $1');
  t = t.replace(/\n/g, '<br>');
  return t;
}

var WELCOME_HTML =
  '<div class="chat-welcome">' +
    '<div class="chat-welcome-icon">✈️</div>' +
    '<h3>Where are we going?</h3>' +
    '<p>Tell me about your trip — <b>destination, dates, who\'s traveling, budget and style</b> — and I\'ll plan it day by day: stays, transport, activities, meals, packing list, budget and more.</p>' +
    '<div class="welcome-hints">' +
      '<button class="hint-chip" data-hint="Plan a 7-day family trip to Istanbul for 4 (kids 6 and 9), mid budget, with kid-friendly activities and a Bosphorus boat day.">👨‍👩‍👧‍👦 Family city trip</button>' +
      '<button class="hint-chip" data-hint="3-day solo city break in Paris, foodie style, hotel near Le Marais, one full day for museums and one for walking neighborhoods.">🎒 Solo city break</button>' +
      '<button class="hint-chip" data-hint="5-day friends roadtrip along the California coast from Los Angeles to San Francisco, surf stops, coastal hikes and local food.">🚗 Friends roadtrip</button>' +
      '<button class="hint-chip" data-hint="10-day Japan trip for 2 with a rail pass: Tokyo, Kyoto and Osaka, budget style, temples, street food and day trips.">🗾 Couple adventure</button>' +
    '</div>' +
    '<p style="font-size:10px;color:#94a3b8;margin-top:12px">💡 <b>Tip:</b> After the plan is built you can say <b>"add a beach day"</b>, <b>"change day 2 to more museums"</b>, <b>"make it cheaper"</b> or <b>"add a packing list"</b> — I\'ll only change what you asked.</p>' +
  '</div>';

function _trimChatCache(list) {
  var out = [];
  var msgs = (list && list.messages) ? list.messages : (list || []);
  var src = (msgs && msgs.slice) ? msgs.slice(-CHAT_CACHE_MAX) : [];
  for (var i = 0; i < src.length; i++) {
    var m = src[i];
    if (!m || typeof m !== 'object') continue;
    var copy = { role: m.role, text: String(m.text || '').substring(0, CHAT_CACHE_TEXT_MAX), time: m.time };
    if (m.isError) copy.isError = true;
    if (m.planVersion) copy.planVersion = m.planVersion;
    if (m.options && m.options.length) copy.options = m.options.slice(0, 6);
    out.push(copy);
  }
  return out;
}

function addChatMessage(role, text, extra) {
  var user = getUserSafe() || {};
  var msg = {
    role: role,
    text: text || '',
    time: new Date().toISOString(),
    userId: role === 'user' ? (user.id || 'anon') : 'ai',
    userName: role === 'user' ? (user.name || 'Anonymous') : 'AI Assistant'
  };
  if (extra && extra.options && extra.options.length) msg.options = extra.options.slice(0, 6);
  if (extra && extra.planVersion) msg.planVersion = extra.planVersion;
  if (extra && extra.isError) msg.isError = true;
  DB.chatMessages.push(msg);
  if (DB.chatMessages.length > 500) DB.chatMessages = DB.chatMessages.slice(-500);
  DB.chatCache = { sessionId: DB.activeSessionId, messages: _trimChatCache(DB.chatMessages) };
  renderChatMessages();
  updateChatBadge();
  if (DB.activeSessionId) {
    saveCurrentSession();
    renderSessionList();
    if (role === 'user') {
      var userMsgCount = 0;
      for (var mi = 0; mi < DB.chatMessages.length; mi++) {
        if (DB.chatMessages[mi].role === 'user') userMsgCount++;
      }
      if (userMsgCount === 1 || userMsgCount % 3 === 0) autoTitleSession();
    } else if (!(extra && extra.isError)) {
      autoTitleSession();
    }
    _stageValue();
  } else {
    try { persist(); } catch (e) {}
  }
}

function renderChatMessages() {
  var container = el('chat-messages');
  if (!container) return;
  if (!DB.chatMessages || !DB.chatMessages.length) {
    container.innerHTML = WELCOME_HTML;
    return;
  }
  var h = '';
  for (var i = 0; i < DB.chatMessages.length; i++) {
    var m = DB.chatMessages[i];
    var isUser = m.role === 'user';
    var avatar = isUser ? '🧑' : '✈️';
    var optsHtml = '';
    if (m.options && m.options.length) {
      optsHtml += '<div class="msg-options">';
      for (var o = 0; o < m.options.length; o++) {
        optsHtml += '<button class="msg-option" data-option="' + esc(m.options[o].text) + '">' + esc(m.options[o].text) + '</button>';
      }
      optsHtml += '</div>';
    }
    var extraHtml = '';
    if (m.planVersion) extraHtml += '<div class="msg-version-chip">Plan saved as v' + esc(m.planVersion) + '</div>';
    if (m.isError) extraHtml += '<div class="msg-error-chip">⚠ This message may contain errors</div>';
    h += '<div class="chat-msg ' + (isUser ? 'user' : 'ai') + '">' +
      '<div class="chat-avatar">' + avatar + '</div>' +
      '<div>' +
        '<div class="chat-bubble">' + markdownLite(m.text) + optsHtml + extraHtml + '</div>' +
        '<div class="chat-time">' + shortTime(m.time) + '</div>' +
      '</div>' +
    '</div>';
  }
  container.innerHTML = h;
  container.scrollTop = container.scrollHeight;
}

function updateChatBadge() {
  var badge = el('chat-msg-count');
  if (badge) badge.textContent = DB.chatMessages.length;
}

/* ═══════════════════════════════════════════════════════════
   TARGET DAY + MANUAL DAY OPS
   ═══════════════════════════════════════════════════════════ */
var _targetDay = 0;

function setTargetDay(day) {
  _targetDay = day;
  updateTargetChip();
  renderItinerary();
  try { tool.notify('🎯 Day ' + day + ' targeted — the next AI message edits only this day.', 'info'); } catch (e) {}
}
function clearTargetDay() {
  _targetDay = 0;
  updateTargetChip();
  renderItinerary();
}
function updateTargetChip() {
  var chipEl = el('chat-target-chip');
  var label = el('chat-target-label');
  if (!chipEl) return;
  if (_targetDay) {
    chipEl.style.display = '';
    if (label) label.textContent = 'Day ' + _targetDay + ' — the next AI message edits only this day';
  } else {
    chipEl.style.display = 'none';
  }
}

function moveDay(day, dir) {
  if (!canWrite()) return;
  var days = DB.plan.days;
  var idx = -1;
  for (var i = 0; i < days.length; i++) if (days[i].day === day) { idx = i; break; }
  var to = idx + dir;
  if (idx === -1 || to < 0 || to >= days.length) return;
  var tmp = days[idx];
  days[idx] = days[to];
  days[to] = tmp;
  for (var j = 0; j < days.length; j++) days[j].day = j + 1;
  persist();
  renderItinerary();
}

function deleteDayConfirm(day) {
  if (!canWrite()) return;
  showConfirm('Delete day ' + day + '? This removes it from the plan. You can also ask the AI to restore it.', function() {
    var days = DB.plan.days;
    for (var i = 0; i < days.length; i++) {
      if (days[i].day === day) {
        days.splice(i, 1);
        for (var j = 0; j < days.length; j++) days[j].day = j + 1;
        persist();
        renderPlan();
        break;
      }
    }
  });
}

function addBlankDay() {
  if (!canWrite()) return;
  var days = DB.plan.days;
  var next = days.length + 1;
  var lastDate = days.length ? days[days.length - 1].date : '';
  days.push({ day: next, date: lastDate, title: 'Free day', components: [{ type: 'freeTime', data: { title: 'Free time', suggestions: [] } }] });
  persist();
  renderPlan();
}

/* ═══════════════════════════════════════════════════════════
   CONFIRM DIALOG
   ═══════════════════════════════════════════════════════════ */
var _confirmCb = null;
function showConfirm(message, cb) {
  _confirmCb = cb;
  var overlay = el('confirm-overlay');
  var msgEl = el('confirm-message');
  if (!overlay) { if (cb) cb(); return; }
  if (msgEl) msgEl.textContent = message;
  overlay.style.display = 'flex';
}
function hideConfirm() {
  _confirmCb = null;
  var overlay = el('confirm-overlay');
  if (overlay) overlay.style.display = 'none';
}

/* ═══════════════════════════════════════════════════════════
   EXPORT / IMPORT
   ═══════════════════════════════════════════════════════════ */
function planJson() { return JSON.stringify(DB.plan, null, 2); }

function updateExportInfo(html, ok) {
  var info = el('export-info');
  if (info) {
    var stats = '<b>' + (DB.plan.days || []).length + ' days</b> · <b>' + (DB.plan.sections || []).length + ' sections</b> · JSON size ' +
      Math.max(1, Math.round(planJson().length / 1024)) + ' KB';
    info.innerHTML = (html ? '<div class="' + (ok ? 'ok-line' : 'warn-line') + '">' + html + '</div>' : '') + '<div style="margin-top:6px">' + stats + '</div>';
  }
}

function copyPlanJson() {
  var json = planJson();
  copyText(json);
  updateExportInfo('Plan JSON copied to clipboard.', true);
}

function downloadPlanJson() {
  try {
    var blob = new Blob([planJson()], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = slugify(DB.plan.title) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 4000);
    updateExportInfo('Downloading ' + a.download + ' …', true);
  } catch (e) {
    updateExportInfo('Download failed: ' + esc(e.message), false);
  }
}

function copyTextItinerary() {
  var text = buildPlanText();
  copyText(text);
  updateExportInfo('Text itinerary copied to clipboard.', true);
}

function buildPlanText() {
  var p = DB.plan;
  var lines = [];
  lines.push((p.title || 'Travel Plan').toUpperCase());
  lines.push('');
  if (p.destination) lines.push('Destination: ' + p.destination + (p.country ? ', ' + p.country : ''));
  if (p.startDate || p.endDate) lines.push('Dates: ' + (p.startDate || '?') + ' → ' + (p.endDate || '?'));
  lines.push('Travelers: ' + (p.travelers.type || 'solo') + ' × ' + (p.travelers.count || 1) + (p.travelers.notes ? ' (' + p.travelers.notes + ')' : ''));
  lines.push('Budget: ' + fmtMoney(p.budget.total, p.budget.currency));
  lines.push('Style: ' + (p.style || 'mixed'));
  lines.push('');
  var days = sortedDays();
  for (var i = 0; i < days.length; i++) {
    var d = days[i];
    lines.push('DAY ' + d.day + (d.title ? ' — ' + d.title : '') + (d.date ? ' (' + d.date + ')' : ''));
    for (var j = 0; j < d.components.length; j++) {
      var c = d.components[j];
      var comp = DAY_COMPONENTS[c.type];
      var dd = c.data || {};
      var icon = comp ? comp.icon : '•';
      var label;
      if (c.type === 'transport') label = [dd.from, dd.to].filter(Boolean).join(' → ') + (dd.departure ? ' at ' + dd.departure : '');
      else if (c.type === 'stay') label = dd.name + (dd.checkIn ? ' (in ' + dd.checkIn + ')' : '');
      else if (c.type === 'meal') label = (dd.meal ? dd.meal + ': ' : '') + (dd.name || dd.place || '');
      else if (c.type === 'alert') label = (dd.level ? dd.level.toUpperCase() + ': ' : '') + (dd.text || '');
      else if (c.type === 'freeTime') label = dd.title || 'Free time';
      else if (c.type === 'note') label = (dd.title ? dd.title + ': ' : '') + (dd.text || '');
      else label = dd.title || dd.name || c.type;
      var time = dd.time || dd.departure || '';
      lines.push('  ' + (time ? time + '  ' : '') + icon + ' ' + String(label || '').replace(/\n/g, ' ').substring(0, 140));
      if (dd.description && c.type !== 'note' && c.type !== 'alert') lines.push('       ' + String(dd.description).replace(/\n/g, ' ').substring(0, 200));
      if (dd.location) lines.push('       📍 ' + dd.location);
      if (dd.cost !== undefined && dd.cost !== null && dd.cost !== '') lines.push('       💰 ' + fmtMoney(dd.cost, dd.currency));
    }
    lines.push('');
  }
  var secs = p.sections || [];
  for (var s = 0; s < secs.length; s++) {
    var sec = secs[s];
    var sm = SECTION_COMPONENTS[sec.type];
    lines.push((sm ? sm.label : sec.type).toUpperCase());
    var sd = sec.data || {};
    if (sec.type === 'packing') {
      (sd.items || []).forEach(function(it) { lines.push('  ' + (it.essential ? '[x] ' : '[ ] ') + (it.name || it.text) + (it.category ? '  (' + it.category + ')' : '')); });
    } else if (sec.type === 'budget') {
      (sd.items || []).forEach(function(it) { lines.push('  ' + (it.label || it.name) + ': ' + fmtMoney(it.amount, sd.currency || p.budget.currency)); });
    } else if (sec.type === 'documents') {
      (sd.items || []).forEach(function(it) { lines.push('  ' + it.status + ' — ' + (it.name || it.title) + (it.note ? ' (' + it.note + ')' : '')); });
    } else if (sec.type === 'phrases') {
      (sd.items || []).forEach(function(it) { lines.push('  ' + it.phrase + ' = ' + it.translation + (it.phonetic ? ' [' + it.phonetic + ']' : '')); });
    } else if (sec.type === 'flights') {
      (sd.items || []).forEach(function(it) { lines.push('  ' + (it.direction || '') + ' ' + (it.from || '?') + ' → ' + (it.to || '?') + ' · ' + [it.airline, it.flightNo].filter(Boolean).join(' ') + (it.departure ? ' · dep ' + it.departure : '')); });
    } else if (sec.type === 'map') {
      (sd.points || sd.items || []).forEach(function(pt) { lines.push('  📍 ' + (pt.label || pt.name || pt.title) + (pt.note ? ' — ' + pt.note : '')); });
    } else {
      (sd.items || []).forEach(function(it) { lines.push('  ' + (it.title || it.name || it.text || it.phrase || '')); });
    }
    lines.push('');
  }
  return lines.join('\n');
}

function buildStandaloneHtml() {
  var p = DB.plan;
  var daysHtml = '';
  var days = sortedDays();
  for (var i = 0; i < days.length; i++) daysHtml += renderDayCard(days[i]);
  var sectionsHtml = '';
  var secs = p.sections || [];
  for (var s = 0; s < secs.length; s++) sectionsHtml += renderSectionCard(secs[s]);
  var head =
    '<div class="tp-standalone-head">' +
      '<div class="tp-standalone-ico">✈️</div>' +
      '<div>' +
        '<h1>' + esc(p.title || 'Travel Plan') + '</h1>' +
        '<div class="tp-standalone-meta">' +
          (p.destination ? esc(p.destination + (p.country ? ', ' + p.country : '')) : '') +
          (p.startDate || p.endDate ? ' · ' + esc((p.startDate || '?') + ' → ' + (p.endDate || '?')) : '') +
          ' · ' + esc((p.travelers.type || 'solo') + ' × ' + (p.travelers.count || 1)) +
          (p.budget && p.budget.total > 0 ? ' · ' + esc(fmtMoney(p.budget.total, p.budget.currency)) : '') +
        '</div>' +
      '</div>' +
    '</div>';
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + esc(p.title || 'Travel Plan') + '</title>' +
    '<style>' + STANDALONE_CSS + '</style></head><body>' +
    head + '<div class="tp-standalone-wrap">' + daysHtml + '</div>' +
    (sectionsHtml ? '<h2 class="tp-standalone-h2">🧳 Essentials</h2><div class="tp-sections-wrap">' + sectionsHtml + '</div>' : '') +
    '</body></html>';
}

function buildEmailHtml() {
  var p = DB.plan;
  var h = '';
  h += '<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">';
  h += '<h1 style="font-size:20px;color:#0e7490;margin:0 0 4px">✈️ ' + esc(p.title || 'Travel Plan') + '</h1>';
  h += '<p style="font-size:13px;color:#475569;margin:0 0 14px">' +
    esc([p.destination + (p.country ? ', ' + p.country : ''),
      (p.startDate ? p.startDate + ' → ' + (p.endDate || '') : ''),
      (p.travelers.type || 'solo') + ' × ' + (p.travelers.count || 1)].filter(Boolean).join(' · ')) + '</p>';
  var days = sortedDays();
  for (var i = 0; i < days.length; i++) {
    var d = days[i];
    h += '<h2 style="font-size:15px;color:#0e7490;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin:16px 0 8px">Day ' + d.day + (d.title ? ' — ' + esc(d.title) : '') + (d.date ? ' <span style="font-weight:normal;font-size:12px;color:#94a3b8">(' + esc(d.date) + ')</span>' : '') + '</h2>';
    h += '<ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.6">';
    for (var j = 0; j < d.components.length; j++) {
      var c = d.components[j];
      var dd = c.data || {};
      var comp = DAY_COMPONENTS[c.type];
      var label;
      if (c.type === 'transport') label = '<b>' + esc([dd.from, dd.to].filter(Boolean).join(' → ')) + '</b>' + (dd.departure ? ' at ' + esc(dd.departure) : '');
      else if (c.type === 'stay') label = '<b>' + esc(dd.name || 'Accommodation') + '</b>' + (dd.checkIn ? ' (check-in ' + esc(dd.checkIn) + ')' : '');
      else if (c.type === 'meal') label = (dd.meal ? esc(dd.meal) + ': ' : '') + '<b>' + esc(dd.name || dd.place || '') + '</b>';
      else if (c.type === 'alert') label = '<b>' + esc(dd.text || 'Alert') + '</b>';
      else if (c.type === 'note') label = esc(dd.title || dd.text || 'Note');
      else label = '<b>' + esc(dd.title || dd.name || c.type) + '</b>';
      var meta = [];
      if (dd.time) meta.push(esc(dd.time));
      if (dd.location) meta.push('📍 ' + esc(dd.location));
      if (dd.cost !== undefined && dd.cost !== null && dd.cost !== '') meta.push('💰 ' + esc(fmtMoney(dd.cost, dd.currency)));
      h += '<li>' + (comp ? comp.icon + ' ' : '') + label + (meta.length ? ' <span style="color:#64748b">— ' + meta.join(' · ') + '</span>' : '') + '</li>';
    }
    h += '</ul>';
  }
  var secs = p.sections || [];
  for (var s = 0; s < secs.length; s++) {
    var sec = secs[s];
    var sm = SECTION_COMPONENTS[sec.type];
    if (!sm) continue;
    h += '<h2 style="font-size:15px;color:#0e7490;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin:16px 0 8px">' + sm.icon + ' ' + esc(sm.label) + '</h2>';
    var sd = sec.data || {};
    var items = [];
    if (sec.type === 'packing') items = (sd.items || []).map(function(it) { return (it.essential ? '✅ ' : '▫️ ') + (it.name || it.text) + (it.category ? ' (' + it.category + ')' : ''); });
    else if (sec.type === 'budget') items = (sd.items || []).map(function(it) { return (it.label || it.name) + ': <b>' + esc(fmtMoney(it.amount, sd.currency || p.budget.currency)) + '</b>'; });
    else if (sec.type === 'documents') items = (sd.items || []).map(function(it) { return '<b>' + esc(it.status || 'pending') + '</b> — ' + esc(it.name || it.title); });
    else if (sec.type === 'phrases') items = (sd.items || []).map(function(it) { return '<b>' + esc(it.phrase) + '</b> = ' + esc(it.translation) + (it.phonetic ? ' [' + esc(it.phonetic) + ']' : ''); });
    else if (sec.type === 'flights') items = (sd.items || []).map(function(it) { return (it.direction ? esc(it.direction) + ' ' : '') + esc((it.from || '?') + ' → ' + (it.to || '?')) + ' · ' + esc([it.airline, it.flightNo].filter(Boolean).join(' ')) + (it.departure ? ' · dep ' + esc(it.departure) : ''); });
    else if (sec.type === 'map') items = (sd.points || sd.items || []).map(function(pt) { return '📍 ' + esc(pt.label || pt.name || pt.title) + (pt.note ? ' — ' + esc(pt.note) : ''); });
    else items = (sd.items || []).map(function(it) { return esc(it.title || it.name || it.text || it.phrase || ''); });
    if (items.length) h += '<ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.7">' + items.map(function(x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
  }
  h += '<p style="font-size:11px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px">Generated with the UniconHub Travel Planner.</p>';
  h += '</div>';
  return h;
}

function exportPdf() {
  var filename = slugify(DB.plan.title) + '-travel-plan';
  try {
    tool.requestExportPdf({ html: buildStandaloneHtml(), filename: filename, landscape: false }, function(err, file) {
      if (err || !file) {
        updateExportInfo('PDF export failed: ' + esc(err || 'unknown error') + '<br>Use 📄 Copy text itinerary as a fallback.', false);
        try { tool.notify('PDF export failed: ' + err, 'error'); } catch (e) {}
        return;
      }
      updateExportInfo('Print page created — if it did not open automatically, use the link:<br><a href="' + esc(file.url) + '" target="_blank" rel="noopener">' + esc(file.name) + '</a><br>Then use <b>Print → Save as PDF</b>.', true);
      try { tool.openUrl(file.url); } catch (e) {}
    });
  } catch (e) {
    updateExportInfo('PDF export unavailable: ' + esc(e.message) + '<br>Use 📄 Copy text itinerary as a fallback.', false);
  }
}

function exportEmail() {
  var user = getUserSafe();
  var to = user && user.email ? user.email : '';
  if (!to) {
    try { tool.notify('No email address found for the current user.', 'warning'); } catch (e) {}
    updateExportInfo('No email address found for the current user, so the plan could not be emailed.', false);
    return;
  }
  try {
    tool.requestSendEmail({
      to: to,
      subject: 'Travel Plan: ' + (DB.plan.title || 'Your trip'),
      title: '✈️ ' + (DB.plan.title || 'Travel Plan'),
      htmlBody: buildEmailHtml()
    }, function(err, result) {
      if (err || !result) {
        updateExportInfo('Email failed: ' + esc(err || 'unknown error') + '<br>Use 📋 Copy Plan JSON instead.', false);
        try { tool.notify('Email failed: ' + err, 'error'); } catch (e) {}
        return;
      }
      updateExportInfo('Plan emailed to <b>' + esc(to) + '</b>.', true);
      try { tool.notify('Plan emailed to ' + to, 'success'); } catch (e) {}
    });
  } catch (e) {
    updateExportInfo('Email unavailable: ' + esc(e.message), false);
  }
}

function importPlanJson() {
  if (!canWrite()) {
    try { tool.notify('Read-only mode — import disabled.', 'warning'); } catch (e) {}
    return;
  }
  var ta = el('import-json');
  if (!ta) return;
  var text = ta.value.trim();
  if (!text) return;
  var json = tryParseJson(text);
  if (!json) {
    updateExportInfo('Import failed: the pasted text is not valid JSON.', false);
    try { tool.notify('Import failed — invalid JSON.', 'error'); } catch (e) {}
    return;
  }
  var src = (json.plan && typeof json.plan === 'object') ? json.plan : json;
  DB.plan = normalizePlan(src);
  _aiJustUpdated = true;
  _bumpVersion('minor');
  persist();
  renderPlan();
  ta.value = '';
  updateExportInfo('Plan imported — v' + DB.version + '.', true);
  try { tool.notify('Plan imported ✓', 'success'); } catch (e) {}
}

var STANDALONE_CSS =
  '*{box-sizing:border-box}body{margin:0;padding:24px;background:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;font-size:14px}' +
  '.tp-standalone-head{display:flex;gap:14px;align-items:center;max-width:860px;margin:0 auto 18px}' +
  '.tp-standalone-ico{width:54px;height:54px;border-radius:14px;background:linear-gradient(135deg,#0e7490,#0ea5a4);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0}' +
  '.tp-standalone-head h1{margin:0 0 4px;font-size:24px}' +
  '.tp-standalone-meta{font-size:12px;color:#475569}' +
  '.tp-standalone-wrap{max-width:860px;margin:0 auto;display:flex;flex-direction:column;gap:14px}' +
  '.tp-standalone-h2{max-width:860px;margin:24px auto 12px;font-size:18px}' +
  '.tp-sections-wrap{max-width:860px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}' +
  '.tp-day-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}' +
  '.tp-day-head{display:flex;align-items:center;gap:10px;padding:10px 14px;background:linear-gradient(135deg,#ecfeff,#f0fdfa);border-bottom:1px solid #e2e8f0}' +
  '.tp-day-num{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#0e7490,#0ea5a4);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0}' +
  '.tp-day-title-wrap{flex:1}' +
  '.tp-day-title{font-weight:700;font-size:13.5px}' +
  '.tp-day-date{font-size:11px;color:#94a3b8}' +
  '.tp-day-head .btn-icon{display:none}' +
  '.tp-day-body{padding:6px 14px 14px}' +
  '.tp-item{display:flex;gap:10px;padding:10px 0}' +
  '.tp-item+.tp-item{border-top:1px dashed #eef2f7}' +
  '.tp-item-ico{width:32px;height:32px;border-radius:50%;background:#f1f5f9;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;margin-top:2px}' +
  '.tp-item-main{flex:1;min-width:0}' +
  '.tp-item-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}' +
  '.tp-item-time{font-size:11px;font-weight:700;color:#0e7490;background:#ecfeff;border-radius:6px;padding:1px 6px}' +
  '.tp-item-title{font-size:13px;font-weight:700}' +
  '.tp-item-sub{font-size:11.5px;color:#475569;margin-top:2px}' +
  '.tp-item-desc{font-size:12px;color:#475569;line-height:1.55;margin-top:4px}' +
  '.tp-item-meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}' +
  '.tp-chip{font-size:10.5px;padding:2px 8px;border-radius:999px;background:#f1f5f9;border:1px solid #e2e8f0;color:#475569}' +
  '.tp-chip.cost{background:#f0fdf4;border-color:#bbf7d0;color:#15803d}' +
  '.tp-chip.booking{background:#fefce8;border-color:#fef08a;color:#a16207}' +
  '.tp-chip.tag{background:#e0f2fe;border-color:#bae6fd;color:#0369a1}' +
  '.tp-chip.essential{background:#ecfeff;border-color:#a5f3fc;color:#0e7490}' +
  '.tp-chip.status-ready{background:#f0fdf4;border-color:#bbf7d0;color:#15803d}' +
  '.tp-chip.status-pending{background:#fefce8;border-color:#fef08a;color:#a16207}' +
  '.tp-chip.status-apply{background:#fee2e2;border-color:#fecaca;color:#b91c1c}' +
  '.tp-tips-list{margin:6px 0 0;padding-left:16px;font-size:11.5px;color:#475569;line-height:1.55}' +
  '.tp-alert-strip{border-radius:9px;padding:7px 10px;font-size:12px;margin-top:6px;line-height:1.5}' +
  '.tp-alert-strip.info{background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8}' +
  '.tp-alert-strip.warning{background:#fffbeb;border:1px solid #fde68a;color:#92400e}' +
  '.tp-alert-strip.danger{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c}' +
  '.tp-item-unknown{background:#fff7ed;border:1px dashed #fdba74;border-radius:9px;padding:7px 10px;font-size:11px;color:#9a3412;margin-top:6px}' +
  '.tp-section-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}' +
  '.tp-section-head{display:flex;align-items:center;gap:9px;padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0}' +
  '.tp-section-ico{font-size:17px}' +
  '.tp-section-title{font-weight:700;font-size:13px;flex:1}' +
  '.tp-section-body{padding:10px 14px 12px}' +
  '.tp-list-row{display:flex;gap:9px;padding:6px 0;border-bottom:1px dashed #eef2f7;align-items:flex-start}' +
  '.tp-list-row:last-child{border-bottom:none}' +
  '.tp-list-title{font-size:12.5px;font-weight:600}' +
  '.tp-list-text{font-size:11.5px;color:#475569;line-height:1.5}' +
  '.tp-list-meta{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}' +
  '.tp-phrase{display:flex;gap:8px;align-items:baseline;padding:6px 0;border-bottom:1px dashed #eef2f7;flex-wrap:wrap}' +
  '.tp-phrase:last-child{border-bottom:none}' +
  '.tp-phrase-orig{font-weight:700;font-size:12.5px;min-width:90px}' +
  '.tp-phrase-trans{color:#475569;font-size:12px}' +
  '.tp-phrase-phon{color:#94a3b8;font-size:10.5px}' +
  '.tp-budget-row{display:flex;gap:8px;align-items:baseline;padding:5px 0;border-bottom:1px dashed #eef2f7}' +
  '.tp-budget-row:last-of-type{border-bottom:none}' +
  '.tp-budget-label{flex:1;font-size:12px}' +
  '.tp-budget-amount{font-weight:700;font-size:12px}' +
  '.tp-budget-total{margin-top:8px;padding-top:8px;border-top:2px solid #0ea5a4;display:flex;justify-content:space-between;font-weight:700;font-size:13px}' +
  '.tp-cat-sum{display:flex;justify-content:space-between;font-size:11px;color:#475569;padding:3px 0 3px 12px}' +
  '.tp-map-btn{border:1px solid #e2e8f0;background:#f8fafc;border-radius:7px;font-size:10.5px;padding:2px 8px;color:#0e7490;flex-shrink:0}' +
  '@media print{body{background:#fff}.tp-day-card,.tp-section-card{break-inside:avoid}}';

/* ═══════════════════════════════════════════════════════════
   TABS + EVENTS
   ═══════════════════════════════════════════════════════════ */
function switchTab(tabName) {
  var tabs = document.querySelectorAll('#content-tabs .ctab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tabName);
  }
  var editors = document.querySelectorAll('.content-editor');
  for (var j = 0; j < editors.length; j++) {
    editors[j].classList.toggle('active', editors[j].id === 'editor-' + tabName);
  }
  if (tabName === 'export') updateExportInfo('', true);
  tool.resize();
}

function switchChatTab(tabName) {
  var tabs = document.querySelectorAll('#chat-tab-bar .chat-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].getAttribute('data-chat-tab') === tabName);
  }
  var panels = document.querySelectorAll('.chat-tab-panel');
  for (var j = 0; j < panels.length; j++) {
    panels[j].classList.toggle('active', panels[j].getAttribute('data-chat-panel') === tabName);
  }
  tool.resize();
}

function autoGrowInput() {
  var input = el('chat-input');
  if (!input) return;
  input.style.height = 'auto';
  var h = Math.min(input.scrollHeight, 180);
  if (h < 68) h = 68;
  input.style.height = h + 'px';
}

function lockUI(ro) {
  document.body.classList.toggle('readonly', !!ro);
  var input = el('chat-input');
  if (input) { input.disabled = ro; input.style.opacity = ro ? '0.5' : ''; }
  var send = el('btn-chat-send');
  if (send) { send.disabled = ro; }
  var addDay = el('btn-add-day');
  if (addDay) { addDay.disabled = ro; addDay.style.opacity = ro ? '0.5' : ''; }
  var importBtn = el('btn-import-json');
  if (importBtn) { importBtn.disabled = ro; importBtn.style.opacity = ro ? '0.5' : ''; }
}

function bindEvents() {
  /* chat tabs */
  var chatTabs = document.querySelectorAll('#chat-tab-bar .chat-tab');
  for (var i = 0; i < chatTabs.length; i++) {
    chatTabs[i].addEventListener('click', function() {
      switchChatTab(this.getAttribute('data-chat-tab'));
    });
  }
  /* content tabs */
  var ctabs = document.querySelectorAll('#content-tabs .ctab');
  for (var j = 0; j < ctabs.length; j++) {
    ctabs[j].addEventListener('click', function() {
      switchTab(this.getAttribute('data-tab'));
    });
  }
  var newBtn = el('btn-new-session');
  if (newBtn) {
    newBtn.addEventListener('click', function() {
      if (!canWrite()) return;
      createSession(function(session) {
        if (!session) return;
        switchSession(session.id);
      });
    });
  }
  var sendBtn = el('btn-chat-send');
  if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);
  var stopBtn = el('btn-chat-stop');
  if (stopBtn) stopBtn.addEventListener('click', cancelAiRequest);
  var input = el('chat-input');
  if (input) {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
    input.addEventListener('input', autoGrowInput);
  }
  var targetClear = el('btn-target-clear');
  if (targetClear) targetClear.addEventListener('click', clearTargetDay);

  /* hint chips + suggestion chips + stream header (delegated on chat-messages) */
  var chatMsgs = el('chat-messages');
  if (chatMsgs) {
    chatMsgs.addEventListener('click', function(e) {
      var hint = e.target.closest ? e.target.closest('[data-hint]') : null;
      if (hint) {
        var inp2 = el('chat-input');
        if (inp2) inp2.value = hint.getAttribute('data-hint');
        sendChatMessage();
        return;
      }
      var opt = e.target.closest ? e.target.closest('[data-option]') : null;
      if (opt) {
        var inp3 = el('chat-input');
        if (inp3) inp3.value = opt.getAttribute('data-option');
        sendChatMessage();
      }
    });
  }

  /* day card actions (delegated) */
  var daysWrap = el('days-wrap');
  if (daysWrap) {
    daysWrap.addEventListener('click', function(e) {
      var t = e.target.closest ? e.target.closest('[data-target-day],[data-day-up],[data-day-down],[data-day-del]') : null;
      if (!t) return;
      var day = parseInt(t.getAttribute('data-target-day') || t.getAttribute('data-day-up') || t.getAttribute('data-day-down') || t.getAttribute('data-day-del'), 10);
      if (isNaN(day)) return;
      if (t.hasAttribute('data-target-day')) setTargetDay(day);
      else if (t.hasAttribute('data-day-up')) moveDay(day, -1);
      else if (t.hasAttribute('data-day-down')) moveDay(day, 1);
      else if (t.hasAttribute('data-day-del')) deleteDayConfirm(day);
    });
  }

  /* map buttons (delegated) */
  var grid = el('sections-grid');
  if (grid) {
    grid.addEventListener('click', function(e) {
      var btn = e.target.closest ? e.target.closest('[data-map-open]') : null;
      if (!btn) return;
      var lat = btn.getAttribute('data-lat');
      var lng = btn.getAttribute('data-lng');
      var label = btn.getAttribute('data-label') || '';
      var url = 'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(lat + ',' + lng) + (label ? '+' + encodeURIComponent(label) : '');
      try { tool.openUrl(url); } catch (e2) { try { window.open(url, '_blank'); } catch (e3) {} }
    });
  }

  /* trip title */
  var titleInput = el('trip-title-input');
  if (titleInput) {
    titleInput.addEventListener('change', function() {
      if (!canWrite()) { renderTripHeader(); return; }
      DB.plan.title = titleInput.value.substring(0, 140);
      persist();
      renderVersion();
      updateExportInfo('', true);
    });
  }

  var addDay = el('btn-add-day');
  if (addDay) addDay.addEventListener('click', addBlankDay);

  /* export buttons */
  var bCopyJson = el('btn-export-copy-json');
  if (bCopyJson) bCopyJson.addEventListener('click', copyPlanJson);
  var bDlJson = el('btn-export-download-json');
  if (bDlJson) bDlJson.addEventListener('click', downloadPlanJson);
  var bPdf = el('btn-export-pdf');
  if (bPdf) bPdf.addEventListener('click', exportPdf);
  var bTxt = el('btn-export-copy-text');
  if (bTxt) bTxt.addEventListener('click', copyTextItinerary);
  var bEmail = el('btn-export-email');
  if (bEmail) bEmail.addEventListener('click', exportEmail);
  var bImport = el('btn-import-json');
  if (bImport) bImport.addEventListener('click', importPlanJson);
  var bGotoExport = el('btn-goto-export');
  if (bGotoExport) bGotoExport.addEventListener('click', function() { switchTab('export'); });
  var bExportQuick = el('btn-export-quick');
  if (bExportQuick) bExportQuick.addEventListener('click', function() { switchTab('export'); });

  /* confirm dialog */
  var cNo = el('btn-confirm-no');
  if (cNo) cNo.addEventListener('click', hideConfirm);
  var cYes = el('btn-confirm-yes');
  if (cYes) cYes.addEventListener('click', function() {
    var cb = _confirmCb;
    hideConfirm();
    if (cb) cb();
  });
  var cOverlay = el('confirm-overlay');
  if (cOverlay) {
    cOverlay.addEventListener('click', function(e) {
      if (e.target === cOverlay) hideConfirm();
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') hideConfirm();
  });
}

/* ═══════════════════════════════════════════════════════════
   PERSISTENCE
   ═══════════════════════════════════════════════════════════ */
var _lastStagedValue = null;
var _snapshotInitialized = false;
var _lastPersistedSnapshot = null;
var _aiJustUpdated = false;

function _planSnapshot() {
  try { return JSON.stringify(DB.plan); } catch (e) { return ''; }
}

function _slimValue() {
  return {
    plan: DB.plan,
    version: DB.version,
    activeSessionId: DB.activeSessionId,
    chatCache: { sessionId: DB.activeSessionId, messages: _trimChatCache(DB.chatMessages) },
    _instanceId: DB._instanceId,
    _parentRecordId: DB._parentRecordId
  };
}

function _stageValue() {
  var slim = _slimValue();
  try { tool.setValue(slim); } catch (e) {}
  try { _lastStagedValue = JSON.stringify(slim); } catch (e) {}
}

function persist() {
  if (!_snapshotInitialized) {
    _lastPersistedSnapshot = _planSnapshot();
    _snapshotInitialized = true;
  } else {
    var snap = _planSnapshot();
    if (_lastPersistedSnapshot !== null && snap !== _lastPersistedSnapshot && !_aiJustUpdated) _bumpVersion('patch');
    _lastPersistedSnapshot = snap;
  }
  _aiJustUpdated = false;
  DB.chatCache = { sessionId: DB.activeSessionId, messages: _trimChatCache(DB.chatMessages) };
  _stageValue();
  if (DB.activeSessionId) saveCurrentSession();
  tool.resize();
}

function _bumpVersion(level) {
  if (!DB.version) DB.version = '1.0.0';
  var parts = DB.version.split('.');
  var maj = parseInt(parts[0], 10) || 0;
  var min = parseInt(parts[1], 10) || 0;
  var pat = parseInt(parts[2], 10) || 0;
  if (level === 'major') { maj += 1; min = 0; pat = 0; }
  else if (level === 'minor') { min += 1; pat = 0; }
  else { pat += 1; }
  DB.version = maj + '.' + min + '.' + pat;
  renderVersion();
}

/* ═══════════════════════════════════════════════════════════
   MAIN RENDER + ENTRY POINT
   ═══════════════════════════════════════════════════════════ */
function render(v) {
  try {
    if (v && typeof v === 'object' && 'plan' in v) {
      var normalized = normalizeValue(v);
      DB.plan = normalized.plan;
      DB.version = normalized.version;
      DB.activeSessionId = normalized.activeSessionId;
      DB.chatCache = normalized.chatCache;
      DB._instanceId = normalized._instanceId;
      DB._parentRecordId = normalized._parentRecordId;
      if (!DB.chatMessages.length && DB.chatCache.messages && DB.chatCache.messages.length) {
        DB.chatMessages = DB.chatCache.messages.slice();
      }
    } else if (v && typeof v === 'object' && (v.chatCache || v.version)) {
      /* legacy value without plan object */
      DB.version = String(v.version || '1.0.0');
      DB.chatCache = v.chatCache || { sessionId: '', messages: [] };
      DB._instanceId = String(v._instanceId || '');
      DB._parentRecordId = String(v._parentRecordId || '');
      if (!DB.chatMessages.length && DB.chatCache.messages && DB.chatCache.messages.length) {
        DB.chatMessages = DB.chatCache.messages.slice();
      }
    }
  } catch (e) {
    console.warn('[TRAVELPLANNER:RENDER]', e);
  }
  renderPlan();
  renderChatMessages();
  updateChatBadge();
  renderSessionList();
  tool.resize();
}

var _initialized = false;
tool.onReady(function(val, fields) {
  if (_initialized) { console.warn('[TRAVELPLANNER:INIT] Already initialized — skipping'); return; }
  _initialized = true;

  tool.declareOutput({
    type: 'object',
    title: 'Travel Planner Value',
    description: 'The saved travel plan: trip metadata, day-by-day components and plan sections (packing, budget, documents, tips, phrases, emergency, flights, map), plus chat-session plumbing and a bounded chat cache.',
    properties: {
      plan: { type: 'object', title: 'Plan', description: '{title, destination, country, startDate, endDate, travelers, budget, style, days:[{day,date,title,components}], sections:[{type,data}]}' },
      version: { type: 'string', title: 'Plan Version', description: 'Semantic version. AI update → minor bump; manual edit → patch bump.' },
      activeSessionId: { type: 'string', title: 'Active Chat Session ID', description: 'Document id in ai-chat-sessions-uniconbaseapps.' },
      chatCache: { type: 'object', title: 'Chat Cache', description: 'Bounded fallback copy of the last chat messages.' },
      _instanceId: { type: 'string', title: 'Instance ID', description: 'Deterministic per-instance identifier for chat-session isolation.' },
      _parentRecordId: { type: 'string', title: 'Parent Record ID', description: 'Parent CMS record id.' }
    }
  });

  tool.declareParams([
    { name: 'allowAi', label: 'Enable AI Prompt Relay', type: 'toggle', default: 'yes', severity: 'mandatory', hint: 'Required for chat-driven trip planning.' },
    { name: 'allowObjectCRUD', label: 'Enable Object CRUD (chat history)', type: 'toggle', default: 'yes', severity: 'goodToHave', hint: 'Chat history is stored in CMS type ai-chat-sessions-uniconbaseapps. Add it to allowedObjectTypes with role: editor, scope: instance.' },
    { name: 'allowExportPdf', label: 'Enable PDF Export', type: 'toggle', default: 'yes', severity: 'goodToHave', hint: 'Enables the Print / PDF button in the Export tab.' },
    { name: 'allowSendEmail', label: 'Enable Email', type: 'toggle', default: 'yes', severity: 'optional', hint: 'Enables the "Email plan" button in the Export tab.' },
    { name: 'lang', label: 'Plan Language', type: 'text', default: 'en', severity: 'optional', hint: 'Language used in generated plan content (en, tr, fr, de, es, ar).' },
    { name: 'defaultCurrency', label: 'Default Currency', type: 'text', default: 'USD', severity: 'optional', hint: 'Default 3-letter currency code for budgets and costs when the user does not specify one.' }
  ]);

  var aiParamRaw = null;
  try { aiParamRaw = tool.param('allowAi', ''); } catch (e) {}
  var aiParam = String(aiParamRaw === null || aiParamRaw === undefined ? '' : aiParamRaw).trim().toLowerCase();
  _aiEnabled = ['yes', 'true', '1', 'on'].indexOf(aiParam) !== -1;
  console.log('[TRAVELPLANNER:AI] allowAi param = "' + aiParam + '" → AI ' + (_aiEnabled ? 'ENABLED' : 'DISABLED'));
  console.log('[TRAVELPLANNER:AI] requestAIStream support: ' + (typeof tool.requestAIStream === 'function'));
  if (!_aiEnabled) {
    try {
      tool.reportMissingParams([{
        name: 'allowAi', label: 'Enable AI Prompt Relay',
        type: 'toggle', default: 'yes', severity: 'mandatory',
        hint: 'Set to "yes" to enable AI trip planning via tool.requestAI().',
        reason: 'This tool requires AI access to build travel plans from chat.'
      }], 'AI Prompt Relay must be enabled for this tool to function. Set allowAi: yes in the field settings.');
    } catch (e) {}
  }
  try { tool.reportValid(true); } catch (e) {}

  refreshUser();
  render(val);
  bindEvents();
  updateConnStatus('ok');

  loadSessions(function() {
    var hasActiveSession = DB.activeSessionId && DB.activeSessionId.length > 0;
    if (hasActiveSession) {
      restoreActiveSession();
    }
    renderSessionList();
    renderChatMessages();
  });

  if (tool.isReadOnly()) {
    lockUI(true);
    try { tool.notify('Read-only mode — you can view and export the plan, but not edit it.', 'info'); } catch (e) {}
  }
  switchTab('itinerary');
  tool.resize();
});

tool.onValueChange(function(v) {
  try {
    var json = JSON.stringify(v || null);
    if (json === _lastStagedValue) return; /* echo of our own staged write */
  } catch (e) {}
  render(v);
});

tool.onReadonlyChange(function(ro) {
  lockUI(!!ro);
});

tool.onUserChange(function() { refreshUser(); });