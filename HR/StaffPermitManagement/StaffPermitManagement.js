/* ═══════════════════════════════════════════════════════
   Staff Permit Management — Application Logic
   ═══════════════════════════════════════════════════════ */

// ── Global State ──
var APP = {
  user: null,
  role: 'employee',        // 'employee' | 'supervisor' | 'admin'
  readOnly: false,
  requests: [],            // cached requests relevant to current user
  allRequests: [],         // all requests (admin/supervisor)
  employees: [],           // employee records
  schedule: null,          // current user's schedule
  policyAcceptances: {},   // { employee: date, supervisor: date }
  currentView: 'dashboard',
  employeeTeam: '',
  employeeSupervisor: '',
  employeePeriod: ''
};

// ── Constants ──
var REQUEST_TYPE = 'staffPermitRequests-uniconbaseapps';
var POLICY_TYPE = 'staffPermitPolicies-uniconbaseapps';
var EMPLOYEE_TYPE = 'staffPermitEmployees-uniconbaseapps';

var REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
  ESCALATED: 'escalated',
  CONDITIONS: 'conditions',
  RETURNED: 'returned'
};

var REQUEST_TYPE_LABELS = {
  lateArrival: 'Late Arrival',
  earlyDeparture: 'Early Departure',
  absenceFullDay: 'Absence – Full Day',
  absencePartialDay: 'Absence – Partial Day',
  scheduleAdjustment: 'Schedule Adjustment',
  emergency: 'Emergency Situation',
  medicalAppointment: 'Medical Appointment',
  familyResponsibility: 'Family Responsibility',
  outOfOfficeWork: 'Out of Office Work',
  other: 'Other'
};

var REASON_LABELS = {
  medical: 'Medical Appointment',
  family: 'Family Obligation',
  transportation: 'Transportation Issue',
  emergency: 'Emergency',
  personal: 'Personal Appointment',
  religious: 'Religious Obligation',
  school: 'School Obligation',
  dayCamp: 'Day Camp / External Program',
  fieldWork: 'Field Work / Community Visit',
  trainingOffsite: 'Off-Site Training',
  other: 'Other'
};

var DENIAL_REASONS = [
  'Conflicts with required training session',
  'Too many previous requests',
  'Reason does not justify schedule change',
  'Operational requirements',
  'Request submitted too late',
  'Other'
];

/* ═══════════════════════════════════════════════════════
   TOOL SDK SETUP
   ═══════════════════════════════════════════════════════ */
tool.declareParams([
  { name: 'adminRoles', label: 'Admin Roles', type: 'text', default: 'admin', severity: 'mandatory', hint: 'Comma-separated CMS role names that grant ADMIN access (e.g. "admin"). Users with these roles can manage all employees, override decisions, and view reports.' },
  { name: 'supervisorRoles', label: 'Supervisor Roles', type: 'text', default: 'editor', severity: 'mandatory', hint: 'Comma-separated CMS role names that grant SUPERVISOR access (e.g. "editor"). Users with these roles can review and approve/deny requests for their team.' },
  { name: 'defaultScheduleStart', label: 'Default Schedule Start', type: 'text', default: '10:00', severity: 'goodToHave', hint: 'Default work day start time (HH:MM, 24h). Default: 10:00' },
  { name: 'defaultScheduleEnd', label: 'Default Schedule End', type: 'text', default: '17:30', severity: 'goodToHave', hint: 'Default work day end time (HH:MM, 24h). Includes a 30-min break. Default: 17:30' },
  { name: 'defaultWorkDays', label: 'Default Work Days', type: 'text', default: 'Monday,Tuesday,Wednesday,Thursday,Friday', severity: 'goodToHave', hint: 'Comma-separated list of work days' },
  { name: 'escalationThreshold', label: 'Escalation Threshold', type: 'number', default: '3', severity: 'goodToHave', hint: 'Number of requests in 30 days that triggers auto-escalation' },
  { name: 'supervisorVarianceThreshold', label: 'Supervisor Variance Threshold', type: 'number', default: '20', severity: 'goodToHave', hint: 'Percentage point difference between supervisors that triggers a flag' },
  { name: 'hourlyRate', label: 'Hourly Rate (CAD)', type: 'text', default: '17.40', severity: 'goodToHave', hint: 'Hourly wage rate used for payroll estimates. Default: 17.40' },
  { name: 'csjMinHours', label: 'CSJ Minimum Weekly Hours', type: 'number', default: '30', severity: 'mandatory', hint: 'Canada Summer Jobs minimum weekly hours for funding eligibility. Default: 30. Weeks below this threshold risk non-reimbursement.' },
  { name: 'csjMaxHours', label: 'CSJ Maximum Weekly Hours', type: 'number', default: '40', severity: 'goodToHave', hint: 'CSJ maximum weekly hours. Default: 40.' }
]);

tool.declareOutput({
  type: 'object',
  description: 'Staff permit management application state',
  properties: {
    requests: { type: 'array', description: 'All permission requests' },
    policies: { type: 'object', description: 'Policy acceptance records' },
    employees: { type: 'array', description: 'Employee schedule records' }
  }
});

/* ═══════════════════════════════════════════════════════
   ENTRY POINT
   ═══════════════════════════════════════════════════════ */
tool.onReady(function(val, fields) {
  APP.readOnly = tool.isReadOnly();

  // Determine user and role
  var user = tool.getUser();
  if (user) {
    APP.user = user;
    APP.role = determineRole(user);
  }

  // Check for missing params
  checkMissingParams();

  // Render UI
  renderNavUser();
  updateRoleUI();
  loadAllData(function() {
    switchView('dashboard');
  });

  // Watch for changes
  tool.onValueChange(function(v) { if (v) { loadAllData(function() { refreshCurrentView(); }); } });
  tool.onReadonlyChange(function(ro) { APP.readOnly = ro; refreshCurrentView(); });
  tool.onUserChange(function(u) {
    APP.user = u;
    APP.role = u ? determineRole(u) : 'employee';
    renderNavUser();
    updateRoleUI();
    loadAllData(function() { switchView('dashboard'); });
  });
});

/* ═══════════════════════════════════════════════════════
   ROLE DETECTION
   ═══════════════════════════════════════════════════════ */
function determineRole(user) {
  // How role detection works:
  // ─────────────────────────────────────────────────
  // The CMS passes the user's roles via tool.getUser().roles
  // (e.g. ["viewer"], ["editor"], ["admin"], or ["editor","viewer"]).
  //
  // The admin configures TWO tool parameters to map CMS roles
  // to app-level permissions:
  //
  //   adminRoles      → which CMS roles = Administrator
  //   supervisorRoles → which CMS roles = Supervisor
  //
  // Default mapping (matches standard CMS roles out of the box):
  //   CMS "admin"   → App Administrator (full access)
  //   CMS "editor"  → App Supervisor   (review + approve)
  //   CMS "viewer"  → App Employee     (submit requests)
  //
  // Priority: admin > supervisor > employee.
  // A user with both "admin" and "editor" is treated as admin.
  // ─────────────────────────────────────────────────

  if (!user || !user.roles) return 'employee';
  var roles = user.roles;
  if (!Array.isArray(roles)) roles = [roles];

  var adminRoles = (tool.param('adminRoles', 'admin') || '').toLowerCase().split(',').map(function(s) { return s.trim(); });
  var supervisorRoles = (tool.param('supervisorRoles', 'editor') || '').toLowerCase().split(',').map(function(s) { return s.trim(); });

  for (var i = 0; i < roles.length; i++) {
    var r = (roles[i] || '').toLowerCase().trim();
    if (!r) continue;
    if (adminRoles.indexOf(r) !== -1) return 'admin';
    if (supervisorRoles.indexOf(r) !== -1) return 'supervisor';
  }
  return 'employee';
}

function checkMissingParams() {
  var missing = [];
  var adminRoles = tool.param('adminRoles');
  var supervisorRoles = tool.param('supervisorRoles');
  if (!adminRoles) missing.push({ name: 'adminRoles', label: 'Admin Roles', type: 'text', default: 'admin', hint: 'Which CMS roles should have Administrator access? Default: "admin"', reason: 'Cannot determine which users are administrators', severity: 'mandatory' });
  if (!supervisorRoles) missing.push({ name: 'supervisorRoles', label: 'Supervisor Roles', type: 'text', default: 'editor', hint: 'Which CMS roles should have Supervisor access? Default: "editor"', reason: 'Cannot determine which users are supervisors', severity: 'mandatory' });
  if (missing.length) {
    try { tool.reportMissingParams(missing, 'Role configuration is required for the permit management system.'); } catch(e) {}
  }
}

/* ═══════════════════════════════════════════════════════
   DATA LOADING
   ═══════════════════════════════════════════════════════ */
function loadAllData(cb) {
  var pending = 3;
  var loaded = function() { pending--; if (pending <= 0 && cb) cb(); };

  loadRequests(function() { loaded(); });
  loadEmployees(function() { loaded(); });
  loadPolicies(function() { loaded(); });
}

function loadRequests(cb) {
  if (typeof tool.requestObjects !== 'function') {
    APP.requests = [];
    APP.allRequests = [];
    if (cb) cb();
    return;
  }
  tool.requestObjects('query', { mainObjectType: REQUEST_TYPE }, function(err, result) {
    if (err) { APP.requests = []; APP.allRequests = []; if (cb) cb(); return; }
    var all = (result && result.objects) ? result.objects : [];
    APP.allRequests = all;
    // Filter for current user
    if (APP.user) {
      var uid = APP.user.id || APP.user.email || '';
      APP.requests = all.filter(function(r) {
        var d = getRequestData(r);
        return d.employeeId === uid || d.employeeEmail === (APP.user.email || '');
      });
    } else {
      APP.requests = [];
    }
    if (cb) cb();
  });
}

function loadEmployees(cb) {
  if (typeof tool.requestObjects !== 'function') {
    APP.employees = [];
    if (cb) cb();
    return;
  }
  tool.requestObjects('query', { mainObjectType: EMPLOYEE_TYPE }, function(err, result) {
    if (err) { APP.employees = []; if (cb) cb(); return; }
    APP.employees = (result && result.objects) ? result.objects : [];
    // Load current user's schedule
    if (APP.user) {
      var uid = APP.user.id || APP.user.email || '';
      var emp = findEmployee(uid);
      if (emp) {
        APP.schedule = getEmployeeData(emp);
        APP.employeeTeam = APP.schedule.team || '';
        APP.employeeSupervisor = APP.schedule.supervisor || '';
        APP.employeePeriod = APP.schedule.period || '';
      } else {
        APP.schedule = getDefaultSchedule();
      }
    }
    if (cb) cb();
  });
}

function loadPolicies(cb) {
  if (typeof tool.requestObjects !== 'function') {
    APP.policyAcceptances = {};
    if (cb) cb();
    return;
  }
  if (!APP.user) { APP.policyAcceptances = {}; if (cb) cb(); return; }
  var uid = APP.user.id || APP.user.email || '';
  tool.requestObjects('query', { mainObjectType: POLICY_TYPE }, function(err, result) {
    if (err) { APP.policyAcceptances = {}; if (cb) cb(); return; }
    var all = (result && result.objects) ? result.objects : [];
    var mine = all.filter(function(p) {
      var d = getPolicyData(p);
      return d.userId === uid;
    });
    APP.policyAcceptances = {};
    mine.forEach(function(p) {
      var d = getPolicyData(p);
      if (d.policyType) APP.policyAcceptances[d.policyType] = d.acceptedAt || p.created || '';
    });
    if (cb) cb();
  });
}

/* ═══════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════ */
function getRequestData(obj) {
  var d = (obj && obj.productData && obj.productData.data_categoriesBased) ? obj.productData.data_categoriesBased : {};
  d._id = obj.id || obj._id || '';
  d._name = obj.name || '';
  d._created = obj.created || '';
  d._updated = obj.updated || '';
  return d;
}

function getEmployeeData(obj) {
  var d = (obj && obj.productData && obj.productData.data_categoriesBased) ? obj.productData.data_categoriesBased : {};
  d._id = obj.id || obj._id || '';
  d._name = obj.name || '';
  return d;
}

function getPolicyData(obj) {
  var d = (obj && obj.productData && obj.productData.data_categoriesBased) ? obj.productData.data_categoriesBased : {};
  d._id = obj.id || obj._id || '';
  return d;
}

