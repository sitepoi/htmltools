'use strict'

// Local control panel and API. Deliberately dependency free: one http server,
// one static folder, one event stream.

const http = require('http')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const { APP_ROOT, loadConfig, publicConfigView, saveLocalConfig, describeProvider } = require('./config')
const { hub, readEvents } = require('./log')
const { RunStore, isValidRunId } = require('./state')
const { createPipeline, STAGE_SEQUENCE } = require('./pipeline')
const { loadIdeaCatalog, searchIdeas } = require('./idea/catalog')
const { Workspace } = require('./code/workspace')
const { validateFiles } = require('./code/validate')
const ssotModel = require('./ssot/model')
const { renderSsotHtml } = require('./ssot/render')
const { renderAndSave } = require('./stages/shared')
const { createAiClient } = require('./ai/client')
const chatService = require('./chat/service')
const { nowIso } = require('./util')

const UI_DIRECTORY = path.join(APP_ROOT, 'ui')
const MAX_BODY_BYTES = 1024 * 1024

const config = loadConfig()
const store = new RunStore(path.join(APP_ROOT, 'runs'))
const pipeline = createPipeline({ store, config, hub })

const STAGE_TITLES = pipeline.STAGES.reduce((accumulator, stage) => {
  accumulator[stage.id] = stage.title
  return accumulator
}, {})

function sendJson(response, statusCode, value) {
  const body = JSON.stringify(value)
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  })
  response.end(body)
}

function sendText(response, statusCode, textValue, contentType) {
  response.writeHead(statusCode, {
    'Content-Type': (contentType || 'text/plain') + '; charset=utf-8',
    'Cache-Control': 'no-store'
  })
  response.end(textValue)
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let received = 0
    const chunks = []
    request.on('data', (chunk) => {
      received += chunk.length
      if (received > MAX_BODY_BYTES) {
        reject(new Error('The request body is too large.'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      const rawText = Buffer.concat(chunks).toString('utf8')
      if (!rawText.trim()) return resolve({})
      try {
        resolve(JSON.parse(rawText))
      } catch (error) {
        reject(new Error('Invalid JSON body: ' + error.message))
      }
    })
    request.on('error', reject)
  })
}

function serveStatic(requestPath, response) {
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '')
  const absolutePath = path.resolve(UI_DIRECTORY, relativePath)
  const uiPrefix = UI_DIRECTORY.endsWith(path.sep) ? UI_DIRECTORY : UI_DIRECTORY + path.sep
  if (!absolutePath.startsWith(uiPrefix)) {
    sendText(response, 403, 'Forbidden')
    return
  }
  fs.readFile(absolutePath, (error, fileBuffer) => {
    if (error) {
      sendText(response, 404, 'Not found')
      return
    }
    const extension = path.extname(absolutePath).toLowerCase()
    const contentTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png'
    }
    response.writeHead(200, {
      'Content-Type': (contentTypes[extension] || 'application/octet-stream') + '; charset=utf-8',
      'Cache-Control': 'no-store'
    })
    response.end(fileBuffer)
  })
}

function streamEvents(request, response, runId) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })
  response.write('retry: 2000\n\n')

  const sendEvent = (event) => {
    if (runId && event.runId !== runId) return
    response.write('data: ' + JSON.stringify(event) + '\n\n')
  }
  hub.on('event', sendEvent)

  const keepAlive = setInterval(() => {
    response.write(': keep-alive\n\n')
  }, 20000)
  if (keepAlive.unref) keepAlive.unref()

  request.on('close', () => {
    clearInterval(keepAlive)
    hub.removeListener('event', sendEvent)
  })
}

