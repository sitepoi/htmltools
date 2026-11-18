'use strict'

// Offline self test. Uses the mock provider, so it proves the whole loop
// (specification, planning, risk review, resolution, patching, validation,
// checks, iteration close) without a single network call or token.

const fs = require('fs')
const path = require('path')

const { APP_ROOT, loadConfig, describeProvider, modelSummary, publicConfigView, clampWorkers } = require('../src/config')
const { RunStore, isValidRunId } = require('../src/state')
const { unifiedDiff } = require('../src/code/diff')
const { createPipeline } = require('../src/pipeline')
const { hub, readEvents } = require('../src/log')
const { Workspace } = require('../src/code/workspace')
const { applyOps } = require('../src/code/patch')
const { validateText, validateFiles } = require('../src/code/validate')
const { parseJsonLoose } = require('../src/ai/parse')
const { computeTimeout, createAiClient, readServerSentEvents, readJsonLines } = require('../src/ai/client')
const { applyBatchPrompt } = require('../src/ai/prompts')
const { sleep } = require('../src/util')
const live = require('../src/live')
const { loadIdeaCatalog } = require('../src/idea/catalog')
const { recordDevelopment } = require('../src/idea/writeBack')
const ssotModel = require('../src/ssot/model')
const { renderSsotHtml } = require('../src/ssot/render')
const { resolveTargetDirectory } = require('../src/tool/taxonomy')
const { checkTargetPath, validateContractFile } = require('../src/tool/contract')
const { contractFiles } = require('../src/tool/scaffold')
const scoring = require('../src/ssot/scoring')
const chatService = require('../src/chat/service')
const probes = require('../src/agent/probes')
const { normalizeIncomingTasks } = require('../src/stages/shared')
const { auditChecklist } = require('../src/code/capabilityAudit')
const toolRoots = require('../src/toolRoots')
const workspace = require('../src/workspace')
const studioChat = require('../src/studio/chat')
const studioChats = require('../src/studio/chats')
const storeMap = require('../src/cms/storeMap')
const { createStoreClient } = require('../src/cms/storeClient')
const secretsKeys = require('../src/cms/secrets')

const OUTPUT_DIRECTORY = path.join(APP_ROOT, 'selftest-output')
const RUNS_DIRECTORY = path.join(OUTPUT_DIRECTORY, 'runs')

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

function checkUnitBehaviour() {
  process.stdout.write('\nUnit checks\n')

  const fenced = parseJsonLoose('```json\n{"a": 1, "b": [1,2,],}\n```')
  check('parseJsonLoose strips fences and trailing commas', fenced.a === 1 && fenced.b.length === 2)

  const prose = parseJsonLoose('Here you go:\n{"ok":true}\nHope this helps.')
  check('parseJsonLoose finds JSON inside prose', prose.ok === true)

  let parseFailed = false
  try {
    parseJsonLoose('not json at all')
  } catch (_error) {
    parseFailed = true
  }
  check('parseJsonLoose rejects garbage with an error', parseFailed)

  const temporaryRoot = path.join(OUTPUT_DIRECTORY, 'unit-workspace')
  fs.rmSync(temporaryRoot, { recursive: true, force: true })
  const workspace = new Workspace(temporaryRoot)

  const created = applyOps(workspace, [{ op: 'create', file: 'a.js', content: "'use strict'\nconst a = 1\n" }])
  check('applyOps creates a new file', created.ok && workspace.exists('a.js'))

  const duplicate = applyOps(workspace, [{ op: 'create', file: 'a.js', content: 'x' }])
  check('applyOps rejects create on an existing file', !duplicate.ok && duplicate.problems.length === 1)

  const ambiguous = applyOps(workspace, [
    { op: 'create', file: 'b.js', content: 'const x = 1\nconst y = 2\n' },
    { op: 'replace', file: 'b.js', find: 'const', content: 'let' }
  ])
  check('applyOps rejects an ambiguous anchor', !ambiguous.ok && !workspace.exists('b.js'),
    ambiguous.ok ? 'it was accepted' : 'rejected, and nothing was written')

  const missingAnchor = applyOps(workspace, [{ op: 'replace', file: 'a.js', find: 'not here', replace: 'x' }])
  check('applyOps rejects a missing anchor', !missingAnchor.ok)

  const replaced = applyOps(workspace, [{ op: 'replace', file: 'a.js', find: 'const a = 1', replace: 'const a = 2' }])
  check('applyOps applies a unique replace', replaced.ok && workspace.readText('a.js').includes('const a = 2'))

  let escapeBlocked = false
  try {
    workspace.resolveInside('../outside.txt')
  } catch (_error) {
    escapeBlocked = true
  }
  check('workspace blocks path traversal', escapeBlocked)

  const brokenJs = validateText('broken.js', 'function x( {')
  check('validateText catches a JavaScript syntax error', !brokenJs.ok)

  const brokenHtml = validateText('broken.html', '<div><section></div>')
  check('validateText catches unbalanced html', !brokenHtml.ok)

  const secretFile = validateText('leak.js', "const key = 'AKIA1234567890ABCDEF'")
  check('validateText catches a leaked access key', !secretFile.ok)

  const goodHtml = validateText('good.html', '<!DOCTYPE html><html><body><div><p>hi</p></div></body></html>')
  check('validateText accepts a clean document', goodHtml.ok)

  const validationAll = validateFiles(workspace, ['a.js'])
  check('validateFiles checks an existing file', validationAll.ok)

  // ---- security guards -------------------------------------------------
  check('invalid run ids are rejected',
    !isValidRunId('../escape') && !isValidRunId('a/b') && !isValidRunId('') && isValidRunId('2026-01-01-tool-abc123'))

  const deleteAttempt = applyOps(workspace, [{ op: 'delete', file: 'a.js' }])
  check('deleting files is refused by default', !deleteAttempt.ok && workspace.exists('a.js'),
    deleteAttempt.problems.map((problem) => problem.message).join(' | '))

  const deleteAllowed = applyOps(workspace, [{ op: 'delete', file: 'a.js' }], { allowDelete: true })
  check('deleting files works when the operator allows it', deleteAllowed.ok && !workspace.exists('a.js'))

  workspace.writeText('docs/ssot.html', '<html><body>generated</body></html>')
  const protectedWrite = applyOps(workspace, [{ op: 'replace', file: 'docs/ssot.html', find: 'generated', content: 'hacked' }])
  check('the generated SSOT page cannot be patched', !protectedWrite.ok)

  const outsideWrite = applyOps(workspace, [{ op: 'create', file: '../../outside.js', content: 'x' }])
  check('a patch cannot escape the tool folder', !outsideWrite.ok)

  const diffText = unifiedDiff('const a = 1\nconst b = 2\n', 'const a = 1\nconst b = 3\n', { file: 'x.js' })
  check('unifiedDiff marks the changed line', diffText.includes('-const b = 2') && diffText.includes('+const b = 3'),
    diffText.slice(0, 80))

  const ssot = ssotModel.createSsot({ id: 'X-1', name: 'Unit Product', purpose: 'tests' })
  ssot.features.push({ id: 'F-01', title: 'One', description: 'd', priority: 'must', status: 'planned' })
  ssot.tasks.push({ id: 'T-01', title: 'Do it', kind: 'code', files: ['a.js'], acceptance: ['works'], status: 'done', attempts: 1 })
  const html = renderSsotHtml(ssot, { generatedAt: new Date().toISOString(), runStatus: 'done' })
  check('renderSsotHtml emits the task list section', html.includes('Task list') && html.includes('Do it'))
  check('renderSsotHtml avoids em dashes', !html.includes('\u2014'))

  const digest = ssotModel.buildDigest(ssot)
  check('buildDigest includes the product and open work', digest.includes('Unit Product') && digest.includes('T-01'))

  try {
    const jsonCatalogPath = path.join(APP_ROOT, '..', '..', '..', 'UNICON-TOOLS', 'tools-catalog', 'tool-ideas-catalog.json')
    const catalog = loadIdeaCatalog(jsonCatalogPath)
    check('the idea catalog loads from the JSON', catalog.catalogPath.endsWith('tool-ideas-catalog.json'),
      catalog.catalogPath)
    check('the idea catalog has ideas with a taxonomy code',
      catalog.ideas.length > 200 && Boolean(catalog.ideas[0].folder) && Boolean(catalog.ideas[0].name),
      'found ' + catalog.ideas.length + ', first ' + catalog.ideas[0].folder)
    const firstByCode = catalog.ideas.find((idea) => idea.id === 'B-G-01-a')
    check('idea ids stay unique and match the catalog', Boolean(firstByCode), 'B-G-01-a')
  } catch (error) {
    check('the idea catalog loads from the JSON', false, error.message)
  }

  // Catalog write back: only the matched entry changes, the file stays valid.
  try {
    const catalogCopy = path.join(OUTPUT_DIRECTORY, 'catalog-copy.json')
    fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true })
    fs.writeFileSync(catalogCopy, JSON.stringify({
      schema: 'uniconhub-tool-idea-catalog',
      ideas: [
        { code: 'B-G-01-a', folder: 'B-G-01-a', name: 'First Idea', purpose: 'one' },
        { code: 'B-G-01-a', folder: 'B-G-01-a', name: 'Second Idea', purpose: 'two', id: 'B-G-01-a-2' }
      ]
    }, null, 2), 'utf8')
    const written = recordDevelopment({
      catalogPath: catalogCopy,
      ideaId: 'B-G-01-a-2',
      ideaName: 'Second Idea',
      status: 'built',
      toolFolder: 'runs/x/tool',
      runId: 'run_1',
      iterations: 2,
      tasksDone: 4,
      checksPassed: 5
    })
    const reread = JSON.parse(fs.readFileSync(catalogCopy, 'utf8'))
    check('recordDevelopment writes the matched idea only', written.ok &&
      reread.ideas[1].development.status === 'built' &&
      reread.ideas[0].development === undefined,
      written.ok ? 'ok' : written.reason)
    check('recordDevelopment keeps the rest of the catalog intact',
      reread.ideas.length === 2 && reread.ideas[0].name === 'First Idea' && reread.schema === 'uniconhub-tool-idea-catalog')
  } catch (error) {
    check('recordDevelopment writes the matched idea only', false, error.message)
  }
}

