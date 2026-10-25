/* VolunteerProfile
   One tool instance = one volunteer profile object (host object).
   Volunteer sees and maintains their own record; a manager sees any record.

   Object model (5 CMS object types, no array-contains queries):
     Person         volunteer-registry-uniconbaseapps      (this tool's host object)
     Event          vm-events-uniconbaseapps
     Membership     vm-event-memberships-uniconbaseapps    id = personId + '__' + eventId
     Event Tasks    vm-event-tasks-uniconbaseapps          id = eventId + '__tasks'
     Event Messages vm-event-messages-uniconbaseapps       id = eventId + '__messages' (+ '#2', '#3' ...)
*/

/* ---------------- object types ---------------- */
var DEFAULT_TYPES = {
  person: 'volunteer-registry-uniconbaseapps',
  event: 'vm-events-uniconbaseapps',
  relation: 'vm-event-memberships-uniconbaseapps',
  tasks: 'vm-event-tasks-uniconbaseapps',
  messages: 'vm-event-messages-uniconbaseapps'
};

/* ---------------- state ---------------- */
var APP = {
  user: null,
  isManager: false,
  readOnly: false,
  view: 'dashboard',
  savedValue: null,

  hostObjectId: '',
  profileObject: null,
  profileData: {},

  events: [],
  relations: [],
  allRelations: [],
  persons: [],
  networkFilter: 'all',
  tasksDocs: [],
  messageDocs: [],

  selectedEventId: '',
  catalogSearch: '',
  catalogType: 'all',
  pendingAfterLoad: null,
  timerTicker: null,
  loading: true,
  loadError: '',
  toastTimer: null
};

/* ---------------- small helpers ---------------- */
function el(id) { return document.getElementById(id); }

