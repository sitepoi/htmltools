'use strict'

// The application store client. Read only in this phase (T-26): listing and
// reading objects is all it does. Writes arrive with T-31 and use the same
// request path, so the auth and redaction rules are proven before anything is
// ever written.
//
// Two auth forms in one client (SSOT 8.8, D-HTF-39, RM-14):
//   header     -  x-api-key: <key>            (preferred)
//   url-token  -  {base}/api/object/{token}/{fn}/{type}   (legacy, being retired)
//
// The key is read from the environment or the gitignored local config, is never
// returned to a caller that could display it, and is scrubbed from every error
// message and log line.

const { fingerprintOf } = require('../util')
const secrets = require('./secrets')

class StoreError extends Error {
  constructor(message, details) {
    super(message)
    this.name = 'StoreError'
    this.code = (details && details.code) || 'STORE_ERROR'
    this.status = (details && details.status) || 0
    this.body = (details && details.body) || ''
    this.retryable = Boolean(details && details.retryable)
    this.blocked = Boolean(details && details.blocked)
    this.details = details || null
  }
}

// Environment variables that may hold the store key, in the order they win.
const CREDENTIAL_ENV_NAMES = secrets.READ_KEY_ENV

const QUESTION_REFS = { credential: 'Q-01, Q-02, Q-03', baseUrl: 'Q-04' }

function maskSecret(value) {
  const text = String(value || '')
  if (!text) return ''
  return text.length <= 4 ? '****' : text.slice(0, 2) + '••••' + text.slice(-4)
}

// Every string that leaves this module goes through here first.
function redact(value, secrets) {
  let text = String(value == null ? '' : value)
  ;(Array.isArray(secrets) ? secrets : [secrets]).forEach((secret) => {
    const key = String(secret || '')
    if (key.length < 6) return
    text = text.split(key).join('••••redacted••••')
  })
  return text
}

// Credential resolution: environment, then the secrets file outside the repo,
// then the gitignored local config (Q-01: reads and writes may use two keys).
// A missing key is blocked, never defaulted (RM-04, RM-06).
function resolveCredential(config, env, purpose) {
  const resolved = secrets.resolveKey(config, env, purpose === 'write' ? 'write' : 'read')
  if (resolved.ok) return resolved
  return Object.assign({}, resolved, { questionRef: QUESTION_REFS.credential })
}

function resolveBaseUrl(config) {
  const cms = (config && config.cms) || {}
  const baseUrl = String(cms.baseUrl || '').replace(/\/+$/, '')
  if (!baseUrl) {
    return {
      ok: false,
      code: 'MISSING_BASE_URL',
      reason: 'No store base URL: set "cms.baseUrl" in the gitignored config.local.json.',
      setting: 'cms.baseUrl',
      questionRef: QUESTION_REFS.baseUrl
    }
  }
  return { ok: true, value: baseUrl }
}

// The store wraps values in productData.data_categoriesBased. Some responses
// are flat; the reader accepts both instead of guessing per endpoint.
function valuesOf(record) {
  const source = record || {}
  const productData = source.productData || {}
  const categoriesBased = productData.data_categoriesBased || source.data_categoriesBased
  if (categoriesBased && typeof categoriesBased === 'object') return categoriesBased
  return source.fields && typeof source.fields === 'object' ? source.fields : {}
}

function normalizeRecord(record) {
  const source = record || {}
  const values = valuesOf(source)
  return {
    objectId: String(source.objectId || source.id || source._id || ''),
    objectType: String(source.cmsObjectType || source.objectType || source.mainObjectType || ''),
    name: String(source.name || values.title || values.name || ''),
    slug: String(source.slug || values.slug || ''),
    values,
    fieldNames: Object.keys(values).sort(),
    enabled: values.isEnabled !== undefined ? values.isEnabled : (source.isEnabled !== undefined ? source.isEnabled : null),
    updatedAt: String(source.updatedAt || source.modifiedAt || ''),
    raw: source
  }
}

