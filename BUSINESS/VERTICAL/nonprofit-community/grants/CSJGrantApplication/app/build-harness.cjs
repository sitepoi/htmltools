#!/usr/bin/env node
/* Regenerates test-harness.html from CSJGrantApplication.html.
   Run from the app folder: node build-harness.cjs */
'use strict';

const fs = require('fs');
const path = require('path');

const appDir = __dirname;
const toolHtml = fs.readFileSync(path.join(appDir, 'CSJGrantApplication.html'), 'utf8');

const template = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CSJ Grant Application - Test Harness</title>
<link rel="stylesheet" href="CSJGrantApplication.css">
<style>
  html, body { margin: 0; padding: 0; }
  body { padding-top: 42px; background: #f4f7fb; }
  #th-bar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 9998;
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    padding: 6px 12px; min-height: 30px;
    background: #0f172a; color: #e2e8f0;
    font-family: "Segoe UI", system-ui, sans-serif; font-size: 11px;
  }
  #th-bar strong { color: #93c5fd; letter-spacing: 0.04em; }
  #th-bar button { border: 0; border-radius: 5px; padding: 4px 9px; cursor: pointer; font: inherit; font-weight: 700; background: #1e40af; color: #fff; }
  #th-bar button:hover { background: #1d4ed8; }
  #th-bar button.th-quiet { background: #334155; }
  #th-bar button.th-danger { background: #b91c1c; }
  #th-bar select { font: inherit; font-size: 11px; padding: 2px 4px; border-radius: 4px; border: 1px solid #475569; background: #1e293b; color: #e2e8f0; }
  #th-bar label { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
  #th-bar a { color: #93c5fd; font-weight: 700; text-decoration: none; }
  #th-bar a:hover { text-decoration: underline; }
  .th-sep { color: #475569; }
  #th-status { color: #cbd5e1; font-weight: 600; max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #th-status.is-success { color: #86efac; }
  #th-status.is-warning { color: #fcd34d; }
  #th-status.is-error { color: #fca5a5; }
  #th-note { padding: 4px 14px; background: #fffbeb; border-bottom: 1px solid #fde68a; color: #92400e; font-family: "Segoe UI", system-ui, sans-serif; font-size: 10.5px; line-height: 1.5; }
  #th-note code { font-family: "Cascadia Code", Consolas, monospace; font-size: 10px; background: #fef3c7; padding: 0 3px; border-radius: 3px; }
  .csj-app .csj-header { top: 42px; }
  .csj-app *, .csj-app *::before, .csj-app *::after { transition: none !important; animation: none !important; }
  @media (max-width: 900px) { body { padding-top: 110px; } .csj-app .csj-header { top: 110px; } .csj-drawer { top: 110px !important; } }
  .csj-drawer { top: 42px !important; }
</style>
</head>
<body>

<div id="th-bar">
  <strong>CSJ GRANT APPLICATION - TEST HARNESS</strong>
  <span class="th-sep">|</span>
  <button type="button" id="th-sample">Load sample</button>
  <button type="button" class="th-danger" id="th-clear">Clear all</button>
  <button type="button" class="th-quiet" id="th-reload">Reload</button>
  <span class="th-sep">|</span>
  <label>Role
    <select id="th-role">
      <option value="admin">admin</option>
      <option value="editor">editor</option>
      <option value="viewer">viewer</option>
      <option value="none">none</option>
    </select>
  </label>
  <label><input type="checkbox" id="th-ro"> Read-only</label>
  <span class="th-sep">|</span>
  <button type="button" class="th-quiet" id="th-remote-job">Simulate remote job edit</button>
  <button type="button" class="th-quiet" id="th-remote-app">Simulate remote org edit</button>
  <span class="th-sep">|</span>
  <span id="th-status">Starting...</span>
  <span class="th-sep">|</span>
  <a href="?inlinejs=1">Inline JS mode</a>
</div>

<div id="th-note">
  Harness mock data is stored in localStorage. Shortcuts: <code>?sample=1</code> <code>?role=editor</code> <code>?ro=1</code> <code>?storage=off</code> <code>?strict=1</code> <code>?inlinejs=1</code> (inline needs HTTP).
</div>

<div id="app-container">
<!-- TOOL_HTML -->
</div>

<script>
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var STORE_KEY = 'csj_harness_store_v3';
  var VALUE_KEY = 'csj_harness_value_v3';
  var READONLY_KEY = 'csj_harness_readonly_v3';
  var ROLE_KEY = 'csj_harness_role_v3';
  var TOOL_TYPE = 'canada-summer-jobs-grant-application-entry-uniconbaseapps';
  var PARENT_ID = 'rec_csj_application_2027';

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function clone(value) { return JSON.parse(JSON.stringify(value == null ? null : value)); }
  function uid() { return 'mock_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function minutesAgo(minutes) { return new Date(Date.now() - minutes * 60000).toISOString(); }

  function mockAiResponse(prompt) {
    var text = String(prompt || '');
    if (/Return ONLY valid JSON|assessing a Canada Summer Jobs/i.test(text)) {
      return JSON.stringify({
        score: 72,
        strengths: ['The tasks show direct program support.', 'Participant interaction is clear.'],
        gaps: ['Add a task about reporting safety concerns.', 'Name the digital tools used for data entry.']
      });
    }
    var tasks = [
      'Prepare daily activity materials, supplies and the space before participants arrive.',
      'Welcome participants, confirm attendance and explain the day schedule.',
      'Lead small-group activities and adapt tasks so every participant can take part.',
      'Support participants one to one when they need help with an activity.',
      'Keep activity areas clean, safe and accessible throughout the day.',
      'Record attendance, incidents and supply needs, then share them with the supervisor.',
      'Help pack up, organize supplies and close the space at the end of the day.'
    ];
    if (/shorten/i.test(text)) {
      tasks = [
        'Set up materials and the activity space each morning.',
        'Welcome participants, take attendance and explain the schedule.',
        'Lead group activities and help participants who need support.',
        'Keep the space clean, safe and accessible.',
        'Record attendance and incidents and report them to the supervisor.'
      ];
    }
    if (/safety|inclusion/i.test(text)) {
      tasks.push('Check equipment and report hazards before each activity.');
      tasks.push('Follow the accessibility and inclusion measures in the program plan.');
    }
    var html = '<ul>';
    for (var i = 0; i < tasks.length; i++) {
      html += '<li>' + tasks[i] + '</li>';
    }
    html += '</ul>';
    return html;
  }

  var store = readJson(STORE_KEY, []);
  var value = readJson(VALUE_KEY, null);
  var readOnly = params.get('ro') === '1' ? true : readJson(READONLY_KEY, false);
  var role = params.get('role') || readJson(ROLE_KEY, 'admin');
  var noIdentity = params.get('noidentity') === '1';
  var aiEnabled = params.get('ai') !== 'off';
  var aiAuthorized = params.get('ai') !== 'noauth';
  var storageOff = params.get('storage') === 'off';
  var strict = params.get('strict') === '1';

  function userForRole(r) {
    if (r === 'admin') {
      return { id: 'u_alex', name: 'Alex Morgan', email: 'alex@example.org', roles: ['admin', 'editor'], effectiveAccess: { isViewer: true, isEditor: true, isManager: true }, locale: 'en-CA' };
    }
    if (r === 'editor') {
      return { id: 'u_priya', name: 'Priya Shah', email: 'priya@example.org', roles: ['viewer', 'editor'], effectiveAccess: { isViewer: true, isEditor: true, isManager: false }, locale: 'en-CA' };
    }
    if (r === 'viewer') {
      return { id: 'u_sam', name: 'Sam Lee', email: 'sam@example.org', roles: ['viewer'], effectiveAccess: { isViewer: true, isEditor: false, isManager: false }, locale: 'en-CA' };
    }
    return null;
  }

  var user = noIdentity ? null : userForRole(role);
  var listeners = { value: [], readonly: [], user: [], fields: [] };
  var fields = { id: PARENT_ID, cmsObjectType: 'csj-applications', name: 'CSJ application 2027', productData: {} };
  var _lastOpened = '';

  function notify(kind, data) {
    (listeners[kind] || []).forEach(function (cb) { try { cb(data); } catch (e) {} });
  }
  function status(message, tone) {
    var span = document.getElementById('th-status');
    if (span) {
      span.textContent = message;
      span.className = tone ? 'is-' + tone : '';
    }
  }
  function objectFromEntry(entry) {
    return {
      id: entry.id,
      _id: entry.id,
      name: entry.name || '',
      cmsObjectType: TOOL_TYPE,
      _parentObjectId: PARENT_ID,
      productData: { data_categoriesBased: clone(entry.data) }
    };
  }
  function findEntry(id) {
    for (var i = 0; i < store.length; i++) if (store[i].id === id) return store[i];
    return null;
  }
  function entry(id, name, data, minutes) {
    var record = clone(data);
    record.schemaVersion = 1;
    record.revision = 1;
    record.updatedAt = minutesAgo(minutes || 30);
    record.updatedByName = 'Alex Morgan';
    record.updatedByUserId = 'u_alex';
    record.updatedByEmail = 'alex@example.org';
    return { id: id, type: TOOL_TYPE, name: name, data: record };
  }

  function seedSample() {
    var app = {
      entryType: 'application',
      programYear: '2027',
      status: 'draft',
      legalName: 'Community Learning Society',
      operatingName: 'Community Learning Centre',
      craBusinessNumber: '123456789RR0001',
      phone: '604-555-0100',
      email: 'info@communitylearning.example',
      emailForJobAds: 'jobs@communitylearning.example',
      website: 'https://communitylearning.example',
      yearEstablished: 1998,
      fullTimeEmployees: 6,
      accommodationPlan: 'Wheelchair accessible venue, flexible scheduling and a quiet room for sensory breaks.',
      submittedAt: '',
      submittedByUserId: '',
      submittedByName: '',
      frozenSnapshotObjectId: ''
    };

    var contactOne = {
      entryType: 'contact',
      sortOrder: 10,
      contactType: 'primaryContact',
      firstName: 'Alex',
      lastName: 'Morgan',
      phone: '604-555-0142',
      email: 'alex@example.org',
      jobTitle: 'Executive Director',
      preferredLanguage: 'en'
    };
    var contactTwo = {
      entryType: 'contact',
      sortOrder: 20,
      contactType: 'secondaryContact',
      firstName: 'Priya',
      lastName: 'Shah',
      phone: '604-555-0178',
      email: 'priya@example.org',
      jobTitle: 'Program Manager',
      preferredLanguage: 'en'
    };

    var addressOne = {
      entryType: 'address',
      sortOrder: 10,
      addressType: 'mailing',
      address: '123 Main Street',
      city: 'New Westminster',
      province: 'BC',
      postalCode: 'V3L 1A1',
      constituency: 'New Westminster-Burnaby'
    };
    var addressTwo = {
      entryType: 'address',
      sortOrder: 20,
      addressType: 'proposedJobActivity',
      address: '456 Community Hall Road',
      city: 'New Westminster',
      province: 'BC',
      postalCode: 'V3L 2B2',
      constituency: 'New Westminster-Burnaby'
    };

    var branchOne = {
      entryType: 'branch',
      sortOrder: 5,
      branchName: 'Main office',
      constituency: 'New Westminster—Burnaby—Maillardville',
      province: 'BC',
      city: 'New Westminster',
      address: '123 Main Street',
      localPriorities: [
        { id: 'lp-program-support', label: 'Program support and administration', description: 'Registration, scheduling, materials and reporting for community programs.', keywords: ['registration', 'scheduling', 'materials', 'reporting', 'data entry', 'attendance'] },
        { id: 'lp-youth-skills', label: 'Youth skills development', description: 'Training, mentorship and skill building for youth.', keywords: ['training', 'mentorship', 'skills', 'youth'] }
      ]
    };
    var branchTwo = {
      entryType: 'branch',
      sortOrder: 10,
      branchName: 'Outreach office',
      constituency: 'Vancouver East',
      province: 'BC',
      city: 'Vancouver',
      address: '789 Community Avenue',
      localPriorities: [
        { id: 'lp-community-outreach', label: 'Community outreach', description: 'Events, partners and community engagement.', keywords: ['outreach', 'events', 'community', 'partners', 'engagement'] }
      ]
    };

    var jobOne = {
      entryType: 'job',
      sortOrder: 10,
      jobTitle: 'Program Assistant',
      nocCode: '13110',
      nocTitle: 'Administrative assistants',
      ownerUserId: 'u_priya',
      ownerUserName: 'Priya Shah',
      ownerEmail: 'priya@example.org',
      branchObjectId: 'mock_branch_1',
      branchName: 'Main office',
      constituency: 'New Westminster—Burnaby—Maillardville',
      supportedLocalPriorities: ['lp-program-support'],
      jobDescriptionHtml: '<p>Support the summer program team with registration, scheduling, materials preparation and participant follow-up.</p><ul><li>Prepare daily activity materials.</li><li>Welcome participants and record attendance.</li><li>Help with reporting and data entry.</li></ul>',
      hourlyWageRate: 20,
      requiredLanguage: 'en',
      otherRequiredLanguage: '',
      sdpAdaptability: true,
      sdpCollaboration: true,
      sdpCommunication: true,
      sdpCreativityInnovation: false,
      sdpDigitalSkills: true,
      sdpNumeracy: false,
      sdpProblemSolving: false,
      sdpTechnicalSkills: false,
      sdpOther: '',
      plannedStaffCount: 2,
      startDate: '2027-06-28',
      hourlyWage: 20,
      numberOfWeeks: '8',
      hoursPerWeek: 35,
      intendToHireLater: true,
      levelOfEducation: 'noPreference',
      supervisorJobTitle: 'manager',
      supervisorTitleIfOther: '',
      supervisionType: 'combination',
      supervisionFrequency: 'weekly',
      supervisorSupervisionExperience: '1to2Years',
      supervisorFeedbackType: 'formal',
      supervisorWillProvide: ['jobSpecificTraining', 'evaluationOfWork'],
      supervisorWillProvideIfOther: '',
      mentorJobTitle: 'director',
      mentorTitleIfOther: '',
      mentorshipType: 'oneOnOne',
      mentorshipFrequency: 'weekly',
      mentorMentorshipExperience: 'moreThan2Years',
      mentorMenteeRelationship: 'formal',
      mentorWillProvide: ['supportForSkillDevelopment', 'careerRelatedTraining'],
      mentorWillProvideIfOther: '',
      priorityToHireForYouthFacingBarriers: ['withDisability', 'inRuralRemoteNorthern'],
      howToPrioritize: ['targetedJobAdvertisement', 'includeCommitmentToInclusionInJobAd'],
      howToPrioritizeIfOther: '',
      organizationsHaveInPlaceSupport: ['accommodationMeasures', 'diversityTraining'],
      organizationsHaveInPlaceSupportIfOther: '',
      supportedNationalPriorities: ['technologyDigitalAndAI'],
      howManyLocalPrioritiesSupported: '2',
      localPrioritiesSupported: 'Digital access for rural youth and inclusive recreation.'
    };

    var jobTwo = {
      entryType: 'job',
      sortOrder: 20,
      jobTitle: 'Community Outreach Coordinator',
      nocCode: '',
      nocTitle: '',
      ownerUserId: 'u_alex',
      ownerUserName: 'Alex Morgan',
      ownerEmail: 'alex@example.org',
      branchObjectId: 'mock_branch_2',
      branchName: 'Outreach office',
      constituency: 'Vancouver East',
      supportedNationalPriorities: [],
      supportedLocalPriorities: [],
      jobDescriptionHtml: '<p>Help plan outreach events and contact community partners.</p>',
      hourlyWageRate: 22,
      requiredLanguage: 'en',
      otherRequiredLanguage: '',
      sdpAdaptability: false,
      sdpCollaboration: true,
      sdpCommunication: true,
      sdpCreativityInnovation: false,
      sdpDigitalSkills: false,
      sdpNumeracy: false,
      sdpProblemSolving: false,
      sdpTechnicalSkills: false,
      sdpOther: '',
      plannedStaffCount: 1,
      startDate: '2027-07-05',
      hourlyWage: 22,
      numberOfWeeks: '12',
      hoursPerWeek: 35,
      intendToHireLater: false,
      levelOfEducation: 'postSecondary',
      supervisorJobTitle: '',
      supervisorTitleIfOther: '',
      supervisionType: '',
      supervisionFrequency: '',
      supervisorSupervisionExperience: '',
      supervisorFeedbackType: '',
      supervisorWillProvide: [],
      supervisorWillProvideIfOther: '',
      mentorJobTitle: '',
      mentorTitleIfOther: '',
      mentorshipType: '',
      mentorshipFrequency: '',
      mentorMentorshipExperience: '',
      mentorMenteeRelationship: '',
      mentorWillProvide: [],
      mentorWillProvideIfOther: '',
      priorityToHireForYouthFacingBarriers: [],
      howToPrioritize: [],
      howToPrioritizeIfOther: '',
      organizationsHaveInPlaceSupport: [],
      organizationsHaveInPlaceSupportIfOther: '',
      supportedNationalPriorities: [],
      howManyLocalPrioritiesSupported: '0',
      localPrioritiesSupported: ''
    };

    function doc(id, name, category, policyType, fileName) {
      return {
        entryType: 'document',
        category: category,
        policyType: policyType || '',
        fileName: fileName,
        fileUrl: 'https://example.org/mock/' + encodeURIComponent(fileName),
        fileSize: 180000,
        fileType: 'application/pdf',
        uploadedAt: minutesAgo(90),
        updatedAt: minutesAgo(90),
        updatedByName: 'Alex Morgan',
        updatedByUserId: 'u_alex',
        updatedByEmail: 'alex@example.org'
      };
    }

    store = [
      entry('mock_app', 'CSJ application 2027', app, 5),
      entry('mock_contact_1', 'Alex Morgan', contactOne, 40),
      entry('mock_contact_2', 'Priya Shah', contactTwo, 60),
      entry('mock_address_1', 'Mailing - New Westminster', addressOne, 70),
      entry('mock_address_2', 'Proposed job activity - New Westminster', addressTwo, 80),
      entry('mock_branch_1', 'Main office', branchOne, 50),
      entry('mock_branch_2', 'Outreach office', branchTwo, 55),
      entry('mock_job_1', 'Program Assistant', jobOne, 15),
      entry('mock_job_2', 'Community Outreach Coordinator', jobTwo, 25),
      { id: 'mock_doc_reg', type: TOOL_TYPE, name: 'certificate-of-incorporation.pdf', data: doc('reg', 'Certificate of incorporation', 'proofOfBusinessRegistration', '', 'certificate-of-incorporation.pdf') },
      { id: 'mock_doc_addr', type: TOOL_TYPE, name: 'utility-bill.pdf', data: doc('addr', 'Utility bill', 'proofOfAddress', '', 'utility-bill.pdf') },
      { id: 'mock_doc_cheque', type: TOOL_TYPE, name: 'void-cheque.pdf', data: doc('cheque', 'Void cheque', 'voidCheque', '', 'void-cheque.pdf') },
      { id: 'mock_doc_safety', type: TOOL_TYPE, name: 'health-and-safety-policy.pdf', data: doc('safety', 'Health and safety policy', 'healthAndSafetyPolicy', '', 'health-and-safety-policy.pdf') },
      { id: 'mock_doc_hiring', type: TOOL_TYPE, name: 'hiring-policy.pdf', data: doc('hiring', 'Hiring policy', 'policy', 'hiringPolicy', 'hiring-policy.pdf') },
      { id: 'mock_doc_disc', type: TOOL_TYPE, name: 'discrimination-policy.pdf', data: doc('disc', 'Discrimination policy', 'policy', 'discriminationPolicy', 'discrimination-policy.pdf') },
      { id: 'mock_snapshot_1', type: TOOL_TYPE, name: 'Initial snapshot', data: { entryType: 'snapshot', label: 'Initial snapshot', payloadJson: '{"note":"Sample snapshot - replace by submitting the application."}', entryCount: 14, createdAt: minutesAgo(120) } }
    ];
    value = { schemaVersion: 1, applicationEntryId: 'mock_app', ui: { section: 'dashboard' } };
    writeJson(STORE_KEY, store);
    writeJson(VALUE_KEY, value);
  }

  window.tool = {
    onReady: function (callback) {
      setTimeout(function () {
        try { callback(value, fields); }
        catch (e) { console.error(e); status('Tool boot error: ' + e.message, 'error'); }
      }, 30);
    },
    getValue: function () { return value; },
    setValue: function (next) {
      value = clone(next);
      writeJson(VALUE_KEY, value);
      notify('value', clone(value));
    },
    onValueChange: function (callback) { listeners.value.push(callback); },
    getFields: function () { return clone(fields); },
    setField: function () {},
    setFields: function () {},
    watchField: function () {},
    onFieldsChange: function (callback) { listeners.fields.push(callback); },
    param: function (name, fallback) {
      if (params.get(name) !== null) return params.get(name);
      if (name === 'entryObjectType') return TOOL_TYPE;
      if (name === 'programYear') return '2027';
      if (name === 'liveSyncSeconds') return '20';
      if (name === 'allowAi') return aiEnabled ? 'yes' : 'no';
      if (name === 'chatSessionObjectType') return 'ai-chat-sessions-uniconbaseapps';
      return fallback;
    },
    isReadOnly: function () { return readOnly; },
    onReadonlyChange: function (callback) { listeners.readonly.push(callback); },
    getUser: function () { return noIdentity ? undefined : user; },
    onUserChange: function (callback) { listeners.user.push(callback); },
    getPermittedUsers: function () {
      return [
        { id: 'u_alex', name: 'Alex Morgan', email: 'alex@example.org', roles: ['admin', 'editor'] },
        { id: 'u_priya', name: 'Priya Shah', email: 'priya@example.org', roles: ['viewer', 'editor'] },
        { id: 'u_sam', name: 'Sam Lee', email: 'sam@example.org', roles: ['viewer'] }
      ];
    },
    notify: function (message, severity) { status(message, severity); },
    resize: function () {},
    reportValid: function () {},
    declareParams: function (list) { window.__csjDeclaredParams = list || []; },
    declareOutput: function (schema) { window.__csjDeclaredOutput = schema; },
    reportMissingParams: function (missing) { window.__csjMissingParams = missing || []; },
    openUrl: function (url) { _lastOpened = url; status('Open URL: ' + url); },
    openObjectDetail: function (type, id) { _lastOpened = type + '/' + id; status('Open object: ' + _lastOpened); },

    requestAI: function (prompt, context, callback) {
      setTimeout(function () {
        if (!aiEnabled) { callback('AI is not enabled for this field.', null); return; }
        callback(null, mockAiResponse(prompt));
      }, 250);
    },
    requestAIStream: function (prompt, context, callbacks) {
      if (!aiEnabled) {
        setTimeout(function () { callbacks.onError('AI is not enabled for this field.'); }, 60);
        return;
      }
      var full = mockAiResponse(prompt);
      var position = 0;
      var timer = setInterval(function () {
        if (position >= full.length) {
          clearInterval(timer);
          callbacks.onComplete(full);
          return;
        }
        callbacks.onToken(full.slice(position, position + 26));
        position += 26;
      }, 35);
    },

    requestObjects: function (action, payload, callback) {
      setTimeout(function () {
        if (storageOff) { callback('Object CRUD is not enabled for this field.', null); return; }
        try {
          if (action === 'query') {
            var requestedType = payload.mainObjectType || TOOL_TYPE;
            if (requestedType === 'ai-chat-sessions-uniconbaseapps' && !aiAuthorized) {
              callback('Unknown or unauthorized object type: ' + requestedType, null);
              return;
            }
            var objects = [];
            for (var i = 0; i < store.length; i++) {
              if (store[i].type === requestedType) objects.push(objectFromEntry(store[i]));
            }
            document.body.setAttribute('data-harness-store', String(store.length));
            document.body.setAttribute('data-harness-query', String(objects.length));
            callback(null, { objects: objects });
            return;
          }
          if (action === 'get') {
            var found = findEntry(payload.objectId);
            callback(null, { object: found ? objectFromEntry(found) : null });
            return;
          }
          if (action === 'create') {
            var createdType = payload.mainObjectType || TOOL_TYPE;
            if (createdType === 'ai-chat-sessions-uniconbaseapps' && !aiAuthorized) {
              callback('Unknown or unauthorized object type: ' + createdType, null);
              return;
            }
            var newEntry = {
              id: uid(),
              type: createdType,
              name: payload.name || '',
              data: clone((payload.productData && payload.productData.data_categoriesBased) || {})
            };
            store.push(newEntry);
            writeJson(STORE_KEY, store);
            callback(null, { object: objectFromEntry(newEntry) });
            return;
          }
          if (action === 'update') {
            var target = findEntry(payload.objectId);
            if (!target) { callback('Object not found.', null); return; }
            var incoming = clone((payload.productData && payload.productData.data_categoriesBased) || {});
            document.body.setAttribute('data-harness-last-update', JSON.stringify(incoming).slice(0, 400));
            var currentRevision = Number(target.data.revision) || 1;
            var incomingRevision = Number(incoming.revision) || currentRevision;
            if (strict && incomingRevision < currentRevision) {
              callback('Object version conflict - load the object first.', null);
              return;
            }
            for (var key in incoming) {
              if (Object.prototype.hasOwnProperty.call(incoming, key)) target.data[key] = incoming[key];
            }
            target.name = payload.name || target.name;
            writeJson(STORE_KEY, store);
            callback(null, { ok: true });
            return;
          }
          if (action === 'delete') {
            for (var d = store.length - 1; d >= 0; d--) if (store[d].id === payload.objectId) store.splice(d, 1);
            writeJson(STORE_KEY, store);
            callback(null, { ok: true });
            return;
          }
          if (action === 'batch') {
            var operations = payload.operations || [];
            for (var b = 0; b < operations.length; b++) {
              var op = operations[b];
              if (op.action === 'create') {
                store.push({
                  id: uid(),
                  type: TOOL_TYPE,
                  name: op.name || '',
                  data: clone((op.productData && op.productData.data_categoriesBased) || {})
                });
              } else if (op.action === 'update') {
                var batchTarget = findEntry(op.objectId);
                if (batchTarget) {
                  var batchData = clone((op.productData && op.productData.data_categoriesBased) || {});
                  for (var batchKey in batchData) {
                    if (Object.prototype.hasOwnProperty.call(batchData, batchKey)) batchTarget.data[batchKey] = batchData[batchKey];
                  }
                }
              } else if (op.action === 'delete') {
                for (var x = store.length - 1; x >= 0; x--) if (store[x].id === op.objectId) store.splice(x, 1);
              }
            }
            writeJson(STORE_KEY, store);
            callback(null, { ok: true });
            return;
          }
          callback('Unsupported action: ' + action, null);
        } catch (e) {
          document.body.setAttribute('data-harness-error', e.message || 'unknown');
          callback(e.message, null);
        }
      }, 20);
    },

    requestUpload: function (accept, callback) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = accept || '';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        document.body.removeChild(input);
        if (!file) return;
        status('Mock upload: ' + file.name);
        callback(null, { name: file.name, url: 'https://example.org/mock/' + encodeURIComponent(file.name), size: file.size, type: file.type || 'application/pdf' });
      });
      input.click();
    },

    requestExportPdf: function (options, callback) {
      setTimeout(function () {
        var html = (options && options.html) || '';
        var blob = new Blob([html], { type: 'text/html' });
        window.__csjLastPdfHtml = html;
        callback(null, { name: ((options && options.filename) || 'export') + '.html', url: URL.createObjectURL(blob), size: html.length, type: 'text/html' });
      }, 30);
    },

    requestSave: function (callback) { setTimeout(function () { callback(null, true); }, 30); },

    _harness: {
      setRole: function (nextRole) {
        role = nextRole;
        writeJson(ROLE_KEY, role);
        user = role === 'none' ? null : userForRole(role);
        notify('user', user);
        status('Role changed to ' + role);
      },
      setReadOnly: function (nextReadOnly) {
        readOnly = !!nextReadOnly;
        writeJson(READONLY_KEY, readOnly);
        notify('readonly', readOnly);
        status('Read-only ' + (readOnly ? 'on' : 'off'));
      },
      seedSample: function () { seedSample(); window.location.reload(); },
      clear: function () { localStorage.removeItem(STORE_KEY); localStorage.removeItem(VALUE_KEY); window.location.reload(); },
      remoteJobEdit: function () {
        for (var i = 0; i < store.length; i++) {
          if (store[i].data && store[i].data.entryType === 'job') {
            store[i].data.jobTitle = String(store[i].data.jobTitle || 'Job') + ' (remote edit)';
            store[i].data.revision = (Number(store[i].data.revision) || 1) + 1;
            store[i].data.updatedAt = new Date().toISOString();
            store[i].data.updatedByName = 'Remote User';
            store[i].name = store[i].data.jobTitle;
            writeJson(STORE_KEY, store);
            status('Simulated remote job edit: ' + store[i].data.jobTitle, 'warning');
            return;
          }
        }
        status('No job entry to edit.', 'warning');
      },
      remoteAppEdit: function () {
        for (var i = 0; i < store.length; i++) {
          if (store[i].data && store[i].data.entryType === 'application') {
            store[i].data.phone = '604-555-0199';
            store[i].data.revision = (Number(store[i].data.revision) || 1) + 1;
            store[i].data.updatedAt = new Date().toISOString();
            store[i].data.updatedByName = 'Remote User';
            writeJson(STORE_KEY, store);
            status('Simulated remote organization edit.', 'warning');
            return;
          }
        }
        status('No application entry to edit.', 'warning');
      },
      lastOpenedUrl: function () { return _lastOpened; },
      dump: function () { console.log('STORE', store); console.log('VALUE', value); }
    }
  };

  if (noIdentity) { try { delete window.tool.getUser; } catch (e) { window.tool.getUser = undefined; } }
  window.__csjHarness = window.tool._harness;

  var roleSelect = document.getElementById('th-role');
  if (roleSelect) roleSelect.value = role;
  var roCheck = document.getElementById('th-ro');
  if (roCheck) roCheck.checked = readOnly;

  document.getElementById('th-sample').addEventListener('click', function () { seedSample(); window.location.reload(); });
  document.getElementById('th-clear').addEventListener('click', function () { window.tool._harness.clear(); });
  document.getElementById('th-reload').addEventListener('click', function () { window.location.reload(); });
  document.getElementById('th-remote-job').addEventListener('click', function () { window.tool._harness.remoteJobEdit(); });
  document.getElementById('th-remote-app').addEventListener('click', function () { window.tool._harness.remoteAppEdit(); });
  if (roleSelect) roleSelect.addEventListener('change', function () { window.tool._harness.setRole(roleSelect.value); });
  if (roCheck) roCheck.addEventListener('change', function () { window.tool._harness.setReadOnly(roCheck.checked); });

  if (params.get('sample') === '1' && store.length === 0) {
    seedSample();
    document.body.setAttribute('data-harness-seeded', 'yes');
  }
  document.body.setAttribute('data-harness-initial-store', String(store.length));

  status('Harness ready. ' + (store.length ? store.length + ' entries in the mock store.' : 'No sample loaded.'));

  setTimeout(function () {
    var requestedSection = params.get('section');
    if (requestedSection) {
      var navButton = document.querySelector('.csj-nav[data-section="' + requestedSection + '"]');
      if (navButton) navButton.click();
    }
    if (params.get('job') === '1') {
      var jobButton = document.querySelector('[data-act="open-job"]');
      if (jobButton) jobButton.click();
    }
  }, 1400);

  if (params.get('test') === 'save') {
    setTimeout(function () {
      var input = document.getElementById('csjOrgLegalName');
      if (input) {
        input.value = 'Community Learning Society (edited)';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        status('Test: organization field changed, waiting for autosave.', 'warning');
      }
    }, 1600);
  }

  if (params.get('test') === 'conflict') {
    setTimeout(function () {
      var jobButton = document.querySelector('[data-act="open-job"]');
      if (jobButton) jobButton.click();
    }, 1500);
    setTimeout(function () {
      var titleInput = document.querySelector('[data-drawer-field="jobTitle"]');
      if (titleInput) {
        titleInput.value = titleInput.value + ' (local draft)';
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 1900);
    setTimeout(function () {
      window.tool._harness.remoteJobEdit();
      var refresh = document.getElementById('csjBtnRefresh');
      if (refresh) refresh.click();
      status('Test: remote edit simulated while the drawer is dirty.', 'warning');
    }, 2300);
  }

  if (params.get('test') === 'noc') {
    var nocProbe = { searches: {}, selected: null, editorHeight: 0 };
    function recordNocResults(label) {
      var results = document.querySelectorAll('#csjNocResults .csj-noc-result');
      nocProbe.searches[label] = Array.prototype.map.call(results, function (row) {
        var titleElement = row.querySelector('.csj-noc-result-title');
        return row.getAttribute('data-code') + ' ' + (titleElement ? titleElement.textContent : '');
      });
    }
    function runNocSearch(query) {
      var input = document.getElementById('csjNocSearch');
      if (!input) return;
      input.value = query;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    setTimeout(function () {
      var jobButton = document.querySelector('[data-act="open-job"]');
      if (jobButton) jobButton.click();
    }, 1500);
    setTimeout(function () {
      if (!document.getElementById('csjNocSearch')) {
        var nocToggle = document.querySelector('[data-act="toggle-noc"]');
        if (nocToggle) nocToggle.click();
      }
    }, 1700);
    setTimeout(function () {
      runNocSearch('program assistant');
      recordNocResults('program assistant');
    }, 1900);
    setTimeout(function () {
      var first = document.querySelector('#csjNocResults .csj-noc-result');
      if (first) first.click();
    }, 2100);
    setTimeout(function () {
      var titleInput = document.querySelector('[data-drawer-field="jobTitle"]');
      var codeInput = document.querySelector('[data-drawer-field="nocCode"]');
      var statusElement = document.getElementById('csjNocStatus');
      var editor = document.getElementById('csjJobDescriptionEditor');
      nocProbe.selected = {
        title: titleInput ? titleInput.value : '',
        code: codeInput ? codeInput.value : '',
        status: statusElement ? statusElement.textContent : ''
      };
      nocProbe.editorHeight = editor ? Math.round(editor.getBoundingClientRect().height) : 0;
      runNocSearch('camp counsellor');
      recordNocResults('camp counsellor');
    }, 2400);
    setTimeout(function () {
      runNocSearch('54100');
      recordNocResults('54100');
      var codeInput = document.querySelector('[data-drawer-field="nocCode"]');
      if (codeInput) {
        codeInput.value = '54100';
        codeInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 2900);
    setTimeout(function () {
      var titleInput = document.querySelector('[data-drawer-field="jobTitle"]');
      var codeInput = document.querySelector('[data-drawer-field="nocCode"]');
      var statusElement = document.getElementById('csjNocStatus');
      nocProbe.manualCode = {
        title: titleInput ? titleInput.value : '',
        code: codeInput ? codeInput.value : '',
        status: statusElement ? statusElement.textContent : ''
      };
      var descriptionTab = document.querySelector('.csj-dtab[data-tab="description"]');
      if (descriptionTab) descriptionTab.click();
    }, 3400);
    setTimeout(function () {
      var editor = document.getElementById('csjJobDescriptionEditor');
      nocProbe.editorHeight = editor ? Math.round(editor.getBoundingClientRect().height) : 0;
      document.body.setAttribute('data-noc-test', JSON.stringify(nocProbe));
      status('Test: NOC search probe complete.', 'success');
    }, 3900);
  }

  if (params.get('test') === 'ai') {
    var aiProbe = { enabled: aiEnabled, messages: 0, sessions: 0, sessionMessages: 0, applyFound: false, editorText: '', dirty: '' };
    setTimeout(function () {
      var jobButton = document.querySelector('[data-act="open-job"]');
      if (jobButton) jobButton.click();
    }, 1500);
    setTimeout(function () {
      var descriptionTab = document.querySelector('.csj-dtab[data-tab="description"]');
      if (descriptionTab) descriptionTab.click();
    }, 1900);
    setTimeout(function () {
      var input = document.getElementById('csjAiInput');
      if (input) {
        input.value = 'Draft 6 tasks for this job.';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var send = document.getElementById('csjAiSend');
      if (send) send.click();
    }, 2200);
    setTimeout(function () {
      aiProbe.messages = document.querySelectorAll('#csjAiMessages .csj-ai-msg').length;
      var sessions = store.filter(function (item) { return item.type === 'ai-chat-sessions-uniconbaseapps'; });
      aiProbe.sessions = sessions.length;
      aiProbe.sessionMessages = sessions.length && sessions[0].data.messages ? sessions[0].data.messages.length : 0;
      var apply = document.querySelector('[data-act="ai-apply"][data-mode="replace"]');
      aiProbe.applyFound = !!apply;
      if (apply) apply.click();
    }, 4300);
    setTimeout(function () {
      var editor = document.getElementById('csjJobDescriptionEditor');
      var dirty = document.getElementById('csjDrawerDirty');
      aiProbe.editorText = editor ? editor.innerText : '';
      aiProbe.dirty = dirty ? dirty.textContent : '';
      document.body.setAttribute('data-ai-test', JSON.stringify(aiProbe));
      var aiPanel = document.getElementById('csjAiPanel');
      if (aiPanel && aiPanel.scrollIntoView) aiPanel.scrollIntoView({ block: 'center' });
    }, 4800);
  }

  if (params.get('test') === 'ownership') {
    var ownershipProbe = {};
    function drawerSnapshot() {
      var titleInput = document.querySelector('[data-drawer-field="jobTitle"]');
      var ownerElement = document.getElementById('csjDrawerOwner');
      var saveButton = document.getElementById('csjDrawerSave');
      return {
        owner: ownerElement ? ownerElement.textContent : '',
        titleDisabled: titleInput ? titleInput.disabled : null,
        saveDisabled: saveButton ? saveButton.disabled : null
      };
    }
    setTimeout(function () {
      var jobButton = document.querySelector('[data-act="open-job"]');
      if (jobButton) jobButton.click();
    }, 1500);
    setTimeout(function () {
      ownershipProbe.first = drawerSnapshot();
      var close = document.getElementById('csjDrawerClose');
      if (close) close.click();
    }, 2100);
    setTimeout(function () {
      var jobButtons = document.querySelectorAll('[data-act="open-job"]');
      if (jobButtons[1]) jobButtons[1].click();
    }, 2500);
    setTimeout(function () {
      ownershipProbe.second = drawerSnapshot();
      var branchesNav = document.querySelector('.csj-nav[data-section="branches"]');
      if (branchesNav) branchesNav.click();
    }, 3100);
    setTimeout(function () {
      var addBranch = document.getElementById('csjBtnAddBranch');
      ownershipProbe.addBranchDisabled = addBranch ? addBranch.disabled : null;
      ownershipProbe.branchNavCount = (document.getElementById('csjNavBranches') || {}).textContent || '';
      document.body.setAttribute('data-ownership-test', JSON.stringify(ownershipProbe));
    }, 3500);
  }

  if (params.get('test') === 'admin') {
    var adminProbe = {};
    setTimeout(function () {
      var jobButton = document.querySelector('[data-act="open-job"]');
      if (jobButton) jobButton.click();
    }, 1500);
    setTimeout(function () {
      var prioritiesTab = document.querySelector('.csj-dtab[data-tab="priorities"]');
      if (prioritiesTab) prioritiesTab.click();
    }, 2000);
    setTimeout(function () {
      adminProbe.scoreBefore = (document.querySelector('.csj-score-big') || {}).textContent || '';
      adminProbe.priorityItems = document.querySelectorAll('.csj-priority-score').length;
      var unchecked = document.querySelector('.csj-checks input[type="checkbox"]:not(:checked)');
      if (unchecked) {
        unchecked.checked = true;
        unchecked.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, 2400);
    setTimeout(function () {
      adminProbe.scoreAfter = (document.querySelector('.csj-score-big') || {}).textContent || '';
      adminProbe.priorityItemsAfter = document.querySelectorAll('.csj-priority-score').length;
      var branchesNav = document.querySelector('.csj-nav[data-section="branches"]');
      if (branchesNav) branchesNav.click();
    }, 2900);
    setTimeout(function () {
      adminProbe.nationalChips = document.querySelectorAll('#csjNationalPreview .csj-priority-chip').length;
      adminProbe.branches = document.querySelectorAll('.csj-branch-card').length;
      var addBranch = document.getElementById('csjBtnAddBranch');
      adminProbe.addBranchEnabled = addBranch ? !addBranch.disabled : null;
      if (addBranch) addBranch.click();
    }, 3300);
    setTimeout(function () {
      var nameInput = document.querySelector('[data-modal-field="branchName"]');
      if (nameInput) {
        nameInput.value = 'Test branch';
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var select = document.querySelector('[data-modal-field="constituency"]');
      if (select) {
        var options = Array.prototype.filter.call(select.options, function (option) { return option.value; });
        adminProbe.constituencyOptions = options.length;
        if (options.length) {
          select.value = options[0].value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      var addLocalPriority = document.querySelector('#csjBranchPriorityEditor [data-act="add-priority-item"]');
      if (addLocalPriority) addLocalPriority.click();
      var priorityLabel = document.querySelector('#csjBranchPriorityEditor [data-priority-field="label"]');
      var priorityKeywords = document.querySelector('#csjBranchPriorityEditor [data-priority-field="keywords"]');
      var priorityDescription = document.querySelector('#csjBranchPriorityEditor [data-priority-field="description"]');
      if (priorityLabel) {
        priorityLabel.value = 'Test priority';
        priorityLabel.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (priorityKeywords) {
        priorityKeywords.value = 'test, local, priority';
        priorityKeywords.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (priorityDescription) {
        priorityDescription.value = 'A local test priority.';
        priorityDescription.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var saveBranch = document.querySelector('[data-act="save-branch"]');
      if (saveBranch) saveBranch.click();
    }, 3700);
    setTimeout(function () {
      adminProbe.branchesAfter = document.querySelectorAll('.csj-branch-card').length;
      var branchRecords = store.filter(function (item) { return item.data && item.data.entryType === 'branch'; });
      adminProbe.storeBranches = branchRecords.length;
      adminProbe.lastLocalPriorities = branchRecords.length && Array.isArray(branchRecords[branchRecords.length - 1].data.localPriorities) ? branchRecords[branchRecords.length - 1].data.localPriorities.length : 0;
      document.body.setAttribute('data-admin-test', JSON.stringify(adminProbe));
    }, 4500);
    setTimeout(function () {
      var addNational = document.querySelector('#csjNationalPriorityEditor [data-act="add-priority-item"]');
      if (addNational) addNational.click();
      var nationalLabels = document.querySelectorAll('#csjNationalPriorityEditor [data-priority-field="label"]');
      var nationalKeywords = document.querySelectorAll('#csjNationalPriorityEditor [data-priority-field="keywords"]');
      var lastIndex = nationalLabels.length - 1;
      if (lastIndex >= 0) {
        nationalLabels[lastIndex].value = 'Test national priority';
        nationalLabels[lastIndex].dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (lastIndex >= 0 && nationalKeywords[lastIndex]) {
        nationalKeywords[lastIndex].value = 'test, national';
        nationalKeywords[lastIndex].dispatchEvent(new Event('input', { bubbles: true }));
      }
      var saveNational = document.getElementById('csjBtnSaveNational');
      if (saveNational) saveNational.click();
    }, 5000);
    setTimeout(function () {
      adminProbe.nationalAfter = document.querySelectorAll('#csjNationalPreview .csj-priority-chip').length;
      var appRecords = store.filter(function (item) { return item.data && item.data.entryType === 'application'; });
      adminProbe.storeNational = appRecords.length && Array.isArray(appRecords[0].data.nationalPriorities) ? appRecords[0].data.nationalPriorities.length : 0;
      document.body.setAttribute('data-admin-test', JSON.stringify(adminProbe));
    }, 6000);
  }

  if (params.get('test') === 'editorperms') {
    var editorProbe = {};
    setTimeout(function () {
      var nav = document.querySelector('.csj-nav[data-section="organization"]');
      if (nav) nav.click();
    }, 1500);
    setTimeout(function () {
      editorProbe.orgDisabled = (document.getElementById('csjOrgLegalName') || {}).disabled;
      var nav = document.querySelector('.csj-nav[data-section="documents"]');
      if (nav) nav.click();
    }, 1900);
    setTimeout(function () {
      var upload = document.querySelector('[data-act="upload-doc"]');
      editorProbe.uploadDisabled = upload ? upload.disabled : null;
      var nav = document.querySelector('.csj-nav[data-section="branches"]');
      if (nav) nav.click();
    }, 2300);
    setTimeout(function () {
      var national = document.querySelector('#csjNationalPriorityEditor [data-priority-field="label"]');
      var addBranch = document.getElementById('csjBtnAddBranch');
      editorProbe.nationalDisabled = national ? national.disabled : null;
      editorProbe.nationalEditorRows = document.querySelectorAll('#csjNationalPriorityEditor .csj-priority-item').length;
      editorProbe.addBranchDisabled = addBranch ? addBranch.disabled : null;
      editorProbe.branchCards = document.querySelectorAll('.csj-branch-card').length;
      var nav = document.querySelector('.csj-nav[data-section="jobs"]');
      if (nav) nav.click();
    }, 2700);
    setTimeout(function () {
      var addJob = document.getElementById('csjBtnAddJob');
      editorProbe.addJobEnabled = addJob ? !addJob.disabled : null;
      if (addJob) addJob.click();
    }, 3100);
    setTimeout(function () {
      var titleInput = document.querySelector('[data-drawer-field="jobTitle"]');
      if (titleInput) {
        titleInput.value = 'Editor created job';
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var save = document.getElementById('csjDrawerSave');
      if (save) save.click();
    }, 3500);
    setTimeout(function () {
      var jobRecords = store.filter(function (item) { return item.data && item.data.entryType === 'job'; });
      editorProbe.jobs = jobRecords.length;
      editorProbe.lastJobOwner = jobRecords.length ? jobRecords[jobRecords.length - 1].data.ownerUserId : '';
      document.body.setAttribute('data-editor-test', JSON.stringify(editorProbe));
    }, 4400);
  }

  if (params.get('test') === 'aiscore') {
    var aiScoreProbe = {};
    setTimeout(function () {
      var jobButton = document.querySelector('[data-act="open-job"]');
      if (jobButton) jobButton.click();
    }, 1500);
    setTimeout(function () {
      var prioritiesTab = document.querySelector('.csj-dtab[data-tab="priorities"]');
      if (prioritiesTab) prioritiesTab.click();
    }, 2000);
    setTimeout(function () {
      var button = document.querySelector('[data-act="ai-score-job"]');
      aiScoreProbe.buttonFound = !!button;
      if (button) button.click();
    }, 2500);
    setTimeout(function () {
      var body = document.getElementById('csjModalBody');
      aiScoreProbe.modalText = body ? body.textContent : '';
      document.body.setAttribute('data-ai-score-test', JSON.stringify(aiScoreProbe));
    }, 3400);
  }

  if (params.get('probe') === 'mobile') {
    setTimeout(function () {
      var offenders = [];
      Array.prototype.forEach.call(document.querySelectorAll('body *'), function (element) {
        var rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.right > window.innerWidth + 1) {
          var scroller = element.parentElement;
          while (scroller && scroller !== document.body) {
            var overflowX = getComputedStyle(scroller).overflowX;
            if (overflowX === 'auto' || overflowX === 'scroll') return;
            scroller = scroller.parentElement;
          }
          offenders.push((element.className || element.tagName) + ' right=' + Math.round(rect.right));
        }
      });
      document.body.setAttribute('data-mobile-probe', JSON.stringify({
        innerWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: Math.round(document.body.getBoundingClientRect().width),
        offenders: offenders.slice(0, 12)
      }));
    }, 2600);
  }

  /* Load the tool JS as an external file, or as an INLINE script for tokenizer checks. */
  if (params.get('inlinejs') === '1') {
    fetch('CSJGrantApplication.js?t=' + Date.now())
      .then(function (response) { return response.text(); })
      .then(function (code) {
        var script = document.createElement('script');
        script.textContent = code;
        document.body.appendChild(script);
        status('Inline JS mode: tool JS injected as an inline script.', 'success');
      })
      .catch(function (error) {
        status('Inline JS mode needs an HTTP server: ' + error.message, 'error');
      });
  } else {
    var script = document.createElement('script');
    script.src = 'CSJGrantApplication.js';
    script.onload = function () { status('Tool JS loaded.'); };
    script.onerror = function () { status('Tool JS could not be loaded.', 'error'); };
    document.body.appendChild(script);
  }
})();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(appDir, 'test-harness.html'), template.replace('<!-- TOOL_HTML -->', toolHtml), 'utf8');
console.log('test-harness.html rebuilt from CSJGrantApplication.html');
