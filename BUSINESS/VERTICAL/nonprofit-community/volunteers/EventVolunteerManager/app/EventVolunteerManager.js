/* EventVolunteerManager
   One tool instance = ONE event object (host object).
   The event is a CMS object created outside this tool. This tool manages everything that happens around it:
   the volunteers linked to it, their roles, tasks, hours, messages, the report and the event information itself.

   Object model (5 CMS object types, no array-contains queries):
     Event          vm.events-uniconbaseapps            (this tool's host object)
     Membership     vm.eventMemberships-uniconbaseapps  id = personId + '__' + eventId
     Person         volunteerRegistry-uniconbaseapps
     Event Tasks    vm.eventTasks-uniconbaseapps         id = eventId + '__tasks'
     Event Messages vm.eventMessages-uniconbaseapps      id = eventId + '__messages' (+ '#2', '#3' ...)
*/

var DEFAULT_TYPES = {
  event: 'vm.events-uniconbaseapps',
  relation: 'vm.eventMemberships-uniconbaseapps',
  person: 'volunteerRegistry-uniconbaseapps',
  tasks: 'vm.eventTasks-uniconbaseapps',
  messages: 'vm.eventMessages-uniconbaseapps'
};

var LIMITS = {
  positions: 20,
  tasks: 200,
  taskTitle: 120,
  taskDescription: 500,
  messageSubject: 200,
  messageBody: 2000,
  messagesPerVolume: 150,
  eventDescription: 1000,
  eventNotes: 1000,
  relationNotes: 500
};

var APP = {
  user: null,
  isManager: false,
  readOnly: false,
  view: 'dashboard',
  savedValue: null,

  hostObjectId: '',
  eventObject: null,
  eventData: {},

  relations: [],
  persons: [],
  tasksDoc: null,
  messageDocs: [],

  openRelationId: '',
  drawerConfirm: '',

  loading: true,
  loadError: '',
  toastTimer: null
};

/* ---------------- helpers ---------------- */
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

function statusLabel(status) {
  var labels = {
    draft: 'Draft', open: 'Open', closed: 'Closed', cancelled: 'Cancelled',
    requested: 'Requested', approved: 'Approved', declined: 'Declined', revoked: 'Revoked', revoked: 'Revoked', revoked: 'Revoked', removed: 'Removed',
    open_task: 'Open', assigned: 'Assigned', 'in-progress': 'In progress',
    'reported-done': 'Reported done', confirmed: 'Confirmed', completed: 'Completed',
    pending: 'Pending', rejected: 'Rejected',
    candidate: 'Candidate', active: 'Active', inactive: 'Inactive', banned: 'Banned'
  };
  return labels[status] || (status ? String(status) : '-');
}

function badge(status) {
  var key = status || 'draft';
  return '<span class="et-badge et-badge-' + esc(key) + '">' + esc(statusLabel(key)) + '</span>';
}

function initialsOf(name) {
  var text = String(name || '').trim();
  if (!text) return '?';
  var words = text.split(/\s+/);
  var firstLetter = words[0].charAt(0);
  var lastLetter = words.length > 1 ? words[words.length - 1].charAt(0) : '';
  return (firstLetter + lastLetter).toUpperCase();
}

function avatarHtml(name, extraClass) {
  return '<span class="et-avatar' + (extraClass ? ' ' + extraClass : '') + '">' + esc(initialsOf(name)) + '</span>';
}

function personCellHtml(personName, personEmail) {
  return '<div class="et-person">' + avatarHtml(personName)
    + '<div><div class="et-cell-main">' + esc(personName) + '</div>'
    + '<div class="et-cell-sub">' + esc(personEmail || '') + '</div></div></div>';
}

function relationStatusHelp(status) {
  var help = {
    requested: 'Waiting for a manager decision. This person is not on the event team yet.',
    approved: 'On the event team. They can receive tasks and send hours in for approval.',
    declined: 'This request was declined. You can approve the same person later from here.',
    revoked: 'The approval was revoked. Hours already approved stay on the volunteer record.',
    removed: 'This person is no longer part of the event team.'
  };
  return help[status] || '';
}

/* ---------------- choice picker (people and roles) ---------------- */
function choiceItemHtml(options) {
  var search = String(options.search || '').toLowerCase();
  return '<label class="et-picker-item' + (options.checked ? ' is-selected' : '') + '" data-search="' + esc(search) + '">'
    + '<input type="checkbox" name="' + esc(options.name) + '" value="' + esc(options.value) + '"'
    + (options.checked ? ' checked' : '') + '>'
    + '<span class="et-picker-avatar">' + esc(initialsOf(options.title)) + '</span>'
    + '<span class="et-picker-main">'
    + '<span class="et-picker-name">' + esc(options.title) + '</span>'
    + '<span class="et-picker-sub">' + esc(options.subtitle || '') + '</span>'
    + '</span>'
    + '<span class="et-picker-tag">' + esc(options.tag || '') + '</span>'
    + '<span class="et-picker-mark" aria-hidden="true"></span>'
    + '</label>';
}

function updateChoiceCount(listId, countId) {
  var list = el(listId);
  var count = el(countId);
  if (!list || !count) return;
  var selected = list.querySelectorAll('input[type="checkbox"]:checked').length;
  count.textContent = selected + ' selected';
}

function bindChoicePicker(listId, countId) {
  var list = el(listId);
  if (!list) return;
  list.addEventListener('change', function (event) {
    var item = event.target && event.target.closest ? event.target.closest('.et-picker-item') : null;
    if (item) item.classList.toggle('is-selected', !!event.target.checked);
    updateChoiceCount(listId, countId);
  });
  updateChoiceCount(listId, countId);
}

function filterChoicePicker(listId, query) {
  var list = el(listId);
  if (!list) return;
  var needle = String(query || '').trim().toLowerCase();
  var items = list.querySelectorAll('.et-picker-item');
  for (var index = 0; index < items.length; index++) {
    var haystack = String(items[index].getAttribute('data-search') || '');
    items[index].style.display = (!needle || haystack.indexOf(needle) !== -1) ? '' : 'none';
  }
}

function selectAllVisibleChoices(listId, countId) {
  var list = el(listId);
  if (!list) return;
  var items = list.querySelectorAll('.et-picker-item');
  for (var index = 0; index < items.length; index++) {
    if (items[index].style.display === 'none') continue;
    var box = items[index].querySelector('input[type="checkbox"]');
    if (!box || box.checked) continue;
    box.checked = true;
    items[index].classList.add('is-selected');
  }
  updateChoiceCount(listId, countId);
}

function toast(message) {
  var node = el('etToast');
  if (!node) return;
  node.textContent = message;
  node.className = 'et-toast show';
  if (APP.toastTimer) clearTimeout(APP.toastTimer);
  APP.toastTimer = setTimeout(function () { node.className = 'et-toast'; }, 2600);
}

function notifyHost(message, kind) {
  try { tool.notify(message, kind || 'info'); } catch (error) { /* host may not expose notify */ }
  toast(message);
}

function paramOr(name, fallback) {
  try {
    var value = tool.param(name, fallback);
    if (value === undefined || value === null || value === '') return fallback;
    return value;
  } catch (error) { return fallback; }
}

function typeEvent() { return paramOr('eventType', DEFAULT_TYPES.event); }
function typeRelation() { return paramOr('relationType', DEFAULT_TYPES.relation); }
function typePerson() { return paramOr('personType', DEFAULT_TYPES.person); }
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
  var params = { mainObjectType: objectType, objectId: objectId, productData: { data_categoriesBased: data } };
  if (name) params.name = name;
  requestObjects('update', params, function (error, result) { callback(error || null, result); });
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

function canManage() { return !APP.readOnly && APP.isManager; }

function currentUserName() {
  if (!APP.user) return '';
  return APP.user.name || APP.user.email || '';
}

/* ---------------- data shaping ---------------- */
function relationDataOf(relation) { return vd(relation); }

function eventName() {
  return APP.eventData.name || (APP.eventObject ? APP.eventObject.name : '') || 'Event';
}

function eventWhenText(data) {
  var source = data || APP.eventData;
  var start = source.startDate || '';
  var end = source.endDate || '';
  var dateText = '';
  if (start && end && end !== start) dateText = fmtDate(start) + ' to ' + fmtDate(end);
  else dateText = fmtDate(start || end);
  if (source.startTime) dateText += ' - ' + source.startTime + (source.endTime ? ' to ' + source.endTime : '');
  return dateText || '-';
}

function personById(personId) {
  for (var index = 0; index < APP.persons.length; index++) {
    if (APP.persons[index].id === personId) return APP.persons[index];
  }
  return null;
}

function personNameById(personId) {
  var person = personById(personId);
  if (!person) return 'Unknown volunteer';
  var data = vd(person);
  var full = ((data.firstName || '') + ' ' + (data.lastName || '')).trim();
  return full || data.email || person.name || 'Volunteer';
}

function personEmailById(personId) {
  var person = personById(personId);
  return person ? (vd(person).email || '') : '';
}

function personNetworkStatus(personId) {
  var person = personById(personId);
  return person ? (vd(person).status || 'candidate') : 'candidate';
}

function approvedRelations() {
  return APP.relations.filter(function (relation) { return relationDataOf(relation).status === 'approved'; });
}

function requestedRelations() {
  return APP.relations.filter(function (relation) { return relationDataOf(relation).status === 'requested'; });
}

function tasks() {
  if (!APP.tasksDoc) return [];
  var rows = vd(APP.tasksDoc).tasks;
  return Array.isArray(rows) ? rows : [];
}

function taskById(taskId) {
  var rows = tasks();
  for (var index = 0; index < rows.length; index++) {
    if (rows[index].id === taskId) return rows[index];
  }
  return null;
}

function relationForPerson(personId) {
  for (var index = 0; index < APP.relations.length; index++) {
    if (relationDataOf(APP.relations[index]).personId === personId) return APP.relations[index];
  }
  return null;
}

function taskLinksOf(relation) {
  var links = relation ? relationDataOf(relation).taskLinks : null;
  return Array.isArray(links) ? links : [];
}

function taskLinkOf(relation, taskId) {
  var links = taskLinksOf(relation);
  for (var index = 0; index < links.length; index++) {
    if (links[index].taskId === taskId) return links[index];
  }
  return null;
}

function pendingRows() {
  var rows = [];
  APP.relations.forEach(function (relation) {
    var data = relationDataOf(relation);
    (Array.isArray(data.pendingHours) ? data.pendingHours : []).forEach(function (line) {
      rows.push({ relation: relation, personId: data.personId, line: line });
    });
  });
  return rows;
}

function eventHourTotals() {
  var totals = { approved: 0, pending: 0 };
  APP.relations.forEach(function (relation) {
    var data = relationDataOf(relation);
    totals.approved += toNumber(data.hoursApprovedTotal);
    (Array.isArray(data.pendingHours) ? data.pendingHours : []).forEach(function (line) {
      totals.pending += toNumber(line.hours);
    });
  });
  return totals;
}

function hourRecordsOfEvent() {
  var records = [];
  APP.persons.forEach(function (person) {
    var ledger = Array.isArray(vd(person).hoursLedger) ? vd(person).hoursLedger : [];
    ledger.forEach(function (line) {
      if (line.eventId !== (APP.eventObject ? APP.eventObject.id : '')) return;
      records.push({ personId: person.id, line: line });
    });
  });
  return records.sort(function (recordA, recordB) {
    return String(recordB.line.approvedAt || '').localeCompare(String(recordA.line.approvedAt || ''));
  });
}

function sortedVolumes() {
  return APP.messageDocs.slice().sort(function (docA, docB) {
    return toNumber(vd(docB).volume || 1) - toNumber(vd(docA).volume || 1);
  });
}

function openVolume() {
  var volumes = sortedVolumes();
  for (var index = 0; index < volumes.length; index++) {
    if (!vd(volumes[index]).closed) return volumes[index];
  }
  return null;
}