function findEmployee(uid) {
  for (var i = 0; i < APP.employees.length; i++) {
    var d = getEmployeeData(APP.employees[i]);
    if (d.userId === uid || d.email === (APP.user ? APP.user.email : '')) return APP.employees[i];
  }
  return null;
}

function findEmployeeById(id) {
  for (var i = 0; i < APP.employees.length; i++) {
    var d = getEmployeeData(APP.employees[i]);
    if (d.userId === id) return d;
  }
  return null;
}

function getDefaultSchedule() {
  var start = tool.param('defaultScheduleStart', '10:00');
  var end = tool.param('defaultScheduleEnd', '17:30');
  var days = tool.param('defaultWorkDays', 'Monday,Tuesday,Wednesday,Thursday,Friday');
  return {
    startTime: start,
    endTime: end,
    workDays: days.split(',').map(function(d) { return d.trim(); }),
    team: '',
    supervisor: '',
    period: ''
  };
}

function getScheduleForUser() {
  if (!APP.user) return getDefaultSchedule();
  var uid = APP.user.id || APP.user.email || '';
  var emp = findEmployee(uid);
  return emp ? getEmployeeData(emp) : getDefaultSchedule();
}

function fmtDate(d) {
  if (!d) return '';
  var dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtTime(t) {
  if (!t) return '';
  var parts = t.split(':');
  if (parts.length < 2) return t;
  var h = parseInt(parts[0], 10);
  var m = parts[1];
  var ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return h + ':' + m + ' ' + ampm;
}

function fmtStatus(s) {
  var map = {
    pending: '<span class="spm-status pending">Pending</span>',
    approved: '<span class="spm-status approved">Approved</span>',
    denied: '<span class="spm-status denied">Denied</span>',
    escalated: '<span class="spm-status escalated">Escalated</span>',
    conditions: '<span class="spm-status conditions">Approved w/ Conditions</span>',
    returned: '<span class="spm-status" style="background:#fce7f3;color:#9d174d">Returned for Revision</span>'
  };
  return map[s] || '<span class="spm-status pending">' + (s || 'Pending') + '</span>';
}

function el(id) { return document.getElementById(id); }
function show(el) { if (el) el.style.display = ''; }
function hide(el) { if (el) el.style.display = 'none'; }
function isEmpty(v) { return v === null || v === undefined || v === ''; }
function safeText(id, text) { var e = el(id); if (e) e.textContent = text; }
function safeVal(id, val) { var e = el(id); if (e) e.value = val; }
function safeChecked(id, val) { var e = el(id); if (e) e.checked = val; }
function safeDisabled(id, val) { var e = el(id); if (e) e.disabled = val; }
function safePlaceholder(id, val) { var e = el(id); if (e) e.placeholder = val; }

function toast(msg, severity) {
  severity = severity || 'info';
  var container = el('toastContainer');
  var div = document.createElement('div');
  div.className = 'spm-toast ' + severity;
  var icons = { info: 'fa-circle-info', success: 'fa-circle-check', warning: 'fa-triangle-exclamation', error: 'fa-circle-xmark' };
  div.innerHTML = '<i class="fa-solid ' + (icons[severity] || 'fa-circle-info') + '"></i> ' + msg;
  container.appendChild(div);
  setTimeout(function() { div.remove(); }, 4000);
  if (typeof tool.notify === 'function') { try { tool.notify(msg, severity); } catch(e) {} }
}

/* ═══════════════════════════════════════════════════════
   NAVIGATION & VIEW SWITCHING
   ═══════════════════════════════════════════════════════ */
function renderNavUser() {
  el('navUserName').textContent = APP.user ? (APP.user.name || APP.user.email || 'User') : 'Guest';
  var badge = el('navRoleBadge');
  badge.textContent = APP.role;
  badge.className = 'spm-role-badge ' + APP.role;
}

function updateRoleUI() {
  // Show/hide role-based tabs
  var showSupervisor = (APP.role === 'supervisor' || APP.role === 'admin');
  var showAdmin = (APP.role === 'admin');
  var showEmployee = (APP.role === 'employee' || APP.role === 'admin');

  // Supervisor tabs (Review)
  var supTabs = document.querySelectorAll('.spm-nav-tab-supervisor');
  for (var i = 0; i < supTabs.length; i++) { supTabs[i].style.display = showSupervisor ? '' : 'none'; }

  // Admin-only tabs
  var adminTabs = document.querySelectorAll('.spm-nav-tab-admin');
  for (var j = 0; j < adminTabs.length; j++) { adminTabs[j].style.display = showAdmin ? '' : 'none'; }

  // Employee-only tabs (New Request) — hidden for supervisors
  var empTabs = document.querySelectorAll('.spm-nav-tab-employee');
  for (var k = 0; k < empTabs.length; k++) { empTabs[k].style.display = showEmployee ? '' : 'none'; }

  // Show supervisor policy section
  var policySupSection = el('policySupervisorSection');
  var btnSupPolicy = el('btnAcceptSupervisorPolicy');
  if (showSupervisor) {
    if (policySupSection) show(policySupSection);
    if (btnSupPolicy) show(btnSupPolicy);
  }
}

function switchView(viewName) {
  // Block supervisors from the New Request view
  if (viewName === 'newRequest' && APP.role === 'supervisor') {
    toast('Supervisors cannot submit requests. Use the Review tab to manage employee requests.', 'warning');
    return;
  }

  APP.currentView = viewName;
  // Update tab active state
  var tabs = document.querySelectorAll('.spm-nav-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove('active');
    if (tabs[i].getAttribute('data-view') === viewName) tabs[i].classList.add('active');
  }
  // Show view
  var views = document.querySelectorAll('.spm-view');
  for (var j = 0; j < views.length; j++) { views[j].classList.remove('active'); }
  var target = el('view-' + viewName);
  if (target) target.classList.add('active');

  // Render view content
  renderView(viewName);
  if (typeof tool.resize === 'function') { setTimeout(function() { tool.resize(); }, 100); }
}

function refreshCurrentView() {
  renderView(APP.currentView);
}

function renderView(viewName) {
  switch (viewName) {
    case 'dashboard': renderDashboard(); break;
    case 'mySchedule': renderMySchedule(); break;
    case 'newRequest': renderNewRequest(); break;
    case 'requestHistory': renderRequestHistory(); break;
    case 'outOfOffice': renderOutOfOffice(); break;
    case 'reviewQueue': renderReviewQueue(); break;
    case 'adminConsole': renderAdminConsole(); break;
    case 'policyCenter': renderPolicyCenter(); break;
    case 'reports': showReport('attendance'); break;
  }
}

// Navigation tab clicks
document.addEventListener('click', function(e) {
  var tab = e.target.closest('.spm-nav-tab');
  if (tab) {
    var view = tab.getAttribute('data-view');
    if (view) switchView(view);
  }
});

/* ═══════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════ */
function renderDashboard() {
  var reqs = (APP.role === 'admin' || APP.role === 'supervisor') ? APP.allRequests : APP.requests;
  var now = new Date();
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  var pending = reqs.filter(function(r) { var d = getRequestData(r); return d.status === REQUEST_STATUS.PENDING; });
  var approvedMonth = reqs.filter(function(r) { var d = getRequestData(r); return d.status === REQUEST_STATUS.APPROVED && r.created >= monthStart; });
  var deniedMonth = reqs.filter(function(r) { var d = getRequestData(r); return d.status === REQUEST_STATUS.DENIED && r.created >= monthStart; });
  var escalated = reqs.filter(function(r) { var d = getRequestData(r); return d.status === REQUEST_STATUS.ESCALATED; });

  el('statPending').textContent = pending.length;
  el('statApproved').textContent = approvedMonth.length;
  el('statDenied').textContent = deniedMonth.length;
  el('statEscalated').textContent = escalated.length;

  // Recent activity
  var recent = reqs.slice().sort(function(a, b) { return (b.created || '').localeCompare(a.created || ''); }).slice(0, 10);
  var tbody = el('dashRecentTbody');
  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="spm-empty">No recent activity</td></tr>';
  } else {
    tbody.innerHTML = recent.map(function(r) {
      var d = getRequestData(r);
      return '<tr>' +
        '<td>' + fmtDate(d.requestDate || r.created) + '</td>' +
        '<td>' + (REQUEST_TYPE_LABELS[d.requestType] || d.requestType || '—') + '</td>' +
        '<td>' + fmtStatus(d.status) + '</td>' +
        '<td>' + (d.decision || '—') + '</td>' +
        '<td><button class="spm-btn spm-btn-outline spm-btn-sm" onclick="viewRequestDetail(\'' + (d._id || '') + '\')"><i class="fa-solid fa-eye"></i> View</button></td>' +
        '</tr>';
    }).join('');
  }

  // Supervisor/Admin quick stats
  if (APP.role === 'supervisor' || APP.role === 'admin') {
    var supReqs = APP.allRequests;
    el('statPending').textContent = supReqs.filter(function(r) { return getRequestData(r).status === REQUEST_STATUS.PENDING; }).length;
  }

  // CSJ Compliance — current week hours
  var weekStart = getWeekStart();
  var payable = getWeeklyPayableHours(weekStart);
  var scheduled = getWeeklyScheduledHours();
  var unpaid = getWeeklyUnpaidHours(weekStart);
  var csjMin = getCSJMinHours();
  var csjStatus = getCSJStatus(payable);

  var csjEl = el('csjStatHours');
  if (csjEl) csjEl.textContent = payable.toFixed(1) + 'h';
  var csjStatusEl = el('csjStatStatus');
  if (csjStatusEl) csjStatusEl.innerHTML = getCSJStatusLabel(csjStatus);
  var csjSchedEl = el('csjStatScheduled');
  if (csjSchedEl) csjSchedEl.textContent = scheduled.toFixed(1) + 'h';

  // Color the CSJ stat card based on status
  var csjCard = el('csjStatCard');
  if (csjCard) {
    if (csjStatus === 'danger') csjCard.style.borderLeft = '4px solid #dc2626';
    else if (csjStatus === 'warning') csjCard.style.borderLeft = '4px solid #d97706';
    else csjCard.style.borderLeft = '4px solid #16a34a';
  }
}

/* ═══════════════════════════════════════════════════════
   MY SCHEDULE
   ═══════════════════════════════════════════════════════ */
