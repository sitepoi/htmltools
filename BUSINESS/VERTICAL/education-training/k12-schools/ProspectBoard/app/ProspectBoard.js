/* ProspectBoard - reusable enrollment pipeline tool for the UniconHub CMS.
   One tool per year, placed on the prospect board object of the school
   application. Converts a prospect into student, payment ledger, parent
   contact and communication log objects in one batch. */
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
  function todayIso() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  function notify(msg, sev) { try { tool.notify(msg, sev || "success"); } catch (e) { } }
  function resize() { try { tool.resize(); } catch (e) { } }

  var FIELD_ID = "prospectBoard";
  var STUDENT_FIELD_ID = "studentRecord";
  var LEDGER_FIELD_ID = "paymentLedger";
  var CONTACT_FIELD_ID = "parentContact";
  var COMMLOG_FIELD_ID = "communicationLog";
  var SETUP_FIELD_ID = "schoolSetup";
  var STATUSES = ["new", "contacted", "interested", "enrolled", "inactive"];
  var STATUS_LABELS = { new: "New", contacted: "Contacted", interested: "Interested", enrolled: "Enrolled", inactive: "Inactive" };
  var DECISIONS = ["none", "positive", "negative"];
  var DECISION_LABELS = { none: "Waiting", positive: "Registered", negative: "Not registering" };
  var DEFAULT_FOLDER_KEYS = ["settings", "lessons", "prospects", "students", "attendance", "progress", "payments", "contacts", "communication"];

  function defaultDatabase() {
    return { version: 1, recordKind: "prospectBoard", prospects: [], tasks: [], currentRound: 0, seeded: false };
  }

  function normalizeDatabase(raw) {
    var d = defaultDatabase();
    if (!raw || typeof raw !== "object") return d;
    if (Array.isArray(raw.prospects)) {
      d.prospects = raw.prospects.map(function (p) {
        var decision = DECISIONS.indexOf(p.decision) > -1 ? p.decision
          : p.status === "enrolled" ? "positive"
          : p.status === "inactive" ? "negative"
          : "none";
        var status = STATUSES.indexOf(p.status) > -1 ? p.status : "new";
        // Positive means REGISTERED, negative means NOT REGISTERING - keep
        // the status in sync with the decision so reports never disagree.
        if (decision === "positive" && status !== "enrolled") status = "enrolled";
        else if (decision === "negative" && status !== "inactive") status = "inactive";
        return {
          id: String(p.id || uid()),
          firstName: String(p.firstName || ""),
          lastName: String(p.lastName || ""),
          parentName: String(p.parentName || ""),
          parentPhone: String(p.parentPhone || ""),
          parentEmail: String(p.parentEmail || ""),
          source: String(p.source || ""),
          interestedLessons: String(p.interestedLessons || ""),
          status: status,
          decision: decision,
          nextCallDate: String(p.nextCallDate || ""),
          notes: String(p.notes || ""),
          createdAt: p.createdAt || todayIso(),
          communicationLog: Array.isArray(p.communicationLog) ? p.communicationLog.map(function (c) {
            return {
              at: String(c.at || ""),
              note: String(c.note || ""),
              outcome: DECISIONS.indexOf(c.outcome) > -1 ? c.outcome : "none"
            };
          }) : Array.isArray(p.callLog) ? p.callLog.map(function (c) {
            return {
              at: String(c.at || ""),
              note: String(c.note || ""),
              outcome: DECISIONS.indexOf(c.outcome) > -1 ? c.outcome : "none"
            };
          }) : []
        };
      });
    }
    if (Array.isArray(raw.tasks)) {
      d.tasks = raw.tasks.map(function (task) {
        return {
          id: String(task.id || uid()),
          prospectId: String(task.prospectId || ""),
          prospectName: String(task.prospectName || ""),
          channel: ["call", "email", "whatsapp"].indexOf(task.channel) > -1 ? task.channel : "call",
          assigneeId: String(task.assigneeId || ""),
          assignee: String(task.assignee || ""),
          dueDate: String(task.dueDate || ""),
          status: ["open", "done", "skipped"].indexOf(task.status) > -1 ? task.status : "open",
          note: String(task.note || ""),
          round: Number(task.round) || 1,
          createdAt: String(task.createdAt || "")
        };
      }).filter(function (task) { return task.prospectId; });
    }
    d.currentRound = Number(raw.currentRound) || 0;
    d.seeded = !!raw.seeded;
    return d;
  }

  var DB = defaultDatabase();
  var _readOnly = false;
  var _user = null;
  var _noIdentity = false;
  var _saveTimer = null;
  var _warnedAutosave = false;
  var _folderMap = null;
  var _folderMapResolved = false;
  var _searchText = "";
  var _statusFilter = "all";
  var _sourceFilter = "all";
  var _activeTab = "dashboard";
  var _myTaskFilter = "open";
  var _distView = "progress";
  var _permittedUsers = [];
  var _importRows = [];
  var _importColumns = [];

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
    var app = $("#prb-app");
    if (!app) return;
    if (!canWrite()) app.classList.add("prb-readonly");
    else app.classList.remove("prb-readonly");
    updateDistributionVisibility();
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

  /* Resolve the year folder map: read the settings object of this app,
     then fall back to the folderMapJson parameter. */
  function resolveFolderMap() {
    var paramJson = tool.param("folderMapJson", "");
    if (paramJson) {
      try { _folderMap = JSON.parse(paramJson); _folderMapResolved = true; } catch (e) { _folderMap = null; }
    }
    queryAll(function (error, objects) {
      if (error) { finishFolderMap(); return; }
      for (var i = 0; i < objects.length; i++) {
        var setup = fieldJsonOf(objects[i], SETUP_FIELD_ID);
        if (setup && setup.recordKind === "schoolSettings" && setup.folderMap) {
          _folderMap = setup.folderMap;
          break;
        }
      }
      finishFolderMap();
    });
  }
  function finishFolderMap() {
    if (!_folderMap && !_folderMapResolved) {
      try { _folderMap = JSON.parse(tool.param("folderMapJson", "") || "null"); } catch (e) { _folderMap = null; }
    }
    _folderMapResolved = true;
    renderList();
  }
  function folderIdOf(key) { return _folderMap && _folderMap[key] ? _folderMap[key] : ""; }

  /* Rendering */
  function renderChips() {
    var holder = $("#prb-chips");
    if (!holder) return;
    var byStatus = {};
    STATUSES.forEach(function (s) { byStatus[s] = 0; });
    DB.prospects.forEach(function (p) { byStatus[p.status]++; });
    var chips = [["all", "All"]].concat(STATUSES.map(function (s) { return [s, STATUS_LABELS[s]]; }));
    holder.innerHTML = chips.map(function (pair) {
      var count = pair[0] === "all" ? DB.prospects.length : byStatus[pair[0]];
      return '<button class="prb-chip' + (_statusFilter === pair[0] ? " active" : "") + '" data-act="filter" data-id="' + esc(pair[0]) + '">' +
        '<span>' + esc(pair[1]) + '</span><span class="prb-chip-count">' + count + "</span></button>";
    }).join("");
  }

  function renderCounts() {
    var counts = $("#prb-counts");
    if (!counts) return;
    var byStatus = {};
    STATUSES.forEach(function (s) { byStatus[s] = 0; });
    DB.prospects.forEach(function (p) { byStatus[p.status]++; });
    counts.textContent = DB.prospects.length + " prospect(s) - " + STATUSES.map(function (s) {
      return STATUS_LABELS[s] + " " + byStatus[s];
    }).join(" - ");
    renderStats();
  }

  function renderStats() {
    setValueText("prb-kpi-prospects", String(DB.prospects.length));
    setValueText("prb-kpi-open", String(DB.tasks.filter(function (t) { return t.status === "open"; }).length));
    setValueText("prb-kpi-today", String(DB.tasks.filter(function (t) { return t.status === "open" && t.dueDate && t.dueDate <= todayIso(); }).length));
    var weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    var weekAgoIso = isoOfDate(weekAgo);
    var communicationsThisWeek = 0;
    DB.prospects.forEach(function (p) {
      (p.communicationLog || []).forEach(function (entry) { if (entry.at >= weekAgoIso) communicationsThisWeek++; });
    });
    setValueText("prb-kpi-calls", String(communicationsThisWeek));
  }

  function setValueText(id, value) {
    var el = $("#" + id);
    if (el) el.textContent = value;
  }

  function isoOfDate(dateObject) {
    return dateObject.getFullYear() + "-" + String(dateObject.getMonth() + 1).padStart(2, "0") + "-" + String(dateObject.getDate()).padStart(2, "0");
  }

  function renderList() {
    renderChips();
    renderCounts();
    renderSourceFilter();
    var holder = $("#prb-list");
    if (!holder) return;
    var filtered = DB.prospects.filter(function (p) {
      if (_statusFilter !== "all" && p.status !== _statusFilter) return false;
      if (_sourceFilter !== "all" && (p.source || "-") !== _sourceFilter) return false;
      if (_searchText) {
        var hay = [p.firstName, p.lastName, p.parentName, p.parentPhone, p.parentEmail].join(" ").toLowerCase();
        if (hay.indexOf(_searchText.toLowerCase()) === -1) return false;
      }
      return true;
    });
    filtered.sort(function (a, b) {
      var aDate = a.nextCallDate || "9999";
      var bDate = b.nextCallDate || "9999";
      if (aDate !== bDate) return aDate < bDate ? -1 : 1;
      return String(a.firstName).localeCompare(String(b.firstName));
    });
    if (!filtered.length) {
      holder.innerHTML = '<p class="prb-empty">No prospects match.</p>';
      return;
    }
    holder.innerHTML = filtered.map(function (p) {
      var fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
      var initials = (p.firstName.charAt(0) || "?") + (p.lastName ? p.lastName.charAt(0) : "");
      var commCount = (p.communicationLog || []).length;
      var lastComm = commCount ? p.communicationLog[p.communicationLog.length - 1].at : "";
      return '<div class="prb-row">' +
        '<div class="prb-avatar">' + esc(initials.toUpperCase()) + "</div>" +
        '<div><div class="prb-row-name">' + esc(fullName || "Unnamed") + '</div>' +
        '<div class="prb-row-parent">' + esc(p.parentName) + (p.interestedLessons ? " - " + esc(p.interestedLessons) : "") + "</div></div>" +
        '<div class="prb-row-phone">' + esc(p.parentPhone) + (p.parentEmail ? "<br>" + esc(p.parentEmail) : "") + "</div>" +
        '<div class="prb-row-phone">Source: ' + esc(p.source || "-") + "<br>" + commCount + " communication" + (commCount === 1 ? "" : "s") + (lastComm ? " - last " + esc(fmtDate(lastComm)) : "") + "</div>" +
        '<div><span class="prb-status ' + esc(p.status) + '">' + esc(STATUS_LABELS[p.status]) + "</span></div>" +
        '<div><div class="prb-nextcall">Next call: ' + esc(fmtDate(p.nextCallDate) || "-") + "</div>" +
        '<button class="prb-btn prb-btn-sm prb-btn-primary" data-act="comm" data-id="' + esc(p.id) + '">Log communication</button> ' +
        '<button class="prb-btn prb-btn-sm" data-act="edit" data-id="' + esc(p.id) + '">Edit</button> ' +
        '<button class="prb-btn prb-btn-sm" data-act="convert" data-id="' + esc(p.id) + '">Convert</button>' +
        "</div></div>";
    }).join("");
  }

  function prospectById(id) {
    for (var i = 0; i < DB.prospects.length; i++) if (DB.prospects[i].id === id) return DB.prospects[i];
    return null;
  }

  function renderSourceFilter() {
    var select = $("#prb-source-filter");
    if (!select) return;
    var current = select.value;
    var sources = {};
    DB.prospects.forEach(function (p) { sources[p.source || "-"] = true; });
    select.innerHTML = '<option value="all">All sources</option>' + Object.keys(sources).sort().map(function (source) {
      return '<option value="' + esc(source) + '"' + (source === current ? " selected" : "") + ">" + esc(source) + "</option>";
    }).join("");
  }

  /* Prospect modal */
  function openProspectModal(prospectId) {
    var p = prospectId ? prospectById(prospectId) : null;
    var v = function (key, def) { return p && p[key] != null ? p[key] : def; };
    var statusOptions = STATUSES.map(function (s) {
      return '<option value="' + s + '"' + (String(v("status", "new")) === s ? " selected" : "") + ">" + STATUS_LABELS[s] + "</option>";
    }).join("");
    openModal(p ? "Edit Prospect" : "New Prospect",
      '<div class="prb-grid-2">' +
      '<div class="prb-field"><label class="prb-label">First name</label><input class="prb-input" id="prbf-first" value="' + esc(v("firstName", "")) + '"></div>' +
      '<div class="prb-field"><label class="prb-label">Last name</label><input class="prb-input" id="prbf-last" value="' + esc(v("lastName", "")) + '"></div>' +
      '<div class="prb-field"><label class="prb-label">Parent name</label><input class="prb-input" id="prbf-parent" value="' + esc(v("parentName", "")) + '"></div>' +
      '<div class="prb-field"><label class="prb-label">Parent phone</label><input class="prb-input" id="prbf-phone" value="' + esc(v("parentPhone", "")) + '"></div>' +
      '<div class="prb-field"><label class="prb-label">Parent email</label><input class="prb-input" id="prbf-email" value="' + esc(v("parentEmail", "")) + '"></div>' +
      '<div class="prb-field"><label class="prb-label">Source</label><input class="prb-input" id="prbf-source" placeholder="friend, flyer, website..." value="' + esc(v("source", "")) + '"></div>' +
      '<div class="prb-field"><label class="prb-label">Interested lessons</label><input class="prb-input" id="prbf-lessons" value="' + esc(v("interestedLessons", "")) + '"></div>' +
      '<div class="prb-field"><label class="prb-label">Status</label><select class="prb-select" id="prbf-status">' + statusOptions + "</select></div>" +
      '<div class="prb-field"><label class="prb-label">Next call date</label><input class="prb-input" id="prbf-next-call" type="date" value="' + esc(v("nextCallDate", "")) + '"></div>' +
      "</div>" +
      '<div class="prb-field" style="margin-top:10px"><label class="prb-label">Notes</label><textarea class="prb-textarea" id="prbf-notes" rows="3">' + esc(v("notes", "")) + "</textarea></div>" +
      (p ? '<div class="prb-history"><div class="prb-history-title">Communication log</div>' +
        ((p.communicationLog || []).length ? p.communicationLog.slice().reverse().map(function (entry) {
          var badge = entry.outcome && entry.outcome !== "none"
            ? ' <span class="prb-decision-badge ' + esc(entry.outcome) + '">' + esc(DECISION_LABELS[entry.outcome]) + "</span>" : "";
          return '<div class="prb-call-entry"><span class="prb-call-at">' + esc(fmtDate(entry.at)) + "</span> - " + esc(entry.note) + badge + "</div>";
        }).join("") : '<p class="prb-hint">No communication logged yet.</p>') + "</div>" : ""),
      '<button class="prb-btn" data-act="modal-close">Cancel</button>' +
      '<button class="prb-btn prb-btn-primary" data-act="prospect-save" data-id="' + esc(p ? p.id : "") + '">Save</button>');
  }

  function saveProspectFromModal(prospectId) {
    var read = function (id) { var el = $("#" + id); return el ? String(el.value || "").trim() : ""; };
    var firstName = read("prbf-first");
    if (!firstName) { notify("First name is required.", "warning"); return; }
    var data = {
      firstName: firstName, lastName: read("prbf-last"),
      parentName: read("prbf-parent"), parentPhone: read("prbf-phone"),
      parentEmail: read("prbf-email"), source: read("prbf-source"),
      interestedLessons: read("prbf-lessons"), status: read("prbf-status") || "new",
      nextCallDate: read("prbf-next-call"), notes: read("prbf-notes")
    };
    closeModal();
    var p = prospectId ? prospectById(prospectId) : null;
    if (p) {
      Object.keys(data).forEach(function (k) { p[k] = data[k]; });
    } else {
      data.id = uid();
      data.createdAt = todayIso();
      data.communicationLog = [];
      data.decision = "none";
      DB.prospects.push(data);
    }
    persistSoon();
    renderList();
    notify("Prospect saved.");
  }

  /* Communication log modal - one place for every contact: call, WhatsApp or email.
     Logging here closes the open tasks of this family and sets the decision:
     positive / negative / still waiting (goes to the next round automatically). */
  function openCommunicationModal(prospectId) {
    var p = prospectById(prospectId);
    if (!p) return;
    var logHtml = ((p.communicationLog || []).length ? p.communicationLog.slice().reverse().map(function (c) {
      var badge = c.outcome && c.outcome !== "none"
        ? ' <span class="prb-decision-badge ' + esc(c.outcome) + '">' + esc(DECISION_LABELS[c.outcome]) + "</span>" : "";
      return '<div class="prb-call-entry"><span class="prb-call-at">' + esc(fmtDate(c.at)) + "</span> - " + esc(c.note) + badge + "</div>";
    }).join("") : '<p class="prb-hint">No communication logged yet.</p>');
    var outcomeOptions = [
      ['none', 'Waiting - no decision yet, next round'],
      ['positive', 'Registered - the family enrolled'],
      ['negative', 'Not registering - the family decided no']
    ].map(function (pair) {
      return '<option value="' + pair[0] + '"' + (p.decision === pair[0] ? " selected" : "") + ">" + pair[1] + "</option>";
    }).join("");
    openModal("Log Communication - " + [p.firstName, p.lastName].filter(Boolean).join(" "),
      logHtml +
      '<div class="prb-field" style="margin-top:10px"><label class="prb-label">Result of this communication</label>' +
      '<select class="prb-select" id="prbf-comm-outcome">' + outcomeOptions + "</select></div>" +
      '<div class="prb-field" style="margin-top:10px"><label class="prb-label">What happened</label>' +
      '<textarea class="prb-textarea" id="prbf-comm-note" rows="3" placeholder="What did you talk about or write?"></textarea></div>' +
      '<div class="prb-field" style="margin-top:10px"><label class="prb-label">Next call date</label>' +
      '<input class="prb-input" id="prbf-comm-next" type="date" value="' + esc(p.nextCallDate || "") + '"></div>' +
      '<p class="prb-hint">Saving closes this family\'s open tasks and updates the decision. "Waiting" puts the family into the next round automatically. Only 3 results exist: Registered, Not registering, Waiting - interest level can be noted in the text.</p>',
      '<button class="prb-btn" data-act="modal-close">Cancel</button>' +
      '<button class="prb-btn prb-btn-primary" data-act="comm-save" data-id="' + esc(p.id) + '">Save communication</button>');
  }

  function saveCommunicationFromModal(prospectId) {
    var p = prospectById(prospectId);
    if (!p) return;
    var note = $("#prbf-comm-note").value.trim();
    var nextDate = $("#prbf-comm-next").value.trim();
    var outcome = $("#prbf-comm-outcome").value;
    if (DECISIONS.indexOf(outcome) === -1) outcome = "none";
    if (note || outcome !== "none") {
      p.communicationLog.push({ at: todayIso(), note: note || "(no note)", outcome: outcome });
    }
    p.decision = outcome;
    if (outcome === "positive") p.status = "enrolled";
    else if (outcome === "negative") p.status = "inactive";
    else if (p.status === "new") p.status = "contacted";
    p.nextCallDate = nextDate || p.nextCallDate;
    var completedTasks = 0;
    DB.tasks.forEach(function (task) {
      if (task.prospectId === p.id && task.status === "open") {
        task.status = "done";
        task.note = note || DECISION_LABELS[outcome];
        completedTasks++;
      }
    });
    closeModal();
    persistSoon();
    renderActivePane();
    notify("Communication logged: " + DECISION_LABELS[outcome] + "." + (completedTasks ? " " + completedTasks + " open task(s) closed for this family." : ""));
  }

  /* Convert to student */
  function openConvertModal(prospectId) {
    var p = prospectById(prospectId);
    if (!p) return;
    var missing = ["students", "payments", "contacts", "communication"].filter(function (k) { return !folderIdOf(k); });
    if (missing.length) {
      openModal("Convert - " + p.firstName,
        '<p class="prb-hint">Folder ids are missing for: <strong>' + esc(missing.join(", ")) + "</strong>.</p>" +
        "<p class='prb-hint'>The folder map is read from the School Setup tool of this year. Paste it below if it is not loaded:</p>" +
        '<textarea class="prb-textarea" id="prbf-folder-json" rows="6" spellcheck="false">' + esc(tool.param("folderMapJson", "")) + "</textarea>",
        '<button class="prb-btn" data-act="modal-close">Cancel</button>' +
        '<button class="prb-btn prb-btn-primary" data-act="convert-retry" data-id="' + esc(p.id) + '">Retry</button>');
      return;
    }
    var fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
    openModal("Convert to Student",
      "<p>Create a student record for <strong>" + esc(fullName) + "</strong> together with a payment ledger, parent contact and communication log?</p>" +
      '<div class="prb-grid-2">' +
      '<div class="prb-field"><label class="prb-label">Class group</label><input class="prb-input" id="prbf-class-group" value="' + esc(p.interestedLessons || "") + '"></div>' +
      '<div class="prb-field"><label class="prb-label">Monthly fee</label><input class="prb-input" id="prbf-monthly-fee" type="number" min="0" step="0.01" value="0"></div>' +
      "</div>",
      '<button class="prb-btn" data-act="modal-close">Cancel</button>' +
      '<button class="prb-btn prb-btn-primary" data-act="convert-run" data-id="' + esc(p.id) + '">Create student objects</button>');
  }

  function runConvert(prospectId) {
    var p = prospectById(prospectId);
    if (!p) return;
    var classGroup = $("#prbf-class-group").value.trim();
    var monthlyFee = Number($("#prbf-monthly-fee").value) || 0;
    var studentId = "new-" + uid();
    var fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
    var ops = [];
    function objectOperation(folderKey, name, fieldId, json) {
      var op = { action: "create", mainObjectType: appType(), typeId: folderIdOf(folderKey), name: name, productData: { data_categoriesBased: {} } };
      op.productData.data_categoriesBased[fieldId] = json;
      ops.push(op);
    }
    objectOperation("students", fullName, STUDENT_FIELD_ID, {
      recordKind: "studentRecord", studentId: studentId,
      firstName: p.firstName, lastName: p.lastName, gender: "",
      dateOfBirth: "", classGroup: classGroup, status: "active",
      startDate: todayIso(), photoConsent: "notAsked",
      emergencyContactName: p.parentName, emergencyContactPhone: p.parentPhone,
      emergencyContactRelation: "parent", allergies: "", healthNotes: "",
      pickupAuthorizedNames: p.parentName, pickupNotes: "",
      documents: [], registeredYear: ""
    });
    objectOperation("payments", fullName + " - Ledger", LEDGER_FIELD_ID, {
      recordKind: "paymentLedger", studentId: studentId, studentName: fullName,
      schoolYear: "", entries: monthlyFee > 0
        ? [{ id: uid(), month: todayIso().slice(0, 7), amount: monthlyFee, dueDate: "", status: "unpaid", paidDate: "", note: "Created from prospect board" }]
        : []
    });
    objectOperation("contacts", fullName + " - Parents", CONTACT_FIELD_ID, {
      recordKind: "parentContact", studentId: studentId,
      parentName: p.parentName, parentRelation: "parent",
      parentPhone: p.parentPhone, parentEmail: p.parentEmail,
      secondParentName: "", secondParentPhone: "", address: ""
    });
    objectOperation("communication", fullName + " - Communication", COMMLOG_FIELD_ID, {
      recordKind: "communicationLog", studentId: studentId, oneOnOne: [], absenceCalls: []
    });
    closeModal();
    callObjects("batch", { operations: ops }, function (error) {
      if (error) { notify("Conversion failed: " + error, "error"); return; }
      p.status = "enrolled";
      p.decision = "positive";
      persistSoon();
      renderList();
      notify("Prospect converted. Student, ledger, contact and communication objects created.");
    });
  }

  /* Import and export */
  var IMPORT_TARGETS = [
    { key: "firstName", label: "First name", required: true },
    { key: "lastName", label: "Last name", required: false },
    { key: "parentName", label: "Parent name", required: true },
    { key: "parentPhone", label: "Parent phone", required: false },
    { key: "parentEmail", label: "Parent email", required: false },
    { key: "source", label: "Source", required: false },
    { key: "interestedLessons", label: "Interested lessons", required: false },
    { key: "status", label: "Status", required: false },
    { key: "nextCallDate", label: "Next call date", required: false },
    { key: "notes", label: "Notes", required: false }
  ];

  function csvCell(value) {
    if (value.indexOf(",") > -1 || value.indexOf('"') > -1 || value.indexOf("\n") > -1) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  function parseCsvText(text) {
    var rows = [];
    var row = [];
    var cell = "";
    var inQuotes = false;
    var index = 0;
    while (index < text.length) {
      var character = text[index];
      if (inQuotes) {
        if (character === '"') {
          if (text[index + 1] === '"') { cell += '"'; index++; }
          else inQuotes = false;
        } else cell += character;
      } else {
        if (character === '"') inQuotes = true;
        else if (character === ",") { row.push(cell); cell = ""; }
        else if (character === "\n" || character === "\r") {
          if (character === "\r" && text[index + 1] === "\n") index++;
          row.push(cell);
          cell = "";
          if (row.length > 1 || String(row[0]) !== "") rows.push(row);
          row = [];
        } else cell += character;
      }
      index++;
    }
    row.push(cell);
    if (row.length > 1 || String(row[0]) !== "") rows.push(row);
    return rows;
  }

  function parseImportSource(text) {
    var trimmed = String(text || "").trim();
    if (!trimmed) { notify("Nothing to import - paste CSV or JSON first.", "warning"); return null; }
    if (trimmed.charAt(0) === "[" || trimmed.charAt(0) === "{") {
      try {
        var json = JSON.parse(trimmed);
        var objects = Array.isArray(json) ? json : (Array.isArray(json.prospects) ? json.prospects : null);
        if (!objects) { notify("JSON must be an array of prospects or { prospects: [...] }.", "warning"); return null; }
        var jsonColumns = [];
        objects.forEach(function (object) {
          Object.keys(object).forEach(function (key) { if (jsonColumns.indexOf(key) === -1) jsonColumns.push(key); });
        });
        return { rows: objects, columns: jsonColumns };
      } catch (e) { notify("That is not valid JSON.", "warning"); return null; }
    }
    var csvRows = parseCsvText(trimmed);
    if (csvRows.length < 2) { notify("The CSV needs a header row and at least one data row.", "warning"); return null; }
    var headers = csvRows[0].map(function (header) { return String(header).trim(); });
    var dataRows = csvRows.slice(1).map(function (rawRow) {
      var object = {};
      headers.forEach(function (header, headerIndex) {
        if (header) object[header] = rawRow[headerIndex] != null ? String(rawRow[headerIndex]) : "";
      });
      return object;
    }).filter(function (object) { return Object.keys(object).length > 0; });
    return { rows: dataRows, columns: headers };
  }

  function guessColumn(fieldKey) {
    var keyLower = fieldKey.toLowerCase();
    var best = "";
    _importColumns.forEach(function (column) {
      if (!best && column.toLowerCase() === keyLower) best = column;
    });
    if (best) return best;
    var hintWords = {
      firstName: ["first"], lastName: ["last"], parentName: ["parent", "name"],
      parentPhone: ["phone"], parentEmail: ["email"], source: ["source"],
      interestedLessons: ["lesson"], status: ["status"], nextCallDate: ["next", "call", "date"], notes: ["note"]
    };
    var hints = hintWords[fieldKey] || [];
    _importColumns.forEach(function (column) {
      if (best) return;
      var columnLower = column.toLowerCase();
      if (hints.some(function (hint) { return columnLower.indexOf(hint) > -1; })) best = column;
    });
    return best;
  }

  function openImportModal() {
    openModal("Import prospects",
      '<div class="prb-field"><label class="prb-label">CSV or JSON file</label>' +
      '<input type="file" class="prb-input" id="prbf-import-file" accept=".csv,.json,.txt">' +
      '<span class="prb-hint">Excel files: in Excel use Save As &gt; CSV, then import the CSV file here.</span></div>' +
      '<div class="prb-field" style="margin-top:10px"><label class="prb-label">Or paste CSV / JSON here</label>' +
      '<textarea class="prb-textarea" id="prbf-import-paste" rows="6" placeholder="firstName,lastName,parentName,parentPhone,..."></textarea></div>',
      '<button class="prb-btn" data-act="modal-close">Cancel</button>' +
      '<button class="prb-btn prb-btn-primary" data-act="import-parse">Next: match columns</button>');
  }

  function handleImportParse() {
    var fileInput = $("#prbf-import-file");
    if (fileInput && fileInput.files && fileInput.files.length) {
      var fileName = fileInput.files[0].name.toLowerCase();
      if (fileName.indexOf(".xlsx") > -1 || fileName.indexOf(".xls") > -1) {
        notify("Excel files are not read directly - in Excel use Save As > CSV, then import the CSV file.", "warning");
        return;
      }
      var reader = new FileReader();
      reader.onload = function () { finishImportParse(String(reader.result || "")); };
      reader.onerror = function () { notify("Could not read the file.", "warning"); };
      reader.readAsText(fileInput.files[0]);
      return;
    }
    finishImportParse($("#prbf-import-paste").value);
  }

  function finishImportParse(text) {
    var parsed = parseImportSource(text);
    if (!parsed) return;
    _importRows = parsed.rows;
    _importColumns = parsed.columns;
    openColumnMatchingModal();
  }

  function openColumnMatchingModal() {
    var fieldsHtml = IMPORT_TARGETS.map(function (target) {
      var guessed = guessColumn(target.key);
      var options = '<option value="">- ignore -</option>' + _importColumns.map(function (column) {
        return '<option value="' + esc(column) + '"' + (column === guessed ? " selected" : "") + ">" + esc(column) + "</option>";
      }).join("");
      return '<div class="prb-field"><label class="prb-label">' + esc(target.label) + (target.required ? " (required)" : "") + "</label>" +
        '<select class="prb-select" id="prbf-col-' + target.key + '">' + options + "</select></div>";
    }).join("");
    openModal("Match columns - " + _importRows.length + " row(s) found",
      '<p class="prb-hint">Match each file column to a prospect field. Rows without a first name and without a parent name are skipped.</p>' +
      '<div class="prb-grid-2">' + fieldsHtml + "</div>",
      '<button class="prb-btn" data-act="modal-close">Cancel</button>' +
      '<button class="prb-btn prb-btn-primary" data-act="import-run">Import</button>');
  }

  function runImport() {
    var mapping = {};
    IMPORT_TARGETS.forEach(function (target) {
      var select = $("#prbf-col-" + target.key);
      mapping[target.key] = select ? select.value : "";
    });
    var importedCount = 0;
    var skippedCount = 0;
    _importRows.forEach(function (row) {
      var firstName = String(row[mapping.firstName] || "").trim();
      var parentName = String(row[mapping.parentName] || "").trim();
      if (!firstName && !parentName) { skippedCount++; return; }
      var status = String(row[mapping.status] || "new").trim().toLowerCase();
      if (STATUSES.indexOf(status) === -1) status = "new";
      DB.prospects.push({
        id: uid(),
        firstName: firstName,
        lastName: String(row[mapping.lastName] || "").trim(),
        parentName: parentName,
        parentPhone: String(row[mapping.parentPhone] || "").trim(),
        parentEmail: String(row[mapping.parentEmail] || "").trim(),
        source: String(row[mapping.source] || "").trim(),
        interestedLessons: String(row[mapping.interestedLessons] || "").trim(),
        status: status,
        nextCallDate: String(row[mapping.nextCallDate] || "").trim(),
        notes: String(row[mapping.notes] || "").trim(),
        createdAt: todayIso(),
        communicationLog: [],
        decision: "none"
      });
      importedCount++;
    });
    closeModal();
    persistSoon();
    renderList();
    notify("Imported " + importedCount + " prospect(s)" + (skippedCount ? ", skipped " + skippedCount + " empty row(s)." : "."));
  }

  function downloadText(text, fileName, mimeType) {
    var blob = new Blob([text], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function exportCsv() {
    var headers = ["firstName", "lastName", "parentName", "parentPhone", "parentEmail", "source", "interestedLessons", "status", "nextCallDate", "notes", "createdAt"];
    var lines = [headers.join(",")];
    DB.prospects.forEach(function (prospect) {
      lines.push(headers.map(function (header) { return csvCell(String(prospect[header] == null ? "" : prospect[header])); }).join(","));
    });
    downloadText(lines.join("\r\n"), "prospects-" + todayIso() + ".csv", "text/csv");
  }

  function exportJson() {
    downloadText(JSON.stringify({ recordKind: DB.recordKind, prospects: DB.prospects }, null, 2), "prospects-" + todayIso() + ".json", "application/json");
  }

  /* Reach management: team (from the CMS) + follow-up tasks */
  function refreshPermittedUsers() {
    try {
      if (typeof tool.getPermittedUsers !== "function") { _permittedUsers = []; return; }
      var list = tool.getPermittedUsers();
      _permittedUsers = Array.isArray(list) ? list : [];
    } catch (e) { _permittedUsers = []; }
  }

  function permittedUserById(userId) {
    for (var i = 0; i < _permittedUsers.length; i++) if (_permittedUsers[i].id === userId) return _permittedUsers[i];
    return null;
  }

  function renderTeam() {
    var holder = $("#prb-team-chips");
    if (!holder) return;
    refreshPermittedUsers();
    if (!_permittedUsers.length) {
      holder.innerHTML = '<span class="prb-hint">No users have permission on this object yet. Grant access to the principal, teachers and volunteers in the CMS and they will appear here.</span>';
      return;
    }
    holder.innerHTML = _permittedUsers.map(function (user) {
      var roleLabel = (user.roles && user.roles.length) ? String(user.roles[0]) : "member";
      return '<span class="prb-team-chip">' + esc(user.name || user.email || user.id) +
        '<span class="prb-team-role">' + esc(roleLabel) + "</span></span>";
    }).join("");
    rebuildAssigneeFilter();
  }

  function rebuildAssigneeFilter() {
    var select = $("#prb-task-assignee-filter");
    if (!select) return;
    var current = select.value;
    select.innerHTML = '<option value="">All assignees</option>' + _permittedUsers.map(function (user) {
      return '<option value="' + esc(user.id) + '">' + esc(user.name || user.email || user.id) + "</option>";
    }).join("");
    if (current) select.value = current;
  }

  function taskAssigneeOptions(task) {
    var options = '<option value="">Unassigned</option>';
    _permittedUsers.forEach(function (user) {
      var selected = (task.assigneeId && task.assigneeId === user.id) || (!task.assigneeId && task.assignee && task.assignee === user.name);
      options += '<option value="' + esc(user.id) + '"' + (selected ? " selected" : "") + ">" + esc(user.name || user.email || user.id) + "</option>";
    });
    return options;
  }

  function taskChannelOptions(currentChannel) {
    return ["call", "email", "whatsapp"].map(function (channel) {
      return '<option value="' + channel + '"' + (channel === currentChannel ? " selected" : "") + ">" + channel + "</option>";
    }).join("");
  }

  function currentRoundTasks() {
    var round = Number(DB.currentRound) || 0;
    return DB.tasks.filter(function (task) { return task.round === round; });
  }

  function canStartNextRound() {
    var round = Number(DB.currentRound) || 0;
    var roundTasks = DB.tasks.filter(function (task) { return task.round === round; });
    if (!round || !roundTasks.length) {
      return { can: true, label: "Start call round " + (round + 1), reason: "" };
    }
    var openCount = roundTasks.filter(function (task) { return task.status === "open"; }).length;
    if (openCount === 0) {
      return { can: true, label: "Start call round " + (round + 1), reason: "Round " + round + " is complete." };
    }
    return {
      can: false,
      label: "Finish round " + round + " first (" + openCount + " call" + (openCount === 1 ? "" : "s") + " left)",
      reason: "Complete every call of round " + round + " before starting round " + (round + 1) + "."
    };
  }

  function roundMemberStats(round) {
    var members = {};
    var tasks = DB.tasks.filter(function (task) { return task.round === round; });
    tasks.forEach(function (task) {
      var key = task.assignee || "(unassigned)";
      if (!members[key]) members[key] = { assigned: 0, done: 0, open: 0 };
      members[key].assigned++;
      if (task.status === "done") members[key].done++;
      else if (task.status === "open") members[key].open++;
    });
    var order = [];
    _permittedUsers.forEach(function (user) {
      var name = user.name || user.email || user.id;
      if (members[name]) { order.push([name, members[name]]); delete members[name]; }
    });
    for (var remainingName in members) {
      if (Object.prototype.hasOwnProperty.call(members, remainingName)) order.push([remainingName, members[remainingName]]);
    }
    return order;
  }

  function renderRoundStatus() {
    var box = $("#prb-round-status");
    if (!box) return;
    var round = Number(DB.currentRound) || 0;
    if (!round) {
      box.innerHTML = '<p class="prb-hint">No round has started yet. Press Start call round - it assigns every family without a decision to the team.</p>';
      return;
    }
    var roundTasks = currentRoundTasks();
    var doneCount = roundTasks.filter(function (task) { return task.status === "done"; }).length;
    var openCount = roundTasks.filter(function (task) { return task.status === "open"; }).length;
    var total = roundTasks.length;
    var pct = total ? Math.round((doneCount / total) * 100) : 0;
    var memberHtml = roundMemberStats(round).map(function (pair) {
      var name = pair[0], stats = pair[1];
      return '<span class="prb-round-member" title="' + esc(name) + ': ' + stats.done + ' of ' + stats.assigned + ' done">' +
        esc(name) + ' <b>' + stats.done + "/" + stats.assigned + "</b>" +
        (stats.open ? ' <span class="prb-round-member-open">' + stats.open + " to call</span>" : "") +
        "</span>";
    }).join("");
    box.innerHTML =
      '<div class="prb-round-line"><span class="prb-round-title">Round ' + round + (openCount === 0 && total ? " - complete" : "") + "</span>" +
      '<span class="prb-round-nums">' + doneCount + " of " + total + " calls completed (" + pct + "%)</span></div>" +
      '<div class="prb-round-bar"><div class="prb-round-bar-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="prb-round-members">' + memberHtml + "</div>";
  }

  function renderRoundStartButton() {
    var btn = $("#prb-btn-round-start");
    if (!btn) return;
    var gate = canStartNextRound();
    btn.textContent = gate.label;
    btn.disabled = !gate.can;
    btn.title = gate.reason || (gate.can ? "Starts the next call round with the families that still have no decision." : gate.label);
  }

  function renderTasks() {
    renderRoundStartButton();
    renderRoundStatus();
    var holder = $("#prb-task-list");
    var counts = $("#prb-task-counts");
    var assigneeFilter = $("#prb-task-assignee-filter");
    var statusFilter = $("#prb-task-status-filter");
    var assigneeValue = assigneeFilter ? assigneeFilter.value : "";
    var statusValue = statusFilter ? statusFilter.value : "";
    var tasks = currentRoundTasks().filter(function (task) {
      if (assigneeValue && task.assigneeId !== assigneeValue) return false;
      if (statusValue && task.status !== statusValue) return false;
      return true;
    });
    var openCount = currentRoundTasks().filter(function (t) { return t.status === "open"; }).length;
    if (counts) counts.textContent = "Round " + (DB.currentRound || 0) + " - " + openCount + " open call" + (openCount === 1 ? "" : "s");
    renderStats();
    if (!holder) return;
    if (!currentRoundTasks().length) {
      holder.innerHTML = '<p class="prb-empty">No calls yet. Press Start call round - it assigns every family without a decision to the team. Each next round only contains the families still waiting.</p>';
      return;
    }
    if (!tasks.length) {
      holder.innerHTML = '<p class="prb-empty">No calls match the filters.</p>';
      return;
    }
    tasks.sort(function (a, b) {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      return String(a.dueDate || "9999") < String(b.dueDate || "9999") ? -1 : 1;
    });
    holder.innerHTML = tasks.map(function (task) {
      var prospect = prospectById(task.prospectId);
      var rowClass = task.status === "done" ? " prb-task-done" : "";
      var decision = prospect ? prospect.decision : "none";
      return '<div class="prb-task-row' + rowClass + '">' +
        '<div><div class="prb-task-name">' + esc(task.prospectName || (prospect ? prospect.firstName : "?")) + "</div>" +
        '<div class="prb-task-sub">R' + task.round + " - " + esc(task.prospectId ? "#" + task.prospectId.slice(0, 6) : "") + (prospect && prospect.parentPhone ? " - " + esc(prospect.parentPhone) : "") + "</div>" +
        (task.note ? '<div class="prb-task-note">' + esc(task.note) + "</div>" : "") + "</div>" +
        '<select class="prb-select" data-act="task-channel" data-id="' + esc(task.id) + '">' + taskChannelOptions(task.channel) + "</select>" +
        '<select class="prb-select" data-act="task-assignee" data-id="' + esc(task.id) + '">' + taskAssigneeOptions(task) + "</select>" +
        '<input class="prb-input" type="date" data-act="task-due" data-id="' + esc(task.id) + '" value="' + esc(task.dueDate) + '">' +
        '<span class="prb-task-status-' + esc(task.status) + '">' + esc(task.status) + '</span> <span class="prb-decision-badge ' + esc(decision) + '">' + esc(DECISION_LABELS[decision]) + "</span>" +
        '<span>' +
        (task.status === "open" ? '<button class="prb-btn prb-btn-primary prb-btn-sm" data-act="comm" data-id="' + esc(task.prospectId) + '">Log</button> ' : "") +
        '<button class="prb-btn prb-btn-danger prb-btn-sm" data-act="task-remove" data-id="' + esc(task.id) + '">x</button>' +
        "</span></div>";
    }).join("");
  }

  function startCallRound() {
    var gate = canStartNextRound();
    if (!gate.can) { notify(gate.reason, "warning"); renderRoundStartButton(); return; }
    refreshPermittedUsers();
    var undecided = DB.prospects.filter(function (prospect) {
      return prospect.decision !== "positive" && prospect.decision !== "negative";
    });
    if (!undecided.length) { notify("Every family has a decision - no one left to call.", "warning"); return; }
    DB.currentRound = (Number(DB.currentRound) || 0) + 1;
    var round = DB.currentRound;
    var assigneeIndex = 0;
    undecided.forEach(function (prospect) {
      var fullName = [prospect.firstName, prospect.lastName].filter(Boolean).join(" ");
      var user = _permittedUsers.length ? _permittedUsers[assigneeIndex % _permittedUsers.length] : null;
      if (user) assigneeIndex++;
      DB.tasks.push({
        id: uid(),
        prospectId: prospect.id,
        prospectName: fullName,
        channel: "call",
        assigneeId: user ? user.id : "",
        assignee: user ? (user.name || user.email || user.id) : "",
        dueDate: prospect.nextCallDate || todayIso(),
        status: "open",
        note: "",
        round: round,
        createdAt: todayIso()
      });
    });
    persistSoon();
    renderActivePane();
    var parts = ["Call round " + round + " started - " + undecided.length + " waiting prospect(s) assigned"];
    if (_permittedUsers.length) parts.push("round-robin across " + _permittedUsers.length + " team member(s)");
    notify(parts.join(", ") + ". Round " + round + " must be fully completed before the next round can start.");
  }

  function prospectMaxRound(prospectId) {
    var max = 0;
    DB.tasks.forEach(function (task) {
      if (task.prospectId === prospectId && task.round > max) max = task.round;
    });
    return max;
  }

  function renderRoundHistory() {
    var box = $("#prb-round-history");
    if (!box) return;
    var currentRound = Number(DB.currentRound) || 0;
    if (!currentRound) {
      box.innerHTML = '<p class="prb-hint">No rounds yet - start the first call round from the Round progress view.</p>';
      return;
    }
    var html = "";
    for (var round = currentRound; round >= 1; round--) {
      var roundTasks = DB.tasks.filter(function (task) { return task.round === round; });
      if (!roundTasks.length) continue;
      var doneCount = roundTasks.filter(function (task) { return task.status === "done"; }).length;
      var openCount = roundTasks.filter(function (task) { return task.status === "open"; }).length;
      var total = roundTasks.length;
      var decidedPositive = 0, decidedNegative = 0;
      DB.prospects.forEach(function (prospect) {
        if (prospectMaxRound(prospect.id) !== round) return;
        if (prospect.decision === "positive") decidedPositive++;
        else if (prospect.decision === "negative") decidedNegative++;
      });
      var memberHtml = roundMemberStats(round).map(function (pair) {
        return '<span class="prb-round-member">' + esc(pair[0]) + ' <b>' + pair[1].done + "/" + pair[1].assigned + "</b></span>";
      }).join("");
      var familyRows = roundTasks.slice().sort(function (a, b) {
        return String(a.prospectName).localeCompare(String(b.prospectName));
      }).map(function (task) {
        var prospect = prospectById(task.prospectId);
        var decision = prospect ? prospect.decision : "none";
        return '<div class="prb-round-family"><span class="prb-round-family-name">' + esc(task.prospectName) + "</span>" +
          '<span class="prb-round-family-assignee">' + esc(task.assignee || "Unassigned") + "</span>" +
          '<span class="prb-task-status-' + esc(task.status) + '">' + esc(task.status) + "</span>" +
          '<span class="prb-decision-badge ' + esc(decision) + '">' + esc(DECISION_LABELS[decision]) + "</span></div>";
      }).join("");
      html += '<div class="prb-round-card">' +
        '<details' + (round === currentRound ? " open" : "") + '>' +
        '<summary class="prb-round-card-head">' +
        '<span class="prb-round-card-title">Round ' + round + (openCount === 0 ? " - completed" : " - in progress") + "</span>" +
        '<span class="prb-round-card-nums">' + total + " families - " + doneCount + " calls done" +
        (decidedPositive || decidedNegative ? " - decided here: +" + decidedPositive + " / -" + decidedNegative : "") + "</span></summary>" +
        '<div class="prb-round-card-body">' +
        '<div class="prb-round-members">' + memberHtml + "</div>" +
        '<div class="prb-round-family-head"><span>Family</span><span>Assigned to</span><span>Call</span><span>Decision now</span></div>' +
        familyRows + "</div>" +
        "</details></div>";
    }
    box.innerHTML = html;
  }

  function switchDistView(view) {
    _distView = ["progress", "history", "groups"].indexOf(view) > -1 ? view : "progress";
    var tabs = document.querySelectorAll(".prb-dist-tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle("active", tabs[i].getAttribute("data-id") === _distView);
    }
    var views = {
      progress: $("#prb-view-progress"),
      history: $("#prb-view-history"),
      groups: $("#prb-view-groups")
    };
    Object.keys(views).forEach(function (key) {
      if (views[key]) views[key].hidden = _distView !== key;
    });
  }

  function renderDecisionGroups() {
    var box = $("#prb-decision-groups");
    if (!box) return;
    var undecidedCount = 0, positiveCount = 0, negativeCount = 0;
    DB.prospects.forEach(function (prospect) {
      if (prospect.decision === "positive") positiveCount++;
      else if (prospect.decision === "negative") negativeCount++;
      else undecidedCount++;
    });
    var chips = '<div class="prb-decision-band" style="margin-bottom:10px">' +
      '<span class="prb-decision-chip none">Waiting ' + undecidedCount + "</span>" +
      '<span class="prb-decision-chip positive">Registered ' + positiveCount + "</span>" +
      '<span class="prb-decision-chip negative">Not registering ' + negativeCount + "</span>" +
      '<span class="prb-decision-chip round">Current round ' + (DB.currentRound || 0) + "</span>" +
      "</div>";
    var groups = { positive: [], negative: [], none: [] };
    DB.prospects.forEach(function (prospect) {
      var taskCount = 0, lastRound = 0;
      DB.tasks.forEach(function (task) {
        if (task.prospectId !== prospect.id) return;
        taskCount++;
        if (task.round > lastRound) lastRound = task.round;
      });
      var commCount = (prospect.communicationLog || []).length;
      var fullName = [prospect.firstName, prospect.lastName].filter(Boolean).join(" ");
      var key = prospect.decision === "positive" ? "positive" : prospect.decision === "negative" ? "negative" : "none";
      groups[key].push({
        name: fullName,
        html: '<div class="prb-decision-row">' +
          '<span class="prb-report-name">' + esc(fullName) + "</span>" +
          '<span class="prb-report-cell">' + esc(prospect.parentPhone) + "</span>" +
          '<span class="prb-report-cell">' + taskCount + " assignment" + (taskCount === 1 ? "" : "s") + (lastRound ? " (R" + lastRound + ")" : "") + "</span>" +
          '<span class="prb-report-cell">' + commCount + " communication" + (commCount === 1 ? "" : "s") + "</span>" +
          "</div>"
      });
    });
    var sections = [
      { key: "positive", title: "Registered" },
      { key: "none", title: "Waiting" },
      { key: "negative", title: "Not registering" }
    ];
    var html = "";
    sections.forEach(function (section) {
      var list = groups[section.key];
      list.sort(function (a, b) { return a.name.localeCompare(b.name); });
      html += '<div class="prb-decision-group-head"><span>' + esc(section.title) + '</span><span class="prb-decision-group-count">' + list.length + " famil" + (list.length === 1 ? "y" : "ies") + "</span></div>";
      if (!list.length) html += '<p class="prb-hint" style="padding:2px 2px 8px">None yet.</p>';
      else {
        for (var i = 0; i < list.length; i++) html += list[i].html;
      }
    });
    box.innerHTML = chips + html;
  }

  function renderDistPane() {
    renderTeam();
    renderTasks();
    renderRoundHistory();
    renderDecisionGroups();
  }

  function distributeTasks() {
    refreshPermittedUsers();
    if (!_permittedUsers.length) { notify("No team members available - the CMS did not send any permitted users for this object. Grant users access in the CMS first.", "warning"); return; }
    var openTasks = DB.tasks.filter(function (task) { return task.status === "open" && !task.assigneeId && !task.assignee; });
    var memberIndex = 0;
    openTasks.forEach(function (task) {
      var user = _permittedUsers[memberIndex % _permittedUsers.length];
      task.assigneeId = user.id;
      task.assignee = user.name || user.email || user.id;
      memberIndex++;
    });
    persistSoon();
    renderActivePane();
    notify("Assigned " + openTasks.length + " open task(s) round-robin across " + _permittedUsers.length + " team member(s).");
  }

  function updateTask(taskId, field, value) {
    DB.tasks.forEach(function (task) {
      if (task.id !== taskId) return;
      if (field === "channel") task.channel = value;
      else if (field === "assignee") {
        task.assigneeId = value || "";
        var user = permittedUserById(task.assigneeId);
        task.assignee = user ? (user.name || user.email || user.id) : "";
      }
      else if (field === "due") task.dueDate = value;
    });
    persistSoon();
    renderActivePane();
  }

  function removeTask(taskId) {
    DB.tasks = DB.tasks.filter(function (task) { return task.id !== taskId; });
    persistSoon();
    renderActivePane();
  }

  /* Tabs + panes */
  function isManager() {
    if (_noIdentity) return true;
    var u = _user;
    return !!(u && u.effectiveAccess && u.effectiveAccess.isManager);
  }

  function updateDistributionVisibility() {
    var tab = $("#prb-tab-distribution");
    if (!tab) return;
    var manager = isManager();
    tab.style.display = manager ? "" : "none";
    if (!manager && _activeTab === "distribution") switchTab("dashboard");
  }

  function switchTab(tabName) {
    _activeTab = tabName;
    var tabs = document.querySelectorAll(".prb-tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle("active", tabs[i].getAttribute("data-tab") === tabName);
    }
    ["dashboard", "prospects", "mytasks", "distribution"].forEach(function (paneName) {
      var pane = $("#pane-" + paneName);
      if (pane) pane.hidden = paneName !== tabName;
    });
    renderActivePane();
  }

  function renderActivePane() {
    if (_activeTab === "dashboard") renderDashboard();
    else if (_activeTab === "prospects") renderList();
    else if (_activeTab === "mytasks") renderMyTasks();
    else if (_activeTab === "distribution") renderDistPane();
  }

  function renderDashboard() {
    renderStats();
    renderDashboardRounds();
    var recent = $("#prb-recent-calls");
    if (recent) {
      var entries = [];
      DB.prospects.forEach(function (p) {
        var fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
        (p.communicationLog || []).forEach(function (entry) {
          entries.push({ at: entry.at, note: entry.note, name: fullName, outcome: entry.outcome });
        });
      });
      entries.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
      recent.innerHTML = entries.length
        ? entries.slice(0, 6).map(function (entry) {
            var badge = entry.outcome && entry.outcome !== "none"
              ? ' <span class="prb-decision-badge ' + esc(entry.outcome) + '">' + esc(DECISION_LABELS[entry.outcome]) + "</span>" : "";
            return '<div class="prb-call-entry"><span class="prb-call-at">' + esc(fmtDate(entry.at)) + '</span> - <strong>' + esc(entry.name) + "</strong> - " + esc(entry.note) + badge + "</div>";
          }).join("")
        : '<p class="prb-hint">No communication logged yet. Use Log communication from the Prospects, My tasks or Distribution view.</p>';
    }
    var workload = $("#prb-workload");
    if (workload) {
      refreshPermittedUsers();
      var openByMember = {};
      var unassignedOpen = 0;
      DB.tasks.forEach(function (task) {
        if (task.status !== "open") return;
        if (!task.assigneeId && !task.assignee) unassignedOpen++;
        else openByMember[task.assignee || task.assigneeId] = (openByMember[task.assignee || task.assigneeId] || 0) + 1;
      });
      var rows = _permittedUsers.map(function (user) {
        var name = user.name || user.email || user.id;
        return '<div class="prb-workload-row"><span class="prb-workload-name">' + esc(name) + '</span><span class="prb-workload-count">' + (openByMember[name] || 0) + " open</span></div>";
      });
      rows.push('<div class="prb-workload-row"><span class="prb-workload-name">Unassigned</span><span class="prb-workload-count">' + unassignedOpen + " open</span></div>");
      workload.innerHTML = rows.join("");
    }
    var myOpen = $("#prb-my-open-tasks");
    if (myOpen) {
      var myName = userName();
      var myId = _user ? (_user.id || "") : "";
      var mine = DB.tasks.filter(function (task) {
        if (task.assigneeId && myId) return task.assigneeId === myId;
        return task.assignee === myName;
      }).filter(function (task) { return task.status === "open"; });
      mine.sort(function (a, b) { return String(a.dueDate || "9999") < String(b.dueDate || "9999") ? -1 : 1; });
      myOpen.innerHTML = mine.length
        ? mine.slice(0, 5).map(function (task) {
            return '<div class="prb-workload-row"><span class="prb-workload-name">' + esc(task.prospectName) +
              '<span class="prb-task-sub"> - R' + task.round + " - " + esc(task.channel) + (task.dueDate ? " - due " + esc(fmtDate(task.dueDate)) : "") + "</span></span>" +
              '<span class="prb-workload-count">' + (task.dueDate && task.dueDate <= todayIso() ? "Due" : "Open") + "</span></div>";
          }).join("")
        : '<p class="prb-hint">Nothing assigned to you. The principal can assign tasks from the Distribution tab.</p>';
    }
  }

  function renderDashboardRounds() {
    var box = $("#prb-dashboard-rounds");
    var label = $("#prb-round-label");
    if (!box) return;
    var undecidedCount = 0, positiveCount = 0, negativeCount = 0;
    DB.prospects.forEach(function (prospect) {
      if (prospect.decision === "positive") positiveCount++;
      else if (prospect.decision === "negative") negativeCount++;
      else undecidedCount++;
    });
    if (label) label.textContent = "Round " + (DB.currentRound || 0) + " - " + undecidedCount + " still waiting";
    box.innerHTML = '<div class="prb-decision-band">' +
      '<span class="prb-decision-chip none">Waiting ' + undecidedCount + "</span>" +
      '<span class="prb-decision-chip positive">Registered ' + positiveCount + "</span>" +
      '<span class="prb-decision-chip negative">Not registering ' + negativeCount + "</span>" +
      "</div>" +
      '<p class="prb-hint" style="margin-top:8px">Each round contacts only the families still waiting. Log the result of every communication: Registered and Not registering leave the loop, the rest continue to the next round automatically.</p>';
  }

  function renderMyTasks() {
    var holder = $("#prb-my-task-list");
    var counts = $("#prb-my-task-counts");
    var chips = $("#prb-mytask-chips");
    var myName = userName();
    var myId = _user ? (_user.id || "") : "";
    var mine = DB.tasks.filter(function (task) {
      if (task.assigneeId && myId) return task.assigneeId === myId;
      return task.assignee === myName;
    });
    var openCount = mine.filter(function (t) { return t.status === "open"; }).length;
    if (counts) counts.textContent = openCount + " open of " + mine.length + " assigned to you";
    if (chips) {
      chips.innerHTML = [["open", "Open"], ["done", "Done"], ["all", "All"]].map(function (pair) {
        return '<button class="prb-chip' + (_myTaskFilter === pair[0] ? " active" : "") + '" data-act="mytask-filter" data-id="' + pair[0] + '">' + pair[1] + "</button>";
      }).join("");
    }
    if (!holder) return;
    if (!mine.length) {
      holder.innerHTML = '<p class="prb-empty">No tasks are assigned to you. The principal distributes follow-ups from the Distribution tab.</p>';
      return;
    }
    var tasks = mine.filter(function (task) {
      if (_myTaskFilter === "open") return task.status === "open";
      if (_myTaskFilter === "done") return task.status === "done";
      return true;
    });
    if (!tasks.length) {
      holder.innerHTML = '<p class="prb-empty">Nothing here for the selected filter.</p>';
      return;
    }
    tasks.sort(function (a, b) { return String(a.dueDate || "9999") < String(b.dueDate || "9999") ? -1 : 1; });
    holder.innerHTML = tasks.map(function (task) {
      var prospect = prospectById(task.prospectId);
      var rowClass = task.status === "done" ? " prb-task-done" : "";
      var decision = prospect ? prospect.decision : "none";
      return '<div class="prb-task-row prb-task-row-mine' + rowClass + '">' +
        '<div><div class="prb-task-name">' + esc(task.prospectName || (prospect ? prospect.firstName : "?")) + "</div>" +
        '<div class="prb-task-sub">R' + task.round + " - " + (prospect && prospect.parentPhone ? esc(prospect.parentPhone) : "") + "</div>" +
        (task.note ? '<div class="prb-task-note">' + esc(task.note) + "</div>" : "") + "</div>" +
        '<select class="prb-select" data-act="task-channel" data-id="' + esc(task.id) + '">' + taskChannelOptions(task.channel) + "</select>" +
        '<input class="prb-input" type="date" data-act="task-due" data-id="' + esc(task.id) + '" value="' + esc(task.dueDate) + '">' +
        '<span class="prb-task-status-' + esc(task.status) + '">' + esc(task.status) + '</span> <span class="prb-decision-badge ' + esc(decision) + '">' + esc(DECISION_LABELS[decision]) + "</span>" +
        (task.status === "open" ? '<button class="prb-btn prb-btn-primary prb-btn-sm" data-act="comm" data-id="' + esc(task.prospectId) + '">Log</button>' : "") +
        "</div>";
    }).join("");
  }

  function openModal(title, bodyHtml, footHtml) {
    $("#prb-modal-title").textContent = title;
    $("#prb-modal-body").innerHTML = bodyHtml;
    $("#prb-modal-foot").innerHTML = footHtml || "";
    $("#prb-modal-overlay").classList.add("open");
    resize();
  }
  function closeModal() {
    $("#prb-modal-overlay").classList.remove("open");
    resize();
  }

  document.addEventListener("click", function (e) {
    if (e.target === $("#prb-modal-overlay")) { closeModal(); return; }
    var el = e.target.closest("[data-act]");
    if (!el) return;
    var act = el.getAttribute("data-act");
    var id = el.getAttribute("data-id");
    switch (act) {
      case "tab": switchTab(el.getAttribute("data-tab")); break;
      case "mytask-filter": _myTaskFilter = id; renderMyTasks(); break;
      case "modal-close": closeModal(); break;
      case "prospect-add": openProspectModal(null); break;
      case "import-open": openImportModal(); break;
      case "import-parse": handleImportParse(); break;
      case "import-run": runImport(); break;
      case "export-csv": exportCsv(); break;
      case "export-json": exportJson(); break;
      case "round-start": startCallRound(); break;
      case "dist-view": switchDistView(el.getAttribute("data-id")); break;
      case "task-distribute": distributeTasks(); break;
      case "task-remove": removeTask(id); break;
      case "filter": _statusFilter = id; renderList(); break;
      case "edit": openProspectModal(id); break;
      case "call": openCommunicationModal(id); break;
      case "call-save": saveCommunicationFromModal(id); break;
      case "comm": openCommunicationModal(id); break;
      case "comm-save": saveCommunicationFromModal(id); break;
      case "prospect-save": saveProspectFromModal(id); break;
      case "convert": openConvertModal(id); break;
      case "convert-retry":
        try { _folderMap = JSON.parse($("#prbf-folder-json").value); } catch (err) { }
        openConvertModal(id);
        break;
      case "convert-run": runConvert(id); break;
    }
  });

  document.addEventListener("input", function (e) {
    if (e.target && e.target.id === "prb-search") {
      _searchText = e.target.value.trim();
      renderList();
    }
  });

  document.addEventListener("change", function (e) {
    var target = e.target;
    if (target && target.id === "prb-source-filter") { _sourceFilter = target.value; renderList(); return; }
    var el = target.closest ? target.closest("[data-act]") : null;
    if (!el) return;
    var act = el.getAttribute("data-act");
    var id = el.getAttribute("data-id");
    if (act === "task-channel") updateTask(id, "channel", el.value);
    else if (act === "task-assignee") updateTask(id, "assignee", el.value);
    else if (act === "task-due") updateTask(id, "due", el.value);
    else if (act === "task-assignee-filter" || act === "task-status-filter") renderTasks();
  });

  tool.onReady(function (value) {
    DB = normalizeDatabase(value);
    if (!DB.seeded) { DB.seeded = true; persistSoon(); }
    _user = getUserSafe();
    refreshUser();
    refreshPermittedUsers();
    renderTeam();
    switchTab("dashboard");
    resolveFolderMap();

    if (typeof tool.onPermittedUsersChange === "function") {
      tool.onPermittedUsersChange(function (users) {
        _permittedUsers = Array.isArray(users) ? users : [];
        renderTeam();
        renderActivePane();
      });
    }

    tool.onValueChange(function (newValue) {
      DB = normalizeDatabase(newValue);
      renderTeam();
      renderActivePane();
    });
    tool.onReadonlyChange(function (ro) { _readOnly = !!ro; applyReadonlyState(); });
    tool.onUserChange(function (u) { _user = u || getUserSafe(); applyReadonlyState(); renderActivePane(); });

    tool.declareOutput({ type: "object", properties: { version: { type: "number" }, recordKind: { type: "string" }, prospects: { type: "array" } } });
    tool.declareParams([
      { name: "appObjectType", label: "Application Object Type", type: "text", default: "weekendSchool", severity: "optional", hint: "The application id (cmsObjectType) this school lives in." },
      { name: "folderMapJson", label: "Folder Map JSON", type: "text", default: "", severity: "optional", hint: "Fallback folder map if the settings object cannot be read." },
      { name: "allowObjectCRUD", label: "Allow Object CRUD", type: "toggle", default: "yes", severity: "goodToHave", hint: "Must be 'yes' so conversions can create student objects." },
      { name: "allowRequestSave", label: "Allow Request Save", type: "toggle", default: "yes", severity: "goodToHave", hint: "Must be 'yes' so changes save automatically." }
    ]);
  });
})();
