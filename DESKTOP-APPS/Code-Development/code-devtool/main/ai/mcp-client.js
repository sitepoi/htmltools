// Unicon Studio - minimal MCP client (T-20)
// Talks to remote MCP servers over the streamable HTTP transport (JSON-RPC
// 2.0): initialize -> tools/list -> tools/call. Tools are converted to
// OpenAI-style function schemas so the agent can call them next to the
// built-in registry (tools.js).
//
// Verification finding (2026-09-19, GitHub docs): the public Copilot API
// does not inject MCP tools into chat requests; MCP support lives in the
// Copilot SDK and product surfaces. GitHub itself hosts an MCP server at
// https://api.githubcopilot.com/mcp/ - when a configured server points at
// api.githubcopilot.com, the stored Copilot token is attached automatically
// (custom headers are not stored in v1).

const maximumServers = 5
const maximumToolsPerServer = 30
const maximumTotalTools = 60
const connectTimeoutMilliseconds = 15000
const callTimeoutMilliseconds = 60000

function sanitizeServerName(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30)
}

function sanitizeToolName(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
}

class McpHttpClient {
  constructor(serverConfig, copilotToken) {
    this.name = serverConfig.name
    this.url = serverConfig.url
    this.copilotToken = copilotToken || ''
    this.sessionId = ''
    this.requestCounter = 0
  }

  buildHeaders() {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }
    if (this.copilotToken && isCopilotHost(this.url)) {
      headers.Authorization = 'Bearer ' + this.copilotToken
    }
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId
    return headers
  }

  async sendRequest(method, params, timeoutMilliseconds) {
    const requestId = ++this.requestCounter
    const abortController = new AbortController()
    const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMilliseconds)
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({ jsonrpc: '2.0', id: requestId, method: method, params: params || {} }),
        signal: abortController.signal
      })
      const sessionHeader = response.headers.get('mcp-session-id') || response.headers.get('Mcp-Session-Id')
      if (sessionHeader) this.sessionId = sessionHeader
      const rawBody = await response.text()
      if (!response.ok) {
        throw new Error('MCP server "' + this.name + '" returned HTTP ' + response.status + (rawBody ? ': ' + rawBody.slice(0, 200) : ''))
      }
      let payload = null
      try {
        payload = JSON.parse(rawBody)
      } catch (_parseError) {
        throw new Error('MCP server "' + this.name + '" returned invalid JSON')
      }
      if (payload && payload.error) {
        throw new Error('MCP server "' + this.name + '" error: ' + (payload.error.message || JSON.stringify(payload.error)))
      }
      return payload && payload.result !== undefined ? payload.result : payload
    } catch (sendError) {
      if (sendError && sendError.name === 'AbortError') {
        throw new Error('MCP server "' + this.name + '" timed out (' + method + ')')
      }
      throw sendError
    } finally {
      clearTimeout(timeoutHandle)
    }
  }

  async connect() {
    const result = await this.sendRequest('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'unicon-studio', version: '0.1.0' }
    }, connectTimeoutMilliseconds)
    // Some servers require a notifications/initialized message; it is
    // optional over streamable HTTP, so we only send it when the spec
    // version agrees.
    if (result && result.protocolVersion && !this.sessionId) {
      await this.sendRequest('notifications/initialized', {}, connectTimeoutMilliseconds)
    }
    return result
  }

  async listTools() {
    const result = await this.sendRequest('tools/list', {}, connectTimeoutMilliseconds)
    return result && Array.isArray(result.tools) ? result.tools : []
  }

  async callTool(toolName, argumentsObject) {
    const result = await this.sendRequest('tools/call', {
      name: toolName,
      arguments: argumentsObject || {}
    }, callTimeoutMilliseconds)
    const isError = Boolean(result && result.isError)
    const content = result && Array.isArray(result.content) ? result.content : []
    const textParts = content
      .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
    const text = textParts.join('\n').slice(0, 20000)
    if (isError) return { ok: false, error: text || 'MCP tool returned an error' }
    return { ok: true, result: text || JSON.stringify(content).slice(0, 20000) }
  }
}

function isCopilotHost(urlValue) {
  try {
    const parsed = new URL(urlValue)
    return parsed.hostname === 'api.githubcopilot.com'
  } catch (_urlError) {
    return false
  }
}

function normalizeServerConfigs(mcpConfig) {
  if (!mcpConfig || !mcpConfig.enabled) return []
  const servers = Array.isArray(mcpConfig.servers) ? mcpConfig.servers : []
  return servers
    .slice(0, maximumServers)
    .filter((server) => server && typeof server.url === 'string')
    .map((server) => ({
      name: sanitizeServerName(server.name || new URL(server.url).hostname),
      url: String(server.url)
    }))
    .filter((server) => {
      try {
        const parsed = new URL(server.url)
        return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      } catch (_urlError) {
        return false
      }
    })
}

function schemaNameFor(serverName, toolName) {
  return 'mcp_' + sanitizeServerName(serverName) + '_' + sanitizeToolName(toolName)
}

function toFunctionSchema(serverName, tool) {
  const schema = {
    type: 'function',
    function: {
      name: schemaNameFor(serverName, tool.name),
      description: '[MCP server "' + serverName + '"] ' + String(tool.description || '').slice(0, 800),
      parameters: tool.inputSchema && typeof tool.inputSchema === 'object'
        ? tool.inputSchema
        : { type: 'object', properties: {} }
    }
  }
  return schema
}

// Loads tools from all configured MCP servers. Never throws: server-level
// failures are reported in `notes` and the agent continues with what loaded.
async function buildExternalTools({ mcpConfig, copilotToken }) {
  const schemas = []
  const callers = new Map()
  const catalogLines = []
  const notes = []
  const servers = normalizeServerConfigs(mcpConfig)

  for (const server of servers) {
    let client
    try {
      client = new McpHttpClient(server, copilotToken)
      await client.connect()
      const tools = await client.listTools()
      if (tools.length === 0) {
        notes.push('MCP server "' + server.name + '" exposes no tools')
        continue
      }
      for (const tool of tools.slice(0, maximumToolsPerServer)) {
        if (!tool || typeof tool.name !== 'string') continue
        if (schemas.length >= maximumTotalTools) break
        const functionSchema = toFunctionSchema(server.name, tool)
        callers.set(functionSchema.function.name, {
          client: client,
          serverName: server.name,
          toolName: tool.name
        })
        schemas.push(functionSchema)
        catalogLines.push('- mcp_' + sanitizeServerName(server.name) + '_' + sanitizeToolName(tool.name) +
          ' (MCP server "' + server.name + '"): ' + String(tool.description || 'no description').slice(0, 120))
      }
    } catch (serverError) {
      notes.push('MCP server "' + server.name + '" failed: ' + serverError.message)
    }
  }

  return {
    schemas: schemas,
    callers: callers,
    catalogText: catalogLines.length ? '\nMCP tools (external servers):\n' + catalogLines.join('\n') : '',
    notes: notes
  }
}

async function callExternalTool(callerEntry, argumentsObject) {
  const client = callerEntry.client
  const result = await client.callTool(callerEntry.toolName, argumentsObject)
  return result
}

module.exports = {
  McpHttpClient,
  buildExternalTools,
  callExternalTool,
  normalizeServerConfigs,
  sanitizeServerName,
  sanitizeToolName,
  schemaNameFor,
  isCopilotHost
}
