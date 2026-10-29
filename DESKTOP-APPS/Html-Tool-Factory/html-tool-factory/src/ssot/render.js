'use strict'

// Renders ssot.json into a readable, printable SSOT page. Deterministic: the
// same JSON always produces the same HTML, so the page can be regenerated
// after every stage without review.

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDateTime(isoText) {
  const value = String(isoText || '')
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (part) => String(part).padStart(2, '0')
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
    ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes())
}

function statusPill(status) {
  const known = ['todo', 'doing', 'done', 'blocked', 'skipped', 'open', 'mitigated', 'accepted',
    'planned', 'building', 'new', 'rejected', 'high', 'medium', 'low', 'must', 'should', 'could']
  const cssClass = known.includes(status) ? 'pill pill-' + status : 'pill'
  return '<span class="' + cssClass + '">' + escapeHtml(status) + '</span>'
}

function renderTaskRows(tasks) {
  if (!tasks.length) return '<p class="empty">No tasks yet.</p>'
  return tasks.map((task) => {
    const checked = task.status === 'done' ? ' checked' : ''
    return [
      '<tr class="task-row ' + escapeHtml(task.status) + '">',
      '<td class="task-check"><input type="checkbox" disabled' + checked + ' aria-label="' +
        escapeHtml(task.title) + '"></td>',
      '<td class="task-id">' + escapeHtml(task.id) + '</td>',
      '<td class="task-title">' + escapeHtml(task.title),
      task.files && task.files.length
        ? '<div class="task-files">' + task.files.map((file) => '<code>' + escapeHtml(file) + '</code>').join(' ') + '</div>'
        : '',
      task.acceptance && task.acceptance.length
        ? '<ul class="task-acceptance">' + task.acceptance.map((line) => '<li>' + escapeHtml(line) + '</li>').join('') + '</ul>'
        : '',
      '</td>',
      '<td>' + statusPill(task.kind || 'code') + '</td>',
      '<td>' + statusPill(task.status) + (task.attempts ? ' <span class="muted">' + task.attempts + ' try</span>' : '') + '</td>',
      '</tr>'
    ].join('')
  }).join('\n')
}

function renderRiskRows(risks) {
  if (!risks.length) return '<p class="empty">No risks recorded.</p>'
  return risks.map((risk) => [
    '<tr>',
    '<td class="task-id">' + escapeHtml(risk.id) + '</td>',
    '<td>' + statusPill(risk.severity || 'medium') + '</td>',
    '<td>' + escapeHtml(risk.text) + '</td>',
    '<td>' + escapeHtml(risk.mitigation || '') + '</td>',
    '<td>' + statusPill(risk.status || 'open') + '</td>',
    '</tr>'
  ].join('')).join('\n')
}

function renderQuestionRows(questions) {
  if (!questions.length) return '<p class="empty">No open questions.</p>'
  return questions.map((question) => [
    '<tr>',
    '<td class="task-id">' + escapeHtml(question.id) + '</td>',
    '<td>' + escapeHtml(question.text) + '</td>',
    '<td>' + escapeHtml(question.assumption || '') + '</td>',
    '<td>' + escapeHtml(question.answer || '') + '</td>',
    '<td>' + statusPill(question.status || 'open') + '</td>',
    '</tr>'
  ].join('')).join('\n')
}

function renderFeatureRows(features) {
  if (!features.length) return '<p class="empty">No features defined.</p>'
  return features.map((feature) => [
    '<tr>',
    '<td class="task-id">' + escapeHtml(feature.id) + '</td>',
    '<td>' + escapeHtml(feature.title) + '</td>',
    '<td>' + escapeHtml(feature.description || '') + '</td>',
    '<td>' + statusPill(feature.priority || 'should') + '</td>',
    '<td>' + statusPill(feature.status || 'planned') + '</td>',
    '</tr>'
  ].join('')).join('\n')
}

