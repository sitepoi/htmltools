'use strict'

// The generated tool uses the SAME documentation system as every other tool in
// this repository:
//   docs/index.html, webpage.html, help.html, presentation.html, updates.html,
//   social.html and docs/ssot.html are produced by scripts/init-docs.js from
//   _docs/templates/* using the shared _docs/assets/ssot.css and ssot.js.
// The factory never invents its own document layout. It only fills the standard
// SSOT sections that it owns (task list, ideas, risks and a build record) between
// two markers, so a human can still edit everything else in the normal way.

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { ensureDir, writeTextAtomic, nowIso } = require('../util')
const { escapeHtml } = require('../tool/scaffold')

const START = (key) => '<!-- AF:' + key + ':START -->'
const END = (key) => '<!-- AF:' + key + ':END -->'

function assetsRelative(repoRoot, docsDirectory) {
  const assets = path.join(repoRoot, '_docs', 'assets')
  let relative = path.relative(docsDirectory, assets).replace(/\\/g, '/')
  if (!relative) relative = '.'
  if (!relative.endsWith('/')) relative += '/'
  return relative
}

function fillTemplate(template, values) {
  return String(template)
    .replace(/\[FEATURE NAME\]/g, values.name)
    .replace(/\[DATE\]/g, values.date)
    .replace(/\[CODE\]/g, values.code)
    .replace(/\[ASSETS_RELATIVE\]/g, values.assets)
}

function fallbackDocs(options) {
  const repoRoot = options.repoRoot
  const docsDirectory = path.join(options.toolDirectory, 'docs')
  ensureDir(docsDirectory)
  const templates = path.join(repoRoot, '_docs', 'templates')
  const values = {
    name: options.displayName,
    date: nowIso().slice(0, 10),
    code: options.code,
    assets: assetsRelative(repoRoot, docsDirectory)
  }
  const created = []
  const map = [
    ['_ssot-template.html', 'ssot.html'],
    ['_index-template.html', 'index.html'],
    ['_webpage-template.html', 'webpage.html'],
    ['_help-template.html', 'help.html'],
    ['_presentation-template.html', 'presentation.html'],
    ['_updates-template.html', 'updates.html'],
    ['_social-template.html', 'social.html']
  ]
  map.forEach(([templateName, outputName]) => {
    const target = path.join(docsDirectory, outputName)
    if (fs.existsSync(target)) return
    const templatePath = path.join(templates, templateName)
    if (!fs.existsSync(templatePath)) return
    const filled = fillTemplate(fs.readFileSync(templatePath, 'utf8'), values)
    writeTextAtomic(target, filled)
    created.push('docs/' + outputName)
  })
  return created
}

// Creates the standard docs with the repository generator. Returns a small
// report so the run log can show what happened.
function ensureStandardDocs(options) {
  const repoRoot = options.repoRoot
  const toolName = options.toolName
  const docsDirectory = path.join(options.toolDirectory, 'docs')
  const ssotPath = path.join(docsDirectory, 'ssot.html')
  const report = { ok: false, created: [], generator: '', reason: '' }

  if (fs.existsSync(ssotPath)) {
    report.ok = true
    report.reason = 'docs/ssot.html already exists'
    return report
  }
  ensureDir(docsDirectory)

  const generatorName = (options.generator || 'scripts/init-docs.js').replace(/\\/g, '/')
  const generatorPath = path.join(repoRoot, ...generatorName.split('/'))
  const insideRepo = path.resolve(options.toolDirectory).startsWith(path.resolve(repoRoot) + path.sep)

  if (insideRepo && fs.existsSync(generatorPath)) {
    const result = spawnSync(process.execPath, [generatorPath, '--tool', toolName], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 180000
    })
    report.generator = generatorName
    if (result.error) {
      report.reason = 'The docs generator could not run: ' + result.error.message
    } else if (result.status !== 0) {
      const detail = String(result.stderr || result.stdout || '').split('\n').slice(0, 3).join(' ')
      report.reason = 'The docs generator exited with ' + result.status + ': ' + detail.slice(0, 200)
    }
  } else {
    report.reason = insideRepo
      ? 'The docs generator was not found at ' + generatorPath
      : 'The tool folder is outside the repository, so the generator is not used'
  }

  if (fs.existsSync(ssotPath)) {
    report.ok = true
    report.created.push('docs/ssot.html')
    return report
  }

  // Deterministic fallback: the same templates the generator uses.
  const created = fallbackDocs({
    repoRoot,
    toolDirectory: options.toolDirectory,
    displayName: options.displayName || toolName,
    code: options.code || 'AF'
  })
  report.created = created
  report.ok = fs.existsSync(ssotPath)
  if (!report.ok) {
    report.reason = report.reason || 'The standard documents could not be created'
  }
  return report
}

