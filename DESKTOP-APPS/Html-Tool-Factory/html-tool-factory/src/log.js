'use strict'

// Event bus plus append-only JSONL event log. Every important step lands in
// runs/<runId>/events.jsonl so a run can be inspected (and replayed) later,
// and is pushed to any connected dashboard through EventEmitter.

const fs = require('fs')
const path = require('path')
const EventEmitter = require('events')
const { ensureDir, nowIso } = require('./util')

class EventHub extends EventEmitter {
  constructor() {
    super()
    this.setMaxListeners(200)
    this.quiet = false
  }

  setQuiet(quietMode) {
    this.quiet = Boolean(quietMode)
  }

  publish(runDirectory, event) {
    const record = Object.assign({ at: nowIso() }, event)
    if (runDirectory) {
      try {
        ensureDir(runDirectory)
        fs.appendFileSync(path.join(runDirectory, 'events.jsonl'), JSON.stringify(record) + '\n', 'utf8')
      } catch (_writeError) {
        // Event logging must never break the pipeline.
      }
    }
    if (!this.quiet) {
      const prefix = '[' + record.at.slice(11, 19) + ']'
      const label = record.runId ? ' ' + record.runId : ''
      process.stdout.write(prefix + label + ' ' + (record.stage || 'system') + ': ' + (record.message || record.type) + '\n')
    }
    this.emit('event', record)
    return record
  }

  // Live model output goes to the connected dashboards only. It is never
  // appended to events.jsonl (a token by token log would flood the file) and
  // never printed, so watching the model costs nothing on disk.
  emitLive(record) {
    this.emit('event', Object.assign({ at: nowIso() }, record))
    return record
  }
}

const hub = new EventHub()

function readEvents(runDirectory, limit) {
  try {
    const filePath = path.join(runDirectory, 'events.jsonl')
    const rawText = fs.readFileSync(filePath, 'utf8')
    const lines = rawText.split('\n').filter(Boolean)
    const selected = limit ? lines.slice(-limit) : lines
    return selected.map((line) => {
      try {
        return JSON.parse(line)
      } catch (_parseError) {
        return { type: 'log', message: line }
      }
    })
  } catch (_readError) {
    return []
  }
}

function createStageLogger(run, stageId) {
  return function logEvent(type, message, extra) {
    return hub.publish(run.directory, Object.assign({
      runId: run.id,
      stage: stageId,
      type: type || 'log',
      message: message || ''
    }, extra || {}))
  }
}

module.exports = { hub, readEvents, createStageLogger }
