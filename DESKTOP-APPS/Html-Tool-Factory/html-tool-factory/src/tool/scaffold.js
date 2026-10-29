'use strict'

// Deterministic first version of a html tool, following html-tool-rules.txt:
//   app/<Tool>.html   body markup only, first line <!-- html build YYYY-MM-DD-N -->
//   app/<Tool>.css    rules only,      first line /* css build YYYY-MM-DD-N */
//   app/<Tool>.js     logic only,      first line /* js build YYYY-MM-DD-N */
//   app/test-harness.html  local preview with a mock tool SDK (no server needed)
// There is no index.html, no framework, no build step and no external url.
// A file is only written when it does not exist yet, so build tasks own it after
// the first pass.

const fs = require('fs')
const { toolPathsFor } = require('./naming')
const { buildStamp, firstLineFor, stampOf } = require('./contract')

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function productFacts(ssot, idea) {
  const product = (ssot && ssot.product) || {}
  const name = product.name || (idea && idea.name) || 'Generated Tool'
  return {
    name,
    tagline: product.tagline || (idea && idea.purpose) || 'One focused job, done well.',
    problem: product.problem || 'The work is currently spread across loose files.',
    solution: product.solution || 'One screen that keeps the whole flow in view.',
    audience: product.audience || 'Small teams and solo operators',
    features: Array.isArray(ssot && ssot.features) ? ssot.features : [],
    ideaCode: (idea && (idea.folder || idea.code)) || '',
    ideaPurpose: (idea && idea.purpose) || ''
  }
}

function buildToolHtml(facts, prefix, stampValue) {
  const stamp = stampOf('html', stampValue)
  const p = prefix
  const html = `<!-- html build ${stamp} -->
<div class="${p}tool" data-tool-build="${stamp}">
  <header class="${p}head">
    <div class="${p}head-text">
      <h1 class="${p}title">${escapeHtml(facts.name)}</h1>
      <p class="${p}sub">${escapeHtml(facts.tagline)}</p>
    </div>
    <span class="${p}build" id="${p}build">build ${stamp}</span>
  </header>
  <main class="${p}main">
    <form class="${p}form" id="${p}form" novalidate="novalidate">
      <div class="${p}field">
        <label class="${p}label" for="${p}brief">What is this about</label>
        <textarea class="${p}input" id="${p}brief" rows="4"
          placeholder="Describe the product, the audience and what you want out of it."></textarea>
      </div>
      <div class="${p}row">
        <div class="${p}field">
          <label class="${p}label" for="${p}count">How many</label>
          <select class="${p}input" id="${p}count">
            <option value="3">3</option>
            <option value="5">5</option>
            <option value="8">8</option>
          </select>
        </div>
        <div class="${p}field">
          <label class="${p}label" for="${p}tone">Tone</label>
          <select class="${p}input" id="${p}tone">
            <option value="clear">Clear and direct</option>
            <option value="warm">Warm</option>
            <option value="formal">Formal</option>
          </select>
        </div>
        <div class="${p}field ${p}field-action">
          <button class="${p}button" id="${p}run" type="submit">Generate</button>
        </div>
      </div>
    </form>
    <p class="${p}status" id="${p}status" role="status">Ready</p>
    <ul class="${p}list" id="${p}list"></ul>
  </main>
  <footer class="${p}foot">
    <span class="${p}foot-text">Build tasks replace this starter screen with the real workflow.</span>
  </footer>
</div>
`
  return html
}