function renderIdeaRows(ideas) {
  if (!ideas.length) return '<p class="empty">No improvement ideas yet.</p>'
  return ideas.map((idea) => [
    '<tr>',
    '<td class="task-id">' + escapeHtml(idea.id) + '</td>',
    '<td>' + escapeHtml(idea.title) + '</td>',
    '<td>' + escapeHtml(idea.why || '') + '</td>',
    '<td>' + statusPill(idea.impact || 'medium') + '</td>',
    '<td>' + statusPill(idea.status || 'new') + '</td>',
    '</tr>'
  ].join('')).join('\n')
}

function renderTestRows(tests) {
  if (!tests.length) return '<p class="empty">No test results yet.</p>'
  return tests.slice(-40).reverse().map((test) => [
    '<tr>',
    '<td class="nowrap">' + escapeHtml(formatDateTime(test.at)) + '</td>',
    '<td>' + escapeHtml(test.name || '') + '</td>',
    '<td>' + (test.ok ? '<span class="pill pill-done">pass</span>' : '<span class="pill pill-blocked">fail</span>') + '</td>',
    '<td class="detail">' + escapeHtml(String(test.detail || '').slice(0, 400)) + '</td>',
    '</tr>'
  ].join('')).join('\n')
}

function renderIterationRows(iterations) {
  if (!iterations.length) return '<p class="empty">No iterations completed yet.</p>'
  return iterations.map((iteration) => [
    '<tr>',
    '<td class="nowrap">' + escapeHtml(iteration.n) + '</td>',
    '<td class="nowrap">' + escapeHtml(formatDateTime(iteration.finishedAt)) + '</td>',
    '<td>' + escapeHtml(iteration.summary || '') + '</td>',
    '<td class="nowrap">' + escapeHtml(iteration.tasksDone || 0) + '</td>',
    '<td class="nowrap">' + escapeHtml(iteration.testsPassed || 0) + '</td>',
    '<td class="nowrap">' + escapeHtml(iteration.tasksFailed || 0) + '</td>',
    '<td class="nowrap">' + escapeHtml(iteration.tokens || 0) + '</td>',
    '</tr>'
  ].join('')).join('\n')
}

function renderPersonaRows(personas) {
  if (!personas.length) return '<p class="empty">No persona created yet.</p>'
  return personas.map((persona) => [
    '<tr>',
    '<td class="task-id">' + escapeHtml(persona.id || '') + '</td>',
    '<td><strong>' + escapeHtml(persona.name || '') + '</strong><div class="muted">' + escapeHtml(persona.role || '') + '</div></td>',
    '<td>' + escapeHtml(persona.goal || '') + '</td>',
    '<td>' + escapeHtml(persona.context || '') + '</td>',
    '</tr>'
  ].join('')).join('\n')
}

function renderScenarioRows(scenarios) {
  if (!scenarios.length) return '<p class="empty">No scenario walked yet.</p>'
  return scenarios.map((scenario) => {
    const steps = (scenario.steps || []).map((step) => {
      return '<li>' + (step.ok ? '<span class="pill pill-done">ok</span>' : '<span class="pill pill-blocked">blocked</span>') +
        ' ' + escapeHtml(step.step) + (step.observation ? ' - <span class="muted">' + escapeHtml(step.observation) + '</span>' : '') + '</li>'
    }).join('')
    return '<tr>' +
      '<td class="task-id">' + escapeHtml(scenario.id || '') + '</td>' +
      '<td>' + escapeHtml(scenario.persona || '') + '</td>' +
      '<td>' + escapeHtml(scenario.goal || '') + '</td>' +
      '<td><ol style="margin:0;padding-left:18px">' + steps + '</ol></td>' +
      '<td>' + escapeHtml(scenario.outcome || '') + '</td>' +
      '</tr>'
  }).join('\n')
}

