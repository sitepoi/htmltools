// Unicon Studio - preview view
// Fills the dominant center panel (CODE-10). Static projects run on the
// built-in preview server with hot reload (T-14); Next.js projects run
// their own dev server, which the tool watches and embeds (T-15). Console
// relay arrives with T-16. One LIVE iframe per folder tab (CODE-26):
// switching tabs just swaps which iframe is visible, so every folder's
// preview keeps running, keeps its entry/role choice, and is not reloaded.

(function () {
  'use strict'

  const bridge = window.codedevtool
  const maximumLogCharacters = 6000
  const maximumConsoleLines = 200
  let previewUrl = ''
  let currentProjectKind = ''
  let reloadTimer = null
  let consoleMessageCount = 0
  let currentPreviewRootUrl = ''
  let currentEntries = []
  let currentEntryName = ''
  let currentRole = 'admin'
  // One record per folder: the latest status from the main process, the
  // user's role/entry choice, and that folder's live iframe element.
  const previewRecordsByRoot = new Map()
  let activeFolderRoot = ''
  let visibleFrameElement = null

  function previewBody() { return document.getElementById('preview-body') }
  function previewMessage() { return document.getElementById('preview-message') }
  function previewLog() { return document.getElementById('preview-log') }
  function previewConsole() { return document.getElementById('preview-console') }

  function recordForRoot(root) {
    if (!root) return null
    let record = previewRecordsByRoot.get(root)
    if (!record) {
      record = { status: null, entryName: '', role: 'admin', frameElement: null }
      previewRecordsByRoot.set(root, record)
    }
    return record
  }

  function ensureFrameForRecord(record) {
    if (record.frameElement) return record.frameElement
    const frame = document.createElement('iframe')
    frame.className = 'preview-frame'
    frame.title = 'Live preview'
    frame.hidden = true
    const body = previewBody()
    if (body) body.appendChild(frame)
    record.frameElement = frame
    return frame
  }

  function hideVisibleFrame() {
    if (visibleFrameElement) {
      visibleFrameElement.hidden = true
      visibleFrameElement = null
    }
  }

  function showMessage(messageText) {
    hideVisibleFrame()
    const message = previewMessage()
    if (message) {
      message.hidden = false
      message.textContent = messageText
    }
    const urlLabel = document.getElementById('preview-url-label')
    if (urlLabel) urlLabel.textContent = ''
    const startButton = document.getElementById('preview-start-button')
    if (startButton) startButton.hidden = false
    const stopButton = document.getElementById('preview-stop-button')
    if (stopButton) stopButton.hidden = true
    const reloadButton = document.getElementById('preview-reload-button')
    if (reloadButton) reloadButton.hidden = true
    const entrySelect = document.getElementById('preview-entry-select')
    if (entrySelect) entrySelect.hidden = true
    const roleSelect = document.getElementById('preview-role-select')
    if (roleSelect) roleSelect.hidden = true
  }

  function showRunningPreview(url) {
    previewUrl = url
    const message = previewMessage()
    if (message) message.hidden = true
    const record = recordForRoot(activeFolderRoot)
    const frame = ensureFrameForRecord(record)
    // Setting src only when it differs avoids a needless reload: switching
    // back to a folder keeps its page exactly as it was left.
    if (frame.getAttribute('src') !== url) frame.src = url
    hideVisibleFrame()
    frame.hidden = false
    visibleFrameElement = frame
    const log = previewLog()
    if (log) log.hidden = true
    const urlLabel = document.getElementById('preview-url-label')
    if (urlLabel) urlLabel.textContent = url
    const startButton = document.getElementById('preview-start-button')
    if (startButton) startButton.hidden = true
    const stopButton = document.getElementById('preview-stop-button')
    if (stopButton) stopButton.hidden = false
    const reloadButton = document.getElementById('preview-reload-button')
    if (reloadButton) reloadButton.hidden = false
  }

  function showLog() {
    const log = previewLog()
    if (log) log.hidden = false
  }

  function appendLogLine(lineText) {
    const log = previewLog()
    if (!log) return
    log.textContent = (log.textContent + lineText).slice(-maximumLogCharacters)
    log.scrollTop = log.scrollHeight
  }

  function updateConsoleCount() {
    const countLabel = document.getElementById('preview-console-count')
    if (countLabel) countLabel.textContent = String(consoleMessageCount)
  }

  function appendConsoleLine(level, args) {
    const consolePanel = previewConsole()
    if (!consolePanel) return
    const line = document.createElement('div')
    line.className = 'preview-console-line level-' + level
    line.textContent = (args || []).join(' ')
    consolePanel.appendChild(line)
    while (consolePanel.childNodes.length > maximumConsoleLines) {
      consolePanel.removeChild(consolePanel.firstChild)
    }
    consolePanel.scrollTop = consolePanel.scrollHeight
    consoleMessageCount += 1
    updateConsoleCount()
  }

  function toggleConsolePanel() {
    const consolePanel = previewConsole()
    if (consolePanel) consolePanel.hidden = !consolePanel.hidden
  }

  function handlePreviewMessage(messageEvent) {
    const previewData = messageEvent.data && messageEvent.data.codedevtoolPreview
    if (!previewData) return
    if (typeof messageEvent.origin === 'string' && !messageEvent.origin.startsWith('http://127.0.0.1')) return
    // Only the VISIBLE folder's iframe feeds the console; hidden folders
    // keep running but their messages are ignored.
    if (visibleFrameElement && messageEvent.source !== visibleFrameElement.contentWindow) return
    appendConsoleLine(previewData.level || 'log', previewData.args)
  }

  async function openPreviewDevTools() {
    try {
      await bridge.openPreviewDevTools()
    } catch (_error) {
      // DevTools are a convenience; failures stay silent.
    }
  }

  function showStartingNextjs() {
    currentProjectKind = 'nextjs'
    previewUrl = ''
    showMessage('Starting Next.js dev server - watch the log below.')
    showLog()
    const startButton = document.getElementById('preview-start-button')
    if (startButton) startButton.hidden = true
    const stopButton = document.getElementById('preview-stop-button')
    if (stopButton) stopButton.hidden = false
    const reloadButton = document.getElementById('preview-reload-button')
    if (reloadButton) reloadButton.hidden = true
  }

  function reloadPreviewFrame() {
    if (visibleFrameElement && previewUrl) visibleFrameElement.src = previewUrl
  }

  function buildPreviewUrl() {
    if (!currentPreviewRootUrl) return ''
    const entry = currentEntries.find((candidate) => candidate.name === currentEntryName)
    if (!entry) return currentPreviewRootUrl
    if (entry.wrapped) {
      return currentPreviewRootUrl + '__codedevtool-app/?entry=' + encodeURIComponent(entry.name) + '&role=' + encodeURIComponent(currentRole)
    }
    return currentPreviewRootUrl + encodeURIComponent(entry.name)
  }

  function renderEntryControls() {
    const entrySelect = document.getElementById('preview-entry-select')
    const roleSelect = document.getElementById('preview-role-select')
    if (entrySelect) {
      entrySelect.textContent = ''
      if (currentEntries.length > 1) {
        currentEntries.forEach((entry) => {
          const option = document.createElement('option')
          option.value = entry.name
          option.textContent = entry.name + (entry.wrapped ? ' (wrapped)' : '')
          entrySelect.appendChild(option)
        })
        entrySelect.value = currentEntryName
        entrySelect.hidden = false
      } else {
        entrySelect.hidden = true
      }
    }
    const currentEntry = currentEntries.find((candidate) => candidate.name === currentEntryName) || null
    if (roleSelect) {
      roleSelect.value = currentRole
      roleSelect.hidden = !(currentEntry && currentEntry.wrapped)
    }
  }

  function refreshPreviewFromControls() {
    previewUrl = buildPreviewUrl()
    const record = recordForRoot(activeFolderRoot)
    if (record) {
      record.entryName = currentEntryName
      record.role = currentRole
    }
    reloadPreviewFrame()
    const urlLabel = document.getElementById('preview-url-label')
    if (urlLabel) urlLabel.textContent = previewUrl
  }

  function applyRunningStatus(status, record) {
    currentProjectKind = status.state === 'nextjs-running' ? 'nextjs' : (status.kind || 'static')
    currentPreviewRootUrl = status.rootUrl || ''
    currentEntries = status.entries || []
    currentEntryName = record && record.entryName ? record.entryName : (status.entry || '')
    currentRole = record ? record.role : 'admin'
    if (currentEntries.length > 0 && !currentEntries.some((entry) => entry.name === currentEntryName)) {
      currentEntryName = currentEntries[0].name
    }
    renderEntryControls()
    // Static previews rebuild the URL from the saved entry/role choice;
    // Next.js previews show the dev-server URL as-is.
    const urlForDisplay = currentProjectKind === 'nextjs' ? status.url : buildPreviewUrl()
    showRunningPreview(urlForDisplay)
  }

  function handlePreviewStatus(status) {
    if (!status) return
    const statusRoot = status.root || activeFolderRoot
    if (status.state === 'running' || status.state === 'nextjs-running' || status.state === 'starting') {
      const record = recordForRoot(statusRoot)
      record.status = status
      if (!record.entryName && status.entry) record.entryName = status.entry
      if (activeFolderRoot && statusRoot === activeFolderRoot) {
        if (status.state === 'starting') {
          showStartingNextjs()
        } else {
          applyRunningStatus(status, record)
        }
      }
      return
    }
    if (status.state === 'stopped' || status.state === 'error' || status.state === 'unsupported') {
      const record = previewRecordsByRoot.get(statusRoot)
      if (record && record.frameElement) record.frameElement.remove()
      previewRecordsByRoot.delete(statusRoot)
      if (activeFolderRoot && statusRoot === activeFolderRoot) {
        if (status.state === 'stopped') {
          showMessage(currentProjectKind === 'nextjs' ? 'Dev server stopped - press Start preview to try again.' : 'Preview stopped.')
        } else if (status.state === 'unsupported') {
          currentProjectKind = ''
          showMessage('Project kind not supported - only static HTML/CSS/JS sites and Next.js projects are previewed (CODE-05).')
          const startButton = document.getElementById('preview-start-button')
          if (startButton) startButton.hidden = true
        } else {
          showMessage(status.message || 'Preview failed to start.')
        }
      }
    }
  }

  function resetPreviewUiForFolderSwitch() {
    const consolePanel = previewConsole()
    if (consolePanel) {
      consolePanel.textContent = ''
      consolePanel.hidden = true
    }
    consoleMessageCount = 0
    updateConsoleCount()
    const log = previewLog()
    if (log) log.textContent = ''
    const record = previewRecordsByRoot.get(activeFolderRoot)
    if (record && record.status && (record.status.state === 'running' || record.status.state === 'nextjs-running')) {
      applyRunningStatus(record.status, record)
      return
    }
    if (record && record.status && record.status.state === 'starting') {
      showStartingNextjs()
      return
    }
    previewUrl = ''
    currentProjectKind = ''
    currentPreviewRootUrl = ''
    currentEntries = []
    currentEntryName = ''
    currentRole = 'admin'
    showMessage('No preview running in this folder - press Start preview to begin.')
  }

  function handleNextjsEvent(event) {
    if (!event) return
    // Dev-server logs belong to the folder that started the server; other
    // folders keep their own logs out of this view (CODE-26).
    if (event.root && activeFolderRoot && event.root !== activeFolderRoot) return
    if (event.type === 'log') {
      appendLogLine(event.text)
    } else if (event.type === 'ready') {
      appendLogLine('Ready on port ' + event.port + '.\n')
    } else if (event.type === 'error') {
      appendLogLine('Error: ' + event.message + '\n')
      showMessage(event.message || 'Dev server error - press Start preview to try again.')
      const stopButton = document.getElementById('preview-stop-button')
      if (stopButton) stopButton.hidden = true
    } else if (event.type === 'exited') {
      const exitCodeText = event.exitCode !== null && event.exitCode !== undefined
        ? ' with code ' + event.exitCode
        : ''
      appendLogLine('Dev server exited' + exitCodeText + '.\n')
    }
  }

  async function startPreview() {
    showMessage('Starting preview...')
    try {
      const status = await bridge.startPreview()
      handlePreviewStatus(status)
    } catch (startError) {
      const errorText = startError && startError.message ? startError.message : 'unknown error'
      showMessage('Preview failed to start: ' + errorText)
    }
  }

  async function stopPreview() {
    try {
      const status = await bridge.stopPreview()
      handlePreviewStatus(status)
    } catch (_error) {
      showMessage('Preview failed to stop.')
    }
  }

  function scheduleHotReload() {
    // Static projects hot-reload on file changes; Next.js projects use the
    // dev server's own hot module replacement instead. Only the visible
    // folder's preview reloads - hidden folders are untouched.
    if (currentProjectKind !== 'static' || !previewUrl) return
    clearTimeout(reloadTimer)
    reloadTimer = setTimeout(reloadPreviewFrame, 300)
  }

  function initialize() {
    if (!bridge) return
    const startButton = document.getElementById('preview-start-button')
    if (startButton) startButton.addEventListener('click', startPreview)
    const stopButton = document.getElementById('preview-stop-button')
    if (stopButton) stopButton.addEventListener('click', stopPreview)
    const reloadButton = document.getElementById('preview-reload-button')
    if (reloadButton) reloadButton.addEventListener('click', reloadPreviewFrame)
    const consoleButton = document.getElementById('preview-console-button')
    if (consoleButton) consoleButton.addEventListener('click', toggleConsolePanel)
    const devToolsButton = document.getElementById('preview-devtools-button')
    if (devToolsButton) devToolsButton.addEventListener('click', openPreviewDevTools)
    const entrySelect = document.getElementById('preview-entry-select')
    if (entrySelect) {
      entrySelect.addEventListener('change', () => {
        currentEntryName = entrySelect.value
        renderEntryControls()
        refreshPreviewFromControls()
      })
    }
    const roleSelect = document.getElementById('preview-role-select')
    if (roleSelect) {
      roleSelect.addEventListener('change', () => {
        currentRole = roleSelect.value
        refreshPreviewFromControls()
      })
    }
    if (typeof bridge.onPreviewStatus === 'function') bridge.onPreviewStatus(handlePreviewStatus)
    if (typeof bridge.onNextjsEvent === 'function') bridge.onNextjsEvent(handleNextjsEvent)
    if (typeof bridge.onFileChanged === 'function') bridge.onFileChanged(scheduleHotReload)
    if (typeof bridge.onProjectChanged === 'function') {
      bridge.onProjectChanged((folderRoot) => {
        activeFolderRoot = folderRoot || ''
        resetPreviewUiForFolderSwitch()
      })
    }
    bridge.getState().then((state) => {
      activeFolderRoot = state && state.activeProjectRoot ? state.activeProjectRoot : ''
    }).catch(() => {
      // The project-changed broadcast fills the root when a folder opens.
    })
    window.addEventListener('message', handlePreviewMessage)
    showMessage('Open a folder, then press Start preview.')
  }

  document.addEventListener('DOMContentLoaded', initialize)
})()