function buildToolCss(prefix, stampValue) {
  const stamp = stampOf('css', stampValue)
  const p = prefix
  const v = '--' + prefix.replace(/-$/, '') + '-'
  const css = `/* css build ${stamp} */
.${p}tool {
  ${v}ink: #1f2933;
  ${v}muted: #61728a;
  ${v}line: #d7dfe9;
  ${v}paper: #ffffff;
  ${v}panel: #f5f8fb;
  ${v}accent: #1f4e78;
  ${v}accent-ink: #ffffff;
  color: var(${v}ink);
  background: var(${v}paper);
  font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
  border-radius: 14px;
}

.${p}head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(${v}line);
}

.${p}title {
  margin: 0;
  font-size: 22px;
  letter-spacing: -0.01em;
}

.${p}sub {
  margin: 4px 0 0;
  color: var(${v}muted);
  font-size: 14px;
}

.${p}build {
  flex: 0 0 auto;
  font-size: 12px;
  color: var(${v}muted);
  background: var(${v}panel);
  border: 1px solid var(${v}line);
  border-radius: 999px;
  padding: 3px 10px;
  white-space: nowrap;
}

.${p}main {
  padding: 18px 0 0;
}

.${p}form {
  background: var(${v}panel);
  border: 1px solid var(${v}line);
  border-radius: 12px;
  padding: 16px;
  display: grid;
  gap: 14px;
}

.${p}row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  align-items: end;
}

.${p}field {
  display: grid;
  gap: 6px;
}

.${p}label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(${v}muted);
}

.${p}input {
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  color: var(${v}ink);
  background: #ffffff;
  border: 1px solid var(${v}line);
  border-radius: 8px;
  padding: 9px 11px;
  min-height: 38px;
}

.${p}input:focus {
  outline: 2px solid var(${v}accent);
  outline-offset: 1px;
  border-color: var(${v}accent);
}

.${p}button {
  font: inherit;
  font-weight: 600;
  color: var(${v}accent-ink);
  background: var(${v}accent);
  border: 1px solid var(${v}accent);
  border-radius: 8px;
  padding: 10px 18px;
  min-height: 40px;
  cursor: pointer;
}

.${p}button:disabled {
  opacity: 0.6;
  cursor: progress;
}

.${p}status {
  margin: 14px 0 0;
  font-size: 13px;
  color: var(${v}muted);
}

.${p}list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.${p}item {
  background: #ffffff;
  border: 1px solid var(${v}line);
  border-radius: 10px;
  padding: 12px 14px;
}

.${p}item-title {
  display: block;
  font-weight: 600;
  margin-bottom: 4px;
}

.${p}item-text {
  display: block;
  color: var(${v}muted);
  font-size: 14px;
}

.${p}foot {
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px solid var(${v}line);
  font-size: 12px;
  color: var(${v}muted);
}
`
  return css
}

