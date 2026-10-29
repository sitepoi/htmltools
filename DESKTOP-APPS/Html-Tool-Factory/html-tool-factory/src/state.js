'use strict'

// Run persistence. One directory per run:
//   runs/<runId>/run.json      run record (status, idea, counters)
//   runs/<runId>/ssot.json     the living specification (single source of truth)
//   runs/<runId>/app/          the generated application
//   runs/<runId>/events.jsonl  append-only event stream
//   runs/<runId>/.lock         single-writer lock

const fs = require('fs')
const path = require('path')
const {
  nowIso, shortId, slugify, ensureDir, readJsonFile, writeJsonAtomic, dateStamp, hashText
} = require('./util')

const RUN_STATUSES = ['idle', 'running', 'paused', 'stopped', 'done', 'error']
const LOCK_STALE_MS = 6 * 60 * 60 * 1000
// A run id is a single folder name. Anything else (separators, dots, absolute
// paths) is rejected before it can be joined into a path.
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/

function isValidRunId(runId) {
  const value = String(runId == null ? '' : runId)
  if (!RUN_ID_PATTERN.test(value)) return false
  if (value.includes('..')) return false
  if (value.includes('/') || value.includes('\\')) return false
  return true
}

class RunStore {
  constructor(runsDirectory) {
    this.runsDirectory = path.resolve(runsDirectory)
    ensureDir(this.runsDirectory)
  }

  runDirectory(runId) {
    if (!isValidRunId(runId)) throw new Error('Invalid run id.')
    return path.join(this.runsDirectory, runId)
  }

  // The deliverable: one tool folder holding app/ and docs/.
  toolDirectory(runId) {
    return path.join(this.runDirectory(runId), 'tool')
  }

  appDirectory(runId) {
    return path.join(this.toolDirectory(runId), 'app')
  }

  docsDirectory(runId) {
    return path.join(this.toolDirectory(runId), 'docs')
  }

  ssotPath(runId) {
    return path.join(this.runDirectory(runId), 'ssot.json')
  }

  createRun(options) {
    const settings = options || {}
    const idea = settings.idea || {}
    const ideaName = String(idea.name || settings.ideaName || 'Untitled Application').trim()
    const runId = dateStamp() + '-' + slugify(ideaName).slice(0, 40) + '-' + shortId('r').slice(-6)
    const directory = this.runDirectory(runId)
    ensureDir(directory)
    ensureDir(this.appDirectory(runId))
    ensureDir(this.docsDirectory(runId))

    const run = {
      id: runId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      status: 'idle',
      stage: 'select-idea',
      iteration: 0,
      idea: {
        id: String(idea.id || ''),
        name: ideaName,
        purpose: String(idea.purpose || ''),
        category: String(idea.category || idea.sub || ''),
        source: String(idea.source || 'idea catalog')
      },
      options: {
        maxIterations: Number(settings.maxIterations) || 3,
        maxTasksPerIteration: Number(settings.maxTasksPerIteration) || 4,
        provider: String(settings.provider || ''),
        dryRun: Boolean(settings.dryRun),
        industryFocus: String(settings.industryFocus || ''),
        // Per run review policy: hold every batch before it is written.
        review: {
          eachBatch: Boolean(settings.reviewEachBatch),
          note: String(settings.reviewNote || '')
        }
      },
      counters: {
        aiCalls: 0,
        inputChars: 0,
        outputChars: 0,
        // Tokens the provider itself reported, when it reports any.
        apiPromptTokens: 0,
        apiCompletionTokens: 0,
        tasksDone: 0,
        tasksFailed: 0,
        testsPassed: 0,
        testsFailed: 0
      },
      lastError: null,
      lastSummary: '',
      stoppedReason: '',
      target: null
    }
    this.saveRun(run)
    // Runtime-only fields (never persisted before the first save): the
    // absolute locations of the run. toolDirectory is re-resolved by
    // assignToolDirectory once the idea and its folder code are known.
    run.directory = directory
    run.toolDirectory = this.toolDirectory(runId)
    run.appDirectory = this.appDirectory(runId)
    return run
  }

