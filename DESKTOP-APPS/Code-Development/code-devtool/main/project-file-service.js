// CodeDevTool - project file service
// The ONLY path to the disk for project files. Every call site resolves
// through here, and every path is checked against the ROOT-ONLY invariant
// (code-devtool-ssot.html section 7.1): nothing outside the project root
// can ever be reached.

const fs = require('fs')
const path = require('path')

const ignoredFolderNames = new Set(['node_modules', '.git', '.next'])

function resolveInsideRoot(projectRoot, relativePath) {
  const resolvedPath = path.resolve(projectRoot, relativePath || '')
  if (resolvedPath !== projectRoot && !resolvedPath.startsWith(projectRoot + path.sep)) {
    throw new Error('Path escapes the project root')
  }
  return resolvedPath
}

function listDirectory(projectRoot, relativePath) {
  const absolutePath = resolveInsideRoot(projectRoot, relativePath)
  const directoryEntries = fs.readdirSync(absolutePath, { withFileTypes: true })
  const visibleEntries = directoryEntries
    .filter((entry) => (entry.isDirectory() ? !ignoredFolderNames.has(entry.name) : true))
    .map((entry) => {
      const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name
      return {
        name: entry.name,
        relativePath: entryRelativePath,
        isDirectory: entry.isDirectory()
      }
    })
  visibleEntries.sort((leftEntry, rightEntry) => {
    if (leftEntry.isDirectory !== rightEntry.isDirectory) return leftEntry.isDirectory ? -1 : 1
    return leftEntry.name.localeCompare(rightEntry.name)
  })
  return visibleEntries
}

function readFile(projectRoot, relativePath, maximumBytes = 500000) {
  const absolutePath = resolveInsideRoot(projectRoot, relativePath)
  try {
    const fileStats = fs.statSync(absolutePath)
    if (!fileStats.isFile()) return { content: '', error: 'Not a file' }
    if (fileStats.size > maximumBytes) {
      return { content: '', size: fileStats.size, error: 'File is too large (' + fileStats.size + ' bytes, cap ' + maximumBytes + ')' }
    }
    return { content: fs.readFileSync(absolutePath, 'utf8'), size: fileStats.size }
  } catch (readError) {
    return { content: '', error: readError.message }
  }
}

function writeFile(projectRoot, relativePath, content) {
  const absolutePath = resolveInsideRoot(projectRoot, relativePath)
  fs.writeFileSync(absolutePath, content, 'utf8')
  return true
}

function deleteFile(projectRoot, relativePath) {
  const absolutePath = resolveInsideRoot(projectRoot, relativePath)
  fs.unlinkSync(absolutePath)
  return true
}

const searchableExtensions = new Set(['.html', '.css', '.js', '.mjs', '.cjs', '.json', '.md', '.txt', '.svg', '.xml', '.jsx', '.tsx', '.ts', '.scss', '.less', '.vue'])

function searchText(projectRoot, query, maximumResults = 200) {
  const normalizedQuery = query.toLowerCase()
  const results = []

  const walkDirectory = (relativeDirectory) => {
    if (results.length >= maximumResults) return
    let directoryEntries
    try {
      directoryEntries = fs.readdirSync(resolveInsideRoot(projectRoot, relativeDirectory), { withFileTypes: true })
    } catch (_readError) {
      return
    }
    for (const entry of directoryEntries) {
      if (results.length >= maximumResults) return
      const entryRelativePath = relativeDirectory ? path.join(relativeDirectory, entry.name) : entry.name
      if (entry.isDirectory()) {
        if (ignoredFolderNames.has(entry.name)) continue
        walkDirectory(entryRelativePath)
      } else {
        if (!searchableExtensions.has(path.extname(entry.name).toLowerCase())) continue
        let fileContent
        try {
          fileContent = fs.readFileSync(resolveInsideRoot(projectRoot, entryRelativePath), 'utf8')
        } catch (_readError) {
          continue
        }
        if (fileContent.length > 200000) continue
        const lines = fileContent.split(/\r?\n/)
        lines.forEach((line, lineIndex) => {
          if (line.toLowerCase().includes(normalizedQuery) && results.length < maximumResults) {
            results.push({ path: entryRelativePath, lineNumber: lineIndex + 1, preview: line.trim().slice(0, 160) })
          }
        })
      }
    }
  }

  walkDirectory('')
  return results
}

module.exports = { listDirectory, resolveInsideRoot, readFile, writeFile, deleteFile, searchText }
