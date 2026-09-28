/* ============================================================
   Employee Data Collection — JS
   HR & Finance data + document collection for payroll onboarding.
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
      declareParams: function () {},
      reportMissingParams: function () {},
      getPermittedUsers: function () { return []; },
      onPermittedUsersChange: function () {},
      openUrl: function (url) { try { window.open(url, "_blank"); } catch (e) {} }
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
  var DOC_ID_COUNTER = 0;

  /* ---- Default data ---- */
  function defaultDB() {
    return {
      personal: {
        fullName: "",
        sin: "",
        dob: "",
        startDate: ""
      },
      contact: {
        address: "",
        city: "",
        province: "",
        postalCode: "",
        country: "Canada",
        phone: "",
        email: "",
        emergencyContact: "",
        emergencyPhone: ""
      },
      banking: {
        bankName: "",
        transitNumber: "",
        institutionNumber: "",
        accountNumber: ""
      },
      documents: {
        photoId: null,
        templateDocs: {},
        personalAgreements: [],
        otherDocs: []
      },
      customFields: {}
    };
  }

  /* ---- Helpers ---- */
  function $(s, r) { return (r || ROOT).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || ROOT).querySelectorAll(s)); }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function notify(msg, sev) { try { tool.notify(msg, sev || "success"); } catch (e) {} }
  function resize() { try { tool.resize(); } catch (e) {} }
  function openUrl(url) { try { tool.openUrl(url); } catch (e) { try { window.open(url, "_blank"); } catch (e2) {} } }
  function fmtSize(bytes) {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }
  function fmtDate(iso) {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
    catch (e) { return iso; }
  }
  function genDocId() { DOC_ID_COUNTER++; return "doc-" + Date.now() + "-" + DOC_ID_COUNTER; }
  function nowISO() { return new Date().toISOString(); }

  /* ---- Params: read configurable values ---- */
  function paramStr(name, fallback) {
    try { var v = tool.param(name, fallback); return (v === null || v === undefined || v === "") ? fallback : String(v); }
    catch (e) { return fallback; }
  }

  function getCompanyName() { return paramStr("companyName", "Our Company"); }
  function getDeveloperSubdomain() { return paramStr("developerSubdomain", "uniconhub"); }

  function getCustomFields() {
    var raw = paramStr("customFields", "");
    if (!raw.trim()) return [];
    return raw.split(",").map(function (item, i) {
      var parts = item.trim().split("|");
      return {
        id: "custom-" + i,
        label: (parts[0] || "").trim(),
        type: (parts[1] || "text").trim(),
        placeholder: (parts[2] || "").trim(),
        required: (parts[3] || "").trim().toLowerCase() === "required"
      };
    }).filter(function (d) { return d.label; });
  }

  function getSINLabel() { return paramStr("sinLabel", "SIN / SSN"); }

  /* ---- Document Templates (config-driven, JSON array) ---- */
  var BUILTIN_TEMPLATES = [
    { name: "Direct Deposit Form / Void Cheque", templateUrl: "#", accept: ".pdf,.jpg,.jpeg,.png", required: true, category: "Banking" },
    { name: "TD1 - Federal", templateUrl: "#", accept: ".pdf", required: true, category: "Tax Forms" },
    { name: "TD1 - BC", templateUrl: "#", accept: ".pdf", required: true, category: "Tax Forms" },
    { name: "Youth Training Acknowledgement Form", templateUrl: "#", accept: ".pdf", required: true, category: "HR Forms" },
    { name: "Confidentiality Agreement", templateUrl: "#", accept: ".pdf", required: true, category: "HR Forms" },
    { name: "Employee Information Sheet", templateUrl: "#", accept: ".pdf", required: true, category: "HR Forms" },
    { name: "Canada Summer Jobs - Employee Consent Form (EMP5616)", templateUrl: "#", accept: ".pdf", required: true, category: "HR Forms" },
    { name: "Media Release Form", templateUrl: "#", accept: ".pdf", required: false, category: "HR Forms" }
  ];

  function parseDocumentTemplates(raw) {
    if (!raw || raw === "" || raw === "[]") return null;
    // CMS may return already-parsed array or a JSON string
    if (Array.isArray(raw)) return raw.length > 0 ? raw : null;
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function getDocumentTemplates() {
    var raw = tool.param("documentTemplates", null);
    var parsed = parseDocumentTemplates(raw);
    var source = parsed || BUILTIN_TEMPLATES;
    return source.map(function (item, i) {
      return {
        id: "dt-" + i,
        name: item.name || "",
        templateUrl: item.templateUrl || "#",
        accept: item.accept || ".pdf,.jpg,.jpeg,.png",
        required: item.required !== false,
        category: item.category || "Other"
      };
    }).filter(function (d) { return d.name; });
  }
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
    var el = $("#pec-savedAt");
    if (el) el.textContent = "Saved " + new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  /* ---- Read data from DOM into DB ---- */
  function readForm() {
    DB.personal.fullName = val("#pec-fullName");
    DB.personal.sin = val("#pec-sin");
    DB.personal.dob = val("#pec-dob");
    DB.personal.startDate = val("#pec-startDate");

    DB.contact.address = val("#pec-address");
    DB.contact.city = val("#pec-city");
    DB.contact.province = val("#pec-province");
    DB.contact.postalCode = val("#pec-postalCode");
    DB.contact.country = val("#pec-country");
    DB.contact.phone = val("#pec-phone");
    DB.contact.email = val("#pec-email");
    DB.contact.emergencyContact = val("#pec-emergencyContact");
    DB.contact.emergencyPhone = val("#pec-emergencyPhone");

    DB.banking.bankName = val("#pec-bankName");
    DB.banking.transitNumber = val("#pec-transitNumber");
    DB.banking.institutionNumber = val("#pec-institutionNumber");
    DB.banking.accountNumber = val("#pec-accountNumber");

    // Collect custom field values
    var customFields = getCustomFields();
    customFields.forEach(function (cf) {
      var el = $("#pec-custom-" + cf.id);
      if (el) {
        if (!DB.customFields) DB.customFields = {};
        DB.customFields[cf.id] = (cf.type === "toggle") ? el.checked : el.value;
      }
    });
  }

  function val(sel) {
    var el = $(sel);
    if (!el) return "";
    if (el.type === "checkbox") return el.checked;
    return el.value;
  }

  /* ---- Write DB to DOM ---- */
  function writeForm() {
    setVal("#pec-fullName", DB.personal.fullName);
    setVal("#pec-sin", DB.personal.sin);
    setVal("#pec-dob", DB.personal.dob);
    setVal("#pec-startDate", DB.personal.startDate);

    setVal("#pec-address", DB.contact.address);
    setVal("#pec-city", DB.contact.city);
    setVal("#pec-province", DB.contact.province);
    setVal("#pec-postalCode", DB.contact.postalCode);
    setVal("#pec-country", DB.contact.country || "Canada");
    setVal("#pec-phone", DB.contact.phone);
    setVal("#pec-email", DB.contact.email);
    setVal("#pec-emergencyContact", DB.contact.emergencyContact);
    setVal("#pec-emergencyPhone", DB.contact.emergencyPhone);

    setVal("#pec-bankName", DB.banking.bankName);
    setVal("#pec-transitNumber", DB.banking.transitNumber);
    setVal("#pec-institutionNumber", DB.banking.institutionNumber);
    setVal("#pec-accountNumber", DB.banking.accountNumber);

    // Custom fields
    var customFields = getCustomFields();
    customFields.forEach(function (cf) {
      var el = $("#pec-custom-" + cf.id);
      if (el) {
        if (!DB.customFields) DB.customFields = {};
        if (cf.type === "toggle") {
          el.checked = !!DB.customFields[cf.id];
        } else {
          el.value = DB.customFields[cf.id] || "";
        }
      }
    });

    // Render documents & agreements
    renderPhotoIdStatus();
    renderDocumentTemplates();
    renderPersonalAgreements();
    renderOtherDocs();
    renderStatusBanner();
    updateProgress();
    updateSINLabel();
    updateSectionBadges();

    // Employee ident (from user info)
    updateEmployeeIdent();


  }

  function setVal(sel, v) {
    var el = $(sel);
    if (!el) return;
    if (el.type === "checkbox") { el.checked = !!v; return; }
    el.value = v != null ? v : "";
  }

  function updateSINLabel() {
    var lbl = getSINLabel();
    var el = document.querySelector('label[for="pec-sin"]');
    if (el) {
      var star = el.querySelector('.pec-required-star');
      el.textContent = lbl + ' ';
      if (star) el.appendChild(star); else { var s = document.createElement('span'); s.className = 'pec-required-star'; s.textContent = '*'; el.appendChild(s); }
    }
  }

  function updateEmployeeIdent() {
    var el = $("#pec-employeeIdent");
    if (!el) return;
    var user = currentUser || tool.getUser() || {};
    var name = user.name || user.email || "Employee";
    el.textContent = "Employee: " + name;
  }

  /* ---- Progress calculation ---- */
  function updateProgress() {
    var total = 0;
    var done = 0;

    // Personal info: 4 critical fields + photo ID
    total += 5;
    if (DB.personal.fullName.trim()) done++;
    if (DB.personal.sin.trim()) done++;
    if (DB.personal.dob) done++;
    if (DB.personal.startDate) done++;
    if (DB.documents.photoId && DB.documents.photoId.url) done++;

    // Contact: 5 critical
    total += 5;
    if (DB.contact.address.trim()) done++;
    if (DB.contact.city.trim()) done++;
    if (DB.contact.phone.trim()) done++;
    if (DB.contact.email.trim()) done++;
    if (DB.contact.emergencyContact.trim()) done++;

    // Banking: bank info or void cheque uploaded
    total += 1;
    if ((DB.banking.bankName.trim() && DB.banking.accountNumber.trim()) ||
        (DB.documents.templateDocs && DB.documents.templateDocs["dt-0"] && DB.documents.templateDocs["dt-0"].url)) done++;

    // Document templates (only required ones)
    var templates = getDocumentTemplates();
    templates.forEach(function (dt) {
      if (dt.required) {
        total += 1;
        var uploaded = DB.documents.templateDocs && DB.documents.templateDocs[dt.id] && DB.documents.templateDocs[dt.id].url;
        if (uploaded) done++;
      }
    });

    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    var fill = $("#pec-progressFill");
    var label = $("#pec-progressLabel");
    if (fill) fill.style.width = pct + "%";
    if (label) label.textContent = pct + "% complete";
  }

  /* ---- Per-section completion badges ---- */
  function sectionComplete(key) {
    var td = DB.documents.templateDocs || {};
    function hasDoc(id) { return td[id] && td[id].url; }
    switch (key) {
      case "personal":
        return !!(DB.personal.fullName.trim() &&
                  DB.personal.sin.trim() &&
                  DB.personal.dob &&
                  DB.personal.startDate &&
                  DB.documents.photoId && DB.documents.photoId.url);
      case "contact":
        return !!(DB.contact.address.trim() &&
                  DB.contact.city.trim() &&
                  DB.contact.province.trim() &&
                  DB.contact.phone.trim() &&
                  DB.contact.email.trim() &&
                  DB.contact.emergencyContact.trim() &&
                  DB.contact.emergencyPhone.trim());
      case "banking":
        var bankFilled = !!(DB.banking.bankName.trim() &&
                            DB.banking.transitNumber.trim() &&
                            DB.banking.institutionNumber.trim() &&
                            DB.banking.accountNumber.trim());
        var ddTemplateUploaded = getDocumentTemplates().some(function (t) {
          return (t.category === "Banking" || t.name.indexOf("Direct Deposit") > -1) && hasDoc(t.id);
        });
        return bankFilled || ddTemplateUploaded;
      case "documents":
        var required = getDocumentTemplates().filter(function (t) { return t.required; });
        if (required.length === 0) return true;
        return required.every(function (t) { return hasDoc(t.id); });
      case "custom":
        var reqCustom = getCustomFields().filter(function (f) { return f.required; });
        if (reqCustom.length === 0) return true;
        return reqCustom.every(function (f) {
          var v = DB.customFields ? DB.customFields[f.id] : undefined;
          return v !== undefined && v !== null && v !== "" && v !== false;
        });
      default:
        return true;
    }
  }

  function updateSectionBadges() {
    var badges = $$(".pec-section-status");
    badges.forEach(function (b) {
      var key = b.getAttribute("data-section");
      if (key === "custom") {
        var section = $("#sec-customFields");
        var hidden = section && (section.style.display === "none" || section.offsetParent === null);
        if (hidden) { b.style.display = "none"; return; }
        b.style.display = "";
      }
      var ok = sectionComplete(key);
      b.className = "pec-section-status " + (ok ? "complete" : "incomplete");
      b.textContent = ok ? "✓ Complete" : "Incomplete";
    });
  }

  /* ---- Status banner ---- */
  function renderStatusBanner() {
    var banner = $("#pec-statusBanner");
    var icon = $("#pec-statusIcon");
    var text = $("#pec-statusText");
    if (!banner) return;

    var missing = collectMissingRequired();
    if (missing.length > 0) {
      banner.style.display = "";
      banner.className = "pec-status-banner draft";
      if (icon) icon.textContent = "📝";
      if (text) text.textContent = "Incomplete — " + missing.length + " required item(s) remaining. Changes are saved automatically.";
    } else {
      banner.style.display = "";
      banner.className = "pec-status-banner submitted";
      if (icon) icon.textContent = "✅";
      if (text) text.textContent = "All required information provided. Changes are saved automatically.";
    }
  }

  /* ---- Validation ---- */
  function collectMissingRequired() {
    var missing = [];

    if (!DB.personal.fullName.trim()) missing.push("Full Legal Name");
    if (!DB.personal.sin.trim()) missing.push(getSINLabel());
    if (!DB.personal.dob) missing.push("Date of Birth");
    if (!DB.personal.startDate) missing.push("Start Date");
    if (!DB.documents.photoId || !DB.documents.photoId.url) missing.push("Photo ID (government-issued)");
    if (!DB.contact.address.trim()) missing.push("Street Address");
    if (!DB.contact.city.trim()) missing.push("City");
    if (!DB.contact.phone.trim()) missing.push("Phone Number");
    if (!DB.contact.email.trim()) missing.push("Email Address");
    if (!DB.contact.emergencyContact.trim()) missing.push("Emergency Contact Name");
    var reqDocs = getDocumentTemplates();
    reqDocs.forEach(function (dt) {
      if (dt.required) {
        var uploaded = DB.documents.templateDocs && DB.documents.templateDocs[dt.id] && DB.documents.templateDocs[dt.id].url;
        if (!uploaded) missing.push(dt.name);
      }
    });

    return missing;
  }

  function updateValidity() {
    var missing = collectMissingRequired();
    if (missing.length > 0) {
      try { tool.reportValid(false, "Missing required: " + missing.join(", ")); } catch (e) {}
    } else {
      try { tool.reportValid(true, ""); } catch (e) {}
    }
  }

  /* ---- Read-only mode ---- */
  function applyReadonly() {
    ROOT.setAttribute("data-readonly", readOnly ? "true" : "false");

    var allInputs = $$(".pec-field input, .pec-field select, .pec-field textarea");
    allInputs.forEach(function (el) {
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

    // Upload buttons visibility
    var uploadBtns = $$(".pec-btn-outline.pec-btn-sm, .pec-check-upload");
    uploadBtns.forEach(function (b) {
      b.style.display = readOnly ? "none" : "";
    });
  }

  /* ── Document Rendering ── */

  function renderPhotoIdStatus() {
    var row = $("#pec-photoIdRow");
    if (!row) return;
    var doc = DB.documents.photoId;
    var isUploaded = !!(doc && doc.url);

    row.className = "pec-template-row " + (isUploaded ? "uploaded" : "pending");

    var icon = $("#pec-photoIdIcon");
    if (icon) {
      icon.className = "pec-check-icon " + (isUploaded ? "done" : "todo");
      icon.textContent = isUploaded ? "✓" : "!";
    }

    var status = $("#pec-photoIdStatus");
    if (status) {
      if (isUploaded) {
        status.className = "pec-template-status-ok";
        status.innerHTML = '<span class="pec-status-pill ok">Uploaded</span> ' + esc(doc.name) + ' (' + fmtSize(doc.size) + ')';
      } else {
        status.className = "pec-template-status-pending";
        status.innerHTML = '<span class="pec-status-pill wait">Pending upload</span>';
      }
    }

    var uploadBtn = $("#pec-uploadPhotoId");
    var viewBtn = $("#pec-photoIdView");
    var removeBtn = $("#pec-photoIdRemove");
    if (uploadBtn) uploadBtn.style.display = (!readOnly && !isUploaded) ? "" : "none";
    if (viewBtn) {
      viewBtn.style.display = (!readOnly && isUploaded) ? "" : "none";
      if (doc && doc.url) viewBtn.setAttribute("data-open-url", doc.url);
    }
    if (removeBtn) removeBtn.style.display = (!readOnly && isUploaded) ? "" : "none";
  }

  /* ── Document Templates (config-driven) ── */
  function renderDocumentTemplates() {
    var container = $("#pec-docTemplates");
    if (!container) return;
    var templates = getDocumentTemplates();
    if (templates.length === 0) {
      container.innerHTML = '<p class="pec-empty-msg">No document templates configured.</p>';
      return;
    }

    // Group by category
    var categories = {};
    templates.forEach(function (dt) {
      var cat = dt.category || "Other";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(dt);
    });

    var html = "";
    Object.keys(categories).forEach(function (cat) {
      html += '<h3 class="pec-subtitle">' + esc(cat) + '</h3>';
      html += '<div class="pec-doc-templates-group">';
      categories[cat].forEach(function (dt) {
        var uploadedDoc = DB.documents.templateDocs && DB.documents.templateDocs[dt.id];
        var isUploaded = uploadedDoc && uploadedDoc.url;

        html += '<div class="pec-template-row ' + (isUploaded ? 'uploaded' : 'pending') + '">';
        html += '<div class="pec-template-icon">';
        html += isUploaded
          ? '<span class="pec-check-icon done">✓</span>'
          : '<span class="pec-check-icon todo">!</span>';
        html += '</div>';
        html += '<div class="pec-template-info">';
        html += '<div class="pec-template-name">' + esc(dt.name);
        if (dt.required) html += ' <span class="pec-required-star">*</span>';
        html += '</div>';
        if (isUploaded) {
          html += '<div class="pec-template-status-ok"><span class="pec-status-pill ok">Uploaded</span> ' + esc(uploadedDoc.name) + ' (' + fmtSize(uploadedDoc.size) + ')</div>';
        } else {
          html += '<div class="pec-template-status-pending"><span class="pec-status-pill wait">Pending upload</span></div>';
        }
        html += '</div>';
        if (!readOnly) {
          var hasTemplate = dt.templateUrl && dt.templateUrl !== "#";
          html += '<div class="pec-template-actions">';
          if (hasTemplate) {
            html += '<button class="pec-template-btn download" data-open-url="' + esc(dt.templateUrl) + '" title="Download empty template">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
              'Template</button>';
          }
          if (isUploaded) {
            html += '<button class="pec-template-btn view" data-open-url="' + esc(uploadedDoc.url) + '" title="Download filled / uploaded document">View</button>';
            html += '<button class="pec-template-btn remove" data-remove-template="' + esc(dt.id) + '" title="Remove uploaded document">✕</button>';
          } else {
            html += '<button class="pec-template-btn upload" data-upload-template="' + esc(dt.id) + '" data-accept="' + esc(dt.accept) + '">Upload</button>';
          }
          html += '</div>';
        }
        html += '</div>';
      });
      html += '</div>';
    });

    container.innerHTML = html;
  }

  function renderDocCard(doc, category, agreementId) {
    var html = '<div class="pec-doc-card">';
    html += '<div class="pec-doc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>';
    html += '<div class="pec-doc-info">';
    html += '<div class="pec-doc-name">' + esc(doc.name) + '</div>';
    html += '<div class="pec-doc-meta">' + fmtSize(doc.size) + ' &middot; ' + fmtDate(doc.uploadedAt) + '</div>';
    html += '</div>';
    html += '<span class="pec-doc-status ' + (doc.signed ? 'signed' : 'uploaded') + '">' + (doc.signed ? 'Signed' : 'Uploaded') + '</span>';
    html += '<div class="pec-doc-actions">';
    if (!readOnly) {
      html += '<button class="pec-doc-btn" data-open-url="' + esc(doc.url) + '">View</button>';
      if (category === "personalAgreements") {
        html += '<button class="pec-doc-btn sign" data-sign-agreement="' + esc(doc.id) + '">Mark Signed</button>';
      }
      html += '<button class="pec-doc-btn danger" data-remove-doc="' + esc(doc.id) + '" data-category="' + esc(category) + '">✕</button>';
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderPersonalAgreements() {
    var container = $("#pec-personalAgreements");
    if (!container) return;
    var docs = DB.documents.personalAgreements || [];
    if (docs.length === 0) {
      container.innerHTML = '<p class="pec-empty-msg">No person-specific agreements assigned yet.</p>';
    } else {
      container.innerHTML = docs.map(function (d) { return renderDocCard(d, "personalAgreements"); }).join("");
    }
  }

  function renderOtherDocs() {
    var container = $("#pec-otherDocs");
    if (!container) return;
    var docs = DB.documents.otherDocs || [];
    if (docs.length === 0) {
      container.innerHTML = '<p class="pec-empty-msg">No additional documents uploaded.</p>';
    } else {
      container.innerHTML = docs.map(function (d) { return renderDocCard(d, "otherDocs"); }).join("");
    }
  }

  function renderCustomFields() {
    var section = $("#sec-customFields");
    var grid = $("#pec-customFieldsGrid");
    if (!section || !grid) return;
    var fields = getCustomFields();
    if (fields.length === 0) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";

    var html = "";
    fields.forEach(function (cf) {
      html += '<div class="pec-field">';
      html += '<label for="pec-custom-' + cf.id + '">' + esc(cf.label) + (cf.required ? ' <span class="pec-required-star">*</span>' : '') + '</label>';
      if (cf.type === "toggle") {
        html += '<label style="display:flex;align-items:center;gap:8px;padding:8px 0;cursor:pointer">';
        html += '<input type="checkbox" id="pec-custom-' + cf.id + '" style="width:auto">';
        html += '<span style="font-size:13px">' + esc(cf.placeholder || "Yes") + '</span>';
        html += '</label>';
      } else if (cf.type === "select") {
        var opts = (cf.placeholder || "").split(";");
        html += '<select id="pec-custom-' + cf.id + '">';
        html += '<option value="">-- Select --</option>';
        opts.forEach(function (o) { html += '<option value="' + esc(o.trim()) + '">' + esc(o.trim()) + '</option>'; });
        html += '</select>';
      } else if (cf.type === "number") {
        html += '<input type="number" id="pec-custom-' + cf.id + '" placeholder="' + esc(cf.placeholder || "") + '">';
      } else {
        html += '<input type="text" id="pec-custom-' + cf.id + '" placeholder="' + esc(cf.placeholder || "") + '">';
      }
      html += '</div>';
    });
    grid.innerHTML = html;
  }

  /* ── Upload Helpers ── */

  /* Friendly file naming: "Person Full Name - Document Label.ext" */
  function currentEmployeeName() {
    var n = (DB && DB.personal && DB.personal.fullName) ? DB.personal.fullName.trim() : "";
    if (!n) {
      try {
        var u = tool.getUser();
        if (u && u.name) n = u.name;
      } catch (e) {}
    }
    return n || "Employee";
  }

  function friendlyFileName(label, originalName) {
    var person = String(currentEmployeeName())
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 .'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    var cleanLabel = String(label || "Document")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    var ext = "";
    if (originalName && originalName.indexOf(".") > -1) {
      var parts = originalName.split(".");
      var cand = parts.pop();
      if (cand && /^[a-zA-Z0-9]{1,6}$/.test(cand)) ext = "." + cand.toLowerCase();
    }
    return (person + " - " + cleanLabel + ext).substring(0, 180);
  }

  function doUpload(accept, callback) {
    if (typeof tool.requestUpload !== "function") {
      notify("File upload is not available. The CMS admin must enable allowUpload in tool params.", "warning");
      if (callback) callback("Upload not available", null);
      return;
    }
    tool.requestUpload(accept, function (err, file) {
      if (err) {
        notify("Upload failed: " + err, "error");
        if (callback) callback(err, null);
        return;
      }
      if (callback) callback(null, file);
    });
  }

  function uploadAndStorePhotoId() {
    doUpload(".jpg,.jpeg,.png,.pdf", function (err, file) {
      if (err) return;
      var friendly = friendlyFileName("Photo ID", file.name);
      DB.documents.photoId = {
        id: genDocId(),
        name: friendly,
        originalName: file.name,
        url: file.url,
        size: file.size,
        type: file.type,
        uploadedAt: nowISO()
      };
      readForm();
      persist();
      writeForm();
      notify("Photo ID uploaded: " + friendly, "success");
      resize();
    });
  }

  function uploadTemplateDoc(templateId, accept) {
    doUpload(accept, function (err, file) {
      if (err) return;
      var label = "Document";
      getDocumentTemplates().forEach(function (t) {
        if (t.id === templateId) label = t.name;
      });
      var friendly = friendlyFileName(label, file.name);
      if (!DB.documents.templateDocs) DB.documents.templateDocs = {};
      DB.documents.templateDocs[templateId] = {
        id: genDocId(),
        name: friendly,
        originalName: file.name,
        url: file.url,
        size: file.size,
        type: file.type,
        uploadedAt: nowISO()
      };
      persist();
      writeForm();
      notify("Document uploaded: " + friendly, "success");
      resize();
    });
  }

  function uploadPersonalAgreementDoc() {
    doUpload(".pdf,.docx,.jpg,.jpeg,.png", function (err, file) {
      if (err) return;
      var friendly = friendlyFileName("Personal Agreement", file.name);
      var docEntry = {
        id: genDocId(),
        name: friendly,
        originalName: file.name,
        url: file.url,
        size: file.size,
        type: file.type,
        signed: false,
        uploadedAt: nowISO()
      };
      if (!DB.documents.personalAgreements) DB.documents.personalAgreements = [];
      DB.documents.personalAgreements.push(docEntry);
      persist();
      writeForm();
      notify("Agreement uploaded: " + friendly, "success");
      resize();
    });
  }

  function uploadOtherDocument() {
    doUpload(".pdf,.docx,.jpg,.jpeg,.png,.txt,.csv,.xlsx", function (err, file) {
      if (err) return;
      var friendly = friendlyFileName("Other Document", file.name);
      var docEntry = {
        id: genDocId(),
        name: friendly,
        originalName: file.name,
        url: file.url,
        size: file.size,
        type: file.type,
        uploadedAt: nowISO()
      };
      if (!DB.documents.otherDocs) DB.documents.otherDocs = [];
      DB.documents.otherDocs.push(docEntry);
      persist();
      writeForm();
      notify("Document uploaded: " + friendly, "success");
      resize();
    });
  }

  /* ── Event Wiring ── */

  function wire() {
    // Form fields auto-save
    $$(".pec-field input, .pec-field select, .pec-field textarea").forEach(function (el) {
      el.addEventListener("input", function () {
        readForm();
        persist();
        updateProgress();
        updateValidity();
      });
      el.addEventListener("change", function () {
        readForm();
        persist();
        updateProgress();
        updateValidity();
        resize();
      });
    });

    // Upload photo ID
    var photoIdBtn = $("#pec-uploadPhotoId");
    if (photoIdBtn) photoIdBtn.addEventListener("click", function () {
      uploadAndStorePhotoId();
    });

    // Upload personal agreement
    var persAgrBtn = $("#pec-uploadPersonalAgreement");
    if (persAgrBtn) persAgrBtn.addEventListener("click", function () {
      uploadPersonalAgreementDoc();
    });

    // Upload other doc
    var otherDocBtn = $("#pec-uploadOtherDoc");
    if (otherDocBtn) otherDocBtn.addEventListener("click", function () {
      uploadOtherDocument();
    });

    // Delegate events for dynamic elements (remove buttons, sign buttons, upload buttons)
    ROOT.addEventListener("click", function (e) {
      var target = e.target;

      // Open URL via parent CMS (avoids iframe sandbox popup blocking)
      if (target.hasAttribute && target.getAttribute("data-open-url")) {
        e.preventDefault();
        var urlToOpen = target.getAttribute("data-open-url");
        if (urlToOpen && urlToOpen !== "#") openUrl(urlToOpen);
        return;
      }

      // Remove photo ID
      if (target.hasAttribute && target.getAttribute("data-remove") === "photoId") {
        e.preventDefault();
        DB.documents.photoId = null;
        persist();
        writeForm();
        notify("Photo ID removed.", "info");
        resize();
        return;
      }

      // Remove void cheque / TD1 (legacy — keep for old saved data)
      if (target.hasAttribute && (target.getAttribute("data-remove") === "voidCheque" || target.getAttribute("data-remove") === "td1Federal" || target.getAttribute("data-remove") === "td1Provincial")) {
        e.preventDefault();
        var k = target.getAttribute("data-remove");
        DB.documents[k] = null;
        persist();
        writeForm();
        notify("Document removed.", "info");
        resize();
        return;
      }

      // Remove template doc
      if (target.hasAttribute && target.getAttribute("data-remove-template")) {
        e.preventDefault();
        var tmplId = target.getAttribute("data-remove-template");
        if (DB.documents.templateDocs) {
          delete DB.documents.templateDocs[tmplId];
        }
        persist();
        writeForm();
        notify("Document removed.", "info");
        resize();
        return;
      }

      // Upload template doc
      if (target.hasAttribute && target.getAttribute("data-upload-template")) {
        e.preventDefault();
        var tmplId2 = target.getAttribute("data-upload-template");
        var acc = target.getAttribute("data-accept") || ".pdf,.jpg,.jpeg,.png";
        uploadTemplateDoc(tmplId2, acc);
        return;
      }

      // Remove doc by id + category
      if (target.hasAttribute && target.getAttribute("data-remove-doc")) {
        e.preventDefault();
        var docId = target.getAttribute("data-remove-doc");
        var cat = target.getAttribute("data-category");
        if (DB.documents[cat]) {
          DB.documents[cat] = DB.documents[cat].filter(function (d) { return d.id !== docId; });
        }
        persist();
        writeForm();
        notify("Document removed.", "info");
        resize();
        return;
      }

      // Mark agreement signed
      if (target.hasAttribute && target.getAttribute("data-sign-agreement")) {
        e.preventDefault();
        var signId = target.getAttribute("data-sign-agreement");
        var allCats = ["personalAgreements", "otherDocs"];
        allCats.forEach(function (cat) {
          if (DB.documents[cat]) {
            DB.documents[cat].forEach(function (d) {
              if (d.id === signId) d.signed = true;
            });
          }
        });
        persist();
        writeForm();
        notify("Agreement marked as signed.", "success");
        resize();
        return;
      }
    });
  }

  /* ── Init ── */

  function init(savedValue, allFields) {
    ROOT = document.querySelector(".pec");
    if (!ROOT) return;

    // Load saved data
    if (savedValue && typeof savedValue === "object" && savedValue.personal !== undefined) {
      DB = savedValue;
      // Ensure all nested objects exist
      DB.personal = DB.personal || {};
      DB.contact = DB.contact || {};
      DB.banking = DB.banking || {};
      DB.documents = DB.documents || {};
      DB.documents.photoId = DB.documents.photoId || null;
      DB.documents.templateDocs = DB.documents.templateDocs || {};
      DB.documents.personalAgreements = DB.documents.personalAgreements || [];
      DB.documents.otherDocs = DB.documents.otherDocs || [];
      DB.customFields = DB.customFields || {};
    } else {
      DB = defaultDB();
      // Pre-fill with user info if available
      var user = tool.getUser();
      if (user && user.name) {
        DB.personal.fullName = user.name || "";
        DB.contact.email = user.email || "";
      }
    }

    // Read-only check
    readOnly = !!tool.isReadOnly();

    // Render custom fields from params
    renderCustomFields();

    // Write form
    writeForm();
    applyReadonly();
    wire();

    // SDK listeners
    tool.onValueChange(function (v) {
      if (v && typeof v === "object" && v.personal !== undefined) {
        DB = v;
        // Re-ensure nested objects
        DB.personal = DB.personal || {};
        DB.contact = DB.contact || {};
        DB.banking = DB.banking || {};
        DB.documents = DB.documents || {};
        DB.documents.photoId = DB.documents.photoId || null;
        DB.documents.templateDocs = DB.documents.templateDocs || {};
        DB.documents.personalAgreements = DB.documents.personalAgreements || [];
        DB.documents.otherDocs = DB.documents.otherDocs || [];
        DB.customFields = DB.customFields || {};
        writeForm();
        applyReadonly();
      }
    });

    tool.onReadonlyChange(function (ro) {
      readOnly = !!ro;
      applyReadonly();
    });

    tool.onUserChange(function (u) {
      currentUser = u;
      updateEmployeeIdent();
      if (!DB.personal.fullName && u && u.name) {
        DB.personal.fullName = u.name;
        DB.contact.email = u.email || "";
        writeForm();
        persist();
      }
    });

    // Update validity after initial render
    updateValidity();

    // Declare schema & params
    try {
      tool.declareOutput({
        type: "object",
        properties: {
          personal: { type: "object" },
          contact: { type: "object" },
          banking: { type: "object" },
          documents: { type: "object" },
          customFields: { type: "object" }
        }
      });

      tool.declareParams([
        { name: "documentTemplates", label: "Document Templates", type: "text", default: "[]", severity: "mandatory", hint: "JSON array of blank forms employees must download, sign, and upload. Each entry: { name, templateUrl, accept, required, category }. Categories group documents visually in the UI. Example: [{ \"name\": \"Direct Deposit Form\", \"templateUrl\": \"https://cdn.example.com/dd.pdf\", \"accept\": \".pdf\", \"required\": true, \"category\": \"Banking\" }, { \"name\": \"TD1 - Federal\", \"templateUrl\": \"https://cdn.example.com/td1f.pdf\", \"accept\": \".pdf\", \"required\": true, \"category\": \"Tax Forms\" }]. Add this in CMS → html-tool field settings → Tool Parameters → key: documentTemplates, value: the JSON array." },
        { name: "sinLabel", label: "SIN / SSN Label", type: "text", default: "SIN / SSN", severity: "optional", hint: "Override the label for the social insurance / security number field. Defaults to 'SIN / SSN' if not set." },
        { name: "customFields", label: "Custom Fields", type: "text", default: "", severity: "optional", hint: "Extra form fields to collect. Format per field: Label|type|placeholder|required. Types: text, number, select (options separated by ;), toggle. Fields are comma-separated. Example: Dietary Restrictions|text|e.g. vegetarian, halal|, Needs Parking Pass|toggle|Yes|, Office Location|select|Vancouver;Toronto;Montreal|required" }
      ]);
    } catch (e) {}

    // Report missing mandatory params with clear guidance
    try {
      var missing = [];
      var dtRaw = tool.param("documentTemplates", null);
      var dtParsed = parseDocumentTemplates(dtRaw);
      if (!dtParsed) {
        missing.push({
          name: "documentTemplates",
          label: "Document Templates",
          type: "text",
          default: "[]",
          severity: "mandatory",
          hint: "JSON array of { name, templateUrl, accept, required, category }. Add in html-tool field settings → Tool Parameters.",
          reason: "Document templates define which blank forms employees can download and upload. Configure as a JSON array with your organization's form URLs."
        });
      }
      if (missing.length > 0) {
        tool.reportMissingParams(missing,
          "This tool needs the Document Templates parameter configured with your organization's form URLs.");
      }
    } catch (e) {}
  }

  /* ── Boot ── */
  tool.onReady(function (savedValue, allFields) {
    init(savedValue, allFields);
  });

})();