// list answers: array, {items}, {objects} or {data}. All four exist in the wild.
function itemsOf(payload) {
  if (Array.isArray(payload)) return payload
  const source = payload || {}
  if (Array.isArray(source.items)) return source.items
  if (Array.isArray(source.objects)) return source.objects
  if (Array.isArray(source.data)) return source.data
  if (Array.isArray(source.results)) return source.results
  return []
}

function objectOf(payload) {
  if (!payload || typeof payload !== 'object') return null
  if (payload.object && typeof payload.object === 'object') return payload.object
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) return payload.data
  return payload
}

function sleep(ms) {
  // Deliberately not unref'd: a pending retry is real work, and an unref'd timer
  // lets Node exit in the middle of one.
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createStoreClient(options) {
  const settings = options || {}
  const config = settings.config || {}
  const cms = config.cms || {}
  const fetchImpl = settings.fetchImpl || (typeof fetch === 'function' ? fetch : null)
  const log = settings.log || function noop() {}
  const credential = resolveCredential(config, settings.env, 'read')
  const base = resolveBaseUrl(config)
  const secrets = credential.ok ? [credential.value] : []
  const timeoutMs = Math.max(1000, Number(cms.timeoutMs) || 20000)
  const maxRetries = Math.max(0, Math.min(5, Number(cms.retries) || 2))
  const readPath = String(cms.readPath || '/api/v2/objects').replace(/\/+$/, '')
  const authMode = cms.authMode === 'url-token' ? 'url-token' : 'header'

  // What a publish plan needs to know before it may run at all.
  function health() {
    const problems = []
    if (!base.ok) problems.push({ code: base.code, reason: base.reason, setting: base.setting, questionRef: base.questionRef })
    if (!credential.ok) {
      problems.push({
        code: credential.code,
        reason: credential.reason,
        setting: credential.setting,
        questionRef: credential.questionRef
      })
    }
    return {
      ok: problems.length === 0,
      baseUrl: base.ok ? base.value : '',
      authMode,
      credentialSource: credential.ok ? credential.source : '',
      credentialFingerprint: credential.ok ? credential.fingerprint : '',
      problems
    }
  }

  function urlFor(type, objectId) {
    const typeName = String(type || '').trim()
    if (!typeName) {
      throw new StoreError('No cmsObjectType was given for the request.', {
        code: 'MISSING_TYPE',
        blocked: true,
        details: { questionRef: 'Q-07' }
      })
    }
    if (authMode === 'url-token') {
      const legacy = cms.legacy || {}
      const fn = objectId ? String(legacy.readFnById || legacy.readFn || 'query') : String(legacy.readFn || 'query')
      const token = credential.ok ? encodeURIComponent(credential.value) : ''
      return base.value + '/api/object/' + token + '/' + fn + '/' + encodeURIComponent(typeName) +
        (objectId ? '?objectId=' + encodeURIComponent(objectId) : '')
    }
    return base.value + readPath + '/' + encodeURIComponent(typeName) +
      (objectId ? '/' + encodeURIComponent(objectId) : '')
  }

  function headers() {
    const result = { 'Content-Type': 'application/json', Accept: 'application/json' }
    if (authMode === 'header' && credential.ok) result[String(cms.keyHeader || 'x-api-key')] = credential.value
    if (cms.tenantHeader && cms.tenantValue) result[String(cms.tenantHeader)] = String(cms.tenantValue)
    return result
  }

  function assertReady() {
    if (!base.ok) {
      throw new StoreError(base.reason, {
        code: base.code,
        blocked: true,
        details: { setting: base.setting, questionRef: base.questionRef }
      })
    }
    if (!credential.ok) {
      throw new StoreError(credential.reason, {
        code: credential.code,
        blocked: true,
        details: { setting: credential.setting, questionRef: credential.questionRef }
      })
    }
    if (!fetchImpl) {
      throw new StoreError('No fetch implementation is available in this Node version.', { code: 'NO_FETCH' })
    }
  }

  async function request(method, url, body) {
    const attemptLimit = method === 'GET' ? maxRetries : 0
    let lastError = null
    for (let attempt = 0; attempt <= attemptLimit; attempt += 1) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      if (timer && typeof timer.unref === 'function') timer.unref()
      try {
        const response = await fetchImpl(url, {
          method,
          headers: headers(),
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal
        })
        const text = await response.text()
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500
          const error = new StoreError(
            'The store answered HTTP ' + response.status + ': ' + redact(text, secrets).slice(0, 400),
            { code: 'STORE_HTTP_' + response.status, status: response.status, body: redact(text, secrets), retryable }
          )
          if (retryable && attempt < attemptLimit) {
            lastError = error
            const retryAfter = Number(response.headers.get('retry-after')) || 0
            await sleep(retryAfter ? retryAfter * 1000 : (attempt + 1) * 800)
            continue
          }
          throw error
        }
        let payload = null
        try {
          payload = text ? JSON.parse(text) : {}
        } catch (_parseError) {
          throw new StoreError('The store answered with something that is not JSON.', {
            code: 'STORE_BAD_JSON',
            status: response.status,
            body: redact(text, secrets).slice(0, 400)
          })
        }
        return payload
      } catch (error) {
        if (error instanceof StoreError) {
          if (error.retryable && attempt < attemptLimit) {
            lastError = error
            await sleep((attempt + 1) * 800)
            continue
          }
          throw error
        }
        const aborted = error && (error.name === 'AbortError' || error.code === 'ABORT_ERR')
        const wrapped = new StoreError(
          aborted
            ? 'The store did not answer within ' + Math.round(timeoutMs / 1000) + 's.'
            : 'Cannot reach the store: ' + redact((error && error.message) || error, secrets),
          { code: aborted ? 'STORE_TIMEOUT' : 'STORE_UNREACHABLE', retryable: true }
        )
        if (attempt < attemptLimit) {
          lastError = wrapped
          await sleep((attempt + 1) * 800)
          continue
        }
        throw wrapped
      } finally {
        clearTimeout(timer)
      }
    }
    throw lastError || new StoreError('The store request failed for an unknown reason.')
  }

  async function listObjects(type, query) {
    assertReady()
    const search = new URLSearchParams()
    const params = query || {}
    Object.keys(params).forEach((key) => {
      const value = params[key]
      if (value === undefined || value === null || value === '') return
      search.set(key, String(value))
    })
    const url = urlFor(type) + (search.toString() ? '?' + search.toString() : '')
    const payload = await request('GET', url)
    const items = itemsOf(payload).map(normalizeRecord)
    log('info', 'Store read: ' + items.length + ' object(s) of ' + type + ' (' + authMode + ' auth, key ' +
      (credential.ok ? credential.fingerprint : 'missing') + ')')
    return { items, total: items.length, raw: payload }
  }

  async function getObject(type, objectId) {
    assertReady()
    if (!String(objectId || '').trim()) {
      throw new StoreError('No object id was given to read.', { code: 'MISSING_OBJECT_ID', blocked: true })
    }
    const payload = await request('GET', urlFor(type, objectId))
    const record = objectOf(payload)
    return record ? normalizeRecord(record) : null
  }

  // The field map of a record: which keys exist inside data_categoriesBased.
  // Tools and applications differ, and the plan shows the map so a wrong type is
  // visible before a write instead of after one.
  function describeFieldMap(record) {
    const normalized = record && record.fieldNames ? record : normalizeRecord(record)
    return {
      objectId: normalized.objectId,
      objectType: normalized.objectType,
      name: normalized.name,
      fields: normalized.fieldNames,
      values: normalized.values
    }
  }

  return {
    authMode,
    health,
    listObjects,
    getObject,
    describeFieldMap,
    normalizeRecord,
    credential
  }
}

module.exports = {
  StoreError,
  CREDENTIAL_ENV_NAMES,
  maskSecret,
  redact,
  resolveCredential,
  resolveBaseUrl,
  normalizeRecord,
  itemsOf,
  objectOf,
  valuesOf,
  createStoreClient,
  secrets
}
