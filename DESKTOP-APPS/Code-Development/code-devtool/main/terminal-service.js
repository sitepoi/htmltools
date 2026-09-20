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

// One persistent session per open folder (CODE-23): switching folder tabs
// keeps each folder's terminal alive, like separate terminal instances.

const sessionsByRoot = new Map()

function startSession(options) {
  const workingDirectory = options.cwd
  const existingSession = sessionsByRoot.get(workingDirectory)
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
  childProcess.stdout.on('data', (chunk) => {
    if (typeof onOutput === 'function') onOutput(chunk.toString())
  })
  childProcess.stderr.on('data', (chunk) => {
    if (typeof onOutput === 'function') onOutput(chunk.toString())
  })
  childProcess.on('exit', (exitCode) => {
    sessionsByRoot.delete(workingDirectory)
    if (typeof onExit === 'function') onExit(exitCode)
  })
  childProcess.on('error', (processError) => {
    sessionsByRoot.delete(workingDirectory)
    if (typeof onExit === 'function') onExit(-1, processError.message)
  })
  const session = {
    root: workingDirectory,
    send: function (inputText) {
      try {
        childProcess.stdin.write(String(inputText) + '\r\n')
      } catch (_writeError) {
        // Session died between checks; the exit event reports it.
      }
    },
    stop: function () {
      killProcessTree(childProcess)
      sessionsByRoot.delete(workingDirectory)
    }
  }
  sessionsByRoot.set(workingDirectory, session)
  return session
}

function stopSession(projectRoot) {
  const session = sessionsByRoot.get(projectRoot)
  if (session) session.stop()
}

function stopAllSessions() {
  for (const session of Array.from(sessionsByRoot.values())) session.stop()
}

function getActiveSession(projectRoot) {
  return sessionsByRoot.get(projectRoot) || null
}

function isSessionRunning(projectRoot) {
  return sessionsByRoot.has(projectRoot)
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

module.exports = { runCommand, killProcessTree, startSession, stopSession, stopAllSessions, getActiveSession, isSessionRunning }