function buildToolJs(facts, prefix, toolName, stampValue) {
  const stamp = stampOf('js', stampValue)
  const p = prefix
  const safeAudience = String(facts.audience).replace(/'/g, '').slice(0, 60)
  const safeName = String(facts.name).replace(/[^A-Za-z0-9 ]/g, '').slice(0, 40)
  const safeToolName = String(toolName).replace(/[^A-Za-z0-9 ]/g, '')
  const js = `/* js build ${stamp} */

var TOOL_BUILD = '${stamp}'
console.log('[TOOL:BOOT] build ' + TOOL_BUILD + ' - ${safeToolName}')

var PARAM_DEFS = [
  { key: 'brief', label: 'What is this about', type: 'text', required: false },
  { key: 'count', label: 'How many', type: 'number', required: false },
  { key: 'tone', label: 'Tone', type: 'text', required: false }
]

function byId(elementId) {
  return document.getElementById(elementId)
}

function setStatus(text, isError) {
  var node = byId('${p}status')
  if (!node) return
  node.textContent = text
  node.style.color = isError ? '#a4262c' : ''
}

function declareParams() {
  if (typeof tool !== 'undefined' && tool && typeof tool.declareParams === 'function') {
    tool.declareParams(PARAM_DEFS)
  }
  return PARAM_DEFS
}

function reportMissingParams(provided) {
  var values = provided || {}
  var missing = PARAM_DEFS.filter(function (definition) {
    return definition.required && !values[definition.key]
  })
  if (missing.length && typeof tool !== 'undefined' && tool && typeof tool.reportMissingParams === 'function') {
    tool.reportMissingParams(missing.map(function (definition) { return definition.key }))
  }
  return missing
}

function localVariants(brief, count) {
  var clean = String(brief || '').trim()
  var base = clean ? clean.split(/[.!?\\n]/)[0].slice(0, 90) : '${safeName}'
  var openers = ['Short and direct', 'Benefit first', 'Question hook', 'Proof first',
    'Plain spoken', 'Story opening', 'Numbered claim', 'Contrast']
  var items = []
  for (var index = 0; index < count; index += 1) {
    items.push({
      title: openers[index % openers.length] + ' ' + (index + 1),
      text: base + ' - written for ${safeAudience}.',
      source: 'local'
    })
  }
  return items
}

function readInputs() {
  var brief = byId('${p}brief')
  var count = byId('${p}count')
  var tone = byId('${p}tone')
  return {
    brief: brief ? String(brief.value || '').trim() : '',
    count: count ? Number(count.value) || 3 : 3,
    tone: tone ? String(tone.value || 'clear') : 'clear'
  }
}

function normalizeAnswer(answer, input) {
  var data = answer
  if (typeof data === 'string') {
    try { data = JSON.parse(data) } catch (error) { data = null }
  }
  var items = data && Array.isArray(data.variants)
    ? data.variants
    : (data && Array.isArray(data.items) ? data.items : null)
  if (!items || !items.length) return localVariants(input.brief, input.count)
  return items.map(function (item, index) {
    if (typeof item === 'string') {
      return { title: 'Variant ' + (index + 1), text: item, source: 'ai' }
    }
    return {
      title: String(item.title || 'Variant ' + (index + 1)),
      text: String(item.text || item.body || item.copy || ''),
      source: 'ai'
    }
  })
}

function renderItems(items) {
  var list = byId('${p}list')
  if (!list) return
  list.innerHTML = ''
  items.forEach(function (item) {
    var row = document.createElement('li')
    row.className = '${p}item'
    var title = document.createElement('strong')
    title.className = '${p}item-title'
    title.textContent = item.title
    var text = document.createElement('span')
    text.className = '${p}item-text'
    text.textContent = item.text
    row.appendChild(title)
    row.appendChild(text)
    list.appendChild(row)
  })
}

function generate() {
  var input = readInputs()
  if (!input.brief) {
    setStatus('Add a short brief first.', true)
    return
  }
  var button = byId('${p}run')
  if (button) button.disabled = true
  setStatus('Generating...', false)
  var request = {
    prompt: 'Write ' + input.count + ' variants in a ' + input.tone + ' tone for: ' + input.brief,
    schema: { variants: [{ title: 'string', text: 'string' }] }
  }
  var answer = null
  if (typeof tool !== 'undefined' && tool && typeof tool.requestAI === 'function') {
    answer = tool.requestAI(request)
  }
  Promise.resolve(answer).then(function (result) {
    renderItems(normalizeAnswer(result, input))
    setStatus('Done. ' + input.count + ' variant(s) ready.', false)
  }).catch(function (error) {
    renderItems(localVariants(input.brief, input.count))
    setStatus('The AI call failed (' + (error && error.message ? error.message : 'unknown') + '). Local draft shown.', true)
  }).then(function () {
    if (button) button.disabled = false
  })
}

tool.onReady(function (value) {
  declareParams()
  var provided = (value && value.params) || {}
  reportMissingParams(provided)
  var form = byId('${p}form')
  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault()
      generate()
    })
  }
  setStatus('Ready. Build ' + TOOL_BUILD + '.', false)
})
`
  return js
}

function escapeJs(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\\\'')
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
}

