/* ── Volunteer Management ──
   End-to-end volunteer coordination for events.
   Built for UniconHub CMS HTML-tool system.
────────────────────────────────────────── */

/* ── Helpers ── */
function el(id) { return document.getElementById(id); }
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escJs(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n'); }

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch(e) { return d; }
}

function fmtDateTime(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch(e) { return d; }
}

function isoNow() { return new Date().toISOString(); }

/* ── CMS Type Names (D-VM-02, D-VM-03, D-VM-05) ── */
var TYPE_REGISTRY     = 'volunteerRegistry-uniconbaseapps'; // shared SSOT - one doc per volunteer profile
var TYPE_EVENTS       = 'vm.events-uniconbaseapps';         // shared SSOT - one doc per event definition
var TYPE_APPLICATIONS = 'vm.eventApplications-uniconbaseapps';
var TYPE_TASKS        = 'vm.eventTasks-uniconbaseapps';
var TYPE_HOURS        = 'vm.eventHours-uniconbaseapps';
var TYPE_MESSAGES     = 'vm.eventMessages-uniconbaseapps';

/* ── State ── */
var APP = {
  user: null,
  isManager: false,
  readOnly: false,
  currentTab: 'dashboard',

  // Data caches
  registry: [],        // volunteer profile records (shared SSOT)
  events: [],          // event definition records (shared SSOT)
  applications: [],    // event membership records (instance)
  tasks: [],           // task records
  hours: [],           // hour log records
  messages: [],        // message records
  permittedUsers: [],  // from tool.getPermittedUsers()

  registryError: '',   // non-empty when the registry could not be loaded
  eventsError: '',     // non-empty when event definitions could not be loaded

  // Event definition this tool instance works on
  currentEventId: '',
  hostEventName: '',

  // Event management view (opened from the event list)
  eventManageOpen: false,
  eventManageSection: 'volunteers', // volunteers | tasks | hours

  // Which event the task / hours form is writing to
  taskFormEventId: '',
  hourFormEventId: '',

  // Reports view
  reportMode: 'overview',   // overview | event | volunteer
  reportEventId: '',
  reportProfileId: '',

  // Volunteer detail view (opened from the volunteer list)
  volunteerDetailProfileId: '',
  volunteerDetailOpen: false,
  volunteerDetailSection: 'dashboard', // dashboard | report

  // My records (if current user is registered)
  myProfile: null,     // my registry profile
  myApplication: null, // my application for THIS event

  // Data loaded flags
  loaded: { registry: false, events: false, applications: false, tasks: false, hours: false, messages: false },

  // Pending confirm callback
  _confirmCb: null
};

/* ── Role Detection ── */
function detectRole() {
  var u = APP.user;
  if (!u) return 'guest';
  var roles = u.roles || [];
  if (roles.includes('admin') || roles.includes('owner') || roles.includes('developer') || roles.includes('user-manager') || roles.includes('editor')) {
    return 'manager';
  }
  return 'volunteer';
}

function canWrite() {
  var u = APP.user;
  if (!u) return false;
  var roles = u.roles || [];
  return roles.includes('admin') || roles.includes('owner') || roles.includes('developer') || roles.includes('user-manager') || roles.includes('editor');
}

/* ── Top bar identity ── */
function updateTopBarIdentity() {
  var displayName = APP.user ? (APP.user.name || APP.user.email || 'User') : 'Not logged in';

  var userNameElement = el('topUserName');
  if (userNameElement) userNameElement.textContent = displayName;

  var userAvatarElement = el('topUserAvatar');
  if (userAvatarElement) userAvatarElement.textContent = displayName.charAt(0).toUpperCase();

  var roleBadge = el('topRoleBadge');
  if (!roleBadge) return;
  if (APP.isManager) {
    roleBadge.textContent = 'Event Manager';
    roleBadge.className = 'top-bar-role role-manager';
  } else if (APP.user) {
    roleBadge.textContent = 'Volunteer';
    roleBadge.className = 'top-bar-role role-volunteer';
  } else {
    roleBadge.textContent = 'Guest';
    roleBadge.className = 'top-bar-role role-guest';
  }
}

/* Manager-only menu entries (Event definitions) */
function updateManagerOnlyNavigation() {
  qsa('.tab-btn[data-manager-only]').forEach(function(button) {
    button.style.display = APP.isManager ? '' : 'none';
  });
  renderEventSubNav();
  renderVolunteerSubNav();
}

/* ── CRUD Wrappers ── */
function queryObjects(type, cb) {
  tool.requestObjects('query', { mainObjectType: type }, function(err, result) {
    if (err) { tool.notify('Query error (' + type + '): ' + err, 'warning'); cb(err, null); return; }
    cb(null, (result && result.objects) ? result.objects : []);
  });
}

function getObject(type, objectId, cb) {
  tool.requestObjects('get', { mainObjectType: type, objectId: objectId }, function(err, result) {
    if (err) { cb(err, null); return; }
    cb(null, result && result.object ? result.object : null);
  });
}

function createObject(type, name, data, cb) {
  tool.requestObjects('create', {
    mainObjectType: type,
    name: name,
    productData: { data_categoriesBased: data }
  }, function(err, result) {
    if (err) { cb(err, null); return; }
    cb(null, result && result.object ? result.object : null);
  });
}

function updateObject(type, objectId, data, name, cb) {
  var params = { mainObjectType: type, objectId: objectId, productData: { data_categoriesBased: data } };
  if (name !== undefined) params.name = name;
  tool.requestObjects('update', params, function(err, result) {
    if (err) { cb(err, null); return; }
    cb(null, result);
  });
}

function deleteObject(type, objectId, cb) {
  tool.requestObjects('delete', { mainObjectType: type, objectId: objectId }, function(err, result) {
    if (err) { cb(err, null); return; }
    cb(null, result);
  });
}

/* ── Data Loading ── */
function getRegistryType() {
  try { return tool.param('registryType', TYPE_REGISTRY); } catch(e) { return TYPE_REGISTRY; }
}

function getEventsType() {
  try { return tool.param('eventsType', TYPE_EVENTS); } catch(e) { return TYPE_EVENTS; }
}

function loadAllData(cb) {
  var pending = 6;
  function done() { pending--; if (pending <= 0 && cb) cb(); }

  queryObjects(getRegistryType(), function(err, objs) {
    if (err) {
      APP.registryError = err;
      APP.registry = [];
      reportRegistryConfigError();
    } else {
      APP.registryError = '';
      APP.registry = objs || [];
    }
    APP.loaded.registry = true;
    findMyRecords();
    done();
  });
  queryObjects(TYPE_APPLICATIONS, function(err, objs) {
    APP.applications = objs || [];
    APP.loaded.applications = true;
    findMyRecords();
    done();
  });
  queryObjects(TYPE_TASKS, function(err, objs) {
    APP.tasks = objs || [];
    APP.loaded.tasks = true;
    done();
  });
  queryObjects(TYPE_HOURS, function(err, objs) {
    APP.hours = objs || [];
    APP.loaded.hours = true;
    done();
  });
  queryObjects(TYPE_MESSAGES, function(err, objs) {
    APP.messages = objs || [];
    APP.loaded.messages = true;
    done();
  });
  queryObjects(getEventsType(), function(err, objs) {
    if (err) {
      APP.eventsError = err;
      APP.events = [];
      reportEventsConfigError();
    } else {
      APP.eventsError = '';
      APP.events = objs || [];
    }
    APP.loaded.events = true;
    renderEventHeader();
    done();
  });
}

function findMyRecords() {
  if (!APP.user) { APP.myProfile = null; APP.myApplication = null; return; }
  var uid = APP.user.id;
  APP.myProfile = getRegistryProfileByUserId(uid);
  APP.myApplication = getApplicationByUserId(uid);
}

/* ── Get data helpers ── */
function vd(v) { return (v && v.productData && v.productData.data_categoriesBased) ? v.productData.data_categoriesBased : {}; }

function profileName(p) {
  var d = vd(p);
  if (d.firstName || d.lastName) return (d.firstName + ' ' + d.lastName).trim();
  return d.email || p.name || 'Unknown';
}

function getRegistryProfileByUserId(uid) {
  for (var i = 0; i < APP.registry.length; i++) {
    if (vd(APP.registry[i]).userId === uid) return APP.registry[i];
  }
  return null;
}

function getRegistryProfileById(profileId) {
  for (var i = 0; i < APP.registry.length; i++) {
    if (APP.registry[i].id === profileId) return APP.registry[i];
  }
  return null;
}

function getApplicationByUserId(uid) {
  for (var i = 0; i < APP.applications.length; i++) {
    if (vd(APP.applications[i]).volunteerUserId === uid) return APP.applications[i];
  }
  return null;
}

function getApplicationById(id) {
  for (var i = 0; i < APP.applications.length; i++) {
    if (APP.applications[i].id === id) return APP.applications[i];
  }
  return null;
}

/* The person behind an event application: registry link first, then the CMS user id. */
function getApplicationProfile(application) {
  if (!application) return null;
  var applicationData = vd(application);
  if (applicationData.registryProfileId) {
    var linkedProfile = getRegistryProfileById(applicationData.registryProfileId);
    if (linkedProfile) return linkedProfile;
  }
  if (applicationData.volunteerUserId) return getRegistryProfileByUserId(applicationData.volunteerUserId);
  return null;
}

function getApprovedVolunteers() {
  return APP.applications.filter(function(a) { return vd(a).status === 'approved'; });
}

function approvedUserName(application) {
  var profile = getApplicationProfile(application);
  return profile ? profileName(profile) : 'Unknown';
}

function getTaskById(id) {
  for (var i = 0; i < APP.tasks.length; i++) {
    if (APP.tasks[i].id === id) return APP.tasks[i];
  }
  return null;
}

/* ── Missing registry configuration report (T-07) ── */
function reportEventsConfigError() {
  try {
    tool.reportMissingParams([
      {
        name: 'eventsType',
        label: 'Events Type ID',
        type: 'text',
        default: 'vm.events-uniconbaseapps',
        hint: 'CMS object type for event definitions (shared events SSOT)',
        reason: 'Cannot load event definitions without this type in settings.allowedObjectTypes.',
        severity: 'goodToHave'
      }
    ], 'This tool needs the events type authorized before it can manage event definitions.');
  } catch(e) {}
}

/* ── Missing registry configuration report (T-07) ── */
function reportRegistryConfigError() {
  try {
    tool.reportMissingParams([
      {
        name: 'registryType',
        label: 'Volunteer Registry Type ID',
        type: 'text',
        default: 'volunteerRegistry-uniconbaseapps',
        hint: 'CMS object type for volunteer profiles (shared registry SSOT)',
        reason: 'Cannot load the volunteer registry without this type in settings.allowedObjectTypes.',
        severity: 'mandatory'
      }
    ], 'This tool needs the volunteer registry type authorized before it can list volunteers.');
  } catch(e) {}
}

