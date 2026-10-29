'use strict'

// Static source check for the factory itself: syntax of every module, balanced
// CSS, and a cross check that every element id the dashboard looks up really
// exists in the page (the classic silent UI failure).

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const APP_ROOT = path.resolve(__dirname, '..')
let passed = 0
const failures = []

function check(name, condition, detail) {
  if (condition) {
    passed += 1
    process.stdout.write('  ok   ' + name + '\n')
    return true
  }
  failures.push({ name, detail })
  process.stdout.write('  FAIL ' + name + (detail ? ' -> ' + detail : '') + '\n')
  return false
}

function walk(directoryPath, results) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const absolutePath = path.join(directoryPath, entry.name)
    if (entry.isDirectory()) {
      walk(absolutePath, results)
      continue
    }
    results.push(absolutePath)
  }
  return results
}

const allFiles = walk(APP_ROOT, []).filter((file) => !file.includes('selftest-output'))

const scriptFiles = allFiles.filter((file) => /\.(js|cjs)$/.test(file) && !file.includes(path.sep + 'runs' + path.sep))
scriptFiles.forEach((file) => {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  check('node --check ' + path.relative(APP_ROOT, file), result.status === 0,
    String(result.stderr || '').split('\n').slice(0, 2).join(' '))
})

const cssPath = path.join(APP_ROOT, 'ui', 'app.css')
const cssText = fs.readFileSync(cssPath, 'utf8')
const openBraces = (cssText.match(/{/g) || []).length
const closeBraces = (cssText.match(/}/g) || []).length
check('app.css braces are balanced', openBraces === closeBraces, openBraces + ' open / ' + closeBraces + ' close')

const htmlText = fs.readFileSync(path.join(APP_ROOT, 'ui', 'index.html'), 'utf8')
const dashboardText = fs.readFileSync(path.join(APP_ROOT, 'ui', 'app.js'), 'utf8')

const htmlIds = new Set()
;(htmlText.match(/\sid="([^"]+)"/g) || []).forEach((match) => {
  htmlIds.add(match.replace(/\sid="/, '').replace(/"$/, ''))
})

const dynamicIds = new Set(['tab-' + 'tasks'])
const dynamicTabs = ['timeline', 'tasks', 'risks', 'features', 'ideas', 'tests', 'files', 'events']
dynamicTabs.forEach((tabName) => dynamicIds.add('tab-' + tabName))

