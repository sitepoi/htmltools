'use strict'

// Provider-neutral chat client with:
//   - per-run budget accounting (calls and characters)
//   - request timeout and bounded retries for transient failures
//   - a deterministic mock provider for dry runs and self tests

const { describeProvider } = require('../config')
const { sleep, estimateTokens } = require('../util')
const live = require('../live')
const { StringDecoder } = require('string_decoder')
const { buildMockResponse } = require('./mock')

class BudgetExceededError extends Error {
  constructor(message) {
    super(message)
    this.name = 'BudgetExceededError'
    this.code = 'BUDGET_EXCEEDED'
  }
}

class AiCallError extends Error {
  constructor(message, details) {
    super(message)
    this.name = 'AiCallError'
    this.code = 'AI_CALL_FAILED'
    this.details = details || null
  }
}

const TRANSIENT_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529])

// How long to wait for one answer. A large prompt and a retry both need more
// room than a fixed three minutes, and a silent abort looks like a dead tool.
function computeTimeout(inputChars, attempt, baseMs, ceilingMs) {
  const base = Math.max(30000, Number(baseMs) || 180000)
  const ceiling = Math.max(base, Number(ceilingMs) || 600000)
  const scaled = base + Math.round((Number(inputChars) || 0) * 6)
  const escalated = Math.round(scaled * (1 + 0.5 * Math.max(0, (Number(attempt) || 1) - 1)))
  return Math.min(ceiling, Math.max(base, escalated))
}

function extractGatewayText(data) {
  if (typeof data === 'string') return data
  const value = data || {}
  const candidates = [
    value.outputText,
    value.output_text,
    value.text,
    value.answer,
    value.message,
    value.content,
    value.choices && value.choices[0] && value.choices[0].message && value.choices[0].message.content,
    value.result && value.result.assistant && value.result.assistant.markdown,
    value.result && value.result.message,
    value.result && value.result.choices && value.result.choices[0] && value.result.choices[0].message &&
      value.result.choices[0].message.content
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) return candidate
  }
  return ''
}

// A watchdog that is re-armed on every chunk: while the model keeps talking the
// call is alive, and only a silent connection is aborted.
function createStallSignal(timeoutMs) {
  const controller = new AbortController()
  let timer = null
  const arm = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 180000))
    if (timer && typeof timer.unref === 'function') timer.unref()
  }
  arm()
  return {
    signal: controller.signal,
    touch: arm,
    clear: () => {
      if (timer) clearTimeout(timer)
      timer = null
    }
  }
}

// Reads an OpenAI compatible "text/event-stream" answer and returns the whole
// text, calling onDelta for every piece as it arrives.
async function readServerSentEvents(response, onDelta, watchdog, onUsage) {
  const decoder = new StringDecoder('utf8')
  const collector = createPieceCollector(onDelta)
  let buffer = ''
  const consume = (line) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) return
    const payload = trimmed.slice(5).trim()
    if (!payload || payload === '[DONE]') return
    let parsed = null
    try {
      parsed = JSON.parse(payload)
    } catch (_parseError) {
      // keep-alive comments and vendor noise are not an error
      return
    }
    // With stream_options the last frames carry the real token counts.
    if (parsed.usage && onUsage) onUsage(parsed.usage)
    const choice = (parsed.choices && parsed.choices[0]) || {}
    const piece = (choice.delta && choice.delta.content) ||
      (choice.message && choice.message.content) || ''
    if (piece) collector.push(piece)
  }
  const reader = response.body.getReader()
  try {
    for (;;) {
      const step = await reader.read()
      if (step.done) break
      if (watchdog) watchdog.touch()
      buffer += decoder.write(Buffer.from(step.value))
      let boundary = buffer.indexOf('\n')
      while (boundary !== -1) {
        consume(buffer.slice(0, boundary))
        buffer = buffer.slice(boundary + 1)
        boundary = buffer.indexOf('\n')
      }
    }
    buffer += decoder.end()
    if (buffer.trim()) consume(buffer)
  } finally {
    try { reader.releaseLock() } catch (_releaseError) { /* ignore */ }
  }
  return collector.result()
}

