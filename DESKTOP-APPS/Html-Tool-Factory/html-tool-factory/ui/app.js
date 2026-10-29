'use strict'

// Dashboard logic. Plain JavaScript, no framework, no build step.
// All server calls go through small helpers at the bottom of the file.

const state = {
  config: null,
  provider: null,
  stageSequence: [],
  stageTitles: {},
  catalog: null,
  runs: [],
  currentRunId: null,
  payload: null,
  selectedIdea: null,
  openFile: null,
  openFileContent: '',
  activeTab: 'timeline',
  eventSource: null,
  pollingTimer: null,
  lastEventKey: ''
}

const elements = {}

function byId(id) {
  return document.getElementById(id)
}

function cacheElements() {
  ;[
    'providerChip', 'btnSettings', 'btnNewRun', 'runsList', 'runsCount', 'catalogLine',
    'newRunPanel', 'ideaSearch', 'ideasList', 'inputIdeaName', 'inputIndustryFocus',
    'inputIterations', 'inputTasksPerIteration', 'btnCreateRun', 'btnCreateRunIdle',
    'btnCancelNew', 'newRunError',
    'runPanel', 'runTitle', 'runStatus', 'runStage', 'runIteration', 'runIdea', 'runToolFolder',
    'btnStart', 'btnStep', 'btnPreview', 'btnOpenDocs', 'btnPause', 'btnStop', 'btnDelete', 'stageTrack',
    'btnContinue', 'btnRestart', 'restartModal', 'btnCancelRestart', 'btnConfirmRestart',
    'restartConfirmText', 'restartTarget', 'restartError',
    'statAiCalls', 'statTokens', 'statTasks', 'statChecks', 'statSummary', 'runError',
    'runTabs', 'btnOpenSsot', 'eventStream', 'emptyPanel',
    'settingsModal', 'btnCloseSettings', 'btnSaveSettings', 'settingsStatus',
    'setProvider', 'setGatewayUrl', 'setGatewayKey', 'setGatewayHost', 'setGatewayProvider',
    'setGatewayModel', 'setOpenAiUrl', 'setOpenAiKey', 'setOpenAiModel', 'setOllamaHost',
    'setOllamaModel', 'setMaxCalls', 'setMaxChars', 'settingsPath'
  ].forEach((id) => { elements[id] = byId(id) })
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US')
}

function formatTime(isoText) {
  if (!isoText) return ''
  const date = new Date(isoText)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part) => String(part).padStart(2, '0')
  return pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds())
}

function statusChipClass(status) {
  if (status === 'running') return 'chip chip-run'
  if (status === 'paused') return 'chip chip-pause'
  if (status === 'done') return 'chip chip-ok'
  if (status === 'error') return 'chip chip-bad'
  if (status === 'stopped') return 'chip chip-bad'
  return 'chip chip-neutral'
}

function priorityChipClass(value) {
  if (value === 'high' || value === 'must') return 'chip chip-high'
  if (value === 'medium' || value === 'should') return 'chip chip-medium'
  if (value === 'must') return 'chip chip-must'
  return 'chip chip-low'
}

// ---------------------------------------------------------------- API helpers

async function apiGet(url) {
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) {
    const error = new Error(data && data.error || ('HTTP ' + response.status))
    error.details = data || {}
    throw error
  }
  return data
}

async function apiPost(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  })
  const data = await response.json()
  if (!response.ok) {
    const error = new Error(data && data.error || ('HTTP ' + response.status))
    error.details = data || {}
    throw error
  }
  return data
}

// ------------------------------------------------------------------- boot

async function boot() {
  cacheElements()
  bindEvents()
  try {
    const statePayload = await apiGet('/api/state')
    state.config = statePayload.config
    state.provider = statePayload.provider
    state.stageSequence = statePayload.stageSequence || []
    state.stageTitles = statePayload.stageTitles || {}
    state.catalog = statePayload.catalog
    renderProvider()
    renderCatalogLine()
    fillSettingsForm()
  } catch (error) {
    elements.providerChip.textContent = 'Provider: server not reachable'
    elements.providerChip.className = 'chip chip-bad'
  }
  await loadRuns()
  if (state.runs.length) selectRun(state.runs[0].id)
}

function renderProvider() {
  if (!state.provider) return
  const configured = state.provider.configured
  elements.providerChip.textContent = 'Provider: ' + state.provider.label
  elements.providerChip.className = 'chip ' + (configured ? 'chip-ok' : 'chip-bad')
  elements.providerChip.title = state.provider.detail || ''
}

function renderCatalogLine() {
  if (!state.catalog) return
  if (state.catalog.ok) {
    elements.catalogLine.textContent = 'Idea catalog: ' + formatNumber(state.catalog.total) + ' ideas'
    elements.catalogLine.title = state.catalog.path
  } else {
    elements.catalogLine.textContent = 'Idea catalog not readable: ' + (state.catalog.error || '')
    elements.catalogLine.title = state.catalog.path || ''
  }
}

// ------------------------------------------------------------------- runs list

async function loadRuns() {
  try {
    const payload = await apiGet('/api/runs')
    state.runs = payload.runs || []
  } catch (_error) {
    state.runs = []
  }
  renderRuns()
}

function renderRuns() {
  elements.runsCount.textContent = String(state.runs.length)
  if (!state.runs.length) {
    elements.runsList.innerHTML = '<p class="empty">No runs yet.</p>'
    return
  }
  elements.runsList.innerHTML = state.runs.map((run) => {
    const activeClass = run.id === state.currentRunId ? ' is-active' : ''
    return '<button class="run-item' + activeClass + '" type="button" data-run="' + escapeHtml(run.id) + '">' +
      '<span class="run-item-title">' + escapeHtml(run.idea && run.idea.name || run.id) + '</span>' +
      '<span class="run-item-meta">' +
      '<span class="' + statusChipClass(run.status) + '">' + escapeHtml(run.status) + '</span>' +
      '<span>iter ' + escapeHtml(run.iteration || 0) + '</span>' +
      '</span>' +
      '</button>'
  }).join('')
}

async function selectRun(runId) {
  state.currentRunId = runId
  state.openFile = null
  state.openFileContent = ''
  elements.newRunPanel.hidden = true
  elements.emptyPanel.hidden = true
  elements.runPanel.hidden = false
  renderRuns()
  await refreshRun()
  connectEventStream(runId)
}