const referencedIds = new Set()
;(dashboardText.match(/'([A-Za-z][A-Za-z0-9]*)'/g) || []).forEach((_unused) => {})
const cacheBlockMatch = dashboardText.match(/cacheElements\(\) {[\s\S]*?\]\.forEach/)
if (cacheBlockMatch) {
  ;(cacheBlockMatch[0].match(/'([A-Za-z][A-Za-z0-9]*)'/g) || []).forEach((match) => {
    referencedIds.add(match.replace(/'/g, ''))
  })
}
;(dashboardText.match(/byId\('([^']+)'\)/g) || []).forEach((match) => {
  referencedIds.add(match.replace(/byId\('/, '').replace(/'\)/, ''))
})

// The dashboard also builds markup at runtime (chat compose box, file rows).
// An id that app.js creates itself is valid even though index.html has no node
// for it, so it is accepted when it appears as id="<name>" in the same file.
referencedIds.forEach((id) => {
  if (dashboardText.includes('id="' + id + '"')) dynamicIds.add(id)
})

const missingIds = Array.from(referencedIds).filter((id) => !htmlIds.has(id) && !dynamicIds.has(id))
check('every dashboard element id exists in index.html', missingIds.length === 0, missingIds.join(', '))

const ssotPath = path.join(APP_ROOT, 'docs', 'ssot.html')
if (fs.existsSync(ssotPath)) {
  const ssotText = fs.readFileSync(ssotPath, 'utf8')
  check('the application SSOT avoids em dashes', !ssotText.includes('\u2014'))
  check('the application SSOT avoids emoji', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(ssotText))
  check('the application SSOT has a white background',
    ssotText.includes('--paper: #ffffff') || ssotText.includes('_docs/assets/ssot.css'))
} else {
  check('the application SSOT exists', false, ssotPath)
}

// The dashboard renderers are pure string builders. Evaluating the real file in
// a sandbox and calling them catches runtime errors that a syntax check misses.
function checkDashboardRenderers() {
  const vm = require('vm')
  const sandbox = {
    console: { log: () => {}, error: () => {} },
    document: {
      addEventListener: function noop() {},
      getElementById: function getById() { return null },
      querySelectorAll: function queryAll() { return [] },
      body: { addEventListener: function noop() {} }
    }
  }
  sandbox.window = sandbox
  vm.createContext(sandbox)
  try {
    vm.runInContext(dashboardText, sandbox, { filename: 'app.js' })
  } catch (error) {
    check('the dashboard script evaluates', false, error.message)
    return
  }
  check('the dashboard script evaluates', true)

  // `const state` is a lexical binding inside the script, so it is reached by
  // evaluating expressions in the same context rather than from the sandbox.
  const sampleSsot = {
    product: { name: 'Sample', problem: 'p', solution: 's', audience: 'a' },
    features: [{ id: 'F-01', title: 'Feature one', description: 'd', priority: 'must', status: 'planned' }],
    tasks: [{
      id: 'T-01',
      title: 'Create the page',
      kind: 'code',
      files: ['index.html'],
      acceptance: ['it parses'],
      status: 'todo',
      attempts: 0
    }],
    risks: [{ id: 'R-01', severity: 'high', text: 'Risk text', mitigation: 'Mitigate', status: 'open' }],
    questions: [{ id: 'Q-01', text: 'Question text', answer: 'Answer text', status: 'answered' }],
    ideas: [{ id: 'I-01', title: 'Idea text', why: 'because', impact: 'high', status: 'new' }],
    tests: [{ at: new Date().toISOString(), iteration: 1, name: 'node --check app.js', ok: true, detail: 'exit code 0' }],
    steps: [
      { iteration: 1, stage: 'plan-tasks', title: 'Plan the task list', status: 'done', ms: 1200, tokens: 900, usage: { aiCalls: 1 } },
      { iteration: 1, stage: 'run-tests', title: 'Test the application', status: 'done', ms: 400, tokens: 0, usage: { aiCalls: 0 } }
    ],
    personas: [{ id: 'P-01', name: 'Dana', role: 'Office manager', goal: 'Finish the list', context: 'Twice a week' }],
    scenarios: [],
    usability: [{ id: 'U-01', type: 'unclear-step', severity: 'high', where: 'main panel', observation: 'No add control', suggestion: 'Add a button', status: 'open' }]
  }
  const sampleRun = { iteration: 0, stage: 'plan-tasks', status: 'running', options: { maxIterations: 3 } }

  vm.runInContext(
    'var __ssot = ' + JSON.stringify(sampleSsot) + ';\nvar __run = ' + JSON.stringify(sampleRun) + ';\n',
    sandbox
  )

  const renderChecks = [
    ['renderTasks', 'state.activeTab = "tasks"; renderTasks(__ssot, __run)', 'Create the page'],
    ['renderRisks', 'renderRisks(__ssot)', 'Risk text'],
    ['renderFeatures', 'renderFeatures(__ssot)', 'Feature one'],
    ['renderIdeas', 'renderIdeas(__ssot)', 'Idea text'],
    ['renderTests', 'renderTests(__ssot)', 'node --check app.js'],
    ['renderFiles', 'state.payload = { files: [{ relativePath: "index.html", size: 2048 }] }; state.openFile = null; renderFiles()', 'index.html'],
    ['renderEventsTab', 'state.payload = { events: [{ at: "' + new Date().toISOString() + '", stage: "plan-tasks", type: "log", message: "hello" }] }; renderEventsTab()', 'hello'],
    ['renderStageTrack', 'elements.stageTrack = { innerHTML: "" }; state.stageSequence = ["select-idea", "plan-tasks"]; state.stageTitles = { "select-idea": "Select idea", "plan-tasks": "Plan tasks" }; renderStageTrack(__run); elements.stageTrack.innerHTML', 'Plan tasks'],
    ['renderTimeline', 'state.stageSequence = ["select-idea", "plan-tasks", "run-tests"]; renderTimeline(__ssot, __run)', 'Plan the task list']
  ]

  renderChecks.forEach(([name, expression, expectedText]) => {
    try {
      const output = vm.runInContext(expression, sandbox, { timeout: 5000 })
      check('dashboard ' + name + ' renders', typeof output === 'string' && output.includes(expectedText),
        typeof output === 'string' ? 'output length ' + output.length : String(output))
    } catch (error) {
      check('dashboard ' + name + ' renders', false, error.message)
    }
  })
}

checkDashboardRenderers()

process.stdout.write('\n' + passed + ' checks passed, ' + failures.length + ' failed.\n')
if (failures.length) {
  failures.forEach((failure) => process.stdout.write(' - ' + failure.name + ': ' + failure.detail + '\n'))
  process.exitCode = 1
} else {
  process.exitCode = 0
}
