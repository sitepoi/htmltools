// Unicon Studio - agent runtime (T-11, T-12, T-13)
// The plan-and-execute loop: the model plans steps, calls tools (registry
// in tools.js), every run_command waits for user approval, and every file
// write is snapshotted for review and undo. Runs in the main process.

const client = require('./openai-compatible-client')
const { toolDefinitions, toolCatalogText, toolSchemaForApi } = require('./tools')
const { buildExternalTools, callExternalTool } = require('./mcp-client')
const projectFileService = require('../project-file-service')
const terminalService = require('../terminal-service')
const documentSystem = require('../document-system')

const maximumSteps = 6
const maximumToolIterations = 12
const maximumAttachmentCharacters = 20000
const approvalTimeoutMilliseconds = 300000

function parseJsonLenient(text) {
  const cleaned = String(text)
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null
  const jsonText = cleaned.slice(firstBrace, lastBrace + 1).replace(/,\s*([}\]])/g, '$1')
  try {
    return JSON.parse(jsonText)
  } catch (_parseError) {
    return null
  }
}

function parsePlan(text) {
  const parsed = parseJsonLenient(text)
  const steps = parsed && Array.isArray(parsed.steps)
    ? parsed.steps.filter((step) => step && step.title).slice(0, maximumSteps)
    : []
  if (steps.length > 0) {
    return steps.map((step) => ({
      title: String(step.title).slice(0, 100),
      file: typeof step.file === 'string' ? step.file : '',
      action: typeof step.action === 'string' ? step.action : String(step.title)
    }))
  }
  return [{ title: 'Direct task', file: '', action: 'Complete the request directly with tools' }]
}

function buildPlanMessages(attachmentBlocks, userText, sharedContextBlocks, documentRulesBlock) {
  const messages = []
  messages.push({
    role: 'system',
    content: 'You are the planning stage of the Unicon Studio coding agent. ' +
      'Return ONLY JSON: {"steps":[{"title":"short step title","file":"relative path or empty","action":"concrete instructions for that step"}]}. ' +
      'At most 6 steps, concrete and ordered. No prose outside the JSON.'
  })
  if (documentRulesBlock) messages.push(documentRulesBlock)
  sharedContextBlocks.forEach((block) => messages.push(block))
  attachmentBlocks.forEach((attachment) => {
    messages.push({ role: 'system', content: 'Attached file "' + attachment.path + '":\n```\n' + attachment.content + '\n```' })
  })
  messages.push({ role: 'user', content: userText })
  return messages
}

function decodeXmlEntities(value) {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function parseXmlParameterValue(rawValue) {
  const trimmed = String(rawValue).trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = parseJsonLenient(trimmed)
    if (parsed !== null) return parsed
  }
  return trimmed
}

// CODE-33: some gateway models reply with Anthropic-style XML tool calls
// instead of the JSON the prompt asks for:
// <tool_calls><invoke name="read_file"><parameter name="path">a.html</parameter></invoke></tool_calls>
function parseXmlToolCalls(content) {
  const text = String(content || '')
  const calls = []
  const invokePattern = /<invoke\b([^>]*)>([\s\S]*?)<\/invoke\s*>/g
  let invokeMatch
  while ((invokeMatch = invokePattern.exec(text)) !== null) {
    const nameMatch = /name\s*=\s*["']([^"']+)["']/.exec(invokeMatch[1])
    if (!nameMatch) continue
    const callArguments = {}
    const parameterPattern = /<parameter\b([^>]*)>([\s\S]*?)<\/parameter\s*>/g
    let parameterMatch
    while ((parameterMatch = parameterPattern.exec(invokeMatch[2])) !== null) {
      const parameterNameMatch = /name\s*=\s*["']([^"']+)["']/.exec(parameterMatch[1])
      if (!parameterNameMatch) continue
      const parameterName = parameterNameMatch[1]
      const parsedValue = parseXmlParameterValue(decodeXmlEntities(parameterMatch[2]))
      if (parameterName === 'arguments' && parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)) {
        Object.assign(callArguments, parsedValue)
      } else {
        callArguments[parameterName] = parsedValue
      }
    }
    calls.push({ name: nameMatch[1], arguments: callArguments })
  }
  return calls
}

