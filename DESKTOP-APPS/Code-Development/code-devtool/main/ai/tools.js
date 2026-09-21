// CodeDevTool - agent tool registry (T-10)
// The ONLY capabilities the agent has. Every path goes through
// project-file-service (ROOT-ONLY invariant, section 7.1) and every
// command goes through the approval gate (T-12).

const documentSystem = require('../document-system')

const maximumToolOutputCharacters = 20000
const maximumWrittenCharacters = 300000

function validatePathArgument(argumentsObject) {
  if (!argumentsObject || typeof argumentsObject.path !== 'string' || !argumentsObject.path.trim()) {
    return { ok: false, error: 'Missing path argument' }
  }
  return { ok: true, path: argumentsObject.path.trim() }
}

const toolDefinitions = [
  {
    name: 'read_file',
    description: 'Read a text file inside the project and return its content.',
    parameters: { path: 'File path relative to the project root' },
    run: (argumentsObject, context) => {
      const validated = validatePathArgument(argumentsObject)
      if (!validated.ok) return validated
      const readResult = context.projectFileService.readFile(context.projectRoot, validated.path)
      if (readResult.error) return { ok: false, error: readResult.error }
      return { ok: true, result: readResult.content.slice(0, maximumToolOutputCharacters) }
    }
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file inside the project with the given content.',
    parameters: { path: 'File path relative to the project root', content: 'Full new content of the file' },
    run: (argumentsObject, context) => {
      const validated = validatePathArgument(argumentsObject)
      if (!validated.ok) return validated
      const content = typeof argumentsObject.content === 'string' ? argumentsObject.content : ''
      if (content.length > maximumWrittenCharacters) {
        return { ok: false, error: 'Content is too large (' + content.length + ' characters, cap ' + maximumWrittenCharacters + ')' }
      }
      try {
        context.projectFileService.writeFile(context.projectRoot, validated.path, content)
        return { ok: true, result: 'Wrote ' + validated.path + ' (' + content.length + ' characters)' }
      } catch (writeError) {
        return { ok: false, error: writeError.message }
      }
    }
  },
  {
    name: 'edit_file',
    description: 'Replace the FIRST occurrence of an exact text inside a file. Fails when the text is not found.',
    parameters: { path: 'File path relative to the project root', find: 'Exact text to find', replace: 'Replacement text' },
    run: (argumentsObject, context) => {
      const validated = validatePathArgument(argumentsObject)
      if (!validated.ok) return validated
      const findText = typeof argumentsObject.find === 'string' ? argumentsObject.find : ''
      if (!findText) return { ok: false, error: 'Missing find text' }
      const replaceText = typeof argumentsObject.replace === 'string' ? argumentsObject.replace : ''
      const readResult = context.projectFileService.readFile(context.projectRoot, validated.path)
      if (readResult.error) return { ok: false, error: readResult.error }
      const matchIndex = readResult.content.indexOf(findText)
      if (matchIndex === -1) return { ok: false, error: 'The text to find was not found in ' + validated.path }
      const updatedContent = readResult.content.slice(0, matchIndex) + replaceText + readResult.content.slice(matchIndex + findText.length)
      try {
        context.projectFileService.writeFile(context.projectRoot, validated.path, updatedContent)
        return { ok: true, result: 'Replaced text in ' + validated.path }
      } catch (writeError) {
        return { ok: false, error: writeError.message }
      }
    }
  },
  {
    name: 'list_dir',
    description: 'List the entries of a folder inside the project.',
    parameters: { path: 'Folder path relative to the project root (empty string for the root)' },
    run: (argumentsObject, context) => {
      const folderPath = argumentsObject && typeof argumentsObject.path === 'string' ? argumentsObject.path : ''
      try {
        const entries = context.projectFileService.listDirectory(context.projectRoot, folderPath)
        return { ok: true, result: entries.map((entry) => (entry.isDirectory ? '[dir] ' : '      ') + entry.relativePath).join('\n') }
      } catch (listError) {
        return { ok: false, error: listError.message }
      }
    }
  },
  {
    name: 'search_files',
    description: 'Search the project text files for a query (case-insensitive).',
    parameters: { query: 'Text to search for (at least 2 characters)' },
    run: (argumentsObject, context) => {
      const query = argumentsObject && typeof argumentsObject.query === 'string' ? argumentsObject.query.trim() : ''
      if (query.length < 2) return { ok: false, error: 'Query must be at least 2 characters' }
      try {
        const results = context.projectFileService.searchText(context.projectRoot, query)
        if (results.length === 0) return { ok: true, result: 'No matches' }
        return { ok: true, result: results.slice(0, 50).map((match) => match.path + ':' + match.lineNumber + '  ' + match.preview).join('\n') }
      } catch (searchError) {
        return { ok: false, error: searchError.message }
      }
    }
  },
  {
    name: 'run_command',
    description: 'Run one shell command in the project root. The user approves every command before it runs.',
    parameters: { command: 'The full command to run' },
    run: async (argumentsObject, context) => {
      const command = argumentsObject && typeof argumentsObject.command === 'string' ? argumentsObject.command.trim() : ''
      if (!command) return { ok: false, error: 'Missing command' }
      const approved = await context.requestApproval(command)
      if (!approved) return { ok: false, error: 'Command not approved by the user' }
      const runResult = await context.terminalService.runCommand(command, {
        cwd: context.projectRoot,
        onOutput: (text) => context.emitToolOutput(text),
        timeoutMs: 120000
      })
      if (runResult.error) return { ok: false, error: runResult.error }
      const outputText = (runResult.output || '').slice(-maximumToolOutputCharacters)
      return {
        ok: runResult.exitCode === 0,
        result: 'Exit code ' + runResult.exitCode + (runResult.timedOut ? ' (timed out)' : '') + '\n' + outputText
      }
    }
  },
  {
    name: 'create_document',
    description: 'Create a project document inside _docs/ from the bundled templates (the document system ruleset): the SSOT working document, the satellites (help, marketing, updates, social, onepager, presentation) or the monthly digest. Shared design files are copied automatically. Existing files are never overwritten.',
    parameters: {
      type: 'One of: ssot, help, marketing, updates, social, onepager, presentation, monthly',
      name: 'Feature name slug (lowercase letters, digits, hyphens), e.g. report-builder - not used for monthly'
    },
    run: (argumentsObject, context) => {
      const type = typeof argumentsObject.type === 'string' ? argumentsObject.type.trim().toLowerCase() : ''
      const name = typeof argumentsObject.name === 'string' ? argumentsObject.name.trim().toLowerCase() : ''
      const result = documentSystem.createDocument(context.projectRoot, { type: type, name: name })
      if (!result.ok) return { ok: false, error: result.error }
      return { ok: true, path: result.path, result: result.message }
    }
  }
]

function toolCatalogText() {
  return toolDefinitions.map((tool) => {
    const parameterText = Object.keys(tool.parameters).map((name) => name + ': ' + tool.parameters[name]).join('; ')
    return '- ' + tool.name + ' (' + parameterText + '): ' + tool.description
  }).join('\n')
}

function toolSchemaForApi() {
  return toolDefinitions.map((tool) => {
    const properties = {}
    const required = []
    Object.keys(tool.parameters).forEach((name) => {
      properties[name] = { type: 'string', description: tool.parameters[name] }
      required.push(name)
    })
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: { type: 'object', properties: properties, required: required }
      }
    }
  })
}

module.exports = { toolDefinitions, toolCatalogText, toolSchemaForApi }
