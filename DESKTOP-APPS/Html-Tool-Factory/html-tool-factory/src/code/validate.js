'use strict'

// Deterministic verification that runs before anything is trusted. Model
// output is never assumed to be correct: the generated files have to parse.

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { validateContractFile } = require('../tool/contract')

const BALANCED_TAGS_STRICT = ['div', 'section', 'article', 'aside', 'main', 'header', 'footer', 'nav',
  'form', 'table', 'thead', 'tbody', 'tfoot', 'script', 'style', 'select', 'textarea', 'button']
const BALANCED_TAGS_LOOSE = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'p', 'label']

const SECRET_PATTERNS = [
  { pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, message: 'A private key block was written into the application.' },
  { pattern: /AKIA[0-9A-Z]{16}/, message: 'An AWS access key id was written into the application.' },
  { pattern: /\bsk-[A-Za-z0-9]{24,}\b/, message: 'Something that looks like an API secret key was written into the application.' }
]

function stripHtmlComments(htmlText) {
  return String(htmlText).replace(/<!--[\s\S]*?-->/g, '')
}

function countTag(htmlText, tagName) {
  const openPattern = new RegExp('<' + tagName + '(?=[\\s>/])', 'gi')
  const closePattern = new RegExp('</' + tagName + '\\s*>', 'gi')
  const openMatches = htmlText.match(openPattern) || []
  const closeMatches = htmlText.match(closePattern) || []
  const selfClosing = (htmlText.match(new RegExp('<' + tagName + '[^>]*/>', 'gi')) || []).length
  return { open: openMatches.length - selfClosing, close: closeMatches.length }
}

function validateHtml(filePath, text, problems) {
  const withoutComments = stripHtmlComments(text)
  BALANCED_TAGS_STRICT.forEach((tagName) => {
    const counts = countTag(withoutComments, tagName)
    if (counts.open !== counts.close) {
      problems.push({ level: 'error', message: '<' + tagName + '> opens ' + counts.open + ' times but closes ' + counts.close + ' times' })
    }
  })
  BALANCED_TAGS_LOOSE.forEach((tagName) => {
    const counts = countTag(withoutComments, tagName)
    if (counts.open !== counts.close) {
      problems.push({ level: 'warn', message: '<' + tagName + '> opens ' + counts.open + ' times but closes ' + counts.close + ' times' })
    }
  })
  const scriptOpen = (withoutComments.match(/<script\b/gi) || []).length
  const scriptClose = (withoutComments.match(/<\/script\s*>/gi) || []).length
  if (scriptOpen !== scriptClose) {
    problems.push({ level: 'error', message: 'Script tags are unbalanced (' + scriptOpen + ' open, ' + scriptClose + ' close)' })
  }
  if (/<html\b/i.test(withoutComments) && !/<\/html\s*>/i.test(withoutComments)) {
    problems.push({ level: 'error', message: 'The document opens <html> but never closes it' })
  }
}

function validateCss(text, problems) {
  const openBraces = (text.match(/{/g) || []).length
  const closeBraces = (text.match(/}/g) || []).length
  if (openBraces !== closeBraces) {
    problems.push({ level: 'error', message: 'CSS braces are unbalanced (' + openBraces + ' open, ' + closeBraces + ' close)' })
  }
}

function validateJavaScript(filePath, text, problems) {
  const temporaryPath = filePath.endsWith('.mjs') ? path.join(path.dirname(filePath), '.check-' + Date.now() + '.mjs') : filePath
  if (temporaryPath !== filePath) fs.writeFileSync(temporaryPath, text, 'utf8')
  try {
    const result = spawnSync(process.execPath, ['--check', temporaryPath], { encoding: 'utf8', timeout: 20000 })
    if (result.status !== 0) {
      const detail = String(result.stderr || result.stdout || '').split('\n').slice(0, 4).join(' ')
      problems.push({ level: 'error', message: 'JavaScript syntax error: ' + detail.slice(0, 300) })
    }
  } finally {
    if (temporaryPath !== filePath) {
      try { fs.unlinkSync(temporaryPath) } catch (_error) { /* ignore */ }
    }
  }
}

function scanDocumentStyle(text, problems) {
  if (/[\u2014]/.test(text)) {
    problems.push({ level: 'warn', message: 'Document style: use a hyphen instead of an em dash' })
  }
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) {
    problems.push({ level: 'warn', message: 'Document style: emoji found in a document' })
  }
}

function scanSecrets(text, problems) {
  SECRET_PATTERNS.forEach(({ pattern, message }) => {
    if (pattern.test(text)) problems.push({ level: 'error', message })
  })
}

function validateText(relativePath, text, options) {
  const settings = options || {}
  const problems = []
  const extension = path.extname(relativePath).toLowerCase()
  const absolutePath = settings.absolutePath || relativePath

  scanSecrets(text, problems)

  // A generated html tool must satisfy the repository tool contract, not just
  // parse: build stamps, no framework leftovers, no forbidden browser apis.
  if (/^app\//.test(String(relativePath).replace(/\\/g, '/'))) {
    const contract = validateContractFile(relativePath, text)
    contract.problems.forEach((problem) => problems.push(problem))
  }

  if (['.js', '.cjs', '.mjs'].includes(extension)) {
    validateJavaScript(absolutePath, text, problems)
  } else if (extension === '.json') {
    try {
      JSON.parse(text)
    } catch (error) {
      problems.push({ level: 'error', message: 'JSON parse error: ' + error.message })
    }
  } else if (extension === '.html' || extension === '.htm') {
    validateHtml(absolutePath, text, problems)
    scanDocumentStyle(text, problems)
  } else if (extension === '.css') {
    validateCss(text, problems)
  } else if (extension === '.md' || extension === '.txt') {
    scanDocumentStyle(text, problems)
  }

  return {
    file: relativePath,
    ok: problems.every((problem) => problem.level !== 'error'),
    problems
  }
}

function validateFile(workspace, relativePath) {
  const absolutePath = workspace.resolveInside(relativePath)
  if (!fs.existsSync(absolutePath)) {
    return { file: relativePath, ok: false, problems: [{ level: 'error', message: 'The file does not exist' }] }
  }
  const text = fs.readFileSync(absolutePath, 'utf8')
  return validateText(relativePath, text, { absolutePath })
}

function validateFiles(workspace, relativePaths) {
  const results = (Array.isArray(relativePaths) ? relativePaths : []).map((relativePath) => validateFile(workspace, relativePath))
  return {
    ok: results.every((result) => result.ok),
    results,
    errors: results.flatMap((result) => result.problems
      .filter((problem) => problem.level === 'error')
      .map((problem) => result.file + ': ' + problem.message)),
    warnings: results.flatMap((result) => result.problems
      .filter((problem) => problem.level === 'warn')
      .map((problem) => result.file + ': ' + problem.message))
  }
}

module.exports = { validateText, validateFile, validateFiles, scanSecrets }
