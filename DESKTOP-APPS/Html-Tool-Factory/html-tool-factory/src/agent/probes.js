'use strict'

// Probes: the only way the factory "runs code". There is no shell and no free
// form script execution. A probe is a fixed, audited action:
//   syntax     - node --check one file inside the tool folder
//   dom_smoke  - boot the tool script in a tiny fake DOM and collect its log
//   web_get    - read one https page from an allowlisted host (off by default)
// Everything is bounded, runs inside the tool folder (or an allowlist), and the
// result is returned as text so it can be logged and reviewed.

const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { spawnSync } = require('child_process')

const PROBES = ['syntax', 'dom_smoke', 'web_get']
const MAX_OUTPUT_CHARS = 6000
const MAX_WEB_BYTES = 200000

function clamp(text) {
  const value = String(text || '')
  if (value.length <= MAX_OUTPUT_CHARS) return value
  return value.slice(0, MAX_OUTPUT_CHARS) + '\n... [probe output trimmed]'
}

function normalizeTarget(target) {
  return String(target || '').replace(/\\/g, '/').trim().replace(/^\.?\//, '')
}

function syntaxProbe(workspace, target) {
  const relativePath = normalizeTarget(target)
  if (!relativePath) return { ok: false, text: 'A file path inside the tool folder is required.' }
  let absolutePath = ''
  try {
    absolutePath = workspace.resolveInside(relativePath)
  } catch (_error) {
    return { ok: false, text: 'The path is outside the tool folder: ' + relativePath }
  }
  if (!fs.existsSync(absolutePath)) return { ok: false, text: 'The file does not exist: ' + relativePath }
  const result = spawnSync(process.execPath, ['--check', absolutePath], { encoding: 'utf8', timeout: 20000 })
  if (result.status === 0) return { ok: true, text: 'Syntax is valid: ' + relativePath }
  const detail = String(result.stderr || result.stdout || '').split('\n').slice(0, 6).join(' ')
  return { ok: false, text: 'Syntax error in ' + relativePath + ': ' + detail.slice(0, 600) }
}

function createElement(tagName) {
  const node = {
    tagName: String(tagName || 'div').toUpperCase(),
    children: [],
    attributes: {},
    style: {},
    className: '',
    id: '',
    value: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    hidden: false,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false } },
    appendChild(child) { this.children.push(child); return child },
    removeChild(child) {
      const index = this.children.indexOf(child)
      if (index !== -1) this.children.splice(index, 1)
      return child
    },
    setAttribute(name, value) { this.attributes[name] = String(value) },
    getAttribute(name) { return this.attributes[name] === undefined ? null : this.attributes[name] },
    removeAttribute(name) { delete this.attributes[name] },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true },
    focus() {},
    blur() {},
    click() {},
    querySelector() { return null },
    querySelectorAll() { return [] },
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 } }
  }
  return node
}

function createDomShim() {
  const elementsById = new Map()
  const lines = []
  const document = {
    body: createElement('body'),
    documentElement: createElement('html'),
    createElement,
    createTextNode(text) {
      const node = createElement('text')
      node.textContent = String(text)
      return node
    },
    getElementById(id) {
      const key = String(id)
      if (!elementsById.has(key)) {
        const node = createElement('div')
        node.id = key
        elementsById.set(key, node)
      }
      return elementsById.get(key)
    },
    querySelector() { return null },
    querySelectorAll() { return [] },
    addEventListener() {},
    removeEventListener() {}
  }
  const consoleShim = {
    log() { lines.push(Array.prototype.slice.call(arguments).map(String).join(' ')) },
    warn() { lines.push('[warn] ' + Array.prototype.slice.call(arguments).map(String).join(' ')) },
    error() { lines.push('[error] ' + Array.prototype.slice.call(arguments).map(String).join(' ')) },
    info() { lines.push(Array.prototype.slice.call(arguments).map(String).join(' ')) }
  }
  return { document, console: consoleShim, lines, elementsById }
}