// Ollama answers one JSON object per line.
async function readJsonLines(response, onDelta, watchdog, onUsage) {
  const decoder = new StringDecoder('utf8')
  const collector = createPieceCollector(onDelta)
  let buffer = ''
  const consume = (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let parsed = null
    try {
      parsed = JSON.parse(trimmed)
    } catch (_parseError) {
      return
    }
    // Ollama reports its own token counters on the last line.
    if (onUsage && (parsed.prompt_eval_count || parsed.eval_count)) {
      onUsage({ prompt_tokens: parsed.prompt_eval_count, completion_tokens: parsed.eval_count })
    }
    const piece = (parsed.message && parsed.message.content) || parsed.response || ''
    if (piece) collector.push(piece)
  }
  const reader = response.body.getReader()
  try {
    for (;;) {
      const step = await reader.read()
      if (step.done) break
      if (watchdog) watchdog.touch()
      buffer += decoder.write(Buffer.from(step.value))
      let boundary = buffer.indexOf('\n')
      while (boundary !== -1) {
        consume(buffer.slice(0, boundary))
        buffer = buffer.slice(boundary + 1)
        boundary = buffer.indexOf('\n')
      }
    }
    buffer += decoder.end()
    if (buffer.trim()) consume(buffer)
  } finally {
    try { reader.releaseLock() } catch (_releaseError) { /* ignore */ }
  }
  return collector.result()
}

function createPieceCollector(onDelta) {
  let text = ''
  return {
    push: (piece) => {
      const value = String(piece == null ? '' : piece)
      if (!value) return
      text += value
      if (onDelta) {
        try {
          onDelta(value)
        } catch (_deltaError) {
          // watching the model must never break the call
        }
      }
    },
    result: () => text
  }
}

