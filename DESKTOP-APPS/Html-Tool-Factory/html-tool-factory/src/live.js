'use strict'

// The live view of the model conversation.
//
// A run holds one "current" call while the model writes, plus a short history of
// the calls that already finished. Everything lives in memory: the dashboard
// reads it through the event stream (incremental deltas) and through the run
// payload (a snapshot after a page reload). Nothing here is written to disk, so
// watching the model never grows the run folder.

const { hub } = require('./log')
const { nowIso } = require('./util')

// One answer is capped so a runaway model cannot grow the process memory.
const TEXT_CAP = 200000
const HISTORY_ENTRIES = 12
const HISTORY_TEXT_CAP = 40000
// What a page reload gets back: the tail of the answer is what a human reads.
const SNAPSHOT_TEXT_CAP = 8000

const runs = new Map()

function entryFor(runId) {
  let entry = runs.get(runId)
  if (!entry) {
    entry = { seq: 0, current: null, history: [] }
    runs.set(runId, entry)
  }
  return entry
}

function publish(runId, payload) {
  if (!runId) return
  hub.emitLive(Object.assign({ runId, stage: 'ai' }, payload))
}

// Starts one call. The returned id tags every delta of that call, so a retry or
// a second stage can never append into the wrong answer.
function begin(runId, info) {
  if (!runId) return ''
  const entry = entryFor(runId)
  entry.seq += 1
  const callId = 'c' + entry.seq
  const details = info || {}
  entry.current = {
    callId,
    stage: details.stage || 'ai',
    model: details.model || '',
    provider: details.provider || '',
    attempt: Number(details.attempt) || 1,
    inputChars: Number(details.inputChars) || 0,
    startedAt: nowIso(),
    startedAtMs: Date.now(),
    chars: 0,
    state: 'thinking',
    text: ''
  }
  publish(runId, {
    type: 'live',
    callId,
    state: 'thinking',
    stage: entry.current.stage,
    model: entry.current.model,
    provider: entry.current.provider,
    attempt: entry.current.attempt,
    chars: 0,
    text: ''
  })
  return callId
}

function delta(runId, callId, piece) {
  const entry = runs.get(runId)
  if (!entry || !entry.current) return
  const current = entry.current
  if (callId && current.callId !== callId) return
  const text = String(piece == null ? '' : piece)
  if (!text) return
  const room = TEXT_CAP - current.text.length
  if (room <= 0) return
  const kept = text.length > room ? text.slice(0, room) : text
  current.text += kept
  current.chars = current.text.length
  current.state = 'streaming'
  publish(runId, {
    type: 'live-delta',
    callId: current.callId,
    stage: current.stage,
    delta: kept,
    chars: current.chars
  })
}

// Closes the call: on success the answer moves into the history so the operator
// can still read it after the stage finished, on failure the reason is kept.
function end(runId, callId, result) {
  const entry = runs.get(runId)
  if (!entry) return
  const current = entry.current
  if (!current || (callId && current.callId !== callId)) return
  const outcome = result || {}
  const text = typeof outcome.text === 'string' ? outcome.text : current.text
  const state = outcome.ok ? 'done' : 'error'
  const elapsedMs = Date.now() - current.startedAtMs
  const finished = {
    callId: current.callId,
    stage: current.stage,
    model: current.model,
    provider: current.provider,
    attempt: current.attempt,
    state,
    chars: text.length,
    elapsedMs,
    at: nowIso(),
    text: text.length > HISTORY_TEXT_CAP ? text.slice(0, HISTORY_TEXT_CAP) : text,
    error: outcome.ok ? '' : String(outcome.error || '')
  }
  entry.history.unshift(finished)
  if (entry.history.length > HISTORY_ENTRIES) entry.history.length = HISTORY_ENTRIES
  entry.current = null
  publish(runId, {
    type: 'live',
    callId: finished.callId,
    state,
    stage: finished.stage,
    model: finished.model,
    chars: finished.chars,
    elapsedMs,
    error: finished.error,
    text: text.length > SNAPSHOT_TEXT_CAP ? text.slice(text.length - SNAPSHOT_TEXT_CAP) : text
  })
}

// A whole answer at once (the mock provider, or a provider with no streaming).
function publishAnswer(runId, info) {
  const callId = begin(runId, info)
  const text = String((info && info.text) || '')
  if (callId) {
    delta(runId, callId, text)
    end(runId, callId, { ok: true, text })
  }
  return callId
}

// A note inside the live view: "retrying in 2 s", "the batch was reverted".
// It is attached to the current call so the operator sees it in place.
function note(runId, message) {
  if (!runId) return
  publish(runId, { type: 'live-note', message: String(message || '') })
}

function snapshot(runId, options) {
  const settings = options || {}
  const textCap = Number(settings.textChars) || SNAPSHOT_TEXT_CAP
  const entry = runs.get(runId)
  if (!entry) return { current: null, history: [] }
  const current = entry.current
    ? {
      callId: entry.current.callId,
      stage: entry.current.stage,
      model: entry.current.model,
      provider: entry.current.provider,
      attempt: entry.current.attempt,
      state: entry.current.state,
      chars: entry.current.chars,
      startedAt: entry.current.startedAt,
      elapsedMs: Date.now() - entry.current.startedAtMs,
      text: entry.current.text.length > textCap
        ? entry.current.text.slice(entry.current.text.length - textCap)
        : entry.current.text
    }
    : null
  return {
    current,
    history: entry.history.map((call) => Object.assign({}, call, {
      text: call.text.length > textCap ? call.text.slice(call.text.length - textCap) : call.text
    }))
  }
}

function clear(runId) {
  runs.delete(runId)
}

module.exports = { begin, delta, end, publishAnswer, note, snapshot, clear }