async function checkContract() {
  process.stdout.write('\nHtml tool contract and folder taxonomy\n')

  const resolved = resolveTargetDirectory({ code: 'B-G-01-a', toolName: 'ExampleTool' })
  check('the taxonomy resolves the idea folder code',
    resolved.ok && resolved.relativePath === 'BUSINESS/GENERAL/ai-automation/ai-chat-assistants/ExampleTool',
    resolved.ok ? resolved.relativePath : resolved.reason)
  check('an unknown folder code is refused',
    !resolveTargetDirectory({ code: 'ZZ-99-zz', toolName: 'ExampleTool' }).ok)
  check('an idea without a folder code is refused',
    !resolveTargetDirectory({ code: '', toolName: 'ExampleTool' }).ok)
  check('a tool writes into the resolved repository folder',
    resolved.ok && resolved.absolutePath.endsWith(path.join('BUSINESS', 'GENERAL', 'ai-automation', 'ai-chat-assistants', 'ExampleTool')),
    resolved.absolutePath)

  check('index.html is refused as a write target', !checkTargetPath('app/index.html', 'ExampleTool').ok)
  check('a React component is refused as a write target',
    !checkTargetPath('app/src/components/Card.jsx', 'ExampleTool').ok)
  check('a TypeScript file is refused as a write target',
    !checkTargetPath('app/src/lib/generate.ts', 'ExampleTool').ok)
  check('the generated SSOT cannot be written by a task',
    !checkTargetPath('docs/ssot.html', 'ExampleTool').ok)
  check('the three html tool files are writable',
    ['app/ExampleTool.html', 'app/ExampleTool.css', 'app/ExampleTool.js']
      .every((file) => checkTargetPath(file, 'ExampleTool').ok))

  const built = contractFiles({ toolName: 'ExampleTool', prefix: 'et-', ssot: {}, idea: { name: 'Example Tool' } })
  check('the scaffold produces three files plus a harness', built.files.length === 4,
    built.files.map((file) => file.path).join(', '))
  const contractProblems = built.files
    .filter((file) => !/test-harness/.test(file.path))
    .flatMap((file) => validateContractFile(file.path, file.content).problems
      .filter((problem) => problem.level === 'error')
      .map((problem) => file.path + ': ' + problem.message))
  check('the scaffolded files satisfy the html tool contract', contractProblems.length === 0,
    contractProblems.join(' | '))
  check('the tool html is a body fragment with a build stamp',
    built.files[0].content.startsWith('<!-- html build ') && !/<html|<body|<!DOCTYPE|<script|<style|<link/i.test(built.files[0].content))
  check('the contract rejects a missing build stamp',
    !validateContractFile('app/ExampleTool.html', '<div>hi</div>').ok)
  check('the contract rejects a script tag in the tool html',
    !validateContractFile('app/ExampleTool.html', '<!-- html build 2026-01-01-1 -->\n<div><script>x</script></div>').ok)
  check('the contract rejects localStorage in the tool script',
    !validateContractFile('app/ExampleTool.js',
      '/* js build 2026-01-01-1 */\nvar TOOL_BUILD = \'2026-01-01-1\'\nconsole.log(\'[TOOL:BOOT]\')\ntool.onReady(function () { localStorage.setItem(\'a\', 1) })').ok)

  // The repository target is exercised against a sandbox root: the folder chain
  // comes from the real taxonomy file, the files stay in the sandbox.
  const sandboxStore = new RunStore(path.join(OUTPUT_DIRECTORY, 'sandbox-runs'))
  const sandboxRoot = path.join(OUTPUT_DIRECTORY, 'sandbox-repo')
  const firstRun = sandboxStore.createRun({ idea: { name: 'Taxonomy Probe' } })
  const assigned = sandboxStore.assignToolDirectory(firstRun, {
    mode: 'repo', code: 'B-G-01-a', toolName: 'TaxonomyProbe', repoRoot: sandboxRoot
  })
  check('a repo target lands in the taxonomy folder',
    assigned.ok && assigned.relativePath === 'BUSINESS/GENERAL/ai-automation/ai-chat-assistants/TaxonomyProbe',
    assigned.ok ? assigned.relativePath : assigned.reason)
  const sandboxTool = path.join(sandboxRoot, 'BUSINESS', 'GENERAL', 'ai-automation', 'ai-chat-assistants', 'TaxonomyProbe')
  check('the repo target folder is created', fs.existsSync(path.join(sandboxTool, 'app')) && fs.existsSync(path.join(sandboxTool, 'docs')))
  check('the run folder is not used for the deliverable',
    !fs.existsSync(path.join(firstRun.directory, 'app')))

  fs.writeFileSync(path.join(sandboxTool, 'app', 'TaxonomyProbe.html'), '<!-- html build 2026-01-01-1 -->\n', 'utf8')
  const secondRun = sandboxStore.createRun({ idea: { name: 'Taxonomy Probe Two' } })
  const refused = sandboxStore.assignToolDirectory(secondRun, {
    mode: 'repo', code: 'B-G-01-a', toolName: 'TaxonomyProbe', repoRoot: sandboxRoot
  })
  check('an occupied tool folder is refused', !refused.ok && refused.code === 'TARGET_EXISTS', refused.reason)
  const overwritten = sandboxStore.assignToolDirectory(secondRun, {
    mode: 'repo', code: 'B-G-01-a', toolName: 'TaxonomyProbe', repoRoot: sandboxRoot, overwrite: true
  })
  check('target.overwrite allows reusing the folder', overwritten.ok)

  // Restart and continue: the delete guard only accepts the tool folder of the
  // run, and continue reopens parked work without deleting anything.
  check('the tool folder is deletable', sandboxStore.isDeletableToolFolder(secondRun, sandboxTool).ok)
  check('the run folder is never deletable', !sandboxStore.isDeletableToolFolder(secondRun, secondRun.directory).ok)
  check('a foreign folder is never deletable', !sandboxStore.isDeletableToolFolder(secondRun, sandboxRoot).ok)
  const resumed = sandboxStore.reopenWork(secondRun.id, 5)
  check('continue raises the iteration budget',
    resumed.ok && resumed.maxIterations >= 5, String(resumed.maxIterations))
  const reset = sandboxStore.resetRun(secondRun.id)
  check('restart deletes the tool folder', reset.ok && !fs.existsSync(sandboxTool), reset.reason)
  check('restart resets the run to the first stage',
    sandboxStore.loadRun(secondRun.id).stage === 'select-idea')

  // A repository target must sit under BUSINESS or PERSONAL, so a bad config
  // cannot point the delete guard at the repo root or a sibling app.
  const forgedRun = Object.assign({}, sandboxStore.loadRun(secondRun.id), {
    target: { mode: 'repo', relativePath: 'DESKTOP-APPS/some-app', absolutePath: sandboxRoot }
  })
  check('a repository target outside the taxonomy is never deletable',
    !sandboxStore.isDeletableToolFolder(forgedRun, sandboxRoot).ok)

  // Checkpoints: a batch can be undone without deleting the tool, and a file
  // edited outside the factory is reported instead of overwritten.
  const thirdRun = sandboxStore.createRun({ idea: { name: 'Checkpoint Probe' } })
  const assignedThird = sandboxStore.assignToolDirectory(thirdRun, {
    mode: 'repo', code: 'B-G-01-a', toolName: 'CheckpointProbe', repoRoot: sandboxRoot
  })
  check('the checkpoint run has a tool folder', assignedThird.ok, assignedThird.reason)
  const checkpointWorkspace = new Workspace(thirdRun.toolDirectory)
  checkpointWorkspace.writeText('app/CheckpointProbe.js', 'var TOOL_BUILD = \'2026-10-29-1\'\n')
  sandboxStore.saveCheckpoint(thirdRun, 'B1', [
    { path: 'app/CheckpointProbe.js', content: 'var TOOL_BUILD = \'2026-10-29-1\'\n' }
  ], { tasks: [] })
  const cleanRestore = sandboxStore.restoreCheckpoint(thirdRun, 'B1')
  check('a checkpoint restores the file it saved',
    cleanRestore.ok && checkpointWorkspace.readText('app/CheckpointProbe.js').includes('2026-10-29-1'),
    cleanRestore.reason || 'restored')
  checkpointWorkspace.writeText('app/CheckpointProbe.js', 'hand edited\n')
  const drift = sandboxStore.restoreCheckpoint(thirdRun, 'B1')
  check('a file changed outside the factory is reported, not overwritten',
    !drift.ok && drift.needsForce === true && (drift.conflicts || []).length === 1, drift.reason)
  const forced = sandboxStore.restoreCheckpoint(thirdRun, 'B1', { force: true })
  check('a forced restore wins over the drift', forced.ok === true, forced.reason)
  check('checkpoints are listed for the operator', sandboxStore.listCheckpoints(thirdRun).length === 1)

  check('an overwrite operation is refused',
    (() => {
      const overwriteWorkspace = new Workspace(path.join(OUTPUT_DIRECTORY, 'overwrite-probe'))
      overwriteWorkspace.writeText('app/Probe.js', 'var a = 1\n')
      const outcome = applyOps(overwriteWorkspace, [{ op: 'overwrite', file: 'app/Probe.js', content: 'x' }], {})
      return outcome.ok === false || overwriteWorkspace.readText('app/Probe.js') === 'var a = 1\n'
    })())

  // A big prompt and a retry both get more time, never unlimited.
  check('the AI timeout grows with the prompt size',
    computeTimeout(60000, 1, 180000, 600000) > 180000, String(computeTimeout(60000, 1, 180000, 600000)))
  check('a retry gets a longer timeout than the first attempt',
    computeTimeout(60000, 3, 180000, 600000) > computeTimeout(60000, 1, 180000, 600000),
    computeTimeout(60000, 3, 180000, 600000) + ' vs ' + computeTimeout(60000, 1, 180000, 600000))
  check('the AI timeout is capped', computeTimeout(1000000, 3, 180000, 600000) === 600000 &&
    computeTimeout(0, 1, 180000, 600000) === 180000)

  // Task scoring and prompt batching: one prompt carries about 100 points.
  const smallA = { id: 'T-01', kind: 'code', files: ['app/X.js', 'app/X.html'], acceptance: ['a', 'b'], title: 'Add the empty state' }
  const smallB = { id: 'T-02', kind: 'chore', files: ['app/X.css'], acceptance: ['a'], title: 'Tweak the label' }
  const big = { id: 'T-03', kind: 'code', files: ['app/X.js', 'app/X.html', 'app/X.css'], acceptance: ['a', 'b', 'c'], title: 'Rewrite the whole workspace from scratch' }
  const smallPoints = scoring.estimatePoints(smallA)
  const bigPoints = scoring.estimatePoints(big)
  check('every task is scored between 5 and 100',
    [smallA, smallB, big].every((task) => {
      const points = scoring.estimatePoints(task)
      return points >= 5 && points <= 100
    }), smallPoints + ' / ' + bigPoints)
  check('a rewrite scores higher than a small change', bigPoints > smallPoints, bigPoints + ' vs ' + smallPoints)
  const packed = scoring.buildBatches([
    { id: 'T-01', points: 45 }, { id: 'T-02', points: 45 }, { id: 'T-03', points: 90 }
  ], { targetPoints: 100, maxBatchPoints: 130 })
  check('small tasks are packed into one batch near the target',
    packed.length === 2 && packed[0].tasks.length === 2 && packed[0].points === 90 && packed[1].points === 90,
    JSON.stringify(packed.map((batch) => batch.points)))
  check('a task that fills the prompt gets a batch of its own',
    scoring.buildBatches([{ id: 'T-01', points: 100 }, { id: 'T-02', points: 20 }], { targetPoints: 100 })
      .every((batch) => batch.points <= 130))
  check('batches never exceed the hard caps',
    scoring.buildBatches(
      Array.from({ length: 12 }, (_unused, index) => ({ id: 'T-' + index, points: 30 })),
      { targetPoints: 100, maxBatchPoints: 130, maxTasksPerBatch: 6 }
    ).every((batch) => batch.tasks.length <= 6 && batch.points <= 130))
}