function allMessages() {
  var rows = [];
  sortedVolumes().forEach(function (doc) {
    var data = vd(doc);
    var list = Array.isArray(data.messages) ? data.messages : [];
    list.forEach(function (message) {
      rows.push({ message: message, volume: toNumber(data.volume || 1) });
    });
  });
  return rows;
}

/* ---------------- loading ---------------- */
function resolveHostObjectId() {
  if (APP.hostObjectId) return APP.hostObjectId;
  var fromValue = APP.savedValue && APP.savedValue.eventObjectId;
  if (fromValue) return String(fromValue);
  var fromParam = paramOr('eventId', '');
  if (fromParam) return String(fromParam);
  try {
    if (typeof tool.getFields === 'function') {
      var fields = tool.getFields() || {};
      if (fields.id) return String(fields.id);
      if (fields.objectId) return String(fields.objectId);
    }
  } catch (error) { /* optional */ }
  return '';
}

function loadAll(done) {
  APP.loading = true;
  APP.loadError = '';
  var hostId = resolveHostObjectId();

  function finish() {
    APP.loading = false;
    renderAll();
    if (done) done();
  }

  function afterEvent(eventObject) {
    if (!eventObject) {
      APP.eventObject = null;
      APP.eventData = {};
      APP.relations = [];
      APP.persons = [];
      APP.tasksDoc = null;
      APP.messageDocs = [];
      finish();
      return;
    }

    APP.eventObject = eventObject;
    APP.eventData = vd(eventObject);
    APP.hostObjectId = eventObject.id;
    var eventId = eventObject.id;

    queryType(typeRelation(), function (relationError, relations) {
      if (relationError) APP.loadError = 'Memberships could not be loaded: ' + relationError;
      APP.relations = (relations || []).filter(function (relation) {
        return relationDataOf(relation).eventId === eventId;
      });

      queryType(typePerson(), function (personError, persons) {
        if (personError) APP.loadError = 'Volunteer profiles could not be loaded: ' + personError;
        APP.persons = persons || [];

        queryType(typeTasks(), function (taskError, tasksDocs) {
          if (taskError) APP.loadError = 'Task lists could not be loaded: ' + taskError;
          var found = null;
          (tasksDocs || []).forEach(function (doc) {
            if (vd(doc).eventId === eventId) found = doc;
          });
          APP.tasksDoc = found;

          queryType(typeMessages(), function (messageError, messageDocs) {
            if (messageError) APP.loadError = 'Messages could not be loaded: ' + messageError;
            APP.messageDocs = (messageDocs || []).filter(function (doc) {
              return vd(doc).eventId === eventId;
            });
            finish();
          });
        });
      });
    });
  }

  if (hostId) {
    getById(typeEvent(), hostId, function (error, object) {
      if (!error && object) { afterEvent(object); return; }
      queryType(typeEvent(), function (queryError, events) {
        if (queryError) { afterEvent(null); return; }
        afterEvent((events || [])[0] || null);
      });
    });
    return;
  }

  queryType(typeEvent(), function (error, events) {
    if (error) { afterEvent(null); return; }
    afterEvent((events || [])[0] || null);
  });
}

/* ---------------- relation writes ---------------- */
function simpleCopy(source) {
  var copy = {};
  if (!source) return copy;
  for (var key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) copy[key] = source[key];
  }
  return copy;
}

function updateRelation(relation, changes, done) {
  var data = simpleCopy(relationDataOf(relation));
  for (var key in changes) {
    if (Object.prototype.hasOwnProperty.call(changes, key)) data[key] = changes[key];
  }
  data.updatedAt = isoNow();
  updateObject(typeRelation(), relation.id, data, personNameById(data.personId), function (error) {
    if (error) { notifyHost('Could not save the membership: ' + error, 'error'); return; }
    done && done();
  });
}

function decideRelation(relation, decision) {
  if (!canManage()) return;
  updateRelation(relation, {
    status: decision,
    decidedAt: isoNow(),
    decidedBy: currentUserName()
  }, function () {
    notifyHost(decision === 'approved' ? 'Volunteer approved for this event.' : 'Request declined.', 'success');
    closeModal();
    loadAll();
  });
}

function removeRelation(relation) {
  if (!canManage()) return;
  deleteObject(typeRelation(), relation.id, function (error) {
    if (error) { notifyHost('Could not remove the volunteer: ' + error, 'error'); return; }
    notifyHost('Volunteer removed from this event.', 'info');
    closeModal();
    loadAll();
  });
}

/* ---------------- person write (hours ledger) ---------------- */
function writePersonLedger(personId, line, done) {
  var person = personById(personId);
  if (!person) { done && done('Volunteer profile not found'); return; }
  var data = simpleCopy(vd(person));
  var ledger = Array.isArray(data.hoursLedger) ? data.hoursLedger.slice() : [];

  var alreadyThere = ledger.some(function (entry) { return entry.id === line.id; });
  if (!alreadyThere) ledger.push(line);
  if (ledger.length > 500) ledger = collapseOldestYear(ledger);

  data.hoursLedger = ledger;
  data.totals = {
    hoursApproved: sumLedgerHours(ledger),
    eventsAttended: countLedgerEvents(ledger),
    tasksCompleted: toNumber((data.totals || {}).tasksCompleted)
  };
  data.updatedAt = isoNow();

  updateObject(typePerson(), person.id, data, person.name || personNameById(personId), function (error) {
    done && done(error);
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
  var collapsedCount = 0;
  var remaining = [];
  detail.forEach(function (line) {
    var year = String(line.eventDate || line.approvedAt || '').slice(0, 4);
    if (year === oldestYear) { collapsedHours += toNumber(line.hours); collapsedCount++; }
    else remaining.push(line);
  });
  summaries.push({ id: 'summary-' + oldestYear, summary: true, year: oldestYear, hours: Math.round(collapsedHours * 10) / 10, events: collapsedCount });
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

function approvePendingHours(relation, pendingId) {
  if (!canManage()) return;
  var relationRecord = relationDataOf(relation);
  var pending = Array.isArray(relationRecord.pendingHours) ? relationRecord.pendingHours : [];
  var line = null;
  for (var index = 0; index < pending.length; index++) {
    if (pending[index].id === pendingId) { line = pending[index]; break; }
  }
  if (!line) return;

  var ledgerId = relation.id + ':' + line.id;
  var ledgerLine = {
    id: ledgerId,
    eventId: APP.eventObject.id,
    eventName: eventName(),
    eventDate: APP.eventData.startDate || line.date || '',
    taskSummary: (line.taskTitle || 'General') + ' (' + toNumber(line.hours).toFixed(1) + ' h)',
    hours: toNumber(line.hours),
    approvedBy: currentUserName(),
    approvedAt: isoNow()
  };

  writePersonLedger(relationRecord.personId, ledgerLine, function (personError) {
    if (personError) { notifyHost('Could not write the hours ledger: ' + personError, 'error'); return; }

    var data = simpleCopy(relationRecord);
    data.pendingHours = (data.pendingHours || []).filter(function (entry) { return entry.id !== pendingId; });
    data.hoursApprovedTotal = toNumber(data.hoursApprovedTotal) + toNumber(line.hours);
    data.lastApprovedAt = isoNow();
    var approvedIds = Array.isArray(data.approvedLedgerIds) ? data.approvedLedgerIds.slice() : [];
    if (approvedIds.indexOf(ledgerId) === -1) approvedIds.push(ledgerId);
    data.approvedLedgerIds = approvedIds.slice(-60);
    data.updatedAt = isoNow();

    updateObject(typeRelation(), relation.id, data, personNameById(relationRecord.personId), function (relationError) {
      if (relationError) notifyHost('Hours approved, but the membership line could not be cleared: ' + relationError, 'warning');
      else notifyHost('Hours approved.', 'success');
      closeModal();
      loadAll();
    });
  });
}

function rejectPendingHours(relation, pendingId) {
  if (!canManage()) return;
  var relationRecord = relationDataOf(relation);
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
    reviewedBy: currentUserName(),
    reviewedAt: isoNow()
  });
  data.hoursHistory = history.slice(-40);
  data.updatedAt = isoNow();

  updateObject(typeRelation(), relation.id, data, personNameById(relationRecord.personId), function (error) {
    if (error) { notifyHost('Could not reject the hours: ' + error, 'error'); return; }
    notifyHost('Hour line rejected.', 'info');
    closeModal();
    loadAll();
  });
}

/* ---------------- tasks doc writes ---------------- */
function ensureTasksDoc(done) {
  if (APP.tasksDoc) { done && done(APP.tasksDoc); return; }
  if (!APP.eventObject) return;
  createObject(typeTasks(), eventName() + ' tasks', {
    eventId: APP.eventObject.id,
    eventName: eventName(),
    tasks: [],
    updatedAt: isoNow(),
    updatedBy: currentUserName()
  }, function (error, created) {
    if (error) { notifyHost('Could not create the task list: ' + error, 'error'); return; }
    APP.tasksDoc = created;
    done && done(created);
  });
}

function writeTasks(nextTasks, done) {
  ensureTasksDoc(function (doc) {
    if (!doc) return;
    var data = simpleCopy(vd(doc));
    data.tasks = nextTasks;
    data.updatedAt = isoNow();
    data.updatedBy = currentUserName();
    updateObject(typeTasks(), doc.id, data, vd(doc).eventName || eventName(), function (error) {
      if (error) { notifyHost('Could not save the task list: ' + error, 'error'); return; }
      done && done();
    });
  });
}

function createTask(values) {
  if (!canManage()) return;
  var rows = tasks().slice();
  if (rows.length >= LIMITS.tasks) { notifyHost('This event reached its task limit (' + LIMITS.tasks + ').', 'warning'); return; }

  var task = {
    id: 'tsk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    title: String(values.title || '').slice(0, LIMITS.taskTitle),
    description: String(values.description || '').slice(0, LIMITS.taskDescription),
    status: values.assigneePersonId ? 'assigned' : 'open',
    dueDate: values.dueDate || '',
    estimatedHours: toNumber(values.estimatedHours),
    assigneePersonId: values.assigneePersonId || '',
    assigneeName: values.assigneePersonId ? personNameById(values.assigneePersonId) : '',
    createdAt: isoNow(),
    createdBy: currentUserName()
  };

  rows.push(task);
  writeTasks(rows, function () {
    if (task.assigneePersonId) assignTaskLink(task.assigneePersonId, task, 'assigned', function () {
      notifyHost('Task created and assigned.', 'success');
      closeModal();
      loadAll();
    });
    else {
      notifyHost('Task created.', 'success');
      closeModal();
      loadAll();
    }
  });
}

function updateTaskRecord(taskId, values, done) {
  var rows = tasks().slice();
  var task = null;
  for (var index = 0; index < rows.length; index++) {
    if (rows[index].id === taskId) { task = rows[index]; break; }
  }
  if (!task) return;

  var previousAssignee = task.assigneePersonId || '';
  task.title = String(values.title || task.title).slice(0, LIMITS.taskTitle);
  task.description = String(values.description || '').slice(0, LIMITS.taskDescription);
  task.dueDate = values.dueDate || '';
  task.estimatedHours = toNumber(values.estimatedHours);
  task.assigneePersonId = values.assigneePersonId || '';
  task.assigneeName = task.assigneePersonId ? personNameById(task.assigneePersonId) : '';
  if (task.assigneePersonId && task.status === 'open') task.status = 'assigned';
  if (!task.assigneePersonId && (task.status === 'assigned' || task.status === 'in-progress')) task.status = 'open';

  writeTasks(rows, function () {
    if (previousAssignee && previousAssignee !== task.assigneePersonId) {
      removeTaskLink(previousAssignee, taskId, function () {
        if (task.assigneePersonId) assignTaskLink(task.assigneePersonId, task, task.status, done);
        else done && done();
      });
      return;
    }
    if (task.assigneePersonId) assignTaskLink(task.assigneePersonId, task, task.status, done);
    else done && done();
  });
}

function deleteTaskRecord(taskId) {
  if (!canManage()) return;
  var rows = tasks().filter(function (task) { return task.id !== taskId; });
  writeTasks(rows, function () {
    notifyHost('Task deleted.', 'info');
    closeModal();
    loadAll();
  });
}

function setTaskStatus(taskId, nextStatus) {
  if (!canManage()) return;
  var rows = tasks().slice();
  rows.forEach(function (task) {
    if (task.id !== taskId) return;
    task.status = nextStatus;
    if (nextStatus === 'completed') { task.completedAt = isoNow(); task.completedBy = currentUserName(); }
  });
  writeTasks(rows, function () {
    var task = taskById(taskId);
    if (task && task.assigneePersonId) {
      assignTaskLink(task.assigneePersonId, task, nextStatus === 'completed' ? 'confirmed' : nextStatus, function () {
        notifyHost('Task confirmed.', 'success');
        loadAll();
      });
    } else {
      notifyHost('Task updated.', 'success');
      loadAll();
    }
  });
}

function assignTaskLink(personId, task, linkStatus, done) {
  var relation = relationForPerson(personId);
  if (!relation) { done && done(); return; }
  var relationRecord = relationDataOf(relation);
  var data = simpleCopy(relationRecord);
  var links = Array.isArray(data.taskLinks) ? data.taskLinks.slice() : [];

  var link = null;
  for (var index = 0; index < links.length; index++) {
    if (links[index].taskId === task.id) { link = links[index]; break; }
  }
  if (!link) {
    if (links.length >= 40) { notifyHost('This membership already has 40 task rows.', 'warning'); done && done(); return; }
    link = { taskId: task.id, title: task.title, dueDate: task.dueDate || '', status: linkStatus };
    links.push(link);
  }
  link.title = task.title;
  link.dueDate = task.dueDate || '';
  link.status = linkStatus;
  if (linkStatus === 'confirmed') link.confirmedAt = isoNow();
  if (linkStatus === 'reported-done') link.reportedAt = link.reportedAt || isoNow();

  data.taskLinks = links;
  data.updatedAt = isoNow();

  updateObject(typeRelation(), relation.id, data, personNameById(personId), function (error) {
    if (error) { notifyHost('Could not update the volunteer task row: ' + error, 'warning'); }
    done && done();
  });
}

function removeTaskLink(personId, taskId, done) {
  var relation = relationForPerson(personId);
  if (!relation) { done && done(); return; }
  var data = simpleCopy(relationDataOf(relation));
  data.taskLinks = (data.taskLinks || []).filter(function (link) { return link.taskId !== taskId; });
  data.updatedAt = isoNow();
  updateObject(typeRelation(), relation.id, data, personNameById(personId), function () { done && done(); });
}

/* ---------------- messages ---------------- */
function writeMessageDoc(doc, data, done) {
  if (doc) {
    updateObject(typeMessages(), doc.id, data, vd(doc).eventName || eventName(), function (error) {
      if (error) { notifyHost('Could not save the message: ' + error, 'error'); return; }
      done && done();
    });
    return;
  }
  createObject(typeMessages(), eventName() + ' messages', data, function (error) {
    if (error) { notifyHost('Could not create the message document: ' + error, 'error'); return; }
    done && done();
  });
}

function postMessage(subject, body, audience) {
  if (!canManage()) return;
  var doc = openVolume();

  function writeInto(target) {
    var data = target
      ? simpleCopy(vd(target))
      : { eventId: APP.eventObject.id, eventName: eventName(), volume: 1, closed: false, messages: [] };

    var list = Array.isArray(data.messages) ? data.messages.slice() : [];
    list.unshift({
      id: 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      fromUserId: APP.user ? (APP.user.id || '') : '',
      fromName: currentUserName() || 'Event manager',
      fromRole: 'manager',
      subject: String(subject || '').slice(0, LIMITS.messageSubject),
      body: String(body || '').slice(0, LIMITS.messageBody),
      sentAt: isoNow(),
      audience: audience || 'team',
      readBy: [APP.user ? (APP.user.id || '') : '']
    });

    data.messages = list.slice(0, LIMITS.messagesPerVolume);
    data.firstSentAt = data.firstSentAt || data.messages[0].sentAt;
    data.lastSentAt = data.messages[0].sentAt;
    data.updatedAt = isoNow();

    writeMessageDoc(target, data, function () {
      var shouldRotate = data.messages.length >= LIMITS.messagesPerVolume;
      if (shouldRotate) {
        rotateVolume(function () {
          notifyHost('Message sent. The volume is full, so a new one was opened.', 'success');
          closeModal();
          loadAll();
        });
        return;
      }
      notifyHost('Announcement sent to the event team.', 'success');
      closeModal();
      loadAll();
    });
  }

  writeInto(doc);
}

function rotateVolume(done) {
  if (!canManage()) return;
  var current = openVolume();
  var currentVolumeNumber = current ? toNumber(vd(current).volume || 1) : 0;

  function startNext() {
    createObject(typeMessages(), eventName() + ' messages v' + (currentVolumeNumber + 1), {
      eventId: APP.eventObject.id,
      eventName: eventName(),
      volume: currentVolumeNumber + 1,
      closed: false,
      messages: [],
      updatedAt: isoNow()
    }, function (error) {
      if (error) { notifyHost('Could not open a new volume: ' + error, 'error'); return; }
      notifyHost('New message volume opened. Older volumes are read only.', 'success');
      if (done) done();
      else { loadAll(); }
    });
  }

  if (!current) { currentVolumeNumber = 0; startNext(); return; }

  var data = simpleC
  renderMemberDrawer();opy(vd(current));
  data.closed = true;
  data.updatedAt = isoNow();
  updateObject(typeMessages(), current.id, data, vd(current).eventName || eventName(), function (error) {
    if (error) { notifyHost('Could not close the volume: ' + error, 'error'); return; }
    startNext();
  });
}

/* ---------------- event definition writes ---------------- */
function saveEventDefinition(values) {
  if (!canManage()) return;
  var data = simpleCopy(APP.eventData);
  data.name = String(values.name || '').slice(0, 120);
  data.status = values.status || data.status || 'draft';
  data.startDate = values.startDate || '';
  data.endDate = values.endDate || '';
  data.startTime = values.startTime || '';
  data.endTime = values.endTime || '';
  data.locationName = String(values.locationName || '').slice(0, 120);
  data.address = String(values.address || '').slice(0, 200);
  data.city = String(values.city || '').slice(0, 80);
  data.capacity = toNumber(values.capacity);
  data.description = String(values.description || '').slice(0, LIMITS.eventDescription);
  data.notes = String(values.notes || '').slice(0, LIMITS.eventNotes);
  data.contactName = String(values.contactName || '').slice(0, 80);
  data.contactPhone = String(values.contactPhone || '').slice(0, 40);
  data.contactEmail = String(values.contactEmail || '').slice(0, 160);
  data.updatedAt = isoNow();

  if (!data.name) { notifyHost('The event needs a name.', 'warning'); return; }
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    notifyHost('The end date cannot be before the start date.', 'warning');
    return;
  }

  updateObject(typeEvent(), APP.eventObject.id, data, data.name, function (error) {
    if (error) { notifyHost('Could not save the event: ' + error, 'error'); return; }
    notifyHost('Event saved.', 'success');
    loadAll();
  });
}