  saveRun(run) {
    const nextRun = Object.assign({}, run, { updatedAt: nowIso() })
    if (!RUN_STATUSES.includes(nextRun.status)) nextRun.status = 'idle'
    writeJsonAtomic(path.join(this.runDirectory(run.id), 'run.json'), nextRun)
    Object.assign(run, nextRun)
    return run
  }

  loadRun(runId) {
    if (!isValidRunId(runId)) return null
    const filePath = path.join(this.runDirectory(runId), 'run.json')
    const run = readJsonFile(filePath, null)
    if (!run) return null
    run.directory = this.runDirectory(runId)
    const target = run.target || null
    if (target && target.mode === 'repo' && target.absolutePath) {
      run.toolDirectory = target.absolutePath
      run.appDirectory = path.join(target.absolutePath, 'app')
    } else {
      run.toolDirectory = this.toolDirectory(runId)
      run.appDirectory = this.appDirectory(runId)
    }
    return run
  }

  // Moves the deliverable to the real repository folder for the idea, resolved
  // from the folder taxonomy (for example BUSINESS/GENERAL/ai-automation/...).
  // The run folder keeps only the run state, events and backups.
  assignToolDirectory(run, options) {
    const settings = options || {}
    const mode = String(settings.mode || 'repo')
    if (mode !== 'repo') {
      const fallback = this.toolDirectory(run.id)
      ensureDir(fallback)
      ensureDir(path.join(fallback, 'docs'))
      run.target = { mode: 'run', repoRoot: '', relativePath: '', absolutePath: fallback }
      run.toolDirectory = fallback
      run.appDirectory = path.join(fallback, 'app')
      this.saveRun(run)
      return { ok: true, mode: 'run', absolutePath: fallback, relativePath: '' }
    }

    const taxonomy = require('./tool/taxonomy')
    const resolved = taxonomy.resolveTargetDirectory({
      code: settings.code,
      toolName: settings.toolName,
      repoRoot: settings.repoRoot,
      taxonomyFile: settings.taxonomyFile,
      category: settings.category
    })
    if (!resolved.ok) return resolved

    const contractFiles = ['app/' + settings.toolName + '.html', 'app/' + settings.toolName + '.css', 'app/' + settings.toolName + '.js']
    const occupied = contractFiles.filter((relativePath) => fs.existsSync(path.join(resolved.absolutePath, relativePath)))
    if (occupied.length && settings.overwrite !== true) {
      return {
        ok: false,
        code: 'TARGET_EXISTS',
        reason: 'The tool folder already exists and holds ' + occupied.join(', ') + ': ' + resolved.absolutePath +
          '. Choose another tool name, delete the folder, or set target.overwrite=true in config.local.json.'
      }
    }

    ensureDir(path.join(resolved.absolutePath, 'app'))
    ensureDir(path.join(resolved.absolutePath, 'docs'))
    run.target = {
      mode: 'repo',
      repoRoot: resolved.repoRoot,
      relativePath: resolved.relativePath,
      absolutePath: resolved.absolutePath,
      label: resolved.label,
      code: resolved.code
    }
    run.toolDirectory = resolved.absolutePath
    run.appDirectory = path.join(resolved.absolutePath, 'app')
    this.saveRun(run)
    return {
      ok: true,
      mode: 'repo',
      absolutePath: resolved.absolutePath,
      relativePath: resolved.relativePath,
      label: resolved.label
    }
  }