async function checkChatAndProbes() {
  process.stdout.write('\nSSOT chat and sandboxed probes\n')
  const base = path.join(OUTPUT_DIRECTORY, 'chat-probe')
  fs.mkdirSync(base, { recursive: true })
  const ssot = ssotModel.createSsot({ name: 'Chat Probe Tool' })
  const changes = chatService.applyChatOps(ssot, [
    { op: 'set-definition', summary: 'A tool that keeps quotes in one place.', jobs: ['Write a quote'], outOfScope: ['No accounts'] },
    { op: 'add-feature', title: 'Quote list', description: 'See every quote', priority: 'must' },
    { op: 'add-idea', title: 'Currency switch', why: 'Clients in two countries' },
    { op: 'add-task', title: 'Add the quote list', kind: 'code', files: ['app/ChatProbeTool.js'], acceptance: ['The list renders'] }
  ], 'ChatProbeTool')
  check('the chat writes the definition', ssot.definition.jobs.length === 1 && Boolean(ssot.definition.summary))
  check('the chat adds SSOT entries',
    ssot.features.length === 1 && ssot.ideas.length === 1 && ssot.tasks.length === 1, changes.join(' | '))
  check('a chat task is scored and queued',
    ssot.tasks[0].points >= 5 && ssot.tasks[0].status === 'todo', String(ssot.tasks[0].points))
  check('the chat reports what it changed', changes.length === 4, changes.length + ' change(s)')

  // Probes: a fixed, bounded action. No shell, no free form code execution.
  const probeWorkspace = new Workspace(path.join(base, 'tool'))
  const built = contractFiles({ toolName: 'ProbeTool', prefix: 'pt-', ssot: {}, idea: { name: 'Probe Tool' } })
  built.files.forEach((file) => probeWorkspace.writeText(file.path, file.content))
  const syntaxOk = probes.syntaxProbe(probeWorkspace, 'app/ProbeTool.js')
  check('the syntax probe checks a tool file', syntaxOk.ok === true, syntaxOk.text)
  const syntaxRefused = probes.syntaxProbe(probeWorkspace, '../../outside.js')
  check('the syntax probe refuses a path outside the tool folder', syntaxRefused.ok === false, syntaxRefused.text)
  const smoke = probes.domSmokeProbe(probeWorkspace, 'app/ProbeTool.js')
  check('the DOM smoke probe boots the tool and sees its log',
    smoke.ok === true && smoke.text.includes('[TOOL:BOOT]'), smoke.text.slice(0, 200))
  check('the DOM smoke probe states what it does not prove',
    /Layout/.test(smoke.text) && /not verified/.test(smoke.text), smoke.text.slice(-160))
  const webOff = await probes.webGetProbe('https://example.com', { web: { enabled: false } })
  check('web access is refused while disabled', webOff.ok === false && /disabled/i.test(webOff.text), webOff.text)
  const webNotAllowed = await probes.webGetProbe('https://example.com', {
    web: { enabled: true, allowHosts: ['uniconhub.com'] }
  })
  check('a host that is not allowlisted is refused',
    webNotAllowed.ok === false && /allowlist/i.test(webNotAllowed.text), webNotAllowed.text)
  const notHttps = await probes.webGetProbe('http://example.com', {
    web: { enabled: true, allowHosts: ['example.com'] }
  })
  check('only https is allowed', notHttps.ok === false && /https/i.test(notHttps.text), notHttps.text)

  // T-02: a capability that is only claimed must be reopened.
  const auditWorkspace = new Workspace(path.join(base, 'audit-tool'))
  auditWorkspace.writeText('app/AuditTool.js',
    'function setStatus(text) { return text }\ntool.onReady(function () { setStatus("ready") })\n')
  auditWorkspace.writeText('app/AuditTool.html',
    '<div role="status" id="at-status"></div>\n<label for="at-a">A</label>\n')
  auditWorkspace.writeText('app/AuditTool.css', '@media (max-width: 600px) { }\n@media print { }\n')
  auditWorkspace.writeText('app/test-harness.html', 'console.log("[TOOL:TEST] harness check ran")\n')
  const auditSsot = ssotModel.createSsot({ name: 'Audit Tool' })
  ssotModel.ensureChecklist(auditSsot)
  const auditItem = (id) => auditSsot.checklist.find((item) => item.id === id)
  ;['CL-01', 'CL-05', 'CL-09', 'CL-10'].forEach((id) => { auditItem(id).status = 'done' })
  const auditOutcome = auditChecklist(auditWorkspace, auditSsot, { toolName: 'AuditTool' })
  check('the audit keeps a capability that is visible in the files',
    auditItem('CL-01').status === 'done' && auditItem('CL-09').status === 'done' &&
    auditItem('CL-10').status === 'done', auditOutcome.reopened.join(' | '))
  check('the audit reopens a capability that was only claimed',
    auditItem('CL-05').status === 'todo' && /CL-05/.test(auditOutcome.reopened.join(' ')),
    auditOutcome.reopened.join(' | '))
  check('the audit explains why it reopened an item',
    /missing in js/i.test(String(auditItem('CL-05').reopenReason || '')),
    String(auditItem('CL-05').reopenReason || ''))
}

// Watching the model work: the live buffer, the stream parsers, and the fact
// that a real call reports its text while it is being written.
async function checkLiveView() {
  process.stdout.write('\nLive view of the model calls\n')
  const runId = 'live-selftest-run'
  live.clear(runId)

  const callId = live.begin(runId, { stage: 'apply-tasks', model: 'test-model', inputChars: 120 })
  live.delta(runId, callId, '{"summary"')
  live.delta(runId, callId, ':"two files"}')
  const expectedText = '{"summary":"two files"}'
  const during = live.snapshot(runId)
  check('the live view shows the running call',
    Boolean(during.current) && during.current.text === expectedText, JSON.stringify(during.current && during.current.text))
  check('the live view counts the characters that arrived',
    Boolean(during.current) && during.current.chars === expectedText.length,
    String(during.current && during.current.chars))
  live.end(runId, callId, { ok: true, text: '{"summary":"two files"}' })
  const after = live.snapshot(runId)
  check('a finished call moves into the history',
    after.current === null && after.history.length === 1 && after.history[0].state === 'done',
    JSON.stringify(after.history.map((call) => call.state)))
  check('the history keeps the whole answer',
    after.history[0].text === '{"summary":"two files"}', after.history[0].text)
  live.end(runId, 'c-never-started', { ok: true, text: 'ignored' })
  check('a stale call id cannot close a newer call', live.snapshot(runId).history.length === 1)
  live.clear(runId)

  // The parsers are what turn a provider stream into text and deltas.
  const pieces = []
  const sseBody = [
    'data: {"choices":[{"delta":{"content":"{\\"a\\":"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"1}"}}]}\n\n',
    ': keep-alive\n\n',
    'data: [DONE]\n\n'
  ]
  const sseResponse = {
    headers: { get: () => 'text/event-stream; charset=utf-8' },
    body: {
      getReader: () => {
        let index = 0
        return {
          read: async () => (index < sseBody.length
            ? { done: false, value: Buffer.from(sseBody[index++], 'utf8') }
            : { done: true, value: undefined }),
          releaseLock: () => {}
        }
      }
    }
  }
  const sseText = await readServerSentEvents(sseResponse, (piece) => pieces.push(piece), null)
  check('the stream parser rebuilds the answer from the deltas',
    sseText === '{"a":1}' && pieces.join('') === '{"a":1}', sseText + ' / ' + pieces.join('|'))
  check('the stream parser reports every piece as it arrives', pieces.length === 2, String(pieces.length))

  const ndjsonResponse = {
    headers: { get: () => 'application/x-ndjson' },
    body: {
      getReader: () => {
        const lines = ['{"message":{"content":"hel"}}\n', '{"message":{"content":"lo"},"done":true}\n']
        let index = 0
        return {
          read: async () => (index < lines.length
            ? { done: false, value: Buffer.from(lines[index++], 'utf8') }
            : { done: true, value: undefined }),
          releaseLock: () => {}
        }
      }
    }
  }
  const ndjsonText = await readJsonLines(ndjsonResponse, null, null)
  check('the Ollama line parser rebuilds the answer', ndjsonText === 'hello', ndjsonText)

  // A real client call must publish the answer to the live view, so the mock
  // provider is used: same code path as a network call minus the network.
  const seen = []
  const listener = (event) => {
    if (event.runId === 'live-client-run' && /^live/.test(String(event.type))) {
      seen.push(event.type + (event.delta ? ':' + event.delta.length : ''))
    }
  }
  hub.on('event', listener)
  const clientConfig = loadConfig({
    localConfigPath: path.join(OUTPUT_DIRECTORY, 'missing-config.json'),
    skipEnvironment: true
  })
  clientConfig.provider = 'mock'
  const clientRun = {
    id: 'live-client-run',
    options: { provider: 'mock' },
    counters: { aiCalls: 0, inputChars: 0, outputChars: 0 }
  }
  const client = createAiClient({ config: clientConfig, run: clientRun, logEvent: () => {} })
  await client.chat({ stage: 'plan-tasks', system: 's', user: 'Plan the tasks for a quote tool' })
  hub.removeListener('event', listener)
  const clientLive = live.snapshot('live-client-run')
  check('a model call publishes its answer to the live view',
    clientLive.history.length === 1 && clientLive.history[0].chars > 10,
    JSON.stringify(clientLive.history.map((call) => call.chars)))
  check('the live view streams before the call ends',
    seen.includes('live') && seen.some((entry) => entry.startsWith('live-delta')), seen.join(', '))
  live.clear('live-client-run')
}

