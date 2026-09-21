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

/* ── CMS Type Names ── */
var TYPE_VOLUNTEERS = 'vm.volunteers-uniconbaseapps';
var TYPE_TASKS      = 'vm.tasks-uniconbaseapps';
var TYPE_HOURS      = 'vm.hours-uniconbaseapps';
var TYPE_MESSAGES   = 'vm.messages-uniconbaseapps';

/* ── State ── */
var APP = {
  user: null,
  isManager: false,
  readOnly: false,
  currentTab: 'dashboard',

  // Data caches
  volunteers: [],      // volunteer registration records
  tasks: [],           // task records
  hours: [],           // hour log records
  messages: [],        // message records
  permittedUsers: [],  // from tool.getPermittedUsers()

  // My volunteer record (if current user is registered)
  myVolunteer: null,

  // Data loaded flags
  loaded: { volunteers: false, tasks: false, hours: false, messages: false },

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
function loadAllData(cb) {
  var pending = 4;
  function done() { pending--; if (pending <= 0 && cb) cb(); }

  queryObjects(TYPE_VOLUNTEERS, function(err, objs) {
    APP.volunteers = objs || [];
    APP.loaded.volunteers = true;
    findMyVolunteer();
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
}

function findMyVolunteer() {
  if (!APP.user) { APP.myVolunteer = null; return; }
  var uid = APP.user.id;
  APP.myVolunteer = null;
  for (var i = 0; i < APP.volunteers.length; i++) {
    var v = APP.volunteers[i];
    var d = (v.productData && v.productData.data_categoriesBased) ? v.productData.data_categoriesBased : {};
    if (d.userId === uid) { APP.myVolunteer = v; return; }
  }
}

/* ── Get data helpers ── */
function vd(v) { return (v && v.productData && v.productData.data_categoriesBased) ? v.productData.data_categoriesBased : {}; }

function getApprovedVolunteers() {
  return APP.volunteers.filter(function(v) { return vd(v).status === 'approved'; });
}

function getVolunteerByUserId(uid) {
  for (var i = 0; i < APP.volunteers.length; i++) {
    if (vd(APP.volunteers[i]).userId === uid) return APP.volunteers[i];
  }
  return null;
}

function getVolunteerName(volunteerObj) {
  var d = vd(volunteerObj);
  return d.userName || volunteerObj.name || 'Unknown';
}

function getTaskById(id) {
  for (var i = 0; i < APP.tasks.length; i++) {
    if (APP.tasks[i].id === id) return APP.tasks[i];
  }
  return null;
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

  renderCurrentTab();
  tool.resize();
}

function renderCurrentTab() {
  switch (APP.currentTab) {
    case 'dashboard': renderDashboard(); break;
    case 'volunteers': renderVolunteers(); break;
    case 'tasks': renderTasks(); break;
    case 'hours': renderHours(); break;
    case 'messages': renderMessages(); break;
    case 'certificate': renderCertificate(); break;
  }
}

/* ── UI: Dashboard ── */
function renderDashboard() {
  // Stats
  var approved = getApprovedVolunteers();
  var totalVols = APP.volunteers.length;
  var pendingVols = APP.volunteers.filter(function(v) { return vd(v).status === 'pending'; }).length;
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
    statsHtml += '<div class="stat-card"><div class="stat-icon" style="background:#d1fae5;">👥</div><div class="stat-value">' + approved.length + '</div><div class="stat-label">Approved Volunteers</div></div>';
    statsHtml += '<div class="stat-card"><div class="stat-icon" style="background:#fef3c7;">⏳</div><div class="stat-value">' + pendingVols + '</div><div class="stat-label">Pending Approvals</div></div>';
  }
  statsHtml += '<div class="stat-card"><div class="stat-icon" style="background:#dbeafe;">📋</div><div class="stat-value">' + openTasks + '</div><div class="stat-label">Active Tasks</div></div>';
  statsHtml += '<div class="stat-card"><div class="stat-icon" style="background:#d1fae5;">✅</div><div class="stat-value">' + completedTasks + '</div><div class="stat-label">Completed Tasks</div></div>';
  statsHtml += '<div class="stat-card"><div class="stat-icon" style="background:#ede9fe;">⏱️</div><div class="stat-value">' + totalHours.toFixed(1) + '</div><div class="stat-label">Total Approved Hours</div></div>';
  statsHtml += '<div class="stat-card"><div class="stat-icon" style="background:#fee2e2;">💬</div><div class="stat-value">' + unreadMsgs + '</div><div class="stat-label">Unread Messages</div></div>';
  el('dashStats').innerHTML = statsHtml;

  // My Status
  var myStatus = el('dashMyStatus');
  var myStatusBody = el('dashMyStatusBody');
  if (!APP.isManager) {
    if (APP.myVolunteer) {
      var md = vd(APP.myVolunteer);
      var statusClass = 'badge-' + md.status;
      myStatus.style.display = '';
      myStatusBody.innerHTML =
        '<p><strong>Status:</strong> <span class="badge ' + statusClass + '">' + esc(md.status) + '</span></p>' +
        (md.skills ? '<p><strong>Skills:</strong> ' + esc(md.skills) + '</p>' : '') +
        (md.reviewedAt ? '<p><strong>Reviewed:</strong> ' + fmtDate(md.reviewedAt) + ' by ' + esc(md.reviewedBy || '—') + '</p>' : '');
      if (md.status === 'rejected') {
        myStatusBody.innerHTML += '<button class="btn btn-sm btn-primary" style="margin-top:8px;" onclick="openRegisterModal()">🔄 Re-apply</button>';
      }
    } else {
      myStatus.style.display = '';
      myStatusBody.innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">🙋</div><h4>Not Registered Yet</h4><p>Join as a volunteer for this event! Click below to submit your registration.</p>' +
        '<button class="btn btn-primary btn-lg" onclick="openRegisterModal()">🙋 Register as Volunteer</button></div>';
    }
  } else {
    myStatus.style.display = 'none';
  }

  // Pending Approvals (manager only)
  var pendingDiv = el('dashPendingApprovals');
  if (APP.isManager && pendingVols > 0) {
    pendingDiv.style.display = '';
    var pendHTML = '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Skills</th><th>Applied</th><th></th></tr></thead><tbody>';
    APP.volunteers.forEach(function(v) {
      var d = vd(v);
      if (d.status !== 'pending') return;
      pendHTML += '<tr>' +
        '<td><strong>' + esc(d.userName || v.name) + '</strong></td>' +
        '<td>' + esc(d.userEmail || '') + '</td>' +
        '<td>' + esc((d.skills || '').slice(0, 60)) + '</td>' +
        '<td>' + fmtDate(d.registeredAt) + '</td>' +
        '<td><button class="btn btn-sm btn-success" onclick="approveVolunteer(\'' + v.id + '\')">✅ Approve</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="rejectVolunteer(\'' + v.id + '\')">❌ Reject</button></td>' +
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
      else if (d.assignedToUserId === (APP.user ? APP.user.id : '')) myTasks.push(t);
    } else {
      if (d.assignedToUserId === (APP.user ? APP.user.id : '')) myTasks.push(t);
    }
  });
  if (myTasks.length === 0) {
    myTaskHTML = '<div class="empty-state"><p>No upcoming tasks.</p></div>';
  } else {
    myTaskHTML = '<div class="table-wrap"><table><thead><tr><th>Task</th><th>Status</th><th>Assigned To</th><th>Due</th><th>Est. Hours</th></tr></thead><tbody>';
    myTasks.forEach(function(t) {
      var d = vd(t);
      myTaskHTML += '<tr>' +
        '<td><strong>' + esc(t.name) + '</strong></td>' +
        '<td><span class="badge badge-' + d.status + '">' + esc(d.status) + '</span></td>' +
        '<td>' + esc(d.assignedToName || '—') + '</td>' +
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

/* ── UI: Volunteers ── */
function renderVolunteers() {
  var actHTML = '';
  if (!APP.isManager && !APP.myVolunteer) {
    actHTML += '<button class="btn btn-primary" onclick="openRegisterModal()">🙋 Register as Volunteer</button>';
  }
  if (APP.isManager) {
    actHTML += '<button class="btn btn-primary" onclick="openRegisterModal()">➕ Add Volunteer</button> ';
    actHTML += '<button class="btn btn-outline" onclick="exportVolunteersCSV()">📥 Export CSV</button>';
  }
  el('volActions').innerHTML = actHTML;

  var filter = el('volFilterStatus').value || 'all';
  var filtered = APP.volunteers.filter(function(v) {
    if (filter === 'all') return true;
    return vd(v).status === filter;
  });

  // If not manager, only show own record
  if (!APP.isManager) {
    filtered = APP.myVolunteer ? [APP.myVolunteer] : [];
    el('volListTitle').textContent = 'My Volunteer Status';
    el('volFilterStatus').style.display = 'none';
  } else {
    el('volListTitle').textContent = 'All Volunteers (' + filtered.length + ')';
    el('volFilterStatus').style.display = '';
  }

  var html = '';
  if (filtered.length === 0) {
    html = '<div class="empty-state"><div class="empty-state-icon">👥</div><h4>No Volunteers Found</h4><p>' + (APP.isManager ? 'Volunteers will appear here once they register.' : 'You haven\'t registered as a volunteer yet.') + '</p></div>';
  } else if (APP.isManager) {
    // Manager view: table
    html = '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Skills</th><th>Registered</th><th>Total Hours</th><th></th></tr></thead><tbody>';
    filtered.forEach(function(v) {
      var d = vd(v);
      var totalHrs = 0;
      APP.hours.forEach(function(h) {
        var hd = vd(h);
        if (hd.volunteerUserId === d.userId && hd.status === 'approved') totalHrs += (Number(hd.hoursLogged) || 0);
      });
      html += '<tr>' +
        '<td><strong>' + esc(d.userName || v.name) + '</strong></td>' +
        '<td>' + esc(d.userEmail || '') + '</td>' +
        '<td><span class="badge badge-' + d.status + '">' + esc(d.status) + '</span></td>' +
        '<td>' + esc((d.skills || '').slice(0, 50)) + '</td>' +
        '<td>' + fmtDate(d.registeredAt) + '</td>' +
        '<td><strong>' + totalHrs.toFixed(1) + ' hrs</strong></td>' +
        '<td class="actions-cell">';
      if (d.status === 'pending') {
        html += '<button class="btn btn-sm btn-success" onclick="approveVolunteer(\'' + v.id + '\')">✅ Approve</button> ';
        html += '<button class="btn btn-sm btn-danger" onclick="rejectVolunteer(\'' + v.id + '\')">❌ Reject</button>';
      } else if (d.status === 'approved') {
        html += '<button class="btn btn-sm btn-outline" onclick="messageVolunteer(\'' + escJs(d.userId) + '\',\'' + escJs(d.userName || '') + '\')">💬 Message</button> ';
        html += '<button class="btn btn-sm btn-outline" onclick="viewVolunteerTasks(\'' + d.userId + '\')">📋 Tasks</button>';
      }
      html += '</td></tr>';
    });
    html += '</tbody></table></div>';
  } else if (APP.myVolunteer) {
    // Volunteer view: card
    var d = vd(APP.myVolunteer);
    var totalHrs = 0;
    APP.hours.forEach(function(h) {
      var hd = vd(h);
      if (hd.volunteerUserId === d.userId && hd.status === 'approved') totalHrs += (Number(hd.hoursLogged) || 0);
    });
    html = '<div class="volunteer-card">' +
      '<div class="vol-card-header">' +
      '<div class="vol-card-avatar">' + (d.userName || '?').charAt(0).toUpperCase() + '</div>' +
      '<div><div class="vol-card-name">' + esc(d.userName) + '</div><div class="vol-card-email">' + esc(d.userEmail || '') + '</div></div>' +
      '</div>' +
      '<p><strong>Status:</strong> <span class="badge badge-' + d.status + '">' + esc(d.status) + '</span></p>' +
      (d.skills ? '<div class="vol-card-skills">' + d.skills.split(',').map(function(s) { return '<span class="skill-tag">' + esc(s.trim()) + '</span>'; }).join('') + '</div>' : '') +
      '<p style="margin-top:8px;"><strong>Availability:</strong> ' + esc(d.availabilityNotes || 'Not specified') + '</p>' +
      '<p><strong>Motivation:</strong> ' + esc(d.motivation || 'Not specified') + '</p>' +
      '<div class="vol-card-footer">' +
      '<span><strong>Total Hours:</strong> ' + totalHrs.toFixed(1) + ' hrs</span>' +
      '<span>Registered: ' + fmtDate(d.registeredAt) + '</span>' +
      '</div>';
    if (d.status === 'rejected') {
      html += '<button class="btn btn-sm btn-primary" style="margin-top:8px;" onclick="openRegisterModal()">🔄 Re-apply</button>';
    }
    html += '</div>';
  }
  el('volList').innerHTML = html;
  updateBadges();
  tool.resize();
}

/* ── UI: Tasks ── */
function renderTasks() {
  var actHTML = '';
  if (APP.isManager) {
    actHTML += '<button class="btn btn-primary" onclick="openTaskModal()">➕ Create Task</button> ';
  }
  if (APP.myVolunteer && vd(APP.myVolunteer).status === 'approved') {
    actHTML += '<button class="btn btn-accent" onclick="openHoursModal()">⏱️ Log Hours</button>';
  }
  el('taskActions').innerHTML = actHTML;

  var statusFilter = el('taskFilterStatus').value || 'all';
  var assigneeFilter = el('taskFilterAssignee').value || 'all';

  var filtered = APP.tasks.filter(function(t) {
    var d = vd(t);
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (assigneeFilter === 'me') {
      return d.assignedToUserId === (APP.user ? APP.user.id : '');
    }
    if (assigneeFilter === 'unassigned') {
      return !d.assignedToUserId;
    }
    return true;
  });

  // For non-managers, only show their tasks
  if (!APP.isManager) {
    filtered = filtered.filter(function(t) {
      return vd(t).assignedToUserId === (APP.user ? APP.user.id : '');
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
        '<strong>Assigned:</strong> ' + esc(d.assignedToName || 'Unassigned') + ' · ' +
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
        if (d.assignedToUserId === (APP.user ? APP.user.id : '')) {
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
  if (APP.myVolunteer && vd(APP.myVolunteer).status === 'approved') {
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
      getApprovedVolunteers().forEach(function(v) {
        var d = vd(v);
        var opt = document.createElement('option');
        opt.value = d.userId;
        opt.textContent = d.userName || v.name;
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
        '<td>' + esc(d.volunteerName || '') + '</td>' +
        '<td>' + esc(d.taskName || '—') + '</td>' +
        '<td><strong>' + (Number(d.hoursLogged) || 0).toFixed(1) + '</strong></td>' +
        '<td>' + esc((d.description || '').slice(0, 60)) + '</td>' +
        '<td><span class="badge badge-' + d.status + '">' + esc(d.status) + '</span></td>' +
        '<td class="actions-cell">';
      if (APP.isManager && d.status === 'pending') {
        html += '<button class="btn btn-sm btn-success" onclick="approveHours(\'' + h.id + '\')">✅</button> ';
        html += '<button class="btn btn-sm btn-danger" onclick="rejectHours(\'' + h.id + '\')">❌</button>';
      }
      html += '</td></tr>';
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
  } else if (!APP.myVolunteer) {
    html = '<div class="empty-state"><div class="empty-state-icon">🙋</div><h4>Not a Volunteer</h4><p>You need to register and be approved as a volunteer first.</p></div>';
  } else if (vd(APP.myVolunteer).status !== 'approved') {
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
      return vd(t).assignedToUserId === myUserId;
    });
    var completedTasks = myTasks.filter(function(t) { return vd(t).status === 'completed'; });

    var d = vd(APP.myVolunteer);

    // Certificate preview
    html = '<div class="cert-preview" id="certPreview">' +
      '<div class="cert-org">' + esc(tool.param('orgName', 'Our Organization')) + '</div>' +
      '<div class="cert-title">Certificate of Volunteer Appreciation</div>' +
      '<div class="cert-subtitle">In grateful recognition of outstanding volunteer service</div>' +
      '<div class="cert-name">' + esc(d.userName || APP.user.name) + '</div>' +
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
  var pendingVols = APP.volunteers.filter(function(v) { return vd(v).status === 'pending'; }).length;
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
    bv.textContent = APP.isManager ? pendingVols : (APP.volunteers.length || '0');
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
  if (APP.myVolunteer && vd(APP.myVolunteer).status !== 'rejected') {
    tool.notify('You are already registered. Status: ' + vd(APP.myVolunteer).status, 'info');
    return;
  }
  el('regSkills').value = APP.myVolunteer ? (vd(APP.myVolunteer).skills || '') : '';
  el('regAvailability').value = APP.myVolunteer ? (vd(APP.myVolunteer).availabilityNotes || '') : '';
  el('regMotivation').value = APP.myVolunteer ? (vd(APP.myVolunteer).motivation || '') : '';
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

  var u = APP.user;
  if (!u) { tool.notify('You must be logged in.', 'error'); return; }

  var data = {
    userId: u.id,
    userName: u.name || 'Unknown',
    userEmail: u.email || '',
    status: APP.isManager ? 'approved' : 'pending',  // Managers auto-approve themselves
    registeredAt: isoNow(),
    skills: skills,
    availabilityNotes: availability,
    motivation: motivation,
    reviewedAt: APP.isManager ? isoNow() : '',
    reviewedBy: APP.isManager ? (u.name || 'Self') : ''
  };

  if (APP.myVolunteer && vd(APP.myVolunteer).status === 'rejected') {
    // Update existing rejected record
    data.status = 'pending';
    updateObject(TYPE_VOLUNTEERS, APP.myVolunteer.id, data, u.name || 'Volunteer', function(err) {
      if (err) { tool.notify('Error: ' + err, 'error'); return; }
      tool.notify('Re-application submitted!', 'success');
      closeModal('modalRegister');
      reloadAndRender();
    });
  } else {
    createObject(TYPE_VOLUNTEERS, u.name || 'Volunteer', data, function(err, obj) {
      if (err) { tool.notify('Error: ' + err, 'error'); return; }
      tool.notify(APP.isManager ? 'Volunteer added!' : 'Registration submitted! Waiting for approval.', 'success');
      closeModal('modalRegister');
      reloadAndRender();
    });
  }
}

function approveVolunteer(id) {
  var v = APP.volunteers.find(function(x) { return x.id === id; });
  if (!v) return;
  var u = APP.user;
  var data = vd(v);
  data.status = 'approved';
  data.reviewedAt = isoNow();
  data.reviewedBy = u ? u.name : 'Manager';
  updateObject(TYPE_VOLUNTEERS, id, data, v.name, function(err) {
    if (err) { tool.notify('Error: ' + err, 'error'); return; }
    tool.notify(data.userName + ' approved!', 'success');
    reloadAndRender();
  });
}

function rejectVolunteer(id) {
  var v = APP.volunteers.find(function(x) { return x.id === id; });
  if (!v) return;
  showConfirm('Reject Volunteer?', 'Are you sure you want to reject <strong>' + esc(vd(v).userName || v.name) + '</strong>?', function() {
    var u = APP.user;
    var data = vd(v);
    data.status = 'rejected';
    data.reviewedAt = isoNow();
    data.reviewedBy = u ? u.name : 'Manager';
    updateObject(TYPE_VOLUNTEERS, id, data, v.name, function(err) {
      if (err) { tool.notify('Error: ' + err, 'error'); return; }
      tool.notify(data.userName + ' rejected.', 'info');
      reloadAndRender();
    });
  });
}

/* ── Actions: Tasks ── */
function openTaskModal(taskId) {
  // Populate assignee dropdown
  var sel = el('taskAssignee');
  sel.innerHTML = '<option value="">-- Unassigned (Open) --</option>';
  getApprovedVolunteers().forEach(function(v) {
    var d = vd(v);
    var opt = document.createElement('option');
    opt.value = d.userId;
    opt.textContent = d.userName || v.name;
    sel.appendChild(opt);
  });

  if (taskId) {
    var t = getTaskById(taskId);
    if (!t) return;
    var d = vd(t);
    el('modalTaskTitle').textContent = '✏️ Edit Task';
    el('editTaskId').value = taskId;
    el('taskName').value = t.name || '';
    el('taskDesc').value = d.description || '';
    el('taskAssignee').value = d.assignedToUserId || '';
    el('taskDueDate').value = (d.dueDate || '').slice(0, 10);
    el('taskEstHours').value = d.estimatedHours || '';
    el('taskStatus').value = d.status || 'open';
    el('btnSaveTask').textContent = 'Update Task';
  } else {
    el('modalTaskTitle').textContent = '📋 Create Task';
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

  var assigneeUserId = el('taskAssignee').value;
  var assigneeName = '';
  if (assigneeUserId) {
    var sel = el('taskAssignee');
    assigneeName = sel.options[sel.selectedIndex].textContent;
  }

  var data = {
    description: el('taskDesc').value.trim(),
    status: el('taskStatus').value,
    assignedToUserId: assigneeUserId,
    assignedToName: assigneeName,
    dueDate: el('taskDueDate').value ? el('taskDueDate').value + 'T00:00:00Z' : '',
    estimatedHours: parseFloat(el('taskEstHours').value) || 0,
    createdBy: APP.user ? APP.user.name : '',
    createdAt: isoNow(),
    completedAt: el('taskStatus').value === 'completed' ? isoNow() : ''
  };

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

/* ── Actions: Hours ── */
function openHoursModal(taskId) {
  // Populate task dropdown with tasks assigned to current user
  var sel = el('hourTaskId');
  sel.innerHTML = '<option value="">-- Select Task --</option>';
  APP.tasks.forEach(function(t) {
    var d = vd(t);
    if (d.assignedToUserId === (APP.user ? APP.user.id : '') && d.status !== 'cancelled') {
      var opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      if (taskId && t.id === taskId) opt.selected = true;
      sel.appendChild(opt);
    }
  });
  // Also add option for general volunteering if manager
  if (APP.isManager) {
    APP.tasks.forEach(function(t) {
      var d = vd(t);
      if (d.status !== 'cancelled') {
        var exists = false;
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === t.id) { exists = true; break; }
        }
        if (!exists) {
          var opt = document.createElement('option');
          opt.value = t.id;
          opt.textContent = t.name;
          sel.appendChild(opt);
        }
      }
    });
  }

  el('editHourId').value = '';
  el('hourDate').value = new Date().toISOString().slice(0, 10);
  el('hourAmount').value = '';
  el('hourDesc').value = '';
  el('btnSaveHours').textContent = 'Log Hours';
  openModal('modalHours');
}

function logHoursForTask(taskId) {
  openHoursModal(taskId);
}

function saveHours() {
  var taskId = el('hourTaskId').value;
  var date = el('hourDate').value;
  var amount = parseFloat(el('hourAmount').value);
  var desc = el('hourDesc').value.trim();

  if (!taskId) { tool.notify('Please select a task.', 'warning'); return; }
  if (!date) { tool.notify('Please select a date.', 'warning'); return; }
  if (!amount || amount <= 0) { tool.notify('Please enter valid hours.', 'warning'); return; }

  var t = getTaskById(taskId);
  var taskName = t ? t.name : 'General';
  var u = APP.user;
  var v = APP.myVolunteer;

  var data = {
    volunteerId: v ? v.id : '',
    volunteerUserId: u ? u.id : '',
    volunteerName: u ? u.name : 'Unknown',
    taskId: taskId,
    taskName: taskName,
    date: date + 'T00:00:00Z',
    hoursLogged: amount,
    description: desc,
    status: APP.isManager ? 'approved' : 'pending',
    reviewedBy: APP.isManager ? (u ? u.name : '') : '',
    reviewedAt: APP.isManager ? isoNow() : ''
  };

  createObject(TYPE_HOURS, 'Hours - ' + taskName, data, function(err, obj) {
    if (err) { tool.notify('Error: ' + err, 'error'); return; }
    tool.notify('Hours logged! ' + (APP.isManager ? 'Auto-approved.' : 'Pending approval.'), 'success');
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
    getApprovedVolunteers().forEach(function(v) {
      var d = vd(v);
      var opt = document.createElement('option');
      opt.value = d.userId;
      opt.textContent = d.userName || v.name;
      if (toUserId && d.userId === toUserId) opt.selected = true;
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
    getApprovedVolunteers().forEach(function(v) {
      recipientUserIds.push(vd(v).userId);
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
  if (!APP.myVolunteer || vd(APP.myVolunteer).status !== 'approved') {
    tool.notify('No approved volunteer record found.', 'warning');
    return;
  }

  var d = vd(APP.myVolunteer);
  var myUserId = APP.user ? APP.user.id : '';
  var totalApproved = 0;
  APP.hours.forEach(function(h) {
    var hd = vd(h);
    if (hd.volunteerUserId === myUserId && hd.status === 'approved') totalApproved += (Number(hd.hoursLogged) || 0);
  });

  var myTasks = APP.tasks.filter(function(t) { return vd(t).assignedToUserId === myUserId; });
  var completedTasks = myTasks.filter(function(t) { return vd(t).status === 'completed'; });

  var certHTML = '<div style="font-family:Georgia,serif;max-width:700px;margin:0 auto;padding:60px 40px;border:4px double #0d7377;text-align:center;">' +
    '<div style="font-size:14px;text-transform:uppercase;letter-spacing:3px;color:#0d7377;margin-bottom:20px;">' + esc(tool.param('orgName', 'Our Organization')) + '</div>' +
    '<h1 style="font-size:32px;color:#0a5558;margin-bottom:8px;">Certificate of Volunteer Appreciation</h1>' +
    '<p style="font-size:18px;color:#6b7280;margin-bottom:28px;">In grateful recognition of outstanding volunteer service</p>' +
    '<div style="font-size:26px;font-weight:700;color:#111827;border-bottom:2px solid #f59e0b;display:inline-block;padding:0 24px 10px;margin-bottom:24px;">' + esc(d.userName || (APP.user ? APP.user.name : 'Volunteer')) + '</div>' +
    '<p style="font-size:15px;color:#374151;line-height:1.8;margin-bottom:28px;">Thank you for your dedicated service and invaluable contributions.<br>Your commitment of <strong>' + totalApproved.toFixed(1) + ' hours</strong> has made a meaningful difference.</p>' +
    '<div style="font-size:42px;font-weight:800;color:#0d7377;margin-bottom:4px;">' + totalApproved.toFixed(1) + '</div>' +
    '<div style="font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#6b7280;">Total Volunteer Hours</div>' +
    '<p style="margin-top:20px;font-size:14px;color:#374151;"><strong>Tasks Completed:</strong> ' + completedTasks.length + ' of ' + myTasks.length + ' assigned</p>' +
    '<div style="margin-top:48px;display:flex;justify-content:space-between;text-align:left;font-size:13px;color:#6b7280;">' +
    '<div style="border-top:1px solid #9ca3af;padding-top:6px;min-width:160px;">Event Manager</div>' +
    '<div style="border-top:1px solid #9ca3af;padding-top:6px;min-width:160px;">Date: ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</div>' +
    '</div>' +
    '</div>';

  tool.requestExportPdf({
    html: certHTML,
    filename: 'volunteer-certificate-' + (d.userName || 'volunteer').replace(/\s+/g, '-').toLowerCase()
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
  if (!APP.myVolunteer || vd(APP.myVolunteer).status !== 'approved') {
    tool.notify('No approved volunteer record found.', 'warning');
    return;
  }

  var d = vd(APP.myVolunteer);
  var myUserId = APP.user ? APP.user.id : '';
  var totalApproved = 0;
  APP.hours.forEach(function(h) {
    var hd = vd(h);
    if (hd.volunteerUserId === myUserId && hd.status === 'approved') totalApproved += (Number(hd.hoursLogged) || 0);
  });

  var emailBody = '<h2>Volunteer Certificate</h2>' +
    '<p>Dear ' + esc(d.userName || 'Volunteer') + ',</p>' +
    '<p>Thank you for your volunteer service! You have completed <strong>' + totalApproved.toFixed(1) + ' hours</strong> of volunteer work.</p>' +
    '<p>To download your official certificate, please visit the event page and navigate to the Certificate tab.</p>';

  tool.requestSendEmail({
    to: APP.user ? APP.user.email : d.userEmail,
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
  var rows = [['Name', 'Email', 'Status', 'Skills', 'Registered', 'Approved Hours']];
  APP.volunteers.forEach(function(v) {
    var d = vd(v);
    var totalHrs = 0;
    APP.hours.forEach(function(h) {
      var hd = vd(h);
      if (hd.volunteerUserId === d.userId && hd.status === 'approved') totalHrs += (Number(hd.hoursLogged) || 0);
    });
    rows.push([d.userName || v.name, d.userEmail || '', d.status, (d.skills || '').replace(/,/g, ';'), d.registeredAt || '', totalHrs.toFixed(1)]);
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
    lastTab: { type: 'string' }
  }
});

tool.onReady(function(val, fields) {
  // Detect user
  APP.user = tool.getUser();

  // Detect role
  APP.isManager = detectRole() === 'manager';
  APP.readOnly = tool.isReadOnly();

  // Show user info in top bar
  if (APP.user) {
    el('topUserName').textContent = APP.user.name || APP.user.email || 'User';
  } else {
    el('topUserName').textContent = 'Not logged in';
  }

  var roleBadge = el('topRoleBadge');
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

  // Event name
  var eventName = tool.param('eventName', '');
  if (!eventName && fields && fields.name) eventName = fields.name;
  if (!eventName) eventName = 'Event';
  el('topEventName').textContent = eventName;

  // Report missing params
  var missing = [];
  if (missing.length > 0) {
    tool.reportMissingParams(missing, 'Configure these parameters to enable full functionality.');
  }

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
    if (APP.user) {
      el('topUserName').textContent = APP.user.name || APP.user.email || 'User';
    }
    var roleBadge = el('topRoleBadge');
    if (APP.isManager) {
      roleBadge.textContent = 'Event Manager';
      roleBadge.className = 'top-bar-role role-manager';
    } else if (APP.user) {
      roleBadge.textContent = 'Volunteer';
      roleBadge.className = 'top-bar-role role-volunteer';
    }
    findMyVolunteer();
    renderCurrentTab();
  });

  // Restore last tab from value
  if (val && val.lastTab) {
    APP.currentTab = val.lastTab;
  }

  // Tab click handlers
  qsa('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var tab = this.getAttribute('data-tab');
      switchTab(tab);
      // Persist tab preference
      try { tool.setValue({ lastTab: tab }); } catch(e) {}
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
