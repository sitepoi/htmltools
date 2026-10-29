'use strict'

// All file access for a generated application goes through this class so a
// bad task (or a bad model) can never write outside the run folder.

const fs = require('fs')
const path = require('path')
const { ensureDir, writeTextAtomic, readJsonFile } = require('../util')

const IGNORED_FOLDERS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.backup', 'runs', '.cache'
])
const SOURCE_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.html', '.htm', '.css', '.json', '.md', '.txt', '.svg'])

class Workspace {
  constructor(rootDirectory) {
    this.root = path.resolve(rootDirectory)
    ensureDir(this.root)
  }

  resolveInside(relativePath) {
    const cleaned = String(relativePath || '').replace(/\\/g, '/').trim()
    if (!cleaned) throw new Error('A file path is required.')
    if (cleaned.startsWith('/') || /^[a-zA-Z]:/.test(cleaned)) {
      throw new Error('Absolute paths are not allowed: ' + cleaned)
    }
    const resolved = path.resolve(this.root, cleaned)
    const rootWithSeparator = this.root.endsWith(path.sep) ? this.root : this.root + path.sep
    if (resolved !== this.root && !resolved.startsWith(rootWithSeparator)) {
      throw new Error('Path escapes the application folder: ' + cleaned)
    }
    return resolved
  }

  relativeOf(absolutePath) {
    return path.relative(this.root, absolutePath).replace(/\\/g, '/')
  }

  exists(relativePath) {
    try {
      return fs.existsSync(this.resolveInside(relativePath))
    } catch (_error) {
      return false
    }
  }

  readText(relativePath) {
    return fs.readFileSync(this.resolveInside(relativePath), 'utf8')
  }

  readJson(relativePath, fallbackValue) {
    return readJsonFile(this.resolveInside(relativePath), fallbackValue)
  }

  writeText(relativePath, content) {
    const absolutePath = this.resolveInside(relativePath)
    ensureDir(path.dirname(absolutePath))
    writeTextAtomic(absolutePath, content)
    return this.relativeOf(absolutePath)
  }

  deleteFile(relativePath) {
    const absolutePath = this.resolveInside(relativePath)
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath)
  }

  sizeOf(relativePath) {
    try {
      return fs.statSync(this.resolveInside(relativePath)).size
    } catch (_error) {
      return 0
    }
  }

  listFiles(options) {
    const settings = options || {}
    const maxDepth = Number(settings.maxDepth) || 6
    const maxFiles = Number(settings.maxFiles) || 400
    const extensions = settings.extensions || null
    const results = []

    const walk = (currentDirectory, depth) => {
      if (depth > maxDepth || results.length >= maxFiles) return
      let entries = []
      try {
        entries = fs.readdirSync(currentDirectory, { withFileTypes: true })
      } catch (_error) {
        return
      }
      entries.sort((left, right) => left.name.localeCompare(right.name))
      for (const entry of entries) {
        if (results.length >= maxFiles) return
        if (entry.name.startsWith('.')) continue
        const absolutePath = path.join(currentDirectory, entry.name)
        if (entry.isDirectory()) {
          if (IGNORED_FOLDERS.has(entry.name)) continue
          walk(absolutePath, depth + 1)
          continue
        }
        const extension = path.extname(entry.name).toLowerCase()
        if (extensions && !extensions.includes(extension)) continue
        let size = 0
        let modifiedAt = null
        try {
          const stats = fs.statSync(absolutePath)
          size = stats.size
          modifiedAt = stats.mtime.toISOString()
        } catch (_statError) {
          // keep defaults
        }
        results.push({
          relativePath: this.relativeOf(absolutePath),
          size,
          modifiedAt,
          extension
        })
      }
    }

    walk(this.root, 0)
    return results
  }

  sourceFiles(options) {
    const settings = options || {}
    const extensions = settings.extensions || Array.from(SOURCE_EXTENSIONS)
    return this.listFiles(Object.assign({}, settings, { extensions }))
      .filter((file) => !file.relativePath.endsWith('.min.js'))
  }

  isEmpty() {
    return this.listFiles({ maxFiles: 1, maxDepth: 4 }).length === 0
  }
}

module.exports = { Workspace, SOURCE_EXTENSIONS, IGNORED_FOLDERS }