async function refreshRun() {
  if (!state.currentRunId) return
  try {
    const payload = await apiGet('/api/runs/' + encodeURIComponent(state.currentRunId))
    state.payload = payload
    renderRun()
  } catch (error) {
    elements.runError.textContent = 'Could not load the run: ' + error.message
    elements.runError.hidden = false
  }
}

function renderRun() {
  const payload = state.payload
  if (!payload || !payload.run) return
  const run = payload.run
  const ssot = payload.ssot || {}

  elements.runTitle.textContent = run.idea && run.idea.name || run.id
  elements.runStatus.textContent = run.status
  elements.runStatus.className = statusChipClass(run.status)
  elements.runStage.textContent = 'Stage: ' + (state.stageTitles[run.stage] || run.stage)
  elements.runIteration.textContent = 'Iteration ' + (run.iteration || 0) + ' of ' +
    (run.options && run.options.maxIterations || 0)
  elements.runIdea.textContent = run.idea && run.idea.id ? 'Idea ' + run.idea.id : ''
  const toolName = payload.toolName || (run.idea && run.idea.toolName) || ''
  elements.runToolFolder.innerHTML = toolName
    ? 'Tool folder: <strong>' + escapeHtml(toolName) + '</strong>' +
      (payload.toolFolder ? ' <span class="mono tiny">' + escapeHtml(payload.toolFolder) + '</span>' : '') +
      (payload.toolFolderUri ? ' <a class="tiny" href="' + escapeHtml(payload.toolFolderUri) + '">open folder</a>' : '')
    : ''
  elements.btnPreview.disabled = !payload.previewPath
  elements.btnOpenDocs.disabled = !(payload.files || []).some((file) => file.relativePath === 'docs/index.html')

  const isActive = run.status === 'running'
  elements.btnStart.disabled = isActive || run.status === 'done'
  elements.btnStep.disabled = run.status === 'done'
  elements.btnPause.disabled = !isActive
  elements.btnStop.disabled = run.status === 'done' || run.status === 'stopped'
  elements.btnContinue.disabled = isActive
  elements.btnRestart.disabled = isActive

  const tasks = ssot.tasks || []
  const doneTasks = tasks.filter((task) => task.status === 'done').length
  const tests = ssot.tests || []
  const lastIterationTests = tests.filter((test) => test.iteration === (run.iteration || 1))
  const failing = lastIterationTests.filter((test) => test.ok === false).length
  const estimatedTokens = Math.ceil(((run.counters && run.counters.inputChars || 0) +
    (run.counters && run.counters.outputChars || 0)) / 4)

  elements.statAiCalls.textContent = formatNumber(run.counters && run.counters.aiCalls)
  elements.statTokens.textContent = formatNumber(estimatedTokens)
  elements.statTasks.textContent = doneTasks + ' / ' + tasks.length
  elements.statChecks.textContent = lastIterationTests.length
    ? (lastIterationTests.length - failing) + ' / ' + lastIterationTests.length + ' pass'
    : 'n/a'
  elements.statSummary.textContent = run.lastSummary || '-'
  elements.statSummary.title = run.lastSummary || ''

  if (run.lastError && (run.status === 'error' || run.status === 'paused')) {
    elements.runError.textContent = '[' + (run.lastError.stage || '') + '] ' + run.lastError.message
    elements.runError.hidden = false
  } else {
    elements.runError.hidden = true
  }

  renderStageTrack(run)
  // The live log is append only while it is open; rebuilding it would fight the
  // event stream and lose the scroll position.
  if (state.activeTab !== 'events' || !byId('tab-events') || byId('tab-events').dataset.rendered !== '1') {
    renderActiveTab()
  }
}

function renderStageTrack(run) {
  const currentIndex = state.stageSequence.indexOf(run.stage)
  elements.stageTrack.innerHTML = state.stageSequence.map((stageId, index) => {
    let cssClass = 'stage-chip'
    if (run.stage === 'done' || index < currentIndex) cssClass += ' is-past'
    if (stageId === run.stage) cssClass += ' is-current'
    return '<span class="' + cssClass + '"><span class="dot"></span>' +
      escapeHtml(state.stageTitles[stageId] || stageId) + '</span>'
  }).join('')
}

// ------------------------------------------------------------------- tabs

function renderActiveTab() {
  const ssot = state.payload && state.payload.ssot
  if (!ssot) return
  const run = state.payload.run
  const renderers = {
    timeline: () => renderTimeline(ssot, run),
    tasks: () => renderTasks(ssot, run),
    risks: () => renderRisks(ssot),
    features: () => renderFeatures(ssot),
    ideas: () => renderIdeas(ssot),
    chat: () => renderChat(ssot, run),
    tests: () => renderTests(ssot),
    files: () => renderFiles(ssot),
    events: () => renderEventsTab()
  }
  const pane = byId('tab-' + state.activeTab)
  if (!pane) return
  const renderer = renderers[state.activeTab]
  if (renderer) pane.innerHTML = renderer()
  if (state.activeTab === 'events') pane.dataset.rendered = '1'
  if (state.activeTab === 'chat') bindChat()
  const streamElement = byId('eventStream')
  if (streamElement) {
    elements.eventStream = streamElement
    streamElement.scrollTop = streamElement.scrollHeight
  }
  document.querySelectorAll('#runTabs .tab[data-tab]').forEach((button) => {
    button.classList.toggle('is-active', button.getAttribute('data-tab') === state.activeTab)
  })
  document.querySelectorAll('.tab-pane').forEach((paneElement) => {
    paneElement.classList.toggle('is-active', paneElement.id === 'tab-' + state.activeTab)
  })
}