function esc(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escJs(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

function vd(object) {
  if (!object || !object.productData || !object.productData.data_categoriesBased) return {};
  return object.productData.data_categoriesBased;
}

function isoNow() { return new Date().toISOString(); }

function todayIso() {
  var date = new Date();
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
}

function toNumber(value) {
  var parsed = Number(value);
  return isNaN(parsed) ? 0 : parsed;
}

function fmtDate(value) {
  if (!value) return '-';
  try {
    /* Date-only values must not shift a day: parse YYYY-MM-DD as a local date. */
    var text = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      var parts = text.split('-');
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (error) { return String(value).slice(0, 10); }
}

function fmtDateTime(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch (error) { return String(value); }
}

function initialsFor(name) {
  var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function personNameOf(profileObject, profileData) {
  var data = profileData || vd(profileObject);
  var full = ((data.firstName || '') + ' ' + (data.lastName || '')).trim();
  return full || data.email || (profileObject ? profileObject.name : '') || 'Volunteer';
}

function statusLabel(status) {
  var labels = {
    draft: 'Draft', open: 'Open', closed: 'Closed', cancelled: 'Cancelled',
    requested: 'Requested', approved: 'Approved', declined: 'Declined', removed: 'Removed',
    assigned: 'Assigned', 'in-progress': 'In progress', 'reported-done': 'Reported done',
    confirmed: 'Confirmed', pending: 'Pending', rejected: 'Rejected',
    candidate: 'Pending acceptance', active: 'Accepted', inactive: 'Not active', banned: 'Blocked'
  };
  return labels[status] || (status ? String(status) : '-');
}

function badge(status) {
  var key = status || 'draft';
  return '<span class="vp-badge vp-badge-' + esc(key) + '">' + esc(statusLabel(key)) + '</span>';
}

function toast(message) {
  var node = el('vpToast');
  if (!node) return;
  node.textContent = message;
  node.className = 'vp-toast show';
  if (APP.toastTimer) clearTimeout(APP.toastTimer);
  APP.toastTimer = setTimeout(function () {
    node.className = 'vp-toast';
  }, 2600);
}

function notifyHost(message, kind) {
  try { tool.notify(message, kind || 'info'); } catch (error) { /* host may not expose notify */ }
  toast(message);
}

/* ---------------- params ---------------- */
function paramOr(name, fallback) {
  try {
    var value = tool.param(name, fallback);
    if (value === undefined || value === null || value === '') return fallback;
    return value;
  } catch (error) {
    return fallback;
  }
}

function typePerson() { return paramOr('personType', DEFAULT_TYPES.person); }
function typeEvent() { return paramOr('eventType', DEFAULT_TYPES.event); }
function typeRelation() { return paramOr('relationType', DEFAULT_TYPES.relation); }
function typeTasks() { return paramOr('tasksType', DEFAULT_TYPES.tasks); }
function typeMessages() { return paramOr('messagesType', DEFAULT_TYPES.messages); }
function orgName() { return paramOr('orgName', 'Our Organization'); }

/* ---------------- CMS access ---------------- */
function requestObjects(action, params, callback) {
  if (!tool || typeof tool.requestObjects !== 'function') {
    callback('The CMS did not provide requestObjects.', {});
    return;
  }
  var alreadyAnswered = false;
  function answerOnce(error, result) {
    if (alreadyAnswered) return;
    alreadyAnswered = true;
    callback(error || null, result || {});
  }
  /* Guard only the call itself: an error thrown inside the callback must surface, not be turned into an empty result. */
  try { tool.requestObjects(action, params, answerOnce); }
  catch (error) {
    if (alreadyAnswered) throw error;
    answerOnce(error, {});
  }
}

function queryType(objectType, callback) {
  requestObjects('query', { mainObjectType: objectType }, function (error, result) {
    if (error) { callback(error, []); return; }
    callback(null, result.objects || []);
  });
}

function getById(objectType, objectId, callback) {
  requestObjects('get', { mainObjectType: objectType, objectId: objectId }, function (error, result) {
    if (error) { callback(error, null); return; }
    callback(null, result.object || null);
  });
}

function createObject(objectType, name, data, callback) {
  requestObjects('create', {
    mainObjectType: objectType,
    name: name,
    productData: { data_categoriesBased: data }
  }, function (error, result) {
    if (error) { callback(error, null); return; }
    callback(null, result.object || null);
  });
}

function updateObject(objectType, objectId, data, name, callback) {
  var params = {
    mainObjectType: objectType,
    objectId: objectId,
    productData: { data_categoriesBased: data }
  };
  if (name) params.name = name;
  requestObjects('update', params, function (error, result) {
    callback(error || null, result);
  });
}

function deleteObject(objectType, objectId, callback) {
  requestObjects('delete', { mainObjectType: objectType, objectId: objectId }, function (error, result) {
    callback(error || null, result);
  });
}

/* ---------------- identity ---------------- */
function detectManager(user) {
  if (!user) return false;
  var roles = user.roles || [];
  var managerRoles = ['admin', 'owner', 'developer', 'user-manager', 'editor'];
  for (var index = 0; index < managerRoles.length; index++) {
    if (roles.indexOf(managerRoles[index]) !== -1) return true;
  }
  return false;
}

function currentUserId() {
  return APP.user ? (APP.user.id || '') : '';
}

function isOwnProfile() {
  if (!APP.profileObject) return false;
  var ownerUserId = APP.profileData.userId || '';
  if (!ownerUserId || !currentUserId()) return false;
  return ownerUserId === currentUserId();
}

function canEditProfile() {
  return !APP.readOnly && (APP.isManager || isOwnProfile());
}

/* A profile created by the CMS can arrive without the account link. Claiming it
   once keeps the volunteer recognised on a later visit that has no object. */
function maybeLinkProfileToUser(done) {
  var finished = done || function () { };
  var userId = currentUserId();
  if (!APP.profileObject || !userId || APP.readOnly) { finished(); return; }
  if (String(APP.profileData.userId || '')) { finished(); return; }

  var signedInEmail = String((APP.user && APP.user.email) || '').toLowerCase();
  var profileEmail = String(APP.profileData.email || '').toLowerCase();
  /* A manager browsing somebody else's record must not claim it as their own. */
  var signedInUserMayClaim = !APP.isManager || (!!signedInEmail && signedInEmail === profileEmail);
  if (!signedInUserMayClaim) { finished(); return; }

  var next = simpleCopy(APP.profileData);
  next.userId = userId;
  next.updatedAt = isoNow();
  updateObject(typePerson(), APP.profileObject.id, next, personNameOf(APP.profileObject), function (error) {
    if (!error) APP.profileData.userId = userId;
    finished();
  });
}

/* Self service: the eight details a manager needs to match a volunteer to a role. */
function profileCompletenessFor(profileData) {
  var data = profileData || {};
  var requiredFields = [
    { key: 'firstName', label: 'first name' },
    { key: 'lastName', label: 'last name' },
    { key: 'email', label: 'email' },
    { key: 'phone', label: 'phone' },
    { key: 'city', label: 'city' },
    { key: 'skills', label: 'skills' },
    { key: 'languages', label: 'languages' },
    { key: 'availabilityNotes', label: 'availability' }
  ];
  var missingFields = [];
  requiredFields.forEach(function (field) {
    if (!String(data[field.key] || '').trim()) missingFields.push(field.label);
  });
  var filledCount = requiredFields.length - missingFields.length;
  return {
    missing: missingFields,
    filled: filledCount,
    total: requiredFields.length,
    percent: Math.round((filledCount / requiredFields.length) * 100)
  };
}

function profileCompleteness() {
  return profileCompletenessFor(APP.profileData);
}

function profileChecklistHtml() {
  var completeness = profileCompleteness();
  if (completeness.missing.length === 0 || !canEditProfile()) return '';
  return '<div class="vp-checklist">'
    + '<div class="vp-checklist-head"><strong>Your profile is ' + completeness.percent + '% complete</strong>'
    + '<span class="vp-count">' + completeness.filled + ' of ' + completeness.total + '</span></div>'
    + '<div class="vp-checklist-bar"><div class="vp-checklist-fill" style="width:' + completeness.percent + '%"></div></div>'
    + '<div class="vp-hint">Still missing: ' + esc(completeness.missing.join(', '))
    + '. A complete profile helps a manager match you to the right role.</div>'
    + '<div class="vp-actions" style="margin-top:10px;">'
    + '<button type="button" class="vp-btn vp-btn-outline vp-btn-tiny" onclick="showView(\'profile\')">Open my profile</button>'
    + '</div></div>';
}

/* ---------------- data shaping ---------------- */
function relationData(relation) { return vd(relation); }

function relationsOfProfile() {
  if (!APP.profileObject) return [];
  var profileId = APP.profileObject.id;
  return APP.relations.filter(function (relation) {
    return relationData(relation).personId === profileId;
  });
}

function relationForEvent(eventId) {
  var rows = relationsOfProfile();
  for (var index = 0; index < rows.length; index++) {
    if (relationData(rows[index]).eventId === eventId) return rows[index];
  }
  return null;
}

function eventById(eventId) {
  for (var index = 0; index < APP.events.length; index++) {
    if (APP.events[index].id === eventId) return APP.events[index];
  }
  return null;
}

function eventDataOf(eventId) {
  var record = eventById(eventId);
  return record ? vd(record) : {};
}

function eventNameOf(eventId) {
  var data = eventDataOf(eventId);
  var record = eventById(eventId);
  return data.name || (record ? record.name : '') || 'Event';
}

function eventWhenText(eventData) {
  var start = eventData.startDate || '';
  var end = eventData.endDate || '';
  var dateText = '';
  if (start && end && end !== start) dateText = fmtDate(start) + ' to ' + fmtDate(end);
  else dateText = fmtDate(start || end);
  if (eventData.startTime) {
    dateText += ' - ' + eventData.startTime + (eventData.endTime ? ' to ' + eventData.endTime : '');
  }
  return dateText || '-';
}

/* Events a person belongs to, sorted by start date. */
function myEventRecords() {
  var records = [];
  relationsOfProfile().forEach(function (relation) {
    var record = eventById(relationData(relation).eventId);
    if (record) records.push(record);
  });
  return records.sort(sortByStartDate);
}

function sortByStartDate(recordA, recordB) {
  var dateA = vd(recordA).startDate || '9999-12-31';
  var dateB = vd(recordB).startDate || '9999-12-31';
  if (dateA !== dateB) return dateA < dateB ? -1 : 1;
  return String(vd(recordA).name || '').localeCompare(String(vd(recordB).name || ''));
}

/* Volunteering comes in more than one shape. A record declares its type in
   opportunityType; when the field is missing the type is derived from the data,
   so records written before this model existed still show up correctly. */
var OPPORTUNITY_TYPES = [
  { key: 'event', label: 'Event', when: 'A fixed date and time' },
  { key: 'task', label: 'Task based', when: 'A set of tasks, done by a deadline' },
  { key: 'recurring', label: 'Recurring', when: 'A regular schedule' },
  { key: 'self-paced', label: 'Self paced', when: 'Work in your own time' }
];

function opportunityTypeOf(record) {
  var data = vd(record);
  var declared = String(data.opportunityType || data.volunteeringType || '').toLowerCase().trim();
  if (declared) return declared;
  if (data.recurrence || data.recurringSchedule || data.recurrenceText) return 'recurring';
  if (data.startDate || data.endDate) return 'event';
  if (tasksOf(record.id).length) return 'task';
  return 'self-paced';
}

function opportunityTypeLabel(typeKey) {
  for (var index = 0; index < OPPORTUNITY_TYPES.length; index++) {
    if (OPPORTUNITY_TYPES[index].key === typeKey) return OPPORTUNITY_TYPES[index].label;
  }
  return String(typeKey || 'Other')
    .replace(/[-_]+/g, ' ')
    .replace(/^./, function (firstCharacter) { return firstCharacter.toUpperCase(); });
}

function opportunityTypeChip(typeKey) {
  var known = '';
  for (var index = 0; index < OPPORTUNITY_TYPES.length; index++) {
    if (OPPORTUNITY_TYPES[index].key === typeKey) { known = ' vp-type-' + OPPORTUNITY_TYPES[index].key; break; }
  }
  return '<span class="vp-type-chip' + known + '">' + esc(opportunityTypeLabel(typeKey)) + '</span>';
}

function locationModeOf(data) {
  var mode = String(data.locationMode || '').toLowerCase().trim();
  if (mode === 'remote' || mode === 'online') return 'Online';
  if (mode === 'hybrid') return 'Hybrid';
  if (data.isRemote === true) return 'Online';
  return 'On site';
}

/* "Every Saturday, 10:00 to 12:00" from a recurrence object or a plain text field. */
function recurrenceText(data) {
  if (data.recurrenceText) return String(data.recurrenceText);
  var recurrence = data.recurrence || data.recurringSchedule;
  if (!recurrence) return '';
  if (typeof recurrence === 'string') return recurrence;
  var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var weekdays = Array.isArray(recurrence.weekdays) ? recurrence.weekdays : [];
  var text = '';
  if (weekdays.length === 7) {
    text = 'Every day';
  } else if (weekdays.length > 0) {
    var days = [];
    weekdays.forEach(function (weekday) {
      var dayName = dayNames[Number(weekday)];
      if (dayName) days.push(dayName);
    });
    text = days.length ? 'Every ' + days.join(', ') : '';
  } else if (recurrence.frequency) {
    text = 'Repeats ' + recurrence.frequency;
  }
  if (recurrence.timeFrom || recurrence.time_from) {
    var fromTime = recurrence.timeFrom || recurrence.time_from;
    var toTime = recurrence.timeTo || recurrence.time_until;
    text += (text ? ', ' : '') + fromTime + (toTime ? ' to ' + toTime : '');
  }
  return text;
}

/* Wording that fits the type: a date for an event, a schedule for a recurring
   role, a deadline or effort for task based and self paced work. */
function opportunityWhenText(record) {
  var data = vd(record);
  var typeKey = opportunityTypeOf(record);
  if (typeKey === 'recurring') return recurrenceText(data) || 'Recurring schedule';
  if (typeKey === 'event') return eventWhenText(data);
  if (typeKey === 'task') {
    if (data.commitment) return String(data.commitment);
    if (data.deadline) return 'Finish by ' + fmtDate(data.deadline);
    return 'Work to a deadline';
  }
  if (data.commitment) return String(data.commitment);
  if (data.deadline) return 'Finish by ' + fmtDate(data.deadline);
  return 'Work at your own pace';
}

function commitmentText(data) {
  if (data.commitment) return String(data.commitment);
  if (data.estimatedHours) return toNumber(data.estimatedHours) + ' hours in total';
  return '';
}

/* Header wording for the network state; "approved" alone would read like an
   approved application, which is a different thing. */
function networkStatusLabel(status) {
  return statusLabel(status || 'candidate');
}

function positionsOf(record) {
  var positions = vd(record).positions;
  return Array.isArray(positions) ? positions : [];
}

function allRelations() {
  return Array.isArray(APP.allRelations) ? APP.allRelations : [];
}

/* Places already taken in a position: approved roles of approved memberships.
   A requested role is not a filled place, it is still waiting for a decision. */
function positionFilledCount(opportunityId, positionId) {
  var filled = 0;
  allRelations().forEach(function (relation) {
    var data = relationData(relation);
    if (data.eventId !== opportunityId) return;
    if (data.status !== 'approved') return;
    var rows = Array.isArray(data.positions) ? data.positions : [];
    for (var index = 0; index < rows.length; index++) {
      if ((rows[index].positionId || '') !== positionId) continue;
      if ((rows[index].status || 'approved') === 'approved') {
        filled++;
        return;
      }
    }
  });
  return filled;
}

function myPositionStatus(opportunityId, positionId) {
  var relation = relationForEvent(opportunityId);
  if (!relation) return '';
  var rows = Array.isArray(relationData(relation).positions) ? relationData(relation).positions : [];
  for (var index = 0; index < rows.length; index++) {
    if ((rows[index].positionId || '') === positionId) return rows[index].status || 'requested';
  }
  return '';
}

function opportunityAcceptsApplications(record) {
  var data = vd(record);
  if (data.status !== 'open') return false;
  var deadline = String(data.applicationDeadline || '').slice(0, 10);
  if (deadline && deadline < todayIso()) return false;
  return true;
}

function openOpportunityRecords() {
  return APP.events.filter(opportunityAcceptsApplications).sort(sortByStartDate);
}

function catalogRecords() {
  var needle = String(APP.catalogSearch || '').toLowerCase().trim();
  return openOpportunityRecords().filter(function (record) {
    var data = vd(record);
    if (APP.catalogType !== 'all' && opportunityTypeOf(record) !== APP.catalogType) return false;
    if (!needle) return true;
    var haystack = [
      data.name || record.name,
      data.description || '',
      data.city || '',
      data.locationName || '',
      opportunityTypeLabel(opportunityTypeOf(record)),
      positionsOf(record).map(function (position) { return position.name || ''; }).join(' ')
    ].join(' ').toLowerCase();
    return haystack.indexOf(needle) !== -1;
  });
}

/* Tasks of one event, from the event tasks document. */
function tasksDocOf(eventId) {
  for (var index = 0; index < APP.tasksDocs.length; index++) {
    if (vd(APP.tasksDocs[index]).eventId === eventId) return APP.tasksDocs[index];
  }
  return null;
}

function tasksOf(eventId) {
  var doc = tasksDocOf(eventId);
  if (!doc) return [];
  var rows = vd(doc).tasks;
  return Array.isArray(rows) ? rows : [];
}

function taskLinksOf(relation) {
  var links = relation ? relationData(relation).taskLinks : null;
  return Array.isArray(links) ? links : [];
}

function taskLinkFor(relation, taskId) {
  var links = taskLinksOf(relation);
  for (var index = 0; index < links.length; index++) {
    if (links[index].taskId === taskId) return links[index];
  }
  return null;
}

/* Messages of one event, newest volume first, newest message first. */
function messagesOf(eventId) {
  var volumes = APP.messageDocs.filter(function (doc) {
    return vd(doc).eventId === eventId;
  }).sort(function (docA, docB) {
    return toNumber(vd(docB).volume || 1) - toNumber(vd(docA).volume || 1);
  });

  var rows = [];
  volumes.forEach(function (doc) {
    var data = vd(doc);
    var list = Array.isArray(data.messages) ? data.messages : [];
    list.forEach(function (message) {
      rows.push({ message: message, volume: toNumber(data.volume || 1), eventId: eventId });
    });
  });
  return rows;
}

function unreadMessageCount() {
  var total = 0;
  var myUserId = currentUserId();
  if (!myUserId) return 0;
  relationsOfProfile().forEach(function (relation) {
    var relationRecord = relationData(relation);
    if (!relationRecord.eventId) return;
    messagesOf(relationRecord.eventId).forEach(function (entry) {
      var message = entry.message;
      if (message && message.readBy && message.readBy.indexOf(myUserId) === -1) total++;
    });
  });
  return total;
}

function hoursTotals() {
  var totals = { approved: 0, pending: 0, rejected: 0 };
  relationsOfProfile().forEach(function (relation) {
    var data = relationData(relation);
    totals.approved += toNumber(data.hoursApprovedTotal);
    var pending = Array.isArray(data.pendingHours) ? data.pendingHours : [];
    pending.forEach(function (line) { totals.pending += toNumber(line.hours); });
    var rejected = Array.isArray(data.hoursHistory) ? data.hoursHistory : [];
    rejected.forEach(function (line) {
      if (line.status === 'rejected') totals.rejected += toNumber(line.hours);
    });
  });
  return totals;
}

function myTaskRows() {
  var rows = [];
  relationsOfProfile().forEach(function (relation) {
    var relationRecord = relationData(relation);
    var links = taskLinksOf(relation);
    var definitions = tasksOf(relationRecord.eventId);
    links.forEach(function (link) {
      var definition = null;
      for (var index = 0; index < definitions.length; index++) {
        if (definitions[index].id === link.taskId) { definition = definitions[index]; break; }
      }
      rows.push({
        relation: relation,
        eventId: relationRecord.eventId,
        link: link,
        definition: definition
      });
    });
  });
  return rows.sort(function (rowA, rowB) {
    return String((rowA.definition && rowA.definition.dueDate) || '9999')
      .localeCompare(String((rowB.definition && rowB.definition.dueDate) || '9999'));
  });
}

function openTaskRows() {
  return myTaskRows().filter(function (row) {
    return row.link && row.link.status !== 'confirmed';
  });
}

/* ---------------- loading ---------------- */
function resolveHostObjectId() {
  if (APP.hostObjectId) return APP.hostObjectId;

  var fromValue = APP.savedValue && APP.savedValue.personObjectId;
  if (fromValue) return String(fromValue);

  var fromParam = paramOr('personId', '');
  if (fromParam) return String(fromParam);

  try {
    if (typeof tool.getFields === 'function') {
      var fields = tool.getFields() || {};
      if (fields.id) return String(fields.id);
      if (fields.objectId) return String(fields.objectId);
    }
  } catch (error) { /* fields are optional */ }

  return '';
}

function loadAll(done) {
  APP.loading = true;
  APP.loadError = '';

  function finish() {
    APP.loading = false;
    /* A session left running while the page was gone is closed before the
       screens render; the close reloads and renders again. */
    if (closeStaleSessionOnLoad(done)) return;
    renderAll();
    if (done) done();
    if (APP.pendingAfterLoad) {
      var runAfterLoad = APP.pendingAfterLoad;
      APP.pendingAfterLoad = null;
      runAfterLoad();
    }
  }

  var hostId = resolveHostObjectId();

  function afterProfile(profileObject) {
    if (!profileObject) {
      APP.profileObject = null;
      APP.profileData = {};
      APP.relations = [];
      APP.allRelations = [];
      APP.tasksDocs = [];
      APP.messageDocs = [];
      loadNetworkPersons(finish);
      return;
    }

    APP.profileObject = profileObject;
    APP.profileData = vd(profileObject);
    APP.hostObjectId = profileObject.id;

    /* A profile created by the CMS may arrive without the account link. Claim
       it for the signed-in volunteer once, so the next visit recognises them. */
    maybeLinkProfileToUser(function () {
      queryType(typeRelation(), function (relationError, relations) {
        if (relationError) APP.loadError = 'Memberships could not be loaded: ' + relationError;
        var profileId = profileObject.id;
        /* Every membership is kept: the catalog needs slot counts per position,
           while the volunteer only ever sees and writes their own rows. */
        APP.allRelations = relations || [];
        APP.relations = APP.allRelations.filter(function (relation) {
          return relationData(relation).personId === profileId;
        });

        queryType(typeEvent(), function (eventError, events) {
          if (eventError) APP.loadError = 'Events could not be loaded: ' + eventError;
          APP.events = events || [];

          queryType(typeTasks(), function (taskError, tasksDocs) {
            if (taskError) APP.loadError = 'Event tasks could not be loaded: ' + taskError;
            APP.tasksDocs = tasksDocs || [];

            queryType(typeMessages(), function (messageError, messageDocs) {
              if (messageError) APP.loadError = 'Event messages could not be loaded: ' + messageError;
              APP.messageDocs = messageDocs || [];
              loadNetworkPersons(finish);
            });
          });
        });
      });
    });
  }

  if (hostId) {
    getById(typePerson(), hostId, function (error, object) {
      if (!error && object) { afterProfile(object); return; }
      queryType(typePerson(), function (queryError, persons) {
        if (queryError) { afterProfile(null); return; }
        var userId = currentUserId();
        var match = null;
        for (var index = 0; index < (persons || []).length; index++) {
          if (vd(persons[index]).userId === userId && userId) { match = persons[index]; break; }
        }
        afterProfile(match);
      });
    });
    return;
  }

  /* No host id: fall back to the profile of the signed-in volunteer. */
  queryType(typePerson(), function (error, persons) {
    if (error) { afterProfile(null); return; }
    var userId = currentUserId();
    var match = null;
    for (var index = 0; index < (persons || []).length; index++) {
      if (userId && vd(persons[index]).userId === userId) { match = persons[index]; break; }
    }
    afterProfile(match);
  });
}

/* Managers see the whole network so they can accept a new volunteer;
   a volunteer only ever loads their own record. */
function loadNetworkPersons(done) {
  var finished = done || function () { };
  if (!APP.isManager) { APP.persons = []; finished(); return; }
  queryType(typePerson(), function (error, persons) {
    if (error) APP.loadError = 'Volunteer profiles could not be loaded: ' + error;
    APP.persons = persons || [];
    finished();
  });
}

/* ---------------- writing: relation ---------------- */
function saveRelation(relation, data, done) {
  if (!APP.profileObject) return;
  if (relation) {
    updateObject(typeRelation(), relation.id, data, personNameOf(APP.profileObject), function (error) {
      if (error) { notifyHost('Could not save the membership: ' + error, 'error'); return; }
      done && done();
    });
    return;
  }
  createObject(typeRelation(), personNameOf(APP.profileObject), data, function (error) {
    if (error) { notifyHost('Could not create the membership: ' + error, 'error'); return; }
    done && done();
  });
}

/* One application = one position of one opportunity. Applying for another role
   of the same opportunity adds a requested role to the same membership, so the
   manager sees one person with several role requests. */
function applyToPosition(opportunityId, positionId, note) {
  if (!APP.profileObject) { notifyHost('A volunteer profile is needed before you can apply.', 'warning'); return; }
  var acceptanceIssue = volunteerAcceptanceIssue();
  if (acceptanceIssue) { notifyHost(acceptanceIssue, 'warning'); return; }
  var record = eventById(opportunityId);
  if (!record || !opportunityAcceptsApplications(record)) {
    notifyHost('This opportunity is not accepting applications.', 'warning');
    return;
  }

  var chosenPosition = null;
  positionsOf(record).forEach(function (position) {
    if ((position.id || '') === positionId) chosenPosition = position;
  });
  var positionName = chosenPosition ? chosenPosition.name : 'General volunteer';

  var existing = relationForEvent(opportunityId);
  var data = existing ? simpleCopy(relationData(existing)) : {
    personId: APP.profileObject.id,
    personUserId: APP.profileData.userId || '',
    eventId: opportunityId,
    eventName: eventNameOf(opportunityId),
    taskLinks: [],
    pendingHours: [],
    hoursHistory: [],
    approvedLedgerIds: [],
    hoursApprovedTotal: 0
  };

  var roleRows = Array.isArray(data.positions) ? data.positions.slice() : [];
  var existingRole = null;
  roleRows.forEach(function (roleRow) {
    if ((roleRow.positionId || '') === positionId) existingRole = roleRow;
  });

  if (existingRole && existingRole.status === 'approved') {
    notifyHost('You already volunteer in this role.', 'info');
    return;
  }
  if (existingRole && existingRole.status === 'requested') {
    notifyHost('This role request is already waiting for a decision.', 'info');
    return;
  }

  var membershipStatus = existing ? (relationData(existing).status || '') : '';
  if (membershipStatus === 'declined' || membershipStatus === 'removed') {
    /* A new request starts a clean membership row. */
    roleRows = [];
    data.status = 'requested';
    data.appliedAt = isoNow();
  }

  if (existingRole) {
    existingRole.status = 'requested';
    existingRole.name = positionName;
    existingRole.requestedAt = isoNow();
  } else {
    roleRows.push({
      positionId: positionId,
      name: positionName,
      status: 'requested',
      requestedAt: isoNow()
    });
  }

  if (membershipStatus !== 'approved') {
    data.status = 'requested';
    if (!data.appliedAt) data.appliedAt = isoNow();
  }

  data.positions = roleRows;
  data.source = data.source || 'volunteer';
  data.notes = String(note || '').slice(0, 500);
  data.lastRequestedAt = isoNow();
  data.updatedAt = isoNow();

  saveRelation(existing, data, function () {
    notifyHost('Request sent for ' + positionName + '.', 'success');
    closeModal();
    loadAll();
  });
}

function withdrawFromEvent(eventId) {
  var relation = relationForEvent(eventId);
  if (!relation) return;
  var data = simpleCopy(relationData(relation));
  data.status = 'removed';
  data.updatedAt = isoNow();
  updateObject(typeRelation(), relation.id, data, personNameOf(APP.profileObject), function (error) {
    if (error) { notifyHost('Could not withdraw: ' + error, 'error'); return; }
    notifyHost('You are no longer part of this opportunity.', 'info');
    closeModal();
    loadAll();
  });
}

/* ---------------- writing: hours ---------------- */
function addPendingHours(eventId, line) {
  var relation = relationForEvent(eventId);
  if (!relation) { notifyHost('Join the opportunity before logging hours.', 'warning'); return; }
  var data = simpleCopy(relationData(relation));
  var pending = Array.isArray(data.pendingHours) ? data.pendingHours.slice() : [];
  if (pending.length >= 60) { notifyHost('60 hour lines are already waiting. Ask the manager to approve them first.', 'warning'); return; }
  pending.push({
    id: 'ph_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: line.date,
    hours: line.hours,
    note: String(line.note || '').slice(0, 500),
    taskId: line.taskId || '',
    taskTitle: line.taskTitle || '',
    submittedAt: isoNow()
  });
  data.pendingHours = pending;
  data.updatedAt = isoNow();
  updateObject(typeRelation(), relation.id, data, personNameOf(APP.profileObject), function (error) {
    if (error) { notifyHost('Could not log hours: ' + error, 'error'); return; }
    notifyHost('Hours sent for approval.', 'success');
    closeModal();
    loadAll();
  });
}

/* ---------------- time sessions: clock in and clock out ----------------
   A session stores timestamps and the minutes are computed from them, so a
   closed tab can never "keep counting". The end is always the earliest of:
   what the volunteer pressed, the frozen window end, or a stale close built
   from the last heartbeat (SSOT 8.9). */
var TIMER_DEFAULTS = {
  earlyGraceMinutes: 15,
  graceMinutes: 15,
  maxSessionMinutes: 480,
  roundingMinutes: 5,
  heartbeatSeconds: 60
};
var TIMER_TICK_MS = 30000;

function pad2(value) { return (value < 10 ? '0' : '') + value; }

function localDateIso(dateValue) {
  return dateValue.getFullYear() + '-' + pad2(dateValue.getMonth() + 1) + '-' + pad2(dateValue.getDate());
}

function timeOfDay(dateValue) {
  return pad2(dateValue.getHours()) + ':' + pad2(dateValue.getMinutes());
}

/* Local Date from 'YYYY-MM-DD' and 'HH:MM'; null when either part is unusable. */
function dateAt(dateText, timeText) {
  if (!dateText) return null;
  var dateParts = String(dateText).slice(0, 10).split('-');
  if (dateParts.length !== 3) return null;
  var timeParts = String(timeText || '00:00').split(':');
  var hours = Number(timeParts[0]);
  var minutes = Number(timeParts[1] || 0);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]), hours, minutes, 0, 0);
}

/* Three monitoring primitives (SSOT 8.10). A window clock covers an event or a
   recurring slot, a project sitting covers task based and self paced work, a
   duty shift covers chat support, and a burst cycle uses a sitting for the
   preparation plus a window clock for the delivery. */
var MONITORING_PROFILES = {
  window: { label: 'Window clock', maxSessionMinutes: 480, roundingMinutes: 5, graceMinutes: 15, dailyMaxMinutes: 720 },
  recurring: { label: 'Slot clock', maxSessionMinutes: 240, roundingMinutes: 5, graceMinutes: 10, dailyMaxMinutes: 720 },
  project: { label: 'Project sitting', maxSessionMinutes: 120, roundingMinutes: 5, graceMinutes: 0, dailyMaxMinutes: 480, weeklyMaxMinutes: 600 },
  burst: { label: 'Burst cycle', maxSessionMinutes: 240, roundingMinutes: 5, graceMinutes: 0, cycleMaxMinutes: 480 },
  duty: { label: 'Duty shift', maxSessionMinutes: 120, roundingMinutes: 15, graceMinutes: 0, dailyMaxMinutes: 120, weeklyMaxMinutes: 600 }
};

function monitoringProfileOf(record) {
  var data = record ? vd(record) : {};
  var declared = String(data.monitoringProfile || '').toLowerCase().trim();
  if (MONITORING_PROFILES[declared]) return declared;
  var typeKey = record ? opportunityTypeOf(record) : 'event';
  if (typeKey === 'event') return 'window';
  if (typeKey === 'recurring') return 'recurring';
  return 'project';
}

function timerPolicyOf(record) {
  var data = record ? vd(record) : {};
  var profile = monitoringProfileOf(record);
  var base = MONITORING_PROFILES[profile] || MONITORING_PROFILES.project;
  var policy = data.timerPolicy || {};
  function positiveOr(value, fallback) {
    var parsed = Number(value);
    return isNaN(parsed) || parsed <= 0 ? fallback : parsed;
  }
  return {
    profile: profile,
    label: base.label,
    enabled: policy.enabled === false || data.timerEnabled === false ? false : true,
    earlyGraceMinutes: positiveOr(policy.earlyGraceMinutes, TIMER_DEFAULTS.earlyGraceMinutes),
    graceMinutes: positiveOr(policy.graceMinutes, base.graceMinutes),
    maxSessionMinutes: positiveOr(policy.maxSessionMinutes, base.maxSessionMinutes),
    roundingMinutes: positiveOr(policy.roundingMinutes, base.roundingMinutes),
    dailyMaxMinutes: positiveOr(policy.dailyMaxMinutes, base.dailyMaxMinutes),
    weeklyMaxMinutes: positiveOr(policy.weeklyMaxMinutes, base.weeklyMaxMinutes),
    cycleMaxMinutes: positiveOr(policy.cycleMaxMinutes, base.cycleMaxMinutes)
  };
}

/* Only a window clock and a recurring slot have a working window. A burst
   cycle also uses a window for its delivery day, but only when the cycle has
   a dated delivery; its preparation stays a sitting. */
function timerWindowFor(record, atDate) {
  if (!record) return null;
  var profile = monitoringProfileOf(record);
  if (profile !== 'window' && profile !== 'recurring' && profile !== 'burst') return null;
  var data = vd(record);
  var typeKey = opportunityTypeOf(record);

  if (typeKey === 'event') {
    var start = dateAt(data.startDate || data.endDate, data.startTime || '00:00');
    var end = dateAt(data.endDate || data.startDate, data.endTime || '23:59');
    if (!start || !end) return null;
    if (end <= start) end = dateAt(data.endDate || data.startDate, '23:59');
    return { start: start, end: end, occurrenceDate: localDateIso(start) };
  }

  if (typeKey === 'recurring') {
    var recurrence = data.recurrence || data.recurringSchedule || {};
    var weekdays = Array.isArray(recurrence.weekdays) ? recurrence.weekdays.map(Number) : [];
    var day = atDate || new Date();
    if (weekdays.length > 0 && weekdays.indexOf(day.getDay()) === -1) return null;
    var fromTime = recurrence.timeFrom || recurrence.time_from || '09:00';
    var toTime = recurrence.timeTo || recurrence.time_until || '10:00';
    var recStart = dateAt(localDateIso(day), fromTime);
    var recEnd = dateAt(localDateIso(day), toTime);
    if (!recStart || !recEnd) return null;
    return { start: recStart, end: recEnd, occurrenceDate: localDateIso(day) };
  }

  return null;
}

/* The allowed clock range: a little early, a little grace at the end. */
function timerBoundaries(record, atDate) {
  var window = timerWindowFor(record, atDate);
  if (!window) return null;
  var policy = timerPolicyOf(record);
  return {
    start: new Date(window.start.getTime() - policy.earlyGraceMinutes * 60000),
    end: new Date(window.end.getTime() + policy.graceMinutes * 60000),
    occurrenceDate: window.occurrenceDate,
    policy: policy
  };
}

/* The farthest a session may reach: the window end, or the profile session cap
   when the profile has no window (SSOT 8.10.3). A window only applies when it
   belongs to the day the session starts, so a prep sitting is never clamped by
   a delivery date that already passed. */
function sessionCeiling(record, startDate) {
  var policy = timerPolicyOf(record);
  var capEnd = new Date(startDate.getTime() + policy.maxSessionMinutes * 60000);
  var boundaries = timerBoundaries(record, startDate);
  if (boundaries && boundaries.end < capEnd && boundaries.occurrenceDate === localDateIso(startDate)) return boundaries.end;
  return capEnd;
}

/* Minutes already recorded for one opportunity between two local dates, from
   pending lines and from the approved ledger. Used for the weekly and cycle caps. */
function minutesRecordedFor(eventId, fromDateText, toDateText) {
  var total = 0;
  var relation = relationForEvent(eventId);
  if (relation) {
    var pending = Array.isArray(relationData(relation).pendingHours) ? relationData(relation).pendingHours : [];
    pending.forEach(function (line) {
      var dateText = String(line.date || '').slice(0, 10);
      if (!dateText || dateText < fromDateText || dateText > toDateText) return;
      total += toNumber(line.minutes) > 0 ? toNumber(line.minutes) : Math.round(toNumber(line.hours) * 60);
    });
  }
  var ledger = Array.isArray(APP.profileData.hoursLedger) ? APP.profileData.hoursLedger : [];
  ledger.forEach(function (entry) {
    if (entry.eventId !== eventId) return;
    var dateText = String(entry.eventDate || entry.approvedAt || '').slice(0, 10);
    if (!dateText || dateText < fromDateText || dateText > toDateText) return;
    total += Math.round(toNumber(entry.hours) * 60);
  });
  return total;
}

function weekRangeFor(dateValue) {
  var start = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
  var weekday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - weekday);
  var end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { from: localDateIso(start), to: localDateIso(end) };
}

