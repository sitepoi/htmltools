/* EventVolunteerManager
   One tool instance = ONE event object (host object).
   The event is a CMS object created outside this tool. This tool manages everything that happens around it:
   the volunteers linked to it, their roles, tasks, hours, messages, the report and the event information itself.

   Object model (5 CMS object types, no array-contains queries):
     Event          vm-events-uniconbaseapps            (this tool's host object)
     Membership     vm-event-memberships-uniconbaseapps  id = personId + '__' + eventId
     Person         volunteer-registry-uniconbaseapps
     Event Tasks    vm-event-tasks-uniconbaseapps         id = eventId + '__tasks'
     Event Messages vm-event-messages-uniconbaseapps      id = eventId + '__messages' (+ '#2', '#3' ...)
*/

var DEFAULT_TYPES = {
  event: 'vm-events-uniconbaseapps',
  relation: 'vm-event-memberships-uniconbaseapps',
  person: 'volunteer-registry-uniconbaseapps',
  tasks: 'vm-event-tasks-uniconbaseapps',
  messages: 'vm-event-messages-uniconbaseapps'
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

var OPPORTUNITY_TYPES = [
  { id: 'event', label: 'Fixed event' },
  { id: 'task', label: 'Task based' },
  { id: 'recurring', label: 'Recurring' },
  { id: 'self-paced', label: 'Self paced' }
];

var LOCATION_MODES = [
  { id: 'onsite', label: 'On site' },
  { id: 'remote', label: 'Remote' },
  { id: 'hybrid', label: 'Hybrid' }
];

/* Date.getDay() numbering: 0 = Sunday, 1 = Monday ... 6 = Saturday. */
var WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function optionListHtml(options, selectedValue) {
  return options.map(function (option) {
    return '<option value="' + esc(option.id) + '"'
      + (option.id === selectedValue ? ' selected' : '') + '>' + esc(option.label) + '</option>';
  }).join('');
}

function optionLabelOf(options, value) {
  for (var index = 0; index < options.length; index++) {
    if (options[index].id === value) return options[index].label;
  }
  return value ? String(value) : '-';
}

function weekdayChoicesHtml(selectedWeekdays, fieldName) {
  var chosenDays = Array.isArray(selectedWeekdays) ? selectedWeekdays.map(Number) : [];
  var inputName = fieldName || 'etWeekday';
  return WEEKDAY_LABELS.map(function (label, index) {
    var dayNumber = (index + 1) % 7;
    return '<label class="et-check et-weekday"><input type="checkbox" name="' + inputName + '" value="' + dayNumber + '"'
      + (chosenDays.indexOf(dayNumber) !== -1 ? ' checked' : '') + '><span>' + label + '</span></label>';
  }).join('');
}

function selectedWeekdaysFromForm(fieldName) {
  var boxes = document.querySelectorAll('input[name="' + (fieldName || 'etWeekday') + '"]');
  var chosenDays = [];
  for (var index = 0; index < boxes.length; index++) {
    if (boxes[index].checked) chosenDays.push(Number(boxes[index].value));
  }
  return chosenDays;
}

var APP = {
  user: null,
  isManager: false,
  readOnly: false,
  view: 'dashboard',
  formTab: 'basics',
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
    requested: 'Requested', approved: 'Approved', declined: 'Declined', revoked: 'Revoked', removed: 'Removed',
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

function approvePendingHours(relation, pendingId, options) {
  if (!canManage()) return;
  var settings = options || {};
  var relationRecord = relationDataOf(relation);
  var pending = Array.isArray(relationRecord.pendingHours) ? relationRecord.pendingHours : [];
  var line = null;
  for (var index = 0; index < pending.length; index++) {
    if (pending[index].id === pendingId) { line = pending[index]; break; }
  }
  if (!line) {
    if (settings.done) settings.done('That hour line is no longer waiting.');
    return;
  }

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
    if (personError) {
      if (!settings.silent) notifyHost('Could not write the hours ledger: ' + personError, 'error');
      if (settings.done) settings.done(personError);
      return;
    }

    var data = simpleCopy(relationRecord);
    data.pendingHours = (data.pendingHours || []).filter(function (entry) { return entry.id !== pendingId; });
    data.hoursApprovedTotal = toNumber(data.hoursApprovedTotal) + toNumber(line.hours);
    data.lastApprovedAt = isoNow();
    var approvedIds = Array.isArray(data.approvedLedgerIds) ? data.approvedLedgerIds.slice() : [];
    if (approvedIds.indexOf(ledgerId) === -1) approvedIds.push(ledgerId);
    data.approvedLedgerIds = approvedIds.slice(-60);
    data.updatedAt = isoNow();

    updateObject(typeRelation(), relation.id, data, personNameById(relationRecord.personId), function (relationError) {
      if (!settings.silent) {
        if (relationError) notifyHost('Hours approved, but the membership line could not be cleared: ' + relationError, 'warning');
        else notifyHost('Hours approved.', 'success');
        closeModal();
        loadAll();
      }
      if (settings.done) settings.done(relationError || null);
    });
  });
}

/* Batch approval reuses the single-line path, re-reading each placement first so
   several lines on one volunteer cannot overwrite each other. */