function stripToolCallMarkup(text) {
  // Defensive: raw tool-call markup that survives parsing must never leak
  // into the visible chat summary.
  return String(text || '')
    .replace(/<tool_calls\b[^>]*>[\s\S]*?<\/tool_calls\s*>/g, '')
    .replace(/<tool_call\b[^>]*>[\s\S]*?<\/tool_call\s*>/g, '')
    .trim()
}

function parsePromptToolCalls(content) {
  // Prompt-based tool calling (CODE-29, Unicon gateway): the model replies
  // with JSON like {"toolCalls":[{"name":"...","arguments":{...}}]} (or a
  // bare array), or with <tool_calls><invoke> XML blocks (CODE-33) - both
  // are normalized to the same call shape.
  const cleaned = String(content || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  let parsed = null
  try {
    parsed = JSON.parse(cleaned)
  } catch (_parseError) {
    parsed = null
  }
  if (parsed === null) parsed = parseJsonLenient(cleaned)
  let rawCalls = []
  if (parsed) {
    rawCalls = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.toolCalls) ? parsed.toolCalls : [])
  }
  if (rawCalls.length === 0) rawCalls = parseXmlToolCalls(cleaned)
  return rawCalls
    .filter((call) => call && typeof call.name === 'string')
    .slice(0, 6)
    .map((call, callIndex) => ({
      id: 'prompt_tool_' + callIndex,
      name: call.name,
      arguments: call.arguments && typeof call.arguments === 'object' ? call.arguments : {}
    }))
}

function buildStepMessages({ step, stepIndex, totalSteps, attachments, userText, externalCatalogText, sharedContextBlocks, toolCallMode, documentRulesBlock }) {
  const messages = []
  const toolCallingInstruction = toolCallMode === 'prompt'
    ? '\nTool calling: when you need a tool, reply with ONLY a tool call and nothing else, in one of these two forms (JSON or XML):\n' +
      'JSON: {"toolCalls":[{"name":"tool_name","arguments":{...}}]}\n' +
      'XML: <tool_calls><invoke name="tool_name"><parameter name="arg">value</parameter></invoke></tool_calls>\n' +
      'Tool results come back as user messages. When the step is finished, reply with a short status message as plain text (no tool calls).'
    : ''
  messages.push({
    role: 'system',
    content: 'You are the Unicon Studio coding agent. Original request: ' + userText + '\n' +
      'Current step ' + (stepIndex + 1) + ' of ' + totalSteps + ': ' + step.title + (step.file ? ' (file: ' + step.file + ')' : '') + '.\n' +
      'Available tools:\n' + toolCatalogText() + externalCatalogText + '\n' +
      'Use tools to inspect and edit the project. Prefer edit_file over write_file for small changes. ' +
      'Do not ask permission for file edits - the user reviews them after the run. ' + toolCallingInstruction
  })
  if (documentRulesBlock) messages.push(documentRulesBlock)
  sharedContextBlocks.forEach((block) => messages.push(block))
  attachments.forEach((attachment) => {
    messages.push({ role: 'system', content: 'Attached file "' + attachment.path + '":\n```\n' + attachment.content + '\n```' })
  })
  messages.push({ role: 'user', content: step.action })
  return messages
}

function waitForApproval(runRecord, command) {
  // CODE-31: "Approve all in this session" - after the user approves all,
  // every further command in this run is auto-approved and shown to the
  // user as approved without waiting.
  if (runRecord.autoApproveAll) {
    runRecord.emit('approval-request', { command: command, autoApproved: true })
    return Promise.resolve(true)
  }
  return new Promise((resolve) => {
    runRecord.pendingApprovalResolver = resolve
    runRecord.approvalTimeout = setTimeout(() => resolveApproval(runRecord, false), approvalTimeoutMilliseconds)
    runRecord.emit('approval-request', { command: command })
  })
}

function resolveApproval(runRecord, decision) {
  if (!runRecord.pendingApprovalResolver) return
  clearTimeout(runRecord.approvalTimeout)
  const resolver = runRecord.pendingApprovalResolver
  runRecord.pendingApprovalResolver = null
  runRecord.approvalTimeout = null
  resolver(decision)
}