function renderTasks(ssot, run) {
  const tasks = (ssot.tasks || []).slice().reverse()
  if (!tasks.length) return '<p class="empty">No tasks yet. The planner adds them in the first iteration.</p>'
  const rows = tasks.map((task) => {
    const problemHtml = task.lastProblems && task.lastProblems.length
      ? '<div class="task-note">' + task.lastProblems.map((problem) => escapeHtml(problem)).join('<br>') + '</div>'
      : ''
    const acceptance = (task.acceptance || []).length
      ? '<ul class="task-acceptance">' + task.acceptance.map((line) => '<li>' + escapeHtml(line) + '</li>').join('') + '</ul>'
      : ''
    const files = (task.files || []).map((file) => '<span class="mono">' + escapeHtml(file) + '</span>').join(' ')
    const points = Number(task.points) || 0
    const pointsChip = '<span class="chip' + (points >= 80 ? ' chip-run' : '') + '" title="Estimated cost of this task out of 100">' +
      escapeHtml(points) + ' pts</span>'
    const batchChip = task.batchId
      ? ' <span class="muted tiny" title="Applied together with these tasks in one prompt">' +
        escapeHtml(task.batchId) + '</span>'
      : ''
    const stats = task.diffStats || null
    const diffHtml = task.diff
      ? '<details class="task-diff"><summary>Diff' + (stats
        ? ' <span class="diff-add">+' + stats.added + '</span> <span class="diff-del">-' + stats.removed + '</span>'
        : '') + '</summary><pre>' + escapeHtml(task.diff) + '</pre></details>'
      : ''
    return '<tr>' +
      '<td class="mono">' + escapeHtml(task.id) + '</td>' +
      '<td><strong>' + escapeHtml(task.title) + '</strong>' + acceptance + problemHtml + diffHtml + '</td>' +
      '<td>' + (files || '<span class="muted">-</span>') + '</td>' +
      '<td>' + pointsChip + batchChip + '</td>' +
      '<td><span class="chip">' + escapeHtml(task.kind || 'code') + '</span></td>' +
      '<td><span class="' + (task.status === 'done' ? 'chip chip-ok'
        : task.status === 'blocked' ? 'chip chip-bad'
          : task.status === 'doing' ? 'chip chip-run' : 'chip') + '">' + escapeHtml(task.status) + '</span>' +
      (task.attempts ? ' <span class="muted tiny">' + task.attempts + ' try</span>' : '') + '</td>' +
      '</tr>'
  }).join('')
  const openPoints = tasks
    .filter((task) => task.status !== 'done' && task.status !== 'skipped')
    .reduce((total, task) => total + (Number(task.points) || 0), 0)
  return '<p class="muted tiny">Iteration ' + escapeHtml((run.iteration || 0) + 1) +
    ' - every task is scored out of 100. The apply stage packs the smallest tasks into one prompt so a call ' +
    'carries about 100 points: ' + escapeHtml(openPoints) + ' point(s) still open. ' +
    'Each batch is applied and validated atomically - expand a diff to review it.</p>' +
    '<table class="data"><thead><tr><th style="width:64px">ID</th><th>Task</th><th style="width:170px">Files</th>' +
    '<th style="width:96px">Points</th><th style="width:70px">Kind</th><th style="width:120px">Status</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table>'
}

function renderTimeline(ssot, run) {
  const steps = ssot.steps || []
  if (!steps.length) {
    return '<p class="empty">No step recorded yet. Start the run to see each stage with its tokens and duration.</p>'
  }
  const byIteration = new Map()
  steps.forEach((step) => {
    const iteration = Number(step.iteration) || 1
    if (!byIteration.has(iteration)) byIteration.set(iteration, [])
    byIteration.get(iteration).push(step)
  })
  const stageTotal = Math.max(1, state.stageSequence.length)
  const blocks = Array.from(byIteration.entries())
    .sort((left, right) => right[0] - left[0])
    .map(([iteration, list]) => {
      const tokens = list.reduce((total, step) => total + (Number(step.tokens) || 0), 0)
      const calls = list.reduce((total, step) => total + ((step.usage && Number(step.usage.aiCalls)) || 0), 0)
      const ms = list.reduce((total, step) => total + (Number(step.ms) || 0), 0)
      const done = list.filter((step) => step.status === 'done').length
      const percent = Math.min(100, Math.round((done / stageTotal) * 100))
      const rows = list.map((step) => {
        const statusClass = step.status === 'done' ? 'chip chip-ok'
          : step.status === 'failed' ? 'chip chip-bad' : 'chip chip-run'
        const usage = step.usage || {}
        const stepTasks = Array.isArray(step.tasks) ? step.tasks : []
        const tasksLine = stepTasks.length
          ? '<div class="muted tiny">' + stepTasks.map((batch) => {
            const ids = (batch.tasks || []).map((task) => task.id + ' (' + (task.points || 0) + ')').join(' + ')
            const restore = batch.checkpoint
              ? ' <button class="btn btn-quiet" type="button" data-action="restore-checkpoint" data-batch="' +
                escapeHtml(batch.checkpoint) + '">restore</button>'
              : ''
            const tokens = batch.tokens ? ' - ' + formatNumber(batch.tokens) + ' tokens' : ''
            return escapeHtml(batch.id || 'batch') + ': ' + escapeHtml(ids) + ' = ' +
              escapeHtml(batch.points || 0) + ' pts' + tokens + (batch.status ? ' - ' + escapeHtml(batch.status) : '') +
              restore
          }).join('<br>') + '</div>'
          : ''
        return '<tr>' +
          '<td><span class="' + statusClass + '">' + escapeHtml(step.status || '') + '</span></td>' +
          '<td><strong>' + escapeHtml(step.title || step.stage || '') + '</strong>' +
          '<div class="muted tiny">' + escapeHtml(step.summary || '') + '</div>' + tasksLine + '</td>' +
          '<td class="mono">' + escapeHtml(((Number(step.ms) || 0) / 1000).toFixed(1)) + 's</td>' +
          '<td class="mono">' + formatNumber(step.tokens || 0) + '</td>' +
          '<td class="mono">' + escapeHtml(usage.aiCalls || 0) + '</td>' +
          '</tr>'
      }).join('')
      return '<div class="iteration-block">' +
        '<div class="iteration-head">' +
        '<strong>Iteration ' + escapeHtml(iteration) + '</strong>' +
        '<span class="muted tiny">' + formatNumber(tokens) + ' tokens - ' + formatNumber(calls) + ' AI calls - ' +
        (ms / 1000).toFixed(1) + 's</span>' +
        '</div>' +
        '<div class="iteration-bar"><span style="width:' + percent + '%"></span></div>' +
        '<table class="data"><thead><tr><th style="width:80px">Status</th><th>Step</th>' +
        '<th style="width:70px">Time</th><th style="width:80px">Tokens</th><th style="width:60px">Calls</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>' +
        '</div>'
    })
  const totalTokens = steps.reduce((total, step) => total + (Number(step.tokens) || 0), 0)
  return '<p class="muted tiny">' + formatNumber(steps.length) + ' steps recorded, ' +
    formatNumber(totalTokens) + ' estimated tokens in this session. Use "Run one stage" to walk it manually.</p>' +
    blocks.join('')
}