function renderFindingRows(findings) {
  if (!findings.length) return '<p class="empty">No usability finding reported.</p>'
  return findings.map((finding) => [
    '<tr>',
    '<td class="task-id">' + escapeHtml(finding.id || '') + '</td>',
    '<td>' + statusPill(finding.type || 'understandability') + '</td>',
    '<td>' + statusPill(finding.severity || 'medium') + '</td>',
    '<td>' + escapeHtml(finding.where || '') + '</td>',
    '<td>' + escapeHtml(finding.observation || '') + '</td>',
    '<td>' + escapeHtml(finding.suggestion || '') + '</td>',
    '<td>' + statusPill(finding.status || 'open') + '</td>',
    '</tr>'
  ].join('')).join('\n')
}

function renderStepRows(steps) {
  if (!steps.length) return '<p class="empty">No step recorded yet.</p>'
  return steps.slice(-60).reverse().map((step) => {
    const usage = step.usage || {}
    return '<tr>' +
      '<td class="nowrap">' + escapeHtml(step.iteration || '') + '</td>' +
      '<td>' + escapeHtml(step.title || step.stage || '') + '</td>' +
      '<td>' + statusPill(step.status === 'done' ? 'done' : step.status === 'failed' ? 'blocked' : 'doing') + '</td>' +
      '<td class="nowrap">' + escapeHtml(Math.round((Number(step.ms) || 0) / 100) / 10) + 's</td>' +
      '<td class="nowrap">' + escapeHtml(step.tokens || 0) + '</td>' +
      '<td class="nowrap">' + escapeHtml(usage.aiCalls || 0) + '</td>' +
      '<td class="detail">' + escapeHtml(String(step.summary || '').slice(0, 220)) + '</td>' +
      '</tr>'
  }).join('\n')
}

function renderLogRows(log) {
  if (!log.length) return '<p class="empty">Nothing logged yet.</p>'
  return log.slice(-80).reverse().map((entry) => {
    return '<li><span class="log-time">' + escapeHtml(formatDateTime(entry.at)) + '</span> ' +
      '<span class="log-stage">' + escapeHtml(entry.stage) + '</span> ' + escapeHtml(entry.text) + '</li>'
  }).join('\n')
}

const STYLE_BLOCK = `
    :root {
      --ink: #1e293b;
      --muted: #64748b;
      --line: #e2e8f0;
      --paper: #ffffff;
      --panel: #f8fafc;
      --accent: #1e4e79;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      font-size: 15px;
      line-height: 1.6;
    }
    .page { max-width: 1120px; margin: 0 auto; padding: 40px 24px 80px; }
    header.doc-head { border-bottom: 3px solid var(--accent); padding-bottom: 18px; margin-bottom: 26px; }
    header.doc-head h1 { margin: 0 0 6px; font-size: 28px; letter-spacing: -0.01em; }
    header.doc-head .doc-sub { color: var(--muted); margin: 0; }
    header.doc-head .doc-meta { margin-top: 12px; font-size: 13px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 16px; }
    h2 { font-size: 19px; margin: 40px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
    h2 .num { color: var(--accent); margin-right: 8px; }
    h3 { font-size: 15px; margin: 22px 0 8px; color: var(--accent); letter-spacing: 0.02em; text-transform: uppercase; }
    p { margin: 0 0 10px; }
    .empty { color: var(--muted); font-style: italic; }
    .muted { color: var(--muted); }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 18px 0 4px; }
    .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
    .card .card-label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
    .card .card-value { font-size: 22px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 6px; font-size: 13.5px; }
    th, td { text-align: left; padding: 7px 9px; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { background: var(--panel); font-size: 11.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
    tbody tr:hover { background: #f7fafc; }
    .task-id { font-family: Consolas, monospace; font-size: 12px; color: var(--muted); white-space: nowrap; }
    .task-check { width: 34px; }
    .task-check input { width: 15px; height: 15px; accent-color: var(--accent); }
    .task-files { margin-top: 4px; }
    .task-files code { font-size: 11.5px; background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px; margin-right: 4px; }
    .task-acceptance { margin: 6px 0 0; padding-left: 18px; font-size: 12.5px; color: var(--muted); }
    tr.done .task-title { color: var(--muted); }
    .pill { display: inline-block; font-size: 11px; line-height: 1.5; padding: 1px 8px; border-radius: 999px; background: var(--panel); border: 1px solid var(--line); color: var(--muted); text-transform: lowercase; white-space: nowrap; }
    .pill-done { background: #e7f5ec; border-color: #b7e0c5; color: #1d7a36; }
    .pill-doing, .pill-building, .pill-planned { background: #e8f0f8; border-color: #c3d8ea; color: #1e4e79; }
    .pill-blocked, .pill-high { background: #fdecec; border-color: #f3c2c2; color: #b42318; }
    .pill-medium, .pill-should { background: #fdf4e3; border-color: #f0dcb4; color: #9a6700; }
    .pill-low, .pill-could, .pill-skipped, .pill-accepted { background: #f4f5f7; border-color: #e2e8f0; color: #64748b; }
    .pill-must { background: #ecebff; border-color: #cfccf5; color: #4338ca; }
    .pill-mitigated { background: #e7f5ec; border-color: #b7e0c5; color: #1d7a36; }
    .nowrap { white-space: nowrap; }
    td.detail { font-family: Consolas, monospace; font-size: 11.5px; color: var(--muted); }
    ul.log { list-style: none; padding: 0; margin: 8px 0 0; font-size: 12.5px; }
    ul.log li { padding: 3px 0; border-bottom: 1px dashed var(--line); }
    .log-time { color: var(--muted); font-family: Consolas, monospace; font-size: 11.5px; }
    .log-stage { color: var(--accent); font-weight: 600; margin: 0 6px; }
    .callout { background: var(--panel); border-left: 3px solid var(--accent); padding: 10px 14px; margin: 12px 0; font-size: 13.5px; }
    footer.doc-foot { margin-top: 48px; padding-top: 14px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; }
    @media print {
      body { font-size: 12px; }
      .page { max-width: none; padding: 0; }
      h2 { page-break-after: avoid; }
      tr { page-break-inside: avoid; }
    }
`