  // Only a folder this run owns may ever be deleted: the tool folder under the
  // run directory, or the exact taxonomy folder recorded in run.target.
  isDeletableToolFolder(run, directoryPath) {
    const target = path.resolve(String(directoryPath || ''))
    const runDirectory = path.resolve(run.directory)
    if (!fs.existsSync(target)) return { ok: false, reason: 'The folder does not exist' }
    if (target === runDirectory || target === this.runsDirectory) {
      return { ok: false, reason: 'Refusing to delete the run folder itself' }
    }
    const runToolFolder = path.join(runDirectory, 'tool')
    if (target === runToolFolder || target.startsWith(runToolFolder + path.sep)) {
      return { ok: true, mode: 'run' }
    }
    const record = run.target || {}
    const recorded = record.absolutePath ? path.resolve(record.absolutePath) : ''
    const segments = String(record.relativePath || '').split('/').filter(Boolean)
    // A repository target must live under BUSINESS or PERSONAL, at least three
    // segments deep: a configuration mistake can never point at the repo root,
    // a sibling app or a documentation folder.
    const insideTaxonomy = segments.length >= 3 && ['BUSINESS', 'PERSONAL'].includes(segments[0])
    if (record.mode === 'repo' && recorded === target && insideTaxonomy) {
      return { ok: true, mode: 'repo' }
    }
    return { ok: false, reason: 'The folder is not the tool folder of this run' }
  }

  checkpointDirectory(run) {
    return path.join(run.directory, '.checkpoints')
  }

  // A batch that waits for the operator. The request is written by the apply
  // stage, the decision is written by the dashboard, and nothing of the batch
  // touches disk before the decision is "approve".
  reviewPath(runId) {
    return path.join(this.runDirectory(runId), 'review.json')
  }

  writeReview(runId, payload) {
    writeJsonAtomic(this.reviewPath(runId), payload || {})
    return payload
  }

  readReview(runId) {
    return readJsonFile(this.reviewPath(runId), null)
  }

  clearReview(runId) {
    try {
      const filePath = this.reviewPath(runId)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch (_error) {
      // a stale review file is harmless: it is overwritten next time
    }
  }

  // Remembers the hash the factory itself wrote last per file, so a restore can
  // tell "a later factory batch changed it" from "somebody edited it by hand".
  checkpointIndex(run) {
    return readJsonFile(path.join(this.checkpointDirectory(run), 'index.json'), {}) || {}
  }

  updateCheckpointIndex(run, entries) {
    const index = this.checkpointIndex(run)
    Object.keys(entries || {}).forEach((key) => { index[key] = entries[key] })
    ensureDir(this.checkpointDirectory(run))
    writeJsonAtomic(path.join(this.checkpointDirectory(run), 'index.json'), index)
    return index
  }

  // A checkpoint keeps the files a batch wrote plus the SSOT at that moment, so
  // one bad batch can be undone without deleting the whole tool.
  saveCheckpoint(run, batchId, files, ssot) {
    const safeId = String(batchId || 'batch').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'batch'
    const directory = path.join(this.checkpointDirectory(run), safeId)
    ensureDir(path.join(directory, 'files'))
    const manifest = { id: safeId, at: nowIso(), files: [], ssot: 'ssot.json' }
    ;(Array.isArray(files) ? files : []).forEach((file) => {
      const relativePath = String(file && file.path || '').replace(/\\/g, '/')
      if (!relativePath) return
      const content = String(file.content == null ? '' : file.content)
      const target = path.join(directory, 'files', relativePath.split('/').join(path.sep))
      ensureDir(path.dirname(target))
      fs.writeFileSync(target, content, 'utf8')
      manifest.files.push({ path: relativePath, sha: hashText(content), bytes: content.length })
    })
    if (ssot) writeJsonAtomic(path.join(directory, 'ssot.json'), ssot)
    writeJsonAtomic(path.join(directory, 'manifest.json'), manifest)
    const indexEntries = {}
    manifest.files.forEach((file) => {
      indexEntries[file.path] = { sha: file.sha, batch: safeId, at: manifest.at }
    })
    this.updateCheckpointIndex(run, indexEntries)
    return manifest
  }

  listCheckpoints(run) {
    let entries = []
    try {
      entries = fs.readdirSync(this.checkpointDirectory(run), { withFileTypes: true })
    } catch (_error) {
      return []
    }
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => readJsonFile(path.join(this.checkpointDirectory(run), entry.name, 'manifest.json'), null))
      .filter(Boolean)
      .sort((left, right) => String(left.at).localeCompare(String(right.at)))
  }