function renderMySchedule() {
  var sched = getScheduleForUser();
  var container = el('scheduleDisplay');

  if (!sched || (!sched.workDays && !sched.startTime)) {
    container.innerHTML = '<p class="spm-empty">No schedule configured. Contact your supervisor or administrator.</p>';
  } else {
    var days = Array.isArray(sched.workDays) ? sched.workDays : (sched.workDays || '').split(',').map(function(d) { return d.trim(); });
    var html = '<div style="margin-bottom:12px">';
    html += '<div class="spm-schedule-row"><span class="spm-schedule-day">Start Time:</span><span class="spm-schedule-time"><strong>' + fmtTime(sched.startTime) + '</strong></span></div>';
    html += '<div class="spm-schedule-row"><span class="spm-schedule-day">End Time:</span><span class="spm-schedule-time"><strong>' + fmtTime(sched.endTime) + '</strong></span></div>';
    html += '<div class="spm-schedule-row"><span class="spm-schedule-day">Work Days:</span><span class="spm-schedule-time"><strong>' + days.join(', ') + '</strong></span></div>';
    if (sched.team) html += '<div class="spm-schedule-row"><span class="spm-schedule-day">Team:</span><span class="spm-schedule-time">' + sched.team + '</span></div>';
    if (sched.supervisor) html += '<div class="spm-schedule-row"><span class="spm-schedule-day">Supervisor:</span><span class="spm-schedule-time">' + sched.supervisor + '</span></div>';
    if (sched.period) html += '<div class="spm-schedule-row"><span class="spm-schedule-day">Period:</span><span class="spm-schedule-time">' + sched.period + '</span></div>';
    html += '</div>';
    container.innerHTML = html;
  }

  // Approved exceptions this month
  var now = new Date();
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  var approved = APP.requests.filter(function(r) {
    var d = getRequestData(r);
    return (d.status === REQUEST_STATUS.APPROVED || d.status === REQUEST_STATUS.CONDITIONS) && r.created >= monthStart;
  });
  var tbody = el('scheduleExceptionsTbody');
  if (approved.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="spm-empty">No approved exceptions this month</td></tr>';
  } else {
    tbody.innerHTML = approved.map(function(r) {
      var d = getRequestData(r);
      return '<tr>' +
        '<td>' + fmtDate(d.requestDate) + '</td>' +
        '<td>' + (REQUEST_TYPE_LABELS[d.requestType] || d.requestType || '—') + '</td>' +
        '<td>' + fmtTime(d.originalStart) + ' – ' + fmtTime(d.originalEnd) + '</td>' +
        '<td>' + fmtTime(d.requestedStart) + ' – ' + fmtTime(d.requestedEnd) + '</td>' +
        '<td>' + (d.paymentTreatment || 'Unpaid') + '</td>' +
        '</tr>';
    }).join('');
  }

  // Upcoming approved Out of Office days
  var oooDays = APP.requests.filter(function(r) {
    var d = getRequestData(r);
    return d.isOutOfOffice === 'yes' && (d.status === REQUEST_STATUS.APPROVED || d.status === REQUEST_STATUS.CONDITIONS) && d.requestDate >= todayStr();
  });
  var oooContainer = el('scheduleOooTbody');
  if (oooContainer) {
    if (oooDays.length === 0) {
      oooContainer.innerHTML = '<tr><td colspan="5" class="spm-empty">No upcoming out-of-office days</td></tr>';
    } else {
      oooContainer.innerHTML = oooDays.map(function(r) {
        var d = getRequestData(r);
        return '<tr>' +
          '<td>' + fmtDate(d.requestDate) + '</td>' +
          '<td>' + (d.oooLocation || '—') + '</td>' +
          '<td>' + (d.oooDuration === 'fullDay' ? 'Full Day' : d.oooDuration === 'halfDay' ? 'Half Day' : (fmtTime(d.requestedStart) + ' – ' + fmtTime(d.requestedEnd))) + '</td>' +
          '<td>' + fmtStatus(d.status) + '</td>' +
          '<td>' + (d.paymentTreatment === 'paid' ? '<span style="color:#16a34a">Paid</span>' : '<span style="color:#dc2626">Unpaid</span>') + '</td>' +
          '</tr>';
      }).join('');
    }
  }
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

/* ═══════════════════════════════════════════════════════
   OUT OF OFFICE VIEW
   ═══════════════════════════════════════════════════════ */
function renderOutOfOffice() {
  var reqs = (APP.role === 'admin' || APP.role === 'supervisor') ? APP.allRequests : APP.requests;
  var oooReqs = reqs.filter(function(r) { return getRequestData(r).isOutOfOffice === 'yes'; });
  oooReqs.sort(function(a, b) { return (b.created || '').localeCompare(a.created || ''); });

  var tbody = el('oooHistoryTbody');
  if (oooReqs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="spm-empty">No out-of-office declarations found</td></tr>';
  } else {
    tbody.innerHTML = oooReqs.map(function(r) {
      var d = getRequestData(r);
      var reqId = d._id || r.id || r._id || '';
      var durationLabel = d.oooDuration === 'fullDay' ? 'Full Day' : d.oooDuration === 'halfDay' ? 'Half Day' : (fmtTime(d.requestedStart) + ' – ' + fmtTime(d.requestedEnd));
      return '<tr>' +
        '<td>' + fmtDate(d.requestDate) + '</td>' +
        '<td>' + (d.oooLocation || '—') + '</td>' +
        '<td>' + durationLabel + '</td>' +
        '<td>' + (REASON_LABELS[d.reason] || d.reason || '—') + '</td>' +
        '<td>' + fmtStatus(d.status) + '</td>' +
        '<td>' + (d.paymentTreatment === 'paid' ? '<span style="color:#16a34a;font-weight:600">Paid</span>' : d.paymentTreatment === 'unpaid' ? '<span style="color:#dc2626;font-weight:600">Unpaid</span>' : 'Pending') + '</td>' +
        '<td><button class="spm-btn spm-btn-outline spm-btn-sm" onclick="viewRequestDetail(\'' + reqId + '\')"><i class="fa-solid fa-eye"></i></button></td>' +
        '</tr>';
    }).join('');
  }

  // Summary stats
  var approvedOOO = oooReqs.filter(function(r) {
    var d = getRequestData(r);
    return d.status === REQUEST_STATUS.APPROVED || d.status === REQUEST_STATUS.CONDITIONS;
  });
  var pendingOOO = oooReqs.filter(function(r) { return getRequestData(r).status === REQUEST_STATUS.PENDING; });
  var unpaidOOO = oooReqs.filter(function(r) {
    var d = getRequestData(r);
    return (d.status === REQUEST_STATUS.APPROVED || d.status === REQUEST_STATUS.CONDITIONS) && d.paymentTreatment === 'unpaid';
  });

  safeText('oooStatTotal', String(oooReqs.length));
  safeText('oooStatApproved', String(approvedOOO.length));
  safeText('oooStatPending', String(pendingOOO.length));

  var unpaidEl = el('oooStatUnpaidWarn');
  if (unpaidOOO.length > 0) {
    show(unpaidEl);
    safeText('oooStatUnpaid', String(unpaidOOO.length));
  } else {
    hide(unpaidEl);
  }
}

/* ═══════════════════════════════════════════════════════
   NEW REQUEST
   ═══════════════════════════════════════════════════════ */
function renderNewRequest() {
  var sched = getScheduleForUser();
  var display = el('currentScheduleDisplay');
  if (sched && sched.startTime && sched.endTime) {
    display.innerHTML = '<strong>Start:</strong> ' + fmtTime(sched.startTime) + ' &nbsp;|&nbsp; <strong>End:</strong> ' + fmtTime(sched.endTime) + ' &nbsp;|&nbsp; <span style="font-size:11px;color:var(--spm-text-muted)">(30 min break included)</span>';
  } else {
    display.innerHTML = '<span class="spm-muted">No regular schedule configured.</span>';
  }

  // Set today's date as default
  var today = new Date().toISOString().split('T')[0];
  safeVal('reqDate', today);

  // Reset form
  safeVal('reqType', '');
  safeVal('reqReason', '');
  safeVal('reqStartTime', '');
  safeVal('reqEndTime', '');
  safeVal('reqExplanation', '');
  safeChecked('confirm1', false);
  safeChecked('confirm2', false);
  safeChecked('confirm3', false);
  safeChecked('confirm4', false);
  safeChecked('confirm5', false);
  safeChecked('confirm6', false);
  hide(el('submitError'));
  hide(el('oooFields'));
  hide(el('oooConfirmBox'));
  show(el('standardConfirmBox'));
  show(el('standardApprovalNote'));
  hide(el('oooApprovalNote'));
  safeText('timeRowLabel1', 'Requested Start Time');
  safeText('timeRowLabel2', 'Requested End Time');

  // Pre-fill times based on request type
  el('reqType').onchange = function() {
    var type = el('reqType').value;
    var startEl = el('reqStartTime');
    var endEl = el('reqEndTime');

    // Show/hide OOO-specific fields
    if (type === 'outOfOfficeWork') {
      show(el('oooFields'));
      hide(el('standardConfirmBox'));
      show(el('oooConfirmBox'));
      hide(el('standardApprovalNote'));
      show(el('oooApprovalNote'));
      safeText('timeRowLabel1', 'OOO Start Time');
      safeText('timeRowLabel2', 'OOO End Time');
      if (startEl) { startEl.value = sched.startTime || ''; startEl.disabled = false; startEl.placeholder = 'HH:MM'; }
      if (endEl) { endEl.value = sched.endTime || ''; endEl.disabled = false; endEl.placeholder = 'HH:MM'; }
    } else {
      hide(el('oooFields'));
      show(el('standardConfirmBox'));
      hide(el('oooConfirmBox'));
      show(el('standardApprovalNote'));
      hide(el('oooApprovalNote'));
      safeText('timeRowLabel1', 'Requested Start Time');
      safeText('timeRowLabel2', 'Requested End Time');

      if (type === 'lateArrival') {
        if (startEl) startEl.value = sched.startTime ? addHours(sched.startTime, 2) : '';
        if (endEl) endEl.value = sched.endTime || '';
      } else if (type === 'earlyDeparture') {
        if (startEl) startEl.value = sched.startTime || '';
        if (endEl) endEl.value = sched.endTime ? subtractHours(sched.endTime, 2) : '';
      } else if (type === 'absenceFullDay') {
        safeVal('reqStartTime', '');
        safeVal('reqEndTime', '');
        safeDisabled('reqStartTime', true);
        safeDisabled('reqEndTime', true);
        safePlaceholder('reqStartTime', 'N/A – Full day absence');
        safePlaceholder('reqEndTime', 'N/A – Full day absence');
        return;
      } else {
        if (startEl) startEl.value = '';
        if (endEl) endEl.value = '';
      }
      if (startEl) { startEl.disabled = false; startEl.placeholder = 'HH:MM'; }
      if (endEl) { endEl.disabled = false; endEl.placeholder = 'HH:MM'; }
    }

    // Update reason dropdown for OOO
    updateReasonDropdown(type);
    // Update explanation requirement
    updateExplanationRequired();
  };

  // Also check when reason changes
  el('reqReason').onchange = function() {
    updateExplanationRequired();
  };

  updateReasonDropdown('');
  updateExplanationRequired();
}

function updateExplanationRequired() {
  var type = el('reqType').value;
  var reason = el('reqReason').value;
  var isOther = (type === 'other' || reason === 'other');
  var label = el('reqExplanationLabel');
  var textarea = el('reqExplanation');
  if (label) {
    label.innerHTML = isOther
      ? 'Additional Explanation <span class="spm-required">*</span> <span style="font-weight:400;color:var(--spm-danger);font-size:11px">(required when "Other" is selected)</span>'
      : 'Additional Explanation';
  }
  if (textarea) {
    textarea.placeholder = isOther
      ? 'REQUIRED: Please describe your situation in detail. Your supervisor needs this information to make a decision...'
      : 'Provide any additional details to help your supervisor understand your situation...';
  }
}

function updateReasonDropdown(type) {
  var sel = el('reqReason');
  var currentVal = sel.value;
  if (type === 'outOfOfficeWork') {
    sel.innerHTML = '<option value="">— Select Program / Reason —</option>' +
      '<option value="dayCamp">Day Camp / External Program</option>' +
      '<option value="fieldWork">Field Work / Community Visit</option>' +
      '<option value="trainingOffsite">Off-Site Training</option>' +
      '<option value="other">Other Off-Site Work</option>';
  } else {
    sel.innerHTML = '<option value="">— Select Reason —</option>' +
      '<option value="medical">Medical Appointment</option>' +
      '<option value="family">Family Obligation</option>' +
      '<option value="transportation">Transportation Issue</option>' +
      '<option value="emergency">Emergency</option>' +
      '<option value="personal">Personal Appointment</option>' +
      '<option value="religious">Religious Obligation</option>' +
      '<option value="school">School Obligation</option>' +
      '<option value="other">Other</option>';
  }
  sel.value = currentVal;
}

function addHours(t, h) {
  var parts = t.split(':');
  var hr = parseInt(parts[0], 10) + h;
  var mn = parts[1] || '00';
  return String(hr).padStart(2, '0') + ':' + mn;
}

function subtractHours(t, h) {
  var parts = t.split(':');
  var hr = parseInt(parts[0], 10) - h;
  var mn = parts[1] || '00';
  if (hr < 0) hr = 0;
  return String(hr).padStart(2, '0') + ':' + mn;
}

function submitRequest() {
  var reqType = el('reqType').value;
  var isOOO = (reqType === 'outOfOfficeWork');

  // Validate confirmations
  var confirmations = [
    el('confirm1').checked,
    el('confirm2').checked,
    el('confirm3').checked,
    el('confirm4').checked,
    el('confirm5').checked,
    el('confirm6') ? el('confirm6').checked : true
  ];
  var allChecked = confirmations.every(function(c) { return c; });
  if (!allChecked) {
    showError('Please check ALL confirmation boxes before submitting, including the CSJ Funding Rules acknowledgment.');
    return;
  }

  // Validate required fields
  var reqDate = el('reqDate').value;
  var reqReason = el('reqReason').value;

  if (!reqType) { showError('Please select a request type.'); return; }
  if (!reqDate) { showError('Please select a date.'); return; }
  if (!reqReason) { showError(isOOO ? 'Please select a program/reason.' : 'Please select a reason.'); return; }

  // When "Other" is selected as request type or reason, explanation is mandatory
  var explanation = el('reqExplanation').value.trim();
  if ((reqType === 'other' || reqReason === 'other') && !explanation) {
    showError('When "Other" is selected, you must provide an explanation. Please describe your situation in the Additional Explanation field below.');
    return;
  }

  // OOO-specific validation
  var oooLocation = '';
  var oooDuration = '';
  if (isOOO) {
    var oooLocEl = el('oooLocation');
    var oooDurEl = el('oooDuration');
    oooLocation = oooLocEl ? oooLocEl.value.trim() : '';
    oooDuration = oooDurEl ? oooDurEl.value : '';
    if (!oooLocation) { showError('Please enter the program name or off-site location.'); return; }
    if (!oooDuration) { showError('Please select the duration (full day, half day, or custom hours).'); return; }
  }

  // CSJ Compliance check — warn if this request risks dropping the week below 30h
  var csjWarning = '';
  if (reqType !== 'outOfOfficeWork') {
    var reqWeekStart = getWeekStart(reqDate);
    var currentUnpaid = getWeeklyUnpaidHours(reqWeekStart);
    // Estimate the unpaid hours this new request would add (if approved as unpaid)
    var estNewUnpaid = 0;
    if (reqType === 'absenceFullDay') {
      estNewUnpaid = getDailyScheduledHours();
    } else if (reqType === 'lateArrival' && startTime) {
      var origStart = sched ? sched.startTime : '';
      estNewUnpaid = calcHours(origStart, startTime);
    } else if (reqType === 'earlyDeparture' && endTime) {
      var origEnd = sched ? sched.endTime : '';
      estNewUnpaid = calcHours(endTime, origEnd);
    } else if (reqType === 'absencePartialDay' && startTime && endTime) {
      var oS = sched ? sched.startTime : '';
      var oE = sched ? sched.endTime : '';
      estNewUnpaid = calcHours(oS, oE) - calcHours(startTime, endTime);
    }
    var projectedPayable = getWeeklyScheduledHours() - currentUnpaid - estNewUnpaid;
    var csjMin = getCSJMinHours();
    if (projectedPayable < csjMin) {
      csjWarning = '\n\n⚠️ CSJ FUNDING WARNING: If this request is approved as unpaid, your payable hours for the week of ' +
        fmtDate(reqWeekStart) + ' would drop to approximately ' + projectedPayable.toFixed(1) +
        'h — below the CSJ minimum of ' + csjMin + 'h. This may make that week\'s wages INELIGIBLE for Canada Summer Jobs reimbursement. ' +
        'Consider whether same-week hour adjustments are possible. Contact your supervisor or administrator if you have questions.';
    }
  }

  // Prevent retroactive requests (allow same day)
  var today = new Date().toISOString().split('T')[0];
  if (reqDate < today) {
    showError('Requests must be submitted before or on the day of the change. Retroactive requests require administrator approval.');
    return;
  }

  // Validate times (except for full day absence)
  var startTime = el('reqStartTime').value;
  var endTime = el('reqEndTime').value;
  if (reqType !== 'absenceFullDay' && (!startTime || !endTime)) {
    showError('Please provide requested start and end times.');
    return;
  }

  var sched = getScheduleForUser();

  var requestData = {
    requestType: reqType,
    requestDate: reqDate,
    reason: reqReason,
    explanation: explanation || '',
    status: REQUEST_STATUS.PENDING,
    employeeId: APP.user ? (APP.user.id || APP.user.email || '') : '',
    employeeName: APP.user ? (APP.user.name || APP.user.email || '') : '',
    employeeEmail: APP.user ? (APP.user.email || '') : '',
    employeeTeam: APP.employeeTeam || '',
    employeeSupervisor: APP.employeeSupervisor || '',
    employeePeriod: APP.employeePeriod || '',
    originalStart: sched ? sched.startTime : '',
    originalEnd: sched ? sched.endTime : '',
    requestedStart: startTime,
    requestedEnd: endTime,
    decision: '',
    decisionComment: '',
    paymentTreatment: isOOO ? 'paid' : '',
    scheduleChange: 'no',
    denialReason: '',
    reviewedBy: '',
    reviewedAt: '',
    escalatedAt: '',
    escalationReason: '',
    isOutOfOffice: isOOO ? 'yes' : 'no',
    oooLocation: oooLocation,
    oooDuration: oooDuration,
    locked: APP.role === 'admin' ? 'no' : 'yes'
  };

  if (typeof tool.requestObjects !== 'function') {
    // Fallback: save to tool value
    var existing = tool.getValue() || { requests: [] };
    if (!Array.isArray(existing.requests)) existing.requests = [];
    requestData._id = 'req-' + Date.now();
    requestData._created = new Date().toISOString();
    existing.requests.push(requestData);
    tool.setValue(existing);
    toast('Request submitted successfully!', 'success');
    switchView('requestHistory');
    return;
  }

  var label = REQUEST_TYPE_LABELS[reqType] || reqType;
  tool.requestObjects('create', {
    mainObjectType: REQUEST_TYPE,
    name: (APP.user ? APP.user.name || 'Employee' : 'Employee') + ' – ' + label + ' – ' + reqDate,
    productData: { data_categoriesBased: requestData }
  }, function(err, result) {
    if (err) { toast('Failed to submit request: ' + err, 'error'); return; }
    var msg = isOOO
      ? 'Out-of-office work declaration submitted! Your supervisor will review and approve it for payment.'
      : 'Request submitted successfully! Your supervisor will review it.';
    toast(msg, 'success');
    if (csjWarning) {
      setTimeout(function() { toast(csjWarning, 'warning'); }, 1500);
    }
    loadAllData(function() { switchView('requestHistory'); });
  });
}

function showError(msg) {
  var errEl = el('submitError');
  errEl.textContent = msg;
  show(errEl);
  setTimeout(function() { hide(errEl); }, 5000);
}

/* ═══════════════════════════════════════════════════════
   REQUEST HISTORY
   ═══════════════════════════════════════════════════════ */
function renderRequestHistory() {
  var filter = el('historyFilter').value || 'all';
  var reqs = APP.requests.slice().sort(function(a, b) { return (b.created || '').localeCompare(a.created || ''); });

  if (filter !== 'all') {
    reqs = reqs.filter(function(r) { return getRequestData(r).status === filter; });
  }

  var tbody = el('historyTbody');
  if (reqs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="spm-empty">No requests found</td></tr>';
  } else {
    tbody.innerHTML = reqs.map(function(r) {
      var d = getRequestData(r);
      return '<tr>' +
        '<td>' + fmtDate(d.requestDate) + '</td>' +
        '<td>' + (REQUEST_TYPE_LABELS[d.requestType] || d.requestType || '—') + '</td>' +
        '<td>' + (REASON_LABELS[d.reason] || d.reason || '—') + '</td>' +
        '<td>' + fmtStatus(d.status) + '</td>' +
        '<td>' + (d.decision || 'Pending') + '</td>' +
        '<td><button class="spm-btn spm-btn-outline spm-btn-sm" onclick="viewRequestDetail(\'' + (d._id || '') + '\')"><i class="fa-solid fa-eye"></i></button></td>' +
        '</tr>';
    }).join('');
  }
}

// Filter change handler
document.addEventListener('change', function(e) {
  if (e.target.id === 'historyFilter') renderRequestHistory();
});

/* ═══════════════════════════════════════════════════════
   REQUEST DETAIL MODAL
   ═══════════════════════════════════════════════════════ */
function viewRequestDetail(reqId) {
  var allReqs = APP.allRequests.concat(APP.requests);
  var found = null;
  for (var i = 0; i < allReqs.length; i++) {
    var rr = allReqs[i];
    var dd = getRequestData(rr);
    if (dd._id === reqId || rr.id === reqId || rr._id === reqId) { found = rr; break; }
  }
  if (!found) { toast('Request not found.', 'warning'); return; }

  var d = getRequestData(found);
  var body = el('detailModalBody');
  var isOOO = (d.isOutOfOffice === 'yes');

  var rows = [
    { l: 'Employee', v: d.employeeName || '—' },
    { l: 'Team', v: d.employeeTeam || '—' },
    { l: 'Request Type', v: REQUEST_TYPE_LABELS[d.requestType] || d.requestType || '—' },
    { l: 'Date', v: fmtDate(d.requestDate) },
    { l: 'Reason', v: REASON_LABELS[d.reason] || d.reason || '—' }
  ];

  if (isOOO) {
    rows.push({ l: 'Program / Location', v: d.oooLocation || '—' });
    rows.push({ l: 'Duration', v: d.oooDuration === 'fullDay' ? 'Full Day' : d.oooDuration === 'halfDay' ? 'Half Day' : (fmtTime(d.requestedStart) + ' – ' + fmtTime(d.requestedEnd)) });
  }

  rows.push(
    { l: 'Original Schedule', v: fmtTime(d.originalStart) + ' – ' + fmtTime(d.originalEnd) },
    { l: isOOO ? 'OOO Work Hours' : 'Requested Schedule', v: d.requestType === 'absenceFullDay' ? 'Full Day Absence' : (fmtTime(d.requestedStart) + ' – ' + fmtTime(d.requestedEnd)) },
    { l: 'Status', v: fmtStatus(d.status) },
    { l: 'Decision', v: d.decision || 'Pending' },
    { l: 'Payment', v: d.paymentTreatment === 'paid' ? '<span style="color:#16a34a;font-weight:600">Paid</span>' : d.paymentTreatment === 'unpaid' ? '<span style="color:#dc2626;font-weight:600">Unpaid</span>' : (d.paymentTreatment || '—') },
    { l: 'Schedule Change', v: d.scheduleChange === 'yes' ? 'Yes – Permanent Change' : 'No – One-time Exception' },
    { l: 'Comment', v: d.decisionComment || d.explanation || '—' },
    { l: 'Reviewed By', v: d.reviewedBy || '—' },
    { l: 'Reviewed At', v: fmtDate(d.reviewedAt) },
    { l: 'Submitted', v: fmtDate(found.created) }
  );

  body.innerHTML = rows.map(function(r) {
    return '<div class="spm-detail-row"><span class="spm-detail-label">' + r.l + '</span><span class="spm-detail-value">' + r.v + '</span></div>';
  }).join('');

  // OOO-specific banner
  if (isOOO && (d.status === REQUEST_STATUS.APPROVED || d.status === REQUEST_STATUS.CONDITIONS)) {
    body.innerHTML += '<div class="spm-exception-banner"><i class="fa-solid fa-circle-info"></i> This out-of-office work has been <strong>approved</strong>. Your hours at ' + (d.oooLocation || 'the off-site location') + ' are <strong>paid</strong> as scheduled work.</div>';
  }

  if (isOOO && d.status === REQUEST_STATUS.DENIED) {
    body.innerHTML += '<div class="spm-approval-note" style="background:#fee2e2;border-color:#fca5a5;color:#991b1b;"><i class="fa-solid fa-circle-xmark"></i><div>This out-of-office work was <strong>not approved</strong>. These hours will be <strong>unpaid</strong>. You must work from your regular location or submit a new request.</div></div>';
  }

  // Exception banner for approved requests (non-OOO)
  if (!isOOO && (d.status === REQUEST_STATUS.APPROVED || d.status === REQUEST_STATUS.CONDITIONS)) {
    body.innerHTML += '<div class="spm-exception-banner"><i class="fa-solid fa-circle-info"></i> <strong>Single-day exception only.</strong> This approval applies <strong>exclusively to ' + fmtDate(d.requestDate) + '</strong>. It does NOT change your regular schedule. Every other day remains unchanged. This approval means nothing for any other date.</div>';
  }

  // Denial message
  if (!isOOO && d.status === REQUEST_STATUS.DENIED) {
    body.innerHTML += '<div class="spm-approval-note" style="background:#fee2e2;border-color:#fca5a5;color:#991b1b;"><i class="fa-solid fa-circle-xmark"></i><div>Your request was <strong>not approved</strong>. Your original schedule remains unchanged.</div></div>';
  }

  // Lock indicator for employees
  if (d.locked === 'yes' && APP.role === 'employee') {
    body.innerHTML += '<div class="spm-approval-note" style="background:#fef3c7;border-color:#fbbf24;color:#92400e;"><i class="fa-solid fa-lock"></i><div>This request is <strong>locked</strong>. You cannot edit it after submission. Contact an administrator if you need to make changes.</div></div>';
  }

  // Returned-for-revision indicator
  if (d.status === REQUEST_STATUS.RETURNED && APP.role === 'employee') {
    body.innerHTML += '<div class="spm-approval-note" style="background:#fce7f3;border-color:#f9a8d4;color:#9d174d;"><i class="fa-solid fa-pen-to-square"></i><div>Your request has been <strong>returned for revision</strong> by an administrator. It is now unlocked — you can edit and resubmit it.</div></div>';
  }

  el('detailModalTitle').textContent = 'Request Details';
  var footer = el('detailModalFooter');

  // Footer actions
  var actionsHtml = '<button class="spm-btn spm-btn-outline" onclick="closeModal(\'detailModal\')">Close</button>';

  // Admin: Return for Revision (unlock) — on any locked employee request
  if (APP.role === 'admin' && d.locked === 'yes' && d.status !== REQUEST_STATUS.RETURNED) {
    actionsHtml += '<button class="spm-btn spm-btn-warning" onclick="closeModal(\'detailModal\');unlockRequest(\'' + (d._id || '') + '\')"><i class="fa-solid fa-unlock"></i> Return for Revision</button>';
  }

  // Supervisor/Admin can review pending requests
  if ((APP.role === 'supervisor' || APP.role === 'admin') && d.status === REQUEST_STATUS.PENDING) {
    actionsHtml += '<button class="spm-btn spm-btn-success" onclick="closeModal(\'detailModal\');openReviewDecision(\'' + (d._id || '') + '\')"><i class="fa-solid fa-gavel"></i> Review This Request</button>';
  }

  // Admin can override
  if (APP.role === 'admin' && d.status !== REQUEST_STATUS.PENDING && d.status !== REQUEST_STATUS.RETURNED) {
    actionsHtml += '<button class="spm-btn spm-btn-warning" onclick="closeModal(\'detailModal\');openReviewDecision(\'' + (d._id || '') + '\')"><i class="fa-solid fa-rotate"></i> Override Decision</button>';
  }

  footer.innerHTML = actionsHtml;
  show(el('detailModal'));
}

/* ═══════════════════════════════════════════════════════
   ADMIN: UNLOCK REQUEST (Return for Revision)
   ═══════════════════════════════════════════════════════ */
function unlockRequest(reqId) {
  if (APP.role !== 'admin') { toast('Only administrators can unlock requests.', 'warning'); return; }

  var allReqs = APP.allRequests;
  var found = null;
  for (var i = 0; i < allReqs.length; i++) {
    var rr = allReqs[i];
    var dd = getRequestData(rr);
    if (dd._id === reqId || rr.id === reqId || rr._id === reqId) { found = rr; break; }
  }
  if (!found) { toast('Request not found.', 'warning'); return; }

  var updates = {
    locked: 'no',
    status: REQUEST_STATUS.RETURNED,
    decisionComment: (getRequestData(found).decisionComment || '') + ' [Returned for revision by admin on ' + new Date().toISOString().split('T')[0] + ']'
  };

  if (typeof tool.requestObjects !== 'function') {
    var existing = tool.getValue() || { requests: [] };
    if (!Array.isArray(existing.requests)) existing.requests = [];
    for (var j = 0; j < existing.requests.length; j++) {
      if (existing.requests[j]._id === reqId) {
        for (var k in updates) { existing.requests[j][k] = updates[k]; }
        break;
      }
    }
    tool.setValue(existing);
    toast('Request unlocked and returned for revision.', 'success');
    loadAllData(function() { refreshCurrentView(); });
    return;
  }

  tool.requestObjects('update', {
    mainObjectType: REQUEST_TYPE,
    objectId: found.id || found._id || reqId,
    productData: { data_categoriesBased: updates }
  }, function(err, result) {
    if (err) { toast('Failed to unlock request: ' + err, 'error'); return; }
    toast('Request returned for revision. Employee can now edit and resubmit.', 'success');
    loadAllData(function() { refreshCurrentView(); });
  });
}

function closeModal(id) {
  hide(el(id));
}

// Close modal on backdrop click
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('spm-modal-overlay')) {
    hide(e.target);
  }
});