function savePositions(nextPositions) {
  if (!canManage()) return;
  var data = simpleCopy(APP.eventData);
  data.positions = nextPositions.slice(0, LIMITS.positions);
  data.updatedAt = isoNow();
  updateObject(typeEvent(), APP.eventObject.id, data, eventName(), function (error) {
    if (error) { notifyHost('Could not save the roles: ' + error, 'error'); return; }
    notifyHost('Roles saved.', 'success');
    closeModal();
    loadAll();
  });
}

/* ---------------- rendering ---------------- */
function renderAll() {
  var data = APP.eventData;
  el('etEventName').textContent = eventName();
  el('etMark').textContent = (eventName() || 'E').charAt(0).toUpperCase();

  var placeText = [data.locationName, data.city].filter(Boolean).join(', ');
  el('etEventMeta').textContent = eventWhenText(data) + (placeText ? ' - ' + placeText : '');
  el('etStatusPill').textContent = statusLabel(data.status || 'draft');
  el('etRolePill').textContent = APP.isManager ? 'Event manager' : 'Volunteer (view only)';

  var pendingCount = requestedRelations().length + pendingRows().length;
  var openTasks = tasks().filter(function (task) {
    return ['open', 'assigned', 'in-progress', 'reported-done'].indexOf(task.status) !== -1;
  }).length;

  el('etBadgeTeam').textContent = String(APP.relations.length);
  el('etBadgeTeam').className = 'et-nav-badge' + (requestedRelations().length ? ' hot' : '');
  el('etBadgeTasks').textContent = String(openTasks);
  el('etBadgeHours').textContent = String(pendingRows().length);
  el('etBadgeHours').className = 'et-nav-badge' + (pendingRows().length ? ' hot' : '');
  el('etBadgeMessages').textContent = String(allMessages().length);

  el('etNavFoot').innerHTML = APP.eventObject
    ? 'Approved volunteers: <strong>' + approvedRelations().length + '</strong><br>Waiting: <strong>' + pendingCount + '</strong>'
    : 'No event object is attached to this tool.';

  renderDashboard();
  renderTeam();
  renderTasks();
  renderHours();
  renderMessages();
  renderReport();
  renderEventForm();
  renderPositions();

  el('etAddVolunteerBtn').disabled = !canManage();
  el('etAddTaskBtn').disabled = !canManage();
  el('etNewMessageBtn').disabled = !canManage();
  el('etRotateBtn').disabled = !canManage();
  el('etAddPositionBtn').disabled = !canManage();
  el('etExportReportBtn').disabled = !APP.eventObject;

  try { tool.resize(); } catch (error) { /* optional */ }
}

function statCard(value, label) {
  return '<div class="et-stat"><div class="et-stat-value">' + esc(value) + '</div>'
    + '<div class="et-stat-label">' + esc(label) + '</div></div>';
}