function createAiClient(options) {
  const config = options.config
  const run = options.run
  const logEvent = options.logEvent || function noop() {}
  const providerInfo = describeProvider(config)
  const limits = config.limits

  function assertBudget(estimatedInputChars) {
    const callBudget = Number(limits.maxAiCallsPerRun) || 0
    const charBudget = Number(limits.maxTotalCharsPerRun) || 0
    if (callBudget > 0 && run.counters.aiCalls >= callBudget) {
      throw new BudgetExceededError('AI call budget reached (' + run.counters.aiCalls + ' of ' + callBudget +
        ' calls). Raise "maxAiCallsPerRun" in the settings or start a new run.')
    }
    if (charBudget > 0 && (run.counters.inputChars + run.counters.outputChars + estimatedInputChars) > charBudget) {
      throw new BudgetExceededError('Character budget reached (' + (run.counters.inputChars + run.counters.outputChars) +
        ' of ' + charBudget + ' characters). Raise "maxTotalCharsPerRun" in the settings.')
    }
  }

  function recordUsage(inputChars, outputChars) {
    run.counters.aiCalls += 1
    run.counters.inputChars += inputChars
    run.counters.outputChars += outputChars
  }

  // The token counts the provider itself reported. They are the only real
  // numbers available, so they are kept next to the character estimate instead
  // of replacing it: a provider may report nothing at all.
  function recordProviderUsage(usage) {
    if (!usage) return 0
    const prompt = Number(usage.prompt_tokens || usage.input_tokens) || 0
    const completion = Number(usage.completion_tokens || usage.output_tokens) || 0
    const total = Number(usage.total_tokens) || (prompt + completion)
    if (!total) return 0
    run.counters.apiPromptTokens = (Number(run.counters.apiPromptTokens) || 0) + prompt
    run.counters.apiCompletionTokens = (Number(run.counters.apiCompletionTokens) || 0) + completion
    return total
  }

  async function callUniconGateway(systemPrompt, userPrompt, modelName, timeoutMs) {
    const baseUrl = String(config.uniconGateway.baseUrl || '').replace(/\/+$/, '')
    if (!baseUrl) throw new AiCallError('The Unicon Gateway base URL is empty. Open Settings and fill it in.')
    const headers = {
      'Content-Type': 'application/json',
      'X-Unicon-Source': 'html-tool-factory'
    }
    const apiKey = config.uniconGateway.apiKey
    if (apiKey) {
      headers['X-Api-Key'] = apiKey
      headers.Authorization = 'Bearer ' + apiKey
    }
    if (config.uniconGateway.tenantHost) headers['X-Unicon-Host'] = config.uniconGateway.tenantHost
    const body = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      provider: config.uniconGateway.defaultProvider,
      model: modelName || config.uniconGateway.model
    }
    const response = await fetch(baseUrl + '/v1/chat/complete', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: createTimeoutSignal(timeoutMs)
    })
    if (!response.ok) throw await buildHttpError('Unicon Gateway', response)
    const data = await response.json()
    const text = extractGatewayText(data)
    if (!text) throw new AiCallError('The Unicon Gateway answered without text. Response keys: ' +
      Object.keys(data || {}).join(', ').slice(0, 200))
    return text
  }

  async function callOpenAiCompatible(systemPrompt, userPrompt, modelName, timeoutMs, onDelta, onUsage) {
    const baseUrl = String(config.openaiCompatible.baseUrl || '').replace(/\/+$/, '')
    if (!baseUrl) throw new AiCallError('The OpenAI compatible base URL is empty. Open Settings and fill it in.')
    const model = modelName || config.openaiCompatible.model
    if (!model) throw new AiCallError('No model name set for the OpenAI compatible provider.')
    const headers = { 'Content-Type': 'application/json' }
    if (config.openaiCompatible.apiKey) headers.Authorization = 'Bearer ' + config.openaiCompatible.apiKey
    const streaming = Boolean(onDelta)
    // Asking for the usage of a streamed answer is what turns the estimate into
    // a real number. A provider that does not accept the flag is retried once
    // without it instead of failing the call.
    const wantUsage = streaming && Boolean(onUsage) && !(config.stream && config.stream.includeUsage === false)

    async function attempt(withUsage) {
      const body = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2
      }
      if (streaming) body.stream = true
      if (streaming && withUsage) body.stream_options = { include_usage: true }
      // While the answer is streaming the timeout is an idle timeout: a call
      // that keeps producing text is alive, a silent one is aborted.
      const watchdog = createStallSignal(timeoutMs)
      try {
        const response = await fetch(baseUrl + '/chat/completions', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: watchdog.signal
        })
        if (!response.ok) {
          const error = await buildHttpError('AI endpoint', response)
          error.streamOptionsRejected = Boolean(withUsage) && error.status === 400 &&
            /stream_options|include_usage/i.test(String(error.message || ''))
          throw error
        }
        const contentType = String(response.headers.get('content-type') || '')
        if (!streaming || !/event-stream/i.test(contentType)) {
          // A provider that ignores "stream" still answers with one JSON body.
          const data = await response.json()
          const text = data && data.choices && data.choices[0] && data.choices[0].message &&
            data.choices[0].message.content
          if (!text) throw new AiCallError('The AI endpoint answered without message content.')
          if (onUsage && data && data.usage) onUsage(data.usage)
          if (onDelta) onDelta(String(text))
          return String(text)
        }
        return await readServerSentEvents(response, onDelta, watchdog, onUsage)
      } finally {
        watchdog.clear()
      }
    }

    try {
      return await attempt(wantUsage)
    } catch (error) {
      if (!error || !error.streamOptionsRejected) throw error
      // The endpoint rejected stream_options: ask again the plain way.
      return attempt(false)
    }
  }

  async function callOllama(systemPrompt, userPrompt, modelName, timeoutMs, onDelta, onUsage) {
    const host = String(config.ollama.host || '').replace(/\/+$/, '')
    if (!host) throw new AiCallError('The Ollama host is empty. Open Settings and fill it in.')
    const streaming = Boolean(onDelta)
    const watchdog = createStallSignal(timeoutMs)
    try {
      const response = await fetch(host + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName || config.ollama.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: streaming
        }),
        signal: watchdog.signal
      })
      if (!response.ok) throw await buildHttpError('Ollama', response)
      if (!streaming) {
        const data = await response.json()
        const text = data && data.message && data.message.content
        if (!text) throw new AiCallError('Ollama answered without message content.')
        if (onUsage && (data.prompt_eval_count || data.eval_count)) {
          onUsage({ prompt_tokens: data.prompt_eval_count, completion_tokens: data.eval_count })
        }
        return String(text)
      }
      return await readJsonLines(response, onDelta, watchdog, onUsage)
    } finally {
      watchdog.clear()
    }
  }

  function timeoutForChars(inputChars, attempt) {
    return computeTimeout(inputChars, attempt, limits.requestTimeoutMs, limits.maxRequestTimeoutMs)
  }

  function createTimeoutSignal(timeoutMs) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    // Do not keep the process alive just for the timer.
    if (timer && typeof timer.unref === 'function') timer.unref()
    return controller.signal
  }

  async function buildHttpError(label, response) {
    let bodyText = ''
    try {
      bodyText = await response.text()
    } catch (_readError) {
      bodyText = ''
    }
    let detail = bodyText.slice(0, 400)
    try {
      const parsed = JSON.parse(bodyText)
      detail = (parsed.error && (parsed.error.message || parsed.error)) || parsed.message || parsed.details || detail
      if (typeof detail === 'object') detail = JSON.stringify(detail)
    } catch (_parseError) {
      // keep the raw text
    }
    const error = new AiCallError(label + ' returned HTTP ' + response.status + ': ' + String(detail).slice(0, 400))
    error.status = response.status
    return error
  }

  async function chat(request) {
    const systemPrompt = String(request.system || '')
    const userPrompt = String(request.user || '')
    const stage = request.stage || 'ai'
    const modelName = request.model || ''
    const estimatedInputChars = systemPrompt.length + userPrompt.length
    // Watching the model write is the default; turning it off falls back to one
    // request per answer with no live text in the dashboard.
    const streaming = !(config.stream && config.stream.enabled === false)

    assertBudget(estimatedInputChars)

    const provider = request.forceMock
      ? 'mock'
      : String((run.options && run.options.provider) || config.provider)
    if (provider === 'mock') {
      const text = JSON.stringify(buildMockResponse(userPrompt), null, 2)
      recordUsage(estimatedInputChars, text.length)
      live.publishAnswer(run.id, {
        stage,
        provider: 'mock',
        model: 'mock',
        inputChars: estimatedInputChars,
        text
      })
      logEvent('ai', 'Mock answer for ' + stage + ' (' + estimateTokens(estimatedInputChars + text.length) +
        ' est. tokens)', { stage })
      return { text, provider: 'mock', model: 'mock' }
    }

    let lastError = null
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const timeoutMs = timeoutForChars(estimatedInputChars, attempt)
      const callId = live.begin(run.id, {
        stage,
        provider,
        model: modelName || 'default',
        attempt,
        inputChars: estimatedInputChars
      })
      const onDelta = streaming ? (piece) => live.delta(run.id, callId, piece) : null
      let reportedUsage = null
      const onUsage = (usage) => { reportedUsage = usage }
      try {
        let text
        if (provider === 'unicon-gateway') text = await callUniconGateway(systemPrompt, userPrompt, modelName, timeoutMs)
        else if (provider === 'openai-compatible') {
          text = await callOpenAiCompatible(systemPrompt, userPrompt, modelName, timeoutMs, onDelta, onUsage)
        } else text = await callOllama(systemPrompt, userPrompt, modelName, timeoutMs, onDelta, onUsage)
        // The gateway answers in one piece, so the live view gets it at the end.
        if (onDelta && provider === 'unicon-gateway') onDelta(text)
        live.end(run.id, callId, { ok: true, text })
        recordUsage(estimatedInputChars, text.length)
        const realTokens = recordProviderUsage(reportedUsage)
        logEvent('ai', providerInfo.label + ' answered ' + stage + ' (attempt ' + attempt + ', ' +
          (realTokens ? realTokens + ' tokens reported' : '~' +
            estimateTokens(estimatedInputChars + text.length) + ' tokens estimated') + ')', { stage })
        return { text, provider, model: modelName || 'default', tokens: realTokens }
      } catch (error) {
        live.end(run.id, callId, { ok: false, error: String((error && error.message) || error) })
        lastError = error
        const status = error && error.status
        const aborted = Boolean(error && (error.name === 'AbortError' || error.code === 'ABORT_ERR'))
        const isTransient = !status || TRANSIENT_STATUS.has(status) || aborted
        if (aborted) {
          // Say exactly what happened: a silent abort looks like a dead tool.
          logEvent('warn', 'The model did not answer within ' + Math.round(timeoutMs / 1000) +
            's (' + estimatedInputChars + ' characters in, attempt ' + attempt + ' of 3). ' +
            'The next attempt gets a longer timeout. If this repeats, lower agentic.inlineFileChars ' +
            'or raise limits.requestTimeoutMs.', { stage })
          error.message = 'The model did not answer within ' + Math.round(timeoutMs / 1000) + 's'
        }
        if (!isTransient || attempt === 3) break
        live.note(run.id, 'Attempt ' + attempt + ' failed, retrying in ' + (attempt * 2000) + ' ms: ' +
          String((error && error.message) || error).slice(0, 200))
        logEvent('warn', 'AI call failed (' + (error.message || error) + '), retrying in ' +
          (attempt * 2000) + ' ms', { stage })
        await sleep(attempt * 2000)
      }
    }
    throw lastError || new AiCallError('The AI call failed for an unknown reason.')
  }

  return {
    chat,
    provider: config.provider,
    providerInfo,
    estimateTokens
  }
}

module.exports = {
  createAiClient,
  BudgetExceededError,
  AiCallError,
  extractGatewayText,
  computeTimeout,
  createStallSignal,
  readServerSentEvents,
  readJsonLines
}