/* ═══════════════════════════════════════════════════════
   REVIEW QUEUE (Supervisor)
   ═══════════════════════════════════════════════════════ */
function renderReviewQueue() {
  if (APP.role !== 'supervisor' && APP.role !== 'admin') {
    el('reviewList').innerHTML = '<p class="spm-empty">You do not have permission to review requests.</p>';
    return;
  }

  var pending = APP.allRequests.filter(function(r) { return getRequestData(r).status === REQUEST_STATUS.PENDING; });
  pending.sort(function(a, b) { return (a.created || '').localeCompare(b.created || ''); });

  var container = el('reviewList');
  if (pending.length === 0) {
    container.innerHTML = '<p class="spm-empty">No pending requests to review.</p>';
    return;
  }

  container.innerHTML = pending.map(function(r) {
    var d = getRequestData(r);
    var reqId = d._id || r.id || r._id || '';
    var prevCount = countPreviousRequests(d.employeeId, 30);

    var html = '<div class="spm-review-card">';
    html += '<div class="spm-review-header">';
    html += '<span class="spm-review-employee">' + (d.employeeName || 'Unknown') + '</span>';
    html += '<span class="spm-review-meta">Submitted: ' + fmtDate(r.created) + '</span>';
    html += '</div>';

    html += '<div class="spm-review-detail">';
    html += '<div><span class="spm-review-label">Type:</span> <span class="spm-review-value">' + (REQUEST_TYPE_LABELS[d.requestType] || d.requestType) + '</span></div>';
    html += '<div><span class="spm-review-label">Date:</span> <span class="spm-review-value"><strong>' + fmtDate(d.requestDate) + '</strong> (single-day only)</span></div>';
    html += '<div><span class="spm-review-label">Original:</span> <span class="spm-review-value">' + fmtTime(d.originalStart) + ' – ' + fmtTime(d.originalEnd) + '</span></div>';
    html += '<div><span class="spm-review-label">Requested:</span> <span class="spm-review-value">' + (d.requestType === 'absenceFullDay' ? 'Full Day Absence' : fmtTime(d.requestedStart) + ' – ' + fmtTime(d.requestedEnd)) + '</span></div>';
    html += '<div><span class="spm-review-label">Team:</span> <span class="spm-review-value">' + (d.employeeTeam || '—') + '</span></div>';
    html += '<div><span class="spm-review-label">Reason:</span> <span class="spm-review-value">' + (REASON_LABELS[d.reason] || d.reason) + '</span></div>';
    html += '</div>';

    if (d.explanation) {
      html += '<div class="spm-review-reason"><strong>Explanation:</strong> ' + d.explanation + '</div>';
    }

    if (prevCount >= 3) {
      html += '<div class="spm-review-history"><i class="fa-solid fa-triangle-exclamation"></i> <strong>Flag:</strong> This employee has <strong>' + prevCount + '</strong> requests in the last 30 days. Consider escalation.</div>';
    }

    html += '<div class="spm-exception-banner"><i class="fa-solid fa-calendar-day"></i> <strong>Single-day exception only.</strong> Approving this request only affects <strong>' + fmtDate(d.requestDate) + '</strong>. It does NOT change the employee\'s regular schedule for any other day. This approval means nothing for any other date.</div>';

    html += '<div class="spm-review-actions">';
    html += '<button class="spm-btn spm-btn-success spm-btn-sm" onclick="openReviewDecision(\'' + reqId + '\')"><i class="fa-solid fa-gavel"></i> Review &amp; Decide</button>';
    html += '<button class="spm-btn spm-btn-outline spm-btn-sm" onclick="viewRequestDetail(\'' + reqId + '\')"><i class="fa-solid fa-eye"></i> Full Details</button>';
    html += '</div>';

    html += '</div>';
    return html;
  }).join('');
}