  // Restores a checkpoint. Files that changed outside the factory are reported
  // instead of overwritten, unless the caller explicitly forces it.
  restoreCheckpoint(run, batchId, options) {
    const settings = options || {}
    const safeId = String(batchId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)
    const directory = path.join(this.checkpointDirectory(run), safeId)
    const manifest = readJsonFile(path.join(directory, 'manifest.json'), null)
    if (!manifest) return { ok: false, reason: 'Checkpoint not found: ' + batchId }
    const guard = this.isDeletableToolFolder(run, run.toolDirectory)
    if (!guard.ok) return { ok: false, reason: guard.reason }

    const conflicts = []
    const factoryIndex = this.checkpointIndex(run)
    const plan = (manifest.files || []).map((file) => {
      const absolute = path.join(run.toolDirectory, file.path.split('/').join(path.sep))
      let current = null
      try { current = fs.readFileSync(absolute, 'utf8') } catch (_error) { current = null }
      const stored = path.join(directory, 'files', file.path.split('/').join(path.sep))
      let content = ''
      try { content = fs.readFileSync(stored, 'utf8') } catch (_error) { content = '' }
      const factorySha = factoryIndex[file.path] ? factoryIndex[file.path].sha : file.sha
      const changedOutside = current !== null && hashText(current) !== factorySha
      if (changedOutside) conflicts.push(file.path)
      return { path: file.path, absolute, content }
    })
    if (conflicts.length && settings.force !== true) {
      return { ok: false, reason: 'These files changed outside the factory', conflicts, needsForce: true }
    }
    const restoredIndex = {}
    plan.forEach((entry) => {
      ensureDir(path.dirname(entry.absolute))
      fs.writeFileSync(entry.absolute, entry.content, 'utf8')
      restoredIndex[entry.path] = { sha: hashText(entry.content), batch: safeId, at: nowIso() }
    })
    this.updateCheckpointIndex(run, restoredIndex)
    const snapshot = readJsonFile(path.join(directory, 'ssot.json'), null)
    if (snapshot) this.writeSsot(run.id, snapshot)
    return { ok: true, restored: plan.map((entry) => entry.path), conflicts, ssot: snapshot }
  }

  // Restart: delete the generated tool folder and reset the run to its first
  // stage. The run record and the idea stay, so the same idea can be rebuilt.
  resetRun(runId) {
    const run = this.loadRun(runId)
    if (!run) return { ok: false, reason: 'Run not found: ' + runId }
    const removed = []
    const guard = this.isDeletableToolFolder(run, run.toolDirectory)
    if (guard.ok) {
      fs.rmSync(run.toolDirectory, { recursive: true, force: true })
      removed.push(run.toolDirectory)
    }
    const backupDirectory = path.join(run.directory, '.backup')
    if (fs.existsSync(backupDirectory)) {
      fs.rmSync(backupDirectory, { recursive: true, force: true })
      removed.push(backupDirectory)
    }
    run.status = 'idle'
    run.stage = 'select-idea'
    run.iteration = 0
    run.iterationStartedAt = null
    run.lastError = null
    run.lastSummary = ''
    run.stoppedReason = ''
    run.summary = null
    run.target = null
    run.now = null
    run.pendingReview = null
    run.toolName = ''
    run.toolPrefix = ''
    run.counters = {
      aiCalls: 0,
      inputChars: 0,
      outputChars: 0,
      apiPromptTokens: 0,
      apiCompletionTokens: 0,
      tasksDone: 0,
      tasksFailed: 0,
      testsPassed: 0,
      testsFailed: 0
    }
    this.saveRun(run)
    const ssotModel = require('./ssot/model')
    this.writeSsot(runId, ssotModel.createSsot(run.idea))
    return { ok: true, removed, guard: guard.reason || '' }
  }

