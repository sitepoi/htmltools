/* ============================================================
   Bookkeeper Task Manager - JS
   Uniconhub CMS html-tool.
   Yearly task plan (routine + ad-hoc) for a bookkeeper with a
   confirmation workflow between the bookkeeper and administration.
   Everything persisted via tool.setValue() - zero admin config.
   Entry point: tool.onReady
   ============================================================ */
(function () {
  "use strict";

  /* ---- SDK handle + fallback shim ---- */
  var tool = (typeof window !== "undefined" && window.tool) ? window.tool : null;
  if (!tool) {
    var _fallbackValue = null;
    tool = {
      onReady: function (callback) { callback(_fallbackValue, {}); },
      getValue: function () { return _fallbackValue; },
      setValue: function (value) { _fallbackValue = value; },
      onValueChange: function () {},
      getFields: function () { return {}; },
      watchField: function () {},
      setField: function () {},
      setFields: function () {},
      onFieldsChange: function () {},
      param: function (name, defaultValue) { return defaultValue; },
      isReadOnly: function () { return false; },
      onReadonlyChange: function () {},
      getUser: function () { return null; },
      onUserChange: function () {},
      getPermittedUsers: function () { return []; },
      onPermittedUsersChange: function () {},
      reportValid: function () {},
      notify: function (message) { try { console.log("notify:", message); } catch (error) {} },
      resize: function () {},
      declareOutput: function () {},
      declareParams: function () {},
      reportMissingParams: function () {},
      requestSave: function (callback) { if (callback) callback(null, true); }
    };
  }

  /* ============================================================
     CONSTANTS
     ============================================================ */

  var TASK_STATUSES = {
    pending: "Not Started",
    inProgress: "In Progress",
    done: "Completed"
  };

  var TASK_CATEGORIES = [
    { id: "daily-records", label: "Daily Records and Bookkeeping" },
    { id: "reconciliation", label: "Bank and Card Reconciliations" },
    { id: "payables", label: "Payables and Receivables" },
    { id: "payroll", label: "Payroll and Government Remittances" },
    { id: "reporting", label: "Financial Reporting" },
    { id: "yearend", label: "Year-End and Audit" },
    { id: "charity", label: "Charity Compliance and T3010" },
    { id: "cash", label: "Cash and Pledge Tracking" },
    { id: "budget", label: "Department Budgets" },
    { id: "grants", label: "Grant Tracking" },
    { id: "purchases", label: "Purchases and Payments" },
    { id: "reimburse", label: "Payments and Reimbursements" },
    { id: "tracking", label: "Task Tracking and Work Hours" }
  ];

  var TASK_FREQUENCIES = [
    { id: "daily", label: "Daily" },
    { id: "weekly", label: "Weekly" },
    { id: "biweekly", label: "Biweekly" },
    { id: "monthly", label: "Monthly" },
    { id: "quarterly", label: "Quarterly" },
    { id: "yearly", label: "Yearly" }
  ];

  var PRIORITY_IDS = ["high", "medium", "low"];
  var PRIORITY_LABELS = { high: "High", medium: "Medium", low: "Low" };

  var DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  var STATUS_FILTER_OPTIONS = [
    { id: "all", label: "All Statuses" },
    { id: "active", label: "Active" },
    { id: "pending", label: "Not Started" },
    { id: "inProgress", label: "In Progress" },
    { id: "done", label: "Completed" }
  ];

  /* ============================================================
     STATE
     ============================================================ */

  var ROOT = null;
  var DB = null;
  var readOnly = false;
  var _user = null;
  var _noIdentity = false;
  var _saveTimer = null;
  var _savingNow = false;
  var _lastStagedJson = null;
  var _warnedAutosave = false;
  var _editDefinitionId = null;
  var _noteKey = null;
  var _requestTaskKey = null;
  var _respondRequestId = null;
  var _confirmYesCallback = null;
  var _expandedGroups = {};

  /* ============================================================
     HELPERS
     ============================================================ */

  function byId(id) { return document.getElementById(id); }
  function queryAll(selector, scope) { return Array.prototype.slice.call((scope || ROOT).querySelectorAll(selector)); }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function uniqueId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function pad2(value) { return value < 10 ? "0" + value : String(value); }
  function clampInt(value, minValue, maxValue) {
    var number = parseInt(value, 10);
    if (isNaN(number)) number = minValue;
    return Math.max(minValue, Math.min(maxValue, number));
  }

  function nowIsoDateTime() { return new Date().toISOString(); }

  function isoOfDate(dateObject) {
    return dateObject.getFullYear() + "-" + pad2(dateObject.getMonth() + 1) + "-" + pad2(dateObject.getDate());
  }

  function parseDateIso(isoString) {
    var parts = isoString.split("-");
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  function todayIsoString() { return isoOfDate(new Date()); }

  function addDaysToIso(isoString, dayCount) {
    var dateObject = parseDateIso(isoString);
    dateObject.setDate(dateObject.getDate() + dayCount);
    return isoOfDate(dateObject);
  }

  /* 0 = Pazartesi ... 6 = Pazar */
  function weekdayIndex(dateObject) { return (dateObject.getDay() + 6) % 7; }

  function startOfWeekDate(dateObject) {
    var copy = new Date(dateObject);
    copy.setDate(copy.getDate() - weekdayIndex(copy));
    return copy;
  }

  function daysInMonthOf(year, monthIndex) { return new Date(year, monthIndex + 1, 0).getDate(); }
  function clampDayNumber(day, year, monthIndex) { return Math.min(day, daysInMonthOf(year, monthIndex)); }

  function formatDateShort(isoString) {
    if (!isoString) return "";
    var dateObject = parseDateIso(isoString);
    return dateObject.getDate() + " " + MONTHS_SHORT[dateObject.getMonth()];
  }

  function formatDateLong(isoString) {
    if (!isoString) return "";
    var dateObject = parseDateIso(isoString);
    return dateObject.getDate() + " " + MONTHS_FULL[dateObject.getMonth()] + " " + dateObject.getFullYear();
  }

  function formatDateMedium(isoString) {
    if (!isoString) return "";
    var dateObject = parseDateIso(isoString);
    return DAYS_SHORT[weekdayIndex(dateObject)] + ", " + dateObject.getDate() + " " + MONTHS_SHORT[dateObject.getMonth()];
  }

  function formatDateTime(isoDateTimeString) {
    if (!isoDateTimeString) return "";
    var dateObject = new Date(isoDateTimeString);
    if (isNaN(dateObject.getTime())) return "";
    return pad2(dateObject.getDate()) + " " + MONTHS_SHORT[dateObject.getMonth()] + " " + pad2(dateObject.getHours()) + ":" + pad2(dateObject.getMinutes());
  }

  function localDateOfIsoDateTime(isoDateTimeString) {
    if (!isoDateTimeString) return "";
    var dateObject = new Date(isoDateTimeString);
    if (isNaN(dateObject.getTime())) return "";
    return isoOfDate(dateObject);
  }

  function tryNotify(message, severity) {
    try { tool.notify(message, severity || "success"); } catch (error) {}
  }

  /* ============================================================
     LOOKUPS
     ============================================================ */

  function findDefinitionById(definitionId) {
    for (var i = 0; i < DB.definitions.length; i++) {
      if (DB.definitions[i].id === definitionId) return DB.definitions[i];
    }
    return null;
  }

  function categoryLabelOf(categoryId) {
    for (var i = 0; i < TASK_CATEGORIES.length; i++) {
      if (TASK_CATEGORIES[i].id === categoryId) return TASK_CATEGORIES[i].label;
    }
    return categoryId || "Kategorisiz";
  }

  function frequencyLabelOf(frequencyId) {
    for (var i = 0; i < TASK_FREQUENCIES.length; i++) {
      if (TASK_FREQUENCIES[i].id === frequencyId) return TASK_FREQUENCIES[i].label;
    }
    return "";
  }

  function frequencyOrderOf(definition) {
    for (var i = 0; i < TASK_FREQUENCIES.length; i++) {
      if (TASK_FREQUENCIES[i].id === definition.frequency) return i;
    }
    return 9;
  }

  function priorityRankOf(priorityId) {
    if (priorityId === "high") return 2;
    if (priorityId === "medium") return 1;
    return 0;
  }

  function statusLabelOf(status) { return TASK_STATUSES[status] || TASK_STATUSES.pending; }
  function isFinishedStatus(status) { return status === "done"; }
  function isOpenStatus(status) { return status === "pending" || status === "inProgress"; }

  function occurrenceKey(definitionId, dueDate) { return definitionId + "|" + dueDate; }

  function statusEntryFor(key) {
    var entry = DB.statuses[key];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    return entry;
  }

  function currentStatusOf(key) {
    var entry = statusEntryFor(key);
    if (!entry) return "pending";
    if (entry.status === "awaitingConfirmation") return "inProgress";
    if (entry.status === "confirmed") return "done";
    return TASK_STATUSES[entry.status] ? entry.status : "pending";
  }

  function ensureStatusEntry(key) {
    var entry = statusEntryFor(key);
    if (!entry) {
      entry = { status: "pending", log: [] };
      DB.statuses[key] = entry;
    }
    if (!Array.isArray(entry.log)) entry.log = [];
    return entry;
  }

  /* ============================================================
     PERMISSIONS
     ============================================================ */

  function hasGetUserApi() { return typeof tool.getUser === "function"; }

  function safeGetUser() {
    try { return hasGetUserApi() ? tool.getUser() : null; } catch (error) { return null; }
  }

  function rolesOfCurrentUser() {
    if (!_user) return [];
    if (Array.isArray(_user.roles) && _user.roles.length) return _user.roles;
    var fallbackRoles = [];
    var access = _user.effectiveAccess;
    if (access) {
      if (access.isManager) fallbackRoles.push("admin");
      if (access.isEditor) fallbackRoles.push("editor");
      if (access.isViewer) fallbackRoles.push("viewer");
    }
    return fallbackRoles;
  }

  function rolesIncludeManagerRole(roles) {
    return roles.indexOf("admin") > -1 || roles.indexOf("owner") > -1 ||
      roles.indexOf("developer") > -1 || roles.indexOf("user-manager") > -1;
  }

  function canAdminister() {
    if (readOnly) return false;
    if (_noIdentity) return true;
    if (_user && _user.effectiveAccess && _user.effectiveAccess.isManager) return true;
    return rolesIncludeManagerRole(rolesOfCurrentUser());
  }

  function canWork() {
    if (readOnly) return false;
    if (_noIdentity) return true;
    if (canAdminister()) return true;
    if (_user && _user.effectiveAccess && _user.effectiveAccess.isEditor) return true;
    return rolesOfCurrentUser().indexOf("editor") > -1;
  }

  function currentUserDisplayName() {
    if (_user && _user.name) return _user.name;
    return "Unknown";
  }

  function refreshIdentity() {
    if (!hasGetUserApi()) {
      _noIdentity = true;
      _user = null;
    } else {
      _user = safeGetUser();
    }
  }

  function startIdentityPolling() {
    [400, 1200, 2600, 5000].forEach(function (delayMilliseconds) {
      setTimeout(function () { refreshIdentity(); renderAll(); }, delayMilliseconds);
    });
  }

  /* ============================================================
     DATABASE
     ============================================================ */

  function defaultDatabase() {
    return {
      version: 2,
      year: new Date().getFullYear(),
      definitions: [],
      statuses: {},
      requests: {},
      ui: { tab: "board", scope: "week", statusFilter: "all", category: "all", search: "", dashMonth: "year" }
    };
  }

  function normalizeDefinition(rawDefinition) {
    if (!rawDefinition || typeof rawDefinition !== "object") return null;
    var title = String(rawDefinition.title || "").trim();
    if (!title) return null;
    var taskType = rawDefinition.taskType === "adHoc" ? "adHoc" : "regular";
    var frequency = rawDefinition.frequency || "";
    if (taskType === "regular") {
      var knownFrequency = false;
      for (var i = 0; i < TASK_FREQUENCIES.length; i++) {
        if (TASK_FREQUENCIES[i].id === frequency) { knownFrequency = true; break; }
      }
      if (!knownFrequency) frequency = "daily";
    } else {
      frequency = "";
    }
    return {
      id: String(rawDefinition.id || uniqueId()),
      title: title,
      category: String(rawDefinition.category || ""),
      taskType: taskType,
      frequency: frequency,
      dayOfWeek: clampInt(rawDefinition.dayOfWeek, 0, 6),
      dayOfMonth: clampInt(rawDefinition.dayOfMonth, 1, 31),
      monthOfYear: clampInt(rawDefinition.monthOfYear, 1, 12),
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(rawDefinition.dueDate || "")) ? rawDefinition.dueDate : "",
      priority: PRIORITY_IDS.indexOf(rawDefinition.priority) > -1 ? rawDefinition.priority : "medium",
      note: String(rawDefinition.note || ""),
      createdAt: rawDefinition.createdAt || nowIsoDateTime(),
      createdBy: String(rawDefinition.createdBy || "")
    };
  }

  function normalizeDatabase(rawValue) {
    var database = defaultDatabase();
    if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) return database;
    if (typeof rawValue.version === "number") database.version = rawValue.version;
    if (typeof rawValue.year === "number") database.year = clampInt(rawValue.year, 2000, 2100);
    if (Array.isArray(rawValue.definitions)) {
      database.definitions = rawValue.definitions.map(normalizeDefinition).filter(function (definition) { return !!definition; });
    }
    if (rawValue.statuses && typeof rawValue.statuses === "object" && !Array.isArray(rawValue.statuses)) {
      database.statuses = {};
      Object.keys(rawValue.statuses).forEach(function (key) {
        var entry = rawValue.statuses[key];
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
        var migratedEntry = {};
        Object.keys(entry).forEach(function (field) { migratedEntry[field] = entry[field]; });
        if (migratedEntry.status === "awaitingConfirmation") migratedEntry.status = "inProgress";
        if (migratedEntry.status === "confirmed") migratedEntry.status = "done";
        database.statuses[key] = migratedEntry;
      });
    }
    if (rawValue.requests && typeof rawValue.requests === "object" && !Array.isArray(rawValue.requests)) {
      database.requests = {};
      Object.keys(rawValue.requests).forEach(function (requestId) {
        var request = rawValue.requests[requestId];
        if (!request || typeof request !== "object" || Array.isArray(request)) return;
        if (request.type !== "approval" && request.type !== "information") return;
        if (!request.taskKey) return;
        database.requests[String(requestId)] = {
          id: String(request.id || requestId),
          taskKey: String(request.taskKey),
          title: String(request.title || ""),
          dueDate: String(request.dueDate || ""),
          type: request.type,
          message: String(request.message || ""),
          status: (request.status === "approved" || request.status === "declined" || request.status === "answered") ? request.status : "open",
          createdAt: String(request.createdAt || ""),
          createdBy: String(request.createdBy || ""),
          response: String(request.response || ""),
          respondedAt: String(request.respondedAt || ""),
          respondedBy: String(request.respondedBy || "")
        };
      });
    }
    if (rawValue.ui && typeof rawValue.ui === "object" && !Array.isArray(rawValue.ui)) {
      database.ui.tab = (rawValue.ui.tab === "year" || rawValue.ui.tab === "defs" || rawValue.ui.tab === "dashboard") ? rawValue.ui.tab : "board";
      database.ui.scope = (rawValue.ui.scope === "today" || rawValue.ui.scope === "week" || rawValue.ui.scope === "month") ? rawValue.ui.scope : "week";
      database.ui.statusFilter = String(rawValue.ui.statusFilter || "all");
      database.ui.category = String(rawValue.ui.category || "all");
      database.ui.search = String(rawValue.ui.search || "");
      database.ui.dashMonth = (typeof rawValue.ui.dashMonth === "number" && rawValue.ui.dashMonth >= 0 && rawValue.ui.dashMonth <= 11) ? rawValue.ui.dashMonth : "year";
    }
    return database;
  }

  function persistDatabase() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(function () {
      _savingNow = true;
      _lastStagedJson = JSON.stringify(DB);
      try { tool.setValue(DB); } catch (error) {}
      _savingNow = false;
      requestParentSave();
    }, 400);
  }

  function requestParentSave() {
    if (readOnly) return;
    try {
      if (typeof tool.requestSave !== "function") return;
      tool.requestSave(function (error, ok) {
        if (error || !ok) {
          if (!_warnedAutosave) {
            _warnedAutosave = true;
            tryNotify("Automatic save was rejected. Make sure the CMS field setting allowRequestSave is 'yes'; otherwise save the form manually.", "warning");
          }
        }
      });
    } catch (ignored) {}
  }

  /* ============================================================
     OCCURRENCE MATH
     ============================================================ */

  function occurrenceDatesForDefinition(definition, year, onlyYear) {
    var dates = [];
    if (definition.taskType === "adHoc") {
      if (definition.dueDate) {
        if (!onlyYear || definition.dueDate.slice(0, 4) === String(year)) dates.push(definition.dueDate);
      }
      return dates;
    }
    var frequency = definition.frequency || "daily";
    if (frequency === "daily") {
      var dayCursor = new Date(year, 0, 1);
      var lastDay = new Date(year, 11, 31);
      while (dayCursor.getTime() <= lastDay.getTime()) {
        dates.push(isoOfDate(dayCursor));
        dayCursor.setDate(dayCursor.getDate() + 1);
      }
    } else if (frequency === "weekly" || frequency === "biweekly") {
      var stepDays = frequency === "biweekly" ? 14 : 7;
      var weekCursor = new Date(year, 0, 1);
      while (weekdayIndex(weekCursor) !== definition.dayOfWeek) weekCursor.setDate(weekCursor.getDate() + 1);
      while (weekCursor.getFullYear() === year) {
        dates.push(isoOfDate(weekCursor));
        weekCursor.setDate(weekCursor.getDate() + stepDays);
      }
    } else if (frequency === "monthly") {
      for (var monthIndex = 0; monthIndex < 12; monthIndex++) {
        dates.push(isoOfDate(new Date(year, monthIndex, clampDayNumber(definition.dayOfMonth, year, monthIndex))));
      }
    } else if (frequency === "quarterly") {
      [0, 3, 6, 9].forEach(function (quarterMonth) {
        dates.push(isoOfDate(new Date(year, quarterMonth, clampDayNumber(definition.dayOfMonth, year, quarterMonth))));
      });
    } else if (frequency === "yearly") {
      var yearlyMonth = definition.monthOfYear - 1;
      dates.push(isoOfDate(new Date(year, yearlyMonth, clampDayNumber(definition.dayOfMonth, year, yearlyMonth))));
    }
    return dates;
  }

  /* ============================================================
     STATUS OPERATIONS
     ============================================================ */

  function setOccurrenceStatus(key, newStatus) {
    var parts = key.split("|");
    var definition = findDefinitionById(parts[0]);
    if (!definition) return;
    var entry = ensureStatusEntry(key);
    var timestamp = nowIsoDateTime();
    var userName = currentUserDisplayName();
    entry.status = newStatus;
    entry.updatedAt = timestamp;
    entry.updatedBy = userName;
    if (newStatus === "done") {
      entry.completedAt = timestamp;
      entry.completedBy = userName;
    }
    if (newStatus === "pending") {
      delete entry.completedAt;
      delete entry.completedBy;
      delete entry.adminNote;
    }
    entry.log.push({ status: newStatus, at: timestamp, by: userName });
    if (entry.log.length > 12) entry.log.shift();
    persistDatabase();
    renderAll();
    if (newStatus === "done") tryNotify("Task completed", "success");
  }

  function toggleDayCompletion(definitionId, dateIso) {
    if (!canWork()) return;
    var key = occurrenceKey(definitionId, dateIso);
    var status = currentStatusOf(key);
    setOccurrenceStatus(key, status === "done" ? "pending" : "done");
  }

  function saveOccurrenceNote(key, noteText) {
    var entry = ensureStatusEntry(key);
    entry.note = noteText;
    entry.updatedAt = nowIsoDateTime();
    entry.updatedBy = currentUserDisplayName();
    persistDatabase();
    renderAll();
  }

  function sendOccurrenceBack(key, reasonText) {
    var entry = ensureStatusEntry(key);
    var timestamp = nowIsoDateTime();
    var userName = currentUserDisplayName();
    entry.status = "inProgress";
    entry.adminNote = reasonText || "";
    entry.updatedAt = timestamp;
    entry.updatedBy = userName;
    entry.log.push({ status: "inProgress", at: timestamp, by: userName });
    if (entry.log.length > 12) entry.log.shift();
    persistDatabase();
    renderAll();
    tryNotify("Task sent back", "warning");
  }

  /* ============================================================
     REQUESTS (approval / information)
     ============================================================ */

  function requestTypeLabelOf(type) {
    return type === "information" ? "Information Request" : "Approval Request";
  }

  function requestStatusLabelOf(status) {
    if (status === "approved") return "Approved";
    if (status === "declined") return "Declined";
    if (status === "answered") return "Answered";
    return "Open";
  }

  function requestsForTask(taskKey) {
    var list = [];
    Object.keys(DB.requests).forEach(function (requestId) {
      var request = DB.requests[requestId];
      if (request && request.taskKey === taskKey) list.push(request);
    });
    list.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0; });
    return list;
  }

  function openRequestsForTask(taskKey) {
    return requestsForTask(taskKey).filter(function (request) { return request.status === "open"; });
  }

  function collectOpenRequests() {
    var list = [];
    Object.keys(DB.requests).forEach(function (requestId) {
      var request = DB.requests[requestId];
      if (request && request.status === "open") list.push(request);
    });
    list.sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : 1; });
    return list;
  }

  function countOpenRequestsForDueRange(rangeStart, rangeEnd) {
    var count = 0;
    Object.keys(DB.requests).forEach(function (requestId) {
      var request = DB.requests[requestId];
      if (request && request.status === "open" && request.dueDate >= rangeStart && request.dueDate <= rangeEnd) count++;
    });
    return count;
  }

  function countOpenRequestsForYear(year) {
    return countOpenRequestsForDueRange(year + "-01-01", year + "-12-31");
  }

  function createRequest(taskKey, type, message) {
    var parts = taskKey.split("|");
    var definition = findDefinitionById(parts[0]);
    if (!definition || !message.trim()) return;
    var request = {
      id: uniqueId(),
      taskKey: taskKey,
      title: definition.title,
      dueDate: parts[1] || "",
      type: type === "information" ? "information" : "approval",
      message: message.trim(),
      status: "open",
      createdAt: nowIsoDateTime(),
      createdBy: currentUserDisplayName(),
      response: "",
      respondedAt: "",
      respondedBy: ""
    };
    DB.requests[request.id] = request;
    persistDatabase();
    renderAll();
    tryNotify(requestTypeLabelOf(request.type) + " submitted", "info");
  }

  function respondToRequest(requestId, responseStatus, responseText) {
    var request = DB.requests[requestId];
    if (!request || request.status !== "open") return;
    request.status = responseStatus;
    request.response = responseText.trim();
    request.respondedAt = nowIsoDateTime();
    request.respondedBy = currentUserDisplayName();
    persistDatabase();
    renderAll();
    tryNotify("Response sent", "success");
  }

  /* ============================================================
     DEFINITION OPERATIONS
     ============================================================ */

  function scheduleTextOf(definition) {
    if (definition.taskType === "adHoc") return "Due: " + formatDateLong(definition.dueDate);
    var frequency = definition.frequency;
    if (frequency === "daily") return "Every day";
    if (frequency === "weekly") return "Weekly · " + DAYS_FULL[definition.dayOfWeek];
    if (frequency === "biweekly") return "Biweekly · " + DAYS_FULL[definition.dayOfWeek];
    if (frequency === "monthly") return "Monthly · on day " + definition.dayOfMonth;
    if (frequency === "quarterly") return "Quarterly · on day " + definition.dayOfMonth;
    if (frequency === "yearly") {
      var yearlyMonth = definition.monthOfYear - 1;
      var yearlyDue = isoOfDate(new Date(DB.year, yearlyMonth, clampDayNumber(definition.dayOfMonth, DB.year, yearlyMonth)));
      return "Yearly · " + formatDateShort(yearlyDue);
    }
    return "";
  }

  function buildSeedDefinitions() {
    var seedItems = [
      { title: "Record cash receipts and payments", category: "cash", frequency: "daily", priority: "high", note: "Record all incoming cash collections and outgoing cash payments in the accounting system on the same day, against receipts." },
      { title: "Process incoming invoices", category: "payables", frequency: "daily", priority: "medium", note: "Review incoming vendor invoices and financial emails, enter them into the accounting system." },
      { title: "Update task statuses", category: "tracking", frequency: "daily", priority: "low", note: "Keep task statuses on the bookkeeping task board up to date." },
      { title: "Weekly pledge report", category: "cash", frequency: "weekly", dayOfWeek: 0, priority: "medium", note: "Prepare the weekly pledge report showing who paid how much and how much remains, and share it with the relevant groups." },
      { title: "Enter work hours", category: "tracking", frequency: "weekly", dayOfWeek: 4, priority: "medium", note: "Enter hours worked into the system on a regular basis." },
      { title: "Prepare weekly report", category: "reporting", frequency: "weekly", dayOfWeek: 4, priority: "medium", note: "Prepare a short weekly summary of completed entries, pending invoices, reconciliation status and grant statuses." },
      { title: "Review pending invoices and payment list", category: "payables", frequency: "weekly", dayOfWeek: 0, priority: "medium", note: "Check invoices and payments nearing their due dates and give early warnings." },
      { title: "Payroll processing", category: "payroll", frequency: "biweekly", dayOfWeek: 4, priority: "high", note: "Calculate and process hours, wages, deductions and net pay. Payroll is done by the person in this role." },
      { title: "Payroll government remittances", category: "payroll", frequency: "biweekly", dayOfWeek: 4, priority: "high", note: "Send source deductions (CPP, EI, tax) and employer portions through the bank on time." },
      { title: "Bank account reconciliation", category: "reconciliation", frequency: "monthly", dayOfMonth: 5, priority: "high", note: "Compare all bank accounts with their statements every month, investigate and correct differences." },
      { title: "Credit card reconciliation", category: "reconciliation", frequency: "monthly", dayOfMonth: 5, priority: "high", note: "Reconcile all credit cards monthly and file the supporting documents." },
      { title: "Monthly financial statements", category: "reporting", frequency: "monthly", dayOfMonth: 8, priority: "high", note: "Prepare the income-expense report, budget comparison and cash position for the Executive Director." },
      { title: "Department budget report", category: "budget", frequency: "monthly", dayOfMonth: 8, priority: "medium", note: "Prepare and share the per-department planned, actual and remaining budget report." },
      { title: "Monthly grant report", category: "grants", frequency: "monthly", dayOfMonth: 8, priority: "medium", note: "Produce the monthly report showing each grant's total amount, spent and remaining portions." },
      { title: "Monthly regular payments", category: "purchases", frequency: "monthly", dayOfMonth: 3, priority: "high", note: "Make regular payments such as student bursaries, rents and employee funds on time." },
      { title: "GST/HST return", category: "payroll", frequency: "quarterly", dayOfMonth: 15, priority: "high", note: "Prepare the GST/HST return and pay it by the deadline." },
      { title: "PST return", category: "payroll", frequency: "quarterly", dayOfMonth: 15, priority: "high", note: "Prepare the PST return and pay it on time." },
      { title: "Board financial summary", category: "reporting", frequency: "quarterly", dayOfMonth: 20, priority: "medium", note: "Compile financial summaries for board meetings." },
      { title: "Budget review", category: "budget", frequency: "quarterly", dayOfMonth: 20, priority: "medium", note: "Review department budget actuals and report variances." },
      { title: "Year-end closing", category: "yearend", frequency: "yearly", monthOfYear: 12, dayOfMonth: 31, priority: "high", note: "Support year-end closing and coordinate with the external accountant." },
      { title: "T4/T4A summaries", category: "payroll", frequency: "yearly", monthOfYear: 2, dayOfMonth: 28, priority: "high", note: "Verify that records are complete for the T4/T4A annual summaries." },
      { title: "T3010 draft data", category: "charity", frequency: "yearly", monthOfYear: 6, dayOfMonth: 30, priority: "high", note: "Prepare the draft data set and supporting reports for the T3010 return." },
      { title: "Audit / review support", category: "yearend", frequency: "yearly", monthOfYear: 9, dayOfMonth: 30, priority: "medium", note: "Prepare the documents and samples requested for the financial audit / review." },
      { title: "WorkSafeBC annual filing", category: "payroll", frequency: "yearly", monthOfYear: 11, dayOfMonth: 30, priority: "high", note: "File the annual WorkSafeBC report and pay the premium." }
    ];
    var timestamp = nowIsoDateTime();
    var createdBy = currentUserDisplayName();
    return seedItems.map(function (item, index) {
      return {
        id: "seed-" + pad2(index + 1),
        title: item.title,
        category: item.category,
        taskType: "regular",
        frequency: item.frequency,
        dayOfWeek: typeof item.dayOfWeek === "number" ? item.dayOfWeek : 0,
        dayOfMonth: typeof item.dayOfMonth === "number" ? item.dayOfMonth : 1,
        monthOfYear: typeof item.monthOfYear === "number" ? item.monthOfYear : 12,
        dueDate: "",
        priority: item.priority || "medium",
        note: item.note || "",
        createdAt: timestamp,
        createdBy: createdBy
      };
    });
  }

  function seedDefaultDefinitions() {
    if (!canAdminister()) return;
    var seeds = buildSeedDefinitions();
    if (!DB.definitions.length) {
      DB.definitions = seeds;
      persistDatabase();
      renderAll();
      tryNotify("Default tasks loaded", "success");
      return;
    }
    openConfirmModal("Default tasks will be added to the existing list (tasks with the same name will be skipped). Continue?", function () {
      var existingTitles = {};
      DB.definitions.forEach(function (definition) { existingTitles[definition.title.toLowerCase()] = true; });
      var addedCount = 0;
      seeds.forEach(function (seed) {
        if (existingTitles[seed.title.toLowerCase()]) return;
        DB.definitions.push(seed);
        addedCount++;
      });
      persistDatabase();
      renderAll();
      if (addedCount) tryNotify(addedCount + " default task(s) added", "success");
      else tryNotify("No new tasks to add, all are already defined", "info");
    });
  }

  function deleteDefinitionById(definitionId) {
    var index = -1;
    for (var i = 0; i < DB.definitions.length; i++) {
      if (DB.definitions[i].id === definitionId) { index = i; break; }
    }
    if (index === -1) return;
    var removedTitle = DB.definitions[index].title;
    DB.definitions.splice(index, 1);
    persistDatabase();
    renderAll();
    tryNotify('"' + removedTitle + '" deleted', "info");
  }

  function requestDefinitionDelete(definitionId) {
    var definition = findDefinitionById(definitionId);
    if (!definition) return;
    openConfirmModal('"' + definition.title + '" will be deleted. Its status records will be lost as well.', function () {
      deleteDefinitionById(definitionId);
    });
  }

  /* ============================================================
     DEFINITION MODAL
     ============================================================ */

  function openDefinitionModal(definitionId) {
    if (!canAdminister()) return;
    _editDefinitionId = definitionId || null;
    var definition = definitionId ? findDefinitionById(definitionId) : null;
    byId("bktDefModalTitle").textContent = definition ? "Edit Task" : "New Task";
    byId("bktDefTitle").value = definition ? definition.title : "";
    byId("bktDefCategory").value = definition ? definition.category : TASK_CATEGORIES[0].id;
    var isAdhoc = definition ? definition.taskType === "adHoc" : false;
    byId("bktDefTypeRegular").checked = !isAdhoc;
    byId("bktDefTypeAdhoc").checked = isAdhoc;
    byId("bktDefFreq").value = (definition && definition.frequency) ? definition.frequency : "monthly";
    byId("bktDefWeekday").value = String(definition ? definition.dayOfWeek : 0);
    byId("bktDefDay").value = String(definition ? definition.dayOfMonth : 1);
    byId("bktDefMonth").value = String(definition ? definition.monthOfYear : 12);
    byId("bktDefDueDate").value = definition ? definition.dueDate : todayIsoString();
    byId("bktDefPriority").value = definition ? definition.priority : "medium";
    byId("bktDefNote").value = definition ? definition.note : "";
    byId("bktDefError").style.display = "none";
    byId("bktDefDelete").style.display = definition ? "" : "none";
    refreshDefinitionModalFields();
    byId("bktDefModal").style.display = "flex";
  }

  function closeDefinitionModal() {
    _editDefinitionId = null;
    byId("bktDefModal").style.display = "none";
  }

  function refreshDefinitionModalFields() {
    var isAdhoc = byId("bktDefTypeAdhoc").checked;
    var frequency = byId("bktDefFreq").value;
    byId("bktDefFreqRow").style.display = isAdhoc ? "none" : "";
    byId("bktDefWeekdayRow").style.display = (!isAdhoc && (frequency === "weekly" || frequency === "biweekly")) ? "" : "none";
    byId("bktDefDayRow").style.display = (!isAdhoc && (frequency === "monthly" || frequency === "quarterly" || frequency === "yearly")) ? "" : "none";
    byId("bktDefMonthRow").style.display = (!isAdhoc && frequency === "yearly") ? "" : "none";
    byId("bktDefDueRow").style.display = isAdhoc ? "" : "none";
  }

  function saveDefinitionFromModal() {
    var title = byId("bktDefTitle").value.trim();
    var isAdhoc = byId("bktDefTypeAdhoc").checked;
    var dueDate = byId("bktDefDueDate").value;
    var errorElement = byId("bktDefError");
    function showFormError(message) {
      errorElement.textContent = message;
      errorElement.style.display = "";
    }
    if (!title) { showFormError("Task name cannot be empty."); return; }
    if (isAdhoc && !dueDate) { showFormError("Please choose a date for the ad-hoc task."); return; }
    var definitionData = {
      title: title,
      category: byId("bktDefCategory").value,
      taskType: isAdhoc ? "adHoc" : "regular",
      frequency: isAdhoc ? "" : byId("bktDefFreq").value,
      dayOfWeek: parseInt(byId("bktDefWeekday").value, 10) || 0,
      dayOfMonth: clampInt(parseInt(byId("bktDefDay").value, 10) || 1, 1, 31),
      monthOfYear: clampInt(parseInt(byId("bktDefMonth").value, 10) || 12, 1, 12),
      dueDate: isAdhoc ? dueDate : "",
      priority: byId("bktDefPriority").value,
      note: byId("bktDefNote").value.trim()
    };
    var wasEditing = !!_editDefinitionId;
    var editedDefinition = wasEditing ? findDefinitionById(_editDefinitionId) : null;
    if (editedDefinition) {
      var keys = Object.keys(definitionData);
      for (var i = 0; i < keys.length; i++) editedDefinition[keys[i]] = definitionData[keys[i]];
    } else {
      definitionData.id = uniqueId();
      definitionData.createdAt = nowIsoDateTime();
      definitionData.createdBy = currentUserDisplayName();
      DB.definitions.push(definitionData);
    }
    closeDefinitionModal();
    persistDatabase();
    renderAll();
    tryNotify(wasEditing ? "Task updated" : "Task added", "success");
  }

  /* ============================================================
     NOTE / ADMIN / CONFIRM MODALS
     ============================================================ */

  function buildLogHtml(entry) {
    if (!entry || !Array.isArray(entry.log) || !entry.log.length) {
      return '<div class="bkt-log-item">No records yet</div>';
    }
    var items = entry.log.slice().reverse().slice(0, 8);
    return items.map(function (logItem) {
      return '<div class="bkt-log-item"><strong>' + escapeHtml(statusLabelOf(logItem.status)) + "</strong>" +
        (logItem.by ? " · " + escapeHtml(logItem.by) : "") +
        (logItem.at ? " · " + formatDateTime(logItem.at) : "") + "</div>";
    }).join("");
  }

  function noteContextHtml(definition, dueDate) {
    return "<strong>" + escapeHtml(definition.title) + "</strong>" + escapeHtml(dueLabelOf(definition, dueDate));
  }

  function openNoteModal(key) {
    _noteKey = key;
    var parts = key.split("|");
    var definition = findDefinitionById(parts[0]);
    if (!definition) return;
    var entry = statusEntryFor(key);
    byId("bktNoteContext").innerHTML = noteContextHtml(definition, parts[1]);
    byId("bktNoteText").value = (entry && entry.note) ? entry.note : "";
    byId("bktNoteLog").innerHTML = buildLogHtml(entry);
    byId("bktNoteModal").style.display = "flex";
  }

  function closeNoteModal() {
    _noteKey = null;
    byId("bktNoteModal").style.display = "none";
  }

  function saveNoteFromModal() {
    if (!_noteKey) return;
    saveOccurrenceNote(_noteKey, byId("bktNoteText").value.trim());
    closeNoteModal();
  }

  function buildRequestListItemHtml(request) {
    var itemHtml = '<div class="bkt-req-item">' +
      '<div class="bkt-req-item-head">' +
      '<span class="bkt-req-type req-' + request.type + '">' + escapeHtml(requestTypeLabelOf(request.type)) + "</span>" +
      '<span class="bkt-req-status reqs-' + request.status + '">' + escapeHtml(requestStatusLabelOf(request.status)) + "</span>" +
      "</div>" +
      '<div class="bkt-req-message">' + escapeHtml(request.message) + "</div>" +
      '<div class="bkt-req-meta">' + escapeHtml(request.createdBy) + " · " + formatDateTime(request.createdAt) + "</div>";
    if (request.response) {
      itemHtml += '<div class="bkt-req-response"><strong>Response:</strong> ' + escapeHtml(request.response) +
        ' <span class="bkt-req-meta">(' + escapeHtml(request.respondedBy) + " · " + formatDateTime(request.respondedAt) + ")</span></div>";
    }
    if (canAdminister() && request.status === "open") {
      itemHtml += '<button type="button" class="bkt-mini-btn bkt-mb-confirm" data-act="respond-request" data-id="' + escapeHtml(request.id) + '">Respond</button>';
    }
    itemHtml += "</div>";
    return itemHtml;
  }

  function renderRequestListForTask(taskKey) {
    var requests = requestsForTask(taskKey);
    byId("bktRequestList").innerHTML = requests.length
      ? requests.map(buildRequestListItemHtml).join("")
      : '<div class="bkt-empty" style="padding:14px">No requests for this task yet.</div>';
  }

  function openRequestModal(taskKey) {
    var parts = taskKey.split("|");
    var definition = findDefinitionById(parts[0]);
    if (!definition) return;
    _requestTaskKey = taskKey;
    byId("bktRequestContext").innerHTML = noteContextHtml(definition, parts[1]);
    byId("bktRequestText").value = "";
    byId("bktRequestType").value = "approval";
    renderRequestListForTask(taskKey);
    byId("bktRequestForm").style.display = canWork() ? "" : "none";
    byId("bktRequestModal").style.display = "flex";
  }

  function closeRequestModal() {
    _requestTaskKey = null;
    byId("bktRequestModal").style.display = "none";
  }

  function submitRequestFromModal() {
    if (!_requestTaskKey) return;
    var message = byId("bktRequestText").value.trim();
    if (!message) return;
    createRequest(_requestTaskKey, byId("bktRequestType").value, message);
    byId("bktRequestText").value = "";
    renderRequestListForTask(_requestTaskKey);
  }

  function openRespondModal(requestId) {
    if (!canAdminister()) return;
    var request = DB.requests[requestId];
    if (!request || request.status !== "open") return;
    _respondRequestId = requestId;
    byId("bktAdminContext").innerHTML = "<strong>" + escapeHtml(request.title) + "</strong>" +
      escapeHtml(requestTypeLabelOf(request.type) + " · " + formatDateShort(request.dueDate)) +
      "<br>" + escapeHtml(request.message);
    byId("bktAdminText").value = "";
    var responseOptions = request.type === "information"
      ? '<option value="answered">Answer and Resolve</option>'
      : '<option value="approved">Approve</option><option value="declined">Decline</option>';
    byId("bktResponseStatus").innerHTML = responseOptions;
    byId("bktAdminModal").style.display = "flex";
  }

  function closeRespondModal() {
    _respondRequestId = null;
    byId("bktAdminModal").style.display = "none";
  }

  function saveRespondFromModal() {
    if (!_respondRequestId) return;
    respondToRequest(_respondRequestId, byId("bktResponseStatus").value, byId("bktAdminText").value.trim());
    closeRespondModal();
  }

  function openConfirmModal(message, yesCallback) {
    byId("bktConfirmMsg").textContent = message;
    _confirmYesCallback = yesCallback || null;
    byId("bktConfirmModal").style.display = "flex";
  }

  function closeConfirmModal() {
    _confirmYesCallback = null;
    byId("bktConfirmModal").style.display = "none";
  }

  function closeTopOverlay() {
    var overlays = [byId("bktConfirmModal"), byId("bktAdminModal"), byId("bktRequestModal"), byId("bktNoteModal"), byId("bktDefModal")];
    for (var i = 0; i < overlays.length; i++) {
      if (overlays[i] && overlays[i].style.display !== "none") {
        overlays[i].style.display = "none";
        return true;
      }
    }
    return false;
  }

  /* ============================================================
     FILTERS
     ============================================================ */

  function matchesSearchAndCategory(definition) {
    if (DB.ui.category && DB.ui.category !== "all" && definition.category !== DB.ui.category) return false;
    var searchText = (DB.ui.search || "").trim().toLowerCase();
    if (!searchText) return true;
    var haystack = (definition.title + " " + categoryLabelOf(definition.category) + " " + (definition.note || "")).toLowerCase();
    return haystack.indexOf(searchText) !== -1;
  }

  function matchesStatusFilterFor(status) {
    var statusFilter = DB.ui.statusFilter || "all";
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return isOpenStatus(status);
    return status === statusFilter;
  }

  function matchesRowFilters(definition, status) {
    if (!matchesSearchAndCategory(definition)) return false;
    return matchesStatusFilterFor(status);
  }

  /* ============================================================
     ROW / STRIP HTML BUILDERS
     ============================================================ */

  function dueLabelOf(definition, dueDate) {
    if (definition.taskType === "adHoc") return "Due: " + formatDateShort(dueDate);
    if (definition.frequency === "daily") return formatDateMedium(dueDate);
    if (definition.frequency === "weekly" || definition.frequency === "biweekly") return formatDateMedium(dueDate);
    return formatDateShort(dueDate);
  }

  function miniButtonHtml(action, statusTarget, label, key, extraClass) {
    return '<button type="button" class="bkt-mini-btn ' + (extraClass || "") + '" data-act="' + action +
      '" data-key="' + escapeHtml(key) + '"' +
      (statusTarget ? ' data-status="' + statusTarget + '"' : "") + ">" + label + "</button>";
  }

  function buildActionButtonsHtml(key, status) {
    var html = "";
    if (canWork()) {
      if (status === "pending") {
        html += miniButtonHtml("status", "inProgress", "Start", key, "bkt-mb-start");
        html += miniButtonHtml("status", "done", "Complete", key, "bkt-mb-done");
      } else if (status === "inProgress") {
        html += miniButtonHtml("status", "done", "Complete", key, "bkt-mb-done");
      } else if (status === "done") {
        html += miniButtonHtml("reset", "", "Reset", key, "");
      }
      html += miniButtonHtml("open-requests", "", "Request", key, "");
      html += miniButtonHtml("note", "", "Note", key, "");
    }
    return html;
  }

  function buildOccurrenceRowHtml(definition, dueDate) {
    var key = occurrenceKey(definition.id, dueDate);
    var entry = statusEntryFor(key);
    var status = currentStatusOf(key);
    var today = todayIsoString();
    var isOverdue = dueDate < today && isOpenStatus(status);
    var isAdhoc = definition.taskType === "adHoc";
    var openRequestCount = openRequestsForTask(key).length;
    var html = '<div class="bkt-row st-' + status + (isOverdue ? " bkt-overdue" : "") + '">';
    html += '<span class="bkt-status-pill">' + escapeHtml(statusLabelOf(status)) + "</span>";
    html += '<div class="bkt-row-main">';
    html += '<div class="bkt-row-title">' + escapeHtml(definition.title) + "</div>";
    html += '<div class="bkt-row-meta">';
    html += '<span class="bkt-type-chip ' + (isAdhoc ? "type-adhoc" : "type-regular") + '">' + (isAdhoc ? "Ad-hoc" : "Routine") + "</span>";
    html += '<span class="bkt-chip">' + escapeHtml(categoryLabelOf(definition.category)) + "</span>";
    if (!isAdhoc) html += '<span class="bkt-chip">' + escapeHtml(frequencyLabelOf(definition.frequency)) + "</span>";
    html += '<span class="bkt-prio-dot p-' + (definition.priority || "medium") + '" title="Priority: ' + escapeHtml(PRIORITY_LABELS[definition.priority] || "Medium") + '"></span>';
    html += '<span class="bkt-due">' + (isOverdue ? "Overdue · " : "") + escapeHtml(dueLabelOf(definition, dueDate)) + "</span>";
    if (openRequestCount) {
      html += '<button type="button" class="bkt-req-chip" data-act="open-requests" data-key="' + escapeHtml(key) + '">' +
        openRequestCount + " open request" + (openRequestCount > 1 ? "s" : "") + "</button>";
    }
    if (entry && entry.updatedBy && entry.updatedAt) {
      html += '<span class="bkt-updated">' + escapeHtml(entry.updatedBy) + " · " + formatDateTime(entry.updatedAt) + "</span>";
    }
    html += "</div>";
    if (entry && entry.note) html += '<div class="bkt-row-note">' + escapeHtml(entry.note) + "</div>";
    if (entry && entry.adminNote) html += '<div class="bkt-row-note bkt-note-admin">Admin: ' + escapeHtml(entry.adminNote) + "</div>";
    html += "</div>";
    html += '<div class="bkt-row-actions">' + buildActionButtonsHtml(key, status) + "</div>";
    html += "</div>";
    return html;
  }

  function buildDayStripHtml(definition, year, monthIndex, compact) {
    var dayCount = daysInMonthOf(year, monthIndex);
    var today = todayIsoString();
    var completedCount = 0;
    var dotsHtml = "";
    for (var day = 1; day <= dayCount; day++) {
      var dateIso = isoOfDate(new Date(year, monthIndex, day));
      var status = currentStatusOf(occurrenceKey(definition.id, dateIso));
      var dotClass = "bkt-dot";
      if (status === "done") { dotClass += " bkt-dot-done"; completedCount++; }
      else if (status === "inProgress") dotClass += " bkt-dot-progress";
      if (dateIso === today) dotClass += " bkt-dot-today";
      if (canWork()) dotClass += " bkt-clickable";
      dotsHtml += '<button type="button" class="' + dotClass + '"' +
        (canWork() ? ' data-act="toggle-day" data-def="' + escapeHtml(definition.id) + '" data-date="' + dateIso + '"' : "") +
        ' title="' + escapeHtml(formatDateMedium(dateIso) + " · " + statusLabelOf(status)) + '"></button>';
    }
    var headHtml = '<div class="bkt-strip-head">' +
      '<span class="bkt-strip-title">' + escapeHtml(definition.title) + "</span>" +
      (compact ? "" : '<span class="bkt-chip">' + escapeHtml(categoryLabelOf(definition.category)) + "</span>") +
      '<span class="bkt-strip-count"><strong>' + completedCount + "</strong> / " + dayCount + " days completed</span>" +
      (canWork() && !compact ? '<span class="bkt-strip-hint">click days to mark them</span>' : "") +
      "</div>";
    return '<div class="bkt-strip' + (compact ? " bkt-strip-compact" : "") + '">' + headHtml +
      '<div class="bkt-dots' + (compact ? " bkt-dots-compact" : "") + '">' + dotsHtml + "</div></div>";
  }

  function buildYearGroupHtml(definition, year) {
    var occurrences = occurrenceDatesForDefinition(definition, year, true);
    var totalCount = occurrences.length;
    var finishedCount = 0;
    occurrences.forEach(function (dueDate) {
      if (isFinishedStatus(currentStatusOf(occurrenceKey(definition.id, dueDate)))) finishedCount++;
    });
    var percentage = totalCount ? Math.round(finishedCount * 100 / totalCount) : 0;
    var expanded = !!_expandedGroups[definition.id];
    var bodyHtml = "";
    if (definition.frequency === "daily") {
      for (var monthIndex = 0; monthIndex < 12; monthIndex++) {
        bodyHtml += '<div style="font-size:11.5px;font-weight:700;color:#687384;margin:10px 0 3px;text-transform:uppercase;letter-spacing:.05em">' +
          MONTHS_FULL[monthIndex] + "</div>";
        bodyHtml += buildDayStripHtml(definition, year, monthIndex, true);
      }
    } else {
      occurrences.forEach(function (dueDate) {
        var occurrenceKeyValue = occurrenceKey(definition.id, dueDate);
        if (!matchesStatusFilterFor(currentStatusOf(occurrenceKeyValue))) return;
        bodyHtml += buildOccurrenceRowHtml(definition, dueDate);
      });
    }
    return '<div class="bkt-yr-group">' +
      '<button type="button" class="bkt-yr-head" data-act="expand" data-id="' + escapeHtml(definition.id) + '">' +
      '<span class="bkt-yr-arrow' + (expanded ? " open" : "") + '">▸</span>' +
      '<span class="bkt-yr-title">' + escapeHtml(definition.title) + "</span>" +
      '<span class="bkt-chip">' + escapeHtml(categoryLabelOf(definition.category)) + "</span>" +
      '<span class="bkt-chip">' + escapeHtml(frequencyLabelOf(definition.frequency)) + "</span>" +
      '<span class="bkt-yr-counts"><strong>' + finishedCount + "</strong> / " + totalCount + " done</span>" +
      '<span class="bkt-mini-bar"><i style="width:' + percentage + '%"></i></span>' +
      "</button>" +
      '<div class="bkt-yr-body"' + (expanded ? "" : ' style="display:none"') + ">" + bodyHtml + "</div>" +
      "</div>";
  }

  function buildDefinitionRowHtml(definition) {
    var isAdhoc = definition.taskType === "adHoc";
    var isOverdue = isAdhoc && definition.dueDate && definition.dueDate < todayIsoString() &&
      isOpenStatus(currentStatusOf(occurrenceKey(definition.id, definition.dueDate)));
    var html = '<div class="bkt-def-row">';
    html += '<div class="bkt-def-main">';
    html += '<div class="bkt-def-title">' + escapeHtml(definition.title) + "</div>";
    html += '<div class="bkt-def-meta">';
    html += '<span class="bkt-type-chip ' + (isAdhoc ? "type-adhoc" : "type-regular") + '">' + (isAdhoc ? "Ad-hoc" : "Routine") + "</span>";
    html += '<span class="bkt-chip">' + escapeHtml(categoryLabelOf(definition.category)) + "</span>";
    html += '<span class="bkt-schedule-chip">' + escapeHtml(scheduleTextOf(definition)) + "</span>";
    html += '<span class="bkt-prio-dot p-' + (definition.priority || "medium") + '" title="Priority: ' + escapeHtml(PRIORITY_LABELS[definition.priority] || "Medium") + '"></span>';
    if (isOverdue) html += '<span class="bkt-chip" style="color:#dc2626;background:#fef2f2">Overdue</span>';
    html += "</div>";
    if (definition.note) html += '<div class="bkt-def-note">' + escapeHtml(definition.note) + "</div>";
    html += "</div>";
    html += '<div class="bkt-def-actions">' +
      '<button type="button" class="bkt-mini-btn" data-act="def-edit" data-id="' + escapeHtml(definition.id) + '">Edit</button>' +
      '<button type="button" class="bkt-mini-btn" data-act="def-delete" data-id="' + escapeHtml(definition.id) + '">Delete</button>' +
      "</div></div>";
    return html;
  }

  /* ============================================================
     BOARD DATA
     ============================================================ */

  function buildBoardData() {
    var scope = DB.ui.scope || "week";
    var today = todayIsoString();
    var todayYear = parseInt(today.slice(0, 4), 10);
    var todayMonth = parseInt(today.slice(5, 7), 10) - 1;
    var rangeStart, rangeEnd;
    if (scope === "today") {
      rangeStart = today;
      rangeEnd = today;
    } else if (scope === "week") {
      rangeStart = isoOfDate(startOfWeekDate(new Date()));
      rangeEnd = addDaysToIso(rangeStart, 6);
    } else {
      rangeStart = isoOfDate(new Date(todayYear, todayMonth, 1));
      rangeEnd = isoOfDate(new Date(todayYear, todayMonth, daysInMonthOf(todayYear, todayMonth)));
    }
    var regularRows = [];
    var adhocRows = [];
    var dayStrips = [];
    DB.definitions.forEach(function (definition) {
      if (definition.taskType === "adHoc") {
        if (definition.dueDate && definition.dueDate >= rangeStart && definition.dueDate <= rangeEnd) {
          adhocRows.push({ definition: definition, dueDate: definition.dueDate });
        }
        return;
      }
      if (definition.frequency === "daily" && scope === "month") {
        dayStrips.push(definition);
        return;
      }
      occurrenceDatesForDefinition(definition, todayYear, false).forEach(function (dueDate) {
        if (dueDate >= rangeStart && dueDate <= rangeEnd) {
          regularRows.push({ definition: definition, dueDate: dueDate });
        }
      });
    });
    sortRowItems(regularRows);
    sortRowItems(adhocRows);
    var overdueRows = collectOverdueRows(scope, rangeStart);
    var stats = computeBoardStats(regularRows, adhocRows, dayStrips, overdueRows, todayYear, todayMonth);
    stats.waiting = countOpenRequestsForDueRange(rangeStart, rangeEnd);
    return {
      scope: scope,
      rangeStart: rangeStart,
      rangeEnd: rangeEnd,
      regularRows: regularRows,
      adhocRows: adhocRows,
      dayStrips: dayStrips,
      overdueRows: overdueRows,
      stats: stats
    };
  }

  function sortRowItems(items) {
    items.sort(function (a, b) {
      if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      var priorityDifference = priorityRankOf(b.definition.priority) - priorityRankOf(a.definition.priority);
      if (priorityDifference !== 0) return priorityDifference;
      return a.definition.title.localeCompare(b.definition.title, "tr");
    });
  }

  function collectOverdueRows(scope, rangeStart) {
    var today = todayIsoString();
    var todayYear = parseInt(today.slice(0, 4), 10);
    var list = [];
    var dailyRowCount = 0;
    DB.definitions.forEach(function (definition) {
      if (definition.taskType === "adHoc") {
        if (definition.dueDate && definition.dueDate < today && definition.dueDate < rangeStart) {
          var adhocKey = occurrenceKey(definition.id, definition.dueDate);
          if (isOpenStatus(currentStatusOf(adhocKey))) list.push({ definition: definition, dueDate: definition.dueDate });
        }
        return;
      }
      if (definition.frequency === "daily") {
        if (scope === "month") return;
        var dayCursor = addDaysToIso(today, -1);
        var earliestDay = addDaysToIso(today, -7);
        while (dayCursor >= earliestDay && dailyRowCount < 14) {
          var dailyKey = occurrenceKey(definition.id, dayCursor);
          if (isOpenStatus(currentStatusOf(dailyKey))) {
            list.push({ definition: definition, dueDate: dayCursor });
            dailyRowCount++;
          }
          dayCursor = addDaysToIso(dayCursor, -1);
        }
      } else {
        var missedDates = occurrenceDatesForDefinition(definition, todayYear, false).filter(function (dueDate) {
          return dueDate < today && dueDate < rangeStart;
        });
        if (missedDates.length) {
          missedDates.sort().reverse();
          var latestKey = occurrenceKey(definition.id, missedDates[0]);
          if (isOpenStatus(currentStatusOf(latestKey))) list.push({ definition: definition, dueDate: missedDates[0] });
        }
      }
    });
    list.sort(function (a, b) { return a.dueDate < b.dueDate ? 1 : a.dueDate > b.dueDate ? -1 : 0; });
    return list;
  }

  function computeBoardStats(regularRows, adhocRows, dayStrips, overdueRows, year, monthIndex) {
    var stats = { total: 0, completed: 0, inProgress: 0, waiting: 0, overdue: 0 };
    var today = todayIsoString();
    function addRow(row) {
      stats.total++;
      var status = currentStatusOf(occurrenceKey(row.definition.id, row.dueDate));
      if (isFinishedStatus(status)) stats.completed++;
      else if (status === "inProgress") stats.inProgress++;
      if (row.dueDate < today && isOpenStatus(status)) stats.overdue++;
    }
    regularRows.forEach(addRow);
    adhocRows.forEach(addRow);
    dayStrips.forEach(function (definition) {
      var dayCount = daysInMonthOf(year, monthIndex);
      stats.total += dayCount;
      for (var day = 1; day <= dayCount; day++) {
        var status = currentStatusOf(occurrenceKey(definition.id, isoOfDate(new Date(year, monthIndex, day))));
        if (isFinishedStatus(status)) stats.completed++;
        else if (status === "inProgress") stats.inProgress++;
      }
    });
    overdueRows.forEach(function (row) {
      stats.total++;
      stats.overdue++;
    });
    return stats;
  }

  function buildYearStats(year) {
    var stats = { total: 0, completed: 0, inProgress: 0, waiting: 0, overdue: 0 };
    var today = todayIsoString();
    DB.definitions.forEach(function (definition) {
      occurrenceDatesForDefinition(definition, year, true).forEach(function (dueDate) {
        stats.total++;
        var status = currentStatusOf(occurrenceKey(definition.id, dueDate));
        if (isFinishedStatus(status)) stats.completed++;
        else if (status === "inProgress") stats.inProgress++;
        if (dueDate < today && isOpenStatus(status)) stats.overdue++;
      });
    });
    stats.waiting = countOpenRequestsForYear(year);
    return stats;
  }

  /* ============================================================
     RENDER
     ============================================================ */

  function scopeRangeText(scope, rangeStart, rangeEnd) {
    if (scope === "today") return "Today · " + formatDateMedium(todayIsoString());
    if (scope === "week") return "This Week · " + formatDateShort(rangeStart) + " - " + formatDateShort(rangeEnd);
    var monthIndex = parseInt(rangeStart.slice(5, 7), 10) - 1;
    return "This Month · " + MONTHS_FULL[monthIndex] + " " + rangeStart.slice(0, 4);
  }

  function emptyMessageHtml() {
    if (!DB.definitions.length) {
      if (canAdminister()) {
        return "<strong>No tasks yet</strong>First define tasks in the \"Task Definitions\" tab, or load the standard tasks with \"Load Default Tasks\".";
      }
      return "<strong>No tasks defined yet</strong>They will appear here once your administrator defines tasks.";
    }
    return "<strong>No tasks in this view</strong>Choose a different period or filter.";
  }

  function renderAll() {
    if (!ROOT || !DB) return;
    if (DB.ui.tab === "defs" && !canAdminister()) DB.ui.tab = "board";
    renderRoleAndUser();
    renderLockBanner();
    renderToolbar();
    var tab = DB.ui.tab || "board";
    if (tab === "board") {
      var boardData = buildBoardData();
      renderRibbon(boardData.stats);
      renderBoardPane(boardData);
    } else if (tab === "dashboard") {
      renderRibbon(buildYearStats(DB.year));
      renderDashboardPane();
    } else if (tab === "year") {
      renderRibbon(buildYearStats(DB.year));
      renderYearPane();
    } else {
      renderRibbon(buildYearStats(DB.year));
      renderDefinitionsPane();
    }
    try { tool.resize(); } catch (error) {}
  }

  function renderRoleAndUser() {
    var badge = byId("bktRoleBadge");
    if (canAdminister()) {
      badge.className = "bkt-role-badge role-admin";
      badge.textContent = "Admin";
    } else if (canWork()) {
      badge.className = "bkt-role-badge role-bookkeeper";
      badge.textContent = "Bookkeeper";
    } else {
      badge.className = "bkt-role-badge role-viewer";
      badge.textContent = "Viewer";
    }
    var nameElement = byId("bktUserName");
    if (_user && _user.name) nameElement.textContent = _user.name;
    else if (_noIdentity) nameElement.textContent = "CMS session";
    else nameElement.textContent = "—";
  }

  function renderLockBanner() {
    var banner = byId("bktLockBanner");
    if (readOnly) {
      banner.style.display = "";
      banner.textContent = "Read-only view: changes cannot be made in this form.";
    } else if (!canWork() && !canAdminister()) {
      banner.style.display = "";
      banner.textContent = "You have view-only permission: task statuses cannot be changed.";
    } else {
      banner.style.display = "none";
    }
  }

  function renderToolbar() {
    var tab = DB.ui.tab || "board";
    queryAll(".bkt-tab").forEach(function (tabButton) {
      tabButton.classList.toggle("active", tabButton.getAttribute("data-tab") === tab);
    });
    byId("bktTabDefs").style.display = canAdminister() ? "" : "none";
    byId("bktScopeRow").style.display = tab === "board" ? "" : "none";
    byId("bktYearRow").style.display = (tab === "year" || tab === "defs" || tab === "dashboard") ? "" : "none";
    byId("bktYearLabel").textContent = String(DB.year);
    queryAll(".bkt-scope-chip").forEach(function (scopeChip) {
      scopeChip.classList.toggle("active", scopeChip.getAttribute("data-scope") === (DB.ui.scope || "week"));
    });
    if (tab === "board") {
      var boardRange = buildBoardData();
      byId("bktScopeHint").textContent = scopeRangeText(boardRange.scope, boardRange.rangeStart, boardRange.rangeEnd);
    }
    fillFilterSelects();
    byId("bktPaneBoard").style.display = tab === "board" ? "" : "none";
    byId("bktPaneDashboard").style.display = tab === "dashboard" ? "" : "none";
    byId("bktPaneYear").style.display = tab === "year" ? "" : "none";
    byId("bktPaneDefs").style.display = tab === "defs" ? "" : "none";
    var adminVisible = canAdminister() ? "" : "none";
    byId("bktBtnNewDef").style.display = adminVisible;
    byId("bktBtnSeed").style.display = adminVisible;
  }

  function fillFilterSelects() {
    var categorySelect = byId("bktCatFilter");
    var categoryOptions = '<option value="all">All Categories</option><option value="">Uncategorized</option>';
    TASK_CATEGORIES.forEach(function (category) {
      categoryOptions += '<option value="' + escapeHtml(category.id) + '">' + escapeHtml(category.label) + "</option>";
    });
    categorySelect.innerHTML = categoryOptions;
    categorySelect.value = DB.ui.category || "all";
    var statusSelect = byId("bktStatusFilter");
    var statusOptions = "";
    STATUS_FILTER_OPTIONS.forEach(function (option) {
      statusOptions += '<option value="' + escapeHtml(option.id) + '">' + escapeHtml(option.label) + "</option>";
    });
    statusSelect.innerHTML = statusOptions;
    statusSelect.value = DB.ui.statusFilter || "all";
  }

  function renderRibbon(stats) {
    byId("bktStatTotal").textContent = String(stats.total);
    byId("bktStatDone").textContent = String(stats.completed);
    byId("bktStatProgress").textContent = String(stats.inProgress);
    byId("bktStatWaiting").textContent = String(stats.waiting);
    byId("bktStatOverdue").textContent = String(stats.overdue);
    var percentage = stats.total ? Math.round(stats.completed * 100 / stats.total) : 0;
    byId("bktProgressBar").style.width = percentage + "%";
    byId("bktProgressPct").textContent = "%" + percentage;
  }

  function buildRequestInboxRowHtml(request) {
    return '<div class="bkt-req-row">' +
      '<span class="bkt-req-type req-' + request.type + '">' + escapeHtml(requestTypeLabelOf(request.type)) + "</span>" +
      '<div class="bkt-req-main">' +
      '<div class="bkt-req-title">' + escapeHtml(request.title) + "</div>" +
      '<div class="bkt-req-meta">' + escapeHtml(formatDateShort(request.dueDate)) + " · " + escapeHtml(request.createdBy) + " · " + formatDateTime(request.createdAt) + "</div>" +
      '<div class="bkt-req-message">' + escapeHtml(request.message) + "</div>" +
      "</div>" +
      '<div class="bkt-row-actions"><button type="button" class="bkt-mini-btn bkt-mb-confirm" data-act="respond-request" data-id="' + escapeHtml(request.id) + '">Respond</button></div>' +
      "</div>";
  }

  function renderBoardPane(boardData) {
    var openRequests = collectOpenRequests();
    var approvalSection = byId("bktApprovalSection");
    if (canAdminister() && openRequests.length) {
      approvalSection.style.display = "";
      byId("bktApprovalCount").textContent = String(openRequests.length);
      byId("bktApprovalList").innerHTML = openRequests.map(buildRequestInboxRowHtml).join("");
    } else {
      approvalSection.style.display = "none";
    }

    var filteredOverdue = boardData.overdueRows.filter(function (row) {
      return matchesRowFilters(row.definition, currentStatusOf(occurrenceKey(row.definition.id, row.dueDate)));
    });
    var overdueSection = byId("bktOverdueSection");
    if (filteredOverdue.length) {
      overdueSection.style.display = "";
      byId("bktOverdueList").innerHTML = filteredOverdue.map(function (row) {
        return buildOccurrenceRowHtml(row.definition, row.dueDate);
      }).join("");
    } else {
      overdueSection.style.display = "none";
    }

    var todayYear = parseInt(todayIsoString().slice(0, 4), 10);
    var todayMonth = parseInt(todayIsoString().slice(5, 7), 10) - 1;
    var regularHtmlParts = [];
    boardData.dayStrips.forEach(function (definition) {
      if (matchesSearchAndCategory(definition)) {
        regularHtmlParts.push(buildDayStripHtml(definition, todayYear, todayMonth, false));
      }
    });
    var filteredRegular = boardData.regularRows.filter(function (row) {
      return matchesRowFilters(row.definition, currentStatusOf(occurrenceKey(row.definition.id, row.dueDate)));
    });
    var filteredAdhoc = boardData.adhocRows.filter(function (row) {
      return matchesRowFilters(row.definition, currentStatusOf(occurrenceKey(row.definition.id, row.dueDate)));
    });
    var listHtml = "";
    if (regularHtmlParts.length || filteredRegular.length) {
      listHtml += '<div class="bkt-section-head"><span class="bkt-section-title">Routine Tasks</span>' +
        '<span class="bkt-section-sub">' + (regularHtmlParts.length + filteredRegular.length) + " tasks</span></div>";
      listHtml += regularHtmlParts.join("");
      listHtml += filteredRegular.map(function (row) {
        return buildOccurrenceRowHtml(row.definition, row.dueDate);
      }).join("");
    }
    if (filteredAdhoc.length) {
      listHtml += '<div class="bkt-section-head"><span class="bkt-section-title">Ad-hoc Tasks</span>' +
        '<span class="bkt-section-sub">' + filteredAdhoc.length + " tasks</span></div>";
      listHtml += filteredAdhoc.map(function (row) {
        return buildOccurrenceRowHtml(row.definition, row.dueDate);
      }).join("");
    }
    byId("bktBoardList").innerHTML = listHtml;
    byId("bktBoardSection").style.display = listHtml ? "" : "none";
    byId("bktBoardSub").textContent = scopeRangeText(boardData.scope, boardData.rangeStart, boardData.rangeEnd);
    var hasAnything = listHtml !== "" || filteredOverdue.length > 0 || (canAdminister() && openRequests.length > 0);
    byId("bktBoardEmpty").style.display = hasAnything ? "none" : "";
    if (!hasAnything) byId("bktBoardEmpty").innerHTML = emptyMessageHtml();
  }

  function renderYearPane() {
    var year = DB.year;
    var regularDefinitions = [];
    var adhocDefinitions = [];
    DB.definitions.forEach(function (definition) {
      if (definition.taskType === "adHoc") {
        if (definition.dueDate && definition.dueDate.slice(0, 4) === String(year)) adhocDefinitions.push(definition);
      } else {
        regularDefinitions.push(definition);
      }
    });
    regularDefinitions.sort(function (a, b) {
      var orderDifference = frequencyOrderOf(a) - frequencyOrderOf(b);
      if (orderDifference !== 0) return orderDifference;
      return a.title.localeCompare(b.title, "tr");
    });
    adhocDefinitions.sort(function (a, b) {
      if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      return a.title.localeCompare(b.title, "tr");
    });
    var html = "";
    var filteredAdhoc = adhocDefinitions.filter(matchesSearchAndCategory);
    if (filteredAdhoc.length) {
      html += '<div class="bkt-yr-adhoc-head">Ad-hoc Tasks</div>';
      html += filteredAdhoc.map(function (definition) {
        return buildOccurrenceRowHtml(definition, definition.dueDate);
      }).join("");
    }
    regularDefinitions.forEach(function (definition) {
      if (!matchesSearchAndCategory(definition)) return;
      html += buildYearGroupHtml(definition, year);
    });
    byId("bktYearList").innerHTML = html;
    byId("bktYearEmpty").style.display = html ? "none" : "";
    if (!html) byId("bktYearEmpty").innerHTML = emptyMessageHtml();
  }

  function renderDefinitionsPane() {
    var regularDefinitions = [];
    var adhocDefinitions = [];
    DB.definitions.forEach(function (definition) {
      if (definition.taskType === "adHoc") adhocDefinitions.push(definition);
      else regularDefinitions.push(definition);
    });
    regularDefinitions.sort(function (a, b) {
      var orderDifference = frequencyOrderOf(a) - frequencyOrderOf(b);
      if (orderDifference !== 0) return orderDifference;
      return a.title.localeCompare(b.title, "tr");
    });
    adhocDefinitions.sort(function (a, b) {
      if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      return a.title.localeCompare(b.title, "tr");
    });
    byId("bktDefsRegularCount").textContent = regularDefinitions.length ? regularDefinitions.length + " tasks" : "";
    byId("bktDefsAdhocCount").textContent = adhocDefinitions.length ? adhocDefinitions.length + " tasks" : "";
    byId("bktDefsRegular").innerHTML = regularDefinitions.length
      ? regularDefinitions.map(buildDefinitionRowHtml).join("")
      : '<div class="bkt-empty" style="padding:18px">No routine tasks yet. Add them with "+ New Task" or load the defaults.</div>';
    byId("bktDefsAdhoc").innerHTML = adhocDefinitions.length
      ? adhocDefinitions.map(buildDefinitionRowHtml).join("")
      : '<div class="bkt-empty" style="padding:18px">No ad-hoc tasks yet. Add one-off tasks here.</div>';
  }

  /* ============================================================
     DASHBOARD
     ============================================================ */

  function completionDateOf(entry) {
    if (!entry) return "";
    return entry.completedAt || entry.confirmedAt || "";
  }

  function formatPercent(numerator, denominator) {
    if (!denominator) return "%0";
    var value = numerator * 100 / denominator;
    if (value > 0 && value < 1) return "%" + (Math.round(value * 10) / 10);
    return "%" + Math.round(value);
  }

  function buildDashboardData() {
    var year = DB.year;
    var today = todayIsoString();
    var dailyOverdueCutoff = addDaysToIso(today, -7);
    var upcomingCutoff = addDaysToIso(today, 7);
    var months = [];
    for (var monthIndex = 0; monthIndex < 12; monthIndex++) {
      months.push({ monthIndex: monthIndex, total: 0, completed: 0, onTime: 0, timed: 0, inProgress: 0, openRequests: 0, overdue: 0 });
    }
    var categoryMap = {};
    var split = { routine: { total: 0, completed: 0 }, adhoc: { total: 0, completed: 0 } };
    var activity = [];
    var overall = { total: 0, completed: 0, onTime: 0, timed: 0, inProgress: 0, openRequests: 0, overdue: 0, upcoming7: 0 };

    DB.definitions.forEach(function (definition) {
      var isAdhoc = definition.taskType === "adHoc";
      var category = categoryMap[definition.category];
      if (!category) {
        category = categoryMap[definition.category] = { label: categoryLabelOf(definition.category), total: 0, completed: 0, overdue: 0 };
      }
      var latestOpenOverdueDue = "";
      occurrenceDatesForDefinition(definition, year, true).forEach(function (dueDate) {
        var entry = statusEntryFor(occurrenceKey(definition.id, dueDate));
        var status = entry ? entry.status : "pending";
        var monthData = months[parseInt(dueDate.slice(5, 7), 10) - 1];
        var bucket = isAdhoc ? split.adhoc : split.routine;
        monthData.total++;
        overall.total++;
        category.total++;
        bucket.total++;
        if (isFinishedStatus(status)) {
          monthData.completed++;
          overall.completed++;
          category.completed++;
          bucket.completed++;
          var completedDate = completionDateOf(entry);
          if (completedDate) {
            overall.timed++;
            monthData.timed++;
            if (localDateOfIsoDateTime(completedDate) <= dueDate) {
              monthData.onTime++;
              overall.onTime++;
            }
          }
        } else if (status === "inProgress") {
          overall.inProgress++;
          monthData.inProgress++;
        }
        if (dueDate < today && isOpenStatus(status)) {
          if (definition.frequency === "daily") {
            if (dueDate >= dailyOverdueCutoff) {
              overall.overdue++;
              monthData.overdue++;
              category.overdue++;
            }
          } else if (isAdhoc) {
            overall.overdue++;
            monthData.overdue++;
            category.overdue++;
          } else {
            if (dueDate > latestOpenOverdueDue) latestOpenOverdueDue = dueDate;
          }
        }
        if (isOpenStatus(status) && dueDate >= today && dueDate <= upcomingCutoff) overall.upcoming7++;
        if (entry && Array.isArray(entry.log)) {
          entry.log.forEach(function (logItem) {
            if (logItem.at) activity.push({ title: definition.title, dueDate: dueDate, status: logItem.status, at: logItem.at, by: logItem.by || "" });
          });
        }
      });
      if (latestOpenOverdueDue) {
        overall.overdue++;
        months[parseInt(latestOpenOverdueDue.slice(5, 7), 10) - 1].overdue++;
        category.overdue++;
      }
    });

    activity.sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; });
    activity = activity.slice(0, 12);

    Object.keys(DB.requests).forEach(function (requestId) {
      var request = DB.requests[requestId];
      if (!request || request.status !== "open" || !request.dueDate) return;
      if (request.dueDate.slice(0, 4) !== String(year)) return;
      overall.openRequests++;
      months[parseInt(request.dueDate.slice(5, 7), 10) - 1].openRequests++;
    });

    var categories = Object.keys(categoryMap).map(function (id) { return categoryMap[id]; });
    categories.sort(function (a, b) { return b.total - a.total; });

    return { year: year, months: months, categories: categories, split: split, activity: activity, overall: overall };
  }

  function dashCardHtml(className, valueHtml, label, subHtml) {
    return '<div class="bkt-dash-card ' + className + '">' +
      '<div class="bkt-dash-value">' + valueHtml + "</div>" +
      '<div class="bkt-dash-label">' + label + "</div>" +
      '<div class="bkt-dash-sub">' + subHtml + "</div></div>";
  }

  function buildMonthChartSvg(months) {
    var width = 660;
    var height = 252;
    var left = 46;
    var right = 8;
    var top = 16;
    var bottom = 30;
    var plotWidth = width - left - right;
    var plotHeight = height - top - bottom;
    var maxTotal = 1;
    months.forEach(function (monthData) { if (monthData.total > maxTotal) maxTotal = monthData.total; });
    var html = '<svg viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="Month-by-month completion chart">';
    for (var grid = 0; grid <= 4; grid++) {
      var gridY = top + plotHeight - (plotHeight * grid / 4);
      var gridValue = Math.round(maxTotal * grid / 4);
      html += '<line class="bkt-gridline" x1="' + left + '" y1="' + gridY + '" x2="' + (width - right) + '" y2="' + gridY + '"></line>';
      html += '<text class="bkt-axis-label" x="' + (left - 7) + '" y="' + (gridY + 4) + '" text-anchor="end">' + gridValue + "</text>";
    }
    var slotWidth = plotWidth / 12;
    var barWidth = Math.min(18, slotWidth * 0.5);
    months.forEach(function (monthData, index) {
      var centerX = left + slotWidth * index + slotWidth / 2;
      var totalHeight = monthData.total ? plotHeight * monthData.total / maxTotal : 0;
      var doneHeight = monthData.completed ? plotHeight * monthData.completed / maxTotal : 0;
      var barX = centerX - barWidth / 2;
      html += '<rect class="bkt-bar-total" x="' + barX + '" y="' + (top + plotHeight - totalHeight) + '" width="' + barWidth + '" height="' + totalHeight + '" rx="2">' +
        "<title>" + MONTHS_FULL[monthData.monthIndex] + ": " + monthData.completed + " of " + monthData.total + " completed</title></rect>";
      html += '<rect class="bkt-bar-done" x="' + barX + '" y="' + (top + plotHeight - doneHeight) + '" width="' + barWidth + '" height="' + doneHeight + '" rx="2">' +
        "<title>" + MONTHS_FULL[monthData.monthIndex] + ": " + monthData.completed + " of " + monthData.total + " completed</title></rect>";
      html += '<text class="bkt-axis-label" x="' + centerX + '" y="' + (height - 9) + '" text-anchor="middle">' + MONTHS_SHORT[monthData.monthIndex] + "</text>";
    });
    var segments = [];
    var currentSegment = [];
    months.forEach(function (monthData, index) {
      if (!monthData.total) {
        if (currentSegment.length) { segments.push(currentSegment); currentSegment = []; }
        return;
      }
      var centerX = left + slotWidth * index + slotWidth / 2;
      var rate = monthData.onTime / monthData.total;
      var lineY = top + plotHeight - plotHeight * rate;
      currentSegment.push(Math.round(centerX) + "," + Math.round(lineY));
    });
    if (currentSegment.length) segments.push(currentSegment);
    segments.forEach(function (segmentPoints) {
      html += '<polyline class="bkt-line-ontime" points="' + segmentPoints.join(" ") + '"></polyline>';
    });
    months.forEach(function (monthData, index) {
      if (!monthData.total) return;
      var centerX = left + slotWidth * index + slotWidth / 2;
      var rate = monthData.onTime / monthData.total;
      var lineY = top + plotHeight - plotHeight * rate;
      html += '<circle class="bkt-dot-ontime" cx="' + Math.round(centerX) + '" cy="' + Math.round(lineY) + '" r="3">' +
        "<title>" + MONTHS_FULL[monthData.monthIndex] + " on-time rate: " + Math.round(rate * 100) + "%</title></circle>";
    });
    html += "</svg>";
    return html;
  }

  function buildCategoryRowsHtml(categories) {
    return categories.map(function (category) {
      var percentage = category.total ? Math.round(category.completed * 100 / category.total) : 0;
      return '<div class="bkt-cat-row">' +
        '<div class="bkt-cat-label">' + escapeHtml(category.label) + "</div>" +
        '<div class="bkt-cat-bar-wrap"><div class="bkt-cat-fill" style="width:' + percentage + '%"></div></div>' +
        '<div class="bkt-cat-counts">' + category.completed + " / " + category.total +
        (category.overdue ? ' · <span class="bkt-cat-overdue">' + category.overdue + " overdue</span>" : "") +
        "</div></div>";
    }).join("");
  }

  function buildSplitHtml(split) {
    function splitCardHtml(bucket, label) {
      var percentage = bucket.total ? Math.round(bucket.completed * 100 / bucket.total) : 0;
      return '<div class="bkt-split-card">' +
        '<div class="bkt-split-title">' + label + "</div>" +
        '<div class="bkt-split-value">' + bucket.completed + ' <span class="bkt-split-of">/ ' + bucket.total + " · %" + percentage + "</span></div>" +
        '<div class="bkt-split-bar"><div class="bkt-split-fill" style="width:' + percentage + '%"></div></div>' +
        "</div>";
    }
    return splitCardHtml(split.routine, "Routine Tasks") + splitCardHtml(split.adhoc, "Ad-hoc Tasks");
  }

  function buildActivityHtml(activity) {
    if (!activity.length) return '<div class="bkt-empty" style="padding:18px">No activity recorded yet.</div>';
    return activity.map(function (item) {
      return '<div class="bkt-act-row st-' + item.status + '">' +
        '<span class="bkt-status-pill">' + escapeHtml(statusLabelOf(item.status)) + "</span>" +
        '<div class="bkt-act-main">' +
        '<div class="bkt-act-title">' + escapeHtml(item.title) + "</div>" +
        '<div class="bkt-act-meta">' + escapeHtml(formatDateShort(item.dueDate)) + " · " + escapeHtml(item.by) + " · " + formatDateTime(item.at) + "</div>" +
        "</div></div>";
    }).join("");
  }

  function buildDashMonthChipsHtml(dashMonth) {
    var html = '<button type="button" class="bkt-scope-chip' + (dashMonth === "year" ? " active" : "") + '" data-act="dash-month" data-month="year">Year</button>';
    for (var monthIndex = 0; monthIndex < 12; monthIndex++) {
      html += '<button type="button" class="bkt-scope-chip' + (dashMonth === monthIndex ? " active" : "") + '" data-act="dash-month" data-month="' + monthIndex + '">' + MONTHS_SHORT[monthIndex] + "</button>";
    }
    return html;
  }

  function buildMonthTableHtml(months, dashMonth) {
    var html = '<table class="bkt-month-table"><thead><tr>' +
      "<th>Month</th><th class=\"num\">Due</th><th class=\"num\">Completed</th><th class=\"num\">%</th><th class=\"num\">On Time</th><th class=\"num\">Overdue</th>" +
      "</tr></thead><tbody>";
    months.forEach(function (monthData) {
      var selected = dashMonth === monthData.monthIndex;
      html += '<tr class="bkt-month-click' + (selected ? " bkt-month-selected" : "") + '" data-act="dash-month" data-month="' + monthData.monthIndex + '">' +
        '<td class="bkt-mt-month">' + MONTHS_FULL[monthData.monthIndex] + "</td>" +
        '<td class="num">' + monthData.total + "</td>" +
        '<td class="num">' + monthData.completed + "</td>" +
        '<td class="num">' + formatPercent(monthData.completed, monthData.total) + "</td>" +
        '<td class="num">' + monthData.onTime + "</td>" +
        '<td class="num' + (monthData.overdue ? " bkt-mt-over" : "") + '">' + monthData.overdue + "</td>" +
        "</tr>";
    });
    html += "</tbody></table>";
    return html;
  }

  function renderDashboardPane() {
    var dashboardData = buildDashboardData();
    var overall = dashboardData.overall;
    var dashMonth = DB.ui.dashMonth;
    var isMonthView = dashMonth !== "year";
    var monthSource = isMonthView ? dashboardData.months[dashMonth] : null;
    if (isMonthView && monthSource) {
      byId("bktDashCards").innerHTML =
        dashCardHtml("card-done", String(monthSource.completed), "Completed", "of " + monthSource.total + " · " + formatPercent(monthSource.completed, monthSource.total)) +
        dashCardHtml("card-ontime", formatPercent(monthSource.onTime, monthSource.timed), "On Time", monthSource.onTime + " of " + monthSource.timed + " completed on time") +
        dashCardHtml("card-wait", String(monthSource.openRequests), "Open Requests", "approval or information requests waiting") +
        dashCardHtml("card-progress", String(monthSource.inProgress), "In Progress", "currently being worked on") +
        dashCardHtml("card-overdue", String(monthSource.overdue), "Overdue", "past due and not finished") +
        dashCardHtml("card-late", String(Math.max(monthSource.timed - monthSource.onTime, 0)), "Late Completions", "finished after their due date");
    } else {
      byId("bktDashCards").innerHTML =
        dashCardHtml("card-done", String(overall.completed), "Completed", "of " + overall.total + " · " + formatPercent(overall.completed, overall.total)) +
        dashCardHtml("card-ontime", formatPercent(overall.onTime, overall.timed), "On Time", overall.onTime + " of " + overall.timed + " completed on time") +
        dashCardHtml("card-wait", String(overall.openRequests), "Open Requests", "approval or information requests waiting") +
        dashCardHtml("card-progress", String(overall.inProgress), "In Progress", "currently being worked on") +
        dashCardHtml("card-overdue", String(overall.overdue), "Overdue", "past due and not finished") +
        dashCardHtml("card-upcoming", String(overall.upcoming7), "Upcoming 7 Days", "due in the next 7 days");
    }
    byId("bktDashSummaryLabel").textContent = isMonthView ? MONTHS_FULL[dashMonth] + " " + DB.year : "All Year · " + DB.year;
    byId("bktDashMonthChips").innerHTML = buildDashMonthChipsHtml(dashMonth);
    byId("bktDashMonthTable").innerHTML = buildMonthTableHtml(dashboardData.months, dashMonth);
    byId("bktDashYearLabel").textContent = String(DB.year);
    byId("bktDashMonthChart").innerHTML = buildMonthChartSvg(dashboardData.months) +
      '<div class="bkt-chart-legend">' +
      '<span class="bkt-legend-item"><i class="bkt-legend-swatch bkt-swatch-done"></i>Completed</span>' +
      '<span class="bkt-legend-item"><i class="bkt-legend-swatch bkt-swatch-total"></i>Total due</span>' +
      '<span class="bkt-legend-item"><i class="bkt-legend-line"></i>On-time rate</span>' +
      "</div>";
    byId("bktDashCategories").innerHTML = dashboardData.categories.length
      ? buildCategoryRowsHtml(dashboardData.categories)
      : '<div class="bkt-empty" style="padding:18px">No category data.</div>';
    byId("bktDashActivity").innerHTML = buildActivityHtml(dashboardData.activity);
    byId("bktDashSplit").innerHTML = buildSplitHtml(dashboardData.split);
    var hasDefinitions = DB.definitions.length > 0;
    byId("bktDashEmpty").style.display = hasDefinitions ? "none" : "";
    byId("bktDashContent").style.display = hasDefinitions ? "" : "none";
    if (!hasDefinitions) byId("bktDashEmpty").innerHTML = emptyMessageHtml();
  }

  /* ============================================================
     EVENTS
     ============================================================ */

  function handleActionClick(actionElement) {
    var action = actionElement.getAttribute("data-act");
    if (action === "tab") {
      DB.ui.tab = actionElement.getAttribute("data-tab");
      persistDatabase();
      renderAll();
    } else if (action === "scope") {
      DB.ui.scope = actionElement.getAttribute("data-scope");
      persistDatabase();
      renderAll();
    } else if (action === "year-nav") {
      var delta = parseInt(actionElement.getAttribute("data-nav"), 10);
      DB.year = clampInt(DB.year + delta, 2000, 2100);
      persistDatabase();
      renderAll();
    } else if (action === "status") {
      setOccurrenceStatus(actionElement.getAttribute("data-key"), actionElement.getAttribute("data-status"));
    } else if (action === "toggle-day") {
      toggleDayCompletion(actionElement.getAttribute("data-def"), actionElement.getAttribute("data-date"));
    } else if (action === "note") {
      openNoteModal(actionElement.getAttribute("data-key"));
    } else if (action === "dash-month") {
      var monthValue = actionElement.getAttribute("data-month");
      DB.ui.dashMonth = monthValue === "year" ? "year" : clampInt(monthValue, 0, 11);
      persistDatabase();
      renderAll();
    } else if (action === "expand") {
      var definitionId = actionElement.getAttribute("data-id");
      _expandedGroups[definitionId] = !_expandedGroups[definitionId];
      renderAll();
    } else if (action === "def-edit") {
      openDefinitionModal(actionElement.getAttribute("data-id"));
    } else if (action === "def-delete") {
      requestDefinitionDelete(actionElement.getAttribute("data-id"));
    } else if (action === "reset") {
      setOccurrenceStatus(actionElement.getAttribute("data-key"), "pending");
    } else if (action === "open-requests") {
      openRequestModal(actionElement.getAttribute("data-key"));
    } else if (action === "respond-request") {
      openRespondModal(actionElement.getAttribute("data-id"));
    }
  }

  function wireEvents() {
    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !target.classList) return;
      if (target.classList.contains("bkt-modal-overlay")) {
        target.style.display = "none";
        return;
      }
      var actionElement = target.closest ? target.closest("[data-act]") : null;
      if (actionElement) handleActionClick(actionElement);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeTopOverlay();
    });

    byId("bktSearch").addEventListener("input", function () {
      DB.ui.search = this.value;
      persistDatabase();
      renderAll();
    });
    byId("bktCatFilter").addEventListener("change", function () {
      DB.ui.category = this.value;
      persistDatabase();
      renderAll();
    });
    byId("bktStatusFilter").addEventListener("change", function () {
      DB.ui.statusFilter = this.value;
      persistDatabase();
      renderAll();
    });

    byId("bktBtnNewDef").addEventListener("click", function () { openDefinitionModal(null); });
    byId("bktBtnSeed").addEventListener("click", seedDefaultDefinitions);
    byId("bktDefClose").addEventListener("click", closeDefinitionModal);
    byId("bktDefCancel").addEventListener("click", closeDefinitionModal);
    byId("bktDefSave").addEventListener("click", saveDefinitionFromModal);
    byId("bktDefDelete").addEventListener("click", function () {
      if (_editDefinitionId) requestDefinitionDelete(_editDefinitionId);
    });
    byId("bktDefTypeRegular").addEventListener("change", refreshDefinitionModalFields);
    byId("bktDefTypeAdhoc").addEventListener("change", refreshDefinitionModalFields);
    byId("bktDefFreq").addEventListener("change", refreshDefinitionModalFields);

    byId("bktNoteClose").addEventListener("click", closeNoteModal);
    byId("bktNoteCancel").addEventListener("click", closeNoteModal);
    byId("bktNoteSave").addEventListener("click", saveNoteFromModal);

    byId("bktAdminClose").addEventListener("click", closeRespondModal);
    byId("bktAdminCancel").addEventListener("click", closeRespondModal);
    byId("bktAdminSave").addEventListener("click", saveRespondFromModal);

    byId("bktRequestClose").addEventListener("click", closeRequestModal);
    byId("bktRequestCancel").addEventListener("click", closeRequestModal);
    byId("bktRequestSubmit").addEventListener("click", submitRequestFromModal);

    byId("bktConfirmClose").addEventListener("click", closeConfirmModal);
    byId("bktConfirmNo").addEventListener("click", closeConfirmModal);
    byId("bktConfirmYes").addEventListener("click", function () {
      var callback = _confirmYesCallback;
      closeConfirmModal();
      if (callback) callback();
    });

    /* Fill the definition form selects */
    var categoryOptions = "";
    TASK_CATEGORIES.forEach(function (category) {
      categoryOptions += '<option value="' + escapeHtml(category.id) + '">' + escapeHtml(category.label) + "</option>";
    });
    byId("bktDefCategory").innerHTML = categoryOptions;
    var frequencyOptions = "";
    TASK_FREQUENCIES.forEach(function (frequency) {
      frequencyOptions += '<option value="' + escapeHtml(frequency.id) + '">' + escapeHtml(frequency.label) + "</option>";
    });
    byId("bktDefFreq").innerHTML = frequencyOptions;
    var weekdayOptions = "";
    for (var weekday = 0; weekday < 7; weekday++) {
      weekdayOptions += '<option value="' + weekday + '">' + escapeHtml(DAYS_FULL[weekday]) + "</option>";
    }
    byId("bktDefWeekday").innerHTML = weekdayOptions;
    var monthOptions = "";
    for (var monthNumber = 1; monthNumber <= 12; monthNumber++) {
      monthOptions += '<option value="' + monthNumber + '">' + escapeHtml(MONTHS_FULL[monthNumber - 1]) + "</option>";
    }
    byId("bktDefMonth").innerHTML = monthOptions;
    var priorityOptions = "";
    PRIORITY_IDS.forEach(function (priorityId) {
      priorityOptions += '<option value="' + priorityId + '">' + escapeHtml(PRIORITY_LABELS[priorityId]) + "</option>";
    });
    byId("bktDefPriority").innerHTML = priorityOptions;
  }

  function declareToolContract() {
    try {
      tool.declareOutput({
        type: "object",
        properties: {
          version: { type: "number" },
          year: { type: "number", description: "Year of the yearly plan" },
          definitions: { type: "array", description: "Task definitions (routine and ad-hoc)" },
          statuses: { type: "object", description: "Status records for task occurrences" },
          requests: { type: "object", description: "Approval and information requests attached to tasks" },
          ui: { type: "object", description: "Interface state" }
        }
      });
    } catch (error) {}
    try { tool.reportValid(true, ""); } catch (error) {}
  }

  /* ============================================================
     ENTRY POINT
     ============================================================ */

  tool.onReady(function (initialValue) {
    ROOT = document.querySelector(".bkt");
    if (!ROOT) return;
    DB = normalizeDatabase(initialValue);
    try { readOnly = tool.isReadOnly() === true; } catch (error) { readOnly = false; }
    wireEvents();
    declareToolContract();
    refreshIdentity();
    renderAll();
    startIdentityPolling();

    tool.onValueChange(function (newValue) {
      if (_savingNow) return;
      var serialized = JSON.stringify(newValue == null ? null : newValue);
      if (serialized === _lastStagedJson) return;
      DB = normalizeDatabase(newValue);
      renderAll();
    });

    tool.onReadonlyChange(function (readOnlyFlag) {
      readOnly = readOnlyFlag === true;
      renderAll();
    });

    tool.onUserChange(function (user) {
      _user = user;
      _noIdentity = false;
      renderAll();
    });

    tool.onFieldsChange(function () {});
  });
})();
