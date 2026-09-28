/* ============================================================
   Recurring Task Manager - JS
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

  function defaultCategoryList() {
    return TASK_CATEGORIES.map(function (category) {
      return { id: category.id, label: category.label };
    });
  }

  function sanitizeCategoryList(rawList) {
    var seenIds = {};
    var result = [];
    (rawList || []).forEach(function (rawCategory) {
      if (!rawCategory || typeof rawCategory !== "object") return;
      var categoryId = String(rawCategory.id || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
      var label = String(rawCategory.label || "").trim();
      if (!categoryId || !label || seenIds[categoryId]) return;
      seenIds[categoryId] = true;
      result.push({ id: categoryId, label: label });
    });
    return result;
  }

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

  var DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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
  var _saveRetryTimer = null;
  var _savingNow = false;
  var _dirty = false;
  var _lastStagedJson = null;
  var _warnedAutosave = false;
  var _editDefinitionId = null;
  var _drawerKey = null;
  var _chatStore = { chats: {} };
  var _chatStoreLoaded = false;
  var _chatStoreDirty = false;
  var _chatStoreTimer = null;
  var _chatExternal = false;
  var _aiSuggestions = null;
  var _aiSuggestionsMonth = null;
  var _aiSuggestBusy = false;
  var CHAT_OBJECT_TYPE = "recurring-task-chats-uniconbaseapps";
  var _pinEditing = null;
  var _respondRequestId = null;
  var _confirmYesCallback = null;
  var _expandedGroups = {};
  var _openMonthByDefinition = {};
  var _openStripDetails = {};

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

  function daysBetweenIso(fromIso, toIso) {
    return Math.round((parseDateIso(toIso).getTime() - parseDateIso(fromIso).getTime()) / 86400000);
  }

  /* 0 = Pazartesi ... 6 = Pazar */
  function weekdayIndex(dateObject) { return (dateObject.getDay() + 6) % 7; }

  function startOfWeekDate(dateObject) {
    var copy = new Date(dateObject);
    copy.setDate(copy.getDate() - weekdayIndex(copy));
    return copy;
  }

  function isoWeekStartOf(isoString) {
    return isoOfDate(startOfWeekDate(parseDateIso(isoString)));
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

  function formatDateLongFull(isoString) {
    if (!isoString) return "";
    var dateObject = parseDateIso(isoString);
    return DAYS_FULL[weekdayIndex(dateObject)] + ", " + dateObject.getDate() + " " + MONTHS_FULL[dateObject.getMonth()] + " " + dateObject.getFullYear();
  }

  function formatDateTime(isoDateTimeString) {
    if (!isoDateTimeString) return "";
    var dateObject = new Date(isoDateTimeString);
    if (isNaN(dateObject.getTime())) return "";
    var label = pad2(dateObject.getDate()) + " " + MONTHS_SHORT[dateObject.getMonth()];
    if (dateObject.getFullYear() !== new Date().getFullYear()) label += " " + dateObject.getFullYear();
    return label + " " + pad2(dateObject.getHours()) + ":" + pad2(dateObject.getMinutes());
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
    var categories = DB && Array.isArray(DB.categories) ? DB.categories : [];
    for (var i = 0; i < categories.length; i++) {
      if (categories[i].id === categoryId) return categories[i].label;
    }
    return categoryId || "Uncategorized";
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
      version: 3,
      year: new Date().getFullYear(),
      definitions: [],
      categories: defaultCategoryList(),
      statuses: {},
      requests: {},
      ui: { tab: "board", scope: "week", statusFilter: "all", category: "all", search: "", dashMonth: "year", requestFilter: "all", boardTab: "all", report: "breakdown-tasks" }
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
      timeEstimate: String(rawDefinition.timeEstimate || ""),
      steps: Array.isArray(rawDefinition.steps)
        ? rawDefinition.steps.map(function (rawStep) { return String(rawStep || "").trim(); }).filter(function (step) { return !!step; }).slice(0, 12)
        : [],
      createdAt: rawDefinition.createdAt || nowIsoDateTime(),
      createdBy: String(rawDefinition.createdBy || "")
    };
  }

  function normalizeDatabase(rawValue) {
    var database = defaultDatabase();
    if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) return database;
    if (typeof rawValue.version === "number") database.version = rawValue.version;
    if (typeof rawValue.year === "number") database.year = clampInt(rawValue.year, 2000, 2100);
    if (typeof rawValue.chatObjectId === "string" && rawValue.chatObjectId) database.chatObjectId = rawValue.chatObjectId;
    if (Array.isArray(rawValue.definitions)) {
      database.definitions = rawValue.definitions.map(normalizeDefinition).filter(function (definition) { return !!definition; });
    }
    if (Array.isArray(rawValue.categories)) {
      database.categories = sanitizeCategoryList(rawValue.categories);
      if (!database.categories.length) database.categories = defaultCategoryList();
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
        if (request.type !== "approval" && request.type !== "information" && request.type !== "support") return;
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
      database.ui.tab = (rawValue.ui.tab === "year" || rawValue.ui.tab === "defs" || rawValue.ui.tab === "dashboard" || rawValue.ui.tab === "reports") ? rawValue.ui.tab : "board";
      database.ui.scope = (rawValue.ui.scope === "today" || rawValue.ui.scope === "week" || rawValue.ui.scope === "month" || rawValue.ui.scope === "lastMonth") ? rawValue.ui.scope : "week";
      database.ui.statusFilter = String(rawValue.ui.statusFilter || "all");
      database.ui.category = String(rawValue.ui.category || "all");
      database.ui.search = String(rawValue.ui.search || "");
      database.ui.dashMonth = (typeof rawValue.ui.dashMonth === "number" && rawValue.ui.dashMonth >= 0 && rawValue.ui.dashMonth <= 11) ? rawValue.ui.dashMonth : "year";
      database.ui.requestFilter = (rawValue.ui.requestFilter === "approval" || rawValue.ui.requestFilter === "information" || rawValue.ui.requestFilter === "support") ? rawValue.ui.requestFilter : "all";
      database.ui.boardTab = (rawValue.ui.boardTab === "tasks" || rawValue.ui.boardTab === "all" || rawValue.ui.boardTab === "routine" || rawValue.ui.boardTab === "adhoc" || rawValue.ui.boardTab === "overdue" || rawValue.ui.boardTab === "requests") ? (rawValue.ui.boardTab === "tasks" ? "all" : rawValue.ui.boardTab) : "all";
      database.ui.report = (rawValue.ui.report === "breakdown-tasks" || rawValue.ui.report === "breakdown-days" || rawValue.ui.report === "breakdown-categories" || rawValue.ui.report === "suggestions") ? rawValue.ui.report : "breakdown-tasks";
    }
    return database;
  }

  function persistDatabase() {
    _dirty = true;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(flushPendingSave, 250);
  }

  function flushPendingSave() {
    clearTimeout(_saveTimer);
    if (!_dirty || readOnly) return;
    _dirty = false;
    var snapshot = JSON.stringify(DB);
    _savingNow = true;
    _lastStagedJson = snapshot;
    try { tool.setValue(DB); } catch (error) {}
    _savingNow = false;
    requestParentSave();
    if (snapshot.length > 800000) {
      tryNotify("Stored data is approaching the 1 MB field limit (" + Math.round(snapshot.length / 1024) + " KB). Ask an administrator to clear old history to keep saving safely.", "warning");
    }
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
          clearTimeout(_saveRetryTimer);
          _saveRetryTimer = setTimeout(function () {
            _warnedAutosave = false;
            flushPendingSave();
          }, 10000);
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
    entry.noteBy = currentUserDisplayName();
    entry.noteAt = nowIsoDateTime();
    entry.updatedAt = entry.noteAt;
    entry.updatedBy = entry.noteBy;
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
    if (type === "information") return "Information Request";
    if (type === "support") return "Support Request";
    return "Approval Request";
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
      type: type === "information" || type === "support" ? type : "approval",
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

  /* ============================================================
     DEFINITION PACKS: import / export categories and definitions as JSON
     ============================================================ */

  function buildDefinitionPackJson() {
    var pack = {
      schemaVersion: "bkt-pack-v1",
      name: "Task pack - " + String(DB.year),
      description: "Task definitions and categories exported from the recurring task manager.",
      year: DB.year,
      categories: (DB.categories || []).map(function (category) {
        return { id: category.id, label: category.label };
      }),
      definitions: DB.definitions.map(function (definition) {
        return {
          title: definition.title,
          category: definition.category,
          taskType: definition.taskType,
          frequency: definition.frequency,
          dayOfWeek: definition.dayOfWeek,
          dayOfMonth: definition.dayOfMonth,
          monthOfYear: definition.monthOfYear,
          dueDate: definition.dueDate,
          priority: definition.priority,
          note: definition.note,
          timeEstimate: definition.timeEstimate || "",
          steps: (definition.steps || []).slice()
        };
      })
    };
    return JSON.stringify(pack, null, 2);
  }

  function parseDefinitionPack(rawText) {
    if (!rawText || typeof rawText !== "string") return null;
    var text = rawText.trim();
    if (text.indexOf("```") === 0) {
      text = text.replace(/^```[a-zA-Z]*\s*/, "");
      text = text.replace(/\s*```\s*$/, "");
    }
    var startIndex = text.indexOf("{");
    var endIndex = text.lastIndexOf("}");
    if (startIndex === -1 || endIndex <= startIndex) return null;
    var parsed = null;
    try { parsed = JSON.parse(text.slice(startIndex, endIndex + 1)); } catch (error) { return null; }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (!Array.isArray(parsed.definitions)) return null;
    var packCategories = Array.isArray(parsed.categories) ? sanitizeCategoryList(parsed.categories) : [];
    return {
      name: String(parsed.name || "").trim(),
      description: String(parsed.description || "").trim(),
      year: (typeof parsed.year === "number" && parsed.year >= 2000 && parsed.year <= 2100) ? parsed.year : null,
      categories: packCategories.length ? packCategories : null,
      definitions: parsed.definitions
    };
  }

  function applyDefinitionPack(pack, yearOverride, clearHistory) {
    if (!pack || !Array.isArray(pack.definitions) || !pack.definitions.length) {
      tryNotify("Nothing to import: the pack has no task definitions", "error");
      return false;
    }
    var newDefinitions = pack.definitions.map(function (rawDefinition) {
      var normalized = normalizeDefinition(rawDefinition);
      if (normalized) normalized.id = uniqueId();
      return normalized;
    }).filter(function (definition) { return !!definition; });
    if (!newDefinitions.length) {
      tryNotify("Nothing to import: no valid task definitions found", "error");
      return false;
    }
    if (pack.categories) DB.categories = pack.categories;
    var newYear = (typeof yearOverride === "number" && yearOverride >= 2000 && yearOverride <= 2100)
      ? yearOverride
      : (pack.year != null ? pack.year : DB.year);
    DB.definitions = newDefinitions;
    DB.year = newYear;
    if (clearHistory) {
      DB.statuses = {};
      DB.requests = {};
    }
    persistDatabase();
    renderAll();
    tryNotify("Imported " + newDefinitions.length + " task definition(s) for " + newYear, "success");
    return true;
  }

  function openExportModal() {
    byId("bktExportText").value = buildDefinitionPackJson();
    byId("bktExportModal").style.display = "";
  }

  function closeExportModal() {
    byId("bktExportModal").style.display = "none";
  }

  function openImportModal() {
    byId("bktImportText").value = "";
    byId("bktImportYear").value = String(DB.year);
    byId("bktImportClear").checked = true;
    byId("bktImportFile").value = "";
    byId("bktImportModal").style.display = "";
  }

  function closeImportModal() {
    byId("bktImportModal").style.display = "none";
  }

  function downloadPackFile() {
    var jsonText = buildDefinitionPackJson();
    var fileName = "task-pack-" + String(DB.year) + ".json";
    try {
      var blob = new Blob([jsonText], { type: "application/json" });
      var blobUrl = URL.createObjectURL(blob);
      var anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      try { URL.revokeObjectURL(blobUrl); } catch (error) {}
      tryNotify("Downloaded " + fileName, "success");
    } catch (error) {
      openExportModal();
      tryNotify("Download unavailable here - copy the JSON and save it as " + fileName, "info");
    }
  }

  function copyPackToClipboard() {
    var textArea = byId("bktExportText");
    textArea.select();
    var copied = false;
    try { copied = document.execCommand("copy"); } catch (error) { copied = false; }
    if (copied) tryNotify("Definitions JSON copied", "success");
    else tryNotify("Copy blocked - select the text manually and copy", "info");
  }

  function confirmImportFromModal() {
    var pack = parseDefinitionPack(byId("bktImportText").value);
    if (!pack) {
      tryNotify("Could not read the JSON - check the content and try again", "error");
      return;
    }
    var rawYear = parseInt(byId("bktImportYear").value, 10);
    var yearOverride = (isNaN(rawYear) || rawYear < 2000 || rawYear > 2100) ? null : rawYear;
    var clearHistory = byId("bktImportClear").checked === true;
    var message = "Import " + pack.definitions.length + " task definition(s)" + (pack.name ? " from '" + pack.name + "'" : "") +
      " for year " + (yearOverride != null ? yearOverride : (pack.year != null ? pack.year : DB.year)) + "? This replaces the current definitions" +
      (clearHistory ? " and clears all status history, conversations and requests." : " but keeps the status history.");
    openConfirmModal(message, function () {
      closeImportModal();
      applyDefinitionPack(pack, yearOverride, clearHistory);
    });
  }

  function importPackFromFile(file) {
    if (!file) return;
    if (typeof tool.requestUpload !== "function" || typeof tool.requestFileContent !== "function") {
      tryNotify("File reading is not available here - paste the JSON into the box instead", "info");
      return;
    }
    tool.requestUpload({ accept: ".json,application/json" }, function (uploadError, uploadResult) {
      if (uploadError || !uploadResult) {
        tryNotify("Upload failed - paste the JSON into the box instead", "error");
        return;
      }
      var uploadedId = typeof uploadResult === "string" ? uploadResult : (uploadResult.fileId || uploadResult.id);
      if (!uploadedId) {
        tryNotify("Upload failed - paste the JSON into the box instead", "error");
        return;
      }
      tool.requestFileContent({ fileId: uploadedId }, function (readError, content) {
        if (readError || !content) {
          tryNotify("Could not read the file - paste the JSON into the box instead", "error");
          return;
        }
        byId("bktImportText").value = String(content);
        tryNotify("File loaded - review the content and press Import", "info");
      });
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
    byId("bktDefCategory").value = definition ? definition.category : (DB.categories && DB.categories.length ? DB.categories[0].id : "");
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
    byId("bktDefSteps").value = (definition && Array.isArray(definition.steps)) ? definition.steps.join("\n") : "";
    byId("bktDefTime").value = definition ? (definition.timeEstimate || "") : "";
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
      note: byId("bktDefNote").value.trim(),
      timeEstimate: byId("bktDefTime").value.trim(),
      steps: byId("bktDefSteps").value.split("\n").map(function (stepLine) { return stepLine.trim(); }).filter(function (stepLine) { return !!stepLine; }).slice(0, 12)
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

  var MESSAGE_MARKERS = [null, "important", "discuss", "solve"];
  var MESSAGE_MARKER_LABELS = { important: "Important", discuss: "To discuss", solve: "To solve" };

  function nextMarker(currentMarker) {
    var index = MESSAGE_MARKERS.indexOf(currentMarker || null);
    return MESSAGE_MARKERS[(index + 1) % MESSAGE_MARKERS.length];
  }

  /* ============================================================
     CHAT STORE: one separate document per instance holds all chats
     ============================================================ */

  function chatObjectAvailable() {
    return typeof tool.requestObjects === "function";
  }

  function chatObjectId() {
    if (!DB.chatObjectId) {
      DB.chatObjectId = "rtm-chat-" + uniqueId();
      persistDatabase();
    }
    return DB.chatObjectId;
  }

  function chatBucketFor(taskKey, createBucket) {
    var bucket = _chatStore.chats[taskKey];
    if (!bucket && createBucket) bucket = _chatStore.chats[taskKey] = { messages: [] };
    return bucket || null;
  }

  function chatMessagesFor(taskKey) {
    if (_chatExternal) {
      var bucket = chatBucketFor(taskKey, false);
      return (bucket && Array.isArray(bucket.messages)) ? bucket.messages : [];
    }
    var entry = statusEntryFor(taskKey);
    return (entry && Array.isArray(entry.messages)) ? entry.messages : [];
  }

  function persistChatStoreSoon() {
    _chatStoreDirty = true;
    clearTimeout(_chatStoreTimer);
    _chatStoreTimer = setTimeout(flushChatStore, 250);
  }

  function flushChatStore() {
    clearTimeout(_chatStoreTimer);
    if (!_chatStoreDirty || !_chatExternal) return;
    _chatStoreDirty = false;
    try {
      tool.requestObjects("update", {
        mainObjectType: CHAT_OBJECT_TYPE,
        objectId: chatObjectId(),
        productData: { data_categoriesBased: { chats: _chatStore.chats } }
      }, function (error) {
        if (error) _chatStoreDirty = true;
      });
    } catch (error) {
      _chatStoreDirty = true;
    }
  }

  function adoptLegacyMessagesIntoChatStore() {
    var adoptedCount = 0;
    Object.keys(DB.statuses).forEach(function (taskKey) {
      var entry = DB.statuses[taskKey];
      if (!entry || !Array.isArray(entry.messages) || !entry.messages.length) return;
      var bucket = chatBucketFor(taskKey, true);
      entry.messages.forEach(function (message) { bucket.messages.push(message); });
      if (bucket.messages.length > 200) bucket.messages = bucket.messages.slice(-200);
      delete entry.messages;
      adoptedCount++;
    });
    return adoptedCount;
  }

  function loadChatStore(doneCallback) {
    if (!chatObjectAvailable()) {
      _chatExternal = false;
      _chatStoreLoaded = true;
      if (doneCallback) doneCallback();
      return;
    }
    _chatExternal = true;
    try {
      tool.requestObjects("get", {
        mainObjectType: CHAT_OBJECT_TYPE,
        objectId: chatObjectId()
      }, function (error, chatObject) {
        var chatsValue = null;
        if (chatObject) {
          var source = chatObject.productData && chatObject.productData.data_categoriesBased ? chatObject.productData.data_categoriesBased : chatObject;
          if (source && source.chats && typeof source.chats === "object") chatsValue = source.chats;
        }
        if (!chatsValue) {
          try {
            tool.requestObjects("create", {
              mainObjectType: CHAT_OBJECT_TYPE,
              objectId: chatObjectId(),
              productData: { data_categoriesBased: { chats: {} } }
            }, function () {});
          } catch (createError) {}
          chatsValue = {};
        }
        _chatStore.chats = {};
        Object.keys(chatsValue).forEach(function (taskKey) {
          var bucket = chatsValue[taskKey];
          if (bucket && Array.isArray(bucket.messages)) {
            _chatStore.chats[taskKey] = { messages: bucket.messages.slice(0, 200) };
          }
        });
        var adoptedCount = adoptLegacyMessagesIntoChatStore();
        _chatStoreLoaded = true;
        if (adoptedCount) {
          _chatStoreDirty = true;
          flushChatStore();
          persistDatabase();
        }
        if (doneCallback) doneCallback();
      });
    } catch (error) {
      _chatExternal = false;
      _chatStoreLoaded = true;
      if (doneCallback) doneCallback();
    }
  }

  function buildConversationHtml(key) {
    var messages = chatMessagesFor(key);
    if (!messages.length) return '<div class="bkt-conv-empty">No messages yet. Write the first message about this task.</div>';
    var currentName = currentUserDisplayName();
    return messages.map(function (message, messageIndex) {
      var isMine = message.by === currentName;
      var markerBadge = message.marker
        ? '<span class="bkt-msg-marker marker-' + escapeHtml(message.marker) + '">' + escapeHtml(MESSAGE_MARKER_LABELS[message.marker] || message.marker) + "</span>"
        : "";
      var messageActions = canWork()
        ? '<div class="bkt-msg-actions">' +
          '<button type="button" class="bkt-msg-act" data-act="msg-mark" data-idx="' + messageIndex + '" title="Mark this message: cycles through Important - To discuss - To solve - none">' +
          (message.marker ? "Change mark" : "Mark") + "</button>" +
          '<button type="button" class="bkt-msg-act" data-act="msg-to-request" data-idx="' + messageIndex + '" title="Turn this message into a request">→ Request</button>' +
          "</div>"
        : "";
      return '<div class="bkt-conv-msg' + (isMine ? " bkt-conv-mine" : "") + '">' +
        '<div class="bkt-conv-meta">' + escapeHtml(message.by) + " · " + formatDateTime(message.at) + markerBadge + "</div>" +
        '<div class="bkt-conv-bubble' + (message.marker ? " bubble-" + escapeHtml(message.marker) : "") + '">' + escapeHtml(message.text) + messageActions + "</div></div>";
    }).join("");
  }

  function buildPinnedNoteHtml(entry, taskKey) {
    if (_pinEditing === taskKey) {
      return '<div class="bkt-pin-edit">' +
        '<textarea id="bktPinEditText" rows="3" maxlength="2000" placeholder="Pin the most important note about this task..."></textarea>' +
        '<div class="bkt-pin-edit-actions">' +
        '<button type="button" class="bkt-btn bkt-btn-primary bkt-btn-sm" data-act="pin-save">Save Note</button>' +
        '<button type="button" class="bkt-btn bkt-btn-outline bkt-btn-sm" data-act="pin-cancel">Cancel</button>' +
        "</div></div>";
    }
    if (entry && entry.note) {
      return '<div class="bkt-pin-note-box">' +
        '<div class="bkt-pin-head"><span class="bkt-pin-badge">Pinned</span>' +
        '<span class="bkt-note-meta">' + escapeHtml(entry.noteBy || "") + (entry.noteAt ? " · " + formatDateTime(entry.noteAt) : "") + "</span>" +
        (canWork() ? '<button type="button" class="bkt-mini-btn" data-act="pin-edit">Edit</button>' : "") +
        "</div>" +
        '<div class="bkt-pin-text">' + escapeHtml(entry.note) + "</div></div>";
    }
    return canWork()
      ? '<button type="button" class="bkt-btn bkt-btn-outline bkt-btn-sm" data-act="pin-edit">+ Pin a note</button>'
      : "";
  }

  function addConversationMessage(key, text) {
    if (!canWork()) return;
    var trimmed = String(text || "").trim();
    if (!trimmed) return;
    var message = { at: nowIsoDateTime(), by: currentUserDisplayName(), text: trimmed.slice(0, 1000) };
    if (_chatExternal) {
      var bucket = chatBucketFor(key, true);
      bucket.messages.push(message);
      if (bucket.messages.length > 200) bucket.messages.shift();
      persistChatStoreSoon();
    } else {
      var entry = ensureStatusEntry(key);
      if (!Array.isArray(entry.messages)) entry.messages = [];
      entry.messages.push(message);
      if (entry.messages.length > 200) entry.messages.shift();
      persistDatabase();
    }
    renderAll();
  }

  function buildDrawerDetailsHtml(definition, dueDate) {
    var isAdhoc = definition.taskType === "adHoc";
    var html = '<div class="bkt-detail-row"><span class="bkt-detail-label">Category</span><span class="bkt-detail-value">' + escapeHtml(categoryLabelOf(definition.category)) + "</span></div>" +
      '<div class="bkt-detail-row"><span class="bkt-detail-label">Type</span><span class="bkt-detail-value">' + (isAdhoc ? "Ad-hoc" : "Routine") + "</span></div>" +
      '<div class="bkt-detail-row"><span class="bkt-detail-label">Schedule</span><span class="bkt-detail-value">' + escapeHtml(scheduleTextOf(definition)) + "</span></div>" +
      '<div class="bkt-detail-row"><span class="bkt-detail-label">Due</span><span class="bkt-detail-value">' + escapeHtml(formatDateLong(dueDate)) + "</span></div>" +
      '<div class="bkt-detail-row"><span class="bkt-detail-label">Priority</span><span class="bkt-detail-value">' + escapeHtml(PRIORITY_LABELS[definition.priority] || "Medium") + "</span></div>";
    if (definition.timeEstimate) {
      html += '<div class="bkt-detail-row"><span class="bkt-detail-label">Estimated Time</span><span class="bkt-detail-value">' + escapeHtml(definition.timeEstimate) + "</span></div>";
    }
    if (definition.note) {
      html += '<div class="bkt-drawer-instructions"><strong>Instructions</strong><br>' + escapeHtml(definition.note) + "</div>";
    }
    return html;
  }

  function buildStepsHtml(definition, entry) {
    var steps = definition.steps || [];
    if (!steps.length) return "";
    var checklistDone = (entry && Array.isArray(entry.checklistDone)) ? entry.checklistDone : [];
    var doneCount = 0;
    var stepRows = "";
    steps.forEach(function (step, stepIndex) {
      var isDone = !!checklistDone[stepIndex];
      if (isDone) doneCount++;
      stepRows += '<button type="button" class="bkt-step' + (isDone ? " bkt-step-done" : "") + '"' +
        (canWork() ? ' data-act="step-toggle" data-step="' + stepIndex + '"' : "") +
        ' title="' + (canWork() ? "Click to mark done" : "") + '">' +
        '<span class="bkt-step-check">' + (isDone ? "✓" : "") + "</span>" +
        '<span class="bkt-step-text">' + escapeHtml(step) + "</span>" +
        "</button>";
    });
    return '<div class="bkt-steps-progress">' + doneCount + " of " + steps.length + " steps done</div>" +
      '<div class="bkt-steps">' + stepRows + "</div>";
  }

  function renderTaskDrawerContent(taskKey) {
    var parts = taskKey.split("|");
    var definition = findDefinitionById(parts[0]);
    if (!definition) return;
    var dueDate = parts[1] || "";
    var entry = statusEntryFor(taskKey);
    var status = currentStatusOf(taskKey);
    var isDrawerOverdue = dueDate && dueDate < todayIsoString() && isOpenStatus(status);
    byId("bktDrawerTitle").textContent = definition.title;
    var drawerDateElement = byId("bktDrawerDate");
    drawerDateElement.className = "bkt-drawer-date" + (isDrawerOverdue ? " bkt-drawer-date-overdue" : "");
    drawerDateElement.textContent = (definition.taskType === "adHoc" ? "Due " : "") + formatDateLongFull(dueDate);
    byId("bktDrawerSub").innerHTML =
      '<span class="bkt-status-pill">' + escapeHtml(statusLabelOf(status)) + "</span>" +
      '<span class="bkt-chip">' + escapeHtml(categoryLabelOf(definition.category)) + "</span>" +
      '<span class="bkt-chip">' + escapeHtml(frequencyLabelOf(definition.frequency) || "Ad-hoc") + "</span>";
    byId("bktDrawerActions").innerHTML = buildStatusButtonsHtml(taskKey, status);
    byId("bktDrawerNav").innerHTML = buildDrawerNavButtonsHtml(taskKey);
    byId("bktDrawerDetails").innerHTML = buildDrawerDetailsHtml(definition, dueDate);
    byId("bktDrawerSteps").innerHTML = buildStepsHtml(definition, entry);
    byId("bktPinNote").innerHTML = buildPinnedNoteHtml(entry, taskKey);
    if (_pinEditing === taskKey) {
      byId("bktPinEditText").value = (entry && entry.note) ? entry.note : "";
    }
    byId("bktConvList").innerHTML = buildConversationHtml(taskKey);
    try { byId("bktConvList").scrollTop = byId("bktConvList").scrollHeight; } catch (error) {}
    byId("bktConvInput").value = "";
    byId("bktConvInputRow").style.display = canWork() ? "" : "none";
    var requests = requestsForTask(taskKey);
    byId("bktDrawerRequests").innerHTML = requests.length
      ? requests.map(buildRequestListItemHtml).join("")
      : '<div class="bkt-conv-empty">No requests for this task.</div>';
    byId("bktReqInlineForm").style.display = canWork() ? "" : "none";
    byId("bktDrawerHistory").innerHTML = buildLogHtml(entry);
  }

  function openTaskDrawer(taskKey) {
    _drawerKey = taskKey;
    renderTaskDrawerContent(taskKey);
    byId("bktTaskDrawer").style.display = "flex";
  }

  function closeTaskDrawer() {
    _drawerKey = null;
    byId("bktTaskDrawer").style.display = "none";
  }

  function drawerOccurrenceKeysAround(taskKey) {
    var parts = taskKey.split("|");
    var definition = findDefinitionById(parts[0]);
    if (!definition || definition.taskType === "adHoc") return { list: [], index: -1 };
    var baseYear = parseInt((parts[1] || "").slice(0, 4), 10);
    if (isNaN(baseYear)) return { list: [], index: -1 };
    var list = [];
    for (var yearOffset = -1; yearOffset <= 1; yearOffset++) {
      var year = baseYear + yearOffset;
      if (year < 2000 || year > 2100) continue;
      occurrenceDatesForDefinition(definition, year, true).forEach(function (dateIso) {
        list.push(occurrenceKey(definition.id, dateIso));
      });
    }
    return { list: list, index: list.indexOf(taskKey) };
  }

  function buildDrawerNavButtonsHtml(taskKey) {
    var navInfo = drawerOccurrenceKeysAround(taskKey);
    if (!navInfo.list.length || navInfo.index < 0) return "";
    var html = '<button type="button" class="bkt-mini-btn" data-act="drawer-nav" data-dir="prev" data-key="' + escapeHtml(taskKey) + '"' +
      (navInfo.index === 0 ? " disabled" : "") + '>◀ Prev</button>' +
      '<button type="button" class="bkt-mini-btn" data-act="drawer-nav" data-dir="next" data-key="' + escapeHtml(taskKey) + '"' +
      (navInfo.index === navInfo.list.length - 1 ? " disabled" : "") + '>Next ▶</button>' +
      '<span class="bkt-drawer-occ-info">' + (navInfo.index + 1) + " of " + navInfo.list.length + "</span>";
    return html;
  }

  function sendConversationFromInput() {
    if (!_drawerKey) return;
    addConversationMessage(_drawerKey, byId("bktConvInput").value);
  }

  function buildRequestListItemHtml(request) {
    var itemHtml = '<div class="bkt-req-item">' +
      '<div class="bkt-req-item-head">' +
      '<span class="bkt-req-type req-' + request.type + '">' + escapeHtml(requestTypeLabelOf(request.type)) + "</span>" +
      '<span class="bkt-req-status reqs-' + request.status + '">' + escapeHtml(requestStatusLabelOf(request.status)) + "</span>" +
      "</div>" +
      '<div class="bkt-req-message">' + escapeHtml(request.message) + "</div>" +
      '<div class="bkt-req-meta">By ' + escapeHtml(request.createdBy) + " · " + formatDateTime(request.createdAt) + "</div>";
    if (request.response) {
      itemHtml += '<div class="bkt-req-response">' + escapeHtml(request.response) +
        '<div class="bkt-req-meta">Response by ' + escapeHtml(request.respondedBy) + " · " + formatDateTime(request.respondedAt) + "</div></div>";
    }
    if (canAdminister() && request.status === "open") {
      itemHtml += '<button type="button" class="bkt-mini-btn bkt-mb-confirm" data-act="respond-request" data-id="' + escapeHtml(request.id) + '">Respond</button>';
    }
    itemHtml += "</div>";
    return itemHtml;
  }

  function sendInlineRequest() {
    if (!_drawerKey || !canWork()) return;
    var requestMessage = byId("bktReqInlineText").value.trim();
    if (!requestMessage) return;
    createRequest(_drawerKey, byId("bktReqInlineType").value, requestMessage);
    byId("bktReqInlineText").value = "";
  }

  function openRespondModal(requestId) {
    if (!canAdminister()) return;
    var request = DB.requests[requestId];
    if (!request || request.status !== "open") return;
    _respondRequestId = requestId;
    byId("bktAdminContext").innerHTML = "<strong>" + escapeHtml(request.title) + "</strong>" +
      escapeHtml(requestTypeLabelOf(request.type) + " · " + formatDateShort(request.dueDate)) +
      '<div class="bkt-req-meta">Requested by ' + escapeHtml(request.createdBy) + " · " + formatDateTime(request.createdAt) + "</div>" +
      '<div class="bkt-req-message">' + escapeHtml(request.message) + "</div>";
    byId("bktAdminText").value = "";
    var responseOptions = request.type === "approval"
      ? '<option value="approved">Approve</option><option value="declined">Decline</option>'
      : '<option value="answered">Answer and Resolve</option>';
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
    var overlays = [byId("bktConfirmModal"), byId("bktAdminModal"), byId("bktDefModal"), byId("bktExportModal"), byId("bktImportModal"), byId("bktTaskDrawer")];
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

  function buildStatusButtonsHtml(key, status) {
    var html = "";
    if (!canWork()) return html;
    if (status === "pending") {
      html += miniButtonHtml("status", "inProgress", "Start", key, "bkt-mb-start");
      html += miniButtonHtml("status", "done", "Complete", key, "bkt-mb-done");
    } else if (status === "inProgress") {
      html += miniButtonHtml("status", "done", "Complete", key, "bkt-mb-done");
    } else if (status === "done") {
      html += miniButtonHtml("reset", "", "Reset", key, "");
    }
    return html;
  }

  function buildActionButtonsHtml(key, status) {
    return buildStatusButtonsHtml(key, status);
  }

  function rowDateLabelOf(definition, dueDate) {
    if (definition.taskType === "adHoc") return "Due " + formatDateShort(dueDate);
    return formatDateMedium(dueDate);
  }

  function buildOccurrenceRowHtml(definition, dueDate, summaryText) {
    var key = occurrenceKey(definition.id, dueDate);
    var entry = statusEntryFor(key);
    var status = currentStatusOf(key);
    var today = todayIsoString();
    var isOverdue = dueDate < today && isOpenStatus(status);
    var isAdhoc = definition.taskType === "adHoc";
    var openRequestCount = openRequestsForTask(key).length;
    var overdueSuffix = "";
    if (isOverdue) {
      var overdueDays = daysBetweenIso(dueDate, today);
      overdueSuffix = " · " + overdueDays + (overdueDays === 1 ? " day overdue" : " days overdue");
    }
    var html = '<div class="bkt-row st-' + status + (isOverdue ? " bkt-overdue" : "") + '">';
    html += '<span class="bkt-status-pill">' + escapeHtml(statusLabelOf(status)) + "</span>";
    html += '<div class="bkt-row-main" data-act="open-task" data-key="' + escapeHtml(key) + '">';
    html += '<div class="bkt-row-title">' + escapeHtml(definition.title) +
      '<span class="bkt-row-date' + (isOverdue ? " bkt-row-date-overdue" : "") + '">' + escapeHtml(rowDateLabelOf(definition, dueDate) + overdueSuffix) + "</span>" +
      (summaryText ? '<span class="bkt-row-missed">' + escapeHtml(summaryText) + "</span>" : "") +
      "</div>";
    html += '<div class="bkt-row-meta">';
    html += '<span class="bkt-type-chip ' + (isAdhoc ? "type-adhoc" : "type-regular") + '">' + (isAdhoc ? "Ad-hoc" : "Routine") + "</span>";
    html += '<span class="bkt-chip">' + escapeHtml(categoryLabelOf(definition.category)) + "</span>";
    if (!isAdhoc) html += '<span class="bkt-chip">' + escapeHtml(frequencyLabelOf(definition.frequency)) + "</span>";
    if (openRequestCount) {
      html += '<button type="button" class="bkt-req-chip" data-act="open-task" data-key="' + escapeHtml(key) + '">' +
        openRequestCount + " open request" + (openRequestCount > 1 ? "s" : "") + "</button>";
    }
    var messageCount = messageCountForKey(key);
    if (messageCount) {
      html += '<button type="button" class="bkt-req-chip bkt-msg-chip" data-act="open-task" data-key="' + escapeHtml(key) + '" title="Open conversation">' +
        messageCount + " message" + (messageCount > 1 ? "s" : "") + "</button>";
    }
    if (entry && entry.updatedBy && entry.updatedAt) {
      html += '<span class="bkt-updated">' + escapeHtml(entry.updatedBy) + " · " + formatDateTime(entry.updatedAt) + "</span>";
    }
    html += "</div>";
    if (entry && entry.note) {
      html += '<div class="bkt-row-note">' + escapeHtml(entry.note) +
        (entry.noteBy ? '<span class="bkt-note-meta"> - ' + escapeHtml(entry.noteBy) + " · " + formatDateTime(entry.noteAt) + "</span>" : "") +
        "</div>";
    }
    if (entry && entry.adminNote) html += '<div class="bkt-row-note bkt-note-admin">Admin: ' + escapeHtml(entry.adminNote) + "</div>";
    html += "</div>";
    html += '<div class="bkt-row-actions">' + buildActionButtonsHtml(key, status) + "</div>";
    html += "</div>";
    return html;
  }

  function buildOccurrenceDetailListHtml(definition, dates) {
    var today = todayIsoString();
    var steps = definition.steps || [];
    var rowsHtml = dates.map(function (dateIso) {
      var key = occurrenceKey(definition.id, dateIso);
      var status = currentStatusOf(key);
      var entry = statusEntryFor(key);
      var messageCount = messageCountForKey(key);
      var checklistDone = (entry && Array.isArray(entry.checklistDone)) ? entry.checklistDone : [];
      var stepsDone = 0;
      steps.forEach(function (step, stepIndex) { if (checklistDone[stepIndex]) stepsDone++; });
      return '<button type="button" class="bkt-sd-row' + (dateIso === today ? " bkt-sd-today" : "") + '" data-act="open-task" data-key="' + escapeHtml(key) + '">' +
        '<span class="bkt-sd-date">' + escapeHtml(formatDateMedium(dateIso)) + "</span>" +
        '<span class="bkt-sd-status s-' + status + '">' + escapeHtml(statusLabelOf(status)) + "</span>" +
        (steps.length ? '<span class="bkt-sd-steps">' + stepsDone + "/" + steps.length + " steps</span>" : "") +
        (messageCount ? '<span class="bkt-sd-msgs">' + messageCount + " message" + (messageCount > 1 ? "s" : "") + "</span>" : "") +
        (entry && entry.note ? '<span class="bkt-sd-note">note</span>' : "") +
        "</button>";
    }).join("");
    return '<div class="bkt-strip-detail">' + rowsHtml + "</div>";
  }

  function stripDetailToggleHtml(definitionId, year, monthIndex, label, titleText) {
    var detailKey = definitionId + "|" + year + "-" + (monthIndex == null ? "cal" : monthIndex);
    return '<button type="button" class="bkt-mini-btn bkt-strip-details' + (_openStripDetails[detailKey] ? " active" : "") + '" data-act="strip-detail" data-def="' + escapeHtml(definitionId) + '" data-year="' + year + '"' +
      (monthIndex == null ? "" : ' data-month="' + monthIndex + '"') +
      ' title="' + escapeHtml(titleText) + '">' + label + "</button>";
  }

  function cellTooltipText(dateIso, definition, status) {
    return formatDateMedium(dateIso) + " - " + definition.title + " - " + statusLabelOf(status) +
      " (click to check, ▸ or Ctrl+Click for details)";
  }

  function cellDetailsButtonHtml(cellKey, titleText) {
    return '<button type="button" class="bkt-cell-details" data-act="open-task" data-key="' + escapeHtml(cellKey) +
      '" title="Open details: ' + escapeHtml(titleText) + '">▸</button>';
  }

  function messageCountForKey(key) {
    return chatMessagesFor(key).length;
  }

  function messageCountForDates(definition, dates) {
    var total = 0;
    dates.forEach(function (dateIso) {
      total += messageCountForKey(occurrenceKey(definition.id, dateIso));
    });
    return total;
  }

  function buildDayStripHtml(definition, year, monthIndex, compact) {
    var dayCount = daysInMonthOf(year, monthIndex);
    var today = todayIsoString();
    var completedCount = 0;
    var stripDates = [];
    var dotsHtml = "";
    for (var day = 1; day <= dayCount; day++) {
      var dateIso = isoOfDate(new Date(year, monthIndex, day));
      stripDates.push(dateIso);
      var status = currentStatusOf(occurrenceKey(definition.id, dateIso));
      var dotClass = "bkt-dot";
      if (status === "done") { dotClass += " bkt-dot-done"; completedCount++; }
      else if (status === "inProgress") dotClass += " bkt-dot-progress";
      if (dateIso === today) dotClass += " bkt-dot-today";
      if (canWork()) dotClass += " bkt-clickable";
      dotsHtml += '<span class="bkt-cell-wrap">' +
        '<button type="button" class="' + dotClass + '"' +
        (canWork() ? ' data-act="toggle-day" data-def="' + escapeHtml(definition.id) + '" data-date="' + dateIso + '"' : "") +
        ' title="' + escapeHtml(cellTooltipText(dateIso, definition, status)) + '"></button>' +
        cellDetailsButtonHtml(occurrenceKey(definition.id, dateIso), definition.title) +
        "</span>";
    }
    var stripIncludesToday = year === parseInt(today.slice(0, 4), 10) && monthIndex === parseInt(today.slice(5, 7), 10) - 1;
    var detailOpen = !!_openStripDetails[definition.id + "|" + year + "-" + monthIndex];
    var headHtml = '<div class="bkt-strip-head">' +
      '<span class="bkt-strip-title">' + escapeHtml(definition.title) + "</span>" +
      (compact ? "" : '<span class="bkt-chip">' + escapeHtml(categoryLabelOf(definition.category)) + "</span>") +
      '<span class="bkt-strip-count"><strong>' + completedCount + "</strong> / " + dayCount + " days completed</span>" +
      (messageCountForDates(definition, stripDates) ? '<span class="bkt-strip-msgs">' + messageCountForDates(definition, stripDates) + " message" + (messageCountForDates(definition, stripDates) === 1 ? "" : "s") + "</span>" : "") +
      (canWork() && !compact ? '<span class="bkt-strip-hint">click days to mark them - hover a day for ▸ details</span>' : "") +
      stripDetailToggleHtml(definition.id, year, monthIndex, "Details", "Show every day of this month with status, messages and notes") +
      "</div>";
    return '<div class="bkt-strip' + (compact ? " bkt-strip-compact" : "") + '">' + headHtml +
      '<div class="bkt-dots' + (compact ? " bkt-dots-compact" : "") + '">' + dotsHtml + "</div>" +
      (detailOpen ? buildOccurrenceDetailListHtml(definition, stripDates) : "") +
      "</div>";
  }

  function buildYearCalendarStripHtml(definition, year) {
    var occurrences = occurrenceDatesForDefinition(definition, year, true);
    var today = todayIsoString();
    var unitWord = definition.frequency === "monthly" ? "month" : "week";
    var finishedCount = 0;
    occurrences.forEach(function (dueDate) {
      if (isFinishedStatus(currentStatusOf(occurrenceKey(definition.id, dueDate)))) finishedCount++;
    });
    var monthsHtml = "";
    for (var monthIndex = 0; monthIndex < 12; monthIndex++) {
      var cellsHtml = "";
      occurrences.forEach(function (dueDate) {
        if (parseInt(dueDate.slice(5, 7), 10) - 1 !== monthIndex) return;
        var status = currentStatusOf(occurrenceKey(definition.id, dueDate));
        var cellClass = "bkt-cal-cell";
        if (status === "done") cellClass += " bkt-cal-done";
        else if (status === "inProgress") cellClass += " bkt-cal-progress";
        var isTodayCell = definition.frequency === "monthly"
          ? dueDate.slice(0, 7) === today.slice(0, 7)
          : isoWeekStartOf(dueDate) === isoWeekStartOf(today);
        if (isTodayCell) cellClass += " bkt-cal-today";
        if (canWork()) cellClass += " bkt-clickable";
        cellsHtml += '<span class="bkt-cell-wrap">' +
          '<button type="button" class="' + cellClass + '"' +
          (canWork() ? ' data-act="toggle-day" data-def="' + escapeHtml(definition.id) + '" data-date="' + dueDate + '"' : "") +
          ' title="' + escapeHtml(cellTooltipText(dueDate, definition, status)) + '">' +
          parseInt(dueDate.slice(8, 10), 10) + "</button>" +
          cellDetailsButtonHtml(occurrenceKey(definition.id, dueDate), definition.title) +
          "</span>";
      });
      monthsHtml += '<div class="bkt-cal-month">' +
        '<div class="bkt-cal-month-label">' + MONTHS_SHORT[monthIndex] + "</div>" +
        '<div class="bkt-cal-cells">' + cellsHtml + "</div>" +
        "</div>";
    }
    var calDetailOpen = !!_openStripDetails[definition.id + "|" + year + "-cal"];
    var headHtml = '<div class="bkt-strip-head">' +
      '<span class="bkt-strip-title">' + escapeHtml(definition.title) + "</span>" +
      '<span class="bkt-chip">' + escapeHtml(categoryLabelOf(definition.category)) + "</span>" +
      '<span class="bkt-chip">' + escapeHtml(frequencyLabelOf(definition.frequency)) + "</span>" +
      '<span class="bkt-strip-count"><strong>' + finishedCount + "</strong> / " + occurrences.length + " " + unitWord + (occurrences.length === 1 ? "" : "s") + " completed</span>" +
      (messageCountForDates(definition, occurrences) ? '<span class="bkt-strip-msgs">' + messageCountForDates(definition, occurrences) + " message" + (messageCountForDates(definition, occurrences) === 1 ? "" : "s") + "</span>" : "") +
      (canWork() ? '<span class="bkt-strip-hint">click a ' + unitWord + " to check it</span>" : "") +
      stripDetailToggleHtml(definition.id, year, null, "Details", "Show every month with status, messages and notes") +
      "</div>";
    return '<div class="bkt-strip">' + headHtml + '<div class="bkt-cal">' + monthsHtml + "</div>" +
      (calDetailOpen ? buildOccurrenceDetailListHtml(definition, occurrences) : "") +
      "</div>";
  }

  function buildMonthAccordionHtml(definition, year) {
    var occurrences = occurrenceDatesForDefinition(definition, year, true);
    var isDaily = definition.frequency === "daily";
    var unitWord = isDaily ? "day" : "week";
    var today = todayIsoString();
    var todayYear = parseInt(today.slice(0, 4), 10);
    var currentMonthIndex = parseInt(today.slice(5, 7), 10) - 1;
    var defaultOpenMonth = todayYear === year ? currentMonthIndex : 0;
    var openMonth = Object.prototype.hasOwnProperty.call(_openMonthByDefinition, definition.id)
      ? _openMonthByDefinition[definition.id]
      : defaultOpenMonth;
    var finishedTotal = 0;
    occurrences.forEach(function (dueDate) {
      if (isFinishedStatus(currentStatusOf(occurrenceKey(definition.id, dueDate)))) finishedTotal++;
    });
    var monthTabsData = [];
    var openPanelHtml = "";
    var openMonthDates = [];
    for (var monthIndex = 0; monthIndex < 12; monthIndex++) {
      var monthDates = [];
      occurrences.forEach(function (dueDate) {
        if (parseInt(dueDate.slice(5, 7), 10) - 1 === monthIndex) monthDates.push(dueDate);
      });
      var monthFinished = 0;
      var cellsHtml = "";
      monthDates.forEach(function (dueDate) {
        var cellKey = occurrenceKey(definition.id, dueDate);
        var status = currentStatusOf(cellKey);
        if (isFinishedStatus(status)) monthFinished++;
        var isTodayCell = isDaily
          ? dueDate === today
          : isoWeekStartOf(dueDate) === isoWeekStartOf(today);
        if (isDaily) {
          var dotClass = "bkt-dot";
          if (status === "done") dotClass += " bkt-dot-done";
          else if (status === "inProgress") dotClass += " bkt-dot-progress";
          if (isTodayCell) dotClass += " bkt-dot-today";
          if (canWork()) dotClass += " bkt-clickable";
          cellsHtml += '<span class="bkt-cell-wrap">' +
            '<button type="button" class="' + dotClass + '"' +
            (canWork() ? ' data-act="toggle-day" data-def="' + escapeHtml(definition.id) + '" data-date="' + dueDate + '"' : "") +
            ' title="' + escapeHtml(cellTooltipText(dueDate, definition, status)) + '">' + parseInt(dueDate.slice(8, 10), 10) + "</button>" +
            cellDetailsButtonHtml(cellKey, definition.title) +
            "</span>";
        } else {
          var weekClass = "bkt-acc-week";
          if (status === "done") weekClass += " bkt-acc-done";
          else if (status === "inProgress") weekClass += " bkt-acc-progress";
          if (isTodayCell) weekClass += " bkt-acc-today";
          if (canWork()) weekClass += " bkt-clickable";
          cellsHtml += '<span class="bkt-cell-wrap">' +
            '<button type="button" class="' + weekClass + '"' +
            (canWork() ? ' data-act="toggle-day" data-def="' + escapeHtml(definition.id) + '" data-date="' + dueDate + '"' : "") +
            ' title="' + escapeHtml(cellTooltipText(dueDate, definition, status)) + '">' +
            '<span class="bkt-acc-dow">' + DAYS_SHORT[weekdayIndex(parseDateIso(dueDate))] + "</span>" +
            '<span class="bkt-acc-day">' + parseInt(dueDate.slice(8, 10), 10) + "</span>" +
            "</button>" +
            cellDetailsButtonHtml(cellKey, definition.title) +
            "</span>";
        }
      });
      var isOpen = monthIndex === openMonth;
      var monthPercentage = monthDates.length ? Math.round(monthFinished * 100 / monthDates.length) : 0;
      var isCurrentMonth = todayYear === year && monthIndex === currentMonthIndex;
      var monthMessages = messageCountForDates(definition, monthDates);
      monthTabsData.push({ monthIndex: monthIndex, monthPercentage: monthPercentage, isCurrentMonth: isCurrentMonth, isOpen: isOpen });
      if (isOpen) {
        openMonthDates = monthDates;
        openPanelHtml = '<div class="bkt-acc-open-head">' +
          '<span class="bkt-acc-open-name">' + MONTHS_FULL[monthIndex] + " " + year + "</span>" +
          '<span class="bkt-acc-open-count"><strong>' + monthFinished + "</strong> / " + monthDates.length + " " + unitWord + (monthDates.length === 1 ? "" : "s") + "</span>" +
          (monthMessages ? '<span class="bkt-acc-msgs">' + monthMessages + " message" + (monthMessages === 1 ? "" : "s") + "</span>" : "") +
          "</div>" +
          '<div class="bkt-acc-body">' + cellsHtml + "</div>";
      }
    }
    var tabsHtml = "";
    monthTabsData.forEach(function (tabData) {
      tabsHtml += '<button type="button" class="bkt-acc-tab' + (tabData.isOpen ? " active" : "") + (tabData.isCurrentMonth ? " bkt-acc-current" : "") + '" data-act="month-toggle" data-def="' + escapeHtml(definition.id) + '" data-month="' + tabData.monthIndex + '" title="' + escapeHtml(MONTHS_FULL[tabData.monthIndex] + " - " + tabData.monthPercentage + "% complete") + '">' +
        '<span class="bkt-acc-tab-name">' + MONTHS_SHORT[tabData.monthIndex] + "</span>" +
        '<span class="bkt-acc-tab-pct">' + tabData.monthPercentage + "%</span>" +
        "</button>";
    });
    var monthsPanel = '<div class="bkt-acc-tabs">' + tabsHtml + "</div>" +
      (openPanelHtml || '<div class="bkt-acc-closed">Click a month above to see its ' + unitWord + "s.</div>");
    var headHtml = '<div class="bkt-strip-head">' +
      '<span class="bkt-strip-title">' + escapeHtml(definition.title) + "</span>" +
      '<span class="bkt-chip">' + escapeHtml(categoryLabelOf(definition.category)) + "</span>" +
      '<span class="bkt-chip">' + escapeHtml(frequencyLabelOf(definition.frequency)) + "</span>" +
      '<span class="bkt-strip-count"><strong>' + finishedTotal + "</strong> / " + occurrences.length + " " + unitWord + (occurrences.length === 1 ? "" : "s") + " completed</span>" +
      (messageCountForDates(definition, occurrences) ? '<span class="bkt-strip-msgs">' + messageCountForDates(definition, occurrences) + " message" + (messageCountForDates(definition, occurrences) === 1 ? "" : "s") + "</span>" : "") +
      (canWork() ? '<span class="bkt-strip-hint">click a ' + unitWord + " to check it - hover for ▸ details</span>" : "") +
      stripDetailToggleHtml(definition.id, year, null, "Details", "Show every " + unitWord + " of the selected month with status, messages and notes") +
      "</div>";
    var accDetailOpen = !!_openStripDetails[definition.id + "|" + year + "-cal"];
    return '<div class="bkt-strip">' + headHtml + '<div class="bkt-acc">' + monthsPanel + "</div>" +
      (accDetailOpen ? buildOccurrenceDetailListHtml(definition, openMonthDates.length ? openMonthDates : occurrences) : "") +
      "</div>";
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
    if (definition.frequency === "daily" || definition.frequency === "weekly" || definition.frequency === "biweekly") {
      bodyHtml += buildMonthAccordionHtml(definition, year);
    } else if (definition.frequency === "monthly") {
      bodyHtml += buildYearCalendarStripHtml(definition, year);
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
    } else if (scope === "lastMonth") {
      rangeStart = isoOfDate(new Date(todayYear, todayMonth - 1, 1));
      rangeEnd = isoOfDate(new Date(todayYear, todayMonth, 0));
    } else {
      rangeStart = isoOfDate(new Date(todayYear, todayMonth, 1));
      rangeEnd = isoOfDate(new Date(todayYear, todayMonth, daysInMonthOf(todayYear, todayMonth)));
    }
    var rangeYear = parseInt(rangeStart.slice(0, 4), 10);
    var rangeMonth = parseInt(rangeStart.slice(5, 7), 10) - 1;
    var regularRows = [];
    var adhocRows = [];
    var dayStrips = [];
    var leftBehindRows = [];
    DB.definitions.forEach(function (definition) {
      if (definition.taskType === "adHoc") {
        if (definition.dueDate && definition.dueDate >= rangeStart && definition.dueDate <= rangeEnd) {
          if (scope === "lastMonth") {
            if (isFinishedStatus(currentStatusOf(occurrenceKey(definition.id, definition.dueDate)))) {
              adhocRows.push({ definition: definition, dueDate: definition.dueDate });
            } else {
              leftBehindRows.push({ definition: definition, dueDate: definition.dueDate });
            }
          } else {
            adhocRows.push({ definition: definition, dueDate: definition.dueDate });
          }
        }
        return;
      }
      if (definition.frequency === "daily" && (scope === "month" || scope === "lastMonth")) {
        dayStrips.push(definition);
        if (scope === "lastMonth") {
          var missedDates = [];
          var dayCount = daysInMonthOf(rangeYear, rangeMonth);
          for (var day = 1; day <= dayCount; day++) {
            var dateIso = isoOfDate(new Date(rangeYear, rangeMonth, day));
            if (isOpenStatus(currentStatusOf(occurrenceKey(definition.id, dateIso)))) missedDates.push(dateIso);
          }
          if (missedDates.length) {
            leftBehindRows.push({
              definition: definition,
              dueDate: missedDates[missedDates.length - 1],
              missedSummary: true,
              missedCount: missedDates.length
            });
          }
        }
        return;
      }
      occurrenceDatesForDefinition(definition, rangeYear, false).forEach(function (dueDate) {
        if (dueDate >= rangeStart && dueDate <= rangeEnd) {
          if (scope === "lastMonth") {
            if (isFinishedStatus(currentStatusOf(occurrenceKey(definition.id, dueDate)))) {
              regularRows.push({ definition: definition, dueDate: dueDate });
            } else {
              leftBehindRows.push({ definition: definition, dueDate: dueDate });
            }
          } else {
            regularRows.push({ definition: definition, dueDate: dueDate });
          }
        }
      });
    });
    sortRowItems(regularRows);
    sortRowItems(adhocRows);
    sortRowItems(leftBehindRows);
    var overdueRows = scope === "lastMonth" ? leftBehindRows : collectOverdueRows(scope, rangeStart);
    var stats = computeBoardStats(regularRows, adhocRows, dayStrips, overdueRows, rangeYear, rangeMonth);
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
      if (row.missedSummary) return; // daily summary rows are informational; the day strips count the days
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
    if (scope === "lastMonth") return "Last Month · " + MONTHS_FULL[monthIndex] + " " + rangeStart.slice(0, 4);
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
    } else if (tab === "reports") {
      renderRibbon(buildYearStats(DB.year));
      renderReportsPane();
    } else if (tab === "year") {
      renderRibbon(buildYearStats(DB.year));
      renderYearPane();
    } else {
      renderRibbon(buildYearStats(DB.year));
      renderDefinitionsPane();
    }
    if (_drawerKey) renderTaskDrawerContent(_drawerKey);
    try { tool.resize(); } catch (error) {}
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
    byId("bktPaneReports").style.display = tab === "reports" ? "" : "none";
    byId("bktPaneYear").style.display = tab === "year" ? "" : "none";
    byId("bktPaneDefs").style.display = tab === "defs" ? "" : "none";
    var adminVisible = canAdminister() ? "" : "none";
    byId("bktBtnNewDef").style.display = adminVisible;
    byId("bktBtnExportDefs").style.display = adminVisible;
    byId("bktBtnImportDefs").style.display = adminVisible;
  }

  function fillFilterSelects() {
    var categorySelect = byId("bktCatFilter");
    var categoryOptions = '<option value="all">All Categories</option><option value="">Uncategorized</option>';
    (DB.categories || []).forEach(function (category) {
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
    byId("bktStatOverdueLabel").textContent = (DB.ui.tab === "board" && DB.ui.scope === "lastMonth") ? "Left Behind" : "Overdue";
    var percentage = stats.total ? Math.round(stats.completed * 100 / stats.total) : 0;
    byId("bktProgressBar").style.width = percentage + "%";
    byId("bktProgressPct").textContent = "%" + percentage;
  }

  function buildRequestInboxRowHtml(request) {
    return '<div class="bkt-req-row req-' + request.type + '">' +
      '<span class="bkt-req-type req-' + request.type + '">' + escapeHtml(requestTypeLabelOf(request.type)) + "</span>" +
      '<div class="bkt-req-main">' +
      '<div class="bkt-req-title">' + escapeHtml(request.title) + "</div>" +
      '<div class="bkt-req-meta">' + escapeHtml(formatDateShort(request.dueDate)) + " · Requested by " + escapeHtml(request.createdBy) + " · " + formatDateTime(request.createdAt) + "</div>" +
      '<div class="bkt-req-message">' + escapeHtml(request.message) + "</div>" +
      "</div>" +
      '<div class="bkt-row-actions"><button type="button" class="bkt-mini-btn bkt-mb-confirm" data-act="respond-request" data-id="' + escapeHtml(request.id) + '">Respond</button></div>' +
      "</div>";
  }

  function buildRequestFilterChipsHtml(openRequests, activeFilter) {
    var typeOptions = [
      { id: "all", label: "All" },
      { id: "approval", label: "Approval" },
      { id: "information", label: "Information" },
      { id: "support", label: "Support" }
    ];
    var counts = { all: openRequests.length, approval: 0, information: 0, support: 0 };
    openRequests.forEach(function (request) { counts[request.type] = (counts[request.type] || 0) + 1; });
    return typeOptions.map(function (typeOption) {
      return '<button type="button" class="bkt-scope-chip bkt-req-filter-chip' + (activeFilter === typeOption.id ? " active" : "") + '" data-act="request-filter" data-filter="' + typeOption.id + '">' +
        escapeHtml(typeOption.label) + ' <span class="bkt-chip-count">' + counts[typeOption.id] + "</span>" +
        "</button>";
    }).join("");
  }

  function renderBoardPane(boardData) {
    var openRequests = collectOpenRequests();
    var requestFilter = DB.ui.requestFilter || "all";
    var filteredOpenRequests = requestFilter === "all"
      ? openRequests
      : openRequests.filter(function (request) { return request.type === requestFilter; });

    /* Render all three lists; the active board tab decides which is visible. */
    var approvalSection = byId("bktApprovalSection");
    if (canAdminister() && openRequests.length) {
      byId("bktApprovalCount").textContent = String(filteredOpenRequests.length);
      byId("bktRequestFilterChips").innerHTML = buildRequestFilterChipsHtml(openRequests, requestFilter);
      byId("bktApprovalList").innerHTML = filteredOpenRequests.length
        ? filteredOpenRequests.map(buildRequestInboxRowHtml).join("")
        : '<div class="bkt-empty" style="padding:16px">No open requests of this type.</div>';
    }

    var filteredOverdue = boardData.overdueRows.filter(function (row) {
      return matchesRowFilters(row.definition, currentStatusOf(occurrenceKey(row.definition.id, row.dueDate)));
    });
    byId("bktOverdueTitle").textContent = boardData.scope === "lastMonth" ? "Left Behind Last Month" : "Overdue";
    byId("bktOverdueList").innerHTML = filteredOverdue.map(function (row) {
      var summaryText = row.missedSummary
        ? row.missedCount + (row.missedCount === 1 ? " day left incomplete" : " days left incomplete")
        : null;
      return buildOccurrenceRowHtml(row.definition, row.dueDate, summaryText);
    }).join("");

    var stripYear = parseInt(boardData.rangeStart.slice(0, 4), 10);
    var stripMonth = parseInt(boardData.rangeStart.slice(5, 7), 10) - 1;
    var regularHtmlParts = [];
    boardData.dayStrips.forEach(function (definition) {
      if (matchesSearchAndCategory(definition)) {
        regularHtmlParts.push(buildDayStripHtml(definition, stripYear, stripMonth, false));
      }
    });
    var filteredRegular = boardData.regularRows.filter(function (row) {
      return matchesRowFilters(row.definition, currentStatusOf(occurrenceKey(row.definition.id, row.dueDate)));
    });
    var filteredAdhoc = boardData.adhocRows.filter(function (row) {
      return matchesRowFilters(row.definition, currentStatusOf(occurrenceKey(row.definition.id, row.dueDate)));
    });
    var routineHtml = regularHtmlParts.join("") + filteredRegular.map(function (row) {
      return buildOccurrenceRowHtml(row.definition, row.dueDate);
    }).join("");
    var adhocHtml = filteredAdhoc.map(function (row) {
      return buildOccurrenceRowHtml(row.definition, row.dueDate);
    }).join("");

    var boardTab = DB.ui.boardTab || "all";
    if (boardTab === "requests" && !canAdminister()) boardTab = "all";
    var routineCount = regularHtmlParts.length + filteredRegular.length;
    var adhocCount = filteredAdhoc.length;
    byId("bktTabAllCount").textContent = String(routineCount + adhocCount);
    byId("bktTabRoutineCount").textContent = String(routineCount);
    byId("bktTabAdhocCount").textContent = String(adhocCount);
    byId("bktTabOverdueCount").textContent = String(filteredOverdue.length);
    byId("bktTabRequestsCount").textContent = String(openRequests.length);
    byId("bktTabOverdueLabel").textContent = boardData.scope === "lastMonth" ? "Left Behind" : "Overdue";
    byId("bktBoardTabRequests").style.display = canAdminister() ? "" : "none";
    queryAll(".bkt-board-tab").forEach(function (tabButton) {
      tabButton.classList.toggle("active", tabButton.getAttribute("data-tab") === boardTab);
    });

    var showRoutine = boardTab === "all" || boardTab === "routine";
    var showAdhoc = boardTab === "all" || boardTab === "adhoc";
    var listHtml = (showRoutine ? routineHtml : "") + (showAdhoc ? adhocHtml : "");
    byId("bktBoardList").innerHTML = listHtml;
    byId("bktBoardSection").style.display = (boardTab === "all" || boardTab === "routine" || boardTab === "adhoc") && listHtml ? "" : "none";
    var visibleCount = (showRoutine ? routineCount : 0) + (showAdhoc ? adhocCount : 0);
    if (boardTab === "routine") byId("bktBoardTitle").textContent = boardData.scope === "lastMonth" ? "Completed Last Month" : "Routine Tasks";
    else if (boardTab === "adhoc") byId("bktBoardTitle").textContent = "Ad-hoc Tasks";
    else byId("bktBoardTitle").textContent = boardData.scope === "lastMonth" ? "Last Month Tasks" : "All Tasks";
    byId("bktBoardSub").textContent = visibleCount + (visibleCount === 1 ? " task" : " tasks") + " · " + scopeRangeText(boardData.scope, boardData.rangeStart, boardData.rangeEnd);
    approvalSection.style.display = boardTab === "requests" && canAdminister() && openRequests.length ? "" : "none";
    var overdueSection = byId("bktOverdueSection");
    overdueSection.style.display = boardTab === "overdue" && filteredOverdue.length ? "" : "none";

    var hasTabContent;
    var emptyMessage;
    if (boardTab === "overdue") {
      hasTabContent = filteredOverdue.length > 0;
      emptyMessage = boardData.scope === "lastMonth"
        ? "<strong>Nothing was left behind</strong>Everything from last month was completed."
        : "<strong>No overdue items</strong>Nothing is overdue in this view.";
    } else if (boardTab === "requests") {
      hasTabContent = canAdminister() && openRequests.length > 0;
      emptyMessage = "<strong>No open requests</strong>No approval, information or support requests are waiting.";
    } else {
      hasTabContent = listHtml !== "";
      emptyMessage = emptyMessageHtml();
    }
    byId("bktBoardEmpty").style.display = hasTabContent ? "none" : "";
    if (!hasTabContent) byId("bktBoardEmpty").innerHTML = emptyMessage;
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
      if (definition.frequency === "daily" || definition.frequency === "weekly" || definition.frequency === "biweekly" || definition.frequency === "monthly") {
        if (!Object.prototype.hasOwnProperty.call(_expandedGroups, definition.id)) _expandedGroups[definition.id] = true;
      }
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
    var overall = { total: 0, completed: 0, onTime: 0, timed: 0, inProgress: 0, openRequests: 0, openRequestsByType: { approval: 0, information: 0, support: 0 }, overdue: 0, upcoming7: 0 };

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
      if (overall.openRequestsByType[request.type] !== undefined) overall.openRequestsByType[request.type]++;
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
        dashCardHtml("card-wait", String(monthSource.openRequests), "Open Requests", "waiting for a response") +
        dashCardHtml("card-progress", String(monthSource.inProgress), "In Progress", "currently being worked on") +
        dashCardHtml("card-overdue", String(monthSource.overdue), "Overdue", "past due and not finished") +
        dashCardHtml("card-late", String(Math.max(monthSource.timed - monthSource.onTime, 0)), "Late Completions", "finished after their due date");
    } else {
      byId("bktDashCards").innerHTML =
        dashCardHtml("card-done", String(overall.completed), "Completed", "of " + overall.total + " · " + formatPercent(overall.completed, overall.total)) +
        dashCardHtml("card-ontime", formatPercent(overall.onTime, overall.timed), "On Time", overall.onTime + " of " + overall.timed + " completed on time") +
        dashCardHtml("card-wait", String(overall.openRequests), "Open Requests",
          overall.openRequestsByType.approval + " approval · " + overall.openRequestsByType.information + " info · " + overall.openRequestsByType.support + " support") +
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
     REPORTS: where does it break?
     ============================================================ */

  function buildBreakdownData() {
    var year = DB.year;
    var today = todayIsoString();
    var lateTasks = {};
    var missedWeekdays = [0, 0, 0, 0, 0, 0, 0];
    var overdueCategories = {};
    DB.definitions.forEach(function (definition) {
      occurrenceDatesForDefinition(definition, year, true).forEach(function (dueDate) {
        var key = occurrenceKey(definition.id, dueDate);
        var entry = statusEntryFor(key);
        var status = currentStatusOf(key);
        if (entry && isFinishedStatus(status) && entry.completedAt) {
          var completedDate = localDateOfIsoDateTime(entry.completedAt);
          if (completedDate > dueDate) {
            var late = lateTasks[definition.id];
            if (!late) late = lateTasks[definition.id] = { title: definition.title, category: definition.category, count: 0, lateDaysTotal: 0 };
            late.count++;
            late.lateDaysTotal += daysBetweenIso(dueDate, completedDate);
          }
          return;
        }
        if (dueDate >= today) return;
        if (!entry || isOpenStatus(status)) {
          missedWeekdays[weekdayIndex(parseDateIso(dueDate))]++;
          var categoryEntry = overdueCategories[definition.category];
          if (!categoryEntry) categoryEntry = overdueCategories[definition.category] = { label: categoryLabelOf(definition.category), count: 0, overdueDaysTotal: 0 };
          categoryEntry.count++;
          categoryEntry.overdueDaysTotal += daysBetweenIso(dueDate, today);
        }
      });
    });
    var lateTaskList = Object.keys(lateTasks).map(function (definitionId) { return lateTasks[definitionId]; })
      .sort(function (left, right) { return right.count - left.count || right.lateDaysTotal - left.lateDaysTotal; })
      .slice(0, 5);
    var missedWeekdayList = missedWeekdays.map(function (count, weekdayIndexValue) {
      return { weekday: weekdayIndexValue, label: DAYS_FULL[weekdayIndexValue], count: count };
    })
      .filter(function (weekdayItem) { return weekdayItem.count > 0; })
      .sort(function (left, right) { return right.count - left.count || left.weekday - right.weekday; })
      .slice(0, 5);
    var overdueCategoryList = Object.keys(overdueCategories).map(function (categoryId) { return overdueCategories[categoryId]; })
      .sort(function (left, right) { return right.count - left.count || right.overdueDaysTotal - left.overdueDaysTotal; })
      .slice(0, 5);
    return { lateTasks: lateTaskList, missedWeekdays: missedWeekdayList, overdueCategories: overdueCategoryList };
  }

  function renderReportsPane() {
    var reportId = DB.ui.report || "breakdown-tasks";
    queryAll(".bkt-report-item").forEach(function (reportItem) {
      reportItem.classList.toggle("active", reportItem.getAttribute("data-report") === reportId);
    });
    var breakdownData = buildBreakdownData();
    if (reportId === "breakdown-days") {
      byId("bktReportContent").innerHTML = renderMissedDaysReport(breakdownData.missedWeekdays);
    } else if (reportId === "breakdown-categories") {
      byId("bktReportContent").innerHTML = renderOverdueCategoriesReport(breakdownData.overdueCategories);
    } else if (reportId === "suggestions") {
      byId("bktReportContent").innerHTML = renderSuggestionsPanel();
    } else {
      byId("bktReportContent").innerHTML = renderLateTasksReport(breakdownData.lateTasks);
    }
  }

  function reportSectionHtml(sectionTitle, sectionSub, introText, rowsHtml, emptyText) {
    return '<div class="bkt-section">' +
      '<div class="bkt-section-head">' +
      '<span class="bkt-section-title">' + sectionTitle + "</span>" +
      '<span class="bkt-section-sub">' + sectionSub + "</span>" +
      "</div>" +
      '<p class="bkt-report-intro">' + introText + "</p>" +
      (rowsHtml
        ? '<table class="bkt-report-table">' +
          "<thead><tr><th>#</th><th>" + sectionTitle + "</th><th style=\"text-align:right\">Count</th><th style=\"text-align:right\">Detail</th></tr></thead>" +
          "<tbody>" + rowsHtml + "</tbody></table>"
        : '<div class="bkt-empty" style="padding:18px">' + emptyText + "</div>") +
      "</div>";
  }

  function renderLateTasksReport(lateTaskList) {
    var rowsHtml = lateTaskList.map(function (lateTask, index) {
      return "<tr>" +
        '<td class="bkt-report-rank">' + (index + 1) + "</td>" +
        '<td class="bkt-report-name">' + escapeHtml(lateTask.title) + "</td>" +
        '<td class="bkt-report-num bkt-report-bad">' + lateTask.count + " time" + (lateTask.count === 1 ? "" : "s") + " late</td>" +
        '<td class="bkt-report-num">avg ' + Math.round(lateTask.lateDaysTotal / lateTask.count) + " days late</td>" +
        "</tr>";
    }).join("");
    return reportSectionHtml(
      "Late Tasks",
      String(DB.year),
      "Tasks most often completed after their due date. If a task is regularly late, its schedule, owner or checklist is probably wrong - move the due date or split it into steps.",
      rowsHtml,
      "All clear - no task has been completed late this year."
    );
  }

  function renderMissedDaysReport(missedWeekdayList) {
    var rowsHtml = missedWeekdayList.map(function (weekdayItem, index) {
      return "<tr>" +
        '<td class="bkt-report-rank">' + (index + 1) + "</td>" +
        '<td class="bkt-report-name">' + weekdayItem.label + "</td>" +
        '<td class="bkt-report-num">' + weekdayItem.count + " task" + (weekdayItem.count === 1 ? "" : "s") + "</td>" +
        '<td class="bkt-report-num">open past due on this weekday</td>' +
        "</tr>";
    }).join("");
    return reportSectionHtml(
      "Missed Days",
      String(DB.year),
      "Weekdays that most often end with work still open past its due date. A weekday that always breaks means too much is scheduled for that day.",
      rowsHtml,
      "All clear - nothing is open past its due date."
    );
  }

  function renderOverdueCategoriesReport(overdueCategoryList) {
    var rowsHtml = overdueCategoryList.map(function (categoryItem, index) {
      return "<tr>" +
        '<td class="bkt-report-rank">' + (index + 1) + "</td>" +
        '<td class="bkt-report-name">' + escapeHtml(categoryItem.label) + "</td>" +
        '<td class="bkt-report-num bkt-report-bad">' + categoryItem.count + " task" + (categoryItem.count === 1 ? "" : "s") + " overdue</td>" +
        '<td class="bkt-report-num">' + categoryItem.overdueDaysTotal + " total days overdue</td>" +
        "</tr>";
    }).join("");
    return reportSectionHtml(
      "Overdue Categories",
      String(DB.year),
      "Categories with the most unfinished overdue work. A category that keeps breaking may need more time, more people or fewer tasks in it.",
      rowsHtml,
      "All clear - no category has overdue work."
    );
  }

  /* ============================================================
     SUGGESTIONS: rule-based nudges + optional AI month review
     ============================================================ */

  function buildRuleSuggestions() {
    var today = todayIsoString();
    var suggestions = [];
    DB.definitions.forEach(function (definition) {
      var completedCount = 0;
      var lateCount = 0;
      var messageTotal = 0;
      var messageHeavyDays = 0;
      var leftBehindCount = 0;
      occurrenceDatesForDefinition(definition, DB.year, true).forEach(function (dueDate) {
        var key = occurrenceKey(definition.id, dueDate);
        var entry = statusEntryFor(key);
        var status = currentStatusOf(key);
        var messageCount = messageCountForKey(key);
        if (messageCount) {
          messageTotal += messageCount;
          if (messageCount >= 3) messageHeavyDays++;
        }
        if (entry && isFinishedStatus(status) && entry.completedAt) {
          completedCount++;
          if (localDateOfIsoDateTime(entry.completedAt) > dueDate) lateCount++;
          return;
        }
        if (dueDate < today && (!entry || isOpenStatus(status))) leftBehindCount++;
      });
      if (completedCount >= 3 && lateCount >= 2 && lateCount / completedCount >= 0.5) {
        suggestions.push({
          severity: "high",
          text: '"' + definition.title + '" was late ' + lateCount + " of " + completedCount + " completed times - consider moving its due date one day earlier or splitting it into steps."
        });
      }
      if (messageHeavyDays >= 2 || messageTotal >= 8) {
        suggestions.push({
          severity: "medium",
          text: messageTotal + ' messages piled up on "' + definition.title + '" - document the process as steps so the work needs fewer back-and-forth notes.'
        });
      }
      if (leftBehindCount >= 3) {
        suggestions.push({
          severity: "high",
          text: '"' + definition.title + '" has ' + leftBehindCount + " occurrences left behind this year - check its schedule or ask for help."
        });
      }
    });
    var breakdownData = buildBreakdownData();
    breakdownData.missedWeekdays.forEach(function (weekdayItem) {
      suggestions.push({
        severity: "medium",
        text: weekdayItem.label + " keeps breaking (" + weekdayItem.count + " task(s) left open past due) - move some work off " + weekdayItem.label + "."
      });
    });
    breakdownData.overdueCategories.slice(0, 2).forEach(function (categoryItem) {
      suggestions.push({
        severity: "medium",
        text: '"' + categoryItem.label + '" has ' + categoryItem.count + " overdue task(s) (" + categoryItem.overdueDaysTotal + " total days) - review the workload in this category."
      });
    });
    return suggestions.slice(0, 6);
  }

  function renderSuggestionsPanel() {
    var suggestions = buildRuleSuggestions();
    var currentMonthIndex = parseInt(todayIsoString().slice(5, 7), 10) - 1;
    var monthOptions = "";
    for (var monthIndex = 0; monthIndex < 12; monthIndex++) {
      monthOptions += '<option value="' + monthIndex + '"' + (monthIndex === currentMonthIndex ? " selected" : "") + ">" + MONTHS_FULL[monthIndex] + "</option>";
    }
    var listHtml = suggestions.length
      ? suggestions.map(function (suggestion) {
          return '<div class="bkt-suggest-item bkt-suggest-' + suggestion.severity + '">' +
            '<span class="bkt-suggest-dot"></span>' +
            '<span class="bkt-suggest-text">' + escapeHtml(suggestion.text) + "</span></div>";
        }).join("")
      : '<div class="bkt-empty" style="padding:18px">All clear - nothing needs attention right now. Well done.</div>';
    var aiHtml = "";
    if (Array.isArray(_aiSuggestions) && _aiSuggestions.length) {
      aiHtml = '<div class="bkt-suggest-ai-head">AI review' +
        (_aiSuggestionsMonth != null ? " of " + MONTHS_FULL[_aiSuggestionsMonth] : "") + "</div>" +
        _aiSuggestions.map(function (suggestion) {
          return '<div class="bkt-suggest-item bkt-suggest-ai">' +
            '<span class="bkt-suggest-badge">AI</span>' +
            '<span class="bkt-suggest-text">' + escapeHtml(suggestion.text) +
            (suggestion.reason ? '<span class="bkt-suggest-reason">' + escapeHtml(suggestion.reason) + "</span>" : "") +
            "</span></div>";
        }).join("");
    }
    return '<div class="bkt-section">' +
      '<div class="bkt-section-head">' +
      '<span class="bkt-section-title">Suggestions</span>' +
      '<span class="bkt-section-sub">' + DB.year + "</span>" +
      "</div>" +
      '<p class="bkt-report-intro">Concrete next steps computed from this year\'s data. Work through them top to bottom - each one names a task, day or category and what to change.</p>' +
      listHtml +
      '<div class="bkt-ai-row">' +
      '<span class="bkt-ai-label">Get a second opinion:</span>' +
      '<select id="bktSuggestMonth">' + monthOptions + "</select>" +
      '<button type="button" class="bkt-btn bkt-btn-primary bkt-btn-sm" data-act="ai-suggest" id="bktAiSuggestBtn">' + (_aiSuggestBusy ? "Thinking..." : "Get AI Suggestions for the Month") + "</button>" +
      "</div>" +
      '<div id="bktAiSuggestions">' + aiHtml + "</div>" +
      "</div>";
  }

  function parseAiSuggestions(rawText) {
    if (!rawText || typeof rawText !== "string") return null;
    var text = rawText.trim();
    if (text.indexOf("```") === 0) {
      text = text.replace(/^```[a-zA-Z]*\s*/, "");
      text = text.replace(/\s*```\s*$/, "");
    }
    var list = null;
    var arrayStart = text.indexOf("[");
    var arrayEnd = text.lastIndexOf("]");
    if (arrayStart > -1 && arrayEnd > arrayStart) {
      try { list = JSON.parse(text.slice(arrayStart, arrayEnd + 1)); } catch (error) { list = null; }
    }
    if (!Array.isArray(list)) {
      var objectStart = text.indexOf("{");
      var objectEnd = text.lastIndexOf("}");
      if (objectStart > -1 && objectEnd > objectStart) {
        try {
          var objectValue = JSON.parse(text.slice(objectStart, objectEnd + 1));
          if (objectValue && Array.isArray(objectValue.suggestions)) list = objectValue.suggestions;
        } catch (error) { list = null; }
      }
    }
    if (!Array.isArray(list)) return null;
    return list.map(function (item) {
      return {
        text: String(item && item.text ? item.text : "").trim(),
        reason: String(item && item.reason ? item.reason : "").trim()
      };
    }).filter(function (item) { return item.text; }).slice(0, 6);
  }

  function requestAiSuggestions() {
    if (_aiSuggestBusy) return;
    if (typeof tool.requestAI !== "function") {
      tryNotify("AI suggestions are not available in this environment - the rule-based suggestions above still apply.", "info");
      return;
    }
    var monthIndex = clampInt(parseInt(byId("bktSuggestMonth").value, 10), 0, 11);
    _aiSuggestBusy = true;
    renderReportsPane();
    var monthData = buildDashboardData().months[monthIndex];
    var promptLines = [
      "You are a friendly work advisor reviewing one month of a recurring task calendar for year " + DB.year + ".",
      "Month reviewed: " + MONTHS_FULL[monthIndex],
      "Month numbers: " + monthData.total + " occurrences due, " + monthData.completed + " completed (" + monthData.onTime + " on time), " + monthData.overdue + " left behind, " + monthData.openRequests + " open requests.",
      "Rule-based findings we already computed:"
    ];
    buildRuleSuggestions().forEach(function (suggestion, index) {
      promptLines.push((index + 1) + ". " + suggestion.text);
    });
    promptLines.push("Based on this, write 3-5 concrete suggestions that help this person get the recurring job done better (rescheduling, checklists, communication, workload).");
    promptLines.push('Respond ONLY with JSON: {"suggestions":[{"text":"...","reason":"..."}]}');
    tool.requestAI({ prompt: promptLines.join("\n") }, function (error, response) {
      _aiSuggestBusy = false;
      if (error) {
        tryNotify("AI review failed - the rule-based suggestions above still apply.", "error");
        renderReportsPane();
        return;
      }
      var parsed = parseAiSuggestions(response);
      if (parsed && parsed.length) {
        _aiSuggestions = parsed;
        _aiSuggestionsMonth = monthIndex;
      } else {
        tryNotify("The AI response could not be read - showing the rule-based suggestions only.", "info");
      }
      renderReportsPane();
    });
  }

  /* ============================================================
     EVENTS
     ============================================================ */

  function handleActionClick(actionElement, event) {
    var action = actionElement.getAttribute("data-act");
    if (action === "tab") {
      DB.ui.tab = actionElement.getAttribute("data-tab");
      persistDatabase();
      renderAll();
    } else if (action === "scope") {
      DB.ui.scope = actionElement.getAttribute("data-scope");
      persistDatabase();
      renderAll();
    } else if (action === "status") {
      setOccurrenceStatus(actionElement.getAttribute("data-key"), actionElement.getAttribute("data-status"));
    } else if (action === "toggle-day") {
      if (event && (event.ctrlKey || event.metaKey)) {
        openTaskDrawer(occurrenceKey(actionElement.getAttribute("data-def"), actionElement.getAttribute("data-date")));
      } else {
        toggleDayCompletion(actionElement.getAttribute("data-def"), actionElement.getAttribute("data-date"));
      }
    } else if (action === "note") {
      openNoteModal(actionElement.getAttribute("data-key"));
    } else if (action === "dash-month") {
      var monthValue = actionElement.getAttribute("data-month");
      DB.ui.dashMonth = monthValue === "year" ? "year" : clampInt(monthValue, 0, 11);
      persistDatabase();
      renderAll();
    } else if (action === "report-menu") {
      DB.ui.report = actionElement.getAttribute("data-report") || "breakdown-tasks";
      persistDatabase();
      renderAll();
    } else if (action === "ai-suggest") {
      requestAiSuggestions();
    } else if (action === "expand") {
      var definitionId = actionElement.getAttribute("data-id");
      _expandedGroups[definitionId] = !_expandedGroups[definitionId];
      renderAll();
    } else if (action === "month-toggle") {
      var monthDefinitionId = actionElement.getAttribute("data-def");
      var monthIndexValue = parseInt(actionElement.getAttribute("data-month"), 10);
      _openMonthByDefinition[monthDefinitionId] = (_openMonthByDefinition[monthDefinitionId] === monthIndexValue) ? -1 : monthIndexValue;
      renderAll();
    } else if (action === "def-edit") {
      openDefinitionModal(actionElement.getAttribute("data-id"));
    } else if (action === "def-delete") {
      requestDefinitionDelete(actionElement.getAttribute("data-id"));
    } else if (action === "reset") {
      setOccurrenceStatus(actionElement.getAttribute("data-key"), "pending");
    } else if (action === "open-task") {
      openTaskDrawer(actionElement.getAttribute("data-key"));
    } else if (action === "respond-request") {
      openRespondModal(actionElement.getAttribute("data-id"));
    } else if (action === "drawer-nav") {
      var navDirection = actionElement.getAttribute("data-dir");
      var navInfo = drawerOccurrenceKeysAround(actionElement.getAttribute("data-key"));
      if (navInfo.index >= 0) {
        var newIndex = navInfo.index + (navDirection === "next" ? 1 : -1);
        if (newIndex >= 0 && newIndex < navInfo.list.length) {
          _drawerKey = navInfo.list[newIndex];
          renderTaskDrawerContent(_drawerKey);
        }
      }
    } else if (action === "request-filter") {
      DB.ui.requestFilter = actionElement.getAttribute("data-filter");
      persistDatabase();
      renderAll();
    } else if (action === "board-tab") {
      DB.ui.boardTab = actionElement.getAttribute("data-tab");
      persistDatabase();
      renderAll();
    } else if (action === "msg-mark") {
      if (!_drawerKey || !canWork()) return;
      var markedIndex = parseInt(actionElement.getAttribute("data-idx"), 10);
      var markedMessages = chatMessagesFor(_drawerKey);
      if (markedMessages[markedIndex]) {
        markedMessages[markedIndex].marker = nextMarker(markedMessages[markedIndex].marker);
        if (_chatExternal) persistChatStoreSoon();
        else persistDatabase();
        renderAll();
      }
    } else if (action === "msg-to-request") {
      if (!_drawerKey) return;
      var convertedIndex = parseInt(actionElement.getAttribute("data-idx"), 10);
      var convertedMessages = chatMessagesFor(_drawerKey);
      if (convertedMessages[convertedIndex]) {
        byId("bktReqInlineText").value = convertedMessages[convertedIndex].text;
        try { byId("bktReqInlineText").focus(); } catch (error) {}
      }
    } else if (action === "strip-detail") {
      var detailKey = actionElement.getAttribute("data-def") + "|" + actionElement.getAttribute("data-year") + "-" +
        (actionElement.getAttribute("data-month") != null ? actionElement.getAttribute("data-month") : "cal");
      _openStripDetails[detailKey] = !_openStripDetails[detailKey];
      renderAll();
    } else if (action === "year-collapse-all") {
      DB.definitions.forEach(function (collapseDefinition) {
        _expandedGroups[collapseDefinition.id] = false;
      });
      renderAll();
    } else if (action === "year-expand-all") {
      DB.definitions.forEach(function (expandDefinition) {
        _expandedGroups[expandDefinition.id] = true;
      });
      renderAll();
    } else if (action === "export-defs") {
      openExportModal();
    } else if (action === "import-defs") {
      openImportModal();
    } else if (action === "import-confirm") {
      confirmImportFromModal();
    } else if (action === "import-cancel") {
      closeImportModal();
    } else if (action === "export-close") {
      closeExportModal();
    } else if (action === "export-copy") {
      copyPackToClipboard();
    } else if (action === "export-download") {
      downloadPackFile();
    } else if (action === "step-toggle") {
      if (!_drawerKey || !canWork()) return;
      var stepIndex = parseInt(actionElement.getAttribute("data-step"), 10);
      if (isNaN(stepIndex)) return;
      var stepEntry = ensureStatusEntry(_drawerKey);
      if (!Array.isArray(stepEntry.checklistDone)) stepEntry.checklistDone = [];
      stepEntry.checklistDone[stepIndex] = !stepEntry.checklistDone[stepIndex];
      persistDatabase();
      renderAll();
    } else if (action === "pin-edit") {
      if (!_drawerKey || !canWork()) return;
      _pinEditing = _drawerKey;
      renderAll();
    } else if (action === "pin-cancel") {
      _pinEditing = null;
      renderAll();
    } else if (action === "pin-save") {
      if (!_drawerKey || !canWork()) return;
      var pinText = byId("bktPinEditText").value.trim();
      _pinEditing = null;
      saveOccurrenceNote(_drawerKey, pinText);
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
      if (target.classList.contains("bkt-drawer-overlay")) {
        target.style.display = "none";
        _drawerKey = null;
        return;
      }
      var actionElement = target.closest ? target.closest("[data-act]") : null;
      if (actionElement) handleActionClick(actionElement, event);
    });

    /* Flush pending changes when the page is hidden or closed - never lose data */
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("pagehide", function () { flushPendingSave(); flushChatStore(); });
      window.addEventListener("beforeunload", function () { flushPendingSave(); flushChatStore(); });
    }
    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") { flushPendingSave(); flushChatStore(); }
      });
    }

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
    byId("bktDefClose").addEventListener("click", closeDefinitionModal);
    byId("bktDefCancel").addEventListener("click", closeDefinitionModal);
    byId("bktDefSave").addEventListener("click", saveDefinitionFromModal);
    byId("bktDefDelete").addEventListener("click", function () {
      if (_editDefinitionId) requestDefinitionDelete(_editDefinitionId);
    });
    byId("bktDefTypeRegular").addEventListener("change", refreshDefinitionModalFields);
    byId("bktDefTypeAdhoc").addEventListener("change", refreshDefinitionModalFields);
    byId("bktDefFreq").addEventListener("change", refreshDefinitionModalFields);

    byId("bktDrawerClose").addEventListener("click", closeTaskDrawer);
    byId("bktConvSend").addEventListener("click", sendConversationFromInput);
    byId("bktConvInput").addEventListener("keydown", function (event) {
      if (event.key === "Enter") sendConversationFromInput();
    });
    byId("bktReqInlineSend").addEventListener("click", sendInlineRequest);

    byId("bktAdminClose").addEventListener("click", closeRespondModal);
    byId("bktAdminCancel").addEventListener("click", closeRespondModal);
    byId("bktAdminSave").addEventListener("click", saveRespondFromModal);

    byId("bktConfirmClose").addEventListener("click", closeConfirmModal);
    byId("bktConfirmNo").addEventListener("click", closeConfirmModal);
    byId("bktConfirmYes").addEventListener("click", function () {
      var callback = _confirmYesCallback;
      closeConfirmModal();
      if (callback) callback();
    });

    byId("bktImportFile").addEventListener("change", function () {
      importPackFromFile(this.files && this.files[0]);
    });

    /* Fill the definition form selects */
    var categoryOptions = "";
    (DB.categories || []).forEach(function (category) {
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
          year: { type: "number", description: "Year of the yearly plan (one year at a time)" },
          definitions: { type: "array", description: "Task definitions (routine and ad-hoc)" },
          categories: { type: "array", description: "Task categories (id and label), imported and exported in definition packs" },
          chatObjectId: { type: "string", description: "Id of the separate chat document holding all conversation messages" },
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
    loadChatStore(function () { renderAll(); });
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
