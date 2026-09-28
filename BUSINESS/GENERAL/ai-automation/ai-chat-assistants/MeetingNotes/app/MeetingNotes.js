// ── Meeting Notes - meeting minutes tool for the UniconHub CMS html-tool system ──
// Class prefix mtn-. Everything is stored in tool.setValue() (no requestObjects).
// Value shape:
//   { version, meeting{title,date,timestart,timeend,location,chair,minutetaker,attendees},
//     subjects[{id,title,notes,decisions[{id,text}]}],
//     tasks[{id,text,assignee,dueDate,priority,status,source}],
//     rawnotes, ai{summary,minutesDraft} }
(function () {
  'use strict'

  // ── small helpers ──
  function byId(id) { return document.getElementById(id) }
  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }
  function nl2br(text) { return esc(text).replace(/\n/g, '<br>') }
  function uid() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }
  function todayIso() {
    var d = new Date()
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  }
  function validIso(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) }
  function clampText(value, max) { return String(value == null ? '' : value).slice(0, max) }
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  function fmtDate(iso) {
    if (!validIso(iso)) return ''
    var parts = iso.split('-')
    var day = parseInt(parts[2], 10)
    var month = MONTHS_SHORT[parseInt(parts[1], 10) - 1]
    return day + ' ' + month + ' ' + parts[0]
  }
  // Turkish-aware slugification: strip combining marks before transliteration
  // so dotted I does not turn into "i-" artifacts, and map the remaining
  // Turkish-only letters (dotless i included).
  function slugify(text) {
    var normalized = String(text || '').normalize ? String(text || '').normalize('NFKD') : String(text || '')
    var stripped = normalized.replace(/[\u0300-\u036f]/g, '')
    var trMap = {
      '\u00e7': 'c', '\u00c7': 'c',
      '\u011f': 'g', '\u011e': 'g',
      '\u0131': 'i', '\u0130': 'i',
      '\u00f6': 'o', '\u00d6': 'o',
      '\u015f': 's', '\u015e': 's',
      '\u00fc': 'u', '\u00dc': 'u'
    }
    var transliterated = stripped.replace(/[\u00e7\u00c7\u011f\u011e\u0131\u0130\u00f6\u00d6\u015f\u015e\u00fc\u00dc]/g, function (ch) { return trMap[ch] })
    return transliterated
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'meeting-notes'
  }

  var PRIORITIES = ['low', 'medium', 'high']
  var TASK_STATUSES = ['open', 'inProgress', 'done']
  var STATUS_LABELS = { open: 'Open', inProgress: 'In Progress', done: 'Done' }
  var PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High' }
  var RAWNOTES_MAX = 100000
  var SUMMARY_MAX = 20000
  var DRAFT_MAX = 30000
  var NOTES_HTML_MAX = 30000

  // ── rich-text notes helpers ──
  var ALLOWED_NOTES_TAGS = { p: 1, div: 1, br: 1, h2: 1, h3: 1, h4: 1, ul: 1, ol: 1, li: 1, b: 1, strong: 1, i: 1, em: 1, u: 1, span: 1, blockquote: 1, font: 1 }
  function sanitizeNotesHtml(htmlText) {
    var out = String(htmlText || '')
    out = out
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'\s>]*\2/gi, '')
    // unwrap tags that are not whitelisted (keep their text)
    out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)(?:\s[^>]*)?>/g, function (match, tagName) {
      return ALLOWED_NOTES_TAGS[tagName.toLowerCase()] ? match : ''
    })
    // strip attributes from whitelisted tags except span/style and font/color
    out = out.replace(/<([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?>/g, function (match, tagName, attrs) {
      var lower = tagName.toLowerCase()
      attrs = attrs || ''
      if (lower === 'span') {
        var styleMatch = attrs.match(/\sstyle\s*=\s*("[^"]*"|'[^']*')/i)
        return '<span' + (styleMatch ? styleMatch[0] : '') + '>'
      }
      if (lower === 'font') {
        var colorMatch = attrs.match(/\scolor\s*=\s*("[^"]*"|'[^']*')/i)
        return '<font' + (colorMatch ? colorMatch[0] : '') + '>'
      }
      return '<' + lower + '>'
    })
    return out.slice(0, NOTES_HTML_MAX)
  }

  function htmlToPlainText(htmlText) {
    var text = String(htmlText || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|ul|ol|blockquote)>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n\u2022 ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
    text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\n+$/, '')
    return text.slice(0, 20000)
  }

  function plainTextToNotesHtml(text) {
    return String(text || '').split('\n').map(function (line) {
      var trimmed = line.trim()
      return trimmed ? '<p>' + esc(trimmed) + '</p>' : ''
    }).join('')
  }

  // ── state ──
  var DB = defaultDatabase()
  var _ui = { tab: 'subjects', taskStatusFilter: 'all', taskPriorityFilter: 'all', taskSearch: '', collapsed: {}, decisionExpanded: {}, projScale: 1, projDecisionsSide: true, projSideCollapsed: false, editingSubjectId: '' }
  var _aiBusy = {}
  var _aiExtracted = null
  var _readOnly = false
  var _user = null
  var _noIdentity = false
  var _permittedUsers = []
  var _persistTimer = null
  var _lastStagedJson = ''
  var _warnedAutosave = false

  // ── permitted users (object ACL from the CMS) → assignee dropdowns ──
  function loadPermittedUsers() {
    try {
      if (typeof tool.getPermittedUsers === 'function') {
        var users = tool.getPermittedUsers()
        _permittedUsers = Array.isArray(users) ? users : []
      }
    } catch (e) { _permittedUsers = [] }
  }
  function assigneeOptionsHtml(selectedName) {
    var options = '<option value="">- No assignee -</option>'
    for (var i = 0; i < _permittedUsers.length; i++) {
      var user = _permittedUsers[i]
      var name = user && user.name ? user.name : ''
      if (!name) continue
      options += '<option value="' + esc(name) + '"' + (selectedName === name ? ' selected' : '') + '>' + esc(name) + '</option>'
    }
    return options
  }
  function assigneeFieldHtml(selectedName, attrs) {
    if (!_permittedUsers.length) {
      // fallback: free text input when the CMS gives no permitted users
      return '<input class="mtn-input" value="' + esc(selectedName || '') + '" placeholder="Assign someone" maxlength="80"' + attrs + ' />'
    }
    return '<select class="mtn-input"' + attrs + '>' + assigneeOptionsHtml(selectedName) + '</select>'
  }
  function applyAssigneePickers() {
    if (!_permittedUsers.length) return
    var newAssignee = byId('mtn-task-new-assignee')
    if (newAssignee && typeof newAssignee.outerHTML === 'string' && newAssignee.tagName !== 'SELECT') {
      try {
        newAssignee.outerHTML = '<select class="mtn-input" id="mtn-task-new-assignee">' + assigneeOptionsHtml(newAssignee.value || '') + '</select>'
      } catch (e) { /* no-op */ }
    }
  }

  function defaultDatabase() {
    return {
      version: '1.1.0',
      meeting: { title: '', date: '', timestart: '', timeend: '', location: '', chair: '', minutetaker: '', attendees: '', waitingMs: 0 },
      subjects: [],
      tasks: [],
      rawnotes: '',
      ai: { summary: '', minutesDraft: '' }
    }
  }

  function normalizeSubject(subject) {
    if (!subject || typeof subject !== 'object') return null
    var decisions = Array.isArray(subject.decisions)
      ? subject.decisions.map(function (d) {
          return d && typeof d === 'object' && d.text
            ? {
                id: d.id || uid(),
                text: clampText(d.text, 500),
                movedBy: clampText(d.movedBy, 80),
                secondedBy: clampText(d.secondedBy, 80)
              }
            : null
        }).filter(Boolean)
      : []
    var durationMinutes = parseInt(subject.durationMinutes, 10)
    if (isNaN(durationMinutes) || durationMinutes < 1) durationMinutes = 15 // 15 min is the default for every subject
    if (durationMinutes > 480) durationMinutes = 480
    var spentMs = parseInt(subject.spentMs, 10)
    if (isNaN(spentMs) || spentMs < 0) spentMs = 0
    if (spentMs > 86400000) spentMs = 86400000
    return {
      id: subject.id || uid(),
      title: clampText(subject.title, 160),
      notes: clampText(subject.notes, 20000),
      notesHtml: subject.notesHtml ? sanitizeNotesHtml(subject.notesHtml) : plainTextToNotesHtml(clampText(subject.notes, 20000)),
      status: subject.status === 'done' ? 'done' : 'open',
      durationMinutes: durationMinutes,
      spentMs: spentMs,
      decisions: decisions
    }
  }

  function normalizeTask(task) {
    if (!task || typeof task !== 'object' || !task.text) return null
    return {
      id: task.id || uid(),
      text: clampText(task.text, 240),
      assignee: clampText(task.assignee, 80),
      dueDate: validIso(task.dueDate) ? task.dueDate : '',
      priority: PRIORITIES.indexOf(task.priority) !== -1 ? task.priority : 'medium',
      status: TASK_STATUSES.indexOf(task.status) !== -1 ? task.status : 'open',
      source: task.source === 'ai' ? 'ai' : 'manual',
      subjectId: clampText(task.subjectId, 100)
    }
  }

  function normalizeDatabase(value) {
    var database = defaultDatabase()
    if (value && typeof value === 'object') {
      database.version = value.version || database.version
      if (value.meeting && typeof value.meeting === 'object') {
        var m = value.meeting
        database.meeting.title = clampText(m.title, 160)
        database.meeting.date = validIso(m.date) ? m.date : ''
        database.meeting.timestart = clampText(m.timestart, 8)
        database.meeting.timeend = clampText(m.timeend, 8)
        database.meeting.location = clampText(m.location, 120)
        database.meeting.chair = clampText(m.chair, 120)
        database.meeting.minutetaker = clampText(m.minutetaker, 120)
        database.meeting.attendees = clampText(m.attendees, 2000)
        var waitingMs = parseInt(m.waitingMs, 10)
        if (isNaN(waitingMs) || waitingMs < 0) waitingMs = 0
        if (waitingMs > 86400000) waitingMs = 86400000
        database.meeting.waitingMs = waitingMs
      }
      var legacyItemTasks = []
      if (Array.isArray(value.subjects)) {
        database.subjects = value.subjects.map(function (subject) {
          var normalized = normalizeSubject(subject)
          if (normalized && Array.isArray(subject.items) && subject.items.length) {
            subject.items.forEach(function (item) {
              if (!item || typeof item !== 'object' || !item.text) return
              legacyItemTasks.push({
                id: uid(),
                text: clampText(item.text, 240),
                assignee: '',
                dueDate: '',
                priority: 'medium',
                status: item.status === 'done' ? 'done' : 'open',
                source: 'manual',
                subjectId: normalized.id
              })
            })
          }
          return normalized
        }).filter(Boolean)
      }
      if (Array.isArray(value.tasks)) {
        database.tasks = value.tasks.map(normalizeTask).filter(Boolean)
      }
      if (legacyItemTasks.length) database.tasks = database.tasks.concat(legacyItemTasks)
      database.rawnotes = clampText(value.rawnotes, RAWNOTES_MAX)
      if (value.ai && typeof value.ai === 'object') {
        database.ai.summary = clampText(value.ai.summary, SUMMARY_MAX)
        database.ai.minutesDraft = clampText(value.ai.minutesDraft, DRAFT_MAX)
      }
    }
    return database
  }

  // ── params + identity ──
  function paramOr(name, fallback) {
    try { return tool.param ? tool.param(name, fallback) : fallback } catch (e) { return fallback }
  }
  function allowAi() { return paramOr('allowAi', '') === 'yes' }
  function allowExportPdf() { return paramOr('allowExportPdf', '') === 'yes' }
  function allowRequestSave() { return paramOr('allowRequestSave', '') === 'yes' }
  function boardName() { return paramOr('boardName', '') }
  function aiLanguage() { return paramOr('aiLanguage', 'English') }

  function getUserSafe() {
    try { return (typeof tool.getUser === 'function') ? tool.getUser() : null } catch (e) { return null }
  }
  function getRoles() {
    if (!_user) return []
    var roles = Array.isArray(_user.roles) ? _user.roles.slice() : []
    var access = _user.effectiveAccess
    if (access) {
      if (access.isViewer) roles.push('viewer')
      if (access.isEditor) roles.push('editor')
      if (access.isManager) roles.push('admin')
    }
    return roles
  }
  function canWrite() {
    if (_readOnly) return false
    if (_noIdentity) return true
    if (!_user) return false
    var roles = getRoles()
    var roleNames = ['admin', 'editor', 'owner', 'developer', 'user-manager']
    for (var i = 0; i < roleNames.length; i++) {
      if (roles.indexOf(roleNames[i]) !== -1) return true
    }
    return false
  }

  function pollIdentity() {
    var delays = [400, 1200, 2600, 5000]
    var step = 0
    function tick() {
      if (_user) return
      _user = getUserSafe()
      if (!_user || !getRoles().length) {
        if (step < delays.length) {
          setTimeout(tick, delays[step])
          step++
        } else {
          _noIdentity = true
          applyReadOnlyState()
        }
      } else {
        applyReadOnlyState()
      }
    }
    tick()
  }

  // ── persistence ──
  function persistSoon() {
    clearTimeout(_persistTimer)
    _persistTimer = setTimeout(flushPendingSave, 400)
  }
  function flushPendingSave() {
    var json = JSON.stringify(DB)
    if (json === _lastStagedJson) return
    _lastStagedJson = json
    try { tool.setValue(JSON.parse(json)) } catch (e) { return }
    requestParentSave()
  }
  function requestParentSave() {
    if (!allowRequestSave()) {
      if (!_warnedAutosave) {
        _warnedAutosave = true
        tryNotify('Auto-save note: changes are staged - the parent form Save button commits them. Set allowRequestSave: yes for instant saves.', 'info')
      }
      return
    }
    if (typeof tool.requestSave !== 'function') return
    tool.requestSave(function (err, ok) {
      if (err || !ok) {
        if (!_warnedAutosave) {
          _warnedAutosave = true
          tryNotify('Auto-save was denied by the form. Use the parent Save button.', 'warning')
        }
      }
    })
  }
  function tryNotify(message, severity) {
    try { tool.notify(message, severity) } catch (e) { /* host without notify */ }
  }

  // ── AI response parsing ──
  function stripFences(text) {
    return String(text || '').replace(/^```[a-zA-Z]*\s*[\r\n]+/, '').replace(/[\r\n]+```\s*$/, '').replace(/```/g, '')
  }
  function parseAiJsonArray(text) {
    var cleaned = stripFences(text)
    var start = cleaned.indexOf('[')
    var end = cleaned.lastIndexOf(']')
    if (start === -1 || end === -1 || end <= start) return []
    var body = cleaned.slice(start, end + 1)
    body = body.replace(/,\s*([\]}])/g, '$1') // trailing commas
    try {
      var parsed = JSON.parse(body)
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      return []
    }
  }

  // ── small data queries ──
  function subjectById(id) {
    for (var i = 0; i < DB.subjects.length; i++) {
      if (DB.subjects[i].id === id) return DB.subjects[i]
    }
    return null
  }
  function decisionCount() {
    var count = 0
    DB.subjects.forEach(function (s) { count += s.decisions.length })
    return count
  }
  function taskCounts() {
    var counts = { total: DB.tasks.length, open: 0, inProgress: 0, done: 0 }
    DB.tasks.forEach(function (t) {
      if (t.status === 'open') counts.open++
      else if (t.status === 'inProgress') counts.inProgress++
      else if (t.status === 'done') counts.done++
    })
    return counts
  }
  function meetingTitleOf() { return DB.meeting.title || 'Untitled Meeting' }
  function totalSpentMs() {
    var total = 0
    for (var i = 0; i < DB.subjects.length; i++) total += DB.subjects[i].spentMs || 0
    return total
  }

  // ── rendering: meeting pane ──
  function renderMeetingMeta() {
    var counts = taskCounts()
    byId('mtn-meet-meta').textContent = DB.subjects.length + ' subject' + (DB.subjects.length === 1 ? '' : 's') +
      ' - ' + decisionCount() + ' decision' + (decisionCount() === 1 ? '' : 's') +
      ' - ' + counts.open + ' open task' + (counts.open === 1 ? '' : 's')
    var subjectsMeta = byId('mtn-subjects-meta')
    if (subjectsMeta) {
      subjectsMeta.textContent = DB.subjects.length + ' subject' + (DB.subjects.length === 1 ? '' : 's') +
        ' - ' + decisionCount() + ' decision' + (decisionCount() === 1 ? '' : 's') +
        ' - ' + fmtClockLong(totalSpentMs()) + ' total time' +
        ((DB.meeting.waitingMs || 0) > 0 ? ' - ' + fmtClockLong(DB.meeting.waitingMs) + ' break' : '')
    }
  }

  function subjectCardHtml(subject, index) {
    var collapsed = !!_ui.collapsed[subject.id]
    var durationLabel = subject.durationMinutes > 0
      ? '<span class="mtn-subject-duration">' + subject.durationMinutes + ' min planned</span>'
      : ''
    var spentLabel = '<span class="mtn-subject-spent">\u23f1 ' + fmtClock(subject.spentMs || 0) + ' spent \u00b7 ' + subjectTimePercent(subject) + '%</span>'
    var chips = durationLabel + spentLabel
    if (canWrite() && _ui.editingSubjectId === subject.id) {
      return subjectEditCardHtml(subject, index, collapsed, chips)
    }
    return subjectReadCardHtml(subject, index, collapsed, chips)
  }

  // professional reading view: an agenda-style card with styled notes + resolutions
  function subjectReadCardHtml(subject, index, collapsed, durationLabel) {
    var title = subject.title.trim() || 'Untitled subject'
    var notesContent = subject.notesHtml
      ? '<div class="mtn-subject-notes-read">' + subject.notesHtml + '</div>'
      : '<div class="mtn-subject-notes-empty">No notes recorded for this subject yet.</div>'
    var decisionRows = subject.decisions.map(function (d, i) {
      var metaParts = []
      if (d.movedBy) metaParts.push('Moved by <b>' + esc(d.movedBy) + '</b>')
      if (d.secondedBy) metaParts.push('Seconded by <b>' + esc(d.secondedBy) + '</b>')
      return '<div class="mtn-decision-read">' +
        '<span class="mtn-decision-read-num">' + (i + 1) + '.</span>' +
        '<div class="mtn-decision-read-body">' +
        '<div class="mtn-decision-read-text">' + esc(d.text) + '</div>' +
        (metaParts.length ? '<div class="mtn-decision-read-meta">' + metaParts.join(' - ') + '</div>' : '') +
        '</div>' +
        '</div>'
    }).join('')
    var decisionsContent = '<div class="mtn-decisions-label">Decisions</div>' +
      (decisionRows || '<div class="mtn-subject-notes-empty">No decisions recorded.</div>')
    return '<div class="mtn-card mtn-subject mtn-subject-read' +
      (collapsed ? ' mtn-subject-collapsed' : '') +
      (subject.status === 'done' ? ' mtn-subject-done' : '') +
      '" data-subject-id="' + esc(subject.id) + '">' +
      '<div class="mtn-subject-head">' +
      '<button type="button" class="mtn-icon-btn" title="Collapse / expand" data-act="subject-collapse" data-subject-id="' + esc(subject.id) + '">' + (collapsed ? '+' : '-') + '</button>' +
      '<span class="mtn-subj-status' + (subject.status === 'done' ? ' done' : '') + '">' + (subject.status === 'done' ? '\u2713 Done' : 'Open') + '</span>' +
      '<span class="mtn-subject-num">' + (index + 1) + '</span>' +
      '<span class="mtn-subject-title-read">' + esc(title) + '</span>' +
      durationLabel +
      (canWrite()
        ? '<button type="button" class="mtn-btn mtn-btn-soft mtn-subject-edit-btn" data-act="subject-edit" data-subject-id="' + esc(subject.id) + '">Edit</button>'
        : '') +
      '</div>' +
      '<div class="mtn-subject-body">' + notesContent + decisionsContent + '</div>' +
      '</div>'
  }

  // edit view: the previous card with inputs, move/delete and a Done button
  function subjectEditCardHtml(subject, index, collapsed, durationLabel) {
    var disabled = canWrite() ? '' : ' disabled'
    var decisions = subject.decisions.map(function (d) {
      var expanded = !!_ui.decisionExpanded[d.id]
      var metaParts = []
      if (d.movedBy) metaParts.push('<b>Moved by</b> ' + esc(d.movedBy))
      if (d.secondedBy) metaParts.push('<b>Seconded by</b> ' + esc(d.secondedBy))
      var html = '<div class="mtn-decision-row">' +
        '<input class="mtn-input" value="' + esc(d.text) + '" placeholder="Decision or resolution..." maxlength="500" data-field="decision.text" data-subject-id="' + esc(subject.id) + '" data-decision-id="' + esc(d.id) + '"' + disabled + ' />' +
        (canWrite()
          ? '<button type="button" class="mtn-icon-btn" title="Motion and second (optional)" data-act="decision-expand" data-subject-id="' + esc(subject.id) + '" data-decision-id="' + esc(d.id) + '">' + (expanded ? '-' : '+') + '</button>'
          : '') +
        '<button type="button" class="mtn-icon-btn danger" title="Remove decision" data-act="decision-remove" data-subject-id="' + esc(subject.id) + '" data-decision-id="' + esc(d.id) + '"' + (canWrite() ? '' : ' style="display:none"') + '>x</button>' +
        '</div>'
      if (metaParts.length) html += '<div class="mtn-decision-meta">' + metaParts.join(' - ') + '</div>'
      if (expanded) {
        html += '<div class="mtn-decision-extra">' +
          '<div class="mtn-field"><label class="mtn-label">Moved by (optional)</label><input class="mtn-input" value="' + esc(d.movedBy) + '" placeholder="Who made the motion" maxlength="80" data-field="decision.moved" data-subject-id="' + esc(subject.id) + '" data-decision-id="' + esc(d.id) + '"' + disabled + ' /></div>' +
          '<div class="mtn-field"><label class="mtn-label">Seconded by (optional)</label><input class="mtn-input" value="' + esc(d.secondedBy) + '" placeholder="Who seconded it" maxlength="80" data-field="decision.second" data-subject-id="' + esc(subject.id) + '" data-decision-id="' + esc(d.id) + '"' + disabled + ' /></div>' +
          '</div>'
      }
      return html
    }).join('')
    var decisionHtml = '<div class="mtn-decisions-label">Decisions</div>' + decisions +
      (canWrite() ? '<button type="button" class="mtn-btn mtn-btn-soft" data-act="add-decision" data-subject-id="' + esc(subject.id) + '">+ Add decision</button>' : '')

    return '<div class="mtn-card mtn-subject mtn-subject-edit' + (collapsed ? ' mtn-subject-collapsed' : '') + (subject.status === 'done' ? ' mtn-subject-done' : '') + '" data-subject-id="' + esc(subject.id) + '">' +
      '<div class="mtn-subject-head">' +
      '<button type="button" class="mtn-icon-btn" title="Collapse / expand" data-act="subject-collapse" data-subject-id="' + esc(subject.id) + '">' + (collapsed ? '+' : '-') + '</button>' +
      (canWrite()
        ? '<button type="button" class="mtn-subj-status' + (subject.status === 'done' ? ' done' : '') + '" title="Click to mark this subject done / reopen" data-act="subject-status-cycle" data-subject-id="' + esc(subject.id) + '">' + (subject.status === 'done' ? '\u2713 Done' : 'Open') + '</button>'
        : (subject.status === 'done' ? '<span class="mtn-subj-status done">\u2713 Done</span>' : '')) +
      '<span class="mtn-subject-num">' + (index + 1) + '</span>' +
      '<input class="mtn-input mtn-subject-title" value="' + esc(subject.title) + '" placeholder="Subject title" maxlength="160" data-field="subject.title" data-subject-id="' + esc(subject.id) + '"' + disabled + ' />' +
      durationLabel +
      (canWrite()
        ? '<button type="button" class="mtn-icon-btn" title="Move up" data-act="subject-up" data-subject-id="' + esc(subject.id) + '">&#8593;</button>' +
          '<button type="button" class="mtn-icon-btn" title="Move down" data-act="subject-down" data-subject-id="' + esc(subject.id) + '">&#8595;</button>' +
          '<button type="button" class="mtn-icon-btn danger" title="Delete subject" data-act="subject-delete" data-subject-id="' + esc(subject.id) + '">x</button>' +
          '<button type="button" class="mtn-btn mtn-btn-primary mtn-subject-done-btn" data-act="subject-edit-close" data-subject-id="' + esc(subject.id) + '">Done</button>'
        : '') +
      '</div>' +
      '<div class="mtn-subject-body">' +
      '<textarea class="mtn-textarea mtn-subject-notes" rows="5" placeholder="Notes for this subject..." data-field="subject.notes" data-subject-id="' + esc(subject.id) + '"' + disabled + '>' + esc(subject.notes) + '</textarea>' +
      decisionHtml +
      '</div>' +
      '</div>'
  }

  function renderSubjects() {
    var container = byId('mtn-subjects')
    if (!DB.subjects.length) {
      container.innerHTML = '<div class="mtn-subject-empty">No subjects yet. Add the first subject, then write notes under each one subject by subject.</div>'
      return
    }
    container.innerHTML = DB.subjects.map(subjectCardHtml).join('')
  }

  // ── projection drawer (big text for meeting-room screens) ──
  var _projectionOpen = false
  var _projectionIndex = 0
  var _projectionWaiting = false
  var _lastTickAt = 0

  function clampProjectionIndex() {
    if (!DB.subjects.length) {
      _projectionIndex = 0
    } else if (_projectionIndex < 0) {
      _projectionIndex = 0
    } else if (_projectionIndex >= DB.subjects.length) {
      _projectionIndex = DB.subjects.length - 1
    }
  }
  function openProjection(subjectId) {
    _projectionOpen = true
    _projectionWaiting = false
    _lastTickAt = Date.now()
    if (subjectId) {
      for (var i = 0; i < DB.subjects.length; i++) {
        if (DB.subjects[i].id === subjectId) { _projectionIndex = i; break }
      }
    }
    clampProjectionIndex()
    byId('mtn-projection').classList.add('open')
    byId('mtn-projection').classList.toggle('side-collapsed', !!_ui.projSideCollapsed)
    renderProjection()
    try { tool.resize() } catch (e) { /* no-op */ }
  }
  function updateSideToggleButton() {
    var button = byId('mtn-project-side-toggle')
    if (button) button.textContent = _ui.projSideCollapsed ? '\u25b6 Subjects' : '\u25c0 Subjects'
  }
  function closeProjection() {
    settleProjectionTime()
    _projectionOpen = false
    byId('mtn-projection').classList.remove('open')
  }
  function stepProjection(direction) {
    if (!DB.subjects.length) return
    settleProjectionTime()
    _projectionWaiting = false
    _projectionIndex += direction
    clampProjectionIndex()
    renderProjection()
  }
  function selectWaiting() {
    if (!_projectionOpen) return
    settleProjectionTime()
    _projectionWaiting = true
    renderProjectionNav()
    renderProjectionBody()
  }
  function changeProjectionScale(delta) {
    var next = Math.round((_ui.projScale + delta) * 100) / 100
    if (next < 0.75) next = 0.75
    if (next > 2.25) next = 2.25
    _ui.projScale = next
    renderProjection()
  }
  function renderProjectionNav() {
    if (!_projectionOpen) return
    var nav = byId('mtn-project-nav')
    var counter = byId('mtn-project-counter')
    var totalEl = byId('mtn-proj-total-spent')
    if (nav) {
      var subjectChips = DB.subjects.map(function (s, i) {
        var isDone = s.status === 'done'
        var doneToggle = canWrite()
          ? '<button type="button" class="mtn-chip-done' + (isDone ? ' done' : '') + '" data-act="proj-done-toggle" data-index="' + i + '" title="' + (isDone ? 'Reopen this subject' : 'Mark this subject done') + '">' + (isDone ? '\u2713' : '\u25cb') + '</button>'
          : (isDone ? '<span class="mtn-chip-done done">\u2713</span>' : '')
        return '<div class="mtn-project-chip' + (!_projectionWaiting && i === _projectionIndex ? ' active' : '') + '">' +
          doneToggle +
          '<div class="mtn-chip-body">' +
          '<button type="button" class="mtn-project-chip-main" data-act="project-jump" data-index="' + i + '">' + (i + 1) + '. ' + esc(s.title || '(untitled)') + '</button>' +
          '<span class="mtn-chip-time">' + subjectTimeLabel(s) + '</span>' +
          '</div>' +
          '</div>'
      }).join('')
      var waitingChip = '<div class="mtn-waiting-sep"></div>' +
        '<div class="mtn-project-chip mtn-waiting-chip' + (_projectionWaiting ? ' active' : '') + '">' +
        '<button type="button" class="mtn-project-chip-main" data-act="project-waiting" title="Count this time as a break - subject time pauses">\u2615 Waiting / break</button>' +
        '<span class="mtn-waiting-chip-time" id="mtn-waiting-chip-time">' + fmtClock(DB.meeting.waitingMs || 0) + '</span>' +
        '</div>'
      nav.innerHTML = subjectChips + waitingChip
      var activeChip = nav.querySelector ? nav.querySelector('.mtn-project-chip.active') : null
      if (activeChip && activeChip.scrollIntoView) activeChip.scrollIntoView({ block: 'nearest' })
    }
    if (counter) counter.textContent = _projectionWaiting ? 'Break' : (DB.subjects.length ? (_projectionIndex + 1) + ' / ' + DB.subjects.length : '0 / 0')
    if (totalEl) totalEl.textContent = 'Total ' + fmtClock(totalSpentMs())
  }
  // live-refresh the planned/spent/% labels on the sidebar chips each tick
  function renderChipTimes() {
    if (!_projectionOpen) return
    var nav = byId('mtn-project-nav')
    if (!nav || !nav.querySelectorAll) return
    var chips = nav.querySelectorAll('.mtn-chip-time')
    for (var i = 0; i < chips.length && i < DB.subjects.length; i++) {
      chips[i].textContent = subjectTimeLabel(DB.subjects[i])
    }
  }

  function waitingScreenHtml() {
    return '<div class="mtn-waiting-screen">' +
      '<div class="mtn-waiting-icon">\u2615</div>' +
      '<div class="mtn-waiting-label">Waiting / break</div>' +
      '<div class="mtn-waiting-time" id="mtn-waiting-time">' + fmtClock(DB.meeting.waitingMs || 0) + '</div>' +
      '</div>'
  }
  function renderWaitingDisplay() {
    var timeEl = byId('mtn-waiting-time')
    var chipEl = byId('mtn-waiting-chip-time')
    var text = fmtClock(DB.meeting.waitingMs || 0)
    if (timeEl) timeEl.textContent = text
    if (chipEl) chipEl.textContent = text
  }

  var EDITOR_COLOR_SWATCHES = [
    { color: '#0f172a', title: 'Dark text' },
    { color: '#dc2626', title: 'Red text' },
    { color: '#15803d', title: 'Green text' },
    { color: '#1d4ed8', title: 'Blue text' },
    { color: '#d97706', title: 'Amber text' },
    { color: '#7c3aed', title: 'Purple text' }
  ]

  // The projected body is EDITABLE - the minute taker writes here and
  // everyone on the room screen sees the changes live.
  function renderProjectionBody() {
    if (!_projectionOpen) return
    var body = byId('mtn-project-body')
    if (!body) return
    body.style.setProperty('--proj-scale', String(_ui.projScale))
    if (_projectionWaiting) {
      body.innerHTML = waitingScreenHtml()
      return
    }
    if (!DB.subjects.length) {
      body.innerHTML = '<div class="mtn-proj-empty">No subjects yet - add subjects first, then open Meeting Mode.</div>'
      return
    }
    clampProjectionIndex()
    var s = DB.subjects[_projectionIndex]
    var disabled = canWrite() ? '' : ' disabled'
    var layoutSide = _ui.projDecisionsSide !== false
    var decisions = s.decisions.map(function (d) {
      var metaParts = []
      if (d.movedBy) metaParts.push('<b>Moved by</b> ' + esc(d.movedBy))
      if (d.secondedBy) metaParts.push('<b>Seconded by</b> ' + esc(d.secondedBy))
      return '<div class="mtn-proj-decision">' +
        '<input class="mtn-proj-decision-input" value="' + esc(d.text) + '" placeholder="Decision or resolution..." maxlength="500" data-field="decision.text" data-subject-id="' + esc(s.id) + '" data-decision-id="' + esc(d.id) + '"' + disabled + ' />' +
        (metaParts.length ? '<div class="mtn-proj-decision-meta">' + metaParts.join(' - ') + '</div>' : '') +
        '</div>'
    }).join('')
    var swatches = EDITOR_COLOR_SWATCHES.map(function (sw) {
      return '<button type="button" class="mtn-ed-swatch" style="background:' + sw.color + '" data-act="ed-color" data-color="' + sw.color + '" title="' + sw.title + '"></button>'
    }).join('')
    var toolbarHtml = canWrite()
      ? '<div class="mtn-proj-editor-toolbar">' +
        '<button type="button" class="mtn-ed-btn" data-act="ed-bold" title="Bold"><b>B</b></button>' +
        '<button type="button" class="mtn-ed-btn" data-act="ed-italic" title="Italic"><i>I</i></button>' +
        '<button type="button" class="mtn-ed-btn" data-act="ed-underline" title="Underline"><u>U</u></button>' +
        '<span class="mtn-ed-sep"></span>' +
        '<button type="button" class="mtn-ed-btn" data-act="ed-h2" title="Heading 2">Heading 2</button>' +
        '<button type="button" class="mtn-ed-btn" data-act="ed-h3" title="Heading 3">Heading 3</button>' +
        '<button type="button" class="mtn-ed-btn" data-act="ed-p" title="Normal text">Normal</button>' +
        '<button type="button" class="mtn-ed-btn" data-act="ed-quote" title="Quote">Quote</button>' +
        '<span class="mtn-ed-sep"></span>' +
        '<button type="button" class="mtn-ed-btn" data-act="ed-ul" title="Bullet list">Bullets</button>' +
        '<button type="button" class="mtn-ed-btn" data-act="ed-ol" title="Numbered list">Numbering</button>' +
        '<button type="button" class="mtn-ed-btn" data-act="ed-indent" title="Indent (nested list)">&#8594;</button>' +
        '<button type="button" class="mtn-ed-btn" data-act="ed-outdent" title="Outdent">&#8592;</button>' +
        '<span class="mtn-ed-sep"></span>' +
        swatches +
        '<span class="mtn-ed-sep"></span>' +
        '<button type="button" class="mtn-ed-btn" data-act="ed-clear" title="Clear formatting">Clear formatting</button>' +
        '</div>'
      : ''
    var subjectTasks = DB.tasks.filter(function (task) { return task.subjectId === s.id })
    var subjectTaskRows = subjectTasks.map(function (task) {
      return '<div class="mtn-proj-task-row' + (task.status === 'done' ? ' done' : '') + '">' +
        '<div class="mtn-proj-task-top">' +
        '<button type="button" class="mtn-status-pill st-' + esc(task.status) + '" title="Click to change status" data-act="task-status-cycle" data-task-id="' + esc(task.id) + '"' + disabled + '>' + STATUS_LABELS[task.status] + '</button>' +
        '<input class="mtn-proj-task-input" value="' + esc(task.text) + '" placeholder="Task..." maxlength="240" data-field="task.text" data-task-id="' + esc(task.id) + '"' + disabled + ' />' +
        (canWrite()
          ? '<button type="button" class="mtn-icon-btn danger" title="Remove task" data-act="task-delete" data-task-id="' + esc(task.id) + '">x</button>'
          : '') +
        '</div>' +
        '<div class="mtn-proj-task-meta">' +
        '<label class="mtn-proj-task-meta-item"><span>Assignee</span>' + assigneeFieldHtml(task.assignee, ' data-field="task.assignee" data-task-id="' + esc(task.id) + '"' + disabled) + '</label>' +
        '</div>' +
        '</div>'
    }).join('')
    var tasksPanel =
      '<section class="mtn-proj-tasks">' +
      '<div class="mtn-proj-panel-head">' +
      '<span class="mtn-proj-decisions-label">Tasks</span>' +
      '<span class="mtn-proj-panel-note">Collected in the Tasks tab</span>' +
      '</div>' +
      (canWrite()
        ? '<div class="mtn-proj-task-add">' +
          '<input class="mtn-input" id="mtn-proj-task-text" placeholder="New task..." maxlength="240" />' +
          '<div class="mtn-proj-task-add-row">' +
            assigneeFieldHtml('', ' id="mtn-proj-task-assignee"') +
            '<button type="button" class="mtn-btn mtn-btn-soft" data-act="add-proj-task">+ Add</button>' +
          '</div>' +
          '</div>'
        : '') +
      (subjectTaskRows || '<div class="mtn-proj-no-decisions">No tasks for this subject yet - they also appear in the Tasks tab.</div>') +
      '</section>'
    var decisionsPanel =
      '<section class="mtn-proj-decisions">' +
      '<div class="mtn-proj-decisions-head">' +
      '<span class="mtn-proj-decisions-label">Decisions</span>' +
      (canWrite()
        ? '<button type="button" class="mtn-btn mtn-btn-soft mtn-proj-layout-toggle" data-act="proj-layout-toggle">' + (layoutSide ? 'Move below content' : 'Move to right side') + '</button>'
        : '') +
      '</div>' +
      (decisions || '<div class="mtn-proj-no-decisions">No decisions recorded yet.</div>') +
      (canWrite()
        ? '<button type="button" class="mtn-btn mtn-btn-soft mtn-proj-add-decision" data-act="add-decision" data-subject-id="' + esc(s.id) + '">+ Add decision</button>'
        : '') +
      '</section>'
    var mainColumn =
      timerBarHtml(s) +
      '<input class="mtn-proj-title-input" value="' + esc(s.title) + '" placeholder="Subject title" maxlength="160" data-field="subject.title" data-subject-id="' + esc(s.id) + '"' + disabled + ' />' +
      toolbarHtml +
      '<div class="mtn-proj-editor-page" id="mtn-proj-editor-page"' + (canWrite() ? ' contenteditable="true"' : ' contenteditable="false"') + ' spellcheck="true">' + (s.notesHtml || '') + '</div>'
    body.innerHTML =
      '<div class="mtn-proj-layout' + (layoutSide ? ' mtn-proj-layout-side' : ' mtn-proj-layout-bottom') + '">' +
      '<div class="mtn-proj-main-col">' + mainColumn + '</div>' +
      '<div class="mtn-proj-sidepanel">' + tasksPanel + decisionsPanel + '</div>' +
      '</div>'
    // toolbar buttons must not steal the selection
    var toolbar = body.querySelector ? body.querySelector('.mtn-proj-editor-toolbar') : null
    if (toolbar && toolbar.addEventListener) {
      toolbar.addEventListener('mousedown', function (event) {
        var target = event.target
        while (target && target !== toolbar) {
          if (target.getAttribute && target.getAttribute('data-act')) {
            event.preventDefault()
            return
          }
          target = target.parentNode
        }
      })
    }
  }

  function renderProjection() {
    if (!_projectionOpen) return
    clampProjectionIndex()
    renderProjectionNav()
    renderProjectionBody()
  }

  // ── Meeting Mode rich notes editor (the projected page IS the editor) ──
  function syncProjectionEditor() {
    var page = byId('mtn-proj-editor-page')
    if (!page) return
    var subject = DB.subjects[_projectionIndex]
    if (!subject) return
    subject.notesHtml = sanitizeNotesHtml(page.innerHTML)
    subject.notes = htmlToPlainText(page.innerHTML)
    persistSoon()
    updateValidation()
    renderProjectionNav()
  }
  function runEditorCommand(command, value) {
    try {
      if (value !== undefined) document.execCommand(command, false, value)
      else document.execCommand(command, false, null)
    } catch (e) { /* older browsers */ }
    syncProjectionEditor()
  }

  // ── per-subject timer + progress bar (Meeting Mode) ──
  var _timerState = {}
  function timerStateFor(subjectId) {
    if (!_timerState[subjectId]) {
      var subject = subjectById(subjectId)
      var minutes = subject ? subject.durationMinutes : 0
      _timerState[subjectId] = { remainingMs: minutes * 60000, running: false, startedAt: 0 }
    }
    return _timerState[subjectId]
  }
  function fmtClock(ms) {
    var totalSeconds = Math.max(0, Math.ceil(ms / 1000))
    var minutes = Math.floor(totalSeconds / 60)
    var seconds = totalSeconds % 60
    return minutes + ':' + (seconds < 10 ? '0' : '') + seconds
  }
  function fmtClockSigned(ms) {
    return ms < 0 ? '-' + fmtClock(-ms) : fmtClock(ms)
  }
  function fmtClockLong(ms) {
    var totalSeconds = Math.max(0, Math.floor(ms / 1000))
    var hours = Math.floor(totalSeconds / 3600)
    var minutes = Math.floor((totalSeconds % 3600) / 60)
    var seconds = totalSeconds % 60
    if (hours > 0) return hours + 'h ' + minutes + 'm'
    if (minutes > 0) return minutes + 'm ' + seconds + 's'
    return seconds + 's'
  }
  // how much of the planned duration is already spent, as a whole percent
  function subjectTimePercent(subject) {
    var planned = (subject.durationMinutes || 0) * 60000
    if (!planned) return 0
    return Math.round((subject.spentMs || 0) * 100 / planned)
  }
  // compact "planned \u00b7 spent \u00b7 %" label shown on the subject lists
  function subjectTimeLabel(subject) {
    return subject.durationMinutes + ' min \u00b7 \u23f1 ' + fmtClock(subject.spentMs || 0) + ' \u00b7 ' + subjectTimePercent(subject) + '%'
  }
  // settle the time since the last tick - banks screen time into the CURRENT
  // target (the active subject, or the waiting slot). The countdown stays
  // running so it resumes when the subject is shown again.
  function settleProjectionTime() {
    if (!_projectionOpen) return
    var now = Date.now()
    var elapsed = now - _lastTickAt
    _lastTickAt = now
    if (elapsed <= 0) return
    if (_projectionWaiting) {
      DB.meeting.waitingMs = (DB.meeting.waitingMs || 0) + elapsed
      persistSoon()
      return
    }
    var subject = DB.subjects[_projectionIndex]
    if (!subject) return
    subject.spentMs = (subject.spentMs || 0) + elapsed
    var state = timerStateFor(subject.id)
    if (state.running) state.remainingMs -= elapsed
    persistSoon()
  }
  function tickTimer() {
    if (!_projectionOpen) return
    var now = Date.now()
    var elapsed = now - _lastTickAt
    _lastTickAt = now
    if (elapsed <= 0) return
    if (_projectionWaiting) {
      DB.meeting.waitingMs = (DB.meeting.waitingMs || 0) + elapsed
      renderWaitingDisplay()
      persistSoon()
      return
    }
    var subject = DB.subjects[_projectionIndex]
    if (!subject) return
    // screen time for this subject counts the moment it is shown
    subject.spentMs = (subject.spentMs || 0) + elapsed
    var state = timerStateFor(subject.id)
    if (state.running) {
      state.remainingMs -= elapsed
    }
    // repaint on every tick so the Spent readout is live even before Start
    renderTimerDisplay(subject, state)
    renderChipTimes()
    persistSoon()
  }
  function renderTimerDisplay(subject, state) {
    var timeEl = byId('mtn-proj-timer-time')
    var fillEl = byId('mtn-proj-timer-fill')
    var startEl = byId('mtn-proj-timer-start')
    var statusEl = byId('mtn-proj-timer-status')
    var spentEl = byId('mtn-proj-timer-spent')
    var total = (subject.durationMinutes || 0) * 60000
    var over = state.remainingMs <= 0
    if (timeEl) {
      timeEl.textContent = fmtClockSigned(state.remainingMs)
      timeEl.className = 'mtn-proj-timer-time' + (over ? ' over' : '')
    }
    if (fillEl) {
      var percent = total > 0 ? Math.min(100, Math.max(0, Math.round((1 - state.remainingMs / total) * 100))) : 0
      fillEl.style.width = percent + '%'
      fillEl.className = 'mtn-proj-timer-fill' + (over ? ' over' : '')
    }
    if (startEl) startEl.textContent = state.running ? 'Pause' : 'Start'
    if (statusEl) {
      var statusText
      var statusClass
      if (state.running) { statusText = over ? 'Time over - add time or keep going' : 'In progress'; statusClass = over ? 'over' : 'running' }
      else if (over) { statusText = 'Time over'; statusClass = 'over' }
      else { statusText = 'Waiting to start'; statusClass = 'waiting' }
      statusEl.textContent = statusText
      statusEl.className = 'mtn-proj-timer-status ' + statusClass
    }
    if (spentEl) spentEl.textContent = 'Spent: ' + fmtClock(subject.spentMs || 0)
  }
  function timerBarHtml(subject) {
    var state = timerStateFor(subject.id)
    var overNow = state.remainingMs <= 0
    var statusText = state.running ? 'In progress' : (overNow ? 'Time over' : 'Waiting to start')
    var statusClass = overNow ? 'over' : (state.running ? 'running' : 'waiting')
    var quickButtons = [5, 10, 15, 30].map(function (minutes) {
      return '<button type="button" class="mtn-timer-quick-btn' + (subject.durationMinutes === minutes ? ' active' : '') + '" data-act="timer-set" data-minutes="' + minutes + '" title="Add ' + minutes + ' minutes to the current time">' + minutes + ' min</button>'
    }).join('')
    return '<div class="mtn-proj-timer" title="Time on screen counts as spent time for this subject. The countdown runs only after you press Start.">' +
      '<div class="mtn-proj-timer-top">' +
      '<span class="mtn-proj-timer-label">Time for this subject</span>' +
      '<span class="mtn-proj-timer-time' + (overNow ? ' over' : '') + '" id="mtn-proj-timer-time">' + fmtClockSigned(state.remainingMs) + '</span>' +
      '<span class="mtn-proj-timer-status ' + statusClass + '" id="mtn-proj-timer-status">' + statusText + '</span>' +
      '<span class="mtn-proj-timer-spent" id="mtn-proj-timer-spent">Spent: ' + fmtClock(subject.spentMs || 0) + '</span>' +
      (canWrite()
        ? '<div class="mtn-proj-timer-controls">' +
          '<button type="button" class="mtn-btn mtn-btn-soft" data-act="timer-start" id="mtn-proj-timer-start">' + (state.running ? 'Pause' : 'Start') + '</button>' +
          '<button type="button" class="mtn-btn mtn-btn-ghost" data-act="timer-reset">Reset</button>' +
          '<span class="mtn-proj-timer-quick">' + quickButtons + '</span>' +
          '</div>'
        : '') +
      '</div>' +
      '<div class="mtn-proj-timer-track"><div class="mtn-proj-timer-fill" id="mtn-proj-timer-fill" style="width:0%"></div></div>' +
      '</div>'
  }

  // ── import from another meeting (JSON) ──
  var _importData = null
  var _importReplaceArmed = 0

  function parseImportJson(text) {
    var cleaned = stripFences(text)
    var start = cleaned.indexOf('{')
    var end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    var body = cleaned.slice(start, end + 1).replace(/,\s*([\]}])/g, '$1')
    try { return JSON.parse(body) } catch (e) { return null }
  }
  function extractImportPayload(value) {
    if (typeof value === 'string') value = parseImportJson(value)
    if (!value || typeof value !== 'object') return null
    if (value.objectData && value.objectData.data_categoriesBased) value = value.objectData.data_categoriesBased
    else if (value.productData && value.productData.data_categoriesBased) value = value.productData.data_categoriesBased
    if (!value || typeof value !== 'object') return null
    if (!value.meeting && !value.subjects && !value.tasks) return null
    return value
  }
  function rekeyImported(database) {
    var copy = normalizeDatabase(database)
    var subjectIdMap = {}
    copy.subjects.forEach(function (subject) {
      subjectIdMap[subject.id] = uid()
      subject.decisions.forEach(function (decision) { decision.id = uid() })
    })
    copy.subjects.forEach(function (subject) { subject.id = subjectIdMap[subject.id] })
    copy.tasks.forEach(function (task) {
      task.id = uid()
      if (task.subjectId && subjectIdMap[task.subjectId]) task.subjectId = subjectIdMap[task.subjectId]
    })
    return copy
  }
  function importCounts(database) {
    var decisions = 0
    database.subjects.forEach(function (s) {
      decisions += s.decisions.length
    })
    return { subjects: database.subjects.length, decisions: decisions, tasks: database.tasks.length }
  }
  function renderImportResult() {
    var container = byId('mtn-import-result')
    if (!container) return
    if (!_importData) {
      container.innerHTML = ''
      return
    }
    if (_importData.error) {
      container.innerHTML = '<div class="mtn-import-error">' + esc(_importData.error) + '</div>'
      return
    }
    var counts = importCounts(_importData.data)
    var armed = Date.now() - _importReplaceArmed < 8000
    container.innerHTML =
      '<div class="mtn-import-preview">' +
      '<div class="mtn-import-found">Resolved: <b>' + esc(_importData.data.meeting.title || '(untitled meeting)') + '</b>' +
      (_importData.data.meeting.date ? ' - ' + esc(fmtDate(_importData.data.meeting.date)) : '') + '</div>' +
      '<div class="mtn-import-meta">' + counts.subjects + ' subjects - ' + counts.decisions + ' decisions - ' + counts.tasks + ' tasks</div>' +
      '<div class="mtn-import-actions">' +
      '<button type="button" class="mtn-btn mtn-btn-primary" data-act="import-merge">Merge into current meeting</button>' +
      '<button type="button" class="mtn-btn ' + (armed ? 'mtn-btn-danger' : 'mtn-btn-ghost') + '" data-act="import-replace">' + (armed ? 'Really replace? Click again' : 'Replace everything') + '</button>' +
      '</div>' +
      '</div>'
  }
  function analyzeImport() {
    if (!canWrite()) return
    var raw = byId('mtn-import-json').value.trim()
    if (!raw) {
      _importData = { error: 'Paste the JSON of the old meeting first.' }
      renderImportResult()
      return
    }
    var payload = extractImportPayload(raw)
    if (!payload) {
      _importData = { error: 'Could not resolve meeting data from this JSON. Expected the Full Meeting JSON export or a CMS object document.' }
      renderImportResult()
      return
    }
    _importData = { data: normalizeDatabase(payload) }
    _importReplaceArmed = 0
    renderImportResult()
  }
  function doImportMerge() {
    if (!_importData || !_importData.data) return
    var imported = rekeyImported(_importData.data)
    if (!DB.meeting.title && imported.meeting.title) DB.meeting.title = imported.meeting.title
    if (!DB.meeting.date && imported.meeting.date) DB.meeting.date = imported.meeting.date
    if (!DB.meeting.location && imported.meeting.location) DB.meeting.location = imported.meeting.location
    if (!DB.meeting.chair && imported.meeting.chair) DB.meeting.chair = imported.meeting.chair
    if (!DB.meeting.minutetaker && imported.meeting.minutetaker) DB.meeting.minutetaker = imported.meeting.minutetaker
    if (!DB.meeting.attendees && imported.meeting.attendees) DB.meeting.attendees = imported.meeting.attendees
    DB.subjects = DB.subjects.concat(imported.subjects)
    DB.tasks = DB.tasks.concat(imported.tasks)
    if (!DB.rawnotes && imported.rawnotes) DB.rawnotes = imported.rawnotes
    if (!DB.ai.summary && imported.ai.summary) DB.ai.summary = imported.ai.summary
    if (!DB.ai.minutesDraft && imported.ai.minutesDraft) DB.ai.minutesDraft = imported.ai.minutesDraft
    var subjectCount = imported.subjects.length
    var taskCount = imported.tasks.length
    _importData = null
    byId('mtn-import-json').value = ''
    persistSoon()
    renderAll()
    switchTab('subjects')
    tryNotify('Imported ' + subjectCount + ' subject(s) and ' + taskCount + ' task(s).', 'success')
  }
  function doImportReplace() {
    if (!_importData || !_importData.data) return
    var armed = Date.now() - _importReplaceArmed < 8000
    if (!armed) {
      _importReplaceArmed = Date.now()
      renderImportResult()
      tryNotify('Replace is destructive - click the button again to confirm.', 'warning')
      return
    }
    DB = rekeyImported(_importData.data)
    _importData = null
    _importReplaceArmed = 0
    byId('mtn-import-json').value = ''
    persistSoon()
    renderAll()
    switchTab('subjects')
    tryNotify('Meeting replaced with the imported one.', 'success')
  }

  // ── rendering: tasks pane ──
  function taskStatusChipHtml(status, count) {
    var label = status === 'all' ? 'All' : STATUS_LABELS[status]
    return '<button type="button" class="mtn-chip' + (_ui.taskStatusFilter === status ? ' active' : '') + '" data-act="task-filter-status" data-status="' + status + '">' +
      label + ' (' + count + ')</button>'
  }

  function renderTaskFilters() {
    var counts = taskCounts()
    byId('mtn-task-stats').textContent = counts.total + ' total - ' + counts.open + ' open - ' + counts.inProgress + ' in progress - ' + counts.done + ' done'
    byId('mtn-task-filter-status').innerHTML =
      taskStatusChipHtml('all', counts.total) +
      taskStatusChipHtml('open', counts.open) +
      taskStatusChipHtml('inProgress', counts.inProgress) +
      taskStatusChipHtml('done', counts.done)
  }

  function taskVisible(task) {
    if (_ui.taskStatusFilter !== 'all' && task.status !== _ui.taskStatusFilter) return false
    if (_ui.taskPriorityFilter !== 'all' && task.priority !== _ui.taskPriorityFilter) return false
    if (_ui.taskSearch) {
      var haystack = (task.text + ' ' + task.assignee).toLowerCase()
      if (haystack.indexOf(_ui.taskSearch.toLowerCase()) === -1) return false
    }
    return true
  }

  function taskRowHtml(task) {
    var disabled = canWrite() ? '' : ' disabled'
    var sourceTag = task.source === 'ai' ? '<span class="mtn-extract-meta" title="Added by the AI Assistant">ai</span>' : ''
    var priorityOptions = PRIORITIES.map(function (priority) {
      return '<option value="' + priority + '"' + (task.priority === priority ? ' selected' : '') + '>' + PRIORITY_LABELS[priority] + '</option>'
    }).join('')
    return '<div class="mtn-task-row' + (task.status === 'done' ? ' mtn-task-done' : '') + '" data-task-id="' + esc(task.id) + '">' +
      '<div class="mtn-task-row-top">' +
      '<button type="button" class="mtn-status-pill st-' + esc(task.status) + '" title="Click to change status" data-act="task-status-cycle" data-task-id="' + esc(task.id) + '"' + disabled + '>' + STATUS_LABELS[task.status] + '</button>' +
      '<input class="mtn-task-text" value="' + esc(task.text) + '" placeholder="Task..." maxlength="240" data-field="task.text" data-task-id="' + esc(task.id) + '"' + disabled + ' />' +
      (canWrite()
        ? '<button type="button" class="mtn-icon-btn danger" title="Delete task" data-act="task-delete" data-task-id="' + esc(task.id) + '">x</button>'
        : '') +
      '</div>' +
      '<div class="mtn-task-row-meta">' +
      '<label class="mtn-task-meta"><span>Assignee</span>' + assigneeFieldHtml(task.assignee, ' data-field="task.assignee" data-task-id="' + esc(task.id) + '"' + disabled) + '</label>' +
      '<label class="mtn-task-meta"><span>Due</span><input type="date" class="mtn-input" value="' + esc(task.dueDate) + '" data-field="task.due" data-task-id="' + esc(task.id) + '"' + disabled + ' /></label>' +
      '<label class="mtn-task-meta"><span>Priority</span><select class="mtn-select" data-field="task.priority" data-task-id="' + esc(task.id) + '"' + disabled + '>' + priorityOptions + '</select></label>' +
      sourceTag +
      '</div>' +
      '</div>'
  }

  function renderTasks() {
    var container = byId('mtn-tasks')
    var visible = DB.tasks.filter(taskVisible)
    if (!DB.tasks.length) {
      container.innerHTML = '<div class="mtn-task-empty">No tasks yet. Add one below, or let the AI Assistant extract action items from the meeting.</div>'
      return
    }
    if (!visible.length) {
      container.innerHTML = '<div class="mtn-task-empty">No tasks match the current filters.</div>'
      return
    }
    container.innerHTML = visible.map(taskRowHtml).join('')
  }

  // ── rendering: AI pane ──
  function aiOutHint(text) {
    return '<div class="mtn-ai-hint">' + text + '</div>'
  }

  function renderAiOutputs() {
    var summaryOut = byId('mtn-ai-summary-out')
    if (DB.ai.summary) {
      summaryOut.innerHTML =
        '<div class="mtn-ai-result">' +
        '<pre>' + esc(DB.ai.summary) + '</pre>' +
        '<div class="mtn-ai-actions">' +
        '<button type="button" class="mtn-btn mtn-btn-ghost" data-act="ai-copy" data-target="summary">Copy</button>' +
        '<span class="mtn-ai-saved">Saved with the meeting - also used by the Summary PDF export</span>' +
        '</div></div>'
    } else {
      summaryOut.innerHTML = aiOutHint('No summary yet. Click Summarize to generate one from the meeting notes.')
    }

    var extractOut = byId('mtn-ai-extract-out')
    if (_aiExtracted && _aiExtracted.length) {
      var rows = _aiExtracted.map(function (t, i) {
        var priority = PRIORITIES.indexOf(t.priority) !== -1 ? t.priority : 'medium'
        return '<div class="mtn-extract-row">' +
          '<span>' + esc(t.text) + '</span>' +
          '<span class="mtn-extract-meta">Assignee: <b>' + esc(t.assignee || '-') + '</b></span>' +
          '<span class="mtn-extract-meta">Due: <b>' + (t.dueDate ? fmtDate(t.dueDate) : '-') + '</b></span>' +
          '<span class="mtn-priority ' + esc(priority) + '">' + PRIORITY_LABELS[priority] + '</span>' +
          '</div>'
      }).join('')
      extractOut.innerHTML =
        '<div class="mtn-ai-result">' +
        rows +
        '<div class="mtn-ai-actions">' +
        (canWrite()
          ? '<button type="button" class="mtn-btn mtn-btn-primary" data-act="ai-extract-merge">Merge ' + _aiExtracted.length + ' task' + (_aiExtracted.length === 1 ? '' : 's') + ' into Tasks</button>'
          : '') +
        '<button type="button" class="mtn-btn mtn-btn-ghost" data-act="ai-copy" data-target="extract">Copy JSON</button>' +
        '<span class="mtn-ai-saved">' + _aiExtracted.length + ' extracted - duplicates of existing tasks are skipped</span>' +
        '</div></div>'
    } else {
      extractOut.innerHTML = aiOutHint('No extraction yet. Click Extract tasks to read the meeting and list its action items.')
    }

    var draftOut = byId('mtn-ai-draft-out')
    if (DB.ai.minutesDraft) {
      draftOut.innerHTML =
        '<div class="mtn-ai-result">' +
        '<pre>' + esc(DB.ai.minutesDraft) + '</pre>' +
        '<div class="mtn-ai-actions">' +
        '<button type="button" class="mtn-btn mtn-btn-ghost" data-act="ai-copy" data-target="draft">Copy</button>' +
        '<button type="button" class="mtn-btn mtn-btn-ghost" data-act="ai-download" data-target="draft">Download .txt</button>' +
        '<span class="mtn-ai-saved">Saved with the meeting</span>' +
        '</div></div>'
    } else {
      draftOut.innerHTML = aiOutHint('No draft yet. Click Draft minutes to generate formal board minutes from the meeting.')
    }
  }

  function renderAiBusyStates() {
    var buttons = {
      'mtn-btn-ai-summarize': 'summarize',
      'mtn-btn-ai-extract': 'extract',
      'mtn-btn-ai-draft': 'draft'
    }
    Object.keys(buttons).forEach(function (id) {
      var button = byId(id)
      if (!button) return
      button.disabled = !!_aiBusy[buttons[id]]
      if (_aiBusy[buttons[id]]) {
        button.textContent = 'Working...'
      } else {
        button.textContent = id === 'mtn-btn-ai-summarize' ? 'Summarize' : (id === 'mtn-btn-ai-extract' ? 'Extract tasks' : 'Draft minutes')
      }
    })
  }

  function renderAiBanner() {
    byId('mtn-ai-missing').style.display = allowAi() ? 'none' : ''
  }

  // ── rendering: exports pane ──
  function exportCardHtml(name, description, buttons) {
    return '<div class="mtn-export-card">' +
      '<div class="mtn-export-name">' + esc(name) + '</div>' +
      '<div class="mtn-export-desc">' + description + '</div>' +
      '<div class="mtn-export-actions">' + buttons + '</div>' +
      '</div>'
  }
  function exportButtonHtml(label, action) {
    return '<button type="button" class="mtn-btn mtn-btn-primary" data-act="' + action + '">' + label + '</button>'
  }

  function renderExportCards() {
    byId('mtn-exports-pdf').innerHTML =
      exportCardHtml('Meeting Minutes', 'Professional minutes document with agenda, notes per subject, decisions and action items.', exportButtonHtml('Export PDF', 'export-pdf-minutes')) +
      exportCardHtml('Board Meeting Format', 'Formal board format with numbered resolutions, attendance and signature lines.', exportButtonHtml('Export PDF', 'export-pdf-board')) +
      exportCardHtml('Meeting Summary', 'One-page executive summary. Uses the AI summary when one exists.', exportButtonHtml('Export PDF', 'export-pdf-summary')) +
      exportCardHtml('Action Item List', 'All tasks grouped by status with assignees and due dates.', exportButtonHtml('Export PDF', 'export-pdf-tasks'))

    byId('mtn-exports-data').innerHTML =
      exportCardHtml('Tasks CSV', 'Comma-separated action items - opens directly in Excel.', exportButtonHtml('Download CSV', 'export-tasks-csv')) +
      exportCardHtml('Tasks XLS', 'Styled spreadsheet table for Excel.', exportButtonHtml('Download XLS', 'export-tasks-xls')) +
      exportCardHtml('Tasks JSON', 'Action items as a clean JSON array for other systems.', exportButtonHtml('Download JSON', 'export-tasks-json')) +
      exportCardHtml('Full Meeting JSON', 'Everything in one file: meeting, subjects, decisions, tasks and AI results.', exportButtonHtml('Download JSON', 'export-full-json'))

    byId('mtn-exports-text').innerHTML =
      exportCardHtml('Markdown Minutes', 'Meeting minutes as Markdown for wikis, repos and shared docs.', exportButtonHtml('Download .md', 'export-markdown')) +
      exportCardHtml('Email-ready Summary', 'Short plain-text summary you can paste straight into an email.', exportButtonHtml('Download .txt', 'export-email-text'))
  }

  // ── rendering: shared ──
  function updateTabCounts() {
    byId('mtn-count-subjects').textContent = DB.subjects.length
    byId('mtn-count-tasks').textContent = taskCounts().open || DB.tasks.length
  }

  function applyReadOnlyState() {
    var writable = canWrite()
    byId('mtn-ro-badge').style.display = writable ? 'none' : ''
    var staticEdits = [
      'mtn-meet-title', 'mtn-meet-date', 'mtn-meet-location', 'mtn-meet-timestart', 'mtn-meet-timeend',
      'mtn-meet-chair', 'mtn-meet-minutetaker', 'mtn-meet-attendees', 'mtn-raw-notes',
      'mtn-task-new-text', 'mtn-task-new-assignee', 'mtn-task-new-due', 'mtn-task-new-priority',
      'mtn-task-search', 'mtn-task-filter-priority'
    ]
    staticEdits.forEach(function (id) {
      var element = byId(id)
      if (element) element.disabled = !writable
    })
    var buttons = byId('mtn-app').querySelectorAll('[data-act="add-subject"], [data-act="add-task"]')
    buttons.forEach(function (button) { button.disabled = !writable })
    renderSubjects()
    renderTasks()
    renderAiOutputs()
    renderProjection()
  }

  function renderAll() {
    syncMeetingInputs()
    renderMeetingMeta()
    renderSubjects()
    renderTaskFilters()
    renderTasks()
    renderAiBanner()
    renderAiOutputs()
    renderAiBusyStates()
    renderExportCards()
    renderProjection()
    updateTabCounts()
    applyReadOnlyState()
    updateValidation()
  }

  function syncMeetingInputs() {
    var fields = {
      'mtn-meet-title': DB.meeting.title,
      'mtn-meet-date': DB.meeting.date,
      'mtn-meet-location': DB.meeting.location,
      'mtn-meet-timestart': DB.meeting.timestart,
      'mtn-meet-timeend': DB.meeting.timeend,
      'mtn-meet-chair': DB.meeting.chair,
      'mtn-meet-minutetaker': DB.meeting.minutetaker,
      'mtn-meet-attendees': DB.meeting.attendees
    }
    Object.keys(fields).forEach(function (id) {
      var element = byId(id)
      if (element && element.value !== fields[id]) element.value = fields[id]
    })
    var raw = byId('mtn-raw-notes')
    if (raw && raw.value !== DB.rawnotes) raw.value = DB.rawnotes
    var prioritySelect = byId('mtn-task-filter-priority')
    if (prioritySelect && prioritySelect.value !== _ui.taskPriorityFilter) prioritySelect.value = _ui.taskPriorityFilter
    var search = byId('mtn-task-search')
    if (search && search.value !== _ui.taskSearch) search.value = _ui.taskSearch
  }

  function updateValidation() {
    if (!byId('mtn-app')) return
    var hasContent = DB.subjects.length > 0 || DB.tasks.length > 0 || DB.rawnotes || decisionCount() > 0
    if (!DB.meeting.title && hasContent) {
      try { tool.reportValid(false, 'Enter a meeting title before saving.') } catch (e) { /* no-op */ }
    } else {
      try { tool.reportValid(true) } catch (e) { /* no-op */ }
    }
  }

  function switchTab(tab) {
    var tabs = ['subjects', 'meeting', 'tasks', 'ai', 'exports']
    if (tabs.indexOf(tab) === -1) tab = 'subjects'
    _ui.tab = tab
    var buttons = byId('mtn-tabs').querySelectorAll('.mtn-tab')
    buttons.forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-tab') === tab)
    })
    tabs.forEach(function (paneTab) {
      byId('mtn-pane-' + paneTab).classList.toggle('active', paneTab === tab)
    })
    try { tool.resize() } catch (e) { /* no-op */ }
  }

  // ── mutations ──
  function addSubject() {
    var subject = { id: uid(), title: '', notes: '', notesHtml: '', status: 'open', durationMinutes: 15, spentMs: 0, decisions: [] }
    DB.subjects.push(subject)
    _ui.collapsed = {}
    _ui.editingSubjectId = subject.id
    persistSoon()
    renderAll()
    focusLastSubjectTitle()
  }
  function focusLastSubjectTitle() {
    var inputs = byId('mtn-subjects').querySelectorAll('.mtn-subject-title')
    if (inputs.length) {
      inputs[inputs.length - 1].focus()
      inputs[inputs.length - 1].scrollIntoView({ block: 'nearest' })
    }
  }
  function moveSubject(id, direction) {
    var index = -1
    for (var i = 0; i < DB.subjects.length; i++) {
      if (DB.subjects[i].id === id) { index = i; break }
    }
    var target = index + direction
    if (index === -1 || target < 0 || target >= DB.subjects.length) return
    var item = DB.subjects.splice(index, 1)[0]
    DB.subjects.splice(target, 0, item)
    persistSoon()
    renderAll()
  }
  function removeSubject(id) {
    DB.subjects = DB.subjects.filter(function (s) { return s.id !== id })
    if (_ui.editingSubjectId === id) _ui.editingSubjectId = ''
    persistSoon()
    renderAll()
  }
  function addDecision(subjectId) {
    var subject = subjectById(subjectId)
    if (!subject) return
    subject.decisions.push({ id: uid(), text: '', movedBy: '', secondedBy: '' })
    persistSoon()
    renderSubjects()
    if (_projectionOpen) {
      renderProjectionBody()
      var projectedInputs = byId('mtn-project-body').querySelectorAll('.mtn-proj-decision-input')
      if (projectedInputs && projectedInputs.length) {
        projectedInputs[projectedInputs.length - 1].focus()
        projectedInputs[projectedInputs.length - 1].scrollIntoView({ block: 'nearest' })
      }
      return
    }
    var lastRow = byId('mtn-subjects').querySelector('[data-subject-id="' + subjectId + '"] .mtn-decision-row:last-of-type input')
    if (lastRow) lastRow.focus()
  }
  function removeDecision(subjectId, decisionId) {
    var subject = subjectById(subjectId)
    if (!subject) return
    subject.decisions = subject.decisions.filter(function (d) { return d.id !== decisionId })
    persistSoon()
    renderSubjects()
  }
  function autoGrowTextarea(element) {
    if (!element || !element.style || typeof element.scrollHeight !== 'number') return
    element.style.height = 'auto'
    element.style.height = Math.min(Math.max(element.scrollHeight, 64), 240) + 'px'
  }
  function addTask() {
    var text = byId('mtn-task-new-text').value.trim()
    if (!text) {
      tryNotify('Enter a task description first.', 'warning')
      return
    }
    var due = byId('mtn-task-new-due').value
    DB.tasks.push({
      id: uid(),
      text: clampText(text, 240),
      assignee: clampText(byId('mtn-task-new-assignee').value.trim(), 80),
      dueDate: validIso(due) ? due : '',
      priority: byId('mtn-task-new-priority').value,
      status: 'open',
      source: 'manual'
    })
    byId('mtn-task-new-text').value = ''
    byId('mtn-task-new-assignee').value = ''
    byId('mtn-task-new-due').value = ''
    autoGrowTextarea(byId('mtn-task-new-text'))
    persistSoon()
    renderAll()
  }
  function cycleTaskStatus(taskId) {
    var task = null
    for (var i = 0; i < DB.tasks.length; i++) {
      if (DB.tasks[i].id === taskId) { task = DB.tasks[i]; break }
    }
    if (!task) return
    var current = TASK_STATUSES.indexOf(task.status)
    task.status = TASK_STATUSES[(current + 1) % TASK_STATUSES.length]
    persistSoon()
    renderTasks()
    renderTaskFilters()
    updateTabCounts()
    renderMeetingMeta()
    if (_projectionOpen) renderProjectionBody()
  }
  function removeTask(taskId) {
    DB.tasks = DB.tasks.filter(function (t) { return t.id !== taskId })
    persistSoon()
    renderAll()
  }

  // ── input delegation ──
  function handleFieldEdit(element) {
    var field = element.getAttribute('data-field')
    if (!field) return
    if (field === 'rawnotes') {
      DB.rawnotes = clampText(element.value, RAWNOTES_MAX)
    } else if (field.indexOf('meet.') === 0) {
      var key = field.slice(5)
      if (key === 'date' && !validIso(element.value)) element.value = DB.meeting.date
      DB.meeting[key] = element.value
    } else if (field === 'subject.title' || field === 'subject.notes') {
      var subject = subjectById(element.getAttribute('data-subject-id'))
      if (subject) {
        subject[field.slice(8)] = clampText(element.value, field === 'subject.title' ? 160 : 20000)
        if (field === 'subject.notes') subject.notesHtml = plainTextToNotesHtml(subject.notes)
      }
    } else if (field === 'decision.text' || field === 'decision.moved' || field === 'decision.second') {
      var subjectForDecision = subjectById(element.getAttribute('data-subject-id'))
      if (subjectForDecision) {
        var decisionId = element.getAttribute('data-decision-id')
        for (var i = 0; i < subjectForDecision.decisions.length; i++) {
          if (subjectForDecision.decisions[i].id === decisionId) {
            if (field === 'decision.text') subjectForDecision.decisions[i].text = clampText(element.value, 500)
            else if (field === 'decision.moved') subjectForDecision.decisions[i].movedBy = clampText(element.value, 80)
            else subjectForDecision.decisions[i].secondedBy = clampText(element.value, 80)
            break
          }
        }
      }
    } else if (field === 'task.text' || field === 'task.assignee' || field === 'task.due') {
      var taskId = element.getAttribute('data-task-id')
      for (var j = 0; j < DB.tasks.length; j++) {
        if (DB.tasks[j].id === taskId) {
          if (field === 'task.text') DB.tasks[j].text = clampText(element.value, 240)
          else if (field === 'task.assignee') DB.tasks[j].assignee = clampText(element.value, 80)
          else if (field === 'task.due') DB.tasks[j].dueDate = validIso(element.value) ? element.value : ''
          break
        }
      }
    }
    persistSoon()
    updateValidation()
    if (_projectionOpen) renderProjectionNav()
  }

  function handlePriorityChange(element) {
    var taskId = element.getAttribute('data-task-id')
    if (!taskId) return
    for (var i = 0; i < DB.tasks.length; i++) {
      if (DB.tasks[i].id === taskId) {
        DB.tasks[i].priority = PRIORITIES.indexOf(element.value) !== -1 ? element.value : 'medium'
        break
      }
    }
    persistSoon()
    renderTasks()
  }

  // ── AI actions ──
  function meetingContextJson() {
    return JSON.stringify({
      meeting: DB.meeting,
      subjects: DB.subjects,
      tasks: DB.tasks,
      rawnotes: DB.rawnotes ? DB.rawnotes.slice(0, 30000) : ''
    }, null, 2)
  }

  function runAiSummarize() {
    if (!allowAi()) { tryNotify('AI is not enabled (allowAi param).', 'warning'); return }
    if (_aiBusy.summarize) return
    _aiBusy.summarize = true
    renderAiBusyStates()
    var prompt = 'TASK: MEETING_SUMMARY\nAct as a professional meeting assistant. Summarize the meeting below.\n' +
      'Respond in ' + aiLanguage() + ' with these sections, each headed with the exact marker:\n' +
      'EXECUTIVE SUMMARY - 3 to 5 sentences.\nKEY POINTS - the important discussion points as short bullets.\nDECISIONS - the decisions made.\nNEXT STEPS - what happens next.\n\nMEETING DATA (JSON):\n' + meetingContextJson()
    tool.requestAI(prompt, '', function (err, text) {
      _aiBusy.summarize = false
      renderAiBusyStates()
      if (text) {
        DB.ai.summary = clampText(text, SUMMARY_MAX)
        if (canWrite()) persistSoon()
        renderAiOutputs()
        tryNotify('Summary generated and saved with the meeting.', 'success')
      } else if (err) {
        tryNotify('AI error: ' + err, 'error')
      }
    })
  }

  function runAiExtract() {
    if (!allowAi()) { tryNotify('AI is not enabled (allowAi param).', 'warning'); return }
    if (_aiBusy.extract) return
    _aiBusy.extract = true
    renderAiBusyStates()
    var prompt = 'TASK: EXTRACT_ACTION_ITEMS\nRead the meeting below and extract every action item (who does what by when).\n' +
      'Respond with ONLY a JSON array, no prose. Each item: {"text":"task description","assignee":"person name or empty string","dueDate":"YYYY-MM-DD or empty string","priority":"high|medium|low"}.\n' +
      'If no action items exist, return []. Language of task text: ' + aiLanguage() + '.\n\nMEETING DATA (JSON):\n' + meetingContextJson()
    tool.requestAI(prompt, '', function (err, text) {
      _aiBusy.extract = false
      renderAiBusyStates()
      if (err && !text) {
        tryNotify('AI error: ' + err, 'error')
        return
      }
      var items = parseAiJsonArray(text)
      if (!items.length) {
        _aiExtracted = null
        renderAiOutputs()
        tryNotify('No action items found in the AI response.', 'warning')
        return
      }
      var existing = DB.tasks.map(function (t) { return t.text.toLowerCase().trim() })
      var extracted = []
      items.forEach(function (item) {
        if (!item || typeof item !== 'object' || !item.text) return
        var cleanText = clampText(String(item.text).trim(), 240)
        if (!cleanText) return
        if (existing.indexOf(cleanText.toLowerCase()) !== -1) return
        existing.push(cleanText.toLowerCase())
        extracted.push({
          id: uid(),
          text: cleanText,
          assignee: clampText(item.assignee, 80),
          dueDate: validIso(item.dueDate) ? item.dueDate : '',
          priority: PRIORITIES.indexOf(item.priority) !== -1 ? item.priority : 'medium',
          status: 'open',
          source: 'ai'
        })
      })
      _aiExtracted = extracted.length ? extracted : null
      renderAiOutputs()
      if (extracted.length) {
        tryNotify(extracted.length + ' action item(s) extracted - review and merge.', 'success')
      } else {
        tryNotify('Extraction found only duplicates or nothing new.', 'info')
      }
    })
  }

  function runAiDraft() {
    if (!allowAi()) { tryNotify('AI is not enabled (allowAi param).', 'warning'); return }
    if (_aiBusy.draft) return
    _aiBusy.draft = true
    renderAiBusyStates()
    var prompt = 'TASK: DRAFT_MINUTES\nWrite formal minutes of the meeting below, in ' + aiLanguage() + '.\n' +
      'Use this structure: heading with meeting title, date, time, location; ATTENDANCE list; AGENDA (numbered subjects); ' +
      'NOTES BY SUBJECT; RESOLUTIONS (each decision written as a numbered "RESOLVED, that ..." item); ACTION ITEMS (task, assignee, due date); ' +
      'closing with next meeting, and signature lines for Chair and Secretary.\n\nMEETING DATA (JSON):\n' + meetingContextJson()
    tool.requestAI(prompt, '', function (err, text) {
      _aiBusy.draft = false
      renderAiBusyStates()
      if (text) {
        DB.ai.minutesDraft = clampText(text, DRAFT_MAX)
        if (canWrite()) persistSoon()
        renderAiOutputs()
        tryNotify('Minutes draft generated and saved with the meeting.', 'success')
      } else if (err) {
        tryNotify('AI error: ' + err, 'error')
      }
    })
  }

  function mergeExtractedTasks() {
    if (!_aiExtracted || !_aiExtracted.length) return
    DB.tasks = DB.tasks.concat(_aiExtracted)
    var count = _aiExtracted.length
    _aiExtracted = null
    persistSoon()
    renderAll()
    switchTab('tasks')
    tryNotify(count + ' task(s) merged into the Tasks tab.', 'success')
  }

  // ── clipboard + downloads ──
  function copyTextToClipboard(text) {
    function fallback() {
      var textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try { document.execCommand('copy') } catch (e) { /* ignore */ }
      document.body.removeChild(textarea)
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        tryNotify('Copied to clipboard.', 'success')
      }).catch(function () {
        fallback()
        tryNotify('Copied to clipboard.', 'success')
      })
    } else {
      fallback()
      tryNotify('Copied to clipboard.', 'success')
    }
  }

  function downloadBlob(content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType || 'text/plain' })
    var url = URL.createObjectURL(blob)
    var anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    setTimeout(function () { URL.revokeObjectURL(url) }, 2000)
  }

  // ── export document builders ──
  var EXPORT_CSS = [
    '@page { size: A4; margin: 18mm; }',
    '* { box-sizing: border-box; }',
    'body { font-family: Georgia, "Times New Roman", serif; color: #1e293b; font-size: 12pt; line-height: 1.55; margin: 0; }',
    '.pdf-org { font-size: 10pt; letter-spacing: 2px; text-transform: uppercase; color: #1e4e79; font-weight: bold; margin-bottom: 2mm; }',
    'h1 { font-size: 20pt; color: #1e4e79; margin: 0 0 1mm; border-bottom: 2.5px solid #1e4e79; padding-bottom: 2mm; }',
    '.pdf-sub { color: #64748b; font-size: 10.5pt; margin-bottom: 5mm; }',
    'h2 { font-size: 13pt; color: #1e4e79; margin: 6mm 0 2mm; border-bottom: 1px solid #cbd5e1; padding-bottom: 1mm; }',
    'h3 { font-size: 12pt; margin: 3mm 0 1mm; }',
    'p { margin: 0 0 2mm; }',
    'table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; page-break-inside: auto; }',
    'th, td { border: 1px solid #cbd5e1; padding: 2mm 3mm; text-align: left; vertical-align: top; font-size: 10.5pt; }',
    'th { background: #e8f0f8; color: #1e4e79; }',
    'tr { page-break-inside: avoid; }',
    '.pdf-meta td { border: none; border-bottom: 1px solid #e2e8f0; padding: 1.2mm 2mm; }',
    '.pdf-meta td:first-child { font-weight: bold; width: 30mm; color: #1e4e79; }',
    'ol { margin: 1mm 0 2mm; padding-left: 7mm; }',
    'li { margin-bottom: 1.2mm; }',
    '.pdf-note { white-space: pre-wrap; }',
    '.pdf-signs { display: flex; justify-content: space-between; gap: 15mm; margin-top: 16mm; }',
    '.pdf-sign { flex: 1; }',
    '.pdf-sign-line { border-top: 1px solid #334155; margin-top: 12mm; padding-top: 1mm; font-size: 10pt; color: #475569; }',
    '.pdf-decision-meta { font-size: 9.5pt; color: #64748b; font-style: italic; margin-top: 0.5mm; }',
    '.pdf-foot { margin-top: 8mm; font-size: 9pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 2mm; }',
    '.pdf-print-hint { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 3mm 4mm; border-radius: 3mm; font-size: 10pt; margin-bottom: 5mm; font-family: Arial, sans-serif; }',
    '.pdf-badge { display: inline-block; background: #e8f0f8; color: #1e4e79; font-size: 9.5pt; padding: 0.8mm 2.5mm; border-radius: 2mm; margin-right: 2mm; font-family: Arial, sans-serif; }',
    '@media print { .pdf-print-hint { display: none; } }'
  ].join('\n')

  function wrapExportHtml(bodyHtml, title) {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>' + EXPORT_CSS + '</style></head><body>' + bodyHtml + '</body></html>'
  }

  function metaTableHtml() {
    var m = DB.meeting
    var timeText = (m.timestart ? m.timestart : '') + (m.timeend ? ' - ' + m.timeend : '')
    var attendees = m.attendees ? m.attendees.split('\n').map(function (line) { return line.trim() }).filter(Boolean) : []
    return '<table class="pdf-meta">' +
      '<tr><td>Meeting</td><td>' + esc(meetingTitleOf()) + '</td></tr>' +
      '<tr><td>Date</td><td>' + esc(fmtDate(m.date) || '-') + '</td></tr>' +
      (timeText ? '<tr><td>Time</td><td>' + esc(timeText) + '</td></tr>' : '') +
      (m.location ? '<tr><td>Location</td><td>' + esc(m.location) + '</td></tr>' : '') +
      (m.chair ? '<tr><td>Chair</td><td>' + esc(m.chair) + '</td></tr>' : '') +
      (m.minutetaker ? '<tr><td>Minute taker</td><td>' + esc(m.minutetaker) + '</td></tr>' : '') +
      (attendees.length ? '<tr><td>Attendees</td><td>' + esc(attendees.join(', ')) + '</td></tr>' : '') +
      '</table>'
  }

  function subjectsHtml(includeNotes) {
    if (!DB.subjects.length) return '<p>No subjects were recorded.</p>'
    return DB.subjects.map(function (s, i) {
      var body = '<h3>' + (i + 1) + '. ' + esc(s.title || '(untitled subject)') + '</h3>'
      if (includeNotes && s.notes) body += '<div class="pdf-note">' + nl2br(s.notes) + '</div>'
      return body
    }).join('')
  }

  function decisionMetaHtml(d) {
    var parts = []
    if (d.movedBy) parts.push('Moved by ' + esc(d.movedBy))
    if (d.secondedBy) parts.push('seconded by ' + esc(d.secondedBy))
    return parts.length ? '<div class="pdf-decision-meta">' + parts.join(', ') + '.</div>' : ''
  }

  function decisionsHtml() {
    var all = []
    DB.subjects.forEach(function (s) {
      s.decisions.forEach(function (d) {
        if (d.text) all.push(d)
      })
    })
    if (!all.length) return '<p>No decisions were recorded.</p>'
    return '<ol>' + all.map(function (d) {
      return '<li>' + esc(d.text) + decisionMetaHtml(d) + '</li>'
    }).join('') + '</ol>'
  }

  function tasksTableHtml(tasks) {
    if (!tasks.length) return '<p>No action items.</p>'
    return '<table><thead><tr><th>#</th><th>Task</th><th>Assigned to</th><th>Due</th><th>Priority</th><th>Status</th></tr></thead><tbody>' +
      tasks.map(function (t, i) {
        return '<tr><td>' + (i + 1) + '</td><td>' + esc(t.text) + '</td><td>' + esc(t.assignee || '-') + '</td><td>' +
          esc(fmtDate(t.dueDate) || '-') + '</td><td>' + PRIORITY_LABELS[t.priority] + '</td><td>' + STATUS_LABELS[t.status] + '</td></tr>'
      }).join('') +
      '</tbody></table>'
  }

  function printHintHtml() {
    return '<div class="pdf-print-hint">Use the print dialog of your browser and choose "Save as PDF" to create the final PDF file.</div>'
  }

  function buildMinutesHtml() {
    var counts = taskCounts()
    var body =
      '<div class="pdf-org">' + esc(boardName() || 'Meeting Minutes') + '</div>' +
      '<h1>Meeting Minutes</h1>' +
      '<div class="pdf-sub">' + esc(meetingTitleOf()) + (DB.meeting.date ? ' - ' + esc(fmtDate(DB.meeting.date)) : '') + '</div>' +
      printHintHtml() +
      metaTableHtml() +
      '<h2>Agenda and Notes</h2>' + subjectsHtml(true) +
      '<h2>Decisions</h2>' + decisionsHtml() +
      '<h2>Action Items (' + counts.open + ' open of ' + counts.total + ')</h2>' + tasksTableHtml(DB.tasks) +
      '<div class="pdf-foot">Generated by the Meeting Notes tool on ' + fmtDate(todayIso()) + '. Minutes recorded by ' + esc(DB.meeting.minutetaker || 'the minute taker') + '.</div>'
    return wrapExportHtml(body, 'Minutes - ' + meetingTitleOf())
  }

  function buildBoardHtml() {
    var attendees = DB.meeting.attendees ? DB.meeting.attendees.split('\n').map(function (line) { return line.trim() }).filter(Boolean) : []
    var resolutions = []
    DB.subjects.forEach(function (s) {
      s.decisions.forEach(function (d) {
        if (d.text) resolutions.push(d)
      })
    })
    var body =
      '<div class="pdf-org">' + esc(boardName() || 'Organization') + '</div>' +
      '<h1>Minutes of the Meeting of the Board</h1>' +
      '<div class="pdf-sub">' + esc(meetingTitleOf()) + (DB.meeting.date ? ' - ' + esc(fmtDate(DB.meeting.date)) : '') +
      (DB.meeting.location ? ' - ' + esc(DB.meeting.location) : '') + '</div>' +
      printHintHtml() +
      '<h2>1. Attendance</h2>' +
      (attendees.length
        ? '<p>Present: ' + esc(attendees.join(', ')) + '.</p>'
        : '<p>Attendance was not recorded.</p>') +
      (DB.meeting.chair ? '<p>The meeting was chaired by ' + esc(DB.meeting.chair) + (DB.meeting.minutetaker ? '; minutes were recorded by ' + esc(DB.meeting.minutetaker) : '') + '.</p>' : '') +
      '<h2>2. Agenda</h2>' +
      (DB.subjects.length
        ? '<ol>' + DB.subjects.map(function (s) { return '<li>' + esc(s.title || '(untitled subject)') + '</li>' }).join('') + '</ol>'
        : '<p>No agenda was recorded.</p>') +
      '<h2>3. Notes by Subject</h2>' + subjectsHtml(true) +
      '<h2>4. Resolutions</h2>' +
      (resolutions.length
        ? '<ol>' + resolutions.map(function (d) { return '<li><strong>RESOLVED, that</strong> ' + esc(d.text) + decisionMetaHtml(d) + '</li>' }).join('') + '</ol>'
        : '<p>No resolutions were recorded.</p>') +
      '<h2>5. Action Items</h2>' + tasksTableHtml(DB.tasks.filter(function (t) { return t.status !== 'done' })) +
      '<div class="pdf-signs">' +
      '<div class="pdf-sign"><div class="pdf-sign-line">' + esc(DB.meeting.chair || 'Chair') + '</div></div>' +
      '<div class="pdf-sign"><div class="pdf-sign-line">' + esc(DB.meeting.minutetaker || 'Secretary') + '</div></div>' +
      '</div>' +
      '<div class="pdf-foot">Board meeting format generated by the Meeting Notes tool on ' + fmtDate(todayIso()) + '.</div>'
    return wrapExportHtml(body, 'Board Minutes - ' + meetingTitleOf())
  }

  function autoSummaryText() {
    var counts = taskCounts()
    var lines = []
    lines.push(meetingTitleOf() + ' was held on ' + (fmtDate(DB.meeting.date) || 'an unrecorded date') +
      (DB.meeting.location ? ' at ' + DB.meeting.location : '') + '.')
    lines.push('The meeting covered ' + DB.subjects.length + ' subject' + (DB.subjects.length === 1 ? '' : 's') +
      ', recorded ' + decisionCount() + ' decision' + (decisionCount() === 1 ? '' : 's') +
      ' and tracks ' + counts.total + ' action item' + (counts.total === 1 ? '' : 's') + ' (' + counts.open + ' still open).')
    DB.subjects.forEach(function (s) {
      var firstLine = s.notes ? s.notes.split('\n').map(function (l) { return l.trim() }).filter(Boolean)[0] : ''
      lines.push('- ' + (s.title || '(untitled subject)') + (firstLine ? ': ' + firstLine.slice(0, 180) + (firstLine.length > 180 ? '...' : '') : ''))
    })
    return lines.join('\n')
  }

  function buildSummaryHtml() {
    var counts = taskCounts()
    var summary = DB.ai.summary || autoSummaryText()
    var openTasks = DB.tasks.filter(function (t) { return t.status !== 'done' })
    var body =
      '<div class="pdf-org">' + esc(boardName() || 'Meeting Summary') + '</div>' +
      '<h1>Meeting Summary</h1>' +
      '<div class="pdf-sub">' + esc(meetingTitleOf()) + (DB.meeting.date ? ' - ' + esc(fmtDate(DB.meeting.date)) : '') + '</div>' +
      printHintHtml() +
      '<p><span class="pdf-badge">' + DB.subjects.length + ' subjects</span>' +
      '<span class="pdf-badge">' + decisionCount() + ' decisions</span>' +
      '<span class="pdf-badge">' + counts.open + ' open tasks</span></p>' +
      '<h2>Summary</h2><div class="pdf-note">' + nl2br(summary) + '</div>' +
      '<h2>Open Action Items</h2>' + tasksTableHtml(openTasks) +
      '<div class="pdf-foot">Generated by the Meeting Notes tool on ' + fmtDate(todayIso()) + '.</div>'
    return wrapExportHtml(body, 'Summary - ' + meetingTitleOf())
  }

  function buildTasksHtml() {
    var counts = taskCounts()
    var groups = [
      { label: 'Open', items: DB.tasks.filter(function (t) { return t.status === 'open' }) },
      { label: 'In Progress', items: DB.tasks.filter(function (t) { return t.status === 'inProgress' }) },
      { label: 'Done', items: DB.tasks.filter(function (t) { return t.status === 'done' }) }
    ]
    var body =
      '<div class="pdf-org">' + esc(boardName() || 'Action Items') + '</div>' +
      '<h1>Action Item List</h1>' +
      '<div class="pdf-sub">' + esc(meetingTitleOf()) + ' - ' + counts.total + ' task(s), ' + counts.open + ' open</div>' +
      printHintHtml() +
      groups.map(function (group) {
        return '<h2>' + group.label + ' (' + group.items.length + ')</h2>' + tasksTableHtml(group.items)
      }).join('') +
      '<div class="pdf-foot">Generated by the Meeting Notes tool on ' + fmtDate(todayIso()) + '.</div>'
    return wrapExportHtml(body, 'Action Items - ' + meetingTitleOf())
  }

  // ── export actions ──
  function exportPdf(kind) {
    var builders = {
      minutes: { fn: buildMinutesHtml, name: 'minutes' },
      board: { fn: buildBoardHtml, name: 'board-format' },
      summary: { fn: buildSummaryHtml, name: 'summary' },
      tasks: { fn: buildTasksHtml, name: 'action-items' }
    }
    var spec = builders[kind]
    if (!spec) return
    var html = spec.fn()
    var filename = slugify(meetingTitleOf()) + '-' + spec.name
    if (allowExportPdf() && typeof tool.requestExportPdf === 'function') {
      tool.requestExportPdf({ html: html, filename: filename, landscape: false }, function (err, file) {
        if (!err && file && file.url) {
          try { tool.openUrl(file.url) } catch (e) { downloadBlob(html, filename + '.html', 'text/html') }
        } else {
          downloadBlob(html, filename + '.html', 'text/html')
          tryNotify('PDF channel unavailable - downloaded as HTML. Open it and print to PDF.', 'info')
        }
      })
    } else {
      downloadBlob(html, filename + '.html', 'text/html')
      tryNotify('PDF channel not enabled - downloaded as HTML. Open it and print to PDF.', 'info')
    }
  }

  function csvCell(value) {
    var text = String(value == null ? '' : value)
    return '"' + text.replace(/"/g, '""') + '"'
  }

  function buildTasksCsv() {
    var rows = [['Task', 'Assignee', 'Due date', 'Priority', 'Status', 'Source'].map(csvCell).join(',')]
    DB.tasks.forEach(function (t) {
      rows.push([t.text, t.assignee, t.dueDate, PRIORITY_LABELS[t.priority], STATUS_LABELS[t.status], t.source].map(csvCell).join(','))
    })
    return '\uFEFF' + rows.join('\r\n')
  }

  function buildTasksXls() {
    var header = '<tr><th>Task</th><th>Assignee</th><th>Due date</th><th>Priority</th><th>Status</th><th>Source</th></tr>'
    var rows = DB.tasks.map(function (t) {
      return '<tr><td>' + esc(t.text) + '</td><td>' + esc(t.assignee) + '</td><td>' + esc(t.dueDate) + '</td><td>' +
        PRIORITY_LABELS[t.priority] + '</td><td>' + STATUS_LABELS[t.status] + '</td><td>' + esc(t.source) + '</td></tr>'
    }).join('')
    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>' +
      '<table border="1">' + header + rows + '</table></body></html>'
  }

  function buildTasksJson() {
    return JSON.stringify(DB.tasks.map(function (t) {
      return {
        task: t.text,
        assignee: t.assignee,
        dueDate: t.dueDate,
        priority: t.priority,
        status: t.status,
        source: t.source
      }
    }), null, 2)
  }

  function buildFullJson() {
    return JSON.stringify(DB, null, 2)
  }

  function buildMarkdown() {
    var m = DB.meeting
    var lines = []
    lines.push('# ' + meetingTitleOf())
    lines.push('')
    if (m.date) lines.push('**Date:** ' + fmtDate(m.date) + (m.timestart ? ' ' + m.timestart : '') + (m.timeend ? ' - ' + m.timeend : ''))
    if (m.location) lines.push('**Location:** ' + m.location)
    if (m.chair) lines.push('**Chair:** ' + m.chair)
    if (m.minutetaker) lines.push('**Minute taker:** ' + m.minutetaker)
    if (m.attendees) lines.push('**Attendees:** ' + m.attendees.split('\n').map(function (l) { return l.trim() }).filter(Boolean).join(', '))
    lines.push('')
    lines.push('## Subjects')
    if (!DB.subjects.length) {
      lines.push('_No subjects recorded._')
    } else {
      DB.subjects.forEach(function (s, i) {
        lines.push('')
        lines.push('### ' + (i + 1) + '. ' + (s.title || 'Untitled'))
        if (s.notes) lines.push(s.notes)
        s.decisions.forEach(function (d) {
          if (!d.text) return
          var decisionMeta = []
          if (d.movedBy) decisionMeta.push('Moved by ' + d.movedBy)
          if (d.secondedBy) decisionMeta.push('Seconded by ' + d.secondedBy)
          lines.push('- **Decision:** ' + d.text + (decisionMeta.length ? ' _(' + decisionMeta.join(' - ') + ')_' : ''))
        })
      })
    }
    lines.push('')
    lines.push('## Action Items')
    if (!DB.tasks.length) {
      lines.push('_No action items._')
    } else {
      DB.tasks.forEach(function (t) {
        var meta = [STATUS_LABELS[t.status], PRIORITY_LABELS[t.priority]]
        if (t.assignee) meta.push('Assigned to ' + t.assignee)
        if (t.dueDate) meta.push('Due ' + fmtDate(t.dueDate))
        lines.push('- [ ] ' + t.text + ' _(' + meta.join(' - ') + ')_')
      })
    }
    lines.push('')
    return lines.join('\n')
  }

  function buildEmailText() {
    var counts = taskCounts()
    var lines = []
    lines.push('Hi all,')
    lines.push('')
    lines.push('Quick summary of "' + meetingTitleOf() + '"' + (DB.meeting.date ? ' (' + fmtDate(DB.meeting.date) + ')' : '') + ':')
    lines.push('')
    if (DB.ai.summary) {
      lines.push(DB.ai.summary)
    } else {
      lines.push(autoSummaryText())
    }
    lines.push('')
    if (counts.open) {
      lines.push('Open action items:')
      DB.tasks.forEach(function (t, i) {
        if (t.status === 'done') return
        lines.push((i + 1) + '. ' + t.text + (t.assignee ? ' - ' + t.assignee : '') + (t.dueDate ? ' (due ' + fmtDate(t.dueDate) + ')' : ''))
      })
    }
    lines.push('')
    lines.push('Thanks,')
    lines.push(DB.meeting.minutetaker || '')
    return lines.join('\n')
  }

  function exportData(kind) {
    var specs = {
      'tasks-csv': { fn: buildTasksCsv, name: 'tasks', ext: 'csv', mime: 'text/csv' },
      'tasks-xls': { fn: buildTasksXls, name: 'tasks', ext: 'xls', mime: 'application/vnd.ms-excel' },
      'tasks-json': { fn: buildTasksJson, name: 'tasks', ext: 'json', mime: 'application/json' },
      'full-json': { fn: buildFullJson, name: 'meeting', ext: 'json', mime: 'application/json' },
      'markdown': { fn: buildMarkdown, name: 'minutes', ext: 'md', mime: 'text/markdown' },
      'email-text': { fn: buildEmailText, name: 'summary-email', ext: 'txt', mime: 'text/plain' }
    }
    var spec = specs[kind]
    if (!spec) return
    downloadBlob(spec.fn(), slugify(meetingTitleOf()) + '-' + spec.name + '.' + spec.ext, spec.mime)
  }

  // ── event delegation ──
  function handleActionClick(element) {
    var action = element.getAttribute('data-act')
    var subjectId = element.getAttribute('data-subject-id')
    var taskId = element.getAttribute('data-task-id')
    switch (action) {
      case 'add-subject':
        if (canWrite()) addSubject()
        break
      case 'import-analyze':
        analyzeImport()
        break
      case 'import-merge':
        doImportMerge()
        break
      case 'import-replace':
        doImportReplace()
        break
      case 'ed-bold':
        runEditorCommand('bold')
        break
      case 'ed-italic':
        runEditorCommand('italic')
        break
      case 'ed-underline':
        runEditorCommand('underline')
        break
      case 'ed-h2':
        runEditorCommand('formatBlock', 'h2')
        break
      case 'ed-h3':
        runEditorCommand('formatBlock', 'h3')
        break
      case 'ed-p':
        runEditorCommand('formatBlock', 'p')
        break
      case 'ed-quote':
        runEditorCommand('formatBlock', 'blockquote')
        break
      case 'ed-ul':
        runEditorCommand('insertUnorderedList')
        break
      case 'ed-ol':
        runEditorCommand('insertOrderedList')
        break
      case 'ed-indent':
        runEditorCommand('indent')
        break
      case 'ed-outdent':
        runEditorCommand('outdent')
        break
      case 'ed-color':
        runEditorCommand('foreColor', element.getAttribute('data-color') || '#0f172a')
        break
      case 'ed-clear':
        runEditorCommand('removeFormat')
        break
      case 'project-open':
        openProjection()
        break
      case 'project-close':
        closeProjection()
        break
      case 'project-prev':
        stepProjection(-1)
        break
      case 'project-next':
        stepProjection(1)
        break
      case 'project-jump':
        settleProjectionTime()
        _projectionWaiting = false
        _projectionIndex = parseInt(element.getAttribute('data-index'), 10) || 0
        renderProjection()
        break
      case 'project-waiting':
        selectWaiting()
        break
      case 'proj-done-toggle':
        if (!canWrite()) break
        var doneIndex = parseInt(element.getAttribute('data-index'), 10)
        if (isNaN(doneIndex) || !DB.subjects[doneIndex]) break
        DB.subjects[doneIndex].status = DB.subjects[doneIndex].status === 'done' ? 'open' : 'done'
        persistSoon()
        renderProjectionNav()
        renderSubjects()
        renderMeetingMeta()
        break
      case 'project-smaller':
        changeProjectionScale(-0.25)
        break
      case 'project-bigger':
        changeProjectionScale(0.25)
        break
      case 'project-reset':
        _ui.projScale = 1
        renderProjection()
        break
      case 'proj-layout-toggle':
        _ui.projDecisionsSide = _ui.projDecisionsSide === false
        renderProjection()
        break
      case 'subject-collapse':
        _ui.collapsed[subjectId] = !_ui.collapsed[subjectId]
        renderSubjects()
        break
      case 'subject-edit':
        if (canWrite()) {
          _ui.editingSubjectId = subjectId || ''
          renderSubjects()
        }
        break
      case 'subject-edit-close':
        _ui.editingSubjectId = ''
        renderSubjects()
        break
      case 'subject-up':
        if (canWrite()) moveSubject(subjectId, -1)
        break
      case 'subject-down':
        if (canWrite()) moveSubject(subjectId, 1)
        break
      case 'subject-delete':
        if (canWrite()) removeSubject(subjectId)
        break
      case 'add-decision':
        if (canWrite()) addDecision(subjectId)
        break
      case 'decision-remove':
        if (canWrite()) removeDecision(subjectId, element.getAttribute('data-decision-id'))
        break
      case 'decision-expand':
        if (!canWrite()) break
        _ui.decisionExpanded[element.getAttribute('data-decision-id')] = !_ui.decisionExpanded[element.getAttribute('data-decision-id')]
        renderSubjects()
        break
      case 'subject-status-cycle':
        if (!canWrite()) break
        var statusSubject = subjectById(subjectId)
        if (!statusSubject) break
        statusSubject.status = statusSubject.status === 'done' ? 'open' : 'done'
        persistSoon()
        renderSubjects()
        renderMeetingMeta()
        break
      case 'add-proj-task':
        if (!canWrite() || !_projectionOpen) break
        var projTaskSubject = DB.subjects[_projectionIndex]
        var projTaskTextEl = byId('mtn-proj-task-text')
        if (!projTaskSubject || !projTaskTextEl) break
        var projTaskText = projTaskTextEl.value.trim()
        if (!projTaskText) break
        DB.tasks.push({
          id: uid(),
          text: clampText(projTaskText, 240),
          assignee: clampText((byId('mtn-proj-task-assignee').value || '').trim(), 80),
          dueDate: '',
          priority: 'medium',
          status: 'open',
          source: 'manual',
          subjectId: projTaskSubject.id
        })
        projTaskTextEl.value = ''
        var projAssigneeEl = byId('mtn-proj-task-assignee')
        if (projAssigneeEl) projAssigneeEl.value = ''
        persistSoon()
        renderProjectionBody()
        renderTaskFilters()
        updateTabCounts()
        break
      case 'project-side-toggle':
        _ui.projSideCollapsed = !_ui.projSideCollapsed
        var projectionEl = byId('mtn-projection')
        if (projectionEl) projectionEl.classList.toggle('side-collapsed', !!_ui.projSideCollapsed)
        updateSideToggleButton()
        break
      case 'timer-start':
        if (!canWrite() || !_projectionOpen || _projectionWaiting) break
        var timerSubject = DB.subjects[_projectionIndex]
        if (!timerSubject) break
        var timerState = timerStateFor(timerSubject.id)
        if (timerState.running) timerState.running = false
        else { timerState.running = true; timerState.startedAt = Date.now() }
        renderTimerDisplay(timerSubject, timerState)
        break
      case 'timer-reset':
        if (!canWrite() || !_projectionOpen || _projectionWaiting) break
        var resetSubject = DB.subjects[_projectionIndex]
        if (!resetSubject) break
        var resetState = timerStateFor(resetSubject.id)
        resetState.remainingMs = (resetSubject.durationMinutes || 0) * 60000
        resetState.running = false
        renderTimerDisplay(resetSubject, resetState)
        break
      case 'timer-set':
        if (!canWrite() || !_projectionOpen || _projectionWaiting) break
        var setSubject = DB.subjects[_projectionIndex]
        if (!setSubject) break
        var setMinutes = parseInt(element.getAttribute('data-minutes'), 10) || 0
        var setState = timerStateFor(setSubject.id)
        if (setState.running) {
          // running: ADD time to the countdown without stopping it
          setState.remainingMs += setMinutes * 60000
          renderTimerDisplay(setSubject, setState)
        } else {
          setSubject.durationMinutes = setMinutes
          persistSoon()
          setState.remainingMs = setMinutes * 60000
          renderProjectionBody()
        }
        break
      case 'task-status-cycle':
        if (canWrite()) cycleTaskStatus(taskId)
        break
      case 'task-delete':
        if (canWrite()) removeTask(taskId)
        break
      case 'add-task':
        if (canWrite()) addTask()
        break
      case 'task-filter-status':
        _ui.taskStatusFilter = element.getAttribute('data-status') || 'all'
        renderTaskFilters()
        renderTasks()
        break
      case 'ai-summarize':
        runAiSummarize()
        break
      case 'ai-extract':
        runAiExtract()
        break
      case 'ai-draft':
        runAiDraft()
        break
      case 'ai-extract-merge':
        mergeExtractedTasks()
        break
      case 'ai-copy':
        if (element.getAttribute('data-target') === 'summary') copyTextToClipboard(DB.ai.summary || '')
        else if (element.getAttribute('data-target') === 'draft') copyTextToClipboard(DB.ai.minutesDraft || '')
        else if (_aiExtracted) copyTextToClipboard(JSON.stringify(_aiExtracted, null, 2))
        break
      case 'ai-download':
        if (element.getAttribute('data-target') === 'draft' && DB.ai.minutesDraft) {
          downloadBlob(DB.ai.minutesDraft, slugify(meetingTitleOf()) + '-minutes-draft.txt', 'text/plain')
        }
        break
      case 'export-pdf-minutes':
      case 'export-pdf-board':
      case 'export-pdf-summary':
      case 'export-pdf-tasks':
        exportPdf(action.replace('export-pdf-', ''))
        break
      case 'export-tasks-csv':
      case 'export-tasks-xls':
      case 'export-tasks-json':
      case 'export-full-json':
      case 'export-markdown':
      case 'export-email-text':
        exportData(action.replace('export-', ''))
        break
      default:
        var tab = element.getAttribute('data-tab')
        if (tab) switchTab(tab)
    }
  }

  function bindEvents() {
    var app = byId('mtn-app')

    app.addEventListener('click', function (event) {
      var element = event.target
      while (element && element !== app) {
        if (element.getAttribute && element.getAttribute('data-act')) {
          handleActionClick(element)
          return
        }
        if (element.getAttribute && element.getAttribute('data-tab') && element.classList && element.classList.contains('mtn-tab')) {
          handleActionClick(element)
          return
        }
        // clicking a reading-mode subject card opens that subject for editing
        if (element.classList && element.classList.contains('mtn-subject-read')) {
          if (canWrite()) {
            _ui.editingSubjectId = element.getAttribute('data-subject-id') || ''
            renderSubjects()
          }
          return
        }
        element = element.parentNode
      }
    })

    app.addEventListener('input', function (event) {
      var element = event.target
      if (!element || !element.getAttribute) return
      if (element.id === 'mtn-proj-editor-page') {
        syncProjectionEditor()
        return
      }
      if (element.id === 'mtn-task-new-text') {
        autoGrowTextarea(element)
        return
      }
      if (element.id === 'mtn-task-search') {
        _ui.taskSearch = element.value
        renderTasks()
        return
      }
      if (element.getAttribute('data-field')) handleFieldEdit(element)
    })

    app.addEventListener('change', function (event) {
      var element = event.target
      if (!element || !element.getAttribute) return
      if (element.id === 'mtn-task-filter-priority') {
        _ui.taskPriorityFilter = element.value
        renderTasks()
        return
      }
      if (element.getAttribute('data-field') === 'task.priority') {
        handlePriorityChange(element)
        return
      }
      if (element.getAttribute('data-field') === 'task.assignee' || element.getAttribute('data-field') === 'task.due') {
        handleFieldEdit(element)
        return
      }
      if (element.getAttribute('data-field') === 'meet.date') {
        handleFieldEdit(element)
        return
      }
    })

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        if (_projectionOpen) {
          closeProjection()
          return
        }
        _aiExtracted = null
        renderAiOutputs()
        return
      }
      if (event.key === 'Enter' && !event.shiftKey && event.target && event.target.id === 'mtn-task-new-text') {
        event.preventDefault()
        addTask()
      }
    })
  }

  function declareToolParams() {
    if (typeof tool.declareParams !== 'function') return
    tool.declareParams([
      {
        name: 'allowAi',
        label: 'Allow AI Service',
        type: 'toggle',
        default: '',
        severity: 'mandatory',
        hint: 'Set to yes (field setting allowAi: yes) to enable Summarize, Extract Action Items and Draft Minutes.'
      },
      {
        name: 'allowExportPdf',
        label: 'Allow PDF Export',
        type: 'toggle',
        default: '',
        severity: 'goodToHave',
        hint: 'Set to yes (field setting allowExportPdf: yes) so PDF exports open through the CMS print pipeline. Without it, exports download as HTML files that you print to PDF.'
      },
      {
        name: 'allowRequestSave',
        label: 'Allow Auto-save',
        type: 'toggle',
        default: '',
        severity: 'goodToHave',
        hint: 'Set to yes (field setting allowRequestSave: yes) so changes commit to Firestore immediately instead of waiting for the parent Save button.'
      },
      {
        name: 'boardName',
        label: 'Organization / Board Name',
        type: 'text',
        default: '',
        severity: 'optional',
        hint: 'Shown at the top of board-format and PDF exports, e.g. "Acme Foundation Board of Directors".'
      },
      {
        name: 'aiLanguage',
        label: 'AI Output Language',
        type: 'text',
        default: 'English',
        severity: 'optional',
        hint: 'Language for AI-generated summaries, task extraction and minutes drafts.'
      }
    ])
  }

  function reportMissingAiParam() {
    if (allowAi()) return
    if (typeof tool.reportMissingParams !== 'function') return
    tool.reportMissingParams([
      {
        name: 'allowAi',
        label: 'Allow AI Service',
        type: 'toggle',
        default: '',
        severity: 'mandatory',
        reason: 'Summarize, extract action items and draft minutes need the AI relay (field setting allowAi: yes).'
      }
    ], 'The Meeting Notes tool needs 1 parameter to enable its AI features.')
  }

  function declareToolOutput() {
    if (typeof tool.declareOutput !== 'function') return
    tool.declareOutput({
      type: 'object',
      properties: {
        version: { type: 'string' },
        meeting: {
          type: 'object',
          properties: {
            title: { type: 'string' }, date: { type: 'string' }, timestart: { type: 'string' },
            timeend: { type: 'string' }, location: { type: 'string' }, chair: { type: 'string' },
            minutetaker: { type: 'string' }, attendees: { type: 'string' }, waitingMs: { type: 'number' }
          }
        },
        subjects: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' }, title: { type: 'string' }, notes: { type: 'string' }, notesHtml: { type: 'string' },
              status: { type: 'string' }, durationMinutes: { type: 'number' }, spentMs: { type: 'number' },
              decisions: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } } } }
            }
          }
        },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' }, text: { type: 'string' }, assignee: { type: 'string' },
              dueDate: { type: 'string' }, priority: { type: 'string' }, status: { type: 'string' }, source: { type: 'string' }, subjectId: { type: 'string' }
            }
          }
        },
        rawnotes: { type: 'string' },
        ai: { type: 'object', properties: { summary: { type: 'string' }, minutesDraft: { type: 'string' } } }
      }
    })
  }

  // ── entry point ──
  tool.onReady(function (value) {
    DB = normalizeDatabase(value)
    _lastStagedJson = JSON.stringify(DB)

    bindEvents()
    declareToolParams()
    declareToolOutput()
    reportMissingAiParam()

    var queryTab = paramOr('tab', '')
    var validTabs = ['subjects', 'meeting', 'tasks', 'ai', 'exports']
    if (validTabs.indexOf(queryTab) !== -1) _ui.tab = queryTab

    renderAll()
    switchTab(_ui.tab)

    if (paramOr('drawer', '') === '1') openProjection()

    _readOnly = (typeof tool.isReadOnly === 'function') ? !!tool.isReadOnly() : false
    _user = getUserSafe()
    loadPermittedUsers()
    applyAssigneePickers()

    if (typeof tool.getUser !== 'function') {
      _noIdentity = true
      applyReadOnlyState()
    } else if (!_user || !getRoles().length) {
      pollIdentity()
    } else {
      applyReadOnlyState()
    }

    if (typeof tool.onReadonlyChange === 'function') {
      tool.onReadonlyChange(function (readOnly) {
        _readOnly = !!readOnly
        applyReadOnlyState()
        renderAll()
      })
    }
    if (typeof tool.onUserChange === 'function') {
      tool.onUserChange(function (user) {
        _user = user || getUserSafe()
        _noIdentity = false
        renderAll()
      })
    }
    if (typeof tool.onPermittedUsersChange === 'function') {
      tool.onPermittedUsersChange(function (users) {
        _permittedUsers = Array.isArray(users) ? users : []
        applyAssigneePickers()
        renderTasks()
        if (_projectionOpen) renderProjectionBody()
      })
    }
    if (typeof tool.onValueChange === 'function') {
      tool.onValueChange(function (newValue) {
        if (newValue == null) return
        var json = JSON.stringify(newValue)
        if (json === _lastStagedJson) return
        _lastStagedJson = json
        DB = normalizeDatabase(newValue)
        renderAll()
      })
    }

    window.addEventListener('pagehide', flushPendingSave)
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushPendingSave()
    })
    try { setInterval(tickTimer, 500) } catch (e) { /* no-op */ }
  })
})()
