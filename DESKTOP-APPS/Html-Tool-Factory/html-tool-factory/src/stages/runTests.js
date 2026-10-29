'use strict'

// Stage 3e - run the deterministic checks. No AI is used here on purpose:
// every failure is real, so the next planning round starts from facts.
//
// Two extra verifications run with the shell checks:
//   T-01  the tool script is booted in a fake DOM, so a crash or a missing
//         [TOOL:TEST] line is a fact instead of a claim.
//   T-02  every capability that claims to be done must be visible in the files,
//         otherwise the item is reopened and the run cannot report finished.

const ssotModel = require('../ssot/model')
const { runChecks } = require('../test/runner')
const { domSmokeProbe } = require('../agent/probes')
const { auditChecklist } = require('../code/capabilityAudit')
const { nowIso } = require('../util')
const { renderAndSave } = require('./shared')

async function run(context) {
  const { run: currentRun, ssot, store, log, config, workspace } = context
  const iteration = currentRun.iteration + 1
  const toolName = currentRun.toolName || ''

  const outcome = await runChecks(workspace, config.checks, (checkName) => {
    // Only log the slow, configured checks to keep the event stream readable.
    if (!checkName.startsWith('node --check ')) log('info', 'Running check: ' + checkName)
  })

  // T-01: execute the tool. The probe is bounded, local and read only.
  if (toolName && workspace.exists('app/' + toolName + '.js')) {
    const startedAt = Date.now()
    let smoke
    try {
      smoke = domSmokeProbe(workspace, 'app/' + toolName + '.js')
    } catch (error) {
      smoke = { ok: false, text: 'The DOM smoke probe failed: ' + error.message }
    }
    outcome.results.push({
      at: nowIso(),
      name: 'harness: dom_smoke',
      ok: smoke.ok,
      detail: String(smoke.text || '').slice(0, 400),
      ms: Date.now() - startedAt
    })
    const testLines = (String(smoke.text || '').match(/\[TOOL:TEST\][^\n]*/g) || []).length
    log(smoke.ok ? 'info' : 'error', 'Harness probe: ' +
      (smoke.ok ? 'the tool boots' : 'the tool failed to boot') +
      (testLines ? ' (' + testLines + ' self test line(s) reported)' : ''))
  }

  outcome.passed = outcome.results.filter((result) => result.ok).length
  outcome.failed = outcome.results.filter((result) => !result.ok).length
  outcome.ok = outcome.failed === 0

  outcome.results.forEach((result) => {
    ssot.tests.push({
      at: result.at || nowIso(),
      iteration,
      name: result.name,
      ok: result.ok,
      detail: result.ok ? (result.detail || 'pass') : String(result.detail || 'failed'),
      ms: result.ms
    })
  })
  if (ssot.tests.length > 300) ssot.tests = ssot.tests.slice(-300)

  // T-02: a closed capability must be visible in the files.
  const audit = auditChecklist(workspace, ssot, { toolName })
  if (!Array.isArray(ssot.audit)) ssot.audit = []
  audit.results.forEach((result) => {
    ssot.audit.push({
      at: nowIso(),
      iteration,
      id: result.id,
      title: result.title,
      ok: result.ok,
      detail: result.detail
    })
  })
  if (ssot.audit.length > 120) ssot.audit = ssot.audit.slice(-120)
  audit.reopened.forEach((line) => {
    log('warn', 'Capability reopened, it is not visible in the files: ' + line)
    ssotModel.appendLog(ssot, 'run-tests', 'Reopened ' + line)
  })

  currentRun.counters.testsPassed = outcome.passed
  currentRun.counters.testsFailed = outcome.failed

  const failing = outcome.results.filter((result) => !result.ok)
  const summary = (outcome.ok
    ? 'All ' + outcome.passed + ' checks passed.'
    : outcome.failed + ' of ' + outcome.results.length + ' checks failed: ' +
      failing.slice(0, 3).map((result) => result.name).join('; ')) +
    (audit.checked
      ? ' Capability audit: ' + (audit.checked - audit.reopened.length) + '/' + audit.checked +
        ' closed item(s) verified.'
      : '')

  ssotModel.appendLog(ssot, 'run-tests', summary)
  if (!outcome.ok) {
    failing.slice(0, 3).forEach((result) => {
      ssotModel.appendLog(ssot, 'run-tests', 'FAIL ' + result.name + ' - ' + String(result.detail || '').slice(0, 200))
    })
  }
  ssot.lastTestRunAt = nowIso()
  store.saveRun(currentRun)
  renderAndSave(store, currentRun, ssot)
  return { summary, ssot }
}

module.exports = { id: 'run-tests', title: 'Test the application', run }