function renderDashboard() {
  var totals = eventHourTotals();
  var openTasks = tasks().filter(function (task) {
    return ['open', 'assigned', 'in-progress', 'reported-done'].indexOf(task.status) !== -1;
  });
  var confirmedTasks = tasks().filter(function (task) { return task.status === 'completed'; });

  el('etStats').innerHTML = ''
    + statCard(String(approvedRelations().length) + ' / ' + APP.relations.length, 'Volunteers approved / linked')
    + statCard(String(requestedRelations().length), 'Requests to decide')
    + statCard(openTasks.length + ' / ' + tasks().length, 'Open tasks')
    + statCard(totals.approved.toFixed(1), 'Hours approved')
    + statCard(totals.pending.toFixed(1), 'Hours waiting');

  /* requests */
  var requests = requestedRelations();
  var requestHtml = '';
  if (requests.length === 0) {
    requestHtml = '<div class="et-empty">No requests are waiting for a decision.</div>';
  } else {
    requestHtml = '<div class="et-table-wrap"><table class="et-table"><thead><tr>'
      + '<th>Volunteer</th><th>Network</th><th>Roles asked for</th><th>Applied</th><th></th>'
      + '</tr></thead><tbody>';
    requests.forEach(function (relation) {
      var relationRecord = relationDataOf(relation);
      var positions = Array.isArray(relationRecord.positions) ? relationRecord.positions : [];
      requestHtml += '<tr>'
        + '<td><div class="et-cell-main">' + esc(personNameById(relationRecord.personId)) + '</div>'
        + '<div class="et-cell-sub">' + esc(personEmailById(relationRecord.personId)) + '</div></td>'
        + '<td>' + badge(personNetworkStatus(relationRecord.personId)) + '</td>'
        + '<td>' + esc(positions.length ? positions.map(function (position) { return position.name; }).join(', ') : '-') + '</td>'
        + '<td>' + esc(fmtDate(relationRecord.appliedAt)) + '</td>'
        + '<td><div class="et-actions">'
        + '<button type="button" class="et-btn et-btn-tiny et-btn-ok" onclick="openDecideModal(\'' + escJs(relation.id) + '\',\'approved\')">Approve</button>'
        + '<button type="button" class="et-btn et-btn-tiny et-btn-bad" onclick="openDecideModal(\'' + escJs(relation.id) + '\',\'declined\')">Decline</button>'
        + '</div></td></tr>';
    });
    requestHtml += '</tbody></table></div>';
  }
  el('etRequestsCard').innerHTML = '<div class="et-card-head"><h2>Requests to decide</h2>'
    + '<span class="et-count">' + requests.length + '</span></div>'
    + '<div class="et-card-body flush">' + requestHtml + '</div>';

  /* open work */
  var pending = pendingRows();
  var openWorkHtml = '';
  if (openTasks.length === 0 && pending.length === 0) {
    openWorkHtml = '<div class="et-empty">Nothing is waiting: every task is done and every hour line is decided.</div>';
  } else {
    openWorkHtml = '<div class="et-table-wrap"><table class="et-table"><thead><tr>'
      + '<th>Item</th><th>Owner</th><th>Due / date</th><th>Status</th></tr></thead><tbody>';
    openTasks.forEach(function (task) {
      openWorkHtml += '<tr><td><div class="et-cell-main">' + esc(task.title) + '</div></td>'
        + '<td>' + esc(task.assigneeName || 'Unassigned') + '</td>'
        personId = relationRecord.personId;
    var actionButtons = '';

    if (relationRecord.status === 'requested' && canManage()) {
      actionButtons += '<button type="button" class="et-btn et-btn-tiny et-btn-ok" onclick="event.stopPropagation();openDecideModal(\'' + escJs(relation.id) + '\',\'approved\')">Approve</button>'
        + '<button type="button" class="et-btn et-btn-tiny et-btn-bad" onclick="event.stopPropagation();openDecideModal(\'' + escJs(relation.id) + '\',\'declined\')">Decline</button>';
    }
    actionButtons += '<button type="button" class="et-btn et-btn-tiny et-btn-outline" onclick="event.stopPropagation();openMemberDrawer(\'' + escJs(relation.id) + '\')">'
      + (canManage() ? 'Manage' : 'Details') + '</button>';

    html += '<tr class="et-row-clickable" onclick="openMemberDrawer(\'' + escJs(relation.id) + '\')">'
      + '<td>' + personCellHtml(personNameById(personId), personEmailById(personId)) + '</td>'
      + '<td>' + badge(personNetworkStatus('</div>';

  /* activity */
  var activity = [];
  APP.relations.forEach(function (relation) {
    var relationRecord = relationDataOf(relation);
    if (relationRecord.appliedAt) {
      activity.push({ when: relationRecord.appliedAt, text: personNameById(relationRecord.personId) + ' applied to the event', tag: 'Request' });
    }
    if (relationRecord.decidedAt) {
      activity.push({
        when: relationRecord.decidedAt,
        text: personNameById(relationRecord.personId) + ' was ' + (relationRecord.status === 'approved' ? 'approved' : 'declined'),
        tag: 'Decision'
      });
    }
    if (relationRecord.lastApprovedAt) {
      activity.push({
        when: relationRecord.lastApprovedAt,
        text: toNumber(relationRecord.hoursApprovedTotal).toFixed(1) + ' h approved for ' + personNameById(relationRecord.personId),
        tag: 'Hours'
      });
    }
  });
  tasks().forEach(function (task) {
    if (task.createdAt) activity.push({ when: task.createdAt, text: 'Task "' + task.title + '" created', tag: 'Task' });
    if (task.completedAt) activity.push({ when: task.completedAt, text: 'Task "' + task.title + '" completed', tag: 'Task' });
  });
  allMessages().forEach(function (entry) {
    activity.push({ when: entry.message.sentAt, text: entry.message.fromName + ': ' + (entry.message.subject || '(no subject)'), tag: 'Message' });
  });
  activity.sort(function (itemA, itemB) { return String(itemB.when || '').localeCompare(String(itemA.when || '')); });

  var activityHtml = '';
  if (activity.length === 0) activityHtml = '<div class="et-empty">No activity yet.</div>';
  else {
    activityHtml = '<ul class="et-activity">';
    activity.slice(0, 8).forEach(function (item) {
      activityHtml += '<li><span class="et-cell-sub" style="min-width:96px;">' + esc(fmtDate(item.when)) + '</span>'
        + '<span>' + esc(item.text) + '</span>'
        + '<span class="et-badge et-badge-draft">' + esc(item.tag) + '</span></li>';
    });
    activityHtml += '</ul>';
  }
  el('etActivityCard').innerHTML = '<div class="et-card-head"><h2>Recent activity</h2></div>'
    + '<div class="et-card-body">' + activityHtml + '</div>';
}

function renderTeam() {
  var rows = APP.relations.slice().sort(function (relationA, relationB) {
    var statusA = relationDataOf(relationA).status === 'requested' ? 0 : 1;
    var statusB = relationDataOf(relationB).status === 'requested' ? 0 : 1;
    if (statusA !== statusB) return statusA - statusB;
    return personNameById(relationDataOf(relationA).personId).localeCompare(personNameById(relationDataOf(relationB).personId));
  });

  if (!APP.eventObject) {
    el('etTeamTable').innerHTML = '<div class="et-empty"><strong>No event loaded</strong>Open this tool on an event object.</div>';
    return;
  }
  if (rows.length === 0) {
    el('etTeamTable').innerHTML = '<div class="et-empty"><strong>Nobody linked yet</strong>'
      + 'Use Add volunteers to pick people from the volunteer network.</div>';
    return;
  }

  var html = '<div class="et-table-wrap"><table class="et-table"><thead><tr>'
    + '<th>Volunteer</th><th>Network</th><th>Event status</th><th>Roles</th>'
    + '<th class="et-num">Tasks</th><th class="et-num">Hours</th><th></th>'
    + '</tr></thead><tbody>';

  rows.forEach(function (relation) {
    var relationRecord = relationDataOf(relation);
    var links = taskLinksOf(relation);
    var confirmed = links.filter(function (link) { return link.status === 'confirmed'; }).length;
    var positions = Array.isArray(relationRecord.positions) ? relationRecord.positions : [];
    var actionButtons = '';

    if (relationRecord.status === 'requested') {
      actionButtons += '<button type="button" class="et-btn et-btn-tiny et-btn-ok" onclick="openDecideModal(\'' + escJs(relation.id) + '\',\'approved\')">Approve</button>'
        + '<button type="button" class="et-btn et-btn-tiny et-btn-bad" onclick="openDecideModal(\'' + escJs(relation.id) + '\',\'declined\')">Decline</button>';
    }
    if (canManage()) {
      actionButtons += '<button type="button" class="et-btn et-btn-tiny et-btn-outline" onclick="openRolesModal(\'' + escJs(relation.id) + '\')">Roles</button>'
        + '<button type="button" class="et-btn et-btn-tiny et-btn-bad" onclick="openRemoveModal(\'' + escJs(relation.id) + '\')">Remove</button>';
    }

    html += '<tr>'
      + '<td><div class="et-cell-main">' + esc(personNameById(relationRecord.personId)) + '</div>'
      + '<div class="et-cell-sub">' + esc(personEmailById(relationRecord.personId)) + '</div></td>'
      + '<td>' + badge(personNetworkStatus(relationRecord.personId)) + '</td>'
      + '<td>' + badge(relationRecord.status || 'requested') + '</td>'
      + '<td>' + esc(positions.length ? positions.map(function (position) { return position.name; }).join(', ') : '-') + '</td>'
      + '<td class="et-num">' + confirmed + ' / ' + links.length + '</td>'
      + '<td class="et-num">' + toNumber(relationRecord.hoursApprovedTotal).toFixed(1) + ' h</td>'
      + '<td><div class="et-actions">' + actionButtons + '</div></td>'
      + '</tr>';
  });

  html += '</tbody></table></div>';
  el('etTeamTable').innerHTML = html;
}

function renderTasks() {
  var rows = tasks().slice().sort(function (taskA, taskB) {
    var order = { 'reported-done': 0, 'in-progress': 1, assigned: 2, open: 3, completed: 4, cancelled: 5 };
    var rankA = order[taskA.status];
    var rankB = order[taskB.status];
    return (rankA === undefined ? 9 : rankA) - (rankB === undefined ? 9 : rankB);
  });

  if (!APP.tasksDoc) {
    el('etTaskTable').innerHTML = '<div class="et-empty"><strong>No task list yet</strong>'
      + 'Add the first task; the task document is created with it.</div>';
    return;
  }
  if (rows.length === 0) {
    el('etTaskTable').innerHTML = '<div class="et-empty"><strong>No tasks</strong>Add the first task and assign it to someone on the team.</div>';
    return;
  }

  var approved = approvedRelations();
  var html = '<div class="et-table-wrap"><table class="et-table"><thead><tr>'
    + '<th>Task</th><th>Assignee</th><th>Due</th><th class="et-num">Est. h</th><th>Status</th><th></th>'
    + '</tr></thead><tbody>';

  rows.forEach(function (task) {
    var options = '<option value="">Unassigned</option>';
    var assigneeKnown = false;
    approved.forEach(function (relation) {
      var personId = relationDataOf(relation).personId;
      if (task.assigneePersonId === personId) assigneeKnown = true;
      options += '<option value="' + esc(personId) + '"' + (task.assigneePersonId === personId ? ' selected' : '') + '>'
        + esc(personNameById(personId)) + '</option>';
    });
    if (task.assigneePersonId && !assigneeKnown) {
      options += '<option value="' + esc(task.assigneePersonId) + '" selected>' + esc(personNameById(task.assigneePersonId)) + ' (not approved)</option>';
    }

    var assigneeCell = canManage()
      ? '<select class="et-select" style="min-width:170px;" onchange="changeTaskAssignee(\'' + escJs(task.id) + '\', this.value)">' + options + '</select>'
      : esc(task.assigneeName || 'Unassigned');

    var actions = '';
    if (canManage()) {
      actions += '<button type="button" class="et-btn et-btn-tiny et-btn-outline" onclick="openTaskModal(\'' + escJs(task.id) + '\')">Edit</button>';
      if (task.status !== 'completed') {
        actions += '<button type="button" class="et-btn et-btn-tiny et-btn-ok" onclick="openConfirmTaskModal(\'' + escJs(task.id) + '\')">Confirm</button>';
      }
      actions += '<button type="button" class="et-btn et-btn-tiny et-btn-bad" onclick="openDeleteTaskModal(\'' + escJs(task.id) + '\')">Delete</button>';
    }

    html += '<tr>'
      + '<td><div class="et-cell-main">' + esc(task.title) + '</div>'
      + (task.description ? '<div class="et-cell-sub">' + esc(String(task.description).slice(0, 110)) + '</div>' : '') + '</td>'
      + '<td>' + assigneeCell + '</td>'
      + '<td>' + esc(task.dueDate ? fmtDate(task.dueDate) : '-') + '</td>'
      + '<td class="et-num">' + toNumber(task.estimatedHours).toFixed(1) + '</td>'
      + '<td>' + badge(task.status === 'open' ? 'open_task' : task.status) + '</td>'
      + '<td><div class="et-actions">' + actions + '</div></td></tr>';
  });

  html += '</tbody></table></div>';
  el('etTaskTable').innerHTML = html;
}

function renderHours() {
  var totals = eventHourTotals();
  el('etHoursTotals').textContent = totals.approved.toFixed(1) + ' h approved - ' + totals.pending.toFixed(1) + ' h waiting';

  var approved = approvedRelations();
  var html = '';
  if (approved.length === 0) {
    html = '<div class="et-empty">Approve volunteers first, then their hours appear here.</div>';
  } else {
    html = '<div class="et-table-wrap"><table class="et-table"><thead><tr>'
      + '<th>Volunteer</th><th class="et-num">Approved</th><th class="et-num">Pending</th><th class="et-num">Tasks confirmed</th>'
      + '</tr></thead><tbody>';
    approved.forEach(function (relation) {
      var relationRecord = relationDataOf(relation);
      var pendingTotal = 0;
      (Array.isArray(relationRecord.pendingHours) ? relationRecord.pendingHours : []).forEach(function (line) {
        pendingTotal += toNumber(line.hours);
      });
      var links = taskLinksOf(relation);
      var confirmed = links.filter(function (link) { return link.status === 'confirmed'; }).length;
      html += '<tr><td><div class="et-cell-main">' + esc(personNameById(relationRecord.personId)) + '</div></td>'
        + '<td class="et-num">' + toNumber(relationRecord.hoursApprovedTotal).toFixed(1) + '</td>'
        + '<td class="et-num">' + pendingTotal.toFixed(1) + '</td>'
        + '<td class="et-num">' + confirmed + ' / ' + links.length + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }
  el('etHoursByVolunteer').innerHTML = html;

  var pending = pendingRows();
  var pendingHtml = '';
  if (pending.length === 0) {
    pendingHtml = '<div class="et-empty">No hour lines are waiting for approval.</div>';
  } else {
    pendingHtml = '<div class="et-table-wrap"><table class="et-table"><thead><tr>'
      + '<th>Volunteer</th><th>Date</th><th>Task</th><th class="et-num">Hours</th><th>Note</th><th></th>'
      + '</tr></thead><tbody>';
    pending.forEach(function (row) {
      pendingHtml += '<tr>'
        + '<td><div class="et-cell-main">' + esc(personNameById(row.personId)) + '</div></td>'
        + '<td>' + esc(fmtDate(row.line.date)) + '</td>'
        + '<td>' + esc(row.line.taskTitle || 'General') + '</td>'
        + '<td class="et-num">' + toNumber(row.line.hours).toFixed(1) + '</td>'
        + '<td>' + esc(String(row.line.note || '').slice(0, 70)) + '</td>'
        + '<td><div class="et-actions">'
        + '<button type="button" class="et-btn et-btn-tiny et-btn-ok" onclick="openApproveHoursModal(\'' + escJs(row.relation.id) + '\',\'' + escJs(row.line.id) + '\')">Approve</button>'
        + '<button type="button" class="et-btn et-btn-tiny et-btn-bad" onclick="openRejectHoursModal(\'' + escJs(row.relation.id) + '\',\'' + escJs(row.line.id) + '\')">Reject</button>'
        + '</div></td></tr>';
    });
    pendingHtml += '</tbody></table></div>';
  }
  el('etHoursPending').innerHTML = pendingHtml;

  var records = hourRecordsOfEvent();
  var recordsHtml = '';
  if (records.length === 0) {
    recordsHtml = '<div class="et-empty">No approved hour records for this event yet.</div>';
  } else {
    recordsHtml = '<div class="et-table-wrap"><table class="et-table"><thead><tr>'
      + '<th>Date</th><th>Volunteer</th><th>Task</th><th class="et-num">Hours</th><th>Approved by</th>'
      + '</tr></thead><tbody>';
    records.forEach(function (record) {
      recordsHtml += '<tr>'
        + '<td>' + esc(fmtDate(record.line.eventDate)) + '</td>'
        + '<td>' + esc(personNameById(record.personId)) + '</td>'
        + '<td>' + esc(record.line.taskSummary || '-') + '</td>'
        + '<td class="et-num">' + toNumber(record.line.hours).toFixed(1) + '</td>'
        + '<td>' + esc(record.line.approvedBy || '-') + '</td></tr>';
    });
    recordsHtml += '</tbody></table></div>';
  }
  el('etHoursLedger').innerHTML = recordsHtml;
}

function renderMessages() {
  var volumes = sortedVolumes();
  var html = '';

  if (volumes.length === 0) {
    html = '<div class="et-empty"><strong>No messages yet</strong>Announcements are stored per event, in volumes that can be closed and archived.</div>';
  } else {
    volumes.forEach(function (doc) {
      var data = vd(doc);
      var list = Array.isArray(data.messages) ? data.messages : [];
      html += '<div class="et-volume">'
        + '<div class="et-volume-head">'
        + '<strong>Volume ' + toNumber(data.volume || 1) + '</strong>'
        + (data.closed ? '<span class="et-badge et-badge-closed">Closed, read only</span>' : '<span class="et-badge et-badge-open">Open</span>')
        + '<span class="et-cell-sub">' + list.length + ' / ' + LIMITS.messagesPerVolume + ' messages</span>'
        + '</div>';
      if (list.length === 0) {
        html += '<div class="et-cell-sub" style="padding:6px 0;">This volume is empty.</div>';
      } else {
        list.forEach(function (message) {
          html += '<div class="et-msg">'
            + '<div class="et-msg-head"><strong>' + esc(message.fromName || 'Event manager') + '</strong>'
            + '<span class="et-cell-sub">' + esc(fmtDateTime(message.sentAt)) + '</span></div>'
            + '<div class="et-msg-subject">' + esc(message.subject || '(no subject)') + '</div>'
            + '<div class="et-msg-body">' + esc(String(message.body || '').slice(0, 500)) + '</div>'
            + '</div>';
        });
      }
      html += '</div>';
    });
    html += '<div class="et-note">A full volume is closed and a new one is opened. Closing a volume never touches the event, its tasks or its hours.</div>';
  }
  el('etMessageList').innerHTML = html;
}

function renderReport() {
  var totals = eventHourTotals();
  var approved = approvedRelations();
  var allTasks = tasks();
  var completed = allTasks.filter(function (task) { return task.status === 'completed'; }).length;

  var html = '<div class="et-stats" style="margin-bottom:12px;">'
    + statCard(String(approved.length) + ' / ' + APP.relations.length, 'Volunteers approved / linked')
    + statCard(completed + ' / ' + allTasks.length, 'Tasks completed')
    + statCard(totals.approved.toFixed(1), 'Approved hours')
    + statCard(totals.pending.toFixed(1), 'Hours waiting')
    + '</div>';

  html += '<div class="et-table-wrap"><table class="et-table"><thead><tr>'
    + '<th>Volunteer</th><th>Roles</th><th class="et-num">Tasks</th><th class="et-num">Approved h</th><th class="et-num">Pending h</th>'
    + '</tr></thead><tbody>';
  if (APP.relations.length === 0) {
    html += '<tr><td colspan="5"><div class="et-empty" style="padding:12px;">Nobody is linked to this event.</div></td></tr>';
  }
  APP.relations.forEach(function (relation) {
    var relationRecord = relationDataOf(relation);
    var links = taskLinksOf(relation);
    var confirmed = links.filter(function (link) { return link.status === 'confirmed'; }).length;
    var positions = Array.isArray(relationRecord.positions) ? relationRecord.positions : [];
    var pendingTotal = 0;
    (Array.isArray(relationRecord.pendingHours) ? relationRecord.pendingHours : []).forEach(function (line) {
      pendingTotal += toNumber(line.hours);
    });
    html += '<tr>'
      + '<td><div class="et-cell-main">' + esc(personNameById(relationRecord.personId)) + '</div>'
      + '<div class="et-cell-sub">' + esc(statusLabel(relationRecord.status)) + '</div></td>'
      + '<td>' + esc(positions.length ? positions.map(function (position) { return position.name; }).join(', ') : '-') + '</td>'
      + '<td class="et-num">' + confirmed + ' / ' + links.length + '</td>'
      + '<td class="et-num">' + toNumber(relationRecord.hoursApprovedTotal).toFixed(1) + '</td>'
      + '<td class="et-num">' + pendingTotal.toFixed(1) + '</td></tr>';
  });
  html += '</tbody></table></div>';

  html += '<div class="et-note">Hours counted here are the ones a manager approved. Pending lines are not included in the approved total.</div>';
  el('etReportBody').innerHTML = html;
}

function renderEventForm() {
  var data = APP.eventData;
  if (!APP.eventObject) {
    el('etEventForm').innerHTML = '<div class="et-empty">No event loaded.</div>';
    return;
  }

  var disabled = canManage() ? '' : ' disabled';
  el('etEventUpdated').textContent = data.updatedAt ? 'Updated ' + fmtDate(data.updatedAt) : '';
ember drawer ---------------- */
function openMemberDrawer(relationId) {
  if (!relationId) return;
  APP.openRelationId = relationId;
  APP.drawerConfirm = '';
  renderMemberDrawer();
  el('etMemberDrawer').classList.add('open');
  try { tool.resize(); } catch (error) { /* optional */ }
}

function closeMemberDrawer() {
  APP.openRelationId = '';
  APP.drawerConfirm = '';
  el('etMemberDrawer').classList.remove('open');
}

function armDrawerConfirm(confirmKind) {
  APP.drawerConfirm = confirmKind;
  renderMemberDrawer();
}

function cancelDrawerConfirm() {
  APP.drawerConfirm = '';
  renderMemberDrawer();
}

function confirmBlockHtml(message, confirmLabel, actionCall) {
  return '<div class="et-confirm"><div>' + esc(message) + '</div>'
    + '<div class="et-actions">'
    + '<button type="button" class="et-btn et-btn-tiny" onclick="cancelDrawerConfirm()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-tiny et-btn-bad" onclick="' + actionCall + '">' + esc(confirmLabel) + '</button>'
    + '</div></div>';
}

function changeRelationStatus(nextStatus, successMessage) {
  var relation = findRelationById(APP.openRelationId);
  if (!relation || !canManage()) return;
  var changes = { status: nextStatus, decidedAt: isoNow(), decidedBy: currentUserName() };
  if (nextStatus === 'approved') changes.approvedAt = isoNow();
  if (nextStatus === 'revoked') changes.revokedAt = isoNow();
  updateRelation(relation, changes, function () {
    APP.drawerConfirm = '';
    notifyHost(successMessage, nextStatus === 'approved' ? 'success' : 'info');
    loadAll();
  });
}

function drawerApprove() {
  changeRelationStatus('approved', 'Volunteer approved for this event.');
}

function drawerRevoke() {
  changeRelationStatus('revoked', 'Approval revoked. Approved hours stay on the volunteer record.');
}

function drawerDecline() {
  changeRelationStatus('declined', 'Request declined. You can approve this person laon the Event details screen first, then come back here.</div>');
    return;
  }

  var items = positions.map(function (position) {
    var slots = toNumber(position.slots);
    return choiceItemHtml({
      name: 'etRoleCheck',
      value: position.id,
      checked: currentIds.indexOf(position.id) !== -1,
      title: position.name,
      subtitle: position.description || 'No description',
      tag: slots + (slots === 1 ? ' place' : ' places'),
      search: position.name + ' ' + (position.description || '')
    });
  }).join('');

  var body = '<div class="et-picker">'
    + '<div class="et-picker-toolbar">'
    + '<span class="et-hint" style="flex:1 1 auto; margin:0;">Tick the roles <strong>' + esc(personNameById(relationDataOf(relation).personId)) + '</strong> works in for this event.</span>'
    + '<span class="et-picker-count" id="etRoleCount">0 selected</span>'
    + '</div>'
    + '<div class="et-picker-list" id="etRoleList">' + items + '</div>'
    + '<div class="et-hint">Roles are saved on this placement only and marked as approved.</div>'
    + '</div>';

  openModal('Roles', body,
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-primary" onclick="saveRolesFor(\'' + escJs(relationId) + '\')">Save roles</button>');

  bindChoicePicker('etRoleList', 'etRoleCount
}

function renderMemberDrawer() {
  if (!APP.openRelationId) return;
  var relation = findRelationById(APP.openRelationId);
  if (!relation) { closeMemberDrawer(); return; }

  var relationRecord = relationDataOf(relation);
  var personId = relationRecord.personId;
  var personName = personNameById(personId);
  var personEmail = personEmailById(personId);
  var status = relationRecord.status || 'requested';
  var positions = Array.isArray(relationRecord.positions) ? relationRecord.positions : [];
  var links = taskLinksOf(relation);
  var confirmedTasks = links.filter(function (link) { return link.status === 'confirmed'; }).length;
  var pendingHours = Array.isArray(relationRecord.pendingHours) ? relationRecord.pendingHours : [];
  var pendingTotal = 0;
  pendingHours.forEach(function (line) { pendingTotal += toNumber(line.hours); });

  el('etDrawerAvatar').textContent = initialsOf(personName);
  el('etDrawerName').textContent = personName;
  el('etDrawerEmail').textContent = personEmail || 'No email on file';

  var body = '';
var items = candidates.map(function (person) {
      var data = vd(person);
      var fullName = ((data.firstName || '') + ' ' + (data.lastName || '')).trim() || data.email || person.name || 'Volunteer';
      var email = data.email || '';
      return choiceItemHtml({
        name: 'etAddPerson',
        value: person.id,
        checked: false,
        title: fullName,
        subtitle: email || 'No email on file',
        tag: statusLabel(data.status || 'candidate'),
        search: fullName + ' ' + email
      });
    }).join('');

    body = '<div class="et-picker">'
      + '<div class="et-picker-toolbar">'
      + '<input class="et-input" id="etPersonSearch" type="search" placeholder="Search by name or email"'
      + ' oninput="filterChoicePicker(\'etPersonList\', this.value)">'
      + '<button type="button" class="et-btn et-btn-tiny et-btn-ghost" onclick="selectAllVisibleChoices(\'etPersonList\', \'etPersonCount\')">Select all</button>'
      + '<span class="et-picker-count" id="etPersonCount">0 selected</span>'
      + '</div>'
      + '<div class="et-picker-list" id="etPersonList">' + items + '</div>'
      + '<div class="et-hint">People added here are approved for this event immediately. Everyone else stays in the volunteer network.</div>'
      + '</div>';
  }

  openModal('Add volunteers', body,
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + (candidates.length === 0 ? '' : '<button type="button" class="et-btn et-btn-primary" onclick="confirmAddVolunteers()">Add selected</button>'));

  if (candidates.length > 0) bindChoicePicker('etPersonList', 'etPersonCountrevoke\')">Revoke approval</button>';
    }
    if (status === 'requested') {
      statusButtons += '<button type="button" class="et-btn et-btn-tiny et-btn-bad" onclick="armDrawerConfirm(\'decline\')">Decline request</button>';
    }
    if (statusButtons) body += '<div class="et-actions" style="margin-top:10px;">' + statusButtons + '</div>';

    if (APP.drawerConfirm === 'revoke') {
      body += confirmBlockHtml('Revoke this approval? ' + personName + ' leaves the event team. Hours already approved stay on their volunteer record.', 'Revoke approval', 'drawerRevoke()');
    }
    if (APP.drawerConfirm === 'decline') {
      body += confirmBlockHtml('Decline the request from ' + personName + '? Their volunteer profile is not affected.', 'Decline request', 'drawerDecline()');
    }
  } else {
    body += '<div class="et-note">View only. Only an event manager can change this placement.</div>';
  }
  body += '</div>';

  /* roles */
  body += '<div class="et-dsection"><h3>Roles</h3>';
  if (positions.length === 0) {
    body += '<div class="et-hint">No roles set for this placement.</div>';
  } else {
    body += '<div class="et-role-chips">' + positions.map(function (position) {
      return '<span class="et-role-chip">' + esc(position.name) + '</span>';
    }).join('') + '</div>';
  }
  if (canManage()) {
    body += '<div class="et-actions" style="margin-top:10px;">'
      + '<button type="button" class="et-btn et-btn-tiny et-btn-outline" onclick="drawerOpenRoles()">Change roles</button>'
      + '</div>';
    if (positions.length === 0 && (!Array.isArray(APP.eventData.positions) || APP.eventData.positions.length === 0)) {
      body += '<div class="et-dnote">This event has no roles yet. Add roles on the Event details screen first.</div>';
    }
  }
  body += '</div>';

  /* tasks */
  body += '<div class="et-dsection"><h3>Tasks</h3>';
  body += '<div class="et-drow"><span class="et-drow-label">Confirmed / assigned</span>'
    + '<span class="et-drow-value">' + confirmedTasks + ' / ' + links.length + '</span></div>';
  if (links.length === 0) {
    body += '<div class="et-hint">No task is assigned to this volunteer yet.</div>';
  } else {
    links.forEach(function (link) {
      body += '<div class="et-drow"><span class="et-drow-label">' + esc(link.title || 'Task') + '</span>'
        + '<span class="et-drow-value">' + badge(link.status) + '</span></div>';
    });
  }
  body += '</div>';

  /* hours */
  body += '<div class="et-dsection"><h3>Hours</h3>'
    + '<div class="et-drow"><span class="et-drow-label">Approved hours</span>'
    + '<span class="et-drow-value">' + toNumber(relationRecord.hoursApprovedTotal).toFixed(1) + ' h</span></div>'
    + '<div class="et-drow"><span class="et-drow-label">Waiting for approval</span>'
    + '<span class="et-drow-value">' + pendingTotal.toFixed(1) + ' h (' + pendingHours.length + ')</span></div>'
    + '<div class="et-drow"><span class="et-drow-label">Last approved</span>'
    + '<span class="et-drow-value">' + esc(relationRecord.lastApprovedAt ? fmtDateTime(relationRecord.lastApprovedAt) : '-') + '</span></div>'
    + '</div>';

  /* placement details */
  body += '<div class="et-dsection"><h3>Placement</h3>'
    + '<div class="et-drow"><span class="et-drow-label">Added / applied</span>'
    + '<span class="et-drow-value">' + esc(fmtDate(relationRecord.appliedAt)) + '</span></div>'
    + '<div class="et-drow"><span class="et-drow-label">Last decision</span>'
    + '<span class="et-drow-value">' + esc(relationRecord.decidedAt ? fmtDate(relationRecord.decidedAt) : '-') + '</span></div>'
    + '<div class="et-drow"><span class="et-drow-label">Decided by</span>'
    + '<span class="et-drow-value">' + esc(relationRecord.decidedBy || '-') + '</span></div>'
    + '<div class="et-drow"><span class="et-drow-label">Added by</span>'
    + '<span class="et-drow-value">' + esc(relationRecord.source === 'manager' ? 'Event manager' : 'Volunteer application') + '</span></div>'
    + '</div>';

  if (canManage() && APP.drawerConfirm === 'remove') {
    body += confirmBlockHtml('Remove ' + personName + ' from this event? The volunteer profile and approved hours stay in the volunteer network.', 'Remove from event', 'drawerRemove()');
  }

  el('etDrawerBody').innerHTML = body;

  var foot = '';
  if (canManage()) {
    foot += '<button type="button" class="et-btn et-btn-tiny et-btn-bad" onclick="armDrawerConfirm(\'remove\')">Remove from event</button>';
  } else {
    foot += '<span class="et-cell-sub">Read only</span>';
  }
  foot += '<button type="button" class="et-btn et-btn-ghost" onclick="closeMemberDrawer()">Close</button>';
  el('etDrawerFoot').innerHTML = foot;
}

/* ---------------- m
  var html = '<div class="et-field"><label for="etFormName">Event name</label>'
    + '<input class="et-input" id="etFormName" value="' + esc(data.name || '') + '"' + disabled + '></div>'
    + '<div class="et-field-row">'
    + '<div class="et-field"><label for="etFormStatus">Status</label>'
    + '<select class="et-select" id="etFormStatus"' + disabled + '>'
    + ['draft', 'open', 'closed', 'cancelled'].map(function (status) {
      return '<option value="' + status + '"' + ((data.status || 'draft') === status ? ' selected' : '') + '>' + esc(statusLabel(status)) + '</option>';
    }).join('')
    + '</select></div>'
    + '<div class="et-field"><label for="etFormCapacity">Capacity</label>'
    + '<input class="et-input" type="number" min="0" id="etFormCapacity" value="' + esc(data.capacity || 0) + '"' + disabled + '></div>'
    + '</div>'
    + '<div class="et-field-row">'
    + '<div class="et-field"><label for="etFormStartDate">Start date</label>'
    + '<input class="et-input" type="date" id="etFormStartDate" value="' + esc(data.startDate || '') + '"' + disabled + '></div>'
    + '<div class="et-field"><label for="etFormEndDate">End date</label>'
    + '<input class="et-input" type="date" id="etFormEndDate" value="' + esc(data.endDate || '') + '"' + disabled + '></div>'
    + '</div>'
    + '<div class="et-field-row">'
    + '<div class="et-field"><label for="etFormStartTime">Start time</label>'
    + '<input class="et-input" type="time" id="etFormStartTime" value="' + esc(data.startTime || '') + '"' + disabled + '></div>'
    + '<div class="et-field"><label for="etFormEndTime">End time</label>'
    + '<input class="et-input" type="time" id="etFormEndTime" value="' + esc(data.endTime || '') + '"' + disabled + '></div>'
    + '</div>'
    + '<div class="et-field-row">'
    + '<div class="et-field"><label for="etFormLocation">Venue</label>'
    + '<input class="et-input" id="etFormLocation" value="' + esc(data.locationName || '') + '"' + disabled + '></div>'
    + '<div class="et-field"><label for="etFormCity">City</label>'
    + '<input class="et-input" id="etFormCity" value="' + esc(data.city || '') + '"' + disabled + '></div>'
    + '</div>'
    + '<div class="et-field"><label for="etFormAddress">Address</label>'
    + '<input class="et-input" id="etFormAddress" value="' + esc(data.address || '') + '"' + disabled + '></div>'
    + '<div class="et-field"><label for="etFormDescription">Description</label>'
    + '<textarea class="et-textarea" id="etFormDescription" maxlength="1000"' + disabled + '>' + esc(data.description || '') + '</textarea></div>'
    + '<div class="et-field"><label for="etFormNotes">Internal notes</label>'
    + '<textarea class="et-textarea" id="etFormNotes" maxlength="1000"' + disabled + '>' + esc(data.notes || '') + '</textarea></div>';

  if (canManage()) {
    html += '<div class="et-actions"><button type="button" class="et-btn et-btn-primary" onclick="saveEventFromForm()">Save event</button></div>';
  } else {
    html += '<div class="et-note">Only an event manager can edit the event definition.</div>';
  }

  el('etEventForm').innerHTML = html;
}

function renderPositions() {
  var positions = Array.isArray(APP.eventData.positions) ? APP.eventData.positions : [];
  if (!APP.eventObject) {
    el('etPositionList').innerHTML = '<div class="et-empty">No event loaded.</div>';
    return;
  }
  if (positions.length === 0) {
    el('etPositionList').innerHTML = '<div class="et-empty"><strong>No roles yet</strong>Add the roles volunteers can apply for.</div>';
    return;
  }

  var html = '<div class="et-table-wrap"><table class="et-table"><thead><tr>'
    + '<th>Role</th><th class="et-num">Places</th><th>Description</th><th></th></tr></thead><tbody>';
  positions.forEach(function (position) {
    html += '<tr>'
      + '<td><div class="et-cell-main">' + esc(position.name) + '</div></td>'
      + '<td class="et-num">' + toNumber(position.slots) + '</td>'
      + '<td>' + esc(position.description || '-') + '</td>'
      + '<td><div class="et-actions">'
      + (canManage() ? '<button type="button" class="et-btn et-btn-tiny et-btn-outline" onclick="openPositionModal(\'' + escJs(position.id) + '\')">Edit</button>'
        + '<button type="button" class="et-btn et-btn-tiny et-btn-bad" onclick="openDeletePositionModal(\'' + escJs(position.id) + '\')">Delete</button>' : '')
      + '</div></td></tr>';
  });
  html += '</tbody></table></div>';
  el('etPositionList').innerHTML = html;
}

/* ---------------- views ---------------- */
function showView(view) {
  APP.view = view;
  var buttons = document.querySelectorAll('.et-nav-btn');
  for (var index = 0; index < buttons.length; index++) {
    buttons[index].classList.toggle('active', buttons[index].getAttribute('data-view') === view);
  }
  var panels = document.querySelectorAll('.et-panel');
  for (var panelIndex = 0; panelIndex < panels.length; panelIndex++) panels[panelIndex].classList.remove('active');
  var target = el('etPanel' + view.charAt(0).toUpperCase() + view.slice(1));
  if (target) target.classList.add('active');
  try { tool.resize(); } catch (error) { /* optional */ }
}

/* ---------------- modals ---------------- */
function openModal(title, bodyHtml, footHtml) {
  el('etModalTitle').textContent = title;
  el('etModalBody').innerHTML = bodyHtml;
  el('etModalFoot').innerHTML = footHtml || '<button type="button" class="et-btn" onclick="closeModal()">Close</button>';
  el('etModal').classList.add('open');
}

function closeModal() { el('etModal').classList.remove('open'); }

function findRelationById(relationId) {
  for (var index = 0; index < APP.relations.length; index++) {
    if (APP.relations[index].id === relationId) return APP.relations[index];
  }
  return null;
}

function openDecideModal(relationId, decision) {
  var relation = findRelationById(relationId);
  if (!relation) return;
  var personId = relationDataOf(relation).personId;
  openModal(decision === 'approved' ? 'Approve this volunteer' : 'Decline this request',
    '<p>' + (decision === 'approved' ? 'Approve' : 'Decline') + ' <strong>' + esc(personNameById(personId)) + '</strong> for this event?</p>'
    + '<div class="et-note">This only decides the event placement. The volunteer network status is separate.</div>',
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn ' + (decision === 'approved' ? 'et-btn-ok' : 'et-btn-bad') + '" onclick="confirmDecision(\'' + escJs(relationId) + '\',\'' + escJs(decision) + '\')">'
    + (decision === 'approved' ? 'Approve' : 'Decline') + '</button>');
}

function confirmDecision(relationId, decision) {
  var relation = findRelationById(relationId);
  if (relation) decideRelation(relation, decision);
}

function openRemoveModal(relationId) {
  var relation = findRelationById(relationId);
  if (!relation) return;
  openModal('Remove from this event',
    '<p>Remove <strong>' + esc(personNameById(relationDataOf(relation).personId)) + '</strong> from this event?</p>'
    + '<div class="et-note">The person stays in the volunteer network and keeps their approved hours.</div>',
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-bad" onclick="confirmRemove(\'' + escJs(relationId) + '\')">Remove</button>');
}

function confirmRemove(relationId) {
  var relation = findRelationById(relationId);
  if (relation) removeRelation(relation);
}

function openRolesModal(relationId) {
  var relation = findRelationById(relationId);
  if (!relation) return;
  var positions = Array.isArray(APP.eventData.positions) ? APP.eventData.positions : [];
  var current = Array.isArray(relationDataOf(relation).positions) ? relationDataOf(relation).positions : [];
  var currentIds = current.map(function (position) { return position.positionId; });

  if (positions.length === 0) {
    openModal('Roles', '<div class="et-note">This event has no roles yet. Add roles in Event settings first.</div>');
    return;
  }

  var body = '<div class="et-field"><label>Roles for ' + esc(personNameById(relationDataOf(relation).personId)) + '</label><div class="et-checks">';
  positions.forEach(function (position) {
    body += '<label class="et-check"><input type="checkbox" name="etRoleCheck" value="' + esc(position.id) + '"'
      + (currentIds.indexOf(position.id) !== -1 ? ' checked' : '') + '>'
      + '<span><strong>' + esc(position.name) + '</strong>'
      + (position.description ? '<div class="et-cell-sub">' + esc(position.description) + '</div>' : '')
      + '</span></label>';
  });
  body += '</div></div><div class="et-hint">Roles are saved with status approved for this placement.</div>';

  openModal('Roles', body,
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-primary" onclick="saveRolesFor(\'' + escJs(relationId) + '\')">Save roles</button>');
}

function saveRolesFor(relationId) {
  var relation = findRelationById(relationId);
  if (!relation) return;
  var positions = Array.isArray(APP.eventData.positions) ? APP.eventData.positions : [];
  var chosen = [];
  var boxes = document.querySelectorAll('input[name="etRoleCheck"]');
  for (var index = 0; index < boxes.length; index++) {
    if (!boxes[index].checked) continue;
    var positionId = boxes[index].value;
    positions.forEach(function (position) {
      if (position.id === positionId) chosen.push({ positionId: position.id, name: position.name, status: 'approved' });
    });
  }
  updateRelation(relation, { positions: chosen.slice(0, 10) }, function () {
    notifyHost('Roles updated.', 'success');
    closeModal();
    loadAll();
  });
}

function openAddVolunteerModal() {
  if (!canManage()) return;
  var linked = {};
  APP.relations.forEach(function (relation) { linked[relationDataOf(relation).personId] = true; });

  var candidates = APP.persons.filter(function (person) {
    var data = vd(person);
    if (linked[person.id]) return false;
    if (data.status === 'banned') return false;
    return true;
  });

  var body = '';
  if (candidates.length === 0) {
    body = '<div class="et-note">Everyone in the volunteer network is already linked to this event.</div>';
  } else {
    body = '<div class="et-field"><label>Add people to this event</label><div class="et-checks" style="max-height:320px;overflow-y:auto;">';
    candidates.forEach(function (person) {
      var data = vd(person);
      var full = ((data.firstName || '') + ' ' + (data.lastName || '')).trim() || data.email || person.name;
      body += '<label class="et-check"><input type="checkbox" name="etAddPerson" value="' + esc(person.id) + '">'
        + '<span><strong>' + esc(full) + '</strong> <span class="et-cell-sub">' + esc(data.email || '') + '</span>'
        + '<div class="et-cell-sub">' + esc(statusLabel(data.status || 'candidate')) + '</div></span></label>';
    });
    body += '</div></div><div class="et-hint">People added here are approved for this event immediately.</div>';
  }

  openModal('Add volunteers', body,
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-primary" onclick="confirmAddVolunteers()">Add selected</button>');
}

function confirmAddVolunteers() {
  var boxes = document.querySelectorAll('input[name="etAddPerson"]');
  var chosen = [];
  for (var index = 0; index < boxes.length; index++) {
    if (boxes[index].checked) chosen.push(boxes[index].value);
  }
  if (chosen.length === 0) { notifyHost('Select at least one person.', 'warning'); return; }

  var remaining = chosen.length;
  var failed = 0;

  function done() {
    remaining--;
    if (remaining > 0) return;
    if (failed) notifyHost(failed + ' people could not be added.', 'warning');
    else notifyHost('Volunteers added to the event.', 'success');
    closeModal();
    loadAll();
  }

  chosen.forEach(function (personId) {
    var person = personById(personId);
    var data = vd(person);
    createObject(typeRelation(), personNameById(personId), {
      personId: personId,
      personUserId: data.userId || '',
      eventId: APP.eventObject.id,
      eventName: eventName(),
      status: 'approved',
      source: 'manager',
      positions: [],
      taskLinks: [],
      pendingHours: [],
      hoursHistory: [],
      approvedLedgerIds: [],
      hoursApprovedTotal: 0,
      appliedAt: isoNow(),
      decidedAt: isoNow(),
      decidedBy: currentUserName(),
      updatedAt: isoNow()
    }, function (error) {
      if (error) failed++;
      done();
    });
  });
}

function openTaskModal(taskId) {
  if (!canManage()) return;
  var task = taskId ? taskById(taskId) : null;
  var approved = approvedRelations();

  var options = '<option value="">Unassigned</option>' + approved.map(function (relation) {
    var personId = relationDataOf(relation).personId;
    return '<option value="' + esc(personId) + '"' + (task && task.assigneePersonId === personId ? ' selected' : '') + '>'
      + esc(personNameById(personId)) + '</option>';
  }).join('');

  var body = '<div class="et-field"><label for="etTaskTitle">Task title</label>'
    + '<input class="et-input" id="etTaskTitle" maxlength="120" value="' + esc(task ? task.title : '') + '"></div>'
    + '<div class="et-field"><label for="etTaskDescription">Description</label>'
    + '<textarea class="et-textarea" id="etTaskDescription" maxlength="500">' + esc(task ? task.description : '') + '</textarea></div>'
    + '<div class="et-field-row">'
    + '<div class="et-field"><label for="etTaskDue">Due date</label>'
    + '<input class="et-input" type="date" id="etTaskDue" value="' + esc(task ? task.dueDate || '' : '') + '"></div>'
    + '<div class="et-field"><label for="etTaskHours">Estimated hours</label>'
    + '<input class="et-input" type="number" min="0" step="0.25" id="etTaskHours" value="' + esc(task ? toNumber(task.estimatedHours) : 0) + '"></div>'
    + '</div>'
    + '<div class="et-field"><label for="etTaskAssignee">Assign to</label>'
    + '<select class="et-select" id="etTaskAssignee">' + options + '</select>'
    + '<div class="et-hint">Only volunteers approved for this event are listed.</div></div>';

  openModal(task ? 'Edit task' : 'New task', body,
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-primary" onclick="submitTask(' + (taskId ? '\'' + escJs(taskId) + '\'' : 'null') + ')">'
    + (task ? 'Save task' : 'Create task') + '</button>');
}

function submitTask(taskId) {
  var values = {
    title: el('etTaskTitle') ? el('etTaskTitle').value.trim() : '',
    description: el('etTaskDescription') ? el('etTaskDescription').value.trim() : '',
    dueDate: el('etTaskDue') ? el('etTaskDue').value : '',
    estimatedHours: el('etTaskHours') ? Number(el('etTaskHours').value) : 0,
    assigneePersonId: el('etTaskAssignee') ? el('etTaskAssignee').value : ''
  };
  if (!values.title) { notifyHost('The task needs a title.', 'warning'); return; }

  if (taskId) {
    updateTaskRecord(taskId, values, function () {
      notifyHost('Task saved.', 'success');
      closeModal();
      loadAll();
    });
    return;
  }
  createTask(values);
}

funct
  el('etDrawerClose').addEventListener('click', closeMemberDrawer);
  el('etMemberDrawerOverlay').addEventListener('click', closeMemberDrawer);
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var modal = el('etModal');
    if (modal && modal.classList.contains('open')) { closeModal(); return; }
    var drawer = el('etMemberDrawer');
    if (drawer && drawer.classList.contains('open')) closeMemberDrawer();
  });ion changeTaskAssignee(taskId, personId) {
  var task = taskById(taskId);
  if (!task) return;
  updateTaskRecord(taskId, {
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    estimatedHours: task.estimatedHours,
    assigneePersonId: personId
  }, function () {
    notifyHost(personId ? 'Task assigned.' : 'Task is now unassigned.', 'success');
    loadAll();
  });
}

function openConfirmTaskModal(taskId) {
  var task = taskById(taskId);
  if (!task) return;
  openModal('Confirm task',
    '<p>Mark <strong>' + esc(task.title) + '</strong> as completed?</p>'
    + '<div class="et-note">Confirmed work counts towards the volunteer record and the event report.</div>',
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-ok" onclick="confirmTaskDone(\'' + escJs(taskId) + '\')">Confirm</button>');
}

function confirmTaskDone(taskId) { setTaskStatus(taskId, 'completed'); }

function openDeleteTaskModal(taskId) {
  var task = taskById(taskId);
  if (!task) return;
  openModal('Delete task',
    '<p>Delete <strong>' + esc(task.title) + '</strong>?</p>',
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-bad" onclick="confirmDeleteTask(\'' + escJs(taskId) + '\')">Delete</button>');
}

function confirmDeleteTask(taskId) { deleteTaskRecord(taskId); }

function openApproveHoursModal(relationId, pendingId) {
  var relation = findRelationById(relationId);
  if (!relation) return;
  openModal('Approve hours',
    '<p>Approve this hour line for <strong>' + esc(personNameById(relationDataOf(relation).personId)) + '</strong>?</p>'
    + '<div class="et-note">The line is written to the volunteer ledger once, then removed from the pending list.</div>',
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-ok" onclick="confirmApproveHours(\'' + escJs(relationId) + '\',\'' + escJs(pendingId) + '\')">Approve</button>');
}

function confirmApproveHours(relationId, pendingId) {
  var relation = findRelationById(relationId);
  if (relation) approvePendingHours(relation, pendingId);
}

function openRejectHoursModal(relationId, pendingId) {
  var relation = findRelationById(relationId);
  if (!relation) return;
  openModal('Reject hours',
    '<p>Reject this hour line?</p>',
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-bad" onclick="confirmRejectHours(\'' + escJs(relationId) + '\',\'' + escJs(pendingId) + '\')">Reject</button>');
}

function confirmRejectHours(relationId, pendingId) {
  var relation = findRelationById(relationId);
  if (relation) rejectPendingHours(relation, pendingId);
}

function openNewMessageModal() {
  if (!canManage()) return;
  var volume = openVolume();
  var body = '<div class="et-field"><label for="etMsgSubject">Subject</label>'
    + '<input class="et-input" id="etMsgSubject" maxlength="200"></div>'
    + '<div class="et-field"><label for="etMsgBody">Message</label>'
    + '<textarea class="et-textarea" id="etMsgBody" maxlength="2000"></textarea>'
    + '<div class="et-hint">Maximum 2,000 characters. ' + (volume ? 'Volume ' + toNumber(vd(volume).volume || 1) : 'A new volume') + ' holds up to ' + LIMITS.messagesPerVolume + ' messages.</div></div>';

  openModal('New announcement', body,
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-primary" onclick="submitMessage()">Send</button>');
}

function submitMessage() {
  var subject = el('etMsgSubject') ? el('etMsgSubject').value.trim() : '';
  var body = el('etMsgBody') ? el('etMsgBody').value.trim() : '';
  if (!subject) { notifyHost('Add a subject.', 'warning'); return; }
  if (!body) { notifyHost('Write the message.', 'warning'); return; }
  postMessage(subject, body, 'team');
}

function openRotateModal() {
  openModal('Start a new message volume',
    '<p>Close the current volume and open a new one?</p>'
    + '<div class="et-note">Closed volumes stay readable. Deleting one later never affects the event, its tasks or its hours.</div>',
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-primary" onclick="confirmRotate()">Start new volume</button>');
}

function confirmRotate() {
  closeModal();
  rotateVolume();
}

function openPositionModal(positionId) {
  if (!canManage()) return;
  var positions = Array.isArray(APP.eventData.positions) ? APP.eventData.positions : [];
  var position = null;
  positions.forEach(function (row) { if (row.id === positionId) position = row; });

  if (positions.length >= LIMITS.positions && !position) {
    notifyHost('This event already has ' + LIMITS.positions + ' roles.', 'warning');
    return;
  }

  var body = '<div class="et-field"><label for="etPositionName">Role name</label>'
    + '<input class="et-input" id="etPositionName" maxlength="60" value="' + esc(position ? position.name : '') + '"></div>'
    + '<div class="et-field"><label for="etPositionSlots">Places</label>'
    + '<input class="et-input" type="number" min="1" id="etPositionSlots" value="' + esc(position ? toNumber(position.slots) : 1) + '"></div>'
    + '<div class="et-field"><label for="etPositionDescription">Description</label>'
    + '<textarea class="et-textarea" id="etPositionDescription" maxlength="300">' + esc(position ? position.description : '') + '</textarea></div>';

  openModal(position ? 'Edit role' : 'New role', body,
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-primary" onclick="submitPosition(' + (positionId ? '\'' + escJs(positionId) + '\'' : 'null') + ')">Save role</button>');
}

function submitPosition(positionId) {
  var name = el('etPositionName') ? el('etPositionName').value.trim() : '';
  if (!name) { notifyHost('The role needs a name.', 'warning'); return; }

  var positions = (Array.isArray(APP.eventData.positions) ? APP.eventData.positions : []).map(function (row) {
    return { id: row.id, name: row.name, slots: row.slots, description: row.description };
  });

  if (positionId) {
    positions.forEach(function (row) {
      if (row.id !== positionId) return;
      row.name = name;
      row.slots = toNumber(el('etPositionSlots').value);
      row.description = el('etPositionDescription').value.trim();
    });
  } else {
    positions.push({
      id: 'pos_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name: name,
      slots: toNumber(el('etPositionSlots').value) || 1,
      description: el('etPositionDescription').value.trim()
    });
  }
  savePositions(positions);
}

function openDeletePositionModal(positionId) {
  var positions = Array.isArray(APP.eventData.positions) ? APP.eventData.positions : [];
  var position = null;
  positions.forEach(function (row) { if (row.id === positionId) position = row; });
  if (!position) return;

  openModal('Delete role',
    '<p>Delete the role <strong>' + esc(position.name) + '</strong>?</p>'
    + '<div class="et-note-warn et-note">Volunteers already assigned this role keep their placement record, but the role disappears from the event.</div>',
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-bad" onclick="confirmDeletePosition(\'' + escJs(positionId) + '\')">Delete</button>');
}

function confirmDeletePosition(positionId) {
  var positions = (Array.isArray(APP.eventData.positions) ? APP.eventData.positions : []).filter(function (row) {
    return row.id !== positionId;
  });
  savePositions(positions);
}

function saveEventFromForm() {
  saveEventDefinition({
    name: el('etFormName') ? el('etFormName').value.trim() : '',
    status: el('etFormStatus') ? el('etFormStatus').value : 'draft',
    capacity: el('etFormCapacity') ? el('etFormCapacity').value : 0,
    startDate: el('etFormStartDate') ? el('etFormStartDate').value : '',
    endDate: el('etFormEndDate') ? el('etFormEndDate').value : '',
    startTime: el('etFormStartTime') ? el('etFormStartTime').value : '',
    endTime: el('etFormEndTime') ? el('etFormEndTime').value : '',
    locationName: el('etFormLocation') ? el('etFormLocation').value.trim() : '',
    city: el('etFormCity') ? el('etFormCity').value.trim() : '',
    address: el('etFormAddress') ? el('etFormAddress').value.trim() : '',
    description: el('etFormDescription') ? el('etFormDescription').value.trim() : '',
    notes: el('etFormNotes') ? el('etFormNotes').value.trim() : ''
  });
}

function exportReport() {
  if (!APP.eventObject) return;
  var totals = eventHourTotals();
  var approved = approvedRelations();

  var rows = approved.map(function (relation) {
    var relationRecord = relationDataOf(relation);
    var links = taskLinksOf(relation);
    var confirmed = links.filter(function (link) { return link.status === 'confirmed'; }).length;
    return '<tr><td>' + esc(personNameById(relationRecord.personId)) + '</td>'
      + '<td>' + confirmed + ' / ' + links.length + '</td>'
      + '<td>' + toNumber(relationRecord.hoursApprovedTotal).toFixed(1) + '</td>'
      + '<td>' + toNumber(relationRecord.hoursApprovedTotal).toFixed(1) + '</td></tr>';
  }).join('');

  var html = '<div style="font-family:\'Inter\',\'Segoe UI\',system-ui,sans-serif;color:#1f2937;max-width:760px;margin:0 auto;padding:28px;">'
    + '<div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4f46e5;">' + esc(orgName()) + '</div>'
    + '<h1 style="font-size:24px;color:#0f172a;margin:8px 0 2px;">' + esc(eventName()) + '</h1>'
    + '<div style="color:#64748b;font-size:13px;margin-bottom:18px;">' + esc(eventWhenText()) + '</div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:13px;">'
    + '<tr><th style="text-align:left;background:#f8fafc;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;padding:9px 11px;">Volunteer</th>'
    + '<th style="text-align:left;background:#f8fafc;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;padding:9px 11px;">Tasks</th>'
    + '<th style="text-align:left;background:#f8fafc;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;padding:9px 11px;">Approved hours</th>'
    + '<th style="text-align:left;background:#f8fafc;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;padding:9px 11px;">Total hours</th></tr>'
    + rows
    + '</table>'
    + '<p style="margin-top:18px;font-size:13px;color:#1f2937;"><strong>Approved hours:</strong> ' + totals.approved.toFixed(1)
    + ' - <strong>Waiting:</strong> ' + totals.pending.toFixed(1)
    + ' - <strong>Volunteers:</strong> ' + approved.length + ' of ' + APP.relations.length + '</p>'
    + '</div>';

  try {
    tool.requestExportPdf({
      html: html,
      filename: 'event-report-' + String(eventName()).replace(/\s+/g, '-').toLowerCase()
    }, function (error, file) {
      if (error) { notifyHost('PDF export failed: ' + error, 'error'); return; }
      notifyHost('Report generated.', 'success');
      if (file && file.url) tool.openUrl(file.url);
    });
  } catch (error) {
    notifyHost('PDF export is not available in this host.', 'warning');
  }
}

/* ---------------- start ---------------- */
tool.declareParams([
  {
    name: 'eventId',
    label: 'Event object ID',
    type: 'text',
    default: '',
    hint: 'The event this tool instance manages. Leave empty when the tool is attached to the event object directly.',
    severity: 'optional'
  },
  {
    name: 'eventType',
    label: 'Event type ID',
    type: 'text',
    default: DEFAULT_TYPES.event,
    hint: 'CMS object type for event definitions. Authorize it in settings.allowedObjectTypes.',
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
    name: 'personType',
    label: 'Volunteer profile type ID',
    type: 'text',
    default: DEFAULT_TYPES.person,
    hint: 'CMS object type for volunteer profiles.',
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
    hint: 'Printed on the exported event report.',
    severity: 'goodToHave'
  }
]);

tool.declareOutput({
  type: 'object',
  properties: {
    eventObjectId: { type: 'string' },
    lastView: { type: 'string' }
  }
});

tool.onReady(function (value) {
  APP.savedValue = value || {};
  APP.user = tool.getUser ? tool.getUser() : null;
  APP.isManager = detectManager(APP.user);
  try { APP.readOnly = tool.isReadOnly ? !!tool.isReadOnly() : false; } catch (error) { APP.readOnly = false; }

  if (APP.savedValue && APP.savedValue.lastView) APP.view = APP.savedValue.lastView;

  var navButtons = document.querySelectorAll('.et-nav-btn');
  for (var index = 0; index < navButtons.length; index++) {
    navButtons[index].addEventListener('click', function () {
      showView(this.getAttribute('data-view'));
      persist();
    });
  }

  el('etModalClose').addEventListener('click', closeModal);
  el('etModal').addEventListener('click', function (event) {
    if (event.target === el('etModal')) closeModal();
  });

  el('etRefreshBtn').addEventListener('click', function () { loadAll(); });
  el('etAddVolunteerBtn').addEventListener('click', openAddVolunteerModal);
  el('etAddTaskBtn').addEventListener('click', function () { openTaskModal(null); });
  el('etNewMessageBtn').addEventListener('click', openNewMessageModal);
  el('etRotateBtn').addEventListener('click', openRotateModal);
  el('etAddPositionBtn').addEventListener('click', function () { openPositionModal(null); });
  el('etExportReportBtn').addEventListener('click', exportReport);

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

  loadAll(function () { showView(APP.view); });

  try { tool.reportValid(true, ''); } catch (error) { /* optional */ }
});

function persist() {
  try {
    tool.setValue({
      eventObjectId: APP.eventObject ? APP.eventObject.id : '',
      lastView: APP.view
    });
  } catch (error) { /* optional */ }
}