function openApproveAllModal() {
  if (!canManage()) return;
  var rows = pendingRows();
  if (rows.length === 0) { notifyHost('No hour line is waiting for approval.', 'info'); return; }

  openModal('Approve every waiting hour?',
    '<p><strong>' + rows.length + '</strong> line' + (rows.length === 1 ? '' : 's') + ' for <strong>' + esc(eventName()) + '</strong> will be written to the volunteer records.</p>'
    + '<div class="et-note">Each line keeps its own ledger id, so approving twice never duplicates an hour.</div>',
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-primary" onclick="closeModal();runApproveAllPendingHours()">Approve all</button>');
}

function runApproveAllPendingHours() {
  if (!canManage()) return;
  var jobs = pendingRows().map(function (row) {
    return { relationId: row.relation.id, pendingId: row.line.id };
  });
  if (jobs.length === 0) return;

  var approvedCount = 0;
  var failedCount = 0;

  function approveNext() {
    if (jobs.length === 0) {
      notifyHost(approvedCount + ' hour line' + (approvedCount === 1 ? '' : 's') + ' approved'
        + (failedCount ? ', ' + failedCount + ' could not be approved' : '') + '.',
        failedCount ? 'warning' : 'success');
      loadAll();
      return;
    }
    var job = jobs.shift();
    getById(typeRelation(), job.relationId, function (error, freshRelation) {
      if (error || !freshRelation) { failedCount++; approveNext(); return; }
      approvePendingHours(freshRelation, job.pendingId, {
        silent: true,
        done: function (writeError) {
          if (writeError) failedCount++; else approvedCount++;
          approveNext();
        }
      });
    });
  }

  approveNext();
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
/* ---------------- contacts and positions ---------------- */
function newRecordId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

/* One event can have several people a volunteer may call. The first one is the
   main contact, and its name, phone and email stay on the event record so the
   volunteer catalog keeps reading a single set of fields. */
function contactsOf(data) {
  var storedRows = Array.isArray(data.contacts) ? data.contacts.filter(Boolean) : [];
  if (storedRows.length) return storedRows;
  if (data.contactName || data.contactPhone || data.contactEmail) {
    return [{
      id: 'contact_primary',
      name: data.contactName || '',
      label: 'Main contact',
      phone: data.contactPhone || '',
      email: data.contactEmail || ''
    }];
  }
  return [];
}

function applyContactFields(data) {
  var storedRows = contactsOf(data).map(function (contactRow) {
    return {
      id: contactRow.id || newRecordId('contact'),
      name: String(contactRow.name || '').slice(0, 80),
      label: String(contactRow.label || '').slice(0, 40),
      phone: String(contactRow.phone || '').slice(0, 40),
      email: String(contactRow.email || '').slice(0, 160)
    };
  });
  var primaryContact = storedRows[0] || {};
  data.contacts = storedRows;
  data.contactName = primaryContact.name || '';
  data.contactPhone = primaryContact.phone || '';
  data.contactEmail = primaryContact.email || '';
  return data;
}

/* A position is the job definition a volunteer applies for. It owns the offer
   details: what kind of work it is, where, when, and by when. */
function normalizePosition(sourceRow) {
  var row = sourceRow || {};
  var offerType = ['event', 'task', 'recurring', 'self-paced'].indexOf(String(row.opportunityType)) !== -1
    ? String(row.opportunityType) : 'event';
  var whereMode = ['onsite', 'remote', 'hybrid'].indexOf(String(row.locationMode)) !== -1
    ? String(row.locationMode) : 'onsite';
  var recurrence = row.recurrence || {};
  var chosenDays = Array.isArray(recurrence.weekdays) ? recurrence.weekdays.map(Number).filter(function (dayNumber) {
    return dayNumber >= 0 && dayNumber <= 6;
  }).slice(0, 7) : [];
  return {
    id: row.id || newRecordId('pos'),
    name: String(row.name || '').slice(0, 60),
    slots: toNumber(row.slots) || 1,
    description: String(row.description || '').slice(0, 300),
    requirements: String(row.requirements || '').slice(0, 300),
    skills: String(row.skills || '').slice(0, 120),
    timeCommitment: String(row.timeCommitment || '').slice(0, 120),
    opportunityType: offerType,
    locationMode: whereMode,
    deadline: String(row.deadline || '').slice(0, 10),
    applicationDeadline: String(row.applicationDeadline || '').slice(0, 10),
    recurrence: {
      weekdays: chosenDays,
      timeFrom: String(recurrence.timeFrom || '').slice(0, 5),
      timeTo: String(recurrence.timeTo || '').slice(0, 5)
    }
  };
}

/* The volunteer catalog reads the offer from the event record, so the event
   carries the summary of its positions: one shared type, or "mixed". */
function applyDerivedOfferFields(data) {
  var positionRows = (Array.isArray(data.positions) ? data.positions : []).map(normalizePosition);
  data.positions = positionRows;
  if (positionRows.length === 0) return data;

  var typeKeys = [], whereKeys = [], commitmentTexts = [];
  positionRows.forEach(function (row) {
    if (typeKeys.indexOf(row.opportunityType) === -1) typeKeys.push(row.opportunityType);
    if (whereKeys.indexOf(row.locationMode) === -1) whereKeys.push(row.locationMode);
    if (row.timeCommitment && commitmentTexts.indexOf(row.timeCommitment) === -1) commitmentTexts.push(row.timeCommitment);
  });

  data.opportunityType = typeKeys.length === 1 ? typeKeys[0] : 'mixed';
  data.locationMode = whereKeys.length === 1 ? whereKeys[0] : 'hybrid';
  data.commitment = commitmentTexts.join(' / ').slice(0, 120);

  var deadlineDates = positionRows.map(function (row) { return row.deadline; }).filter(Boolean).sort();
  data.deadline = deadlineDates.length ? deadlineDates[0] : '';

  var closingDates = positionRows.map(function (row) { return row.applicationDeadline; }).filter(Boolean).sort();
  data.applicationDeadline = closingDates.length ? closingDates[0] : '';

  var scheduledPosition = null;
  positionRows.forEach(function (row) {
    if (!scheduledPosition && row.opportunityType === 'recurring' && row.recurrence.weekdays.length) scheduledPosition = row;
  });
  positionRows.forEach(function (row) {
    if (!scheduledPosition && row.recurrence.weekdays.length) scheduledPosition = row;
  });
  data.recurrence = scheduledPosition
    ? scheduledPosition.recurrence
    : { weekdays: [], timeFrom: '', timeTo: '' };
  return data;
}

/* One mapping used by every write: the form values over the stored event data. */
function eventDataFromForm(values, baseData) {
  var data = simpleCopy(baseData || {});
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
  if (!Array.isArray(data.positions)) data.positions = [];

  /* The offer is not chosen on the event: it is the summary of its positions. */
  applyContactFields(data);
  applyDerivedOfferFields(data);
  data.updatedAt = isoNow();
  return data;
}

/* Returns an empty string when the data can be written, or the reason it cannot. */
function validateEventData(data) {
  if (!data.name) return 'the event needs a name';
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    return 'the end date cannot be before the start date';
  }
  return '';
}

/* The CMS owns the event record, so the tool carries no Save button: every
   editing gesture writes the record that is already attached to the tool. */
function saveEventDefinition(values, options) {
  if (!canManage()) return;
  var isSilentSave = !!(options && options.silent);
  var data = eventDataFromForm(values, APP.eventData);
  if (!data.name) data.name = APP.eventData.name || (APP.eventObject ? APP.eventObject.name : '');

  var validationMessage = validateEventData(data);
  if (validationMessage) {
    if (isSilentSave) el('etEventUpdated').textContent = 'Not saved - ' + validationMessage;
    else notifyHost('Could not save: ' + validationMessage + '.', 'warning');
    return;
  }

  if (!APP.eventObject) {
    /* The CMS attaches the record; until it does, the entered details live in the tool state. */
    APP.eventData = data;
    el('etEventUpdated').textContent = 'Updated ' + fmtDate(data.updatedAt);
    return;
  }

  updateObject(typeEvent(), APP.eventObject.id, data, data.name, function (error) {
    if (error) {
      el('etEventUpdated').textContent = 'Not saved - ' + error;
      notifyHost('Could not save the event: ' + error, 'error');
      return;
    }
    APP.eventData = data;
    APP.eventObject.name = data.name;
    if (APP.eventObject.productData && APP.eventObject.productData.data_categoriesBased) {
      APP.eventObject.productData.data_categoriesBased = data;
    }
    el('etEventName').textContent = eventName();
    el('etMark').textContent = (eventName() || 'E').charAt(0).toUpperCase();
    el('etEventUpdated').textContent = 'Saved ' + fmtDate(data.updatedAt);
    if (!isSilentSave) notifyHost('Event saved.', 'success');
    renderDashboard();
  });
}

function savePositions(nextPositions) {
  if (!canManage()) return;
  /* Keep the last keystrokes of the event form before the positions write reloads the tool. */
  flushEventFormEdits();
  var data = simpleCopy(APP.eventData);
  data.positions = nextPositions.slice(0, LIMITS.positions).map(normalizePosition);
  applyDerivedOfferFields(data);
  data.updatedAt = isoNow();

  if (!APP.eventObject) {
    APP.eventData = data;
    notifyHost('Positions saved.', 'success');
    closeModal();
    renderAll();
    return;
  }

  updateObject(typeEvent(), APP.eventObject.id, data, data.name || eventName(), function (error) {
    if (error) { notifyHost('Could not save the positions: ' + error, 'error'); return; }
    notifyHost('Positions saved.', 'success');
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
  var positionRows = (Array.isArray(APP.eventData.positions) ? APP.eventData.positions : []).map(normalizePosition);
  var filledCounts = filledPerPosition();
  var openPlaces = positionRows.filter(function (position) {
    return filledCounts[position.id] === undefined || filledCounts[position.id] < toNumber(position.slots);
  }).length;

  el('etBadgeTeam').textContent = String(APP.relations.length);
  el('etBadgeTeam').className = 'et-nav-badge' + (requestedRelations().length ? ' hot' : '');
  el('etBadgePositions').textContent = String(positionRows.length);
  el('etBadgePositions').className = 'et-nav-badge' + (openPlaces ? ' hot' : '');
  el('etBadgeTasks').textContent = String(openTasks);
  el('etBadgeHours').textContent = String(pendingRows().length);
  el('etBadgeHours').className = 'et-nav-badge' + (pendingRows().length ? ' hot' : '');
  el('etBadgeMessages').textContent = String(allMessages().length);

  el('etNavFoot').innerHTML = APP.eventObject
    ? 'Approved volunteers: <strong>' + approvedRelations().length + '</strong><br>Waiting: <strong>' + pendingCount + '</strong>'
    : '';

  renderDashboard();
  renderTeam();
  renderTasks();
  renderHours();
  renderMessages();
  renderReport();
  renderEventForm();
  renderContacts();
  renderPositions();

  el('etAddVolunteerBtn').disabled = !canManage();
  el('etAddPositionBtn').disabled = !canManage();
  el('etAddTaskBtn').disabled = !canManage();
  el('etNewMessageBtn').disabled = !canManage();
  el('etRotateBtn').disabled = !canManage();
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
      + '<th>Volunteer</th><th>Network</th><th>Positions asked for</th><th>Applied</th><th></th>'
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
        + '<td>' + esc(task.dueDate ? fmtDate(task.dueDate) : '-') + '</td>'
        + '<td>' + badge(task.status) + '</td></tr>';
    });
    pending.forEach(function (row) {
      openWorkHtml += '<tr><td><div class="et-cell-main">Hours line</div>'
        + '<div class="et-cell-sub">' + esc(row.line.taskTitle || row.line.note || 'Volunteer hours') + '</div></td>'
        + '<td>' + esc(personNameById(row.personId)) + '</td>'
        + '<td>' + esc(fmtDate(row.line.date)) + '</td>'
        + '<td>' + badge('pending') + '</td></tr>';
    });
    openWorkHtml += '</tbody></table></div>';
  }
  el('etOpenWorkCard').innerHTML = '<div class="et-card-head"><h2>Open work</h2>'
    + '<span class="et-count">' + (openTasks.length + pending.length) + '</span></div>'
    + '<div class="et-card-body flush">' + openWorkHtml + '</div>';


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

/* Shared empty state: the event form is the way out of it. */
function noEventStateHtml(message) {
  return '<div class="et-empty"><strong>No event loaded</strong>' + esc(message || '')
    + (canManage()
      ? '<div style="margin-top:10px;"><button type="button" class="et-btn et-btn-primary" onclick="showView(\'event\')">Open Event details</button></div>'
      : '')
    + '</div>';
}

function renderTeam() {
  var rows = APP.relations.slice().sort(function (relationA, relationB) {
    var statusA = relationDataOf(relationA).status === 'requested' ? 0 : 1;
    var statusB = relationDataOf(relationB).status === 'requested' ? 0 : 1;
    if (statusA !== statusB) return statusA - statusB;
    return personNameById(relationDataOf(relationA).personId).localeCompare(personNameById(relationDataOf(relationB).personId));
  });

  if (!APP.eventObject) {
    el('etTeamTable').innerHTML = noEventStateHtml('Fill the event details first, then add volunteers.');
    return;
  }
  if (rows.length === 0) {
    el('etTeamTable').innerHTML = '<div class="et-empty"><strong>Nobody linked yet</strong>'
      + 'Use Add volunteers to pick people from the volunteer network.</div>';
    return;
  }

  var html = '<div class="et-table-wrap"><table class="et-table"><thead><tr>'
    + '<th>Volunteer</th><th>Network</th><th>Event status</th><th>Positions</th>'
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

  if (el('etApproveAllBtn')) {
    el('etApproveAllBtn').disabled = !canManage() || pending.length === 0;
    el('etApproveAllBtn').textContent = pending.length > 0 ? 'Approve all (' + pending.length + ')' : 'Approve all';
  }

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
    + '<th>Volunteer</th><th>Positions</th><th class="et-num">Tasks</th><th class="et-num">Approved h</th><th class="et-num">Pending h</th>'
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

var EVENT_FORM_TABS = [
  { key: 'basics', label: 'Basics' },
  { key: 'when', label: 'When and where' },
  { key: 'contact', label: 'Contact' }
];

function activeFormTab() {
  /* Old saved tabs: roles became positions, and positions is now a screen of its own. */
  var requestedTab = APP.formTab;
  if (requestedTab === 'roles' || requestedTab === 'positions' || requestedTab === 'offer') requestedTab = 'basics';
  for (var tabIndex = 0; tabIndex < EVENT_FORM_TABS.length; tabIndex++) {
    if (EVENT_FORM_TABS[tabIndex].key === requestedTab) return requestedTab;
  }
  return 'basics';
}

function switchFormTab(tabKey) {
  APP.formTab = tabKey;
  var tabButtons = document.querySelectorAll('#etEventForm .et-ftab');
  for (var buttonIndex = 0; buttonIndex < tabButtons.length; buttonIndex++) {
    var isActiveButton = tabButtons[buttonIndex].getAttribute('data-ftab') === tabKey;
    tabButtons[buttonIndex].classList.toggle('active', isActiveButton);
    tabButtons[buttonIndex].setAttribute('aria-selected', isActiveButton ? 'true' : 'false');
  }
  var tabPanels = document.querySelectorAll('#etEventForm .et-fpanel');
  for (var panelIndex = 0; panelIndex < tabPanels.length; panelIndex++) {
    tabPanels[panelIndex].classList.toggle('active', tabPanels[panelIndex].getAttribute('data-fpanel') === tabKey);
  }
  persist();
  try { tool.resize(); } catch (error) { /* optional */ }
}

function formPanelHead(hintHtml, actionHtml) {
  return '<div class="et-fpanel-head"><span class="et-hint">' + hintHtml + '</span>'
    + (actionHtml || '') + '</div>';
}

function renderEventForm() {
  var data = APP.eventData || {};
  var disabled = canManage() ? '' : ' disabled';
  var activeTabKey = activeFormTab();

  el('etEventUpdated').textContent = (APP.eventObject && data.updatedAt)
    ? 'Updated ' + fmtDate(data.updatedAt) : '';

  var panels = {};

  panels.basics = '<div class="et-field"><label for="etFormName">Event name</label>'
    + '<input class="et-input" id="etFormName" placeholder="Name of the event" value="' + esc(data.name || '') + '"' + disabled + '></div>'
    + '<div class="et-field-row">'
    + '<div class="et-field"><label for="etFormStatus">Status</label>'
    + '<select class="et-select" id="etFormStatus"' + disabled + '>'
    + ['draft', 'open', 'closed', 'cancelled'].map(function (status) {
        return '<option value="' + status + '"' + ((data.status || 'draft') === status ? ' selected' : '') + '>'
          + esc(statusLabel(status)) + '</option>';
      }).join('')
    + '</select></div>'
    + '<div class="et-field"><label for="etFormCapacity">Capacity</label>'
    + '<input class="et-input" type="number" min="0" step="1" id="etFormCapacity" value="' + toNumber(data.capacity) + '"' + disabled + '></div>'
    + '</div>'
    + '<div class="et-field"><label for="etFormDescription">Description</label>'
    + '<textarea class="et-textarea" id="etFormDescription"' + disabled + '>' + esc(data.description || '') + '</textarea>'
    + '<div class="et-hint">Shown to volunteers in the catalog.</div></div>'
    + '<div class="et-field"><label for="etFormNotes">Internal notes</label>'
    + '<textarea class="et-textarea" id="etFormNotes"' + disabled + '>' + esc(data.notes || '') + '</textarea>'
    + '<div class="et-hint">Only the event team sees this.</div></div>';

  panels.when = '<div class="et-field-row">'
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
    + '<input class="et-input" id="etFormAddress" value="' + esc(data.address || '') + '"' + disabled + '></div>';

  panels.contact = formPanelHead('Who a volunteer calls when they have a question. The first person is the main contact shown in the volunteer catalog.',
    canManage() ? '<button type="button" class="et-btn et-btn-primary" onclick="openContactModal(null)">Add contact</button>' : '')
    + '<div id="etContactList"></div>';

  var html = '<div class="et-ftabs" role="tablist">' + EVENT_FORM_TABS.map(function (tab) {
    var isActiveTab = tab.key === activeTabKey;
    return '<button type="button" class="et-ftab' + (isActiveTab ? ' active' : '') + '" role="tab" data-ftab="' + tab.key + '"'
      + ' aria-selected="' + (isActiveTab ? 'true' : 'false') + '"'
      + ' onclick="switchFormTab(\'' + tab.key + '\')">' + esc(tab.label) + '</button>';
  }).join('') + '</div>';

  EVENT_FORM_TABS.forEach(function (tab) {
    html += '<div class="et-fpanel' + (tab.key === activeTabKey ? ' active' : '') + '" data-fpanel="' + tab.key + '" role="tabpanel">'
      + panels[tab.key] + '</div>';
  });

  if (!canManage()) html += '<div class="et-note">This event is read only for you.</div>';

  el('etEventForm').innerHTML = html;
  bindEventFormAutoSave();
}

/* ---------------- member drawer ---------------- */
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
  changeRelationStatus('declined', 'Request declined. You can approve this person later from the volunteer network.');
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
  var statusButtons = '';

  body += '<div class="et-dsection"><h3>Placement</h3>';
  if (canManage()) {
    if (status === 'approved') {
      statusButtons += '<button type="button" class="et-btn et-btn-tiny et-btn-bad" onclick="armDrawerConfirm(\'revoke\')">Revoke approval</button>';
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
  body += '<div class="et-dsection"><h3>Positions</h3>';
  if (positions.length === 0) {
    body += '<div class="et-hint">No position set for this placement.</div>';
  } else {
    body += '<div class="et-role-chips">' + positions.map(function (position) {
      return '<span class="et-role-chip">' + esc(position.name) + '</span>';
    }).join('') + '</div>';
  }
  if (canManage()) {
    body += '<div class="et-actions" style="margin-top:10px;">'
      + '<button type="button" class="et-btn et-btn-tiny et-btn-outline" onclick="drawerOpenRoles()">Change positions</button>'
      + '</div>';
    if (positions.length === 0 && (!Array.isArray(APP.eventData.positions) || APP.eventData.positions.length === 0)) {
      body += '<div class="et-dnote">This event has no positions yet. Add positions on the Event details screen first.</div>';
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

/* ---------------- contacts ---------------- */
function renderContacts() {
  var contactListNode = el('etContactList');
  if (!contactListNode) return;
  var contactRows = contactsOf(APP.eventData);
  if (contactRows.length === 0) {
    contactListNode.innerHTML = '<div class="et-empty"><strong>No contact yet</strong>'
      + 'Add the person a volunteer should call about this event.</div>';
    return;
  }

  contactListNode.innerHTML = '<div class="et-contact-list">' + contactRows.map(function (contactRow, contactIndex) {
    var contactLines = [];
    if (contactRow.phone) contactLines.push(esc(contactRow.phone));
    if (contactRow.email) contactLines.push(esc(contactRow.email));
    return '<div class="et-contact-card">'
      + '<div class="et-contact-text">'
      + '<div class="et-cell-main">' + esc(contactRow.name || 'Unnamed contact')
      + (contactIndex === 0 ? ' <span class="et-badge">Main</span>' : '') + '</div>'
      + (contactRow.label ? '<div class="et-cell-sub">' + esc(contactRow.label) + '</div>' : '')
      + '<div class="et-cell-sub">' + (contactLines.length ? contactLines.join(' &middot; ') : 'No phone or email') + '</div>'
      + '</div>'
      + (canManage()
        ? '<div class="et-actions">'
          + '<button type="button" class="et-btn et-btn-tiny et-btn-outline" onclick="openContactModal(\'' + escJs(contactRow.id) + '\')">Edit</button>'
          + '<button type="button" class="et-btn et-btn-tiny et-btn-bad" onclick="openDeleteContactModal(\'' + escJs(contactRow.id) + '\')">Remove</button>'
          + '</div>'
        : '')
      + '</div>';
  }).join('') + '</div>';
}

function openContactModal(contactId) {
  if (!canManage()) return;
  var contactRow = null;
  contactsOf(APP.eventData).forEach(function (row) { if (row.id === contactId) contactRow = row; });

  var body = '<div class="et-field"><label for="etContactName">Name</label>'
    + '<input class="et-input" id="etContactName" maxlength="80" value="' + esc(contactRow ? contactRow.name : '') + '"></div>'
    + '<div class="et-field"><label for="etContactLabel">What they do</label>'
    + '<input class="et-input" id="etContactLabel" maxlength="40" placeholder="Event lead, site coordinator, first aid" value="'
    + esc(contactRow ? contactRow.label : '') + '"></div>'
    + '<div class="et-field-row">'
    + '<div class="et-field"><label for="etContactPhone">Phone</label>'
    + '<input class="et-input" id="etContactPhone" maxlength="40" value="' + esc(contactRow ? contactRow.phone : '') + '"></div>'
    + '<div class="et-field"><label for="etContactEmail">Email</label>'
    + '<input class="et-input" type="email" id="etContactEmail" maxlength="160" value="' + esc(contactRow ? contactRow.email : '') + '"></div>'
    + '</div>'
    + '<div class="et-hint">The first contact in the list is the main one shown to volunteers.</div>';

  openModal(contactRow ? 'Edit contact' : 'Add contact', body,
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-primary" onclick="submitContact('
    + (contactId ? '\'' + escJs(contactId) + '\'' : 'null') + ')">Save contact</button>');
}

function submitContact(contactId) {
  try {
    var contactName = el('etContactName') ? el('etContactName').value.trim() : '';
    if (!contactName) { notifyHost('The contact needs a name.', 'warning'); return; }

    var savedContact = {
      id: contactId || newRecordId('contact'),
      name: contactName.slice(0, 80),
      label: el('etContactLabel') ? el('etContactLabel').value.trim().slice(0, 40) : '',
      phone: el('etContactPhone') ? el('etContactPhone').value.trim().slice(0, 40) : '',
      email: el('etContactEmail') ? el('etContactEmail').value.trim().slice(0, 160) : ''
    };

    var nextContacts = contactsOf(APP.eventData).map(function (row) {
      return { id: row.id || newRecordId('contact'), name: row.name || '', label: row.label || '', phone: row.phone || '', email: row.email || '' };
    });

    if (contactId) {
      var wasReplaced = false;
      nextContacts = nextContacts.map(function (row) {
        if (row.id !== contactId) return row;
        wasReplaced = true;
        return savedContact;
      });
      if (!wasReplaced) nextContacts.push(savedContact);
    } else {
      nextContacts.push(savedContact);
    }
    saveContacts(nextContacts);
  } catch (error) {
    notifyHost('Could not save the contact: ' + (error && error.message ? error.message : error), 'error');
  }
}

function saveContacts(nextContacts) {
  if (!canManage()) return;
  flushEventFormEdits();
  var data = simpleCopy(APP.eventData);
  data.contacts = nextContacts;
  applyContactFields(data);
  data.updatedAt = isoNow();

  if (!APP.eventObject) {
    APP.eventData = data;
    notifyHost('Contacts saved.', 'success');
    closeModal();
    renderAll();
    return;
  }

  updateObject(typeEvent(), APP.eventObject.id, data, data.name || eventName(), function (error) {
    if (error) { notifyHost('Could not save the contacts: ' + error, 'error'); return; }
    notifyHost('Contacts saved.', 'success');
    closeModal();
    loadAll();
  });
}

function openDeleteContactModal(contactId) {
  var contactRow = null;
  contactsOf(APP.eventData).forEach(function (row) { if (row.id === contactId) contactRow = row; });
  if (!contactRow) return;

  openModal('Remove contact',
    '<p>Remove <strong>' + esc(contactRow.name || 'this contact') + '</strong> from the event?</p>'
    + '<div class="et-note">The rest of the contact list stays as it is.</div>',
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-bad" onclick="confirmRemoveContact(\'' + escJs(contactId) + '\')">Remove</button>');
}

function confirmRemoveContact(contactId) {
  var remainingContacts = contactsOf(APP.eventData).filter(function (row) { return row.id !== contactId; });
  saveContacts(remainingContacts);
}

/* ---------------- positions ---------------- */

/* Approved placements per position, so the position table can warn before the event day. */
function filledPerPosition() {
  var counts = {};
  APP.relations.forEach(function (relation) {
    var relationRecord = relationDataOf(relation);
    if (relationRecord.status !== 'approved') return;
    (Array.isArray(relationRecord.positions) ? relationRecord.positions : []).forEach(function (roleRow) {
      if (roleRow.status !== 'approved') return;
      counts[roleRow.positionId] = (counts[roleRow.positionId] || 0) + 1;
    });
  });
  return counts;
}

function recurrenceSummary(recurrence) {
  var definedRecurrence = recurrence || {};
  var chosenDays = Array.isArray(definedRecurrence.weekdays) ? definedRecurrence.weekdays : [];
  /* Weekday numbers follow Date.getDay(): 0 is Sunday, 1 is Monday. */
  var dayText = chosenDays.map(function (dayNumber) {
    return WEEKDAY_LABELS[dayNumber === 0 ? 6 : dayNumber - 1] || '';
  }).filter(Boolean).join(', ');
  var timeText = [definedRecurrence.timeFrom, definedRecurrence.timeTo].filter(Boolean).join(' to ');
  if (!dayText) return timeText;
  return dayText + (timeText ? ' ' + timeText : '');
}

function renderPositions() {
  var positionListNode = el('etPositionList');
  if (!positionListNode) return;

  var positions = (Array.isArray(APP.eventData.positions) ? APP.eventData.positions : []).map(normalizePosition);
  if (positions.length === 0) {
    positionListNode.innerHTML = '<div class="et-empty"><strong>No positions yet</strong>'
      + 'Add the positions volunteers can apply for.</div>';
    return;
  }

  var filledCounts = filledPerPosition();
  var html = '<div class="et-table-wrap"><table class="et-table"><thead><tr>'
    + '<th>Position</th><th>Offer</th><th class="et-num">Places</th><th class="et-num">Filled</th>'
    + '<th>Applications close</th><th></th></tr></thead><tbody>';
  positions.forEach(function (position) {
    var slots = toNumber(position.slots);
    var filled = filledCounts[position.id] || 0;
    var isOverfilled = slots > 0 && filled > slots;
    var scheduleText = position.recurrence.weekdays.length ? recurrenceSummary(position.recurrence) : '';
    html += '<tr>'
      + '<td><div class="et-cell-main">' + esc(position.name) + '</div>';
    if (position.description) html += '<div class="et-cell-sub">' + esc(position.description) + '</div>';
    if (position.skills) html += '<div class="et-cell-sub">Skills: ' + esc(position.skills) + '</div>';
    if (position.requirements) html += '<div class="et-cell-sub">Needs: ' + esc(position.requirements) + '</div>';
    html += '</td>'
      + '<td>' + esc(optionLabelOf(OPPORTUNITY_TYPES, position.opportunityType))
      + '<div class="et-cell-sub">' + esc(optionLabelOf(LOCATION_MODES, position.locationMode))
      + (position.timeCommitment ? ' &middot; ' + esc(position.timeCommitment) : '') + '</div>'
      + (scheduleText ? '<div class="et-cell-sub">' + esc(scheduleText) + '</div>' : '')
      + '</td>'
      + '<td class="et-num">' + slots + '</td>'
      + '<td class="et-num">' + filled + (isOverfilled ? ' <span class="et-warn-chip">over</span>' : '') + '</td>'
      + '<td>' + esc(position.applicationDeadline ? fmtDate(position.applicationDeadline) : '-') + '</td>'
      + '<td><div class="et-actions">'
      + (canManage() ? '<button type="button" class="et-btn et-btn-tiny et-btn-outline" onclick="openPositionModal(\'' + escJs(position.id) + '\')">Edit</button>'
        + '<button type="button" class="et-btn et-btn-tiny et-btn-bad" onclick="openDeletePositionModal(\'' + escJs(position.id) + '\')">Delete</button>' : '')
      + '</div></td></tr>';
  });
  html += '</tbody></table></div>';
  if (canManage()) {
    var overfilledRoles = positions.filter(function (position) {
      return toNumber(position.slots) > 0 && (filledCounts[position.id] || 0) > toNumber(position.slots);
    });
    if (overfilledRoles.length > 0) {
      html += '<div class="et-note et-note-warn">' + overfilledRoles.length
        + (overfilledRoles.length === 1 ? ' position has' : ' positions have')
        + ' more accepted volunteers than places. Raise the places or move someone to another position.</div>';
    }
  }
  positionListNode.innerHTML = html;
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
    openModal('Positions', '<div class="et-note">This event has no positions yet. Add positions on the Event details screen first.</div>');
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
    + '<span class="et-hint" style="flex:1 1 auto; margin:0;">Tick the positiontions <strong>' + esc(personNameById(relationDataOf(relation).personId)) + '</strong> works in for this event.</span>'
    + '<span class="et-picker-count" id="etRoleCount">0 selected</span>'
    + '</div>'
    + '<div class="et-picker-list" id="etRoleList">' + items + '</div>'
    + '<div class="et-hint">Positions are saved on this placement only and marked as approved.</div>'
    + '</div>';

  openModal('Positions', body,
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-primary" onclick="saveRolesFor(\'' + escJs(relationId) + '\')">Save positions</button>');

  bindChoicePicker('etRoleList', 'etRoleCount');
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

  if (candidates.length > 0) bindChoicePicker('etPersonList', 'etPersonCount');
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

function changeTaskAssignee(taskId, personId) {
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

/* A position is the job definition. The offer details (type, where, when) belong
   to the position, not to the event as a whole. */
function openPositionModal(positionId) {
  if (!canManage()) return;

  var positions = (Array.isArray(APP.eventData.positions) ? APP.eventData.positions : []).map(normalizePosition);
  var positionRow = null;
  positions.forEach(function (row) { if (row.id === positionId) positionRow = row; });

  if (positions.length >= LIMITS.positions && !positionRow) {
    notifyHost('This event already has ' + LIMITS.positions + ' positions.', 'warning');
    return;
  }

  var isNewPosition = !positionRow;
  var position = positionRow || normalizePosition({});
  var positionRecurrence = position.recurrence || { weekdays: [], timeFrom: '', timeTo: '' };
  var body = '<h3 class="et-form-section" style="margin-top:0;padding-top:0;border-top:none;">What the volunteer does</h3>'
    + '<div class="et-field"><label for="etPositionName">Position name</label>'
    + '<input class="et-input" id="etPositionName" maxlength="60" placeholder="Sorting crew, Greeter, Driver" value="' + esc(position.name) + '"></div>'
    + '<div class="et-field-row">'
    + '<div class="et-field"><label for="etPositionSlots">Places</label>'
    + '<input class="et-input" type="number" min="1" id="etPositionSlots" value="' + toNumber(position.slots) + '"></div>'
    + '<div class="et-field"><label for="etPositionCommitment">Time commitment</label>'
    + '<input class="et-input" id="etPositionCommitment" maxlength="120" placeholder="Two hours every Saturday" value="' + esc(position.timeCommitment) + '"></div>'
    + '</div>'
    + '<div class="et-field"><label for="etPositionDescription">What they will do</label>'
    + '<textarea class="et-textarea" id="etPositionDescription" maxlength="300" placeholder="Sort donations, keep the tables tidy, help visitors">'
    + esc(position.description) + '</textarea></div>'
    + '<div class="et-field"><label for="etPositionRequirements">What they need to have</label>'
    + '<textarea class="et-textarea" id="etPositionRequirements" maxlength="300" placeholder="Closed shoes, a lift to the site, first aid">'
    + esc(position.requirements) + '</textarea></div>'
    + '<div class="et-field"><label for="etPositionSkills">Skills wanted</label>'
    + '<input class="et-input" id="etPositionSkills" maxlength="120" placeholder="Driving licence, cooking" value="' + esc(position.skills) + '">'
    + '<div class="et-hint">Used when a volunteer matches themselves to a position.</div></div>'
    + '<h3 class="et-form-section">This position as an offer</h3>'
    + '<div class="et-field-row">'
    + '<div class="et-field"><label for="etPositionOfferType">Type</label>'
    + '<select class="et-select" id="etPositionOfferType">' + optionListHtml(OPPORTUNITY_TYPES, position.opportunityType) + '</select></div>'
    + '<div class="et-field"><label for="etPositionLocationMode">Where</label>'
    + '<select class="et-select" id="etPositionLocationMode">' + optionListHtml(LOCATION_MODES, position.locationMode) + '</select></div>'
    + '</div>'
    + '<h3 class="et-form-section">When it runs</h3>'
    + '<div class="et-field-row">'
    + '<div class="et-field"><label for="etPositionDeadline">Work deadline</label>'
    + '<input class="et-input" type="date" id="etPositionDeadline" value="' + esc(position.deadline) + '"></div>'
    + '<div class="et-field"><label for="etPositionApplicationDeadline">Applications close</label>'
    + '<input class="et-input" type="date" id="etPositionApplicationDeadline" value="' + esc(position.applicationDeadline) + '">'
    + '<div class="et-hint">Leave empty to keep taking applications until the work starts.</div></div>'
    + '</div>'
    + '<div class="et-field"><label>Weekly schedule</label>'
    + '<div class="et-weekdays">' + weekdayChoicesHtml(positionRecurrence.weekdays, 'etPositionWeekday') + '</div>'
    + '<div class="et-field-row" style="margin-top:10px;">'
    + '<div class="et-field"><label for="etPositionTimeFrom">From</label>'
    + '<input class="et-input" type="time" id="etPositionTimeFrom" value="' + esc(positionRecurrence.timeFrom) + '"></div>'
    + '<div class="et-field"><label for="etPositionTimeTo">To</label>'
    + '<input class="et-input" type="time" id="etPositionTimeTo" value="' + esc(positionRecurrence.timeTo) + '"></div>'
    + '</div>'
    + '<div class="et-hint">Use this for the Recurring type. Each ticked day becomes one slot a volunteer can clock into, for as long as the event runs.</div></div>';

  openModal(isNewPosition ? 'New position' : 'Edit position', body,
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-primary" onclick="submitPosition('
    + (positionId ? '\'' + escJs(positionId) + '\'' : 'null') + ')">Save position</button>');
}

function submitPosition(positionId) {
  try {
    var positionName = el('etPositionName') ? el('etPositionName').value.trim() : '';
    if (!positionName) { notifyHost('The position needs a name.', 'warning'); return; }

    var savedPosition = normalizePosition({
      id: positionId || newRecordId('pos'),
      name: positionName,
      slots: el('etPositionSlots') ? el('etPositionSlots').value : 1,
      description: el('etPositionDescription') ? el('etPositionDescription').value : '',
      requirements: el('etPositionRequirements') ? el('etPositionRequirements').value : '',
      skills: el('etPositionSkills') ? el('etPositionSkills').value : '',
      timeCommitment: el('etPositionCommitment') ? el('etPositionCommitment').value : '',
      opportunityType: el('etPositionOfferType') ? el('etPositionOfferType').value : 'event',
      locationMode: el('etPositionLocationMode') ? el('etPositionLocationMode').value : 'onsite',
      deadline: el('etPositionDeadline') ? el('etPositionDeadline').value : '',
      applicationDeadline: el('etPositionApplicationDeadline') ? el('etPositionApplicationDeadline').value : '',
      recurrence: {
        weekdays: selectedWeekdaysFromForm('etPositionWeekday'),
        timeFrom: el('etPositionTimeFrom') ? el('etPositionTimeFrom').value : '',
        timeTo: el('etPositionTimeTo') ? el('etPositionTimeTo').value : ''
      }
    });

    var nextPositions = (Array.isArray(APP.eventData.positions) ? APP.eventData.positions : []).map(normalizePosition);
    if (positionId) {
      var wasReplaced = false;
      nextPositions = nextPositions.map(function (row) {
        if (row.id !== positionId) return row;
        wasReplaced = true;
        return savedPosition;
      });
      if (!wasReplaced) nextPositions.push(savedPosition);
    } else {
      nextPositions.push(savedPosition);
    }
    savePositions(nextPositions);
  } catch (error) {
    notifyHost('Could not save the position: ' + (error && error.message ? error.message : error), 'error');
  }
}

function openDeletePositionModal(positionId) {
  var positions = Array.isArray(APP.eventData.positions) ? APP.eventData.positions : [];
  var position = null;
  positions.forEach(function (row) { if (row.id === positionId) position = row; });
  if (!position) return;

  openModal('Delete position',
    '<p>Delete the position <strong>' + esc(position.name) + '</strong>?</p>'
    + '<div class="et-note-warn et-note">Volunteers already placed in this position keep their placement record, but the position disappears from the event.</div>',
    '<button type="button" class="et-btn" onclick="closeModal()">Cancel</button>'
    + '<button type="button" class="et-btn et-btn-bad" onclick="confirmDeletePosition(\'' + escJs(positionId) + '\')">Delete</button>');
}

function confirmDeletePosition(positionId) {
  var remainingPositions = (Array.isArray(APP.eventData.positions) ? APP.eventData.positions : []).filter(function (row) {
    return row.id !== positionId;
  });
  savePositions(remainingPositions);
}

function readEventFormValues() {
  return {
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
  };
}

var eventAutoSaveTimer = null;

function bindEventFormAutoSave() {
  var formNode = el('etEventForm');
  if (!formNode || formNode.getAttribute('data-autosave-bound') === 'yes') return;
  formNode.setAttribute('data-autosave-bound', 'yes');
  formNode.addEventListener('input', scheduleEventAutoSave);
  formNode.addEventListener('change', scheduleEventAutoSave);
}

/* Typing in the form writes the attached event record shortly after the last
   keystroke, so the tool needs no Save button of its own. */
function scheduleEventAutoSave() {
  if (!canManage()) return;
  if (eventAutoSaveTimer) clearTimeout(eventAutoSaveTimer);
  eventAutoSaveTimer = setTimeout(function () {
    eventAutoSaveTimer = null;
    saveEventDefinition(readEventFormValues(), { silent: true });
  }, 700);
}

/* Moves whatever is typed in the form into the tool state, for the actions
   that rebuild the form before the next automatic write. */
function flushEventFormEdits() {
  if (!canManage() || !el('etFormName')) return;
  APP.eventData = eventDataFromForm(readEventFormValues(), APP.eventData);
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
    lastView: { type: 'string' },
    lastFormTab: { type: 'string' }
  }
});

tool.onReady(function (value) {
  APP.savedValue = value || {};
  APP.user = tool.getUser ? tool.getUser() : null;
  APP.isManager = detectManager(APP.user);
  try { APP.readOnly = tool.isReadOnly ? !!tool.isReadOnly() : false; } catch (error) { APP.readOnly = false; }

  if (APP.savedValue && APP.savedValue.lastView) APP.view = APP.savedValue.lastView;
  if (APP.savedValue && APP.savedValue.lastFormTab) APP.formTab = APP.savedValue.lastFormTab;

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

  el('etDrawerClose').addEventListener('click', closeMemberDrawer);
  el('etMemberDrawerOverlay').addEventListener('click', closeMemberDrawer);
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var openModalNode = el('etModal');
    if (openModalNode && openModalNode.classList.contains('open')) { closeModal(); return; }
    var openDrawerNode = el('etMemberDrawer');
    if (openDrawerNode && openDrawerNode.classList.contains('open')) closeMemberDrawer();
  });

  el('etRefreshBtn').addEventListener('click', function () { loadAll(); });
  el('etAddVolunteerBtn').addEventListener('click', openAddVolunteerModal);
  el('etAddTaskBtn').addEventListener('click', function () { openTaskModal(null); });
  el('etNewMessageBtn').addEventListener('click', openNewMessageModal);
  el('etRotateBtn').addEventListener('click', openRotateModal);
  el('etAddPositionBtn').addEventListener('click', function () { openPositionModal(null); });
  el('etExportReportBtn').addEventListener('click', exportReport);
  if (el('etApproveAllBtn')) el('etApproveAllBtn').addEventListener('click', openApproveAllModal);

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
      lastView: APP.view,
      lastFormTab: APP.formTab
    });
  } catch (error) { /* optional */ }
}