function renderSsotHtml(ssotInput, options) {
  const ssot = ssotInput || {}
  const settings = options || {}
  const product = ssot.product || {}
  const tasks = Array.isArray(ssot.tasks) ? ssot.tasks : []
  const risks = Array.isArray(ssot.risks) ? ssot.risks : []
  const questions = Array.isArray(ssot.questions) ? ssot.questions : []
  const features = Array.isArray(ssot.features) ? ssot.features : []
  const ideas = Array.isArray(ssot.ideas) ? ssot.ideas : []
  const tests = Array.isArray(ssot.tests) ? ssot.tests : []
  const iterations = Array.isArray(ssot.iterations) ? ssot.iterations : []
  const decisions = Array.isArray(ssot.decisions) ? ssot.decisions : []
  const personas = Array.isArray(ssot.personas) ? ssot.personas : []
  const scenarios = Array.isArray(ssot.scenarios) ? ssot.scenarios : []
  const findings = Array.isArray(ssot.usability) ? ssot.usability : []
  const steps = Array.isArray(ssot.steps) ? ssot.steps : []
  const log = Array.isArray(ssot.log) ? ssot.log : []

  const doneTasks = tasks.filter((task) => task.status === 'done').length
  const openRiskCount = risks.filter((risk) => risk.status !== 'mitigated' && risk.status !== 'accepted').length
  const openQuestionCount = questions.filter((question) => question.status !== 'answered').length
  const failingTests = tests.filter((test) => test.ok === false).length
  const passRate = tests.length ? Math.round(((tests.length - failingTests) / tests.length) * 100) : 0
  const totalTokens = steps.reduce((total, step) => total + (Number(step.tokens) || 0), 0)
  const title = (product.name || ssot.idea && ssot.idea.name || 'Application') + ' - SSOT'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE_BLOCK}</style>