function statusOf(task) {
  if (task.status === 'done') return 'done'
  if (task.status === 'doing') return 'in-progress'
  if (task.status === 'todo') return 'not-started'
  return 'ignored'
}

function renderTaskGroups(ssot) {
  const tasks = Array.isArray(ssot.tasks) ? ssot.tasks : []
  if (!tasks.length) {
    return '<p class="ssot-empty">No build tasks have been planned yet.</p>'
  }
  const groups = new Map()
  tasks.forEach((task) => {
    const key = String(task.iteration || task.source || 'build')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(task)
  })
  const blocks = []
  let index = 0
  groups.forEach((groupTasks, key) => {
    index += 1
    const groupId = 'AF-' + index
    const doneCount = groupTasks.filter((task) => task.status === 'done').length
    const groupStatus = doneCount === groupTasks.length ? 'pushed'
      : (doneCount > 0 ? 'in-progress' : 'planned')
    const groupPoints = groupTasks.reduce((total, task) => total + (Number(task.points) || 0), 0)
    const items = groupTasks.map((task) => {
      const taskStatus = statusOf(task)
      const checked = task.status === 'done' ? ' checked="checked"' : ''
      const files = (task.files || []).map((file) => '<code>' + escapeHtml(file) + '</code>').join(' ')
      const acceptance = (task.acceptance || []).length
        ? '<ul>' + task.acceptance.map((line) => '<li>' + escapeHtml(line) + '</li>').join('') + '</ul>'
        : '<p>No acceptance statement recorded.</p>'
      return [
        '    <div class="task-item" data-task-id="' + escapeHtml(task.id) + '" data-group="' + groupId +
          '" data-task-status="' + taskStatus + '">',
        '      <details>',
        '        <summary>',
        '          <span class="task-id">' + escapeHtml(task.id) + '</span>',
        '          <span class="task-title">' + escapeHtml(task.title) + '</span>',
        '          <span class="task-status-chip" data-task-status-chip></span>',
        '          <span class="task-priority status-mandatory">' + escapeHtml(task.kind || 'code') + '</span>',
        '          <input type="checkbox" class="task-done-checkbox" aria-label="Mark ' + escapeHtml(task.id) +
          ' as done"' + checked + ' />',
        '        </summary>',
        '        <div class="task-details">',
        '          <p><strong>Points:</strong> ' + escapeHtml(String(task.points || 0)) +
          ' of 100 - small tasks are applied together in one prompt.' + '</p>',
        '          <p><strong>Problem it solves:</strong> ' + escapeHtml(task.title) + '</p>',
        '          <p><strong>How we will solve it:</strong> ' + escapeHtml(task.notes || 'See the recorded diff in the factory run.') + '</p>',
        '          <p><strong>Acceptance:</strong></p>',
        '          ' + acceptance,
        '          <p><strong>Files:</strong> ' + (files || '<code>-</code>') + '</p>',
        '          <p><strong>Attempts:</strong> ' + escapeHtml(String(task.attempts || 0)) + '</p>',
        '        </div>',
        '      </details>',
        '    </div>'
      ].join('\n')
    }).join('\n')
    blocks.push([
      '  <section class="task-group" data-release-group="' + groupId + '" data-group-status="' + groupStatus + '">',
      '    <header class="task-group-header">',
      '      <span class="task-group-name">Group: ' + escapeHtml(String(key)) + ' - ' +
        escapeHtml(String(groupPoints)) + ' points</span>',
      '      <span class="group-status-chip" data-group-status-chip></span>',
      '      <span class="task-group-badge">RELATED - do not split</span>',
      '      <span class="task-group-progress" data-group-progress="' + groupId + '">' +
        doneCount + '/' + groupTasks.length + '</span>',
      '    </header>',
      '    <div class="task-group-progress-bar"><div class="task-group-progress-fill" data-group-progress-fill="' +
        groupId + '"></div></div>',
      '    <p class="task-group-note">Planned by the html tool factory in the same iteration.</p>',
      items,
      '  </section>'
    ].join('\n'))
  })
  return blocks.join('\n')
}