function renderRisks(ssot) {
  const risks = ssot.risks || []
  const questions = ssot.questions || []
  const riskRows = risks.length ? risks.map((risk) => '<tr>' +
    '<td class="mono">' + escapeHtml(risk.id) + '</td>' +
    '<td><span class="chip ' + (risk.severity === 'high' ? 'chip-high' : risk.severity === 'low' ? 'chip-low' : 'chip-medium') + '">' +
    escapeHtml(risk.severity) + '</span></td>' +
    '<td>' + escapeHtml(risk.text) + '</td>' +
    '<td>' + escapeHtml(risk.mitigation || '') + '</td>' +
    '<td><span class="chip ' + (risk.status === 'open' ? 'chip-pause' : 'chip-ok') + '">' + escapeHtml(risk.status || 'open') + '</span></td>' +
    '</tr>').join('') : '<tr><td colspan="5" class="empty">No risks recorded.</td></tr>'

  const questionRows = questions.length ? questions.map((question) => '<tr>' +
    '<td class="mono">' + escapeHtml(question.id) + '</td>' +
    '<td>' + escapeHtml(question.text) + '</td>' +
    '<td>' + escapeHtml(question.answer || question.assumption || '') + '</td>' +
    '<td><span class="chip ' + (question.status === 'answered' ? 'chip-ok' : 'chip-pause') + '">' +
    escapeHtml(question.status) + '</span>' +
    (question.answeredBy ? ' <span class="muted tiny">' + escapeHtml(question.answeredBy) + '</span>' : '') + '</td>' +
    '</tr>').join('') : '<tr><td colspan="4" class="empty">No open questions.</td></tr>'

  return '<h4>Risks</h4>' +
    '<table class="data"><thead><tr><th style="width:60px">ID</th><th style="width:80px">Severity</th><th>Risk</th>' +
    '<th>Mitigation</th><th style="width:100px">Status</th></tr></thead><tbody>' + riskRows + '</tbody></table>' +
    '<h4>Questions and decisions</h4>' +
    '<table class="data"><thead><tr><th style="width:60px">ID</th><th>Question</th><th>Resolution</th>' +
    '<th style="width:120px">Status</th></tr></thead><tbody>' + questionRows + '</tbody></table>'
}

function renderFeatures(ssot) {
  const features = ssot.features || []
  if (!features.length) return '<p class="empty">No features defined yet.</p>'
  const rows = features.map((feature) => '<tr>' +
    '<td class="mono">' + escapeHtml(feature.id) + '</td>' +
    '<td><strong>' + escapeHtml(feature.title) + '</strong><div class="muted tiny">' + escapeHtml(feature.description || '') + '</div></td>' +
    '<td><span class="chip ' + (feature.priority === 'must' ? 'chip-must' : feature.priority === 'could' ? 'chip-low' : 'chip-medium') + '">' +
    escapeHtml(feature.priority) + '</span></td>' +
    '<td><span class="chip ' + (feature.status === 'done' ? 'chip-ok' : 'chip') + '">' + escapeHtml(feature.status) + '</span></td>' +
    '</tr>').join('')
  return '<table class="data"><thead><tr><th style="width:60px">ID</th><th>Feature</th>' +
    '<th style="width:90px">Priority</th><th style="width:90px">Status</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<h4>Product summary</h4>' +
    '<table class="data"><tbody>' +
    '<tr><th style="width:150px">Problem</th><td>' + escapeHtml(ssot.product && ssot.product.problem || '') + '</td></tr>' +
    '<tr><th>Solution</th><td>' + escapeHtml(ssot.product && ssot.product.solution || '') + '</td></tr>' +
    '<tr><th>Audience</th><td>' + escapeHtml(ssot.product && ssot.product.audience || '') + '</td></tr>' +
    '</tbody></table>'
}

function renderIdeas(ssot) {
  const ideas = (ssot.ideas || []).slice().reverse()
  if (!ideas.length) return '<p class="empty">No improvement ideas yet. They appear after the first full iteration.</p>'
  const rows = ideas.map((idea) => '<tr>' +
    '<td class="mono">' + escapeHtml(idea.id) + '</td>' +
    '<td><strong>' + escapeHtml(idea.title) + '</strong></td>' +
    '<td>' + escapeHtml(idea.why || '') + '</td>' +
    '<td><span class="' + priorityChipClass(idea.impact) + '">' + escapeHtml(idea.impact) + '</span></td>' +
    '<td><span class="chip ' + (idea.status === 'done' ? 'chip-ok' : idea.status === 'planned' ? 'chip-run' : 'chip') + '">' +
    escapeHtml(idea.status) + '</span></td>' +
    '</tr>').join('')
  return '<table class="data"><thead><tr><th style="width:60px">ID</th><th style="width:230px">Idea</th><th>Why it matters</th>' +
    '<th style="width:80px">Impact</th><th style="width:90px">Status</th></tr></thead><tbody>' + rows + '</tbody></table>'
}

function renderTests(ssot) {
  const tests = (ssot.tests || []).slice(-60).reverse()
  if (!tests.length) return '<p class="empty">No checks have run yet.</p>'
  const rows = tests.map((test) => '<tr>' +
    '<td class="mono">' + escapeHtml(formatTime(test.at)) + '</td>' +
    '<td class="mono">' + escapeHtml(test.iteration || '-') + '</td>' +
    '<td>' + escapeHtml(test.name) + '</td>' +
    '<td><span class="chip ' + (test.ok ? 'chip-ok' : 'chip-bad') + '">' + (test.ok ? 'pass' : 'fail') + '</span></td>' +
    '<td class="detail-text">' + escapeHtml(String(test.detail || '').slice(0, 300)) + '</td>' +
    '</tr>').join('')
  return '<table class="data"><thead><tr><th style="width:80px">Time</th><th style="width:40px">Iter</th><th>Check</th>' +
    '<th style="width:60px">Result</th><th>Detail</th></tr></thead><tbody>' + rows + '</tbody></table>'
}

