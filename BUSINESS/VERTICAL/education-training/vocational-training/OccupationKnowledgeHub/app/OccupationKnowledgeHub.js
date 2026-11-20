/* js build 2026-11-14-1 */

/* =====================================================================
   OccupationKnowledgeHub - a private occupation dossier for students.

   CORE RULE (see docs/ssot.html): ONE TOOL INSTANCE = ONE OCCUPATION.
   The dossier content (what the work looks like, benefits, difficulties,
   the Canadian programs and how to reach them, FAQ, glossary, sources)
   is stored in THIS record's value through tool.setValue(). Editors and
   admins write it by hand or ask the AI to draft/update it.

   READ  : the tool's own value (the dossier) + question objects of the
           configured type (the student question board).
   WRITE : tool.setValue() for the dossier, tool.requestObjects() for
           questions/answers, and the optional AI chat session objects.
           Never a direct database or network call from the sandbox.

   Value shape (version 1):
   {
     version: 1,
     occupation: { title, slug, category, oneLiner, summary, tags[], status, updatedAt, updatedBy },
     sections:   { <sectionKey>: "text" },
     programs:   [ { id, institution, faculty, program, level, city, province, ... } ],
     contacts:   [ { id, label, name, role, email, phone, website, note } ],
     sources:    [ { id, title, url, note } ],
     chatSessionId: ""
   }
   ===================================================================== */

/* Tool build stamp - MANDATORY (html-tool-rules GLOBAL REQUIREMENT):
   bump on EVERY code change so stale CMS uploads are detectable. */
var TOOL_BUILD = '2026-11-14-1';
console.log('[TOOL:BOOT] build ' + TOOL_BUILD + ' OccupationKnowledgeHub starting...');

