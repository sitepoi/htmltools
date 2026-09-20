// Unicon Studio - AI settings service
// Keeps provider configuration as JSON under userData and API tokens ONLY
// in safeStorage (OS-encrypted, never plain text on disk). CODE-03/CODE-07.

const { app, safeStorage } = require('electron')
const fs = require('fs')
const path = require('path')

const configFileVersion = 1
const copilotTokenFileName = 'codedevtool-copilot-token.bin'
const openAiTokenFileName = 'codedevtool-openai-key.bin'

const defaultConfig = {
  version: configFileVersion,
  provider: 'copilot',
  copilotBaseUrl: 'https://api.githubcopilot.com',
  openAiBaseUrl: 'https://api.openai.com/v1',
  model: '',
  mcp: { enabled: false, servers: [] }
}

let cachedConfig = null

function getConfigFilePath() {
  return path.join(app.getPath('userData'), 'ai-config.json')
}

function tokenFileNameFor(providerName) {
  return providerName === 'openai' ? openAiTokenFileName : copilotTokenFileName
}

function loadConfig() {
  if (cachedConfig) return cachedConfig
  try {
    cachedConfig = Object.assign({}, defaultConfig, JSON.parse(fs.readFileSync(getConfigFilePath(), 'utf8')))
  } catch (_readError) {
    cachedConfig = Object.assign({}, defaultConfig)
  }
  return cachedConfig
}

function saveConfig(config) {
  cachedConfig = config
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(getConfigFilePath(), JSON.stringify(config, null, 2), 'utf8')
  } catch (_writeError) {
    // Best-effort persistence; the app keeps working with in-memory config.
  }
}

function updateConfig(patch) {
  const updatedConfig = Object.assign({}, loadConfig(), patch)
  saveConfig(updatedConfig)
  return updatedConfig
}

function setToken(providerName, token) {
  if (!safeStorage.isEncryptionAvailable()) return false
  try {
    const encryptedToken = safeStorage.encryptString(String(token))
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(path.join(app.getPath('userData'), tokenFileNameFor(providerName)), encryptedToken)
    return true
  } catch (_storageError) {
    return false
  }
}

function getToken(providerName) {
  if (!safeStorage.isEncryptionAvailable()) return ''
  try {
    const encryptedToken = fs.readFileSync(path.join(app.getPath('userData'), tokenFileNameFor(providerName)))
    return safeStorage.decryptString(encryptedToken)
  } catch (_readError) {
    return ''
  }
}

function clearToken(providerName) {
  try {
    fs.unlinkSync(path.join(app.getPath('userData'), tokenFileNameFor(providerName)))
  } catch (_unlinkError) {
    // Nothing to clear.
  }
}

// Validates the MCP part of a config patch from the renderer. Server URLs
// must be http(s); names are sanitized; no headers are accepted in v1
// (the Copilot token is attached automatically for api.githubcopilot.com).
function sanitizeMcpPatch(mcpPatch) {
  if (!mcpPatch || typeof mcpPatch !== 'object') return null
  const sanitized = { enabled: Boolean(mcpPatch.enabled) }
  const incomingServers = Array.isArray(mcpPatch.servers) ? mcpPatch.servers : []
  const servers = []
  for (const server of incomingServers.slice(0, 5)) {
    if (!server || typeof server.url !== 'string') continue
    const trimmedUrl = server.url.trim()
    let parsedUrl = null
    try {
      parsedUrl = new URL(trimmedUrl)
    } catch (_urlError) {
      continue
    }
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') continue
    const rawName = typeof server.name === 'string' && server.name.trim() ? server.name.trim() : parsedUrl.hostname
    servers.push({ name: rawName.slice(0, 40), url: trimmedUrl })
  }
  sanitized.servers = servers
  return sanitized
}

function getPublicConfig() {
  const config = loadConfig()
  const mcpConfig = config.mcp && typeof config.mcp === 'object' ? config.mcp : { enabled: false, servers: [] }
  return {
    provider: config.provider,
    copilotBaseUrl: config.copilotBaseUrl,
    openAiBaseUrl: config.openAiBaseUrl,
    model: config.model,
    mcp: {
      enabled: Boolean(mcpConfig.enabled),
      servers: (Array.isArray(mcpConfig.servers) ? mcpConfig.servers : []).map((server) => ({
        name: server && typeof server.name === 'string' ? server.name : '',
        url: server && typeof server.url === 'string' ? server.url : ''
      }))
    },
    copilotHasToken: getToken('copilot') !== '',
    openAiHasToken: getToken('openai') !== '',
    safeStorageAvailable: safeStorage.isEncryptionAvailable()
  }
}

module.exports = { loadConfig, updateConfig, setToken, getToken, clearToken, getPublicConfig, sanitizeMcpPatch }