function renderFiles() {
  const files = (state.payload && state.payload.files || [])
  if (state.openFile) {
    return '<p><button class="btn btn-quiet" type="button" data-action="close-file">Back to the file list</button> ' +
      '<span class="mono">' + escapeHtml(state.openFile) + '</span></p>' +
      '<pre class="event-stream" style="height:auto;max-height:520px">' + escapeHtml(state.openFileContent) + '</pre>'
  }
  if (!files.length) return '<p class="empty">The application folder is empty. Tasks create the first files.</p>'
  const rows = files.map((file) => {
    const absolute = String(file.absolutePath || file.relativePath).replace(/\\/g, '/')
    const vscodeHref = 'vscode://file/' + absolute
    const diskHref = 'file:///' + absolute
    return '<tr class="file-row" data-file="' + escapeHtml(file.relativePath) + '">' +
      '<td class="mono">' + escapeHtml(file.relativePath) + '</td>' +
      '<td class="mono">' + escapeHtml((file.size / 1024).toFixed(1)) + ' KB</td>' +
      '<td><a href="' + escapeHtml(vscodeHref) + '">VS Code</a> ' +
      '<a href="' + escapeHtml(diskHref) + '">disk</a> ' +
      '<button class="btn btn-quiet" type="button" data-action="copy-path" data-path="' +
      escapeHtml(absolute) + '">copy path</button></td>' +
      '</tr>'
  }).join('')
  return '<p class="muted tiny">Everything in this list is the generated application, read straight from disk. ' +
    'Click a row to read it here, or use VS Code / disk to open the real file without this server.</p>' +
    '<table class="data"><thead><tr><th>File</th><th style="width:90px">Size</th>' +
    '<th style="width:230px">Open on disk</th></tr></thead><tbody>' + rows + '</tbody></table>'
}

function renderChat(ssot, run) {
  const chat = (state.payload && state.payload.chat) || []
  const rows = chat.length
    ? chat.map((entry) => {
      const isOperator = entry.role === 'operator'
      const changes = (entry.changes || []).length
        ? '<ul class="task-acceptance">' + entry.changes.map((line) => '<li>' + escapeHtml(line) + '</li>').join('') + '</ul>'
        : ''
      return '<div class="chat-msg' + (isOperator ? ' chat-msg-operator' : '') + '">' +
        '<div class="chat-who">' + (isOperator ? 'You' : 'Partner') +
        ' <span class="muted tiny">' + escapeHtml(String(entry.at || '').slice(11, 16)) + '</span></div>' +
        '<div class="chat-text">' + escapeHtml(entry.text || '') + '</div>' + changes +
        '</div>'
    }).join('')
    : '<p class="empty">Describe an idea, a refinement or a bug for this tool. The chat only updates the SSOT; the normal plan turns it into work.</p>'
  return '<p class="muted tiny">This chat writes the <strong>SSOT only</strong>: definition, features, ideas, risks, ' +
    'questions, decisions and tasks. It never edits files and never starts a build.</p>' +
    '<div class="chat-log" id="chatLog">' + rows + '</div>' +
    '<div class="chat-compose">' +
    '<textarea id="chatInput" rows="3" placeholder="Example: a quote line must show tax per line. Also add a bug task for the empty select in the header."></textarea>' +
    '<button id="btnSendChat" class="btn btn-primary" type="button">Send to SSOT</button>' +
    '</div>'
}

function bindChat() {
  const button = byId('btnSendChat')
  const input = byId('chatInput')
  const log = byId('chatLog')
  if (log) log.scrollTop = log.scrollHeight
  if (!button || !input || !state.currentRunId) return
  button.addEventListener('click', async () => {
    const message = String(input.value || '').trim()
    if (!message) return
    button.disabled = true
    button.textContent = 'Writing the SSOT...'
    try {
      await apiPost('/api/runs/' + encodeURIComponent(state.currentRunId) + '/chat', { message })
      await refreshRun()
      renderActiveTab()
    } catch (error) {
      button.disabled = false
      button.textContent = 'Send to SSOT'
      showRunError(error.message)
    }
  })
}

function renderEventsTab() {
  const events = (state.payload && state.payload.events || [])
  const lines = events.length ? events.slice(-250).map(eventLineHtml).join('')
    : '<p class="empty">No events yet.</p>'
  return '<div id="eventStream" class="event-stream">' + lines + '</div>'
}

function eventLineHtml(event) {
  const typeClass = event.type === 'stage-error' || event.type === 'error' ? ' event-error'
    : event.type === 'warn' ? ' event-warn'
      : event.type === 'stage-complete' ? ' event-ok' : ''
  return '<div class="event-line' + typeClass + '">' +
    '<span class="event-time">' + escapeHtml(formatTime(event.at)) + '</span>' +
    '<span class="event-stage">' + escapeHtml(String(event.stage || 'system').slice(0, 14)) + '</span>' +
    '<span class="event-message">' + escapeHtml(event.message || '') + '</span>' +
    '</div>'
}

function appendEvent(event) {
  const eventKey = String(event.at) + '|' + String(event.message)
  if (eventKey === state.lastEventKey) return
  state.lastEventKey = eventKey
  if (state.payload) {
    state.payload.events = (state.payload.events || []).concat([event]).slice(-400)
  }
  if (state.activeTab === 'events') {
    const pane = byId('tab-events')
    const target = pane.querySelector('#eventStream') || elements.eventStream
    if (!target) return
    const shouldStick = target.scrollTop + target.clientHeight >= target.scrollHeight - 60
    target.insertAdjacentHTML('beforeend', eventLineHtml(event))
    if (target.children.length > 400) target.removeChild(target.firstChild)
    if (shouldStick) target.scrollTop = target.scrollHeight
  }
  if (event.type === 'stage-start' || event.type === 'stage-complete' || event.type === 'stage-error') {
    refreshRun()
    loadRuns()
  }
}

