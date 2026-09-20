// Unicon Studio - shared workspace context (CODE-24)
// Many Unicon projects are a tree of small, separate web tools with shared
// rule files at the workspace root (e.g. html-tool-rules.txt). This service
// finds that root by walking up from the open folder and returns the rule
// files so the AI chat and the agent always work inside the project's base
// rules - without copying the files into every tool folder.

const fs = require('fs')
const path = require('path')

const maximumRuleFiles = 5
const maximumRuleFileCharacters = 20000

function isRuleFileName(fileName) {
  // Rule files are named like html-tool-rules.txt. "old..." files are
  // retired rules and are excluded from the AI context on purpose.
  return /-rules\.txt$/i.test(fileName) && !fileName.toLowerCase().startsWith('old')
}

function listRuleFiles(folder) {
  try {
    const names = fs.readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isFile() && isRuleFileName(entry.name))
      .map((entry) => entry.name)
    names.sort((firstName, secondName) => {
      if (firstName === 'html-tool-rules.txt') return -1
      if (secondName === 'html-tool-rules.txt') return 1
      return firstName.localeCompare(secondName)
    })
    return names
  } catch (_readError) {
    return []
  }
}

function findWorkspaceRoot(folder) {
  let currentFolder = path.resolve(folder)
  while (true) {
    if (listRuleFiles(currentFolder).length > 0) return currentFolder
    const parentFolder = path.dirname(currentFolder)
    if (parentFolder === currentFolder) return null
    currentFolder = parentFolder
  }
}

function getSharedContext(folder) {
  const workspaceRoot = findWorkspaceRoot(folder)
  if (!workspaceRoot) return { workspaceRoot: null, files: [] }
  const files = []
  for (const fileName of listRuleFiles(workspaceRoot).slice(0, maximumRuleFiles)) {
    try {
      const content = fs.readFileSync(path.join(workspaceRoot, fileName), 'utf8')
        .slice(0, maximumRuleFileCharacters)
      files.push({ name: fileName, content: content })
    } catch (_readError) {
      // A missing file is skipped; the other rules still apply.
    }
  }
  return { workspaceRoot: workspaceRoot, files: files }
}

function buildSharedContextBlocks(files) {
  return files.map((file) => ({
    role: 'system',
    content: 'Shared workspace rule file "' + file.name + '" (from the workspace root):\n```\n' + file.content + '\n```'
  }))
}

module.exports = { getSharedContext, findWorkspaceRoot, listRuleFiles, buildSharedContextBlocks, isRuleFileName }
