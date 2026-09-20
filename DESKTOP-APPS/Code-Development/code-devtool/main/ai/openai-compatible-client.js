// CodeDevTool - OpenAI-compatible streaming client
// Shared by the Copilot provider and the OpenAI-compatible provider: both
// speak the /v1/chat/completions streaming (SSE) protocol. Uses Node's
// native fetch, so no HTTP dependencies.

async function streamChat({ baseUrl, apiKey, model, messages, signal, onToken }) {
  const endpoint = baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({ model: model, messages: messages, stream: true }),
    signal: signal
  })

  if (!response.ok) throw await buildResponseError(response)

  if (!response.body) throw new Error('Streaming is not supported by this provider')

  const reader = response.body.getReader()
  const textDecoder = new TextDecoder()
  let lineBuffer = ''
  let fullText = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    lineBuffer += textDecoder.decode(value, { stream: true })
    const lines = lineBuffer.split('\n')
    lineBuffer = lines.pop() || ''
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine.startsWith('data:')) continue
      const dataText = trimmedLine.slice(5).trim()
      if (dataText === '[DONE]') continue
      try {
        const parsedChunk = JSON.parse(dataText)
        const deltaText = parsedChunk.choices && parsedChunk.choices[0] && parsedChunk.choices[0].delta && parsedChunk.choices[0].delta.content
        if (deltaText) {
          fullText += deltaText
          if (typeof onToken === 'function') onToken(deltaText)
        }
      } catch (_parseError) {
        // Ignore keep-alive or partial lines.
      }
    }
  }
  return fullText
}

async function listModels(baseUrl, apiKey) {
  const endpoint = baseUrl.replace(/\/+$/, '') + '/models'
  const response = await fetch(endpoint, {
    headers: { 'Authorization': 'Bearer ' + apiKey }
  })
  if (!response.ok) throw await buildResponseError(response)
  const data = await response.json()
  return Array.isArray(data.data) ? data.data.map((model) => model.id).sort() : []
}

async function chatOnce({ baseUrl, apiKey, model, messages, tools, signal }) {
  const endpoint = baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const requestBody = { model: model, messages: messages, stream: false }
  if (tools && tools.length) requestBody.tools = tools
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify(requestBody),
    signal: signal
  })
  if (!response.ok) throw await buildResponseError(response)
  const data = await response.json()
  const message = data.choices && data.choices[0] && data.choices[0].message
  if (!message) throw new Error('Provider returned no message')
  const toolCalls = (message.tool_calls || []).map((rawCall) => {
    let parsedArguments = {}
    try {
      parsedArguments = rawCall.function && rawCall.function.arguments ? JSON.parse(rawCall.function.arguments) : {}
    } catch (_parseError) {
      parsedArguments = {}
    }
    return {
      id: rawCall.id,
      name: rawCall.function && rawCall.function.name,
      arguments: parsedArguments,
      raw: rawCall
    }
  })
  return { content: message.content || '', toolCalls: toolCalls }
}

async function buildResponseError(response) {
  let errorMessage = 'HTTP ' + response.status
  try {
    const errorBody = await response.text()
    const parsedError = JSON.parse(errorBody)
    if (parsedError.error && parsedError.error.message) errorMessage = parsedError.error.message
  } catch (_parseError) {
    // Keep the HTTP status text when the body is not JSON.
  }
  return new Error(errorMessage)
}

module.exports = { streamChat, listModels, chatOnce }
