/* ============================================================
   Personal Task Manager - JS
   Uniconhub CMS html-tool. Kanban task board with sprint management.
   Uses CMS objects for sprint & task persistence via tool.requestObjects.
   Entry point: tool.onReady
   ============================================================ */
(function () {
  "use strict";

  /* ---- SDK handle + fallback shim ---- */
  var tool = (typeof window !== "undefined" && window.tool) ? window.tool : null;
  if (!tool) {
    var _v = null;
    tool = {
      onReady: function (cb) { cb(_v, {}); }, getValue: function () { return _v; }, setValue: function (v) { _v = v; },
      onValueChange: function () {}, getFields: function () { return {}; }, watchField: function () {},
      setField: function () {}, setFields: function () {}, onFieldsChange: function () {},
      param: function (n, d) { return d; }, isReadOnly: function () { return false; },
      onReadonlyChange: function () {}, getUser: function () { return null; }, onUserChange: function () {},
      reportValid: function () {}, notify: function (m, s) { try { console.log("notify:", m); } catch (e) {} },
      resize: function () {}, declareOutput: function () {}, declareParams: function () {},
      getPermittedUsers: function () { return []; },
      onPermittedUsersChange: function () {},
      requestObjects: function (action, params, cb) { cb("requestObjects not available in test harness", null); }
    };
  }

  /* ---- Constants ---- */
  var ROOT = null;
  var readOnly = false;
  var currentUser = null;
  var isManager = false;

  /* ---- State ---- */
  var sprints = [];           // loaded CMS objects (taskSprints-uniconbaseapps)
  var tasks = [];             // loaded CMS objects (taskItems-uniconbaseapps)
  var selectedSprintId = null;
  var editingSprintId = null;
  var editingTaskId = null;
  var pendingConfirmAction = null;
  var permittedUsers = [];    // [{ id, name, email, roles }] from tool.getPermittedUsers()
  var saveTimer = null;
  var SAVE_DEBOUNCE = 600;
  var UI = {};                // UI state persisted via tool.getValue
  var currentView = "board";  // board | list | report
  var listSort = { field: "priority", asc: false };  // list view sorting

  /* ---- Default UI state ---- */
  function defaultUI() {
    return { selectedSprintId: null, _theme: "light" };
  }

  /* ---- Helpers ---- */
  function $(s, r) { return (r || ROOT).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || ROOT).querySelectorAll(s)); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function addDays(iso, n) { var d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function fmtDate(iso) { if (!iso) return "—"; var d = new Date(iso + "T00:00:00"); return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  function fmtDateShort(iso) { if (!iso) return "—"; var d = new Date(iso + "T00:00:00"); return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  function isOverdue(iso) { if (!iso) return false; return iso < todayISO(); }
  function notify(msg, sev) { try { tool.notify(msg, sev || "success"); } catch (e) {} }
  function resize() { try { tool.resize(); } catch (e) {} }
  function logErr(msg) { try { console.error("[PTM]", msg); } catch (e) {} }

  /* ---- Smart Sprint Defaults ---- */
  function computeSprintDefaults() {
    // Find the sprint with the latest end date
    var latestEnd = "";
    sprints.forEach(function (s) {
      var d = getSprintData(s);
      if (d.endDate && d.endDate > latestEnd) latestEnd = d.endDate;
    });

    var today = new Date();
    var startDate, endDate;

    if (latestEnd) {
      // Start from the day after the last sprint ended
      var lastEndDate = new Date(latestEnd + "T00:00:00");
      // Find next Monday (if last end was Sat/Sun, go to Monday)
      var dayOfWeek = lastEndDate.getDay(); // 0=Sun, 1=Mon..6=Sat
      if (dayOfWeek === 0) { lastEndDate.setDate(lastEndDate.getDate() + 1); } // Sun -> Mon
      else if (dayOfWeek === 6) { lastEndDate.setDate(lastEndDate.getDate() + 2); } // Sat -> Mon
      else if (dayOfWeek >= 2) { // Tue-Fri: go to next Monday
        lastEndDate.setDate(lastEndDate.getDate() + (8 - dayOfWeek));
      }
      // If it's already Monday and the last sprint ended today or before, start next Monday
      if (lastEndDate <= today) {
        var daysSince = Math.floor((today - lastEndDate) / 86400000);
        if (daysSince >= 0) {
          lastEndDate = new Date(today);
          var td = lastEndDate.getDay();
          if (td === 0) lastEndDate.setDate(lastEndDate.getDate() + 1);
          else if (td === 6) lastEndDate.setDate(lastEndDate.getDate() + 2);
          else if (td >= 2) lastEndDate.setDate(lastEndDate.getDate() + (8 - td));
        }
      }
      startDate = lastEndDate;
    } else {
      // No existing sprint: start next Monday
      startDate = new Date(today);
      var td2 = startDate.getDay();
      if (td2 === 0) startDate.setDate(startDate.getDate() + 1);
      else if (td2 === 6) startDate.setDate(startDate.getDate() + 2);
      else if (td2 >= 2) startDate.setDate(startDate.getDate() + (8 - td2));
    }

    // End date = start + 13 days (2 weeks, ending on Friday of second week)
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 13);

    var fmt = function (d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
    return { start: fmt(startDate), end: fmt(endDate) };
  }

  function autoSprintName() {
    return "Sprint " + (sprints.length + 1);
  }

  function userKey(u) { return u ? (u.id || u.email || u.name || "").toLowerCase().trim() : ""; }
  function userDisplay(u) { if (!u) return "Unassigned"; return u.name || u.email || u.id || "Unassigned"; }
  function matchUser(a, b) { return userKey(a) === userKey(b); }

  /* ---- Safe requestObjects wrapper (timeout detection) ---- */
  function safeRequest(action, params, cb, timeoutMs) {
    timeoutMs = timeoutMs || 30000;
    var fired = false;
    var label = action + ":" + (params.mainObjectType || "").split("-")[0];
    logErr("safeRequest: " + label + " sending…");

    var tid = setTimeout(function () {
      if (!fired) {
        fired = true;
        logErr("safeRequest: " + label + " TIMED OUT after " + (timeoutMs / 1000) + "s — CMS bridge may not be processing this action");
        notify("Operation timed out — check that allowObjectCRUD is 'yes' and allowedObjectTypes has role 'editor' for " + (params.mainObjectType || "unknown"), "error");
        if (cb) cb("TIMEOUT: CMS did not respond within " + (timeoutMs / 1000) + "s", null);
      }
    }, timeoutMs);

    tool.requestObjects(action, params, function (err, result) {
      if (fired) return;
      fired = true;
      clearTimeout(tid);
      if (err) { logErr("safeRequest: " + label + " ERROR: " + err); }
      else { logErr("safeRequest: " + label + " OK"); }
      if (cb) cb(err, result);
    });
  }

  function getSprintData(s) {
    var d = (s && s.productData && s.productData.data_categoriesBased) ? s.productData.data_categoriesBased : {};
    return {
      id: s.id || s._id || "",
      name: s.name || "",
      startDate: d.startDate || "",
      endDate: d.endDate || "",
      managerId: d.managerId || "",
      goal: d.goal || "",
      status: d.status || "planned"
    };
  }

  function getTaskData(t) {
    var d = (t && t.productData && t.productData.data_categoriesBased) ? t.productData.data_categoriesBased : {};
    return {
      id: t.id || t._id || "",
      name: t.name || "",
      title: d.title || t.name || "",
      description: d.description || "",
      status: d.status || "todo",
      assignedTo: d.assignedTo || "",
      sprintId: d.sprintId || "",
      priority: d.priority || "medium",
      dueDate: d.dueDate || "",
      completedAt: d.completedAt || "",
      notes: d.notes || "",
      labels: d.labels || [],
      attachments: d.attachments || [],
      links: d.links || [],
      assigneeName: d.assigneeName || "",
      assigneeEmail: d.assigneeEmail || ""
    };
  }

  /* ---- Persist UI state ---- */
  function persistUI() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { tool.setValue(UI); } catch (e) {}
      stampSaved();
    }, SAVE_DEBOUNCE);
  }

  function persistUINow() {
    if (saveTimer) clearTimeout(saveTimer);
    try { tool.setValue(UI); } catch (e) {}
    stampSaved();
  }

  function stampSaved() {
    var el = $("#ptmSavedAt");
    if (el) el.textContent = "Saved " + new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  /* ---- Data Loading ---- */
  function loadAll(cb) {
    var pending = 2;
    var errs = [];

    tool.requestObjects("query", { mainObjectType: "taskSprints-uniconbaseapps" }, function (err, result) {
      if (err) { errs.push("Sprints: " + err); sprints = []; }
      else { sprints = (result && result.objects) ? result.objects : []; }
      if (--pending === 0) finish();
    });

    tool.requestObjects("query", { mainObjectType: "taskItems-uniconbaseapps" }, function (err, result) {
      if (err) { errs.push("Tasks: " + err); tasks = []; }
      else { tasks = (result && result.objects) ? result.objects : []; }
      if (--pending === 0) finish();
    });

    function finish() {
      if (errs.length) notify("Some data could not be loaded: " + errs.join("; "), "warning");
      cb();
    }
  }

  function getSprintTasks(sprintId) {
    return tasks.filter(function (t) {
      var d = getTaskData(t);
      return d.sprintId === sprintId;
    });
  }

  function getVisibleTasks() {
    if (!selectedSprintId) return [];
    var all = getSprintTasks(selectedSprintId);
    // Role filtering
    if (!isManager && currentUser) {
      var myKey = userKey(currentUser);
      all = all.filter(function (t) {
        var d = getTaskData(t);
        return !d.assignedTo || userKey({ id: d.assignedTo }) === myKey ||
               (d.assigneeEmail && d.assigneeEmail.toLowerCase() === (currentUser.email || "").toLowerCase());
      });
    }
    // Filter by assignee
    var filterAssignee = $("#ptmFilterAssignee") ? $("#ptmFilterAssignee").value : "";
    if (filterAssignee) {
      all = all.filter(function (t) {
        var d = getTaskData(t);
        return d.assignedTo === filterAssignee;
      });
    }
    // Filter by priority
    var filterPriority = $("#ptmFilterPriority") ? $("#ptmFilterPriority").value : "";
    if (filterPriority) {
      all = all.filter(function (t) {
        var d = getTaskData(t);
        return d.priority === filterPriority;
      });
    }
    // Filter by status
    var filterStatus = $("#ptmFilterStatus") ? $("#ptmFilterStatus").value : "";
    if (filterStatus) {
      all = all.filter(function (t) {
        var d = getTaskData(t);
        return d.status === filterStatus;
      });
    }
    // Full-text search
    var searchQuery = ($("#ptmSearchInput") ? $("#ptmSearchInput").value : "").toLowerCase().trim();
    if (searchQuery) {
      all = all.filter(function (t) {
        var d = getTaskData(t);
        var haystack = [d.title, d.description, d.notes, d.assigneeName, d.assigneeEmail].join(" ").toLowerCase();
        if (d.labels && d.labels.length) haystack += " " + d.labels.join(" ").toLowerCase();
        return haystack.indexOf(searchQuery) > -1;
      });
    }
    return all;
  }

  /* ---- Get My Tasks (for staff reports) ---- */
  function getMyTasks() {
    if (!selectedSprintId) return [];
    var all = getSprintTasks(selectedSprintId);
    if (!currentUser) return all;
    var myKey = userKey(currentUser);
    return all.filter(function (t) {
      var d = getTaskData(t);
      return !d.assignedTo || userKey({ id: d.assignedTo }) === myKey ||
             (d.assigneeEmail && d.assigneeEmail.toLowerCase() === (currentUser.email || "").toLowerCase());
    });
  }

  function getCurrentSprint() {
    if (!selectedSprintId) return null;
    for (var i = 0; i < sprints.length; i++) {
      if ((sprints[i].id || sprints[i]._id) === selectedSprintId) return sprints[i];
    }
    return null;
  }

  function getCurrentSprintData() {
    var s = getCurrentSprint();
    return s ? getSprintData(s) : null;
  }

  /* ---- Role Detection (from permitted users) ---- */
  function detectRole() {
    isManager = false;
    if (!currentUser) return;
    // Check permitted users list for current user's roles
    var myKey = userKey(currentUser);
    for (var i = 0; i < permittedUsers.length; i++) {
      var pu = permittedUsers[i];
      if (userKey(pu) === myKey || (pu.email && pu.email.toLowerCase() === (currentUser.email || "").toLowerCase())) {
        if (pu.roles && (pu.roles.indexOf("admin") > -1 || pu.roles.indexOf("manager") > -1)) {
          isManager = true;
        }
        break;
      }
    }
    // Fallback: check currentUser's own roles
    if (!isManager && currentUser.roles && (currentUser.roles.indexOf("admin") > -1 || currentUser.roles.indexOf("manager") > -1)) {
      isManager = true;
    }
  }

  /* ---- Render: Sprint Selector ---- */
  function renderSprintSelector() {
    var sel = $("#ptmSprintSelect");
    if (!sel) return;
    var currentVal = sel.value;

    // Sort chronologically by start date
    var sorted = sprints.slice().sort(function (a, b) {
      var da = getSprintData(a), db = getSprintData(b);
      return (da.startDate || "").localeCompare(db.startDate || "");
    });

    sel.innerHTML = '<option value="">— No sprint selected —</option>';
    sorted.forEach(function (s) {
      var d = getSprintData(s);
      var opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.name + " (" + fmtDateShort(d.startDate) + " – " + fmtDateShort(d.endDate) + ")";
      sel.appendChild(opt);
    });
    sel.value = selectedSprintId || "";
  }

  function renderSprintInfo() {
    var sd = getCurrentSprintData();
    var datesEl = $("#ptmSprintDates");
    var statusEl = $("#ptmSprintStatus");
    var editBtn = $("#ptmBtnEditSprint");
    var delBtn = $("#ptmBtnDeleteSprintBar");
    var goalBanner = $("#ptmGoalBanner");
    var goalText = $("#ptmGoalText");
    if (sd) {
      if (datesEl) datesEl.textContent = fmtDateShort(sd.startDate) + " – " + fmtDateShort(sd.endDate);
      if (statusEl) {
        statusEl.textContent = sd.status || "planned";
        statusEl.className = "ptm-sprint-status status-" + (sd.status || "planned");
      }
      if (editBtn) editBtn.style.display = (isManager && !readOnly) ? "" : "none";
      if (delBtn) delBtn.style.display = (isManager && !readOnly) ? "" : "none";
      if (goalBanner) {
        if (sd.goal) { goalBanner.style.display = ""; if (goalText) goalText.textContent = sd.goal; }
        else { goalBanner.style.display = "none"; }
      }
    } else {
      if (datesEl) datesEl.textContent = "";
      if (statusEl) { statusEl.textContent = ""; statusEl.className = "ptm-sprint-status"; }
      if (editBtn) editBtn.style.display = "none";
      if (delBtn) delBtn.style.display = "none";
      if (goalBanner) goalBanner.style.display = "none";
    }
  }

  /* ---- Render: Stats ---- */
  function renderStats() {
    var visible = getVisibleTasks();
    var total = visible.length;
    var todo = 0, progress = 0, done = 0, blocked = 0;
    visible.forEach(function (t) {
      var d = getTaskData(t);
      if (d.status === "todo") todo++;
      else if (d.status === "inProgress") progress++;
      else if (d.status === "done") done++;
      else if (d.status === "blocked") blocked++;
    });
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;

    $("#ptmStatTotal").textContent = total;
    $("#ptmStatTodo").textContent = todo;
    $("#ptmStatProgress").textContent = progress;
    $("#ptmStatDone").textContent = done;
    $("#ptmStatBlocked").textContent = blocked;
    $("#ptmProgressBar").style.width = pct + "%";
    $("#ptmProgressPct").textContent = pct + "%";
  }

  /* ---- Render: Board ---- */
  function renderBoard() {
    var visible = getVisibleTasks();
    var cols = { todo: [], inProgress: [], done: [], blocked: [] };
    visible.forEach(function (t) {
      var d = getTaskData(t);
      var s = d.status || "todo";
      if (cols[s]) cols[s].push(t);
      else cols.todo.push(t);
    });

    var colDefs = [
      { status: "todo", elId: "ptmColTodo", countId: "ptmColCountTodo", label: "To Do" },
      { status: "inProgress", elId: "ptmColProgress", countId: "ptmColCountProgress", label: "In Progress" },
      { status: "done", elId: "ptmColDone", countId: "ptmColCountDone", label: "Done" },
      { status: "blocked", elId: "ptmColBlocked", countId: "ptmColCountBlocked", label: "Blocked" }
    ];

    colDefs.forEach(function (col) {
      var list = cols[col.status] || [];
      var countEl = $("#" + col.countId);
      var bodyEl = $("#" + col.elId);
      if (countEl) countEl.textContent = list.length;
      if (!bodyEl) return;
      if (list.length === 0) {
        bodyEl.innerHTML = '<div class="ptm-col-body-empty">No tasks</div>';
      } else {
        bodyEl.innerHTML = list.map(function (t) {
          return renderTaskCard(t);
        }).join("");
      }
    });

    // Wire drag events on all cards
    $$(".ptm-task-card").forEach(function (card) {
      card.setAttribute("draggable", "true");
      card.addEventListener("dragstart", onDragStart);
      card.addEventListener("dragend", onDragEnd);
    });

    // Wire drop events on all columns
    $$(".ptm-col-body").forEach(function (body) {
      body.addEventListener("dragover", onDragOver);
      body.addEventListener("dragleave", onDragLeave);
      body.addEventListener("drop", onDrop);
    });
  }

  function renderTaskCard(t) {
    var d = getTaskData(t);
    var prioCls = "ptm-prio-" + (d.priority || "medium");
    var dueCls = "";
    var dueText = "";
    if (d.dueDate) {
      dueCls = isOverdue(d.dueDate) && d.status !== "done" ? " overdue" : "";
      dueText = fmtDateShort(d.dueDate);
    }
    var assigneeLabel = d.assigneeName || d.assigneeEmail || d.assignedTo || "";
    if (assigneeLabel && assigneeLabel.length > 15) assigneeLabel = assigneeLabel.substring(0, 15) + "\u2026";

    var assigneeHTML = "";
    if (assigneeLabel) {
      assigneeHTML = '<span class="ptm-task-assignee">' + esc(assigneeLabel) + '</span>';
    }

    // Label dots
    var labelsHTML = "";
    if (d.labels && d.labels.length) {
      var labelColors = ["#4f46e5","#0d9488","#d97706","#dc2626","#7c3aed","#2563eb","#059669"];
      labelsHTML = '<div class="ptm-task-labels">' + d.labels.slice(0, 3).map(function (l, i) {
        return '<span class="ptm-task-label-dot" style="background:' + labelColors[i % labelColors.length] + '">' + esc(l) + '</span>';
      }).join("") + (d.labels.length > 3 ? '<span class="ptm-task-label-dot" style="background:#9ca3af">+' + (d.labels.length - 3) + '</span>' : '') + '</div>';
    }

    // Attachment/link icons
    var attachIcons = "";
    if ((d.attachments && d.attachments.length) || (d.links && d.links.length)) {
      var icons = [];
      if (d.attachments && d.attachments.length) icons.push("📎" + d.attachments.length);
      if (d.links && d.links.length) icons.push("🔗" + d.links.length);
      attachIcons = '<div class="ptm-task-attach-icons">' + icons.join(" ") + '</div>';
    }

    return '<div class="ptm-task-card" data-task-id="' + esc(d.id) + '" data-status="' + esc(d.status) + '">' +
      '<div class="ptm-task-title"><span class="ptm-task-priority ' + prioCls + '"></span>' + esc(d.title || "Untitled Task") + '</div>' +
      labelsHTML +
      '<div class="ptm-task-meta">' +
        assigneeHTML +
        (dueText ? '<span class="ptm-task-due' + dueCls + '">' + esc(dueText) + '</span>' : '') +
      '</div>' +
      attachIcons +
    '</div>';
  }

  /* ---- Drag & Drop ---- */
  var dragTaskId = null;

  function onDragStart(e) {
    if (readOnly) { e.preventDefault(); return; }
    dragTaskId = this.getAttribute("data-task-id");
    this.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragTaskId);
  }

  function onDragEnd(e) {
    this.classList.remove("dragging");
    dragTaskId = null;
    $$(".ptm-column").forEach(function (col) { col.classList.remove("drag-over"); });
    $$(".ptm-col-body").forEach(function (b) { b.classList.remove("drag-over"); });
  }

  function onDragOver(e) {
    if (!dragTaskId || readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    var col = this.closest(".ptm-column");
    if (col) col.classList.add("drag-over");
  }

  function onDragLeave(e) {
    var col = this.closest(".ptm-column");
    if (col) col.classList.remove("drag-over");
  }

  function onDrop(e) {
    e.preventDefault();
    var col = this.closest(".ptm-column");
    if (col) col.classList.remove("drag-over");
    if (!dragTaskId || readOnly) return;

    var newStatus = col ? col.getAttribute("data-status") : null;
    if (!newStatus) return;

    // Check permission for staff
    if (!isManager && currentUser) {
      var t = null;
      for (var i = 0; i < tasks.length; i++) {
        if ((tasks[i].id || tasks[i]._id) === dragTaskId) { t = tasks[i]; break; }
      }
      if (t) {
        var d = getTaskData(t);
        if (d.assignedTo && currentUser && !matchUser({ id: d.assignedTo }, currentUser)) {
          notify("You can only move your own tasks.", "warning");
          dragTaskId = null;
          return;
        }
      }
    }

    // Don't update if same status
    var existingTask = null;
    for (var j = 0; j < tasks.length; j++) {
      if ((tasks[j].id || tasks[j]._id) === dragTaskId) { existingTask = tasks[j]; break; }
    }
    if (existingTask) {
      var ed2 = getTaskData(existingTask);
      if (ed2.status === newStatus) { dragTaskId = null; return; }
    }

    var completedAt = "";
    if (newStatus === "done") completedAt = new Date().toISOString();

    safeRequest("update", {
      mainObjectType: "taskItems-uniconbaseapps",
      objectId: dragTaskId,
      productData: {
        data_categoriesBased: {
          status: newStatus,
          completedAt: completedAt
        }
      }
    }, function (err, result) {
      if (err) { notify("Failed to move task: " + err, "error"); return; }
      notify("Task moved to " + statusLabel(newStatus), "success");
      dragTaskId = null;
      reloadAll();
    });
  }

  function statusLabel(s) {
    var map = { todo: "To Do", inProgress: "In Progress", done: "Done", blocked: "Blocked" };
    return map[s] || s;
  }

  function priorityWeight(p) {
    var map = { critical: 4, high: 3, medium: 2, low: 1 };
    return map[p] || 0;
  }

  /* ---- Render: List View ---- */
  function renderListView() {
    var visible = getVisibleTasks();
    var tbody = $("#ptmListBody");
    var countEl = $("#ptmTaskCount");
    if (countEl) countEl.textContent = visible.length + " task" + (visible.length !== 1 ? "s" : "");

    if (!tbody) return;

    // Sorting
    var sorted = visible.slice().sort(function (a, b) {
      var da = getTaskData(a), db = getTaskData(b);
      var va, vb;
      switch (listSort.field) {
        case "priority": va = priorityWeight(da.priority); vb = priorityWeight(db.priority); break;
        case "title": va = (da.title || "").toLowerCase(); vb = (db.title || "").toLowerCase(); break;
        case "status": va = statusOrder(da.status); vb = statusOrder(db.status); break;
        case "assignedTo": va = (da.assigneeName || da.assignedTo || "").toLowerCase(); vb = (db.assigneeName || db.assignedTo || "").toLowerCase(); break;
        case "dueDate": va = da.dueDate || "9999"; vb = db.dueDate || "9999"; break;
        case "sprintId": va = da.sprintId || ""; vb = db.sprintId || ""; break;
        default: va = 0; vb = 0;
      }
      if (va < vb) return listSort.asc ? -1 : 1;
      if (va > vb) return listSort.asc ? 1 : -1;
      return 0;
    });

    if (sorted.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="ptm-list-no-results">No tasks match the current filters</td></tr>';
      return;
    }

    // Get sprint names for cross-referencing
    var sprintNames = {};
    sprints.forEach(function (s) {
      var sd = getSprintData(s);
      sprintNames[sd.id] = sd.name;
    });

    tbody.innerHTML = sorted.map(function (t) {
      var d = getTaskData(t);
      var prioCls = "prio-" + (d.priority || "medium");
      var statusCls = "status-" + (d.status || "todo");
      var statusText = statusLabel(d.status || "todo");
      var dueCls = (d.dueDate && isOverdue(d.dueDate) && d.status !== "done") ? " overdue" : "";
      var assigneeLabel = d.assigneeName || d.assigneeEmail || d.assignedTo || "—";
      var sprintLabel = sprintNames[d.sprintId] || d.sprintId || "—";
      if (sprintLabel.length > 18) sprintLabel = sprintLabel.substring(0, 18) + "\u2026";

      return '<tr data-task-id="' + esc(d.id) + '">' +
        '<td><span class="ptm-list-priority ' + prioCls + '" title="' + esc(d.priority) + '"></span></td>' +
        '<td><span class="ptm-list-title" data-task-id="' + esc(d.id) + '">' + esc(d.title || "Untitled Task") + '</span></td>' +
        '<td><span class="ptm-list-status ' + statusCls + '">' + esc(statusText) + '</span></td>' +
        '<td>' + esc(assigneeLabel) + '</td>' +
        '<td><span class="ptm-list-due' + dueCls + '">' + (d.dueDate ? fmtDateShort(d.dueDate) : "—") + '</span></td>' +
        '<td>' + esc(sprintLabel) + '</td>' +
        '<td><div class="ptm-list-actions">' +
          '<button class="ptm-list-btn ptm-list-btn-cycle" data-cycle="' + esc(d.id) + '" title="Cycle status">↻</button>' +
          '<button class="ptm-list-btn" data-edit="' + esc(d.id) + '" title="Edit">✎</button>' +
          '<button class="ptm-list-btn ptm-list-btn-del" data-del="' + esc(d.id) + '" title="Delete">✕</button>' +
        '</div></td>' +
      '</tr>';
    }).join("");

    // Wire list view events
    $$(".ptm-list-title", tbody).forEach(function (el) {
      el.onclick = function () { openTaskModal(el.getAttribute("data-task-id")); };
    });
    $$(".ptm-list-btn[data-edit]", tbody).forEach(function (el) {
      el.onclick = function (e) { e.stopPropagation(); openTaskModal(el.getAttribute("data-edit")); };
    });
    $$(".ptm-list-btn[data-cycle]", tbody).forEach(function (el) {
      el.onclick = function (e) { e.stopPropagation(); quickCycleStatus(el.getAttribute("data-cycle")); };
    });
    $$(".ptm-list-btn[data-del]", tbody).forEach(function (el) {
      el.onclick = function (e) {
        e.stopPropagation();
        var tid = el.getAttribute("data-del");
        pendingConfirmAction = function () {
          tool.requestObjects("delete", { mainObjectType: "taskItems-uniconbaseapps", objectId: tid }, function (err, result) {
            if (err) { notify("Failed to delete: " + err, "error"); logErr("listDelete error: " + err); return; }
            notify("Task deleted.", "info");
            reloadAll();
          });
        };
        showConfirm("Delete this task? This cannot be undone.");
      };
    });
  }

  function statusOrder(s) {
    var map = { todo: 0, inProgress: 1, done: 2, blocked: 3 };
    return map[s] != null ? map[s] : 0;
  }

  /* ---- Render: Report View ---- */
  function renderReportView() {
    var myTasks = isManager ? getVisibleTasks() : getMyTasks();
    var total = myTasks.length;
    var todo = 0, progress = 0, done = 0, blocked = 0;
    var overdue = [];
    var completed = [];
    var now = new Date();

    myTasks.forEach(function (t) {
      var d = getTaskData(t);
      if (d.status === "todo") todo++;
      else if (d.status === "inProgress") progress++;
      else if (d.status === "done") { done++; completed.push(d); }
      else if (d.status === "blocked") blocked++;
      if (d.dueDate && isOverdue(d.dueDate) && d.status !== "done") overdue.push(d);
    });

    var pct = total > 0 ? Math.round((done / total) * 100) : 0;

    // Donut chart
    var circumference = 314; // 2 * PI * 50
    var doneOffset = circumference - (done / Math.max(total, 1)) * circumference;
    var progressOffset = circumference - ((done + progress) / Math.max(total, 1)) * circumference;
    var donutDone = $("#ptmDonutDone");
    var donutProgress = $("#ptmDonutProgress");
    if (donutDone) donutDone.setAttribute("stroke-dashoffset", doneOffset);
    if (donutProgress) {
      donutProgress.setAttribute("stroke-dashoffset", progressOffset);
      var progressRotate = (done / Math.max(total, 1)) * 360;
      donutProgress.setAttribute("transform", "rotate(" + progressRotate + " 60 60)");
    }
    $("#ptmDonutPct").textContent = pct + "%";
    $("#ptmLegendDone").textContent = done;
    $("#ptmLegendProgress").textContent = progress;
    $("#ptmLegendTodo").textContent = todo;
    $("#ptmLegendBlocked").textContent = blocked;

    // Workload bars
    var priorities = ["critical", "high", "medium", "low"];
    var priorityColors = { critical: "#dc2626", high: "#ea580c", medium: "#d97706", low: "#9ca3af" };
    var priorityCounts = {};
    priorities.forEach(function (p) { priorityCounts[p] = myTasks.filter(function (t) { return getTaskData(t).priority === p && getTaskData(t).status !== "done"; }).length; });
    var maxCount = Math.max.apply(null, Object.values(priorityCounts).concat([1]));
    $("#ptmWorkloadBars").innerHTML = priorities.map(function (p) {
      var count = priorityCounts[p];
      var w = Math.round((count / maxCount) * 100);
      return '<div class="ptm-workload-row">' +
        '<span class="ptm-workload-label">' + p.charAt(0).toUpperCase() + p.slice(1) + '</span>' +
        '<div class="ptm-workload-track"><div class="ptm-workload-fill" style="width:' + w + '%;background:' + priorityColors[p] + '"></div></div>' +
        '<span class="ptm-workload-count">' + count + '</span></div>';
    }).join("");

    // Overdue list
    if (overdue.length === 0) {
      $("#ptmOverdueList").innerHTML = '<div class="ptm-overdue-none">🎉 No overdue tasks — great job!</div>';
    } else {
      $("#ptmOverdueList").innerHTML = overdue.sort(function (a, b) { return (a.dueDate || "").localeCompare(b.dueDate || ""); }).map(function (d) {
        return '<div class="ptm-overdue-item" data-task-id="' + esc(d.id) + '">' +
          '<span class="ptm-overdue-dot"></span>' +
          '<span class="ptm-overdue-title">' + esc(d.title) + '</span>' +
          '<span class="ptm-overdue-date">' + fmtDateShort(d.dueDate) + '</span></div>';
      }).join("");
      $$(".ptm-overdue-item", $("#ptmOverdueList")).forEach(function (el) {
        el.onclick = function () { openTaskModal(el.getAttribute("data-task-id")); };
      });
    }

    // Activity list (recently updated tasks)
    var recent = myTasks.slice().sort(function (a, b) {
      var ua = (a.updated || ""), ub = (b.updated || "");
      return ub.localeCompare(ua);
    }).slice(0, 10);
    if (recent.length === 0) {
      $("#ptmActivityList").innerHTML = '<div class="ptm-activity-none">No recent activity</div>';
    } else {
      $("#ptmActivityList").innerHTML = recent.map(function (t) {
        var d = getTaskData(t);
        var icon = d.status === "done" ? "✅" : d.status === "inProgress" ? "🔄" : d.status === "blocked" ? "🚫" : "📌";
        var timeAgo = d.updated ? timeSince(new Date(d.updated)) : "";
        return '<div class="ptm-activity-item">' +
          '<span class="ptm-activity-icon">' + icon + '</span>' +
          '<span class="ptm-activity-text">' + esc(d.title) + ' <b>·</b> ' + statusLabel(d.status) + '</span>' +
          '<span class="ptm-activity-time">' + esc(timeAgo) + '</span></div>';
      }).join("");
    }

    // Completed list
    if (completed.length === 0) {
      $("#ptmCompletedList").innerHTML = '<div class="ptm-completed-none">No tasks completed yet this sprint</div>';
    } else {
      $("#ptmCompletedList").innerHTML = completed.sort(function (a, b) { return (b.completedAt || "").localeCompare(a.completedAt || ""); }).slice(0, 15).map(function (d) {
        var compDate = d.completedAt ? fmtDate(d.completedAt.split("T")[0]) : "";
        return '<div class="ptm-completed-item">' +
          '<span class="ptm-completed-check">✓</span>' +
          '<span class="ptm-completed-title">' + esc(d.title) + '</span>' +
          '<span class="ptm-completed-date">' + esc(compDate) + '</span></div>';
      }).join("");
    }
  }

  function timeSince(date) {
    var seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "just now";
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + "m ago";
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "h ago";
    var days = Math.floor(hours / 24);
    if (days < 7) return days + "d ago";
    return fmtDateShort(date.toISOString().split("T")[0]);
  }

  /* ---- Render: Assignee Filter (from permitted users) ---- */
  function renderAssigneeFilter() {
    var sel = $("#ptmFilterAssignee");
    if (!sel) return;
    var currentVal = sel.value;
    sel.innerHTML = '<option value="">All Assignees</option>';
    if (!selectedSprintId) return;

    var seen = {};
    permittedUsers.forEach(function (m) {
      if (!seen[m.id]) {
        seen[m.id] = true;
        var opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = userDisplay(m);
        sel.appendChild(opt);
      }
    });
    // Also include assignees from tasks that may not be in permittedUsers
    getSprintTasks(selectedSprintId).forEach(function (t) {
      var d = getTaskData(t);
      var key = d.assignedTo || d.assigneeEmail || "";
      if (key && !seen[key]) {
        seen[key] = true;
        var opt = document.createElement("option");
        opt.value = key;
        opt.textContent = d.assigneeName || d.assigneeEmail || d.assignedTo || key;
        sel.appendChild(opt);
      }
    });
    sel.value = currentVal;
  }

  /* ---- Render: Task Modal Assignee List (from permitted users) ---- */
  function renderTaskAssigneeList() {
    var sel = $("#ptmTaskAssignee");
    if (!sel) return;
    sel.innerHTML = '<option value="">— Unassigned —</option>';
    permittedUsers.forEach(function (m) {
      var opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = userDisplay(m) + (m.roles && (m.roles.indexOf("manager") > -1 || m.roles.indexOf("admin") > -1) ? " (manager)" : "");
      sel.appendChild(opt);
    });
  }

  /* ---- Render: Team View ---- */
  function renderTeamView() {
    var grid = $("#ptmTeamGrid");
    if (!grid) return;
    if (!permittedUsers.length) {
      grid.innerHTML = '<div class="ptm-col-body-empty" style="grid-column:1/-1;padding:24px">No permitted users data available. Users with CMS object access will appear here.</div>';
      return;
    }
    var colors = ["#4f46e5","#0d9488","#d97706","#dc2626","#7c3aed","#2563eb","#059669","#c2410c"];
    grid.innerHTML = permittedUsers.map(function (u, i) {
      var isMgr = u.roles && (u.roles.indexOf("manager") > -1 || u.roles.indexOf("admin") > -1);
      var initials = (u.name || u.id || "?").split(" ").map(function (p) { return p[0]; }).join("").toUpperCase().slice(0, 2);
      var color = colors[i % colors.length];
      return '<div class="ptm-team-card">' +
        '<div class="ptm-team-avatar ' + (isMgr ? "mgr" : "staff") + '" style="background:' + color + '">' + esc(initials) + '</div>' +
        '<div class="ptm-team-info">' +
          '<div class="ptm-team-name">' + esc(u.name || u.id) + '</div>' +
          (u.email ? '<div class="ptm-team-email">' + esc(u.email) + '</div>' : '') +
          '<span class="ptm-team-role ' + (isMgr ? "role-mgr" : "role-staff") + '">' + (isMgr ? "Manager" : "Staff") + '</span>' +
        '</div>' +
      '</div>';
    }).join("");
  }

  /* ---- Render: Full UI ---- */
  function renderAll() {
    detectRole();
    renderSprintSelector();
    renderSprintInfo();
    renderStats();
    renderBoard();
    renderListView();
    renderTeamView();
    if (currentView === "report") renderReportView();
    renderAssigneeFilter();
    updateVisibility();
    updateUserDisplay();
    resize();
  }

  function switchView(view) {
    currentView = view;
    UI._view = view;
    persistUI();

    // Update tab buttons
    $$(".ptm-view-tab").forEach(function (tab) {
      tab.classList.toggle("active", tab.getAttribute("data-view") === view);
    });

    // Show/hide views
    var boardEl = $("#ptmBoard"), listEl = $("#ptmListView"), reportEl = $("#ptmReportView"), teamEl = $("#ptmTeamView");
    if (boardEl) boardEl.style.display = view === "board" ? "" : "none";
    if (listEl) listEl.style.display = view === "list" ? "" : "none";
    if (reportEl) reportEl.style.display = view === "report" ? "" : "none";
    if (teamEl) teamEl.style.display = view === "team" ? "" : "none";

    if (view === "list") renderListView();
    if (view === "report") renderReportView();
    if (view === "team") renderTeamView();
    resize();
  }

  function updateVisibility() {
    var hasSprintSelected = !!selectedSprintId;
    var sprintTasks = hasSprintSelected ? getSprintTasks(selectedSprintId) : [];
    var hasTasks = sprintTasks.length > 0;

    var els = {
      statsRow: $("#ptmStatsRow"),
      viewTabs: $("#ptmViewTabs"),
      boardToolbar: $("#ptmBoardToolbar"),
      board: $("#ptmBoard"),
      listView: $("#ptmListView"),
      reportView: $("#ptmReportView"),
      teamView: $("#ptmTeamView"),
      emptyState: $("#ptmEmptyState"),
      emptyTasks: $("#ptmEmptyTasks"),
      addBtn: $("#ptmBtnAddTask"),
      badge: $("#ptmRoleBadge")
    };

    if (els.statsRow) els.statsRow.style.display = hasSprintSelected ? "" : "none";
    if (els.viewTabs) els.viewTabs.style.display = hasSprintSelected ? "" : "none";
    if (els.boardToolbar) els.boardToolbar.style.display = hasSprintSelected ? "" : "none";
    if (els.board) els.board.style.display = (hasSprintSelected && hasTasks && currentView === "board") ? "" : "none";
    if (els.listView) els.listView.style.display = (hasSprintSelected && hasTasks && currentView === "list") ? "" : "none";
    if (els.reportView) els.reportView.style.display = (hasSprintSelected && currentView === "report") ? "" : "none";
    if (els.teamView) els.teamView.style.display = (hasSprintSelected && currentView === "team") ? "" : "none";
    if (els.emptyState) els.emptyState.style.display = !hasSprintSelected ? "" : "none";
    if (els.emptyTasks) els.emptyTasks.style.display = (hasSprintSelected && !hasTasks && currentView !== "team" && currentView !== "report") ? "" : "none";

    if (els.addBtn) {
      els.addBtn.disabled = !(hasSprintSelected && !readOnly);
      els.addBtn.title = hasSprintSelected ? (readOnly ? "Read-only mode" : "") : "Select a sprint first";
    }

    if (els.badge) {
      els.badge.textContent = isManager ? "Manager" : "Staff";
      els.badge.className = "ptm-role-badge " + (isManager ? "role-manager" : "role-staff");
    }
  }

  function updateUserDisplay() {
    var el = $("#ptmUserName");
    if (el) el.textContent = currentUser ? (currentUser.name || currentUser.email || "Signed in") : "Not signed in";
  }

  /* ---- Sprint Form ---- */
  function openSprintForm(sprintId) {
    if (!isManager) { notify("Only managers can create or edit sprints.", "warning"); return; }
    editingSprintId = sprintId || null;
    var form = $("#ptmSprintForm");
    var title = $("#ptmSprintFormTitle");
    var deleteBtn = $("#ptmBtnDeleteSprint");
    var statusSel = $("#ptmSprintStatusSelect");

    if (sprintId) {
      if (title) title.textContent = "Edit Sprint";
      if (deleteBtn) deleteBtn.style.display = "";
      var s = null;
      for (var i = 0; i < sprints.length; i++) {
        if ((sprints[i].id || sprints[i]._id) === sprintId) { s = sprints[i]; break; }
      }
      if (s) {
        var d = getSprintData(s);
        $("#ptmSprintName").value = d.name || "";
        $("#ptmSprintStart").value = d.startDate || "";
        $("#ptmSprintEnd").value = d.endDate || "";
        $("#ptmSprintGoal").value = d.goal || "";
        if (statusSel) { statusSel.value = d.status || "active"; statusSel.style.display = ""; }
      }
    } else {
      if (title) title.textContent = "Create Sprint";
      if (deleteBtn) deleteBtn.style.display = "none";
      var defs = computeSprintDefaults();
      $("#ptmSprintName").value = autoSprintName();
      $("#ptmSprintStart").value = defs.start;
      $("#ptmSprintEnd").value = defs.end;
      $("#ptmSprintGoal").value = "";
      if (statusSel) { statusSel.value = "active"; statusSel.style.display = "none"; }
    }
    if (form) form.style.display = "";
    resize();
  }

  function closeSprintForm() {
    $("#ptmSprintForm").style.display = "none";
    editingSprintId = null;
    resize();
  }

  function saveSprint() {
    try {
      var nameEl = $("#ptmSprintName"), startEl = $("#ptmSprintStart"), endEl = $("#ptmSprintEnd");
      if (!nameEl || !startEl || !endEl) { notify("Form fields not ready. Please try again.", "error"); logErr("saveSprint: form fields missing"); return; }
      var name = nameEl.value.trim();
      var start = startEl.value;
      var end = endEl.value;
      var statusSel = $("#ptmSprintStatusSelect");
      var statusVal = statusSel ? statusSel.value : "active";

      if (!name) { notify("Please enter a sprint name.", "warning"); return; }
      if (!start) { notify("Please select a start date.", "warning"); return; }
      if (!end) { notify("Please select an end date.", "warning"); return; }
      if (end < start) { notify("End date must be after start date.", "warning"); return; }

      var managerId = currentUser ? (currentUser.id || "") : "";
      var goal = ($("#ptmSprintGoal") ? $("#ptmSprintGoal").value.trim() : "");
      var productData = {
        data_categoriesBased: {
          startDate: start,
          endDate: end,
          managerId: managerId,
          goal: goal,
          status: editingSprintId ? statusVal : "active",
          sprintOrder: sprints.length + 1
        }
      };

      var callbackFired = false;
      var timeoutId = setTimeout(function () {
        if (!callbackFired) {
          callbackFired = true;
          notify("Save timed out — check that allowObjectCRUD is 'yes' and allowedObjectTypes includes taskSprints-uniconbaseapps/taskItems-uniconbaseapps.", "error");
          logErr("saveSprint: requestObjects callback timed out after 30s");
        }
      }, 30000);

      function handleResult(err, result) {
        if (callbackFired) return;
        callbackFired = true;
        clearTimeout(timeoutId);
        if (err) { notify("Save failed: " + err, "error"); logErr("saveSprint error: " + err); return; }
        notify(editingSprintId ? "Sprint updated." : "Sprint created.", "success");
        closeSprintForm();
        reloadAll();
      }

      if (editingSprintId) {
        safeRequest("update", {
          mainObjectType: "taskSprints-uniconbaseapps",
          objectId: editingSprintId,
          name: name,
          productData: productData
        }, handleResult);
      } else {
        safeRequest("create", {
          mainObjectType: "taskSprints-uniconbaseapps",
          name: name,
          productData: productData
        }, handleResult);
      }
    } catch (e) {
      logErr("saveSprint exception: " + (e.message || e));
      notify("An unexpected error occurred. Please try again.", "error");
    }
  }

  function deleteSprint() {
    if (!editingSprintId) return;
    pendingConfirmAction = function () {
      var sprintTasks = getSprintTasks(editingSprintId);

      function doDeleteSprint() {
        tool.requestObjects("delete", {
          mainObjectType: "taskSprints-uniconbaseapps",
          objectId: editingSprintId
        }, function (err, result) {
          if (err) { notify("Failed to delete sprint: " + err, "error"); logErr("deleteSprint error: " + err); return; }
          notify("Sprint deleted.", "info");
          if (selectedSprintId === editingSprintId) {
            selectedSprintId = null;
            UI.selectedSprintId = null;
            persistUINow();
          }
          closeSprintForm();
          reloadAll();
        });
      }

      // If no tasks, delete sprint directly
      if (sprintTasks.length === 0) {
        doDeleteSprint();
        return;
      }

      // Delete tasks first (batch), then delete sprint
      if (sprintTasks.length > 500) {
        notify("Too many tasks (" + sprintTasks.length + "). Delete some tasks individually first.", "error");
        return;
      }

      var taskOps = sprintTasks.map(function (t) {
        return { action: "delete", mainObjectType: "taskItems-uniconbaseapps", objectId: t.id || t._id };
      });

      tool.requestObjects("batch", { operations: taskOps }, function (err, result) {
        if (err) {
          notify("Failed to delete tasks: " + err, "error");
          logErr("deleteSprint batch tasks error: " + err);
          return;
        }
        // Tasks deleted, now delete the sprint
        doDeleteSprint();
      });
    };
    showConfirm("Delete sprint \"" + (getCurrentSprintData() ? getCurrentSprintData().name : "") + "\" and ALL " + getSprintTasks(editingSprintId).length + " tasks? This cannot be undone.");
  }

  /* ---- Task Modal ---- */
  var taskLabels = [];
  var taskAttachments = [];
  var taskLinks = [];

  function openTaskModal(taskId) {
    if (!selectedSprintId) {
      notify("Please select or create a sprint before adding tasks.", "warning");
      return;
    }
    editingTaskId = taskId || null;
    taskLabels = [];
    taskAttachments = [];
    taskLinks = [];
    var overlay = $("#ptmTaskOverlay");
    var title = $("#ptmModalTitle");
    var deleteBtn = $("#ptmBtnDeleteTask");

    renderTaskAssigneeList();

    if (taskId) {
      if (title) title.textContent = "Edit Task";
      if (deleteBtn) deleteBtn.style.display = "";
      var t = null;
      for (var i = 0; i < tasks.length; i++) {
        if ((tasks[i].id || tasks[i]._id) === taskId) { t = tasks[i]; break; }
      }
      if (t) {
        var d = getTaskData(t);
        $("#ptmTaskTitle").value = d.title || "";
        $("#ptmTaskDesc").value = d.description || "";
        $("#ptmTaskStatus").value = d.status || "todo";
        $("#ptmTaskPriority").value = d.priority || "medium";
        $("#ptmTaskAssignee").value = d.assignedTo || "";
        $("#ptmTaskDueDate").value = d.dueDate || "";
        $("#ptmTaskNotes").value = d.notes || "";
        taskLabels = (d.labels || []).slice();
        taskAttachments = (d.attachments || []).slice();
        taskLinks = (d.links || []).slice();
        $("#ptmLinkUrl").value = "";
        $("#ptmLinkLabel").value = "";
      }
    } else {
      if (title) title.textContent = "New Task";
      if (deleteBtn) deleteBtn.style.display = "none";
      $("#ptmTaskTitle").value = "";
      $("#ptmTaskDesc").value = "";
      $("#ptmTaskStatus").value = "todo";
      $("#ptmTaskPriority").value = "medium";
      $("#ptmTaskAssignee").value = "";
      $("#ptmTaskDueDate").value = "";
      $("#ptmTaskNotes").value = "";
      $("#ptmLinkUrl").value = "";
      $("#ptmLinkLabel").value = "";
      taskLabels = [];
      taskAttachments = [];
      taskLinks = [];
    }

    renderLabelsChips();
    renderAttachmentsList();
    if (overlay) overlay.style.display = "";
    resize();
  }

  function closeTaskModal() {
    $("#ptmTaskOverlay").style.display = "none";
    editingTaskId = null;
    taskLabels = [];
    taskAttachments = [];
    taskLinks = [];
    resize();
  }

  /* ---- Labels helpers ---- */
  function renderLabelsChips() {
    var container = $("#ptmLabelsChips");
    if (!container) return;
    var labelColors = ["#4f46e5","#0d9488","#d97706","#dc2626","#7c3aed","#2563eb","#059669"];
    container.innerHTML = taskLabels.map(function (l, i) {
      return '<span class="ptm-label-chip" style="background:' + labelColors[i % labelColors.length] + '">' + esc(l) +
        '<span class="ptm-label-remove" data-idx="' + i + '">&times;</span></span>';
    }).join("");
    $$(".ptm-label-remove", container).forEach(function (btn) {
      btn.onclick = function () {
        var idx = parseInt(btn.getAttribute("data-idx"), 10);
        if (!isNaN(idx) && idx >= 0 && idx < taskLabels.length) { taskLabels.splice(idx, 1); renderLabelsChips(); }
      };
    });
  }

  function addLabel(label) {
    label = label.trim().toLowerCase().replace(/\s+/g, "-");
    if (!label) return;
    if (taskLabels.indexOf(label) > -1) return;
    taskLabels.push(label);
    renderLabelsChips();
  }

  /* ---- Attachments helpers ---- */
  function renderAttachmentsList() {
    var container = $("#ptmAttachList");
    if (!container) return;
    var items = [];
    taskAttachments.forEach(function (a, i) {
      items.push('<div class="ptm-attach-item"><span class="ptm-attach-icon">📎</span><span class="ptm-attach-name" data-url="' + esc(a.url) + '">' + esc(a.name) + '</span><span class="ptm-attach-remove" data-idx="' + i + '" data-type="att">×</span></div>');
    });
    taskLinks.forEach(function (l, i) {
      items.push('<div class="ptm-attach-item"><span class="ptm-attach-icon">🔗</span><span class="ptm-attach-name" data-url="' + esc(l.url) + '">' + esc(l.label || l.url) + '</span><span class="ptm-attach-remove" data-idx="' + i + '" data-type="link">×</span></div>');
    });
    container.innerHTML = items.join("") || '<div style="color:#bbb;font-size:12px;padding:4px">No attachments or links yet</div>';

    // Wire click to open URL
    $$(".ptm-attach-name", container).forEach(function (el) {
      el.onclick = function () { var u = el.getAttribute("data-url"); if (u) window.open(u, "_blank"); };
    });
    // Wire remove
    $$(".ptm-attach-remove", container).forEach(function (btn) {
      btn.onclick = function () {
        var idx = parseInt(btn.getAttribute("data-idx"), 10);
        var type = btn.getAttribute("data-type");
        if (type === "att" && idx >= 0 && idx < taskAttachments.length) { taskAttachments.splice(idx, 1); }
        else if (type === "link" && idx >= 0 && idx < taskLinks.length) { taskLinks.splice(idx, 1); }
        renderAttachmentsList();
      };
    });
  }

  function addLink() {
    var urlEl = $("#ptmLinkUrl"), labelEl = $("#ptmLinkLabel");
    var url = (urlEl ? urlEl.value.trim() : "");
    if (!url) { notify("Enter a URL.", "warning"); return; }
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    var label = labelEl ? labelEl.value.trim() : "";
    taskLinks.push({ url: url, label: label || url });
    if (urlEl) urlEl.value = "";
    if (labelEl) labelEl.value = "";
    renderAttachmentsList();
  }

  function uploadFile() {
    tool.requestUpload("*", function (err, file) {
      if (err) { notify("Upload failed: " + err, "error"); return; }
      taskAttachments.push({ name: file.name, url: file.url, size: file.size, type: file.type });
      renderAttachmentsList();
      notify("File attached: " + file.name, "success");
      resize();
    });
  }

  /* ---- Export Functions ---- */
  function exportPdf() {
    var visible = getVisibleTasks();
    var sd = getCurrentSprintData();
    var sprintName = sd ? sd.name : "Sprint";
    var rows = visible.map(function (t) {
      var d = getTaskData(t);
      return "<tr><td>" + esc(d.title) + "</td><td>" + statusLabel(d.status) + "</td><td>" + esc(d.priority) + "</td><td>" + esc(d.assigneeName || d.assignedTo || "—") + "</td><td>" + (d.dueDate ? fmtDateShort(d.dueDate) : "—") + "</td></tr>";
    }).join("");
    var html = "<h1>" + esc(sprintName) + " — Report</h1>" +
      "<p>Generated " + new Date().toLocaleDateString() + " · " + visible.length + " tasks</p>" +
      "<table border='1' cellpadding='8' cellspacing='0' style='width:100%;border-collapse:collapse;font-family:sans-serif;font-size:13px'>" +
      "<thead style='background:#f3f4f6'><tr><th>Title</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due</th></tr></thead><tbody>" + rows + "</tbody></table>";
    tool.requestExportPdf({ html: html, filename: sprintName.replace(/\s+/g, "-").toLowerCase() + "-report" }, function (err, file) {
      if (err) { notify("Export failed: " + err, "error"); return; }
      notify("Report exported.", "success");
      window.open(file.url, "_blank");
    });
  }

  function exportCsv() {
    var visible = getVisibleTasks();
    var sd = getCurrentSprintData();
    var sprintName = sd ? sd.name : "Sprint";
    var header = "Title,Status,Priority,Assignee,Due Date,Labels";
    var rows = visible.map(function (t) {
      var d = getTaskData(t);
      return [d.title, statusLabel(d.status), d.priority, d.assigneeName || d.assignedTo || "", d.dueDate || "", (d.labels || []).join("; ")].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(",");
    });
    var csv = header + "\n" + rows.join("\n");
    var html = "<pre style='font-family:monospace;font-size:12px;white-space:pre-wrap'>" + csv.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</pre>";
    tool.requestExportPdf({ html: html, filename: sprintName.replace(/\s+/g, "-").toLowerCase() + "-tasks" }, function (err, file) {
      if (err) { notify("Export failed: " + err, "error"); return; }
      notify("CSV exported.", "success");
      window.open(file.url, "_blank");
    });
  }

  function saveTask() {
    var title = $("#ptmTaskTitle").value.trim();
    var desc = $("#ptmTaskDesc").value.trim();
    var status = $("#ptmTaskStatus").value;
    var priority = $("#ptmTaskPriority").value;
    var assignee = $("#ptmTaskAssignee").value;
    var dueDate = $("#ptmTaskDueDate").value;
    var notes = $("#ptmTaskNotes").value.trim();

    if (!title) { notify("Please enter a task title.", "warning"); return; }
    if (!selectedSprintId) { notify("Please select a sprint first.", "warning"); return; }

    var assigneeName = "";
    var assigneeEmail = "";
    if (assignee) {
      for (var i = 0; i < permittedUsers.length; i++) {
        if (permittedUsers[i].id === assignee) {
          assigneeName = permittedUsers[i].name || "";
          assigneeEmail = permittedUsers[i].email || "";
          break;
        }
      }
    }

    var productData = {
      data_categoriesBased: {
        title: title,
        description: desc,
        status: status,
        assignedTo: assignee,
        assigneeName: assigneeName,
        assigneeEmail: assigneeEmail,
        sprintId: selectedSprintId,
        priority: priority,
        dueDate: dueDate,
        completedAt: status === "done" ? new Date().toISOString() : "",
        notes: notes,
        labels: taskLabels.slice(),
        attachments: taskAttachments.slice(),
        links: taskLinks.slice()
      }
    };

    if (editingTaskId) {
      var existingTask = null;
      for (var j = 0; j < tasks.length; j++) {
        if ((tasks[j].id || tasks[j]._id) === editingTaskId) { existingTask = tasks[j]; break; }
      }
      if (existingTask) {
        var ed = getTaskData(existingTask);
        if (status === "done" && ed.status !== "done") {
          productData.data_categoriesBased.completedAt = new Date().toISOString();
        } else if (status !== "done") {
          productData.data_categoriesBased.completedAt = "";
        } else {
          productData.data_categoriesBased.completedAt = ed.completedAt || new Date().toISOString();
        }
      }
    } else if (status === "done") {
      productData.data_categoriesBased.completedAt = new Date().toISOString();
    }

    var callbackFired2 = false;
    var timeoutId2 = setTimeout(function () {
      if (!callbackFired2) {
        callbackFired2 = true;
        notify("Task save timed out — check CMS Object CRUD settings.", "error");
        logErr("saveTask: requestObjects callback timed out after 30s");
      }
    }, 30000);

    function handleTaskResult(err, result) {
      if (callbackFired2) return;
      callbackFired2 = true;
      clearTimeout(timeoutId2);
      if (err) { notify("Task save failed: " + err, "error"); logErr("saveTask error: " + err); return; }
      notify(editingTaskId ? "Task updated." : "Task created.", "success");
      closeTaskModal();
      reloadAll();
    }

    if (editingTaskId) {
      tool.requestObjects("update", {
        mainObjectType: "taskItems-uniconbaseapps",
        objectId: editingTaskId,
        name: title,
        productData: productData
      }, handleTaskResult);
    } else {
      tool.requestObjects("create", {
        mainObjectType: "taskItems-uniconbaseapps",
        name: title,
        productData: productData
      }, handleTaskResult);
    }
  }

  function deleteTask() {
    if (!editingTaskId) return;
    pendingConfirmAction = function () {
      tool.requestObjects("delete", {
        mainObjectType: "taskItems-uniconbaseapps",
        objectId: editingTaskId
      }, function (err, result) {
        if (err) { notify("Failed to delete task: " + err, "error"); logErr("deleteTask error: " + err); return; }
        notify("Task deleted.", "info");
        closeTaskModal();
        reloadAll();
      });
    };
    showConfirm("Delete this task? This cannot be undone.");
  }

  /* ---- Quick status change from board (click to cycle) ---- */
  // We use a double-click handler for quick status cycle
  function quickCycleStatus(taskId) {
    if (readOnly || (!isManager && currentUser)) {
      // Staff can only change their own tasks
      var t = null;
      for (var i = 0; i < tasks.length; i++) {
        if ((tasks[i].id || tasks[i]._id) === taskId) { t = tasks[i]; break; }
      }
      if (t) {
        var d = getTaskData(t);
        if (d.assignedTo && currentUser && !matchUser({ id: d.assignedTo }, currentUser)) {
          notify("You can only update your own tasks.", "warning");
          return;
        }
      }
    }

    var t = null;
    for (var i = 0; i < tasks.length; i++) {
      if ((tasks[i].id || tasks[i]._id) === taskId) { t = tasks[i]; break; }
    }
    if (!t) return;

    var d = getTaskData(t);
    var cycle = { todo: "inProgress", inProgress: "done", done: "todo", blocked: "inProgress" };
    var newStatus = cycle[d.status] || "todo";
    var completedAt = d.completedAt || "";
    if (newStatus === "done" && !completedAt) completedAt = new Date().toISOString();
    if (newStatus !== "done") completedAt = "";

    tool.requestObjects("update", {
      mainObjectType: "taskItems-uniconbaseapps",
      objectId: taskId,
      productData: {
        data_categoriesBased: {
          status: newStatus,
          completedAt: completedAt
        }
      }
    }, function (err, result) {
      if (err) { notify("Failed to update: " + err, "error"); return; }
      reloadAll();
    });
  }

  /* ---- Confirm Modal ---- */
  function showConfirm(msg) {
    $("#ptmConfirmMsg").textContent = msg;
    $("#ptmConfirmOverlay").style.display = "";
  }

  function hideConfirm() {
    $("#ptmConfirmOverlay").style.display = "none";
    pendingConfirmAction = null;
  }

  /* ---- Reload ---- */
  function reloadAll() {
    loadAll(function () {
      // Restore selected sprint
      if (selectedSprintId) {
        var found = sprints.some(function (s) { return (s.id || s._id) === selectedSprintId; });
        if (!found) selectedSprintId = null;
      }
      renderAll();
    });
  }

  /* ---- Apply read-only ---- */
  function applyReadonly() {
    ROOT.setAttribute("data-readonly", readOnly ? "true" : "false");
    var allInteractive = $$(".ptm-btn, .ptm-icon-btn, .ptm-task-card, .ptm-field input, .ptm-field select, .ptm-field textarea, .ptm-chip-remove");
    allInteractive.forEach(function (el) {
      if (readOnly) {
        el.style.pointerEvents = "none";
        if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") {
          el.style.background = "#f5f6f8";
        }
      } else {
        el.style.pointerEvents = "";
        el.style.background = "";
      }
    });
  }

  /* ---- Event Wiring ---- */
  function wireEvents() {
    // Sprint selector
    $("#ptmSprintSelect").onchange = function () {
      selectedSprintId = this.value || null;
      UI.selectedSprintId = selectedSprintId;
      persistUINow();
      detectRole();
      renderAll();
    };

    // New sprint button
    $("#ptmBtnNewSprint").onclick = function () { openSprintForm(null); };
    $("#ptmBtnEmptyCreate").onclick = function () { openSprintForm(null); };

    // Edit/Delete sprint from bar
    $("#ptmBtnEditSprint").onclick = function () {
      if (selectedSprintId) openSprintForm(selectedSprintId);
    };
    $("#ptmBtnDeleteSprintBar").onclick = function () {
      if (!selectedSprintId) return;
      editingSprintId = selectedSprintId;
      var sprintTasks = getSprintTasks(selectedSprintId);
      var sprintName = getCurrentSprintData() ? getCurrentSprintData().name : "";

      pendingConfirmAction = function () {
        function doDelete() {
          tool.requestObjects("delete", {
            mainObjectType: "taskSprints-uniconbaseapps",
            objectId: selectedSprintId
          }, function (err, result) {
            if (err) { notify("Failed to delete sprint: " + err, "error"); logErr("deleteSprintBar error: " + err); return; }
            notify("Sprint deleted.", "info");
            selectedSprintId = null;
            UI.selectedSprintId = null;
            persistUINow();
            editingSprintId = null;
            reloadAll();
          });
        }
        if (sprintTasks.length === 0) { doDelete(); return; }
        if (sprintTasks.length > 500) { notify("Too many tasks to delete at once.", "error"); return; }
        var taskOps = sprintTasks.map(function (t) {
          return { action: "delete", mainObjectType: "taskItems-uniconbaseapps", objectId: t.id || t._id };
        });
        tool.requestObjects("batch", { operations: taskOps }, function (err, result) {
          if (err) { notify("Failed to delete tasks: " + err, "error"); logErr("deleteSprintBar batch error: " + err); return; }
          doDelete();
        });
      };
      showConfirm("Delete sprint \"" + sprintName + "\" and ALL " + sprintTasks.length + " tasks? This cannot be undone.");
    };

    // Sprint form
    $("#ptmSprintStart").onchange = function () {
      var start = this.value;
      var endEl = $("#ptmSprintEnd");
      if (start && (!endEl.value || endEl.value < start)) {
        // Auto-set end = start + 13 days (2-week sprint ending Friday)
        endEl.value = addDays(start, 13);
      }
    };
    $("#ptmBtnSaveSprint").onclick = saveSprint;
    $("#ptmBtnCancelSprint").onclick = closeSprintForm;
    $("#ptmBtnDeleteSprint").onclick = deleteSprint;

    // Task modal
    $("#ptmBtnAddTask").onclick = function () { openTaskModal(null); };
    $("#ptmBtnEmptyTask").onclick = function () { openTaskModal(null); };
    $("#ptmModalClose").onclick = closeTaskModal;
    $("#ptmBtnCancelTask").onclick = closeTaskModal;
    $("#ptmBtnSaveTask").onclick = saveTask;
    $("#ptmBtnDeleteTask").onclick = deleteTask;
    $("#ptmTaskOverlay").onclick = function (e) { if (e.target === this) closeTaskModal(); };

    // Labels: Enter key adds label
    var lblInput = $("#ptmTaskLabelsInput");
    if (lblInput) lblInput.onkeydown = function (e) {
      if (e.key === "Enter") { e.preventDefault(); addLabel(lblInput.value); lblInput.value = ""; }
    };

    // Links & Attachments
    $("#ptmBtnAddLink").onclick = addLink;
    $("#ptmBtnUploadFile").onclick = uploadFile;
    $("#ptmLinkUrl").onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); addLink(); } };

    // Confirm modal
    $("#ptmBtnConfirmYes").onclick = function () {
      hideConfirm();
      if (pendingConfirmAction) { pendingConfirmAction(); pendingConfirmAction = null; }
    };
    $("#ptmBtnConfirmNo").onclick = hideConfirm;
    $("#ptmConfirmClose").onclick = hideConfirm;
    $("#ptmConfirmOverlay").onclick = function (e) { if (e.target === this) hideConfirm(); };

    // Filters
    $("#ptmFilterAssignee").onchange = function () { renderStats(); renderBoard(); renderListView(); };
    $("#ptmFilterPriority").onchange = function () { renderStats(); renderBoard(); renderListView(); };
    $("#ptmFilterStatus").onchange = function () { renderStats(); renderBoard(); renderListView(); };

    // Search (debounced)
    var searchTimer = null;
    $("#ptmSearchInput").oninput = function () {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { renderStats(); renderBoard(); renderListView(); }, 300);
    };

    // Export
    $("#ptmBtnExportPdf").onclick = exportPdf;
    $("#ptmBtnExportCsv").onclick = exportCsv;

    // View tabs
    $$(".ptm-view-tab").forEach(function (tab) {
      tab.onclick = function () {
        var view = tab.getAttribute("data-view");
        switchView(view);
      };
    });

    // List view column sorting
    var listTable = $(".ptm-list-table");
    if (listTable) {
      listTable.addEventListener("click", function (e) {
        var th = e.target.closest(".ptm-sortable");
        if (!th) return;
        var field = th.getAttribute("data-sort");
        if (listSort.field === field) {
          listSort.asc = !listSort.asc;
        } else {
          listSort.field = field;
          listSort.asc = false;
        }
        // Update sort indicators
        $$(".ptm-sortable").forEach(function (h) {
          h.classList.remove("ptm-sorted", "ptm-sorted-rev");
        });
        th.classList.add(listSort.asc ? "ptm-sorted-rev" : "ptm-sorted");
        renderListView();
      });
    }

    // Global click handler for task cards (single click = open, double click = cycle status)
    ROOT.addEventListener("click", function (e) {
      var card = e.target.closest(".ptm-task-card");
      if (!card) return;
      var taskId = card.getAttribute("data-task-id");
      if (!taskId) return;
      if (card._clickTimer) {
        clearTimeout(card._clickTimer);
        card._clickTimer = null;
        quickCycleStatus(taskId);
      } else {
        card._clickTimer = setTimeout(function () {
          card._clickTimer = null;
          openTaskModal(taskId);
        }, 280);
      }
    });

    // Keyboard shortcuts
    ROOT.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if ($("#ptmTaskOverlay").style.display !== "none") closeTaskModal();
        else if ($("#ptmConfirmOverlay").style.display !== "none") hideConfirm();
        else if ($("#ptmSprintForm").style.display !== "none") closeSprintForm();
      }
    });
  }

  /* ============================================================
     ENTRY POINT
     ============================================================ */
  tool.onReady(function (val, fields) {
    ROOT = document.querySelector(".ptm");
    if (!ROOT) { console.error("PTM: root .ptm not found"); return; }

    // Restore UI state
    if (val && typeof val === "object" && !Array.isArray(val)) {
      UI = Object.assign(defaultUI(), val);
    } else {
      UI = defaultUI();
    }
    selectedSprintId = UI.selectedSprintId || null;
    currentView = UI._view || "board";

    // Get current user
    currentUser = tool.getUser();
    readOnly = tool.isReadOnly();

    wireEvents();
    applyReadonly();

    // Set initial view tab
    $$(".ptm-view-tab").forEach(function (tab) {
      tab.classList.toggle("active", tab.getAttribute("data-view") === currentView);
    });

    // Declare params
    try {
      tool.declareParams([
        { name: "allowObjectCRUD", label: "Allow Object CRUD", type: "toggle", default: "yes", hint: "Enable task and sprint storage" },
        { name: "allowAi", label: "Allow AI", type: "toggle", default: "no", hint: "Enable AI features" }
      ]);
    } catch (e) {}

    // Startup diagnostic: check requestObjects availability
    var hasObjCRUD = typeof tool.requestObjects === "function";
    if (!hasObjCRUD) {
      logErr("tool.requestObjects is not a function — Object CRUD not available. Saves will fail.");
    } else {
      var crudAllowed = tool.param("allowObjectCRUD", "");
      if (crudAllowed !== "yes") {
        logErr("allowObjectCRUD is '" + crudAllowed + "' — set to 'yes' in CMS field settings to enable saves.");
      }
    }

    // Load permitted users FIRST (sync), then load data and render
    permittedUsers = tool.getPermittedUsers() || [];
    tool.onPermittedUsersChange(function (users) {
      permittedUsers = users || [];
      detectRole();
      renderAll();
    });

    // Load data
    loadAll(function () {
      if (selectedSprintId) {
        var found = sprints.some(function (s) { return (s.id || s._id) === selectedSprintId; });
        if (!found) { selectedSprintId = null; UI.selectedSprintId = null; }
      }
      detectRole();
      renderAll();
    });

    // SDK event listeners
    tool.onValueChange(function (v) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        UI = Object.assign(defaultUI(), v);
        selectedSprintId = UI.selectedSprintId || null;
        reloadAll();
      }
    });

    tool.onFieldsChange(function (f) { /* react to sibling fields if needed */ });

    tool.onReadonlyChange(function (ro) {
      readOnly = ro === true;
      applyReadonly();
    });

    tool.onUserChange(function (u) {
      currentUser = u;
      detectRole();
      updateUserDisplay();
      renderAll();
    });

    // Validate
    tool.reportValid(true, "");
  });

})();