function summarizeArguments(argumentsObject) {
  try {
    return JSON.stringify(argumentsObject).slice(0, 140)
  } catch (_stringifyError) {
    return ''
  }
}

function summarizeToolResult(toolResult) {
  if (toolResult.ok) return String(toolResult.result || '').slice(0, 140)
  return (toolResult.error || 'error').slice(0, 140)
}

async function executeTool(call, runRecord, changes, externalTools) {
  const externalCaller = externalTools && externalTools.callers.get(call.name)
  if (externalCaller) {
    try {
      return await callExternalTool(externalCaller, call.arguments || {})
    } catch (externalError) {
      return { ok: false, error: externalError && externalError.message ? externalError.message : String(externalError) }
    }
  }
  const tool = toolDefinitions.find((candidate) => candidate.name === call.name)
  if (!tool) return { ok: false, error: 'Unknown tool: ' + call.name }
  const projectRoot = runRecord.projectRoot
  const toolContext = {
    projectRoot: projectRoot,
    projectFileService: projectFileService,
    terminalService: terminalService,
    requestApproval: (command) => waitForApproval(runRecord, command),
    emitToolOutput: (text) => runRecord.emit('tool-output', { text: text })
  }

  let beforeSnapshot = null
  if (call.name === 'write_file' || call.name === 'edit_file') {
    const pathValue = call.arguments && typeof call.arguments.path === 'string' ? call.arguments.path : ''
    const beforeRead = projectFileService.readFile(projectRoot, pathValue)
    beforeSnapshot = {
      path: pathValue,
      before: beforeRead.content !== undefined && !beforeRead.error ? beforeRead.content : '',
      existedBefore: beforeRead.content !== undefined && !beforeRead.error
    }
  }

  const toolResult = await tool.run(call.arguments || {}, toolContext)

  // Documents created by create_document are undoable like any other write:
  // undo removes a file that did not exist before the run.
  if (call.name === 'create_document' && toolResult.ok && toolResult.path) {
    changes.push({ path: toolResult.path, before: '', existedBefore: false })
    runRecord.emit('change', { path: toolResult.path })
  }

  if (beforeSnapshot && toolResult.ok) {
    const afterRead = projectFileService.readFile(projectRoot, beforeSnapshot.path)
    const afterContent = afterRead.content !== undefined && !afterRead.error ? afterRead.content : ''
    if (afterContent !== beforeSnapshot.before) {
      changes.push({ path: beforeSnapshot.path, before: beforeSnapshot.before, existedBefore: beforeSnapshot.existedBefore })
      runRecord.emit('change', { path: beforeSnapshot.path })
    }
  }
  return toolResult
}

