// ── AI BACKEND SELF-TEST (npm run ai:test) ─────────────────────────────────
// Asks the configured AI backend for a one-word answer and reports which
// backend was used. Exit code 0 = a backend works, 1 = nothing is configured
// or every backend failed. Never prints keys or full answers.
const context = require('./releaseContext')

function describeConfiguration() {
  const lines = []
  lines.push('Configured backends (first available wins):')
  lines.push('  1. UNICON_AI_GATEWAY_BASE_URL = '
    + (process.env.UNICON_AI_GATEWAY_BASE_URL ? 'set (' + process.env.UNICON_AI_GATEWAY_BASE_URL.replace(/\/+$/, '') + ')' : 'NOT SET'))
  lines.push('     UNICON_AI_GATEWAY_API_KEY   = ' + (process.env.UNICON_AI_GATEWAY_API_KEY ? 'set (hidden)' : 'not set (optional)'))
  lines.push('     UNICON_AI_GATEWAY_CHAT_COMPLETE_PATH = '
    + (process.env.UNICON_AI_GATEWAY_CHAT_COMPLETE_PATH || '/v1/chat/complete (default)'))
  lines.push('     provider/model = ' + (process.env.RELEASE_AI_PROVIDER || 'deepseek') + ' / ' + (process.env.RELEASE_AI_MODEL || 'deepseek-v4-pro'))
  lines.push('  2. RELEASE_AI_BASE_URL         = ' + (process.env.RELEASE_AI_BASE_URL ? 'set' : 'NOT SET')
    + ' / key ' + (process.env.RELEASE_AI_API_KEY || process.env.DEEPSEEK_API_KEY ? 'set (hidden)' : 'not set'))
  lines.push('  3. OLLAMA_HOST                 = ' + (process.env.OLLAMA_HOST || 'http://localhost:11434 (default, used when nothing above is set)'))
  return lines.join('\n')
}

async function main() {
  console.log(describeConfiguration())
  const hasGateway = Boolean(process.env.UNICON_AI_GATEWAY_BASE_URL)
  const hasExplicitEndpoint = Boolean(process.env.RELEASE_AI_BASE_URL || process.env.RELEASE_AI_API_KEY || process.env.DEEPSEEK_API_KEY)
  const hasExplicitOllama = Boolean(process.env.OLLAMA_HOST)
  if (!hasGateway && !hasExplicitEndpoint && !hasExplicitOllama) {
    console.error('✗ No AI backend is configured - nothing to test.')
    console.error('  Add a .env.local at the repo root with UNICON_AI_GATEWAY_BASE_URL')
    console.error('  (and optionally UNICON_AI_GATEWAY_API_KEY), or set RELEASE_AI_BASE_URL')
    console.error('  + a key, or start local Ollama and set OLLAMA_HOST.')
    console.error('  See PUBLISH-CHECKLIST.md, AI backend configuration.')
    process.exit(1)
  }
  console.log('→ Asking the AI backend for a test answer (this may take a few seconds)...')
  const prompt = [
    'Reply with exactly one word: OK',
  ].join('\n')
  const startedAt = Date.now()
  const answer = await context.getAiResponse(prompt)
  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  if (!answer) {
    console.error('✗ The backend returned an empty answer.')
    process.exit(1)
  }
  console.log('✓ Backend answered in ' + elapsedSeconds + 's: "' + String(answer).trim().slice(0, 60) + '"')
  console.log('The documentation scripts are ready to use this backend.')
}

main().catch((testError) => {
  console.error('\n✗ AI self-test failed:', testError?.message || testError)
  console.error('Check the values above, or set RELEASE_AI_BASE_URL + a key, or start local Ollama.')
  process.exit(1)
})