function connectEventStream(runId) {
  if (state.eventSource) {
    state.eventSource.close()
    state.eventSource = null
  }
  try {
    state.eventSource = new EventSource('/api/runs/' + encodeURIComponent(runId) + '/events')
    state.eventSource.onmessage = (messageEvent) => {
      try {
        const event = JSON.parse(messageEvent.data)
        appendEvent(event)
      } catch (_error) {
        // ignore malformed frames
      }
    }
    state.eventSource.onerror = () => {
      if (state.eventSource) {
        state.eventSource.close()
        state.eventSource = null
      }
      window.setTimeout(() => {
        if (state.currentRunId === runId) connectEventStream(runId)
      }, 4000)
    }
  } catch (_error) {
    // EventSource is optional; the poll below keeps the view fresh.
  }
  if (state.pollingTimer) window.clearInterval(state.pollingTimer)
  state.pollingTimer = window.setInterval(() => {
    if (state.currentRunId && state.payload && state.payload.run &&
      (state.payload.run.status === 'running' || state.payload.run.status === 'paused')) {
      refreshRun()
      loadRuns()
    }
  }, 5000)
}

// ------------------------------------------------------------------- actions

async function startRun() {
  if (!state.currentRunId) return
  try {
    await apiPost('/api/runs/' + encodeURIComponent(state.currentRunId) + '/start', {})
    await refreshRun()
    await loadRuns()
  } catch (error) {
    showRunError(error.message)
  }
}

async function stepRun() {
  if (!state.currentRunId) return
  elements.btnStep.disabled = true
  try {
    const result = await apiPost('/api/runs/' + encodeURIComponent(state.currentRunId) + '/step', {})
    if (result.error) showRunError(result.error)
    await refreshRun()
    await loadRuns()
  } catch (error) {
    showRunError(error.message)
  } finally {
    elements.btnStep.disabled = false
  }
}

async function pauseRun() {
  if (!state.currentRunId) return
  try {
    await apiPost('/api/runs/' + encodeURIComponent(state.currentRunId) + '/pause', {})
    await refreshRun()
    await loadRuns()
  } catch (error) {
    showRunError(error.message)
  }
}

async function stopRun() {
  if (!state.currentRunId) return
  try {
    await apiPost('/api/runs/' + encodeURIComponent(state.currentRunId) + '/stop', {})
    await refreshRun()
    await loadRuns()
  } catch (error) {
    showRunError(error.message)
  }
}

// Continue: keep the built tool, reopen the parked work, raise the iteration
// budget and start the loop again.
async function continueRun() {
  if (!state.currentRunId) return
  try {
    await apiPost('/api/runs/' + encodeURIComponent(state.currentRunId) + '/continue', { iterations: 5 })
    await apiPost('/api/runs/' + encodeURIComponent(state.currentRunId) + '/start', {})
    await refreshRun()
    await loadRuns()
  } catch (error) {
    showRunError(error.message)
  }
}

function openRestartModal() {
  if (!state.currentRunId) return
  const payload = state.payload || {}
  const run = payload.run || {}
  elements.restartTarget.textContent = payload.toolFolder || run.toolDirectory || ''
  elements.restartConfirmText.value = ''
  elements.restartError.hidden = true
  elements.restartModal.hidden = false
  if (typeof elements.restartConfirmText.focus === 'function') elements.restartConfirmText.focus()
}

function closeRestartModal() {
  elements.restartModal.hidden = true
}

// Restart deletes the generated tool folder, so it needs the typed run id as a
// real confirmation, not a single click.
async function confirmRestart() {
  const runId = state.currentRunId
  if (!runId) return
  const typed = String(elements.restartConfirmText.value || '').trim()
  if (typed !== runId) {
    elements.restartError.textContent = 'Type the run id exactly to confirm: ' + runId
    elements.restartError.hidden = false
    return
  }
  elements.btnConfirmRestart.disabled = true
  try {
    await apiPost('/api/runs/' + encodeURIComponent(runId) + '/restart', { confirm: typed })
    closeRestartModal()
    await apiPost('/api/runs/' + encodeURIComponent(runId) + '/start', {})
    await refreshRun()
    await loadRuns()
  } catch (error) {
    elements.restartError.textContent = error.message
    elements.restartError.hidden = false
  } finally {
    elements.btnConfirmRestart.disabled = false
  }
}

// Restores the files of one batch. A 409 means a file was edited outside the
// factory; the operator has to confirm before it is overwritten.
async function restoreCheckpoint(batchId) {
  if (!state.currentRunId || !batchId) return
  const base = '/api/runs/' + encodeURIComponent(state.currentRunId) + '/checkpoints/' +
    encodeURIComponent(batchId) + '/restore'
  try {
    await apiPost(base, { force: false })
    await refreshRun()
    await loadRuns()
  } catch (error) {
    const conflicts = error.details && error.details.conflicts
    if (!conflicts || !conflicts.length) {
      showRunError(error.message)
      return
    }
    if (!window.confirm('These files changed outside the factory:\n' + conflicts.join('\n') +
      '\n\nOverwrite them with the checkpoint?')) return
    try {
      await apiPost(base, { force: true })
      await refreshRun()
      await loadRuns()
    } catch (forceError) {
      showRunError(forceError.message)
    }
  }
}

async function deleteRun() {
  if (!state.currentRunId) return
  if (!window.confirm('Delete the run record and the generated tool folder of this run?')) return
  try {
    await fetch('/api/runs/' + encodeURIComponent(state.currentRunId), { method: 'DELETE' })
    state.currentRunId = null
    state.payload = null
    elements.runPanel.hidden = true
    elements.emptyPanel.hidden = false
    await loadRuns()
  } catch (error) {
    showRunError(error.message)
  }
}

function showRunError(message) {
  elements.runError.textContent = message
  elements.runError.hidden = false
}

function openPreview(relativePath) {
  if (!state.currentRunId) return
  const target = relativePath || (state.payload && state.payload.previewPath) || 'app/test-harness.html'
  window.open('/api/runs/' + encodeURIComponent(state.currentRunId) +
    '/preview?path=' + encodeURIComponent(target), '_blank')
}

async function openFile(relativePath) {
  try {
    const payload = await apiGet('/api/runs/' + encodeURIComponent(state.currentRunId) +
      '/file?path=' + encodeURIComponent(relativePath))
    state.openFile = relativePath
    state.openFileContent = payload.content || ''
  } catch (error) {
    state.openFile = relativePath
    state.openFileContent = 'Could not read the file: ' + error.message
  }
  renderActiveTab()
}

