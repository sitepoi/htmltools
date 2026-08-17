/* ============================================================
   Incident & Accident Report Form - JS
   Uniconhub CMS html-tool. Entry point: tool.onReady
   ============================================================ */
(function () {
  "use strict";

  /* ---- SDK handle + fallback shim ---- */
  var tool = (typeof window !== "undefined" && window.tool) ? window.tool : null;
  if (!tool) {
    var _v = null;
    tool = {
      onReady: function (cb) { cb(_v, {}); },
      getValue: function () { return _v; },
      setValue: function (v) { _v = v; },
      onValueChange: function () {},
      getFields: function () { return {}; },
      watchField: function () {},
      setField: function () {},
      setFields: function () {},
      onFieldsChange: function () {},
      param: function (n, d) { return d; },
      isReadOnly: function () { return false; },
      onReadonlyChange: function () {},
      getUser: function () { return null; },
      onUserChange: function () {},
      reportValid: function () {},
      notify: function (m, s) { try { console.log("notify:", m); } catch (e) {} },
      resize: function () {},
      declareOutput: function () {},
      declareParams: function () {}
    };
  }

  /* ---- Constants ---- */
  var ROOT = null;
  var readOnly = false;
  var currentUser = null;
  var DB = null;
  var submitted = false;
  var saveTimer = null;
  var SAVE_DEBOUNCE = 800;

  /* ---- Default data ---- */
  function defaultDB() {
    var today = todayISO();
    return {
      type: "",
      incidentDate: "",
      incidentTime: "",
      location: "",
      description: "",
      peopleInvolved: "",
      firstAidGiven: false,
      medicalNeeded: false,
      medicalDetails: "",
      reporterName: "",
      supervisorName: "",
      reportDate: today,
      followUp: {
        actionsTaken: "",
        investigationNotes: "",
        resolved: false,
        supervisorName: "",
        followUpDate: ""
      },
      submittedAt: ""
    };
  }

  /* ---- Helpers ---- */
  function $(s, r) { return (r || ROOT).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || ROOT).querySelectorAll(s)); }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function notify(msg, sev) { try { tool.notify(msg, sev || "success"); } catch (e) {} }
  function resize() { try { tool.resize(); } catch (e) {} }

  /* ---- Persistence ---- */
  function persist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { tool.setValue(DB); } catch (e) {}
      stampSaved();
    }, SAVE_DEBOUNCE);
  }

  function persistNow() {
    if (saveTimer) clearTimeout(saveTimer);
    try { tool.setValue(DB); } catch (e) {}
    stampSaved();
  }

  function stampSaved() {
    var el = $("#iar-savedAt");
    if (el) el.textContent = "Saved " + new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function updateValidity() {
    var ok = true;
    var msg = "";
    if (submitted) {
      ok = true;
    } else if (!DB.reporterName || !DB.reporterName.trim()) {
      ok = false;
      msg = "Please enter your name before submitting.";
    } else if (!DB.type) {
      ok = false;
      msg = "Please select the type of incident.";
    } else if (!DB.description || !DB.description.trim()) {
      ok = false;
      msg = "Please describe what happened.";
    }
    try { tool.reportValid(ok, msg); } catch (e) {}
  }

  /* ---- Read data from DOM into DB ---- */
  function readForm() {
    DB.type = $("#iar-type").value;
    DB.incidentDate = $("#iar-incidentDate").value;
    DB.incidentTime = $("#iar-incidentTime").value;
    DB.location = $("#iar-location").value;
    DB.description = $("#iar-description").value;
    DB.peopleInvolved = $("#iar-peopleInvolved").value;
    DB.firstAidGiven = $("#iar-firstAidGiven").value === "true";
    DB.medicalNeeded = $("#iar-medicalNeeded").value === "true";
    DB.medicalDetails = $("#iar-medicalDetails").value;
    DB.reporterName = $("#iar-reporterName").value;
    DB.supervisorName = $("#iar-supervisorName").value;
    DB.reportDate = $("#iar-reportDate").value;
    DB.followUp.actionsTaken = $("#iar-actionsTaken").value;
    DB.followUp.investigationNotes = $("#iar-investigationNotes").value;
    DB.followUp.resolved = $("#iar-resolved").value === "true";
    DB.followUp.supervisorName = $("#iar-followUpSupervisor").value;
    DB.followUp.followUpDate = $("#iar-followUpDate").value;
  }

  /* ---- Write DB to DOM ---- */
  function writeForm() {
    $("#iar-type").value = DB.type || "";
    $("#iar-incidentDate").value = DB.incidentDate || "";
    $("#iar-incidentTime").value = DB.incidentTime || "";
    $("#iar-location").value = DB.location || "";
    $("#iar-description").value = DB.description || "";
    $("#iar-peopleInvolved").value = DB.peopleInvolved || "";
    $("#iar-firstAidGiven").value = DB.firstAidGiven ? "true" : "false";
    $("#iar-medicalNeeded").value = DB.medicalNeeded ? "true" : "false";
    $("#iar-medicalDetails").value = DB.medicalDetails || "";
    $("#iar-reporterName").value = DB.reporterName || "";
    $("#iar-supervisorName").value = DB.supervisorName || "";
    $("#iar-reportDate").value = DB.reportDate || todayISO();
    $("#iar-actionsTaken").value = (DB.followUp && DB.followUp.actionsTaken) || "";
    $("#iar-investigationNotes").value = (DB.followUp && DB.followUp.investigationNotes) || "";
    $("#iar-resolved").value = (DB.followUp && DB.followUp.resolved) ? "true" : "false";
    $("#iar-followUpSupervisor").value = (DB.followUp && DB.followUp.supervisorName) || "";
    $("#iar-followUpDate").value = (DB.followUp && DB.followUp.followUpDate) || "";

    toggleMedicalDetails();
    updateSubmittedState();

    if (DB.submittedAt) {
      var el = $("#iar-submittedAt");
      if (el) el.textContent = "Submitted " + new Date(DB.submittedAt).toLocaleString();
    }
  }

  function toggleMedicalDetails() {
    var wrap = $("#iar-medicalDetailsWrap");
    if (wrap) wrap.style.display = DB.medicalNeeded ? "" : "none";
  }

  function updateSubmittedState() {
    var conf = $("#iar-confirmation");
    var submitBtn = $("#iar-submit");
    var newReportBtn = $("#iar-new-report");

    if (submitted) {
      if (conf) conf.style.display = "";
      if (submitBtn) submitBtn.style.display = "none";
      if (newReportBtn) newReportBtn.style.display = readOnly ? "none" : "";
    } else {
      if (conf) conf.style.display = "none";
      if (submitBtn) submitBtn.style.display = readOnly ? "none" : "";
      if (newReportBtn) newReportBtn.style.display = "none";
    }
    updateValidity();
  }

  /* ---- Apply read-only mode ---- */
  function applyReadonly() {
    ROOT.setAttribute("data-readonly", readOnly ? "true" : "false");

    // In read-only mode, all form fields become non-editable
    var allFields = $$(".iar-field input, .iar-field select, .iar-field textarea");
    allFields.forEach(function (el) {
      if (readOnly) {
        el.setAttribute("readonly", "");
        el.style.pointerEvents = "none";
        el.style.background = "#f5f6f8";
      } else {
        el.removeAttribute("readonly");
        el.style.pointerEvents = "";
        el.style.background = "";
      }
    });

    // Submit button hidden when read-only or already submitted
    var submitBtn = $("#iar-submit");
    if (submitBtn) submitBtn.style.display = (readOnly || submitted) ? "none" : "";

    // New report button hidden when read-only
    var newReportBtn = $("#iar-new-report");
    if (newReportBtn) newReportBtn.style.display = (readOnly || !submitted) ? "none" : "";

    // Print button always visible
    var printBtn = $("#iar-print");
    if (printBtn) printBtn.style.display = "";
  }

  /* ---- Wire events ---- */
  function wire() {
    // Form field changes -> auto-save
    $$(".iar-field input, .iar-field select, .iar-field textarea").forEach(function (el) {
      el.addEventListener("input", function () {
        readForm();
        persist();
        if (el.id === "iar-medicalNeeded") {
          toggleMedicalDetails();
          resize();
        }
      });
      el.addEventListener("change", function () {
        readForm();
        persist();
        if (el.id === "iar-medicalNeeded") {
          toggleMedicalDetails();
          resize();
        }
      });
    });

    // Submit button
    var submitBtn = $("#iar-submit");
    if (submitBtn) {
      submitBtn.addEventListener("click", function () {
        readForm();
        if (!DB.reporterName || !DB.reporterName.trim()) {
          notify("Please enter your name.", "warning");
          return;
        }
        if (!DB.type) {
          notify("Please select the type of incident.", "warning");
          return;
        }
        if (!DB.description || !DB.description.trim()) {
          notify("Please describe what happened.", "warning");
          return;
        }
        DB.submittedAt = new Date().toISOString();
        submitted = true;
        persistNow();
        updateSubmittedState();
        notify("Your report has been recorded.", "success");
        resize();
      });
    }

    // Print button
    var printBtn = $("#iar-print");
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        window.print();
      });
    }

    // New report button
    var newBtn = $("#iar-new-report");
    if (newBtn) {
      newBtn.addEventListener("click", function () {
        DB = defaultDB();
        submitted = false;
        writeForm();
        persistNow();
        applyReadonly();
        notify("New report form ready.", "info");
        resize();
      });
    }
  }

  /* ---- Init ---- */
  function init(savedValue, allFields) {
    ROOT = document.querySelector(".iar");
    if (!ROOT) return;

    // Load saved data
    if (savedValue && typeof savedValue === "object" && savedValue.type !== undefined) {
      DB = savedValue;
      // Ensure followUp object exists
      if (!DB.followUp || typeof DB.followUp !== "object") {
        DB.followUp = { actionsTaken: "", investigationNotes: "", resolved: false, supervisorName: "", followUpDate: "" };
      }
    } else {
      DB = defaultDB();
    }

    // Check if already submitted
    submitted = !!DB.submittedAt;

    // Auto-fill report date if empty
    if (!DB.reportDate) DB.reportDate = todayISO();

    // Auto-fill reporter name from user
    if (!DB.reporterName && currentUser && currentUser.name) {
      DB.reporterName = currentUser.name;
    }

    writeForm();
    wire();
    applyReadonly();
    updateValidity();

    // Declare output schema
    try {
      tool.declareOutput({
        type: "object",
        properties: {
          type: { type: "string", description: "Type of incident" },
          incidentDate: { type: "string", description: "Date of incident" },
          incidentTime: { type: "string", description: "Time of incident" },
          location: { type: "string", description: "Location" },
          description: { type: "string", description: "Description" },
          peopleInvolved: { type: "string", description: "People involved or witnesses" },
          firstAidGiven: { type: "boolean" },
          medicalNeeded: { type: "boolean" },
          medicalDetails: { type: "string" },
          reporterName: { type: "string" },
          supervisorName: { type: "string" },
          reportDate: { type: "string" },
          followUp: {
            type: "object",
            properties: {
              actionsTaken: { type: "string" },
              investigationNotes: { type: "string" },
              resolved: { type: "boolean" },
              supervisorName: { type: "string" },
              followUpDate: { type: "string" }
            }
          },
          submittedAt: { type: "string" }
        }
      });
    } catch (e) {}

    resize();
  }

  /* ---- SDK Entry ---- */
  tool.onReady(function (savedValue, allFields) {
    // Capture user
    try { currentUser = tool.getUser(); } catch (e) {}
    try { readOnly = tool.isReadOnly(); } catch (e) {}

    init(savedValue, allFields);

    // Listen for read-only changes
    try {
      tool.onReadonlyChange(function (ro) {
        readOnly = ro;
        applyReadonly();
        resize();
      });
    } catch (e) {}

    // Listen for external value changes
    try {
      tool.onValueChange(function (newVal) {
        if (newVal && typeof newVal === "object" && newVal.type !== undefined) {
          DB = newVal;
          if (!DB.followUp || typeof DB.followUp !== "object") {
            DB.followUp = { actionsTaken: "", investigationNotes: "", resolved: false, supervisorName: "", followUpDate: "" };
          }
          submitted = !!DB.submittedAt;
          writeForm();
          applyReadonly();
          resize();
        }
      });
    } catch (e) {}

    // Listen for user changes
    try {
      tool.onUserChange(function (user) {
        currentUser = user;
        if (user && user.name && !DB.reporterName) {
          DB.reporterName = user.name;
          writeForm();
          persistNow();
        }
      });
    } catch (e) {}
  });

})();
