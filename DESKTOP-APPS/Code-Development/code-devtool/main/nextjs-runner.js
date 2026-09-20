// Unicon Studio - Next.js dev server runner (one per folder, CODE-26)
// Spawns the project's own dev server (`npm run dev`), captures the port
// from its output, streams the log, and kills the whole process tree on
// stop (SSOT T-15). Windows-first: taskkill prunes the child tree so no
// orphan node process keeps the port occupied. Folder tabs keep their
// dev servers running in the background.

const { spawn } = require('child_process')

const readyPortTimeoutMilliseconds = 120000
const runnersByRoot = new Map()

function stripAnsiEscapeCodes(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, '')
}

function parsePortFromOutputLine(lineText) {
  // Accept any localhost/127.0.0.1 URL in the output, not just the
  // "- Local:" line - dev server output formats vary across Next.js versions.
  const cleanLine = stripAnsiEscapeCodes(lineText)
  const portMatch = cleanLine.match(/https?:\/\/(?:localhost|127\.0\.0\.1):(\d{1,5})/i)
  return portMatch ? Number(portMatch[1]) : null
}

function start(projectRoot, onEvent) {
  stop(projectRoot)
  // On Windows, spawning npm.cmd directly with shell:false throws EINVAL
  // (Node security fix for .cmd/.bat files). Run npm through cmd.exe instead.
  let childProcess
  try {
    if (process.platform === 'win32') {
      const commandShell = process.env.ComSpec || 'cmd.exe'
      childProcess = spawn(commandShell, ['/d', '/s', '/c', 'npm run dev'], {
        cwd: projectRoot,
        windowsHide: true
      })
    } else {
      childProcess = spawn('npm', ['run', 'dev'], { cwd: projectRoot })
    }
  } catch (spawnError) {
    if (typeof onEvent === 'function') onEvent({ type: 'error', message: spawnError.message })
    return { state: 'error', message: spawnError.message }
  }

  const runner = { childProcess: childProcess, port: null }
  runnersByRoot.set(projectRoot, runner)

  const killRunner = () => {
    clearTimeout(runner.readyTimeout)
    runnersByRoot.delete(projectRoot)
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(childProcess.pid), '/T', '/F'], { windowsHide: true })
    } else {
      childProcess.kill('SIGTERM')
    }
  }
  runner.stop = killRunner

  // The port line can arrive split across stdout chunks, so parse from a
  // rolling buffer instead of per-chunk text.
  let outputBuffer = ''
  const handleOutputChunk = (chunk) => {
    const chunkText = chunk.toString()
    outputBuffer = (outputBuffer + chunkText).slice(-4000)
    if (typeof onEvent === 'function') onEvent({ type: 'log', text: chunkText })
    if (runnersByRoot.get(projectRoot) === runner && runner.port === null) {
      const detectedPort = parsePortFromOutputLine(outputBuffer)
      if (detectedPort) {
        runner.port = detectedPort
        clearTimeout(runner.readyTimeout)
        if (typeof onEvent === 'function') onEvent({ type: 'ready', port: detectedPort })
      }
    }
  }

  childProcess.stdout.on('data', handleOutputChunk)
  childProcess.stderr.on('data', handleOutputChunk)

  childProcess.on('error', (spawnError) => {
    clearTimeout(runner.readyTimeout)
    runnersByRoot.delete(projectRoot)
    if (typeof onEvent === 'function') onEvent({ type: 'error', message: spawnError.message })
  })

  childProcess.on('exit', (exitCode, signal) => {
    clearTimeout(runner.readyTimeout)
    const hadReadyPort = runner.port !== null
    runnersByRoot.delete(projectRoot)
    if (typeof onEvent === 'function') onEvent({ type: 'exited', exitCode, signal, hadReadyPort })
  })

  runner.readyTimeout = setTimeout(() => {
    if (typeof onEvent === 'function') {
      onEvent({
        type: 'error',
        message: 'No port detected from the dev server within ' + (readyPortTimeoutMilliseconds / 1000) + ' seconds. Check the log and try again.'
      })
    }
  }, readyPortTimeoutMilliseconds)

  return { state: 'starting' }
}

function stop(projectRoot) {
  const runner = runnersByRoot.get(projectRoot)
  if (runner) runner.stop()
}

function stopAll() {
  for (const runner of Array.from(runnersByRoot.values())) runner.stop()
}

function isRunning(projectRoot) {
  return runnersByRoot.has(projectRoot)
}

module.exports = { start, stop, stopAll, isRunning, parsePortFromOutputLine }