function minutesBetween(startIso, endIso) {
  var startMs = new Date(startIso).getTime();
  var endMs = new Date(endIso).getTime();
  if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) return 0;
  return Math.floor((endMs - startMs) / 60000);
}

function clockText(minutes) {
  var total = Math.max(0, Math.round(minutes));
  return Math.floor(total / 60) + ':' + pad2(total % 60);
}

function roundToStep(minutes, step) {
  var size = Number(step) > 0 ? Number(step) : 1;
  return Math.max(size, Math.round(minutes / size) * size);
}

function runningSession() {
  var rows = relationsOfProfile();
  for (var index = 0; index < rows.length; index++) {
    var session = relationData(rows[index]).activeSession;
    if (session && session.startedAt) return { relation: rows[index], session: session };
  }
  return null;
}

/* Approved places that can be measured right now, grouped by primitive. */
function clockableItems() {
  var now = new Date();
  var items = [];
  relationsOfProfile().forEach(function (relation) {
    var data = relationData(relation);
    if (data.status !== 'approved') return;
    var record = eventById(data.eventId);
    if (!record) return;
    var policy = timerPolicyOf(record);
    if (!policy.enabled) return;

    if (policy.profile === 'window' || policy.profile === 'recurring' || policy.profile === 'burst') {
      var boundaries = timerBoundaries(record, now);
      var worksToday = !!boundaries
        && boundaries.occurrenceDate === localDateIso(now)
        && now <= boundaries.end;
      var alreadyRecorded = worksToday && (Array.isArray(data.timeSessions) ? data.timeSessions : []).some(function (session) {
        return session.occurrenceDate === boundaries.occurrenceDate;
      });
      if (worksToday && !alreadyRecorded) {
        items.push({ kind: 'clock', record: record, policy: policy, boundaries: boundaries, tasks: [] });
        return;
      }
      if (policy.profile !== 'burst') return;
      /* A burst cycle with no delivery today is preparation, so it is a sitting. */
      items.push({ kind: 'sitting', record: record, policy: policy, boundaries: null, tasks: openTasksFor(data.eventId) });
      return;
    }

    if (policy.profile === 'duty') {
      var dutyToday = localDateIso(now);
      var hasDutyToday = (Array.isArray(data.pendingHours) ? data.pendingHours : []).some(function (line) {
        return line.source === 'duty' && line.date === dutyToday;
      });
      if (hasDutyToday) return;
      items.push({ kind: 'duty', record: record, policy: policy, boundaries: null, tasks: [] });
      return;
    }

    items.push({ kind: 'sitting', record: record, policy: policy, boundaries: null, tasks: openTasksFor(data.eventId) });
  });
  return items;
}

/* Tasks the volunteer can sit on: mine, or still unassigned. */
function openTasksFor(eventId) {
  var myId = APP.profileObject ? APP.profileObject.id : '';
  return tasksOf(eventId).filter(function (task) {
    return !task.assigneePersonId || task.assigneePersonId === myId;
  });
}

function startClock(opportunityId, taskId) {
  if (!APP.profileObject) { notifyHost('A volunteer profile is needed before you can clock in.', 'warning'); return; }
  if (!canWork()) { notifyHost('This view is read only.', 'warning'); return; }
  if (APP.profileData.status === 'candidate') { notifyHost('A manager has to accept you into the volunteer network before you can clock in.', 'warning'); return; }

  var alreadyRunning = runningSession();
  if (alreadyRunning) {
    notifyHost('You are already clocked in for ' + eventNameOf(alreadyRunning.session.eventId) + '. Stop that first.', 'warning');
    return;
  }

  var relation = relationForEvent(opportunityId);
  if (!relation || relationData(relation).status !== 'approved') {
    notifyHost('Only an approved place can be clocked.', 'warning');
    return;
  }

  var record = eventById(opportunityId);
  if (!record) return;
  var policy = timerPolicyOf(record);
  if (policy.profile === 'duty') { notifyHost('This role uses a duty shift, not a clock.', 'info'); return; }

  var now = new Date();
  var boundaries = timerBoundaries(record, now);
  var usesWindow = policy.profile === 'window' || policy.profile === 'recurring'
    || (policy.profile === 'burst' && !!boundaries && boundaries.occurrenceDate === localDateIso(now));
  if (usesWindow) {
    if (!boundaries) { notifyHost('This opportunity has no working window today.', 'warning'); return; }
    if (now < boundaries.start) { notifyHost('The clock opens at ' + timeOfDay(boundaries.start) + '.', 'info'); return; }
    if (now > boundaries.end) { notifyHost('The working window closed at ' + timeOfDay(boundaries.end) + '.', 'info'); return; }
    var alreadyRecorded = (Array.isArray(relationData(relation).timeSessions) ? relationData(relation).timeSessions : []).some(function (session) {
      return session.occurrenceDate === boundaries.occurrenceDate;
    });
    if (alreadyRecorded) { notifyHost('This occurrence is already recorded. A new one starts at the next slot.', 'info'); return; }
  }

  var taskTitle = '';
  if (taskId) {
    tasksOf(opportunityId).forEach(function (task) {
      if (task.id === taskId) taskTitle = task.title || '';
    });
  }

  var data = simpleCopy(relationData(relation));
  data.activeSession = {
    id: 'ts_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    eventId: opportunityId,
    profile: policy.profile,
    startedAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    startedByUserId: currentUserId(),
    windowEnd: sessionCeiling(record, now).toISOString(),
    occurrenceDate: boundaries ? boundaries.occurrenceDate : localDateIso(now),
    taskId: taskId || '',
    taskTitle: taskTitle
  };
  data.updatedAt = isoNow();

  updateObject(typeRelation(), relation.id, data, personNameOf(APP.profileObject), function (error) {
    if (error) { notifyHost('Could not start the clock: ' + error, 'error'); return; }
    notifyHost((policy.profile === 'project' || policy.profile === 'burst')
      ? 'Sitting started. It stops itself at the session cap.'
      : 'Clocked in at ' + timeOfDay(now) + '.', 'success');
    loadAll();
  });
}

/* Stop, auto-stop or stale close in one place. The session becomes one or more
   pending hour lines immediately, so no hours ever live only in a session. */
function stopClock(endIso, options) {
  var settings = options || {};
  var running = runningSession();
  if (!running) return;

  var session = running.session;
  var record = eventById(session.eventId);
  var policy = timerPolicyOf(record);
  var startDate = new Date(session.startedAt);
  var endDate = endIso ? new Date(endIso) : new Date();
  if (isNaN(endDate.getTime())) endDate = new Date();

  /* The stored window end and the profile cap are both honoured, whichever is
     earlier, so a session can never pass its own start plus the session cap. */
  var hardEnd = session.windowEnd ? new Date(session.windowEnd) : null;
  var profileCeiling = sessionCeiling(record, startDate);
  if (!hardEnd || profileCeiling < hardEnd) hardEnd = profileCeiling;
  if (endDate > hardEnd) endDate = hardEnd;
  if (endDate < startDate) endDate = startDate;

  /* Weekly cap for project work, cycle cap for a burst role. The overrun is
     clamped instead of rejected, so the volunteer never loses the work. */
  var week = weekRangeFor(startDate);
  if (policy.profile === 'project' && policy.weeklyMaxMinutes) {
    var usedThisWeek = minutesRecordedFor(session.eventId, week.from, week.to);
    var leftThisWeek = policy.weeklyMaxMinutes - usedThisWeek;
    if (leftThisWeek <= 0) {
      notifyHost('The weekly limit for this opportunity is already reached. The manager can add the rest.', 'warning');
      return;
    }
    var allowedEnd = new Date(startDate.getTime() + leftThisWeek * 60000);
    if (endDate > allowedEnd) endDate = allowedEnd;
  }
  if (policy.profile === 'burst' && policy.cycleMaxMinutes) {
    var usedInCycle = minutesRecordedFor(session.eventId, '1900-01-01', '2999-12-31');
    var leftInCycle = policy.cycleMaxMinutes - usedInCycle;
    if (leftInCycle <= 0) {
      notifyHost('This cycle is already at its 8 hour cap.', 'warning');
      return;
    }
    var cycleEnd = new Date(startDate.getTime() + leftInCycle * 60000);
    if (endDate > cycleEnd) endDate = cycleEnd;
  }

  var totalMinutes = minutesBetween(startDate.toISOString(), endDate.toISOString());
  if (totalMinutes < 1) { notifyHost('A session under a minute is not saved.', 'warning'); return; }

  /* A session never crosses midnight: it becomes one line per day. */
  var segments = [];
  var startDay = localDateIso(startDate);
  var endDay = localDateIso(endDate);
  if (startDay !== endDay) {
    var midnight = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 0, 0, 0, 0);
    var firstEnd = new Date(midnight.getTime() - 60000);
    if (firstEnd > startDate) segments.push({ start: startDate, end: firstEnd });
    segments.push({ start: midnight, end: endDate });
  } else {
    segments.push({ start: startDate, end: endDate });
  }

  var data = simpleCopy(relationData(running.relation));
  var pending = Array.isArray(data.pendingHours) ? data.pendingHours.slice() : [];
  if (pending.length + segments.length > 60) {
    notifyHost('60 hour lines are already waiting. Ask the manager to approve them first.', 'warning');
    return;
  }

  var createdIds = [];
  segments.forEach(function (segment) {
    var segmentMinutes = minutesBetween(segment.start.toISOString(), segment.end.toISOString());
    if (segmentMinutes < 1) return;
    var pendingId = 'ph_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    createdIds.push(pendingId);
    pending.push({
      id: pendingId,
      source: policy.profile === 'project' || policy.profile === 'burst' ? 'sitting' : 'timer',
      sessionId: session.id,
      date: localDateIso(segment.start),
      startTime: timeOfDay(segment.start),
      endTime: timeOfDay(segment.end),
      minutes: segmentMinutes,
      hours: roundToStep(segmentMinutes, policy.roundingMinutes) / 60,
      note: String(settings.note || '').slice(0, 500),
      taskId: session.taskId || '',
      taskTitle: session.taskTitle || '',
      unverified: !!settings.unverified,
      submittedAt: isoNow()
    });
  });

  if (createdIds.length === 0) { notifyHost('A session under a minute is not saved.', 'warning'); return; }

  var sessions = Array.isArray(data.timeSessions) ? data.timeSessions.slice() : [];
  sessions.push({
    id: session.id,
    startedAt: session.startedAt,
    stoppedAt: endDate.toISOString(),
    minutes: totalMinutes,
    autoStopped: !!settings.auto,
    autoStopReason: settings.reason || 'manual',
    verified: !settings.unverified,
    pendingId: createdIds[createdIds.length - 1]
  });

  data.pendingHours = pending;
  data.timeSessions = sessions.slice(-20);
  data.activeSession = null;
  data.updatedAt = isoNow();

  updateObject(typeRelation(), running.relation.id, data, personNameOf(APP.profileObject), function (error) {
    if (error) { notifyHost('Could not stop the clock: ' + error, 'error'); return; }
    closeModal();
    if (!settings.silent) {
      var roundedTotal = roundToStep(totalMinutes, policy.roundingMinutes);
      var hoursText = (roundedTotal / 60).toFixed(2).replace(/\.?0+$/, '');
      notifyHost(settings.auto
        ? 'Clock stopped at ' + timeOfDay(endDate) + ' (' + totalMinutes + ' minutes). A manager still approves the line.'
        : 'Sent ' + hoursText + ' h for approval.', 'success');
    }
    loadAll();
  });
}

/* Heartbeat: only a page that is open keeps writing this. */
function timerHeartbeat(running) {
  if (!running) return;
  var data = simpleCopy(relationData(running.relation));
  if (!data.activeSession) return;
  data.activeSession.lastSeenAt = isoNow();
  data.updatedAt = isoNow();
  updateObject(typeRelation(), running.relation.id, data, personNameOf(APP.profileObject), function () { /* quiet */ });
}

function timerTick() {
  var running = runningSession();
  if (!running) { renderClockStrip(); return; }

  var now = new Date();
  var lastSeen = new Date(running.session.lastSeenAt || running.session.startedAt);
  if (now.getTime() - lastSeen.getTime() >= TIMER_DEFAULTS.heartbeatSeconds * 1000) timerHeartbeat(running);

  var hardEnd = running.session.windowEnd ? new Date(running.session.windowEnd) : null;
  if (hardEnd && now >= hardEnd) {
    stopClock(hardEnd.toISOString(), { auto: true, reason: 'window-end' });
    return;
  }
  renderClockStrip();
}

/* A session found running after the page was gone is closed at the last
   heartbeat plus two intervals, capped by the window, and marked unverified. */
function closeStaleSessionOnLoad(done) {
  var running = runningSession();
  if (!running) return false;

  var lastSeen = new Date(running.session.lastSeenAt || running.session.startedAt);
  var now = new Date();
  var staleAfterMs = TIMER_DEFAULTS.heartbeatSeconds * 1000 * 2;
  if (now.getTime() - lastSeen.getTime() < staleAfterMs) return false;

  var suggestedEnd = new Date(lastSeen.getTime() + staleAfterMs);
  if (running.session.windowEnd) {
    var hardEnd = new Date(running.session.windowEnd);
    if (suggestedEnd > hardEnd) suggestedEnd = hardEnd;
  }
  if (suggestedEnd > now) suggestedEnd = now;
  if (suggestedEnd < new Date(running.session.startedAt)) suggestedEnd = new Date(running.session.startedAt);

  APP.pendingAfterLoad = done || null;
  stopClock(suggestedEnd.toISOString(), { auto: true, reason: 'stale', unverified: true, silent: true });
  return true;
}

function renderClockStrip() {
  var strip = el('vpClockStrip');
  if (!strip) return;
  var running = runningSession();
  if (!running) { strip.hidden = true; return; }
  strip.hidden = false;
  var start = new Date(running.session.startedAt);
  el('vpClockText').textContent = 'Clocked in at ' + timeOfDay(start) + ' - ' + eventNameOf(running.session.eventId);
  el('vpClockElapsed').textContent = clockText(minutesBetween(running.session.startedAt, new Date().toISOString()));
}