// ------------------------------------------------------------------- new run

function openNewRun() {
  state.selectedIdea = null
  elements.newRunPanel.hidden = false
  elements.runPanel.hidden = true
  elements.emptyPanel.hidden = true
  elements.newRunError.hidden = true
  elements.inputIdeaName.value = ''
  elements.inputIndustryFocus.value = ''
  if (state.config) {
    elements.inputIterations.value = state.config.limits.maxIterations
    elements.inputTasksPerIteration.value = state.config.limits.maxTasksPerIteration
  }
  loadIdeas('')
}

let ideaSearchTimer = null

function scheduleIdeaSearch() {
  if (ideaSearchTimer) window.clearTimeout(ideaSearchTimer)
  ideaSearchTimer = window.setTimeout(() => {
    loadIdeas(elements.ideaSearch.value || '')
  }, 250)
}

async function loadIdeas(searchText) {
  elements.ideasList.innerHTML = '<p class="empty">Loading ideas...</p>'
  try {
    const payload = await apiGet('/api/ideas?limit=40&search=' + encodeURIComponent(searchText))
    const ideas = payload.ideas || []
    if (!ideas.length) {
      elements.ideasList.innerHTML = '<p class="empty">No idea matched that search.</p>'
      return
    }
    elements.ideasList.innerHTML = ideas.map((idea) => {
      const selected = state.selectedIdea && state.selectedIdea.id === idea.id
      return '<label class="idea-row' + (selected ? ' is-selected' : '') + '">' +
        '<input type="radio" name="ideaPick" value="' + escapeHtml(idea.id) + '"' + (selected ? ' checked' : '') + '>' +
        '<span>' +
        '<span class="idea-name">' + escapeHtml(idea.name) + '</span>' +
        '<span class="idea-purpose"> - ' + escapeHtml(idea.purpose || '') + '</span>' +
        '<span class="idea-tags">' +
        '<span class="chip">' + escapeHtml(idea.folder || idea.code) + '</span>' +
        (idea.category ? '<span class="chip">' + escapeHtml(idea.category) + '</span>' : '') +
        (idea.sub ? '<span class="chip">' + escapeHtml(idea.sub) + '</span>' : '') +
        (idea.development && idea.development.status ? '<span class="chip chip-run">' + escapeHtml(idea.development.status) + '</span>' : '') +
        (idea.isBuilt ? '<span class="chip chip-pause">built</span>' : '') +
        '</span>' +
        '</span>' +
        '</label>'
    }).join('')
    elements.ideasList.querySelectorAll('input[name="ideaPick"]').forEach((radioInput) => {
      radioInput.addEventListener('change', () => {
        const chosen = ideas.find((idea) => idea.id === radioInput.value)
        state.selectedIdea = chosen || null
        elements.inputIdeaName.value = chosen ? chosen.name : ''
        elements.ideasList.querySelectorAll('.idea-row').forEach((row) => row.classList.remove('is-selected'))
        radioInput.closest('.idea-row').classList.add('is-selected')
      })
    })
  } catch (error) {
    elements.ideasList.innerHTML = '<p class="empty">Could not load the catalog: ' + escapeHtml(error.message) + '</p>'
  }
}

async function createRun(startImmediately) {
  elements.newRunError.hidden = true
  const typedName = (elements.inputIdeaName.value || '').trim()
  const selected = state.selectedIdea
  if (!selected && !typedName) {
    elements.newRunError.textContent = 'Pick an idea from the list or type an idea name.'
    elements.newRunError.hidden = false
    return
  }
  const body = {
    ideaId: selected ? selected.id : '',
    ideaName: selected && !typedName ? selected.name : typedName,
    ideaPurpose: selected ? selected.purpose : '',
    ideaCategory: selected ? [selected.group, selected.category, selected.sub].filter(Boolean).join(' / ') : '',
    ideaFolder: selected ? (selected.folder || selected.code) : '',
    maxIterations: Number(elements.inputIterations.value) || 3,
    maxTasksPerIteration: Number(elements.inputTasksPerIteration.value) || 4,
    industryFocus: elements.inputIndustryFocus.value || ''
  }
  try {
    const payload = await apiPost('/api/runs', body)
    await loadRuns()
    await selectRun(payload.run.id)
    if (startImmediately) await startRun()
  } catch (error) {
    elements.newRunError.textContent = error.message
    elements.newRunError.hidden = false
  }
}

// ------------------------------------------------------------------- settings

const PROVIDER_PRESETS = {
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }
}

function fillSettingsForm() {
  const config = state.config
  if (!config) return
  elements.setProvider.value = config.provider
  elements.setGatewayUrl.value = config.uniconGateway.baseUrl || ''
  elements.setGatewayHost.value = config.uniconGateway.tenantHost || ''
  elements.setGatewayProvider.value = config.uniconGateway.defaultProvider || ''
  elements.setGatewayModel.value = config.uniconGateway.model || ''
  elements.setOpenAiUrl.value = config.openaiCompatible.baseUrl || ''
  elements.setOpenAiModel.value = config.openaiCompatible.model || ''
  elements.setOllamaHost.value = config.ollama.host || ''
  elements.setOllamaModel.value = config.ollama.model || ''
  elements.setMaxCalls.value = config.limits.maxAiCallsPerRun
  elements.setMaxChars.value = config.limits.maxTotalCharsPerRun
  elements.setGatewayKey.value = ''
  elements.setOpenAiKey.value = ''
  // Show what is already saved without ever sending the key back to the page.
  elements.setGatewayKey.placeholder = config.uniconGateway.hasApiKey
    ? 'saved: ' + config.uniconGateway.apiKeyMasked + ' (leave blank to keep)'
    : 'paste the gateway key'
  elements.setOpenAiKey.placeholder = config.openaiCompatible.hasApiKey
    ? 'saved: ' + config.openaiCompatible.apiKeyMasked + ' (leave blank to keep)'
    : 'sk-...'
  if (elements.settingsPath) {
    elements.settingsPath.textContent = config.configFilePath
      ? 'Settings file: ' + config.configFilePath + (config.configFileExists ? '' : ' (not created yet)')
      : ''
  }
  applyProviderSections()
}