// T-03 and T-04: a whole file rewrite only for a large batch, and a batch may
// wait for the operator before a single byte is written.
async function checkEditGates() {
  process.stdout.write('\nRewrite gate and review gate\n')
  hub.setQuiet(true)
  const base = path.join(OUTPUT_DIRECTORY, 'edit-gates')
  fs.rmSync(base, { recursive: true, force: true })

  const workspace = new Workspace(path.join(base, 'tool'))
  workspace.writeText('app/GateTool.js', 'var a = 1;\n')
  const blocked = applyOps(workspace, [{ op: 'overwrite', file: 'app/GateTool.js', content: 'var a = 2;\n' }])
  check('a whole file rewrite is refused when the points gate does not allow it', !blocked.ok,
    blocked.ok ? 'it was accepted' : '')
  check('the refusal names the threshold instead of a vague error',
    /80 points/.test(String((blocked.problems[0] || {}).message || '')),
    String((blocked.problems[0] || {}).message || '').slice(0, 90))
  check('the refused rewrite leaves the file untouched', workspace.readText('app/GateTool.js') === 'var a = 1;\n')

  const allowed = applyOps(workspace, [{ op: 'overwrite', file: 'app/GateTool.js', content: 'var a = 3;\n' }],
    { allowOverwrite: true })
  check('a whole file rewrite is applied when the gate allows it',
    allowed.ok && workspace.readText('app/GateTool.js') === 'var a = 3;\n')

  const dry = applyOps(workspace, [{ op: 'overwrite', file: 'app/GateTool.js', content: 'var a = 4;\n' }],
    { allowOverwrite: true, dryRun: true })
  check('a dry run reports the change without writing it',
    dry.ok && dry.dryRun === true && workspace.readText('app/GateTool.js') === 'var a = 3;\n')
  check('a dry run still carries before and after for the diff',
    dry.changed[0].before === 'var a = 3;\n' && dry.changed[0].after === 'var a = 4;\n')

  const promptSsot = ssotModel.createSsot({ name: 'Gate Tool' })
  const promptTasks = [{ id: 'T-01', title: 'Rebuild the panel', points: 90, files: ['app/GateTool.js'], acceptance: [] }]
  const offered = applyBatchPrompt({
    ssot: promptSsot, tasks: promptTasks, batchId: 'B1', workspace, attempt: 1,
    toolName: 'GateTool', toolPrefix: 'gt-', allowOverwrite: true, overwriteMinPoints: 80
  })
  check('the prompt offers the rewrite to a large batch', /is allowed for this batch/.test(offered.user))
  const withheld = applyBatchPrompt({
    ssot: promptSsot, tasks: promptTasks, batchId: 'B1', workspace, attempt: 1,
    toolName: 'GateTool', toolPrefix: 'gt-', allowOverwrite: false, overwriteMinPoints: 80
  })
  check('the prompt withholds the rewrite from a small batch', /is not allowed for this batch/.test(withheld.user))

  // The review gate needs a running stage, so the mock loop drives it end to end.
  const config = loadConfig({
    localConfigPath: path.join(base, 'missing-config.json'),
    skipEnvironment: true
  })
  config.provider = 'mock'
  config.openBrowser = false
  config.catalog = { writeBack: false }
  config.target = { mode: 'run', root: '', overwrite: true }
  config.limits.maxIterations = 1
  config.limits.maxTasksPerIteration = 2
  config.limits.maxAiCallsPerRun = 40
  config.limits.maxTotalCharsPerRun = 900000
  config.review = { eachBatch: false, timeoutMs: 20000, pollMs: 60 }
  config.stream = { enabled: false }

  const store = new RunStore(path.join(base, 'runs'))
  const pipeline = createPipeline({ store, config, hub })

  // Answers every review request the run makes, so a multi batch iteration does
  // not stop on the second batch.
  async function answerReviews(runId, decision, note) {
    let answered = 0
    let sawPending = null
    for (let round = 0; round < 800; round += 1) {
      await sleep(20)
      const current = store.readReview(runId)
      if (!sawPending && current && current.request) sawPending = current.request
      if (current && current.request && !current.decision) {
        answered += 1
        current.decision = decision
        current.note = note
        current.decidedAt = new Date().toISOString()
        store.writeReview(runId, current)
        continue
      }
      const latest = store.loadRun(runId)
      if (!latest || latest.status !== 'running') break
    }
    return { answered, pending: sawPending }
  }

  function makeRun(name) {
    return store.createRun({
      idea: { id: 'B-G-01-a', name, purpose: 'Exercise the review gate' },
      maxIterations: 1,
      maxTasksPerIteration: 2,
      reviewEachBatch: true
    })
  }

  const approveRun = makeRun('Review Gate Approved')
  const approveLoop = pipeline.startLoop(approveRun.id)
  const approveResult = await answerReviews(approveRun.id, 'approve', 'approved by the self test')
  const approved = await approveLoop
  check('a batch waits for the operator before it is written',
    Boolean(approveResult.pending) && (approveResult.pending.files || []).length > 0,
    approveResult.pending ? approveResult.pending.files.join(', ') : 'no review request')
  check('the review request carries the diff',
    Boolean(approveResult.pending) && String(approveResult.pending.diff || '').length > 20,
    String((approveResult.pending || {}).diff || '').slice(0, 60))
  check('an approved batch is written and the run continues',
    approveResult.answered > 0 && Boolean(approved) && approved.counters.tasksDone > 0,
    approveResult.answered + ' review(s), tasks done ' + (approved && approved.counters.tasksDone))
  const approvedSsot = store.readSsot(approveRun.id)
  const approvedStep = (approvedSsot.steps || []).find((step) => step.stage === 'apply-tasks')
  check('an approved batch is recorded as done',
    (approvedStep && approvedStep.tasks || []).some((batch) => batch.status === 'done'),
    (approvedStep && approvedStep.tasks || []).map((batch) => batch.status).join(','))
  check('the review file is cleared after the decision', !store.readReview(approveRun.id))
  check('the run record no longer shows a pending review', !approved.pendingReview)

  const rejectRun = makeRun('Review Gate Rejected')
  const rejectLoop = pipeline.startLoop(rejectRun.id)
  const rejectResult = await answerReviews(rejectRun.id, 'reject', 'not the change I asked for')
  const rejected = await rejectLoop
  const rejectedSsot = store.readSsot(rejectRun.id)
  const rejectedStep = (rejectedSsot.steps || []).find((step) => step.stage === 'apply-tasks')
  const rejectedBatch = (rejectedStep && rejectedStep.tasks || []).find((batch) => batch.status === 'rejected')
  check('a rejected batch is recorded as rejected, not as a failure',
    Boolean(rejectedBatch), (rejectedStep && rejectedStep.tasks || []).map((batch) => batch.status).join(','))
  const rejectedTasks = (rejectedSsot.tasks || []).filter((task) => (rejectedBatch && rejectedBatch.tasks || [])
    .some((entry) => entry.id === task.id))
  check('a rejected batch leaves its tasks open', rejectedTasks.every((task) => task.status !== 'done'),
    rejectedTasks.map((task) => task.id + ':' + task.status).join(','))
  check('a rejection does not spend a retry',
    rejectedTasks.every((task) => Number(task.retries || 0) === 0 && Number(task.attempts || 0) === 0),
    rejectedTasks.map((task) => task.id + ' retries ' + (task.retries || 0)).join(','))
  check('a rejected batch reports why in the task problems',
    rejectedTasks.every((task) => (task.lastProblems || []).some((line) => /rejected/i.test(line))),
    JSON.stringify(rejectedTasks.slice(0, 1).map((task) => task.lastProblems)))
  check('the run ends with the rejected work still open',
    Boolean(rejected) && ['paused', 'error'].includes(rejected.status),
    rejected ? rejected.status : 'no run')
  check('a rejection stops the rest of the batches', rejectResult.answered === 1,
    rejectResult.answered + ' review(s)')
}

async function checkCostReporting() {
  process.stdout.write('\nReal tokens and the batch preview\n')
  hub.setQuiet(true)

  // A provider that reports usage: those numbers must land in the counters.
  const originalFetch = global.fetch
  const config = loadConfig({
    localConfigPath: path.join(OUTPUT_DIRECTORY, 'missing-config.json'),
    skipEnvironment: true
  })
  config.provider = 'openai-compatible'
  config.openaiCompatible.baseUrl = 'http://127.0.0.1:9/unused'
  config.openaiCompatible.apiKey = 'test'
  config.openaiCompatible.model = 'usage-test'
  config.stream = { enabled: false }
  const run = {
    id: 'usage-run',
    options: { provider: 'openai-compatible' },
    counters: { aiCalls: 0, inputChars: 0, outputChars: 0, apiPromptTokens: 0, apiCompletionTokens: 0 }
  }
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 }
    })
  })
  const client = createAiClient({ config, run, logEvent: () => {} })
  let answer = null
  try {
    answer = await client.chat({ stage: 'cost-check', system: 's', user: 'u' })
  } finally {
    global.fetch = originalFetch
  }
  check('a reported token count is stored on the run',
    run.counters.apiPromptTokens === 120 && run.counters.apiCompletionTokens === 40,
    JSON.stringify({ prompt: run.counters.apiPromptTokens, completion: run.counters.apiCompletionTokens }))
  check('the call returns the reported total', answer && answer.tokens === 160, String(answer && answer.tokens))

  // A streaming answer can carry usage in its last frames.
  const streamedUsage = []
  const sseWithUsage = {
    headers: { get: () => 'text/event-stream' },
    body: {
      getReader: () => {
        const chunks = [
          'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
          'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":30,"completion_tokens":5}}\n\n',
          'data: [DONE]\n\n'
        ]
        let index = 0
        return {
          read: async () => (index < chunks.length
            ? { done: false, value: Buffer.from(chunks[index++], 'utf8') }
            : { done: true, value: undefined }),
          releaseLock: () => {}
        }
      }
    }
  }
  const streamedText = await readServerSentEvents(sseWithUsage, null, null, (usage) => streamedUsage.push(usage))
  check('a streamed answer reports its usage on the last frame',
    streamedText === 'hi' && streamedUsage.length === 1 && streamedUsage[0].prompt_tokens === 30,
    JSON.stringify(streamedUsage))

  // T-06: the plan is written before the first call of the apply stage.
  const previewSsot = ssotModel.createSsot({ name: 'Plan Preview Tool' })
  ssotModel.ensureChecklist(previewSsot)
  const previewTasks = [
    { title: 'Small change', kind: 'code', files: ['app/PlanPreviewTool.js'], acceptance: [], points: 25 },
    { title: 'Another small change', kind: 'code', files: ['app/PlanPreviewTool.js'], acceptance: [], points: 30 },
    { title: 'A large rebuild', kind: 'code', files: ['app/PlanPreviewTool.html'], acceptance: [], points: 90 }
  ]
  normalizeIncomingTasks(previewSsot, previewTasks, 'plan-preview', { toolName: 'PlanPreviewTool' })
  scoring.applyPoints(previewSsot)
  const previewQueue = ssotModel.todoTasks(previewSsot).slice(0, 5)
  const previewBatches = scoring.buildBatches(previewQueue, {
    targetPoints: 100,
    maxBatchPoints: 130,
    maxTasksPerBatch: 6
  })
  check('the batches can be computed before any call is made',
    previewBatches.length >= 2 && previewBatches.every((batch) => batch.tasks.length > 0),
    previewBatches.map((batch) => batch.id + ':' + batch.points).join(', '))
  check('a batch that fills the target is planned on its own',
    previewBatches.some((batch) => batch.points >= 90 && batch.tasks.length === 1),
    previewBatches.map((batch) => batch.points).join(','))
}

// Where the model name comes from: the per stage override wins over the provider
// default, so the dashboard and the log have to say both.
async function checkModelResolution() {
  process.stdout.write('\nWhich model is actually used\n')
  const config = loadConfig({
    localConfigPath: path.join(OUTPUT_DIRECTORY, 'missing-config.json'),
    skipEnvironment: true
  })
  config.provider = 'openai-compatible'
  config.openaiCompatible.baseUrl = 'http://127.0.0.1:9/unused'
  config.openaiCompatible.apiKey = 'test'
  config.openaiCompatible.model = 'flash-endpoint'
  config.models = { planner: 'pro-stage', coder: 'pro-stage' }

  const summary = modelSummary(config)
  check('the model summary names the stage override',
    summary.planner === 'pro-stage' && summary.coder === 'pro-stage' && summary.overrides.length === 2,
    JSON.stringify(summary))
  check('the provider description shows the endpoint model and the override',
    /flash-endpoint/.test(describeProvider(config).detail) && /pro-stage/.test(describeProvider(config).detail),
    describeProvider(config).detail)

  const originalFetch = global.fetch
  const logged = []
  let sentModel = ''
  global.fetch = async (url, options) => {
    sentModel = JSON.parse(options.body).model
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] })
    }
  }
  const run = {
    id: 'model-resolution-run',
    options: { provider: 'openai-compatible' },
    counters: { aiCalls: 0, inputChars: 0, outputChars: 0, apiPromptTokens: 0, apiCompletionTokens: 0 }
  }
  try {
    const client = createAiClient({
      config,
      run,
      logEvent: (type, message) => { if (type === 'ai') logged.push(message) }
    })
    await client.chat({ stage: 'apply-tasks', system: 's', user: 'u', model: config.models.coder })
  } finally {
    global.fetch = originalFetch
  }
  check('the stage override is the model in the request', sentModel === 'pro-stage', sentModel)
  check('the log line names the model that answered',
    logged.some((line) => /with pro-stage/.test(line)), logged.join(' | '))

  const cleared = Object.assign({}, config, { models: { planner: '', coder: '' } })
  const clearedSummary = modelSummary(cleared)
  check('an empty override falls back to the provider model',
    clearedSummary.planner === 'flash-endpoint' && clearedSummary.overrides.length === 0,
    JSON.stringify(clearedSummary))
}