// Boots the tool script in a fake DOM, so a crash shows up here instead of in a
// browser. It is a smoke test, not a browser: layout and CSS are not checked.
function domSmokeProbe(workspace, target) {
  const relativePath = normalizeTarget(target) || 'app/tool.js'
  let absolutePath = ''
  try {
    absolutePath = workspace.resolveInside(relativePath)
  } catch (_error) {
    return { ok: false, text: 'The path is outside the tool folder: ' + relativePath }
  }
  if (!fs.existsSync(absolutePath)) return { ok: false, text: 'The file does not exist: ' + relativePath }
  const code = fs.readFileSync(absolutePath, 'utf8')
  const shim = createDomShim()
  const sandbox = {
    console: shim.console,
    document: shim.document,
    navigator: { clipboard: { writeText() { return Promise.resolve() } }, userAgent: 'factory-probe' },
    location: { href: 'https://probe.invalid/tool', search: '' },
    URL: { createObjectURL() { return 'blob:probe' }, revokeObjectURL() {} },
    Blob: function ProbeBlob() {},
    setTimeout(fn) { if (typeof fn === 'function') fn(); return 1 },
    clearTimeout() {},
    setInterval() { return 1 },
    clearInterval() {},
    requestAnimationFrame(fn) { if (typeof fn === 'function') fn(); return 1 },
    alert(message) { shim.lines.push('[alert] ' + String(message)) },
    Promise,
    Math,
    JSON,
    Date,
    Intl,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    Error,
    isFinite,
    isNaN,
    parseInt,
    parseFloat
  }
  sandbox.window = sandbox
  sandbox.globalThis = sandbox
  sandbox.tool = {
    onReady(callback) {
      sandbox.__ready = callback
      shim.lines.push('[probe] tool.onReady registered')
    },
    declareParams(definitions) { shim.lines.push('[probe] declareParams ' + (definitions || []).length) },
    reportMissingParams(keys) { shim.lines.push('[probe] missingParams ' + (keys || []).join(',')) },
    requestAI() { return Promise.resolve({ variants: [{ title: 'probe', text: 'probe answer' }] }) },
    getParams() { return {} },
    setParams() {},
    notify() {},
    storage: {
      get() { return null },
      set() {},
      remove() {},
      list() { return [] }
    }
  }

  const errors = []
  try {
    vm.runInNewContext(code, sandbox, { timeout: 5000, filename: relativePath })
  } catch (error) {
    errors.push('throw: ' + (error && error.message ? error.message : String(error)))
  }
  if (!errors.length && typeof sandbox.__ready === 'function') {
    try {
      sandbox.__ready({ params: {} })
    } catch (error) {
      errors.push('onReady: ' + (error && error.message ? error.message : String(error)))
    }
  }

  const interesting = shim.lines.filter((line) => /\[TOOL:|\[probe\]|\[error\]|\[warn\]|\[alert\]/.test(line))
  const report = []
  if (errors.length) report.push('FAILED: ' + errors.join(' | '))
  if (interesting.length) report.push(interesting.slice(0, 40).join('\n'))
  if (!report.length) report.push('The script ran without log output.')
  // Say what this probe does NOT prove, so nobody treats a green smoke as a
  // working screen.
  report.push('note: behaviour only. Layout, CSS and the visual result are not verified by this probe.')
  return {
    ok: errors.length === 0,
    text: 'DOM smoke of ' + relativePath + ':\n' + report.join('\n')
  }
}

function hostAllowed(hostname, allowHosts) {
  const host = String(hostname || '').toLowerCase()
  return (allowHosts || []).some((allowed) => {
    const value = String(allowed || '').toLowerCase().trim()
    if (!value) return false
    if (value.startsWith('*.')) return host.endsWith(value.slice(1))
    return host === value
  })
}

async function webGetProbe(target, options) {
  const settings = options || {}
  const web = settings.web || {}
  if (!web.enabled) {
    return { ok: false, text: 'Web access is disabled. Enable agent.web.enabled and list the host in agent.web.allowHosts.' }
  }
  let url
  try {
    url = new URL(String(target || ''))
  } catch (_error) {
    return { ok: false, text: 'A full https url is required.' }
  }
  if (url.protocol !== 'https:') return { ok: false, text: 'Only https urls are allowed.' }
  if (!hostAllowed(url.hostname, web.allowHosts)) {
    return { ok: false, text: 'The host is not allowlisted: ' + url.hostname }
  }
  const controller = new AbortController()
  const timeoutMs = Math.max(2000, Math.min(20000, Number(web.timeoutMs) || 6000))
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'html-tool-factory/1.0 (read only probe)' }
    })
    if (!response.ok) return { ok: false, text: 'The page answered ' + response.status + '.' }
    const contentType = String(response.headers.get('content-type') || '')
    if (!/text\/|json|xml|html/i.test(contentType)) {
      return { ok: false, text: 'Only text content is read, got ' + contentType + '.' }
    }
    const buffer = await response.arrayBuffer()
    const maxBytes = Math.max(1000, Math.min(MAX_WEB_BYTES, Number(web.maxBytes) || MAX_WEB_BYTES))
    const text = Buffer.from(buffer).subarray(0, maxBytes).toString('utf8')
    return { ok: true, text: 'GET ' + url.hostname + url.pathname + ' (' + buffer.byteLength + ' bytes)\n' + clamp(text) }
  } catch (error) {
    const message = error && error.name === 'AbortError' ? 'timed out' : (error && error.message) || 'failed'
    return { ok: false, text: 'The request failed: ' + message }
  } finally {
    clearTimeout(timer)
  }
}

// Entry point used by the model tool layer.
async function runProbe(options) {
  const settings = options || {}
  const probe = String(settings.probe || '').toLowerCase()
  if (!PROBES.includes(probe)) {
    return { ok: false, text: 'Unknown probe. Available: ' + PROBES.join(', ') }
  }
  if (probe === 'syntax') return syntaxProbe(settings.workspace, settings.target)
  if (probe === 'dom_smoke') return domSmokeProbe(settings.workspace, settings.target)
  return webGetProbe(settings.target, settings)
}

module.exports = { PROBES, runProbe, syntaxProbe, domSmokeProbe, webGetProbe, hostAllowed }
