'use strict'

// Configuration resolution order (later wins):
//   1. built-in defaults
//   2. config.example.json
//   3. config.local.json  (gitignored, written by the Settings panel)
//   4. environment variables
// The application never reads the repository .env files - the operator copies
// values into config.local.json or exports them.

const path = require('path')
const fs = require('fs')
const { readJsonFile } = require('./util')

const APP_ROOT = path.resolve(__dirname, '..')
// The idea list SSOT: the JSON catalog, not the generated catalog-data.js.
const DEFAULT_CATALOG_PATH = path.resolve(APP_ROOT, '..', '..', '..', 'UNICON-TOOLS', 'tools-catalog', 'tool-ideas-catalog.json')

// The build of the factory itself. It is served to the dashboard so a page left
// open across a change can say so instead of quietly showing old markup. Keep it
// equal to the document version in docs/ssot.html (a source check enforces it).
const APP_BUILD = '0.12.2'

const BUILT_IN_DEFAULTS = {
  host: '127.0.0.1',
  port: 4173,
  openBrowser: true,
  provider: 'mock',
  uniconGateway: {
    baseUrl: '',
    apiKey: '',
    tenantHost: '',
    defaultProvider: 'deepseek',
    model: 'deepseek-v4-pro'
  },
  openaiCompatible: {
    baseUrl: '',
    apiKey: '',
    model: ''
  },
  ollama: {
    host: 'http://localhost:11434',
    model: 'deepseek-r1:14b'
  },
  models: {
    planner: '',
    coder: ''
  },
  limits: {
    maxIterations: 5,
    maxTasksPerIteration: 5,
    maxAiCallsPerRun: 120,
    maxTotalCharsPerRun: 3600000,
    requestTimeoutMs: 180000,
    maxRequestTimeoutMs: 600000,
    taskAttempts: 3,
    taskRetries: 2,
    maxSourceFileChars: 90000,
    maxCodemapChars: 9000
  },
  // Repository knowledge injected into the two prompts that decide what to
  // build: the tool rules, the publish checklist and the lessons of past runs.
  knowledge: {
    maxChars: 4200,
    extraFiles: []
  },
  // One AI call carries about this many task points. Small tasks are packed
  // together, a task that already scores 100 gets a prompt of its own.
  apply: {
    pointsPerPrompt: 100,
    maxBatchPoints: 130,
    maxTasksPerBatch: 6,
    // A batch of this many points may hand over a complete file instead of an
    // anchor based replace. Anchor patches fail often on a file being rebuilt.
    overwriteMinPoints: 80
  },
  // The operator may hold a batch after its patch is computed and before it is
  // written, then approve or reject it in the dashboard.
  review: {
    eachBatch: false,
    timeoutMs: 900000,
    pollMs: 500
  },
  // Agentic editing: the model may inspect files with read only tools and run
  // one bounded probe before it writes a patch. No shell, no database, no
  // writes, and web access only for hosts the operator allowlists.
  agentic: {
    enabled: true,
    maxToolRounds: 2,
    inlineFileChars: 6000
  },
  agent: {
    probes: ['syntax', 'dom_smoke'],
    web: {
      enabled: false,
      allowHosts: [],
      maxBytes: 200000,
      timeoutMs: 6000
    }
  },
  // Watch the model write. The answer is streamed to the dashboard as it
  // arrives, so every call can be read while it is happening. Turning this off
  // falls back to one request per answer with no live text.
  stream: {
    enabled: true
  },
  ideasCatalogPath: DEFAULT_CATALOG_PATH,
  catalog: {
    writeBack: true
  },
  tool: {
    scaffold: true,
    // File deletion is disabled for build tasks. Only replace or append.
    allowDelete: false
  },
  // Where the finished html tool is written. repo = the real repository folder
  // resolved from the folder taxonomy (UNICON-TOOLS/tools-catalog/
  // folder-hierarchy-import.json). run = inside the run folder, for experiments.
  target: {
    mode: 'repo',
    root: '',
    overwrite: false,
    // A dry run (mock provider) is sandboxed into the run folder by default; set
    // this to true only when you really want a mock build in the repository.
    mockInRepo: false
  },
  taxonomyFile: '',
  docs: {
    // The repository documentation generator, relative to the repository root.
    generator: 'scripts/init-docs.js'
  },
  checks: [],
  git: {
    allowCommit: false,
    allowPush: false
  }
}

