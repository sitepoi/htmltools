// Unicon Studio - terminal service
// Runs single commands in the project folder (CODE-06). Used by the agent
// approval gate (T-12) now; the interactive terminal view arrives with
// T-17. Windows: commands run through cmd.exe - never spawn .cmd files
// directly (Node's EINVAL security change).

const { spawn } = require('child_process')

const defaultCommandTimeoutMilliseconds = 120000

function killProcessTree(childProcess) {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(childProcess.pid), '/T', '/F'], { windowsHide: true })
  } else {
    childProcess.kill('SIGTERM')
  }
}

// Multiple terminal instances per folder (CODE-34): each folder tab owns
// any number of terminal sessions, keyed by sessionId - VS Code-style
// instance tabs one level below the folder tabs (CODE-23). Sessions stay
// alive across folder switches and stop when their folder closes.

const sessionsByRoot = new Map() // Map<projectRoot, Map<sessionId, session>>

function startSession(options) {
  const workingDirectory = options.cwd
  const sessionId = typeof options.sessionId === 'string' && options.sessionId ? options.sessionId : 'default'
  let rootSessions = sessionsByRoot.get(workingDirectory)
  if (!rootSessions) {
    rootSessions = new Map()
    sessionsByRoot.set(workingDirectory, rootSessions)
  }
  const existingSession = rootSessions.get(sessionId)
  if (existingSession) return existingSession
  const onOutput = options.onOutput
  const onExit = options.onExit
  let childProcess
  if (process.platform === 'win32') {
    const commandShell = process.env.ComSpec || 'cmd.exe'
    // /q turns echo off - the view echoes the user's own input instead.
    childProcess = spawn(commandShell, ['/d', '/q'], { cwd: workingDirectory, windowsHide: true })
  } else {
    childProcess = spawn('/bin/sh', ['-i'], { cwd: workingDirectory })
  }
  const forgetSession = () => {
    const sessions = sessionsByRoot.get(workingDirectory)
    if (sessions) {
      sessions.delete(sessionId)
      if (sessions.size === 0) sessionsByRoot.delete(workingDirectory)
    }
  }
  childProcess.stdout.on('data', (chunk) => {
    if (typeof onOutput === 'function') onOutput(chunk.toString())
  })
  childProcess.stderr.on('data', (chunk) => {
    if (typeof onOutput === 'function') onOutput(chunk.toString())
  })
  childProcess.on('exit', (exitCode) => {
    forgetSession()
    if (typeof onExit === 'function') onExit(exitCode)
  })
  childProcess.on('error', (processError) => {
    forgetSession()
    if (typeof onExit === 'function') onExit(-1, processError.message)
  })
  const session = {
    root: workingDirectory,
    sessionId: sessionId,
    send: function (inputText) {
      try {
        childProcess.stdin.write(String(inputText) + '\r\n')
      } catch (_writeError) {
        // Session died between checks; the exit event reports it.
      }
    },
    stop: function () {
      killProcessTree(childProcess)
      forgetSession()
    }
  }
  rootSessions.set(sessionId, session)
  return session
}

function getSession(projectRoot, sessionId) {
  const rootSessions = sessionsByRoot.get(projectRoot)
  if (!rootSessions) return null
  return rootSessions.get(sessionId) || null
}

function getSessionIds(projectRoot) {
  const rootSessions = sessionsByRoot.get(projectRoot)
  return rootSessions ? Array.from(rootSessions.keys()) : []
}

function stopSession(projectRoot, sessionId) {
  // Without a sessionId this stops every instance in the folder (used when
  // a folder tab closes); with one it stops that single instance.
  const rootSessions = sessionsByRoot.get(projectRoot)
  if (!rootSessions) return
  if (sessionId === undefined || sessionId === null) {
    for (const session of Array.from(rootSessions.values())) session.stop()
    return
  }
  const session = rootSessions.get(sessionId)
  if (session) session.stop()
}

function stopAllSessions() {
  for (const projectRoot of Array.from(sessionsByRoot.keys())) stopSession(projectRoot)
}

function isSessionRunning(projectRoot, sessionId) {
  const rootSessions = sessionsByRoot.get(projectRoot)
  if (!rootSessions) return false
  if (sessionId === undefined || sessionId === null) return rootSessions.size > 0
  return rootSessions.has(sessionId)
}

function runCommand(command, options) {
  const workingDirectory = options.cwd
  const onOutput = options.onOutput
  const timeoutMilliseconds = options.timeoutMs || defaultCommandTimeoutMilliseconds

  return new Promise((resolve) => {
    let childProcess
    try {
      if (process.platform === 'win32') {
        const commandShell = process.env.ComSpec || 'cmd.exe'
        childProcess = spawn(commandShell, ['/d', '/s', '/c', command], {
          cwd: workingDirectory,
          windowsHide: true
        })
      } else {
        childProcess = spawn('/bin/sh', ['-c', command], { cwd: workingDirectory })
      }
    } catch (spawnError) {
      resolve({ exitCode: -1, output: '', error: spawnError.message, timedOut: false })
      return
    }

    let output = ''
    let didTimeout = false
    let didResolve = false

    const finish = (result) => {
      if (didResolve) return
      didResolve = true
      clearTimeout(timeoutTimer)
      resolve(result)
    }

    const timeoutTimer = setTimeout(() => {
      didTimeout = true
      killProcessTree(childProcess)
    }, timeoutMilliseconds)

    childProcess.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      output += text
      if (typeof onOutput === 'function') onOutput(text)
    })
    childProcess.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      output += text
      if (typeof onOutput === 'function') onOutput(text)
    })
    childProcess.on('error', (processError) => {
      finish({ exitCode: -1, output: output, error: processError.message, timedOut: false })
    })
    childProcess.on('exit', (exitCode) => {
      finish({ exitCode: exitCode, output: output, error: null, timedOut: didTimeout })
    })
  })
}

module.exports = { runCommand, killProcessTree, startSession, getSession, getSessionIds, stopSession, stopAllSessions, isSessionRunning }