function renderClockCard() {
  var card = el('vpClockCard');
  if (!card) return;

  var running = runningSession();
  if (running) {
    var start = new Date(running.session.startedAt);
    var runningPolicy = timerPolicyOf(eventById(running.session.eventId));
    var runningDetail = running.session.taskTitle
      ? 'Task: ' + esc(running.session.taskTitle)
      : (runningPolicy.profile === 'project' || runningPolicy.profile === 'burst' ? 'Sitting' : 'Shift');
    card.innerHTML = '<div class="vp-card-head"><h2>Your clock</h2><span class="vp-count">running</span></div>'
      + '<div class="vp-card-body">'
      + '<div class="vp-clock-live"><span class="vp-clock-dot" style="background:#4f46e5;box-shadow:0 0 0 4px #eef2ff;" aria-hidden="true"></span>'
      + '<span>Started at <strong>' + esc(timeOfDay(start)) + '</strong> for ' + esc(eventNameOf(running.session.eventId)) + '.</span></div>'
      + '<div class="vp-hint">' + runningDetail + '. The session cap is ' + Math.round(runningPolicy.maxSessionMinutes / 60 * 10) / 10 + ' h.</div>'
      + '<div class="vp-actions" style="margin-top:12px;">'
      + '<button type="button" class="vp-btn vp-btn-primary" onclick="openStopClockModal()">Stop and send</button>'
      + '</div>'
      + '<div class="vp-hint">If the page closes, the clock is closed at your last heartbeat when you come back and you can correct the end time.</div>'
      + '</div>';
    return;
  }

  var items = clockableItems();
  if (APP.profileData.status === 'candidate') {
    card.innerHTML = '<div class="vp-card-head"><h2>Clock in and out</h2></div>'
      + '<div class="vp-card-body"><div class="vp-empty"><strong>Clocking opens after approval</strong>'
      + 'A manager approves you into the volunteer network first. Once that is done, this card offers the clock, the sitting and the duty shift.</div></div>';
    return;
  }
  var body = '';
  if (items.length === 0) {
    body = '<div class="vp-empty"><strong>Nothing to measure right now</strong>'
      + 'A clock is offered for a fixed event or recurring slot on the day it runs, a sitting for task and self paced work, and a shift for chat duty.</div>';
  } else {
    var now = new Date();
    body = '<div class="vp-clock-list">';
    items.forEach(function (item) {
      var recordId = escJs(item.record.id);
      if (item.kind === 'clock') {
        var opensAt = item.boundaries.start;
        var closesAt = item.boundaries.end;
        var closesToday = localDateIso(closesAt) === item.boundaries.occurrenceDate;
        var state = now < opensAt
          ? 'Opens at ' + timeOfDay(opensAt)
          : (closesToday ? 'Open until ' + timeOfDay(closesAt) : 'Open until midnight');
        body += '<div class="vp-clock-row">'
          + '<div><div class="vp-pos-name">' + esc(eventNameOf(item.record.id)) + '</div>'
          + '<div class="vp-pos-desc">' + esc(state) + '</div></div>'
          + '<button type="button" class="vp-btn vp-btn-primary vp-btn-tiny"' + (now < opensAt ? ' disabled' : '')
          + ' onclick="startClock(\'' + recordId + '\')">Clock in</button>'
          + '</div>';
        return;
      }

      if (item.kind === 'sitting') {
        var options = '<option value="">General work</option>';
        item.tasks.forEach(function (task) {
          options += '<option value="' + esc(task.id) + '">' + esc(task.title || 'Untitled task') + '</option>';
        });
        body += '<div class="vp-clock-row vp-clock-row-stack">'
          + '<div><div class="vp-pos-name">' + esc(eventNameOf(item.record.id)) + '</div>'
          + '<div class="vp-pos-desc">Sitting, up to ' + Math.round(item.policy.maxSessionMinutes / 60 * 10) / 10 + ' h at a time</div></div>'
          + '<div class="vp-clock-controls">'
          + '<select class="vp-input vp-select-tiny" id="vpSittingTask_' + esc(item.record.id) + '">' + options + '</select>'
          + '<button type="button" class="vp-btn vp-btn-primary vp-btn-tiny"'
          + ' onclick="startSittingFromCard(\'' + recordId + '\')">Start sitting</button>'
          + '</div></div>';
        return;
      }

      body += '<div class="vp-clock-row">'
        + '<div><div class="vp-pos-name">' + esc(eventNameOf(item.record.id)) + '</div>'
        + '<div class="vp-pos-desc">Duty shift, up to ' + Math.round(item.policy.maxSessionMinutes / 60 * 10) / 10 + ' h per day</div></div>'
        + '<button type="button" class="vp-btn vp-btn-primary vp-btn-tiny"'
        + ' onclick="openClaimDutyModal(\'' + recordId + '\')">Claim shift</button>'
        + '</div>';
    });
    body += '</div>';
  }
  card.innerHTML = '<div class="vp-card-head"><h2>Clock in and out</h2><span class="vp-count">' + items.length + ' available</span></div>'
    + '<div class="vp-card-body">' + body + '</div>';
}

function startSittingFromCard(opportunityId) {
  var select = el('vpSittingTask_' + opportunityId);
  startClock(opportunityId, select ? select.value : '');
}

function openStopClockModal() {
  var running = runningSession();
  if (!running) return;
  var start = new Date(running.session.startedAt);
  var now = new Date();
  openModal('Stop the clock',
    '<p style="margin-top:0;color:#64748b;font-size:0.92rem;">' + esc(eventNameOf(running.session.eventId)) + '</p>'
    + '<p>Started at <strong>' + esc(timeOfDay(start)) + '</strong>. Confirm the time you stopped.</p>'
    + '<div class="vp-field"><label for="vpStopTime">Stopped at</label>'
    + '<input class="vp-input" type="time" id="vpStopTime" value="' + esc(timeOfDay(now)) + '"></div>'
    + '<div class="vp-field"><label for="vpStopNote">What you did (optional)</label>'
    + '<textarea class="vp-textarea" id="vpStopNote" maxlength="500"></textarea></div>'
    + '<div class="vp-note">The line goes to the opportunity manager for approval. It can never pass the event window or the session cap.</div>',
    '<button type="button" class="vp-btn" onclick="closeModal()">Keep running</button>'
    + '<button type="button" class="vp-btn vp-btn-primary" onclick="confirmStopClock()">Stop and send</button>');
}

function confirmStopClock() {
  var running = runningSession();
  if (!running) return;
  var startDate = new Date(running.session.startedAt);
  var timeNode = el('vpStopTime');
  var noteNode = el('vpStopNote');
  var endDate = dateAt(localDateIso(startDate), timeNode ? timeNode.value : '');
  if (!endDate) { notifyHost('Enter the time you stopped.', 'warning'); return; }
  /* A sitting can run past midnight: an earlier clock time means the next day. */
  if (endDate.getTime() <= startDate.getTime()) {
    endDate = new Date(endDate.getTime() + 24 * 60 * 60000);
  }
  stopClock(endDate.toISOString(), { note: noteNode ? noteNode.value : '' });
}

/* Chat duty is a claimed shift, not a live clock: the volunteer states the
   time box and how many messages were answered. One shift per day. */
function openClaimDutyModal(opportunityId) {
  if (!APP.profileObject) { notifyHost('A volunteer profile is needed before you can claim a shift.', 'warning'); return; }
  if (!canWork()) { notifyHost('This view is read only.', 'warning'); return; }
  if (APP.profileData.status === 'candidate') { notifyHost('A manager has to accept you into the volunteer network before you can claim a shift.', 'warning'); return; }

  var relation = relationForEvent(opportunityId);
  if (!relation || relationData(relation).status !== 'approved') {
    notifyHost('Only an approved place can be claimed.', 'warning');
    return;
  }
  var record = eventById(opportunityId);
  if (!record) return;
  var policy = timerPolicyOf(record);
  var today = localDateIso(new Date());
  var alreadyToday = (Array.isArray(relationData(relation).pendingHours) ? relationData(relation).pendingHours : []).some(function (row) {
    return row.source === 'duty' && row.date === today;
  });
  if (alreadyToday) { notifyHost('A duty shift is already logged for today.', 'info'); return; }

  var dutyWeek = weekRangeFor(new Date());
  var dutyUsedThisWeek = minutesRecordedFor(opportunityId, dutyWeek.from, dutyWeek.to);
  var dutyLeftThisWeek = policy.weeklyMaxMinutes - dutyUsedThisWeek;
  if (dutyLeftThisWeek <= 0) {
    notifyHost('The weekly limit for this duty is reached. A manager can review the week.', 'warning');
    return;
  }

  var capHours = Math.round(policy.maxSessionMinutes / 60 * 10) / 10;
  var leftHours = Math.round(dutyLeftThisWeek / 60 * 10) / 10;
  openModal('Claim a duty shift',
    '<p style="margin-top:0;color:#64748b;font-size:0.92rem;">' + esc(eventNameOf(opportunityId)) + ' - ' + esc(today) + '</p>'
    + '<div class="vp-field"><label for="vpDutyStart">From</label>'
    + '<input class="vp-input" type="time" id="vpDutyStart" value="19:00"></div>'
    + '<div class="vp-field"><label for="vpDutyEnd">To</label>'
    + '<input class="vp-input" type="time" id="vpDutyEnd" value="21:00"></div>'
    + '<div class="vp-field"><label for="vpDutyAnswered">Messages answered</label>'
    + '<input class="vp-input" type="number" id="vpDutyAnswered" min="0" step="1" value="0"></div>'
    + '<div class="vp-field"><label for="vpDutyNote">What came up (optional)</label>'
    + '<textarea class="vp-textarea" id="vpDutyNote" maxlength="500"></textarea></div>'
    + '<div class="vp-note">A shift is at most ' + capHours + ' h on one day, and '
    + leftHours + ' h are left this week. The volume of messages is logged next to the time, so a busy shift can be reviewed fairly.</div>',
    '<button type="button" class="vp-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="vp-btn vp-btn-primary" onclick="submitDutyShift(\'' + escJs(opportunityId) + '\')">Send shift</button>');
}

function submitDutyShift(opportunityId) {
  var relation = relationForEvent(opportunityId);
  if (!relation) return;
  var record = eventById(opportunityId);
  if (!record) return;
  var policy = timerPolicyOf(record);
  var today = localDateIso(new Date());

  var startNode = el('vpDutyStart');
  var endNode = el('vpDutyEnd');
  var answeredNode = el('vpDutyAnswered');
  var noteNode = el('vpDutyNote');

  var startDate = dateAt(today, startNode ? startNode.value : '');
  var endDate = dateAt(today, endNode ? endNode.value : '');
  if (!startDate || !endDate) { notifyHost('Enter the start and end time of the shift.', 'warning'); return; }
  var minutes = minutesBetween(startDate.toISOString(), endDate.toISOString());
  if (minutes < 1) { notifyHost('The end time has to be after the start time.', 'warning'); return; }
  if (minutes > policy.maxSessionMinutes) {
    notifyHost('A duty shift is at most ' + Math.round(policy.maxSessionMinutes / 60 * 10) / 10 + ' h. Split the rest into another day.', 'warning');
    return;
  }
  var dutyWeek = weekRangeFor(new Date());
  var dutyLeftThisWeek = policy.weeklyMaxMinutes - minutesRecordedFor(opportunityId, dutyWeek.from, dutyWeek.to);
  if (minutes > dutyLeftThisWeek) {
    notifyHost('Only ' + Math.round(dutyLeftThisWeek / 60 * 10) / 10 + ' h are left this week for this duty.', 'warning');
    return;
  }

  var data = simpleCopy(relationData(relation));
  var pending = Array.isArray(data.pendingHours) ? data.pendingHours.slice() : [];
  if (pending.length >= 60) { notifyHost('60 hour lines are already waiting. Ask the manager to approve them first.', 'warning'); return; }
  var dutyExists = pending.some(function (line) {
    return line.source === 'duty' && line.date === today;
  });
  if (dutyExists) { notifyHost('A duty shift is already logged for today.', 'info'); closeModal(); return; }

  pending.push({
    id: 'ph_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    source: 'duty',
    date: today,
    startTime: timeOfDay(startDate),
    endTime: timeOfDay(endDate),
    minutes: minutes,
    hours: roundToStep(minutes, policy.roundingMinutes) / 60,
    answered: Math.max(0, Math.round(toNumber(answeredNode ? answeredNode.value : 0))),
    note: String(noteNode ? noteNode.value : '').slice(0, 500),
    taskId: '',
    taskTitle: '',
    unverified: false,
    submittedAt: isoNow()
  });

  data.pendingHours = pending;
  data.updatedAt = isoNow();

  updateObject(typeRelation(), relation.id, data, personNameOf(APP.profileObject), function (error) {
    if (error) { notifyHost('Could not send the shift: ' + error, 'error'); return; }
    closeModal();
    notifyHost('Duty shift sent for approval.', 'success');
    loadAll();
  });
}

/* A stale close is unverified: the volunteer confirms or corrects the end. */
function openAdjustTimedLineModal(eventId, pendingId) {
  var relation = relationForEvent(eventId);
  if (!relation) return;
  var line = null;
  (Array.isArray(relationData(relation).pendingHours) ? relationData(relation).pendingHours : []).forEach(function (row) {
    if (row.id === pendingId) line = row;
  });
  if (!line) return;

  openModal('Check the end time',
    '<p style="margin-top:0;color:#64748b;font-size:0.92rem;">' + esc(eventNameOf(eventId)) + '</p>'
    + '<p>This session was closed for you because the page was not open. Started at <strong>'
    + esc(line.startTime || '-') + '</strong>. Confirm the real end time.</p>'
    + '<div class="vp-field"><label for="vpAdjustTime">Stopped at</label>'
    + '<input class="vp-input" type="time" id="vpAdjustTime" value="' + esc(line.endTime || '') + '"></div>'
    + '<div class="vp-note">Only the end time changes. The manager still approves the line.</div>',
    '<button type="button" class="vp-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="vp-btn vp-btn-primary" onclick="saveTimedLineEnd(\'' + escJs(eventId) + '\',\'' + escJs(pendingId) + '\')">Save</button>');
}

function saveTimedLineEnd(eventId, pendingId) {
  var relation = relationForEvent(eventId);
  if (!relation) return;
  var data = simpleCopy(relationData(relation));
  var pending = Array.isArray(data.pendingHours) ? data.pendingHours.slice() : [];
  var line = null;
  for (var index = 0; index < pending.length; index++) {
    if (pending[index].id === pendingId) { line = pending[index]; break; }
  }
  if (!line) return;

  var startDate = dateAt(line.date, line.startTime || '00:00');
  var timeNode = el('vpAdjustTime');
  var endDate = dateAt(line.date, timeNode ? timeNode.value : '');
  if (!startDate || !endDate) { notifyHost('Enter a valid end time.', 'warning'); return; }
  var minutes = minutesBetween(startDate.toISOString(), endDate.toISOString());
  if (minutes < 1) { notifyHost('The end time has to be after the start.', 'warning'); return; }

  line.endTime = timeOfDay(endDate);
  line.minutes = minutes;
  line.hours = roundToStep(minutes, TIMER_DEFAULTS.roundingMinutes) / 60;
  line.unverified = false;
  data.pendingHours = pending;
  data.updatedAt = isoNow();

  updateObject(typeRelation(), relation.id, data, personNameOf(APP.profileObject), function (error) {
    if (error) { notifyHost('Could not save the end time: ' + error, 'error'); return; }
    notifyHost('End time confirmed.', 'success');
    closeModal();
    loadAll();
  });
}

function removePendingHours(eventId, pendingId) {
  var relation = relationForEvent(eventId);
  if (!relation) return;
  var data = simpleCopy(relationData(relation));
  data.pendingHours = (data.pendingHours || []).filter(function (line) { return line.id !== pendingId; });
  data.updatedAt = isoNow();
  updateObject(typeRelation(), relation.id, data, personNameOf(APP.profileObject), function (error) {
    if (error) { notifyHost('Could not remove the line: ' + error, 'error'); return; }
    notifyHost('Hour line removed.', 'info');
    closeModal();
    loadAll();
  });
}

/* Manager approves a pending line: append to the person ledger, then clear the pending line. */
function approvePendingHours(eventId, pendingId) {
  if (!APP.isManager || APP.readOnly) return;
  var relation = relationForEvent(eventId);
  if (!relation) return;

  var relationRecord = relationData(relation);
  var pending = Array.isArray(relationRecord.pendingHours) ? relationRecord.pendingHours : [];
  var line = null;
  for (var index = 0; index < pending.length; index++) {
    if (pending[index].id === pendingId) { line = pending[index]; break; }
  }
  if (!line) return;

  var ledgerId = relation.id + ':' + line.id;
  var profileDataCopy = simpleCopy(APP.profileData);
  var ledger = Array.isArray(profileDataCopy.hoursLedger) ? profileDataCopy.hoursLedger.slice() : [];

  var alreadyThere = ledger.some(function (entry) { return entry.id === ledgerId; });
  if (!alreadyThere) {
    ledger.push({
      id: ledgerId,
      eventId: eventId,
      eventName: eventNameOf(eventId),
      eventDate: eventDataOf(eventId).startDate || line.date || '',
      taskSummary: (line.taskTitle || 'General') + ' (' + toNumber(line.hours).toFixed(1) + ' h)',
      hours: toNumber(line.hours),
      approvedBy: APP.user ? (APP.user.name || APP.user.email || '') : '',
      approvedAt: isoNow()
    });
    if (ledger.length > 500) ledger = collapseOldestYear(ledger);
  }

  profileDataCopy.hoursLedger = ledger;
  profileDataCopy.totals = {
    hoursApproved: sumLedgerHours(ledger),
    eventsAttended: countLedgerEvents(ledger),
    tasksCompleted: toNumber((profileDataCopy.totals || {}).tasksCompleted)
  };
  profileDataCopy.updatedAt = isoNow();

  updateObject(typePerson(), APP.profileObject.id, profileDataCopy, personNameOf(APP.profileObject), function (personError) {
    if (personError) { notifyHost('Could not write the hours ledger: ' + personError, 'error'); return; }

    var relationCopy = simpleCopy(relationRecord);
    relationCopy.pendingHours = (relationCopy.pendingHours || []).filter(function (entry) { return entry.id !== pendingId; });
    relationCopy.hoursApprovedTotal = toNumber(relationCopy.hoursApprovedTotal) + toNumber(line.hours);
    relationCopy.lastApprovedAt = isoNow();
    var approvedIds = Array.isArray(relationCopy.approvedLedgerIds) ? relationCopy.approvedLedgerIds.slice() : [];
    if (approvedIds.indexOf(ledgerId) === -1) approvedIds.push(ledgerId);
    relationCopy.approvedLedgerIds = approvedIds.slice(-60);
    relationCopy.updatedAt = isoNow();

    updateObject(typeRelation(), relation.id, relationCopy, personNameOf(APP.profileObject), function (relationError) {
      if (relationError) { notifyHost('Hours approved, but the membership line could not be cleared: ' + relationError, 'warning'); }
      else notifyHost('Hours approved.', 'success');
      closeModal();
      loadAll();
    });
  });
}