function countPreviousRequests(empId, days) {
  if (!empId) return 0;
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  var cutoffStr = cutoff.toISOString();
  return APP.allRequests.filter(function(r) {
    var d = getRequestData(r);
    return d.employeeId === empId && r.created >= cutoffStr;
  }).length;
}

/* ═══════════════════════════════════════════════════════
   REVIEW DECISION (inline in review card / modal)
   ═══════════════════════════════════════════════════════ */
function openReviewDecision(reqId) {
  var allReqs = APP.allRequests;
  var found = null;
  for (var i = 0; i < allReqs.length; i++) {
    var rr = allReqs[i];
    var dd = getRequestData(rr);
    if (dd._id === reqId || rr.id === reqId || rr._id === reqId) { found = rr; break; }
  }
  if (!found) { toast('Request not found.', 'warning'); return; }

  var d = getRequestData(found);
  var body = el('detailModalBody');
  var isOverride = (d.status !== REQUEST_STATUS.PENDING && APP.role === 'admin');

  var html = '<div style="margin-bottom:16px">';
  html += '<p><strong>Employee:</strong> ' + (d.employeeName || '—') + '</p>';
  html += '<p><strong>Type:</strong> ' + (REQUEST_TYPE_LABELS[d.requestType] || d.requestType) + '</p>';
  html += '<p><strong>Date:</strong> ' + fmtDate(d.requestDate) + '</p>';
  html += '<p><strong>Current Status:</strong> ' + fmtStatus(d.status) + '</p>';
  html += '</div>';

  if (isOverride) {
    html += '<div class="spm-approval-note"><i class="fa-solid fa-triangle-exclamation"></i><div>You are <strong>overriding</strong> an existing decision as an administrator.</div></div>';
  }

  // Decision form
  html += '<div class="spm-decision-form">';
  html += '<div class="spm-form-group"><label class="spm-label">Decision <span class="spm-required">*</span></label>';
  html += '<select class="spm-select" id="reviewDecision">';
  html += '<option value="">— Select Decision —</option>';
  html += '<option value="approved">Approved</option>';
  html += '<option value="conditions">Approved with Conditions</option>';
  html += '<option value="denied">Denied</option>';
  html += '<option value="escalated">Escalate to Administrator</option>';
  html += '</select></div>';

  // Payment treatment (shown for approved/conditions)
  html += '<div class="spm-form-group" id="paymentGroup" style="display:none">';
  html += '<label class="spm-label">Payment Treatment <span class="spm-required">*</span></label>';
  html += '<select class="spm-select" id="reviewPayment">';
  html += '<option value="unpaid">Unpaid – Employee did not work approved time</option>';
  html += '<option value="paid">Paid – Employee worked scheduled hours</option>';
  html += '<option value="adminReview">Requires Administrator Review</option>';
  html += '</select></div>';

  // Schedule change
  html += '<div class="spm-form-group" id="scheduleChangeGroup" style="display:none">';
  html += '<label class="spm-label">Does this change the regular schedule?</label>';
  html += '<select class="spm-select" id="reviewScheduleChange">';
  html += '<option value="no">No – One-time exception only</option>';
  html += '<option value="yes">Yes – Requires administrator approval</option>';
  html += '</select></div>';

  // Denial reason (shown for denied)
  html += '<div class="spm-form-group" id="denialGroup" style="display:none">';
  html += '<label class="spm-label">Denial Reason <span class="spm-required">*</span></label>';
  html += '<select class="spm-select" id="reviewDenialReason">';
  html += '<option value="">— Select Reason —</option>';
  DENIAL_REASONS.forEach(function(dr) { html += '<option value="' + dr + '">' + dr + '</option>'; });
  html += '</select></div>';

  // Comment
  html += '<div class="spm-form-group">';
  html += '<label class="spm-label">Comment <span class="spm-required">*</span></label>';
  html += '<textarea class="spm-textarea" id="reviewComment" rows="3" placeholder="Provide a reason for your decision..."></textarea>';
  html += '</div>';

  html += '</div>';

  body.innerHTML = html;
  el('detailModalTitle').textContent = isOverride ? 'Override Decision' : 'Review Request';
  el('detailModalFooter').innerHTML =
    '<button class="spm-btn spm-btn-outline" onclick="closeModal(\'detailModal\')">Cancel</button>' +
    '<button class="spm-btn spm-btn-success" onclick="submitDecision(\'' + (d._id || '') + '\')"><i class="fa-solid fa-check"></i> Submit Decision</button>';

  // Toggle dependent fields
  var decisionSelect = el('reviewDecision');
  if (decisionSelect) {
    decisionSelect.onchange = function() {
      var val = this.value;
      var showPayment = (val === 'approved' || val === 'conditions');
      var showSchedule = (val === 'approved' || val === 'conditions');
      var showDenial = (val === 'denied');
      el('paymentGroup').style.display = showPayment ? '' : 'none';
      el('scheduleChangeGroup').style.display = showSchedule ? '' : 'none';
      el('denialGroup').style.display = showDenial ? '' : 'none';
    };
  }

  show(el('detailModal'));
}

