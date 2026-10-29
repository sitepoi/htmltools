'use strict'

// Deterministic test stage: no AI involved. Every check returns pass or fail
// with a short detail line, which becomes the input for the next planning
// step. Free signal for the loop.

const { spawn } = require('child_process')
const { nowIso, truncateTail } = require('../util')

const DEFAULT_TIMEOUT_MS = 60000
const OUTPUT_CAP_CHARS = 4000

function runProcess(check) {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const timeoutMs = Number(check.timeoutMs) || DEFAULT_TIMEOUT_MS
    const useShell = Boolean(check.shell)
    const child = spawn(check.command, check.args || [], {
      cwd: check.cwd,
      shell: useShell,
      windowsHide: true
    })
    let stdoutText = ''
    let stderrText = ''
    let settled = false

    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(Object.assign({
        name: check.name,
        at: nowIso(),
        ms: Date.now() - startedAt,
        stdout: truncateTail(stdoutText, OUTPUT_CAP_CHARS),
        stderr: truncateTail(stderrText, OUTPUT_CAP_CHARS)
      }, result))
    }

    const timer = setTimeout(() => {
      try { child.kill() } catch (_error) { /* ignore */ }
      finish({ ok: false, exitCode: null, detail: 'Timed out after ' + timeoutMs + ' ms' })
    }, timeoutMs)
    if (timer && typeof timer.unref === 'function') timer.unref()

    child.stdout.on('data', (chunk) => { stdoutText += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderrText += chunk.toString() })
    child.on('error', (error) => {
      finish({ ok: false, exitCode: null, detail: 'Could not start the check: ' + error.message })
    })
    child.on('close', (exitCode) => {
      const expected = Number.isInteger(check.expectExit) ? check.expectExit : 0
      const detailSource = String(stderrText || stdoutText || '').trim()
      finish({
        ok: exitCode === expected,
        exitCode,
        detail: exitCode === expected
          ? 'exit code ' + exitCode
          : 'exit code ' + exitCode + (detailSource ? ': ' + detailSource.split('\n').slice(0, 3).join(' ') : '')
      })
    })
  })
}

function nodeCheckFor(file) {
  return {
    name: 'node --check ' + file,
    command: process.execPath,
    args: ['--check', file.absolutePath]
  }
}

function buildCheckPlan(workspace, configuredChecks) {
  const plan = []
  const sourceFiles = workspace.sourceFiles({
    extensions: ['.js', '.cjs', '.mjs'],
    maxFiles: 40
  })
  sourceFiles.forEach((file) => {
    plan.push(nodeCheckFor({
      absolutePath: workspace.resolveInside(file.relativePath)
    }))
    plan[plan.length - 1].name = 'node --check ' + file.relativePath
  })

  if (!plan.length) {
    plan.push({
      name: 'application contains at least one JavaScript file',
      command: process.execPath,
      args: ['-e', 'process.exit(0)']
    })
  }

  const entryPages = workspace.listFiles({ maxFiles: 20, maxDepth: 3, extensions: ['.html', '.htm'] })
  plan.push({
    name: 'application has at least one HTML page',
    command: process.execPath,
    args: ['-e', entryPages.length
      ? 'process.exit(0)'
      : 'console.error("No .html file found in the application folder");process.exit(1)']
  })

  ;(Array.isArray(configuredChecks) ? configuredChecks : []).forEach((check) => {
    if (!check || !check.command) return
    plan.push({
      name: check.name || String(check.command).slice(0, 80),
      command: check.command,
      args: [],
      shell: true,
      cwd: check.cwd ? workspace.resolveInside(check.cwd) : workspace.root,
      timeoutMs: check.timeoutMs,
      expectExit: check.expectExit
    })
  })

  return plan.slice(0, 60)
}

async function runChecks(workspace, configuredChecks, onProgress) {
  const plan = buildCheckPlan(workspace, configuredChecks)
  const results = []
  for (const check of plan) {
    if (typeof onProgress === 'function') onProgress(check.name)
    const result = await runProcess(check)
    results.push({
      name: result.name,
      at: result.at,
      ok: result.ok,
      detail: result.detail,
      ms: result.ms
    })
  }
  const passed = results.filter((result) => result.ok).length
  return {
    results,
    passed,
    failed: results.length - passed,
    ok: results.every((result) => result.ok)
  }
}

module.exports = { runChecks, buildCheckPlan, runProcess }
