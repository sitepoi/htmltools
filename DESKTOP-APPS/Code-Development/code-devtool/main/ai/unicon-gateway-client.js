// Unicon Studio - Unicon Gateway client (CODE-29, CODE-30)
// Talks to the Unicon AI gateway protocol (as integrated in sitepoicms):
// custom routes /v1/chat/stream (SSE) and /v1/chat/complete, provider +
// model passed IN THE BODY, tenant attribution, and two auth modes:
// API-key (dual headers) or JWT (the shared secret signs a short-lived
// HS256 token per request - payload {sub, iat, exp, scope: "chat-stream"}).

const crypto = require('crypto')

const jwtLifetimeSeconds = 300

function signJwt(secret, tenantHostname) {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const encodePart = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const header = encodePart({ alg: 'HS256', typ: 'JWT' })
  const payload = encodePart({
    sub: tenantHostname,
    iat: nowSeconds,
    exp: nowSeconds + jwtLifetimeSeconds,
    scope: 'chat-stream'
  })
  const signature = crypto.createHmac('sha256', String(secret)).update(header + '.' + payload).digest('base64url')
  return header + '.' + payload + '.' + signature
}

async function buildHeaders(apiKey, host, authMode) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Unicon-Source': 'unicon-studio'
  }
  if (authMode === 'jwt') {
    // JWT mode: the gateway verifies the signature with the same shared
    // secret and maps the tenant (sub) to its internal API key.
    if (!apiKey) throw new Error('The JWT secret is not saved - open Settings, save the secret in the Token field.')
    if (!host) throw new Error('The tenant hostname is required for JWT mode - set it in Settings.')
    headers.Authorization = 'Bearer ' + signJwt(apiKey, host)
  } else if (apiKey) {
    headers.Authorization = 'Bearer ' + apiKey
    headers['X-Api-Key'] = apiKey
  }
  if (host) headers['X-Unicon-Host'] = host
  return headers
}

function extractTokenText(payload) {
  if (payload === null || payload === undefined) return ''
  if (typeof payload === 'string') return payload
  if (typeof payload === 'object') {
    const nested = payload.choices && payload.choices[0] && payload.choices[0].delta && payload.choices[0].delta.content
    return String(payload.chunk || payload.content || payload.text || payload.delta || payload.message || nested || '')
  }
  return ''
}

async function streamChat({ baseUrl, apiKey, host, authMode, gatewayProvider, model, messages, signal, onToken }) {
  const endpoint = String(baseUrl).replace(/\/+$/, '') + '/v1/chat/stream'
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: Object.assign({ Accept: 'text/event-stream' }, await buildHeaders(apiKey, host, authMode)),
    body: JSON.stringify({
      messages: messages,
      provider: gatewayProvider,
      model: model,
      stream: true
    }),
    signal: signal
  })
  if (!response.ok) throw await buildResponseError(response)
  if (!response.body) throw new Error('Streaming is not supported by this provider')

  const reader = response.body.getReader()
  const textDecoder = new TextDecoder()
  let lineBuffer = ''
  let eventName = ''
  let fullText = ''

  const handleEvent = (name, dataText) => {
    if (name === 'error') {
      let errorMessage = 'Gateway stream error'
      try {
        const parsed = JSON.parse(dataText)
        errorMessage = parsed.message || parsed.error || errorMessage
      } catch (_parseError) {
        errorMessage = dataText || errorMessage
      }
      throw new Error(errorMessage)
    }
    if (name === 'result' || name === 'done') {
      // Final payload: when no incremental tokens arrived, the full text
      // lives in the message field.
      if (!fullText) {
        try {
          const parsed = JSON.parse(dataText)
          const finalText = typeof parsed === 'string' ? parsed : (parsed.message || parsed.text || parsed.content || '')
          fullText = String(finalText)
        } catch (_parseError) {
          // Tokens already built the text; nothing more to do.
        }
      }
      return
    }
    if (name === 'delta' || name === 'token' || name === 'chunk' || name === 'message' || name === '') {
      let tokenText = ''
      try {
        tokenText = extractTokenText(JSON.parse(dataText))
      } catch (_parseError) {
        // A bare text line (no JSON) is treated as a raw token.
        tokenText = dataText
      }
      if (tokenText) {
        fullText += tokenText
        if (typeof onToken === 'function') onToken(tokenText)
      }
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    lineBuffer += textDecoder.decode(value, { stream: true })
    const lines = lineBuffer.split('\n')
    lineBuffer = lines.pop() || ''
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue
      if (trimmedLine.startsWith('event:')) {
        eventName = trimmedLine.slice(6).trim()
        continue
      }
      if (!trimmedLine.startsWith('data:')) continue
      const dataText = trimmedLine.slice(5).trim()
      handleEvent(eventName, dataText)
      eventName = ''
    }
  }
  return fullText
}