function rejectPendingHours(eventId, pendingId) {
  if (!APP.isManager || APP.readOnly) return;
  var relation = relationForEvent(eventId);
  if (!relation) return;
  var relationRecord = relationData(relation);
  var pending = Array.isArray(relationRecord.pendingHours) ? relationRecord.pendingHours : [];
  var line = null;
  for (var index = 0; index < pending.length; index++) {
    if (pending[index].id === pendingId) { line = pending[index]; break; }
  }
  if (!line) return;

  var data = simpleCopy(relationRecord);
  data.pendingHours = pending.filter(function (entry) { return entry.id !== pendingId; });
  var history = Array.isArray(data.hoursHistory) ? data.hoursHistory.slice() : [];
  history.push({
    id: line.id,
    date: line.date,
    hours: toNumber(line.hours),
    status: 'rejected',
    reviewedBy: APP.user ? (APP.user.name || '') : '',
    reviewedAt: isoNow()
  });
  data.hoursHistory = history.slice(-40);
  data.updatedAt = isoNow();

  updateObject(typeRelation(), relation.id, data, personNameOf(APP.profileObject), function (error) {
    if (error) { notifyHost('Could not reject: ' + error, 'error'); return; }
    notifyHost('Hour line rejected.', 'info');
    closeModal();
    loadAll();
  });
}

function collapseOldestYear(ledger) {
  var detail = ledger.filter(function (line) { return !line.summary; });
  var summaries = ledger.filter(function (line) { return line.summary; });
  if (detail.length < 500) return ledger;

  var oldestYear = null;
  detail.forEach(function (line) {
    var year = String(line.eventDate || line.approvedAt || '').slice(0, 4);
    if (!year) return;
    if (!oldestYear || year < oldestYear) oldestYear = year;
  });
  if (!oldestYear) return ledger.slice(-500);

  var collapsedHours = 0;
  var collapsedEvents = 0;
  var remaining = [];
  detail.forEach(function (line) {
    var year = String(line.eventDate || line.approvedAt || '').slice(0, 4);
    if (year === oldestYear) {
      collapsedHours += toNumber(line.hours);
      collapsedEvents += 1;
    } else {
      remaining.push(line);
    }
  });

  summaries.push({
    id: 'summary-' + oldestYear,
    summary: true,
    year: oldestYear,
    hours: Math.round(collapsedHours * 10) / 10,
    events: collapsedEvents
  });

  return summaries.concat(remaining);
}

function sumLedgerHours(ledger) {
  var total = 0;
  ledger.forEach(function (line) { total += toNumber(line.hours); });
  return Math.round(total * 10) / 10;
}

function countLedgerEvents(ledger) {
  var seen = {};
  ledger.forEach(function (line) {
    if (line.summary) { seen['summary-' + line.year] = true; return; }
    if (line.eventId) seen[line.eventId] = true;
  });
  return Object.keys(seen).length;
}

/* ---------------- writing: task progress ---------------- */
function setTaskLinkStatus(eventId, taskId, nextStatus) {
  var relation = relationForEvent(eventId);
  if (!relation) return;
  if (APP.readOnly) { notifyHost('This record is read only.', 'info'); return; }

  var data = simpleCopy(relationData(relation));
  var links = Array.isArray(data.taskLinks) ? data.taskLinks.slice() : [];
  var found = null;
  for (var index = 0; index < links.length; index++) {
    if (links[index].taskId === taskId) { found = links[index]; break; }
  }
  if (!found) {
    if (links.length >= 40) { notifyHost('This membership already has 40 task rows.', 'warning'); return; }
    found = { taskId: taskId, status: nextStatus };
    links.push(found);
  }
  found.status = nextStatus;
  if (nextStatus === 'in-progress') found.startedAt = isoNow();
  if (nextStatus === 'reported-done') found.reportedAt = isoNow();
  if (nextStatus === 'confirmed') { found.confirmedAt = isoNow(); found.confirmedBy = APP.user ? (APP.user.name || '') : ''; }

  data.taskLinks = links;
  data.updatedAt = isoNow();

  updateObject(typeRelation(), relation.id, data, personNameOf(APP.profileObject), function (error) {
    if (error) { notifyHost('Could not update the task: ' + error, 'error'); return; }
    notifyHost(nextStatus === 'reported-done' ? 'Marked as done. The opportunity team will confirm it.' : 'Task updated.', 'success');
    loadAll();
  });
}

/* ---------------- writing: messages ---------------- */
function sendEventMessage(eventId, subject, body) {
  var volumes = APP.messageDocs.filter(function (doc) { return vd(doc).eventId === eventId; })
    .sort(function (docA, docB) { return toNumber(vd(docB).volume || 1) - toNumber(vd(docA).volume || 1); });
  var openVolume = null;
  for (var index = 0; index < volumes.length; index++) {
    if (!vd(volumes[index]).closed) { openVolume = volumes[index]; break; }
  }

  var message = {
    id: 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    fromUserId: currentUserId(),
    fromName: APP.user ? (APP.user.name || APP.user.email || 'Volunteer') : 'Volunteer',
    fromRole: APP.isManager ? 'manager' : 'volunteer',
    subject: String(subject || '').slice(0, 200),
    body: String(body || '').slice(0, 2000),
    sentAt: isoNow(),
    audience: 'team',
    readBy: [currentUserId()]
  };

  function writeInto(doc) {
    var data = doc ? simpleCopy(vd(doc)) : { eventId: eventId, eventName: eventNameOf(eventId), volume: 1, closed: false, messages: [] };
    var list = Array.isArray(data.messages) ? data.messages.slice() : [];
    list.unshift(message);
    data.messages = list.slice(0, 150);
    data.firstSentAt = data.firstSentAt || message.sentAt;
    data.lastSentAt = message.sentAt;
    data.updatedAt = isoNow();

    if (doc) {
      updateObject(typeMessages(), doc.id, data, vd(doc).eventName || eventNameOf(eventId), function (error) {
        if (error) { notifyHost('Could not send the message: ' + error, 'error'); return; }
        notifyHost('Message sent to the opportunity team.', 'success');
        closeModal();
        loadAll();
      });
      return;
    }

    createObject(typeMessages(), eventNameOf(eventId) + ' messages', data, function (error) {
      if (error) { notifyHost('Could not send the message: ' + error, 'error'); return; }
      notifyHost('Message sent to the opportunity team.', 'success');
      closeModal();
      loadAll();
    });
  }

  writeInto(openVolume);
}

function markMessagesRead(eventId) {
  var myUserId = currentUserId();
  if (!myUserId) return;
  var docs = APP.messageDocs.filter(function (doc) { return vd(doc).eventId === eventId; });
  docs.forEach(function (doc) {
    var data = simpleCopy(vd(doc));
    var changed = false;
    var list = Array.isArray(data.messages) ? data.messages.slice() : [];
    list.forEach(function (message) {
      var readBy = Array.isArray(message.readBy) ? message.readBy.slice() : [];
      if (readBy.indexOf(myUserId) === -1) { readBy.push(myUserId); message.readBy = readBy; changed = true; }
    });
    if (!changed) return;
    data.messages = list;
    data.updatedAt = isoNow();
    updateObject(typeMessages(), doc.id, data, vd(doc).eventName || eventNameOf(eventId), function () { /* read flags are best effort */ });
  });
}

/* ---------------- writing: profile ---------------- */
function saveProfileDetails(formValues) {
  if (!canEditProfile()) { notifyHost('You cannot edit this profile.', 'warning'); return; }
  var data = simpleCopy(APP.profileData);
  data.firstName = String(formValues.firstName || '').slice(0, 80);
  data.lastName = String(formValues.lastName || '').slice(0, 80);
  data.email = String(formValues.email || '').slice(0, 160);
  data.phone = String(formValues.phone || '').slice(0, 40);
  data.city = String(formValues.city || '').slice(0, 80);
  data.skills = String(formValues.skills || '').slice(0, 500);
  data.availabilityNotes = String(formValues.availabilityNotes || '').slice(0, 300);
  data.languages = String(formValues.languages || '').slice(0, 200);
  data.emergencyContactName = String(formValues.emergencyContactName || '').slice(0, 80);
  data.emergencyContactPhone = String(formValues.emergencyContactPhone || '').slice(0, 40);
  data.updatedAt = isoNow();
  if (APP.isManager && formValues.networkStatus) data.status = formValues.networkStatus;

  updateObject(typePerson(), APP.profileObject.id, data, personNameOf(APP.profileObject, data), function (error) {
    if (error) { notifyHost('Could not save the profile: ' + error, 'error'); return; }
    notifyHost('Profile saved.', 'success');
    loadAll();
  });
}

/* ---------------- generic helpers ---------------- */
function simpleCopy(source) {
  var copy = {};
  if (!source) return copy;
  for (var key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) copy[key] = source[key];
  }
  return copy;
}

/* ---------------- rendering: shell ---------------- */
function renderAll() {
  var profileName = APP.profileObject ? personNameOf(APP.profileObject) : 'Volunteer profile';
  var profileMail = APP.profileData.email || 'no email on record';
  var networkStatus = APP.profileData.status || 'candidate';

  el('vpPersonName').textContent = profileName;
  el('vpPersonMail').textContent = profileMail;
  el('vpAvatar').textContent = initialsFor(profileName);
  el('vpRolePill').textContent = APP.isManager ? (isOwnProfile() ? 'Manager - my record' : 'Manager view') : 'Volunteer';
  el('vpModalClose').style.display = '';

  var openTasks = openTaskRows().length;
  var pending = hoursTotals().pending;
  var unread = unreadMessageCount();

  el('vpBadgeOpportunities').textContent = String(openOpportunityRecords().length);
  el('vpBadgeEvents').textContent = String(relationsOfProfile().length);
  el('vpBadgeTasks').textContent = String(openTasks);
  el('vpBadgeHours').textContent = pending > 0 ? pending.toFixed(1) + ' h' : '0';
  el('vpBadgeHours').className = 'vp-nav-badge' + (pending > 0 ? ' hot' : '');
  el('vpBadgeMessages').textContent = String(unread);
  el('vpBadgeMessages').className = 'vp-nav-badge' + (unread > 0 ? ' hot' : '');

  var headerTags = [];
  if (APP.profileData.city) headerTags.push(esc(APP.profileData.city));
  if (APP.profileData.status) headerTags.push(esc(networkStatusLabel(APP.profileData.status)));
  el('vpBrandTags').innerHTML = headerTags.map(function (tagText) {
    return '<span class="vp-header-chip">' + tagText + '</span>';
  }).join('');

  renderNavSelection();

  el('vpNavFoot').textContent = APP.isManager
    ? 'Manager view. Volunteer status: ' + statusLabel(networkStatus) + '.'
    : 'Your record lives in the volunteer network.';

  if (APP.isManager && APP.profileObject) {
    el('vpNavFoot').innerHTML = 'Manager view - ' + badge(networkStatus);
  }

  renderDashboard();
  renderClockCard();
  renderClockStrip();
  renderOpportunities();
  renderEvents();
  renderTasks();
  renderHours();
  renderMessages();
  renderCertificate();
  renderProfileForm();

  var networkNavButton = el('vpNavNetwork');
  if (networkNavButton) networkNavButton.hidden = !APP.isManager;
  renderNetwork();

  try { tool.resize(); } catch (error) { /* host resize is optional */ }
}

/* ---------------- volunteer network (manager acceptance) ---------------- */
function networkStatusOf(personObject) {
  return vd(personObject).status || 'candidate';
}

function networkRows() {
  var filterId = APP.networkFilter || 'all';
  var rows = (APP.persons || []).filter(function (personObject) {
    var status = networkStatusOf(personObject);
    if (filterId === 'pending') return status === 'candidate';
    if (filterId === 'active') return status === 'active';
    return true;
  });
  return rows.sort(function (personA, personB) {
    var pendingA = networkStatusOf(personA) === 'candidate' ? 0 : 1;
    var pendingB = networkStatusOf(personB) === 'candidate' ? 0 : 1;
    if (pendingA !== pendingB) return pendingA - pendingB;
    return personNameOf(personA).localeCompare(personNameOf(personB));
  });
}

function renderNetwork() {
  if (!APP.isManager) return;
  var listNode = el('vpNetworkList');
  if (!listNode) return;

  var pendingCount = (APP.persons || []).filter(function (personObject) {
    return networkStatusOf(personObject) === 'candidate';
  }).length;
  var navBadge = el('vpBadgeNetwork');
  if (navBadge) {
    navBadge.textContent = String(pendingCount);
    navBadge.className = 'vp-nav-badge' + (pendingCount > 0 ? ' hot' : '');
  }

  var filterOptions = [
    { id: 'all', label: 'Everyone' },
    { id: 'pending', label: 'Pending acceptance' },
    { id: 'active', label: 'Accepted' }
  ];
  el('vpNetworkFilters').innerHTML = filterOptions.map(function (option) {
    var isActive = (APP.networkFilter || 'all') === option.id;
    return '<button type="button" class="vp-filter-chip' + (isActive ? ' active' : '') + '"'
      + ' onclick="setNetworkFilter(\'' + option.id + '\')">' + esc(option.label) + '</button>';
  }).join('');

  var rows = networkRows();
  el('vpNetworkCount').textContent = rows.length + (rows.length === 1 ? ' person' : ' people');

  if (rows.length === 0) {
    listNode.innerHTML = '<div class="vp-empty">No volunteer profile matches this filter.</div>';
    return;
  }

  var html = '<div class="vp-table-wrap"><table class="vp-table"><thead><tr>'
    + '<th>Volunteer</th><th>City</th><th>Profile</th><th>Status</th><th></th>'
    + '</tr></thead><tbody>';
  rows.forEach(function (personObject) {
    var data = vd(personObject);
    var status = networkStatusOf(personObject);
    var completeness = profileCompletenessFor(data);
    var actions = '';
    if (status === 'candidate') {
      actions += '<button type="button" class="vp-btn vp-btn-tiny vp-btn-ok" onclick="acceptVolunteer(\'' + escJs(personObject.id) + '\')">Accept</button>';
    }
    if (status === 'active') {
      actions += '<button type="button" class="vp-btn vp-btn-tiny vp-btn-outline" onclick="setVolunteerStatus(\'' + escJs(personObject.id) + '\',\'inactive\')">Set not active</button>';
    }
    if (status === 'inactive') {
      actions += '<button type="button" class="vp-btn vp-btn-tiny vp-btn-outline" onclick="setVolunteerStatus(\'' + escJs(personObject.id) + '\',\'active\')">Accept again</button>';
    }
    if (status !== 'banned') {
      actions += '<button type="button" class="vp-btn vp-btn-tiny vp-btn-bad" onclick="openBlockVolunteerModal(\'' + escJs(personObject.id) + '\')">Block</button>';
    } else {
      actions += '<button type="button" class="vp-btn vp-btn-tiny vp-btn-outline" onclick="setVolunteerStatus(\'' + escJs(personObject.id) + '\',\'candidate\')">Unblock</button>';
    }

    html += '<tr>'
      + '<td><div class="vp-cell-main">' + esc(personNameOf(personObject)) + '</div>'
      + '<div class="vp-cell-sub">' + esc(data.email || 'no email') + '</div></td>'
      + '<td>' + esc(data.city || '-') + '</td>'
      + '<td><div class="vp-meter"><div class="vp-meter-bar"><div class="vp-meter-fill" style="width:' + completeness.percent + '%"></div></div>'
      + '<span class="vp-meter-text">' + completeness.percent + '%</span></div></td>'
      + '<td>' + badge(status) + '</td>'
      + '<td><div class="vp-actions">' + actions + '</div></td>'
      + '</tr>';
  });
  html += '</tbody></table></div>';
  listNode.innerHTML = html;
}

function setNetworkFilter(filterId) {
  APP.networkFilter = filterId === 'pending' || filterId === 'active' ? filterId : 'all';
  renderNetwork();
}

function acceptVolunteer(personId) {
  setVolunteerStatus(personId, 'active', 'Volunteer accepted into the network.');
}

function openBlockVolunteerModal(personId) {
  if (!APP.isManager) return;
  openModal('Block this volunteer?',
    '<p>Blocking stops the person from applying to any opportunity. Approved hours stay on their record.</p>'
    + '<div class="vp-note">You can undo this from the same list.</div>',
    '<button type="button" class="vp-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="vp-btn vp-btn-primary" onclick="closeModal();setVolunteerStatus(\'' + escJs(personId) + '\',\'banned\')">Block</button>');
}

/* Acceptance into the volunteer network is this tool's decision. Event
   placements are accepted in the event manager tool. */
function setVolunteerStatus(personId, nextStatus, successMessage) {
  if (!APP.isManager || APP.readOnly) return;
  var personObject = null;
  (APP.persons || []).forEach(function (candidatePerson) {
    if (candidatePerson.id === personId) personObject = candidatePerson;
  });
  if (!personObject) { notifyHost('That volunteer record could not be found.', 'warning'); return; }

  var nextData = simpleCopy(vd(personObject));
  nextData.status = nextStatus;
  nextData.updatedAt = isoNow();

  updateObject(typePerson(), personId, nextData, personNameOf(personObject), function (error) {
    if (error) { notifyHost('Could not change the volunteer status: ' + error, 'error'); return; }
    notifyHost(successMessage || ('Volunteer status set to ' + statusLabel(nextStatus) + '.'), 'success');
    if (APP.profileObject && APP.profileObject.id === personId) APP.profileData.status = nextStatus;
    loadAll();
  });
}

