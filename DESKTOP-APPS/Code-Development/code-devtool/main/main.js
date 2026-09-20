// Unicon Studio - Electron main process
// Owns: window creation, security settings, the IPC hub, project state,
// the file watcher, and the static preview server.
// Future services (project file service, Next.js runner, terminal service,
// agent runtime) are wired in here too.
// See code-devtool-ssot.html sections 7.2 and 7.4.

const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const fs = require('fs')
const path = require('path')
const appState = require('./app-state')
const appServer = require('./app-server')
const previewServer = require('./preview-server')
const nextjsRunner = require('./nextjs-runner')
const projectFileService = require('./project-file-service')
const aiSettings = require('./ai/ai-settings')
const chatService = require('./ai/chat-service')
const chatStore = require('./ai/chat-store')
const agentRuntime = require('./ai/agent-runtime')
const terminalService = require('./terminal-service')
const workspaceContext = require('./workspace-context')

let mainWindow = null
let projectWatcher = null
let watcherDebounceTimer = null
let uiUrl = ''
const activeChatStreams = new Map()
const activeAgentRuns = new Map()
const agentChangeHistory = new Map()
let chatRequestCounter = 0

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Unicon Studio',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // No default Electron menu - the header carries every action.
  mainWindow.setMenuBarVisibility(false)

  // Show only when the first paint is ready - no white flash.
  mainWindow.once('ready-to-show', () => mainWindow.show())
  // The renderer never opens child windows; previews are iframes.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.loadURL(uiUrl)
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function broadcastProjectRoot(projectRoot) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:project-changed', projectRoot)
    mainWindow.setTitle(projectRoot ? 'Unicon Studio - ' + projectRoot : 'Unicon Studio')
  }
}

function broadcastFolderTabs() {
  const currentState = appState.loadState()
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:folders-changed', {
      projectRoots: currentState.projectRoots,
      activeProjectRoot: currentState.activeProjectRoot
    })
  }
}

function broadcastPreviewStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('preview:status', status)
  }
}

function broadcastFileChanged(fileName) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('fs:changed', fileName)
  }
}

function broadcastNextjsEvent(projectRoot, event) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('preview:nextjs-event', Object.assign({ root: projectRoot }, event))
  }
  if (event.type === 'ready') {
    broadcastPreviewStatus({ state: 'nextjs-running', root: projectRoot, port: event.port, url: 'http://127.0.0.1:' + event.port + '/' })
  } else if (event.type === 'exited') {
    broadcastPreviewStatus({ state: 'stopped', root: projectRoot })
  }
}

function broadcastTerminalOutput(projectRoot, text) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('term:output', { root: projectRoot, text: text })
  }
}

function broadcastTerminalExited(projectRoot, exitCode) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('term:exited', { root: projectRoot, exitCode: exitCode })
  }
}

function sendChatEvent(requestId, type, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ai:chat-event', Object.assign({ requestId, type }, payload))
  }
}

function sendAgentEvent(requestId, type, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ai:agent-event', Object.assign({ requestId, type }, payload))
  }
}

function pruneAgentChangeHistory() {
  while (agentChangeHistory.size > 10) {
    const oldestKey = agentChangeHistory.keys().next().value
    agentChangeHistory.delete(oldestKey)
  }
}

function readProjectFile(relativePath) {
  const projectRoot = appState.getActiveProjectRoot()
  if (!projectRoot) return { content: '', error: 'No folder open' }
  return projectFileService.readFile(projectRoot, relativePath)
}

function isIgnoredWatchPath(fileName) {
  const normalizedPath = fileName.replace(/\\/g, '/')
  return normalizedPath.startsWith('node_modules/') ||
    normalizedPath.startsWith('.git/') ||
    normalizedPath.startsWith('.next/')
}

function startProjectWatcher(projectRoot) {
  stopProjectWatcher()
  try {
    projectWatcher = fs.watch(projectRoot, { recursive: true }, (_eventType, fileName) => {
      if (!fileName || isIgnoredWatchPath(fileName)) return
      clearTimeout(watcherDebounceTimer)
      watcherDebounceTimer = setTimeout(() => broadcastFileChanged(fileName), 300)
    })
  } catch (_watchError) {
    // The watcher is best-effort; the preview Reload button still works.
  }
}