(function () {
  'use strict';

  /* ----------------------------------------------------------- constants */

  var CONTENT_VERSION = 1;
  var MAX_PROGRAMS = 200;
  var MAX_CONTACTS = 60;
  var MAX_SOURCES = 120;
  var MAX_CHAT_MESSAGES = 60;
  var MAX_QUESTION_LENGTH = 140;
  var MAX_QUESTION_BODY = 4000;
  var MAX_ANSWER_LENGTH = 4000;
  var MAX_SECTION_TEXT = 20000;
  var MAX_AI_DIGEST = 60000;
  var MAX_AI_JSON = 70000;
  var SAVE_DEBOUNCE = 500;

  var EDITOR_ROLES = ['admin', 'owner', 'developer', 'user-manager', 'editor'];

  var STUDY_LEVELS = [
    { id: 'certificate', label: 'Certificate' },
    { id: 'diploma', label: 'Diploma' },
    { id: 'bachelor', label: 'Bachelor' },
    { id: 'master', label: 'Master' },
    { id: 'doctorate', label: 'Doctorate' },
    { id: 'postgraduate', label: 'Post-graduate' }
  ];

  var CANADIAN_PROVINCES = [
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
    'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia',
    'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec',
    'Saskatchewan', 'Yukon'
  ];

  /* Every dossier section the tool knows about. Rendering, the editor and
     the AI contract all read THIS list, so a new section is one entry. */
  var SECTION_DEFS = [
    {
      key: 'whatItIs', label: 'What this occupation is', type: 'text', wide: true,
      hint: 'Two to four short paragraphs: what the job is, what the person is responsible for, and who they work with.'
    },
    {
      key: 'dayInTheLife', label: 'What the work looks like', type: 'text', wide: true,
      hint: 'A typical day and week: the real tasks, the rhythm, the people, the pressure points.'
    },
    {
      key: 'workEnvironment', label: 'Work environment', type: 'text',
      hint: 'Where the work happens: indoors or outdoors, shifts, travel, team size, physical conditions.'
    },
    {
      key: 'benefits', label: 'Why people choose it', type: 'lines', columns: ['Benefit', 'What it means'],
      hint: 'One benefit per line: Benefit | what it means.'
    },
    {
      key: 'difficulties', label: 'Difficulties and how to prepare', type: 'lines', columns: ['Difficulty', 'What makes it hard', 'How to prepare'],
      hint: 'One difficulty per line: Difficulty | what makes it hard | how to prepare.'
    },
    {
      key: 'skills', label: 'Skills that matter', type: 'lines', columns: ['Skill', 'Why it matters', 'How to build it'],
      hint: 'One skill per line: Skill | why it matters | how to build it.'
    },
    {
      key: 'educationPath', label: 'Education path in Canada', type: 'text', wide: true,
      hint: 'High school subjects, college and university routes, length, and what to do first.'
    },
    {
      key: 'certification', label: 'Licences, certifications and exams', type: 'lines', columns: ['Credential', 'Provider', 'Link'],
      hint: 'One credential per line: Credential | provider | link.'
    },
    {
      key: 'salary', label: 'Pay', type: 'text', wide: true,
      hint: 'Starting, typical and senior pay in CAD. Say clearly when a number is an estimate.'
    },
    {
      key: 'jobMarket', label: 'Job market and outlook', type: 'text', wide: true,
      hint: 'Demand, hiring sectors, regions, and what improves a candidate.'
    },
    {
      key: 'careerLadder', label: 'Career path and progression', type: 'lines', columns: ['Stage', 'Title', 'Typical timing'],
      hint: 'One stage per line: Stage | title | typical timing.'
    },
    {
      key: 'tools', label: 'Tools and technology', type: 'lines', columns: ['Tool', 'Used for'],
      hint: 'One tool per line: Tool | what it is used for.'
    },
    {
      key: 'relatedOccupations', label: 'Related occupations', type: 'lines', columns: ['Occupation', 'How it is related'],
      hint: 'One occupation per line: Occupation | how it is related.'
    },
    {
      key: 'glossary', label: 'Terms to know', type: 'lines', columns: ['Term', 'Meaning'],
      hint: 'One term per line: Term | meaning.'
    },
    {
      key: 'faq', label: 'Frequently asked questions', type: 'qa', wide: true,
      hint: 'Each question on one line as "Q: question" and the answer on the next line as "A: answer".'
    },
    {
      key: 'resources', label: 'Where to learn more', type: 'lines', columns: ['Resource', 'Link'],
      hint: 'One resource per line: Resource | link.'
    }
  ];

  var SECTION_KEYS = SECTION_DEFS.map(function (def) { return def.key; });

  var OCCUPATION_FIELD_LABELS = {
    title: 'Occupation name',
    slug: 'Occupation key',
    category: 'Category',
    oneLiner: 'One-line description',
    summary: 'Overview summary',
    tags: 'Tags',
    status: 'Status'
  };

  var PROGRAM_FIELDS = [
    'institution', 'faculty', 'program', 'level', 'city', 'province',
    'credential', 'duration', 'tuition', 'admission', 'language', 'delivery',
    'website', 'email', 'phone', 'notes'
  ];

  var CONTACT_FIELDS = ['label', 'name', 'role', 'email', 'phone', 'website', 'note'];
  var SOURCE_FIELDS = ['title', 'url', 'note'];

  var QA_FIELDS = [
    'title', 'body', 'topic', 'status', 'occupationKey', 'occupationName',
    'askedBy', 'askedByName', 'askedAt', 'answers', 'updatedAt',
    'answeredAt', 'answeredBy', 'answeredByName', 'votes', 'closedAt', 'lastActivityAt'
  ];

  var TABS = [
    { id: 'overview', label: 'Dossier', icon: 'book' },
    { id: 'study', label: 'Study in Canada', icon: 'grad', count: 'programs' },
    { id: 'ask', label: 'Ask AI', icon: 'spark' },
    { id: 'questions', label: 'Questions', icon: 'chat', count: 'openQuestions' },
    { id: 'edit', label: 'Edit', icon: 'pen', editorOnly: true }
  ];

  var AI_PRESETS = [
    { id: 'fill-empty', label: 'Fill every empty section', instruction: 'Fill every empty section of this dossier with accurate, student-friendly content. Leave the sections that already have content unchanged.' },
    { id: 'benefits-difficulties', label: 'Benefits and difficulties', instruction: 'Write the benefits section and the difficulties section for this occupation. Include how a student can prepare for each difficulty.' },
    { id: 'programs', label: 'Add Canadian programs', instruction: 'Add real study programs in Canada that lead to this occupation. For each program add the institution, faculty or department, city, province, level, credential, duration, admission requirements and the official website. Leave a field empty when you are not sure.' },
    { id: 'faq', label: 'Write the FAQ', instruction: 'Write 8 frequently asked questions a student would ask about this occupation, with clear answers. Use the Q: and A: line format.' },
    { id: 'salary-market', label: 'Pay and job market', instruction: 'Write the pay section and the job market section for this occupation in Canada. Use CAD ranges, say clearly that the numbers are estimates, and explain what improves a candidate.' },
    { id: 'improve', label: 'Improve what is here', instruction: 'Improve the existing content: make it clearer and more complete for a student, keep every fact that is already correct, and remove repetition.' }
  ];

  var CHAT_SUGGESTIONS = [
    'What does a typical day look like?',
    'What are the hardest parts of this job?',
    'Which Canadian programs should I apply to?',
    'How long does it take to qualify?',
    'How much can I earn after five years?',
    'What should I study in high school to prepare?'
  ];

  /* --------------------------------------------------------------- state */

  var _content = null;
  var _config = {
    occupationKey: '',
    qaObjectType: 'occupation-questions',
    qaDataCategory: '',
    chatSessionType: 'ai-chat-sessions-uniconbaseapps',
    allowAi: '',
    allowObjectCRUD: ''
  };

  var _ui = {
    tab: 'overview',
    studySearch: '',
    studyProvince: '',
    studyLevel: '',
    studySort: 'institution',
    questionFilter: 'all',
    questionSearch: '',
    openThreadId: '',
    answerDraft: '',
    askDraft: { title: '', topic: '', body: '' }
  };

  var _chat = {
    messages: [],
    sessionId: '',
    busy: false,
    busyStartedAt: 0,
    busyTimer: null,
    elapsedTimer: null,
    draft: '',
    warned: false
  };

  var _questions = [];
  var _qaState = 'idle';   /* idle | loading | ready | error | unavailable */
  var _qaError = '';
  var _aiBusy = false;
  var _aiPreview = null;
  var _confirmCallback = null;
  var _lastStagedJson = '';
  var _saveTimer = null;
  var _savedAt = 0;
  var _user = null;
  var _readOnly = false;
  var _noIdentity = false;
  var _canEditContent = false;
  var _wired = false;
  var _warnedAccess = false;
  var _warnedChatStorage = false;

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

  function setText(id, text) {
    var element = $id(id);
    if (element) element.textContent = (text === undefined || text === null) ? '' : String(text);
  }

  function hasText(value) {
    return String(value === undefined || value === null ? '' : value).trim().length > 0;
  }

  function cleanText(value, limit) {
    var text = String(value === undefined || value === null ? '' : value).trim();
    return limit ? text.slice(0, limit) : text;
  }

  function genId(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function nowIso() { return new Date().toISOString(); }

  function normalizeKey(value) {
    return String(value === undefined || value === null ? '' : value)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  function normalizeSlug(value) {
    return String(value === undefined || value === null ? '' : value).trim().toLowerCase();
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

  function wordCountOf(text) {
    var trimmed = String(text === undefined || text === null ? '' : text).trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  function snippet(value, limit) {
    var text = String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim();
    var cap = limit || 110;
    return text.length > cap ? text.slice(0, cap) + '...' : text;
  }

  function formatDate(iso) {
    if (!iso) return '';
    var date = new Date(iso);
    if (isNaN(date.getTime())) return String(iso);
    try {
      return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(date);
    } catch (err) { return date.toDateString(); }
  }

  function formatDateTime(iso) {
    if (!iso) return '';
    var date = new Date(iso);
    if (isNaN(date.getTime())) return String(iso);
    try {
      return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
    } catch (err) { return date.toLocaleString(); }
  }

  function relativeTime(iso) {
    if (!iso) return '';
    var timestamp = new Date(iso).getTime();
    if (isNaN(timestamp)) return '';
    var minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return minutes + ' min ago';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + ' h ago';
    var days = Math.floor(hours / 24);
    if (days < 30) return days + ' d ago';
    return formatDate(iso);
  }

  function safeUrl(value) {
    var text = String(value === undefined || value === null ? '' : value).trim();
    if (!text) return '';
    if (/^(https?:\/\/|mailto:|tel:)/i.test(text)) return text;
    if (/^www\./i.test(text)) return 'https://' + text;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return 'mailto:' + text;
    return '';
  }

  function emailHref(value) {
    var text = String(value === undefined || value === null ? '' : value).trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? 'mailto:' + text : '';
  }

  function phoneHref(value) {
    var digits = String(value === undefined || value === null ? '' : value).replace(/[^0-9+]/g, '');
    return digits.length >= 5 ? 'tel:' + digits : '';
  }

  function iconHtml(name) {
    return '<svg class="okh-ico" viewBox="0 0 24 24" aria-hidden="true"><use href="#okh-i-' + esc(name) + '"></use></svg>';
  }

  function notify(message, severity) {
    try {
      if (typeof tool.notify === 'function') { tool.notify(message, severity || 'info'); return; }
    } catch (err) { /* ignore */ }
    console.log('[OccupationKnowledgeHub] ' + (severity || 'info') + ': ' + message);
  }

  function requestResize() {
    try { if (typeof tool.resize === 'function') tool.resize(); } catch (err) { /* ignore */ }
  }

  function paramRaw(name, fallback) {
    try {
      if (typeof tool === 'undefined' || typeof tool.param !== 'function') return fallback;
      var value = tool.param(name, fallback);
      return (value === undefined || value === null || value === '') ? fallback : value;
    } catch (err) { return fallback; }
  }

  function aiEnabled() {
    return String(_config.allowAi || '').toLowerCase() === 'yes' && typeof tool.requestAI === 'function';
  }

  function objectAccessParamOn() {
    return String(_config.allowObjectCRUD || '').toLowerCase() === 'yes';
  }

  function recordId() {
    try {
      var fields = (typeof tool.getFields === 'function') ? tool.getFields() : null;
      if (fields && (fields.id || fields._id)) return String(fields.id || fields._id);
    } catch (err) { /* ignore */ }
    return '';
  }

  function recordName() {
    try {
      var fields = (typeof tool.getFields === 'function') ? tool.getFields() : null;
      if (fields && fields.name) return String(fields.name);
    } catch (err) { /* ignore */ }
    return '';
  }

  function currentUser() {
    return _user || null;
  }

  function userName() {
    var user = currentUser();
    return (user && (user.name || user.email)) ? String(user.name || user.email) : 'CMS user';
  }

  function userId() {
    var user = currentUser();
    return (user && user.id) ? String(user.id) : '';
  }

  /* ---------------------------------------------------- reading CMS data */

  function findFieldValue(bag, name) {
    if (!bag || typeof bag !== 'object') return undefined;
    if (Object.prototype.hasOwnProperty.call(bag, name)) return bag[name];
    var wanted = normalizeKey(name);
    var keys = Object.keys(bag);
    for (var i = 0; i < keys.length; i++) {
      if (normalizeKey(keys[i]) === wanted) return bag[keys[i]];
    }
    return undefined;
  }

  /* Every bag a CMS object may keep its field values in: the record itself,
     data_categoriesBased (flat or keyed by a category), objectData and
     productData. The tool reads all of them so it works on every tenant. */
  function collectDataBags(source) {
    var bags = [];
    if (!source || typeof source !== 'object') return bags;

    function pushBag(bag) {
      if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return;
      if (bags.indexOf(bag) === -1) bags.push(bag);
    }

    function pushContainer(container) {
      if (!container || typeof container !== 'object' || Array.isArray(container)) return;
      pushBag(container);
      Object.keys(container).forEach(function (key) {
        var child = container[key];
        if (child && typeof child === 'object' && !Array.isArray(child)) pushBag(child);
      });
    }

    pushBag(source);
    pushContainer(source.data_categoriesBased);
    pushBag(source.data);
    if (source.objectData && typeof source.objectData === 'object') {
      pushBag(source.objectData);
      pushContainer(source.objectData.data_categoriesBased);
    }
    if (source.productData && typeof source.productData === 'object') {
      pushBag(source.productData);
      pushContainer(source.productData.data_categoriesBased);
    }
    return bags;
  }

  function readFieldValue(bags, name) {
    for (var i = 0; i < bags.length; i++) {
      var value = findFieldValue(bags[i], name);
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
  }

  /* Key of the data category that holds the given field names, or '' when
     the values are stored flat. Writes go back into the same place. */
  function dataCategoryOf(source, fieldNames) {
    if (!source || typeof source !== 'object') return '';
    var containers = [];
    if (source.productData && source.productData.data_categoriesBased) containers.push(source.productData.data_categoriesBased);
    if (source.data_categoriesBased) containers.push(source.data_categoriesBased);
    if (source.objectData && source.objectData.data_categoriesBased) containers.push(source.objectData.data_categoriesBased);

    for (var c = 0; c < containers.length; c++) {
      var container = containers[c];
      if (!container || typeof container !== 'object' || Array.isArray(container)) continue;
      var flat = false;
      for (var fieldIndex = 0; fieldIndex < fieldNames.length; fieldIndex++) {
        if (Object.prototype.hasOwnProperty.call(container, fieldNames[fieldIndex])) { flat = true; break; }
      }
      if (flat) continue;
      var keys = Object.keys(container);
      for (var keyIndex = 0; keyIndex < keys.length; keyIndex++) {
        var value = container[keys[keyIndex]];
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
        for (var nameIndex = 0; nameIndex < fieldNames.length; nameIndex++) {
          if (Object.prototype.hasOwnProperty.call(value, fieldNames[nameIndex])) return keys[keyIndex];
        }
      }
    }
    return '';
  }

  function wrapInDataCategory(category, patch) {
    if (!category) return patch;
    var bag = {};
    bag[category] = patch;
    return bag;
  }

  /* ------------------------------------------------------- dossier model */

  function emptySections() {
    var sections = {};
    SECTION_KEYS.forEach(function (key) { sections[key] = ''; });
    return sections;
  }

  function defaultContent() {
    return {
      version: CONTENT_VERSION,
      occupation: {
        title: '',
        slug: '',
        category: '',
        oneLiner: '',
        summary: '',
        tags: [],
        status: 'draft',
        updatedAt: '',
        updatedBy: ''
      },
      sections: emptySections(),
      programs: [],
      contacts: [],
      sources: [],
      chatSessionId: ''
    };
  }

  function normalizeProgram(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var program = { id: cleanText(raw.id, 60) || genId('program') };
    PROGRAM_FIELDS.forEach(function (field) {
      program[field] = cleanText(raw[field], field === 'admission' || field === 'notes' ? 2000 : 300);
    });
    program.level = normalizeLevel(program.level);
    if (!program.institution && !program.program) return null;
    return program;
  }

  function normalizeContactItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var contact = { id: cleanText(raw.id, 60) || genId('contact') };
    CONTACT_FIELDS.forEach(function (field) {
      contact[field] = cleanText(raw[field], field === 'note' ? 800 : 200);
    });
    if (!contact.label && !contact.name && !contact.email && !contact.phone) return null;
    return contact;
  }

  function normalizeSourceItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var source = { id: cleanText(raw.id, 60) || genId('source') };
    SOURCE_FIELDS.forEach(function (field) {
      source[field] = cleanText(raw[field], field === 'note' ? 600 : 300);
    });
    if (!source.title && !source.url) return null;
    return source;
  }

  function normalizeLevel(value) {
    var key = normalizeKey(value);
    if (!key) return '';
    for (var i = 0; i < STUDY_LEVELS.length; i++) {
      if (normalizeKey(STUDY_LEVELS[i].id) === key || normalizeKey(STUDY_LEVELS[i].label) === key) return STUDY_LEVELS[i].id;
    }
    return cleanText(value, 40).toLowerCase();
  }

  function levelLabel(value) {
    for (var i = 0; i < STUDY_LEVELS.length; i++) {
      if (STUDY_LEVELS[i].id === value) return STUDY_LEVELS[i].label;
    }
    return hasText(value) ? String(value) : '';
  }

  function normalizeContent(value) {
    var base = defaultContent();
    var raw = asObject(value) || {};

    if (raw.occupation && typeof raw.occupation === 'object') {
      base.occupation.title = cleanText(raw.occupation.title, 160);
      base.occupation.slug = normalizeSlug(raw.occupation.slug).slice(0, 80);
      base.occupation.category = cleanText(raw.occupation.category, 120);
      base.occupation.oneLiner = cleanText(raw.occupation.oneLiner, 400);
      base.occupation.summary = cleanText(raw.occupation.summary, 4000);
      base.occupation.tags = asArray(raw.occupation.tags).map(function (tag) { return cleanText(tag, 40); }).filter(Boolean).slice(0, 20);
      base.occupation.status = String(raw.occupation.status || '').toLowerCase() === 'published' ? 'published' : 'draft';
      base.occupation.updatedAt = cleanText(raw.occupation.updatedAt, 40);
      base.occupation.updatedBy = cleanText(raw.occupation.updatedBy, 120);
    }

    if (raw.sections && typeof raw.sections === 'object') {
      SECTION_KEYS.forEach(function (key) {
        base.sections[key] = cleanText(raw.sections[key], MAX_SECTION_TEXT);
      });
    }

    base.programs = asArray(raw.programs).map(normalizeProgram).filter(Boolean).slice(0, MAX_PROGRAMS);
    base.contacts = asArray(raw.contacts).map(normalizeContactItem).filter(Boolean).slice(0, MAX_CONTACTS);
    base.sources = asArray(raw.sources).map(normalizeSourceItem).filter(Boolean).slice(0, MAX_SOURCES);
    base.chatSessionId = cleanText(raw.chatSessionId, 120);
    base.version = CONTENT_VERSION;
    return base;
  }

  function sectionDefOf(key) {
    for (var i = 0; i < SECTION_DEFS.length; i++) {
      if (SECTION_DEFS[i].key === key) return SECTION_DEFS[i];
    }
    return null;
  }

  function occupationTitle() {
    return _content.occupation.title || recordName() || 'This occupation';
  }

  function isPublished() {
    return _content.occupation.status === 'published';
  }

  function contentIsEmpty() {
    if (hasText(_content.occupation.summary) || hasText(_content.occupation.oneLiner)) return false;
    if (_content.programs.length || _content.contacts.length) return false;
    for (var i = 0; i < SECTION_KEYS.length; i++) {
      if (hasText(_content.sections[SECTION_KEYS[i]])) return false;
    }
    return true;
  }

  /* --------------------------------------------------------- persistence */

  function loadContent() {
    var value = null;
    try { value = (typeof tool.getValue === 'function') ? tool.getValue() : null; } catch (err) { value = null; }
    _content = normalizeContent(value);
    _lastStagedJson = JSON.stringify(_content);
    _chat.sessionId = _content.chatSessionId || '';
  }

  function scheduleSave() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(persistNow, SAVE_DEBOUNCE);
  }

  function persistNow() {
    if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
    _content.occupation.updatedAt = nowIso();
    _content.occupation.updatedBy = userName();
    _content.chatSessionId = _chat.sessionId || '';
    var json = JSON.stringify(_content);
    if (json !== _lastStagedJson) {
      _lastStagedJson = json;
      try { tool.setValue(_content); } catch (err) { console.warn('[OccupationKnowledgeHub] setValue failed', err); }
      _savedAt = Date.now();
    }
    renderSavedState();
    requestResize();
  }

  function renderSavedState() {
    var element = $id('okh-save-state');
    if (!element) return;
    if (!_savedAt) { element.textContent = 'Saved in this record'; element.className = 'okh-save-state'; return; }
    element.textContent = 'Saved ' + new Date(_savedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    element.className = 'okh-save-state is-saved';
  }

  /* ----------------------------------------------------------- parameters */

  function readConfig() {
    _config.allowAi = String(paramRaw('allowAi', ''));
    _config.allowObjectCRUD = String(paramRaw('allowObjectCRUD', ''));
    _config.occupationKey = cleanText(paramRaw('occupationKey', ''), 80);
    _config.qaObjectType = cleanText(paramRaw('questionsObjectType', 'occupation-questions'), 120) || 'occupation-questions';
    _config.qaDataCategory = cleanText(paramRaw('questionsDataCategory', ''), 80);
    _config.chatSessionType = cleanText(paramRaw('chatSessionObjectType', 'ai-chat-sessions-uniconbaseapps'), 120) || 'ai-chat-sessions-uniconbaseapps';
  }

  function declareToolParams() {
    if (typeof tool === 'undefined' || typeof tool.declareParams !== 'function') return;
    try {
      tool.declareParams([
        {
          name: 'allowAi', label: 'Allow AI', type: 'toggle', default: 'yes', severity: 'mandatory',
          hint: 'Required for the AI study coach and for the AI content builder. Set allowAi: yes in the html-tool field settings.'
        },
        {
          name: 'allowObjectCRUD', label: 'Allow Object CRUD', type: 'toggle', default: 'yes', severity: 'goodToHave',
          hint: 'Enables the student question board and the saved AI chat history through tool.requestObjects. Set allowObjectCRUD: yes and add the types below to allowedObjectTypes.'
        },
        {
          name: 'questionsObjectType', label: 'Question board object type', type: 'text', default: 'occupation-questions', severity: 'goodToHave',
          hint: 'CMS object type that stores one object per student question. Create this application in the CMS and add it to settings.allowedObjectTypes with role editor and scope shared.'
        },
        {
          name: 'questionsDataCategory', label: 'Question board data category', type: 'text', default: '', severity: 'optional',
          hint: 'Leave empty unless the CMS stores the question field values inside a data category. Then enter that category id so writes land where reads look.'
        },
        {
          name: 'occupationKey', label: 'Occupation key (optional)', type: 'text', default: '', severity: 'optional',
          hint: 'Groups questions and chat history. Leave empty to derive it from the occupation slug, then the record id. Two instances with the same key share one question board.'
        },
        {
          name: 'chatSessionObjectType', label: 'AI chat session object type', type: 'text', default: 'ai-chat-sessions-uniconbaseapps', severity: 'optional',
          hint: 'Platform type that stores the AI chat transcript. Keep the default unless your platform uses another id.'
        }
      ]);
      if (typeof tool.declareOutput === 'function') {
        tool.declareOutput({
          type: 'object',
          description: 'One occupation dossier plus the id of its AI chat session.',
          properties: {
            version: { type: 'number' },
            occupation: { type: 'object', description: 'title, slug, category, oneLiner, summary, tags, status' },
            sections: { type: 'object', description: 'One text value per dossier section' },
            programs: { type: 'array', description: 'Canadian study programs with institution, faculty and contact details' },
            contacts: { type: 'array', description: 'How to reach the institutions' },
            sources: { type: 'array', description: 'Where the information came from' },
            chatSessionId: { type: 'string' }
          }
        });
      }
    } catch (err) {
      console.warn('[OccupationKnowledgeHub] declareParams failed', err);
    }
  }

  function reportMissingConfig() {
    var missing = [];
    if (!aiEnabled()) {
      missing.push({
        name: 'allowAi', label: 'Allow AI', type: 'toggle', default: 'yes', severity: 'mandatory',
        hint: 'Set allowAi: yes in the html-tool field settings so the study coach and the AI content builder can work.',
        reason: 'The AI coach answers student questions from this dossier.'
      });
    }
    if (missing.length && typeof tool.reportMissingParams === 'function') {
      try {
        tool.reportMissingParams(missing, 'This tool needs AI access before the study coach can answer questions.');
      } catch (err) { /* ignore */ }
    }
  }

  /* ---------------------------------------------------------- permissions */

  function getUserSafe() {
    try { return (typeof tool.getUser === 'function') ? tool.getUser() : null; } catch (err) { return null; }
  }

  function rolesOf(user) {
    var roles = (user && Array.isArray(user.roles)) ? user.roles.slice() : [];
    var access = (user && user.effectiveAccess) ? user.effectiveAccess : {};
    if (!roles.length) {
      if (access.isManager) roles.push('admin');
      else if (access.isEditor) roles.push('editor');
      else if (access.isViewer) roles.push('viewer');
    }
    return roles;
  }

  function computePermissions() {
    var roles = rolesOf(_user);
    var access = (_user && _user.effectiveAccess) ? _user.effectiveAccess : {};
    var isEditor = !!access.isEditor || !!access.isManager;
    for (var i = 0; i < roles.length; i++) {
      if (EDITOR_ROLES.indexOf(roles[i]) !== -1) { isEditor = true; break; }
    }
    _canEditContent = !_readOnly && (_noIdentity ? true : isEditor);
    if (!_canEditContent && _ui.tab === 'edit') _ui.tab = 'overview';
  }

  function roleLabel() {
    if (_noIdentity) return 'CMS session';
    var roles = rolesOf(_user);
    if (!roles.length) return 'Student';
    if (_canEditContent) return 'Editor';
    return 'Student';
  }

  function bootIdentity() {
    _noIdentity = (typeof tool.getUser !== 'function');
    _user = getUserSafe();
    computePermissions();
    if (_noIdentity || _user) return;

    var delays = [400, 1200, 2600, 5000];
    delays.forEach(function (delay) {
      setTimeout(function () {
        var user = getUserSafe();
        if (user) { _user = user; computePermissions(); renderAll(); }
      }, delay);
    });
    setTimeout(function () {
      if (!_user) { _noIdentity = true; computePermissions(); renderAll(); }
    }, 5400);
  }

  /* ------------------------------------------------------------- rendering */

  function renderAll() {
    /* A viewer never sees an unpublished dossier (private database rule). */
    var blocked = !_canEditContent && !isPublished() && !contentIsEmpty();

    renderHeader();
    renderTabs();
    renderBanners(blocked);
    renderPane(blocked);
    renderFoot();
    requestResize();
  }

  function renderHeader() {
    setText('okh-kicker', hasText(_content.occupation.category) ? _content.occupation.category : 'Occupation dossier');
    setText('okh-title', occupationTitle());
    setText('okh-sub', hasText(_content.occupation.oneLiner) ? _content.occupation.oneLiner : 'Everything a student needs to understand this occupation and reach it in Canada.');

    var statusChip = $id('okh-status-chip');
    if (statusChip) {
      statusChip.hidden = false;
      statusChip.textContent = isPublished() ? 'Published' : 'Draft';
      statusChip.className = 'okh-chip ' + (isPublished() ? 'is-published' : 'is-draft');
    }
    setText('okh-role-chip', roleLabel());
  }

  function openQuestionCount() {
    var count = 0;
    _questions.forEach(function (question) {
      if (question.status !== 'answered' && question.status !== 'closed') count++;
    });
    return count;
  }

  function renderTabs() {
    var host = $id('okh-tabs');
    if (!host) return;
    var html = '';
    TABS.forEach(function (tab) {
      if (tab.editorOnly && !_canEditContent) return;
      var count = 0;
      if (tab.count === 'programs') count = _content.programs.length;
      if (tab.count === 'openQuestions') count = openQuestionCount();
      html += '<button type="button" class="okh-tab' + (tab.id === _ui.tab ? ' is-on' : '') + '" data-act="tab" data-tab="' + esc(tab.id) + '">' +
        iconHtml(tab.icon) + '<span>' + esc(tab.label) + '</span>' +
        (count ? '<span class="okh-tab-count">' + esc(String(count)) + '</span>' : '') +
        '</button>';
    });
    host.innerHTML = html;
  }

  function renderBanners(blocked) {
    var roBanner = $id('okh-banner-ro');
    if (roBanner) {
      roBanner.hidden = !_readOnly;
      if (_readOnly) roBanner.textContent = 'Read-only view. You can read the dossier and ask questions, but nothing can be saved from here.';
    }

    var configBanner = $id('okh-banner-config');
    if (configBanner) {
      var messages = [];
      if (!aiEnabled()) messages.push('AI is not enabled for this tool, so the study coach and the AI content builder are off. Ask an administrator to set allowAi: yes.');
      if (!objectAccessParamOn()) messages.push('The student question board is not configured yet. Ask an administrator to set allowObjectCRUD: yes and to allow the question object type (details in the Edit tab).');
      configBanner.hidden = !messages.length;
      if (messages.length) configBanner.textContent = messages.join(' ');
    }

    var draftBanner = $id('okh-banner-draft');
    if (draftBanner) {
      draftBanner.hidden = !(blocked || (!isPublished() && _canEditContent && !contentIsEmpty()));
      if (!draftBanner.hidden) {
        draftBanner.textContent = blocked
          ? 'This dossier is not published yet. An editor has to set the status to Published before students can read it.'
          : 'This dossier is still a draft. Students do not see it until its status is set to Published.';
      }
    }
  }

  function renderFoot() {
    var parts = [];
    parts.push(_content.occupation.updatedAt ? 'Dossier updated ' + formatDateTime(_content.occupation.updatedAt) : 'New dossier');
    parts.push(_content.programs.length + (_content.programs.length === 1 ? ' program' : ' programs'));
    parts.push(_content.contacts.length + (_content.contacts.length === 1 ? ' contact' : ' contacts'));
    setText('okh-foot-note', parts.join('  -  '));
    setText('okh-build', 'tool build ' + TOOL_BUILD);
  }

  function renderPane(blocked) {
    var host = $id('okh-main');
    if (!host) return;

    if (blocked && _ui.tab !== 'questions') {
      host.innerHTML = '<div class="okh-empty">' +
        '<div class="okh-empty-icon">' + iconHtml('book') + '</div>' +
        '<h2>Not published yet</h2>' +
        '<p>This occupation dossier is still being written. An editor can publish it from the Edit tab.</p>' +
        '</div>';
      return;
    }

    if (_ui.tab === 'study') { host.innerHTML = studyPaneHtml(); return; }
    if (_ui.tab === 'ask') { host.innerHTML = askPaneHtml(); renderChatTranscript(); return; }
    if (_ui.tab === 'questions') { host.innerHTML = questionsPaneHtml(); return; }
    if (_ui.tab === 'edit') { host.innerHTML = editPaneHtml(); return; }
    host.innerHTML = overviewPaneHtml();
  }

  /* ------------------------------------------------------------ overview */

  function overviewPaneHtml() {
    if (contentIsEmpty()) return emptyDossierHtml();

    var html = heroHtml();
    html += '<div class="okh-sections">';
    SECTION_DEFS.forEach(function (def) {
      html += sectionCardHtml(def);
    });
    if (_content.contacts.length) html += contactsCardHtml();
    if (_content.sources.length) html += sourcesCardHtml();
    html += '</div>';
    return html;
  }

  function emptyDossierHtml() {
    var html = '<div class="okh-empty">' +
      '<div class="okh-empty-icon">' + iconHtml('book') + '</div>' +
      '<h2>This dossier is empty</h2>';
    if (_canEditContent) {
      html += '<p>Add the occupation details by hand in the Edit tab, or give the AI a short description and let it draft every section for you.</p>' +
        '<button type="button" class="okh-btn okh-btn-primary" data-act="go-edit">Start with the AI builder</button>';
    } else {
      html += '<p>An editor is still filling this dossier. Check back soon.</p>';
    }
    html += '</div>';
    return html;
  }

  function heroHtml() {
    var summary = _content.occupation.summary;
    var html = '<section class="okh-hero"><div class="okh-hero-grid">';

    html += '<div>';
    if (hasText(_content.occupation.oneLiner)) {
      html += '<p class="okh-hero-lede">' + esc(_content.occupation.oneLiner) + '</p>';
    }
    if (hasText(summary)) {
      html += '<p class="okh-hero-summary">' + esc(summary) + '</p>';
    }
    if (_content.occupation.tags.length) {
      html += '<div class="okh-tags">';
      _content.occupation.tags.forEach(function (tag) {
        html += '<span class="okh-tag">' + esc(tag) + '</span>';
      });
      html += '</div>';
    }
    html += '</div>';

    html += '<div class="okh-hero-side">';
    html += '<div class="okh-fact"><span>Category</span><strong>' + esc(_content.occupation.category || 'Not set') + '</strong></div>';
    html += '<div class="okh-fact"><span>Programs in Canada</span><strong>' + esc(String(_content.programs.length)) + '</strong></div>';
    html += '<div class="okh-fact"><span>Updated</span><strong>' + esc(_content.occupation.updatedAt ? formatDate(_content.occupation.updatedAt) : 'Not yet') + '</strong></div>';
    html += '</div>';

    html += '</div></section>';
    return html;
  }

  function sectionCardHtml(def) {
    var value = _content.sections[def.key] || '';
    var wideClass = def.wide ? ' okh-card-wide' : '';

    if (!hasText(value)) {
      if (!_canEditContent) return '';
      return '<section class="okh-card okh-card-empty' + wideClass + '">' +
        '<h2 class="okh-card-title"><span class="okh-dot"></span>' + esc(def.label) + '</h2>' +
        '<p class="okh-card-sub">Not written yet.</p>' +
        '<button type="button" class="okh-btn okh-btn-ghost okh-btn-sm" style="margin-top:10px" data-act="edit-section" data-key="' + esc(def.key) + '">' +
        iconHtml('plus') + '<span>Add this section</span></button>' +
        '</section>';
    }

    return '<section class="okh-card' + wideClass + '">' +
      '<div class="okh-card-head">' +
      '<h2 class="okh-card-title"><span class="okh-dot"></span>' + esc(def.label) + '</h2>' +
      (_canEditContent ? '<button type="button" class="okh-btn okh-btn-quiet okh-btn-sm" data-act="edit-section" data-key="' + esc(def.key) + '">' + iconHtml('pen') + '<span>Edit</span></button>' : '') +
      '</div>' +
      sectionBodyHtml(def, value) +
      '</section>';
  }

  function sectionBodyHtml(def, value) {
    if (def.type === 'lines') return linesBodyHtml(value, def.columns);
    if (def.type === 'qa') return faqBodyHtml(value);
    return '<div class="okh-prose">' + textBlockHtml(value) + '</div>';
  }

  function textBlockHtml(value) {
    var paragraphs = String(value || '').split(/\r?\n\s*\r?\n/);
    var html = '';
    paragraphs.forEach(function (paragraph) {
      var text = paragraph.trim();
      if (!text) return;
      html += '<p>' + esc(text).replace(/\r?\n/g, '<br>') + '</p>';
    });
    return html || '<p></p>';
  }

  function parseRows(text, columnCount) {
    var rows = [];
    String(text || '').split(/\r?\n/).forEach(function (rawLine) {
      var line = rawLine.trim();
      if (!line) return;
      line = line.replace(/^[-*\u2022]\s+/, '');
      var cells = line.split('|').map(function (cell) { return cell.trim(); });
      while (cells.length < columnCount) cells.push('');
      rows.push(cells.slice(0, columnCount));
    });
    return rows;
  }

  function linesBodyHtml(value, columns) {
    var rows = parseRows(value, columns.length);
    if (!rows.length) return '';

    if (columns.length === 2) {
      var pairs = '<div class="okh-pairs">';
      rows.forEach(function (cells) {
        pairs += '<div class="okh-pair"><strong>' + linkableTextHtml(cells[0]) + '</strong>' +
          (cells[1] ? '<span>' + linkableTextHtml(cells[1]) + '</span>' : '') + '</div>';
      });
      pairs += '</div>';
      return pairs;
    }

    var html = '<div class="okh-rows okh-rows-' + columns.length + '">';
    html += '<div class="okh-row okh-row-head">';
    columns.forEach(function (column) { html += '<span>' + esc(column) + '</span>'; });
    html += '</div>';
    rows.forEach(function (cells) {
      html += '<div class="okh-row">';
      cells.forEach(function (cell) { html += '<span>' + linkableTextHtml(cell) + '</span>'; });
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function linkableTextHtml(value) {
    var url = safeUrl(value);
    if (!url || !/^https?:\/\//i.test(url)) return esc(value);
    return '<button type="button" class="okh-inline-link" data-act="open-url" data-url="' + esc(url) + '">' + esc(value) + '</button>';
  }

  function parseFaq(text) {
    var items = [];
    var current = null;
    String(text || '').split(/\r?\n/).forEach(function (rawLine) {
      var line = rawLine.trim();
      if (!line) return;
      var questionMatch = /^q\s*[:\-]\s*(.+)$/i.exec(line);
      if (questionMatch) {
        current = { question: questionMatch[1].trim(), answer: '' };
        items.push(current);
        return;
      }
      var answerMatch = /^a\s*[:\-]\s*(.+)$/i.exec(line);
      if (answerMatch && current) {
        current.answer += (current.answer ? ' ' : '') + answerMatch[1].trim();
        return;
      }
      if (current) current.answer += (current.answer ? ' ' : '') + line;
    });
    return items.filter(function (item) { return hasText(item.question); });
  }

  function faqBodyHtml(value) {
    var items = parseFaq(value);
    if (!items.length) return textBlockHtml(value);
    var html = '';
    items.forEach(function (item) {
      html += '<details class="okh-faq"><summary>' + esc(item.question) + '</summary>' +
        '<p>' + esc(item.answer || 'No answer yet.') + '</p></details>';
    });
    return html;
  }

  function contactsCardHtml() {
    var html = '<section class="okh-card okh-card-wide">' +
      '<div class="okh-card-head"><h2 class="okh-card-title"><span class="okh-dot"></span>How to reach them</h2></div>' +
      '<div class="okh-pairs">';
    _content.contacts.forEach(function (contact) {
      var heading = contact.label || contact.name || 'Contact';
      var sub = [contact.name, contact.role].filter(hasText).join(' - ');
      html += '<div class="okh-pair"><strong>' + esc(heading) + '</strong>';
      if (sub && sub !== heading) html += '<span>' + esc(sub) + '</span>';
      if (hasText(contact.note)) html += '<span>' + esc(contact.note) + '</span>';
      html += '<div class="okh-program-actions" style="margin-top:7px">' +
        contactActionHtml('Website', 'link', contact.website) +
        contactActionHtml('Email', 'mail', emailHref(contact.email)) +
        contactActionHtml('Phone', 'phone', phoneHref(contact.phone)) +
        '</div></div>';
    });
    html += '</div></section>';
    return html;
  }

  function contactActionHtml(label, iconName, url) {
    if (!url) return '';
    var href = iconName === 'link' ? safeUrl(url) : url;
    if (!href) return '';
    return '<button type="button" class="okh-link-btn" data-act="open-url" data-url="' + esc(href) + '">' +
      iconHtml(iconName) + '<span>' + esc(label) + '</span></button>';
  }

  function sourcesCardHtml() {
    var html = '<section class="okh-card okh-card-wide">' +
      '<div class="okh-card-head"><h2 class="okh-card-title"><span class="okh-dot"></span>Sources</h2></div>' +
      '<div class="okh-pairs">';
    _content.sources.forEach(function (source) {
      html += '<div class="okh-pair"><strong>' + esc(source.title || source.url) + '</strong>' +
        (hasText(source.note) ? '<span>' + esc(source.note) + '</span>' : '') +
        (safeUrl(source.url) ? '<div class="okh-program-actions" style="margin-top:7px">' + contactActionHtml('Open source', 'link', source.url) + '</div>' : '') +
        '</div>';
    });
    html += '</div></section>';
    return html;
  }

  /* --------------------------------------------------------------- study */

  function provinceOptionsHtml(selected) {
    var html = '<option value="">All provinces</option>';
    CANADIAN_PROVINCES.forEach(function (province) {
      html += '<option value="' + esc(province) + '"' + (normalizeKey(province) === normalizeKey(selected) ? ' selected' : '') + '>' + esc(province) + '</option>';
    });
    return html;
  }

  function levelOptionsHtml(selected) {
    var html = '<option value="">All levels</option>';
    STUDY_LEVELS.forEach(function (level) {
      html += '<option value="' + esc(level.id) + '"' + (level.id === selected ? ' selected' : '') + '>' + esc(level.label) + '</option>';
    });
    return html;
  }

  function filteredPrograms() {
    var list = _content.programs.slice();
    var search = String(_ui.studySearch || '').trim().toLowerCase();
    var province = _ui.studyProvince;
    var level = _ui.studyLevel;

    if (province) list = list.filter(function (program) { return normalizeKey(program.province) === normalizeKey(province); });
    if (level) list = list.filter(function (program) { return normalizeKey(program.level) === normalizeKey(level); });
    if (search) {
      list = list.filter(function (program) {
        var haystack = [program.institution, program.faculty, program.program, program.city, program.province, program.credential, program.notes].join(' ').toLowerCase();
        return haystack.indexOf(search) !== -1;
      });
    }

    if (_ui.studySort === 'program') {
      list.sort(function (a, b) { return String(a.program || '').localeCompare(String(b.program || '')) || String(a.institution || '').localeCompare(String(b.institution || '')); });
    } else if (_ui.studySort === 'province') {
      list.sort(function (a, b) { return String(a.province || '').localeCompare(String(b.province || '')) || String(a.institution || '').localeCompare(String(b.institution || '')); });
    } else {
      list.sort(function (a, b) { return String(a.institution || '').localeCompare(String(b.institution || '')) || String(a.program || '').localeCompare(String(b.program || '')); });
    }
    return list;
  }

  function studyPaneHtml() {
    var html = '<div class="okh-card"><div class="okh-card-head">' +
      '<div><h2 class="okh-card-title"><span class="okh-dot"></span>Where to study this in Canada</h2>' +
      '<p class="okh-card-sub">Faculty or department, program, city, admission route and how to reach the institution.</p></div>' +
      (_canEditContent ? '<button type="button" class="okh-btn okh-btn-primary okh-btn-sm" data-act="program-add">' + iconHtml('plus') + '<span>Add program</span></button>' : '') +
      '</div></div>';

    if (!_content.programs.length) {
      html += '<div class="okh-empty"><div class="okh-empty-icon">' + iconHtml('grad') + '</div>' +
        '<h2>No programs yet</h2>' +
        '<p>' + (_canEditContent
          ? 'Add the Canadian colleges and universities that teach this occupation, or ask the AI to add them with their real website and contact details.'
          : 'An editor is still adding the Canadian programs for this occupation.') + '</p>' +
        (_canEditContent ? '<button type="button" class="okh-btn okh-btn-primary" data-act="program-add">Add the first program</button>' : '') +
        '</div>';
      return html;
    }

    html += '<div class="okh-filters">' +
      '<input type="text" id="okh-study-search" placeholder="Search institution, program or city" value="' + esc(_ui.studySearch) + '">' +
      '<select id="okh-study-province">' + provinceOptionsHtml(_ui.studyProvince) + '</select>' +
      '<select id="okh-study-level">' + levelOptionsHtml(_ui.studyLevel) + '</select>' +
      '<select id="okh-study-sort">' +
      '<option value="institution"' + (_ui.studySort === 'institution' ? ' selected' : '') + '>Sort by institution</option>' +
      '<option value="program"' + (_ui.studySort === 'program' ? ' selected' : '') + '>Sort by program</option>' +
      '<option value="province"' + (_ui.studySort === 'province' ? ' selected' : '') + '>Sort by province</option>' +
      '</select>' +
      '</div>';

    var list = filteredPrograms();
    if (!list.length) {
      html += '<div class="okh-card okh-card-empty"><p class="okh-card-sub">No program matches these filters.</p></div>';
      return html;
    }

    html += '<div class="okh-programs">';
    list.forEach(function (program) { html += programCardHtml(program); });
    html += '</div>';
    return html;
  }

  function programCardHtml(program) {
    var html = '<article class="okh-program">';

    html += '<div class="okh-program-top"><div>' +
      '<h3 class="okh-program-title">' + esc(program.program || program.credential || 'Program') + '</h3>' +
      '<p class="okh-program-inst">' + esc(program.institution || 'Institution') +
      (hasText(program.faculty) ? ' - ' + esc(program.faculty) : '') + '</p>' +
      '</div>' +
      (hasText(program.level) ? '<span class="okh-level">' + esc(levelLabel(program.level)) + '</span>' : '') +
      '</div>';

    var meta = [];
    if (hasText(program.city) || hasText(program.province)) {
      meta.push([program.city, program.province].filter(hasText).join(', '));
    }
    if (hasText(program.credential)) meta.push(program.credential);
    if (hasText(program.duration)) meta.push(program.duration);
    if (hasText(program.delivery)) meta.push(program.delivery);
    if (hasText(program.language)) meta.push(program.language);
    if (meta.length) {
      html += '<div class="okh-program-meta">' + meta.map(function (item) { return '<span>' + esc(item) + '</span>'; }).join('') + '</div>';
    }

    if (hasText(program.tuition)) {
      html += '<p class="okh-program-tuition"><strong>Tuition:</strong> ' + esc(program.tuition) + '</p>';
    }

    if (hasText(program.admission)) {
      html += '<details class="okh-program-more"><summary>Admission requirements</summary>' +
        '<p>' + esc(program.admission) + '</p></details>';
    }
    if (hasText(program.notes)) {
      html += '<details class="okh-program-more"><summary>Notes</summary>' +
        '<p>' + esc(program.notes) + '</p></details>';
    }

    var actions = contactActionHtml('Website', 'link', program.website) +
      contactActionHtml('Email', 'mail', emailHref(program.email)) +
      contactActionHtml('Phone', 'phone', phoneHref(program.phone));
    if (_canEditContent) {
      actions += '<button type="button" class="okh-btn okh-btn-ghost okh-btn-sm" data-act="program-edit" data-id="' + esc(program.id) + '">' + iconHtml('pen') + '<span>Edit</span></button>' +
        '<button type="button" class="okh-btn okh-btn-quiet okh-btn-sm" data-act="program-delete" data-id="' + esc(program.id) + '" aria-label="Delete program">' + iconHtml('trash') + '</button>';
    }
    if (actions) html += '<div class="okh-program-actions">' + actions + '</div>';

    html += '</article>';
    return html;
  }

  /* ----------------------------------------------------------------- ask */

  function chatSuggestions() {
    var suggestions = [];
    if (hasText(_content.sections.dayInTheLife)) suggestions.push(CHAT_SUGGESTIONS[0]);
    if (hasText(_content.sections.difficulties)) suggestions.push(CHAT_SUGGESTIONS[1]);
    if (_content.programs.length) suggestions.push(CHAT_SUGGESTIONS[2]);
    if (hasText(_content.sections.educationPath)) suggestions.push(CHAT_SUGGESTIONS[3]);
    if (hasText(_content.sections.salary)) suggestions.push(CHAT_SUGGESTIONS[4]);
    if (hasText(_content.sections.skills)) suggestions.push(CHAT_SUGGESTIONS[5]);
    CHAT_SUGGESTIONS.forEach(function (suggestion) {
      if (suggestions.length < 4 && suggestions.indexOf(suggestion) === -1) suggestions.push(suggestion);
    });
    return suggestions.slice(0, 4);
  }

  function askPaneHtml() {
    var html = '<section class="okh-card okh-ask-head">' +
      '<div class="okh-card-head">' +
      '<div><h2 class="okh-card-title">' + iconHtml('spark') + '<span>Ask the study coach</span></h2>' +
      '<p class="okh-card-sub">Answers use this dossier first. When something is not in the dossier, the coach says so and adds general guidance you can verify.</p></div>' +
      '</div>';

    if (!aiEnabled()) {
      html += '<div class="okh-banner okh-banner-warn" style="margin-top:10px">AI is not enabled for this tool. An administrator has to set allowAi: yes before the coach can answer.</div>';
    }

    html += '<div class="okh-suggestions">';
    chatSuggestions().forEach(function (suggestion) {
      html += '<button type="button" class="okh-suggestion" data-act="chat-suggest" data-q="' + esc(suggestion) + '">' + esc(suggestion) + '</button>';
    });
    html += '</div></section>';

    html += '<div class="okh-chat">' +
      '<div class="okh-chat-log" id="okh-chat-log"></div>' +
      '<div class="okh-chat-compose">' +
      '<textarea id="okh-chat-input" rows="3" placeholder="Ask anything about this occupation: the work, the study path, the cost, the first job.">' + esc(_chat.draft) + '</textarea>' +
      '<div class="okh-chat-actions">' +
      '<span class="okh-chat-state" id="okh-chat-state"></span>' +
      '<button type="button" class="okh-btn okh-btn-quiet okh-btn-sm" data-act="chat-clear">Clear chat</button>' +
      '<button type="button" class="okh-btn okh-btn-primary okh-btn-sm" data-act="chat-send">' + iconHtml('send') + '<span>Ask</span></button>' +
      '</div></div></div>';
    return html;
  }

  function renderChatTranscript() {
    var log = $id('okh-chat-log');
    if (!log) return;

    if (!_chat.messages.length && !_chat.busy) {
      log.innerHTML = '<div class="okh-chat-empty"><strong>No questions yet</strong>' +
        'Ask about the work, the study path, the cost or the first job. The coach answers from this dossier.</div>';
      return;
    }

    var html = '';
    _chat.messages.forEach(function (message) {
      html += chatMessageHtml(message);
    });
    if (_chat.busy) {
      html += '<div class="okh-msg okh-msg-ai">' +
        '<span class="okh-avatar">AI</span>' +
        '<div class="okh-msg-body"><div class="okh-bubble"><span class="okh-typing"><i></i><i></i><i></i></span> ' +
        '<span id="okh-typing-text">Reading the dossier...</span></div></div></div>';
    }
    log.innerHTML = html;
    log.scrollTop = log.scrollHeight;
  }

  function chatMessageHtml(message) {
    var isUser = message.role === 'user';
    var body = isUser ? '<p>' + esc(message.text) + '</p>' : richTextHtml(message.text);
    return '<div class="okh-msg ' + (isUser ? 'okh-msg-user' : 'okh-msg-ai') + '">' +
      '<span class="okh-avatar">' + (isUser ? 'You' : 'AI') + '</span>' +
      '<div class="okh-msg-body">' +
      '<div class="okh-bubble">' + body + '</div>' +
      '<div class="okh-msg-meta">' + esc(isUser ? (message.userName || 'You') : 'Study coach') +
      (message.time ? ' - ' + esc(relativeTime(message.time)) : '') + '</div>' +
      '</div></div>';
  }

  /* Safe mini formatter for AI answers: bold, dash lists, numbered lists,
     headings and paragraphs. Never trusts raw HTML. */
  function richTextHtml(text) {
    var lines = String(text || '').replace(/\r/g, '').split('\n');
    var html = '';
    var listType = '';
    var paragraphLines = [];

    function closeList() {
      if (listType) { html += '</' + listType + '>'; listType = ''; }
    }
    function flushParagraph() {
      if (!paragraphLines.length) return;
      html += '<p>' + paragraphLines.map(escapeWithBold).join(' ') + '</p>';
      paragraphLines = [];
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();

      if (!line) { flushParagraph(); closeList(); continue; }

      if (/^#{1,4}\s+/.test(line)) {
        flushParagraph(); closeList();
        html += '<h4>' + escapeWithBold(line.replace(/^#{1,4}\s+/, '')) + '</h4>';
        continue;
      }

      var bulletMatch = /^[-*\u2022]\s+(.+)$/.exec(line);
      if (bulletMatch) {
        flushParagraph();
        if (listType !== 'ul') { closeList(); html += '<ul>'; listType = 'ul'; }
        html += '<li>' + escapeWithBold(bulletMatch[1]) + '</li>';
        continue;
      }

      var numberedMatch = /^\d+[.)]\s+(.+)$/.exec(line);
      if (numberedMatch) {
        flushParagraph();
        if (listType !== 'ol') { closeList(); html += '<ol>'; listType = 'ol'; }
        html += '<li>' + escapeWithBold(numberedMatch[1]) + '</li>';
        continue;
      }

      closeList();
      paragraphLines.push(line);
    }

    flushParagraph();
    closeList();
    return html || '<p></p>';
  }

  function escapeWithBold(text) {
    return esc(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function renderChatState() {
    var stateElement = $id('okh-chat-state');
    if (!stateElement) return;
    if (_chat.busy) {
      var seconds = Math.max(1, Math.round((Date.now() - _chat.busyStartedAt) / 1000));
      stateElement.textContent = 'Thinking... ' + seconds + 's';
      stateElement.className = 'okh-chat-state is-busy';
    } else {
      stateElement.textContent = _chat.messages.length ? 'Answers are suggestions - verify deadlines and fees with the institution.' : '';
      stateElement.className = 'okh-chat-state';
    }
  }

  /* ----------------------------------------------------------- questions */

  function questionsAvailable() {
    return typeof tool.requestObjects === 'function' && hasText(_config.qaObjectType) && objectAccessParamOn();
  }

  function questionScopeKey() {
    var slug = normalizeKey(_content.occupation.slug);
    if (slug) return slug;
    var configured = normalizeKey(_config.occupationKey);
    if (configured) return configured;
    var parentId = normalizeKey(recordId());
    if (parentId) return 'record' + parentId;
    return 'default';
  }

  function normalizeAnswerRecord(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var answer = {
      id: cleanText(raw.id, 60) || genId('answer'),
      body: cleanText(raw.body || raw.text, MAX_ANSWER_LENGTH),
      answeredBy: cleanText(raw.answeredBy, 120),
      answeredByName: cleanText(raw.answeredByName, 120) || 'Student',
      answeredAt: cleanText(raw.answeredAt, 40),
      staff: !!raw.staff
    };
    if (!answer.body) return null;
    return answer;
  }

  function normalizeQuestionRecord(record) {
    if (!record || typeof record !== 'object') return null;
    var bags = collectDataBags(record);
    var question = { id: String(record.id || record._id || '') };
    if (!question.id) return null;

    QA_FIELDS.forEach(function (field) {
      if (field === 'answers') return;
      question[field] = readFieldValue(bags, field);
    });

    question.name = cleanText(record.name, MAX_QUESTION_LENGTH);
    question.title = cleanText(question.title, MAX_QUESTION_LENGTH) || question.name;
    question.body = cleanText(question.body, MAX_QUESTION_BODY);
    question.topic = cleanText(question.topic, 60);
    question.occupationKey = normalizeKey(question.occupationKey);
    question.occupationName = cleanText(question.occupationName, 160);
    question.askedBy = cleanText(question.askedBy, 120);
    question.askedByName = cleanText(question.askedByName, 120) || 'Student';
    question.askedAt = cleanText(question.askedAt, 40);
    question.updatedAt = cleanText(question.updatedAt, 40);
    question.answeredAt = cleanText(question.answeredAt, 40);
    question.answeredBy = cleanText(question.answeredBy, 120);
    question.answeredByName = cleanText(question.answeredByName, 120);

    var rawAnswers = readFieldValue(bags, 'answers');
    question.answers = asArray(rawAnswers).map(normalizeAnswerRecord).filter(Boolean);

    var status = String(question.status || '').toLowerCase();
    if (status !== 'open' && status !== 'answered' && status !== 'closed') {
      status = question.answers.length ? 'answered' : 'open';
    }
    question.status = status;
    question.dataCategory = dataCategoryOf(record, QA_FIELDS);

    var activity = question.updatedAt || question.askedAt || '';
    question.answers.forEach(function (answer) {
      if (answer.answeredAt && answer.answeredAt > activity) activity = answer.answeredAt;
    });
    question.lastActivityAt = activity || question.answeredAt || '';
    return question;
  }

  function questionMatchesScope(question) {
    var scopeKey = questionScopeKey();
    /* Privacy first: a question without a key is shown only when this instance
       has no key of its own (no slug, no configured key, no record id). */
    if (!question.occupationKey) return scopeKey === 'default';
    return question.occupationKey === scopeKey;
  }

  function questionStatusLabel(status) {
    if (status === 'answered') return 'Answered';
    if (status === 'closed') return 'Closed';
    return 'Open';
  }

  function loadQuestions(silent) {
    if (!questionsAvailable()) {
      _qaState = 'unavailable';
      if (_ui.tab === 'questions') renderQuestionsPane();
      return;
    }
    if (_qaState === 'loading') return;
    _qaState = 'loading';
    _qaError = '';
    if (!silent && _ui.tab === 'questions') renderQuestionsPane();

    tool.requestObjects('query', { mainObjectType: _config.qaObjectType }, function (err, result) {
      if (err) {
        _qaState = 'error';
        _qaError = String(err);
        console.warn('[OccupationKnowledgeHub] the question board could not be read: ' + err);
        console.warn('[OccupationKnowledgeHub] the CMS field needs allowObjectCRUD: "yes" and an allowedObjectTypes entry, e.g. { mainObjectType: "' + _config.qaObjectType + '", role: "editor", scope: "shared" }');
        if (_ui.tab === 'questions') renderQuestionsPane();
        return;
      }
      var records = (result && Array.isArray(result.objects)) ? result.objects : [];
      var list = [];
      records.forEach(function (record) {
        var question = normalizeQuestionRecord(record);
        if (!question || !questionMatchesScope(question)) return;
        list.push(question);
      });
      _questions = list;
      _qaState = 'ready';
      if (_ui.tab === 'questions') renderQuestionsPane();
      renderTabs();
    });
  }

  function findQuestion(questionId) {
    for (var i = 0; i < _questions.length; i++) {
      if (_questions[i].id === questionId) return _questions[i];
    }
    return null;
  }

  function filteredQuestions() {
    var list = _questions.slice();
    var filter = _ui.questionFilter;
    var search = String(_ui.questionSearch || '').trim().toLowerCase();

    if (filter === 'open') list = list.filter(function (question) { return question.status !== 'answered' && question.status !== 'closed'; });
    if (filter === 'answered') list = list.filter(function (question) { return question.status === 'answered'; });
    if (filter === 'mine') list = list.filter(function (question) { return question.askedBy && question.askedBy === userId(); });
    if (search) {
      list = list.filter(function (question) {
        return [question.title, question.body, question.topic, question.askedByName].join(' ').toLowerCase().indexOf(search) !== -1;
      });
    }
    list.sort(function (a, b) { return String(b.lastActivityAt || '').localeCompare(String(a.lastActivityAt || '')); });
    return list;
  }

  function questionsPaneHtml() {
    if (!questionsAvailable()) {
      return '<div class="okh-card okh-card-empty">' +
        '<h2 class="okh-card-title">Question board is not configured</h2>' +
        '<p class="okh-card-sub">The board needs a CMS object type and object access. An administrator can set this up in the html-tool field settings.</p>' +
        (_canEditContent ? '<pre class="okh-code">' + esc(setupSnippet()) + '</pre>' : '') +
        '</div>';
    }

    if (_ui.openThreadId) {
      var openQuestion = findQuestion(_ui.openThreadId);
      if (openQuestion) return threadViewHtml(openQuestion);
      _ui.openThreadId = '';
    }

    var html = '<div class="okh-card"><div class="okh-card-head">' +
      '<div><h2 class="okh-card-title"><span class="okh-dot"></span>Student questions</h2>' +
      '<p class="okh-card-sub">Ask anything. A teacher or another student answers here, and every answer stays with the dossier.</p></div>' +
      '<button type="button" class="okh-btn okh-btn-primary okh-btn-sm" data-act="question-ask">' + iconHtml('plus') + '<span>Ask a question</span></button>' +
      '</div></div>';

    if (_qaState === 'loading' && !_questions.length) {
      html += '<div class="okh-card okh-card-empty"><p class="okh-card-sub">Loading questions...</p></div>';
      return html;
    }
    if (_qaState === 'error') {
      html += '<div class="okh-card okh-card-empty">' +
        '<h2 class="okh-card-title">The question board could not be loaded</h2>' +
        '<p class="okh-card-sub">The dossier itself still works. An administrator has to check the object access settings for this tool.</p>' +
        (_canEditContent ? '<pre class="okh-code">' + esc(setupSnippet()) + '</pre>' : '') +
        '<button type="button" class="okh-btn okh-btn-ghost okh-btn-sm" style="margin-top:10px" data-act="question-reload">Try again</button>' +
        '</div>';
      return html;
    }

    html += '<div class="okh-qa-toolbar">' +
      filterChipHtml('all', 'All questions') +
      filterChipHtml('open', 'Open') +
      filterChipHtml('answered', 'Answered') +
      filterChipHtml('mine', 'Mine') +
      '<input type="text" id="okh-question-search" class="okh-filter-search" placeholder="Search questions" value="' + esc(_ui.questionSearch) + '" style="flex:1 1 160px;min-width:140px;font-family:inherit;font-size:13px;border:1px solid var(--okh-line);border-radius:999px;padding:6px 13px;background:#fff;outline:none">' +
      '</div>';

    var list = filteredQuestions();
    if (!list.length) {
      html += '<div class="okh-card okh-card-empty"><p class="okh-card-sub">' +
        (_questions.length ? 'No question matches this filter.' : 'No questions yet. Be the first to ask.') +
        '</p></div>';
      return html;
    }

    html += '<div class="okh-thread-list">';
    list.forEach(function (question) { html += threadCardHtml(question); });
    html += '</div>';
    return html;
  }

  function filterChipHtml(id, label) {
    return '<button type="button" class="okh-filter-chip' + (_ui.questionFilter === id ? ' is-on' : '') + '" data-act="question-filter" data-filter="' + esc(id) + '">' + esc(label) + '</button>';
  }

  function threadCardHtml(question) {
    var answerCount = question.answers.length;
    return '<article class="okh-thread-card" role="button" tabindex="0" data-act="question-open" data-id="' + esc(question.id) + '">' +
      '<div class="okh-thread-top">' +
      '<h3 class="okh-thread-title">' + esc(question.title) + '</h3>' +
      '<span class="okh-status-pill is-' + esc(question.status) + '">' + esc(questionStatusLabel(question.status)) + '</span>' +
      '</div>' +
      (hasText(question.body) ? '<p class="okh-thread-body">' + esc(question.body) + '</p>' : '') +
      '<div class="okh-thread-meta">' +
      '<span>' + esc(question.askedByName) + '</span>' +
      (question.askedAt ? '<span>' + esc(relativeTime(question.askedAt)) + '</span>' : '') +
      (hasText(question.topic) ? '<span>' + esc(question.topic) + '</span>' : '') +
      '<span>' + esc(String(answerCount)) + (answerCount === 1 ? ' answer' : ' answers') + '</span>' +
      '</div></article>';
  }

  function threadViewHtml(question) {
    var html = '<div class="okh-thread-view">';

    html += '<div class="okh-qa-toolbar">' +
      '<button type="button" class="okh-btn okh-btn-ghost okh-btn-sm" data-act="question-back">Back to all questions</button>' +
      '<span class="okh-status-pill is-' + esc(question.status) + '">' + esc(questionStatusLabel(question.status)) + '</span>' +
      '</div>';

    html += '<article class="okh-card okh-thread-question">' +
      '<h2 class="okh-card-title">' + esc(question.title) + '</h2>' +
      '<div class="okh-thread-meta" style="margin:6px 0 10px">' +
      '<span>Asked by ' + esc(question.askedByName) + '</span>' +
      (question.askedAt ? '<span>' + esc(formatDateTime(question.askedAt)) + '</span>' : '') +
      (hasText(question.topic) ? '<span>' + esc(question.topic) + '</span>' : '') +
      '</div>' +
      (hasText(question.body) ? '<div class="okh-prose"><p>' + esc(question.body) + '</p></div>' : '') +
      '</article>';

    html += '<div>';
    html += '<h3 class="okh-card-title" style="margin-bottom:8px">' + esc(String(question.answers.length)) + (question.answers.length === 1 ? ' answer' : ' answers') + '</h3>';
    if (!question.answers.length) {
      html += '<div class="okh-card okh-card-empty"><p class="okh-card-sub">No answer yet. A teacher or another student can answer below.</p></div>';
    } else {
      question.answers.forEach(function (answer) { html += answerHtml(question, answer); });
    }
    html += '</div>';

    html += '<section class="okh-card okh-answer-form">' +
      '<h3 class="okh-card-title" style="margin-bottom:8px">' + iconHtml('chat') + '<span>Write an answer</span></h3>' +
      '<textarea id="okh-answer-text" rows="4" placeholder="Answer clearly and practically. If you are not sure, say what the student should verify.">' + esc(_ui.answerDraft) + '</textarea>' +
      '<div class="okh-chat-actions">' +
      (_canEditContent ? '<button type="button" class="okh-btn okh-btn-ghost okh-btn-sm" data-act="answer-draft-ai">' + iconHtml('spark') + '<span>Draft with AI</span></button>' : '') +
      '<button type="button" class="okh-btn okh-btn-primary okh-btn-sm" data-act="answer-submit" data-id="' + esc(question.id) + '">' + iconHtml('send') + '<span>Post answer</span></button>' +
      '</div></section>';

    if (_canEditContent) {
      html += '<section class="okh-card"><div class="okh-card-head"><h3 class="okh-card-title">' + iconHtml('pen') + '<span>Moderation</span></h3></div>' +
        '<div class="okh-edit-grid">' +
        '<div class="okh-field"><label for="okh-question-status">Question status</label>' +
        '<select id="okh-question-status" data-question-id="' + esc(question.id) + '">' +
        '<option value="open"' + (question.status === 'open' ? ' selected' : '') + '>Open</option>' +
        '<option value="answered"' + (question.status === 'answered' ? ' selected' : '') + '>Answered</option>' +
        '<option value="closed"' + (question.status === 'closed' ? ' selected' : '') + '>Closed</option>' +
        '</select></div>' +
        '<div class="okh-field"><label>Remove</label>' +
        '<button type="button" class="okh-btn okh-btn-danger okh-btn-sm" data-act="question-delete" data-id="' + esc(question.id) + '">Delete this question</button>' +
        '<span class="okh-field-hint">Deleting removes the question and every answer from the CMS.</span></div>' +
        '</div></section>';
    }

    html += '</div>';
    return html;
  }

  function answerHtml(question, answer) {
    return '<article class="okh-answer' + (answer.staff ? ' is-staff' : '') + '">' +
      '<div class="okh-answer-head">' +
      '<span class="okh-answer-author">' + esc(answer.answeredByName) + '</span>' +
      (answer.staff ? '<span class="okh-staff-badge">Teacher</span>' : '<span class="okh-staff-badge" style="background:#f1f3f7;border-color:#e2e6ee;color:#5d6a83">Student</span>') +
      (answer.answeredAt ? '<span>' + esc(relativeTime(answer.answeredAt)) + '</span>' : '') +
      (_canEditContent ? '<button type="button" class="okh-btn okh-btn-quiet okh-btn-sm" style="margin-left:auto" data-act="answer-delete" data-id="' + esc(answer.id) + '" aria-label="Delete answer">' + iconHtml('trash') + '</button>' : '') +
      '</div>' +
      '<p class="okh-answer-body">' + esc(answer.body) + '</p>' +
      '</article>';
  }

  function questionCreatePayload(title, body, topic) {
    return {
      occupationKey: questionScopeKey(),
      occupationName: occupationTitle(),
      title: title,
      body: body,
      topic: topic,
      status: 'open',
      askedBy: userId(),
      askedByName: userName(),
      askedAt: nowIso(),
      answers: [],
      updatedAt: nowIso()
    };
  }

  function newQuestionCategory() {
    if (hasText(_config.qaDataCategory)) return _config.qaDataCategory;
    for (var i = 0; i < _questions.length; i++) {
      if (_questions[i].dataCategory) return _questions[i].dataCategory;
    }
    return '';
  }

  function updateQuestionObject(question, patch, done) {
    tool.requestObjects('update', {
      mainObjectType: _config.qaObjectType,
      objectId: question.id,
      productData: { data_categoriesBased: wrapInDataCategory(question.dataCategory || newQuestionCategory(), patch) }
    }, function (err) {
      done(err || null);
    });
  }

  function createQuestionRecord(title, body, topic, done) {
    tool.requestObjects('create', {
      mainObjectType: _config.qaObjectType,
      name: title,
      productData: { data_categoriesBased: wrapInDataCategory(newQuestionCategory(), questionCreatePayload(title, body, topic)) }
    }, function (err, result) {
      if (err) { done(String(err)); return; }
      var record = result && result.object ? result.object : null;
      if (!record) { done('The CMS did not return the created question.'); return; }
      /* Locally adopt the new record even when the host returns a partial one. */
      if (!record.id) record = {};
      var question = normalizeQuestionRecord(record);
      if (!question) {
        question = normalizeQuestionRecord({ id: record.id || genId('question'), productData: { data_categoriesBased: questionCreatePayload(title, body, topic) } });
      }
      if (question) _questions.unshift(question);
      done(null);
    });
  }

  /* ---------------------------------------------------------------- edit */

  function editPaneHtml() {
    var html = '<section class="okh-card">' +
      '<div class="okh-card-head">' +
      '<div><h2 class="okh-card-title">' + iconHtml('pen') + '<span>Edit this dossier</span></h2>' +
      '<p class="okh-card-sub">Everything changes are saved into this record as you type. Publish the dossier when students should see it.</p></div>' +
      '<span class="okh-save-state" id="okh-save-state">Saved in this record</span>' +
      '</div>' + basicsFieldsHtml() + '</section>';

    html += aiPanelHtml();

    html += '<section class="okh-card"><div class="okh-card-head">' +
      '<div><h2 class="okh-card-title">' + iconHtml('book') + '<span>Dossier sections</span></h2>' +
      '<p class="okh-card-sub">Each section is written for a student who knows nothing about the occupation yet.</p></div>' +
      '</div><div class="okh-edit-sections">';
    SECTION_DEFS.forEach(function (def) { html += sectionEditorHtml(def); });
    html += '</div></section>';

    html += programsManagerHtml();
    html += contactsManagerHtml();
    html += sourcesManagerHtml();
    html += setupCardHtml();
    return html;
  }

  function basicsFieldsHtml() {
    var html = '<div class="okh-edit-grid">';

    html += '<div class="okh-field"><label for="okh-f-title">Occupation name</label>' +
      '<input type="text" id="okh-f-title" data-field="occupation.title" maxlength="160" value="' + esc(_content.occupation.title) + '" placeholder="e.g. Registered Nurse"></div>';

    html += '<div class="okh-field"><label for="okh-f-slug">Occupation key</label>' +
      '<input type="text" id="okh-f-slug" data-field="occupation.slug" maxlength="80" value="' + esc(_content.occupation.slug) + '" placeholder="e.g. registered-nurse">' +
      '<span class="okh-field-hint">Groups the question board and the chat history. Use the same key on every instance of this occupation. Changing it later hides the questions stored under the old key.</span></div>';

    html += '<div class="okh-field"><label for="okh-f-category">Category</label>' +
      '<input type="text" id="okh-f-category" data-field="occupation.category" maxlength="120" value="' + esc(_content.occupation.category) + '" placeholder="e.g. Health care"></div>';

    html += '<div class="okh-field"><label for="okh-f-status">Status</label>' +
      '<select id="okh-f-status" data-field="occupation.status">' +
      '<option value="draft"' + (_content.occupation.status !== 'published' ? ' selected' : '') + '>Draft - only editors see it</option>' +
      '<option value="published"' + (_content.occupation.status === 'published' ? ' selected' : '') + '>Published - students can read it</option>' +
      '</select></div>';

    html += '<div class="okh-field okh-span-2"><label for="okh-f-oneliner">One-line description</label>' +
      '<input type="text" id="okh-f-oneliner" data-field="occupation.oneLiner" maxlength="400" value="' + esc(_content.occupation.oneLiner) + '" placeholder="One sentence a student can repeat at home."></div>';

    html += '<div class="okh-field okh-span-2"><label for="okh-f-summary">Overview summary</label>' +
      '<textarea id="okh-f-summary" rows="4" data-field="occupation.summary" maxlength="4000" placeholder="Short overview shown at the top of the dossier.">' + esc(_content.occupation.summary) + '</textarea></div>';

    html += '<div class="okh-field okh-span-2"><label for="okh-f-tags">Tags</label>' +
      '<input type="text" id="okh-f-tags" data-field="occupation.tags" value="' + esc(_content.occupation.tags.join(', ')) + '" placeholder="health, hospital, licensing">' +
      '<span class="okh-field-hint">Comma separated. They show as chips at the top of the dossier.</span></div>';

    html += '</div>';
    return html;
  }

  function sectionEditorHtml(def) {
    var value = _content.sections[def.key] || '';
    var count = def.type === 'text' ? wordCountOf(value) + ' words' : (hasText(value) ? 'filled' : 'empty');
    return '<details class="okh-edit-section" data-section="' + esc(def.key) + '">' +
      '<summary>' + iconHtml(def.type === 'qa' ? 'chat' : 'book') + '<span>' + esc(def.label) + '</span>' +
      '<span class="okh-edit-count" id="okh-count-' + esc(def.key) + '">' + esc(count) + '</span></summary>' +
      '<div class="okh-edit-section-body">' +
      '<div class="okh-field"><textarea rows="' + (def.type === 'text' ? 7 : 6) + '" data-field="sections.' + esc(def.key) + '" maxlength="' + MAX_SECTION_TEXT + '" placeholder="' + esc(def.hint) + '">' + esc(value) + '</textarea>' +
      '<span class="okh-field-hint">' + esc(def.hint) + '</span></div>' +
      '</div></details>';
  }

  function aiPanelHtml() {
    var html = '<section class="okh-card okh-ai-panel">' +
      '<div class="okh-card-head">' +
      '<div><h2 class="okh-card-title">' + iconHtml('spark') + '<span>Build with AI</span></h2>' +
      '<p class="okh-card-sub">Describe what to add or change. The AI drafts it first, you see exactly what changes, and nothing is saved until you apply it.</p></div>' +
      '<span class="okh-ai-hint" id="okh-ai-state">' + (_aiBusy ? 'Working...' : '') + '</span>' +
      '</div>';

    html += '<div class="okh-field"><label for="okh-ai-instruction">What should the AI do?</label>' +
      '<textarea id="okh-ai-instruction" rows="3" placeholder="Example: write the whole dossier for a student in grade 11 who has never worked in this field."></textarea></div>';

    html += '<div class="okh-ai-row">';
    AI_PRESETS.forEach(function (preset) {
      html += '<button type="button" class="okh-suggestion" data-act="ai-preset" data-preset="' + esc(preset.id) + '">' + esc(preset.label) + '</button>';
    });
    html += '</div>';

    html += '<div class="okh-field" style="margin-top:10px"><label for="okh-ai-source">Source notes (optional)</label>' +
      '<textarea id="okh-ai-source" rows="3" placeholder="Paste anything you already know: a job description, notes from an interview, a program list. The AI will structure it into the dossier."></textarea>' +
      '<span class="okh-field-hint">When you paste notes, the AI uses them as the facts and fills the rest of the dossier around them.</span></div>';

    html += '<div class="okh-ai-row">' +
      '<button type="button" class="okh-btn okh-btn-primary okh-btn-sm" data-act="ai-run"' + (_aiBusy ? ' disabled' : '') + '>' + iconHtml('spark') + '<span>' + (_aiBusy ? 'Working...' : 'Ask AI for an update') + '</span></button>' +
      '<button type="button" class="okh-btn okh-btn-ghost okh-btn-sm" data-act="export-json">Download dossier JSON</button>' +
      '<button type="button" class="okh-btn okh-btn-ghost okh-btn-sm" data-act="import-json">Import dossier JSON</button>' +
      '</div>' +
      '</section>';
    return html;
  }

  function programsManagerHtml() {
    var html = '<section class="okh-card"><div class="okh-card-head">' +
      '<div><h2 class="okh-card-title">' + iconHtml('grad') + '<span>Canadian programs</span></h2>' +
      '<p class="okh-card-sub">Universities and colleges that teach this occupation, with the faculty and how to reach them.</p></div>' +
      '<button type="button" class="okh-btn okh-btn-primary okh-btn-sm" data-act="program-add">' + iconHtml('plus') + '<span>Add program</span></button>' +
      '</div>';

    if (!_content.programs.length) {
      html += '<p class="okh-card-sub">No program added yet.</p></div>';
      return html;
    }

    html += '<div class="okh-edit-list">';
    _content.programs.forEach(function (program) {
      var sub = [program.institution, program.faculty, program.province].filter(hasText).join(' - ');
      html += '<div class="okh-edit-item">' +
        '<div class="okh-edit-item-main"><div class="okh-edit-item-title">' + esc(program.program || program.credential || 'Program') + '</div>' +
        '<div class="okh-edit-item-sub">' + esc(sub || 'No institution yet') + '</div></div>' +
        '<div class="okh-edit-item-actions">' +
        '<button type="button" class="okh-btn okh-btn-quiet okh-btn-sm" data-act="program-edit" data-id="' + esc(program.id) + '" aria-label="Edit program">' + iconHtml('pen') + '</button>' +
        '<button type="button" class="okh-btn okh-btn-quiet okh-btn-sm" data-act="program-delete" data-id="' + esc(program.id) + '" aria-label="Delete program">' + iconHtml('trash') + '</button>' +
        '</div></div>';
    });
    html += '</div></section>';
    return html;
  }

  function contactsManagerHtml() {
    var html = '<section class="okh-card"><div class="okh-card-head">' +
      '<div><h2 class="okh-card-title">' + iconHtml('mail') + '<span>How to reach them</span></h2>' +
      '<p class="okh-card-sub">Admissions offices, department contacts and official pages a student can actually use.</p></div>' +
      '<button type="button" class="okh-btn okh-btn-ghost okh-btn-sm" data-act="contact-add">' + iconHtml('plus') + '<span>Add contact</span></button>' +
      '</div>';

    if (!_content.contacts.length) {
      html += '<p class="okh-card-sub">No contact added yet.</p></div>';
      return html;
    }

    html += '<div class="okh-edit-list">';
    _content.contacts.forEach(function (contact) {
      var sub = [contact.name, contact.email, contact.phone, contact.website].filter(hasText).join(' - ');
      html += '<div class="okh-edit-item">' +
        '<div class="okh-edit-item-main"><div class="okh-edit-item-title">' + esc(contact.label || contact.name || 'Contact') + '</div>' +
        '<div class="okh-edit-item-sub">' + esc(sub) + '</div></div>' +
        '<div class="okh-edit-item-actions">' +
        '<button type="button" class="okh-btn okh-btn-quiet okh-btn-sm" data-act="contact-edit" data-id="' + esc(contact.id) + '" aria-label="Edit contact">' + iconHtml('pen') + '</button>' +
        '<button type="button" class="okh-btn okh-btn-quiet okh-btn-sm" data-act="contact-delete" data-id="' + esc(contact.id) + '" aria-label="Delete contact">' + iconHtml('trash') + '</button>' +
        '</div></div>';
    });
    html += '</div></section>';
    return html;
  }

  function sourcesManagerHtml() {
    var html = '<section class="okh-card"><div class="okh-card-head">' +
      '<div><h2 class="okh-card-title">' + iconHtml('link') + '<span>Sources</span></h2>' +
      '<p class="okh-card-sub">Where the facts came from, so a student or a teacher can check them.</p></div>' +
      '<button type="button" class="okh-btn okh-btn-ghost okh-btn-sm" data-act="source-add">' + iconHtml('plus') + '<span>Add source</span></button>' +
      '</div>';

    if (!_content.sources.length) {
      html += '<p class="okh-card-sub">No source added yet.</p></div>';
      return html;
    }

    html += '<div class="okh-edit-list">';
    _content.sources.forEach(function (source) {
      html += '<div class="okh-edit-item">' +
        '<div class="okh-edit-item-main"><div class="okh-edit-item-title">' + esc(source.title || source.url) + '</div>' +
        '<div class="okh-edit-item-sub">' + esc(source.url || source.note) + '</div></div>' +
        '<div class="okh-edit-item-actions">' +
        '<button type="button" class="okh-btn okh-btn-quiet okh-btn-sm" data-act="source-edit" data-id="' + esc(source.id) + '" aria-label="Edit source">' + iconHtml('pen') + '</button>' +
        '<button type="button" class="okh-btn okh-btn-quiet okh-btn-sm" data-act="source-delete" data-id="' + esc(source.id) + '" aria-label="Delete source">' + iconHtml('trash') + '</button>' +
        '</div></div>';
    });
    html += '</div></section>';
    return html;
  }

  function setupSnippet() {
    return 'allowObjectCRUD: yes\n\n' +
      'allowedObjectTypes:\n' +
      '[\n' +
      '  { "mainObjectType": "' + _config.qaObjectType + '", "role": "editor", "scope": "shared" },\n' +
      '  { "mainObjectType": "' + _config.chatSessionType + '", "role": "editor", "scope": "instance" }\n' +
      ']';
  }

  function setupCardHtml() {
    var html = '<section class="okh-card"><div class="okh-card-head">' +
      '<div><h2 class="okh-card-title">' + iconHtml('link') + '<span>Connection settings</span></h2>' +
      '<p class="okh-card-sub">For the system administrator. The dossier itself needs no configuration - it lives in this record.</p></div>' +
      '<button type="button" class="okh-btn okh-btn-ghost okh-btn-sm" data-act="copy-setup">Copy settings</button>' +
      '</div>' +
      '<p class="okh-card-sub">' +
      'Question board type: <strong>' + esc(_config.qaObjectType) + '</strong> - ' +
      'chat history type: <strong>' + esc(_config.chatSessionType) + '</strong> - ' +
      'occupation key: <strong>' + esc(questionScopeKey()) + '</strong></p>' +
      '<pre class="okh-code">' + esc(setupSnippet()) + '</pre></section>';
    return html;
  }

  /* ----------------------------------------------------------- modal UI */

  function openModal(title, bodyHtml, footHtml) {
    setText('okh-modal-title', title);
    var body = $id('okh-modal-body');
    if (body) body.innerHTML = bodyHtml;
    var foot = $id('okh-modal-foot');
    if (foot) foot.innerHTML = footHtml || '';
    var modal = $id('okh-modal');
    if (modal) modal.hidden = false;
    requestResize();
    setTimeout(function () {
      var first = document.querySelector('#okh-modal input, #okh-modal textarea, #okh-modal select');
      if (first && typeof first.focus === 'function') first.focus();
    }, 40);
  }

  function closeModal() {
    var modal = $id('okh-modal');
    if (modal) modal.hidden = true;
    _confirmCallback = null;
    requestResize();
  }

  function confirmDialog(title, message, confirmLabel, onConfirm) {
    _confirmCallback = onConfirm;
    openModal(title,
      '<p class="okh-modal-note">' + esc(message) + '</p>',
      '<button type="button" class="okh-btn okh-btn-ghost" data-act="modal-close">Cancel</button>' +
      '<button type="button" class="okh-btn okh-btn-danger" data-act="confirm-yes">' + esc(confirmLabel) + '</button>');
  }

  function fieldHtml(id, label, value, placeholder, maxLength, spanClass) {
    return '<div class="okh-field ' + (spanClass || '') + '">' +
      '<label for="' + id + '">' + esc(label) + '</label>' +
      '<input type="text" id="' + id + '" maxlength="' + (maxLength || 300) + '" value="' + esc(value) + '" placeholder="' + esc(placeholder || '') + '">' +
      '</div>';
  }

  function textareaFieldHtml(id, label, value, placeholder, rows, maxLength, spanClass) {
    return '<div class="okh-field ' + (spanClass || '') + '">' +
      '<label for="' + id + '">' + esc(label) + '</label>' +
      '<textarea id="' + id + '" rows="' + (rows || 3) + '" maxlength="' + (maxLength || 2000) + '" placeholder="' + esc(placeholder || '') + '">' + esc(value) + '</textarea>' +
      '</div>';
  }

  /* ------------------------------------------------------------- program */

  function findProgram(programId) {
    for (var i = 0; i < _content.programs.length; i++) {
      if (_content.programs[i].id === programId) return _content.programs[i];
    }
    return null;
  }

  function openProgramModal(program) {
    var item = program || { id: '', level: '' };
    var body = '<div class="okh-edit-grid">' +
      fieldHtml('okh-p-institution', 'Institution', item.institution, 'e.g. University of Toronto', 200) +
      fieldHtml('okh-p-faculty', 'Faculty / department', item.faculty, 'e.g. Faculty of Nursing', 200) +
      fieldHtml('okh-p-program', 'Program name', item.program, 'e.g. Bachelor of Science in Nursing', 200, 'okh-span-2') +
      '<div class="okh-field"><label for="okh-p-level">Level</label><select id="okh-p-level">' +
      '<option value="">Not set</option>' +
      STUDY_LEVELS.map(function (level) {
        return '<option value="' + esc(level.id) + '"' + (level.id === item.level ? ' selected' : '') + '>' + esc(level.label) + '</option>';
      }).join('') +
      '</select></div>' +
      fieldHtml('okh-p-credential', 'Credential awarded', item.credential, 'e.g. BScN', 200) +
      fieldHtml('okh-p-city', 'City', item.city, 'e.g. Toronto', 120) +
      '<div class="okh-field"><label for="okh-p-province">Province</label><select id="okh-p-province">' +
      '<option value="">Not set</option>' +
      CANADIAN_PROVINCES.map(function (province) {
        return '<option value="' + esc(province) + '"' + (normalizeKey(province) === normalizeKey(item.province) ? ' selected' : '') + '>' + esc(province) + '</option>';
      }).join('') +
      '</select></div>' +
      fieldHtml('okh-p-duration', 'Duration', item.duration, 'e.g. 4 years', 120) +
      fieldHtml('okh-p-tuition', 'Tuition', item.tuition, 'e.g. about CAD 9,000 per year for domestic students', 200) +
      fieldHtml('okh-p-language', 'Language', item.language, 'e.g. English', 120) +
      fieldHtml('okh-p-delivery', 'Delivery', item.delivery, 'e.g. On campus, clinical placements', 200) +
      fieldHtml('okh-p-website', 'Official website', item.website, 'https://...', 300, 'okh-span-2') +
      fieldHtml('okh-p-email', 'Admissions email', item.email, 'admissions@example.ca', 200) +
      fieldHtml('okh-p-phone', 'Phone', item.phone, 'Optional', 120) +
      textareaFieldHtml('okh-p-admission', 'Admission requirements', item.admission, 'Courses, grades, tests, experience, deadlines.', 4, 2000, 'okh-span-2') +
      textareaFieldHtml('okh-p-notes', 'Notes', item.notes, 'Anything else a student should know.', 3, 2000, 'okh-span-2') +
      '</div>';

    openModal(program ? 'Edit program' : 'Add a program', body,
      '<button type="button" class="okh-btn okh-btn-ghost" data-act="modal-close">Cancel</button>' +
      '<button type="button" class="okh-btn okh-btn-primary" data-act="program-save" data-id="' + esc(item.id || '') + '">' + iconHtml('check') + '<span>Save program</span></button>');
  }

  function readInputValue(id) {
    var element = $id(id);
    return element ? String(element.value || '').trim() : '';
  }

  function saveProgramFromModal(programId) {
    var draft = {
      id: programId,
      institution: readInputValue('okh-p-institution'),
      faculty: readInputValue('okh-p-faculty'),
      program: readInputValue('okh-p-program'),
      level: readInputValue('okh-p-level'),
      credential: readInputValue('okh-p-credential'),
      city: readInputValue('okh-p-city'),
      province: readInputValue('okh-p-province'),
      duration: readInputValue('okh-p-duration'),
      tuition: readInputValue('okh-p-tuition'),
      language: readInputValue('okh-p-language'),
      delivery: readInputValue('okh-p-delivery'),
      website: readInputValue('okh-p-website'),
      email: readInputValue('okh-p-email'),
      phone: readInputValue('okh-p-phone'),
      admission: readInputValue('okh-p-admission'),
      notes: readInputValue('okh-p-notes')
    };

    if (!draft.institution && !draft.program) {
      notify('Add at least the institution or the program name.', 'warning');
      return;
    }

    if (programId) {
      var existing = findProgram(programId);
      if (existing) {
        PROGRAM_FIELDS.forEach(function (field) { existing[field] = draft[field]; });
        existing.level = normalizeLevel(existing.level);
      }
    } else {
      var program = normalizeProgram(draft);
      if (program && _content.programs.length < MAX_PROGRAMS) _content.programs.push(program);
    }

    closeModal();
    persistNow();
    renderAll();
    notify('Program saved.', 'success');
  }

  function deleteProgram(programId) {
    var program = findProgram(programId);
    if (!program) return;
    confirmDialog('Delete program?', 'Remove "' + (program.program || program.institution || 'this program') + '" from the dossier?', 'Delete program', function () {
      _content.programs = _content.programs.filter(function (item) { return item.id !== programId; });
      persistNow();
      renderAll();
      notify('Program removed.', 'info');
    });
  }

  /* ------------------------------------------------------------- contact */

  function findContact(contactId) {
    for (var i = 0; i < _content.contacts.length; i++) {
      if (_content.contacts[i].id === contactId) return _content.contacts[i];
    }
    return null;
  }

  function openContactModal(contact) {
    var item = contact || { id: '' };
    var body = '<div class="okh-edit-grid">' +
      fieldHtml('okh-c-label', 'Label', item.label, 'e.g. Admissions office', 200, 'okh-span-2') +
      fieldHtml('okh-c-name', 'Contact person', item.name, 'Optional', 200) +
      fieldHtml('okh-c-role', 'Role', item.role, 'e.g. Student advisor', 200) +
      fieldHtml('okh-c-email', 'Email', item.email, 'admissions@example.ca', 200) +
      fieldHtml('okh-c-phone', 'Phone', item.phone, 'Optional', 120) +
      fieldHtml('okh-c-website', 'Website', item.website, 'https://...', 300, 'okh-span-2') +
      textareaFieldHtml('okh-c-note', 'Note', item.note, 'When to contact them, what to ask, opening hours.', 3, 800, 'okh-span-2') +
      '</div>';
    openModal(contact ? 'Edit contact' : 'Add a contact', body,
      '<button type="button" class="okh-btn okh-btn-ghost" data-act="modal-close">Cancel</button>' +
      '<button type="button" class="okh-btn okh-btn-primary" data-act="contact-save" data-id="' + esc(item.id || '') + '">' + iconHtml('check') + '<span>Save contact</span></button>');
  }

  function saveContactFromModal(contactId) {
    var draft = {
      id: contactId,
      label: readInputValue('okh-c-label'),
      name: readInputValue('okh-c-name'),
      role: readInputValue('okh-c-role'),
      email: readInputValue('okh-c-email'),
      phone: readInputValue('okh-c-phone'),
      website: readInputValue('okh-c-website'),
      note: readInputValue('okh-c-note')
    };
    if (!draft.label && !draft.name && !draft.email && !draft.phone) {
      notify('Add a label, a name, an email or a phone number.', 'warning');
      return;
    }
    if (contactId) {
      var existing = findContact(contactId);
      if (existing) CONTACT_FIELDS.forEach(function (field) { existing[field] = draft[field]; });
    } else {
      var contact = normalizeContactItem(draft);
      if (contact && _content.contacts.length < MAX_CONTACTS) _content.contacts.push(contact);
    }
    closeModal();
    persistNow();
    renderAll();
    notify('Contact saved.', 'success');
  }

  function deleteContact(contactId) {
    var contact = findContact(contactId);
    if (!contact) return;
    confirmDialog('Delete contact?', 'Remove "' + (contact.label || contact.name || 'this contact') + '" from the dossier?', 'Delete contact', function () {
      _content.contacts = _content.contacts.filter(function (item) { return item.id !== contactId; });
      persistNow();
      renderAll();
    });
  }

  /* -------------------------------------------------------------- source */

  function findSource(sourceId) {
    for (var i = 0; i < _content.sources.length; i++) {
      if (_content.sources[i].id === sourceId) return _content.sources[i];
    }
    return null;
  }

  function openSourceModal(source) {
    var item = source || { id: '' };
    var body = '<div class="okh-edit-grid">' +
      fieldHtml('okh-s-title', 'Title', item.title, 'e.g. Job Bank wage report', 200, 'okh-span-2') +
      fieldHtml('okh-s-url', 'Link', item.url, 'https://...', 300, 'okh-span-2') +
      textareaFieldHtml('okh-s-note', 'What it supports', item.note, 'Which facts come from this source.', 3, 600, 'okh-span-2') +
      '</div>';
    openModal(source ? 'Edit source' : 'Add a source', body,
      '<button type="button" class="okh-btn okh-btn-ghost" data-act="modal-close">Cancel</button>' +
      '<button type="button" class="okh-btn okh-btn-primary" data-act="source-save" data-id="' + esc(item.id || '') + '">' + iconHtml('check') + '<span>Save source</span></button>');
  }

  function saveSourceFromModal(sourceId) {
    var draft = {
      id: sourceId,
      title: readInputValue('okh-s-title'),
      url: readInputValue('okh-s-url'),
      note: readInputValue('okh-s-note')
    };
    if (!draft.title && !draft.url) {
      notify('Add a title or a link for the source.', 'warning');
      return;
    }
    if (sourceId) {
      var existing = findSource(sourceId);
      if (existing) SOURCE_FIELDS.forEach(function (field) { existing[field] = draft[field]; });
    } else {
      var source = normalizeSourceItem(draft);
      if (source && _content.sources.length < MAX_SOURCES) _content.sources.push(source);
    }
    closeModal();
    persistNow();
    renderAll();
  }

  function deleteSource(sourceId) {
    var source = findSource(sourceId);
    if (!source) return;
    confirmDialog('Delete source?', 'Remove "' + (source.title || source.url || 'this source') + '" from the dossier?', 'Delete source', function () {
      _content.sources = _content.sources.filter(function (item) { return item.id !== sourceId; });
      persistNow();
      renderAll();
    });
  }

  /* --------------------------------------------------------- AI: coach */

  function requestAi(prompt, done) {
    if (typeof tool.requestAI !== 'function') { done('AI is not available in this environment.'); return; }
    var finished = false;
    var watchdog = setTimeout(function () {
      if (finished) return;
      finished = true;
      done('The AI request took too long. Please try again.');
    }, 125000);

    try {
      tool.requestAI(prompt, '', function (error, response) {
        if (finished) return;
        finished = true;
        clearTimeout(watchdog);
        if (!response) { done(String(error || 'The AI service did not return an answer.')); return; }
        done(null, String(response));
      });
    } catch (err) {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      done(String(err));
    }
  }

  function dossierDigestForAi() {
    var lines = [];
    lines.push('OCCUPATION: ' + occupationTitle());
    if (hasText(_content.occupation.category)) lines.push('CATEGORY: ' + _content.occupation.category);
    if (hasText(_content.occupation.oneLiner)) lines.push('ONE LINE: ' + _content.occupation.oneLiner);
    if (hasText(_content.occupation.summary)) lines.push('OVERVIEW: ' + _content.occupation.summary);

    SECTION_DEFS.forEach(function (def) {
      var value = _content.sections[def.key];
      if (!hasText(value)) return;
      lines.push('## ' + def.label + '\n' + value);
    });

    if (_content.programs.length) {
      lines.push('## Study programs in Canada');
      _content.programs.forEach(function (program, index) {
        var parts = [
          program.institution, program.faculty, program.program, levelLabel(program.level),
          program.city, program.province, program.credential, program.duration,
          program.tuition, program.admission, program.website, program.email, program.phone
        ].filter(hasText);
        lines.push((index + 1) + '. ' + parts.join(' | '));
      });
    }

    if (_content.contacts.length) {
      lines.push('## How to reach them');
      _content.contacts.forEach(function (contact) {
        lines.push([contact.label, contact.name, contact.role, contact.email, contact.phone, contact.website].filter(hasText).join(' | '));
      });
    }

    var digest = lines.join('\n\n');
    return digest.length > MAX_AI_DIGEST ? digest.slice(0, MAX_AI_DIGEST) : digest;
  }

  function buildCoachPrompt(question) {
    return 'You are the study coach inside a private occupation dossier used by students in Canada.\n\n' +
      'Rules:\n' +
      '- Answer from the DOSSIER first. When the dossier answers part of the question, say so plainly.\n' +
      '- When the dossier does not contain the answer, answer from general knowledge and start that part with "Beyond this dossier: ".\n' +
      '- Never invent institution names, program names, tuition amounts, deadlines, emails or phone numbers. If a specific fact is missing, say which detail is missing and how the student can verify it.\n' +
      '- Use Canadian context: provinces, colleges, universities and licensing bodies.\n' +
      '- Be practical and short. One short opening paragraph, then short paragraphs or a dash list. Keep it under 220 words unless the student asks for detail.\n' +
      '- Plain text only. A dash "-" starts a bullet. No markdown headings, no tables, no emojis.\n' +
      '- Never use an em dash. Use a hyphen.\n\n' +
      'DOSSIER\n-------\n' + dossierDigestForAi() + '\n-------\n\n' +
      'STUDENT QUESTION\n' + question;
  }

  function sendChatQuestion(text) {
    var question = String(text || '').trim();
    if (!question) return;
    if (!aiEnabled()) { notify('AI is not enabled for this tool.', 'warning'); return; }
    if (_chat.busy) return;

    _chat.messages.push({ role: 'user', text: question, time: nowIso(), userId: userId(), userName: userName() });
    if (_chat.messages.length > MAX_CHAT_MESSAGES) _chat.messages = _chat.messages.slice(-MAX_CHAT_MESSAGES);
    _chat.draft = '';
    _chat.busy = true;
    _chat.busyStartedAt = Date.now();

    renderChatTranscript();
    renderChatState();
    saveChatSession();

    var input = $id('okh-chat-input');
    if (input) input.value = '';

    if (_chat.elapsedTimer) clearInterval(_chat.elapsedTimer);
    _chat.elapsedTimer = setInterval(renderChatState, 1000);
    _chat.busyTimer = setTimeout(function () {
      if (!_chat.busy) return;
      _chat.busy = false;
      _chat.busyStartedAt = 0;
      if (_chat.elapsedTimer) { clearInterval(_chat.elapsedTimer); _chat.elapsedTimer = null; }
      _chat.messages.push({ role: 'assistant', text: 'The answer took too long. Please ask again.', time: nowIso() });
      renderChatTranscript();
      renderChatState();
    }, 126000);

    requestAi(buildCoachPrompt(question), function (error, response) {
      _chat.busy = false;
      _chat.busyStartedAt = 0;
      if (_chat.busyTimer) { clearTimeout(_chat.busyTimer); _chat.busyTimer = null; }
      if (_chat.elapsedTimer) { clearInterval(_chat.elapsedTimer); _chat.elapsedTimer = null; }

      if (error) {
        _chat.messages.push({ role: 'assistant', text: 'I could not answer just now. ' + error, time: nowIso() });
        console.warn('[OccupationKnowledgeHub] coach request failed: ' + error);
      } else {
        _chat.messages.push({ role: 'assistant', text: response, time: nowIso() });
      }
      if (_chat.messages.length > MAX_CHAT_MESSAGES) _chat.messages = _chat.messages.slice(-MAX_CHAT_MESSAGES);
      renderChatTranscript();
      renderChatState();
      saveChatSession();
    });
  }

  /* AI chat history: the transcript lives in a platform chat session object
     when the tenant has object access. The chat itself never depends on it. */
  function chatStoreAvailable() {
    return typeof tool.requestObjects === 'function' && hasText(_config.chatSessionType) && objectAccessParamOn();
  }

  function loadChatHistory() {
    if (!_chat.sessionId || !chatStoreAvailable()) return;
    tool.requestObjects('get', { mainObjectType: _config.chatSessionType, objectId: _chat.sessionId }, function (err, result) {
      if (err || !result || !result.object) {
        console.warn('[OccupationKnowledgeHub] the saved chat transcript could not be read: ' + (err || 'no object'));
        return;
      }
      var messages = asArray(readFieldValue(collectDataBags(result.object), 'messages'));
      _chat.messages = messages.slice(-MAX_CHAT_MESSAGES).map(function (message) {
        return {
          role: message.role === 'user' ? 'user' : 'assistant',
          text: cleanText(message.text, 8000),
          time: cleanText(message.time, 40),
          userId: cleanText(message.userId, 120),
          userName: cleanText(message.userName, 120)
        };
      }).filter(function (message) { return message.text; });
      if (_ui.tab === 'ask') renderChatTranscript();
    });
  }

  function saveChatSession() {
    if (!chatStoreAvailable()) return;
    if (!_chat.sessionId) {
      tool.requestObjects('create', {
        mainObjectType: _config.chatSessionType,
        name: 'Occupation coach - ' + occupationTitle(),
        productData: {
          data_categoriesBased: {
            _toolInstanceId: 'occupation_' + questionScopeKey(),
            messages: _chat.messages,
            createdAt: nowIso(),
            updatedAt: nowIso()
          }
        }
      }, function (err, result) {
        if (err || !result || !result.object) {
          if (!_warnedChatStorage) {
            _warnedChatStorage = true;
            console.warn('[OccupationKnowledgeHub] the chat transcript could not be stored: ' + (err || 'no object') + '. Add ' + _config.chatSessionType + ' to allowedObjectTypes (role editor, scope instance).');
          }
          return;
        }
        _chat.sessionId = result.object.id || '';
        _content.chatSessionId = _chat.sessionId;
        persistNow();
      });
      return;
    }

    tool.requestObjects('update', {
      mainObjectType: _config.chatSessionType,
      objectId: _chat.sessionId,
      productData: { data_categoriesBased: { messages: _chat.messages, updatedAt: nowIso() } }
    }, function (err) {
      if (err && !_warnedChatStorage) {
        _warnedChatStorage = true;
        console.warn('[OccupationKnowledgeHub] the chat transcript could not be saved: ' + err);
      }
    });
  }

  function clearChat() {
    _chat.messages = [];
    _chat.sessionId = '';
    _content.chatSessionId = '';
    persistNow();
    renderChatTranscript();
    renderChatState();
  }

  /* ---------------------------------------------------- AI: dossier edit */

  /* The dossier snapshot sent to the AI must ALWAYS be valid JSON. When the
     full snapshot is too large we shrink it step by step instead of cutting
     the string, because a truncated JSON confuses the model. */
  function contentForAi() {
    function buildSnapshot(sectionLimit, includeLists) {
      var snapshot = {
        occupation: {
          title: _content.occupation.title,
          category: _content.occupation.category,
          oneLiner: _content.occupation.oneLiner,
          summary: _content.occupation.summary,
          tags: _content.occupation.tags
        },
        sections: {}
      };
      SECTION_KEYS.forEach(function (key) {
        snapshot.sections[key] = sectionLimit ? String(_content.sections[key] || '').slice(0, sectionLimit) : String(_content.sections[key] || '');
      });
      if (includeLists) {
        snapshot.programs = _content.programs;
        snapshot.contacts = _content.contacts;
        snapshot.sources = _content.sources;
      }
      return snapshot;
    }

    var attempts = [
      buildSnapshot(0, true),
      buildSnapshot(4000, true),
      buildSnapshot(1500, true),
      buildSnapshot(1500, false),
      buildSnapshot(400, false)
    ];

    for (var i = 0; i < attempts.length; i++) {
      var json = JSON.stringify(attempts[i], null, 1);
      if (json.length <= MAX_AI_JSON) return json;
    }
    return JSON.stringify({ occupation: buildSnapshot(0, false).occupation });
  }

  function sectionContractForAi() {
    return SECTION_DEFS.map(function (def) {
      var format;
      if (def.type === 'text') format = 'plain text';
      else if (def.type === 'qa') format = 'each question as "Q: question" on one line and "A: answer" on the next line';
      else format = 'one item per line in the format ' + def.columns.join(' | ');
      return '- ' + def.key + ' (' + def.label + '): ' + format;
    }).join('\n');
  }

  function buildEditorPrompt(instruction, sourceNotes) {
    var prompt = 'You are an occupation research editor building a private career dossier for students in Canada.\n' +
      'Return ONLY a valid JSON object. No markdown fences, no commentary before or after the JSON.\n\n' +
      'JSON SHAPE:\n' +
      '{\n' +
      '  "reply": "one short sentence describing what you changed",\n' +
      '  "occupation": { "title": "", "oneLiner": "", "summary": "", "category": "", "tags": [""] },\n' +
      '  "sections": { "<section key>": "text" },\n' +
      '  "programs": [ { "institution": "", "faculty": "", "program": "", "level": "", "city": "", "province": "", "credential": "", "duration": "", "tuition": "", "admission": "", "language": "", "delivery": "", "website": "", "email": "", "phone": "", "notes": "" } ],\n' +
      '  "contacts": [ { "label": "", "name": "", "role": "", "email": "", "phone": "", "website": "", "note": "" } ],\n' +
      '  "sources": [ { "title": "", "url": "", "note": "" } ]\n' +
      '}\n\n' +
      'ALLOWED SECTION KEYS AND FORMATS:\n' + sectionContractForAi() + '\n\n' +
      'RULES:\n' +
      '- Include ONLY the keys you want to change. An included text value REPLACES the old value. Omitted keys stay as they are.\n' +
      '- level must be one of: certificate, diploma, bachelor, master, doctorate, postgraduate.\n' +
      '- program names and institutions must be real. Never invent a website, email, phone number, tuition amount or deadline. Leave the field empty when you are not sure.\n' +
      '- programs are ADDED to the dossier, so only list programs that are not already there.\n' +
      '- Write for a student who knows nothing about this occupation. Be concrete, honest about difficulties, and practical.\n' +
      '- Use Canadian context and CAD amounts. Say clearly when a number is an estimate.\n' +
      '- Plain text only in every section. No HTML, no markdown, no emojis, no tables.\n' +
      '- Never use an em dash. Use a hyphen.\n\n' +
      'CURRENT DOSSIER (JSON):\n' + contentForAi() + '\n\n' +
      'INSTRUCTION:\n' + instruction;

    if (hasText(sourceNotes)) {
      prompt += '\n\nSOURCE NOTES TO STRUCTURE (use these facts first and keep them accurate):\n' + sourceNotes.slice(0, 20000);
    }
    return prompt;
  }

  function parseJsonAi(text) {
    if (!text) return null;
    var body = String(text).trim();
    var fence = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) body = fence[1].trim();
    var start = body.indexOf('{');
    var end = body.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    var candidate = body.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(candidate); } catch (err) { return null; }
  }

  function parseAiContentPlan(text) {
    var parsed = parseJsonAi(text);
    if (!parsed || typeof parsed !== 'object') return null;

    var plan = {
      reply: cleanText(parsed.reply, 400),
      occupation: null,
      sections: {},
      programs: [],
      contacts: [],
      sources: []
    };

    if (parsed.occupation && typeof parsed.occupation === 'object') {
      var occupation = {};
      if (hasText(parsed.occupation.title)) occupation.title = cleanText(parsed.occupation.title, 160);
      if (hasText(parsed.occupation.oneLiner)) occupation.oneLiner = cleanText(parsed.occupation.oneLiner, 400);
      if (hasText(parsed.occupation.summary)) occupation.summary = cleanText(parsed.occupation.summary, 4000);
      if (hasText(parsed.occupation.category)) occupation.category = cleanText(parsed.occupation.category, 120);
      if (Array.isArray(parsed.occupation.tags)) {
        occupation.tags = parsed.occupation.tags.map(function (tag) { return cleanText(tag, 40); }).filter(Boolean).slice(0, 20);
      }
      if (Object.keys(occupation).length) plan.occupation = occupation;
    }

    if (parsed.sections && typeof parsed.sections === 'object') {
      SECTION_KEYS.forEach(function (key) {
        if (hasText(parsed.sections[key])) plan.sections[key] = cleanText(parsed.sections[key], MAX_SECTION_TEXT);
      });
    }

    asArray(parsed.programs).slice(0, 40).forEach(function (raw) {
      var program = normalizeProgram(raw);
      if (program) plan.programs.push(program);
    });
    asArray(parsed.contacts).slice(0, 20).forEach(function (raw) {
      var contact = normalizeContactItem(raw);
      if (contact) plan.contacts.push(contact);
    });
    asArray(parsed.sources).slice(0, 30).forEach(function (raw) {
      var source = normalizeSourceItem(raw);
      if (source) plan.sources.push(source);
    });

    var hasChanges = plan.occupation || Object.keys(plan.sections).length || plan.programs.length || plan.contacts.length || plan.sources.length;
    return hasChanges ? plan : null;
  }

  function describeAiPlan(plan) {
    var changes = [];

    if (plan.occupation) {
      Object.keys(plan.occupation).forEach(function (key) {
        var value = plan.occupation[key];
        changes.push({
          label: OCCUPATION_FIELD_LABELS[key] || key,
          detail: Array.isArray(value) ? value.join(', ') : snippet(value, 140)
        });
      });
    }

    Object.keys(plan.sections).forEach(function (key) {
      var def = sectionDefOf(key);
      changes.push({
        label: def ? def.label : key,
        detail: wordCountOf(plan.sections[key]) + ' words - ' + snippet(plan.sections[key], 120)
      });
    });

    if (plan.programs.length) {
      changes.push({
        label: plan.programs.length + (plan.programs.length === 1 ? ' new program' : ' new programs'),
        detail: plan.programs.map(function (program) {
          return [program.institution, program.program].filter(hasText).join(' - ');
        }).join('; ')
      });
    }

    if (plan.contacts.length) {
      changes.push({
        label: plan.contacts.length + (plan.contacts.length === 1 ? ' new contact' : ' new contacts'),
        detail: plan.contacts.map(function (contact) { return contact.label || contact.name; }).filter(hasText).join('; ')
      });
    }

    if (plan.sources.length) {
      changes.push({
        label: plan.sources.length + (plan.sources.length === 1 ? ' new source' : ' new sources'),
        detail: plan.sources.map(function (source) { return source.title || source.url; }).filter(Boolean).join('; ')
      });
    }

    return changes;
  }

  function mergeProgramsIncoming(incoming) {
    var known = {};
    _content.programs.forEach(function (program) {
      known[normalizeKey(program.institution) + '|' + normalizeKey(program.program)] = true;
    });
    var added = 0;
    incoming.forEach(function (program) {
      if (_content.programs.length >= MAX_PROGRAMS) return;
      var key = normalizeKey(program.institution) + '|' + normalizeKey(program.program);
      if (known[key]) return;
      known[key] = true;
      program.id = program.id || genId('program');
      _content.programs.push(program);
      added++;
    });
    return added;
  }

  function mergeContactsIncoming(incoming) {
    var added = 0;
    incoming.forEach(function (contact) {
      if (_content.contacts.length >= MAX_CONTACTS) return;
      contact.id = contact.id || genId('contact');
      _content.contacts.push(contact);
      added++;
    });
    return added;
  }

  function mergeSourcesIncoming(incoming) {
    var added = 0;
    incoming.forEach(function (source) {
      if (_content.sources.length >= MAX_SOURCES) return;
      source.id = source.id || genId('source');
      _content.sources.push(source);
      added++;
    });
    return added;
  }

  function applyAiPlan(plan) {
    if (!plan) return;
    var summary = [];

    if (plan.occupation) {
      Object.keys(plan.occupation).forEach(function (key) {
        _content.occupation[key] = plan.occupation[key];
      });
      summary.push('occupation details');
    }

    var sectionCount = 0;
    Object.keys(plan.sections).forEach(function (key) {
      _content.sections[key] = plan.sections[key];
      sectionCount++;
    });
    if (sectionCount) summary.push(sectionCount + (sectionCount === 1 ? ' section' : ' sections'));

    var programCount = mergeProgramsIncoming(plan.programs);
    if (programCount) summary.push(programCount + (programCount === 1 ? ' program' : ' programs'));

    var contactCount = mergeContactsIncoming(plan.contacts);
    if (contactCount) summary.push(contactCount + (contactCount === 1 ? ' contact' : ' contacts'));

    var sourceCount = mergeSourcesIncoming(plan.sources);
    if (sourceCount) summary.push(sourceCount + (sourceCount === 1 ? ' source' : ' sources'));

    _content.occupation.updatedAt = nowIso();
    _content.occupation.updatedBy = userName();
    persistNow();
    renderAll();
    notify('Dossier updated: ' + (summary.join(', ') || 'no changes') + '.', 'success');
  }

  function openAiPreview(plan) {
    var changes = describeAiPlan(plan);
    var body = '';
    if (hasText(plan.reply)) body += '<p class="okh-modal-note"><strong>' + esc(plan.reply) + '</strong></p>';
    body += '<div>';
    changes.forEach(function (change) {
      body += '<div class="okh-ai-change"><strong>' + esc(change.label) + '</strong><span>' + esc(change.detail) + '</span></div>';
    });
    body += '</div>';
    body += '<p class="okh-modal-note" style="margin-top:12px">Nothing is saved yet. Apply the changes to write them into this record.</p>';

    openModal('AI update ready', body,
      '<button type="button" class="okh-btn okh-btn-ghost" data-act="ai-discard">Discard</button>' +
      '<button type="button" class="okh-btn okh-btn-primary" data-act="ai-apply">' + iconHtml('check') + '<span>Apply changes</span></button>');
  }

  function runAiContentUpdate(instruction) {
    if (_aiBusy) return;
    if (!aiEnabled()) { notify('AI is not enabled for this tool.', 'warning'); return; }

    var sourceElement = $id('okh-ai-source');
    var sourceNotes = sourceElement ? String(sourceElement.value || '') : '';
    if (!hasText(instruction) && !hasText(sourceNotes)) {
      notify('Describe what the AI should add, or paste notes to structure.', 'warning');
      return;
    }

    _aiBusy = true;
    setText('okh-ai-state', 'Working... this can take a moment.');
    var runButton = document.querySelector('[data-act="ai-run"]');
    if (runButton) runButton.disabled = true;

    requestAi(buildEditorPrompt(instruction || 'Build the dossier from the source notes.', sourceNotes), function (error, response) {
      _aiBusy = false;
      setText('okh-ai-state', '');
      var button = document.querySelector('[data-act="ai-run"]');
      if (button) button.disabled = false;

      if (error) {
        notify('The AI request failed: ' + error, 'error');
        setText('okh-ai-state', 'The last request failed. Your text is kept - try again.');
        return;
      }

      var plan = parseAiContentPlan(response);
      if (!plan) {
        notify('The AI reply did not contain usable dossier data. Try a more specific instruction.', 'warning');
        console.warn('[OccupationKnowledgeHub] unparsed AI reply:', response);
        setText('okh-ai-state', 'No usable data came back. Try a more specific instruction.');
        return;
      }

      _aiPreview = plan;
      openAiPreview(plan);
    });
  }

  /* ------------------------------------------------------------- printing */

  function printDossier() {
    /* The print sheet must obey the same publish gate as the screen. */
    if (!_canEditContent && !isPublished() && !contentIsEmpty()) {
      notify('This dossier is not published yet.', 'warning');
      return;
    }
    var host = $id('okh-print');
    if (!host) return;
    host.innerHTML = printSheetHtml();
    try {
      if (typeof window !== 'undefined' && typeof window.print === 'function') window.print();
      else notify('Printing is not available in this environment.', 'warning');
    } catch (err) {
      notify('Printing failed in this environment.', 'warning');
    }
  }

  function printSheetHtml() {
    var html = '<div class="okh-print-sheet">';
    html += '<div class="okh-print-head">';
    html += '<div class="okh-print-kicker">Occupation dossier</div>';
    html += '<h1>' + esc(occupationTitle()) + '</h1>';
    if (hasText(_content.occupation.oneLiner)) html += '<p class="okh-print-lede">' + esc(_content.occupation.oneLiner) + '</p>';
    html += '<div class="okh-print-meta">' +
      [hasText(_content.occupation.category) ? _content.occupation.category : '', _content.occupation.updatedAt ? 'Updated ' + formatDate(_content.occupation.updatedAt) : '', _content.programs.length + ' programs'].filter(hasText).join('  -  ') +
      '</div></div>';

    if (hasText(_content.occupation.summary)) {
      html += '<h2>Overview</h2><p>' + esc(_content.occupation.summary) + '</p>';
    }

    SECTION_DEFS.forEach(function (def) {
      var value = _content.sections[def.key];
      if (!hasText(value)) return;
      html += '<h2>' + esc(def.label) + '</h2>';
      if (def.type === 'lines') {
        var rows = parseRows(value, def.columns.length);
        html += '<ul>';
        rows.forEach(function (cells) {
          var parts = cells.filter(hasText);
          if (!parts.length) return;
          html += '<li>' + esc(parts[0]) + (parts.length > 1 ? ' - ' + esc(parts.slice(1).join(' - ')) : '') + '</li>';
        });
        html += '</ul>';
      } else if (def.type === 'qa') {
        parseFaq(value).forEach(function (item) {
          html += '<p><strong>' + esc(item.question) + '</strong><br>' + esc(item.answer || 'No answer yet.') + '</p>';
        });
      } else {
        html += '<p>' + esc(value) + '</p>';
      }
    });

    if (_content.programs.length) {
      html += '<h2>Study programs in Canada</h2>';
      html += '<table class="okh-print-table"><thead><tr><th>Institution</th><th>Faculty / department</th><th>Program</th><th>Level</th><th>Location</th><th>Reach</th></tr></thead><tbody>';
      _content.programs.forEach(function (program) {
        html += '<tr>' +
          '<td>' + esc(program.institution) + '</td>' +
          '<td>' + esc(program.faculty) + '</td>' +
          '<td>' + esc(program.program) + '</td>' +
          '<td>' + esc(levelLabel(program.level)) + '</td>' +
          '<td>' + esc([program.city, program.province].filter(hasText).join(', ')) + '</td>' +
          '<td>' + esc([program.website, program.email, program.phone].filter(hasText).join('  ')) + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
    }

    if (_content.contacts.length) {
      html += '<h2>How to reach them</h2><ul>';
      _content.contacts.forEach(function (contact) {
        html += '<li><strong>' + esc(contact.label || contact.name) + '</strong>' +
          (hasText(contact.name) && hasText(contact.label) ? ' - ' + esc(contact.name) : '') +
          (hasText(contact.email) ? ' - ' + esc(contact.email) : '') +
          (hasText(contact.phone) ? ' - ' + esc(contact.phone) : '') +
          (hasText(contact.website) ? ' - ' + esc(contact.website) : '') + '</li>';
      });
      html += '</ul>';
    }

    if (_content.sources.length) {
      html += '<h2>Sources</h2><ul>';
      _content.sources.forEach(function (source) {
        html += '<li>' + esc(source.title || source.url) + (hasText(source.url) && hasText(source.title) ? ' - ' + esc(source.url) : '') + '</li>';
      });
      html += '</ul>';
    }

    html += '<div class="okh-print-foot">Printed from the private occupation dossier - ' + esc(formatDateTime(nowIso())) + '.</div>';
    html += '</div>';
    return html;
  }

  /* ------------------------------------------------------ import / export */

  function downloadTextFile(filename, text, mime) {
    try {
      var blob = new Blob([text], { type: mime || 'application/json' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      setTimeout(function () {
        if (link.parentNode) link.parentNode.removeChild(link);
        URL.revokeObjectURL(url);
      }, 900);
    } catch (err) {
      notify('The download could not start in this environment.', 'warning');
    }
  }

  function exportDossier() {
    var payload = {
      schema: 'occupation-knowledge-hub',
      version: CONTENT_VERSION,
      exportedAt: nowIso(),
      occupation: _content.occupation,
      sections: _content.sections,
      programs: _content.programs,
      contacts: _content.contacts,
      sources: _content.sources
    };
    var name = (normalizeKey(_content.occupation.title) || 'occupation') + '-dossier.json';
    downloadTextFile(name, JSON.stringify(payload, null, 2));
    notify('Dossier JSON downloaded.', 'success');
  }

  function importDossierFromText(text) {
    var parsed = parseJsonAi(text);
    if (!parsed) { notify('That file is not valid JSON.', 'error'); return; }
    var incoming = parsed.content || parsed;
    var normalized = normalizeContent(incoming);
    if (contentIsEmptyFrom(normalized)) { notify('That JSON does not contain a dossier.', 'warning'); return; }
    confirmDialog('Replace this dossier?', 'The current content of this record is replaced by the file. This cannot be undone.', 'Replace dossier', function () {
      _content = normalized;
      persistNow();
      renderAll();
      notify('Dossier imported.', 'success');
    });
  }

  function contentIsEmptyFrom(content) {
    if (hasText(content.occupation.summary) || hasText(content.occupation.oneLiner) || hasText(content.occupation.title)) return false;
    if (content.programs.length || content.contacts.length) return false;
    for (var i = 0; i < SECTION_KEYS.length; i++) {
      if (hasText(content.sections[SECTION_KEYS[i]])) return false;
    }
    return true;
  }

  function copyText(text) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          notify('Copied.', 'success');
        }, function () {
          openModal('Copy this text', '<pre class="okh-code">' + esc(text) + '</pre>', '<button type="button" class="okh-btn okh-btn-primary" data-act="modal-close">Done</button>');
        });
        return;
      }
    } catch (err) { /* ignore */ }
    openModal('Copy this text', '<pre class="okh-code">' + esc(text) + '</pre>', '<button type="button" class="okh-btn okh-btn-primary" data-act="modal-close">Done</button>');
  }

  /* ---------------------------------------------------------- questions UI */

  function openQuestionModal() {
    var draft = _ui.askDraft;
    var body = '<div class="okh-edit-grid">' +
      fieldHtml('okh-q-title', 'Your question', draft.title, 'One clear sentence', MAX_QUESTION_LENGTH, 'okh-span-2') +
      fieldHtml('okh-q-topic', 'Topic (optional)', draft.topic, 'e.g. Admission requirements', 60, 'okh-span-2') +
      textareaFieldHtml('okh-q-body', 'Details', draft.body, 'What exactly do you want to know? Mention your grade, province or situation if it matters.', 5, MAX_QUESTION_BODY, 'okh-span-2') +
      '</div>' +
      '<p class="okh-modal-note" style="margin-top:10px">Your name and the date are stored with the question so a teacher can answer you.</p>';
    openModal('Ask a question', body,
      '<button type="button" class="okh-btn okh-btn-ghost" data-act="modal-close">Cancel</button>' +
      '<button type="button" class="okh-btn okh-btn-primary" data-act="question-create">' + iconHtml('send') + '<span>Post question</span></button>');
  }

  function submitQuestionFromModal() {
    var title = readInputValue('okh-q-title');
    var topic = readInputValue('okh-q-topic');
    var body = readInputValue('okh-q-body');

    if (!hasText(title)) { notify('Write your question first.', 'warning'); return; }
    if (title.length < 6) { notify('Make the question a little more specific.', 'warning'); return; }

    if (!questionsAvailable()) {
      notify('The question board is not configured for this tool.', 'warning');
      return;
    }

    createQuestionRecord(title, body, topic, function (error) {
      if (error) {
        notify('The question could not be saved: ' + error, 'error');
        console.warn('[OccupationKnowledgeHub] question create failed: ' + error);
        return;
      }
      _ui.askDraft = { title: '', topic: '', body: '' };
      closeModal();
      _ui.tab = 'questions';
      _ui.openThreadId = '';
      renderAll();
      notify('Your question is posted.', 'success');
      loadQuestions(true);
    });
  }

  function submitAnswer(questionId) {
    var question = findQuestion(questionId);
    if (!question) return;
    var textElement = $id('okh-answer-text');
    var answerText = textElement ? String(textElement.value || '').trim() : '';
    if (!hasText(answerText)) { notify('Write the answer first.', 'warning'); return; }
    if (answerText.length > MAX_ANSWER_LENGTH) { notify('The answer is too long.', 'warning'); return; }

    var answer = {
      id: genId('answer'),
      body: answerText,
      answeredBy: userId(),
      answeredByName: userName(),
      answeredAt: nowIso(),
      staff: _canEditContent
    };
    var answers = question.answers.concat([answer]);
    var patch = {
      answers: answers,
      status: question.status === 'closed' ? 'closed' : 'answered',
      answeredAt: answer.answeredAt,
      answeredBy: answer.answeredBy,
      answeredByName: answer.answeredByName,
      updatedAt: nowIso(),
      lastActivityAt: answer.answeredAt
    };

    if (typeof tool.requestObjects !== 'function') { notify('Object access is not available in this environment.', 'warning'); return; }

    updateQuestionObject(question, patch, function (error) {
      if (error) {
        notify('The answer could not be saved: ' + error, 'error');
        console.warn('[OccupationKnowledgeHub] answer update failed: ' + error);
        return;
      }
      question.answers = answers;
      question.status = patch.status;
      question.answeredAt = patch.answeredAt;
      question.answeredByName = answer.answeredByName;
      question.updatedAt = patch.updatedAt;
      question.lastActivityAt = patch.lastActivityAt;
      _ui.answerDraft = '';
      renderQuestionsPane();
      notify('Answer posted.', 'success');
    });
  }

  function deleteQuestion(questionId) {
    var question = findQuestion(questionId);
    if (!question) return;
    confirmDialog('Delete question?', 'Delete "' + question.title + '" and every answer? This cannot be undone.', 'Delete question', function () {
      tool.requestObjects('delete', { mainObjectType: _config.qaObjectType, objectId: questionId }, function (error) {
        if (error) { notify('The question could not be deleted: ' + error, 'error'); return; }
        _questions = _questions.filter(function (item) { return item.id !== questionId; });
        _ui.openThreadId = '';
        renderAll();
        notify('Question deleted.', 'info');
      });
    });
  }

  function deleteAnswerFromThread(answerId) {
    var question = findQuestion(_ui.openThreadId);
    if (!question) return;
    var answers = question.answers.filter(function (answer) { return answer.id !== answerId; });
    updateQuestionObject(question, { answers: answers, updatedAt: nowIso(), status: answers.length ? 'answered' : 'open' }, function (error) {
      if (error) { notify('The answer could not be deleted: ' + error, 'error'); return; }
      question.answers = answers;
      question.status = answers.length ? 'answered' : 'open';
      question.updatedAt = nowIso();
      renderQuestionsPane();
    });
  }

  function setQuestionStatus(questionId, status) {
    var question = findQuestion(questionId);
    if (!question) return;
    var patch = { status: status, updatedAt: nowIso() };
    if (status === 'closed') patch.closedAt = nowIso();
    updateQuestionObject(question, patch, function (error) {
      if (error) { notify('The status could not be saved: ' + error, 'error'); return; }
      question.status = status;
      question.updatedAt = patch.updatedAt;
      renderQuestionsPane();
    });
  }

  function draftAnswerWithAi() {
    var question = findQuestion(_ui.openThreadId);
    if (!question) return;
    if (!aiEnabled()) { notify('AI is not enabled for this tool.', 'warning'); return; }

    var button = document.querySelector('[data-act="answer-draft-ai"]');
    if (button) { button.disabled = true; button.textContent = 'Drafting...'; }

    var prompt = 'You are a teacher answering a student question inside a private occupation dossier.\n' +
      'Write a short, clear answer the teacher can review before posting. Use the DOSSIER first, mark anything from general knowledge with "Beyond this dossier: ", and never invent tuition, deadlines, emails or phone numbers.\n' +
      'Plain text, no markdown, no emojis, never use an em dash. Maximum 180 words.\n\n' +
      'DOSSIER\n' + dossierDigestForAi() + '\n\n' +
      'STUDENT QUESTION\n' + question.title + (hasText(question.body) ? '\n' + question.body : '');

    requestAi(prompt, function (error, response) {
      var target = document.querySelector('[data-act="answer-draft-ai"]');
      if (target) { target.disabled = false; target.innerHTML = iconHtml('spark') + '<span>Draft with AI</span>'; }
      if (error) { notify('The AI draft failed: ' + error, 'error'); return; }
      _ui.answerDraft = String(response || '').trim().slice(0, MAX_ANSWER_LENGTH);
      var textarea = $id('okh-answer-text');
      if (textarea) textarea.value = _ui.answerDraft;
      notify('AI draft inserted. Review it before posting.', 'info');
    });
  }

  /* -------------------------------------------------------------- actions */

  function handleAction(trigger) {
    var action = trigger.getAttribute('data-act');
    var id = trigger.getAttribute('data-id') || '';

    if (action === 'tab') {
      var nextTab = trigger.getAttribute('data-tab') || 'overview';
      if (nextTab === 'edit' && !_canEditContent) return;
      _ui.tab = nextTab;
      _ui.openThreadId = '';
      renderAll();
      if (_ui.tab === 'questions' && _qaState !== 'loading' && _qaState !== 'ready') loadQuestions(true);
      return;
    }

    if (action === 'go-edit') { _ui.tab = 'edit'; renderAll(); return; }
    if (action === 'print') { printDossier(); return; }
    if (action === 'open-url') { openExternal(trigger.getAttribute('data-url') || ''); return; }
    if (action === 'modal-close') { closeModal(); return; }

    if (action === 'confirm-yes') {
      var confirmAction = _confirmCallback;
      closeModal();
      if (typeof confirmAction === 'function') confirmAction();
      return;
    }

    if (action === 'edit-section') {
      _ui.tab = 'edit';
      renderAll();
      var key = trigger.getAttribute('data-key') || '';
      var section = document.querySelector('.okh-edit-section[data-section="' + key + '"]');
      if (section) {
        section.open = true;
        if (typeof section.scrollIntoView === 'function') section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var textarea = section.querySelector('textarea');
        if (textarea) textarea.focus();
      }
      return;
    }

    if (action === 'program-add') { openProgramModal(null); return; }
    if (action === 'program-edit') { var program = findProgram(id); if (program) openProgramModal(program); return; }
    if (action === 'program-delete') { deleteProgram(id); return; }
    if (action === 'program-save') { saveProgramFromModal(id); return; }

    if (action === 'contact-add') { openContactModal(null); return; }
    if (action === 'contact-edit') { var contact = findContact(id); if (contact) openContactModal(contact); return; }
    if (action === 'contact-delete') { deleteContact(id); return; }
    if (action === 'contact-save') { saveContactFromModal(id); return; }

    if (action === 'source-add') { openSourceModal(null); return; }
    if (action === 'source-edit') { var source = findSource(id); if (source) openSourceModal(source); return; }
    if (action === 'source-delete') { deleteSource(id); return; }
    if (action === 'source-save') { saveSourceFromModal(id); return; }

    if (action === 'ai-preset') {
      var presetId = trigger.getAttribute('data-preset');
      var preset = null;
      AI_PRESETS.forEach(function (item) { if (item.id === presetId) preset = item; });
      if (preset) {
        var instruction = $id('okh-ai-instruction');
        if (instruction) { instruction.value = preset.instruction; instruction.focus(); }
      }
      return;
    }
    if (action === 'ai-run') {
      var instructionElement = $id('okh-ai-instruction');
      runAiContentUpdate(instructionElement ? String(instructionElement.value || '') : '');
      return;
    }
    if (action === 'ai-apply') { var plan = _aiPreview; _aiPreview = null; closeModal(); applyAiPlan(plan); return; }
    if (action === 'ai-discard') { _aiPreview = null; closeModal(); return; }

    if (action === 'export-json') { exportDossier(); return; }
    if (action === 'import-json') {
      var input = $id('okh-import-file');
      if (input) { input.value = ''; input.click(); }
      return;
    }
    if (action === 'copy-setup') { copyText(setupSnippet()); return; }

    if (action === 'chat-suggest') { sendChatQuestion(trigger.getAttribute('data-q') || ''); return; }
    if (action === 'chat-send') {
      var chatInput = $id('okh-chat-input');
      sendChatQuestion(chatInput ? String(chatInput.value || '') : '');
      return;
    }
    if (action === 'chat-clear') {
      confirmDialog('Clear the chat?', 'This removes the visible conversation. The dossier is not affected.', 'Clear chat', function () {
        clearChat();
      });
      return;
    }

    if (action === 'question-ask') { openQuestionModal(); return; }
    if (action === 'question-create') { submitQuestionFromModal(); return; }
    if (action === 'question-reload') { loadQuestions(false); return; }
    if (action === 'question-filter') { _ui.questionFilter = trigger.getAttribute('data-filter') || 'all'; renderQuestionsPane(); return; }
    if (action === 'question-open') { _ui.openThreadId = id; _ui.answerDraft = ''; renderQuestionsPane(); return; }
    if (action === 'question-back') { _ui.openThreadId = ''; _ui.answerDraft = ''; renderQuestionsPane(); return; }
    if (action === 'question-delete') { deleteQuestion(id); return; }
    if (action === 'answer-submit') { submitAnswer(id); return; }
    if (action === 'answer-delete') { deleteAnswerFromThread(id); return; }
    if (action === 'answer-draft-ai') { draftAnswerWithAi(); return; }
  }

  function openExternal(url) {
    var href = safeUrl(url);
    if (!href) return;
    try {
      if (typeof tool.openUrl === 'function') { tool.openUrl(href); return; }
    } catch (err) { /* ignore */ }
    notify('This link cannot be opened from here: ' + href, 'warning');
  }

  /* --------------------------------------------------------------- events */

  function renderQuestionsPane() {
    if (_ui.tab !== 'questions') return;
    var host = $id('okh-main');
    if (host) host.innerHTML = questionsPaneHtml();
    renderTabs();
    requestResize();
  }

  function handleInput(event) {
    var target = event.target;
    if (!target) return;

    if (target.id === 'okh-study-search') { _ui.studySearch = target.value || ''; renderStudyListOnly(); return; }
    if (target.id === 'okh-question-search') { _ui.questionSearch = target.value || ''; renderQuestionsPane(); restoreQuestionSearchFocus(); return; }
    if (target.id === 'okh-chat-input') { _chat.draft = target.value || ''; return; }
    if (target.id === 'okh-answer-text') { _ui.answerDraft = target.value || ''; return; }
    if (target.id === 'okh-q-title') { _ui.askDraft.title = target.value || ''; return; }
    if (target.id === 'okh-q-topic') { _ui.askDraft.topic = target.value || ''; return; }
    if (target.id === 'okh-q-body') { _ui.askDraft.body = target.value || ''; return; }

    var fieldPath = target.getAttribute ? target.getAttribute('data-field') : '';
    if (!fieldPath) return;
    applyFieldEdit(fieldPath, target.value);
  }

  function handleChange(event) {
    var target = event.target;
    if (!target) return;

    if (target.id === 'okh-study-province') { _ui.studyProvince = target.value || ''; renderStudyListOnly(); return; }
    if (target.id === 'okh-study-level') { _ui.studyLevel = target.value || ''; renderStudyListOnly(); return; }
    if (target.id === 'okh-study-sort') { _ui.studySort = target.value || 'institution'; renderStudyListOnly(); return; }
    if (target.id === 'okh-question-status') { setQuestionStatus(target.getAttribute('data-question-id') || '', target.value || 'open'); return; }

    var fieldPath = target.getAttribute ? target.getAttribute('data-field') : '';
    if (!fieldPath) return;
    applyFieldEdit(fieldPath, target.value);
  }

  function applyFieldEdit(fieldPath, rawValue) {
    if (!_canEditContent) return;

    if (fieldPath === 'occupation.tags') {
      _content.occupation.tags = String(rawValue || '')
        .split(',')
        .map(function (tag) { return cleanText(tag, 40); })
        .filter(Boolean)
        .slice(0, 20);
      scheduleSave();
      renderHeader();
      return;
    }

    if (fieldPath.indexOf('sections.') === 0) {
      var key = fieldPath.slice('sections.'.length);
      if (SECTION_KEYS.indexOf(key) === -1) return;
      _content.sections[key] = String(rawValue || '').slice(0, MAX_SECTION_TEXT);
      var def = sectionDefOf(key);
      var countElement = $id('okh-count-' + key);
      if (countElement) {
        countElement.textContent = def && def.type === 'text'
          ? wordCountOf(_content.sections[key]) + ' words'
          : (hasText(_content.sections[key]) ? 'filled' : 'empty');
      }
      scheduleSave();
      return;
    }

    if (fieldPath === 'occupation.status') {
      _content.occupation.status = String(rawValue || '').toLowerCase() === 'published' ? 'published' : 'draft';
      scheduleSave();
      renderHeader();
      renderTabs();
      return;
    }

    if (fieldPath.indexOf('occupation.') === 0) {
      var field = fieldPath.slice('occupation.'.length);
      if (['title', 'slug', 'category', 'oneLiner', 'summary'].indexOf(field) === -1) return;
      _content.occupation[field] = String(rawValue || '').slice(0, field === 'summary' ? 4000 : 400);
      scheduleSave();
      if (field === 'title' || field === 'oneLiner' || field === 'category' || field === 'slug') renderHeader();
      if (field === 'slug') renderSavedState();
      return;
    }
  }

  function renderStudyListOnly() {
    if (_ui.tab !== 'study') return;
    var host = $id('okh-main');
    if (!host) return;

    /* Keep the filter inputs alive: replace only the program grid so the
       search field never loses focus while typing. */
    var grid = host.querySelector('.okh-programs');
    var list = filteredPrograms();
    if (!list.length) {
      if (grid && grid.parentNode) {
        var emptyState = document.createElement('div');
        emptyState.className = 'okh-card okh-card-empty';
        emptyState.innerHTML = '<p class="okh-card-sub">No program matches these filters.</p>';
        grid.parentNode.replaceChild(emptyState, grid);
      }
      return;
    }
    var html = '<div class="okh-programs">';
    list.forEach(function (program) { html += programCardHtml(program); });
    html += '</div>';

    if (grid) {
      var wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      grid.parentNode.replaceChild(wrapper.firstChild, grid);
    } else {
      host.innerHTML = studyPaneHtml();
    }
    requestResize();
  }

  function restoreQuestionSearchFocus() {
    var field = $id('okh-question-search');
    if (!field) return;
    field.focus();
    try { field.setSelectionRange(field.value.length, field.value.length); } catch (err) { /* ignore */ }
  }

  function wireEvents() {
    if (_wired) return;
    _wired = true;
    var root = $id('okh-root');
    if (!root) return;

    root.addEventListener('click', function (event) {
      var target = event.target;
      var trigger = (target && target.closest) ? target.closest('[data-act]') : null;
      if (trigger) { event.preventDefault(); handleAction(trigger); return; }

      var modalCard = (target && target.closest) ? target.closest('.okh-modal-card') : null;
      var modal = $id('okh-modal');
      if (modal && !modal.hidden && !modalCard) closeModal();
    });

    root.addEventListener('input', handleInput);
    root.addEventListener('change', handleChange);

    var importInput = $id('okh-import-file');
    if (importInput && typeof FileReader !== 'undefined') {
      importInput.addEventListener('change', function () {
        var file = importInput.files && importInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () { importDossierFromText(String(reader.result || '')); };
        reader.onerror = function () { notify('The file could not be read.', 'error'); };
        reader.readAsText(file);
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        var focused = event.target;
        if (focused && focused.getAttribute && focused.getAttribute('role') === 'button' && focused.getAttribute('data-act')) {
          event.preventDefault();
          handleAction(focused);
          return;
        }
      }
      if (event.key !== 'Escape') return;
      var modal = $id('okh-modal');
      if (modal && !modal.hidden) { closeModal(); return; }
      if (_ui.openThreadId) { _ui.openThreadId = ''; _ui.answerDraft = ''; renderQuestionsPane(); }
    });
  }

  /* ------------------------------------------------------------- SDK glue */

  function bindSdkListeners() {
    if (typeof tool.onValueChange === 'function') {
      tool.onValueChange(function (value) {
        var incoming = normalizeContent(value);
        var json = JSON.stringify(incoming);
        if (json === _lastStagedJson) return;   /* echo of our own save */
        _lastStagedJson = json;
        _content = incoming;
        _chat.sessionId = _content.chatSessionId || _chat.sessionId;
        renderAll();
      });
    }
    if (typeof tool.onReadonlyChange === 'function') {
      tool.onReadonlyChange(function (readOnly) {
        _readOnly = !!readOnly;
        computePermissions();
        renderAll();
      });
    }
    if (typeof tool.onUserChange === 'function') {
      tool.onUserChange(function (user) {
        _user = user || null;
        if (user) _noIdentity = false;
        computePermissions();
        renderAll();
      });
    }
  }

  function boot() {
    setText('okh-build', 'tool build ' + TOOL_BUILD);
    readConfig();
    reportMissingConfig();
    loadContent();
    _readOnly = (typeof tool.isReadOnly === 'function') ? !!tool.isReadOnly() : false;
    _chat.sessionId = _content.chatSessionId || '';

    bootIdentity();
    wireEvents();
    renderAll();
    bindSdkListeners();

    loadChatHistory();
    loadQuestions(true);

    console.log('[OccupationKnowledgeHub] build ' + TOOL_BUILD + ' ready - dossier in this record, question board over ' + _config.qaObjectType + '.');
  }

  declareToolParams();

  tool.onReady(function () {
    boot();
  });

  /* Test hooks (pure functions only - the Node smoke test uses them). */
  if (typeof window !== 'undefined') {
    window.__okhTest = {
      build: TOOL_BUILD,
      normalizeContent: normalizeContent,
      normalizeProgram: normalizeProgram,
      normalizeLevel: normalizeLevel,
      levelLabel: levelLabel,
      parseRows: parseRows,
      parseFaq: parseFaq,
      parseJsonAi: parseJsonAi,
      parseAiContentPlan: parseAiContentPlan,
      describeAiPlan: describeAiPlan,
      dossierDigestForAi: dossierDigestForAi,
      buildCoachPrompt: buildCoachPrompt,
      buildEditorPrompt: buildEditorPrompt,
      richTextHtml: richTextHtml,
      sectionDefOf: sectionDefOf,
      sectionKeys: SECTION_KEYS.slice(),
      questionScopeKey: questionScopeKey,
      contentIsEmpty: contentIsEmpty,
      normalizeQuestionRecord: normalizeQuestionRecord,
      questionMatchesScope: questionMatchesScope,
      filteredQuestions: filteredQuestions,
      applyAiPlan: applyAiPlan,
      mergeProgramsIncoming: mergeProgramsIncoming,
      questionCreatePayload: questionCreatePayload,
      createQuestionRecord: createQuestionRecord,
      updateQuestionObject: updateQuestionObject,
      loadQuestions: loadQuestions,
      exportPayload: function () {
        return {
          occupation: _content.occupation,
          sections: _content.sections,
          programs: _content.programs,
          contacts: _content.contacts,
          sources: _content.sources
        };
      },
      getContent: function () { return _content; },
      setContent: function (value) { _content = normalizeContent(value); },
      getConfig: function () { return _config; },
      getQuestions: function () { return _questions; },
      setQuestions: function (list) { _questions = list || []; },
      getChat: function () { return _chat; },
      setupSnippet: setupSnippet,
      printSheetHtml: printSheetHtml
    };
  }
})();

/* OCCUPATIONKNOWLEDGEHUB-JS-END build 2026-11-14-1 - if this line is missing in the CMS Tool Builder JS field, the JS was truncated */