// Phase 1 of the release platform: tool roots, the store map and the read only
// store client. No write is exercised here: that is what the phase gate means.
async function checkReleaseReadLayer() {
  process.stdout.write('\nRelease layer: roots, store map, store read client\n')
  const base = path.join(OUTPUT_DIRECTORY, 'release-layer')
  fs.rmSync(base, { recursive: true, force: true })

  function writeTool(rootPath, folderName, toolName) {
    const toolDirectory = path.join(rootPath, folderName)
    fs.mkdirSync(path.join(toolDirectory, 'app'), { recursive: true })
    fs.mkdirSync(path.join(toolDirectory, 'docs', 'screenshots'), { recursive: true })
    fs.writeFileSync(path.join(toolDirectory, 'app', toolName + '.html'),
      '<!-- html build 2026-11-17-3 -->\n<div data-tool-build="2026-11-17-3">x</div>\n', 'utf8')
    fs.writeFileSync(path.join(toolDirectory, 'app', toolName + '.css'),
      '/* css build 2026-11-17-3 */\n.a { color: #000; }\n', 'utf8')
    fs.writeFileSync(path.join(toolDirectory, 'app', toolName + '.js'),
      "/* js build 2026-11-17-3 */\nvar TOOL_BUILD = '2026-11-17-3';\nconsole.log('[TOOL:BOOT] build ' + TOOL_BUILD);\ntool.onReady(function () {});\n", 'utf8')
    fs.writeFileSync(path.join(toolDirectory, 'app', 'test-harness.html'), '<!DOCTYPE html>\n<p>harness</p>\n', 'utf8')
    ;['webpage', 'help', 'presentation'].forEach((kind) => {
      fs.writeFileSync(path.join(toolDirectory, 'docs', kind + '.html'), '<p>' + kind + '</p>\n', 'utf8')
    })
    fs.writeFileSync(path.join(toolDirectory, 'docs', 'screenshots', 'one.png'), 'png', 'utf8')
    return toolDirectory
  }

  const rootA = path.join(base, 'rootA')
  writeTool(rootA, 'AlphaTool', 'AlphaTool')
  // An app folder that is not a complete tool must be reported, not guessed.
  fs.mkdirSync(path.join(base, 'rootA', 'BrokenTool', 'app'), { recursive: true })
  fs.writeFileSync(path.join(base, 'rootA', 'BrokenTool', 'app', 'BrokenTool.html'), '<div></div>', 'utf8')

  const config = loadConfig({
    localConfigPath: path.join(base, 'missing-config.json'),
    skipEnvironment: true
  })
  config.toolRoots = [
    { label: 'primary', root: rootA, taxonomyFile: '', writable: true },
    { label: 'external', root: rootA, taxonomyFile: '', writable: false }
  ]
  const listing = toolRoots.listTools(config)
  const alpha = listing.tools.find((tool) => tool.slug === 'alphatool')
  check('a tool folder is discovered with its slug, name and stamps',
    Boolean(alpha) && alpha.toolName === 'AlphaTool' && alpha.stamps.html === '2026-11-17-3' &&
    alpha.toolBuild === '2026-11-17-3',
    alpha ? JSON.stringify({ slug: alpha.slug, stamps: alpha.stamps, build: alpha.toolBuild }) : 'not found')
  check('the registry reports the document set and the screenshots',
    Boolean(alpha) && Boolean(alpha.documents.webpage) && Boolean(alpha.documents.help) &&
    alpha.screenshotCount === 1,
    alpha ? JSON.stringify(Object.keys(alpha.documents)) + ' shots ' + alpha.screenshotCount : '')
  check('the harness is part of the registry entry', Boolean(alpha && alpha.harness))
  check('an app folder without the full triple is reported as a problem',
    listing.problems.some((problem) => /BrokenTool/.test(problem.reason)),
    JSON.stringify(listing.problems.map((problem) => problem.reason).slice(0, 2)))
  check('a read only root stays read only',
    listing.tools.every((tool) => tool.label === undefined || tool.writable === false || tool.writable === true) &&
    listing.roots.filter((root) => root.label === 'external').every((root) => root.writable === false),
    JSON.stringify(listing.roots.map((root) => root.label + ':' + root.writable)))
  check('two roots holding the same slug are refused as a conflict',
    listing.tools.filter((tool) => tool.slug === 'alphatool').some((tool) => tool.slugConflict === true) ||
    listing.problems.some((problem) => /share the slug/.test(problem.reason)),
    JSON.stringify(listing.problems.map((problem) => problem.reason)))
  const completeness = toolRoots.packageCompleteness(alpha)
  check('package completeness counts the eight subjects from the files',
    completeness.present.includes('code') && completeness.present.includes('screenshots') &&
    completeness.total === 8 && completeness.complete === false,
    JSON.stringify(completeness))

  // The real repository must be readable through the same registry.
  const repoListing = toolRoots.listTools(loadConfig({ skipEnvironment: true }))
  check('the repository is read as one root with many tools',
    repoListing.tools.length > 10 && repoListing.roots[0].label === 'repo',
    repoListing.tools.length + ' tool(s)')

  // T-27: the store map is data, and an incomplete row is a named block.
  const storeMapPath = path.join(base, 'store-map.json')
  fs.writeFileSync(storeMapPath, JSON.stringify({
    meta: { schema: 'uniconhub-store-map', version: '0.0.1' },
    targets: [
      { id: 'tool', kind: 'tool', cmsObjectType: 'tools-applicationstore', fieldPath: 'x.y', folderId: 'f1', slugRule: 'repoToolSlug', questionRef: 'Q-07', confirmed: true },
      { id: 'doc-help', kind: 'document', documentKind: 'help', cmsObjectType: '', fieldPath: '', folderId: '', slugRule: '<toolSlug>-help', questionRef: 'Q-08', confirmed: false }
    ]
  }, null, 2), 'utf8')
  const goodMap = storeMap.loadStoreMap(storeMapPath)
  check('a complete and confirmed target is writable', storeMap.blockedTarget(goodMap.map, 'tool').ok === true,
    JSON.stringify(goodMap.problems))
  const blockedDoc = storeMap.blockedTarget(goodMap.map, 'doc-help')
  check('an incomplete target blocks and names what is missing',
    blockedDoc.ok === false && blockedDoc.blocked.missing.includes('cmsObjectType') &&
    blockedDoc.blocked.missing.includes('fieldPath'),
    JSON.stringify(blockedDoc.blocked && blockedDoc.blocked.missing))
  check('the block names the question that answers it',
    blockedDoc.blocked.questionRef === 'Q-08', blockedDoc.blocked.questionRef)
  check('an unconfirmed but filled target is blocked, not written',
    storeMap.blockedTarget({
      targets: [{ id: 't', kind: 'tool', cmsObjectType: 'a', fieldPath: 'b', folderId: 'c', slugRule: 'repoToolSlug', questionRef: 'Q-07', confirmed: false }]
    }, 't').ok === false)
  const badMap = storeMap.validateStoreMap({
    meta: { schema: 'wrong', version: '' },
    targets: [
      { id: 'a', kind: 'nope', slugRule: 'repoToolSlug', questionRef: '' },
      { id: 'a', kind: 'tool', slugRule: 'weird rule', folderId: 'x', folderCode: 'y', questionRef: 'Q-1' }
    ]
  })
  check('the validator rejects a bad schema, a bad kind, a duplicate id and two folder answers',
    !badMap.ok &&
    badMap.problems.some((problem) => /meta.schema/.test(problem.message)) &&
    badMap.problems.some((problem) => /share the id/.test(problem.message)) &&
    badMap.problems.some((problem) => /slugRule/.test(problem.message)) &&
    badMap.problems.some((problem) => /not both/.test(problem.message)),
    badMap.problems.map((problem) => problem.field + ':' + problem.message).join(' | ').slice(0, 200))
  const repoMap = storeMap.loadStoreMap(path.resolve(APP_ROOT, '..', '..', '..', 'UNICON-TOOLS', 'tools-catalog', 'store-map.json'))
  check('the repository store map is valid data', repoMap.ok, JSON.stringify(repoMap.problems).slice(0, 160))
  const repoTargets = storeMap.summary(repoMap.map)
  const writableIds = repoTargets.filter((target) => target.writable).map((target) => target.id)
  check('the five document targets are writable from the working editor',
    ['doc-webpage', 'doc-help', 'doc-updates', 'doc-presentation', 'doc-social']
      .every((id) => writableIds.includes(id)),
    writableIds.join(','))
  check('the tool record stays blocked and names the question that unblocks it',
    repoTargets.filter((target) => target.id === 'tool' || target.id === 'library' || target.id === 'application')
      .every((target) => target.writable === false && Boolean(target.questionRef)),
    JSON.stringify(repoTargets.filter((target) => !target.writable).map((target) => target.id)))

  // T-26: the read client. A fake fetch stands in for the store.
  const secret = 'store-key-abcdef123456'
  const cmsConfig = loadConfig({ localConfigPath: path.join(base, 'missing-config.json'), skipEnvironment: true })
  cmsConfig.cms = Object.assign({}, cmsConfig.cms, {
    baseUrl: 'https://store.invalid',
    authMode: 'header',
    apiKey: '',
    readPath: '/api/v2/objects',
    retries: 1
  })
  const noCredential = createStoreClient({ config: cmsConfig, env: {}, fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => '' }, text: async () => '{}' }) })
  const health = noCredential.health()
  check('a missing credential blocks before any request',
    health.ok === false && health.problems.some((problem) => problem.code === 'MISSING_CREDENTIAL'),
    JSON.stringify(health.problems))
  let credentialBlocked = false
  try {
    await noCredential.listObjects('tools-applicationstore')
  } catch (error) {
    credentialBlocked = Boolean(error.blocked) && error.code === 'MISSING_CREDENTIAL' &&
      /Q-01/.test(JSON.stringify(error.details))
  }
  check('a blocked client throws instead of returning an empty list', credentialBlocked)

  function fakeStore(handler) {
    const calls = []
    const fetchImpl = async (url, options) => {
      calls.push({ url, options })
      return handler(url, options, calls.length)
    }
    return { fetchImpl, calls }
  }

  const headerStore = fakeStore(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => '' },
    text: async () => JSON.stringify({ items: [{ objectId: 'o1', name: 'Alpha', productData: { data_categoriesBased: { title: 'Alpha', code: { html: 'x' } } } }] })
  }))
  const headerClient = createStoreClient({
    config: cmsConfig,
    env: { APP_FACTORY_STORE_KEY: secret },
    fetchImpl: headerStore.fetchImpl
  })
  const listed = await headerClient.listObjects('tools-applicationstore', { limit: 5 })
  const headerCall = headerStore.calls[0]
  check('the header form sends the key in a header and never in the URL',
    headerCall.options.headers['x-api-key'] === secret && !headerCall.url.includes(secret) &&
    !headerCall.url.includes('/api/object/'),
    headerCall.url)
  check('a list answer is normalized into records with their field map',
    listed.items.length === 1 && listed.items[0].objectId === 'o1' &&
    listed.items[0].fieldNames.includes('title'),
    JSON.stringify(listed.items.map((item) => item.fieldNames)))
  check('the settings view of the credential is a masked fingerprint',
    headerClient.health().credentialFingerprint.includes('(' + secret.length + ' chars)') &&
    !headerClient.health().credentialFingerprint.includes(secret),
    headerClient.health().credentialFingerprint)

  const legacyStore = fakeStore(async () => ({
    ok: true, status: 200, headers: { get: () => '' }, text: async () => JSON.stringify([{ objectId: 'o2' }])
  }))
  const legacyConfig = Object.assign({}, cmsConfig, {
    cms: Object.assign({}, cmsConfig.cms, { authMode: 'url-token' })
  })
  const legacyClient = createStoreClient({
    config: legacyConfig,
    env: { APP_FACTORY_STORE_KEY: secret },
    fetchImpl: legacyStore.fetchImpl
  })
  await legacyClient.listObjects('tools-applicationstore')
  check('the legacy form puts the token in the path and sends no key header',
    legacyStore.calls[0].url.includes('/api/object/' + encodeURIComponent(secret) + '/query/') &&
    legacyStore.calls[0].options.headers['x-api-key'] === undefined,
    legacyStore.calls[0].url.replace(secret, '<token>'))

  const deniedStore = fakeStore(async () => ({
    ok: false,
    status: 401,
    headers: { get: () => '' },
    text: async () => JSON.stringify({ error: 'bad key ' + secret })
  }))
  const deniedClient = createStoreClient({
    config: cmsConfig,
    env: { APP_FACTORY_STORE_KEY: secret },
    fetchImpl: deniedStore.fetchImpl
  })
  let denied = null
  try {
    await deniedClient.getObject('tools-applicationstore', 'o1')
  } catch (error) {
    denied = error
  }
  check('a refused request surfaces the status and body',
    Boolean(denied) && denied.status === 401 && /bad key/.test(denied.message),
    denied ? denied.message.slice(0, 80) : 'no error')
  check('the credential is redacted from the error text',
    Boolean(denied) && !denied.message.includes(secret) && /redacted/.test(denied.message),
    denied ? denied.message.slice(0, 120) : '')

  let attemptCount = 0
  const flakyStore = fakeStore(async () => {
    attemptCount += 1
    if (attemptCount === 1) {
      return { ok: false, status: 429, headers: { get: () => '0' }, text: async () => 'slow down' }
    }
    return { ok: true, status: 200, headers: { get: () => '' }, text: async () => JSON.stringify({ object: { objectId: 'o9', name: 'Retried' } }) }
  })
  const flakyClient = createStoreClient({
    config: cmsConfig,
    env: { APP_FACTORY_STORE_KEY: secret },
    fetchImpl: flakyStore.fetchImpl
  })
  const retried = await flakyClient.getObject('tools-applicationstore', 'o9')
  check('a 429 is retried and the read still succeeds',
    Boolean(retried) && retried.objectId === 'o9' && flakyStore.calls.length === 2,
    flakyStore.calls.length + ' attempt(s)')

  // Q-01 and Q-03: two keys, in one file the operator controls, outside the repo.
  const secretsFile = path.join(base, 'operator-secrets.json')
  fs.writeFileSync(secretsFile, JSON.stringify({
    store: { baseUrl: 'https://store.invalid', readKey: 'read-key-aaaaaaaaaaaa', writeKey: 'write-key-bbbbbbbbbbbb' }
  }, null, 2), 'utf8')
  const secretsConfig = loadConfig({ localConfigPath: path.join(base, 'missing-config.json'), skipEnvironment: true })
  secretsConfig.secretsPath = secretsFile
  const described = secretsKeys.describeKeys(secretsConfig, {})
  check('both keys are read from the secrets file',
    described.read.present && described.write.present && described.separateKeys,
    JSON.stringify({ read: described.read.fingerprint, write: described.write.fingerprint }))
  check('the reported fingerprint never contains the key',
    !JSON.stringify(described).includes('read-key-aaaaaaaaaaaa') &&
    !JSON.stringify(described).includes('write-key-bbbbbbbbbbbb'),
    described.read.fingerprint)
  const fromEnv = secretsKeys.describeKeys(secretsConfig, { APP_FACTORY_STORE_READ_KEY: 'env-read-key-cccccccccc' })
  check('the environment beats the file for the read key',
    fromEnv.read.source === 'env:APP_FACTORY_STORE_READ_KEY' && fromEnv.read.present,
    fromEnv.read.source)
  const writeOnly = secretsKeys.resolveKey(secretsConfig, {}, 'write')
  check('a write key resolves separately from a read key',
    writeOnly.ok && writeOnly.value === 'write-key-bbbbbbbbbbbb' && writeOnly.kind === 'write',
    writeOnly.source)
  const noSecrets = secretsKeys.resolveKey(config, {}, 'write')
  check('a missing key names the secrets file and the setting',
    noSecrets.ok === false && noSecrets.code === 'MISSING_CREDENTIAL' &&
    /store\.writeKey/.test(noSecrets.reason) && noSecrets.questionRef.includes('Q-03'),
    noSecrets.reason)
  const cmsView = publicConfigView(secretsConfig)
  check('the settings view carries the secrets path and no key value',
    cmsView.cms.secretsPath === secretsFile && cmsView.cms.read.present &&
    !JSON.stringify(cmsView).includes('read-key-aaaaaaaaaaaa'),
    cmsView.cms.secretsPath)
}