function renderIdeas(ssot) {
  const ideas = Array.isArray(ssot.ideas) ? ssot.ideas : []
  if (!ideas.length) return '<p class="ssot-empty">No ideas recorded yet.</p>'
  return ideas.slice(0, 30).map((idea) => {
    const status = idea.status === 'done' ? 'done' : (idea.status === 'ignored' ? 'ignored' : (idea.status === 'discussing' ? 'discussing' : 'new'))
    return [
      '  <div class="idea-item" data-idea-id="' + escapeHtml(idea.id) + '" data-idea-status="' + status + '">',
      '    <details>',
      '      <summary>',
      '        <span class="idea-id">' + escapeHtml(idea.id) + '</span>',
      '        <span class="idea-title">' + escapeHtml(idea.title) + '</span>',
      '        <span class="idea-status-chip" data-idea-status-chip></span>',
      '        <input type="checkbox" class="idea-done-checkbox" aria-label="Mark ' + escapeHtml(idea.id) + ' as done" />',
      '      </summary>',
      '      <div class="idea-details">',
      '        <p>' + escapeHtml(idea.notes || idea.text || '') + '</p>',
      '        <p><strong>Value:</strong> ' + escapeHtml(idea.value || '-') + '</p>',
      '        <p><strong>Status:</strong> ' + escapeHtml(idea.status || 'new') + '</p>',
      '      </div>',
      '    </details>',
      '  </div>'
    ].join('\n')
  }).join('\n')
}

function renderDefinition(ssot) {
  const definition = (ssot && ssot.definition) || {}
  const items = definition.jobs || []
  if (!definition.summary && !items.length) {
    return '<p class="ssot-empty">No tool definition recorded yet.</p>'
  }
  const block = (title, values) => (Array.isArray(values) && values.length)
    ? '<h3>' + title + '</h3><ul>' + values.map((value) => '<li>' + escapeHtml(value) + '</li>').join('') + '</ul>'
    : ''
  return '<h3>What this tool is</h3><p>' + escapeHtml(definition.summary || '') + '</p>' +
    block('Jobs the user hires it for', definition.jobs) +
    block('Screen areas', definition.screens) +
    block('Data the tool owns', definition.data) +
    block('Rules the tool follows', definition.rules) +
    block('Explicitly out of scope', definition.outOfScope) +
    block('How success is checked', definition.success)
}

function renderChecklist(ssot) {
  const items = Array.isArray(ssot.checklist) ? ssot.checklist : []
  if (!items.length) return '<p class="ssot-empty">No depth checklist recorded yet.</p>'
  const done = items.filter((item) => item.status === 'done' || item.status === 'na').length
  const rows = items.map((item) => {
    const state = item.status === 'done' ? 'done' : (item.status === 'na' ? 'not applicable' : 'open')
    return '<tr><td><code>' + escapeHtml(item.id) + '</code></td><td>' + escapeHtml(item.title) +
      '</td><td>' + escapeHtml(item.detail || '') + '</td><td>' + escapeHtml(state) + '</td><td>' +
      escapeHtml(item.taskId || '-') + '</td></tr>'
  }).join('')
  return '<p><strong>Depth:</strong> ' + done + ' of ' + items.length +
    ' capability items done. The run is not finished while an item is open.</p>' +
    '<table><tr><th>#</th><th>Capability</th><th>What it means</th><th>State</th><th>Task</th></tr>' +
    rows + '</table>'
}

function renderRisks(ssot) {
  const risks = Array.isArray(ssot.risks) ? ssot.risks : []
  if (!risks.length) return '<p class="ssot-empty">No risks recorded yet.</p>'
  const rows = risks.map((risk) => {
    return '<tr><td><code>' + escapeHtml(risk.id) + '</code></td><td>' + escapeHtml(risk.text) +
      '</td><td>' + escapeHtml(risk.severity || 'medium') + '</td><td>' +
      escapeHtml(risk.mitigation || risk.status || '-') + '</td></tr>'
  }).join('')
  return '<table><tr><th>#</th><th>Risk</th><th>Severity</th><th>Mitigation / state</th></tr>' + rows + '</table>'
}

