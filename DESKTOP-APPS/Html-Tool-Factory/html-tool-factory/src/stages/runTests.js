'use strict'

// Stage 3e - run the deterministic checks. No AI is used here on purpose:
// every failure is real, so the next planning round starts from facts.

const ssotModel = require('../ssot/model')
const { runChecks } = require('../test/runner')
const { nowIso } = require('../util')
const { renderAndSave } = require('./shared')

async function run(context) {
  const { run: currentRun, ssot, store, log, config, workspace } = context
  const iteration = currentRun.iteration + 1

  const outcome = await runChecks(workspace, config.checks, (checkName) => {
    // Only log the slow, configured checks to keep the event stream readable.
    if (!checkName.startsWith('node --check ')) log('info', 'Running check: ' + checkName)
  })

  outcome.results.forEach((result) => {
    ssot.tests.push({
      at: result.at,
      iteration,
      name: result.name,
      ok: result.ok,
      detail: result.ok ? (result.detail || 'pass') : String(result.detail || 'failed'),
      ms: result.ms
    })
  })
  if (ssot.tests.length > 300) ssot.tests = ssot.tests.slice(-300)

  currentRun.counters.testsPassed = outcome.passed
  currentRun.counters.testsFailed = outcome.failed

  const failing = outcome.results.filter((result) => !result.ok)
  const summary = outcome.ok
    ? 'All ' + outcome.passed + ' checks passed.'
    : outcome.failed + ' of ' + outcome.results.length + ' checks failed: ' +
      failing.slice(0, 3).map((result) => result.name).join('; ')

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