function mergeDeep(baseValue, patchValue) {
  if (patchValue === undefined || patchValue === null) return baseValue
  if (Array.isArray(patchValue)) return patchValue.slice()
  if (typeof patchValue !== 'object') return patchValue
  const baseIsObject = baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue)
  const result = baseIsObject ? Object.assign({}, baseValue) : {}
  Object.keys(patchValue).forEach((key) => {
    result[key] = mergeDeep(result[key], patchValue[key])
  })
  return result
}

function readLocalConfig(overridePath) {
  const candidatePath = overridePath || path.join(APP_ROOT, 'config.local.json')
  const parsed = readJsonFile(candidatePath, null)
  return parsed && typeof parsed === 'object' ? parsed : {}
}

function applyEnvironment(configValue) {
  const config = mergeDeep({}, configValue)
  const env = process.env

  if (env.APP_FACTORY_PORT) config.port = Number(env.APP_FACTORY_PORT) || config.port
  if (env.APP_FACTORY_HOST) config.host = env.APP_FACTORY_HOST
  if (env.APP_FACTORY_PROVIDER) config.provider = env.APP_FACTORY_PROVIDER
  if (env.APP_FACTORY_CATALOG) config.ideasCatalogPath = env.APP_FACTORY_CATALOG

  // Unicon Gateway (same variable names as scripts/releaseContext.js so one
  // environment works for both tools).
  const gatewayBaseUrl = env.APP_FACTORY_GATEWAY_BASE_URL || env.UNICON_AI_GATEWAY_BASE_URL
  const gatewayApiKey = env.APP_FACTORY_GATEWAY_API_KEY || env.UNICON_AI_GATEWAY_API_KEY
  if (gatewayBaseUrl) config.uniconGateway.baseUrl = gatewayBaseUrl
  if (gatewayApiKey) config.uniconGateway.apiKey = gatewayApiKey
  if (env.APP_FACTORY_GATEWAY_TENANT || env.UNICON_AI_GATEWAY_HOST) {
    config.uniconGateway.tenantHost = env.APP_FACTORY_GATEWAY_TENANT || env.UNICON_AI_GATEWAY_HOST
  }

  const openAiBaseUrl = env.APP_FACTORY_OPENAI_BASE_URL || env.RELEASE_AI_BASE_URL
  const openAiApiKey = env.APP_FACTORY_OPENAI_API_KEY || env.RELEASE_AI_API_KEY || env.DEEPSEEK_API_KEY
  if (openAiBaseUrl) config.openaiCompatible.baseUrl = openAiBaseUrl
  if (openAiApiKey) config.openaiCompatible.apiKey = openAiApiKey
  if (env.APP_FACTORY_OPENAI_MODEL || env.RELEASE_AI_MODEL) {
    config.openaiCompatible.model = env.APP_FACTORY_OPENAI_MODEL || env.RELEASE_AI_MODEL
  }

  // A bare DEEPSEEK_API_KEY is a complete configuration: fill in the endpoint
  // and the model so nothing else has to be typed.
  if (env.DEEPSEEK_API_KEY && !env.APP_FACTORY_OPENAI_BASE_URL && !env.RELEASE_AI_BASE_URL &&
    !config.openaiCompatible.baseUrl) {
    config.openaiCompatible.baseUrl = 'https://api.deepseek.com/v1'
  }
  if (env.DEEPSEEK_API_KEY && !env.APP_FACTORY_OPENAI_MODEL && !env.RELEASE_AI_MODEL &&
    !config.openaiCompatible.model) {
    config.openaiCompatible.model = 'deepseek-chat'
  }

  if (env.APP_FACTORY_OLLAMA_HOST || env.OLLAMA_HOST) {
    config.ollama.host = env.APP_FACTORY_OLLAMA_HOST || env.OLLAMA_HOST
  }
  if (env.APP_FACTORY_OLLAMA_MODEL || env.RELEASE_OLLAMA_MODEL) {
    config.ollama.model = env.APP_FACTORY_OLLAMA_MODEL || env.RELEASE_OLLAMA_MODEL
  }

  // Pick a sensible provider when the operator only supplied credentials.
  const explicitProvider = Boolean(env.APP_FACTORY_PROVIDER) || Boolean(readLocalConfig().provider)
  if (!explicitProvider && config.provider === 'mock') {
    if (config.uniconGateway.baseUrl) config.provider = 'unicon-gateway'
    else if (config.openaiCompatible.baseUrl && config.openaiCompatible.apiKey) config.provider = 'openai-compatible'
  }

  if (env.APP_FACTORY_MAX_ITERATIONS) {
    config.limits.maxIterations = Number(env.APP_FACTORY_MAX_ITERATIONS) || config.limits.maxIterations
  }
  if (env.APP_FACTORY_ALLOW_GIT_COMMIT === 'yes') config.git.allowCommit = true
  if (env.APP_FACTORY_ALLOW_GIT_PUSH === 'yes') config.git.allowPush = true
  if (env.APP_FACTORY_CATALOG_WRITEBACK === 'no') {
    config.catalog = Object.assign({}, config.catalog, { writeBack: false })
  }
  return config
}