function buildHarness(toolName, prefix, stampValue) {
  const stamp = stampOf('js', stampValue)
  const name = String(toolName)
  const hostMarkup = buildToolHtml({ name, tagline: 'Test harness host markup' }, prefix, stamp)
  const harness = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(name)} - test harness</title>
  <link rel="stylesheet" href="${escapeHtml(name)}.css" />
  <style>
    body { margin: 0; background: #eef2f7; }
    .harness-bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
      padding: 10px 16px; background: #10233a; color: #e8eef6;
      font: 13px/1.4 system-ui, Arial, sans-serif; }
    .harness-bar strong { font-weight: 600; }
    .harness-bar code { background: rgba(255,255,255,0.14); padding: 1px 6px; border-radius: 4px; }
    .harness-shell { background: #ffffff; max-width: 940px; margin: 16px auto;
      border-radius: 14px; box-shadow: 0 8px 24px rgba(16,35,58,0.12); }
  </style>
</head>
<body>
  <div class="harness-bar">
    <strong>${escapeHtml(name)} - test harness</strong>
    <span>build <code>${stamp}</code></span>
    <span>mock tool SDK: no network, no platform needed</span>
  </div>
  <div class="harness-shell" id="tool-host"></div>
  <script>
    window.__HARNESS_LOG__ = []
    window.__HARNESS_MARKUP__ = '${escapeJs(hostMarkup)}'
    window.tool = {
      onReady: function (callback) {
        window.__HARNESS_LOG__.push('onReady')
        document.getElementById('tool-host').innerHTML = window.__HARNESS_MARKUP__
        setTimeout(function () {
          callback({ params: {}, build: '${stamp}' })
        }, 0)
      },
      declareParams: function (definitions) {
        window.__HARNESS_LOG__.push('declareParams:' + (definitions || []).length)
      },
      reportMissingParams: function (keys) {
        window.__HARNESS_LOG__.push('missingParams:' + (keys || []).join(','))
      },
      requestAI: function (request) {
        window.__HARNESS_LOG__.push('requestAI')
        if (window.__HARNESS_AI_OFFLINE__) {
          return Promise.reject(new Error('harness is set to offline'))
        }
        return new Promise(function (resolve) {
          setTimeout(function () {
            resolve({
              variants: [
                { title: 'Mock variant A', text: 'Mock answer for: ' + String((request && request.prompt) || '').slice(0, 80) },
                { title: 'Mock variant B', text: 'A second mock answer so the list shows more than one row.' }
              ]
            })
          }, 80)
        })
      }
    }
  </script>
  <script src="${escapeHtml(name)}.js"></script>
</body>
</html>
`
  return harness
}

function contractFiles(options) {
  const toolName = options.toolName
  const prefix = options.prefix
  const stamp = stampOf('html', options.stamp || buildStamp())
  const facts = productFacts(options.ssot, options.idea)
  return {
    stamp,
    facts,
    files: [
      { path: 'app/' + toolName + '.html', content: buildToolHtml(facts, prefix, stamp) },
      { path: 'app/' + toolName + '.css', content: buildToolCss(prefix, stamp) },
      { path: 'app/' + toolName + '.js', content: buildToolJs(facts, prefix, toolName, stamp) },
      { path: 'app/test-harness.html', content: buildHarness(toolName, prefix, stamp) }
    ]
  }
}

function scaffoldTool(options) {
  const workspace = options.workspace
  const toolName = options.toolName
  const prefix = options.prefix
  const paths = toolPathsFor(toolName)
  const built = contractFiles(Object.assign({}, options, { toolName, prefix }))

  const created = []
  const skipped = []

  // A html tool never has an index.html. Remove one left behind by an older build.
  if (workspace.exists('app/index.html')) {
    try {
      fs.unlinkSync(workspace.resolveInside('app/index.html'))
      skipped.push('app/index.html (removed)')
    } catch (_error) {
      // best effort
    }
  }

  built.files.forEach((file) => {
    if (workspace.exists(file.path)) {
      skipped.push(file.path)
      return
    }
    workspace.writeText(file.path, file.content)
    created.push(file.path)
  })

  return {
    created,
    skipped,
    toolName,
    prefix,
    paths,
    stamp: built.stamp,
    files: built.files
  }
}

module.exports = {
  scaffoldTool,
  contractFiles,
  buildToolHtml,
  buildToolCss,
  buildToolJs,
  buildHarness,
  productFacts,
  escapeHtml
}
