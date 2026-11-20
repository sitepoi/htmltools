'use strict'

// Where the store credentials live.
//
// The operator asked for one file that holds the keys and that the assistant and
// the dashboard never read. That file lives OUTSIDE this repository so it can
// never be committed, diffed or opened by accident:
//
//   %USERPROFILE%\.unicon-secrets.json          (Windows)
//   ~/.unicon-secrets.json                      (macOS/Linux)
//
// Shape:
//   {
//     "store": {
//       "baseUrl": "https://applicationstore.uniconhub.com",
//       "readKey": "...",
//       "writeKey": "...",
//       "tenantHeader": "",
//       "tenantValue": ""
//     }
//   }
//
// Resolution order for a key is: environment, then this file, then the
// gitignored config.local.json. This module returns the value to the caller that
// needs it and never prints, logs or serialises it: only fingerprints leave.

const fs = require('fs')
const os = require('os')
const path = require('path')
const { readJsonFile, fingerprintOf } = require('../util')

const SECRETS_FILE_ENV = 'APP_FACTORY_SECRETS_FILE'
const READ_KEY_ENV = ['APP_FACTORY_STORE_READ_KEY', 'APP_FACTORY_STORE_KEY', 'UNICON_STORE_API_KEY', 'UNICONBASEAPPS_API_KEY']
const WRITE_KEY_ENV = ['APP_FACTORY_STORE_WRITE_KEY', 'APP_FACTORY_STORE_KEY', 'UNICON_STORE_WRITE_KEY', 'UNICONBASEAPPS_API_KEY']
const DEFAULT_SECRETS_FILE = path.join(os.homedir(), '.unicon-secrets.json')

function secretsFilePath(config, env) {
  const environment = env || process.env
  if (environment && environment[SECRETS_FILE_ENV]) return path.resolve(String(environment[SECRETS_FILE_ENV]))
  const configured = (config && config.secretsPath) || ''
  if (configured) return path.resolve(String(configured))
  return DEFAULT_SECRETS_FILE
}

// Reads the file once per call. A malformed file is reported, never guessed at.
function readSecretsFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, exists: false, reason: 'The secrets file does not exist: ' + filePath, data: null }
  }
  const parsed = readJsonFile(filePath, null)
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, exists: true, reason: 'The secrets file is not valid JSON: ' + filePath, data: null }
  }
  const store = parsed.store && typeof parsed.store === 'object' ? parsed.store : {}
  return {
    ok: true,
    exists: true,
    reason: '',
    data: {
      store: {
        baseUrl: String(store.baseUrl || ''),
        readKey: String(store.readKey || ''),
        writeKey: String(store.writeKey || ''),
        tenantHeader: String(store.tenantHeader || ''),
        tenantValue: String(store.tenantValue || '')
      }
    }
  }
}

// One key for one purpose: 'read' or 'write'. Environment wins, then the
// secrets file, then the local config.
function resolveKey(config, env, purpose) {
  const environment = env || process.env
  const kind = purpose === 'write' ? 'write' : 'read'
  const names = kind === 'write' ? WRITE_KEY_ENV : READ_KEY_ENV
  for (const name of names) {
    if (environment && environment[name]) {
      return { ok: true, value: String(environment[name]), source: 'env:' + name, kind, fingerprint: fingerprintOf(String(environment[name])) }
    }
  }
  const filePath = secretsFilePath(config, environment)
  const file = readSecretsFile(filePath)
  if (file.ok) {
    const fromFile = kind === 'write' ? file.data.store.writeKey : file.data.store.readKey
    if (fromFile) {
      return {
        ok: true,
        value: fromFile,
        source: 'secrets file (' + filePath + ')',
        kind,
        fingerprint: fingerprintOf(fromFile)
      }
    }
  }
  const cms = (config && config.cms) || {}
  const fallback = kind === 'write' ? cms.writeKey : cms.apiKey
  if (fallback) {
    return {
      ok: true,
      value: String(fallback),
      source: 'config.local.json (cms.' + (kind === 'write' ? 'writeKey' : 'apiKey') + ')',
      kind,
      fingerprint: fingerprintOf(String(fallback))
    }
  }
  return {
    ok: false,
    code: 'MISSING_CREDENTIAL',
    kind,
    reason: 'No store ' + kind + ' key: put "store.' + kind + 'Key" in ' + filePath +
      ' (or set ' + names[0] + ').',
    setting: 'store.' + kind + 'Key / ' + names[0],
    secretsFile: filePath,
    secretsFileExists: file.exists,
    questionRef: kind === 'write' ? 'Q-01, Q-03' : 'Q-01, Q-03'
  }
}

// What may be shown: presence, source and a masked fingerprint per purpose.
function describeKeys(config, env) {
  const read = resolveKey(config, env, 'read')
  const write = resolveKey(config, env, 'write')
  const filePath = secretsFilePath(config, env)
  const file = readSecretsFile(filePath)
  return {
    secretsFile: filePath,
    secretsFileExists: file.exists,
    secretsFileProblem: file.ok ? '' : file.reason,
    read: { present: read.ok, source: read.ok ? read.source : '', fingerprint: read.ok ? read.fingerprint : '', reason: read.ok ? '' : read.reason },
    write: { present: write.ok, source: write.ok ? write.source : '', fingerprint: write.ok ? write.fingerprint : '', reason: write.ok ? '' : write.reason },
    // Two keys are the operator's decision (Q-01); a single key reports that the
    // write path is using the read key.
    separateKeys: Boolean(read.ok && write.ok && read.value !== write.value)
  }
}

module.exports = {
  SECRETS_FILE_ENV,
  READ_KEY_ENV,
  WRITE_KEY_ENV,
  DEFAULT_SECRETS_FILE,
  secretsFilePath,
  readSecretsFile,
  resolveKey,
  describeKeys
}