function normalizeConfig(configValue) {
  const config = mergeDeep({}, configValue)
  const allowedProviders = ['mock', 'unicon-gateway', 'openai-compatible', 'ollama']
  if (!allowedProviders.includes(config.provider)) config.provider = 'mock'
  config.port = Number(config.port) || 4173
  config.ideasCatalogPath = path.resolve(APP_ROOT, String(config.ideasCatalogPath || DEFAULT_CATALOG_PATH))
  if (!fs.existsSync(config.ideasCatalogPath) && fs.existsSync(DEFAULT_CATALOG_PATH)) {
    config.ideasCatalogPath = DEFAULT_CATALOG_PATH
  }
  config.limits.maxIterations = Math.max(1, Math.min(20, Number(config.limits.maxIterations) || 5))
  config.limits.maxTasksPerIteration = Math.max(1, Math.min(12, Number(config.limits.maxTasksPerIteration) || 5))
  config.limits.taskAttempts = Math.max(1, Math.min(4, Number(config.limits.taskAttempts) || 3))
  config.limits.taskRetries = Math.max(0, Math.min(5, Number(config.limits.taskRetries) || 2))
  config.apply = Object.assign({}, config.apply, {
    pointsPerPrompt: Math.max(20, Math.min(200, Number(config.apply && config.apply.pointsPerPrompt) || 100)),
    maxBatchPoints: Math.max(20, Math.min(300, Number(config.apply && config.apply.maxBatchPoints) || 130)),
    maxTasksPerBatch: Math.max(1, Math.min(10, Number(config.apply && config.apply.maxTasksPerBatch) || 6)),
    overwriteMinPoints: Math.max(40, Math.min(100, Number(config.apply && config.apply.overwriteMinPoints) || 80))
  })
  config.review = Object.assign({ enabled: true }, config.review, {
    eachBatch: Boolean(config.review && config.review.eachBatch),
    timeoutMs: Math.max(10000, Number(config.review && config.review.timeoutMs) || 900000),
    pollMs: Math.max(100, Number(config.review && config.review.pollMs) || 500)
  })
  config.limits.requestTimeoutMs = Math.max(10000, Number(config.limits.requestTimeoutMs) || 180000)
  config.limits.maxRequestTimeoutMs = Math.max(config.limits.requestTimeoutMs,
    Number(config.limits.maxRequestTimeoutMs) || 600000)
  // Push is never allowed from this application, regardless of configuration.
  config.git.allowPush = false
  return config
}

function loadConfig(options) {
  const settings = options || {}
  const exampleConfig = readJsonFile(path.join(APP_ROOT, 'config.example.json'), {})
  const localConfig = readLocalConfig(settings.localConfigPath)
  const merged = mergeDeep(mergeDeep(BUILT_IN_DEFAULTS, exampleConfig), localConfig)
  const withEnvironment = settings.skipEnvironment ? merged : applyEnvironment(merged)
  return normalizeConfig(withEnvironment)
}