async function checkFullLoop() {
  process.stdout.write('\nFull loop with the mock provider\n')
  hub.setQuiet(true)
  fs.rmSync(OUTPUT_DIRECTORY, { recursive: true, force: true })

  const loopIterations = Number(process.env.APP_FACTORY_SELFTEST_ITERATIONS) || 1
  const config = loadConfig({
    localConfigPath: path.join(OUTPUT_DIRECTORY, 'missing-config.json'),
    skipEnvironment: true
  })
  config.provider = 'mock'
  config.limits.maxIterations = loopIterations
  config.limits.maxTasksPerIteration = 2
  config.limits.maxAiCallsPerRun = 20 * loopIterations
  config.limits.maxTotalCharsPerRun = 600000 * loopIterations
  config.openBrowser = false
  // The real catalog is never touched by the test.
  config.catalog = { writeBack: false }
  // The test writes into its own sandbox, never into the real repository tree.
  config.target = { mode: 'run', root: '', overwrite: true }

  const store = new RunStore(RUNS_DIRECTORY)
  const pipeline = createPipeline({ store, config, hub })

  const run = store.createRun({
    idea: { id: 'B-G-01-a', name: 'Document Q&A Assistant', purpose: 'Answer questions over documents' },
    maxIterations: loopIterations,
    maxTasksPerIteration: 2
  })

  const finished = await pipeline.startLoop(run.id)
  check('the loop reaches a terminal state', finished && ['done', 'paused'].includes(finished.status),
    finished ? finished.status + ' / ' + JSON.stringify(finished.lastError) : 'no run')
  check('the loop used the expected number of AI calls', finished.counters.aiCalls >= 5,
    'ai calls ' + finished.counters.aiCalls)

  const ssot = store.readSsot(run.id)
  check('the SSOT has a product definition', Boolean(ssot && ssot.product && ssot.product.problem && ssot.product.solution))
  check('the SSOT has features', ssot.features.length > 0, 'features ' + ssot.features.length)
  check('the SSOT has completed tasks', ssot.tasks.some((task) => task.status === 'done'),
    'tasks ' + ssot.tasks.map((task) => task.status).join(','))
  check('the SSOT has risks that were reviewed', ssot.risks.length > 0)
  check('all questions were resolved', ssot.questions.every((question) => question.status === 'answered'))
  check('checks were recorded', ssot.tests.length > 0, 'checks ' + ssot.tests.length)
  check('every recorded check passed', ssot.tests.every((test) => test.ok),
    ssot.tests.filter((test) => !test.ok).map((test) => test.name).join(' | '))
  check('the iteration was closed', ssot.iterations.length === loopIterations,
    'iterations ' + ssot.iterations.length + ' of ' + loopIterations)
  check('improvement ideas were proposed', ssot.ideas.length > 0, 'ideas ' + ssot.ideas.length)
  check('the activity log has entries', ssot.log.length > 5, 'log ' + ssot.log.length)
  check('a persona was created', ssot.personas.length > 0, 'personas ' + ssot.personas.length)
  check('a persona scenario was walked', ssot.scenarios.length > 0, 'scenarios ' + ssot.scenarios.length)
  check('usability findings were recorded', ssot.usability.length > 0, 'findings ' + ssot.usability.length)
  check('every usability finding has a type',
    ssot.usability.every((finding) => Boolean(finding.type) && Boolean(finding.observation)))
  check('the timeline has a step for every stage',
    ssot.steps.length >= 8, 'steps ' + ssot.steps.length)
  check('every finished step has token usage',
    ssot.steps.filter((step) => step.status === 'done').every((step) => Number.isFinite(step.tokens)))
  check('the iteration records its tokens', Number(ssot.iterations[0] && ssot.iterations[0].tokens) > 0,
    'tokens ' + (ssot.iterations[0] && ssot.iterations[0].tokens))
  check('a completed task records a diff',
    ssot.tasks.some((task) => task.diff && task.diff.includes('@@')), 'diffs 0')
  check('the usability step is in the loop',
    ssot.steps.some((step) => step.stage === 'usability-review'))

  const toolDirectory = finished.toolDirectory || store.toolDirectory(run.id)
  const toolName = finished.toolName
  check('the run has a tool folder name', Boolean(toolName), String(toolName))
  check('the tool app page exists', fs.existsSync(path.join(toolDirectory, 'app', toolName + '.html')))
  check('the tool stylesheet exists', fs.existsSync(path.join(toolDirectory, 'app', toolName + '.css')))
  check('the tool script exists', fs.existsSync(path.join(toolDirectory, 'app', toolName + '.js')))
  check('the test harness exists', fs.existsSync(path.join(toolDirectory, 'app', 'test-harness.html')))
  const requiredDocs = ['index.html', 'ssot.html', 'webpage.html', 'help.html', 'presentation.html', 'updates.html', 'social.html']
  const missingDocs = requiredDocs.filter((docName) => !fs.existsSync(path.join(toolDirectory, 'docs', docName)))
  check('all seven docs exist', missingDocs.length === 0, missingDocs.join(', '))
  check('the event log exists', fs.existsSync(path.join(store.runDirectory(run.id), 'events.jsonl')))

  const workspace = new Workspace(toolDirectory)
  const validation = validateFiles(workspace, workspace.sourceFiles({ maxFiles: 40 }).map((file) => file.relativePath))
  check('every generated file validates', validation.ok, validation.errors.join(' | '))
  check('the tool script uses tool.onReady', workspace.readText('app/' + toolName + '.js').includes('tool.onReady'))
  check('no index.html was created', !fs.existsSync(path.join(toolDirectory, 'app', 'index.html')))
  check('no src folder or framework file was created',
    !fs.existsSync(path.join(toolDirectory, 'app', 'src')) &&
    workspace.sourceFiles({ maxFiles: 40 }).every((file) => !/\.(jsx|tsx|ts|vue|svelte)$/.test(file.relativePath)))
  const contractFilesOnDisk = ['html', 'css', 'js'].map((extension) => ({
    path: 'app/' + toolName + '.' + extension,
    text: workspace.readText('app/' + toolName + '.' + extension)
  }))
  const diskProblems = contractFilesOnDisk.flatMap((file) => validateContractFile(file.path, file.text).problems
    .filter((problem) => problem.level === 'error')
    .map((problem) => file.path + ': ' + problem.message))
  check('the generated files satisfy the html tool contract', diskProblems.length === 0, diskProblems.join(' | '))
  const ssotPage = fs.readFileSync(path.join(toolDirectory, 'docs', 'ssot.html'), 'utf8')
  check('the docs use the shared repository assets', ssotPage.includes('_docs/assets/ssot.css'))
  check('the standard SSOT holds the factory task list',
    ssotPage.includes('AF:TASKS:START') && ssotPage.includes('data-task-id='))
  check('the standard SSOT holds the build record', ssotPage.includes('AF:BUILD:START'))
  check('the standard SSOT holds the depth checklist',
    ssotPage.includes('AF:CHECK:START') && ssotPage.includes('Depth:'))
  check('the depth checklist was seeded', (ssot.checklist || []).length === 10,
    'checklist items ' + (ssot.checklist || []).length)
  check('the planner planned depth work',
    (ssot.tasks || []).some((task) => Boolean(task.checklistId)),
    'checklist tasks 0')
  check('a finished task closes its checklist item',
    (ssot.checklist || []).some((item) => item.status === 'done'),
    (ssot.checklist || []).map((item) => item.status).join(','))
  check('the run reports the remaining work honestly',
    Boolean(finished.stoppedReason) && (finished.status === 'done'
      ? /Finished:/.test(finished.stoppedReason)
      : /still open/.test(finished.stoppedReason)),
    finished.stoppedReason)
  check('planned file paths follow the html tool contract',
    (ssot.tasks || []).every((task) => (task.files || []).every((file) =>
      /^app\/(test-harness|[A-Za-z0-9]+)\.(html|css|js)$/.test(file) || /^docs\//.test(file))),
    (ssot.tasks || []).flatMap((task) => task.files || []).filter((file) =>
      !/^app\/(test-harness|[A-Za-z0-9]+)\.(html|css|js)$/.test(file) && !/^docs\//.test(file)).join(', '))
  check('every task carries its points',
    (ssot.tasks || []).every((task) => Number(task.points) >= 5 && Number(task.points) <= 100),
    (ssot.tasks || []).map((task) => task.points).join(','))
  const applyStep = (ssot.steps || []).find((step) => step.stage === 'apply-tasks')
  check('the apply step records which tasks it coded',
    Boolean(applyStep && Array.isArray(applyStep.tasks) && applyStep.tasks.length),
    applyStep ? JSON.stringify((applyStep.tasks || []).length) : 'no step')
  // T-06: the batches are known before the apply stage spends anything.
  check('the plan is written into the SSOT before the batches run',
    Boolean(ssot.plan) && Array.isArray(ssot.plan.batches) && ssot.plan.batches.length > 0,
    ssot.plan ? ssot.plan.batches.map((batch) => batch.id + ':' + batch.points).join(',') : 'no plan')
  check('the plan names the tasks of every batch',
    Boolean(ssot.plan) && ssot.plan.batches.every((batch) => (batch.tasks || []).length > 0),
    JSON.stringify(ssot.plan && ssot.plan.batches.map((batch) => batch.tasks.length)))
  check('the plan records the batching targets it used',
    Boolean(ssot.plan && ssot.plan.targets && ssot.plan.targets.pointsPerPrompt),
    JSON.stringify(ssot.plan && ssot.plan.targets))
  // T-05: the batch tokens say whether they are real or estimated.
  check('every batch token count states its provenance',
    (applyStep && applyStep.tasks || []).every((batch) =>
      !batch.tokens || typeof batch.tokensMeasured === 'boolean'),
    (applyStep && applyStep.tasks || []).map((batch) => String(batch.tokensMeasured)).join(','))
  check('the batches stay close to the 100 point target',
    (applyStep && applyStep.tasks || []).every((batch) => Number(batch.points) <= 130),
    (applyStep && applyStep.tasks || []).map((batch) => batch.points).join(','))
  check('each finished batch records its real tokens',
    (applyStep && applyStep.tasks || []).filter((batch) => batch.status === 'done')
      .every((batch) => Number(batch.tokens) > 0),
    (applyStep && applyStep.tasks || []).map((batch) => batch.tokens).join(','))
  check('each finished batch keeps a checkpoint',
    (applyStep && applyStep.tasks || []).filter((batch) => batch.status === 'done')
      .every((batch) => Boolean(batch.checkpoint)),
    (applyStep && applyStep.tasks || []).map((batch) => batch.checkpoint).join(','))
  check('the tool is executed as a recorded check',
    (ssot.tests || []).some((test) => test.name === 'harness: dom_smoke' && test.ok),
    (ssot.tests || []).map((test) => test.name).join(', '))
  check('the capability audit records what it checked',
    (ssot.audit || []).length > 0, (ssot.audit || []).length + ' entry(ies)')
  // The dashboard has to be able to say which task is in progress: the apply
  // stage broadcasts the batch and its task ids while it works.
  const loopEvents = readEvents(finished.directory)
  const nowEvents = loopEvents.filter((event) => event.type === 'now' && event.now && (event.now.taskIds || []).length)
  check('the run broadcasts which task is in progress',
    nowEvents.length > 0, loopEvents.filter((event) => event.type === 'now').length + ' now event(s)')
  check('the in progress event names the batch and its tasks',
    nowEvents.every((event) => Boolean(event.now.batchId) && event.now.taskIds.length > 0),
    JSON.stringify(nowEvents.slice(0, 1).map((event) => event.now)))
  check('the now marker is cleared when the stage ends', !finished.now, JSON.stringify(finished.now))
  check('a claimed capability that is missing in the files is reopened',
    (ssot.checklist || []).every((item) => item.status !== 'done' || !item.reopenReason),
    (ssot.checklist || []).filter((item) => item.reopenReason).map((item) => item.id).join(','))
  check('the SSOT document shows the task points', ssotPage.includes('Points:'))
  check('the definition is written before the plan',
    (ssot.definition.jobs || []).length >= 4 && Boolean(ssot.definition.summary),
    (ssot.definition.jobs || []).length + ' job(s)')
  check('the standard SSOT renders the definition', ssotPage.includes('Jobs the user hires it for'))
  check('out of scope is recorded', (ssot.definition.outOfScope || []).length >= 3,
    (ssot.definition.outOfScope || []).length + ' line(s)')

  // Resume behaviour: a finished run must not start again.
  const secondAdvance = await pipeline.advanceOnce(run.id)
  check('a finished run does not advance again', Boolean(secondAdvance.skipped))

  // Pressing Start twice, or on a finished run, must resolve and keep a valid
  // record instead of silently doing nothing or staying running forever.
  const restarted = await pipeline.startLoop(run.id)
  check('a second start resolves and keeps the terminal status',
    Boolean(restarted) && ['done', 'paused'].includes(restarted.status),
    restarted ? restarted.status + ' / ' + restarted.stage : 'no run')

  return { run: finished, ssot }
}

async function checkWorkspaceLayer() {
  process.stdout.write('\nWorkspace layer (Studio read side)\n')

  // Every path is resolved inside the repository, or refused before any IO.
  check('an absolute path is refused', workspace.normalizeRelative('D:/Windows/win.ini').ok === false)
  check('a parent traversal is refused', workspace.normalizeRelative('../../etc/passwd').ok === false)
  check('a nested traversal is refused', workspace.normalizeRelative('BUSINESS/../../secret.txt').ok === false)
  check('a normal path is accepted', workspace.normalizeRelative('BUSINESS/GENERAL').ok === true)
  check('the root is accepted', workspace.normalizeRelative('').ok === true)

  const top = workspace.listDirectory('')
  check('the repository root lists entries', top.ok && top.entries.length > 5, top.reason)
  const topNames = top.entries.map((entry) => entry.name)
  check('the root lists BUSINESS and PERSONAL', topNames.indexOf('BUSINESS') !== -1 && topNames.indexOf('PERSONAL') !== -1, topNames.slice(0, 8).join(','))
  check('the root hides the git folder', topNames.indexOf('.git') === -1)
  check('directories sort before files', top.entries[0].type === 'dir', top.entries[0] && top.entries[0].type)

  const business = workspace.listDirectory('BUSINESS')
  check('BUSINESS lists its taxonomy folders', business.ok && business.entries.some((entry) => entry.name === 'GENERAL'), business.reason)
  const missingFolder = workspace.listDirectory('DOES-NOT-EXIST')
  check('a missing folder is reported, not thrown', missingFolder.ok === false && /does not exist/.test(missingFolder.reason), missingFolder.reason)

  const pkg = workspace.readTextFile('package.json')
  check('a text file is read', pkg.ok && pkg.text.indexOf('"scripts"') !== -1, pkg.reason)
  check('the read reports bytes and lines', pkg.ok && pkg.bytes > 0 && pkg.lines > 1)
  check('a directory is refused as a file', workspace.readTextFile('BUSINESS').ok === false)
  check('a missing file is reported, not thrown', workspace.readTextFile('nope/nothing.js').ok === false)
  check('an absolute file path is refused', workspace.readTextFile('C:/Windows/win.ini').ok === false)
  check('the size cap is enforced', workspace.readTextFile('package.json', { maxBytes: 10 }).ok === false)

  const binaryPath = 'BUSINESS/GENERAL/ai-automation/ai-chat-assistants/MeetingNotes/docs/screenshots/01-dashboard-desktop.png'
  const binaryRead = workspace.readTextFile(binaryPath)
  check('a binary file is refused with a reason', binaryRead.ok === false && (binaryRead.binary === true || /binary/i.test(binaryRead.reason)), binaryRead.reason)

  const hits = workspace.searchText('toolRegistry', { path: 'DESKTOP-APPS' })
  check('search finds a known symbol', hits.ok && hits.hits.length > 0, hits.reason)
  check('search reports the file and line of a hit',
    hits.ok && hits.hits.every((hit) => typeof hit.path === 'string' && hit.line > 0))
  check('search refuses an empty query', workspace.searchText('').ok === false)
  check('search refuses an overlong query', workspace.searchText('x'.repeat(500)).ok === false)
  check('search stays inside the repository', workspace.searchText('x', { path: '../..' }).ok === false)

  const registry = workspace.toolRegistry({ config: loadConfig() })
  check('the registry lists tools', registry.ok && registry.total > 10, registry.total + ' tools')
  check('every tool has a known status',
    registry.tools.every((tool) => ['published', 'ready', 'documented', 'in-progress', 'draft'].indexOf(tool.status) !== -1))
  check('every tool has a group and a trail', registry.tools.every((tool) => tool.group && typeof tool.trail === 'string'))
  check('the registry groups include BUSINESS', registry.groups.some((group) => group.group === 'BUSINESS'),
    registry.groups.map((group) => group.group).join(','))
  check('the registry reads the publish ledger', registry.ledger.ok === true, registry.ledger.reason)
  check('published never exceeds the tool count',
    registry.tools.filter((tool) => tool.status === 'published').length <= registry.total)
  check('every tool reports its package subjects',
    registry.tools.every((tool) => Array.isArray(tool.package.present) && tool.package.total === 8))
  check('the registry is read only', fs.existsSync(path.join(APP_ROOT, 'src', 'workspace.js')) &&
    fs.readFileSync(path.join(APP_ROOT, 'src', 'workspace.js'), 'utf8').indexOf('writeFileSync') === -1)

  // --- preview: /repo serves files to the iframe, and never the token file ---
  const previewAsset = workspace.resolveRepoAsset('UNICON-TOOLS/ApplicationStoreItem/ApplicationStoreItem.html')
  check('the preview resolver serves an html file', previewAsset.ok && previewAsset.contentType === 'text/html', previewAsset.reason)
  check('the preview resolver refuses the token file',
    workspace.resolveRepoAsset('DESKTOP-APPS/Html-Tool-Factory/html-tool-factory/config.local.json').ok === false)
  check('the preview resolver refuses run folders',
    workspace.resolveRepoAsset('DESKTOP-APPS/Html-Tool-Factory/html-tool-factory/runs/anything.json').ok === false)
  check('the preview resolver refuses the git folder', workspace.resolveRepoAsset('.git/config').ok === false)
  check('the preview resolver refuses a traversal',
    workspace.resolveRepoAsset('../outside.html').ok === false)
  check('the preview resolver refuses unknown types',
    workspace.resolveRepoAsset('package-lock.yaml').ok === false || workspace.resolveRepoAsset('estate.exe').ok === false)
  check('the text reader refuses the token file too',
    workspace.readTextFile('DESKTOP-APPS/Html-Tool-Factory/html-tool-factory/config.local.json').ok === false)

  // --- the SSOT task list is the backlog Studio shows ---
  const sampleSsot = [
    '<div class="task-item" data-task-id="T-01" data-group="HTF-1" data-task-status="done">',
    '<summary><span class="task-id">T-01</span><span class="task-title">First thing</span>',
    '<span class="task-priority status-mandatory">Mandatory</span></summary>',
    '<div class="task-details"><p><strong>Points:</strong> 40 of 100.</p></div></div>',
    '<div class="task-item" data-task-id="T-02" data-group="HTF-2" data-task-status="not-started">',
    '<summary><span class="task-title">Second &amp; last</span></summary></div>'
  ].join('\n')
  const parsedTasks = workspace.parseSsotTasks(sampleSsot)
  check('the task parser finds every task', parsedTasks.length === 2, String(parsedTasks.length))
  check('the task parser reads the id, group and title',
    parsedTasks[0].id === 'T-01' && parsedTasks[0].group === 'HTF-1' && parsedTasks[0].title === 'First thing')
  check('the task parser reads points as number of target',
    parsedTasks[0].points === 40 && parsedTasks[0].pointsOf === 100, JSON.stringify(parsedTasks[0]))
  check('the task parser marks a done task', parsedTasks[0].done === true && parsedTasks[0].status === 'done')
  check('the task parser decodes entities in a title', parsedTasks[1].title === 'Second & last', parsedTasks[1].title)
  check('the task parser survives a file with no tasks', workspace.parseSsotTasks('<p>nothing</p>').length === 0)

  const realTasks = workspace.readToolTasks('DESKTOP-APPS/Html-Tool-Factory/html-tool-factory')
  check('the tool task reader parses a real SSOT', realTasks.ok && realTasks.tasks.length > 20, realTasks.reason || realTasks.tasks.length)
  check('the tool task reader counts done and open', realTasks.ok &&
    realTasks.counts.done > 0 && realTasks.counts.open > 0 &&
    realTasks.counts.done + realTasks.counts.open + realTasks.counts.ignored === realTasks.counts.total,
    JSON.stringify(realTasks.counts))
  check('the tool task reader refuses a folder with no SSOT', workspace.readToolTasks('UNICON-TOOLS/tools-catalog').ok === false)
  check('the tool task reader refuses the repository root', workspace.readToolTasks('').ok === false)

  // --- serial first: the worker setting (D-HTF-52) ---
  const serialConfig = loadConfig({ skipEnvironment: true })
  check('Studio starts with exactly one build worker', serialConfig.studio && serialConfig.studio.workers === 1,
    JSON.stringify(serialConfig.studio))
  check('the worker count can never be zero or negative',
    clampWorkers(0) === 1 && clampWorkers(-5) === 1 && clampWorkers('nonsense') === 1)
  check('the worker count is capped', clampWorkers(99) === 8 && clampWorkers(4) === 4)
  check('the studio setting is visible in the public config view',
    publicConfigView(serialConfig).studio && publicConfigView(serialConfig).studio.workers === 1)
  const previousWorkers = process.env.APP_FACTORY_STUDIO_WORKERS
  process.env.APP_FACTORY_STUDIO_WORKERS = '99'
  check('an environment override is clamped too', loadConfig().studio.workers === 8)
  if (previousWorkers === undefined) delete process.env.APP_FACTORY_STUDIO_WORKERS
  else process.env.APP_FACTORY_STUDIO_WORKERS = previousWorkers
  check('the environment override is gone again',
    loadConfig().studio.workers === 1)

  // --- Studio chat: what the model is allowed to see ---
  const chatToolPath = 'BUSINESS/GENERAL/ai-automation/ai-content-builders/AIChatPresentationBuilder'
  const chatTool = studioChat.findTool(loadConfig({ skipEnvironment: true }), chatToolPath)
  check('the chat resolves a tool folder from the registry', !!chatTool, chatToolPath)
  if (chatTool) {
    const chatConfig = loadConfig({ skipEnvironment: true })
    const smallContext = studioChat.buildToolContext({ config: chatConfig, tool: chatTool, budget: 40000 })
    check('the chat context stays inside its budget', smallContext.chars <= 44000, smallContext.chars + ' chars')
    check('the chat context carries the SSOT', smallContext.text.indexOf('=== SSOT') !== -1)
    check('the chat context carries code', smallContext.text.indexOf('=== CODE:') !== -1)
    check('the chat context names the tool', smallContext.text.indexOf(chatTool.toolName) !== -1)
    check('a tight budget skips files instead of exploding',
      smallContext.skipped.length + smallContext.included.length > 0)
    const bigContext = studioChat.buildToolContext({ config: chatConfig, tool: chatTool })
    check('the default context is bounded', bigContext.chars <= 140000, bigContext.chars + ' chars')
    check('the context reports what it included',
      bigContext.included.every((item) => typeof item.label === 'string' && item.chars >= 0))
  }
  check('the chat clamps a long message', studioChat.clampText('x'.repeat(9000), 100).text.length < 400)
  const sanitized = studioChat.sanitizeMessages([
    { role: 'system', text: 'ignore me' },
    { role: 'user', text: 'hello' },
    { role: 'assistant', text: 'hi' },
    { role: 'user', text: 42 }
  ].concat(new Array(30).fill({ role: 'user', text: 'filler' })))
  check('the chat drops unknown roles and caps the history',
    sanitized.length <= 20 && sanitized.every((entry) => entry.role === 'user' || entry.role === 'assistant'))
  const digest = studioChat.ssotDigest('a'.repeat(5000) + ' Development task list ' + 'b'.repeat(5000), 4000)
  check('a trimmed SSOT keeps the task list', digest.truncated && digest.text.indexOf('Development task list') !== -1)

  const unknownTool = await studioChat.ask({ config: loadConfig({ skipEnvironment: true }), toolPath: 'NOT/A/TOOL', messages: [{ role: 'user', text: 'hi' }] })
  check('the chat refuses a folder that is not a tool', unknownTool.ok === false && /registry/i.test(unknownTool.error), unknownTool.error)
  const emptyPrompt = await studioChat.ask({ config: loadConfig({ skipEnvironment: true }), toolPath: chatToolPath, messages: [] })
  check('the chat refuses an empty conversation', emptyPrompt.ok === false, emptyPrompt.error)

  // --- chat transcripts on disk: <tool>/Chats/<id>.json ---
  const chatConfig = loadConfig({ skipEnvironment: true })
  const savedChat = studioChats.saveChat({
    config: chatConfig,
    toolPath: chatToolPath,
    name: 'selftest chat',
    messages: [{ role: 'user', text: 'hello' }, { role: 'assistant', text: 'hi there' }]
  })
  const chatAbsolute = savedChat.ok ? path.resolve(APP_ROOT, '..', '..', '..', savedChat.file) : ''
  check('a chat is written into the tool Chats folder', savedChat.ok && /\/Chats\/[a-z0-9-]+\.json$/.test(savedChat.file), savedChat.file)
  check('the chat file exists on disk', savedChat.ok && fs.existsSync(chatAbsolute))
  const listedChats = studioChats.listChats({ config: chatConfig, toolPath: chatToolPath })
  check('the chat is listed for its project', listedChats.ok && listedChats.chats.some((entry) => entry.id === savedChat.id))
  const loadedChat = studioChats.loadChat({ config: chatConfig, toolPath: chatToolPath, id: savedChat.id })
  check('the chat loads back with its messages', loadedChat.ok && loadedChat.chat.messages.length === 2, loadedChat.reason)
  const savedAttachment = studioChats.saveAttachment({
    config: chatConfig,
    toolPath: chatToolPath,
    chatId: savedChat.id,
    name: 'probe.txt',
    dataBase64: Buffer.from('attachment body').toString('base64')
  })
  check('an attachment is stored next to its chat', savedAttachment.ok && /\/Chats\/attachments\//.test(savedAttachment.path), savedAttachment.path)
  check('a text attachment is classified as text', savedAttachment.ok && savedAttachment.kind === 'text')
  check('an image attachment is classified as an image',
    studioChats.saveAttachment({ config: chatConfig, toolPath: chatToolPath, chatId: savedChat.id, name: 'shot.png', dataBase64: Buffer.from('89504e47', 'hex').toString('base64') }).kind === 'image')
  check('a chat id cannot climb out of the folder',
    studioChats.loadChat({ config: chatConfig, toolPath: chatToolPath, id: '../secret' }).ok === false)
  check('a chat cannot be written into a folder that is not a tool',
    studioChats.saveChat({ config: chatConfig, toolPath: 'NOT/A/TOOL', name: 'x', messages: [] }).ok === false)
  const deletedChat = studioChats.deleteChat({ config: chatConfig, toolPath: chatToolPath, id: savedChat.id })
  check('deleting a chat removes its file', deletedChat.ok && !fs.existsSync(chatAbsolute))
  // Leave no empty Chats folder behind: the self test must not litter a tool.
  const chatsDirectory = path.join(path.dirname(chatAbsolute))
  try {
    if (fs.existsSync(chatsDirectory) && fs.readdirSync(chatsDirectory).length === 0) fs.rmdirSync(chatsDirectory)
  } catch (error) { /* nothing to clean */ }
}

async function main() {
  process.stdout.write('HTML Tool Factory self test\n')
  checkUnitBehaviour()
  await checkContract()
  await checkChatAndProbes()
  await checkLiveView()
  await checkEditGates()
  await checkCostReporting()
  await checkModelResolution()
  await checkReleaseReadLayer()
  await checkWorkspaceLayer()
  const loopResult = await checkFullLoop()

  process.stdout.write('\n' + passed + ' checks passed, ' + failures.length + ' failed.\n')
  if (loopResult && loopResult.run) {
    process.stdout.write('Sample run: ' + loopResult.run.id + '\n')
    process.stdout.write('Sample tool: ' + (loopResult.run.toolDirectory || path.join(loopResult.run.directory, 'tool')) + '\n')
  }
  if (failures.length) {
    failures.forEach((failure) => {
      process.stdout.write(' - ' + failure.name + (failure.detail ? ': ' + failure.detail : '') + '\n')
    })
    process.exitCode = 1
    return
  }
  process.exitCode = 0
}

main().catch((error) => {
  process.stdout.write('Self test crashed: ' + (error && error.stack || error) + '\n')
  process.exitCode = 1
})