function submitDecision(reqId) {
  var decision = el('reviewDecision').value;
  var comment = el('reviewComment').value;

  if (!decision) { toast('Please select a decision.', 'warning'); return; }
  if (!comment) { toast('Please provide a comment for your decision.', 'warning'); return; }

  if (decision === 'denied' && !el('reviewDenialReason').value) {
    toast('Please select a denial reason.', 'warning'); return;
  }

  var allReqs = APP.allRequests;
  var found = null;
  for (var i = 0; i < allReqs.length; i++) {
    var rr = allReqs[i];
    var dd = getRequestData(rr);
    if (dd._id === reqId || rr.id === reqId || rr._id === reqId) { found = rr; break; }
  }
  if (!found) { toast('Request not found.', 'warning'); return; }

  var d = getRequestData(found);
  var now = new Date().toISOString();
  var reviewerName = APP.user ? (APP.user.name || APP.user.email || '') : '';

  var updates = {
    status: decision,
    decision: decision === 'conditions' ? 'Approved with Conditions' : (decision.charAt(0).toUpperCase() + decision.slice(1)),
    decisionComment: comment,
    reviewedBy: reviewerName,
    reviewedAt: now
  };

  if (decision === 'approved' || decision === 'conditions') {
    updates.paymentTreatment = el('reviewPayment').value;
    updates.scheduleChange = el('reviewScheduleChange').value;
  }

  if (decision === 'denied') {
    updates.denialReason = el('reviewDenialReason').value;
    updates.paymentTreatment = '';
    updates.scheduleChange = 'no';
  }

  if (decision === 'escalated') {
    updates.escalatedAt = now;
    updates.escalationReason = comment;
  }

  if (typeof tool.requestObjects !== 'function') {
    // Fallback
    var existing = tool.getValue() || { requests: [] };
    if (!Array.isArray(existing.requests)) existing.requests = [];
    for (var j = 0; j < existing.requests.length; j++) {
      if (existing.requests[j]._id === reqId) {
        for (var k in updates) { existing.requests[j][k] = updates[k]; }
        break;
      }
    }
    tool.setValue(existing);
    closeModal('detailModal');
    toast('Decision submitted!', 'success');
    loadAllData(function() { refreshCurrentView(); });
    return;
  }

  tool.requestObjects('update', {
    mainObjectType: REQUEST_TYPE,
    objectId: found.id || found._id || reqId,
    productData: { data_categoriesBased: updates }
  }, function(err, result) {
    if (err) { toast('Failed to save decision: ' + err, 'error'); return; }
    closeModal('detailModal');
    var msg = decision === 'approved' ? 'Request approved!' : (decision === 'denied' ? 'Request denied.' : 'Decision saved.');
    toast(msg, decision === 'approved' ? 'success' : 'info');

    // Notify employee
    if (APP.user && d.employeeEmail && d.employeeEmail !== APP.user.email) {
      var notifyMsg = 'Your schedule change request for ' + fmtDate(d.requestDate) + ' has been ' + (decision === 'approved' ? 'approved' : decision) + '.';
      // Could use tool.requestSendEmail if configured, but we'll just toast for now
    }

    loadAllData(function() { refreshCurrentView(); });
  });
}

/* ═══════════════════════════════════════════════════════
   ADMIN CONSOLE
   ═══════════════════════════════════════════════════════ */
function renderAdminConsole() {
  if (APP.role !== 'admin') {
    el('adminConsistencyTbody').innerHTML = '<tr><td colspan="7" class="spm-empty">Administrator access required.</td></tr>';
    return;
  }

  // Supervisor consistency
  renderSupervisorConsistency();

  // All requests table
  renderAllRequestsAdmin();

  // Flagged items
  renderFlaggedItems();
}

function renderSupervisorConsistency() {
  var reqs = APP.allRequests;
  // Group by reviewer
  var byReviewer = {};
  reqs.forEach(function(r) {
    var d = getRequestData(r);
    var rev = d.reviewedBy || 'Unreviewed';
    if (!byReviewer[rev]) byReviewer[rev] = { total: 0, approved: 0, denied: 0, escalated: 0, times: [] };
    byReviewer[rev].total++;
    if (d.status === REQUEST_STATUS.APPROVED || d.status === REQUEST_STATUS.CONDITIONS) byReviewer[rev].approved++;
    if (d.status === REQUEST_STATUS.DENIED) byReviewer[rev].denied++;
    if (d.status === REQUEST_STATUS.ESCALATED) byReviewer[rev].escalated++;
    if (d.reviewedAt && r.created) {
      var reviewTime = new Date(d.reviewedAt).getTime() - new Date(r.created).getTime();
      if (reviewTime > 0) byReviewer[rev].times.push(reviewTime);
    }
  });

  var reviewers = Object.keys(byReviewer);
  if (reviewers.length === 0 || (reviewers.length === 1 && reviewers[0] === 'Unreviewed')) {
    el('adminConsistencyTbody').innerHTML = '<tr><td colspan="7" class="spm-empty">No review data available yet.</td></tr>';
    return;
  }

  // Calculate variance threshold
  var rates = reviewers.map(function(r) {
    var d = byReviewer[r];
    return { name: r, rate: d.total > 0 ? Math.round((d.approved / d.total) * 100) : 0, data: d };
  });
  var avgRate = rates.reduce(function(s, r) { return s + r.rate; }, 0) / Math.max(rates.length, 1);
  var threshold = parseInt(tool.param('supervisorVarianceThreshold', '20'), 10);

  var tbody = el('adminConsistencyTbody');
  tbody.innerHTML = rates.map(function(r) {
    var avgTime = '—';
    if (r.data.times.length > 0) {
      var avgMs = r.data.times.reduce(function(s, t) { return s + t; }, 0) / r.data.times.length;
      var avgHours = Math.round(avgMs / 3600000 * 10) / 10;
      avgTime = avgHours + 'h';
    }

    var statusHtml = '';
    var variance = Math.abs(r.rate - avgRate);
    if (variance > threshold && r.data.total >= 3) {
      statusHtml = '<span style="color:#dc2626"><i class="fa-solid fa-flag"></i> Review needed</span>';
    } else if (r.rate > 90 && r.data.total >= 5) {
      statusHtml = '<span style="color:#d97706"><i class="fa-solid fa-exclamation-triangle"></i> High approval rate</span>';
    } else if (r.data.total > 0) {
      statusHtml = '<span style="color:#16a34a"><i class="fa-solid fa-check"></i> Consistent</span>';
    }

    return '<tr>' +
      '<td><strong>' + r.name + '</strong></td>' +
      '<td>' + r.data.total + '</td>' +
      '<td>' + r.data.approved + '</td>' +
      '<td>' + r.data.denied + '</td>' +
      '<td>' + r.rate + '%</td>' +
      '<td>' + avgTime + '</td>' +
      '<td>' + statusHtml + '</td>' +
      '</tr>';
  }).join('');
}

function renderAllRequestsAdmin() {
  var reqs = APP.allRequests.slice().sort(function(a, b) { return (b.created || '').localeCompare(a.created || ''); });
  var tbody = el('adminAllTbody');
  if (reqs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="spm-empty">No requests found.</td></tr>';
    return;
  }
  tbody.innerHTML = reqs.map(function(r) {
    var d = getRequestData(r);
    var reqId = d._id || r.id || r._id || '';
    return '<tr>' +
      '<td>' + (d.employeeName || '—') + '</td>' +
      '<td>' + fmtDate(d.requestDate) + '</td>' +
      '<td>' + (REQUEST_TYPE_LABELS[d.requestType] || d.requestType || '—') + '</td>' +
      '<td>' + fmtStatus(d.status) + '</td>' +
      '<td>' + (d.reviewedBy || '—') + '</td>' +
      '<td>' +
        '<button class="spm-btn spm-btn-outline spm-btn-sm" onclick="viewRequestDetail(\'' + reqId + '\')"><i class="fa-solid fa-eye"></i></button> ' +
        '<button class="spm-btn spm-btn-warning spm-btn-sm" onclick="openReviewDecision(\'' + reqId + '\')"><i class="fa-solid fa-gavel"></i></button>' +
      '</td>' +
      '</tr>';
  }).join('');
}

function renderFlaggedItems() {
  var flagged = [];
  var reqs = APP.allRequests;

  // Flag employees with > threshold requests in 30 days
  var threshold = parseInt(tool.param('escalationThreshold', '3'), 10);
  var empCounts = {};
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  var cutoffStr = cutoff.toISOString();

  reqs.forEach(function(r) {
    var d = getRequestData(r);
    if (!d.employeeId) return;
    if (!empCounts[d.employeeId]) empCounts[d.employeeId] = { name: d.employeeName, count: 0 };
    if (r.created >= cutoffStr) empCounts[d.employeeId].count++;
  });

  for (var empId in empCounts) {
    if (empCounts[empId].count > threshold) {
      flagged.push({
        type: 'warn',
        title: empCounts[empId].name + ' – ' + empCounts[empId].count + ' requests in 30 days',
        detail: 'Threshold is ' + threshold + '. Review this employee\'s request pattern.'
      });
    }
  }

  // Flag supervisors with high variance
  var byReviewer = {};
  reqs.forEach(function(r) {
    var d = getRequestData(r);
    var rev = d.reviewedBy || '';
    if (!rev) return;
    if (!byReviewer[rev]) byReviewer[rev] = { approved: 0, total: 0 };
    byReviewer[rev].total++;
    if (d.status === REQUEST_STATUS.APPROVED || d.status === REQUEST_STATUS.CONDITIONS) byReviewer[rev].approved++;
  });

  var rates = [];
  for (var rev in byReviewer) {
    if (byReviewer[rev].total >= 3) {
      rates.push({ name: rev, rate: Math.round((byReviewer[rev].approved / byReviewer[rev].total) * 100) });
    }
  }
  var avgRate = rates.reduce(function(s, r) { return s + r.rate; }, 0) / Math.max(rates.length, 1);
  var varThreshold = parseInt(tool.param('supervisorVarianceThreshold', '20'), 10);

  rates.forEach(function(r) {
    if (Math.abs(r.rate - avgRate) > varThreshold) {
      flagged.push({
        type: 'warn',
        title: 'Supervisor ' + r.name + ' – ' + r.rate + '% approval rate (avg: ' + Math.round(avgRate) + '%)',
        detail: 'Supervisor approval pattern requires review.'
      });
    }
  });

  var container = el('adminFlaggedList');
  var section = el('adminFlaggedSection');

  if (flagged.length === 0) {
    hide(section);
    return;
  }

  show(section);
  container.innerHTML = flagged.map(function(f) {
    return '<div class="spm-flagged-item ' + f.type + '">' +
      '<div class="spm-flagged-title">' + f.title + '</div>' +
      '<div class="spm-flagged-detail">' + f.detail + '</div>' +
      '</div>';
  }).join('');
}

/* ═══════════════════════════════════════════════════════
   POLICY CENTER
   ═══════════════════════════════════════════════════════ */
function renderPolicyCenter() {
  var empAccepted = !!APP.policyAcceptances.employee;
  var supAccepted = !!APP.policyAcceptances.supervisor;

  var empStatus = el('policyAcceptanceStatus');
  var btnEmp = el('btnAcceptEmployeePolicy');
  var btnSup = el('btnAcceptSupervisorPolicy');

  // Employee policy status
  if (empAccepted) {
    empStatus.innerHTML = '<div class="spm-policy-status accepted"><i class="fa-solid fa-circle-check"></i> You accepted the Employee Attendance Policy on ' + fmtDate(APP.policyAcceptances.employee) + '.</div>';
    if (btnEmp) hide(btnEmp);
  } else {
    empStatus.innerHTML = '<div class="spm-policy-status not-accepted"><i class="fa-solid fa-circle-exclamation"></i> You have not yet accepted the Employee Attendance Policy. Please read and accept it below.</div>';
    if (btnEmp) show(btnEmp);
  }

  // Supervisor policy
  if ((APP.role === 'supervisor' || APP.role === 'admin') && btnSup) {
    if (supAccepted) {
      btnSup.style.display = 'none';
      empStatus.innerHTML += '<div class="spm-policy-status accepted" style="margin-top:8px"><i class="fa-solid fa-circle-check"></i> You accepted the Supervisor Management Policy on ' + fmtDate(APP.policyAcceptances.supervisor) + '.</div>';
    } else {
      show(btnSup);
    }
  }
}

