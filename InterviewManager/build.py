"""
Build/update test-harness.html by embedding InterviewManager.html body.
CSS and JS remain external — just refresh browser to see changes.
Only HTML changes require rebuilding (run this script again).
"""
import os

BASE = r'd:\PROJECTS\UNICONHUB\CODE\HTMLBasedTools\InterviewManager'

with open(os.path.join(BASE, 'InterviewManager.html'), 'r', encoding='utf-8') as f:
    html_body = f.read()

# Escape for template literal embedding
escaped = html_body.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')

test_html = r'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>InterviewManager — Test Harness</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<link rel="stylesheet" href="InterviewManager.css">
<style>
body { padding-top: 28px !important; margin: 0; }
#app { min-height: calc(100vh - 28px); }
#th-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 9998; background: #1a1d26; color: #fff; font-family: system-ui; font-size: 11px; padding: 4px 12px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
#th-bar strong { color: #6c8cff; }
#th-bar .sep { color: #5a6070; }
#th-bar button { border: none; padding: 3px 10px; border-radius: 3px; cursor: pointer; font-size: 10px; font-family: system-ui; }
#th-bar .btn-load { background: #3d5cff; color: #fff; }
#th-bar .btn-clear { background: #d63030; color: #fff; }
#th-bar .btn-reload { background: #1a9e65; color: #fff; }
#th-bar .hint { color: #5a6070; font-size: 10px; }
@keyframes toolFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
</head>
<body>
<div id="th-bar">
  <strong>TEST HARNESS</strong><span class="sep">|</span>
  <button class="btn-load" id="th-load-sample">Load Sample</button>
  <button class="btn-clear" id="th-clear">Clear</button>
  <button class="btn-reload" id="th-reload">Reload</button>
  <span class="sep">|</span>
  <span class="hint">Ctrl+Shift+R = ReadOnly</span>
  <span class="sep">|</span>
  <span class="hint">Ctrl+Shift+D = Dump</span>
  <span class="sep">|</span>
  <span id="th-status" class="hint">Loading...</span>
</div>
<div id="app-container"></div>

<script>
/* Mock tool SDK */
(function() {
  const STORAGE_KEY = 'interview_manager_test_db';
  const listeners = { valueChange: [], fieldsChange: [], readonlyChange: [], userChange: [] };
  let _readOnly = false, _user = null, _fields = {}, _value = null;

  function load() {
    try { const raw = localStorage.getItem(STORAGE_KEY); _value = raw ? JSON.parse(raw) : null; }
    catch(e) { _value = null; }
  }
  function save(v) { _value = v; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch(e) {} }

  window.tool = {
    getValue() { return _value; },
    setValue(data) { save(data); listeners.valueChange.forEach(function(cb) { try { cb(data); } catch(e) {} }); },
    onValueChange(cb) { listeners.valueChange.push(cb); },
    getFields() { return Object.assign({}, _fields); },
    setField(id, value) { _fields[id] = value; },
    setFields(obj) { Object.assign(_fields, obj); },
    watchField(id, cb) { listeners.fieldsChange.push(cb); },
    onFieldsChange(cb) { listeners.fieldsChange.push(cb); },
    param(name, fallback) {
      var p = (new URLSearchParams(window.location.search)).get(name);
      return p !== null && p !== '' ? p : fallback;
    },
    isReadOnly() { return _readOnly; },
    onReadonlyChange(cb) { listeners.readonlyChange.push(cb); },
    _setReadOnly(v) { _readOnly = v; listeners.readonlyChange.forEach(function(cb) { try { cb(v); } catch(e) {} }); },
    getUser() { return _user; },
    onUserChange(cb) { listeners.userChange.push(cb); },
    reportValid(bool, msg) { if (!bool) console.warn('[Validation]', msg); },
    notify(message, severity) {
      severity = severity || 'info';
      var colors = { info: '#3d5cff', success: '#1a9e65', warning: '#b87010', error: '#d63030' };
      var toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:' + (colors[severity] || '#333') + ';color:#fff;padding:10px 20px;border-radius:6px;font-family:system-ui;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.3);animation:toolFadeIn .3s ease;max-width:400px;';
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(function() { toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; setTimeout(function() { toast.remove(); }, 300); }, 2500);
    },
    resize: function() {},
    declareOutput: function() {},
    declareParams: function() {},
    onReady: function(cb) { load(); cb(_value, _fields); },
    _loadSampleData: function(data) { save(data); window.location.reload(); },
    _clearData: function() { localStorage.removeItem(STORAGE_KEY); window.location.reload(); },
    _toggleReadOnly: function() { this._setReadOnly(!_readOnly); },
    _dump: function() { console.log('DB:', JSON.parse(JSON.stringify(_value))); }
  };

  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'R') { e.preventDefault(); window.tool._toggleReadOnly(); window.tool.notify(window.tool.isReadOnly() ? 'READ-ONLY' : 'EDIT', 'info'); }
    if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); window.tool._dump(); window.tool.notify('DB dumped', 'info'); }
  });
})();
</script>

