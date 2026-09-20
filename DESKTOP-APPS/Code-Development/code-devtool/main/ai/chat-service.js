// Unicon Studio - chat service
// Combines the provider choice with the request-building rules shared by
// chat and (later) the agent runtime.

const providerCopilot = require('./provider-copilot')
const providerOpenAiCompatible = require('./provider-openai-compatible')

const systemPrompt =
  'You are the AI assistant of Unicon Studio, a visual-first desktop tool for web development. ' +
  'The user works on one project at a time: static HTML/CSS/JS sites or Next.js apps. ' +
  'Answer in the language the user writes. Prefer concrete, working code over generic advice. ' +
  'Treat attached files as the current code. Multi-file agent edits arrive in a later release - for now answer with code and explanations.'

function providerFor(providerName) {
  return providerName === 'openai' ? providerOpenAiCompatible : providerCopilot
}

function defaultModelFor(providerName) {
  return providerName === 'openai' ? 'gpt-4o-mini' : 'gpt-4o-copilot'
}

function buildRequestMessages(attachments, historyMessages, userText, sharedContextFiles) {
  const messages = []
  messages.push({ role: 'system', content: systemPrompt })
  ;(sharedContextFiles || []).forEach((file) => {
    messages.push({
      role: 'system',
      content: 'Shared workspace rule file "' + file.name + '":\n```\n' + file.content + '\n```'
    })
  })
  attachments.forEach((attachment) => {
    messages.push({
      role: 'system',
      content: 'Attached file "' + attachment.path + '":\n```\n' + attachment.content + '\n```'
    })
  })
  historyMessages.forEach((message) => {
    messages.push({ role: message.role, content: message.text })
  })
  messages.push({ role: 'user', content: userText })
  return messages
}

module.exports = { providerFor, defaultModelFor, buildRequestMessages }