async function chatOnce({ baseUrl, apiKey, host, authMode, gatewayProvider, model, messages, signal }) {
  const endpoint = String(baseUrl).replace(/\/+$/, '') + '/v1/chat/complete'
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: await buildHeaders(apiKey, host, authMode),
    body: JSON.stringify({
      messages: messages,
      provider: gatewayProvider,
      model: model
    }),
    signal: signal
  })
  if (!response.ok) throw await buildResponseError(response)
  const data = await response.json()
  const message = data.message || data.content || data.text ||
    (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
  if (typeof message !== 'string') throw new Error('Gateway returned no message')
  // The gateway uses prompt-based tool calling; native tool_calls are
  // never expected here (the agent parses toolCalls from the text itself).
  return { content: message, toolCalls: [] }
}

function collectModels(data, queryProvider) {
  const found = []
  const pushItem = (item, providerKey) => {
    if (typeof item === 'string' && item) {
      found.push(providerKey && providerKey !== queryProvider ? providerKey + '/' + item : item)
      return
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      // CODE-35: models can carry a routable flag - only routable models
      // can actually be called, so non-routable ones are hidden.
      if (item.routable === false) return
      const modelName = item.model || item.id || item.name
      if (modelName) {
        const providerName = item.provider || providerKey || ''
        // A provider-scoped query (e.g. ?provider=deepseek) lists that
        // provider's ids directly - the model field wants the bare id.
        found.push(providerName && providerName !== queryProvider ? providerName + '/' + modelName : modelName)
      }
    } else if (Array.isArray(item)) {
      item.forEach((subItem) => pushItem(subItem, providerKey))
    }
  }
  if (Array.isArray(data)) {
    data.forEach((item) => pushItem(item, ''))
  } else if (data && typeof data === 'object') {
    const flatContainer = Array.isArray(data.models) ? data.models : (Array.isArray(data.data) ? data.data : null)
    if (flatContainer) {
      flatContainer.forEach((item) => pushItem(item, ''))
    } else {
      // Grouped shape: {"models": {"deepseek": ["deepseek-v4-pro"], ...}} or
      // {"data": {...}} - container keys are provider names.
      const grouped = data.models || data.data
      if (grouped && typeof grouped === 'object' && !Array.isArray(grouped)) {
        Object.keys(grouped).forEach((providerName) => pushItem(grouped[providerName], providerName))
      }
    }
  }
  return found.filter((value, index) => found.indexOf(value) === index).sort()
}

async function listModels(baseUrl, apiKey, host, authMode, provider) {
  // The gateway hint for UNSUPPORTED_MODEL says to query the provider's
  // routable models: GET /v1/models?provider=<provider>.
  const endpoint = String(baseUrl).replace(/\/+$/, '') + '/v1/models' + (provider ? '?provider=' + encodeURIComponent(provider) : '')
  const response = await fetch(endpoint, {
    headers: await buildHeaders(apiKey, host, authMode)
  })
  if (!response.ok) throw await buildResponseError(response)
  const data = await response.json()
  const rawModels = collectModels(data, provider)
  if (rawModels.length === 0) {
    throw new Error('No models recognized in the gateway response: ' + JSON.stringify(data).slice(0, 300))
  }
  return rawModels
}

async function buildResponseError(response) {
  let errorMessage = 'Gateway HTTP ' + response.status
  let responseBody = ''
  let parsedError = null
  try {
    responseBody = await response.text()
    parsedError = JSON.parse(responseBody)
    if (parsedError.error && parsedError.error.message) errorMessage = parsedError.error.message
    else if (parsedError.message) errorMessage = parsedError.message
  } catch (_parseError) {
    // Keep the HTTP status text when the body is not JSON.
  }
  // CODE-35: the gateway errors carry the actionable parts - details,
  // hint, and the supportedModels list - surface them in the message
  // instead of burying them in a truncated body snippet.
  const gatewayError = parsedError && (parsedError.error || parsedError)
  const diagnosticParts = []
  if (gatewayError && gatewayError.details) diagnosticParts.push('details: ' + gatewayError.details)
  if (gatewayError && gatewayError.hint) diagnosticParts.push('hint: ' + gatewayError.hint)
  if (gatewayError && gatewayError.supportedModels !== undefined) {
    diagnosticParts.push('supportedModels: ' + JSON.stringify(gatewayError.supportedModels).slice(0, 300))
  }
  if (diagnosticParts.length) errorMessage = errorMessage + ' [' + diagnosticParts.join('; ') + ']'
  const detailSnippet = String(responseBody).replace(/\s+/g, ' ').slice(0, 800)
  if (detailSnippet) errorMessage = errorMessage + ' (response: ' + detailSnippet + ')'
  return new Error(errorMessage)
}

module.exports = { streamChat, chatOnce, listModels, buildHeaders, extractTokenText, signJwt, collectModels }
