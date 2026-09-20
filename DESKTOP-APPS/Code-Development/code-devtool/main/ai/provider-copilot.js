// CodeDevTool - GitHub Copilot API provider
// Primary AI backend (CODE-03). The Copilot API speaks the
// OpenAI-compatible chat protocol at api.githubcopilot.com.

const openAiCompatibleClient = require('./openai-compatible-client')
const aiSettings = require('./ai-settings')

function baseUrl() {
  return aiSettings.loadConfig().copilotBaseUrl || 'https://api.githubcopilot.com'
}

function streamChat(options) {
  return openAiCompatibleClient.streamChat(Object.assign({}, options, { baseUrl: baseUrl() }))
}

function chatOnce(options) {
  return openAiCompatibleClient.chatOnce(Object.assign({}, options, { baseUrl: baseUrl() }))
}

function listModels(apiKey) {
  return openAiCompatibleClient.listModels(baseUrl(), apiKey)
}

module.exports = { streamChat, chatOnce, listModels, baseUrl }
