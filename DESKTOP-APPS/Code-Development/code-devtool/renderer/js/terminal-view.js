// CodeDevTool - terminal view (T-17)
// A persistent command session in the project folder. The first Enter
// starts the session; output streams from the main process; Up/Down walk
// the in-memory command history; clear and kill live in the head.

(function () {
  'use strict'

  const bridge = window.codedevtool
  const maximumOutputLines = 500
  const maximumOutputCharacters = 30000
  const commandHistory = []
  let historyIndex = 0
  let sessionRunning = false
  let activeFolderRoot = ''

  function outputElement() { return document.getElementById('terminal-output') }
  function inputElement() { return document.getElementById('terminal-input') }

  function appendOutputLine(text, lineClass) {
    const output = outputElement()
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
    output.scrollTop = output.scrollHeight
  }

  function appendInfoLine(text) {
    appendOutputLine(text, 'terminal-info-line')
  }

  function clearOutput() {
    const output = outputElement()
    if (output) output.textContent = ''
  }

  async function ensureSessionStarted() {
    if (sessionRunning) return true
    const result = await bridge.startTerminal()
    if (result && result.error) {
      appendInfoLine('[ ' + result.error + ' ]')
      return false
    }
    sessionRunning = true
    return true
  }

  async function runInput() {
    const input = inputElement()
    if (!input) return
    const commandText = input.value.trim()
    if (!commandText) return
    appendOutputLine('> ' + commandText, 'terminal-command-line')
    commandHistory.push(commandText)
    historyIndex = commandHistory.length
    input.value = ''
    const started = await ensureSessionStarted()
    if (started) bridge.sendTerminalInput(commandText)
  }

  function killSession() {
    bridge.stopTerminal()
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
          if (commandHistory.length === 0) return
          historyIndex = Math.max(0, historyIndex - 1)
          input.value = commandHistory[historyIndex] || ''
        } else if (event.key === 'ArrowDown') {
          event.preventDefault()
          if (historyIndex >= commandHistory.length - 1) {
            historyIndex = commandHistory.length
            input.value = ''
            return
          }
          historyIndex += 1
          input.value = commandHistory[historyIndex] || ''
        }
      })
    }
    const clearButton = document.getElementById('terminal-clear-button')
    if (clearButton) clearButton.addEventListener('click', clearOutput)
    const killButton = document.getElementById('terminal-kill-button')
    if (killButton) killButton.addEventListener('click', killSession)
    if (typeof bridge.onTerminalOutput === 'function') {
      bridge.onTerminalOutput((payload) => {
        // Per-folder sessions (CODE-23): only the active folder's output
        // shows here; background folders keep streaming to their session.
        if (payload && payload.root && activeFolderRoot && payload.root !== activeFolderRoot) return
        appendOutputLine(String(payload && payload.text || '').replace(/\n$/, ''))
      })
    }
    if (typeof bridge.onTerminalExited === 'function') {
      bridge.onTerminalExited((payload) => {
        if (payload && payload.root && activeFolderRoot && payload.root !== activeFolderRoot) return
        sessionRunning = false
        appendInfoLine('[ session ended ]')
      })
    }
    if (typeof bridge.onProjectChanged === 'function') {
      bridge.onProjectChanged((folderRoot) => {
        activeFolderRoot = folderRoot || ''
        clearOutput()
        sessionRunning = false
      })
    }
    bridge.getState().then((state) => {
      activeFolderRoot = state && state.activeProjectRoot ? state.activeProjectRoot : ''
    }).catch(() => {
      // The project-changed broadcast fills the root when a folder opens.
    })
    appendInfoLine('Terminal - commands run in the active folder. Type a command and press Enter.')
  }

  document.addEventListener('DOMContentLoaded', initialize)
})()
