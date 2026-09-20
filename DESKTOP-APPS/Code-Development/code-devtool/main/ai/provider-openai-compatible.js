// CodeDevTool - OpenAI-compatible provider
// Fallback provider (CODE-03): any endpoint that speaks the
// /v1/chat/completions protocol, configured in Settings.

const openAiCompatibleClient = require('./openai-compatible-client')
const aiSettings = require('./ai-settings')

function baseUrl() {
  return aiSettings.loadConfig().openAiBaseUrl || 'https://api.openai.com/v1'
}

function streamChat(options) {
  return openAiCompatibleClient.streamChat(Object.assign({}, options, { baseUrl: baseUrl() }))
}

function listModels(apiKey) {
  return openAiCompatibleClient.listModels(baseUrl(), apiKey)
}

module.exports = { streamChat, listModels, baseUrl }