function stopProjectWatcher() {
  if (projectWatcher) {
    projectWatcher.close()
    projectWatcher = null
  }
}

function stopPreview(projectRoot) {
  // One preview per folder tab (CODE-26): stopping touches ONLY this folder.
  previewServer.stop(projectRoot)
  nextjsRunner.stop(projectRoot)
  broadcastPreviewStatus({ state: 'stopped', root: projectRoot })
}

function registerIpcHandlers() {
  ipcMain.handle('app:get-state', () => appState.loadState())

  ipcMain.handle('fs:list-dir', (_event, relativePath) => {
    const projectRoot = appState.getActiveProjectRoot()
    if (!projectRoot) return { entries: [] }
    const requestedPath = typeof relativePath === 'string' ? relativePath : ''
    try {
      return { entries: projectFileService.listDirectory(projectRoot, requestedPath) }
    } catch (listError) {
      return { entries: [], error: listError.message }
    }
  })

  ipcMain.handle('fs:read-file', (_event, relativePath) => {
    return readProjectFile(typeof relativePath === 'string' ? relativePath : '')
  })

  ipcMain.handle('fs:write-file', (_event, payload) => {
    const projectRoot = appState.getActiveProjectRoot()
    if (!projectRoot) return { ok: false, error: 'No folder open' }
    const relativePath = payload && typeof payload.path === 'string' ? payload.path : ''
    const content = payload && typeof payload.content === 'string' ? payload.content : ''
    try {
      projectFileService.writeFile(projectRoot, relativePath, content)
      return { ok: true }
    } catch (writeError) {
      return { ok: false, error: writeError.message }
    }
  })

  ipcMain.handle('fs:search', (_event, payload) => {
    const projectRoot = appState.getActiveProjectRoot()
    const query = payload && typeof payload.query === 'string' ? payload.query.trim() : ''
    if (!projectRoot || query.length < 2) return { results: [] }
    try {
      return { results: projectFileService.searchText(projectRoot, query) }
    } catch (searchError) {
      return { results: [], error: searchError.message }
    }
  })

  ipcMain.handle('fs:get-shared-context', () => {
    const projectRoot = appState.getActiveProjectRoot()
    if (!projectRoot) return { workspaceRoot: null, fileNames: [] }
    const sharedContext = workspaceContext.getSharedContext(projectRoot)
    return {
      workspaceRoot: sharedContext.workspaceRoot,
      fileNames: sharedContext.files.map((file) => file.name)
    }
  })

  ipcMain.handle('ai:get-config', () => aiSettings.getPublicConfig())

  ipcMain.handle('ai:save-config', (_event, patch) => {
    const configPatch = {}
    if (typeof patch.provider === 'string' && (patch.provider === 'copilot' || patch.provider === 'openai')) configPatch.provider = patch.provider
    if (typeof patch.copilotBaseUrl === 'string' && patch.copilotBaseUrl.trim().startsWith('https://')) configPatch.copilotBaseUrl = patch.copilotBaseUrl.trim()
    if (typeof patch.openAiBaseUrl === 'string' && patch.openAiBaseUrl.trim().startsWith('https://')) configPatch.openAiBaseUrl = patch.openAiBaseUrl.trim()
    if (typeof patch.model === 'string') configPatch.model = patch.model.trim().slice(0, 100)
    if (patch.mcp) {
      const sanitizedMcp = aiSettings.sanitizeMcpPatch(patch.mcp)
      if (sanitizedMcp) configPatch.mcp = sanitizedMcp
    }
    aiSettings.updateConfig(configPatch)
    return aiSettings.getPublicConfig()
  })

  ipcMain.handle('ai:set-token', (_event, payload) => {
    const providerName = payload && payload.provider === 'openai' ? 'openai' : 'copilot'
    const token = payload && typeof payload.token === 'string' ? payload.token.trim() : ''
    if (!token) return aiSettings.getPublicConfig()
    aiSettings.setToken(providerName, token)
    return aiSettings.getPublicConfig()
  })

  ipcMain.handle('ai:clear-token', (_event, payload) => {
    const providerName = payload && payload.provider === 'openai' ? 'openai' : 'copilot'
    aiSettings.clearToken(providerName)
    return aiSettings.getPublicConfig()
  })

  ipcMain.handle('ai:list-models', async () => {
    const config = aiSettings.getPublicConfig()
    const token = aiSettings.getToken(config.provider)
    if (!token) return { error: 'No token saved - save your token in Settings first.' }
    try {
      const models = await chatService.providerFor(config.provider).listModels(token)
      return { models: models }
    } catch (listError) {
      return { error: listError.message }
    }
  })

  ipcMain.handle('ai:list-sessions', () => {
    const projectRoot = appState.getActiveProjectRoot()
    if (!projectRoot) return { sessions: [], activeSessionId: '' }
    return { sessions: chatStore.listSessions(projectRoot), activeSessionId: chatStore.getActiveSessionId(projectRoot) }
  })

  ipcMain.handle('ai:create-session', () => {
    const projectRoot = appState.getActiveProjectRoot()
    if (!projectRoot) return { error: 'No folder open' }
    return { sessionId: chatStore.createSession(projectRoot) }
  })

  ipcMain.handle('ai:switch-session', (_event, payload) => {
    const projectRoot = appState.getActiveProjectRoot()
    const sessionId = payload && typeof payload.sessionId === 'string' ? payload.sessionId : ''
    if (!projectRoot || !sessionId) return { ok: false }
    return { ok: chatStore.switchSession(projectRoot, sessionId) }
  })

  ipcMain.handle('ai:delete-session', (_event, payload) => {
    const projectRoot = appState.getActiveProjectRoot()
    const sessionId = payload && typeof payload.sessionId === 'string' ? payload.sessionId : ''
    if (!projectRoot || !sessionId) return { ok: false }
    return { ok: chatStore.deleteSession(projectRoot, sessionId) }
  })

  ipcMain.handle('ai:get-session-messages', (_event, payload) => {
    const projectRoot = appState.getActiveProjectRoot()
    const sessionId = payload && typeof payload.sessionId === 'string' ? payload.sessionId : ''
    if (!projectRoot || !sessionId) return { messages: [] }
    return { messages: chatStore.getMessages(projectRoot, sessionId) }
  })

  ipcMain.handle('ai:chat-start', async (_event, request) => {
    const projectRoot = appState.getActiveProjectRoot()
    if (!projectRoot) return { error: 'No folder open - open a project folder first.' }
    const config = aiSettings.getPublicConfig()
    const token = aiSettings.getToken(config.provider)
    if (!token) return { error: 'No token saved for ' + config.provider + ' - open Settings and save your token.' }
    const text = request && typeof request.text === 'string' ? request.text.trim() : ''
    if (!text) return { error: 'Empty message' }
    const model = (config.model || chatService.defaultModelFor(config.provider)).trim()
    const sessionId = chatStore.ensureActiveSession(projectRoot)
    chatStore.addMessage(projectRoot, sessionId, 'user', text)

    const attachments = []
    const attachmentPaths = request && Array.isArray(request.attachmentPaths) ? request.attachmentPaths : []
    for (const relativePath of attachmentPaths) {
      if (typeof relativePath !== 'string') continue
      const readResult = readProjectFile(relativePath)
      if (readResult.content && !readResult.error) {
        attachments.push({ path: relativePath, content: readResult.content.slice(0, 20000) })
      }
    }

    const historyMessages = chatStore.getMessages(projectRoot, sessionId).slice(-30)
    const sharedContextFiles = workspaceContext.getSharedContext(projectRoot).files
    const messages = chatService.buildRequestMessages(attachments, historyMessages, text, sharedContextFiles)
    const requestId = String(++chatRequestCounter)
    const abortController = new AbortController()
    activeChatStreams.set(requestId, abortController)
    sendChatEvent(requestId, 'started', { sessionId })

    chatService.providerFor(config.provider).streamChat({
      apiKey: token,
      model: model,
      messages: messages,
      signal: abortController.signal,
      onToken: (tokenText) => sendChatEvent(requestId, 'token', { text: tokenText })
    }).then((fullText) => {
      chatStore.addMessage(projectRoot, sessionId, 'assistant', fullText)
      activeChatStreams.delete(requestId)
      sendChatEvent(requestId, 'done', { text: fullText, sessionId })
    }).catch((streamError) => {
      activeChatStreams.delete(requestId)
      if (streamError && streamError.name === 'AbortError') {
        sendChatEvent(requestId, 'done', { aborted: true })
      } else {
        sendChatEvent(requestId, 'error', { message: streamError && streamError.message ? streamError.message : String(streamError) })
      }
    })
    return { requestId, sessionId }
  })

  ipcMain.handle('ai:chat-cancel', (_event, payload) => {
    const requestId = payload && payload.requestId
    const abortController = activeChatStreams.get(requestId)
    if (abortController) abortController.abort()
    return { ok: Boolean(abortController) }
  })

  ipcMain.handle('agent:start', async (_event, request) => {
    const projectRoot = appState.getActiveProjectRoot()
    if (!projectRoot) return { error: 'No folder open - open a project folder first.' }
    const config = aiSettings.getPublicConfig()
    const token = aiSettings.getToken(config.provider)
    if (!token) return { error: 'No token saved for ' + config.provider + ' - open Settings and save your token.' }
    const text = request && typeof request.text === 'string' ? request.text.trim() : ''
    if (!text) return { error: 'Empty message' }
    const model = (config.model || chatService.defaultModelFor(config.provider)).trim()
    const baseUrl = config.provider === 'openai' ? config.openAiBaseUrl : config.copilotBaseUrl
    const sessionId = chatStore.ensureActiveSession(projectRoot)
    chatStore.addMessage(projectRoot, sessionId, 'user', text)

    const requestId = 'A' + String(++chatRequestCounter)
    const runRecord = {
      requestId,
      projectRoot,
      abortController: new AbortController(),
      pendingApprovalResolver: null,
      approvalTimeout: null,
      changes: [],
      emit: (type, payload) => sendAgentEvent(requestId, type, payload)
    }
    activeAgentRuns.set(requestId, runRecord)

    const attachmentPaths = request && Array.isArray(request.attachmentPaths) ? request.attachmentPaths : []
    const fullConfig = aiSettings.loadConfig()
    const mcpConfig = fullConfig.mcp && typeof fullConfig.mcp === 'object' ? fullConfig.mcp : { enabled: false, servers: [] }
    const sharedContextFiles = workspaceContext.getSharedContext(projectRoot).files
    agentRuntime.runAgent({
      runRecord,
      baseUrl,
      apiKey: token,
      model,
      userText: text,
      attachmentPaths,
      mcpConfig,
      copilotToken: aiSettings.getToken('copilot'),
      sharedContextFiles
    }).then((finalResult) => {
      activeAgentRuns.delete(requestId)
      if (finalResult.summary) chatStore.addMessage(projectRoot, sessionId, 'assistant', finalResult.summary)
      if (finalResult.changes && finalResult.changes.length) {
        agentChangeHistory.set(requestId, { projectRoot: projectRoot, changes: finalResult.changes })
        pruneAgentChangeHistory()
      }
      sendAgentEvent(requestId, 'done', { summary: finalResult.summary, changes: finalResult.changes, sessionId })
    }).catch((agentError) => {
      activeAgentRuns.delete(requestId)
      if (agentError && agentError.name === 'AbortError') {
        sendAgentEvent(requestId, 'done', { summary: '', aborted: true })
      } else {
        sendAgentEvent(requestId, 'error', { message: agentError && agentError.message ? agentError.message : String(agentError) })
      }
    })
    return { requestId, sessionId }
  })

  ipcMain.handle('agent:stop', (_event, payload) => {
    const runRecord = activeAgentRuns.get(payload && payload.requestId)
    if (runRecord) {
      agentRuntime.resolveApproval(runRecord, false)
      runRecord.abortController.abort()
    }
    return { ok: Boolean(runRecord) }
  })

  ipcMain.handle('agent:approval-command', (_event, payload) => {
    const runRecord = activeAgentRuns.get(payload && payload.requestId)
    if (runRecord) agentRuntime.resolveApproval(runRecord, payload.decision === 'approve')
    return { ok: Boolean(runRecord) }
  })

  ipcMain.handle('agent:undo-changes', (_event, payload) => {
    const requestId = payload && payload.requestId
    const historyEntry = agentChangeHistory.get(requestId)
    if (!historyEntry || !historyEntry.changes || historyEntry.changes.length === 0) return { ok: false }
    // Undo always runs in the folder where the changes were made, even if
    // the user switched folder tabs since the run (CODE-23).
    const changesProjectRoot = historyEntry.projectRoot
    historyEntry.changes.forEach((change) => {
      try {
        if (change.existedBefore) {
          projectFileService.writeFile(changesProjectRoot, change.path, change.before)
        } else {
          projectFileService.deleteFile(changesProjectRoot, change.path)
        }
      } catch (undoError) {
        console.error('[Unicon Studio] undo failed for ' + change.path + ':', undoError)
      }
    })
    agentChangeHistory.delete(requestId)
    sendAgentEvent(requestId, 'undo-done', {})
    return { ok: true }
  })

  ipcMain.handle('app:open-folder', async () => {
    const dialogResult = await dialog.showOpenDialog(mainWindow, {
      title: 'Open a project folder',
      properties: ['openDirectory']
    })
    if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
      return appState.loadState()
    }
    const chosenFolder = dialogResult.filePaths[0]
    appState.addProjectRoot(chosenFolder)
    // A new active folder invalidates only the watcher; other folders'
    // previews and terminals keep running (CODE-23/CODE-26).
    startProjectWatcher(chosenFolder)
    broadcastProjectRoot(chosenFolder)
    broadcastFolderTabs()
    return appState.loadState()
  })

  ipcMain.handle('app:switch-folder', (_event, payload) => {
    const folder = payload && typeof payload.folder === 'string' ? payload.folder : ''
    const previousActiveRoot = appState.getActiveProjectRoot()
    if (!folder || folder === previousActiveRoot) return appState.loadState()
    appState.switchProjectRoot(folder)
    // The preview of every folder keeps running; only the watcher follows
    // the active tab so file changes hot-reload the visible preview.
    startProjectWatcher(folder)
    broadcastProjectRoot(folder)
    broadcastFolderTabs()
    return appState.loadState()
  })

  ipcMain.handle('app:close-folder', (_event, payload) => {
    const folder = payload && typeof payload.folder === 'string' ? payload.folder : ''
    if (!folder) return appState.loadState()
    const wasActive = folder === appState.getActiveProjectRoot()
    appState.closeProjectRoot(folder)
    terminalService.stopSession(folder)
    stopPreview(folder)
    const nextActiveRoot = appState.getActiveProjectRoot()
    if (wasActive) {
      if (nextActiveRoot) startProjectWatcher(nextActiveRoot)
      else stopProjectWatcher()
      broadcastProjectRoot(nextActiveRoot)
    }
    broadcastFolderTabs()
    return appState.loadState()
  })

  ipcMain.handle('preview:start', async () => {
    try {
      const projectRoot = appState.getActiveProjectRoot()
      if (!projectRoot) {
        return { state: 'error', root: '', message: 'No folder open - use Open Folder first.' }
      }
      const projectKind = previewServer.detectProjectKind(projectRoot)
      if (projectKind === 'nextjs') {
        nextjsRunner.start(projectRoot, (event) => broadcastNextjsEvent(projectRoot, event))
        const status = { state: 'starting', kind: projectKind, root: projectRoot }
        broadcastPreviewStatus(status)
        return status
      }
      if (projectKind === 'unsupported') {
        return { state: 'unsupported', kind: projectKind, root: projectRoot, message: 'Project kind not supported - only static HTML/CSS/JS sites and Next.js projects are previewed (CODE-05).' }
      }
      const startResult = await previewServer.start(projectRoot)
      const entryPages = previewServer.listEntryPages(projectRoot)
      const defaultEntry = entryPages.find((entry) => entry.name !== 'test-harness.html') || entryPages[0] || null
      const previewUrl = startResult.url + (defaultEntry
        ? (defaultEntry.wrapped
          ? '__codedevtool-app/?entry=' + encodeURIComponent(defaultEntry.name)
          : encodeURIComponent(defaultEntry.name))
        : '')
      const status = {
        state: 'running',
        kind: projectKind,
        root: projectRoot,
        url: previewUrl,
        rootUrl: startResult.url,
        entries: entryPages,
        entry: defaultEntry ? defaultEntry.name : ''
      }
      broadcastPreviewStatus(status)
      return status
    } catch (startError) {
      console.error('[Unicon Studio] preview:start failed:', startError)
      return { state: 'error', root: appState.getActiveProjectRoot() || '', message: startError && startError.message ? startError.message : String(startError) }
    }
  })

  ipcMain.handle('preview:stop', () => {
    const projectRoot = appState.getActiveProjectRoot()
    if (projectRoot) stopPreview(projectRoot)
    return { state: 'stopped', root: projectRoot || '' }
  })

  ipcMain.handle('preview:open-devtools', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
      return { ok: true }
    }
    return { ok: false }
  })

  ipcMain.handle('term:start', () => {
    const projectRoot = appState.getActiveProjectRoot()
    if (!projectRoot) return { error: 'No folder open - open a project folder first.' }
    const alreadyRunning = terminalService.isSessionRunning(projectRoot)
    terminalService.startSession({
      cwd: projectRoot,
      onOutput: (text) => broadcastTerminalOutput(projectRoot, text),
      onExit: (exitCode) => broadcastTerminalExited(projectRoot, exitCode)
    })
    return { ok: true, alreadyRunning: alreadyRunning }
  })

  ipcMain.handle('term:input', (_event, payload) => {
    const projectRoot = appState.getActiveProjectRoot()
    const activeSession = projectRoot ? terminalService.getActiveSession(projectRoot) : null
    const inputText = payload && typeof payload.text === 'string' ? payload.text : ''
    if (!inputText) return { ok: false }
    if (!activeSession) return { error: 'No terminal session - start one first.' }
    activeSession.send(inputText)
    return { ok: true }
  })

  ipcMain.handle('term:stop', () => {
    const projectRoot = appState.getActiveProjectRoot()
    if (projectRoot) terminalService.stopSession(projectRoot)
    broadcastTerminalExited(projectRoot || '', null)
    return { ok: true }
  })
}