async function runAgent(options) {
  const { runRecord, baseUrl, apiKey, model, userText, attachmentPaths, mcpConfig, copilotToken, sharedContextFiles, toolCallMode, chatClient } = options
  const chatBackend = chatClient || client
  const usesPromptToolCalling = toolCallMode === 'prompt'
  const projectRoot = runRecord.projectRoot
  const emit = runRecord.emit
  const signal = runRecord.abortController.signal

  const attachmentBlocks = (attachmentPaths || []).map((relativePath) => {
    const readResult = projectFileService.readFile(projectRoot, relativePath)
    return readResult.content && !readResult.error
      ? { path: relativePath, content: readResult.content.slice(0, maximumAttachmentCharacters) }
      : null
  }).filter(Boolean)

  const sharedContextBlocks = sharedContextFiles && sharedContextFiles.length
    ? sharedContextFiles.map((file) => ({
      role: 'system',
      content: 'Shared workspace rule file "' + file.name + '" (from the workspace root):\n```\n' + file.content + '\n```'
    }))
    : []
  // Document requests carry the COMPACT ruleset (CODE-38) - the full
  // explainer stays out of the prompt and lives in the Docs overlay.
  const documentRulesBlock = documentSystem.buildDocumentRulesBlock(userText)

  emit('thinking', { text: 'Planning...' })
  let planSteps
  try {
    const planResponse = await chatBackend.chatOnce({
      baseUrl, apiKey, model,
      messages: buildPlanMessages(attachmentBlocks, userText, sharedContextBlocks, documentRulesBlock),
      signal
    })
    planSteps = parsePlan(planResponse.content)
  } catch (planError) {
    if (planError && planError.name === 'AbortError') throw planError
    planSteps = [{ title: 'Direct task', file: '', action: 'Complete the request directly with tools' }]
  }
  emit('plan', { steps: planSteps })

  let externalTools = { schemas: [], callers: new Map(), catalogText: '', notes: [] }
  if (mcpConfig && mcpConfig.enabled) {
    externalTools = await buildExternalTools({ mcpConfig: mcpConfig, copilotToken: copilotToken || '' })
    externalTools.notes.forEach((note) => emit('tool-output', { text: note }))
  }
  const allToolSchemas = toolSchemaForApi().concat(externalTools.schemas)

  const changes = []
  let lastAssistantText = ''

  for (let stepIndex = 0; stepIndex < planSteps.length; stepIndex++) {
    const step = planSteps[stepIndex]
    emit('step', { index: stepIndex, title: step.title })
    const stepMessages = buildStepMessages({
      step,
      stepIndex,
      totalSteps: planSteps.length,
      attachments: attachmentBlocks,
      userText,
      externalCatalogText: externalTools.catalogText,
      sharedContextBlocks,
      toolCallMode,
      documentRulesBlock
    })
    for (let iteration = 0; iteration < maximumToolIterations; iteration++) {
      if (usesPromptToolCalling) {
        // Prompt-based tool calling (CODE-29): the gateway has no native
        // tool_calls - the model answers with a toolCalls JSON array or
        // <tool_calls> XML blocks (CODE-33).
        emit('thinking', { text: 'Step ' + (stepIndex + 1) + ' - thinking...' })
        const response = await chatBackend.chatOnce({
          baseUrl, apiKey, model,
          messages: stepMessages,
          signal
        })
        const promptToolCalls = parsePromptToolCalls(response.content || '')
        if (promptToolCalls.length === 0) {
          if (response.content) lastAssistantText = stripToolCallMarkup(response.content)
          break
        }
        stepMessages.push({ role: 'assistant', content: response.content || '' })
        for (const call of promptToolCalls) {
          emit('tool', { name: call.name, status: 'running', summary: summarizeArguments(call.arguments) })
          let toolResult
          try {
            toolResult = await executeTool(call, runRecord, changes, externalTools)
          } catch (toolError) {
            toolResult = { ok: false, error: toolError && toolError.message ? toolError.message : String(toolError) }
          }
          emit('tool', { name: call.name, status: toolResult.ok ? 'done' : 'error', summary: summarizeToolResult(toolResult) })
          stepMessages.push({
            role: 'user',
            content: 'Tool result for "' + call.name + '":\n' + JSON.stringify(toolResult)
          })
        }
        continue
      }
      emit('thinking', { text: 'Step ' + (stepIndex + 1) + ' - thinking...' })
      const response = await chatBackend.chatOnce({
        baseUrl, apiKey, model,
        messages: stepMessages,
        tools: allToolSchemas,
        signal
      })
      if (response.content) lastAssistantText = stripToolCallMarkup(response.content)
      if (response.toolCalls.length === 0) break
      stepMessages.push({
        role: 'assistant',
        content: response.content || null,
        tool_calls: response.toolCalls.map((call) => call.raw)
      })
      for (const call of response.toolCalls) {
        emit('tool', { name: call.name, status: 'running', summary: summarizeArguments(call.arguments) })
        let toolResult
        try {
          toolResult = await executeTool(call, runRecord, changes, externalTools)
        } catch (toolError) {
          toolResult = { ok: false, error: toolError && toolError.message ? toolError.message : String(toolError) }
        }
        emit('tool', { name: call.name, status: toolResult.ok ? 'done' : 'error', summary: summarizeToolResult(toolResult) })
        stepMessages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(toolResult) })
      }
    }
  }

  const summary = lastAssistantText || 'Task finished.'
  runRecord.changes = changes
  return { summary: summary, changes: changes }
}

module.exports = { runAgent, resolveApproval, parsePlan, parseJsonLenient, parsePromptToolCalls, parseXmlToolCalls, stripToolCallMarkup }
