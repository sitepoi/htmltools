"""
Generate a standalone test harness HTML file for InterviewManager.
Reads all three source files and bundles them with a mock tool SDK.
"""
import os

BASE = r'd:\PROJECTS\UNICONHUB\CODE\HTMLBasedTools\InterviewManager'

# Read source files
with open(os.path.join(BASE, 'InterviewManager.html'), 'r', encoding='utf-8') as f:
    html_body = f.read()

with open(os.path.join(BASE, 'InterviewManager.css'), 'r', encoding='utf-8') as f:
    css = f.read()

with open(os.path.join(BASE, 'InterviewManager.js'), 'r', encoding='utf-8') as f:
    js = f.read()

# Escape </script> sequences that would break the HTML <script> tag
js = js.replace('</script>', '<\\/script>')
js = js.replace('</Script>', '<\\/Script>')
js = js.replace('</SCRIPT>', '<\\/SCRIPT>')

# Build the mock tool SDK
mock_sdk = r"""
<script>
/* ── Mock tool SDK for local testing ── */
(function() {
  const STORAGE_KEY = 'interview_manager_test_db';
  const listeners = { valueChange: [], fieldsChange: [], readonlyChange: [], userChange: [] };
  let _readOnly = false;
  let _user = null;
  let _fields = {};
  let _value = null;

  function load() {
    try { const raw = localStorage.getItem(STORAGE_KEY); _value = raw ? JSON.parse(raw) : null; }
    catch(e) { _value = null; }
  }
  function save(v) { _value = v; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch(e) {} }

  window.tool = {
    // ── Value ──
    getValue() { return _value; },
    setValue(data) { save(data); listeners.valueChange.forEach(cb => { try { cb(data); } catch(e) {} }); },
    onValueChange(cb) { listeners.valueChange.push(cb); },

    // ── Fields ──
    getFields() { return Object.assign({}, _fields); },
    setField(id, value) { _fields[id] = value; },
    setFields(obj) { Object.assign(_fields, obj); },
    watchField(id, cb) { /* simplified: fires on any field change */ listeners.fieldsChange.push(cb); },
    onFieldsChange(cb) { listeners.fieldsChange.push(cb); },

    // ── Params ──
    param(name, fallback) {
      const p = (new URLSearchParams(window.location.search)).get(name);
      return p !== null && p !== '' ? p : fallback;
    },

    // ── Read-only ──
    isReadOnly() { return _readOnly; },
    onReadonlyChange(cb) { listeners.readonlyChange.push(cb); },
    _setReadOnly(v) { _readOnly = v; listeners.readonlyChange.forEach(cb => { try { cb(v); } catch(e) {} }); },

    // ── User ──
    getUser() { return _user; },
    onUserChange(cb) { listeners.userChange.push(cb); },

    // ── Validation ──
    reportValid(bool, msg) { if (!bool) console.warn('[Validation]', msg); },

    // ── Notifications ──
    notify(message, severity) {
      severity = severity || 'info';
      const colors = { info: '#3d5cff', success: '#1a9e65', warning: '#b87010', error: '#d63030' };
      const toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:' + (colors[severity] || '#333') + ';color:#fff;padding:10px 20px;border-radius:6px;font-family:system-ui;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.3);animation:toolFadeIn .3s ease;max-width:400px;';
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; setTimeout(() => toast.remove(), 300); }, 2500);
    },

    // ── Layout ──
    resize() { /* no-op in test harness — the page auto-sizes */ },

    // ── Schema (no-ops) ──
    declareOutput(schema) {},
    declareParams(params) {},

    // ── Lifecycle ──
    onReady(cb) {
      load();
      // Simulate the fields being passed
      cb(_value, _fields);
    },

    // ── Debug helpers ──
    _loadSampleData(data) { save(data); window.location.reload(); },
    _clearData() { localStorage.removeItem(STORAGE_KEY); window.location.reload(); },
    _toggleReadOnly() { this._setReadOnly(!_readOnly); },
    _dump() { console.log('DB:', JSON.parse(JSON.stringify(_value))); }
  };

  // Expose read-only toggle via keyboard shortcut Ctrl+Shift+R
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
      e.preventDefault();
      window.tool._toggleReadOnly();
      window.tool.notify(window.tool.isReadOnly() ? '🔒 READ-ONLY mode' : '🔓 EDIT mode', 'info');
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      window.tool._dump();
      window.tool.notify('DB dumped to console', 'info');
    }
  });

  // Add a small debug bar at the top
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9998;background:#1a1d26;color:#fff;font-family:system-ui;font-size:11px;padding:4px 12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;';
  bar.innerHTML = '<strong style="color:#6c8cff">🧪 TEST HARNESS</strong>'
    + '<span style="color:#9399aa">|</span>'
    + '<button id="th-load-sample" style="background:#3d5cff;color:#fff;border:none;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">Load Sample</button>'
    + '<button id="th-clear" style="background:#d63030;color:#fff;border:none;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">Clear Data</button>'
    + '<span style="color:#9399aa">|</span>'
    + '<span style="color:#9399aa">Ctrl+Shift+R = Toggle Read-Only</span>'
    + '<span style="color:#9399aa">|</span>'
    + '<span style="color:#9399aa">Ctrl+Shift+D = Dump DB</span>';
  document.addEventListener('DOMContentLoaded', function() {
    document.body.appendChild(bar);
    document.body.style.paddingTop = '30px';
    document.getElementById('th-load-sample').addEventListener('click', function() {
      window.tool._loadSampleData({
        positions: [
          { id: 'p1', title: 'Senior Backend Engineer', dept: 'Engineering', desc: 'Node.js microservices role', status: 'open', extraCriteria: [{ name: 'Node.js', desc: '4+ years experience' }, { name: 'System Design', desc: 'Distributed systems knowledge' }], closedForInterviews: false, createdAt: '2026-01-15T00:00:00.000Z' },
          { id: 'p2', title: 'UX Designer', dept: 'Design', desc: 'Product design for SaaS platform', status: 'open', extraCriteria: [{ name: 'Figma', desc: 'Expert level' }], closedForInterviews: false, createdAt: '2026-02-01T00:00:00.000Z' },
          { id: 'p3', title: 'Data Analyst', dept: 'Analytics', desc: 'SQL and BI reporting', status: 'open', extraCriteria: [], closedForInterviews: false, createdAt: '2026-03-10T00:00:00.000Z' }
        ],
        interviewers: [
          { id: 'i1', name: 'Sarah Chen', email: 'sarah@company.com', role: 'Engineering Manager', dept: 'Engineering', duration: 60, slots: [{ day: 'Mon', hour12: '9', minute: '00', ampm: 'AM', toHour12: '5', toMinute: '00', toAmpm: 'PM' }, { day: 'Wed', hour12: '10', minute: '00', ampm: 'AM', toHour12: '3', toMinute: '00', toAmpm: 'PM' }] },
          { id: 'i2', name: 'Marcus Johnson', email: 'marcus@company.com', role: 'Senior Developer', dept: 'Engineering', duration: 45, slots: [{ day: 'Tue', hour12: '8', minute: '00', ampm: 'AM', toHour12: '12', toMinute: '00', toAmpm: 'PM' }, { day: 'Thu', hour12: '1', minute: '00', ampm: 'PM', toHour12: '5', toMinute: '00', toAmpm: 'PM' }] },
          { id: 'i3', name: 'Elena Rossi', email: 'elena@company.com', role: 'Design Lead', dept: 'Design', duration: 60, slots: [{ day: 'Mon', hour12: '10', minute: '00', ampm: 'AM', toHour12: '4', toMinute: '00', toAmpm: 'PM' }] }
        ],
        candidates: [
          { id: 'c1', name: 'Alex Johnson', email: 'alex@example.com', phone: '+1 555-0100', source: 'LinkedIn', resume: 'https://example.com/resume-alex.pdf', notes: '5 years Node.js', positionIds: ['p1'], createdAt: '2026-05-01T00:00:00.000Z' },
          { id: 'c2', name: 'Jamie Lee', email: 'jamie@example.com', phone: '+1 555-0101', source: 'Indeed', resume: '', notes: 'Strong design portfolio', positionIds: ['p2'], createdAt: '2026-05-05T00:00:00.000Z' },
          { id: 'c3', name: 'Taylor Smith', email: 'taylor@example.com', phone: '', source: 'Referral', resume: '', notes: '', positionIds: ['p1', 'p3'], createdAt: '2026-05-10T00:00:00.000Z' },
          { id: 'c4', name: 'Riley Brown', email: 'riley@example.com', phone: '+1 555-0102', source: 'Website', resume: '', notes: 'Grant program applicant', positionIds: ['p1'], createdAt: '2026-05-15T00:00:00.000Z' }
        ],
        interviews: [
          { id: 'int1', candidateId: 'c1', date: '2026-06-20', scheduledTime: '2026-06-20T14:00:00.000Z', durationMin: 60, interviewerIds: ['i1', 'i2'], meetingPlatform: 'Zoom', meetingUrl: 'https://zoom.us/j/123456', notes: 'Technical panel', statusEmailSent: true, statusCalled: false, statusDone: false, createdAt: '2026-06-10T00:00:00.000Z' },
          { id: 'int2', candidateId: 'c2', date: '2026-06-21', scheduledTime: '2026-06-21T10:00:00.000Z', durationMin: 45, interviewerIds: ['i3'], meetingPlatform: '', meetingUrl: '', notes: '', statusEmailSent: false, statusCalled: false, statusDone: false, createdAt: '2026-06-11T00:00:00.000Z' }
        ],
        scores: [
          { id: 's1', interviewId: 'int1', interviewerId: 'i1', positionId: 'p1', candidateId: 'c1', criteria: { 'Technical Skills': 8, 'Problem Solving': 7, 'Communication': 6, 'Culture Fit': 8, 'Leadership': 5, 'Motivation': 7 }, extraCriteria: { 'Node.js': 8, 'System Design': 6 }, recommendation: 'yes', suggestedPositionId: '', notes: 'Solid engineer, good culture fit', ineligible: false, date: '2026-06-20T15:30:00.000Z' },
          { id: 's2', interviewId: 'int1', interviewerId: 'i2', positionId: 'p1', candidateId: 'c1', criteria: { 'Technical Skills': 7, 'Problem Solving': 8, 'Communication': 5, 'Culture Fit': 7 }, extraCriteria: {}, recommendation: 'yes', suggestedPositionId: '', notes: '', ineligible: false, date: '2026-06-20T15:45:00.000Z' }
        ],
        screenings: [
          { candidateId: 'c1', status: 'advanced', date: '2026-06-01T00:00:00.000Z' },
          { candidateId: 'c2', status: 'advanced', date: '2026-06-02T00:00:00.000Z' },
          { candidateId: 'c3', status: 'advanced', date: '2026-06-05T00:00:00.000Z' },
          { candidateId: 'c4', status: 'advanced', date: '2026-06-06T00:00:00.000Z' }
        ],
        placements: [],
        settings: { companyName: 'Acme Corp', meetingPlatform: 'Zoom', meetingUrl: 'https://zoom.us/j/acme-default' },
        _theme: 'light'
      });
    });
    document.getElementById('th-clear').addEventListener('click', function() {
      if (confirm('Clear ALL interview manager data?')) window.tool._clearData();
    });
  });
})();
</script>
"""

# Build the final HTML
test_html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>InterviewManager — Test Harness</title>

<!-- Google Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">

<!-- SheetJS for Excel import -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

<style>
/* ── Inlined from InterviewManager.css ── */
{css}

/* ── Test harness overrides ── */
body {{ padding-top: 28px !important; }}
#app {{ min-height: calc(100vh - 28px); }}
</style>
</head>
<body>

<!-- ── Body from InterviewManager.html ── -->
{html_body}

<!-- ── Mock tool SDK ── -->
{mock_sdk}

<!-- ── Application JS from InterviewManager.js ── -->
<script>
{js}
</script>

</body>
</html>
'''

# Write output
output_path = os.path.join(BASE, 'test-harness.html')
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(test_html)

print(f'Test harness created: {output_path}')
print(f'Size: {len(test_html):,} bytes')
print(f'Open this file in a browser to test InterviewManager locally.')
print(f'Keyboard shortcuts:')
print(f'  Ctrl+Shift+R = Toggle read-only mode')
print(f'  Ctrl+Shift+D = Dump DB to console')
print(f'  Click "Load Sample" in the top bar to populate sample data.')