function acceptPolicy(policyType) {
  if (!APP.user) { toast('You must be logged in to accept policies.', 'warning'); return; }

  var uid = APP.user.id || APP.user.email || '';
  var now = new Date().toISOString();

  var policyData = {
    userId: uid,
    userName: APP.user.name || APP.user.email || '',
    userEmail: APP.user.email || '',
    policyType: policyType,
    acceptedAt: now
  };

  if (typeof tool.requestObjects !== 'function') {
    APP.policyAcceptances[policyType] = now;
    renderPolicyCenter();
    toast('Policy accepted!', 'success');
    return;
  }

  // Check if already exists
  tool.requestObjects('query', { mainObjectType: POLICY_TYPE }, function(err, result) {
    var existing = null;
    if (!err && result && result.objects) {
      existing = result.objects.filter(function(p) {
        var d = getPolicyData(p);
        return d.userId === uid && d.policyType === policyType;
      })[0];
    }

    if (existing) {
      // Update
      tool.requestObjects('update', {
        mainObjectType: POLICY_TYPE,
        objectId: existing.id || existing._id,
        productData: { data_categoriesBased: policyData }
      }, function(err2) {
        if (err2) { toast('Failed to save policy acceptance.', 'error'); return; }
        APP.policyAcceptances[policyType] = now;
        renderPolicyCenter();
        toast('Policy acceptance recorded!', 'success');
      });
    } else {
      // Create
      tool.requestObjects('create', {
        mainObjectType: POLICY_TYPE,
        name: (APP.user.name || 'User') + ' – ' + (policyType === 'employee' ? 'Employee Attendance Policy' : 'Supervisor Management Policy'),
        productData: { data_categoriesBased: policyData }
      }, function(err2) {
        if (err2) { toast('Failed to save policy acceptance.', 'error'); return; }
        APP.policyAcceptances[policyType] = now;
        renderPolicyCenter();
        toast('Policy accepted! Thank you.', 'success');
      });
    }
  });
}

/* ═══════════════════════════════════════════════════════
   REPORTS
   ═══════════════════════════════════════════════════════ */
function showReport(type) {
  // Update active button
  var btns = document.querySelectorAll('.spm-report-tabs .spm-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.remove('active');
    if (btns[i].getAttribute('data-report') === type) btns[i].classList.add('active');
  }

  var container = el('reportContent');
  var reqs = (APP.role === 'admin' || APP.role === 'supervisor') ? APP.allRequests : APP.requests;

  switch (type) {
    case 'attendance': renderAttendanceReport(container, reqs); break;
    case 'payroll': renderPayrollReport(container, reqs); break;
    case 'grant': renderGrantReport(container, reqs); break;
    case 'csj': renderCSJReport(container, reqs); break;
  }
}

function renderAttendanceReport(container, reqs) {
  // Group by employee
  var byEmp = {};
  reqs.forEach(function(r) {
    var d = getRequestData(r);
    var key = d.employeeName || d.employeeId || 'Unknown';
    if (!byEmp[key]) byEmp[key] = { approved: 0, denied: 0, lateArrivals: 0, absences: 0, totalReq: 0 };
    byEmp[key].totalReq++;
    if (d.status === REQUEST_STATUS.APPROVED || d.status === REQUEST_STATUS.CONDITIONS) byEmp[key].approved++;
    if (d.status === REQUEST_STATUS.DENIED) byEmp[key].denied++;
    if (d.requestType === 'lateArrival') byEmp[key].lateArrivals++;
    if (d.requestType === 'absenceFullDay' || d.requestType === 'absencePartialDay') byEmp[key].absences++;
  });

  var employees = Object.keys(byEmp);
  if (employees.length === 0) {
    container.innerHTML = '<p class="spm-empty">No data available for attendance report.</p>';
    return;
  }

  var sched = getScheduleForUser();
  var dailyHours = sched && sched.startTime && sched.endTime ? calcHours(sched.startTime, sched.endTime) : 7.5;
  var workDays = sched && sched.workDays ? (Array.isArray(sched.workDays) ? sched.workDays.length : 5) : 5;
  var monthlyScheduled = dailyHours * workDays * 4; // ~4 weeks

  var totalApproved = 0, totalDenied = 0, totalLate = 0, totalAbsences = 0;

  var html = '<div class="spm-report-summary">';
  html += '<div class="spm-report-summary-item"><div class="r-val">' + employees.length + '</div><div class="r-lbl">Employees</div></div>';
  employees.forEach(function(e) { totalApproved += byEmp[e].approved; totalDenied += byEmp[e].denied; totalLate += byEmp[e].lateArrivals; totalAbsences += byEmp[e].absences; });
  html += '<div class="spm-report-summary-item"><div class="r-val">' + totalApproved + '</div><div class="r-lbl">Approved Exceptions</div></div>';
  html += '<div class="spm-report-summary-item"><div class="r-val">' + totalDenied + '</div><div class="r-lbl">Denied Requests</div></div>';
  html += '<div class="spm-report-summary-item"><div class="r-val">' + totalLate + '</div><div class="r-lbl">Late Arrivals</div></div>';
  html += '<div class="spm-report-summary-item"><div class="r-val">' + totalAbsences + '</div><div class="r-lbl">Absences</div></div>';
  html += '</div>';

  html += '<table class="spm-report-table"><thead><tr><th>Employee</th><th>Total Requests</th><th>Approved</th><th>Denied</th><th>Late Arrivals</th><th>Absences</th><th>Approval Rate</th></tr></thead><tbody>';
  employees.forEach(function(e) {
    var d = byEmp[e];
    var rate = d.totalReq > 0 ? Math.round((d.approved / d.totalReq) * 100) : 0;
    html += '<tr>' +
      '<td><strong>' + e + '</strong></td>' +
      '<td>' + d.totalReq + '</td>' +
      '<td>' + d.approved + '</td>' +
      '<td>' + d.denied + '</td>' +
      '<td>' + d.lateArrivals + '</td>' +
      '<td>' + d.absences + '</td>' +
      '<td>' + rate + '%</td>' +
      '</tr>';
  });
  html += '</tbody></table>';

  container.innerHTML = html;
}

function renderPayrollReport(container, reqs) {
  var byEmp = {};
  reqs.forEach(function(r) {
    var d = getRequestData(r);
    var key = d.employeeName || d.employeeId || 'Unknown';
    if (!byEmp[key]) byEmp[key] = { scheduled: 0, worked: 0, unpaidApproved: 0, payable: 0, count: 0 };
    byEmp[key].count++;
    if (d.status === REQUEST_STATUS.APPROVED || d.status === REQUEST_STATUS.CONDITIONS) {
      if (d.paymentTreatment === 'unpaid') {
        if (d.requestType === 'absenceFullDay') {
          byEmp[key].unpaidApproved += 7.5; // full day
        } else if (d.requestType === 'absencePartialDay' && d.requestedStart && d.requestedEnd) {
          byEmp[key].unpaidApproved += Math.max(0, calcHours(d.originalStart, d.originalEnd) - calcHours(d.requestedStart, d.requestedEnd));
        } else if (d.requestType === 'lateArrival' && d.requestedStart && d.originalStart) {
          byEmp[key].unpaidApproved += calcHours(d.originalStart, d.requestedStart);
        } else if (d.requestType === 'earlyDeparture' && d.requestedEnd && d.originalEnd) {
          byEmp[key].unpaidApproved += calcHours(d.requestedEnd, d.originalEnd);
        }
      }
    }
  });

  var sched = getScheduleForUser();
  var dailyHours = sched && sched.startTime && sched.endTime ? calcHours(sched.startTime, sched.endTime) : 7.5;
  var workDays = sched && sched.workDays ? (Array.isArray(sched.workDays) ? sched.workDays.length : 5) : 5;
  var monthlyHours = dailyHours * workDays * 4;

  var employees = Object.keys(byEmp);
  if (employees.length === 0) {
    container.innerHTML = '<p class="spm-empty">No data available for payroll report.</p>';
    return;
  }

  var totalUnpaid = 0;
  employees.forEach(function(e) { totalUnpaid += byEmp[e].unpaidApproved; });
  var totalPayable = employees.length * monthlyHours - totalUnpaid;

  var html = '<div class="spm-report-summary">';
  html += '<div class="spm-report-summary-item"><div class="r-val">' + employees.length + '</div><div class="r-lbl">Employees</div></div>';
  html += '<div class="spm-report-summary-item"><div class="r-val">' + (employees.length * monthlyHours).toFixed(1) + 'h</div><div class="r-lbl">Total Scheduled Hours</div></div>';
  html += '<div class="spm-report-summary-item"><div class="r-val">' + totalUnpaid.toFixed(1) + 'h</div><div class="r-lbl">Unpaid Approved Hours</div></div>';
  html += '<div class="spm-report-summary-item"><div class="r-val">' + totalPayable.toFixed(1) + 'h</div><div class="r-lbl">Payable Hours</div></div>';
  html += '</div>';

  html += '<table class="spm-report-table"><thead><tr><th>Employee</th><th>Scheduled (mo)</th><th>Unpaid Approved</th><th>Payable Hours</th></tr></thead><tbody>';
  employees.forEach(function(e) {
    var d = byEmp[e];
    var payable = monthlyHours - d.unpaidApproved;
    html += '<tr>' +
      '<td><strong>' + e + '</strong></td>' +
      '<td>' + monthlyHours.toFixed(1) + 'h</td>' +
      '<td>' + d.unpaidApproved.toFixed(1) + 'h</td>' +
      '<td>' + payable.toFixed(1) + 'h</td>' +
      '</tr>';
  });
  html += '</tbody></table>';

  container.innerHTML = html;
}

