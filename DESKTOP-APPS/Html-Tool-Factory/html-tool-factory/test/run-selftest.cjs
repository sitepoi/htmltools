'use strict'

// Offline self test. Uses the mock provider, so it proves the whole loop
// (specification, planning, risk review, resolution, patching, validation,
// checks, iteration close) without a single network call or token.

const fs = require('fs')
const path = require('path')

const { APP_ROOT, loadConfig } = require('../src/config')
const { RunStore, isValidRunId } = require('../src/state')
const { unifiedDiff } = require('../src/code/diff')
const { createPipeline } = require('../src/pipeline')
const { hub } = require('../src/log')
const { Workspace } = require('../src/code/workspace')
const { applyOps } = require('../src/code/patch')
const { validateText, validateFiles } = require('../src/code/validate')
const { parseJsonLoose } = require('../src/ai/parse')
const { computeTimeout } = require('../src/ai/client')
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

async function main() {
  process.stdout.write('HTML Tool Factory self test\n')
  checkUnitBehaviour()
  await checkContract()
  await checkChatAndProbes()
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