function renderDashboard() {
  var totals = hoursTotals();
  var openTasks = openTaskRows().length;
  var approvedRelations = relationsOfProfile().filter(function (relation) {
    return relationData(relation).status === 'approved';
  }).length;

  var statsHtml = ''
    + statCard(String(approvedRelations), 'Approved opportunities')
    + statCard(String(openTasks), 'Open tasks')
    + statCard(totals.approved.toFixed(1), 'Hours approved')
    + statCard(totals.pending.toFixed(1), 'Hours waiting');
  el('vpStats').innerHTML = statsHtml;

  /* start card: what this person should do next */
  var startHtml = '';
  if (!APP.profileObject) {
    var signedInHint = APP.user && (APP.user.name || APP.user.email)
      ? 'You are signed in as ' + esc(APP.user.name || APP.user.email) + ', but no volunteer profile is attached to this account. '
      : '';
    startHtml = '<div class="vp-empty"><strong>No volunteer profile is linked yet</strong>'
      + signedInHint
      + 'Ask ' + esc(orgName()) + ' to create your volunteer profile, or to attach this tool to your profile. Then reload the page.'
      + '</div>';
  } else if (APP.profileData.status === 'candidate') {
    startHtml = '<div class="vp-empty"><strong>Waiting for acceptance</strong>'
      + 'A manager accepts you into the volunteer network before you can apply for an opportunity. '
      + 'Use the time to complete your details, so the first review is quick.'
      + '</div>' + profileChecklistHtml();
  } else if (relationsOfProfile().length === 0) {
    startHtml = '<div class="vp-empty"><strong>You have not joined anything yet</strong>'
      + 'Open <em>Find opportunities</em> to see every event, project and role that needs volunteers.'
      + '<div style="margin-top:10px;"><button type="button" class="vp-btn vp-btn-primary" onclick="showView(\'opportunities\')">Find opportunities</button></div>'
      + '</div>' + profileChecklistHtml();
  } else {
    var nextEventId = '';
    var nextDate = '9999-12-31';
    relationsOfProfile().forEach(function (relation) {
      var data = relationData(relation);
      if (data.status !== 'approved') return;
      var start = eventDataOf(data.eventId).startDate || '9999-12-31';
      if (start < nextDate) { nextDate = start; nextEventId = data.eventId; }
    });
    if (nextEventId) {
      var eventData = eventDataOf(nextEventId);
      startHtml = '<div class="vp-cell-main" style="font-size:1rem;">' + esc(eventNameOf(nextEventId)) + '</div>'
        + '<div class="vp-cell-sub">' + esc(recordWhenText(nextEventId)) + (eventData.locationName ? ' - ' + esc(eventData.locationName) : '') + '</div>'
        + '<div class="vp-actions" style="margin-top:8px;">'
        + '<button type="button" class="vp-btn vp-btn-outline vp-btn-tiny" onclick="openEventMessages(\'' + escJs(nextEventId) + '\')">Open messages</button>'
        + '<button type="button" class="vp-btn vp-btn-tiny" onclick="openLogHoursModal(\'' + escJs(nextEventId) + '\')">Log hours</button>'
        + '</div>';
    } else {
      startHtml = '<div class="vp-note">Your membership requests are waiting for a manager decision.</div>';
    }
  }
  el('vpStartCard').innerHTML = '<div class="vp-card-head"><h2>Next step</h2></div><div class="vp-card-body">' + startHtml + '</div>';

  /* upcoming */
  var upcoming = myEventRecords().filter(function (record) {
    var data = vd(record);
    var relation = relationForEvent(record.id);
    if (!relation || relationData(relation).status !== 'approved') return false;
    return !data.startDate || data.startDate >= todayIso();
  }).slice(0, 4);

  var upcomingHtml = '';
  if (upcoming.length === 0) {
    upcomingHtml = '<div class="vp-empty">No upcoming commitments. Anything you join shows up here.</div>';
  } else {
    upcomingHtml = '<div class="vp-table-wrap"><table class="vp-table"><thead><tr><th>Opportunity</th><th>When</th><th>My roles</th><th>Tasks</th></tr></thead><tbody>';
    upcoming.forEach(function (record) {
      var data = vd(record);
      var relation = relationForEvent(record.id);
      var relationRecord = relationData(relation);
      var positions = Array.isArray(relationRecord.positions) ? relationRecord.positions : [];
      var taskRows = taskLinksOf(relation);
      var doneCount = taskRows.filter(function (row) { return row.status === 'confirmed'; }).length;
      upcomingHtml += '<tr>'
        + '<td><div class="vp-cell-main">' + esc(data.name || record.name) + '</div>'
        + '<div class="vp-cell-sub">' + esc(data.locationName || '-') + '</div></td>'
        + '<td>' + esc(opportunityWhenText(record)) + '</td>'
        + '<td>' + (positions.length ? esc(positions.map(function (position) { return position.name; }).join(', ')) : '-') + '</td>'
        + '<td>' + doneCount + ' / ' + taskRows.length + '</td>'
        + '</tr>';
    });
    upcomingHtml += '</tbody></table></div>';
  }
  el('vpUpcomingCard').innerHTML = '<div class="vp-card-head"><h2>Upcoming</h2></div><div class="vp-card-body flush">' + upcomingHtml + '</div>';

  /* recent activity */
  var activity = [];
  relationsOfProfile().forEach(function (relation) {
    var data = relationData(relation);
    if (data.appliedAt) {
      activity.push({ when: data.appliedAt, text: 'Applied to ' + eventNameOf(data.eventId), tag: 'Application' });
    }
    if (data.lastApprovedAt) {
      activity.push({ when: data.lastApprovedAt, text: 'Hours approved for ' + eventNameOf(data.eventId), tag: 'Hours' });
    }
    (Array.isArray(data.pendingHours) ? data.pendingHours : []).forEach(function (line) {
      if (line.submittedAt) {
        activity.push({
          when: line.submittedAt,
          text: toNumber(line.hours).toFixed(1) + ' h logged for ' + eventNameOf(data.eventId),
          tag: 'Hours'
        });
      }
    });
  });
  activity.sort(function (itemA, itemB) {
    return String(itemB.when || '').localeCompare(String(itemA.when || ''));
  });

  var activityHtml = '';
  if (activity.length === 0) {
    activityHtml = '<div class="vp-empty">Nothing has happened yet.</div>';
  } else {
    activityHtml = '<ul class="vp-activity">';
    activity.slice(0, 6).forEach(function (item) {
      activityHtml += '<li><span class="vp-cell-sub" style="min-width:96px;">' + esc(fmtDate(item.when)) + '</span>'
        + '<span>' + esc(item.text) + '</span>'
        + '<span class="vp-badge vp-badge-draft">' + esc(item.tag) + '</span></li>';
    });
    activityHtml += '</ul>';
  }
  el('vpRecentCard').innerHTML = '<div class="vp-card-head"><h2>Recent activity</h2></div><div class="vp-card-body">' + activityHtml + '</div>';
}

function statCard(value, label) {
  return '<div class="vp-stat"><div class="vp-stat-value">' + esc(value) + '</div>'
    + '<div class="vp-stat-label">' + esc(label) + '</div></div>';
}

function recordWhenText(eventId) {
  var record = eventById(eventId);
  return record ? opportunityWhenText(record) : '-';
}

/* The active opportunity selector in the menu. Anything the volunteer joined or
   asked for can be picked, so messages and logged hours default to it. */
function renderNavSelection() {
  var selectNode = el('vpNavEventSelect');
  var wrap = el('vpNavEvent');
  if (!selectNode || !wrap) return;

  var choices = [];
  relationsOfProfile().forEach(function (relation) {
    var data = relationData(relation);
    if (['approved', 'requested'].indexOf(data.status) === -1) return;
    if (!eventById(data.eventId)) return;
    choices.push({
      id: data.eventId,
      label: eventNameOf(data.eventId) + (data.status === 'requested' ? ' (requested)' : '')
    });
  });
  choices.sort(function (choiceA, choiceB) { return choiceA.label.localeCompare(choiceB.label); });

  if (choices.length === 0) {
    wrap.className = 'vp-nav-sub off';
    selectNode.innerHTML = '';
    return;
  }

  wrap.className = 'vp-nav-sub';
  var stillAvailable = choices.some(function (choice) { return choice.id === APP.selectedEventId; });
  if (!stillAvailable) APP.selectedEventId = choices[0].id;

  selectNode.innerHTML = choices.map(function (choice) {
    return '<option value="' + esc(choice.id) + '"' + (choice.id === APP.selectedEventId ? ' selected' : '') + '>'
      + esc(choice.label) + '</option>';
  }).join('');
  selectNode.value = APP.selectedEventId;
}

function setOpportunityTypeFilter(typeKey) {
  APP.catalogType = typeKey;
  renderOpportunities();
}

function onCatalogSearch(value) {
  APP.catalogSearch = value;
  renderOpportunities();
}

/* ---------------- rendering: opportunity catalog ---------------- */
function renderOpportunities() {
  var openRecords = openOpportunityRecords();
  el('vpOpportunityCount').textContent = openRecords.length + ' open';

  var typeKeys = ['all'];
  OPPORTUNITY_TYPES.forEach(function (typeInfo) { typeKeys.push(typeInfo.key); });
  openRecords.forEach(function (record) {
    var typeKey = opportunityTypeOf(record);
    if (typeKeys.indexOf(typeKey) === -1) typeKeys.push(typeKey);
  });

  el('vpOppTypeFilters').innerHTML = typeKeys.map(function (typeKey) {
    var label = typeKey === 'all' ? 'All' : opportunityTypeLabel(typeKey);
    var count = typeKey === 'all' ? openRecords.length : openRecords.filter(function (record) {
      return opportunityTypeOf(record) === typeKey;
    }).length;
    return '<button type="button" class="vp-filter-chip' + (APP.catalogType === typeKey ? ' active' : '') + '"'
      + ' onclick="setOpportunityTypeFilter(\'' + escJs(typeKey) + '\')">' + esc(label)
      + ' <span class="vp-filter-count">' + count + '</span></button>';
  }).join('');

  if (!APP.profileObject) {
    el('vpOpportunityList').innerHTML = '<div class="vp-card"><div class="vp-card-body"><div class="vp-empty">'
      + 'No profile loaded, so applications are turned off.</div></div></div>';
    return;
  }

  var records = catalogRecords();
  if (records.length === 0) {
    var emptyHint = (APP.catalogSearch || APP.catalogType !== 'all')
      ? 'Try another word or another volunteering type.'
      : 'Nothing is open for applications right now.';
    el('vpOpportunityList').innerHTML = '<div class="vp-card"><div class="vp-card-body"><div class="vp-empty">'
      + '<strong>No match</strong>' + esc(emptyHint) + '</div></div></div>';
    return;
  }

  el('vpOpportunityList').innerHTML = records.map(opportunityCardHtml).join('');
}

function opportunityCardHtml(record) {
  var data = vd(record);
  var typeKey = opportunityTypeOf(record);
  var relation = relationForEvent(record.id);
  var myStatus = relation ? relationData(relation).status : '';

  var detailParts = [opportunityWhenText(record), locationModeOf(data)];
  var commitment = commitmentText(data);
  if (commitment && typeKey === 'event') detailParts.push(commitment);

  var html = '<article class="vp-opp">'
    + '<div class="vp-opp-head">'
    + '<div class="vp-opp-heading">'
    + '<div class="vp-opp-title">' + esc(data.name || record.name) + '</div>'
    + '<div class="vp-opp-meta">' + opportunityTypeChip(typeKey)
    + detailParts.map(function (part) { return '<span>' + esc(part) + '</span>'; }).join('<span class="vp-opp-dot">&middot;</span>')
    + '</div></div>'
    + (myStatus ? '<div class="vp-opp-status">' + badge(myStatus) + '</div>' : '')
    + '</div>';

  if (data.description) {
    html += '<p class="vp-opp-desc">' + esc(data.description) + '</p>';
  }

  var positions = positionsOf(record);
  html += '<div class="vp-opp-positions">';
  if (positions.length === 0) {
    html += positionRowHtml(record, { id: '', name: 'General volunteer', description: 'Tell the team how you would like to help.', slots: 0 });
  } else {
    positions.forEach(function (position) { html += positionRowHtml(record, position); });
  }
  html += '</div></article>';
  return html;
}

function positionRowHtml(record, position) {
  var positionId = position.id || '';
  var filled = positionFilledCount(record.id, positionId);
  var slots = toNumber(position.slots);
  var mine = myPositionStatus(record.id, positionId);
  var actionHtml = '';

  if (mine === 'approved') {
    actionHtml = '<span class="vp-badge vp-badge-approved">I am in</span>';
  } else if (mine === 'requested') {
    actionHtml = '<span class="vp-badge vp-badge-requested">Requested</span>';
  } else if (slots > 0 && filled >= slots) {
    actionHtml = '<span class="vp-badge vp-badge-closed">Full</span>';
  } else if (!APP.profileObject) {
    actionHtml = '<span class="vp-cell-sub">No profile</span>';
  } else if (volunteerAcceptanceIssue()) {
    actionHtml = '<span class="vp-badge vp-badge-requested">'
      + (APP.profileData.status === 'candidate' ? 'Acceptance pending' : 'Not accepted') + '</span>';
  } else if (!canWork()) {
    actionHtml = '<span class="vp-cell-sub">Read only</span>';
  } else {
    actionHtml = '<button type="button" class="vp-btn vp-btn-tiny vp-btn-primary"'
      + ' onclick="openApplyPositionModal(\'' + escJs(record.id) + '\',\'' + escJs(positionId) + '\')">Apply</button>';
  }

  var slotText = slots > 0
    ? filled + ' of ' + slots + ' filled'
    : (filled > 0 ? filled + ' volunteer' + (filled === 1 ? '' : 's') : 'Open to volunteers');

  return '<div class="vp-pos-row">'
    + '<div class="vp-pos-main">'
    + '<div class="vp-pos-name">' + esc(position.name || 'Volunteer') + '</div>'
    + (position.description ? '<div class="vp-pos-desc">' + esc(position.description) + '</div>' : '')
    + (position.skills ? '<div class="vp-pos-skills">Skills: ' + esc(position.skills) + '</div>' : '')
    + '</div>'
    + '<div class="vp-pos-slots">' + esc(slotText) + '</div>'
    + '<div class="vp-pos-action">' + actionHtml + '</div>'
    + '</div>';
}

/* ---------------- rendering: my volunteering ---------------- */
function renderEvents() {
  var myRecords = relationsOfProfile();
  var joined = myRecords.filter(function (relation) { return relationData(relation).status !== 'removed'; });
  var pending = myRecords.filter(function (relation) { return relationData(relation).status === 'requested'; });

  el('vpMyEventCount').textContent = joined.length + ' opportunit' + (joined.length === 1 ? 'y' : 'ies');

  var myHtml = '';
  if (!APP.profileObject) {
    myHtml = '<div class="vp-empty">No profile loaded.</div>';
  } else if (joined.length === 0) {
    myHtml = '<div class="vp-empty"><strong>Nothing yet</strong>Open <em>Find opportunities</em> and apply for a role that fits you.</div>';
  } else {
    myHtml = '<div class="vp-table-wrap"><table class="vp-table"><thead><tr>'
      + '<th>Opportunity</th><th>When</th><th>Status</th><th>My roles</th><th>Tasks</th><th class="vp-num">Hours</th><th></th>'
      + '</tr></thead><tbody>';

    joined.forEach(function (relation) {
      var relationRecord = relationData(relation);
      var record = eventById(relationRecord.eventId);
      var data = record ? vd(record) : {};
      var positions = Array.isArray(relationRecord.positions) ? relationRecord.positions : [];
      var roleText = positions.length
        ? positions.map(function (position) { return position.name + (position.status === 'requested' ? ' (requested)' : ''); }).join(', ')
        : '-';
      var linkRows = taskLinksOf(relation);
      var confirmed = linkRows.filter(function (row) { return row.status === 'confirmed'; }).length;

      myHtml += '<tr>'
        + '<td><div class="vp-cell-main">' + esc(relationRecord.eventName || (record ? (data.name || record.name) : 'Opportunity')) + '</div>'
        + '<div class="vp-cell-sub vp-opp-type-line">' + opportunityTypeChip(record ? opportunityTypeOf(record) : 'event')
        + (data.locationName ? '<span>' + esc(data.locationName) + '</span>' : '') + '</div></td>'
        + '<td>' + esc(record ? opportunityWhenText(record) : '-') + '</td>'
        + '<td>' + badge(relationRecord.status) + '</td>'
        + '<td>' + esc(roleText) + '</td>'
        + '<td>' + confirmed + ' / ' + linkRows.length + '</td>'
        + '<td class="vp-num">' + toNumber(relationRecord.hoursApprovedTotal).toFixed(1) + ' h</td>'
        + '<td><div class="vp-actions">'
        + '<button type="button" class="vp-btn vp-btn-tiny vp-btn-outline" title="Open the team messages" onclick="openEventMessages(\'' + escJs(relationRecord.eventId) + '\')">Open</button>'
        + '<button type="button" class="vp-btn vp-btn-tiny" title="Log hours for this opportunity" onclick="openLogHoursModal(\'' + escJs(relationRecord.eventId) + '\')">Hours</button>'
        + '<button type="button" class="vp-btn vp-btn-tiny vp-btn-bad" onclick="openWithdrawModal(\'' + escJs(relationRecord.eventId) + '\')">Withdraw</button>'
        + '</div></td></tr>';
    });
    myHtml += '</tbody></table></div>';
  }
  el('vpMyEvents').innerHTML = myHtml;

  el('vpPendingRequestCount').textContent = pending.length + ' waiting';

  var pendingHtml = '';
  if (pending.length === 0) {
    pendingHtml = '<div class="vp-empty">No request is waiting for a manager.</div>';
  } else {
    pendingHtml = '<div class="vp-table-wrap"><table class="vp-table"><thead><tr>'
      + '<th>Opportunity</th><th>Roles requested</th><th>Applied</th><th></th></tr></thead><tbody>';
    pending.forEach(function (relation) {
      var relationRecord = relationData(relation);
      var positions = Array.isArray(relationRecord.positions) ? relationRecord.positions : [];
      pendingHtml += '<tr>'
        + '<td><div class="vp-cell-main">' + esc(relationRecord.eventName || eventNameOf(relationRecord.eventId)) + '</div></td>'
        + '<td>' + esc(positions.length ? positions.map(function (position) { return position.name; }).join(', ') : 'General volunteer') + '</td>'
        + '<td>' + esc(relationRecord.appliedAt ? fmtDate(relationRecord.appliedAt) : '-') + '</td>'
        + '<td><button type="button" class="vp-btn vp-btn-tiny vp-btn-bad" onclick="openWithdrawModal(\'' + escJs(relationRecord.eventId) + '\')">Cancel request</button></td>'
        + '</tr>';
    });
    pendingHtml += '</tbody></table></div>';
  }
  el('vpPendingRequests').innerHTML = pendingHtml;
}

