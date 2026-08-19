/* ── Legal Document Builder ──
   Chat-driven drafting of legally formatted documents (Word-style, A4).
   Stores ONE document as a blocks array in the CMS field value.
   AI outputs either a full blocks array or block-level edit operations.
   Built for UniconHub CMS html-tool system.
────────────────────────────────────────── */

/* ── Helpers ── */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function el(id) { return document.getElementById(id); }
function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function shortTime(t) {
  if (!t) return '';
  try {
    var d = new Date(t);
    return d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  } catch (e) { return ''; }
}
/** Turkish-safe slug for file names */
function slugify(str) {
  var s = String(str || 'document');
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''); // strip combining marks FIRST
  s = s.replace(/İ/g, 'I').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
       .replace(/ü/g, 'u').replace(/Ü/g, 'U').replace(/ş/g, 's').replace(/Ş/g, 'S')
       .replace(/ö/g, 'o').replace(/Ö/g, 'O').replace(/ç/g, 'c').replace(/Ç/g, 'C');
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'document';
}
/** Document name comes from the parent CMS record — look for name/title fields. */
function resolveTitle() {
  try {
    var f = tool.getFields();
    if (f && typeof f === 'object') {
      for (var k in f) {
        if (!Object.prototype.hasOwnProperty.call(f, k)) continue;
        var kl = String(k).toLowerCase();
        if ((kl === 'name' || kl === 'title' || kl === 'documentname' || kl === 'documentname_s') && f[k] && String(f[k]).trim()) {
          return String(f[k]).trim();
        }
      }
    }
  } catch (e) { /* getFields unavailable — use fallback */ }
  return 'Legal Document';
}
function markdownLite(t) {
  var h = esc(String(t === undefined || t === null ? '' : t));
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  h = h.replace(/`([^`]+)`/g, '<code style="background:#e2e8f0;border-radius:4px;padding:0 4px;font-size:12px">$1</code>');
  return h;
}
function stripTags(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/* ── Constants ── */
var SESSION_TYPE = 'ai-chat-sessions-uniconbaseapps';
var FONTS = ['Times New Roman', 'Georgia', 'Garamond', 'Cambria', 'Arial', 'Calibri', 'Courier New'];
var SIZES = ['10pt', '11pt', '12pt', '13pt', '14pt', '16pt', '18pt'];
var LINEHEIGHTS = ['1.15', '1.5', '1.6', '1.8', '2.0'];

var DEFAULT_SETTINGS = {
  fontFamily: 'Times New Roman',
  fontSize: '12pt',
  color: '#111111',
  lineHeight: '1.6'
};

/* ── State ── */
var DB = {
  version: '1.0.0',
  blocks: [],
  settings: null,          // initialized from params on ready
  activeSessionId: '',
  chatCache: null,         // {sessionId, messages} bounded fallback
  _instanceId: ''          // deterministic id for chat-session isolation
};
var _chatMessages = [];
var _sessions = [];
var _sessionsLoaded = false;
var _aiCallActive = false;
var _reqToken = null;
var _aiTimeoutId = null;
var _thinkingStartTime = 0;
var _lastTokenAt = 0;
var _thinkingTimer = null;
var _thinkingMsgEl = null;
var _streamCallback = null;
var _selTarget = null;     // {idx, type, text}
var _previewBuildSeq = 0;
var _sessionWarnShown = false;

/* ═══════════════════════════════════════════
   LEGAL COMPONENT LIBRARY
   Every renderer outputs INLINE-STYLED semantic HTML only, so the
   exported document is fully self-contained (like CurriculumBuilder).
   ═══════════════════════════════════════════ */
function qFont(f) { return "'" + String(f || 'Times New Roman').replace(/'/g, '') + "'"; }
function S() {
  var s = DB.settings || DEFAULT_SETTINGS;
  return {
    f: qFont(s.fontFamily),
    sz: s.fontSize || '12pt',
    c: s.color || '#111111',
    lh: s.lineHeight || '1.6'
  };
}
function ps(S2, extra) {
  return 'font-family:' + S2.f + ';font-size:' + S2.sz + ';color:' + S2.c + ';line-height:' + S2.lh + ';' + (extra || '');
}
function val(v, d) { return v === undefined || v === null || v === '' ? d : v; }

var LEGAL_COMPONENTS = {
  /* ── Content & generic ── */
  'title': {
    name: 'Document Title', icon: '📜', cat: 'content',
    desc: 'Centered main title with optional subtitle, reference number and date.',
    schema: '{text, subtitle?, refNo?, date?}',
    render: function (d, S2) {
      var h = '<div style="text-align:center;margin:0 0 22px">';
      h += '<h1 style="' + ps(S2, 'font-size:17pt;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;text-align:center;margin:0 0 10px') + '">' + esc(d.text || '') + '</h1>';
      if (d.subtitle) h += '<p style="' + ps(S2, 'text-align:center;font-weight:600;margin:0 0 10px') + '">' + esc(d.subtitle) + '</p>';
      if (d.refNo) h += '<p style="' + ps(S2, 'text-align:center;font-size:11pt;color:#475569;margin:0 0 4px') + '">Ref: ' + esc(d.refNo) + '</p>';
      if (d.date) h += '<p style="' + ps(S2, 'text-align:center;font-size:11pt;color:#475569;margin:0') + '">' + esc(d.date) + '</p>';
      return h + '</div>';
    }
  },
  'paragraph': {
    name: 'Paragraph', icon: '¶', cat: 'content',
    desc: 'Regular justified reading paragraph — the main body text of the document.',
    schema: '{text, align?: "justify"|"left"|"center"}',
    render: function (d, S2) {
      var al = d.align === 'left' ? 'left' : d.align === 'center' ? 'center' : 'justify';
      return '<p style="' + ps(S2, 'text-align:' + al + ';margin:0 0 10px') + '">' + esc(d.text || '') + '</p>';
    }
  },
  'bold-lead': {
    name: 'Bold Lead-in', icon: '🔠', cat: 'content',
    desc: 'Paragraph that starts with a bold lead-in phrase (e.g. "Term:" then the text).',
    schema: '{lead, text}',
    render: function (d, S2) {
      return '<p style="' + ps(S2, 'text-align:justify;margin:0 0 10px') + '"><strong>' + esc(d.lead || '') + '</strong> ' + esc(d.text || '') + '</p>';
    }
  },
  'heading': {
    name: 'Heading', icon: '📑', cat: 'content',
    desc: 'Generic section heading (level 1-3) with a thin bottom rule.',
    schema: '{text, level?: 1|2|3, center?: true}',
    render: function (d, S2) {
      var lvl = parseInt(d.level) || 1;
      var sizes = { 1: '14pt', 2: '13pt', 3: '12pt' };
      var center = d.center ? 'text-align:center;' : '';
      return '<h' + lvl + ' style="' + ps(S2, 'font-size:' + (sizes[lvl] || '12pt') + ';font-weight:700;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid #cbd5e1;' + center) + '">' + esc(d.text || '') + '</h' + lvl + '>';
    }
  },
  'center-line': {
    name: 'Centered Line', icon: '➖', cat: 'content',
    desc: 'A centered line of text (used above schedules, exhibits, captions).',
    schema: '{text, bold?: true}',
    render: function (d, S2) {
      return '<p style="' + ps(S2, 'text-align:center;' + (d.bold ? 'font-weight:700;' : '') + 'margin:0 0 10px') + '">' + esc(d.text || '') + '</p>';
    }
  },
  'bullets': {
    name: 'Bullet List', icon: '•', cat: 'content',
    desc: 'Bulleted list of items.',
    schema: '{items: [string]}',
    render: function (d, S2) {
      var items = d.items || [];
      if (!items.length) return '';
      var h = '<ul style="' + ps(S2, 'margin:0 0 10px;padding-left:30px') + '">';
      for (var i = 0; i < items.length; i++) {
        h += '<li style="' + ps(S2, 'margin-bottom:4px') + '">' + esc(typeof items[i] === 'string' ? items[i] : (items[i].text || '')) + '</li>';
      }
      return h + '</ul>';
    }
  },
  'numbering': {
    name: 'Numbered List', icon: '1️⃣', cat: 'content',
    desc: 'Numbered list; each item may have nested lettered sub-items.',
    schema: '{items: [string | {text, subitems:[]}]}',
    render: function (d, S2) {
      var items = d.items || [];
      if (!items.length) return '';
      var h = '<ol style="' + ps(S2, 'margin:0 0 10px;padding-left:30px') + '">';
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var txt = typeof it === 'string' ? it : (it.text || '');
        h += '<li style="' + ps(S2, 'margin-bottom:4px') + '">' + esc(txt);
        var subs = (it && it.subitems) || [];
        if (subs.length) {
          h += '<ol style="list-style-type:lower-alpha;margin-top:3px;padding-left:24px">';
          for (var j = 0; j < subs.length; j++) {
            h += '<li style="' + ps(S2, 'margin-bottom:2px') + '">' + esc(typeof subs[j] === 'string' ? subs[j] : (subs[j].text || '')) + '</li>';
          }
          h += '</ol>';
        }
        h += '</li>';
      }
      return h + '</ol>';
    }
  },
  'quote': {
    name: 'Quotation', icon: '❝', cat: 'content',
    desc: 'Indented quotation with an optional case/statute citation.',
    schema: '{text, citation?}',
    render: function (d, S2) {
      var h = '<blockquote style="' + ps(S2, 'border-left:3px solid #94a3b8;padding:2px 0 2px 16px;margin:0 0 12px 8px;font-style:italic') + '">' + esc(d.text || '') + '</blockquote>';
      if (d.citation) h += '<p style="' + ps(S2, 'font-size:11pt;color:#475569;text-align:right;margin:0 0 12px') + '">— ' + esc(d.citation) + '</p>';
      return h;
    }
  },
  'legal-callout': {
    name: 'Callout Box', icon: '⚠️', cat: 'content',
    desc: 'Bordered attention box. variant: important (red), warning (amber), note (blue).',
    schema: '{variant?: "important"|"warning"|"note", title?, body}',
    render: function (d, S2) {
      var themes = {
        important: ['#b91c1c', '#fee2e2', '#fca5a5', 'IMPORTANT'],
        warning: ['#92400e', '#fef3c7', '#fcd34d', 'WARNING'],
        note: ['#1d4ed8', '#dbeafe', '#93c5fd', 'NOTE']
      };
      var t = themes[d.variant] || themes.note;
      return '<div style="' + ps(S2, 'border:1px solid ' + t[2] + ';background:' + t[1] + ';border-radius:6px;padding:10px 14px;margin:0 0 12px') + '">' +
        '<p style="' + ps(S2, 'font-weight:700;color:' + t[0] + ';margin:0 0 4px') + '">' + esc(d.title || t[3]) + '</p>' +
        '<p style="' + ps(S2, 'margin:0;color:' + t[0]) + '">' + esc(d.body || '') + '</p></div>';
    }
  },
  'definitions': {
    name: 'Definitions', icon: '📖', cat: 'content',
    desc: 'Defined-terms list: term in bold followed by its definition.',
    schema: '{title?, terms: [{term, definition}]}',
    render: function (d, S2) {
      var terms = d.terms || [];
      if (!terms.length) return '';
      var h = '';
      if (d.title) h += '<p style="' + ps(S2, 'font-weight:700;margin:12px 0 6px') + '">' + esc(d.title) + '</p>';
      h += '<div style="' + ps(S2, 'margin:0 0 12px') + '">';
      for (var i = 0; i < terms.length; i++) {
        var t = terms[i];
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 6px') + '"><strong>“' + esc(t.term) + '”</strong> means ' + esc(t.definition) + '</p>';
      }
      return h + '</div>';
    }
  },
  'table': {
    name: 'Table', icon: '🗂', cat: 'content',
    desc: 'Generic bordered table with a shaded header row.',
    schema: '{columns: [string], rows: [[string]]}',
    render: function (d, S2) {
      var cols = d.columns || [];
      var rows = d.rows || [];
      if (!cols.length) return '';
      var h = '<table style="border-collapse:collapse;width:100%;margin:0 0 12px;' + ps(S2) + '">';
      h += '<thead><tr>';
      for (var c = 0; c < cols.length; c++) {
        h += '<th style="border:1px solid #94a3b8;background:#e2e8f0;padding:6px 10px;text-align:left;font-weight:700">' + esc(cols[c]) + '</th>';
      }
      h += '</tr></thead><tbody>';
      for (var r = 0; r < rows.length; r++) {
        h += '<tr>';
        var row = rows[r] || [];
        for (var c2 = 0; c2 < cols.length; c2++) {
          h += '<td style="border:1px solid #94a3b8;padding:6px 10px;vertical-align:top">' + esc(row[c2] === undefined ? '' : row[c2]) + '</td>';
        }
        h += '</tr>';
      }
      return h + '</tbody></table>';
    }
  },
  'separator': {
    name: 'Horizontal Rule', icon: '➖', cat: 'content',
    desc: 'A thin horizontal rule.',
    schema: '{}',
    render: function (d, S2) {
      return '<hr style="border:none;border-top:1px solid #cbd5e1;margin:14px 0">';
    }
  },
  'page-break': {
    name: 'Page Break', icon: '⏭', cat: 'content',
    desc: 'Forces a new page when printing / exporting to PDF or Word.',
    schema: '{}',
    render: function () {
      return '<div class="lb-page-break"></div>';
    }
  },
  'html': {
    name: 'Raw HTML', icon: '🌐', cat: 'content',
    desc: 'Free-form block: any self-contained HTML, CSS and JS (inline or embedded tags allowed).',
    schema: '{html: "<any html>"}',
    render: function (d) {
      return d.html || '';
    }
  },

  /* ── Document structure ── */
  'parties-block': {
    name: 'Parties', icon: '👥', cat: 'structural',
    desc: '"BETWEEN:" intro with the parties, their details and short names.',
    schema: '{heading?, parties: [{name, details?, alias?}], collectively?}',
    render: function (d, S2) {
      var parties = d.parties || [];
      var h = '<p style="' + ps(S2, 'text-align:center;font-weight:700;text-transform:uppercase;margin:16px 0 10px') + '">' + esc(d.heading || 'BETWEEN') + '</p>';
      for (var i = 0; i < parties.length; i++) {
        var p = parties[i];
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 10px') + '">';
        h += '<strong>' + esc(p.name || '') + '</strong>';
        if (p.details) h += ', ' + esc(p.details);
        if (p.alias) h += ' (hereinafter referred to as <strong>“' + esc(p.alias) + '”</strong>)';
        h += (i < parties.length - 1 ? ';' : '.') + '</p>';
      }
      h += '<p style="' + ps(S2, 'text-align:center;font-weight:700;margin:12px 0') + '">' + esc(val(d.collectively, 'COLLECTIVELY REFERRED TO AS THE “PARTIES”')) + '</p>';
      return h;
    }
  },
  'recitals': {
    name: 'Recitals', icon: '📜', cat: 'structural',
    desc: 'WHEREAS recitals with lettered or numbered entries.',
    schema: '{title?, recitals: [string]}',
    render: function (d, S2) {
      var recs = d.recitals || [];
      if (!recs.length) return '';
      var h = '<p style="' + ps(S2, 'text-align:center;font-weight:700;margin:14px 0 8px') + '">' + esc(val(d.title, 'RECITALS')) + '</p>';
      for (var i = 0; i < recs.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 6px') + '"><strong>WHEREAS</strong>, ' + esc(recs[i]) + ';</p>';
      }
      h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 6px') + '"><strong>NOW, THEREFORE</strong>, the Parties agree as follows:</p>';
      return h;
    }
  },
  'agreement-word': {
    name: 'Agreement Word', icon: '🤝', cat: 'structural',
    desc: 'Lead-in paragraph: "NOW THEREFORE, in consideration… the Parties agree as follows:".',
    schema: '{text?}',
    render: function (d, S2) {
      var t = d.text || 'NOW, THEREFORE, in consideration of the mutual covenants and agreements contained herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Parties agree as follows:';
      return '<p style="' + ps(S2, 'text-align:justify;margin:0 0 12px') + '"><strong>NOW, THEREFORE</strong>, ' + esc(t.replace(/^NOW,?\s*THEREFORE,?\s*/i, '')) + '</p>';
    }
  },
  'section': {
    name: 'Numbered Section', icon: '🔢', cat: 'structural',
    desc: 'Main numbered section heading, e.g. "1. TERM AND TERMINATION".',
    schema: '{number, title}',
    render: function (d, S2) {
      return '<h2 style="' + ps(S2, 'font-size:13pt;font-weight:700;margin:18px 0 8px') + '">' + esc(d.number || '') + (d.number ? '. ' : '') + esc(d.title || '') + '</h2>';
    }
  },
  'subsection': {
    name: 'Numbered Subsection', icon: '🔤', cat: 'structural',
    desc: 'Sub-section heading, e.g. "1.1 Term of Agreement".',
    schema: '{number, title}',
    render: function (d, S2) {
      return '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;font-style:italic;margin:12px 0 6px') + '">' + esc(d.number || '') + (d.number ? '. ' : '') + esc(d.title || '') + '</h3>';
    }
  },
  'clause': {
    name: 'Clause', icon: '📝', cat: 'structural',
    desc: 'A numbered clause paragraph, with optional bold lead-in.',
    schema: '{number?, lead?, text}',
    render: function (d, S2) {
      var h = '<p style="' + ps(S2, 'text-align:justify;margin:0 0 10px') + '">';
      if (d.number) h += '<strong>' + esc(d.number) + '.</strong> ';
      if (d.lead) h += '<strong>' + esc(d.lead) + '</strong> ';
      h += esc(d.text || '') + '</p>';
      return h;
    }
  },
  'sub-clauses': {
    name: 'Lettered Sub-clauses', icon: '🔡', cat: 'structural',
    desc: 'Indented lettered list (a), (b), (c)…',
    schema: '{items: [string | {lead?, text}]}',
    render: function (d, S2) {
      var items = d.items || [];
      if (!items.length) return '';
      var h = '<div style="' + ps(S2, 'margin:0 0 10px 22px') + '">';
      var letters = 'abcdefghijklmnopqrstuvwxyz';
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var lead = typeof it === 'object' ? (it.lead || '') : '';
        var txt = typeof it === 'string' ? it : (it.text || '');
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 6px') + '"><strong>(' + letters[i % 26] + ')</strong> ' + (lead ? '<strong>' + esc(lead) + '</strong> ' : '') + esc(txt) + '</p>';
      }
      return h + '</div>';
    }
  },
  'schedule': {
    name: 'Schedule', icon: '🗓', cat: 'structural',
    desc: 'Schedule heading: "SCHEDULE A — Description".',
    schema: '{letter, title, description?}',
    render: function (d, S2) {
      var h = '<p style="' + ps(S2, 'text-align:center;font-weight:700;text-transform:uppercase;margin:18px 0 8px') + '">SCHEDULE ' + esc(d.letter || 'A') + '</p>';
      h += '<p style="' + ps(S2, 'text-align:center;font-weight:700;margin:0 0 8px') + '">' + esc(d.title || '') + '</p>';
      if (d.description) h += '<p style="' + ps(S2, 'text-align:center;color:#475569;margin:0 0 12px') + '">' + esc(d.description) + '</p>';
      return h;
    }
  },
  'exhibit': {
    name: 'Exhibit', icon: '🏷', cat: 'structural',
    desc: 'Exhibit header: "EXHIBIT A — Title".',
    schema: '{letter, title, description?}',
    render: function (d, S2) {
      var h = '<p style="' + ps(S2, 'text-align:center;font-weight:700;text-transform:uppercase;margin:18px 0 8px') + '">EXHIBIT ' + esc(d.letter || 'A') + '</p>';
      h += '<p style="' + ps(S2, 'text-align:center;font-weight:700;margin:0 0 8px') + '">' + esc(d.title || '') + '</p>';
      if (d.description) h += '<p style="' + ps(S2, 'text-align:center;color:#475569;margin:0 0 12px') + '">' + esc(d.description) + '</p>';
      return h;
    }
  },
  'date-line': {
    name: 'Effective Date Line', icon: '📅', cat: 'structural',
    desc: '"This Agreement is made and entered into as of ___."',
    schema: '{text?}',
    render: function (d, S2) {
      var t = d.text || 'This Agreement is made and entered into as of the ___ day of ____________, 20__ ("Effective Date").';
      return '<p style="' + ps(S2, 'text-align:justify;margin:0 0 12px') + '">' + esc(t) + '</p>';
    }
  },
  'execution-paragraph': {
    name: 'Execution Paragraph', icon: '✒️', cat: 'structural',
    desc: 'Centered "IN WITNESS WHEREOF…" closing paragraph.',
    schema: '{text?}',
    render: function (d, S2) {
      var t = d.text || 'IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.';
      return '<p style="' + ps(S2, 'text-align:center;font-weight:700;margin:20px 0 8px') + '">' + esc(t) + '</p>';
    }
  },
  'signature-block': {
    name: 'Signature Block', icon: '✍️', cat: 'structural',
    desc: 'Side-by-side signature lines with name, title and date.',
    schema: '{parties: [{name, title?, date?, extra?}], heading?}',
    render: function (d, S2) {
      var parties = d.parties || [];
      if (!parties.length) return '';
      var h = '';
      if (d.heading) h += '<p style="' + ps(S2, 'font-weight:700;margin:14px 0 8px') + '">' + esc(d.heading) + '</p>';
      h += '<div style="display:grid;grid-template-columns:repeat(' + Math.min(parties.length, 3) + ',1fr);gap:24px;margin:0 0 6px">';
      for (var i = 0; i < parties.length; i++) {
        var p = parties[i];
        h += '<div style="text-align:center">';
        h += '<p style="' + ps(S2, 'margin:34px 0 2px') + '">________________________________</p>';
        h += '<p style="' + ps(S2, 'font-weight:700;margin:0') + '">' + esc(p.name || '') + '</p>';
        if (p.title) h += '<p style="' + ps(S2, 'margin:0') + '">' + esc(p.title) + '</p>';
        if (p.extra) h += '<p style="' + ps(S2, 'font-size:11pt;color:#475569;margin:0') + '">' + esc(p.extra) + '</p>';
        h += '<p style="' + ps(S2, 'font-size:11pt;color:#475569;margin:0') + '">Date: ____________</p>';
        h += '</div>';
      }
      return h + '</div>';
    }
  },
  'witness-block': {
    name: 'Witness Block', icon: '👁', cat: 'structural',
    desc: 'Witness signature lines next to the signing party.',
    schema: '{party, witness?}',
    render: function (d, S2) {
      var h = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:0 0 10px">';
      h += '<div style="text-align:center"><p style="' + ps(S2, 'font-weight:700;margin:0 0 2px') + '">SIGNED by ' + esc(d.party || 'the Party') + '</p><p style="' + ps(S2, 'margin:34px 0 2px') + '">________________________________</p><p style="' + ps(S2, 'margin:0') + '">Signature</p></div>';
      h += '<div style="text-align:center"><p style="' + ps(S2, 'font-weight:700;margin:0 0 2px') + '">In the presence of:</p><p style="' + ps(S2, 'margin:34px 0 2px') + '">________________________________</p><p style="' + ps(S2, 'margin:0') + '">' + esc(val(d.witness, 'Witness Signature')) + '</p><p style="' + ps(S2, 'font-size:11pt;color:#475569;margin:0') + '">Name: ____________</p></div>';
      return h + '</div>';
    }
  },
  'notary-block': {
    name: 'Notary Block', icon: '🖋', cat: 'structural',
    desc: 'Notary acknowledgment / jurat with venue and seal area.',
    schema: '{state?, county?, jurat?: true, name?}',
    render: function (d, S2) {
      var h = '<div style="' + ps(S2, 'border:1px solid #cbd5e1;border-radius:6px;padding:12px 16px;margin:0 0 12px') + '">';
      h += '<p style="' + ps(S2, 'text-align:center;font-weight:700;margin:0 0 8px') + '">NOTARIAL ' + (d.jurat ? 'CERTIFICATE (JURAT)' : 'ACKNOWLEDGMENT') + '</p>';
      h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">State of ' + esc(d.state || '[State]') + ', County of ' + esc(d.county || '[County]') + '.</p>';
      if (d.jurat) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">Subscribed and sworn to (or affirmed) before me on this ___ day of ____________, 20__, by ' + esc(d.name || '[Name of signatory]') + ', proved to me on the basis of satisfactory evidence to be the person who appeared before me.</p>';
      } else {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">On this ___ day of ____________, 20__, before me personally appeared ' + esc(d.name || '[Name of signatory]') + ', known to me (or proved to me on the basis of satisfactory evidence) to be the person whose name is subscribed to the within instrument, and acknowledged that he/she executed the same.</p>';
      }
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px">';
      h += '<div style="text-align:center"><p style="' + ps(S2, 'margin:26px 0 2px') + '">________________________________</p><p style="' + ps(S2, 'font-size:11pt;margin:0') + '">Notary Public Signature</p></div>';
      h += '<div style="text-align:center"><p style="' + ps(S2, 'margin:26px 0 2px') + '">(SEAL)</p><p style="' + ps(S2, 'font-size:11pt;margin:0') + '">My commission expires: ____________</p></div>';
      h += '</div></div>';
      return h;
    }
  },
  'amendment-history': {
    name: 'Amendment History', icon: '🧾', cat: 'structural',
    desc: 'Log table of amendments: date, section, description.',
    schema: '{title?, rows: [[date, section, description]]}',
    render: function (d, S2) {
      var rows = d.rows || [];
      if (!rows.length) return '';
      var h = '<p style="' + ps(S2, 'font-weight:700;margin:12px 0 6px') + '">' + esc(val(d.title, 'AMENDMENT HISTORY')) + '</p>';
      h += '<table style="border-collapse:collapse;width:100%;margin:0 0 12px;' + ps(S2) + '"><thead><tr>';
      h += '<th style="border:1px solid #94a3b8;background:#e2e8f0;padding:5px 10px;text-align:left;width:18%">Date</th>';
      h += '<th style="border:1px solid #94a3b8;background:#e2e8f0;padding:5px 10px;text-align:left;width:22%">Section</th>';
      h += '<th style="border:1px solid #94a3b8;background:#e2e8f0;padding:5px 10px;text-align:left">Description</th>';
      h += '</tr></thead><tbody>';
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i] || [];
        h += '<tr>';
        h += '<td style="border:1px solid #94a3b8;padding:5px 10px">' + esc(r[0] === undefined ? '' : r[0]) + '</td>';
        h += '<td style="border:1px solid #94a3b8;padding:5px 10px">' + esc(r[1] === undefined ? '' : r[1]) + '</td>';
        h += '<td style="border:1px solid #94a3b8;padding:5px 10px">' + esc(r[2] === undefined ? '' : r[2]) + '</td>';
        h += '</tr>';
      }
      return h + '</tbody></table>';
    }
  },

  /* ── Pre-built boilerplate clauses ── */
  'confidentiality': {
    name: 'Confidentiality Clause', icon: '🔒', cat: 'boilerplate',
    desc: 'Standard confidentiality clause (definition, obligations, exceptions, survival).',
    schema: '{party?: "the Receiving Party", years?: 5, custom?: [paragraphs]}',
    render: function (d, S2) {
      var party = val(d.party, 'the Receiving Party');
      var years = val(d.years, 5);
      var paras = d.custom || [
        '"Confidential Information" means all non-public information, in any form, disclosed by or on behalf of one Party (the "Disclosing Party") to the other Party (' + party + '), whether marked as confidential or which a reasonable person would understand to be confidential.',
        party + ' shall hold all Confidential Information in strict confidence, use it solely for the purpose of performing this Agreement, and not disclose it to any third party without the Disclosing Party\u2019s prior written consent.',
        'Confidential Information shall not include information that: (a) is or becomes publicly available through no breach by ' + party + '; (b) was lawfully in ' + party + '\u2019s possession prior to disclosure; (c) is lawfully received from a third party without restriction; or (d) is independently developed without use of the Confidential Information.',
        'The obligations in this clause shall survive the termination of this Agreement for a period of ' + years + ' years.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">CONFIDENTIALITY</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'termination': {
    name: 'Termination Clause', icon: '⛔', cat: 'boilerplate',
    desc: 'Term and termination clause: term, termination for cause, effect of termination.',
    schema: '{term?, noticeDays?: 30, party?: "either Party", custom?: [paragraphs]}',
    render: function (d, S2) {
      var noticeDays = val(d.noticeDays, 30);
      var party = val(d.party, 'either Party');
      var paras = d.custom || [
        'This Agreement shall commence on the Effective Date and shall continue until terminated in accordance with this clause.',
        party + ' may terminate this Agreement for any reason upon ' + noticeDays + ' days\u2019 prior written notice to the other Party.',
        'Either Party may terminate this Agreement with immediate effect by written notice if the other Party commits a material breach of this Agreement and fails to remedy that breach within 14 days after receiving written notice of the breach, or if the other Party becomes insolvent, enters into liquidation or ceases to carry on business.',
        'Termination shall not affect any accrued rights or obligations of either Party, nor any provision of this Agreement which is expressly or by implication intended to survive termination.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">TERM AND TERMINATION</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'indemnity': {
    name: 'Indemnity Clause', icon: '🛡', cat: 'boilerplate',
    desc: 'Mutual or one-sided indemnification clause.',
    schema: '{party?: "the Indemnifying Party", scope?, custom?: [paragraphs]}',
    render: function (d, S2) {
      var party = val(d.party, 'the Indemnifying Party');
      var paras = d.custom || [
        party + ' shall indemnify, defend and hold harmless the other Party, its officers, directors, employees and agents from and against any and all claims, losses, damages, liabilities, costs and expenses (including reasonable legal fees) arising out of or in connection with: (a) any breach of this Agreement by ' + party + '; (b) any negligent or wrongful act or omission of ' + party + ' or its personnel; and (c) any infringement of third-party rights by materials or services provided by ' + party + '.',
        'The indemnified Party shall promptly notify ' + party + ' of any claim subject to indemnification, allow ' + party + ' to control the defence and settlement of the claim, and provide reasonable assistance at ' + party + '\u2019s expense.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">INDEMNIFICATION</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'force-majeure': {
    name: 'Force Majeure Clause', icon: '🌪', cat: 'boilerplate',
    desc: 'Standard force majeure clause.',
    schema: '{custom?: [paragraphs]}',
    render: function (d, S2) {
      var paras = d.custom || [
        'Neither Party shall be liable for any failure or delay in performing its obligations under this Agreement if such failure or delay is caused by events beyond its reasonable control, including acts of God, natural disasters, fire, flood, epidemic or pandemic, war, terrorism, civil unrest, strikes, governmental acts, or failure of utilities or telecommunications ("Force Majeure Event").',
        'The Party affected by a Force Majeure Event shall notify the other Party within 7 days of its occurrence, use reasonable efforts to mitigate its effects, and resume performance as soon as practicable.',
        'If a Force Majeure Event continues for more than 60 consecutive days, either Party may terminate this Agreement upon written notice without liability.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">FORCE MAJEURE</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'dispute-resolution': {
    name: 'Dispute Resolution', icon: '⚖️', cat: 'boilerplate',
    desc: 'Escalation: negotiation → mediation → arbitration/litigation.',
    schema: '{seat?, mechanism?: "arbitration"|"litigation", days?: 30, custom?: [paragraphs]}',
    render: function (d, S2) {
      var seat = val(d.seat, '[Seat of arbitration]');
      var mech = val(d.mechanism, 'arbitration');
      var days = val(d.days, 30);
      var paras = d.custom || [
        'The Parties shall attempt in good faith to resolve any dispute arising out of or in connection with this Agreement through negotiation between their authorized representatives.',
        'If the dispute is not resolved within ' + days + ' days of written notice of the dispute, the Parties shall attempt to settle it by mediation in accordance with a mutually agreed mediation procedure before commencing other proceedings.',
        (mech === 'litigation'
          ? 'If the dispute remains unresolved after mediation, the courts of ' + seat + ' shall have exclusive jurisdiction to settle it.'
          : 'If the dispute remains unresolved after mediation, it shall be finally settled by arbitration in ' + seat + ' in accordance with the applicable arbitration rules. The arbitration shall be conducted in [Language] by a single arbitrator. The award shall be final and binding on the Parties.')
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">DISPUTE RESOLUTION</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'governing-law': {
    name: 'Governing Law', icon: '🏛', cat: 'boilerplate',
    desc: 'Choice of law and jurisdiction clause.',
    schema: '{jurisdiction, custom?: [paragraphs]}',
    render: function (d, S2) {
      var jur = val(d.jurisdiction, '[Governing law and jurisdiction]');
      var paras = d.custom || [
        'This Agreement and any dispute or claim arising out of or in connection with it shall be governed by and construed in accordance with the laws of ' + jur + '.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">GOVERNING LAW AND JURISDICTION</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'entire-agreement': {
    name: 'Entire Agreement', icon: '📃', cat: 'boilerplate',
    desc: 'Entire agreement / merger clause.',
    schema: '{custom?: [paragraphs]}',
    render: function (d, S2) {
      var paras = d.custom || [
        'This Agreement, together with its schedules and exhibits, constitutes the entire agreement between the Parties with respect to its subject matter and supersedes all prior agreements, understandings, negotiations and representations, whether written or oral, relating to that subject matter.',
        'Each Party acknowledges that it has not relied on any representation or warranty not expressly set out in this Agreement.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">ENTIRE AGREEMENT</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'severability': {
    name: 'Severability', icon: '✂️', cat: 'boilerplate',
    desc: 'Severability / saving clause.',
    schema: '{custom?: [paragraphs]}',
    render: function (d, S2) {
      var paras = d.custom || [
        'If any provision of this Agreement is held to be invalid, illegal or unenforceable, the remaining provisions shall continue in full force and effect. The invalid provision shall be modified to the minimum extent necessary to make it valid and enforceable while preserving the Parties\u2019 original intent.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">SEVERABILITY</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'waiver': {
    name: 'Waiver Clause', icon: '🙅', cat: 'boilerplate',
    desc: 'No-waiver clause.',
    schema: '{custom?: [paragraphs]}',
    render: function (d, S2) {
      var paras = d.custom || [
        'No failure or delay by either Party in exercising any right or remedy under this Agreement shall operate as a waiver of that right or remedy, nor shall any single or partial exercise preclude any further exercise. A waiver is effective only if given in writing and signed by the waiving Party.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">WAIVER</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'assignment': {
    name: 'Assignment Clause', icon: '🔄', cat: 'boilerplate',
    desc: 'Restrictions on assignment and delegation.',
    schema: '{restricted?: true, custom?: [paragraphs]}',
    render: function (d, S2) {
      var paras = d.custom || [
        'Neither Party may assign or transfer this Agreement or any of its rights or obligations under it, in whole or in part, without the prior written consent of the other Party, such consent not to be unreasonably withheld. Any attempted assignment in violation of this clause shall be void.',
        'This Agreement shall be binding upon and inure to the benefit of the Parties and their permitted successors and assigns.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">ASSIGNMENT</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'counterparts': {
    name: 'Counterparts Clause', icon: '🖊', cat: 'boilerplate',
    desc: 'Execution in counterparts / electronic signatures clause.',
    schema: '{electronic?: true, custom?: [paragraphs]}',
    render: function (d, S2) {
      var paras = d.custom || [
        'This Agreement may be executed in any number of counterparts, each of which shall be deemed an original, and all of which together shall constitute one and the same instrument.' + (d.electronic ? ' The Parties agree that execution by electronic signature shall be as valid as a handwritten signature.' : '')
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">COUNTERPARTS</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  },
  'notices': {
    name: 'Notices Clause', icon: '📮', cat: 'boilerplate',
    desc: 'Notice addresses and deemed-delivery rules for the parties.',
    schema: '{parties: [{name, address?, email?}], custom?: [paragraphs]}',
    render: function (d, S2) {
      var parties = d.parties || [];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">NOTICES</h3>';
      h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">All notices under this Agreement shall be in writing and delivered personally, by email, or by registered mail to the addresses below, and shall be deemed received on delivery, or on the third business day after mailing:</p>';
      for (var i = 0; i < parties.length; i++) {
        var p = parties[i];
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '"><strong>' + esc(p.name || '') + '</strong>' + (p.address ? '<br>' + esc(p.address) : '') + (p.email ? '<br>' + esc(p.email) : '') + '</p>';
      }
      return h;
    }
  },
  'representations': {
    name: 'Representations & Warranties', icon: '✅', cat: 'boilerplate',
    desc: 'Checklist-style list of representations and warranties.',
    schema: '{title?, items: [string], custom?: [paragraphs]}',
    render: function (d, S2) {
      var items = d.items || [];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">' + esc(val(d.title, 'REPRESENTATIONS AND WARRANTIES')) + '</h3>';
      h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">Each Party represents and warrants to the other that:</p>';
      h += '<div style="' + ps(S2, 'margin:0 0 8px 22px') + '">';
      var letters = 'abcdefghijklmnopqrstuvwxyz';
      for (var i = 0; i < items.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 4px') + '"><strong>(' + letters[i % 26] + ')</strong> ' + esc(items[i]) + ';</p>';
      }
      return h + '</div>';
    }
  },
  'covenants': {
    name: 'Covenants', icon: '🤲', cat: 'boilerplate',
    desc: 'List of affirmative/negative covenants.',
    schema: '{title?, items: [string]}',
    render: function (d, S2) {
      var items = d.items || [];
      if (!items.length) return '';
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">' + esc(val(d.title, 'COVENANTS')) + '</h3>';
      h += '<ol style="' + ps(S2, 'margin:0 0 10px;padding-left:30px') + '">';
      for (var i = 0; i < items.length; i++) {
        h += '<li style="' + ps(S2, 'margin-bottom:4px') + '">' + esc(items[i]) + '</li>';
      }
      return h + '</ol>';
    }
  },
  'conditions-precedent': {
    name: 'Conditions Precedent', icon: '🚦', cat: 'boilerplate',
    desc: 'Checklist of conditions that must be satisfied before closing.',
    schema: '{title?, items: [string]}',
    render: function (d, S2) {
      var items = d.items || [];
      if (!items.length) return '';
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">' + esc(val(d.title, 'CONDITIONS PRECEDENT')) + '</h3>';
      h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">The obligations of the Parties under this Agreement are conditional upon satisfaction of each of the following:</p>';
      h += '<div style="' + ps(S2, 'margin:0 0 8px') + '">';
      for (var i = 0; i < items.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 4px') + '">☐ &nbsp;' + esc(items[i]) + '</p>';
      }
      return h + '</div>';
    }
  },
  'payment-terms': {
    name: 'Payment Terms', icon: '💰', cat: 'boilerplate',
    desc: 'Payment schedule table with item, amount and due date.',
    schema: '{title?, schedule: [{item, amount, due?}], currency?}',
    render: function (d, S2) {
      var sched = d.schedule || [];
      if (!sched.length) return '';
      var cur = d.currency || '';
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">' + esc(val(d.title, 'FEES AND PAYMENT')) + '</h3>';
      h += '<table style="border-collapse:collapse;width:100%;margin:0 0 12px;' + ps(S2) + '"><thead><tr>';
      h += '<th style="border:1px solid #94a3b8;background:#e2e8f0;padding:5px 10px;text-align:left">Item</th>';
      h += '<th style="border:1px solid #94a3b8;background:#e2e8f0;padding:5px 10px;text-align:left;width:26%">Amount</th>';
      h += '<th style="border:1px solid #94a3b8;background:#e2e8f0;padding:5px 10px;text-align:left;width:26%">Due</th>';
      h += '</tr></thead><tbody>';
      for (var i = 0; i < sched.length; i++) {
        var r = sched[i] || {};
        h += '<tr>';
        h += '<td style="border:1px solid #94a3b8;padding:5px 10px">' + esc(r.item || '') + '</td>';
        h += '<td style="border:1px solid #94a3b8;padding:5px 10px">' + (cur ? esc(cur) + ' ' : '') + esc(r.amount === undefined ? '' : r.amount) + '</td>';
        h += '<td style="border:1px solid #94a3b8;padding:5px 10px">' + esc(r.due || '') + '</td>';
        h += '</tr>';
      }
      return h + '</tbody></table>';
    }
  },
  'amendment': {
    name: 'Amendment Clause', icon: '✏️', cat: 'boilerplate',
    desc: 'How the agreement may be amended.',
    schema: '{custom?: [paragraphs]}',
    render: function (d, S2) {
      var paras = d.custom || [
        'This Agreement may not be amended or modified except by a written instrument signed by both Parties.'
      ];
      var h = '<h3 style="' + ps(S2, 'font-size:12pt;font-weight:700;margin:12px 0 6px') + '">AMENDMENT</h3>';
      for (var i = 0; i < paras.length; i++) {
        h += '<p style="' + ps(S2, 'text-align:justify;margin:0 0 8px') + '">' + esc(paras[i]) + '</p>';
      }
      return h;
    }
  }
};

/* ═══════════════════════════════════════════
   DOCUMENT RENDERING
   ═══════════════════════════════════════════ */
function blocksToHtml() {
  var h = '';
  var S2 = S();
  for (var i = 0; i < DB.blocks.length; i++) {
    var b = DB.blocks[i];
    var r = LEGAL_COMPONENTS[b.type];
    var data = b.data || {};
    var inner;
    try {
      // manualHtml = content hand-edited in the document (overrides the generated markup)
      inner = (b.type === 'html') ? (data.html || '') : (data.manualHtml || (r ? r.render(data, S2) : ''));
    } catch (e) {
      inner = '<p style="color:#b91c1c;font-style:italic">[render error in ' + esc(b.type) + ']</p>';
    }
    if (!inner && b.type !== 'html') {
      inner = '<p style="color:#94a3b8;font-style:italic">[unknown block type: ' + esc(b.type) + ']</p>';
    }
    h += '<div class="lb-block" data-lb-id="' + i + '" data-lb-type="' + esc(b.type) + '">' + inner + '</div>';
  }
  return h;
}

/** Base CSS for the document — Word-style paginated pages (preview + exports). */
function docCss() {
  var s = DB.settings || DEFAULT_SETTINGS;
  var fam = qFont(s.fontFamily);
  var css = '';
  css += 'html,body{margin:0;padding:0;font-family:' + fam + ';}';
  css += 'h1,h2,h3,h4,h5,p,ul,ol,li,table,blockquote,hr{margin:0;padding:0;border:0;font-size:inherit;font-weight:inherit;}';
  css += 'ul,ol{padding-left:28px;margin:0 0 10px;}li{margin-bottom:4px;}';
  css += 'table{border-collapse:collapse;width:100%;margin:10px 0;}';
  css += '.doc-sheet{display:none;}';
  css += '.doc-pages{display:block;}';
  css += '.doc-page{width:210mm;height:297mm;background:#fff;padding:20mm 18mm;box-sizing:border-box;overflow:hidden;page-break-after:always;break-after:page;font-family:' + fam + ';font-size:' + s.fontSize + ';color:' + s.color + ';line-height:' + s.lineHeight + ';}';
  css += '.doc-page:last-child{page-break-after:auto;break-after:auto;}';
  css += '.lb-block{margin:0;}';
  css += '.lb-page-break{height:0;margin:24px 0;border-top:2px dashed #cbd5e1;page-break-after:always;break-after:page;}';
  css += '::selection{background:#c7d2fe;}';
  css += '@page{size:A4;margin:0;}';
  css += '@media screen{body{background:#d8dae1;padding:26px 20px;}.doc-pages{display:flex;flex-direction:column;gap:18px;}.doc-page{margin:0 auto;box-shadow:0 2px 16px rgba(15,23,42,0.18);border:1px solid #d5d8e0;}}';
  css += '@media print{body{background:#fff;padding:0;}.doc-pages{display:block;}.doc-page{margin:0;box-shadow:none;border:none;}.lb-page-break{border:none;margin:0;}}';
  css += '.lb-editing .doc-page{overflow:visible;min-height:297mm;height:auto;outline:2px dashed #818cf8;outline-offset:-2px;cursor:text;}';
  return css;
}

/** Scripts injected into the sandboxed preview (srcdoc) — plain JS bodies (no script tags). */
var SEL_JS =
  '(function(){' +
  'function rep(){var s=window.getSelection();var t=(s&&s.toString)?s.toString().trim():"";if(!t||t.length>4000)return;' +
  'var n=s.anchorNode;var e=(n&&n.nodeType===1)?n:((n&&n.parentElement)?n.parentElement:null);if(!e)return;' +
  'var b=(e.closest)?e.closest("[data-lb-id]"):null;' +
  'var idx=b?parseInt(b.getAttribute("data-lb-id"),10):-1;' +
  'var ty=b?b.getAttribute("data-lb-type"):"";' +
  'try{parent.postMessage({lbSel:{idx:idx,type:ty,text:t}},"*");}catch(err){}}' +
  'document.addEventListener("mouseup",function(){setTimeout(rep,0);});' +
  'document.addEventListener("keyup",function(e){if(e.key==="Shift"){setTimeout(rep,0);}});' +
  '})();';

var EDIT_JS =
  '(function(){' +
  'window.addEventListener("message",function(e){' +
  'var d=e.data||{};' +
  'if(d.lbCmd&&d.lbCmd.cmd==="edit"){' +
  '  if(d.lbCmd.on){' +
  '    var bs=document.querySelectorAll(".lb-block");window.__lbSnap={};' +
  '    for(var i=0;i<bs.length;i++){window.__lbSnap[bs[i].getAttribute("data-lb-id")]=bs[i].innerHTML;}' +
  '    var ps=document.querySelectorAll(".doc-page");' +
  '    for(var j=0;j<ps.length;j++){ps[j].setAttribute("contenteditable","true");}' +
  '    document.body.className="lb-editing";' +
  '  } else {' +
  '    var ps2=document.querySelectorAll(".doc-page");' +
  '    for(var j2=0;j2<ps2.length;j2++){ps2[j2].removeAttribute("contenteditable");}' +
  '    document.body.className="";' +
  '    var changed=[];' +
  '    var bs2=document.querySelectorAll(".lb-block");' +
  '    for(var k=0;k<bs2.length;k++){' +
  '      var b=bs2[k];var idx=b.getAttribute("data-lb-id");' +
  '      if(window.__lbSnap&&window.__lbSnap[idx]!==b.innerHTML){changed.push({idx:parseInt(idx,10),html:b.innerHTML});}' +
  '    }' +
  '    window.__lbSnap=null;' +
  '    try{parent.postMessage({lbEdited:{blocks:changed}},"*");}catch(err){}' +
  '  }' +
  '} else if(d.lbCmd&&d.lbCmd.cmd==="format"){' +
  '  try{document.execCommand(d.lbCmd.op,false,d.lbCmd.val||null);}catch(err){}' +
  '}' +
  '});' +
  '})();';

var PAGINATOR_JS =
  '(function(){' +
  'function newPage(){var p=document.createElement("div");p.className="doc-page";' +
  'var wrap=document.getElementById("pages-wrap");if(wrap)wrap.appendChild(p);return p;}' +
  'function paginate(){' +
  'var sheet=document.getElementById("doc-sheet");var wrap=document.getElementById("pages-wrap");' +
  'if(!sheet||!wrap)return;' +
  'var pages=wrap.querySelectorAll(".doc-page");' +
  'for(var i=0;i<pages.length;i++){' +
  '  var kids=Array.prototype.slice.call(pages[i].children);' +
  '  for(var j=0;j<kids.length;j++)sheet.appendChild(kids[j]);' +
  '  wrap.removeChild(pages[i]);' +
  '}' +
  'var blocks=Array.prototype.slice.call(sheet.querySelectorAll(".lb-block"));' +
  'if(!blocks.length){return;}' +
  'var page=newPage();' +
  'for(var k=0;k<blocks.length;k++){' +
  '  var b=blocks[k];' +
  '  if(b.getAttribute("data-lb-type")==="page-break"){page=newPage();continue;}' +
  '  page.appendChild(b);' +
  '  if(page.scrollHeight>page.clientHeight+2&&page.children.length>1){' +
  '    page.removeChild(b);page=newPage();page.appendChild(b);' +
  '  }' +
  '}' +
  'var ps=wrap.querySelectorAll(".doc-page");' +
  'for(var m=0;m<ps.length;m++){' +
  '  if(ps[m].children.length===1&&ps[m].scrollHeight>ps[m].clientHeight+2){' +
  '    ps[m].style.height="auto";ps[m].style.minHeight="297mm";' +
  '  }' +
  '}' +
  '}' +
  'var rt=null;' +
  'window.addEventListener("resize",function(){clearTimeout(rt);rt=setTimeout(paginate,120);});' +
  'paginate();' +
  '})();';

/** Assemble a full HTML document shell: hidden block source + paginated page container. */
function docBodyHtml(blocksHtml, extraJs) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(resolveTitle()) + '</title><style>' + docCss() + '</style></head><body>' +
    '<div class="doc-pages" id="pages-wrap"></div>' +
    '<div class="doc-sheet" id="doc-sheet">' + blocksHtml + '</div>' +
    (extraJs ? '<script>' + extraJs + '<\/script>' : '') +
    '<\/body><\/html>';
}

/** Preview document (srcdoc for the sandboxed iframe): selection relay + edit mode + paginator. */
function buildPreviewDoc() {
  return docBodyHtml(blocksToHtml(), SEL_JS + '\n' + EDIT_JS + '\n' + PAGINATOR_JS);
}

/** Pagination-only document, used by the offscreen capture iframe for exports. */
function buildPaginationDoc() {
  return docBodyHtml(blocksToHtml(), PAGINATOR_JS);
}

/** Standalone HTML with pre-paginated pages (everything embedded, printable A4). */
function buildStandaloneHtml(pagesHtml) {
  pagesHtml = pagesHtml || ('<div class="doc-page" style="height:auto;min-height:297mm">' + blocksToHtml() + '</div>');
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + esc(resolveTitle()) + '</title>\n<style>\n' + docCss() + '\n</style>\n</head>\n<body>\n<div class="doc-pages">\n' + pagesHtml + '\n</div>\n</body>\n</html>';
}

/** Render the document into a hidden sandboxed iframe, let the paginator split it
 *  into A4 pages, then hand back the pages HTML. Falls back to null if sandboxing
 *  blocks access to the iframe DOM. */
function buildPaginatedHtml(callback) {
  var iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-99999px;top:0;width:900px;height:1400px;border:0;';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  document.body.appendChild(iframe);
  var done = false;
  var pagesHtml = null;
  function finish() {
    if (done) return;
    done = true;
    try {
      var wrap = iframe.contentDocument && iframe.contentDocument.getElementById('pages-wrap');
      if (wrap && wrap.children.length) pagesHtml = wrap.outerHTML;
    } catch (e) { pagesHtml = null; }
    try { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); } catch (e) {}
    callback(pagesHtml);
  }
  setTimeout(finish, 4000);
  try {
    iframe.onload = function () { setTimeout(finish, 400); };
    iframe.srcdoc = buildPaginationDoc();
  } catch (e) { finish(); }
}

function mountPreview() {
  var iframe = el('doc-preview');
  var empty = el('preview-empty');
  if (!iframe) return;
  _previewBuildSeq++;
  iframe.srcdoc = buildPreviewDoc();
  if (empty) empty.classList.toggle('hidden', DB.blocks.length > 0);
  // A remount always starts non-editable
  _editMode = false;
  updateEditToolbar();
}

/* ═══════════════════════════════════════════
   STATE & PERSISTENCE
   ═══════════════════════════════════════════ */
function slimValue() {
  return {
    version: DB.version,
    blocks: DB.blocks,
    settings: DB.settings,
    activeSessionId: DB.activeSessionId,
    chatCache: DB.chatCache,
    _instanceId: DB._instanceId
  };
}

function persist() {
  try { tool.setValue(slimValue()); } catch (e) { console.warn('persist failed', e); }
}

function _bumpVersion(kind) {
  var parts = String(DB.version || '1.0.0').split('.');
  var ma = parseInt(parts[0] || '0', 10);
  var mi = parseInt(parts[1] || '0', 10);
  var pa = parseInt(parts[2] || '0', 10);
  if (kind === 'major') { ma++; mi = 0; pa = 0; }
  else if (kind === 'minor') { mi++; pa = 0; }
  else { pa++; }
  DB.version = ma + '.' + mi + '.' + pa;
  _renderVersion();
}

function _renderVersion() {
  var v = el('tool-version');
  if (v) v.textContent = 'v' + (DB.version || '1.0.0');
}

function updateDocStats() {
  var box = el('doc-stats');
  if (!box) return;
  var words = stripTags(blocksToHtml()).split(/\s+/).filter(Boolean).length;
  var chars = JSON.stringify(DB.blocks).length;
  box.innerHTML = '<b>Title:</b> ' + esc(resolveTitle()) +
    ' &nbsp;·&nbsp; <b>' + DB.blocks.length + '</b> block(s)' +
    ' &nbsp;·&nbsp; <b>~' + words.toLocaleString() + '</b> words' +
    ' &nbsp;·&nbsp; <b>' + (chars / 1024).toFixed(1) + ' KB</b> of block data' +
    ' &nbsp;·&nbsp; version <b>v' + esc(DB.version) + '</b>';
}

/* ═══════════════════════════════════════════
   TOASTS
   ═══════════════════════════════════════════ */
function showToast(msg, type) {
  try { tool.notify(msg, type || 'info'); } catch (e) {}
  var stack = el('toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    stack.id = 'toast-stack';
    document.body.appendChild(stack);
  }
  var t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  stack.appendChild(t);
  setTimeout(function () {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
  }, 4200);
}

/* ═══════════════════════════════════════════
   CHAT SESSIONS (ai-chat-sessions-uniconbaseapps)
   ═══════════════════════════════════════════ */
function _warnSessionStorage(msg) {
  if (_sessionWarnShown) return;
  _sessionWarnShown = true;
  console.warn('[LEGALDOC:SESSION] ' + msg);
  showToast('⚠ Chat history storage unavailable — messages are cached inside the record until fixed. Check allowObjectCRUD: yes and the ai-chat-sessions-uniconbaseapps object type in field settings.', 'warning');
}

function _instanceId() {
  if (DB._instanceId) return DB._instanceId;
  return 'legaldoc_unknown';
}

function canUseSessions() {
  return typeof tool.requestObjects === 'function';
}

function loadSessions(callback) {
  if (!canUseSessions()) {
    _warnSessionStorage('requestObjects unavailable');
    _sessions = [];
    _sessionsLoaded = true;
    if (callback) callback([]);
    return;
  }
  try {
    tool.requestObjects('query', { mainObjectType: SESSION_TYPE }, function (err, result) {
      if (err) { _warnSessionStorage('query error: ' + err); _sessions = []; }
      else {
        var all = (result && result.objects) ? result.objects : [];
        var myId = _instanceId();
        _sessions = [];
        for (var i = 0; i < all.length; i++) {
          var obj = all[i];
          var pd = obj.productData || {};
          var dcb = pd.data_categoriesBased || {};
          if (dcb._toolInstanceId === myId ||
              (myId !== 'legaldoc_unknown' && dcb._toolInstanceId && String(dcb._toolInstanceId).indexOf(myId) === 0)) {
            _sessions.push(obj);
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
  if (!canUseSessions()) { if (callback) callback(null); return; }
  var user = getUserSafe() || {};
  try {
    tool.requestObjects('create', {
      mainObjectType: SESSION_TYPE,
      name: resolveTitle(),
      productData: {
        data_categoriesBased: {
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: { userId: user.id || 'anon', userName: user.name || 'Anonymous' },
          _toolInstanceId: _instanceId()
        }
      }
    }, function (err, result) {
      if (err) { _warnSessionStorage('create error: ' + err); if (callback) callback(null); return; }
      var session = result.object;
      if (session._parentObjectId && !DB._instanceId) {
        DB._instanceId = 'legaldoc_' + session._parentObjectId;
        persist();
      }
      _sessions.unshift(session);
      if (callback) callback(session);
    });
  } catch (e) {
    _warnSessionStorage('create threw: ' + e.message);
    if (callback) callback(null);
  }
}

function saveCurrentSession(callback) {
  if (!DB.activeSessionId || !canUseSessions()) { if (callback) callback(null); return; }
  try {
    var session = null;
    for (var i = 0; i < _sessions.length; i++) {
      if (_sessions[i].id === DB.activeSessionId) { session = _sessions[i]; break; }
    }
    // Session object not available yet (still being created) — skip to avoid
    // overwriting _toolInstanceId with an incomplete merge.
    if (!session) { if (callback) callback(null); return; }
    var oldDcb = (session && session.productData && session.productData.data_categoriesBased) ? session.productData.data_categoriesBased : {};
    var dcb = {};
    for (var k in oldDcb) { if (Object.prototype.hasOwnProperty.call(oldDcb, k)) dcb[k] = oldDcb[k]; }
    dcb.messages = _chatMessages.slice();
    dcb.updatedAt = new Date().toISOString();
    tool.requestObjects('update', {
      mainObjectType: SESSION_TYPE,
      objectId: DB.activeSessionId,
      productData: { data_categoriesBased: dcb }
    }, function (err) {
      if (err) _warnSessionStorage('save error: ' + err);
      if (callback) callback(err ? null : true);
    });
  } catch (e) {
    _warnSessionStorage('save threw: ' + e.message);
    if (callback) callback(null);
  }
}

function restoreActiveSessionMessages() {
  if (!DB.activeSessionId) return false;
  var session = null;
  for (var i = 0; i < _sessions.length; i++) {
    if (_sessions[i].id === DB.activeSessionId) { session = _sessions[i]; break; }
  }
  if (session) {
    var pd = session.productData || {};
    var dcb = pd.data_categoriesBased || {};
    var msgs = (dcb.messages && dcb.messages.length) ? dcb.messages : null;
    if (msgs) { _chatMessages = msgs; return true; }
  }
  // Session missing or empty — fall back to the bounded cache
  if (DB.chatCache && DB.chatCache.sessionId === DB.activeSessionId && DB.chatCache.messages && DB.chatCache.messages.length) {
    _chatMessages = DB.chatCache.messages.slice();
    return true;
  }
  _chatMessages = [];
  return false;
}

function updateChatCache() {
  var msgs = [];
  for (var i = Math.max(0, _chatMessages.length - 30); i < _chatMessages.length; i++) {
    var m = _chatMessages[i];
    var text = String(m.text || '');
    if (text.length > 2000) text = text.substring(0, 2000);
    msgs.push({ role: m.role, text: text, time: m.time });
  }
  DB.chatCache = { sessionId: DB.activeSessionId || '', messages: msgs };
}

function ensureSession(callback) {
  if (DB.activeSessionId) { if (callback) callback(); return; }
  if (!_sessionsLoaded) { if (callback) callback(); return; }
  createSession(function (newSession) {
    if (newSession) {
      DB.activeSessionId = newSession.id;
      persist();
    }
    if (callback) callback();
  });
}

function getUserSafe() {
  try { return tool.getUser(); } catch (e) { return null; }
}

/* ═══════════════════════════════════════════
   CHAT UI
   ═══════════════════════════════════════════ */
var QUICK_PROMPTS = [
  ['🔒 NDA', 'Draft a Non-Disclosure Agreement between a company and an individual consultant'],
  ['🤝 Service Agreement', 'Draft a Service Agreement between two companies, with payment terms and termination'],
  ['💼 Employment Contract', 'Draft an Employment Contract for a full-time employee with a probation period'],
  ['🏠 Lease Agreement', 'Draft a Residential Lease Agreement for 12 months'],
  ['🖋 Power of Attorney', 'Draft a General Power of Attorney'],
  ['🌐 Terms & Conditions', 'Draft Terms & Conditions for a website selling digital products']
];

function welcomeHtml() {
  var h = '<div class="chat-welcome"><div class="chat-welcome-icon">⚖️</div>' +
    '<h3>Draft a legal document</h3>' +
    '<p>Describe what you need — <b>an NDA, a service agreement, an employment contract, a lease…</b> — and I\u2019ll draft it in Word-document format, section by section.</p>' +
    '<div class="welcome-prompts">';
  for (var i = 0; i < QUICK_PROMPTS.length; i++) {
    h += '<button class="btn btn-outline btn-sm" data-quick="' + i + '">' + esc(QUICK_PROMPTS[i][0]) + '</button>';
  }
  h += '</div><p class="welcome-tip">💡 <b>Tip:</b> Select a part of the document on the right, then ask me to change <i>that part only</i>.</p></div>';
  return h;
}

function renderChatMessages() {
  var box = el('chat-messages');
  if (!box) return;
  if (!_chatMessages || !_chatMessages.length) {
    box.innerHTML = welcomeHtml();
    var qb = box.querySelectorAll('[data-quick]');
    for (var q = 0; q < qb.length; q++) {
      qb[q].addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-quick'), 10);
        var p = QUICK_PROMPTS[idx];
        if (!p) return;
        sendPreset(p[1]);
      });
    }
    return;
  }
  var h = '';
  for (var i = 0; i < _chatMessages.length; i++) {
    var m = _chatMessages[i];
    var time = shortTime(m.time);
    if (m.role === 'user') {
      h += '<div class="chat-msg user"><div class="chat-avatar">👤</div>' +
        '<div><div class="chat-bubble">' + markdownLite(m.text) + '</div>' +
        '<div class="chat-msg-time">' + time + '</div></div></div>';
    } else {
      h += '<div class="chat-msg ai' + (m.isError ? ' err' : '') + '">' +
        '<div class="chat-avatar">⚖️</div>' +
        '<div><div class="chat-bubble">' + markdownLite(m.text) + '</div>';
      if (m.version) h += '<span class="chat-version-chip">✓ document v' + esc(m.version) + '</span>';
      if (m.opts && m.opts.length) h += optionsHtml(m.opts);
      h += '<div class="chat-msg-time">' + time + '</div></div></div>';
    }
  }
  box.innerHTML = h;
  scrollChatToBottom();
}

function optionsHtml(opts) {
  var h = '<div class="chat-options">';
  for (var i = 0; i < opts.length; i++) {
    h += '<button class="chat-option-btn" data-opt-text="' + esc(opts[i].text) + '">➜ ' + esc(opts[i].text) + '</button>';
  }
  h += '</div>';
  return h;
}

function bindOptionButtons() {
  var box = el('chat-messages');
  if (!box) return;
  var btns = box.querySelectorAll('.chat-option-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', function () {
      var text = this.getAttribute('data-opt-text');
      if (this.classList.contains('chat-option-used')) return;
      var parent = this.parentNode;
      if (parent) {
        var allBtns = parent.querySelectorAll('.chat-option-btn');
        for (var j = 0; j < allBtns.length; j++) {
          allBtns[j].classList.add('chat-option-used');
          allBtns[j].disabled = true;
        }
      }
      sendPreset(text);
    });
  }
}

function scrollChatToBottom() {
  var box = el('chat-messages');
  if (box) box.scrollTop = box.scrollHeight;
}

function addChatMessage(role, text, extra) {
  extra = extra || {};
  _chatMessages.push({
    role: role,
    text: text,
    time: new Date().toISOString(),
    opts: extra.opts || null,
    version: extra.version || null,
    isError: extra.isError || false
  });
  updateChatCache();
  renderChatMessages();
  bindOptionButtons();
  scrollChatToBottom();
  saveCurrentSession();
  if (!DB.activeSessionId) persist();
}

function sendPreset(text) {
  var input = el('chat-input');
  if (!input) return;
  input.value = text;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  sendChatMessage();
}

/* ── Thinking bubble ── */
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
    '<div class="chat-avatar">⚖️</div>' +
    '<div class="think-bubble">' +
      '<div class="think-header" id="think-hdr" style="cursor:pointer">' +
        '<span class="think-icon">⏳</span>' +
        '<span class="chat-thinking-dots"><span></span><span></span><span></span></span>' +
        '<span class="think-label" id="think-label">' + esc(label || 'AI is drafting…') + '</span>' +
        '<span class="think-time" id="think-time">0:00</span>' +
        '<span class="think-toggle" id="think-toggle">▶</span>' +
        '<button class="think-cancel" id="think-cancel" title="Stop" style="display:none">⏹ Stop</button>' +
      '</div>' +
      '<div class="think-body" id="think-body" style="display:none">' +
        '<div class="think-stream-label">Generating…</div><div class="think-stream" id="think-stream"></div>' +
      '</div>' +
    '</div>';
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  _thinkingMsgEl = bubble;

  var hdr = bubble.querySelector('#think-hdr');
  var bodyEl = bubble.querySelector('#think-body');
  var toggleEl = bubble.querySelector('#think-toggle');
  hdr.onclick = function () {
    if (!bodyEl || !toggleEl) return;
    var isOpen = bodyEl.style.display !== 'none';
    bodyEl.style.display = isOpen ? 'none' : 'block';
    toggleEl.textContent = isOpen ? '▶' : '▼';
    container.scrollTop = container.scrollHeight;
  };

  var firstToken = true;
  _streamCallback = function (token) {
    if (firstToken) {
      if (bodyEl) bodyEl.style.display = 'block';
      if (toggleEl) toggleEl.textContent = '▼';
      var sl = bubble.querySelector('.think-stream-label');
      if (sl) sl.style.display = 'none';
      firstToken = false;
    }
    appendStreamToken(token);
  };

  var cancelBtn = bubble.querySelector('#think-cancel');
  if (cancelBtn) {
    setTimeout(function () { if (_thinkingMsgEl === bubble && cancelBtn) cancelBtn.style.display = ''; }, 5000);
    cancelBtn.onclick = function (e) { e.stopPropagation(); cancelAiRequest(); };
  }

  var dots = 0;
  _thinkingTimer = setInterval(function () {
    dots = (dots + 1) % 4;
    var lbl = bubble.querySelector('#think-label');
    var elapsed = Math.floor((Date.now() - _thinkingStartTime) / 1000);
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    var timeStr = mins + ':' + (secs < 10 ? '0' : '') + secs;
    if (lbl) {
      if (_lastTokenAt > _thinkingStartTime) {
        var idleSec = Math.floor((Date.now() - _lastTokenAt) / 1000);
        lbl.textContent = idleSec < 2 ? 'AI is drafting…' + Array(dots + 1).join('.') : 'AI is drafting… (last token ' + idleSec + 's ago)';
      } else if (elapsed > 60) {
        lbl.textContent = 'Waiting for the first token… ' + timeStr + ' (large prompts take longer)';
      } else if (elapsed > 20) {
        lbl.textContent = 'Waiting for the first token… ' + timeStr;
      } else {
        lbl.textContent = (label || 'AI is drafting…') + Array(dots + 1).join('.');
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
      if (dist < 80) container.scrollTop = container.scrollHeight;
    }
  }
}

function hideThinkingBubble() {
  if (_thinkingTimer) { clearInterval(_thinkingTimer); _thinkingTimer = null; }
  if (_thinkingMsgEl) {
    var el2 = _thinkingMsgEl;
    _thinkingMsgEl = null;
    setTimeout(function () { if (el2.parentNode) el2.parentNode.removeChild(el2); }, 200);
  }
  _streamCallback = null;
}

function _markThinkingComplete(elapsedMs) {
  if (_thinkingTimer) { clearInterval(_thinkingTimer); _thinkingTimer = null; }
  if (!_thinkingMsgEl) return;
  var bubble = _thinkingMsgEl;
  var label = bubble.querySelector('#think-label');
  var dots = bubble.querySelector('.chat-thinking-dots');
  var icon = bubble.querySelector('.think-icon');
  var cancel = bubble.querySelector('#think-cancel');
  var timeEl = bubble.querySelector('#think-time');
  if (label) label.textContent = '✓ Complete in ' + (elapsedMs / 1000).toFixed(1) + 's';
  if (dots) dots.style.display = 'none';
  if (icon) icon.textContent = '✅';
  if (cancel) cancel.style.display = 'none';
  var secs = Math.floor(elapsedMs / 1000);
  var mins = Math.floor(secs / 60);
  if (timeEl) timeEl.textContent = mins + ':' + (secs % 60 < 10 ? '0' : '') + (secs % 60);
  _thinkingMsgEl = null;
}

/* ── AI lifecycle ── */
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

function setAiTimeout(promptLen) {
  clearAiTimeout();
  _aiTimeoutId = setTimeout(function () {
    console.warn('[LEGALDOC:TIMEOUT] AI request timed out after 600 seconds');
    _aiCallActive = false;
    _markThinkingComplete(600000);
    _setAiUIActive(false);
    updateConnStatus('error');
    addChatMessage('ai', '⏰ **AI request timed out after 600 seconds.**\n\nPossible causes: the AI gateway or model is overloaded, the prompt is too large (' + promptLen.toLocaleString() + ' chars), or a network issue.\n\n🔧 Try sending again or simplifying your request.', { isError: true });
    tool.resize();
  }, 605000);
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
  addChatMessage('ai', '⏹ **Drafting stopped.** You can send another message to continue.');
  tool.resize();
}

/* ═══════════════════════════════════════════
   AI PROMPT & RESPONSE HANDLING
   ═══════════════════════════════════════════ */
function catalogText() {
  var lines = [];
  for (var k in LEGAL_COMPONENTS) {
    if (!Object.prototype.hasOwnProperty.call(LEGAL_COMPONENTS, k)) continue;
    var c = LEGAL_COMPONENTS[k];
    lines.push('- "' + k + '": ' + c.name + ' — ' + c.desc + ' | data fields: ' + c.schema);
  }
  return lines.join('\n');
}

function blockPreview(b, maxLen) {
  try {
    var s = stripTags(b.type === 'html' ? (b.data && b.data.html) || '' : '');
    if (!s) s = JSON.stringify(b.data || {});
    s = s.substring(0, maxLen || 140);
    return s;
  } catch (e) { return ''; }
}

function buildChatPrompt(userMsg) {
  var parts = [];
  parts.push('You are an expert legal document drafting assistant inside the "Legal Document Builder" tool. You draft professionally formatted legal documents (agreements, contracts, policies, deeds, letters) and refine them through chat.');
  parts.push('The document is a list of BLOCKS. Each block is rendered by the tool from its "type" and "data".');
  parts.push('');
  parts.push('=== COMPONENT LIBRARY (use these block types) ===');
  parts.push(catalogText());
  parts.push('');
  parts.push('=== RULES FOR BLOCK DATA ===');
  parts.push('- "html" is a free-form block: put any HTML/CSS/JS inside data.html. It must be fully self-contained (inline styles or embedded style/script tags allowed).');
  parts.push('- Every other component: text fields contain PLAIN TEXT only (never HTML markup) — the tool escapes and renders them.');
  parts.push('- Use the pre-built boilerplate components (confidentiality, termination, indemnity, force-majeure, dispute-resolution, governing-law, entire-agreement, severability, waiver, assignment, counterparts, amendment…) for standard clauses; adjust them via their data fields.');
  parts.push('- Typical document flow: title → parties → recitals → agreement-word → definitions → numbered sections (section + clause/sub-clauses) → boilerplate clauses → execution-paragraph → signature-block. Keep section numbers consistent (1., 2., …).');
  parts.push('- Draft in the same language the user writes in.');
  parts.push('- Legal drafting quality: plain language, defined terms, complete sentences, no placeholders unless bracketed [like this].');

  if (DB.blocks.length === 0) {
    parts.push('');
    parts.push('=== DOCUMENT STATE ===');
    parts.push('The document is EMPTY. The user wants to create a new document.');
  } else {
    parts.push('');
    parts.push('=== DOCUMENT STATE ===');
    parts.push('Title: ' + resolveTitle());
    var list = [];
    for (var i = 0; i < DB.blocks.length; i++) {
      var b = DB.blocks[i];
      list.push('#' + i + ' (' + b.type + '): ' + blockPreview(b, 120));
    }
    parts.push(list.join('\n'));
    var json = JSON.stringify(DB.blocks);
    if (json.length > 40000) json = json.substring(0, 40000) + ' … (truncated)';
    parts.push('');
    parts.push('=== CURRENT BLOCKS JSON ===');
    parts.push(json);
  }

  var targeted = _selTarget && _selTarget.idx >= 0 && _selTarget.idx < DB.blocks.length;
  if (targeted) {
    var tb = DB.blocks[_selTarget.idx];
    parts.push('');
    parts.push('=== TARGETED EDIT — the user SELECTED text inside block #' + _selTarget.idx + ' (' + tb.type + ') ===');
    parts.push('Selected text: "' + _selTarget.text.substring(0, 1200) + '"');
    parts.push('Full block data: ' + JSON.stringify(tb));
    parts.push('CRITICAL: The user wants changes ONLY in this part of the document. You MUST respond with a single replaceBlock operation for block #' + _selTarget.idx + ' and you MUST NOT touch any other block.');
  }

  parts.push('');
  parts.push('=== USER REQUEST ===');
  parts.push(userMsg);
  parts.push('');
  parts.push('=== OUTPUT CONTRACT ===');
  parts.push('1) If the user asks a QUESTION only (no document change needed): answer in plain chat text, no JSON.');
  parts.push('2) To change the document, output exactly ONE JSON object in one of these shapes:');
  if (targeted) {
    parts.push('   {"replaceBlock":' + _selTarget.idx + ',"block":{"type":"...","data":{...}}} — the ONLY allowed operation for this message (targeted edit).');
  } else if (DB.blocks.length === 0) {
    parts.push('   {"blocks":[{"type":"...","data":{...}}, ...]} — the COMPLETE new document, ordered top to bottom.');
  } else {
    parts.push('   {"replaceBlock":<index>,"block":{...}} — replace one existing block.');
    parts.push('   {"insertAfter":<index>,"block":{...}} — insert a new block after index (use -1 to insert at the top, or the last index for the end).');
    parts.push('   {"deleteBlock":<index>} — remove one block.');
    parts.push('   {"blocks":[...]} — ONLY when the user asks for a full rewrite or reformat of the entire document.');
  }
  parts.push('3) After the JSON (outside it), write a 1-2 sentence plain-language summary of what changed, then 2-4 next-step suggestions, each on its own line starting with [[suggest_xxx]] e.g. [[suggest_signatures]] Add signature blocks for both parties.');
  parts.push('4) The JSON must be valid JSON (double quotes, no trailing commas, no comments) and must NOT be wrapped in markdown fences.');
  parts.push('5) Block types MUST be from the catalog above (or "html"). Unknown types are discarded.');
  return parts.join('\n');
}

/** Extract the first balanced JSON object from text. */
function _extractJson(text) {
  var s = text.indexOf('{');
  if (s === -1) return null;
  var depth = 0;
  var inStr = false;
  var esc2 = false;
  for (var i = s; i < text.length; i++) {
    var ch = text.charAt(i);
    if (inStr) {
      if (esc2) esc2 = false;
      else if (ch === '\\') esc2 = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.substring(s, i + 1);
    }
  }
  return null;
}

function _looksLikeDocOp(op) {
  if (!op || typeof op !== 'object') return false;
  if (Array.isArray(op.blocks)) return true;
  if (op.replaceBlock !== undefined && op.block) return true;
  if (op.insertAfter !== undefined && op.block) return true;
  if (op.deleteBlock !== undefined) return true;
  return false;
}

function sanitizeBlock(b) {
  if (!b || typeof b !== 'object') return null;
  var type = String(b.type || '').toLowerCase();
  if (type !== 'html' && !LEGAL_COMPONENTS[type]) return null;
  var data = (b.data && typeof b.data === 'object' && !Array.isArray(b.data)) ? b.data : {};
  return { type: type, data: data };
}

function sanitizeBlocks(arr) {
  var out = [];
  if (!Array.isArray(arr)) return out;
  for (var i = 0; i < arr.length; i++) {
    var sb = sanitizeBlock(arr[i]);
    if (sb) out.push(sb);
  }
  return out;
}

function parseAiResponse(raw) {
  var text = String(raw || '').replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  var suggests = [];
  text = text.replace(/\[\[suggest_(\w+)\]\][ \t]*(.*)/gi, function (m, id, desc) {
    var d = desc.trim();
    if (d) suggests.push({ id: id, text: d });
    return '';
  });
  var jsonStr = _extractJson(text);
  var op = null;
  if (jsonStr) {
    try { op = JSON.parse(jsonStr); } catch (e) { op = null; }
  }
  if (op && !_looksLikeDocOp(op)) op = null;
  var summary = text;
  if (jsonStr) {
    var ji = text.indexOf(jsonStr);
    summary = text.substring(0, ji) + ' ' + text.substring(ji + jsonStr.length);
  }
  summary = summary.replace(/\n{3,}/g, '\n\n').trim();
  if (summary.length > 800) summary = summary.substring(0, 800) + '…';
  return { op: op, summary: summary, suggests: suggests };
}

/** Apply an AI document operation. Returns true if the document changed. */
function applyAiOp(op) {
  if (!op) return false;
  var changed = false;
  if (Array.isArray(op.blocks)) {
    DB.blocks = sanitizeBlocks(op.blocks);
    changed = true;
  } else if (op.replaceBlock !== undefined && op.block) {
    var ri = parseInt(op.replaceBlock, 10);
    var rb = sanitizeBlock(op.block);
    if (!isNaN(ri) && ri >= 0 && ri < DB.blocks.length && rb) {
      DB.blocks[ri] = rb;
      changed = true;
    }
  } else if (op.insertAfter !== undefined && op.block) {
    var ii = parseInt(op.insertAfter, 10);
    var ib = sanitizeBlock(op.block);
    if (ib && !isNaN(ii)) {
      var at = Math.max(-1, Math.min(ii, DB.blocks.length - 1)) + 1;
      DB.blocks.splice(at, 0, ib);
      changed = true;
    }
  } else if (op.deleteBlock !== undefined) {
    var di = parseInt(op.deleteBlock, 10);
    if (!isNaN(di) && di >= 0 && di < DB.blocks.length) {
      DB.blocks.splice(di, 1);
      changed = true;
    }
  }
  return changed;
}

/* ── Send / stream ── */
function sendChatMessage() {
  var input = el('chat-input');
  if (!input) return;
  if (_aiCallActive) { showToast('AI is already drafting. Wait or press Stop.', 'warning'); return; }
  var msg = input.value.trim();
  if (!msg) return;

  var tok = { cancelled: false };
  _reqToken = tok;

  addChatMessage('user', msg);
  input.value = '';
  input.style.height = 'auto';
  ensureSession();

  var prompt = buildChatPrompt(msg);
  _aiCallActive = true;
  updateConnStatus('busy');
  _setAiUIActive(true);
  showThinkingBubble('AI is drafting…');
  setAiTimeout(prompt.length);

  var fullResponse = '';
  try {
    tool.requestAIStream(prompt, null, {
      onToken: function (token) {
        if (tok.cancelled) return;
        _lastTokenAt = Date.now();
        fullResponse += token;
        if (_streamCallback) _streamCallback(token);
      },
      onComplete: function () {
        if (tok.cancelled) return;
        finishAi(fullResponse);
      },
      onError: function (err) {
        clearAiTimeout();
        hideThinkingBubble();
        _aiCallActive = false;
        _setAiUIActive(false);
        updateConnStatus('error');
        addChatMessage('ai', '⚠️ **AI request failed:** ' + String(err || 'unknown error') + '\n\nTry again, or simplify your request.', { isError: true });
        tool.resize();
      }
    });
  } catch (e) {
    clearAiTimeout();
    hideThinkingBubble();
    _aiCallActive = false;
    _setAiUIActive(false);
    updateConnStatus('error');
    addChatMessage('ai', '⚠️ **AI request failed:** ' + esc(e.message || 'unknown error'), { isError: true });
    tool.resize();
  }
}

function finishAi(fullResponse) {
  clearAiTimeout();
  var elapsed = Date.now() - _thinkingStartTime;
  _markThinkingComplete(elapsed);
  _setAiUIActive(false);
  _aiCallActive = false;
  updateConnStatus('ok');

  var parsed = parseAiResponse(fullResponse);
  var changed = false;
  var version = null;
  if (parsed.op) {
    changed = applyAiOp(parsed.op);
    if (changed) {
      _bumpVersion('minor');
      persist();
      mountPreview();
      updateDocStats();
      version = DB.version;
    }
  }
  var text = parsed.summary;
  if (parsed.op && !changed) {
    text = (text ? text + '\n\n' : '') + '⚠️ The response did not contain valid block changes — please ask again.';
  }
  if (!parsed.op && !text) {
    text = '✅ Done. Tell me what to adjust next.';
  }
  addChatMessage('ai', text, { opts: parsed.suggests, version: version });
  if (changed) {
    showToast('✅ Document updated to v' + DB.version + ' — remember to Save in the CMS to commit.', 'success');
  }
  tool.resize();
}

/* ═══════════════════════════════════════════
   SELECTION TARGETING
   ═══════════════════════════════════════════ */
function setSelectionTarget(sel) {
  if (!sel || sel.idx < 0 || sel.idx >= DB.blocks.length) {
    _selTarget = null;
  } else {
    var excerpt = sel.text.replace(/\s+/g, ' ').substring(0, 80);
    _selTarget = { idx: sel.idx, type: sel.type, text: sel.text };
    var chip = el('chat-target-chip');
    if (chip) {
      el('chat-target-label').textContent = 'Block #' + (sel.idx + 1) + ' (' + sel.type + '): “' + excerpt + '…” — AI edits ONLY this part';
      chip.style.display = '';
    }
    var info = el('sel-target-info');
    if (info) info.textContent = '🎯 Targeted: block #' + (sel.idx + 1) + ' (' + sel.type + ') — the next AI request edits only this part';
  }
  var clearBtn = el('btn-target-clear');
  if (clearBtn) clearBtn.style.display = _selTarget ? '' : 'none';
}

function clearSelectionTarget() {
  _selTarget = null;
  var chip = el('chat-target-chip');
  if (chip) chip.style.display = 'none';
  var info = el('sel-target-info');
  if (info) info.textContent = '🎯 Select text inside the document to target it for the next AI edit';
  var clearBtn = el('btn-target-clear');
  if (clearBtn) clearBtn.style.display = 'none';
}

/* ═══════════════════════════════════════════
   MANUAL EDIT MODE (contentEditable inside the preview)
   ═══════════════════════════════════════════ */
var _editMode = false;
var _ignoreEdits = false;

function sendDocMessage(data) {
  var iframe = el('doc-preview');
  if (!iframe || !iframe.contentWindow) return;
  try { iframe.contentWindow.postMessage(data, '*'); } catch (e) {}
}

function updateEditToolbar() {
  var bar = el('edit-format-bar');
  if (bar) bar.style.display = _editMode ? '' : 'none';
  var btn = el('btn-toggle-edit');
  if (btn) {
    btn.textContent = _editMode ? '✅ Save Edits' : '✏️ Edit';
    if (_editMode) { btn.classList.remove('btn-ghost'); btn.classList.add('btn-primary'); }
    else { btn.classList.remove('btn-primary'); btn.classList.add('btn-ghost'); }
  }
  var selInfo = el('sel-target-info');
  if (_editMode && selInfo) selInfo.textContent = '✏️ Editing mode — click into the document and type. Use the formatting buttons, then Save Edits.';
}

function setEditMode(on) {
  if (on && tool.isReadOnly()) { showToast('Read-only mode — editing is disabled.', 'warning'); return; }
  _editMode = !!on;
  sendDocMessage({ lbCmd: { cmd: 'edit', on: _editMode } });
  updateEditToolbar();
}

function toggleEditMode() { setEditMode(!_editMode); }

function sendFormatCmd(op, val) {
  if (!_editMode) return;
  sendDocMessage({ lbCmd: { cmd: 'format', op: op, val: val || null } });
}

/** Apply blocks edited by hand in the preview back into the block model. */
function applyManualEdits(changes) {
  if (!changes || !changes.length) return false;
  var changedAny = false;
  for (var i = 0; i < changes.length; i++) {
    var c = changes[i];
    var idx = parseInt(c.idx, 10);
    if (isNaN(idx) || idx < 0 || idx >= DB.blocks.length) continue;
    if (c.html === undefined || c.html === null) continue;
    var b = DB.blocks[idx];
    b.data = b.data || {};
    if (b.type === 'html') {
      if (b.data.html !== c.html) { b.data.html = c.html; changedAny = true; }
    } else {
      if (b.data.manualHtml !== c.html) { b.data.manualHtml = c.html; changedAny = true; }
    }
  }
  return changedAny;
}

/* ═══════════════════════════════════════════
   COMPONENT CATALOG UI
   ═══════════════════════════════════════════ */
var CAT_LABELS = { content: 'content', structural: 'structural', boilerplate: 'boilerplate' };
var CAT_ICONS = { content: '📘', structural: '📐', boilerplate: '♻️' };

function renderCatalog(filter) {
  var list = el('components-list');
  if (!list) return;
  var f = String(filter || '').toLowerCase();
  var h = '';
  for (var k in LEGAL_COMPONENTS) {
    if (!Object.prototype.hasOwnProperty.call(LEGAL_COMPONENTS, k)) continue;
    var c = LEGAL_COMPONENTS[k];
    if (f && (k + ' ' + c.name + ' ' + c.desc).toLowerCase().indexOf(f) === -1) continue;
    h += '<div class="comp-card">' +
      '<div class="comp-card-top"><div class="comp-card-icon">' + (c.icon || '📄') + '</div>' +
      '<div class="comp-card-name">' + esc(c.name) + '</div>' +
      '<span class="comp-card-type ' + esc(c.cat || 'content') + '">' + esc(CAT_LABELS[c.cat] || c.cat || 'content') + '</span></div>' +
      '<div class="comp-card-desc">' + esc(c.desc) + '</div>' +
      '<div class="comp-card-schema">type: "' + esc(k) + '" · ' + esc(c.schema) + '</div>' +
      '<div class="comp-card-actions"><button class="btn btn-sm btn-primary" data-comp-add="' + esc(k) + '">➕ Add</button></div>' +
      '</div>';
  }
  if (!h) h = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:30px">No components match the filter.</div>';
  list.innerHTML = h;

  var btns = list.querySelectorAll('[data-comp-add]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', function () {
      var type = this.getAttribute('data-comp-add');
      var c2 = LEGAL_COMPONENTS[type];
      var prompt = 'Please add a "' + type + '" block (' + (c2 ? c2.name : '') + ') to the document' +
        (c2 ? ' — ' + c2.desc : '') + '. Fit it to the current document context.';
      sendPreset(prompt);
    });
  }
}

/* ═══════════════════════════════════════════
   FORMATTING CONTROLS & SETTINGS
   ═══════════════════════════════════════════ */
function populateFmtControls() {
  var sel = el('fmt-font');
  if (sel) {
    sel.innerHTML = FONTS.map(function (f) {
      return '<option value="' + esc(f) + '"' + (f === (DB.settings.fontFamily || '') ? ' selected' : '') + '>' + esc(f) + '</option>';
    }).join('');
  }
  var sz = el('fmt-size');
  if (sz) {
    sz.innerHTML = SIZES.map(function (s) {
      return '<option value="' + esc(s) + '"' + (s === (DB.settings.fontSize || '') ? ' selected' : '') + '>' + esc(s) + '</option>';
    }).join('');
  }
  var lh = el('fmt-lh');
  if (lh) {
    lh.innerHTML = LINEHEIGHTS.map(function (s) {
      return '<option value="' + esc(s) + '"' + (s === String(DB.settings.lineHeight || '') ? ' selected' : '') + '>' + esc(s) + ' line</option>';
    }).join('');
  }
  var col = el('fmt-color');
  if (col) col.value = DB.settings.color || '#111111';
}

function applyFmtControls() {
  var changed = false;
  var f = el('fmt-font');
  if (f && DB.settings.fontFamily !== f.value) { DB.settings.fontFamily = f.value; changed = true; }
  var s = el('fmt-size');
  if (s && DB.settings.fontSize !== s.value) { DB.settings.fontSize = s.value; changed = true; }
  var l = el('fmt-lh');
  if (l && String(DB.settings.lineHeight) !== l.value) { DB.settings.lineHeight = l.value; changed = true; }
  var c = el('fmt-color');
  if (c && DB.settings.color !== c.value) { DB.settings.color = c.value; changed = true; }
  if (changed) {
    _bumpVersion('patch');
    persist();
    mountPreview();
    showToast('Formatting updated (v' + DB.version + ')', 'success');
  }
}

function renderParamsSummary() {
  var box = el('params-summary');
  if (!box) return;
  var items = [
    ['defaultFontFamily', DB.settings.fontFamily],
    ['defaultFontSize', DB.settings.fontSize],
    ['defaultColor', DB.settings.color],
    ['defaultLineHeight', DB.settings.lineHeight],
    ['jurisdiction', tool.param('jurisdiction', '(not set)')],
    ['docxLibUrl', tool.param('docxLibUrl', '(default CDN)')]
  ];
  var h = '';
  for (var i = 0; i < items.length; i++) {
    h += '<b>' + esc(items[i][0]) + '</b>: ' + esc(items[i][1] || '') + '<br>';
  }
  box.innerHTML = h;
}

/* ═══════════════════════════════════════════
   EXPORTS — HTML / PDF / DOCX
   ═══════════════════════════════════════════ */
function downloadBlob(blob, filename) {
  try {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (e) {
    showToast('Download failed: ' + e.message, 'error');
  }
}

function exportHtml() {
  showToast('📥 Preparing HTML…', 'info');
  buildPaginatedHtml(function (pagesHtml) {
    var html = buildStandaloneHtml(pagesHtml);
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, slugify(resolveTitle()) + '.html');
    showToast('📥 HTML downloaded — Word-style pages, fully standalone (all styles embedded).', 'success');
  });
}

function exportPdf() {
  var filename = slugify(resolveTitle()) + '.pdf';
  function doPdf(pagesHtml) {
    if (typeof tool.requestExportPdf === 'function') {
      try {
        tool.requestExportPdf({ html: buildStandaloneHtml(pagesHtml), filename: filename }, function (err, file) {
          if (err || !file) {
            printFallback();
            return;
          }
          if (file.url && typeof tool.openUrl === 'function') {
            tool.openUrl(file.url);
            showToast('🖨️ PDF exported: ' + (file.name || filename), 'success');
          } else {
            // Some hosts deliver the PDF without a preview URL.
            showToast('🖨️ PDF export completed: ' + (file.name || filename), 'success');
          }
        });
        return;
      } catch (e) { /* fall through */ }
    }
    printFallback();
  }
  showToast('🖨️ Preparing PDF (paginating A4 pages)…', 'info');
  buildPaginatedHtml(function (pagesHtml) { doPdf(pagesHtml); });
}

function printFallback() {
  buildPaginatedHtml(function (pagesHtml) {
    try {
      var w = window.open('', '_blank');
      if (!w) {
        showToast('Pop-up blocked — allow pop-ups, or use HTML export and print from the browser.', 'warning');
        return;
      }
      w.document.open();
      w.document.write(buildStandaloneHtml(pagesHtml));
      w.document.close();
      setTimeout(function () {
        try { w.focus(); w.print(); } catch (e) { showToast('Use your browser\u2019s print dialog in the opened window.', 'info'); }
      }, 600);
    } catch (e) {
      showToast('PDF export unavailable: ' + e.message, 'error');
    }
  });
}

/* ── DOCX export (docx library loaded lazily from CDN) ── */
var _docxState = { loading: false, loaded: false, available: false, callbacks: [] };

function ensureDocxLib(callback) {
  if (_docxState.loaded) { callback(_docxState.available); return; }
  _docxState.callbacks.push(callback);
  if (_docxState.loading) return;
  _docxState.loading = true;
  if (window.docx) {
    _docxState.loaded = true;
    _docxState.available = true;
    flushDocxCallbacks(true);
    return;
  }
  var url = tool.param('docxLibUrl', '');
  if (!url) url = 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js';
  var script = document.createElement('script');
  script.src = url;
  var timer = setTimeout(function () {
    _docxState.loaded = true;
    _docxState.available = false;
    flushDocxCallbacks(false);
  }, 12000);
  script.onload = function () {
    clearTimeout(timer);
    _docxState.loaded = true;
    _docxState.available = !!window.docx;
    flushDocxCallbacks(_docxState.available);
  };
  script.onerror = function () {
    clearTimeout(timer);
    _docxState.loaded = true;
    _docxState.available = false;
    flushDocxCallbacks(false);
  };
  document.head.appendChild(script);
}

function flushDocxCallbacks(ok) {
  var cbs = _docxState.callbacks;
  _docxState.callbacks = [];
  for (var i = 0; i < cbs.length; i++) cbs[i](ok);
}

function exportDocx() {
  showToast('📄 Preparing DOCX…', 'info');
  ensureDocxLib(function (ok) {
    if (ok) {
      try {
        var items = htmlToDocxItems('<div class="doc-sheet">' + blocksToHtml() + '</div>');
        var W = window.docx;
        var doc = new W.Document({
          creator: 'Legal Document Builder',
          title: resolveTitle(),
          sections: [{ properties: {}, children: items }]
        });
        W.Packer.toBlob(doc).then(function (blob) {
          downloadBlob(blob, slugify(resolveTitle()) + '.docx');
          showToast('📄 DOCX downloaded — open it in Microsoft Word.', 'success');
        }).catch(function (e) {
          console.warn('docx pack failed', e);
          exportWordFallback();
        });
      } catch (e) {
        console.warn('docx build failed', e);
        exportWordFallback();
      }
    } else {
      exportWordFallback();
    }
  });
}

function exportWordFallback() {
  var head = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>' + esc(resolveTitle()) + '</title>' +
    '<xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>' +
    '<style>@page{margin:20mm 18mm;size:A4}</style></head><body><div class="doc-sheet">' + blocksToHtml() + '</div></body></html>';
  var blob = new Blob(['\ufeff' + head], { type: 'application/msword' });
  downloadBlob(blob, slugify(resolveTitle()) + '.doc');
  showToast('📄 Word file downloaded (.doc — Word-compatible HTML). The real .docx library could not be loaded from the CDN.', 'warning');
}

/* ── HTML → DOCX conversion (walks the rendered document DOM) ── */
function htmlToDocxItems(html) {
  var W = window.docx;
  if (!W) return [];
  var parser = new DOMParser();
  var doc = parser.parseFromString('<html><body>' + html + '</body></html>', 'text/html');
  var items = [];

  function parseSize(v) {
    if (!v) return null;
    var m = String(v).match(/([\d.]+)\s*(pt|px)/i);
    if (m) {
      var n = parseFloat(m[1]);
      return m[2].toLowerCase() === 'pt' ? Math.round(n * 2) : Math.round(n * 1.5);
    }
    m = String(v).match(/([\d.]+)/);
    return m ? Math.round(parseFloat(m[1]) * 2) : null;
  }

  function mergeStyle(el2, st) {
    var s = el2.getAttribute && el2.getAttribute('style') ? el2.getAttribute('style') : '';
    var out = { bold: st.bold, italic: st.italic, underline: st.underline, size: st.size, color: st.color, font: st.font };
    if (/font-weight\s*:\s*([6-9]00|bold)/.test(s)) out.bold = true;
    if (/font-style\s*:\s*italic/.test(s)) out.italic = true;
    if (/text-decoration\s*:[^;]*underline/.test(s)) out.underline = true;
    var fm = s.match(/font-family\s*:\s*([^;]+)/);
    if (fm) {
      var ff = fm[1].split(',')[0].trim().replace(/['"]/g, '');
      if (ff) out.font = ff;
    }
    var cm = s.match(/color\s*:\s*(#[0-9a-fA-F]{3,6}|rgb\([^)]*\))/);
    if (cm) out.color = cm[1];
    var sm = s.match(/font-size\s*:\s*([^;]+)/);
    if (sm) out.size = parseSize(sm[1]) || out.size;
    return out;
  }

  function makeRun(text, st) {
    var opts = { text: text };
    if (st.bold) opts.bold = true;
    if (st.italic) opts.italics = true;
    if (st.underline) opts.underline = {};
    if (st.size) opts.size = st.size;
    if (st.color) opts.color = st.color;
    if (st.font) opts.font = st.font;
    return new W.TextRun(opts);
  }

  function textRuns(node, st) {
    var runs = [];
    (function walk(n, cur) {
      for (var i = 0; i < n.childNodes.length; i++) {
        var c = n.childNodes[i];
        if (c.nodeType === 3) {
          var t = c.nodeValue.replace(/\s+/g, ' ');
          if (t.trim()) runs.push(makeRun(t, cur));
        } else if (c.nodeType === 1) {
          var tag = c.tagName.toLowerCase();
          if (tag === 'br') continue;
          var cur2 = mergeStyle(c, cur);
          if (tag === 'strong' || tag === 'b') cur2.bold = true;
          if (tag === 'em' || tag === 'i') cur2.italic = true;
          if (tag === 'u') cur2.underline = true;
          walk(c, cur2);
        }
      }
    })(node, st);
    return runs;
  }

  function makeParagraph(runs, opts) {
    opts = opts || {};
    var p = {
      children: runs,
      spacing: { after: 160 }
    };
    if (opts.heading) p.heading = opts.heading;
    if (opts.align) p.alignment = opts.align;
    else p.alignment = W.AlignmentType.JUSTIFIED;
    if (opts.bullet) p.bullet = { level: 0 };
    return new W.Paragraph(p);
  }

  function paraFromEl(el2, st, opts) {
    var runs = textRuns(el2, st);
    if (!runs.length) return null;
    if (opts && opts.prefix) runs.unshift(makeRun(opts.prefix, st));
    return makeParagraph(runs, opts);
  }

  var olCounters = [];
  function walkList(el2, st, ordered, depth) {
    var li = el2.children;
    var idx = 0;
    for (var i = 0; i < li.length; i++) {
      if (li[i].tagName.toLowerCase() !== 'li') continue;
      idx++;
      var prefix = null;
      if (ordered) {
        var level = depth || 0;
        if (level === 0) prefix = idx + '. ';
        else prefix = String.fromCharCode(96 + Math.min(idx, 26)) + ') ';
      }
      // paragraph(s) inside the li
      var hasBlock = false;
      var kids = li[i].children;
      for (var k = 0; k < kids.length; k++) {
        var tag = kids[k].tagName.toLowerCase();
        if (tag === 'p' || tag === 'div' || tag === 'ul' || tag === 'ol' || tag === 'table') { hasBlock = true; break; }
      }
      if (hasBlock) {
        for (var k2 = 0; k2 < kids.length; k2++) {
          walk(kids[k2], st, { ordered: ordered, depth: depth, liPrefix: k2 === 0 ? prefix : null });
        }
      } else {
        var runs = textRuns(li[i], st);
        if (runs.length) {
          if (prefix) runs.unshift(makeRun(prefix, st));
          var opts = ordered ? null : { bullet: true };
          items.push(makeParagraph(runs, opts));
        }
      }
    }
  }

  function walkTable(el2, st) {
    var rows = [];
    var trs = el2.querySelectorAll('tr');
    var gridBorder = { style: W.BorderStyle.SINGLE, size: 4, color: '94A3B8' };
    for (var i = 0; i < trs.length; i++) {
      var cells = [];
      var tds = trs[i].children;
      // Header row = first row where every cell is a <th>
      var isHeader = i === 0 && tds.length > 0;
      for (var xh = 0; xh < tds.length && isHeader; xh++) {
        if (tds[xh].tagName.toLowerCase() !== 'th') isHeader = false;
      }
      var nCols = tds.length;
      for (var j = 0; j < tds.length; j++) {
        var cellChildren = [];
        var cellSt = isHeader ? { bold: true, italic: st.italic, underline: st.underline, size: st.size, color: '#111827', font: st.font } : st;
        var kids = tds[j].children;
        if (kids.length) {
          for (var k = 0; k < kids.length; k++) {
            var p = paraFromEl(kids[k], cellSt, { align: W.AlignmentType.LEFT });
            if (p) cellChildren.push(p);
            else { var rr = textRuns(kids[k], cellSt); if (rr.length) cellChildren.push(makeParagraph(rr, { align: W.AlignmentType.LEFT })); }
          }
        } else {
          var rr2 = textRuns(tds[j], cellSt);
          if (rr2.length) cellChildren.push(makeParagraph(rr2, { align: W.AlignmentType.LEFT }));
        }
        if (!cellChildren.length) cellChildren.push(makeParagraph([makeRun('', cellSt)], { align: W.AlignmentType.LEFT }));
        var cellOpts = {
          children: cellChildren,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          borders: {
            top: gridBorder, bottom: gridBorder, left: gridBorder, right: gridBorder
          }
        };
        if (nCols > 0) cellOpts.width = { size: Math.floor(100 / nCols), type: W.WidthType.PERCENTAGE };
        if (isHeader) cellOpts.shading = { fill: 'E2E8F0' };
        cells.push(new W.TableCell(cellOpts));
      }
      rows.push(new W.TableRow({ children: cells }));
    }
    items.push(new W.Table({
      width: { size: 100, type: W.WidthType.PERCENTAGE },
      layout: W.TableLayoutType ? W.TableLayoutType.FIXED : undefined,
      borders: {
        top: gridBorder, bottom: gridBorder, left: gridBorder, right: gridBorder,
        insideHorizontal: gridBorder, insideVertical: gridBorder
      },
      rows: rows
    }));
  }

  function walk(el2, st, ctx) {
    ctx = ctx || {};
    var kids = el2.childNodes;
    for (var i = 0; i < kids.length; i++) {
      var node = kids[i];
      if (node.nodeType === 3) {
        var t = node.nodeValue.replace(/\s+/g, ' ');
        if (t.trim()) items.push(makeParagraph([makeRun(t, st)], null));
        continue;
      }
      if (node.nodeType !== 1) continue;
      var tag = node.tagName.toLowerCase();
      var st2 = mergeStyle(node, st);
      var cls = node.className ? String(node.className) : '';
      if (/lb-page-break/.test(cls)) {
        items.push(new W.Paragraph({ children: [new W.PageBreak()] }));
        continue;
      }
      if (tag === 'table') { walkTable(node, st2); continue; }
      if (tag === 'ul' || tag === 'ol') {
        walkList(node, st2, tag === 'ol', (ctx.depth || 0) + 1);
        continue;
      }
      if (tag === 'li') {
        var prefix2 = ctx.liPrefix;
        var runs = textRuns(node, st2);
        if (runs.length) {
          if (prefix2) runs.unshift(makeRun(prefix2, st2));
          items.push(makeParagraph(runs, ctx.ordered ? null : { bullet: true }));
        }
        continue;
      }
      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
        var levels = { h1: W.HeadingLevel.HEADING_1, h2: W.HeadingLevel.HEADING_2, h3: W.HeadingLevel.HEADING_3, h4: W.HeadingLevel.HEADING_4, h5: W.HeadingLevel.HEADING_5, h6: W.HeadingLevel.HEADING_6 };
        var p2 = paraFromEl(node, st2, { heading: levels[tag], align: W.AlignmentType.LEFT });
        if (p2) items.push(p2);
        continue;
      }
      if (tag === 'p') {
        var al = W.AlignmentType.JUSTIFIED;
        var sAttr = node.getAttribute('style') || '';
        if (/text-align\s*:\s*center/.test(sAttr)) al = W.AlignmentType.CENTER;
        else if (/text-align\s*:\s*left/.test(sAttr)) al = W.AlignmentType.LEFT;
        else if (/text-align\s*:\s*right/.test(sAttr)) al = W.AlignmentType.RIGHT;
        var p3 = paraFromEl(node, st2, { align: al });
        if (p3) items.push(p3);
        continue;
      }
      if (tag === 'blockquote') {
        var p4 = paraFromEl(node, st2, { align: W.AlignmentType.LEFT });
        if (p4) items.push(p4);
        continue;
      }
      if (tag === 'hr') {
        items.push(makeParagraph([makeRun('________________________________', st2)], { align: W.AlignmentType.CENTER }));
        continue;
      }
      if (tag === 'style' || tag === 'script') continue;
      // Generic container: recurse (div, span, etc.)
      walk(node, st2, ctx);
    }
  }

  walk(doc.body, { bold: false, italic: false, underline: false, size: null, color: null, font: null }, {});
  return items;
}

/* ═══════════════════════════════════════════
   READ-ONLY / ROLES
   ═══════════════════════════════════════════ */
function applyReadOnly(ro) {
  var banner = el('ro-banner');
  if (banner) banner.style.display = ro ? '' : 'none';
  var send = el('btn-chat-send');
  var input = el('chat-input');
  if (send) { send.disabled = ro || _aiCallActive; }
  if (input) { input.disabled = ro || _aiCallActive; input.placeholder = ro ? 'Read-only mode — document changes are disabled' : 'Describe your legal document or ask for changes… (Enter to send, Shift+Enter for new line)'; }
  var fmt = document.querySelectorAll('.fmt-select, .fmt-color');
  for (var i = 0; i < fmt.length; i++) {
    fmt[i].disabled = ro;
    fmt[i].style.opacity = ro ? '0.5' : '';
  }
  var reset = el('btn-reset-doc');
  if (reset) reset.disabled = ro;
  var toggleEdit = el('btn-toggle-edit');
  if (toggleEdit) toggleEdit.disabled = ro;
  if (ro) {
    if (_editMode) setEditMode(false);
    var bar = el('edit-format-bar');
    if (bar) bar.style.display = 'none';
  }
}

/* ═══════════════════════════════════════════
   EVENT BINDINGS
   ═══════════════════════════════════════════ */
function closeDrawer(name) {
  var d = el('drawer-' + name);
  if (d) d.classList.remove('open');
}

function openDrawer(name) {
  // Only one drawer at a time
  closeDrawer(name === 'components' ? 'settings' : 'components');
  var d = el('drawer-' + name);
  if (!d) return;
  d.classList.add('open');
  if (name === 'components') renderCatalog(el('comp-search') ? el('comp-search').value : '');
  if (name === 'settings') updateDocStats();
  tool.resize();
}

function toggleDrawer(name) {
  var d = el('drawer-' + name);
  if (!d) return;
  if (d.classList.contains('open')) closeDrawer(name);
  else openDrawer(name);
}

function confirmClick(btn, action, confirmLabel) {
  var original = btn.textContent;
  function restore() {
    btn.textContent = original;
    btn.classList.remove('btn-danger');
    btn._confirmArmed = false;
    btn._confirmTimer = null;
  }
  if (btn._confirmArmed) {
    clearTimeout(btn._confirmTimer);
    restore();
    action();
    return;
  }
  btn._confirmArmed = true;
  btn.textContent = confirmLabel || 'Click again to confirm';
  btn.classList.add('btn-danger');
  btn._confirmTimer = setTimeout(restore, 4000);
}

function bindEvents() {
  var send = el('btn-chat-send');
  if (send) send.addEventListener('click', sendChatMessage);
  var stop = el('btn-chat-stop');
  if (stop) stop.addEventListener('click', cancelAiRequest);

  var input = el('chat-input');
  if (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    });
  }

  var clearChat = el('btn-clear-chat');
  if (clearChat) {
    clearChat.addEventListener('click', function () {
      var self = this;
      confirmClick(self, function () {
        _chatMessages = [];
        updateChatCache();
        renderChatMessages();
        bindOptionButtons();
        if (DB.activeSessionId) saveCurrentSession();
        showToast('Chat cleared.', 'info');
      }, 'Clear chat?');
    });
  }

  // Manual edit mode
  var toggleEdit = el('btn-toggle-edit');
  if (toggleEdit) toggleEdit.addEventListener('click', toggleEditMode);
  var editCancel = el('btn-edit-cancel');
  if (editCancel) {
    editCancel.addEventListener('click', function () {
      // Discard: ignore the lbEdited reply, leave edit mode, rebuild the preview
      _ignoreEdits = true;
      setEditMode(false);
      mountPreview();
      setTimeout(function () { _ignoreEdits = false; }, 300);
    });
  }
  var fmtBtns = document.querySelectorAll('[data-fmt-op]');
  for (var fb = 0; fb < fmtBtns.length; fb++) {
    fmtBtns[fb].addEventListener('click', function () {
      sendFormatCmd(this.getAttribute('data-fmt-op'));
    });
  }
  var editColor = el('edit-color');
  if (editColor) editColor.addEventListener('change', function () { sendFormatCmd('foreColor', editColor.value); });
  var editHl = el('edit-highlight');
  if (editHl) editHl.addEventListener('change', function () { sendFormatCmd('hiliteColor', editHl.value); });

  var targetClear = el('btn-target-clear');
  if (targetClear) targetClear.addEventListener('click', clearSelectionTarget);

  // Side drawers: Components / Settings & Export
  var openComp = el('btn-open-components');
  if (openComp) openComp.addEventListener('click', function () { toggleDrawer('components'); });
  var closeComp = el('btn-close-components');
  if (closeComp) closeComp.addEventListener('click', function () { closeDrawer('components'); });
  var openSet = el('btn-open-settings');
  if (openSet) openSet.addEventListener('click', function () { toggleDrawer('settings'); });
  var closeSet = el('btn-close-settings');
  if (closeSet) closeSet.addEventListener('click', function () { closeDrawer('settings'); });

  // Component search
  var search = el('comp-search');
  if (search) search.addEventListener('input', function () { renderCatalog(search.value); });

  // Formatting controls
  var fmtEls = [el('fmt-font'), el('fmt-size'), el('fmt-lh')];
  for (var f = 0; f < fmtEls.length; f++) {
    if (fmtEls[f]) fmtEls[f].addEventListener('change', applyFmtControls);
  }
  var col = el('fmt-color');
  if (col) col.addEventListener('change', applyFmtControls);

  // Exports
  var eh1 = el('btn-export-html');
  if (eh1) eh1.addEventListener('click', exportHtml);
  var eh2 = el('btn-export-html2');
  if (eh2) eh2.addEventListener('click', exportHtml);
  var ed1 = el('btn-export-docx');
  if (ed1) ed1.addEventListener('click', exportDocx);
  var ed2 = el('btn-export-docx2');
  if (ed2) ed2.addEventListener('click', exportDocx);
  var ep1 = el('btn-export-pdf');
  if (ep1) ep1.addEventListener('click', exportPdf);
  var ep2 = el('btn-export-pdf2');
  if (ep2) ep2.addEventListener('click', exportPdf);

  // Refresh preview
  var refresh = el('btn-refresh-preview');
  if (refresh) refresh.addEventListener('click', function () { mountPreview(); showToast('Preview refreshed.', 'info'); });

  // Reset document
  var reset = el('btn-reset-doc');
  if (reset) {
    reset.addEventListener('click', function () {
      var self = this;
      confirmClick(self, function () {
        DB.blocks = [];
        _bumpVersion('minor');
        persist();
        mountPreview();
        updateDocStats();
        clearSelectionTarget();
        showToast('Document reset — describe a new document in the chat.', 'info');
      }, 'Really reset the whole document?');
    });
  }

  // Selection relay + manual edits from the preview iframe
  window.addEventListener('message', function (e) {
    if (!e.data) return;
    if (e.data.lbSel) { setSelectionTarget(e.data.lbSel); return; }
    if (e.data.lbEdited) {
      if (_ignoreEdits) return;
      var changed = applyManualEdits(e.data.lbEdited.blocks);
      if (changed) {
        _bumpVersion('patch');
        persist();
        mountPreview();
        updateDocStats();
        showToast('✏️ Manual edits saved (v' + DB.version + ') — remember to Save in the CMS.', 'success');
      } else {
        showToast('No changes to save.', 'info');
      }
    }
  });

  // Copy blocks JSON
  var copyBlocks = el('btn-copy-blocks');
  if (copyBlocks) {
    copyBlocks.addEventListener('click', function () {
      var json = JSON.stringify(DB.blocks, null, 2);
      try {
        navigator.clipboard.writeText(json).then(function () {
          showToast('Blocks JSON copied to clipboard.', 'success');
        }).catch(function () { showToast('Clipboard unavailable — see console.', 'warning'); console.log(json); });
      } catch (e) {
        showToast('Clipboard unavailable — see console.', 'warning');
        console.log(json);
      }
    });
  }

  // Selection relay from the preview iframe
  window.addEventListener('message', function (e) {
    if (!e.data || !e.data.lbSel) return;
    setSelectionTarget(e.data.lbSel);
  });
}

/* ═══════════════════════════════════════════
   ENTRY POINT
   ═══════════════════════════════════════════ */
tool.onReady(function (val, fields) {
  // Load saved state
  var v = val && typeof val === 'object' ? val : {};
  DB.version = v.version || '1.0.0';
  DB.blocks = Array.isArray(v.blocks) ? v.blocks : [];
  DB.activeSessionId = v.activeSessionId || '';
  DB.chatCache = (v.chatCache && typeof v.chatCache === 'object') ? v.chatCache : null;
  DB._instanceId = v._instanceId || '';
  DB.settings = (v.settings && typeof v.settings === 'object') ? v.settings : {};

  // Fill missing settings from admin params
  if (!DB.settings.fontFamily) DB.settings.fontFamily = tool.param('defaultFontFamily', 'Times New Roman');
  if (!DB.settings.fontSize) DB.settings.fontSize = tool.param('defaultFontSize', '12pt');
  if (!DB.settings.color) DB.settings.color = tool.param('defaultColor', '#111111');
  if (!DB.settings.lineHeight) DB.settings.lineHeight = String(tool.param('defaultLineHeight', '1.6'));

  tool.declareParams([
    { name: 'defaultFontFamily', label: 'Default Font Family', type: 'text', default: 'Times New Roman', severity: 'goodToHave', hint: 'Default font for new documents (Times New Roman, Georgia, Arial, Calibri…).' },
    { name: 'defaultFontSize', label: 'Default Font Size', type: 'text', default: '12pt', severity: 'goodToHave', hint: 'Default base font size (e.g. 12pt).' },
    { name: 'defaultColor', label: 'Default Text Color', type: 'text', default: '#111111', severity: 'optional', hint: 'Default text color (hex).' },
    { name: 'defaultLineHeight', label: 'Default Line Height', type: 'text', default: '1.6', severity: 'optional', hint: 'Default line spacing (1.15, 1.5, 1.6, 2.0…).' },
    { name: 'jurisdiction', label: 'Default Jurisdiction', type: 'text', default: '', severity: 'optional', hint: 'Optional default governing-law jurisdiction mentioned in drafts.' },
    { name: 'docxLibUrl', label: 'DOCX Library URL', type: 'text', default: '', severity: 'optional', hint: 'Override URL for the docx.js UMD library used for .docx export. Leave empty for the default CDN.' }
  ]);

  bindEvents();
  _renderVersion();
  populateFmtControls();
  renderParamsSummary();
  mountPreview();
  updateDocStats();
  applyReadOnly(tool.isReadOnly());

  tool.onReadonlyChange(function (ro) {
    applyReadOnly(ro);
    if (ro) showToast('Read-only mode active — changes are disabled.', 'warning');
  });

  // Load chat sessions, then restore the active chat
  loadSessions(function () {
    restoreActiveSessionMessages();
    renderChatMessages();
    bindOptionButtons();
  });

  // External value changes (another user edited)
  tool.onValueChange(function (newVal) {
    if (!newVal || typeof newVal !== 'object') return;
    DB.version = newVal.version || DB.version;
    DB.blocks = Array.isArray(newVal.blocks) ? newVal.blocks : [];
    if (newVal.settings && typeof newVal.settings === 'object') DB.settings = newVal.settings;
    if (newVal.activeSessionId !== undefined) DB.activeSessionId = newVal.activeSessionId;
    if (newVal.chatCache) DB.chatCache = newVal.chatCache;
    if (newVal._instanceId) DB._instanceId = newVal._instanceId;
    _renderVersion();
    populateFmtControls();
    mountPreview();
    updateDocStats();
  });

  tool.resize();
});
