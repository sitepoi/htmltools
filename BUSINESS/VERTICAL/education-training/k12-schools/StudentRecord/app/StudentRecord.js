/* StudentRecord - reusable student file tool for the UniconHub CMS.
   One tool per student object. Holds identity, health and documents.
   Reads attendance, progress, communication log and parent contact
   objects of the same application (the CMS ACL already limits what
   each user can see). */
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

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  function notify(msg, sev) { try { tool.notify(msg, sev || "success"); } catch (e) { } }
  function resize() { try { tool.resize(); } catch (e) { } }

  var FIELD_ID = "studentRecord";
  var SETUP_FIELD_ID = "schoolSetup";
  var ATTENDANCE_FIELD_ID = "attendanceRecord";
  var PROGRESS_FIELD_ID = "lessonProgress";
  var COMMLOG_FIELD_ID = "communicationLog";
  var CONTACT_FIELD_ID = "parentContact";
  var MARK_LABELS = { P: "Present", A: "Absent", L: "Late", E: "Excused" };

  function defaultDatabase() {
    return {
      version: 1, recordKind: "studentRecord",
      firstName: "", lastName: "", gender: "", dateOfBirth: "",
      classGroup: "", status: "active", startDate: "", photoConsent: "notAsked",
      emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "",
      allergies: "", healthNotes: "", pickupAuthorizedNames: "", pickupNotes: "",
      documents: [], registeredYear: "", seeded: false
    };
  }

  function normalizeDatabase(raw) {
    var d = defaultDatabase();
    if (!raw || typeof raw !== "object") return d;
    [
      "firstName", "lastName", "gender", "dateOfBirth", "classGroup", "status",
      "startDate", "photoConsent", "emergencyContactName", "emergencyContactPhone",
      "emergencyContactRelation", "allergies", "healthNotes", "pickupAuthorizedNames",
      "pickupNotes", "registeredYear"
    ].forEach(function (key) {
      if (raw[key] != null) d[key] = String(raw[key]);
    });
    if (Array.isArray(raw.documents)) {
      d.documents = raw.documents.map(function (doc) {
        return {
          id: String(doc.id || uid()),
          name: String(doc.name || "Document"),
          url: String(doc.url || ""),
          kind: String(doc.kind || "other"),
          uploadedAt: String(doc.uploadedAt || ""),
          uploadedBy: String(doc.uploadedBy || "")
        };
      });
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
  var _ownObjectId = "";
  var _crossObjects = [];
  var _activeTab = "overview";

  function hasUserApi() { return typeof tool.getUser === "function"; }
  function getUserSafe() { try { return hasUserApi() ? tool.getUser() : null; } catch (e) { return null; } }
  function userName() { return _user ? (_user.name || _user.email || "CMS user") : "CMS user"; }
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
  function isPrincipal() {
    if (!_user) return _noIdentity;
    var ea = (_user && _user.effectiveAccess) || {};
    if (ea.isManager) return true;
    var roles = rolesOf();
    return ["admin", "owner", "developer", "user-manager"].some(function (r) { return roles.indexOf(r) > -1; });
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
    var app = $("#srec-app");
    if (!app) return;
    if (!canWrite()) app.classList.add("srec-readonly");
    else app.classList.remove("srec-readonly");
    var editButton = $("#srec-edit");
    if (editButton) editButton.style.display = canWrite() ? "" : "none";
    var docAdd = $("#srec-doc-add");
    if (docAdd) docAdd.style.display = canWrite() ? "" : "none";
    var commAdd = $("#srec-comm-add");
    if (commAdd) commAdd.style.display = (canWrite() && isPrincipal()) ? "" : "none";
    var commTab = document.querySelector('.srec-tab[data-tab="communication"]');
    var contactTab = document.querySelector('.srec-tab[data-tab="contact"]');
    if (commTab) commTab.style.display = isPrincipal() ? "" : "none";
    if (contactTab) contactTab.style.display = isPrincipal() ? "" : "none";
    if (!isPrincipal() && (_activeTab === "communication" || _activeTab === "contact")) switchTab("overview");
  }

  function persistSoon() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(function () {
      try { tool.setValue(DB); } catch (e) { }
      if (_readOnly) return;
      try {
        if (typeof tool.requestSave !== "function") return;
        tool.requestSave(function (error, ok) {
          if ((error || !ok) && !_warnedAutosave) {
            _warnedAutosave = true;
            notify("Automatic save was rejected. Set allowRequestSave to 'yes' in the CMS field settings.", "warning");
          }
        });
      } catch (e) { }
    }, 300);
  }

  function appType() { return tool.param("appObjectType", "weekendSchool"); }

  function callObjects(action, params, callback) {
    try {
      if (typeof tool.requestObjects !== "function") { callback("requestObjects is not available. Set allowObjectCRUD to 'yes' in the field settings.", null); return; }
      tool.requestObjects(action, params, callback);
    } catch (e) { callback(String(e && e.message ? e.message : e), null); }
  }

  function fieldJsonOf(object, fieldId) {
    var dcb = (object && object.productData && object.productData.data_categoriesBased) || {};
    return dcb[fieldId] || null;
  }

  /* Cross object reads: query the application with no typeId. The CMS
     ACL returns only what this user may read, which is exactly what the
     school permission model intends. */
  function loadCrossObjects() {
    callObjects("query", { mainObjectType: appType() }, function (error, result) {
      if (error) { notify("Could not read related records: " + error, "warning"); return; }
      _crossObjects = (result && Array.isArray(result.objects)) ? result.objects : [];
      renderActiveTab();
    });
  }

  function settingsObject() {
    for (var i = 0; i < _crossObjects.length; i++) {
      var setup = fieldJsonOf(_crossObjects[i], SETUP_FIELD_ID);
      if (setup && setup.recordKind === "schoolSettings") return setup;
    }
    return null;
  }

  /* Rendering */
  function fullName() { return [DB.firstName, DB.lastName].filter(Boolean).join(" ") || "Student"; }

  function renderHeader() {
    var title = $("#srec-title");
    var subtitle = $("#srec-subtitle");
    if (title) title.textContent = fullName();
    if (subtitle) {
      subtitle.textContent = [DB.classGroup, DB.status ? "Status: " + DB.status : ""].filter(Boolean).join(" - ");
    }
  }

  function gridHtml(items) {
    return items.map(function (item) {
      return '<div class="srec-item"><span class="srec-item-label">' + esc(item.label) + '</span><span class="srec-item-value">' + (item.valueHtml || esc(item.value || "-")) + "</span></div>";
    }).join("");
  }

  function renderOverview() {
    var identity = $("#srec-identity-grid");
    if (identity) {
      identity.innerHTML = gridHtml([
        { label: "First name", value: DB.firstName },
        { label: "Last name", value: DB.lastName },
        { label: "Gender", value: DB.gender },
        { label: "Date of birth", value: fmtDate(DB.dateOfBirth) },
        { label: "Class group", value: DB.classGroup },
        { label: "Status", value: DB.status },
        { label: "Start date", value: fmtDate(DB.startDate) },
        { label: "Photo consent", value: DB.photoConsent },
        { label: "Registered year", value: DB.registeredYear }
      ]);
    }
    var health = $("#srec-health-grid");
    if (health) {
      health.innerHTML = gridHtml([
        { label: "Emergency contact", value: [DB.emergencyContactName, DB.emergencyContactRelation].filter(Boolean).join(" - ") },
        { label: "Emergency phone", value: DB.emergencyContactPhone },
        { label: "Allergies", value: DB.allergies },
        { label: "Health notes", value: DB.healthNotes },
        { label: "Pickup authorized", value: DB.pickupAuthorizedNames },
        { label: "Pickup notes", value: DB.pickupNotes }
      ]);
    }
    renderDocuments();
  }

  function renderDocuments() {
    var holder = $("#srec-doc-list");
    if (!holder) return;
    if (!DB.documents.length) { holder.innerHTML = '<p class="srec-empty">No documents.</p>'; return; }
    holder.innerHTML = DB.documents.map(function (doc) {
      return '<div class="srec-doc-row"><div>' +
        '<div class="srec-doc-name">' + esc(doc.name) + '</div>' +
        '<div class="srec-doc-meta">' + esc(doc.kind) + (doc.uploadedAt ? " - " + esc(fmtDate(doc.uploadedAt)) : "") + (doc.uploadedBy ? " by " + esc(doc.uploadedBy) : "") + "</div></div>" +
        '<div>' +
        (doc.url ? '<button class="srec-btn srec-btn-ghost srec-btn-sm" data-act="doc-open" data-id="' + esc(doc.id) + '">Open</button> ' : "") +
        '<button class="srec-btn srec-btn-danger srec-btn-sm" data-act="doc-remove" data-id="' + esc(doc.id) + '">Remove</button>' +
        "</div></div>";
    }).join("");
  }

  function renderAttendance() {
    var holder = $("#srec-attendance-list");
    if (!holder) return;
    var rows = [];
    _crossObjects.forEach(function (object) {
      var record = fieldJsonOf(object, ATTENDANCE_FIELD_ID);
      if (!record) return;
      (Array.isArray(record.entries) ? record.entries : []).forEach(function (entry) {
        if (String(entry.studentId || "") === _ownObjectId) {
          rows.push({
            date: record.lessonDate, lesson: record.lessonName || object.name,
            mark: entry.mark, note: entry.note || ""
          });
        }
      });
    });
    rows.sort(function (a, b) { return String(b.date || "") < String(a.date || "") ? -1 : 1; });
    if (!rows.length) { holder.innerHTML = '<p class="srec-empty">No attendance records found.</p>'; return; }
    holder.innerHTML = rows.slice(0, 30).map(function (row) {
      return '<div class="srec-entry"><div class="srec-entry-head">' +
        '<span class="srec-mark ' + esc(row.mark || "") + '">' + esc(MARK_LABELS[row.mark] || row.mark || "?") + "</span> " +
        esc(row.lesson) + '</div><div class="srec-entry-sub">' + esc(fmtDate(row.date)) +
        (row.note ? " - " + esc(row.note) : "") + "</div></div>";
    }).join("");
  }

  function renderProgress() {
    var holder = $("#srec-progress-list");
    if (!holder) return;
    var rows = [];
    _crossObjects.forEach(function (object) {
      var progress = fieldJsonOf(object, PROGRESS_FIELD_ID);
      if (!progress || String(progress.studentId || "") !== _ownObjectId) return;
      (Array.isArray(progress.activityLog) ? progress.activityLog : []).forEach(function (logEntry) {
        rows.push({
          date: logEntry.at || "", lesson: progress.lessonName || object.name,
          text: logEntry.note || ""
        });
      });
      (Array.isArray(progress.checklist) ? progress.checklist : []).forEach(function (item) {
        if (item.doneAt || item.markedAt) {
          rows.push({
            date: item.doneAt || item.markedAt || "", lesson: progress.lessonName || object.name,
            text: (item.label || "Checklist item") + " completed"
          });
        }
      });
    });
    rows.sort(function (a, b) { return String(b.date || "") < String(a.date || "") ? -1 : 1; });
    if (!rows.length) { holder.innerHTML = '<p class="srec-empty">No progress notes found.</p>'; return; }
    holder.innerHTML = rows.slice(0, 30).map(function (row) {
      return '<div class="srec-entry"><div class="srec-entry-head">' + esc(row.lesson) + '</div>' +
        '<div class="srec-entry-sub">' + esc(fmtDate(row.date)) + " - " + esc(row.text) + "</div></div>";
    }).join("");
  }

  function commLogObject() {
    for (var i = 0; i < _crossObjects.length; i++) {
      var log = fieldJsonOf(_crossObjects[i], COMMLOG_FIELD_ID);
      if (log && String(log.studentId || "") === _ownObjectId) return { object: _crossObjects[i], json: log };
    }
    return null;
  }

  function renderCommunication() {
    var oneHolder = $("#srec-comm-list");
    var absenceHolder = $("#srec-absence-list");
    if (!isPrincipal()) {
      if (oneHolder) oneHolder.innerHTML = '<p class="srec-empty">Only the principal sees this tab.</p>';
      if (absenceHolder) absenceHolder.innerHTML = "";
      return;
    }
    var found = commLogObject();
    var oneOnOne = found && Array.isArray(found.json.oneOnOne) ? found.json.oneOnOne : [];
    var absenceCalls = found && Array.isArray(found.json.absenceCalls) ? found.json.absenceCalls : [];
    if (oneHolder) {
      oneHolder.innerHTML = oneOnOne.length ? oneOnOne.slice().reverse().map(function (entry) {
        return '<div class="srec-entry"><div class="srec-entry-sub">' + esc(fmtDate(entry.at)) + "</div>" + esc(entry.note || "") + "</div>";
      }).join("") : '<p class="srec-empty">No one-on-one communication logged.</p>';
    }
    if (absenceHolder) {
      absenceHolder.innerHTML = absenceCalls.length ? absenceCalls.slice().reverse().map(function (entry) {
        return '<div class="srec-entry"><div class="srec-entry-sub">' + esc(fmtDate(entry.at)) + "</div>" + esc(entry.note || "") + "</div>";
      }).join("") : '<p class="srec-empty">No absence calls logged.</p>';
    }
  }

  function renderContact() {
    var holder = $("#srec-contact-view");
    if (!holder) return;
    if (!isPrincipal()) { holder.innerHTML = '<p class="srec-empty">Only the principal sees this tab.</p>'; return; }
    var contact = null;
    _crossObjects.forEach(function (object) {
      var c = fieldJsonOf(object, CONTACT_FIELD_ID);
      if (c && String(c.studentId || "") === _ownObjectId) contact = c;
    });
    if (!contact) { holder.innerHTML = '<p class="srec-empty">No parent contact record found.</p>'; return; }
    var parentLine = [contact.parentName, contact.parentRelation].filter(Boolean).join(" - ");
    holder.innerHTML = gridHtml([
      { label: "Parent", value: parentLine },
      { label: "Phone", value: contact.parentPhone },
      { label: "Email", value: contact.parentEmail },
      { label: "Second parent", value: contact.secondParentName },
      { label: "Second parent phone", value: contact.secondParentPhone },
      { label: "Address", value: contact.address }
    ]);
  }

  function renderActiveTab() {
    if (_activeTab === "overview") renderOverview();
    else if (_activeTab === "attendance") renderAttendance();
    else if (_activeTab === "progress") renderProgress();
    else if (_activeTab === "communication") renderCommunication();
    else if (_activeTab === "contact") renderContact();
    resize();
  }

  function switchTab(tabName) {
    _activeTab = tabName;
    var tabs = document.querySelectorAll(".srec-tab");
    var panes = document.querySelectorAll(".srec-pane");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle("active", tabs[i].getAttribute("data-tab") === tabName);
    }
    for (var j = 0; j < panes.length; j++) {
      panes[j].classList.toggle("active", panes[j].getAttribute("data-pane") === tabName);
    }
    renderActiveTab();
  }

  /* Edit modal */
  function openEditModal() {
    var v = DB;
    var consentOptions = ["notAsked", "yes", "no"].map(function (c) {
      return '<option value="' + c + '"' + (String(v.photoConsent) === c ? " selected" : "") + ">" + c + "</option>";
    }).join("");
    openModal("Edit Student - " + fullName(),
      '<div class="srec-grid">' +
      '<div class="srec-field"><label class="srec-label">First name</label><input class="srec-input" id="srecf-first" value="' + esc(v.firstName) + '"></div>' +
      '<div class="srec-field"><label class="srec-label">Last name</label><input class="srec-input" id="srecf-last" value="' + esc(v.lastName) + '"></div>' +
      '<div class="srec-field"><label class="srec-label">Gender</label><input class="srec-input" id="srecf-gender" value="' + esc(v.gender) + '"></div>' +
      '<div class="srec-field"><label class="srec-label">Date of birth</label><input class="srec-input" id="srecf-dob" type="date" value="' + esc(v.dateOfBirth) + '"></div>' +
      '<div class="srec-field"><label class="srec-label">Class group</label><input class="srec-input" id="srecf-class" value="' + esc(v.classGroup) + '"></div>' +
      '<div class="srec-field"><label class="srec-label">Start date</label><input class="srec-input" id="srecf-start" type="date" value="' + esc(v.startDate) + '"></div>' +
      '<div class="srec-field"><label class="srec-label">Status</label><input class="srec-input" id="srecf-status" value="' + esc(v.status) + '"></div>' +
      '<div class="srec-field"><label class="srec-label">Photo consent</label><select class="srec-select" id="srecf-consent">' + consentOptions + "</select></div>" +
      '<div class="srec-field"><label class="srec-label">Emergency contact name</label><input class="srec-input" id="srecf-ec-name" value="' + esc(v.emergencyContactName) + '"></div>' +
      '<div class="srec-field"><label class="srec-label">Emergency contact phone</label><input class="srec-input" id="srecf-ec-phone" value="' + esc(v.emergencyContactPhone) + '"></div>' +
      '<div class="srec-field"><label class="srec-label">Emergency contact relation</label><input class="srec-input" id="srecf-ec-relation" value="' + esc(v.emergencyContactRelation) + '"></div>' +
      '<div class="srec-field"><label class="srec-label">Allergies</label><input class="srec-input" id="srecf-allergies" value="' + esc(v.allergies) + '"></div>' +
      '<div class="srec-field"><label class="srec-label">Pickup authorized names</label><input class="srec-input" id="srecf-pickup" value="' + esc(v.pickupAuthorizedNames) + '"></div>' +
      "</div>" +
      '<div class="srec-field" style="margin-top:10px"><label class="srec-label">Health notes</label><textarea class="srec-textarea" id="srecf-health-notes" rows="2">' + esc(v.healthNotes) + "</textarea></div>" +
      '<div class="srec-field" style="margin-top:10px"><label class="srec-label">Pickup notes</label><textarea class="srec-textarea" id="srecf-pickup-notes" rows="2">' + esc(v.pickupNotes) + "</textarea></div>",
      '<button class="srec-btn" data-act="modal-close">Cancel</button>' +
      '<button class="srec-btn srec-btn-primary" data-act="edit-save">Save</button>');
  }

  function saveEditFromModal() {
    var read = function (id) { var el = $("#" + id); return el ? String(el.value || "").trim() : ""; };
    DB.firstName = read("srecf-first");
    DB.lastName = read("srecf-last");
    DB.gender = read("srecf-gender");
    DB.dateOfBirth = read("srecf-dob");
    DB.classGroup = read("srecf-class");
    DB.startDate = read("srecf-start");
    DB.status = read("srecf-status") || "active";
    DB.photoConsent = read("srecf-consent") || "notAsked";
    DB.emergencyContactName = read("srecf-ec-name");
    DB.emergencyContactPhone = read("srecf-ec-phone");
    DB.emergencyContactRelation = read("srecf-ec-relation");
    DB.allergies = read("srecf-allergies");
    DB.pickupAuthorizedNames = read("srecf-pickup");
    DB.healthNotes = read("srecf-health-notes");
    DB.pickupNotes = read("srecf-pickup-notes");
    closeModal();
    persistSoon();
    renderHeader();
    renderOverview();
    notify("Student record saved.");
  }

  /* Documents */
  function openAddDocumentModal() {
    openModal("Add Document",
      '<div class="srec-field"><label class="srec-label">Document name</label><input class="srec-input" id="srecf-doc-name" placeholder="e.g. Registration form"></div>' +
      '<div class="srec-field" style="margin-top:10px"><label class="srec-label">Kind</label>' +
      '<select class="srec-select" id="srecf-doc-kind"><option>form</option><option>report</option><option>certificate</option><option>photo</option><option>other</option></select></div>' +
      '<div class="srec-field" style="margin-top:10px"><label class="srec-label">File</label><input type="file" class="srec-input" id="srecf-doc-file"></div>' +
      '<p class="srec-hint">If the file input is not available in your CMS, paste the document URL below.</p>' +
      '<div class="srec-field" style="margin-top:10px"><label class="srec-label">Or document URL</label><input class="srec-input" id="srecf-doc-url"></div>',
      '<button class="srec-btn" data-act="modal-close">Cancel</button>' +
      '<button class="srec-btn srec-btn-primary" data-act="doc-save">Add document</button>');
  }

  function saveDocumentFromModal() {
    var name = $("#srecf-doc-name").value.trim();
    if (!name) { notify("Document name is required.", "warning"); return; }
    var fileInput = $("#srecf-doc-file");
    var url = $("#srecf-doc-url").value.trim();
    var kind = $("#srecf-doc-kind").value;
    closeModal();
    function finishDocument(docUrl) {
      DB.documents.push({ id: uid(), name: name, url: docUrl || "", kind: kind, uploadedAt: todayIso(), uploadedBy: userName() });
      persistSoon();
      renderDocuments();
      notify("Document added.");
    }
    if (fileInput && fileInput.files && fileInput.files.length && typeof tool.requestUpload === "function") {
      try {
        tool.requestUpload(fileInput.files[0], function (error, result) {
          if (error) { notify("Upload failed: " + error + ". Added without a URL.", "warning"); finishDocument(url); return; }
          var uploadedUrl = (result && (result.url || result.urlPath || result.fileUrl)) || url;
          finishDocument(uploadedUrl);
        });
        return;
      } catch (e) { finishDocument(url); return; }
    }
    finishDocument(url);
  }

  function openDocument(docId) {
    for (var i = 0; i < DB.documents.length; i++) {
      if (DB.documents[i].id === docId) {
        var url = DB.documents[i].url;
        if (!url) { notify("This document has no URL.", "warning"); return; }
        try { window.open(url, "_blank"); } catch (e) { notify("Could not open the document.", "warning"); }
        return;
      }
    }
  }

  /* Communication log */
  function openCommModal() {
    openModal("Add Communication Entry - " + fullName(),
      '<div class="srec-field"><label class="srec-label">Type</label>' +
      '<select class="srec-select" id="srecf-comm-type"><option value="oneOnOne">One-on-one</option><option value="absenceCalls">Absence call</option></select></div>' +
      '<div class="srec-field" style="margin-top:10px"><label class="srec-label">Date</label><input class="srec-input" id="srecf-comm-date" type="date" value="' + esc(todayIso()) + '"></div>' +
      '<div class="srec-field" style="margin-top:10px"><label class="srec-label">Note</label><textarea class="srec-textarea" id="srecf-comm-note" rows="3"></textarea></div>',
      '<button class="srec-btn" data-act="modal-close">Cancel</button>' +
      '<button class="srec-btn srec-btn-primary" data-act="comm-save">Save entry</button>');
  }

  function saveCommEntry() {
    var type = $("#srecf-comm-type").value;
    var at = $("#srecf-comm-date").value || todayIso();
    var note = $("#srecf-comm-note").value.trim();
    if (!note) { notify("Note is required.", "warning"); return; }
    var entry = { at: at, note: note };
    closeModal();
    var found = commLogObject();
    if (found) {
      var nextJson = {
        recordKind: "communicationLog", studentId: _ownObjectId,
        oneOnOne: Array.isArray(found.json.oneOnOne) ? found.json.oneOnOne.slice() : [],
        absenceCalls: Array.isArray(found.json.absenceCalls) ? found.json.absenceCalls.slice() : []
      };
      if (type === "oneOnOne") nextJson.oneOnOne.push(entry);
      else nextJson.absenceCalls.push(entry);
      updateObjectField(found.object.id, found.object.version, COMMLOG_FIELD_ID, nextJson);
    } else {
      var setup = settingsObject();
      var communicationFolderId = setup && setup.folderMap ? setup.folderMap.communication : tool.param("communicationFolderId", "");
      if (!communicationFolderId) {
        notify("Communication folder id not found. Set the communicationFolderId parameter or add a School Setup object.", "warning");
        return;
      }
      var json = { recordKind: "communicationLog", studentId: _ownObjectId, oneOnOne: [], absenceCalls: [] };
      if (type === "oneOnOne") json.oneOnOne.push(entry);
      else json.absenceCalls.push(entry);
      createCommLogObject(communicationFolderId, json);
    }
  }

  function updateObjectField(objectId, baseVersion, fieldId, json) {
    callObjects("update", {
      mainObjectType: appType(), objectId: objectId, baseVersion: baseVersion,
      productData: { data_categoriesBased: {} }
    }, function (error) {
      if (error) { notify("Could not save the communication entry: " + error, "error"); return; }
      notify("Communication entry saved.");
      loadCrossObjects();
    });
  }

  function createCommLogObject(folderId, json) {
    var payload = {
      mainObjectType: appType(), typeId: folderId,
      name: fullName() + " - Communication",
      productData: { data_categoriesBased: {} }
    };
    payload.productData.data_categoriesBased[COMMLOG_FIELD_ID] = json;
    callObjects("create", payload, function (error) {
      if (error) { notify("Could not create the communication log: " + error, "error"); return; }
      notify("Communication log created.");
      loadCrossObjects();
    });
  }

  /* Modal helpers */
  function openModal(title, bodyHtml, footHtml) {
    $("#srec-modal-title").textContent = title;
    $("#srec-modal-body").innerHTML = bodyHtml;
    $("#srec-modal-foot").innerHTML = footHtml || "";
    $("#srec-modal-overlay").classList.add("open");
    resize();
  }
  function closeModal() {
    $("#srec-modal-overlay").classList.remove("open");
    resize();
  }

  document.addEventListener("click", function (e) {
    if (e.target === $("#srec-modal-overlay")) { closeModal(); return; }
    var tab = e.target.closest("[data-tab]");
    if (tab) { switchTab(tab.getAttribute("data-tab")); return; }
    var el = e.target.closest("[data-act]");
    if (!el) return;
    var act = el.getAttribute("data-act");
    var id = el.getAttribute("data-id");
    switch (act) {
      case "modal-close": closeModal(); break;
      case "edit-open": openEditModal(); break;
      case "edit-save": saveEditFromModal(); break;
      case "doc-add-open": openAddDocumentModal(); break;
      case "doc-save": saveDocumentFromModal(); break;
      case "doc-open": openDocument(id); break;
      case "doc-remove":
        DB.documents = DB.documents.filter(function (d) { return d.id !== id; });
        persistSoon(); renderDocuments();
        break;
      case "comm-add-open": openCommModal(); break;
      case "comm-save": saveCommEntry(); break;
    }
  });

  tool.onReady(function (value, fields) {
    DB = normalizeDatabase(value);
    if (!DB.seeded) {
      var paramName = tool.param("studentName", "");
      if (paramName && !DB.firstName && !DB.lastName) DB.firstName = paramName;
      DB.seeded = true;
      persistSoon();
    }
    if (fields && typeof fields === "object") {
      _ownObjectId = String(fields.id || fields._id || "");
      if (!_ownObjectId && value && value.studentId) _ownObjectId = String(value.studentId);
    }
    if (!_ownObjectId && DB.recordKind === "studentRecord") _ownObjectId = "self";
    _user = getUserSafe();
    refreshUser();
    renderHeader();
    switchTab("overview");
    loadCrossObjects();

    tool.onValueChange(function (newValue) {
      DB = normalizeDatabase(newValue);
      renderHeader();
      renderActiveTab();
    });
    tool.onReadonlyChange(function (ro) { _readOnly = !!ro; applyReadonlyState(); });
    tool.onUserChange(function (u) { _user = u || getUserSafe(); applyReadonlyState(); loadCrossObjects(); });

    tool.declareOutput({ type: "object", properties: { version: { type: "number" }, recordKind: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" } } });
    tool.declareParams([
      { name: "appObjectType", label: "Application Object Type", type: "text", default: "weekendSchool", severity: "optional", hint: "The application id (cmsObjectType) this student belongs to." },
      { name: "communicationFolderId", label: "Communication Folder Id", type: "text", default: "", severity: "optional", hint: "Fallback folder for new communication logs when no School Setup object is readable." },
      { name: "allowObjectCRUD", label: "Allow Object CRUD", type: "toggle", default: "yes", severity: "goodToHave", hint: "Must be 'yes' so communication entries can be saved." },
      { name: "allowRequestSave", label: "Allow Request Save", type: "toggle", default: "yes", severity: "goodToHave", hint: "Must be 'yes' so changes save automatically." }
    ]);
  });
})();