function renderGrantReport(container, reqs) {
  var byEmp = {};
  reqs.forEach(function(r) {
    var d = getRequestData(r);
    var key = d.employeeName || d.employeeId || 'Unknown';
    if (!byEmp[key]) byEmp[key] = { paidWages: 0, missingHours: 0, oooHours: 0, reasons: [], period: d.employeePeriod || '—' };
    if (d.status === REQUEST_STATUS.APPROVED || d.status === REQUEST_STATUS.CONDITIONS) {
      if (d.paymentTreatment === 'unpaid') {
        var hrs = 0;
        if (d.requestType === 'absenceFullDay') hrs = 7.5;
        else if (d.requestType === 'lateArrival' && d.requestedStart && d.originalStart) hrs = calcHours(d.originalStart, d.requestedStart);
        else if (d.requestType === 'earlyDeparture' && d.requestedEnd && d.originalEnd) hrs = calcHours(d.requestedEnd, d.originalEnd);
        byEmp[key].missingHours += hrs;
        byEmp[key].reasons.push(REQUEST_TYPE_LABELS[d.requestType] || d.requestType);
      }
      // Track OOO hours (these count as worked, not missing)
      if (d.isOutOfOffice === 'yes' && d.paymentTreatment === 'paid') {
        var oooHrs = d.oooDuration === 'fullDay' ? calcHours(d.originalStart, d.originalEnd) :
                     d.oooDuration === 'halfDay' ? calcHours(d.originalStart, d.originalEnd) / 2 :
                     calcHours(d.requestedStart, d.requestedEnd);
        byEmp[key].oooHours += oooHrs;
      }
    }
  });

  var sched = getScheduleForUser();
  var dailyHours = sched && sched.startTime && sched.endTime ? calcHours(sched.startTime, sched.endTime) : 7;
  var workDays = sched && sched.workDays ? (Array.isArray(sched.workDays) ? sched.workDays.length : 5) : 5;
  var monthlyHours = dailyHours * workDays * 4;
  var hourlyRate = parseFloat(tool.param('hourlyRate', '17.40')) || 17.40;

  var employees = Object.keys(byEmp);
  if (employees.length === 0) {
    container.innerHTML = '<p class="spm-empty">No data available for CSJ Grant Support report.</p>';
    return;
  }

  var totalPaid = 0, totalMissing = 0, totalOoo = 0;
  employees.forEach(function(e) {
    totalPaid += (monthlyHours - byEmp[e].missingHours) * hourlyRate;
    totalMissing += byEmp[e].missingHours * hourlyRate;
    totalOoo += byEmp[e].oooHours;
  });

  var html = '<div class="spm-report-summary">';
  html += '<div class="spm-report-summary-item"><div class="r-val">' + employees.length + '</div><div class="r-lbl">Employees</div></div>';
  html += '<div class="spm-report-summary-item"><div class="r-val">$' + totalPaid.toFixed(2) + '</div><div class="r-lbl">Total Paid Wages (est.)</div></div>';
  html += '<div class="spm-report-summary-item"><div class="r-val">' + totalOoo.toFixed(1) + 'h</div><div class="r-lbl">OOO Work Hours</div></div>';
  html += '<div class="spm-report-summary-item"><div class="r-val">$' + totalMissing.toFixed(2) + '</div><div class="r-lbl">Missing Wages (est.)</div></div>';
  html += '</div>';

  html += '<table class="spm-report-table"><thead><tr><th>Employee</th><th>Period</th><th>Worked Hours</th><th>OOO Hours</th><th>Paid Wages (est.)</th><th>Missing Hours</th><th>Reasons</th></tr></thead><tbody>';
  employees.forEach(function(e) {
    var d = byEmp[e];
    var worked = monthlyHours - d.missingHours;
    html += '<tr>' +
      '<td><strong>' + e + '</strong></td>' +
      '<td>' + d.period + '</td>' +
      '<td>' + worked.toFixed(1) + 'h</td>' +
      '<td>' + d.oooHours.toFixed(1) + 'h</td>' +
      '<td>$' + (worked * hourlyRate).toFixed(2) + '</td>' +
      '<td>' + d.missingHours.toFixed(1) + 'h</td>' +
      '<td>' + (d.reasons.length > 0 ? d.reasons.slice(0, 3).join(', ') : '—') + '</td>' +
      '</tr>';
  });
  html += '</tbody></table>';

  html += '<p style="font-size:11px;color:var(--spm-text-muted);margin-top:12px"><em>Note: Wage estimates based on $' + hourlyRate.toFixed(2) + '/hr. Actual rates may vary. This report is for CSJ grant support documentation purposes.</em></p>';

  container.innerHTML = html;
}

function calcHours(start, end) {
  if (!start || !end) return 0;
  var sParts = start.split(':');
  var eParts = end.split(':');
  var sH = parseInt(sParts[0], 10) || 0;
  var sM = parseInt(sParts[1], 10) || 0;
  var eH = parseInt(eParts[0], 10) || 0;
  var eM = parseInt(eParts[1], 10) || 0;
  var diff = (eH + eM / 60) - (sH + sM / 60);
  return Math.max(0, diff);
}

/* ═══════════════════════════════════════════════════════
   CSJ COMPLIANCE HELPERS — Canada Summer Jobs Rules
   ═══════════════════════════════════════════════════════ */
function getCSJMinHours() {
  return parseFloat(tool.param('csjMinHours', '30')) || 30;
}
function getCSJMaxHours() {
  return parseFloat(tool.param('csjMaxHours', '40')) || 40;
}

function getWeekStart(dateStr) {
  var d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  var day = d.getDay();
  var diff = d.getDate() - day + (day === 0 ? -6 : 1);
  var monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function getWeekEnd(weekStart) {
  var d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}

function getDailyScheduledHours() {
  var sched = getScheduleForUser();
  if (!sched || !sched.startTime || !sched.endTime) return 7;
  return calcHours(sched.startTime, sched.endTime);
}

function getWorkDaysPerWeek() {
  var sched = getScheduleForUser();
  if (!sched || !sched.workDays) return 5;
  var days = Array.isArray(sched.workDays) ? sched.workDays : sched.workDays.split(',').map(function(d) { return d.trim(); });
  return days.length || 5;
}

function getWeeklyScheduledHours() {
  return getDailyScheduledHours() * getWorkDaysPerWeek();
}

function getWeeklyUnpaidHours(weekStart) {
  var weekEnd = getWeekEnd(weekStart);
  var total = 0;
  var reqs = (APP.role === 'admin' || APP.role === 'supervisor') ? APP.allRequests : APP.requests;
  reqs.forEach(function(r) {
    var d = getRequestData(r);
    if (d.requestDate < weekStart || d.requestDate > weekEnd) return;
    if (d.status !== REQUEST_STATUS.APPROVED && d.status !== REQUEST_STATUS.CONDITIONS) return;
    if (d.paymentTreatment !== 'unpaid') return;
    if (d.requestType === 'absenceFullDay') {
      total += getDailyScheduledHours();
    } else if (d.requestType === 'lateArrival' && d.requestedStart && d.originalStart) {
      total += calcHours(d.originalStart, d.requestedStart);
    } else if (d.requestType === 'earlyDeparture' && d.requestedEnd && d.originalEnd) {
      total += calcHours(d.requestedEnd, d.originalEnd);
    } else if (d.requestType === 'absencePartialDay' && d.requestedStart && d.requestedEnd && d.originalStart && d.originalEnd) {
      total += calcHours(d.originalStart, d.originalEnd) - calcHours(d.requestedStart, d.requestedEnd);
    }
  });
  return total;
}

function getWeeklyPayableHours(weekStart) {
  return getWeeklyScheduledHours() - getWeeklyUnpaidHours(weekStart);
}

function getCSJStatus(payableHours) {
  var min = getCSJMinHours();
  if (payableHours >= min) return 'safe';
  if (payableHours >= min - 2) return 'warning';
  return 'danger';
}

function getCSJStatusLabel(status) {
  if (status === 'safe') return '<span style="color:#16a34a;font-weight:600"><i class="fa-solid fa-circle-check"></i> CSJ Compliant</span>';
  if (status === 'warning') return '<span style="color:#d97706;font-weight:600"><i class="fa-solid fa-triangle-exclamation"></i> Approaching CSJ Limit</span>';
  return '<span style="color:#dc2626;font-weight:600"><i class="fa-solid fa-circle-xmark"></i> Below CSJ Minimum</span>';
}

/* ═══════════════════════════════════════════════════════
   CSJ COMPLIANCE REPORT — Weekly Hours Audit
   ═══════════════════════════════════════════════════════ */
function renderCSJReport(container, reqs) {
  var csjMin = getCSJMinHours();
  var csjMax = getCSJMaxHours();
  var dailyHours = getDailyScheduledHours();
  var workDays = getWorkDaysPerWeek();
  var weeklyScheduled = dailyHours * workDays;

  var weeks = {};
  reqs.forEach(function(r) {
    var d = getRequestData(r);
    if (!d.requestDate) return;
    var ws = getWeekStart(d.requestDate);
    if (!weeks[ws]) weeks[ws] = { start: ws, end: getWeekEnd(ws), unpaid: 0, ooo: 0 };
    if (d.status === REQUEST_STATUS.APPROVED || d.status === REQUEST_STATUS.CONDITIONS) {
      if (d.paymentTreatment === 'unpaid') {
        var hrs = 0;
        if (d.requestType === 'absenceFullDay') hrs = dailyHours;
        else if (d.requestType === 'lateArrival' && d.requestedStart && d.originalStart) hrs = calcHours(d.originalStart, d.requestedStart);
        else if (d.requestType === 'earlyDeparture' && d.requestedEnd && d.originalEnd) hrs = calcHours(d.requestedEnd, d.originalEnd);
        weeks[ws].unpaid += hrs;
      }
      if (d.isOutOfOffice === 'yes' && d.paymentTreatment === 'paid') {
        var oooHrs = d.oooDuration === 'fullDay' ? dailyHours : d.oooDuration === 'halfDay' ? dailyHours / 2 : calcHours(d.requestedStart, d.requestedEnd);
        weeks[ws].ooo += oooHrs;
      }
    }
  });

  var weekList = Object.keys(weeks).sort();
  if (weekList.length === 0) {
    container.innerHTML = '<p class="spm-empty">No data available for CSJ Compliance report. Submit and approve requests to see weekly hour tracking.</p>';
    return;
  }

  var safeWeeks = 0, warnWeeks = 0, dangerWeeks = 0;
  weekList.forEach(function(ws) {
    var payable = weeklyScheduled - weeks[ws].unpaid;
    var status = getCSJStatus(payable);
    if (status === 'safe') safeWeeks++;
    else if (status === 'warning') warnWeeks++;
    else dangerWeeks++;
  });

  var html = '<div class="spm-report-summary">';
  html += '<div class="spm-report-summary-item"><div class="r-val">' + weekList.length + '</div><div class="r-lbl">Weeks Tracked</div></div>';
  html += '<div class="spm-report-summary-item"><div class="r-val" style="color:#16a34a">' + safeWeeks + '</div><div class="r-lbl">CSJ Compliant</div></div>';
  html += '<div class="spm-report-summary-item"><div class="r-val" style="color:#d97706">' + warnWeeks + '</div><div class="r-lbl">Near Limit</div></div>';
  html += '<div class="spm-report-summary-item"><div class="r-val" style="color:#dc2626">' + dangerWeeks + '</div><div class="r-lbl">Below Minimum</div></div>';
  html += '</div>';

  html += '<div class="spm-approval-note" style="margin-bottom:16px"><i class="fa-solid fa-circle-info"></i><div><strong>CSJ Rules:</strong> Canada Summer Jobs requires <strong>' + csjMin + '–' + csjMax + ' hours per week</strong>, evaluated <strong>per individual week</strong> (not cumulative across the program). Weeks below ' + csjMin + 'h may be <strong>ineligible for wage reimbursement</strong>. Your regular schedule is <strong>' + weeklyScheduled.toFixed(1) + 'h/week</strong> (' + dailyHours.toFixed(1) + 'h × ' + workDays + ' days). Making up hours in a different week does not fix a shortfall in the week where it occurred.</div></div>';

  html += '<table class="spm-report-table"><thead><tr><th>Week Starting</th><th>Ending</th><th>Scheduled</th><th>Unpaid</th><th>OOO Hrs</th><th>Payable</th><th>CSJ Status</th></tr></thead><tbody>';
  weekList.forEach(function(ws) {
    var w = weeks[ws];
    var payable = weeklyScheduled - w.unpaid;
    var status = getCSJStatus(payable);
    var sc = status === 'safe' ? '#16a34a' : status === 'warning' ? '#d97706' : '#dc2626';
    var si = status === 'safe' ? '✅' : status === 'warning' ? '⚠️' : '❌';
    var st = status === 'safe' ? 'Compliant' : status === 'warning' ? 'Near Limit' : 'BELOW MINIMUM';
    html += '<tr><td><strong>' + fmtDate(ws) + '</strong></td><td>' + fmtDate(w.end) + '</td><td>' + weeklyScheduled.toFixed(1) + 'h</td><td style="color:#dc2626">' + (w.unpaid > 0 ? '-' + w.unpaid.toFixed(1) + 'h' : '0h') + '</td><td style="color:#0369a1">' + (w.ooo > 0 ? w.ooo.toFixed(1) + 'h' : '—') + '</td><td><strong style="color:' + sc + '">' + payable.toFixed(1) + 'h</strong></td><td><span style="color:' + sc + ';font-weight:600">' + si + ' ' + st + '</span></td></tr>';
  });
  html += '</tbody></table>';

  if (dangerWeeks > 0) {
    html += '<div class="spm-approval-note" style="background:#fee2e2;border-color:#fca5a5;color:#991b1b;margin-top:16px"><i class="fa-solid fa-triangle-exclamation"></i><div><strong>⚠️ CSJ Funding Risk:</strong> ' + dangerWeeks + ' week(s) fall below the ' + csjMin + 'h CSJ minimum. These weeks may be <strong>ineligible for Canada Summer Jobs reimbursement</strong>. ESDC evaluates each week individually. If shortfalls become a pattern, this could jeopardize funding for the entire placement. Contact your CSJ program officer for guidance.</div></div>';
  }

  container.innerHTML = html;
}

/* ═══════════════════════════════════════════════════════
   PDF EXPORT
   ═══════════════════════════════════════════════════════ */
// Export functionality is available via tool.requestExportPdf if configured.
// Users can also use the browser's Print feature for any report view.
