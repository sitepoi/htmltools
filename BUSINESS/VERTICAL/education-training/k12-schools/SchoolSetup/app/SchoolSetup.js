/* SchoolSetup - reusable school settings tool for the UniconHub CMS.
   One tool per school year, placed on the school settings object.
   Tabs: Overview, Class Groups, Payments, Lessons, Folders. */
(function () {
  "use strict";

  /* SDK handle + fallback shim */
  var tool = (typeof window !== "undefined" && window.tool) ? window.tool : null;
  if (!tool) {
    var _shimValue = null;
    tool = {
      onReady: function (cb) { cb(_shimValue, {}); },
      getValue: function () { return _shimValue; },
      setValue: function (v) { _shimValue = v; },
      onValueChange: function () { },
      getFields: function () { return {}; },
      param: function (n, d) { return d; },
      isReadOnly: function () { return false; },
      onReadonlyChange: function () { },
      getUser: function () { return null; },
      onUserChange: function () { },
      requestSave: function () { },
      requestObjects: function () { },
      notify: function (m) { try { console.log("notify:", m); } catch (e) { } },
      resize: function () { },
      declareOutput: function () { },
      declareParams: function () { },
      reportMissingParams: function () { }
    };
  }

  /* Helpers */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function notify(msg, sev) { try { tool.notify(msg, sev || "success"); } catch (e) { } }
  function resize() { try { tool.resize(); } catch (e) { } }
  function slugify(text) {
    var normalized = String(text || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    return normalized.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  /* App constants */
  var FIELD_ID = "schoolSetup";
  var LESSON_FIELD_ID = "lessonBoard";
  var DEFAULT_FOLDER_MAP = {
    settings: "", lessons: "", prospects: "", students: "",
    attendance: "", progress: "", payments: "", contacts: "", communication: ""
  };
  var FOLDER_DEFS = [
    { key: "settings", name: "Setup", suffix: "0-Setup", desc: "The folder of this School Setup object." },
    { key: "lessons", name: "Lessons", suffix: "1-Lessons", desc: "One lesson object per lesson." },
    { key: "prospects", name: "Prospects", suffix: "1-Prospects", desc: "The prospect board object." },
    { key: "students", name: "Students", suffix: "2-Students", desc: "One student object per student." },
    { key: "attendance", name: "Attendance", suffix: "3-Attendance", desc: "Year attendance folder. Each lesson has its own subfolder inside it." },
    { key: "progress", name: "Progress", suffix: "4-Progress", desc: "Year progress folder. Each lesson has its own subfolder inside it." },
    { key: "payments", name: "Payments", suffix: "5-Payments", desc: "One payment ledger object per student." },
    { key: "contacts", name: "Parent contacts", suffix: "8-ParentContacts", desc: "One parent contact object per student." },
    { key: "communication", name: "Communication", suffix: "6-Communication", desc: "Communication log objects." }
  ];

  function defaultDatabase() {
    return {
      version: 1,
      recordKind: "schoolSettings",
      schoolName: "Weekend School",
      schoolYear: "",
      currency: "CAD",
      paymentDueDay: 1,
      attendanceRule: "all",
      classGroups: [],
      schoolCalendar: { firstDay: "", excludedDates: [], schoolDays: [] },
      classes: [],
      teachers: [],
      schoolContact: { address: "", phone: "", website: "", principalName: "", principalEmail: "" },
      schoolFees: { oneTimeFees: [] },
      attendancePolicy: { lateAfterMin: 15, absenceCallAfter: 2 },
      paymentBrackets: [{ id: uid(), name: "Full", monthlyFee: 40, discountedFee: 0 }],
      folderMap: Object.assign({}, DEFAULT_FOLDER_MAP),
      seeded: false
    };
  }

  function normalizeDatabase(raw) {
    var d = defaultDatabase();
    if (!raw || typeof raw !== "object") return d;
    d.schoolName = String(raw.schoolName || d.schoolName);
    d.schoolYear = String(raw.schoolYear || "");
    d.currency = String(raw.currency || d.currency);
    d.paymentDueDay = Number(raw.paymentDueDay) || 1;
    var attendanceRules = ["all", "first", "firstAndAfternoon", "custom"];
    if (raw.attendanceRule && attendanceRules.indexOf(raw.attendanceRule) > -1) d.attendanceRule = raw.attendanceRule;
    if (Array.isArray(raw.classGroups)) {
      d.classGroups = raw.classGroups.map(function (group) {
        if (group && typeof group === "object") {
          return {
            id: String(group.id || uid()),
            name: String(group.name || ""),
            levels: Array.isArray(group.levels) ? group.levels.map(String).filter(function (s) { return s; }) : []
          };
        }
        var groupText = String(group || "").trim();
        if (!groupText) return null;
        var levelMatch = groupText.match(/^(.*?)\s+(Level\s+\d+|Grade\s+\d+)$/i);
        if (levelMatch) {
          return { id: uid(), name: levelMatch[1].trim(), levels: [levelMatch[2].trim()] };
        }
        return { id: uid(), name: groupText, levels: [] };
      }).filter(Boolean);
    }
    if (Array.isArray(raw.paymentBrackets)) {
      d.paymentBrackets = raw.paymentBrackets.map(function (b) {
        return {
          id: String(b.id || uid()),
          name: String(b.name || "Bracket"),
          monthlyFee: Number(b.monthlyFee) || 0,
          discountedFee: b.discountedFee != null ? Number(b.discountedFee) || 0 : 0
        };
      });
    }
    if (raw.folderMap && typeof raw.folderMap === "object") {
      Object.keys(DEFAULT_FOLDER_MAP).forEach(function (k) {
        if (raw.folderMap[k]) d.folderMap[k] = String(raw.folderMap[k]);
      });
    }
    if (Array.isArray(raw.classes)) {
      d.classes = raw.classes.map(function (classItem) {
        if (classItem && typeof classItem === "object") {
          return {
            id: String(classItem.id || uid()),
            name: String(classItem.name || ""),
            teacherUserId: String(classItem.teacherUserId || ""),
            teacherName: String(classItem.teacherName || "")
          };
        }
        var className = String(classItem || "").trim();
        return className ? { id: uid(), name: className, teacherUserId: "", teacherName: "" } : null;
      }).filter(Boolean);
    }
    if (Array.isArray(raw.teachers)) {
      d.teachers = raw.teachers.map(function (teacherItem) {
        if (!teacherItem || typeof teacherItem !== "object") return null;
        var teacherName = String(teacherItem.name || "").trim();
        var teacherEmail = String(teacherItem.email || "").trim().toLowerCase();
        return teacherName ? { id: String(teacherItem.id || uid()), name: teacherName, email: teacherEmail } : null;
      }).filter(Boolean);
    }
    if (raw.schoolContact && typeof raw.schoolContact === "object") {
      ["address", "phone", "website", "principalName", "principalEmail"].forEach(function (key) {
        if (raw.schoolContact[key] != null) d.schoolContact[key] = String(raw.schoolContact[key]);
      });
    }
    if (raw.schoolFees && Array.isArray(raw.schoolFees.oneTimeFees)) {
      d.schoolFees.oneTimeFees = raw.schoolFees.oneTimeFees.map(function (feeItem) {
        if (!feeItem || typeof feeItem !== "object") return null;
        return {
          id: String(feeItem.id || uid()),
          name: String(feeItem.name || ""),
          amount: Number(feeItem.amount) || 0,
          scope: feeItem.scope === "class" ? "class" : "school",
          classId: String(feeItem.classId || "")
        };
      }).filter(function (feeItem) { return feeItem && feeItem.name; });
    }
    if (raw.attendancePolicy && typeof raw.attendancePolicy === "object") {
      if (raw.attendancePolicy.lateAfterMin != null) d.attendancePolicy.lateAfterMin = Number(raw.attendancePolicy.lateAfterMin) || 0;
      if (raw.attendancePolicy.absenceCallAfter != null) d.attendancePolicy.absenceCallAfter = Number(raw.attendancePolicy.absenceCallAfter) || 1;
    }
    if (raw.schoolCalendar && typeof raw.schoolCalendar === "object") {
      d.schoolCalendar.firstDay = String(raw.schoolCalendar.firstDay || "");
      if (Array.isArray(raw.schoolCalendar.excludedDates)) {
        d.schoolCalendar.excludedDates = raw.schoolCalendar.excludedDates.map(String).filter(Boolean).sort();
      }
      if (Array.isArray(raw.schoolCalendar.schoolDays)) {
        var seenDays = {};
        d.schoolCalendar.schoolDays = raw.schoolCalendar.schoolDays.map(String).filter(function (dateValue) {
          if (!dateValue || seenDays[dateValue]) return false;
          seenDays[dateValue] = true;
          return true;
        }).sort();
      }
    }
    d.seeded = !!raw.seeded;
    return d;
  }

  var DB = defaultDatabase();
  var _readOnly = false;
  var _user = null;
  var _noIdentity = false;
  var _saveTimer = null;
  var _warnedAutosave = false;
  var _ownFolderId = "";
  var _activeTab = "overview";
  var _lessonsCache = [];
  var _lessonsLoaded = false;
  var _savedFolderMap = Object.assign({}, DEFAULT_FOLDER_MAP);
  var _confirmAction = null;

  /* Identity */
  function hasUserApi() { return typeof tool.getUser === "function"; }
  function getUserSafe() { try { return hasUserApi() ? tool.getUser() : null; } catch (e) { return null; } }
  function rolesOf() {
    var u = _user;
    var roles = (u && Array.isArray(u.roles)) ? u.roles.slice() : [];
    var ea = (u && u.effectiveAccess) || {};
    if (ea.isManager && roles.indexOf("admin") === -1) roles.push("admin");
    if (ea.isEditor && roles.indexOf("editor") === -1) roles.push("editor");
    if (ea.isViewer && roles.indexOf("viewer") === -1) roles.push("viewer");
    return roles;
  }
  function canWrite() {
    if (_readOnly) return false;
    if (_noIdentity) return true;
    if (!_user) return false;
    var roles = rolesOf();
    return ["admin", "editor", "developer", "owner", "user-manager"].some(function (r) { return roles.indexOf(r) > -1; });
  }
  function refreshUser() {
    if (!hasUserApi()) { _noIdentity = true; applyReadonlyState(); return; }
    var attempts = 0;
    var delays = [400, 1200, 2600, 5000];
    (function poll() {
      var u = getUserSafe();
      if (u) { _user = u; _noIdentity = false; applyReadonlyState(); return; }
      if (attempts < delays.length) setTimeout(poll, delays[attempts++]);
      else { _noIdentity = true; applyReadonlyState(); }
    })();
  }
  function applyReadonlyState() {
    var app = $("#ssu-app");
    if (!app) return;
    app.classList.toggle("ssu-readonly", !canWrite());
  }

  /* Persistence */
  function persistSoon() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(function () {
      try { tool.setValue(DB); } catch (e) { }
      requestParentSave();
    }, 300);
  }
  function requestParentSave() {
    if (_readOnly) return;
    try {
      if (typeof tool.requestSave !== "function") return;
      tool.requestSave(function (error, ok) {
        if ((error || !ok) && !_warnedAutosave) {
          _warnedAutosave = true;
          notify("Automatic save was rejected. Set the CMS field setting allowRequestSave to 'yes', or save the form manually.", "warning");
        }
      });
    } catch (e) { }
  }

  /* Object access (requestObjects against this application) */
  function appType() { return tool.param("appObjectType", "weekendSchool"); }

  function callObjects(action, params, callback) {
    try {
      if (typeof tool.requestObjects !== "function") { callback("requestObjects is not available. Set allowObjectCRUD: 'yes' and add the application to allowedObjectTypes.", null); return; }
      tool.requestObjects(action, params, callback);
    } catch (e) { callback(String(e && e.message ? e.message : e), null); }
  }

  function queryFolder(folderId, callback) {
    callObjects("query", { mainObjectType: appType(), typeId: folderId }, function (error, result) {
      if (error) { callback(error, []); return; }
      var list = (result && Array.isArray(result.objects)) ? result.objects : [];
      callback(null, list);
    });
  }

  function fieldJsonOf(object, fieldId) {
    var dcb = (object && object.productData && object.productData.data_categoriesBased) || {};
    return dcb[fieldId] || null;
  }

  function createObjectIn(folderId, name, fieldId, json, callback) {
    if (!folderId) { callback("The Lessons folder id is not set. Open the Folders tab and save the folder ids first.", null); return; }
    var payload = { mainObjectType: appType(), typeId: folderId, name: name, productData: { data_categoriesBased: {} } };
    payload.productData.data_categoriesBased[fieldId] = json;
    callObjects("create", payload, function (error, result) {
      if (error) { callback(error, null); return; }
      callback(null, result && result.object ? result.object : null);
    });
  }

  function updateObjectField(objectId, baseVersion, fieldId, json, callback) {
    var payload = {
      mainObjectType: appType(), objectId: objectId, baseVersion: baseVersion,
      productData: { data_categoriesBased: {} }
    };
    payload.productData.data_categoriesBased[fieldId] = json;
    callObjects("update", payload, function (error, result) {
      if (error) { callback(error, null); return; }
      callback(null, result);
    });
  }

  function deleteObjectById(objectId, callback) {
    callObjects("delete", { mainObjectType: appType(), objectId: objectId }, callback);
  }

  /* Tabs */
  function switchTab(tabName) {
    _activeTab = tabName;
    var tabs = document.querySelectorAll(".ssu-tab");
    var panes = document.querySelectorAll(".ssu-pane");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle("active", tabs[i].getAttribute("data-tab") === tabName);
    }
    for (var j = 0; j < panes.length; j++) {
      panes[j].classList.toggle("active", panes[j].getAttribute("data-pane") === tabName);
    }
    renderPane(tabName);
    resize();
  }

  function renderPane(tabName) {
    if (tabName === "overview") renderOverview();
    else if (tabName === "payments") renderPaymentsPane();
    else if (tabName === "lessons") renderLessonList();
    else if (tabName === "classes") renderClasses();
    else if (tabName === "teachers") renderTeachers();
    else if (tabName === "calendar") renderCalendarTab();
    else if (tabName === "folders") renderFolderRows();
  }

  function yearLabel() { return DB.schoolYear || "this year"; }

  function renderHeader() {
    var pill = $("#ssu-year-pill");
    if (pill) pill.textContent = DB.schoolYear || "No school year yet";
    ["ssu-note-year", "ssu-payments-year", "ssu-lessons-year", "ssu-classes-year", "ssu-teachers-year", "ssu-calendar-year", "ssu-folders-year"].forEach(function (id) {
      var el = $("#" + id);
      if (el) el.textContent = yearLabel();
    });
    var noteSchool = $("#ssu-note-school");
    if (noteSchool) noteSchool.textContent = DB.schoolName || "this school";
  }

  /* Overview */
  function renderOverview() {
    setValueOf("ssu-school-name", DB.schoolName);
    setValueOf("ssu-school-year", DB.schoolYear);
    setValueOf("ssu-contact-address", DB.schoolContact.address);
    setValueOf("ssu-contact-phone", DB.schoolContact.phone);
    setValueOf("ssu-contact-website", DB.schoolContact.website);
    setValueOf("ssu-contact-principal-name", DB.schoolContact.principalName);
    setValueOf("ssu-contact-principal-email", DB.schoolContact.principalEmail);
    renderHeader();
  }

  /* School calendar (explicit list of school days) */
  function isoDate(dateObject) {
    return dateObject.getFullYear() + "-" + String(dateObject.getMonth() + 1).padStart(2, "0") + "-" + String(dateObject.getDate()).padStart(2, "0");
  }
  function parseIsoDate(value) {
    var parts = String(value || "").split("-");
    if (parts.length !== 3) return new Date(NaN);
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  function fmtDateShort(value) {
    var dateObject = parseIsoDate(value);
    if (isNaN(dateObject.getTime())) return value;
    return dateObject.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function renderCalendarSummary() {
    var summary = $("#ssu-cal-summary");
    if (!summary) return;
    var count = DB.schoolCalendar.schoolDays.length;
    summary.textContent = count ? "Currently " + count + " school days are defined." : "No school days are defined yet.";
  }

  function renderCalendarTab() {
    renderCalendarView();
    renderCalendarSummary();
  }

  function openRecurringModal() {
    var days = DB.schoolCalendar.schoolDays;
    var startDefault = DB.schoolCalendar.firstDay || (days.length ? days[0] : "");
    var endDefault = days.length ? days[days.length - 1] : "";
    openModal("Add recurring school days",
      '<div class="ssu-grid-2">' +
      '<div class="ssu-field"><label class="ssu-label">From (first school day)</label><input class="ssu-input" id="ssu-cal-start" type="date" value="' + esc(startDefault) + '"></div>' +
      '<div class="ssu-field"><label class="ssu-label">To (last possible day)</label><input class="ssu-input" id="ssu-cal-end" type="date" value="' + esc(endDefault) + '"></div>' +
      "</div>" +
      '<div class="ssu-field" style="margin-top:12px"><label class="ssu-label">School weekdays</label>' +
      '<div class="ssu-weekdays">' +
      [["0", "Sunday"], ["1", "Monday"], ["2", "Tuesday"], ["3", "Wednesday"], ["4", "Thursday"], ["5", "Friday"], ["6", "Saturday"]].map(function (pair) {
        return '<label class="ssu-check"><input type="checkbox" class="ssu-cal-wd" id="ssu-cal-wd-' + pair[0] + '" value="' + pair[0] + '"> ' + pair[1] + "</label>";
      }).join("") +
      "</div>" +
      '<span class="ssu-hint">One weekday = a weekly school. Several weekdays = an after-school or weekend program. Saturday + Sunday = a weekend school.</span></div>' +
      '<div class="ssu-field" style="margin-top:12px"><label class="ssu-label">Repeat every N weeks</label>' +
      '<input class="ssu-input" id="ssu-cal-interval" type="number" min="1" max="12" value="1">' +
      '<span class="ssu-hint">1 = every week, 2 = every second week.</span></div>',
      '<button class="ssu-btn ssu-btn-ghost" data-act="modal-close">Cancel</button>' +
      '<button class="ssu-btn ssu-btn-primary" data-act="cal-generate">Add school days</button>');
  }

  function openSingleDateModal() {
    openModal("Add a single school day",
      "<p>For weeks that differ from the pattern - a different day, an extra session, or a make-up day.</p>" +
      '<div class="ssu-field" style="margin-top:10px"><label class="ssu-label">Date</label><input class="ssu-input" id="ssu-cal-single-date" type="date"></div>',
      '<button class="ssu-btn ssu-btn-ghost" data-act="modal-close">Cancel</button>' +
      '<button class="ssu-btn ssu-btn-primary" data-act="cal-add">Add date</button>');
  }

  function renderCalendarView() {
    var view = $("#ssu-calendar-view");
    var stats = $("#ssu-cal-stats");
    var days = DB.schoolCalendar.schoolDays;
    if (stats) {
      stats.textContent = days.length
        ? days.length + " school days - " + fmtDateShort(days[0]) + " to " + fmtDateShort(days[days.length - 1])
        : "no school days yet";
    }
    if (!view) return;
    if (!days.length) {
      view.innerHTML = '<p class="ssu-empty">The calendar is empty. Use + Add recurring days for a weekly pattern, or + Add a single date for one day.</p>';
      return;
    }
    var months = {};
    days.forEach(function (dateValue) {
      var monthKey = dateValue.slice(0, 7);
      (months[monthKey] = months[monthKey] || []).push(dateValue);
    });
    var weekdayHeaders = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    view.innerHTML = Object.keys(months).sort().map(function (monthKey) {
      var parts = monthKey.split("-");
      var year = Number(parts[0]);
      var monthIndex = Number(parts[1]) - 1;
      var monthDates = months[monthKey];
      var firstWeekday = new Date(year, monthIndex, 1).getDay();
      var daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      var cells = "";
      for (var pad = 0; pad < firstWeekday; pad++) cells += '<span class="ssu-cal-cell"></span>';
      for (var dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
        var dateValue = monthKey + "-" + String(dayNumber).padStart(2, "0");
        var isSchoolDay = monthDates.indexOf(dateValue) > -1;
        if (isSchoolDay) {
          cells += '<span class="ssu-cal-cell school">' + dayNumber +
            '<button class="ssu-cal-remove" data-act="cal-remove" data-name="' + dateValue + '" title="Remove this school day">x</button>' +
            "</span>";
        } else {
          cells += '<button class="ssu-cal-cell empty" data-act="cal-cell-add" data-name="' + dateValue + '" title="Click to make this a school day">' + dayNumber + "</button>";
        }
      }
      var monthName = new Date(year, monthIndex, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
      return '<div class="ssu-cal-month"><div class="ssu-cal-month-title">' + esc(monthName) +
        ' <span class="ssu-hint">' + monthDates.length + " day(s)</span></div>" +
        '<div class="ssu-cal-grid">' + weekdayHeaders.map(function (headerText) {
          return '<span class="ssu-cal-weekday">' + headerText + "</span>";
        }).join("") + cells + "</div></div>";
    }).join("");
    view.innerHTML = '<div class="ssu-cal-view">' + view.innerHTML + "</div>";
  }

  function generateSchoolDays() {
    var startValue = $("#ssu-cal-start").value.trim();
    var endValue = $("#ssu-cal-end").value.trim();
    if (!startValue || !endValue) { notify("Pick both the start and the end date.", "warning"); return; }
    var startDate = parseIsoDate(startValue);
    var endDate = parseIsoDate(endValue);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
      notify("The start date must be before or equal to the end date.", "warning");
      return;
    }
    var selectedWeekdays = [];
    document.querySelectorAll(".ssu-cal-wd:checked").forEach(function (checkbox) {
      selectedWeekdays.push(Number(checkbox.value));
    });
    if (!selectedWeekdays.length) { notify("Pick at least one school weekday.", "warning"); return; }
    var weekInterval = Number($("#ssu-cal-interval").value) || 1;
    if (weekInterval < 1) weekInterval = 1;
    var generated = [];
    var cursor = new Date(startDate.getTime());
    while (cursor <= endDate) {
      var daysSinceStart = Math.round((cursor.getTime() - startDate.getTime()) / 86400000);
      var weekOffset = Math.floor(daysSinceStart / 7);
      if (selectedWeekdays.indexOf(cursor.getDay()) > -1 && weekOffset % weekInterval === 0) {
        generated.push(isoDate(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (!generated.length) {
      notify("The pattern produced no school days. Check the weekday selection and the date range.", "warning");
      return;
    }
    var beforeCount = DB.schoolCalendar.schoolDays.length;
    generated.forEach(function (dateValue) {
      if (DB.schoolCalendar.schoolDays.indexOf(dateValue) === -1) DB.schoolCalendar.schoolDays.push(dateValue);
    });
    DB.schoolCalendar.schoolDays.sort();
    persistSoon();
    closeModal();
    renderCalendarView();
    renderCalendarSummary();
    notify("Added " + (DB.schoolCalendar.schoolDays.length - beforeCount) + " school day(s). The calendar now has " + DB.schoolCalendar.schoolDays.length + " day(s) in total.");
  }

  function addSingleSchoolDate() {
    var input = $("#ssu-cal-single-date");
    if (!input) return;
    var dateValue = input.value.trim();
    if (!dateValue) { notify("Pick a date first.", "warning"); return; }
    if (DB.schoolCalendar.schoolDays.indexOf(dateValue) > -1) { notify("That date is already a school day.", "warning"); input.value = ""; return; }
    DB.schoolCalendar.schoolDays.push(dateValue);
    DB.schoolCalendar.schoolDays.sort();
    persistSoon();
    closeModal();
    renderCalendarView();
    renderCalendarSummary();
    notify("Added " + fmtDateShort(dateValue) + " to the school calendar.");
  }

  function removeSchoolDate(dateValue) {
    DB.schoolCalendar.schoolDays = DB.schoolCalendar.schoolDays.filter(function (d) { return d !== dateValue; });
    persistSoon();
    renderCalendarView();
    renderCalendarSummary();
    notify("Removed " + fmtDateShort(dateValue) + " from the school calendar.");
  }

  function addSchoolDateByClick(dateValue) {
    if (!dateValue) return;
    if (DB.schoolCalendar.schoolDays.indexOf(dateValue) > -1) return;
    DB.schoolCalendar.schoolDays.push(dateValue);
    DB.schoolCalendar.schoolDays.sort();
    persistSoon();
    renderCalendarView();
    renderCalendarSummary();
    notify("Added " + fmtDateShort(dateValue) + " as a school day.");
  }

  function clearSchoolCalendar() {
    if (!DB.schoolCalendar.schoolDays.length) { notify("The calendar is already empty.", "warning"); return; }
    openConfirm("Clear the school calendar?",
      "<p>This removes all " + DB.schoolCalendar.schoolDays.length + " school day(s). Attendance tools would see an empty calendar until you build the list again.</p>",
      function () {
        DB.schoolCalendar.schoolDays = [];
        persistSoon();
        renderCalendarView();
        renderCalendarSummary();
        notify("School calendar cleared.");
      });
  }

  function setValueOf(id, value) {
    var el = $("#" + id);
    if (el) el.value = value == null ? "" : String(value);
  }

  /* Classes (student groups) and teachers */
  function teacherByEmail(emailValue) {
    for (var i = 0; i < DB.teachers.length; i++) if (DB.teachers[i].email === emailValue) return DB.teachers[i];
    return null;
  }

  function teacherOptionsHtml(currentEmail) {
    return DB.teachers.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (teacher) {
      return '<option value="' + esc(teacher.email) + '"' + (teacher.email === currentEmail ? " selected" : "") + ">" + esc(teacher.name) + "</option>";
    }).join("");
  }

  function renderClasses() {
    var holder = $("#ssu-class-list");
    if (!holder) return;
    if (!DB.classes.length) {
      holder.innerHTML = '<span class="ssu-hint">No classes yet. Add the first one above.</span>';
      return;
    }
    holder.innerHTML = DB.classes.map(function (classItem) {
      return '<div class="ssu-class-row"><span class="ssu-class-name">' + esc(classItem.name) + "</span>" +
        '<select class="ssu-select" id="ssu-class-teacher-' + esc(classItem.id) + '" data-act="class-teacher" data-id="' + esc(classItem.id) + '">' +
        '<option value="">No teacher</option>' + teacherOptionsHtml(classItem.teacherUserId) + "</select>" +
        '<button class="ssu-btn ssu-btn-danger ssu-btn-sm" data-act="class-name-remove" data-id="' + esc(classItem.id) + '">Remove</button></div>';
    }).join("");
  }

  function addClassName() {
    var input = $("#ssu-class-name-input");
    if (!input) return;
    var className = input.value.trim();
    if (!className) { notify("Type a class name first, for example Grade 1-A.", "warning"); return; }
    var exists = DB.classes.some(function (c) { return c.name.toLowerCase() === className.toLowerCase(); });
    if (exists) { notify("That class already exists.", "warning"); input.value = ""; return; }
    DB.classes.push({ id: uid(), name: className, teacherUserId: "", teacherName: "" });
    input.value = "";
    persistSoon();
    renderClasses();
    notify("Class added. Assign a teacher from the dropdown, and students later in the student record tool.");
  }

  function removeClassName(classId) {
    DB.classes = DB.classes.filter(function (c) { return c.id !== classId; });
    persistSoon();
    renderClasses();
  }

  function assignClassTeacher(classId, teacherEmail) {
    var teacher = teacherByEmail(teacherEmail);
    DB.classes.forEach(function (c) {
      if (c.id !== classId) return;
      c.teacherUserId = teacherEmail;
      c.teacherName = teacher ? teacher.name : "";
    });
    persistSoon();
    notify(teacherEmail ? "Class teacher assigned." : "Class teacher cleared.");
  }

  function renderTeachers() {
    var holder = $("#ssu-teacher-list");
    if (!holder) return;
    if (!DB.teachers.length) {
      holder.innerHTML = '<span class="ssu-hint">No teachers yet. Add the first one above.</span>';
      return;
    }
    holder.innerHTML = DB.teachers.map(function (teacher) {
      return '<div class="ssu-teacher-row"><span class="ssu-class-name">' + esc(teacher.name) + "</span>" +
        '<span class="ssu-teacher-email">' + esc(teacher.email) + "</span>" +
        '<button class="ssu-btn ssu-btn-danger ssu-btn-sm" data-act="teacher-remove" data-id="' + esc(teacher.id) + '">Remove</button></div>';
    }).join("");
  }

  function addTeacher() {
    var nameInput = $("#ssu-teacher-name-input");
    var emailInput = $("#ssu-teacher-email-input");
    if (!nameInput || !emailInput) return;
    var teacherName = nameInput.value.trim();
    var teacherEmail = emailInput.value.trim().toLowerCase();
    if (!teacherName || !teacherEmail) { notify("Type both the teacher name and the email.", "warning"); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(teacherEmail)) { notify("That email does not look valid.", "warning"); return; }
    if (teacherByEmail(teacherEmail)) { notify("A teacher with that email already exists.", "warning"); return; }
    DB.teachers.push({ id: uid(), name: teacherName, email: teacherEmail });
    nameInput.value = "";
    emailInput.value = "";
    persistSoon();
    renderTeachers();
    notify("Teacher added. Assign them to lessons and classes from the dropdowns.");
  }

  function removeTeacher(teacherId) {
    DB.teachers = DB.teachers.filter(function (t) { return t.id !== teacherId; });
    persistSoon();
    renderTeachers();
    notify("Teacher removed. Lessons and classes that used this teacher keep the name and email - reassign them if needed.");
  }

  /* Payment settings + brackets + one-time payments */
  function renderPaymentsPane() {
    setValueOf("ssu-currency", DB.currency);
    setValueOf("ssu-payment-due-day", DB.paymentDueDay);
    renderOneTimeFees();
    renderBrackets();
  }

  function oneTimeFeeScopeOptions(selectedScope, selectedClassId) {
    var options = '<option value="school"' + (selectedScope === "school" ? " selected" : "") + ">Every student (school)</option>";
    DB.classes.forEach(function (classItem) {
      options += '<option value="class:' + esc(classItem.id) + '"' + (selectedScope === "class" && selectedClassId === classItem.id ? " selected" : "") + ">Class: " + esc(classItem.name) + "</option>";
    });
    return options;
  }

  function renderOneTimeFees() {
    var holder = $("#ssu-one-time-rows");
    if (!holder) return;
    if (!DB.schoolFees.oneTimeFees.length) {
      holder.innerHTML = '<p class="ssu-empty">No one-time payments yet. Add a registration fee for the school or a class fee for a single class.</p>';
      return;
    }
    var currency = DB.currency || "?";
    holder.innerHTML = DB.schoolFees.oneTimeFees.map(function (feeItem) {
      return '<div class="ssu-one-time-row">' +
        '<input class="ssu-input" data-act="one-time-name" data-id="' + esc(feeItem.id) + '" value="' + esc(feeItem.name) + '">' +
        '<input class="ssu-input" type="number" min="0" step="0.01" data-act="one-time-amount" data-id="' + esc(feeItem.id) + '" value="' + feeItem.amount + '" title="' + esc(currency) + '">' +
        '<select class="ssu-select" data-act="one-time-scope" data-id="' + esc(feeItem.id) + '">' + oneTimeFeeScopeOptions(feeItem.scope, feeItem.classId) + "</select>" +
        '<button class="ssu-btn ssu-btn-danger ssu-btn-sm" data-act="one-time-remove" data-id="' + esc(feeItem.id) + '">Remove</button>' +
        "</div>";
    }).join("");
  }

  function addOneTimeFee() {
    DB.schoolFees.oneTimeFees.push({ id: uid(), name: "New fee", amount: 0, scope: "school", classId: "" });
    persistSoon();
    renderOneTimeFees();
  }

  function removeOneTimeFee(feeId) {
    DB.schoolFees.oneTimeFees = DB.schoolFees.oneTimeFees.filter(function (feeItem) { return feeItem.id !== feeId; });
    persistSoon();
    renderOneTimeFees();
  }

  function updateOneTimeFee(feeId, field, value) {
    DB.schoolFees.oneTimeFees.forEach(function (feeItem) {
      if (feeItem.id !== feeId) return;
      if (field === "name") feeItem.name = String(value).trim() || "New fee";
      else if (field === "amount") feeItem.amount = Number(value) || 0;
      else if (field === "scope") {
        if (String(value).indexOf("class:") === 0) {
          feeItem.scope = "class";
          feeItem.classId = String(value).slice(6);
        } else {
          feeItem.scope = "school";
          feeItem.classId = "";
        }
      }
    });
    persistSoon();
    renderOneTimeFees();
  }

  function renderBrackets() {
    var holder = $("#ssu-bracket-rows");
    if (!holder) return;
    if (!DB.paymentBrackets.length) {
      holder.innerHTML = '<p class="ssu-empty">No payment brackets yet. Add the first one.</p>';
      return;
    }
    var currency = DB.currency || "?";
    holder.innerHTML = DB.paymentBrackets.map(function (bracket) {
      var hasDiscount = bracket.discountedFee > 0 && bracket.discountedFee < bracket.monthlyFee;
      var feeCell;
      if (hasDiscount) {
        feeCell = '<span class="ssu-bracket-price both"><span>' + Number(bracket.monthlyFee).toFixed(2) + " " + esc(currency) + "</span>" +
          '<span class="ssu-bracket-price discounted">' + Number(bracket.discountedFee).toFixed(2) + " " + esc(currency) + " discounted</span></span>";
      } else {
        feeCell = '<span class="ssu-bracket-price">' + Number(bracket.monthlyFee).toFixed(2) + " " + esc(currency) + " / month</span>";
      }
      return '<div class="ssu-bracket-row">' +
        '<input class="ssu-input" data-act="bracket-name" data-id="' + esc(bracket.id) + '" value="' + esc(bracket.name) + '">' +
        '<input class="ssu-input" type="number" min="0" step="0.01" data-act="bracket-fee" data-id="' + esc(bracket.id) + '" value="' + bracket.monthlyFee + '">' +
        '<div style="display:flex;flex-direction:column;gap:4px">' +
        '<input class="ssu-input" type="number" min="0" step="0.01" data-act="bracket-discount" data-id="' + esc(bracket.id) + '" value="' + bracket.discountedFee + '" placeholder="None">' +
        '<span class="ssu-hint">Leave 0 when there is no discount.</span></div>' +
        '<button class="ssu-btn ssu-btn-danger ssu-btn-sm" data-act="bracket-delete" data-id="' + esc(bracket.id) + '">Remove</button>' +
        "</div>";
    }).join("");
  }

  /* Folders */
  function suggestedFolderId(def) {
    var parts = [];
    if (DB.schoolName) parts.push(slugify(DB.schoolName));
    if (DB.schoolYear) parts.push(slugify(DB.schoolYear));
    parts.push(def.suffix);
    return parts.join("-");
  }

  function renderFolderRows() {
    var holder = $("#ssu-folder-rows");
    if (!holder) return;
    var currentValues = {};
    FOLDER_DEFS.forEach(function (def) {
      var input = $("#ssu-folder-" + def.key);
      var savedValue = String(DB.folderMap[def.key] || "");
      if (input && input.value.trim() !== savedValue) currentValues[def.key] = input.value.trim();
      else currentValues[def.key] = savedValue;
    });
    holder.innerHTML = FOLDER_DEFS.map(function (def) {
      return '<div class="ssu-folder-row">' +
        '<div class="ssu-folder-name">' + esc(def.name) + "</div>" +
        '<div class="ssu-folder-desc">' + esc(def.desc) + "</div>" +
        '<input class="ssu-input ssu-folder-id" id="ssu-folder-' + esc(def.key) + '" value="' + esc(currentValues[def.key]) + '" placeholder="' + esc(suggestedFolderId(def)) + '">' +
        "</div>";
    }).join("");
    updateFolderStatus();
  }

  function readFolderInputs() {
    var values = {};
    FOLDER_DEFS.forEach(function (def) {
      var input = $("#ssu-folder-" + def.key);
      values[def.key] = input ? input.value.trim() : "";
    });
    return values;
  }

  function fillSuggestedFolderIds() {
    var filledCount = 0;
    FOLDER_DEFS.forEach(function (def) {
      var input = $("#ssu-folder-" + def.key);
      if (!input) return;
      if (input.value.trim()) return;
      input.value = suggestedFolderId(def);
      filledCount++;
    });
    updateFolderStatus();
    if (filledCount) notify(filledCount + " empty folder id(s) filled with suggested names. Check them against the real folder ids of the application, then press Save folder ids.");
    else notify("All folder ids already have values. Edit a field to change it.", "warning");
  }

  function saveFolderIds() {
    var values = readFolderInputs();
    var changedRows = [];
    FOLDER_DEFS.forEach(function (def) {
      var oldValue = String(_savedFolderMap[def.key] || "");
      var newValue = values[def.key];
      if (oldValue && oldValue !== newValue) changedRows.push({ def: def, oldValue: oldValue, newValue: newValue });
    });
    var apply = function () {
      FOLDER_DEFS.forEach(function (def) {
        DB.folderMap[def.key] = values[def.key];
      });
      _savedFolderMap = Object.assign({}, DB.folderMap);
      persistSoon();
      updateFolderStatus();
      notify("Folder ids saved. Other tools of this application now read their folders from here.");
      refreshLessonList();
    };
    if (changedRows.length) {
      openConfirm("Change folder ids?",
        "<p>You are changing folder id(s) that already have a value. The tools of this application use these ids to find their data:</p>" +
        '<table class="ssu-confirm-table">' +
        changedRows.map(function (row) {
          return "<tr><td><strong>" + esc(row.def.name) + "</strong></td><td>" + esc(row.oldValue) + " &rarr; </td><td>" + esc(row.newValue || "(empty)") + "</td></tr>";
        }).join("") +
        "</table>" +
        "<p class='ssu-hint'>Objects that were already created stay in the old folders, but the tools will read the new folders instead. Only continue when the new ids really point to the correct folders.</p>",
        apply);
      return;
    }
    apply();
  }

  function updateFolderStatus() {
    var status = $("#ssu-folder-status");
    if (!status) return;
    var values = readFolderInputs();
    var setCount = Object.keys(values).filter(function (k) { return values[k]; }).length;
    status.textContent = setCount + " of " + FOLDER_DEFS.length + " folder ids set" +
      (setCount === FOLDER_DEFS.length ? " - all connected." : " - the missing ones disconnect their tools.");
  }

  function copyFolderMapJson() {
    var values = readFolderInputs();
    var text = JSON.stringify(values, null, 2);
    function fallbackCopy() {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand("copy"); notify("Folder ids copied as JSON."); } catch (e) { notify("Copy failed.", "warning"); }
      document.body.removeChild(textarea);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { notify("Folder ids copied as JSON. Paste them into the folderMapJson parameter of other tools."); }, fallbackCopy);
    } else fallbackCopy();
  }

  function pasteFolderMapJson() {
    function applyPasted(text) {
      var parsed;
      try { parsed = JSON.parse(text); } catch (e) { notify("That is not valid JSON.", "warning"); return; }
      var appliedCount = 0;
      FOLDER_DEFS.forEach(function (def) {
        if (parsed[def.key] == null) return;
        var input = $("#ssu-folder-" + def.key);
        if (!input) return;
        input.value = String(parsed[def.key]);
        appliedCount++;
      });
      updateFolderStatus();
      if (appliedCount) notify("Pasted " + appliedCount + " folder id(s) into the fields. Press Save folder ids to keep them.");
      else notify("No matching folder ids found in the pasted JSON.", "warning");
    }
    function askPasteText() {
      var text = window.prompt("Paste the folder ids JSON here:");
      if (text) applyPasted(text);
    }
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(applyPasted, askPasteText);
    } else askPasteText();
  }

  /* Lessons (each lesson is a class with levels) */
  function lessonOf(object) {
    var json = fieldJsonOf(object, LESSON_FIELD_ID);
    return json || { name: String(object && object.name ? object.name : "Lesson") };
  }

  function lessonObjectById(objectId) {
    for (var i = 0; i < _lessonsCache.length; i++) if (_lessonsCache[i].id === objectId) return _lessonsCache[i];
    return null;
  }

  var ATTENDANCE_RULE_LABELS = {
    all: "Every lesson needs an attendance check.",
    first: "Only the first lesson of the day needs an attendance check.",
    firstAndAfternoon: "The first lesson and every lesson that starts at 12:00 or later need an attendance check.",
    custom: "Each lesson has its own attendance setting - use the Edit dialog per lesson."
  };

  function renderAttendanceRule() {
    var select = $("#ssu-attendance-rule");
    if (select && select.value !== DB.attendanceRule) select.value = DB.attendanceRule;
    var hint = $("#ssu-attendance-rule-hint");
    if (hint) {
      hint.textContent = "Rule for " + yearLabel() + ": " + ATTENDANCE_RULE_LABELS[DB.attendanceRule] +
        " You can change this rule any time during the school year - the next attendance sheets use the new rule.";
    }
    setValueOf("ssu-policy-late", DB.attendancePolicy.lateAfterMin);
    setValueOf("ssu-policy-call", DB.attendancePolicy.absenceCallAfter);
  }

  function lessonNeedsAttendance(lesson) {
    var rule = DB.attendanceRule;
    if (rule === "custom") return !!lesson.requiresAttendance;
    if (rule === "first" || rule === "firstAndAfternoon") {
      var times = _lessonsCache.map(function (object) { return lessonOf(object).startTime || ""; }).filter(Boolean).sort();
      var firstTime = times.length ? times[0] : "";
      var startTime = lesson.startTime || "";
      if (rule === "first") return startTime === firstTime;
      return startTime === firstTime || startTime >= "12:00";
    }
    return true;
  }

  function renderLessonList() {
    renderAttendanceRule();
    var holder = $("#ssu-lesson-list");
    if (!holder) return;
    if (!DB.folderMap.lessons) {
      holder.innerHTML = '<p class="ssu-empty">The Lessons folder id is not set yet, so lessons cannot be created. Open the <strong>Folders</strong> tab, save the folder ids, then come back here.</p>';
      return;
    }
    if (!_lessonsLoaded) return;
    if (!_lessonsCache.length) {
      var legacyClasses = DB.classGroups.filter(function (g) { return g && g.name; });
      if (legacyClasses.length) {
        holder.innerHTML = '<div class="ssu-note ssu-migrate"><div class="ssu-note-title">Your classes are not lessons yet</div>' +
          "<p>These classes come from the previous version of this page: " +
          esc(legacyClasses.map(function (g) { return g.name + (g.levels.length ? " (" + g.levels.join(", ") + ")" : ""); }).join(", ")) + ".</p>" +
          '<div class="ssu-row-actions"><button class="ssu-btn ssu-btn-primary" data-act="lessons-from-classes">Create lesson objects from these classes</button></div></div>';
      } else {
        holder.innerHTML = '<p class="ssu-empty">No lessons for ' + esc(yearLabel()) + ' yet. Press <strong>+ Add lesson</strong>.</p>';
      }
      return;
    }
    holder.innerHTML = _lessonsCache.map(function (object) {
      var lesson = lessonOf(object);
      var levels = Array.isArray(lesson.levels) ? lesson.levels : [];
      var checklistCount = Array.isArray(lesson.progressChecklist) ? lesson.progressChecklist.length : 0;
      var folderSet = lesson.attendanceFolderId && lesson.progressFolderId;
      var needsAttendance = lessonNeedsAttendance(lesson);
      var levelChips = levels.map(function (levelName) {
        return '<span class="ssu-level-chip">' + esc(levelName) +
          '<button class="ssu-group-remove" data-act="lesson-level-remove" data-id="' + esc(object.id) + '" data-name="' + esc(levelName) + '" title="Remove level">x</button></span>';
      }).join("");
      var badges = '<span class="ssu-pill' + (needsAttendance ? "" : " muted") + '">' + (needsAttendance ? "Attendance" : "No attendance") + "</span>" +
        (folderSet ? "" : ' <span class="ssu-pill warn">subfolder ids missing</span>');
      return '<div class="ssu-lesson-card">' +
        '<div class="ssu-lesson-head"><div><div class="ssu-lesson-name">' + esc(lesson.name || object.name) + "</div>" +
        '<div class="ssu-lesson-meta">' + esc(lesson.lessonType || "class") + (lesson.teacherName ? " - " + esc(lesson.teacherName) : "") +
        " - " + esc(lesson.startTime || "--:--") + " - " + esc(String(lesson.durationMin || "")) + " min - " + checklistCount + " checklist item(s)</div></div>" +
        '<div class="ssu-lesson-badges">' + badges + "</div>" +
        '<div class="ssu-lesson-actions">' +
        '<button class="ssu-btn ssu-btn-ghost ssu-btn-sm" data-act="lesson-edit" data-id="' + esc(object.id) + '">Edit</button> ' +
        '<button class="ssu-btn ssu-btn-danger ssu-btn-sm" data-act="lesson-delete" data-id="' + esc(object.id) + '">Remove</button>' +
        "</div></div>" +
        '<div class="ssu-lesson-levels">' + levelChips +
        '<span class="ssu-level-add"><input class="ssu-input ssu-level-input" id="ssu-lesson-level-input-' + esc(object.id) + '" placeholder="New level, e.g. Level 3...">' +
        '<button class="ssu-btn ssu-btn-ghost ssu-btn-sm" data-act="lesson-level-add" data-id="' + esc(object.id) + '">Add level</button></span>' +
        "</div></div>";
    }).join("");
  }

  function addLessonLevel(objectId) {
    var object = lessonObjectById(objectId);
    var input = $("#ssu-lesson-level-input-" + objectId);
    if (!object || !input) return;
    var lesson = lessonOf(object);
    var levelName = input.value.trim();
    if (!levelName) { notify("Type a level name first, for example Level 3.", "warning"); return; }
    var levels = Array.isArray(lesson.levels) ? lesson.levels.slice() : [];
    if (levels.indexOf(levelName) > -1) { notify("That level already exists in " + lesson.name + ".", "warning"); input.value = ""; return; }
    levels.push(levelName);
    lesson.levels = levels;
    updateObjectField(object.id, object.version, LESSON_FIELD_ID, lesson, function (error) {
      if (error) { notify("Could not add the level: " + error, "error"); return; }
      notify("Level added to " + lesson.name + ".");
      refreshLessonList();
    });
  }

  function removeLessonLevel(objectId, levelName) {
    var object = lessonObjectById(objectId);
    if (!object) return;
    var lesson = lessonOf(object);
    lesson.levels = (Array.isArray(lesson.levels) ? lesson.levels : []).filter(function (l) { return l !== levelName; });
    updateObjectField(object.id, object.version, LESSON_FIELD_ID, lesson, function (error) {
      if (error) { notify("Could not remove the level: " + error, "error"); return; }
      notify("Level removed from " + lesson.name + ".");
      refreshLessonList();
    });
  }

  function createLessonsFromClasses() {
    var legacyClasses = DB.classGroups.filter(function (g) { return g && g.name; });
    if (!legacyClasses.length) return;
    if (!DB.folderMap.lessons) { notify("The Lessons folder id is not set. Open the Folders tab and save the folder ids first.", "warning"); return; }
    var operations = legacyClasses.map(function (group) {
      var operation = { action: "create", mainObjectType: appType(), typeId: DB.folderMap.lessons, name: group.name, productData: { data_categoriesBased: {} } };
      operation.productData.data_categoriesBased[LESSON_FIELD_ID] = {
        name: group.name, levels: group.levels.slice(), lessonType: "class", dayOfWeek: 0,
        startTime: "", durationMin: 45, teacherUserId: "", teacherName: "", room: "",
        progressChecklist: [], attendanceFolderId: "", progressFolderId: "",
        requiresAttendance: true, folderMap: DB.folderMap, active: true, schoolYear: DB.schoolYear
      };
      return operation;
    });
    callObjects("batch", { operations: operations }, function (error) {
      if (error) { notify("Could not create lessons from classes: " + error, "error"); return; }
      DB.classGroups = [];
      persistSoon();
      notify("Created " + operations.length + " lesson object(s) from the previous classes.");
      refreshLessonList();
    });
  }

  function refreshLessonList() {
    var lessonsFolderId = DB.folderMap.lessons;
    if (!lessonsFolderId) {
      _lessonsCache = [];
      _lessonsLoaded = true;
      renderLessonList();
      return;
    }
    queryFolder(lessonsFolderId, function (error, objects) {
      if (error) { notify("Could not load lessons: " + error, "warning"); _lessonsLoaded = true; return; }
      _lessonsCache = objects;
      _lessonsLoaded = true;
      renderLessonList();
    });
  }

  /* Lesson modal */
  function openLessonModal(objectId) {
    var object = null;
    if (objectId) {
      for (var i = 0; i < _lessonsCache.length; i++) {
        if (_lessonsCache[i].id === objectId) { object = _lessonsCache[i]; break; }
      }
    }
    var lesson = object ? lessonOf(object) : null;
    var checklistText = lesson && Array.isArray(lesson.progressChecklist)
      ? lesson.progressChecklist.map(function (item) { return item.label; }).join("\n")
      : "";
    var v = function (key, def) { return lesson && lesson[key] != null ? lesson[key] : def; };
    var typeOptions = ["class", "support"].map(function (t) {
      return '<option value="' + t + '"' + (String(v("lessonType", "class")) === t ? " selected" : "") + ">" + t + "</option>";
    }).join("");
    openModal(object ? "Edit Lesson" : "Add Lesson",
      '<div class="ssu-grid-3">' +
      '<div class="ssu-field"><label class="ssu-label">Lesson name</label><input class="ssu-input" id="ssuf-name" placeholder="e.g. Quran" value="' + esc(v("name", "")) + '"></div>' +
      '<div class="ssu-field"><label class="ssu-label">Type</label><select class="ssu-select" id="ssuf-type">' + typeOptions + "</select></div>" +
      '<div class="ssu-field"><label class="ssu-label">Room (optional)</label><input class="ssu-input" id="ssuf-room" value="' + esc(v("room", "")) + '"></div>' +
      '<div class="ssu-field"><label class="ssu-label">Start time</label><input class="ssu-input" id="ssuf-start" placeholder="10:00" value="' + esc(v("startTime", "")) + '"></div>' +
      '<div class="ssu-field"><label class="ssu-label">Duration (minutes)</label><input class="ssu-input" id="ssuf-duration" type="number" min="1" value="' + esc(v("durationMin", "45")) + '"></div>' +
      '<div class="ssu-field"><label class="ssu-label">Levels (comma separated)</label><input class="ssu-input" id="ssuf-levels" placeholder="Level 1, Level 2" value="' + esc(Array.isArray(v("levels", [])) ? v("levels", []).join(", ") : "") + '"></div>' +
      '<div class="ssu-field"><label class="ssu-label">Teacher</label>' +
      '<select class="ssu-select" id="ssuf-teacher">' + lessonTeacherOptions(v("teacherUserId", ""), v("teacherName", "")) + "</select>" +
      '<span class="ssu-hint">Teachers are defined on the Teachers tab. The email is the login identity of the teacher in this application.</span></div>' +
      "</div>" +
      '<div class="ssu-field" style="margin-top:12px"><label class="ssu-label">Attendance</label>' +
      '<label class="ssu-check"><input type="checkbox" id="ssuf-att-req"' + (v("requiresAttendance", true) ? " checked" : "") + '> This lesson requires an attendance check</label>' +
      '<span class="ssu-hint">When the attendance rule above the list is not "Choose per lesson", the rule decides instead of this checkbox.</span></div>' +
      '<div class="ssu-field" style="margin-top:12px"><label class="ssu-label">Progress checklist (one item per line)</label><textarea class="ssu-textarea" id="ssuf-checklist" rows="5" placeholder="e.g. Memorized page 12&#10;Completed homework 3"></textarea><span class="ssu-hint" id="ssuf-checklist-holder" hidden>' + esc(checklistText) + "</span></div>" +
      '<div class="ssu-grid-3" style="margin-top:12px">' +
      '<div class="ssu-field"><label class="ssu-label">Attendance subfolder id</label><input class="ssu-input" id="ssuf-att-folder" value="' + esc(v("attendanceFolderId", "")) + '"></div>' +
      '<div class="ssu-field"><label class="ssu-label">Progress subfolder id</label><input class="ssu-input" id="ssuf-prog-folder" value="' + esc(v("progressFolderId", "")) + '"></div>' +
      "</div>" +
      '<p class="ssu-hint" style="margin-top:10px">The two subfolder ids come from the year folder import (one attendance and one progress subfolder per lesson).</p>',
      '<button class="ssu-btn ssu-btn-ghost" data-act="modal-close">Cancel</button>' +
      '<button class="ssu-btn ssu-btn-primary" data-act="lesson-save" data-id="' + esc(object ? object.id : "") + '">Save lesson</button>');
    var checklistArea = $("#ssuf-checklist");
    var checklistHolder = $("#ssuf-checklist-holder");
    if (checklistArea && checklistHolder) checklistArea.value = checklistHolder.textContent;
  }

  function lessonTeacherOptions(currentEmail, currentName) {
    var optionsHtml = '<option value="">No teacher yet</option>' + teacherOptionsHtml(currentEmail);
    if (currentEmail && !teacherByEmail(currentEmail)) {
      optionsHtml += '<option value="' + esc(currentEmail) + '" selected>' + esc(currentName || currentEmail) + " (previous)</option>";
    }
    return optionsHtml;
  }

  function saveLessonFromModal(objectId) {
    var read = function (id) { var el = $("#" + id); return el ? String(el.value || "").trim() : ""; };
    var name = read("ssuf-name");
    if (!name) { notify("Lesson name is required.", "warning"); return; }
    var checklistLines = read("ssuf-checklist").split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    var checklist = checklistLines.map(function (label) { return { id: uid(), label: label, kind: "checkbox" }; });
    var object = null;
    if (objectId) {
      for (var i = 0; i < _lessonsCache.length; i++) {
        if (_lessonsCache[i].id === objectId) { object = _lessonsCache[i]; break; }
      }
    }
    var existing = object ? lessonOf(object) : null;
    var lessonJson = {
      name: name,
      lessonType: read("ssuf-type") || "class",
      dayOfWeek: 0,
      startTime: read("ssuf-start"),
      durationMin: Number(read("ssuf-duration")) || 45,
      levels: read("ssuf-levels").split(",").map(function (s) { return s.trim(); }).filter(Boolean),
      teacherUserId: read("ssuf-teacher") || (existing ? existing.teacherUserId || "" : ""),
      teacherName: (teacherByEmail(read("ssuf-teacher")) || {}).name || (existing ? existing.teacherName || "" : ""),
      room: read("ssuf-room"),
      requiresAttendance: !!($("#ssuf-att-req") && $("#ssuf-att-req").checked),
      progressChecklist: checklist,
      attendanceFolderId: read("ssuf-att-folder") || (existing ? existing.attendanceFolderId || "" : ""),
      progressFolderId: read("ssuf-prog-folder") || (existing ? existing.progressFolderId || "" : ""),
      folderMap: DB.folderMap,
      active: true,
      schoolYear: DB.schoolYear
    };
    closeModal();
    if (object) {
      updateObjectField(object.id, object.version, LESSON_FIELD_ID, lessonJson, function (error) {
        if (error) { notify("Could not save lesson: " + error, "error"); return; }
        notify("Lesson saved.");
        refreshLessonList();
      });
    } else {
      createObjectIn(DB.folderMap.lessons, name, LESSON_FIELD_ID, lessonJson, function (error, created) {
        if (error) { notify("Could not create lesson: " + error, "error"); return; }
        notify("Lesson created in the Lessons folder.");
        refreshLessonList();
      });
    }
  }

  /* Modal helpers */
  function openModal(title, bodyHtml, footHtml) {
    $("#ssu-modal-title").textContent = title;
    $("#ssu-modal-body").innerHTML = bodyHtml;
    $("#ssu-modal-foot").innerHTML = footHtml || "";
    $("#ssu-modal-overlay").classList.add("open");
    resize();
  }
  function closeModal() {
    $("#ssu-modal-overlay").classList.remove("open");
    resize();
  }
  function openConfirm(title, messageHtml, onConfirm) {
    _confirmAction = onConfirm;
    openModal(title, messageHtml,
      '<button class="ssu-btn ssu-btn-ghost" data-act="confirm-no">Cancel</button>' +
      '<button class="ssu-btn ssu-btn-danger" data-act="confirm-yes">Yes, change</button>');
  }
  function runConfirmedAction() {
    var action = _confirmAction;
    _confirmAction = null;
    closeModal();
    if (typeof action === "function") action();
  }

  /* Events */
  document.addEventListener("click", function (e) {
    if (e.target === $("#ssu-modal-overlay")) { closeModal(); return; }
    var tab = e.target.closest("[data-tab]");
    if (tab) { switchTab(tab.getAttribute("data-tab")); return; }
    var el = e.target.closest("[data-act]");
    if (!el) return;
    var act = el.getAttribute("data-act");
    var id = el.getAttribute("data-id");
    switch (act) {
      case "modal-close": closeModal(); break;
      case "confirm-yes": runConfirmedAction(); break;
      case "confirm-no": closeModal(); break;
      case "class-name-add": addClassName(); break;
      case "class-name-remove": removeClassName(id); break;
      case "teacher-add": addTeacher(); break;
      case "teacher-remove": removeTeacher(id); break;
      case "go-calendar": switchTab("calendar"); break;
      case "cal-recurring-open": openRecurringModal(); break;
      case "cal-single-open": openSingleDateModal(); break;
      case "cal-generate": generateSchoolDays(); break;
      case "cal-add": addSingleSchoolDate(); break;
      case "cal-cell-add": addSchoolDateByClick(el.getAttribute("data-name")); break;
      case "cal-remove": removeSchoolDate(el.getAttribute("data-name")); break;
      case "cal-clear": clearSchoolCalendar(); break;
      case "lesson-level-add": addLessonLevel(id); break;
      case "lesson-level-remove": removeLessonLevel(id, el.getAttribute("data-name")); break;
      case "lessons-from-classes": createLessonsFromClasses(); break;
      case "bracket-add":
        DB.paymentBrackets.push({ id: uid(), name: "New bracket", monthlyFee: 0, discountedFee: 0 });
        persistSoon();
        renderBrackets();
        break;
      case "bracket-delete":
        DB.paymentBrackets = DB.paymentBrackets.filter(function (b) { return b.id !== id; });
        persistSoon();
        renderBrackets();
        break;
      case "one-time-add": addOneTimeFee(); break;
      case "one-time-remove": removeOneTimeFee(id); break;
      case "folder-generate": fillSuggestedFolderIds(); break;
      case "folder-save": saveFolderIds(); break;
      case "folder-copy": copyFolderMapJson(); break;
      case "folder-paste": pasteFolderMapJson(); break;
      case "lesson-add": openLessonModal(null); break;
      case "lesson-edit": openLessonModal(id); break;
      case "lesson-delete":
        deleteObjectById(id, function (error) {
          if (error) { notify("Could not remove lesson: " + error, "error"); return; }
          notify("Lesson removed.");
          refreshLessonList();
        });
        break;
      case "lesson-save": saveLessonFromModal(id); break;
    }
  });

  document.addEventListener("input", function (e) {
    var el = e.target;
    if (!el || !el.id) return;
    switch (el.id) {
      case "ssu-school-name":
        DB.schoolName = el.value.trim() || "Weekend School";
        renderHeader();
        persistSoon();
        break;
      case "ssu-school-year":
        DB.schoolYear = el.value.trim();
        renderHeader();
        persistSoon();
        break;
      case "ssu-contact-address": DB.schoolContact.address = el.value.trim(); persistSoon(); break;
      case "ssu-contact-phone": DB.schoolContact.phone = el.value.trim(); persistSoon(); break;
      case "ssu-contact-website": DB.schoolContact.website = el.value.trim(); persistSoon(); break;
      case "ssu-contact-principal-name": DB.schoolContact.principalName = el.value.trim(); persistSoon(); break;
      case "ssu-contact-principal-email": DB.schoolContact.principalEmail = el.value.trim(); persistSoon(); break;
      case "ssu-policy-late": DB.attendancePolicy.lateAfterMin = Number(el.value) || 0; persistSoon(); break;
      case "ssu-policy-call": DB.attendancePolicy.absenceCallAfter = Number(el.value) || 1; persistSoon(); break;
      case "ssu-currency":
        DB.currency = el.value.trim() || "CAD";
        persistSoon();
        renderBrackets();
        break;
      case "ssu-payment-due-day": DB.paymentDueDay = Number(el.value) || 1; persistSoon(); break;
      default:
        if (el.id.indexOf("ssu-folder-") === 0) updateFolderStatus();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || !e.target) return;
    if (e.target.id === "ssu-class-name-input") {
      e.preventDefault();
      addClassName();
    } else if (e.target.id === "ssu-teacher-email-input") {
      e.preventDefault();
      addTeacher();
    } else if (e.target.id && e.target.id.indexOf("ssu-lesson-level-input-") === 0) {
      e.preventDefault();
      addLessonLevel(e.target.id.slice("ssu-lesson-level-input-".length));
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "ssu-attendance-rule") {
      DB.attendanceRule = e.target.value;
      persistSoon();
      renderLessonList();
      return;
    }
    if (e.target && e.target.getAttribute && e.target.getAttribute("data-act") === "class-teacher") {
      assignClassTeacher(e.target.getAttribute("data-id"), e.target.value);
      return;
    }
    var el = e.target.closest("[data-act]");
    if (!el) return;
    var act = el.getAttribute("data-act");
    var id = el.getAttribute("data-id");
    if (act === "one-time-name" || act === "one-time-amount" || act === "one-time-scope") {
      updateOneTimeFee(id, act === "one-time-name" ? "name" : (act === "one-time-amount" ? "amount" : "scope"), el.value);
      return;
    }
    if (act === "bracket-name" || act === "bracket-fee" || act === "bracket-discount") {
      DB.paymentBrackets.forEach(function (b) {
        if (b.id !== id) return;
        if (act === "bracket-name") b.name = el.value.trim() || "Bracket";
        else if (act === "bracket-fee") b.monthlyFee = Number(el.value) || 0;
        else b.discountedFee = Number(el.value) || 0;
      });
      persistSoon();
      renderBrackets();
    }
  });

  /* Entry point */
  tool.onReady(function (value, fields) {
    DB = normalizeDatabase(value);
    _savedFolderMap = Object.assign({}, DB.folderMap);
    if (!DB.seeded) {
      var nameParam = tool.param("schoolName", "");
      if (nameParam) DB.schoolName = nameParam;
      var currencyParam = tool.param("currency", "");
      if (currencyParam) DB.currency = currencyParam;
      DB.seeded = true;
      persistSoon();
    }
    if (fields && typeof fields === "object") {
      if (fields.typeId) {
        _ownFolderId = String(fields.typeId);
        if (!DB.folderMap.settings) DB.folderMap.settings = _ownFolderId;
      }
    }
    _user = getUserSafe();
    refreshUser();
    renderHeader();
    switchTab("overview");
    refreshLessonList();
    updateFolderStatus();

    tool.onValueChange(function (newValue) {
      DB = normalizeDatabase(newValue);
      _savedFolderMap = Object.assign({}, DB.folderMap);
      renderHeader();
      renderPane(_activeTab);
      refreshLessonList();
    });
    tool.onReadonlyChange(function (ro) { _readOnly = !!ro; applyReadonlyState(); });
    tool.onUserChange(function (u) { _user = u || getUserSafe(); applyReadonlyState(); });

    tool.declareOutput({ type: "object", properties: { version: { type: "number" }, recordKind: { type: "string" }, schoolName: { type: "string" }, folderMap: { type: "object" } } });
    tool.declareParams([
      { name: "appObjectType", label: "Application Object Type", type: "text", default: "weekendSchool", severity: "optional", hint: "The application id (cmsObjectType) this school lives in." },
      { name: "schoolName", label: "School Name", type: "text", default: "", severity: "optional", hint: "Used once to seed a new settings object." },
      { name: "currency", label: "Currency", type: "text", default: "CAD", severity: "optional", hint: "Default currency for payment brackets." },
      { name: "allowObjectCRUD", label: "Allow Object CRUD", type: "toggle", default: "yes", severity: "goodToHave", hint: "Must be 'yes' in the field settings so this tool can create and update lesson objects." },
      { name: "allowRequestSave", label: "Allow Request Save", type: "toggle", default: "yes", severity: "goodToHave", hint: "Must be 'yes' so changes save automatically." }
    ]);
  });
})();