<script>
/* Embedded HTML fallback */
const EMBEDDED_HTML = `''' + escaped + r'''`; // END_EMBEDDED_HTML
</script>

<script>
/* Dynamic loader with embedded fallback */
(function() {
  var status = document.getElementById('th-status');
  var container = document.getElementById('app-container');

  function loadJS() {
    status.textContent = 'Loading JS...';
    var script = document.createElement('script');
    script.src = 'InterviewManager.js';
    script.onload = function() { status.textContent = 'Ready'; };
    script.onerror = function() { status.textContent = 'JS FAILED - check console'; };
    document.body.appendChild(script);
  }

  function injectHTML(html) {
    container.innerHTML = html;
    loadJS();
  }

  status.textContent = 'Fetching HTML...';
  var fallbackTimer = setTimeout(function() {
    status.textContent = 'Using embedded HTML (file:// mode)';
    injectHTML(EMBEDDED_HTML);
  }, 2000);

  fetch('InterviewManager.html')
    .then(function(resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.text();
    })
    .then(function(html) {
      clearTimeout(fallbackTimer);
      status.textContent = 'HTML loaded (live)';
      injectHTML(html);
    })
    .catch(function() {
      clearTimeout(fallbackTimer);
      status.textContent = 'Using embedded HTML (fetch unavailable)';
      injectHTML(EMBEDDED_HTML);
    });
})();
</script>

<script>
/* Toolbar + Sample Data */
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('th-load-sample').addEventListener('click', function() {
    window.tool._loadSampleData(SAMPLE_DATA);
  });
  document.getElementById('th-clear').addEventListener('click', function() {
    if (confirm('Clear ALL data?')) window.tool._clearData();
  });
  document.getElementById('th-reload').addEventListener('click', function() {
    window.location.reload();
  });
});