function buildRunPayload(run) {
  const ssot = store.readSsot(run.id)
  const workspace = new Workspace(run.toolDirectory)
  const files = workspace.listFiles({ maxFiles: 200, maxDepth: 5 }).map((file) => Object.assign({}, file, {
    absolutePath: path.join(run.toolDirectory, file.relativePath)
  }))
  const harnessPath = 'app/test-harness.html'
  return {
    run,
    ssot,
    toolName: run.toolName || '',
    toolFolder: run.toolDirectory || '',
    toolFolderUri: run.toolDirectory ? 'vscode://file/' + run.toolDirectory.replace(/\\/g, '/') : '',
    previewPath: files.some((file) => file.relativePath === harnessPath) ? harnessPath : '',
    stageSequence: STAGE_SEQUENCE,
    stageTitles: STAGE_TITLES,
    files,
    chat: chatService.readChat(run.directory, 40),
    events: readEvents(run.directory, 300),
    isRunning: pipeline.isRunning(run.id)
  }
}

async function handleApi(request, response, urlObject) {
  const method = request.method
  const pathName = urlObject.pathname
  const searchParams = urlObject.searchParams

  if (pathName === '/api/state' && method === 'GET') {
    let catalogInfo = { ok: false }
    try {
      const catalog = loadIdeaCatalog(config.ideasCatalogPath)
      catalogInfo = {
        ok: true,
        path: catalog.catalogPath,
        total: catalog.ideas.length,
        version: catalog.version,
        generatedAt: catalog.generatedAt
      }
    } catch (error) {
      catalogInfo = { ok: false, error: error.message, path: config.ideasCatalogPath }
    }
    sendJson(response, 200, {
      config: publicConfigView(config),
      provider: describeProvider(config),
      stageSequence: STAGE_SEQUENCE,
      stageTitles: STAGE_TITLES,
      catalog: catalogInfo,
      runsDirectory: store.runsDirectory,
      now: nowIso()
    })
    return
  }

  if (pathName === '/api/config' && method === 'POST') {
    const body = await readBody(request)
    const patch = {}
    if (body.provider) patch.provider = String(body.provider)
    if (body.uniconGateway) patch.uniconGateway = body.uniconGateway
    if (body.openaiCompatible) patch.openaiCompatible = body.openaiCompatible
    if (body.ollama) patch.ollama = body.ollama
    if (body.models) patch.models = body.models
    if (body.limits) patch.limits = body.limits
    // `checks` is deliberately NOT writable over HTTP: those are shell commands
    // and must be set by the operator in config.local.json.
    saveLocalConfig(patch)
    const reloaded = loadConfig()
    Object.keys(reloaded).forEach((key) => { config[key] = reloaded[key] })
    sendJson(response, 200, { ok: true, config: publicConfigView(config), provider: describeProvider(config) })
    return
  }

  if (pathName === '/api/ideas' && method === 'GET') {
    try {
      const catalog = loadIdeaCatalog(config.ideasCatalogPath)
      const ideas = searchIdeas(catalog, {
        search: searchParams.get('search') || '',
        includeBuilt: searchParams.get('built') !== '0',
        limit: Number(searchParams.get('limit')) || 60
      })
      sendJson(response, 200, { ok: true, catalogPath: catalog.catalogPath, total: catalog.ideas.length, ideas })
    } catch (error) {
      sendJson(response, 400, { ok: false, error: error.message })
    }
    return
  }

  if (pathName === '/api/runs' && method === 'GET') {
    sendJson(response, 200, { ok: true, runs: store.listRuns() })
    return
  }

  if (pathName === '/api/runs' && method === 'POST') {
    const body = await readBody(request)
    const idea = {
      id: body.ideaId || '',
      name: body.ideaName || '',
      purpose: body.ideaPurpose || '',
      category: body.ideaCategory || '',
      folder: body.ideaFolder || '',
      source: 'tool-ideas-catalog.json'
    }
    if (!idea.name && !idea.id) {
      sendJson(response, 400, { ok: false, error: 'Choose an idea from the catalog or type an idea name.' })
      return
    }
    const run = store.createRun({
      idea,
      maxIterations: Number(body.maxIterations) || config.limits.maxIterations,
      maxTasksPerIteration: Number(body.maxTasksPerIteration) || config.limits.maxTasksPerIteration,
      provider: body.provider || config.provider,
      dryRun: Boolean(body.dryRun),
      industryFocus: body.industryFocus || ''
    })
    const ssot = ssotModel.createSsot(run.idea)
    ssotModel.appendLog(ssot, 'system', 'Run created. Provider: ' + describeProvider(config).label)
    store.writeSsot(run.id, ssot)
    renderAndSave(store, run, ssot)
    hub.publish(run.directory, { runId: run.id, stage: 'system', type: 'log', message: 'Run created' })
    sendJson(response, 201, { ok: true, run })
    return
  }

  const runMatch = pathName.match(/^\/api\/runs\/([^/]+)(?:\/(.*))?$/)
  if (runMatch) {
    const runId = decodeURIComponent(runMatch[1])
    const action = runMatch[2] || ''
    if (!isValidRunId(runId)) {
      sendJson(response, 400, { ok: false, error: 'Invalid run id.' })
      return
    }
    const run = store.loadRun(runId)
    if (!run) {
      sendJson(response, 404, { ok: false, error: 'Run not found: ' + runId })
      return
    }

    if (!action && method === 'GET') {
      sendJson(response, 200, Object.assign({ ok: true }, buildRunPayload(run)))
      return
    }
    if (!action && method === 'DELETE') {
      pipeline.stopRun(runId)
      store.deleteRun(runId)
      sendJson(response, 200, { ok: true })
      return
    }
    if (action === 'start' && method === 'POST') {
      pipeline.startLoop(runId).catch(() => { /* errors are stored on the run */ })
      sendJson(response, 202, { ok: true, run: store.loadRun(runId) })
      return
    }
    if (action === 'step' && method === 'POST') {
      const result = await pipeline.advanceOnce(runId, { singleStep: true })
      sendJson(response, 200, {
        ok: !result.error,
        error: result.error ? String(result.error.message) : null,
        run: store.loadRun(runId)
      })
      return
    }
    if (action === 'pause' && method === 'POST') {
      sendJson(response, 200, { ok: true, run: pipeline.pauseRun(runId) })
      return
    }
    if (action === 'resume' && method === 'POST') {
      const current = store.loadRun(runId)
      if (current.status === 'error') {
        current.status = 'running'
        current.lastError = null
        store.saveRun(current)
      }
      pipeline.startLoop(runId).catch(() => { /* errors are stored on the run */ })
      sendJson(response, 202, { ok: true })
      return
    }
    if (action === 'stop' && method === 'POST') {
      sendJson(response, 200, { ok: true, run: pipeline.stopRun(runId) })
      return
    }
    if (action === 'continue' && method === 'POST') {
      const body = await readBody(request)
      pipeline.stopRun(runId)
      await pipeline.waitForIdle(runId)
      const result = store.reopenWork(runId, body.iterations)
      if (!result.ok) {
        sendJson(response, 404, { ok: false, error: result.reason })
        return
      }
      const current = store.loadRun(runId)
      const ssot = ssotModel.normalizeSsot(store.readSsot(runId), current.idea)
      ssotModel.appendLog(ssot, 'operator', 'Continue: ' + result.reopened +
        ' task(s) reopened, iteration budget raised to ' + result.maxIterations +
        (result.budgetReset ? ', cost counters reset after a budget stop' : '') + '.')
      store.writeSsot(runId, ssot)
      renderAndSave(store, current, ssot)
      hub.publish(current.directory, {
        runId,
        stage: 'operator',
        type: 'log',
        message: 'Continue: reopened ' + result.reopened + ' task(s), budget ' + result.maxIterations
      })
      sendJson(response, 200, { ok: true, run: current, reopened: result.reopened, maxIterations: result.maxIterations })
      return
    }
    if (action === 'restart' && method === 'POST') {
      const body = await readBody(request)
      if (String(body.confirm || '') !== runId) {
        sendJson(response, 400, { ok: false, error: 'Type the run id to confirm the restart.' })
        return
      }
      pipeline.stopRun(runId)
      // A stage in flight would keep writing into the folder we are about to
      // delete, so wait until the loop is truly idle first.
      await pipeline.waitForIdle(runId)
      const result = store.resetRun(runId)
      if (!result.ok) {
        sendJson(response, 500, { ok: false, error: result.reason })
        return
      }
      const current = store.loadRun(runId)
      const ssot = ssotModel.normalizeSsot(store.readSsot(runId), current.idea)
      ssotModel.appendLog(ssot, 'operator', 'Restart: deleted ' + result.removed.length +
        ' folder(s) and reset the run to the first stage.')
      store.writeSsot(runId, ssot)
      renderAndSave(store, current, ssot)
      hub.publish(current.directory, {
        runId,
        stage: 'operator',
        type: 'log',
        message: 'Restart: tool folder deleted, run reset'
      })
      sendJson(response, 200, { ok: true, run: current, removed: result.removed })
      return
    }
    if (action === 'events' && method === 'GET') {
      streamEvents(request, response, runId)
      return
    }
    if (action === 'answer' && method === 'POST') {
      const body = await readBody(request)
      const ssot = ssotModel.normalizeSsot(store.readSsot(runId), run.idea)
      const question = ssotModel.findById(ssot.questions, String(body.questionId || ''))
      if (!question) {
        sendJson(response, 404, { ok: false, error: 'Question not found' })
        return
      }
      question.answer = String(body.answer || '').slice(0, 800)
      question.status = 'answered'
      question.answeredBy = 'operator'
      question.answeredAt = nowIso()
      ssotModel.appendLog(ssot, 'operator', 'Answered ' + question.id + ' manually.')
      store.writeSsot(runId, ssot)
      renderAndSave(store, run, ssot)
      sendJson(response, 200, { ok: true, ssot })
      return
    }
    if (action === 'checkpoints' && method === 'GET') {
      sendJson(response, 200, { ok: true, checkpoints: store.listCheckpoints(run) })
      return
    }
    const checkpointMatch = action.match(/^checkpoints\/([A-Za-z0-9_-]+)\/restore$/)
    if (checkpointMatch && method === 'POST') {
      const body = await readBody(request)
      const restored = store.restoreCheckpoint(run, checkpointMatch[1], { force: Boolean(body.force) })
      if (!restored.ok) {
        sendJson(response, restored.needsForce ? 409 : 404, {
          ok: false,
          error: restored.reason,
          conflicts: restored.conflicts || []
        })
        return
      }
      const ssot = ssotModel.normalizeSsot(store.readSsot(runId), run.idea)
      ssotModel.appendLog(ssot, 'operator', 'Checkpoint ' + checkpointMatch[1] + ' restored: ' +
        restored.restored.length + ' file(s).')
      store.writeSsot(runId, ssot)
      renderAndSave(store, run, ssot)
      sendJson(response, 200, { ok: true, restored: restored.restored, conflicts: restored.conflicts })
      return
    }
    if (action === 'chat' && method === 'GET') {      sendJson(response, 200, { ok: true, chat: chatService.readChat(run.directory, 80) })
      return
    }
    if (action === 'chat' && method === 'POST') {
      const body = await readBody(request)
      const message = String(body.message || '').trim()
      if (!message) {
        sendJson(response, 400, { ok: false, error: 'Write a message first.' })
        return
      }
      const ssot = ssotModel.normalizeSsot(store.readSsot(runId), run.idea)
      const ai = createAiClient({
        config,
        run,
        logEvent: function logChat(type, textValue) {
          hub.publish(run.directory, { runId, stage: 'chat', type, message: textValue })
        }
      })
      try {
        // SSOT only: the chat never touches files and never advances the loop.
        const result = await chatService.sendMessage({ config, ai, run, ssot, message })
        store.writeSsot(runId, ssot)
        store.saveRun(run)
        renderAndSave(store, run, ssot)
        sendJson(response, 200, {
          ok: true,
          reply: result.reply,
          changes: result.changes,
          chat: chatService.readChat(run.directory, 80)
        })
      } catch (error) {
        sendJson(response, 502, { ok: false, error: 'The chat could not answer: ' + error.message })
      }
      return
    }
    if (action === 'validate' && method === 'POST') {      const workspace = new Workspace(run.toolDirectory)
      const files = workspace.sourceFiles({ maxFiles: 120 }).map((file) => file.relativePath)
      const outcome = validateFiles(workspace, files)
      sendJson(response, 200, { ok: true, validation: outcome })
      return
    }
    if (action === 'preview' && method === 'GET') {
      const requestedPath = searchParams.get('path') || 'app/test-harness.html'
      const workspace = new Workspace(run.toolDirectory)
      try {
        const absolutePath = workspace.resolveInside(requestedPath)
        if (!fs.existsSync(absolutePath)) {
          sendText(response, 404, 'Not found: ' + requestedPath)
          return
        }
        const extension = path.extname(absolutePath).toLowerCase()
        const contentTypes = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'text/javascript',
          '.json': 'application/json',
          '.svg': 'image/svg+xml',
          '.md': 'text/plain'
        }
        response.writeHead(200, {
          'Content-Type': (contentTypes[extension] || 'text/plain') + '; charset=utf-8',
          'Cache-Control': 'no-store'
        })
        response.end(fs.readFileSync(absolutePath))
      } catch (error) {
        sendText(response, 400, error.message)
      }
      return
    }
    if (action === 'ssot-html' && method === 'GET') {
      const ssot = ssotModel.normalizeSsot(store.readSsot(runId), run.idea)
      const html = renderSsotHtml(ssot, { generatedAt: nowIso(), runStatus: run.status })
      sendText(response, 200, html, 'text/html')
      return
    }
    if (action === 'file' && method === 'GET') {
      const requestedPath = searchParams.get('path') || ''
      const workspace = new Workspace(run.toolDirectory)
      try {
        const absolutePath = workspace.resolveInside(requestedPath)
        const content = fs.readFileSync(absolutePath, 'utf8')
        sendJson(response, 200, { ok: true, path: requestedPath, content })
      } catch (error) {
        sendJson(response, 400, { ok: false, error: error.message })
      }
      return
    }
    sendJson(response, 404, { ok: false, error: 'Unknown action: ' + action })
    return
  }

  sendJson(response, 404, { ok: false, error: 'Unknown endpoint: ' + pathName })
}

