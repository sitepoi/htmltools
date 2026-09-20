// Unicon Studio - Unicon Gateway provider (CODE-29)
// Wires the Unicon gateway client to the settings service: base URL, the
// gateway provider/model pair, and the tenant hostname come from Settings.

const uniconGatewayClient = require('./unicon-gateway-client')
const aiSettings = require('./ai-settings')

function baseUrl() {
  return aiSettings.loadConfig().uniconBaseUrl || ''
}

function gatewayProvider() {
  return aiSettings.loadConfig().uniconProvider || 'deepseek'
}

function host() {
  return aiSettings.loadConfig().uniconHost || ''
}

function authMode() {
  return aiSettings.loadConfig().uniconAuthMode === 'jwt' ? 'jwt' : 'key'
}

function validateConfigured() {
  if (!baseUrl()) throw new Error('The gateway Base URL is not set - open Settings and enter it.')
}

function streamChat(options) {
  validateConfigured()
  return uniconGatewayClient.streamChat(Object.assign({}, options, {
    baseUrl: baseUrl(),
    host: host(),
    authMode: authMode(),
    gatewayProvider: gatewayProvider()
  }))
}

function chatOnce(options) {
  validateConfigured()
  return uniconGatewayClient.chatOnce(Object.assign({}, options, {
    baseUrl: baseUrl(),
    host: host(),
    authMode: authMode(),
    gatewayProvider: gatewayProvider()
  }))
}

function listModels(apiKey) {
  validateConfigured()
  // The gateway lists routable models per provider (CODE-35): the provider
  // goes in the query so the list matches what chat/agent can call.
  return uniconGatewayClient.listModels(baseUrl(), apiKey, host(), authMode(), gatewayProvider())
}

module.exports = { streamChat, chatOnce, listModels, baseUrl, gatewayProvider, host, authMode }
