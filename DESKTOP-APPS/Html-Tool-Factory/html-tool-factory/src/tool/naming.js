'use strict'

// Naming helpers for a generated tool. The repository convention is:
//   folder name       PascalCase, for example ContractClauseFinder
//   app files         app/ContractClauseFinder.html / .css / .js
//   class prefix      a short lowercase prefix, for example ccf-

function wordsOf(name) {
  return String(name || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function toPascalName(name) {
  const words = wordsOf(name)
  if (!words.length) return 'GeneratedTool'
  const joined = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1, 40)).join('')
  const cleaned = joined.replace(/[^A-Za-z0-9]/g, '')
  if (!cleaned) return 'GeneratedTool'
  return /^[0-9]/.test(cleaned) ? 'Tool' + cleaned : cleaned.slice(0, 60)
}

function toClassPrefix(name) {
  const words = wordsOf(name)
  if (!words.length) return 'tl-'
  if (words.length === 1) return words[0].slice(0, 3).toLowerCase() + '-'
  const initials = words.map((word) => word.charAt(0).toLowerCase()).join('')
  return (initials.length >= 2 ? initials : words[0].slice(0, 3).toLowerCase()) + '-'
}

function toKebabSlug(name) {
  const words = wordsOf(name)
  if (!words.length) return 'generated-tool'
  return words.map((word) => word.toLowerCase()).join('-').slice(0, 60)
}

function toolPathsFor(toolName) {
  return {
    html: 'app/' + toolName + '.html',
    css: 'app/' + toolName + '.css',
    js: 'app/' + toolName + '.js',
    harness: 'app/test-harness.html'
  }
}

module.exports = { toPascalName, toClassPrefix, toKebabSlug, toolPathsFor, wordsOf }