function renderBuildRecord(run, ssot) {
  const iterations = Array.isArray(ssot.iterations) ? ssot.iterations : []
  const steps = Array.isArray(ssot.steps) ? ssot.steps : []
  const iterationRows = iterations.map((entry) => {
    const tokens = entry.tokens || {}
    return '<tr><td>' + escapeHtml(String(entry.n)) + '</td><td>' + escapeHtml(entry.summary || '-') +
      '</td><td>' + escapeHtml(String((entry.tasks || []).length)) + '</td><td>' +
      escapeHtml(String(tokens.total || 0)) + '</td></tr>'
  }).join('')
  const stepRows = steps.slice(-40).map((step) => {
    const usage = step.usage || {}
    return '<tr><td>' + escapeHtml(step.stage || '-') + '</td><td>' + escapeHtml(step.status || '-') +
      '</td><td>' + escapeHtml(String(step.tokens || 0)) + '</td><td>' +
      escapeHtml(step.summary || '') + '</td></tr>'
  }).join('')
  const counters = (run && run.counters) || {}
  return [
    '<h3>Build record (written by the html tool factory)</h3>',
    '<table>',
    '<tr><th>Run</th><td><code>' + escapeHtml((run && run.id) || '-') + '</code></td></tr>',
    '<tr><th>Provider</th><td>' + escapeHtml((run && run.options && run.options.provider) || '-') + '</td></tr>',
    '<tr><th>Iterations</th><td>' + escapeHtml(String((run && run.iteration) || 0)) + '</td></tr>',
    '<tr><th>AI calls</th><td>' + escapeHtml(String(counters.aiCalls || 0)) + '</td></tr>',
    '<tr><th>Checks</th><td>' + escapeHtml(String(counters.testsPassed || 0)) + ' passing, ' +
      escapeHtml(String(counters.testsFailed || 0)) + ' failing</td></tr>',
    '</table>',
    iterations.length
      ? '<h3>Iterations</h3><table><tr><th>#</th><th>Summary</th><th>Tasks</th><th>Tokens</th></tr>' + iterationRows + '</table>'
      : '',
    steps.length
      ? '<h3>Stage timeline</h3><table><tr><th>Stage</th><th>Status</th><th>Tokens</th><th>Summary</th></tr>' + stepRows + '</table>'
      : ''
  ].filter(Boolean).join('\n')
}

function upsertRegion(html, key, content, anchorBefore) {
  const startMarker = START(key)
  const endMarker = END(key)
  const block = startMarker + '\n' + content + '\n' + endMarker
  const startIndex = html.indexOf(startMarker)
  const endIndex = html.indexOf(endMarker)
  if (startIndex !== -1 && endIndex > startIndex) {
    return html.slice(0, startIndex) + block + html.slice(endIndex + endMarker.length)
  }
  const anchors = [anchorBefore, '</main>', '</body>'].filter(Boolean)
  for (const anchor of anchors) {
    const anchorIndex = html.indexOf(anchor)
    if (anchorIndex !== -1) {
      return html.slice(0, anchorIndex) + block + '\n\n' + html.slice(anchorIndex)
    }
  }
  return html + '\n' + block + '\n'
}

// Writes the factory owned sections into the standard SSOT document.
function writeStandardSsot(options) {
  const ssot = options.ssot
  const run = options.run
  const docsDirectory = path.join(options.toolDirectory, 'docs')
  const ssotPath = path.join(docsDirectory, 'ssot.html')
  ensureDir(docsDirectory)
  if (!fs.existsSync(ssotPath)) {
    return { ok: false, reason: 'docs/ssot.html is missing, so nothing was written' }
  }
  let html = fs.readFileSync(ssotPath, 'utf8')
  html = upsertRegion(html, 'DEFINITION', renderDefinition(ssot), '<h2 id="sec-purpose">')
  html = upsertRegion(html, 'TASKS', renderTaskGroups(ssot), '<h2 id="sec-ideas">')
  html = upsertRegion(html, 'IDEAS', renderIdeas(ssot), '<h2 id="sec-risks">')
  html = upsertRegion(html, 'CHECK', renderChecklist(ssot), '<h2 id="sec-testplan">')
  html = upsertRegion(html, 'BUILD',
    renderRisks(ssot) + '\n' + renderBuildRecord(run, ssot),
    '<h2 id="sec-maintenance">')
  writeTextAtomic(ssotPath, html)
  return { ok: true, path: ssotPath, bytes: html.length }
}

module.exports = {
  ensureStandardDocs,
  writeStandardSsot,
  renderDefinition,
  renderTaskGroups,
  renderIdeas,
  renderChecklist,
  renderRisks,
  assetsRelative
}
