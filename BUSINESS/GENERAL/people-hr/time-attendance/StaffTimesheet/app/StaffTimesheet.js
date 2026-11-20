/* js build 2026-11-10-1 */
/* ── TimeLedger ─ Staff timesheet ──
   One instance = one worker + one timesheet period.
   Supports clock in/out, manual entries, billable and non-billable work,
   volunteer hours, overtime, rounding, approval and printable reports.
   Built for the UniconHub CMS html-tool system. */
(function () {
  "use strict";

  var TOOL_BUILD = "2026-11-10-1";
  var SCHEMA = "uniconhub-staff-timesheet";
  var DB_VERSION = 2;
  var AUDIT_LIMIT = 400;
  var ENTRY_NOTE_MAX = 2000;
  var ENTRY_TAGS_MAX = 10;
  var ENTRY_TAG_LENGTH_MAX = 30;
  var SIZE_WARN = 700000;
  var SIZE_BLOCK = 900000;

  /* ── SDK handle + fallback shim ── */
  var tool = (typeof window !== "undefined" && window.tool) ? window.tool : null;
  if (!tool) {
    var _shimValue = null;
    tool = {
      onReady: function (cb) { cb(_shimValue, {}); },
      getValue: function () { return _shimValue; },
      setValue: function (v) { _shimValue = v; },
      onValueChange: function () {},
      getFields: function () { return {}; },
      setField: function () {},
      setFields: function () {},
      watchField: function () {},
      onFieldsChange: function () {},
      param: function (name, fallback) { return fallback; },
      isReadOnly: function () { return false; },
      onReadonlyChange: function () {},
      getUser: function () { return null; },
      onUserChange: function () {},
      reportValid: function () {},
      notify: function (m) { try { console.log("notify:", m); } catch (e) {} },
      resize: function () {},
      declareOutput: function () {},
      declareParams: function () {},
      reportMissingParams: function () {},
      requestSave: function (cb) { if (cb) cb(null, true); },
      requestExportPdf: null,
      openUrl: null
    };
  }

  /* ── Tiny helpers ── */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function clamp(n, min, max) { n = Number(n); if (isNaN(n)) n = 0; return Math.max(min, Math.min(max, n)); }
  function uid() { return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clone(obj) { try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; } }
  function param(name, fallback) {
    try { return (typeof tool.param === "function") ? tool.param(name, fallback) : fallback; }
    catch (e) { return fallback; }
  }
  function resize() { try { tool.resize(); } catch (e) {} }

  function showToast(message, severity) {
    var host = $("#tms-toasts");
    if (!host) return;
    var node = document.createElement("div");
    node.className = "tms-toast" + (severity ? " is-" + severity : "");
    node.textContent = String(message || "");
    host.appendChild(node);
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 3800);
  }

  function notify(message, severity) {
    var sev = severity || "success";
    try { tool.notify(message, sev); } catch (e) {}
    showToast(message, sev);
  }

  /* ── Constants ── */
  var MODES = [
    { id: "work", label: "Work / payroll hours", hint: "Clock in and out, regular and overtime, approval." },
    { id: "billing", label: "Billable client work", hint: "Projects, billable and non-billable hours, invoice-ready reports." },
    { id: "volunteer", label: "Volunteer hours", hint: "Hours served, programs, supervisor verification and a certificate." },
    { id: "mixed", label: "Mixed (work + volunteer)", hint: "Both paid work and volunteer hours in one period." }
  ];

  var CATEGORIES = [
    { id: "work", label: "Work", chip: "is-work" },
    { id: "volunteer", label: "Volunteer", chip: "is-volunteer" },
    { id: "training", label: "Training", chip: "is-training" },
    { id: "travel", label: "Travel", chip: "is-travel" },
    { id: "admin", label: "Admin", chip: "is-admin" },
    { id: "other", label: "Other", chip: "is-other" }
  ];

  var PERIOD_TYPES = [
    { id: "weekly", label: "Weekly" },
    { id: "biweekly", label: "Bi-weekly" },
    { id: "semimonthly", label: "Semi-monthly (1-15 and 16-end)" },
    { id: "monthly", label: "Monthly" },
    { id: "custom", label: "Custom dates" }
  ];

  var ROUNDING_OPTIONS = [
    { id: "none", label: "No rounding (exact minutes)" },
    { id: "nearest5", label: "Nearest 5 minutes" },
    { id: "nearest6", label: "Nearest 6 minutes (0.1 hour)" },
    { id: "nearest15", label: "Nearest 15 minutes" },
    { id: "up5", label: "Up to 5 minutes (employee-favourable)" },
    { id: "up6", label: "Up to 6 minutes (employee-favourable)" },
    { id: "up15", label: "Up to 15 minutes (employee-favourable)" }
  ];

  var STATUSES = {
    draft: { label: "Draft", cls: "is-draft" },
    submitted: { label: "Submitted", cls: "is-submitted" },
    approved: { label: "Approved", cls: "is-approved" },
    rejected: { label: "Rejected", cls: "is-rejected" }
  };

  var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  /* ── State ── */
  var DB = null;
  var _hydrated = false;
  var _lastStagedJson = "";
  var _saveTimer = null;
  var _warnedAutosave = false;
  var _activeTab = "timesheet";
  var _reportTab = "summary";
  var _filters = { search: "", category: "all", billable: "all" };
  var _modal = null;
  var _clockTimer = null;
  var _currentStats = null;
  var currentUser = null;
  var isReadOnly = false;
  var _noIdentity = false;

  /* ── Settings defaults ── */
  function defaultSettings() {
    var today = todayISO();
    var bounds = boundsForPeriod("monthly", today, 1);
    return {
      mode: "work",
      workerName: "",
      employeeId: "",
      department: "",
      organizationName: param("organizationName", ""),
      periodType: "monthly",
      periodStart: bounds.start,
      periodEnd: bounds.end,
      weekStart: 1,
      currency: (param("currency", "CAD") || "CAD").toUpperCase().slice(0, 3),
      hourlyRate: num(param("defaultHourlyRate", 0)),
      standardDayHours: 8,
      overtimeEnabled: true,
      weeklyOvertimeAfter: 40,
      dailyOvertimeAfter: 0,
      overtimeMultiplier: 1.5,
      rounding: "none",
      breakDefaultMinutes: 30,
      breakAutoDeduct: true,
      requireProject: false,
      requireNotes: false,
      allowFutureEntries: false,
      approverName: param("approverName", ""),
      approverEmail: "",
      volunteerProgram: "",
      volunteerRole: "",
      volunteerSupervisor: "",
      volunteerGoalHours: num(param("volunteerGoalHours", 0)),
      projects: [],
      activities: defaultActivities()
    };
  }

  function defaultActivities() {
    return [
      { id: "act-general", name: "General", billableDefault: true, active: true },
      { id: "act-meetings", name: "Meetings", billableDefault: true, active: true },
      { id: "act-admin", name: "Administration", billableDefault: false, active: true },
      { id: "act-training", name: "Training", billableDefault: false, active: true },
      { id: "act-travel", name: "Travel", billableDefault: false, active: true },
      { id: "act-client", name: "Client work", billableDefault: true, active: true },
      { id: "act-other", name: "Other", billableDefault: false, active: true }
    ];
  }

  function defaultDatabase() {
    var settings = defaultSettings();
    var modeParam = String(param("defaultMode", "work") || "work");
    if (MODES.some(function (m) { return m.id === modeParam; })) settings.mode = modeParam;
    var periodParam = String(param("defaultPeriodType", "monthly") || "monthly");
    if (PERIOD_TYPES.some(function (p) { return p.id === periodParam; })) {
      settings.periodType = periodParam;
      var bounds = boundsForPeriod(periodParam, todayISO(), settings.weekStart);
      settings.periodStart = bounds.start;
      settings.periodEnd = bounds.end;
    }
    var wsParam = parseInt(param("defaultWeekStart", "1"), 10);
    if (wsParam === 0 || wsParam === 1) settings.weekStart = wsParam;
    var currencyParam = String(param("currency", "") || "").toUpperCase();
    if (currencyParam) settings.currency = currencyParam.slice(0, 3);
    return {
      version: DB_VERSION,
      settings: settings,
      entries: [],
      timesheet: emptyTimesheet(),
      audit: [],
      ui: { tab: "timesheet", reportTab: "summary", clockProjectId: "", clockActivityId: "", clockBreakMinutes: settings.breakDefaultMinutes },
      meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    };
  }

  function emptyTimesheet() {
    return {
      status: "draft",
      submittedAt: "",
      submittedBy: "",
      approvedAt: "",
      approvedBy: "",
      rejectedAt: "",
      rejectedBy: "",
      rejectionReason: "",
      reopenedAt: "",
      reopenedBy: ""
    };
  }

  /* ── Normalization ── */
  function normalizeDB(value) {
    var base = defaultDatabase();
    if (!value) return base;

    var source = value;
    if (Array.isArray(source)) source = { entries: source };
    if (typeof source !== "object") return base;

    var settings = mergeSettings(base.settings, source.settings || {});
    var db = {
      version: DB_VERSION,
      settings: settings,
      entries: [],
      timesheet: mergeTimesheet(base.timesheet, source.timesheet || {}),
      audit: [],
      ui: mergeUi(base.ui, source.ui || {}),
      meta: mergeMeta(base.meta, source.meta || {})
    };

    var rawEntries = Array.isArray(source.entries) ? source.entries : (Array.isArray(source.timeEntries) ? source.timeEntries : []);
    rawEntries.forEach(function (raw) {
      var entry = normalizeEntry(raw, settings);
      if (entry) db.entries.push(entry);
    });

    var rawAudit = Array.isArray(source.audit) ? source.audit : [];
    rawAudit.slice(0, AUDIT_LIMIT).forEach(function (item) {
      if (!item || typeof item !== "object") return;
      db.audit.push({
        at: validIsoDateTime(item.at) || new Date().toISOString(),
        by: String(item.by || "").slice(0, 120),
        action: String(item.action || "").slice(0, 80),
        detail: String(item.detail || "").slice(0, 300)
      });
    });

    var startDate = normalizeDate(db.settings.periodStart);
    var endDate = normalizeDate(db.settings.periodEnd);
    if (!startDate || !endDate) {
      var bounds = boundsForPeriod(db.settings.periodType, todayISO(), db.settings.weekStart);
      db.settings.periodStart = bounds.start;
      db.settings.periodEnd = bounds.end;
    } else {
      db.settings.periodStart = startDate;
      db.settings.periodEnd = endDate;
    }
    if (db.settings.periodStart > db.settings.periodEnd) {
      var swap = db.settings.periodStart;
      db.settings.periodStart = db.settings.periodEnd;
      db.settings.periodEnd = swap;
    }
    if (!db.entries.length) db.timesheet.status = "draft";
    if (!STATUSES[db.timesheet.status]) db.timesheet.status = "draft";
    return db;
  }

  function mergeSettings(defaults, incoming) {
    var out = clone(defaults);
    if (!incoming || typeof incoming !== "object") return out;
    Object.keys(out).forEach(function (key) {
      if (incoming[key] === undefined || incoming[key] === null) return;
      if (key === "projects") {
        out.projects = normalizeProjects(incoming.projects);
      } else if (key === "activities") {
        out.activities = normalizeActivities(incoming.activities);
      } else if (typeof out[key] === "number") {
        out[key] = num(incoming[key]);
      } else if (typeof out[key] === "boolean") {
        out[key] = !!incoming[key];
      } else {
        out[key] = String(incoming[key]);
      }
    });
    out.mode = MODES.some(function (m) { return m.id === out.mode; }) ? out.mode : "work";
    out.periodType = PERIOD_TYPES.some(function (p) { return p.id === out.periodType; }) ? out.periodType : "monthly";
    out.rounding = ROUNDING_OPTIONS.some(function (r) { return r.id === out.rounding; }) ? out.rounding : "none";
    out.weekStart = out.weekStart === 0 ? 0 : 1;
    out.currency = String(out.currency || "CAD").toUpperCase().slice(0, 3) || "CAD";
    out.weeklyOvertimeAfter = Math.max(0, out.weeklyOvertimeAfter);
    out.dailyOvertimeAfter = Math.max(0, out.dailyOvertimeAfter);
    out.overtimeMultiplier = Math.max(1, out.overtimeMultiplier);
    out.hourlyRate = Math.max(0, out.hourlyRate);
    out.breakDefaultMinutes = clamp(out.breakDefaultMinutes, 0, 600);
    out.standardDayHours = clamp(out.standardDayHours, 0, 24);
    out.volunteerGoalHours = Math.max(0, out.volunteerGoalHours);
    return out;
  }

  function mergeTimesheet(defaults, incoming) {
    var out = clone(defaults);
    if (!incoming || typeof incoming !== "object") return out;
    ["status", "submittedAt", "submittedBy", "approvedAt", "approvedBy", "rejectedAt", "rejectedBy", "rejectionReason", "reopenedAt", "reopenedBy"].forEach(function (key) {
      if (incoming[key] !== undefined && incoming[key] !== null) out[key] = String(incoming[key]);
    });
    if (!STATUSES[out.status]) out.status = "draft";
    return out;
  }

  function mergeUi(defaults, incoming) {
    var out = clone(defaults);
    if (!incoming || typeof incoming !== "object") return out;
    if (incoming.tab === "timesheet" || incoming.tab === "clock" || incoming.tab === "reports" || incoming.tab === "settings") out.tab = incoming.tab;
    if (incoming.reportTab === "summary" || incoming.reportTab === "day" || incoming.reportTab === "project" || incoming.reportTab === "week" || incoming.reportTab === "audit") out.reportTab = incoming.reportTab;
    if (incoming.clockProjectId !== undefined) out.clockProjectId = String(incoming.clockProjectId || "");
    if (incoming.clockActivityId !== undefined) out.clockActivityId = String(incoming.clockActivityId || "");
    if (incoming.clockBreakMinutes !== undefined) out.clockBreakMinutes = clamp(incoming.clockBreakMinutes, 0, 600);
    return out;
  }

  function mergeMeta(defaults, incoming) {
    var out = clone(defaults);
    if (!incoming || typeof incoming !== "object") return out;
    if (validIsoDateTime(incoming.createdAt)) out.createdAt = incoming.createdAt;
    if (validIsoDateTime(incoming.updatedAt)) out.updatedAt = incoming.updatedAt;
    return out;
  }

  function normalizeProjects(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (p) {
      if (!p || typeof p !== "object") return;
      var name = String(p.name || "").trim().slice(0, 90);
      if (!name) return;
      out.push({
        id: String(p.id || uid()),
        name: name,
        client: String(p.client || "").trim().slice(0, 90),
        code: String(p.code || "").trim().slice(0, 40),
        rate: Math.max(0, num(p.rate)),
        budgetHours: Math.max(0, num(p.budgetHours)),
        active: p.active !== false
      });
    });
    return out;
  }

  function normalizeActivities(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (a) {
      if (!a || typeof a !== "object") return;
      var name = String(a.name || "").trim().slice(0, 90);
      if (!name) return;
      out.push({
        id: String(a.id || uid()),
        name: name,
        billableDefault: a.billableDefault !== false,
        active: a.active !== false
      });
    });
    return out;
  }

  function normalizeEntry(raw, settings) {
    if (!raw || typeof raw !== "object") return null;
    var date = normalizeDate(raw.date);
    if (!date) return null;
    var start = normalizeTime(raw.start);
    var end = normalizeTime(raw.end);
    if (!start && !end) return null;
    var breakMinutes = clamp(raw.breakMinutes, 0, 600);
    var category = String(raw.category || (settings.mode === "volunteer" ? "volunteer" : "work"));
    if (!CATEGORIES.some(function (c) { return c.id === category; })) category = "work";
    var billable = raw.billable === undefined ? (category !== "volunteer" && settings.mode !== "volunteer") : !!raw.billable;
    if (category === "volunteer") billable = false;
    var tags = [];
    (Array.isArray(raw.tags) ? raw.tags : String(raw.tags || "").split(/[,;|]/)).forEach(function (t) {
      var tag = String(t || "").trim().slice(0, ENTRY_TAG_LENGTH_MAX);
      if (tag && tags.indexOf(tag) === -1) tags.push(tag);
    });
    var now = new Date().toISOString();
    return {
      id: String(raw.id || uid()),
      date: date,
      start: start || "",
      end: end || "",
      breakMinutes: breakMinutes,
      breakPaid: !!raw.breakPaid,
      projectId: String(raw.projectId || ""),
      projectName: String(raw.projectName || "").slice(0, 90),
      projectClient: String(raw.projectClient || "").slice(0, 90),
      activityId: String(raw.activityId || ""),
      activityName: String(raw.activityName || "").slice(0, 90),
      category: category,
      billable: billable,
      rate: raw.rate !== undefined && raw.rate !== null && raw.rate !== "" ? Math.max(0, num(raw.rate)) : null,
      notes: String(raw.notes || "").slice(0, ENTRY_NOTE_MAX),
      tags: tags.slice(0, ENTRY_TAGS_MAX),
      createdAt: validIsoDateTime(raw.createdAt) || now,
      updatedAt: validIsoDateTime(raw.updatedAt) || now,
      createdBy: String(raw.createdBy || "").slice(0, 120),
      updatedBy: String(raw.updatedBy || "").slice(0, 120)
    };
  }

  /* ── Date / time helpers ── */
  function num(value) {
    var n = parseFloat(value);
    return isNaN(n) ? 0 : n;
  }

  function todayISO() {
    return toISO(new Date());
  }

  function toISO(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

  function parseISODate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return null;
    var parts = String(iso).split("-").map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return isNaN(d.getTime()) ? null : d;
  }

  function normalizeDate(value) {
    if (!value) return "";
    var s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s) && parseISODate(s)) return s;
    var m = s.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})$/);
    if (m) {
      var first = parseInt(m[1], 10);
      var second = parseInt(m[2], 10);
      var year = parseInt(m[3], 10);
      var month = first > 12 ? second : first;
      var day = first > 12 ? first : second;
      var d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return toISO(d);
    }
    var parsed = new Date(s);
    return isNaN(parsed.getTime()) ? "" : toISO(parsed);
  }

  function addDays(date, count) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + count);
    return d;
  }

  function addDaysISO(iso, count) {
    var d = parseISODate(iso);
    return d ? toISO(addDays(d, count)) : iso;
  }

  function startOfWeekISO(iso, weekStart) {
    var d = parseISODate(iso);
    if (!d) return iso;
    var dow = d.getDay();
    var diff = (dow - (weekStart === 0 ? 0 : 1) + 7) % 7;
    return toISO(addDays(d, -diff));
  }

  function endOfMonthISO(iso) {
    var d = parseISODate(iso);
    if (!d) return iso;
    return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  }

  function boundsForPeriod(type, anchorISO, weekStart) {
    var anchor = parseISODate(anchorISO) || new Date();
    var iso = toISO(anchor);
    if (type === "weekly") {
      var ws = startOfWeekISO(iso, weekStart);
      return { start: ws, end: addDaysISO(ws, 6) };
    }
    if (type === "biweekly") {
      var bs = startOfWeekISO(iso, weekStart);
      return { start: bs, end: addDaysISO(bs, 13) };
    }
    if (type === "semimonthly") {
      if (anchor.getDate() <= 15) {
        return { start: toISO(new Date(anchor.getFullYear(), anchor.getMonth(), 1)), end: toISO(new Date(anchor.getFullYear(), anchor.getMonth(), 15)) };
      }
      return { start: toISO(new Date(anchor.getFullYear(), anchor.getMonth(), 16)), end: toISO(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)) };
    }
    if (type === "custom") {
      return { start: iso, end: iso };
    }
    return { start: toISO(new Date(anchor.getFullYear(), anchor.getMonth(), 1)), end: endOfMonthISO(iso) };
  }

  function validIsoDateTime(value) {
    if (!value) return "";
    var d = new Date(value);
    return isNaN(d.getTime()) ? "" : d.toISOString();
  }

  function normalizeTime(value) {
    if (value === undefined || value === null) return "";
    var s = String(value).trim();
    if (!s) return "";
    var m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      var h = parseInt(m[1], 10);
      var min = parseInt(m[2], 10);
      if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return pad2(h) + ":" + pad2(min);
    }
    var ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i);
    if (ampm) {
      var hh = parseInt(ampm[1], 10);
      var mm = parseInt(ampm[2] || "0", 10);
      var pm = ampm[3].toLowerCase() === "p";
      if (hh >= 1 && hh <= 12 && mm >= 0 && mm <= 59) {
        if (pm && hh !== 12) hh += 12;
        if (!pm && hh === 12) hh = 0;
        return pad2(hh) + ":" + pad2(mm);
      }
    }
    var compact = s.match(/^(\d{3,4})$/);
    if (compact) {
      var raw = compact[1].padStart(4, "0");
      var ch = parseInt(raw.slice(0, 2), 10);
      var cm = parseInt(raw.slice(2), 10);
      if (ch >= 0 && ch <= 23 && cm >= 0 && cm <= 59) return pad2(ch) + ":" + pad2(cm);
    }
    return "";
  }

  function timeToMinutes(value) {
    var normalized = normalizeTime(value);
    if (!normalized) return null;
    var parts = normalized.split(":").map(Number);
    return parts[0] * 60 + parts[1];
  }

  function minutesToTime(minutes) {
    var m = ((Math.round(minutes) % 1440) + 1440) % 1440;
    return pad2(Math.floor(m / 60)) + ":" + pad2(m % 60);
  }

  function fmtTime12(value) {
    var m = timeToMinutes(value);
    if (m === null) return "";
    var h = Math.floor(m / 60);
    var min = m % 60;
    var ap = h >= 12 ? "PM" : "AM";
    var h12 = h % 12 || 12;
    return h12 + ":" + pad2(min) + " " + ap;
  }

  function formatDateLong(iso) {
    var d = parseISODate(iso);
    if (!d) return "";
    return DAY_NAMES[d.getDay()] + ", " + d.getDate() + " " + monthName(d.getMonth()) + " " + d.getFullYear();
  }

  function formatDateShort(iso) {
    var d = parseISODate(iso);
    if (!d) return "";
    return d.getDate() + " " + monthShort(d.getMonth()) + " " + d.getFullYear();
  }

  function formatDateCompact(iso) {
    var d = parseISODate(iso);
    if (!d) return "";
    return d.getDate() + " " + monthShort(d.getMonth());
  }

  function formatDateTime(value) {
    var d = new Date(value);
    if (isNaN(d.getTime())) return "";
    return d.getDate() + " " + monthShort(d.getMonth()) + " " + d.getFullYear() + ", " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  function monthName(index) {
    return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][index] || "";
  }

  function monthShort(index) {
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][index] || "";
  }

  function periodTypeLabel(id) {
    var found = PERIOD_TYPES.filter(function (p) { return p.id === id; })[0];
    return found ? found.label.replace(" (1-15 and 16-end)", "") : "Monthly";
  }

  function formatDuration(totalMinutes) {
    var m = Math.round(Math.abs(totalMinutes || 0));
    var h = Math.floor(m / 60);
    var min = m % 60;
    if (h && min) return h + "h " + pad2(min) + "m";
    if (h) return h + "h";
    return min + "m";
  }

  function formatDurationLong(totalMinutes) {
    var m = Math.round(Math.abs(totalMinutes || 0));
    var h = Math.floor(m / 60);
    var min = m % 60;
    if (h && min) return h + " hours " + min + " minutes";
    if (h) return h + (h === 1 ? " hour" : " hours");
    return min + (min === 1 ? " minute" : " minutes");
  }

  function formatHours(minutes) {
    return (Math.round((minutes || 0) / 6) / 10).toFixed(1);
  }

  function formatMoney(value) {
    var amount = num(value);
    var currency = (DB && DB.settings && DB.settings.currency) ? DB.settings.currency : "CAD";
    currency = String(currency).toUpperCase().slice(0, 3);
    if (currency.length !== 3) currency = "CAD";
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: currency, maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(amount);
    } catch (e) {
      return currency + " " + amount.toFixed(2);
    }
  }

  function formatPercent(value) {
    var n = num(value);
    if (n > 0 && n < 1) return n.toFixed(1) + "%";
    return Math.round(n) + "%";
  }

  /* ── Lookups ── */
  function projectById(id) {
    if (!id) return null;
    for (var i = 0; i < DB.settings.projects.length; i++) if (DB.settings.projects[i].id === id) return DB.settings.projects[i];
    return null;
  }

  function activityById(id) {
    if (!id) return null;
    for (var i = 0; i < DB.settings.activities.length; i++) if (DB.settings.activities[i].id === id) return DB.settings.activities[i];
    return null;
  }

  function projectName(id) {
    var p = projectById(id);
    return p ? p.name : "";
  }

  function activityName(id) {
    var a = activityById(id);
    return a ? a.name : "";
  }

  function entryProjectLabel(entry) {
    var project = projectById(entry.projectId);
    if (project) return project.name;
    if (entry.projectName) return entry.projectName;
    return entry.projectId ? "Deleted project" : "No project";
  }

  function entryProjectClientLabel(entry) {
    var project = projectById(entry.projectId);
    if (project) return project.client || "";
    return entry.projectClient || "";
  }

  function entryActivityLabel(entry) {
    var activity = activityById(entry.activityId);
    if (activity) return activity.name;
    return entry.activityName || "";
  }

  function findEntry(id) {
    for (var i = 0; i < DB.entries.length; i++) if (DB.entries[i].id === id) return DB.entries[i];
    return null;
  }

  function findOrCreateProject(name) {
    var clean = String(name || "").trim();
    if (!clean) return "";
    for (var i = 0; i < DB.settings.projects.length; i++) {
      if (DB.settings.projects[i].name.toLowerCase() === clean.toLowerCase()) return DB.settings.projects[i].id;
    }
    var project = { id: uid(), name: clean.slice(0, 90), client: "", code: "", rate: 0, budgetHours: 0, active: true };
    DB.settings.projects.push(project);
    return project.id;
  }

  function findOrCreateActivity(name) {
    var clean = String(name || "").trim();
    if (!clean) return "";
    for (var i = 0; i < DB.settings.activities.length; i++) {
      if (DB.settings.activities[i].name.toLowerCase() === clean.toLowerCase()) return DB.settings.activities[i].id;
    }
    var activity = { id: uid(), name: clean.slice(0, 90), billableDefault: true, active: true };
    DB.settings.activities.push(activity);
    return activity.id;
  }

  /* ── Entry math ── */
  function entryDurationMinutes(entry) {
    var start = timeToMinutes(entry.start);
    var end = timeToMinutes(entry.end);
    if (start === null || end === null) return 0;
    var duration = end - start;
    if (duration < 0) duration += 1440;
    return duration;
  }

  function entryUnpaidBreak(entry) {
    var duration = entryDurationMinutes(entry);
    var breakMinutes = clamp(entry.breakMinutes, 0, 600);
    if (entry.breakPaid) return 0;
    return clamp(breakMinutes, 0, Math.max(0, duration - 1));
  }

  function entryRawMinutes(entry) {
    return Math.max(0, entryDurationMinutes(entry) - entryUnpaidBreak(entry));
  }

  function roundingStep() {
    var rounding = DB && DB.settings ? DB.settings.rounding : "none";
    if (rounding === "nearest5" || rounding === "up5") return 5;
    if (rounding === "nearest6" || rounding === "up6") return 6;
    if (rounding === "nearest15" || rounding === "up15") return 15;
    return 0;
  }

  function roundingIsUp() {
    var rounding = DB && DB.settings ? DB.settings.rounding : "none";
    return rounding.indexOf("up") === 0;
  }

  function entryRoundedMinutes(entry) {
    var start = timeToMinutes(entry.start);
    var end = timeToMinutes(entry.end);
    if (start === null || end === null) return 0;
    var duration = end - start;
    if (duration < 0) duration += 1440;
    var absoluteStart = start;
    var absoluteEnd = start + duration;
    var step = roundingStep();
    if (step > 0) {
      if (roundingIsUp()) {
        absoluteStart = Math.floor(absoluteStart / step) * step;
        absoluteEnd = Math.ceil(absoluteEnd / step) * step;
      } else {
        absoluteStart = Math.round(absoluteStart / step) * step;
        absoluteEnd = Math.round(absoluteEnd / step) * step;
      }
      if (absoluteEnd < absoluteStart) absoluteEnd = absoluteStart;
      duration = absoluteEnd - absoluteStart;
    }
    return Math.max(0, duration - entryUnpaidBreak(entry));
  }

  function entryHours(entry) {
    return entryRoundedMinutes(entry) / 60;
  }

  function entryRawHours(entry) {
    return entryRawMinutes(entry) / 60;
  }

  function isVolunteerEntry(entry) {
    return !!(entry && entry.category === "volunteer");
  }

  function isPayEligible(entry) {
    return !isVolunteerEntry(entry);
  }

  function entryRate(entry) {
    if (entry.rate !== null && entry.rate !== undefined && entry.rate > 0) return entry.rate;
    var project = projectById(entry.projectId);
    if (project && project.rate > 0) return project.rate;
    return DB.settings.hourlyRate || 0;
  }

  function entryAmount(entry) {
    if (!entry || DB.settings.mode === "volunteer" || isVolunteerEntry(entry)) return 0;
    var rate = entryRate(entry);
    if (!rate) return 0;
    var hours = entryHours(entry);
    if (DB.settings.mode === "work") return hours * rate;
    if (DB.settings.mode === "billing" || DB.settings.mode === "mixed") return entry.billable ? hours * rate : 0;
    return 0;
  }

  function weekKeyOf(dateISO) {
    return startOfWeekISO(dateISO, DB.settings.weekStart);
  }

  function isDateInPeriod(dateISO) {
    return !!dateISO && dateISO >= DB.settings.periodStart && dateISO <= DB.settings.periodEnd;
  }

  function periodEntries() {
    return DB.entries.filter(function (entry) { return isDateInPeriod(entry.date); }).sort(compareEntries);
  }

  function outOfPeriodEntries() {
    return DB.entries.filter(function (entry) { return !isDateInPeriod(entry.date); });
  }

  function compareEntries(a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    var as = timeToMinutes(a.start);
    var bs = timeToMinutes(b.start);
    if (as === null && bs === null) return 0;
    if (as === null) return 1;
    if (bs === null) return -1;
    return as - bs;
  }

  function openEntry() {
    var open = DB.entries.filter(function (entry) { return !entry.end; });
    if (!open.length) return null;
    return open.sort(compareEntries)[open.length - 1];
  }

  function todayEntries() {
    return DB.entries.filter(function (entry) { return entry.date === todayISO(); }).sort(compareEntries);
  }

  /* ── Period state ── */
  function currentStatus() { return DB.timesheet.status; }
  function statusMeta() { return STATUSES[currentStatus()] || STATUSES.draft; }
  function periodIsSubmitted() { return currentStatus() === "submitted"; }
  function periodIsApproved() { return currentStatus() === "approved"; }
  function periodIsRejected() { return currentStatus() === "rejected"; }
  function periodIsEditableByWorker() { return currentStatus() === "draft" || currentStatus() === "rejected"; }
  function canEditEntries() { return canWrite() && (periodIsEditableByWorker() || canManage()); }
  function canSubmitPeriod() {
    var entries = periodEntries();
    return canWrite() && periodIsEditableByWorker() && entries.length > 0 && !entries.some(function (e) { return !e.end; });
  }

  /* ── Identity / permissions ── */
  function hasUserApi() { return typeof tool.getUser === "function"; }
  function getUserSafe() { try { return hasUserApi() ? tool.getUser() : null; } catch (e) { return null; } }

  function roles() {
    if (currentUser && currentUser.roles && currentUser.roles.length) return currentUser.roles;
    var access = (currentUser && currentUser.effectiveAccess) || {};
    var out = [];
    if (access.isManager) out.push("admin");
    if (access.isEditor) out.push("editor");
    if (access.isViewer) out.push("viewer");
    if (out.length) return out;
    return (currentUser && currentUser.roles) ? currentUser.roles : [];
  }

  function isAdmin() {
    if (_noIdentity) return !isReadOnly;
    var r = roles();
    return r.indexOf("admin") > -1 || r.indexOf("owner") > -1 || r.indexOf("developer") > -1 || r.indexOf("user-manager") > -1;
  }

  function canWrite() {
    return !isReadOnly && (_noIdentity || isAdmin() || roles().indexOf("editor") > -1);
  }

  function canManage() {
    return !isReadOnly && (_noIdentity || isAdmin());
  }

  function userName() {
    if (currentUser) return currentUser.name || currentUser.email || DB.settings.workerName || "User";
    return DB.settings.workerName || "User";
  }

  function renderUserChip() {
    var host = $("#tms-user-chip");
    if (!host) return;
    var label = currentUser ? (currentUser.name || currentUser.email || "User") : (_noIdentity ? "CMS session" : "Not signed in");
    var roleLabel = canManage() ? "Manager" : (canWrite() ? "Editor" : "Viewer");
    var lock = isReadOnly ? " · read-only" : "";
    host.innerHTML = "<b>" + esc(label) + "</b><br>" + roleLabel + lock;
  }

  function startUserPolling() {
    if (!hasUserApi()) { _noIdentity = true; renderUserChip(); return; }
    var immediate = getUserSafe();
    if (immediate) { currentUser = immediate; _noIdentity = false; renderUserChip(); return; }
    var delays = [400, 1200, 2600, 5000];
    var attempt = 0;
    function step() {
      var user = getUserSafe();
      if (user) { currentUser = user; _noIdentity = false; renderUserChip(); renderAll(); return; }
      attempt += 1;
      if (attempt < delays.length) setTimeout(step, delays[attempt]);
      else { _noIdentity = true; renderUserChip(); renderAll(); }
    }
    setTimeout(step, delays[0]);
  }

  /* ── Persistence ── */
  function estimateBytes() {
    var json = JSON.stringify(DB);
    try { return new Blob([json]).size; } catch (e) { return json.length; }
  }

  function warnAutosaveOnce() {
    if (_warnedAutosave) return;
    _warnedAutosave = true;
    notify("Changes are staged. Enable allowRequestSave on this field to save without the parent Save button.", "warning");
  }

  function persistNow() {
    if (!DB) return;
    DB.meta.updatedAt = new Date().toISOString();
    var json = JSON.stringify(DB);
    _lastStagedJson = json;
    try { tool.setValue(JSON.parse(json)); } catch (e) {}
    try {
      if (typeof tool.requestSave === "function") {
        tool.requestSave(function (err, ok) {
          if (err || !ok) warnAutosaveOnce();
        });
      }
    } catch (e) {
      warnAutosaveOnce();
    }
    resize();
  }

  function persistSoon() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(persistNow, 400);
  }

  function addAudit(action, detail) {
    DB.audit.unshift({
      at: new Date().toISOString(),
      by: userName(),
      action: String(action || "").slice(0, 80),
      detail: String(detail || "").slice(0, 300)
    });
    if (DB.audit.length > AUDIT_LIMIT) DB.audit.length = AUDIT_LIMIT;
  }

  /* ── Stats ── */
  function computeStats(entries) {
    var list = (entries || periodEntries()).slice();
    var totalMinutes = 0;
    var rawMinutes = 0;
    var breakMinutes = 0;
    var billableMinutes = 0;
    var nonBillableMinutes = 0;
    var volunteerMinutes = 0;
    var dayMinutes = {};
    var entryOT = {};

    list.forEach(function (entry) {
      var minutes = entryRoundedMinutes(entry);
      totalMinutes += minutes;
      rawMinutes += entryRawMinutes(entry);
      breakMinutes += entryUnpaidBreak(entry);
      if (isVolunteerEntry(entry)) volunteerMinutes += minutes;
      else if (entry.billable) billableMinutes += minutes;
      else nonBillableMinutes += minutes;
      dayMinutes[entry.date] = (dayMinutes[entry.date] || 0) + minutes;
    });

    var weeks = {};
    list.forEach(function (entry) {
      if (!isPayEligible(entry)) return;
      var key = weekKeyOf(entry.date);
      if (!weeks[key]) weeks[key] = { key: key, total: 0, daily: {}, entries: [] };
      var minutes = entryRoundedMinutes(entry);
      weeks[key].total += minutes;
      weeks[key].daily[entry.date] = (weeks[key].daily[entry.date] || 0) + minutes;
      weeks[key].entries.push(entry);
    });

    var dailyThreshold = DB.settings.dailyOvertimeAfter > 0 ? DB.settings.dailyOvertimeAfter * 60 : 0;
    var weeklyThreshold = DB.settings.weeklyOvertimeAfter > 0 ? DB.settings.weeklyOvertimeAfter * 60 : 0;
    var regularMinutes = 0;
    var overtimeMinutes = 0;

    Object.keys(weeks).forEach(function (key) {
      var week = weeks[key];
      var dailyOT = 0;
      if (dailyThreshold > 0) {
        Object.keys(week.daily).forEach(function (day) {
          dailyOT += Math.max(0, week.daily[day] - dailyThreshold);
        });
      }
      var remaining = week.total - dailyOT;
      var weeklyOT = weeklyThreshold > 0 ? Math.max(0, remaining - weeklyThreshold) : 0;
      week.overtime = DB.settings.overtimeEnabled ? dailyOT + weeklyOT : 0;
      week.regular = week.total - week.overtime;
      regularMinutes += week.regular;
      overtimeMinutes += week.overtime;
      allocateOvertime(week, entryOT);
    });

    var billableAmount = 0;
    list.forEach(function (entry) { billableAmount += entryAmount(entry); });

    var baseRate = DB.settings.hourlyRate || 0;
    var payAmount = 0;
    if (DB.settings.mode !== "volunteer" && baseRate > 0) {
      payAmount = (regularMinutes / 60) * baseRate + (overtimeMinutes / 60) * baseRate * DB.settings.overtimeMultiplier;
    }

    var projects = {};
    list.forEach(function (entry) {
      var project = projectById(entry.projectId);
      var projectKey = project ? project.id : (entry.projectName ? "name:" + entry.projectName : "none");
      if (!projects[projectKey]) {
        projects[projectKey] = {
          id: projectKey,
          name: project ? project.name : (entry.projectName || "No project"),
          client: project ? project.client : (entry.projectClient || ""),
          rate: project ? project.rate : (entry.rate || DB.settings.hourlyRate || 0),
          budgetHours: project ? project.budgetHours : 0,
          minutes: 0,
          billableMinutes: 0,
          amount: 0,
          entries: 0
        };
      }
      var key = projectKey;
      projects[key].minutes += entryRoundedMinutes(entry);
      projects[key].entries += 1;
      if (!isVolunteerEntry(entry) && entry.billable) projects[key].billableMinutes += entryRoundedMinutes(entry);
      projects[key].amount += entryAmount(entry);
    });

    var categories = {};
    list.forEach(function (entry) {
      var key = entry.category || "work";
      if (!categories[key]) categories[key] = { id: key, minutes: 0, entries: 0 };
      categories[key].minutes += entryRoundedMinutes(entry);
      categories[key].entries += 1;
    });

    var daysWorked = Object.keys(dayMinutes).length;
    var goalHours = DB.settings.volunteerGoalHours || 0;
    var goalPercent = goalHours > 0 ? (volunteerMinutes / 60) / goalHours * 100 : 0;

    return {
      entries: list.length,
      totalMinutes: totalMinutes,
      rawMinutes: rawMinutes,
      breakMinutes: breakMinutes,
      regularMinutes: regularMinutes,
      overtimeMinutes: overtimeMinutes,
      billableMinutes: billableMinutes,
      nonBillableMinutes: nonBillableMinutes,
      volunteerMinutes: volunteerMinutes,
      daysWorked: daysWorked,
      dayMinutes: dayMinutes,
      weeks: weeks,
      entryOT: entryOT,
      billableAmount: billableAmount,
      payAmount: payAmount,
      projects: projects,
      categories: categories,
      goalHours: goalHours,
      goalPercent: goalPercent,
      openEntries: list.filter(function (entry) { return !entry.end; }).length
    };
  }

  function allocateOvertime(week, entryOT) {
    if (!week.overtime || !week.entries.length || !week.total) return;
    var remaining = week.overtime;
    week.entries.forEach(function (entry, index) {
      var share = index === week.entries.length - 1
        ? remaining
        : Math.round(week.overtime * (entryRoundedMinutes(entry) / week.total));
      entryOT[entry.id] = (entryOT[entry.id] || 0) + share;
      remaining -= share;
    });
  }

  /* ── Render: shell ── */
  function renderAll() {
    if (!DB) return;
    _currentStats = computeStats(periodEntries());
    renderTopbar();
    renderSideStatus();
    renderBanner();
    renderStats();
    renderAlerts();
    renderEntries();
    renderClock();
    renderUserChip();
    updateActionButtons();
    if (_activeTab === "reports") renderReports();
    if (_activeTab === "settings") renderSettings();
    resize();
  }

  function renderTopbar() {
    var titles = { timesheet: "Timesheet", clock: "Clock in / out", reports: "Reports", settings: "Settings" };
    var title = $("#tms-page-title");
    if (title) title.textContent = titles[_activeTab] || "Timesheet";
    var period = $("#tms-period-label");
    if (period) {
      var worker = DB.settings.workerName ? " · " + DB.settings.workerName : "";
      var startParsed = parseISODate(DB.settings.periodStart);
      var endParsed = parseISODate(DB.settings.periodEnd);
      period.textContent = formatDateCompact(DB.settings.periodStart) + (startParsed ? " " + startParsed.getFullYear() : "") +
        " to " + formatDateCompact(DB.settings.periodEnd) + (endParsed ? " " + endParsed.getFullYear() : "") +
        " · " + periodTypeLabel(DB.settings.periodType) + worker;
    }
    var badge = $("#tms-build");
    if (badge) badge.textContent = "tool build " + TOOL_BUILD;
  }

  function renderSideStatus() {
    var host = $("#tms-side-status");
    if (!host) return;
    var meta = statusMeta();
    var stats = _currentStats || computeStats(periodEntries());
    var open = openEntry();
    var approver = DB.settings.approverName || "";
    var metaLines = [stats.entries + (stats.entries === 1 ? " entry" : " entries") + " · " + formatDuration(stats.totalMinutes)];
    if (approver) metaLines.push("Approver: " + approver);
    if (open) metaLines.push("Open entry since " + fmtTime12(open.start));
    host.innerHTML =
      '<div class="tms-side-label">Period status</div>' +
      '<div class="tms-side-value"><span class="tms-status ' + meta.cls + '">' + esc(meta.label) + '</span></div>' +
      '<div class="tms-side-meta">' + metaLines.map(function (line) { return esc(line); }).join("<br>") + '</div>';
  }

  function renderBanner() {
    var host = $("#tms-banner");
    if (!host) return;
    host.innerHTML = "";
    if (isReadOnly) {
      host.innerHTML = '<div class="tms-alert is-info"><span class="tms-alert-icon">' + icon("eye") + '</span><div><strong>Read-only view.</strong> You can review and print this timesheet, but not change entries.</div></div>';
    }
  }

  function renderStats() {
    var host = $("#tms-stats");
    if (!host) return;
    var stats = _currentStats || computeStats(periodEntries());
    var mode = DB.settings.mode;
    var cards = [];

    if (mode === "volunteer") {
      cards = [
        statCard("Total hours", formatDuration(stats.totalMinutes), stats.entries + " entries", "is-accent"),
        statCard("Volunteer hours", formatDuration(stats.volunteerMinutes), "Program: " + (DB.settings.volunteerProgram || "not set"), "is-violet"),
        statCard("Days served", String(stats.daysWorked), "with at least one entry", "is-blue"),
        statCard("Goal progress", stats.goalHours > 0 ? formatPercent(stats.goalPercent) : "No goal", stats.goalHours > 0 ? formatHours(stats.volunteerMinutes) + " of " + stats.goalHours + " h" : "Set a goal in Settings", "is-green"),
        statCard("Break time", formatDuration(stats.breakMinutes), "unpaid breaks deducted", "is-amber"),
        statCard("Verification", statusMeta().label, DB.settings.volunteerSupervisor || DB.settings.approverName || "Supervisor not set", "is-accent")
      ];
    } else if (mode === "billing") {
      cards = [
        statCard("Total hours", formatDuration(stats.totalMinutes), stats.entries + " entries", "is-accent"),
        statCard("Billable", formatDuration(stats.billableMinutes), stats.totalMinutes ? formatPercent(stats.billableMinutes / stats.totalMinutes * 100) + " of hours" : "No hours yet", "is-blue"),
        statCard("Non-billable", formatDuration(stats.nonBillableMinutes), "internal and admin time", "is-amber"),
        statCard("Days worked", String(stats.daysWorked), "with at least one entry", "is-green"),
        statCard("Billable amount", formatMoney(stats.billableAmount), DB.settings.currency + " before tax", "is-violet"),
        statCard("Projects", String(Object.keys(stats.projects).filter(function (k) { return k !== "none"; }).length), "active in this period", "is-accent")
      ];
    } else if (mode === "mixed") {
      cards = [
        statCard("Total hours", formatDuration(stats.totalMinutes), stats.entries + " entries", "is-accent"),
        statCard("Regular", formatDuration(stats.regularMinutes), DB.settings.overtimeEnabled ? "OT after " + DB.settings.weeklyOvertimeAfter + " h/week" : "Overtime off", "is-blue"),
        statCard("Overtime", formatDuration(stats.overtimeMinutes), "x" + DB.settings.overtimeMultiplier + " rate", "is-amber"),
        statCard("Billable", formatDuration(stats.billableMinutes), "paid client work", "is-green"),
        statCard("Volunteer", formatDuration(stats.volunteerMinutes), "unpaid service", "is-violet"),
        statCard("Amount", formatMoney(stats.billableAmount), DB.settings.currency + " billable", "is-accent")
      ];
    } else {
      cards = [
        statCard("Total hours", formatDuration(stats.totalMinutes), stats.entries + " entries", "is-accent"),
        statCard("Regular", formatDuration(stats.regularMinutes), DB.settings.overtimeEnabled ? "threshold " + DB.settings.weeklyOvertimeAfter + " h/week" : "Overtime off", "is-blue"),
        statCard("Overtime", formatDuration(stats.overtimeMinutes), "x" + DB.settings.overtimeMultiplier + " rate", "is-amber"),
        statCard("Billable", formatDuration(stats.billableMinutes), stats.totalMinutes ? formatPercent(stats.billableMinutes / stats.totalMinutes * 100) + " of hours" : "No hours yet", "is-green"),
        statCard("Non-billable", formatDuration(stats.nonBillableMinutes), "admin, training, travel", "is-violet"),
        statCard("Estimated pay", formatMoney(stats.payAmount), DB.settings.hourlyRate > 0 ? "@ " + formatMoney(DB.settings.hourlyRate) + "/h" : "Set an hourly rate", "is-accent")
      ];
    }

    host.innerHTML = cards.join("");
  }

  function statCard(label, value, sub, cls) {
    return '<div class="tms-stat ' + (cls || "") + '">' +
      '<span class="tms-stat-label">' + esc(label) + '</span>' +
      '<span class="tms-stat-value">' + esc(value) + '</span>' +
      '<span class="tms-stat-sub">' + esc(sub) + '</span>' +
      '</div>';
  }

  function renderAlerts() {
    var host = $("#tms-alerts");
    if (!host) return;
    var alerts = [];
    var open = openEntry();
    var outCount = outOfPeriodEntries().length;
    var stats = _currentStats || computeStats(periodEntries());

    if (!canWrite()) {
      alerts.push(alertHtml("info", "eye", "<strong>Read-only.</strong> Viewing this timesheet without edit rights."));
    }

    if (open) {
      alerts.push(alertHtml("warn", "clock", "<strong>Open entry from " + esc(formatDateLong(open.date)) + " at " + esc(fmtTime12(open.start)) + ".</strong> Clock out or fix the entry before submitting.", "fix-open"));
    }

    if (periodIsRejected()) {
      alerts.push(alertHtml("danger", "alert", "<strong>This timesheet was returned.</strong> " + esc(DB.timesheet.rejectionReason || "No reason was provided."), "review-rejected"));
    }

    if (periodIsSubmitted()) {
      alerts.push(alertHtml("info", "send", "<strong>Submitted for approval.</strong> " + (DB.settings.approverName ? "Waiting for " + esc(DB.settings.approverName) + "." : "Waiting for a manager."), ""));
    }

    if (periodIsApproved()) {
      alerts.push(alertHtml("ok", "check", "<strong>Approved.</strong> " + (DB.timesheet.approvedBy ? "Approved by " + esc(DB.timesheet.approvedBy) : "Approved") + " on " + esc(formatDateTime(DB.timesheet.approvedAt)) + ".", ""));
    }

    if (outCount > 0) {
      alerts.push(alertHtml("warn", "alert", "<strong>" + outCount + " entr" + (outCount === 1 ? "y is" : "ies are") + " outside this period.</strong> They are not counted in the report. Export a backup before changing the period.", "open-settings"));
    }

    if ((DB.settings.mode === "billing" || DB.settings.mode === "mixed") && !DB.settings.projects.length && stats.entries > 0) {
      alerts.push(alertHtml("info", "folder", "<strong>No projects are configured.</strong> Add a project in Settings so billable reports can group the time.", "open-settings"));
    }

    if (!DB.settings.workerName) {
      alerts.push(alertHtml("info", "user", "<strong>Worker name is not set.</strong> Add it in Settings so the printed timesheet and certificate are complete.", "open-settings"));
    }

    var bytes = estimateBytes();
    if (bytes >= SIZE_WARN) {
      alerts.push(alertHtml(bytes >= SIZE_BLOCK ? "danger" : "warn", "database", "<strong>Saved value is " + Math.round(bytes / 1024) + " KB.</strong> One instance should stay under 1 MB. Split the next period into a new record.", "open-settings"));
    }

    host.innerHTML = alerts.join("");
  }

  function alertHtml(tone, iconName, html, action) {
    var actionHtml = "";
    if (action === "fix-open") actionHtml = '<div class="tms-alert-actions"><button type="button" class="tms-btn tms-btn-sm" data-alert-action="' + action + '">Open entry</button></div>';
    else if (action === "open-settings") actionHtml = '<div class="tms-alert-actions"><button type="button" class="tms-btn tms-btn-sm" data-alert-action="' + action + '">Open Settings</button></div>';
    else if (action === "review-rejected") actionHtml = '<div class="tms-alert-actions"><button type="button" class="tms-btn tms-btn-sm" data-alert-action="' + action + '">Review</button></div>';
    return '<div class="tms-alert is-' + tone + '"><span class="tms-alert-icon">' + icon(iconName) + '</span><div>' + html + '</div>' + actionHtml + '</div>';
  }

  /* ── Render: entries ── */
  function renderEntries() {
    var host = $("#tms-entries");
    if (!host) return;
    var all = periodEntries();
    var filtered = filteredEntries(all);
    var sub = $("#tms-entries-sub");
    if (sub) {
      sub.textContent = filtered.length === all.length
        ? all.length + (all.length === 1 ? " entry in this period." : " entries in this period.")
        : "Showing " + filtered.length + " of " + all.length + " entries in this period.";
    }
    var navBadge = $("#tms-nav-entries");
    if (navBadge) navBadge.textContent = String(all.length);

    if (!all.length) {
      host.innerHTML = '<div class="tms-empty">' +
        '<div class="tms-empty-icon">' + icon("calendar") + '</div>' +
        '<strong>No time entries yet</strong>' +
        'Clock in on the Clock tab or add an entry manually.' +
        '<div style="margin-top:12px"><button type="button" class="tms-btn tms-btn-primary" data-empty-action="add">Add first entry</button></div>' +
        '</div>';
      return;
    }
    if (!filtered.length) {
      host.innerHTML = '<div class="tms-empty"><strong>No entries match the filters</strong>Clear the search or choose another category.</div>';
      return;
    }

    var weeks = [];
    var weekMap = {};
    filtered.forEach(function (entry) {
      var key = weekKeyOf(entry.date);
      if (!weekMap[key]) { weekMap[key] = { key: key, entries: [], days: {} }; weeks.push(weekMap[key]); }
      weekMap[key].entries.push(entry);
      if (!weekMap[key].days[entry.date]) weekMap[key].days[entry.date] = [];
      weekMap[key].days[entry.date].push(entry);
    });
    weeks.sort(function (a, b) { return a.key < b.key ? -1 : 1; });

    var html = "";
    weeks.forEach(function (week) {
      var weekMinutes = week.entries.reduce(function (sum, entry) { return sum + entryRoundedMinutes(entry); }, 0);
      var weekOT = (_currentStats && _currentStats.weeks[week.key]) ? _currentStats.weeks[week.key].overtime : 0;
      html += '<div class="tms-week-block">';
      html += '<div class="tms-week-head"><span class="tms-week-title">Week of ' + esc(formatDateCompact(week.key)) + '</span>' +
        (weekOT > 0 ? '<span class="tms-chip is-open">' + formatDuration(weekOT) + ' OT</span>' : '') +
        '<span class="tms-week-total"><b>' + formatDuration(weekMinutes) + '</b> · ' + week.entries.length + ' entries</span></div>';
      Object.keys(week.days).sort().forEach(function (date) {
        var entries = week.days[date].sort(compareEntries);
        var dayMinutes = entries.reduce(function (sum, entry) { return sum + entryRoundedMinutes(entry); }, 0);
        var d = parseISODate(date);
        html += '<div class="tms-day-block">';
        html += '<div class="tms-day-head"><span class="tms-day-date">' + esc(formatDateLong(date)) + '</span>' +
          '<span class="tms-day-name">' + (d ? DAY_NAMES[d.getDay()] : "") + '</span>' +
          '<span class="tms-day-total"><b>' + formatDuration(dayMinutes) + '</b></span>' +
          '<button type="button" class="tms-day-add" data-day-add="' + esc(date) + '">+ Add</button></div>';
        entries.forEach(function (entry) {
          html += entryRowHtml(entry);
        });
        html += '</div>';
      });
      html += '</div>';
    });
    host.innerHTML = html;
  }

  function filteredEntries(all) {
    var query = _filters.search.trim().toLowerCase();
    return all.filter(function (entry) {
      if (_filters.category !== "all" && entry.category !== _filters.category) return false;
      if (_filters.billable === "billable" && !entry.billable) return false;
      if (_filters.billable === "nonbillable" && entry.billable) return false;
      if (!query) return true;
      var haystack = [
        projectName(entry.projectId),
        activityName(entry.activityId),
        entry.notes,
        (entry.tags || []).join(" "),
        entry.category
      ].join(" ").toLowerCase();
      return haystack.indexOf(query) !== -1;
    });
  }

  function entryRowHtml(entry) {
    var category = CATEGORIES.filter(function (c) { return c.id === entry.category; })[0] || CATEGORIES[0];
    var start = timeToMinutes(entry.start);
    var end = timeToMinutes(entry.end);
    var overnight = start !== null && end !== null && end < start;
    var timeLabel = entry.start ? fmtTime12(entry.start) + " - " + (entry.end ? fmtTime12(entry.end) : "open") : "No time";
    var categoryChip = '<span class="tms-chip ' + category.chip + '">' + esc(category.label) + '</span>';
    var billableChip = entry.category === "volunteer"
      ? '<span class="tms-chip is-nonbillable">No pay</span>'
      : (entry.billable ? '<span class="tms-chip is-billable">Billable</span>' : '<span class="tms-chip is-nonbillable">Non-billable</span>');
    var tags = (entry.tags || []).map(function (tag) { return '<span class="tms-chip is-tag">' + esc(tag) + '</span>'; }).join("");
    var hours = entryRoundedMinutes(entry);
    var raw = entryRawMinutes(entry);
    var hoursLabel = formatDuration(hours);
    var hoursSmall = "";
    if (entryOT(entry) > 0) hoursSmall = formatDuration(entryOT(entry)) + " OT";
    else if (Math.abs(hours - raw) >= 1) hoursSmall = "raw " + formatDuration(raw);
    var breakLabel = entry.breakPaid ? "Paid " + entry.breakMinutes + "m" : (entry.breakMinutes ? entry.breakMinutes + "m unpaid" : "No break");
    var amount = entryAmount(entry);
    var amountLabel = DB.settings.mode === "volunteer" ? "Hours only" : (amount > 0 ? formatMoney(amount) : "No rate");
    var noteHtml = entry.notes ? '<div class="tms-entry-note">' + esc(entry.notes) + '</div>' : "";
    var tagHtml = tags ? '<div class="tms-entry-tags">' + tags + '</div>' : "";
    var openClass = entry.end ? "" : " is-open-entry";
    return '<div class="tms-entry-row' + openClass + '" data-entry-id="' + esc(entry.id) + '" tabindex="0" role="button" aria-label="Edit entry">' +
      '<div class="tms-entry-time"><b>' + esc(timeLabel) + '</b>' + (overnight ? ' <span class="tms-chip is-open">+1d</span>' : '') + '</div>' +
      '<div class="tms-entry-what">' +
        '<div class="tms-entry-project">' + esc(entryProjectLabel(entry)) + '</div>' +
        (entryActivityLabel(entry) ? '<div class="tms-entry-activity">' + esc(entryActivityLabel(entry)) + '</div>' : '') +
        noteHtml + tagHtml +
        '<div class="tms-entry-tags">' + categoryChip + billableChip + '</div>' +
      '</div>' +
      '<div class="tms-entry-break">' + esc(breakLabel) + '</div>' +
      '<div class="tms-entry-hours">' + esc(hoursLabel) + (hoursSmall ? '<small>' + esc(hoursSmall) + '</small>' : '') + '</div>' +
      '<div class="tms-entry-amount">' + esc(amountLabel) + '</div>' +
      '<button type="button" class="tms-entry-edit" data-edit-entry="' + esc(entry.id) + '" title="Edit entry" aria-label="Edit entry">&#9998;</button>' +
      '</div>';
  }

  function entryOT(entry) {
    if (!_currentStats || !_currentStats.entryOT) return 0;
    return _currentStats.entryOT[entry.id] || 0;
  }

  /* ── Render: clock ── */
  function renderClock() {
    updateClockNow();
    var dateHost = $("#tms-clock-date");
    if (dateHost) dateHost.textContent = formatDateLong(todayISO());
    var open = openEntry();
    var kicker = $("#tms-clock-kicker");
    var status = $("#tms-clock-status");
    var button = $("#tms-btn-clock");
    var label = $("#tms-clock-btn-label");
    var hint = $("#tms-clock-hint");

    if (open) {
      if (kicker) kicker.textContent = "Clocked in";
      if (status) status.innerHTML = "Started " + esc(fmtTime12(open.start)) + " on " + esc(formatDateLong(open.date)) + " · <b>" + esc(elapsedLabel(open)) + "</b>";
      if (button) { button.classList.add("is-running"); button.disabled = !canEditEntries(); }
      if (label) label.textContent = "Clock out";
      if (hint) hint.textContent = "Clocking out closes this entry and applies the unpaid break you set below.";
    } else {
      if (kicker) kicker.textContent = "Ready to start";
      if (status) status.textContent = "Not clocked in. The timer starts when you clock in and keeps running until you clock out.";
      if (button) { button.classList.remove("is-running"); button.disabled = !canEditEntries(); }
      if (label) label.textContent = "Clock in";
      if (hint) hint.textContent = "Clock in records the current time. You can fix or complete the entry later.";
    }

    fillSelect($("#tms-clock-project"), projectOptions(DB.ui.clockProjectId), DB.ui.clockProjectId || "");
    fillSelect($("#tms-clock-activity"), activityOptions(DB.ui.clockActivityId), DB.ui.clockActivityId || "");
    var breakInput = $("#tms-clock-break");
    if (breakInput && document.activeElement !== breakInput) {
      breakInput.value = String(DB.ui.clockBreakMinutes !== undefined ? DB.ui.clockBreakMinutes : DB.settings.breakDefaultMinutes);
    }
    renderTodayEntries();
    renderWeekStrip();
  }

  function projectOptions(selectedId) {
    var list = [{ value: "", label: "No project" }];
    DB.settings.projects.forEach(function (project) {
      if (!project.active && project.id !== selectedId) return;
      list.push({ value: project.id, label: project.name + (project.client ? " · " + project.client : "") + (project.active ? "" : " (inactive)") });
    });
    return list;
  }

  function activityOptions(selectedId) {
    var list = [{ value: "", label: "No activity" }];
    DB.settings.activities.forEach(function (activity) {
      if (!activity.active && activity.id !== selectedId) return;
      list.push({ value: activity.id, label: activity.name + (activity.active ? "" : " (inactive)") });
    });
    return list;
  }

  function fillSelect(select, options, value) {
    if (!select) return;
    select.innerHTML = options.map(function (option) {
      return '<option value="' + esc(option.value) + '"' + (option.value === value ? " selected" : "") + '>' + esc(option.label) + '</option>';
    }).join("");
    if (value !== undefined && value !== null) select.value = value;
  }

  function updateClockNow() {
    var host = $("#tms-clock-now");
    if (!host) return;
    var now = new Date();
    host.textContent = pad2(now.getHours()) + ":" + pad2(now.getMinutes()) + ":" + pad2(now.getSeconds());
    var open = openEntry();
    if (open) {
      var status = $("#tms-clock-status");
      if (status) status.innerHTML = "Started " + esc(fmtTime12(open.start)) + " on " + esc(formatDateLong(open.date)) + " · <b>" + esc(elapsedLabel(open)) + "</b>";
    }
  }

  function elapsedMinutesSinceStart(entry) {
    if (!entry) return 0;
    var start = parseISODate(entry.date);
    if (!start) return 0;
    var parts = String(entry.start || "00:00").split(":").map(Number);
    start.setHours(parts[0] || 0, parts[1] || 0, 0, 0);
    return Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000));
  }

  function elapsedLabel(entry) {
    if (!entry) return "00:00:00";
    var start = parseISODate(entry.date);
    if (!start) return "00:00:00";
    var parts = String(entry.start || "00:00").split(":").map(Number);
    start.setHours(parts[0] || 0, parts[1] || 0, 0, 0);
    var ms = Date.now() - start.getTime();
    if (ms < 0) ms = 0;
    var total = Math.floor(ms / 1000);
    var hours = Math.floor(total / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var seconds = total % 60;
    return pad2(hours) + ":" + pad2(minutes) + ":" + pad2(seconds);
  }

  function renderTodayEntries() {
    var host = $("#tms-today-entries");
    var sub = $("#tms-today-sub");
    if (!host) return;
    var entries = todayEntries();
    var total = entries.reduce(function (sum, entry) { return sum + entryRoundedMinutes(entry); }, 0);
    if (sub) sub.textContent = entries.length ? entries.length + (entries.length === 1 ? " entry" : " entries") + " · " + formatDuration(total) : "No entries yet";
    if (!entries.length) {
      host.innerHTML = '<div class="tms-empty" style="padding:22px 16px">Nothing logged today.</div>';
      return;
    }
    host.innerHTML = entries.map(function (entry) {
      var time = entry.start ? fmtTime12(entry.start) + " - " + (entry.end ? fmtTime12(entry.end) : "open") : "No time";
      return '<div class="tms-today-row" data-entry-id="' + esc(entry.id) + '" role="button" tabindex="0">' +
        '<span class="tms-today-row-time">' + esc(time) + '</span>' +
        '<span class="tms-today-row-what"><b>' + esc(entryProjectLabel(entry)) + '</b><span>' + esc(entryActivityLabel(entry) || entry.notes || "No activity") + '</span></span>' +
        '<span class="tms-today-row-hours">' + (entry.end ? formatDuration(entryRoundedMinutes(entry)) : "open") + '</span>' +
        '</div>';
    }).join("");
  }

  function renderWeekStrip() {
    var host = $("#tms-week-strip");
    var sub = $("#tms-week-sub");
    if (!host) return;
    var start = startOfWeekISO(todayISO(), DB.settings.weekStart);
    var cells = [];
    var total = 0;
    for (var i = 0; i < 7; i++) {
      var date = addDaysISO(start, i);
      var d = parseISODate(date);
      var minutes = DB.entries.filter(function (entry) { return entry.date === date; }).reduce(function (sum, entry) { return sum + entryRoundedMinutes(entry); }, 0);
      total += minutes;
      cells.push('<div class="tms-week-cell' + (date === todayISO() ? " is-today" : "") + (minutes ? "" : " is-empty") + '">' +
        '<span class="tms-week-day">' + (d ? DAY_SHORT[d.getDay()] : "") + '</span>' +
        '<span class="tms-week-num">' + (d ? d.getDate() : "") + '</span>' +
        '<span class="tms-week-hrs">' + (minutes ? formatDuration(minutes) : "0h") + '</span>' +
        '</div>');
    }
    host.innerHTML = cells.join("");
    if (sub) sub.textContent = "Week of " + formatDateCompact(start) + " · " + formatDuration(total);
  }

  /* ── Render: reports ── */
  function renderReports() {
    var host = $("#tms-report-body");
    if (!host) return;
    var stats = _currentStats || computeStats(periodEntries());
    $$("#tms-report-tabs [data-report]").forEach(function (button) {
      button.classList.toggle("is-active", button.getAttribute("data-report") === _reportTab);
    });
    host.innerHTML = buildReportContent(_reportTab, false, stats);
  }

  function buildReportContent(kind, forPrint, stats) {
    stats = stats || computeStats(periodEntries());
    if (kind === "day") return reportCard("Daily detail", "Every entry grouped by date.", dayTableHtml(stats));
    if (kind === "project") return reportCard("Project and client breakdown", "Hours, billable time and amounts by project.", projectTableHtml(stats, forPrint));
    if (kind === "week") return reportCard("Weekly breakdown", "Regular and overtime allocation by work week.", weekTableHtml(stats));
    if (kind === "audit") return reportCard("Audit log", "Who changed what and when.", auditLogHtml(forPrint));
    return summaryReportHtml(stats, forPrint);
  }

  function summaryReportHtml(stats, forPrint) {
    var totalLabel = DB.settings.mode === "volunteer" ? "Volunteer hours" : (DB.settings.mode === "billing" ? "Billable amount" : "Total hours");
    var totalValue = DB.settings.mode === "volunteer" ? formatDuration(stats.volunteerMinutes) : (DB.settings.mode === "billing" ? formatMoney(stats.billableAmount) : formatDuration(stats.totalMinutes));
    var hero = '<div class="tms-report-hero">' +
      '<div class="tms-rh-main">' +
        '<div class="tms-rh-kicker">Timesheet summary</div>' +
        '<div class="tms-rh-title">' + esc(DB.settings.workerName || "Worker") + '</div>' +
        '<div class="tms-rh-meta">' + esc(formatDateShort(DB.settings.periodStart)) + " to " + esc(formatDateShort(DB.settings.periodEnd)) + ' · ' + esc(periodTypeLabel(DB.settings.periodType)) + ' · <span class="tms-status ' + statusMeta().cls + '">' + esc(statusMeta().label) + '</span></div>' +
      '</div>' +
      '<div class="tms-rh-total"><b>' + esc(totalValue) + '</b><span>' + esc(totalLabel) + '</span></div>' +
      '</div>';

    var metrics = '<div class="tms-report-grid">' +
      reportMetric("Regular", formatDuration(stats.regularMinutes), "paid time") +
      reportMetric("Overtime", formatDuration(stats.overtimeMinutes), "x" + DB.settings.overtimeMultiplier) +
      reportMetric("Billable", formatDuration(stats.billableMinutes), "client work") +
      reportMetric("Non-billable", formatDuration(stats.nonBillableMinutes), "internal") +
      reportMetric("Days worked", String(stats.daysWorked), "with entries") +
      reportMetric("Entries", String(stats.entries), "in this period") +
      reportMetric(DB.settings.mode === "volunteer" ? "Goal progress" : "Amount", DB.settings.mode === "volunteer" ? (stats.goalHours > 0 ? formatPercent(stats.goalPercent) : "No goal") : formatMoney(stats.billableAmount), DB.settings.mode === "volunteer" ? (stats.goalHours > 0 ? formatHours(stats.volunteerMinutes) + " of " + stats.goalHours + " h" : "Set a goal") : DB.settings.currency) +
      reportMetric("Breaks", formatDuration(stats.breakMinutes), "unpaid") +
      '</div>';

    var chartCard = '<div class="tms-report-card"><h2>Hours over the period</h2><p class="tms-report-sub">Daily totals with the billable portion highlighted.</p>' + dailyChartHtml(stats) + '</div>';
    var categoryCard = '<div class="tms-report-card"><h2>Category split</h2><p class="tms-report-sub">Where the time went.</p>' + categoryBarsHtml(stats) + '</div>';

    var certificateAction = "";
    if (!forPrint && (DB.settings.mode === "volunteer" || DB.settings.mode === "mixed") && stats.volunteerMinutes > 0) {
      certificateAction = '<div class="tms-alert is-info" style="margin-top:12px"><span class="tms-alert-icon">' + icon("award") + '</span><div><strong>Volunteer hours are ready to certify.</strong> Print a certificate with the program, supervisor and total hours.</div><div class="tms-alert-actions"><button type="button" class="tms-btn tms-btn-sm" data-report-action="certificate">Print certificate</button></div></div>';
    }

    var approval = approvalLineHtml();

    return hero + metrics + certificateAction + chartCard + categoryCard +
      '<div class="tms-report-card"><h2>Daily detail</h2><p class="tms-report-sub">The same entries that make up the totals.</p>' + dayTableHtml(stats) + '</div>' +
      '<div class="tms-report-card"><h2>Project breakdown</h2><p class="tms-report-sub">Billable and non-billable time by project.</p>' + projectTableHtml(stats, forPrint) + '</div>' +
      '<div class="tms-report-card"><h2>Approval</h2>' + approval + signatureRowHtml() + '</div>';
  }

  function reportMetric(label, value, sub) {
    return '<div class="tms-report-metric"><span>' + esc(label) + '</span><b>' + esc(value) + '</b><small>' + esc(sub) + '</small></div>';
  }

  function reportCard(title, sub, body) {
    return '<div class="tms-report-card"><h2>' + esc(title) + '</h2><p class="tms-report-sub">' + esc(sub) + '</p>' + body + '</div>';
  }

  function dailyChartHtml(stats) {
    var days = [];
    var start = parseISODate(DB.settings.periodStart);
    var end = parseISODate(DB.settings.periodEnd);
    if (!start || !end) return '<div class="tms-empty">No period set.</div>';
    var cursor = new Date(start.getTime());
    var guard = 0;
    while (cursor <= end && guard < 400) {
      days.push(toISO(cursor));
      cursor = addDays(cursor, 1);
      guard += 1;
    }
    if (!days.length) return '<div class="tms-empty">No period set.</div>';

    var buckets = [];
    if (days.length > 62) {
      var weekMap = {};
      days.forEach(function (date) {
        var key = weekKeyOf(date);
        if (!weekMap[key]) weekMap[key] = { key: key, label: formatDateCompact(key), total: 0, billable: 0 };
        var minutes = stats.dayMinutes[date] || 0;
        weekMap[key].total += minutes;
        var dayEntries = periodEntries().filter(function (entry) { return entry.date === date; });
        weekMap[key].billable += dayEntries.reduce(function (sum, entry) { return sum + (entry.billable && !isVolunteerEntry(entry) ? entryRoundedMinutes(entry) : 0); }, 0);
      });
      Object.keys(weekMap).forEach(function (key) { buckets.push(weekMap[key]); });
    } else {
      days.forEach(function (date) {
        var dayEntries = periodEntries().filter(function (entry) { return entry.date === date; });
        buckets.push({
          key: date,
          label: String(parseISODate(date).getDate()),
          total: stats.dayMinutes[date] || 0,
          billable: dayEntries.reduce(function (sum, entry) { return sum + (entry.billable && !isVolunteerEntry(entry) ? entryRoundedMinutes(entry) : 0); }, 0)
        });
      });
    }
    if (!buckets.some(function (bucket) { return bucket.total > 0; })) {
      return '<div class="tms-empty" style="padding:22px">No hours logged in this period yet.</div>';
    }

    var width = 760;
    var height = 196;
    var padLeft = 36;
    var padRight = 10;
    var padTop = 12;
    var padBottom = 30;
    var plotW = width - padLeft - padRight;
    var plotH = height - padTop - padBottom;
    var maxMinutes = Math.max.apply(null, buckets.map(function (b) { return b.total; }));
    var maxHours = Math.max(4, Math.ceil(maxMinutes / 60 / 4) * 4);
    var barGap = buckets.length > 45 ? 1 : 2;
    var barW = Math.max(2, plotW / buckets.length - barGap);
    var gridLines = 4;
    var svg = '<svg class="tms-chart" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Hours over the period">';
    for (var g = 0; g <= gridLines; g++) {
      var y = padTop + plotH - (plotH * g / gridLines);
      var value = maxHours * g / gridLines;
      svg += '<line x1="' + padLeft + '" y1="' + y + '" x2="' + (width - padRight) + '" y2="' + y + '" stroke="#e2e8f0" stroke-width="1"></line>';
      svg += '<text x="' + (padLeft - 6) + '" y="' + (y + 3) + '" text-anchor="end" font-size="9" fill="#94a3b8">' + value + 'h</text>';
    }
    buckets.forEach(function (bucket, index) {
      var x = padLeft + index * (plotW / buckets.length) + barGap / 2;
      var totalH = plotH * Math.min(1, bucket.total / (maxHours * 60));
      var billableH = plotH * Math.min(1, bucket.billable / (maxHours * 60));
      var y = padTop + plotH - totalH;
      var bY = padTop + plotH - billableH;
      var label = bucket.label;
      var tooltip = (bucket.key.length === 10 ? formatDateLong(bucket.key) : "Week of " + formatDateCompact(bucket.key)) + ": " + formatDuration(bucket.total) + (bucket.billable ? " (" + formatDuration(bucket.billable) + " billable)" : "");
      svg += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + Math.max(0, totalH) + '" rx="2" fill="#cfe9e5"><title>' + esc(tooltip) + '</title></rect>';
      if (bucket.billable > 0) svg += '<rect x="' + x + '" y="' + bY + '" width="' + barW + '" height="' + Math.max(0, billableH) + '" rx="2" fill="#0f766e"><title>' + esc(tooltip) + '</title></rect>';
      var every = Math.ceil(buckets.length / 12);
      if (index % every === 0) {
        svg += '<text x="' + (x + barW / 2) + '" y="' + (height - 10) + '" text-anchor="middle" font-size="8.5" fill="#64748b">' + esc(label) + '</text>';
      }
    });
    svg += '<text x="' + padLeft + '" y="' + (height - 10) + '" font-size="8.5" fill="#64748b">All hours</text>';
    svg += '<rect x="' + (padLeft + 52) + '" y="' + (height - 16) + '" width="8" height="8" rx="2" fill="#0f766e"></rect>';
    svg += '<text x="' + (padLeft + 64) + '" y="' + (height - 10) + '" font-size="8.5" fill="#64748b">Billable</text>';
    svg += '</svg>';
    return svg;
  }

  function categoryBarsHtml(stats) {
    var total = stats.totalMinutes || 0;
    if (!total) return '<div class="tms-empty" style="padding:22px">No time logged yet.</div>';
    return CATEGORIES.map(function (category) {
      var item = stats.categories[category.id];
      if (!item || !item.minutes) return "";
      var pct = item.minutes / total * 100;
      return '<div class="tms-bar-row"><span class="tms-bar-label">' + esc(category.label) + '</span><span class="tms-bar-track"><span class="tms-bar-fill" style="width:' + Math.max(1, pct) + '%"></span></span><span class="tms-bar-value">' + formatDuration(item.minutes) + ' · ' + formatPercent(pct) + '</span></div>';
    }).join("");
  }

  function dayTableHtml(stats) {
    var entries = periodEntries();
    if (!entries.length) return '<div class="tms-empty" style="padding:22px">No entries in this period.</div>';
    var byDay = {};
    entries.forEach(function (entry) {
      if (!byDay[entry.date]) byDay[entry.date] = [];
      byDay[entry.date].push(entry);
    });
    var rows = "";
    var totals = { minutes: 0, billable: 0, amount: 0, breaks: 0 };
    Object.keys(byDay).sort().forEach(function (date) {
      var dayEntries = byDay[date].sort(compareEntries);
      var firstStart = null;
      var lastEnd = null;
      var breakMinutes = 0;
      var minutes = 0;
      var billable = 0;
      var amount = 0;
      var projects = [];
      dayEntries.forEach(function (entry) {
        var s = timeToMinutes(entry.start);
        var e = timeToMinutes(entry.end);
        if (s !== null && (firstStart === null || s < firstStart)) firstStart = s;
        if (e !== null && (lastEnd === null || e > lastEnd)) lastEnd = e;
        breakMinutes += entryUnpaidBreak(entry);
        minutes += entryRoundedMinutes(entry);
        if (entry.billable && !isVolunteerEntry(entry)) billable += entryRoundedMinutes(entry);
        amount += entryAmount(entry);
        var projectLabel = entryProjectLabel(entry);
        if (projectLabel && projectLabel !== "No project" && projects.indexOf(projectLabel) === -1) projects.push(projectLabel);
      });
      totals.minutes += minutes;
      totals.billable += billable;
      totals.amount += amount;
      totals.breaks += breakMinutes;
      var d = parseISODate(date);
      rows += '<tr>' +
        '<td><b>' + esc(formatDateCompact(date)) + '</b></td>' +
        '<td>' + esc(d ? DAY_SHORT[d.getDay()] : "") + '</td>' +
        '<td>' + esc(firstStart !== null ? fmtTime12(minutesToTime(firstStart)) : "") + '</td>' +
        '<td>' + esc(lastEnd !== null ? fmtTime12(minutesToTime(lastEnd)) : "") + '</td>' +
        '<td class="is-num">' + (breakMinutes ? breakMinutes + "m" : "-") + '</td>' +
        '<td class="is-num"><b>' + formatDuration(minutes) + '</b></td>' +
        '<td class="is-num">' + formatDuration(billable) + '</td>' +
        '<td class="is-num">' + (DB.settings.mode === "volunteer" ? "-" : formatMoney(amount)) + '</td>' +
        '<td>' + esc(projects.join(", ") || "-") + '</td>' +
        '</tr>';
    });
    return '<div class="tms-table-wrap"><table class="tms-table">' +
      '<thead><tr><th>Date</th><th>Day</th><th>First in</th><th>Last out</th><th class="is-num">Break</th><th class="is-num">Hours</th><th class="is-num">Billable</th><th class="is-num">Amount</th><th>Projects</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="4">Total</td><td class="is-num">' + totals.breaks + 'm</td><td class="is-num">' + formatDuration(totals.minutes) + '</td><td class="is-num">' + formatDuration(totals.billable) + '</td><td class="is-num">' + (DB.settings.mode === "volunteer" ? "-" : formatMoney(totals.amount)) + '</td><td></td></tr></tfoot>' +
      '</table></div>';
  }

  function projectTableHtml(stats, forPrint) {
    var keys = Object.keys(stats.projects);
    if (!keys.length) return '<div class="tms-empty" style="padding:22px">No project data yet.</div>';
    var rows = "";
    var totals = { minutes: 0, billable: 0, amount: 0, entries: 0 };
    keys.sort(function (a, b) { return stats.projects[b].minutes - stats.projects[a].minutes; }).forEach(function (key) {
      var project = stats.projects[key];
      totals.minutes += project.minutes;
      totals.billable += project.billableMinutes;
      totals.amount += project.amount;
      totals.entries += project.entries;
      var budgetHtml = "-";
      if (project.budgetHours > 0) {
        var used = project.minutes / 60;
        var pct = Math.min(100, used / project.budgetHours * 100);
        budgetHtml = '<div>' + formatHours(project.minutes) + ' / ' + project.budgetHours + ' h</div><div class="tms-size-meter" style="height:5px;margin-top:4px"><div class="tms-size-meter-fill' + (pct >= 100 ? " is-danger" : (pct >= 80 ? " is-warn" : "")) + '" style="width:' + Math.max(1, pct) + '%"></div></div>';
      }
      rows += '<tr>' +
        '<td><b>' + esc(project.name) + '</b></td>' +
        '<td>' + esc(project.client || "-") + '</td>' +
        '<td class="is-num">' + project.entries + '</td>' +
        '<td class="is-num"><b>' + formatDuration(project.minutes) + '</b></td>' +
        '<td class="is-num">' + formatDuration(project.billableMinutes) + '</td>' +
        '<td class="is-num">' + (project.rate > 0 ? formatMoney(project.rate) + "/h" : "-") + '</td>' +
        '<td class="is-num">' + (DB.settings.mode === "volunteer" ? "-" : formatMoney(project.amount)) + '</td>' +
        '<td>' + budgetHtml + '</td>' +
        '</tr>';
    });
    return '<div class="tms-table-wrap"><table class="tms-table">' +
      '<thead><tr><th>Project</th><th>Client</th><th class="is-num">Entries</th><th class="is-num">Hours</th><th class="is-num">Billable</th><th class="is-num">Rate</th><th class="is-num">Amount</th><th>Budget</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="2">Total</td><td class="is-num">' + totals.entries + '</td><td class="is-num">' + formatDuration(totals.minutes) + '</td><td class="is-num">' + formatDuration(totals.billable) + '</td><td></td><td class="is-num">' + (DB.settings.mode === "volunteer" ? "-" : formatMoney(totals.amount)) + '</td><td></td></tr></tfoot>' +
      '</table></div>' +
      (!forPrint && DB.settings.mode !== "volunteer" ? '<div style="margin-top:10px"><button type="button" class="tms-btn tms-btn-sm" data-report-action="copy-invoice">Copy invoice summary</button></div>' : '');
  }

  function weekTableHtml(stats) {
    var keys = Object.keys(stats.weeks);
    if (!keys.length) return '<div class="tms-empty" style="padding:22px">No weekly data yet.</div>';
    var rows = "";
    var totals = { total: 0, regular: 0, overtime: 0, billable: 0, amount: 0 };
    keys.sort().forEach(function (key) {
      var week = stats.weeks[key];
      var billable = week.entries.reduce(function (sum, entry) { return sum + (entry.billable && !isVolunteerEntry(entry) ? entryRoundedMinutes(entry) : 0); }, 0);
      var amount = week.entries.reduce(function (sum, entry) { return sum + entryAmount(entry); }, 0);
      totals.total += week.total;
      totals.regular += week.regular;
      totals.overtime += week.overtime;
      totals.billable += billable;
      totals.amount += amount;
      rows += '<tr>' +
        '<td><b>Week of ' + esc(formatDateCompact(key)) + '</b></td>' +
        '<td>' + esc(formatDateCompact(key)) + ' to ' + esc(formatDateCompact(addDaysISO(key, 6))) + '</td>' +
        '<td class="is-num"><b>' + formatDuration(week.total) + '</b></td>' +
        '<td class="is-num">' + formatDuration(week.regular) + '</td>' +
        '<td class="is-num">' + formatDuration(week.overtime) + '</td>' +
        '<td class="is-num">' + formatDuration(billable) + '</td>' +
        '<td class="is-num">' + (DB.settings.mode === "volunteer" ? "-" : formatMoney(amount)) + '</td>' +
        '</tr>';
    });
    return '<div class="tms-table-wrap"><table class="tms-table">' +
      '<thead><tr><th>Week</th><th>Range</th><th class="is-num">Hours</th><th class="is-num">Regular</th><th class="is-num">Overtime</th><th class="is-num">Billable</th><th class="is-num">Amount</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="2">Total</td><td class="is-num">' + formatDuration(totals.total) + '</td><td class="is-num">' + formatDuration(totals.regular) + '</td><td class="is-num">' + formatDuration(totals.overtime) + '</td><td class="is-num">' + formatDuration(totals.billable) + '</td><td class="is-num">' + (DB.settings.mode === "volunteer" ? "-" : formatMoney(totals.amount)) + '</td></tr></tfoot>' +
      '</table></div>';
  }

  function auditLogHtml(forPrint) {
    var items = DB.audit || [];
    if (!items.length) return '<div class="tms-empty" style="padding:22px">No changes recorded yet.</div>';
    var show = forPrint ? items : items.slice(0, 100);
    var rows = show.map(function (item) {
      return '<tr><td class="tms-nowrap">' + esc(formatDateTime(item.at)) + '</td><td><b>' + esc(item.action) + '</b></td><td>' + esc(item.detail || "-") + '</td><td>' + esc(item.by || "-") + '</td></tr>';
    }).join("");
    return '<div class="tms-table-wrap"><table class="tms-table">' +
      '<thead><tr><th>When</th><th>Action</th><th>Detail</th><th>By</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table></div>' +
      (!forPrint && items.length > show.length ? '<p class="tms-muted" style="margin-top:8px;font-size:11.5px">Showing latest 100 of ' + items.length + ' events.</p>' : '');
  }

  function approvalLineHtml() {
    var parts = [];
    if (DB.timesheet.submittedAt) parts.push('<span>Submitted <b>' + esc(formatDateTime(DB.timesheet.submittedAt)) + '</b> by <b>' + esc(DB.timesheet.submittedBy || "-") + '</b></span>');
    if (DB.timesheet.approvedAt) parts.push('<span>Approved <b>' + esc(formatDateTime(DB.timesheet.approvedAt)) + '</b> by <b>' + esc(DB.timesheet.approvedBy || DB.settings.approverName || "-") + '</b></span>');
    if (DB.timesheet.rejectedAt) parts.push('<span>Returned <b>' + esc(formatDateTime(DB.timesheet.rejectedAt)) + '</b> by <b>' + esc(DB.timesheet.rejectedBy || "-") + '</b></span>');
    if (!parts.length) parts.push('<span>This period has not been submitted yet.</span>');
    return '<div class="tms-approval-line">' + parts.join("") + '</div>';
  }

  function signatureRowHtml() {
    return '<div class="tms-signature-row">' +
      '<div class="tms-signature"><div class="tms-sign-line"></div><span>Worker signature' + (DB.settings.workerName ? " - " + esc(DB.settings.workerName) : "") + '</span></div>' +
      '<div class="tms-signature"><div class="tms-sign-line"></div><span>Approved by' + (DB.settings.approverName ? " - " + esc(DB.settings.approverName) : "") + '</span></div>' +
      '</div>';
  }

  /* ── Render: settings ── */
  function renderSettings() {
    var host = $("#tms-settings-body");
    if (!host) return;
    var s = DB.settings;
    var manage = canManage();
    var dis = manage ? "" : " disabled";
    var workerDis = canWrite() ? "" : " disabled";
    var html = "";

    html += settingsCard("Worker and period", "Who this timesheet belongs to, and the dates it covers.",
      '<div class="tms-form-grid">' +
        settingField("Worker name", '<input type="text" class="tms-input" data-setting="workerName" value="' + esc(s.workerName) + '" maxlength="120"' + workerDis + '>') +
        settingField("Employee ID", '<input type="text" class="tms-input" data-setting="employeeId" value="' + esc(s.employeeId) + '" maxlength="60"' + workerDis + '>') +
        settingField("Department", '<input type="text" class="tms-input" data-setting="department" value="' + esc(s.department) + '" maxlength="90"' + workerDis + '>') +
        settingField("Organization", '<input type="text" class="tms-input" data-setting="organizationName" value="' + esc(s.organizationName) + '" maxlength="120"' + workerDis + '>') +
        settingField("Period type", '<select class="tms-select" data-setting="periodType"' + dis + '>' + PERIOD_TYPES.map(function (p) { return '<option value="' + p.id + '"' + (s.periodType === p.id ? " selected" : "") + '>' + esc(p.label) + '</option>'; }).join("") + '</select>') +
        settingField("Week starts on", '<select class="tms-select" data-setting="weekStart"' + dis + '><option value="1"' + (s.weekStart === 1 ? " selected" : "") + '>Monday</option><option value="0"' + (s.weekStart === 0 ? " selected" : "") + '>Sunday</option></select>') +
        '<div class="tms-field is-wide"><span>Recalculate period from a date</span><div style="display:flex;gap:7px;flex-wrap:wrap"><input type="date" class="tms-input" id="tms-period-anchor" value="' + esc(s.periodStart) + '"' + dis + ' style="flex:1;min-width:150px"><button type="button" class="tms-btn" data-action="apply-period"' + dis + '>Apply period</button></div></div>' +
        settingField("Period start", '<input type="date" class="tms-input" data-setting="periodStart" value="' + esc(s.periodStart) + '"' + (s.periodType === "custom" && manage ? "" : " disabled") + '>') +
        settingField("Period end", '<input type="date" class="tms-input" data-setting="periodEnd" value="' + esc(s.periodEnd) + '"' + (s.periodType === "custom" && manage ? "" : " disabled") + '>') +
      '</div>' +
      '<div class="tms-settings-note is-info">One instance holds one worker and one period. Monthly or weekly periods keep each saved value small and keep approval simple.</div>'
    );

    html += settingsCard("Work mode and pay", "Choose how this instance is used. The mode changes the columns and reports, not the stored entries.",
      '<div class="tms-form-grid">' +
        settingField("Mode", '<select class="tms-select" data-setting="mode"' + dis + '>' + MODES.map(function (m) { return '<option value="' + m.id + '"' + (s.mode === m.id ? " selected" : "") + '>' + esc(m.label) + '</option>'; }).join("") + '</select>') +
        settingField("Currency", '<input type="text" class="tms-input" data-setting="currency" value="' + esc(s.currency) + '" maxlength="3"' + dis + '>') +
        settingField("Default hourly rate", '<input type="number" class="tms-input" data-setting="hourlyRate" value="' + esc(s.hourlyRate) + '" min="0" step="0.01"' + dis + '>') +
        settingField("Standard day (hours)", '<input type="number" class="tms-input" data-setting="standardDayHours" value="' + esc(s.standardDayHours) + '" min="0" max="24" step="0.5"' + dis + '>') +
      '</div>' +
      '<div class="tms-settings-note">Current mode: <b>' + esc(modeLabel(s.mode)) + '</b>. ' + esc(modeHint(s.mode)) + '</div>'
    );

    html += settingsCard("Overtime and rounding", "Configured policy for this period. It is a calculation aid, not legal advice.",
      '<div class="tms-form-grid">' +
        '<div class="tms-field is-wide"><label class="tms-switch"><input type="checkbox" data-setting="overtimeEnabled"' + (s.overtimeEnabled ? " checked" : "") + dis + '> Calculate overtime</label></div>' +
        settingField("Weekly overtime after (hours)", '<input type="number" class="tms-input" data-setting="weeklyOvertimeAfter" value="' + esc(s.weeklyOvertimeAfter) + '" min="0" step="0.5"' + dis + '>') +
        settingField("Daily overtime after (hours, 0 = off)", '<input type="number" class="tms-input" data-setting="dailyOvertimeAfter" value="' + esc(s.dailyOvertimeAfter) + '" min="0" step="0.5"' + dis + '>') +
        settingField("Overtime multiplier", '<input type="number" class="tms-input" data-setting="overtimeMultiplier" value="' + esc(s.overtimeMultiplier) + '" min="1" step="0.1"' + dis + '>') +
        settingField("Rounding", '<select class="tms-select" data-setting="rounding"' + dis + '>' + ROUNDING_OPTIONS.map(function (r) { return '<option value="' + r.id + '"' + (s.rounding === r.id ? " selected" : "") + '>' + esc(r.label) + '</option>'; }).join("") + '</select>') +
      '</div>' +
      '<div class="tms-settings-note">If you use rounding, check over time that it does not systematically underpay. The tool reports both exact and rounded minutes.</div>'
    );

    html += settingsCard("Breaks and validation", "Defaults for new entries and the fields that are required before saving.",
      '<div class="tms-form-grid">' +
        settingField("Default unpaid break (minutes)", '<input type="number" class="tms-input" data-setting="breakDefaultMinutes" value="' + esc(s.breakDefaultMinutes) + '" min="0" max="600" step="5"' + dis + '>') +
        '<div class="tms-field"><label class="tms-switch"><input type="checkbox" data-setting="breakAutoDeduct"' + (s.breakAutoDeduct ? " checked" : "") + dis + '> Deduct the default break from new entries</label></div>' +
        '<div class="tms-field"><label class="tms-switch"><input type="checkbox" data-setting="requireProject"' + (s.requireProject ? " checked" : "") + dis + '> Require a project on every entry</label></div>' +
        '<div class="tms-field"><label class="tms-switch"><input type="checkbox" data-setting="requireNotes"' + (s.requireNotes ? " checked" : "") + dis + '> Require a note on every entry</label></div>' +
        '<div class="tms-field"><label class="tms-switch"><input type="checkbox" data-setting="allowFutureEntries"' + (s.allowFutureEntries ? " checked" : "") + dis + '> Allow entries dated after today</label></div>' +
      '</div>'
    );

    html += settingsCard("Projects", "Used by the billing mode for client work, rates and budgets.",
      '<div class="tms-config-head"><span>Name</span><span>Client</span><span>Rate</span><span>Budget h</span><span>Active</span><span></span></div>' +
      '<div class="tms-config-list">' + projectsSettingsHtml(manage) + '</div>' +
      '<div style="margin-top:10px"><button type="button" class="tms-btn tms-btn-sm" data-action="add-project"' + dis + '>+ Add project</button></div>'
    );

    html += settingsCard("Activities", "Reusable activity labels for entries and reports.",
      '<div class="tms-config-head is-activity"><span>Name</span><span>Billable by default</span><span></span></div>' +
      '<div class="tms-config-list">' + activitiesSettingsHtml(manage) + '</div>' +
      '<div style="margin-top:10px"><button type="button" class="tms-btn tms-btn-sm" data-action="add-activity"' + dis + '>+ Add activity</button></div>'
    );

    html += settingsCard("Approval and volunteer details", "Used on the submitted timesheet, the audit log and the volunteer certificate.",
      '<div class="tms-form-grid">' +
        settingField("Approver name", '<input type="text" class="tms-input" data-setting="approverName" value="' + esc(s.approverName) + '" maxlength="120"' + dis + '>') +
        settingField("Approver email", '<input type="email" class="tms-input" data-setting="approverEmail" value="' + esc(s.approverEmail) + '" maxlength="160"' + dis + '>') +
        settingField("Volunteer program", '<input type="text" class="tms-input" data-setting="volunteerProgram" value="' + esc(s.volunteerProgram) + '" maxlength="120"' + dis + '>') +
        settingField("Volunteer role", '<input type="text" class="tms-input" data-setting="volunteerRole" value="' + esc(s.volunteerRole) + '" maxlength="120"' + dis + '>') +
        settingField("Volunteer supervisor", '<input type="text" class="tms-input" data-setting="volunteerSupervisor" value="' + esc(s.volunteerSupervisor) + '" maxlength="120"' + dis + '>') +
        settingField("Volunteer hour goal", '<input type="number" class="tms-input" data-setting="volunteerGoalHours" value="' + esc(s.volunteerGoalHours) + '" min="0" step="1"' + dis + '>') +
      '</div>'
    );

    html += settingsCard("Data and size", "One instance should stay well under the 1 MB Firestore document limit.",
      sizeMeterHtml() +
      '<div class="tms-kv"><span>Period entries</span><b>' + periodEntries().length + '</b></div>' +
      '<div class="tms-kv"><span>Entries outside period</span><b>' + outOfPeriodEntries().length + '</b></div>' +
      '<div class="tms-kv"><span>Audit events kept</span><b>' + DB.audit.length + ' / ' + AUDIT_LIMIT + '</b></div>' +
      '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:12px">' +
        '<button type="button" class="tms-btn tms-btn-sm" data-action="export-json">Export JSON backup</button>' +
        '<button type="button" class="tms-btn tms-btn-sm" data-action="import">Import entries</button>' +
        '<button type="button" class="tms-btn tms-btn-sm" data-action="export-csv">Export CSV</button>' +
        (manage ? '<button type="button" class="tms-btn tms-btn-sm tms-btn-danger-soft" data-action="clear-period">Clear this period</button>' : '') +
        (manage ? '<button type="button" class="tms-btn tms-btn-sm" data-action="reset-settings">Reset settings</button>' : '') +
      '</div>' +
      '<div class="tms-settings-note is-info">Monthly instance: roughly 20-60 KB for a normal month. A full year of detailed entries in one document can approach the limit, which is why the recommended unit is one worker and one pay period.</div>'
    );

    host.innerHTML = html;
  }

  function settingsCard(title, sub, body) {
    return '<div class="tms-settings-card"><div class="tms-settings-head"><h2>' + esc(title) + '</h2><p>' + esc(sub) + '</p></div><div class="tms-settings-body">' + body + '</div></div>';
  }

  function settingField(label, control) {
    return '<label class="tms-field"><span>' + esc(label) + '</span>' + control + '</label>';
  }

  function projectsSettingsHtml(manage) {
    if (!DB.settings.projects.length) return '<div class="tms-empty" style="padding:16px">No projects yet. Add one for client billing.</div>';
    var dis = manage ? "" : " disabled";
    return DB.settings.projects.map(function (project, index) {
      return '<div class="tms-config-row" data-project-row="' + index + '">' +
        '<input type="text" class="tms-input" data-project-index="' + index + '" data-project-field="name" value="' + esc(project.name) + '" placeholder="Project name"' + dis + '>' +
        '<input type="text" class="tms-input" data-project-index="' + index + '" data-project-field="client" value="' + esc(project.client) + '" placeholder="Client"' + dis + '>' +
        '<input type="number" class="tms-input" data-project-index="' + index + '" data-project-field="rate" value="' + esc(project.rate) + '" min="0" step="0.01" title="Hourly rate"' + dis + '>' +
        '<input type="number" class="tms-input tms-col-budget" data-project-index="' + index + '" data-project-field="budgetHours" value="' + esc(project.budgetHours) + '" min="0" step="1" title="Budget hours"' + dis + '>' +
        '<label class="tms-switch" style="justify-content:center"><input type="checkbox" data-project-index="' + index + '" data-project-field="active"' + (project.active ? " checked" : "") + dis + '></label>' +
        '<button type="button" class="tms-icon-btn" data-action="remove-project" data-index="' + index + '" title="Remove project"' + dis + '>&times;</button>' +
        '</div>';
    }).join("");
  }

  function activitiesSettingsHtml(manage) {
    if (!DB.settings.activities.length) return '<div class="tms-empty" style="padding:16px">No activities yet.</div>';
    var dis = manage ? "" : " disabled";
    return DB.settings.activities.map(function (activity, index) {
      return '<div class="tms-config-row is-activity" data-activity-row="' + index + '">' +
        '<input type="text" class="tms-input" data-activity-index="' + index + '" data-activity-field="name" value="' + esc(activity.name) + '" placeholder="Activity name"' + dis + '>' +
        '<label class="tms-switch" style="justify-content:center"><input type="checkbox" data-activity-index="' + index + '" data-activity-field="billableDefault"' + (activity.billableDefault ? " checked" : "") + dis + '> Default</label>' +
        '<button type="button" class="tms-icon-btn" data-action="remove-activity" data-index="' + index + '" title="Remove activity"' + dis + '>&times;</button>' +
        '</div>';
    }).join("");
  }

  function sizeMeterHtml() {
    var bytes = estimateBytes();
    var pct = Math.min(100, bytes / 1048576 * 100);
    var cls = bytes >= SIZE_BLOCK ? " is-danger" : (bytes >= SIZE_WARN ? " is-warn" : "");
    return '<div style="display:flex;justify-content:space-between;gap:10px;font-size:12px"><span class="tms-muted">Saved value size</span><b id="tms-size-text">' + Math.round(bytes / 1024) + ' KB of 1024 KB</b></div>' +
      '<div class="tms-size-meter"><div class="tms-size-meter-fill' + cls + '" id="tms-size-fill" style="width:' + Math.max(1, pct) + '%"></div></div>' +
      '<p class="tms-muted" id="tms-size-note" style="font-size:11px;margin-top:5px">' + (bytes >= SIZE_BLOCK ? "At the safe limit. Start a new period record." : (bytes >= SIZE_WARN ? "Getting large. Plan the next period in a new record." : "Comfortably inside the 1 MB document limit.")) + '</p>';
  }

  function modeLabel(id) {
    var found = MODES.filter(function (m) { return m.id === id; })[0];
    return found ? found.label : "Work";
  }

  function modeHint(id) {
    var found = MODES.filter(function (m) { return m.id === id; })[0];
    return found ? found.hint : "";
  }

  /* ── Actions: entries ── */
  function defaultEntryDate() {
    var today = todayISO();
    if (isDateInPeriod(today)) {
      if (!DB.settings.allowFutureEntries && today > DB.settings.periodEnd) return DB.settings.periodEnd;
      return today;
    }
    return DB.settings.periodStart;
  }

  function defaultProjectId() {
    if (DB.ui.clockProjectId && projectById(DB.ui.clockProjectId)) return DB.ui.clockProjectId;
    var active = DB.settings.projects.filter(function (p) { return p.active; })[0];
    return active ? active.id : "";
  }

  function defaultActivityId() {
    if (DB.ui.clockActivityId && activityById(DB.ui.clockActivityId)) return DB.ui.clockActivityId;
    var active = DB.settings.activities.filter(function (a) { return a.active; })[0];
    return active ? active.id : "";
  }

  function openEntryModal(entryId, presetDate) {
    var existing = entryId ? findEntry(entryId) : null;
    var isNew = !existing;
    if (!canEditEntries()) {
      if (existing) { openEntryViewModal(existing); return; }
      notify("This timesheet is locked. A manager can reopen it.", "warning");
      return;
    }
    var entry = existing ? clone(existing) : {
      id: uid(),
      date: presetDate || defaultEntryDate(),
      start: "09:00",
      end: "17:00",
      breakMinutes: DB.settings.breakDefaultMinutes,
      breakPaid: !DB.settings.breakAutoDeduct,
      projectId: defaultProjectId(),
      activityId: defaultActivityId(),
      category: DB.settings.mode === "volunteer" ? "volunteer" : "work",
      billable: DB.settings.mode !== "volunteer",
      rate: null,
      notes: "",
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userName(),
      updatedBy: userName()
    };

    openModal({
      title: isNew ? "Add time entry" : "Edit time entry",
      wide: false,
      body: entryFormHtml(entry, isNew),
      foot: (isNew ? "" : '<button type="button" class="tms-btn tms-btn-danger-soft" id="tms-entry-delete">Delete</button><button type="button" class="tms-btn tms-btn-ghost" id="tms-entry-duplicate">Duplicate</button>') +
        '<span class="tms-foot-spacer"></span>' +
        '<button type="button" class="tms-btn" id="tms-entry-cancel">Cancel</button>' +
        '<button type="button" class="tms-btn tms-btn-primary" id="tms-entry-save">Save entry</button>',
      onMount: function () { mountEntryForm(entry, isNew); }
    });
  }

  function openEntryViewModal(entry) {
    var fields = [
      ["Date", formatDateLong(entry.date)],
      ["Time", fmtTime12(entry.start) + " - " + (entry.end ? fmtTime12(entry.end) : "open")],
      ["Hours", formatDuration(entryRoundedMinutes(entry))],
      ["Break", entry.breakPaid ? entry.breakMinutes + " minutes, paid" : (entry.breakMinutes ? entry.breakMinutes + " minutes unpaid" : "None")],
      ["Project", entryProjectLabel(entry)],
      ["Client", entryProjectClientLabel(entry) || "-"],
      ["Activity", entryActivityLabel(entry) || "-"],
      ["Category", categoryLabel(entry.category)],
      ["Billable", entry.category === "volunteer" ? "No (volunteer)" : (entry.billable ? "Yes" : "No")],
      ["Amount", DB.settings.mode === "volunteer" ? "Hours only" : (entryAmount(entry) ? formatMoney(entryAmount(entry)) : "No rate")],
      ["Tags", (entry.tags || []).join(", ") || "-"]
    ];
    var body = '<div class="tms-form-grid">' + fields.map(function (pair) {
      return '<div class="tms-field"><span>' + esc(pair[0]) + '</span><div style="font-size:13px;color:var(--tms-ink);font-weight:600">' + esc(pair[1]) + '</div></div>';
    }).join("") + '</div>' +
      '<div class="tms-field is-wide" style="margin-top:12px"><span>Note</span><div style="font-size:12.5px;color:var(--tms-ink-2);white-space:pre-wrap">' + esc(entry.notes || "-") + '</div></div>';
    openModal({
      title: "Time entry",
      body: body,
      foot: '<span class="tms-foot-spacer"></span><button type="button" class="tms-btn" id="tms-entry-view-close">Close</button>',
      onMount: function () { $("#tms-entry-view-close").addEventListener("click", closeModal); }
    });
  }

  function categoryLabel(id) {
    var found = CATEGORIES.filter(function (c) { return c.id === id; })[0];
    return found ? found.label : id;
  }

  function entryFormHtml(entry, isNew) {
    var maxDate = DB.settings.allowFutureEntries ? DB.settings.periodEnd : (todayISO() < DB.settings.periodEnd ? todayISO() : DB.settings.periodEnd);
    var projectOptionsHtml = projectOptions(entry.projectId).map(function (option) {
      return '<option value="' + esc(option.value) + '"' + (option.value === entry.projectId ? " selected" : "") + '>' + esc(option.label) + '</option>';
    }).join("");
    var activityOptionsHtml = activityOptions(entry.activityId).map(function (option) {
      return '<option value="' + esc(option.value) + '"' + (option.value === entry.activityId ? " selected" : "") + '>' + esc(option.label) + '</option>';
    }).join("");
    return '<div class="tms-form-grid">' +
      settingField("Date", '<input type="date" class="tms-input" id="tms-entry-date" value="' + esc(entry.date) + '" min="' + esc(DB.settings.periodStart) + '" max="' + esc(maxDate) + '">') +
      settingField("Project", '<select class="tms-select" id="tms-entry-project">' + projectOptionsHtml + '</select>') +
      settingField("Start time", '<input type="time" class="tms-input" id="tms-entry-start" value="' + esc(entry.start) + '" step="60">') +
      settingField("End time", '<input type="time" class="tms-input" id="tms-entry-end" value="' + esc(entry.end) + '" step="60">') +
      settingField("Unpaid break (minutes)", '<input type="number" class="tms-input" id="tms-entry-break" value="' + esc(entry.breakMinutes) + '" min="0" max="600" step="5">') +
      '<div class="tms-field"><label class="tms-switch"><input type="checkbox" id="tms-entry-break-paid"' + (entry.breakPaid ? " checked" : "") + '> Break is paid</label></div>' +
      settingField("Activity", '<select class="tms-select" id="tms-entry-activity">' + activityOptionsHtml + '</select>') +
      settingField("Category", '<select class="tms-select" id="tms-entry-category">' + CATEGORIES.map(function (c) { return '<option value="' + c.id + '"' + (entry.category === c.id ? " selected" : "") + '>' + esc(c.label) + '</option>'; }).join("") + '</select>') +
      '<div class="tms-field is-wide"><label class="tms-switch"><input type="checkbox" id="tms-entry-billable"' + (entry.billable ? " checked" : "") + '> Billable time</label></div>' +
      '<div class="tms-field is-wide"><span>Note (optional)</span><textarea class="tms-textarea" id="tms-entry-notes" maxlength="' + ENTRY_NOTE_MAX + '" placeholder="What was done, for whom, any reference">' + esc(entry.notes) + '</textarea></div>' +
      settingField("Tags (comma separated)", '<input type="text" class="tms-input" id="tms-entry-tags" value="' + esc((entry.tags || []).join(", ")) + '" placeholder="travel, urgent, client-a">') +
      '<div class="tms-field is-wide"><div class="tms-duration-preview" id="tms-entry-preview"></div><div class="tms-form-error tms-hidden" id="tms-entry-error"></div></div>' +
      '</div>';
  }

  function mountEntryForm(entry, isNew) {
    function refreshPreview() {
      var preview = clone(entry);
      preview.start = ($("#tms-entry-start") || {}).value || "";
      preview.end = ($("#tms-entry-end") || {}).value || "";
      preview.breakMinutes = num(($("#tms-entry-break") || {}).value);
      preview.breakPaid = !!($("#tms-entry-break-paid") || {}).checked;
      var minutes = entryRoundedMinutes(preview);
      var raw = entryRawMinutes(preview);
      var host = $("#tms-entry-preview");
      if (!host) return;
      if (!preview.start || !preview.end) {
        host.innerHTML = "Add a start and end time to see the duration.";
        return;
      }
      var overnight = timeToMinutes(preview.end) < timeToMinutes(preview.start) ? " (overnight, +1 day)" : "";
      host.innerHTML = formatDuration(minutes) + " net" + overnight +
        '<small>' + (preview.breakPaid ? "Paid break, not deducted" : (preview.breakMinutes ? preview.breakMinutes + " minutes unpaid break deducted" : "No unpaid break")) +
        ' · exact ' + formatDuration(raw) + (roundingStep() ? " · rounded using " + roundingLabel() : "") + '</small>';
    }

    ["tms-entry-start", "tms-entry-end", "tms-entry-break", "tms-entry-break-paid"].forEach(function (id) {
      var node = $("#" + id);
      if (node) {
        node.addEventListener("input", refreshPreview);
        node.addEventListener("change", refreshPreview);
      }
    });
    var category = $("#tms-entry-category");
    var billable = $("#tms-entry-billable");
    if (category && billable) {
      category.addEventListener("change", function () {
        if (category.value === "volunteer") {
          billable.checked = false;
          billable.disabled = true;
        } else {
          billable.disabled = false;
          if (!billable.checked) billable.checked = true;
        }
        refreshPreview();
      });
      if (category.value === "volunteer") billable.disabled = true;
    }
    refreshPreview();

    var cancel = $("#tms-entry-cancel");
    if (cancel) cancel.addEventListener("click", closeModal);
    var save = $("#tms-entry-save");
    if (save) save.addEventListener("click", function () { saveEntryForm(entry, isNew); });
    var remove = $("#tms-entry-delete");
    if (remove) remove.addEventListener("click", function () {
      confirmAction("Delete this entry?", "The entry will be removed from this timesheet. This cannot be undone.", "Delete", true, function () {
        DB.entries = DB.entries.filter(function (item) { return item.id !== entry.id; });
        addAudit("Entry deleted", entry.date + " · " + (projectName(entry.projectId) || "No project") + " · " + fmtTime12(entry.start) + "-" + fmtTime12(entry.end));
        persistNow();
        closeModal();
        renderAll();
        notify("Entry deleted.", "success");
      });
    });
    var duplicate = $("#tms-entry-duplicate");
    if (duplicate) duplicate.addEventListener("click", function () {
      var copy = clone(entry);
      copy.id = uid();
      copy.createdAt = new Date().toISOString();
      copy.updatedAt = new Date().toISOString();
      copy.createdBy = userName();
      copy.updatedBy = userName();
      DB.entries.push(copy);
      addAudit("Entry duplicated", copy.date + " · " + (projectName(copy.projectId) || "No project"));
      persistNow();
      closeModal();
      renderAll();
      notify("Entry duplicated.", "success");
    });
  }

  function roundingLabel() {
    var found = ROUNDING_OPTIONS.filter(function (option) { return option.id === DB.settings.rounding; })[0];
    return found ? found.label.toLowerCase() : "no rounding";
  }

  function saveEntryForm(entry, isNew) {
    var errorHost = $("#tms-entry-error");
    function fail(message) {
      if (errorHost) { errorHost.textContent = message; errorHost.classList.remove("tms-hidden"); }
      return false;
    }
    if (errorHost) { errorHost.textContent = ""; errorHost.classList.add("tms-hidden"); }

    var date = normalizeDate(($("#tms-entry-date") || {}).value);
    var start = normalizeTime(($("#tms-entry-start") || {}).value);
    var end = normalizeTime(($("#tms-entry-end") || {}).value);
    var breakMinutes = clamp(($("#tms-entry-break") || {}).value, 0, 600);
    var breakPaid = !!($("#tms-entry-break-paid") || {}).checked;
    var projectId = ($("#tms-entry-project") || {}).value || "";
    var activityId = ($("#tms-entry-activity") || {}).value || "";
    var category = ($("#tms-entry-category") || {}).value || "work";
    var billable = !!($("#tms-entry-billable") || {}).checked;
    var notes = String(($("#tms-entry-notes") || {}).value || "").slice(0, ENTRY_NOTE_MAX);
    var tags = String(($("#tms-entry-tags") || {}).value || "").split(/[,;|]/).map(function (tag) { return tag.trim().slice(0, ENTRY_TAG_LENGTH_MAX); }).filter(Boolean);

    if (!date) return fail("Choose a valid date.");
    if (date < DB.settings.periodStart || date > DB.settings.periodEnd) return fail("Date must be inside the period (" + DB.settings.periodStart + " to " + DB.settings.periodEnd + ").");
    if (!DB.settings.allowFutureEntries && date > todayISO()) return fail("Future entries are turned off. Enable them in Settings or choose today or earlier.");
    if (!start) return fail("Enter a valid start time.");
    if (!end) return fail("Enter a valid end time.");
    if (start === end) return fail("Start and end time cannot be the same.");
    var duration = (timeToMinutes(end) - timeToMinutes(start) + 1440) % 1440;
    if (duration === 0) return fail("Start and end time cannot be the same.");
    if (!breakPaid && breakMinutes >= duration) return fail("Unpaid break must be shorter than the shift.");
    if (DB.settings.requireProject && !projectId) return fail("This timesheet requires a project on every entry.");
    if (DB.settings.requireNotes && !notes.trim()) return fail("This timesheet requires a note on every entry.");

    var now = new Date().toISOString();
    var target = isNew ? null : findEntry(entry.id);
    if (!target) {
      target = {
        id: entry.id || uid(),
        createdAt: now,
        createdBy: userName()
      };
      DB.entries.push(target);
    }
    target.date = date;
    target.start = start;
    target.end = end;
    target.breakMinutes = breakMinutes;
    target.breakPaid = breakPaid;
    target.projectId = projectId;
    target.activityId = activityId;
    target.category = category;
    target.billable = category === "volunteer" ? false : billable;
    target.rate = target.rate === undefined ? null : target.rate;
    var project = projectById(projectId);
    var activity = activityById(activityId);
    target.projectName = project ? project.name : "";
    target.projectClient = project ? project.client : "";
    target.activityName = activity ? activity.name : "";
    target.notes = notes;
    target.tags = tags.slice(0, ENTRY_TAGS_MAX);
    target.updatedAt = now;
    target.updatedBy = userName();

    addAudit(isNew ? "Entry added" : "Entry edited", date + " · " + fmtTime12(start) + "-" + fmtTime12(end) + " · " + (projectName(projectId) || "No project"));
    persistNow();
    closeModal();
    renderAll();
    notify(isNew ? "Entry added." : "Entry saved.", "success");
    return true;
  }

  function copyPreviousDay() {
    if (!canEditEntries()) { notify("This timesheet is locked.", "warning"); return; }
    var targetDate = defaultEntryDate();
    var candidates = DB.entries.filter(function (entry) { return entry.date < targetDate; }).sort(compareEntries);
    if (!candidates.length) { notify("No earlier day to copy from.", "warning"); return; }
    var sourceDate = candidates[candidates.length - 1].date;
    var sourceEntries = DB.entries.filter(function (entry) { return entry.date === sourceDate; });
    if (!sourceEntries.length) { notify("The previous day has no entries.", "warning"); return; }
    var copies = sourceEntries.map(function (entry) {
      var copy = clone(entry);
      copy.id = uid();
      copy.date = targetDate;
      copy.createdAt = new Date().toISOString();
      copy.updatedAt = new Date().toISOString();
      copy.createdBy = userName();
      copy.updatedBy = userName();
      return copy;
    });
    DB.entries = DB.entries.concat(copies);
    addAudit("Previous day copied", sourceDate + " to " + targetDate + " · " + copies.length + " entries");
    persistNow();
    renderAll();
    notify(copies.length + " entries copied from " + formatDateCompact(sourceDate) + ".", "success");
  }

  /* ── Actions: clock ── */
  function clockIn() {
    if (!canEditEntries()) { notify("This timesheet is locked.", "warning"); return; }
    var open = openEntry();
    if (open) { openClockOutConfirm(open); return; }
    var today = todayISO();
    if (!isDateInPeriod(today)) { notify("Today is outside this period. Change the period or add a manual entry.", "warning"); return; }
    var projectId = ($("#tms-clock-project") || {}).value || "";
    var activityId = ($("#tms-clock-activity") || {}).value || "";
    var breakMinutes = clamp(($("#tms-clock-break") || {}).value, 0, 600);
    var notes = String(($("#tms-clock-notes") || {}).value || "").slice(0, 240);
    if (DB.settings.requireProject && !projectId) { notify("This timesheet requires a project. Choose one first.", "warning"); return; }
    var now = new Date();
    var entry = {
      id: uid(),
      date: today,
      start: pad2(now.getHours()) + ":" + pad2(now.getMinutes()),
      end: "",
      breakMinutes: breakMinutes,
      breakPaid: !DB.settings.breakAutoDeduct,
      projectId: projectId,
      projectName: projectName(projectId),
      projectClient: (projectById(projectId) || {}).client || "",
      activityId: activityId,
      activityName: activityName(activityId),
      category: DB.settings.mode === "volunteer" ? "volunteer" : "work",
      billable: DB.settings.mode !== "volunteer",
      rate: null,
      notes: notes,
      tags: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdBy: userName(),
      updatedBy: userName()
    };
    DB.entries.push(entry);
    DB.ui.clockProjectId = projectId;
    DB.ui.clockActivityId = activityId;
    DB.ui.clockBreakMinutes = breakMinutes;
    addAudit("Clocked in", entry.date + " " + fmtTime12(entry.start) + " · " + (projectName(projectId) || "No project"));
    persistNow();
    renderAll();
    notify("Clocked in at " + fmtTime12(entry.start) + ".", "success");
  }

  function openClockOutConfirm(entry) {
    var elapsed = elapsedMinutesSinceStart(entry);
    if (elapsed > 16 * 60) {
      confirmAction("Clock out a long shift?", "This entry has been open for " + formatDuration(elapsed) + ". Clock out anyway, or fix the start time first.", "Clock out", false, function () {
        clockOut(entry);
      });
      return;
    }
    clockOut(entry);
  }

  function clockOut(entry) {
    if (!canEditEntries()) { notify("This timesheet is locked.", "warning"); return; }
    var now = new Date();
    entry.end = pad2(now.getHours()) + ":" + pad2(now.getMinutes());
    entry.breakMinutes = clamp(($("#tms-clock-break") || {}).value, 0, 600);
    entry.breakPaid = !DB.settings.breakAutoDeduct;
    entry.updatedAt = now.toISOString();
    entry.updatedBy = userName();
    DB.ui.clockBreakMinutes = entry.breakMinutes;
    addAudit("Clocked out", entry.date + " " + fmtTime12(entry.start) + "-" + fmtTime12(entry.end) + " · " + formatDuration(entryRoundedMinutes(entry)));
    persistNow();
    renderAll();
    notify("Clocked out. " + formatDuration(entryRoundedMinutes(entry)) + " recorded.", "success");
  }

  /* ── Approvals ── */
  function submitPeriod() {
    if (!canWrite()) { notify("You do not have permission to submit.", "warning"); return; }
    if (!periodIsEditableByWorker() && !canManage()) { notify("This period is already submitted.", "warning"); return; }
    var entries = periodEntries();
    if (!entries.length) { notify("Add at least one entry before submitting.", "warning"); return; }
    var open = entries.filter(function (entry) { return !entry.end; });
    if (open.length) { notify("Fix the open entry before submitting.", "warning"); return; }
    DB.timesheet.status = "submitted";
    DB.timesheet.submittedAt = new Date().toISOString();
    DB.timesheet.submittedBy = userName();
    DB.timesheet.rejectedAt = "";
    DB.timesheet.rejectedBy = "";
    DB.timesheet.rejectionReason = "";
    addAudit("Timesheet submitted", formatDuration(_currentStats ? _currentStats.totalMinutes : 0) + " · " + entries.length + " entries");
    persistNow();
    renderAll();
    notify("Timesheet submitted for approval.", "success");
  }

  function approvePeriod() {
    if (!canManage()) { notify("Only a manager can approve.", "warning"); return; }
    if (!periodIsSubmitted()) { notify("This timesheet is not waiting for approval.", "warning"); return; }
    DB.timesheet.status = "approved";
    DB.timesheet.approvedAt = new Date().toISOString();
    DB.timesheet.approvedBy = userName() || DB.settings.approverName || "Manager";
    addAudit("Timesheet approved", (DB.settings.approverName ? "Approver: " + DB.settings.approverName : "Approved"));
    persistNow();
    renderAll();
    notify("Timesheet approved.", "success");
  }

  function openRejectModal() {
    if (!canManage()) { notify("Only a manager can return a timesheet.", "warning"); return; }
    if (!periodIsSubmitted()) { notify("This timesheet is not waiting for approval.", "warning"); return; }
    openModal({
      title: "Return timesheet",
      body: '<label class="tms-field"><span>Reason for returning</span><textarea class="tms-textarea" id="tms-reject-reason" placeholder="What needs to be fixed?"></textarea></label>' +
        '<div class="tms-form-error tms-hidden" id="tms-reject-error"></div>',
      foot: '<span class="tms-foot-spacer"></span><button type="button" class="tms-btn" id="tms-reject-cancel">Cancel</button><button type="button" class="tms-btn tms-btn-danger" id="tms-reject-confirm">Return for changes</button>',
      onMount: function () {
        $("#tms-reject-cancel").addEventListener("click", closeModal);
        $("#tms-reject-confirm").addEventListener("click", function () {
          var reason = String(($("#tms-reject-reason") || {}).value || "").trim();
          var error = $("#tms-reject-error");
          if (!reason) {
            if (error) { error.textContent = "Enter a short reason so the worker knows what to fix."; error.classList.remove("tms-hidden"); }
            return;
          }
          DB.timesheet.status = "rejected";
          DB.timesheet.rejectedAt = new Date().toISOString();
          DB.timesheet.rejectedBy = userName();
          DB.timesheet.rejectionReason = reason.slice(0, 300);
          addAudit("Timesheet returned", reason.slice(0, 300));
          persistNow();
          closeModal();
          renderAll();
          notify("Timesheet returned to the worker.", "success");
        });
      }
    });
  }

  function recallSubmission() {
    if (!canWrite()) return;
    if (!periodIsSubmitted()) return;
    DB.timesheet.status = "draft";
    DB.timesheet.submittedAt = "";
    DB.timesheet.submittedBy = "";
    addAudit("Submission recalled", "Timesheet returned to draft");
    persistNow();
    renderAll();
    notify("Submission recalled. You can edit again.", "info");
  }

  function reopenApproved() {
    if (!canManage()) return;
    if (!periodIsApproved()) return;
    confirmAction("Reopen an approved timesheet?", "The period will return to draft so entries can be corrected. The approval is kept in the audit log.", "Reopen", false, function () {
      DB.timesheet.status = "draft";
      DB.timesheet.approvedAt = "";
      DB.timesheet.approvedBy = "";
      DB.timesheet.reopenedAt = new Date().toISOString();
      DB.timesheet.reopenedBy = userName();
      addAudit("Approved timesheet reopened", "Returned to draft");
      persistNow();
      renderAll();
      notify("Timesheet reopened.", "info");
    });
  }

  function handleSubmitButton() {
    var status = currentStatus();
    if (status === "submitted") {
      if (canManage()) approvePeriod();
      else notify("Waiting for approval.", "info");
      return;
    }
    if (status === "approved") {
      if (canManage()) reopenApproved();
      else notify("This timesheet is approved.", "info");
      return;
    }
    if (status === "rejected") {
      if (canWrite()) submitPeriod();
      return;
    }
    if (canWrite()) submitPeriod();
  }

  function updateActionButtons() {
    var add = $("#tms-btn-add-entry");
    if (add) {
      add.disabled = !canEditEntries();
      add.title = canEditEntries() ? "Add a manual time entry" : "This timesheet is locked";
    }
    var submit = $("#tms-btn-submit");
    if (submit) {
      var status = currentStatus();
      var label = "Submit";
      var disabled = false;
      if (status === "submitted") { label = canManage() ? "Approve" : "Submitted"; disabled = !canManage(); }
      else if (status === "approved") { label = canManage() ? "Reopen" : "Approved"; disabled = !canManage(); }
      else if (status === "rejected") { label = "Resubmit"; disabled = !canEditEntries(); }
      else { label = "Submit"; disabled = !canSubmitPeriod(); }
      submit.textContent = label;
      submit.disabled = disabled;
    }
  }

  /* ── Export / import ── */
  function buildCsv() {
    var entries = periodEntries();
    var header = ["Date", "Day", "Start", "End", "Break minutes", "Break paid", "Net hours", "Exact hours", "Overtime hours", "Billable", "Project", "Client", "Activity", "Category", "Tags", "Notes", "Amount", "Status"];
    var rows = [header];
    entries.forEach(function (entry) {
      var project = projectById(entry.projectId);
      var activity = activityById(entry.activityId);
      var ot = _currentStats && _currentStats.entryOT ? (_currentStats.entryOT[entry.id] || 0) : 0;
      rows.push([
        entry.date,
        DAY_NAMES[parseISODate(entry.date).getDay()],
        entry.start,
        entry.end,
        entry.breakMinutes,
        entry.breakPaid ? "Yes" : "No",
        formatHours(entryRoundedMinutes(entry)),
        formatHours(entryRawMinutes(entry)),
        formatHours(ot),
        entry.category === "volunteer" ? "No" : (entry.billable ? "Yes" : "No"),
        entryProjectLabel(entry),
        entryProjectClientLabel(entry),
        entryActivityLabel(entry),
        entry.category,
        (entry.tags || []).join("; "),
        entry.notes,
        DB.settings.mode === "volunteer" ? "" : entryAmount(entry).toFixed(2),
        currentStatus()
      ]);
    });
    return rows.map(function (row) {
      return row.map(function (cell) { return "\"" + String(cell == null ? "" : cell).replace(/"/g, "\"\"") + "\""; }).join(",");
    }).join("\r\n");
  }

  function exportCsv() {
    if (!periodEntries().length) { notify("Nothing to export yet.", "warning"); return; }
    var filename = "timesheet-" + DB.settings.periodStart + "-to-" + DB.settings.periodEnd + ".csv";
    downloadText(filename, "\ufeff" + buildCsv(), "text/csv;charset=utf-8");
  }

  function buildJsonBackup() {
    return JSON.stringify({
      schema: SCHEMA,
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      settings: DB.settings,
      entries: DB.entries,
      timesheet: DB.timesheet,
      audit: DB.audit
    }, null, 2);
  }

  function exportJson() {
    var filename = "timesheet-backup-" + DB.settings.periodStart + "-to-" + DB.settings.periodEnd + ".json";
    downloadText(filename, buildJsonBackup(), "application/json;charset=utf-8");
  }

  function downloadText(filename, text, mime) {
    try {
      var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 1500);
      notify("Downloaded " + filename, "success");
    } catch (e) {
      notify("Download is not available in this browser.", "error");
    }
  }

  function openImportModal() {
    if (!canEditEntries()) { notify("This timesheet is locked.", "warning"); return; }
    openModal({
      title: "Import time entries",
      wide: true,
      body: '<p class="tms-import-hint">Paste a JSON backup or CSV. JSON accepts the backup from this tool or an array of entries. CSV accepts a header row with Date, Start, End, Break, Project, Activity, Notes (or the full export columns).</p>' +
        '<textarea class="tms-textarea tms-import-text" id="tms-import-text" placeholder="Date,Start,End,Break,Project,Activity,Notes&#10;2026-11-03,09:00,17:00,30,General,Client work,Discovery call"></textarea>' +
        '<div class="tms-form-error tms-hidden" id="tms-import-error"></div>',
      foot: '<span class="tms-foot-spacer"></span><button type="button" class="tms-btn" id="tms-import-cancel">Cancel</button><button type="button" class="tms-btn tms-btn-primary" id="tms-import-confirm">Import</button>',
      onMount: function () {
        $("#tms-import-cancel").addEventListener("click", closeModal);
        $("#tms-import-confirm").addEventListener("click", doImport);
      }
    });
  }

  function doImport() {
    var text = String(($("#tms-import-text") || {}).value || "").trim();
    var error = $("#tms-import-error");
    if (!text) { showImportError("Paste JSON or CSV first."); return; }
    var entries = [];
    var skipped = 0;
    try {
      if (text.charAt(0) === "{" || text.charAt(0) === "[") {
        var parsed = JSON.parse(text);
        var source = Array.isArray(parsed) ? parsed : (parsed.entries || []);
        source.forEach(function (raw) {
          var entry = normalizeEntry(raw, DB.settings);
          if (entry) entries.push(entry); else skipped += 1;
        });
      } else {
        var rows = parseCsv(text);
        var header = rows.shift() || [];
        var map = csvHeaderMap(header);
        rows.forEach(function (row) {
          if (!row.length || !row.join("").trim()) return;
          var raw = csvRowToEntry(row, map);
          var entry = normalizeEntry(raw, DB.settings);
          if (entry) entries.push(entry); else skipped += 1;
        });
      }
    } catch (e) {
      showImportError("Could not read that data: " + (e && e.message ? e.message : "invalid format"));
      return;
    }
    if (!entries.length) { showImportError("No valid entries found. Check the date and time columns."); return; }
    var existing = {};
    DB.entries.forEach(function (entry) { existing[entry.id] = entry; });
    entries.forEach(function (entry) {
      if (existing[entry.id]) {
        var target = existing[entry.id];
        Object.keys(entry).forEach(function (key) { target[key] = entry[key]; });
      } else {
        DB.entries.push(entry);
      }
    });
    addAudit("Entries imported", entries.length + " entries" + (skipped ? ", " + skipped + " skipped" : ""));
    persistNow();
    closeModal();
    renderAll();
    notify(entries.length + " entries imported" + (skipped ? " (" + skipped + " skipped)" : "") + ".", "success");
  }

  function showImportError(message) {
    var error = $("#tms-import-error");
    if (error) { error.textContent = message; error.classList.remove("tms-hidden"); }
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i += 1; }
          else inQuotes = false;
        } else field += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field); field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text.charAt(i + 1) === "\n") i += 1;
        row.push(field); field = "";
        rows.push(row); row = [];
      } else {
        field += ch;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function csvHeaderMap(header) {
    var map = {};
    header.forEach(function (cell, index) {
      var key = String(cell || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (key === "date" || key === "day") map.date = index;
      else if (key === "start" || key === "starttime" || key === "timein" || key === "clockin") map.start = index;
      else if (key === "end" || key === "endtime" || key === "timeout" || key === "clockout") map.end = index;
      else if (key === "break" || key === "breakminutes" || key === "breakmins" || key === "unpaidbreak") map.break = index;
      else if (key === "breakpaid" || key === "paidbreak") map.breakPaid = index;
      else if (key === "project" || key === "projectname") map.project = index;
      else if (key === "activity" || key === "activityname" || key === "task") map.activity = index;
      else if (key === "category" || key === "type") map.category = index;
      else if (key === "billable" || key === "billablehours") map.billable = index;
      else if (key === "notes" || key === "note" || key === "description" || key === "comment") map.notes = index;
      else if (key === "tags" || key === "label" || key === "labels") map.tags = index;
      else if (key === "id") map.id = index;
    });
    if (map.date === undefined) {
      map = { date: 0, start: 1, end: 2, break: 3, project: 4, activity: 5, notes: 6 };
      if (header.length > 7) map.tags = 7;
    }
    return map;
  }

  function csvRowToEntry(row, map) {
    function cell(key) { return map[key] === undefined ? "" : String(row[map[key]] == null ? "" : row[map[key]]).trim(); }
    var projectNameValue = cell("project");
    var activityNameValue = cell("activity");
    var billableValue = cell("billable").toLowerCase();
    var raw = {
      id: cell("id") || uid(),
      date: cell("date"),
      start: cell("start"),
      end: cell("end"),
      breakMinutes: cell("break"),
      breakPaid: /^(yes|true|1|paid)$/i.test(cell("breakPaid")),
      projectId: findOrCreateProject(projectNameValue),
      activityId: findOrCreateActivity(activityNameValue),
      category: cell("category") || "work",
      billable: billableValue ? /^(yes|true|1|billable)$/i.test(billableValue) : true,
      notes: cell("notes"),
      tags: cell("tags")
    };
    return raw;
  }

  /* ── Print / PDF ── */
  function printCurrentReport() {
    var html = buildPrintDocument(_reportTab);
    var filename = "timesheet-" + DB.settings.periodStart + "-to-" + DB.settings.periodEnd + "-" + _reportTab;
    printHtml(html, filename);
  }

  function printCertificate() {
    var stats = _currentStats || computeStats(periodEntries());
    if (!stats.volunteerMinutes) { notify("There are no volunteer hours to certify.", "warning"); return; }
    var html = buildCertificateDocument(stats);
    printHtml(html, "volunteer-hours-" + DB.settings.periodStart + "-to-" + DB.settings.periodEnd);
  }

  function printHtml(html, filename) {
    if (typeof tool.requestExportPdf === "function") {
      try {
        tool.requestExportPdf({ html: html, filename: filename, landscape: false }, function (err, file) {
          if (!err && file && file.url) {
            notify("Print view ready. Open the file and print or save as PDF.", "success");
            try { if (typeof tool.openUrl === "function") tool.openUrl(file.url); } catch (e) {}
          } else {
            openFallbackPrint(html);
          }
        });
        return;
      } catch (e) {}
    }
    openFallbackPrint(html);
  }

  function openFallbackPrint(html) {
    try {
      var blob = new Blob([html], { type: "text/html;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      if (typeof tool.openUrl === "function") {
        tool.openUrl(url);
        notify("Print view opened in a new tab.", "success");
      } else {
        var win = window.open(url, "_blank");
        if (!win) notify("Allow pop-ups to open the print view.", "warning");
      }
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 60000);
    } catch (e) {
      notify("Could not open the print view.", "error");
    }
  }

  function buildPrintDocument(kind) {
    var stats = _currentStats || computeStats(periodEntries());
    var content = buildReportContent(kind, true, stats);
    var title = "Timesheet report - " + (DB.settings.workerName || "Worker");
    return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>" + esc(title) + "</title><style>" + printStyles() + "</style></head><body>" +
      '<div class="print-head">' +
        '<div class="print-org">' + esc(DB.settings.organizationName || "Organization") + '</div>' +
        '<h1>' + esc(title) + '</h1>' +
        '<div class="print-meta">' + esc(DB.settings.workerName || "Worker") + ' · ' + esc(formatDateShort(DB.settings.periodStart)) + " to " + esc(formatDateShort(DB.settings.periodEnd)) + ' · ' + esc(periodTypeLabel(DB.settings.periodType)) + ' · ' + esc(statusMeta().label) + '</div>' +
      '</div>' +
      content +
      '<div class="print-foot">Generated ' + esc(formatDateTime(new Date().toISOString())) + ' · TimeLedger tool build ' + esc(TOOL_BUILD) + '</div>' +
      '</body></html>';
  }

  function buildCertificateDocument(stats) {
    var worker = DB.settings.workerName || "Volunteer";
    var org = DB.settings.organizationName || "Organization";
    var program = DB.settings.volunteerProgram || "Volunteer program";
    var role = DB.settings.volunteerRole || "Volunteer";
    var supervisor = DB.settings.volunteerSupervisor || DB.settings.approverName || "";
    var hours = formatDurationLong(stats.volunteerMinutes);
    var period = formatDateShort(DB.settings.periodStart) + " to " + formatDateShort(DB.settings.periodEnd);
    return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Certificate of volunteer hours</title><style>" + certificateStyles() + "</style></head><body>" +
      '<div class="cert-frame">' +
        '<div class="cert-kicker">Certificate of volunteer service</div>' +
        '<h1>' + esc(worker) + '</h1>' +
        '<p class="cert-lead">For contributing <b>' + esc(hours) + '</b> of documented volunteer time to <b>' + esc(program) + '</b>.</p>' +
        '<div class="cert-grid">' +
          '<div><span>Organization</span><b>' + esc(org) + '</b></div>' +
          '<div><span>Role</span><b>' + esc(role) + '</b></div>' +
          '<div><span>Period</span><b>' + esc(period) + '</b></div>' +
          '<div><span>Days served</span><b>' + esc(String(stats.daysWorked)) + '</b></div>' +
        '</div>' +
        '<p class="cert-note">This certificate is generated from the timesheet record and the approval status in the tool. Keep the signed copy for school, club or program records.</p>' +
        '<div class="cert-signatures">' +
          '<div><div class="cert-line"></div><span>Volunteer signature</span></div>' +
          '<div><div class="cert-line"></div><span>Supervisor' + (supervisor ? " - " + esc(supervisor) : "") + '</span></div>' +
        '</div>' +
        '<div class="cert-foot">Issued ' + esc(formatDateShort(todayISO())) + ' · TimeLedger tool build ' + esc(TOOL_BUILD) + '</div>' +
      '</div>' +
      '</body></html>';
  }

  function printStyles() {
    return [
      "@page{size:A4;margin:14mm}",
      "*{box-sizing:border-box}",
      "body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#0f172a;font-size:11pt;line-height:1.45;margin:0;background:#fff}",
      ".print-head{border-bottom:3px solid #0f766e;padding-bottom:12px;margin-bottom:16px}",
      ".print-org{font-size:9pt;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#0f766e}",
      ".print-head h1{font-size:20pt;margin:4px 0 2px;letter-spacing:-.3px}",
      ".print-meta{font-size:9pt;color:#64748b}",
      ".print-foot{margin-top:18px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:8pt;color:#94a3b8}",
      ".tms-report-hero{background:#0d3c48!important;color:#e9fbfb;padding:14px 16px;border-radius:8px;display:flex;gap:18px;justify-content:space-between;align-items:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}",
      ".tms-rh-kicker{font-size:8pt;letter-spacing:1px;text-transform:uppercase;color:#7dd3c8;font-weight:700}",
      ".tms-rh-title{font-size:16pt;font-weight:800;color:#fff;margin-top:2px}",
      ".tms-rh-meta{font-size:9pt;color:#a9d8dd;margin-top:2px}",
      ".tms-rh-total{text-align:right}.tms-rh-total b{display:block;font-size:22pt;color:#fff}.tms-rh-total span{font-size:8pt;color:#a9d8dd}",
      ".tms-report-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:12px 0}",
      ".tms-report-metric{border:1px solid #e2e8f0;border-radius:6px;padding:7px 8px;background:#fbfcfe}",
      ".tms-report-metric span{display:block;font-size:7.5pt;text-transform:uppercase;letter-spacing:.4px;color:#64748b;font-weight:700}",
      ".tms-report-metric b{display:block;font-size:11pt;margin-top:2px}",
      ".tms-report-metric small{display:block;font-size:7.5pt;color:#64748b}",
      ".tms-report-card{border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-top:10px;page-break-inside:avoid}",
      ".tms-report-card h2{font-size:11pt;margin:0 0 2px}",
      ".tms-report-sub{font-size:8pt;color:#64748b;margin:0 0 8px}",
      ".tms-table{width:100%;border-collapse:collapse;font-size:8.5pt}",
      ".tms-table th{text-align:left;background:#f1f5f9;color:#475569;font-size:7pt;text-transform:uppercase;letter-spacing:.4px;padding:5px 6px;border-bottom:1px solid #cbd5e1}",
      ".tms-table td{padding:5px 6px;border-bottom:1px solid #eef2f7;vertical-align:top}",
      ".tms-table tfoot td{border-top:2px solid #cbd5e1;background:#f8fafc;font-weight:700}",
      ".is-num{text-align:right;white-space:nowrap}",
      ".tms-status{display:inline-block;padding:1px 7px;border-radius:999px;font-size:7.5pt;font-weight:700;border:1px solid #cbd5e1;background:#f1f5f9;color:#475569}",
      ".tms-status.is-approved{background:#e6f4ea;color:#15803d;border-color:#b7dfc2}",
      ".tms-status.is-submitted{background:#fdf3df;color:#b45309;border-color:#eed8a6}",
      ".tms-status.is-rejected{background:#fbeaea;color:#b91c1c;border-color:#eab4b4}",
      ".tms-chip{display:inline-block;padding:0 5px;border-radius:999px;font-size:7pt;font-weight:700;border:1px solid #e2e8f0;background:#f8fafc;color:#475569}",
      ".tms-bar-row{display:grid;grid-template-columns:120px 1fr 80px;gap:8px;align-items:center;font-size:8.5pt;padding:3px 0}",
      ".tms-bar-track{height:6px;background:#eef2f7;border-radius:999px;overflow:hidden}",
      ".tms-bar-fill{height:100%;background:#0f766e;border-radius:999px}",
      ".tms-bar-value{text-align:right;font-weight:700}",
      ".tms-empty{padding:14px;text-align:center;color:#64748b;font-size:9pt}",
      ".tms-approval-line{font-size:8.5pt;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px;margin-top:8px}",
      ".tms-signature-row{display:flex;gap:36px;margin-top:18px}",
      ".tms-signature{flex:1}.tms-sign-line{height:1px;background:#94a3b8;margin-top:26px}",
      ".tms-signature span{display:block;margin-top:4px;font-size:8pt;color:#64748b}",
      ".tms-size-meter{display:none}",
      ".tms-alert{display:none}",
      "h1,h2,h3{page-break-after:avoid}",
      "tr{page-break-inside:avoid}"
    ].join("\n");
  }

  function certificateStyles() {
    return [
      "@page{size:A4;margin:16mm}",
      "*{box-sizing:border-box}",
      "body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#0f172a;margin:0;background:#fff}",
      ".cert-frame{border:2px solid #0f766e;border-radius:14px;padding:34px 38px;position:relative;min-height:245mm}",
      ".cert-frame::before{content:'';position:absolute;inset:10px;border:1px solid #b7dfc2;border-radius:10px;pointer-events:none}",
      ".cert-kicker{font-size:10pt;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#0f766e;text-align:center}",
      "h1{font-size:30pt;text-align:center;margin:20px 0 8px;letter-spacing:-1px}",
      ".cert-lead{font-size:12pt;text-align:center;line-height:1.6;color:#334155;max-width:150mm;margin:0 auto 26px}",
      ".cert-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 28px;margin:26px auto;max-width:150mm}",
      ".cert-grid div{border-bottom:1px solid #cbd5e1;padding-bottom:7px}",
      ".cert-grid span{display:block;font-size:8pt;text-transform:uppercase;letter-spacing:.6px;color:#64748b;font-weight:700}",
      ".cert-grid b{display:block;font-size:11pt;margin-top:3px}",
      ".cert-note{font-size:9pt;color:#64748b;line-height:1.6;text-align:center;max-width:145mm;margin:26px auto}",
      ".cert-signatures{display:flex;gap:34px;margin-top:40px}",
      ".cert-signatures>div{flex:1}",
      ".cert-line{height:1px;background:#64748b;margin-top:34px}",
      ".cert-signatures span{display:block;font-size:8.5pt;color:#64748b;margin-top:5px}",
      ".cert-foot{margin-top:36px;font-size:8pt;color:#94a3b8;text-align:center}"
    ].join("\n");
  }

  /* ── Modal / confirm ── */
  function openModal(options) {
    _modal = options || {};
    var overlay = $("#tms-modal-overlay");
    var modal = $("#tms-modal");
    if (!overlay || !modal) return;
    $("#tms-modal-title").textContent = options.title || "";
    $("#tms-modal-body").innerHTML = options.body || "";
    $("#tms-modal-foot").innerHTML = options.foot || "";
    modal.classList.toggle("is-wide", !!options.wide);
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    if (typeof options.onMount === "function") options.onMount();
    setTimeout(function () {
      var first = $("#tms-modal-body").querySelector("input,select,textarea,button");
      if (first) { try { first.focus(); } catch (e) {} }
    }, 40);
  }

  function closeModal() {
    var overlay = $("#tms-modal-overlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    $("#tms-modal-body").innerHTML = "";
    $("#tms-modal-foot").innerHTML = "";
    if (_modal && typeof _modal.onClose === "function") _modal.onClose();
    _modal = null;
  }

  function confirmAction(title, message, confirmLabel, danger, onConfirm) {
    openModal({
      title: title,
      body: '<p style="font-size:13px;color:var(--tms-ink-2);line-height:1.55">' + esc(message) + '</p>',
      foot: '<span class="tms-foot-spacer"></span><button type="button" class="tms-btn" id="tms-confirm-cancel">Cancel</button><button type="button" class="tms-btn ' + (danger ? "tms-btn-danger" : "tms-btn-primary") + '" id="tms-confirm-ok">' + esc(confirmLabel || "Confirm") + '</button>',
      onMount: function () {
        $("#tms-confirm-cancel").addEventListener("click", closeModal);
        $("#tms-confirm-ok").addEventListener("click", function () {
          closeModal();
          if (typeof onConfirm === "function") onConfirm();
        });
      }
    });
  }

  /* ── Settings actions ── */
  function applyPeriodFromAnchor() {
    var anchor = ($("#tms-period-anchor") || {}).value || DB.settings.periodStart;
    if (DB.settings.periodType === "custom") {
      notify("Custom period: change the start and end dates directly.", "info");
      return;
    }
    var bounds = boundsForPeriod(DB.settings.periodType, anchor, DB.settings.weekStart);
    DB.settings.periodStart = bounds.start;
    DB.settings.periodEnd = bounds.end;
    addAudit("Period recalculated", bounds.start + " to " + bounds.end + " · " + periodTypeLabel(DB.settings.periodType));
    persistNow();
    renderAll();
    notify("Period set to " + formatDateShort(bounds.start) + " to " + formatDateShort(bounds.end) + ".", "success");
  }

  function clearPeriod() {
    if (!canManage()) return;
    var count = periodEntries().length;
    confirmAction("Clear this period?", "Delete " + count + " entries inside this period. Entries outside the period are kept. This cannot be undone.", "Delete " + count + " entries", true, function () {
      var start = DB.settings.periodStart;
      var end = DB.settings.periodEnd;
      DB.entries = DB.entries.filter(function (entry) { return !(entry.date >= start && entry.date <= end); });
      DB.timesheet = emptyTimesheet();
      addAudit("Period cleared", start + " to " + end + " · " + count + " entries deleted");
      persistNow();
      renderAll();
      notify("Period cleared.", "success");
    });
  }

  function resetSettings() {
    if (!canManage()) return;
    confirmAction("Reset settings?", "Restore the default period, mode, rates, overtime and project settings. Entries are kept.", "Reset settings", false, function () {
      var entries = DB.entries;
      var audit = DB.audit;
      var timesheet = DB.timesheet;
      DB.settings = defaultSettings();
      DB.entries = entries;
      DB.audit = audit;
      DB.timesheet = timesheet;
      addAudit("Settings reset", "Defaults restored");
      persistNow();
      renderAll();
      notify("Settings reset.", "success");
    });
  }

  function handleSettingsInput(event) {
    var target = event.target;
    if (!target || !target.getAttribute) return;
    var setting = target.getAttribute("data-setting");
    if (setting) {
      var value;
      if (target.type === "checkbox") value = !!target.checked;
      else if (target.type === "number") value = num(target.value);
      else value = target.value;
      if (setting === "currency") {
        value = String(value).toUpperCase().slice(0, 3);
        if (!value) value = "CAD";
      }
      DB.settings[setting] = value;
      if (setting === "workerName" || setting === "organizationName" || setting === "approverName" || setting === "volunteerProgram" || setting === "volunteerRole" || setting === "volunteerSupervisor") {
        DB.settings[setting] = String(value).slice(0, 120);
      }
      if (setting === "periodStart" || setting === "periodEnd") {
        if (!normalizeDate(value)) return;
        DB.settings[setting] = normalizeDate(value);
      }
      persistSoon();
      if (setting === "mode" || setting === "weekStart" || setting === "periodType" || setting === "periodStart" || setting === "periodEnd") {
        renderAll();
      }
      return;
    }
    var projectIndex = target.getAttribute("data-project-index");
    if (projectIndex !== null) {
      var project = DB.settings.projects[parseInt(projectIndex, 10)];
      if (!project) return;
      var projectField = target.getAttribute("data-project-field");
      if (projectField === "active") project.active = !!target.checked;
      else if (projectField === "rate" || projectField === "budgetHours") project[projectField] = Math.max(0, num(target.value));
      else project[projectField] = String(target.value).slice(0, 90);
      persistSoon();
      return;
    }
    var activityIndex = target.getAttribute("data-activity-index");
    if (activityIndex !== null) {
      var activity = DB.settings.activities[parseInt(activityIndex, 10)];
      if (!activity) return;
      var activityField = target.getAttribute("data-activity-field");
      if (activityField === "billableDefault") activity.billableDefault = !!target.checked;
      else activity[activityField] = String(target.value).slice(0, 90);
      persistSoon();
    }
  }

  function handleSettingsClick(event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var actionNode = target.closest("[data-action]");
    if (!actionNode) return;
    var action = actionNode.getAttribute("data-action");
    if (action === "apply-period") { applyPeriodFromAnchor(); return; }
    if (action === "add-project") {
      DB.settings.projects.push({ id: uid(), name: "New project", client: "", code: "", rate: 0, budgetHours: 0, active: true });
      persistNow();
      renderSettings();
      return;
    }
    if (action === "add-activity") {
      DB.settings.activities.push({ id: uid(), name: "New activity", billableDefault: true, active: true });
      persistNow();
      renderSettings();
      return;
    }
    if (action === "remove-project") {
      var pIndex = parseInt(actionNode.getAttribute("data-index"), 10);
      var p = DB.settings.projects[pIndex];
      if (!p) return;
      confirmAction("Remove project?", "Remove \"" + p.name + "\" from the project list. Existing entries keep their recorded project name in reports.", "Remove", true, function () {
        DB.settings.projects.splice(pIndex, 1);
        addAudit("Project removed", p.name);
        persistNow();
        renderSettings();
        notify("Project removed.", "success");
      });
      return;
    }
    if (action === "remove-activity") {
      var aIndex = parseInt(actionNode.getAttribute("data-index"), 10);
      var a = DB.settings.activities[aIndex];
      if (!a) return;
      confirmAction("Remove activity?", "Remove \"" + a.name + "\" from the activity list.", "Remove", true, function () {
        DB.settings.activities.splice(aIndex, 1);
        addAudit("Activity removed", a.name);
        persistNow();
        renderSettings();
        notify("Activity removed.", "success");
      });
      return;
    }
    if (action === "export-json") { exportJson(); return; }
    if (action === "import") { openImportModal(); return; }
    if (action === "export-csv") { exportCsv(); return; }
    if (action === "clear-period") { clearPeriod(); return; }
    if (action === "reset-settings") { resetSettings(); }
  }

  /* ── Misc actions ── */
  function copyInvoiceSummary() {
    var stats = _currentStats || computeStats(periodEntries());
    var keys = Object.keys(stats.projects);
    var lines = ["Project | Client | Hours | Billable | Amount"];
    keys.forEach(function (key) {
      var p = stats.projects[key];
      lines.push(p.name + " | " + (p.client || "-") + " | " + formatHours(p.minutes) + " | " + formatHours(p.billableMinutes) + " | " + (DB.settings.mode === "volunteer" ? "-" : formatMoney(p.amount)));
    });
    lines.push("TOTAL | | " + formatHours(stats.totalMinutes) + " | " + formatHours(stats.billableMinutes) + " | " + (DB.settings.mode === "volunteer" ? "-" : formatMoney(stats.billableAmount)));
    var text = lines.join("\n");
    copyText(text, "Invoice summary copied.");
  }

  function copyText(text, successMessage) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { notify(successMessage || "Copied.", "success"); }, function () { openTextModal(text); });
        return;
      }
    } catch (e) {}
    openTextModal(text);
  }

  function openTextModal(text) {
    openModal({
      title: "Copy",
      body: '<textarea class="tms-textarea tms-import-text" id="tms-copy-text" readonly>' + esc(text) + '</textarea>',
      foot: '<span class="tms-foot-spacer"></span><button type="button" class="tms-btn tms-btn-primary" id="tms-copy-close">Close</button>',
      onMount: function () {
        var area = $("#tms-copy-text");
        if (area) { area.focus(); area.select(); }
        $("#tms-copy-close").addEventListener("click", closeModal);
      }
    });
  }

  function switchTab(tab) {
    if (["timesheet", "clock", "reports", "settings"].indexOf(tab) === -1) tab = "timesheet";
    _activeTab = tab;
    DB.ui.tab = tab;
    $$(".tms-nav-item").forEach(function (item) { item.classList.toggle("is-active", item.getAttribute("data-tab") === tab); });
    $$(".tms-pane").forEach(function (pane) { pane.classList.toggle("is-active", pane.getAttribute("data-pane") === tab); });
    renderTopbar();
    if (tab === "reports") renderReports();
    if (tab === "settings") renderSettings();
    if (tab === "clock") renderClock();
    if (tab === "timesheet") renderEntries();
    persistSoon();
    resize();
  }

  function openMoreMenu(open) {
    var menu = $("#tms-more-menu");
    var button = $("#tms-btn-more");
    if (!menu || !button) return;
    var shouldOpen = open === undefined ? !menu.classList.contains("is-open") : !!open;
    menu.classList.toggle("is-open", shouldOpen);
    button.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  }

  /* ── Icons ── */
  function icon(name) {
    var paths = {
      clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
      calendar: '<path d="M4 5h16v14H4z"></path><path d="M4 9h16M8 13h3M8 16h5"></path>',
      check: '<path d="M5 12l4 4 10-10"></path>',
      alert: '<path d="M12 3l9 17H3z"></path><path d="M12 9v4M12 17h.01"></path>',
      send: '<path d="M4 12l16-8-6 16-3-6z"></path>',
      user: '<circle cx="12" cy="8" r="3"></circle><path d="M5 20a7 7 0 0 1 14 0"></path>',
      folder: '<path d="M3 6h6l2 2h10v11H3z"></path>',
      database: '<ellipse cx="12" cy="5" rx="7" ry="3"></ellipse><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"></path>',
      eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"></path><circle cx="12" cy="12" r="2.5"></circle>',
      award: '<circle cx="12" cy="9" r="5"></circle><path d="M8 14l-2 7 6-3 6 3-2-7"></path>'
    };
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.check) + '</svg>';
  }

  /* ── Wire events ── */
  function wireEvents() {
    var nav = $("#tms-nav");
    if (nav) nav.addEventListener("click", function (event) {
      var item = event.target.closest ? event.target.closest("[data-tab]") : null;
      if (item) switchTab(item.getAttribute("data-tab"));
    });

    var add = $("#tms-btn-add-entry");
    if (add) add.addEventListener("click", function () { openEntryModal(null, defaultEntryDate()); });
    var submit = $("#tms-btn-submit");
    if (submit) submit.addEventListener("click", handleSubmitButton);

    var more = $("#tms-btn-more");
    if (more) more.addEventListener("click", function (event) { event.stopPropagation(); openMoreMenu(); });
    var moreMenu = $("#tms-more-menu");
    if (moreMenu) moreMenu.addEventListener("click", function (event) {
      var item = event.target.closest ? event.target.closest("[data-action]") : null;
      if (!item) return;
      openMoreMenu(false);
      var action = item.getAttribute("data-action");
      if (action === "copy-day") copyPreviousDay();
      else if (action === "print-timesheet") printCurrentReport();
      else if (action === "export-csv") exportCsv();
      else if (action === "export-json") exportJson();
      else if (action === "import") openImportModal();
    });

    document.addEventListener("click", function (event) {
      var menu = $("#tms-more-menu");
      var wrap = $(".tms-menu-wrap");
      if (menu && menu.classList.contains("is-open") && wrap && !wrap.contains(event.target)) openMoreMenu(false);
    });

    var search = $("#tms-search");
    if (search) search.addEventListener("input", function () { _filters.search = search.value; renderEntries(); });
    var filterCategory = $("#tms-filter-category");
    if (filterCategory) filterCategory.addEventListener("change", function () { _filters.category = filterCategory.value; renderEntries(); });
    var filterBillable = $("#tms-filter-billable");
    if (filterBillable) filterBillable.addEventListener("change", function () { _filters.billable = filterBillable.value; renderEntries(); });

    var entries = $("#tms-entries");
    if (entries) {
      entries.addEventListener("click", function (event) {
        var emptyAction = event.target.closest ? event.target.closest("[data-empty-action]") : null;
        if (emptyAction) { openEntryModal(null, defaultEntryDate()); return; }
        var dayAdd = event.target.closest ? event.target.closest("[data-day-add]") : null;
        if (dayAdd) { openEntryModal(null, dayAdd.getAttribute("data-day-add")); return; }
        var edit = event.target.closest ? event.target.closest("[data-edit-entry]") : null;
        if (edit) { event.stopPropagation(); openEntryModal(edit.getAttribute("data-edit-entry")); return; }
        var row = event.target.closest ? event.target.closest("[data-entry-id]") : null;
        if (row) openEntryModal(row.getAttribute("data-entry-id"));
      });
      entries.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        var row = event.target.closest ? event.target.closest("[data-entry-id]") : null;
        if (row) { event.preventDefault(); openEntryModal(row.getAttribute("data-entry-id")); }
      });
    }

    var alerts = $("#tms-alerts");
    if (alerts) alerts.addEventListener("click", function (event) {
      var node = event.target.closest ? event.target.closest("[data-alert-action]") : null;
      if (!node) return;
      var action = node.getAttribute("data-alert-action");
      if (action === "fix-open") { var open = openEntry(); if (open) openEntryModal(open.id); }
      else if (action === "open-settings") switchTab("settings");
      else if (action === "review-rejected") switchTab("timesheet");
    });

    var reportTabs = $("#tms-report-tabs");
    if (reportTabs) reportTabs.addEventListener("click", function (event) {
      var tab = event.target.closest ? event.target.closest("[data-report]") : null;
      if (!tab) return;
      _reportTab = tab.getAttribute("data-report");
      DB.ui.reportTab = _reportTab;
      persistSoon();
      renderReports();
    });
    var printReport = $("#tms-btn-print-report");
    if (printReport) printReport.addEventListener("click", printCurrentReport);
    var reportCsv = $("#tms-btn-report-csv");
    if (reportCsv) reportCsv.addEventListener("click", exportCsv);

    var reportBody = $("#tms-report-body");
    if (reportBody) reportBody.addEventListener("click", function (event) {
      var node = event.target.closest ? event.target.closest("[data-report-action]") : null;
      if (!node) return;
      var action = node.getAttribute("data-report-action");
      if (action === "certificate") printCertificate();
      else if (action === "copy-invoice") copyInvoiceSummary();
    });

    var clockButton = $("#tms-btn-clock");
    if (clockButton) clockButton.addEventListener("click", function () {
      var open = openEntry();
      if (open) openClockOutConfirm(open);
      else clockIn();
    });
    var clockProject = $("#tms-clock-project");
    if (clockProject) clockProject.addEventListener("change", function () { DB.ui.clockProjectId = clockProject.value; persistSoon(); });
    var clockActivity = $("#tms-clock-activity");
    if (clockActivity) clockActivity.addEventListener("change", function () { DB.ui.clockActivityId = clockActivity.value; persistSoon(); });
    var clockBreak = $("#tms-clock-break");
    if (clockBreak) clockBreak.addEventListener("change", function () { DB.ui.clockBreakMinutes = clamp(clockBreak.value, 0, 600); persistSoon(); });

    var todayEntries = $("#tms-today-entries");
    if (todayEntries) todayEntries.addEventListener("click", function (event) {
      var row = event.target.closest ? event.target.closest("[data-entry-id]") : null;
      if (row) openEntryModal(row.getAttribute("data-entry-id"));
    });

    var settingsBody = $("#tms-settings-body");
    if (settingsBody) {
      settingsBody.addEventListener("input", handleSettingsInput);
      settingsBody.addEventListener("change", handleSettingsInput);
      settingsBody.addEventListener("click", handleSettingsClick);
    }

    var modalClose = $("#tms-modal-close");
    if (modalClose) modalClose.addEventListener("click", closeModal);
    var overlay = $("#tms-modal-overlay");
    if (overlay) overlay.addEventListener("click", function (event) { if (event.target === overlay) closeModal(); });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        var menu = $("#tms-more-menu");
        if (menu && menu.classList.contains("is-open")) { openMoreMenu(false); return; }
        if (overlay && overlay.classList.contains("is-open")) closeModal();
      }
    });

    var categoryFilter = $("#tms-filter-category");
    if (categoryFilter) {
      categoryFilter.innerHTML = '<option value="all">All categories</option>' + CATEGORIES.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + '</option>'; }).join("");
    }
  }

  /* ── Boot ── */
  tool.onReady(function (value) {
    console.log("[TOOL:BOOT] build " + TOOL_BUILD + " TimeLedger starting...");
    try {
      DB = normalizeDB(value);
      console.log("[TOOL:BOOT] normalized value (" + DB.entries.length + " entries)");
    } catch (bootError) {
      console.log("[TOOL:BOOT] normalize failed: " + (bootError && bootError.message ? bootError.message : bootError));
      DB = defaultDatabase();
    }
    _hydrated = !!(value && typeof value === "object");
    _activeTab = DB.ui.tab || "timesheet";
    _reportTab = DB.ui.reportTab || "summary";

    try {
      tool.declareParams([
        { name: "defaultMode", label: "Default mode", type: "select", default: "work", hint: "work, billing, volunteer or mixed - used only when a new instance starts empty.", severity: "optional" },
        { name: "defaultPeriodType", label: "Default period type", type: "select", default: "monthly", hint: "weekly, biweekly, semimonthly, monthly or custom.", severity: "optional" },
        { name: "defaultWeekStart", label: "Week starts on", type: "select", default: "1", hint: "1 = Monday, 0 = Sunday.", severity: "optional" },
        { name: "currency", label: "Currency", type: "text", default: "CAD", hint: "Three-letter currency code used in amounts.", severity: "optional" },
        { name: "defaultHourlyRate", label: "Default hourly rate", type: "number", default: "0", hint: "Used only when the instance starts empty.", severity: "optional" },
        { name: "organizationName", label: "Organization name", type: "text", default: "", hint: "Printed on timesheet reports and volunteer certificates.", severity: "optional" },
        { name: "approverName", label: "Approver name", type: "text", default: "", hint: "Default approver shown on the timesheet.", severity: "optional" },
        { name: "volunteerGoalHours", label: "Volunteer hour goal", type: "number", default: "0", hint: "Optional goal for volunteer programs.", severity: "optional" },
        { name: "allowRequestSave", label: "Allow requestSave", type: "toggle", default: "yes", hint: "Required for the tool to save without the parent Save button.", severity: "goodToHave" },
        { name: "allowExportPdf", label: "Allow PDF export", type: "toggle", default: "yes", hint: "Required for the Print / PDF buttons.", severity: "goodToHave" }
      ]);
    } catch (e) {}

    var buildBadge = $("#tms-build");
    if (buildBadge) buildBadge.textContent = "tool build " + TOOL_BUILD;

    // Seed the mode-dependent category filter now that settings exist.
    _filters.category = "all";
    wireEvents();
    currentUser = getUserSafe();
    isReadOnly = tool.isReadOnly();
    var categoryFilter = $("#tms-filter-category");
    if (categoryFilter) {
      categoryFilter.innerHTML = '<option value="all">All categories</option>' + CATEGORIES.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + '</option>'; }).join("");
    }

    switchTab(_activeTab);
    renderAll();
    console.log("[TOOL:BOOT] rendered " + _activeTab + " (" + periodEntries().length + " period entries)");
    startUserPolling();
    startClockTimer();

    try { tool.reportValid(true, ""); } catch (e) {}
    try {
      tool.onReadonlyChange(function (ro) { isReadOnly = !!ro; renderAll(); });
      tool.onUserChange(function (user) { currentUser = user || getUserSafe(); if (currentUser) _noIdentity = false; renderUserChip(); updateActionButtons(); });
      tool.onValueChange(function (incoming) {
        if (!incoming || typeof incoming !== "object") return;
        var json = JSON.stringify(incoming);
        if (json === _lastStagedJson) return;
        DB = normalizeDB(incoming);
        _hydrated = true;
        _activeTab = DB.ui.tab || _activeTab;
        renderAll();
        notify("Timesheet updated.", "info");
      });
    } catch (e) {}

    var delays = [350, 900, 1800, 3200];
    var attempt = 0;
    function pollValue() {
      if (_hydrated) return;
      var current = null;
      try { current = tool.getValue(); } catch (e) { current = null; }
      if (current && typeof current === "object") {
        DB = normalizeDB(current);
        _hydrated = true;
        renderAll();
        return;
      }
      attempt += 1;
      if (attempt < delays.length) setTimeout(pollValue, delays[attempt]);
    }
    setTimeout(pollValue, delays[0]);
  });

  function startClockTimer() {
    if (_clockTimer) return;
    _clockTimer = setInterval(function () {
      if (_activeTab === "clock" || openEntry()) updateClockNow();
    }, 1000);
  }

})();