/* ── UI: Tab Switching ── */
function switchTab(tab) {
  APP.currentTab = tab;
  qsa('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  qsa('.tab-panel').forEach(function(p) { p.classList.remove('active'); });

  var btn = qs('.tab-btn[data-tab="' + tab + '"]');
  if (btn) btn.classList.add('active');
  var panel = el('panel-' + tab);
  if (panel) panel.classList.add('active');

  renderEventSubNav();
  renderVolunteerSubNav();
  renderCurrentTab();
  tool.resize();
}

function renderCurrentTab() {
  switch (APP.currentTab) {
    case 'dashboard': renderDashboard(); break;
    case 'events': renderEvents(); break;
    case 'volunteers': renderVolunteers(); break;
    case 'tasks': renderTasks(); break;
    case 'hours': renderHours(); break;
    case 'reports': renderReports(); break;
    case 'messages': renderMessages(); break;
    case 'certificate': renderCertificate(); break;
  }
}

/* ── UI: Dashboard ── */
function renderDashboard() {
  // Stats
  var approved = getApprovedVolunteers();
  var networkVolunteers = APP.registry.filter(function(profile) { return vd(profile).status === 'active'; }).length;
  var networkCandidates = APP.registry.filter(function(profile) { return vd(profile).status === 'candidate'; }).length;
  var pendingVols = APP.applications.filter(function(a) { return vd(a).status === 'pending'; }).length;
  var openTasks = APP.tasks.filter(function(t) { var s = vd(t).status; return s === 'open' || s === 'assigned' || s === 'in-progress'; }).length;
  var completedTasks = APP.tasks.filter(function(t) { return vd(t).status === 'completed'; }).length;
  var totalHours = 0;
  APP.hours.forEach(function(h) {
    var d = vd(h);
    if (d.status === 'approved') totalHours += (Number(d.hoursLogged) || 0);
  });
  var pendingHours = APP.hours.filter(function(h) { return vd(h).status === 'pending'; }).length;

  var unreadMsgs = APP.messages.filter(function(m) {
    var d = vd(m);
    if (APP.isManager) return d.read === false;
    return d.toUserId === (APP.user ? APP.user.id : '') && d.read === false;
  }).length;

  var statsHtml = '';
  if (APP.isManager) {
    statsHtml += '<div class="stat-card"><div class="stat-icon" style="background:#d1fae5;">👥</div><div class="stat-value">' + networkVolunteers + '</div><div class="stat-label">Approved Volunteers</div></div>';
    statsHtml += '<div class="stat-card"><div class="stat-icon" style="background:#fef3c7;">🙋</div><div class="stat-value">' + networkCandidates + '</div><div class="stat-label">Network Candidates</div></div>';
    statsHtml += '<div class="stat-card"><div class="stat-icon" style="background:#e0ecf8;">📝</div><div class="stat-value">' + pendingVols + '</div><div class="stat-label">Pending Event Requests</div></div>';
    statsHtml += '<div class="stat-card"><div class="stat-icon" style="background:#d1fae5;">✅</div><div class="stat-value">' + approved.length + '</div><div class="stat-label">Approved for This Event</div></div>';
  }
  statsHtml += '<div class="stat-card"><div class="stat-icon" style="background:#dbeafe;">📋</div><div class="stat-value">' + openTasks + '</div><div class="stat-label">Active Tasks</div></div>';
  statsHtml += '<div class="stat-card"><div class="stat-icon" style="background:#d1fae5;">🟢</div><div class="stat-value">' + completedTasks + '</div><div class="stat-label">Completed Tasks</div></div>';
  statsHtml += '<div class="stat-card"><div class="stat-icon" style="background:#ede9fe;">⏱️</div><div class="stat-value">' + totalHours.toFixed(1) + '</div><div class="stat-label">Total Approved Hours</div></div>';
  statsHtml += '<div class="stat-card"><div class="stat-icon" style="background:#fee2e2;">💬</div><div class="stat-value">' + unreadMsgs + '</div><div class="stat-label">Unread Messages</div></div>';
  if (APP.registryError) {
    statsHtml = '<div class="card" style="margin-bottom:14px;"><div class="card-body" style="color:var(--danger);">⚠️ Volunteer registry unavailable: ' + esc(APP.registryError) + '. Configure the registry type in the tool settings (see the banner above).</div></div>' + statsHtml;
  }
  el('dashStats').innerHTML = statsHtml;

  // My Status
  var myStatus = el('dashMyStatus');
  var myStatusBody = el('dashMyStatusBody');
  if (!APP.isManager) {
    myStatus.style.display = '';
    if (APP.myApplication) {
      var ma = vd(APP.myApplication);
      var mp = APP.myProfile ? vd(APP.myProfile) : {};
      var statusClass = 'badge-' + ma.status;
      myStatusBody.innerHTML =
        '<p><strong>Status:</strong> <span class="badge ' + statusClass + '">' + esc(ma.status) + '</span></p>' +
        (mp.skills ? '<p><strong>Skills:</strong> ' + esc(mp.skills) + '</p>' : '') +
        (ma.reviewedAt ? '<p><strong>Reviewed:</strong> ' + fmtDate(ma.reviewedAt) + ' by ' + esc(ma.reviewedBy || '—') + '</p>' : '');
      if (ma.status === 'rejected') {
        myStatusBody.innerHTML += '<button class="btn btn-sm btn-primary" style="margin-top:8px;" onclick="openRegisterModal()">🔄 Re-apply</button>';
      }
    } else {
      myStatusBody.innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">🙋</div><h4>Not Registered Yet</h4><p>Join as a volunteer for this event! Click below to submit your registration.</p>' +
        '<button class="btn btn-primary btn-lg" onclick="openRegisterModal()">🙋 Register as Volunteer</button></div>';
    }
  } else {
    myStatus.style.display = 'none';
  }

  // Pending event requests (manager only)
  var pendingDiv = el('dashPendingApprovals');
  if (APP.isManager && pendingVols > 0) {
    pendingDiv.style.display = '';
    var pendHTML = '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Skills</th><th>Applied</th><th></th></tr></thead><tbody>';
    APP.applications.forEach(function(a) {
      var pendingAppData = vd(a);
      if (pendingAppData.status !== 'pending') return;
      var profile = getApplicationProfile(a);
      var pd = profile ? vd(profile) : {};
      pendHTML += '<tr>' +
        '<td><strong>' + esc(profile ? profileName(profile) : 'Unknown') + '</strong></td>' +
        '<td>' + esc(pd.email || '') + '</td>' +
        '<td>' + esc((pd.skills || '').slice(0, 60)) + '</td>' +
        '<td>' + fmtDate(pendingAppData.appliedAt) + '</td>' +
        '<td><button class="btn btn-sm btn-success" onclick="approveVolunteer(\'' + a.id + '\')">✅ Approve</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="rejectVolunteer(\'' + a.id + '\')">❌ Reject</button></td>' +
        '</tr>';
    });
    pendHTML += '</tbody></table></div>';
    el('dashPendingApprovalsBody').innerHTML = pendHTML;
  } else {
    pendingDiv.style.display = 'none';
  }

  // My Upcoming Tasks
  var myTaskHTML = '';
  var myTasks = [];
  APP.tasks.forEach(function(t) {
    var d = vd(t);
    if (d.status === 'completed' || d.status === 'cancelled') return;
    if (APP.isManager) {
      if (d.status === 'open') myTasks.push(t);
      else if (d.assignedVolunteerUserId === (APP.user ? APP.user.id : '')) myTasks.push(t);
    } else {
      if (d.assignedVolunteerUserId === (APP.user ? APP.user.id : '')) myTasks.push(t);
    }
  });
  if (myTasks.length === 0) {
    myTaskHTML = '<div class="empty-state"><p>No upcoming tasks.</p></div>';
  } else {
    myTaskHTML = '<div class="table-wrap"><table><thead><tr><th>Task</th><th>Status</th><th>Assigned To</th><th>Due</th><th>Est. Hours</th></tr></thead><tbody>';
    myTasks.forEach(function(t) {
      var d = vd(t);
      var assigneeProfile = getRegistryProfileByUserId(d.assignedVolunteerUserId);
      myTaskHTML += '<tr>' +
        '<td><strong>' + esc(t.name) + '</strong></td>' +
        '<td><span class="badge badge-' + d.status + '">' + esc(d.status) + '</span></td>' +
        '<td>' + esc(assigneeProfile ? profileName(assigneeProfile) : '—') + '</td>' +
        '<td>' + fmtDate(d.dueDate) + '</td>' +
        '<td>' + (d.estimatedHours || '—') + '</td>' +
        '</tr>';
    });
    myTaskHTML += '</tbody></table></div>';
  }
  el('dashMyTasks').innerHTML = myTaskHTML;

  // Recent Messages
  var recentMsgs = APP.messages.slice().sort(function(a, b) {
    return (vd(b).sentAt || '').localeCompare(vd(a).sentAt || '');
  }).slice(0, 5);
  var msgHTML = '';
  if (recentMsgs.length === 0) {
    msgHTML = '<div class="empty-state"><p>No messages yet.</p></div>';
  } else {
    recentMsgs.forEach(function(m) {
      var d = vd(m);
      var unreadClass = (!APP.isManager && d.toUserId === (APP.user ? APP.user.id : '') && d.read === false) ? ' unread' : '';
      msgHTML += '<div class="msg-item' + unreadClass + '">' +
        '<div class="msg-header"><span class="msg-from">' + esc(d.fromName) + '</span><span class="msg-time">' + fmtDateTime(d.sentAt) + '</span></div>' +
        '<div class="msg-subject">' + esc(d.subject || '(no subject)') + '</div>' +
        '<div class="msg-body">' + esc((d.body || '').slice(0, 120)) + '</div>' +
        '</div>';
    });
  }
  el('dashRecentMessages').innerHTML = msgHTML;

  updateBadges();
  tool.resize();
}

/* ── UI: Event Definitions ── */
var editingEventId = '';

function eventStatusLabel(eventStatus) {
  if (eventStatus === 'open') return 'Open';
  if (eventStatus === 'completed') return 'Completed';
  if (eventStatus === 'cancelled') return 'Cancelled';
  return 'Draft';
}

function fmtEventDate(value) {
  if (!value) return '';
  var parts = String(value).slice(0, 10).split('-');
  if (parts.length !== 3) return value;
  var monthIndex = parseInt(parts[1], 10) - 1;
  var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (monthIndex < 0 || monthIndex > 11) return value;
  return monthNames[monthIndex] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
}

function eventWhenText(eventData) {
  var startDate = eventData.startDate || '';
  var endDate = eventData.endDate || '';
  var dateText = '';
  if (startDate && endDate && endDate !== startDate) dateText = fmtEventDate(startDate) + ' – ' + fmtEventDate(endDate);
  else dateText = fmtEventDate(startDate || endDate);

  var timeText = '';
  if (eventData.startTime) timeText = eventData.startTime + (eventData.endTime ? ' – ' + eventData.endTime : '');
  else if (eventData.endTime) timeText = 'until ' + eventData.endTime;

  if (dateText && timeText) return dateText + ' · ' + timeText;
  return dateText || timeText || '—';
}

function getEventRecordById(eventId) {
  for (var i = 0; i < APP.events.length; i++) {
    if (APP.events[i].id === eventId) return APP.events[i];
  }
  return null;
}

function currentEventRecord() {
  return APP.currentEventId ? getEventRecordById(APP.currentEventId) : null;
}

function eventVolunteerCount(eventId) {
  var total = 0;
  var approved = 0;
  APP.applications.forEach(function(application) {
    var applicationData = vd(application);
    if (applicationData.eventId !== eventId) return;
    total++;
    if (applicationData.status === 'approved') approved++;
  });
  return { total: total, approved: approved };
}

function renderEventHeader() {
  var headerElement = el('topEventName');
  renderEventSubNav();
  if (!headerElement) return;
  var currentEvent = currentEventRecord();
  if (currentEvent) {
    var eventData = vd(currentEvent);
    headerElement.textContent = eventData.name || currentEvent.name || 'Event';
    return;
  }
  headerElement.textContent = APP.hostEventName || 'Event';
}

function persistToolValue() {
  try {
    tool.setValue({ lastTab: APP.currentTab, currentEventId: APP.currentEventId });
  } catch (e) {}
}

function selectCurrentEvent(eventId) {
  APP.currentEventId = eventId || '';
  persistToolValue();
  renderEventHeader();
  renderEventSubNav();
}

/* Sidebar sub item under Events: shows which event the tool is inside. */
function renderEventSubNav() {
  var subNavButton = el('eventSubNavBtn');
  var subNavName = el('eventSubNavName');
  if (!subNavButton || !subNavName) return;

  var eventRecord = APP.currentEventId ? getEventRecordById(APP.currentEventId) : null;
  if (!APP.isManager || !eventRecord) {
    subNavButton.style.display = 'none';
    subNavButton.classList.remove('active');
    return;
  }

  var eventData = vd(eventRecord);
  var eventName = eventData.name || eventRecord.name || 'Event';
  subNavName.textContent = eventName;
  subNavButton.style.display = '';
  subNavButton.title = 'Open the management UI of "' + eventName + '"';
  subNavButton.classList.toggle('active', APP.eventManageOpen && APP.currentTab === 'events');
}

function openSelectedEventManager() {
  if (!APP.isManager || !APP.currentEventId) return;
  openEventManager(APP.currentEventId);
}

/* Open the management UI for one event: volunteers, tasks and hours of that event. */
function openEventManager(eventId) {
  if (!APP.isManager) return;
  if (eventId) selectCurrentEvent(eventId);
  if (!currentEventRecord()) { tool.notify('Event not found. Refresh and try again.', 'error'); return; }

  APP.eventManageOpen = true;
  APP.eventManageSection = 'dashboard';

  if (APP.currentTab !== 'events') switchTab('events');
  else renderEvents();
  tool.resize();
}

function closeEventManager() {
  APP.eventManageOpen = false;
  renderEvents();
  tool.resize();
}

function setEventManageSection(section) {
  APP.eventManageSection = section;
  renderEventManager();
  tool.resize();
}

function renderEvents() {
  var browseView = el('eventBrowseView');
  var manageView = el('eventManageView');
  var managerIsOpen = APP.eventManageOpen && APP.isManager && !!currentEventRecord();

  if (browseView) browseView.style.display = managerIsOpen ? 'none' : '';
  if (manageView) manageView.style.display = managerIsOpen ? '' : 'none';
  renderEventSubNav();
  if (managerIsOpen) {
    renderEventManager();
    tool.resize();
    return;
  }

  var actionsElement = el('eventActions');
  if (actionsElement) {
    actionsElement.innerHTML = APP.isManager
      ? '<button class="btn btn-primary" onclick="openEventModal()">➕ Add Event</button>'
      : '';
  }

  var listElement = el('eventList');
  if (!listElement) return;
  var countElement = el('eventListCount');

  if (APP.eventsError) {
    if (countElement) countElement.textContent = '';
    listElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h4>Event definitions unavailable</h4>'
      + '<p>' + esc(APP.eventsError) + '</p>'
      + '<p class="form-hint" style="margin-top:8px;">Authorize ' + esc(getEventsType()) + ' in settings.allowedObjectTypes.</p></div>';
    tool.resize();
    return;
  }

  var eventRecords = APP.events.slice().sort(function(recordA, recordB) {
    var dataA = vd(recordA);
    var dataB = vd(recordB);
    var dateA = dataA.startDate || '9999-12-31';
    var dateB = dataB.startDate || '9999-12-31';
    if (dateA !== dateB) return dateA < dateB ? -1 : 1;
    return String(dataA.name || recordA.name || '').localeCompare(String(dataB.name || recordB.name || ''));
  });

  if (countElement) {
    countElement.textContent = eventRecords.length + ' event' + (eventRecords.length === 1 ? '' : 's')
      + (APP.currentEventId ? ' · 1 selected for this tool' : '');
  }

  if (eventRecords.length === 0) {
    listElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><h4>No events yet</h4>'
      + '<p>Add an event definition first. Volunteers apply from an event, network approval and event approval stay separate, and tasks are defined under events.</p></div>';
    tool.resize();
    return;
  }

  var html = '<div class="table-wrap"><table class="table-compact"><thead><tr>'
    + '<th>Event</th><th>Status</th><th>When</th><th class="col-location">Location</th>'
    + '<th class="cell-hours">Volunteers</th><th class="cell-actions-head">Actions</th>'
    + '</tr></thead><tbody>';

  eventRecords.forEach(function(record) {
    var eventData = vd(record);
    var eventName = eventData.name || record.name || 'Untitled event';
    var isCurrent = record.id === APP.currentEventId;
    var counts = eventVolunteerCount(record.id);
    var volunteerText = counts.total
      ? counts.total + ' <span class="person-sub">(' + counts.approved + ' approved)</span>'
      : '0';

    html += '<tr>'
      + '<td><div class="person-main"><button type="button" class="event-open-link" onclick="openEventManager(\'' + escJs(record.id) + '\')">' + esc(eventName) + '</button>'
      + (isCurrent ? ' <span class="event-current-chip">current</span>' : '')
      + (eventData.description ? '<div class="person-sub cell-clip" title="' + esc(String(eventData.description)) + '">' + esc(String(eventData.description).slice(0, 90)) + '</div>' : '')
      + '</div></td>'
      + '<td><span class="badge badge-' + (eventData.status || 'draft') + '">' + esc(eventStatusLabel(eventData.status)) + '</span></td>'
      + '<td>' + esc(eventWhenText(eventData)) + '</td>'
      + '<td class="cell-clip col-location" title="' + esc([eventData.locationName, eventData.city].filter(Boolean).join(', ')) + '">' + esc([eventData.locationName, eventData.city].filter(Boolean).join(', ') || '—') + '</td>'
      + '<td class="cell-hours">' + volunteerText + '</td>'
      + '<td><div class="actions-cell">'
      + '<button class="btn btn-xs btn-primary" onclick="openEventManager(\'' + escJs(record.id) + '\')">Manage</button>'
      + '<button class="btn btn-xs btn-outline" onclick="openEventModal(\'' + escJs(record.id) + '\')">Edit</button>'
      + '</div></td>'
      + '</tr>';
  });

  html += '</tbody></table></div>';
  listElement.innerHTML = html;
  tool.resize();
}

function openEventModal(eventId) {
  if (!APP.isManager) return;
  if (APP.readOnly) { tool.notify('This record is read-only.', 'info'); return; }

  editingEventId = eventId || '';
  var record = editingEventId ? getEventRecordById(editingEventId) : null;
  if (editingEventId && !record) { tool.notify('Event not found. Refresh and try again.', 'error'); return; }
  var eventData = record ? vd(record) : {};

  el('eventModalTitle').textContent = record ? '✏️ Edit Event' : '📅 New Event';
  el('eventSaveBtn').textContent = record ? 'Save Changes' : 'Create Event';
  el('eventDeleteBtn').style.display = record ? '' : 'none';

  el('eventName').value = eventData.name || (record ? record.name : '') || '';
  el('eventDescription').value = eventData.description || '';
  el('eventStatus').value = eventData.status || 'draft';
  el('eventCapacity').value = eventData.capacity || '';
  el('eventStartDate').value = eventData.startDate || '';
  el('eventEndDate').value = eventData.endDate || '';
  el('eventStartTime').value = eventData.startTime || '';
  el('eventEndTime').value = eventData.endTime || '';
  el('eventLocation').value = eventData.locationName || '';
  el('eventAddress').value = eventData.address || '';
  el('eventCity').value = eventData.city || '';
  el('eventContactName').value = eventData.contactName || '';
  el('eventContactPhone').value = eventData.contactPhone || '';
  el('eventContactEmail').value = eventData.contactEmail || '';
  el('eventNotes').value = eventData.notes || '';

  openModal('modalEvent');
  var nameInput = el('eventName');
  if (nameInput && nameInput.focus) nameInput.focus();
}

function saveEvent() {
  if (!APP.isManager || APP.readOnly) return;

  var name = el('eventName').value.trim();
  if (!name) { tool.notify('Event name is required.', 'warning'); return; }

  var startDate = el('eventStartDate').value || '';
  var endDate = el('eventEndDate').value || '';
  if (startDate && endDate && endDate < startDate) {
    tool.notify('End date cannot be before the start date.', 'warning');
    return;
  }

  var eventData = {
    name: name,
    description: el('eventDescription').value.trim(),
    status: el('eventStatus').value || 'draft',
    capacity: parseInt(el('eventCapacity').value, 10) || 0,
    startDate: startDate,
    endDate: endDate,
    startTime: el('eventStartTime').value || '',
    endTime: el('eventEndTime').value || '',
    locationName: el('eventLocation').value.trim(),
    address: el('eventAddress').value.trim(),
    city: el('eventCity').value.trim(),
    contactName: el('eventContactName').value.trim(),
    contactPhone: el('eventContactPhone').value.trim(),
    contactEmail: el('eventContactEmail').value.trim(),
    notes: el('eventNotes').value.trim(),
    updatedAt: isoNow()
  };

  function finishEventSave(message) {
    tool.notify(message, 'success');
    closeModal('modalEvent');
    reloadAndRender();
  }

  if (editingEventId) {
    var record = getEventRecordById(editingEventId);
    var merged = {};
    var existingData = record ? vd(record) : {};
    for (var existingKey in existingData) {
      if (existingData.hasOwnProperty(existingKey)) merged[existingKey] = existingData[existingKey];
    }
    for (var eventKey in eventData) {
      if (eventData.hasOwnProperty(eventKey)) merged[eventKey] = eventData[eventKey];
    }
    updateObject(getEventsType(), editingEventId, merged, name, function(err) {
      if (err) { tool.notify('Error saving event: ' + err, 'error'); return; }
      finishEventSave('Event updated.');
    });
  } else {
    eventData.createdAt = isoNow();
    eventData.createdBy = APP.user ? (APP.user.name || APP.user.email || '') : '';
    createObject(getEventsType(), name, eventData, function(err) {
      if (err) { tool.notify('Error creating event: ' + err, 'error'); return; }
      finishEventSave('Event created.');
    });
  }
}

function confirmDeleteEvent() {
  if (!editingEventId) return;
  var record = getEventRecordById(editingEventId);
  if (!record) return;

  var eventData = vd(record);
  var eventName = eventData.name || record.name || 'this event';
  var counts = eventVolunteerCount(editingEventId);
  var warningText = counts.total
    ? ' ' + counts.total + ' volunteer relation' + (counts.total === 1 ? '' : 's') + ' still reference this event.'
    : '';
  var eventId = editingEventId;

  showConfirm('Delete Event?', 'Delete <strong>' + esc(eventName) + '</strong>?' + warningText, function() {
    deleteObject(getEventsType(), eventId, function(err) {
      if (err) { tool.notify('Error deleting event: ' + err, 'error'); return; }
      closeModal('modalEvent');
      if (APP.currentEventId === eventId) {
        APP.currentEventId = '';
        persistToolValue();
        renderEventHeader();
      }
      editingEventId = '';
      tool.notify('Event deleted.', 'info');
      reloadAndRender();
    });
  });
}

/* ── UI: Event Management (one event: volunteers, tasks, hours) ── */
function eventApplicationsFor(eventId) {
  return APP.applications.filter(function(application) {
    return vd(application).eventId === eventId;
  });
}

function eventApprovedApplications(eventId) {
  return eventApplicationsFor(eventId).filter(function(application) {
    return vd(application).status === 'approved';
  });
}

function eventTasksFor(eventId) {
  return APP.tasks.filter(function(task) { return vd(task).eventId === eventId; });
}

function eventHoursFor(eventId) {
  return APP.hours.filter(function(hour) { return vd(hour).eventId === eventId; });
}

/* Resolve a person from either link: registry profile id first, then the CMS user id. */
function volunteerNameFromIds(registryProfileId, volunteerUserId) {
  var profile = registryProfileId ? getRegistryProfileById(registryProfileId) : null;
  if (!profile && volunteerUserId) profile = getRegistryProfileByUserId(volunteerUserId);
  return profile ? profileName(profile) : 'Unknown volunteer';
}

function taskAssigneeName(taskData) {
  if (!taskData.assignedRegistryProfileId && !taskData.assignedVolunteerUserId) return 'Unassigned';
  return volunteerNameFromIds(taskData.assignedRegistryProfileId, taskData.assignedVolunteerUserId);
}

/* Does this task / hour record belong to that person? Profile link wins over the user id. */
function recordBelongsToPerson(recordData, registryProfileId, volunteerUserId) {
  if (registryProfileId && recordData.registryProfileId === registryProfileId) return true;
  if (registryProfileId && recordData.assignedRegistryProfileId === registryProfileId) return true;
  if (!recordData.registryProfileId && !recordData.assignedRegistryProfileId && volunteerUserId) {
    if (recordData.volunteerUserId === volunteerUserId) return true;
    if (recordData.assignedVolunteerUserId === volunteerUserId) return true;
  }
  return false;
}

function volunteerTaskCountForEvent(eventId, registryProfileId, volunteerUserId) {
  var count = 0;
  eventTasksFor(eventId).forEach(function(task) {
    var taskData = vd(task);
    if (!taskData.assignedRegistryProfileId && !taskData.assignedVolunteerUserId) return;
    if (recordBelongsToPerson(taskData, registryProfileId, volunteerUserId)) count++;
  });
  return count;
}

function volunteerHoursForEvent(eventId, registryProfileId, volunteerUserId) {
  var totals = { logged: 0, approved: 0, pending: 0 };
  eventHoursFor(eventId).forEach(function(hour) {
    var hourData = vd(hour);
    if (!recordBelongsToPerson(hourData, registryProfileId, volunteerUserId)) return;
    var amount = Number(hourData.hoursLogged) || 0;
    totals.logged += amount;
    if (hourData.status === 'approved') totals.approved += amount;
    if (hourData.status === 'pending') totals.pending += amount;
  });
  return totals;
}

function eventHoursTotalFor(eventId, status) {
  var total = 0;
  eventHoursFor(eventId).forEach(function(hour) {
    var hourData = vd(hour);
    if (status && hourData.status !== status) return;
    total += Number(hourData.hoursLogged) || 0;
  });
  return total;
}

function renderEventManager() {
  var record = currentEventRecord();
  var headElement = el('eventManageHead');
  var navElement = el('eventManageNav');
  var bodyElement = el('eventManageBody');
  if (!record || !headElement || !navElement || !bodyElement) return;

  var eventData = vd(record);
  var eventName = eventData.name || record.name || 'Event';
  var linkedApplications = eventApplicationsFor(record.id);
  var approvedApplications = eventApprovedApplications(record.id);
  var tasks = eventTasksFor(record.id);
  var hours = eventHoursFor(record.id);
  var placeText = [eventData.locationName, eventData.city].filter(Boolean).join(', ');
  var capacityText = eventData.capacity ? 'Capacity ' + eventData.capacity : 'No capacity set';

  headElement.innerHTML = ''
    + '<div class="event-manage-back">'
    + '<button class="btn btn-sm btn-ghost" onclick="closeEventManager()">← All events</button>'
    + '<span class="badge badge-' + (eventData.status || 'draft') + '">' + esc(eventStatusLabel(eventData.status)) + '</span>'
    + '</div>'
    + '<div class="event-manage-title-row">'
    + '<div class="event-manage-heading">'
    + '<h2 class="event-manage-name">' + esc(eventName) + '</h2>'
    + '<div class="event-manage-meta">' + esc(eventWhenText(eventData)) + (placeText ? ' · ' + esc(placeText) : '') + ' · ' + esc(capacityText) + '</div>'
    + '</div>'
    + '<div class="event-manage-actions">'
    + '<button class="btn btn-sm btn-outline" onclick="openEventModal(\'' + escJs(record.id) + '\')">✏️ Edit Event</button>'
    + '</div>'
    + '</div>';

  var sections = [
    { key: 'dashboard', label: '📊 Dashboard', count: '' },
    { key: 'volunteers', label: '👥 Volunteers', count: approvedApplications.length + ' / ' + linkedApplications.length },
    { key: 'tasks', label: '📋 Tasks', count: String(tasks.length) },
    { key: 'hours', label: '⏱️ Hours', count: eventHoursTotalFor(record.id, 'approved').toFixed(1) + ' h' },
    { key: 'report', label: '📈 Report', count: '' }
  ];
  navElement.innerHTML = sections.map(function(section) {
    var activeClass = APP.eventManageSection === section.key ? ' active' : '';
    var countHtml = section.count ? ' <span class="seg-count">' + esc(section.count) + '</span>' : '';
    return '<button class="seg-btn' + activeClass + '" onclick="setEventManageSection(\'' + section.key + '\')">'
      + esc(section.label) + countHtml + '</button>';
  }).join('');

  if (APP.eventManageSection === 'dashboard') {
    bodyElement.innerHTML = buildEventDashboardHtml(record.id);
  } else if (APP.eventManageSection === 'report') {
    bodyElement.innerHTML = buildEventReportHtml(record.id);
  } else if (APP.eventManageSection === 'tasks') {
    renderEventTasksSection(bodyElement, record);
  } else if (APP.eventManageSection === 'hours') {
    renderEventHoursSection(bodyElement, record);
  } else {
    renderEventVolunteersSection(bodyElement, record);
  }
}

/* ── Section: event volunteers ── */
function renderEventVolunteersSection(container, record) {
  var applications = eventApplicationsFor(record.id).slice();
  var approvedCount = applications.filter(function(application) { return vd(application).status === 'approved'; }).length;

  var html = '<div class="card"><div class="card-header"><div>'
    + '<h3>Event Volunteers</h3>'
    + '<div class="list-count">' + applications.length + ' linked · ' + approvedCount + ' approved for this event</div>'
    + '</div><button class="btn btn-sm btn-primary" onclick="openVolunteerPicker()">➕ Add Volunteers</button></div>'
    + '<div class="card-body table-flush">';

  if (applications.length === 0) {
    html += '<div class="empty-state"><div class="empty-state-icon">👥</div><h4>No volunteers linked yet</h4>'
      + '<p>Use Add Volunteers to pick people from the volunteer network and link them to this event.</p></div>';
  } else {
    applications.sort(function(firstApplication, secondApplication) {
      var firstPending = vd(firstApplication).status === 'pending' ? 0 : 1;
      var secondPending = vd(secondApplication).status === 'pending' ? 0 : 1;
      if (firstPending !== secondPending) return firstPending - secondPending;
      return approvedUserName(firstApplication).localeCompare(approvedUserName(secondApplication));
    });

    html += '<div class="table-wrap"><table class="table-compact"><thead><tr>'
      + '<th>Volunteer</th><th>Network</th><th>Event status</th><th class="cell-hours col-task-count">Tasks</th><th class="cell-hours">Hours</th><th class="cell-actions-head">Actions</th>'
      + '</tr></thead><tbody>';

    applications.forEach(function(application) {
      var applicationData = vd(application);
      var profile = getApplicationProfile(application);
      var profileData = profile ? vd(profile) : {};
      var personName = profile ? profileName(profile) : (application.name || 'Unknown');
      var networkStatus = profileData.status || 'candidate';
      var taskCount = volunteerTaskCountForEvent(record.id, profile ? profile.id : applicationData.registryProfileId, applicationData.volunteerUserId);
      var hourTotals = volunteerHoursForEvent(record.id, profile ? profile.id : applicationData.registryProfileId, applicationData.volunteerUserId);

      html += '<tr>'
        + '<td><div class="person-main"><div class="person-name">'
        + (profile
            ? '<button type="button" class="name-link" title="Open the dashboard and report of this volunteer" onclick="openVolunteerDetail(\'' + escJs(profile.id) + '\')">' + esc(personName) + '</button>'
            : esc(personName))
        + '</div>'
        + '<div class="person-sub">' + esc(profileData.email || '—') + '</div></div></td>'
        + '<td><span class="badge badge-' + esc(volunteerNetworkBadgeClass(networkStatus)) + '">' + esc(volunteerNetworkLabel(networkStatus)) + '</span></td>'
        + '<td><span class="badge badge-' + esc(applicationData.status || 'pending') + '">' + esc(volunteerStatusLabel(applicationData.status)) + '</span></td>'
        + '<td class="cell-hours col-task-count">' + taskCount + '</td>'
        + '<td class="cell-hours">' + hourTotals.approved.toFixed(1) + ' <span class="person-sub">/ ' + hourTotals.logged.toFixed(1) + ' logged</span></td>'
        + '<td><div class="actions-cell">';

      if (applicationData.status === 'pending') {
        html += '<button class="btn btn-xs btn-success" onclick="approveVolunteer(\'' + escJs(application.id) + '\')">Approve</button>'
          + '<button class="btn btn-xs btn-danger" onclick="rejectVolunteer(\'' + escJs(application.id) + '\')">Decline</button>';
      }
      html += '<button class="btn btn-xs btn-outline" onclick="openEditVolunteerModal(\'' + escJs(profile ? profile.id : '') + '\',\'' + escJs(application.id) + '\')">Edit person</button>'
        + '<button class="btn btn-xs btn-ghost" title="Remove this volunteer from the event" onclick="removeVolunteerFromEvent(\'' + escJs(application.id) + '\')">Remove</button>'
        + '</div></td></tr>';
    });

    html += '</tbody></table></div>';
  }

  html += '</div></div>';
  container.innerHTML = html;
}

function removeVolunteerFromEvent(applicationId) {
  if (!APP.isManager) return;
  var application = getApplicationById(applicationId);
  if (!application) return;
  var personName = approvedUserName(application);
  showConfirm('Remove from Event?', 'Remove <strong>' + esc(personName) + '</strong> from this event? The person stays in the volunteer network.', function() {
    deleteObject(TYPE_APPLICATIONS, applicationId, function(err) {
      if (err) { tool.notify('Error removing volunteer: ' + err, 'error'); return; }
      tool.notify('Volunteer removed from this event.', 'info');
      reloadAndRender();
    });
  });
}

/* ── Add volunteers to the open event ── */
var pickerSelectedProfileIds = {};

function openVolunteerPicker() {
  if (!APP.isManager) return;
  var record = currentEventRecord();
  if (!record) { tool.notify('Open an event first.', 'warning'); return; }
  pickerSelectedProfileIds = {};
  el('pickVolEventName').textContent = vd(record).name || record.name || 'Event';
  el('pickVolSearch').value = '';
  renderVolunteerPicker();
  openModal('modalPickVolunteers');
}

function pickerCandidateProfiles() {
  var linkedProfileIds = {};
  var linkedUserIds = {};
  eventApplicationsFor(APP.currentEventId).forEach(function(application) {
    var applicationData = vd(application);
    if (applicationData.registryProfileId) linkedProfileIds[applicationData.registryProfileId] = true;
    if (applicationData.volunteerUserId) linkedUserIds[applicationData.volunteerUserId] = true;
  });

  var searchText = (el('pickVolSearch').value || '').trim().toLowerCase();
  return APP.registry.filter(function(profile) {
    var profileData = vd(profile);
    if (profileData.status === 'banned') return false;
    if (linkedProfileIds[profile.id]) return false;
    if (profileData.userId && linkedUserIds[profileData.userId]) return false;
    if (!searchText) return true;
    var haystack = [profileName(profile), profileData.email, profileData.skills, profileData.city].join(' ').toLowerCase();
    return haystack.indexOf(searchText) !== -1;
  });
}

function renderVolunteerPicker() {
  var listElement = el('pickVolList');
  if (!listElement) return;
  var candidates = pickerCandidateProfiles();

  if (candidates.length === 0) {
    listElement.innerHTML = '<div class="empty-state" style="padding:18px;"><div class="empty-state-icon">✅</div>'
      + '<h4>Nobody left to add</h4><p>Everyone in the volunteer network is already linked to this event, or the search matches nobody.</p></div>';
    updatePickerSelectionCount();
    return;
  }

  var html = '<div class="pick-list">';
  candidates.forEach(function(profile) {
    var profileData = vd(profile);
    var isChecked = !!pickerSelectedProfileIds[profile.id];
    var networkStatus = profileData.status || 'candidate';
    html += '<label class="pick-row' + (isChecked ? ' selected' : '') + '">'
      + '<input type="checkbox" class="pick-check" value="' + esc(profile.id) + '"' + (isChecked ? ' checked' : '')
      + ' onchange="togglePickerSelection(\'' + escJs(profile.id) + '\', this.checked)">'
      + '<span class="pick-person"><span class="person-name">' + esc(profileName(profile)) + '</span>'
      + '<span class="person-sub">' + esc(profileData.email || '—') + (profileData.city ? ' · ' + esc(profileData.city) : '') + '</span></span>'
      + '<span class="badge badge-' + esc(volunteerNetworkBadgeClass(networkStatus)) + '">' + esc(volunteerNetworkLabel(networkStatus)) + '</span>'
      + '</label>';
  });
  html += '</div>';
  listElement.innerHTML = html;
  updatePickerSelectionCount();
}

function togglePickerSelection(profileId, isSelected) {
  if (isSelected) pickerSelectedProfileIds[profileId] = true;
  else delete pickerSelectedProfileIds[profileId];
  updatePickerSelectionCount();
  var rows = qsa('#pickVolList .pick-row');
  rows.forEach(function(row) {
    var checkbox = row.querySelector('.pick-check');
    if (checkbox && checkbox.value === profileId) row.classList.toggle('selected', isSelected);
  });
}

function selectedPickerProfileIds() {
  return Object.keys(pickerSelectedProfileIds);
}

function updatePickerSelectionCount() {
  var selectedCount = selectedPickerProfileIds().length;
  var countElement = el('pickVolCount');
  var saveButton = el('pickVolSaveBtn');
  if (countElement) countElement.textContent = selectedCount + ' selected';
  if (saveButton) {
    saveButton.textContent = selectedCount ? 'Add Selected (' + selectedCount + ')' : 'Add Selected';
    saveButton.disabled = selectedCount === 0;
  }
}

function saveVolunteerPicker() {
  if (!APP.isManager) return;
  var eventRecord = currentEventRecord();
  if (!eventRecord) return;
  var profileIdsToAdd = selectedPickerProfileIds();
  if (profileIdsToAdd.length === 0) { tool.notify('Select at least one volunteer.', 'warning'); return; }

  var reviewerName = APP.user ? (APP.user.name || APP.user.email || '') : '';
  var remaining = profileIdsToAdd.length;
  var failedCount = 0;

  profileIdsToAdd.forEach(function(profileId) {
    var profile = getRegistryProfileById(profileId);
    if (!profile) { remaining--; failedCount++; finishIfDone(); return; }
    var profileData = vd(profile);
    var applicationData = {
      registryProfileId: profileId,
      volunteerUserId: profileData.userId || '',
      eventId: eventRecord.id,
      status: 'approved',
      appliedAt: isoNow(),
      notes: 'Added to the event by a manager',
      reviewedAt: isoNow(),
      reviewedBy: reviewerName
    };
    createObject(TYPE_APPLICATIONS, profileName(profile), applicationData, function(err) {
      if (err) failedCount++;
      remaining--;
      finishIfDone();
    });
  });

  function finishIfDone() {
    if (remaining > 0) return;
    pickerSelectedProfileIds = {};
    closeModal('modalPickVolunteers');
    if (failedCount) tool.notify('Some volunteers could not be added (' + failedCount + ' failed).', 'warning');
    else tool.notify('Volunteers added to the event.', 'success');
    reloadAndRender();
  }
}

/* ── Section: event tasks ── */
function renderEventTasksSection(container, record) {
  var tasks = eventTasksFor(record.id).slice();
  var approvedApplications = eventApprovedApplications(record.id);

  var html = '<div class="card"><div class="card-header"><div>'
    + '<h3>Event Tasks</h3>'
    + '<div class="list-count">' + tasks.length + ' task' + (tasks.length === 1 ? '' : 's') + ' for this event</div>'
    + '</div><button class="btn btn-sm btn-primary" onclick="openTaskModal(null, \'' + escJs(record.id) + '\')">➕ Add Task</button></div>'
    + '<div class="card-body table-flush">';

  if (tasks.length === 0) {
    html += '<div class="empty-state"><div class="empty-state-icon">📋</div><h4>No tasks yet</h4>'
      + '<p>Add the first task, then assign it to one of the volunteers approved for this event.</p></div>';
  } else {
    var statusOrder = { 'in-progress': 0, 'assigned': 1, 'open': 2, 'completed': 3, 'cancelled': 4 };
    tasks.sort(function(firstTask, secondTask) {
      var firstOrder = statusOrder[vd(firstTask).status];
      var secondOrder = statusOrder[vd(secondTask).status];
      return (firstOrder === undefined ? 5 : firstOrder) - (secondOrder === undefined ? 5 : secondOrder);
    });

    html += '<div class="table-wrap"><table class="table-compact"><thead><tr>'
      + '<th>Task</th><th>Assignee</th><th class="col-due">Due</th><th class="cell-hours col-est-hours">Est. h</th><th class="cell-hours col-logged-hours">Logged h</th><th>Status</th><th class="cell-actions-head">Actions</th>'
      + '</tr></thead><tbody>';

    tasks.forEach(function(task) {
      var taskData = vd(task);
      var loggedHours = eventHoursFor(record.id).reduce(function(total, hour) {
        var hourData = vd(hour);
        if (hourData.taskId !== task.id) return total;
        return total + (Number(hourData.hoursLogged) || 0);
      }, 0);

      html += '<tr>'
        + '<td><div class="person-main"><div class="person-name">' + esc(task.name) + '</div>'
        + (taskData.description ? '<div class="person-sub cell-clip" title="' + esc(taskData.description) + '">' + esc(taskData.description) + '</div>' : '')
        + '</div></td>'
        + '<td>' + taskAssigneeSelect(task, approvedApplications) + '</td>'
        + '<td class="col-due">' + esc(taskData.dueDate ? fmtDate(taskData.dueDate) : '—') + '</td>'
        + '<td class="cell-hours col-est-hours">' + (taskData.estimatedHours || 0) + '</td>'
        + '<td class="cell-hours col-logged-hours">' + loggedHours.toFixed(1) + '</td>'
        + '<td><span class="badge badge-' + esc(taskData.status || 'open') + '">' + esc(volunteerStatusLabel(taskData.status)) + '</span></td>'
        + '<td><div class="actions-cell">'
        + '<button class="btn btn-xs btn-outline" onclick="openTaskModal(\'' + escJs(task.id) + '\')">Edit</button>'
        + (taskData.status === 'completed' ? '' : '<button class="btn btn-xs btn-success" onclick="completeTask(\'' + escJs(task.id) + '\')">Complete</button>')
        + '<button class="btn btn-xs btn-ghost" onclick="deleteTask(\'' + escJs(task.id) + '\')">Delete</button>'
        + '</div></td></tr>';
    });

    html += '</tbody></table></div>';
  }

  html += '</div></div>';
  container.innerHTML = html;
}

function taskAssigneeSelect(task, approvedApplications) {
  var taskData = vd(task);
  var selectedProfileId = taskData.assignedRegistryProfileId || '';
  if (!selectedProfileId && taskData.assignedVolunteerUserId) {
    var linkedProfile = getRegistryProfileByUserId(taskData.assignedVolunteerUserId);
    selectedProfileId = linkedProfile ? linkedProfile.id : '';
  }

  var options = '<option value="">Unassigned</option>';
  var currentPersonKnown = false;
  approvedApplications.forEach(function(application) {
    var profile = getApplicationProfile(application);
    if (!profile) return;
    if (profile.id === selectedProfileId) currentPersonKnown = true;
    options += '<option value="' + esc(profile.id) + '"' + (profile.id === selectedProfileId ? ' selected' : '') + '>'
      + esc(profileName(profile)) + '</option>';
  });
  if (selectedProfileId && !currentPersonKnown) {
    options += '<option value="' + esc(selectedProfileId) + '" selected>' + esc(taskAssigneeName(taskData)) + ' (not approved for this event)</option>';
  }

  return '<select class="form-select select-inline" onchange="assignTaskToVolunteer(\'' + escJs(task.id) + '\', this.value)">'
    + options + '</select>';
}

function assignTaskToVolunteer(taskId, registryProfileId) {
  if (!APP.isManager) return;
  var task = getTaskById(taskId);
  if (!task) return;
  var taskData = vd(task);
  var updatedData = {};
  for (var key in taskData) {
    if (taskData.hasOwnProperty(key)) updatedData[key] = taskData[key];
  }

  if (registryProfileId) {
    var profile = getRegistryProfileById(registryProfileId);
    var isApprovedForEvent = eventApprovedApplications(APP.currentEventId).some(function(application) {
      var linkedProfile = getApplicationProfile(application);
      return !!linkedProfile && linkedProfile.id === registryProfileId;
    });
    if (APP.currentEventId && !isApprovedForEvent) {
      tool.notify('Approve this volunteer for the event before assigning tasks.', 'warning');
      renderEventManager();
      return;
    }
    updatedData.assignedRegistryProfileId = registryProfileId;
    updatedData.assignedVolunteerUserId = profile ? (vd(profile).userId || '') : '';
    if (!updatedData.status || updatedData.status === 'open') updatedData.status = 'assigned';
  } else {
    updatedData.assignedRegistryProfileId = '';
    updatedData.assignedVolunteerUserId = '';
    if (updatedData.status === 'assigned' || updatedData.status === 'in-progress') updatedData.status = 'open';
  }

  updateObject(TYPE_TASKS, taskId, updatedData, task.name, function(err) {
    if (err) { tool.notify('Error assigning task: ' + err, 'error'); return; }
    tool.notify(registryProfileId ? 'Task assigned.' : 'Task is now unassigned.', 'success');
    reloadAndRender();
  });
}

/* ── Section: event hours ── */
function renderEventHoursSection(container, record) {
  var hours = eventHoursFor(record.id).slice();
  var approvedApplications = eventApprovedApplications(record.id);
  var totalLogged = eventHoursTotalFor(record.id);
  var totalApproved = eventHoursTotalFor(record.id, 'approved');
  var totalPending = eventHoursTotalFor(record.id, 'pending');

  var html = '<div class="card"><div class="card-header"><div>'
    + '<h3>Hours per Volunteer</h3>'
    + '<div class="list-count">' + totalLogged.toFixed(1) + ' h logged · ' + totalApproved.toFixed(1) + ' h approved · ' + totalPending.toFixed(1) + ' h pending</div>'
    + '</div><button class="btn btn-sm btn-primary" onclick="openHoursModal(null, { eventId: \'' + escJs(record.id) + '\' })">⏱️ Set Hours</button></div>'
    + '<div class="card-body table-flush">';

  if (approvedApplications.length === 0) {
    html += '<div class="empty-state"><div class="empty-state-icon">⏱️</div><h4>No volunteers approved yet</h4>'
      + '<p>Approve volunteers for this event first, then record the hours each of them spent.</p></div>';
  } else {
    html += '<div class="table-wrap"><table class="table-compact"><thead><tr>'
      + '<th>Volunteer</th><th class="cell-hours">Logged</th><th class="cell-hours">Approved</th><th class="cell-hours">Pending</th><th class="cell-actions-head">Actions</th>'
      + '</tr></thead><tbody>';

    approvedApplications.forEach(function(application) {
      var profile = getApplicationProfile(application);
      var applicationData = vd(application);
      var profileId = profile ? profile.id : applicationData.registryProfileId;
      var totals = volunteerHoursForEvent(record.id, profileId, applicationData.volunteerUserId);
      var personName = profile ? profileName(profile) : 'Unknown';

      html += '<tr>'
        + '<td><div class="person-main"><div class="person-name">' + esc(personName) + '</div>'
        + '<div class="person-sub">' + esc(profile ? (vd(profile).email || '—') : '—') + '</div></div></td>'
        + '<td class="cell-hours">' + totals.logged.toFixed(1) + '</td>'
        + '<td class="cell-hours">' + totals.approved.toFixed(1) + '</td>'
        + '<td class="cell-hours">' + totals.pending.toFixed(1) + '</td>'
        + '<td><div class="actions-cell">'
        + '<button class="btn btn-xs btn-outline" onclick="openHoursModal(null, { eventId: \'' + escJs(record.id) + '\', registryProfileId: \'' + escJs(profileId || '') + '\' })">➕ Add Hours</button>'
        + '</div></td></tr>';
    });

    html += '</tbody></table></div>';
  }

  html += '</div></div>';

  html += '<div class="card"><div class="card-header"><h3>Hour Records</h3></div><div class="card-body table-flush">';
  if (hours.length === 0) {
    html += '<div class="empty-state" style="padding:18px;"><div class="empty-state-icon">🗓️</div><h4>No hours recorded</h4><p>Use Set Hours to record the time a volunteer spent on this event.</p></div>';
  } else {
    hours.sort(function(firstHour, secondHour) {
      return String(vd(secondHour).date || '').localeCompare(String(vd(firstHour).date || ''));
    });
    html += '<div class="table-wrap"><table class="table-compact"><thead><tr>'
      + '<th>Date</th><th>Volunteer</th><th>Task</th><th class="cell-hours">Hours</th><th>Status</th><th class="cell-actions-head">Actions</th>'
      + '</tr></thead><tbody>';
    hours.forEach(function(hour) {
      var hourData = vd(hour);
      html += '<tr>'
        + '<td>' + esc(fmtDate(hourData.date)) + '</td>'
        + '<td>' + esc(volunteerNameFromIds(hourData.registryProfileId, hourData.volunteerUserId)) + '</td>'
        + '<td>' + esc(hourData.taskName || 'General') + '</td>'
        + '<td class="cell-hours">' + (Number(hourData.hoursLogged) || 0).toFixed(1) + '</td>'
        + '<td><span class="badge badge-' + esc(hourData.status || 'pending') + '">' + esc(volunteerStatusLabel(hourData.status)) + '</span></td>'
        + '<td><div class="actions-cell">'
        + '<button class="btn btn-xs btn-outline" onclick="editHoursRecord(\'' + escJs(hour.id) + '\')">Edit</button>'
        + (hourData.status === 'pending'
          ? '<button class="btn btn-xs btn-success" onclick="approveHours(\'' + escJs(hour.id) + '\')">Approve</button>'
            + '<button class="btn btn-xs btn-danger" onclick="rejectHours(\'' + escJs(hour.id) + '\')">Reject</button>'
          : '')
        + '<button class="btn btn-xs btn-ghost" onclick="deleteHoursRecord(\'' + escJs(hour.id) + '\')">Delete</button>'
        + '</div></td></tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '</div></div>';

  container.innerHTML = html;
}

function deleteHoursRecord(hourId) {
  if (!APP.isManager) return;
  var hour = APP.hours.filter(function(candidate) { return candidate.id === hourId; })[0];
  if (!hour) return;
  var hourData = vd(hour);
  showConfirm('Delete Hours?', 'Delete the ' + (Number(hourData.hoursLogged) || 0).toFixed(1) + ' h record for '
    + '<strong>' + esc(volunteerNameFromIds(hourData.registryProfileId, hourData.volunteerUserId)) + '</strong>?', function() {
    deleteObject(TYPE_HOURS, hourId, function(err) {
      if (err) { tool.notify('Error deleting hours: ' + err, 'error'); return; }
      tool.notify('Hour record deleted.', 'info');
      reloadAndRender();
    });
  });
}

/* ── UI: Volunteers ── */
function volunteerStatusLabel(eventStatus) {
  if (eventStatus === 'not-applied') return 'Not linked';
  if (eventStatus === 'pending') return 'Pending';
  if (!eventStatus) return 'Unknown';
  return eventStatus.charAt(0).toUpperCase() + eventStatus.slice(1).replace(/-/g, ' ');
}

/* Network status = the person's standing in the volunteer network (stage one).
   Event status = this event's own approve/decline decision (stage two). */
function volunteerNetworkStatus(volunteerRow) {
  return volunteerRow.profileData.status || (volunteerRow.profile ? 'active' : 'candidate');
}

function volunteerNetworkLabel(networkStatus) {
  if (networkStatus === 'candidate') return 'Candidate';
  if (networkStatus === 'inactive') return 'Inactive';
  if (networkStatus === 'banned') return 'Banned';
  return 'Approved';
}

function volunteerNetworkBadgeClass(networkStatus) {
  if (networkStatus === 'candidate') return 'candidate';
  if (networkStatus === 'inactive') return 'withdrawn';
  if (networkStatus === 'banned') return 'rejected';
  return 'approved';
}

function findPermittedUser(userId) {
  for (var i = 0; i < APP.permittedUsers.length; i++) {
    if (APP.permittedUsers[i].id === userId) return APP.permittedUsers[i];
  }
  return null;
}

/* One unified row per person: registry profile + this event's application
   (candidates are also included when only an application record exists). */
function buildVolunteerRows() {
  var rows = [];
  var rowByProfileId = {};
  var rowByUserId = {};

  APP.registry.forEach(function(profile) {
    var profileData = vd(profile);
    var volunteerRow = { profile: profile, profileData: profileData, application: null };
    rows.push(volunteerRow);
    rowByProfileId[profile.id] = volunteerRow;
    if (profileData.userId) rowByUserId[profileData.userId] = volunteerRow;
  });

  APP.applications.forEach(function(application) {
    var applicationData = vd(application);
    var linkedRow = null;
    if (applicationData.registryProfileId) linkedRow = rowByProfileId[applicationData.registryProfileId] || null;
    if (!linkedRow && applicationData.volunteerUserId) linkedRow = rowByUserId[applicationData.volunteerUserId] || null;

    // Apply the event status to the person's existing row; one application per event.
    if (linkedRow) {
      if (!linkedRow.application) linkedRow.application = application;
      return;
    }

    var permittedUser = findPermittedUser(applicationData.volunteerUserId) || {};
    rows.push({
      profile: null,
      profileData: {
        userId: applicationData.volunteerUserId || '',
        firstName: permittedUser.name || application.name || '',
        lastName: '',
        email: permittedUser.email || '',
        skills: applicationData.skills || '',
        status: 'candidate'
      },
      application: application
    });
  });

  return rows;
}

function volunteerRowStatus(volunteerRow) {
  return volunteerRow.application ? (vd(volunteerRow.application).status || 'pending') : 'not-applied';
}

function volunteerRowName(volunteerRow) {
  if (volunteerRow.profile) return profileName(volunteerRow.profile);
  return volunteerRow.profileData.firstName || volunteerRow.profileData.email || 'Unknown';
}

function volunteerApprovedHours(volunteerUserId) {
  var totalHours = 0;
  if (!volunteerUserId) return totalHours;
  APP.hours.forEach(function(hourLog) {
    var hourData = vd(hourLog);
    if (hourData.volunteerUserId === volunteerUserId && hourData.status === 'approved') {
      totalHours += (Number(hourData.hoursLogged) || 0);
    }
  });
  return totalHours;
}

/* ── Volunteer detail view: dashboard + report of one person ── */
function openVolunteerDetail(profileId) {
  if (!APP.isManager) return;
  var profile = getRegistryProfileById(profileId);
  if (!profile) { tool.notify('Volunteer not found. Refresh and try again.', 'error'); return; }
  APP.volunteerDetailProfileId = profileId;
  APP.volunteerDetailOpen = true;
  APP.volunteerDetailSection = 'dashboard';
  if (APP.currentTab !== 'volunteers') switchTab('volunteers');
  else renderVolunteers();
  tool.resize();
}

function closeVolunteerDetail() {
  APP.volunteerDetailOpen = false;
  renderVolunteers();
  tool.resize();
}

function openSelectedVolunteerDetail() {
  if (!APP.isManager || !APP.volunteerDetailProfileId) return;
  openVolunteerDetail(APP.volunteerDetailProfileId);
}

/* Sidebar sub item under Volunteers: shows which person is selected. */
function renderVolunteerSubNav() {
  var subNavButton = el('volunteerSubNavBtn');
  var subNavName = el('volunteerSubNavName');
  if (!subNavButton || !subNavName) return;

  var profile = APP.volunteerDetailProfileId ? getRegistryProfileById(APP.volunteerDetailProfileId) : null;
  if (!APP.isManager || !profile) {
    subNavButton.style.display = 'none';
    subNavButton.classList.remove('active');
    return;
  }

  var personName = profileName(profile);
  subNavName.textContent = personName;
  subNavButton.style.display = '';
  subNavButton.title = 'Open the dashboard and report of "' + personName + '"';
  subNavButton.classList.toggle('active', APP.volunteerDetailOpen && APP.currentTab === 'volunteers');
}

function setVolunteerDetailSection(section) {
  APP.volunteerDetailSection = section;
  renderVolunteerDetail();
  tool.resize();
}

function renderVolunteerDetail() {
  var profile = getRegistryProfileById(APP.volunteerDetailProfileId);
  var headElement = el('volunteerDetailHead');
  var navElement = el('volunteerDetailNav');
  var bodyElement = el('volunteerDetailBody');
  if (!profile || !headElement || !navElement || !bodyElement) return;
  renderVolunteerSubNav();

  var profileData = vd(profile);
  var networkStatus = profileData.status || 'candidate';
  var profileApplications = personApplications(profile.id, profileData.userId);
  var approvedApplications = profileApplications.filter(function(application) { return vd(application).status === 'approved'; });
  var taskCounts = taskStatusCounts(personTasks(profile.id, profileData.userId));
  var hourTotals = hourTotalsFor(personHours(profile.id, profileData.userId));

  headElement.innerHTML = ''
    + '<div class="event-manage-back">'
    + '<button class="btn btn-sm btn-ghost" onclick="closeVolunteerDetail()">← All volunteers</button>'
    + '<span class="badge badge-' + esc(volunteerNetworkBadgeClass(networkStatus)) + '">' + esc(volunteerNetworkLabel(networkStatus)) + '</span>'
    + '</div>'
    + '<div class="event-manage-title-row">'
    + '<div class="event-manage-heading">'
    + '<h2 class="event-manage-name">' + esc(profileName(profile)) + '</h2>'
    + '<div class="event-manage-meta">' + esc(profileData.email || 'No email')
    + (profileData.phone ? ' · ' + esc(profileData.phone) : '')
    + (profileData.city ? ' · ' + esc(profileData.city) : '')
    + ' · ' + approvedApplications.length + ' of ' + profileApplications.length + ' events · '
    + taskCounts.done + ' of ' + taskCounts.total + ' tasks done · ' + hourTotals.approved.toFixed(1) + ' h approved'
    + '</div></div>'
    + '<div class="event-manage-actions">'
    + '<button class="btn btn-sm btn-outline" onclick="openEditVolunteerModal(\'' + escJs(profile.id) + '\')">✏️ Edit Volunteer</button>'
    + '</div></div>';

  var sections = [
    { key: 'dashboard', label: '📊 Dashboard' },
    { key: 'report', label: '📈 Report' }
  ];
  navElement.innerHTML = sections.map(function(section) {
    var activeClass = APP.volunteerDetailSection === section.key ? ' active' : '';
    return '<button class="seg-btn' + activeClass + '" onclick="setVolunteerDetailSection(\'' + section.key + '\')">' + esc(section.label) + '</button>';
  }).join('');

  bodyElement.innerHTML = APP.volunteerDetailSection === 'report'
    ? buildVolunteerReportHtml(profile)
    : buildVolunteerDashboardHtml(profile);
}

function renderVolunteers() {
  var browseView = el('volBrowseView');
  var detailView = el('volunteerDetailView');
  var selectedProfile = APP.volunteerDetailProfileId ? getRegistryProfileById(APP.volunteerDetailProfileId) : null;
  if (!selectedProfile) {
    APP.volunteerDetailProfileId = '';
    APP.volunteerDetailOpen = false;
  }
  var detailIsOpen = APP.volunteerDetailOpen && APP.isManager && !!selectedProfile;

  if (browseView) browseView.style.display = detailIsOpen ? 'none' : '';
  if (detailView) detailView.style.display = detailIsOpen ? '' : 'none';
  renderVolunteerSubNav();
  if (detailIsOpen) {
    renderVolunteerDetail();
    updateBadges();
    tool.resize();
    return;
  }

  var actHTML = '';
  if (!APP.isManager && !APP.myApplication) {
    actHTML += '<button class="btn btn-primary" onclick="openRegisterModal()">🙋 Register as Volunteer</button>';
  }
  if (APP.isManager) {
    actHTML += '<button class="btn btn-primary" onclick="openAddVolunteerModal()">➕ Add Volunteer</button> ';
    actHTML += '<button class="btn btn-outline" onclick="exportVolunteersCSV()">📥 Export CSV</button>';
  }
  el('volActions').innerHTML = actHTML;

  var toolbar = el('volToolbar');
  var listCount = el('volListCount');

  if (APP.registryError) {
    el('volListTitle').textContent = 'Volunteer Registry';
    if (toolbar) toolbar.style.display = 'none';
    if (listCount) listCount.textContent = '';
    el('volList').innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><h4>Registry unavailable</h4><p>' + esc(APP.registryError) + '</p></div>';
    updateBadges();
    tool.resize();
    return;
  }

  // Volunteers only ever see their own record.
  if (!APP.isManager) {
    el('volListTitle').textContent = 'My Volunteer Status';
    if (toolbar) toolbar.style.display = 'none';
    if (listCount) listCount.textContent = '';
    renderMyVolunteerCard();
    updateBadges();
    tool.resize();
    return;
  }

  el('volListTitle').textContent = 'Volunteers & Candidates';
  if (toolbar) toolbar.style.display = '';

  var networkFilter = el('volFilterNetwork') ? (el('volFilterNetwork').value || 'all') : 'all';
  var statusFilter = el('volFilterStatus') ? (el('volFilterStatus').value || 'all') : 'all';
  var searchTerm = el('volSearch') ? (el('volSearch').value || '').trim().toLowerCase() : '';

  var allRows = buildVolunteerRows();
  var networkCandidateCount = allRows.filter(function(volunteerRow) {
    return volunteerNetworkStatus(volunteerRow) === 'candidate';
  }).length;
  var pendingEventCount = allRows.filter(function(volunteerRow) {
    return volunteerRowStatus(volunteerRow) === 'pending';
  }).length;

  var filteredRows = allRows.filter(function(volunteerRow) {
    if (networkFilter !== 'all' && volunteerNetworkStatus(volunteerRow) !== networkFilter) return false;
    if (statusFilter !== 'all' && volunteerRowStatus(volunteerRow) !== statusFilter) return false;
    if (!searchTerm) return true;
    var searchTarget = [
      volunteerRowName(volunteerRow),
      volunteerRow.profileData.email || '',
      volunteerRow.profileData.skills || '',
      volunteerRow.profileData.phone || ''
    ].join(' ').toLowerCase();
    return searchTarget.indexOf(searchTerm) !== -1;
  });

  // People waiting for a decision first: network candidates, then pending event requests.
  filteredRows.sort(function(rowA, rowB) {
    function decisionRank(volunteerRow) {
      if (volunteerNetworkStatus(volunteerRow) === 'candidate') return 0;
      if (volunteerRowStatus(volunteerRow) === 'pending') return 1;
      return 2;
    }
    var rankDifference = decisionRank(rowA) - decisionRank(rowB);
    if (rankDifference !== 0) return rankDifference;
    return volunteerRowName(rowA).localeCompare(volunteerRowName(rowB));
  });

  if (listCount) {
    var countParts = [];
    if (networkCandidateCount) countParts.push(networkCandidateCount + ' network candidate' + (networkCandidateCount === 1 ? '' : 's'));
    if (pendingEventCount) countParts.push(pendingEventCount + ' event request' + (pendingEventCount === 1 ? '' : 's'));
    listCount.textContent = filteredRows.length + ' of ' + allRows.length + ' people' + (countParts.length ? ' · ' + countParts.join(' · ') : '');
  }

  var html = '';
  if (filteredRows.length === 0) {
    var emptyMessage = allRows.length === 0
      ? 'The registry is empty. Add a volunteer or use the CSV import tool.'
      : 'No people match this search or filter.';
    html = '<div class="empty-state"><div class="empty-state-icon">👥</div><h4>No Volunteers Found</h4><p>' + emptyMessage + '</p></div>';
  } else {
    html = '<div class="table-wrap"><table class="table-compact"><thead><tr>'
      + '<th>Name</th><th>Network</th><th>This event</th><th class="col-skills">Skills</th>'
      + '<th class="cell-hours">Hours</th><th class="cell-actions-head">Actions</th>'
      + '</tr></thead><tbody>';

    filteredRows.forEach(function(volunteerRow) {
      var eventStatus = volunteerRowStatus(volunteerRow);
      var networkStatus = volunteerNetworkStatus(volunteerRow);
      var displayName = volunteerRowName(volunteerRow);
      var email = volunteerRow.profileData.email || '';
      var skills = volunteerRow.profileData.skills || '';

      var networkBadgeHTML = '<span class="badge badge-' + volunteerNetworkBadgeClass(networkStatus) + '">' + esc(volunteerNetworkLabel(networkStatus)) + '</span>';
      if (networkStatus === 'candidate' && volunteerRow.profile) {
        networkBadgeHTML += '<button class="btn btn-xs btn-success" title="Approve into the volunteer network" onclick="approveNetworkCandidate(\'' + escJs(volunteerRow.profile.id) + '\')">Approve</button>';
      }

      var editButtonHTML = '<button class="btn btn-xs btn-outline" title="Edit volunteer details" onclick="openEditVolunteerModal(\''
        + escJs(volunteerRow.profile ? volunteerRow.profile.id : '') + '\', \''
        + escJs(volunteerRow.application ? volunteerRow.application.id : '') + '\')">Edit</button>';

      var actionsHTML = '';
      if (volunteerRow.application) {
        if (eventStatus === 'pending') {
          actionsHTML = '<button class="btn btn-xs btn-success" title="Approve for this event" onclick="approveVolunteer(\'' + escJs(volunteerRow.application.id) + '\')">Approve</button>'
            + '<button class="btn btn-xs btn-danger" title="Reject for this event" onclick="rejectVolunteer(\'' + escJs(volunteerRow.application.id) + '\')">Reject</button>';
        } else if (eventStatus === 'approved') {
          actionsHTML = '<button class="btn btn-xs btn-outline" onclick="messageVolunteer(\'' + escJs(volunteerRow.profileData.userId) + '\', \'' + escJs(displayName) + '\')">Message</button>'
            + '<button class="btn btn-xs btn-outline" onclick="viewVolunteerTasks(\'' + escJs(volunteerRow.profileData.userId) + '\')">Tasks</button>';
        } else {
          actionsHTML = '<button class="btn btn-xs btn-success" title="Approve for this event" onclick="approveVolunteer(\'' + escJs(volunteerRow.application.id) + '\')">Approve</button>';
        }
      } else if (volunteerRow.profile) {
        actionsHTML = '<button class="btn btn-xs btn-primary" title="Link this volunteer to the event" onclick="addVolunteerToEvent(\'' + escJs(volunteerRow.profile.id) + '\')">Add to event</button>';
      }
      actionsHTML += editButtonHTML;

      var appliedDateText = volunteerRow.application ? fmtDate(vd(volunteerRow.application).appliedAt) : '';
      var nameHTML = volunteerRow.profile
        ? '<button type="button" class="name-link" title="Open the dashboard and report of this volunteer" onclick="openVolunteerDetail(\'' + escJs(volunteerRow.profile.id) + '\')">' + esc(displayName) + '</button>'
        : esc(displayName);

      html += '<tr>'
        + '<td><div class="cell-person"><span class="person-avatar">' + esc((displayName || '?').charAt(0).toUpperCase()) + '</span>'
        + '<div class="person-main"><div class="person-name">' + nameHTML + '</div>'
        + (email ? '<div class="person-sub">' + esc(email) + '</div>' : '')
        + '</div></div></td>'
        + '<td class="cell-network"><div class="network-cell">' + networkBadgeHTML + '</div></td>'
        + '<td class="cell-status"><span class="badge badge-' + eventStatus + '">' + esc(volunteerStatusLabel(eventStatus)) + '</span>'
        + (appliedDateText ? '<div class="cell-sub">Applied ' + esc(appliedDateText) + '</div>' : '')
        + '</td>'
        + '<td class="cell-clip col-skills" title="' + esc(skills) + '">' + esc(skills || '—') + '</td>'
        + '<td class="cell-hours">' + volunteerApprovedHours(volunteerRow.profileData.userId).toFixed(1) + '</td>'
        + '<td><div class="actions-cell">' + actionsHTML + '</div></td>'
        + '</tr>';
    });

    html += '</tbody></table></div>';
  }
  el('volList').innerHTML = html;
  updateBadges();
  tool.resize();
}

function renderMyVolunteerCard() {
  var html = '';
  var totalHrs = 0;
  APP.hours.forEach(function(h) {
    var hd = vd(h);
    if (hd.volunteerUserId === (APP.user ? APP.user.id : '') && hd.status === 'approved') totalHrs += (Number(hd.hoursLogged) || 0);
  });
  if (!APP.myProfile && !APP.myApplication) {
    html = '<div class="empty-state"><div class="empty-state-icon">👥</div><h4>No Volunteers Found</h4><p>You haven\'t registered as a volunteer yet.</p></div>';
  } else {
    var d = APP.myProfile ? vd(APP.myProfile) : {};
    var app = APP.myApplication ? vd(APP.myApplication) : {};
    var displayName = APP.myProfile ? profileName(APP.myProfile) : (APP.user ? APP.user.name : 'Volunteer');
    html = '<div class="volunteer-card">' +
      '<div class="vol-card-header">' +
      '<div class="vol-card-avatar">' + (displayName || '?').charAt(0).toUpperCase() + '</div>' +
      '<div><div class="vol-card-name">' + esc(displayName) + '</div><div class="vol-card-email">' + esc(d.email || (APP.user ? APP.user.email : '')) + '</div></div>' +
      '</div>' +
      '<p><strong>Event Status:</strong> <span class="badge badge-' + (app.status || 'not-applied') + '">' + esc(app.status || 'not-applied') + '</span></p>' +
      (d.skills ? '<div class="vol-card-skills">' + d.skills.split(',').map(function(s) { return '<span class="skill-tag">' + esc(s.trim()) + '</span>'; }).join('') + '</div>' : '') +
      '<p style="margin-top:8px;"><strong>Availability:</strong> ' + esc(d.availabilityNotes || 'Not specified') + '</p>' +
      (app.notes ? '<p><strong>Motivation:</strong> ' + esc(app.notes) + '</p>' : '') +
      '<div class="vol-card-footer">' +
      '<span><strong>Total Hours:</strong> ' + totalHrs.toFixed(1) + ' hrs</span>' +
      '<span>Registered: ' + fmtDate(app.appliedAt || d.joinedAt) + '</span>' +
      '</div>';
    if (app.status === 'rejected') {
      html += '<button class="btn btn-sm btn-primary" style="margin-top:8px;" onclick="openRegisterModal()">🔄 Re-apply</button>';
    }
    html += '</div>';
  }
  el('volList').innerHTML = html;
}

/* ── UI: Tasks ── */
function renderTasks() {
  var actHTML = '';
  if (APP.isManager) {
    actHTML += '<button class="btn btn-primary" onclick="openTaskModal()">➕ Create Task</button> ';
  }
  if (APP.myApplication && vd(APP.myApplication).status === 'approved') {
    actHTML += '<button class="btn btn-accent" onclick="openHoursModal()">⏱️ Log Hours</button>';
  }
  el('taskActions').innerHTML = actHTML;

  var statusFilter = el('taskFilterStatus').value || 'all';
  var assigneeFilter = el('taskFilterAssignee').value || 'all';

  var filtered = APP.tasks.filter(function(t) {
    var d = vd(t);
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (assigneeFilter === 'me') {
      return d.assignedVolunteerUserId === (APP.user ? APP.user.id : '');
    }
    if (assigneeFilter === 'unassigned') {
      return !d.assignedVolunteerUserId;
    }
    if (assigneeFilter !== 'all') {
      return d.assignedVolunteerUserId === assigneeFilter;
    }
    return true;
  });

  // For non-managers, only show their tasks
  if (!APP.isManager) {
    filtered = filtered.filter(function(t) {
      return vd(t).assignedVolunteerUserId === (APP.user ? APP.user.id : '');
    });
    el('taskFilterAssignee').style.display = 'none';
  } else {
    el('taskFilterAssignee').style.display = '';
  }

  var html = '';
  if (filtered.length === 0) {
    html = '<div class="empty-state"><div class="empty-state-icon">📋</div><h4>No Tasks Found</h4><p>' + (APP.isManager ? 'Create tasks and assign them to volunteers.' : 'You don\'t have any assigned tasks yet.') + '</p></div>';
  } else {
    filtered.sort(function(a, b) {
      var order = { 'in-progress': 0, 'assigned': 1, 'open': 2, 'completed': 3, 'cancelled': 4 };
      var oa = order[vd(a).status] || 5;
      var ob = order[vd(b).status] || 5;
      return oa - ob;
    });
    filtered.forEach(function(t) {
      var d = vd(t);
      html += '<div class="task-card status-' + d.status + '">' +
        '<div class="task-card-header">' +
        '<span class="task-card-title">' + esc(t.name) + '</span>' +
        '<span class="badge badge-' + d.status + '">' + esc(d.status) + '</span>' +
        '</div>' +
        '<div class="task-card-meta">' +
        (d.description ? esc(d.description.slice(0, 150)) + (d.description.length > 150 ? '...' : '') + '<br>' : '') +
        '<strong>Assigned:</strong> ' + esc(taskAssigneeName(d)) + ' · ' +
        '<strong>Due:</strong> ' + fmtDate(d.dueDate) + ' · ' +
        '<strong>Est. Hours:</strong> ' + (d.estimatedHours || '—') +
        '</div>' +
        '<div class="task-card-footer">';
      if (APP.isManager) {
        html += '<button class="btn btn-sm btn-outline" onclick="editTask(\'' + t.id + '\')">✏️ Edit</button> ';
        if (d.status !== 'completed' && d.status !== 'cancelled') {
          html += '<button class="btn btn-sm btn-success" onclick="completeTask(\'' + t.id + '\')">✅ Complete</button> ';
        }
        html += '<button class="btn btn-sm btn-danger" onclick="deleteTask(\'' + t.id + '\')">🗑️ Delete</button>';
      } else {
        // Volunteer actions
        if (d.assignedVolunteerUserId === (APP.user ? APP.user.id : '')) {
          if (d.status === 'assigned') {
            html += '<button class="btn btn-sm btn-accent" onclick="updateTaskStatus(\'' + t.id + '\',\'in-progress\')">▶️ Start</button> ';
          }
          if (d.status === 'in-progress') {
            html += '<button class="btn btn-sm btn-success" onclick="updateTaskStatus(\'' + t.id + '\',\'completed\')">✅ Mark Complete</button> ';
          }
          if (d.status === 'assigned' || d.status === 'in-progress') {
            html += '<button class="btn btn-sm btn-accent" onclick="logHoursForTask(\'' + t.id + '\')">⏱️ Log Hours</button>';
          }
        }
      }
      html += '</div></div>';
    });
  }
  el('taskList').innerHTML = html;
  updateBadges();
  tool.resize();
}

/* ── UI: Hours ── */
function renderHours() {
  var actHTML = '';
  if (APP.myApplication && vd(APP.myApplication).status === 'approved') {
    actHTML += '<button class="btn btn-primary" onclick="openHoursModal()">⏱️ Log Hours</button> ';
  }
  if (APP.isManager) {
    actHTML += '<button class="btn btn-outline" onclick="approveAllPendingHours()">✅ Approve All Pending</button>';
  }
  el('hourActions').innerHTML = actHTML;

  var volFilter = el('hourFilterVolunteer').value || 'all';
  var statusFilter = el('hourFilterStatus').value || 'all';

  if (!APP.isManager) {
    volFilter = 'me';
    el('hourFilterVolunteer').style.display = 'none';
  } else {
    el('hourFilterVolunteer').style.display = '';
    // Populate volunteer filter
    var volSelect = el('hourFilterVolunteer');
    if (volSelect.options.length <= 2) {
      getApprovedVolunteers().forEach(function(a) {
        var d = vd(a);
        var opt = document.createElement('option');
        opt.value = d.volunteerUserId;
        opt.textContent = approvedUserName(a);
        volSelect.appendChild(opt);
      });
    }
  }

  var filtered = APP.hours.filter(function(h) {
    var d = vd(h);
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (volFilter === 'me') return d.volunteerUserId === (APP.user ? APP.user.id : '');
    if (volFilter !== 'all') return d.volunteerUserId === volFilter;
    return true;
  });

  var html = '';
  if (filtered.length === 0) {
    html = '<div class="empty-state"><div class="empty-state-icon">⏱️</div><h4>No Hour Logs Found</h4><p>Log hours as you complete volunteer tasks.</p></div>';
  } else {
    filtered.sort(function(a, b) { return (vd(b).date || '').localeCompare(vd(a).date || ''); });
    html = '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Volunteer</th><th>Task</th><th>Hours</th><th>Description</th><th>Status</th><th></th></tr></thead><tbody>';
    filtered.forEach(function(h) {
      var d = vd(h);
      html += '<tr>' +
        '<td>' + fmtDate(d.date) + '</td>' +
        '<td>' + esc(volunteerNameFromIds(d.registryProfileId, d.volunteerUserId)) + '</td>' +
        '<td>' + esc(d.taskName || '—') + '</td>' +
        '<td><strong>' + (Number(d.hoursLogged) || 0).toFixed(1) + '</strong></td>' +
        '<td>' + esc((d.description || '').slice(0, 60)) + '</td>' +
        '<td><span class="badge badge-' + d.status + '">' + esc(d.status) + '</span></td>' +
        '<td><div class="actions-cell">';
      if (APP.isManager && d.status === 'pending') {
        html += '<button class="btn btn-sm btn-success" onclick="approveHours(\'' + h.id + '\')">✅</button> ';
        html += '<button class="btn btn-sm btn-danger" onclick="rejectHours(\'' + h.id + '\')">❌</button>';
      }
      html += '</div></td></tr>';
    });
    html += '</tbody></table></div>';
  }
  el('hourList').innerHTML = html;

  // Summary
  var summaryDiv = el('hourSummary');
  if (filtered.length > 0) {
    summaryDiv.style.display = '';
    var summaryHTML = '<div class="stats-row">';
    var totalHrs = 0, approvedHrs = 0, pendingHrs = 0;
    filtered.forEach(function(h) {
      var d = vd(h);
      var hrs = Number(d.hoursLogged) || 0;
      totalHrs += hrs;
      if (d.status === 'approved') approvedHrs += hrs;
      if (d.status === 'pending') pendingHrs += hrs;
    });
    summaryHTML += '<div class="stat-card"><div class="stat-value">' + totalHrs.toFixed(1) + '</div><div class="stat-label">Total Logged Hours</div></div>';
    summaryHTML += '<div class="stat-card"><div class="stat-value" style="color:var(--success);">' + approvedHrs.toFixed(1) + '</div><div class="stat-label">Approved Hours</div></div>';
    summaryHTML += '<div class="stat-card"><div class="stat-value" style="color:var(--accent);">' + pendingHrs.toFixed(1) + '</div><div class="stat-label">Pending Hours</div></div>';
    summaryHTML += '</div>';
    el('hourSummaryBody').innerHTML = summaryHTML;
  } else {
    summaryDiv.style.display = 'none';
  }

  updateBadges();
  tool.resize();
}

/* ── UI: Reports ── */
function eventLabelFor(eventId) {
  if (!eventId) return 'No event';
  var eventRecord = getEventRecordById(eventId);
  if (!eventRecord) return 'Unknown event';
  return vd(eventRecord).name || eventRecord.name || 'Untitled event';
}

/* Every application / task / hour record that belongs to one person, across all events. */
function personApplications(registryProfileId, volunteerUserId) {
  return APP.applications.filter(function(application) {
    var applicationData = vd(application);
    if (registryProfileId && applicationData.registryProfileId === registryProfileId) return true;
    if (!applicationData.registryProfileId && volunteerUserId && applicationData.volunteerUserId === volunteerUserId) return true;
    return false;
  });
}

function personTasks(registryProfileId, volunteerUserId) {
  return APP.tasks.filter(function(task) {
    var taskData = vd(task);
    if (!taskData.assignedRegistryProfileId && !taskData.assignedVolunteerUserId) return false;
    return recordBelongsToPerson(taskData, registryProfileId, volunteerUserId);
  });
}

function personHours(registryProfileId, volunteerUserId) {
  return APP.hours.filter(function(hour) {
    return recordBelongsToPerson(vd(hour), registryProfileId, volunteerUserId);
  });
}

function hourTotalsFor(hourRecords) {
  var totals = { logged: 0, approved: 0, pending: 0, rejected: 0 };
  hourRecords.forEach(function(hour) {
    var hourData = vd(hour);
    var amount = Number(hourData.hoursLogged) || 0;
    totals.logged += amount;
    if (hourData.status === 'approved') totals.approved += amount;
    else if (hourData.status === 'pending') totals.pending += amount;
    else if (hourData.status === 'rejected') totals.rejected += amount;
  });
  return totals;
}

function taskStatusCounts(taskRecords) {
  var counts = { total: taskRecords.length, done: 0, open: 0 };
  taskRecords.forEach(function(task) {
    var status = vd(task).status;
    if (status === 'completed') counts.done++;
    else if (status !== 'cancelled') counts.open++;
  });
  return counts;
}

function renderReports() {
  var actionsElement = el('reportActions');
  var bodyElement = el('reportBody');
  if (!bodyElement) return;

  if (!APP.isManager) {
    APP.reportMode = 'volunteer';
  } else if (APP.reportMode !== 'overview' && APP.reportMode !== 'event' && APP.reportMode !== 'volunteer') {
    APP.reportMode = 'overview';
  }

  var modes = APP.isManager
    ? [
        { key: 'overview', label: '📊 Overview' },
        { key: 'event', label: '📅 Event report' },
        { key: 'volunteer', label: '👤 Volunteer history' }
      ]
    : [{ key: 'volunteer', label: '👤 My history' }];

  if (actionsElement) {
    actionsElement.innerHTML = modes.length > 1
      ? '<div class="seg-nav" style="margin-bottom:0;">' + modes.map(function(mode) {
          var activeClass = APP.reportMode === mode.key ? ' active' : '';
          return '<button class="seg-btn' + activeClass + '" onclick="setReportMode(\'' + mode.key + '\')">' + esc(mode.label) + '</button>';
        }).join('') + '</div>'
      : '';
  }

  if (APP.reportMode === 'event' && APP.isManager) renderEventReport(bodyElement);
  else if (APP.reportMode === 'volunteer') renderVolunteerReport(bodyElement);
  else renderReportOverview(bodyElement);

  tool.resize();
}

function setReportMode(mode) {
  APP.reportMode = mode;
  renderReports();
}

function setReportEvent(eventId) {
  APP.reportEventId = eventId;
  renderReports();
}

function setReportVolunteer(profileId) {
  APP.reportProfileId = profileId;
  renderReports();
}

/* ── Reports: overview of everything ── */
function renderReportOverview(container) {
  var approvedNetworkVolunteers = APP.registry.filter(function(profile) { return vd(profile).status === 'active'; });
  var candidates = APP.registry.filter(function(profile) { return vd(profile).status === 'candidate'; });
  var eventLinks = APP.applications.filter(function(application) { return vd(application).status === 'approved'; });
  var pendingLinks = APP.applications.filter(function(application) { return vd(application).status === 'pending'; });
  var taskCounts = taskStatusCounts(APP.tasks);
  var hourTotals = hourTotalsFor(APP.hours);

  var html = '<div class="stats-row report-stats">'
    + reportStatCard('📅', APP.events.length, 'Events defined')
    + reportStatCard('👥', approvedNetworkVolunteers.length, 'Network volunteers')
    + reportStatCard('📝', candidates.length, 'Network candidates')
    + reportStatCard('✅', eventLinks.length, 'Event placements')
    + reportStatCard('⏳', pendingLinks.length, 'Pending event requests')
    + reportStatCard('📋', taskCounts.done + ' / ' + taskCounts.total, 'Tasks completed')
    + reportStatCard('⏱️', hourTotals.approved.toFixed(1), 'Approved hours')
    + reportStatCard('🕒', hourTotals.pending.toFixed(1), 'Pending hours')
    + '</div>';

  // Per event table
  html += '<div class="card"><div class="card-header"><h3>Every Event at a Glance</h3></div><div class="card-body table-flush">';
  if (APP.events.length === 0) {
    html += '<div class="empty-state"><div class="empty-state-icon">📅</div><h4>No events yet</h4><p>Add an event definition first.</p></div>';
  } else {
    html += '<div class="table-wrap"><table class="table-compact"><thead><tr>'
      + '<th>Event</th><th>Status</th><th>When</th>'
      + '<th class="cell-hours">Volunteers</th><th class="cell-hours">Tasks</th><th class="cell-hours">Hours</th>'
      + '<th class="cell-actions-head">Report</th>'
      + '</tr></thead><tbody>';

    APP.events.slice().sort(sortEventsByStartDate).forEach(function(eventRecord) {
      var eventData = vd(eventRecord);
      var eventApplications = eventApplicationsFor(eventRecord.id);
      var approvedApplications = eventApplications.filter(function(application) { return vd(application).status === 'approved'; });
      var eventTasks = taskStatusCounts(eventTasksFor(eventRecord.id));
      var eventHours = hourTotalsFor(eventHoursFor(eventRecord.id));

      html += '<tr>'
        + '<td><div class="person-main"><div class="person-name">' + esc(eventData.name || eventRecord.name || 'Untitled event') + '</div></div></td>'
        + '<td><span class="badge badge-' + esc(eventData.status || 'draft') + '">' + esc(eventStatusLabel(eventData.status)) + '</span></td>'
        + '<td>' + esc(eventWhenText(eventData)) + '</td>'
        + '<td class="cell-hours">' + approvedApplications.length + ' <span class="person-sub">/ ' + eventApplications.length + ' linked</span></td>'
        + '<td class="cell-hours">' + eventTasks.done + ' <span class="person-sub">/ ' + eventTasks.total + '</span></td>'
        + '<td class="cell-hours">' + eventHours.approved.toFixed(1) + ' <span class="person-sub">h</span></td>'
        + '<td><div class="actions-cell"><button class="btn btn-xs btn-outline" onclick="setReportMode(\'event\'); setReportEvent(\'' + escJs(eventRecord.id) + '\')">Open report</button></div></td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '</div></div>';

  // Volunteers at a glance
  html += '<div class="card"><div class="card-header"><h3>Volunteers at a Glance</h3><span class="list-count">' + APP.registry.length + ' people in the network</span></div><div class="card-body table-flush">';
  if (APP.registry.length === 0) {
    html += '<div class="empty-state"><div class="empty-state-icon">👥</div><h4>No volunteers yet</h4><p>Add volunteers to the network first.</p></div>';
  } else {
    html += '<div class="table-wrap"><table class="table-compact"><thead><tr>'
      + '<th>Volunteer</th><th>Network</th>'
      + '<th class="cell-hours">Events</th><th class="cell-hours col-est-hours">Tasks</th><th class="cell-hours">Hours</th>'
      + '<th class="cell-actions-head">History</th>'
      + '</tr></thead><tbody>';

    APP.registry.slice().sort(function(firstProfile, secondProfile) {
      return profileName(firstProfile).localeCompare(profileName(secondProfile));
    }).forEach(function(profile) {
      var profileData = vd(profile);
      var networkStatus = profileData.status || 'candidate';
      var applications = personApplications(profile.id, profileData.userId);
      var approvedApplications = applications.filter(function(application) { return vd(application).status === 'approved'; });
      var personTaskCounts = taskStatusCounts(personTasks(profile.id, profileData.userId));
      var personHourTotals = hourTotalsFor(personHours(profile.id, profileData.userId));

      html += '<tr>'
        + '<td><div class="person-main"><div class="person-name">' + esc(profileName(profile)) + '</div>'
        + '<div class="person-sub">' + esc(profileData.email || '—') + '</div></div></td>'
        + '<td><span class="badge badge-' + esc(volunteerNetworkBadgeClass(networkStatus)) + '">' + esc(volunteerNetworkLabel(networkStatus)) + '</span></td>'
        + '<td class="cell-hours">' + approvedApplications.length + ' <span class="person-sub">/ ' + applications.length + '</span></td>'
        + '<td class="cell-hours col-est-hours">' + personTaskCounts.done + ' <span class="person-sub">/ ' + personTaskCounts.total + '</span></td>'
        + '<td class="cell-hours">' + personHourTotals.approved.toFixed(1) + ' <span class="person-sub">/ ' + personHourTotals.logged.toFixed(1) + ' h</span></td>'
        + '<td><div class="actions-cell"><button class="btn btn-xs btn-outline" onclick="setReportMode(\'volunteer\'); setReportVolunteer(\'' + escJs(profile.id) + '\')">Open history</button></div></td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '</div></div>';

  // Activity
  html += renderActivityCard(buildActivityFeed('', 15), 'Recent Activity');
  container.innerHTML = html;
}

function sortEventsByStartDate(firstRecord, secondRecord) {
  var firstDate = vd(firstRecord).startDate || '9999-12-31';
  var secondDate = vd(secondRecord).startDate || '9999-12-31';
  if (firstDate !== secondDate) return firstDate < secondDate ? -1 : 1;
  return String(vd(firstRecord).name || '').localeCompare(String(vd(secondRecord).name || ''));
}

function reportStatCard(icon, value, label) {
  return '<div class="stat-card"><div class="stat-icon" style="background:#e0ecf8;">' + icon + '</div>'
    + '<div class="stat-value">' + esc(String(value)) + '</div><div class="stat-label">' + esc(label) + '</div></div>';
}

/* Timeline of applications, decisions, tasks and hours (optionally for one event or one person). */
function buildActivityFeed(eventId, limit, registryProfileId, volunteerUserId) {
  var activities = [];

  function matchesEvent(recordData) {
    if (!eventId) return true;
    return recordData.eventId === eventId;
  }

  function matchesPerson(recordData, profileId, userId) {
    if (!profileId && !userId) return true;
    return recordBelongsToPerson(recordData, profileId, userId);
  }

  APP.applications.forEach(function(application) {
    var applicationData = vd(application);
    if (!matchesEvent(applicationData)) return;
    var profile = getApplicationProfile(application);
    var applicantProfileId = profile ? profile.id : applicationData.registryProfileId;
    if (registryProfileId || volunteerUserId) {
      if (applicantProfileId !== registryProfileId && applicationData.volunteerUserId !== volunteerUserId) return;
    }
    var personName = profile ? profileName(profile) : (application.name || 'Volunteer');
    if (applicationData.appliedAt) {
      activities.push({
        when: applicationData.appliedAt,
        icon: '📝',
        text: personName + ' applied for ' + eventLabelFor(applicationData.eventId),
        tag: 'Application'
      });
    }
    if (applicationData.reviewedAt) {
      var decisionText = applicationData.status === 'approved' ? 'approved' : (applicationData.status === 'rejected' ? 'declined' : applicationData.status);
      activities.push({
        when: applicationData.reviewedAt,
        icon: applicationData.status === 'approved' ? '✅' : '⛔',
        text: personName + ' was ' + decisionText + ' for ' + eventLabelFor(applicationData.eventId),
        tag: 'Decision'
      });
    }
  });

  APP.tasks.forEach(function(task) {
    var taskData = vd(task);
    if (!matchesEvent(taskData)) return;
    if (!matchesPerson(taskData, registryProfileId, volunteerUserId)) return;
    if (taskData.createdAt) {
      activities.push({
        when: taskData.createdAt,
        icon: '📋',
        text: 'Task "' + task.name + '" created for ' + eventLabelFor(taskData.eventId),
        tag: 'Task'
      });
    }
    if (taskData.completedAt) {
      activities.push({
        when: taskData.completedAt,
        icon: '🏁',
        text: 'Task "' + task.name + '" completed · ' + eventLabelFor(taskData.eventId),
        tag: 'Task'
      });
    }
  });

  APP.hours.forEach(function(hour) {
    var hourData = vd(hour);
    if (!matchesEvent(hourData)) return;
    if (!matchesPerson(hourData, registryProfileId, volunteerUserId)) return;
    var personName = volunteerNameFromIds(hourData.registryProfileId, hourData.volunteerUserId);
    activities.push({
      when: hourData.date || hourData.reviewedAt || '',
      icon: '⏱️',
      text: personName + ' logged ' + (Number(hourData.hoursLogged) || 0).toFixed(1) + ' h · ' + eventLabelFor(hourData.eventId),
      tag: 'Hours'
    });
    if (hourData.reviewedAt && hourData.status === 'approved') {
      activities.push({
        when: hourData.reviewedAt,
        icon: '✅',
        text: (Number(hourData.hoursLogged) || 0).toFixed(1) + ' h approved for ' + personName,
        tag: 'Hours'
      });
    }
  });

  if (!eventId && !registryProfileId && !volunteerUserId) {
    APP.messages.forEach(function(message) {
      var messageData = vd(message);
      if (!messageData.sentAt) return;
      activities.push({
        when: messageData.sentAt,
        icon: '💬',
        text: (messageData.fromName || 'Someone') + ': ' + (messageData.subject || '(no subject)'),
        tag: 'Message'
      });
    });
  }

  activities.sort(function(firstActivity, secondActivity) {
    return String(secondActivity.when || '').localeCompare(String(firstActivity.when || ''));
  });
  return activities.slice(0, limit || 20);
}

function renderActivityCard(activities, title) {
  var html = '<div class="card"><div class="card-header"><h3>' + esc(title) + '</h3>'
    + '<span class="list-count">' + activities.length + ' entries</span></div><div class="card-body">';
  if (activities.length === 0) {
    html += '<div class="empty-state" style="padding:18px;"><div class="empty-state-icon">🗂️</div><h4>No activity yet</h4>'
      + '<p>Applications, tasks and hours will appear here as they happen.</p></div>';
  } else {
    html += '<ul class="activity-list">';
    activities.forEach(function(activity) {
      html += '<li class="activity-item">'
        + '<span class="activity-icon">' + activity.icon + '</span>'
        + '<span class="activity-text">' + esc(activity.text) + '</span>'
        + '<span class="activity-tag">' + esc(activity.tag) + '</span>'
        + '<span class="activity-when">' + esc(fmtDate(activity.when) || '—') + '</span>'
        + '</li>';
    });
    html += '</ul>';
  }
  html += '</div></div>';
  return html;
}

/* ── Reports: one event ── */
function renderEventReport(container) {
  var eventRecords = APP.events.slice().sort(sortEventsByStartDate);
  if (eventRecords.length === 0) {
    container.innerHTML = '<div class="card"><div class="card-body"><div class="empty-state"><div class="empty-state-icon">📅</div>'
      + '<h4>No events yet</h4><p>Add an event definition to see its report.</p></div></div></div>';
    return;
  }

  var selectedId = APP.reportEventId || APP.currentEventId || eventRecords[0].id;
  var selectedRecord = getEventRecordById(selectedId) || eventRecords[0];
  APP.reportEventId = selectedRecord.id;
  var eventData = vd(selectedRecord);

  var pickerHtml = '<div class="card report-picker"><div class="card-body">'
    + '<label class="form-label" for="reportEventSelect">Event</label>'
    + '<select class="form-select" id="reportEventSelect" onchange="setReportEvent(this.value)">'
    + eventRecords.map(function(record) {
        return '<option value="' + esc(record.id) + '"' + (record.id === selectedRecord.id ? ' selected' : '') + '>' + esc(vd(record).name || record.name || 'Untitled event') + '</option>';
      }).join('')
    + '</select>'
    + '<div class="form-hint">' + esc(eventWhenText(eventData)) + ' · ' + esc(eventData.locationName || 'No venue') + ' · ' + esc(eventStatusLabel(eventData.status)) + '</div>'
    + '</div></div>';

  container.innerHTML = pickerHtml + buildEventReportHtml(selectedRecord.id);
}

/* Event report tables, also used by the event management view (no picker). */
function buildEventReportHtml(eventId) {
  var selectedRecord = getEventRecordById(eventId);
  if (!selectedRecord) return '';

  var eventApplications = eventApplicationsFor(selectedRecord.id);
  var approvedApplications = eventApplications.filter(function(application) { return vd(application).status === 'approved'; });
  var eventTasks = eventTasksFor(selectedRecord.id);
  var eventHours = eventHoursFor(selectedRecord.id);
  var hourTotals = hourTotalsFor(eventHours);
  var taskCounts = taskStatusCounts(eventTasks);

  var html = '<div class="stats-row report-stats">'
    + reportStatCard('👥', approvedApplications.length + ' / ' + eventApplications.length, 'Volunteers approved / linked')
    + reportStatCard('📋', taskCounts.done + ' / ' + taskCounts.total, 'Tasks completed')
    + reportStatCard('⏱️', hourTotals.approved.toFixed(1), 'Approved hours')
    + reportStatCard('🕒', hourTotals.pending.toFixed(1), 'Pending hours')
    + '</div>';

  // Volunteer stats
  html += '<div class="card"><div class="card-header"><h3>Volunteer Statistics</h3></div><div class="card-body table-flush">';
  if (eventApplications.length === 0) {
    html += '<div class="empty-state" style="padding:18px;"><div class="empty-state-icon">👥</div><h4>No volunteers linked</h4><p>Add volunteers from the event management view.</p></div>';
  } else {
    html += '<div class="table-wrap"><table class="table-compact"><thead><tr>'
      + '<th>Volunteer</th><th>Network</th><th>Event status</th>'
      + '<th class="cell-hours col-est-hours">Tasks</th><th class="cell-hours">Hours</th><th class="cell-hours col-task-count">Approved h</th>'
      + '</tr></thead><tbody>';
    eventApplications.forEach(function(application) {
      var applicationData = vd(application);
      var profile = getApplicationProfile(application);
      var profileData = profile ? vd(profile) : {};
      var profileId = profile ? profile.id : applicationData.registryProfileId;
      var personTaskCounts = taskStatusCounts(personTasks(profileId, applicationData.volunteerUserId).filter(function(task) {
        return vd(task).eventId === selectedRecord.id;
      }));
      var personHourTotals = hourTotalsFor(personHours(profileId, applicationData.volunteerUserId).filter(function(hour) {
        return vd(hour).eventId === selectedRecord.id;
      }));
      var networkStatus = profileData.status || 'candidate';

      html += '<tr>'
        + '<td><div class="person-main"><div class="person-name">' + esc(profile ? profileName(profile) : (application.name || 'Unknown')) + '</div>'
        + '<div class="person-sub">' + esc(profileData.email || '—') + '</div></div></td>'
        + '<td><span class="badge badge-' + esc(volunteerNetworkBadgeClass(networkStatus)) + '">' + esc(volunteerNetworkLabel(networkStatus)) + '</span></td>'
        + '<td><span class="badge badge-' + esc(applicationData.status || 'pending') + '">' + esc(volunteerStatusLabel(applicationData.status)) + '</span></td>'
        + '<td class="cell-hours col-est-hours">' + personTaskCounts.done + ' / ' + personTaskCounts.total + '</td>'
        + '<td class="cell-hours">' + personHourTotals.logged.toFixed(1) + ' <span class="person-sub">h logged</span></td>'
        + '<td class="cell-hours col-task-count">' + personHourTotals.approved.toFixed(1) + ' <span class="person-sub">h</span></td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '</div></div>';

  // Tasks
  html += '<div class="card"><div class="card-header"><h3>Task Report</h3><span class="list-count">' + eventTasks.length + ' tasks</span></div><div class="card-body table-flush">';
  if (eventTasks.length === 0) {
    html += '<div class="empty-state" style="padding:18px;"><div class="empty-state-icon">📋</div><h4>No tasks</h4><p>Tasks added to this event will be listed here.</p></div>';
  } else {
    html += '<div class="table-wrap"><table class="table-compact"><thead><tr>'
      + '<th>Task</th><th>Assignee</th><th class="col-due">Due</th><th>Status</th><th class="cell-hours">Est. h</th><th class="cell-hours">Logged h</th>'
      + '</tr></thead><tbody>';
    eventTasks.slice().sort(function(firstTask, secondTask) {
      return String(vd(firstTask).dueDate || '9999').localeCompare(String(vd(secondTask).dueDate || '9999'));
    }).forEach(function(task) {
      var taskData = vd(task);
      var taskHourTotals = hourTotalsFor(eventHours.filter(function(hour) { return vd(hour).taskId === task.id; }));
      html += '<tr>'
        + '<td><div class="person-main"><div class="person-name">' + esc(task.name) + '</div></div></td>'
        + '<td>' + esc(taskAssigneeName(taskData)) + '</td>'
        + '<td class="col-due">' + esc(taskData.dueDate ? fmtDate(taskData.dueDate) : '—') + '</td>'
        + '<td><span class="badge badge-' + esc(taskData.status || 'open') + '">' + esc(volunteerStatusLabel(taskData.status)) + '</span></td>'
        + '<td class="cell-hours">' + (taskData.estimatedHours || 0) + '</td>'
        + '<td class="cell-hours">' + taskHourTotals.logged.toFixed(1) + '</td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '</div></div>';

  // Hours
  html += '<div class="card"><div class="card-header"><h3>Hours Report</h3><span class="list-count">' + hourTotals.logged.toFixed(1) + ' h logged</span></div><div class="card-body table-flush">';
  if (eventHours.length === 0) {
    html += '<div class="empty-state" style="padding:18px;"><div class="empty-state-icon">⏱️</div><h4>No hours recorded</h4><p>Hours recorded for this event will be listed here.</p></div>';
  } else {
    html += '<div class="table-wrap"><table class="table-compact"><thead><tr>'
      + '<th>Date</th><th>Volunteer</th><th>Task</th><th class="cell-hours">Hours</th><th>Status</th>'
      + '</tr></thead><tbody>';
    eventHours.slice().sort(function(firstHour, secondHour) {
      return String(vd(secondHour).date || '').localeCompare(String(vd(firstHour).date || ''));
    }).forEach(function(hour) {
      var hourData = vd(hour);
      html += '<tr>'
        + '<td>' + esc(fmtDate(hourData.date)) + '</td>'
        + '<td>' + esc(volunteerNameFromIds(hourData.registryProfileId, hourData.volunteerUserId)) + '</td>'
        + '<td>' + esc(hourData.taskName || 'General') + '</td>'
        + '<td class="cell-hours">' + (Number(hourData.hoursLogged) || 0).toFixed(1) + '</td>'
        + '<td><span class="badge badge-' + esc(hourData.status || 'pending') + '">' + esc(volunteerStatusLabel(hourData.status)) + '</span></td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '</div></div>';

  html += renderActivityCard(buildActivityFeed(selectedRecord.id, 12), 'Event Activity');

  return html;
}

/* Event dashboard: the one-screen summary of the selected event. */
function buildEventDashboardHtml(eventId) {
  var eventRecord = getEventRecordById(eventId);
  if (!eventRecord) return '';
  var eventData = vd(eventRecord);

  var applications = eventApplicationsFor(eventId);
  var approvedApplications = applications.filter(function(application) { return vd(application).status === 'approved'; });
  var pendingApplications = applications.filter(function(application) { return vd(application).status === 'pending'; });
  var tasks = eventTasksFor(eventId);
  var taskCounts = taskStatusCounts(tasks);
  var hours = eventHoursFor(eventId);
  var hourTotals = hourTotalsFor(hours);

  var html = '<div class="stats-row report-stats">'
    + reportStatCard('👥', approvedApplications.length + ' / ' + applications.length, 'Volunteers approved / linked')
    + reportStatCard('⏳', pendingApplications.length, 'Pending requests')
    + reportStatCard('📋', taskCounts.open, 'Open tasks')
    + reportStatCard('🏁', taskCounts.done + ' / ' + taskCounts.total, 'Tasks completed')
    + reportStatCard('⏱️', hourTotals.approved.toFixed(1), 'Approved hours')
    + reportStatCard('🕒', hourTotals.pending.toFixed(1), 'Pending hours')
    + '</div>';

  // Volunteer snapshot - who is doing what
  html += '<div class="card"><div class="card-header"><h3>Volunteer Snapshot</h3>'
    + '<span class="list-count">' + approvedApplications.length + ' approved for this event</span></div><div class="card-body table-flush">';
  if (approvedApplications.length === 0) {
    html += '<div class="empty-state" style="padding:18px;"><div class="empty-state-icon">👥</div><h4>Nobody approved yet</h4>'
      + '<p>Approve volunteers for this event to see their tasks and hours here.</p></div>';
  } else {
    html += '<div class="table-wrap"><table class="table-compact"><thead><tr>'
      + '<th>Volunteer</th><th class="cell-hours">Tasks</th><th class="cell-hours">Hours</th><th class="cell-actions-head">Open</th>'
      + '</tr></thead><tbody>';
    approvedApplications.slice().sort(function(firstApplication, secondApplication) {
      return approvedUserName(firstApplication).localeCompare(approvedUserName(secondApplication));
    }).forEach(function(application) {
      var profile = getApplicationProfile(application);
      var applicationData = vd(application);
      var profileId = profile ? profile.id : applicationData.registryProfileId;
      var personEventTasks = personTasks(profileId, applicationData.volunteerUserId).filter(function(task) {
        return vd(task).eventId === eventId;
      });
      var personTaskCounts = taskStatusCounts(personEventTasks);
      var personHourTotals = hourTotalsFor(personHours(profileId, applicationData.volunteerUserId).filter(function(hour) {
        return vd(hour).eventId === eventId;
      }));

      html += '<tr>'
        + '<td><div class="person-main"><div class="person-name">' + esc(profile ? profileName(profile) : (application.name || 'Unknown')) + '</div>'
        + '<div class="person-sub">' + esc(profile ? (vd(profile).email || '—') : '—') + '</div></div></td>'
        + '<td class="cell-hours">' + personTaskCounts.done + ' / ' + personTaskCounts.total + '</td>'
        + '<td class="cell-hours">' + personHourTotals.approved.toFixed(1) + ' <span class="person-sub">/ ' + personHourTotals.logged.toFixed(1) + ' h</span></td>'
        + '<td><div class="actions-cell">'
        + (profile ? '<button class="btn btn-xs btn-outline" onclick="openVolunteerDetail(\'' + escJs(profile.id) + '\')">Dashboard</button>' : '')
        + '</div></td></tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '</div></div>';

  // Open work
  var openTasks = tasks.filter(function(task) {
    var status = vd(task).status;
    return status === 'open' || status === 'assigned' || status === 'in-progress';
  }).sort(function(firstTask, secondTask) {
    return String(vd(firstTask).dueDate || '9999').localeCompare(String(vd(secondTask).dueDate || '9999'));
  });

  html += '<div class="card"><div class="card-header"><h3>Open Work</h3><span class="list-count">' + openTasks.length + ' open tasks · ' + pendingApplications.length + ' requests to decide</span></div><div class="card-body table-flush">';
  if (openTasks.length === 0 && pendingApplications.length === 0) {
    html += '<div class="empty-state" style="padding:18px;"><div class="empty-state-icon">🎉</div><h4>Nothing is waiting</h4>'
      + '<p>Every task is completed and every request has been decided.</p></div>';
  } else {
    html += '<div class="table-wrap"><table class="table-compact"><thead><tr>'
      + '<th>Task</th><th>Assignee</th><th class="col-due">Due</th><th>Status</th>'
      + '</tr></thead><tbody>';
    openTasks.forEach(function(task) {
      var taskData = vd(task);
      html += '<tr>'
        + '<td><div class="person-main"><div class="person-name">' + esc(task.name) + '</div></div></td>'
        + '<td>' + esc(taskAssigneeName(taskData)) + '</td>'
        + '<td class="col-due">' + esc(taskData.dueDate ? fmtDate(taskData.dueDate) : '—') + '</td>'
        + '<td><span class="badge badge-' + esc(taskData.status || 'open') + '">' + esc(volunteerStatusLabel(taskData.status)) + '</span></td>'
        + '</tr>';
    });
    pendingApplications.forEach(function(application) {
      html += '<tr>'
        + '<td><div class="person-main"><div class="person-name">' + esc(approvedUserName(application)) + ' is waiting for a decision</div></div></td>'
        + '<td>—</td>'
        + '<td class="col-due">' + esc(fmtDate(vd(application).appliedAt) || '—') + '</td>'
        + '<td><span class="badge badge-pending">Pending request</span></td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '</div></div>';

  html += renderActivityCard(buildActivityFeed(eventId, 10), 'Event Activity');

  return html;
}

/* ── Reports: one volunteer (full history) ── */
function renderVolunteerReport(container) {
  var profileRecords = APP.registry.slice().sort(function(firstProfile, secondProfile) {
    return profileName(firstProfile).localeCompare(profileName(secondProfile));
  });

  var selectedProfileId = APP.isManager ? APP.reportProfileId : '';
  var currentProfile = null;

  if (!APP.isManager) {
    currentProfile = APP.myProfile;
    if (!currentProfile && APP.myApplication) currentProfile = getApplicationProfile(APP.myApplication);
  } else {
    if (!selectedProfileId && profileRecords.length) selectedProfileId = profileRecords[0].id;
    if (selectedProfileId) currentProfile = getRegistryProfileById(selectedProfileId);
  }

  if (!currentProfile) {
    container.innerHTML = '<div class="card"><div class="card-body"><div class="empty-state"><div class="empty-state-icon">👤</div>'
      + '<h4>' + (APP.isManager ? 'No volunteer selected' : 'No volunteer profile yet') + '</h4>'
      + '<p>' + (APP.isManager ? 'Add volunteers to the network to see their history.' : 'Register as a volunteer to build your history.') + '</p>'
      + '</div></div></div>';
    return;
  }

  var html = '';

  if (APP.isManager) {
    html += '<div class="card report-picker"><div class="card-body"><label class="form-label" for="reportVolunteerSelect">Volunteer</label>'
      + '<select class="form-select" id="reportVolunteerSelect" onchange="setReportVolunteer(this.value)">'
      + profileRecords.map(function(record) {
          return '<option value="' + esc(record.id) + '"' + (record.id === currentProfile.id ? ' selected' : '') + '>' + esc(profileName(record)) + '</option>';
        }).join('')
      + '</select></div></div>';
  }

  html += buildVolunteerProfileCardHtml(currentProfile);
  html += buildVolunteerReportHtml(currentProfile);
  container.innerHTML = html;
}

/* Profile summary card, also used by the volunteer dashboard and detail view. */
function buildVolunteerProfileCardHtml(currentProfile) {
  var profileData = vd(currentProfile);
  var networkStatus = profileData.status || 'candidate';

  return '<div class="card"><div class="card-body report-profile">'
    + '<div class="report-avatar">' + esc(initialsFor(profileName(currentProfile))) + '</div>'
    + '<div class="report-profile-main">'
    + '<h2 class="report-name">' + esc(profileName(currentProfile)) + '</h2>'
    + '<div class="report-contact">' + esc(profileData.email || 'No email') + (profileData.phone ? ' · ' + esc(profileData.phone) : '') + (profileData.city ? ' · ' + esc(profileData.city) : '') + '</div>'
    + '<div class="report-tags"><span class="badge badge-' + esc(volunteerNetworkBadgeClass(networkStatus)) + '">' + esc(volunteerNetworkLabel(networkStatus)) + '</span>'
    + (profileData.joinedAt ? '<span class="report-tag">Joined ' + esc(fmtDate(profileData.joinedAt)) + '</span>' : '')
    + (profileData.availabilityNotes ? '<span class="report-tag">' + esc(profileData.availabilityNotes) + '</span>' : '')
    + '</div>'
    + (profileData.skills ? '<div class="report-skills">Skills: ' + esc(profileData.skills) + '</div>' : '')
    + '</div></div></div>';
}

/* Full history tables for one volunteer (all events, tasks and hours). */
function buildVolunteerReportHtml(currentProfile) {
  var profileData = vd(currentProfile);
  var profileTasks = personTasks(currentProfile.id, profileData.userId);
  var profileHours = personHours(currentProfile.id, profileData.userId);
  var profileApplications = personApplications(currentProfile.id, profileData.userId);
  var approvedApplications = profileApplications.filter(function(application) { return vd(application).status === 'approved'; });
  var taskCounts = taskStatusCounts(profileTasks);
  var hourTotals = hourTotalsFor(profileHours);

  var html = '<div class="stats-row report-stats">'
    + reportStatCard('📅', approvedApplications.length + ' / ' + profileApplications.length, 'Events joined / applied')
    + reportStatCard('📋', taskCounts.done + ' / ' + taskCounts.total, 'Tasks completed')
    + reportStatCard('⏱️', hourTotals.approved.toFixed(1), 'Approved hours')
    + reportStatCard('🕒', hourTotals.pending.toFixed(1), 'Pending hours')
    + '</div>';

  // Events history
  html += '<div class="card"><div class="card-header"><h3>Event History</h3></div><div class="card-body table-flush">';
  if (profileApplications.length === 0) {
    html += '<div class="empty-state" style="padding:18px;"><div class="empty-state-icon">📅</div><h4>No event history</h4><p>This person has not applied to any event yet.</p></div>';
  } else {
    html += '<div class="table-wrap"><table class="table-compact"><thead><tr>'
      + '<th>Event</th><th>Event status</th><th>Applied</th><th>Decision</th>'
      + '<th class="cell-hours col-est-hours">Tasks</th><th class="cell-hours">Hours</th>'
      + '</tr></thead><tbody>';
    profileApplications.slice().sort(function(firstApplication, secondApplication) {
      var firstEvent = getEventRecordById(vd(firstApplication).eventId);
      var secondEvent = getEventRecordById(vd(secondApplication).eventId);
      var firstDate = firstEvent ? (vd(firstEvent).startDate || '') : '';
      var secondDate = secondEvent ? (vd(secondEvent).startDate || '') : '';
      return String(secondDate).localeCompare(String(firstDate));
    }).forEach(function(application) {
      var applicationData = vd(application);
      var eventRecord = getEventRecordById(applicationData.eventId);
      var eventData = eventRecord ? vd(eventRecord) : {};
      var eventTaskCounts = taskStatusCounts(profileTasks.filter(function(task) { return vd(task).eventId === applicationData.eventId; }));
      var eventHourTotals = hourTotalsFor(profileHours.filter(function(hour) { return vd(hour).eventId === applicationData.eventId; }));

      html += '<tr>'
        + '<td><div class="person-main"><div class="person-name">' + esc(eventLabelFor(applicationData.eventId)) + '</div>'
        + '<div class="person-sub">' + esc(eventWhenText(eventData)) + '</div></div></td>'
        + '<td><span class="badge badge-' + esc(applicationData.status || 'pending') + '">' + esc(volunteerStatusLabel(applicationData.status)) + '</span></td>'
        + '<td>' + esc(applicationData.appliedAt ? fmtDate(applicationData.appliedAt) : '—') + '</td>'
        + '<td>' + esc(applicationData.reviewedBy ? applicationData.reviewedBy : '—') + '</td>'
        + '<td class="cell-hours col-est-hours">' + eventTaskCounts.done + ' / ' + eventTaskCounts.total + '</td>'
        + '<td class="cell-hours">' + eventHourTotals.logged.toFixed(1) + ' <span class="person-sub">h</span></td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '</div></div>';

  // Tasks history
  html += '<div class="card"><div class="card-header"><h3>Task History</h3><span class="list-count">' + profileTasks.length + ' tasks</span></div><div class="card-body table-flush">';
  if (profileTasks.length === 0) {
    html += '<div class="empty-state" style="padding:18px;"><div class="empty-state-icon">📋</div><h4>No tasks yet</h4><p>Tasks assigned to this volunteer will be listed here.</p></div>';
  } else {
    html += '<div class="table-wrap"><table class="table-compact"><thead><tr>'
      + '<th>Task</th><th>Event</th><th class="col-due">Due</th><th>Status</th><th class="cell-hours">Est. h</th>'
      + '</tr></thead><tbody>';
    profileTasks.slice().sort(function(firstTask, secondTask) {
      return String(vd(secondTask).dueDate || '').localeCompare(String(vd(firstTask).dueDate || ''));
    }).forEach(function(task) {
      var taskData = vd(task);
      html += '<tr>'
        + '<td><div class="person-main"><div class="person-name">' + esc(task.name) + '</div></div></td>'
        + '<td>' + esc(eventLabelFor(taskData.eventId)) + '</td>'
        + '<td class="col-due">' + esc(taskData.dueDate ? fmtDate(taskData.dueDate) : '—') + '</td>'
        + '<td><span class="badge badge-' + esc(taskData.status || 'open') + '">' + esc(volunteerStatusLabel(taskData.status)) + '</span></td>'
        + '<td class="cell-hours">' + (taskData.estimatedHours || 0) + '</td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '</div></div>';

  // Hours history
  html += '<div class="card"><div class="card-header"><h3>Hours History</h3><span class="list-count">' + hourTotals.logged.toFixed(1) + ' h logged</span></div><div class="card-body table-flush">';
  if (profileHours.length === 0) {
    html += '<div class="empty-state" style="padding:18px;"><div class="empty-state-icon">⏱️</div><h4>No hours recorded</h4><p>Hours logged by this volunteer will be listed here.</p></div>';
  } else {
    html += '<div class="table-wrap"><table class="table-compact"><thead><tr>'
      + '<th>Date</th><th>Event</th><th>Task</th><th class="cell-hours">Hours</th><th>Status</th><th class="col-due">Reviewer</th>'
      + '</tr></thead><tbody>';
    profileHours.slice().sort(function(firstHour, secondHour) {
      return String(vd(secondHour).date || '').localeCompare(String(vd(firstHour).date || ''));
    }).forEach(function(hour) {
      var hourData = vd(hour);
      html += '<tr>'
        + '<td>' + esc(fmtDate(hourData.date)) + '</td>'
        + '<td>' + esc(eventLabelFor(hourData.eventId)) + '</td>'
        + '<td>' + esc(hourData.taskName || 'General') + '</td>'
        + '<td class="cell-hours">' + (Number(hourData.hoursLogged) || 0).toFixed(1) + '</td>'
        + '<td><span class="badge badge-' + esc(hourData.status || 'pending') + '">' + esc(volunteerStatusLabel(hourData.status)) + '</span></td>'
        + '<td class="col-due">' + esc(hourData.reviewedBy || '—') + '</td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '</div></div>';

  html += renderActivityCard(buildActivityFeed('', 12, currentProfile.id, profileData.userId), 'Personal Activity');

  return html;
}

/* Volunteer dashboard: the one-screen summary for a person. */
function buildVolunteerDashboardHtml(currentProfile) {
  var profileData = vd(currentProfile);
  var profileTasks = personTasks(currentProfile.id, profileData.userId);
  var profileHours = personHours(currentProfile.id, profileData.userId);
  var profileApplications = personApplications(currentProfile.id, profileData.userId);
  var approvedApplications = profileApplications.filter(function(application) { return vd(application).status === 'approved'; });
  var taskCounts = taskStatusCounts(profileTasks);
  var hourTotals = hourTotalsFor(profileHours);

  var html = '<div class="stats-row report-stats">'
    + reportStatCard('📅', approvedApplications.length + ' / ' + profileApplications.length, 'Events joined / applied')
    + reportStatCard('📋', taskCounts.done + ' / ' + taskCounts.total, 'Tasks completed')
    + reportStatCard('⏱️', hourTotals.approved.toFixed(1), 'Approved hours')
    + reportStatCard('🕒', hourTotals.pending.toFixed(1), 'Pending hours')
    + '</div>';

  var openTasks = profileTasks.filter(function(task) {
    var status = vd(task).status;
    return status === 'open' || status === 'assigned' || status === 'in-progress';
  }).sort(function(firstTask, secondTask) {
    return String(vd(firstTask).dueDate || '9999').localeCompare(String(vd(secondTask).dueDate || '9999'));
  });

  html += '<div class="card"><div class="card-header"><h3>Upcoming Work</h3><span class="list-count">' + openTasks.length + ' open tasks</span></div><div class="card-body table-flush">';
  if (openTasks.length === 0) {
    html += '<div class="empty-state" style="padding:18px;"><div class="empty-state-icon">✅</div><h4>No open tasks</h4><p>Tasks assigned to this volunteer will appear here.</p></div>';
  } else {
    html += '<div class="table-wrap"><table class="table-compact"><thead><tr>'
      + '<th>Task</th><th>Event</th><th class="col-due">Due</th><th>Status</th>'
      + '</tr></thead><tbody>';
    openTasks.forEach(function(task) {
      var taskData = vd(task);
      html += '<tr>'
        + '<td><div class="person-main"><div class="person-name">' + esc(task.name) + '</div></div></td>'
        + '<td>' + esc(eventLabelFor(taskData.eventId)) + '</td>'
        + '<td class="col-due">' + esc(taskData.dueDate ? fmtDate(taskData.dueDate) : '—') + '</td>'
        + '<td><span class="badge badge-' + esc(taskData.status || 'open') + '">' + esc(volunteerStatusLabel(taskData.status)) + '</span></td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '</div></div>';

  var recentHours = profileHours.slice().sort(function(firstHour, secondHour) {
    return String(vd(secondHour).date || '').localeCompare(String(vd(firstHour).date || ''));
  }).slice(0, 6);

  html += '<div class="card"><div class="card-header"><h3>Recent Hours</h3><span class="list-count">' + hourTotals.logged.toFixed(1) + ' h logged in total</span></div><div class="card-body table-flush">';
  if (recentHours.length === 0) {
    html += '<div class="empty-state" style="padding:18px;"><div class="empty-state-icon">⏱️</div><h4>No hours yet</h4><p>Hours recorded for this volunteer will appear here.</p></div>';
  } else {
    html += '<div class="table-wrap"><table class="table-compact"><thead><tr>'
      + '<th>Date</th><th>Event</th><th>Task</th><th class="cell-hours">Hours</th><th>Status</th>'
      + '</tr></thead><tbody>';
    recentHours.forEach(function(hour) {
      var hourData = vd(hour);
      html += '<tr>'
        + '<td>' + esc(fmtDate(hourData.date)) + '</td>'
        + '<td>' + esc(eventLabelFor(hourData.eventId)) + '</td>'
        + '<td>' + esc(hourData.taskName || 'General') + '</td>'
        + '<td class="cell-hours">' + (Number(hourData.hoursLogged) || 0).toFixed(1) + '</td>'
        + '<td><span class="badge badge-' + esc(hourData.status || 'pending') + '">' + esc(volunteerStatusLabel(hourData.status)) + '</span></td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '</div></div>';

  html += renderActivityCard(buildActivityFeed('', 8, currentProfile.id, profileData.userId), 'Recent Activity');

  return html;
}

function initialsFor(fullName) {
  var parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/* ── UI: Messages ── */
function renderMessages() {
  var actHTML = '<button class="btn btn-primary" onclick="openMessageModal()">💬 New Message</button>';
  el('msgActions').innerHTML = actHTML;

  var msgs = APP.messages.slice().sort(function(a, b) {
    return (vd(b).sentAt || '').localeCompare(vd(a).sentAt || '');
  });

  var html = '';
  if (msgs.length === 0) {
    html = '<div class="empty-state"><div class="empty-state-icon">💬</div><h4>No Messages</h4><p>Send a message to start communicating with ' + (APP.isManager ? 'volunteers' : 'event managers') + '.</p></div>';
  } else {
    msgs.forEach(function(m) {
      var d = vd(m);
      var unreadClass = '';
      if (APP.isManager) {
        if (d.read === false) unreadClass = ' unread';
      } else {
        if (d.toUserId === (APP.user ? APP.user.id : '') && d.read === false) unreadClass = ' unread';
      }
      html += '<div class="msg-item' + unreadClass + '" onclick="markMessageRead(\'' + m.id + '\')">' +
        '<div class="msg-header">' +
        '<span class="msg-from">' + esc(d.fromName) + (d.fromRole === 'manager' ? ' 🛡️' : '') + '</span>' +
        '<span class="msg-time">' + fmtDateTime(d.sentAt) + '</span>' +
        '</div>' +
        '<div class="msg-subject"><strong>' + esc(d.subject || '(no subject)') + '</strong></div>' +
        '<div class="msg-body">' + esc(d.body || '') + '</div>' +
        '</div>';
    });
  }
  el('msgList').innerHTML = html;
  updateBadges();
  tool.resize();
}

/* ── UI: Certificate ── */
function renderCertificate() {
  var html = '';
  if (!APP.user) {
    html = '<div class="empty-state"><div class="empty-state-icon">🔒</div><h4>Login Required</h4><p>Please log in to view your volunteer certificate.</p></div>';
  } else if (!APP.myApplication) {
    html = '<div class="empty-state"><div class="empty-state-icon">🙋</div><h4>Not a Volunteer</h4><p>You need to register and be approved as a volunteer first.</p></div>';
  } else if (vd(APP.myApplication).status !== 'approved') {
    html = '<div class="empty-state"><div class="empty-state-icon">⏳</div><h4>Pending Approval</h4><p>Your volunteer application must be approved before you can generate a certificate.</p></div>';
  } else {
    // Calculate stats for certificate
    var myUserId = APP.user.id;
    var myHours = APP.hours.filter(function(h) {
      var d = vd(h);
      return d.volunteerUserId === myUserId && d.status === 'approved';
    });
    var totalApproved = 0;
    myHours.forEach(function(h) { totalApproved += (Number(vd(h).hoursLogged) || 0); });

    var myTasks = APP.tasks.filter(function(t) {
      return vd(t).assignedVolunteerUserId === myUserId;
    });
    var completedTasks = myTasks.filter(function(t) { return vd(t).status === 'completed'; });

    var d = APP.myProfile ? vd(APP.myProfile) : {};
    var certName = APP.myProfile ? profileName(APP.myProfile) : (APP.user ? APP.user.name : 'Volunteer');

    // Certificate preview
    html = '<div class="cert-preview" id="certPreview">' +
      '<div class="cert-org">' + esc(tool.param('orgName', 'Our Organization')) + '</div>' +
      '<div class="cert-title">Certificate of Volunteer Appreciation</div>' +
      '<div class="cert-subtitle">In grateful recognition of outstanding volunteer service</div>' +
      '<div class="cert-name">' + esc(certName) + '</div>' +
      '<div class="cert-body">' +
      'Thank you for your dedicated service and invaluable contributions.<br>' +
      'Your commitment of <strong>' + totalApproved.toFixed(1) + ' hours</strong> has made a meaningful difference.' +
      '</div>' +
      '<div class="cert-hours">' + totalApproved.toFixed(1) + '</div>' +
      '<div class="cert-hours-label">Total Volunteer Hours</div>' +
      '<div style="margin-top:16px;font-size:13px;color:var(--neutral-600);">' +
      '<strong>Tasks Completed:</strong> ' + completedTasks.length + ' of ' + myTasks.length + ' assigned tasks' +
      '</div>' +
      '<div class="cert-signature">' +
      '<div class="cert-sig-line">Event Manager</div>' +
      '<div class="cert-sig-line">Date</div>' +
      '</div>' +
      '<div class="cert-date">Generated on ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</div>' +
      '</div>';

    if (totalApproved > 0) {
      html += '<div style="text-align:center;margin-top:20px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">' +
        '<button class="btn btn-primary btn-lg" onclick="exportCertificatePDF()">📥 Download Certificate (PDF)</button>' +
        '<button class="btn btn-outline btn-lg" onclick="emailCertificate()">📧 Email My Certificate</button>' +
        '</div>';
    } else {
      html += '<div class="empty-state" style="margin-top:16px;"><h4>No Approved Hours Yet</h4><p>Once your logged hours are approved, your certificate will show your total volunteer time.</p></div>';
    }
  }
  el('certBody').innerHTML = html;
  tool.resize();
}

/* ── Badge Updates ── */
function updateBadges() {
  var pendingApplications = APP.applications.filter(function(a) { return vd(a).status === 'pending'; }).length;
  var networkCandidates = APP.registry.filter(function(profile) { return vd(profile).status === 'candidate'; }).length;
  var pendingVols = pendingApplications + networkCandidates;
  var openTasks = APP.tasks.filter(function(t) { var s = vd(t).status; return s === 'open' || s === 'assigned' || s === 'in-progress'; }).length;

  var unreadMsgs = 0;
  APP.messages.forEach(function(m) {
    var d = vd(m);
    if (APP.isManager && d.read === false) unreadMsgs++;
    else if (!APP.isManager && d.toUserId === (APP.user ? APP.user.id : '') && d.read === false) unreadMsgs++;
  });

  var bv = el('badgeVolunteers');
  var bt = el('badgeTasks');
  var bm = el('badgeMessages');
  if (bv) {
    bv.textContent = APP.isManager ? pendingVols : (APP.myApplication ? '1' : '0');
    bv.className = 'tab-badge' + (pendingVols > 0 ? ' pending' : '');
  }
  if (bt) {
    bt.textContent = openTasks || '0';
    bt.className = 'tab-badge';
  }
  if (bm) {
    bm.textContent = unreadMsgs || '0';
    bm.className = 'tab-badge' + (unreadMsgs > 0 ? ' pending' : '');
  }
}

/* ── Actions: Volunteer Registration ── */
function openRegisterModal() {
  // Volunteers register themselves; managers add people through the Add Volunteer form.
  if (APP.myApplication && vd(APP.myApplication).status !== 'rejected') {
    tool.notify('You are already registered. Status: ' + vd(APP.myApplication).status, 'info');
    return;
  }

  el('regSkills').value = APP.myProfile ? (vd(APP.myProfile).skills || '') : '';
  el('regAvailability').value = APP.myProfile ? (vd(APP.myProfile).availabilityNotes || '') : '';
  el('regMotivation').value = APP.myApplication ? (vd(APP.myApplication).notes || '') : '';
  openModal('modalRegister');
}

function submitRegistration() {
  var skills = el('regSkills').value.trim();
  var availability = el('regAvailability').value.trim();
  var motivation = el('regMotivation').value.trim();

  if (!skills && !availability) {
    tool.notify('Please fill in at least your skills or availability.', 'warning');
    return;
  }

  var targetUser = APP.user;
  if (!targetUser) { tool.notify('You must be logged in.', 'error'); return; }

  var appStatus = 'pending';

  // Step 1: upsert the registry profile (invariant REGISTRY-ONLY, D-VM-02)
  var existingProfile = getRegistryProfileByUserId(targetUser.id);
  var registryData = {
    userId: targetUser.id,
    firstName: targetUser.name || 'Unknown',
    lastName: '',
    email: targetUser.email || '',
    skills: skills,
    availabilityNotes: availability,
    status: existingProfile ? (vd(existingProfile).status || 'candidate') : 'candidate',
    consentGiven: existingProfile ? (vd(existingProfile).consentGiven !== undefined ? vd(existingProfile).consentGiven : true) : true,
    source: existingProfile ? (vd(existingProfile).source || 'volunteer') : 'volunteer',
    updatedAt: isoNow()
  };
  if (!existingProfile) registryData.joinedAt = isoNow();

  var profileLabel = targetUser.name || targetUser.email || 'Volunteer';

  function finishRegistration() {
    tool.notify('Registration submitted! Waiting for approval.', 'success');
    closeModal('modalRegister');
    reloadAndRender();
  }

  // Step 2: create or update the event application (D-VM-03)
  function step2(profileId) {
    var existingApp = getApplicationByUserId(targetUser.id);
    var appData = {
      registryProfileId: profileId,
      eventId: APP.currentEventId || '',
      volunteerUserId: targetUser.id,
      status: appStatus,
      appliedAt: isoNow(),
      notes: motivation,
      reviewedAt: '',
      reviewedBy: ''
    };
    if (existingApp) {
      var cur = vd(existingApp);
      var merged = {};
      for (var k in cur) { if (cur.hasOwnProperty(k)) merged[k] = cur[k]; }
      merged.status = appStatus;
      merged.appliedAt = appData.appliedAt;
      merged.notes = motivation;
      merged.registryProfileId = profileId;
      merged.reviewedAt = appData.reviewedAt;
      merged.reviewedBy = appData.reviewedBy;
      updateObject(TYPE_APPLICATIONS, existingApp.id, merged, profileLabel, function(err) {
        if (err) { tool.notify('Error: ' + err, 'error'); return; }
        finishRegistration();
      });
    } else {
      createObject(TYPE_APPLICATIONS, profileLabel, appData, function(err) {
        if (err) { tool.notify('Error: ' + err, 'error'); return; }
        finishRegistration();
      });
    }
  }

  if (existingProfile) {
    updateObject(TYPE_REGISTRY, existingProfile.id, registryData, profileLabel, function(err) {
      if (err) { tool.notify('Error: ' + err, 'error'); return; }
      step2(existingProfile.id);
    });
  } else {
    createObject(TYPE_REGISTRY, profileLabel, registryData, function(err, obj) {
      if (err) { tool.notify('Error: ' + err, 'error'); return; }
      step2(obj ? obj.id : '');
    });
  }
}

function approveVolunteer(appId) {
  var app = getApplicationById(appId);
  if (!app) return;
  var d = vd(app);
  var profile = getApplicationProfile(app);
  if (profile && vd(profile).status === 'banned') {
    tool.notify('Cannot approve: this volunteer profile is banned.', 'error');
    return;
  }
  var u = APP.user;
  var data = {};
  for (var k in d) { if (d.hasOwnProperty(k)) data[k] = d[k]; }
  data.status = 'approved';
  data.reviewedAt = isoNow();
  data.reviewedBy = u ? u.name : 'Manager';
  updateObject(TYPE_APPLICATIONS, appId, data, app.name, function(err) {
    if (err) { tool.notify('Error: ' + err, 'error'); return; }
    tool.notify((profile ? profileName(profile) : 'Volunteer') + ' approved for this event!', 'success');
    reloadAndRender();
  });
}

/* Stage one of the two approvals: bring a candidate into the volunteer network.
   Event approvals stay separate and are handled per event. */
function approveNetworkCandidate(profileId) {
  if (!APP.isManager || APP.readOnly) return;
  var profile = getRegistryProfileById(profileId);
  if (!profile) { tool.notify('Volunteer profile not found.', 'error'); return; }

  var profileData = vd(profile);
  var registryData = {};
  for (var key in profileData) {
    if (profileData.hasOwnProperty(key)) registryData[key] = profileData[key];
  }
  registryData.status = 'active';
  registryData.networkApprovedAt = isoNow();
  registryData.networkApprovedBy = APP.user ? APP.user.name : 'Manager';
  registryData.updatedAt = isoNow();

  updateObject(getRegistryType(), profile.id, registryData, profile.name || profileName(profile), function(err) {
    if (err) { tool.notify('Error approving volunteer: ' + err, 'error'); return; }
    tool.notify(profileName(profile) + ' is now an approved volunteer.', 'success');
    reloadAndRender();
  });
}

function rejectVolunteer(appId) {
  var app = getApplicationById(appId);
  if (!app) return;
  var d = vd(app);
  var profile = getApplicationProfile(app);
  showConfirm('Reject Volunteer?', 'Are you sure you want to reject <strong>' + esc(profile ? profileName(profile) : (app.name || 'Volunteer')) + '</strong> for this event?', function() {
    var u = APP.user;
    var data = {};
    for (var k in d) { if (d.hasOwnProperty(k)) data[k] = d[k]; }
    data.status = 'rejected';
    data.reviewedAt = isoNow();
    data.reviewedBy = u ? u.name : 'Manager';
    updateObject(TYPE_APPLICATIONS, appId, data, app.name, function(err) {
      if (err) { tool.notify('Error: ' + err, 'error'); return; }
      tool.notify('Application rejected.', 'info');
      reloadAndRender();
    });
  });
}

function addVolunteerToEvent(profileId) {
  var profile = getRegistryProfileById(profileId);
  if (!profile) { tool.notify('Profile not found.', 'error'); return; }
  var d = vd(profile);
  var data = {
    registryProfileId: profile.id,
    eventId: APP.currentEventId || '',
    volunteerUserId: d.userId || '',
    status: 'approved',
    appliedAt: isoNow(),
    notes: 'Added by manager',
    reviewedAt: isoNow(),
    reviewedBy: APP.user ? APP.user.name : ''
  };
  createObject(TYPE_APPLICATIONS, profileName(profile), data, function(err) {
    if (err) { tool.notify('Error: ' + err, 'error'); return; }
    tool.notify(profileName(profile) + ' added to this event!', 'success');
    reloadAndRender();
  });
}

/* ── Actions: Add / Edit Volunteer ── */
var editingVolunteerRef = { profileId: '', applicationId: '', isNewPerson: false };

function findRegistryProfileByEmail(email) {
  var normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  for (var i = 0; i < APP.registry.length; i++) {
    var profileData = vd(APP.registry[i]);
    if (String(profileData.email || '').trim().toLowerCase() === normalizedEmail) return APP.registry[i];
  }
  return null;
}

function findPermittedUserByEmail(email) {
  var normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  for (var i = 0; i < APP.permittedUsers.length; i++) {
    var permittedUser = APP.permittedUsers[i];
    if (permittedUser.email && String(permittedUser.email).trim().toLowerCase() === normalizedEmail) return permittedUser;
  }
  return null;
}

function setVolunteerFormMode(isNewPerson) {
  var modalTitle = el('editVolunteerTitle');
  if (modalTitle) modalTitle.textContent = isNewPerson ? '➕ Add Volunteer' : '✏️ Edit Volunteer';
  var saveButton = el('editVolunteerSaveBtn');
  if (saveButton) saveButton.textContent = isNewPerson ? 'Add Volunteer' : 'Save Changes';
}

function clearVolunteerFormFields() {
  el('evFirstName').value = '';
  el('evLastName').value = '';
  el('evEmail').value = '';
  el('evPhone').value = '';
  el('evCity').value = '';
  el('evAvailability').value = '';
  el('evSkills').value = '';
  el('evProfileStatus').value = 'active';
}

function openAddVolunteerModal() {
  if (!APP.isManager) return;
  if (APP.readOnly) { tool.notify('This record is read-only.', 'info'); return; }

  editingVolunteerRef = { profileId: '', applicationId: '', isNewPerson: true };
  clearVolunteerFormFields();
  setVolunteerFormMode(true);

  openModal('modalEditVolunteer');
  var firstNameInput = el('evFirstName');
  if (firstNameInput && firstNameInput.focus) firstNameInput.focus();
}

function openEditVolunteerModal(profileId, applicationId) {
  if (!APP.isManager) return;
  if (APP.readOnly) { tool.notify('This record is read-only.', 'info'); return; }

  var profile = profileId ? getRegistryProfileById(profileId) : null;
  var application = applicationId ? getApplicationById(applicationId) : null;
  if (!profile && !application) { tool.notify('Volunteer record not found. Refresh and try again.', 'error'); return; }

  editingVolunteerRef = {
    profileId: profile ? profile.id : '',
    applicationId: application ? application.id : '',
    isNewPerson: false
  };
  setVolunteerFormMode(false);

  var profileData = profile ? vd(profile) : {};
  var applicationData = application ? vd(application) : {};
  var permittedUser = findPermittedUser(profileData.userId || applicationData.volunteerUserId) || {};
  var fallbackName = permittedUser.name || (application ? (application.name || '') : '');

  el('evFirstName').value = profileData.firstName || fallbackName;
  el('evLastName').value = profileData.lastName || '';
  el('evEmail').value = profileData.email || permittedUser.email || '';
  el('evPhone').value = profileData.phone || '';
  el('evCity').value = profileData.city || '';
  el('evAvailability').value = profileData.availabilityNotes || '';
  el('evSkills').value = profileData.skills || applicationData.skills || '';
  el('evProfileStatus').value = profileData.status || 'candidate';

  openModal('modalEditVolunteer');
}

function saveVolunteerEdits() {
  if (!APP.isManager || APP.readOnly) return;

  var isNewPerson = editingVolunteerRef.isNewPerson;
  var profile = editingVolunteerRef.profileId ? getRegistryProfileById(editingVolunteerRef.profileId) : null;
  var application = editingVolunteerRef.applicationId ? getApplicationById(editingVolunteerRef.applicationId) : null;
  if (!profile && !application && !isNewPerson) {
    tool.notify('Volunteer record not found. Refresh and try again.', 'error');
    return;
  }

  var firstName = el('evFirstName').value.trim();
  var lastName = el('evLastName').value.trim();
  var email = el('evEmail').value.trim();
  if (!firstName && !lastName && !email) {
    tool.notify('Please enter at least a first name, last name or email address.', 'warning');
    return;
  }

  // Adding someone who already exists in the shared registry updates that profile instead of duplicating it.
  var matchedExistingProfile = false;
  if (!profile && email) {
    profile = findRegistryProfileByEmail(email);
    matchedExistingProfile = !!profile;
  }

  var networkStatus = el('evProfileStatus').value || 'active';

  // Registry profile: update the existing record, or create a new person in the network.
  var registryData = {};
  var existingProfileData = profile ? vd(profile) : {};
  for (var profileKey in existingProfileData) {
    if (existingProfileData.hasOwnProperty(profileKey)) registryData[profileKey] = existingProfileData[profileKey];
  }

  // Re-adding a known volunteer keeps the data already stored when a field is left blank.
  var keepExistingValues = isNewPerson && matchedExistingProfile;
  function valueOrExisting(newValue, existingValue) {
    if (keepExistingValues && !newValue) return existingValue || '';
    return newValue;
  }

  registryData.firstName = valueOrExisting(firstName, existingProfileData.firstName);
  registryData.lastName = valueOrExisting(lastName, existingProfileData.lastName);
  registryData.email = email || existingProfileData.email || '';
  registryData.phone = valueOrExisting(el('evPhone').value.trim(), existingProfileData.phone);
  registryData.city = valueOrExisting(el('evCity').value.trim(), existingProfileData.city);
  registryData.availabilityNotes = valueOrExisting(el('evAvailability').value.trim(), existingProfileData.availabilityNotes);
  registryData.skills = valueOrExisting(el('evSkills').value.trim(), existingProfileData.skills);
  registryData.status = networkStatus;
  registryData.updatedAt = isoNow();

  var displayName = (registryData.firstName + ' ' + registryData.lastName).trim() || registryData.email || 'Volunteer';
  if (!profile) {
    var permittedUserWithEmail = findPermittedUserByEmail(email);
    registryData.userId = permittedUserWithEmail ? permittedUserWithEmail.id : '';
    registryData.joinedAt = isoNow();
    registryData.consentGiven = true;
    registryData.source = 'admin';
  }
  if (!registryData.userId && application) registryData.userId = vd(application).volunteerUserId || '';

  var savedMessage = isNewPerson
    ? (matchedExistingProfile ? 'This person was already in the volunteer network - their profile was updated.' : 'Volunteer added to the volunteer network.')
    : 'Volunteer details updated.';

  function finishSave() {
    tool.notify(savedMessage, 'success');
    closeModal('modalEditVolunteer');
    reloadAndRender();
  }

  // A candidate that only existed as an event application gets their profile linked back to that event.
  function linkApplicationToProfile(registryProfileId) {
    if (!application || !registryProfileId) { finishSave(); return; }
    var applicationData = vd(application);
    if (applicationData.registryProfileId === registryProfileId) { finishSave(); return; }
    var updatedApplicationData = {};
    for (var applicationKey in applicationData) {
      if (applicationData.hasOwnProperty(applicationKey)) updatedApplicationData[applicationKey] = applicationData[applicationKey];
    }
    updatedApplicationData.registryProfileId = registryProfileId;
    if (!updatedApplicationData.volunteerUserId && registryData.userId) updatedApplicationData.volunteerUserId = registryData.userId;
    updateObject(TYPE_APPLICATIONS, application.id, updatedApplicationData, displayName, function(err) {
      if (err) { tool.notify('Volunteer saved, but the event link could not be updated: ' + err, 'warning'); }
      finishSave();
    });
  }

  if (profile) {
    updateObject(getRegistryType(), profile.id, registryData, displayName, function(err) {
      if (err) { tool.notify('Error saving volunteer: ' + err, 'error'); return; }
      if (!editingVolunteerRef.profileId) linkApplicationToProfile(profile.id);
      else finishSave();
    });
  } else {
    createObject(getRegistryType(), displayName, registryData, function(err, createdProfile) {
      if (err) { tool.notify('Error creating volunteer: ' + err, 'error'); return; }
      linkApplicationToProfile(createdProfile ? createdProfile.id : '');
    });
  }
}

/* ── Actions: Tasks ── */
function openTaskModal(taskId, eventId) {
  var existingTask = taskId ? getTaskById(taskId) : null;
  if (taskId && !existingTask) { tool.notify('Task not found. Refresh and try again.', 'error'); return; }
  var existingTaskData = existingTask ? vd(existingTask) : {};

  var eventForForm = eventId || existingTaskData.eventId || '';
  if (!eventForForm) eventForForm = APP.currentEventId || '';
  APP.taskFormEventId = eventForForm || '';

  // Assignee list = volunteers approved for this event (or every approved volunteer outside an event)
  var assigneeApplications = eventForForm ? eventApprovedApplications(eventForForm) : getApprovedVolunteers();
  var sel = el('taskAssignee');
  sel.innerHTML = '<option value="">-- Unassigned (Open) --</option>';
  assigneeApplications.forEach(function(application) {
    var profile = getApplicationProfile(application);
    if (!profile) return;
    var opt = document.createElement('option');
    opt.value = profile.id;
    opt.textContent = profileName(profile);
    sel.appendChild(opt);
  });

  var eventRecord = eventForForm ? getEventRecordById(eventForForm) : null;
  var eventNameForTitle = eventRecord ? (vd(eventRecord).name || eventRecord.name || '') : '';

  if (existingTask) {
    var taskData = existingTaskData;
    el('modalTaskTitle').textContent = '✏️ Edit Task' + (eventNameForTitle ? ' · ' + eventNameForTitle : '');
    el('editTaskId').value = taskId;
    el('taskName').value = existingTask.name || '';
    el('taskDesc').value = taskData.description || '';
    var selectedProfileId = taskData.assignedRegistryProfileId || '';
    if (!selectedProfileId && taskData.assignedVolunteerUserId) {
      var linkedProfile = getRegistryProfileByUserId(taskData.assignedVolunteerUserId);
      selectedProfileId = linkedProfile ? linkedProfile.id : '';
    }
    el('taskAssignee').value = selectedProfileId;
    el('taskDueDate').value = (taskData.dueDate || '').slice(0, 10);
    el('taskEstHours').value = taskData.estimatedHours || '';
    el('taskStatus').value = taskData.status || 'open';
    el('btnSaveTask').textContent = 'Update Task';
  } else {
    el('modalTaskTitle').textContent = '📋 Create Task' + (eventNameForTitle ? ' · ' + eventNameForTitle : '');
    el('editTaskId').value = '';
    el('taskName').value = '';
    el('taskDesc').value = '';
    el('taskAssignee').value = '';
    el('taskDueDate').value = '';
    el('taskEstHours').value = '';
    el('taskStatus').value = 'open';
    el('btnSaveTask').textContent = 'Create Task';
  }
  openModal('modalTask');
}

function saveTask() {
  var name = el('taskName').value.trim();
  if (!name) { tool.notify('Task name is required.', 'warning'); return; }

  var assigneeProfileId = el('taskAssignee').value;
  var assigneeProfile = assigneeProfileId ? getRegistryProfileById(assigneeProfileId) : null;
  var assigneeUserId = assigneeProfile ? (vd(assigneeProfile).userId || '') : '';
  var taskStatus = el('taskStatus').value;

  var data = {
    eventId: APP.taskFormEventId || '',
    description: el('taskDesc').value.trim(),
    status: taskStatus,
    assignedRegistryProfileId: assigneeProfileId,
    assignedVolunteerUserId: assigneeUserId,
    dueDate: el('taskDueDate').value ? el('taskDueDate').value + 'T00:00:00Z' : '',
    estimatedHours: parseFloat(el('taskEstHours').value) || 0,
    createdBy: APP.user ? APP.user.name : '',
    createdAt: isoNow(),
    completedAt: taskStatus === 'completed' ? isoNow() : ''
  };
  if (assigneeProfileId && taskStatus === 'open') {
    data.status = 'assigned';
  }

  var editId = el('editTaskId').value;
  if (editId) {
    var existing = getTaskById(editId);
    if (existing && vd(existing).status !== 'completed' && data.status === 'completed') {
      data.completedAt = isoNow();
    }
    updateObject(TYPE_TASKS, editId, data, name, function(err) {
      if (err) { tool.notify('Error: ' + err, 'error'); return; }
      tool.notify('Task updated!', 'success');
      closeModal('modalTask');
      reloadAndRender();
    });
  } else {
    createObject(TYPE_TASKS, name, data, function(err, obj) {
      if (err) { tool.notify('Error: ' + err, 'error'); return; }
      tool.notify('Task created!', 'success');
      closeModal('modalTask');
      reloadAndRender();
    });
  }
}

function editTask(id) { openTaskModal(id); }

function updateTaskStatus(id, newStatus) {
  var t = getTaskById(id);
  if (!t) return;
  var d = vd(t);
  var data = {};
  for (var k in d) { if (d.hasOwnProperty(k)) data[k] = d[k]; }
  data.status = newStatus;
  if (newStatus === 'completed') data.completedAt = isoNow();
  updateObject(TYPE_TASKS, id, data, t.name, function(err) {
    if (err) { tool.notify('Error: ' + err, 'error'); return; }
    tool.notify('Task status updated to ' + newStatus + '!', 'success');
    reloadAndRender();
  });
}

function completeTask(id) {
  updateTaskStatus(id, 'completed');
}

function deleteTask(id) {
  var t = getTaskById(id);
  if (!t) return;
  showConfirm('Delete Task?', 'Are you sure you want to delete <strong>' + esc(t.name) + '</strong>? This cannot be undone.', function() {
    deleteObject(TYPE_TASKS, id, function(err) {
      if (err) { tool.notify('Error: ' + err, 'error'); return; }
      tool.notify('Task deleted.', 'info');
      reloadAndRender();
    });
  });
}

function viewVolunteerTasks(userId) {
  switchTab('tasks');
  el('taskFilterAssignee').value = userId;
  renderTasks();
}

/* ── Actions: Hours ──
   options: { eventId, registryProfileId } - used by the event management view so a manager
   can record hours on behalf of a volunteer of that event. */
function openHoursModal(taskId, options) {
  var settings = options || {};

  var eventForForm = settings.eventId || '';
  if (!eventForForm && taskId) {
    var taskForForm = getTaskById(taskId);
    eventForForm = taskForForm ? (vd(taskForForm).eventId || '') : '';
  }
  if (!eventForForm && APP.currentEventId) eventForForm = APP.currentEventId;
  APP.hourFormEventId = eventForForm || '';

  var managerMode = APP.isManager && !!APP.hourFormEventId;
  var volunteerGroup = el('hourVolunteerGroup');
  var volunteerSelect = el('hourVolunteer');
  if (volunteerGroup) volunteerGroup.style.display = managerMode ? '' : 'none';
  if (volunteerSelect) {
    volunteerSelect.innerHTML = '<option value="">-- Select Volunteer --</option>';
    if (managerMode) {
      eventApprovedApplications(APP.hourFormEventId).forEach(function(application) {
        var profile = getApplicationProfile(application);
        if (!profile) return;
        var opt = document.createElement('option');
        opt.value = profile.id;
        opt.textContent = profileName(profile);
        volunteerSelect.appendChild(opt);
      });
      volunteerSelect.value = settings.registryProfileId || '';
    }
  }

  // Task dropdown: tasks of this event, or the tasks assigned to the current user
  var sel = el('hourTaskId');
  sel.innerHTML = '<option value="">' + (managerMode ? '-- No specific task --' : '-- Select Task --') + '</option>';
  var taskPool = APP.hourFormEventId ? eventTasksFor(APP.hourFormEventId) : APP.tasks;
  taskPool.forEach(function(task) {
    var taskData = vd(task);
    if (taskData.status === 'cancelled') return;
    if (!APP.isManager && taskData.assignedVolunteerUserId !== (APP.user ? APP.user.id : '')) return;
    var opt = document.createElement('option');
    opt.value = task.id;
    opt.textContent = task.name;
    if (taskId && task.id === taskId) opt.selected = true;
    sel.appendChild(opt);
  });

  el('editHourId').value = '';
  el('hourDate').value = new Date().toISOString().slice(0, 10);
  el('hourAmount').value = '';
  el('hourDesc').value = '';
  el('btnSaveHours').textContent = 'Save Hours';
  openModal('modalHours');
}

function editHoursRecord(hourId) {
  if (!APP.isManager) return;
  var hourRecord = APP.hours.filter(function(candidate) { return candidate.id === hourId; })[0];
  if (!hourRecord) return;
  var hourData = vd(hourRecord);

  openHoursModal(hourData.taskId || null, {
    eventId: hourData.eventId || '',
    registryProfileId: hourData.registryProfileId || ''
  });

  el('editHourId').value = hourId;
  el('hourDate').value = (hourData.date || '').slice(0, 10);
  el('hourAmount').value = hourData.hoursLogged || '';
  el('hourDesc').value = hourData.description || '';
  if (hourData.taskId) el('hourTaskId').value = hourData.taskId;
  else el('hourTaskId').value = '';
  el('btnSaveHours').textContent = 'Update Hours';
}

function logHoursForTask(taskId) {
  openHoursModal(taskId);
}

function saveHours() {
  var taskId = el('hourTaskId').value;
  var date = el('hourDate').value;
  var amount = parseFloat(el('hourAmount').value);
  var description = el('hourDesc').value.trim();

  var volunteerGroup = el('hourVolunteerGroup');
  var managerMode = volunteerGroup && volunteerGroup.style.display !== 'none';
  var selectedProfileId = managerMode ? (el('hourVolunteer').value || '') : '';

  if (managerMode && !selectedProfileId) { tool.notify('Please select a volunteer.', 'warning'); return; }
  if (!date) { tool.notify('Please select a date.', 'warning'); return; }
  if (!amount || amount <= 0) { tool.notify('Please enter valid hours.', 'warning'); return; }
  if (!taskId && !managerMode) { tool.notify('Please select a task.', 'warning'); return; }

  var targetProfileId = '';
  var targetUserId = '';
  if (managerMode) {
    var targetProfile = getRegistryProfileById(selectedProfileId);
    targetProfileId = selectedProfileId;
    targetUserId = targetProfile ? (vd(targetProfile).userId || '') : '';
  } else {
    targetProfileId = APP.myProfile ? APP.myProfile.id : '';
    targetUserId = APP.user ? APP.user.id : '';
  }

  var taskRecord = taskId ? getTaskById(taskId) : null;
  var taskName = taskRecord ? taskRecord.name : 'General';

  var data = {
    eventId: APP.hourFormEventId || '',
    volunteerUserId: targetUserId,
    registryProfileId: targetProfileId,
    taskId: taskId,
    taskName: taskName,
    date: date + 'T00:00:00Z',
    hoursLogged: amount,
    description: description,
    status: APP.isManager ? 'approved' : 'pending',
    reviewedBy: APP.isManager ? (APP.user ? (APP.user.name || APP.user.email || '') : '') : '',
    reviewedAt: APP.isManager ? isoNow() : ''
  };

  var editingHourId = el('editHourId').value;
  if (editingHourId) {
    updateObject(TYPE_HOURS, editingHourId, data, 'Hours - ' + taskName, function(err) {
      if (err) { tool.notify('Error saving hours: ' + err, 'error'); return; }
      tool.notify('Hours updated.', 'success');
      closeModal('modalHours');
      reloadAndRender();
    });
    return;
  }

  createObject(TYPE_HOURS, 'Hours - ' + taskName, data, function(err) {
    if (err) { tool.notify('Error: ' + err, 'error'); return; }
    tool.notify('Hours saved! ' + (APP.isManager ? 'Approved automatically.' : 'Pending approval.'), 'success');
    closeModal('modalHours');
    reloadAndRender();
  });
}

function approveHours(id) {
  var h = APP.hours.find(function(x) { return x.id === id; });
  if (!h) return;
  var d = vd(h);
  var data = {};
  for (var k in d) { if (d.hasOwnProperty(k)) data[k] = d[k]; }
  data.status = 'approved';
  data.reviewedBy = APP.user ? APP.user.name : '';
  data.reviewedAt = isoNow();
  updateObject(TYPE_HOURS, id, data, h.name, function(err) {
    if (err) { tool.notify('Error: ' + err, 'error'); return; }
    tool.notify('Hours approved!', 'success');
    reloadAndRender();
  });
}

function rejectHours(id) {
  var h = APP.hours.find(function(x) { return x.id === id; });
  if (!h) return;
  showConfirm('Reject Hours?', 'Are you sure you want to reject this hour log?', function() {
    var d = vd(h);
    var data = {};
    for (var k in d) { if (d.hasOwnProperty(k)) data[k] = d[k]; }
    data.status = 'rejected';
    data.reviewedBy = APP.user ? APP.user.name : '';
    data.reviewedAt = isoNow();
    updateObject(TYPE_HOURS, id, data, h.name, function(err) {
      if (err) { tool.notify('Error: ' + err, 'error'); return; }
      tool.notify('Hours rejected.', 'info');
      reloadAndRender();
    });
  });
}

function approveAllPendingHours() {
  var pending = APP.hours.filter(function(h) { return vd(h).status === 'pending'; });
  if (pending.length === 0) { tool.notify('No pending hours to approve.', 'info'); return; }
  showConfirm('Approve All?', 'Approve all <strong>' + pending.length + '</strong> pending hour logs?', function() {
    var ops = pending.map(function(h) {
      var d = vd(h);
      var data = {};
      for (var k in d) { if (d.hasOwnProperty(k)) data[k] = d[k]; }
      data.status = 'approved';
      data.reviewedBy = APP.user ? APP.user.name : '';
      data.reviewedAt = isoNow();
      return { action: 'update', mainObjectType: TYPE_HOURS, objectId: h.id, productData: { data_categoriesBased: data } };
    });
    if (ops.length > 500) ops = ops.slice(0, 500);
    tool.requestObjects('batch', { operations: ops }, function(err) {
      if (err) { tool.notify('Batch error: ' + err, 'error'); return; }
      tool.notify(pending.length + ' hour logs approved!', 'success');
      reloadAndRender();
    });
  });
}

/* ── Actions: Messages ── */
function openMessageModal(toUserId, toName) {
  var sel = el('msgTo');
  sel.innerHTML = '';

  if (APP.isManager) {
    // Manager can message individual volunteers or broadcast
    sel.innerHTML = '<option value="all-volunteers">📢 All Approved Volunteers</option>';
    getApprovedVolunteers().forEach(function(a) {
      var d = vd(a);
      var opt = document.createElement('option');
      opt.value = d.volunteerUserId;
      opt.textContent = approvedUserName(a);
      if (toUserId && d.volunteerUserId === toUserId) opt.selected = true;
      sel.appendChild(opt);
    });
  } else {
    // Volunteer can only message managers
    sel.innerHTML = '<option value="managers">🛡️ All Event Managers</option>';
  }

  el('msgSubject').value = '';
  el('msgBody').value = '';

  if (toUserId && toName) {
    // Find in dropdown
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === toUserId) { sel.options[i].selected = true; break; }
    }
  }

  openModal('modalMessage');
}

function messageVolunteer(userId, name) {
  openMessageModal(userId, name);
}

function sendMessage() {
  var to = el('msgTo').value;
  var subject = el('msgSubject').value.trim();
  var body = el('msgBody').value.trim();

  if (!subject) { tool.notify('Please enter a subject.', 'warning'); return; }
  if (!body) { tool.notify('Please enter a message.', 'warning'); return; }
  if (body.length > 8000) { tool.notify('Message is too long - maximum 8,000 characters.', 'warning'); return; }

  var u = APP.user;
  if (!u) { tool.notify('You must be logged in.', 'error'); return; }

  // Determine recipients
  var recipientUserIds = [];
  var recipientLabel = '';

  if (to === 'managers') {
    recipientLabel = 'Event Managers';
    recipientUserIds.push('managers'); // Special marker
  } else if (to === 'all-volunteers') {
    recipientLabel = 'All Volunteers';
    getApprovedVolunteers().forEach(function(a) {
      recipientUserIds.push(vd(a).volunteerUserId);
    });
  } else {
    // Individual user
    recipientUserIds.push(to);
    var sel = el('msgTo');
    recipientLabel = sel.options[sel.selectedIndex].textContent;
  }

  var data = {
    fromUserId: u.id,
    fromName: u.name || 'Unknown',
    fromRole: APP.isManager ? 'manager' : 'volunteer',
    toUserId: to,
    toLabel: recipientLabel,
    subject: subject,
    body: body,
    sentAt: isoNow(),
    read: false
  };

  createObject(TYPE_MESSAGES, subject, data, function(err, obj) {
    if (err) { tool.notify('Error: ' + err, 'error'); return; }
    tool.notify('Message sent to ' + recipientLabel + '!', 'success');
    closeModal('modalMessage');
    reloadAndRender();
  });
}

function markMessageRead(id) {
  var m = APP.messages.find(function(x) { return x.id === id; });
  if (!m) return;
  var d = vd(m);
  if (APP.isManager && d.read === true) return;
  if (!APP.isManager && d.toUserId !== (APP.user ? APP.user.id : '') && d.toUserId !== 'managers') return;
  if (d.read === true) return;

  var data = {};
  for (var k in d) { if (d.hasOwnProperty(k)) data[k] = d[k]; }
  data.read = true;
  updateObject(TYPE_MESSAGES, id, data, m.name, function(err) {
    if (!err) {
      // Update local cache
      var cached = APP.messages.find(function(x) { return x.id === id; });
      if (cached && cached.productData && cached.productData.data_categoriesBased) {
        cached.productData.data_categoriesBased.read = true;
      }
      updateBadges();
    }
  });
}

/* ── Certificate Export ── */
function exportCertificatePDF() {
  if (!APP.myApplication || vd(APP.myApplication).status !== 'approved') {
    tool.notify('No approved volunteer record found.', 'warning');
    return;
  }

  var d = APP.myProfile ? vd(APP.myProfile) : {};
  var certName = APP.myProfile ? profileName(APP.myProfile) : (APP.user ? APP.user.name : 'Volunteer');
  var myUserId = APP.user ? APP.user.id : '';
  var totalApproved = 0;
  APP.hours.forEach(function(h) {
    var hd = vd(h);
    if (hd.volunteerUserId === myUserId && hd.status === 'approved') totalApproved += (Number(hd.hoursLogged) || 0);
  });

  var myTasks = APP.tasks.filter(function(t) { return vd(t).assignedVolunteerUserId === myUserId; });
  var completedTasks = myTasks.filter(function(t) { return vd(t).status === 'completed'; });

  var certHTML = '<div style="font-family:Georgia,serif;max-width:700px;margin:0 auto;padding:60px 40px;border:4px double #1e4e79;text-align:center;">' +
    '<div style="font-size:14px;text-transform:uppercase;letter-spacing:3px;color:#1e4e79;margin-bottom:20px;">' + esc(tool.param('orgName', 'Our Organization')) + '</div>' +
    '<h1 style="font-size:32px;color:#163a5a;margin-bottom:8px;">Certificate of Volunteer Appreciation</h1>' +
    '<p style="font-size:18px;color:#6b7280;margin-bottom:28px;">In grateful recognition of outstanding volunteer service</p>' +
    '<div style="font-size:26px;font-weight:700;color:#111827;border-bottom:2px solid #f59e0b;display:inline-block;padding:0 24px 10px;margin-bottom:24px;">' + esc(certName) + '</div>' +
    '<p style="font-size:15px;color:#374151;line-height:1.8;margin-bottom:28px;">Thank you for your dedicated service and invaluable contributions.<br>Your commitment of <strong>' + totalApproved.toFixed(1) + ' hours</strong> has made a meaningful difference.</p>' +
    '<div style="font-size:42px;font-weight:800;color:#1e4e79;margin-bottom:4px;">' + totalApproved.toFixed(1) + '</div>' +
    '<div style="font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#6b7280;">Total Volunteer Hours</div>' +
    '<p style="margin-top:20px;font-size:14px;color:#374151;"><strong>Tasks Completed:</strong> ' + completedTasks.length + ' of ' + myTasks.length + ' assigned</p>' +
    '<div style="margin-top:48px;display:flex;justify-content:space-between;text-align:left;font-size:13px;color:#6b7280;">' +
    '<div style="border-top:1px solid #9ca3af;padding-top:6px;min-width:160px;">Event Manager</div>' +
    '<div style="border-top:1px solid #9ca3af;padding-top:6px;min-width:160px;">Date: ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</div>' +
    '</div>' +
    '</div>';

  tool.requestExportPdf({
    html: certHTML,
    filename: 'volunteer-certificate-' + certName.replace(/\s+/g, '-').toLowerCase()
  }, function(err, file) {
    if (err) {
      tool.notify('PDF export failed: ' + err, 'error');
      return;
    }
    tool.notify('Certificate generated! Opening in new tab...', 'success');
    tool.openUrl(file.url);
  });
}

function emailCertificate() {
  if (!APP.myApplication || vd(APP.myApplication).status !== 'approved') {
    tool.notify('No approved volunteer record found.', 'warning');
    return;
  }

  var d = APP.myProfile ? vd(APP.myProfile) : {};
  var certName = APP.myProfile ? profileName(APP.myProfile) : (APP.user ? APP.user.name : 'Volunteer');
  var myUserId = APP.user ? APP.user.id : '';
  var totalApproved = 0;
  APP.hours.forEach(function(h) {
    var hd = vd(h);
    if (hd.volunteerUserId === myUserId && hd.status === 'approved') totalApproved += (Number(hd.hoursLogged) || 0);
  });

  var emailBody = '<h2>Volunteer Certificate</h2>' +
    '<p>Dear ' + esc(certName) + ',</p>' +
    '<p>Thank you for your volunteer service! You have completed <strong>' + totalApproved.toFixed(1) + ' hours</strong> of volunteer work.</p>' +
    '<p>To download your official certificate, please visit the event page and navigate to the Certificate tab.</p>';

  tool.requestSendEmail({
    to: (APP.user && APP.user.email) || d.email,
    subject: 'Your Volunteer Certificate - ' + totalApproved.toFixed(1) + ' Hours',
    title: 'Volunteer Certificate',
    htmlBody: emailBody
  }, function(err, result) {
    if (err) {
      tool.notify('Email failed: ' + err, 'warning');
      return;
    }
    tool.notify('Certificate email sent!', 'success');
  });
}

/* ── CSV Export ── */
function exportVolunteersCSV() {
  var rows = [['Name', 'Email', 'Profile Status', 'Event Status', 'Skills', 'Joined', 'Approved Hours']];
  APP.registry.forEach(function(p) {
    var d = vd(p);
    var app = getApplicationByUserId(d.userId);
    var totalHrs = 0;
    APP.hours.forEach(function(h) {
      var hd = vd(h);
      if (hd.volunteerUserId === d.userId && hd.status === 'approved') totalHrs += (Number(hd.hoursLogged) || 0);
    });
    rows.push([profileName(p), d.email || '', d.status || 'active', app ? vd(app).status : 'not-applied', (d.skills || '').replace(/,/g, ';'), d.joinedAt || '', totalHrs.toFixed(1)]);
  });
  var csv = rows.map(function(r) { return r.map(function(c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');

  // Export via PDF with CSV content as HTML pre
  var csvHTML = '<pre style="font-family:monospace;white-space:pre-wrap;">' + esc(csv) + '</pre>';
  tool.requestExportPdf({ html: csvHTML, filename: 'volunteers-export' }, function(err, file) {
    if (err) {
      tool.notify('CSV export failed: ' + err, 'warning');
      return;
    }
    tool.notify('CSV exported!', 'success');
    tool.openUrl(file.url);
  });
}

/* ── Modal Helpers ── */
function openModal(id) {
  var overlay = el(id);
  if (overlay) overlay.classList.add('open');
}
function closeModal(id) {
  var overlay = el(id);
  if (overlay) overlay.classList.remove('open');
}

function showConfirm(title, body, cb) {
  el('confirmTitle').textContent = title;
  el('confirmBody').innerHTML = body;
  APP._confirmCb = cb;
  openModal('modalConfirm');
}

/* ── Reload & Render ── */
function reloadAndRender() {
  loadAllData(function() {
    renderCurrentTab();
    updateBadges();
  });
}

/* ── Read-only / Lock ── */
function lockUI(ro) {
  APP.readOnly = !!ro;
  // Disable action buttons in read-only mode
  qsa('.quick-actions').forEach(function(el) {
    if (ro) el.style.display = 'none';
    else el.style.display = '';
  });
  // Disable table action buttons
  qsa('.actions-cell button').forEach(function(btn) {
    btn.disabled = ro;
  });
}

/* ── Initialize ── */
tool.declareParams([
  {
    name: 'registryType',
    label: 'Volunteer Registry Type ID',
    type: 'text',
    default: 'volunteerRegistry-uniconbaseapps',
    hint: 'CMS object type for volunteer profiles (shared registry SSOT). Also authorize it in settings.allowedObjectTypes.',
    severity: 'goodToHave'
  },
  {
    name: 'eventsType',
    label: 'Events Type ID',
    type: 'text',
    default: 'vm.events-uniconbaseapps',
    hint: 'CMS object type for event definitions (shared events SSOT). Also authorize it in settings.allowedObjectTypes.',
    severity: 'goodToHave'
  },
  {
    name: 'eventId',
    label: 'Linked Event Definition ID',
    type: 'text',
    default: '',
    hint: 'Optional: the event definition this tool instance works on. Can also be picked in the Events tab.',
    severity: 'optional'
  },
  {
    name: 'orgName',
    label: 'Organization Name',
    type: 'text',
    default: 'Our Organization',
    hint: 'Name displayed on volunteer certificates.',
    severity: 'goodToHave'
  },
  {
    name: 'eventName',
    label: 'Event Name',
    type: 'text',
    default: '',
    hint: 'Optional event name override. Defaults to the host object name.',
    severity: 'optional'
  }
]);

tool.declareOutput({
  type: 'object',
  properties: {
    lastTab: { type: 'string' },
    currentEventId: { type: 'string' }
  }
});

tool.onReady(function(val, fields) {
  // Detect user
  APP.user = tool.getUser();

  // Detect role
  APP.isManager = detectRole() === 'manager';
  APP.readOnly = tool.isReadOnly();

  // Show user info in top bar
  updateTopBarIdentity();
  updateManagerOnlyNavigation();

  // Host event name (fallback when no event definition is selected)
  var eventName = tool.param('eventName', '');
  if (!eventName && fields && fields.name) eventName = fields.name;
  APP.hostEventName = eventName || 'Event';

  // Event definition this instance works on
  APP.currentEventId = (val && val.currentEventId) || tool.param('eventId', '') || '';
  renderEventHeader();

  // Missing registry authorization is reported by reportRegistryConfigError()
  // when the registry query fails (see loadAllData).

  // Load permitted users
  try {
    APP.permittedUsers = tool.getPermittedUsers() || [];
  } catch(e) { APP.permittedUsers = []; }

  tool.onPermittedUsersChange(function(users) {
    APP.permittedUsers = users || [];
  });

  // Read-only
  if (APP.readOnly) lockUI(true);
  tool.onReadonlyChange(function(ro) { lockUI(ro); });

  // User change
  tool.onUserChange(function(u) {
    APP.user = u;
    APP.isManager = detectRole() === 'manager';
    updateTopBarIdentity();
    updateManagerOnlyNavigation();
    if (!APP.isManager && APP.currentTab === 'events') switchTab('dashboard');
    findMyRecords();
    renderCurrentTab();
  });

  // Restore last tab from value
  if (val && val.lastTab) {
    APP.currentTab = val.lastTab;
  }
  if (!APP.isManager && APP.currentTab === 'events') APP.currentTab = 'dashboard';

  // Tab click handlers
  qsa('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var tab = this.getAttribute('data-tab');
      // Clicking Events / Volunteers in the side menu always shows the list;
      // the sub item below it re-opens the selected event / volunteer.
      if (tab === 'events') APP.eventManageOpen = false;
      if (tab === 'volunteers') APP.volunteerDetailOpen = false;
      switchTab(tab);
      // Persist tab preference and selected event
      persistToolValue();
    });
  });

  // Confirm modal button
  el('confirmBtn').addEventListener('click', function() {
    closeModal('modalConfirm');
    if (APP._confirmCb) {
      var cb = APP._confirmCb;
      APP._confirmCb = null;
      cb();
    }
  });

  // Message refresh button
  el('msgRefreshBtn').addEventListener('click', function() {
    queryObjects(TYPE_MESSAGES, function(err, objs) {
      APP.messages = objs || [];
      APP.loaded.messages = true;
      renderMessages();
      updateBadges();
    });
  });

  // Close modals on overlay click
  qsa('.modal-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // Load data and render
  loadAllData(function() {
    renderCurrentTab();
    updateBadges();
    tool.resize();
  });

  // Report valid
  tool.reportValid(true, '');
});