</head>
<body>
<div class="page">
  <header class="doc-head">
    <h1>${escapeHtml(product.name || ssot.idea && ssot.idea.name || 'Application')}</h1>
    <p class="doc-sub">${escapeHtml(product.tagline || 'Single source of truth for this application.')}</p>
    <div class="doc-meta">
      <span>Version ${escapeHtml(ssot.version || '0.1.0')}</span>
      <span>Idea: ${escapeHtml(ssot.idea && ssot.idea.name || '')} ${ssot.idea && ssot.idea.id ? '(' + escapeHtml(ssot.idea.id) + ')' : ''}</span>
      <span>Generated ${escapeHtml(formatDateTime(settings.generatedAt || ssot.updatedAt))}</span>
      <span>Status: ${escapeHtml(settings.runStatus || 'unknown')}</span>
    </div>
  </header>

  <div class="cards">
    <div class="card"><div class="card-label">Tasks done</div><div class="card-value">${doneTasks} / ${tasks.length}</div></div>
    <div class="card"><div class="card-label">Open risks</div><div class="card-value">${openRiskCount}</div></div>
    <div class="card"><div class="card-label">Open questions</div><div class="card-value">${openQuestionCount}</div></div>
    <div class="card"><div class="card-label">Checks passing</div><div class="card-value">${tests.length ? passRate + '%' : 'n/a'}</div></div>
    <div class="card"><div class="card-label">Iterations</div><div class="card-value">${iterations.length}</div></div>
    <div class="card"><div class="card-label">Tokens used</div><div class="card-value">${totalTokens}</div></div>
  </div>

  <h2><span class="num">1</span>Product</h2>
  <table>
    <tbody>
      <tr><th style="width:170px">Problem</th><td>${escapeHtml(product.problem || 'Not defined yet.')}</td></tr>
      <tr><th>Solution</th><td>${escapeHtml(product.solution || 'Not defined yet.')}</td></tr>
      <tr><th>Audience</th><td>${escapeHtml(product.audience || 'Not defined yet.')}</td></tr>
      <tr><th>Market notes</th><td>${escapeHtml(product.marketNotes || 'Not defined yet.')}</td></tr>
      <tr><th>Differentiators</th><td>${product.differentiators && product.differentiators.length
        ? '<ul style="margin:0;padding-left:18px">' + product.differentiators.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>'
        : '<span class="muted">None recorded.</span>'}</td></tr>
      <tr><th>Technology</th><td>${product.technology && product.technology.length
        ? escapeHtml(product.technology.join(', '))
        : '<span class="muted">Decided by the build tasks.</span>'}</td></tr>
    </tbody>
  </table>

  <h2><span class="num">2</span>Industry reference</h2>
  ${product.competitors && product.competitors.length ? `<table>
    <thead><tr><th style="width:200px">Reference</th><th>Strength</th><th>Weakness</th></tr></thead>
    <tbody>
      ${product.competitors.map((competitor) => '<tr><td>' + escapeHtml(competitor.name) + '</td><td>' +
        escapeHtml(competitor.strength || '') + '</td><td>' + escapeHtml(competitor.weakness || '') + '</td></tr>').join('\n      ')}
    </tbody>
  </table>` : '<p class="empty">No industry reference recorded.</p>'}

  <h2><span class="num">3</span>Features</h2>
  <table>
    <thead><tr><th style="width:70px">ID</th><th style="width:240px">Feature</th><th>Description</th><th style="width:90px">Priority</th><th style="width:90px">Status</th></tr></thead>
    <tbody>
      ${renderFeatureRows(features)}
    </tbody>
  </table>

  <h2><span class="num">4</span>Task list</h2>
  <table>
    <thead><tr><th style="width:34px">&nbsp;</th><th style="width:70px">ID</th><th>Task</th><th style="width:80px">Kind</th><th style="width:100px">Status</th></tr></thead>
    <tbody>
      ${renderTaskRows(tasks)}
    </tbody>
  </table>

  <h2><span class="num">5</span>Risks</h2>
  <table>
    <thead><tr><th style="width:70px">ID</th><th style="width:90px">Severity</th><th>Risk</th><th>Mitigation</th><th style="width:100px">Status</th></tr></thead>
    <tbody>
      ${renderRiskRows(risks)}
    </tbody>
  </table>

  <h2><span class="num">6</span>Questions and decisions</h2>
  <table>
    <thead><tr><th style="width:70px">ID</th><th>Question</th><th>Assumption</th><th>Resolution</th><th style="width:90px">Status</th></tr></thead>
    <tbody>
      ${renderQuestionRows(questions)}
    </tbody>
  </table>
  <h3>Decision log</h3>
  ${decisions.length ? '<ul style="margin:0;padding-left:18px">' + decisions.map((decision) => {
    return '<li><strong>' + escapeHtml(decision.id || '') + '</strong> ' + escapeHtml(decision.text) +
      (decision.rationale ? ' <span class="muted">(' + escapeHtml(decision.rationale) + ')</span>' : '') + '</li>'
  }).join('') + '</ul>' : '<p class="empty">No decisions recorded.</p>'}

  <h2><span class="num">7</span>Test results</h2>
  <table>
    <thead><tr><th style="width:140px">When</th><th style="width:240px">Check</th><th style="width:70px">Result</th><th>Detail</th></tr></thead>
    <tbody>
      ${renderTestRows(tests)}
    </tbody>
  </table>

  <h2><span class="num">8</span>Usability review</h2>
  <table>
    <thead><tr><th style="width:60px">ID</th><th style="width:260px">Persona</th><th>Goal</th><th>Context</th></tr></thead>
    <tbody>
      ${renderPersonaRows(personas)}
    </tbody>
  </table>
  <table>
    <thead><tr><th style="width:50px">ID</th><th style="width:110px">Persona</th><th style="width:200px">Scenario</th><th>Steps walked</th><th style="width:180px">Outcome</th></tr></thead>
    <tbody>
      ${renderScenarioRows(scenarios)}
    </tbody>
  </table>
  <table>
    <thead><tr><th style="width:50px">ID</th><th style="width:130px">Type</th><th style="width:90px">Severity</th><th style="width:130px">Where</th><th>Observation</th><th>Suggestion</th><th style="width:90px">Status</th></tr></thead>
    <tbody>
      ${renderFindingRows(findings)}
    </tbody>
  </table>

  <h2><span class="num">9</span>Build timeline</h2>
  <p class="muted">Every stage of every iteration, with the tokens it used. This is what the dashboard shows live.</p>
  <table>
    <thead><tr><th style="width:60px">Iter</th><th style="width:230px">Step</th><th style="width:80px">Status</th><th style="width:60px">Time</th><th style="width:70px">Tokens</th><th style="width:60px">Calls</th><th>Result</th></tr></thead>
    <tbody>
      ${renderStepRows(steps)}
    </tbody>
  </table>

  <h2><span class="num">10</span>Iterations</h2>
  <table>
    <thead><tr><th style="width:50px">#</th><th style="width:140px">Finished</th><th>Summary</th><th style="width:70px">Tasks</th><th style="width:60px">Pass</th><th style="width:70px">Failed</th><th style="width:80px">Tokens</th></tr></thead>
    <tbody>
      ${renderIterationRows(iterations)}
    </tbody>
  </table>

  <h2><span class="num">11</span>Improvement backlog</h2>
  <table>
    <thead><tr><th style="width:70px">ID</th><th style="width:280px">Idea</th><th>Why it matters</th><th style="width:80px">Impact</th><th style="width:90px">Status</th></tr></thead>
    <tbody>
      ${renderIdeaRows(ideas)}
    </tbody>
  </table>

  <h2><span class="num">12</span>Activity log</h2>
  <ul class="log">
    ${renderLogRows(log)}
  </ul>

  <div class="callout">
    This document is generated from ssot.json after every stage of the build loop.
    The JSON is the machine readable source of truth; this page is the human readable view.
  </div>

  <footer class="doc-foot">
    HTML Tool Factory - autonomous build record. ${escapeHtml(formatDateTime(settings.generatedAt))}
  </footer>
</div>
</body>
</html>
`
}

module.exports = { renderSsotHtml, escapeHtml, formatDateTime }