function applyPreset(presetName) {
  const preset = PROVIDER_PRESETS[presetName]
  if (!preset) return
  elements.setProvider.value = 'openai-compatible'
  elements.setOpenAiUrl.value = preset.baseUrl
  elements.setOpenAiModel.value = preset.model
  applyProviderSections()
  elements.setOpenAiKey.focus()
}

function applyProviderSections() {
  const selectedProvider = elements.setProvider.value
  document.querySelectorAll('.settings-group').forEach((group) => {
    group.classList.toggle('is-active', group.getAttribute('data-provider') === selectedProvider)
  })
}

async function saveSettings() {
  const patch = {
    provider: elements.setProvider.value,
    uniconGateway: {
      baseUrl: elements.setGatewayUrl.value.trim(),
      tenantHost: elements.setGatewayHost.value.trim(),
      defaultProvider: elements.setGatewayProvider.value.trim(),
      model: elements.setGatewayModel.value.trim()
    },
    openaiCompatible: {
      baseUrl: elements.setOpenAiUrl.value.trim(),
      model: elements.setOpenAiModel.value.trim()
    },
    ollama: {
      host: elements.setOllamaHost.value.trim(),
      model: elements.setOllamaModel.value.trim()
    },
    limits: {
      maxAiCallsPerRun: Number(elements.setMaxCalls.value) || 80,
      maxTotalCharsPerRun: Number(elements.setMaxChars.value) || 2400000
    }
  }
  const gatewayKey = elements.setGatewayKey.value.trim()
  const openAiKey = elements.setOpenAiKey.value.trim()
  if (gatewayKey) patch.uniconGateway.apiKey = gatewayKey
  if (openAiKey) patch.openaiCompatible.apiKey = openAiKey

  try {
    const payload = await apiPost('/api/config', patch)
    state.config = payload.config
    state.provider = payload.provider
    renderProvider()
    fillSettingsForm()
    elements.settingsStatus.textContent = 'Settings saved.'
    elements.settingsStatus.hidden = false
    window.setTimeout(() => { elements.settingsStatus.hidden = true }, 3000)
  } catch (error) {
    elements.settingsStatus.textContent = 'Could not save: ' + error.message
    elements.settingsStatus.hidden = false
  }
}

// ------------------------------------------------------------------- binding

function bindEvents() {
  elements.btnNewRun.addEventListener('click', openNewRun)
  elements.btnCancelNew.addEventListener('click', () => {
    elements.newRunPanel.hidden = true
    if (state.payload) elements.runPanel.hidden = false
    else elements.emptyPanel.hidden = false
  })
  elements.ideaSearch.addEventListener('input', scheduleIdeaSearch)
  elements.btnCreateRun.addEventListener('click', () => createRun(true))
  elements.btnCreateRunIdle.addEventListener('click', () => createRun(false))

  elements.btnStart.addEventListener('click', startRun)
  elements.btnStep.addEventListener('click', stepRun)
  elements.btnPreview.addEventListener('click', () => openPreview('app/test-harness.html'))
  elements.btnOpenDocs.addEventListener('click', () => openPreview('docs/index.html'))
  elements.btnPause.addEventListener('click', pauseRun)
  elements.btnStop.addEventListener('click', stopRun)
  elements.btnContinue.addEventListener('click', continueRun)
  elements.btnRestart.addEventListener('click', openRestartModal)
  elements.btnCancelRestart.addEventListener('click', closeRestartModal)
  elements.btnConfirmRestart.addEventListener('click', confirmRestart)
  elements.btnDelete.addEventListener('click', deleteRun)

  elements.runTabs.addEventListener('click', (clickEvent) => {
    const tabButton = clickEvent.target.closest('.tab[data-tab]')
    if (!tabButton) return
    state.activeTab = tabButton.getAttribute('data-tab')
    renderActiveTab()
  })

  elements.btnOpenSsot.addEventListener('click', () => {
    if (!state.currentRunId) return
    window.open('/api/runs/' + encodeURIComponent(state.currentRunId) + '/ssot-html', '_blank')
  })

  elements.runsList.addEventListener('click', (clickEvent) => {
    const runButton = clickEvent.target.closest('.run-item')
    if (!runButton) return
    selectRun(runButton.getAttribute('data-run'))
  })

  document.body.addEventListener('click', (clickEvent) => {
    const restoreButton = clickEvent.target.closest('[data-action="restore-checkpoint"]')
    if (restoreButton) {
      restoreCheckpoint(restoreButton.getAttribute('data-batch') || '')
      return
    }
    const copyButton = clickEvent.target.closest('[data-action="copy-path"]')
    if (copyButton) {
      clickEvent.stopPropagation()
      const value = copyButton.getAttribute('data-path') || ''
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(() => {
          copyButton.textContent = 'copied'
          window.setTimeout(() => { copyButton.textContent = 'copy path' }, 1500)
        }).catch(() => { /* the link is still visible in the row */ })
      }
      return
    }
    const fileRow = clickEvent.target.closest('.file-row')
    if (fileRow) {
      openFile(fileRow.getAttribute('data-file'))
      return
    }
    const actionButton = clickEvent.target.closest('[data-action="close-file"]')
    if (actionButton) {
      state.openFile = null
      state.openFileContent = ''
      renderActiveTab()
    }
  })

  elements.btnSettings.addEventListener('click', () => {
    elements.settingsModal.hidden = false
    elements.settingsStatus.hidden = true
  })
  elements.btnCloseSettings.addEventListener('click', () => { elements.settingsModal.hidden = true })
  elements.settingsModal.addEventListener('click', (clickEvent) => {
    if (clickEvent.target === elements.settingsModal) elements.settingsModal.hidden = true
  })
  elements.setProvider.addEventListener('change', applyProviderSections)
  document.querySelectorAll('[data-preset]').forEach((presetButton) => {
    presetButton.addEventListener('click', () => applyPreset(presetButton.getAttribute('data-preset')))
  })
  elements.btnSaveSettings.addEventListener('click', saveSettings)

  document.addEventListener('keydown', (keyboardEvent) => {
    if (keyboardEvent.key === 'Escape' && !elements.settingsModal.hidden) {
      elements.settingsModal.hidden = true
    }
  })
}

document.addEventListener('DOMContentLoaded', boot)
