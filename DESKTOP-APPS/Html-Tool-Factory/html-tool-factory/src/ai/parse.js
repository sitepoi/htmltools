'use strict'

// Tolerant JSON extraction for model output. Models wrap JSON in prose,
// markdown fences, or leave a trailing comma. Everything is repaired here so
// callers only ever see a plain object or a clear error message.

function stripCodeFences(text) {
  const value = String(text || '')
  const fenceMatch = value.match(/```(?:json|javascript|js)?\s*([\s\S]*?)```/i)
  if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim()
  return value.trim()
}

function removeTrailingCommas(text) {
  let result = ''
  let inString = false
  let quoteCharacter = ''
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const previous = result.slice(-1)
    if (inString) {
      result += character
      if (character === '\\') {
        result += text[index + 1] || ''
        index += 1
      } else if (character === quoteCharacter) {
        inString = false
      }
      continue
    }
    if (character === '"' || character === "'") {
      inString = true
      quoteCharacter = character
      result += character
      continue
    }
    if (character === ',') {
      const rest = text.slice(index + 1)
      if (/^\s*[}\]]/.test(rest)) continue
      if (previous === undefined) continue
    }
    result += character
  }
  return result
}

function parseJsonLoose(rawText, options) {
  const settings = options || {}
  const original = String(rawText == null ? '' : rawText)
  if (!original.trim()) {
    throw new Error('The model returned an empty response' + (settings.hint ? ' (' + settings.hint + ')' : ''))
  }
  const attempts = []
  const fenceStripped = stripCodeFences(original)
  attempts.push(fenceStripped)

  const firstObject = fenceStripped.indexOf('{')
  const lastObject = fenceStripped.lastIndexOf('}')
  if (firstObject >= 0 && lastObject > firstObject) {
    attempts.push(fenceStripped.slice(firstObject, lastObject + 1))
  }
  const firstArray = fenceStripped.indexOf('[')
  const lastArray = fenceStripped.lastIndexOf(']')
  if (firstArray >= 0 && lastArray > firstArray) {
    attempts.push(fenceStripped.slice(firstArray, lastArray + 1))
  }

  let lastError = null
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt)
    } catch (error) {
      lastError = error
      try {
        return JSON.parse(removeTrailingCommas(attempt))
      } catch (secondError) {
        lastError = secondError
      }
    }
  }
  const preview = fenceStripped.slice(0, 400).replace(/\s+/g, ' ')
  throw new Error('The model did not return valid JSON: ' + (lastError ? lastError.message : 'unknown reason') +
    '. Response started with: ' + preview)
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function asText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function requireArrayField(parsed, fieldName, contractName) {
  if (!Array.isArray(parsed[fieldName])) {
    throw new Error('The ' + contractName + ' answer is missing the "' + fieldName + '" array')
  }
  return parsed[fieldName]
}

module.exports = { parseJsonLoose, asArray, asText, requireArrayField, stripCodeFences }
