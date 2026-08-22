"""Build test-harness.html by embedding the HTML body inline to avoid CORS."""
import os

DIR = os.path.dirname(os.path.abspath(__file__))

# Read the HTML body content
with open(os.path.join(DIR, "EmployeeDataCollection.html"), "r", encoding="utf-8") as f:
    html_content = f.read().strip()

# Escape for JS single-quoted string with backslash line continuations
lines = html_content.split("\n")
escaped_lines = []
for line in lines:
    e = line.replace("\\", "\\\\").replace("'", "\\'")
    escaped_lines.append(e)

embedded = "var EMBEDDED_HTML = '" + "\\\n".join(escaped_lines) + "';"

harness = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Employee Data Collection - Test Harness</title>
<link rel="stylesheet" href="EmployeeDataCollection.css">
<style>
body { padding-top: 34px !important; margin: 0; }
#app { min-height: calc(100vh - 34px); }
#th-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 9998; background: #0f172a; color: #e6edf5; font-family: system-ui; font-size: 11px; padding: 4px 14px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
#th-bar strong { color: #2dd4bf; letter-spacing: 0.5px; }
#th-bar .sep { color: #475569; }
#th-bar button { border: none; padding: 3px 10px; border-radius: 4px; cursor: pointer; font-size: 10px; font-family: system-ui; font-weight: 600; }
#th-bar .btn-load { background: #0d9488; color: #fff; }
#th-bar .btn-clear { background: #dc2626; color: #fff; }
#th-bar .btn-reload { background: #16a34a; color: #fff; }
#th-bar .btn-toggle-ro { background: #d97706; color: #fff; }
#th-bar .hint { color: #64748b; font-size: 10px; }
</style>
</head>
<body>
<div id="th-bar">
  <strong>TEST HARNESS - Employee Data Collection</strong><span class="sep">|</span>
  <button class="btn-load" id="th-load-sample">Load Sample Data</button>
  <button class="btn-clear" id="th-clear">Clear All</button>
  <button class="btn-reload" id="th-reload">Reload</button>
  <button class="btn-toggle-ro" id="th-ro">Toggle Read-Only</button>
  <span class="sep">|</span>
  <span class="hint">Ctrl+Shift+R = Toggle Read-Only</span>
  <span class="sep">|</span>
  <span class="hint">Ctrl+Shift+D = Dump DB to Console</span>
  <span class="sep">|</span>
  <span id="th-status" class="hint">Loading...</span>
</div>

<div id="app-container"></div>

