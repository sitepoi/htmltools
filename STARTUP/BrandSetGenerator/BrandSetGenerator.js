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
  var _step = 1;
  var _kitGroup = 'all';    // selected Brand Kit category ('all' = show everything)

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
      }
    };
  }

  function normalize(v) {
    var d = DEFAULTS();
    if (!v || typeof v !== 'object') return d;
    d.company = Object.assign(d.company, (v.company || {}));
    d.company.contact = Object.assign(d.company.contact, ((v.company || {}).contact || {}));
    d.logo = Object.assign(d.logo, (v.logo || {}));
    d.logo.override = Object.assign(d.logo.override, ((v.logo || {}).override || {}));
    if (Array.isArray(v.company.personality)) d.company.personality = v.company.personality;
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
    inner += '<circle cx="525" cy="288" r="132" fill="' + shade(cfg.primary, 0.12) + '"/>';
    var mark = buildLogoParts(cfg, { layout: 'mark', mode: 'white', shape: 'none' });
    var s = Math.min(280 / mark.w, 280 / mark.h);
    inner += '<g transform="translate(' + (525 - mark.w * s / 2).toFixed(1) + ',' + (288 - mark.h * s / 2).toFixed(1) + ') scale(' + s.toFixed(3) + ')">' + mark.inner + '</g>';
    if (DB.company.contact.website) {
      inner += '<text x="525" y="520" font-family="' + fontStack(cfg.tagFont) + '" font-size="21" font-weight="500" fill="#ffffff" fill-opacity="0.85" text-anchor="middle" letter-spacing="2">' + escXml(DB.company.contact.website) + '</text>';
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
    var contactBits = [];
    if (ct.phone) contactBits.push(escHtml(ct.phone));
    if (ct.email) contactBits.push('<a href="mailto:' + escHtml(ct.email) + '" style="color:#334155;text-decoration:none">' + escHtml(ct.email) + '</a>');
    if (ct.website) contactBits.push('<a href="http://' + escHtml(ct.website) + '" style="color:' + cfg.primary + ';text-decoration:none;font-weight:bold">' + escHtml(ct.website) + '</a>');
    var html = '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#334155">'
      + '<tr>'
      + '<td style="padding-right:14px;vertical-align:middle"><img src="' + escHtml(imgSrc) + '" width="' + w + '" height="' + h + '" alt="' + escHtml(c.name) + '" style="display:block;border:0"></td>'
      + '<td style="border-left:2px solid ' + cfg.primary + ';padding-left:14px;vertical-align:middle">'
      + '<div style="font-size:15px;font-weight:bold;color:#0f172a">' + escHtml(ct.person || '') + '</div>'
      + (line2 ? '<div style="color:#64748b;margin-top:2px">' + escHtml(line2) + '</div>' : '')
      + (contactBits.length ? '<div style="margin-top:5px">' + contactBits.join(' &nbsp;•&nbsp; ') + '</div>' : '')
      + '</td></tr></table>';
    return html;
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
        if (a.id === 'email-signature') formats = ['html'];
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
     Asset registry
  -------------------------------------------------------- */
  var ASSET_GROUPS = [
    { id: 'logo', icon: '🎨', label: 'Logo Lockups', desc: 'The core logo in every lockup and color mode.' },
    { id: 'icons', icon: '🧩', label: 'Icons & Favicon', desc: 'Browser tab, app store and profile images.' },
    { id: 'web', icon: '🌐', label: 'Web & Social Media', desc: 'Website headers and social banners.' },
    { id: 'print', icon: '🖨️', label: 'Print & Office', desc: 'Business cards, letterhead and paper assets.' },
    { id: 'digital', icon: '📄', label: 'Digital Assets', desc: 'Email signature, brand JSON and summaries.' }
  ];

  function makeAssets(cfg) {
    var slug = slugify(DB.company.name || DB.company.legalName || 'brand');
    function fname(id, ext) { return slug + '-' + id + '.' + ext; }
    return [
      { id: 'primary-logo', group: 'logo', title: 'Primary Logo', desc: 'Horizontal, full color — use everywhere.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildLogo(cfg, { mode: 'color' }); }, dark: false },
      { id: 'stacked-logo', group: 'logo', title: 'Stacked Logo', desc: 'Vertical lockup for square spaces.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildLogo(cfg, { layout: 'stacked', mode: 'color' }); }, dark: false },
      { id: 'logo-mark', group: 'logo', title: 'Logo Mark', desc: 'Icon/monogram only — avatars, watermarks.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildLogo(cfg, { layout: 'mark', mode: 'color' }); }, dark: false },
      { id: 'mono-black', group: 'logo', title: 'Mono — Black', desc: 'One-color black for print & stamps.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildLogo(cfg, { mode: 'black' }); }, dark: false },
      { id: 'mono-white', group: 'logo', title: 'Mono — White', desc: 'One-color white for dark surfaces.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildLogo(cfg, { mode: 'white' }); }, dark: true },
      { id: 'reversed', group: 'logo', title: 'Reversed', desc: 'White logo on your brand color.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildLogo(cfg, { mode: 'white', bg: true }); }, dark: false },
      { id: 'favicon', group: 'icons', title: 'Favicon', desc: 'Browser tab icon — SVG, PNG 64/180 and real .ico (16–64px).', tag: 'SVG · PNG · ICO', webp: true, icoSizes: [16, 32, 48, 64], build: function () { return buildFavicon(cfg); }, dark: false, pngSizes: [64, 180] },
      { id: 'app-icon', group: 'icons', title: 'App Icon', desc: '1024×1024 store-ready app icon.', tag: 'PNG · WebP', webp: true, build: function () { return buildAppIcon(cfg, 1024, false); }, dark: false },
      { id: 'avatar', group: 'icons', title: 'Social Avatar', desc: 'Circular profile picture, 1024px.', tag: 'PNG · WebP', webp: true, build: function () { return buildAppIcon(cfg, 1024, true); }, dark: false },
      { id: 'banner-light', group: 'web', title: 'Website Banner — Light', desc: '1500×500 header for light websites.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildBanner(cfg, false); }, dark: false },
      { id: 'banner-dark', group: 'web', title: 'Website Banner — Dark', desc: '1500×500 header for dark websites.', tag: 'SVG · PNG · WebP', webp: true, build: function () { return buildBanner(cfg, true); }, dark: true },
      { id: 'business-card-front', group: 'print', title: 'Business Card — Front', desc: '3.5×2 in at 300dpi with your contact details.', tag: 'SVG · PNG', build: function () { return buildCardFront(cfg); }, dark: false },
      { id: 'business-card-back', group: 'print', title: 'Business Card — Back', desc: 'Branded back with centered mark.', tag: 'SVG · PNG', build: function () { return buildCardBack(cfg); }, dark: false },
      { id: 'letterhead', group: 'print', title: 'Letterhead (A4)', desc: 'Official document header + footer.', tag: 'SVG · PNG', build: function () { return buildLetterhead(cfg); }, dark: false },
      { id: 'email-signature', group: 'digital', title: 'Email Signature', desc: 'Copy-paste HTML block for your mail client.', tag: 'HTML', build: function () { return { html: buildEmailSignature(cfg), w: 0, h: 0 }; }, dark: false },
      { id: 'brand-json', group: 'digital', title: 'Brand JSON', desc: 'Machine-readable brand manifest for other apps.', tag: 'JSON', build: function () { return { text: JSON.stringify(brandManifest(), null, 2), w: 0, h: 0 }; }, fname: function (s) { return s + '-brand.json'; }, dark: false },
      { id: 'brand-summary', group: 'digital', title: 'Brand Summary', desc: 'Colors, fonts and rules in plain text.', tag: 'TXT', build: function () { return { text: buildBrandSummary(cfg), w: 0, h: 0 }; }, dark: false }
    ].map(function (a) {
      if (a.fname) a.filename = a.fname(slug);
      else a.filename = fname(a.id, a.id === 'email-signature' ? 'html' : a.id === 'brand-summary' ? 'txt' : 'svg');
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
    var pending = 0, failed = 0;

    function done() {
      pending--;
      if (pending <= 0) cb(null, files, failed);
    }
    function addAsync(fn) {
      pending++;
      fn(done);
    }

    assets.forEach(function (a) {
      var dir = groupLabel(a.group) + '/';
      var res = a.build();
      if (res.html) { files.push({ name: dir + a.filename, text: res.html }); return; }
      if (res.text) { files.push({ name: dir + a.filename, text: res.text }); return; }
      files.push({ name: dir + a.filename, text: res.svg });
      addAsync(function (d) {
        svgToPng(res.svg, res.w, res.h, function (err, dataUrl) {
          if (!err) files.push({ name: dir + a.filename.replace('.svg', '.png'), dataUrl: dataUrl });
          else failed++;
          d();
        });
      });
      if (a.pngSizes) {
        a.pngSizes.forEach(function (sz) {
          addAsync(function (d) {
            svgToPng(res.svg, res.w, res.h, function (err, dataUrl) {
              if (!err) files.push({ name: dir + a.filename.replace('.svg', '-' + sz + '.png'), dataUrl: dataUrl });
              else failed++;
              d();
            }, { pngW: sz, pngH: sz });
          });
        });
      }
      if (a.webp && webpSupported()) {
        addAsync(function (d) {
          svgToPng(res.svg, res.w, res.h, function (err, dataUrl) {
            if (!err) files.push({ name: dir + a.filename.replace('.svg', '.webp'), dataUrl: dataUrl });
            else failed++;
            d();
          }, { mime: 'image/webp' });
        });
      }
      if (a.icoSizes) {
        addAsync(function (d) {
          svgToIco(res.svg, res.w, res.h, a.icoSizes, function (err, blob) {
            if (!err) files.push({ name: dir + a.filename.replace('.svg', '.ico'), blob: blob });
            else failed++;
            d();
          });
        });
      }
    });
    if (!pending) cb(null, files, failed);
  }

  function downloadZip() {
    if (typeof JSZip === 'undefined') {
      notify('ZIP library not loaded — please download assets individually.', 'warning');
      return;
    }
    notify('Packaging brand kit…', 'info');
    collectAllFiles(function (err, files, failed) {
      var zip = new JSZip();
      var root = zip.folder(slugify(DB.company.name || DB.company.legalName || 'brand') + '-brand-kit');
      files.forEach(function (f) {
        if (f.dataUrl) {
          root.file(f.name, f.dataUrl.split(',')[1], { base64: true });
        } else if (f.blob) {
          root.file(f.name, f.blob);
        } else {
          root.file(f.name, f.text);
        }
      });
      zip.generateAsync({ type: 'blob' }).then(function (blob) {
        var url = URL.createObjectURL(blob);
        triggerDownload(url, slugify(DB.company.name || DB.company.legalName || 'brand') + '-brand-kit.zip');
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
    var slug = slugify(DB.company.name || DB.company.legalName || 'brand');
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
    _assetsRefreshTimer = setTimeout(function () { renderAssets(); renderGuidelines(); }, 400);
  }
  var _studioRefreshTimer = null;
  function scheduleStudioRefresh() {
    persist();
    clearTimeout(_studioRefreshTimer);
    _studioRefreshTimer = setTimeout(function () {
      renderPreview();
      renderAssets();
      renderGuidelines();
      syncStudioColors();
    }, 300);
  }
  function refreshAll() { renderPreview(); renderAssets(); renderGuidelines(); }

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
    var allBtn = document.createElement('button');
    allBtn.className = 'bsg-kit-nav-btn bsg-kit-nav-all' + (_kitGroup === 'all' ? ' active' : '');
    allBtn.innerHTML = '<span class="bsg-kit-nav-ico">🗂️</span><span class="bsg-kit-nav-label">Show all items</span><span class="bsg-kit-nav-count">' + assets.length + '</span>';
    allBtn.addEventListener('click', function () { _kitGroup = 'all'; renderAssets(); });
    nav.appendChild(allBtn);
  }

  function renderAssets() {
    var cfg = logoCfg();
    var assets = makeAssets(cfg);
    renderKitNav(assets);
    var content = $('kit-content');
    if (!content) return;
    content.innerHTML = '';
    if (_kitGroup === 'all') {
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

  function assetCard(a, cfg) {
    var card = document.createElement('div');
    card.className = 'bsg-asset';
    var res;
    try { res = a.build(); } catch (e) { res = { svg: '', w: 1, h: 1 }; }

    var prev = document.createElement('div');
    prev.className = 'bsg-asset-preview' + (a.dark ? ' dark' : '');
    prev.setAttribute('title', 'Click to enlarge');
    if (res.svg) {
      var img = document.createElement('img');
      img.src = dataUriSvg(res.svg);
      img.alt = a.title;
      prev.appendChild(img);
      prev.addEventListener('click', function () { openLightbox(a.title, res.svg, res.w, res.h, a.filename); });
    } else if (res.html) {
      prev.innerHTML = '<div style="text-align:center;color:#64748b;font-size:12px;padding:10px"><div style="font-size:26px;margin-bottom:6px">✉️</div>Copy the HTML block into<br>your email client signature</div>';
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
        svgToPng(res.svg, res.w, res.h, function (err, dataUrl) {
          if (err) { notify(err, 'warning'); return; }
          downloadDataUrl(dataUrl, a.filename.replace('.svg', '.png'));
          notify('Downloaded ' + a.title + ' (PNG)', 'success');
        });
      }));
      if (a.webp) {
        actions.appendChild(assetBtn('WebP', function () {
          if (!webpSupported()) { notify('WebP is not supported in this browser — use PNG instead.', 'warning'); return; }
          svgToPng(res.svg, res.w, res.h, function (err, dataUrl) {
            if (err) { notify(err, 'warning'); return; }
            downloadDataUrl(dataUrl, a.filename.replace('.svg', '.webp'));
            notify('Downloaded ' + a.title + ' (WebP)', 'success');
          }, { mime: 'image/webp' });
        }));
      }
      if (a.icoSizes) {
        actions.appendChild(assetBtn('ICO', function () {
          notify('Generating .ico (16–64px)…', 'info');
          svgToIco(res.svg, res.w, res.h, a.icoSizes, function (err, blob) {
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
          actions.appendChild(assetBtn('PNG ' + sz, function () {
            svgToPng(res.svg, res.w, res.h, function (err, dataUrl) {
              if (err) { notify(err, 'warning'); return; }
              downloadDataUrl(dataUrl, a.filename.replace('.svg', '-' + sz + '.png'));
              notify('Downloaded favicon ' + sz + 'px', 'success');
            }, { pngW: sz, pngH: sz });
          }));
        });
      }
    } else if (res.html) {
      actions.appendChild(assetBtn('Copy HTML', function () { copyText(res.html, 'Email signature copied ✓'); }));
      actions.appendChild(assetBtn('Download', function () { downloadBlobText(res.html, a.filename, 'text/html'); }));
    } else if (res.text) {
      var isJson = a.id === 'brand-json';
      actions.appendChild(assetBtn('Copy', function () { copyText(res.text, isJson ? 'Brand JSON copied ✓' : 'Brand summary copied ✓'); }));
      actions.appendChild(assetBtn('Download', function () { downloadBlobText(res.text, a.filename, isJson ? 'application/json' : 'text/plain'); }));
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

  function renderGuidelines() {
    var cfg = logoCfg();
    $('guidelines-body').innerHTML = guidelinesSectionHtml(cfg);
    var sub = $('kit-subtitle');
    if (sub) sub.textContent = 'Browse categories on the left — download individually or as a ZIP.';
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
  }
  function openLightbox(title, svg, w, h, filename) {
    _lb = { kind: 'svg', title: title, svg: svg, w: w, h: h, filename: filename };
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
    [1, 2, 3].forEach(function (i) {
      $('pane-' + i).style.display = i === n ? '' : 'none';
    });
    var steps = document.querySelectorAll('.bsg-step');
    for (var i = 0; i < steps.length; i++) {
      steps[i].classList.toggle('active', parseInt(steps[i].getAttribute('data-step'), 10) === n);
    }
    if (n === 2) { renderPreview(); }
    if (n === 3) { renderAssets(); renderGuidelines(); }
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
    renderAssets();
    renderGuidelines();
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
      renderAssets();
      renderGuidelines();
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
    on('lb-close', 'click', closeLightbox);
    on('lightbox', 'click', function (e) { if (e.target === this) closeLightbox(); });
    on('lb-download-svg', 'click', function () {
      if (_lb && _lb.kind === 'svg') downloadBlobText(_lb.svg, _lb.filename, 'image/svg+xml');
    });
    on('lb-download-png', 'click', function () {
      if (_lb && _lb.kind === 'svg') {
        svgToPng(_lb.svg, _lb.w, _lb.h, function (err, dataUrl) {
          if (err) { notify(err, 'warning'); return; }
          downloadDataUrl(dataUrl, _lb.filename.replace('.svg', '.png'));
        });
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