  // Continue: reopen parked work, keep the tool folder and extend the iteration
  // budget so the same tool can be developed further.
  reopenWork(runId, extraIterations) {
    const run = this.loadRun(runId)
    if (!run) return { ok: false, reason: 'Run not found: ' + runId }
    const ssotModel = require('./ssot/model')
    const ssot = ssotModel.normalizeSsot(this.readSsot(runId), run.idea)
    let reopened = 0
    ssot.tasks.forEach((task) => {
      if (task.status === 'skipped' || task.status === 'blocked') {
        task.status = 'todo'
        task.attempts = 0
        task.retries = 0
        reopened += 1
      }
    })
    ssot.checklist.forEach((item) => {
      if (item.status !== 'doing') return
      const owner = ssot.tasks.find((task) => task.checklistId === item.id &&
        task.status !== 'skipped' && task.status !== 'done')
      if (!owner) item.status = 'todo'
    })
    const extra = Math.max(1, Math.min(20, Number(extraIterations) || 5))
    const current = Number(run.options && run.options.maxIterations) || 0
    run.options.maxIterations = Math.max(current, run.iteration) + extra
    // A run stopped by the call or character budget cannot continue otherwise:
    // the counters are per run, so a deliberate Continue starts a fresh meter.
    const budgetStop = /budget/i.test(String(run.lastError || '') + ' ' + String(run.stoppedReason || ''))
    if (budgetStop) {
      run.counters = {
        aiCalls: 0,
        inputChars: 0,
        outputChars: 0,
        tasksDone: run.counters.tasksDone || 0,
        tasksFailed: run.counters.tasksFailed || 0,
        testsPassed: run.counters.testsPassed || 0,
        testsFailed: run.counters.testsFailed || 0
      }
    }
    if (run.stage === 'done') run.stage = 'plan-tasks'
    run.status = 'idle'
    run.lastError = null
    run.stoppedReason = ''
    run.summary = null
    this.saveRun(run)
    this.writeSsot(runId, ssot)
    return {
      ok: true,
      reopened,
      budgetReset: budgetStop,
      maxIterations: run.options.maxIterations,
      stage: run.stage
    }
  }

  listRuns() {
    let entries = []
    try {
      entries = fs.readdirSync(this.runsDirectory, { withFileTypes: true })
    } catch (_error) {
      return []
    }
    const runs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => this.loadRun(entry.name))
      .filter(Boolean)
    runs.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    return runs
  }

  deleteRun(runId) {
    if (!isValidRunId(runId)) return false
    const directory = this.runDirectory(runId)
    if (!fs.existsSync(directory)) return false
    fs.rmSync(directory, { recursive: true, force: true })
    return true
  }

  readSsot(runId) {
    return readJsonFile(this.ssotPath(runId), null)
  }

  writeSsot(runId, ssotValue) {
    writeJsonAtomic(this.ssotPath(runId), ssotValue)
    return ssotValue
  }

  // ---- lock -----------------------------------------------------------------
  acquireLock(runId) {
    const lockPath = path.join(this.runDirectory(runId), '.lock')
    if (fs.existsSync(lockPath)) {
      const existing = readJsonFile(lockPath, null)
      const lockAgeMs = existing && existing.at ? Date.now() - Date.parse(existing.at) : LOCK_STALE_MS + 1
      const processAlive = existing && existing.pid ? isProcessAlive(existing.pid) : false
      if (existing && lockAgeMs < LOCK_STALE_MS && processAlive) {
        return { ok: false, holder: existing }
      }
      try { fs.unlinkSync(lockPath) } catch (_error) { /* ignore */ }
    }
    writeJsonAtomic(lockPath, { pid: process.pid, at: nowIso() })
    return { ok: true }
  }

  releaseLock(runId) {
    try {
      fs.unlinkSync(path.join(this.runDirectory(runId), '.lock'))
    } catch (_error) {
      // already released
    }
  }
}

function isProcessAlive(processId) {
  try {
    process.kill(Number(processId), 0)
    return true
  } catch (error) {
    return error && error.code === 'EPERM'
  }
}

module.exports = { RunStore, RUN_STATUSES, isValidRunId }