<script>
/* Mock tool SDK */
(function() {
  var STORAGE_KEY = 'payroll_employee_collector_test_db';
  var listeners = { valueChange: [], fieldsChange: [], readonlyChange: [], userChange: [], permittedUsersChange: [] };
  var _readOnly = false, _user = { id: 'emp-test', name: 'Jordan Taylor', email: 'jordan@example.org', roles: ['staff'], locale: 'en-CA' };
  var _fields = {}, _value = null;
  var _permittedUsers = [
    { id: 'emp-test', name: 'Jordan Taylor', email: 'jordan@example.org', roles: ['staff'] },
    { id: 'hr-maria', name: 'Maria Rodriguez', email: 'maria@example.org', roles: ['hr', 'admin'] },
    { id: 'finance-ali', name: 'Ali Khan', email: 'ali@example.org', roles: ['finance'] },
    { id: 'mgr-david', name: 'David Chen', email: 'david@example.org', roles: ['manager'] }
  ];
  var _mockUploadCount = 0;

  function load() {
    try { var raw = localStorage.getItem(STORAGE_KEY); _value = raw ? JSON.parse(raw) : null; }
    catch(e) { _value = null; }
  }
  function save(v) { _value = v; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch(e) {} }

  window.tool = {
    getValue: function() { return _value; },
    setValue: function(data) { save(data); listeners.valueChange.forEach(function(cb) { try { cb(data); } catch(e) {} }); },
    onValueChange: function(cb) { listeners.valueChange.push(cb); },
    getFields: function() { return Object.assign({}, _fields); },
    setField: function(id, v) { _fields[id] = v; },
    setFields: function(obj) { Object.assign(_fields, obj); },
    watchField: function(id, cb) { listeners.fieldsChange.push(cb); },
    onFieldsChange: function(cb) { listeners.fieldsChange.push(cb); },
    param: function(name, fallback) {
      var testParams = {
        companyName: "Acme Corporation",
        developerSubdomain: "uniconhub",
        sinLabel: "SIN",
        documentTemplates: [
          { name: "Direct Deposit Form / Void Cheque", templateUrl: "#", accept: ".pdf,.jpg,.jpeg,.png", required: true, category: "Banking" },
          { name: "TD1 - Federal", templateUrl: "#", accept: ".pdf", required: true, category: "Tax Forms" },
          { name: "TD1 - BC", templateUrl: "#", accept: ".pdf", required: true, category: "Tax Forms" },
          { name: "Youth Training Acknowledgement Form", templateUrl: "#", accept: ".pdf", required: true, category: "HR Forms" },
          { name: "Confidentiality Agreement", templateUrl: "#", accept: ".pdf", required: true, category: "HR Forms" },
          { name: "Employee Information Sheet", templateUrl: "#", accept: ".pdf", required: true, category: "HR Forms" },
          { name: "Canada Summer Jobs - Employee Consent Form (EMP5616)", templateUrl: "#", accept: ".pdf", required: true, category: "HR Forms" },
          { name: "Media Release Form", templateUrl: "#", accept: ".pdf", required: false, category: "HR Forms" }
        ],
        customFields: "Dietary Restrictions|text|e.g. vegetarian, halal, none|,Needs Parking Pass|toggle|Parking required|,Office Location|select|Vancouver;Toronto;Montreal;Remote|required"
      };
      var v = testParams[name];
      if (v !== undefined && v !== null && v !== "") return v;
      try { var p = (new URLSearchParams(window.location.search)).get(name); return p !== null && p !== '' ? p : fallback; } catch(e) { return fallback; }
    },
    isReadOnly: function() { return _readOnly; },
    onReadonlyChange: function(cb) { listeners.readonlyChange.push(cb); },
    _setReadOnly: function(v) {
      _readOnly = v;
      document.getElementById('th-status').textContent = v ? 'READ-ONLY' : 'EDIT MODE';
      listeners.readonlyChange.forEach(function(cb) { try { cb(v); } catch(e) {} });
    },
    getUser: function() { return _user; },
    onUserChange: function(cb) { listeners.userChange.push(cb); },
    getPermittedUsers: function() { return _permittedUsers; },
    onPermittedUsersChange: function(cb) { listeners.permittedUsersChange.push(cb); },
    reportValid: function(bool, msg) { if (!bool) console.warn('[Validation]', msg); },
    notify: function(message, severity) {
      severity = severity || 'info';
      var colors = { info: '#0d9488', success: '#16a34a', warning: '#d97706', error: '#dc2626' };
      var toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:' + (colors[severity] || '#333') + ';color:#fff;padding:10px 20px;border-radius:6px;font-family:system-ui;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.3);max-width:400px;';
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(function() { toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; setTimeout(function() { toast.remove(); }, 300); }, 2500);
    },
    resize: function() {},
    declareOutput: function() {},
    declareParams: function() {},
    reportMissingParams: function() {},
    onReady: function(cb) { load(); document.getElementById('th-status').textContent = _readOnly ? 'READ-ONLY' : 'EDIT MODE'; cb(_value, _fields); },
    _loadSampleData: function(data) { save(data); window.location.reload(); },
    _clearData: function() { localStorage.removeItem(STORAGE_KEY); window.location.reload(); },
    _toggleReadOnly: function() { this._setReadOnly(!_readOnly); },
    _dump: function() { console.log('PayrollEmployeeCollector DB:', JSON.parse(JSON.stringify(_value || {}))); },

    requestUpload: function(accept, callback) {
      _mockUploadCount++;
      setTimeout(function() {
        callback(null, { name: 'uploaded-doc-' + _mockUploadCount + '.pdf', url: 'https://storage.example.com/mock/doc-' + _mockUploadCount + '.pdf', size: 245760, type: 'application/pdf' });
      }, 150);
    },
    requestObjects: function(action, params, callback) {
      if (action === 'query') callback(null, { objects: [] });
      else if (action === 'get') callback(null, { object: null });
      else if (action === 'create') callback(null, { object: { id: 'mock-' + Date.now(), name: params.name } });
      else if (action === 'update') callback(null, { ok: true });
      else if (action === 'delete') callback(null, { ok: true });
      else callback('Unknown action: ' + action, null);
    },
    requestAI: function(prompt, context, callback) { setTimeout(function() { callback(null, 'AI response'); }, 100); },
    requestFileContent: function(url, callback) { setTimeout(function() { callback(null, 'Extracted content'); }, 100); },
    requestExportPdf: function(options, callback) { setTimeout(function() { callback(null, { name: 'export.html', url: '#', size: 1234, type: 'text/html' }); }, 100); },
    requestSendEmail: function(options, callback) { setTimeout(function() { callback(null, { ok: true }); }, 100); }
  };

  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'R') { e.preventDefault(); window.tool._toggleReadOnly(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); window.tool._dump(); }
  });
})();
</script>

<script>
/* Embedded HTML body */
""" + embedded + """
</script>

<script src="EmployeeDataCollection.js"></script>

<script>
/* Harness wiring */
(function() {
  var container = document.getElementById('app-container');
  container.innerHTML = EMBEDDED_HTML;

  window.tool._sampleData = {
    personal: { fullName: "Jordan Taylor", sin: "123-456-789", dob: "1995-04-15", startDate: "2026-07-01" },
    contact: { address: "456 Oak Avenue, Unit 302", city: "Vancouver", province: "BC", postalCode: "V6B 1A1", country: "Canada", phone: "604-555-0199", email: "jordan@example.org", emergencyContact: "Casey Taylor", emergencyPhone: "604-555-0188" },
    banking: { bankName: "TD Canada Trust", transitNumber: "12345", institutionNumber: "004", accountNumber: "9876543210" },
    documents: { photoId: null, templateDocs: {}, personalAgreements: [], otherDocs: [] },
    customFields: {}
  };

  document.getElementById('th-load-sample').addEventListener('click', function() {
    window.tool._loadSampleData(window.tool._sampleData);
  });

  document.getElementById('th-clear').addEventListener('click', function() {
    window.tool._clearData();
  });

  document.getElementById('th-reload').addEventListener('click', function() {
    window.location.reload();
  });

  document.getElementById('th-ro').addEventListener('click', function() {
    window.tool._toggleReadOnly();
    window.tool.notify(window.tool.isReadOnly() ? 'READ-ONLY MODE' : 'EDIT MODE', 'info');
  });
})();
</script>
</body>
</html>
"""

out_path = os.path.join(DIR, "test-harness.html")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(harness)

print("test-harness.html written successfully (" + str(len(harness)) + " bytes)")