const server = http.createServer((request, response) => {
  const urlObject = new URL(request.url, 'http://' + (request.headers.host || '127.0.0.1'))
  if (urlObject.pathname.startsWith('/api/')) {
    handleApi(request, response, urlObject).catch((error) => {
      if (!response.headersSent) {
        sendJson(response, 500, { ok: false, error: String(error && error.message || error) })
      } else {
        try { response.end() } catch (_endError) { /* ignore */ }
      }
    })
    return
  }
  serveStatic(urlObject.pathname, response)
})

function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref()
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref()
    }
  } catch (_error) {
    // Opening the browser is a convenience only.
  }
}

const listenPort = Number(process.env.APP_FACTORY_PORT) || config.port || 4173
const listenHost = config.host || '127.0.0.1'

server.listen(listenPort, listenHost, () => {
  const address = 'http://' + listenHost + ':' + listenPort
  hub.setQuiet(false)
  process.stdout.write('HTML Tool Factory running at ' + address + '\n')
  process.stdout.write('Provider: ' + describeProvider(config).label + ' (' + describeProvider(config).detail + ')\n')
  process.stdout.write('Runs folder: ' + store.runsDirectory + '\n')
  if (config.openBrowser && process.env.APP_FACTORY_NO_BROWSER !== 'yes') openBrowser(address)
})

process.on('SIGINT', () => {
  process.stdout.write('\nShutting down.\n')
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 1500).unref()
})

module.exports = { server, config, store, pipeline }
