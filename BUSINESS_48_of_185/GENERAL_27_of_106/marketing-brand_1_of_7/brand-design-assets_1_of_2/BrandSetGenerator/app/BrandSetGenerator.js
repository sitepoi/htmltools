/* ============================================================
   Brand Set Generator — UniconHub html-tool
   Generates a full brand identity kit (logo, cards, favicon,
   social & document assets) from a company profile.
   Entry point: tool.onReady
   ============================================================ */
(function () {
  'use strict';

  /* --------------------------------------------------------
     Constants — icons (24x24 stroke paths), fonts, options
  -------------------------------------------------------- */
  var ICONS = {
    rocket:    { cat: 'business', label: 'Rocket', d: ['M12 14.5C9.2 14.5 7 12.3 7 9.5C7 5 9.8 2.5 12 2.5C14.2 2.5 17 5 17 9.5C17 12.3 14.8 14.5 12 14.5Z', 'M12 7.7A1.8 1.8 0 1 1 12 11.3A1.8 1.8 0 1 1 12 7.7Z', 'M8.5 9.5L5 6.5', 'M15.5 9.5L19 6.5', 'M12 14.5V18', 'M10.5 15.5V17.5', 'M13.5 15.5V17.5'] },
    bolt:      { cat: 'business', label: 'Bolt', d: ['M13 2L4.5 13.5H11L10 22L19.5 10H12.5L13 2Z'] },
    hexagon:   { cat: 'tech', label: 'Hexagon', d: ['M12 2L21 7.5V16.5L12 22L3 16.5V7.5L12 2Z'] },
    globe:     { cat: 'nature', label: 'Globe', d: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', 'M12 3C9 7 9 17 12 21', 'M12 3C15 7 15 17 12 21', 'M3.5 12H20.5'] },
    leaf:      { cat: 'nature', label: 'Leaf', d: ['M4 20C4 10 10 4 20 4C20 14 14 20 4 20Z', 'M4 20C7 14 11 10 16 7'] },
    heart:     { cat: 'lifestyle', label: 'Heart', d: ['M12 20C12 20 4 14.5 4 9.5C4 6.5 6.2 4.5 9 4.5C10.8 4.5 12 5.5 12 7C12 5.5 13.2 4.5 15 4.5C17.8 4.5 20 6.5 20 9.5C20 14.5 12 20 12 20Z'] },
    star:      { cat: 'lifestyle', label: 'Star', d: ['M12 3L14.7 8.6L21 9.4L16.5 13.6L17.7 20L12 16.9L6.3 20L7.5 13.6L3 9.4L9.3 8.6L12 3Z'] },
    gem:       { cat: 'lifestyle', label: 'Gem', d: ['M6 3H18L21 9L12 21L3 9L6 3Z', 'M3 9H21', 'M9 3L7 9L12 21', 'M15 3L17 9L12 21'] },
    shield:    { cat: 'business', label: 'Shield', d: ['M12 3L19 6V11C19 16 16 19.5 12 21C8 19.5 5 16 5 11V6L12 3Z', 'M9 11.5L11.2 13.7L15.5 9.5'] },
    target:    { cat: 'business', label: 'Target', d: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8', 'M12 10.8a1.2 1.2 0 1 0 0 2.4a1.2 1.2 0 1 0 0-2.4'] },
    layers:    { cat: 'tech', label: 'Layers', d: ['M12 3L21 8L12 13L3 8L12 3Z', 'M3 12L12 17L21 12', 'M3 16L12 21L21 16'] },
    cube:      { cat: 'tech', label: 'Cube', d: ['M12 2.5L20 7V17L12 21.5L4 17V7L12 2.5Z', 'M4 7L12 11.5L20 7', 'M12 11.5V21.5'] },
    code:      { cat: 'tech', label: 'Code', d: ['M8 6L2.5 12L8 18', 'M16 6L21.5 12L16 18', 'M13.5 4L10.5 20'] },
    chart:     { cat: 'business', label: 'Chart', d: ['M2.5 20.5H21.5', 'M5 20V13', 'M9.5 20V6.5', 'M14 20V10', 'M18.5 20V4'] },
    pulse:     { cat: 'lifestyle', label: 'Pulse', d: ['M3 12H7L9.5 5L13.5 19L16 12H21'] },
    droplet:   { cat: 'nature', label: 'Droplet', d: ['M12 2.5C12 2.5 6.5 9.5 6.5 14.5C6.5 17.8 9 20 12 20C15 20 17.5 17.8 17.5 14.5C17.5 9.5 12 2.5 12 2.5Z'] },
    sun:       { cat: 'nature', label: 'Sun', d: ['M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8', 'M12 2V4', 'M12 20V22', 'M2 12H4', 'M20 12H22', 'M4.9 4.9L6.3 6.3', 'M17.7 17.7L19.1 19.1', 'M19.1 4.9L17.7 6.3', 'M6.3 17.7L4.9 19.1'] },
    moon:      { cat: 'nature', label: 'Moon', d: ['M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5A7 7 0 0 0 20.5 14.5Z'] },
    compass:   { cat: 'nature', label: 'Compass', d: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', 'M14.5 9.5L11 11L9.5 14.5L13 13L14.5 9.5Z'] },
    book:      { cat: 'lifestyle', label: 'Book', d: ['M4 5C4 5 8 3.5 12 3.5C16 3.5 20 5 20 5V18.5C20 18.5 16 17 12 17C8 17 4 18.5 4 18.5V5Z', 'M12 3.5V17'] },
    briefcase: { cat: 'business', label: 'Briefcase', d: ['M4 8H20C21.1 8 22 8.9 22 10V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V10C2 8.9 2.9 8 4 8Z', 'M8 8V6C8 4.9 8.9 4 10 4H14C15.1 4 16 4.9 16 6V8', 'M2 13H22'] },
    headset:   { cat: 'tech', label: 'Headset', d: ['M4.5 14C4.5 9.9 7.9 6.5 12 6.5C16.1 6.5 19.5 9.9 19.5 14', 'M4.5 14V17.5C4.5 18.9 5.6 20 7 20H8.5', 'M19.5 14V17.5C19.5 18.9 18.4 20 17 20H15.5', 'M8.5 20C8.5 21.7 7.3 23 5.5 23', 'M15.5 20C15.5 21.7 16.7 23 18.5 23', 'M17 17C16.2 17 15.5 16.3 15.5 15.5V12.5H19.5', 'M17 17V20'] },
    camera:    { cat: 'lifestyle', label: 'Camera', d: ['M4 8H7L9 5.5H15L17 8H20C21.1 8 22 8.9 22 10V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V10C2 8.9 2.9 8 4 8Z', 'M12 10.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7'] },
    crown:     { cat: 'lifestyle', label: 'Crown', d: ['M4 8L8.5 12L12 6L15.5 12L20 8V17H4V8Z', 'M5.5 20H18.5', 'M7.7 11.2a0.8 0.8 0 1 1 1.6 0a0.8 0.8 0 1 1-1.6 0', 'M11.2 5.2a0.8 0.8 0 1 1 1.6 0a0.8 0.8 0 1 1-1.6 0', 'M14.7 11.2a0.8 0.8 0 1 1 1.6 0a0.8 0.8 0 1 1-1.6 0'] },
    anchor:    { cat: 'lifestyle', label: 'Anchor', d: ['M12 3V21', 'M12 3C10 3 8.5 4.3 8.5 6C8.5 7.7 10 9 12 9C14 9 15.5 7.7 15.5 6C15.5 4.3 14 3 12 3Z', 'M5 12C5 17 8 20 12 21C16 20 19 17 19 12', 'M5 12H3', 'M19 12H21'] },
    users:     { cat: 'business', label: 'Users', d: ['M9 7.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7', 'M2.5 19.5C3.2 15.6 5.8 13.8 9 13.8C12.2 13.8 14.8 15.6 15.5 19.5', 'M17.5 7.2a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5', 'M16.3 13.8C18.6 14.1 20.4 15.5 21.5 17.8'] },
    grad:      { cat: 'business', label: 'Academy', d: ['M12 3L22 8L12 13L2 8L12 3Z', 'M6 10.5V15C6 16.5 8.7 18 12 18C15.3 18 18 16.5 18 15V10.5', 'M22 8V13'] },
    building:  { cat: 'business', label: 'Building', d: ['M5 3H19V21', 'M2.5 21H21.5', 'M8 7H10V9H8Z', 'M14 7H16V9H14Z', 'M8 12H10V14H8Z', 'M14 12H16V14H14Z', 'M8 17H10V19H8Z', 'M14 17H16V19H14Z', 'M11 16H13V21'] },
    plane:     { cat: 'lifestyle', label: 'Plane', d: ['M21.5 2.5L2.5 10.5L10 13L13 20.5L21.5 2.5Z', 'M10 13L21.5 2.5'] },
    music:     { cat: 'lifestyle', label: 'Music', d: ['M9 18V5L19 3V16', 'M6.5 18A2.5 2.5 0 1 0 6.5 23A2.5 2.5 0 1 0 6.5 18', 'M16.5 16A2.5 2.5 0 1 0 16.5 21A2.5 2.5 0 1 0 16.5 16'] },
    sliders:   { cat: 'tech', label: 'Sliders', d: ['M4 7H13.5', 'M18 7H20', 'M4 17H10.5', 'M14.5 17H20', 'M15.5 4.5V9.5', 'M12 14.5V19.5', 'M15.5 7A2.2 2.2 0 1 0 15.5 11.4A2.2 2.2 0 1 0 15.5 7', 'M12 17A2.2 2.2 0 1 0 12 21.4A2.2 2.2 0 1 0 12 17'] },
    funnel:    { cat: 'business', label: 'Funnel', d: ['M3 5H21L14.5 12.5V18.5L9.5 20.5V12.5L3 5Z'] },
    wifi:      { cat: 'tech', label: 'Wifi', d: ['M2.5 9C7.5 4.5 16.5 4.5 21.5 9', 'M5.5 12.5C9.5 9.5 14.5 9.5 18.5 12.5', 'M8.5 16C10.5 14.5 13.5 14.5 15.5 16', 'M11.1 19a0.9 0.9 0 1 1 1.8 0a0.9 0.9 0 1 1-1.8 0'] },
    tree:      { cat: 'nature', label: 'Tree', d: ['M12 3C12 3 9.5 4.8 9.5 7.5C9.5 9 10.5 10 12 10.5C13.5 10 14.5 9 14.5 7.5C14.5 4.8 12 3 12 3Z', 'M11 14H13V21H11Z', 'M8 21H16'] },
    envelope:  { cat: 'ui', label: 'Envelope', d: ['M3 6H21V18H3V6Z', 'M3 7L12 13L21 7'] },
    phone:     { cat: 'ui', label: 'Phone', d: ['M4.5 3.5H9L10.5 8L8 9.5C9.5 12.5 11.5 14.5 14.5 16L16 13.5L20.5 15V19.5C20.5 20.6 19.6 21.5 18.5 21.5C9.5 21.5 2.5 14.5 2.5 5.5C2.5 4.4 3.4 3.5 4.5 3.5Z'] },
    pin:       { cat: 'ui', label: 'Pin', d: ['M12 21C12 21 5 13.5 5 9C5 5.1 8.1 2 12 2C15.9 2 19 5.1 19 9C19 13.5 12 21 12 21Z', 'M12 12.5A3.5 3.5 0 1 0 12 5.5A3.5 3.5 0 1 0 12 12.5Z'] }
  };

  var FONTS = {
    poppins:    { label: 'Poppins',           stack: "'Poppins', 'Segoe UI', sans-serif",            weight: 600 },
    inter:      { label: 'Inter',             stack: "'Inter', 'Segoe UI', sans-serif",              weight: 600 },
    montserrat: { label: 'Montserrat',        stack: "'Montserrat', 'Segoe UI', sans-serif",          weight: 700 },
    space:      { label: 'Space Grotesk',     stack: "'Space Grotesk', 'Segoe UI', sans-serif",       weight: 600 },
    playfair:   { label: 'Playfair Display',  stack: "'Playfair Display', Georgia, serif",            weight: 700 },
    bebas:      { label: 'Bebas Neue',        stack: "'Bebas Neue', Impact, sans-serif",              weight: 400 },
    cormorant:  { label: 'Cormorant Garamond', stack: "'Cormorant Garamond', Georgia, serif",         weight: 600 },
    quicksand:  { label: 'Quicksand',         stack: "'Quicksand', 'Segoe UI', sans-serif",           weight: 600 }
  };

  var INDUSTRIES = ['Technology / Software', 'Finance & Banking', 'Healthcare', 'Food & Beverage', 'Retail & E-commerce', 'Education', 'Real Estate', 'Travel & Hospitality', 'Fitness & Sports', 'Legal Services', 'Nonprofit', 'Media & Entertainment', 'Manufacturing', 'Other'];

  var PERSONALITIES = ['Modern', 'Playful', 'Luxury', 'Minimal', 'Bold', 'Trustworthy', 'Creative', 'Classic', 'Friendly', 'Premium'];

  var PALETTE_STYLES = [
    { id: 'modern', label: 'Modern' },
    { id: 'complementary', label: 'Complementary' },
    { id: 'analogous', label: 'Analogous' },
    { id: 'triad', label: 'Triadic' },
    { id: 'luxury', label: 'Luxury' },
    { id: 'natural', label: 'Natural' },
    { id: 'minimal', label: 'Minimal' }
  ];

  var BRAND_SWATCHES = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e', '#2563eb', '#0f172a', '#b45309'];

  var DEFAULT_NAME = 'Your Company';

  /* --------------------------------------------------------
     State
  -------------------------------------------------------- */
  var DB = null;
  var _saving = false;
  var _saveTimer = null;
  var _fontsReady = null;
  var _mcanvas = null;
  var _measureCache = {};
  var _user = null;
  var _noIdentity = false;
  var _readOnly = false;
  var _polled = false;
  var _lb = null;           // lightbox state {title, svg, w, h, html, filename}
  var _lbScale = 2;         // 1x / 2x / 4x PNG export scale in the lightbox
  var _step = 1;
  var _kitGroup = 'all';    // selected Brand Kit category ('all' = show everything)
  var _darkKit = false;     // dark-interface variant of the kit (one-toggle recolor)
  var _labTab = 'ideas';    // selected Creative Lab tool
  var _ideaSeed = 0;        // shuffle counter for logo ideas
  var _voice = {};          // generated brand-voice texts (in-memory)
  var _names = [];          // generated name ideas (in-memory)
  var _photoPalette = null; // colors extracted from an uploaded photo
  var _photoUrl = '';       // last photo used for palette extraction
  var _labBusy = false;     // AI request in flight
  var _chatWarned = false;  // one-time warn that chat stays in the form

  function DEFAULTS() {
    return {
      v: 1,
      company: {
        name: '', legalName: '', tagline: '', industry: INDUSTRIES[0],
        personality: ['Modern'],
        brandColor: '#4f46e5', paletteStyle: 'modern',
        contact: { person: '', title: '', email: '', phone: '', website: '', address: '' }
      },
      logo: {
        source: 'builder',
        uploadUrl: '', uploadName: '', uploadFit: 'plain', uploadPad: 72,
        symbol: 'icon', iconId: 'rocket', monogram: '',
        layout: 'horizontal', shape: 'rounded',
        fontId: 'poppins', tagFontId: 'inter',
        uppercase: false, tracking: 2, iconScale: 1,
        showTagline: true, shadow: true,
        override: { primary: '', text: '', tag: '', bg: '' }
      },
      lab: {
        abTaglines: [],
        competitors: []
      },
      chat: {
        sessionId: '',
        messages: []
      },
      files: {
        slug: '',
        prefix: '',
        suffix: '',
        lowercase: true
      },
      export: {
        formats: {}
      }
    };
  }

  var DEFAULT_GROUP_FORMATS = {
    logo: ['svg', 'png', 'webp'],
    icons: ['svg', 'png', 'ico'],
    web: ['svg', 'png'],
    social: ['svg', 'png'],
    print: ['svg', 'png'],
    digital: [],
    quality: ['svg', 'png']
  };

  function normalize(v) {
    var d = DEFAULTS();
    if (!v || typeof v !== 'object') return d;
    d.company = Object.assign(d.company, (v.company || {}));
    d.company.contact = Object.assign(d.company.contact, ((v.company || {}).contact || {}));
    d.logo = Object.assign(d.logo, (v.logo || {}));
    d.logo.override = Object.assign(d.logo.override, ((v.logo || {}).override || {}));
    if (Array.isArray(v.company.personality)) d.company.personality = v.company.personality;
    d.lab = Object.assign(d.lab, (v.lab || {}));
    if (Array.isArray((v.lab || {}).abTaglines)) d.lab.abTaglines = v.lab.abTaglines;
    if (Array.isArray((v.lab || {}).competitors)) d.lab.competitors = v.lab.competitors;
    d.chat = Object.assign(d.chat, (v.chat || {}));
    if (Array.isArray((v.chat || {}).messages)) d.chat.messages = (v.chat.messages).slice(-60);
    d.files = Object.assign(d.files, (v.files || {}));
    d.export = Object.assign(d.export, (v.export || {}));
    var fmts = {};
    Object.keys(DEFAULT_GROUP_FORMATS).forEach(function (gid) {
      var vv = ((v.export || {}).formats || {})[gid];
      fmts[gid] = Array.isArray(vv) ? vv.slice() : DEFAULT_GROUP_FORMATS[gid].slice();
    });
    d.export.formats = fmts;
    return d;
  }

  /* --------------------------------------------------------
     Tiny DOM helpers
  -------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }
  function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); return el; }
  function debounce(fn, ms) { var t = null; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); }; }
  function escXml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
  function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function slugify(s) {
    s = String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    s = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s || 'brand';
  }
  function slugKeepCase(s) {
    s = String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    s = s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s || 'brand';
  }
  /* P5-04 — file naming scheme (custom slug + prefix/suffix rules) */
  function assetSlug() {
    var f = DB.files || {};
    var s = String(f.slug || '').trim();
    if (!s) s = (DB.company && (DB.company.name || DB.company.legalName)) || DEFAULT_NAME;
    s = f.lowercase === false ? slugKeepCase(s) : slugify(s);
    var prefix = String(f.prefix || '').trim();
    var suffix = String(f.suffix || '').trim();
    if (prefix) s = slugify(prefix) + '-' + s;
    if (suffix) s = s + '-' + slugify(suffix);
    return s || 'brand';
  }
  /* P5-06 — per-group export formats */
  function groupFormats(gid) {
    var v = DB.export && DB.export.formats && DB.export.formats[gid];
    if (Array.isArray(v)) return v.slice();
    return (DEFAULT_GROUP_FORMATS[gid] || []).slice();
  }

  /* --------------------------------------------------------
     Color math
  -------------------------------------------------------- */
  function hexToRgb(hex) {
    hex = String(hex || '#000000').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbToHex(r, g, b) {
    function p(x) { x = Math.round(Math.max(0, Math.min(255, x))); return ('0' + x.toString(16)).slice(-2); }
    return '#' + p(r) + p(g) + p(b);
  }
  function rgbToHsl(rgb) {
    var r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h: h * 360, s: s, l: l };
  }
  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      function hue(t) {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      }
      r = hue(h + 1 / 3); g = hue(h); b = hue(h - 1 / 3);
    }
    return { r: r * 255, g: g * 255, b: b * 255 };
  }
  function hslToHex(h, s, l) {
    s = Math.max(0, Math.min(1, s)); l = Math.max(0.03, Math.min(0.97, l));
    var c = hslToRgb(h, s, l);
    return rgbToHex(c.r, c.g, c.b);
  }
  function mix(hex1, hex2, t) {
    var a = hexToRgb(hex1), b = hexToRgb(hex2);
    t = Math.max(0, Math.min(1, t));
    return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
  }
  function shade(hex, amt) { return amt >= 0 ? mix(hex, '#ffffff', amt) : mix(hex, '#000000', -amt); }
  function contrastOn(hex) {
    var c = hexToRgb(hex);
    var lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
    return lum > 0.55 ? '#0f172a' : '#ffffff';
  }
  function shiftHue(hex, deg) {
    var hsl = rgbToHsl(hexToRgb(hex));
    return hslToHex(hsl.h + deg, hsl.s, hsl.l);
  }

  function generatePalette(hex, style) {
    var hsl = rgbToHsl(hexToRgb(hex));
    var h = hsl.h, s = hsl.s, l = hsl.l;
    var dark = hslToHex(h, s * 0.6, 0.14);
    var light = hslToHex(h, s * 0.5, 0.94);
    var muted = hslToHex(h, s * 0.35, 0.55);
    var accent;
    switch (style) {
      case 'complementary': accent = hslToHex(h + 180, Math.min(1, s * 0.9), Math.min(0.92, l + 0.05)); break;
      case 'analogous': accent = hslToHex(h + 42, Math.min(1, s * 0.95), l); break;
      case 'triad': accent = hslToHex(h + 130, Math.min(1, s * 0.9), Math.min(0.9, l + 0.03)); break;
      case 'luxury': accent = hslToHex(43, 0.42, 0.48); break;
      case 'natural': accent = hslToHex(140, 0.45, 0.42); break;
      case 'minimal': accent = hslToHex(h, 0.06, 0.42); break;
      default: accent = hslToHex(h + 24, Math.min(1, s * 0.95), l); break;
    }
    return { brand: hex, dark: dark, accent: accent, light: light, muted: muted };
  }

  /* --------------------------------------------------------
     Text measurement (canvas, for exact SVG geometry)
  -------------------------------------------------------- */
  function fontSpec(fontId, px) {
    var f = FONTS[fontId] || FONTS.poppins;
    return f.weight + ' ' + px + 'px ' + f.stack;
  }
  function fontStack(fontId) {
    return (FONTS[fontId] || FONTS.poppins).stack;
  }
  function measureText(text, fontStr) {
    var key = fontStr + '|' + text;
    if (_measureCache[key] != null) return _measureCache[key];
    if (!_mcanvas) { _mcanvas = document.createElement('canvas'); }
    var ctx = _mcanvas.getContext('2d');
    ctx.font = fontStr;
    var w = ctx.measureText(text).width;
    _measureCache[key] = w;
    return w;
  }

  /* --------------------------------------------------------
     Logo config & glyph building
  -------------------------------------------------------- */
  function effectivePalette() {
    return generatePalette(DB.company.brandColor || '#4f46e5', DB.company.paletteStyle || 'modern');
  }
  function logoColors() {
    var pal = effectivePalette();
    var ov = DB.logo.override || {};
    return {
      primary: ov.primary || pal.brand,
      text: ov.text || pal.dark,
      tag: ov.tag || pal.muted,
      bg: ov.bg || pal.brand
    };
  }
  function initials(name) {
    var words = String(name || '').trim().split(/\s+/).filter(function (w) { return w.length > 1; });
    if (!words.length) return 'BC';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return words.slice(0, 3).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
  }
  function logoCfg() {
    var c = DB.company;
    var lg = DB.logo;
    var colors = logoColors();
    var brandName = (c.name || '').trim() || (c.legalName || '').trim() || DEFAULT_NAME;
    return {
      source: lg.source || 'builder',
      uploadUrl: lg.uploadUrl || '',
      uploadFit: lg.uploadFit || 'plain',
      uploadPad: typeof lg.uploadPad === 'number' ? lg.uploadPad : 72,
      name: brandName,
      legalName: (c.legalName || '').trim(),
      tagline: (c.tagline || '').trim(),
      monogram: (lg.monogram || '').trim().toUpperCase() || initials(brandName),
      symbol: lg.symbol || 'icon',
      iconId: lg.iconId || 'rocket',
      layout: lg.layout || 'horizontal',
      shape: lg.shape || 'rounded',
      nameFont: lg.fontId || 'poppins',
      tagFont: lg.tagFontId || 'inter',
      uppercase: !!lg.uppercase,
      tracking: typeof lg.tracking === 'number' ? lg.tracking : 2,
      iconScale: typeof lg.iconScale === 'number' ? lg.iconScale : 1,
      showTagline: lg.showTagline !== false,
      shadow: lg.shadow !== false,
      primary: colors.primary, text: colors.text, tag: colors.tag, bg: colors.bg
    };
  }

  function monoFilterDefs() {
    return '<filter id="bsgMono" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.2126 0.7152 0.0722 0 0"/></filter>'
      + '<filter id="bsgMonoW" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.2126 0.7152 0.0722 0 0"/></filter>';
  }

  function glyphSvg(cfg, cx, cy, box, color, mode) {
    if (cfg.source === 'upload' && cfg.uploadUrl) return uploadedGlyphSvg(cfg, cx, cy, box, color, mode);
    if (cfg.symbol === 'none') return '';
    var gs;
    if (cfg.layout === 'emblem') gs = box * 0.48;
    else if (cfg.layout === 'mark') gs = box * 0.6;
    else gs = box * 0.56;
    if (cfg.symbol === 'monogram') {
      var fs = gs * (cfg.monogram.length > 2 ? 0.3 : 0.4);
      return '<text x="' + cx + '" y="' + (cy + fs * 0.04) + '" font-family="' + fontStack(cfg.nameFont) + '" font-size="' + fs.toFixed(2) + '" font-weight="700" fill="' + color + '" text-anchor="middle" dominant-baseline="central">' + escXml(cfg.monogram) + '</text>';
    }
    var ic = ICONS[cfg.iconId] || ICONS.rocket;
    var s = gs / 24;
    var paths = ic.d.map(function (d) {
      return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
    }).join('');
    return '<g transform="translate(' + (cx - gs / 2).toFixed(2) + ',' + (cy - gs / 2).toFixed(2) + ') scale(' + s.toFixed(4) + ')">' + paths + '</g>';
  }

  function uploadedGlyphSvg(cfg, cx, cy, box, color, mode) {
    var fit = cfg.uploadFit || 'plain';
    var pad = (cfg.uploadPad || 72) / 100;
    var isMono = mode === 'black' || mode === 'white';
    var out = '';
    var fAttr = '';
    var imgSize;
    if (fit === 'badge') {
      var circleR = box * 0.5;
      var circleFill = isMono ? (mode === 'black' ? '#000000' : '#ffffff') : '#ffffff';
      imgSize = box * pad * 0.82;
      if (isMono) fAttr = mode === 'black' ? ' filter="url(#bsgMonoW)"' : ' filter="url(#bsgMono)"';
      out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + circleR + '" fill="' + circleFill + '"/>';
    } else if (fit === 'card') {
      var cardFill = isMono ? (mode === 'black' ? '#000000' : '#ffffff') : (cfg.bg || cfg.primary);
      var rx = box * 0.24;
      imgSize = box * pad * 0.8;
      if (isMono) fAttr = mode === 'black' ? ' filter="url(#bsgMonoW)"' : ' filter="url(#bsgMono)"';
      out += '<rect x="' + (cx - box / 2) + '" y="' + (cy - box / 2) + '" width="' + box + '" height="' + box + '" rx="' + rx + '" fill="' + cardFill + '"/>';
    } else {
      imgSize = box * pad * 1.1;
      if (isMono) fAttr = mode === 'black' ? ' filter="url(#bsgMono)"' : ' filter="url(#bsgMonoW)"';
    }
    out += '<image href="' + escXml(cfg.uploadUrl) + '" x="' + (cx - imgSize / 2).toFixed(2) + '" y="' + (cy - imgSize / 2).toFixed(2) + '" width="' + imgSize.toFixed(2) + '" height="' + imgSize.toFixed(2) + '" preserveAspectRatio="xMidYMid meet"' + fAttr + '/>';
    return out;
  }

  function shapeWrapSvg(shape, cx, cy, box, bg, inner, shadow) {
    if (!shape || shape === 'none') return inner;
    var attrs = shadow ? ' filter="url(#bsgDs)"' : '';
    if (shape === 'circle') {
      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + (box / 2).toFixed(2) + '" fill="' + bg + '"' + attrs + '/>' + inner;
    }
    var rx = shape === 'squircle' ? box * 0.4 : box * 0.26;
    return '<rect x="' + (cx - box / 2).toFixed(2) + '" y="' + (cy - box / 2).toFixed(2) + '" width="' + box.toFixed(2) + '" height="' + box.toFixed(2) + '" rx="' + rx.toFixed(2) + '" fill="' + bg + '"' + attrs + '/>' + inner;
  }

  /* --------------------------------------------------------
     Core: build logo SVG parts
     v: {layout?, mode?, shape?, bg?(reversed bg), pad?}
  -------------------------------------------------------- */
  function buildLogoParts(cfg, v) {
    v = v || {};
    var layout = v.layout || cfg.layout;
    var mode = v.mode || 'color';
    var shape = v.shape || cfg.shape || 'none';
    if (layout === 'emblem') shape = 'circle';
    if (layout === 'mark' && !shape) shape = 'rounded';

    var isMono = mode === 'black' || mode === 'white';
    var ink = isMono ? (mode === 'black' ? '#000000' : '#ffffff') : cfg.text;
    var glyphColor = isMono ? ink : cfg.primary;
    var tagColor = isMono ? ink : cfg.tag;
    var shapeBg = isMono ? (mode === 'black' ? '#000000' : '#ffffff') : cfg.bg;
    var glyphOnShape = isMono ? (mode === 'black' ? '#ffffff' : '#000000') : contrastOn(cfg.bg);

    var NAME_FS = 64, TAG_FS = 22;
    var nameStr = cfg.uppercase ? cfg.name.toUpperCase() : cfg.name;
    var showTag = cfg.showTagline && !!cfg.tagline;
    var track = cfg.tracking || 0;

    var nameW = measureText(nameStr, fontSpec(cfg.nameFont, NAME_FS)) + Math.max(0, nameStr.length - 1) * track;
    var tagW = showTag ? measureText(cfg.tagline, fontSpec(cfg.tagFont, TAG_FS)) + Math.max(0, cfg.tagline.length - 1) * 4 : 0;
    var textW = Math.max(nameW, tagW, 1);

    var scale = Math.max(0.5, Math.min(1.8, cfg.iconScale || 1));
    var iconBox;
    if (layout === 'horizontal') iconBox = 88 * scale;
    else if (layout === 'stacked') iconBox = 104 * scale;
    else if (layout === 'emblem') iconBox = 128 * scale;
    else iconBox = 112 * scale;
    iconBox = Math.round(iconBox);

    var W, H, iconCx, iconCy, nameX, nameAnchor, nameCy, tagCy;
    var defs = '';
    if (cfg.shadow && shape !== 'none') {
      defs = '<defs><filter id="bsgDs" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#0f172a" flood-opacity="0.18"/></filter></defs>';
    }
    if (cfg.source === 'upload' && cfg.uploadUrl) defs += monoFilterDefs();

    var noSymbol = cfg.symbol === 'none' || (cfg.source === 'upload' && !cfg.uploadUrl);
    var textPart = '';
    if (layout === 'horizontal') {
      var textBlockH = showTag ? 126 : 76;
      H = Math.max(iconBox, textBlockH);
      W = Math.ceil(noSymbol ? textW : iconBox + 30 + textW);
      iconCx = iconBox / 2; iconCy = H / 2;
      nameX = noSymbol ? 0 : iconBox + 30; nameAnchor = 'start';
      nameCy = showTag ? H / 2 - 19 : H / 2;
      tagCy = showTag ? H / 2 + 32 : H / 2;
    } else if (layout === 'stacked') {
      var symH = noSymbol ? 0 : iconBox + 34;
      H = Math.ceil(symH + (showTag ? 116 : 76));
      W = Math.ceil(Math.max(noSymbol ? 1 : iconBox, textW));
      iconCx = W / 2; iconCy = iconBox / 2;
      nameX = W / 2; nameAnchor = 'middle';
      nameCy = symH + 38;
      tagCy = symH + 78;
    } else if (layout === 'emblem') {
      var embH = noSymbol ? 0 : iconBox + 32;
      H = Math.ceil(embH + (showTag ? 116 : 76));
      W = Math.ceil(Math.max(noSymbol ? 1 : iconBox, textW));
      iconCx = W / 2; iconCy = iconBox / 2;
      nameX = W / 2; nameAnchor = 'middle';
      nameCy = embH + 38;
      tagCy = embH + 78;
    } else { // mark
      W = H = iconBox;
      iconCx = iconBox / 2; iconCy = iconBox / 2;
      nameX = 0; nameAnchor = 'middle'; nameCy = 0; tagCy = 0;
    }

    var glyph;
    if (!noSymbol) {
      var glyphCol = (shape !== 'none' || layout === 'emblem') ? glyphOnShape : glyphColor;
      glyph = glyphSvg(cfg, iconCx, iconCy, iconBox, glyphCol, mode);
    } else glyph = '';

    var wrapped = (!noSymbol && shape !== 'none')
      ? shapeWrapSvg(shape, iconCx, iconCy, iconBox, shapeBg, glyph, cfg.shadow)
      : glyph;

    if (layout !== 'mark') {
      textPart = '<text x="' + nameX.toFixed(2) + '" y="' + nameCy.toFixed(2) + '" font-family="' + fontStack(cfg.nameFont) + '" font-size="' + NAME_FS + '" font-weight="' + (FONTS[cfg.nameFont] || FONTS.poppins).weight + '" letter-spacing="' + track + '" fill="' + ink + '" text-anchor="' + nameAnchor + '" dominant-baseline="central">' + escXml(nameStr) + '</text>';
      if (showTag) {
        textPart += '<text x="' + nameX.toFixed(2) + '" y="' + tagCy.toFixed(2) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="' + TAG_FS + '" font-weight="500" letter-spacing="4" fill="' + tagColor + '" text-anchor="' + nameAnchor + '" dominant-baseline="central">' + escXml(cfg.tagline) + '</text>';
      }
    }

    var inner = defs + wrapped + textPart;

    // reversed background container
    if (v.bg) {
      var pad = v.pad || Math.round(H * 0.2);
      var bw = W + pad * 2, bh = H + pad * 2;
      var rad = Math.round(Math.min(bw, bh) * 0.28);
      inner = '<rect x="0" y="0" width="' + bw + '" height="' + bh + '" rx="' + rad + '" fill="' + (v.bgColor || cfg.bg) + '"/>'
        + '<g transform="translate(' + pad + ',' + pad + ')">' + inner + '</g>';
      W = bw; H = bh;
    }
    return { inner: inner, w: Math.ceil(W), h: Math.ceil(H) };
  }

  function wrapSvg(inner, w, h) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '">' + inner + '</svg>';
  }
  function buildLogo(cfg, v) {
    var p = buildLogoParts(cfg, v);
    return { svg: wrapSvg(p.inner, p.w, p.h), inner: p.inner, w: p.w, h: p.h };
  }

  /* --------------------------------------------------------
     Specialized assets
  -------------------------------------------------------- */
  function buildAppIcon(cfg, size, isAvatar) {
    size = size || 1024;
    var g1 = cfg.primary, g2 = shade(cfg.primary, -0.3);
    var rad = isAvatar ? size / 2 : size * 0.225;
    var inner = '<defs><linearGradient id="bsgAg" x1="0" y1="0" x2="1" y2="1">'
      + '<stop offset="0" stop-color="' + g1 + '"/><stop offset="1" stop-color="' + g2 + '"/></linearGradient></defs>'
      + '<rect x="0" y="0" width="' + size + '" height="' + size + '" rx="' + rad + '" fill="url(#bsgAg)"/>';
    if (cfg.source === 'upload' && cfg.uploadUrl) {
      var plate = size * 0.8;
      inner += '<rect x="' + (size - plate) / 2 + '" y="' + (size - plate) / 2 + '" width="' + plate + '" height="' + plate + '" rx="' + plate * 0.2 + '" fill="#ffffff"/>'
        + '<image href="' + escXml(cfg.uploadUrl) + '" x="' + size * 0.2 + '" y="' + size * 0.2 + '" width="' + size * 0.6 + '" height="' + size * 0.6 + '" preserveAspectRatio="xMidYMid meet"/>';
    } else {
      var markCfg = Object.assign({}, cfg, { layout: 'mark', shape: 'none', shadow: false });
      if (markCfg.symbol === 'none') markCfg = Object.assign({}, markCfg, { symbol: 'monogram' });
      inner += glyphSvg(markCfg, size / 2, size / 2, size * 0.72, '#ffffff', 'color');
    }
    return { svg: wrapSvg(inner, size, size), inner: inner, w: size, h: size };
  }

  function buildFavicon(cfg) {
    var size = 64, r = 16;
    var inner = '';
    if (cfg.source === 'upload' && cfg.uploadUrl) {
      inner = '<rect x="0" y="0" width="' + size + '" height="' + size + '" rx="' + r + '" fill="' + cfg.primary + '"/>'
        + '<image href="' + escXml(cfg.uploadUrl) + '" x="8" y="8" width="48" height="48" preserveAspectRatio="xMidYMid meet"/>';
    } else {
      var markCfg = Object.assign({}, cfg, { layout: 'mark', shadow: false });
      if (markCfg.symbol === 'none') markCfg = Object.assign({}, markCfg, { symbol: 'monogram' });
      if (cfg.shape && cfg.shape !== 'none') {
        inner = '<rect x="0" y="0" width="' + size + '" height="' + size + '" rx="' + r + '" fill="' + cfg.bg + '"/>';
        var gc = contrastOn(cfg.bg);
        inner += glyphSvg(markCfg, size / 2, size / 2, size * 0.72, gc, 'color');
      } else {
        inner = glyphSvg(markCfg, size / 2, size / 2, size * 0.86, cfg.primary, 'color');
      }
    }
    return { svg: wrapSvg(inner, size, size), inner: inner, w: size, h: size };
  }

  function buildBanner(cfg, dark) {
    var W = 1500, H = 500;
    var bg = dark ? '#0f172a' : '#ffffff';
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + bg + '"/>';
    if (!dark) {
      inner += '<circle cx="1330" cy="250" r="330" fill="none" stroke="' + cfg.primary + '" stroke-opacity="0.08" stroke-width="40"/>'
        + '<circle cx="1330" cy="250" r="200" fill="' + cfg.primary + '" fill-opacity="0.05"/>';
    } else {
      inner += '<circle cx="1330" cy="250" r="330" fill="' + cfg.primary + '" fill-opacity="0.16"/>';
    }
    var logo = buildLogoParts(cfg, dark ? { mode: 'white' } : { mode: 'color' });
    var maxW = 800, maxH = 330;
    var s = Math.min(maxW / logo.w, maxH / logo.h, 1.6);
    var ly = (H - logo.h * s) / 2;
    inner += '<g transform="translate(70,' + ly.toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
    inner += '<rect x="0" y="' + (H - 10) + '" width="' + W + '" height="10" fill="' + cfg.primary + '"/>';
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  function uiIconSvg(id, x, y, size, color) {
    var ic = ICONS[id];
    if (!ic) return '';
    var s = size / 24;
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s.toFixed(3) + ')">'
      + ic.d.map(function (d) {
        return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
      }).join('')
      + '</g>';
  }

  /* ---------- Quick Wins builders (social / email / review sheet) ---------- */
  function brandGradientBg(cfg, W, H, gid) {
    return '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1">'
      + '<stop offset="0" stop-color="' + cfg.primary + '"/><stop offset="1" stop-color="' + shade(cfg.primary, -0.3) + '"/></linearGradient></defs>'
      + '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="url(#' + gid + ')"/>';
  }

  function fitFontSize(text, fontId, weight, maxPx, maxW) {
    var px = maxPx;
    while (px > 16 && measureText(text, weight + ' ' + px + 'px ' + fontStack(fontId)) > maxW) px -= 2;
    return px;
  }

  function buildSocialCover(cfg, spec) {
    var W = spec.w, H = spec.h;
    var inner = brandGradientBg(cfg, W, H, 'bsgSc');
    inner += '<circle cx="' + Math.round(W * 0.92) + '" cy="' + Math.round(H * 0.12) + '" r="' + Math.round(H * 0.55) + '" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="' + Math.max(6, Math.round(H * 0.04)) + '"/>';
    inner += '<circle cx="' + Math.round(W * 0.06) + '" cy="' + Math.round(H * 1.05) + '" r="' + Math.round(H * 0.5) + '" fill="#ffffff" fill-opacity="0.06"/>';
    var logo = buildLogoParts(cfg, { mode: 'white' });
    var maxW = W * 0.56, maxH = H * 0.44;
    var s = Math.min(maxW / logo.w, maxH / logo.h, 1.6);
    var lx = spec.align === 'left' ? Math.round(W * 0.07) : (W - logo.w * s) / 2;
    var ly = (H - logo.h * s) / 2;
    inner += '<g transform="translate(' + lx.toFixed(1) + ',' + ly.toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
    var web = DB.company.contact.website;
    if (web) {
      inner += '<text x="' + W / 2 + '" y="' + Math.round(H * 0.93) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="' + Math.max(14, Math.round(H * 0.075)) + '" font-weight="500" fill="#ffffff" fill-opacity="0.85" text-anchor="middle" letter-spacing="3">' + escXml(web) + '</text>';
    }
    if (spec.safe) {
      inner += '<rect x="' + spec.safe.x + '" y="' + spec.safe.y + '" width="' + spec.safe.w + '" height="' + spec.safe.h + '" fill="none" stroke="#ffffff" stroke-opacity="0.2" stroke-dasharray="12 12" stroke-width="2"/>';
    }
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  function buildInstagramPost(cfg, story) {
    var W = 1080, H = story ? 1920 : 1080;
    var inner = brandGradientBg(cfg, W, H, 'bsgIg');
    inner += '<circle cx="' + (story ? 120 : 940) + '" cy="' + (story ? 400 : 1000) + '" r="' + (story ? 220 : 360) + '" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="26"/>';
    inner += '<circle cx="' + (story ? 970 : 120) + '" cy="' + (story ? 1720 : 100) + '" r="' + (story ? 300 : 200) + '" fill="#ffffff" fill-opacity="0.06"/>';
    var logo = buildLogoParts(cfg, { mode: 'white' });
    if (story) {
      var s1 = Math.min(620 / logo.w, 130 / logo.h, 1.2);
      inner += '<g transform="translate(' + ((W - logo.w * s1) / 2).toFixed(1) + ',80) scale(' + s1.toFixed(3) + ')">' + logo.inner + '</g>';
      var headline = cfg.tagline || cfg.name;
      var f1 = fitFontSize(headline, cfg.nameFont, 700, 92, W * 0.8);
      inner += '<text x="' + W / 2 + '" y="' + Math.round(H * 0.42) + '" font-family="' + fontStack(cfg.nameFont) + '" font-size="' + f1 + '" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="2">' + escXml(headline) + '</text>';
      inner += '<rect x="' + (W - 380) / 2 + '" y="' + Math.round(H * 0.82) + '" width="380" height="118" rx="59" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="4"/>'
        + '<text x="' + W / 2 + '" y="' + Math.round(H * 0.82 + 72) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="40" font-weight="600" fill="#ffffff" text-anchor="middle">Learn more</text>';
    } else {
      var s2 = Math.min(680 / logo.w, 110 / logo.h, 1.3);
      inner += '<g transform="translate(80,80) scale(' + s2.toFixed(3) + ')">' + logo.inner + '</g>';
      var head2 = cfg.tagline || cfg.name;
      var f2 = fitFontSize(head2, cfg.nameFont, 700, 84, W * 0.8);
      inner += '<text x="' + W / 2 + '" y="' + Math.round(H * 0.56) + '" font-family="' + fontStack(cfg.nameFont) + '" font-size="' + f2 + '" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="2">' + escXml(head2) + '</text>';
      if (DB.company.contact.website) {
        inner += '<text x="' + W / 2 + '" y="' + Math.round(H * 0.93) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="40" font-weight="600" fill="#ffffff" fill-opacity="0.85" text-anchor="middle" letter-spacing="3">' + escXml(DB.company.contact.website) + '</text>';
      }
    }
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  function buildNewsletterHeader(cfg) {
    return buildSocialCover(cfg, { w: 600, h: 200, align: 'center', safe: null });
  }

  function buildWhatsAppCatalog(cfg) {
    var S = 800;
    var inner = brandGradientBg(cfg, S, S, 'bsgWa');
    inner += '<rect x="50" y="50" width="' + (S - 100) + '" height="' + (S - 100) + '" rx="40" fill="none" stroke="#ffffff" stroke-opacity="0.3" stroke-width="4" stroke-dasharray="14 10"/>';
    var logo = buildLogoParts(cfg, { mode: 'white' });
    var s = Math.min(520 / logo.w, 170 / logo.h, 1.2);
    inner += '<g transform="translate(' + ((S - logo.w * s) / 2).toFixed(1) + ',' + ((S - logo.h * s) / 2 - 40).toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
    if (cfg.tagline) {
      var f = fitFontSize(cfg.tagline, cfg.tagFont, 500, 36, S * 0.72);
      inner += '<text x="' + S / 2 + '" y="' + (S - 170) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="' + f + '" font-weight="500" fill="#ffffff" fill-opacity="0.9" text-anchor="middle">' + escXml(cfg.tagline) + '</text>';
    }
    return { svg: wrapSvg(inner, S, S), inner: inner, w: S, h: S };
  }

  function buildEmailTemplate(cfg) {
    var header = buildNewsletterHeader(cfg);
    var imgSrc = cfg.source === 'upload' && cfg.uploadUrl ? cfg.uploadUrl : dataUriSvg(header.svg);
    var c = DB.company, ct = c.contact || {};
    var footerBits = [ct.address, ct.phone, ct.email].filter(Boolean).join(' &nbsp;·&nbsp; ');
    var html = '<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f5fa" style="background:#f4f5fa;font-family:Arial,Helvetica,sans-serif">'
      + '<tr><td align="center" style="padding:24px 12px">'
      + '<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e9f2">'
      + '<tr><td><img src="' + escHtml(imgSrc) + '" width="600" alt="' + escHtml(c.name || '') + '" style="display:block;width:100%;height:auto;border:0"></td></tr>'
      + '<tr><td style="padding:34px 38px">'
      + '<h1 style="margin:0 0 12px;font-size:24px;color:#0f172a">Newsletter title goes here</h1>'
      + '<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#475569">Hello,</p>'
      + '<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#475569">Replace this text with your message content. Keep it short and friendly — and use the brand button below for the main call to action.</p>'
      + '<p style="margin:24px 0 0"><a href="#" style="display:inline-block;background:' + cfg.primary + ';color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:13px 28px;border-radius:9px">Call to action</a></p>'
      + '</td></tr>'
      + '<tr><td style="background:' + cfg.primary + ';padding:20px 38px;text-align:center">'
      + '<div style="color:#ffffff;font-size:12px;font-weight:bold;letter-spacing:1px">' + escHtml(c.name || '') + '</div>'
      + (footerBits ? '<div style="color:rgba(255,255,255,.85);font-size:11px;margin-top:4px">' + escHtml(footerBits) + '</div>' : '')
      + '<div style="color:rgba(255,255,255,.6);font-size:10px;margin-top:8px">You received this email because you subscribed. <a href="#" style="color:#ffffff">Unsubscribe</a></div>'
      + '</td></tr>'
      + '</table></td></tr></table>';
    return html;
  }

  function buildReviewSheet(cfg) {
    var W = 1240, H = 1754;
    var c = DB.company, ct = c.contact || {};
    var pal = effectivePalette();
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';
    inner += '<rect x="0" y="0" width="' + W + '" height="130" fill="' + cfg.primary + '"/>';
    inner += '<text x="60" y="62" font-family="' + fontStack(cfg.tagFont) + '" font-size="30" font-weight="700" fill="#ffffff" letter-spacing="1">LOGO SYSTEM — REVIEW SHEET</text>';
    inner += '<text x="60" y="102" font-family="' + fontStack(cfg.tagFont) + '" font-size="20" font-weight="500" fill="#ffffff" fill-opacity="0.9">' + escXml(cfg.name) + (cfg.tagline ? '  —  ' + escXml(cfg.tagline) : '') + '</text>';
    var today = new Date();
    var dateStr = today.toISOString().slice(0, 10);
    inner += '<text x="' + (W - 60) + '" y="70" font-family="' + fontStack(cfg.tagFont) + '" font-size="18" font-weight="500" fill="#ffffff" fill-opacity="0.85" text-anchor="end">' + dateStr + '</text>';

    var variants = [
      { t: 'Primary — horizontal', v: { mode: 'color' }, dark: false },
      { t: 'Stacked', v: { layout: 'stacked', mode: 'color' }, dark: false },
      { t: 'Mark', v: { layout: 'mark', mode: 'color' }, dark: false },
      { t: 'Mono — black', v: { mode: 'black' }, dark: false },
      { t: 'Mono — white', v: { mode: 'white' }, dark: true },
      { t: 'Reversed', v: { mode: 'white', bg: true }, dark: false }
    ];
    var cw = 548, ch = 300, gx = 24, gy = 24, x0 = 60, y0 = 170;
    variants.forEach(function (item, i) {
      var col = i % 2, row = Math.floor(i / 2);
      var cx = x0 + col * (cw + gx), cy = y0 + row * (ch + gy);
      inner += '<rect x="' + cx + '" y="' + cy + '" width="' + cw + '" height="' + ch + '" rx="16" fill="' + (item.dark ? '#0f172a' : '#ffffff') + '" stroke="#dbe2ee" stroke-width="1.5"/>';
      var logo = buildLogoParts(cfg, item.v);
      var s = Math.min((cw - 70) / logo.w, (ch - 80) / logo.h);
      inner += '<g transform="translate(' + (cx + (cw - logo.w * s) / 2).toFixed(1) + ',' + (cy + (ch - 70 - logo.h * s) / 2 + 14).toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
      inner += '<text x="' + (cx + 24) + '" y="' + (cy + ch - 20) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="15" font-weight="600" fill="' + (item.dark ? '#94a3b8' : '#64748b') + '">' + escXml(item.t) + '</text>';
    });

    var py = y0 + 3 * (ch + gy) + 34;
    inner += '<text x="60" y="' + py + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="22" font-weight="700" fill="#0f172a">Color palette</text>';
    var swatches = [
      { hex: cfg.primary, name: 'Primary' },
      { hex: cfg.text, name: 'Text' },
      { hex: cfg.tag, name: 'Secondary' },
      { hex: cfg.bg, name: 'Brand BG' },
      { hex: pal.accent, name: 'Accent' }
    ];
    var swW = 208, swGap = 18, swH = 80;
    swatches.forEach(function (sw, i) {
      var sx = 60 + i * (swW + swGap);
      inner += '<rect x="' + sx + '" y="' + (py + 18) + '" width="' + swW + '" height="' + swH + '" rx="12" fill="' + sw.hex + '" stroke="#e2e8f0" stroke-width="1.5"/>';
      inner += '<text x="' + (sx + swW / 2) + '" y="' + (py + 18 + swH + 24) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="15" font-weight="700" fill="#334155" text-anchor="middle">' + sw.hex.toUpperCase() + '</text>';
      inner += '<text x="' + (sx + swW / 2) + '" y="' + (py + 18 + swH + 46) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="14" font-weight="500" fill="#64748b" text-anchor="middle">' + escXml(sw.name) + '</text>';
    });

    var ty = py + 18 + swH + 100;
    inner += '<text x="60" y="' + ty + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="22" font-weight="700" fill="#0f172a">Typography</text>';
    inner += '<text x="60" y="' + (ty + 46) + '" font-family="' + fontStack(cfg.nameFont) + '" font-size="40" font-weight="700" fill="#0f172a">Aa Bb Cc 123 — ' + (FONTS[cfg.nameFont] || FONTS.poppins).label + '</text>';
    inner += '<text x="60" y="' + (ty + 92) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="30" font-weight="500" fill="#475569">Aa Bb Cc 123 — ' + (FONTS[cfg.tagFont] || FONTS.inter).label + '</text>';

    var cy = ty + 150;
    var contactBits = [ct.person, ct.email, ct.phone, ct.website, ct.address].filter(Boolean).join('   •   ');
    if (contactBits) {
      inner += '<text x="60" y="' + cy + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="16" font-weight="500" fill="#64748b">' + escXml(contactBits) + '</text>';
    }
    inner += '<text x="' + W / 2 + '" y="' + (H - 40) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="13" font-weight="500" fill="#94a3b8" text-anchor="middle">Generated by Brand Set Generator — review and approve each lockup above.</text>';
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  /* ---------- Phase 3 helpers ---------- */
  function rgbToCmyk(hex) {
    var c = hexToRgb(hex);
    var r = c.r / 255, g = c.g / 255, b = c.b / 255;
    var k = 1 - Math.max(r, g, b);
    if (k >= 0.995) return 'C 0 · M 0 · Y 0 · K 100';
    var cc = Math.round((1 - r - k) / (1 - k) * 100);
    var mm = Math.round((1 - g - k) / (1 - k) * 100);
    var yy = Math.round((1 - b - k) / (1 - k) * 100);
    return 'C ' + cc + ' · M ' + mm + ' · Y ' + yy + ' · K ' + Math.round(k * 100);
  }

  function cropMarks(inner, x, y, w, h, len) {
    var L = len || 22;
    var pts = [[x, y, x - L, y], [x, y, x, y - L], [x + w, y, x + w + L, y], [x + w, y, x + w, y - L],
               [x, y + h, x - L, y + h], [x, y + h, x, y + h + L], [x + w, y + h, x + w + L, y + h], [x + w, y + h, x + w, y + h + L]];
    pts.forEach(function (p) {
      inner += '<line x1="' + p[0] + '" y1="' + p[1] + '" x2="' + p[2] + '" y2="' + p[3] + '" stroke="#334155" stroke-width="2"/>';
    });
    return inner;
  }

  function vcardText() {
    var c = DB.company, ct = c.contact || {};
    var org = (c.legalName || '').trim() || (c.name || '').trim();
    return ['BEGIN:VCARD', 'VERSION:3.0',
      'N:' + (ct.person || '').trim() + ';;;;',
      'FN:' + (ct.person || '').trim(),
      'ORG:' + org,
      'TITLE:' + (ct.title || '').trim(),
      'TEL;TYPE=WORK:' + (ct.phone || '').trim(),
      'EMAIL:' + (ct.email || '').trim(),
      'URL:' + (ct.website || '').trim(),
      'ADR;TYPE=WORK:;;' + (ct.address || '').trim() + ';;;;',
      'END:VCARD'].join('\n');
  }

  function buildQrInner(text, size) {
    if (typeof qrcode !== 'function') return '';
    try {
      var qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      var count = qr.getModuleCount();
      var qz = 4;
      var m = size / (count + qz * 2);
      var out = '<rect x="0" y="0" width="' + size.toFixed(1) + '" height="' + size.toFixed(1) + '" rx="' + (size * 0.06).toFixed(1) + '" fill="#ffffff"/>';
      for (var r = 0; r < count; r++) {
        for (var c2 = 0; c2 < count; c2++) {
          if (qr.isDark(r, c2)) {
            out += '<rect x="' + ((c2 + qz) * m).toFixed(2) + '" y="' + ((r + qz) * m).toFixed(2) + '" width="' + m.toFixed(2) + '" height="' + m.toFixed(2) + '" fill="#0f172a"/>';
          }
        }
      }
      return out;
    } catch (e) { return ''; }
  }

  /* ---------- P3-01 Print-ready cards (bleed + crop marks + CMYK) ---------- */
  function buildCardPrintSheet(cfg) {
    var W = 1240, H = 1500;
    var ct = DB.company.contact || {};
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#f8fafc"/>';
    inner += '<text x="60" y="54" font-family="' + fontStack(cfg.tagFont) + '" font-size="26" font-weight="700" fill="#0f172a">PRINT-READY BUSINESS CARDS</text>';
    inner += '<text x="60" y="84" font-family="' + fontStack(cfg.tagFont) + '" font-size="15" font-weight="500" fill="#64748b">3.5 × 2 in at 300dpi with 0.125 in bleed and crop marks. Approximate CMYK values below.</text>';

    var cardW = 1050, cardH = 600, bleed = 38;
    function placeCard(cardInner, x, y, caption) {
      inner += '<rect x="' + x + '" y="' + y + '" width="' + (cardW + bleed * 2) + '" height="' + (cardH + bleed * 2) + '" fill="' + cfg.primary + '"/>';
      inner += '<rect x="' + (x + bleed) + '" y="' + (y + bleed) + '" width="' + cardW + '" height="' + cardH + '" fill="#ffffff"/>';
      inner += '<g transform="translate(' + (x + bleed) + ',' + (y + bleed) + ')">' + cardInner + '</g>';
      inner += '<rect x="' + (x + bleed) + '" y="' + (y + bleed) + '" width="' + cardW + '" height="' + cardH + '" fill="none" stroke="#94a3b8" stroke-dasharray="8 8" stroke-width="2"/>';
      cropMarks(inner, x, y, cardW + bleed * 2, cardH + bleed * 2, 24);
      inner += '<text x="' + (x + cardW / 2) + '" y="' + (y + cardH + bleed * 2 + 34) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="15" font-weight="700" fill="#334155" text-anchor="middle">' + escXml(caption) + '</text>';
    }

    var front = buildCardFront(cfg);
    var back = buildCardBack(cfg);
    placeCard(front.inner, 56, 104, 'FRONT — trim at the dashed line, bleed extends to the color edge');
    placeCard(back.inner, 56, 104 + 676 + 48, 'BACK');

    var py = 104 + 2 * (676 + 48) - 10;
    inner += '<text x="60" y="' + py + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="22" font-weight="700" fill="#0f172a">Approximate CMYK values</text>';
    inner += '<text x="60" y="' + (py + 26) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="13" font-weight="500" fill="#94a3b8">RGB → CMYK conversion is approximate — confirm with your printer for exact spot colors.</text>';
    var swatches = [
      { hex: cfg.primary, name: 'Primary' },
      { hex: cfg.text, name: 'Text' },
      { hex: cfg.tag, name: 'Secondary' },
      { hex: cfg.bg, name: 'Brand BG' }
    ];
    swatches.forEach(function (sw, i) {
      var sx = 60 + i * 290;
      inner += '<rect x="' + sx + '" y="' + (py + 44) + '" width="240" height="70" rx="10" fill="' + sw.hex + '" stroke="#e2e8f0" stroke-width="1.5"/>';
      inner += '<text x="' + (sx + 12) + '" y="' + (py + 78) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="15" font-weight="700" fill="' + contrastOn(sw.hex) + '">' + sw.hex.toUpperCase() + '</text>';
      inner += '<text x="' + (sx + 12) + '" y="' + (py + 144) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="13" font-weight="700" fill="#334155">' + escXml(sw.name) + '</text>';
      inner += '<text x="' + (sx + 12) + '" y="' + (py + 168) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="12" font-weight="500" fill="#64748b">' + rgbToCmyk(sw.hex) + '</text>';
    });
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  /* ---------- P3-02 Office document suite ---------- */
  function buildInvoiceHeader(cfg) {
    var W = 1240, H = 360;
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';
    inner += '<circle cx="1140" cy="60" r="180" fill="none" stroke="' + cfg.primary + '" stroke-opacity="0.08" stroke-width="26"/>';
    var logo = buildLogoParts(cfg, { layout: 'horizontal', mode: 'color' });
    var s = Math.min(460 / logo.w, 110 / logo.h);
    inner += '<g transform="translate(70,' + ((H - logo.h * s) / 2).toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
    inner += '<text x="700" y="160" font-family="' + fontStack(cfg.nameFont) + '" font-size="72" font-weight="700" fill="' + cfg.text + '" text-anchor="middle">INVOICE</text>';
    inner += '<text x="700" y="210" font-family="' + fontStack(cfg.tagFont) + '" font-size="20" font-weight="500" fill="' + cfg.tag + '" text-anchor="middle" letter-spacing="3">NO. 0000 &nbsp;·&nbsp; DATE: ' + new Date().toISOString().slice(0, 10) + '</text>';
    inner += '<rect x="0" y="' + (H - 12) + '" width="' + W + '" height="12" fill="' + cfg.primary + '"/>';
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  function buildProposalCover(cfg) {
    var W = 1240, H = 1754;
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';
    inner += '<rect x="0" y="0" width="' + W + '" height="14" fill="' + cfg.primary + '"/>';
    inner += '<circle cx="' + (W / 2) + '" cy="470" r="300" fill="' + cfg.primary + '" fill-opacity="0.05"/>';
    var logo = buildLogoParts(cfg, { layout: 'stacked', mode: 'color' });
    var s = Math.min(420 / logo.w, 220 / logo.h, 1.2);
    inner += '<g transform="translate(' + ((W - logo.w * s) / 2).toFixed(1) + ',320) scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
    inner += '<rect x="' + (W / 2 - 70) + '" y="640" width="140" height="6" rx="3" fill="' + cfg.primary + '"/>';
    inner += '<text x="' + W / 2 + '" y="760" font-family="' + fontStack(cfg.nameFont) + '" font-size="64" font-weight="700" fill="' + cfg.text + '" text-anchor="middle" letter-spacing="4">BUSINESS PROPOSAL</text>';
    inner += '<text x="' + W / 2 + '" y="830" font-family="' + fontStack(cfg.tagFont) + '" font-size="24" font-weight="500" fill="' + cfg.tag + '" text-anchor="middle">Prepared for [CLIENT NAME]</text>';
    inner += '<text x="' + W / 2 + '" y="1560" font-family="' + fontStack(cfg.tagFont) + '" font-size="18" font-weight="500" fill="#94a3b8" text-anchor="middle">' + escXml(new Date().toISOString().slice(0, 10)) + ' · ' + escXml(cfg.name) + '</text>';
    inner += '<rect x="0" y="' + (H - 56) + '" width="' + W + '" height="56" fill="' + cfg.primary + '"/>';
    var foot = [DB.company.contact.website, DB.company.contact.email].filter(Boolean).join('   •   ');
    if (foot) inner += '<text x="' + W / 2 + '" y="' + (H - 22) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="16" font-weight="500" fill="#ffffff" text-anchor="middle">' + escXml(foot) + '</text>';
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  function buildPptTitleSlide(cfg) {
    var W = 1920, H = 1080;
    var inner = brandGradientBg(cfg, W, H, 'bsgPpt');
    inner += '<circle cx="1680" cy="160" r="360" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="30"/>';
    inner += '<circle cx="150" cy="1050" r="260" fill="#ffffff" fill-opacity="0.06"/>';
    var logo = buildLogoParts(cfg, { mode: 'white' });
    var s = Math.min(620 / logo.w, 120 / logo.h, 1.2);
    inner += '<g transform="translate(90,70) scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
    inner += '<text x="90" y="560" font-family="' + fontStack(cfg.nameFont) + '" font-size="104" font-weight="700" fill="#ffffff" letter-spacing="2">Presentation title</text>';
    inner += '<text x="94" y="650" font-family="' + fontStack(cfg.tagFont) + '" font-size="34" font-weight="500" fill="#ffffff" fill-opacity="0.85">Subtitle goes here</text>';
    inner += '<rect x="94" y="700" width="140" height="8" rx="4" fill="#ffffff" fill-opacity="0.5"/>';
    inner += '<text x="' + (W - 90) + '" y="' + (H - 70) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="22" font-weight="500" fill="#ffffff" fill-opacity="0.7" text-anchor="end">' + escXml(cfg.name) + ' · ' + new Date().toISOString().slice(0, 10) + '</text>';
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  function buildGdocHeader(cfg) {
    var W = 1600, H = 400;
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';
    inner += '<circle cx="1460" cy="60" r="200" fill="' + cfg.primary + '" fill-opacity="0.05"/>';
    var logo = buildLogoParts(cfg, { layout: 'horizontal', mode: 'color' });
    var s = Math.min(520 / logo.w, 140 / logo.h, 1.3);
    inner += '<g transform="translate(80,' + ((H - logo.h * s) / 2).toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
    var rightBits = [DB.company.contact.website, DB.company.contact.email].filter(Boolean);
    rightBits.forEach(function (b, i) {
      inner += '<text x="' + (W - 80) + '" y="' + (H / 2 - 30 + i * 44) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="24" font-weight="600" fill="' + cfg.tag + '" text-anchor="end">' + escXml(b) + '</text>';
    });
    inner += '<rect x="0" y="' + (H - 14) + '" width="' + W + '" height="14" fill="' + cfg.primary + '"/>';
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  /* ---------- P3-03 Envelopes, labels & fax ---------- */
  function buildEnvelopeDl(cfg) {
    var W = 1300, H = 650;
    var ct = DB.company.contact || {};
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fbfcfe"/>';
    inner += '<rect x="20" y="20" width="' + (W - 40) + '" height="' + (H - 40) + '" fill="none" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="10 8"/>';
    var logo = buildLogoParts(cfg, { layout: 'horizontal', mode: 'color' });
    var s = Math.min(300 / logo.w, 66 / logo.h);
    inner += '<g transform="translate(70,70) scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
    var retBits = [ct.address, ct.website].filter(Boolean);
    retBits.forEach(function (b, i) {
      inner += '<text x="70" y="' + (180 + i * 30) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="17" font-weight="500" fill="#475569">' + escXml(b) + '</text>';
    });
    inner += '<rect x="1060" y="60" width="170" height="200" rx="10" fill="none" stroke="#cbd5e1" stroke-dasharray="8 8" stroke-width="2"/>';
    inner += '<text x="1145" y="170" font-family="' + fontStack(cfg.tagFont) + '" font-size="15" font-weight="700" fill="#94a3b8" text-anchor="middle">STAMP</text>';
    inner += '<rect x="620" y="250" width="500" height="250" rx="12" fill="#ffffff" stroke="#dbe2ee" stroke-width="2"/>';
    inner += '<text x="650" y="320" font-family="' + fontStack(cfg.tagFont) + '" font-size="26" font-weight="700" fill="#0f172a">[RECIPIENT NAME]</text>';
    inner += '<text x="650" y="370" font-family="' + fontStack(cfg.tagFont) + '" font-size="20" font-weight="500" fill="#475569">[STREET ADDRESS]</text>';
    inner += '<text x="650" y="410" font-family="' + fontStack(cfg.tagFont) + '" font-size="20" font-weight="500" fill="#475569">[CITY, POSTAL CODE]</text>';
    inner += '<rect x="0" y="' + (H - 12) + '" width="' + W + '" height="12" fill="' + cfg.primary + '"/>';
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  function buildMailingLabel(cfg) {
    var W = 700, H = 400;
    var ct = DB.company.contact || {};
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';
    inner += '<rect x="0" y="0" width="' + W + '" height="14" fill="' + cfg.primary + '"/>';
    var logo = buildLogoParts(cfg, { layout: 'horizontal', mode: 'color' });
    var s = Math.min(240 / logo.w, 52 / logo.h);
    inner += '<g transform="translate(40,46) scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
    var bits = [ct.address, ct.website].filter(Boolean);
    bits.forEach(function (b, i) {
      inner += '<text x="40" y="' + (140 + i * 26) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="15" font-weight="500" fill="#475569">' + escXml(b) + '</text>';
    });
    inner += '<rect x="380" y="70" width="280" height="200" rx="10" fill="#fbfcfe" stroke="#dbe2ee" stroke-width="2"/>';
    inner += '<text x="408" y="130" font-family="' + fontStack(cfg.tagFont) + '" font-size="20" font-weight="700" fill="#0f172a">[RECIPIENT]</text>';
    inner += '<text x="408" y="170" font-family="' + fontStack(cfg.tagFont) + '" font-size="15" font-weight="500" fill="#475569">[ADDRESS LINE 1]</text>';
    inner += '<text x="408" y="200" font-family="' + fontStack(cfg.tagFont) + '" font-size="15" font-weight="500" fill="#475569">[CITY, POSTAL CODE]</text>';
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  function buildFaxCover(cfg) {
    var W = 1240, H = 1754;
    var ct = DB.company.contact || {};
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';
    inner += '<rect x="0" y="0" width="' + W + '" height="150" fill="' + cfg.primary + '"/>';
    inner += '<text x="60" y="90" font-family="' + fontStack(cfg.nameFont) + '" font-size="44" font-weight="700" fill="#ffffff" letter-spacing="3">FAX COVER SHEET</text>';
    var logo = buildLogoParts(cfg, { mode: 'white' });
    var s = Math.min(300 / logo.w, 80 / logo.h);
    inner += '<g transform="translate(' + (W - 60 - logo.w * s).toFixed(1) + ',' + ((150 - logo.h * s) / 2).toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
    var fields = [
      { k: 'TO', v: '[RECIPIENT]' }, { k: 'FROM', v: ct.person || cfg.name }, { k: 'FAX NO.', v: '[FAX NUMBER]' },
      { k: 'DATE', v: new Date().toISOString().slice(0, 10) }, { k: 'PAGES', v: '[NUMBER]' }, { k: 'RE', v: '[SUBJECT]' }
    ];
    fields.forEach(function (f, i) {
      var col = i % 2, row = Math.floor(i / 2);
      var x = 60 + col * 575, y = 210 + row * 130;
      inner += '<rect x="' + x + '" y="' + y + '" width="560" height="100" rx="10" fill="#fbfcfe" stroke="#dbe2ee" stroke-width="1.5"/>';
      inner += '<text x="' + (x + 24) + '" y="' + (y + 38) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="14" font-weight="800" fill="' + cfg.primary + '" letter-spacing="2">' + f.k + '</text>';
      inner += '<text x="' + (x + 24) + '" y="' + (y + 74) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="20" font-weight="600" fill="#334155">' + escXml(f.v) + '</text>';
    });
    inner += '<text x="60" y="680" font-family="' + fontStack(cfg.tagFont) + '" font-size="14" font-weight="800" fill="' + cfg.primary + '" letter-spacing="2">MESSAGE / NOTES</text>';
    inner += '<rect x="60" y="700" width="' + (W - 120) + '" height="780" rx="10" fill="#fbfcfe" stroke="#dbe2ee" stroke-width="1.5"/>';
    for (var i = 1; i <= 10; i++) inner += '<line x1="90" y1="' + (760 + i * 64) + '" x2="' + (W - 90) + '" y2="' + (760 + i * 64) + '" stroke="#eef1f6" stroke-width="2"/>';
    var foot = [cfg.name, ct.website, ct.phone].filter(Boolean).join('   •   ');
    inner += '<text x="60" y="1560" font-family="' + fontStack(cfg.tagFont) + '" font-size="14" font-weight="500" fill="#94a3b8">' + escXml(foot) + '</text>';
    inner += '<text x="60" y="1600" font-family="' + fontStack(cfg.tagFont) + '" font-size="12" font-weight="500" fill="#cbd5e1">This fax may contain confidential information. If received in error, please notify the sender.</text>';
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  /* ---------- P3-05 ID badge & lanyard ---------- */
  function buildBadge(cfg, back) {
    var W = 1013, H = 638;
    var ct = DB.company.contact || {};
    var inner = '';
    if (!back) {
      inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" rx="28" fill="#ffffff" stroke="#dbe2ee" stroke-width="2"/>'
        + '<rect x="0" y="0" width="' + W + '" height="120" rx="28" fill="' + cfg.primary + '"/>'
        + '<rect x="0" y="60" width="' + W + '" height="60" fill="' + cfg.primary + '"/>';
      var logo = buildLogoParts(cfg, { mode: 'white' });
      var s = Math.min(360 / logo.w, 70 / logo.h);
      inner += '<g transform="translate(50,' + ((120 - logo.h * s) / 2).toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
      inner += '<text x="' + (W - 50) + '" y="66" font-family="' + fontStack(cfg.tagFont) + '" font-size="24" font-weight="700" fill="#ffffff" text-anchor="end">STAFF</text>';
      inner += '<circle cx="260" cy="380" r="150" fill="' + shade(cfg.primary, 0.82) + '" stroke="' + cfg.primary + '" stroke-width="4"/>';
      var mn = initials(ct.person || cfg.name);
      inner += '<text x="260" y="406" font-family="' + fontStack(cfg.nameFont) + '" font-size="80" font-weight="700" fill="' + cfg.primary + '" text-anchor="middle">' + escXml(mn) + '</text>';
      inner += '<text x="470" y="340" font-family="' + fontStack(cfg.nameFont) + '" font-size="52" font-weight="700" fill="' + cfg.text + '">' + escXml(ct.person || '[NAME]') + '</text>';
      inner += '<text x="470" y="392" font-family="' + fontStack(cfg.tagFont) + '" font-size="26" font-weight="600" fill="' + cfg.tag + '">' + escXml(ct.title || '[TITLE]') + '</text>';
      inner += '<text x="470" y="440" font-family="' + fontStack(cfg.tagFont) + '" font-size="22" font-weight="500" fill="#94a3b8">ID: 0001 &nbsp;·&nbsp; ' + escXml(new Date().toISOString().slice(0, 10)) + '</text>';
      inner += '<rect x="0" y="' + (H - 18) + '" width="' + W + '" height="18" rx="9" fill="' + cfg.primary + '"/>';
    } else {
      inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" rx="28" fill="' + cfg.primary + '"/>';
      var mark = buildLogoParts(cfg, { layout: 'mark', mode: 'white', shape: 'none' });
      var ms = Math.min(160 / mark.w, 160 / mark.h);
      inner += '<g transform="translate(' + ((W - mark.w * ms) / 2).toFixed(1) + ',70) scale(' + ms.toFixed(3) + ')">' + mark.inner + '</g>';
      inner += '<text x="' + W / 2 + '" y="300" font-family="' + fontStack(cfg.tagFont) + '" font-size="24" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="2">IF FOUND, PLEASE RETURN TO</text>';
      inner += '<text x="' + W / 2 + '" y="345" font-family="' + fontStack(cfg.tagFont) + '" font-size="20" font-weight="500" fill="#ffffff" fill-opacity="0.9" text-anchor="middle">' + escXml((ct.address || '') + (ct.phone ? '   ·   ' + ct.phone : '')) + '</text>';
      var bars = '';
      for (var bx = 0, bw = 0; bw < 720; bx++) {
        var w = [2, 3, 5, 1, 4, 2, 6, 2, 3][bx % 9];
        bars += '<rect x="' + (150 + bw) + '" y="400" width="' + w + '" height="110" fill="#ffffff"/>';
        bw += w + 4;
        if (bw > 720) break;
      }
      inner += bars;
      inner += '<text x="' + W / 2 + '" y="575" font-family="' + fontStack(cfg.tagFont) + '" font-size="18" font-weight="600" fill="#ffffff" fill-opacity="0.85" text-anchor="middle">' + escXml(DB.company.contact.website || cfg.name) + '</text>';
    }
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  function buildLanyard(cfg) {
    var W = 1240, H = 300;
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + cfg.primary + '"/>';
    var mark = buildLogoParts(cfg, { layout: 'mark', mode: 'white', shape: 'none' });
    for (var x = 60; x < W; x += 230) {
      var ms = Math.min(90 / mark.w, 90 / mark.h);
      inner += '<g opacity="0.14" transform="translate(' + x + ',' + ((H - mark.h * ms) / 2).toFixed(1) + ') scale(' + ms.toFixed(3) + ')">' + mark.inner + '</g>';
    }
    var logo = buildLogoParts(cfg, { mode: 'white' });
    var s = Math.min(340 / logo.w, 100 / logo.h, 1.1);
    inner += '<g transform="translate(' + ((W - logo.w * s) / 2).toFixed(1) + ',' + ((H - logo.h * s) / 2).toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
    inner += '<rect x="0" y="0" width="' + W + '" height="8" fill="#ffffff" fill-opacity="0.25"/>';
    inner += '<rect x="0" y="' + (H - 8) + '" width="' + W + '" height="8" fill="#ffffff" fill-opacity="0.25"/>';
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  /* ---------- P3-06 Swag — die-cut sticker sheet ---------- */
  function buildSwagStickers(cfg) {
    var W = 1240, H = 1754;
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#f8fafc"/>';
    inner += '<text x="60" y="60" font-family="' + fontStack(cfg.tagFont) + '" font-size="26" font-weight="700" fill="#0f172a">DIE-CUT STICKER SHEET</text>';
    inner += '<text x="60" y="90" font-family="' + fontStack(cfg.tagFont) + '" font-size="15" font-weight="500" fill="#64748b">Shapes show the cut line — send the vector to your sticker printer.</text>';
    var mark = buildLogoParts(cfg, { layout: 'mark', mode: 'white', shape: 'none' });
    var cells = [
      { x: 60, y: 130, shape: 'circle', bg: cfg.primary, fg: '#ffffff' },
      { x: 390, y: 130, shape: 'rounded', bg: cfg.primary, fg: '#ffffff' },
      { x: 720, y: 130, shape: 'circle', bg: '#ffffff', fg: cfg.primary },
      { x: 60, y: 460, shape: 'squircle', bg: '#ffffff', fg: cfg.primary },
      { x: 390, y: 460, shape: 'rounded', bg: '#ffffff', fg: cfg.primary },
      { x: 720, y: 460, shape: 'circle', bg: palDark(cfg), fg: '#ffffff' }
    ];
    function palDark(c) { return effectivePalette().dark; }
    cells.forEach(function (cell, i) {
      var cx = cell.x + 140, cy = cell.y + 140, r = 130;
      inner += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 16) + '" fill="none" stroke="#94a3b8" stroke-dasharray="10 8" stroke-width="2"/>';
      var shapeSvg;
      if (cell.shape === 'circle') shapeSvg = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + cell.bg + '"/>';
      else if (cell.shape === 'squircle') shapeSvg = '<rect x="' + (cx - r) + '" y="' + (cy - r) + '" width="' + r * 2 + '" height="' + r * 2 + '" rx="' + (r * 0.75) + '" fill="' + cell.bg + '"/>';
      else shapeSvg = '<rect x="' + (cx - r) + '" y="' + (cy - r) + '" width="' + r * 2 + '" height="' + r * 2 + '" rx="' + (r * 0.5) + '" fill="' + cell.bg + '"/>';
      inner += shapeSvg;
      var m2 = Object.assign({}, cfg, { primary: cell.fg, text: cell.fg, tag: cell.fg, bg: cell.fg });
      var mp = buildLogoParts(m2, { layout: 'mark', mode: 'color', shape: 'none' });
      var s = Math.min((r * 1.6) / mp.w, (r * 1.6) / mp.h);
      inner += '<g transform="translate(' + (cx - mp.w * s / 2).toFixed(1) + ',' + (cy - mp.h * s / 2).toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + mp.inner + '</g>';
    });
    inner += '<text x="60" y="900" font-family="' + fontStack(cfg.tagFont) + '" font-size="15" font-weight="500" fill="#94a3b8">Tip: export the mark and shapes as SVG and ask your printer for a kiss-cut line.</text>';
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  /* ---------- P3-07 Signage templates ---------- */
  function buildSignStorefront(cfg) {
    var W = 1920, H = 700;
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#eef2f7"/>';
    inner += '<rect x="0" y="600" width="' + W + '" height="100" fill="#dbe2ee"/>';
    inner += '<rect x="260" y="150" width="1400" height="340" rx="36" fill="' + cfg.primary + '"/>';
    inner += '<rect x="260" y="150" width="1400" height="340" rx="36" fill="none" stroke="' + shade(cfg.primary, -0.35) + '" stroke-width="6"/>';
    inner += '<rect x="310" y="200" width="1300" height="240" rx="20" fill="none" stroke="#ffffff" stroke-opacity="0.3" stroke-width="3"/>';
    var logo = buildLogoParts(cfg, { mode: 'white' });
    var s = Math.min(1150 / logo.w, 210 / logo.h, 1.6);
    inner += '<g transform="translate(' + ((W - logo.w * s) / 2).toFixed(1) + ',' + ((490 - logo.h * s) / 2).toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
    inner += '<rect x="400" y="500" width="180" height="90" rx="8" fill="#cbd5e1"/>';
    inner += '<rect x="1340" y="500" width="180" height="90" rx="8" fill="#cbd5e1"/>';
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  function buildSignDoor(cfg) {
    var W = 700, H = 1200;
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#eef2f7"/>';
    inner += '<rect x="80" y="60" width="540" height="1080" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-width="6"/>';
    inner += '<circle cx="500" cy="300" r="120" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="6"/>';
    inner += '<rect x="460" y="820" width="26" height="180" rx="13" fill="#cbd5e1"/>';
    var logo = buildLogoParts(cfg, { layout: 'stacked', mode: 'color' });
    var s = Math.min(400 / logo.w, 170 / logo.h, 1.2);
    inner += '<g transform="translate(' + ((W - logo.w * s) / 2).toFixed(1) + ',' + (470 - logo.h * s / 2).toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
    inner += '<text x="' + W / 2 + '" y="600" font-family="' + fontStack(cfg.tagFont) + '" font-size="22" font-weight="600" fill="' + cfg.primary + '" text-anchor="middle" letter-spacing="2">' + escXml(DB.company.contact.website || 'WELCOME') + '</text>';
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  function buildSignVehicle(cfg) {
    var W = 1920, H = 540;
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#eef2f7"/>';
    inner += '<rect x="60" y="60" width="1800" height="420" rx="26" fill="#ffffff" stroke="#cbd5e1" stroke-width="5"/>';
    inner += '<rect x="60" y="60" width="40" height="420" rx="20" fill="' + cfg.primary + '"/>';
    inner += '<circle cx="1700" cy="380" r="150" fill="' + cfg.primary + '" fill-opacity="0.06"/>';
    var logo = buildLogoParts(cfg, { layout: 'horizontal', mode: 'color' });
    var s = Math.min(760 / logo.w, 190 / logo.h, 1.5);
    inner += '<g transform="translate(180,' + ((270 - logo.h * s) / 2).toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
    if (cfg.tagline) {
      inner += '<text x="180" y="400" font-family="' + fontStack(cfg.tagFont) + '" font-size="28" font-weight="500" fill="' + cfg.tag + '" letter-spacing="2">' + escXml(cfg.tagline) + '</text>';
    }
    if (DB.company.contact.website) {
      inner += '<text x="1720" y="140" font-family="' + fontStack(cfg.tagFont) + '" font-size="30" font-weight="700" fill="' + cfg.primary + '" text-anchor="end">' + escXml(DB.company.contact.website) + '</text>';
      inner += '<text x="1720" y="186" font-family="' + fontStack(cfg.tagFont) + '" font-size="20" font-weight="500" fill="#64748b" text-anchor="end">' + escXml(DB.company.contact.phone || '') + '</text>';
    }
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  function buildCardFront(cfg) {
    var W = 1050, H = 600;
    var c = DB.company, ct = c.contact || {};
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>'
      + '<rect x="0" y="0" width="' + W + '" height="14" fill="' + cfg.primary + '"/>';
    var logo = buildLogoParts(cfg, { layout: 'horizontal', mode: 'color' });
    var s = Math.min(420 / logo.w, 130 / logo.h);
    inner += '<g transform="translate(70,96) scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
    inner += '<rect x="70" y="258" width="910" height="1.5" fill="#e2e8f0"/>';

    var person = (ct.person || '').trim() || cfg.name;
    var title = (ct.title || '').trim();
    inner += '<text x="70" y="340" font-family="' + fontStack(cfg.nameFont) + '" font-size="44" font-weight="700" fill="' + cfg.text + '" letter-spacing="0.5">' + escXml(person) + '</text>';
    var y = 388;
    if (title) { inner += '<text x="70" y="' + y + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="22" font-weight="500" fill="' + cfg.tag + '">' + escXml(title) + '</text>'; y += 34; }
    if (cfg.tagline) { inner += '<text x="70" y="' + y + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="19" font-weight="400" fill="' + cfg.tag + '" font-style="italic">' + escXml(cfg.tagline) + '</text>'; y += 32; }
    if (ct.website) { inner += '<text x="70" y="' + y + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="19" font-weight="600" fill="' + cfg.primary + '">' + escXml(ct.website) + '</text>'; }

    var rows = [];
    if (ct.email) rows.push({ icon: 'envelope', text: ct.email });
    if (ct.phone) rows.push({ icon: 'phone', text: ct.phone });
    if (ct.website) rows.push({ icon: 'globe', text: ct.website });
    if (ct.address) rows.push({ icon: 'pin', text: ct.address });
    var ry = 330;
    rows.forEach(function (row) {
      inner += uiIconSvg(row.icon, 590, ry - 12, 24, cfg.primary);
      inner += '<text x="628" y="' + ry + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="22" font-weight="500" fill="#334155">' + escXml(row.text) + '</text>';
      ry += 52;
    });
    var legalLine = (DB.company.legalName || '').trim();
    if (legalLine && legalLine.toLowerCase() !== cfg.name.toLowerCase()) {
      inner += '<text x="70" y="566" font-family="' + fontStack(cfg.tagFont) + '" font-size="13" font-weight="400" fill="#94a3b8">' + escXml(legalLine) + '</text>';
    }
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  function buildCardBack(cfg) {
    var W = 1050, H = 600;
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + cfg.primary + '"/>';
    inner += '<circle cx="370" cy="250" r="140" fill="' + shade(cfg.primary, 0.12) + '"/>';
    var mark = buildLogoParts(cfg, { layout: 'mark', mode: 'white', shape: 'none' });
    var s = Math.min(250 / mark.w, 250 / mark.h);
    inner += '<g transform="translate(' + (370 - mark.w * s / 2).toFixed(1) + ',' + (250 - mark.h * s / 2).toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + mark.inner + '</g>';
    if (DB.company.contact.website) {
      inner += '<text x="370" y="440" font-family="' + fontStack(cfg.tagFont) + '" font-size="21" font-weight="500" fill="#ffffff" fill-opacity="0.85" text-anchor="middle" letter-spacing="2">' + escXml(DB.company.contact.website) + '</text>';
    }
    var qr = buildQrInner(vcardText(), 190);
    if (qr) {
      inner += '<g transform="translate(790,385)">' + qr + '</g>';
      inner += '<text x="885" y="600" font-family="' + fontStack(cfg.tagFont) + '" font-size="14" font-weight="600" fill="#ffffff" fill-opacity="0.75" text-anchor="middle">SCAN TO SAVE CONTACT</text>';
    }
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  function buildLetterhead(cfg) {
    var W = 1240, H = 1754;
    var ct = DB.company.contact || {};
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';
    var logo = buildLogoParts(cfg, { layout: 'horizontal', mode: 'color' });
    var s = Math.min(460 / logo.w, 110 / logo.h);
    inner += '<g transform="translate(80,80) scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';

    var rlines = [];
    if (ct.person) rlines.push({ t: ct.person, b: true });
    if (ct.title) rlines.push({ t: ct.title, b: false });
    if (ct.email) rlines.push({ t: ct.email, b: false });
    if (ct.phone) rlines.push({ t: ct.phone, b: false });
    if (ct.website) rlines.push({ t: ct.website, b: false });
    if (ct.address) rlines.push({ t: ct.address, b: false });
    var ry = 104;
    rlines.forEach(function (l) {
      inner += '<text x="1160" y="' + ry + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="17" font-weight="' + (l.b ? 700 : 400) + '" fill="' + (l.b ? cfg.text : '#475569') + '" text-anchor="end">' + escXml(l.t) + '</text>';
      ry += 26;
    });

    inner += '<rect x="0" y="196" width="' + W + '" height="5" fill="' + cfg.primary + '"/>';
    inner += '<rect x="0" y="' + (H - 56) + '" width="' + W + '" height="56" fill="' + cfg.primary + '"/>';
    var legal = (DB.company.legalName || '').trim();
    var footBits = [legal ? '© ' + new Date().getFullYear() + ' ' + legal : null, ct.address, ct.website, ct.phone].filter(Boolean).join('   •   ');
    if (footBits) {
      inner += '<text x="' + W / 2 + '" y="' + (H - 26) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="16" font-weight="500" fill="#ffffff" fill-opacity="0.9" text-anchor="middle">' + escXml(footBits) + '</text>';
    }
    var mark = buildLogoParts(cfg, { layout: 'mark', mode: 'color', shape: 'none' });
    var ms = Math.min(440 / mark.w, 440 / mark.h);
    inner += '<g opacity="0.045" transform="translate(' + (760) + ',' + (1050) + ') scale(' + ms.toFixed(3) + ')">' + mark.inner + '</g>';
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  /* --------------------------------------------------------
     Email signature & guidelines
  -------------------------------------------------------- */
  function dataUriSvg(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function buildEmailSignature(cfg) {
    var c = DB.company, ct = c.contact || {};
    var logo = buildLogo(cfg, { mode: 'color' });
    var imgSrc = cfg.source === 'upload' && cfg.uploadUrl ? cfg.uploadUrl : dataUriSvg(logo.svg);
    var h = 56;
    var w = Math.max(1, Math.round(logo.w * (h / logo.h)));
    var line2 = [ct.title, c.name].filter(Boolean).join(' · ');
    var monogram = initials(ct.person || cfg.name);
    var contactBits = [];
    if (ct.phone) contactBits.push(escHtml(ct.phone));
    if (ct.email) contactBits.push('<a href="mailto:' + escHtml(ct.email) + '" style="color:#334155;text-decoration:none">' + escHtml(ct.email) + '</a>');
    if (ct.website) contactBits.push('<a href="http://' + escHtml(ct.website) + '" style="color:' + cfg.primary + ';text-decoration:none;font-weight:bold">' + escHtml(ct.website) + '</a>');
    var html = '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#334155">'
      + '<tr>'
      + '<td style="padding-right:14px;vertical-align:middle"><div style="width:56px;height:56px;border-radius:50%;background:' + cfg.primary + ';color:#ffffff;font-weight:bold;font-size:19px;text-align:center;line-height:56px;font-family:Arial,Helvetica,sans-serif">' + escHtml(monogram) + '</div></td>'
      + '<td style="padding-right:14px;vertical-align:middle"><img src="' + escHtml(imgSrc) + '" width="' + w + '" height="' + h + '" alt="' + escHtml(c.name) + '" style="display:block;border:0"></td>'
      + '<td style="border-left:2px solid ' + cfg.primary + ';padding-left:14px;vertical-align:middle">'
      + '<div style="font-size:15px;font-weight:bold;color:#0f172a">' + escHtml(ct.person || '') + '</div>'
      + (line2 ? '<div style="color:#64748b;margin-top:2px">' + escHtml(line2) + '</div>' : '')
      + (contactBits.length ? '<div style="margin-top:5px">' + contactBits.join(' &nbsp;•&nbsp; ') + '</div>' : '')
      + '</td></tr></table>';
    return html;
  }

  /* ---------- P4-05 Usage examples (do / don't) ---------- */
  function usageClearspaceSvg(cfg, ok) {
    var W = 300, H = 110;
    var logo = buildLogoParts(cfg, { layout: 'horizontal', mode: 'color' });
    var s = Math.min(170 / logo.w, 56 / logo.h, 1.2);
    var lw = logo.w * s, lh = logo.h * s;
    var x = (W - lw) / 2, y = (H - lh) / 2;
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';
    if (ok) {
      inner += '<rect x="' + (x - 24).toFixed(1) + '" y="' + (y - 18).toFixed(1) + '" width="' + (lw + 48).toFixed(1) + '" height="' + (lh + 36).toFixed(1) + '" rx="10" fill="none" stroke="' + cfg.primary + '" stroke-dasharray="5 4" stroke-opacity="0.55"/>';
      inner += '<text x="' + W / 2 + '" y="' + (H - 12) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="10" fill="#94a3b8" text-anchor="middle">Clear space = symbol height all around</text>';
    } else {
      inner += '<g transform="translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
      inner += '<text x="' + (x + lw * 0.62).toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="13" font-weight="700" fill="#ef4444">crowded text</text>';
    }
    return wrapSvg(inner, W, H);
  }
  function usageMinSizeSvg(cfg, ok) {
    var W = 300, H = 110;
    var mark = buildLogoParts(cfg, { layout: 'mark', mode: 'color', shape: 'none' });
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';
    var s = ok ? Math.min(48 / mark.w, 48 / mark.h) : Math.min(13 / mark.w, 13 / mark.h);
    inner += '<g transform="translate(' + ((W - mark.w * s) / 2).toFixed(1) + ',' + (ok ? 14 : 44).toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + mark.inner + '</g>';
    inner += '<text x="' + W / 2 + '" y="' + (ok ? 88 : 76) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="11" font-weight="' + (ok ? '700' : '500') + '" fill="' + (ok ? '#10b981' : '#ef4444') + '" text-anchor="middle">' + (ok ? 'Legible — stays above the 24 px minimum' : 'Too small — below the 24 px minimum') + '</text>';
    return wrapSvg(inner, W, H);
  }
  function usageBusyBgSvg(cfg, ok) {
    var W = 300, H = 110;
    var logo = buildLogoParts(cfg, { layout: 'horizontal', mode: 'color' });
    var s = Math.min(150 / logo.w, 42 / logo.h, 1.1);
    var lw = logo.w * s, lh = logo.h * s;
    var x = (W - lw) / 2, y = (H - lh) / 2;
    var inner = '<defs><pattern id="bsgUp" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#eef2f7"/><rect width="8" height="16" fill="' + shade(cfg.primary, 0.78) + '"/></pattern></defs>';
    inner += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="url(#bsgUp)"/>';
    if (ok) {
      inner += '<rect x="' + (x - 18).toFixed(1) + '" y="' + (y - 12).toFixed(1) + '" width="' + (lw + 36).toFixed(1) + '" height="' + (lh + 24).toFixed(1) + '" rx="10" fill="#ffffff" stroke="#e2e8f0"/>';
      inner += '<g transform="translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
      inner += '<text x="' + W / 2 + '" y="' + (H - 10) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="10" fill="#64748b" text-anchor="middle">White plate keeps the logo readable</text>';
    } else {
      inner += '<g transform="translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
      inner += '<text x="' + W / 2 + '" y="' + (H - 10) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="10" font-weight="700" fill="#ef4444" text-anchor="middle">Logo gets lost on busy patterns</text>';
    }
    return wrapSvg(inner, W, H);
  }
  function usagePanel(cfg, title, doSvg, dontSvg) {
    return '<div style="border:1px solid #e5e9f2;border-radius:10px;overflow:hidden">'
      + '<div style="padding:8px 12px;font-weight:700;font-size:12px;background:#fbfcfe;border-bottom:1px solid #e5e9f2">' + escHtml(title) + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr">'
      + '<div style="padding:8px;border-right:1px solid #e5e9f2"><div style="font-size:10px;font-weight:800;color:#10b981;margin-bottom:4px">✓ DO</div><img src="' + dataUriSvg(doSvg) + '" style="width:100%;display:block" alt=""></div>'
      + '<div style="padding:8px"><div style="font-size:10px;font-weight:800;color:#ef4444;margin-bottom:4px">✗ DON\'T</div><img src="' + dataUriSvg(dontSvg) + '" style="width:100%;display:block" alt=""></div>'
      + '</div></div>';
  }

  function guidelinesSectionHtml(cfg) {
    var c = DB.company, ct = c.contact || {};
    var pal = effectivePalette();
    var swatchDefs = [
      { hex: cfg.primary, name: 'Primary' },
      { hex: cfg.text, name: 'Text' },
      { hex: cfg.tag, name: 'Secondary' },
      { hex: cfg.bg, name: 'Brand BG' },
      { hex: pal.accent, name: 'Accent' }
    ];
    var g = [];
    g.push('<div style="border-top:1px solid #e5e9f2;padding:16px 0">'
      + '<h4 style="margin:0 0 12px;font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#4f46e5">Logo lockups</h4>'
      + '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">');
    var primary = buildLogo(cfg, { mode: 'color' });
    var stacked = buildLogo(cfg, { layout: 'stacked', mode: 'color' });
    var mark = buildLogo(cfg, { layout: 'mark', mode: 'color' });
    var mono = buildLogo(cfg, { mode: 'white' });
    g.push('<div style="border:1px solid #e5e9f2;border-radius:10px;padding:10px 12px;background:#fff"><img src="' + dataUriSvg(primary.svg) + '" style="height:44px;display:block" alt="Primary logo"></div>');
    g.push('<div style="border:1px solid #e5e9f2;border-radius:10px;padding:10px 12px;background:#fff"><img src="' + dataUriSvg(stacked.svg) + '" style="height:44px;display:block" alt="Stacked logo"></div>');
    g.push('<div style="border:1px solid #e5e9f2;border-radius:10px;padding:10px 12px;background:#fff"><img src="' + dataUriSvg(mark.svg) + '" style="height:44px;display:block" alt="Mark"></div>');
    g.push('<div style="border:1px solid #0f172a;border-radius:10px;padding:10px 12px;background:#0f172a"><img src="' + dataUriSvg(mono.svg) + '" style="height:44px;display:block" alt="Monochrome"></div>');
    g.push('</div></div>');

    g.push('<div style="border-top:1px solid #e5e9f2;padding:16px 0">'
      + '<h4 style="margin:0 0 12px;font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#4f46e5">Color palette</h4>'
      + '<div style="display:flex;flex-wrap:wrap;gap:10px">');
    swatchDefs.forEach(function (sw) {
      var textC = contrastOn(sw.hex);
      g.push('<div style="border:1px solid #e5e9f2;border-radius:10px;overflow:hidden;width:110px">'
        + '<div style="height:52px;background:' + sw.hex + '"></div>'
        + '<div style="padding:7px 10px;font-size:11px"><b style="display:block">' + escHtml(sw.name) + '</b>'
        + '<span style="color:#64748b">' + sw.hex.toUpperCase() + '</span></div></div>');
    });
    g.push('</div></div>');

    g.push('<div style="border-top:1px solid #e5e9f2;padding:16px 0">'
      + '<h4 style="margin:0 0 12px;font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#4f46e5">Typography</h4>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
      + '<div style="border:1px solid #e5e9f2;border-radius:10px;padding:14px;background:#fbfcfe"><div style="font-family:' + fontStack(cfg.nameFont) + ';font-size:22px;font-weight:700">Aa Bb Cc 123</div><div style="font-size:11px;color:#64748b;margin-top:4px">' + (FONTS[cfg.nameFont] || FONTS.poppins).label + ' — headings & name</div></div>'
      + '<div style="border:1px solid #e5e9f2;border-radius:10px;padding:14px;background:#fbfcfe"><div style="font-family:' + fontStack(cfg.tagFont) + ';font-size:22px;font-weight:500">Aa Bb Cc 123</div><div style="font-size:11px;color:#64748b;margin-top:4px">' + (FONTS[cfg.tagFont] || FONTS.inter).label + ' — body & tagline</div></div>'
      + '</div></div>');

    g.push('<div style="border-top:1px solid #e5e9f2;padding:16px 0">'
      + '<h4 style="margin:0 0 12px;font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#4f46e5">Usage rules</h4>'
      + '<ul style="margin:0;padding-left:18px;font-size:13px;color:#334155;line-height:1.9">'
      + '<li>Keep clear space around the logo equal to the height of the symbol.</li>'
      + '<li>Minimum size: 24&nbsp;px for the mark, 120&nbsp;px wide for the full logo.</li>'
      + '<li>Use the reversed (white) logo on dark or ' + cfg.primary + ' backgrounds.</li>'
      + '<li>Never stretch, rotate or recolor the logo.</li>'
      + '<li>Never place the logo on busy photographs without a white or dark plate.</li>'
      + '</ul></div>');

    g.push('<div style="border-top:1px solid #e5e9f2;padding:16px 0">'
      + '<h4 style="margin:0 0 12px;font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#4f46e5">Usage examples</h4>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px">'
      + usagePanel(cfg, 'Clear space', usageClearspaceSvg(cfg, true), usageClearspaceSvg(cfg, false))
      + usagePanel(cfg, 'Minimum size', usageMinSizeSvg(cfg, true), usageMinSizeSvg(cfg, false))
      + usagePanel(cfg, 'Busy backgrounds', usageBusyBgSvg(cfg, true), usageBusyBgSvg(cfg, false))
      + '</div></div>');

    g.push('<div style="border-top:1px solid #e5e9f2;padding:16px 0">'
      + '<h4 style="margin:0 0 12px;font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#4f46e5">Contact</h4>'
      + '<div style="font-size:13px;color:#334155;line-height:1.9">'
      + (ct.person ? '<b>' + escHtml(ct.person) + '</b>' + (ct.title ? ', ' + escHtml(ct.title) : '') + '<br>' : '')
      + (ct.email ? escHtml(ct.email) + '<br>' : '')
      + (ct.phone ? escHtml(ct.phone) + '<br>' : '')
      + (ct.website ? escHtml(ct.website) + '<br>' : '')
      + (ct.address ? escHtml(ct.address) : '')
      + ((c.legalName || '').trim() ? ((ct.address ? '<br>' : '') + '<b>Legal name:</b> ' + escHtml(c.legalName)) : '')
      + '</div></div>');
    return g.join('');
  }

  function buildGuidelinesDocHtml(cfg) {
    var c = DB.company;
    var brandName = (c.name || '').trim() || (c.legalName || '').trim() || DEFAULT_NAME;
    return '<div style="font-family:Inter,Arial,sans-serif;color:#0f172a;max-width:800px;margin:0 auto;padding:20px 10px">'
      + '<div style="display:flex;align-items:center;gap:14px;padding-bottom:16px;border-bottom:3px solid ' + cfg.primary + '">'
      + '<div style="width:46px;height:46px;border-radius:12px;background:' + cfg.primary + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px">' + escHtml(brandName.charAt(0).toUpperCase()) + '</div>'
      + '<div><h1 style="margin:0;font-size:22px;font-weight:800">' + escHtml(brandName) + ' — Brand Guidelines</h1>'
      + '<div style="color:#64748b;font-size:13px">' + escHtml(c.tagline || '') + (c.industry ? ' &nbsp;·&nbsp; ' + escHtml(c.industry) : '') + '</div></div>'
      + '</div>'
      + guidelinesSectionHtml(cfg)
      + '<div style="border-top:1px solid #e5e9f2;padding:14px 0;text-align:center;color:#94a3b8;font-size:11px">Generated by Brand Set Generator</div>'
      + '</div>';
  }

  function buildBrandSummary(cfg) {
    var c = DB.company, ct = c.contact || {};
    var pal = effectivePalette();
    var brandName = (c.name || '').trim() || (c.legalName || '').trim() || DEFAULT_NAME;
    var lines = [];
    lines.push('BRAND SUMMARY — ' + brandName);
    lines.push('================================');
    lines.push('Brand: ' + brandName);
    if ((c.legalName || '').trim() && (c.legalName || '').trim().toLowerCase() !== brandName.toLowerCase()) lines.push('Legal name: ' + c.legalName);
    if (c.tagline) lines.push('Tagline: ' + c.tagline);
    lines.push('Industry: ' + (c.industry || '-'));
    lines.push('Personality: ' + (c.personality || []).join(', '));
    lines.push('');
    lines.push('COLORS');
    lines.push('  Primary   ' + cfg.primary);
    lines.push('  Text      ' + cfg.text);
    lines.push('  Tagline   ' + cfg.tag);
    lines.push('  Brand BG  ' + cfg.bg);
    lines.push('  Accent    ' + pal.accent);
    lines.push('  Light     ' + pal.light);
    lines.push('');
    lines.push('TYPOGRAPHY');
    lines.push('  Name font: ' + (FONTS[cfg.nameFont] || FONTS.poppins).label);
    lines.push('  Tagline font: ' + (FONTS[cfg.tagFont] || FONTS.inter).label);
    lines.push('');
    lines.push('LOGO');
    lines.push('  Layout: ' + cfg.layout + ' · Symbol: ' + (cfg.symbol === 'none' ? 'none' : cfg.symbol));
    if (ct.website) lines.push('  Web: ' + ct.website);
    return lines.join('\n');
  }

  /* --------------------------------------------------------
     Brand manifest (JSON for other applications)
  -------------------------------------------------------- */
  function brandManifest(withTimestamp) {
    var cfg = logoCfg();
    var c = DB.company;
    var pal = effectivePalette();
    var colors = logoColors();
    var m = {
      schemaVersion: 1,
      generator: 'BrandSetGenerator',
      company: {
        legalName: (c.legalName || '').trim(),
        brandName: (c.name || '').trim() || (c.legalName || '').trim(),
        tagline: (c.tagline || '').trim(),
        industry: c.industry || '',
        personality: (c.personality || []).slice()
      },
      brand: {
        colors: {
          primary: colors.primary,
          text: colors.text,
          tagline: colors.tag,
          badgeBg: colors.bg,
          accent: pal.accent,
          light: pal.light,
          dark: pal.dark,
          muted: pal.muted,
          palette: [pal.brand, pal.accent, pal.muted, pal.light, pal.dark]
        },
        typography: {
          nameFont: { id: cfg.nameFont, label: (FONTS[cfg.nameFont] || FONTS.poppins).label, family: fontStack(cfg.nameFont) },
          taglineFont: { id: cfg.tagFont, label: (FONTS[cfg.tagFont] || FONTS.inter).label, family: fontStack(cfg.tagFont) }
        },
        logo: {
          source: cfg.source,
          layout: cfg.layout,
          symbol: cfg.symbol,
          iconId: cfg.iconId || null,
          monogram: cfg.monogram || null,
          shape: cfg.shape,
          uppercase: cfg.uppercase,
          tracking: cfg.tracking,
          uploadUrl: cfg.source === 'upload' ? cfg.uploadUrl : null
        }
      },
      contact: Object.assign({}, c.contact),
      assets: makeAssets(cfg).map(function (a) {
        var formats = ['svg', 'png'];
        if (a.webp) formats.push('webp');
        if (a.icoSizes) formats.push('ico');
        if (a.id === 'email-signature' || a.id === 'contrast-checker' || a.id === 'favicon-snippet') formats = ['html'];
        if (a.id === 'brand-summary') formats = ['txt'];
        if (a.id === 'brand-json') formats = ['json'];
        return { id: a.id, title: a.title, group: a.group, formats: formats };
      })
    };
    if (withTimestamp !== false) m.generatedAt = new Date().toISOString();
    return m;
  }

  function groupLabel(gid) {
    for (var i = 0; i < ASSET_GROUPS.length; i++) {
      if (ASSET_GROUPS[i].id === gid) return ASSET_GROUPS[i].label;
    }
    return 'Assets';
  }

  /* --------------------------------------------------------
     P4 — Motion, Accessibility & Quality
  -------------------------------------------------------- */

  /* ---------- P4-01 Animated logo intro (SMIL) ---------- */
  function buildAnimatedIntro(cfg) {
    var W = 800, H = 450;
    function introInner(animated) {
      var mark = buildLogoParts(cfg, { layout: 'mark', shape: 'none', mode: 'color' });
      var nameStr = cfg.uppercase ? cfg.name.toUpperCase() : cfg.name;
      var showTag = cfg.showTagline && !!cfg.tagline;
      var ms = Math.min(150 / mark.w, 150 / mark.h, 1);
      var nameY = showTag ? 292 : 310;
      var tagY = 342;
      var barY = showTag ? 384 : 354;
      var barW = 200, barX = (W - barW) / 2;
      var inner = '';
      inner += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#f8fafc"/>';
      inner += '<circle cx="700" cy="70" r="170" fill="' + cfg.primary + '" opacity="0.07"/>';
      inner += '<circle cx="90" cy="410" r="130" fill="' + cfg.primary + '" opacity="0.06"/>';
      // mark — spring scale + fade in
      inner += '<g transform="translate(' + (W / 2).toFixed(1) + ',175)">'
        + '<g opacity="' + (animated ? '0' : '1') + '" transform="scale(' + (animated ? '0.5' : '1') + ')">'
        + (animated
          ? '<animate attributeName="opacity" from="0" to="1" dur="0.45s" begin="0.05s;click" fill="freeze" restart="always"/>'
            + '<animateTransform attributeName="transform" type="scale" values="0.5;1.12;1" keyTimes="0;0.72;1" dur="0.9s" begin="0.05s;click" fill="freeze" restart="always" calcMode="spline" keySplines="0.16 1 0.3 1;0.16 1 0.3 1"/>'
          : '')
        + '<g transform="translate(' + (-mark.w * ms / 2).toFixed(1) + ',' + (-mark.h * ms / 2).toFixed(1) + ') scale(' + ms.toFixed(3) + ')">' + mark.inner + '</g>'
        + '</g></g>';
      // wordmark — slide up + fade in
      inner += '<g opacity="' + (animated ? '0' : '1') + '">'
        + (animated
          ? '<animate attributeName="opacity" from="0" to="1" dur="0.6s" begin="0.55s;click" fill="freeze" restart="always"/>'
            + '<animateTransform attributeName="transform" type="translate" from="0 16" to="0 0" dur="0.7s" begin="0.55s;click" fill="freeze" restart="always" calcMode="spline" keySplines="0.16 1 0.3 1"/>'
          : '')
        + '<text x="' + (W / 2) + '" y="' + nameY + '" font-family="' + fontStack(cfg.nameFont) + '" font-size="54" font-weight="' + (FONTS[cfg.nameFont] || FONTS.poppins).weight + '" letter-spacing="2" fill="' + cfg.text + '" text-anchor="middle">' + escXml(nameStr) + '</text>'
        + (showTag ? '<text x="' + (W / 2) + '" y="' + tagY + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="20" font-weight="500" letter-spacing="5" fill="' + cfg.tag + '" text-anchor="middle">' + escXml(cfg.tagline) + '</text>' : '')
        + '</g>';
      // brand bar — draw from the center
      inner += '<rect x="' + (animated ? (W / 2) : barX) + '" y="' + barY + '" width="' + (animated ? '0' : barW) + '" height="6" rx="3" fill="' + cfg.primary + '" opacity="' + (animated ? '0' : '1') + '">'
        + (animated
          ? '<animate attributeName="width" from="0" to="' + barW + '" dur="0.55s" begin="0.95s;click" fill="freeze" restart="always" calcMode="spline" keySplines="0.16 1 0.3 1"/>'
            + '<animate attributeName="x" from="' + (W / 2) + '" to="' + barX + '" dur="0.55s" begin="0.95s;click" fill="freeze" restart="always" calcMode="spline" keySplines="0.16 1 0.3 1"/>'
            + '<animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="0.95s;click" fill="freeze" restart="always"/>'
          : '')
        + '</rect>';
      inner += '<text x="' + (W - 16) + '" y="' + (H - 16) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="11" fill="#94a3b8" text-anchor="end" opacity="0.7">CLICK TO REPLAY</text>';
      return inner;
    }
    var anim = introInner(true), stat = introInner(false);
    return { svg: wrapSvg(anim, W, H), staticSvg: wrapSvg(stat, W, H), inner: anim, w: W, h: H };
  }

  /* ---------- P4-02 WCAG contrast report ---------- */
  function contrastVerdict(r) {
    if (r >= 7) return { txt: 'AAA', bg: '#10b981' };
    if (r >= 4.5) return { txt: 'AA', bg: '#10b981' };
    if (r >= 3) return { txt: 'AA Large', bg: '#f59e0b' };
    return { txt: 'Fail', bg: '#ef4444' };
  }
  function buildContrastReport(cfg) {
    var pal = effectivePalette();
    var fgs = [
      { name: 'Primary', hex: cfg.primary },
      { name: 'Text', hex: cfg.text },
      { name: 'Secondary', hex: cfg.tag },
      { name: 'Accent', hex: pal.accent },
      { name: 'Dark', hex: pal.dark }
    ];
    var bgs = [
      { name: 'White', hex: '#ffffff' },
      { name: 'Light', hex: pal.light },
      { name: 'Brand BG', hex: cfg.bg },
      { name: 'Dark', hex: pal.dark }
    ];
    var rows = [];
    var lines = ['WCAG CONTRAST REPORT', '======================', 'AA needs ≥ 4.5:1 (≥ 3:1 for large text), AAA needs ≥ 7:1.'];
    fgs.forEach(function (f) {
      bgs.forEach(function (b) {
        var r = parseFloat(contrastRatio(f.hex, b.hex));
        var v = contrastVerdict(r);
        lines.push(f.name + ' on ' + b.name + ': ' + r.toFixed(1) + ':1');
        rows.push('<tr>'
          + '<td style="padding:4px 8px;white-space:nowrap"><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:' + f.hex + ';border:1px solid #cbd5e1;vertical-align:-1px"></span> <b>' + f.name + '</b><br><span style="color:#94a3b8;font-size:10px">' + f.hex.toUpperCase() + '</span></td>'
          + '<td style="padding:4px 8px;white-space:nowrap;background:' + b.hex + ';color:' + contrastOn(b.hex) + '"><span style="display:inline-block;width:26px;height:16px;border:1px solid rgba(0,0,0,.18);border-radius:3px"></span> ' + b.name + '</td>'
          + '<td style="padding:4px 8px;text-align:center;font-weight:700">' + r.toFixed(1) + ':1</td>'
          + '<td style="padding:4px 8px;text-align:center"><span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;color:#fff;background:' + v.bg + '">' + v.txt + '</span></td>'
          + '</tr>');
      });
    });
    var cardHtml = '<div style="font-size:12px;color:#0f172a">'
      + '<div style="font-weight:700;margin-bottom:6px">Palette pairings — AA needs 4.5:1 (3:1 large text), AAA 7:1</div>'
      + '<table style="border-collapse:collapse;width:100%">'
      + '<tr style="text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8"><td>Foreground</td><td>Background</td><td>Ratio</td><td>Grade</td></tr>'
      + rows.join('')
      + '</table>'
      + '<div style="margin-top:8px;color:#64748b;font-size:11px">Fail → avoid this pairing. AA Large → big text only. Fix tips: darken light colors, lighten dark ones, or use the reversed (white) logo on ' + cfg.primary + '.</div>'
      + '</div>';
    return { cardHtml: cardHtml, text: lines.join('\n'), w: 0, h: 0 };
  }

  /* ---------- P4-03 Color-blind simulation ---------- */
  var CVD_MATRICES = {
    protanopia: [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]],
    deuteranopia: [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]],
    tritanopia: [[0.95, 0.05, 0], [0, 0.433, 0.567], [0, 0.475, 0.525]]
  };
  function cvdApply(hex, kind) {
    var m = CVD_MATRICES[kind];
    if (!m) return hex;
    var c = hexToRgb(hex);
    function toHex(v) { v = Math.max(0, Math.min(255, Math.round(v))); return ('0' + v.toString(16)).slice(-2); }
    var r = m[0][0] * c.r + m[0][1] * c.g + m[0][2] * c.b;
    var g = m[1][0] * c.r + m[1][1] * c.g + m[1][2] * c.b;
    var b = m[2][0] * c.r + m[2][1] * c.g + m[2][2] * c.b;
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }
  function buildCvdSheet(cfg) {
    var W = 1180, H = 330;
    var cells = [
      { label: 'NORMAL', kind: null },
      { label: 'PROTANOPIA', kind: 'protanopia' },
      { label: 'DEUTERANOPIA', kind: 'deuteranopia' },
      { label: 'TRITANOPIA', kind: 'tritanopia' }
    ];
    var cw = 278, gap = 18, x0 = 12;
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#f8fafc"/>';
    inner += '<text x="20" y="28" font-family="' + fontStack(cfg.tagFont) + '" font-size="13" font-weight="600" fill="#64748b">COLOR-VISION SIMULATION — HOW YOUR LOGO READS WITH COMMON COLOR DEFICIENCIES</text>';
    cells.forEach(function (cell, i) {
      var cx = x0 + i * (cw + gap);
      var cc = cell.kind
        ? Object.assign({}, cfg, { primary: cvdApply(cfg.primary, cell.kind), text: cvdApply(cfg.text, cell.kind), tag: cvdApply(cfg.tag, cell.kind), bg: cvdApply(cfg.bg, cell.kind) })
        : cfg;
      inner += '<rect x="' + cx + '" y="40" width="' + cw + '" height="' + (H - 52) + '" rx="12" fill="#ffffff" stroke="#e2e8f0"/>';
      inner += '<text x="' + (cx + 14) + '" y="68" font-family="' + fontStack(cfg.tagFont) + '" font-size="13" font-weight="700" letter-spacing="1" fill="' + (cell.kind ? '#64748b' : cfg.primary) + '">' + cell.label + '</text>';
      var logo = buildLogoParts(cc, { layout: 'horizontal', mode: 'color' });
      var s = Math.min((cw - 30) / logo.w, 72 / logo.h, 1.6);
      inner += '<g transform="translate(' + (cx + cw / 2 - logo.w * s / 2).toFixed(1) + ',' + (135 - logo.h * s / 2).toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
      [cc.primary, cc.text, cc.tag, cc.bg].forEach(function (hex, ci) {
        inner += '<rect x="' + (cx + 16 + ci * 30) + '" y="' + (H - 64) + '" width="24" height="24" rx="6" fill="' + hex + '" stroke="#e2e8f0"/>';
      });
      inner += '<text x="' + (cx + 16) + '" y="' + (H - 22) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="11" fill="#94a3b8">' + (cell.kind ? 'Simulated palette' : 'Your palette') + '</text>';
    });
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  /* ---------- P4-06 Adaptive favicon + snippet ---------- */
  function buildAdaptiveFavicon(cfg) {
    var size = 64;
    var markCfg = Object.assign({}, cfg, { layout: 'mark', shadow: false });
    if (markCfg.symbol === 'none') markCfg = Object.assign({}, markCfg, { symbol: 'monogram' });
    var light = glyphSvg(markCfg, size / 2, size / 2, size * 0.86, cfg.primary, 'color');
    var dark = glyphSvg(markCfg, size / 2, size / 2, size * 0.86, '#ffffff', 'color');
    var inner = '<style>.bsg-f-l{display:block}.bsg-f-d{display:none}@media (prefers-color-scheme:dark){.bsg-f-l{display:none}.bsg-f-d{display:block}}</style>'
      + '<g class="bsg-f-l">' + light + '</g>'
      + '<g class="bsg-f-d">' + dark + '</g>';
    return { svg: wrapSvg(inner, size, size), inner: inner, w: size, h: size };
  }
  function buildFaviconSnippet() {
    var slug = assetSlug();
    return { html: '<!-- Adaptive favicon — dark mark in light mode, white mark in dark mode -->\n'
      + '<link rel="icon" type="image/svg+xml" href="/' + slug + '-favicon-adaptive.svg">\n'
      + '<link rel="alternate icon" type="image/png" href="/' + slug + '-favicon-adaptive-64.png" sizes="64x64">\n'
      + '<link rel="shortcut icon" href="/favicon.ico">' };
  }

  /* --------------------------------------------------------
     Asset registry
  -------------------------------------------------------- */
  var ASSET_GROUPS = [
    { id: 'logo', icon: '🎨', label: 'Logo Lockups', desc: 'The core logo in every lockup and color mode.' },
    { id: 'icons', icon: '🧩', label: 'Icons & Favicon', desc: 'Browser tab, app store and profile images.' },
    { id: 'web', icon: '🌐', label: 'Web & Email', desc: 'Website banners and email marketing assets.' },
    { id: 'social', icon: '📣', label: 'Social Media', desc: 'Covers, profiles and templates for social platforms.' },
    { id: 'print', icon: '🖨️', label: 'Print & Office', desc: 'Business cards, letterhead and paper assets.' },
    { id: 'digital', icon: '📄', label: 'Digital Assets', desc: 'Email signature, brand JSON and summaries.' },
    { id: 'quality', icon: '🛡️', label: 'Quality & A11y', desc: 'Contrast checks and color-blind previews for accessible branding.' }
  ];

  function makeAssets(cfg) {
    var slug = assetSlug();
    function fname(id, ext) { return slug + '-' + id + '.' + ext; }
    return [
      { id: 'primary-logo', group: 'logo', title: 'Primary Logo', desc: 'Horizontal, full color — use everywhere.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return _darkKit ? buildLogo(cfg, { mode: 'white' }) : buildLogo(cfg, { mode: 'color' }); }, dark: _darkKit },
      { id: 'stacked-logo', group: 'logo', title: 'Stacked Logo', desc: 'Vertical lockup for square spaces.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return _darkKit ? buildLogo(cfg, { layout: 'stacked', mode: 'white' }) : buildLogo(cfg, { layout: 'stacked', mode: 'color' }); }, dark: _darkKit },
      { id: 'logo-mark', group: 'logo', title: 'Logo Mark', desc: 'Icon/monogram only — avatars, watermarks.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return _darkKit ? buildLogo(cfg, { layout: 'mark', mode: 'white' }) : buildLogo(cfg, { layout: 'mark', mode: 'color' }); }, dark: _darkKit },
      { id: 'mono-black', group: 'logo', title: 'Mono — Black', desc: 'One-color black for print & stamps.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return _darkKit ? buildLogo(cfg, { mode: 'white' }) : buildLogo(cfg, { mode: 'black' }); }, dark: _darkKit },
      { id: 'mono-white', group: 'logo', title: 'Mono — White', desc: 'One-color white for dark surfaces.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildLogo(cfg, { mode: 'white' }); }, dark: true },
      { id: 'reversed', group: 'logo', title: 'Reversed', desc: 'White logo on your brand color.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildLogo(cfg, { mode: 'white', bg: true }); }, dark: false },
      { id: 'favicon', group: 'icons', title: 'Favicon', desc: 'Browser tab icon — SVG, PNG 64/180 and real .ico (16–64px).', tag: 'SVG · PNG · ICO', webp: true, icoSizes: [16, 32, 48, 64], build: function () { return buildFavicon(cfg); }, dark: false, pngSizes: [64, 180] },
      { id: 'app-icon', group: 'icons', title: 'App Icon', desc: '1024×1024 store-ready app icon.', tag: 'PNG · WebP', webp: true, build: function () { return buildAppIcon(cfg, 1024, false); }, dark: false },
      { id: 'avatar', group: 'icons', title: 'Social Avatar', desc: 'Circular profile picture, 1024px.', tag: 'PNG · WebP', webp: true, build: function () { return buildAppIcon(cfg, 1024, true); }, dark: false },
      { id: 'favicon-adaptive', group: 'icons', title: 'Adaptive Favicon', desc: 'Theme-aware favicon — dark mark in light mode, white mark in dark mode.', tag: 'SVG · PNG', build: function () { return buildAdaptiveFavicon(cfg); }, dark: false, pngSizes: [64] },
      { id: 'favicon-snippet', group: 'icons', title: 'Favicon <link> Code', desc: 'HTML snippet for your site head with the adaptive favicon.', tag: 'HTML', previewNote: 'Copy the &lt;link&gt; tags into<br>your site &lt;head&gt;', build: function () { return buildFaviconSnippet(cfg); }, dark: false },
      { id: 'banner-light', group: 'web', title: 'Website Banner — Light', desc: '1500×500 header for light websites.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildBanner(cfg, _darkKit); }, dark: _darkKit },
      { id: 'banner-dark', group: 'web', title: 'Website Banner — Dark', desc: '1500×500 header for dark websites.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildBanner(cfg, true); }, dark: true },
      { id: 'newsletter-header', group: 'web', title: 'Newsletter Header', desc: '600×200 branded email banner header.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildNewsletterHeader(cfg); }, dark: false },
      { id: 'email-template', group: 'web', title: 'Email Template', desc: 'Branded HTML email body with header & footer.', tag: 'HTML', build: function () { return { html: buildEmailTemplate(cfg), w: 0, h: 0 }; }, dark: false },
      { id: 'animated-intro', group: 'web', title: 'Animated Logo Intro', desc: 'SMIL-animated logo reveal for websites & presentations — click to replay.', tag: 'SVG · PNG', inline: true, build: function () { return buildAnimatedIntro(cfg); }, dark: false },
      { id: 'facebook-cover', group: 'social', title: 'Facebook Cover', desc: '820×312 page cover with safe-area guide.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildSocialCover(cfg, { w: 820, h: 312, align: 'center', safe: { x: 90, y: 54, w: 640, h: 204 } }); }, dark: false },
      { id: 'linkedin-cover', group: 'social', title: 'LinkedIn Banner', desc: '1584×396 company page banner.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildSocialCover(cfg, { w: 1584, h: 396, align: 'left', safe: { x: 120, y: 40, w: 1344, h: 316 } }); }, dark: false },
      { id: 'x-cover', group: 'social', title: 'X / Twitter Header', desc: '1500×500 profile header.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildSocialCover(cfg, { w: 1500, h: 500, align: 'center', safe: { x: 190, y: 60, w: 1120, h: 380 } }); }, dark: false },
      { id: 'youtube-cover', group: 'social', title: 'YouTube Banner', desc: '2560×1440 channel art with TV-safe area.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildSocialCover(cfg, { w: 2560, h: 1440, align: 'center', safe: { x: 507, y: 508, w: 1546, h: 423 } }); }, dark: false },
      { id: 'social-profile', group: 'social', title: 'Social Profile Pictures', desc: 'Circle avatars — FB 180/360, LinkedIn/X 400, YouTube 800, Instagram 1080.', tag: 'PNG · WebP', webp: true, build: function () { return buildAppIcon(cfg, 800, true); }, dark: false, pngSizes: [{ size: 180, label: 'FB 180' }, { size: 360, label: 'FB 360' }, { size: 400, label: 'LinkedIn/X 400' }, { size: 800, label: 'YouTube 800' }, { size: 1080, label: 'Instagram 1080' }] },
      { id: 'instagram-post', group: 'social', title: 'Instagram Post', desc: '1080×1080 square post template.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildInstagramPost(cfg, false); }, dark: false },
      { id: 'instagram-story', group: 'social', title: 'Instagram Story', desc: '1080×1920 story template with CTA pill.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildInstagramPost(cfg, true); }, dark: false },
      { id: 'whatsapp-profile', group: 'social', title: 'WhatsApp Profile', desc: '500×500 business profile logo.', tag: 'PNG · WebP', webp: true, build: function () { return buildAppIcon(cfg, 500, false); }, dark: false, pngSizes: [{ size: 500, label: '500' }] },
      { id: 'whatsapp-catalog', group: 'social', title: 'WhatsApp Catalog', desc: '800×800 product / catalog image.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildWhatsAppCatalog(cfg); }, dark: false, pngSizes: [{ size: 800, label: '800' }] },
      { id: 'business-card-front', group: 'print', title: 'Business Card — Front', desc: '3.5×2 in at 300dpi with your contact details.', tag: 'SVG · PNG', build: function () { return buildCardFront(cfg); }, dark: false },
      { id: 'business-card-back', group: 'print', title: 'Business Card — Back', desc: 'Branded back with centered mark and a scannable vCard QR.', tag: 'SVG · PNG', build: function () { return buildCardBack(cfg); }, dark: false },
      { id: 'business-card-print', group: 'print', title: 'Print-Ready Cards', desc: 'Front + back with 0.125in bleed, crop marks and approximate CMYK values.', tag: 'SVG · PNG', build: function () { return buildCardPrintSheet(cfg); }, dark: false },
      { id: 'letterhead', group: 'print', title: 'Letterhead (A4)', desc: 'Official document header + footer.', tag: 'SVG · PNG', build: function () { return buildLetterhead(cfg); }, dark: false },
      { id: 'invoice-header', group: 'print', title: 'Invoice Header', desc: '1240×360 header block for invoices.', tag: 'SVG · PNG', webp: true, build: function () { return buildInvoiceHeader(cfg); }, dark: false },
      { id: 'proposal-cover', group: 'print', title: 'Proposal Cover (A4)', desc: 'Formal business proposal front page.', tag: 'SVG · PNG', build: function () { return buildProposalCover(cfg); }, dark: false },
      { id: 'ppt-title-slide', group: 'print', title: 'PowerPoint Title Slide', desc: '16:9 (1920×1080) branded title slide.', tag: 'SVG · PNG', webp: true, build: function () { return buildPptTitleSlide(cfg); }, dark: false },
      { id: 'gdoc-header', group: 'print', title: 'Google Docs Header', desc: '1600×400 header image for documents.', tag: 'SVG · PNG', webp: true, build: function () { return buildGdocHeader(cfg); }, dark: false },
      { id: 'envelope-dl', group: 'print', title: 'Envelope (DL)', desc: '220×110mm envelope layout with return address and stamp box.', tag: 'SVG · PNG', build: function () { return buildEnvelopeDl(cfg); }, dark: false },
      { id: 'mailing-label', group: 'print', title: 'Mailing Label', desc: 'Address label with return and recipient blocks.', tag: 'SVG · PNG', build: function () { return buildMailingLabel(cfg); }, dark: false },
      { id: 'fax-cover', group: 'print', title: 'Fax Cover Sheet', desc: 'To/From/Pages fields + message area.', tag: 'SVG · PNG', build: function () { return buildFaxCover(cfg); }, dark: false },
      { id: 'id-badge-front', group: 'print', title: 'ID Badge — Front', desc: 'CR80 staff badge with photo placeholder.', tag: 'SVG · PNG', build: function () { return buildBadge(cfg, false); }, dark: false },
      { id: 'id-badge-back', group: 'print', title: 'ID Badge — Back', desc: 'Return-to info and barcode.', tag: 'SVG · PNG', build: function () { return buildBadge(cfg, true); }, dark: false },
      { id: 'lanyard', group: 'print', title: 'Lanyard', desc: 'Repeating-brand lanyard strip.', tag: 'SVG · PNG', webp: true, build: function () { return buildLanyard(cfg); }, dark: false },
      { id: 'logo-review-sheet', group: 'print', title: 'Logo Review Sheet', desc: 'One-page overview of all lockups for client approval.', tag: 'SVG · PNG', build: function () { return buildReviewSheet(cfg); }, dark: false },
      { id: 'swag-stickers', group: 'print', title: 'Swag — Sticker Sheet', desc: 'Die-cut sticker sheet in 6 shapes.', tag: 'SVG · PNG', build: function () { return buildSwagStickers(cfg); }, dark: false },
      { id: 'sign-storefront', group: 'print', title: 'Sign — Storefront', desc: 'Awning/sign board layout.', tag: 'SVG · PNG', webp: true, build: function () { return buildSignStorefront(cfg); }, dark: false },
      { id: 'sign-door', group: 'print', title: 'Sign — Door Sticker', desc: 'Glass-door sticker layout.', tag: 'SVG · PNG', build: function () { return buildSignDoor(cfg); }, dark: false },
      { id: 'sign-vehicle', group: 'print', title: 'Sign — Vehicle Panel', desc: 'Side-panel vehicle branding layout.', tag: 'SVG · PNG', webp: true, build: function () { return buildSignVehicle(cfg); }, dark: false },
      { id: 'email-signature', group: 'digital', title: 'Email Signature', desc: 'Copy-paste HTML block with photo placeholder.', tag: 'HTML', build: function () { return { html: buildEmailSignature(cfg), w: 0, h: 0 }; }, dark: false },
      { id: 'vcard', group: 'digital', title: 'vCard Contact File', desc: 'Downloadable .vcf — same data as the card QR code.', tag: 'VCF', mime: 'text/vcard', build: function () { return { text: vcardText(), w: 0, h: 0 }; }, fname: function (s) { return s + '-contact.vcf'; }, dark: false },
      { id: 'brand-json', group: 'digital', title: 'Brand JSON', desc: 'Machine-readable brand manifest for other apps.', tag: 'JSON', build: function () { return { text: JSON.stringify(brandManifest(), null, 2), w: 0, h: 0 }; }, fname: function (s) { return s + '-brand.json'; }, dark: false },
      { id: 'brand-summary', group: 'digital', title: 'Brand Summary', desc: 'Colors, fonts and rules in plain text.', tag: 'TXT', build: function () { return { text: buildBrandSummary(cfg), w: 0, h: 0 }; }, dark: false },
      { id: 'contrast-checker', group: 'quality', title: 'WCAG Contrast Report', desc: 'Contrast ratios for every palette pairing with pass/fail grades.', tag: 'HTML', build: function () { return buildContrastReport(cfg); }, dark: false },
      { id: 'cvd-simulation', group: 'quality', title: 'Color-Blind Preview', desc: 'Logo under protanopia, deuteranopia and tritanopia simulation.', tag: 'SVG · PNG', build: function () { return buildCvdSheet(cfg); }, dark: false }
    ].map(function (a) {
      if (a.fname) a.filename = a.fname(slug);
      else a.filename = fname(a.id, a.id === 'brand-summary' ? 'txt' : (a.id === 'email-signature' || a.id === 'contrast-checker' || a.id === 'favicon-snippet') ? 'html' : 'svg');
      return a;
    });
  }

  /* --------------------------------------------------------
     Downloads / PNG / ZIP
  -------------------------------------------------------- */
  function downloadBlobText(text, filename, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function downloadDataUrl(dataUrl, filename) {
    triggerDownload(dataUrl, filename);
  }
  function triggerDownload(url, filename) {
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 10);
  }

  function svgToPng(svg, w, h, cb, opts) {
    opts = opts || {};
    var mime = opts.mime || 'image/png';
    try {
      var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      var img = new Image();
      img.onload = function () {
        try {
          var scale = opts.scale || Math.min(2, Math.max(1, 1600 / Math.max(w, h)));
          var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
          if (opts.pngW) { cw = opts.pngW; ch = opts.pngH || opts.pngW; }
          var maxDim = 8192;
          if (cw > maxDim || ch > maxDim) {
            var f = maxDim / Math.max(cw, ch);
            cw = Math.max(1, Math.round(cw * f)); ch = Math.max(1, Math.round(ch * f));
          }
          var c = document.createElement('canvas');
          c.width = cw; c.height = ch;
          var ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, cw, ch);
          var dataUrl = c.toDataURL(mime, 0.92);
          if (mime === 'image/webp' && dataUrl.indexOf('data:image/webp') !== 0) {
            cb('WebP is not supported in this browser — use PNG instead.', null);
            return;
          }
          cb(null, dataUrl, cw, ch);
        } catch (e) {
          cb('PNG rendering is blocked for uploaded logos (external image). Please download the SVG instead.', null);
        }
      };
      img.onerror = function () { cb('Could not render PNG from this SVG.', null); };
      img.src = url;
    } catch (e) {
      cb('Could not render PNG.', null);
    }
  }

  function webpSupported() {
    try {
      var c = document.createElement('canvas');
      c.width = 1; c.height = 1;
      return c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } catch (e) { return false; }
  }

  /* --- ICO (real .ico file with PNG-compressed frames) --- */
  function base64ToBytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function buildIcoBlob(pngs) {
    // pngs: [{size, bytes}] sorted ascending
    var count = pngs.length;
    var headerSize = 6 + 16 * count;
    var total = headerSize;
    pngs.forEach(function (p) { total += p.bytes.length; });
    var buf = new Uint8Array(total);
    var dv = new DataView(buf.buffer);
    dv.setUint16(0, 0, true);          // reserved
    dv.setUint16(2, 1, true);          // type: icon
    dv.setUint16(4, count, true);      // count
    var off = headerSize;
    pngs.forEach(function (p, i) {
      var e = 6 + 16 * i;
      var s = p.size > 255 ? 0 : p.size;
      dv.setUint8(e, s);               // width
      dv.setUint8(e + 1, s);           // height
      dv.setUint8(e + 2, 0);           // colors
      dv.setUint8(e + 3, 0);           // reserved
      dv.setUint16(e + 4, 1, true);    // planes
      dv.setUint16(e + 6, 32, true);   // bpp
      dv.setUint32(e + 8, p.bytes.length, true);
      dv.setUint32(e + 12, off, true);
      buf.set(p.bytes, off);
      off += p.bytes.length;
    });
    return new Blob([buf], { type: 'image/x-icon' });
  }

  function svgToIco(svg, w, h, sizes, cb) {
    var pngs = [];
    var done = 0;
    var firstErr = null;
    sizes.forEach(function (sz) {
      svgToPng(svg, w, h, function (err, dataUrl) {
        done++;
        if (err) { firstErr = firstErr || err; }
        else pngs.push({ size: sz, bytes: base64ToBytes(dataUrl.split(',')[1]) });
        if (done === sizes.length) {
          if (firstErr || !pngs.length) { cb(firstErr || 'ICO generation failed.', null); return; }
          pngs.sort(function (a, b) { return a.size - b.size; });
          cb(null, buildIcoBlob(pngs));
        }
      }, { pngW: sz, pngH: sz });
    });
  }

  function notify(msg, sev) {
    if (tool.notify) tool.notify(msg, sev || 'info');
  }

  function collectAllFiles(cb) {
    var cfg = logoCfg();
    var assets = makeAssets(cfg);
    var files = [];
    var manifest = [];
    var pending = 0, failed = 0;

    function done() {
      pending--;
      if (pending <= 0) cb(null, files, failed, manifest);
    }
    function addAsync(fn) {
      pending++;
      fn(done);
    }

    assets.forEach(function (a) {
      var dir = groupLabel(a.group) + '/';
      var res = a.build();
      var rastSvg = res.staticSvg || res.svg;
      var fmts = groupFormats(a.group);
      var item = { id: a.id, title: a.title, group: a.group, kind: 'svg', files: [] };
      if (res.svg) item.thumb = dataUriSvg(res.svg);
      if (res.html) {
        item.kind = 'html';
        item.preview = res.html;
        files.push({ name: dir + a.filename, text: res.html });
        item.files.push(dir + a.filename);
        manifest.push(item);
        return;
      }
      if (res.cardHtml) {
        item.kind = 'html';
        item.preview = res.cardHtml;
        files.push({ name: dir + a.filename, text: res.cardHtml });
        item.files.push(dir + a.filename);
        manifest.push(item);
        return;
      }
      if (res.text) {
        item.kind = 'text';
        item.preview = res.text;
        files.push({ name: dir + a.filename, text: res.text });
        item.files.push(dir + a.filename);
        manifest.push(item);
        return;
      }
      if (fmts.indexOf('svg') > -1) {
        files.push({ name: dir + a.filename, text: res.svg });
        item.files.push(dir + a.filename);
      }
      if (fmts.indexOf('png') > -1) {
        addAsync(function (d) {
          svgToPng(rastSvg, res.w, res.h, function (err, dataUrl) {
            if (!err) { files.push({ name: dir + a.filename.replace('.svg', '.png'), dataUrl: dataUrl }); item.files.push(dir + a.filename.replace('.svg', '.png')); }
            else failed++;
            d();
          });
        });
      }
      if (a.pngSizes && fmts.indexOf('png') > -1) {
        a.pngSizes.forEach(function (sz) {
          var info = typeof sz === 'number' ? { size: sz } : { size: sz.size };
          addAsync(function (d) {
            svgToPng(rastSvg, res.w, res.h, function (err, dataUrl) {
              if (!err) { files.push({ name: dir + a.filename.replace('.svg', '-' + info.size + '.png'), dataUrl: dataUrl }); item.files.push(dir + a.filename.replace('.svg', '-' + info.size + '.png')); }
              else failed++;
              d();
            }, { pngW: info.size, pngH: info.size });
          });
        });
      }
      if (a.webp && webpSupported() && fmts.indexOf('webp') > -1) {
        addAsync(function (d) {
          svgToPng(rastSvg, res.w, res.h, function (err, dataUrl) {
            if (!err) { files.push({ name: dir + a.filename.replace('.svg', '.webp'), dataUrl: dataUrl }); item.files.push(dir + a.filename.replace('.svg', '.webp')); }
            else failed++;
            d();
          }, { mime: 'image/webp' });
        });
      }
      if (a.icoSizes && fmts.indexOf('ico') > -1) {
        addAsync(function (d) {
          svgToIco(rastSvg, res.w, res.h, a.icoSizes, function (err, blob) {
            if (!err) { files.push({ name: dir + a.filename.replace('.svg', '.ico'), blob: blob }); item.files.push(dir + a.filename.replace('.svg', '.ico')); }
            else failed++;
            d();
          });
        });
      }
      manifest.push(item);
    });
    if (!pending) cb(null, files, failed, manifest);
  }

  /* ---------- P5-07 ZIP gallery index ---------- */
  function buildGalleryIndex(manifest, brandName) {
    var groups = {};
    manifest.forEach(function (m) {
      (groups[m.group] = groups[m.group] || []).push(m);
    });
    var body = '';
    Object.keys(groups).forEach(function (gid) {
      body += '<h2 class="gh">' + escHtml(groupLabel(gid)) + '</h2><div class="grid">';
      groups[gid].forEach(function (m) {
        var thumb;
        if (m.thumb) {
          thumb = '<img src="' + m.thumb + '" alt="' + escHtml(m.title) + '">';
        } else {
          var tag = (m.files[0] || '').split('.').pop().toUpperCase();
          thumb = '<div class="note"><b>' + escHtml(tag || 'FILE') + '</b><div>' + escHtml(String(m.preview || '').slice(0, 180)) + '</div></div>';
        }
        var links = m.files.map(function (fn) {
          var label = fn.split('.').pop().toUpperCase();
          return '<a class="dl" href="' + escHtml(fn) + '" download>' + escHtml(label) + '</a>';
        }).join('');
        body += '<div class="card"><div class="thumb">' + thumb + '</div>'
          + '<div class="t">' + escHtml(m.title) + '</div>'
          + '<div class="links">' + (links || '<span class="empty">no files selected</span>') + '</div>'
          + '</div>';
      });
      body += '</div>';
    });
    return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + escHtml(brandName) + ' — Brand Kit</title>'
      + '<style>'
      + '*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;background:#f1f5f9;color:#0f172a;padding:24px}'
      + '.wrap{max-width:1100px;margin:0 auto}h1{font-size:22px;margin:0 0 4px}h1+p{color:#64748b;margin:0 0 22px;font-size:13px}'
      + '.gh{font-size:13px;letter-spacing:.6px;text-transform:uppercase;color:#4f46e5;margin:22px 0 10px}'
      + '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}'
      + '.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,.05)}'
      + '.thumb{height:130px;display:flex;align-items:center;justify-content:center;padding:10px;background:conic-gradient(#e8eaf2 25%,#fff 0 50%,#e8eaf2 0 75%,#fff 0);background-size:16px 16px}'
      + '.thumb img{max-width:100%;max-height:100%}'
      + '.note{font-size:11px;color:#64748b;padding:8px;text-align:center;overflow:hidden}'
      + '.t{font-size:13px;font-weight:700;padding:10px 12px 4px}.links{display:flex;gap:6px;flex-wrap:wrap;padding:0 12px 12px}'
      + '.dl{font-size:10.5px;font-weight:700;color:#fff;background:#4f46e5;border-radius:6px;padding:4px 9px;text-decoration:none}'
      + '.dl:hover{background:#4338ca}.empty{font-size:11px;color:#94a3b8}'
      + 'footer{text-align:center;color:#94a3b8;font-size:11px;margin-top:28px}'
      + '</style></head><body><div class="wrap">'
      + '<h1>' + escHtml(brandName) + ' — Brand Kit Gallery</h1>'
      + '<p>Every asset in one page. Click a badge to download that format — or browse the folders next to this file.</p>'
      + body
      + '<footer>Generated by Brand Set Generator · ' + escHtml(new Date().toISOString().slice(0, 10)) + '</footer>'
      + '</div></body></html>';
  }

  function downloadZip() {
    if (typeof JSZip === 'undefined') {
      notify('ZIP library not loaded — please download assets individually.', 'warning');
      return;
    }
    notify('Packaging brand kit…', 'info');
    collectAllFiles(function (err, files, failed, manifest) {
      var slug = assetSlug();
      var brandName = DB.company.name || DB.company.legalName || DEFAULT_NAME;
      var zip = new JSZip();
      var root = zip.folder(slug + '-brand-kit');
      files.forEach(function (f) {
        if (f.dataUrl) {
          root.file(f.name, f.dataUrl.split(',')[1], { base64: true });
        } else if (f.blob) {
          root.file(f.name, f.blob);
        } else {
          root.file(f.name, f.text);
        }
      });
      root.file('index.html', buildGalleryIndex(manifest, brandName));
      zip.generateAsync({ type: 'blob' }).then(function (blob) {
        var url = URL.createObjectURL(blob);
        triggerDownload(url, slug + '-brand-kit.zip');
        setTimeout(function () { URL.revokeObjectURL(url); }, 6000);
        notify(failed ? 'Brand kit downloaded (' + failed + ' file(s) skipped — use SVG/PNG instead).' : 'Brand kit downloaded ✓', failed ? 'warning' : 'success');
      }).catch(function (e) {
        notify('ZIP failed: ' + e, 'error');
      });
    });
  }

  function exportGuidelinesPdf() {
    var cfg = logoCfg();
    var html = buildGuidelinesDocHtml(cfg);
    var slug = assetSlug();
    if (tool.requestExportPdf) {
      tool.requestExportPdf({ html: html, filename: slug + '-brand-guidelines', landscape: false }, function (err, file) {
        if (!err && file && file.url) {
          notify('Guidelines exported ✓', 'success');
          tool.openUrl(file.url);
        } else {
          notify('PDF export unavailable — downloading HTML instead.', 'warning');
          downloadBlobText(html, slug + '-brand-guidelines.html', 'text/html');
        }
      });
    } else {
      downloadBlobText(html, slug + '-brand-guidelines.html', 'text/html');
    }
  }

  function copyText(text, okMsg) {
    function done(ok) { notify(ok ? (okMsg || 'Copied ✓') : 'Copy failed — select and copy manually.', ok ? 'success' : 'warning'); }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallback(); });
      } else fallback();
    } catch (e) { fallback(); }
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        var ok = document.execCommand('copy');
        ta.parentNode.removeChild(ta);
        done(ok);
      } catch (e2) { done(false); }
    }
  }

  /* --------------------------------------------------------
     Rendering
  -------------------------------------------------------- */
  function renderForm() {
    var c = DB.company;
    var legalEl = $('f-legal-name'); if (legalEl) legalEl.value = c.legalName || '';
    var nameEl = $('f-name'); if (nameEl) nameEl.value = c.name || '';
    var ind = $('f-industry');
    if (ind) {
      ind.innerHTML = INDUSTRIES.map(function (x) { return '<option>' + x + '</option>'; }).join('');
      ind.value = c.industry || INDUSTRIES[0];
    }
    var tag = $('f-tagline'); if (tag) tag.value = c.tagline || '';
    var ps = $('f-palette-style');
    if (ps) {
      ps.innerHTML = PALETTE_STYLES.map(function (s) { return '<option value="' + s.id + '">' + s.label + '</option>'; }).join('');
      ps.value = c.paletteStyle || 'modern';
    }
    var fc = $('f-color'); if (fc) fc.value = c.brandColor || '#4f46e5';
    var contacts = { 'c-person': 'person', 'c-title': 'title', 'c-email': 'email', 'c-phone': 'phone', 'c-website': 'website', 'c-address': 'address' };
    Object.keys(contacts).forEach(function (id) {
      var el = $(id);
      if (el) el.value = c.contact[contacts[id]] || '';
    });
    renderSwatches();
    renderPalettePreview();
    renderPersonalityChips();
  }

  function renderSwatches() {
    var wrap = $('brand-swatches');
    if (!wrap) return;
    wrap.innerHTML = BRAND_SWATCHES.map(function (hex) {
      return '<button class="bsg-swatch' + (hex.toLowerCase() === String(DB.company.brandColor).toLowerCase() ? ' active' : '') + '" data-hex="' + hex + '" style="background:' + hex + '" title="' + hex + '"></button>';
    }).join('');
    var btns = wrap.querySelectorAll('.bsg-swatch');
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        b.addEventListener('click', function () {
          DB.company.brandColor = b.getAttribute('data-hex');
          var fc = $('f-color'); if (fc) fc.value = DB.company.brandColor;
          persist();
          renderSwatches(); renderPalettePreview(); scheduleStudioRefresh();
        });
      })(btns[i]);
    }
  }

  function renderPalettePreview() {
    var wrap = $('palette-preview');
    if (!wrap) return;
    var pal = effectivePalette();
    var order = [pal.brand, pal.accent, pal.muted, pal.light, pal.dark];
    wrap.innerHTML = order.map(function (hex) {
      var tc = contrastOn(hex);
      return '<div class="bsg-palette-swatch" data-hex="' + hex + '" style="background:' + hex + ';color:' + tc + '" title="Copy ' + hex + '"><span>' + hex.toUpperCase() + '</span></div>';
    }).join('');
    var sw = wrap.querySelectorAll('.bsg-palette-swatch');
    for (var i = 0; i < sw.length; i++) {
      (function (s) {
        s.addEventListener('click', function () { copyText(s.getAttribute('data-hex'), 'Copied ' + s.getAttribute('data-hex')); });
      })(sw[i]);
    }
  }

  function renderPersonalityChips() {
    var wrap = $('personality-chips');
    if (!wrap) return;
    wrap.innerHTML = PERSONALITIES.map(function (p) {
      return '<button class="bsg-chip' + (DB.company.personality.indexOf(p) > -1 ? ' active' : '') + '" data-p="' + p + '">' + p + '</button>';
    }).join('');
    var chips = wrap.querySelectorAll('.bsg-chip');
    for (var i = 0; i < chips.length; i++) {
      (function (chip) {
        chip.addEventListener('click', function () {
          var p = chip.getAttribute('data-p');
          var idx = DB.company.personality.indexOf(p);
          if (idx > -1) DB.company.personality.splice(idx, 1); else DB.company.personality.push(p);
          chip.classList.toggle('active');
          persist();
        });
      })(chips[i]);
    }
  }

  function renderStudioControls() {
    var lg = DB.logo;
    var fontSel = $('f-font');
    if (fontSel) {
      fontSel.innerHTML = Object.keys(FONTS).map(function (id) { return '<option value="' + id + '">' + FONTS[id].label + '</option>'; }).join('');
      fontSel.value = lg.fontId;
    }
    var tf = $('f-tagfont');
    if (tf) {
      tf.innerHTML = Object.keys(FONTS).map(function (id) { return '<option value="' + id + '">' + FONTS[id].label + '</option>'; }).join('');
      tf.value = lg.tagFontId;
    }
    setSeg($('symbol-type'), lg.symbol);
    setSeg($('layout-type'), lg.layout);
    setSeg($('shape-type'), lg.shape);
    var up = $('t-upper'); if (up) up.checked = !!lg.uppercase;
    var tt = $('t-tagline'); if (tt) tt.checked = lg.showTagline !== false;
    var ts = $('t-shadow'); if (ts) ts.checked = lg.shadow !== false;
    var tr = $('r-track'); if (tr) { tr.value = lg.tracking; $('track-val').textContent = lg.tracking; }
    var sc = $('r-scale');
    if (sc) {
      sc.value = Math.round(lg.iconScale * 100);
      $('scale-val').textContent = Math.round(lg.iconScale * 100) + '%';
    }
    var mono = $('f-monogram'); if (mono) mono.value = lg.monogram || '';
    var uploadFit = $('f-upload-fit'); if (uploadFit) uploadFit.value = lg.uploadFit || 'plain';
    var upad = $('r-upload-pad');
    if (upad) {
      upad.value = lg.uploadPad || 72;
      $('upload-pad-val').textContent = (lg.uploadPad || 72) + '%';
    }
    var colors = logoColors();
    var cmap = { 'f-c-primary': 'primary', 'f-c-text': 'text', 'f-c-tag': 'tag', 'f-c-bg': 'bg' };
    Object.keys(cmap).forEach(function (id) {
      var el = $(id);
      if (el) el.value = colors[cmap[id]];
    });
    updateSymbolUI();
    updateSourceUI();
    renderIconGrid();
    renderUploadUI();
  }

  function setSeg(container, activeVal) {
    if (!container) return;
    var btns = container.querySelectorAll('.bsg-seg-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].getAttribute('data-' + (container.id.indexOf('symbol') > -1 ? 'symbol' : container.id.indexOf('layout') > -1 ? 'layout' : 'shape')) === activeVal);
  }

  function updateSymbolUI() {
    var sym = DB.logo.symbol;
    $('icon-picker-wrap').style.display = sym === 'icon' ? '' : 'none';
    $('monogram-wrap').style.display = sym === 'monogram' ? '' : 'none';
  }

  function updateSourceUI() {
    var isUp = DB.logo.source === 'upload';
    $('builder-controls').style.display = isUp ? 'none' : '';
    $('upload-controls').style.display = isUp ? '' : 'none';
    $('src-builder').classList.toggle('active', !isUp);
    $('src-upload').classList.toggle('active', isUp);
  }

  function renderIconGrid() {
    var grid = $('icon-grid');
    if (!grid) return;
    var q = ($('icon-search').value || '').toLowerCase();
    var ids = Object.keys(ICONS).filter(function (id) {
      var ic = ICONS[id];
      return ic.cat !== 'ui' && (!q || ic.label.toLowerCase().indexOf(q) > -1);
    });
    grid.innerHTML = ids.map(function (id) {
      var ic = ICONS[id];
      var paths = ic.d.map(function (d) { return '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'; }).join('');
      return '<button class="bsg-icon-opt' + (DB.logo.iconId === id ? ' active' : '') + '" data-icon="' + id + '" title="' + ic.label + '"><svg viewBox="0 0 24 24">' + paths + '</svg><span>' + ic.label + '</span></button>';
    }).join('');
    var opts = grid.querySelectorAll('.bsg-icon-opt');
    for (var i = 0; i < opts.length; i++) {
      (function (b) {
        b.addEventListener('click', function () {
          DB.logo.iconId = b.getAttribute('data-icon');
          persist();
          renderIconGrid();
          scheduleStudioRefresh();
        });
      })(opts[i]);
    }
  }

  function renderUploadUI() {
    var has = !!DB.logo.uploadUrl;
    $('upload-preview').style.display = has ? '' : 'none';
    if (has) {
      $('upload-img').src = DB.logo.uploadUrl;
      $('upload-name').textContent = DB.logo.uploadName || 'Uploaded logo';
    }
  }

  function renderPreview() {
    var cfg = logoCfg();
    var logo = buildLogo(cfg, { mode: 'color' });
    $('logo-preview').innerHTML = logo.svg;
    var variants = [
      { title: 'Stacked', dark: false, build: function () { return buildLogo(cfg, { layout: 'stacked', mode: 'color' }); } },
      { title: 'Mark', dark: false, build: function () { return buildLogo(cfg, { layout: 'mark', mode: 'color' }); } },
      { title: 'Mono Black', dark: false, build: function () { return buildLogo(cfg, { mode: 'black' }); } },
      { title: 'On Dark', dark: true, build: function () { return buildLogo(cfg, { mode: 'white' }); } }
    ];
    var wrap = $('variant-previews');
    wrap.innerHTML = variants.map(function (v, idx) {
      var svg = v.build().svg;
      return '<div class="bsg-variant' + (v.dark ? ' dark' : '') + '" data-v="' + idx + '"><div class="bsg-v-thumb" style="background-image:url(\'' + dataUriSvg(svg) + '\');background-size:contain;background-repeat:no-repeat;background-position:center"></div><div class="bsg-v-label">' + v.title + '</div></div>';
    }).join('');
    var els = wrap.querySelectorAll('.bsg-variant');
    for (var i = 0; i < els.length; i++) {
      (function (el, idx) {
        el.addEventListener('click', function () {
          var v = variants[idx];
          var res = v.build();
          openLightbox(v.title, res.svg, res.w, res.h, v.title + ' — ' + slugify(DB.company.name || 'brand'));
        });
      })(els[i], i);
    }
    tool.resize();
  }

  var _assetsRefreshTimer = null;
  function scheduleAssetsRefresh() {
    clearTimeout(_assetsRefreshTimer);
    _assetsRefreshTimer = setTimeout(function () { renderAssets(); }, 400);
  }
  var _studioRefreshTimer = null;
  function scheduleStudioRefresh() {
    persist();
    clearTimeout(_studioRefreshTimer);
    _studioRefreshTimer = setTimeout(function () {
      renderPreview();
      renderAssets();
      syncStudioColors();
    }, 300);
  }
  function refreshAll() { renderPreview(); renderAssets(); }

  function syncStudioColors() {
    var colors = logoColors();
    var cmap = { 'f-c-primary': 'primary', 'f-c-text': 'text', 'f-c-tag': 'tag', 'f-c-bg': 'bg' };
    Object.keys(cmap).forEach(function (id) {
      var el = $(id);
      if (el && document.activeElement !== el) el.value = colors[cmap[id]];
    });
  }

  function buildGroupSection(g, assets, cfg) {
    var list = assets.filter(function (a) { return a.group === g.id; });
    var wrap = document.createElement('div');
    wrap.className = 'bsg-assets-group';
    var head = document.createElement('div');
    head.className = 'bsg-group-head';
    head.innerHTML = '<h3>' + g.icon + ' ' + escHtml(g.label) + ' <span class="bsg-assets-count">' + list.length + '</span></h3>'
      + '<p>' + escHtml(g.desc || '') + '</p>';
    wrap.appendChild(head);
    var inner = document.createElement('div');
    inner.className = 'bsg-assets-grid';
    list.forEach(function (a) { inner.appendChild(assetCard(a, cfg)); });
    wrap.appendChild(inner);
    return wrap;
  }

  function renderKitNav(assets) {
    var nav = $('kit-nav');
    if (!nav) return;
    nav.innerHTML = '';
    ASSET_GROUPS.forEach(function (g) {
      var count = assets.filter(function (a) { return a.group === g.id; }).length;
      if (!count) return;
      var btn = document.createElement('button');
      btn.className = 'bsg-kit-nav-btn' + (_kitGroup === g.id ? ' active' : '');
      btn.innerHTML = '<span class="bsg-kit-nav-ico">' + g.icon + '</span><span class="bsg-kit-nav-label">' + escHtml(g.label) + '</span><span class="bsg-kit-nav-count">' + count + '</span>';
      btn.addEventListener('click', function () { _kitGroup = g.id; renderAssets(); });
      nav.appendChild(btn);
    });
    var glBtn = document.createElement('button');
    glBtn.className = 'bsg-kit-nav-btn bsg-kit-nav-guidelines' + (_kitGroup === 'guidelines' ? ' active' : '');
    glBtn.innerHTML = '<span class="bsg-kit-nav-ico">📖</span><span class="bsg-kit-nav-label">Brand Guidelines</span>';
    glBtn.addEventListener('click', function () { _kitGroup = 'guidelines'; renderAssets(); });
    nav.appendChild(glBtn);
    var allBtn = document.createElement('button');
    allBtn.className = 'bsg-kit-nav-btn bsg-kit-nav-all' + (_kitGroup === 'all' ? ' active' : '');
    allBtn.innerHTML = '<span class="bsg-kit-nav-ico">🗂️</span><span class="bsg-kit-nav-label">Show all items</span><span class="bsg-kit-nav-count">' + assets.length + '</span>';
    allBtn.addEventListener('click', function () { _kitGroup = 'all'; renderAssets(); });
    nav.appendChild(allBtn);
  }

  function guidelinesSectionEl() {
    var cfg = logoCfg();
    var card = document.createElement('div');
    card.className = 'bsg-card bsg-guidelines';
    card.innerHTML = '<h3 style="font-size:15px">📖 Brand Guidelines</h3>'
      + '<div class="bsg-guidelines-body">' + guidelinesSectionHtml(cfg) + '</div>'
      + '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">'
      + '<button class="bsg-btn bsg-btn-ghost bsg-btn-sm" id="btn-guidelines-pdf">📄 Export Guidelines PDF</button>'
      + '<button class="bsg-btn bsg-btn-ghost bsg-btn-sm" id="btn-guidelines-copy">📋 Copy brand summary</button>'
      + '</div>';
    return card;
  }

  function renderAssets() {
    var cfg = logoCfg();
    var assets = makeAssets(cfg);
    renderKitNav(assets);
    renderExportPrefs();
    updateNameSample();
    var sub = $('kit-subtitle');
    if (sub) sub.textContent = _darkKit
      ? 'Dark variant on — logo assets switch to white for dark interfaces. Toggle back any time.'
      : 'Browse categories on the left — download individually or as a ZIP.';
    var content = $('kit-content');
    if (!content) return;
    if (content.classList && content.classList.toggle) content.classList.toggle('bsg-kit-dark', _darkKit);
    content.innerHTML = '';
    if (_kitGroup === 'guidelines') {
      content.appendChild(guidelinesSectionEl());
      bindGuidelinesActions();
    } else if (_kitGroup === 'all') {
      ASSET_GROUPS.forEach(function (g) {
        var has = assets.some(function (a) { return a.group === g.id; });
        if (has) content.appendChild(buildGroupSection(g, assets, cfg));
      });
    } else {
      var g = null;
      for (var i = 0; i < ASSET_GROUPS.length; i++) {
        if (ASSET_GROUPS[i].id === _kitGroup) { g = ASSET_GROUPS[i]; break; }
      }
      if (g) content.appendChild(buildGroupSection(g, assets, cfg));
      else { _kitGroup = 'all'; renderAssets(); return; }
    }
    tool.resize();
  }

  function bindGuidelinesActions() {
    var content = $('kit-content');
    if (!content || !content.querySelector) return;
    var pdfBtn = content.querySelector('#btn-guidelines-pdf');
    if (pdfBtn) pdfBtn.addEventListener('click', exportGuidelinesPdf);
    var copyBtn = content.querySelector('#btn-guidelines-copy');
    if (copyBtn) copyBtn.addEventListener('click', function () { copyText(buildBrandSummary(logoCfg()), 'Brand summary copied ✓'); });
  }

  /* ---------- P5-04 / P5-06 kit settings UI ---------- */
  function updateNameSample() {
    var el = $('f-name-sample');
    if (el) el.textContent = assetSlug() + '-primary-logo.svg';
  }
  function renderExportPrefs() {
    var wrap = $('export-prefs');
    if (!wrap) return;
    var rows = ASSET_GROUPS.filter(function (g) { return g.id !== 'digital'; }).map(function (g) {
      var cur = groupFormats(g.id);
      var chips = ['svg', 'png', 'webp', 'ico'].map(function (fmt) {
        var on = cur.indexOf(fmt) > -1;
        return '<button class="bsg-fmt' + (on ? ' active' : '') + '" data-g="' + g.id + '" data-f="' + fmt + '">' + fmt.toUpperCase() + '</button>';
      }).join('');
      return '<div class="bsg-exp-row"><span class="bsg-exp-label">' + g.icon + ' ' + escHtml(g.label) + '</span><span class="bsg-exp-chips">' + chips + '</span></div>';
    }).join('');
    wrap.innerHTML = rows + '<p class="bsg-hint">These formats go into the ZIP. Formats an asset does not support (e.g. WebP on print) are skipped automatically.</p>';
    var btns = wrap.querySelectorAll('.bsg-fmt');
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        b.addEventListener('click', function () {
          var gid = b.getAttribute('data-g'), fmt = b.getAttribute('data-f');
          var arr = groupFormats(gid);
          var idx = arr.indexOf(fmt);
          if (idx > -1) arr.splice(idx, 1); else arr.push(fmt);
          if (!DB.export) DB.export = {};
          if (!DB.export.formats) DB.export.formats = {};
          DB.export.formats[gid] = arr;
          persist();
          renderExportPrefs();
          notify('ZIP formats for ' + groupLabel(gid) + ': ' + arr.join(', ').toUpperCase(), 'info');
        });
      })(btns[i]);
    }
  }

  function assetCard(a, cfg) {
    var card = document.createElement('div');
    card.className = 'bsg-asset';
    var res;
    try { res = a.build(); } catch (e) { res = { svg: '', w: 1, h: 1 }; }

    var rastSvg = res.staticSvg || res.svg;
    var prev = document.createElement('div');
    prev.className = 'bsg-asset-preview' + (a.dark || _darkKit ? ' dark' : '');
    prev.setAttribute('title', 'Click to enlarge');
    if (res.svg) {
      if (a.inline) {
        prev.innerHTML = res.svg;
        var inlineSvg = prev.querySelector ? prev.querySelector('svg') : null;
        if (inlineSvg) {
          inlineSvg.style.maxWidth = '92%';
          inlineSvg.style.maxHeight = '92%';
        }
      } else {
        var img = document.createElement('img');
        img.src = dataUriSvg(res.svg);
        img.alt = a.title;
        prev.appendChild(img);
      }
      prev.addEventListener('click', function () { openLightbox(a.title, res.svg, res.w, res.h, a.filename, rastSvg); });
    } else if (res.cardHtml) {
      prev.innerHTML = res.cardHtml;
      prev.addEventListener('click', function () { openLightboxHtml(a.title, res.cardHtml, a.filename); });
    } else if (res.html) {
      prev.innerHTML = '<div style="text-align:center;color:#64748b;font-size:12px;padding:10px"><div style="font-size:26px;margin-bottom:6px">✉️</div>' + (a.previewNote || 'Copy the HTML block into<br>your email client signature') + '</div>';
      prev.addEventListener('click', function () { openLightboxHtml(a.title, res.html, a.filename); });
    } else if (res.text) {
      prev.innerHTML = '<div style="text-align:center;color:#64748b;font-size:12px;padding:10px;white-space:pre-line;max-height:120px;overflow:hidden">' + escHtml(res.text.split('\n').slice(0, 7).join('\n')) + '</div>';
      prev.addEventListener('click', function () { openLightboxText(a.title, res.text); });
    }
    var tagEl = document.createElement('span');
    tagEl.className = 'bsg-asset-tag';
    tagEl.textContent = a.tag;
    prev.appendChild(tagEl);
    card.appendChild(prev);

    var body = document.createElement('div');
    body.className = 'bsg-asset-body';
    body.innerHTML = '<div class="bsg-asset-title">' + escHtml(a.title) + '</div><div class="bsg-asset-desc">' + escHtml(a.desc) + '</div>';
    var actions = document.createElement('div');
    actions.className = 'bsg-asset-actions';
    if (res.svg) {
      actions.appendChild(assetBtn('SVG', function () { downloadBlobText(res.svg, a.filename, 'image/svg+xml'); notify('Downloaded ' + a.title + ' (SVG)', 'success'); }));
      actions.appendChild(assetBtn('PNG', function () {
        svgToPng(rastSvg, res.w, res.h, function (err, dataUrl) {
          if (err) { notify(err, 'warning'); return; }
          downloadDataUrl(dataUrl, a.filename.replace('.svg', '.png'));
          notify('Downloaded ' + a.title + ' (PNG)', 'success');
        });
      }));
      if (a.webp) {
        actions.appendChild(assetBtn('WebP', function () {
          if (!webpSupported()) { notify('WebP is not supported in this browser — use PNG instead.', 'warning'); return; }
          svgToPng(rastSvg, res.w, res.h, function (err, dataUrl) {
            if (err) { notify(err, 'warning'); return; }
            downloadDataUrl(dataUrl, a.filename.replace('.svg', '.webp'));
            notify('Downloaded ' + a.title + ' (WebP)', 'success');
          }, { mime: 'image/webp' });
        }));
      }
      if (a.icoSizes) {
        actions.appendChild(assetBtn('ICO', function () {
          notify('Generating .ico (16–64px)…', 'info');
          svgToIco(rastSvg, res.w, res.h, a.icoSizes, function (err, blob) {
            if (err) { notify(err, 'warning'); return; }
            var url = URL.createObjectURL(blob);
            triggerDownload(url, a.filename.replace('.svg', '.ico'));
            setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
            notify('Downloaded ' + a.title + ' (ICO, multi-size)', 'success');
          });
        }));
      }
      if (a.pngSizes) {
        a.pngSizes.forEach(function (sz) {
          var info = typeof sz === 'number' ? { size: sz, label: sz } : { size: sz.size, label: sz.label || sz.size };
          actions.appendChild(assetBtn('PNG ' + info.label, function () {
            svgToPng(rastSvg, res.w, res.h, function (err, dataUrl) {
              if (err) { notify(err, 'warning'); return; }
              downloadDataUrl(dataUrl, a.filename.replace('.svg', '-' + info.size + '.png'));
              notify('Downloaded ' + a.title + ' (' + info.label + 'px)', 'success');
            }, { pngW: info.size, pngH: info.size });
          }));
        });
      }
    } else if (res.cardHtml || res.html) {
      actions.appendChild(assetBtn('Copy', function () { copyText(res.cardHtml || res.html, 'Copied ✓'); }));
      actions.appendChild(assetBtn('Download', function () { downloadBlobText(res.cardHtml || res.html, a.filename, 'text/html'); }));
    } else if (res.text) {
      var isJson = a.id === 'brand-json';
      actions.appendChild(assetBtn('Copy', function () { copyText(res.text, isJson ? 'Brand JSON copied ✓' : 'Copied ✓'); }));
      actions.appendChild(assetBtn('Download', function () { downloadBlobText(res.text, a.filename, isJson ? 'application/json' : (a.mime || 'text/plain')); }));
    }
    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  function assetBtn(label, fn) {
    var b = document.createElement('button');
    b.className = 'bsg-btn bsg-btn-ghost bsg-btn-sm';
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }

  /* --------------------------------------------------------
     Lightbox
  -------------------------------------------------------- */
  function setLbBg(bg) {
    var stage = $('lightbox-stage');
    stage.setAttribute('data-bg', bg);
    stage.style.background = bg === 'brand' ? (logoCfg().bg || '#4f46e5') : '';
    var btns = document.querySelectorAll('.bsg-lb-bg');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-lbbg') === bg);
    }
  }
  function showLbBgButtons(show) {
    var wrap = $('lb-bg-btns');
    if (wrap) wrap.style.display = show ? '' : 'none';
    var scale = $('lb-scale');
    if (scale) scale.style.display = show ? '' : 'none';
  }
  function openLightbox(title, svg, w, h, filename, pngSvg) {
    _lb = { kind: 'svg', title: title, svg: svg, pngSvg: pngSvg || svg, w: w, h: h, filename: filename };
    $('lightbox-title').textContent = title;
    $('lightbox-stage').innerHTML = svg;
    $('lb-download-png').style.display = '';
    $('lb-download-html').style.display = 'none';
    showLbBgButtons(true);
    setLbBg('checker');
    $('lightbox').style.display = 'flex';
  }
  function openLightboxHtml(title, html, filename) {
    _lb = { kind: 'html', title: title, html: html, filename: filename };
    $('lightbox-title').textContent = title;
    $('lightbox-stage').innerHTML = '<div class="bsg-lb-html">' + html + '</div>';
    $('lb-download-png').style.display = 'none';
    $('lb-download-html').style.display = '';
    showLbBgButtons(false);
    $('lightbox-stage').style.background = '';
    $('lightbox').style.display = 'flex';
  }
  function openLightboxText(title, text) {
    _lb = { kind: 'text', title: title, text: text };
    $('lightbox-title').textContent = title;
    $('lightbox-stage').innerHTML = '<pre class="bsg-lb-html" style="margin:0;white-space:pre-wrap;font-size:13px">' + escHtml(text) + '</pre>';
    $('lb-download-png').style.display = 'none';
    $('lb-download-html').style.display = 'none';
    showLbBgButtons(false);
    $('lightbox-stage').style.background = '';
    $('lightbox').style.display = 'flex';
  }
  function closeLightbox() { $('lightbox').style.display = 'none'; _lb = null; }

  /* --------------------------------------------------------
     Steps
  -------------------------------------------------------- */
  function switchStep(n) {
    _step = n;
    [1, 2, 3, 4].forEach(function (i) {
      $('pane-' + i).style.display = i === n ? '' : 'none';
    });
    var steps = document.querySelectorAll('.bsg-step');
    for (var i = 0; i < steps.length; i++) {
      steps[i].classList.toggle('active', parseInt(steps[i].getAttribute('data-step'), 10) === n);
    }
    if (n === 2) { renderPreview(); }
    if (n === 3) { renderLab(); }
    if (n === 4) { renderAssets(); }
    tool.resize();
  }

  /* --------------------------------------------------------
     AI taglines
  -------------------------------------------------------- */
  var TAGLINE_FALLBACKS = [
    '{name} — built for what comes next.',
    '{name}: where ideas take shape.',
    'Think {industry}. Think {name}.',
    'The {industry} standard.',
    '{name} — simply better.',
    'Moving {industry} forward.',
    'Experience the {name} difference.',
    'Crafted for today. Ready for tomorrow.'
  ];

  function requestTaglines() {
    var c = DB.company;
    var btn = $('btn-ai-tagline');
    var aiEnabled = true;
    try { aiEnabled = String(tool.param('aiEnabled', 'yes')) !== 'no'; } catch (e) {}
    if (!tool.requestAI || !aiEnabled) { showFallbackTaglines(); return; }
    if (btn) { btn.disabled = true; btn.textContent = '✨ Generating…'; }
    var prompt = 'Write 8 short, memorable brand taglines (maximum 6 words each) for the company described below. '
      + 'Reply with ONLY one tagline per line, no numbering, no quotes, no explanations. Match the brand personality and industry.';
    var context = 'Company name: ' + (c.name || DEFAULT_NAME)
      + '\nIndustry: ' + (c.industry || '')
      + '\nCurrent tagline: ' + (c.tagline || '')
      + '\nPersonality: ' + (c.personality || []).join(', ')
      + '\nBrand color: ' + (c.brandColor || '');
    tool.requestAI(prompt, context, function (err, resp) {
      if (btn) { btn.disabled = false; btn.textContent = '✨ AI tagline ideas'; }
      if (resp && String(resp).trim()) {
        var lines = String(resp).split('\n')
          .map(function (l) { return l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/["']/g, '').trim(); })
          .filter(function (l) { return l.length > 3 && l.length < 90; })
          .slice(0, 8);
        if (lines.length) { renderTaglineIdeas(lines); return; }
      }
      if (err) notify('AI unavailable: ' + err + ' — showing template ideas.', 'warning');
      showFallbackTaglines();
    });
  }

  function showFallbackTaglines() {
    var c = DB.company;
    var industry = (c.industry || '').split(' ')[0].toLowerCase() || 'business';
    var ideas = TAGLINE_FALLBACKS.map(function (t) {
      return t.replace('{name}', c.name || DEFAULT_NAME).replace('{industry}', industry);
    });
    renderTaglineIdeas(ideas);
  }

  function renderTaglineIdeas(ideas) {
    var wrap = $('tagline-ideas');
    if (!wrap) return;
    wrap.style.display = '';
    wrap.innerHTML = '<div class="bsg-ti-title">💡 Pick a tagline</div>' + ideas.map(function (t) {
      return '<div class="bsg-ti-item"><span>' + escHtml(t) + '</span><button>Use</button></div>';
    }).join('');
    var items = wrap.querySelectorAll('.bsg-ti-item');
    for (var i = 0; i < items.length; i++) {
      (function (item, text) {
        item.querySelector('button').addEventListener('click', function () {
          DB.company.tagline = text;
          var f = $('f-tagline'); if (f) f.value = text;
          persist();
          wrap.style.display = 'none';
          notify('Tagline set ✓', 'success');
          scheduleStudioRefresh();
        });
      })(items[i], ideas[i]);
    }
  }

  /* --------------------------------------------------------
     Creative Lab (Phase 2 — AI Intelligence)
  -------------------------------------------------------- */
  var CHAT_TYPE = 'ai-chat-sessions-uniconbaseapps';
  var LAB_TABS = [
    { id: 'ideas', icon: '🎲', label: 'Logo Ideas' },
    { id: 'chat', icon: '🤖', label: 'Brand Consultant' },
    { id: 'voice', icon: '🗣️', label: 'Brand Voice Pack' },
    { id: 'naming', icon: '✏️', label: 'Naming & Domains' },
    { id: 'ab', icon: '🅰️', label: 'Tagline A/B' },
    { id: 'photo', icon: '🎨', label: 'Palette from Photo' },
    { id: 'mood', icon: '🕶️', label: 'Competitor Moodboard' }
  ];
  var VOICE_ITEMS = [
    { id: 'about50', label: 'About Us — 50 words', hint: 'Short boilerplate for website footers.' },
    { id: 'about100', label: 'About Us — 100 words', hint: 'Standard company description.' },
    { id: 'about250', label: 'About Us — 250 words', hint: 'Full “About” page copy.' },
    { id: 'pitch', label: 'Elevator Pitch', hint: '30-second verbal introduction.' },
    { id: 'mission', label: 'Mission & Vision', hint: 'Mission + vision statements.' },
    { id: 'press', label: 'Press Release Template', hint: 'Launch-ready press release skeleton.' }
  ];

  function aiAvailable() { return typeof tool.requestAI === 'function'; }
  function aiRequest(prompt, context, cb) {
    if (!aiAvailable()) { cb('AI channel is not enabled (allowAi).', null); return; }
    tool.requestAI(prompt, context, cb);
  }

  function renderLab() {
    renderLabNav();
    renderLabContent();
    tool.resize();
  }

  function renderLabNav() {
    var nav = $('lab-nav');
    if (!nav) return;
    nav.innerHTML = '';
    LAB_TABS.forEach(function (t) {
      var btn = document.createElement('button');
      btn.className = 'bsg-kit-nav-btn' + (_labTab === t.id ? ' active' : '');
      btn.innerHTML = '<span class="bsg-kit-nav-ico">' + t.icon + '</span><span class="bsg-kit-nav-label">' + escHtml(t.label) + '</span>';
      btn.addEventListener('click', function () { _labTab = t.id; renderLab(); });
      nav.appendChild(btn);
    });
  }

  function renderLabContent() {
    var content = $('lab-content');
    if (!content) return;
    content.innerHTML = '';
    var sec = document.createElement('div');
    sec.className = 'bsg-lab-sec';
    if (_labTab === 'ideas') sec.appendChild(renderIdeasEl());
    else if (_labTab === 'chat') sec.appendChild(renderChatEl());
    else if (_labTab === 'voice') sec.appendChild(renderVoiceEl());
    else if (_labTab === 'naming') sec.appendChild(renderNamingEl());
    else if (_labTab === 'ab') sec.appendChild(renderAbEl());
    else if (_labTab === 'photo') sec.appendChild(renderPhotoEl());
    else sec.appendChild(renderMoodEl());
    content.appendChild(sec);
    bindLabActions(content);
  }

  function bindLabActions(content) {
    if (!content.querySelector) return;
    var el = function (sel) { return content.querySelector(sel); };
    var shuffle = el('#btn-idea-shuffle');
    if (shuffle) shuffle.addEventListener('click', function () { _ideaSeed = (_ideaSeed + 1) % 1000; renderLab(); });
    var ideaBtns = content.querySelectorAll('.bsg-idea-apply');
    for (var i = 0; i < ideaBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () { applyIdea(parseInt(btn.getAttribute('data-i'), 10)); });
      })(ideaBtns[i]);
    }
    var send = el('#btn-chat-send');
    if (send) send.addEventListener('click', sendChat);
    var chatIn = el('#chat-input');
    if (chatIn) chatIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendChat(); });
    var box = el('#chat-box');
    if (box) box.scrollTop = box.scrollHeight;
    var voiceBtns = content.querySelectorAll('.bsg-voice-gen');
    for (var v = 0; v < voiceBtns.length; v++) {
      (function (btn) {
        btn.addEventListener('click', function () { genVoice(btn.getAttribute('data-v')); });
      })(voiceBtns[v]);
    }
    var voiceCopies = content.querySelectorAll('.bsg-voice-copy');
    for (var c = 0; c < voiceCopies.length; c++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var key = btn.getAttribute('data-v');
          if (key) copyText(_voice[key] || '', 'Copied ✓');
        });
      })(voiceCopies[c]);
    }
    var genNames = el('#btn-gen-names');
    if (genNames) genNames.addEventListener('click', genNames);
    var nameCopies = content.querySelectorAll('.bsg-name-copy');
    for (var n = 0; n < nameCopies.length; n++) {
      (function (btn) {
        btn.addEventListener('click', function () { copyText(btn.getAttribute('data-t'), 'Name copied ✓'); });
      })(nameCopies[n]);
    }
    var domCopies = content.querySelectorAll('.bsg-domain-chip');
    for (var dd = 0; dd < domCopies.length; dd++) {
      (function (btn) {
        btn.addEventListener('click', function () { copyText(btn.getAttribute('data-t'), 'Domain copied ✓'); });
      })(domCopies[dd]);
    }
    var abTags = el('#ab-tags');
    if (abTags) abTags.addEventListener('input', function () {
      DB.lab.abTaglines = abTags.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      persist();
    });
    var abUpdate = el('#btn-ab-update');
    if (abUpdate) abUpdate.addEventListener('click', function () { renderLab(); });
    var abSvg = el('#btn-ab-svg');
    if (abSvg) abSvg.addEventListener('click', function () {
      var tags = DB.lab.abTaglines.length ? DB.lab.abTaglines : [logoCfg().tagline || logoCfg().name];
      var sheet = buildAbSheetSvg(logoCfg(), tags);
      downloadBlobText(sheet.svg, slugify(DB.company.name || DB.company.legalName || 'brand') + '-tagline-ab.svg', 'image/svg+xml');
      notify('A/B sheet downloaded (SVG)', 'success');
    });
    var abPng = el('#btn-ab-png');
    if (abPng) abPng.addEventListener('click', function () {
      var tags = DB.lab.abTaglines.length ? DB.lab.abTaglines : [logoCfg().tagline || logoCfg().name];
      var sheet = buildAbSheetSvg(logoCfg(), tags);
      svgToPng(sheet.svg, sheet.w, sheet.h, function (err, dataUrl) {
        if (err) { notify(err, 'warning'); return; }
        downloadDataUrl(dataUrl, slugify(DB.company.name || DB.company.legalName || 'brand') + '-tagline-ab.png');
        notify('A/B sheet downloaded (PNG)', 'success');
      });
    });
    var photoUp = el('#btn-photo-upload');
    if (photoUp) photoUp.addEventListener('click', doPhotoUpload);
    var photoSw = content.querySelectorAll('.bsg-photo-swatch');
    for (var p = 0; p < photoSw.length; p++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var hex = btn.getAttribute('data-hex');
          DB.company.brandColor = hex;
          var fc = $('f-color'); if (fc) fc.value = hex;
          persist();
          renderSwatches();
          renderPalettePreview();
          scheduleStudioRefresh();
          notify('Brand color set to ' + hex + ' ✓', 'success');
        });
      })(photoSw[p]);
    }
    var moodIn = el('#mood-input');
    if (moodIn) moodIn.addEventListener('input', function () { syncMoodCompetitors(moodIn.value); });
    var moodColors = content.querySelectorAll('.bsg-mood-color-input');
    for (var m = 0; m < moodColors.length; m++) {
      (function (inp) {
        inp.addEventListener('input', function () {
          var idx = parseInt(inp.getAttribute('data-i'), 10);
          if (DB.lab.competitors[idx]) DB.lab.competitors[idx].color = inp.value;
          persist();
        });
      })(moodColors[m]);
    }
  }

  /* ---------- P2-01 Logo ideas ---------- */
  function ideaCfg(i) {
    var base = logoCfg();
    var pal = effectivePalette();
    var ids = Object.keys(ICONS).filter(function (id) { return ICONS[id].cat !== 'ui'; });
    var seed = _ideaSeed;
    var defs = [
      { layout: 'horizontal', shape: 'rounded', color: base.primary },
      { layout: 'stacked', shape: 'circle', color: base.primary },
      { layout: 'emblem', shape: 'circle', color: base.primary },
      { layout: 'horizontal', shape: 'squircle', color: pal.accent },
      { layout: 'horizontal', shape: 'none', color: pal.dark, icon: ids[(seed + 2) % ids.length], font: 'montserrat' },
      { layout: 'mark', shape: 'rounded', color: base.primary, icon: ids[(seed + 1) % ids.length] }
    ];
    var d = defs[i % defs.length];
    return Object.assign({}, base, {
      layout: d.layout,
      shape: d.shape,
      iconId: d.icon || base.iconId,
      fontId: d.font || base.nameFont,
      primary: d.color,
      bg: d.color,
      text: pal.dark,
      tag: pal.muted
    });
  }

  function applyIdea(i) {
    var cfg2 = ideaCfg(i);
    var lg = DB.logo;
    lg.layout = cfg2.layout;
    lg.shape = cfg2.shape;
    lg.iconId = cfg2.iconId;
    lg.fontId = cfg2.fontId;
    lg.override = { primary: cfg2.primary, text: '', tag: '', bg: cfg2.bg };
    persist();
    renderAll();
    switchStep(2);
    notify('Idea applied — refine it in the Logo Studio ✓', 'success');
  }

  function renderIdeasEl() {
    var card = document.createElement('div');
    card.className = 'bsg-card';
    card.innerHTML = '<h2>🎲 Logo Ideas</h2>'
      + '<p class="bsg-hint">Six auto-generated directions from your brand settings. Pick one to apply, or shuffle for fresh options.</p>'
      + '<div style="margin-top:12px"><button class="bsg-btn bsg-btn-ghost bsg-btn-sm" id="btn-idea-shuffle">🔀 Shuffle ideas</button></div>';
    var grid = document.createElement('div');
    grid.className = 'bsg-ideas-grid';
    for (var i = 0; i < 6; i++) {
      var cfg2 = ideaCfg(i);
      var logo = buildLogo(cfg2, { mode: 'color' });
      var cell = document.createElement('div');
      cell.className = 'bsg-idea-card';
      cell.innerHTML = '<div class="bsg-idea-preview"><img src="' + dataUriSvg(logo.svg) + '" alt="Idea ' + (i + 1) + '"></div>'
        + '<div class="bsg-idea-meta">' + escHtml(cfg2.layout) + ' · ' + escHtml(cfg2.shape) + ' · ' + escHtml((FONTS[cfg2.fontId] || FONTS.poppins).label) + '</div>'
        + '<button class="bsg-btn bsg-btn-primary bsg-btn-sm bsg-idea-apply" data-i="' + i + '">Use this design</button>';
      grid.appendChild(cell);
    }
    card.appendChild(grid);
    return card;
  }

  /* ---------- P2-02 AI brand consultant chat ---------- */
  function chatMessages() { return DB.chat.messages || []; }

  function pushChat(role, text) {
    var u = getUserSafe() || {};
    var msg = {
      role: role,
      text: text,
      time: new Date().toISOString(),
      userId: role === 'user' ? (u.id || 'anon') : 'ai',
      userName: role === 'user' ? (u.name || 'User') : 'AI Assistant'
    };
    DB.chat.messages.push(msg);
    if (DB.chat.messages.length > 60) DB.chat.messages = DB.chat.messages.slice(-60);
    persist();
    mirrorChatToSession();
    return msg;
  }

  function mirrorChatToSession() {
    if (typeof tool.requestObjects !== 'function') {
      if (!_chatWarned) {
        _chatWarned = true;
        notify('Chat history is kept in this form (object storage not enabled for this tool).', 'warning');
      }
      return;
    }
    var msgs = DB.chat.messages.slice(-500);
    var dcb = { messages: msgs, updatedAt: new Date().toISOString() };
    if (!DB.chat.sessionId) {
      var first = msgs.length ? msgs[0].text.slice(0, 60) : 'Brand chat';
      var u = getUserSafe() || {};
      dcb.createdAt = new Date().toISOString();
      dcb.createdBy = { userId: u.id || 'anon', userName: u.name || 'User' };
      tool.requestObjects('create', { mainObjectType: CHAT_TYPE, name: first, productData: { data_categoriesBased: dcb } }, function (err, res) {
        if (!err && res && res.object && res.object.id) { DB.chat.sessionId = res.object.id; persist(); }
      });
    } else {
      tool.requestObjects('update', { mainObjectType: CHAT_TYPE, objectId: DB.chat.sessionId, productData: { data_categoriesBased: dcb } }, function () {});
    }
  }

  function sendChat() {
    var content = $('lab-content');
    var input = content && content.querySelector ? content.querySelector('#chat-input') : null;
    var text = (input && input.value ? input.value : '').trim();
    if (!text || _labBusy) return;
    if (input) input.value = '';
    pushChat('user', text);
    _labBusy = true;
    renderLab();
    var prompt = 'You are a senior brand identity consultant for an agency. Analyze the JSON brand manifest below and answer the user\'s question. '
      + 'Be specific and practical: critique the logo choices, suggest concrete palette/typography improvements, propose names or positioning when asked. '
      + 'Answer in plain paragraphs (max ~200 words) — no markdown headers.';
    aiRequest(prompt, 'BRAND MANIFEST:\n' + JSON.stringify(brandManifest(false), null, 2) + '\n\nUSER QUESTION: ' + text, function (err, resp) {
      _labBusy = false;
      if (resp && String(resp).trim()) pushChat('ai', String(resp).trim());
      else pushChat('ai', err ? '⚠️ ' + err + ' — the AI channel is unavailable. Check the allowAi field setting.' : 'The AI returned an empty response.');
      renderLab();
    });
  }

  function renderChatEl() {
    var card = document.createElement('div');
    card.className = 'bsg-card';
    var msgs = chatMessages();
    var html = '<h2>🤖 AI Brand Consultant</h2>'
      + '<p class="bsg-hint">Ask anything about your brand — critique the logo, suggest palettes, naming or positioning. Your full brand manifest is shared as context.</p>'
      + '<div class="bsg-chat" id="chat-box">';
    if (!msgs.length) {
      html += '<div class="bsg-chat-empty">👋 Hi! I can see your brand manifest. Ask me e.g. “critique my logo” or “suggest a better palette for a fintech brand”.</div>';
    }
    msgs.forEach(function (m) {
      var isU = m.role === 'user';
      html += '<div class="bsg-chat-msg ' + (isU ? 'user' : 'ai') + '">' + escHtml(m.text).replace(/\n/g, '<br>')
        + '<div class="bsg-chat-time">' + escHtml(m.userName || (isU ? 'You' : 'AI')) + ' · ' + escHtml((m.time || '').slice(11, 16)) + '</div></div>';
    });
    if (_labBusy) html += '<div class="bsg-chat-think">Thinking…</div>';
    html += '</div>';
    html += '<div class="bsg-chat-input-row"><input class="bsg-input" id="chat-input" placeholder="Ask your brand consultant…"><button class="bsg-btn bsg-btn-primary bsg-btn-sm" id="btn-chat-send">Send</button></div>';
    card.innerHTML = html;
    return card;
  }

  /* ---------- P2-03 Brand voice pack ---------- */
  function voicePromptFor(item) {
    var c = DB.company;
    var ctx = 'Company: ' + (c.name || DEFAULT_NAME)
      + ' · Industry: ' + (c.industry || '')
      + ' · Tagline: ' + (c.tagline || '')
      + ' · Personality: ' + (c.personality || []).join(', ')
      + ' · Colors: ' + (c.brandColor || '');
    if (item.id === 'pitch') return { p: 'Write a 30-second elevator pitch (60-80 words, spoken style) for this company.', c: ctx };
    if (item.id === 'mission') return { p: 'Write a Mission statement and a Vision statement (one sentence each, no labels beyond "Mission:" / "Vision:") for this company.', c: ctx };
    if (item.id === 'press') return { p: 'Write a press-release template for this company with [PLACEHOLDER] fields (headline, dateline, lead, body, quote, boilerplate, contact).', c: ctx };
    return { p: 'Write an "About Us" company description of exactly ' + item.w + ' words, third person, no heading, professional and confident.', c: ctx };
  }

  function voiceFallback(id) {
    var c = DB.company;
    var name = c.name || DEFAULT_NAME;
    var industry = c.industry || 'business';
    var tagline = c.tagline || 'quality, speed and care';
    var base = name + ' is a ' + industry.toLowerCase() + ' company built on ' + tagline + '. We help our customers succeed with clear communication, reliable delivery and genuine care for every detail. Our team combines experience with fresh thinking, so every project is handled from start to finish by people who own the outcome.';
    if (id === 'about50') return base.split('. ').slice(0, 2).join('. ') + '.';
    if (id === 'about100') return base;
    if (id === 'about250') return base + ' Since day one we have focused on doing the fundamentals right: listening carefully, planning openly and measuring honestly. That is how long-term partnerships are built. We invite you to meet the team, visit us, and see for yourself how we put these values into practice every day.';
    if (id === 'pitch') return 'Hi, I\'m from ' + name + '. We are a ' + industry.toLowerCase() + ' company focused on ' + tagline + '. In short: we deliver ' + tagline + ' — reliably, affordably, and with a personal touch. I\'d love ten minutes to show you how we can help.';
    if (id === 'mission') return 'Mission: To deliver ' + tagline + ' through honest work and continuous improvement.\nVision: To become the most trusted name in ' + industry.toLowerCase() + '.';
    return 'FOR IMMEDIATE RELEASE\n\n[HEADLINE]\n\nCITY, Date — ' + name + ' today announced [NEWS]. [Lead sentence with the key facts: what, who, when, where.]\n\n“[QUOTE FROM EXECUTIVE]” said [NAME], [TITLE] of ' + name + '.\n\n[Body paragraphs with details, numbers and context.]\n\nAbout ' + name + ':\n' + base + '\n\nContact:\n[NAME] · [EMAIL] · [PHONE]';
  }

  function genVoice(id) {
    var item = VOICE_ITEMS.filter(function (x) { return x.id === id; })[0];
    if (!item) return;
    _voice[id] = '…generating…';
    renderLab();
    var spec = voicePromptFor(item);
    aiRequest(spec.p, spec.c, function (err, resp) {
      if (resp && String(resp).trim()) _voice[id] = String(resp).trim();
      else {
        if (err) notify('AI unavailable: ' + err + ' — using built-in template.', 'warning');
        _voice[id] = voiceFallback(id);
      }
      renderLab();
    });
  }

  function renderVoiceEl() {
    var card = document.createElement('div');
    card.className = 'bsg-card';
    card.innerHTML = '<h2>🗣️ Brand Voice Pack</h2>'
      + '<p class="bsg-hint">AI-written company copy in your brand voice — generate each piece and copy it wherever you need.</p>';
    var grid = document.createElement('div');
    grid.className = 'bsg-voice-grid';
    VOICE_ITEMS.forEach(function (item) {
      var cell = document.createElement('div');
      cell.className = 'bsg-voice-card';
      var out = _voice[item.id] || '';
      cell.innerHTML = '<h4>' + escHtml(item.label) + '</h4><div class="bsg-hint" style="margin:0">' + escHtml(item.hint) + '</div>'
        + (out ? '<div class="bsg-voice-out">' + escHtml(out) + '</div>' : '')
        + '<div class="bsg-voice-actions">'
        + '<button class="bsg-btn bsg-btn-primary bsg-btn-sm bsg-voice-gen" data-v="' + item.id + '">' + (out ? '↻ Regenerate' : '✨ Generate') + '</button>'
        + (out ? '<button class="bsg-btn bsg-btn-ghost bsg-btn-sm bsg-voice-copy" data-v="' + item.id + '">📋 Copy</button>' : '')
        + '</div>';
      grid.appendChild(cell);
    });
    card.appendChild(grid);
    return card;
  }

  /* ---------- P2-04 Naming & domains ---------- */
  function namingFallback() {
    var c = DB.company;
    var name = c.name || DEFAULT_NAME;
    var industryWord = (c.industry || '').split(/[\s/&]+/)[0].toLowerCase() || 'tech';
    var suffixes = ['Labs', 'Works', 'Studio', 'Co', 'Group', 'HQ', 'One', 'Flow'];
    return suffixes.map(function (s, i) {
      return { name: name + ' ' + s, why: (i === 0 ? 'Research-friendly, signals innovation.' : i === 1 ? 'Craft-focused and approachable.' : i === 2 ? 'Creative, premium feel.' : i === 3 ? 'Short, modern, international.' : 'Solid alternative for a ' + industryWord + ' brand.') };
    }).concat([
      { name: industryWord.charAt(0).toUpperCase() + industryWord.slice(1) + 'ly', why: 'Playful -ly suffix, great for apps.' },
      { name: name.split(' ')[0] + 'ify', why: 'Action-oriented, product-sounding.' }
    ]);
  }

  function genNames() {
    _names = [{ name: '…generating…', why: '' }];
    renderLab();
    var c = DB.company;
    var prompt = 'Suggest 10 alternative brand names (1-3 words each) for this company. Reply with exactly one name per line in the format: Name — short rationale (max 8 words). No numbering, no extra text.';
    var ctx = 'Current name: ' + (c.name || DEFAULT_NAME)
      + ' · Industry: ' + (c.industry || '')
      + ' · Tagline: ' + (c.tagline || '')
      + ' · Personality: ' + (c.personality || []).join(', ');
    aiRequest(prompt, ctx, function (err, resp) {
      if (resp && String(resp).trim()) {
        var lines = String(resp).split('\n').map(function (l) { return l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim(); }).filter(Boolean).slice(0, 10);
        _names = lines.map(function (l) {
          var parts = l.split(/\s+[—–-]\s+/);
          return { name: parts[0].trim(), why: parts[1] || '' };
        });
      } else {
        if (err) notify('AI unavailable: ' + err + ' — using built-in suggestions.', 'warning');
        _names = namingFallback();
      }
      renderLab();
    });
  }

  function domainsFor(name) {
    var s = slugify(name);
    return [s + '.com', s + '.co', s + '.io', s + '.app', 'get' + s + '.com'];
  }

  function renderNamingEl() {
    var card = document.createElement('div');
    card.className = 'bsg-card';
    card.innerHTML = '<h2>✏️ Naming & Domain Ideas</h2>'
      + '<p class="bsg-hint">Alternative names with rationale and matching domain ideas. Availability check needs a registrar API — verify before buying.</p>'
      + '<div style="margin-top:12px"><button class="bsg-btn bsg-btn-primary bsg-btn-sm" id="btn-gen-names">✨ Generate name ideas</button></div>';
    var grid = document.createElement('div');
    grid.className = 'bsg-names-grid';
    _names.forEach(function (n) {
      var cell = document.createElement('div');
      cell.className = 'bsg-name-card';
      cell.innerHTML = '<b>' + escHtml(n.name) + '</b>'
        + (n.why ? '<div class="bsg-name-why">' + escHtml(n.why) + '</div>' : '')
        + '<div class="bsg-name-domains">' + domainsFor(n.name).map(function (d) {
          return '<button class="bsg-domain-chip" data-t="' + escHtml(d) + '">' + escHtml(d) + '</button>';
        }).join('') + '</div>'
        + '<button class="bsg-btn bsg-btn-ghost bsg-btn-sm bsg-name-copy" data-t="' + escHtml(n.name) + '">📋 Copy name</button>';
      grid.appendChild(cell);
    });
    card.appendChild(grid);
    return card;
  }

  /* ---------- P2-05 Tagline A/B sheet ---------- */
  function buildAbSheetSvg(cfg, tags) {
    var W = 1240;
    var rowH = 230;
    var H = 180 + tags.length * (rowH + 22) + 40;
    var inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';
    inner += '<rect x="0" y="0" width="' + W + '" height="120" fill="' + cfg.primary + '"/>';
    inner += '<text x="60" y="60" font-family="' + fontStack(cfg.tagFont) + '" font-size="28" font-weight="700" fill="#ffffff">TAGLINE A/B — COMPARISON SHEET</text>';
    inner += '<text x="60" y="96" font-family="' + fontStack(cfg.tagFont) + '" font-size="18" font-weight="500" fill="#ffffff" fill-opacity="0.9">' + escXml(cfg.name) + '</text>';
    tags.forEach(function (t, i) {
      var y = 150 + i * (rowH + 22);
      var vCfg = Object.assign({}, cfg, { tagline: t });
      var logo = buildLogoParts(vCfg, { mode: 'color' });
      inner += '<rect x="60" y="' + y + '" width="' + (W - 120) + '" height="' + rowH + '" rx="14" fill="#ffffff" stroke="#dbe2ee" stroke-width="1.5"/>';
      var s = Math.min((W - 240) / logo.w, (rowH - 40) / logo.h, 1.4);
      inner += '<g transform="translate(' + (60 + ((W - 120) - logo.w * s) / 2).toFixed(1) + ',' + (y + (rowH - logo.h * s) / 2).toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + logo.inner + '</g>';
      var letter = String.fromCharCode(65 + i);
      inner += '<circle cx="92" cy="' + (y + 26) + '" r="16" fill="' + cfg.primary + '"/>';
      inner += '<text x="92" y="' + (y + 31) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">' + letter + '</text>';
      inner += '<text x="1160" y="' + (y + rowH - 18) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="14" font-weight="600" fill="#64748b" text-anchor="end">' + escXml(t) + '</text>';
    });
    inner += '<text x="' + W / 2 + '" y="' + (H - 24) + '" font-family="' + fontStack(cfg.tagFont) + '" font-size="12" font-weight="500" fill="#94a3b8" text-anchor="middle">Generated by Brand Set Generator</text>';
    return { svg: wrapSvg(inner, W, H), inner: inner, w: W, h: H };
  }

  function renderAbEl() {
    var cfg = logoCfg();
    var tags = DB.lab.abTaglines.length ? DB.lab.abTaglines : [cfg.tagline || cfg.name];
    var card = document.createElement('div');
    card.className = 'bsg-card';
    card.innerHTML = '<h2>🅰️ Tagline A/B Sheet</h2>'
      + '<p class="bsg-hint">List one tagline per line and compare how each one looks under the logo — then export a one-page comparison sheet.</p>'
      + '<textarea class="bsg-input" id="ab-tags" style="min-height:90px;margin-top:12px">' + escHtml(tags.join('\n')) + '</textarea>'
      + '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">'
      + '<button class="bsg-btn bsg-btn-ghost bsg-btn-sm" id="btn-ab-update">🔄 Update previews</button>'
      + '<button class="bsg-btn bsg-btn-ghost bsg-btn-sm" id="btn-ab-svg">⬇ Export A/B sheet (SVG)</button>'
      + '<button class="bsg-btn bsg-btn-ghost bsg-btn-sm" id="btn-ab-png">🖼 Export A/B sheet (PNG)</button>'
      + '</div>';
    var grid = document.createElement('div');
    grid.className = 'bsg-ab-previews';
    tags.forEach(function (t, i) {
      var vCfg = Object.assign({}, cfg, { tagline: t });
      var logo = buildLogo(vCfg, { mode: 'color' });
      var cell = document.createElement('div');
      cell.className = 'bsg-ab-preview';
      cell.innerHTML = '<div class="bsg-ab-thumb"><img src="' + dataUriSvg(logo.svg) + '" alt="' + escHtml(t) + '"></div>'
        + '<div class="bsg-ab-label">' + String.fromCharCode(65 + i) + '</div>'
        + '<div class="bsg-ab-tag">' + escHtml(t) + '</div>';
      grid.appendChild(cell);
    });
    card.appendChild(grid);
    return card;
  }

  /* ---------- P2-06 Palette from photo ---------- */
  function doPhotoUpload() {
    if (!tool.requestUpload) { notify('Upload is not enabled for this tool (allowUpload).', 'warning'); return; }
    tool.requestUpload('image/*', function (err, file) {
      if (err || !file) { if (err) notify('Upload failed: ' + err, 'error'); return; }
      notify('Analyzing photo colors…', 'info');
      extractPaletteFromImage(file.url, function (err2, colors) {
        if (err2) { notify(err2, 'warning'); return; }
        _photoPalette = colors;
        _photoUrl = file.url;
        renderLab();
        notify('Palette extracted — click a swatch to set it as your brand color.', 'success');
      });
    });
  }

  function extractPaletteFromImage(url, cb) {
    var img = new Image();
    var triedFallback = false;
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        var c = document.createElement('canvas');
        c.width = 80; c.height = 80;
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, 80, 80);
        var data = ctx.getImageData(0, 0, 80, 80).data;
        var buckets = {};
        for (var i = 0; i < data.length; i += 16) {
          if (data[i + 3] < 128) continue;
          var r = (data[i] >> 5) << 5, g = (data[i + 1] >> 5) << 5, b = (data[i + 2] >> 5) << 5;
          var key = r + ',' + g + ',' + b;
          buckets[key] = (buckets[key] || 0) + 1;
        }
        var sorted = Object.keys(buckets).sort(function (x, y) { return buckets[y] - buckets[x]; });
        var colors = [];
        var usedHues = [];
        sorted.forEach(function (k) {
          if (colors.length >= 6) return;
          var parts = k.split(',').map(Number);
          var hsl = rgbToHsl({ r: parts[0], g: parts[1], b: parts[2] });
          if (hsl.l < 0.07 || hsl.l > 0.93) return;
          var dup = usedHues.some(function (h) { var d = Math.abs(h - hsl.h); return Math.min(d, 360 - d) < 22; });
          if (dup) return;
          usedHues.push(hsl.h);
          colors.push(rgbToHex(parts[0], parts[1], parts[2]));
        });
        if (!colors.length && sorted.length) {
          var p0 = sorted[0].split(',').map(Number);
          colors.push(rgbToHex(p0[0], p0[1], p0[2]));
        }
        cb(null, colors);
      } catch (e) {
        cb('Color extraction is blocked for this image (external source). Download the image and upload it as a local file, or pick colors manually.', null);
      }
    };
    img.onerror = function () {
      if (!triedFallback) {
        triedFallback = true;
        img.crossOrigin = null;
        img.src = url;
      } else {
        cb('Could not load the image.', null);
      }
    };
    img.src = url;
  }

  function renderPhotoEl() {
    var card = document.createElement('div');
    card.className = 'bsg-card';
    card.innerHTML = '<h2>🎨 Palette from Photo</h2>'
      + '<p class="bsg-hint">Upload a mood photo (moodboard, interior, landscape…) and extract its dominant colors into your brand palette.</p>'
      + '<div style="margin-top:12px"><button class="bsg-btn bsg-btn-primary bsg-btn-sm" id="btn-photo-upload">📤 Upload a photo</button></div>';
    var wrap = document.createElement('div');
    wrap.className = 'bsg-photo-preview';
    if (_photoUrl) {
      var img = document.createElement('img');
      img.src = _photoUrl;
      img.alt = 'Mood photo';
      wrap.appendChild(img);
    }
    if (_photoPalette && _photoPalette.length) {
      var sw = document.createElement('div');
      sw.className = 'bsg-photo-swatches';
      _photoPalette.forEach(function (hex) {
        var s = document.createElement('div');
        s.className = 'bsg-photo-swatch';
        s.setAttribute('data-hex', hex);
        s.title = 'Set as brand color';
        s.innerHTML = '<div class="bsg-photo-color" style="background:' + hex + '"></div><div class="bsg-photo-hex">' + hex.toUpperCase() + '</div>';
        sw.appendChild(s);
      });
      wrap.appendChild(sw);
      var hint = document.createElement('div');
      hint.className = 'bsg-hint';
      hint.style.width = '100%';
      hint.textContent = 'Click any swatch to set it as the brand color — the whole kit updates instantly.';
      wrap.appendChild(hint);
    }
    card.appendChild(wrap);
    return card;
  }

  /* ---------- P2-07 Competitor moodboard ---------- */
  function relLum(hex) {
    var c = hexToRgb(hex);
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function contrastRatio(a, b) {
    var l1 = relLum(a), l2 = relLum(b);
    var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return ((hi + 0.05) / (lo + 0.05)).toFixed(1);
  }

  function syncMoodCompetitors(value) {
    var names = value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var map = {};
    (DB.lab.competitors || []).forEach(function (c) { if (c && c.name) map[c.name] = c; });
    DB.lab.competitors = names.map(function (n) {
      return map[n] || { name: n, color: '#94a3b8' };
    });
    persist();
    renderMoodContentOnly();
  }

  function renderMoodEl() {
    var card = document.createElement('div');
    card.className = 'bsg-card';
    card.innerHTML = '<h2>🕶️ Competitor Moodboard</h2>'
      + '<p class="bsg-hint">List competitors (one per line) and set each one\'s brand color — compare them against your own palette at a glance.</p>'
      + '<textarea class="bsg-input" id="mood-input" style="min-height:70px;margin-top:12px" placeholder="e.g. Stripe\nSquare\nAdyen">' + escHtml((DB.lab.competitors || []).map(function (c) { return c.name; }).join('\n')) + '</textarea>';
    card.appendChild(buildMoodGrid());
    return card;
  }

  function buildMoodGrid() {
    var grid = document.createElement('div');
    grid.className = 'bsg-mood-grid';
    var own = logoCfg();
    var ownCell = document.createElement('div');
    ownCell.className = 'bsg-mood-card own';
    ownCell.innerHTML = '<div class="bsg-mood-color" style="background:' + own.primary + '"><span>' + own.primary.toUpperCase() + '</span></div>'
      + '<div class="bsg-mood-name">' + escHtml(own.name) + ' (you)</div>'
      + '<div class="bsg-mood-vs">Primary brand color</div>';
    grid.appendChild(ownCell);
    (DB.lab.competitors || []).forEach(function (comp, i) {
      var cell = document.createElement('div');
      cell.className = 'bsg-mood-card';
      cell.innerHTML = '<div class="bsg-mood-color" style="background:' + comp.color + '"><span>' + escHtml(comp.color.toUpperCase()) + '</span></div>'
        + '<div class="bsg-mood-name">' + escHtml(comp.name) + '</div>'
        + '<div class="bsg-mood-vs">vs you: ' + contrastRatio(comp.color, own.primary) + ':1 contrast</div>'
        + '<input type="color" class="bsg-mood-color-input" data-i="' + i + '" value="' + comp.color + '" title="Set competitor color">';
      grid.appendChild(cell);
    });
    return grid;
  }

  function renderMoodContentOnly() {
    if (_labTab !== 'mood') return;
    var content = $('lab-content');
    if (!content || !content.querySelector) return;
    var grid = content.querySelector('.bsg-mood-grid');
    if (!grid) { renderLab(); return; }
    var parent = grid.parentNode;
    if (parent && parent.replaceChild) parent.replaceChild(buildMoodGrid(), grid);
    bindLabActions(content);
  }

  /* --------------------------------------------------------
     Upload
  -------------------------------------------------------- */
  function doUpload() {
    if (!tool.requestUpload) { notify('Upload is not enabled for this tool (allowUpload).', 'warning'); return; }
    tool.requestUpload('image/*', function (err, file) {
      if (err || !file) { if (err) notify('Upload failed: ' + err, 'error'); return; }
      DB.logo.uploadUrl = file.url;
      DB.logo.uploadName = file.name;
      DB.logo.source = 'upload';
      persist();
      renderUploadUI();
      updateSourceUI();
      scheduleStudioRefresh();
      notify('Logo uploaded — rebuilding all assets ✓', 'success');
    });
  }

  /* --------------------------------------------------------
     Persist
  -------------------------------------------------------- */
  function persist() {
    if (_saving) return;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(function () {
      _saving = true;
      try {
        DB.branding = brandManifest(false);
        tool.setValue(JSON.parse(JSON.stringify(DB)));
        setSaveState('staged');
        var fieldId = '';
        try { fieldId = String(tool.param('brandJsonFieldId', '') || '').trim(); } catch (e2) {}
        if (fieldId && tool.setField) {
          try { tool.setField(fieldId, JSON.stringify(brandManifest(), null, 2)); } catch (e3) {}
        }
      } catch (e) {}
      setTimeout(function () { _saving = false; }, 400);
    }, 300);
  }
  function setSaveState(kind) {
    var el = $('save-state');
    if (!el) return;
    if (kind === 'staged') { el.textContent = '● Staged — save the form to keep changes'; el.classList.remove('ok'); }
    else if (kind === 'saved') { el.textContent = '✓ Saved'; el.classList.add('ok'); }
    else { el.textContent = 'Ready'; el.classList.remove('ok'); }
  }

  /* --------------------------------------------------------
     User / permissions
  -------------------------------------------------------- */
  function getUserSafe() {
    try { return tool.getUser ? tool.getUser() : null; } catch (e) { return null; }
  }
  function getRoles() {
    var u = _user || getUserSafe();
    if (u && Array.isArray(u.roles) && u.roles.length) return u.roles;
    if (u && u.effectiveAccess) {
      var r = [];
      if (u.effectiveAccess.isManager) r.push('admin');
      if (u.effectiveAccess.isEditor) r.push('editor');
      if (u.effectiveAccess.isViewer) r.push('viewer');
      return r;
    }
    return [];
  }
  function canWrite() {
    if (_noIdentity) return !_readOnly;
    if (_readOnly) return false;
    var r = getRoles();
    return ['admin', 'editor', 'developer', 'owner', 'user-manager'].some(function (x) { return r.indexOf(x) > -1; });
  }
  function refreshUser() {
    _user = getUserSafe();
    if (!_user || !getRoles().length) {
      if (typeof tool.getUser !== 'function') { _noIdentity = true; }
      else if (!_polled) {
        _polled = true;
        [400, 1200, 2600, 5000].forEach(function (ms) {
          setTimeout(function () {
            _user = getUserSafe();
            if (_user && getRoles().length) { _polled = true; }
            renderUser();
            lockUI();
          }, ms);
        });
      }
    }
    renderUser();
    lockUI();
  }
  function renderUser() {
    var badge = $('role-badge');
    if (!badge) return;
    var u = _user || getUserSafe();
    if (!u && _noIdentity) { badge.textContent = '👤 CMS session'; return; }
    if (!u) { badge.textContent = '👤 Guest'; return; }
    var roles = getRoles();
    var label = roles.length ? roles.join(' / ') : 'member';
    badge.textContent = '👤 ' + (u.name || 'User') + ' — ' + label;
  }
  function lockUI() {
    var locked = !canWrite();
    var root = $('bsg-root');
    if (root) root.classList.toggle('bsg-locked', locked);
    $('lock-note').style.display = locked ? '' : 'none';
  }

  /* --------------------------------------------------------
     SDK wiring & entry
  -------------------------------------------------------- */
  function renderAll() {
    renderForm();
    renderStudioControls();
    renderPreview();
    renderLab();
    renderAssets();
    renderUser();
    switchStep(_step || 1);
  }

  function wireEvents() {
    // ---- Step 1 form bindings (bound once; read DB directly) ----
    on('f-legal-name', 'input', function () { DB.company.legalName = this.value; persist(); scheduleStudioRefresh(); });
    on('f-name', 'input', function () { DB.company.name = this.value; persist(); scheduleStudioRefresh(); });
    on('f-industry', 'change', function () { DB.company.industry = this.value; persist(); });
    on('f-tagline', 'input', function () { DB.company.tagline = this.value; persist(); scheduleStudioRefresh(); });
    on('f-palette-style', 'change', function () { DB.company.paletteStyle = this.value; persist(); renderPalettePreview(); refreshAll(); });
    on('f-color', 'input', function () { DB.company.brandColor = this.value; persist(); renderSwatches(); renderPalettePreview(); scheduleStudioRefresh(); });
    var contacts = { 'c-person': 'person', 'c-title': 'title', 'c-email': 'email', 'c-phone': 'phone', 'c-website': 'website', 'c-address': 'address' };
    Object.keys(contacts).forEach(function (id) {
      on(id, 'input', function () { DB.company.contact[contacts[id]] = this.value; persist(); scheduleAssetsRefresh(); });
    });

    // ---- Step 2 studio bindings ----
    on('f-font', 'change', function () { DB.logo.fontId = this.value; persist(); scheduleStudioRefresh(); });
    on('f-tagfont', 'change', function () { DB.logo.tagFontId = this.value; persist(); scheduleStudioRefresh(); });
    on('t-upper', 'change', function () { DB.logo.uppercase = this.checked; persist(); scheduleStudioRefresh(); });
    on('t-tagline', 'change', function () { DB.logo.showTagline = this.checked; persist(); scheduleStudioRefresh(); });
    on('t-shadow', 'change', function () { DB.logo.shadow = this.checked; persist(); scheduleStudioRefresh(); });
    on('r-track', 'input', function () { DB.logo.tracking = parseFloat(this.value); $('track-val').textContent = this.value; persist(); scheduleStudioRefresh(); });
    on('r-scale', 'input', function () { DB.logo.iconScale = parseInt(this.value, 10) / 100; $('scale-val').textContent = this.value + '%'; persist(); scheduleStudioRefresh(); });
    on('f-monogram', 'input', function () { DB.logo.monogram = this.value; persist(); scheduleStudioRefresh(); });
    on('f-upload-fit', 'change', function () { DB.logo.uploadFit = this.value; persist(); scheduleStudioRefresh(); });
    on('r-upload-pad', 'input', function () { DB.logo.uploadPad = parseInt(this.value, 10); $('upload-pad-val').textContent = this.value + '%'; persist(); scheduleStudioRefresh(); });
    var cmap = { 'f-c-primary': 'primary', 'f-c-text': 'text', 'f-c-tag': 'tag', 'f-c-bg': 'bg' };
    Object.keys(cmap).forEach(function (id) {
      on(id, 'input', function () { DB.logo.override[cmap[id]] = this.value; persist(); scheduleStudioRefresh(); });
    });

    // ---- Steps ----
    var steps = document.querySelectorAll('.bsg-step');
    for (var i = 0; i < steps.length; i++) {
      (function (b) {
        b.addEventListener('click', function () { switchStep(parseInt(b.getAttribute('data-step'), 10)); });
      })(steps[i]);
    }
    on('btn-step1-next', 'click', function () {
      persist();
      switchStep(2);
      if (tool.requestSave) {
        tool.requestSave(function () {});
      }
    });
    on('btn-step2-next', 'click', function () {
      persist();
      switchStep(3);
      renderLab();
      if (tool.requestSave) { tool.requestSave(function () {}); }
    });
    on('btn-step3-next', 'click', function () {
      persist();
      switchStep(4);
      renderAssets();
      if (tool.requestSave) {
        tool.requestSave(function (err, ok) {
          if (ok) setSaveState('saved');
        });
      }
    });
    on('btn-ai-tagline', 'click', requestTaglines);
    on('btn-regenerate', 'click', function () { notify('All brand assets rebuilt ✓', 'success'); refreshAll(); });
    on('btn-colors-reset', 'click', function () {
      DB.logo.override = { primary: '', text: '', tag: '', bg: '' };
      persist();
      syncStudioColors();
      scheduleStudioRefresh();
    });

    var segs = [
      { id: 'symbol-type', key: 'symbol' },
      { id: 'layout-type', key: 'layout' },
      { id: 'shape-type', key: 'shape' }
    ];
    segs.forEach(function (seg) {
      var container = $(seg.id);
      if (!container) return;
      var attr = 'data-' + seg.key;
      var btns = container.querySelectorAll('.bsg-seg-btn');
      for (var i = 0; i < btns.length; i++) {
        (function (b) {
          b.addEventListener('click', function () {
            DB.logo[seg.key] = b.getAttribute(attr);
            persist();
            setSeg(container, DB.logo[seg.key]);
            if (seg.key === 'symbol') updateSymbolUI();
            scheduleStudioRefresh();
          });
        })(btns[i]);
      }
    });

    on('icon-search', 'input', debounce(function () { renderIconGrid(); }, 180));

    on('src-builder', 'click', function () { DB.logo.source = 'builder'; persist(); updateSourceUI(); scheduleStudioRefresh(); });
    on('src-upload', 'click', function () {
      if (DB.logo.uploadUrl) { DB.logo.source = 'upload'; persist(); updateSourceUI(); scheduleStudioRefresh(); }
      else doUpload();
    });
    on('btn-upload', 'click', doUpload);
    on('btn-upload-remove', 'click', function () {
      DB.logo.uploadUrl = ''; DB.logo.uploadName = ''; DB.logo.source = 'builder';
      persist(); renderUploadUI(); updateSourceUI(); scheduleStudioRefresh();
    });

    var bgBtns = document.querySelectorAll('.bsg-bg-btn');
    for (var j = 0; j < bgBtns.length; j++) {
      (function (b) {
        b.addEventListener('click', function () {
          $('preview-stage').setAttribute('data-bg', b.getAttribute('data-bg'));
          var all = document.querySelectorAll('.bsg-bg-btn');
          for (var k = 0; k < all.length; k++) all[k].classList.remove('active');
          b.classList.add('active');
        });
      })(bgBtns[j]);
    }

    on('btn-zip', 'click', downloadZip);
    on('btn-pdf-guidelines', 'click', exportGuidelinesPdf);
    on('f-slug', 'input', function () {
      var el = $('f-slug');
      if (el) DB.files.slug = el.value;
      updateNameSample();
      persist();
      scheduleAssetsRefresh();
    });
    on('f-prefix', 'input', function () {
      var el = $('f-prefix');
      if (el) DB.files.prefix = el.value;
      updateNameSample();
      persist();
      scheduleAssetsRefresh();
    });
    on('f-suffix', 'input', function () {
      var el = $('f-suffix');
      if (el) DB.files.suffix = el.value;
      updateNameSample();
      persist();
      scheduleAssetsRefresh();
    });
    var fSlugEl = $('f-slug'); if (fSlugEl) fSlugEl.value = (DB.files && DB.files.slug) || '';
    var fPreEl = $('f-prefix'); if (fPreEl) fPreEl.value = (DB.files && DB.files.prefix) || '';
    var fSufEl = $('f-suffix'); if (fSufEl) fSufEl.value = (DB.files && DB.files.suffix) || '';
    on('btn-kit-dark', 'click', function () {
      _darkKit = !_darkKit;
      var b = $('btn-kit-dark');
      if (b) b.textContent = _darkKit ? '☀️ Light variant' : '🌙 Dark variant';
      renderAssets();
      notify(_darkKit ? 'Dark variant on — logos recolored for dark interfaces.' : 'Back to the standard kit.', 'info');
    });
    on('btn-copy-json', 'click', function () { copyText(JSON.stringify(brandManifest(), null, 2), 'Brand JSON copied ✓'); });
    on('btn-download-json', 'click', function () {
      downloadBlobText(JSON.stringify(brandManifest(), null, 2), slugify(DB.company.name || DB.company.legalName || 'brand') + '-brand.json', 'application/json');
    });
    var lbBgBtns = document.querySelectorAll('.bsg-lb-bg');
    for (var bi = 0; bi < lbBgBtns.length; bi++) {
      (function (b) {
        b.addEventListener('click', function () { setLbBg(b.getAttribute('data-lbbg')); });
      })(lbBgBtns[bi]);
    }
    on('lb-scale', 'change', function () { _lbScale = parseInt(this.value, 10) || 2; });
    on('lb-close', 'click', closeLightbox);
    on('lightbox', 'click', function (e) { if (e.target === this) closeLightbox(); });
    on('lb-download-svg', 'click', function () {
      if (_lb && _lb.kind === 'svg') downloadBlobText(_lb.svg, _lb.filename, 'image/svg+xml');
    });
    on('lb-download-png', 'click', function () {
      if (_lb && _lb.kind === 'svg') {
        svgToPng(_lb.pngSvg || _lb.svg, _lb.w, _lb.h, function (err, dataUrl) {
          if (err) { notify(err, 'warning'); return; }
          downloadDataUrl(dataUrl, _lb.filename.replace('.svg', '.png'));
        }, { scale: _lbScale || 2 });
      }
    });
    on('lb-download-html', 'click', function () {
      if (_lb && _lb.html) downloadBlobText(_lb.html, _lb.filename, 'text/html');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  tool.onReady(function (val) {
    try {
      tool.declareOutput({
        type: 'object',
        description: 'Brand set configuration + machine-readable brand manifest. The branding key mirrors brand.json (company, colors, typography, logo, contact, asset list).',
        properties: { company: { type: 'object' }, logo: { type: 'object' }, branding: { type: 'object' } }
      });
    } catch (e) {}
    try {
      tool.declareParams([{
        name: 'aiEnabled', label: 'AI Tagline Generator', type: 'toggle', default: 'yes',
        hint: "Requires the 'allowAi' field setting. When off, built-in tagline templates are used instead.",
        severity: 'optional'
      }, {
        name: 'brandJsonFieldId', label: 'Brand JSON Sibling Field ID', type: 'text', default: '',
        hint: 'Optional: ID of another field on this CMS form that should always receive the latest brand manifest JSON (auto-written on every change). Leave empty to skip.',
        severity: 'optional'
      }]);
    } catch (e) {}
    try { tool.reportValid(true); } catch (e) {}

    DB = normalize(val);
    _readOnly = !!tool.isReadOnly();
    wireEvents();
    renderAll();
    lockUI();
    refreshUser();

    tool.onValueChange(function (v) {
      if (_saving) return;
      DB = normalize(v);
      renderAll();
    });
    tool.onReadonlyChange(function (ro) {
      _readOnly = !!ro;
      lockUI();
    });
    tool.onUserChange(function (u) {
      _user = u || getUserSafe();
      renderUser();
      lockUI();
    });

    if (document.fonts && document.fonts.ready) {
      _fontsReady = document.fonts.ready.then(function () { renderPreview(); });
    }
  });
})();
