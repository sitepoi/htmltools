// CodeDevTool - terminal view (T-17, CODE-34)
// Multiple terminal instances per folder, VS Code-style: instance tabs in
// the strip sit one level below the folder tabs. Each instance owns its
// output element, scroll position, command history, and a persistent
// cmd.exe session. Instances keep running while their folder is in the
// background; closing a folder stops all of its instances.

(function () {
  'use strict'

  const bridge = window.codedevtool
  const maximumOutputLines = 500
  const maximumOutputCharacters = 30000
  // Map<folderRoot, { instances: [...], activeSessionId, nextInstanceNumber, nextInstanceId }>
  const terminalStatesByRoot = new Map()
  let activeFolderRoot = ''

  function outputsContainer() { return document.getElementById('terminal-outputs') }
  function tabsContainer() { return document.getElementById('terminal-tabs') }
  function inputElement() { return document.getElementById('terminal-input') }

  function ensureFolderState(folderRoot) {
    let folderState = terminalStatesByRoot.get(folderRoot)
    if (!folderState) {
      folderState = { instances: [], activeSessionId: '', nextInstanceNumber: 1, nextInstanceId: 1 }
      terminalStatesByRoot.set(folderRoot, folderState)
    }
    return folderState
  }

  function buildInstanceOutputElement(instance) {
    const output = document.createElement('div')
    output.className = 'terminal-output'
    output.dataset.sessionId = instance.sessionId
    const container = outputsContainer()
    if (container) container.appendChild(output)
    return output
  }

  function appendOutputLine(instance, text, lineClass) {
    const output = instance.outputElement
    if (!output) return
    const line = document.createElement('div')
    if (lineClass) line.className = lineClass
    line.textContent = text
    output.appendChild(line)
    while (output.childNodes.length > maximumOutputLines) {
      output.removeChild(output.firstChild)
    }
    while (output.textContent.length > maximumOutputCharacters && output.firstChild) {
      output.removeChild(output.firstChild)
    }
    if (instance.isActive) output.scrollTop = output.scrollHeight
  }

  function appendInfoLine(instance, text) {
    appendOutputLine(instance, text, 'terminal-info-line')
  }

  function folderNameFromRoot(folderRoot) {
    const normalizedRoot = String(folderRoot).replace(/[\\/]+$/, '')
    const separatorIndex = Math.max(normalizedRoot.lastIndexOf('\\'), normalizedRoot.lastIndexOf('/'))
    return separatorIndex >= 0 ? normalizedRoot.slice(separatorIndex + 1) : normalizedRoot
  }

  function renderTerminalTabs(folderRoot) {
    const tabs = tabsContainer()
    if (!tabs) return
    tabs.textContent = ''
    const folderState = ensureFolderState(folderRoot)
    folderState.instances.forEach((instance) => {
      const isExited = instance.started && !instance.running
      const tab = document.createElement('div')
      tab.className = 'terminal-tab' +
        (instance.isActive ? ' terminal-tab-active' : '') +
        (isExited ? ' terminal-tab-exited' : '')
      tab.title = 'Terminal ' + instance.label + (isExited ? ' (ended)' : '')
      tab.addEventListener('click', () => switchToTerminalInstance(folderRoot, instance.sessionId))
      const label = document.createElement('span')
      label.className = 'terminal-tab-label'
      label.textContent = instance.label
      const closeButton = document.createElement('button')
      closeButton.className = 'terminal-tab-close'
      closeButton.textContent = '×'
      closeButton.title = 'Close this terminal instance'
      closeButton.addEventListener('click', (event) => {
        event.stopPropagation()
        removeTerminalInstance(folderRoot, instance.sessionId)
      })
      tab.appendChild(label)
      tab.appendChild(closeButton)
      tabs.appendChild(tab)
    })
    const addButton = document.createElement('button')
    addButton.className = 'terminal-tab-add'
    addButton.textContent = '+'
    addButton.title = 'New terminal instance in this folder'
    addButton.addEventListener('click', () => createTerminalInstance(folderRoot))
    tabs.appendChild(addButton)
  }

  function switchToTerminalInstance(folderRoot, sessionId) {
    const folderState = ensureFolderState(folderRoot)
    const instance = folderState.instances.find((candidate) => candidate.sessionId === sessionId)
    if (!instance) return
    folderState.activeSessionId = sessionId
    folderState.instances.forEach((candidate) => {
      candidate.isActive = candidate.sessionId === sessionId
      candidate.outputElement.classList.toggle('terminal-output-active', candidate.isActive)
    })
    renderTerminalTabs(folderRoot)
    instance.outputElement.scrollTop = instance.outputElement.scrollHeight
  }

  function createTerminalInstance(folderRoot) {
    const folderState = ensureFolderState(folderRoot)
    const instanceNumber = folderState.nextInstanceNumber
    folderState.nextInstanceNumber += 1
    const instance = {
      sessionId: 't' + folderState.nextInstanceId,
      label: instanceNumber + ': cmd',
      running: false,
      started: false,
      commandHistory: [],
      historyIndex: 0,
      outputElement: null,
      isActive: false
    }
    folderState.nextInstanceId += 1
    instance.outputElement = buildInstanceOutputElement(instance)
    folderState.instances.push(instance)
    switchToTerminalInstance(folderRoot, instance.sessionId)
    if (instanceNumber === 1) {
      appendInfoLine(instance, 'Terminal - commands run in ' + folderNameFromRoot(folderRoot) + '. Use + for more instances.')
    }
    return instance
  }

  function removeTerminalInstance(folderRoot, sessionId) {
    const folderState = ensureFolderState(folderRoot)
    const instanceIndex = folderState.instances.findIndex((candidate) => candidate.sessionId === sessionId)
    if (instanceIndex === -1) return
    const instance = folderState.instances[instanceIndex]
    if (instance.running) bridge.stopTerminal(instance.sessionId)
    if (instance.outputElement && instance.outputElement.parentElement) instance.outputElement.remove()
    folderState.instances.splice(instanceIndex, 1)
    if (folderState.activeSessionId === sessionId) folderState.activeSessionId = ''
    renderTerminalTabs(folderRoot)
    if (folderState.instances.length === 0) {
      // The strip always keeps one idle instance so typing stays possible.
      createTerminalInstance(folderRoot)
    } else {
      switchToTerminalInstance(folderRoot, folderState.activeSessionId || folderState.instances[0].sessionId)
    }
  }

  function findInstance(folderRoot, sessionId) {
    if (!folderRoot || !sessionId) return null
    const folderState = terminalStatesByRoot.get(folderRoot)
    if (!folderState) return null
    return folderState.instances.find((candidate) => candidate.sessionId === sessionId) || null
  }

  function activeInstance() {
    if (!activeFolderRoot) return null
    const folderState = ensureFolderState(activeFolderRoot)
    if (folderState.instances.length === 0) return null
    return folderState.instances.find((candidate) => candidate.sessionId === folderState.activeSessionId) ||
      folderState.instances[0]
  }

  async function ensureSessionStarted(instance) {
    if (instance.running) return true
    const result = await bridge.startTerminal(instance.sessionId)
    if (result && result.error) {
      appendInfoLine(instance, '[ ' + result.error + ' ]')
      return false
    }
    instance.started = true
    instance.running = true
    renderTerminalTabs(activeFolderRoot)
    return true
  }

  async function runInput() {
    const input = inputElement()
    if (!input) return
    const commandText = input.value.trim()
    if (!commandText) return
    if (!activeFolderRoot) return
    let instance = activeInstance()
    if (!instance) instance = createTerminalInstance(activeFolderRoot)
    appendOutputLine(instance, '> ' + commandText, 'terminal-command-line')
    instance.commandHistory.push(commandText)
    instance.historyIndex = instance.commandHistory.length
    input.value = ''
    const started = await ensureSessionStarted(instance)
    if (started) bridge.sendTerminalInput(instance.sessionId, commandText)
  }

  function killActiveSession() {
    const instance = activeInstance()
    if (!instance) return
    bridge.stopTerminal(instance.sessionId)
  }

  function clearActiveOutput() {
    const instance = activeInstance()
    if (instance && instance.outputElement) instance.outputElement.textContent = ''
  }

  function handleProjectChanged(folderRoot) {
    const nextRoot = folderRoot || ''
    if (nextRoot === activeFolderRoot) return
    activeFolderRoot = nextRoot
    const folderState = ensureFolderState(nextRoot)
    if (folderState.instances.length === 0) {
      createTerminalInstance(nextRoot)
    } else {
      switchToTerminalInstance(nextRoot, folderState.activeSessionId || folderState.instances[0].sessionId)
    }
  }

  function handleFolderTabsChanged(projectRoots) {
    // Folder tabs closed from the top level: drop their terminal UI state
    // (the main process already stopped their sessions).
    const rootsStillOpen = new Set(Array.isArray(projectRoots) ? projectRoots : [])
    terminalStatesByRoot.forEach((folderState, folderRoot) => {
      if (rootsStillOpen.has(folderRoot)) return
      folderState.instances.forEach((instance) => {
        if (instance.outputElement && instance.outputElement.parentElement) instance.outputElement.remove()
      })
      terminalStatesByRoot.delete(folderRoot)
    })
  }

  function initialize() {
    if (!bridge) return
    const input = inputElement()
    if (input) {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          runInput()
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          const instance = activeInstance()
          if (!instance || instance.commandHistory.length === 0) return
          instance.historyIndex = Math.max(0, instance.historyIndex - 1)
          input.value = instance.commandHistory[instance.historyIndex] || ''
        } else if (event.key === 'ArrowDown') {
          event.preventDefault()
          const instance = activeInstance()
          if (!instance || instance.commandHistory.length === 0) return
          if (instance.historyIndex >= instance.commandHistory.length - 1) {
            instance.historyIndex = instance.commandHistory.length
            input.value = ''
            return
          }
          instance.historyIndex += 1
          input.value = instance.commandHistory[instance.historyIndex] || ''
        }
      })
    }
    const clearButton = document.getElementById('terminal-clear-button')
    if (clearButton) clearButton.addEventListener('click', clearActiveOutput)
    const killButton = document.getElementById('terminal-kill-button')
    if (killButton) killButton.addEventListener('click', killActiveSession)
    if (typeof bridge.onTerminalOutput === 'function') {
      bridge.onTerminalOutput((payload) => {
        // Instance-scoped output (CODE-34): each sessionId feeds exactly
        // its own output element, visible or in the background.
        const instance = findInstance(payload && payload.root, payload && payload.sessionId)
        if (instance) appendOutputLine(instance, String(payload && payload.text || '').replace(/\n$/, ''))
      })
    }
    if (typeof bridge.onTerminalExited === 'function') {
      bridge.onTerminalExited((payload) => {
        const instance = findInstance(payload && payload.root, payload && payload.sessionId)
        if (!instance) return
        instance.running = false
        appendInfoLine(instance, '[ session ended ]')
        if (instance.isActive) instance.outputElement.scrollTop = instance.outputElement.scrollHeight
        renderTerminalTabs(payload.root)
      })
    }
    if (typeof bridge.onProjectChanged === 'function') {
      bridge.onProjectChanged((folderRoot) => handleProjectChanged(folderRoot))
    }
    if (typeof bridge.onFolderTabsChanged === 'function') {
      bridge.onFolderTabsChanged((folderTabsState) => handleFolderTabsChanged(folderTabsState && folderTabsState.projectRoots))
    }
    bridge.getState().then((state) => {
      handleProjectChanged(state && state.activeProjectRoot ? state.activeProjectRoot : '')
    }).catch(() => {
      // The project-changed broadcast fills the root when a folder opens.
    })
  }

  document.addEventListener('DOMContentLoaded', initialize)
})()