// Where the model name actually comes from, in the order the client resolves it:
// the per stage override (models.planner / models.coder) wins, then the provider
// default. A settings screen that only shows the default is a lie, so the
// overrides are named here whenever they differ from it.
function modelSummary(configValue) {
  const models = configValue.models || {}
  const provider = configValue.provider
  const endpointModel = provider === 'unicon-gateway'
    ? String(configValue.uniconGateway.model || '')
    : provider === 'ollama'
      ? String(configValue.ollama.model || '')
      : String(configValue.openaiCompatible.model || '')
  const planner = String(models.planner || '')
  const coder = String(models.coder || '')
  const overrides = []
  if (planner && planner !== endpointModel) overrides.push('planner: ' + planner)
  if (coder && coder !== endpointModel) overrides.push('coder: ' + coder)
  return {
    endpointModel: endpointModel || 'no model set',
    planner: planner || endpointModel,
    coder: coder || endpointModel,
    overrides,
    // One line a human can read: "deepseek-flash (planner: deepseek-v4-pro, coder: deepseek-v4-pro)"
    text: (endpointModel || 'no model set') +
      (overrides.length ? ' (' + overrides.join(', ') + ')' : '')
  }
}

function describeProvider(config) {
  const provider = config.provider
  const models = modelSummary(config)
  if (provider === 'unicon-gateway') {
    const hasBaseUrl = Boolean(config.uniconGateway.baseUrl)
    const hasKey = Boolean(config.uniconGateway.apiKey)
    return {
      provider,
      label: 'Unicon Gateway',
      configured: hasBaseUrl && hasKey,
      detail: hasBaseUrl
        ? config.uniconGateway.defaultProvider + ' / ' + models.text + (hasKey ? '' : ' - no API key saved yet')
        : 'Base URL is empty',
      models
    }
  }
  if (provider === 'openai-compatible') {
    return {
      provider,
      label: 'OpenAI compatible',
      configured: Boolean(config.openaiCompatible.baseUrl && config.openaiCompatible.apiKey),
      detail: config.openaiCompatible.baseUrl ? models.text : 'Base URL is empty',
      models
    }
  }
  if (provider === 'ollama') {
    return {
      provider,
      label: 'Local Ollama',
      configured: Boolean(config.ollama.host),
      detail: config.ollama.host + ' / ' + models.text,
      models
    }
  }
  return {
    provider: 'mock',
    label: 'Dry run (mock AI)',
    configured: true,
    detail: 'No network calls, deterministic answers',
    models
  }
}

function maskSecret(secretValue) {
  const value = String(secretValue || '')
  if (!value) return ''
  if (value.length <= 8) return '••••'
  return value.slice(0, 4) + '••••' + value.slice(value.length - 4)
}

function publicConfigView(config) {
  const localConfigPath = path.join(APP_ROOT, 'config.local.json')
  return {
    host: config.host,
    port: config.port,
    provider: config.provider,
    providerInfo: describeProvider(config),
    uniconGateway: {
      baseUrl: config.uniconGateway.baseUrl,
      tenantHost: config.uniconGateway.tenantHost,
      defaultProvider: config.uniconGateway.defaultProvider,
      model: config.uniconGateway.model,
      apiKeyMasked: maskSecret(config.uniconGateway.apiKey),
      hasApiKey: Boolean(config.uniconGateway.apiKey)
    },
    openaiCompatible: {
      baseUrl: config.openaiCompatible.baseUrl,
      model: config.openaiCompatible.model,
      apiKeyMasked: maskSecret(config.openaiCompatible.apiKey),
      hasApiKey: Boolean(config.openaiCompatible.apiKey)
    },
    ollama: config.ollama,
    models: config.models,
    limits: config.limits,
    agentic: config.agentic,
    stream: config.stream,
    apply: config.apply,
    review: config.review,
    knowledge: config.knowledge,
    target: config.target,
    catalog: config.catalog,
    tool: config.tool,
    checks: config.checks,
    git: config.git,
    ideasCatalogPath: config.ideasCatalogPath,
    catalogExists: fs.existsSync(config.ideasCatalogPath),
    configFilePath: localConfigPath,
    configFileExists: fs.existsSync(localConfigPath)
  }
}

function saveLocalConfig(patchValue) {
  const current = readLocalConfig()
  const next = mergeDeep(current, patchValue || {})
  const targetPath = path.join(APP_ROOT, 'config.local.json')
  fs.writeFileSync(targetPath, JSON.stringify(next, null, 2), 'utf8')
  return targetPath
}

module.exports = {
  APP_ROOT,
  APP_BUILD,
  DEFAULT_CATALOG_PATH,
  loadConfig,
  normalizeConfig,
  describeProvider,
  modelSummary,
  publicConfigView,
  saveLocalConfig,
  mergeDeep
}