var SAMPLE_DATA = {
  positions: [
    { id:'p1', title:'Senior Backend Engineer', dept:'Engineering', desc:'Node.js microservices architecture role', status:'open', extraCriteria:[{name:'Node.js',desc:'4+ years'},{name:'System Design',desc:'Distributed systems'}], closedForInterviews:false, createdAt:'2026-01-15T00:00:00.000Z' },
    { id:'p2', title:'UX Designer', dept:'Design', desc:'Product design for SaaS platform', status:'open', extraCriteria:[{name:'Figma',desc:'Expert level'},{name:'User Research',desc:'2+ years'}], closedForInterviews:false, createdAt:'2026-02-01T00:00:00.000Z' },
    { id:'p3', title:'Data Analyst', dept:'Analytics', desc:'SQL and BI reporting', status:'open', extraCriteria:[], closedForInterviews:false, createdAt:'2026-03-10T00:00:00.000Z' },
    { id:'p4', title:'DevOps Engineer', dept:'Engineering', desc:'CI/CD pipeline management', status:'open', extraCriteria:[{name:'Kubernetes',desc:'2+ years'},{name:'Terraform',desc:'Production experience'}], closedForInterviews:false, createdAt:'2026-04-01T00:00:00.000Z' },
    { id:'p5', title:'Product Manager', dept:'Product', desc:'B2B SaaS product ownership', status:'open', extraCriteria:[{name:'Roadmapping',desc:'3+ years'},{name:'Stakeholder Mgmt',desc:''}], closedForInterviews:false, createdAt:'2026-04-15T00:00:00.000Z' },
    { id:'p6', title:'QA Engineer', dept:'Engineering', desc:'Automated testing framework', status:'open', extraCriteria:[{name:'Selenium',desc:''},{name:'Cypress',desc:'2+ years'}], closedForInterviews:false, createdAt:'2026-05-01T00:00:00.000Z' },
    { id:'p7', title:'Marketing Specialist', dept:'Marketing', desc:'Digital campaign management', status:'open', extraCriteria:[], closedForInterviews:false, createdAt:'2026-05-10T00:00:00.000Z' },
    { id:'p8', title:'HR Coordinator', dept:'HR', desc:'Recruitment and onboarding', status:'closed', extraCriteria:[], closedForInterviews:true, createdAt:'2025-11-01T00:00:00.000Z' }
  ],
  interviewers: [
    { id:'i1', name:'Sarah Chen', email:'sarah@company.com', role:'Engineering Manager', dept:'Engineering', duration:60, slots:[{day:'Mon',hour12:'9',minute:'00',ampm:'AM',toHour12:'5',toMinute:'00',toAmpm:'PM'},{day:'Wed',hour12:'10',minute:'00',ampm:'AM',toHour12:'3',toMinute:'00',toAmpm:'PM'},{day:'Fri',hour12:'9',minute:'00',ampm:'AM',toHour12:'1',toMinute:'00',toAmpm:'PM'}] },
    { id:'i2', name:'Marcus Johnson', email:'marcus@company.com', role:'Senior Developer', dept:'Engineering', duration:45, slots:[{day:'Tue',hour12:'8',minute:'00',ampm:'AM',toHour12:'12',toMinute:'00',toAmpm:'PM'},{day:'Thu',hour12:'1',minute:'00',ampm:'PM',toHour12:'5',toMinute:'00',toAmpm:'PM'}] },
    { id:'i3', name:'Elena Rossi', email:'elena@company.com', role:'Design Lead', dept:'Design', duration:60, slots:[{day:'Mon',hour12:'10',minute:'00',ampm:'AM',toHour12:'4',toMinute:'00',toAmpm:'PM'},{day:'Wed',hour12:'11',minute:'00',ampm:'AM',toHour12:'3',toMinute:'00',toAmpm:'PM'}] },
    { id:'i4', name:'David Kim', email:'david@company.com', role:'VP Engineering', dept:'Engineering', duration:30, slots:[{day:'Tue',hour12:'9',minute:'00',ampm:'AM',toHour12:'11',toMinute:'00',toAmpm:'AM'},{day:'Thu',hour12:'2',minute:'00',ampm:'PM',toHour12:'4',toMinute:'00',toAmpm:'PM'}] },
    { id:'i5', name:'Aisha Patel', email:'aisha@company.com', role:'Product Director', dept:'Product', duration:45, slots:[{day:'Mon',hour12:'1',minute:'00',ampm:'PM',toHour12:'5',toMinute:'00',toAmpm:'PM'},{day:'Fri',hour12:'10',minute:'00',ampm:'AM',toHour12:'2',toMinute:'00',toAmpm:'PM'}] }
  ],
  candidates: [
    { id:'c1', name:'Alex Johnson', email:'alex@example.com', phone:'+1 555-0100', source:'LinkedIn', resume:'https://example.com/resume-alex.pdf', notes:'5 years Node.js', positionIds:['p1'], createdAt:'2026-05-01T00:00:00.000Z' },
    { id:'c2', name:'Jamie Lee', email:'jamie@example.com', phone:'+1 555-0101', source:'Indeed', resume:'', notes:'Strong design portfolio', positionIds:['p2'], createdAt:'2026-05-05T00:00:00.000Z' },
    { id:'c3', name:'Taylor Smith', email:'taylor@example.com', phone:'', source:'Referral', resume:'', notes:'', positionIds:['p1','p3'], createdAt:'2026-05-10T00:00:00.000Z' },
    { id:'c4', name:'Riley Brown', email:'riley@example.com', phone:'+1 555-0102', source:'Website', resume:'', notes:'Grant program applicant', positionIds:['p1'], createdAt:'2026-05-15T00:00:00.000Z' },
    { id:'c5', name:'Morgan Wilson', email:'morgan@example.com', phone:'+1 555-0103', source:'LinkedIn', resume:'', notes:'DevOps background', positionIds:['p4'], createdAt:'2026-05-18T00:00:00.000Z' },
    { id:'c6', name:'Casey Zhang', email:'casey@example.com', phone:'+1 555-0104', source:'Agency', resume:'https://example.com/resume-casey.pdf', notes:'MBA, 7 yrs product', positionIds:['p5'], createdAt:'2026-05-20T00:00:00.000Z' },
    { id:'c7', name:'Jordan Rivera', email:'jordan@example.com', phone:'', source:'Website', resume:'', notes:'QA automation expert', positionIds:['p6','p4'], createdAt:'2026-05-22T00:00:00.000Z' },
    { id:'c8', name:'Sam Ortiz', email:'sam@example.com', phone:'+1 555-0105', source:'Indeed', resume:'', notes:'', positionIds:['p2'], createdAt:'2026-05-25T00:00:00.000Z' },
    { id:'c9', name:'Drew Kumar', email:'drew@example.com', phone:'+1 555-0106', source:'Referral', resume:'', notes:'Marketing campaigns', positionIds:['p7'], createdAt:'2026-05-28T00:00:00.000Z' },
    { id:'c10', name:'Quinn Taylor', email:'quinn@example.com', phone:'', source:'JobBank', resume:'', notes:'Backend + data', positionIds:['p1','p3'], createdAt:'2026-06-01T00:00:00.000Z' },
    { id:'c11', name:'Avery Nichols', email:'avery@example.com', phone:'+1 555-0107', source:'LinkedIn', resume:'', notes:'Full-stack developer', positionIds:['p1','p6'], createdAt:'2026-06-02T00:00:00.000Z' },
    { id:'c12', name:'Blake Saunders', email:'blake@example.com', phone:'', source:'Website', resume:'', notes:'', positionIds:['p4'], createdAt:'2026-06-05T00:00:00.000Z' }
  ],
  interviews: [
    { id:'int1', candidateId:'c1', date:'2026-06-20', scheduledTime:'2026-06-20T14:00:00.000Z', durationMin:60, interviewerIds:['i1','i2'], meetingPlatform:'Zoom', meetingUrl:'https://zoom.us/j/123456', notes:'Technical panel', statusEmailSent:true, statusCalled:false, statusDone:false, createdAt:'2026-06-10T00:00:00.000Z' },
    { id:'int2', candidateId:'c2', date:'2026-06-21', scheduledTime:'2026-06-21T10:00:00.000Z', durationMin:45, interviewerIds:['i3'], meetingPlatform:'', meetingUrl:'', notes:'', statusEmailSent:false, statusCalled:false, statusDone:false, createdAt:'2026-06-11T00:00:00.000Z' },
    { id:'int3', candidateId:'c3', date:'2026-06-21', scheduledTime:'2026-06-21T14:00:00.000Z', durationMin:60, interviewerIds:['i1'], meetingPlatform:'Teams', meetingUrl:'https://teams.microsoft.com/l/meetup/abc', notes:'', statusEmailSent:true, statusCalled:true, statusDone:false, createdAt:'2026-06-11T00:00:00.000Z' },
    { id:'int4', candidateId:'c5', date:'2026-06-22', scheduledTime:'2026-06-22T09:00:00.000Z', durationMin:45, interviewerIds:['i2'], meetingPlatform:'', meetingUrl:'', notes:'', statusEmailSent:false, statusCalled:false, statusDone:false, createdAt:'2026-06-12T00:00:00.000Z' },
    { id:'int5', candidateId:'c6', date:'2026-06-23', scheduledTime:'2026-06-23T11:00:00.000Z', durationMin:60, interviewerIds:['i5'], meetingPlatform:'Google Meet', meetingUrl:'https://meet.google.com/xyz', notes:'Product case study', statusEmailSent:true, statusCalled:false, statusDone:false, createdAt:'2026-06-13T00:00:00.000Z' }
  ],
  scores: [
    { id:'s1', interviewId:'int1', interviewerId:'i1', positionId:'p1', candidateId:'c1', criteria:{'Technical Skills':8,'Problem Solving':7,'Communication':6,'Culture Fit':8,'Leadership':5,'Motivation':7}, extraCriteria:{'Node.js':8,'System Design':6}, recommendation:'yes', suggestedPositionId:'', notes:'Solid engineer, good culture fit', ineligible:false, date:'2026-06-20T15:30:00.000Z' },
    { id:'s2', interviewId:'int1', interviewerId:'i2', positionId:'p1', candidateId:'c1', criteria:{'Technical Skills':7,'Problem Solving':8,'Communication':5,'Culture Fit':7}, extraCriteria:{}, recommendation:'yes', suggestedPositionId:'', notes:'', ineligible:false, date:'2026-06-20T15:45:00.000Z' },
    { id:'s3', interviewId:'int2', interviewerId:'i3', positionId:'p2', candidateId:'c2', criteria:{'Technical Skills':6,'Problem Solving':8,'Communication':9,'Culture Fit':7,'Leadership':4,'Motivation':8}, extraCriteria:{'Figma':9,'User Research':7}, recommendation:'strong-yes', suggestedPositionId:'', notes:'Excellent design thinking', ineligible:false, date:'2026-06-21T11:00:00.000Z' },
    { id:'s4', interviewId:'int3', interviewerId:'i1', positionId:'p1', candidateId:'c3', criteria:{'Technical Skills':5,'Problem Solving':6,'Communication':7,'Culture Fit':6}, extraCriteria:{}, recommendation:'maybe', suggestedPositionId:'p3', notes:'Better suited for data role', ineligible:false, date:'2026-06-21T15:30:00.000Z' },
    { id:'s5', interviewId:'int5', interviewerId:'i5', positionId:'p5', candidateId:'c6', criteria:{'Technical Skills':7,'Problem Solving':9,'Communication':8,'Culture Fit':8,'Leadership':7,'Motivation':9}, extraCriteria:{'Roadmapping':8,'Stakeholder Mgmt':7}, recommendation:'strong-yes', suggestedPositionId:'', notes:'Top candidate for product', ineligible:false, date:'2026-06-23T12:00:00.000Z' }
  ],
  screenings: [
    { candidateId:'c1', status:'advanced', date:'2026-06-01T00:00:00.000Z' },
    { candidateId:'c2', status:'advanced', date:'2026-06-02T00:00:00.000Z' },
    { candidateId:'c3', status:'advanced', date:'2026-06-05T00:00:00.000Z' },
    { candidateId:'c4', status:'advanced', date:'2026-06-06T00:00:00.000Z' },
    { candidateId:'c5', status:'advanced', date:'2026-06-07T00:00:00.000Z' },
    { candidateId:'c6', status:'advanced', date:'2026-06-08T00:00:00.000Z' },
    { candidateId:'c7', status:'advanced', date:'2026-06-09T00:00:00.000Z' },
    { candidateId:'c8', status:'advanced', date:'2026-06-10T00:00:00.000Z' },
    { candidateId:'c10', status:'advanced', date:'2026-06-12T00:00:00.000Z' },
    { candidateId:'c11', status:'advanced', date:'2026-06-13T00:00:00.000Z' }
  ],
  placements: [],
  settings: { companyName:'Acme Corp', meetingPlatform:'Zoom', meetingUrl:'https://zoom.us/j/acme-default', defaultDuration:30, defaultBreak:15 },
  _theme: 'light'
};
</script>
</body>
</html>
'''

harness_path = os.path.join(BASE, 'test-harness.html')
with open(harness_path, 'w', encoding='utf-8') as f:
    f.write(test_html)

print(f'Written: {harness_path} ({len(test_html):,} bytes)')
print('')
print('How it works:')
print('  CSS — always loaded live from InterviewManager.css (just refresh)')
print('  JS  — always loaded live from InterviewManager.js (just refresh)')
print('  HTML — tries fetch() first; falls back to embedded copy')
print('')
print('When HTML changes, rebuild with: python build.py')
