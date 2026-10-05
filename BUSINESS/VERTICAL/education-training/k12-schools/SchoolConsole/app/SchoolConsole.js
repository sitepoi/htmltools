/* SchoolConsole - reusable application level listing tool (TYPE 3).
   Lists students, attendance records and payment ledgers across the
   school application and builds text reports. Installed in the
   application's single listingTool slot with mode 'replace-listings'. */
(function () {
  "use strict";

  var tool = (typeof window !== "undefined" && window.tool) ? window.tool : null;
  if (!tool) {
    var _shimValue = null;
    tool = {
      onReady: function (cb) { cb(_shimValue, {}); },
      getValue: function () { return _shimValue; },
      setValue: function (v) { _shimValue = v; },
      onValueChange: function () { },
      param: function (n, d) { return d; },
      isReadOnly: function () { return false; },
      getUser: function () { return null; },
      requestObjects: function () { },
      notify: function (m) { try { console.log("notify:", m); } catch (e) { } },
      resize: function () { },
      declareOutput: function () { },
      declareParams: function () { },
      reportMissingParams: function () { }
    };
  }

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function notify(msg, sev) { try { tool.notify(msg, sev || "success"); } catch (e) { } }
  function resize() { try { tool.resize(); } catch (e) { } }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function thisSundayIso() {
    var d = new Date();
    d.setDate(d.getDate() + (7 - d.getDay()) % 7);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function mondayOfWeek(sundayIso) {
    var d = new Date(sundayIso + "T00:00:00");
    d.setDate(d.getDate() - 6);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  var SETUP_FIELD_ID = "schoolSetup";
  var STUDENT_FIELD_ID = "studentRecord";
  var ATTENDANCE_FIELD_ID = "attendanceRecord";
  var LEDGER_FIELD_ID = "paymentLedger";
  var LESSON_FIELD_ID = "lessonBoard";
  var MARK_LABELS = { P: "Present", A: "Absent", L: "Late", E: "Excused" };

  var UI = { version: 1, ui: { tab: "students" } };
  var _folderMap = null;
  var _state = {
    students: [], attendanceFolders: [], attendanceRecords: [],
    ledgers: [], lessons: [], settingsName: ""
  };
  var _paymentSearch = "";
  var _studentSearch = "";
  var _studentClassFilter = "";
  var _waitingOnly = true;
  var _loading = false;

  function appType() { return tool.param("appObjectType", "weekendSchool"); }

  function callObjects(action, params, callback) {
    try {
      if (typeof tool.requestObjects !== "function") { callback("requestObjects is not available.", null); return; }
      tool.requestObjects(action, params, callback);
    } catch (e) { callback(String(e && e.message ? e.message : e), null); }
  }

  function queryFolder(folderId, callback) {
    if (!folderId) { callback(null, []); return; }
    callObjects("query", { mainObjectType: appType(), typeId: folderId }, function (error, result) {
      if (error) { callback(error, []); return; }
      callback(null, (result && Array.isArray(result.objects)) ? result.objects : []);
    });
  }

  function queryAll(callback) {
    callObjects("query", { mainObjectType: appType() }, function (error, result) {
      if (error) { callback(error, []); return; }
      callback(null, (result && Array.isArray(result.objects)) ? result.objects : []);
    });
  }

  function fieldJsonOf(object, fieldId) {
    var dcb = (object && object.productData && object.productData.data_categoriesBased) || {};
    return dcb[fieldId] || null;
  }

  /* Folders: requestFolders is available to application level listing
     tools. The result shape is tolerated: an array, or an object with
     folders / items / objects. */
  function loadFolderList(callback) {
    if (typeof tool.requestFolders === "function") {
      try {
        tool.requestFolders(function (error, result) {
          if (!error && result) {
            var list = Array.isArray(result) ? result
              : (Array.isArray(result.folders) ? result.folders
                : (Array.isArray(result.items) ? result.items
                  : (Array.isArray(result.objects) ? result.objects : null)));
            if (list && list.length) { callback(list); return; }
          }
          callback([]);
        });
        return;
      } catch (e) { /* fall through */ }
    }
    callback([]);
  }

  function attendanceSubFolderIds(folders) {
    var parentId = _folderMap && _folderMap.attendance ? _folderMap.attendance : "";
    var ids = [];
    folders.forEach(function (folder) {
      if (!folder || !folder.id) return;
      if (String(folder.parentId || "") === String(parentId)) ids.push(String(folder.id));
    });
    var paramIds = tool.param("attendanceFolderIds", "");
    if (!ids.length && paramIds) {
      ids = paramIds.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    }
    return ids;
  }

  /* Load everything (runs on ready and on Refresh).
     Staged: the folder map must be resolved before the folder based
     queries can run. */
  function loadAll() {
    if (_loading) return;
    _loading = true;
    setPaneBusy(true);
    queryAll(function (error, objects) {
      _folderMap = null;
      _state.settingsName = "";
      (objects || []).forEach(function (object) {
        var setup = fieldJsonOf(object, SETUP_FIELD_ID);
        if (setup && setup.recordKind === "schoolSettings" && !_folderMap && setup.folderMap) {
          _folderMap = setup.folderMap;
          _state.settingsName = setup.schoolName || "";
        }
      });
      var paramJson = tool.param("folderMapJson", "");
      if (!_folderMap && paramJson) {
        try { _folderMap = JSON.parse(paramJson); } catch (e) { _folderMap = null; }
      }
      stepDiscoverFolders();
    });
  }

  function stepDiscoverFolders() {
    loadFolderList(function (folders) {
      var ids = attendanceSubFolderIds(folders);
      var parentId = _folderMap && _folderMap.attendance ? _folderMap.attendance : "";
      _state.attendanceFolders = folders.filter(function (folder) {
        return folder && folder.id && ids.indexOf(String(folder.id)) > -1;
      });
      if (!ids.length && parentId) {
        _state.attendanceFolders = [{ id: parentId, name: "Attendance (year folder)" }];
      }
      stepLoadData();
    });
  }

  function stepLoadData() {
    var pending = 4;
    var finish = function () { pending--; if (pending <= 0) { _loading = false; setPaneBusy(false); renderActivePane(); } };
    var fail = function (error) { if (error) notify("Load problem: " + error, "warning"); };

    queryFolder(_folderMap && _folderMap.students, function (error, objects) {
      fail(error);
      _state.students = objects;
      finish();
    });
    queryFolder(_folderMap && _folderMap.lessons, function (error, objects) {
      fail(error);
      _state.lessons = objects;
      finish();
    });
    var subIds = attendanceSubFolderIdsFromState();
    if (subIds.length) {
      var collected = [];
      var left = subIds.length;
      subIds.forEach(function (folderId) {
        queryFolder(folderId, function (error, objects) {
          fail(error);
          collected = collected.concat(objects);
          left--;
          if (left <= 0) { _state.attendanceRecords = collected; finish(); }
        });
      });
    } else {
      queryFolder(_folderMap && _folderMap.attendance, function (error, objects) {
        fail(error);
        _state.attendanceRecords = objects;
        finish();
      });
    }
    queryFolder(_folderMap && _folderMap.payments, function (error, objects) {
      fail(error);
      _state.ledgers = objects;
      finish();
    });
  }

  function attendanceSubFolderIdsFromState() {
    return _state.attendanceFolders.map(function (f) { return f.id; });
  }

  function setPaneBusy(busy) {
    var btn = $("#sco-refresh");
    if (btn) btn.disabled = busy;
  }

  /* Tabs */
  function switchTab(tabName) {
    UI.ui.tab = tabName;
    try { tool.setValue(UI); } catch (e) { }
    var tabs = document.querySelectorAll(".sco-tab");
    var panes = document.querySelectorAll(".sco-pane");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle("active", tabs[i].getAttribute("data-tab") === tabName);
    }
    for (var j = 0; j < panes.length; j++) {
      panes[j].classList.toggle("active", panes[j].getAttribute("data-pane") === tabName);
    }
    renderActivePane();
    resize();
  }

  function renderActivePane() {
    if (UI.ui.tab === "students") renderStudents();
    else if (UI.ui.tab === "attendance") renderAttendance();
    else if (UI.ui.tab === "payments") renderPayments();
    else if (UI.ui.tab === "reports") { /* reports build on demand */ }
  }

  /* Students tab */
  function renderStudents() {
    var holder = $("#sco-student-list");
    var count = $("#sco-student-count");
    if (!_folderMap || !_folderMap.students) {
      if (holder) holder.innerHTML = '<p class="sco-empty">Folder map not loaded. Add a School Setup object for this year or set the folderMapJson parameter.</p>';
      if (count) count.textContent = "";
      return;
    }
    var list = _state.students.filter(function (object) {
      var s = fieldJsonOf(object, STUDENT_FIELD_ID) || {};
      var fullName = [(s.firstName || ""), (s.lastName || "")].join(" ").toLowerCase();
      if (_studentSearch && fullName.indexOf(_studentSearch.toLowerCase()) === -1) return false;
      if (_studentClassFilter && String(s.classGroup || "").toLowerCase().indexOf(_studentClassFilter.toLowerCase()) === -1) return false;
      return true;
    });
    list.sort(function (a, b) {
      var sa = fieldJsonOf(a, STUDENT_FIELD_ID) || {};
      var sb = fieldJsonOf(b, STUDENT_FIELD_ID) || {};
      return String(sa.firstName || "").localeCompare(String(sb.firstName || ""));
    });
    if (count) count.textContent = list.length + " student(s)";
    if (!holder) return;
    if (!list.length) { holder.innerHTML = '<p class="sco-empty">No students match.</p>'; return; }
    var rows = list.map(function (object) {
      var s = fieldJsonOf(object, STUDENT_FIELD_ID) || {};
      var fullName = [(s.firstName || ""), (s.lastName || "")].join(" ") || object.name || "Student";
      return "<tr>" +
        '<td><button class="sco-link" data-act="open-student" data-id="' + esc(object.id) + '">' + esc(fullName) + "</button></td>" +
        "<td>" + esc(s.classGroup || "-") + "</td>" +
        "<td><span class='sco-pill'>" + esc(s.status || "active") + "</span></td>" +
        "<td>" + esc(s.startDate || "-") + "</td>" +
        "<td>" + esc(s.emergencyContactPhone || "-") + "</td>" +
        "</tr>";
    }).join("");
    holder.innerHTML = '<table class="sco-table"><thead><tr><th>Name</th><th>Class group</th><th>Status</th><th>Start</th><th>Emergency phone</th></tr></thead><tbody>' + rows + "</tbody></table>";
  }

  function openStudentDetail(objectId) {
    var opener = null;
    if (typeof tool.openObjectDetail === "function") opener = function (cb) { tool.openObjectDetail(appType(), objectId, cb); };
    else if (typeof tool.openObjectInShell === "function") opener = function (cb) { tool.openObjectInShell(appType(), objectId, cb); };
    if (!opener) { notify("This CMS does not provide an object opener for listing tools.", "warning"); return; }
    try { opener(function (error) { if (error) notify("Could not open: " + error, "error"); }); }
    catch (e) { notify("Could not open: " + e.message, "error"); }
  }

  /* Attendance tab */
  function renderAttendance() {
    var holder = $("#sco-attendance-list");
    var summary = $("#sco-attendance-summary");
    var dateValue = $("#sco-attendance-date").value;
    var records = _state.attendanceRecords.filter(function (object) {
      var a = fieldJsonOf(object, ATTENDANCE_FIELD_ID) || {};
      return String(a.lessonDate || "") === dateValue;
    });
    var totals = { P: 0, A: 0, L: 0, E: 0 };
    records.forEach(function (object) {
      var a = fieldJsonOf(object, ATTENDANCE_FIELD_ID) || {};
      (Array.isArray(a.entries) ? a.entries : []).forEach(function (entry) {
        if (totals[entry.mark] != null) totals[entry.mark]++;
      });
    });
    if (summary) {
      summary.textContent = records.length + " record(s) - " + Object.keys(MARK_LABELS).map(function (m) {
        return MARK_LABELS[m] + " " + totals[m];
      }).join(" - ");
    }
    if (!holder) return;
    if (!_state.attendanceFolders.length && !_state.attendanceRecords.length) {
      holder.innerHTML = '<p class="sco-empty">No attendance folders discovered. Use the attendanceFolderIds parameter, or check that per lesson subfolders sit under the year attendance folder.</p>';
      return;
    }
    if (!records.length) {
      holder.innerHTML = '<p class="sco-empty">No attendance records for ' + esc(fmtDate(dateValue)) + ".</p>";
      return;
    }
    holder.innerHTML = records.map(function (object) {
      var a = fieldJsonOf(object, ATTENDANCE_FIELD_ID) || {};
      var entries = Array.isArray(a.entries) ? a.entries : [];
      var marks = { P: 0, A: 0, L: 0, E: 0 };
      entries.forEach(function (entry) { if (marks[entry.mark] != null) marks[entry.mark]++; });
      return '<div class="sco-lesson-block">' +
        '<div class="sco-lesson-block-title">' + esc(a.lessonName || object.name) +
        (a.teacherName ? " - " + esc(a.teacherName) : "") + "</div>" +
        '<table class="sco-table"><thead><tr><th>Mark</th><th>Count</th><th>Open</th></tr></thead><tbody>' +
        Object.keys(MARK_LABELS).map(function (m) {
          return "<tr><td>" + esc(MARK_LABELS[m]) + '</td><td>' + marks[m] + "</td><td>" +
            (m === "P" ? '<button class="sco-link" data-act="open-record" data-id="' + esc(object.id) + '">Open record</button>' : "") +
            "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }).join("");
  }

  function openRecordDetail(objectId) { openStudentDetail(objectId); }

  /* Payments tab */
  function ledgerRows() {
    var rows = [];
    _state.ledgers.forEach(function (object) {
      var ledger = fieldJsonOf(object, LEDGER_FIELD_ID) || {};
      (Array.isArray(ledger.entries) ? ledger.entries : []).forEach(function (entry) {
        rows.push({ object: object, ledger: ledger, entry: entry });
      });
    });
    return rows;
  }

  function renderPayments() {
    var holder = $("#sco-payment-list");
    var summary = $("#sco-payment-summary");
    var rows = ledgerRows().filter(function (row) {
      if (_paymentSearch && String(row.ledger.studentName || "").toLowerCase().indexOf(_paymentSearch.toLowerCase()) === -1) return false;
      if (_waitingOnly && row.entry.status !== "unpaid" && row.entry.status !== "partial") return false;
      return true;
    });
    var all = ledgerRows();
    var expected = 0, collected = 0, waiting = 0;
    all.forEach(function (row) {
      expected += Number(row.entry.amount) || 0;
      if (row.entry.status === "paid") collected += Number(row.entry.amount) || 0;
      else if (row.entry.status === "partial") collected += Number(row.entry.paidAmount) || 0;
      if (row.entry.status === "unpaid" || row.entry.status === "partial") waiting++;
    });
    if (summary) {
      summary.textContent = "Waiting " + waiting + " - expected " + expected.toFixed(2) + " - collected " + collected.toFixed(2);
    }
    if (!holder) return;
    if (!_folderMap || !_folderMap.payments) {
      holder.innerHTML = '<p class="sco-empty">Folder map not loaded. Add a School Setup object for this year or set the folderMapJson parameter.</p>';
      return;
    }
    if (!rows.length) { holder.innerHTML = '<p class="sco-empty">No ledger entries match.</p>'; return; }
    rows.sort(function (a, b) {
      if (String(a.entry.month || "") !== String(b.entry.month || "")) return String(a.entry.month || "") < String(b.entry.month || "") ? -1 : 1;
      return String(a.ledger.studentName || "").localeCompare(String(b.ledger.studentName || ""));
    });
    holder.innerHTML = '<table class="sco-table"><thead><tr><th>Student</th><th>Month</th><th>Amount</th><th>Status</th><th>Paid date</th></tr></thead><tbody>' +
      rows.map(function (row) {
        var statusPill = "sco-pill";
        if (row.entry.status === "paid") statusPill += " good";
        else if (row.entry.status === "partial") statusPill += " warn";
        else if (row.entry.status === "late") statusPill += " bad";
        return "<tr><td>" + esc(row.ledger.studentName || "-") + "</td>" +
          "<td>" + esc(row.entry.month || "-") + "</td>" +
          "<td>" + Number(row.entry.amount || 0).toFixed(2) + "</td>" +
          '<td><span class="' + statusPill + '">' + esc(row.entry.status || "unpaid") + "</span></td>" +
          "<td>" + esc(row.entry.paidDate || "-") + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  /* Reports */
  function attendanceRecordsInRange(mondayIso, sundayIso) {
    return _state.attendanceRecords.filter(function (object) {
      var a = fieldJsonOf(object, ATTENDANCE_FIELD_ID) || {};
      var d = String(a.lessonDate || "");
      return d >= mondayIso && d <= sundayIso;
    });
  }

  function buildWeeklyReport(sundayIso) {
    var mondayIso = mondayOfWeek(sundayIso);
    var records = attendanceRecordsInRange(mondayIso, sundayIso);
    var schoolName = _state.settingsName || "School";
    var lines = [];
    lines.push("WEEKLY REPORT - " + schoolName);
    lines.push("Week of " + mondayIso + " to " + sundayIso);
    lines.push("Generated " + todayIso());
    lines.push("");
    if (!records.length) {
      lines.push("No attendance records in this week.");
      return lines.join("\n");
    }
    var byDay = {};
    records.forEach(function (object) {
      var a = fieldJsonOf(object, ATTENDANCE_FIELD_ID) || {};
      var d = String(a.lessonDate || "");
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(a);
    });
    Object.keys(byDay).sort().forEach(function (day) {
      lines.push("=== " + day + " ===");
      byDay[day].forEach(function (a) {
        lines.push("Lesson: " + (a.lessonName || "Lesson") + (a.teacherName ? " - Teacher " + a.teacherName : ""));
        var entries = Array.isArray(a.entries) ? a.entries : [];
        Object.keys(MARK_LABELS).forEach(function (m) {
          var names = entries.filter(function (e) { return e.mark === m; }).map(function (e) { return e.studentName || "?"; });
          if (names.length) lines.push("  " + MARK_LABELS[m] + " (" + names.length + "): " + names.join(", "));
        });
      });
      lines.push("");
    });
    return lines.join("\n");
  }

  function buildPaymentSummaryText() {
    var lines = [];
    lines.push("PAYMENT SUMMARY - " + (_state.settingsName || "School"));
    lines.push("Generated " + todayIso());
    lines.push("");
    var expected = 0, collected = 0, waitingRows = [];
    ledgerRows().forEach(function (row) {
      expected += Number(row.entry.amount) || 0;
      if (row.entry.status === "paid") collected += Number(row.entry.amount) || 0;
      else if (row.entry.status === "partial") collected += Number(row.entry.paidAmount) || 0;
      if (row.entry.status === "unpaid" || row.entry.status === "partial") waitingRows.push(row);
    });
    lines.push("Expected: " + expected.toFixed(2) + " | Collected: " + collected.toFixed(2) + " | Waiting entries: " + waitingRows.length);
    lines.push("");
    if (!waitingRows.length) { lines.push("No waiting payments."); return lines.join("\n"); }
    lines.push("Waiting list:");
    waitingRows.forEach(function (row) {
      lines.push("- " + (row.ledger.studentName || "-") + " | " + (row.entry.month || "-") + " | " + Number(row.entry.amount || 0).toFixed(2) + " | " + (row.entry.status || "unpaid"));
    });
    return lines.join("\n");
  }

  function buildReport() {
    var sundayIso = $("#sco-report-week").value || thisSundayIso();
    var weekly = buildWeeklyReport(sundayIso);
    var payments = buildPaymentSummaryText();
    var text = weekly + "\n\n" + payments;
    $("#sco-report-text").textContent = text;
    resize();
  }

  function copyReport() {
    var text = $("#sco-report-text").textContent;
    function fallbackCopy() {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand("copy"); notify("Report copied."); } catch (e) { notify("Copy failed.", "warning"); }
      document.body.removeChild(textarea);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { notify("Report copied."); }, fallbackCopy);
    } else fallbackCopy();
  }

  function downloadReport() {
    var text = $("#sco-report-text").textContent;
    var blob = new Blob([text], { type: "text/plain" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "school-report-" + todayIso() + ".txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-tab]");
    if (el) { switchTab(el.getAttribute("data-tab")); return; }
    el = e.target.closest("[data-act]");
    if (!el) return;
    var act = el.getAttribute("data-act");
    var id = el.getAttribute("data-id");
    switch (act) {
      case "open-student": openStudentDetail(id); break;
      case "open-record": openRecordDetail(id); break;
      case "report-build": buildReport(); break;
      case "report-copy": copyReport(); break;
      case "report-download": downloadReport(); break;
    }
  });

  document.addEventListener("input", function (e) {
    var el = e.target;
    if (!el || !el.id) return;
    switch (el.id) {
      case "sco-student-search": _studentSearch = el.value.trim(); renderStudents(); break;
      case "sco-student-class": _studentClassFilter = el.value.trim(); renderStudents(); break;
      case "sco-payment-search": _paymentSearch = el.value.trim(); renderPayments(); break;
      case "sco-attendance-date": renderAttendance(); break;
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "sco-payment-waiting-only") {
      _waitingOnly = e.target.checked;
      renderPayments();
    }
  });

  tool.onReady(function (value) {
    UI = (value && value.ui) ? { version: 1, ui: { tab: value.ui.tab || "students" } } : UI;
    $("#sco-attendance-date").value = todayIso();
    $("#sco-report-week").value = thisSundayIso();
    $("#sco-refresh").addEventListener("click", loadAll);
    switchTab(UI.ui.tab);
    loadAll();

    tool.onValueChange(function (newValue) {
      if (newValue && newValue.ui && newValue.ui.tab) {
        UI.ui.tab = newValue.ui.tab;
        if (document.querySelector('.sco-tab[data-tab="' + UI.ui.tab + '"]')) switchTab(UI.ui.tab);
      }
    });

    tool.declareOutput({ type: "object", properties: { version: { type: "number" }, ui: { type: "object" } } });
    tool.declareParams([
      { name: "appObjectType", label: "Application Object Type", type: "text", default: "weekendSchool", severity: "optional", hint: "The application id (cmsObjectType) this console lists." },
      { name: "folderMapJson", label: "Folder Map JSON", type: "text", default: "", severity: "optional", hint: "Folder map if no School Setup object is readable." },
      { name: "attendanceFolderIds", label: "Attendance Folder Ids", type: "text", default: "", severity: "optional", hint: "Comma separated per lesson subfolder ids when folder discovery is unavailable." }
    ]);
  });
})();