function renderTasks() {
  var rows = myTaskRows();
  el('vpTaskCount').textContent = rows.length + ' task' + (rows.length === 1 ? '' : 's');

  var html = '';
  if (rows.length === 0) {
    html = '<div class="vp-empty"><strong>No tasks yet</strong>Tasks appear here after the opportunity team assigns them to you.</div>';
  } else {
    html = '<div class="vp-table-wrap"><table class="vp-table"><thead><tr>'
      + '<th>Task</th><th>Opportunity</th><th>Due</th><th>Status</th><th></th>'
      + '</tr></thead><tbody>';
    rows.forEach(function (row) {
      var definition = row.definition || {};
      var title = definition.title || row.link.title || 'Task';
      var dueDate = definition.dueDate || row.link.dueDate || '';
      var status = row.link.status || 'assigned';
      var actions = '';

      if (status === 'assigned' && canWork()) {
        actions += '<button type="button" class="vp-btn vp-btn-tiny" onclick="startTask(\'' + escJs(row.eventId) + '\',\'' + escJs(row.link.taskId) + '\')">Start</button>';
      }
      if (status === 'in-progress' && canWork()) {
        actions += '<button type="button" class="vp-btn vp-btn-tiny vp-btn-ok" onclick="reportTaskDone(\'' + escJs(row.eventId) + '\',\'' + escJs(row.link.taskId) + '\')">Report done</button>';
      }
      if (status === 'reported-done' && APP.isManager) {
        actions += '<button type="button" class="vp-btn vp-btn-tiny vp-btn-ok" onclick="confirmTask(\'' + escJs(row.eventId) + '\',\'' + escJs(row.link.taskId) + '\')">Confirm</button>';
      }
      actions += '<button type="button" class="vp-btn vp-btn-tiny vp-btn-outline" onclick="openLogHoursModal(\'' + escJs(row.eventId) + '\',\'' + escJs(row.link.taskId) + '\')">Log hours</button>';

      html += '<tr>'
        + '<td><div class="vp-cell-main">' + esc(title) + '</div>'
        + (definition.description ? '<div class="vp-cell-sub">' + esc(String(definition.description).slice(0, 120)) + '</div>' : '')
        + '</td>'
        + '<td>' + esc(eventNameOf(row.eventId)) + '</td>'
        + '<td>' + esc(dueDate ? fmtDate(dueDate) : '-') + '</td>'
        + '<td>' + badge(status) + '</td>'
        + '<td><div class="vp-actions">' + actions + '</div></td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
  }
  el('vpTaskList').innerHTML = html;
}

function renderHours() {
  var totals = hoursTotals();
  el('vpHoursSummary').innerHTML = '<div class="vp-stats" style="margin:0;">'
    + statCard(totals.approved.toFixed(1), 'Approved hours')
    + statCard(totals.pending.toFixed(1), 'Waiting for approval')
    + statCard(totals.rejected.toFixed(1), 'Rejected')
    + '</div>';

  var pendingRows = [];
  relationsOfProfile().forEach(function (relation) {
    var data = relationData(relation);
    (Array.isArray(data.pendingHours) ? data.pendingHours : []).forEach(function (line) {
      pendingRows.push({ eventId: data.eventId, line: line });
    });
  });

  var pendingHtml = '';
  if (pendingRows.length === 0) {
    pendingHtml = '<div class="vp-empty">Nothing is waiting for a manager.</div>';
  } else {
    pendingHtml = '<div class="vp-table-wrap"><table class="vp-table"><thead><tr>'
      + '<th>Date</th><th>Opportunity</th><th>Task</th><th class="vp-num">Hours</th><th></th>'
      + '</tr></thead><tbody>';
    pendingRows.forEach(function (row) {
      var isTimer = row.line.source === 'timer';
      var isSitting = row.line.source === 'sitting';
      var isDuty = row.line.source === 'duty';
      var sourceLabel = isDuty ? 'shift' : (isSitting ? 'sitting' : 'clocked');
      var clockDetail = (row.line.startTime && row.line.endTime)
        ? '<div class="vp-cell-sub">'
          + esc((row.line.startTime || '') + ' - ' + (row.line.endTime || '')) + ' ' + sourceLabel
          + (isDuty ? ' - ' + toNumber(row.line.answered) + ' answered' : '')
          + (row.line.unverified ? ' - end time to check' : '')
          + '</div>'
        : '';
      var clockAction = (!APP.isManager && (isTimer || isSitting) && row.line.unverified)
        ? '<button type="button" class="vp-btn vp-btn-tiny vp-btn-outline" onclick="openAdjustTimedLineModal(\''
          + escJs(row.eventId) + '\',\'' + escJs(row.line.id) + '\')">Check end</button>'
        : '';
      var sourceBadge = isDuty
        ? ' <span class="vp-badge vp-badge-in-progress">shift</span>'
        : (isSitting
          ? ' <span class="vp-badge vp-badge-in-progress">sitting</span>'
          : (isTimer ? ' <span class="vp-badge vp-badge-in-progress">clock</span>' : ''));

      pendingHtml += '<tr>'
        + '<td>' + esc(fmtDate(row.line.date)) + clockDetail + '</td>'
        + '<td>' + esc(eventNameOf(row.eventId)) + '</td>'
        + '<td>' + esc(row.line.taskTitle || 'General') + sourceBadge + '</td>'
        + '<td class="vp-num">' + toNumber(row.line.hours).toFixed(1) + '</td>'
        + '<td><div class="vp-actions">'
        + clockAction
        + (APP.isManager
          ? '<button type="button" class="vp-btn vp-btn-tiny vp-btn-ok" onclick="openApproveHoursModal(\'' + escJs(row.eventId) + '\',\'' + escJs(row.line.id) + '\')">Approve</button>'
            + '<button type="button" class="vp-btn vp-btn-tiny vp-btn-bad" onclick="openRejectHoursModal(\'' + escJs(row.eventId) + '\',\'' + escJs(row.line.id) + '\')">Reject</button>'
          : '<button type="button" class="vp-btn vp-btn-tiny" onclick="openRemoveHoursModal(\'' + escJs(row.eventId) + '\',\'' + escJs(row.line.id) + '\')">Remove</button>')
        + '</div></td></tr>';
    });
    pendingHtml += '</tbody></table></div>';
  }
  el('vpHoursPending').innerHTML = pendingHtml;

  var ledger = Array.isArray(APP.profileData.hoursLedger) ? APP.profileData.hoursLedger.slice() : [];
  ledger.sort(function (lineA, lineB) {
    return String(lineB.eventDate || lineB.approvedAt || '').localeCompare(String(lineA.eventDate || lineA.approvedAt || ''));
  });

  var ledgerHtml = '';
  if (ledger.length === 0) {
    ledgerHtml = '<div class="vp-empty">No approved hours yet.</div>';
  } else {
    ledgerHtml = '<div class="vp-table-wrap"><table class="vp-table"><thead><tr>'
      + '<th>Date</th><th>Opportunity</th><th>Task</th><th class="vp-num">Hours</th><th>Approved by</th>'
      + '</tr></thead><tbody>';
    ledger.forEach(function (line) {
      if (line.summary) {
        ledgerHtml += '<tr><td>' + esc(line.year) + '</td><td colspan="2"><em>Summary of earlier years</em></td>'
          + '<td class="vp-num">' + toNumber(line.hours).toFixed(1) + '</td>'
          + '<td>' + esc((line.events || 0) + ' opportunities') + '</td></tr>';
        return;
      }
      ledgerHtml += '<tr>'
        + '<td>' + esc(fmtDate(line.eventDate)) + '</td>'
        + '<td>' + esc(line.eventName || '-') + '</td>'
        + '<td>' + esc(line.taskSummary || '-') + '</td>'
        + '<td class="vp-num">' + toNumber(line.hours).toFixed(1) + '</td>'
        + '<td>' + esc(line.approvedBy || '-') + '</td></tr>';
    });
    ledgerHtml += '</tbody></table></div>';
  }
  el('vpHoursLedger').innerHTML = ledgerHtml;
}

function renderMessages() {
  var records = myEventRecords();
  var html = '';

  if (records.length === 0) {
    html = '<div class="vp-empty">Join an opportunity to see its team messages.</div>';
  } else {
    records.forEach(function (record) {
      var eventId = record.id;
      var entries = messagesOf(eventId);
      var isSelected = eventId === APP.selectedEventId;
      html += '<div class="vp-thread' + (isSelected ? ' selected' : '') + '">'
        + '<div class="vp-thread-head">'
        + '<button type="button" class="vp-thread-name" onclick="openEventMessages(\'' + escJs(eventId) + '\')">' + esc(vd(record).name || record.name) + '</button>'
        + '<span class="vp-cell-sub">' + entries.length + ' message' + (entries.length === 1 ? '' : 's') + '</span>'
        + '</div>';

      if (entries.length === 0) {
        html += '<div class="vp-cell-sub" style="padding:6px 0;">No messages yet.</div>';
      } else {
        entries.slice(0, 6).forEach(function (entry) {
          var message = entry.message || {};
          html += '<div class="vp-msg">'
            + '<div class="vp-msg-head"><strong>' + esc(message.fromName || 'Event team') + '</strong>'
            + '<span class="vp-cell-sub">' + esc(fmtDateTime(message.sentAt)) + '</span></div>'
            + '<div class="vp-msg-subject">' + esc(message.subject || '(no subject)') + '</div>'
            + '<div class="vp-msg-body">' + esc(String(message.body || '').slice(0, 400)) + '</div>'
            + '</div>';
        });
      }
      html += '</div>';
    });
    html += '<div class="vp-note">Opening a thread marks its messages as read for you.</div>';
  }
  el('vpMessageList').innerHTML = html;
}

function renderCertificate() {
  var ledger = Array.isArray(APP.profileData.hoursLedger) ? APP.profileData.hoursLedger : [];
  var totalHours = sumLedgerHours(ledger);
  var totalEvents = countLedgerEvents(ledger);

  var html = '<div class="vp-cert">'
    + '<div class="vp-cert-org">' + esc(orgName()) + '</div>'
    + '<div class="vp-cert-title">Certificate of Volunteer Service</div>'
    + '<div class="vp-cert-name">' + esc(APP.profileObject ? personNameOf(APP.profileObject) : 'Volunteer') + '</div>'
    + '<div class="vp-cert-line">for <strong>' + totalHours.toFixed(1) + ' approved hours</strong> across '
    + totalEvents + ' opportunit' + (totalEvents === 1 ? 'y' : 'ies') + '.</div>'
    + '<div class="vp-cert-date">Generated ' + esc(fmtDate(todayIso())) + '</div>'
    + '</div>';

  if (totalHours <= 0) {
    html += '<div class="vp-note vp-note-warn">A certificate needs at least one approved hour line.</div>';
  }
  el('vpCertificateBody').innerHTML = html;
  el('vpCertificateBtn').disabled = totalHours <= 0;
}

function renderProfileForm() {
  var statusPill = el('vpProfileStatus');
  statusPill.innerHTML = APP.profileObject ? badge(APP.profileData.status || 'candidate') : '';

  if (!APP.profileObject) {
    el('vpProfileForm').innerHTML = '<div class="vp-empty">No profile object is attached to this tool.</div>';
    return;
  }

  var disabled = canEditProfile() ? '' : ' disabled';
  var data = APP.profileData;
  var statusField = '';
  if (APP.isManager) {
    statusField = '<div class="vp-field"><label for="vpProfileStatusSelect">Volunteer status</label>'
      + '<select class="vp-select" id="vpProfileStatusSelect"' + disabled + '>'
      + ['candidate', 'active', 'inactive', 'banned'].map(function (status) {
        return '<option value="' + status + '"' + ((data.status || 'candidate') === status ? ' selected' : '') + '>'
          + esc(statusLabel(status)) + '</option>';
      }).join('')
      + '</select><div class="vp-hint">Acceptance into the network is a manager decision. Event placements are accepted in the event manager tool.</div></div>';
  }

  var html = '<div class="vp-field-row">'
    + '<div class="vp-field"><label for="vpFirstName">First name</label><input class="vp-input" id="vpFirstName" value="' + esc(data.firstName || '') + '"' + disabled + '></div>'
    + '<div class="vp-field"><label for="vpLastName">Last name</label><input class="vp-input" id="vpLastName" value="' + esc(data.lastName || '') + '"' + disabled + '></div>'
    + '</div>'
    + '<div class="vp-field-row">'
    + '<div class="vp-field"><label for="vpEmail">Email</label><input class="vp-input" id="vpEmail" value="' + esc(data.email || '') + '"' + disabled + '></div>'
    + '<div class="vp-field"><label for="vpPhone">Phone</label><input class="vp-input" id="vpPhone" value="' + esc(data.phone || '') + '"' + disabled + '></div>'
    + '</div>'
    + '<div class="vp-field-row">'
    + '<div class="vp-field"><label for="vpCity">City</label><input class="vp-input" id="vpCity" value="' + esc(data.city || '') + '"' + disabled + '></div>'
    + '<div class="vp-field"><label for="vpLanguages">Languages</label><input class="vp-input" id="vpLanguages" value="' + esc(data.languages || '') + '"' + disabled + '></div>'
    + '</div>'
    + '<div class="vp-field"><label for="vpSkills">Skills</label><input class="vp-input" id="vpSkills" value="' + esc(data.skills || '') + '"' + disabled + '>'
    + '<div class="vp-hint">Short list, separated by commas. Maximum 500 characters.</div></div>'
    + '<div class="vp-field"><label for="vpAvailability">Availability</label><input class="vp-input" id="vpAvailability" value="' + esc(data.availabilityNotes || '') + '"' + disabled + '></div>'
    + '<div class="vp-field-row">'
    + '<div class="vp-field"><label for="vpEmergencyName">Emergency contact</label><input class="vp-input" id="vpEmergencyName" value="' + esc(data.emergencyContactName || '') + '"' + disabled + '></div>'
    + '<div class="vp-field"><label for="vpEmergencyPhone">Emergency phone</label><input class="vp-input" id="vpEmergencyPhone" value="' + esc(data.emergencyContactPhone || '') + '"' + disabled + '></div>'
    + '</div>'
    + statusField;

  if (canEditProfile()) {
    html += '<div class="vp-actions" style="margin-top:6px;">'
      + '<button type="button" class="vp-btn vp-btn-primary" onclick="saveProfileFromForm()">Save my details</button>'
      + '</div>';
  } else {
    html += '<div class="vp-note">This record is read only for you.</div>';
  }

  el('vpProfileForm').innerHTML = html;
}

function canWork() {
  return !APP.readOnly && (APP.isManager || isOwnProfile());
}

/* Acceptance into the network is the profile tool's decision, so every write
   action asks the same question first. */
function volunteerAcceptanceIssue() {
  var status = APP.profileData.status || 'candidate';
  if (status === 'active') return '';
  if (status === 'candidate') return 'A manager has to accept you into the volunteer network first.';
  return 'Your volunteer record is ' + statusLabel(status).toLowerCase() + ', so this action is closed. Ask the volunteer team.';
}

/* ---------------- views, selection ---------------- */
function showView(view) {
  APP.view = view;
  var buttons = document.querySelectorAll('.vp-nav-btn');
  for (var index = 0; index < buttons.length; index++) {
    var button = buttons[index];
    button.classList.toggle('active', button.getAttribute('data-view') === view);
  }
  var panels = document.querySelectorAll('.vp-panel');
  for (var panelIndex = 0; panelIndex < panels.length; panelIndex++) {
    panels[panelIndex].classList.remove('active');
  }
  var target = el('vpPanel' + view.charAt(0).toUpperCase() + view.slice(1));
  if (target) target.classList.add('active');

  if (view === 'messages' && APP.selectedEventId) markMessagesRead(APP.selectedEventId);
  try { tool.resize(); } catch (error) { /* optional */ }
}

function selectEvent(eventId) {
  APP.selectedEventId = eventId;
  persist();
  renderAll();
}

function openEventMessages(eventId) {
  APP.selectedEventId = eventId;
  persist();
  renderAll();
  showView('messages');
  markMessagesRead(eventId);
}

/* ---------------- modals ---------------- */
function openModal(title, bodyHtml, footHtml) {
  el('vpModalTitle').textContent = title;
  el('vpModalBody').innerHTML = bodyHtml;
  el('vpModalFoot').innerHTML = footHtml || '<button type="button" class="vp-btn" onclick="closeModal()">Close</button>';
  el('vpModal').classList.add('open');
}

function closeModal() {
  el('vpModal').classList.remove('open');
}

function openApplyPositionModal(opportunityId, positionId) {
  var record = eventById(opportunityId);
  if (!record) { notifyHost('This opportunity could not be found.', 'warning'); return; }
  if (!APP.profileObject) { notifyHost('A volunteer profile is needed before you can apply.', 'warning'); return; }
  if (APP.profileData.status === 'candidate') {
    notifyHost('A manager has to approve you into the volunteer network first.', 'warning');
    return;
  }
  if (!canWork()) { notifyHost('This view is read only.', 'warning'); return; }

  var data = vd(record);
  var chosenPosition = null;
  positionsOf(record).forEach(function (position) {
    if ((position.id || '') === positionId) chosenPosition = position;
  });

  var positionName = chosenPosition ? chosenPosition.name : 'General volunteer';
  var filled = positionFilledCount(opportunityId, positionId);
  var slots = chosenPosition ? toNumber(chosenPosition.slots) : 0;

  var body = '<p style="margin-top:0;color:#64748b;font-size:0.92rem;">'
    + esc(data.name || record.name) + ' - ' + esc(opportunityWhenText(record)) + '</p>'
    + '<div class="vp-apply-role">'
    + '<div class="vp-pos-name">' + esc(positionName) + '</div>'
    + (chosenPosition && chosenPosition.description ? '<div class="vp-pos-desc">' + esc(chosenPosition.description) + '</div>' : '')
    + '<div class="vp-cell-sub">' + (slots > 0 ? filled + ' of ' + slots + ' places filled' : 'Open to volunteers') + '</div>'
    + (chosenPosition && chosenPosition.timeCommitment ? '<div class="vp-cell-sub">Time: ' + esc(chosenPosition.timeCommitment) + '</div>' : '')
    + (chosenPosition && chosenPosition.skills ? '<div class="vp-cell-sub">Skills: ' + esc(chosenPosition.skills) + '</div>' : '')
    + '</div>'
    + '<div class="vp-field"><label for="vpApplyNote">Note for the team (optional)</label>'
    + '<textarea class="vp-textarea" id="vpApplyNote" maxlength="500" placeholder="Tell them why this role suits you."></textarea></div>';

  openModal('Apply for ' + positionName, body,
    '<button type="button" class="vp-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="vp-btn vp-btn-primary" onclick="submitPositionApplication(\'' + escJs(opportunityId) + '\',\'' + escJs(positionId) + '\')">Send request</button>');
}

function submitPositionApplication(opportunityId, positionId) {
  var noteNode = el('vpApplyNote');
  applyToPosition(opportunityId, positionId, noteNode ? noteNode.value : '');
}

function openWithdrawModal(eventId) {
  openModal('Withdraw from this opportunity',
    '<p>Withdraw from <strong>' + esc(eventNameOf(eventId)) + '</strong>?</p>'
    + '<div class="vp-note">Your approved hours stay on your record. The opportunity manager sees that you removed yourself.</div>',
    '<button type="button" class="vp-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="vp-btn vp-btn-bad" onclick="confirmWithdraw(\'' + escJs(eventId) + '\')">Withdraw</button>');
}

function confirmWithdraw(eventId) { withdrawFromEvent(eventId); }

function openLogHoursModal(eventId, taskId) {
  var candidateEvents = myEventRecords().filter(function (record) {
    var relation = relationForEvent(record.id);
    return relation && ['approved', 'requested'].indexOf(relationData(relation).status) !== -1;
  });
  if (candidateEvents.length === 0) {
    notifyHost('Join an opportunity first, then log hours against it.', 'warning');
    return;
  }

  var chosenEventId = eventId || APP.selectedEventId || candidateEvents[0].id;
  var tasks = tasksOf(chosenEventId);

  var body = '<div class="vp-field"><label for="vpHourEvent">Opportunity</label>'
    + '<select class="vp-select" id="vpHourEvent" onchange="reloadHourTaskOptions()">'
    + candidateEvents.map(function (record) {
      return '<option value="' + esc(record.id) + '"' + (record.id === chosenEventId ? ' selected' : '') + '>'
        + esc(vd(record).name || record.name) + '</option>';
    }).join('')
    + '</select></div>'
    + '<div class="vp-field"><label for="vpHourDate">Date</label>'
    + '<input class="vp-input" type="date" id="vpHourDate" value="' + esc(todayIso()) + '"></div>'
    + '<div class="vp-field"><label for="vpHourTask">Task (optional)</label>'
    + '<select class="vp-select" id="vpHourTask">'
    + '<option value="">General work, no specific task</option>'
    + tasks.map(function (task) {
      return '<option value="' + esc(task.id) + '"' + (task.id === taskId ? ' selected' : '') + '>' + esc(task.title) + '</option>';
    }).join('')
    + '</select></div>'
    + '<div class="vp-field"><label for="vpHourAmount">Hours</label>'
    + '<input class="vp-input" type="number" id="vpHourAmount" min="0.25" max="24" step="0.25" value=""></div>'
    + '<div class="vp-field"><label for="vpHourNote">What did you do? (optional)</label>'
    + '<textarea class="vp-textarea" id="vpHourNote" maxlength="500"></textarea></div>'
    + '<div class="vp-note">Hours go to the opportunity manager for approval. They are not on your record until approved.</div>';

  openModal('Log hours', body,
    '<button type="button" class="vp-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="vp-btn vp-btn-primary" onclick="submitHours()">Send for approval</button>');
}

function reloadHourTaskOptions() {
  var eventSelect = el('vpHourEvent');
  var taskSelect = el('vpHourTask');
  if (!eventSelect || !taskSelect) return;
  var tasks = tasksOf(eventSelect.value);
  taskSelect.innerHTML = '<option value="">General work, no specific task</option>'
    + tasks.map(function (task) {
      return '<option value="' + esc(task.id) + '">' + esc(task.title) + '</option>';
    }).join('');
}

function submitHours() {
  var eventNode = el('vpHourEvent');
  var dateNode = el('vpHourDate');
  var taskNode = el('vpHourTask');
  var amountNode = el('vpHourAmount');
  var noteNode = el('vpHourNote');

  var eventId = eventNode ? eventNode.value : '';
  var date = dateNode ? dateNode.value : '';
  var hours = amountNode ? Number(amountNode.value) : 0;
  var taskId = taskNode ? taskNode.value : '';
  var note = noteNode ? noteNode.value : '';

  if (!eventId) { notifyHost('Choose an event.', 'warning'); return; }
  if (!date) { notifyHost('Choose a date.', 'warning'); return; }
  if (!hours || hours <= 0 || hours > 24) { notifyHost('Hours must be between 0.25 and 24.', 'warning'); return; }

  var taskTitle = '';
  if (taskId) {
    tasksOf(eventId).forEach(function (task) { if (task.id === taskId) taskTitle = task.title; });
  }

  addPendingHours(eventId, { date: date, hours: hours, note: note, taskId: taskId, taskTitle: taskTitle });
}

function openRemoveHoursModal(eventId, pendingId) {
  openModal('Remove this hour line',
    '<p>Remove the line you sent for approval?</p>',
    '<button type="button" class="vp-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="vp-btn vp-btn-bad" onclick="confirmRemoveHours(\'' + escJs(eventId) + '\',\'' + escJs(pendingId) + '\')">Remove</button>');
}

function confirmRemoveHours(eventId, pendingId) { removePendingHours(eventId, pendingId); }

function openApproveHoursModal(eventId, pendingId) {
  openModal('Approve hours',
    '<p>Approve this hour line? It will be written to the volunteer ledger once.</p>',
    '<button type="button" class="vp-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="vp-btn vp-btn-ok" onclick="confirmApproveHours(\'' + escJs(eventId) + '\',\'' + escJs(pendingId) + '\')">Approve</button>');
}

function confirmApproveHours(eventId, pendingId) { approvePendingHours(eventId, pendingId); }

function openRejectHoursModal(eventId, pendingId) {
  openModal('Reject hours',
    '<p>Reject this hour line? It leaves the pending list and is recorded as rejected.</p>',
    '<button type="button" class="vp-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="vp-btn vp-btn-bad" onclick="confirmRejectHours(\'' + escJs(eventId) + '\',\'' + escJs(pendingId) + '\')">Reject</button>');
}

function confirmRejectHours(eventId, pendingId) { rejectPendingHours(eventId, pendingId); }

function startTask(eventId, taskId) { setTaskLinkStatus(eventId, taskId, 'in-progress'); }
function reportTaskDone(eventId, taskId) {
  setTaskLinkStatus(eventId, taskId, 'reported-done');
  markTaskDefinitionStatus(eventId, taskId, 'reported-done');
}
function confirmTask(eventId, taskId) {
  setTaskLinkStatus(eventId, taskId, 'confirmed');
  markTaskDefinitionStatus(eventId, taskId, 'confirmed');
}

/* The task definition document is manager-owned; a volunteer never writes it. */
function markTaskDefinitionStatus(eventId, taskId, status) {
  if (!APP.isManager || APP.readOnly) return;
  var doc = tasksDocOf(eventId);
  if (!doc) return;
  var data = simpleCopy(vd(doc));
  var tasks = Array.isArray(data.tasks) ? data.tasks.slice() : [];
  tasks.forEach(function (task) {
    if (task.id !== taskId) return;
    task.status = status === 'reported-done' ? 'reported-done' : 'completed';
    if (status === 'confirmed') { task.completedAt = isoNow(); task.completedBy = APP.user ? (APP.user.name || '') : ''; }
  });
  data.tasks = tasks;
  data.updatedAt = isoNow();
  updateObject(typeTasks(), doc.id, data, vd(doc).eventName || eventNameOf(eventId), function () { /* best effort */ });
}

function openTeamMessageModal() {
  var records = myEventRecords().filter(function (record) {
    var relation = relationForEvent(record.id);
    return relation && relationData(relation).status === 'approved';
  });
  if (records.length === 0) { notifyHost('You can message the team of an event you joined.', 'warning'); return; }

  var chosen = APP.selectedEventId && records.some(function (record) { return record.id === APP.selectedEventId; })
    ? APP.selectedEventId
    : records[0].id;

  var body = '<div class="vp-field"><label for="vpMsgEvent">Opportunity</label>'
    + '<select class="vp-select" id="vpMsgEvent">'
    + records.map(function (record) {
      return '<option value="' + esc(record.id) + '"' + (record.id === chosen ? ' selected' : '') + '>'
        + esc(vd(record).name || record.name) + '</option>';
    }).join('')
    + '</select></div>'
    + '<div class="vp-field"><label for="vpMsgSubject">Subject</label>'
    + '<input class="vp-input" id="vpMsgSubject" maxlength="200"></div>'
    + '<div class="vp-field"><label for="vpMsgBody">Message</label>'
    + '<textarea class="vp-textarea" id="vpMsgBody" maxlength="2000"></textarea>'
    + '<div class="vp-hint">Maximum 2,000 characters. Every event keeps its own message history.</div></div>';

  openModal('Message the opportunity team', body,
    '<button type="button" class="vp-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="vp-btn vp-btn-primary" onclick="submitTeamMessage()">Send message</button>');
}

function submitTeamMessage() {
  var eventNode = el('vpMsgEvent');
  var subjectNode = el('vpMsgSubject');
  var bodyNode = el('vpMsgBody');
  var subject = subjectNode ? subjectNode.value.trim() : '';
  var body = bodyNode ? bodyNode.value.trim() : '';
  if (!subject) { notifyHost('Add a subject.', 'warning'); return; }
  if (!body) { notifyHost('Write a message.', 'warning'); return; }
  sendEventMessage(eventNode.value, subject, body);
}

function saveProfileFromForm() {
  saveProfileDetails({
    firstName: el('vpFirstName') ? el('vpFirstName').value : '',
    lastName: el('vpLastName') ? el('vpLastName').value : '',
    email: el('vpEmail') ? el('vpEmail').value : '',
    phone: el('vpPhone') ? el('vpPhone').value : '',
    city: el('vpCity') ? el('vpCity').value : '',
    languages: el('vpLanguages') ? el('vpLanguages').value : '',
    skills: el('vpSkills') ? el('vpSkills').value : '',
    availabilityNotes: el('vpAvailability') ? el('vpAvailability').value : '',
    emergencyContactName: el('vpEmergencyName') ? el('vpEmergencyName').value : '',
    emergencyContactPhone: el('vpEmergencyPhone') ? el('vpEmergencyPhone').value : '',
    networkStatus: el('vpProfileStatusSelect') ? el('vpProfileStatusSelect').value : ''
  });
}

function downloadCertificate() {
  var totalHours = sumLedgerHours(Array.isArray(APP.profileData.hoursLedger) ? APP.profileData.hoursLedger : []);
  if (totalHours <= 0) { notifyHost('No approved hours yet.', 'warning'); return; }

  var name = APP.profileObject ? personNameOf(APP.profileObject) : 'Volunteer';
  var html = '<div style="font-family:\'Inter\',\'Segoe UI\',system-ui,sans-serif;color:#1f2937;max-width:700px;margin:0 auto;padding:56px 40px;border:2px solid #c7d2fe;border-radius:16px;text-align:center;">'
    + '<div style="font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#4f46e5;">' + esc(orgName()) + '</div>'
    + '<h1 style="font-size:30px;color:#0f172a;margin:14px 0 6px;">Certificate of Volunteer Service</h1>'
    + '<p style="color:#64748b;margin:0 0 26px;">In recognition of time given to the community</p>'
    + '<div style="font-size:25px;font-weight:700;color:#0f172a;border-bottom:2px solid #4f46e5;display:inline-block;padding:0 22px 10px;">' + esc(name) + '</div>'
    + '<div style="font-size:40px;font-weight:800;color:#4f46e5;margin:26px 0 2px;">' + totalHours.toFixed(1) + '</div>'
    + '<div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;">Approved volunteer hours</div>'
    + '<p style="color:#64748b;margin-top:26px;font-size:13px;">Generated ' + esc(fmtDate(todayIso())) + '</p>'
    + '</div>';

  try {
    tool.requestExportPdf({
      html: html,
      filename: 'volunteer-certificate-' + String(name).replace(/\s+/g, '-').toLowerCase()
    }, function (error, file) {
      if (error) { notifyHost('PDF export failed: ' + error, 'error'); return; }
      notifyHost('Certificate generated.', 'success');
      if (file && file.url) tool.openUrl(file.url);
    });
  } catch (error) {
    notifyHost('PDF export is not available in this host.', 'warning');
  }
}

/* ---------------- start ---------------- */
tool.declareParams([
  {
    name: 'personId',
    label: 'Volunteer profile object ID',
    type: 'text',
    default: '',
    hint: 'The volunteer profile this tool instance shows. Leave empty to use the signed-in volunteer profile.',
    severity: 'optional'
  },
  {
    name: 'personType',
    label: 'Volunteer profile type ID',
    type: 'text',
    default: DEFAULT_TYPES.person,
    hint: 'CMS object type for volunteer profiles. Authorize it in settings.allowedObjectTypes.',
    severity: 'goodToHave'
  },
  {
    name: 'eventType',
    label: 'Event type ID',
    type: 'text',
    default: DEFAULT_TYPES.event,
    hint: 'CMS object type for event definitions.',
    severity: 'goodToHave'
  },
  {
    name: 'relationType',
    label: 'Membership type ID',
    type: 'text',
    default: DEFAULT_TYPES.relation,
    hint: 'CMS object type that links one person to one event.',
    severity: 'goodToHave'
  },
  {
    name: 'tasksType',
    label: 'Event tasks type ID',
    type: 'text',
    default: DEFAULT_TYPES.tasks,
    hint: 'CMS object type holding the task list of one event.',
    severity: 'goodToHave'
  },
  {
    name: 'messagesType',
    label: 'Event messages type ID',
    type: 'text',
    default: DEFAULT_TYPES.messages,
    hint: 'CMS object type holding the message volumes of one event.',
    severity: 'goodToHave'
  },
  {
    name: 'orgName',
    label: 'Organization name',
    type: 'text',
    default: 'Our Organization',
    hint: 'Printed on the volunteer certificate.',
    severity: 'goodToHave'
  }
]);

tool.declareOutput({
  type: 'object',
  properties: {
    personObjectId: { type: 'string' },
    lastView: { type: 'string' }
  }
});

tool.onReady(function (value) {
  APP.savedValue = value || {};
  APP.user = tool.getUser ? tool.getUser() : null;
  APP.isManager = detectManager(APP.user);

  try { APP.readOnly = tool.isReadOnly ? !!tool.isReadOnly() : false; } catch (error) { APP.readOnly = false; }

  if (APP.savedValue && APP.savedValue.lastView) APP.view = APP.savedValue.lastView;
  APP.selectedEventId = (APP.savedValue && APP.savedValue.selectedEventId) || '';

  var navButtons = document.querySelectorAll('.vp-nav-btn');
  for (var index = 0; index < navButtons.length; index++) {
    navButtons[index].addEventListener('click', function () {
      showView(this.getAttribute('data-view'));
      persist();
    });
  }

  el('vpModalClose').addEventListener('click', closeModal);
  el('vpModal').addEventListener('click', function (event) {
    if (event.target === el('vpModal')) closeModal();
  });
  el('vpRefreshBtn').addEventListener('click', function () { loadAll(); });
  el('vpLogHoursBtn').addEventListener('click', function () { openLogHoursModal(APP.selectedEventId); });
  el('vpMessageTeamBtn').addEventListener('click', openTeamMessageModal);
  el('vpCertificateBtn').addEventListener('click', downloadCertificate);

  var clockStopButton = el('vpClockStopBtn');
  if (clockStopButton) clockStopButton.addEventListener('click', openStopClockModal);
  if (APP.timerTicker) clearInterval(APP.timerTicker);
  APP.timerTicker = setInterval(timerTick, TIMER_TICK_MS);
  window.addEventListener('beforeunload', function (event) {
    if (!runningSession()) return;
    event.preventDefault();
    event.returnValue = '';
  });

  var catalogSearchNode = el('vpOppSearch');
  if (catalogSearchNode) {
    catalogSearchNode.addEventListener('input', function () { onCatalogSearch(this.value); });
  }

  if (tool.onUserChange) {
    tool.onUserChange(function (user) {
      APP.user = user;
      APP.isManager = detectManager(user);
      loadAll();
    });
  }
  if (tool.onReadonlyChange) {
    tool.onReadonlyChange(function (readOnly) {
      APP.readOnly = !!readOnly;
      renderAll();
    });
  }

  loadAll(function () {
    showView(APP.view);
  });

  try { tool.reportValid(true, ''); } catch (error) { /* optional */ }
});

function persist() {
  try {
    tool.setValue({
      personObjectId: APP.profileObject ? APP.profileObject.id : '',
      lastView: APP.view,
      selectedEventId: APP.selectedEventId
    });
  } catch (error) { /* value persistence is optional */ }
}