async function startApplication() {
  // Packaged builds serve the bundled SSOT documents (docs/ inside the
  // package); development serves the live files next to the app folder.
  const serverStartResult = await appServer.start(
    app.isPackaged ? { docsFolder: path.join(app.getAppPath(), 'docs') } : undefined
  )
  uiUrl = serverStartResult.url
  Menu.setApplicationMenu(null)
  registerIpcHandlers()
  createMainWindow()
  const restoredProjectRoot = appState.getActiveProjectRoot()
  if (restoredProjectRoot) startProjectWatcher(restoredProjectRoot)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
}

// Smoke mode disables hardware acceleration so runs are deterministic and
// never depend on the machine's GPU driver state.
if (process.env.CODEDEVTOOL_SMOKE_TEST === '1') {
  app.disableHardwareAcceleration()
}

app.whenReady().then(async () => {
  await startApplication()
  // Smoke-test hook: start, let the window load, then quit automatically.
  // Exit code 0 with no errors means the skeleton is healthy.
  if (process.env.CODEDEVTOOL_SMOKE_TEST === '1') {
    setTimeout(() => app.quit(), 5000)
  }
})

app.on('before-quit', () => {
  stopProjectWatcher()
  previewServer.stopAll()
  nextjsRunner.stopAll()
  terminalService.stopAllSessions()
  appServer.stop()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
